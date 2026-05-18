# Contributing to People & Teams

## Prerequisites

- **Node.js 18+** and npm
- **Red Hat VPN** connection (for LDAP roster sync)
- A **Jira Cloud API token** for live data — [create one here](https://id.atlassian.com/manage-profile/security/api-tokens)
- Or just use **Demo Mode** (no credentials needed)

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/red-hat-data-services/rhai-org-pulse.git
cd team-tracker
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

**Option A — Demo Mode (no credentials needed):**
```env
DEMO_MODE=true
VITE_DEMO_MODE=true
```

**Option B — Live data:**
```env
JIRA_EMAIL=you@redhat.com
JIRA_TOKEN=your-jira-api-token
ADMIN_EMAILS=you@redhat.com

# Optional
GITHUB_TOKEN=your-github-classic-pat
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./secrets/google-sa-key.json
```

See [README.md](README.md) for details on obtaining each credential.

### 3. Run locally

```bash
npm run dev:full
```

This starts both the Vite frontend (port 5173) and the Express dev server (port 3001) concurrently. The Vite dev server proxies `/api` requests to the backend.

- **Frontend:** http://localhost:5173
- **API:** http://localhost:3001/api

### 4. Run tests

```bash
npm test            # single run
npm run test:watch  # watch mode
npm run lint        # linting
```

## Project Structure

```
src/
  components/         # Vue components (App.vue is root with hash routing)
  composables/        # Composition API hooks (useRoster, useAuth, useGithubStats, etc.)
  services/api.js     # API client with caching
  utils/metrics.js    # Metric calculations
  __tests__/          # Frontend tests (Vitest + jsdom)

server/
  dev-server.js       # Express server (local dev + production)
  storage.js          # Local file storage abstraction
  demo-storage.js     # Demo mode fixture storage
  jira/               # Jira Cloud API integration
    jira-client.js    # HTTP client (basic auth, Jira Cloud endpoints)
    person-metrics.js # Per-person JQL metrics
    sprint-report.js  # Sprint report API
    __tests__/        # Server-side tests
  github/
    contributions.js  # GitHub GraphQL API (contribution stats)
  roster-sync/        # Automated roster building
    index.js          # Orchestrator (sync + daily scheduler)
    ldap.js           # LDAP client (Red Hat corporate directory)
    sheets.js         # Google Sheets API (enrichment data)
    merge.js          # Combines LDAP + Sheets into roster format
    config.js         # Sync config CRUD (stored on PVC/filesystem)
    constants.js      # Shared constants

deploy/
  backend.Dockerfile    # Backend container image
  frontend.Dockerfile   # Frontend image (multi-stage Vite build -> nginx)
  nginx.conf            # nginx config for SPA + API proxy
  openshift/
    base/               # Kustomize base manifests
    overlays/dev/       # Dev cluster overlay
    overlays/prod/      # Prod cluster overlay

fixtures/             # Demo mode fixture data
data/                 # Local dev data (gitignored)
secrets/              # Service account keys (gitignored)
```

## Making Changes

### Branch naming

Use descriptive branch names:
- `feat/description` — new features
- `fix/description` — bug fixes
- `refactor/description` — code improvements

### Development workflow

1. Create a branch from `main`
2. Make your changes
3. Write or update tests for any changed logic
4. Run `npm test` and `npm run lint` to verify
5. Run `npm run build` to confirm the production build works
6. Open a PR against `main`

PRs receive an automated Claude code review that can fix minor issues directly.
The review criteria are defined in
[`.github/instructions/review.instructions.md`](.github/instructions/review.instructions.md).

### Code style & conventions

See [`AGENTS.md`](AGENTS.md) for the full list of code style conventions and
hard constraints. Key points:

- `<script setup>` for new Vue components
- CommonJS (`require`) for server-side code, ES modules for frontend
- No TypeScript — plain JavaScript throughout
- Tailwind CSS utility classes for styling
- No cross-module imports (use `@shared` or API calls)
- Extract reusable logic into composables (`shared/client/composables/`)

### Testing

#### Unit tests

Unit tests use **Vitest** with **jsdom** and **@vue/test-utils**:

```bash
npm test            # Run all tests
npm run test:watch  # Watch mode

# Run a specific test file
npx vitest run server/jira/__tests__/sprint-report.test.js
```

#### Smoke tests

Smoke tests use **Playwright** to verify the production container images work correctly. These run in CI and can also be run locally on any OS (RHEL, macOS, Ubuntu), but do NOT require secrets/credentials to run.

**Note:** First-time image pulls can take a while (~5-10 minutes)

```bash
make build-backend-image   # Builds an image with the backend sources (required for frontend tests)
make build-frontend-image  # Builds an image with the frontend sources
make smoke-test            # Run smoke tests against both containers (uses demo mode)
```

Smoke tests run Playwright in a container, so no local browser installation is needed. The backend runs in demo mode (using fixture data) so no credentials are required.

**macOS note:** The Playwright container bind-mounts your workspace and runs `npm ci`, which installs Linux-native packages into your local `node_modules/`. After running `make smoke-test`, you may need to run `npm ci` again to restore macOS-native packages before running local commands like `npm test` or `npm run dev`.

#### Integration tests

Integration tests are run using **Playwright**. They validate that:
1. Modules are visible _and_ clickable from the sidebar
1. Modules load in Org Pulse when clicked
1. Module content renders properly after being loaded

Use `make` to run a module's integration tests:

```bash
MODULE_NAME=ai-impact                   # Choose a testable module
make test-module MODULE=${MODULE_NAME}  # Runs the integration tests against an existing module
```

Available, testable modules:
- [ai-impact](./modules/ai-impact/)

Integration tests for [other modules](./modules/) are coming soon.

## Deployment

Deployed to OpenShift via ArgoCD. Kustomize manifests in `deploy/openshift/`.

See `.claude/CLAUDE.md` for full deployment details.

## Questions?

Open an issue or reach out to @accorvin.
