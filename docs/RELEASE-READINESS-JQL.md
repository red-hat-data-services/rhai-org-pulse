# Release Readiness JQL Reference

Temporary reference for `jira/release-readiness/fetch_release_metrics.py`.

## Shared release version clause

Example: the validated Jira version clause for `rhoai-3.5.EA2` is:

```jql
(fixVersion IN ('rhoai-3.5.EA2', '3.5 EA2 RHOAI RELEASE')
 OR affectedVersion IN ('rhoai-3.5.EA2', '3.5 EA2 RHOAI RELEASE')
 OR 'Target Version' IN ('rhoai-3.5.EA2', '3.5 EA2 RHOAI RELEASE'))
```

The script uses values from `JIRA_VERSIONS` when configured; otherwise it derives and validates version variants against the `RHOAIENG` project.

## Release Cycle Metrics

The Build Received source order applies to every release version processed by
the extractor, independently for each RC phase it finds. The 3.5 EA2 values in
the JQL examples are sample version values; they do not limit the rule to 3.5.

| Value | Source |
| --- | --- |
| Code Freeze | Product Pages API; the checked-in release-variable YAML fills the field when Product Pages has no value. No JQL. |
| Build Received for each RC found | Manual override → Stage Promoter → Product Pages/YAML → separate Jira build-helper query by release Fix Version (match the RC number in the phase to the Epic summary; try `Push to Stage`, then `Prepare`) → `null`; Jira reads each candidate Epic's `resolutiondate`. |
| Test Started | Same release-phase Epic query; first Jira changelog transition to `In Progress` on the test Epic. |
| Test Finished | Same query; test Epic `resolutiondate`, falling back to `updated` only when that test Epic is Done. |
| TFAs Passed | TFA query below; latest `updated` when every task is In Progress or Done. |
| TFAs Triaged | TFA query below; latest `updated` when every task is Done. |
| Blockers Resolved | Resolved-blocker query below; latest `resolutiondate`, falling back to `updated`. |
| Working-day values | Calculated locally from the dates; no JQL. |

When Code Freeze is known, a Build Received candidate before it is skipped and
the next candidate or source is tried. Test Started is not an upper bound for
Build Received: a Jira helper Epic's `resolutiondate` after Test Started can
still be reported. Stage Promoter dates have their own selection window,
described below.

`ACTUAL_BUILD_DATES` is an optional JSON environment variable keyed by release
and phase, for example `{"rhoai-3.5.EA2":{"RC1 Builds Testing":"2026-07-08"}}`.
If it is unset or empty, the manual-override source is skipped. When set, it
takes precedence over the other Build Received sources for that phase.

Stage Promoter dates come from successful matching RC runs of the
`stage-promoter.yaml` GitHub Actions workflow in
`red-hat-data-services/rhods-devops-infra`. The extractor reads the release and
build type from the successful `show-info` job log and uses the workflow
completion date. For each RC with a known Test Started date, it selects the
latest matching completion strictly after the known lower bound—Code Freeze
for RC1, or the latest earlier RC's Test Started date for later RCs—and on or
before that RC's Test Started date. If no lower bound is known, only the Test
Started upper bound applies. This source is
skipped if `GITHUB_TOKEN`/`GH_TOKEN` is unset or the API lookup fails.

The release-variable YAML is checked in under the extractor repository's
`jira/` directory; for example, release `rhoai-3.6.EA2` reads
`jira/jira-release-variables-3.6.0-ea2.yaml`. The extractor merges its RC
milestone fields into the schedule only when Product Pages has no value for
those fields. In that 3.6 EA2 file, `rc1_build_received_date: "2026-09-29"`
maps to `release_schedule.rc1_build_date`; the same `rcN` naming pattern
applies to other numbered RCs. Its adjacent comment cites
`#rhoai-build-notifications`. This is version-controlled input read by the CI
extractor, not a file generated on the dashboard host.

The release-initiative query supplies test-phase dates only:

```jql
(parent = <INITIATIVE_KEY>
 OR "customfield_10014" = <INITIATIVE_KEY>)
AND issuetype = Epic
```

The extractor uses the matching `Builds Testing` Epic's first transition to
`In Progress` for Test Started and its `resolutiondate` for Test Finished,
falling back to `updated` only when that Epic is Done and has no resolution
date. It does not use these test dates as the source of Build Received.

The Jira Build Received fallback uses a separate query for build-helper Epics:

```jql
fixVersion IN ('rhoai-3.6.EA2', '3.6 EA2 RHOAI RELEASE')
AND issuetype = Epic
AND (summary ~ "Prepare" OR summary ~ "Push to Stage")
```

The version values are the configured `JIRA_VERSIONS` or the release-version
variants derived and validated by the extractor. This query has no project or
initiative-parent restriction, so it can find build helpers in another Jira
project or initiative. For a dashboard phase with RC number `n`, the extractor
matches helper summaries containing `RCn`, then reads each candidate's
`resolutiondate`. It tries `Push to Stage` before `Prepare`; a missing date or
a date before Code Freeze causes it to try the next candidate. Jira does not
use a helper Epic's `updated` date, and Test Started is not an upper bound on
the Jira Build Received date.

The testing Epic supplies Test Started and Test Finished, never Build Received.

TFA milestones:

```jql
project = RHOAIENG
AND <VERSION_CLAUSE>
AND summary ~ "TFA Sign-Off"
AND issuetype NOT IN (Epic, Initiative)
```

Open blockers, used before calculating the resolved date:

```jql
project in (RHAI, RHAIENG, RHOAIENG)
AND (labels not in (RHOAI-releases, RHOAI-internal, devtestops-service, test-failed, test-skipped)
     OR labels IS EMPTY)
AND (component not in (Documentation, PXE) OR component is EMPTY)
AND status not in (Closed, Resolved)
AND ('Release Blocker' != Rejected OR 'Release Blocker' is EMPTY)
AND <BLOCKER_VERSION_CLAUSE>
AND priority in (Blocker)
AND (labels IS EMPTY OR labels not in (prerelease-cve-remediation))
```

Where `<BLOCKER_VERSION_CLAUSE>` is:

```jql
(fixVersion IN ('rhoai-3.5.EA2', '3.5 EA2 RHOAI RELEASE')
 OR 'Target Version' IN ('rhoai-3.5.EA2', '3.5 EA2 RHOAI RELEASE')
 OR (affectedVersion IN ('rhoai-3.5.EA2', '3.5 EA2 RHOAI RELEASE')
     AND fixVersion IS EMPTY AND 'Target Version' IS EMPTY))
```

Resolved blockers:

```jql
project in (RHAI, RHAIENG, RHOAIENG)
AND (labels not in (RHOAI-releases, RHOAI-internal, devtestops-service, test-failed, test-skipped)
     OR labels IS EMPTY)
AND (component not in (Documentation, PXE) OR component is EMPTY)
AND <BLOCKER_VERSION_CLAUSE>
AND priority in (Blocker)
AND (labels IS EMPTY OR labels not in (prerelease-cve-remediation))
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
project in (RHAI, RHOAIENG)
AND component = "<COMPONENT>"
AND <VERSION_CLAUSE>
AND labels = "test-failed"
```

Skipped tests:

```jql
project in (RHAI, RHOAIENG)
AND component = "<COMPONENT>"
AND <VERSION_CLAUSE>
AND labels = "test-skipped"
```

Open issues to validate:

```jql
project in (RHAI, RHAIENG, RHOAIENG)
AND (labels not in (RHOAI-releases, RHOAI-internal, devtestops-service, test-failed, test-skipped)
     OR labels IS EMPTY)
AND (component not in (Documentation, PXE) OR component is EMPTY)
AND status not in (Closed, Resolved)
AND ('Release Blocker' != Rejected OR 'Release Blocker' is EMPTY)
AND <OPEN_ISSUES_VERSION_CLAUSE>
```

Where `<OPEN_ISSUES_VERSION_CLAUSE>` is:

```jql
(fixVersion IN ('rhoai-3.5.EA2', '3.5 EA2 RHOAI RELEASE')
 OR 'Target Version' IN ('rhoai-3.5.EA2', '3.5 EA2 RHOAI RELEASE'))
AND ('Target Version' IS EMPTY
     OR 'Target Version' IN ('rhoai-3.5.EA2', '3.5 EA2 RHOAI RELEASE'))
```

## Generated Jira filter links

These JQLs are embedded in dashboard links. They are generated for navigation and are not all executed by the extractor.

Component TFA link:

```jql
project = RHOAIENG
AND component = "<COMPONENT>"
AND <VERSION_CLAUSE>
AND summary ~ "TFA Sign-Off"
```

Component failed/skipped links use the same failed/skipped queries above, scoped by component:

```jql
component = "<COMPONENT>"
```

Component execution link (aggregated across all test phases):

```jql
parent in (<TEST_EXECUTION_EPIC_KEY_1>, <TEST_EXECUTION_EPIC_KEY_2>, ...)
AND component = "<COMPONENT>"
```

Overall work filters:

```jql
(parent IN (<INITIATIVE_KEY_1>, <INITIATIVE_KEY_2>, ...)
 OR "Epic Link" IN (<INITIATIVE_KEY_1>, <INITIATIVE_KEY_2>, ...))
```

The work-in-progress and work-done links append, respectively:

```jql
AND statusCategory = "In Progress"
```

```jql
AND statusCategory = "Done"
```

Linked TFA-in-review and blocker links:

```jql
key IN (<TFA_KEY_1>, <TFA_KEY_2>, ...)
AND status = "In Review"
```

```jql
key IN (<BLOCKER_KEY_1>, <BLOCKER_KEY_2>, ...)
AND statusCategory != Done
```

Gate links for an individual Epic:

```jql
parent = <EPIC_KEY>
OR "Epic Link" = <EPIC_KEY>
```

The Test Execution gate instead uses:

```jql
parent in (<TEST_PHASE_EPIC_KEY_1>, <TEST_PHASE_EPIC_KEY_2>, ...)
AND issuetype NOT IN (Epic, Initiative)
```

`customfield_10014` is the Epic Link field in the Red Hat Jira instance. Team IDs used by component queries are instance-specific.

---

Assisted-by: Codex
