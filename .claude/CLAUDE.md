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
| `IPA_BIND_DN` | LDAP bind DN for IPA roster sync (service account). Required for roster sync. |
| `IPA_BIND_PASSWORD` | LDAP bind password for IPA roster sync. Required for roster sync. |
| `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` | Path to Google SA JSON key (default: `/etc/secrets/google-sa-key.json`). For local dev: `./secrets/google-sa-key.json` |
| `PRODUCT_PAGES_CLIENT_ID` | OAuth client ID for Product Pages (production). Mutually exclusive with `PRODUCT_PAGES_TOKEN`. |
| `PRODUCT_PAGES_CLIENT_SECRET` | OAuth client secret for Product Pages (production). Used with `PRODUCT_PAGES_CLIENT_ID`. |
| `PRODUCT_PAGES_TOKEN` | Personal bearer token for Product Pages (local dev fallback). Used when OAuth env vars are not set. |
| `FEATURE_TRAFFIC_GITLAB_TOKEN` | GitLab PAT with `read_api` scope for releases execution pipeline. Overrides `GITLAB_TOKEN` for CI artifact fetching. |
| `AUTH_EMAIL_DOMAIN` | Override email domain for role matching (e.g. `cluster.local`). When set, role assignments normalize emails to this domain. Env var takes precedence over `authEmailDomain` in site-config.json. |
| `PRODUCT_BUILDS_API_URL` | Base URL of the AIPCC Dashboard API server. Can also be configured via Settings UI. |
| `DEMO_MODE` / `VITE_DEMO_MODE` | Set both to `true` for fixture data (no credentials needed). |

## Key Concepts

### Data Flow
- **Roster**: `data/org-roster-full.json` — built by roster sync (LDAP + Google Sheets). `deriveRoster()` transforms into API format.
- **Person metrics**: `data/people/{name}.json` — per-person Jira stats, 365-day lookback.
- **GitHub contributions**: `data/github-contributions.json` + `data/github-history.json`.
- **GitLab contributions**: `data/gitlab-contributions.json` + `data/gitlab-history.json`. Multi-instance support via `gitlabInstances` config.
- **Snapshots**: `data/snapshots/{sanitized-teamKey}/{YYYY-MM-DD}.json` (teamKey sanitized: `::` → `--`).
- **Trends**: Built dynamically from person metric files by bucketing resolved issues by month.
- **Site config**: `data/site-config.json` — platform-level settings (title prefix, auth email domain).
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

## Project Structure

```
src/
  components/       # App shell (App.vue, AppSidebar, LandingPage, SettingsView)
  composables/      # Shell-only composables (useModules, useModuleAdmin)
  module-loader.js  # Frontend module auto-discovery via import.meta.glob
  __tests__/        # Frontend tests

shared/
  client/
    composables/    # Shared composables (useRoster, useAuth, useGithubStats, etc.)
    services/       # API client with caching (api.js)
    components/     # Shared UI (Toast, LoadingOverlay, RefreshModal)
    index.js        # Barrel export
  server/
    storage.js      # Filesystem storage abstraction
    demo-storage.js # Fixture-backed storage for demo mode
    auth.js         # Auth middleware (requireAuth, requireAdmin)
    roster-sync/    # Roster sync engine (LDAP + Google Sheets), config, constants
    index.js        # Barrel export
```

## Local Kind Cluster

For testing the containerized deployment locally, see `deploy/KIND.md`. The `deploy/openshift/overlays/local/` overlay strips OpenShift-specific resources (OAuth proxy, Route, ServiceAccount) and uses locally-built images with `imagePullPolicy: Never`. Cluster name is `team-tracker` (not the default `kind`). If using Podman: `export KIND_EXPERIMENTAL_PROVIDER=podman`.

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
- ConfigMap changes auto-trigger rollouts via kustomize `configMapGenerator` — ConfigMap names include a content hash suffix (e.g., `team-tracker-config-5h2f9k`), so any data change produces a new name and triggers a pod rollout automatically.

**Branch protection** uses a GitHub repository ruleset on `main`:
- Requires PRs (no direct pushes)
- Requires "Test & Build" status check
- Admin role has bypass (used by `GH_PAT` secret for CI auto-merge PRs)

**Repo secrets:**
- `QUAY_USERNAME` / `QUAY_PASSWORD` — Quay.io registry credentials for image push
- `GH_PAT` — Personal access token with admin bypass, used by CI to create and auto-merge image tag update PRs
- `GCP_SA_KEY` — GCP service account JSON key for Vertex AI auth (Claude code review)

**Daily CronJob** (`deploy/openshift/overlays/prod/cronjob-sync-refresh.yaml`): Runs at 6:00 AM UTC, triggers roster sync then full metrics refresh via the backend API.

### Testing

**Unit tests** use Vitest with jsdom and @vue/test-utils. Run via `npm test`.

**Smoke tests** use Playwright to verify the production container images. Located in `tests/smoke/app-loads.spec.js`. These run automatically in CI after images are built and can also be run locally:

```bash
make build-frontend-image  # Build frontend container
make build-backend-image   # Build backend container
make smoke-test            # Run Playwright smoke tests (uses demo mode)
```

Smoke tests verify:
- Application loads without JavaScript errors (console errors, unhandled exceptions)
- Core UI structure renders (sidebar, main content, page title)
- Data/API integration works (no stuck loading spinners, no error states)
- Client-side routing functions (hash-based navigation)
- Basic accessibility (semantic landmarks present)

Playwright runs in a container (`mcr.microsoft.com/playwright:v1.60.0`), so no local browser installation needed. Works on any OS (RHEL/Podman, macOS/Docker, Ubuntu). The Makefile auto-detects the container runtime (prefers Podman on RHEL).

**IMPORTANT:** The Playwright version must match between `package.json` (`@playwright/test`) and `Makefile` (`PLAYWRIGHT_IMAGE`). When updating Playwright, change both files to the same version to prevent browser binary mismatches.

CI workflow (`build-images.yml`):
1. Builds frontend and backend images via `make build-frontend-image` and `make build-backend-image`
2. Runs `make smoke-test FRONTEND_IMAGE=<image>:<sha> BACKEND_IMAGE=<image>:<sha>` against the built images
3. Uploads images to Quay if tests pass

**Integration tests** use Playwright to verify module-specific functionality against production containers in demo mode. Located in `tests/integration/<module>.spec.js`:

```bash
make test-module MODULE=ai-impact
```

Integration tests verify:
- Modules are visible and clickable in sidebar
- Module views load correctly
- Module content renders (buttons, inputs, tables, cards)
- API endpoints return data
- Disabled menu items are non-clickable

Tests run in same Playwright container as smoke tests. Uses tag-based filtering (`@module-name`) for selective execution.

CI workflow (`integration-tests.yml`):
- Triggers on changes to `modules/**` or `tests/integration/**`
- Uses `dorny/paths-filter` to detect which modules changed
- Uses matrix strategy: changed modules are automatically added to test matrix via `steps.filter.outputs.changes`
- Runs tests only for changed modules via generic `test-module` Makefile target
- Reusable composite action at `.github/actions/test-org-pulse-module/`

To add integration tests for a new module:
1. Create `tests/integration/<module>.spec.js` with `@<module-name>` tag
2. Add filter definition in `integration-tests.yml` `detect-changes` job filters section
3. That's it! The matrix automatically picks up the new module when it changes

### Building images on ARM Macs
Standard `--platform linux/amd64` builds fail: npm times out under QEMU, esbuild crashes. Workaround: build/install natively, then copy into amd64 base images. See `deploy/OPENSHIFT.md` step 3 for details. This works because the backend has no native Node addons (all pure JS).

### Dev vs prod
- **Dev overlay** clears `ADMIN_EMAILS` via `configMapGenerator` merge behavior. When empty, the first authenticated user is auto-added to the role store.
- **Prod overlay** keeps `ADMIN_EMAILS` to pre-seed the role store with known admins.

### Auth Flow (production)
OAuth proxy (sidecar on frontend pod) authenticates users and sets `X-Forwarded-Email` / `X-Forwarded-User` headers. Backend reads `X-Forwarded-Email` and checks against `data/roles.json` via role-store. Empty role store → first user auto-added.

## API Routes

All routes prefixed with `/api`. Authenticated via OAuth proxy in production.

**GET:**
- `/api/healthz` — health check (no auth)
- `/api/whoami` — current user info (proxy + token auth). Includes `permissionTier`, `isTeamAdmin`, `roles`.
- `/api/site-config` — site configuration
- `/api/messages` — app-wide messages (computed + stored)
- `/api/tokens` — current user's API tokens
- `/api/token-scopes` — available scope catalog and presets
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
- `/api/admin/refresh/status` — refresh registry status (admin)
- `/api/admin/roster-sync/config` — roster sync config
- `/api/admin/roster-sync/status` — sync status
- `/api/modules/team-tracker/sheets/discover` — discover sheet names (admin)
- `/api/modules/team-tracker/org-teams` — org-roster teams with member counts
- `/api/modules/team-tracker/org-teams/:teamKey` — single team detail
- `/api/modules/team-tracker/org-teams/:teamKey/members` — team members
- `/api/modules/team-tracker/permissions/me` — permission tier + managed UIDs
- `/api/modules/team-tracker/manager/dashboard` — manager dashboard data
- `/api/modules/team-tracker/admin/field-completeness` — all people/teams with field data for data quality auditing (team-admin/admin)
- `/api/modules/team-tracker/structure/teams` — list teams
- `/api/modules/team-tracker/structure/teams/query` — query teams by metadata field values with AND/OR, pagination
- `/api/modules/team-tracker/structure/group-by` — group teams by metadata field value (inverted index)
- `/api/modules/team-tracker/structure/unassigned` — unassigned people
- `/api/modules/team-tracker/structure/field-definitions` — field definitions
- `/api/modules/team-tracker/structure/audit-log` — audit log
- `/api/modules/team-tracker/registry/people/search/ldap` — LDAP search (rate-limited)
- `/api/modules/team-tracker/field-options` — list field option sets
- `/api/modules/team-tracker/field-options/:name` — single option set
- `/api/modules/team-tracker/field-exceptions` — list field exceptions with optional filters (roster:read)
- `/api/modules/team-tracker/snapshots/:teamKey` — team snapshots
- `/api/modules/team-tracker/snapshots/:teamKey/:personName` — person snapshots
- `/api/modules/team-tracker/components` — component list (deprecated alias)
- `/api/modules/team-tracker/structure/migrate/preview` — migration preview (admin)
- `/api/modules/team-tracker/structure/migrate/field-to-options/preview` — field-to-options migration preview (team-admin)
- `/api/modules/releases/registry` — list releases
- `/api/modules/releases/registry/config` — registry config (Jira projects for version resolution) (release-manager)
- `/api/modules/releases/registry/:id` — single release
- `/api/modules/releases/audit-log` — unified audit log across all release domains
- `/api/modules/releases/planning/releases` — planning releases
- `/api/modules/releases/planning/releases/:version/candidates` — release candidates
- `/api/modules/releases/planning/refresh/status` — planning refresh status
- `/api/modules/releases/planning/config` — planning config (admin)
- `/api/modules/releases/planning/permissions` — planning permissions
- `/api/modules/releases/planning/smartsheet/releases` — smartsheet releases
- `/api/modules/releases/planning/audit-log` — planning audit log
- `/api/modules/releases/planning/admin/seed/fixture` — load seed fixture (admin)
- `/api/modules/releases/planning/releases/:version/health` — release health
- `/api/modules/releases/planning/releases/:version/health/summary` — health summary
- `/api/modules/releases/planning/releases/:version/health/feature/:key` — single feature health
- `/api/modules/releases/planning/releases/:version/health/snapshot/:phase` — committed snapshot
- `/api/modules/releases/planning/releases/:version/health/refresh/status` — health refresh status
- `/api/modules/releases/planning/releases/:version/health/milestones/debug` — milestones debug (release-manager)
- `/api/modules/releases/planning/releases/health-admin/config` — health admin config (release-manager)
- `/api/modules/releases/planning/releases/health-admin/jira-fields` — search Jira fields for RICE (release-manager)
- `/api/modules/releases/execution/features` — features (filterable)
- `/api/modules/releases/execution/features/:key` — feature detail
- `/api/modules/releases/execution/versions` — unique fix versions
- `/api/modules/releases/execution/status` — data freshness
- `/api/modules/releases/execution/config` — fetch config (admin)
- `/api/modules/releases/execution/tracking/data` — feature tracking data by fixVersion query
- `/api/modules/releases/execution/tracking/versions` — available portfolio versions for feature tracking
- `/api/modules/releases/delivery/config` — delivery config (admin)
- `/api/modules/releases/delivery/product-pages/products` — Product Pages products (admin)
- `/api/modules/releases/delivery/refresh/status` — delivery refresh status
- `/api/modules/releases/delivery/analysis` — release analysis data
- `/api/modules/releases/delivery/conforma/releases` — conforma releases
- `/api/modules/releases/delivery/conforma/releases/:version` — conforma release detail
- `/api/modules/releases/delivery/conforma/status` — conforma data status
- `/api/modules/releases/delivery/quality/versions` — quality versions with bug counts
- `/api/modules/releases/delivery/quality/bugs` — cumulative bug data for selected versions
- `/api/modules/releases/delivery/quality/components` — components with bug counts
- `/api/modules/releases/delivery/quality/debug` — debug diagnostics for bug count issues (admin)
- `/api/modules/releases/delivery/commitment/versions` — get available versions for commitment tracking (independent of delivery analysis)
- `/api/modules/releases/delivery/commitment/:version/:phase` — commitment tracking data for a release phase
- `/api/modules/releases/delivery/releases-metadata` — releases metadata (product names, dates)
- `/api/modules/releases/hygiene/features` — hygiene features for a version
- `/api/modules/releases/hygiene/summary` — aggregate violation summary for a version
- `/api/modules/releases/hygiene/refresh/status` — current hygiene refresh state
- `/api/modules/releases/hygiene/config` — hygiene rule configuration (release-manager)
- `/api/modules/releases/hygiene/program-report` — cross-version aggregate hygiene report
- `/api/modules/ai-impact/assessments` — all assessments
- `/api/modules/ai-impact/assessments/:key` — single assessment + history
- `/api/modules/ai-impact/assessments/status` — assessment status (admin)
- `/api/modules/ai-impact/features` — all features
- `/api/modules/ai-impact/features/:key` — single feature + history
- `/api/modules/ai-impact/features/status` — feature status (admin)
- `/api/modules/ai-impact/test-plans` — all test plans (slim projection)
- `/api/modules/ai-impact/test-plans/:key` — single test plan + history
- `/api/modules/ai-impact/test-plans/status` — test plan data status (admin)
- `/api/modules/ai-impact/test-plans/sync/status` — Jira sync status
- `/api/modules/ai-impact/component-onboarding` — all component onboarding entries (latest projection)
- `/api/modules/ai-impact/component-onboarding/:key` — single component onboarding entry + history
- `/api/modules/ai-impact/component-onboarding/status` — component onboarding data status (admin)
- `/api/modules/ai-impact/doc-mr-kpi-data` — MR quality KPI data fetched directly from GitLab
- `/api/modules/product-builds/config` — AIPCC Dashboard API configuration (admin)
- `/api/modules/product-builds/health` — AIPCC Dashboard API connectivity check
- `/api/modules/product-builds/products/:key` — product details (proxied)
- `/api/modules/product-builds/drops` — list drops with filtering/pagination (proxied)
- `/api/modules/product-builds/drops/:key` — drop details (proxied)
- `/api/modules/product-builds/drops/:key/changelog` — drop changelog (proxied)
- `/api/modules/product-builds/drops/:key/metrics` — drop Konflux release metrics (proxied)
- `/api/modules/product-builds/series` — list product series/versions (proxied)
- `/api/modules/product-builds/artifacts` — list artifacts with filtering/pagination (proxied)
- `/api/modules/product-builds/artifacts/:key` — artifact details (proxied)
- `/api/modules/product-builds/artifacts/:key/wheels` — wheel collections for a container artifact (proxied)
- `/api/modules/product-builds/artifacts/:key/containers` — containers using a wheels-collection or base-image (proxied)
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
- `/api/modules/releases/registry/:id` — update release (release-manager)
- `/api/modules/releases/planning/releases/:version/big-rocks/:name` — update big rock (release-manager)
- `/api/modules/releases/planning/releases/:version/big-rocks/reorder` — reorder big rocks (release-manager)
- `/api/modules/releases/planning/releases/:version/health/override/:featureKey` — set health override (release-manager)
- `/api/modules/releases/planning/releases/health-admin/config` — save health admin config (release-manager)
- `/api/modules/ai-impact/assessments/:key` — upsert assessment (admin)
- `/api/modules/ai-impact/features/:key` — upsert feature (admin)
- `/api/modules/ai-impact/test-plans/:key` — upsert test plan (admin)

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
- `/api/admin/refresh-all` — trigger full refresh of all handlers (admin)
- `/api/admin/refresh/:module` — trigger refresh for a single module (admin)
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
- `/api/modules/team-tracker/field-exceptions` — create field exception (team-admin/admin)
- `/api/modules/team-tracker/registry/people/ldap-import` — LDAP import (team-admin/admin)
- `/api/modules/releases/registry` — create release (release-manager)
- `/api/modules/releases/registry/config` — save registry config (release-manager)
- `/api/modules/releases/registry/discover` — auto-discover from Product Pages (release-manager)
- `/api/modules/releases/registry/resolve-jira-versions` — preview Jira version resolution (release-manager)
- `/api/modules/releases/registry/resolve-jira-versions/apply` — apply resolved Jira versions to registry (release-manager)
- `/api/modules/releases/admin/migrate-storage` — clean up old storage paths after migration (admin)
- `/api/modules/releases/planning/releases` — create planning release (release-manager)
- `/api/modules/releases/planning/releases/:version/big-rocks` — create big rock (release-manager)
- `/api/modules/releases/planning/releases/:version/refresh` — refresh planning data (release-manager)
- `/api/modules/releases/planning/jira/validate-keys` — validate Jira keys (release-manager)
- `/api/modules/releases/planning/releases/:version/import/doc/preview` — preview doc import (release-manager)
- `/api/modules/releases/planning/releases/:version/import/doc` — import doc (release-manager)
- `/api/modules/releases/planning/admin/seed` — bulk import seed data (admin)
- `/api/modules/releases/planning/releases/:version/health/refresh` — refresh health (release-manager)
- `/api/modules/releases/planning/releases/:version/health/snapshot/:phase` — create health snapshot (release-manager)
- `/api/modules/releases/planning/releases/health-admin/rice-test` — test RICE field IDs (release-manager)
- `/api/modules/releases/execution/refresh` — manual execution data refresh (admin)
- `/api/modules/releases/execution/config` — save execution fetch config (admin)
- `/api/modules/releases/delivery/config` — save delivery config (admin)
- `/api/modules/releases/delivery/refresh` — refresh delivery data (admin)
- `/api/modules/releases/delivery/admin/releases` — upload releases (admin)
- `/api/modules/releases/delivery/conforma/bulk` — full replace conforma data (admin)
- `/api/modules/releases/delivery/quality/refresh` — refresh quality data from Jira (admin)
- `/api/modules/releases/delivery/discover-releases` — discover releases from Jira Target Version field (admin)
- `/api/modules/releases/delivery/releases-metadata` — save releases metadata (admin)
- `/api/modules/releases/delivery/commitment/snapshot/:version/:phase` — create commitment snapshot by querying Jira directly with commitmentTrackingJql (admin)
- `/api/modules/releases/hygiene/refresh` — trigger hygiene data refresh (release-manager)
- `/api/modules/releases/hygiene/refresh-all` — refresh hygiene data for all stored versions (release-manager)
- `/api/modules/releases/hygiene/config` — save hygiene rule configuration (release-manager)
- `/api/modules/ai-impact/assessments/bulk` — bulk upsert assessments (admin)
- `/api/modules/ai-impact/features/bulk` — bulk upsert features (admin)
- `/api/modules/ai-impact/test-plans/bulk` — bulk upsert test plans (admin)
- `/api/modules/ai-impact/test-plans/sync` — trigger test plan Jira sync (admin)
- `/api/modules/ai-impact/component-onboarding/bulk` — bulk upsert component onboarding data (admin)
- `/api/modules/product-builds/config` — save AIPCC Dashboard API configuration (admin)
- `/api/health-metrics/track` — record page view (rate-limited)
- `/api/health-metrics/tracking/opt-out` — opt out (authenticated)
- `/api/health-metrics/config` — update config (admin)
- `/api/health-metrics/aggregate` — force re-aggregate (admin)
- `/api/health-metrics/viewers` — add viewer (admin)

**PATCH:**
- `/api/tokens/:id/scopes` — update own token scopes
- `/api/admin/tokens/:id/scopes` — update any token scopes (admin)
- `/api/modules/team-tracker/structure/teams/:teamId` — rename team (admin/team-admin)
- `/api/modules/team-tracker/structure/teams/:teamId/description` — update team description (team-purview)
- `/api/modules/team-tracker/structure/field-definitions/person/:fieldId` — edit field def (admin/team-admin)
- `/api/modules/team-tracker/structure/field-definitions/team/:fieldId` — edit field def (admin/team-admin)
- `/api/modules/team-tracker/structure/person/:uid/fields` — update person fields (manager/admin)
- `/api/modules/team-tracker/structure/teams/:teamId/fields` — update team fields (admin/team-admin)
- `/api/modules/team-tracker/structure/teams/:teamId/boards` — update team boards (admin/team-admin)
- `/api/modules/team-tracker/field-options/:name/values/rename` — rename option value with cascade (admin)

**DELETE:**
- `/api/tokens/:id` — revoke own token
- `/api/admin/tokens/:id` — revoke any token (admin)
- `/api/admin/messages/:id` — remove announcement (admin)
- `/api/modules/team-tracker/snapshots` — delete all snapshots (admin)
- `/api/modules/releases/registry/:id` — archive release (release-manager)
- `/api/modules/releases/planning/releases/:version` — delete planning release (admin)
- `/api/modules/releases/planning/releases/:version/big-rocks/:name` — delete big rock (release-manager)
- `/api/modules/releases/planning/releases/:version/health/override/:featureKey` — remove health override (release-manager)
- `/api/modules/releases/delivery/config` — delete delivery config (admin)
- `/api/modules/releases/delivery/conforma` — clear conforma data (admin)
- `/api/modules/ai-impact/assessments` — clear assessments (admin)
- `/api/modules/ai-impact/features` — clear features (admin)
- `/api/modules/ai-impact/test-plans` — clear test plans (admin)
- `/api/modules/ai-impact/component-onboarding` — clear component onboarding data (admin)
- `/api/modules/team-tracker/structure/teams/:teamId` — delete team (admin/team-admin)
- `/api/modules/team-tracker/structure/teams/:teamId/members/:uid` — unassign person (manager/admin)
- `/api/modules/team-tracker/structure/field-definitions/person/:fieldId` — soft-delete field (admin/team-admin)
- `/api/modules/team-tracker/structure/field-definitions/team/:fieldId` — soft-delete field (admin/team-admin)
- `/api/modules/team-tracker/field-options/:name/values` — remove option values (admin)
- `/api/modules/team-tracker/field-exceptions/:id` — remove field exception (team-admin/admin)
- `/api/health-metrics/tracking/opt-out` — opt back in (authenticated)
- `/api/health-metrics/events` — purge raw events (admin)
- `/api/health-metrics/viewers/:email` — remove viewer (admin)

## Journal Plugin

This project uses journal-plugin for session logging. Run `/log` to capture insights.
