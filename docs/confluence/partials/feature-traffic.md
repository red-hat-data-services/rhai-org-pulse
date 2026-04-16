## Description

Feature Traffic provides traffic maps showing RHAISTRAT feature delivery across repositories and components. It visualizes the flow of strategic features from planning through delivery, enabling program managers and team leads to track feature health, status, and version coverage.

The module fetches feature traffic data from GitLab CI pipeline artifacts, providing a near-real-time view of which features are being worked on across the organization.

## Key Features

- **Feature Traffic Overview** — Visual traffic maps showing all tracked RHAISTRAT features with status, health, and version filters
- **Feature Detail Drill-Down** — Per-feature view showing repository coverage, component involvement, and delivery status
- **GitLab CI Integration** — Automated data fetch from GitLab CI pipeline artifacts
- **Filtering & Sorting** — Filter by feature status, version, health; sort by various criteria
- **Custom Export** — Export feature traffic data for external reporting

## Views / UI

| View | Purpose |
|---|---|
| **Overview** | Traffic map of all features with status badges, health indicators, and filtering controls |
| **Feature Detail** | Individual feature drill-down showing repos, components, and delivery progress |

## Data Sources & Integrations

- **GitLab API** — CI pipeline artifacts containing feature traffic data (requires dedicated `FEATURE_TRAFFIC_GITLAB_TOKEN`)

## Dependencies

- No direct module dependencies
- Requires a dedicated GitLab token with access to CI artifacts

## Known Limitations

- Data availability depends on GitLab CI pipelines running and producing artifacts in the expected format
- Feature traffic data format is tightly coupled to the RHAISTRAT feature tracking CI pipeline
