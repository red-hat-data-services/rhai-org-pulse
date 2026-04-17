# Sync UX Improvement — Implementation Plan

## Overview

This plan implements the four user stories from `docs/plans/sync-ux-user-stories.md`:
1. **US-1**: Unified sync action for org/team/people structure
2. **US-2**: Banner prompting sync after config changes
3. **US-3**: Unified sync status across data sources
4. **US-4**: Clear settings tab organization

## Design Decisions

Based on requirements clarification:

- **Sync panel location**: Top-level panel above settings tabs, always visible
- **Tab restructure**: Full restructure/rename is allowed — recommendation below
- **Sync execution**: Sequential (roster sync first, then org metadata sync)
- **Progress feedback**: Granular phase progress via polling (Phase 1/2, Phase 2/2)
- **Banner triggers**: Only structure-affecting config saves (org roots, sheet ID, org name mappings, column mappings) — not UI-only settings like custom field display options
- **Banner scope**: Settings page only
- **Staleness warning**: 48-hour threshold

---

## Tab Restructure Recommendation

**Current tabs**: Roster Sync | Team Structure | Jira Sync | Snapshots

**Proposed tabs**: People & Teams | Jira Sync | Snapshots

Rationale:
- The current "Roster Sync" and "Team Structure" tabs both configure the same pipeline (LDAP people + Sheets enrichment/team grouping). Splitting them creates confusion about what to configure where.
- Consolidating into **"People & Teams"** groups all directory-related config (org roots, Google Sheets integration, column mappings, org name mappings) in one place.
- The sync controls themselves move **above the tabs** into a persistent sync status panel (US-1/US-3), so neither tab needs its own sync button.
- Jira Sync and Snapshots stay as-is — they're clearly separate concerns.

### People & Teams tab layout

Sections within the consolidated tab, in order:
1. **Org Roots** — LDAP org leaders to traverse (from current Roster Sync)
2. **Google Sheets Integration** — Sheet ID, sheet picker (from current Team Structure)
3. **Column Mappings** — Name column, team grouping column (from current Team Structure)
4. **Custom Fields** — Custom field definitions and display settings (from current Team Structure)
5. **Org Name Mapping** — Sheet-to-configured org mapping (from current Team Structure)
6. **Username Inference** — GitHub orgs, GitLab instances (from current Roster Sync)
7. **Save Configuration** button

---

## Architecture

### Backend: Unified Sync Endpoint

A new `POST /api/admin/roster-sync/unified` endpoint orchestrates both syncs sequentially and tracks phase progress.

**Sync phases:**
1. `roster` — LDAP + Google Sheets people sync (existing `rosterSync.runSync()` from `shared/server/roster-sync/index.js`)
2. `metadata` — Org metadata sync: team boards, components, board names, **plus RFE backlog refresh** (existing `orgSync.runSync()` from `modules/team-tracker/server/org-sync.js`, followed by `fetchAllRfeBacklog()` — matching the standalone `/org-sync/trigger` behavior)

**Concurrency control:**
- The unified endpoint maintains its own `unifiedSyncInProgress` flag, **separate from** the individual `syncInProgress` (roster) and `orgSyncInProgress` (metadata) flags
- This is critical because `rosterSync.runSync()` resets its `syncInProgress` to `false` in its `finally` block — without a top-level flag, the status endpoint would briefly report "not syncing" between phases
- The unified handler sets `unifiedSyncInProgress = true` before starting, and only resets it to `false` after both phases complete (or on error)
- The status endpoint checks `unifiedSyncInProgress` first: if true, reports `syncing: true` with the current phase, regardless of individual flag states
- Individual sync triggers (`/trigger` and `/org-sync/trigger`) should check `unifiedSyncInProgress` and return 409 if a unified sync is running, to prevent conflicts
- The unified endpoint's pre-flight guard must also check `orgSyncInProgress` (via exported `isOrgSyncInProgress()`) before starting — if the 5-minute startup timer or daily timer is mid-org-sync, the unified endpoint returns 409 rather than risk concurrent writes to `org-roster/teams-metadata.json`

**Phase tracking:**
- Phase tracking (`currentPhase`, `phaseLabel`) lives entirely in the unified endpoint handler in `modules/team-tracker/server/index.js` — **not** in `shared/server/roster-sync/index.js`. The individual sync functions don't need to know about phases.
- Exposed via the existing `GET /api/admin/roster-sync/status` endpoint (extended response)
- Note: In-memory phase tracking assumes **single-replica** backend deployment (current architecture: `replicas: 1`, `Recreate` strategy). If the backend ever scales to multiple replicas, phase tracking would need to move to filesystem-based storage.

**Demo mode:**
- In `DEMO_MODE`, the unified endpoint returns `{ status: 'skipped', message: 'Sync disabled in demo mode' }` without running any sync, consistent with how other sync endpoints behave in demo mode.
- **Important**: The shell-level demo mode blocker in `dev-server.js` only catches POST paths containing "refresh". The `/admin/roster-sync/unified` path does NOT contain "refresh", so the handler **must have its own explicit `DEMO_MODE` check** at the top of the handler. This must have a dedicated test case to prevent regression.

**Route mounting:**
- The unified endpoint is registered in `modules/team-tracker/server/index.js` as `router.post('/admin/roster-sync/unified', ...)`, which resolves to `/api/modules/team-tracker/admin/roster-sync/unified`
- The existing legacy forward `app.use('/api/admin/roster-sync', ...)` in `dev-server.js` covers all sub-paths, so the endpoint is also accessible at `/api/admin/roster-sync/unified` — no additional forwarding needed

### Backend: Extended Status Endpoint

The existing `GET /api/admin/roster-sync/status` response is extended. Data sources for the response:
- **Roster sync status**: Read from `roster-sync-config.json` via `rosterSyncConfig.loadConfig(storage)` (fields: `lastSyncAt`, `lastSyncStatus`, `lastSyncError`)
- **Metadata sync status**: Read from `org-roster/sync-status.json` via `storage.readFromStorage()` (fields: `lastSyncAt`, `status`, `error`, `teamCount`, `componentCount`)
- **Syncing/phase**: From in-memory `unifiedSyncInProgress` and `currentPhase` variables
- **Note**: The status endpoint reads from two files sequentially. If a sync completes between reads, the response may show a briefly inconsistent state (e.g., roster showing "syncing" while metadata shows a completed timestamp). This is a negligible race window and self-corrects on the next poll.

```json
{
  "syncing": false,
  "phase": null,
  "phaseLabel": null,
  "phases": ["roster", "metadata"],
  "rosterSync": {
    "lastSyncAt": "2026-04-15T10:00:00Z",
    "lastSyncStatus": "success",
    "lastSyncError": null
  },
  "metadataSync": {
    "lastSyncAt": "2026-04-15T10:05:00Z",
    "status": "success",
    "error": null,
    "teamCount": 42,
    "componentCount": 15
  },
  "stale": {
    "roster": false,
    "metadata": true
  }
}
```

When syncing:
```json
{
  "syncing": true,
  "phase": "roster",
  "phaseLabel": "Syncing people (LDAP + Sheets)...",
  "phases": ["roster", "metadata"],
  ...
}
```

### Frontend: New Components

1. **`SyncStatusPanel.vue`** — Top-level sync panel above tabs
   - Shows combined sync status (last sync times for both, staleness warnings)
   - "Sync People & Teams" button that calls unified endpoint
   - Phase progress indicator during sync
   - "Sync needed" banner (US-2) when `configDirty` flag is set

2. **`PeopleAndTeamsSettings.vue`** — Consolidated tab replacing Roster Sync + Team Structure
   - Merges content from `RosterSyncSettings.vue` and `TeamStructureSettings.vue`
   - Removes individual sync buttons (moved to SyncStatusPanel)
   - Emits `config-saved` event with metadata about which fields changed

### Frontend: State Management

A new composable `useSyncStatus.js` manages:
- Combined sync status polling
- `configDirty` flag for the "sync needed" banner
- Phase progress tracking during active sync

---

## Backward Compatibility

### Preserved endpoints (no changes):
- `POST /api/admin/roster-sync/trigger` — still triggers roster-only sync
- `POST /api/modules/team-tracker/org-sync/trigger` — still triggers metadata-only sync
- `GET /api/admin/roster-sync/config` — unchanged
- `POST /api/admin/roster-sync/config` — unchanged
- `GET /api/modules/team-tracker/org-sync/status` — unchanged
- `GET /api/modules/team-tracker/org-config` — unchanged
- `POST /api/modules/team-tracker/org-config` — unchanged

### Extended endpoints:
- `GET /api/admin/roster-sync/status` — response gains new fields (`phase`, `phaseLabel`, `metadataSync`, `stale`), all additive

### New endpoints:
- `POST /api/admin/roster-sync/unified` — unified sync trigger (also accessible at `/api/modules/team-tracker/admin/roster-sync/unified` via direct module path; both paths require admin auth via `requireAdmin` middleware)

### Daily CronJob
The existing daily cron (`deploy/openshift/overlays/prod/cronjob-sync-refresh.yaml`) calls `POST /api/admin/roster-sync/trigger` then metrics refresh. No changes needed — the cron handles roster sync; the org metadata sync runs on its own 24h timer inside the server process.

> **Important distinction**: The CronJob's pipeline is: roster sync → Jira/GitHub/GitLab **metrics** refresh. The new unified endpoint's pipeline is: roster sync → **org metadata** sync (team boards, components). These are different second steps. Do **not** update the CronJob to call `/unified` — it would lose the metrics refresh step. If both are ever needed in the CronJob, call `/unified` then `/refresh` separately.

---

## Phased Implementation

### Phase 1: Backend — Unified Sync & Extended Status

**Files modified:**

| File | Change |
|------|--------|
| `modules/team-tracker/server/routes/org-teams.js` | Extract `triggerOrgSync()` helper (from POST handler) for reuse; both standalone trigger and daily timer use this shared function to coordinate the `orgSyncInProgress` flag |
| `modules/team-tracker/server/index.js` | Register new unified sync route with own `unifiedSyncInProgress` flag and phase tracking; extend status route response |

**Details:**

1. In `modules/team-tracker/server/routes/org-teams.js`, restructure for reusability:
   - `orgSyncInProgress` is declared at module scope (line 13, **outside** the `registerOrgTeamsRoutes` function), so it's accessible for export
   - Extract the sync logic from the `POST /org-sync/trigger` handler into a standalone `async function triggerOrgSync(storage)` at module scope that:
     - Checks and sets `orgSyncInProgress` (returns early if already in progress)
     - Reads sheet ID and org config from storage
     - Calls `runSync(storage, sheetId, config)`
     - Runs `fetchAllRfeBacklog()` afterward (matching current standalone behavior)
     - Resets `orgSyncInProgress` in `finally`
   - The function needs `storage` passed as a parameter since it's originally a closure variable from the `registerOrgTeamsRoutes` context. `buildEnrichedTeams` and other closure-dependent helpers should also be passed or extracted.
   - Alternative simpler approach: keep `triggerOrgSync` inside `registerOrgTeamsRoutes` but assign it to a module-level variable that gets exported (e.g., `module.exports.triggerOrgSync = triggerOrgSync` after the function is defined inside the register call)
   - Both the standalone `POST /org-sync/trigger` handler and the daily timer use this shared function
   - Also export `isOrgSyncInProgress()` for the unified endpoint's pre-flight check

2. In `modules/team-tracker/server/index.js`, add:
   - Module-level state: `unifiedSyncInProgress`, `currentPhase`, `phaseLabel`
   - `POST /admin/roster-sync/unified` handler that:
     - Guards: checks `unifiedSyncInProgress`, `rosterSync.isSyncInProgress()`, and `orgSyncInProgress` — returns 409 if any are true
     - Sets `unifiedSyncInProgress = true`
     - Phase 1: Sets `currentPhase = 'roster'`, `phaseLabel = 'Syncing people (LDAP + Sheets)...'`, calls `rosterSync.runSync(storage)`. **Must check return value** — if `result.status === 'skipped'` (concurrent sync) or `result.status === 'error'`, records the error and **skips Phase 2** (metadata sync on stale people data would produce inconsistent results)
     - Phase 2 (only if Phase 1 succeeded): Sets `currentPhase = 'metadata'`, `phaseLabel = 'Syncing team metadata...'`, calls extracted `triggerOrgSync(storage)` (which includes RFE refresh)
     - Resets `unifiedSyncInProgress = false` and clears phase in `finally`
     - Returns `{ status: 'started' }` immediately (async execution)
   - Extend `GET /admin/roster-sync/status` to:
     - Check `unifiedSyncInProgress` first — if true, report `syncing: true` with current phase
     - Include metadata sync status (read from `org-roster/sync-status.json`)
     - Compute staleness (48h threshold) for both roster and metadata

**No changes to `shared/server/roster-sync/index.js`** — phase tracking is entirely in the unified handler, not in the shared sync module.

**Testing:**
- Unit test for unified sync orchestration (mock both `runSync` functions)
- Unit test for extended status response shape
- Manual test: trigger unified sync via curl, verify sequential execution and status polling

### Phase 2: Frontend — Sync Status Panel & Composable

**Files modified:**

| File | Change |
|------|--------|
| `modules/team-tracker/client/composables/useSyncStatus.js` | **New** — composable for unified sync status, phase tracking, configDirty flag |
| `modules/team-tracker/client/components/SyncStatusPanel.vue` | **New** — top-level sync panel with status, progress, and banner |
| `modules/team-tracker/client/components/TeamTrackerSettings.vue` | Add SyncStatusPanel above tabs; wire `config-saved` event |
| `shared/client/services/api.js` | Add `triggerUnifiedSync()` and `getUnifiedSyncStatus()` API functions |

**Details:**

1. `useSyncStatus.js` composable:
   - `fetchStatus()` — calls extended status endpoint, computes staleness
   - `triggerUnifiedSync()` — calls unified endpoint, starts polling for phase updates at **3-second intervals** (matching existing `useRosterSync` polling pattern). Polls **as long as the status endpoint reports `syncing: true`**, with a **15-minute safety ceiling** (unified sync can take 7+ minutes: ~4 min roster + ~3 min metadata). No false "timed out" errors while sync is genuinely running.
   - `configDirty` ref — set to true when config is saved, cleared after successful sync. **Persisted to `sessionStorage`** so it survives page navigation and browser refresh within the same session. On mount, the composable checks sessionStorage for a stored `configDirty` flag. As a fallback, the status endpoint's `stale` fields provide a server-side signal if staleness exceeds 48h.
   - `currentPhase`, `phaseLabel` refs — updated during polling

2. `SyncStatusPanel.vue`:
   - Shows last sync times for roster and metadata (with relative time formatting)
   - Staleness warning badges (amber "Stale" badge if >48h)
   - **"Sync People & Teams"** button (not "Sync All" — that could imply Jira/GitHub/GitLab sync too) with phase progress (e.g., "Step 1/2: Syncing people...")
   - Conditional banner: "Configuration saved. Sync needed for changes to take effect." with "Sync Now" button. Dismissible via X button.
   - The banner appears when `configDirty` is true and clears after sync completes

3. `TeamTrackerSettings.vue`:
   - Import and render `SyncStatusPanel` above the tab bar
   - Listen for `config-saved` events from child tabs to set `configDirty`

### Phase 3: Frontend — Tab Consolidation

**Files modified:**

| File | Change |
|------|--------|
| `modules/team-tracker/client/components/PeopleAndTeamsSettings.vue` | **New** — consolidated tab merging Roster Sync + Team Structure |
| `modules/team-tracker/client/components/TeamTrackerSettings.vue` | Replace Roster Sync + Team Structure tabs with single People & Teams tab |
| `modules/team-tracker/client/components/RosterSyncSettings.vue` | **Deleted** (content moved to PeopleAndTeamsSettings) |
| `modules/team-tracker/client/components/TeamStructureSettings.vue` | **Deleted** (content moved to PeopleAndTeamsSettings) |

**Details:**

1. `PeopleAndTeamsSettings.vue`:
   - Combines all sections from both tabs in the order specified above
   - **Composable dependencies**: Imports both `useRosterSync` (for config load/save, sync trigger, sheet discovery) and `useOrgRoster` (for `loadSheetOrgs()`, `loadConfiguredOrgs()`, `loadConfig()`, `saveConfig()` for org name mapping)
   - Single "Save Configuration" button that saves both roster-sync-config and org-config in one action
   - **Dual-save error handling**: Saves org-config first, then roster-sync-config (matching current `TeamStructureSettings.vue` order). If org-config save succeeds but roster-sync-config fails, the error message reports which save failed (e.g., "Roster sync config save failed: ..."). On partial failure, **re-fetches both configs** to repopulate the form with the actual persisted state, so the form accurately reflects what was saved vs. what wasn't.
   - Emits `config-saved` with a `{ structureAffecting: boolean }` payload
   - `structureAffecting` is true when org roots, sheet ID, column mappings, or org name mappings changed; false for display-only changes (custom field visibility, primary display)

2. `TeamTrackerSettings.vue`:
   - Tab list changes from 4 tabs to 3: `People & Teams | Jira Sync | Snapshots`
   - Import PeopleAndTeamsSettings instead of RosterSyncSettings + TeamStructureSettings
   - Remove old tab IDs, default to `people-teams`

3. Delete `RosterSyncSettings.vue` and `TeamStructureSettings.vue`

### Phase 4: Polish & Testing

**Files modified:**

| File | Change |
|------|--------|
| `modules/team-tracker/__tests__/client/SyncStatusPanel.test.js` | **New** — tests for sync panel rendering, phase progress, banner behavior |
| `modules/team-tracker/__tests__/client/PeopleAndTeamsSettings.test.js` | **New** — tests for consolidated settings tab |
| `modules/team-tracker/__tests__/server/unified-sync.test.js` | **New** — tests for unified sync endpoint (including demo mode bypass, return value checking, concurrency guards) |

---

## Files Modified Summary

| File | Action | Phase |
|------|--------|-------|
| `modules/team-tracker/server/routes/org-teams.js` | Modify | 1 |
| `modules/team-tracker/server/index.js` | Modify | 1 |
| `shared/client/services/api.js` | Modify | 2 |
| `modules/team-tracker/client/composables/useSyncStatus.js` | Create | 2 |
| `modules/team-tracker/client/components/SyncStatusPanel.vue` | Create | 2 |
| `modules/team-tracker/client/components/TeamTrackerSettings.vue` | Modify | 2, 3 |
| `modules/team-tracker/client/components/PeopleAndTeamsSettings.vue` | Create | 3 |
| `modules/team-tracker/client/components/RosterSyncSettings.vue` | Delete | 3 |
| `modules/team-tracker/client/components/TeamStructureSettings.vue` | Delete | 3 |
| `modules/team-tracker/__tests__/client/SyncStatusPanel.test.js` | Create | 4 |
| `modules/team-tracker/__tests__/client/PeopleAndTeamsSettings.test.js` | Create | 4 |
| `modules/team-tracker/__tests__/server/unified-sync.test.js` | Create | 4 |

---

## Testability & Deployability

### Local testing
- `npm run dev:full` starts both frontend and backend
- Roster sync requires VPN (LDAP). Without VPN, test with `DEMO_MODE=true` (fixture data) or mock LDAP responses
- Org metadata sync requires `GOOGLE_SERVICE_ACCOUNT_KEY_FILE`. Without it, the sync will skip Sheets fetching
- UI changes can be verified without credentials by focusing on component rendering, banner state, and phase display logic
- Unit tests cover: sync orchestration, status response shape, banner trigger logic, phase progress rendering

### Preprod testing
- Deploy to preprod overlay (`:latest` tag) via normal PR merge flow
- Verify unified sync runs both phases in sequence
- Verify status endpoint returns combined status
- Verify staleness detection with real data
- Verify banner appears after config save and clears after sync

### Production testing
- Deploy via normal prod flow (image SHA pinning via CI)
- The daily cron continues to work unchanged (calls existing roster sync endpoint)
- No data migration needed — reads existing data files
- Backward-compatible: all existing API endpoints preserved

### Rollback
- No database migrations or data format changes
- Rollback = revert the image tag in prod overlay
- Existing `roster-sync-config.json` and `org-roster/sync-status.json` remain compatible

### Deployment checklist
- After merging to main, verify the `build-images` workflow triggers both backend and frontend builds (path triggers already cover `shared/server/`, `modules/*/server/`, `modules/*/client/`)
- In preprod, verify the daily CronJob still works correctly (existing endpoints preserved)
- Verify the extended status endpoint doesn't break CronJob status polling (the `grep -o '"syncing":true'` pattern still matches since the field is preserved)
- No new ConfigMap keys, secrets, or volumes required — no kustomize changes needed

---

## Existing Tests Impact

**No existing tests reference `RosterSyncSettings` or `TeamStructureSettings`** — verified via grep across `__tests__/` and `*.test.*` files. The Phase 3 deletions are clean with no test breakage.

**CI safety for phased merging**: If phases are merged as separate PRs, Phase 3 (delete old components) and Phase 4 (add new tests) should be merged together or Phase 4 first, to avoid a CI gap where deleted components have no replacement tests. Recommended approach: merge Phases 3+4 as a single PR.

---

## Recommendation: Spawn UX Teammate

**Yes, recommend spawning a UX teammate** for Phase 2 and Phase 3. The UX teammate should:
- Review the SyncStatusPanel layout and phase progress UX
- Review the consolidated PeopleAndTeamsSettings section ordering and grouping
- Review the "sync needed" banner design (copy, placement, dismissal behavior)
- Ensure the tab rename from 4 tabs to 3 tabs is intuitive
- Review staleness warning visual treatment

---

## Open Questions (resolved)

1. ~~Sync button placement~~ → Top-level panel above tabs
2. ~~Tab structure~~ → Consolidate Roster Sync + Team Structure into "People & Teams"
3. ~~Sync order~~ → Sequential (roster then metadata)
4. ~~Banner triggers~~ → Structure-affecting saves only
5. ~~Progress granularity~~ → Granular phase progress via polling
6. ~~Staleness threshold~~ → 48 hours
7. ~~Banner scope~~ → Settings page only
