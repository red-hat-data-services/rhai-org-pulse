<!-- Space: RHAI -->
<!-- Title: Org Pulse — AI Impact -->
<!-- Parent: Org Pulse Application -->

# AI Impact

| Field | Value |
|---|---|
| **Service ID** | `ai-impact` |
| **Status** | Active |
| **Owner** | Alex Corvin (@accorvin) |
| **Platform Lead** | Saiesh Prabhu (@saprabhu05) |
| **Consumption Model** | Self-Service |
| **Consumers (Roles)** | Managers, Directors, Program Managers |
| **Consumers (Teams)** | RHAI Leadership, Program Office |
| **API Docs** | [OpenAPI / Swagger](https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/api/docs) |

---

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

## Getting Started

To access this module:
1. Connect to the Red Hat VPN
2. Navigate to [Org Pulse](https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/)
3. Authenticate via OpenShift OAuth
4. Select **AI Impact** from the sidebar navigation

For API access, create an API token via the user menu > "API Tokens".

## Feedback & Contributions

- **Feature requests / bugs**: [GitHub Issues](https://github.com/red-hat-data-services/rhai-org-pulse/issues)
- **Code contributions**: [Contributing Guide](https://github.com/red-hat-data-services/rhai-org-pulse/blob/main/CONTRIBUTING.md)
- **Module development**: [Module Guide](https://github.com/red-hat-data-services/rhai-org-pulse/blob/main/docs/MODULES.md)

---

*This page is auto-generated from the Org Pulse repository. To propose changes, submit a PR to [docs/confluence/](https://github.com/red-hat-data-services/rhai-org-pulse/tree/main/docs/confluence).*
