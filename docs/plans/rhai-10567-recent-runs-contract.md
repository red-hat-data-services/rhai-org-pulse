# Recent Runs: UI and data contract

Parent: [RHAI-10567](https://redhat.atlassian.net/browse/RHAI-10567).
Subtasks: [RHAI-10753](https://redhat.atlassian.net/browse/RHAI-10753),
[RHAI-10754](https://redhat.atlassian.net/browse/RHAI-10754), and
[RHAI-10755](https://redhat.atlassian.net/browse/RHAI-10755).

## Scope agreed on 2026-10-19

Recent Runs is the module default. Show up to 20 runs across all suites and
versions. Use the existing dev dashboard data flow. Authoritative build dates
and build-time selection/ordering are split into
[RHAI-10898](https://redhat.atlassian.net/browse/RHAI-10898). Keep a placeholder
for that field in RHAI-10567.

Dashboard is the only sidebar entry for this flow. It opens Recent Runs.
Selecting a run opens the existing Overview view as a hidden details route.
That route and individual test details keep Dashboard active in the sidebar.
Do not add a separate Recent Runs sidebar item.

Show four columns: Test suite, Version, Build date and time, and View run.
Build date and time shows “Not available yet.” Missing version shows
“Version unavailable.” Keep the invocation ID as secondary text. Format suite
labels for display without changing their stored identifiers.

The product page has no design-preview banner, state picker, or navigation
dialog. Counts, product bugs, Jenkins links, and optional filters belong to
other stories. Exploratory Specs filter work is tracked in RHAI-10795.

## Existing data flow

The deployed frontend uses the shared `apiRequest` service. Its `/test-suites`
backend route queries `workflow-executions` in OpenSearch. It groups records
by `telemetry_suite` and `invocation_id` with a composite aggregation. It reads
all aggregation pages, maps each group's latest test metadata, and sorts the
run groups. The default response also retrieves product-bug findings.

Read-only checks on 2026-10-19 confirmed HTTP 200 from the deployed `/filters`
and `/test-suites` APIs. The latter returned 142 run groups. Its first two were:

- `ad-hoc` / `1791447487869`, version `3.6.0-ea.2`, recorded test time
  `2026-10-08T12:14:25.054Z`.
- `aramco` / `1791431434265`, version `3.5.1`, recorded test time
  `2026-10-08T04:25:43.186Z`.

The effective endpoint came from the dev deployment environment. No saved
endpoint or proxy override was active. These checks identify the dev source;
they do not establish a production replica. The user's kubeconfig and the
remote deployments were unchanged.

## API used by the landing page

Reuse authenticated `GET /api/modules/workflow-validation/test-suites` with
`limit=20&includeBugs=false`. Do not inherit shared version, suite, invocation,
verdict, search, or date filters. Do not add a second recent-runs endpoint.

The metadata response contains `rows` with:

- `suite`: recorded `telemetry_suite`.
- `invocationId`: recorded opaque `invocation_id`.
- `rhoaiVersion`: version from the group's latest recorded test, or null.
- `timestamp`: latest recorded test start, or null.
- `buildTimestamp`: null; reserved for future build-time integration.

`limit` accepts integers from 1 to 200; invalid values return HTTP 400. Sort
by recorded test timestamp descending before applying the limit. Put missing
or invalid times last. Break ties by suite and invocation. Keep different
invocations as separate rows. `includeBugs=false` skips RCA retrieval and
returns only these metadata fields. Existing callers retain their full response
when they omit that flag. The browser also caps rows at 20 for compatibility
with a deployed backend that does not yet implement `limit`.

This is an interim recorded-test-time order. It does not satisfy verified
build-time ordering. Do not infer a build time from the invocation ID or show
the test timestamp in the build-date column.

## Loading and navigation

Show a loading message during the initial request. Show “No runs are available”
only after a successful empty response. Show an error and Retry on failure.
Keep existing rows during refresh and after a refresh failure. Disable Refresh
while a request is pending. Ignore responses after the page unmounts.

View run opens `overview` with `exactRun=1`, explicit `version`, `testSuite`,
and `invocationId`, and cleared date bounds. An unavailable version is passed
as an explicit empty value. This mode reuses the existing Dashboard content.
It bypasses FilterBar initialization so it cannot silently select another run.
The existing suite/invocation detail endpoint verifies the selected run first.
A missing run shows an error with a link back to Recent Runs. Route changes
reload the selected run. Responses from an earlier selection are ignored.

Individual tests keep the existing `run-detail?runKey=<execution_id>` route.
The existing Overview route remains available for bookmarked links. Clicking
Dashboard in the sidebar always returns to the recent-runs list.

## Build-time follow-up: RHAI-10898

The Director producer sets `timestamp` and `started_at` from individual test
start time. Neither establishes an authoritative Jenkins build start. Eight
sampled invocation records had matching values and no verified build time.
Schema inspection returned HTTP 403. A Jenkins-tagged search returned no
samples; that does not prove every historical record lacks a build association.

RHAI-10898 must verify the authoritative build-time source and its searchable
coverage. It must define missing-build-time behavior and order all run groups
before selecting the latest 20 by build time. No Jenkins lookup is part of the
current implementation. RHAI-10567 now explicitly accepts recorded-test-time
ordering and a build-time placeholder. The epic retains its final build-time
requirements. Jenkins job/build-number display and links remain in RHAI-10570;
both follow-up stories must share verified build identity.

## Implementation and verification

The implementation uses `RecentRunsView.vue`, the existing composable and
`/test-suites` route, and the existing Overview view. The synthetic response
fixture is `fixtures/workflow-validation/recent-runs.json`.

Server tests cover ordering across aggregation pages, the 20-run limit,
metadata gaps, timestamp ties, and invalid limits. Client tests cover loading,
empty/error/retry states, refresh retention, request filter isolation, exact
navigation, and stale responses. Browser integration tests cover the landing
page through the Dashboard to an individual test, missing runs, and retry.

The local product preview uses synthetic responses. The GPUaaS dev deployment
now uses the existing real-data APIs. Verification returned 20 rows from 142
run groups and followed one 17-test run to an individual test and back to
Dashboard. See [deployment and rollback details](rhai-10567-dev-deployment.md).
