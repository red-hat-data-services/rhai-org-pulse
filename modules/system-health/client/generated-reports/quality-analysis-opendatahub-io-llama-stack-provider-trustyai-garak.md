---
repository: "opendatahub-io/llama-stack-provider-trustyai-garak"
overall_score: 6.0
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Strong test suite with 322 test functions, 6 test files covering 6 source modules; excellent test-to-code ratio (1.14:1 by lines)"
  - dimension: "Integration/E2E"
    score: 2.0
    status: "No integration or E2E test directories; all tests are unit-level with mocked garak; no cluster or network tests"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time container build with import validation in validate-deps workflow; Tekton/Konflux pipeline for production; garak version drift detection"
  - dimension: "Image Testing"
    score: 6.0
    status: "UBI9 base image, multi-stage-like build pattern, import chain validation at build time; no health checks, no multi-arch, no runtime functional tests"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "pytest-cov in test deps and pyproject.toml coverage config with 60% fail_under threshold, but no CI integration — coverage not run or reported on PRs"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "7 workflows covering tests/lint/security/deps/build; all PR-triggered; but no concurrency controls, no caching, no timeouts, no matrix testing"
  - dimension: "Static Analysis"
    score: 8.0
    status: "Ruff linting + formatting, mypy type checking, pre-commit hooks with auto-fix, Dependabot for pip; no FIPS-incompatible crypto found"
  - dimension: "Agent Rules"
    score: 7.0
    status: "CLAUDE.md and AGENTS.md present with good repo context, code layout, conventions, and debugging info; no .claude/rules/ for test patterns"
critical_gaps:
  - title: "No integration or E2E tests"
    impact: "Garak adapter behavior in real K8s/KFP environments is untested; issues with S3, KFP submission, or eval-hub SDK integration only found in production"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "Coverage not enforced in CI"
    impact: "60% fail_under threshold in pyproject.toml is never checked in CI; coverage can silently drop below threshold"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No CI concurrency controls or timeouts"
    impact: "Duplicate workflow runs on rapid pushes waste resources; stuck jobs run indefinitely"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add coverage reporting to CI test workflow"
    effort: "1-2 hours"
    impact: "Enforce the existing 60% coverage threshold on every PR; add codecov integration for PR comments"
  - title: "Add concurrency controls and timeouts to workflows"
    effort: "1 hour"
    impact: "Prevent duplicate CI runs and stuck jobs; reduce resource waste"
  - title: "Add .claude/rules/ for test creation patterns"
    effort: "2-3 hours"
    impact: "Guide AI agents to generate consistent, high-quality tests matching existing pytest patterns"
  - title: "Add pip caching to CI workflows"
    effort: "30 minutes"
    impact: "Speed up CI runs by caching pip dependencies between runs"
recommendations:
  priority_0:
    - "Add pytest --cov to CI run-tests.yml and enforce 60% fail_under threshold already configured in pyproject.toml"
    - "Create integration tests that exercise the eval-hub adapter against a mocked K8s/KFP environment"
  priority_1:
    - "Add concurrency controls to all PR-triggered workflows to cancel superseded runs"
    - "Add timeout-minutes to all workflow jobs to prevent stuck builds"
    - "Add pip caching (actions/cache or setup-python cache) to CI workflows"
    - "Create .claude/rules/ test creation rules for unit and integration test patterns"
  priority_2:
    - "Add multi-arch container build support for ARM64"
    - "Add HEALTHCHECK instruction to Containerfile"
    - "Add matrix testing across Python versions (3.12, 3.13)"
    - "Add codecov.yml configuration for PR coverage comments and thresholds"
---

# Quality Analysis: llama-stack-provider-trustyai-garak

## Executive Summary

- **Overall Score: 6.0/10**
- **Repository Type**: Python library / eval-hub adapter
- **Primary Language**: Python 3.12
- **Framework**: eval-hub SDK, Kubeflow Pipelines, Garak
- **Jira Component**: RHOAIENG / AI Safety (midstream tier)

**Key Strengths:**
- Excellent unit test coverage with 322 test functions across 6 test files, achieving a 1.14:1 test-to-code ratio by lines
- Strong static analysis setup: Ruff linting + formatting, mypy type checking, pre-commit hooks
- PR-time container build with import chain validation and garak version drift detection
- Thoughtful agent rules in CLAUDE.md/AGENTS.md with architecture context and debugging guidance

**Critical Gaps:**
- No integration or E2E tests — all tests mock garak and external dependencies
- Coverage threshold (60%) configured but not enforced in CI
- CI workflows lack concurrency controls, caching, timeouts, and matrix testing

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 8.0/10 | Strong test suite with 322 tests, good patterns |
| Integration/E2E | 20% | 2.0/10 | No integration or E2E tests at all |
| Build Integration | 15% | 7.0/10 | PR container build + Tekton/Konflux pipeline |
| Image Testing | 10% | 6.0/10 | UBI9 base, import validation, no health checks |
| Coverage Tracking | 10% | 4.0/10 | Config exists but not enforced in CI |
| CI/CD Automation | 15% | 5.0/10 | Good workflow coverage, poor optimization |
| Static Analysis | 10% | 8.0/10 | Ruff + mypy + pre-commit + Dependabot |
| Agent Rules | 5% | 7.0/10 | CLAUDE.md + AGENTS.md present, no .claude/rules/ |

**Weighted Overall: 6.0/10**

## Critical Gaps

### 1. No Integration or E2E Tests
- **Severity**: HIGH
- **Impact**: The adapter's interaction with eval-hub SDK, Kubeflow Pipelines, S3, and garak subprocess execution is completely untested in realistic environments. Issues with K8s job submission, KFP pipeline orchestration, or S3 artifact flow would only be discovered in production.
- **Effort**: 16-24 hours
- **Current State**: All 322 tests are unit tests with mocked garak (`Tests are 100% unit tests. Garak is mocked` per CLAUDE.md). No `e2e/`, `integration/`, or similar directories exist.

### 2. Coverage Not Enforced in CI
- **Severity**: HIGH
- **Impact**: `pyproject.toml` configures `fail_under = 60` and `pytest-cov` is in test dependencies, but the CI `run-tests.yml` workflow runs `pytest tests -v` without `--cov` flags. The coverage threshold is never actually checked, allowing silent regression.
- **Effort**: 2-3 hours

### 3. No CI Concurrency Controls or Timeouts
- **Severity**: MEDIUM
- **Impact**: Multiple pushes to a PR trigger duplicate workflow runs that waste compute. No `timeout-minutes` means stuck jobs run indefinitely.
- **Effort**: 1-2 hours

## Quick Wins

### 1. Enforce Coverage in CI (1-2 hours)
Add `--cov` flags to the existing test workflow:
```yaml
# In .github/workflows/run-tests.yml
- name: Run tests with coverage
  run: |
    pytest tests -v --cov=llama_stack_provider_trustyai_garak \
      --cov-report=term-missing --cov-fail-under=60
```

### 2. Add Concurrency Controls (1 hour)
Add to each PR-triggered workflow:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```
And add timeouts to jobs:
```yaml
jobs:
  unit-tests:
    timeout-minutes: 15
```

### 3. Add pip Caching (30 minutes)
```yaml
- name: Set up Python
  uses: actions/setup-python@v5
  with:
    python-version: "3.12"
    cache: "pip"
```

### 4. Create Agent Test Rules (2-3 hours)
Create `.claude/rules/unit-tests.md` documenting pytest patterns, fixture usage, mock patterns, and the project convention of mocking garak subprocess calls.

## Detailed Findings

### Unit Tests (8.0/10)

**Strengths:**
- 322 test functions across 6 test files covering core functionality
- Well-organized test structure: `test_config.py` (14 tests), `test_evalhub_adapter.py` (157 tests), `test_intents.py` (36 tests), `test_pipeline_steps.py` (63 tests), `test_sdg_params.py` (17 tests), `test_utils.py` (35 tests)
- Excellent test-to-code ratio: 7,501 lines of tests vs 6,585 lines of source code (1.14:1)
- Good use of pytest features: `conftest.py` with shared fixtures, `@pytest.mark.parametrize`, `monkeypatch`, `unittest.mock.Mock`, `AsyncMock`
- Test fixtures in `tests/fixtures/` with sample data (`sample_report.jsonl`, `sample_garak_config.yaml`)
- Test resources in `tests/_resources/` for edge cases (`garak_earlystop_run.jsonl`)
- pytest configuration in `pyproject.toml` with `testpaths`, `pythonpath`, and `addopts`

**Gaps:**
- No coverage enforcement in CI (tests run without `--cov`)
- No pytest-asyncio markers visible for async tests despite `pytest-asyncio` in dependencies

**Files Analyzed:**
- `tests/conftest.py` — shared fixtures (`temp_dir`, `event_loop`)
- `tests/test_config.py` — scan configuration and profile tests
- `tests/test_evalhub_adapter.py` — eval-hub adapter (largest test file, 157 tests)
- `tests/test_intents.py` — policy taxonomy and intent loading
- `tests/test_pipeline_steps.py` — six-step pipeline logic
- `tests/test_sdg_params.py` — SDG parameter resolution
- `tests/test_utils.py` — utility functions (JSONL parsing, scoring, reports)

### Integration/E2E Tests (2.0/10)

**Findings:**
- No `e2e/`, `integration/`, `test/e2e/`, or `tests/integration/` directories
- No cluster setup utilities (Kind, Minikube, envtest)
- No multi-version testing
- No contract tests against eval-hub SDK API boundaries
- CLAUDE.md explicitly states: "Tests are 100% unit tests. Garak is mocked"
- Score of 2 (not 0) because the unit tests do exercise realistic scenarios with fixture data and cover the eval-hub adapter integration logic, just with mocks

**Missing Test Areas:**
- Eval-hub SDK adapter lifecycle (register → configure → run → callbacks)
- KFP pipeline submission and polling
- S3 artifact upload/download flow
- Garak subprocess execution with real binary
- Container startup and entrypoint validation beyond import checks

### Build Integration (7.0/10)

**Strengths:**
- PR-triggered container build in `validate-deps.yml` (`Container Build + Import Validation` job)
  - Builds container from `Containerfile`
  - Verifies full import chain: numpy, pandas, garak, sdg-hub, provider
  - Verifies garak version in container matches `pyproject.toml`
- Garak midstream version drift detection (`check-garak-drift` job)
  - Compares `pyproject.toml` pin against latest midstream tag
  - Fails CI if drift detected
- Auto-sync of `requirements.txt` from `pyproject.toml` on PR
- Tekton/Konflux pipeline (`.tekton/`) for production builds with:
  - buildah-oci-ta task for container builds
  - Image index creation
  - Source image building
- Makefile with `build`, `lock`, `install`, `install-dev` targets

**Gaps:**
- No dry-run deployment testing (K8s manifest validation)
- No Konflux build simulation in GitHub Actions (Tekton pipeline runs separately)

**Files Analyzed:**
- `.github/workflows/validate-deps.yml` — container build + import validation + version drift
- `.tekton/odh-trustyai-garak-lls-provider-dsp-release-push.yaml` — Konflux pipeline
- `Makefile` — build targets
- `Containerfile` — container image definition

### Image Testing (6.0/10)

**Strengths:**
- UBI9 base image (`registry.access.redhat.com/ubi9/python-312:latest`) — FIPS-capable, enterprise-grade
- Multi-stage-like build pattern: stub package for dependency caching, then real source
- Non-root runtime user (1001) for security
- Import chain validation in CI (numpy, pandas, garak, sdg-hub, provider)
- Version pinning validation (garak container version matches pyproject.toml)
- `.dockerignore` present for build optimization
- XDG environment variables configured for writable temp dirs

**Gaps:**
- No `HEALTHCHECK` instruction in Containerfile
- No multi-architecture support (no `--platform`, no `docker buildx`)
- No runtime functional testing (beyond import validation)
- No Testcontainers or equivalent for testing container behavior
- No readiness/liveness probe definitions (though this is a Job, not a long-running service)

**Files Analyzed:**
- `Containerfile` — UBI9-based, non-root, import-optimized
- `.dockerignore` — build context filtering

### Coverage Tracking (4.0/10)

**Strengths:**
- `pytest-cov` included in `[test]` optional dependencies
- Coverage configuration in `pyproject.toml`:
  - `[tool.coverage.run]` with `source = ["llama_stack_provider_trustyai_garak"]`
  - `[tool.coverage.report]` with `show_missing = true` and `fail_under = 60`
- Makefile `coverage` target: `pytest tests -v --cov=llama_stack_provider_trustyai_garak --cov-report=term-missing`

**Gaps:**
- CI workflow (`run-tests.yml`) runs `pytest tests -v` without `--cov` — coverage threshold is never enforced on PRs
- No `.codecov.yml` or codecov integration for PR coverage comments
- No coverage badge or trend tracking
- No coverage gate blocking merges

**Files Analyzed:**
- `pyproject.toml` — coverage.run and coverage.report sections
- `.github/workflows/run-tests.yml` — no coverage flags
- `Makefile` — coverage target exists but not used in CI

### CI/CD Automation (5.0/10)

**Workflow Inventory (7 workflows):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `run-tests.yml` | PR + push to main | Unit tests |
| `lint.yml` | PR + push to main | Ruff check/format + mypy |
| `validate-deps.yml` | PR + push to main | Requirements sync, garak drift, container build |
| `security.yml` | PR + push to main | Trivy security scan |
| `build-and-publish.yaml` | Release published | PyPI publication |
| `sync-branch-stable.yaml` | Push to main | Branch sync |
| `sync-branch-incubation.yaml` | Push to main | Branch sync |

**Strengths:**
- All quality workflows are PR-triggered (tests, lint, deps, security)
- Good separation of concerns (separate workflows for tests, lint, security, deps)
- PyPI publishing on release with OIDC trusted publishing
- Branch sync workflows for stable/incubation branches

**Gaps:**
- No `concurrency:` blocks on any workflow — duplicate runs on rapid pushes
- No `timeout-minutes:` on any job — stuck jobs run indefinitely
- No pip caching (`cache: "pip"` or `actions/cache`) — full install every run
- No Python version matrix testing — only 3.12
- No test parallelization
- No status checks / branch protection documentation

**Files Analyzed:**
- All 7 workflows in `.github/workflows/`

### Static Analysis (8.0/10)

#### Linting
- **Ruff** configured in `pyproject.toml`:
  - Target: Python 3.12
  - Line length: 120
  - Rules: E (errors), F (pyflakes), W (warnings) with sensible ignores
  - Per-file ignores for `__init__.py` and `tests/`
  - Both check and format modes in CI and pre-commit
- **mypy** configured in `pyproject.toml`:
  - Python 3.12 target
  - `warn_unused_configs = true`
  - `ignore_missing_imports = true` (reasonable for this ecosystem)
  - Several error codes disabled (broad but typical for a project with complex typing)
- CI workflow runs both `ruff check`, `ruff format --check`, and `mypy` on PRs

#### FIPS Compatibility
- No FIPS-incompatible crypto imports found in source code
- UBI9 base image is FIPS-capable
- No explicit FIPS build tags needed (Python project, not Go)

#### Dependency Alerts
- **Dependabot** configured (`.github/dependabot.yml`):
  - `pip` ecosystem coverage
  - Weekly update schedule
- Only covers `pip` — could also cover GitHub Actions (`github-actions` ecosystem)

#### Pre-commit Hooks
- `.pre-commit-config.yaml` with:
  - Local hook: `sync-requirements` (regenerate requirements.txt on pyproject.toml changes)
  - `ruff-pre-commit` (v0.11.4): `ruff` with auto-fix + `ruff-format`
  - Local hook: `mypy src/` type checking
- `make install-dev` installs pre-commit hooks

**Files Analyzed:**
- `pyproject.toml` — [tool.ruff] and [tool.mypy] sections
- `.pre-commit-config.yaml` — ruff + mypy + requirements sync
- `.github/dependabot.yml` — pip ecosystem
- `.github/workflows/lint.yml` — CI lint workflow

### Agent Rules (7.0/10)

**Strengths:**
- `CLAUDE.md` and `AGENTS.md` present at root (identical content — both paths covered)
- Comprehensive context provided:
  - What the repo does (Garak eval-hub adapter)
  - Two execution modes explained (Simple vs KFP) with architecture diagram
  - Full code layout with directory-by-directory descriptions
  - Key conventions (config merging, intents model overlay, benchmark profiles)
  - Build and install instructions
  - Test running commands (`make test`, `make coverage`, `make lint`)
  - Debugging tips (environment variables, log locations)
  - Clear note that "Tests are 100% unit tests. Garak is mocked"

**Gaps:**
- No `.claude/` directory or `.claude/rules/` for structured test creation rules
- No framework-specific test patterns documented (how to write new tests, fixture patterns)
- No quality gate checklists (what must pass before merging)
- CLAUDE.md and AGENTS.md are identical — AGENTS.md could contain agent-specific instructions

**Files Analyzed:**
- `CLAUDE.md` — 98 lines of repo context and conventions
- `AGENTS.md` — identical to CLAUDE.md
- `.claude/` directory — does not exist

## Recommendations

### Priority 0 (Critical)

1. **Enforce coverage in CI** — Add `--cov` and `--cov-fail-under=60` to the `run-tests.yml` workflow to activate the existing threshold in `pyproject.toml`. This is a 10-minute change that closes a real quality gap.

2. **Create integration tests for eval-hub adapter** — Add at minimum:
   - Adapter lifecycle test (register → configure → run with mocked eval-hub SDK client)
   - KFP pipeline submission test with mocked KFP client
   - S3 artifact flow test with mocked boto3
   - Container entrypoint test (can import and start the adapter process)

### Priority 1 (High Value)

3. **Add CI concurrency controls and timeouts** — Add `concurrency:` blocks and `timeout-minutes:` to all PR-triggered workflows. Prevents resource waste and stuck builds.

4. **Add pip caching to CI** — Use `setup-python` built-in caching or `actions/cache` to speed up CI runs.

5. **Create .claude/rules/ test creation rules** — Document:
   - How to write unit tests (pytest patterns, fixtures, mocking conventions)
   - When to use `monkeypatch` vs `unittest.mock`
   - How garak subprocess calls are mocked
   - Test file naming and organization conventions

6. **Add GitHub Actions to Dependabot** — Extend `.github/dependabot.yml` to cover `github-actions` ecosystem for keeping action versions current.

### Priority 2 (Nice-to-Have)

7. **Add Python version matrix testing** — Test against 3.12 and 3.13 to ensure forward compatibility.

8. **Add HEALTHCHECK to Containerfile** — While this runs as a K8s Job (not a long-running service), a HEALTHCHECK documents the health check contract.

9. **Add codecov integration** — Create `.codecov.yml` and add `codecov/codecov-action` to CI for PR coverage comments, trend tracking, and coverage badges.

10. **Differentiate AGENTS.md from CLAUDE.md** — AGENTS.md could include agent-specific instructions (tool preferences, code review guidelines) while CLAUDE.md stays as repo context.

## Comparison to Gold Standards

| Capability | This Repo | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|------------|-----------|---------------------|-------------------|---------------|
| Unit Tests | 322 tests, 1.14:1 ratio | Multi-layer tests | Image-focused tests | Comprehensive unit tests |
| Integration/E2E | None | Contract + E2E | Multi-version | envtest + Kind |
| Build Integration | PR container build + Tekton | Konflux + PR builds | 5-layer validation | Make + CI builds |
| Image Testing | UBI9, import validation | Multi-stage, tested | Multi-arch, FIPS | Multi-stage |
| Coverage | Config only, not in CI | Enforced with gates | Coverage tracked | Codecov integration |
| CI/CD | 7 workflows, no optimization | Concurrency, caching | Comprehensive | Matrix testing |
| Static Analysis | Ruff + mypy + Dependabot | ESLint + comprehensive | Language-specific | golangci-lint + strict |
| Agent Rules | CLAUDE.md + AGENTS.md | Comprehensive rules | Limited | Limited |

## File Paths Reference

### CI/CD
- `.github/workflows/run-tests.yml` — Unit test workflow
- `.github/workflows/lint.yml` — Ruff + mypy linting
- `.github/workflows/validate-deps.yml` — Requirements sync, garak drift, container build
- `.github/workflows/security.yml` — Trivy security scan
- `.github/workflows/build-and-publish.yaml` — PyPI publication
- `.github/workflows/sync-branch-stable.yaml` — Branch sync
- `.github/workflows/sync-branch-incubation.yaml` — Branch sync
- `.tekton/odh-trustyai-garak-lls-provider-dsp-release-push.yaml` — Konflux pipeline

### Testing
- `tests/conftest.py` — Shared fixtures
- `tests/test_config.py` — Configuration tests (14 tests)
- `tests/test_evalhub_adapter.py` — Eval-hub adapter tests (157 tests)
- `tests/test_intents.py` — Intent loading tests (36 tests)
- `tests/test_pipeline_steps.py` — Pipeline step tests (63 tests)
- `tests/test_sdg_params.py` — SDG parameter tests (17 tests)
- `tests/test_utils.py` — Utility function tests (35 tests)
- `tests/fixtures/` — Sample data for tests
- `tests/_resources/` — Edge case test resources

### Build
- `Containerfile` — UBI9-based container image
- `Makefile` — Build and dev targets
- `pyproject.toml` — Project configuration, dependencies, tool config
- `requirements.txt` — Locked dependencies with hashes

### Static Analysis
- `pyproject.toml` — Ruff and mypy configuration
- `.pre-commit-config.yaml` — Pre-commit hooks
- `.github/dependabot.yml` — Dependency alerts

### Agent Rules
- `CLAUDE.md` — AI agent context and repo guide
- `AGENTS.md` — AI agent context (identical to CLAUDE.md)
