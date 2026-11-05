# Workflow Validation recent runs — API example fixture

[`recent-runs.json`](../__tests__/fixtures/recent-runs.json) is synthetic test data
for `GET /api/modules/workflow-validation/test-suites?pageSize=20&includeBugs=false`.
It is not a stored production snapshot. Rows contain `suite`, `invocationId`,
`rhoaiVersion`, and `timestamp`. Suite and invocation identify one run.
Version and timestamp can be null.

`timestamp` is the latest recorded execution start in the run. It is not a
RHOAI build date. The API filters complete run groups and sorts all matching groups
before selecting a page. `sortField` selects `timestamp` (default), `version`,
or `suite`. `sortDir` selects `desc` (default) or `asc`. Missing metadata sorts
last in either direction. Suite and invocation break ties. `pageSize` accepts integers from 1 to 200.

`total` is the matching group count. `start` and `end` are one-based positions
(or zero for an empty page). `nextCursor` and `previousCursor` are opaque page
anchors with fixed-size identity hashes; null means unavailable. Long IDs
remain intact in rows, and legacy raw-ID cursors remain supported. If an anchor
was deleted, Previous resets to page one. An empty previous cursor resets to page one.
`options` lists versions and suites from all available groups. Versions use
descending numeric release order, with GA above EA for the same release.
Confirmed spelling aliases are normalized. Partial versions remain separate.
Repeated `versions` parameters select multiple versions with OR semantics.
The older single `version` parameter remains supported; do not combine them.
New v3 cursors bind the version set, sort column, direction, and page size.
Earlier v1/v2 timestamp-sort bookmarks remain supported.

The [contract](rhai-10567-recent-runs-contract.md) defines query parameters and
page states. Calls without `pageSize` keep the legacy response. This endpoint
reads existing execution records and does not change stored data formats.

Paged metadata is cached for up to 10 seconds per connection. Refresh and Retry
send `refresh=true` to bypass this cache. Failed and disconnected scans are not
cached. Unpaged calls keep their existing behavior.
