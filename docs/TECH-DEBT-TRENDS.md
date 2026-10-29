# Tech Debt six-month trends

The Tech Debt Cockpit uses a precomputed Jira snapshot for its Received versus
Closed charts. This keeps historical aggregation outside the application
server while the open priority queue remains live.

## Production schedule and manual execution

The external `team-tracker-tech-debt-trends` OpenShift CronJob runs nightly at
06:00 UTC. It uses the backend image only as a collector runtime; computation
runs in a separate Job pod, not in the application server. The Job reads the
existing Jira credentials from `team-tracker-secrets` and uploads through the
internal backend service using `proxy-auth-secret` and `CRON_ADMIN_EMAIL`.

Run the CronJob immediately with:

```bash
oc create job --from=cronjob/team-tracker-tech-debt-trends \
  tech-debt-trends-manual-$(date +%s)
```

For deployments outside OpenShift, the manually dispatched
`.github/workflows/tech-debt-trends.yml` workflow remains available. Both paths
run:

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
| `ORG_PULSE_URL` | Configuration | Base URL of the deployed Org Pulse instance |
| `ORG_PULSE_TOKEN` | Secret | Bearer token with `releases:write` for the manual workflow |
| `ORG_PULSE_EMAIL` | Configuration | Internal collector identity; provided by `CRON_ADMIN_EMAIL` in OpenShift |
| `ORG_PULSE_PROXY_SECRET` | Secret | Internal service authentication; provided by `proxy-auth-secret` in OpenShift |
| `JIRA_HOST` | Repository variable | Optional Jira base URL; defaults to Red Hat Jira |

The collector requires either `ORG_PULSE_TOKEN` or the paired internal
`ORG_PULSE_EMAIL` and `ORG_PULSE_PROXY_SECRET` values. Jira and proxy secret
values remain in OpenShift/Vault and are not copied to GitHub Actions.

The upload endpoint rejects malformed snapshots and payloads larger than 15 MB
before writing through the shared storage abstraction. The stored contract is
documented in `docs/DATA-FORMATS.md`.
