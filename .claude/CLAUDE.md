# AI Platform People & Teams — Claude Code Reference

@../AGENTS.md

This file extends AGENTS.md with architecture details, integration specifics,
and API routes that Claude Code needs for deep codebase work. For conventions,
hard constraints, and code style: see AGENTS.md (imported above).

## Local Development

### Quick Start

```bash
npm install
cp .env.example .env   # Edit with your credentials
npm run dev:full       # Starts Vite (5173) + Express (3001)
```

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `JIRA_EMAIL` | Your @redhat.com email |
| `JIRA_TOKEN` | Jira Cloud API token from https://id.atlassian.com/manage-profile/security/api-tokens |
| `ADMIN_EMAILS` | Comma-separated admin emails (seeds the role store) |

### Optional Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | Classic PAT with `read:user` scope (for contribution stats). Fine-grained tokens don't work with GraphQL API. |
| `GITLAB_TOKEN` | GitLab PAT with `read_api` scope (for contribution stats). |
| `GITLAB_BASE_URL` | GitLab instance URL (default: `https://gitlab.com`) |
| `IPA_BIND_DN` | LDAP bind DN for IPA roster sync (service account). |
| `IPA_BIND_PASSWORD` | LDAP bind password for IPA roster sync. |
| `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` | Path to Google SA JSON key (default: `/etc/secrets/google-sa-key.json`). |
| `PRODUCT_PAGES_CLIENT_ID` | OAuth client ID for Product Pages (production). |
| `PRODUCT_PAGES_CLIENT_SECRET` | OAuth client secret for Product Pages (production). |
| `PRODUCT_PAGES_TOKEN` | Personal bearer token for Product Pages (local dev fallback). |
| `FEATURE_TRAFFIC_GITLAB_TOKEN` | GitLab PAT for feature-traffic pipeline CI artifact fetching. |
| `DEMO_MODE` / `VITE_DEMO_MODE` | Set both to `true` for fixture data (no credentials needed). |

## Key Concepts

### Data Flow
- **Roster**: `data/org-roster-full.json` — built by roster sync (LDAP + Google Sheets). `deriveRoster()` transforms into API format.
- **Person metrics**: `data/people/{name}.json` — per-person Jira stats, 365-day lookback.
- **GitHub contributions**: `data/github-contributions.json` + `data/github-history.json`.
- **GitLab contributions**: `data/gitlab-contributions.json` + `data/gitlab-history.json`. Multi-instance support via `gitlabInstances` config.
- **Snapshots**: `data/snapshots/{sanitized-teamKey}/{YYYY-MM-DD}.json` (teamKey sanitized: `::` → `--`).
- **Trends**: Built dynamically from person metric files by bucketing resolved issues by month.
- **Site config**: `data/site-config.json` — platform-level settings (title prefix).
- **Composite keys**: Teams = `orgKey::teamName` (e.g., `shgriffi::Model Serving`).
- **Field options**: `data/team-data/field-options/<name>.json` — named allowed-value sets, referenced by `optionsRef`.
- **Messages**: `data/messages.json` — admin announcements, merged with computed provider messages.
- **Data file formats**: See `docs/DATA-FORMATS.md`. Demo fixtures must match production format.

### Roster Sync (`shared/server/roster-sync/`)
- **IPA LDAP** (`ipa-client.js`): Traverses `ipa.corp.redhat.com` via LDAPS. `ldapjs` v3: `createClient()` is synchronous; entries use `entry.attributes` array with `.type`/`.values`. GitHub/GitLab usernames from `rhatSocialUrl`.
- **Google Sheets** (`sheets.js`): Enriches LDAP data. Sheet names auto-discovered. Auth via `GOOGLE_SERVICE_ACCOUNT_KEY_FILE`.
- **Username Inference** (`username-inference.js`): Fuzzy-matches roster against GitHub org / GitLab group members.
- **Config**: `data/roster-sync-config.json`, managed via Settings UI.
- **Scheduler**: Daily sync (24h interval), manual trigger via API.

### Jira Integration (Jira Cloud — redhat.atlassian.net)
- Basic auth: `JIRA_EMAIL` + `JIRA_TOKEN`, base64-encoded.
- Sprint Report API: `/rest/greenhopper/1.0/rapid/charts/sprintreport`.
- JQL search: `/rest/api/3/search/jql` (GET, cursor-based `nextPageToken`).
- Name resolution: `/rest/api/2/user/search?query=`, cached in `data/jira-name-map.json`.
- JQL uses `assignee = "accountId"` (not display names).
- Story points field: `customfield_10028`.

### GitHub Integration (`modules/team-tracker/server/github/contributions.js`)
- GraphQL API via `node-fetch`. Auth: `GITHUB_TOKEN` (classic PAT, `read:user` scope).
- Batches: 10 users/batch (counts), 5 (history), 2s delay between batches.

### GitLab Integration (`modules/team-tracker/server/gitlab/contributions.js`)
- GraphQL API (group-level `contributions` query). Multi-instance via `gitlabInstances` config.
- Parallel per-instance (`Promise.allSettled`), 5-min timeout; sequential within instance (200ms delays).

### Module System
- Auto-discovery: frontend `import.meta.glob('/modules/*/module.json')`, backend `server/module-loader.js`.
- Vite aliases: `@shared` → `shared/`, `@modules` → `modules/`.
- Navigation: `inject('moduleNav')` → `navigateTo(viewId, params)`, `goBack()`.
- Hash routing: `#/<module-slug>/<view-id>?key=value`.
- Backend routes mounted at `/api/modules/<slug>/`.
- Legacy forwards: `/api/roster` etc. → `/api/modules/team-tracker/...`.

### Caching
- Frontend: localStorage stale-while-revalidate (prefix `tt_cache:`).
- API functions accept `onData` callback: called with cached data immediately, then fresh data.

## Deployment

Deployed to OpenShift via ArgoCD. Full guide: `deploy/OPENSHIFT.md`.

| Component | Image |
|-----------|-------|
| Frontend | `quay.io/org-pulse/team-tracker-frontend` (nginx + Vue SPA) |
| Backend | `quay.io/org-pulse/team-tracker-backend` (Express + PVC data) |
| OAuth Proxy | `quay.io/openshift/origin-oauth-proxy:4.16` (sidecar) |

Overlays: `dev/` (team-tracker ns), `preprod/` (ambient-code--team-tracker ns), `prod/`.

### CI/CD
- **`ci.yml`** — PRs + main: lint, test, build, kustomize validate. Required check: "Test & Build".
- **`build-images.yml`** — main pushes: detect changed components, build/push to Quay (`:<sha>` + `:latest`), create PR to update prod image tags, auto-merge.
- ConfigMap changes auto-trigger rollouts via kustomize content-hash suffixes.

### Auth Flow (production)
OAuth proxy sets `X-Forwarded-Email`/`X-Forwarded-User`. Backend checks against `data/roles.json`. Empty role store → first user auto-added.

## API Routes

All routes prefixed with `/api`. Authenticated via OAuth proxy in production.

**GET:**
- `/api/healthz` — health check (no auth)
- `/api/whoami` — current user info (proxy + token auth). Includes `permissionTier`, `isTeamAdmin`, `roles`.
- `/api/site-config` — site configuration
- `/api/messages` — app-wide messages (computed + stored)
- `/api/tokens` — current user's API tokens
- `/api/admin/tokens` — all API tokens (admin)
- `/api/roster` — org/team structure with members
- `/api/team/:teamKey/metrics` — team member metrics
- `/api/person/:name/metrics` — individual person metrics
- `/api/people/metrics` — bulk all-people metrics
- `/api/github/contributions` — GitHub contribution data
- `/api/gitlab/contributions` — GitLab contribution data
- `/api/trends` — monthly trend data
- `/api/allowlist` — authorized email list
- `/api/roles/me` — current user's roles
- `/api/roles` — all role assignments (admin)
- `/api/admin/roster-sync/config` — roster sync config
- `/api/admin/roster-sync/status` — sync status
- `/api/modules/team-tracker/sheets/discover` — discover sheet names (admin)
- `/api/modules/team-tracker/org-teams` — org-roster teams with member counts
- `/api/modules/team-tracker/org-teams/:teamKey` — single team detail
- `/api/modules/team-tracker/org-teams/:teamKey/members` — team members
- `/api/modules/team-tracker/permissions/me` — permission tier + managed UIDs
- `/api/modules/team-tracker/manager/dashboard` — manager dashboard data
- `/api/modules/team-tracker/structure/teams` — list teams
- `/api/modules/team-tracker/structure/unassigned` — unassigned people
- `/api/modules/team-tracker/structure/field-definitions` — field definitions
- `/api/modules/team-tracker/structure/audit-log` — audit log
- `/api/modules/team-tracker/registry/people/search/ldap` — LDAP search (rate-limited)
- `/api/modules/team-tracker/field-options` — list field option sets
- `/api/modules/team-tracker/field-options/:name` — single option set
- `/api/modules/team-tracker/snapshots/:teamKey` — team snapshots
- `/api/modules/team-tracker/snapshots/:teamKey/:personName` — person snapshots
- `/api/modules/release-analysis/product-pages/products` — Product Pages products (admin)
- `/api/modules/release-analysis/conforma/releases` — conforma releases
- `/api/modules/release-analysis/conforma/releases/:version` — release detail
- `/api/modules/release-analysis/conforma/status` — conforma data status
- `/api/modules/feature-traffic/features` — features (filterable)
- `/api/modules/feature-traffic/features/:key` — feature detail
- `/api/modules/feature-traffic/versions` — unique fix versions
- `/api/modules/feature-traffic/status` — data freshness
- `/api/modules/feature-traffic/config` — fetch config (admin)
- `/api/modules/ai-impact/assessments` — all assessments
- `/api/modules/ai-impact/assessments/:key` — single assessment + history
- `/api/modules/ai-impact/assessments/status` — assessment status (admin)
- `/api/modules/ai-impact/features` — all features
- `/api/modules/ai-impact/features/:key` — single feature + history
- `/api/modules/ai-impact/features/status` — feature status (admin)
- `/api/health-metrics/tracking/status` — opt-out status
- `/api/health-metrics/dashboard` — aggregated dashboard (admin/viewer)
- `/api/health-metrics/pages` — per-page stats (admin/viewer)
- `/api/health-metrics/pages/:pageId` — page detail (admin/viewer)
- `/api/health-metrics/user-types` — views by user type (admin/viewer)
- `/api/health-metrics/config` — config (admin)
- `/api/health-metrics/viewers` — authorized viewers (admin)
- `/api/health-metrics/field-definitions` — field definitions for settings (admin)

**PUT:**
- `/api/modules/team-tracker/field-options/:name` — replace option set values (admin)
- `/api/modules/ai-impact/assessments/:key` — upsert assessment (admin)
- `/api/modules/ai-impact/features/:key` — upsert feature (admin)

**POST:**
- `/api/tokens` — create API token
- `/api/site-config` — update site config (admin)
- `/api/admin/messages` — create announcement (admin)
- `/api/roster/refresh` — refresh all person metrics
- `/api/team/:teamKey/refresh` — refresh team metrics
- `/api/person/:name/metrics?refresh=true` — refresh single person
- `/api/github/refresh` — refresh GitHub contributions
- `/api/github/contributions/:username/refresh` — refresh single user
- `/api/gitlab/refresh` — refresh GitLab contributions
- `/api/gitlab/contributions/:username/refresh` — refresh single user
- `/api/trends/jira/refresh` — refresh Jira trends
- `/api/trends/github/refresh` — refresh GitHub history
- `/api/trends/gitlab/refresh` — refresh GitLab history
- `/api/admin/roster-sync/config` — save sync config
- `/api/admin/roster-sync/trigger` — trigger manual sync
- `/api/admin/roster-sync/unified` — unified roster + metadata sync (admin)
- `/api/allowlist` — update email list
- `/api/roles/assign` — assign role (admin)
- `/api/roles/revoke` — revoke role (admin)
- `/api/modules/team-tracker/snapshots/generate` — generate snapshots (admin)
- `/api/modules/team-tracker/structure/teams` — create team (admin/team-admin)
- `/api/modules/team-tracker/structure/teams/:teamId/members` — assign person (manager/admin)
- `/api/modules/team-tracker/structure/teams/:teamId/members/bulk` — bulk assign (manager/admin)
- `/api/modules/team-tracker/structure/field-definitions/person` — create person field (admin/team-admin)
- `/api/modules/team-tracker/structure/field-definitions/person/reorder` — reorder (admin/team-admin)
- `/api/modules/team-tracker/structure/field-definitions/team` — create team field (admin/team-admin)
- `/api/modules/team-tracker/structure/field-definitions/team/reorder` — reorder (admin/team-admin)
- `/api/modules/team-tracker/structure/migrate` — Sheets-to-in-app migration (admin)
- `/api/modules/team-tracker/structure/migrate/field-to-options` — field-to-options migration (team-admin)
- `/api/modules/team-tracker/field-options/:name/values` — add option values (team-admin)
- `/api/modules/team-tracker/registry/people/ldap-import` — LDAP import (team-admin/admin)
- `/api/modules/feature-traffic/refresh` — manual data refresh (admin)
- `/api/modules/feature-traffic/config` — save fetch config (admin)
- `/api/modules/release-analysis/conforma/bulk` — full replace conforma data (admin)
- `/api/modules/ai-impact/assessments/bulk` — bulk upsert assessments (admin)
- `/api/modules/ai-impact/features/bulk` — bulk upsert features (admin)
- `/api/health-metrics/track` — record page view (rate-limited)
- `/api/health-metrics/tracking/opt-out` — opt out (authenticated)
- `/api/health-metrics/config` — update config (admin)
- `/api/health-metrics/aggregate` — force re-aggregate (admin)
- `/api/health-metrics/viewers` — add viewer (admin)

**PATCH:**
- `/api/modules/team-tracker/structure/teams/:teamId` — rename team (admin/team-admin)
- `/api/modules/team-tracker/structure/field-definitions/person/:fieldId` — edit field def (admin/team-admin)
- `/api/modules/team-tracker/structure/field-definitions/team/:fieldId` — edit field def (admin/team-admin)
- `/api/modules/team-tracker/structure/person/:uid/fields` — update person fields (manager/admin)
- `/api/modules/team-tracker/structure/teams/:teamId/fields` — update team fields (admin/team-admin)
- `/api/modules/team-tracker/structure/teams/:teamId/boards` — update team boards (admin/team-admin)

**DELETE:**
- `/api/tokens/:id` — revoke own token
- `/api/admin/tokens/:id` — revoke any token (admin)
- `/api/admin/messages/:id` — remove announcement (admin)
- `/api/modules/team-tracker/snapshots` — delete all snapshots (admin)
- `/api/modules/release-analysis/conforma` — clear conforma data (admin)
- `/api/modules/ai-impact/assessments` — clear assessments (admin)
- `/api/modules/ai-impact/features` — clear features (admin)
- `/api/modules/team-tracker/structure/teams/:teamId` — delete team (admin/team-admin)
- `/api/modules/team-tracker/structure/teams/:teamId/members/:uid` — unassign person (manager/admin)
- `/api/modules/team-tracker/structure/field-definitions/person/:fieldId` — soft-delete field (admin/team-admin)
- `/api/modules/team-tracker/structure/field-definitions/team/:fieldId` — soft-delete field (admin/team-admin)
- `/api/modules/team-tracker/field-options/:name/values` — remove option values (admin)
- `/api/health-metrics/tracking/opt-out` — opt back in (authenticated)
- `/api/health-metrics/events` — purge raw events (admin)
- `/api/health-metrics/viewers/:email` — remove viewer (admin)
