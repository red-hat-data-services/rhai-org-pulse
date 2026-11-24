# Workflow Validation recent runs — API example fixture

[`recent-runs.json`](../__tests__/fixtures/recent-runs.json) is synthetic test data
for `GET /api/modules/workflow-validation/test-suites?pageSize=20&includeBugs=false`.
It is not a stored production snapshot. Rows contain `suite`, `invocationId`,
`rhoaiVersion`, `timestamp`, `buildDate`, and `buildDateStatus`. Suite and
invocation identify one run. Version, timestamp, and build date can be null.
`buildDate` is a verified operator image build timestamp, normalized to UTC.
`buildDateStatus` is `verified`, `unavailable`, or null when no image group exists.
Missing or invalid build dates render as lowercase `unavailable`.

`timestamp` is the latest recorded execution start in the run. It is not a
RHOAI build date. The API filters complete run groups and sorts all matching groups
before selecting a page. `sortField` selects `timestamp` (default), `version`,
`suite`, or `buildDate`. `sortDir` selects `desc` (default) or `asc`. Missing metadata sorts
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
Repeated `suites` parameters match any selected suite. Use either `suites` or
the legacy `suite` parameter. A fresh Recent Runs page defaults to Aramco and
Release Gate. Saved filters keep their suite scope. Clear filters selects all suites.
New v3 cursors bind the filters, sort column, direction, and page size.
Earlier v1/v2 timestamp-sort bookmarks remain supported.

The [contract](rhai-10567-recent-runs-contract.md) defines query parameters and
page states. Calls without `pageSize` keep the legacy response. This endpoint
reads existing execution records and does not change stored data formats.

Build metadata joins `workflow-execution-images` by `invocation_id` before
sorting and paging. Queries contain at most 500 IDs and aggregate one newest
verified build per invocation, so duplicates cannot hide another invocation.
Only valid ISO timestamps with an explicit timezone are accepted.
Paged run and build metadata is cached together for up to 10 seconds per connection. Refresh and Retry
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

Without summary or bug filtering, only the displayed rows are enriched after
filtering, sorting, and pagination. Executions match by suite and invocation.
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

## Version summary and per-run counts

Paged callers can add `includeSummary=true`. The response includes `summary`
with `suiteRuns`, `workflows`, `tasks`, `passed`, `failed`, `skipped`, and `bugs`.
It includes `bugUrl` when there are verified Jira issues and `bugsIncomplete`
when the service cannot verify all the associated issues.
If the Jira URL would exceed 8,000 characters, `bugUrl` links to Jira search and
`bugJql` provides the full query to paste into the advanced search field.
Each row also includes `workflows`, `tasks`, `passed`, `failed`, `skipped`, and
`bugs`, plus the nullable boolean `hasBugs`.
See the synthetic [summary fixture](../__tests__/fixtures/recent-run-summary.json).

One suite run is an exact `(telemetry_suite, invocation_id)` group. Workflows
count execution documents, including repeat executions of the same workflow.
Task counts sum `tasks_total`, `tasks_passed`, `tasks_failed`, and `tasks_skipped`.
A legacy execution without `tasks_skipped` uses task statuses from the execution
record or the task index. The task list must account for all tasks and every
status must be known. The skipped count is null if any execution lacks a
verifiable total. There are zero totals when no runs match.
Records without a suite or invocation ID do not belong to this view.

The summary applies the same version, suite, run ID, date, and bug filters as
the table. Versions still use the image version first, the execution version
if needed, and confirmed version aliases. Summary totals cover all pages.

Per-run `bugs` counts distinct eligible Jira keys associated with that exact
suite and invocation. Summary `bugs` counts the union of those keys, so it can
be lower than the sum of row counts. Eligibility matches the existing Jira
links, including the exclusion of `rca-scope-internal`. The summary displays
verified keys as a partial total if some labels or associations are unknown.
The count is null if verification is incomplete and there are no verified keys.
Internal key sets stay on the server.

`hasBugs` is true when at least one eligible issue is verified, false when a
complete lookup finds none, and null when the service cannot establish either.
`bugsOnly=true` includes runs with `hasBugs: true`, before pagination, even when
the exact `bugs` count is null because other keys remain unresolved. Its value
is part of the cursor scope. The response adds `bugFilterIncomplete` when that
filter is on. A true value means some exact bug counts are unavailable; runs
without a verified eligible issue are excluded. Both new flags require
`pageSize` and accept only `true` or `false`. Callers without either flag retain
the existing contract.

Bug counts resolve associations only for runs matching the non-Jira filters,
in batches of at most 200 suite runs.
Complete results share a 10-second cache tied to the metadata snapshot. Failed
or partial results are not cached. Refresh bypasses both caches and the existing
Jira label cache. `includeBugTickets` still controls whether links are returned.
Verified cache hits and completed Jira batches survive a later batch failure or
the 10-second Jira deadline. Runs with unresolved keys retain null exact counts;
a verified eligible key still makes `hasBugs` true. Late responses after the
deadline are ignored and do not start further Jira batches.
