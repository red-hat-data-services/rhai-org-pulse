# Release Cycle Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add release cycle timing metrics (working days between milestones) to the RHOAI Release Readiness dashboard.

**Architecture:** Two-repo change. The data pipeline (`rhods-qe-tools/jira/release-readiness/fetch_release_metrics.py`) fetches dates from Product Pages and Jira, computes working-day counts, and includes a `release_cycle_metrics` key in the JSON it pushes to org-pulse via `/upload`. The frontend (`rhai-org-pulse`) reads this key from the existing data store and renders a new "Release Cycle Metrics" section in `ReleaseReadinessDirector.vue`.

**Tech Stack:** Python 3.11+, `requests`, `python-dotenv`; Vue 3 (`<script setup>`), Tailwind CSS 3.

**Spec:** RHOAIENG-76482 — Collect release cycle metrics on the release readiness dashboard.

## Global Constraints

- Python: no new dependencies — use stdlib `datetime`, `timedelta` only
- JS: no TypeScript, plain JS throughout (AGENTS.md rule 6)
- Backend routes need `@openapi` JSDoc annotations (AGENTS.md rule 7)
- Demo fixture at `fixtures/releases/release-readiness/rhoai-3.5.EA2.json` must match production shape (AGENTS.md rule 8)
- DATA-FORMATS.md must be updated in same PR as code (AGENTS.md rule 8)
- No direct cross-module imports; no `process.env` in module code (AGENTS.md rules 1, 9)

---

## File Map

| File | Change | Repo |
|------|--------|------|
| `jira/release-readiness/fetch_release_metrics.py` | Add `timedelta` import, `working_days()`, extend PP RC1/RC2 matching, add `fetch_test_phase_epic_dates()`, `fetch_tfa_milestone_dates()`, `fetch_blocker_resolved_date()`, `compute_release_cycle_metrics()`, wire into `main()` | rhods-qe-tools |
| `modules/releases/client/reports/ReleaseReadinessDirector.vue` | Add "Release Cycle Metrics" section (computed + template) | rhai-org-pulse |
| `fixtures/releases/release-readiness/rhoai-3.5.EA2.json` | Add `release_cycle_metrics` key with demo data | rhai-org-pulse |
| `docs/DATA-FORMATS.md` | Add Release Readiness section documenting `release_cycle_metrics` schema | rhai-org-pulse |

---

## Task 1: `working_days()` utility + PP RC1/RC2 build date matching

**Files:**
- Modify: `jira/release-readiness/fetch_release_metrics.py` (rhods-qe-tools repo)

**Interfaces:**
- Produces:
  - `working_days(start: str | None, end: str | None) -> int | None` — count Mon–Fri days in `(start, end]`, both ISO date strings; returns `None` if either is `None`; returns `0` if `start >= end`
  - `release_schedule` dict extended with keys: `rc1_build_date: str | None`, `rc2_build_date: str | None`

- [ ] **Step 1: Add `timedelta` to existing datetime import**

In `fetch_release_metrics.py`, line 8, the existing import is:
```python
from datetime import date, datetime, timezone
```
Change to:
```python
from datetime import date, datetime, timedelta, timezone
```

- [ ] **Step 2: Write a standalone test for `working_days()`**

Create `jira/release-readiness/test_working_days.py`:

```python
"""Standalone tests for working_days() — run with: python -m pytest test_working_days.py -v"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from fetch_release_metrics import working_days

def test_none_inputs_return_none():
    assert working_days(None, "2026-03-10") is None
    assert working_days("2026-03-01", None) is None
    assert working_days(None, None) is None

def test_same_date_returns_zero():
    assert working_days("2026-03-01", "2026-03-01") == 0

def test_start_after_end_returns_zero():
    assert working_days("2026-03-10", "2026-03-01") == 0

def test_consecutive_workdays():
    # Mon 2026-03-02 → Tue 2026-03-03: 1 working day
    assert working_days("2026-03-02", "2026-03-03") == 1

def test_skips_weekend():
    # Fri 2026-03-06 → Mon 2026-03-09: 1 working day (Sat/Sun skipped)
    assert working_days("2026-03-06", "2026-03-09") == 1

def test_full_week():
    # Mon 2026-03-02 → Fri 2026-03-06: 4 working days (Tue, Wed, Thu, Fri)
    assert working_days("2026-03-02", "2026-03-06") == 4

def test_two_weeks():
    # Mon 2026-03-02 → Mon 2026-03-16: 10 working days
    assert working_days("2026-03-02", "2026-03-16") == 10

def test_iso_datetime_strings_work():
    # Accepts ISO datetime strings, uses only the date part
    assert working_days("2026-03-02T00:00:00Z", "2026-03-03T23:59:59Z") == 1
```

- [ ] **Step 3: Run test to verify it fails (function not yet defined)**

```bash
cd jira/release-readiness
python -m pytest test_working_days.py -v
```
Expected: `ImportError` or `AttributeError` — `working_days` not found.

- [ ] **Step 4: Implement `working_days()` in `fetch_release_metrics.py`**

Add immediately after the `logging` setup block (after line ~63), before the `COMPONENT_TEAM_MAP`:

```python
def working_days(start: str | None, end: str | None) -> int | None:
    """Count working days (Mon–Fri) in the half-open interval (start, end].

    Returns None if either date is missing, 0 if start >= end.
    Accepts ISO date strings ('YYYY-MM-DD') or ISO datetime strings.
    """
    if not start or not end:
        return None
    d1 = date.fromisoformat(start[:10])
    d2 = date.fromisoformat(end[:10])
    if d1 >= d2:
        return 0
    count = 0
    current = d1 + timedelta(days=1)
    while current <= d2:
        if current.weekday() < 5:   # 0=Mon … 4=Fri
            count += 1
        current += timedelta(days=1)
    return count
```

- [ ] **Step 5: Run tests — all should pass**

```bash
python -m pytest test_working_days.py -v
```
Expected: 8 tests PASSED.

- [ ] **Step 6: Extend `fetch_release_schedule()` to capture RC1/RC2 build dates**

Inside `fetch_release_schedule()`, after the existing `code_freeze` matching block (around line 244), add:

```python
    # RC build milestone dates (matched from PP schedule tasks)
    rc1_build_date = _match_milestone(tasks, label, "RC1")
    rc2_build_date = _match_milestone(tasks, label, "RC2")
    log.info("  PP RC1 build date: %s, RC2 build date: %s", rc1_build_date, rc2_build_date)
```

In the `return` dict at the end of `fetch_release_schedule()` (around line 258), add:

```python
        "rc1_build_date": rc1_build_date,
        "rc2_build_date": rc2_build_date,
```

- [ ] **Step 7: Commit**

```bash
git add jira/release-readiness/fetch_release_metrics.py jira/release-readiness/test_working_days.py
git commit -m "feat(release-cycle): add working_days() + PP RC1/RC2 build date matching

RHOAIENG-76482"
```

---

## Task 2: Jira test phase epic date fetching

**Files:**
- Modify: `jira/release-readiness/fetch_release_metrics.py` (rhods-qe-tools repo)

**Interfaces:**
- Consumes: `JiraClient`, `classify_issue()`, `classify_phase()`, `categorize_epic()`, `get_status_category()`
- Produces: `fetch_test_phase_epic_dates(client: JiraClient, initiative_key: str) -> dict`
  - Returns `{phase_name: {build_complete_date: str|None, test_started_date: str|None, test_finished_date: str|None}}`
  - `phase_name` is one of `"Nightly"`, `"RC1"`, `"RC2"`, `"RC3"`
  - Dates are `"YYYY-MM-DD"` strings or `None`

- [ ] **Step 1: Add `fetch_test_phase_epic_dates()` to `fetch_release_metrics.py`**

Add immediately before `build_director_summary()` (around line 1158):

```python
def fetch_test_phase_epic_dates(client: JiraClient, initiative_key: str) -> dict:
    """
    Fetch start/end dates for each test execution phase by examining
    test execution epics under the initiative.

    Uses the epic's `resolutiondate` (for Done epics) and `updated`
    timestamp as proxies for build-complete and test-start/-finish events.

    Returns:
        {
          "RC1": {
            "build_complete_date": "YYYY-MM-DD" | None,  # when RC build epic was Done
            "test_started_date":   "YYYY-MM-DD" | None,  # when test phase went active
            "test_finished_date":  "YYYY-MM-DD" | None,  # when test phase completed
          },
          ...
        }
    """
    jql = (
        f'(parent = {initiative_key} OR "{CUSTOM_FIELD_EPIC_LINK}" = {initiative_key})'
        f' AND issuetype = Epic'
    )
    epics = client.search_jql(
        jql,
        fields=["summary", "status", "updated", "resolutiondate", "issuetype"],
    )

    phase_dates: dict[str, dict] = {}

    for epic in epics:
        summary = epic.get("fields", {}).get("summary", "")
        phase = classify_phase(summary)
        if not phase:
            continue
        category = categorize_epic(epic)
        if category != "test_execution":
            continue

        status_cat = get_status_category(epic)
        fields = epic.get("fields", {})

        # Prefer resolutiondate for completion; fall back to updated
        resolution = (fields.get("resolutiondate") or "")[:10] or None
        updated = (fields.get("updated") or "")[:10] or None
        done_date = resolution or (updated if status_cat == "Done" else None)
        active_date = updated if status_cat in ("In Progress", "Done") else None

        is_build_epic = any(kw in summary.lower() for kw in ["build", "nightly build"])

        entry = phase_dates.setdefault(phase, {
            "build_complete_date": None,
            "test_started_date": None,
            "test_finished_date": None,
        })

        if is_build_epic:
            # The build epic being Done means the RC build is ready
            if done_date and (entry["build_complete_date"] is None or done_date > entry["build_complete_date"]):
                entry["build_complete_date"] = done_date
        else:
            # Test execution epic — active_date = test started, done_date = test finished
            if active_date and (entry["test_started_date"] is None or active_date < entry["test_started_date"]):
                entry["test_started_date"] = active_date
            if done_date and (entry["test_finished_date"] is None or done_date > entry["test_finished_date"]):
                entry["test_finished_date"] = done_date

    return phase_dates
```

- [ ] **Step 2: Verify manually (no automated test — requires live Jira)**

Confirm the function exists and is importable:

```bash
cd jira/release-readiness
python -c "from fetch_release_metrics import fetch_test_phase_epic_dates; print('OK')"
```
Expected: `OK`

Also re-run existing tests to confirm no regression:

```bash
python -m pytest test_working_days.py -v
```
Expected: 8 tests PASSED.

- [ ] **Step 3: Commit**

```bash
git add jira/release-readiness/fetch_release_metrics.py
git commit -m "feat(release-cycle): add fetch_test_phase_epic_dates() for Jira-based phase dates

RHOAIENG-76482"
```

---

## Task 3: TFA/blocker milestone dates + `compute_release_cycle_metrics()` + wire into `main()`

**Files:**
- Modify: `jira/release-readiness/fetch_release_metrics.py` (rhods-qe-tools repo)

**Interfaces:**
- Consumes:
  - `working_days(start, end)` → `int | None`
  - `fetch_test_phase_epic_dates(client, initiative_key)` → `dict`
  - `release_schedule` dict (with `code_freeze_date`, `rc1_build_date`, `rc2_build_date`)
- Produces: `release_cycle_metrics` dict in the output JSON payload with shape:
  ```json
  {
    "code_freeze_date": "YYYY-MM-DD" | null,
    "build_milestones": [
      {"name": "RC1", "build_complete_date": "YYYY-MM-DD" | null, "days_since_code_freeze": int | null},
      {"name": "RC2", "build_complete_date": "YYYY-MM-DD" | null, "days_since_code_freeze": int | null}
    ],
    "test_execution_timelines": [
      {
        "phase": "RC1",
        "build_ready_date": "YYYY-MM-DD" | null,
        "test_started_date": "YYYY-MM-DD" | null,
        "days_to_test_started": int | null,
        "test_finished_date": "YYYY-MM-DD" | null,
        "days_to_test_finished": int | null,
        "tfas_passed_date": "YYYY-MM-DD" | null,
        "days_to_tfas_passed": int | null,
        "tfas_triaged_date": "YYYY-MM-DD" | null,
        "days_to_tfas_triaged": int | null,
        "blockers_resolved_date": "YYYY-MM-DD" | null,
        "days_to_blockers_resolved": int | null
      }
    ]
  }
  ```

- [ ] **Step 1: Add `fetch_tfa_milestone_dates()` to `fetch_release_metrics.py`**

Add immediately after `fetch_test_phase_epic_dates()`:

```python
def fetch_tfa_milestone_dates(client: JiraClient, version: str) -> dict:
    """
    Return the dates when ALL TFA sign-off tasks reached key states.

    - tfas_passed_date: date of the last TFA task to leave New state
      (i.e., when all TFAs were passed to component teams).
      Only set when EVERY TFA task is In Progress or Done.
    - tfas_triaged_date: date of the last TFA task to reach Done.
      Only set when EVERY TFA task is Done.

    Dates are the max `updated` timestamp across tasks in that state.
    These are proxies — Jira's `updated` field changes on any edit, not
    only status transitions.
    """
    version_clause = _build_version_jql_clause(version)
    jql = (
        f'project = RHOAIENG AND {version_clause} '
        f'AND summary ~ "TFA Sign-Off" AND issuetype NOT IN (Epic, Initiative)'
    )
    tasks = client.search_jql(jql, fields=["status", "updated"])

    if not tasks:
        return {"tfas_passed_date": None, "tfas_triaged_date": None}

    total = len(tasks)
    passed_dates = []   # updated dates of tasks in In Progress or Done
    triaged_dates = []  # updated dates of tasks in Done

    for task in tasks:
        cat = get_status_category(task)
        updated = (task.get("fields", {}).get("updated") or "")[:10] or None
        if cat in ("In Progress", "Done") and updated:
            passed_dates.append(updated)
        if cat == "Done" and updated:
            triaged_dates.append(updated)

    # Only report when ALL tasks have reached the threshold state
    tfas_passed_date = max(passed_dates) if len(passed_dates) == total and total > 0 else None
    tfas_triaged_date = max(triaged_dates) if len(triaged_dates) == total and total > 0 else None

    log.info(
        "  TFA milestone dates: passed=%s (%d/%d), triaged=%s (%d/%d)",
        tfas_passed_date, len(passed_dates), total,
        tfas_triaged_date, len(triaged_dates), total,
    )
    return {"tfas_passed_date": tfas_passed_date, "tfas_triaged_date": tfas_triaged_date}
```

- [ ] **Step 2: Add `fetch_blocker_resolved_date()` to `fetch_release_metrics.py`**

Add immediately after `fetch_tfa_milestone_dates()`:

```python
def fetch_blocker_resolved_date(client: JiraClient, version: str) -> str | None:
    """
    Return the date the last blocker was resolved, or None if any remain open.

    Only populated when zero blockers are currently open. Uses `resolutiondate`
    from Jira; falls back to `updated` if resolutiondate is absent.
    """
    open_jql = _build_blocker_base_jql(version)
    open_issues = client.search_jql(open_jql, fields=["status"])
    if open_issues:
        log.info("  %d open blocker(s) remain — skipping blocker resolved date", len(open_issues))
        return None

    version_clause = _build_version_jql_clause(version)
    resolved_jql = (
        f'project in (RHAIENG, RHOAIENG) '
        f'AND (labels not in (RHOAI-releases, RHOAI-internal, devtestops-service, test-failed, test-skipped) OR labels IS EMPTY) '
        f'AND (component not in (Documentation, PXE) OR component is EMPTY) '
        f'AND {version_clause} AND priority in (Blocker) '
        f'AND statusCategory = Done'
    )
    resolved = client.search_jql(resolved_jql, fields=["status", "resolutiondate", "updated"])

    dates = []
    for issue in resolved:
        fields = issue.get("fields", {})
        d = (fields.get("resolutiondate") or fields.get("updated") or "")[:10]
        if d:
            dates.append(d)

    result = max(dates) if dates else None
    log.info("  Blocker resolved date: %s", result)
    return result
```

- [ ] **Step 3: Add `compute_release_cycle_metrics()` to `fetch_release_metrics.py`**

Add immediately after `fetch_blocker_resolved_date()`:

```python
def compute_release_cycle_metrics(
    release_schedule: dict | None,
    phase_dates: dict,
    tfa_dates: dict,
    blocker_resolved_date: str | None,
) -> dict:
    """
    Assemble the release_cycle_metrics payload from pre-fetched date data.

    Args:
        release_schedule:     Output of fetch_release_schedule(); contains
                              code_freeze_date, rc1_build_date, rc2_build_date.
        phase_dates:          Output of fetch_test_phase_epic_dates(); contains
                              per-phase build_complete_date, test_started_date,
                              test_finished_date.
        tfa_dates:            Output of fetch_tfa_milestone_dates().
        blocker_resolved_date: Output of fetch_blocker_resolved_date().

    Returns a dict with keys: code_freeze_date, build_milestones,
    test_execution_timelines.
    """
    code_freeze = release_schedule.get("code_freeze_date") if release_schedule else None

    def _build_date(phase_name: str) -> str | None:
        """Priority: PP schedule > Jira phase epic."""
        pp_key = f"{phase_name.lower()}_build_date"  # e.g. "rc1_build_date"
        pp_date = release_schedule.get(pp_key) if release_schedule else None
        jira_date = phase_dates.get(phase_name, {}).get("build_complete_date")
        return pp_date or jira_date

    rc1_build = _build_date("rc1")
    rc2_build = _build_date("rc2")

    build_milestones = [
        {
            "name": "RC1",
            "build_complete_date": rc1_build,
            "days_since_code_freeze": working_days(code_freeze, rc1_build),
        },
        {
            "name": "RC2",
            "build_complete_date": rc2_build,
            "days_since_code_freeze": working_days(code_freeze, rc2_build),
        },
    ]

    timelines = []
    for phase_name, build_ready in [("RC1", rc1_build), ("RC2", rc2_build)]:
        p = phase_dates.get(phase_name, {})
        test_started = p.get("test_started_date")
        test_finished = p.get("test_finished_date")
        tfas_passed = tfa_dates.get("tfas_passed_date")
        tfas_triaged = tfa_dates.get("tfas_triaged_date")

        timelines.append({
            "phase": phase_name,
            "build_ready_date": build_ready,
            "test_started_date": test_started,
            "days_to_test_started": working_days(build_ready, test_started),
            "test_finished_date": test_finished,
            "days_to_test_finished": working_days(build_ready, test_finished),
            "tfas_passed_date": tfas_passed,
            "days_to_tfas_passed": working_days(build_ready, tfas_passed),
            "tfas_triaged_date": tfas_triaged,
            "days_to_tfas_triaged": working_days(build_ready, tfas_triaged),
            "blockers_resolved_date": blocker_resolved_date,
            "days_to_blockers_resolved": working_days(build_ready, blocker_resolved_date),
        })

    return {
        "code_freeze_date": code_freeze,
        "build_milestones": build_milestones,
        "test_execution_timelines": timelines,
    }
```

- [ ] **Step 4: Write unit tests for `compute_release_cycle_metrics()`**

Add to `test_working_days.py`:

```python
from fetch_release_metrics import compute_release_cycle_metrics

def test_compute_release_cycle_metrics_basic():
    schedule = {
        "code_freeze_date": "2026-03-01",
        "rc1_build_date": "2026-03-05",
        "rc2_build_date": "2026-03-20",
    }
    phase_dates = {
        "RC1": {"build_complete_date": None, "test_started_date": "2026-03-06", "test_finished_date": "2026-03-15"},
        "RC2": {"build_complete_date": None, "test_started_date": "2026-03-21", "test_finished_date": None},
    }
    tfa_dates = {"tfas_passed_date": "2026-03-07", "tfas_triaged_date": None}
    result = compute_release_cycle_metrics(schedule, phase_dates, tfa_dates, None)

    assert result["code_freeze_date"] == "2026-03-01"
    assert len(result["build_milestones"]) == 2

    rc1_milestone = result["build_milestones"][0]
    assert rc1_milestone["name"] == "RC1"
    assert rc1_milestone["build_complete_date"] == "2026-03-05"
    # 2026-03-01 (Mon) → 2026-03-05 (Fri): 4 working days (Tue, Wed, Thu, Fri)
    assert rc1_milestone["days_since_code_freeze"] == 4

    rc1_timeline = result["test_execution_timelines"][0]
    assert rc1_timeline["phase"] == "RC1"
    assert rc1_timeline["build_ready_date"] == "2026-03-05"
    # RC1 build (Thu Mar 5) → test started (Fri Mar 6): 1 working day
    assert rc1_timeline["days_to_test_started"] == 1
    # RC1 build (Thu Mar 5) → test finished (Sun Mar 15 → Mon Mar 16 boundary): ...
    # working_days("2026-03-05", "2026-03-15") = count Fri6, Mon9, Tue10, Wed11, Thu12, Fri13, Mon16 ... no
    # Actually: Mar5(Thu) → Mar15(Sun): Fri6, Mon9, Tue10, Wed11, Thu12, Fri13 = 6 days
    assert rc1_timeline["days_to_test_finished"] == 6

def test_compute_with_no_schedule():
    result = compute_release_cycle_metrics(None, {}, {"tfas_passed_date": None, "tfas_triaged_date": None}, None)
    assert result["code_freeze_date"] is None
    assert result["build_milestones"][0]["days_since_code_freeze"] is None
    assert result["test_execution_timelines"][0]["days_to_test_started"] is None

def test_jira_build_date_used_when_pp_missing():
    schedule = {"code_freeze_date": "2026-03-01"}  # no rc1_build_date key
    phase_dates = {"RC1": {"build_complete_date": "2026-03-04", "test_started_date": None, "test_finished_date": None}}
    tfa_dates = {"tfas_passed_date": None, "tfas_triaged_date": None}
    result = compute_release_cycle_metrics(schedule, phase_dates, tfa_dates, None)
    assert result["build_milestones"][0]["build_complete_date"] == "2026-03-04"
    # Mar1(Mon) → Mar4(Thu): 3 working days (Tue, Wed, Thu)
    assert result["build_milestones"][0]["days_since_code_freeze"] == 3
```

- [ ] **Step 5: Run tests**

```bash
cd jira/release-readiness
python -m pytest test_working_days.py -v
```
Expected: 11 tests PASSED.

- [ ] **Step 6: Wire into `main()`**

In `main()`, after the `release_schedule` fetch block (around line 1464), add:

```python
    # Release cycle metrics
    log.info("  Computing release cycle metrics ...")
    release_cycle_phase_dates = {}
    for init in initiatives:
        phase_d = fetch_test_phase_epic_dates(client, init["key"])
        for phase, dates in phase_d.items():
            release_cycle_phase_dates.setdefault(phase, {}).update(dates)

    tfa_milestone_dates = fetch_tfa_milestone_dates(client, RELEASE_VERSION)
    blocker_resolved = fetch_blocker_resolved_date(client, RELEASE_VERSION)
    release_cycle_metrics = compute_release_cycle_metrics(
        release_schedule,
        release_cycle_phase_dates,
        tfa_milestone_dates,
        blocker_resolved,
    )
    log.info("  Release cycle metrics: %s", release_cycle_metrics)
```

Then in the `payload` dict (around line 1492), add after `"release_schedule": release_schedule,`:

```python
        "release_cycle_metrics": release_cycle_metrics,
```

- [ ] **Step 7: Run all tests**

```bash
python -m pytest test_working_days.py -v
```
Expected: 11 tests PASSED.

- [ ] **Step 8: Commit**

```bash
git add jira/release-readiness/fetch_release_metrics.py jira/release-readiness/test_working_days.py
git commit -m "feat(release-cycle): add TFA/blocker date fetching and compute_release_cycle_metrics()

Wires release_cycle_metrics into the output payload.
RHOAIENG-76482"
```

---

## Task 4: Vue "Release Cycle Metrics" section

**Files:**
- Modify: `modules/releases/client/reports/ReleaseReadinessDirector.vue` (rhai-org-pulse repo)

**Interfaces:**
- Consumes: `data.value.release_cycle_metrics` with shape from Task 3
- Produces: rendered "Release Cycle Metrics" section between Test Execution Phases and end of director view

- [ ] **Step 1: Add `releaseCycleMetrics` computed and `formatMetricDate()` helper**

In the `<script setup>` section, after the `phasePct` function (around line 818), add:

```js
// --- Release Cycle Metrics ---

const releaseCycleMetrics = computed(() => data.value?.release_cycle_metrics || null)

function formatMetricDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysLabel(n) {
  if (n === null || n === undefined) return '—'
  if (n === 0) return '0 days'
  return `${n} day${n === 1 ? '' : 's'}`
}

function daysClass(n, warnAt, alertAt) {
  if (n === null || n === undefined) return 'text-gray-400 dark:text-gray-500'
  if (n >= alertAt) return 'text-red-600 dark:text-red-400 font-semibold'
  if (n >= warnAt) return 'text-amber-600 dark:text-amber-400 font-semibold'
  return 'text-green-600 dark:text-green-400 font-semibold'
}
```

- [ ] **Step 2: Add the "Release Cycle Metrics" section to the template**

In the template, after the closing `</div>` of "Section 4: Test Execution Phases" (after line 443, before the outer `</div>`), add:

```html
      <!-- Section 5: Release Cycle Metrics -->
      <div v-if="releaseCycleMetrics" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Release Cycle Metrics</h3>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Working days between key milestones (Mon–Fri, excluding weekends)</p>
        </div>

        <div class="p-4 space-y-6">
          <!-- Build Milestones -->
          <div v-if="releaseCycleMetrics.build_milestones?.length">
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Build Milestones — days since code freeze</p>
            <div class="overflow-x-auto">
              <table class="w-full text-xs border-collapse">
                <thead>
                  <tr class="bg-gray-50 dark:bg-gray-900">
                    <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Milestone</th>
                    <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Code Freeze</th>
                    <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Build Complete</th>
                    <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Working Days</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                  <tr v-for="m in releaseCycleMetrics.build_milestones" :key="m.name" class="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td class="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">{{ m.name }} Build</td>
                    <td class="px-3 py-2 text-gray-500 dark:text-gray-400">{{ formatMetricDate(releaseCycleMetrics.code_freeze_date) }}</td>
                    <td class="px-3 py-2 text-gray-700 dark:text-gray-300">{{ formatMetricDate(m.build_complete_date) }}</td>
                    <td class="px-3 py-2" :class="daysClass(m.days_since_code_freeze, 5, 10)">{{ daysLabel(m.days_since_code_freeze) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Test Execution Timelines -->
          <div v-if="releaseCycleMetrics.test_execution_timelines?.length">
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Test Execution Timelines — working days since build ready</p>
            <div class="space-y-4">
              <div v-for="timeline in releaseCycleMetrics.test_execution_timelines" :key="timeline.phase">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">{{ timeline.phase }}</span>
                  <span class="text-xs text-gray-400">build ready: {{ formatMetricDate(timeline.build_ready_date) }}</span>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full text-xs border-collapse">
                    <thead>
                      <tr class="bg-gray-50 dark:bg-gray-900">
                        <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Milestone</th>
                        <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
                        <th class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Working Days from Build Ready</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                      <tr class="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td class="px-3 py-2 text-gray-700 dark:text-gray-300">Test Run Started</td>
                        <td class="px-3 py-2 text-gray-500 dark:text-gray-400">{{ formatMetricDate(timeline.test_started_date) }}</td>
                        <td class="px-3 py-2" :class="daysClass(timeline.days_to_test_started, 3, 7)">{{ daysLabel(timeline.days_to_test_started) }}</td>
                      </tr>
                      <tr class="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td class="px-3 py-2 text-gray-700 dark:text-gray-300">Test Run Finished</td>
                        <td class="px-3 py-2 text-gray-500 dark:text-gray-400">{{ formatMetricDate(timeline.test_finished_date) }}</td>
                        <td class="px-3 py-2" :class="daysClass(timeline.days_to_test_finished, 8, 15)">{{ daysLabel(timeline.days_to_test_finished) }}</td>
                      </tr>
                      <tr class="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td class="px-3 py-2 text-gray-700 dark:text-gray-300">All TFAs Passed to Teams</td>
                        <td class="px-3 py-2 text-gray-500 dark:text-gray-400">{{ formatMetricDate(timeline.tfas_passed_date) }}</td>
                        <td class="px-3 py-2" :class="daysClass(timeline.days_to_tfas_passed, 3, 7)">{{ daysLabel(timeline.days_to_tfas_passed) }}</td>
                      </tr>
                      <tr class="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td class="px-3 py-2 text-gray-700 dark:text-gray-300">All TFAs Fully Triaged</td>
                        <td class="px-3 py-2 text-gray-500 dark:text-gray-400">{{ formatMetricDate(timeline.tfas_triaged_date) }}</td>
                        <td class="px-3 py-2" :class="daysClass(timeline.days_to_tfas_triaged, 5, 10)">{{ daysLabel(timeline.days_to_tfas_triaged) }}</td>
                      </tr>
                      <tr class="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td class="px-3 py-2 text-gray-700 dark:text-gray-300">All Blocker Bugs Resolved</td>
                        <td class="px-3 py-2 text-gray-500 dark:text-gray-400">{{ formatMetricDate(timeline.blockers_resolved_date) }}</td>
                        <td class="px-3 py-2" :class="daysClass(timeline.days_to_blockers_resolved, 5, 12)">{{ daysLabel(timeline.days_to_blockers_resolved) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
```

- [ ] **Step 3: Run existing unit tests**

```bash
cd /path/to/rhai-org-pulse
npm test
```
Expected: all existing tests PASS (no new tests needed — display-only addition with no logic branch not covered by the computed guard).

- [ ] **Step 4: Smoke-test visually in dev server**

```bash
npm run dev:full
```

Open `http://localhost:5173/#/releases/reports?report=release-readiness`.
Select a version. Scroll to "Release Cycle Metrics" section.
If running with fixture data (`DEMO_MODE=true`), fixture must have `release_cycle_metrics` (added in Task 5).

- [ ] **Step 5: Commit**

```bash
git add modules/releases/client/reports/ReleaseReadinessDirector.vue
git commit -m "feat(release-cycle): add Release Cycle Metrics section to dashboard

Displays build milestones and per-RC test execution timelines with
color-coded working-day counts. Data sourced from release_cycle_metrics
key in JSON payload.
RHOAIENG-76482"
```

---

## Task 5: Fixture update + DATA-FORMATS.md

**Files:**
- Modify: `fixtures/releases/release-readiness/rhoai-3.5.EA2.json` (rhai-org-pulse repo)
- Modify: `docs/DATA-FORMATS.md` (rhai-org-pulse repo)

**Interfaces:**
- Produces: demo data in fixture that the Vue section can render; documented schema in DATA-FORMATS.md

- [ ] **Step 1: Add `release_cycle_metrics` to the fixture**

In `fixtures/releases/release-readiness/rhoai-3.5.EA2.json`, add the following key at the top level (after the existing `"release_schedule": null` or wherever appropriate):

```json
"release_cycle_metrics": {
  "code_freeze_date": "2026-02-24",
  "build_milestones": [
    {
      "name": "RC1",
      "build_complete_date": "2026-03-03",
      "days_since_code_freeze": 5
    },
    {
      "name": "RC2",
      "build_complete_date": "2026-03-17",
      "days_since_code_freeze": 15
    }
  ],
  "test_execution_timelines": [
    {
      "phase": "RC1",
      "build_ready_date": "2026-03-03",
      "test_started_date": "2026-03-04",
      "days_to_test_started": 1,
      "test_finished_date": "2026-03-13",
      "days_to_test_finished": 8,
      "tfas_passed_date": "2026-03-05",
      "days_to_tfas_passed": 2,
      "tfas_triaged_date": "2026-03-11",
      "days_to_tfas_triaged": 6,
      "blockers_resolved_date": "2026-03-12",
      "days_to_blockers_resolved": 7
    },
    {
      "phase": "RC2",
      "build_ready_date": "2026-03-17",
      "test_started_date": "2026-03-18",
      "days_to_test_started": 1,
      "test_finished_date": null,
      "days_to_test_finished": null,
      "tfas_passed_date": "2026-03-19",
      "days_to_tfas_passed": 2,
      "tfas_triaged_date": null,
      "days_to_tfas_triaged": null,
      "blockers_resolved_date": null,
      "days_to_blockers_resolved": null
    }
  ]
}
```

- [ ] **Step 2: Verify fixture renders in demo mode**

```bash
DEMO_MODE=true npm run dev:full
```

Open `http://localhost:5173/#/releases/reports?report=release-readiness`.
Select "rhoai-3.5.EA2". Confirm "Release Cycle Metrics" section appears with both RC1 and RC2 timelines. Confirm RC2 shows "—" for null fields. Confirm day counts are color-coded.

- [ ] **Step 3: Add Release Readiness section to DATA-FORMATS.md**

At the end of DATA-FORMATS.md (before the Fixture Rules section), add:

````markdown
## Releases — Release Readiness (`data/releases/release-readiness/{version}.json`)

Produced by `fetch_release_metrics.py` in `rhods-qe-tools`. Pushed to the app
via `POST /api/modules/releases/release-readiness/upload`. Keyed by sanitized
version string (spaces and special chars replaced with `_`).

```json
{
  "version": "rhoai-3.5.EA2",
  "generated_at": "2026-07-01T10:00:00Z",
  "summary": { "total_work": 120, "work_done": 96, "work_in_progress": 15, "work_remaining": 9, "progress_pct": 80 },
  "director_summary": {
    "overall_pct": 75,
    "gate_statuses": [
      { "gate": "Product Sign Off", "done": 8, "total": 10, "pct": 80, "rag": "AMBER" }
    ],
    "test_timeline": [
      { "epic_key": "RHOAIENG-70001", "name": "Nightly", "done": 12, "total": 12, "pct": 100, "rag": "GREEN" }
    ]
  },
  "component_readiness": { "all_components": ["TestOps"], "phases": [] },
  "product_blockers": { "total_open": 2, "components": [], "jql_url": "..." },
  "open_issues_to_validate": { "total": 5, "jql_url": "..." },
  "tfa_signoff_done": 18,
  "tfa_signoff_total": 21,
  "tfa_signoff_jql_url": "...",
  "version_variants": ["rhoai-3.5.EA2", "3.5 EA2 RHOAI RELEASE"],
  "release_schedule": {
    "version": "rhoai-3.5.EA2",
    "ga_date": "2026-05-01",
    "code_freeze_date": "2026-02-24",
    "rc1_build_date": "2026-03-03",
    "rc2_build_date": "2026-03-17",
    "status": "Upcoming",
    "pp_url": "..."
  },
  "release_cycle_metrics": {
    "code_freeze_date": "2026-02-24",
    "build_milestones": [
      {
        "name": "RC1",
        "build_complete_date": "2026-03-03",
        "days_since_code_freeze": 5
      },
      {
        "name": "RC2",
        "build_complete_date": "2026-03-17",
        "days_since_code_freeze": 15
      }
    ],
    "test_execution_timelines": [
      {
        "phase": "RC1",
        "build_ready_date": "2026-03-03",
        "test_started_date": "2026-03-04",
        "days_to_test_started": 1,
        "test_finished_date": "2026-03-13",
        "days_to_test_finished": 8,
        "tfas_passed_date": "2026-03-05",
        "days_to_tfas_passed": 2,
        "tfas_triaged_date": "2026-03-11",
        "days_to_tfas_triaged": 6,
        "blockers_resolved_date": "2026-03-12",
        "days_to_blockers_resolved": 7
      },
      {
        "phase": "RC2",
        "build_ready_date": "2026-03-17",
        "test_started_date": "2026-03-18",
        "days_to_test_started": 1,
        "test_finished_date": null,
        "days_to_test_finished": null,
        "tfas_passed_date": null,
        "days_to_tfas_passed": null,
        "tfas_triaged_date": null,
        "days_to_tfas_triaged": null,
        "blockers_resolved_date": null,
        "days_to_blockers_resolved": null
      }
    ]
  },
  "breakdowns": {}
}
```

| Field | Type | Description |
|-------|------|-------------|
| `release_cycle_metrics.code_freeze_date` | `string \| null` | `YYYY-MM-DD` from Product Pages |
| `release_cycle_metrics.build_milestones[].name` | `string` | `"RC1"` or `"RC2"` |
| `release_cycle_metrics.build_milestones[].build_complete_date` | `string \| null` | `YYYY-MM-DD`; source: PP schedule task matching the RC label, or Jira epic Done date |
| `release_cycle_metrics.build_milestones[].days_since_code_freeze` | `number \| null` | Working days (Mon–Fri) between `code_freeze_date` and `build_complete_date`; `null` if either is unknown |
| `release_cycle_metrics.test_execution_timelines[].phase` | `string` | `"RC1"` or `"RC2"` |
| `release_cycle_metrics.test_execution_timelines[].build_ready_date` | `string \| null` | Same as `build_milestones` entry for this phase |
| `release_cycle_metrics.test_execution_timelines[].test_started_date` | `string \| null` | Jira test-phase epic first became active (proxy: `updated` timestamp) |
| `release_cycle_metrics.test_execution_timelines[].days_to_test_started` | `number \| null` | Working days from `build_ready_date` to `test_started_date` |
| `release_cycle_metrics.test_execution_timelines[].test_finished_date` | `string \| null` | Jira test-phase epic Done (`resolutiondate` or `updated`) |
| `release_cycle_metrics.test_execution_timelines[].days_to_test_finished` | `number \| null` | Working days from `build_ready_date` to `test_finished_date` |
| `release_cycle_metrics.test_execution_timelines[].tfas_passed_date` | `string \| null` | Max `updated` among TFA tasks when ALL reached In Progress or Done; `null` if any still New |
| `release_cycle_metrics.test_execution_timelines[].days_to_tfas_passed` | `number \| null` | Working days from `build_ready_date` to `tfas_passed_date` |
| `release_cycle_metrics.test_execution_timelines[].tfas_triaged_date` | `string \| null` | Max `updated` among TFA tasks when ALL reached Done; `null` if any not Done |
| `release_cycle_metrics.test_execution_timelines[].days_to_tfas_triaged` | `number \| null` | Working days from `build_ready_date` to `tfas_triaged_date` |
| `release_cycle_metrics.test_execution_timelines[].blockers_resolved_date` | `string \| null` | Max `resolutiondate` across all resolved blockers; `null` if any open blockers remain |
| `release_cycle_metrics.test_execution_timelines[].days_to_blockers_resolved` | `number \| null` | Working days from `build_ready_date` to `blockers_resolved_date` |
| `release_schedule.rc1_build_date` | `string \| null` | New field added to `release_schedule`; PP schedule task date for RC1 build milestone |
| `release_schedule.rc2_build_date` | `string \| null` | PP schedule task date for RC2 build milestone |

**Notes:**
- All day counts use Mon–Fri only (no public holidays excluded).
- Dates are proxies from Jira `updated` timestamps; they represent when Jira recorded the transition, not the exact moment it occurred.
- The TFA and blocker dates are release-level (not per-RC); the same date appears in both RC1 and RC2 timelines with different `days_to_*` values.
- `null` means the milestone has not occurred or data is unavailable; the dashboard renders `—` for null.
````

- [ ] **Step 4: Commit**

```bash
git add fixtures/releases/release-readiness/rhoai-3.5.EA2.json docs/DATA-FORMATS.md docs/superpowers/plans/2026-08-19-release-cycle-metrics.md
git commit -m "docs(release-cycle): update fixture and DATA-FORMATS.md for release_cycle_metrics

RHOAIENG-76482"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|-------------|------|
| Working days since code freeze → RC1 build complete | Task 1 (PP matching), Task 3 (compute) |
| Working days since code freeze → RC2 build complete | Task 1 (PP matching), Task 3 (compute) |
| Test run started (per RC1, RC2) | Task 2 (Jira fetch), Task 3 (compute) |
| Test run finished (per RC1, RC2) | Task 2 (Jira fetch), Task 3 (compute) |
| All TFAs passed to component teams | Task 3 (fetch + compute) |
| All TFAs fully triaged | Task 3 (fetch + compute) |
| All found blocker bugs resolved | Task 3 (fetch + compute) |
| Dashboard display | Task 4 (Vue component) |
| Fixture + docs | Task 5 |

**Placeholder scan:** No TBD, TODO, or "similar to" references. All code is explicit.

**Type consistency:** `working_days()` signature consistent throughout. `release_cycle_metrics` shape matches between Python output, fixture, DATA-FORMATS, and Vue consumer.
