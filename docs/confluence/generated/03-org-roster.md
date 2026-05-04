<!-- Space: RHAI -->
<!-- Title: Org Pulse — Org Roster -->
<!-- Parent: Org Pulse Application -->

# Org Roster

| Field | Value |
|---|---|
| **Service ID** | `org-roster` |
| **Status** | Active |
| **Owner** | Alex Corvin (@accorvin) |
| **Platform Lead** | Saiesh Prabhu (@saprabhu05) |
| **Consumption Model** | Self-Service |
| **Consumers (Roles)** | Team Leads, Managers, Program Managers |
| **Consumers (Teams)** | RHAI Engineering, Program Office |
| **API Docs** | [OpenAPI / Swagger](https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/api/docs) |

---

## Description

Org Roster provides a comprehensive view of team composition, organizational structure, and component ownership across the RHAI organization. It maps teams to Jira components, tracks Request for Enhancement (RFE) backlogs, and manages team metadata including board assignments, program managers, and org-level fields.

This module enables leadership to understand who owns what, how teams are structured, and where RFE work is distributed — supporting informed decisions about staffing and priorities.

## Key Features

- **Team Directory** — Searchable directory of all teams with member counts, leads, and component assignments
- **Component-to-Team Mapping** — Maps Jira components to owning teams for accountability and routing
- **RFE Backlog Tracking** — Tracks Request for Enhancement items per team and component
- **Org Dashboard** — High-level organizational metrics and team structure visualization
- **Custom Org Name Mapping** — Configurable mapping between LDAP org names and display names
- **Sync Status Tracking** — Visibility into roster sync health and last-sync timestamps

## Views / UI

| View | Purpose |
|---|---|
| **Team Directory** | Browse and search teams, view members, leads, and component assignments |
| **Org Dashboard** | Organizational metrics, team structure overview, cross-team comparisons |

## Data Sources & Integrations

- **Team Tracker roster data** — Consumes the synchronized roster from the Team Tracker module
- **Jira Cloud** — Component metadata, RFE issue queries
- **Admin configuration** — Org name mappings and team metadata managed via Settings

## Dependencies

- Depends on **Team Tracker** for roster data (LDAP + Google Sheets sync)

## Known Limitations

- Org name mappings must be manually configured by admins when organizational changes occur
- RFE tracking is limited to Jira issue types configured in the module settings

## Getting Started

To access this module:
1. Connect to the Red Hat VPN
2. Navigate to [Org Pulse](https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/)
3. Authenticate via OpenShift OAuth
4. Select **Org Roster** from the sidebar navigation

For API access, create an API token via the user menu > "API Tokens".

## Feedback & Contributions

- **Feature requests / bugs**: [GitHub Issues](https://github.com/red-hat-data-services/rhai-org-pulse/issues)
- **Code contributions**: [Contributing Guide](https://github.com/red-hat-data-services/rhai-org-pulse/blob/main/CONTRIBUTING.md)
- **Module development**: [Module Guide](https://github.com/red-hat-data-services/rhai-org-pulse/blob/main/docs/MODULES.md)

---

*This page is auto-generated from the Org Pulse repository. To propose changes, submit a PR to [docs/confluence/](https://github.com/red-hat-data-services/rhai-org-pulse/tree/main/docs/confluence).*
