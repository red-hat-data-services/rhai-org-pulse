# GitLab Classification Pipeline

Automated Jira issue classification for 40/40/20 allocation tracking (Dev / Feature / Other), running entirely in GitLab CI/CD.

## Overview

The classification pipeline analyzes Jira issues using a trained machine learning model and updates the `Activity Type` custom field (`customfield_10464`) to categorize work into:
- **Dev** — Development, bug fixes, technical work
- **Feature** — New features, enhancements, user-facing work  
- **Other** — Administrative, organizational, other work

This enables 40/40/20 allocation tracking across RHOAI engineering projects (AIPCC, RHOAIENG, RHAIENG, INFERENG).

## Architecture

**GitLab Repository**: https://gitlab.com/redhat/rhel-ai/agentic-ci/jira-issue-classifier

The pipeline is fully self-contained in GitLab CI/CD:
- **Configuration**: GitLab CI/CD variables (projects, confidence threshold, issue types)
- **Scheduling**: GitLab Pipeline Schedules (hourly, every 6/12 hours, daily)
- **Credentials**: Service account (`rhoaieng-automation@redhat.com`) stored in GitLab secrets
- **Execution**: Python script (`classify_issues.py`) with trained ML model

**No Org Pulse integration required.** All classification operations (scheduled auto-classification, test single issue, bulk backfill) are managed through GitLab's UI and API.

## Use Cases

### 1. Scheduled Auto-Classification
Automatically classify new/updated issues on a recurring schedule.

**Setup via GitLab UI:**
1. Navigate to **CI/CD > Schedules** in the jira-issue-classifier project
2. Click **New schedule**
3. Set description (e.g., "Hourly auto-classification")
4. Set interval using cron syntax or presets:
   - Every hour: `0 * * * *`
   - Every 6 hours: `0 */6 * * *`
   - Every 12 hours: `0 */12 * * *`
   - Daily at 6 AM UTC: `0 6 * * *`
5. Set target branch: `main`
6. Add variable `CLASSIFICATION_MODE` = `auto` (optional, this is the default)
7. Save

The pipeline will run on the schedule and classify issues created/updated in the last 24 hours.

### 2. Test Single Issue
Classify a single Jira issue without writing results (dry run for testing).

**Trigger via GitLab UI:**
1. Navigate to **CI/CD > Pipelines**
2. Click **Run pipeline**
3. Select branch: `main`
4. Add variables:
   - `CLASSIFICATION_MODE` = `test`
   - `TEST_ISSUE_KEY` = `AIPCC-12345` (the issue key to test)
5. Click **Run pipeline**

The job will output the predicted classification and confidence score without updating Jira.

### 3. Bulk Backfill
Classify multiple issues matching a JQL query (for historical backfill or batch corrections).

**Trigger via GitLab UI:**
1. Navigate to **CI/CD > Pipelines**
2. Click **Run pipeline**
3. Select branch: `main`
4. Add variables:
   - `CLASSIFICATION_MODE` = `bulk`
   - `BULK_JQL` = `project = AIPCC AND created >= -30d` (custom JQL query)
5. Click **Run pipeline**

The job will classify all issues matching the JQL and update the Activity Type field.

## Configuration

Classification behavior can be customized via GitLab CI/CD variables (Settings > CI/CD > Variables):

| Variable | Default | Description |
|----------|---------|-------------|
| `CLASSIFICATION_ENABLED` | `true` | Enable/disable classification |
| `CLASSIFICATION_PROJECTS` | `AIPCC,RHOAIENG,INFERENG,RHAIENG` | Jira projects to classify |
| `CLASSIFICATION_CONFIDENCE_THRESHOLD` | `0.85` | Minimum confidence to apply classification (0.0-1.0) |
| `CLASSIFICATION_ISSUE_TYPES` | `Story,Bug,Spike,Task,Epic,Vulnerability,Weakness` | Issue types to classify |

**Note:** These variables override the hardcoded defaults in `classify_issues.py`. Changes take effect immediately on the next pipeline run.

## Credentials

The pipeline uses a Jira service account for API access:
- **Email**: `rhoaieng-automation@redhat.com`
- **Token**: Stored in GitLab CI/CD variable `JIRA_TOKEN` (masked, protected)

The service account must have:
- Read access to configured Jira projects
- Write access to the Activity Type custom field (`customfield_10464`)

## Monitoring

**Pipeline Status**: https://gitlab.com/redhat/rhel-ai/agentic-ci/jira-issue-classifier/-/pipelines

Each pipeline run shows:
- Issues processed
- Classifications applied
- Confidence scores
- Any errors or skipped issues

**GitLab Schedules**: https://gitlab.com/redhat/rhel-ai/agentic-ci/jira-issue-classifier/-/pipeline_schedules

View active schedules, edit frequency, or deactivate recurring jobs.

## Related Documentation

- **Allocation Tracking**: See Team Tracker module documentation for how classified data surfaces in Org Pulse allocation views
- **Model Training**: See `jira-issue-classifier` repository for details on the ML model and training data
- **Jira Integration**: See `SYNC-WITH-ORG-PULSE.md` in the classifier repo for integration patterns

## Migration from Org Pulse UI

Previous versions had classification controls in the Org Pulse Settings > Allocation tab. This UI was removed in favor of the GitLab-native approach. All classification operations now happen exclusively in GitLab.

If you previously configured scheduled classifications through Org Pulse, you'll need to recreate them as GitLab Pipeline Schedules (see "Scheduled Auto-Classification" above).
