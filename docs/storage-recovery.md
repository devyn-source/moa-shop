# MOA Catalog storage recovery

October 6, 2026. Owner: Devyn. Backup operator acceptance remains deferred.

## Verified archive

The owner-only [MOA Catalog Recovery folder](https://drive.google.com/drive/folders/1IGbP1f78FSkJXOY6GopJPNJHwm3e2YA2) contains [the October 6 encrypted archive](https://drive.google.com/file/d/1UIA3keysnVpEK1L5DYo-ETNNZRblwRNf/view). Folder and file permissions were independently checked: Devyn is the sole principal. No sharing notifications were sent.

The archive contains 197 objects, 113,573,205 plaintext bytes. Scope is shop `artwork`, `sku-patterns`, `sku-models`, `sku-plates`, and backend `express-artwork`. Other MoaOS buckets, external proof URLs and provider configuration are outside this capture. It is not evidence that every historical linked proof is recoverable.

Files and their path manifest use AES-256-GCM with random per-file nonces. The archive contains a dependency-free Node recovery tool. No database credentials or decryption key are packaged. Each source listing was compared before and after capture; every decrypted file was checked against its SHA-256 and byte count. The uploaded archive was downloaded, its SHA-256 matched, and all 197 objects were extracted successfully offline. Temporary plaintext test files were then removed. An initial extraction hit local disk exhaustion; removing only generated test copies allowed the complete retry to pass.

Archive SHA-256: `98f2eec2bc9d563277b78e3de8cfd950e1c08ee3f1bfffae887881959c6395b3`.

Key identifier: `7712e232fb57642a`, not the secret itself. After Devyn's separate explicit approval, the key was uploaded to the owner-only [MOA Catalog Recovery Keys folder](https://drive.google.com/drive/folders/1DRzkHzNFCxrQ1yB6K0BNZMnZRE_n-MVY), file ID `1r_0vZIV6auVYzJL1UgfIcRAGYXYbg_Kv`. Its 32-byte size and uploaded checksum match the local key; permissions independently show Devyn as the sole principal. The local copy remains at `/Users/moabot/.config/moa-backup-keys/storage-20261006.key`, owner-only permissions. Keep the two folders separate and restricted. Both rely on the same Drive account; separate folders do not provide account-compromise isolation.

## Offline recovery

1. Obtain the archive and its matching key through approved access. Check the archive checksum before unpacking. Allow at least three times the archive size in free disk space for download, unpacking and recovered files.
2. Unpack the verified tar into a new private directory. The archive contains `shop/`, `backend/`, `storage-archive.mjs` and `RECOVERY.txt`.
3. Run the included tool for each profile. Replace the example paths with local paths; never put the key into a command argument as a literal value.

```sh
node storage-archive.mjs verify ./shop /private/path/recovery.key
node storage-archive.mjs extract ./shop /private/path/recovery.key /private/path/new-shop-recovery
node storage-archive.mjs verify ./backend /private/path/recovery.key
node storage-archive.mjs extract ./backend /private/path/recovery.key /private/path/new-backend-recovery
```

Extraction refuses an existing destination and unsafe or duplicate paths. Recovered directories contain original bucket/path names and `recovery-manifest.json`, including bucket settings and content hashes. Keep these files private. The tool does not upload, overwrite or delete provider objects.

4. Reconcile the database backup timestamp with both storage capture timestamps. They are separate snapshots. Identify order/proof references created or changed between them before returning service.
5. Restore files into an isolated target with matching bucket policies and MIME/size settings. Verify actual order and proof references, private-object access restrictions, original content hashes and public catalog assets before switching production. Uploading into a provider is a separate recovery operation, not performed by this offline tool.

## Creating a new capture

Run from the repository with dependencies installed. Use private env files with the appropriate project URL and service-role key. The CLI requires the exact known project and fixed bucket allowlist; its transport permits reads and storage-list requests only. Archives and keys must be outside the repository and separate from each other. Use a new output directory and an owner-only 32-byte random key.

```sh
node --env-file=/private/path/shop.env scripts/operations/storage-backup.mjs backup shop /private/path/new-shop-archive /private/path/recovery.key
node --env-file=/private/path/backend.env scripts/operations/storage-backup.mjs backup backend /private/path/new-backend-archive /private/path/recovery.key
node --test scripts/operations/storage-backup.test.mjs
```

A listing/download failure, changed source, safety limit or integrity failure leaves the capture incomplete. Do not upload it as a completed backup. The complete encrypted manifest and passing verification are required. Publish encrypted archives only into the restricted recovery folder and verify file permissions and uploaded checksums. Key exports require their own approval.

## Database coverage and open gates

Both production projects returned eight completed physical backups spanning September 29 through October 6. Latest timestamps: shop `2026-10-06T11:04:05.656Z`, backend `2026-10-06T09:30:47.226Z`. PITR is disabled on both. This is backup availability evidence, not a hosted database restore drill. Database backups exclude Storage API file bytes; see [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups).

This is a verified manual file snapshot. Recurring capture, retention, missed-backup detection and recovery of every linked proof remain open. Off-device key custody is verified under Devyn's approved access. No new subscription or paid recovery feature was enabled. Provider configuration and database/file reconciliation must also be included in a complete disaster-recovery rehearsal. Stage 4 remains open.
