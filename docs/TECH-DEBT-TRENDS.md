# Tech Debt six-month trends

The Tech Debt Cockpit uses a precomputed Jira snapshot for its Received versus
Closed charts. This keeps historical aggregation outside the application
server while the open priority queue remains live.

## Schedule and manual execution

`.github/workflows/tech-debt-trends.yml` runs nightly at 06:00 UTC and supports
`workflow_dispatch`. The workflow runs:

```bash
npm run collect:tech-debt-trends
```

The collector requests the current UTC calendar month and previous five months,
classifies Bugs with the same deterministic rules as the cockpit, then uploads
the complete validated snapshot. A Jira or upload failure exits non-zero and
does not replace the previous snapshot.

## Required configuration

| Name | Type | Purpose |
| --- | --- | --- |
| `JIRA_EMAIL` | Secret | Jira API account email |
| `JIRA_TOKEN` | Secret | Jira API token |
| `ORG_PULSE_URL` | Secret | Base URL of the deployed Org Pulse instance |
| `ORG_PULSE_TOKEN` | Secret | Bearer token with `releases:write` |
| `JIRA_HOST` | Repository variable | Optional Jira base URL; defaults to Red Hat Jira |

The upload endpoint rejects malformed snapshots and payloads larger than 15 MB
before writing through the shared storage abstraction. The stored contract is
documented in `docs/DATA-FORMATS.md`.
