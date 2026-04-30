# RICE Score: Single Pre-Computed Field Migration

**Date:** 2026-04-30
**Module:** release-planning
**Status:** Revised -- incorporating review feedback

## Summary

Replace the current 4-field RICE scoring system (Reach, Impact, Confidence, Effort fetched from RHAISTRAT **parent** issues, computed as `R*I*C%/E`) with a single pre-computed numeric RICE score field read directly from the **feature issues themselves**.

This eliminates the parent-key lookup pass, the `rice-scorer.js` computation module, the 4-field config UI, and reduces Jira API calls by removing the separate `fetchRiceFields()` batch entirely.

## Key Architectural Changes

1. **Data source moves**: RICE data comes from feature issues (same JQL as Pass 1), not parent RHAISTRAT issues
2. **Computation removed**: The server just reads a number -- no formula needed
3. **Config simplifies**: 4 field pickers become 1 field picker; enable/disable toggle stays
4. **Data shape changes**: `feature.rice` goes from `{ reach, impact, confidence, effort, score, complete }` to `{ score }` (a plain number, or null)
5. **`complete` property removed**: The `complete` flag on the old RICE result (`buildRiceResult()` returned `complete: true/false`) is dropped. Audit: `complete` is only checked in `rice-scorer.test.js` (deleted) and the client test `health-components.test.js` (updated in this plan). No production code path branches on `rice.complete` -- it was purely informational for the popover UI. The new shape `{ score: N }` implies completeness (score present = complete; score null = incomplete). Demo fixtures use `complete: true` -- these are updated to the new shape.
6. **Score of `0` is valid**: A RICE score of `0` is a legitimate value (e.g., zero reach). The normalization logic explicitly preserves `0` and only treats `null`/`undefined`/`NaN`/empty-string as missing.

## Files Modified

| File (path from repo root) | Change |
|------|--------|
| `modules/release-planning/server/constants.js` | No change to `ENRICHMENT_FIELDS` constant. RICE field appended dynamically in `runPass1()`. |
| `modules/release-planning/server/config.js` | Add `riceScoreField: ''` to `DEFAULT_CONFIG.customFieldIds`. Add `migrateRiceConfig()` function for backward compatibility (see C1 fix below). Keep old 4 keys initially; remove in Phase 4. |
| `modules/release-planning/server/health/jira-enrichment.js` | Remove `fetchRiceFields()` function. In `enrichFeatures()`, remove the parent-key RICE pass. Pass `riceScoreField` to `runPass1()` via `opts`. In `runPass1()`, append the RICE field to the JQL fields string if present, read and normalize the value from `fields[riceScoreField]`, set `enrichment.rice` directly. |
| `modules/release-planning/server/health/rice-scorer.js` | **Delete entire file.** The `computeRiceScore()` and `buildRiceResult()` functions are no longer needed. |
| `modules/release-planning/server/health/health-pipeline.js` | Remove `require('./rice-scorer')`. Remove `buildRiceResult()` call. Read `enrichment.rice` directly (already `{ score: N }` or `null` from Pass 1). Remove `riceData` from `enrichResult` destructuring **in the same step** as changing `enrichFeatures()` return value. Update `enrichmentStatus.riceAvailable` computation. |
| `modules/release-planning/server/health/priority-scorer.js` | No change -- already reads `feature.rice.score`, which will still be set. |
| `modules/release-planning/server/health/health-routes.js` | **RICE admin save** (`PUT /releases/health-admin/config`): accept `riceScoreField` (string) in addition to old `riceFieldIds`, save as `config.customFieldIds.riceScoreField`. **Continue returning** `{ saved: true, customFieldIds: config.customFieldIds, enableRice }` (preserves `targetVersion`, `productManager`, `releaseType` alongside `riceScoreField`). **RICE admin test** (`POST /releases/health-admin/rice-test`): validate 1 field. **RICE admin get** (`GET /releases/health-admin/config`): continues returning `{ customFieldIds, enableRice }` (unchanged shape -- `customFieldIds` now includes `riceScoreField` instead of old 4 keys). |
| `modules/release-planning/client/composables/useReleaseHealth.js` | Update `saveRiceConfig()` to send `{ riceScoreField, enableRice }` instead of `{ riceFieldIds, enableRice }`. |
| `modules/release-planning/client/components/RiceFieldConfig.vue` | Replace the 4-field picker loop with a single field picker. Keep enable/disable toggle. Keep test button (now validates 1 field). |
| `modules/release-planning/client/components/RiceScoreDisplay.vue` | Simplify: remove breakdown popover (no R/I/C/E components to show). Display score as a simple badge. Keep the N/A fallback. |
| `modules/release-planning/client/components/FeatureHealthRow.vue` | Update RICE column to render score-only badge (no click-to-expand). The `@click.stop` on the RICE `<td>` (line 196) becomes a no-op after popover removal -- remove it for cleanliness. |
| `modules/release-planning/client/components/FeatureHealthTable.vue` | RICE column sorting stays the same (reads `rice.score`). No functional change. |
| `fixtures/release-planning/health-cache-demo.json` | Update `rice` field shape from `{ reach, impact, confidence, effort, score, complete }` to `{ score }` for all features. |
| `fixtures/release-planning/config.json` | Add `riceScoreField: ''` to `customFieldIds`. Note: this fixture does NOT currently contain old `riceReach/Impact/Confidence/Effort` keys (they only exist in `DEFAULT_CONFIG` and on production PVCs). No keys to remove here. |
| `modules/release-planning/__tests__/server/rice-scorer.test.js` | **Delete entire file.** |
| `modules/release-planning/__tests__/server/jira-enrichment.test.js` | Update `enrichFeatures` RICE tests: remove parent-key fetch test, add direct-field-on-feature test. Remove `fetchRiceFields` unit test. |
| `modules/release-planning/__tests__/server/health-pipeline.test.js` | Update RICE-related assertions to check `{ score: N }` instead of `{ reach, impact, confidence, effort, score, complete }`. |
| `modules/release-planning/__tests__/server/health-routes.test.js` | Update RICE admin route tests: `PUT` config accepts `riceScoreField` (string), test route validates 1 field. |
| `modules/release-planning/__tests__/server/priority-scorer.test.js` | No change -- already uses `rice: { score: N }` shape in test data. |
| `modules/release-planning/__tests__/client/health-components.test.js` | **Update `RiceScoreDisplay` tests** (lines 184-221): change test data from `{ reach: 1000, impact: 2, confidence: 80, effort: 4, score: 400, complete: true }` to `{ score: 400 }`. Remove "expands breakdown on click" test (popover no longer exists). Update "does not expand on click" test to just verify score/N/A display. |

## Phased Implementation

> **Important:** All phases ship in a **single PR**. This ensures CI passes at every commit (tests are updated alongside code) and avoids any frontend/backend desync window. Individual commits within the PR should be structured so each commit is green (see per-phase notes below).

### Phase 1: Config Migration and Backend Core

**Goal:** Add backward-compatible config migration, then make the pipeline read the single RICE field from feature issues. Old cached data becomes stale and is overwritten on next refresh.

1. **Add config migration in `config.js`**:
   - Add `riceScoreField: ''` to `DEFAULT_CONFIG.customFieldIds`.
   - Add a `migrateRiceConfig(config)` function that auto-detects old 4-field config: if `config.customFieldIds` has any of `riceReach/riceImpact/riceConfidence/riceEffort` set AND `riceScoreField` is not set, log a warning: `[release-planning] Old 4-field RICE config detected. RICE scoring disabled until riceScoreField is configured via Settings.` Then set `config.healthConfig.enableRice = false` to prevent silent score disappearance.
   - Call `migrateRiceConfig()` inside `getConfig()` after the spread merge, before returning.
   - This ensures production deployments with old config on PVC gracefully disable RICE rather than silently dropping scores.
   - Note: stale old config keys (`riceReach`, etc.) merge harmlessly via the spread in `getConfig()` -- they become inert dead keys that are cleaned up in Phase 4.

2. **Update `jira-enrichment.js`**:
   - In `enrichFeatures()`: pass `riceScoreField` to `runPass1()` via the `opts` parameter: `opts.riceScoreField = customFieldIds.riceScoreField || ''`.
   - In `runPass1()`: if `opts.riceScoreField` is truthy, append it to the JQL fields string: `var fields = ENRICHMENT_FIELDS + (opts.riceScoreField ? ',' + opts.riceScoreField : '')`. Read and **normalize** the value from the Jira response (see normalization spec below). Set `enrichment.rice` directly.
   - In `enrichFeatures()`: remove the entire RICE-from-parents block (lines 368-398). The `riceData` Map and parent-key collection are no longer needed.
   - Remove the `fetchRiceFields()` function and its export.
   - **Update `enrichFeatures()` return value**: remove `riceData` from the return object. Return `{ enrichments, warnings, stats }`. The `stats.rice` field becomes `0` (no separate RICE pass).
   - **In the same commit**: update `health-pipeline.js` line 621 to remove `riceData: new Map()` from the default `enrichResult`, since `enrichFeatures()` no longer returns it (see step 3).

   **Jira field value normalization** (for `opts.riceScoreField`):
   ```js
   // Jira custom fields can return: number, string, object with .value, null, 0, or ''
   var rawRice = fields[opts.riceScoreField]
   var riceValue = (rawRice !== null && rawRice !== undefined && rawRice !== '')
     ? Number(typeof rawRice === 'object' && rawRice !== null ? rawRice.value : rawRice)
     : null
   enrichment.rice = (riceValue !== null && !isNaN(riceValue))
     ? { score: riceValue }
     : null
   ```
   Note: `Number(0)` is `0` (not `NaN`), so a Jira value of `0` correctly produces `{ score: 0 }`.

3. **Update `health-pipeline.js`** (same commit as step 2's `enrichFeatures()` return change):
   - Remove `require('./rice-scorer')` import.
   - Remove `riceData` from `enrichResult` default (line 621): change from `{ enrichments: new Map(), riceData: new Map(), warnings: [], stats: { pass1: 0, pass2: 0, rice: 0 } }` to `{ enrichments: new Map(), warnings: [], stats: { pass1: 0, pass2: 0 } }`.
   - In the per-feature loop (lines 687-695): replace the `buildRiceResult()` call with direct reading:
     ```js
     // RICE score (replaces lines 688-695)
     var riceResult = null
     if (enrichment && enrichment.rice && enrichment.rice.score != null) {
       riceResult = enrichment.rice
       totalRiceScore += riceResult.score
       riceCount++
     }
     ```
     Note: `!= null` catches both `null` and `undefined` while preserving `0`.
   - `enrichmentStatus.riceAvailable` (line 783): already `riceCount > 0` -- no change needed. This correctly reflects whether any feature had a RICE score.

4. **Delete `rice-scorer.js`** (same commit as step 3 -- the `require()` is already removed).

5. **Update `health-routes.js`**:
   - `PUT /releases/health-admin/config` (line 841): accept `req.body.riceScoreField` (string). Save as `config.customFieldIds.riceScoreField`. Remove the `riceFieldIds` object handling (lines 844-851). Continue returning `{ saved: true, customFieldIds: config.customFieldIds, enableRice }` -- this preserves `targetVersion`, `productManager`, `releaseType` in the response alongside the new `riceScoreField`.
   - `POST /releases/health-admin/rice-test` (line 866): validate 1 field (`riceScoreField`) instead of 4. Return `{ results: { riceScore: { id, name, found } }, validCount, totalCount: 1 }`.
   - `GET /releases/health-admin/config` (line 907): **no shape change** -- it already returns `{ customFieldIds, enableRice }`. The `customFieldIds` object will now contain `riceScoreField` instead of the old 4 keys (after Phase 4 cleanup). During transition, both old and new keys will be present in the object, which is fine.

6. **Update constants.js**: No change to `ENRICHMENT_FIELDS` constant itself (it stays `'description,customfield_10028,issuelinks'`). The RICE field is appended dynamically in `runPass1()` when configured.

7. **Update tests alongside code** (same commit):
   - **Delete `modules/release-planning/__tests__/server/rice-scorer.test.js`**.
   - **Update `modules/release-planning/__tests__/server/jira-enrichment.test.js`**: remove the parent-key fetch test, add direct-field-on-feature test, remove `fetchRiceFields` unit tests.
   - **Update `modules/release-planning/__tests__/server/health-pipeline.test.js`**: update RICE assertions to check `{ score: N }` shape, remove checks for `rice.reach`, `rice.impact`, etc.
   - **Update `modules/release-planning/__tests__/server/health-routes.test.js`**: update RICE admin config tests to use `riceScoreField`, update test route expectation to 1 field.

### Phase 2: Frontend and Client Tests

**Goal:** Update the UI to match the new single-field model. Ship in the same PR as Phase 1.

8. **Update `RiceFieldConfig.vue`**: Replace the 4-field loop with a single field picker. The data model changes from `fields: { riceReach: {...}, ... }` to `riceScoreField: { id: '', name: '' }`. Keep enable/disable toggle and test button.

9. **Simplify `RiceScoreDisplay.vue`**: Remove the expandable breakdown popover. The component becomes a simple numeric badge: show score if present, "N/A" otherwise. No click interaction.

10. **Update `useReleaseHealth.js`**: `saveRiceConfig(fieldId, enableRice)` sends `{ riceScoreField: fieldId, enableRice }`. `loadRiceConfig()` returns `{ riceScoreField, enableRice }`.

11. **Update `FeatureHealthRow.vue`**: The RICE cell can either continue using `RiceScoreDisplay` (now simplified) or inline the badge directly. Either way, no popover. Remove the `@click.stop` on the RICE `<td>` (line 196) since it was only there to prevent row toggle when clicking the popover.

12. **Update `modules/release-planning/__tests__/client/health-components.test.js`** (same commit as component changes):
    - Update the "shows score when rice data is complete" test: change prop from `{ reach: 1000, impact: 2, confidence: 80, effort: 4, score: 400, complete: true }` to `{ score: 400 }`.
    - Update the "shows N/A when rice has no score" test: change prop from `{ reach: 1000, impact: null, confidence: 80, effort: 4, score: null, complete: false }` to `{ score: null }`.
    - Remove or rewrite the "expands breakdown on click when score exists" test -- the popover no longer exists. Replace with a test that confirms the component renders the score as a simple badge without interactive expansion.
    - Update the "does not expand on click when score is null" test to simply verify N/A display.

### Phase 3: Fixtures and Demo Mode

**Goal:** Update fixture data to match the new shape. Must be in the same PR to avoid demo mode breakage.

13. **Update `fixtures/release-planning/health-cache-demo.json`**: Change `rice` from `{ reach, impact, confidence, effort, score, complete }` to `{ score: N }` (or `null`). For example: `"rice": { "score": 675 }` instead of `"rice": { "reach": 2000, "impact": 3, "confidence": 90, "effort": 8, "score": 675, "complete": true }`.

14. **Update `fixtures/release-planning/config.json`**: Add `"riceScoreField": ""` to the `customFieldIds` block. Note: this fixture does not currently contain `riceReach/riceImpact/riceConfidence/riceEffort` keys, so there is nothing to remove.

### Phase 4: Cleanup

15. Remove dead config keys (`riceReach`, `riceImpact`, `riceConfidence`, `riceEffort`) from `DEFAULT_CONFIG.customFieldIds` in `config.js`.
16. Remove the `migrateRiceConfig()` guard if desired (or keep it permanently as a no-op safety net -- the check is cheap).
17. Remove `fetchRiceFields` from `jira-enrichment.js` exports (already deleted in Phase 1, but verify no re-export in barrel files).

## Data Model Changes

### Config (`data/release-planning/config.json`)

**Before:**
```json
{
  "customFieldIds": {
    "targetVersion": "customfield_10855",
    "productManager": "customfield_10469",
    "releaseType": "customfield_10851",
    "riceReach": "customfield_10100",
    "riceImpact": "customfield_10101",
    "riceConfidence": "customfield_10102",
    "riceEffort": "customfield_10103"
  },
  "healthConfig": {
    "enableRice": true
  }
}
```

**After:**
```json
{
  "customFieldIds": {
    "targetVersion": "customfield_10855",
    "productManager": "customfield_10469",
    "releaseType": "customfield_10851",
    "riceScoreField": "customfield_10200"
  },
  "healthConfig": {
    "enableRice": true
  }
}
```

Note: `targetVersion`, `productManager`, and `releaseType` are preserved. Only the 4 RICE keys are replaced with 1.

### Per-Feature Enrichment (internal, in enrichmentMap)

**Before:**
```json
{
  "hasDescription": true,
  "storyPoints": 5,
  "dependencyLinks": [],
  "refinementHistory": null,
  "rice": {
    "reach": 2000,
    "impact": 3,
    "confidence": 90,
    "effort": 8
  },
  "tshirtSize": "M"
}
```

**After:**
```json
{
  "hasDescription": true,
  "storyPoints": 5,
  "dependencyLinks": [],
  "refinementHistory": null,
  "rice": { "score": 675 },
  "tshirtSize": "M"
}
```

### Health Cache Feature (`data/release-planning/health-cache-*.json`)

**Before:**
```json
{
  "rice": {
    "reach": 2000,
    "impact": 3,
    "confidence": 90,
    "effort": 8,
    "score": 675,
    "complete": true
  }
}
```

**After:**
```json
{
  "rice": {
    "score": 675
  }
}
```

The `complete` property is removed. See "Key Architectural Changes" item 5 for the audit confirming no production code depends on it.

### Summary (unchanged fields)

- `summary.averageRiceScore` -- still computed, same semantics
- `enrichmentStatus.riceAvailable` -- still a boolean, computed as `riceCount > 0`

## API/Interface Backward Compatibility

### API Responses

The `GET /releases/:version/health` response changes the `rice` shape on each feature. Any external consumers reading `rice.reach`, `rice.impact`, `rice.confidence`, `rice.effort`, or `rice.complete` will get `undefined`. Since:

1. The only consumer is the Vue frontend (same codebase)
2. The user confirmed old cached data can be invalidated

This is acceptable. The `rice.score` field is preserved and continues to work for `priority-scorer.js` and the frontend table sorting.

### Admin API

The `GET /releases/health-admin/config` response shape is **unchanged**: `{ customFieldIds, enableRice }`. The `customFieldIds` object continues to contain `targetVersion`, `productManager`, `releaseType`, and now includes `riceScoreField` instead of the old 4 RICE keys.

The `PUT /releases/health-admin/config` body changes from `{ riceFieldIds: { riceReach, riceImpact, riceConfidence, riceEffort } }` to `{ riceScoreField: "customfield_XXXXX" }`. This is a breaking change to the admin config API, but only the in-codebase `RiceFieldConfig.vue` component calls it.

The response continues to return `{ saved: true, customFieldIds, enableRice }` (unchanged).

### Test Button

The `POST /releases/health-admin/rice-test` response changes from validating 4 fields to validating 1. Response shape changes from `{ results: { riceReach, riceImpact, ... }, validCount, totalCount: 4 }` to `{ results: { riceScore: { id, name, found } }, validCount, totalCount: 1 }`.

### Rolling Deploy Window

During a rolling deploy, there is a brief window (~30 seconds) where the frontend pod may serve the new JS while the backend pod still runs old code (or vice versa). This is low-risk because: (a) the admin config page is rarely used, (b) the health dashboard reads from the cache file which has a consistent shape for the duration of a single response, and (c) the deploy completes quickly. No mitigation needed.

## Jira API Impact

**Before:** Pass 1 (all features) + Pass 2 (at-risk features) + RICE pass (unique parent keys from parent issues). Three batched query rounds.

**After:** Pass 1 (all features, with RICE field added to fields list) + Pass 2 (at-risk features). Two batched query rounds. The RICE field is fetched for free in the existing Pass 1 JQL -- no extra API calls.

This is a net reduction in Jira API usage proportional to the number of unique parent keys previously queried.

## Testability

### Local Dev
- Configure `JIRA_EMAIL` and `JIRA_TOKEN` in `.env`
- Use the Settings gear icon to open RICE config
- Search for the RICE score field name (single field picker)
- Save and click Test -- should show 1/1 found
- Trigger a health refresh -- RICE scores should populate

### Preprod
- Deploy to preprod overlay (uses `:latest` images)
- Verify RICE config UI shows single field picker
- Verify health cache features have `rice: { score: N }` shape
- Verify priority scorer still works (uses `rice.score`)

### Prod
- After preprod validation, merge to main
- CI builds and pushes images
- Auto-merge PR updates prod overlay tags
- **Follow the Post-Deploy Runbook below**

## Post-Deploy Runbook

Production config on the PVC (`data/release-planning/config.json`) has old 4-field RICE config (`riceReach`, `riceImpact`, `riceConfidence`, `riceEffort` with `enableRice: true`). The config migration in `getConfig()` will auto-detect this and disable RICE scoring to prevent silent score disappearance. RICE will be effectively disabled until an admin reconfigures.

**Steps (to be performed by a release-planning admin immediately after deploy):**

1. **Verify deploy is healthy**: Check that the health dashboard loads without errors. RICE scores will show "N/A" for all features (expected -- migration has disabled RICE).

2. **Open Settings > RICE Configuration**: The UI should show the new single-field picker (empty).

3. **Configure the RICE score field**:
   - Click the field search to find the pre-computed RICE score field in Jira
   - Select it and save
   - Click "Test" to verify 1/1 field found

4. **Re-enable RICE scoring**: Toggle "Enable RICE" on and save.

5. **Trigger a health refresh**: Click the refresh button or wait for the next scheduled refresh. The pipeline will fetch RICE scores from feature issues directly.

6. **Verify**: Confirm RICE scores appear in the health table. Check a few features against Jira to validate correctness.

**Timing:** The daily CronJob (6:00 AM UTC) triggers roster sync and metrics refresh but does NOT trigger health refresh directly. The admin must manually trigger the first health refresh after reconfiguring RICE. Subsequent refreshes will use the new config automatically.

**Who:** Any user with PM/admin access to the release-planning module settings.

## CI/CD Considerations

- Deleting `rice-scorer.js` and its test file requires removing the `require()` in `health-pipeline.js` in the same commit to avoid CI failure.
- All code changes, test updates, and fixture changes ship in a single PR. Tests are updated in the same commit as their corresponding code changes to keep CI green at every commit.
- The frontend and backend changes ship together to avoid a window where the frontend expects the old API shape.
- No database migration needed -- file-based storage is overwritten on refresh.
- The `validate:modules` script does not inspect internal module files, so no manifest changes needed.
- ESLint pre-commit hook will catch any dead imports or unused variables from the removal.

## Open Questions

None -- all clarifying questions were answered before this plan was drafted.
