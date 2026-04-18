# Plan: Unified Team Detail View & Simplified Team Cards

## Summary

Consolidate the team detail page into a **4-tab layout** combining information from the old Team Tracker and Org Roster modules, and simplify the TeamCard in the directory view by removing role breakdown badges.

## Requirements (from user)

1. **4-tab team detail view**: Overview, Delivery, Backlog, Sprints
2. **Rich persistent header**: Team name, org, member count, PM(s), Eng Lead(s), board links, RFE badge — always visible above tabs
3. **Simplified TeamCard**: Remove role breakdown badges; keep PM, Eng Lead, components, board link, RFE count
4. **Sprint tab visibility**: Hide Sprints tab entirely when no Jira board is configured
5. **Overview tab content**: Headcount doughnut chart + collapsible team members table ("who is on this team")

---

## Current State

| Aspect | Current (`TeamRosterView.vue`) | Missing from old Org Roster | Missing from old Team Tracker |
|--------|-------------------------------|----------------------------|------------------------------|
| Header | Team name + member count only | PM, Eng Lead, board links, RFE badge | N/A |
| Metrics | Resolved issues, story points, cycle time, GH/GL contributions | N/A | Sprint analysis (reliability, velocity, scope change) |
| Roster info | Member cards/table with Jira metrics | Headcount chart, components, RFE backlog table | N/A |
| Sprint data | None | N/A | TeamOverview + SprintDetail tabs |

**Key files involved:**
- `modules/team-tracker/client/views/TeamRosterView.vue` — current team detail (will become the orchestrator)
- `modules/team-tracker/client/components/TeamDetail.vue` — **dead code** (presentational-only, not imported anywhere; will be deleted)
- `modules/team-tracker/client/components/TeamOverview.vue` — sprint rolling averages, trends, contribution donut (reused in Sprints tab). Note: makes its own API calls for sprint annotations — not purely prop-driven.
- `modules/team-tracker/client/components/HeadcountChart.vue` — doughnut chart (currently only imported by `OrgDashboardView.vue`; will be reused in Overview tab)
- `modules/team-tracker/client/components/ComponentList.vue` — component list (currently **not imported anywhere** — orphaned from old org-roster; will be reused in Backlog tab). Verified: no dependencies on deleted composables; accepts `components`, `rfeCounts`, `rfeConfig` props only.
- `modules/team-tracker/client/components/TeamCard.vue` — directory card (simplify)
- `modules/team-tracker/client/composables/useOrgRoster.js` — data fetching for org-teams API
- `modules/team-tracker/server/routes/org-teams.js` — server routes for team metadata, RFE backlog

---

## Detailed Design

### 0. Team Key Normalization Strategy

**The problem:** Two key formats coexist:
- **Roster API** (`/api/roster`): keys are `orgKey::teamName` where orgKey is the LDAP manager UID (e.g., `crobson::Model Serving`)
- **Org-teams API** (`/api/modules/team-tracker/org-teams/:teamKey`): keys use org display name (e.g., `AAET::Model Serving`)

Commit `4d5e6da` already addressed this by adding `displayKey` to each team in the roster response (`shared/client/composables/useRoster.js:32`). The roster data now includes both:
- `team.key` = `orgKey::teamName` (LDAP UID format)
- `team.displayKey` = `displayName::teamName` (display name format, or `null` if no display name)

`TeamRosterView.vue:187` already resolves teams by matching against **both** `t.key` and `t.displayKey`.

**Strategy for the unified view:**
- Navigation always passes `teamKey` in display-name format (set by `TeamDirectoryView`'s `openTeam()` which builds `${team.org}::${team.name}`)
- When calling `loadTeamDetail(teamKey)`, use the display-name format key (which the org-teams API expects)
- When calling roster-based APIs like `getTeamMetrics(teamKey)`, use the roster `team.key` (resolved via the existing team lookup)
- The orchestrator (`TeamRosterView.vue`) resolves the roster `team` object first, then passes `team.displayKey || team.key` to org-teams calls and `team.key` to roster-based calls

**No additional API changes needed** — the existing dual-key resolution in `useRoster` handles this.

### 1. Team Detail View — Tab Structure

**File: `TeamRosterView.vue`** (refactored)

The view becomes a tabbed container with a persistent header and four tab panels.

#### 1.1 Persistent Header (above tabs)

Displayed for all tabs. Data sourced from two independent async sources:

1. **Roster data** (via `useRoster`): `team.displayName`, `team.key`, `team.members` — available quickly (cached in localStorage via stale-while-revalidate)
2. **Org-teams detail** (via `useOrgRoster.loadTeamDetail`): `productManagers`, `engLeads`, `boards`, `headcount`, `components`, `rfeCount`, `rfeIssues` — may be slower or unavailable

**Loading sequence:**
1. Roster data resolves first (via existing `watch(team)` pattern) — header shows team name, org, member count immediately
2. `loadTeamDetail` fires in parallel — when it resolves, header enriches with PM, Eng Lead, board links, RFE badge
3. If `loadTeamDetail` fails (404 or network error), header gracefully degrades to roster-only data (see Graceful Degradation section below)

```
+---------------------------------------------------------------+
| [<- Back]  Team Name                              [Refresh]   |
|            Org Name  |  42 members                            |
|                                                               |
|  PM: Jane Doe, John Smith    Eng Lead: Alice B.               |
|  Board: [link1] [link2]     [12 open RFEs badge]              |
+---------------------------------------------------------------+
| [ Overview ] [ Delivery ] [ Backlog ] [ Sprints ]             |
+---------------------------------------------------------------+
```

**Key implementation note:** `loadTeamDetail` currently does NOT use the stale-while-revalidate pattern (it calls `cachedRequest` without an `onData` callback). We should update the call to pass an `onData` callback so cached data appears instantly while fresh data loads. This is a one-line change in the orchestrator.

#### 1.2 Tab 1: Overview ("Who is on this team")

**Components:**
- `HeadcountChart.vue` (existing, verified standalone) — doughnut chart + role/headcount/FTE table
- New `TeamMembersOverview.vue` — collapsible table showing member name, role/specialty, focus area, and custom fields. Simpler than the Delivery tab's member table (no Jira metrics).

**Data:** `teamDetail.headcount` for the chart, roster `team.members` for the members table (the roster is the authoritative source for team membership).

**Fallback:** If `teamDetail` is unavailable, hide the headcount chart and show only the members table from roster data.

#### 1.3 Tab 2: Delivery (current TeamRosterView content)

**Components:** All existing — `MetricCard`, `PersonCard`, `PersonTable`, `ViewToggle`, `ResolvedIssuesModal`, `SnapshotHistoryModal`.

**Data:** `getTeamMetrics(team.key)` (existing, uses roster key format), GitHub/GitLab contributions (existing). No API changes.

This is the current `TeamRosterView.vue` body extracted into a tab panel component.

**Note on member data overlap:** Both `getTeamMetrics` and the roster return member lists with different shapes. The Delivery tab exclusively uses `getTeamMetrics` response for metrics data and roster `team.members` for the member list (current behavior). No data merging needed — each source is used for its own purpose.

#### 1.4 Tab 3: Backlog

**Components:**
- `ComponentList.vue` (existing, verified standalone — props: `components`, `rfeCounts`, `rfeConfig`)
- New `RfeBacklogTable.vue` — **written from scratch**, referencing the old `modules/org-roster/client/views/TeamDetailView.vue` (available via `git show main:modules/org-roster/client/views/TeamDetailView.vue`) as a design reference. Features: searchable, sortable table with columns for key, summary, components, status, priority, created. Includes Jira link generation using `rfeConfig`.

**Data:**
- `teamDetail.components` — flat array of component names
- `teamDetail.rfeIssues` — flat array of RFE issue objects from `org-teams/:teamKey` API
- `rfeConfig` — from `/rfe-config` API (for Jira host URL, component mapping)

**Per-component RFE counts for `ComponentList`:** The `org-teams/:teamKey` API returns a flat `rfeIssues` array (each issue has a `components` array). The Backlog tab wrapper (`TeamBacklogTab.vue`) will compute `rfeCounts` client-side by iterating `rfeIssues` and counting per component:
```js
const rfeCounts = computed(() => {
  const counts = {}
  for (const issue of props.rfeIssues) {
    for (const comp of (issue.components || [])) {
      counts[comp] = (counts[comp] || 0) + 1
    }
  }
  return counts
})
```

**Fallback:** If `teamDetail` is unavailable, show empty state message ("Component and RFE data requires org sync to be configured").

#### 1.5 Tab 4: Sprints (conditionally shown)

**Visibility:** Only rendered if `teamDetail.boards?.length > 0` (using the enriched `boards` array, not raw `boardUrls`, as `boards` is the explicit API contract from `org-teams.js:99`).

**Board ID extraction:** The `boards` array from org-teams contains `{ url, name }` objects. Board IDs must be parsed from URLs using the same regex as `org-sync.js:extractBoardId`: `url.match(/\/boards\/(\d+)/)`. This extraction will be done in `TeamSprintsTab.vue`.

**Sprint data fetching — written from scratch:** `TeamDetail.vue` is a purely presentational component (receives props, zero data fetching). The sprint data fetching logic must be built new in `TeamSprintsTab.vue`. The APIs to call are:

| API | Purpose | Response shape |
|-----|---------|----------------|
| `GET /api/modules/team-tracker/boards/:boardId/sprints` | Get sprint list for board | `{ sprints: [{ id, name, state, startDate, endDate }] }` |
| `GET /api/modules/team-tracker/boards/:boardId/trend` | Get trend data across closed sprints | `{ sprints: [{ sprintId, sprintName, ...metrics, byAssignee }] }` |
| `GET /api/modules/team-tracker/boards/:boardId/sprints/:sprintId` | Get single sprint report detail | Sprint report data with committed/delivered/byAssignee |

**Data loading flow in `TeamSprintsTab.vue`:**
1. Extract `boardId` from first board URL (or let user select if multiple boards)
2. Fetch sprints list + trend data in parallel
3. Pass to existing presentational components: `TeamOverview.vue` (trend data) and `SprintDetail.vue` (sprint report)
4. Sprint report loaded on-demand when user selects a specific sprint

**Annotation lifecycle:** `TeamOverview.vue` loads sprint annotations via its own API calls (`getSprintAnnotations`). Tab mount/unmount could affect its internal `annotationsCache` ref. Using `v-show` for the Sprints tab (once activated) will preserve this state. See Tab State Persistence section.

**Multiple boards:** If `boards.length > 1`, show a board selector dropdown above the sprint content. Default to the first board.

**Fallback:** Tab is hidden entirely if no boards — no fallback needed.

### 2. Graceful Degradation

When `loadTeamDetail` fails (org-teams metadata missing, 404, network error):

| Component | Behavior |
|-----------|----------|
| Header | Shows team name, org, member count from roster. PM, Eng Lead, board links, RFE badge hidden. |
| Overview tab | Headcount chart hidden. Members table still shows (uses roster data). |
| Delivery tab | Fully functional (independent data source — `getTeamMetrics` + GH/GL contributions). |
| Backlog tab | Shows message: "Component and RFE data is not yet available for this team. Run org sync from Settings to populate." |
| Sprints tab | Hidden (no board data to determine visibility). |

This ensures the view is always usable even for teams that exist in the roster but haven't been enriched by the Google Sheets org sync.

### 3. TeamCard Simplification

**File: `TeamCard.vue`**

Remove the "Role breakdown badges" section (lines 26-34 in current file) and the `topRoles` computed property. Keep:
- Team name + member count
- Org name
- PM and Eng Lead
- Component chips (up to 3 + overflow)
- Board link icon
- RFE count badge

This is a small, focused change.

### 4. Tab State Persistence

**Strategy: `v-if` for initial render, `v-show` after first activation.**

Each tab uses a `v-if="tabActivated[tabName]"` guard that becomes `true` on first visit, combined with `v-show="activeTab === tabName"` for subsequent switches. This means:
- Tabs are lazily rendered (no DOM cost until first visit)
- Once rendered, tabs stay in DOM (`v-show` hides them) — preserving internal state like scroll position, annotation caches, and form inputs
- Sprint data only fetches on first Sprints tab activation

Implementation pattern:
```vue
<div v-if="tabActivated.sprints" v-show="activeTab === 'sprints'">
  <TeamSprintsTab ... />
</div>
```

The `tabActivated` object is updated whenever `activeTab` changes via a watcher.

### 5. New/Modified Components

| Component | Action | Description | Complexity |
|-----------|--------|-------------|------------|
| `TeamRosterView.vue` | **Major refactor** | Becomes tabbed container with header + 4 tab panels | High — orchestrator |
| `TeamCard.vue` | **Minor edit** | Remove role breakdown badges section | Low |
| `TeamMembersOverview.vue` | **New** | Simple member table for Overview tab (name, role, focus area) | Low |
| `RfeBacklogTable.vue` | **New** | Written from scratch (design reference: old org-roster TeamDetailView on main). Searchable, sortable RFE issues table. | Medium |
| `TeamDeliveryTab.vue` | **New** | Extracted from current TeamRosterView body (metric cards + member cards/table) | Medium — move existing code |
| `TeamBacklogTab.vue` | **New** | Wrapper: ComponentList + RfeBacklogTable + rfeCounts computation | Low |
| `TeamSprintsTab.vue` | **New** | Sprint data fetching (boardId extraction, API calls) + renders TeamOverview/SprintDetail | High — new data fetching |
| `TeamOverviewTab.vue` | **New** | Wrapper: HeadcountChart + TeamMembersOverview | Low |
| `OrgTeamCard.vue` | **No change** | Still used by old Dashboard.vue; untouched | — |
| `TeamDetail.vue` | **Delete** | Dead code (not imported anywhere). Presentational-only, no logic to salvage. | — |

**Refactoring risk:** 8 new/modified components is significant. Mitigations:
- 4 of the 8 are thin wrappers (TeamOverviewTab, TeamBacklogTab, TeamMembersOverview, TeamDeliveryTab) — mostly moving existing code into new files
- Only 2 components have meaningful new logic: `TeamSprintsTab.vue` (data fetching) and `RfeBacklogTable.vue` (table UI)
- `TeamOverviewTab` and `TeamBacklogTab` could be inlined directly into `TeamRosterView.vue` if the wrapper components feel like unnecessary abstraction. Decision can be made during implementation.

### 6. Data Flow

```
TeamRosterView.vue (orchestrator)
  |
  +-- Resolves `team` from useRoster (roster key or displayKey)
  +-- Calls loadTeamDetail(team.displayKey || team.key) -> teamDetail
  |
  +-- Header:  team (roster) + teamDetail (org-teams, optional)
  |
  +-- Tab 1 (Overview):     teamDetail.headcount + team.members (roster)
  +-- Tab 2 (Delivery):     getTeamMetrics(team.key) + GH/GL contributions
  +-- Tab 3 (Backlog):      teamDetail.components + teamDetail.rfeIssues + /rfe-config
  +-- Tab 4 (Sprints):      boards[0].url -> boardId -> /boards/:id/sprints + /boards/:id/trend
```

**Data loading strategy:**
- **Eager (on mount):** `loadTeamDetail` (with `onData` callback for stale-while-revalidate) + `getTeamMetrics` + `loadGitlabStats` (existing)
- **Eager (from loadTeamDetail):** Header, Overview, Backlog data all come from the same response — no extra fetches
- **Lazy (on tab activation):** Sprint data (boards/:boardId/sprints, boards/:boardId/trend) — only when Sprints tab first activated
- **On-demand:** Sprint report detail (when user selects a specific sprint), annotation data (when user clicks contribution donut in TeamOverview)

---

## Affected APIs & Data Contracts

### APIs Used (no server changes needed)

| API | Used by | Key format | Notes |
|-----|---------|------------|-------|
| `GET /api/modules/team-tracker/org-teams/:teamKey` | Header, Overview, Backlog | display-name format | Returns headcount, components, rfeCount, rfeIssues, boards, engLeads, productManagers |
| `GET /api/modules/team-tracker/rfe-config` | Backlog tab | N/A | Returns jiraHost, jiraProject, rfeIssueType, componentMapping |
| `GET /api/team/:teamKey/metrics` | Delivery tab | roster key format | Unchanged |
| `GET /api/github/contributions` | Delivery tab | N/A | Unchanged |
| `GET /api/gitlab/contributions` | Delivery tab | N/A | Unchanged |
| `GET /api/modules/team-tracker/boards/:boardId/sprints` | Sprints tab | boardId (numeric) | Returns sprint list |
| `GET /api/modules/team-tracker/boards/:boardId/trend` | Sprints tab | boardId (numeric) | Returns trend data with byAssignee |
| `GET /api/modules/team-tracker/boards/:boardId/sprints/:sprintId` | Sprints tab (on-demand) | boardId + sprintId | Sprint report detail |
| `GET /api/roster` | Team resolution | N/A | Unchanged |

### Data contracts: No breaking changes

All endpoints remain unchanged. The only new client-side consumption is:
- Overview + Backlog tabs reading fields from `org-teams/:teamKey` that were previously only consumed by the deleted org-roster module
- Sprints tab calling board/sprint APIs that were previously only called by the old Dashboard-based sprint view

---

## Backward Compatibility

1. **No API changes** — all endpoints remain the same. No new endpoints needed.
2. **Route key unchanged** — `team-detail` route in `index.js` still maps to `TeamRosterView.vue`.
3. **URL params unchanged** — `teamKey` parameter format preserved; both UID and display-name formats continue to work.
4. **Old components preserved** — `OrgTeamCard.vue`, `Dashboard.vue` are untouched (still work if referenced).
5. **TeamDetail.vue deletion** — already dead code (not imported anywhere); deletion has no runtime impact.

---

## Testability

### Unit Tests

| Test | What it validates | Notes |
|------|-------------------|-------|
| `TeamRosterView.test.js` | Tab rendering, tab switching, header shows team detail fields, Sprints tab hidden when no boards, graceful degradation when loadTeamDetail fails | New test |
| `TeamCard.test.js` | Role badges are NOT rendered, PM/lead/components/board/RFE still present | **New test** (no existing test exists for this component) |
| `RfeBacklogTable.test.js` | Search filtering, column sorting, Jira link generation, empty state | New test |
| `TeamMembersOverview.test.js` | Member list rendering, collapsible behavior | New test |
| `TeamOverviewTab.test.js` | HeadcountChart receives correct props, fallback when headcount missing | New test |
| `TeamDeliveryTab.test.js` | Metric cards, member cards/table rendering | New test (logic moved from TeamRosterView) |
| `TeamBacklogTab.test.js` | ComponentList + RfeBacklogTable integration, rfeCounts computation | New test |
| `TeamSprintsTab.test.js` | Board ID extraction from URL, lazy loading of sprint data, board selector for multiple boards | New test |

### Integration/Manual Tests

1. Navigate to team detail from directory — verify all 4 tabs load
2. Team without Jira board — verify only 3 tabs shown (no Sprints)
3. Team without components/RFEs — verify Backlog tab shows empty states
4. Team without headcount data — verify Overview tab hides chart, shows members only
5. Team not in org-teams metadata (roster-only) — verify graceful degradation (Delivery works, header shows roster data, other tabs show fallback messages)
6. Tab state persistence — switch tabs and verify no re-fetches, scroll position preserved
7. Sprints tab lazy load — verify sprint API calls only fire when tab is first activated
8. Back navigation — returns to directory with filters preserved
9. Refresh button — refreshes delivery metrics (tab 2)
10. CSV export — still works from Delivery tab
11. Dark mode — all new components respect dark mode classes
12. Multiple boards — verify board selector appears and switches sprint data

---

## Deployability

1. **Frontend-only change** — no backend modifications needed. Can be deployed independently.
2. **No migration needed** — no data format changes, no config changes.
3. **Feature flag** — not needed; this is a UI refactor with no data model changes.
4. **Rollback** — git revert is sufficient since no server/data changes.
5. **Build impact** — new components are small; no new dependencies. Bundle size increase is negligible.

---

## Implementation Order

1. **TeamCard simplification** — remove role badges (smallest change, can be done first)
2. **Delete `TeamDetail.vue`** — dead code cleanup
3. **Create leaf components** — `TeamMembersOverview.vue`, `RfeBacklogTable.vue` (written from scratch, referencing old org-roster code on main)
4. **Create tab panel wrappers** — `TeamOverviewTab.vue`, `TeamDeliveryTab.vue` (extract from TeamRosterView), `TeamBacklogTab.vue`, `TeamSprintsTab.vue` (most complex — new data fetching)
5. **Refactor TeamRosterView.vue** — add header with dual data sources, tab bar, wire up tab panels, implement tab activation tracking
6. **Tests** — create all new test files listed above
7. **Manual QA** — run through integration test checklist

Steps 1-2 can be done immediately. Steps 3-4 can be parallelized (leaf components are independent of each other). Step 5 depends on steps 3-4.

---

## Open Questions

1. **Should `TeamOverviewTab` and `TeamBacklogTab` be separate components or inlined?** Both are thin wrappers. Could be inlined directly into `TeamRosterView.vue` template to reduce file count from 8 to 6. Decision deferred to implementation.

2. **Board selector UX for multiple boards:** Should the selector be a dropdown, tabs, or radio buttons? Most teams have 0-1 boards, so this is a low-priority edge case. Default: simple `<select>` dropdown.

3. **`loadTeamDetail` stale-while-revalidate upgrade:** The composable's `cachedRequest` supports an `onData` callback but `loadTeamDetail` doesn't pass one. Should we update `useOrgRoster.loadTeamDetail` to accept an optional `onData` callback, or handle caching at the orchestrator level? Recommendation: update the composable for consistency with other methods like `loadTeams`.
