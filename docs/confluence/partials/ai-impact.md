## Description

AI Impact tracks AI adoption and usage across the RHAI delivery pipeline. It detects AI-related work by analyzing Jira labels, resolving linked features, and measuring adoption trends over configurable time windows. This module gives leadership visibility into how AI tooling is being adopted and where it is driving impact.

## Key Features

- **AI Adoption Metrics** — Track the percentage of work items with AI-related labels across teams and projects
- **Jira Label Detection** — Configurable label matching to identify AI-related issues (e.g., `ai-assisted`, `copilot`, `ai-generated`)
- **Linked Feature Resolution** — Resolves Jira issue links to track which strategic features involve AI tooling
- **Time Window Filtering** — View adoption trends across week, month, and 3-month windows
- **RFE Data Integration** — Connects AI impact data to Request for Enhancement tracking
- **Configurable Thresholds** — Admin-configurable labels and threshold settings via the Settings panel

## Views / UI

| View | Purpose |
|---|---|
| **AI Impact** | Main dashboard showing AI adoption rates, trend charts, and team-level breakdown |

## Data Sources & Integrations

- **Jira Cloud** — Label-based queries, issue link resolution
- **Admin configuration** — AI-related label lists and threshold settings managed via Settings

## Dependencies

- No direct module dependencies
- Uses shared Jira integration from the platform core

## Known Limitations

- AI detection relies on Jira labels being consistently applied by teams; unlabeled AI work is not captured
- Label configuration must be maintained as new AI tooling labels are introduced
