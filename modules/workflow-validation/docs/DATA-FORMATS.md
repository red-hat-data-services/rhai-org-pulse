# Workflow Validation recent runs — API example fixture

[`recent-runs.json`](../__tests__/fixtures/recent-runs.json)
is synthetic test data for `GET /api/modules/workflow-validation/test-suites?limit=20&includeBugs=false`.
It is not a stored production snapshot. The response contains `rows` with
`suite`, `invocationId`, `rhoaiVersion`, and `timestamp`. Suite and invocation
identify one run. Version and timestamp can be null.
The endpoint reads existing execution records and does not change stored data formats.

`timestamp` is the latest recorded execution start in the run. The API sorts by
this value, puts missing or invalid timestamps last, and breaks ties by suite
and invocation. It applies `limit` after reading all composite aggregation
pages. `limit` accepts integers from 1 to 200. The default response remains
unlimited and includes existing counts and product bugs. `includeBugs=false`
returns only these four metadata fields and skips product-bug retrieval.

The landing page shows the suite, recorded version, and a link to the existing
run dashboard. It does not request or display build metadata.
