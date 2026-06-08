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

| Component | Core Image | AI Eng Image |
|-----------|-----------|--------------|
| Backend | `quay.io/org-pulse/org-pulse-core-backend` | `quay.io/org-pulse/team-tracker-backend` (extends core) |
| Frontend | `quay.io/org-pulse/org-pulse-core-frontend` | `quay.io/org-pulse/team-tracker-frontend` (extends core) |
| Frontend Builder | `quay.io/org-pulse/org-pulse-core-frontend-builder` | — (used as build stage) |
| Frontend Runtime | `quay.io/org-pulse/org-pulse-core-frontend-runtime` | — (used as runtime stage) |
| OAuth Proxy | `quay.io/openshift/origin-oauth-proxy:4.16` (sidecar) | same |

Kustomize layers: `base/` (core platform + team-tracker) → `overlays/ai-eng/` (AI Eng modules + secrets) → `overlays/ai-eng-{dev,preprod,prod}/` (environment-specific). The `overlays/local/` overlay uses core images for Kind testing.

### CI/CD
- **`ci.yml`** — PRs + main: lint, test, build, kustomize validate. Required check: "Test & Build".
- **`build-images.yml`** — main pushes: builds core images first (backend, frontend, frontend-builder, frontend-runtime), then AI Eng images FROM core, runs smoke tests, pushes to Quay (`:<sha>` + `:latest`), creates PR to update prod image tags, auto-merges.
- ConfigMap changes auto-trigger rollouts via kustomize `configMapGenerator` — ConfigMap names include a content hash suffix (e.g., `team-tracker-config-5h2f9k`), so any data change produces a new name and triggers a pod rollout automatically.

**Branch protection** uses a GitHub repository ruleset on `main`:
- Requires PRs (no direct pushes)
- Requires "Test & Build" status check
- Admin role has bypass (used by `GH_PAT` secret for CI auto-merge PRs)

**Repo secrets:**
- `QUAY_USERNAME` / `QUAY_PASSWORD` — Quay.io registry credentials for image push
- `GH_PAT` — Personal access token with admin bypass, used by CI to create and auto-merge image tag update PRs
- `GCP_SA_KEY` — GCP service account JSON key for Vertex AI auth (Claude code review)

**CronJob** (`deploy/openshift/base/cronjob-sync-refresh.yaml`): Fires every 15 minutes (`*/15 * * * *`), triggers cadence-aware `POST /api/admin/refresh-all`. Each handler declares its own cadence (e.g., `24h` for roster sync, `12h` for execution pipeline). Handlers that have run within their cadence window are skipped — most ticks complete in seconds. Backup runs as a refresh handler (`platform:backup`, cadence `24h`), not as a separate CronJob step. Uses `CRON_ADMIN_EMAIL` from ConfigMap.

### Testing

**Unit tests** use Vitest with jsdom and @vue/test-utils. Run via `npm test`.

**Smoke tests** use Playwright to verify the production container images. Located in `tests/smoke/app-loads.spec.js`. These run automatically in CI after images are built and can also be run locally:

```bash
make build-core-frontend-image  # Build core frontend image (team-tracker only)
make build-core-backend-image   # Build core backend image (team-tracker only)
make smoke-test-core            # Run smoke tests against core images

make build-frontend-image       # Build AI Eng frontend image (all modules)
make build-backend-image        # Build AI Eng backend image (all modules)
make smoke-test                 # Run smoke tests against AI Eng images
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
1. Builds core images (backend, frontend, frontend-builder, frontend-runtime) with smoke test
2. Builds AI Eng images FROM core (backend extends core-backend, frontend uses core-builder + core-runtime)
3. Runs Playwright smoke tests against AI Eng images
4. Pushes all images to Quay, creates PR to update prod image tags

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
- **Base** sets `ADMIN_EMAILS=` (empty) and `CRON_ADMIN_EMAIL=`.
- **AI Eng overlay** sets `ADMIN_EMAILS` and `CRON_ADMIN_EMAIL` to real values, adds AI Eng secrets to the backend deployment via strategic merge patch.
- **AI Eng Dev overlay** clears `ADMIN_EMAILS` via `configMapGenerator` merge behavior. When empty, the first authenticated user is auto-added to the role store.
- **AI Eng Prod overlay** keeps `ADMIN_EMAILS` from the AI Eng overlay to pre-seed the role store with known admins.

### Auth Flow (production)
OAuth proxy (sidecar on frontend pod) authenticates users and sets `X-Forwarded-Email` / `X-Forwarded-User` headers. Backend reads `X-Forwarded-Email` and checks against `data/roles.json` via role-store. Empty role store → first user auto-added.

## API Routes

All routes prefixed with `/api`. Authenticated via OAuth proxy in production.
Routes are documented via `@openapi` JSDoc annotations on each handler (enforced by CI).
To discover routes, grep for `@openapi` in the source or check each module's `server/` directory.

## Journal Plugin

This project uses journal-plugin for session logging. Run `/log` to capture insights.
