# Consolidate IPA Registry and Org Roster into Single Data Source

**GitHub Issue**: #282
**Status**: Draft
**Date**: 2026-04-18

## Problem

Two overlapping data stores track people in the org:

| Aspect | Roster Sync (`org-roster-full.json`) | IPA Registry (`team-data/registry.json`) |
|---|---|---|
| **Built by** | `shared/server/roster-sync/index.js` | `modules/team-tracker/server/routes/ipa-registry.js` |
| **LDAP source** | Same IPA LDAP server | Same IPA LDAP server |
| **Config** | `data/roster-sync-config.json` | `data/team-data/config.json` |
| **Person schema** | Flat fields (`githubUsername`, `gitlabUsername`, `miroTeam`, etc.) | Structured fields (`github: {username, source}`, `status`, `firstSeenAt`, `lastSeenAt`, etc.) |
| **Extra data** | Google Sheets enrichment (team grouping, specialty, custom fields), username inference | Lifecycle tracking (active/inactive/purge), identity overrides (manual GitHub/GitLab), org trees, coverage stats |
| **Consumers** | Team Directory, metrics, trends, contributions, snapshots, export, anonymization | People Directory, person profiles, org explorer |

Both query the same IPA LDAP server. The unified sync (`POST /api/admin/roster-sync/unified`) already runs them sequentially and copies config between them.

## User Requirements

- **Target schema**: Keep `registry.json` format (richer schema with lifecycle, structured identities)
- **Migration strategy**: Hard cutover (no external consumers)
- **Config location**: `data/team-data/config.json` (consolidated)
- **UI**: `PeopleView.vue` is dead code (no imports). `PeopleDirectoryView.vue` is the active People page. No UI duplication to resolve beyond removing the dead file.

## Architecture Overview

### Current Data Flow

```
LDAP (IPA) ──┬── roster-sync/index.js ──> org-roster-full.json ──> deriveRoster() ──> /api/roster
             │     + Google Sheets                                    + metrics, trends, snapshots
             │     + username inference
             │
             └── ipa-registry.js ──────> team-data/registry.json ──> /registry/people, /registry/orgs
                   + lifecycle                                         + identity management
                   + coverage stats
```

### Target Data Flow

```
LDAP (IPA) ──> consolidated-sync ──> team-data/registry.json
                + Google Sheets           │
                + username inference      ├──> deriveRoster() ──> /api/roster + metrics, trends, snapshots
                + lifecycle               ├──> /registry/people, /registry/orgs
                + coverage stats          └──> identity management
```

## Detailed Design

### Phase 1: Merge Sync Pipelines

**Goal**: Single sync pipeline writes to `registry.json` with all data from both sources.

#### 1a. Extend IPA Registry Sync with Google Sheets Enrichment

The IPA registry sync (`runIpaSync` in `ipa-registry.js`) currently:
1. Connects to LDAP
2. Traverses org roots
3. Merges fresh people with existing (lifecycle tracking via `mergePerson`)
4. Writes `registry.json`

We need to add after step 2 and before step 3:
- Google Sheets fetch (from `shared/server/roster-sync/sheets.js`)
- Enrichment merge (from `shared/server/roster-sync/merge.js` `enrichPerson`)
- Username inference (from `shared/server/roster-sync/username-inference.js`)

**Key challenge**: The registry schema stores people as `{ uid: person }` map with structured `github: { username, source }` fields. The roster sync stores people nested under `orgs[orgKey].leader/members` with flat `githubUsername` string fields. The enrichment must apply _before_ `mergePerson` transforms flat LDAP fields into structured registry fields.

**Approach**:
1. After LDAP traversal, build a temporary roster-shaped structure (`{ orgs: { [orgKey]: { leader, members } } }`) from the LDAP results — same shape as the current `org-roster-full.json`. This temporary object is needed because both `enrichPerson` and `inferUsernames` expect this format.
2. Apply Google Sheets enrichment using existing `enrichPerson` from `merge.js` (mutates person objects in place on the temp roster).
3. Apply username inference using existing `inferUsernames` — this function iterates `roster.orgs` (line 204-206 of `username-inference.js`) and mutates `githubUsername`/`gitlabUsername` on person objects. It **cannot** be called with a registry-shaped `{ people: {} }` map. The temp roster solves this.
4. Run `mergePerson` for each person from the enriched temp roster (lifecycle tracking), which handles `githubUsername` -> `github: { username, source: 'ldap' }` conversion.
5. Apply enrichment fields **after** `mergePerson` — this is critical because `mergePerson` constructs a fixed-field object for new persons (lines 22-48 of `lifecycle.js`), which would drop any enrichment fields applied earlier. For existing persons, `Object.assign({}, existing)` preserves extra fields, but for new persons they'd be lost. Therefore: after `mergePerson`, copy enrichment fields (`_teamGrouping`, `specialty`, `engineeringSpeciality`, `customFields`, `additionalAssignments`, `sourceSheet`, etc.) from the enriched temp roster person onto the merged registry person record. Use a **deep copy** for nested objects to avoid aliasing bugs with `enrichPerson`'s in-place mutations and `mergePerson`'s shallow clone.

#### 1b. Add Enrichment Fields to Registry Person Schema

The registry person record (from `lifecycle.js` `mergePerson`) currently stores:
```
uid, name, email, title, city, country, geo, location, officeLocation,
costCenter, managerUid, orgRoot, github, gitlab, status, firstSeenAt,
lastSeenAt, inactiveSince
```

Add fields from Google Sheets enrichment:
```
_teamGrouping, miroTeam, specialty, engineeringSpeciality,
jiraComponent, customFields (dynamic), additionalAssignments,
sourceSheet
```

These should be stored as top-level fields on the person record, preserved across syncs unless overwritten by fresh sheet data. Enrichment fields are applied **after** `mergePerson` (see 1a step 5) — not via a new `mergePerson` parameter, but as a post-merge enrichment pass. For existing persons, stale enrichment fields from the previous sync are cleared before applying fresh enrichment, ensuring people who move teams don't retain old `_teamGrouping` values.

#### 1c. Consolidate Config

Currently two config files with overlapping `orgRoots` and `excludedTitles`:

| Field | `roster-sync-config.json` | `team-data/config.json` |
|---|---|---|
| `orgRoots` | `[{uid, name, displayName}]` | `[{uid, displayName?, name?}]` |
| `excludedTitles` | `[...]` | `[...]` |
| `googleSheetId` | yes | no |
| `sheetNames` | yes | no |
| `customFields` | yes | no |
| `teamStructure` | yes | no |
| `githubOrgs` | yes | no |
| `gitlabInstances` | yes | no |
| `gracePeriodDays` | no | yes (default 30) |
| `autoSync` | no | yes |

**Target**: Single config at `data/team-data/config.json` containing all fields from both.

**Files to modify**:
- `shared/server/roster-sync/config.js` — Change `CONFIG_KEY` from `'roster-sync-config.json'` to `'team-data/config.json'`. Add `gracePeriodDays` and `autoSync` fields to defaults.
- `modules/team-tracker/server/routes/ipa-registry.js` — Remove `IPA_CONFIG_KEY` and `loadIpaConfig`/`saveIpaConfig`; use shared config module.
- Add one-time migration in `loadConfig`: if `roster-sync-config.json` exists, merge its fields into `team-data/config.json`. The migration must be **idempotent** — use a `_migratedFrom` flag on the target config to skip on subsequent loads (set `_migratedFrom: 'roster-sync-config.json'` after first migration). This prevents concurrent API requests from triggering migration simultaneously. The old `roster-sync-config.json` is **never deleted** — it serves as a rollback safety net. Log `[config-migration] Merged roster-sync-config.json into team-data/config.json` when migration occurs so it's visible in pod logs.

#### Files Modified (Phase 1)

| File | Change |
|---|---|
| `shared/server/roster-sync/config.js` | Change CONFIG_KEY to `team-data/config.json`, add gracePeriodDays/autoSync defaults, add idempotent migration logic with guard flag |
| `shared/server/roster-sync/lifecycle.js` | No changes to `mergePerson` itself — enrichment applied as post-merge pass in `consolidated-sync.js` |
| `modules/team-tracker/server/routes/ipa-registry.js` | Replace `runIpaSync` with call to `runConsolidatedSync` from `consolidated-sync.js`. Remove `loadIpaConfig`/`saveIpaConfig`; use shared config. Remove `ipaSyncRunning` mutex (now in consolidated-sync). |
| `modules/team-tracker/server/index.js` | Update unified sync to call `runConsolidatedSync`. Remove `rosterSync.scheduleDaily()` calls (lines 1922, 2647) and `rosterSync.isSyncInProgress()` calls (lines 2031, 2071, 2425, 2571). Replace with consolidated sync's `isSyncInProgress()`. Update `POST /admin/roster-sync/config` to use **merge-based save** (see Config Save section). |

#### 1d. Architectural Decision: Sync Pipeline Location

**Concern**: Deleting `shared/server/roster-sync/index.js` and putting the consolidated sync in `modules/team-tracker/server/routes/ipa-registry.js` moves the only sync pipeline from `shared/` into a module. This violates the module isolation boundary — if `team-tracker` is disabled, no sync runs.

**Decision**: Replace `shared/server/roster-sync/index.js` with a new `shared/server/roster-sync/consolidated-sync.js` that contains the merged sync pipeline. The `ipa-registry.js` routes file calls this shared function rather than owning the pipeline itself. This preserves the architecture: sync logic lives in `shared/`, route handlers live in the module.

The consolidated sync function signature:
```js
// shared/server/roster-sync/consolidated-sync.js
async function runConsolidatedSync(storage) { ... }
```

This replaces both `runSync` (from the deleted `index.js`) and `runIpaSync` (from `ipa-registry.js`). The `ipa-registry.js` route handler becomes a thin wrapper that calls `runConsolidatedSync`.

#### 1e. Sync Mutex Consolidation

Three separate sync-in-progress mechanisms exist:
1. `syncInProgress` in `shared/server/roster-sync/index.js` (deleted)
2. `ipaSyncRunning` in `modules/team-tracker/server/routes/ipa-registry.js`
3. `unifiedSyncState.inProgress` in `modules/team-tracker/server/index.js`

**After consolidation**: A single `syncInProgress` flag in `consolidated-sync.js` with an exported `isSyncInProgress()` function. The unified sync state in `server/index.js` wraps this (it tracks phases for the multi-step unified sync which also includes metadata sync). Callers that currently check `rosterSync.isSyncInProgress()` or `isIpaSyncInProgress()` are updated to check the single flag.

#### Files Deleted (Phase 1)

| File | Reason |
|---|---|
| `shared/server/roster-sync/index.js` | Replaced by `consolidated-sync.js` |

#### Files Created (Phase 1)

| File | Reason |
|---|---|
| `shared/server/roster-sync/consolidated-sync.js` | Merged sync pipeline (LDAP + Sheets + lifecycle + username inference). Lives in `shared/` to preserve architecture. |

#### Files Unchanged (Phase 1)

| File | Reason |
|---|---|
| `shared/server/roster-sync/sheets.js` | Reused as-is by consolidated sync |
| `shared/server/roster-sync/merge.js` | `enrichPerson` reused as-is |
| `shared/server/roster-sync/username-inference.js` | Reused as-is (called with temp roster-shaped object) |
| `shared/server/roster-sync/ipa-client.js` | Reused as-is |
| `shared/server/roster-sync/constants.js` | Reused as-is |

### Phase 2: Migrate Consumers of `org-roster-full.json`

**Goal**: All code that reads `org-roster-full.json` reads from `registry.json` instead.

#### 2a. Adapt `shared/server/roster.js`

This is the central data access layer. Functions `readRosterFull`, `getAllPeople`, `getPeopleByOrg`, `getOrgKeys` all read `org-roster-full.json`.

**Approach**: Rewrite these functions to read from `registry.json` and transform on the fly.

The registry stores people as a flat `{ uid: person }` map. The roster stores them as nested `{ orgs: { [orgKey]: { leader, members } } }`. The transformation:

```js
function readRosterFull(storage) {
  const registry = storage.readFromStorage('team-data/registry.json');
  if (!registry || !registry.people) return null;

  // Build set of org root UIDs for leader identification
  const config = require('./roster-sync/config').loadConfig(storage);
  const orgRootUids = new Set((config?.orgRoots || []).map(r => r.uid));

  // Group by orgRoot
  const orgMap = {};
  for (const [uid, person] of Object.entries(registry.people)) {
    if (person.status !== 'active') continue;
    const orgKey = person.orgRoot || 'unknown';
    if (!orgMap[orgKey]) orgMap[orgKey] = { leader: null, members: [] };
    // Transform structured github/gitlab back to flat fields for compatibility
    const flat = {
      ...person,
      githubUsername: person.github?.username || null,
      gitlabUsername: person.gitlab?.username || null,
    };
    // Leader = person whose uid matches a configured orgRoot
    if (orgRootUids.has(uid)) {
      orgMap[orgKey].leader = flat;
    } else {
      orgMap[orgKey].members.push(flat);
    }
  }
  return { orgs: orgMap, generatedAt: registry.meta?.generatedAt, vp: registry.meta?.vp };
}
```

This preserves the `org-roster-full.json` shape so `deriveRoster()` and all downstream consumers work unchanged.

**Leader identification**: The `readRosterFull` transformation must identify the leader for each org. Approach: a person whose `uid` matches one of the configured `orgRoots[].uid` values is the leader for that org. This is correct because org roots in the config are always the manager UIDs themselves (verified: the current `ipaClient.traverseOrg()` takes a root UID and returns that person as `leader`). The config `orgRoots` are read via `getOrgDisplayNames(storage)` from the shared config module.

#### 2b. Update `deriveRoster()` in `modules/team-tracker/server/index.js`

`deriveRoster()` calls `readRosterFull()` — if 2a is done correctly, this works without changes. However, we should verify that enrichment fields (`_teamGrouping`, `specialty`, `customFields`, etc.) are correctly passed through the transformation.

#### 2c. Update `org-teams.js`

Two direct storage reads need updating:
1. **Line 462**: `readFromStorage('org-roster-full.json')` — checks if roster data exists before triggering initial org sync on startup. Update to read `team-data/registry.json` instead.
2. **Line 30**: `getSheetId()` does `readFromStorage('roster-sync-config.json')` with a **hardcoded path** bypassing the config abstraction. After config moves to `team-data/config.json`, this silently returns `null`, breaking team board metadata sync. Update to use `loadConfig(storage)` from the shared config module, or read from the new path.

#### 2d. Update Export/Anonymization

- `modules/team-tracker/server/export.js` — reads `org-roster-full.json` directly (line 68). Update to read via `readRosterFull(storage)` from shared roster module. **Also**: the `exportRosterSyncConfig` function (line 300) reads and exports `roster-sync-config.json` — update to read from `team-data/config.json`.
- `server/export.js` (the **orchestrator**, distinct from the module-level export) — line 33 reads `org-roster-full.json` directly for PII mapping via `buildMapping()`. Update to use `readRosterFull(storage)` from shared module. Without this fix, export gets `null` and all exported data becomes **unredacted, leaking PII**.
- `shared/server/anonymize.js` — receives roster data as a parameter (does NOT read storage directly). `buildMapping()` iterates `roster.orgs`, accesses `org.leader`/`org.members`, and reads flat `githubUsername`/`gitlabUsername`. The adapted `readRosterFull` produces this exact shape with flat fields, so `buildMapping` works unchanged.
- `server/must-gather.js` — reads `org-roster-full.json` directly (line 211). Update to use `readRosterFull(storage)` from shared module.

#### 2e. Update Tests

- `modules/team-tracker/__tests__/server/derive-roster-merge.test.js` — Mock data uses `org-roster-full.json` key. Update to use `team-data/registry.json` format.
- `modules/team-tracker/__tests__/server/org-sync.test.js` — Same.
- `modules/team-tracker/__tests__/server/export.test.js` — Same (includes export config path test).
- `server/__tests__/must-gather.test.js` — Same.
- `server/__tests__/export.test.js` — Separate file from the module-level export test; also needs mock data format update.
- `modules/team-tracker/__tests__/server/unified-sync.test.js` — Mocks `roster-sync` and `roster-sync/config`. Update mocks to reference `team-data/config.json` instead of `roster-sync-config.json`, and to use `consolidated-sync` instead of deleted `roster-sync/index`.

#### 2f. Create Demo Mode Fixture

**Critical**: Demo mode reads from `fixtures/` via `demo-storage.js`. After Phase 2, `readRosterFull()` reads `team-data/registry.json` — but no fixture exists at `fixtures/team-data/registry.json`. Demo mode will be **completely broken** without this.

Create `fixtures/team-data/registry.json` in the registry schema format, derived from the existing `fixtures/org-roster-full.json` data. The fixture must include:
- `meta`: `{ generatedAt, provider: 'demo', orgRoots, vp }`
- `people`: flat `{ uid: person }` map with structured `github`/`gitlab` fields, `status: 'active'`, lifecycle timestamps

This replaces `fixtures/org-roster-full.json` as the primary demo data source. The old fixture can remain until Phase 3 cleanup.

#### Files Modified (Phase 2)

| File | Change |
|---|---|
| `shared/server/roster.js` | Rewrite to read from `team-data/registry.json`, transform to roster format with leader identification |
| `modules/team-tracker/server/routes/org-teams.js` | Update line 462: read `team-data/registry.json` instead of `org-roster-full.json`. Update line 30: `getSheetId()` reads hardcoded `roster-sync-config.json` — use shared config module. |
| `modules/team-tracker/server/export.js` | Use `readRosterFull` from shared module (line 68); update `exportRosterSyncConfig` (line 300) to read from `team-data/config.json` |
| `server/export.js` | **Orchestrator** (distinct from module export): line 33 reads `org-roster-full.json` for PII mapping. Update to use `readRosterFull`. |
| `server/must-gather.js` | Use `readRosterFull` from shared module instead of direct `org-roster-full.json` read |
| `modules/team-tracker/__tests__/server/derive-roster-merge.test.js` | Update mock data format |
| `modules/team-tracker/__tests__/server/org-sync.test.js` | Update mock data format |
| `modules/team-tracker/__tests__/server/export.test.js` | Update mock data format + export config path |
| `server/__tests__/must-gather.test.js` | Update mock data format |
| `server/__tests__/export.test.js` | Update mock data format (separate file from module-level export test) |
| `modules/team-tracker/__tests__/server/unified-sync.test.js` | Update mocks for consolidated sync and config path |

#### Files Created (Phase 2)

| File | Reason |
|---|---|
| `fixtures/team-data/registry.json` | Demo mode fixture — required for `DEMO_MODE=true` to function |

### Phase 3: Cleanup

**Goal**: Remove dead code and data artifacts.

#### Files Deleted

| File | Reason |
|---|---|
| `modules/team-tracker/client/views/PeopleView.vue` | Dead code — not imported anywhere |
| `scripts/infer-gitlab-from-org.js` | Standalone script that directly reads/writes `org-roster-full.json`. Superseded by username inference in the consolidated sync pipeline. |
| `fixtures/org-roster-full.json` | Replaced by `fixtures/team-data/registry.json` (created in Phase 2) |

#### Files Modified

| File | Change |
|---|---|
| `modules/team-tracker/module.json` | Remove `org-roster-full.json` from `export.files` array (line 26) |
| `.claude/CLAUDE.md` | Update references to `org-roster-full.json` |
| `docs/DATA-FORMATS.md` | Update data format documentation |

### Phase 4: Settings UI Consolidation (Optional)

Currently the roster sync config and IPA config are managed through separate UI paths. Since the config is now unified, the settings UI should present a single configuration interface.

**Assessment**: The current `TeamTrackerSettings.vue` and `PeopleAndTeamsSettings.vue` don't directly reference IPA config. The IPA config endpoints (`/ipa/config`) are used by the PeopleDirectoryView for sync status. This is relatively low-risk UI work and could be done as a follow-up.

**Recommendation**: Defer to a follow-up PR. The backend consolidation is the high-value change.

## Config Save Clobbering Prevention

**Critical implementation detail**: The `POST /api/admin/roster-sync/config` handler (server/index.js lines 1883-1919) builds a new config object with only the roster-sync fields it knows about, then does a full `saveConfig(storage, config)` overwrite. After config consolidation, this would **clobber IPA-specific fields** (`gracePeriodDays`, `autoSync`) that the Settings UI doesn't manage.

**Fix required in Phase 1**: Change the config save handler to use a **merge-based approach** — load the existing config, update only the fields sent in the request body, and write back the merged result. The IPA config POST handler (`ipa-registry.js:187-196`) already does this correctly (only updates specific fields). The roster sync config handler must be updated to match this pattern.

Alternatively, the `saveConfig` function in `config.js` could be changed to merge rather than overwrite, but this is riskier since it changes the semantics for all callers.

## API Impact

### Unchanged APIs (backward compatible)

| Endpoint | Notes |
|---|---|
| `GET /api/roster` | `deriveRoster()` output unchanged — reads through adapted `readRosterFull()` |
| `GET /api/team/:teamKey/metrics` | Uses `deriveRoster()` |
| `GET /api/person/:name/metrics` | Uses `deriveRoster()` |
| `GET /api/people/metrics` | Uses `deriveRoster()` |
| `GET /api/trends` | Uses `deriveRoster()` |
| All `/registry/*` endpoints | Already read from `registry.json` |
| `GET /api/admin/roster-sync/config` | Config location changes but API shape stays same |
| `POST /api/admin/roster-sync/config` | Same |
| `GET /api/admin/roster-sync/status` | Same |

### Modified APIs

| Endpoint | Change |
|---|---|
| `POST /api/admin/roster-sync/trigger` | Now triggers consolidated sync (LDAP + Sheets + lifecycle), not just roster-only sync. Same request/response shape. The production cronjob calls this endpoint — no cronjob change needed. |
| `POST /api/admin/roster-sync/unified` | Simplified — single-phase sync instead of 3-phase (roster + metadata + IPA). Metadata sync (Phase 2) still runs separately since it's org-teams, not people. |
| `POST /api/modules/team-tracker/ipa/sync` | May become an alias for the consolidated sync, or be removed |

## Testing Strategy

### Phase 1 Testing
- Unit test the extended `mergePerson` with enrichment fields
- Unit test that Google Sheets enrichment applies correctly in the consolidated sync
- Integration test: run consolidated sync with mocked LDAP + Sheets, verify `registry.json` contains all expected fields
- Verify config migration (old `roster-sync-config.json` → new `team-data/config.json`)

### Phase 2 Testing
- Unit test the adapted `readRosterFull` — verify it produces identical output shape from `registry.json` as the old code did from `org-roster-full.json`
- Run existing `deriveRoster` tests against new data path
- Run export/anonymization tests with updated mock data
- End-to-end: verify `/api/roster` response is unchanged

### Phase 3 Testing
- Verify dead code removal doesn't break imports
- Run full test suite

## Deployment Considerations

- **Data migration**: First deploy writes `registry.json` with enriched data. Old `org-roster-full.json` becomes stale but isn't deleted automatically. The adapted `readRosterFull` reads from `registry.json` immediately.
- **Config migration**: On first pod startup after deploy, if `roster-sync-config.json` exists, merge its fields into `team-data/config.json`. The migration is idempotent (safe to run on every startup). The old `roster-sync-config.json` is **never deleted** — it remains on the PVC as a rollback safety net. A log line is emitted when migration occurs.
- **Rollback**: If issues arise, revert the code. The old `org-roster-full.json` will still exist on the PVC. The old `roster-sync-config.json` won't be deleted. **After rollback, a manual sync trigger is needed** to regenerate the stale `org-roster-full.json` — it will not have been updated since the consolidation deploy.
- **CronJob**: The daily cronjob (`cronjob-sync-refresh.yaml`) calls `POST /api/admin/roster-sync/trigger` (Step 1, line 49). After consolidation, `/trigger` invokes the consolidated sync pipeline (LDAP + Sheets + lifecycle). No cronjob manifest change is needed — the endpoint continues to work, it just runs the consolidated pipeline instead of the old roster-only sync.
- **Dockerfile / Images**: No Dockerfile changes needed. `deploy/backend.Dockerfile` already copies `server/`, `shared/server/`, and `modules/` — all paths touched by this plan.
- **Kustomize overlays**: No overlay changes needed. No new env vars, secrets, or ConfigMap changes. The `team-data/` subdirectory already exists at runtime.

### Environment Parity

- **Local dev**: Config migration works identically (reads from `./data/`). Demo mode requires the new `fixtures/team-data/registry.json` fixture (created in Phase 2).
- **Dev overlay**: No admin emails set, first-user auto-add still works — no impact.
- **Preprod overlay**: Uses same image as prod — config migration runs identically.
- **Prod overlay**: Config migration runs on first pod startup after deploy. Daily cronjob continues to call `/trigger` unchanged.

## Ordering Constraints

**Phase 1 must complete before Phase 2**: After Phase 2, `getAllPeople(storage)` (used by `ipa-registry.js:233` for team assignments in `/registry/people`) will read from `registry.json` via the adapted `readRosterFull`. This only works if Phase 1 has already added enrichment fields (`_teamGrouping`, `miroTeam`) to registry person records. If Phase 2 ships without Phase 1, the team assignments in `/registry/people` responses will be empty. **Recommendation**: Ship Phase 1 and Phase 2 in the same PR to avoid this window.

## Risk Assessment

| Risk | Mitigation |
|---|---|
| `deriveRoster()` output changes subtly | Write snapshot test comparing old vs new output for same input data |
| Config migration loses fields | Migration copies all fields; old file preserved as backup |
| Lifecycle tracking breaks existing registry data | `mergePerson` is additive; new fields won't corrupt existing records |
| Enrichment fields dropped for new persons | Apply enrichment AFTER `mergePerson`, not before (see 1a step 5) |
| Config save clobbers IPA fields | Change roster config save to merge-based approach (see Config Save section) |
| Dual schedulers after deletion of `roster-sync/index.js` | Remove `scheduleDaily` calls; consolidated-sync owns the single scheduler |
| `enrichPerson` mutation aliasing with `mergePerson` shallow clone | Deep-copy enrichment fields when copying from temp roster to registry person (see 1a step 5) |
| Concurrent config migration on first startup | Use `_migratedFrom` guard flag in config to ensure single execution |
| PII leak via export if `server/export.js` not updated | Listed as explicit Phase 2 file; `readRosterFull` adapter produces compatible shape for `buildMapping` |

## Implementation Order

1. **Phase 1 + Phase 2** (1 PR): Consolidate sync pipeline + config + migrate consumers. These must ship together to avoid a window where team assignments break in `/registry/people` (see Ordering Constraints).
2. **Phase 3** (1 PR): Cleanup dead code, delete `scripts/infer-gitlab-from-org.js`, update docs.
3. **Phase 4** (future PR): Settings UI consolidation if needed.

## UX Considerations

No significant UI changes are required. The People Directory (`PeopleDirectoryView.vue`) already reads from the registry. The Team Directory reads via `deriveRoster()` which will be adapted transparently. The dead `PeopleView.vue` should be deleted.

A UX teammate is **not needed** for this work.
