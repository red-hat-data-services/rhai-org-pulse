<!-- Space: RHAI -->
<!-- Title: Org Pulse Platform — Overview & Vision -->
<!-- Parent: Org Pulse Application -->

# Org Pulse Platform

## What is Org Pulse?

Org Pulse is an internal platform application that provides self-service delivery visibility for the Red Hat AI Platform (RHAI) organization. It aggregates data from Jira, GitHub, GitLab, LDAP, Google Sheets, and Product Pages into a unified dashboard — eliminating the manual effort of gathering delivery metrics across disparate tools.

Built as a modular Vue 3 + Express.js application deployed on OpenShift, Org Pulse is owned, roadmapped, and operated as an internal product serving RHAI delivery teams.

## Platform Mission

Simplify delivery visibility for RHAI engineering teams by providing **self-service dashboards and APIs** — so teams can focus on building, not on gathering metrics.

## Platform Classification

| Attribute | Value |
|---|---|
| **Consumption Model** | Self-Service |
| **Platform Lead** | Saiesh Prabhu (@saprabhu05) |
| **Platform Co-Lead** | Erle Marion (@emarion) |
| **Repository** | [rhai-org-pulse](https://github.com/red-hat-data-services/rhai-org-pulse) |
| **Production URL** | [Org Pulse](https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com) |
| **API Documentation** | [OpenAPI / Swagger](https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/api/docs) |

## Guiding Principles

1. **Self-Service First** — All platform capabilities are consumable on-demand via dashboards and APIs, without requiring manual approvals or coordination.
2. **Minimum Viable Scope** — We deliver a complete experience for each use case before expanding. No feature bloat.
3. **Compelling, Not Mandatory** — We make the right thing the easiest thing to do. Teams adopt Org Pulse because it saves them time, not because they are required to.
4. **Simplicity by Default** — Every module exists to remove complexity from delivery teams, not to add process.

## Who Is This For?

| Audience | What They Get |
|---|---|
| **Individual Contributors** | Personal metrics, peer trends, contribution history |
| **Team Leads** | Team allocation, sprint progress, component ownership |
| **Managers & Directors** | Org-wide trends, cross-team comparison, delivery velocity |
| **Program Managers** | Feature traffic, release forecasting, component breakdown |
| **RHAI Engineering** | Delivery dashboards, roster management, upstream insights |
| **Program Office** | Release analysis, allocation tracking, feature delivery maps |

## Platform Modules

| Module | Status | Owner | Consumers |
|---|---|---|---|
| [Team Tracker](Org Pulse — Team Tracker) | Active | Alex Corvin (@accorvin) | ICs, Team Leads, Managers, Directors · RHAI Engineering, RHAI Platform |
| [Org Roster](Org Pulse — Org Roster) | Active | Alex Corvin (@accorvin) | Team Leads, Managers, PMs · RHAI Engineering, Program Office |
| [Release Analysis](Org Pulse — Release Analysis) | Active | Saiesh Prabhu (@saprabhu05) | PMs, Managers, Directors · Program Office, RHAI Engineering |
| [Feature Traffic](Org Pulse — Feature Traffic) | Active | Unassigned | PMs, Team Leads · Program Office, RHAI Engineering |
| [AI Impact](Org Pulse — AI Impact) | Active | Alex Corvin (@accorvin) | Managers, Directors, PMs · RHAI Leadership, Program Office |
| [Allocation Tracker](Org Pulse — Allocation Tracker) | Beta (Disabled) | Unassigned | Team Leads, Managers · RHAI Engineering, Program Office |
| [Upstream Pulse](Org Pulse — Upstream Pulse) | Beta (Disabled) | Unassigned | ICs, Team Leads, Managers · RHAI Engineering, OSPO |

## Resources

| Page | Description |
|---|---|
| [How to Engage](Org Pulse — How to Engage) | How teams interact with us, services provided, SLAs |
| [Getting Started](Org Pulse — Getting Started) | Access prerequisites, onboarding, API tokens |
| [Architecture & Design](Org Pulse — Architecture & Design) | System context, module system, data flow, tech stack |
| [Contributor's Guide](Org Pulse — Contributor's Guide) | Development setup, code style, building new modules |

---

*This page is auto-generated from the Org Pulse repository. To propose changes, submit a PR to [docs/confluence/](https://github.com/red-hat-data-services/rhai-org-pulse/tree/main/docs/confluence).*
