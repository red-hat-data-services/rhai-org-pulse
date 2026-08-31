# Release Readiness JQL Reference

Temporary reference for `jira/release-readiness/fetch_release_metrics.py`.

## Shared release version clause

For `rhoai-3.5.EA2`, the validated Jira version clause is:

```jql
(fixVersion IN ('rhoai-3.5.EA2', '3.5 EA2 RHOAI RELEASE')
 OR affectedVersion IN ('rhoai-3.5.EA2', '3.5 EA2 RHOAI RELEASE')
 OR 'Target Version' IN ('rhoai-3.5.EA2', '3.5 EA2 RHOAI RELEASE'))
```

The script uses values from `JIRA_VERSIONS` when configured; otherwise it derives and validates version variants against the `RHOAIENG` project.

## Release Cycle Metrics

| Value | Source |
| --- | --- |
| Code Freeze | Product Pages API, or local release-variable YAML fallback. No JQL. |
| RC1/RC2 Build Complete | Test-phase Epic query below; Python classifies RC/build summaries. |
| Test Started | Same Epic query; uses Epic `updated` as a proxy. |
| Test Finished | Same Epic query; uses Epic `resolutiondate`, falling back to `updated`. |
| TFAs Passed | TFA query below; latest `updated` when every task is In Progress or Done. |
| TFAs Triaged | TFA query below; latest `updated` when every task is Done. |
| Blockers Resolved | Resolved-blocker query below; latest `resolutiondate`, falling back to `updated`. |
| Working-day values | Calculated locally from the dates; no JQL. |

Test-phase Epics:

```jql
(parent = <INITIATIVE_KEY>
 OR "customfield_10014" = <INITIATIVE_KEY>)
AND issuetype = Epic
```

TFA milestones:

```jql
project = RHOAIENG
AND <VERSION_CLAUSE>
AND summary ~ "TFA Sign-Off"
AND issuetype NOT IN (Epic, Initiative)
```

Open blockers, used before calculating the resolved date:

```jql
project in (RHAIENG, RHOAIENG)
AND (labels not in (RHOAI-releases, RHOAI-internal, devtestops-service, test-failed, test-skipped)
     OR labels IS EMPTY)
AND (component not in (Documentation, PXE) OR component is EMPTY)
AND status not in (Closed, Resolved)
AND ('Release Blocker' != Rejected OR 'Release Blocker' is EMPTY)
AND <VERSION_CLAUSE>
AND priority in (Blocker)
AND priority in (Blocker)
```

Resolved blockers:

```jql
project in (RHAIENG, RHOAIENG)
AND (labels not in (RHOAI-releases, RHOAI-internal, devtestops-service, test-failed, test-skipped)
     OR labels IS EMPTY)
AND (component not in (Documentation, PXE) OR component is EMPTY)
AND <VERSION_CLAUSE>
AND priority in (Blocker)
AND statusCategory = Done
```

## Other dashboard data

Release-activities Initiatives:

```jql
issuetype = Initiative
AND <VERSION_CLAUSE>
AND summary ~ "release activities"
AND status NOT IN (Cancelled)
```

Initiative or Epic children:

```jql
parent = <PARENT_KEY>
OR "customfield_10014" = <PARENT_KEY>
```

Linked TFA or blocker issues:

```jql
key IN (<ISSUE_KEY_1>, <ISSUE_KEY_2>, ...)
```

Component TFA counts:

```jql
project = RHOAIENG
AND component = "<COMPONENT>"
AND <VERSION_CLAUSE>
AND summary ~ "TFA Sign-Off"
AND issuetype NOT IN (Epic, Initiative)
```

Failed tests:

```jql
project = RHOAIENG
AND <TEAM_OR_COMPONENT_CLAUSE>
AND <VERSION_CLAUSE>
AND labels = "test-failed"
```

Skipped tests:

```jql
project = RHOAIENG
AND <TEAM_OR_COMPONENT_CLAUSE>
AND <VERSION_CLAUSE>
AND labels = "test-skipped"
```

Open issues to validate:

```jql
project in (RHAIENG, RHOAIENG)
AND (labels not in (RHOAI-releases, RHOAI-internal, devtestops-service, test-failed, test-skipped)
     OR labels IS EMPTY)
AND (component not in (Documentation, PXE) OR component is EMPTY)
AND status not in (Closed, Resolved)
AND <VERSION_CLAUSE>
```

`customfield_10014` is the Epic Link field in the Red Hat Jira instance. Team IDs used by component queries are instance-specific.

---

Assisted-by: Codex
