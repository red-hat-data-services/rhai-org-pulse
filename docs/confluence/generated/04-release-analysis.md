<!-- Space: RHAI -->
<!-- Title: Org Pulse — Release Analysis -->
<!-- Parent: Org Pulse Application -->

# Release Analysis

| Field | Value |
|---|---|
| **Service ID** | `release-analysis` |
| **Status** | Active |
| **Owner** | Saiesh Prabhu (@saprabhu05) |
| **Platform Lead** | Saiesh Prabhu (@saprabhu05) |
| **Consumption Model** | Self-Service |
| **Consumers (Roles)** | Program Managers, Managers, Directors |
| **Consumers (Teams)** | Program Office, RHAI Engineering |
| **API Docs** | [OpenAPI / Swagger](https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/api/docs) |

---

## Description

Release Analysis provides velocity tracking and probabilistic release date forecasting for RHAI releases. It integrates with Jira and Red Hat Product Pages to give program managers and engineering leadership a data-driven view of release health, component-level progress, and delivery probability.

The module uses Monte Carlo simulation to predict release completion dates based on historical velocity, offering confidence intervals rather than single-point estimates.

## Key Features

- **Release Velocity Tracking** — Story point burn-down and burn-up across releases with historical comparison
- **Monte Carlo Predictions** — Probabilistic release date estimation using historical velocity data (confidence intervals at 50%, 75%, 90%)
- **Product Pages Integration** — OAuth + personal token fallback for fetching release schedule data from Red Hat Product Pages
- **Target Version Resolution** — Automatic resolution of Jira `fixVersions` and target version fields
- **Per-Component Breakdown** — Drill into each Jira project and component to see individual release progress
- **Epic-Level Tracking** — Story point aggregation at the epic level with rollup to release totals

## Views / UI

| View | Purpose |
|---|---|
| **Release Analysis** | Release-level velocity charts, Monte Carlo forecasts, overall release health |
| **Component Breakdown** | Per-project and per-component drill-down with story point progress bars |

## Data Sources & Integrations

- **Jira Cloud** — Epics, story points, fix versions, component metadata
- **Product Pages API** — Release schedules, milestones (OAuth or bearer token auth)

## Dependencies

- No direct module dependencies
- Requires Jira and Product Pages API credentials configured in Settings

## Known Limitations

- Monte Carlo accuracy depends on sufficient historical velocity data (minimum ~3 sprints recommended)
- Product Pages integration requires either OAuth client credentials or a personal bearer token
- Target Version field resolution may not work for all Jira project configurations

## Getting Started

To access this module:
1. Connect to the Red Hat VPN
2. Navigate to [Org Pulse](https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/)
3. Authenticate via OpenShift OAuth
4. Select **Release Analysis** from the sidebar navigation

For API access, create an API token via the user menu > "API Tokens".

## Feedback & Contributions

- **Feature requests / bugs**: [GitHub Issues](https://github.com/red-hat-data-services/rhai-org-pulse/issues)
- **Code contributions**: [Contributing Guide](https://github.com/red-hat-data-services/rhai-org-pulse/blob/main/CONTRIBUTING.md)
- **Module development**: [Module Guide](https://github.com/red-hat-data-services/rhai-org-pulse/blob/main/docs/MODULES.md)

---

*This page is auto-generated from the Org Pulse repository. To propose changes, submit a PR to [docs/confluence/](https://github.com/red-hat-data-services/rhai-org-pulse/tree/main/docs/confluence).*
