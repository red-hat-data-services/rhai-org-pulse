# Must-Gather Plan (Revised v3)

## Overview

A diagnostic data collection system that produces a single JSON bundle containing everything needed to debug a reported problem — connectivity, configuration, data health, and module-specific diagnostics. Designed so an AI tool (or a human) can diagnose issues from a GitHub issue attachment without access to the running instance.

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `server/error-buffer.js` | Ring buffer capturing recent errors/warnings from console |
| `server/request-tracker.js` | Lightweight middleware tracking recent API request patterns |
| `server/must-gather.js` | Core collector — assembles the diagnostic bundle |
| `server/build-info.js` | Exposes app version, git SHA, build date |
| `src/components/HelpView.vue` | UI for downloading the must-gather bundle |
| `docs/MUST-GATHER.md` | User-facing documentation |

### Modified Files

| File | Change |
|------|--------|
| `server/dev-server.js` | Mount error buffer, request tracker middleware, must-gather route; add `registerDiagnostics` to module context |
| `server/module-loader.js` | Add `collectModuleDiagnostics()` to invoke registered diagnostics hooks |
| `src/App.vue` | Add Help/Debug nav item |
| `src/components/AppSidebar.vue` | Add Help/Debug link |
| `modules/team-tracker/server/index.js` | Call `context.registerDiagnostics()` inside `registerRoutes` |
| `modules/org-roster/server/index.js` | Call `context.registerDiagnostics()` inside `registerRoutes` |
| `deploy/backend.Dockerfile` | Pass `GIT_SHA` and `BUILD_DATE` build args |
| `docs/MODULES.md` | Add "Diagnostics Hook" section |

---

## Gap 1: Module Diagnostics Hook

### Design

Extend the module server contract with an **optional** diagnostics hook that modules register from *inside* the `registerRoutes` closure. This allows the hook to access closure-scoped runtime state (e.g., `refreshState`, `jiraNameCache`) while remaining backwards-compatible — modules that don't call `registerDiagnostics` are simply skipped.

There are currently **two** built-in modules that will implement this hook:
1. **team-tracker** — Jira metrics, GitHub/GitLab contributions, roster sync, snapshots
2. **org-roster** — team metadata from Google Sheets, component mappings, RFE backlog

#### Module Server Contract (updated)

```javascript
// modules/<slug>/server/index.js

module.exports = function registerRoutes(router, context) {
  const { storage, requireAdmin } = context

  // Module-local runtime state (only accessible inside this closure)
  const refreshState = { running: false, scope: null, /* ... */ }

  // ... existing route definitions ...

  // NEW (optional): register a diagnostics hook from inside the closure
  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      // Has full access to closure-scoped state: refreshState, caches, etc.
      return {
        refreshState,
        // ... other diagnostics
      }
    })
  }
}
```

**Why `registerDiagnostics(fn)` instead of a named export?** Both team-tracker and org-roster define key runtime state (refresh state, name caches, config lookups) inside the `registerRoutes` closure. A named export like `module.exports.getDiagnostics` would be outside the closure and unable to access this state. The callback pattern lets the module register its diagnostics function from inside the closure where it has full access, while `collectModuleDiagnostics` simply invokes whatever was registered. Modules that don't call `registerDiagnostics` produce a `{ enabled: true, diagnostics: "not implemented" }` stub.

#### Context Object Changes

The `moduleContext` built in `dev-server.js` gains a diagnostics registry:

```javascript
// In dev-server.js, before creating module routers:
const diagnosticsRegistry = {}  // slug -> async fn

const moduleContext = {
  storage: storageModule,
  requireAuth: authMiddleware,
  requireAdmin,
  registerDiagnostics: null  // set per-module during router creation
}
```

The `createModuleRouters` function in `module-loader.js` sets `context.registerDiagnostics` to a per-slug registration function before requiring each module's entry:

```javascript
function createModuleRouters(modules, context, enabledSlugs, diagnosticsRegistry) {
  const routers = {}
  for (const mod of modules) {
    if (!mod.server?.entry) continue
    if (enabledSlugs && !enabledSlugs.has(mod.slug)) continue
    const entryPath = path.join(mod._dir, mod.server.entry)
    const router = express.Router()
    try {
      // Set up per-module diagnostics registration
      context.registerDiagnostics = function(fn) {
        diagnosticsRegistry[mod.slug] = fn
      }
      require(entryPath)(router, context)
      routers[mod.slug] = router
    } catch (err) {
      console.error(`[module-loader] Failed to create router for "${mod.slug}":`, err.message)
    }
  }
  // Clean up — don't leave a stale registerDiagnostics on the context
  context.registerDiagnostics = null
  return routers
}
```

#### Module Loader: `collectModuleDiagnostics()`

```javascript
async function collectModuleDiagnostics(modules, diagnosticsRegistry, enabledSlugs) {
  const TIMEOUT_MS = 10000  // 10-second per-module timeout
  const results = {}

  // Build list of enabled modules with registered hooks
  const tasks = modules.map(function(mod) {
    if (!enabledSlugs || !enabledSlugs.has(mod.slug)) {
      return { slug: mod.slug, promise: Promise.resolve({ enabled: false }) }
    }
    const fn = diagnosticsRegistry[mod.slug]
    if (typeof fn !== 'function') {
      return { slug: mod.slug, promise: Promise.resolve({ enabled: true, diagnostics: 'not implemented' }) }
    }
    // Wrap in timeout
    const withTimeout = Promise.race([
      fn(),
      new Promise(function(_, reject) {
        setTimeout(function() { reject(new Error('diagnostics timed out after 10s')) }, TIMEOUT_MS)
      })
    ]).catch(function(err) {
      return { error: err.message }
    })
    return { slug: mod.slug, promise: withTimeout }
  })

  // Run all in parallel (they're independent)
  const settled = await Promise.all(tasks.map(function(t) { return t.promise }))
  for (let i = 0; i < tasks.length; i++) {
    results[tasks[i].slug] = settled[i]
  }

  return results
}
```

Key improvements over the initial design:
- **Per-module 10-second timeout** via `Promise.race` — a slow/hung module can't block the endpoint
- **Parallel execution** via `Promise.all` — modules run concurrently since they're independent
- **Error isolation** — each module's errors are caught individually

#### Must-Gather Collector Integration

The collector calls `collectModuleDiagnostics()` and includes results under a `modules` key in the output bundle:

```json
{
  "modules": {
    "team-tracker": { "refreshState": { "..." }, "jira": { "..." }, "..." },
    "org-roster": { "config": { "..." }, "syncStatus": { "..." }, "..." }
  }
}
```

#### Documentation Update

Add a "Diagnostics Hook" section to `docs/MODULES.md` explaining the `registerDiagnostics` pattern, what to include, and a minimal example.

---

## Gap 2: Enhanced Diagnostic Data

### 2.1 App Version / Git SHA

**New: `server/build-info.js`** — a tiny module that reads build metadata:

```javascript
// Populated at build time via Dockerfile ENV or at startup via git
module.exports = {
  version: process.env.APP_VERSION || require('../package.json').version,
  gitSha: process.env.GIT_SHA || null,
  buildDate: process.env.BUILD_DATE || null,
  nodeVersion: process.version
}
```

**Dockerfile changes**: Add `ARG GIT_SHA` / `ENV GIT_SHA=$GIT_SHA` and `ARG BUILD_DATE` / `ENV BUILD_DATE=$BUILD_DATE` to the **backend Dockerfile only**. The frontend Dockerfile is a multi-stage build and `build-info.js` is server-side only. CI passes `--build-arg GIT_SHA=${{ github.sha }} --build-arg BUILD_DATE=$(date -u +%FT%TZ)`.

Note: `APP_VERSION` is not set anywhere — it always falls back to `package.json`. This is intentional; if a separate version is ever needed, just add another `ARG`/`ENV`.

Included at the top level of the must-gather output:

```json
{
  "buildInfo": {
    "version": "0.0.0",
    "gitSha": "abc1234...",
    "buildDate": "2026-03-26T...",
    "nodeVersion": "v22.x.x"
  }
}
```

### 2.2 Request Tracker Middleware

**New: `server/request-tracker.js`** — lightweight Express middleware that tracks the last N API requests in a ring buffer.

Captures per request:
- Method, parameterized path template (see Path Anonymization below)
- Status code, response time (ms)
- Timestamp
- Whether it was an error (4xx/5xx)

Configuration:
- Buffer size: 200 requests (configurable)
- Only tracks `/api/` routes
- No request/response bodies (privacy + memory)

#### Path Anonymization (aggressive mode)

Request paths like `/api/person/jane_doe/metrics` contain PII. The request tracker stores raw paths internally (needed for minimal mode), but the must-gather collector applies path anonymization in aggressive mode using the same `shared/server/anonymize.js` mapping:

Known parameterized route patterns are matched and segments looked up in the mapping:
- `/api/person/:name/...` — segment looked up via `mapping.anonymizeValue()` or `mapping.getOrCreateNameMapping()`
- `/api/team/:teamKey/...` — composite key segments anonymized
- `/api/github/contributions/:username/...` — looked up via `mapping.getOrCreateGithubMapping()`
- `/api/gitlab/contributions/:username/...` — looked up via `mapping.getOrCreateGitlabMapping()`
- `/api/modules/team-tracker/person/:name/...` — same as `/api/person/`
- `/api/modules/org-roster/teams/:teamKey/...` — same as `/api/team/`

This is done at redaction time (not at capture time) so minimal mode preserves full paths.

Output in must-gather:

```json
{
  "requestStats": {
    "bufferSize": 200,
    "totalTracked": 1847,
    "uptimeSecs": 86400,
    "summary": {
      "totalRequests": 1847,
      "errorCount": 12,
      "avgResponseTimeMs": 145,
      "p95ResponseTimeMs": 890,
      "byStatus": { "200": 1790, "404": 10, "500": 2 },
      "byEndpoint": {
        "GET /api/roster": { "count": 200, "avgMs": 50, "errors": 0 },
        "POST /api/roster/refresh": { "count": 5, "avgMs": 12000, "errors": 1 }
      },
      "slowestRequests": [
        { "method": "POST", "path": "/api/roster/refresh", "status": 200, "ms": 45000, "at": "..." }
      ]
    },
    "recentErrors": [
      { "method": "GET", "path": "/api/person/[REDACTED]/metrics", "status": 500, "ms": 120, "at": "..." }
    ]
  }
}
```

### 2.3 Error Buffer (unchanged from original plan)

**New: `server/error-buffer.js`** — patches `console.error` and `console.warn` to capture the last 100 messages with timestamps. Stored in a ring buffer, included in the must-gather output.

```json
{
  "recentErrors": [
    { "level": "error", "message": "[jira] Rate limited (429)...", "at": "2026-03-26T..." }
  ]
}
```

**Aggressive mode handling**: Error messages frequently contain interpolated names, emails, and paths (e.g., `[jira] Failed to resolve "Jane Smith" (jane@redhat.com)`). In aggressive mode, a best-effort scrub pass iterates over the mapping tables from `shared/server/anonymize.js` (`nameToFake`, `emailToFake`, etc.) and does string replacements on error messages. This is documented as best-effort since arbitrary format strings can't be perfectly cleaned. The HelpView UI will display a prominent warning when aggressive mode is selected: *"Error messages may still contain partial personal information despite best-effort scrubbing."*

### 2.4 Team-Tracker Module Diagnostics (`registerDiagnostics()`)

This is the richest source of debugging data. The team-tracker module registers a diagnostics hook from inside `registerRoutes`, giving it access to closure-scoped state like `refreshState` and `jiraNameCache`.

Output:

```json
{
  "jira": {
    "configured": true,
    "host": "https://redhat.atlassian.net",
    "emailSet": true,
    "tokenSet": true,
    "storyPointsField": "customfield_10028",
    "projectKeys": ["RHOAIENG", "SRVKP"],
    "projectKeysFingerprint": "RHOAIENG,SRVKP",
    "nameCache": {
      "totalEntries": 85,
      "resolvedCount": 80,
      "unresolvedCount": 5,
      "unresolvedNames": ["Some Person"],
      "resolvedViaEmail": 65,
      "resolvedViaSearch": 15,
      "sampleMappings": { "John Smith": "John Smith (jsmith)" }
    },
    "jqlPatterns": {
      "resolvedTemplate": "assignee = \"{accountId}\" AND resolved >= -{lookbackDays}d AND issuetype in (...){projectFilter}",
      "inProgressTemplate": "assignee = \"{accountId}\" AND status in (...){projectFilter}",
      "lookbackDays": 365,
      "fieldsVersion": "v1"
    }
  },
  "rosterSync": {
    "configured": true,
    "config": {
      "orgRootCount": 3,
      "orgRootUids": ["uid1", "uid2", "uid3"],
      "googleSheetId": "1abc...(redacted)",
      "hasTeamStructure": true,
      "teamGroupingColumn": "Team",
      "customFieldCount": 4,
      "githubOrgs": ["org1"],
      "gitlabGroups": ["group1"]
    },
    "lastSyncAt": "2026-03-26T06:00:00Z",
    "lastSyncStatus": "success",
    "lastSyncError": null,
    "syncInProgress": false
  },
  "roster": {
    "exists": true,
    "orgCount": 3,
    "totalPeople": 120,
    "peopleByOrg": { "uid1": 45, "uid2": 40, "uid3": 35 },
    "missingGithubUsernames": 15,
    "missingGitlabUsernames": 20,
    "missingEmails": 0
  },
  "dataHealth": {
    "personMetrics": {
      "totalFiles": 85,
      "recentlyUpdated": 80,
      "staleFiles": 5,
      "staleThresholdDays": 7,
      "oldestFetchedAt": "2026-03-10T...",
      "newestFetchedAt": "2026-03-26T...",
      "nameNotFoundCount": 3,
      "nameNotFoundPeople": ["Person A"],
      "orphanedFiles": ["old_person.json"],
      "fieldsVersionMismatch": 0,
      "sampleMetrics": {
        "person_name": {
          "resolvedCount": 15,
          "inProgressCount": 3,
          "hasResolvedName": false,
          "fetchedAt": "2026-03-26T..."
        }
      }
    },
    "github": {
      "configured": true,
      "cacheExists": true,
      "userCount": 70,
      "fetchedAt": "2026-03-26T...",
      "historyExists": true,
      "historyUserCount": 70,
      "historyMonthRange": { "earliest": "2026-01", "latest": "2026-03" },
      "usersWithZeroContributions": 10
    },
    "gitlab": {
      "configured": true,
      "baseUrl": "https://gitlab.com",
      "cacheExists": true,
      "userCount": 50,
      "fetchedAt": "2026-03-25T...",
      "historyExists": true,
      "historyUserCount": 50,
      "historyMonthRange": { "earliest": "2026-01", "latest": "2026-03" },
      "usersWithZeroContributions": 8
    },
    "snapshots": {
      "teamCount": 12,
      "totalSnapshotFiles": 36,
      "periodsCovered": ["2026-01", "2026-02", "2026-03"],
      "teamsWithGaps": [],
      "snapshotEpoch": "2026-01-01"
    },
    "lastRefreshed": "2026-03-26T05:00:00Z"
  },
  "refreshState": {
    "running": false,
    "scope": null,
    "progress": { "completed": 0, "total": 0, "errors": 0 },
    "sources": { "jira": null, "github": null, "gitlab": null },
    "startedAt": null
  }
}
```

#### Data Integrity Checks

The team-tracker `getDiagnostics()` function will perform these active checks:
1. **Orphaned person files**: Files in `data/people/` that don't correspond to any current roster member
2. **Name cache mismatches**: Roster names with no Jira accountId resolution (or stale cache entries for people no longer on the roster)
3. **Stale metrics**: Person metric files not updated in 7+ days
4. **Fields version drift**: Person files with an old `fieldsVersion` that will trigger full re-fetch
5. **GitHub/GitLab username coverage**: How many roster members are missing usernames
6. **Snapshot gaps**: Teams that should have snapshots for completed periods but don't

### 2.5 Org-Roster Module Diagnostics (`registerDiagnostics()`)

The org-roster module has its own data sources and sync pipeline. Its diagnostics hook (registered inside `registerRoutes` for access to `isSyncInProgress()` and config helpers) will return:

```json
{
  "config": {
    "teamBoardsTab": "Scrum Team Boards",
    "componentsTab": "Summary: components per team",
    "jiraProject": "RHAIRFE",
    "rfeIssueType": "Feature Request",
    "orgNameMappingCount": 2,
    "componentMappingCount": 5
  },
  "syncStatus": {
    "lastSyncAt": "2026-03-26T06:05:00Z",
    "status": "success",
    "error": null,
    "syncInProgress": false
  },
  "scheduler": {
    "dailySyncScheduled": true,
    "intervalMs": 86400000,
    "startupDelayMs": 300000,
    "dependsOnRosterData": true,
    "rosterDataExists": true
  },
  "teamsMetadata": {
    "exists": true,
    "fetchedAt": "2026-03-26T06:05:00Z",
    "teamCount": 25,
    "orgNames": ["Org A", "Org B", "Org C"],
    "teamsWithBoardUrls": 20,
    "teamsWithoutBoardUrls": 5,
    "resolvedBoardNames": 18,
    "unresolvedBoardUrls": 2
  },
  "components": {
    "exists": true,
    "fetchedAt": "2026-03-26T06:05:00Z",
    "componentCount": 30,
    "teamsWithComponents": 22,
    "teamsWithoutComponents": 3
  },
  "rfeBacklog": {
    "exists": true,
    "fetchedAt": "2026-03-26T06:05:00Z",
    "totalComponents": 30,
    "componentsWithRfes": 18,
    "componentsWithErrors": 1,
    "totalRfeCount": 145,
    "teamCount": 20
  },
  "dataIntegrity": {
    "teamsInMetadataNotInRoster": ["Phantom Team"],
    "rosterTeamsNotInMetadata": ["New Team"],
    "componentsWithNoTeam": ["orphaned-component"],
    "sheetOrgsMissingFromConfig": ["Unmapped Org"]
  }
}
```

#### Org-Roster Data Integrity Checks

1. **Teams in metadata not in roster**: Teams listed in `teams-metadata.json` that have no matching people in `org-roster-full.json` (indicates stale sheet data or org name mapping issues)
2. **Roster teams not in metadata**: Teams derived from roster people groupings that don't appear in sheet metadata (missing from the spreadsheet)
3. **Components with no team**: Components in `components.json` that aren't associated with any current team
4. **Sheet orgs missing from config**: Org names in the spreadsheet that don't map to any configured org root (may need an `orgNameMapping` entry)
5. **Board URL resolution failures**: Board URLs that couldn't be resolved to names (Jira API issue or deleted boards)
6. **Scheduler not running**: Daily sync not scheduled (e.g., no Google Sheet ID configured, or roster data doesn't exist yet)

### 2.6 Shell-Level Diagnostics (collected by `server/must-gather.js`)

These are collected by the must-gather collector itself (not by modules):

```json
{
  "system": {
    "platform": "linux",
    "arch": "x64",
    "nodeVersion": "v22.x.x",
    "uptimeSeconds": 86400,
    "memoryUsage": { "rss": "...", "heapUsed": "...", "heapTotal": "..." },
    "env": {
      "DEMO_MODE": "false",
      "JIRA_HOST": "https://redhat.atlassian.net",
      "JIRA_EMAIL_SET": true,
      "JIRA_TOKEN_SET": true,
      "GITHUB_TOKEN_SET": true,
      "GITLAB_TOKEN_SET": false,
      "GITLAB_BASE_URL": "https://gitlab.com",
      "GOOGLE_SERVICE_ACCOUNT_KEY_FILE": "/etc/secrets/google-sa-key.json",
      "GOOGLE_SA_KEY_EXISTS": true,
      "NODE_ENV": "production",
      "API_PORT": "3001"
    }
  },
  "builtInModules": {
    "discovered": ["team-tracker", "org-roster"],
    "enabledState": { "team-tracker": true, "org-roster": true },
    "moduleManifests": { "team-tracker": { "...sanitized..." }, "org-roster": { "...sanitized..." } }
  },
  "storage": {
    "dataDir": "/data",
    "exists": true,
    "writable": true,
    "topLevelFiles": ["org-roster-full.json", "allowlist.json", "..."],
    "directories": ["people", "snapshots", "sprints", "org-roster"],
    "totalFileCount": 150,
    "diskUsageBytes": 2500000
  },
  "allowlist": {
    "emailCount": 5
  },
  "gitStaticModules": {
    "count": 2,
    "slugs": ["custom-mod-1", "custom-mod-2"],
    "syncStatus": { "from gitSync.getSyncStatus()" }
  }
}
```

---

## API

### `GET /api/must-gather?redact=minimal|aggressive`

- **Auth**: Requires admin
- **redact=minimal** (default): Redacts secrets/tokens, keeps names and emails (useful for internal debugging)
- **redact=aggressive**: Also anonymizes names, emails, UIDs, and Jira account IDs (for sharing externally, e.g., GitHub issues)

Response: `Content-Type: application/json`, `Content-Disposition: attachment; filename=must-gather-<timestamp>.json`

### Redaction Strategy — Reusing `shared/server/anonymize.js`

The platform already has a shared anonymization library at `shared/server/anonymize.js`, used by the test data export system (`GET /api/export/test-data`). The must-gather collector **reuses this library** for aggressive-mode redaction rather than building a separate system.

#### How it works

In aggressive mode, `server/must-gather.js` calls `buildMapping(roster)` from `shared/server/anonymize.js` to build the PII mapping from `org-roster-full.json`. This produces a mapping object with:
- `nameToFake` / `getOrCreateNameMapping(name)` — person names → "Person 1", "Person 2", etc.
- `uidToFake` / `getOrCreateUidMapping(uid)` — UIDs → "person1", "person2", etc.
- `emailToFake` — emails → "person1@example.com", etc.
- `githubToFake` / `getOrCreateGithubMapping(username)` — GitHub usernames
- `gitlabToFake` / `getOrCreateGitlabMapping(username)` — GitLab usernames
- `accountIdToFake` / `getOrCreateAccountIdMapping(id)` — Jira account IDs
- `anonymizeJiraKey(key)` — issue keys (e.g., "DEMO-123" → "TEST1-123")
- `anonymizeBoardUrl(url, index)` — board URLs
- `anonymizeValue(value)` — generic lookup across all mapping tables

The mapping is deterministic (seeded), so the same input always produces the same output — useful for correlating across multiple must-gather bundles from the same instance.

#### Redaction table

| Data | minimal | aggressive |
|------|---------|------------|
| API tokens/secrets | REDACTED | REDACTED |
| Env var values (sensitive) | presence only (true/false) | presence only |
| Email addresses | kept | `mapping.emailToFake` |
| Person names (incl. `unresolvedNames`, `sampleMappings`, `nameNotFoundPeople`) | kept | `mapping.getOrCreateNameMapping()` |
| UIDs | kept | `mapping.getOrCreateUidMapping()` |
| Jira accountIds | kept | `mapping.getOrCreateAccountIdMapping()` |
| Org root UIDs | kept | `mapping.getOrCreateUidMapping()` |
| Org display names | kept | `mapping.getOrCreateNameMapping()` |
| Team names | kept | kept (not PII — team names are organizational, not personal) |
| Google Sheet ID | truncated (first 4 chars) | "placeholder-sheet-id" (matches export system) |
| Board URLs | kept | `mapping.anonymizeBoardUrl()` |
| GitHub usernames | kept | `mapping.getOrCreateGithubMapping()` |
| GitLab usernames | kept | `mapping.getOrCreateGitlabMapping()` |
| Request paths (in tracker data) | kept | parameterized segments replaced via mapping lookups |
| JQL patterns | templates shown | templates shown |
| Issue keys | kept | `mapping.anonymizeJiraKey()` |
| Component names | kept | kept (not PII) |
| Error messages | kept | best-effort scrub via `mapping.anonymizeValue()` + UI warning |

#### Implementation in `server/must-gather.js`

```javascript
const { buildMapping } = require('../shared/server/anonymize')

function redactBundle(bundle, mode, storageModule) {
  if (mode === 'minimal') {
    // Only strip secrets/tokens, keep all names/UIDs
    return stripSecrets(bundle)
  }

  // Aggressive: build mapping from roster, then walk the tree
  const roster = storageModule.readFromStorage('org-roster-full.json')
  const mapping = buildMapping(roster)
  const stripped = stripSecrets(bundle)
  return anonymizeTree(stripped, mapping)
}
```

The `anonymizeTree` function recursively walks the JSON output, applying `mapping.anonymizeValue()` to all string values. For known fields requiring specific mapping functions (e.g., Jira issue keys, board URLs), targeted replacements are applied first.

**Request path anonymization**: In aggressive mode, path segments in request tracker data are matched against the mapping tables. For example, `/api/person/jane_doe/metrics` — the segment `jane_doe` is looked up in the name mapping (after converting from the filename-safe format) and replaced.

**Error message scrubbing**: In aggressive mode, error messages are passed through a scrub function that iterates over `mapping.nameToFake`, `mapping.emailToFake`, etc. and does string replacements. This is best-effort since interpolated values in error strings may not match exactly.

**Array values**: The `anonymizeTree` recursive walk covers string values inside arrays as well as object values, handling arrays like `dataIntegrity.teamsInMetadataNotInRoster`, `unresolvedNames`, etc.

---

## UI

### HelpView.vue

Accessible from a "Help & Debug" link in the sidebar (admin-only visibility for the download button).

Contents:
- App version / build info display
- "Download Diagnostics" button with redaction level selector
- Brief explanation of what's collected and how to attach to a GitHub issue
- **Prominent warning when aggressive mode is selected**: *"Error messages and log entries may still contain partial personal information despite best-effort scrubbing. Review the downloaded file before sharing publicly."*
- Link to `docs/MUST-GATHER.md` for detailed documentation

---

## Implementation Order

1. **`server/build-info.js`** — trivial, no dependencies
2. **`server/error-buffer.js`** — ring buffer, patched onto console
3. **`server/request-tracker.js`** — Express middleware with path anonymization support
4. **`server/must-gather.js`** — core collector calling all sources
5. **Module loader update** — add `diagnosticsRegistry`, `registerDiagnostics` in context, `collectModuleDiagnostics()`
6. **`modules/team-tracker/server/index.js`** — call `context.registerDiagnostics()` inside `registerRoutes`
7. **`modules/org-roster/server/index.js`** — call `context.registerDiagnostics()` inside `registerRoutes`
8. **`server/dev-server.js`** — wire up error buffer, request tracker, diagnostics registry, must-gather route
9. **`src/components/HelpView.vue`** + sidebar/nav updates (with aggressive-mode PII warning)
10. **Backend Dockerfile update** — pass `GIT_SHA` and `BUILD_DATE` build args
11. **`docs/MUST-GATHER.md`** + update to `docs/MODULES.md`
12. **Tests** — unit tests for error-buffer, request-tracker, must-gather collector, both modules' diagnostics hooks, path anonymization, redaction

---

## Non-Goals (unchanged)

- No continuous metrics/monitoring (this is a point-in-time snapshot)
- No log file shipping
- No automatic submission — user downloads and attaches manually
- No PII in the "aggressive" redaction mode (best-effort — error messages may still contain names, documented with UI warning)

---

## Relationship to Test Data Export

The platform has an existing anonymized test data export system (`GET /api/export/test-data`) that produces a tarball of anonymized data files for testing/demo purposes. The must-gather system is different in purpose but shares infrastructure:

| Aspect | Test Data Export | Must-Gather |
|--------|-----------------|-------------|
| **Purpose** | Produce anonymized data files for test/demo environments | Collect diagnostic metadata for debugging |
| **Output** | `.tgz` tarball of anonymized JSON data files | Single JSON diagnostic bundle |
| **Content** | Full data files (roster, people metrics, snapshots, etc.) | Metadata, stats, health checks, config — NOT full data |
| **Anonymization** | Always anonymized | Only in aggressive mode |
| **Shared library** | `shared/server/anonymize.js` | Same — reuses `buildMapping()` |
| **Module hooks** | `server/export.js` (manifest: `export.customHandler`) | `context.registerDiagnostics()` (no manifest change) |
| **Auth** | Admin required | Admin required |

The key distinction: test data export anonymizes and exports the **actual data** (every person file, every snapshot). Must-gather exports **metadata about the data** (counts, staleness, integrity checks, config) — much smaller, focused on diagnosing problems rather than reproducing the environment.

---

## Open Questions

None — both gaps, reviewer feedback, and anonymization reuse have been addressed:
1. **Module extensibility**: `context.registerDiagnostics(fn)` callback registered inside `registerRoutes` closure (solves closure-state access). Auto-collected with 10s timeout and parallel execution.
2. **Debugging data completeness**: Build info, request tracking, error buffer, and comprehensive diagnostics from both modules.
3. **PII in request paths**: Parameterized path anonymization via `shared/server/anonymize.js` mapping.
4. **Error message PII**: Best-effort scrub pass using mapping tables + prominent UI warning.
5. **Diagnostics timeout**: 10-second per-module timeout via `Promise.race`, parallel via `Promise.all`.
6. **Anonymization reuse**: Aggressive-mode redaction uses `buildMapping()` from `shared/server/anonymize.js` — no duplicate anonymization implementation.
