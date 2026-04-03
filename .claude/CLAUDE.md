# AI Platform Team Tracker

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
| `ADMIN_EMAILS` | Comma-separated admin emails (seeds the allowlist) |

### Optional Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | Classic PAT with `read:user` scope (for contribution stats). Fine-grained tokens don't work with GraphQL API. |
| `GITLAB_TOKEN` | GitLab PAT with `read_api` scope (for contribution stats). Without it, only public project contributions are counted. |
| `GITLAB_BASE_URL` | GitLab instance URL (default: `https://gitlab.com`) |
| `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` | Path to Google SA JSON key (default: `/etc/secrets/google-sa-key.json`). For local dev: `./secrets/google-sa-key.json` |
| `PRODUCT_PAGES_CLIENT_ID` | OAuth client ID for Product Pages (production). Mutually exclusive with `PRODUCT_PAGES_TOKEN`. |
| `PRODUCT_PAGES_CLIENT_SECRET` | OAuth client secret for Product Pages (production). Used with `PRODUCT_PAGES_CLIENT_ID`. |
| `PRODUCT_PAGES_TOKEN` | Personal bearer token for Product Pages (local dev fallback). Used when OAuth env vars are not set. |
| `DEMO_MODE` / `VITE_DEMO_MODE` | Set both to `true` to run with fixture data (no credentials needed) |

### Commands

- `npm run dev:full` — start both Vite and Express servers
- `npm run dev` — Vite only (frontend)
- `npm run dev:server` — Express only (backend, requires .env)
- `npm test` — run all tests
- `npm run test:watch` — run tests in watch mode

## Architecture

- **Frontend**: Vue 3 SPA with Composition API (`<script setup>`), Vite 6, Tailwind CSS 3
- **Backend**: Express API server (port 3001), single `server/dev-server.js` for both local dev and production
- **Modules**: Built-in modules live in `modules/<slug>/` with auto-discovery (see Module System below)
- **Charts**: Chart.js 4 + vue-chartjs 5
- **Auth**: OpenShift OAuth proxy in production; no auth in local dev (uses `ADMIN_EMAILS` env var)
- **Storage**: Local filesystem (`./data/`), mounted as PVC in OpenShift
- **Hosting**: OpenShift (frontend nginx + backend Express), deployed via ArgoCD

## Key Concepts

### Data Flow
- **Roster**: `data/org-roster-full.json` defines all orgs, teams, and members. Built automatically by roster sync (LDAP + Google Sheets). The `deriveRoster()` function transforms this into the API response format.
- **Person metrics**: Individual Jira stats stored as `data/people/{name}.json`. Fetched via JQL queries against Jira with 365-day lookback.
- **GitHub contributions**: `data/github-contributions.json` stores contribution counts per user. `data/github-history.json` stores monthly history. Fetched via GitHub GraphQL API with `GITHUB_TOKEN`.
- **GitLab contributions**: `data/gitlab-contributions.json` and `data/gitlab-history.json`. Fetched via GitLab REST API (`/api/v4/users/:id/events`) with `GITLAB_TOKEN`.
- **Snapshots**: Monthly metric snapshots stored in `data/snapshots/{sanitized-teamKey}/{YYYY-MM-DD}.json` (teamKey sanitized: `::` → `--`, special chars → `_`). Generated from person metrics + GitHub/GitLab history. Admin can delete all via Settings > Snapshots.
- **Trends**: Built dynamically from person metric files by bucketing resolved issues by month, with org/team breakdowns.
- **Composite keys**: Teams are identified by `orgKey::teamName` (e.g., `shgriffi::Model Serving`).
- **Data file formats**: See `docs/DATA-FORMATS.md` for the JSON schema of every data file. Demo fixtures in `fixtures/` must always match production format.

### Roster Sync (`shared/server/roster-sync/`)
Automated roster building that replaces manual scripts:
- **LDAP** (`ldap.js`): Traverses Red Hat corporate directory from configured org root UIDs. Requires VPN.
  - `ldapjs` v3: `createClient()` is synchronous. Search entries use `entry.attributes` array with `.type` and `.values`.
  - Extracts GitHub and GitLab usernames from `rhatSocialUrl` LDAP field.
- **Google Sheets** (`sheets.js`): Enriches LDAP data with team assignments, focus areas, etc. Sheet names are auto-discovered from the spreadsheet ID.
  - Auth via `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` env var pointing to a service account JSON key.
- **Username Inference** (`username-inference.js`): Optionally infers missing GitHub/GitLab usernames by fuzzy-matching roster people against GitHub org members or GitLab group members. Configured via Settings UI (`githubOrgs`, `gitlabGroups`).
- **Config** (`config.js`): Org roots, Google Sheet ID, and username inference settings stored in `data/roster-sync-config.json`, managed via Settings UI.
- **Scheduler** (`index.js`): Runs sync daily (24h interval). Can be triggered manually via API or Settings UI.

### Jira Integration (Jira Cloud — redhat.atlassian.net)
- Auth: Basic auth with `JIRA_EMAIL` + `JIRA_TOKEN` (API token), base64-encoded
- Uses the Sprint Report API (`/rest/greenhopper/1.0/rapid/charts/sprintreport`) for sprint data (committed vs delivered)
- Uses `/rest/api/3/search/jql` (GET with cursor-based `nextPageToken` pagination) for person-level metrics
- Auto-resolves roster display names to Jira Cloud accountIds via `/rest/api/2/user/search?query=`, cached in `data/jira-name-map.json` (format: `{ "Name": { accountId, displayName } }`)
- JQL uses `assignee = "accountId"` (not display names)
- Story points field: `customfield_10028`
- Searches across all Jira projects (no project filter)

### GitHub Integration (`modules/team-tracker/server/github/contributions.js`)
- Uses GitHub GraphQL API directly via `node-fetch` (no `gh` CLI dependency)
- Auth via `GITHUB_TOKEN` env var (classic PAT with `read:user` scope)
- Batches users (10 per batch for counts, 5 for history) with 2-second delays between batches to avoid rate limiting
- Functions are async: `fetchContributions(usernames)` and `fetchContributionHistory(usernames)`

### GitLab Integration (`modules/team-tracker/server/gitlab/contributions.js`)
- Uses GitLab REST API (`/api/v4/users/:id/events`) via `node-fetch`
- Auth via `GITLAB_TOKEN` env var (PAT with `read_api` scope). Falls back to unauthenticated (public repos only).
- `GITLAB_BASE_URL` defaults to `https://gitlab.com`
- Sequential requests with delays (200ms authenticated, 7s unauthenticated)

### Module System
- **Built-in modules** live in `modules/<slug>/` with `module.json` manifests, `client/`, `server/`, and `__tests__/` directories
- **Auto-discovery**: Frontend uses `import.meta.glob('/modules/*/module.json')`, backend scans filesystem via `server/module-loader.js`
- **Shared code**: `shared/client/` (composables, services, components) and `shared/server/` (storage, auth) — importable via `@shared` alias
- **Vite aliases**: `@shared` → `shared/`, `@modules` → `modules/`
- **Navigation**: Modules use `inject('moduleNav')` for `navigateTo(viewId, params)`, `goBack()`, and reactive `params`
- **Hash routing**: `#/<module-slug>/<view-id>?key=value`
- **Backend routes**: Module server routes are mounted at `/api/modules/<slug>/`
- **Legacy forwards**: Team Tracker routes are aliased from `/api/roster` etc. to `/api/modules/team-tracker/...` for backward compatibility
- **Module guide**: See `docs/MODULES.md` for creating new modules; use `/create-module` command to bootstrap
- **Validation**: `npm run validate:modules` checks all manifests; runs in CI before tests
- **Stability contract**: `shared/API.md` documents shared exports; modules cannot import from other modules

### Caching
- Frontend uses localStorage stale-while-revalidate pattern (prefix `tt_cache:`)
- API functions accept an `onData` callback: called immediately with cached data, then again with fresh data

## Local Kind Cluster

For testing the containerized deployment locally, see `deploy/KIND.md`. The `deploy/openshift/overlays/local/` overlay strips OpenShift-specific resources (OAuth proxy, Route, ServiceAccount) and uses locally-built images with `imagePullPolicy: Never`. Cluster name is `team-tracker` (not the default `kind`). If using Podman: `export KIND_EXPERIMENTAL_PROVIDER=podman`.

## Deployment

Deployed to OpenShift via ArgoCD. Full deployment guide: `deploy/OPENSHIFT.md`.

| Component | Image | Details |
|-----------|-------|---------|
| Frontend | `quay.io/org-pulse/team-tracker-frontend` | nginx serving Vue SPA, proxies /api to backend |
| Backend | `quay.io/org-pulse/team-tracker-backend` | Express server with PVC-mounted data directory |
| OAuth Proxy | `quay.io/openshift/origin-oauth-proxy:4.16` | Sidecar on frontend pod |

Overlays: `deploy/openshift/overlays/dev/` (namespace: `team-tracker`), `deploy/openshift/overlays/preprod/` (namespace: `ambient-code--team-tracker`), and `deploy/openshift/overlays/prod/`.

Secrets (created manually on cluster, not in git):
- `team-tracker-secrets`: `JIRA_EMAIL`, `JIRA_TOKEN`, `GITHUB_TOKEN` (optional), `GITLAB_TOKEN` (optional)
- `frontend-proxy-cookie`: `session_secret`
- `google-sa-key`: Google service account JSON key (mounted at `/etc/secrets/`)

### CI/CD & Image Strategy

**GitHub Actions workflows** (`.github/workflows/`):
- **`ci.yml`** — Runs on all PRs and pushes to `main`. Lints, tests, builds, and validates kustomize overlays (kustomize validation only runs when `deploy/` files change). The job name "Test & Build" is the single required status check.
- **`build-images.yml`** — Triggers on pushes to `main` when backend or frontend source files change. Detects which components changed, builds/smoke-tests/pushes only the affected images to Quay.io with `:<sha>` and `:latest` tags, then creates a single PR to update prod overlay image tags.

**Automatic prod deployment flow:**
1. PR merged to `main` → build workflow detects changed components, runs tests, builds affected images, pushes `quay.io/org-pulse/team-tracker-*:<sha>` + `:latest`
2. A single `update-prod-image` job creates one follow-up PR updating all affected image tags via `kustomize edit set image`, then auto-merges it (`gh pr merge --auto --squash`)
3. ArgoCD (auto-sync) picks up the manifest change and rolls out the new image(s)

**Image tagging:**
- Prod overlay pins images to git SHA tags (e.g., `quay.io/org-pulse/team-tracker-backend:abc1234...`), updated automatically by CI
- Dev and preprod overlays use `:latest`

**ConfigMap changes trigger rollouts** via kustomize `configMapGenerator` — ConfigMap names include a content hash suffix (e.g., `team-tracker-config-5h2f9k`), so any data change produces a new name and triggers a pod rollout automatically.

**Branch protection** uses a GitHub repository ruleset on `main`:
- Requires PRs (no direct pushes)
- Requires "Test & Build" status check
- Admin role has bypass (used by `GH_PAT` secret for CI auto-merge PRs)

**Repo secrets:**
- `QUAY_USERNAME` / `QUAY_PASSWORD` — Quay.io registry credentials for image push
- `GH_PAT` — Personal access token with admin bypass, used by CI to create and auto-merge image tag update PRs
- `GCP_SA_KEY` — GCP service account JSON key for Vertex AI auth (Claude code review)

**Daily CronJob** (`deploy/openshift/overlays/prod/cronjob-sync-refresh.yaml`): Runs at 6:00 AM UTC, triggers roster sync then full metrics refresh via the backend API.

### Building images on ARM Macs
Standard `--platform linux/amd64` builds fail: npm times out under QEMU, esbuild crashes. Workaround: build/install natively, then copy into amd64 base images. See `deploy/OPENSHIFT.md` step 3 for details. This works because the backend has no native Node addons (all pure JS).

### Dev vs prod
- **Dev overlay** clears `ADMIN_EMAILS` via `configMapGenerator` merge behavior. When empty, the first authenticated user is auto-added to the allowlist.
- **Prod overlay** keeps `ADMIN_EMAILS` to pre-seed the allowlist with known admins.

### Auth flow (production)
OpenShift OAuth proxy (sidecar on frontend pod) authenticates users and sets `X-Forwarded-Email` / `X-Forwarded-User` headers. The backend reads `X-Forwarded-Email` and checks it against `data/allowlist.json`. If the allowlist is empty, the first request auto-adds the user.

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
  API.md            # Stability contract for shared exports

modules/
  team-tracker/     # Main module: delivery metrics, sprint tracking
    module.json     # Module manifest
    client/         # Views, components, composables, utils
    server/         # Jira, GitHub, GitLab integrations
    __tests__/      # Module tests (client/ and server/)

server/
  dev-server.js     # Express server (local dev + production)
  module-loader.js  # Backend module auto-discovery

scripts/
  validate-modules.js  # CI manifest validation

deploy/
  backend.Dockerfile    # Backend container image
  frontend.Dockerfile   # Frontend container image (multi-stage Vite build -> nginx)
  nginx.conf            # nginx config for SPA + API proxy
  openshift/
    base/               # Kustomize base manifests
    overlays/dev/       # Dev cluster overlay (namespace: team-tracker)
    overlays/preprod/   # Preprod cluster overlay (namespace: ambient-code--team-tracker)
    overlays/prod/      # Prod cluster overlay

docs/
  MODULES.md            # Module development guide
  module-template/      # Starter template for new modules

data/               # Local dev data (gitignored)
secrets/            # Service account keys (gitignored)
```

## Code Style

- Use `<script setup>` for new Vue components
- CommonJS (`require`) for server-side code
- ES modules (`import`) for frontend code
- No TypeScript — plain JavaScript throughout
- Prefer composables (`src/composables/`) for shared state logic
- Tailwind utility classes for styling; custom `primary` color palette defined in tailwind.config.mjs
- **Always run `npm run lint` before committing** — CI will reject lint failures. A pre-commit hook (`lint-staged` + `husky`) auto-runs ESLint on staged files, but verify manually if unsure.

## Testing

- Vitest + @vue/test-utils for frontend tests in `src/__tests__/` and `modules/*/__tests__/client/`
- Vitest for backend unit tests in `modules/*/__tests__/server/`
- Module manifest validation: `npm run validate:modules`
- Run `npm test` before committing

## Documentation Maintenance

Keep docs in sync with code changes. When making changes, update the relevant docs in the same PR:

- **Data format changes** (how JSON is read/written in `data/`): Update `docs/DATA-FORMATS.md` AND the corresponding `fixtures/` files to match
- **New or changed API routes**: Update the API Routes section in this file
- **New data files or storage paths**: Update the Data Flow section in this file and add schema to `docs/DATA-FORMATS.md`
- **New shared exports**: Update `shared/API.md`
- **Module system changes**: Update `docs/MODULES.md`

## API Routes

In production, all routes are authenticated via OpenShift OAuth proxy. The proxy sets `X-Forwarded-Email` and `X-Forwarded-User` headers. All routes are prefixed with `/api`.

**GET:**
- `/api/healthz` — health check (no auth)
- `/api/whoami` — current user info (supports both proxy and token auth)
- `/api/tokens` — list current user's API tokens
- `/api/admin/tokens` — list all API tokens (admin)
- `/api/roster` — org/team structure with members
- `/api/team/:teamKey/metrics` — team member metrics (teamKey = `orgKey::teamName`)
- `/api/person/:name/metrics` — individual person metrics
- `/api/people/metrics` — bulk all-people metrics
- `/api/github/contributions` — GitHub contribution data
- `/api/gitlab/contributions` — GitLab contribution data
- `/api/trends` — monthly Jira + GitHub + GitLab trend data
- `/api/allowlist` — authorized email list
- `/api/admin/roster-sync/config` — roster sync configuration
- `/api/admin/roster-sync/status` — sync status (running/last result)
- `/api/modules/release-analysis/product-pages/products` — Product Pages product list for autocomplete (admin, includes authStatus)

**POST:**
- `/api/tokens` — create a new API token (returns raw token once)

- `/api/roster/refresh` — refresh all person metrics from Jira
- `/api/team/:teamKey/refresh` — refresh metrics for one team
- `/api/person/:name/metrics?refresh=true` — refresh single person
- `/api/github/refresh` — refresh all GitHub contributions
- `/api/github/contributions/:username/refresh` — refresh single user
- `/api/gitlab/refresh` — refresh all GitLab contributions
- `/api/gitlab/contributions/:username/refresh` — refresh single user
- `/api/trends/jira/refresh` — refresh Jira trends
- `/api/trends/github/refresh` — refresh GitHub history
- `/api/trends/gitlab/refresh` — refresh GitLab history
- `/api/admin/roster-sync/config` — save roster sync configuration
- `/api/admin/roster-sync/trigger` — trigger manual roster sync
- `/api/allowlist` — update authorized email list
- `/api/modules/team-tracker/snapshots/generate` — generate snapshots for all teams (admin)

**DELETE:**
- `/api/tokens/:id` — revoke own API token
- `/api/admin/tokens/:id` — revoke any API token (admin)
- `/api/modules/team-tracker/snapshots` — delete all stored snapshots (admin)

**GET (snapshots):**
- `/api/modules/team-tracker/snapshots/:teamKey` — all snapshots for a team
- `/api/modules/team-tracker/snapshots/:teamKey/:personName` — person snapshots within a team
