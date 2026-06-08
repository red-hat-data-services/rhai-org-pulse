# RFE Pipeline Friction — Implementation Plan

## Overview

Add two friction metrics to **RFE Review** (AI Impact) for when the rfe-creator automation does not fully succeed. Org Pulse already tracks adoption (AI-created / AI-revised). This adds the complementary “gone wrong” signals using Jira labels already on every cached RFE.

**Naming:** “Friction” not “Health.” Health implies a broad readiness score (like the Component Maturity dashboard). This is specifically **where automation created human overhead** — blocked, flagged, or inconclusive runs.

**Scope:** Two stat tiles below the existing adoption metrics row. No new nav tab. No new Jira fetch. No PM breakdown table. No extra list filters. No new trend charts — use the same prior-period delta pattern as the adoption tiles.

**Questions this answers:**
- What % of AI-touched RFEs require manual human cleanup?
- Is that rate getting better or worse over time? (via pp change vs prior period, same as “Created with AI”)

---

## The two panels

| Panel | Label(s) | Metric |
|-------|----------|--------|
| **Needs Attention** | `rfe-creator-needs-attention` | % of AI-touched RFEs in the time window with this label |
| **Feasibility Blocked** | `rfe-creator-feasibility-fail`, `rfe-creator-feasibility-unknown` | % of AI-touched RFEs with **either** label (one combined “feasibility didn’t clear” rate) |

Each tile shows:
- Current window %
- Change vs prior period (percentage points), with trend direction where **lower is better**

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

## Data flow (unchanged infrastructure)

```
rfe-fetcher.js  →  labels[] on each issue  →  rfe-data.json
                                                    ↓
metrics.js  →  computePipelineFrictionMetrics()  →  API response
                                                    ↓
PhaseContent.vue  →  PipelineFrictionRow.vue (2 tiles)
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

### 3. UI — `modules/ai-impact/client/components/PipelineFrictionRow.vue`

- Copy layout from `MetricsRow.vue` — **2 columns**, not 4
- Section label: **Pipeline Friction**
- Subtitle: *When automation needs a human*
- Amber/red styling; down arrow = good for friction metrics

### 4. Wire-up

- `PhaseContent.vue` — render `PipelineFrictionRow` below `MetricsRow`
- `RFEReviewView.vue` — pass `rfeData.pipelineFriction` (or from `computeAllMetrics` payload)

### 5. Fixtures — `fixtures/ai-impact/rfe-data.json`

Add sample friction labels on a few demo RFEs so local demo mode shows non-zero rates (use **Last 3 Months** if fixture dates are stale).

### 6. Docs — same PR

- `docs/DATA-FORMATS.md` — document `pipelineFriction` object on RFE metrics response

---

## Acceptance criteria

- [ ] RFE Review shows **Pipeline Friction** row with two tiles below adoption metrics
- [ ] Needs Attention % matches manual count: AI-touched RFEs in window with `rfe-creator-needs-attention`
- [ ] Feasibility Blocked % matches: AI-touched RFEs with fail **or** unknown label
- [ ] Both tiles show change vs prior period when time window changes
- [ ] Demo fixtures include friction labels; rates visible locally
- [ ] Unit tests pass; lint passes

---

## Open question (resolve before merge)

**Denominator:** AI-touched only (recommended) vs all RFEs in window. AI-touched keeps the rate aligned with “of pipeline runs, how many failed?”
