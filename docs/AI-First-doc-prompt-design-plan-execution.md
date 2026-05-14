# AI-First Documentation Dashboard — Prompt -> Design -> Plan -> Execution

# Original prompt

```
okay now based on this labeling work here's what I'm thinking for a Dashboard ... your job will be to give me ideas how should I consider things differently and any potential improvements; base you analysis and report to me by investigating this script or the ones we've done earlier which observes jira and trigger the Pipeline of doc generation

the dashboard is composed of two parts, a top row with some KPI and graphs, and a table view of JIRAs

I'm thinking of

For the Top row

Row graph A.
Y: Number of RHAISTRAT which are "Review" state and "Require Product Documentation" flag
X: last rollin 30days
semantic: check trend of how much work is Dev-Complete ("Review" state) and requiring doc

Row graph B.
Y: % of RHAISTRAT from before (which are "Review" state and "Require Product Documentation" flag) but _also_ with flag `ai1st-doc-contributed`
X: last rolling 30days
semantic: check how many of the RHAISTRAT which are Dev-Complete and requing doc have been contributed by the tool

Row graph C.
Y: Number of RHAISTRAT and RHOAIENG with `ai1st-doc-invoked` label or ``ai1st-doc-contributed` label which have been modified in the last 30days
X: last rolling 30days
semantic: check trend of the tool usage (the `ai1st-doc-create` label is substituted by `ai1st-doc-invoked` and then with `ai1st-doc-contributed` comes from the Merge Requests)
note: modified in the last 30days to get the moving average and over the last rolling 30days to get the trend (2nd derivative)

Table 
RHAISTRAT jira in status Review, with ID, title, and if they have the label `ai1st-doc-contributed`  (or not) so to go in details and see


when giving me back the analysis I will need to share with a .MD format, so for now let's focus me and you, but I will need to produce these instructions (dashboard, top row graphs, and table view) in .MD so to share with the colleagues
```

# Design

---

## Top Row — KPI Graphs

### Graph A: Documentation Demand

- **Y-axis**: Count of RHAISTRAT issues in "Review" status with "Require Product Documentation" flag
- **X-axis**: Rolling 30-day window
- **Semantic**: How much dev-complete work is waiting for documentation. This is the **demand signal** — the total pool of work that *could* be addressed by the tool.

**Notes:**
- This metric is independent of the AI-First tool — it tracks the upstream demand regardless of whether AI-First is involved.
- A rising trend means documentation debt is accumulating; a falling trend means either docs are being written or features are shipping without doc requirements.

### Graph B: Documentation Coverage Rate

- **Y-axis**: Percentage of Graph A issues that *also* have label `ai1st-doc-contributed`
- **X-axis**: Rolling 30-day window
- **Semantic**: Of all the dev-complete work requiring docs, what fraction has the tool contributed an MR for? This is the **coverage rate**.

**Improvement considerations for some other day:**

1. `ai1st-doc-contributed` means an MR was *raised*, not *merged*. A raised MR that sits unreviewed or gets rejected is not the same as documentation delivered. Consider splitting into:
   - **Contributed** (MR raised) — current metric
   - **Accepted** (MR merged) — stronger signal, requires checking MR state

### Graph C: Tool Activity

- **Y-axis**: Count of `ai1st-doc-invoked` and `ai1st-doc-contributed` label *addition events* per day (from JIRA changelog / label history). Originally I was thinking of using "Jira modified in the last 30days" but that would count activities beyond the label additions.
- **X-axis**: Rolling 30-day window
- **Semantic**: How active is the tool? Each data point counts the labels that were *added* on that day, not issues that happen to exist with those labels. This avoids noise from unrelated JIRA modifications.

Note: this is a second derivative intentionally to get the accell/decell/stable trend.

here's what Claude suggest to use for this:

```
**Data source:** JIRA issue changelog (`GET /rest/api/3/issue/{key}/changelog`), filtering for `field == "labels"` entries where `toString` contains the label name. The `created` timestamp on each changelog entry gives the exact date the label was added.
```

---

## Table View

RHAISTRAT issues in "Review" status with "Require Product Documentation" flag.

| Column | Source | Purpose |
|---|---|---|
| JIRA Key | issue key | Link to JIRA |
| Summary | issue summary | What the feature is |
| Status | issue status | Should all be "Review" (filtered) |
| `ai1st-doc-contributed` | label presence | Yes/No — was documentation contributed? |
| CCS Epic | child Epic with CCS/DOCS in title | Link to the docs Epic (if exists) |

if possible, add the following too:

| MR Link | Git Pull Request field on task under Epic | Link to the contributed MR (if exists) |
| MR State | MR status (open/merged/closed) | Is the documentation accepted? |

**Notes:**
- The MR Link and MR State columns require traversing the hierarchy: RHAISTRAT → CCS Epic → Task → Git Pull Request field. This is the same walk that `mr_ai1st_jira_contrib.py` performs.
- Sorting by `ai1st-doc-contributed` (No first) surfaces the gap — which features still need documentation.

---

## Label Lifecycle

Understanding the label state machine is essential for interpreting the metrics.

```
Manual trigger path:
  ai1st-doc-start  →  ai1st-doc-invoked  →  (pipeline runs)

MR observation path:
  (MR detected)  →  ai1st-doc-contributed  (on JIRA task, Epic, and RHAISTRAT)

MR tracking (GitLab side):
  (MR processed)  →  ai1st-jira-contributed  (label on the MR itself)
```

NOTE: it is manual because we yet need in the SDLC the "Dev-Complete" work by previous steps/

Labels land on different levels of the JIRA hierarchy:

| Label | Applied to | Meaning |
|---|---|---|
| `ai1st-doc-start` | RHOAIENG / RHAISTRAT | "Needs doc pipeline" (manual input) |
| `ai1st-doc-invoked` | RHOAIENG / RHAISTRAT | "Pipeline was triggered" (replaces `ai1st-doc-start`) |
| `ai1st-doc-contributed` | RHOAIENG task + Epic + RHAISTRAT | "An MR was raised with documentation" |
| `ai1st-jira-contributed` | GitLab MR (not JIRA) | "This MR was processed back to JIRA" |

---

# Plan and Execution

## Context

The AI Impact module (`modules/ai-impact/`) had a placeholder "Documentation" nav item (`disabled: true`, routing to `ComingSoonView`). The design spec in `dashboard-design.md` describes a dashboard tracking AI-driven documentation activity on RHAISTRAT issues requiring product documentation. The view has 3 KPI graphs (demand, coverage rate, tool activity), cumulative all-time KPI cards, and two tables (demand pool + completed issues) with CCS Epic and MR columns.

The RFE AutoFix view within the same module was used as the architectural blueprint — pure Jira data, KPI metrics + charts + issue table, single-view dashboard.

## Jira Field Discovery (verified via API)

**"Product Documentation Required"** = `customfield_10665` — a dropdown/select custom field.
- When set: `{ "value": "Yes", "id": "19565" }`
- When not set: `null`
- JQL: `"Product Documentation Required" = "Yes"`

**"Git Pull Request"** = `customfield_10875` — an ADF (Atlassian Document Format) rich text field containing MR/PR URLs. Supports both `inlineCard` nodes (`attrs.url`) and text nodes with `link` marks (`attrs.href`).

**Hierarchy** (verified on RHAISTRAT-1686):
```
RHAISTRAT-1686 (Feature, DocRequired=Yes, has ai1st-doc-contributed label)
  └── child epic: RHOAIENG-60415 (Epic, "[DOCS RHAISTRAT-1686]..." title)
      └── child task: RHOAIENG-60417 (Task, has ai1st-doc-* labels + customfield_10875 MR link)
```

**CCS/DOCS Epic title patterns** (verified via API):
- `[ccs Epic] ...` — e.g., RHOAIENG-47518: `[ccs Epic] MCP Catalog – Enterprise Control of MCP Assets - DP 3.4`
- `[DOCS RHAISTRAT-xxxx] ...` — e.g., RHOAIENG-60415: `[DOCS RHAISTRAT-1686] EvalHub Kueue integration validation`
- Match: `summary ~ "CCS" OR summary ~ "DOCS"` (case-insensitive)

**Key findings:**
- `ai1st-doc-*` labels are populated up-to the RHAISTRAT feature level
- CCS/DOCS epics are children of RHAISTRAT features (via `parent` field)
- To find CCS/DOCS epics: `parent IN (keys...) AND (summary ~ "CCS" OR summary ~ "DOCS") AND issuetype = Epic`
- To find MR links: get tasks under the CCS/DOCS epic that have `ai1st-doc-contributed` label, read `customfield_10875`, parse ADF to extract URL(s)

## Graph Semantics (from design spec)

**Graph A: Features Ready for Documentation** — a **stock metric**
- Y-axis: count of RHAISTRAT issues in "Review" status with "Product Documentation Required" = Yes, accumulated by `created` date
- X-axis: rolling 30-day window
- Semantic: total pool of dev-complete work waiting for documentation (the demand signal)
- This metric is **independent of the AI-First tool** — tracks upstream demand regardless

**Graph B: Documentation Coverage Rate** — a **ratio metric** (derived from Graph A)
- Y-axis: percentage of Graph A issues that *also* have label `ai1st-doc-contributed`, tracked by `docContributedDate`
- X-axis: rolling 30-day window
- Semantic: of all issues requiring docs, what fraction has the tool contributed an MR for

**Graph C: Tool Activity** — a **rate metric** (7-day rolling average)
- Y-axis: 7-day rolling average of `ai1st-doc-invoked` and `ai1st-doc-contributed` label *addition events* per day
- X-axis: rolling 30-day window
- Semantic: how active is the tool — slope shows acceleration/deceleration, flat segments indicate weekends/non-working days
- Data source: Jira changelog entries where `field == "labels"` and `toString` contains the label name, fetched across **both RHAISTRAT and RHOAIENG** projects (not scoped to the demand pool)

**Implementation**: Graphs A and B compute trend data from issue `created` and `docContributedDate` fields (accumulated over the 30-day window). Graph C computes daily event counts from changelog, then applies a 7-day rolling average. All three are rendered as Line charts.

## Implementation

### Server — `doc-fetcher.js`

**File**: `modules/ai-impact/server/jira/doc-fetcher.js`

Follows `autofix-fetcher.js` pattern. Key functions:

- **`processIssue(issue, config)`** — Extracts `key`, `summary`, `status`, `labels`, `hasDocContributed`, `hasDocInvoked`, `created`, `updated`, `docContributedDate`, `docInvokedDate` (via reused `extractLabelDate` from `rfe-fetcher.js`). Initializes `ccsEpic: null`, `mrLinks: []`.
- **`extractLabelAdditionEvents(changelog, targetLabels, issueKey)`** — Scans changelog histories for label additions matching target labels. Returns `[{ label, date, issueKey }]`.
- **`extractMrUrlFromAdf(adfDoc)`** — Parses ADF document to extract URL from `inlineCard` nodes (`attrs.url`) or text nodes with `link` marks (`attrs.href`).
- **`computeDocMetrics(issues, labelEvents)`** — Returns `demandCount`, `coverageCount`, `coverageRate`, `invokedCount`, `totalLabelEvents` (last 30 days).
- **`buildDocTrendData(issues, labelEvents)`** — 30 daily data points with:
  - Graph A: `demand` (issues created on or before each date)
  - Graph B: `coverageCount`, `coverageRate` (issues with `docContributedDate` on or before each date)
  - Graph C: `invokedRate`, `contributedRate`, `activityRate`, `activityAccel` (7-day rolling average of daily label events + day-over-day acceleration)
- **`resolveChildCcsEpics(jiraRequest, issues)`** — Batch-finds CCS/DOCS epics via `parent IN (...)` JQL. Batches of 50. Populates `issue.ccsEpic = { key, summary, status }`.
- **`resolveMRLinks(jiraRequest, issues, config)`** — Finds tasks under CCS/DOCS epics that have `ai1st-doc-contributed` label, extracts MR URLs from `customfield_10875`. Populates `issue.mrLinks` (array — supports multiple MRs per issue).
- **`fetchDocData(jiraRequest, config)`** — Main demand pool fetch: RHAISTRAT in Review + DocRequired=Yes with `expand: changelog`.
- **`fetchDocActivityEvents(jiraRequest, config)`** — Broad tool activity fetch: all RHAISTRAT + RHOAIENG issues with `ai1st-doc-invoked` or `ai1st-doc-contributed` labels, updated in last 30 days, with `expand: changelog`.
- **`fetchDocCumulativeStats(jiraRequest, config)`** — Five parallel JQL count queries for all-time cumulative KPIs.
- **`fetchDocCompletedData(jiraRequest, config)`** — Resolved/Closed RHAISTRAT issues with DocRequired + `ai1st-doc-contributed`, updated in last 30 days.

### Server — Config changes

**File**: `modules/ai-impact/server/config.js`

Added to `DEFAULT_CONFIG`:
```js
docProject: 'RHAISTRAT',
docRequiredStatus: 'Review',
docRequiredFieldId: 'customfield_10665',
docContributedLabel: 'ai1st-doc-contributed',
docInvokedLabel: 'ai1st-doc-invoked',
docMrFieldId: 'customfield_10875',
```

All fields validated with `validateJqlSafeString` in `saveConfig()`.

### Server — Route + refresh integration

**File**: `modules/ai-impact/server/index.js`

- `GET /doc-data` route: reads cached `ai-impact/doc-data.json`, computes metrics/trends at request time, returns `{ fetchedAt, jiraHost, metrics, trendData, issues, completedIssues, cumulativeStats }`. In demo mode, `shiftDocDates()` adjusts all fixture dates relative to now so data never goes stale.
- `POST /refresh`: fetches demand pool, activity events, cumulative stats, and completed issues (each in its own try/catch). Stores everything in `ai-impact/doc-data.json`.
- `DELETE /cache`: clears `ai-impact/doc-data.json`.
- Diagnostics: includes documentation data status.

### Fixture data

**File**: `fixtures/ai-impact/doc-data.json`

10 demo issues with mixed states + 11 label events spread across 30 days. Dates are absolute in the file but shifted at request time via `shiftDocDates()` in demo mode.

### Client — Composable + View

**File**: `modules/ai-impact/client/composables/useDocumentation.js` — Mirrors `useAutofix.js`. Calls `apiRequest('/modules/ai-impact/doc-data')`, returns `{ docData, loading, error, load }`.

**File**: `modules/ai-impact/client/views/DocumentationView.vue` — Thin wrapper rendering `DocumentationContent`.

### Client — DocumentationContent.vue

**File**: `modules/ai-impact/client/components/DocumentationContent.vue`

Layout (top to bottom):

1. **Header**: "Documentation" title, subtitle with fetchedAt timestamp.

2. **Cumulative KPI Cards** (5 cards): all-time counts, each number is a clickable link opening the corresponding JQL query in Jira.

3. **KPI Graphs** (3 Line charts in a row):
   - Graph A: Features Ready for Documentation (demand accumulation)
   - Graph B: Coverage Rate (0–100%)
   - Graph C: Tool Activity (7-day rolling average, two series: invoked + contributed)

4. **Features Ready for Documentation Table**: instruction banner for `ai1st-doc-create` label, then sortable/filterable table with Key, Summary, Status, AI-First Doc Contributed (Yes/Not yet), CCS Epic, MR Link(s) columns. Default sort: "Not yet" first. MR links displayed as `!1234` (GitLab) or `#123` (GitHub).

5. **Completed with Documentation Table**: Resolved/Closed RHAISTRAT issues with `ai1st-doc-contributed` updated in last 30 days. Shows empty-state row when no matches.

### Routing

**File**: `modules/ai-impact/client/index.js` — `'documentation'` route points to lazy-loaded `DocumentationView`.

**File**: `modules/ai-impact/module.json` — `disabled: true` removed from documentation nav item.

### Tests

**File**: `modules/ai-impact/__tests__/server/doc-fetcher.test.js`

21 tests covering: `processIssue`, `extractLabelAdditionEvents`, `extractMrUrlFromAdf`, `computeDocMetrics`, `buildDocTrendData` (demand accumulation, coverage rate tracking, rolling average computation, cumulative behavior across days).

## Files Summary

| Action | File |
|--------|------|
| Create | `modules/ai-impact/server/jira/doc-fetcher.js` |
| Modify | `modules/ai-impact/server/config.js` |
| Modify | `modules/ai-impact/server/index.js` |
| Create | `fixtures/ai-impact/doc-data.json` |
| Create | `modules/ai-impact/client/composables/useDocumentation.js` |
| Create | `modules/ai-impact/client/views/DocumentationView.vue` |
| Create | `modules/ai-impact/client/components/DocumentationContent.vue` |
| Modify | `modules/ai-impact/client/index.js` |
| Modify | `modules/ai-impact/module.json` |
| Create | `modules/ai-impact/__tests__/server/doc-fetcher.test.js` |

## Verification

1. `npm run validate:modules` — passes
2. `npm test` — 2755 tests pass (21 new)
3. `npm run lint` — clean
4. Demo mode: `DEMO_MODE=true VITE_DEMO_MODE=true npm run dev:full` → AI Impact → Documentation
5. Real Jira: `npm run dev:full` → `curl -X POST http://localhost:3001/api/modules/ai-impact/refresh` → verify graphs and tables populate
