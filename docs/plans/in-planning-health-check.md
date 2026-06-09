# In-Planning Health Check System

**Status:** Approved
**Author:** Architect Agent
**Date:** 2026-06-09
**Module:** releases (plan sub-module)

---

## 1. Problem Statement

The Outcomes Dashboard and Health tab currently focus on execution-phase health
(milestone misses, velocity lag, blocked dependencies). But the most impactful
window for catching feature deficiencies is **before** the GA code freeze --
during the **planning** phase. The PDF "Feature Definition of Ready" flowchart
from the release planner defines a set of **hard blocker** criteria that must be
satisfied before a feature is considered ready for planning. These checks are
largely already evaluated by the existing health pipeline (DoR/DoD gates in
`planning-gates.js`) and the feature readiness system
(`feature-readiness.js`), but they are not surfaced as a unified "in planning"
health view in either the Outcomes tab or the Health tab.

**Goal:** Extend the existing health pipeline to add an "in planning" mode that
runs planning-phase-specific checks on all features in releases where today is
before the GA code freeze date, and surface the results in both the Outcomes
summary cards and the Health detail table.

---

## 2. Key Findings from Investigation

### 2.1 The "Existing Pipeline" Is Already Here

The user asked us to find the existing pipeline that checks hard blocker
criteria. It is the **health pipeline** itself:

| PDF Hard Blocker Criterion | Existing Check Location |
|---|---|
| Source RFE key is set and linked back to approved RFE | `planning-gates.js` DoR (labels), `feature-readiness.js` `computeBlockers()` sourceRfe field |
| Target Version is set on the Feature | `planning-gates.js` DoR-W2 (version set), `feature-readiness.js` `isHealthFeatureReady()` |
| Component(s) field is set | Available in execution pipeline data (`components` field) -- **not currently a gate** |
| Product Manager field is set | Available in execution pipeline data (`pm` field) -- **not currently a gate** |
| Assignee/Delivery Owner is set | `planning-gates.js` DoR-W1 (owner assigned) |
| Release Type (DP/TP/GA) is set | Available in execution pipeline data (`releaseType` field) -- **not currently a gate** |
| RICE Score is present | `planning-gates.js` DoR-B2 (RICE score present, when enableRice=true) |
| Strategy Human Sign-off | `planning-gates.js` DoR-B1 (strat-creator labels) |
| Child epics have been created | Available in execution pipeline data (`epicCount` in metrics) -- **not currently a gate** |
| Testing requirements are defined | Not directly available -- would need new Jira enrichment |
| Dependencies identified and linked | `planning-gates.js` DoR-W3 / DoD-3 (unresolved blockers) |
| Architecture review sign-off | Not directly available -- partially covered by strat-creator rubric |

**Conclusion:** 6 of 12 hard blocker criteria are already evaluated. 4 more have
the data available in the execution pipeline cache but are not wired as gates.
2 require new data (testing requirements, architecture review) that would need
future Jira enrichment.

### 2.2 "In Planning" Phase Detection

The user defined "in planning" as: **any release where today is before the GA
code freeze date.**

The GA code freeze date is already loaded by the health pipeline via:
- `loadMilestones()` in `health-pipeline.js` -- reads from
  `data/releases/delivery/product-pages-releases-cache.json`
- Backfill from Smartsheet via `backfillFreezeDatesFromSmartsheet()`
- Derivation from target dates via `deriveFreezeDates()`

The milestone info computation (`computeMilestoneInfo()`) already determines
`currentPhase` (Pre-EA1, EA1 Freeze, Post-EA1, etc.). A release is "in planning"
when `currentPhase` is one of: `Pre-EA1`, `EA1 Freeze`, `Post-EA1`, `EA2 Freeze`,
`Post-EA2` -- i.e., anything before `GA Freeze`.

### 2.3 Current Architecture Summary

```
Execution Pipeline (GitLab CI)
       |
       v
data/releases/execution/  (index.json + features/*.json)
       |
       v
pipeline.js (Tier 1-3 discovery)  -->  candidates-cache-{ver}.json
       |
       v
health-pipeline.js (7-step orchestrator)
  Step 1: Load features from candidates cache
  Step 2: Load milestones (Product Pages / Smartsheet)
  Step 3: Jira enrichment (2-pass)
  Step 4: Load overrides
  Step 5: Per-feature loop (DoR + DoD + risk + RICE)
  Step 6: Priority scores + blocker escalation + summary
  Step 7: Write health-cache-{ver}-{phase}.json
       |
       v
Health API  -->  HealthDashboardView.vue (Health tab)
       |
       v
Health API  -->  DashboardView.vue (Outcomes tab, via useHealthAggregation)
```

---

## 3. Architecture: Extending the Existing Health Pipeline

### 3.1 Design Decision: Extend, Not Replace

The system will extend the existing health pipeline by:

1. **Adding new planning-phase gate checks** to `planning-gates.js` -- new DoR
   checks for fields that have data but no gates (components, PM, release type,
   child epics).
2. **Adding a `releasePhaseMode` flag** to the health cache that indicates
   whether the release is "in planning" or "in execution".
3. **Adjusting the risk engine** to apply planning-appropriate risk semantics
   when `releasePhaseMode === 'planning'`.
4. **Adding aggregated planning health** to the Outcomes tab summary cards.
5. **Adding phase-aware check grouping** in the Health tab detail view.

### 3.2 Data Flow (Extended)

```
health-pipeline.js
  |
  +-- Step 2: Load milestones  -->  derive releasePhaseMode
  |                                 (from computeMilestoneInfo().currentPhase:
  |                                  'planning' if pre-GA-Freeze,
  |                                  'execution' otherwise)
  |
  +-- Step 5 (per-feature loop):
  |     computeDoR()  -->  NEW: planning-mode checks
  |     - DoR-B1: Strategy sign-off (existing)
  |     - DoR-B2: RICE score (existing)
  |     - DoR-W1: Owner assigned (existing)
  |     - DoR-W2: Version set (existing)
  |     - DoR-W3: Blockers resolved (existing)
  |     - DoR-P1: Components set (NEW)
  |     - DoR-P2: Product Manager set (NEW)
  |     - DoR-P3: Release type set (NEW)
  |     - DoR-P4: Child epics created (NEW)
  |     - DoR-P5: RFE linked (NEW)
  |
  |     computeFeatureRisk()  -->  planning mode adjustments
  |     - Suppress execution checks (already done via planningDeadline)
  |     - Add PLANNING_INCOMPLETE risk flag when DoR-P checks fail
  |
  +-- Step 7: Write cache  -->  include releasePhaseMode + planningChecks
```

### 3.3 New Planning Gate Checks (DoR-P Series)

These checks are only evaluated when `releasePhaseMode === 'planning'`. They
appear as a separate `planningChecks` array in the DoR result, distinct from the
existing `blockers` and `warnings` arrays. This preserves backward
compatibility -- existing consumers see the same DoR shape; new consumers can
opt into `planningChecks`.

| Check ID | Label | Data Source | Severity |
|---|---|---|---|
| DoR-P1 | Components Set | `feature.components` from candidates cache | hard-blocker |
| DoR-P2 | Product Manager Assigned | `feature.pm` from candidates cache | hard-blocker |
| DoR-P3 | Release Type Set | `feature.releaseType` / derived phase | hard-blocker |
| DoR-P4 | Child Epics Created | `feature.epicCount` from execution detail | hard-blocker |
| DoR-P5 | RFE Linked | `feature.rfe` from execution detail issueLinks | hard-blocker |

**Severity classification:**
- **hard-blocker**: Feature cannot proceed to planning without this. Maps to
  `DoR.passed = false` when in planning mode. All 5 planning checks are
  hard-blockers per stakeholder decision (2026-06-09).

### 3.4 Release Phase Mode Detection

The existing `computeMilestoneInfo()` in `health-pipeline.js` already computes
`currentPhase` with granular values (`Pre-EA1`, `EA1 Freeze`, `Post-EA1`,
`EA2 Freeze`, `Post-EA2`, `GA Freeze`, `Post-GA`, `Unknown`). Rather than
introducing a parallel date comparison that could disagree with
`currentPhase`, `deriveReleasePhaseMode()` derives from it:

```javascript
var PLANNING_PHASES = ['Pre-EA1', 'EA1 Freeze', 'Post-EA1', 'EA2 Freeze', 'Post-EA2']

function deriveReleasePhaseMode(currentPhase) {
  if (!currentPhase || currentPhase === 'Unknown') return 'unknown'
  if (PLANNING_PHASES.indexOf(currentPhase) !== -1) return 'planning'
  return 'execution'
}
```

This will be computed in `health-pipeline.js` after milestone loading (Step 2)
using the already-computed `milestoneInfo.currentPhase`, and stored in the
health cache output. This guarantees that `releasePhaseMode` and
`summary.currentPhase` are always consistent.

---

## 4. Backend Changes

### 4.1 `planning-gates.js` -- Add `computePlanningChecks()`

New exported function that evaluates the DoR-P series checks. Called from the
health pipeline only when `releasePhaseMode === 'planning'` and
`enablePlanningChecks` is true.

**Important:** The `epicCount` field is NOT available on health feature objects
created via `mapCandidateToHealthFeature()` -- that mapper does not include it.
The field IS available on features loaded via `loadFeaturesForRelease()` (the
execution index path, where `feature-store.js` sets `epicCount` from
`feature.metrics.totalEpics`). To support the candidates path, the health
pipeline enrichment step (4.2) must source `epicCount` from the execution
index and merge it onto the feature before `computePlanningChecks()` runs.
See Section 4.2a for the enrichment approach.

```javascript
function computePlanningChecks(feature, enrichment, opts) {
  var checks = []

  // DoR-P1: Components set
  var components = feature.components || []
  var hasComponents = Array.isArray(components)
    ? components.length > 0
    : (typeof components === 'string' && components.trim().length > 0)
  checks.push({
    id: 'DoR-P1',
    label: 'Components Set',
    passed: hasComponents,
    severity: 'hard-blocker',
    detail: hasComponents ? components.join(', ') : 'No components assigned'
  })

  // DoR-P2: Product Manager assigned
  var pm = feature.pm || ''
  var hasPM = typeof pm === 'object' ? !!(pm.displayName || pm.name) : pm.length > 0
  checks.push({
    id: 'DoR-P2',
    label: 'Product Manager Assigned',
    passed: hasPM,
    severity: 'hard-blocker',
    detail: hasPM ? (typeof pm === 'object' ? pm.displayName || pm.name : pm) : null
  })

  // DoR-P3: Release type set
  var phase = feature.phase || feature.releaseType || ''
  checks.push({
    id: 'DoR-P3',
    label: 'Release Type Set',
    passed: phase.length > 0,
    severity: 'hard-blocker',
    detail: phase || 'No release type (DP/TP/GA) specified'
  })

  // DoR-P4: Child epics created
  // epicCount must be sourced from execution index enrichment (see 4.2a)
  var epicCount = feature.epicCount || 0
  checks.push({
    id: 'DoR-P4',
    label: 'Child Epics Created',
    passed: epicCount > 0,
    severity: 'hard-blocker',
    detail: epicCount > 0
      ? epicCount + ' epic(s)'
      : 'No child epics linked'
  })

  // DoR-P5: RFE linked
  var hasRfe = !!(feature.rfe || feature.parentKey)
  checks.push({
    id: 'DoR-P5',
    label: 'RFE Linked',
    passed: hasRfe,
    severity: 'hard-blocker',
    detail: hasRfe
      ? (feature.rfe || feature.parentKey)
      : 'No source RFE linked'
  })

  var hardBlockersFailed = checks.filter(function(c) {
    return c.severity === 'hard-blocker' && !c.passed
  })

  return {
    checks: checks,
    passedCount: checks.filter(function(c) { return c.passed }).length,
    totalCount: checks.length,
    hasHardBlockers: hardBlockersFailed.length > 0,
    hardBlockersFailed: hardBlockersFailed
  }
}
```

### 4.2a `health-pipeline.js` -- Enrich `epicCount` from Execution Index

`mapCandidateToHealthFeature()` does not map `epicCount` (confirmed: the
field is absent from the return value at line 96-113 of `health-pipeline.js`).
The execution index (`feature-store.js` line 183) DOES compute
`epicCount: feature.metrics.totalEpics || 0`.

Add an enrichment step after `mapCandidateToHealthFeature()` that reads the
execution index and merges `epicCount` onto each feature:

```javascript
// In mapCandidateToHealthFeature(), add epicCount to the return value:
function mapCandidateToHealthFeature(candidate) {
  return {
    // ... existing fields ...
    epicCount: candidate.epicCount || 0  // NEW -- will be 0 from candidates,
                                          // enriched from execution index below
  }
}

// In runHealthPipeline(), after Step 1 (loadFeaturesFromCandidates),
// load the execution index and merge epicCount:
var execIndex = loadIndex(readFromStorage)
if (execIndex && execIndex.features) {
  var execByKey = {}
  for (var ei = 0; ei < execIndex.features.length; ei++) {
    execByKey[execIndex.features[ei].key] = execIndex.features[ei]
  }
  for (var fi = 0; fi < features.length; fi++) {
    var execFeature = execByKey[features[fi].key]
    if (execFeature && execFeature.epicCount) {
      features[fi].epicCount = execFeature.epicCount
    }
  }
}
```

This keeps `mapCandidateToHealthFeature()` simple and uses the execution
index as a secondary data source, consistent with how the pipeline already
loads the execution index for `loadFeaturesForRelease()`.

### 4.2 `health-pipeline.js` -- Integrate Planning Checks

Modify `runHealthPipeline()`:

1. After Step 2 (milestone loading) and `computeMilestoneInfo()`, derive
   `releasePhaseMode` from `currentPhase` (no duplicate date comparison):
   ```javascript
   var milestoneInfo = computeMilestoneInfo(milestones, today)
   var releasePhaseMode = deriveReleasePhaseMode(milestoneInfo.currentPhase)
   ```
   Note: `computeMilestoneInfo()` is already called at this point in the
   existing code (line 637). Move that call earlier or compute
   `releasePhaseMode` right after it.

2. In Step 5 (per-feature loop), after DoR/DoD evaluation, add:
   ```javascript
   var planningChecks = null
   if (releasePhaseMode === 'planning' && healthConfig.enablePlanningChecks) {
     planningChecks = computePlanningChecks(feature, enrichment, dorOpts)
   }
   ```

3. Include in the health feature entry:
   ```javascript
   healthFeatures.push({
     // ... existing fields ...
     planningChecks: planningChecks
   })
   ```

4. Add to cache summary:
   ```javascript
   var cache = {
     // ... existing fields ...
     releasePhaseMode: releasePhaseMode,
     summary: {
       // ... existing fields ...
       planningReadiness: releasePhaseMode === 'planning' ? {
         totalChecked: features.length,
         fullyReady: fullyReadyCount,
         withHardBlockers: hardBlockerCount,
         withWarnings: warningCount,
         byCheck: planningCheckSummary
       } : null
     }
   }
   ```

### 4.3 `risk-engine.js` -- Add PLANNING_INCOMPLETE Risk

Add a new risk category:
```javascript
// In constants.js
PLANNING_INCOMPLETE: 'PLANNING_INCOMPLETE'
```

In `computeFeatureRisk()`, when `releasePhaseMode === 'planning'` and
`planningChecks.hasHardBlockers`:
```javascript
if (opts.releasePhaseMode === 'planning' && opts.planningChecks
    && opts.planningChecks.hasHardBlockers) {
  flags.push({
    category: RISK_CATEGORIES.PLANNING_INCOMPLETE,
    severity: 'high',
    message: 'Feature has unresolved planning hard blockers: '
      + opts.planningChecks.hardBlockersFailed
          .map(function(c) { return c.label }).join(', ')
  })
}
```

**Behavioral impact:** This flag has `severity: 'high'`, which maps to
`risk = 'red'`. Features that were previously `green` (no execution-phase
flags) will turn `red` if they lack an RFE link (the only hard-blocker
check). This is an intentional behavioral change -- see Section 8 for the
mitigation via the mandatory `enablePlanningChecks` feature flag.

### 4.4 `health-routes.js` -- No API Changes Required

The existing `GET /releases/:version/health` endpoint already returns the full
health cache, which will now include `releasePhaseMode` and `planningChecks`
per feature. No new routes needed.

The `GET /releases/:version/health/summary` endpoint will automatically include
`summary.planningReadiness` when the release is in planning mode.

### 4.5 Demo Fixture Updates

Update `fixtures/releases/planning/health-cache-demo.json`:
- Add `releasePhaseMode: 'planning'` to root (hardcoded, not derived from dates)
- Add `planningChecks` to each feature
- Add `planningReadiness` to summary
- Change `gaFreeze` to a far-future date (e.g., `2099-12-31`) to prevent the
  demo fixture from silently flipping from `planning` to `execution` mode as
  time passes. Alternatively, hardcode `releasePhaseMode` in the fixture so
  the demo is date-independent.

---

## 5. Frontend Changes

### 5.1 Outcomes Tab -- Planning Readiness in DashboardView

**IMPORTANT:** `SummaryCards.vue` is NOT imported or rendered by
`DashboardView.vue`. The recent branch commit (`da1600b5`) explicitly removed
the Features/RFEs tabs and summary cards from the Outcomes Dashboard.
`SummaryCards.vue` exists as a standalone component used only in tests. All
planning readiness info for the Outcomes tab must be added directly to
`DashboardView.vue` or to `BigRocksTable.vue`.

**File:** `modules/releases/client/plan/views/DashboardView.vue`

Add a planning readiness banner/section above the Big Rocks table when
`releasePhaseMode === 'planning'`. This is rendered directly in
`DashboardView.vue` (not via `SummaryCards.vue`):

```
+---------------------------------------------------+
| Planning Phase -- GA Code Freeze: 2026-08-01      |
| 45 features checked                               |
|                                                    |
| Ready: 30 (67%)  |  Hard Blockers: 5  |  Warnings: 10 |
+---------------------------------------------------+
```

This banner appears between the filter bar and the Big Rocks table. It replaces
no existing component -- it is new inline content in `DashboardView.vue`.

**File:** `modules/releases/client/plan/composables/useHealthAggregation.js`

Add new computeds:
```javascript
var planningReadiness = computed(function() {
  if (!healthData.value || !healthData.value.summary) return null
  return healthData.value.summary.planningReadiness || null
})

var releasePhaseMode = computed(function() {
  return healthData.value ? healthData.value.releasePhaseMode || 'unknown' : 'unknown'
})
```

These are returned from the composable and consumed by `DashboardView.vue` and
`BigRocksTable.vue`.

### 5.2 Outcomes Tab -- Big Rocks Table Planning Health Column

**File:** `modules/releases/client/plan/components/BigRocksTable.vue`

When `releasePhaseMode === 'planning'`, the existing HEALTH column in the Big
Rocks table changes its rendering:

- Instead of showing the worst risk level badge (green/yellow/red), show a
  planning readiness indicator: `5/8 ready` with a mini progress bar.
- Features with hard blockers show a red indicator.
- The tooltip on hover shows which checks are failing.

This is driven by the existing `rockHealth` computed but augmented with
planning check data:

**File:** `modules/releases/client/plan/composables/useHealthAggregation.js`

Extend `rockHealth` computed:
```javascript
if (releasePhaseMode.value === 'planning') {
  // count planning checks instead of risk levels
  result[rockName].planningReady = ...
  result[rockName].planningTotal = ...
  result[rockName].planningBlockers = ...
}
```

### 5.3 Health Tab -- Planning Checks Detail Column

**File:** `modules/releases/client/plan/views/HealthDashboardView.vue`

When `releasePhaseMode === 'planning'`:

1. Show a banner at the top: "This release is in the **planning** phase (GA
   code freeze: {date}). Showing planning readiness checks."

2. The `HealthSummaryCards` component receives `planningReadiness` data and
   renders planning-specific summary cards (Planning Readiness, Hard Blockers,
   DoR-P Checks breakdown) instead of the execution-phase DoR/DoD/RICE cards.

3. The `FeatureHealthTable` adds a "Planning Checks" expandable column that
   shows the per-feature DoR-P check results as a checklist.

**File:** `modules/releases/client/plan/components/FeatureHealthTable.vue`

Add a new column to the `columns` array for planning checks. The column
definition in `FeatureHealthTable.vue` defines the `<th>` header.

**File:** `modules/releases/client/plan/components/FeatureHealthRow.vue`

Add a corresponding `<td>` cell for the planning checks column. This is
critical -- `FeatureHealthTable.vue` defines column headers (`<th>`) but each
row's `<td>` cells are rendered by `FeatureHealthRow.vue`. Adding a `<th>`
without a matching `<td>` breaks the table layout.

The planning checks cell in `FeatureHealthRow.vue` renders as:
- A mini progress bar showing `passedCount/totalCount`
- A red badge if `hasHardBlockers` is true

In the expanded detail row (`FeatureHealthRow.vue` already renders a
`PlanningGateStatus` component for DoR/DoD), extend `PlanningGateStatus.vue`
to also render planning checks (DoR-P series) when provided. See below.

```
Feature Key | Summary | Planning Checks     | Risk    | DoR | DoD
------------|---------|---------------------|---------|-----|----
RHOAIENG-1  | MaaS..  | 4/5 [=====]  1 blocker | yellow | ... | ...
```

**File:** `modules/releases/client/plan/components/PlanningGateStatus.vue`

The existing `PlanningGateStatus.vue` already renders DoR blockers, DoR
warnings, and DoD checks in a checklist format with pass/fail icons. Rather
than creating a new `PlanningChecksCell.vue` component, extend
`PlanningGateStatus.vue` with an optional `planningChecks` prop:

```javascript
const props = defineProps({
  dor: { type: Object, default: null },
  dod: { type: Object, default: null },
  planningStatus: { type: String, default: '' },
  planningChecks: { type: Object, default: null }  // NEW
})
```

When `planningChecks` is provided, render a "Planning Readiness" section after
the existing DoD section, using the same checklist styling (green check / red X
icons). This reuses the existing component rather than creating a new one,
keeping the UI consistent and avoiding duplication.

For the compact table cell rendering (the `<td>` in `FeatureHealthRow.vue`),
render the mini progress bar inline rather than through a separate component.

### 5.4 Health Tab -- Planning Summary Cards

**File:** `modules/releases/client/plan/components/HealthSummaryCards.vue`

Add conditional rendering for planning mode. When `releasePhaseMode === 'planning'`:

```javascript
var planningCards = computed(function() {
  var p = props.planningReadiness || {}
  return [
    { label: 'Planning Ready', count: p.fullyReady, total: p.totalChecked, color: 'green' },
    { label: 'Hard Blockers', count: p.withHardBlockers, total: p.totalChecked, color: 'red', invert: true },
    { label: 'RFE Linked', count: (p.byCheck || {})['DoR-P5'] || 0, total: p.totalChecked, color: 'indigo' },
    { label: 'Epics Created', count: (p.byCheck || {})['DoR-P4'] || 0, total: p.totalChecked, color: 'blue' }
  ]
})
```

The existing execution-phase cards (DoR Passed, DoD Passed, Strategy Signed Off,
RICE Complete) are shown only when `releasePhaseMode === 'execution'`.

---

## 6. Data Flow Diagram

```
                                    Product Pages Cache
                                    (releases/delivery/product-pages-releases-cache.json)
                                          |
                                          v
                                   loadMilestones()
                                          |
                                          v
                              +------------------------+
                              |  deriveReleasePhaseMode |
                              |  today < gaFreeze?      |
                              +----+-------------------+
                                   |
                          +--------+--------+
                          |                 |
                       planning          execution
                          |                 |
                          v                 v
                 computeDoR() +       computeDoR()
                 computePlanningChecks()  (existing only)
                          |                 |
                          v                 v
                 computeFeatureRisk()  computeFeatureRisk()
                 + PLANNING_INCOMPLETE   (existing 3 checks)
                          |                 |
                          +--------+--------+
                                   |
                                   v
                          health-cache-{ver}-{phase}.json
                          + releasePhaseMode
                          + per-feature planningChecks
                          + summary.planningReadiness
                                   |
                          +--------+--------+
                          |                 |
                          v                 v
                  Outcomes Tab         Health Tab
                  (DashboardView.vue)  (HealthDashboardView.vue)
                  - Planning readiness - Planning banner
                    banner (inline)    - Planning summary cards
                  - Big Rock health    - Planning checks column
                    column (adapted)   - Feature checklist detail
                                       - PlanningGateStatus extended
```

---

## 7. Files Modified / Created

### Modified Files

| File | Change |
|---|---|
| `modules/releases/server/planning/constants.js` | Add `PLANNING_INCOMPLETE` risk category |
| `modules/releases/server/planning/health/planning-gates.js` | Add `computePlanningChecks()`, export it |
| `modules/releases/server/planning/health/health-pipeline.js` | Add `deriveReleasePhaseMode()`, enrich `epicCount` from execution index, integrate planning checks in Step 5, add to cache output |
| `modules/releases/server/planning/health/risk-engine.js` | Add `PLANNING_INCOMPLETE` flag when planning checks have hard blockers |
| `modules/releases/server/planning/config.js` | Add `enablePlanningChecks: false` to default healthConfig |
| `modules/releases/client/plan/composables/useHealthAggregation.js` | Add `planningReadiness`, `releasePhaseMode` computeds; adapt `rockHealth` for planning mode |
| `modules/releases/client/plan/components/BigRocksTable.vue` | Adapt HEALTH column for planning mode |
| `modules/releases/client/plan/components/HealthSummaryCards.vue` | Add conditional planning-mode summary cards |
| `modules/releases/client/plan/components/FeatureHealthTable.vue` | Add Planning Checks column header (`<th>`) |
| `modules/releases/client/plan/components/FeatureHealthRow.vue` | Add Planning Checks cell (`<td>`) with mini progress bar; pass `planningChecks` to expanded `PlanningGateStatus` |
| `modules/releases/client/plan/components/PlanningGateStatus.vue` | Add optional `planningChecks` prop; render DoR-P checklist in expanded detail |
| `modules/releases/client/plan/views/DashboardView.vue` | Add inline planning readiness banner; pass `releasePhaseMode` and `planningReadiness` to child components |
| `modules/releases/client/plan/views/HealthDashboardView.vue` | Add planning mode banner, pass planning data to components |
| `fixtures/releases/planning/health-cache-demo.json` | Add `releasePhaseMode` and planning checks data; use far-future `gaFreeze` (see m4) |
| `docs/DATA-FORMATS.md` | Document new health cache fields: `releasePhaseMode`, per-feature `planningChecks`, `summary.planningReadiness` |

### New Files

| File | Purpose |
|---|---|
| `modules/releases/__tests__/server/planning/planning-checks.test.js` | Unit tests for `computePlanningChecks()` |
| `modules/releases/__tests__/server/planning/release-phase-mode.test.js` | Unit tests for `deriveReleasePhaseMode()` |

Note: `PlanningChecksCell.vue` from the original plan is no longer needed.
The compact cell rendering is inline in `FeatureHealthRow.vue`, and the
expanded checklist view reuses the existing `PlanningGateStatus.vue`.

---

## 8. Backward Compatibility Analysis

### Data Format: No Breaking Changes

| Concern | Assessment |
|---|---|
| Health cache format | Additive only. New fields (`releasePhaseMode`, `planningChecks`, `planningReadiness`) are added alongside existing fields. Consumers that don't read them are unaffected. |
| DoR result shape | The existing `blockers` and `warnings` arrays are unchanged. The new `planningChecks` array is a separate field on the DoR result object. |
| API responses | The health API returns the full cache, which now has additional fields. No existing fields are removed or renamed. |
| Feature readiness | The `feature-readiness.js` system is not modified. It continues to operate independently for the Feature Readiness view. |
| Demo mode | Demo fixtures are updated with the new fields, but graceful fallbacks ensure the UI renders correctly with old fixture data (planning fields default to null). |

### Behavioral Change: Risk Levels Affected When Enabled

**`PLANNING_INCOMPLETE` turns previously-green features red.** When
`enablePlanningChecks` is `true` and a release is in planning mode, features
that lack an RFE link (DoR-P5 hard-blocker) will receive a
`PLANNING_INCOMPLETE` flag with `severity: 'high'`, which maps to `risk = 'red'`.
This means features that were previously green (no execution-phase risk flags)
can turn red.

This is **intentional** -- the whole point of planning checks is to surface
features that are not ready for planning. However, it IS a behavioral change
that stakeholders should be aware of.

**Mitigation:** The mandatory `enablePlanningChecks` feature flag (see Section
10.3) defaults to `false`. Planning checks are only activated when explicitly
enabled in the health config. This allows gradual rollout:

1. Deploy with `enablePlanningChecks: false` (default) -- zero behavioral change.
2. Enable on dev/preprod to validate the impact.
3. Communicate the expected risk level changes to stakeholders.
4. Enable on prod.

### Graceful Degradation

- If `releasePhaseMode` is missing from the cache, the UI treats it as `'unknown'`
  and shows the existing execution-mode view.
- If `planningChecks` is null on a feature, the Planning Checks column shows "--".
- If `planningReadiness` is null in summary, the Planning Readiness summary card
  is hidden.
- If milestones are unavailable (no Product Pages, no Smartsheet),
  `releasePhaseMode` is `'unknown'` and planning checks are skipped.

---

## 9. Testing Strategy

### 9.1 Unit Tests

**`planning-checks.test.js`** (new):
- `computePlanningChecks()` with all fields present -- all pass
- `computePlanningChecks()` with missing components -- DoR-P1 fails
- `computePlanningChecks()` with missing PM -- DoR-P2 fails
- `computePlanningChecks()` with no release type -- DoR-P3 fails
- `computePlanningChecks()` with 0 epics -- DoR-P4 fails
- `computePlanningChecks()` with no RFE link -- DoR-P5 fails (hard-blocker)
- `computePlanningChecks()` with only hard-blocker failing -- `hasHardBlockers: true`
- `computePlanningChecks()` with only warnings failing -- `hasHardBlockers: false`

**`release-phase-mode.test.js`** (new):
- `deriveReleasePhaseMode('Pre-EA1')` -- returns 'planning'
- `deriveReleasePhaseMode('EA1 Freeze')` -- returns 'planning'
- `deriveReleasePhaseMode('Post-EA1')` -- returns 'planning'
- `deriveReleasePhaseMode('EA2 Freeze')` -- returns 'planning'
- `deriveReleasePhaseMode('Post-EA2')` -- returns 'planning'
- `deriveReleasePhaseMode('GA Freeze')` -- returns 'execution'
- `deriveReleasePhaseMode('Post-GA')` -- returns 'execution'
- `deriveReleasePhaseMode('Unknown')` -- returns 'unknown'
- `deriveReleasePhaseMode(null)` -- returns 'unknown'

**Existing test updates:**
- `planning-gates.test.js` -- add tests for `computePlanningChecks` export
- `health-pipeline.test.js` -- add tests for planning mode in `runHealthPipeline`
- `risk-engine.test.js` -- add tests for `PLANNING_INCOMPLETE` flag

### 9.2 Component Tests

**Existing test updates:**
- `health-components.test.js` -- add tests for planning mode rendering in
  HealthSummaryCards and PlanningGateStatus with `planningChecks` prop
- `FeatureHealthTable` tests -- add tests for planning checks column header
- `FeatureHealthRow` tests -- add tests for planning checks cell rendering
  (mini progress bar, hard-blocker badge, null handling)

### 9.3 Demo Mode Testing

- Run `npm run dev:full` with `DEMO_MODE=true` and `VITE_DEMO_MODE=true`
- Verify the demo fixture shows planning readiness in the Outcomes tab
- Verify the demo fixture shows planning checks in the Health tab
- Verify the UI gracefully handles old demo fixture format (no planning fields)

### 9.4 Smoke Tests

Existing smoke tests (`tests/smoke/app-loads.spec.js`) cover general app loading
and should continue to pass. No new smoke tests needed unless new routes are
added (none are).

### 9.5 Integration Tests

Add to `tests/integration/releases.spec.js`:
- Navigate to Outcomes tab, verify planning readiness banner is visible
- Navigate to Health tab, verify planning mode banner is visible
- Verify planning checks column renders in feature health table

**CI filter update required:** The `releases` filter in
`.github/workflows/integration-tests.yml` currently only covers
`modules/releases/server/execution/**` and `modules/releases/client/execute/**`.
Expand it to include:
- `modules/releases/server/planning/**`
- `modules/releases/client/plan/**`
- `tests/integration/releases.spec.js` (already covered)

---

## 10. Deployment Considerations

### 10.1 CI/CD

- No new routes, so no OpenAPI annotation changes required.
- Existing CI checks (lint, test, build, kustomize validate) apply.
- Demo fixture updates must pass `validate:modules`.

### 10.2 Rollout

- **Low-risk deployment** (gated by `enablePlanningChecks` flag). All changes
  are additive when the flag is off. The health pipeline continues to run on
  its existing schedule (CronJob every 15 minutes). The next pipeline run after
  deployment will produce caches with the new fields.
- No ConfigMap changes needed (no new env vars, no new config keys).
- No database migration (filesystem storage).
- The planning mode detection is derived from `computeMilestoneInfo().currentPhase`
  -- no manual activation needed.
- **`healthCacheVersion`** bumped from `2` to `3` to signal the schema change.
  Existing consumers that check version will see the bump; those that don't are
  unaffected since all new fields are additive with null/undefined fallbacks.

### 10.3 Feature Flag (Mandatory)

A config flag `enablePlanningChecks` MUST be added to `healthConfig` in
`data/releases/planning/config.json`, following the established pattern of
`enableStratCreator` and `enableRice` (see `config.js` lines 18-19). Default
value: `false`.

This is mandatory because `PLANNING_INCOMPLETE` is a `severity: 'high'` risk
flag that turns previously-green features red when they lack RFE links.
Deploying without a flag would immediately change the risk profile of all
planning-phase features, which could alarm stakeholders.

The flag is checked in `health-pipeline.js` (Step 5) before calling
`computePlanningChecks()`:
```javascript
if (releasePhaseMode === 'planning' && healthConfig.enablePlanningChecks) {
  planningChecks = computePlanningChecks(feature, enrichment, dorOpts)
}
```

The flag is also passed to `computeFeatureRisk()`:
```javascript
if (opts.releasePhaseMode === 'planning' && opts.enablePlanningChecks
    && opts.planningChecks && opts.planningChecks.hasHardBlockers) {
  // ... add PLANNING_INCOMPLETE flag
}
```

Rollout:
1. Deploy with `enablePlanningChecks: false` (default) -- zero behavioral change.
2. Enable on dev/preprod via Settings UI to validate impact.
3. Communicate expected risk level changes to stakeholders.
4. Enable on prod.

---

## 11. Implementation Phases

### Phase 1: Backend Planning Checks (est. 1-2 days)

1. Add `enablePlanningChecks: false` to default healthConfig in `config.js`
2. Add `PLANNING_INCOMPLETE` to `constants.js`
3. Implement `computePlanningChecks()` in `planning-gates.js`
4. Implement `deriveReleasePhaseMode()` in `health-pipeline.js` (using `computeMilestoneInfo().currentPhase`)
5. Add `epicCount` enrichment from execution index in `health-pipeline.js`
6. Integrate into `runHealthPipeline()` Step 5 (per-feature loop), gated by `enablePlanningChecks`
7. Add `PLANNING_INCOMPLETE` flag to `risk-engine.js`
8. Write unit tests for all new functions
9. Update demo fixture (use far-future `gaFreeze` to avoid date sensitivity)
10. Update `docs/DATA-FORMATS.md` with new health cache fields

### Phase 2: Outcomes Tab Frontend (est. 1 day) -- FIRST

**Recommend spawning a UX teammate for this phase.**

1. Update `useHealthAggregation.js` with `planningReadiness` and `releasePhaseMode` computeds
2. Add planning readiness banner to `DashboardView.vue` (inline, not via `SummaryCards.vue`)
3. Update `BigRocksTable.vue` HEALTH column for planning mode
4. Write component tests

### Phase 3: Health Tab Frontend (est. 1-2 days)

**Recommend spawning a UX teammate for this phase.**

1. Add `planningChecks` prop to `PlanningGateStatus.vue` (extend, not replace)
2. Update `HealthSummaryCards.vue` for planning mode
3. Update `FeatureHealthTable.vue` with planning checks column header
4. Update `FeatureHealthRow.vue` with planning checks cell and expanded detail
5. Update `HealthDashboardView.vue` with planning mode banner
6. Write component tests

### Phase 4: Polish and Integration Tests (est. 0.5 day)

1. End-to-end testing in demo mode
2. Add integration test cases to `tests/integration/releases.spec.js`
3. Expand `releases` filter in `.github/workflows/integration-tests.yml`
4. Code review prep

---

## 12. Open Questions for Phase 1b Review

1. ~~**Feature flag?**~~ **Resolved.** `enablePlanningChecks` is mandatory in
   healthConfig, defaulting to `false`. See Section 10.3.

2. ~~**Hard blocker severity for DoR-P1 through DoR-P4:**~~ **Resolved.** All 5
   planning checks (DoR-P1 through P5) are hard-blockers per stakeholder
   decision (2026-06-09).

3. **Testing requirements (not yet available):** The PDF lists "Testing
   requirements (unit, functional, integration, non-functional) are defined" as
   part of the DoR. This data isn't currently in the execution pipeline. Should
   we plan a future Jira enrichment pass to check for test-related labels or
   linked test plan issues?

4. **Architecture review sign-off:** The PDF mentions "Architecture Review
   sign-off of a proposed UI prototype or (micro)components." The strat-creator
   rubric partially covers this. Is the current strat-creator coverage
   sufficient, or do we need a separate check?

5. ~~**UI priority:**~~ **Resolved.** Outcomes tab first (Phase 2), then Health
   tab (Phase 3), per stakeholder decision (2026-06-09).

---

## 13. Appendix: PDF Hard Blocker Criteria Mapping

From the "Feature Definition of Ready" flowchart:

| # | PDF Criterion | Check ID | Available? | Source |
|---|---|---|---|---|
| 1 | Source RFE key is set and linked back to approved RFE | DoR-P5 | Yes | execution pipeline `issueLinks` |
| 2 | Target Version is set (3.x, EA1/EA2/GA) | DoR-W2 | Yes | existing DoR warning |
| 3 | Component(s) field is set | DoR-P1 | Yes | execution pipeline `components` |
| 4 | Product Manager field is set | DoR-P2 | Yes | execution pipeline `pm` |
| 5 | Assignee/Delivery Owner field is set | DoR-W1 | Yes | existing DoR warning |
| 6 | Release Type (DP/TP/GA) consistent with Priority Enum | DoR-P3 | Partial | execution pipeline `releaseType` |
| 7 | RICE score present | DoR-B2 | Yes | existing DoR blocker |
| 8 | Strategy Human Sign-off label | DoR-B1 | Yes | existing DoR blocker |
| 9 | Child epics created | DoR-P4 | Yes | execution pipeline `epicCount` |
| 10 | Acceptance Criteria present (quantify, qualify, testable) | Future | No | needs Jira enrichment (description parsing) |
| 11 | Testing requirements defined (unit, functional, integration) | Future | No | needs test plan linking |
| 12 | Dependencies identified and linked | DoR-W3 | Yes | existing DoR warning |
| 13 | Non-functional requirements (security, perf, interop) | Future | No | needs Jira enrichment |
| 14 | Architecture Review sign-off | Partial | Partial | strat-creator rubric |
| 15 | Special CI/environment needs identified | Future | No | needs Jira enrichment |
| 16 | Onboarding/license validation noted | Future | No | needs Jira enrichment |
| 17 | Feature status is "To Do" or later | -- | Yes | existing status check |

**Coverage: 10 of 17 criteria available now (59%). 5 more are partially
covered or deferred. 2 need new Jira enrichment.**

---

## 14. Review Feedback Resolution Log

Changes made during Phase 1b review revision:

### Critical

| ID | Issue | Resolution |
|---|---|---|
| C1 | `SummaryCards.vue` is orphaned -- not rendered on Outcomes Dashboard | Verified: `DashboardView.vue` does NOT import `SummaryCards.vue`. Revised Section 5.1 to add planning readiness info as an inline banner in `DashboardView.vue`. Updated data flow diagram and files-modified table. |
| C2 | `epicCount` not available on health features from candidates path | Verified: `mapCandidateToHealthFeature()` (line 96-113) does not map `epicCount`. Added Section 4.2a to enrich from execution index. Updated `mapCandidateToHealthFeature()` spec to include the field. |
| C3 | `FeatureHealthRow.vue` missing from files-modified list | Verified: `FeatureHealthTable.vue` defines `<th>` headers; `FeatureHealthRow.vue` renders `<td>` cells. Added `FeatureHealthRow.vue` to files-modified table with description. |

### Major

| ID | Issue | Resolution |
|---|---|---|
| M1 | `deriveReleasePhaseMode()` duplicates `computeMilestoneInfo().currentPhase` | Verified: `computeMilestoneInfo()` already computes granular `currentPhase` values. Revised `deriveReleasePhaseMode()` to derive from `currentPhase` instead of raw date comparison. Updated Sections 3.4, 4.2, data flow diagram. |
| M2 | Step numbers don't match actual `runHealthPipeline()` code | Verified: Step 4 is "Load overrides", Step 5 is the per-feature loop. Corrected step references in Sections 2.3 and 3.2. |
| M3 | `docs/DATA-FORMATS.md` not in files-modified table | Added to files-modified table with description of new fields. |
| M4 | Feature flag must be mandatory, not optional | Moved from optional (Section 10.3) to mandatory Phase 1 implementation. Added to `config.js` default, gated pipeline integration, updated rollout plan. |
| M5 | `PLANNING_INCOMPLETE` turns green features red -- contradicts backward compat claim | Revised Section 8 to honestly acknowledge the behavioral change. Documented mitigation via mandatory feature flag with `false` default. |

### Minor

| ID | Issue | Resolution |
|---|---|---|
| m1 | Consider reusing `PlanningGateStatus.vue` instead of new `PlanningChecksCell.vue` | Verified: `PlanningGateStatus.vue` renders DoR/DoD checklists with pass/fail icons. Extended it with optional `planningChecks` prop. Removed `PlanningChecksCell.vue` from new files list. |
| m2 | `healthCacheVersion` should be bumped | Added version bump from 2 to 3 in Section 10.2. |
| m3 | Integration test CI filter needs expansion | Added CI filter expansion note to Section 9.5 and Phase 4 implementation plan. |
| m4 | Demo fixture `gaFreeze` date sensitivity | Updated Section 4.5 to use far-future dates or hardcode `releasePhaseMode`. |
