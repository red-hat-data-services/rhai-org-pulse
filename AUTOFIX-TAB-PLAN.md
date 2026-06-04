# Autofix Tab on Team Detail Page — Design Plan

## Overview

Add an "Autofix" tab to the team detail page in the team-tracker module that shows
Jira issues for a given team that went through the AI autofix pipeline, along with
aggregate bug counts and pipeline state breakdown.

## Data Model Analysis

### Autofix Data (ai-impact module)

Autofix data is fetched from Jira projects (AIPCC, RHOAIENG by default) and stored
at `ai-impact/autofix-data.json`. Each issue has:

| Field | Type | Description |
|-------|------|-------------|
| `key` | string | Jira issue key (e.g., `RHOAIENG-59199`) |
| `summary` | string | Issue summary |
| `status` | string | Jira status name |
| `issueType` | string | Bug, Story, etc. |
| `priority` | string | Priority name |
| `created` | string | ISO date |
| `updated` | string | ISO date |
| `labels` | string[] | All labels including pipeline labels |
| `components` | string[] | Jira components (e.g., `["AI Core Platform"]`) |
| `assignee` | string\|null | Display name |
| `pipelineState` | string | Classified state — see below |

### Pipeline States

**Triage states:** `triage-pending`, `triage-missing-info`, `triage-not-fixable`, `triage-stale`

**Autofix states:** `autofix-ready`, `autofix-pending`, `autofix-review`,
`autofix-ci-failing`, `autofix-merged`, `autofix-rejected`, `autofix-max-retries`,
`autofix-researched`, `autofix-blocked`

### Team-to-Component Mapping

Teams in team-tracker have a `components` array on the **enriched team detail**
object (`teamDetail`), NOT on the base `team` object from the roster. The components
are sourced from team metadata via a field definition with `optionsRef: 'component'`
and populated by `buildEnrichedTeams()` in `org-teams.js:168-174`. Example: team
"Heimdall" → `teamDetail.components = ["AI Core Platform", "AI Core Platform Security"]`.

**Matching strategy:** Filter autofix issues where `issue.components` intersects with
`teamDetail.components`. This is the natural mapping since Jira components are already
aligned with teams.

**Important:** `teamDetail` is fetched asynchronously after the team page loads
(`fetchTeamDetail()` in `TeamRosterView.vue:487-498`). `TeamAutofixTab` must defer
its autofix data fetch until `teamDetail?.components` is available (watch for it),
to avoid briefly showing "no data" while the enriched team data loads.

### API Endpoint

The ai-impact module serves autofix data at:
```
GET /api/modules/ai-impact/autofix-data?timeWindow=week|month|3months
```

Response:
```json
{
  "fetchedAt": "2026-04-22T05:17:38.418Z",
  "jiraHost": "https://redhat.atlassian.net",
  "metrics": { ... },
  "trendData": [...],
  "issues": [...]
}
```

**Key detail:** The endpoint returns ALL `issues` regardless of `timeWindow`. The
`timeWindow` parameter only affects the pre-computed `metrics` and `trendData` in the
response. Since we recompute both client-side for the team-filtered subset anyway,
we should **fetch once** (without a timeWindow param, or with a fixed value) and do
all time-window filtering locally. This avoids redundant API calls when the user
changes the time window selector.

### ai-impact Module Dependency

The Autofix tab calls `/api/modules/ai-impact/autofix-data`. If the ai-impact module
is **disabled** (admin can toggle modules), this endpoint returns 404. The tab must
handle this gracefully:

1. Check `enabledBuiltInSlugs` (from `useModules()`) to determine if `ai-impact` is
   enabled before making the API call.
2. If disabled, show a specific empty state: "The AI Impact module is not enabled.
   Enable it in Settings to see autofix data."
3. If the API call fails for other reasons (network error, 500), show a generic error
   state with retry option.

## Architecture Decision: Cross-Module Data Access

The ai-impact module does **not** declare `export.files` in its `module.json`. Per
the project's hard constraints, cross-module data access uses API calls at
`/api/modules/<slug>/`.

**Chosen approach:** The team-tracker client will call
`/api/modules/ai-impact/autofix-data` and filter issues client-side by matching
`issue.components` against `teamDetail.components`.

**Why client-side filtering:**
- The autofix dataset is bounded (hundreds, not thousands of issues)
- Avoids adding a team-aware endpoint to the ai-impact module
- The existing endpoint already returns all issues with component data
- Matches the pattern used by `AutofixContent.vue` which already does client-side
  component filtering
- No server-side changes needed in the ai-impact module

**Alternative considered:** Adding a server-side route in team-tracker that reads
ai-impact data via `readFromStorage`. Rejected because ai-impact doesn't export
files, so this would violate the module boundary constraint.

## UI Design

### Tab Placement

Append "Autofix" to the end of the existing `visibleTabs` array in `TeamRosterView`:

```
Overview | Delivery | RFE Backlog | 40/40/20 Allocation | Autofix
```

The tab is **always visible** (per requirements), with contextual empty states:
- No components configured → prompt to add components
- ai-impact module disabled → explain module needs enabling
- No matching issues → explain no autofix data for this team's components

### Tab Content Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Summary Cards (3 cards in a row)                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Total Issues  │  │ Bugs Fixed   │  │ Success Rate │          │
│  │     42        │  │ (merged)  18 │  │    72%       │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
├─────────────────────────────────────────────────────────────────┤
│  Pipeline Breakdown Bar                                         │
│  [████ Merged ████ Review ██ Pending █ CI Failing █ Blocked]   │
├─────────────────────────────────────────────────────────────────┤
│  Time Window: [Week] [Month] [3 Months]                         │
│  State Filter: [All ▾]   Search: [____________]                 │
├─────────────────────────────────────────────────────────────────┤
│  Issues Table                                                   │
│  ┌──────────┬──────────────────┬──────┬──────────┬───────────┐ │
│  │ Key      │ Summary          │ Type │ State    │ Updated   │ │
│  ├──────────┼──────────────────┼──────┼──────────┼───────────┤ │
│  │ RHOAI-1  │ Fix cert rotate  │ Bug  │ Merged   │ 2d ago    │ │
│  │ AIPCC-2  │ Bot too aggro    │ Bug  │ Blocked  │ 5d ago    │ │
│  └──────────┴──────────────────┴──────┴──────────┴───────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  Pipeline Funnel Trend Chart                                    │
│  (Line: Eligible for Autofix, Under Review; Bar: Merged)        │
│  Filtered to this team's components, same style as AI Impact    │
├─────────────────────────────────────────────────────────────────┤
│  Empty State (when team has no components or no matching data): │
│  "No autofix data available for this team."                     │
│  "This team has no Jira components configured."                 │
└─────────────────────────────────────────────────────────────────┘
```

### Summary Cards

1. **Total Issues** — Count of all autofix pipeline issues matching this team's
   components within the selected time window
2. **Bugs Fixed by AI** — Count of issues with `pipelineState === 'autofix-merged'`
   AND `issueType === 'Bug'`
3. **Success Rate** — `merged / (merged + rejected + maxRetries) * 100`. When
   terminal count is fewer than 3, show "—" instead of a percentage to avoid
   misleading metrics from tiny samples (e.g., 1/1 = 100%). Tooltip: "Not enough
   completed issues to calculate a meaningful rate."

### Pipeline Breakdown Bar

Horizontal stacked bar showing the distribution of pipeline states for the team's
issues. Color-coded (colors defined locally in `TeamAutofixTab.vue` — see
"Constants" section below):
- Merged: indigo
- Review: blue
- Pending: gray
- CI Failing: orange
- Blocked: yellow
- Max Retries: red
- Researched: teal

### Trend Chart

Pipeline funnel trend chart using **Chart.js 4** (already a project dependency) via
`vue-chartjs` (`Line` + `Bar` composite chart). Rendered client-side from
team-filtered issues.

**Axes:**
- X: Weekly date buckets (ISO date labels, e.g., "2026-04-22")
- Y: Issue count (integer, begin at zero)

**Datasets:**
- Line: "Eligible for Autofix" (green, filled area) — issues with any `autofix-*` state
- Line: "Under Review" (blue, filled area) — issues with `autofix-review` state
- Bar: "Merged" (indigo) — issues with `autofix-merged` state

**Bucket computation:** Same weekly-bucketing logic as `buildTrendData()` in
`autofix-fetcher.js`, but implemented as a pure ES module function in
`TeamAutofixTab.vue` (see "Constants" section for why we duplicate rather than
import).

**Chart options:** Responsive, `maintainAspectRatio: false`, dark-mode aware
(watch `document.documentElement.classList` for `dark`). Same pattern as
`AutofixContent.vue:270-280`.

### Filters

- **Time window:** Week / Month / 3 Months (default: Month) — filter by `created` date
- **State filter:** Dropdown with pipeline state options (defined locally in the
  component — see "Constants" section)
- **Search:** Text search on key, summary, assignee

**Note on metrics recomputation:** The server response includes pre-computed `metrics`
and `trendData`, but these are aggregated across ALL teams. Since the tab filters to
a single team's components, **all metrics, trend data, and time-window filtering are
recomputed client-side** from the team-filtered `issues` array. The API is called
once (without regard to timeWindow) and all subsequent filtering happens locally.
This mirrors `AutofixContent.vue`'s pattern (lines 101-168) which already recomputes
when project/component filters are active.

### Issue Table Columns

| Column | Source | Notes |
|--------|--------|-------|
| Key | `issue.key` | Linked to Jira (fallback host: `https://redhat.atlassian.net` if `jiraHost` missing from API response) |
| Summary | `issue.summary` | Truncated with tooltip |
| Type | `issue.issueType` | Badge (Bug, Story, etc.) |
| Priority | `issue.priority` | Optional column |
| Pipeline State | `issue.pipelineState` | Color-coded badge with human-readable label |
| Assignee | `issue.assignee` | Display name |
| Updated | `issue.updated` | Relative time (e.g., "2d ago") |

### Empty States

1. **ai-impact module disabled:** "The AI Impact module is not enabled. Enable it in
   Settings to see autofix data." (Checked via `enabledBuiltInSlugs` before API call.)
2. **Team has no components:** "This team has no Jira components configured. Add
   components in team settings to see autofix data."
3. **No matching issues:** "No autofix issues found for this team's components in
   the selected time window."
4. **Autofix data not yet fetched:** "Autofix data has not been loaded yet. An admin
   can trigger a refresh from the AI Impact settings."
5. **API error / network failure:** "Failed to load autofix data." with retry button.

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `modules/team-tracker/client/components/autofix/TeamAutofixTab.vue` | Main tab component — fetches data, filters by team components, renders summary + table + trend chart |
| `modules/team-tracker/client/components/autofix/autofix-constants.js` | Pipeline state labels, colors, and `STATE_OPTIONS` (duplicated from ai-impact — see "Constants" section) |
| `modules/team-tracker/client/services/autofix-api.js` | API client for fetching autofix data from ai-impact module |
| `modules/team-tracker/__tests__/client/autofix/TeamAutofixTab.test.js` | Unit tests for the tab component |
| `modules/team-tracker/__tests__/client/autofix/autofix-constants.test.js` | Unit tests for metrics computation and constants |

### Modified Files

| File | Change |
|------|--------|
| `modules/team-tracker/client/views/TeamRosterView.vue` | Add "Autofix" to `visibleTabs`, `VALID_TABS`, `TAB_ICONS`, `tabActivated`. Import and render `TeamAutofixTab`. |

### File Count: 6 new, 1 modified

## Implementation Details

### `autofix-api.js`

```js
import { cachedRequest } from '@shared/client/services/api.js'

export function fetchAutofixData(onData) {
  return cachedRequest('autofix-data', '/modules/ai-impact/autofix-data', onData)
}
```

Uses `cachedRequest(cacheKey, path, onData)` (stale-while-revalidate) so switching
between tabs doesn't re-fetch every time. The `onData` callback fires with cached
data first, then fresh data. **No `timeWindow` param** — the endpoint returns all
issues regardless of timeWindow, and we do all time filtering client-side.

### `autofix-constants.js` — Constants (Duplicated from ai-impact)

Hard constraint #1 forbids cross-module imports. `AutofixContent.vue` (in
`modules/ai-impact/`) contains pipeline state labels, colors, and the
`STATE_OPTIONS` array. The metrics computation logic lives in `autofix-fetcher.js`
(server-side CommonJS, not importable from frontend ES modules). Both must be
**duplicated** in team-tracker.

```js
// modules/team-tracker/client/components/autofix/autofix-constants.js

export const STATE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'triage-pending', label: 'AI Assessing' },
  { value: 'triage-missing-info', label: 'Missing Info' },
  // ... (full list from AutofixContent.vue:170-185)
]

export const STATE_COLORS = {
  'autofix-merged': { bg: 'bg-indigo-100', text: 'text-indigo-800', ... },
  'autofix-review': { bg: 'bg-blue-100', text: 'text-blue-800', ... },
  // ... (derived from AutofixContent.vue badge styles)
}

export function computeTeamMetrics(issues, timeWindow) {
  // Port of computeAutofixMetrics from autofix-fetcher.js
  // Pure ES module function, no external dependencies
}

export function buildTeamTrendData(issues, timeWindow) {
  // Port of buildTrendData from autofix-fetcher.js
  // Weekly bucketing by created date, current pipelineState
}
```

**Why duplicate instead of moving to `@shared`:** These constants are specific to
the autofix pipeline labeling convention. Moving them to shared would create a
coupling between the shared layer and a module-specific Jira label scheme. The
duplication is small (~60 lines of constants + ~80 lines of computation) and
unlikely to drift since the pipeline label set is stable.

### `TeamAutofixTab.vue` — Key Logic

The component will:
1. Accept `team` and `teamDetail` props (same as other tabs)
2. Check if ai-impact module is enabled via `enabledBuiltInSlugs` (from
   `useModules()` composable). If disabled, show module-disabled empty state
   without making any API call.
3. **Watch** `teamDetail?.components` — only fetch autofix data once components are
   available (avoids race condition where `teamDetail` loads after the tab mounts)
4. Call `fetchAutofixData(onData)` **once** — extract `jiraHost` + `issues` from
   response. Handle 404 (module disabled at runtime) and network errors gracefully.
5. Filter issues by component intersection:
   `issue.components.some(c => teamComponents.has(c))` where
   `teamComponents = new Set(teamDetail.components)`
6. Recompute metrics via `computeTeamMetrics(filteredIssues, timeWindow)` and trend
   data via `buildTeamTrendData(filteredIssues, timeWindow)` — both imported from
   `autofix-constants.js`. **Time window changes only trigger local recomputation,
   not a new API call.**
7. For success rate display: if terminal count < 3, show "—" with tooltip instead
   of a percentage.
8. Build Jira links using `jiraHost` from response (fallback: `https://redhat.atlassian.net`)
9. Render summary cards, pipeline breakdown, trend chart (Chart.js via `vue-chartjs`),
   and filterable issue table

### TeamRosterView Changes

Add to `tabActivated`:
```js
const tabActivated = ref({ overview: true, delivery: false, backlog: false, allocation: false, autofix: false })
```

Add to `TAB_ICONS`:
```js
autofix: '<path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />'
```

Add to `visibleTabs`:
```js
{ id: 'autofix', label: 'Autofix', icon: TAB_ICONS.autofix }
```

Add to `VALID_TABS`:
```js
const VALID_TABS = ['overview', 'delivery', 'backlog', 'allocation', 'autofix']
```

Add template section:
```html
<div v-if="tabActivated.autofix" v-show="activeTab === 'autofix'">
  <TeamAutofixTab :team="team" :teamDetail="teamDetail" />
</div>
```

## Testability

### Unit Tests (`TeamAutofixTab.test.js`)

1. **Renders module-disabled state** when ai-impact is not in `enabledBuiltInSlugs`
2. **Renders empty state** when `teamDetail` has no components
3. **Renders empty state** when no matching issues exist
4. **Defers fetch until teamDetail loads** — does not call API when `teamDetail` is null
5. **Filters issues by component** — given `teamDetail.components = ["A", "B"]`,
   only shows issues whose components intersect
6. **Computes metrics correctly** — total count, bug count, success rate
7. **Success rate shows "—"** when terminal count < 3
8. **Pipeline state badges** render with correct labels and colors
9. **Time window filter** changes displayed issues without re-fetching API
10. **State filter** narrows displayed issues
11. **Search filter** matches on key, summary, assignee
12. **Jira links** use `jiraHost` from API response; fall back to default
13. **Handles API error** — shows error state with retry button

### Unit Tests (`autofix-constants.test.js`)

1. **`computeTeamMetrics`** — matches `computeAutofixMetrics` output for same input
2. **`buildTeamTrendData`** — produces correct weekly buckets for each time window
3. **`STATE_OPTIONS`** — all expected pipeline states are present

### Integration Tests

Per the project's integration test enforcement policy, the implementation PR **must**
update `tests/integration/people-teams.spec.js` with at least:
1. Navigate to a team detail page
2. Click the "Autofix" tab
3. Verify the tab loads without errors (empty state is expected in demo mode since
   demo team components don't overlap with autofix fixture components)

The existing `people-teams` path filter in `integration-tests.yml` already watches
`modules/team-tracker/**`, so these tests will run automatically on PRs.

### Demo Mode

The existing `fixtures/ai-impact/autofix-data.json` fixture will serve data in demo
mode. The team-tracker's demo teams may not have matching components, so the tab will
show the empty state in demo mode — which is acceptable and tests that code path.

## Backward Compatibility

- **No breaking changes.** Adding a new tab does not affect existing tabs.
- **No new API endpoints.** Consumes existing ai-impact endpoint.
- **No module.json changes** for either module.
- **No new environment variables or secrets.**
- **Soft dependency on ai-impact module:** The tab checks `enabledBuiltInSlugs`
  before calling the ai-impact API. If ai-impact is disabled, the tab shows an
  explanatory empty state. If ai-impact is enabled but the API call fails (network
  error, 500), the tab shows an error state with retry. The tab never causes a
  hard failure — it degrades gracefully in all cases.
- **URL routing:** The `?tab=autofix` parameter integrates with the existing URL
  routing scheme in TeamRosterView.

## Deployment

No deployment changes needed. The feature is purely frontend — no new backend
routes, no data migration, no new environment variables.

## Design Decisions

1. **Component-only matching.** Issues are matched to teams solely by Jira component
   intersection (`teamDetail.components`, not `team.components`). No assignee-based
   fallback. This keeps the logic clean and consistent with how components already
   map to teams.
2. **Include trend chart.** The tab will include a pipeline funnel trend chart
   (showing autofix activity over time filtered to this team's components), in
   addition to summary cards and the issue table. Uses Chart.js 4 via `vue-chartjs`.
3. **Duplicate constants, don't import cross-module.** Pipeline state labels, colors,
   `STATE_OPTIONS`, and metrics computation logic are duplicated from ai-impact into
   `autofix-constants.js` within team-tracker. This respects hard constraint #1 (no
   cross-module imports). The alternative (moving to `@shared`) was rejected because
   these are module-specific Jira label conventions, not shared platform concerns.
4. **Fetch once, filter locally.** The API returns all issues regardless of
   `timeWindow`. We fetch once and recompute metrics/trends/time-window-filtering
   entirely client-side. Time window changes don't trigger API calls.
5. **Graceful module dependency.** Check `enabledBuiltInSlugs` before calling
   ai-impact API. Handle 404 and errors with specific empty states. The tab never
   causes a hard failure.
6. **Minimum sample for success rate.** Terminal count < 3 → show "—" instead of
   a percentage to avoid misleading metrics from tiny samples.
7. **Component mapping coverage** is the main risk. If team components don't overlap
   well with autofix issue components, many teams will see empty states. Production
   data should be sampled to validate coverage before launch.
8. **Demo mode tests empty state only.** Demo team components don't overlap with
   autofix fixture components. Integration tests verify the tab loads without errors
   in empty state. Aligning fixtures is deferred — keeping module fixtures independent
   reduces maintenance burden.
