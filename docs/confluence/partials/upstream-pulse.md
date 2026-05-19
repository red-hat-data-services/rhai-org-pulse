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
