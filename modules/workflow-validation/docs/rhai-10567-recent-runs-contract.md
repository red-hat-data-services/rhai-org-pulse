# Recent Runs: landing page and data contract

Stories: [RHAI-10567](https://redhat.atlassian.net/browse/RHAI-10567) and
[AIPCC-33215](https://redhat.atlassian.net/browse/AIPCC-33215).

## Page and navigation

Dashboard opens Recent Runs inside Workflow Validation. The initial view shows
20 runs, newest first, with Previous and Next controls. A run is one
`telemetry_suite` and `invocation_id` pair. Keep different invocations separate.

Show Test suite, Version, Recorded test time (UTC), and View run. Missing version
or time shows an unavailable label. The time is the latest existing execution
`timestamp` in the group. It is not a RHOAI build date. Build metadata and
OpenSearch schema changes are outside this change.

Version, suite, run ID, and recorded-date filters are optional. Run ID matches
a case-insensitive substring. Date bounds are inclusive UTC calendar days.
Sort newest or oldest recorded test first. Choices update results immediately.
Run ID search updates after a 300 ms typing pause. Every change resets to page
one and searches all available run groups, including those outside the first page. Clear restores the unfiltered,
newest-first first page. Show the applied criteria and matching range/count.
Filter options come from all groups. Shared detail filters and automatic date
or version defaults do not restrict this page. URL parameters use the `recent`
prefix so reloads retain the current filters, sort, and page.

View run opens the existing Overview view as a hidden details route. Pass
`exactRun=1`, suite, and invocation, and clear the version and date bounds. Scope Overview and Charts queries by
suite and invocation across every version in that run.
Verify the selected run before fetching its Overview and Charts data. Show an
error and a link to Recent Runs if that run is missing. Never fall back to a
different run. Ignore responses for earlier route selections.

Dashboard stays active for the selected run and individual test details.
Clicking Dashboard returns to Recent Runs. Do not add another sidebar item.
The existing Overview route remains available for bookmarked links.

## API

Reuse authenticated `GET /api/modules/workflow-validation/test-suites` with
`pageSize=20&includeBugs=false&sortDir=desc`. Do not add another endpoint.

The backend reads every composite aggregation page, groups existing execution
records by suite and invocation, and selects each group's latest metadata.
It applies filters to complete groups, sorts all matching groups, and then
selects a page. It never filters individual executions first in paged mode.
Missing or invalid timestamps sort last in either direction. Timestamp ties
use suite and invocation for a stable order.

Paged parameters:

- `pageSize`: integer from 1 to 200. The landing page requests 20.
- `version`, `suite`: exact group metadata matches.
- `runQuery`: case-insensitive invocation ID substring.
- `dateFrom`, `dateTo`: optional `YYYY-MM-DD` bounds on the group timestamp.
- `sortDir`: `desc` (default) or `asc`, using `timestamp`.
- `cursor`: opaque next/previous anchor, bound to filters, sort, and page size.
- `refresh=true`: bypass the metadata cache (used by Refresh and Retry).

Return lightweight `rows` with `suite`, `invocationId`, `rhoaiVersion`, and
`timestamp`, plus `total`, `start`, `end`, `pageSize`, `nextCursor`,
`previousCursor`, `options`, `sortField`, and `sortDir`. Options contain all
available `versions` and `suites`. Null cursors disable the corresponding
button. Complete grouped metadata is cached for up to 10 seconds per runtime
connection. Page, filter, and sort requests reuse that metadata; Refresh and
Retry bypass the cache. Connection changes invalidate reuse. Failed or
disconnected scans are never cached. Legacy calls remain uncached. Newer
insertions do not shift a next-page anchor. A deleted or changed run can alter
page counts. Cursors contain fixed-size hashes of suite and invocation IDs, so long IDs
do not produce oversized URLs. Returned IDs are never truncated. Earlier raw-ID
cursors remain supported. If a hashed anchor was deleted, or the anchor has no
remaining rows, the page is empty and Previous resets to page one.

Invalid paged parameters return HTTP 400 before querying OpenSearch. Do not
combine paged mode with legacy `limit`, `latest`, or bug enrichment. Calls
without `pageSize` keep the existing unlimited/full response and optional
`limit=1..200&includeBugs=false` behavior for other consumers. Paged scans fetch metadata only and stop before the next OpenSearch request
when the response closes. An in-flight OpenSearch request keeps its existing
timeout. No new index, stored field, or data migration is required.

## Page states

Show Loading during the first request. Show an empty message only after a
successful empty response. Show an error and Retry on failure. Keep existing
rows during refresh and after a refresh failure. Pagination uses the filters for the displayed results. Disable pagination and
Refresh while loading or waiting for the search delay. Cancel queued searches
on clear, navigation, or unmount. New typing immediately cancels and invalidates
an older request, including responses arriving during the typing delay. Wait for a valid date range before fetching. Cancel earlier requests and ignore stale responses.

## Verification

Server tests cover traversal beyond 20 groups and across composite pages,
full-list filters/options, UTC bounds, both sort directions, timestamp ties,
missing metadata, invalid parameters, cursor isolation, and legacy responses.
Client tests cover initial pagination, recorded-time labels, filter isolation,
URL restoration, exact navigation, loading, retry, and stale responses.
Browser tests cover all 47 synthetic runs, filters outside the first page,
reload and clear, exact navigation, missing runs, and narrow screens.
The fixture is synthetic; the product reads the existing API.

## GPUaaS dev verification — 2026-11-01

The frontend and backend images were built from the PR Dockerfiles at commit
`cb4fa024d2dc51410e8061fbf392caf4178214b2`, using core tag `v2.0.91`.
This revision removes the shared dependency and security changes from the PR.
Both image builds completed, and both deployments are ready. The deployed
backend source matches the PR. Runtime settings and OAuth configuration are
unchanged. The previous image references are saved locally for rollback.

The landing page shows 20 real runs through the existing OpenSearch connection.
View run opened Ad Hoc invocation `1791447487869` with 17 tests: 11 passed and
6 skipped. Its return link opened Recent Runs. No OpenSearch data was updated.

[GPUaaS landing-page screenshot](images/rhai-10567-recent-runs-gpuaas.jpg).
[GPUaaS selected-run screenshot](images/rhai-10567-selected-run-gpuaas.jpg).

## GPUaaS pagination verification — 2026-11-04

Feature source: `9cc551f9`, on `feat/AIPCC-33215-recent-runs-controls`.
Both preview image builds completed and both deployments are ready. The preview
keeps its existing compatible app shell. The standard production build also
passes with the declared core dependency. This deployment targets GPUaaS only.

Live API and browser checks visited all 146 groups across eight pages. The
initial view shows 20 rows and pagination. Checks passed for Previous/Next,
page reload, a run outside the initial 20, filter reload, clear, UTC dates,
oldest-first sorting, and exact-run navigation. The settled page fits 375px and
320px screens; the table scrolls horizontally. No browser errors occurred.
The inventory and document counts stayed unchanged: 712 executions, 4,157 tasks,
and 184 root causes. Runtime settings, storage, and OAuth configuration stayed
unchanged. Previous image references are saved locally for rollback.

The full unit suite passed 6,688 tests, with 11 skipped. The added insertion
case and focused client/server tests passed afterward (25 tests). All 24 browser
integration tests passed. Lint, OpenAPI/module checks, and the production build
passed. Node 26 tests used `--no-experimental-webstorage` and local server access.

[Machine-readable evidence](aipcc-33215-validation.json).
[Initial unfiltered page](images/aipcc-33215-gpuaas-recent-runs.png).
[Filtered page](images/aipcc-33215-gpuaas-filtered.png).

### Automatic-filter follow-up

Frontend source `adb34723` removes Apply filters. Version, suite, date, and sort
choices update immediately. Run ID search waits for a 300 ms typing pause.
Clear filters remains and restores the newest-first, unfiltered first page.
The full unit suite passed 6,692 tests, with 11 skipped. All 127 module
unit tests and 25 browser integration tests passed. The updated
GPUaaS frontend passed the same live checks, including automatic filters,
Clear filters, reload, all eight pages, and narrow screens. Screenshots and the
machine-readable evidence above reflect this frontend revision.

### Review fixes and UI checks — 2026-11-04

Source `786e1a68` addresses disconnected scans, long-ID cursors, repeated metadata
scans, mixed-version exact runs, and stale responses during the typing delay.
Helper functions now document their behavior. The full unit suite passed 6,700
tests (11 skipped), including 135 module tests. All 27 browser integration tests
passed, including mixed-version results and Refresh on a later page.

Both updated images are deployed to GPUaaS. Live browser checks passed for all
146 groups across eight pages, automatic filters, Clear filters, date/sort
controls, old raw-ID page bookmarks, reload, Refresh retaining the current page,
retaining rows after an injected refresh error, Retry recovery, and 320/375px
layouts. Exact-run queries use suite and invocation without a version filter.
Rapid typing sent only the final search. No browser errors occurred. Document
counts and runtime settings stayed unchanged. Screenshots and JSON above now
reflect this revision. Synthetic regression tests cover 9,000-character IDs,
deleted cursor anchors, and mixed-version data without changing stored records.

### Minor review cleanup

Exact-run links now clear the version parameter, matching the exact-run data
queries. One `RECENT_RUNS_PAGE_SIZE` constant controls the requested page size,
response row limit, and page-size label. The page still shows 20 runs at a time.

Source `cf7df25c` passes all 6,700 unit tests (11 skipped) and all 27 browser
integration tests. The updated GPUaaS frontend also passes the live UI checks,
including an empty version in exact-run links, 20 rows per page, automatic
filters, Clear filters, pagination, old page links, Refresh/Retry, and narrow
screens. No browser errors occurred. The JSON evidence reflects this revision.

### Module-owned browser tests

The feature PR keeps every change inside Workflow Validation, including the
browser suite and its standalone Playwright config. Shared test files and the
shared CI configuration remain identical to the base branch.

All 27 module-owned browser tests pass. The branch also passes 6,737 unit tests
(11 skipped), lint, and the production build. The unchanged shared runner still
loads the legacy suite; five old checks fail against the updated page. A
separate maintainer-approved runner update must discover the module-owned suite
before this feature PR can merge. The PR remains draft for that dependency.
