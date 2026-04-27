<!-- Space: RHAI -->
<!-- Title: Org Pulse — Feature Traffic -->
<!-- Parent: Org Pulse Application -->

# Feature Traffic

| Field | Value |
|---|---|
| **Service ID** | `feature-traffic` |
| **Status** | Active |
| **Owner** | Unassigned |
| **Platform Lead** | Saiesh Prabhu (@saprabhu05) |
| **Consumption Model** | Self-Service |
| **Consumers (Roles)** | Program Managers, Team Leads |
| **Consumers (Teams)** | Program Office, RHAI Engineering |
| **API Docs** | [OpenAPI / Swagger](https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/api/docs) |

---

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

## Getting Started

To access this module:
1. Connect to the Red Hat VPN
2. Navigate to [Org Pulse](https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/)
3. Authenticate via OpenShift OAuth
4. Select **Feature Traffic** from the sidebar navigation

For API access, create an API token via the user menu > "API Tokens".

## Feedback & Contributions

- **Feature requests / bugs**: [GitHub Issues](https://github.com/red-hat-data-services/rhai-org-pulse/issues)
- **Code contributions**: [Contributing Guide](https://github.com/red-hat-data-services/rhai-org-pulse/blob/main/CONTRIBUTING.md)
- **Module development**: [Module Guide](https://github.com/red-hat-data-services/rhai-org-pulse/blob/main/docs/MODULES.md)

---

*This page is auto-generated from the Org Pulse repository. To propose changes, submit a PR to [docs/confluence/](https://github.com/red-hat-data-services/rhai-org-pulse/tree/main/docs/confluence).*
