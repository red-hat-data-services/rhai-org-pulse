## Description

Allocation Tracker monitors per-sprint allocation against the 40-40-20 model used by RHAI teams. It provides visibility into how engineering effort is distributed across allocation buckets (e.g., feature work, tech debt, support), helping managers ensure teams maintain a healthy balance of work types.

**Note:** This module is disabled by default and must be enabled by an admin via Settings > Modules.

## Key Features

- **40-40-20 Model Tracking** — Tracks sprint allocation against configurable bucket targets (e.g., 40% features, 40% tech debt, 20% support)
- **Per-Project Allocation** — View allocation breakdown for individual Jira projects
- **Per-Team Allocation** — View allocation breakdown for individual teams
- **Configurable Buckets** — Admin-configurable allocation categories and target percentages
- **Sprint-Based Metrics** — Allocation data aggregated at the sprint level with trend indicators

## Views / UI

| View | Purpose |
|---|---|
| **Allocation** | Dashboard showing overall allocation distribution across all teams with bucket targets |
| **Project** | Per-project drill-down showing allocation distribution |
| **Team Detail** | Per-team drill-down showing allocation history and trends |

## Data Sources & Integrations

- **Jira Cloud** — Sprint data, issue categorization by allocation bucket
- **Admin configuration** — Allocation categories and target percentages managed via Settings

## Dependencies

- No direct module dependencies
- Uses shared Jira integration from the platform core

## Known Limitations

- Disabled by default; requires admin activation
- Allocation categorization depends on consistent Jira labeling or component mapping by teams
- The 40-40-20 split is the default but may not apply to all team structures
