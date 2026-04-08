# Feature Traffic: Direct GitLab CI Artifact Fetch

## Status: DRAFT

## Problem

The feature-traffic module currently depends on the git-static module pattern to get its data — expecting a git repo cloned into `data/modules/feature-traffic-data/`. No standalone data repo exists. The actual data is produced by a GitLab CI pipeline at `redhat/rhel-ai/agentic-ci/feature-traffic` on gitlab.com, which generates build artifacts (`output/index.json` and `output/features/*.json`) from a job called `fetch-traffic`.

PR #214 attempted to solve this by committing GitLab CI artifacts as fixture files via GitHub Actions, but this commits real internal Jira data (names, account IDs, issue details) to the source repo. PR #214 should be closed.

## Solution

Replace the git-static dependency with a backend service that directly fetches artifacts from the GitLab CI pipeline via the GitLab Jobs API, stores them in `data/`, and serves them through the existing API routes.

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│  GitLab CI Pipeline                                  │
│  redhat/rhel-ai/agentic-ci/feature-traffic           │
│  Job: fetch-traffic → artifacts: output/*.json       │
└───────────────────────┬──────────────────────────────┘
                        │ GitLab Jobs API
                        │ GET /projects/:id/jobs/artifacts/:branch/download
                        ▼
┌──────────────────────────────────────────────────────┐
│  feature-traffic module server                       │
│  modules/feature-traffic/server/                     │
│                                                      │
│  gitlab-fetch.js ─── fetches & extracts artifacts    │
│  scheduler.js   ─── twice-daily + manual trigger     │
│  index.js       ─── API routes (unchanged contract)  │
│                                                      │
│  Reads config from: data/feature-traffic/config.json │
│  Writes data to:    data/feature-traffic/            │
└───────────────────────┬──────────────────────────────┘
                        │ storage.readFromStorage()
                        ▼
┌──────────────────────────────────────────────────────┐
│  data/feature-traffic/                               │
│    index.json                                        │
│    features/RHAISTRAT-1.json                         │
│    features/RHAISTRAT-2.json                         │
│    ...                                               │
│    last-fetch.json  (timestamp + status metadata)    │
└──────────────────────────────────────────────────────┘
```

## Data Flow

1. **Scheduler** triggers fetch on a configurable interval (default: every 12 hours, relative to process start — not at specific clock times) or manual via API/Settings UI. The daily cronjob at 06:00 UTC provides a consistent anchor point regardless of when the process started.
2. **gitlab-fetch.js** calls the GitLab Jobs API to download the latest successful artifact archive from the configured branch
3. The zip is extracted in-memory using `adm-zip`. Each entry is JSON-parsed; non-JSON entries and parse failures are skipped with warnings.
4. All parsed files are staged in-memory first. If critical files (at minimum `index.json`) are present, feature files are written to `data/feature-traffic/` first, then `index.json` last (atomic write ordering).
5. A `data/feature-traffic/last-fetch.json` metadata file is written with timestamp, status, and pipeline info
6. **Existing API routes** in `index.js` are updated to read from `data/feature-traffic/` instead of `data/modules/feature-traffic-data/latest/`
7. **Frontend** is unchanged — same API contract, same composables, same views

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `modules/feature-traffic/server/gitlab-fetch.js` | **Create** | GitLab Jobs API client: downloads artifact zip, extracts, writes to storage |
| `modules/feature-traffic/server/scheduler.js` | **Create** | Twice-daily scheduler + manual trigger, sync lock, status tracking |
| `modules/feature-traffic/server/index.js` | **Modify** | Update `DATA_PREFIX` to `feature-traffic`, add config/status/refresh routes, initialize scheduler |
| `modules/feature-traffic/server/export.js` | **Create** | Export hook for "download test data" anonymization |
| `modules/feature-traffic/client/components/FeatureTrafficSettings.vue` | **Create** | Settings UI for GitLab project, job name, branch, artifact path, refresh interval |
| `modules/feature-traffic/module.json` | **Modify** | Add `client.settingsComponent` and `export` block (see module.json changes below) |
| `deploy/openshift/base/backend-deployment.yaml` | **Modify** | Add `FEATURE_TRAFFIC_GITLAB_TOKEN` env var (optional secretKeyRef from `team-tracker-secrets`) |
| `deploy/openshift/overlays/prod/cronjob-sync-refresh.yaml` | **Modify** | Add feature-traffic refresh step to daily cronjob |
| `deploy/OPENSHIFT.md` | **Modify** | Document new `FEATURE_TRAFFIC_GITLAB_TOKEN` secret key |
| `.env.example` | **Modify** | Add `FEATURE_TRAFFIC_GITLAB_TOKEN` with comment |

## API Contract

### Existing Routes (unchanged response shape)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/modules/feature-traffic/features` | List features with filters (status, version, health, sort) |
| GET | `/api/modules/feature-traffic/features/:key` | Full feature detail |
| GET | `/api/modules/feature-traffic/versions` | Unique fix versions |
| GET | `/api/modules/feature-traffic/status` | Data freshness and sync info |

### New Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/modules/feature-traffic/refresh` | Admin | Trigger manual data refresh from GitLab CI |
| GET | `/api/modules/feature-traffic/config` | Admin | Get current fetch configuration |
| POST | `/api/modules/feature-traffic/config` | Admin | Save fetch configuration (triggers immediate fetch if newly enabled) |

All admin routes use `context.requireAdmin` middleware (provided via module context from `dev-server.js`):
```javascript
router.post('/refresh', context.requireAdmin, async (req, res) => { ... });
router.get('/config', context.requireAdmin, (req, res) => { ... });
router.post('/config', context.requireAdmin, async (req, res) => { ... });
```

### Status Route Enhancement

The existing `/status` route response will be enhanced:

```json
{
  "dataAvailable": true,
  "fetchedAt": "2026-04-08T06:00:00Z",
  "schemaVersion": "1.0",
  "featureCount": 42,
  "dataSource": "gitlab-ci (redhat/rhel-ai/agentic-ci/feature-traffic)",
  "lastFetch": {
    "status": "success",
    "timestamp": "2026-04-08T06:00:12Z",
    "pipelineId": 12345,
    "duration": 3400
  },
  "nextScheduledFetch": "2026-04-08T18:00:00Z",
  "configured": true
}
```

## Configuration

### Environment Variable

| Variable | Description |
|----------|-------------|
| `FEATURE_TRAFFIC_GITLAB_TOKEN` | GitLab PAT with `read_api` scope for the feature-traffic pipeline project. Added to the `team-tracker-secrets` Kubernetes secret. |

**Token resolution order**: `process.env.FEATURE_TRAFFIC_GITLAB_TOKEN || process.env.GITLAB_TOKEN`. In most environments, `GITLAB_TOKEN` (already configured for GitLab contribution stats) will work since both need `read_api` scope on the same gitlab.com instance. The dedicated `FEATURE_TRAFFIC_GITLAB_TOKEN` env var exists as an override for cases where the pipeline project requires a different account or token (e.g., the project is in a group the contributions token doesn't have access to). In practice, most deployments will only need `GITLAB_TOKEN` and won't set `FEATURE_TRAFFIC_GITLAB_TOKEN` at all. The Settings UI status will show which token source is active (`"tokenSource": "FEATURE_TRAFFIC_GITLAB_TOKEN"` or `"tokenSource": "GITLAB_TOKEN"` or `null`).

### Settings UI Config (stored in `data/feature-traffic/config.json`)

Follows the `data/{module-slug}/config.json` convention used by other modules (`ai-impact/config.json`, `org-roster/config.json`, etc.).

```javascript
// Default config (used when config.json doesn't exist yet)
const DEFAULT_CONFIG = {
  gitlabBaseUrl: 'https://gitlab.com',
  projectPath: 'redhat/rhel-ai/agentic-ci/feature-traffic',
  jobName: 'fetch-traffic',
  branch: 'main',
  artifactPath: 'output',
  refreshIntervalHours: 12,
  enabled: false  // disabled by default until admin configures
};
```

**Startup behavior**: On server start, config is loaded via `{ ...DEFAULT_CONFIG, ...storage.readFromStorage('feature-traffic/config.json') }` (merge-with-defaults pattern from `ai-impact/config.js`). If no config file exists, defaults are used. The scheduler only starts if `enabled: true` AND a token is available. This means a fresh deployment does nothing until an admin visits Settings, reviews the defaults, and enables the module — which triggers the immediate first fetch.

### Settings UI Component

The `FeatureTrafficSettings.vue` component will include:
- **Connection status**: Shows whether the token is configured (env var present) and tests connectivity
- **GitLab project**: Project path, base URL, branch, job name
- **Artifact config**: Path prefix within the artifact zip
- **Refresh schedule**: Interval in hours (default 12)
- **Manual sync**: Button to trigger immediate refresh with status indicator
- **Last sync info**: Timestamp, status, duration, errors

Follows the pattern established by `OrgRosterSettings.vue`.

## Scheduler Design

Follows the pattern from `shared/server/roster-sync/index.js`:

```javascript
// modules/feature-traffic/server/scheduler.js

let fetchInProgress = false;
let schedulerTimer = null;

function startScheduler(storage, intervalHours = 12) {
  if (schedulerTimer) clearInterval(schedulerTimer);

  const intervalMs = intervalHours * 60 * 60 * 1000;
  schedulerTimer = setInterval(() => {
    runFetch(storage).catch(err => {
      console.error('[feature-traffic] Scheduled fetch error:', err.message);
    });
  }, intervalMs);

  if (schedulerTimer.unref) schedulerTimer.unref();
}

async function runFetch(storage) {
  if (fetchInProgress) return { status: 'skipped', message: 'Fetch already in progress' };
  fetchInProgress = true;
  try {
    // ... fetch logic
  } finally {
    fetchInProgress = false;
  }
}
```

Key behaviors:
- **12-hour interval** (default), configurable via Settings. Runs relative to process start time, not at specific clock times. The daily cronjob provides the consistent anchor.
- **Immediate fetch on first config save**: When config is saved for the first time (or re-enabled after being disabled), trigger an immediate fetch rather than waiting for the first interval tick. This avoids the "configured it, but no data for 12 hours" problem.
- **Manual trigger** via POST `/api/modules/feature-traffic/refresh`
- **Mutex lock** prevents concurrent fetches
- **Cooldown on manual refresh**: After a successful fetch, subsequent manual refresh requests within 5 minutes return `{ status: 'cooldown', retryAfter: <seconds> }` (HTTP 429). This prevents rapid sequential requests from hammering the GitLab API. The mutex alone prevents concurrent fetches but not rapid sequential ones.
- **Scheduler restarts** when config changes (interval updated via Settings)
- **Timer.unref()** so the scheduler doesn't prevent Node process exit

## GitLab Artifact Fetch (`gitlab-fetch.js`)

### API Call

```
GET https://gitlab.com/api/v4/projects/{encoded_project_path}/jobs/artifacts/{branch}/download?job={jobName}
Authorization: Bearer {FEATURE_TRAFFIC_GITLAB_TOKEN}
```

This endpoint returns a zip archive of the job's artifacts.

### Implementation Notes

- Use `node-fetch` (already a project dependency) for the HTTP request
- Use `adm-zip` (new dependency) to extract the archive in-memory. Node's built-in `node:zlib` only supports gzip/deflate/brotli compression — not the zip container format — so a library is required.
- **Zip-slip protection**: When extracting, validate that each entry's resolved path stays within the target directory before writing (same pattern as `server/export.js:42-45`'s path traversal check). Reject entries with `..` path components or absolute paths.
- Strip the configured artifact path prefix (e.g., `output/`) when writing to storage
- **JSON parsing**: Each extracted file must be parsed with `JSON.parse()` before passing to `storage.writeToStorage(key, data)`, which expects a JS object (it calls `JSON.stringify` internally). Files that fail JSON parsing are logged as warnings and skipped — a single malformed file does not abort the entire extraction. Only `.json` files are processed; non-JSON entries in the zip are ignored.
- Project path is URL-encoded at fetch time via `encodeURIComponent` (the `/` chars in `redhat/rhel-ai/agentic-ci/feature-traffic` must be encoded)
- **Atomic write strategy**: To prevent a crash mid-extraction from leaving `data/feature-traffic/` in a corrupted state (new `index.json` referencing old feature files), use a staging approach:
  1. Extract and parse all files in-memory first (into a `Map<path, object>`)
  2. If all critical files are present and valid (at minimum `index.json`), write feature files first, then write `index.json` last
  3. This ensures `index.json` never references features that haven't been written yet
  4. If extraction fails partway through in-memory parsing, no files are written to disk at all
- Handle HTTP errors gracefully: 401 (bad token), 404 (no artifacts/project), 429 (rate limited)
- Log fetch duration and file count for observability

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Token not configured | Skip fetch, log warning, status shows "not configured". API returns helpful message (see Local Dev section). |
| Network/API error | Log error, update last-fetch status to "error", keep existing data |
| Empty/malformed artifact | Log error, don't overwrite existing good data |
| Artifact expired (404) | Log warning with data age, update `last-fetch.json` status to `"artifact_expired"` with timestamp. Existing data is preserved. The `/status` endpoint surfaces the staleness: `{ staleWarning: true, dataAge: "3 days" }`. Settings UI shows a yellow warning banner when data is stale (>48 hours since last successful fetch). |
| Per-file JSON parse failure | Log warning for the specific file, skip it, continue extracting remaining files. Reported in fetch summary. |
| Concurrent fetch attempt | Return "skipped" immediately |

## Local Development

When running locally without a GitLab token:
- The `/features` endpoint returns `{ features: [], featureCount: 0, fetchedAt: null, message: "No data available. Configure GitLab CI integration in Settings to fetch feature traffic data." }` — the old git-static message is replaced.
- The `/status` endpoint returns `{ configured: false, dataAvailable: false, tokenSource: null }`.
- Developers can either:
  1. Set `FEATURE_TRAFFIC_GITLAB_TOKEN` (or `GITLAB_TOKEN`) in `.env` and configure the project in Settings
  2. Use `DEMO_MODE=true` with fixture data (see Demo Mode section)

**Chicken-and-egg note for fixtures**: Demo mode relies on fixtures produced by the "Download Test Data" export system. On initial deployment, an admin must first run a successful fetch with real data, then use "Download Test Data" to generate anonymized fixtures. Until then, demo mode shows the empty state. This is the same bootstrap pattern as other modules — the export hook can only anonymize data that exists.

## Demo Mode

The existing "Download Test Data" system handles demo mode. The module will:

1. **Add an export hook** (`modules/feature-traffic/server/export.js`) that:
   - Reads data from `data/feature-traffic/`
   - Anonymizes Jira issue keys and summaries using the mapping object
   - Anonymizes person names/account IDs in feature data
   - Writes anonymized files via `addFile()`

2. **Register in module.json**:
   ```json
   {
     "client": {
       "settingsComponent": "./client/components/FeatureTrafficSettings.vue"
     },
     "export": {
       "customHandler": true,
       "files": [
         { "path": "feature-traffic/index.json", "notes": "Feature index with summary metrics" },
         { "path": "feature-traffic/features/*.json", "notes": "Per-feature detail files" }
       ]
     }
   }
   ```
   Note: `settingsComponent` goes under the `client` key (not top-level), matching the existing pattern in `team-tracker/module.json`.

3. **Demo mode reads from fixtures**: The existing `demo-storage.js` pattern will serve the exported test data when `DEMO_MODE=true`. The server routes already use `storage.readFromStorage()`, which transparently falls back to fixtures in demo mode.

### Export Hook Anonymization

The feature data contains Jira-sourced fields that need anonymization:
- `features[].key` (e.g., `RHAISTRAT-123`) → anonymize via `mapping.anonymizeJiraKey()`
- `features[].summary` → anonymize via `mapping.anonymizeIssueSummary()`
- `features[].epics[].key` → anonymize Jira keys
- `features[].epics[].assignee` → anonymize via `mapping.getOrCreateNameMapping()`
- Any account IDs → anonymize via `mapping.getOrCreateAccountIdMapping()`

## Backward Compatibility

| Concern | Resolution |
|---------|------------|
| API routes | **No change** — same paths, same response shapes for `/features`, `/features/:key`, `/versions` |
| `/status` response | New fields added (`lastFetch`, `nextScheduledFetch`, `configured`, `staleWarning`). `dataSource` value changes from `'git-static module: feature-traffic-data'` to `'gitlab-ci (...)'`. **Verified safe**: no frontend code references `dataSource` (grep confirms zero matches in `modules/feature-traffic/client/`). Adding new fields is non-breaking. |
| Frontend | **No change** — same composables, same views. The frontend uses `fetchedAt`, `features`, `featureCount` from the `/features` endpoint and does not consume `/status` at all. |
| Data location | Changes from `data/modules/feature-traffic-data/latest/` to `data/feature-traffic/`. Uses the `data/{module-slug}/` convention established by newer modules (`data/org-roster/`, `data/ai-impact/`, `data/release-analysis/`, `data/allocation-tracker/`). The `data/modules/` prefix is exclusively for git-static clones and is being phased out. |
| Old data cleanup | On existing deployments, stale data at `data/modules/feature-traffic-data/` will remain on the PVC. This is harmless but wastes space. Document in deployment notes that admins can safely `rm -rf data/modules/feature-traffic-data/` after upgrading. |
| git-static registration | Module no longer needs git-static config. Any existing `modules-state.json` entry for `feature-traffic-data` becomes orphaned but harmless. |
| Module manifest | `requires: []` stays empty — no dependency on git-static |

## Deployment Changes

1. **New secret key**: Add `FEATURE_TRAFFIC_GITLAB_TOKEN` to the existing `team-tracker-secrets` secret on each cluster (secrets are created manually, not in git — see `deploy/OPENSHIFT.md`)
2. **Backend deployment**: Add env var as optional secretKeyRef so environments without the key don't crash:
   ```yaml
   - name: FEATURE_TRAFFIC_GITLAB_TOKEN
     valueFrom:
       secretKeyRef:
         name: team-tracker-secrets
         key: FEATURE_TRAFFIC_GITLAB_TOKEN
         optional: true
   ```
3. **CronJob**: Add a feature-traffic refresh step to `cronjob-sync-refresh.yaml`. The cronjob runs at 06:00 UTC and acts as a reliable fallback if the pod restarts (which resets the in-process scheduler timer):
   ```sh
   # Step: Trigger Feature Traffic refresh
   echo "=== Triggering Feature Traffic refresh ==="
   curl -sf -X POST "$BACKEND/api/modules/feature-traffic/refresh" \
     -H "$AUTH_HEADER" -H "$PROXY_SECRET_HEADER" || echo "Feature Traffic refresh skipped"
   ```
4. **`.env.example`**: Add `FEATURE_TRAFFIC_GITLAB_TOKEN` with a comment explaining it's optional and what scope is needed
5. **Old data cleanup**: Document in deployment notes that admins can safely `rm -rf data/modules/feature-traffic-data/` after upgrading. This is optional — stale data is harmless but wastes PVC space.
6. **No changes needed to**: kustomization.yaml overlays, Dockerfiles, CI workflows, configMapGenerators

## New Dependency

| Package | Purpose | Size | Type |
|---------|---------|------|------|
| `adm-zip` | Extract zip artifacts in-memory | ~60KB | **production** (not devDependency) |

Must be a production dependency since the backend Dockerfile runs `npm ci --omit=dev`. No CI workflow changes needed — `build-images.yml` change detection already covers `package*.json` and `modules/*/server/**`.

**Memory considerations**: The artifact zip contains one `index.json` and one JSON file per feature (~50-100 features). Estimated zip size is 1-5 MB, expanding to ~5-20 MB in-memory. The backend container's default memory limit (256-512 MB) has ample headroom. If artifacts grow unexpectedly large, the `adm-zip` in-memory approach can be revisited, but streaming zip extraction adds significant complexity for minimal benefit at this scale.

Alternative: If we want to avoid a new dependency, we could shell out to `unzip` via `child_process`, but `adm-zip` is cleaner and already commonly used in Node.js projects.

## Testing

| Test | Location | Description |
|------|----------|-------------|
| gitlab-fetch unit tests | `modules/feature-traffic/__tests__/server/gitlab-fetch.test.js` | Mock GitLab API responses, test zip extraction, error handling |
| scheduler unit tests | `modules/feature-traffic/__tests__/server/scheduler.test.js` | Test interval scheduling, mutex, config reload |
| route tests | `modules/feature-traffic/__tests__/server/routes.test.js` | Test new config/refresh routes, auth requirements |
| export hook tests | `modules/feature-traffic/__tests__/server/export.test.js` | Test anonymization of feature data |

## Implementation Phases

### Phase 1: Core Fetch Engine
1. Add `adm-zip` dependency
2. Create `gitlab-fetch.js` — GitLab Jobs API client, zip extraction, storage write
3. Create `scheduler.js` — interval timer, sync lock, status tracking
4. Update `server/index.js` — change `DATA_PREFIX`, add refresh/config/status routes, init scheduler
5. Add unit tests for fetch and scheduler

### Phase 2: Settings UI & Configuration
6. Create `FeatureTrafficSettings.vue` — config form, manual sync button, status display
7. Update `module.json` — add `settingsComponent`
8. Test settings integration end-to-end

### Phase 3: Demo Mode / Export
9. Create `server/export.js` — anonymization export hook
10. Update `module.json` — add `export.customHandler`
11. Add export hook tests

### Phase 4: Deployment & Cleanup
12. Update `deploy/openshift/base/backend-deployment.yaml` — add `FEATURE_TRAFFIC_GITLAB_TOKEN` env var (optional secretKeyRef)
13. Update `deploy/openshift/overlays/prod/cronjob-sync-refresh.yaml` — add feature-traffic refresh step
14. Update `deploy/OPENSHIFT.md` — document new secret key
15. Update `.env.example` — add `FEATURE_TRAFFIC_GITLAB_TOKEN`
16. Close PR #214 (the GitHub Actions workflow that commits artifacts was never merged, nothing to delete)

## Resolved Decisions

1. **Zip library**: `adm-zip` (well-established, ~60KB). Node's `node:zlib` only handles gzip/deflate/brotli — not the zip container format.
2. **Project ID vs path**: Store the human-readable project path in config, URL-encode at fetch time via `encodeURIComponent`.
3. **Token fallback**: `FEATURE_TRAFFIC_GITLAB_TOKEN || GITLAB_TOKEN` — allows reuse of existing token while supporting a dedicated one.
4. **Module validator**: Verified that `scripts/validate-modules.js` already handles `export.customHandler` (lines 100-106) and `export.files` (lines 107-109). It checks that `server/export.js` exists when `customHandler: true` and validates `files` is an array. No validator changes needed — but `server/export.js` must exist before `module.json` is updated (Phase 3 ordering accounts for this).

## Open Questions

1. **Key format assumption**: The `features/:key` route validates against `/^RHAISTRAT-\d+$/` (hardcoded in `server/index.js:70`). If the upstream pipeline ever changes the project key format, this regex would need updating. Acceptable for now since the data source is stable, but worth noting as a hardcoded assumption.

## Addressed Concerns Log

All concerns from review rounds have been addressed:

| # | Concern | Resolution |
|---|---------|------------|
| 1 | `writeToStorage()` expects JS objects, not raw buffers | Each extracted file is `JSON.parse()`'d before writing; parse failures per-file are logged and skipped |
| 2 | GitLab artifact expiration risk | Concrete strategy: status tracks `artifact_expired`, UI shows stale warning banner when data >48h old |
| 3 | No atomic write strategy | In-memory staging: parse all files first, write features before index.json, abort if critical files missing |
| 4 | Node 22 has no built-in zip support | Corrected — `node:zlib` is gzip/deflate only, `adm-zip` is required |
| 5 | Justify separate token env var | Token fallback: `FEATURE_TRAFFIC_GITLAB_TOKEN \|\| GITLAB_TOKEN`. Most deployments reuse existing token. |
| 6 | `setInterval` doesn't run at specific times | Description corrected to interval-based. Cronjob provides consistent anchor. |
| 7 | Data path convention | Uses `data/feature-traffic/` matching newer module convention (`org-roster/`, `ai-impact/`, etc.) |
| 8 | Config path and startup behavior | Uses `data/feature-traffic/config.json` with DEFAULT_CONFIG merge. Disabled by default until admin enables. |
| 9 | Status route shape changes | Verified: no frontend code references `dataSource`. Adding fields is non-breaking. |
| 10 | Old data cleanup | Documented: admins can safely delete `data/modules/feature-traffic-data/` |
| 11 | Memory usage of zip extraction | Estimated 5-20 MB in-memory, well within container limits |
| 12 | No rate limiting on manual refresh | 5-minute cooldown after successful fetch, returns HTTP 429 |
| 13 | Module validator compatibility | Verified: `validate-modules.js` already handles `export.customHandler` and `export.files` |
