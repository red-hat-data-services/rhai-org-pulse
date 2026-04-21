# AI Impact Assessment Visualization -- Implementation Plan

This plan details how to extend the `modules/ai-impact/` module to ingest, store, and visualize RFE quality assessment data from the rfe-quality-dashboard CI pipeline. It refines the user stories in `docs/ai-impact-assessment-stories.md` into a concrete, phased implementation.

---

## Design Decisions & Assumptions

These defaults were chosen based on codebase analysis. Override any of them during implementation if requirements differ.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage format | Single file `data/ai-impact/assessments.json` | The existing `rfe-data.json` already stores 1,630+ issues in one file. A single assessments file (est. 2--5 MB) avoids the I/O cost of reading 1,630 individual files for list/chart views. Write safety is handled via write-to-temp-then-rename (see Storage Safety below). |
| Incremental sync (`since` param) | Dropped entirely | The bulk endpoint is idempotent. The `since` param adds no value: if the caller pre-filters, the param is redundant; if the caller sends everything, the full payload still crosses the network. Rely on idempotency instead. |
| Filter dimensions (Story 2.3) | Only fields present in current data model: `aiInvolvement`, `priority`, `status`, `passFail`. Other dimensions (council status, commitment level, component, release) deferred. | These fields don't exist in the Jira data model today. Adding them requires upstream changes first. |
| Demo mode fixtures | Included | Consistent with existing module pattern. |
| Feedback rendering (Story 4.2) | Preformatted text with a safe markdown subset (bold, line breaks, bullet lists) via simple regex replacements. No `v-html`, no external library. | Avoids XSS risk entirely. Neither `marked` nor `DOMPurify` are project dependencies, and adding them for one field is not justified. See Feedback Rendering below. |
| Auth for ingest | `requireAdmin` middleware on all write endpoints | Prevents any authenticated user from pushing arbitrary assessment data. The CI pipeline must use a token belonging to an admin-allowlisted email. See Auth Design below. |
| passFail validation | Trust the caller's value; only validate it is `"PASS"` or `"FAIL"` | Hardcoding the threshold (total >= 5) leaks upstream business logic. If the threshold changes, the server would reject all assessments until redeployed. |

---

## Phased Implementation Order

```
Phase 1: Storage + Ingest API  (Epic 5 + Epic 1)
    No UI changes. Deployable and testable via curl immediately.

Phase 2: Detail Panel          (Epic 4)
    Extend RFEDetailPanel to show assessment data when available.
    Includes useAssessments composable (needed for data fetching).

Phase 3: List View             (Epic 2)
    Score badges, sort, and filter controls on RFE list.

Phase 4: Charts                (Epic 3)
    Score distribution histogram + criteria breakdown chart.
```

Each phase is independently deployable and backward-compatible.

---

## Phase 1: Storage + Ingest API

### Storage Design (Story 5.1)

**File:** `data/ai-impact/assessments.json`

**Schema:**
```json
{
  "lastSyncedAt": "2026-04-19T12:00:00Z",
  "totalAssessed": 1630,
  "assessments": {
    "RHAIRFE-123": {
      "latest": {
        "scores": { "what": 2, "why": 1, "how": 2, "task": 1, "size": 2 },
        "total": 8,
        "passFail": "PASS",
        "antiPatterns": ["WHY Void"],
        "criterionNotes": {
          "what": "...", "why": "...", "how": "...", "task": "...", "size": "..."
        },
        "verdict": "One-sentence summary.",
        "feedback": "Actionable markdown.",
        "assessedAt": "2026-04-19T12:00:00Z"
      },
      "history": [
        {
          "total": 5,
          "passFail": "FAIL",
          "scores": { "what": 1, "why": 0, "how": 1, "task": 1, "size": 2 },
          "assessedAt": "2026-04-12T12:00:00Z"
        }
      ]
    }
  }
}
```

Key design points:
- `latest` contains the full assessment (used by list/detail/charts).
- `history` contains prior assessments with a reduced payload (scores + total + passFail + assessedAt). Full notes are only kept in `latest` to control file size.
- History is sorted newest-first, capped at 20 entries per RFE.
- Top-level `lastSyncedAt` and `totalAssessed` power the admin settings display (Story 5.2).

### Storage Safety

**Write corruption prevention:** The `writeToStorage` function uses `fs.writeFileSync` which is not atomic on most filesystems. A crash during write corrupts the file permanently. The assessment storage module must implement **write-to-temp-then-rename**:

```js
const fs = require('fs');
const path = require('path');
const os = require('os');

function writeAssessmentsAtomic(storageKey, data) {
  const filePath = path.resolve(DATA_DIR, storageKey);
  const tmpPath = filePath + '.tmp.' + process.pid;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);  // atomic on same filesystem
}
```

This bypasses `writeToStorage` for assessments only. The `readFromStorage` helper is still used for reads.

**Concurrency:** The read-modify-write cycle is not locked. Two simultaneous PUT requests could cause a lost update. This is acceptable for v1 because the CI pipeline is the single writer. The plan documents this as a known limitation. If multiple concurrent writers become a requirement, the options are:
1. Per-RFE files (eliminates contention but increases read I/O)
2. Advisory file locking (add `proper-lockfile` dependency)
3. Queue writes through an in-memory mutex (simplest; Node is single-threaded for sync I/O but async routes overlap)

Option 3 (in-memory write queue) is the recommended upgrade path if needed:
```js
let writeQueue = Promise.resolve();
function serializedWrite(fn) {
  writeQueue = writeQueue.then(fn).catch(() => {});
  return writeQueue;
}
```

**DELETE must not write `null`:** The existing `DELETE /cache` route calls `writeToStorage('ai-impact/rfe-data.json', null)` which writes the string `"null"` (since `JSON.stringify(null)` is `"null"`). When read back, it parses to JS `null`, which will crash any code that accesses `.assessments` on it. The assessment DELETE endpoint must instead write the empty-state object:

```js
router.delete('/assessments', requireAdmin, function(req, res) {
  writeAssessmentsAtomic(STORAGE_KEY, { lastSyncedAt: null, totalAssessed: 0, assessments: {} });
  res.json({ status: 'cleared' });
});
```

Additionally, `readAssessments` must handle the case where the file contains `null` or a malformed object:

```js
function readAssessments(readFromStorage) {
  const data = readFromStorage(STORAGE_KEY);
  if (!data || typeof data !== 'object' || !data.assessments) {
    return { lastSyncedAt: null, totalAssessed: 0, assessments: {} };
  }
  return data;
}
```

### Route Registration Order (CRITICAL)

Express matches routes in registration order. Parameterized routes (`/:key`) will swallow static routes (`/status`, `/bulk`) if registered first. The `assessments/routes.js` file **must** register static routes before parameterized routes:

```js
module.exports = function(router, context) {
  // 1. Static routes FIRST
  router.get('/assessments/status', requireAdmin, statusHandler);
  router.post('/assessments/bulk', requireAdmin, jsonLimit, bulkHandler);
  router.delete('/assessments', requireAdmin, deleteHandler);
  router.get('/assessments', listHandler);

  // 2. Parameterized routes AFTER
  router.get('/assessments/:key', getOneHandler);
  router.put('/assessments/:key', requireAdmin, jsonLimit, putHandler);
};
```

This order ensures `/assessments/status` is matched by the static route, not by `/:key` with `key="status"`. The same applies to `/assessments/bulk`.

### Auth Design

All write endpoints (PUT, POST bulk, DELETE) require `requireAdmin` middleware. This means:
- The CI pipeline's API token must belong to an email address on the admin allowlist.
- Regular authenticated users can read assessment data (GET endpoints) but cannot push or delete.
- This is consistent with the existing pattern: `POST /refresh`, `POST /config`, `DELETE /cache` all require `requireAdmin`.

Read endpoints (GET `/assessments`, GET `/assessments/:key`) do not require admin -- they are protected by the global `authMiddleware` (which runs on all routes and validates the `tt_` token or `X-Forwarded-Email` header).

### Body Size Limits

The global Express body parser is configured as `app.use(express.json())` with no explicit limit (defaults to 100KB). A bulk payload with 1,630+ assessments will exceed this.

**Solution:** Apply a route-level body parser with a higher limit for assessment routes only, plus a max array length check:

```js
const express = require('express');
const jsonLimit = express.json({ limit: '10mb' });

// In the bulk handler:
router.post('/assessments/bulk', requireAdmin, jsonLimit, function(req, res) {
  const { assessments } = req.body;
  if (!Array.isArray(assessments)) {
    return res.status(400).json({ error: 'assessments must be an array' });
  }
  if (assessments.length > 5000) {
    return res.status(400).json({ error: 'Bulk payload exceeds maximum of 5000 entries' });
  }
  // ... process
});
```

The 10MB limit and 5000-entry cap are generous enough for the current 1,630 RFEs with room for growth, while preventing unbounded payloads. The PUT endpoint also gets the route-level parser since individual assessments could have large feedback text, though the default 100KB is likely sufficient -- applying it uniformly is simpler.

### Demo Mode Handling

Write endpoints (PUT, POST bulk, DELETE) must short-circuit in demo mode with an explicit response, consistent with the existing refresh pattern:

```js
if (DEMO_MODE) {
  return res.json({ status: 'skipped', message: 'Assessment ingest disabled in demo mode' });
}
```

This ensures the CI pipeline gets a clear signal that data was not persisted, rather than silently succeeding.

### API Endpoints (Stories 1.1, 1.2, 1.4)

#### PUT `/api/modules/ai-impact/assessments/:key`

Single-RFE assessment upsert. Requires `requireAdmin`.

**Request body:**
```json
{
  "scores": { "what": 2, "why": 1, "how": 2, "task": 1, "size": 2 },
  "total": 8,
  "passFail": "PASS",
  "antiPatterns": ["WHY Void", "Task Masquerade"],
  "criterionNotes": {
    "what": "...", "why": "...", "how": "...", "task": "...", "size": "..."
  },
  "verdict": "One-sentence summary.",
  "feedback": "Actionable markdown.",
  "assessedAt": "2026-04-19T12:00:00Z"
}
```

**Response:** `200 { status: "created" | "updated" | "unchanged" }`

**Logic:**
1. Check `DEMO_MODE` -- return `{ status: "skipped" }`.
2. Validate request body against schema (scores 0--2 integers, total 0--10 integer and equals sum of scores, passFail is `"PASS"` or `"FAIL"`, assessedAt is valid ISO date).
3. Read `assessments.json` (via `readAssessments`, which returns empty-state for null/missing).
4. If RFE entry exists and `latest.assessedAt === assessedAt`, return `"unchanged"` (idempotent, no write).
5. If RFE entry exists and `assessedAt` is newer, rotate current `latest` into `history` (trimmed fields), set new `latest` -> `"updated"`.
6. If RFE entry exists and `assessedAt` is older, insert into `history` at correct position (only if it would survive the 20-entry cap -- see History Cap Eviction below) -> `"updated"`.
7. If no entry, create new -> `"created"`.
8. Update `lastSyncedAt` and `totalAssessed`.
9. Write back via `writeAssessmentsAtomic`.

#### POST `/api/modules/ai-impact/assessments/bulk`

Bulk assessment upsert. Requires `requireAdmin`.

**Request body:**
```json
{
  "assessments": [
    { "id": "RHAIRFE-123", "scores": {...}, "total": 8, ... },
    { "id": "RHAIRFE-456", "scores": {...}, "total": 3, ... }
  ]
}
```

**Response:** `200 { created: 10, updated: 5, unchanged: 1615, errors: [] }`

**Logic:**
1. Check `DEMO_MODE` -- return `{ status: "skipped" }`.
2. Validate array type and length (<= 5000).
3. Read `assessments.json` once.
4. Process each entry using the same upsert logic as PUT. Collect per-entry validation errors without aborting.
5. Write back once.
6. Return counts + any validation errors (with RFE keys for identification).

Entries with validation errors are skipped; valid entries are still processed. This partial-success behavior is important for pipeline resilience.

#### GET `/api/modules/ai-impact/assessments/:key`

Read-only endpoint for a single RFE's assessment data (used by detail panel).

**Response:** `200 { latest: {...}, history: [...] }` or `404 { error: "Not found" }`

No admin auth required (global `authMiddleware` applies).

#### GET `/api/modules/ai-impact/assessments`

Read-only endpoint returning all latest assessments (used by list view and charts).

**Response:**
```json
{
  "lastSyncedAt": "2026-04-19T12:00:00Z",
  "totalAssessed": 1630,
  "assessments": {
    "RHAIRFE-123": { "total": 8, "passFail": "PASS", "scores": {...} },
    ...
  }
}
```

Returns a slim projection (no `criterionNotes`, `feedback`, `verdict`, `history`) to keep the response small for list/chart use.

**Pagination trade-off:** This endpoint returns all assessments in a single response. At 1,630 entries with slim projections (~100 bytes each), this is ~160KB -- well within acceptable limits. Pagination is not needed for v1. If the assessment count grows past ~10,000, add cursor-based pagination with `?limit=&after=` parameters. This threshold should be documented in a code comment near the endpoint.

#### DELETE `/api/modules/ai-impact/assessments` (Admin)

Clear all assessment data. Requires `requireAdmin`.

Writes `{ lastSyncedAt: null, totalAssessed: 0, assessments: {} }` (NOT `null`) via `writeAssessmentsAtomic`.

**Response:** `200 { status: "cleared" }`

#### GET `/api/modules/ai-impact/assessments/status` (Admin)

Assessment data status for settings page.

**Response:**
```json
{
  "lastSyncedAt": "2026-04-19T12:00:00Z",
  "totalAssessed": 1630,
  "totalHistoryEntries": 4200
}
```

### Validation Module

New file: `modules/ai-impact/server/assessments/validation.js`

```js
const CRITERIA = ['what', 'why', 'how', 'task', 'size'];

function validateAssessment(body) {
  // Returns { valid: true, data: normalized } or { valid: false, errors: [...] }
  // Checks:
  //   - scores object with what/why/how/task/size each 0-2 integer
  //   - total is 0-10 integer and equals sum of scores
  //   - passFail is "PASS" or "FAIL" (no threshold check -- trust the caller)
  //   - assessedAt is valid ISO 8601 date string
  //   - antiPatterns is array of strings (optional, default [])
  //   - criterionNotes is object with what/why/how/task/size string values (optional)
  //   - verdict is string (optional)
  //   - feedback is string (optional)
}
```

Key change from original plan: `passFail` is validated as an enum (`"PASS"` or `"FAIL"`) but NOT validated against a threshold. This avoids coupling the server to upstream business logic.

### Assessment Storage Module

New file: `modules/ai-impact/server/assessments/storage.js`

```js
const STORAGE_KEY = 'ai-impact/assessments.json';
const MAX_HISTORY = 20;

function readAssessments(readFromStorage) {
  const data = readFromStorage(STORAGE_KEY);
  // Guard against null, undefined, or malformed data
  if (!data || typeof data !== 'object' || !data.assessments) {
    return { lastSyncedAt: null, totalAssessed: 0, assessments: {} };
  }
  return data;
}

function writeAssessmentsAtomic(data) {
  // Write to temp file, then atomic rename (see Storage Safety section)
}

function upsertAssessment(data, rfeKey, assessment) {
  // Returns 'created' | 'updated' | 'unchanged'
  // History cap eviction: only insert into history if the entry is newer
  // than the oldest existing entry (or history has room).
}

function getLatestProjection(data) {
  // Returns slim version for list/chart endpoints
  // Strips criterionNotes, verdict, feedback, history from each entry
}

function trimForHistory(assessment) {
  // Returns { scores, total, passFail, assessedAt } only
}
```

### History Cap Eviction

When history is at the 20-entry cap and an old assessment arrives:
- Compare the incoming `assessedAt` with the oldest entry in history.
- If the incoming assessment is older than the oldest entry, **discard it** (do not insert then immediately evict).
- If the incoming assessment is newer than the oldest entry, insert at the correct position and evict the oldest entry.

This prevents wasted I/O and ensures the history always contains the 20 most recent assessments.

### Admin Settings Extension (Story 5.2)

Extend `AIImpactSettings.vue` to show:
- Last sync timestamp
- Total RFEs assessed / total assessment count
- "Clear Assessment Data" button with confirmation dialog

Data fetched from `GET /api/modules/ai-impact/assessments/status`.

---

## Phase 2: Detail Panel (Epic 4)

### useAssessments Composable (moved from Phase 3)

**New file:** `modules/ai-impact/client/composables/useAssessments.js`

This composable is created in Phase 2 (not Phase 3) because the detail panel needs assessment data. Creating it in Phase 3 would mean Phase 2 makes raw API calls that get immediately refactored.

```js
// Provides:
// - assessments: ref<Map<string, Assessment>>  (keyed by RFE key)
// - assessmentLoading: ref<boolean>
// - assessmentError: ref<string|null>
// - loadAssessments(): fetches GET /assessments (slim projection)
// - loadAssessmentDetail(key): fetches GET /assessments/:key (full + history)
```

### Story 4.1 -- Rubric Score Breakdown

Extend `RFEDetailPanel.vue` to show assessment data when available.

**New component:** `AssessmentBreakdown.vue`

Displays:
- Total score badge (0--10) with pass/fail color (green for PASS, red for FAIL)
- Five criterion rows, each showing:
  - Criterion name (What / Why / How / Task / Size)
  - Score (0--2) with visual indicator (filled dots or bar)
  - Justification text from `criterionNotes` (expandable)
- Anti-pattern tags/badges (if any)

**Data flow:**
- `RFEDetailPanel.vue` receives `assessment` prop (latest assessment from the bulk-loaded slim data).
- When the detail panel opens, it calls `loadAssessmentDetail(key)` from `useAssessments` to fetch the full payload (with `criterionNotes`, `verdict`, `feedback`, `history`).
- The slim data (scores, total, passFail) renders immediately; full data (notes, feedback) populates when the detail fetch completes.

### Story 4.2 -- Verdict and Feedback

Same component or sibling section in `RFEDetailPanel.vue`:
- `verdict` displayed as a highlighted summary line (plain text, no HTML).
- `feedback` rendered as preformatted text with a safe markdown subset.

**Feedback Rendering -- No `v-html`:**

Neither `marked` nor `DOMPurify` are project dependencies. Adding external libraries for one text field is not justified. Instead, render feedback using a simple safe-text component:

```vue
<template>
  <div class="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
    <template v-for="(line, i) in feedbackLines" :key="i">
      <span v-if="line.type === 'bullet'" class="block pl-4">
        &bull; <FeedbackLine :text="line.text" />
      </span>
      <span v-else class="block">
        <FeedbackLine :text="line.text" />
      </span>
    </template>
  </div>
</template>
```

Where `FeedbackLine` handles inline bold (`**text**`) via a computed property that splits text into bold/normal spans. No `v-html` is used anywhere. This eliminates XSS risk entirely.

### Story 4.3 -- Score History

**New component:** `AssessmentHistory.vue`

- Mini sparkline (using Chart.js Line chart, small height) showing total score at each `assessedAt` date.
- Expandable detail showing per-criterion score changes between consecutive assessments (diff view: which criteria improved/declined).
- Fetches full history via `loadAssessmentDetail(key)` from `useAssessments` only when user expands the history section (lazy load).

---

## Phase 3: List View (Epic 2)

### Story 2.1 -- Score Badge on RFE List Items

Extend `RFEListItem.vue`:
- Add a score badge next to the existing AI involvement badge.
- Score number displayed with pass/fail color coding:
  - Green background for PASS (>= 5)
  - Red background for FAIL (< 5)
  - Gray "---" for unassessed RFEs
- Badge is compact: just the number in a small rounded rectangle.

**Data flow:**
- `useAssessments` composable (created in Phase 2) loads `GET /assessments` at the same time as `useAIImpact` loads RFE data.
- Assessment data (keyed by RFE key) is passed down through `PhaseContent` -> `RFEList` -> `RFEListItem` as a prop.
- The join happens in the view layer: `RFEListItem` receives both `rfe` and `assessment` props (not merged into one object).

### Assessment-to-RFE Join for Filtered Charts

The filtered RFE keys (from the time window filter + search + AI involvement filter) drive which assessments are included in charts and metrics. The join is performed client-side:

```js
const filteredAssessments = computed(() => {
  const rfeKeys = new Set(filteredRFEs.value.map(r => r.key));
  const result = {};
  for (const [key, assessment] of Object.entries(assessments.value)) {
    if (rfeKeys.has(key)) {
      result[key] = assessment;
    }
  }
  return result;
});
```

This computed property is defined in `AIImpactView.vue` (or `PhaseContent.vue`) and passed to both the list and chart components. Assessment data is never filtered independently -- it always follows the RFE filter state.

### Story 2.2 -- Sort by Quality Score

Extend `RFEList.vue`:
- Add a sort control (dropdown or toggle buttons) with options:
  - Default (created date, current behavior)
  - Score: Low to High
  - Score: High to Low
- Unassessed RFEs sort to the bottom in score-based sorts.

### Story 2.3 -- Filter by Quality Dimensions

Extend `RFEList.vue` filter controls:

**Implemented filters (fields in current data model):**
- Pass/Fail (dropdown: All / Pass / Fail / Not Assessed)
- AI Involvement (existing filter, unchanged)
- Priority (dropdown populated from data)
- Status (dropdown populated from data)

**Deferred filters (fields not yet in data model):**
- Council status, delivery status, commitment level, component, author, release

Filter state is managed in `AIImpactView.vue` and passed down. State preserved when navigating to detail and back (already works via Vue reactivity -- `selectedRFE` does not reset filters).

---

## Phase 4: Charts (Epic 3)

### Story 3.1 -- Score Distribution Histogram

**New component:** `ScoreDistributionChart.vue`

- Horizontal or vertical bar chart with 11 buckets (0 through 10).
- Bars color-coded: red for scores 0--4 (FAIL), green for 5--10 (PASS).
- Data computed from `filteredAssessments` (the joined/filtered assessment set -- see Phase 3).
- Placed alongside existing TrendCharts (either as a new panel in the grid or a new collapsible section).

**Chart.js config:**
- Bar chart, using the same Chart.js registration pattern as `TrendCharts.vue`.
- Computed property derives bucket counts from filtered assessments.

### Story 3.2 -- Criteria Performance Breakdown

**New component:** `CriteriaBreakdownChart.vue`

- Grouped bar chart or radar chart showing:
  - Average score per criterion (what/why/how/task/size) on 0--2 scale.
  - Percentage of RFEs scoring zero per criterion (displayed as text labels or secondary bars).
- Data computed from `filteredAssessments`.

**Chart.js config:**
- Bar chart with 5 groups (one per criterion).
- Dual y-axis: left for average score (0--2), right for zero-score percentage (0--100%).

---

## Files to Modify/Create

### New Files

| File | Phase | Purpose |
|------|-------|---------|
| `modules/ai-impact/server/assessments/validation.js` | 1 | Request body validation for assessment data |
| `modules/ai-impact/server/assessments/storage.js` | 1 | Assessment CRUD operations on storage (with atomic write) |
| `modules/ai-impact/server/assessments/routes.js` | 1 | Express route handlers for assessment endpoints |
| `modules/ai-impact/__tests__/server/assessment-validation.test.js` | 1 | Validation unit tests |
| `modules/ai-impact/__tests__/server/assessment-storage.test.js` | 1 | Storage logic unit tests |
| `modules/ai-impact/__tests__/server/assessment-routes.test.js` | 1 | Route handler integration tests |
| `modules/ai-impact/client/composables/useAssessments.js` | 2 | Frontend data fetching + caching for assessments |
| `modules/ai-impact/client/components/AssessmentBreakdown.vue` | 2 | Rubric score display for detail panel |
| `modules/ai-impact/client/components/AssessmentHistory.vue` | 2 | Score history sparkline + diff view |
| `modules/ai-impact/client/components/FeedbackText.vue` | 2 | Safe markdown-subset renderer (no v-html) |
| `modules/ai-impact/client/components/ScoreDistributionChart.vue` | 4 | Score histogram chart |
| `modules/ai-impact/client/components/CriteriaBreakdownChart.vue` | 4 | Per-criterion performance chart |
| `modules/ai-impact/__tests__/client/useAssessments.test.js` | 2 | Composable unit tests |
| `fixtures/ai-impact/assessments.json` | 1 | Demo mode fixture data |

### Modified Files

| File | Phase | Changes |
|------|-------|---------|
| `modules/ai-impact/server/index.js` | 1 | Import and mount assessment routes from `assessments/routes.js` |
| `modules/ai-impact/client/components/AIImpactSettings.vue` | 1 | Add assessment status display + clear button |
| `modules/ai-impact/client/components/RFEDetailPanel.vue` | 2 | Add `assessment` prop, render `AssessmentBreakdown`, `AssessmentHistory`, `FeedbackText` |
| `modules/ai-impact/client/views/AIImpactView.vue` | 2 | Integrate `useAssessments`, pass assessment data to child components |
| `modules/ai-impact/client/composables/useAIImpact.js` | 2 | Coordinate with `useAssessments` load timing |
| `modules/ai-impact/client/components/RFEListItem.vue` | 3 | Add score badge next to AI involvement badge |
| `modules/ai-impact/client/components/RFEList.vue` | 3 | Add sort control, add pass/fail filter, add priority/status filters |
| `modules/ai-impact/client/components/PhaseContent.vue` | 3,4 | Pass assessment data + filteredAssessments to list/charts, add new chart sections |
| `modules/ai-impact/client/components/TrendCharts.vue` | 4 | Add new chart panels or refactor to accommodate assessment charts |

---

## API Endpoint Summary

Routes are listed in required registration order (static before parameterized).

| Order | Method | Path | Auth | Phase | Purpose |
|-------|--------|------|------|-------|---------|
| 1 | GET | `/api/modules/ai-impact/assessments/status` | `requireAdmin` | 1 | Assessment data status for settings |
| 2 | POST | `/api/modules/ai-impact/assessments/bulk` | `requireAdmin` + `json({ limit: '10mb' })` | 1 | Bulk upsert assessments (max 5000) |
| 3 | DELETE | `/api/modules/ai-impact/assessments` | `requireAdmin` | 1 | Clear all assessment data |
| 4 | GET | `/api/modules/ai-impact/assessments` | `authMiddleware` (global) | 2 | List all latest assessments (slim) |
| 5 | GET | `/api/modules/ai-impact/assessments/:key` | `authMiddleware` (global) | 2 | Get single RFE assessment + history |
| 6 | PUT | `/api/modules/ai-impact/assessments/:key` | `requireAdmin` + `json({ limit: '10mb' })` | 1 | Upsert single assessment |

---

## Testing Strategy

### Unit Tests (vitest)

| Test File | Coverage |
|-----------|----------|
| `assessment-validation.test.js` | All validation rules: score ranges, total consistency (must equal sum of scores), passFail enum (NOT threshold), date format, optional fields, edge cases (missing fields, extra fields, null values, non-integer scores) |
| `assessment-storage.test.js` | `readAssessments` with null/undefined/malformed data returns empty state. `upsertAssessment` logic: create new, update existing, idempotent same-timestamp returns `"unchanged"`, history rotation, history cap at 20, cap eviction of old entries, `getLatestProjection` slim output, `trimForHistory` strips full-payload fields |
| `assessment-routes.test.js` | Route registration order (static before parameterized). PUT/POST/GET/DELETE handlers with mocked storage: success cases, validation errors (400), auth/admin failures (401/403), not found (404), bulk with mixed valid/invalid (partial success), bulk exceeding 5000 entries (400), demo mode returns `{ status: "skipped" }` |
| `useAssessments.test.js` | Composable: loading states, error handling, data transformation, `loadAssessmentDetail` lazy loading |

### Integration Testing

- **Local dev**: Use `curl` or Postman to test ingest endpoints against `npm run dev:full`.
  - Create an API token via Settings > API Tokens (the token owner must be on the admin allowlist).
  - `curl -X PUT -H "Authorization: Bearer tt_<token>" -H "Content-Type: application/json" -d '{"scores":...}' http://localhost:3001/api/modules/ai-impact/assessments/RHAIRFE-123`
  - Test bulk with a payload > 100KB to verify route-level body parser override works.
- **Demo mode**: Verify fixture data renders correctly with `DEMO_MODE=true`. Verify write endpoints return `{ status: "skipped" }`.
- **CI**: All tests run in `npm test` (vitest). No new env vars required for tests.

### Test Conventions (from AGENTS.md)

- Use `describe`/`it` blocks with clear names.
- Mock `readFromStorage`/`writeToStorage` as plain functions (no filesystem I/O in unit tests).
- For `writeAssessmentsAtomic`, mock `fs.writeFileSync` and `fs.renameSync` to verify atomic write behavior.
- Factory helpers for test data (similar to `makeIssue` in existing tests).

---

## Backward Compatibility

| Concern | Analysis |
|---------|----------|
| Existing `/rfe-data` endpoint | Unchanged. Assessment data is a separate data path. |
| Existing RFE list view | Works identically when no assessment data exists. Score badges show "Not assessed" gracefully. |
| Existing detail panel | Shows existing content when no assessment. Assessment section only appears when data is present. |
| Existing config/refresh | Unchanged. Assessment ingest is a separate flow from Jira refresh. |
| Storage | New file (`assessments.json`) does not conflict with existing `rfe-data.json` or `config.json`. |
| Module manifest | No changes to `module.json`. |
| API tokens | Reuses existing token system. No changes to token creation/validation. Write endpoints require admin -- existing non-admin tokens continue to work for read-only access. |
| Existing `DELETE /cache` bug | The existing `DELETE /cache` route writes `null` to storage via `writeToStorage`. This is a pre-existing bug (not introduced by this plan) but should be fixed opportunistically: change to write `{ fetchedAt: null, issues: [] }` instead. |

---

## CI/CD Considerations

- **No new env vars required** for the ai-impact module itself. The CI pipeline that pushes assessments will need a `tt_` API token (created via the UI) belonging to an admin-allowlisted email.
- **No new npm dependencies.** `marked` and `DOMPurify` are NOT needed. Chart.js and vue-chartjs are already installed. The feedback renderer uses plain Vue template logic.
- **Image rebuilds**: Changes to `modules/ai-impact/` trigger the `build-images.yml` workflow (backend + frontend images).
- **Kustomize overlays**: No changes needed. Assessment data is stored in the existing PVC-mounted `data/` directory.
- **Body size limit**: The route-level `express.json({ limit: '10mb' })` only affects assessment routes. The global 100KB limit is unchanged for all other routes.
- **CronJob**: The daily sync CronJob could be extended to also trigger the rfe-quality-dashboard pipeline, but that's out of scope for this plan (it's the caller's responsibility).

---

## Demo Mode Fixtures

Create `fixtures/ai-impact/assessments.json` with ~10 sample assessments covering:
- Mix of PASS and FAIL results
- Various score distributions (all-2s, all-0s, mixed)
- At least 2 RFEs with history (multiple assessments)
- Anti-pattern examples
- Keys matching existing demo RFE data if possible

The `demo-storage.js` module already supports reading from `fixtures/` -- just ensure the file path matches the storage key.

Write endpoints return `{ status: 'skipped', message: 'Assessment ingest disabled in demo mode' }` in demo mode.

---

## Open Questions for User Review

1. **History payload size**: Should `history` entries store the full assessment (including `criterionNotes`, `verdict`, `feedback`) or just scores/total/passFail? The plan assumes a trimmed history to control file size, but full history enables richer diff views.

2. **Score recalculation**: Should the server validate that `total === sum(scores)` and reject mismatches, or silently recalculate? The plan assumes strict validation (reject mismatches).

3. **Write concurrency**: With a single assessments file, two simultaneous PUT requests could cause a lost update. This is acceptable for the CI pipeline use case (single writer). If multiple writers become a requirement, the recommended upgrade is an in-memory write queue (see Storage Safety section). This is documented as a known v1 limitation.

4. **Filter dimensions**: When upstream data adds council status, commitment level, component, and release fields, should filters auto-discover available values from the data, or should they be configured in settings?

---

## Reviewer Findings Addressed

This section documents how each review finding was resolved.

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| 1 | CRITICAL | Route collision: `GET /assessments/status` vs `GET /assessments/:key` | Added explicit route registration order in Routes section and API Endpoint Summary table. Static routes (`/status`, `/bulk`) are registered BEFORE parameterized routes (`/:key`). |
| 2 | CRITICAL | `writeToStorage(key, null)` writes `"null"`, not a deletion | DELETE endpoint writes `{ assessments: {}, lastSyncedAt: null, totalAssessed: 0 }` instead of `null`. `readAssessments` guards against null/malformed data. Pre-existing `DELETE /cache` bug documented in Backward Compatibility. |
| 3 | MAJOR | `marked` is not a dependency | Removed `marked` from the plan entirely. Feedback rendering uses plain Vue template logic with a `FeedbackText.vue` component (no `v-html`, no external deps). |
| 4 | MAJOR | No auth distinction for write endpoints | All write endpoints (PUT, POST bulk, DELETE) now explicitly require `requireAdmin`. Documented that CI pipeline token must belong to admin-allowlisted email. |
| 5 | MAJOR | Bulk endpoint has no size limit | Added route-level `express.json({ limit: '10mb' })` for assessment routes. Added max array length check (5000 entries). Documented in Body Size Limits section. |
| 6 | MAJOR | GET /assessments returns all with no pagination | Acknowledged in API Endpoints section. At 1,630 entries with slim projections (~100 bytes each), response is ~160KB. Pagination threshold (~10K entries) documented for future work. |
| 7 | MAJOR | passFail threshold validation is fragile | Changed validation to only check enum value (`"PASS"` or `"FAIL"`). Threshold check removed. Documented in Design Decisions table. |
| 8 | MAJOR | Single-file write corruption risk | Added write-to-temp-then-rename pattern (`writeAssessmentsAtomic`). Documented concurrency limitation and upgrade path (in-memory write queue) in Storage Safety section. |
| 9 | MINOR | Demo mode ingest silently succeeds | Write endpoints now return `{ status: "skipped", message: "Assessment ingest disabled in demo mode" }`. Documented in Demo Mode Handling section. |
| 10 | MINOR | History cap eviction for old entries unclear | Specified: only insert into history if the entry would survive the cap (newer than oldest existing entry). See History Cap Eviction section. |
| 11 | MINOR | `since` query param is redundant | Dropped `since` entirely. Rely on idempotency. Documented in Design Decisions table. |
| 12 | MINOR | XSS risk from `v-html` for feedback | Eliminated `v-html` entirely. Using `FeedbackText.vue` component with plain Vue templates. No external sanitization library needed. See Feedback Rendering section. |
| 13 | MINOR | Assessment-to-RFE join for filtered charts unclear | Added explicit `filteredAssessments` computed property specification in Phase 3. Assessment data follows RFE filter state via client-side join by key. |
| 14 | MINOR | `useAssessments` composable should be Phase 2 | Moved to Phase 2. Phase 2 now creates the composable; Phase 3 consumes it. Updated Files tables. |
| 15 | MINOR | Request body size for Express | Verified: `dev-server.js` line 58 uses `express.json()` with no limit (defaults to 100KB). Route-level override added for assessment routes. |
