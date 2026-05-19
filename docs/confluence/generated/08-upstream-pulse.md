<!-- Space: RHAI -->
<!-- Title: Org Pulse — Upstream Pulse -->
<!-- Parent: Org Pulse Application -->

# Upstream Pulse

| Field | Value |
|---|---|
| **Service ID** | `upstream-pulse` |
| **Status** | Beta (Disabled by Default) |
| **Owner** | Unassigned |
| **Platform Lead** | Saiesh Prabhu (@saprabhu05) |
| **Consumption Model** | Self-Service |
| **Consumers (Roles)** | Individual Contributors, Team Leads, Managers |
| **Consumers (Teams)** | RHAI Engineering, Open Source Program Office |
| **API Docs** | [OpenAPI / Swagger](https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/api/docs) |

---

## Description

Upstream Pulse provides insights into open-source contributions across GitHub organizations. It enables RHAI teams to track their upstream engagement, understand contribution patterns, and maintain a portfolio view of the open-source projects they contribute to.

**Note:** This module is disabled by default and must be enabled by an admin via Settings > Modules.

## Key Features

- **GitHub Organization Analysis** — Analyze contribution patterns across one or more GitHub organizations
- **Contribution Insights** — Trending analysis of PRs, issues, reviews, and commits to upstream projects
- **Portfolio View** — Consolidated view of all upstream projects an organization contributes to, with governance data
- **Governance Data** — Track maintainer status, CODEOWNERS presence, and community health metrics

## Views / UI

| View | Purpose |
|---|---|
| **Dashboard** | Overview of upstream contribution activity across tracked GitHub organizations |
| **Insights** | Trending analysis and contribution pattern visualization |
| **Portfolio** | Portfolio view of upstream projects with governance and health indicators |

## Data Sources & Integrations

- **GitHub API** — Organization data, contribution history, repository metadata

## Dependencies

- No direct module dependencies
- Requires GitHub token with organization read access

## Known Limitations

- Disabled by default; requires admin activation
- Limited to GitHub-hosted upstream projects; GitLab upstream contributions are not tracked
- Contribution attribution depends on GitHub username mapping (configured via Team Tracker roster sync)

## Getting Started

To access this module:
1. Connect to the Red Hat VPN
2. Navigate to [Org Pulse](https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/)
3. Authenticate via OpenShift OAuth
4. Select **Upstream Pulse** from the sidebar navigation

For API access, create an API token via the user menu > "API Tokens".

## Feedback & Contributions

- **Feature requests / bugs**: [GitHub Issues](https://github.com/red-hat-data-services/rhai-org-pulse/issues)
- **Code contributions**: [Contributing Guide](https://github.com/red-hat-data-services/rhai-org-pulse/blob/main/CONTRIBUTING.md)
- **Module development**: [Module Guide](https://github.com/red-hat-data-services/rhai-org-pulse/blob/main/docs/MODULES.md)

---

*This page is auto-generated from the Org Pulse repository. To propose changes, submit a PR to [docs/confluence/](https://github.com/red-hat-data-services/rhai-org-pulse/tree/main/docs/confluence).*
