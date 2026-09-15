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
the module reveals them for the lifetime of the loaded SPA. This is a display
preference, not an authorization boundary: cost fields remain present in the
authenticated backend responses.

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
- `telemetry_origin` is the explicit test-suite identity. A suite execution is
  grouped by `telemetry_origin` and `invocation_id`; the UI presents only the
  familiar “Test Suite” terminology.
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
- Dashboard filters default to the highest numerically ordered version and the
  last 90 calendar days. Date presets can select 7, 30, or 90 days, all time,
  or custom inclusive start/end dates.
- Test Suites defaults to the most recent invocation for the selected suite and
  can instead show 7, 30, or 90 days, all time, or a custom date range.

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
