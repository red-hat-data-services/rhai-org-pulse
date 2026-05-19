## Description

Team Tracker is the core module of Org Pulse, providing comprehensive delivery metrics and sprint tracking across Jira, GitHub, and GitLab. It serves as the primary dashboard for understanding team velocity, individual contributions, and organizational trends over time.

The module automates roster synchronization from LDAP and Google Sheets, fetches sprint-level Jira metrics, and aggregates code contribution data from GitHub and GitLab — eliminating the manual effort of gathering delivery data across disparate tools.

## Key Features

- **Sprint Tracking** — Committed vs. delivered story points per sprint, with status badges and trend indicators
- **Roster Sync** — Automated team roster from Red Hat LDAP, enriched with Google Sheets metadata (GitHub usernames, team assignments, manager mappings)
- **Jira Metrics** — Per-person and per-team issue counts, story points (custom field `customfield_10028`), resolution rates
- **GitHub Contributions** — Pull requests, reviews, and commits via GitHub GraphQL API with historical tracking
- **GitLab Contributions** — Merge requests and commits via GitLab GraphQL API, supporting multiple instances
- **Monthly Snapshots** — Automated monthly trend data with annotation support for context (e.g., holidays, re-orgs)
- **Data Export** — Anonymized data export for external analysis (GDPR-safe PII removal)

## Views / UI

| View | Purpose |
|---|---|
| **Dashboard** | Org/team overview cards, sprint tracking, metric summaries with stale-data banners |
| **People** | Searchable people directory with individual contributor cards and detailed metrics |
| **Trends** | Monthly trend charts for Jira issues, GitHub contributions, and GitLab contributions (line + doughnut charts) |
| **Reports** | Configurable report builder with team selector, metric selector, and chart-type picker |

## Data Sources & Integrations

- **Jira Cloud** (redhat.atlassian.net) — Sprint Report API, JQL search with cursor pagination
- **GitHub** — GraphQL API (Classic PAT, `read:user` scope)
- **GitLab** — GraphQL API (PAT with `read_api` scope), multi-instance support
- **LDAP** — Red Hat corporate directory (requires VPN)
- **Google Sheets** — Service account auth for roster enrichment

## Dependencies

- Core module — no dependencies on other modules
- Provides roster data consumed by Org Roster and other modules

## Known Limitations

- LDAP sync requires VPN connectivity; fails silently if VPN is disconnected
- GitHub/GitLab contribution data is fetched daily; real-time data is not available
- Story point tracking relies on Jira custom field `customfield_10028`; projects using different fields require configuration
