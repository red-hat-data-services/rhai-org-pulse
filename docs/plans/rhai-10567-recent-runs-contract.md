# Recent Runs: landing page and data contract

Story: [RHAI-10567](https://redhat.atlassian.net/browse/RHAI-10567).
Scope updated on 2026-10-28: the landing page only. Build metadata is separate.

## Page and navigation

Dashboard opens Recent Runs inside the existing Workflow Validation module.
Show up to 20 runs across all suites and recorded versions. A run is one
`telemetry_suite` and `invocation_id` pair. Keep different invocations separate.

Show three columns: Test suite, Version, and View run. Keep the invocation ID
as secondary text. Format suite labels without changing stored identifiers.
Missing version shows “Version unavailable.” Build columns, build placeholders,
CI links, image metadata lookups, and database changes are outside this PR.

View run opens the existing Overview view as a hidden details route. Pass
`exactRun=1`, explicit version, suite, and invocation, and clear date bounds.
Verify the selected run before fetching its Overview and Charts data. Show an
error and a link to Recent Runs if that run is missing. Never fall back to a
different run. Ignore responses for earlier route selections.

Dashboard stays active for the selected run and individual test details.
Clicking Dashboard returns to Recent Runs. Do not add another sidebar item.
The existing Overview route remains available for bookmarked links.

## API

Reuse authenticated `GET /api/modules/workflow-validation/test-suites` with
`limit=20&includeBugs=false`. Do not inherit shared version, suite, invocation,
verdict, search, or date filters. Do not add another recent-runs endpoint.

The backend queries only existing workflow execution records. It reads every
composite aggregation page, groups by suite and invocation, and selects each
group's latest metadata. Sort by recorded execution timestamp descending before
applying the limit. Missing or invalid timestamps sort last; ties use suite and
invocation. The timestamp orders the list and is not shown as a build date.

The lightweight response contains only `suite`, `invocationId`, `rhoaiVersion`,
and `timestamp`. `limit` accepts integers from 1 to 200; invalid values return
HTTP 400 before querying OpenSearch. Omitting `includeBugs=false` keeps the
existing full response for other callers. No additional index is required.
The browser also caps rows at 20 for older backends that ignore the limit.

## Page states

Show Loading during the first request. Show “No runs are available” only after
a successful empty response. Show an error and Retry on failure. Keep existing
rows during refresh and after a refresh failure. Disable Refresh while its
request is pending. Ignore responses after the page unmounts.

## Verification

Client tests cover request isolation, three-column rendering, metadata gaps,
exact navigation, loading, empty/error/retry states, and refresh retention.
Server tests cover grouping, pagination before limiting, execution-time ordering,
timestamp ties, metadata gaps, invalid limits, and existing full responses.
Browser integration tests cover Dashboard to selected run to individual test,
return navigation, missing runs, retry, narrow screens, and ignored legacy
build fields. The fixture is synthetic; the product reads the existing API.

## GPUaaS dev verification — 2026-10-28

The dev preview runs application code from commit
`489642ac9c368a744c086ecd188d5aab28b8636d`. The deployed landing page shows
20 real runs through the existing OpenSearch connection. View run opened the
selected 17-test run, and its return link opened Recent Runs. Both deployments
are ready. Runtime settings and OAuth configuration are unchanged. No OpenSearch
data was updated.

[GPUaaS landing-page screenshot](images/rhai-10567-recent-runs-gpuaas.jpg).
