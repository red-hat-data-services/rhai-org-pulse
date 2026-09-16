# Workflow Validation

Read-only dashboards for workflow executions, task outcomes, costs, and root
cause analysis stored in OpenSearch. The module follows the Org Pulse external
service pattern:

```text
Vue client -> authenticated Org Pulse module routes -> read-only OpenSearch API
```

The browser never receives OpenSearch credentials or calls OpenSearch directly.
An external Director/ETL pipeline owns computation and ingestion; Org Pulse
builds read-only searches and presents their results.

Cost tiles and table cells are hidden by default. Typing `iddqd` anywhere in
the module toggles their visibility for the lifetime of the loaded SPA. This is a display
preference, not an authorization boundary: cost fields remain present in the
authenticated backend responses.

Every user-selectable filter is mirrored in the current view's hash query
string using Org Pulse module navigation. Views hydrate their filters before
their first data request and replace the current history entry when filters
change, so copied URLs reproduce the same scope without making browser Back
step through each filter edit. Empty values are intentional: they preserve
explicit choices such as “All versions” and “All time” instead of allowing
future defaults to change a saved view.

## Runtime configuration

| Variable | Sensitive | Description |
|----------|-----------|-------------|
| `WORKFLOW_VALIDATION_OPENSEARCH_URL` | No | OpenSearch API URL. Defaults to `http://localhost:9200`. |
| `WORKFLOW_VALIDATION_OPENSEARCH_USERNAME` | Yes | HTTP Basic username for a read-only account. |
| `WORKFLOW_VALIDATION_OPENSEARCH_PASSWORD` | Yes | HTTP Basic password for the same account. |

The credentials are declared in `module.json` and read from `context.secrets`.
For OpenShift, the deployment maps them from `team-tracker-secrets`; production
values are supplied by the Vault Secrets Operator. `WORKFLOW_VALIDATION_OPENSEARCH_URL` is supplied
by the `team-tracker-config` ConfigMap.

Local authenticated development can load the variables into `.env`. To use an
unauthenticated local POC, set only:

```env
WORKFLOW_VALIDATION_OPENSEARCH_URL=http://localhost:9200
```

## Index contract

The module reads three strict-mapping indices:

| Index | Identity | Correlation |
|-------|----------|-------------|
| `workflow-executions` | `execution_id` | `run_id`, `invocation_id`, `workflow` |
| `workflow-task-executions` | `task_execution_id` | Join to an execution using `execution_id` |
| `workflow-root-causes` | `root_cause_id` | Correlate using `run_id` and `workflow`/`impacted_workflows` |

Important rules:

- IDs are opaque; never parse them for display or grouping metadata.
- Filesystem paths are not telemetry identity or query fields.
- The embedded execution `tasks` object is display-only and not indexed. Query
  task data through `workflow-task-executions`.
- `workflow` is the stable grouping/filter/correlation key. `workflow_label` is
  optional display text and must not be used as identity.
- `telemetry_origin` is the explicit test-run grouping identity. A test run is
  grouped by `telemetry_origin` and `invocation_id`; the UI presents only the
  familiar “Test Run” terminology.
- `rhods_operator_digest` is displayed as the RHODS Build ID. The UI abbreviates
  a known SHA digest to eight characters while preserving the complete value as
  hover text, and reports missing or `unknown` values honestly.
- Execution verdict filters are joined to tasks by `execution_id` and to root
  causes by `run_id` plus `workflow`; a run verdict is never treated as a task
  status.
- `cost_usd` is per execution and may be summed normally.
- `infra_cost_usd` can repeat across executions and must be deduplicated by
  `run_id` before summing.
- Root causes may not have a Jira key.
- Missing fields mean unknown unless their documented business meaning says
  otherwise.
- The dashboard always presents one bounded test run. It defaults to
  the highest numerically ordered RHOAI version, then the newest test-run
  execution recorded for that version. Release, suite, and execution controls
  can select another cohort; the dashboard never defaults to an aggregation
  of historical executions.
- Dashboard metrics and the complete test-results table are scoped to that one
  `rhoai_version`, `telemetry_origin`, and `invocation_id`. Product bugs from
  the same execution are separated into newly opened Jira issues and known
  bugs encountered without opening another issue.
- Stakeholder-facing test outcomes distinguish `PASS` from product failures
  (`FAIL`, when a product-bug finding is linked) and environmental failures
  (`ABORT`, when an unsuccessful test has no product-bug finding). Raw task
  verdicts remain unchanged.
- Test Trends defaults to the most recently active run group across all RHOAI
  versions. It charts pass rate, test volume, newly opened product bugs, and
  known product bugs per invocation, with version rollups and exact-run links
  back to the dashboard. Date and release filters remain shareable in the URL.
- Compare requires a test-run group and two dated invocations. Each side is one
  exact test run, and product-bug linkage remains constrained to its run IDs.

The source mappings maintained by the workflow-validation Director are the
authoritative schema. When mappings change, update backend queries, this
contract, representative tests, and affected Vue transformations together.

## Operability

- `/api/modules/workflow-validation/status` verifies read access by counting all
  three indices; the reader account does not require cluster-health privileges.
- The module registers a secret connectivity validator for the admin secrets
  API and redacted diagnostics for must-gather.
- Every public module route uses Org Pulse `requireAuth` middleware and carries
  an OpenAPI annotation.
- List endpoints return opaque `nextCursor` values backed by OpenSearch
  `search_after`; callers must not inspect or construct cursor contents.
- Searches are read-only and use bounded cursor pages, `search_after`, or
  composite aggregation pagination as appropriate.
