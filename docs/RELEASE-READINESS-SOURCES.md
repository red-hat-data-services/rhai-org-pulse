# Release Readiness Dashboard: Sources and UI Coverage

## RC build-date source order

The diagram shows how `phases[].build_ready_date` is selected for each RC
number found by the extractor when its Jira test Epic is present.

The selection logic applies to every release version processed by the
extractor, independently for each RC phase it finds. The `rhoai-3.5.EA2`
references below are examples only.

![Build Received source order for every release and RC found: manual override, Stage Promoter, Product Pages with YAML filling missing fields, then Jira. Jira searches Epics by release Fix Version and build-helper summary, without restricting the project or initiative. For phase RC number n, use the matching Push to Stage resolutiondate, then try the matching Prepare resolutiondate if the first is missing or before Code Freeze. Test Started comes separately from the RCn Builds Testing Epic's first In Progress transition.](assets/rc-build-date-source.svg)

## Source conventions

- `RELEASE_VERSION` is the canonical release name, for example `rhoai-3.5.EA2`.
- `JIRA_VERSIONS` may provide exact Jira version names. Otherwise the extractor
  derives candidates and validates them against the `RHOAIENG` project.
- Example: the EA2 version clause for `rhoai-3.5.EA2` is:

  ```jql
  (fixVersion IN ('rhoai-3.5.EA2', '3.5 EA2 RHOAI RELEASE')
   OR affectedVersion IN ('rhoai-3.5.EA2', '3.5 EA2 RHOAI RELEASE')
   OR 'Target Version' IN ('rhoai-3.5.EA2', '3.5 EA2 RHOAI RELEASE'))
  ```

- `customfield_10001` is Jira's Team field; Team queries require a UUID.
- `customfield_10014` is Jira's legacy Epic Link field.
- Product Pages calls use OIDC client-credentials authentication; no secret
  values belong in this document.

## Product Pages REST queries

The examples use `rhoai-3.5.EA2`. For other releases, the extractor derives
the Product Pages label and, when the corresponding file exists, the checked-in
YAML fallback path from `RELEASE_VERSION`.

The Product Pages client performs these calls:

- Token request:

  ```http
  POST ${TOKEN_ENDPOINT}
  Content-Type: application/x-www-form-urlencoded

  grant_type=client_credentials
  client_id=${OIDC_CLIENT_ID}
  client_secret=${OIDC_CLIENT_SECRET}
  ```

- Release metadata:

  ```http
  GET ${PRODUCT_PAGES_BASE}/releases/${PP_RELEASE_SHORTNAME}/
  Authorization: Bearer <access token>
  ```

  Reads `product_name`, `name`, and `all_ga_tasks` metadata.

- Schedule tasks:

  ```http
  GET ${PRODUCT_PAGES_BASE}/releases/${PP_RELEASE_SHORTNAME}/schedule-tasks/
  Authorization: Bearer <access token>
  ```

  For this example, the extractor derives the label `3.5 EA2` from
  `rhoai-3.5.EA2`, then scans
  task `name`, `flags`, `date_start`, and `date_finish`:

  - GA: task name contains the derived release label, flag `ga`, and `RHOAI`;
    fallback name contains the label and `RHOAI RELEASE`.
  - Code freeze: name contains the derived release label and `RHOAI Code Freeze`;
    fallbacks are `RHOAI Feature Freeze`, then `AIPCC Code Freeze`.
  - RC build: the release-cycle matcher uses the RC number from each Jira phase
    to find the matching Product Pages build task for that release.

  The selected date is the later of `date_start` and `date_finish`; if only one
  exists, that one is used.

- If Product Pages is unavailable or has no code-freeze date, code freeze falls
  back to the YAML file derived from the release version. For this example it
  is `jira/jira-release-variables-3.5.0-ea2.yaml`, which provides
  `code_freeze_date`.

## Executed Jira JQL

### 1. Release Activities Initiatives

- Function: `fetch_initiatives()`
- JQL:

  ```jql
  issuetype = Initiative
  AND <VERSION_CLAUSE>
  AND summary ~ "release activities"
  AND status NOT IN (Cancelled)
  ```

- Gets release-activities Initiatives. Returned fields include summary, status,
  issue type, links, parent, labels, components, and Epic Link.
- Feeds: overall summary, gate status, component matrix, phase data, blockers,
  and linked TFA/blocker discovery.

### 2. Initiative/Epic children

- Function: `fetch_children(parent_key)`
- JQL:

  ```jql
  parent = <PARENT_KEY>
  OR "customfield_10014" = <PARENT_KEY>
  ```

- Gets direct children through either Jira's `parent` relationship or legacy
  Epic Link. Used for initiative children, sign-off tasks, and test-phase tasks.

### 3. Linked TFA or blocker issues

- Function: `fetch_issues_by_keys()`
- JQL:

  ```jql
  key IN (<ISSUE_KEY_1>, <ISSUE_KEY_2>, ...)
  ```

- Gets the full issue records for issues discovered through links or TFA labels.
- Python then keeps TFA issues with status `In Review` and blockers whose status
  category is not `Done`.

### 4. Component TFA counts

- Function: `fetch_component_readiness()`
- JQL:

  ```jql
  project = RHOAIENG
  AND component = "<COMPONENT>"
  AND <VERSION_CLAUSE>
  AND summary ~ "TFA Sign-Off"
  AND issuetype NOT IN (Epic, Initiative)
  ```

- Requests `status` and counts New, In Progress, and Done tasks.
- Feeds each matrix tile's TFA bar and open-TFA count.

### 5. Failed test counts by component/team

- Function: `fetch_component_readiness()` via `_build_failure_scope_clause()`
- Mapped component JQL (unions Team and component):

  ```jql
  project = RHOAIENG
  AND (Team = "<TEAM_UUID>" OR component = "<COMPONENT>")
  AND <VERSION_CLAUSE>
  AND labels = "test-failed"
  ```

- Unmapped component JQL:

  ```jql
  project = RHOAIENG
  AND component = "<COMPONENT>"
  AND <VERSION_CLAUSE>
  AND labels = "test-failed"
  ```

- Requests `status`; feeds each matrix tile's Failed bar and status breakdown.
- The tile's failed **count** and its failed **Jira link** are built from the
  exact same scope clause, so the displayed number always matches the linked
  query. The Team+component union avoids undercounting (previously to zero)
  when a test-failed issue carries a component but no Team field.

### 6. Skipped test counts by component/team

- Mapped component JQL:

  ```jql
  project = RHOAIENG
  AND Team = "<TEAM_UUID>"
  AND <VERSION_CLAUSE>
  AND labels = "test-skipped"
  ```

- Unmapped component JQL:

  ```jql
  project = RHOAIENG
  AND component = "<COMPONENT>"
  AND <VERSION_CLAUSE>
  AND labels = "test-skipped"
  ```

- Feeds each matrix tile's Skipped bar. The frontend intentionally displays
  `Available from 3.6 GA onwards` when `skipped_enabled` is false.

### 7. Open product blockers

- Function: `_build_blocker_base_jql()` / `fetch_product_blockers()`
- JQL:

  ```jql
  project in (RHAIENG, RHOAIENG)
  AND (labels not in (RHOAI-releases, RHOAI-internal, devtestops-service, test-failed, test-skipped)
       OR labels IS EMPTY)
  AND (component not in (Documentation, PXE) OR component is EMPTY)
  AND status not in (Closed, Resolved)
  AND ('Release Blocker' != Rejected OR 'Release Blocker' is EMPTY)
  AND <VERSION_CLAUSE>
  AND priority in (Blocker)
  ```

- Gets open blocker issues and returns key, summary, status, status category,
  and component grouping.
- Feeds the Product Release Blockers count and per-component cards.

### 8. Open issues to validate

- Function: `fetch_open_issues_to_validate()`
- JQL:

  ```jql
  project in (RHAIENG, RHOAIENG)
  AND (labels not in (RHOAI-releases, RHOAI-internal, devtestops-service, test-failed, test-skipped)
       OR labels IS EMPTY)
  AND (component not in (Documentation, PXE) OR component is EMPTY)
  AND status not in (Closed, Resolved)
  AND <VERSION_CLAUSE>
  ```

- Requests `status` and returns the count plus a Jira filter URL.
- Feeds the Open Issues to Validate banner.

### Release Cycle Metrics source table

| Displayed value | Source and fallback |
| --- | --- |
| Code Freeze | Product Pages schedule; the checked-in release-variable YAML fills the field when Product Pages has no value. |
| Build Received for each RC found (`phases[].build_ready_date`) | Manual override → Stage Promoter → Product Pages/YAML → separate Jira build-helper query by release Fix Version: match the RC number in the phase to the Epic summary; use the `Push to Stage` Epic `resolutiondate`, then the matching `Prepare` Epic `resolutiondate` → `null`. |
| Test Started | First Jira changelog transition to `In Progress` on the test-phase Epic. |
| Test Finished | Jira test-phase Epic `resolutiondate`; `updated` only if the Epic is Done and has no resolution date. |
| TFAs Passed | Latest TFA task `updated` date once every task is In Progress or Done. |
| TFAs Triaged | Latest TFA task `updated` date once every task is Done. |
| Blockers Resolved | `null` while any blocker is open; otherwise latest resolved blocker `resolutiondate`, falling back to `updated`. |
| Working-day counts | Calculated locally from the dates; Monday–Friday only, with no public holidays excluded. |

### 9. Jira test-phase Epics and Build Received helper query

Test-phase dates and Build Received use separate Jira queries. The first is
initiative-scoped; the build-helper lookup uses the release Fix Version.

#### Initiative query for test-phase Epics

- Function: `fetch_test_phase_epic_dates()`
- JQL:

  ```jql
  (parent = <INITIATIVE_KEY>
   OR "customfield_10014" = <INITIATIVE_KEY>)
  AND issuetype = Epic
  ```

- Requests `summary`, `status`, `updated`, `resolutiondate`, and `issuetype`,
  and expands each Epic's status-transition history.
- The query returns Epics under the release initiative. The extractor uses the
  matching `Builds Testing` Epic's first transition to `In Progress` for Test
  Started and its `resolutiondate` for Test Finished, falling back to `updated`
  only when that Epic is Done and has no resolution date. It does not source
  Build Received from this query.

#### Separate Fix Version query for Jira build-helper Epics

- Function: `fetch_build_helper_epic_dates()`
- JQL example for `rhoai-3.6.EA2`:

  ```jql
  fixVersion IN ('rhoai-3.6.EA2', '3.6 EA2 RHOAI RELEASE')
  AND issuetype = Epic
  AND (summary ~ "Prepare" OR summary ~ "Push to Stage")
  ```

- The version values are configured by `JIRA_VERSIONS` or derived from the
  release version and validated against Jira.
- This query has no project or initiative-parent restriction. It finds Epics
  with the matching Fix Version and build-helper summary, including helpers
  outside the release testing initiative.
- For a dashboard phase with RC number `n`, the extractor matches helper
  summaries containing `RCn`. It reads `resolutiondate`, tries `Push to Stage`
  before `Prepare`, and never uses a build Epic's `updated` date. A missing date
  or a date before Code Freeze causes it to try the next candidate. Test Started
  is not an upper bound, so a helper Epic's later `resolutiondate` can still be
  reported as Build Received.

#### Other Build Received sources

- Stage Promoter data comes from successful matching runs of
  `red-hat-data-services/rhods-devops-infra`'s `stage-promoter.yaml` GitHub
  Actions workflow. The extractor matches release/build type from the successful
  `show-info` job log and uses the run completion date. For each RC with a
  known Test Started date, it selects the latest matching date strictly after
  the known lower bound—Code Freeze for RC1, or the latest earlier RC's Test
  Started date for later RCs—and on or before that RC's Test Started date. If
  no lower bound is known, only the Test Started upper bound applies. It skips
  this source when `GITHUB_TOKEN`/`GH_TOKEN` is unset or the API lookup fails.
- The release-variable YAML is checked in under the extractor repository's
  `jira/` directory (for example, `jira/jira-release-variables-3.6.0-ea2.yaml`).
  The extractor merges those RC milestone values into the schedule only when
  Product Pages has no value for the corresponding fields; CI reads this
  version-controlled file.
- These sources feed Build Received in Release Cycle Metrics. Test Started and
  Test Finished remain sourced from the test-phase Epic query above.

### 10. TFA milestone dates

- Function: `fetch_tfa_milestone_dates()`
- JQL:

  ```jql
  project = RHOAIENG
  AND <VERSION_CLAUSE>
  AND summary ~ "TFA Sign-Off"
  AND issuetype NOT IN (Epic, Initiative)
  ```

- Requests `status` and `updated`.
- If every task is In Progress or Done, the latest `updated` becomes
  `tfas_passed_date`. If every task is Done, the latest `updated` becomes
  `tfas_triaged_date`.
- Feeds the returned RC cycle timelines with release-scoped dates.

### 11. Resolved blockers

- First, the extractor executes query 7. If any open blocker is returned,
  `blockers_resolved_date` is `null`.
- If none remain, it executes:

  ```jql
  project in (RHAIENG, RHOAIENG)
  AND (labels not in (RHOAI-releases, RHOAI-internal, devtestops-service, test-failed, test-skipped)
       OR labels IS EMPTY)
  AND (component not in (Documentation, PXE) OR component is EMPTY)
  AND <VERSION_CLAUSE>
  AND priority in (Blocker)
  AND statusCategory = Done
  ```

- Requests `status`, `resolutiondate`, and `updated`; selects the latest
  resolution date, falling back to updated.
- Feeds blocker resolution dates into every returned RC cycle timeline.

### 12. TFA totals

- The main flow executes the same TFA JQL as query 10 again, requesting only
  `status`.
- Feeds the Overall Summary `TFA Sign Offs` tile (`done/total`).

## Generated Jira filter links

These queries are embedded in Jira URLs for navigation. They are not all
executed during extraction.

- Overall work:

  ```jql
  (parent IN (<INITIATIVE_KEY_1>, <INITIATIVE_KEY_2>, ...)
   OR "Epic Link" IN (<INITIATIVE_KEY_1>, <INITIATIVE_KEY_2>, ...))
  ```

- Work in progress: overall work plus:

  ```jql
  AND statusCategory = "In Progress"
  ```

- Work done: overall work plus:

  ```jql
  AND statusCategory = "Done"
  ```

- Linked TFA in review:

  ```jql
  key IN (<TFA_KEY_1>, <TFA_KEY_2>, ...)
  AND status = "In Review"
  ```

- Linked blockers open:

  ```jql
  key IN (<BLOCKER_KEY_1>, <BLOCKER_KEY_2>, ...)
  AND statusCategory != Done
  ```

- Component TFA link:

  ```jql
  project = RHOAIENG
  AND component = "<COMPONENT>"
  AND <VERSION_CLAUSE>
  AND summary ~ "TFA Sign-Off"
  ```

- Component failed/skipped links use the corresponding Team/component query from
  queries 5 and 6.

- Per-phase component execution:

  ```jql
  parent = <PHASE_EPIC_KEY>
  AND component = "<COMPONENT>"
  ```

  With multiple phase Epics, `parent =` becomes
  `parent in (<PHASE_EPIC_KEY_1>, <PHASE_EPIC_KEY_2>, ...)`.

- Individual gate link:

  ```jql
  parent = <EPIC_KEY>
  OR "Epic Link" = <EPIC_KEY>
  ```

- Test Execution gate link:

  ```jql
  parent in (<TEST_PHASE_EPIC_KEY_1>, <TEST_PHASE_EPIC_KEY_2>, ...)
  AND issuetype NOT IN (Epic, Initiative)
  ```

- Product blocker per-component links append:

  ```jql
  AND component = "<COMPONENT>"
  ```

## UI coverage

- Release schedule bar:
  - Displays release version, `release_schedule.code_freeze_date`,
    `release_schedule.ga_date`, and `release_schedule.status`.
  - Source: Product Pages, with local YAML code-freeze fallback.
  - `status` is derived by `_derive_schedule_status()` from the GA and
    code-freeze dates plus the EA/GA nature of the version:
    `Released` (GA date passed), `Testing` (past code freeze, GA still ahead),
    `Early Access` (an `EAn` milestone with no resolved GA date), `Planning`
    (code freeze known and still ahead), else `Upcoming`. Early Access
    milestones rarely carry a Product Pages `ga` flag, so the value is never
    left as `Unknown`. The frontend additionally maps any legacy `Unknown`/empty
    value to the same derived phase.
- Product Release Blockers:
  - Displays `product_blockers.total_open` and open component counts.
  - Source: open blocker JQL, with Jira links from generated blocker queries.
- Open Issues to Validate:
  - Displays `open_issues_to_validate.total`.
  - Source: open-validation JQL.
- Overall Summary:
  - Displays TFA Sign Offs, Test Plan Sign Off, Test Execution, Product Sign
    Off, and Documentation Sign Off as `done/total`, percentage, and RAG.
  - Sources: TFA JQL plus initiative child/phase data.
  - The TFA Sign Offs tile is shown only for releases up to and including
    `rhoai-3.6.EA1`; it is hidden from `rhoai-3.6.EA2` onwards (see version gate
    below).
- Component Readiness Matrix:
  - Displays component tiles by Nightly/RC1/RC2/RC3.
  - Each tile displays TFA, Product Sign Off, Documentation Sign Off, TestOps
    execution, failed tests, skipped-test state, and Jira links.
  - The TFA row (Test Plan Sign Off key and TFA bar) is shown only for releases
    up to and including `rhoai-3.6.EA1` and hidden from `rhoai-3.6.EA2` onwards.
    The failed-tests bar is labelled `Failed` on legacy releases and
    `Failed Tests` from `rhoai-3.6.EA2` onwards.
  - Version gate: `useNewReadinessLayout` in `ReleaseReadinessDirector.vue`
    ranks the active version (`major.minor` plus EA/GA phase, GA ranking above
    any EA of the same minor) and applies the new layout at or above the
    `3.6.EA2` threshold. Unparseable versions fall back to the legacy layout.
  - Sources: initiative child JQL, component TFA JQL, Team/component failure
    and skipped JQLs, and phase-parent links.
- Test Execution Phases:
  - Displays phase name, done/total, percentage, RAG, and expandable tasks.
  - Source: initiative child JQL and task data returned through child queries.
- Release Cycle Metrics:
  - Displays code freeze and Build Received dates for every returned RC phase,
    working-day counts,
    test start/finish, TFA milestones, and blocker resolution.
  - Build-date source order: optional `ACTUAL_BUILD_DATES` override, Stage
    Promoter, Product Pages/YAML, then Jira as a last fallback. Jira searches
    by release Fix Version and build-helper summary without a project or
    initiative restriction, matches the RC number in the phase to the Epic
    summary, then tries `push to stage` before `prepare`. It reads the selected
    Epic's `resolutiondate`; only dates before Code Freeze are skipped. Test
    Started does not cap Build Received.
    Other dates come from the Product Pages code-freeze schedule or checked-in
    YAML fallback and Jira test-phase/TFA/blocker queries; working-day counts
    are calculated locally.

## Known data caveat

Jira test-start dates use the first changelog transition to `In Progress`.
Jira completion dates use `resolutiondate`, with `updated` only as a fallback
for Done Epics. These dates reflect Jira records and may not be the exact time
the build was physically received or testing began.
