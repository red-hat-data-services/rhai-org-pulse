---
repository: "red-hat-data-services/llama-stack-provider-trustyai-garak"
overall_score: 5.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Excellent test-to-code ratio (1.13:1) with pytest, parametrize, and mocking patterns"
  - dimension: "Integration/E2E"
    score: 2.0
    status: "No integration or E2E tests; all tests are unit-only with mocked garak"
  - dimension: "Build Integration"
    score: 7.0
    status: "Strong PR container build with import-chain and version verification; Konflux pipeline present"
  - dimension: "Image Testing"
    score: 5.0
    status: "UBI9 base with import validation but no multi-arch, HEALTHCHECK, or Testcontainers"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "pytest-cov and fail_under=60 configured but coverage not enforced in CI"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "Good PR workflow coverage but missing caching, concurrency control, and timeouts"
  - dimension: "Static Analysis"
    score: 8.0
    status: "Ruff + mypy + pre-commit hooks + Dependabot configured"
  - dimension: "Agent Rules"
    score: 6.0
    status: "CLAUDE.md and AGENTS.md present with project context but no test automation rules"
critical_gaps:
  - title: "No integration or E2E tests"
    impact: "Cannot validate real garak execution, KFP pipeline flow, or S3 artifact handling before merge"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "Coverage not enforced in CI"
    impact: "fail_under=60 threshold exists in pyproject.toml but is never checked in CI — regressions go undetected"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No multi-architecture container support"
    impact: "Container images only built for amd64; arm64 or ppc64le deployments would fail"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add --cov to CI test workflow"
    effort: "1 hour"
    impact: "Enforce the existing fail_under=60 threshold on every PR — prevents silent coverage regression"
  - title: "Add Codecov integration"
    effort: "2 hours"
    impact: "PR-level coverage diffs, trend tracking, and visual reporting"
  - title: "Add concurrency and caching to CI workflows"
    effort: "1-2 hours"
    impact: "Prevent duplicate runs on rapid pushes and speed up pip installs with caching"
  - title: "Add timeout-minutes to all workflow jobs"
    effort: "30 minutes"
    impact: "Prevent runaway CI jobs from consuming resources indefinitely"
recommendations:
  priority_0:
    - "Enable coverage enforcement in CI by adding --cov and --cov-fail-under flags to the test workflow"
    - "Add Codecov integration for PR-level coverage reporting and trend analysis"
  priority_1:
    - "Create integration tests that exercise real garak CLI subprocess execution against a mock server"
    - "Add container smoke tests using Testcontainers or docker run with actual scan invocation"
    - "Generate test automation agent rules with /test-rules-generator for consistent AI-assisted test creation"
  priority_2:
    - "Add multi-architecture container builds (arm64 support)"
    - "Add HEALTHCHECK to Containerfile for container orchestration compatibility"
    - "Implement KFP pipeline integration tests with a local KFP deployment"
---

# Quality Analysis: llama-stack-provider-trustyai-garak

## Executive Summary

- **Overall Score: 5.6/10**
- **Repository Type**: Python library — Garak eval-hub adapter for RHOAI AI Safety evaluation platform
- **Primary Language**: Python 3.12+
- **Tier**: Downstream (red-hat-data-services) | Jira: RHOAIENG / AI Safety
- **Source**: 20 Python files, ~6,678 LOC
- **Tests**: 7 test files, ~7,525 LOC (test-to-code ratio 1.13:1)

### Key Strengths
- Excellent unit test coverage with more test code than production code
- Strong PR-time build validation with container build, import chain verification, and garak version drift detection
- Comprehensive static analysis with ruff, mypy, pre-commit hooks, and Dependabot
- Well-documented agent context (CLAUDE.md and AGENTS.md)
- UBI9 base image for FIPS-capable production containers

### Critical Gaps
- No integration or E2E tests — all tests mock garak; real execution paths are untested
- Coverage configured locally (`fail_under=60`) but never enforced in CI
- No Codecov or PR-level coverage reporting

### Agent Rules Status: Partial
- CLAUDE.md and AGENTS.md present with good project context
- No `.claude/rules/` directory with test-specific automation rules

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.0/10 | 15% | 1.20 | Excellent test-to-code ratio with pytest patterns |
| Integration/E2E | 2.0/10 | 20% | 0.40 | No integration or E2E tests |
| Build Integration | 7.0/10 | 15% | 1.05 | PR container build + import/version validation |
| Image Testing | 5.0/10 | 10% | 0.50 | UBI9 base, import validation, no multi-arch |
| Coverage Tracking | 4.0/10 | 10% | 0.40 | Configured but not enforced in CI |
| CI/CD Automation | 6.0/10 | 15% | 0.90 | Good PR coverage, missing caching/concurrency |
| Static Analysis | 8.0/10 | 10% | 0.80 | Ruff + mypy + pre-commit + Dependabot |
| Agent Rules | 6.0/10 | 5% | 0.30 | CLAUDE.md present, no test rules |
| **Overall** | **5.6/10** | **100%** | **5.55** | |

## Critical Gaps

### 1. No Integration or E2E Tests
- **Impact**: Cannot validate real garak subprocess execution, KFP pipeline flow, S3 artifact handling, or eval-hub adapter behavior before merge
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: CLAUDE.md explicitly states "Tests are 100% unit tests. Garak is mocked." While unit tests are thorough, they cannot catch integration failures like subprocess invocation issues, config file serialization bugs, or S3 connection problems.
- **Recommendation**: Add integration tests that exercise `garak_runner.py` against a mock HTTP endpoint, and container-level smoke tests that run a minimal scan inside the built image.

### 2. Coverage Not Enforced in CI
- **Impact**: The `fail_under=60` threshold in `pyproject.toml` is never executed during CI — coverage regressions go undetected until a developer runs `make coverage` locally
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: `run-tests.yml` runs `pytest tests -v` without `--cov` flags. The `pyproject.toml` has `[tool.coverage.report] fail_under = 60` but this is only effective when `pytest-cov` is invoked.
- **Recommendation**: Update `run-tests.yml` to add `--cov=llama_stack_provider_trustyai_garak --cov-report=term-missing --cov-fail-under=60`.

### 3. No Multi-Architecture Container Support
- **Impact**: Container images are only built for the runner's architecture (amd64) — arm64 or ppc64le deployments would require separate builds
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: Neither the Containerfile nor CI workflows use `--platform`, `docker buildx`, or manifest lists.

## Quick Wins

### 1. Add Coverage to CI Test Workflow (1 hour)
**Impact**: Enforce the existing `fail_under=60` threshold on every PR.

```yaml
# In .github/workflows/run-tests.yml, update the "Run tests" step:
- name: Run tests
  env:
    PYTHONPATH: src
  run: |
    pytest tests -v \
      --cov=llama_stack_provider_trustyai_garak \
      --cov-report=term-missing \
      --cov-fail-under=60
```

### 2. Add Codecov Integration (2 hours)
**Impact**: PR-level coverage diffs and trend tracking.

```yaml
# Add after the test step in run-tests.yml:
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: coverage.xml
    fail_ci_if_error: false
```

And add to the test step: `--cov-report=xml:coverage.xml`

### 3. Add Concurrency Control and Caching (1-2 hours)
**Impact**: Prevent duplicate CI runs and speed up pip installs.

```yaml
# Add to lint.yml and run-tests.yml:
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

# Add pip caching to jobs:
- name: Set up Python
  uses: actions/setup-python@v5
  with:
    python-version: "3.12"
    cache: 'pip'
```

### 4. Add Timeout to All Jobs (30 minutes)
**Impact**: Prevent runaway jobs.

```yaml
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 15
```

## Detailed Findings

### Unit Tests

**Score: 8.0/10**

| Metric | Value |
|--------|-------|
| Test files | 6 (+ conftest.py) |
| Test LOC | 7,525 |
| Source LOC | 6,678 |
| Test-to-code ratio | 1.13:1 |
| Framework | pytest + pytest-cov + pytest-asyncio |

**Strengths:**
- More test code than source code — unusual and positive
- `test_evalhub_adapter.py` alone is 4,745 lines, thoroughly testing the main adapter module
- Good use of `monkeypatch` for environment variable testing
- `@pytest.mark.parametrize` for data-driven tests
- `conftest.py` with shared fixtures (temp_dir, event_loop)
- Test resources in `tests/fixtures/` and `tests/_resources/` (sample reports, garak configs)

**Files analyzed:**
- `tests/test_config.py` (260 lines) — GarakScanConfig validation
- `tests/test_evalhub_adapter.py` (4,745 lines) — eval-hub adapter behavior
- `tests/test_intents.py` (436 lines) — taxonomy/intents loading
- `tests/test_pipeline_steps.py` (835 lines) — pipeline step logic
- `tests/test_sdg_params.py` (206 lines) — SDG parameter resolution
- `tests/test_utils.py` (1,019 lines) — utility functions, result parsing

**Gaps:**
- No test markers (e.g., `@pytest.mark.unit`) — all tests run together
- No parallel test execution (`pytest-xdist` not configured)
- Tests import production modules with stubs for `eval_hub` SDK — fragile if SDK API changes

### Integration/E2E Tests

**Score: 2.0/10**

**No integration or E2E test directories exist.** The repository relies entirely on unit tests with mocked dependencies:
- Garak CLI subprocess calls are mocked
- eval-hub SDK is stubbed at import time
- KFP pipeline components are not tested end-to-end
- S3 artifact flow is mocked

**Partial mitigation:**
- `validate-deps.yml` → `container-build` job builds the container and validates the full import chain (`numpy`, `pandas`, `garak`, `sdg-hub`, provider)
- Garak version in container is verified against `pyproject.toml`

**What's missing:**
- No tests that run actual garak subprocess (even against a mock LLM endpoint)
- No KFP pipeline integration tests
- No S3/MinIO integration tests
- No cluster-level testing

### Build Integration

**Score: 7.0/10**

**Strengths:**
- **Container Build on PR** (`validate-deps.yml` → `container-build`): Builds `Containerfile` and verifies full import chain on every PR
- **Garak Version Drift Detection** (`check-garak-drift`): Compares `pyproject.toml` garak pin against latest midstream tag — fails CI if drifted
- **Auto-sync requirements.txt** (`sync-requirements`): Regenerates lockfile when `pyproject.toml` changes and auto-commits
- **Tekton/Konflux Pipeline** (`.tekton/`): Production pipeline for `quay.io/opendatahub/odh-trustyai-garak-lls-provider-dsp` image
- **PyPI Publishing** (`build-and-publish.yaml`): Automated release publishing with OIDC token

**Gaps:**
- No PR-time Konflux simulation — production build issues discoverable only post-merge
- No dry-run deployment testing (not applicable — this is a library, not an operator)

### Image Testing

**Score: 5.0/10**

**Containerfile Analysis:**
- **Base image**: `registry.access.redhat.com/ubi9/python-312:latest` — FIPS-capable, Red Hat supported
- **Non-root runtime**: Drops to user 1001 after build — good security practice
- **Dependency caching**: Uses stub package + pip install pattern to cache dependencies
- **CPU PyTorch**: Installs CPU-only torch to reduce image size — pragmatic
- **XDG environment**: Sets writable XDG dirs to `/tmp` for containerized garak

**Gaps:**
- No `HEALTHCHECK` instruction (acceptable — this runs as K8s Job, not a service)
- No multi-architecture support (`--platform`, `buildx`)
- No multi-stage build (single `FROM` with cleanup)
- No Testcontainers or container runtime tests beyond import verification
- `.dockerignore` excludes tests — good practice but means no in-container test execution

### Coverage Tracking

**Score: 4.0/10**

**Configured but not enforced:**
- `pyproject.toml` has `[tool.coverage.run]` with `source = ["llama_stack_provider_trustyai_garak"]`
- `[tool.coverage.report]` with `show_missing = true` and `fail_under = 60`
- `pytest-cov` is a test dependency
- `Makefile` has `make coverage` target

**Not enforced in CI:**
- `run-tests.yml` runs `pytest tests -v` without `--cov` — coverage threshold is dead code in CI
- No Codecov/Coveralls integration
- No PR coverage comments or diff reporting
- No `.codecov.yml` configuration

### CI/CD Automation

**Score: 6.0/10**

**Workflow Inventory (7 workflows):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `lint.yml` | PR + push to main | Ruff lint/format + mypy type check |
| `run-tests.yml` | PR + push to main | Unit tests |
| `security.yml` | PR + push to main | Trivy scan (out of scope) |
| `validate-deps.yml` | PR + push to main | Auto-sync deps, garak drift check, container build |
| `build-and-publish.yaml` | Release published | PyPI package publishing |
| `sync-branch-incubation.yaml` | Push to main | Sync main → incubation branch |
| `sync-branch-stable.yaml` | Push to incubation | Sync incubation → stable branch |

**Strengths:**
- 4 workflows triggered on PR — good pre-merge gate coverage
- Automated branch syncing (main → incubation → stable) with labels
- Automated dependency management (requirements.txt auto-sync)
- Release automation with PyPI OIDC publishing

**Gaps:**
- No `concurrency:` control — rapid pushes create duplicate runs
- No pip caching — every run installs from scratch
- No `timeout-minutes:` — runaway jobs have no time limit
- No matrix testing (single Python version 3.12)
- No test parallelization

### Static Analysis

**Score: 8.0/10**

**Linting:**
- **Ruff**: Configured in `pyproject.toml` with `target-version = "py312"`, `line-length = 120`, select `["E", "F", "W"]`
- **Ruff format**: Format checking enforced in CI
- **mypy**: Type checking runs in CI lint workflow
- Both ruff and mypy run in CI on every PR

**Pre-commit Hooks:**
- `.pre-commit-config.yaml` with:
  - `ruff` (with `--fix --exit-non-zero-on-fix`)
  - `ruff-format`
  - `mypy src/`
  - Auto-sync `requirements.txt` from `pyproject.toml`
- `make install-dev` runs `pre-commit install`

**Dependency Alerts:**
- `.github/dependabot.yml` configured for pip ecosystem, weekly schedule
- No Renovate (Dependabot is sufficient)

**FIPS Compatibility:**
- No crypto usage in source code (clean — the provider delegates crypto to garak and LLM endpoints)
- UBI9 base image is FIPS-capable
- No FIPS build tags needed (Python project)

**Gaps:**
- Ruff only selects `E`, `F`, `W` rules — could enable additional rule sets (e.g., `I` for imports, `UP` for pyupgrade, `B` for bugbear)
- Dependabot only covers pip — could add `github-actions` ecosystem

### Agent Rules

**Score: 6.0/10**

**Present:**
- `CLAUDE.md` — Comprehensive project context with:
  - Repo purpose and execution modes
  - Code layout with directory tree
  - Key conventions (config merging, intents overlay, benchmark profiles)
  - Build & install instructions
  - Test commands
  - Debugging tips
- `AGENTS.md` — Mirrors CLAUDE.md content

**Missing:**
- No `.claude/rules/` directory with test-specific rules
- No unit test creation guidelines for agents
- No integration test patterns
- No code review rules
- No `.claude/skills/` custom skills

**Recommendation:** Run `/test-rules-generator` to create agent rules for unit test patterns matching the existing pytest conventions.

## Recommendations

### Priority 0 (Critical)

1. **Enable coverage enforcement in CI** (1 hour)
   - Add `--cov` and `--cov-fail-under=60` to `run-tests.yml`
   - The config already exists — it just needs to be wired into CI

2. **Add Codecov integration** (2 hours)
   - Add `.codecov.yml` with coverage targets
   - Add `codecov/codecov-action` step to test workflow
   - Enable PR coverage comments

### Priority 1 (High Value)

3. **Create integration tests for garak subprocess execution** (8-12 hours)
   - Test `garak_runner.py` with real subprocess against a mock HTTP endpoint
   - Verify config YAML serialization and command-line argument construction
   - Test scan artifact parsing with real garak output files

4. **Add container runtime tests** (4-6 hours)
   - Use `docker run` to execute a minimal scan inside the built image
   - Verify environment variables, XDG paths, and non-root execution
   - Test both simple and KFP execution modes

5. **Generate test automation agent rules** (2-3 hours)
   - Run `/test-rules-generator` to create `.claude/rules/` with test patterns
   - Document pytest conventions, fixture patterns, and mocking strategies

### Priority 2 (Nice-to-Have)

6. **Add CI optimizations** (1-2 hours)
   - Concurrency control to cancel duplicate runs
   - Pip caching for faster installs
   - Timeout limits on all jobs

7. **Expand Dependabot coverage** (30 minutes)
   - Add `github-actions` ecosystem to `.github/dependabot.yml`

8. **Add multi-architecture container builds** (4-6 hours)
   - Use `docker buildx` for arm64 support
   - Add platform matrix to container build job

9. **Expand ruff rule coverage** (1 hour)
   - Enable `I` (isort), `UP` (pyupgrade), `B` (bugbear) rules
   - Add `SIM` (simplify) and `RUF` (ruff-specific) rules

## Comparison to Gold Standards

| Feature | This Repo | odh-dashboard | notebooks | kserve |
|---------|-----------|---------------|-----------|--------|
| Unit test ratio | 1.13:1 | ~0.8:1 | N/A | ~0.5:1 |
| Integration/E2E | None | Cypress + contract | 5-layer validation | Multi-version E2E |
| Coverage in CI | Not enforced | Codecov enforced | N/A | Enforced |
| PR build validation | Container + import | Docker + webpack | Image build matrix | Operator deploy |
| Static analysis | Ruff + mypy | ESLint + TypeScript | Shellcheck | golangci-lint |
| Pre-commit hooks | Yes (ruff, mypy) | Yes | Limited | Yes |
| Dependabot | pip | npm + actions | pip | go + actions |
| Agent rules | CLAUDE.md only | Comprehensive | None | None |
| Multi-arch | No | No | Yes | Yes |
| Concurrency control | No | Yes | No | Yes |

## File Paths Reference

### CI/CD
- `.github/workflows/run-tests.yml` — Unit test workflow
- `.github/workflows/lint.yml` — Ruff + mypy lint workflow
- `.github/workflows/validate-deps.yml` — Dependency validation, garak drift, container build
- `.github/workflows/build-and-publish.yaml` — PyPI release publishing
- `.github/workflows/sync-branch-incubation.yaml` — Branch sync main → incubation
- `.github/workflows/sync-branch-stable.yaml` — Branch sync incubation → stable
- `.tekton/odh-trustyai-garak-lls-provider-dsp-release-push.yaml` — Konflux pipeline

### Testing
- `tests/test_config.py` — Configuration validation tests
- `tests/test_evalhub_adapter.py` — Eval-hub adapter behavior tests (4,745 LOC)
- `tests/test_intents.py` — Taxonomy/intents loading tests
- `tests/test_pipeline_steps.py` — Pipeline step logic tests
- `tests/test_sdg_params.py` — SDG parameter resolution tests
- `tests/test_utils.py` — Utility function tests
- `tests/conftest.py` — Shared fixtures

### Configuration
- `pyproject.toml` — Project config, dependencies, tool settings
- `Makefile` — Build, test, lint targets
- `Containerfile` — Container image definition (UBI9)
- `.pre-commit-config.yaml` — Pre-commit hook configuration
- `.github/dependabot.yml` — Dependency update configuration

### Agent Rules
- `CLAUDE.md` — AI agent context and project documentation
- `AGENTS.md` — AI agent context (mirrors CLAUDE.md)
