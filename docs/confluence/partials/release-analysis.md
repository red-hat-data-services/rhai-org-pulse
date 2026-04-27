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
