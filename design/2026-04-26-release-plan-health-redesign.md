# Release Plan Health Redesign -- Draft Plan

**Date:** 2026-04-26
**Status:** Draft for review

---

## Summary

Replace the current "Release Health" view with "Release Plan Health". Switch feature sourcing from the feature-traffic index to the Big Rocks candidates pipeline (Tier 1/2/3). Add a phase selector (EA1/EA2/GA) with planning-deadline awareness. Add three planning-specific risk categories; suppress two execution-phase categories in pre-planning mode.

---

## Backend Changes

### 1. `constants.js` -- add risk categories and planning deadline offset

- Add `MISSING_OWNER`, `NO_BIG_ROCK`, `LATE_COMMITMENT` to `RISK_CATEGORIES`
- Add `PLANNING_DEADLINE_OFFSET_DAYS = 7` constant
- Add `PLANNING_RISK_CATEGORIES` array (the three new ones) and `EXECUTION_RISK_CATEGORIES` array (`MILESTONE_MISS`, `VELOCITY_LAG`) for suppress/enable logic

### 2. `health-pipeline.js` -- replace feature sourcing

- **Replace** `loadFeaturesForRelease()` with `loadFeaturesFromCandidates(readFromStorage, version)`:
  - Read the cached candidates response (`release-planning/candidates-{version}.json`) written by `buildCandidateResponse()`
  - Extract the `features` array (already has `tier`, `bigRock`, `issueKey`, `phase`, `components`, `pm`, `deliveryOwner`, `fixVersion`, `status`)
  - **Phase filtering**: Accept optional `phase` param (EA1/EA2/GA). If a feature has a phase-specific fixVersion (e.g., `rhoai-3.5-EA2`), include it only in the matching phase view. Otherwise include in all phase views.
  - Return features in the same shape the rest of the pipeline expects (key, summary, status, etc.). The candidate format is close; map `issueKey` -> `key` and carry `tier` + `bigRock` through.
- **Add** `computePlanningDeadline(milestones, phase)`: returns the relevant freeze date minus 7 days
- **Pass** the selected `phase` through to the risk engine so it can suppress/enable categories
- Update `runHealthPipeline()` signature to accept `phase` param; cache key becomes `health-cache-{version}-{phase}.json`

### 3. `risk-engine.js` -- suppress + augment

- **Accept** `{ phase, planningDeadline }` in opts
- **Suppress** `MILESTONE_MISS` and `VELOCITY_LAG` when `planningDeadline` is in the future (pre-planning mode)
- **Add** `MISSING_OWNER`: flag if `deliveryOwner` is empty. Severity: medium.
- **Add** `NO_BIG_ROCK`: flag if `tier === 3` (no Big Rock association). Severity: low. Message: "Not associated with any Big Rock"
- **Add** `LATE_COMMITMENT`: flag if today is past the planning deadline and the feature has no fixVersion containing the version string. Severity: high. Message: "No committed fix version {N} days after planning deadline"
- Existing `DOR_INCOMPLETE`, `BLOCKED`, `UNESTIMATED` checks remain unchanged

### 4. `health-routes.js` -- add phase query param

- All health GET routes accept `?phase=EA1|EA2|GA` query param (default: derive from current date using `computeMilestoneInfo`)
- Pass phase through to `runHealthPipeline()`
- Cache key includes phase: `health-cache-{version}-{phase}.json`
- Refresh route also accepts phase param; triggers pipeline for that phase
- No structural changes to DoR or override routes (they remain per-feature, phase-independent)

### 5. No changes needed

- `dor-checker.js` -- reuse as-is
- `rice-scorer.js` -- reuse as-is
- `jira-enrichment.js` -- reuse as-is (enriches by Jira key, source-agnostic)
- `audit-log.js` -- reuse as-is

---

## Frontend Changes

### 6. `module.json` -- rename nav item

- Change `"label": "Release Health"` to `"label": "Release Plan Health"`

### 7. `HealthDashboardView.vue` -- add phase selector, rename

- Rename page title: "Release Health Dashboard" -> "Release Plan Health"
- Add a `PhaseSelector` dropdown (EA1 / EA2 / GA) next to the existing `ReleaseSelector`
  - Default phase: derived from `summary.currentPhase` (server returns this)
  - Selection triggers `loadHealth(version, phase)`
- Display planning deadline: "Planning deadline: {date} ({N} days away)" below the milestone timeline
- Update empty state text: remove reference to "feature-traffic cache", point to "Big Rocks Planning" instead
- Export filenames: `plan-health-{version}-{phase}.csv`

### 8. `useReleaseHealth.js` -- pass phase param

- `loadHealth(version, phase)` -- append `?phase=` to URL
- `triggerHealthRefresh(version, phase)` -- same
- `checkHealthRefreshStatus(version, phase)` -- same
- ETag cache key includes phase

### 9. Components -- minimal changes

- `HealthSummaryCards.vue`: add a "Planning deadline" card showing days remaining. No other changes.
- `FeatureHealthTable.vue`: show `tier` column (Tier 1/2/3 badge). Already has `bigRock` column.
- `HealthFilterBar.vue`: add tier filter dropdown (Tier 1 / Tier 2 / Tier 3)
- `MilestoneTimeline.vue`: highlight the selected phase's freeze date. No structural change.
- New component: `PhaseSelector.vue` -- simple dropdown, ~30 lines. Options derived from milestones data (only show phases that have dates).

---

## New Risk Category Definitions

| Category | Trigger | Severity | When Active |
|---|---|---|---|
| `MISSING_OWNER` | `deliveryOwner` is empty | medium | Always |
| `NO_BIG_ROCK` | `tier === 3` | low | Always |
| `LATE_COMMITMENT` | Past planning deadline + no fixVersion for this version | high | Post-deadline only |

---

## What We Reuse

- **Risk engine structure** -- same `computeFeatureRisk()` signature, just add/suppress categories
- **DoR checker** -- entirely unchanged
- **RICE scorer** -- entirely unchanged
- **Jira enrichment** -- entirely unchanged (works on Jira keys regardless of source)
- **Health routes structure** -- same CRUD pattern, just add phase param
- **All health UI components** -- HealthSummaryCards, FeatureHealthTable, HealthFilterBar, MilestoneTimeline, export logic
- **ReleaseSelector component** -- unchanged
- **useReleaseHealth composable** -- same pattern, just pass phase

## What Changes

- Feature sourcing: feature-traffic index -> candidates pipeline output (5 files)
- Risk engine: +3 categories, suppress 2 conditionally (1 file)
- Phase selector: new component + wiring (3 files)
- Naming: "Release Health" -> "Release Plan Health" (2 files)

**Total files touched: ~11. No new backend dependencies.**
