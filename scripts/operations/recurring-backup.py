"""Daily, owner-only Drive capture. No notifications or source mutations.

Configuration contains local paths only. Credentials stay in existing private
env files; all subprocess output is captured and never copied into logs.
"""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import time
import uuid


FOLDER = '1IGbP1f78FSkJXOY6GopJPNJHwm3e2YA2'
KEY_FOLDER = '1DRzkHzNFCxrQ1yB6K0BNZMnZRE_n-MVY'
KEY_FILE = '1r_0vZIV6auVYzJL1UgfIcRAGYXYbg_Kv'
OWNER = 'devyn@magnumopus.agency'
KEY_ID = '7712e232fb57642a'
DAY = 24 * 3600


def digest(path, algorithm='sha256'):
    h = hashlib.new(algorithm)
    with Path(path).open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def save(path, data):
    path = Path(path)
    temporary = path.with_suffix('.tmp')
    with temporary.open('w') as out:
        json.dump(data, out, indent=2)
        out.write('\n')
    temporary.chmod(0o600)
    temporary.replace(path)


def read(path, default=None):
    try:
        return json.loads(Path(path).read_text())
    except FileNotFoundError:
        return default


def health(state, now=None):
    now = time.time() if now is None else now
    last = state.get('lastSuccessAt')
    age = now - last if last else None
    return {'checkedAt': now, 'lastSuccessAt': last,
            'ageHours': round(age / 3600, 2) if age is not None else None,
            'healthy': age is not None and 0 <= age <= 30 * 3600 and state.get('status') != 'failed',
            'status': state.get('status', 'never-completed'),
            'stage': state.get('stage'), 'driveFileId': state.get('driveFileId'),
            'scheduler': 'Mac launchd; login and wake dependent', 'notificationsSent': False}


def owner_only(data):
    permissions = data.get('permissions', [])
    return not data.get('nextPageToken') and len(permissions) == 1 and permissions[0].get('type') == 'user' and permissions[0].get('role') == 'owner' and permissions[0].get('emailAddress', '').lower() == OWNER


def remote_matches(remote, candidate):
    return (remote.get('md5Checksum') == candidate['md5']
            and str(remote.get('size')) == str(candidate['size'])
            and remote.get('appProperties', {}).get('moaRecoveryRun') == candidate['runId'])


class Runner:
    def __init__(self, config):
        self.config = config
        self.root = Path(config['stateRoot'])
        self.repo = Path(config['repository'])
        self.state = read(self.root / 'state.json', {})

    def stage(self, name):
        self.state.update(status='running', stage=name, lastAttemptAt=time.time())
        save(self.root / 'state.json', self.state)

    def command(self, args, timeout=120, json_result=True):
        result = subprocess.run(args, cwd=self.repo, capture_output=True, timeout=timeout, check=False)
        if result.returncode:
            raise RuntimeError('Subprocess failed; private output suppressed')
        return json.loads(result.stdout) if json_result else result.stdout

    def drive(self, resource, action, params, body=None, extra=None):
        args = [self.config['gws'], 'drive', resource, action, '--params', json.dumps(params)]
        if body is not None:
            args += ['--json', json.dumps(body)]
        return self.command(args + (extra or []), timeout=600)

    def permissions(self, file_id):
        data = self.drive('permissions', 'list', {'fileId': file_id, 'fields': 'nextPageToken,permissions(type,role,emailAddress)'})
        if not owner_only(data):
            raise RuntimeError('Recovery destination is not owner-only')

    def preflight(self):
        self.stage('preflight')
        for relative_path, expected_hash in self.config['sourceHashes'].items():
            if digest(self.repo / relative_path) != expected_hash:
                raise RuntimeError('Reviewed backup source changed; update the pinned installation after review')
        for path in [self.config['key'], *self.config['envFiles'].values()]:
            if Path(path).stat().st_mode & 0o077:
                raise RuntimeError('Private configuration must be owner-only')
        key = Path(self.config['key'])
        if key.stat().st_size != 32 or digest(key)[:16] != KEY_ID:
            raise RuntimeError('Unexpected recovery key')
        about = self.drive('about', 'get', {'fields': 'user(emailAddress),storageQuota'})
        if about.get('user', {}).get('emailAddress') != OWNER:
            raise RuntimeError('Wrong Drive identity')
        quota = about.get('storageQuota', {})
        if quota.get('limit') and int(quota['limit']) - int(quota.get('usage', 0)) < 2 * 1024**3:
            raise RuntimeError('Drive capacity needs review; no paid capacity added')
        for target in [FOLDER, KEY_FOLDER, KEY_FILE]:
            self.permissions(target)
        remote_key = self.drive('files', 'get', {'fileId': KEY_FILE, 'fields': 'id,size,md5Checksum,parents,trashed'})
        if remote_key.get('trashed') or KEY_FOLDER not in remote_key.get('parents', []) or str(remote_key.get('size')) != '32' or remote_key.get('md5Checksum') != digest(key, 'md5'):
            raise RuntimeError('Approved off-device key is missing or changed')

    def source(self, action, profile, output=None):
        args = [self.config['node'], '--env-file=' + self.config['envFiles'][profile],
                str(self.repo / 'scripts/operations/storage-backup.mjs'), action, profile]
        if output:
            args += [str(output), self.config['key']]
        return self.command(args, timeout=1200)

    def capture(self):
        pending = read(self.root / 'pending.json')
        if pending:
            archive = self.root / 'pending.tar'
            if digest(archive) != pending['sha256']:
                raise RuntimeError('Pending archive integrity failed')
            return pending
        self.stage('inventory')
        inventories = [self.source('inventory', p) for p in ('shop', 'backend')]
        total = sum(b['bytes'] for result in inventories for b in result['buckets'])
        if total > 2 * 1024**3 or shutil.disk_usage(self.root).free < total * 2 + 64 * 1024**2:
            raise RuntimeError('Local backup capacity needs review')
        self.stage('capture')
        work = Path(tempfile.mkdtemp(prefix='capture-', dir=self.root))
        try:
            reports = [self.source('backup', p, work / p) for p in ('shop', 'backend')]
            shutil.copy2(self.repo / 'scripts/operations/storage-archive.mjs', work / 'storage-archive.mjs')
            (work / 'RECOVERY.txt').write_text('MOA Catalog encrypted storage backup. Key is kept separately.\n'
                'Verify: node storage-archive.mjs verify ./shop /private/path/recovery.key\n'
                'Extract: node storage-archive.mjs extract ./shop /private/path/recovery.key /private/path/new-output\n'
                'Repeat for ./backend. Reconcile database and storage capture times before provider restoration.\n')
            archive = self.root / 'pending.tar'
            with tarfile.open(archive, 'w') as bundle:
                for name in ('shop', 'backend', 'storage-archive.mjs', 'RECOVERY.txt'):
                    bundle.add(work / name, arcname=name)
            candidate = {'runId': str(uuid.uuid4()), 'createdAt': time.time(), 'sha256': digest(archive),
                         'md5': digest(archive, 'md5'), 'size': archive.stat().st_size, 'reports': reports}
            save(self.root / 'pending.json', candidate)
            return candidate
        finally:
            shutil.rmtree(work)

    def upload(self, candidate):
        self.stage('upload')
        self.permissions(FOLDER)
        query = "'" + FOLDER + "' in parents and trashed = false and appProperties has { key='moaRecoveryRun' and value='" + candidate['runId'] + "' }"
        fields = 'id,size,md5Checksum,appProperties'
        existing = self.drive('files', 'list', {'q': query, 'fields': 'nextPageToken,files(' + fields + ')', 'pageSize': 100})
        files = existing.get('files', [])
        if existing.get('nextPageToken') or len(files) > 1:
            raise RuntimeError('Ambiguous existing upload; manual review required')
        if files:
            remote = files[0]
        else:
            name = time.strftime('moa-catalog-storage-%Y%m%dT%H%M%SZ-', time.gmtime(candidate['createdAt'])) + candidate['runId'][:8] + '.tar'
            remote = self.drive('files', 'create', {'ignoreDefaultVisibility': True, 'fields': fields},
                {'name': name, 'parents': [FOLDER], 'writersCanShare': False,
                 'appProperties': {'moaRecoveryRun': candidate['runId'], 'moaSha256': candidate['sha256']},
                 'description': 'Encrypted MOA Catalog storage snapshot. Recovery key is stored separately.'},
                ['--upload', str(self.root / 'pending.tar'), '--upload-content-type', 'application/x-tar'])
        if not remote_matches(remote, candidate):
            raise RuntimeError('Uploaded content differs from verified archive')
        self.permissions(remote['id'])
        self.stage('roundtrip')
        download = self.root / 'roundtrip.tar'
        try:
            self.drive('files', 'get', {'fileId': remote['id'], 'alt': 'media'}, extra=['--output', str(download)])
            if digest(download) != candidate['sha256']:
                raise RuntimeError('Downloaded archive differs from verified local capture')
        finally:
            download.unlink(missing_ok=True)
        return remote['id']

    def run(self, force=False):
        if not force and self.state.get('lastSuccessAt') and 0 <= time.time() - self.state['lastSuccessAt'] < DAY and not (self.root / 'pending.json').exists():
            return health(self.state)
        try:
            self.preflight()
            candidate = self.capture()
            file_id = self.upload(candidate)
            report = {**candidate, 'driveFileId': file_id, 'verifiedAt': time.time(), 'ownerOnly': True, 'roundtripVerified': True}
            save(self.root / 'last-success.json', report)
            self.state.update(status='succeeded', stage='complete', lastSuccessAt=time.time(), driveFileId=file_id)
            save(self.root / 'state.json', self.state)
            (self.root / 'pending.json').unlink(missing_ok=True)
            (self.root / 'pending.tar').unlink(missing_ok=True)
        except Exception:
            self.state.update(status='failed', failedAt=time.time())
            save(self.root / 'state.json', self.state)
            raise
        return health(self.state)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['run', 'status'])
    parser.add_argument('config')
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    os.umask(0o077)
    config = read(args.config)
    root = Path(config['stateRoot'])
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    if args.command == 'status':
        result = health(read(root / 'state.json', {}))
        print(json.dumps(result))
        return 0 if result['healthy'] else 1
    with (root / 'job.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print(json.dumps({'status': 'already-running'}))
            return 0
        try:
            print(json.dumps(Runner(config).run(args.force)))
            return 0
        except Exception:
            print(json.dumps({'status': 'failed', 'stage': read(root / 'state.json', {}).get('stage'), 'details': 'Private output suppressed; inspect source access, disk capacity and restricted Drive access.'}))
            return 1


if __name__ == '__main__':
    raise SystemExit(main())
