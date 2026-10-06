import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('recurring-backup.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class RecoveryTests(unittest.TestCase):
    def test_drive_runs_within_private_archive_directory(self):
        runner = backup.Runner({'stateRoot': '/private/backups', 'repository': '/code', 'gws': '/bin/gws'})
        with patch.object(backup.subprocess, 'run') as run:
            run.return_value.returncode = 0
            run.return_value.stdout = b'{}'
            runner.command(['/bin/gws', 'drive', 'files', 'create'])
            self.assertEqual(run.call_args.kwargs['cwd'], Path('/private/backups'))
            runner.command(['/bin/node', 'backup.mjs'])
            self.assertEqual(run.call_args.kwargs['cwd'], Path('/code'))

    def test_health_rejects_missing_stale_future_or_failed(self):
        self.assertFalse(backup.health({}, 1000000)['healthy'])
        self.assertFalse(backup.health({'lastSuccessAt': 1}, 1000000)['healthy'])
        self.assertFalse(backup.health({'lastSuccessAt': 2000000}, 1000000)['healthy'])
        self.assertFalse(backup.health({'lastSuccessAt': 999999, 'status': 'failed'}, 1000000)['healthy'])
        self.assertTrue(backup.health({'lastSuccessAt': 999999, 'status': 'succeeded'}, 1000000)['healthy'])

    def test_access_must_be_only_the_verified_owner(self):
        owner = {'type': 'user', 'role': 'owner', 'emailAddress': backup.OWNER}
        self.assertTrue(backup.owner_only({'permissions': [owner]}))
        self.assertFalse(backup.owner_only({'permissions': [owner, {'type': 'anyone'}]}))
        self.assertFalse(backup.owner_only({'permissions': [owner], 'nextPageToken': 'more'}))
        self.assertFalse(backup.owner_only({'permissions': [{**owner, 'emailAddress': 'other@example.com'}]}))

    def test_late_verification_cannot_make_an_old_capture_current(self):
        self.assertFalse(backup.health({'lastSuccessAt': 999999, 'lastCapturedAt': 1, 'status': 'succeeded'}, 1000000)['healthy'])

    def test_remote_identity_size_and_content_must_all_match(self):
        candidate = {'md5': 'abc', 'size': 10, 'runId': 'run'}
        remote = {'md5Checksum': 'abc', 'size': '10', 'appProperties': {'moaRecoveryRun': 'run'}}
        self.assertTrue(backup.remote_matches(remote, candidate))
        for field, value in [('md5Checksum', 'other'), ('size', '11'), ('appProperties', {})]:
            self.assertFalse(backup.remote_matches({**remote, field: value}, candidate))

    def test_failed_run_keeps_previous_success_and_stage(self):
        with tempfile.TemporaryDirectory() as folder:
            backup.save(Path(folder) / 'state.json', {'lastSuccessAt': 1, 'driveFileId': 'old'})
            runner = backup.Runner({'stateRoot': folder, 'repository': folder})
            def fail():
                runner.stage('preflight')
                raise RuntimeError('private')
            with patch.object(runner, 'preflight', fail):
                with self.assertRaises(RuntimeError):
                    runner.run()
            state = backup.read(Path(folder) / 'state.json')
            self.assertEqual(state['lastSuccessAt'], 1)
            self.assertEqual(state['driveFileId'], 'old')
            self.assertEqual(state['stage'], 'preflight')
            self.assertEqual(state['status'], 'failed')

    def test_uncertain_upload_reuses_matching_existing_file(self):
        with tempfile.TemporaryDirectory() as folder:
            runner = backup.Runner({'stateRoot': folder, 'repository': folder})
            content = b'synthetic encrypted archive'
            (Path(folder) / 'pending.tar').write_bytes(content)
            candidate = {'md5': backup.digest(Path(folder) / 'pending.tar', 'md5'), 'sha256': backup.digest(Path(folder) / 'pending.tar'), 'size': len(content), 'runId': 'run', 'reports': [{'profile': p, 'verified': True, 'capturedAt': '2026-10-06T00:00:00Z', 'objectCount': 1} for p in ['shop', 'backend']]}
            actions = []
            def drive(resource, action, params, body=None, extra=None):
                actions.append(action)
                if action == 'list':
                    return {'files': [{'id': 'existing', 'md5Checksum': candidate['md5'], 'size': str(len(content)), 'appProperties': {'moaRecoveryRun': 'run'}}]}
                if action == 'get':
                    Path(extra[-1]).write_bytes(content)
                    return {}
                if action == 'update':
                    return {'properties': body['properties'], 'md5Checksum': candidate['md5'], 'size': str(len(content))}
                self.fail('Unexpected Drive mutation')
            with patch.object(runner, 'drive', drive), patch.object(runner, 'permissions'):
                self.assertEqual(runner.upload(candidate), 'existing')
            self.assertNotIn('create', actions)
            self.assertEqual(actions.count('update'), 1)
            self.assertFalse((Path(folder) / 'roundtrip.tar').exists())


if __name__ == '__main__':
    unittest.main()
