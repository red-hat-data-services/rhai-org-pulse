# AI Impact Module: RFE Assessment Visualization — User Stories

## Overview

Extend the ai-impact module to ingest, store, and visualize RFE quality assessment data from the rfe-quality-dashboard. The quality dashboard CI pipeline will push assessment results to the ai-impact module via API, making ai-impact the single source of truth for display.

### Data Model (Ingest Schema)

Each assessment record contains:

```json
{
  "id": "RHAIRFE-123",
  "scores": {
    "what": 2,
    "why": 1,
    "how": 2,
    "task": 1,
    "size": 2
  },
  "total": 8,
  "passFail": "PASS",
  "antiPatterns": ["WHY Void", "Task Masquerade"],
  "criterionNotes": {
    "what": "Justification for the what score...",
    "why": "Justification for the why score...",
    "how": "Justification for the how score...",
    "task": "Justification for the task score...",
    "size": "Justification for the size score..."
  },
  "verdict": "One-sentence overall assessment summary.",
  "feedback": "Actionable improvement suggestions in markdown.",
  "assessedAt": "2026-04-19T12:00:00Z"
}
```

Scoring: each criterion is 0–2, total is 0–10, pass threshold is >= 5.

---

## Epic 1: Assessment Data Ingest API

### Story 1.1 — Per-RFE assessment endpoint

> As the rfe-quality-dashboard CI pipeline, I can push a single RFE's assessment result so that individual assessments are recorded as they happen.

**Endpoint:** `PUT /api/modules/ai-impact/assessments/:key`

**Acceptance criteria:**
- Accepts the assessment schema defined above
- Appends to score history (keyed by `assessedAt` timestamp)
- Idempotent — same `assessedAt` timestamp overwrites rather than duplicates
- Auth: Bearer API token
- Returns 200 with `{ status: "created" | "updated" }`

### Story 1.2 — Bulk assessment endpoint

> As the rfe-quality-dashboard CI pipeline, I can push all assessments at once so that a full portfolio sync can happen in one call.

**Endpoint:** `POST /api/modules/ai-impact/assessments/bulk`

**Acceptance criteria:**
- Accepts array of assessment objects (same schema as 1.1, each with an `id` field for the RFE key)
- Idempotent per `(id, assessedAt)` pair
- Auth: Bearer API token
- Returns `{ created, updated, unchanged }`

### Story 1.3 — Incremental sync endpoint (DROPPED)

> ~~As the rfe-quality-dashboard CI pipeline, I can push only new/changed assessments so that daily syncs are efficient.~~

**Status:** Dropped. The bulk endpoint (Story 1.2) is idempotent. The `since` parameter adds no value: if the caller pre-filters, the param is redundant; if the caller sends everything, the full payload still crosses the network. Relying on idempotency is simpler and sufficient.

### Story 1.4 — API token authentication for ingest

> As an admin, I can generate an API token scoped to assessment data ingest so that the CI pipeline can authenticate without user credentials.

**Acceptance criteria:**
- Uses the existing app token system (`POST /api/tokens`)
- Ingest endpoints accept `Authorization: Bearer <token>`
- Unauthorized requests return 401
- No new token infrastructure needed

---

## Epic 2: Quality Score on RFE List

### Story 2.1 — Score badge on each RFE list item

> As a user viewing the RFE list, I can see each RFE's total quality score (0–10) and pass/fail status alongside the existing AI involvement badge so I can quickly identify low-quality RFEs.

**Acceptance criteria:**
- Score displayed as a number with pass/fail color (green >= 5, red < 5)
- RFEs without assessment data show a "Not assessed" state
- Visible alongside existing AI involvement badge (not replacing it)

### Story 2.2 — Sort by quality score

> As a user, I can sort the RFE list by quality score (ascending/descending) so I can focus on the lowest-scoring RFEs.

**Acceptance criteria:**
- Sort control added to RFE list (in addition to existing sort options)
- Default sort unchanged

### Story 2.3 — Filter by quality dimensions

> As a user, I can filter the RFE list by pass/fail, AI involvement, priority, and status so I can drill into specific segments.

**Implemented filters (fields present in current data model):**
- Pass/Fail (All / Pass / Fail / Not Assessed)
- AI Involvement (existing filter, unchanged)
- Priority (dropdown populated from data)
- Status (dropdown populated from data)

**Deferred filters (fields not yet in data model):**
- Council status, delivery status, commitment level, component, author, release

**Acceptance criteria:**
- Filter controls for each implemented dimension
- Filters combine with AND logic
- Charts and metrics update to reflect filtered subset
- Filter state preserved when navigating to detail view and back

---

## Epic 3: Quality Charts

### Story 3.1 — Score distribution histogram

> As a user, I can see a histogram showing how many RFEs fall into each score bucket (0–10) so I can understand the overall quality distribution.

**Acceptance criteria:**
- Bar chart with 11 buckets (0 through 10)
- Bars color-coded by pass/fail threshold (scores < 5 in one color, >= 5 in another)
- Supplements existing trend charts (does not replace them)
- Respects active time window and filters

### Story 3.2 — Criteria performance breakdown

> As a user, I can see average scores for each rubric criterion (what/why/how/task/size) so I can identify systemic weaknesses.

**Acceptance criteria:**
- Bar chart showing average score per criterion on 0–2 scale
- Shows percentage scoring zero per criterion
- Respects active time window and filters

---

## Epic 4: Extended RFE Detail Panel

### Story 4.1 — Rubric score breakdown

> As a user, when I select an RFE, I can see its full rubric score breakdown with the justification text for each criterion.

**Acceptance criteria:**
- Each criterion (what/why/how/task/size) shown with its score (0–2) and `criterionNotes` justification text
- Total score and pass/fail badge prominently displayed
- Anti-patterns listed as tags/badges if any were flagged

### Story 4.2 — Verdict and feedback

> As a user, when I select an RFE, I can see the overall verdict and actionable feedback from the assessment.

**Acceptance criteria:**
- `verdict` displayed as a summary line
- `feedback` rendered as markdown (actionable improvement suggestions)

### Story 4.3 — Score history

> As a user, when I select an RFE, I can see how its quality score has changed over time so I can tell if revisions improved it.

**Acceptance criteria:**
- Mini timeline or sparkline showing total score at each `assessedAt` date
- Expandable to see which criteria changed between assessments
- Most recent assessment is the primary/default view

---

## Epic 5: Storage & Admin

### Story 5.1 — Assessment data storage

> As the system, I store assessment data with history so that score changes over time are preserved.

**Acceptance criteria:**
- Stored in `data/ai-impact/assessments.json` (single file, filesystem-backed, consistent with app patterns)
- Each RFE's entry contains `latest` (full assessment) and `history` (array of trimmed prior assessments, capped at 20)
- Single-file design chosen over per-RFE files to avoid I/O cost of reading 1,630+ individual files for list/chart views
- Write safety via atomic write-to-temp-then-rename
- Data survives server restarts

### Story 5.2 — Assessment status in settings

> As an admin, I can see assessment data status and manage stored data from the Settings panel.

**Acceptance criteria:**
- Shows: last sync timestamp, total RFEs assessed, total assessment count
- Clear assessment data button with confirmation
