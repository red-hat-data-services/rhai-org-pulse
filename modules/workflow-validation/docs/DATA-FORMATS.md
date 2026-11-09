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
Confirmed spelling aliases are normalized. Recent Runs also groups `3.6` with
`3.6.0` for display, filtering, and sorting. EA versions and other partial
versions remain separate. Stored version strings are preserved.
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

## Per-run Jira search links

Paged callers can add `includeBugTickets=true`. This adds `bugTickets` to each
displayed row. The default is false, preserving metadata-only callers. The
flag requires `pageSize` and accepts only `true` or `false`. See the synthetic
[enriched fixture](../__tests__/fixtures/recent-run-bug-tickets.json).

- `status: "ready"` includes `url`, a complete HTTPS Jira search URL.
- `status: "empty"` means no ticket keys were recorded, or all associated
  tickets were verified to carry `rca-scope-internal`.
- `status: "unavailable"` means the service could not verify associations or
  Jira labels. It must not be displayed as an empty result.

Only the displayed rows are enriched, after global filtering, sorting, and
pagination. Executions are matched by suite and invocation across versions.
Root causes join `run_id` to execution `invocation_id`; `workflow` and
`impacted_workflows` constrain each suite's associations. Existing and newly
created ticket keys are included and deduplicated. RCA category does not
control eligibility. No indexed field, stored record, or test count changes.

The backend retrieves Jira labels in batches of at most 100 keys and follows
Jira pagination. Verified label decisions are cached for up to 60 seconds,
with at most 2,000 entries per module runtime. `refresh=true` bypasses this
cache as well as the metadata cache. Failed or missing label results remain
unknown. Jira lookup waits are limited to ten seconds per page. The shared
client may finish an already-running request afterward; it cannot change a
response that has already been returned. The Jira search URL also excludes
the Internal label when the user opens it, covering later label changes.
