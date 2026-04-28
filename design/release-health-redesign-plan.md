# Release Health Dashboard Redesign -- Implementation Plan

**Date:** 2026-04-27
**Status:** Revised after review
**Supersedes:** `2026-04-26-release-plan-health-redesign.md` (draft)

---

## Table of Contents

1. [Overview](#overview)
2. [Priority Formula](#priority-formula)
3. [PR Strategy](#pr-strategy)
4. [Phase 1: Backend Foundation](#phase-1-backend-foundation)
5. [Phase 2: Frontend -- Summary Cards, Timeline, and Tabs](#phase-2-frontend----summary-cards-timeline-and-tabs)
6. [Phase 3: Frontend -- Table Redesign and Filters](#phase-3-frontend----table-redesign-and-filters)
7. [Phase 4: T-Shirt Size Discovery](#phase-4-t-shirt-size-discovery)
8. [Testability](#testability)
9. [Deployability](#deployability)
10. [Affected APIs and Backward Compatibility](#affected-apis-and-backward-compatibility)
11. [Review Resolution](#review-resolution)

---

## Overview

Redesign the Release Plan Health dashboard to become the primary planning
instrument for release management. The current dashboard shows a flat list of
features with risk badges. The redesign adds:

- **Phase tabs** (EA1 / EA2 / GA) showing phase-scoped feature lists, each
  with its own timeline window
- **Summary cards**: RICE Score Present, Owner Assigned, Scope Estimated, DoR
  Complete
- **Combined Risk + DoR column** in the feature table (risk color dot + DoR
  percentage; flag count in tooltip)
- **Dual timeline markers** showing both planning freeze and code freeze
- **Component multi-select filter** with removable chip/tag UI
- **Composite priority score** (RICE 30%, Big Rock 30%, Feature Priority 25%,
  Inverse Complexity 15%)
- **T-shirt size discovery** via Jira description parsing

---

## Priority Formula

The composite priority score combines four signals with the user's requested
weights:

| Signal | Weight | Source | Normalization |
|---|---|---|---|
| RICE Score | 30% | `rice-scorer.js` output | Min-max across features in the release (0-1) |
| Big Rock Membership | 30% | `tier` field from candidates pipeline | Tier 1 = 1.0, Tier 2 = 0.6, Tier 3 = 0.2 |
| Feature Priority | 25% | Jira `priority` field | Blocker=1.0, Critical=0.8, Major=0.6, Normal=0.4, Minor=0.2 |
| Inverse Complexity | 15% | T-shirt size (parsed from description) | XS=1.0, S=0.8, M=0.6, L=0.4, XL=0.2, Unknown=0.5 |

**Formula:** `score = (rice_norm * 0.30) + (bigrock_norm * 0.30) + (priority_norm * 0.25) + (complexity_norm * 0.15)`

Score range: 0.0 to 1.0. Displayed as a 0-100 integer.

When RICE data is unavailable for a feature (common early in planning), its
RICE component uses the release-wide median rather than 0, so features are not
penalized for missing RICE fields.

---

## PR Strategy

Four PRs, each independently reviewable and deployable. Each builds on the
previous but the backend PRs are safe to merge independently because the
frontend changes are purely additive.

| PR | Name | Scope | Depends On |
|---|---|---|---|
| **PR 1** | Backend: Smartsheet fix + planning freeze dates + priority scorer | Backend only | None |
| **PR 2** | Frontend: Phase tabs + summary cards + timeline markers | Frontend + composable | PR 1 (for planning freeze data) |
| **PR 3** | Frontend: Combined column + component chip filter + table sort | Frontend only | PR 2 |
| **PR 4** | Backend + Frontend: T-shirt size parsing + inverse complexity | Full stack | PR 1 (for scorer) |

---

## Phase 1: Backend Foundation

**PR 1 -- Backend: Smartsheet fix + planning freeze dates + priority scorer**

### 1.1 Fix Smartsheet completeness filter for backfill

**File:** `shared/server/smartsheet.js`
**Lines 250-255** -- the `REQUIRED_MILESTONES` filter in `discoverReleasesWithFreezes()`

Currently, `discoverReleasesWithFreezes()` requires ALL 6 milestones (`ea1_freeze`,
`ea1_target`, `ea2_freeze`, `ea2_target`, `ga_freeze`, `ga_target`) to include
a version. For upcoming releases, not all milestones may be in Smartsheet yet
(e.g., GA dates may not be set when EA1 is being planned).

**Change:** Extract the shared sheet-fetch-and-parse logic (column mapping, row
regex parsing, milestone accumulation, version sorting, and field mapping) from
`discoverReleasesWithFreezes()` into a private helper `parseSmartsheetReleases(filterFn)`.
Both functions then call this helper with different filter predicates, eliminating
~60 lines of copy-paste duplication.

```javascript
// Private helper -- replaces the duplicated logic
var REQUIRED_MILESTONES = ['ea1_freeze', 'ea1_target', 'ea2_freeze', 'ea2_target', 'ga_freeze', 'ga_target']

async function parseSmartsheetReleases(filterFn) {
  var sheet = await fetchSheet()

  var colMap = {}
  for (var c = 0; c < sheet.columns.length; c++) {
    colMap[sheet.columns[c].title] = sheet.columns[c].id
  }
  var taskCol = colMap['Task Name']
  var startCol = colMap['Start']

  var milestones = {}

  for (var r = 0; r < sheet.rows.length; r++) {
    var row = sheet.rows[r]
    var cells = {}
    for (var ci = 0; ci < row.cells.length; ci++) {
      cells[row.cells[ci].columnId] = row.cells[ci].value
    }
    var task = cells[taskCol]
    var startVal = cells[startCol]
    if (!task || !startVal) continue

    var dateStr = String(startVal).split('T')[0]
    var m

    m = task.match(/^(\d+\.\d+)\.(EA[12])\s+(?:RHOAI\s+)?Code\s+Freeze/i)
    if (m) {
      if (!milestones[m[1]]) milestones[m[1]] = {}
      milestones[m[1]][m[2].toLowerCase() + '_freeze'] = dateStr
      continue
    }
    m = task.match(/^(\d+\.\d+)\.(EA[12])\s+(?:RHOAI\s+)?RELEASE/i)
    if (m) {
      if (!milestones[m[1]]) milestones[m[1]] = {}
      milestones[m[1]][m[2].toLowerCase() + '_target'] = dateStr
      continue
    }
    m = task.match(/^(\d+\.\d+)\s+(?:RHOAI\s+)?Code\s+Freeze$/i)
    if (m) {
      if (!milestones[m[1]]) milestones[m[1]] = {}
      milestones[m[1]].ga_freeze = dateStr
      continue
    }
    m = task.match(/^(\d+\.\d+)\s+(?:RHOAI\s+)?GA$/i)
    if (m) {
      if (!milestones[m[1]]) milestones[m[1]] = {}
      milestones[m[1]].ga_target = dateStr
      continue
    }
  }

  return Object.keys(milestones)
    .filter(function(version) { return filterFn(milestones[version]) })
    .sort(function(a, b) {
      var ap = a.split('.').map(Number)
      var bp = b.split('.').map(Number)
      return ap[0] - bp[0] || ap[1] - bp[1]
    })
    .map(function(version) {
      var ms = milestones[version]
      return {
        version: version,
        ea1Freeze: ms.ea1_freeze || null,
        ea1Target: ms.ea1_target || null,
        ea2Freeze: ms.ea2_freeze || null,
        ea2Target: ms.ea2_target || null,
        gaFreeze: ms.ga_freeze || null,
        gaTarget: ms.ga_target || null
      }
    })
}

// Refactored -- delegates to shared helper with strict filter
async function discoverReleasesWithFreezes() {
  return parseSmartsheetReleases(function(ms) {
    return REQUIRED_MILESTONES.every(function(key) { return !!ms[key] })
  })
}

// New function -- delegates to shared helper with relaxed filter
async function discoverReleasesPartial() {
  return parseSmartsheetReleases(function(ms) {
    return Object.keys(ms).length > 0
  })
}
```

Also refactor `discoverReleases()` to use `parseSmartsheetReleases()` with a
mapping step that drops freeze fields, keeping only target dates. This
eliminates the third copy of the same row-parsing logic.

**Then update** `health-pipeline.js` line 293 to call `discoverReleasesPartial()`
instead of `discoverReleasesWithFreezes()` in `backfillFreezeDatesFromSmartsheet()`:

```javascript
// health-pipeline.js, line 293
var releases = await smartsheetClient.discoverReleasesPartial()
```

This is the only caller that needs the relaxed filter. The pipeline already
handles null milestone fields gracefully (see `deriveFreezeDates()` on line 355).

### 1.2 Add planning freeze dates to health cache

**File:** `modules/release-planning/server/health/health-pipeline.js`

The health pipeline already computes `planningDeadline` (code freeze - 7 days)
on line 565 via `computePlanningDeadline()`. However, it only exposes the
deadline for the selected phase. We need planning freeze dates for ALL phases
in the milestones output so the frontend timeline can show them.

**Change:** In the cache object built at lines 664-696, add `planningFreezes`
alongside `milestones`:

```javascript
// Add after milestones block (line 667-676)
planningFreezes: milestones ? {
  ea1: milestones.ea1Freeze ? offsetDate(milestones.ea1Freeze, -PLANNING_DEADLINE_OFFSET_DAYS) : null,
  ea2: milestones.ea2Freeze ? offsetDate(milestones.ea2Freeze, -PLANNING_DEADLINE_OFFSET_DAYS) : null,
  ga: milestones.gaFreeze ? offsetDate(milestones.gaFreeze, -PLANNING_DEADLINE_OFFSET_DAYS) : null
} : null,
```

**Reuse existing date arithmetic:** The `deriveFreezeDates()` function (line 361)
already contains an `offset(dateStr)` inner function that does the same date
arithmetic. Extract it to a module-level helper `offsetDate(dateStr, days)` and
reuse it in both `deriveFreezeDates()` and the new `planningFreezes` block.
Do NOT add a second copy.

```javascript
// Extract to module level (replaces the inner function at line 361)
function offsetDate(dateStr, days) {
  var d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}
```

Update `deriveFreezeDates()` to call `offsetDate(dateStr, -FREEZE_OFFSET_DAYS)`
instead of its current inner `offset()` function.

### 1.3 Create composite priority scorer

**New file:** `modules/release-planning/server/health/priority-scorer.js`

```javascript
/**
 * Composite priority scoring.
 *
 * Combines four signals into a single 0-100 priority score:
 *   - RICE Score (30%): min-max normalized across all features
 *   - Big Rock Membership (30%): Tier 1=1.0, Tier 2=0.6, Tier 3=0.2
 *   - Feature Priority (25%): Blocker=1.0 ... Minor=0.2
 *   - Inverse Complexity (15%): XS=1.0 ... XL=0.2, Unknown=0.5
 */

var TIER_SCORES = { 1: 1.0, 2: 0.6, 3: 0.2 }

var PRIORITY_SCORES = {
  'Blocker': 1.0,
  'Critical': 0.8,
  'Major': 0.6,
  'Normal': 0.4,
  'Minor': 0.2
}

var TSHIRT_SCORES = {
  'XS': 1.0,
  'S': 0.8,
  'M': 0.6,
  'L': 0.4,
  'XL': 0.2
}

// Weights are hardcoded per user request. A future iteration could make
// these configurable via admin settings (stored in data/release-planning/
// health-config.json), but for now they are fixed constants.
var WEIGHTS = {
  rice: 0.30,
  bigRock: 0.30,
  priority: 0.25,
  complexity: 0.15
}

/**
 * Compute composite priority scores for a set of features.
 *
 * @param {Array<object>} features - Health pipeline features
 * @returns {Map<string, { score: number, breakdown: object }>}
 */
function computePriorityScores(features) {
  // Collect RICE scores for min-max normalization
  var riceValues = []
  for (var i = 0; i < features.length; i++) {
    if (features[i].rice && features[i].rice.score != null) {
      riceValues.push(features[i].rice.score)
    }
  }

  var riceMin = riceValues.length > 0 ? Math.min.apply(null, riceValues) : 0
  var riceMax = riceValues.length > 0 ? Math.max.apply(null, riceValues) : 0
  var riceRange = riceMax - riceMin

  // Compute median for fallback
  var riceMedian = 0.5
  if (riceValues.length > 0) {
    var sorted = riceValues.slice().sort(function(a, b) { return a - b })
    var mid = Math.floor(sorted.length / 2)
    var medianRaw = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
    riceMedian = riceRange > 0 ? (medianRaw - riceMin) / riceRange : 0.5
  }

  var results = new Map()

  for (var j = 0; j < features.length; j++) {
    var f = features[j]

    // RICE normalization
    var riceNorm = riceMedian // fallback
    if (f.rice && f.rice.score != null) {
      riceNorm = riceRange > 0 ? (f.rice.score - riceMin) / riceRange : 0.5
    }

    // Big Rock tier
    var tierNorm = TIER_SCORES[f.tier] || TIER_SCORES[3]

    // Feature priority
    var priorityNorm = PRIORITY_SCORES[f.priority] || PRIORITY_SCORES['Normal']

    // Inverse complexity (t-shirt size)
    var complexityNorm = TSHIRT_SCORES[f.tshirtSize] || 0.5

    var score = (riceNorm * WEIGHTS.rice) +
                (tierNorm * WEIGHTS.bigRock) +
                (priorityNorm * WEIGHTS.priority) +
                (complexityNorm * WEIGHTS.complexity)

    results.set(f.key, {
      score: Math.round(score * 100),
      breakdown: {
        rice: Math.round(riceNorm * 100),
        bigRock: Math.round(tierNorm * 100),
        priority: Math.round(priorityNorm * 100),
        complexity: Math.round(complexityNorm * 100)
      }
    })
  }

  return results
}

module.exports = {
  computePriorityScores: computePriorityScores,
  WEIGHTS: WEIGHTS,
  TIER_SCORES: TIER_SCORES,
  PRIORITY_SCORES: PRIORITY_SCORES,
  TSHIRT_SCORES: TSHIRT_SCORES
}
```

### 1.4 Integrate priority scorer into health pipeline

**File:** `modules/release-planning/server/health/health-pipeline.js`

After the risk computation loop (after line 658), add:

```javascript
// Step 6b: Compute composite priority scores
var priorityScores = computePriorityScores(healthFeatures)
for (var pi = 0; pi < healthFeatures.length; pi++) {
  var pKey = healthFeatures[pi].key
  var pResult = priorityScores.get(pKey)
  healthFeatures[pi].priorityScore = pResult ? pResult.score : null
  healthFeatures[pi].priorityBreakdown = pResult ? pResult.breakdown : null
}
```

Add the require at the top:

```javascript
const { computePriorityScores } = require('./priority-scorer')
```

### 1.5 Ensure per-feature data supports client-side summary card computation

**No new server-side summary counters.** The summary card counts (Owner Assigned,
Scope Estimated, RICE Complete, DoR Complete) must be phase-scoped. Since the
"all" view loads all features and phase tabs filter client-side, computing these
counters server-side (across ALL features) would show incorrect totals when a
phase tab is selected (e.g., EA1 tab would still show release-wide counts).

Instead, the summary cards will be computed client-side from `phasedFeatures`
(see section 2.1). The per-feature fields needed for these counts already exist
or are added elsewhere in this plan:

- **Owner Assigned:** `feature.deliveryOwner` (already present on health features, line 641)
- **Scope Estimated:** `feature.storyPoints` -- add this field to health features
  in the feature-building loop (carry from enrichment):
  ```javascript
  storyPoints: enrichment ? enrichment.storyPoints || null : null,
  ```
- **RICE Complete:** `feature.rice && feature.rice.score != null` (already present)
- **DoR Complete:** `feature.dor.completionPct >= 80` (already present)

### 1.6 Files changed in PR 1

| File | Action | Summary |
|---|---|---|
| `shared/server/smartsheet.js` | Modify | Extract `parseSmartsheetReleases()` helper; refactor `discoverReleasesWithFreezes()` and `discoverReleases()` to use it; add `discoverReleasesPartial()` |
| `modules/release-planning/server/health/health-pipeline.js` | Modify | Call `discoverReleasesPartial()` in backfill; extract `offsetDate()` to module level; add `planningFreezes` to cache; add `storyPoints` to health features; integrate priority scorer |
| `modules/release-planning/server/health/priority-scorer.js` | **New** | Composite priority scoring (RICE 30%, Big Rock 30%, Priority 25%, Complexity 15%) |
| `modules/release-planning/server/constants.js` | No change | Risk categories and constants already in place from prior work |

---

## Phase 2: Frontend -- Summary Cards, Timeline, and Tabs

**PR 2 -- Frontend: Phase tabs + summary cards + timeline markers**

### 2.1 Replace HealthSummaryCards with new card layout

**File:** `modules/release-planning/client/components/HealthSummaryCards.vue`

Replace the current 5-card layout (Green/Yellow/Red/DoR/Planning Deadline) with
4 new summary cards. The risk breakdown (green/yellow/red) moves into the
summary text of the On Track card.

**New card layout (4 cards, `grid-cols-2 lg:grid-cols-4`):**

| Card | Label | Value | Subtext | Color |
|---|---|---|---|---|
| 1 | RICE Score Present | `cardCounts.riceComplete` / `cardCounts.total` | percentage | indigo |
| 2 | Owner Assigned | `cardCounts.ownerAssigned` / `cardCounts.total` | percentage | blue |
| 3 | Scope Estimated | `cardCounts.scopeEstimated` / `cardCounts.total` | percentage | amber |
| 4 | DoR Complete | `cardCounts.dorComplete` / `cardCounts.total` | percentage | green |

**Client-side computation (phase-scoped):** Card counts are computed from
`phasedFeatures`, NOT from the server-side `summary` object. This ensures
that when the user selects the EA1 tab, the cards show counts for EA1
features only.

```javascript
var cardCounts = computed(function() {
  var feats = phasedFeatures.value
  var total = feats.length
  var ownerAssigned = 0
  var scopeEstimated = 0
  var riceComplete = 0
  var dorComplete = 0

  for (var i = 0; i < feats.length; i++) {
    var f = feats[i]
    if (f.deliveryOwner) ownerAssigned++
    if (f.storyPoints) scopeEstimated++
    if (f.rice && f.rice.score != null) riceComplete++
    if (f.dor && f.dor.completionPct >= 80) dorComplete++
  }

  return {
    total: total,
    ownerAssigned: ownerAssigned,
    scopeEstimated: scopeEstimated,
    riceComplete: riceComplete,
    dorComplete: dorComplete
  }
})
```

Pass `cardCounts` as a prop to `HealthSummaryCards.vue` instead of the
server-side `summary` object.

Each card shows a count fraction (e.g., "12 / 15") as the primary number and a
percentage bar beneath. The risk breakdown (green/yellow/red dots with counts)
moves to a small inline display beneath the page header, similar to how
`SummaryCards.vue` currently shows the health indicator in the Totals card
(lines 79-92).

**Remove:** The `@filterByRisk` event emission and the `handleCardClick`
handler. Risk filtering will be handled by the existing filter bar.

**Keep:** The planning deadline card as a standalone inline indicator beneath
the timeline (not one of the four cards). This remains phase-sensitive.

### 2.2 Add planning freeze markers to MilestoneTimeline

**File:** `modules/release-planning/client/components/MilestoneTimeline.vue`

**Change the `MILESTONE_ORDER` array** (line 8) to add planning freeze markers:

```javascript
const MILESTONE_ORDER = [
  { key: 'ea1PlanFreeze', label: 'EA1 Plan Freeze', color: 'bg-blue-300 dark:bg-blue-300', style: 'dashed' },
  { key: 'ea1Freeze', label: 'EA1 Code Freeze', color: 'bg-blue-500 dark:bg-blue-400' },
  { key: 'ea1Target', label: 'EA1 Release', color: 'bg-blue-600 dark:bg-blue-500' },
  { key: 'ea2PlanFreeze', label: 'EA2 Plan Freeze', color: 'bg-amber-300 dark:bg-amber-300', style: 'dashed' },
  { key: 'ea2Freeze', label: 'EA2 Code Freeze', color: 'bg-amber-500 dark:bg-amber-400' },
  { key: 'ea2Target', label: 'EA2 Release', color: 'bg-amber-600 dark:bg-amber-500' },
  { key: 'gaPlanFreeze', label: 'GA Plan Freeze', color: 'bg-green-300 dark:bg-green-300', style: 'dashed' },
  { key: 'gaFreeze', label: 'GA Code Freeze', color: 'bg-green-500 dark:bg-green-400' },
  { key: 'gaTarget', label: 'GA Release', color: 'bg-green-600 dark:bg-green-500' }
]
```

**Update the `milestonePoints` computed** to merge `planningFreezes` data:

```javascript
var milestonePoints = computed(function() {
  if (!props.milestones) return []
  var pf = props.planningFreezes || {}
  var combined = Object.assign({}, props.milestones, {
    ea1PlanFreeze: pf.ea1 || null,
    ea2PlanFreeze: pf.ea2 || null,
    gaPlanFreeze: pf.ga || null
  })
  // ... same loop over MILESTONE_ORDER
})
```

**Add prop:** `planningFreezes: { type: Object, default: null }`

**Visual distinction:** Planning freeze markers use a dashed border and slightly
lighter color. Add a `style` field to differentiate:

```html
<div
  class="w-3 h-3 rounded-full border-2"
  :class="[point.color, point.style === 'dashed' ? 'border-dashed border-gray-500' : 'border-white dark:border-gray-800']"
></div>
```

**Label collision strategy:** With 9 markers, labels will overlap when dates
cluster (e.g., planning freeze 7 days before code freeze). Use abbreviated
labels for planning freeze markers to reduce collision probability:

- "EA1 Plan Freeze" becomes "EA1 PF"
- "EA2 Plan Freeze" becomes "EA2 PF"
- "GA Plan Freeze" becomes "GA PF"

Additionally, when two adjacent markers are within 7 days of each other,
stack their labels vertically (alternate between `top-full` and `bottom-full`
positioning). Implement this in the `milestonePoints` computed by comparing
each point's date with its neighbors and assigning a `labelPosition` field
(`'above'` or `'below'`). The abbreviated labels and vertical stacking
together keep the timeline legible at any date density.

### 2.3 Add phase tabs to HealthDashboardView

**File:** `modules/release-planning/client/views/HealthDashboardView.vue`

**Tab architecture decision:** Load all phases into a single API response and
filter client-side. Rationale:

- The candidate pipeline already has all features for a version; phase filtering
  is a simple fixVersion string check (see `passesPhaseFilter()` in
  health-pipeline.js lines 63-86)
- Feature count per release is typically 30-80 (not thousands)
- Client-side filtering gives instant tab switching with no loading state
- The server already caches by version+phase; we consolidate to version+`all`
- Risk and DoR computations are per-feature and phase-independent

**Implementation:**

Replace the current `PhaseSelector` dropdown with inline tabs, following the
same pattern as `DashboardView.vue` (lines 118-131, 552-576).

```javascript
// New tab definitions
var phaseTabs = computed(function() {
  var tabs = [{ id: 'all', label: 'All Features' }]
  var ms = milestones.value
  if (!ms) return tabs
  if (ms.ea1Freeze || ms.ea1Target) tabs.push({ id: 'EA1', label: 'EA1' })
  if (ms.ea2Freeze || ms.ea2Target) tabs.push({ id: 'EA2', label: 'EA2' })
  if (ms.gaFreeze || ms.gaTarget) tabs.push({ id: 'GA', label: 'GA' })
  return tabs
})

var activePhase = ref('all')
```

Remove the import and usage of `PhaseSelector` component.

**Data loading:** On version change, call `loadHealth(version)` with no phase
parameter (loads all features). Tab switching filters client-side using the
existing `passesPhaseFilter` logic, ported to the frontend:

```javascript
// In the composable or view
var phasedFeatures = computed(function() {
  if (activePhase.value === 'all') return features.value
  return features.value.filter(function(f) {
    return passesPhaseFilter(f, selectedVersion.value, activePhase.value)
  })
})
```

Port the `passesPhaseFilter` function from `health-pipeline.js` (lines 63-86)
to a client-side utility.

**Planning deadline in the "all" tab:** The server-side `computePlanningDeadline()`
returns `null` when phase is null/undefined (line 160: `if (!milestones || !phase) return null`).
This means the `summary.planningDeadline` field will be `null` for the "all" view.

The frontend must compute the planning deadline client-side for the "all" tab.
Use the `planningFreezes` object from the health data and select the NEAREST
upcoming planning freeze date across all phases:

```javascript
var activePlanningDeadline = computed(function() {
  // For phase-specific tabs, use the server-computed deadline
  if (activePhase.value !== 'all') {
    return healthData.value ? healthData.value.summary.planningDeadline : null
  }

  // For the "all" tab, find the nearest future planning freeze
  var pf = healthData.value ? healthData.value.planningFreezes : null
  if (!pf) return null

  var today = new Date()
  var todayStr = today.toISOString().split('T')[0]
  var nearest = null

  var phases = ['ea1', 'ea2', 'ga']
  for (var i = 0; i < phases.length; i++) {
    var dateStr = pf[phases[i]]
    if (!dateStr || dateStr < todayStr) continue
    if (!nearest || dateStr < nearest.date) {
      var deadlineDate = new Date(dateStr + 'T00:00:00Z')
      var todayDate = new Date(todayStr + 'T00:00:00Z')
      nearest = {
        date: dateStr,
        daysRemaining: Math.ceil((deadlineDate - todayDate) / (1000 * 60 * 60 * 24))
      }
    }
  }

  return nearest
})
```

This ensures the planning deadline indicator beneath the timeline always shows
the most relevant (closest future) deadline, regardless of which tab is active.

**Tab count badges:** Each tab shows the count of features in that phase, using
the same badge pattern as `DashboardView.vue` line 571-575.

### 2.4 Wire up health data to MilestoneTimeline

**File:** `modules/release-planning/client/views/HealthDashboardView.vue`

Pass the new `planningFreezes` from the health data:

```html
<MilestoneTimeline
  :milestones="milestones"
  :planningFreezes="planningFreezes"
/>
```

```javascript
var planningFreezes = computed(function() {
  return healthData.value ? healthData.value.planningFreezes : null
})
```

### 2.5 Files changed in PR 2

| File | Action | Summary |
|---|---|---|
| `modules/release-planning/client/views/HealthDashboardView.vue` | Modify | Replace PhaseSelector with inline tabs; pass planningFreezes to timeline; compute `cardCounts` and `activePlanningDeadline` client-side from `phasedFeatures`; rewire summary cards |
| `modules/release-planning/client/components/HealthSummaryCards.vue` | Modify | Replace 5-card layout with 4 readiness cards; accept `cardCounts` prop instead of server `summary` |
| `modules/release-planning/client/components/MilestoneTimeline.vue` | Modify | Add planning freeze markers with abbreviated labels and label collision strategy; accept `planningFreezes` prop |
| `modules/release-planning/client/components/PhaseSelector.vue` | Delete | Replaced by inline tabs |
| `modules/release-planning/client/utils/phase-filter.js` | **New** | Client-side `passesPhaseFilter()` ported from health-pipeline.js |
| `modules/release-planning/__tests__/client/health-components.test.js` | Modify | Remove PhaseSelector tests (describe block at line 210); add tests for new summary card layout |

---

## Phase 3: Frontend -- Table Redesign and Filters

**PR 3 -- Frontend: Combined column + component chip filter + priority column**

### 3.1 Combine Risk + DoR into a single column

**File:** `modules/release-planning/client/components/FeatureHealthRow.vue`

Replace the separate Risk and DoR columns (currently columns 5 and 6 in
`FeatureHealthTable.vue` line 24-25) with a single "Health" column.

**Cell content:** Risk color dot + DoR percentage. Flag count shown in tooltip.

```html
<!-- Health cell (replaces separate Risk and DoR cells) -->
<td class="px-3 py-2 border border-gray-300 dark:border-gray-600">
  <div class="flex items-center gap-1.5" :title="healthTooltip">
    <!-- Risk dot (w-2.5 h-2.5 = 10x10px for accessibility) -->
    <span
      class="w-2.5 h-2.5 rounded-full flex-shrink-0"
      role="img"
      :aria-label="'Risk level: ' + effectiveRisk"
      :class="{
        'bg-green-500': effectiveRisk === 'green',
        'bg-yellow-500': effectiveRisk === 'yellow',
        'bg-red-500': effectiveRisk === 'red'
      }"
    ></span>
    <!-- DoR percentage -->
    <span
      class="text-xs font-medium"
      :class="dorPctClass"
    >{{ dorPct }}%</span>
  </div>
</td>
```

**Tooltip content** (via `title` attribute or a custom tooltip component):

```javascript
var healthTooltip = computed(function() {
  var lines = []
  lines.push('Risk: ' + effectiveRisk.charAt(0).toUpperCase() + effectiveRisk.slice(1))
  lines.push('DoR: ' + dorPct + '% (' + feature.dor.checkedCount + '/' + feature.dor.totalCount + ')')
  if (riskFlags.length > 0) {
    lines.push(riskFlags.length + ' risk flag(s):')
    for (var i = 0; i < riskFlags.length; i++) {
      lines.push('  - ' + riskFlags[i].category + ': ' + riskFlags[i].message)
    }
  }
  if (riskOverride) {
    lines.push('Override: ' + riskOverride.riskOverride + ' (' + riskOverride.reason + ')')
  }
  return lines.join('\n')
})
```

**Update `FeatureHealthTable.vue`** columns array (line 19-30):

```javascript
var columns = [
  { key: 'expand', label: '', sortable: false },
  { key: 'key', label: 'Feature', sortable: true },
  { key: 'summary', label: 'Summary', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'health', label: 'Health', sortable: true },     // combined Risk + DoR
  { key: 'priority', label: 'Priority', sortable: true },  // composite score
  { key: 'rice', label: 'RICE', sortable: true },
  { key: 'components', label: 'Component', sortable: true },
  { key: 'owner', label: 'Owner', sortable: true },        // new column
  { key: 'phase', label: 'Phase', sortable: true },
  { key: 'tier', label: 'Tier', sortable: true }
]
```

**Sorting for the combined health column:** Sort by risk level first (red=0,
yellow=1, green=2), then by DoR % ascending within the same risk level:

```javascript
if (key === 'health') {
  va = RISK_ORDER[getRiskLevel(a)] * 1000 + (1000 - (a.dor ? a.dor.completionPct : 0))
  vb = RISK_ORDER[getRiskLevel(b)] * 1000 + (1000 - (b.dor ? b.dor.completionPct : 0))
}
```

**Sorting for priority:** Sort by composite priority score descending:

```javascript
if (key === 'priority') {
  va = a.priorityScore != null ? a.priorityScore : -1
  vb = b.priorityScore != null ? b.priorityScore : -1
}
```

**Expanded row colspan update:** The expanded detail row in `FeatureHealthRow.vue`
(line 159) currently uses `colspan="10"` matching the existing 10 columns. With
the redesign, the column count changes: Risk+DoR merge into Health (-1), and
Priority (+1) and Owner (+1) are added, bringing the total to 11 columns
(expand, feature, summary, status, health, priority, rice, components, owner,
phase, tier). Update the colspan to `11`.

### 3.2 Add composite priority score column

**File:** `modules/release-planning/client/components/FeatureHealthRow.vue`

Add a Priority cell that displays the composite score (0-100) with a color
gradient:

```html
<td class="px-3 py-2 border border-gray-300 dark:border-gray-600 text-center" :title="priorityTooltip">
  <span
    v-if="feature.priorityScore != null"
    class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold"
    :class="priorityScoreClass"
  >{{ feature.priorityScore }}</span>
  <span v-else class="text-gray-400 dark:text-gray-600 text-xs">-</span>
</td>
```

**Tooltip** shows the breakdown:

```javascript
var priorityTooltip = computed(function() {
  if (!props.feature.priorityBreakdown) return ''
  var b = props.feature.priorityBreakdown
  return 'RICE: ' + b.rice + '% (30w)\n' +
         'Big Rock: ' + b.bigRock + '% (30w)\n' +
         'Priority: ' + b.priority + '% (25w)\n' +
         'Complexity: ' + b.complexity + '% (15w)'
})
```

**Color classes:**

```javascript
var priorityScoreClass = computed(function() {
  var score = props.feature.priorityScore
  if (score >= 70) return 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
  if (score >= 40) return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
  return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
})
```

### 3.3 Replace component dropdown with multi-select chips

**File:** `modules/release-planning/client/components/HealthFilterBar.vue`

Replace the single `<select>` for components (lines 73-83) with a multi-select
chip/tag pattern. Follow the existing pattern from `FilterBar.vue` (lines
118-158) which already implements a multi-select dropdown for teams.

**New state in `HealthDashboardView.vue`:**

```javascript
// Replace:
var componentFilter = ref('')
// With:
var selectedComponents = ref([])

// Update filter logic:
// NOTE: Use a regex split to handle inconsistent comma spacing from Jira
// (e.g., "Comp1,Comp2" or "Comp1, Comp2" or "Comp1 , Comp2")
if (selectedComponents.value.length > 0) {
  var featureComps = f.components
    ? f.components.split(/\s*,\s*/).filter(Boolean)
    : []
  var hasMatch = selectedComponents.value.some(function(comp) {
    return featureComps.includes(comp)
  })
  if (!hasMatch) return false
}

// Build the component dropdown list by splitting ALL features' components
// and deduplicating:
var allComponents = computed(function() {
  var set = new Set()
  var feats = features.value || []
  for (var i = 0; i < feats.length; i++) {
    if (feats[i].components) {
      var parts = feats[i].components.split(/\s*,\s*/).filter(Boolean)
      for (var j = 0; j < parts.length; j++) {
        set.add(parts[j])
      }
    }
  }
  return Array.from(set).sort()
})
```

**HealthFilterBar.vue changes:**

Replace the component `<select>` with:

```html
<!-- Component multi-select with chips -->
<div v-if="components.length > 0" ref="compDropdownRef" class="relative">
  <button
    type="button"
    @click="compOpen = !compOpen"
    @keydown.escape="compOpen = false"
    :aria-expanded="compOpen"
    aria-haspopup="listbox"
    aria-label="Filter by component"
    :class="[selectClass, 'flex items-center gap-1.5 cursor-pointer']"
  >
    <span class="truncate max-w-[180px]">{{ compLabel }}</span>
    <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>
  <!-- Dropdown list -->
  <div
    v-if="compOpen"
    role="listbox"
    class="absolute z-50 mt-1 w-64 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg"
  >
    <label
      v-for="comp in components"
      :key="comp"
      class="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
    >
      <input
        type="checkbox"
        :checked="selectedComponents.includes(comp)"
        @change="toggleComponent(comp)"
        class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
      />
      <span class="truncate">{{ comp }}</span>
    </label>
  </div>
</div>

<!-- Selected component chips -->
<div v-if="selectedComponents.length > 0" class="flex flex-wrap gap-1.5">
  <span
    v-for="comp in selectedComponents"
    :key="comp"
    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-400"
  >
    {{ comp }}
    <button
      @click="removeComponent(comp)"
      class="hover:text-primary-900 dark:hover:text-primary-200"
      aria-label="Remove component filter"
    >&times;</button>
  </span>
</div>
```

**Props change in HealthFilterBar:**

```javascript
// Replace:
componentFilter: { type: String, default: '' },
// With:
selectedComponents: { type: Array, default: () => [] },

// Replace emit:
'update:componentFilter'
// With:
'update:selectedComponents'
```

### 3.4 Add Owner column to table

**File:** `modules/release-planning/client/components/FeatureHealthRow.vue`

Add an Owner cell (delivery owner) between Component and Phase:

```html
<td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600">
  {{ feature.deliveryOwner || '-' }}
</td>
```

### 3.5 Remove export button

**File:** `modules/release-planning/client/views/HealthDashboardView.vue`

Remove the export button and all associated logic:

- Delete `exportMenuOpen` ref (line 36)
- Delete `exportCsv()` function (lines 266-305)
- Delete `exportMarkdown()` function (lines 306-336)
- Delete `toggleExportMenu()` and `closeExportMenu()` functions (lines 337-342)
- Remove the export button element and dropdown menu from the template

### 3.6 Files changed in PR 3

| File | Action | Summary |
|---|---|---|
| `modules/release-planning/client/components/FeatureHealthTable.vue` | Modify | Replace Risk+DoR columns with combined Health column; add Priority and Owner columns; update sort logic; update expanded row colspan to 11 |
| `modules/release-planning/client/components/FeatureHealthRow.vue` | Modify | Render combined health cell (risk dot w-2.5 h-2.5 with aria-label), priority score cell, owner cell |
| `modules/release-planning/client/components/HealthFilterBar.vue` | Modify | Replace component `<select>` with multi-select checkbox dropdown + chip display; build component list from split/deduplicated feature components |
| `modules/release-planning/client/views/HealthDashboardView.vue` | Modify | Change `componentFilter` from string to array; update filter logic with robust comma split; remove export button and export functions |

---

## Phase 4: T-Shirt Size Discovery

**PR 4 -- Backend + Frontend: T-shirt size parsing + inverse complexity**

### 4.1 T-shirt size discovery approach

T-shirt sizes are applied during feature review but stored in the Jira
description rather than a dedicated field. The implementer needs to discover the
exact format by examining real feature descriptions.

**Discovery steps:**

1. Use the Jira enrichment Pass 1 data (which already fetches `description` for
   all features via `ENRICHMENT_FIELDS` in `constants.js` line 94) to inspect
   the ADF content of several features known to have t-shirt sizes.

2. Look for common patterns in the description ADF nodes:
   - `"T-Shirt Size: M"` or `"T-shirt: M"`
   - Table row with "Size" header and a cell value
   - Heading node followed by an inline value
   - Label pattern: `[XS|S|M|L|XL]` appearing as a standalone text node

3. Add a `parseTshirtSize(description)` function that tries multiple patterns
   and returns one of: `'XS'`, `'S'`, `'M'`, `'L'`, `'XL'`, or `null`.

**Implementation plan:**

### 4.2 Create t-shirt size parser

**New file:** `modules/release-planning/server/health/tshirt-parser.js`

```javascript
/**
 * T-shirt size parser.
 *
 * Extracts t-shirt sizing from Jira feature descriptions.
 * The description may be a string (v2 API) or ADF object (v3 API).
 *
 * Tries multiple patterns in priority order:
 *   1. Explicit label: "T-Shirt Size: XL" or "Size: M"
 *   2. Bracketed: "[M]" or "(L)" as standalone text
 *   3. Table cell with "size" header
 */

var VALID_SIZES = ['XS', 'S', 'M', 'L', 'XL']

/**
 * Extract plain text from an ADF (Atlassian Document Format) node.
 * @param {object} node - ADF node
 * @returns {string}
 */
function adfToText(node) {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (node.type === 'text') return node.text || ''
  if (Array.isArray(node.content)) {
    return node.content.map(adfToText).join('')
  }
  return ''
}

/**
 * Parse t-shirt size from a Jira description.
 * @param {*} description - String or ADF object
 * @returns {string|null} One of 'XS', 'S', 'M', 'L', 'XL', or null
 */
function parseTshirtSize(description) {
  if (!description) return null

  var text = ''
  if (typeof description === 'string') {
    text = description
  } else if (description.type === 'doc') {
    text = adfToText(description)
  } else {
    return null
  }

  // Pattern 1: "T-Shirt Size: XL" or "Size: M" (case-insensitive)
  // NOTE: Alternation order matters -- put longer alternatives first (XS, XL)
  // so "XS" and "XL" match before the single-letter "S" or "L" can greedily
  // consume the first character. Use a lookahead instead of \b after the match
  // to avoid false positives like "Size: Small" capturing "S" from "Small".
  var sizeMatch = text.match(/(?:t-?shirt\s+)?size\s*[:=]\s*(XS|XL|S|M|L)(?=[\s,;.\-)\]|]|$)/i)
  if (sizeMatch) {
    return sizeMatch[1].toUpperCase()
  }

  // Pattern 2: "Complexity: M" or "Effort: L"
  var complexityMatch = text.match(/(?:complexity|effort)\s*[:=]\s*(XS|XL|S|M|L)(?=[\s,;.\-)\]|]|$)/i)
  if (complexityMatch) {
    return complexityMatch[1].toUpperCase()
  }

  return null
}

module.exports = {
  parseTshirtSize: parseTshirtSize,
  adfToText: adfToText,
  VALID_SIZES: VALID_SIZES
}
```

### 4.3 Integrate t-shirt parsing into Jira enrichment

**File:** `modules/release-planning/server/health/jira-enrichment.js`

In `runPass1()` (line 200), add t-shirt parsing alongside existing enrichment:

```javascript
enrichmentMap.set(issue.key, {
  hasDescription: hasDescriptionContent(fields.description),
  storyPoints: fields.customfield_10028 || null,
  dependencyLinks: parseIssueLinks(fields.issuelinks),
  refinementHistory: null,
  rice: null,
  tshirtSize: parseTshirtSize(fields.description)  // NEW
})
```

Add the require:

```javascript
const { parseTshirtSize } = require('./tshirt-parser')
```

### 4.4 Carry t-shirt size through to health features

**File:** `modules/release-planning/server/health/health-pipeline.js`

In the health feature building loop (around line 632), add:

```javascript
healthFeatures.push({
  // ... existing fields ...
  tshirtSize: enrichment ? enrichment.tshirtSize || null : null,  // NEW
})
```

The `computePriorityScores()` function already handles `f.tshirtSize` via the
`TSHIRT_SCORES` map (see Phase 1, section 1.3). Until t-shirt parsing is
deployed, features default to `complexity_norm = 0.5` ("Unknown").

### 4.5 Display t-shirt size in feature detail

**File:** `modules/release-planning/client/components/FeatureHealthRow.vue`

In the expanded detail metadata grid (lines 223-263), add:

```html
<div v-if="feature.tshirtSize">
  <span class="text-gray-500 dark:text-gray-400">Size:</span>
  <span class="ml-1 text-gray-900 dark:text-gray-100">{{ feature.tshirtSize }}</span>
</div>
```

### 4.6 Files changed in PR 4

| File | Action | Summary |
|---|---|---|
| `modules/release-planning/server/health/tshirt-parser.js` | **New** | T-shirt size parser with ADF support |
| `modules/release-planning/server/health/jira-enrichment.js` | Modify | Add `tshirtSize` to Pass 1 enrichment output |
| `modules/release-planning/server/health/health-pipeline.js` | Modify | Carry `tshirtSize` through to health features |
| `modules/release-planning/client/components/FeatureHealthRow.vue` | Modify | Show t-shirt size in expanded detail |

---

## Testability

### Existing tests to update

| Test file | Changes needed |
|---|---|
| `__tests__/server/health-pipeline.test.js` | Add tests for `discoverReleasesPartial()` usage; verify `planningFreezes` in cache output; verify new summary counters (`ownerAssignedCount`, `scopeEstimatedCount`, etc.); verify `priorityScore` and `priorityBreakdown` on health features |
| `__tests__/server/risk-engine.test.js` | No changes needed (risk engine unchanged in this work) |
| `__tests__/server/rice-scorer.test.js` | No changes needed |
| `__tests__/server/dor-checker.test.js` | No changes needed |
| `__tests__/server/jira-enrichment.test.js` | Add test verifying `tshirtSize` is populated in Pass 1 output (PR 4) |
| `__tests__/server/health-routes.test.js` | No structural changes needed; existing phase param tests still valid |
| `__tests__/server/smartsheet.test.js` | Add tests for `discoverReleasesPartial()`; verify `parseSmartsheetReleases()` shared helper produces consistent results for both callers |
| `__tests__/client/health-components.test.js` | Update summary card tests for new card layout; update table column assertions; remove PhaseSelector describe block |

### New test files

| Test file | Tests |
|---|---|
| `__tests__/server/priority-scorer.test.js` | Test `computePriorityScores()`: verify weights, normalization, median fallback for missing RICE, tier mapping, priority mapping, t-shirt mapping, edge cases (all same RICE, empty features, null fields) |
| `__tests__/server/tshirt-parser.test.js` | Test `parseTshirtSize()`: ADF input, string input, various patterns ("T-Shirt Size: M", "Size: XL", "Complexity: S"), case insensitivity, no match returns null, edge cases (empty description, description with no size). Include tests for false positives: "Size: Small" should NOT match, "Size: Special" should NOT match |
| `__tests__/client/phase-filter.test.js` | Test the client-side `passesPhaseFilter()` port to validate it matches server-side behavior. Mirror the test cases from `health-pipeline.test.js` that cover `passesPhaseFilter`. Specifically: no phase returns all features, phase-specific fixVersion only appears in matching tab, features without phase-specific fixVersions appear in all tabs, case insensitivity |

### Test commands

```bash
# Run all release-planning tests
npm test -- --testPathPattern='modules/release-planning'

# Run specific test files
npm test -- modules/release-planning/__tests__/server/priority-scorer.test.js
npm test -- modules/release-planning/__tests__/server/tshirt-parser.test.js
npm test -- modules/release-planning/__tests__/server/health-pipeline.test.js
```

---

## Deployability

### No new dependencies

All changes use existing libraries (Vue 3, Tailwind CSS, Node.js built-ins).
No new npm packages are required.

### No new environment variables

T-shirt size parsing uses the existing Jira description field fetched by
`ENRICHMENT_FIELDS` in `constants.js`. No new API tokens or configuration.

### CI/CD

- `ci.yml` -- All PRs pass the existing "Test & Build" required check
- `build-images.yml` -- Changes to `modules/release-planning/` trigger both
  backend and frontend image builds (the module has both client/ and server/
  directories)
- No kustomize overlay changes needed
- No new ConfigMap keys

### Rollout safety

- **PR 1 (backend):** New fields (`planningFreezes`, summary counters,
  `priorityScore`) are additive. The frontend ignores unknown fields until
  PR 2/3 land. Existing health cache is invalidated on next refresh (normal
  behavior).
- **PR 2 (tabs + cards):** Frontend changes only. If health data lacks
  `planningFreezes`, the timeline falls back to existing behavior (milestone
  dots only). Summary cards degrade gracefully with `|| 0` defaults.
- **PR 3 (table + filters):** Frontend changes only. Combined column is a
  pure display change. Multi-select chips are a superset of the old single-select.
- **PR 4 (t-shirt):** `tshirtSize` defaults to `null` for features where
  parsing fails. Priority scorer treats null as `complexity_norm = 0.5`,
  so the score is valid even without t-shirt data.

### Backward compatibility

No breaking API changes. All new fields are additive additions to the
existing health cache JSON. The `PhaseSelector.vue` component is removed but
was only used by `HealthDashboardView.vue` (no external consumers).

---

## Affected APIs and Backward Compatibility

### Modified API responses

| Endpoint | Change | Backward compatible? |
|---|---|---|
| `GET /api/modules/release-planning/releases/:version/health` | Response gains: `planningFreezes` object, new `summary` counters, `priorityScore` + `priorityBreakdown` on each feature, `tshirtSize` on each feature | Yes -- all additive fields |
| `GET /api/modules/release-planning/releases/:version/health/summary` | Summary gains: `ownerAssignedCount`, `scopeEstimatedCount`, `riceCompleteCount`, `dorCompleteCount` | Yes -- additive |
| `GET /api/modules/release-planning/releases/:version/health/feature/:key` | Feature gains: `priorityScore`, `priorityBreakdown`, `tshirtSize` | Yes -- additive |

### Unchanged APIs

All write endpoints (DoR toggle, risk override, refresh trigger) are unchanged.
All Big Rocks Planning endpoints are unchanged. All other module APIs are
unchanged.

### Removed component

`PhaseSelector.vue` is deleted. It was only imported by `HealthDashboardView.vue`.
No other modules or shared code reference it.

---

## File Change Summary

### New files (3)

| Path | PR |
|---|---|
| `modules/release-planning/server/health/priority-scorer.js` | PR 1 |
| `modules/release-planning/server/health/tshirt-parser.js` | PR 4 |
| `modules/release-planning/client/utils/phase-filter.js` | PR 2 |

### New test files (3)

| Path | PR |
|---|---|
| `modules/release-planning/__tests__/server/priority-scorer.test.js` | PR 1 |
| `modules/release-planning/__tests__/client/phase-filter.test.js` | PR 2 |
| `modules/release-planning/__tests__/server/tshirt-parser.test.js` | PR 4 |

### Modified files (10)

| Path | PR(s) | Summary |
|---|---|---|
| `shared/server/smartsheet.js` | PR 1 | Extract `parseSmartsheetReleases()` helper; refactor existing functions; add `discoverReleasesPartial()` |
| `modules/release-planning/server/health/health-pipeline.js` | PR 1, 4 | Backfill fix, extract `offsetDate()` to module level, planning freezes, `storyPoints` on health features, priority integration, tshirtSize |
| `modules/release-planning/server/health/jira-enrichment.js` | PR 4 | Add `tshirtSize` to Pass 1 |
| `modules/release-planning/client/views/HealthDashboardView.vue` | PR 2, 3 | Phase tabs, planning freezes, client-side card counts, client-side planning deadline for "all" tab, component filter array, remove export button |
| `modules/release-planning/client/components/HealthSummaryCards.vue` | PR 2 | 4-card readiness layout |
| `modules/release-planning/client/components/MilestoneTimeline.vue` | PR 2 | Planning freeze markers |
| `modules/release-planning/client/components/HealthFilterBar.vue` | PR 3 | Multi-select component chips |
| `modules/release-planning/client/components/FeatureHealthTable.vue` | PR 3 | Combined Health column, Priority column, Owner column, colspan update to 11 |
| `modules/release-planning/client/components/FeatureHealthRow.vue` | PR 3, 4 | Combined health cell, priority cell, owner cell, tshirt display |

### Deleted files (1)

| Path | PR |
|---|---|
| `modules/release-planning/client/components/PhaseSelector.vue` | PR 2 |

### Test files to update (4)

| Path | PR |
|---|---|
| `modules/release-planning/__tests__/server/health-pipeline.test.js` | PR 1 |
| `modules/release-planning/__tests__/server/smartsheet.test.js` | PR 1 |
| `modules/release-planning/__tests__/client/health-components.test.js` | PR 2, 3 |
| `modules/release-planning/__tests__/server/jira-enrichment.test.js` | PR 4 |

---

## Review Resolution

Consolidated findings from three independent reviewers, addressed 2026-04-27.

### Critical Issues

| ID | Finding | Resolution | Section(s) Updated |
|---|---|---|---|
| **C1** | `computePlanningDeadline()` returns null for "all" view -- summary cards and planning deadline indicator break | Frontend computes `activePlanningDeadline` client-side for the "all" tab by selecting the nearest upcoming date from `planningFreezes`. Phase-specific tabs still use the server-computed deadline. | 2.3 |
| **C2** | `discoverReleasesPartial()` duplicates ~60 lines from `discoverReleasesWithFreezes()` | Extracted shared logic into `parseSmartsheetReleases(filterFn)` private helper. Both `discoverReleasesWithFreezes()` and `discoverReleasesPartial()` delegate to it with different filter predicates. Also refactors `discoverReleases()` to use the helper. | 1.1, 1.6 |
| **C3** | Summary card counters are release-wide, not phase-scoped -- wrong counts in EA1/EA2/GA tabs | Removed server-side summary counters. Card counts are now computed client-side from `phasedFeatures` via a `cardCounts` computed property, ensuring they reflect the active phase tab. Added `storyPoints` to health feature output for scope estimation. | 1.5, 2.1, 2.5 |
| **C4** | T-shirt size regex false positives: `\b` after single-letter sizes matches "Size: Small" as "S" | Changed alternation order to `(XS|XL|S|M|L)` (longest first) and replaced `\b` with `(?=[\s,;.\-)\]|]|$)` lookahead requiring whitespace, punctuation, or end-of-string after the match. Added false-positive test cases. | 4.2, Testability |

### Major Issues

| ID | Finding | Resolution | Section(s) Updated |
|---|---|---|---|
| **M1** | Component filter splits on `', '` but Jira components may lack spaces | Changed split to `/\s*,\s*/` regex. Added `allComponents` computed that splits and deduplicates components from ALL features to build the dropdown list. | 3.3 |
| **M2** | `offsetDate()` helper duplicates existing `offset()` in `deriveFreezeDates()` | Extract existing inner `offset()` function to module-level `offsetDate(dateStr, days)`. Reused by both `deriveFreezeDates()` and `planningFreezes` block. No duplication. | 1.2 |
| **M3** | Timeline has 9 markers -- labels overlap when dates cluster | Added label collision strategy: planning freeze markers use abbreviated labels ("EA1 PF", "EA2 PF", "GA PF"). Adjacent markers within 7 days use vertical stacking (alternate above/below). | 2.2 |
| **M4** | PhaseSelector deleted in PR 2 but its tests in `health-components.test.js` not mentioned | Added `health-components.test.js` to PR 2 files changed table with note to remove PhaseSelector describe block (line 210). | 2.5, Testability |
| **M5** | Expanded row `colspan` must match new column count | Documented colspan change from 10 to 11 (columns: expand, feature, summary, status, health, priority, rice, components, owner, phase, tier). | 3.1 |
| **M6** | Risk dot `w-2 h-2` (8x8px) too small for accessibility | Increased to `w-2.5 h-2.5` (10x10px). Added `role="img"` and `aria-label` attribute on the dot element. DoR percentage text already provides supplementary context. | 3.1 |

### Minor Issues

| ID | Finding | Resolution | Section(s) Updated |
|---|---|---|---|
| **m1** | Priority weights are hardcoded with no path to configurability | Added a comment to the `WEIGHTS` constant noting future configurability via admin settings, keeping hardcoded for now per user request. | 1.3 |
| **m2** | Export button removal not mentioned in plan | Added section 3.5 to PR 3 listing all export-related code to remove (refs, functions, template elements). | 3.5, 3.6 |
| **m3** | Client-side `passesPhaseFilter` port lacks validation tests | Added `__tests__/client/phase-filter.test.js` as a new test file in PR 2. Tests mirror server-side coverage: no-phase, phase-specific fixVersions, non-phase features, case insensitivity. | 2.5, Testability, File Change Summary |
