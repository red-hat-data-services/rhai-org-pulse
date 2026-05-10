# Component Onboarding Sync Pipeline

Fetches component onboarding issues from Jira (project `RHOAIENG`, label `component-onboarding`) and pushes them to the org-pulse API every 6 hours.

## How it works

1. Queries Jira for all RHOAIENG issues cloned from the two onboarding epic templates (RHOAIENG-17225 and RHOAIENG-35683) with the `component-onboarding` label
2. For each issue, downloads the `componentonboardingdetails.yaml` attachment (graceful skip if absent) and reads RHAISTRAT feature links
3. Derives `completionStatus` from Jira status and `onboardingSteps` from issue labels
4. DELETEs existing data from org-pulse, then bulk-upserts all records in chunks of 500

## Prerequisites

- Python 3.11+
- A Jira Cloud API token (from https://id.atlassian.com/manage-profile/security/api-tokens)
- An org-pulse API token (`tt_...` prefix, created via **Settings → API Tokens** in the org-pulse UI)

## GitLab CI/CD Variables

Configure these in **Settings → CI/CD → Variables** in your GitLab project. Mark `JIRA_TOKEN` and `ORG_PULSE_API_TOKEN` as **Masked**.

| Variable | Description |
|---|---|
| `ORG_PULSE_BACKEND_URL` | Base URL of the org-pulse backend, e.g. `https://org-pulse.example.com` |
| `ORG_PULSE_API_TOKEN` | Bearer token (`tt_...`) for the org-pulse API |
| `JIRA_EMAIL` | Your Red Hat email address used for Jira authentication |
| `JIRA_TOKEN` | Jira Cloud API token |

## Cron schedule

Configure the schedule in **CI/CD → Schedules** in GitLab:

| Cron | Description |
|---|---|
| `0 */6 * * *` | Every 6 hours |

The pipeline only runs on scheduled triggers and manual web triggers (not on every push).

## Manual run

```bash
cd pipeline/component-onboarding
pip install -r requirements.txt

JIRA_EMAIL=you@redhat.com \
JIRA_TOKEN=your-jira-api-token \
ORG_PULSE_BACKEND_URL=http://localhost:3001 \
ORG_PULSE_API_TOKEN=tt_your_token \
python fetch_and_push.py
```

The script prints a summary at the end and exits non-zero if any records failed to upsert.

## Label → onboarding step mapping

| Jira Label | Step field |
|---|---|
| `component-onboarding` | `yamlValidated` |
| `quay-mr-raised` | `quayRepoCreated` |
| `konflux-mr-raised` | `konfluxOnboarded` |
| `push-pipeline-mr-raised` | `pushPipelineConfigured` |
| `operator-integration-mr-raised` | `operatorIntegrated` |
| `bundle-config-mr-raised` | `bundleConfigured` |
| `delivery-repo-mr-raised` | `deliveryRepoProvisioned` |
| `product-listing-mr-raised` | `productListingUpdated` |
| `renovate-setup-mr-raised` | `renovateSetup` |
