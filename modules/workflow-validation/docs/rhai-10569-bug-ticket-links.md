# Per-run Jira issue links

Story: [RHAI-10569](https://redhat.atlassian.net/browse/RHAI-10569).
Parent branch: [RHAI-20044 / PR #1866](https://github.com/red-hat-data-services/rhai-org-pulse/pull/1866).

The Recent Runs table adds one Issues found column. It covers bugs and RFEs.
The Jira issues link opens the recorded
run's eligible Jira tickets in a new tab. It does not trigger run navigation.
An explanation below the Recent Runs heading and above the filters describes
the row contents, run navigation, and Jira issues link.
The existing sorting, filters, pagination, exact-run navigation, and test counts
keep their existing behavior. This change adds no ticket previews or ranking.

## Eligibility and association

Use the Jira label `rca-scope-internal` as the exclusion rule. RCA categories
can describe either Internal or external tickets and are not an eligibility
filter. Existing and newly created tickets follow the same rule. Tickets with
no Jira labels remain eligible. Jira permission restrictions are respected.

After selecting a page, read executions for its exact suite/invocation pairs.
Read recorded root causes for those invocations and join by the same
invocation and the execution's workflow or an impacted workflow. Do not join
by execution `run_id`, infer identity from paths, or limit the lookup to the
row's representative version. Deduplicate validated Jira keys per run.

Jira labels are retrieved through the shared Jira client using the platform
`jira` secret group. Secrets remain in the backend. The response exposes only
a link state and the eligible search URL, without Jira labels or credentials.
The query includes an explicit label exclusion when opened:

```jql
key IN (RHOAIENG-1, RHOAIENG-2)
AND (labels IS EMPTY OR labels NOT IN ("rca-scope-internal"))
```

## Row states

- **Jira issues**: at least one eligible ticket has been verified.
- **No issues recorded**: no recorded keys, or every recorded ticket has the
  Internal label. This wording follows the requested landing-page behavior.
- **Issues unavailable**: a credential, service, association, or Jira
  visibility problem prevents verification. Refresh retries the lookup.

The [API contract](DATA-FORMATS.md) documents batching, caching, and failure
behavior. Unit tests exercise real association and label decisions. Browser
tests verify new-tab navigation, keyboard behavior, empty and unavailable
states, and the existing Recent Runs interactions.

## Deployment review

Deploy to the existing GPUaaS preview for user review before creating a PR.
Keep rollback image references and verification evidence locally. Never save
Jira credentials, rendered Secrets, or kubeconfig data in project files.

The 2026-11-09 GPUaaS preview uses the standard backend and frontend Dockerfiles
with `CORE_TAG=v2.0.94`, matching the installed core dependency. Both images
completed and both deployments are ready. The existing platform Jira secret
group supplies credentials; the module uses the shared Jira client. Real Jira
and OpenSearch checks verified the recorded run's search link. An in-memory
Internal-only control used the real Jira label without changing stored data.
All 6,813 unit tests passed (11 skipped), and all 38 browser tests passed.
Lint, module/OpenAPI validation, and the production build passed.

[Deployment and test evidence](rhai-10569-validation.json).
The GPUaaS preview was reviewed before preparing the pull request. The source
branch builds on PR #1866 and must follow its merge order.

## Missing-bug dependency assessment

The read-only check on 2026-11-09 found zero `workflow-root-causes` documents
with `bug_key: RHOAIENG-100723` in the configured OpenSearch index. This is the
ticket named by [RHAI-9991](https://redhat.atlassian.net/browse/RHAI-9991), for
`release_gate` invocation `1791989157967`. The missing stored association also
affects this link retrieval path: a correct join cannot recover a ticket that
has no recorded root-cause document. The upstream investigation remains
necessary for that run. This change reads recorded associations and does not
repair or fabricate ingestion data. The empty label says **No issues
recorded** because it describes the recorded associations.
