# MOA Catalog availability observations

The independent observer runs in the existing [MOA n8n cloud account](https://magnumopus.app.n8n.cloud/workflow/3pcoIJotE7sgBUP8). Workflow ID: `3pcoIJotE7sgBUP8`. Its source is `scripts/operations/n8n-availability.mjs`; generate the workflow JSON by running that script. It uses five nodes: Schedule, three public GET requests, and a result summary. No application credentials, customer records, Slack nodes, email nodes or factory actions are present.

The UTC schedule is minute 4, 19, 34 and 49 of each hour. This consumes 96 executions per day, about 2,880 per 30 days, from the existing n8n plan. No subscription or capacity upgrade was made. Remaining account quota was not independently verified; monitor usage alongside other MOA workflows. The observer is isolated from the existing 24 workflows, which were not edited.

The first scheduled run is verified: execution `21018`, mode `trigger`, started October 6 at `17:49:00.149Z` and completed at `17:49:06.144Z`. Storefront, sign-in and dependencies all returned HTTP 200 with healthy content. [Recorded evidence](stage-4-cloud-availability.json). This is an actual timer execution, not a manual dispatch.

Targets are `/shop`, `/sign-in` and `/api/health` on `https://shop.magnumopus.agency`. Each request has a 15-second timeout, follows no redirects and retains HTTP failures for evaluation. The workflow timeout is 90 seconds. The final result requires HTTP 200 on all targets, HTML content type and MOA content on both pages, and `status: ok` in dependency JSON. HTTP errors, redirects, network failures, wrong pages and malformed JSON become unhealthy observations. The health endpoint checks both shop and backend dependencies internally without exposing credentials or order records.

The final node records `checkedAt`, `healthy`, per-target results and `notificationsSent: false`. A successful workflow execution means the observation completed, not that the site is healthy. Read the result. Successful and failed execution data are retained according to the existing n8n account's retention settings; no separate retention guarantee is assumed.

Operator procedure:

1. Open the workflow's Executions view. Confirm a recent run at the expected quarter-hour offset.
2. Read **Availability result**. If `healthy` is false, inspect the failing target and the MOA operations console. If there is no recent run, check n8n instance health, workflow activation and plan usage.
3. Record the incident owner, next action and next review in the operations console. Draft any Slack alert for exact-message review. No automatic outbound notification is configured.
4. The file-backup status has its own hourly [cloud watchdog](storage-recovery.md#independent-cloud-backup-watchdog). Review its latest **Backup result** as well; the public availability observer does not read private backup metadata.

The GitHub Actions observer remains an additional best-effort path. Two hosted manual observations passed, but no actual scheduled GitHub run was observed during this work even after re-enabling the workflow and refreshing its cron. Do not claim its unattended path passed. Its eight failure tests and the n8n observer's eight tests cover failure interpretation. See [GitHub scheduling documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) and [n8n Schedule Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/).
