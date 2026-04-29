# Team Grouping Column — Implementation Plan

## Problem Statement

On the current `preprod` branch (absorbed into `fix/team-grouping-column`), the team
directory (`/org-teams` API) gets its team list exclusively from `teams-metadata.json`,
which is populated from a hardcoded "Scrum Team Boards" spreadsheet tab. People's team
assignments come from the `_teamGrouping` field (set via the "team grouping column"
during roster sync from per-org people tabs). When these two sources don't align — e.g.,
the "Scrum Team Boards" tab doesn't list all teams, or doesn't exist at all — teams
appear empty or are entirely absent from the directory.

The `main` branch solved this with a `deriveTeamsFromPeople()` fallback and by making
the team-boards tab optional. This logic was never ported to the current codebase.

## Root Cause Analysis

### What works (same on both branches)
- **Settings UI**: `PeopleAndTeamsSettings.vue` (current) has the same Name Column and
  Team Grouping Column inputs as `TeamStructureSettings.vue` (main).
- **Config storage**: `roster-sync-config.json` stores `teamStructure.nameColumn` and
  `teamStructure.teamGroupingColumn` identically.
- **Sheet parsing**: `shared/server/roster-sync/sheets.js` correctly reads these columns
  and stores `_teamGrouping` on each person via `getEffectiveColumnsFromTeamStructure()`.
- **Backend validation**: `modules/team-tracker/server/index.js` validates and saves
  `teamStructure` config correctly (lines 1795-1861).

### What's broken (current branch vs main)

| Area | Current branch (`org-sync.js`) | Main branch (`org-roster/server/sync.js`) |
|------|-------------------------------|------------------------------------------|
| `teamBoardsTab` default | `'Scrum Team Boards'` (hardcoded) | `null` (optional) |
| `componentsTab` default | `'Summary: components per team'` (hardcoded) | `null` (optional) |
| Team derivation fallback | **None** — if sheet tab fails or has no teams, result is empty | `deriveTeamsFromPeople()` builds teams from `_teamGrouping` values in roster |
| Tab fetch error handling | Throws and aborts sync | `try/catch` — logs warning and falls through to derivation |
| Board name resolution | Always attempted | Only if any team has board URLs |
| `getOrgConfig()` defaults | `teamBoardsTab: 'Scrum Team Boards'` | `teamBoardsTab: ''` (empty string) |
| `triggerOrgSync()` | Gates on `sheetId` — skips entirely if no sheet | Should allow sync without sheet (for people-derived teams) |
| Read-time fallback | `buildEnrichedTeams()` returns empty if `teams-metadata.json` missing | Same — relies on sync having run |

## Implementation Plan

### Step 1: Add `deriveTeamsFromPeople()` to `org-sync.js`

**File**: `modules/team-tracker/server/org-sync.js`

Port the `deriveTeamsFromPeople()` function from the main branch's
`modules/org-roster/server/sync.js`. This function:
1. Reads all people via `getAllPeople(storage)`
2. Gets org display name mapping
3. Iterates people, splits `_teamGrouping` by comma
4. Builds unique `{org, name, boardUrls: []}` entries

```js
function deriveTeamsFromPeople(storage) {
  const allPeople = getAllPeople(storage);
  const orgDisplayNames = getOrgDisplayNames(storage);
  const teamSet = new Map();

  for (const person of allPeople) {
    const org = orgDisplayNames[person.orgKey] || '';
    if (!org) continue;
    const grouping = person._teamGrouping || person.miroTeam || '';
    const teamNames = grouping.split(',').map(t => t.trim()).filter(Boolean);
    for (const teamName of teamNames) {
      const key = `${org}::${teamName}`;
      if (!teamSet.has(key)) {
        teamSet.set(key, { org, name: teamName, boardUrls: [] });
      }
    }
  }

  return [...teamSet.values()];
}
```

**New import required** — `getAllPeople` is NOT currently imported in `org-sync.js`.
Only `getOrgDisplayNames` is imported (line 11). Add:

```js
const { getAllPeople } = require('../../../shared/server/roster');
```

**Export** — add `deriveTeamsFromPeople` to `module.exports` so it can be unit tested
independently:

```js
module.exports = {
  runSync,
  parseTeamBoardsTab,
  parseComponentsTab,
  calculateHeadcountByRole,
  deriveTeamsFromPeople,  // new
};
```

### Step 2: Update `runSync()` to make tabs optional with fallback

**File**: `modules/team-tracker/server/org-sync.js`

`runSync(storage, sheetId, config)` — `sheetId` becomes optional (can be `null`).

Changes:

1. **Default `teamBoardsTab` to `null`** instead of `'Scrum Team Boards'` (line 277):
   ```js
   const teamBoardsTab = config?.teamBoardsTab || null;
   const componentsTab = config?.componentsTab || null;
   ```

2. **Make team-boards tab fetch conditional and wrapped in try/catch**:
   ```js
   let rawTeams = [];
   if (teamBoardsTab && sheetId) {
     try {
       // ... existing fetch + parse + filter logic ...
     } catch (err) {
       console.warn(`[org-roster sync] Failed to fetch team boards tab: ${err.message}`);
     }
   }
   ```

3. **Add fallback to `deriveTeamsFromPeople()`**:
   ```js
   if (rawTeams.length === 0) {
     rawTeams = deriveTeamsFromPeople(storage);
     console.log(`[org-roster sync] Derived ${rawTeams.length} teams from people data`);
   }
   ```

4. **Make components tab fetch conditional**:
   ```js
   if (componentsTab && sheetId) {
     try { /* ... existing logic ... */ }
     catch (err) { console.warn(...); }
   }
   ```

5. **Only resolve board names if any team has URLs**:
   ```js
   let boardNames = {};
   if (rawTeams.some(t => t.boardUrls.length > 0)) {
     // ... existing board name resolution ...
   }
   ```

**Note on `orgNameMapping`**: When teams are derived from people via
`deriveTeamsFromPeople()`, org names come from `getOrgDisplayNames()` (LDAP-based),
not from sheet data. The `orgNameMapping` config (which maps sheet org names to
configured org names) is not applied because it's not relevant — LDAP org names are
already canonical. This matches main branch behavior.

### Step 3: Update `triggerOrgSync()` and callers to allow sync without a sheetId

**File**: `modules/team-tracker/server/routes/org-teams.js`

The current `triggerOrgSync()` (line 393-427), `POST /org-sync/trigger` route
(line 432-442), and startup scheduler (line 446-466) all gate on `sheetId`.
This makes `deriveTeamsFromPeople()` unreachable when no Google Sheet is configured
— the exact scenario where the fallback is most needed.

**3a. Update `triggerOrgSync()`** — remove the early return on missing `sheetId`
(lines 397-401):

```js
async function triggerOrgSync() {
  if (orgSyncInProgress) return { status: 'already_running' };
  orgSyncInProgress = true;

  const sheetId = getSheetId();  // may be null — runSync handles it
  const config = getOrgConfig();

  try {
    await runSync(storage, sheetId, config);
    // ... existing RFE refresh logic (already has its own try/catch) ...
    return { status: 'success' };
  } catch (err) {
    console.error('[team-tracker] Org sync error:', err.message);
    writeToStorage('org-roster/sync-status.json', {
      lastSyncAt: new Date().toISOString(), status: 'error', error: err.message
    });
    return { status: 'error', error: err.message };
  } finally {
    orgSyncInProgress = false;
  }
}
```

**3b. Update `POST /org-sync/trigger` route** (lines 432-442) — remove the sheetId
gate:

```js
router.post('/org-sync/trigger', requireAdmin, async function(req, res) {
  if (orgSyncInProgress) return res.status(409).json({ error: 'Sync already in progress' });

  res.json({ status: 'started' });
  triggerOrgSync();
});
```

**3c. Update startup scheduler** (lines 446-466) — remove the `if (sheetId)` wrapper.
Also fixes the stale-sheetId problem: the old code captured `sheetId` once at startup
and never refreshed it. Now `triggerOrgSync()` calls `getSheetId()` fresh each time,
so config changes are always picked up:

```js
if (!DEMO_MODE) {
  setTimeout(function() {
    const rosterData = readFromStorage('org-roster-full.json');
    if (rosterData) {
      triggerOrgSync().catch(function(err) {
        console.error('[team-tracker] Initial org sync error:', err.message);
      });
    }

    if (orgDailyTimer) clearInterval(orgDailyTimer);
    orgDailyTimer = setInterval(function() {
      triggerOrgSync().catch(function(err) {
        console.error('[team-tracker] Scheduled org sync error:', err.message);
      });
    }, TWENTY_FOUR_HOURS);
    if (orgDailyTimer.unref) orgDailyTimer.unref();
  }, 5 * 60 * 1000);
}
```

### Step 4: Add read-time fallback in `buildEnrichedTeams()` and `org-list`

**File**: `modules/team-tracker/server/routes/org-teams.js`

Even after fixing sync, there's a window (first 5 minutes after startup, or if sync
hasn't run yet) where `teams-metadata.json` doesn't exist. Currently
`buildEnrichedTeams()` (line 69) and `GET /org-list` (line 178) both return empty
results in this case.

**4a. Update `buildEnrichedTeams()`** — add read-time fallback when metadata is
missing:

```js
function buildEnrichedTeams(orgFilter) {
  let metaData = readFromStorage('org-roster/teams-metadata.json');
  const compData = readFromStorage('org-roster/components.json');
  const componentMap = compData?.components || {};

  // Fallback: derive teams from people data if no metadata exists yet
  if (!metaData || !metaData.teams) {
    const derived = deriveTeamsFromPeople(storage);
    if (derived.length === 0) return { teams: [], fetchedAt: null };
    metaData = { teams: derived, fetchedAt: null, boardNames: {} };
  }

  // ... rest of existing logic unchanged ...
}
```

This requires importing `deriveTeamsFromPeople` from `org-sync.js` in `org-teams.js`:
```js
const { runSync, calculateHeadcountByRole, parseTeamBoardsTab, deriveTeamsFromPeople } = require('../org-sync');
```

**4b. Update `GET /org-list`** (lines 175-204) — same fallback pattern:

```js
router.get('/org-list', function(req, res) {
  try {
    let metaData = readFromStorage('org-roster/teams-metadata.json');

    // Fallback: derive from people data
    if (!metaData || !metaData.teams) {
      const derived = deriveTeamsFromPeople(storage);
      if (derived.length === 0) return res.json({ orgs: [] });
      metaData = { teams: derived };
    }

    // ... rest of existing logic unchanged ...
  } catch (error) { ... }
});
```

### Step 5: Update `getOrgConfig()` defaults

**File**: `modules/team-tracker/server/routes/org-teams.js` (lines 34-43)

Change the hardcoded defaults to empty strings so the tabs are truly optional:

```js
function getOrgConfig() {
  return readFromStorage('org-roster/config.json') || {
    teamBoardsTab: '',           // was 'Scrum Team Boards'
    componentsTab: '',           // was 'Summary: components per team'
    jiraProject: 'RHAIRFE',
    rfeIssueType: 'Feature Request',
    orgNameMapping: {},
    componentMapping: {}
  };
}
```

**Note on existing deployments**: This default only applies when no
`org-roster/config.json` file exists on disk (new installs). Existing deployments
with a saved config file that contains `teamBoardsTab: 'Scrum Team Boards'` will
retain that value. This is correct behavior — if the admin explicitly configured a
tab name, it should continue to be used. The try/catch added in Step 2 ensures that
if the tab doesn't exist in the sheet, sync falls back to people-derived teams
gracefully rather than crashing.

### Step 6: Fix `_teamGrouping`/`miroTeam` precedence inconsistency

**File**: `modules/team-tracker/server/org-sync.js` (line 178)

`calculateHeadcountByRole` uses the opposite field priority from all other functions:

```js
// Current (wrong order):
const miroTeam = person.miroTeam || person._teamGrouping || '';
// Should be (consistent with org-teams.js and deriveTeamsFromPeople):
const miroTeam = person._teamGrouping || person.miroTeam || '';
```

`_teamGrouping` is the canonical field set by the team grouping column; `miroTeam` is
the legacy fallback. All functions should check `_teamGrouping` first.

### Step 7: Fix `groupingColumn` typo in status endpoint

**File**: `modules/team-tracker/server/index.js` (line 2410)

```js
// Current (typo — field doesn't exist):
teamGroupingColumn: syncConfig.teamStructure?.groupingColumn || null,
// Should be:
teamGroupingColumn: syncConfig.teamStructure?.teamGroupingColumn || null,
```

### Step 8: Tests

**File**: `modules/team-tracker/__tests__/server/org-sync.test.js` (new or existing)

Test infrastructure: requires mocks for Google Sheets client (`fetchRawSheet`), storage
(`readFromStorage`/`writeToStorage`), and roster-sync config (`getOrgDisplayNames`).
Use Jest manual mocks or `jest.mock()` for the shared modules.

Add tests for:

**`deriveTeamsFromPeople()`** (exported, testable independently):
1. Builds teams from people's `_teamGrouping` values
2. Handles comma-separated multi-team values (person on 2 teams → 2 team entries)
3. Skips people with no org mapping or empty `_teamGrouping`
4. Deduplicates teams (two people on same team → one team entry)
5. Falls back to `miroTeam` when `_teamGrouping` is absent

**`runSync()`**:
6. With `sheetId = null` and no tabs configured — derives teams from people
7. With team-boards tab configured but fetch fails — falls back gracefully
8. With team-boards tab that returns teams — uses those (existing behavior)
9. Only resolves board names when teams have URLs

**`buildEnrichedTeams()` read-time fallback** (test via API or extracted function):
10. Returns derived teams when `teams-metadata.json` doesn't exist
11. Returns metadata teams when file exists (existing behavior)

**`triggerOrgSync()` without sheetId**:
12. Runs sync successfully and writes `teams-metadata.json` (derived from people)

### Step 9: Verify Settings UI

The Settings UI already has inputs for Name Column and Team Grouping Column in
`PeopleAndTeamsSettings.vue`. No UI changes needed for the core fix.

However, verify that:
- The "Team Boards Tab" field in the Org Config section shows as optional (not required)
- Saving with an empty team-boards tab works correctly

## Files Changed

| File | Change |
|------|--------|
| `modules/team-tracker/server/org-sync.js` | Add `getAllPeople` import, add `deriveTeamsFromPeople()`, export it, update `runSync()`, fix field precedence |
| `modules/team-tracker/server/routes/org-teams.js` | Import `deriveTeamsFromPeople`, update `getOrgConfig()` defaults, update `triggerOrgSync()` + trigger route + scheduler, add read-time fallback in `buildEnrichedTeams()` and `GET /org-list` |
| `modules/team-tracker/server/index.js` | Fix `groupingColumn` typo (line 2410) |
| `modules/team-tracker/__tests__/server/org-sync.test.js` | Add tests for derivation, sync fallback, and read-time fallback |

## Risk Assessment

- **Low risk**: `deriveTeamsFromPeople()` is a pure read operation — builds a list from
  existing roster data with no side effects.
- **Backward compatible**: If a "Scrum Team Boards" tab IS configured and works, behavior
  is unchanged. The fallback only activates when the tab is not configured or fails.
- **No migration needed**: Existing `roster-sync-config.json` and `org-roster/config.json`
  files continue to work as-is. Existing deployments keep their configured tab names.
- **`triggerOrgSync()` change**: Removing the sheetId gate allows sync to run without a
  Google Sheet. Since `runSync()` handles null sheetId gracefully (skips sheet fetches,
  derives from people), this is safe. The RFE refresh after sync already has its own
  try/catch.
- **Read-time fallback**: `buildEnrichedTeams()` and `org-list` now derive teams on the
  fly when `teams-metadata.json` is missing. This is slightly more expensive than reading
  a file, but only happens before the first sync (5-minute window at startup).
- **Stale sheetId**: The scheduler no longer captures sheetId at startup — `triggerOrgSync()`
  calls `getSheetId()` fresh each invocation, so config changes are always picked up.

## Verification

After implementation:
1. **No Google Sheet configured**: Teams derived from people's `_teamGrouping` values
2. **Google Sheet with team-boards tab**: Existing behavior preserved
3. **Google Sheet without team-boards tab**: Teams derived from people, no error
4. **Before first sync (fresh startup)**: `GET /org-teams` returns derived teams
   (read-time fallback), not empty
5. **Team directory**: Shows all teams that people are assigned to
6. **People**: Appear under their correct teams based on `_teamGrouping`
7. **Status endpoint**: Reports correct `teamGroupingColumn` value
8. **Admin clears sheetId after startup**: Next scheduled sync picks up the change
