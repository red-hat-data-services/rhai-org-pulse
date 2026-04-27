<!-- Space: RHAI -->
<!-- Title: Org Pulse — How to Engage -->
<!-- Parent: Org Pulse Application -->

# How to Engage — Org Pulse Platform Team

This page defines how other teams interact with the Org Pulse platform team — what we offer, how to reach us, and what to expect.

## Team Identity

| Field | Value |
|---|---|
| **Team Name** | Org Pulse Platform Team |
| **Platform Lead** | Saiesh Prabhu (@saprabhu05) |
| **Platform Co-Lead** | Erle Marion (@emarion) |

## Team Focus

Provide self-service delivery visibility and organizational intelligence to RHAI engineering teams, enabling data-driven decision-making without manual data gathering.

## Services Provided

| Service | Description | Status | Consumption Model |
|---|---|---|---|
| Team Tracker | Core delivery metrics and sprint tracking | Active | Self-Service |
| Org Roster | Team structure, component mapping, RFE tracking | Active | Self-Service |
| Release Analysis | Release velocity, Monte Carlo forecasting | Active | Self-Service |
| Feature Traffic | RHAISTRAT feature delivery maps | Active | Self-Service |
| AI Impact | AI adoption tracking across delivery pipeline | Active | Self-Service |
| Allocation Tracker | Per-sprint 40-40-20 allocation tracking | Beta | Self-Service |
| Upstream Pulse | Open-source contribution insights | Beta | Self-Service |
| REST API | Programmatic access to all platform data | Active | Self-Service |

## How Teams Engage With Us

| Consuming Team | Engagement Model | Purpose | Duration |
|---|---|---|---|
| RHAI Delivery Teams | **Self-Service** | Consume dashboards and APIs for delivery metrics | Ongoing |
| Program Office | **Self-Service** | Consume release analysis and feature traffic data | Ongoing |
| RHAI Leadership | **Self-Service** | Consume org-wide trends and AI impact metrics | Ongoing |
| New Module Contributors | **Collaboration** | Co-develop new modules during initial build phase | Time-boxed |

## Software Owned & Maintained

| System | Repository | Purpose |
|---|---|---|
| Org Pulse Application | [rhai-org-pulse](https://github.com/red-hat-data-services/rhai-org-pulse) | Platform application (Vue 3 + Express.js) |
| OpenShift Deployment | [deploy/openshift/](https://github.com/red-hat-data-services/rhai-org-pulse/tree/main/deploy/openshift) | Kustomize overlays (dev, preprod, prod) |
| CI/CD Pipelines | [.github/workflows/](https://github.com/red-hat-data-services/rhai-org-pulse/tree/main/.github/workflows) | GitHub Actions for lint, test, build, image push |

## Service Level Expectations

| Metric | Target |
|---|---|
| **Availability** | Best-effort during business hours (US/APAC) |
| **Data Freshness** | Daily sync at 06:00 UTC via CronJob |
| **Incident Response** | Slack channel / GitHub issues |
| **API Stability** | Shared API contract documented in [shared/API.md](https://github.com/red-hat-data-services/rhai-org-pulse/blob/main/shared/API.md) |

## Communication Channels

| Channel | Purpose |
|---|---|
| **GitHub Issues** | Bug reports, feature requests, module proposals |
| **Pull Requests** | Code contributions (all PRs require review) |
| **Slack** | Real-time questions and support |

## Versioning Approach

- Production images use **git SHA pinning** (e.g., `abc1234`)
- Dev/preprod environments use `:latest` tags
- API changes follow the shared API stability contract
- Module manifests (`module.json`) are versioned with the application

---

*This page is auto-generated from the Org Pulse repository. To propose changes, submit a PR to [docs/confluence/](https://github.com/red-hat-data-services/rhai-org-pulse/tree/main/docs/confluence).*
