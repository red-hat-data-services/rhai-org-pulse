# Release Planning Module -- Comprehensive Review & Improvement Plan

**Date:** 2026-04-23
**Reviewer:** Architect Agent
**Module:** `modules/release-planning/`
**Scope:** Security, code simplification, architecture, reliability, UX, testability

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Security Review](#2-security-review)
3. [Code Simplification](#3-code-simplification)
4. [Architecture Review](#4-architecture-review)
5. [Reliability & Performance](#5-reliability--performance)
6. [UX / Frontend Quality](#6-ux--frontend-quality)
7. [Testability & Deployability](#7-testability--deployability)
8. [Backward Compatibility](#8-backward-compatibility)
9. [Recommended Improvements](#9-recommended-improvements)
10. [Files Modified](#10-files-modified)

---

## 1. Current State Assessment

### What Exists Today

The Release Planning module is a full-stack feature that enables Product Managers (PMs) and Engineering Managers (EMs) to orchestrate RHOAI releases around "Big Rocks" -- high-priority strategic initiatives that are tied to Jira outcome keys. The module provides:

**Core capabilities:**
- **Release lifecycle management** -- create, clone, delete releases identified by version strings (e.g., "3.5")
- **Big Rock CRUD** -- create, read, update, delete, and reorder strategic Big Rocks within a release
- **3-tier Jira pipeline** -- background pipeline that discovers Features and RFEs across three tiers:
  - Tier 1: Children of Big Rock outcome keys matching the release's target version
  - Tier 2: Features/RFEs in RHAISTRAT/RHAIRFE with matching release label, but not linked to any Big Rock
  - Tier 3: In-progress features with no target version or fix version
- **Google Doc import** -- parse Big Rocks from a structured Google Doc with preview/replace/append modes
- **SmartSheet integration** -- discover available release versions and milestone dates from the RHOAI GA schedule
- **PM role system** -- separate from platform admin; PMs can edit Big Rocks, admins manage PM list
- **Admin seed/bootstrap** -- bulk-load fixture data for initial setup or demo
- **Export** -- Markdown table export for Big Rocks, Features, and RFEs
- **Demo mode** -- fixture-backed read-only mode for demonstrations

**Data flow:**
- Config stored as `data/release-planning/config.json` (single JSON file, all releases)
- Candidates cached per-release as `data/release-planning/candidates-cache-{version}.json`
- PM users stored as `data/release-planning/pm-users.json`
- Backups stored as `data/release-planning/config-backup-{timestamp}.json` (max 10 retained)

### Key Strengths

1. **Solid test coverage** -- 205 tests across 13 test files, covering server logic comprehensively (config CRUD, validation, pipeline, Jira client, doc import, backups, locking, PM auth, SmartSheet)
2. **Config lock** -- in-process mutex prevents concurrent read-modify-write races on the shared config file
3. **Input validation** -- `validation.js` enforces field limits, outcome key format, reserved names, and uniqueness
4. **Backup-before-delete** -- destructive operations (delete rock, delete release, replace import) create timestamped backups with automatic pruning
5. **Version parameter sanitization** -- `isValidVersion()` regex and reserved-name checks on all route parameters
6. **Background pipeline** -- Jira fetching runs asynchronously; stale-while-revalidate pattern serves cached data immediately
7. **Demo mode** -- complete fixture-backed mode with proper guard on all write operations
8. **Clean separation** -- pipeline logic, Jira client, config management, validation, and auth are each in separate files

---

## 2. Security Review

### 2.1 Authentication & Authorization

| Finding | Severity | Location |
|---------|----------|----------|
| PM auth reads from storage on every request (no caching) | Low | `pm-auth.js:9` |
| PM email comparison in `isPM()` does not independently lowercase (defense-in-depth) | Low | `pm-auth.js:10` vs `pm-auth.js:28` |
| `requirePM` checks `req.isAdmin` but doesn't verify `req.userEmail` exists | Low | `pm-auth.js:14` |
| No rate limiting on any endpoints | Medium | `server/index.js` |
| Admin seed endpoint accepts arbitrary config shapes beyond `releases` | Low | `server/index.js:636` |

**PM email normalization (defense-in-depth, P2):** `addPMUser` normalizes to lowercase, and `isPM()` compares `req.userEmail` against the stored list without independently lowercasing. However, `shared/server/auth.js` already lowercases `req.userEmail` in all three auth paths: proxy auth (line 74), local dev fallback (line 76), and token auth (line 60, which stores `ownerEmail` from an already-lowercased `req.userEmail`). Since both sides are always lowercase by the time module middleware runs, this is not a real bug. Adding `.toLowerCase()` in `isPM()` is a defense-in-depth measure in case a future auth path omits normalization.

**Duplicate PM check in `/permissions` route (P1):** The `GET /permissions` endpoint (lines 236-242 of `server/index.js`) uses `getPMUsers(readFromStorage)` and `pmList.includes(req.userEmail)` directly instead of calling `isPM()` via `createRequirePM`. This is a separate code path that would get out of sync if PM-checking logic ever changes (e.g., adding role-based checks or group membership). This should use the same `isPM()` function from `pm-auth.js`.

```javascript
// Current (server/index.js:236-242) -- inline PM check, bypasses isPM()
router.get('/permissions', requireAuth, function(req, res) {
  var pmList = getPMUsers(readFromStorage)
  var isPM = pmList.includes(req.userEmail)
  res.json({ canEdit: !!req.isAdmin || isPM })
})

// Should call the canonical isPM from pm-auth.js
```

### 2.2 Input Validation & Injection

| Finding | Severity | Location |
|---------|----------|----------|
| Outcome keys injected directly into JQL `key in (...)` (defense-in-depth) | Medium | `jira-client.js:248` |
| Release version injected into JQL label filter with limited sanitization | Medium | `jira-client.js:228-229` |
| `decodeURIComponent` on URL params without try/catch (malformed URI throws) | Low | `server/index.js:276, 356, 515` |
| Admin seed endpoint does not validate individual Big Rock objects | **High** | `server/index.js:649-660` |

**JQL injection via outcome keys (P1, defense-in-depth):** The `fetchOutcomeSummaries` function joins outcome keys directly into JQL without escaping:

```javascript
// jira-client.js:248
const keysStr = outcomeKeys.join(', ')
const jql = `key in (${keysStr}) ORDER BY key ASC`
```

Outcome keys are validated at input time by `OUTCOME_KEY_PATTERN = /^[A-Z]+-\d+$/` for all CRUD operations. The primary attack vector is the admin seed endpoint, which does NOT validate individual Big Rock fields within the `releases` object. However, exploiting this requires admin access -- and an admin can already delete releases, overwrite config, etc. The real vulnerability is the unvalidated admin seed endpoint (see item 0.2), not the JQL interpolation itself. Adding a JQL-safe assertion in the pipeline is a defense-in-depth measure, not a critical fix.

Similarly, `parent = "${outcomeKey}"` in `fetchOutcomeFeatures` (line 203) interpolates directly -- though the same OUTCOME_KEY_PATTERN constraint applies via config validation.

**Recommended fix:** Promote admin seed validation to Phase 0 (item 0.2) as the primary fix. Add JQL-safe assertion in the pipeline as a P1 defense-in-depth measure.

**Downstream consequence of seed validation gap:** `BigRocksTable` uses `name` as `item-key` for vuedraggable. If the admin seed creates Big Rocks with duplicate names (which `validateBigRock` would catch but the unvalidated seed does not), the drag-and-drop interface will break with duplicate key errors. This is another reason seed validation is P0.

### 2.3 Data Exposure

| Finding | Severity | Location |
|---------|----------|----------|
| `GET /config` returns full config including custom field IDs to admins only | Low | `server/index.js:218` |
| Error messages may leak internal paths or Jira details | Low | Various catch blocks |
| `GET /admin/seed/fixture` exposes fixture data | Low | `server/index.js:677` |

### 2.4 Denial of Service

| Finding | Severity | Location |
|---------|----------|----------|
| No pagination on `GET /releases/:version/candidates` response | Medium | `server/index.js:124` |
| `POST /jira/validate-keys` capped at 50 but still allows expensive Jira queries | Low | `server/index.js:450` |
| Background refresh has no timeout -- a stalled Jira response blocks future refreshes | **Medium** | `server/index.js:77` |
| Config backup pruning lists all files in `release-planning/` directory | Low | `config-backup.js:25` |

---

## 3. Code Simplification

### 3.1 Duplicated Logic

| Issue | Files Affected | Effort |
|-------|---------------|--------|
| `PRIORITY_STYLES` duplicated identically in `FeaturesTable.vue`, `RfesTable.vue`, and `constants.js` | 3 files | S |
| `docId` computed (Google Doc URL parsing) in `NewReleaseDialog.vue` (note: `ImportDocDialog.vue` is dead code -- see 3.2) | 1 file | S |
| Tier grouping logic (`tierCounts` + `groupedFeatures`/`groupedRfes`) is nearly identical in `FeaturesTable.vue` and `RfesTable.vue` | 2 files | S |
| Preview table markup (with status badge) in `NewReleaseDialog.vue` (note: `ImportDocDialog.vue` is dead code -- see 3.2) | 1 file | N/A |
| Status color mappings duplicated between `StatusBadge.vue` and `constants.js` | 2 files | S |
| `closedList` construction (`CLOSED_STATUSES.map(...)`) repeated in 4 Jira client functions (lines 193, 227, 263, 309) | 1 file | S |
| `targetVersionJql` construction with `cfMatch` regex repeated in 3 functions | 1 file | S |

**Recommendations:**
1. Extract `PRIORITY_STYLES` into a shared constants file or import from `constants.js` on the client side
2. Extract `parseDocId()` (already exists in `doc-import.js`) and share it with the client via a utils module or expose it from the composable
3. Consider extracting a `useTierGrouping(items)` composable, though the logic is only ~20 lines in each file and structurally differs slightly -- this may add indirection without meaningful DRY benefit (see Phase 1 notes)
4. Extract `buildClosedStatusList()` and `buildTargetVersionJql()` helper functions in `jira-client.js`

### 3.2 Dead Code & Unused Exports

| Issue | Location | Effort |
|-------|----------|--------|
| `batchFetchLinkedIssues` is exported but never called | `jira-client.js:368` | S |
| `discoverCustomFields` is exported but never called | `jira-client.js:395` | S |
| `loadFieldMapping` is exported but only used transitively via `getConfig` | `config.js:40` | S |
| `useRockColors` composable is defined but never imported by any component | `composables/useRockColors.js` | S |
| `checkRefreshStatus` is exported from composable but never called by any view | `useReleasePlanning.js:49` | S |
| `ImportDocDialog.vue` is never imported by any component or view | `components/ImportDocDialog.vue` | S |

**Recommendation:** Remove `batchFetchLinkedIssues`, `discoverCustomFields`, and `ImportDocDialog.vue` (dead code, never imported). If the Jira functions are exploration/debugging utilities, move them to a separate `jira-debug.js` file. Keep `checkRefreshStatus` -- it will likely be needed for polling (see reliability section).

### 3.3 Style Inconsistencies

| Issue | Location |
|-------|----------|
| Mix of `var` and `const`/`let` within the same file | `server/index.js`, `config.js` |
| Some functions use `function()` callbacks, others use arrow functions | Throughout server files |
| Inconsistent `function(req, res)` vs `async function(req, res)` -- some routes are unnecessarily `async` | `server/index.js` |

These are cosmetic but create cognitive friction during review. The codebase convention (from AGENTS.md) is CommonJS for server code. The `var` vs `const` inconsistency suggests multiple authoring passes. A single formatting pass would improve readability.

---

## 4. Architecture Review

### 4.1 Data Model

**Current:** All release data lives in a single `config.json` file. Each release's Big Rocks array, field mappings, and custom field IDs are stored together.

**Concern:** As the number of releases grows, every read/write operation loads and serializes the entire config. With 5+ releases, each with 15+ Big Rocks, this file grows to 50KB+. More importantly, the config lock serializes ALL writes across ALL releases -- editing a Big Rock in release 3.6 blocks edits in release 3.5.

**Recommendation (P1, M):** Consider splitting config into per-release files: `config-meta.json` (field mappings, custom field IDs) and `config-release-{version}.json` (Big Rocks for that release). This allows per-release locking and reduces I/O. The migration path is straightforward: read old format, write new format, prefer new format on load.

### 4.2 Caching Strategy

**Current:** Candidates are cached per-release with a 15-minute TTL. When stale, a background refresh is triggered and stale data is served. The `refreshState` is module-level (singleton), so only one refresh can run at a time across all releases.

**Issues:**
1. **Single-refresh bottleneck** -- If release 3.5 is refreshing, a request for stale 3.6 data will not trigger a refresh. It will serve stale data until 3.5 finishes.
2. **No refresh timeout** -- A stalled Jira connection will block all future refreshes indefinitely.
3. **No ETag or conditional caching** -- The client has no way to know if cached data has changed without re-fetching the full payload.
4. **Cache invalidation on Big Rock changes** -- `invalidateCache()` deletes the cache file AND immediately triggers a refresh, but the client is not notified that a refresh is happening.

**Recommendations:**
1. **(P1, M)** Track refresh state per-version instead of globally. Use a `Map<version, refreshState>` pattern.
2. **(P1, S)** Add a refresh timeout (e.g., 5 minutes). Use `AbortController` or a wrapper that rejects after timeout.
3. **(P2, M)** Add `ETag` or `Last-Modified` headers to the candidates endpoint so the client can use conditional requests.
4. **(P1, S)** After `invalidateCache()`, return the in-flight refresh state to the client so the UI can show a loading indicator.

### 4.3 API Design

**Current API surface is clean and RESTful.** A few observations:

| Issue | Severity | Detail |
|-------|----------|--------|
| `POST /releases/:version/refresh` requires admin but `GET /releases/:version/candidates?refresh=true` triggers refresh with just auth | Medium | Authorization inconsistency -- any authenticated user can force-refresh via query param, bypassing the admin guard on the POST endpoint |
| No PATCH support for Big Rocks -- PUT requires the full object | Low | Forces client to send all fields even for single-field updates |
| `GET /releases` does not include milestone dates from SmartSheet | Low | Requires separate API call for dates |
| `GET /refresh/status` is global, not per-version | Medium | Client cannot check status for a specific release |

**Force-refresh authorization inconsistency (P1):** The `GET /releases/:version/candidates?refresh=true` endpoint triggers `triggerBackgroundRefresh()` for any authenticated user, bypassing the `requireAdmin` guard on `POST /releases/:version/refresh`. However, the same refresh fires automatically when cache expires (the `isStale` check at line 157-159), so any authenticated user viewing stale data already triggers a refresh. The `refresh=true` query param is a convenience bypass of the staleness timer, not a security vulnerability. It should still be gated behind `requirePM` for consistency, but this is a P1 authorization inconsistency, not a P0 privilege escalation. This should either:
- Remove the `refresh=true` query param from the GET endpoint, or
- Gate it behind `requirePM` or `requireAdmin`

### 4.4 Error Handling Patterns

Error handling is generally good (try/catch with statusCode propagation), but has inconsistencies:

| Issue | Location | Impact |
|-------|----------|--------|
| `decodeURIComponent` can throw `URIError` on malformed input | `server/index.js:276, 356, 515` | Unhandled exception crashes the route |
| Jira client functions silently return empty arrays on error | `jira-client.js` all fetch functions | Pipeline proceeds with partial data -- no indication to user |
| `triggerBackgroundRefresh` catches errors but only logs them | `server/index.js:90-95` | User sees stale data with no explanation |
| `loadFixture` swallows all errors silently | `server/index.js:48-50` | Demo mode silently fails |

**Recommendation (P1, S):** Wrap all three `decodeURIComponent` calls (lines 276, 356, and 515) in try/catch and return 400 on `URIError`. For the pipeline, consider accumulating warnings alongside results so the frontend can display partial-data notices.

### 4.5 Separation of Concerns

The module has good file-level separation. However, `server/index.js` at 707 lines is doing too much:
- Route registration
- Demo mode fixture loading
- Background refresh orchestration
- Cache invalidation logic
- Version validation

**Recommendation (P2, M):** Extract background refresh management into a `refresh-manager.js` module. Extract route handlers into grouped files (e.g., `routes-releases.js`, `routes-big-rocks.js`, `routes-import.js`) if the file grows further.

---

## 5. Reliability & Performance

### 5.1 Race Conditions

| Issue | Severity | Detail |
|-------|----------|--------|
| `refreshState` is a mutable singleton -- concurrent requests can read inconsistent state | Low | Acceptable for single-replica |
| Config lock is in-process only -- multi-replica deployment would cause data corruption | **Medium** | Documented as single-replica constraint, but should be called out in operational docs |
| `invalidateCache` deletes cache then starts refresh -- a concurrent read between delete and write returns 202 (no cache) | Low | User sees "pipeline running" briefly |
| `executeDocImport` in replace mode deletes all rocks then re-adds -- if the process crashes mid-import, data is lost | Medium | Mitigated by backup-before-delete |

**Multi-replica concern (P1, documented):** The config lock comment says "sufficient for current single-replica deployment." If the deployment ever scales to multiple replicas, the filesystem-based locking will silently break. Consider adding a startup log warning or a health-check assertion for single-replica mode.

### 5.2 Error Recovery

| Issue | Severity | Detail |
|-------|----------|--------|
| Background refresh failure sets `lastResult.status = 'error'` but provides no retry mechanism | Medium | User must manually trigger refresh |
| No exponential backoff on Jira API errors (only rate-limit 429 retries exist in shared client) | Low | Transient Jira errors require manual retry |
| `writeToStorage` is synchronous (`writeFileSync`) -- a crash during write can corrupt the file | Medium | Mitigated by backup system |
| No health check for Jira connectivity | Low | Pipeline fails silently on auth errors |

**Recommendation (P1, S):** Add automatic retry for background refresh failures (1-2 retries with exponential backoff). Note: do NOT wire Jira connectivity checks into k8s liveness/readiness probes -- a Jira outage should not cause pod restarts. Use the existing `registerDiagnostics` callback instead, which is already implemented and reports module health without affecting pod lifecycle.

### 5.3 Performance Concerns

| Issue | Impact | Detail |
|-------|--------|--------|
| Pipeline makes N+1 Jira queries (one per outcome key per rock, plus tier 2/3 queries) | High for large configs | 15 rocks x 2 outcomes = 30+ sequential throttled queries at 1s each = 30s minimum |
| `getConfig(readFromStorage)` is called redundantly within locked sections | Low | Multiple reads of the same file within a single lock acquisition |
| `BigRocksTable.vue` re-renders all rows on any reorder | Low | Could use `key` optimization with stable IDs |
| Markdown export processes all data synchronously on the main thread | Low | Acceptable for current scale |

**Pipeline query count (P1, M):** For a release with 15 Big Rocks averaging 2 outcome keys each, the Tier 1 phase makes 30 feature queries and 30 RFE queries (60 total), throttled at 1s each = 1 minute minimum. Tier 2 adds 2 more queries. Consider batching outcome keys into a single JQL query where possible:

```
parent IN (KEY-1, KEY-2, KEY-3, ...) AND type = Feature AND ...
```

This would reduce 30 queries to a handful of batched queries. The tradeoff is losing the per-outcome-key rock mapping, which would need to be resolved in post-processing by checking each issue's parent field.

### 5.4 Stale Data Handling

The stale-while-revalidate pattern is well-implemented. One gap: when a PM edits a Big Rock and then immediately views the Features tab, the cached candidates still reference the old Big Rock names. The `invalidateCache()` function triggers a background refresh, but the user sees stale feature-to-rock mappings until it completes. The UI should indicate this more prominently.

---

## 6. UX / Frontend Quality

### 6.1 Component Design

| Observation | Severity | Detail |
|-------------|----------|--------|
| `BigRocksTable.vue` has two full table body implementations (draggable vs read-only) with duplicated column markup | Medium | 80 lines of duplicated table cells |
| Edit panel uses module-level singleton refs -- two browser tabs editing simultaneously will conflict | Medium | `useBigRockEditor.js` uses `const isOpen = ref(false)` at module scope |
| No keyboard shortcut support (Escape to close panels, Enter to save) | Low | Accessibility improvement |
| ~~`ImportDocDialog.vue` duplicates API calls~~ | ~~Medium~~ | Removed -- `ImportDocDialog.vue` is dead code (never imported); see section 3.2 |
| No loading skeleton / placeholder during initial load | Low | Shows "Loading release planning data..." text only |

**BigRocksTable duplication (P1, M):** The draggable and read-only table bodies share identical column templates. Extract the column cells into a `BigRockRow.vue` component that both paths use. The draggable wrapper can use it via slot, and the static tbody can iterate over it.

**Singleton editor state (P1, S):** Because `useBigRockEditor` uses module-level refs, all component instances share the same state. In a single-tab SPA this works fine, but if the module is ever used in multiple module views or tabs, it will break. Consider using `provide`/`inject` with a factory pattern, or at minimum document this as a known constraint.

**`isDirty` edit tracking scope (intentional, documented):** `useBigRockEditor.js` lines 44-48 only compare `owner`, `architect`, `outcomeKeys`, and `notes` in the edit-mode dirty check. The fields `name`, `fullName`, and `pillar` are excluded. This is intentional -- these fields are read-only in the edit panel (they can only be set during creation, where the "new rock" dirty check at lines 35-41 does check all fields). This is not a bug but should be documented with a code comment to prevent confusion.

### 6.2 State Management

The composable pattern (`useReleasePlanning.js`) uses module-level refs for singleton state. This is a deliberate choice per the codebase conventions (shared/client composables use the same pattern). Observations:

1. **No optimistic updates for reorder** -- dragging a Big Rock triggers an API call, and the list reverts to the server response. If the API is slow, the user sees a jarring revert-then-update. The current `onDragEnd` emits the new order, but `handleReorder` in `DashboardView.vue` does not optimistically update the local state before the API call.

2. **Error state is global** -- `error.value` is shared across all operations. A failed delete sets the error, which persists even when the user switches releases or tabs.

3. **No polling for refresh completion** -- `checkRefreshStatus` exists but is never called. After triggering a refresh, the user has no feedback when it completes. They must manually reload.

**Recommendations:**
- **(P1, S)** Clear `error.value` on release change or tab switch
- **(P1, M)** Implement refresh polling: after triggering refresh, poll `GET /refresh/status` every 5-10 seconds until `running === false`, then reload candidates
- **(P2, S)** Add optimistic reorder: update `localRocks` immediately, revert on error

### 6.3 Accessibility

| Issue | WCAG Level | Detail |
|-------|------------|--------|
| Drag handle uses Unicode character (braille dots) with no `aria-label` | A | Screen readers cannot identify the drag handle |
| Modal dialogs do not trap focus | A | Tab key can escape the modal to background elements |
| No `aria-live` region for background refresh notifications | AA | Status changes are not announced to screen readers |
| Select dropdowns have no accessible labels (only visual labels) | A | Filter selects in `FilterBar.vue` lack `id`/`for` association |
| Tables lack `<caption>` elements | AA | Screen readers cannot identify table purpose |

### 6.4 Responsive Design

The dashboard uses Tailwind responsive classes well for summary cards (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`). However:
- Tables overflow horizontally on mobile (handled by `overflow-x-auto`) but with no mobile-friendly alternative view
- The edit panel is `max-w-lg` with `w-full` which works on mobile but is dense
- Filter bar wraps naturally via `flex-wrap` -- acceptable

---

## 7. Testability & Deployability

### 7.1 Current Test Coverage

**Strengths:**
- 205 tests, all passing, across 13 files
- Server-side logic is comprehensively tested: config CRUD, validation, pipeline, Jira client field extraction, doc import/parse, backup management, locking, PM auth
- Tests use proper mocking (vi.fn()) for storage and Jira functions
- Pipeline tests cover all three tiers, deduplication, filtering, and edge cases

**Gaps:**

| Gap | Severity | Detail |
|-----|----------|--------|
| No client-side (Vue component) tests | **Medium** | Zero component tests -- all 13 test files are server-side |
| No integration tests for route handlers | Medium | `server/index.js` is untested; validation/auth flow is only tested at unit level |
| No test for `loadFixture()` behavior | Low | Demo mode fixture loading is untested |
| No test for `invalidateCache()` | Low | Cache invalidation logic is untested |
| No test for the admin seed endpoint validation | Medium | Seed endpoint accepts arbitrary config shapes |
| SmartSheet test mocks the HTTP layer but doesn't test error paths | Low | `smartsheet.test.js` -- limited error path coverage |

**Recommendations:**
1. **(P1, L)** Add route-handler integration tests using `supertest` -- test the full request/response cycle including auth guards, validation, and error responses across all 21 routes
2. **(P1, M)** Add Vue component tests for `DashboardView`, `BigRocksTable`, and `BigRockEditPanel` -- focus on user interactions (edit, delete, reorder)
3. **(P2, S)** Add a test for the admin seed endpoint that verifies it rejects malformed Big Rock data

### 7.2 Deployability

- Module follows the standard module system (auto-discovered via `module.json`)
- No external dependencies beyond the shared Jira, Google Docs, and SmartSheet clients
- Data stored in the standard PVC-mounted `data/` directory
- No database or external state -- fully filesystem-backed
- Demo mode is fully functional for demonstrations without credentials

**CI/CD considerations:**
- Fixture files are included in the repo and tested against
- No migration scripts needed (config format is forward-compatible via spread defaults)
- The `fixtures/release-planning/` directory must be included in the backend Docker image (it is, per `deploy/backend.Dockerfile`)
- **Pre-existing gap (D1):** The ARM Mac build workaround in `deploy/OPENSHIFT.md` does not include `COPY fixtures/` -- fixture files are not available in ARM-built images. This is a pre-existing issue, not introduced by this module.
- **Pre-existing gap (D4):** The `fixtures/` path is not included in `build-images.yml` trigger paths, so fixture-only changes will not trigger image rebuilds. Low risk since fixture changes typically accompany code changes.

**Health check considerations:**
- **Do NOT wire module health into k8s probes (D2).** A Jira outage should not cause pod restarts. Instead, use the existing `registerDiagnostics` callback (already implemented at line 686) which exposes module health via the platform's `/api/healthz` diagnostics endpoint without affecting pod lifecycle.

---

## 8. Backward Compatibility

### Existing APIs & Data Contracts

| Contract | Status | Risk |
|----------|--------|------|
| `GET /releases` response format | Stable | None -- additive changes only |
| `GET /releases/:version/candidates` response format | Stable | Adding `_cacheStale` and `_refreshing` was additive |
| `config.json` data format | Stable | `getConfig()` merges with defaults; old configs work |
| `pm-users.json` format | Stable | Simple `{ emails: [] }` structure |
| `candidates-cache-{version}.json` format | Internal | Cache files can be regenerated; format changes are safe |
| Fixture file format | Stable | Demo mode depends on fixture structure |

**Breaking change risk from proposed improvements:**
- Splitting `config.json` into per-release files would require a one-time migration. This MUST be backward-compatible: the system should read the old single-file format if per-release files don't exist, then lazily migrate on the next write.
- Changing the refresh state from global to per-version changes the `GET /refresh/status` response shape. Since this endpoint is internal (only used by the frontend), this is a coordinated change, not a breaking API change.
- PM email `.toLowerCase()` in `isPM()` is a defense-in-depth addition; no behavior change since `req.userEmail` is already lowercased by the auth middleware.
- Gating `refresh=true` behind `requirePM` is a minor authorization tightening -- non-PM authenticated users will no longer be able to force-refresh via query param (but stale cache auto-refreshes unaffected).

---

## 9. Recommended Improvements

### Phase 0: Critical Fixes (Ship This Week)

| # | Improvement | Effort | Priority | Files |
|---|-------------|--------|----------|-------|
| 0.1 | **Fix RFE markdown export `.join()` on string** -- `DashboardView.vue` line 147 calls `(r.labels \|\| []).join(', ')` but `r.labels` is already a comma-separated string from `mapToCandidate`, not an array. Calling `.join()` on a string iterates characters, producing garbled output like `"l, a, b, e, l, 1"`. Fix: use `r.labels \|\| '-'` directly (it is already a string) | S | P0 | `DashboardView.vue` |
| 0.2 | **Admin seed validation** -- validate Big Rock objects within seeded releases through `validateBigRock`. The seed endpoint accepts arbitrary config shapes and is the primary vector for injecting malformed data (including invalid outcome keys that bypass JQL input validation) | S | P0 | `server/index.js` |
| 0.3 | **Wrap `decodeURIComponent` in try/catch** -- return 400 on URIError for all three call sites: `:name` params (lines 276, 356) and `:email` param (line 515) | S | P0 | `server/index.js` |
| 0.4 | **Fix `/permissions` route duplicate PM check** -- the `GET /permissions` endpoint (lines 236-242) uses `getPMUsers(readFromStorage)` and `pmList.includes(req.userEmail)` directly instead of calling `isPM()` via `createRequirePM`. Refactor to use the canonical `isPM()` function to prevent logic drift | S | P0 | `server/index.js`, `pm-auth.js` |

### Phase 1: Reliability & Core Quality (Next 2 Sprints)

| # | Improvement | Effort | Priority | Files |
|---|-------------|--------|----------|-------|
| 1.1 | **Per-version refresh state** -- replace singleton `refreshState` with `Map<version, state>`. Note: concurrent per-version refreshes could exceed Jira rate limits causing 429 errors. Add a concurrency limit (e.g., max 2 concurrent refreshes) or a queue to coordinate Jira API throttling across versions | M | P1 | `server/index.js` |
| 1.2 | **Refresh timeout** -- add 5-minute timeout to background refresh via AbortController or Promise.race | S | P1 | `server/index.js` |
| 1.3 | **Refresh polling on client** -- after triggering refresh, poll `GET /refresh/status` and reload candidates on completion | M | P1 | `useReleasePlanning.js`, `DashboardView.vue` |
| 1.4 | **Clear error state on context change** -- reset `error.value` when switching releases or tabs | S | P1 | `DashboardView.vue` |
| 1.5 | **DRY BigRocksTable** -- extract shared row template to eliminate 80 lines of duplication | M | P1 | `BigRocksTable.vue` |
| 1.6 | **DRY PRIORITY_STYLES** -- import from a shared client constants file instead of duplicating | S | P1 | `FeaturesTable.vue`, `RfesTable.vue`, `constants.js` |
| 1.7 | **Fix force-refresh authorization inconsistency** -- gate `refresh=true` query param behind `requirePM` or remove it. This is not a privilege escalation (stale data already triggers the same refresh automatically), but the auth guard inconsistency with `POST /releases/:version/refresh` should be resolved | S | P1 | `server/index.js` |
| 1.8 | **Add route-handler integration tests** -- test auth guards, validation, error paths for all 21 routes. Each requires auth setup, mock storage, and assertions | L | P1 | New: `__tests__/server/routes.test.js` |
| 1.9 | **Add JQL input sanitization (defense-in-depth)** -- validate outcome keys match OUTCOME_KEY_PATTERN before JQL interpolation in pipeline. This is defense-in-depth since CRUD validation and admin seed validation (item 0.2) already guard input | S | P1 | `pipeline.js` |
| 1.10 | **Automatic refresh retry** -- retry failed background refresh 1-2 times with backoff | S | P1 | `server/index.js` |
| 1.11 | **PM email normalization (defense-in-depth)** -- add `.toLowerCase()` in `isPM()` as defense-in-depth, even though `shared/server/auth.js` already normalizes `req.userEmail` in all auth paths | S | P2 | `pm-auth.js` |

### Phase 2: Performance & UX Polish (Next Quarter)

| # | Improvement | Effort | Priority | Files |
|---|-------------|--------|----------|-------|
| 2.1 | **Batch outcome queries** -- combine multiple outcome keys into single JQL `parent IN (...)` queries | M | P1 | `jira-client.js`, `pipeline.js` |
| 2.2 | **Split config into per-release files** -- reduce lock contention and I/O for multi-release setups. Note: the backup system (`config-backup.js`) currently backs up the single `config.json` file. The migration must also update the backup system to handle per-release files (back up individual release files, or create a composite backup archive). Include a migration strategy for existing backups | M | P1 | `config.js`, `config-backup.js` |
| 2.3 | **Optimistic reorder** -- update local state immediately on drag, revert on error | S | P2 | `DashboardView.vue`, `BigRocksTable.vue` |
| 2.4 | **Add Vue component tests** -- DashboardView, BigRocksTable, BigRockEditPanel | L | P1 | New test files |
| 2.5 | **Accessibility improvements** -- focus trap in modals, aria-labels on drag handles, table captions | M | P2 | Multiple components |
| 2.6 | **Pipeline partial-data warnings** -- accumulate warnings when Jira queries fail and surface in UI | M | P2 | `pipeline.js`, `server/index.js`, client |
| 2.7 | **Remove dead code** -- `batchFetchLinkedIssues`, `discoverCustomFields`, unused `useRockColors`, and `ImportDocDialog.vue` (never imported by any component) | S | P2 | `jira-client.js`, `useRockColors.js`, `ImportDocDialog.vue` |
| 2.8 | **Conditional caching (ETag)** -- add `ETag` header to candidates endpoint for efficient client polling | M | P2 | `server/index.js` |
| 2.9 | **`var` to `const`/`let` cleanup** -- normalize variable declarations across server files | S | P2 | Multiple server files |
| 2.10 | **`executeDocImport` replace mode write amplification** -- replace mode calls `deleteBigRock` N times, each doing a full read-write cycle. Consider a bulk-delete-then-bulk-add pattern to reduce I/O | S | P2 | `doc-import.js` |

### Phase 3: Future Capabilities (Illustrative -- Pending Product Owner Input)

> **Caveat:** The items below are illustrative possibilities, not planned work. There is no evidence from requirements or user feedback that these are needed. They are included to map out the design space, but none should be scheduled without explicit product owner prioritization.

| # | Improvement | Effort | Priority | Files |
|---|-------------|--------|----------|-------|
| 3.1 | **Audit log** -- record who changed what and when (Big Rock edits, imports, deletes) | M | P2 | New: `audit.js`, route handlers |
| 3.2 | **Per-release permissions** -- allow PMs to be assigned to specific releases | M | P2 | `pm-auth.js`, config schema |
| 3.3 | **Read-only role** -- separate from "no access"; currently all authenticated users can view | S | P2 | `server/index.js` |
| 3.4 | **Multi-replica support** -- distributed locking via Redis or advisory file locks | L | P2 | `config-lock.js` |
| 3.5 | **CSV export** -- in addition to Markdown, offer CSV for spreadsheet import | S | P2 | `DashboardView.vue` |
| 3.6 | **Webhook/event integration** -- notify external systems when Big Rocks change | M | P2 | New module |
| 3.7 | **Version comparison view** -- side-by-side diff of two releases' Big Rocks | L | P2 | New view |

---

## 10. Files Modified

Summary of all files that would be changed by the recommended improvements, organized by phase.

### Phase 0 (Critical Fixes)

| File | Change |
|------|--------|
| `modules/release-planning/client/views/DashboardView.vue` | Fix `.join()` on string in RFE markdown export (line 147) |
| `modules/release-planning/server/index.js` | Validate seed Big Rocks; wrap all 3 `decodeURIComponent` calls (lines 276, 356, 515); refactor `/permissions` to use canonical `isPM()` |
| `modules/release-planning/server/pm-auth.js` | Export `isPM()` for use by `/permissions` route |

### Phase 1 (Reliability & Quality)

| File | Change |
|------|--------|
| `modules/release-planning/server/index.js` | Per-version refresh state (with concurrency limit); refresh timeout; retry logic; gate `refresh=true` behind `requirePM` |
| `modules/release-planning/server/pipeline.js` | Assert outcome key format before JQL interpolation (defense-in-depth) |
| `modules/release-planning/server/pm-auth.js` | Add `.toLowerCase()` defense-in-depth in `isPM()` |
| `modules/release-planning/client/composables/useReleasePlanning.js` | Add refresh polling logic |
| `modules/release-planning/client/views/DashboardView.vue` | Clear error on context change; integrate refresh polling |
| `modules/release-planning/client/components/BigRocksTable.vue` | Extract shared row template |
| `modules/release-planning/client/components/FeaturesTable.vue` | Import shared PRIORITY_STYLES |
| `modules/release-planning/client/components/RfesTable.vue` | Import shared PRIORITY_STYLES |
| `modules/release-planning/__tests__/server/routes.test.js` | **New file** -- integration tests (L effort: 21 routes with auth setup, mock storage, assertions) |

### Phase 2 (Performance & Polish)

| File | Change |
|------|--------|
| `modules/release-planning/server/jira-client.js` | Batch outcome queries; remove dead code (`batchFetchLinkedIssues`, `discoverCustomFields`) |
| `modules/release-planning/server/pipeline.js` | Adapt to batched queries; add warning accumulation |
| `modules/release-planning/server/config.js` | Per-release file split (with backward compat) |
| `modules/release-planning/server/config-backup.js` | Update backup system for per-release file format |
| `modules/release-planning/server/doc-import.js` | Optimize replace-mode write amplification |
| `modules/release-planning/client/components/ImportDocDialog.vue` | **Delete** -- dead code, never imported |
| `modules/release-planning/client/composables/useRockColors.js` | Remove if unused (or document intent) |
| `modules/release-planning/__tests__/client/` | **New directory** -- Vue component tests |

---

## Appendix A: Architecture Diagram

```
Client (Vue 3 SPA)
  |
  |-- DashboardView.vue
  |     |-- useReleasePlanning() -----> GET /releases
  |     |-- useReleasePlanning() -----> GET /releases/:v/candidates
  |     |-- useBigRockEditor() -------> PUT /releases/:v/big-rocks/:name
  |     |-- loadPermissions() -------> GET /permissions (determines edit UI visibility)
  |     |-- useFilters() ------------> (client-side filtering)
  |     |
  |     |-- BigRocksTable.vue (drag-to-reorder)
  |     |-- FeaturesTable.vue (tier-grouped)
  |     |-- RfesTable.vue (tier-grouped)
  |     |-- FilterBar.vue
  |     |-- SummaryCards.vue
  |     |-- BigRockEditPanel.vue (slide-over)
  |     |-- BigRockDeleteDialog.vue (modal)
  |     |-- NewReleaseDialog.vue (modal + SmartSheet + Google Doc import)
  |
Server (Express, mounted at /api/modules/release-planning/)
  |
  |-- index.js (routes)
  |     |-- config.js (CRUD operations, config read/write)
  |     |-- validation.js (Big Rock field validation)
  |     |-- config-lock.js (in-process mutex)
  |     |-- config-backup.js (timestamped backups)
  |     |-- pm-auth.js (PM role middleware)
  |     |-- pipeline.js (3-tier Jira discovery)
  |     |-- jira-client.js (Jira field extraction, JQL builders)
  |     |-- doc-import.js (Google Doc import orchestration)
  |     |-- constants.js (status styles, column defs, cache TTL)
  |
  |-- Shared dependencies:
  |     |-- shared/server/jira.js (Jira HTTP client, auth, pagination)
  |     |-- shared/server/google-docs.js (Docs API auth, document parsing)
  |     |-- shared/server/smartsheet.js (SmartSheet API, release discovery)
  |     |-- shared/server/storage.js (filesystem read/write with path traversal protection)
  |     |-- shared/server/auth.js (admin auth, allowlist, proxy secret)
  |
Storage (filesystem, PVC-mounted)
  |
  |-- data/release-planning/config.json (all releases + Big Rocks)
  |-- data/release-planning/pm-users.json (PM email list)
  |-- data/release-planning/candidates-cache-{version}.json (per-release)
  |-- data/release-planning/config-backup-{timestamp}.json (max 10)
```

## Appendix B: Questions for Product Owner

Before proceeding with Phase 2 and Phase 3 work, the following questions should be answered:

1. **Scale expectations** -- How many concurrent releases will be active? This informs the priority of config splitting and per-version locking.
2. **Access control granularity** -- Is per-release PM assignment needed, or is a flat PM list sufficient?
3. **Audit requirements** -- Do PMs/EMs need to see who changed what and when? This would require an audit log feature.
4. **Integration plans** -- Are there plans to integrate with other modules (e.g., feature-traffic, ai-impact) or external systems beyond Jira?
5. **Export formats** -- Is CSV export needed alongside Markdown? What about integration with Google Sheets or Confluence?
6. **Multi-replica deployment** -- Is there a timeline for scaling beyond single-replica? This affects the locking strategy.
7. **CronJob coverage** -- The daily CronJob (`cronjob-sync-refresh.yaml`) currently triggers roster sync and metrics refresh but does NOT include release-planning data refresh. Should it? This would ensure pipeline caches are fresh each morning without manual intervention.

---

## Revision History

### Rev 2 -- 2026-04-23 (Post-Review Revision)

Revised based on feedback from three independent reviewers (code reviewer, DevOps reviewer, red team/adversarial reviewer). All critical and major findings were addressed.

**Critical findings addressed:**

| ID | Finding | Action Taken |
|----|---------|--------------|
| C1 | PM email case-sensitivity bug is not a real P0 -- `shared/server/auth.js` already lowercases `req.userEmail` in all auth paths | Demoted from P0 to P2 defense-in-depth (item 1.11). Updated section 2.1 description to explain why the bug cannot occur. |
| C2 | JQL injection severity overstated -- requires admin access, and OUTCOME_KEY_PATTERN already validates at CRUD time | Demoted JQL sanitization from P0 to P1 defense-in-depth (item 1.9). Promoted admin seed validation from P1 item 1.9 to P0 item 0.2. |
| C3 | `GET /permissions` has duplicate PM check bypassing `createRequirePM` | Added as new P0 item 0.4. Added to section 2.1 description. |
| C4 | `ImportDocDialog.vue` is dead code -- never imported anywhere | Removed items 2.3 and 2.4. Added to dead code removal list (item 2.7). Removed from architecture diagram. |
| C5 | RFE markdown export `.join()` on a string produces garbled output | Added as new P0 item 0.1. |
| C6 | Third `decodeURIComponent` at line 515 was missed | Updated item 0.3 and section 4.4 to include all three call sites (lines 276, 356, 515). |

**Major findings addressed:**

| ID | Finding | Action Taken |
|----|---------|--------------|
| M1 | Force-refresh "privilege escalation" label is misleading | Re-labeled to "authorization inconsistency", demoted from P0 to P1 (item 1.7). Updated section 4.3 description. |
| M2 | `closedList` construction count is 4, not 5 | Corrected to 4 (lines 193, 227, 263, 309). |
| M3 | Test count discrepancy | Verified: 205 `it()` blocks across 13 test files. Corrected from 203. |
| M4 | Route integration test effort underestimated | Re-estimated from M to L (21 routes, each requiring auth setup, mock storage, assertions). |
| M5 | Per-version refresh could cause Jira rate limit issues | Added concurrency limit note to item 1.1. |
| M6 | `isDirty` doesn't check name/fullName/pillar in edit mode | Documented as intentional -- these fields are read-only in the edit panel. Added explanation to section 6.1. |
| M7 | Phase 3 items are speculative | Added caveat that Phase 3 items are illustrative possibilities pending product owner input, not planned work. |

**Minor findings addressed:**

| ID | Finding | Action Taken |
|----|---------|--------------|
| m1 | Tier grouping composable extraction may be over-engineering | Removed from Phase 1 table. Added qualifying note in section 3.1 recommendations. |
| m2 | Architecture diagram omits `/permissions` endpoint | Added `loadPermissions() --> GET /permissions` to diagram. |
| m3 | Admin seed could cause vuedraggable duplicate key errors | Added as downstream consequence note in section 2.2. |
| m4 | `executeDocImport` replace mode has O(N) write amplification | Added as item 2.10. |

**DevOps findings addressed:**

| ID | Finding | Action Taken |
|----|---------|--------------|
| D1 | ARM Mac workaround omits `COPY fixtures/` | Added to deployability section as pre-existing gap. |
| D2 | Module health check should NOT be wired into k8s probes | Updated health check recommendation in section 5.2 and deployability section. |
| D3 | CronJob doesn't include release-planning refresh | Added to Appendix B question 7. |
| D4 | `fixtures/` path not in `build-images.yml` triggers | Added to deployability section as pre-existing gap. |
| D5 | Config split needs backup system migration strategy | Added migration note to item 2.2. |

**Item renumbering:** Phase 0 items 0.1-0.4 are completely new (old items moved to Phase 1). Phase 2 items renumbered after removing 2.3/2.4 and adding 2.10.
