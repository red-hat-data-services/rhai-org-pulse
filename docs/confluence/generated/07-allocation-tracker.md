<!-- Space: RHAI -->
<!-- Title: Org Pulse — Allocation Tracker -->
<!-- Parent: Org Pulse Application -->

# Allocation Tracker

| Field | Value |
|---|---|
| **Service ID** | `allocation-tracker` |
| **Status** | Beta (Disabled by Default) |
| **Owner** | Unassigned |
| **Platform Lead** | Saiesh Prabhu (@saprabhu05) |
| **Consumption Model** | Self-Service |
| **Consumers (Roles)** | Team Leads, Managers |
| **Consumers (Teams)** | RHAI Engineering, Program Office |
| **API Docs** | [OpenAPI / Swagger](https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/api/docs) |

---

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

## Getting Started

To access this module:
1. Connect to the Red Hat VPN
2. Navigate to [Org Pulse](https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/)
3. Authenticate via OpenShift OAuth
4. Select **Allocation Tracker** from the sidebar navigation

For API access, create an API token via the user menu > "API Tokens".

## Feedback & Contributions

- **Feature requests / bugs**: [GitHub Issues](https://github.com/red-hat-data-services/rhai-org-pulse/issues)
- **Code contributions**: [Contributing Guide](https://github.com/red-hat-data-services/rhai-org-pulse/blob/main/CONTRIBUTING.md)
- **Module development**: [Module Guide](https://github.com/red-hat-data-services/rhai-org-pulse/blob/main/docs/MODULES.md)

---

*This page is auto-generated from the Org Pulse repository. To propose changes, submit a PR to [docs/confluence/](https://github.com/red-hat-data-services/rhai-org-pulse/tree/main/docs/confluence).*
