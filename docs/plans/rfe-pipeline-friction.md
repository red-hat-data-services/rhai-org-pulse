# RFE Pipeline Friction — Implementation Plan

## Overview

Add two friction metrics to **RFE Review** (AI Impact) for when the rfe-creator automation does not fully succeed. Org Pulse already tracks adoption (AI-created / AI-revised). This adds the complementary “gone wrong” signals using Jira labels already on every cached RFE.

**Naming:** “Friction” not “Health.” Health implies a broad readiness score (like the Component Maturity dashboard). This is specifically **where automation created human overhead** — blocked, flagged, or inconclusive runs.

**Scope:** Embed friction as sub-text inside the existing 4-column adoption metrics row — **no second row, no new cards, no extra vertical space**. No new nav tab. No new Jira fetch. No PM breakdown table. No extra list filters. No new trend charts.

**Questions this answers:**
- What % of AI-touched RFEs require manual human cleanup?
- Is that rate getting better or worse over time? (via pp change vs prior period)
- At a glance: “We’re creating a lot with AI — and how much of that needed a human?”

---

## The two friction signals

| Signal | Label(s) | Metric |
|--------|----------|--------|
| **Needs Attention** | `rfe-creator-needs-attention` | % of AI-touched RFEs in the time window with this label |
| **Feasibility Blocked** | `rfe-creator-feasibility-fail`, `rfe-creator-feasibility-unknown` | % of AI-touched RFEs with **either** label (one combined “feasibility didn’t clear” rate) |

**Denominator:** RFEs in the window where `aiInvolvement !== 'none'` (pipeline actually ran). Manual RFEs with no AI labels are excluded so rates are not diluted.

**Time window:** Same selector as adoption metrics (`week` / `month` / `3months`), filtered by `issue.created`.

**Out of scope for this change:** `rfe-creator-autofix-rubric-pass`, per-PM breakdown, topic grouping, friction trend charts, list filters, assessment rubric scores (those are a separate signal).

---

## Why these two labels

| Signal | Meaning |
|--------|---------|
| `rfe-creator-needs-attention` | Automation ran but could not resolve the RFE — **human must intervene** |
| `rfe-creator-feasibility-fail` | Pipeline judged the RFE **technically infeasible** |
| `rfe-creator-feasibility-unknown` | Pipeline **could not determine** feasibility |

Needs-attention = cleanup overhead. Feasibility fail/unknown = pipeline blocked or inconclusive on technical grounds. Together they cover the main “system didn’t work for the user” cases visible in Jira today.

---

## UI — Split-card layout (recommended)

### Problem with a stacked second row

A separate “Pipeline Friction” row below adoption metrics causes:
1. **Vertical bloat** — users scroll past two card rows before reaching trend charts
2. **Disconnected context** — “Created with AI 100%” sits far from “Needs Attention 50%”; users must look up and down to connect success vs friction

### Solution: pair friction inside existing adoption cards

Keep the **4-column layout unchanged**. Friction metrics are sub-attributes of AI-touched RFEs, so show them as sub-text inside the adoption cards they relate to:

| Column | Adoption metric | Friction sub-text |
|--------|-----------------|-------------------|
| 1 | **Created with AI** (big %) | `{needsAttentionPct}% require attention` (+ change as `pp`) |
| 2 | **Revised with AI** (count) | `{feasibilityBlockedPct}% feasibility blocked` (+ change as `pp`) |
| 3 | Total RFEs | *(unchanged)* |
| 4 | Trend Status | *(unchanged)* |

Example appearance:

```
Created with AI          Revised with AI
100%  +5%                12
33% require attention    25% feasibility blocked
  +3pp                     -2pp
```

**Styling:** sub-text uses `text-xs text-gray-500` — informational, not alarming. No warning icons, no amber/red badges. Same neutral tone as “X prev period” on the Revised card.

**Why this works:** zero extra vertical space, success vs friction read in a single glance, no new component file.

---

## Data flow (unchanged infrastructure)

```
rfe-fetcher.js  →  labels[] on each issue  →  rfe-data.json
                                                    ↓
metrics.js  →  computePipelineFrictionMetrics()  →  API response
                                                    ↓
MetricsRow.vue  →  friction sub-text in columns 1 & 2
```

Labels are already stored; `metrics.js` only aggregates `aiInvolvement` today and ignores friction labels.

---

## Implementation

### 1. Server — `modules/ai-impact/server/metrics.js`

Add:

```js
const FRICTION_LABELS = {
  needsAttention: 'rfe-creator-needs-attention',
  feasibilityFail: 'rfe-creator-feasibility-fail',
  feasibilityUnknown: 'rfe-creator-feasibility-unknown'
};

function hasFeasibilityBlocked(labels) {
  const set = new Set(labels || []);
  return set.has(FRICTION_LABELS.feasibilityFail)
    || set.has(FRICTION_LABELS.feasibilityUnknown);
}
```

Add `computePipelineFrictionMetrics(issues, timeWindow, config)`:
- Current and prior windows (same cutoffs as `computeMetrics`)
- Denominator: `aiInvolvement !== 'none'` in each window
- `needsAttentionPct`, `needsAttentionChange`, `needsAttentionTrend`
- `feasibilityBlockedPct`, `feasibilityBlockedChange`, `feasibilityBlockedTrend`
- Trend: lower friction = improving (invert logic vs adoption)

Wire into `computeAllMetrics()`:

```js
return {
  metrics: computeMetrics(...),
  trendData: buildTrendData(...),
  breakdown: buildBreakdownData(...),
  pipelineFriction: computePipelineFrictionMetrics(issues, timeWindow, config)
};
```

### 2. Tests — `modules/ai-impact/__tests__/server/pipeline-friction.test.js`

- Rates use AI-touched denominator only
- Feasibility fail + unknown counted once per issue (not double-counted)
- Prior-period delta and empty window → 0%, not NaN
- Update `computeAllMetrics` test to expect `pipelineFriction`

### 3. UI — extend `modules/ai-impact/client/components/MetricsRow.vue`

- Add optional `pipelineFriction` prop
- **Column 1 (Created with AI):** below the main stat, add sub-text:
  - `{needsAttentionPct}% require attention`
  - `{needsAttentionChange}` formatted as `+Npp` / `-Npp` / `—`
- **Column 2 (Revised with AI):** below the count, add sub-text:
  - `{feasibilityBlockedPct}% feasibility blocked`
  - `{feasibilityBlockedChange}` formatted as `+Npp` / `-Npp` / `—`
- No new component. No second row.

### 4. Wire-up

- `PhaseContent.vue` — pass `pipelineFriction` to `MetricsRow` (not a separate row component)
- `RFEReviewView.vue` — pass `rfeData.pipelineFriction` through to `PhaseContent`

### 5. Fixtures — `fixtures/ai-impact/rfe-data.json`

Add sample friction labels on a few demo RFEs so local demo mode shows non-zero rates (use **Last 3 Months** if fixture dates are stale).

### 6. Docs — same PR

- `docs/DATA-FORMATS.md` — document `pipelineFriction` object on RFE metrics response

---

## Acceptance criteria

- [ ] RFE Review keeps a **single** 4-column metrics row (no second friction row)
- [ ] “Created with AI” card shows needs-attention % and pp change as sub-text
- [ ] “Revised with AI” card shows feasibility-blocked % and pp change as sub-text
- [ ] Needs Attention % matches manual count: AI-touched RFEs in window with `rfe-creator-needs-attention`
- [ ] Feasibility Blocked % matches: AI-touched RFEs with fail **or** unknown label
- [ ] Sub-text updates when time window changes
- [ ] Demo fixtures include friction labels; sub-text visible locally
- [ ] Unit tests pass; lint passes

---

## Resolved decisions

**Denominator:** AI-touched only (`aiInvolvement !== 'none'`). Keeps the rate aligned with “of pipeline runs, how many had this outcome?”

**UI layout:** Split-card (friction sub-text inside existing adoption cards), not a stacked second row.
