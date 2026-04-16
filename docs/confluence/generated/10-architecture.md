<!-- Space: RHAI -->
<!-- Parent: Org Pulse Application -->
<!-- Title: Org Pulse — Architecture & Design -->

# Org Pulse — Architecture & Design

| | |
|---|---|
| **Platform Lead** | Saiesh Prabhu ([@saprabhu05](https://github.com/saprabhu05)) |
| **Platform Co-Lead** | Erle Marion ([@emarion](https://github.com/emarion)) |
| **Production URL** | [https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/](https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/) |
| **Repository** | [red-hat-data-services/rhai-org-pulse](https://github.com/red-hat-data-services/rhai-org-pulse) |

---

## System Context

At the highest level (C4 Level 1), Org Pulse serves as a centralized organizational health and metrics platform that sits between **RHAI users** and multiple **external data sources**.

Users access Org Pulse through a web browser. All requests pass through an **OpenShift OAuth proxy** that authenticates users against Red Hat SSO before traffic reaches the application. The platform aggregates data from the following external systems:

- **Jira Cloud** — Sprint data, issue tracking, and JQL-based metric queries
- **GitHub** — Repository contribution history via GraphQL API
- **GitLab** — Repository contribution history via GraphQL API
- **LDAP** — Organizational directory and team membership data
- **Google Sheets** — Supplementary roster enrichment and manual data inputs
- **Product Pages** — Red Hat product metadata and release information

All communication with external data sources is server-side only. The frontend never contacts external services directly.

---

## Container Architecture

Org Pulse runs as three containers within an OpenShift pod, backed by persistent storage:

### Frontend — nginx + Vue 3 SPA

- **nginx** serves the statically built Vue 3 single-page application.
- All requests to `/api/*` are reverse-proxied by nginx to the backend container.
- Client-side routing is handled by Vue Router with an nginx fallback rule.

### Backend — Express.js on Node.js

- **Express.js 5.2** running on **Node.js 20** provides the REST API.
- Handles all data aggregation, transformation, and business logic.
- Reads and writes data to the PersistentVolumeClaim (PVC) as JSON files.
- Authenticates requests using headers injected by the OAuth proxy sidecar.

### OAuth Proxy Sidecar

- **OpenShift OAuth proxy** runs as a sidecar container in the same pod.
- Intercepts all incoming traffic and redirects unauthenticated users to OpenShift OAuth.
- On successful authentication, injects `X-Forwarded-Email` and `X-Forwarded-User` headers into requests forwarded to nginx/backend.

### PersistentVolumeClaim (PVC) — JSON Data Storage

- All application data is stored as **JSON files on a PersistentVolumeClaim**.
- There is no traditional database (no PostgreSQL, MySQL, or MongoDB).
- The PVC provides durable storage that survives pod restarts and redeployments.

---

## Module System

Org Pulse uses a **manifest-driven module architecture** designed for extensibility and isolation.

### Module Manifest (`module.json`)

Each module contains a `module.json` file that declares:

| Field | Description |
|---|---|
| `name` | Human-readable module name |
| `slug` | URL-safe identifier used in routing |
| `description` | Brief summary of the module's purpose |
| `icon` | Lucide icon name for sidebar and cards |
| `views` | Array of view definitions (name, path, component) |
| `enabled` | Whether the module is active by default |
| `order` | Display order in the sidebar |
| `dependencies` | Other modules or shared services this module requires |

### Auto-Discovery

Modules are automatically discovered at build time:

- **Frontend:** Uses `import.meta.glob` to scan for module directories and dynamically register routes and components.
- **Backend:** Uses `module-loader.js` to scan for module directories and register API route handlers.

### Isolation Rules

- Modules **cannot cross-import** from each other.
- Shared code must be placed in the `@shared/` directory.
- Modules may only depend on `@shared/` exports and their declared dependencies.

---

## Data Flow

### Roster Sync

```
LDAP  ──>  Google Sheets enrichment  ──>  Merged Roster  ──>  Person Metrics
```

1. **LDAP** provides the canonical list of team members and organizational hierarchy.
2. **Google Sheets** enrichment adds supplementary data (roles, focus areas, manual annotations).
3. The two sources are merged into a unified **roster** with normalized person records.
4. Person-level metrics from other modules are attached to roster entries.

### Metrics Refresh

```
Jira Sprint API + JQL queries  ──>  Person-level metrics  ──>  Monthly snapshots  ──>  Trends
```

1. The **Jira Sprint API** and **JQL queries** are used to pull sprint completion data, velocity, and issue-level metrics.
2. Results are attributed to individuals and stored as **person-level metrics**.
3. Metrics are periodically rolled up into **monthly snapshots**.
4. Snapshots feed into **trend analysis** for historical comparisons.

### GitHub / GitLab Contributions

```
GraphQL API queries  ──>  Contribution history  ──>  Trend aggregation
```

1. **GraphQL API** queries fetch commit, PR, and review activity from GitHub and GitLab.
2. Raw data is stored as **contribution history** per person.
3. Contributions are aggregated into **trends** (weekly, monthly, quarterly).

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Vue 3, Vite 6, Tailwind CSS 3, Chart.js 4, Lucide icons |
| **Backend** | Express.js 5.2, Node.js 20 |
| **Storage** | JSON files on PersistentVolumeClaim (no traditional database) |
| **Authentication** | OpenShift OAuth proxy (sidecar) |
| **CI/CD** | GitHub Actions &#8594; Quay.io &#8594; ArgoCD |
| **Infrastructure** | OpenShift with Kustomize overlays (dev, preprod, prod) |

---

## Deployment Architecture

### Environments

Org Pulse is deployed across three environments, each managed by a dedicated **Kustomize overlay**:

| Environment | Purpose | Image Policy |
|---|---|---|
| **dev** | Development and testing | Latest build from feature branches |
| **preprod** | Pre-production validation | Pinned image SHA from release candidates |
| **prod** | Production | Pinned image SHA auto-updated by CI |

### CI/CD Pipeline

1. **GitHub Actions** builds container images on push and tags them in **Quay.io**.
2. For production, the CI pipeline updates the Kustomize overlay with the new **pinned image SHA**.
3. **ArgoCD** detects the overlay change and **auto-syncs** the deployment to the cluster.

### Scheduled Data Refresh

A **CronJob** runs daily at **06:00 UTC** to refresh all data from external sources. The CronJob triggers the backend's data sync endpoints, which pull the latest data from Jira, GitHub, GitLab, LDAP, and Google Sheets, and writes updated JSON files to the PVC.

---

## Key Architectural Decisions

### No Traditional Database

All data is stored as **JSON files on a PersistentVolumeClaim**. This decision was made for simplicity: the data volume is modest, the access patterns are read-heavy with infrequent writes (daily refresh), and JSON files eliminate the operational overhead of managing a database instance. The PVC provides durability across pod restarts.

### Modular Architecture

Modules are **self-describing** via `module.json` manifests and are auto-discovered at build time. This design enables teams to contribute new modules without modifying core application code. The isolation rule (no cross-module imports, only `@shared/` dependencies) prevents tight coupling and keeps modules independently deployable.

### Stale-While-Revalidate Caching

The frontend uses a **stale-while-revalidate** pattern with `localStorage`. Cached data is served immediately to the user while a background request fetches fresh data. This provides near-instant page loads while ensuring data freshness within the daily refresh cycle.

### Anonymized Exports

All data exports support **GDPR-safe PII removal**. When exporting data (CSV, JSON), personally identifiable information is stripped or anonymized, ensuring that exported datasets can be safely shared outside the organization without compliance risk.

---

*This page is auto-generated from the Org Pulse repository. Do not edit manually — changes will be overwritten on the next publish cycle.*
