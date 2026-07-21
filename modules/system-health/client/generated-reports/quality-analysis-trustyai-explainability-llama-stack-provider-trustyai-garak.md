---
repository: "trustyai-explainability/llama-stack-provider-trustyai-garak"
overall_score: 5.8
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Comprehensive pytest suite with 6 test modules, parametrized tests, and strong isolation patterns"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "No integration or E2E test infrastructure; all tests are unit tests with mocked dependencies"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time container build + import chain validation + garak version drift detection"
  - dimension: "Image Testing"
    score: 6.0
    status: "UBI9 base image, non-root runtime, CI import validation, but no multi-arch or runtime testing"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "pytest-cov configured locally with 60% threshold, but not integrated into CI or PR reporting"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "7 workflows covering test/lint/build/security, but missing caching, concurrency, and timeouts"
  - dimension: "Static Analysis"
    score: 8.0
    status: "Ruff + mypy + pre-commit hooks + Dependabot for pip ecosystem"
  - dimension: "Agent Rules"
    score: 5.0
    status: "CLAUDE.md and AGENTS.md with good repo context, but no test creation rules or .claude/rules/"
critical_gaps:
  - title: "No integration or E2E test infrastructure"
    impact: "Adapter-to-Garak integration, KFP pipeline execution, and S3 artifact flow are only validated through unit test mocks — real integration failures won't be caught until deployment"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "Coverage not enforced in CI"
    impact: "Coverage threshold (fail_under=60) exists in pyproject.toml but CI never runs pytest with --cov — regressions in test coverage go undetected"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No CI caching, concurrency control, or timeouts"
    impact: "Redundant CI runs on rapid pushes waste resources; hanging jobs have no timeout guard"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Enable coverage reporting in CI"
    effort: "2-3 hours"
    impact: "Enforce the existing 60% threshold on every PR; catch coverage regressions automatically"
  - title: "Add concurrency control and caching to CI workflows"
    effort: "1-2 hours"
    impact: "Cancel redundant runs on rapid pushes, cache pip dependencies for faster CI"
  - title: "Create test creation rules in .claude/rules/"
    effort: "2-3 hours"
    impact: "Guide AI agents to write tests consistent with existing pytest patterns"
recommendations:
  priority_0:
    - "Enable --cov in the run-tests.yml workflow and add codecov or coverage PR comment reporting"
    - "Add integration tests for the eval-hub adapter using container-based testing (testcontainers or similar)"
  priority_1:
    - "Add concurrency groups and timeout-minutes to all CI workflows"
    - "Add pip caching to CI workflows to reduce build times"
    - "Create .claude/rules/ with test creation and code review guidelines"
  priority_2:
    - "Add multi-architecture container build support"
    - "Add contract tests for the eval-hub SDK adapter interface"
    - "Consider adding E2E tests with a real garak scan against a mock model endpoint"
---

# Quality Analysis: llama-stack-provider-trustyai-garak

## Executive Summary

- **Overall Score: 5.8/10**
- **Repository Type**: Python library (eval-hub adapter for Garak LLM red-teaming)
- **Primary Language**: Python 3.12
- **JIRA**: RHOAIENG / AI Safety (upstream tier)
- **Key Strengths**: Strong unit test suite with good isolation patterns, comprehensive static analysis pipeline (ruff + mypy + pre-commit), PR-time container build validation with import chain verification
- **Critical Gaps**: No integration/E2E tests, coverage not enforced in CI despite being configured locally, CI workflows lack caching and concurrency control
- **Agent Rules Status**: Present (CLAUDE.md + AGENTS.md) but incomplete — no test creation rules

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.0/10 | 15% | 1.20 | Comprehensive pytest suite with parametrized tests and strong isolation |
| Integration/E2E | 3.0/10 | 20% | 0.60 | No integration or E2E tests — all tests are unit tests |
| Build Integration | 7.0/10 | 15% | 1.05 | PR-time container build + import validation + version drift detection |
| Image Testing | 6.0/10 | 10% | 0.60 | UBI9 base, non-root runtime, CI import validation |
| Coverage Tracking | 4.0/10 | 10% | 0.40 | Local config with 60% threshold, not enforced in CI |
| CI/CD Automation | 6.0/10 | 15% | 0.90 | 7 workflows but missing caching/concurrency/timeouts |
| Static Analysis | 8.0/10 | 10% | 0.80 | Ruff + mypy + pre-commit + Dependabot |
| Agent Rules | 5.0/10 | 5% | 0.25 | CLAUDE.md present, no .claude/rules/ |
| **Overall** | **5.8/10** | **100%** | **5.80** | |

## Critical Gaps

### 1. No Integration or E2E Test Infrastructure
- **Impact**: The adapter integrates with eval-hub SDK, Garak CLI, KFP pipelines, and S3 storage. All of these boundaries are tested only through mocks. Real integration failures (e.g., config serialization mismatches, subprocess behavior changes, S3 credential resolution bugs) won't be caught until deployment.
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Evidence**: CLAUDE.md explicitly states "Tests are 100% unit tests. Garak is mocked — it does not need to be installed." No `e2e/`, `integration/`, or `docker-compose.test.yml` exist.

### 2. Coverage Not Enforced in CI
- **Impact**: `pyproject.toml` configures `fail_under = 60` and `pytest-cov` is a test dependency, but `run-tests.yml` runs `pytest tests -v` without `--cov`. Coverage regressions go undetected.
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Evidence**: `.github/workflows/run-tests.yml:38` — `pytest tests -v` (no `--cov` flag). No `.codecov.yml` or PR coverage reporting.

### 3. Missing CI Optimizations
- **Impact**: No `concurrency:` groups mean rapid pushes trigger redundant parallel runs. No `timeout-minutes:` means a hanging garak scan or container build could block CI indefinitely. No pip caching means every run reinstalls all dependencies from scratch.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours

## Quick Wins

### 1. Enable Coverage Reporting in CI (2-3 hours)
Add `--cov` and `--cov-fail-under` to the test workflow:

```yaml
# .github/workflows/run-tests.yml
- name: Run tests with coverage
  env:
    PYTHONPATH: src
  run: |
    pytest tests -v --cov=llama_stack_provider_trustyai_garak \
      --cov-report=term-missing --cov-fail-under=60
```

### 2. Add Concurrency Control and Caching (1-2 hours)
Add to each PR-triggered workflow:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  unit-tests:
    timeout-minutes: 15
    steps:
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: "pip"
```

### 3. Create Test Creation Rules (2-3 hours)
Generate `.claude/rules/` with test patterns using `/test-rules-generator` to guide AI-generated tests consistent with the existing pytest patterns.

## Detailed Findings

### Unit Tests

**Score: 8.0/10**

**Strengths:**
- 6 test modules covering config, utils, pipeline steps, intents, eval-hub adapter, and SDG params
- Well-organized class-based test suites with descriptive names
- Parametrized tests (`@pytest.mark.parametrize` for framework profiles)
- Excellent isolation: `monkeypatch`, `tmp_path`, `Mock`, `AsyncMock`
- Edge case testing: empty inputs, invalid formats, missing env vars, error paths
- Fixtures in `conftest.py` for temp directories and event loops
- Test data files in `tests/fixtures/` and `tests/_resources/`

**Weaknesses:**
- Test-to-code ratio is moderate (~35% by file count: 7 test files / 20 source files)
- `test_evalhub_adapter.py` is very large (4700+ lines) — could benefit from splitting
- No test for `s3_utils.py` or `kfp_pipeline.py` source modules directly

**Key Files:**
- `tests/test_config.py` — Config validation and deep merge
- `tests/test_utils.py` — XDG handling, TLS, result parsing
- `tests/test_pipeline_steps.py` — API key resolution, scan config validation, SDG generation
- `tests/test_intents.py` — Taxonomy loading, intent generation, dataset normalization
- `tests/test_evalhub_adapter.py` — Adapter lifecycle, KFP mode, S3 credentials, MLflow
- `tests/test_sdg_params.py` — SDG parameter resolution and flow block overrides

### Integration/E2E Tests

**Score: 3.0/10**

**Strengths:**
- The `validate-deps.yml` container-build job acts as a limited integration test by building the container and validating the full import chain inside it
- The garak version drift check validates consistency between pyproject.toml and midstream tags

**Weaknesses:**
- No dedicated integration or E2E test suite
- No cluster-based testing (Kind, Minikube, envtest)
- No testcontainers usage
- KFP pipeline execution path is only tested through mocks
- S3 artifact upload/download path is only tested through mocks
- No docker-compose test infrastructure

### Build Integration

**Score: 7.0/10**

**Strengths:**
- PR-time container build validation (`validate-deps.yml` → `container-build` job)
- Full import chain verification inside built container (numpy, pandas, garak, sdg-hub, provider)
- Garak version consistency check between pyproject.toml and container
- Garak midstream version drift detection
- Tekton pipeline configuration (`.tekton/odh-trustyai-garak-lls-provider-dsp-release-push.yaml`)
- Makefile with `build` target for local container builds
- PyPI publishing workflow on release

**Weaknesses:**
- No multi-stage build optimization (single stage with stub-then-real approach)
- No build caching in CI (no Docker layer caching)
- No Kustomize or manifest validation (not applicable for this repo type)

### Image Testing

**Score: 6.0/10**

**Strengths:**
- UBI9 base image (`registry.access.redhat.com/ubi9/python-312:latest`) — FIPS-compatible
- Non-root runtime user (USER 1001)
- XDG environment variables set for container context
- CI validates import chain inside built container
- `.dockerignore` present for build optimization

**Weaknesses:**
- No HEALTHCHECK directive in Containerfile
- No multi-architecture support (no `--platform`, no `docker buildx`)
- No testcontainers-based runtime validation
- No readiness/liveness probe definitions

### Coverage Tracking

**Score: 4.0/10**

**Strengths:**
- `pytest-cov` included in test dependencies
- `[tool.coverage.run]` configured with `source = ["llama_stack_provider_trustyai_garak"]`
- `[tool.coverage.report]` with `fail_under = 60` and `show_missing = true`
- `make coverage` Makefile target available for local use

**Weaknesses:**
- CI workflow runs `pytest tests -v` without `--cov` — threshold never enforced
- No `.codecov.yml` or codecov GitHub Action
- No PR coverage comments or reporting
- Coverage threshold (60%) is relatively low for a library with comprehensive unit tests

### CI/CD Automation

**Score: 6.0/10**

**Workflow Inventory:**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `run-tests.yml` | PR + push to main | Unit tests |
| `lint.yml` | PR + push to main | Ruff lint + format + mypy |
| `validate-deps.yml` | PR + push to main | Requirements sync, garak drift, container build |
| `security.yml` | PR + push to main | Trivy security scan |
| `build-and-publish.yaml` | Release published | PyPI publish |
| `sync-branch-incubation.yaml` | Push to main | Sync main → incubation |
| `sync-branch-stable.yaml` | Push to incubation | Sync incubation → stable |

**Strengths:**
- Good workflow variety: test, lint, build, security, publish, branch sync
- All quality workflows trigger on PRs
- Branch sync automation for midstream flow (main → incubation → stable)
- Trivy security scanning with SARIF upload

**Weaknesses:**
- No `concurrency:` groups on any workflow — redundant runs on rapid pushes
- No `timeout-minutes:` on any job — hanging jobs have no guard
- No pip/dependency caching — every run installs from scratch
- No matrix strategy for multi-Python-version testing
- No test parallelization
- No workflow status badges

### Static Analysis

**Score: 8.0/10**

**Linting:**
- Ruff configured in `pyproject.toml` with `target-version = "py312"`, `line-length = 120`
- Lint rules: E, F, W categories selected with targeted ignores
- Per-file ignores for `__init__.py` and `tests/`
- Ruff format check in CI and pre-commit

**Type Checking:**
- mypy configured in `pyproject.toml` with `python_version = "3.12"`
- `ignore_missing_imports = true` (expected for optional garak/evalhub dependencies)
- Several error codes disabled — mypy is in a transitional state
- Runs in CI (`lint.yml`) and pre-commit

**Pre-commit Hooks:**
- Requirements lock sync on `pyproject.toml` changes
- Ruff lint with auto-fix
- Ruff format
- mypy type check

**Dependency Alerts:**
- Dependabot configured for pip ecosystem with weekly schedule
- No Renovate configuration
- No auto-merge policies

**FIPS Compatibility:**
- No non-FIPS crypto imports found in source code
- UBI9 base image (FIPS-capable)
- No FIPS-specific build tags needed (Python library, not Go)

### Agent Rules

**Score: 5.0/10**

**Strengths:**
- `CLAUDE.md` present with comprehensive repo context:
  - Clear explanation of what the repo is and its two execution modes
  - Code layout diagram
  - Key conventions (config merging, intents model overlay, benchmark profiles)
  - Build & install instructions
  - Test running commands
  - Debugging guidance
- `AGENTS.md` present (mirrors CLAUDE.md content)

**Weaknesses:**
- No `.claude/` directory
- No `.claude/rules/` with test creation guidelines
- No framework-specific test patterns or examples
- No quality gate checklists
- CLAUDE.md and AGENTS.md are identical (redundant)
- No guidance on test data fixtures or mock patterns

## Recommendations

### Priority 0 (Critical)

1. **Enable coverage enforcement in CI** — Add `--cov` and `--cov-fail-under=60` to `run-tests.yml`. Consider adding codecov integration for PR reporting. (2-3 hours)

2. **Add integration tests for eval-hub adapter** — Create a `tests/integration/` directory with tests that exercise the adapter against a real (or containerized) garak subprocess. Test the full config resolution → garak run → result parsing pipeline without mocks. (16-24 hours)

### Priority 1 (High Value)

3. **Add CI optimizations** — Add `concurrency:` groups, `timeout-minutes:`, and pip caching to all workflows. (2-4 hours)

4. **Create .claude/rules/ directory** — Generate test creation rules using `/test-rules-generator` to encode the existing pytest patterns (class-based tests, monkeypatch isolation, parametrization). (2-3 hours)

5. **Split test_evalhub_adapter.py** — At 4700+ lines, this file covers too many concerns. Split into separate files: `test_evalhub_adapter_simple.py`, `test_evalhub_adapter_kfp.py`, `test_evalhub_adapter_s3.py`, `test_evalhub_adapter_intents.py`. (4-6 hours)

### Priority 2 (Nice-to-Have)

6. **Add multi-architecture container builds** — Add `docker buildx` and `--platform` to support arm64 in addition to amd64. (4-8 hours)

7. **Add contract tests for eval-hub SDK interface** — Ensure the FrameworkAdapter contract is maintained as the eval-hub SDK evolves. (8-12 hours)

8. **Raise coverage threshold** — Once integration tests are added, increase `fail_under` from 60% to 75%+. (1 hour)

## Comparison to Gold Standards

| Dimension | This Repo | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | 8/10 | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 3/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 7/10 | 8/10 | 9/10 | 7/10 |
| Image Testing | 6/10 | 7/10 | 9/10 | 7/10 |
| Coverage Tracking | 4/10 | 8/10 | 6/10 | 9/10 |
| CI/CD Automation | 6/10 | 9/10 | 8/10 | 9/10 |
| Static Analysis | 8/10 | 8/10 | 6/10 | 8/10 |
| Agent Rules | 5/10 | 8/10 | 3/10 | 3/10 |
| **Overall** | **5.8** | **8.5** | **7.3** | **7.8** |

**Key Gaps vs Gold Standards:**
- **vs odh-dashboard**: Missing integration/E2E tests, coverage enforcement, CI optimizations
- **vs notebooks**: Missing image testing depth, multi-arch support
- **vs kserve**: Missing coverage enforcement, E2E tests, CI caching

## File Paths Reference

### CI/CD
- `.github/workflows/run-tests.yml` — Unit test workflow
- `.github/workflows/lint.yml` — Ruff + mypy workflow
- `.github/workflows/validate-deps.yml` — Deps sync, garak drift, container build
- `.github/workflows/security.yml` — Trivy security scan
- `.github/workflows/build-and-publish.yaml` — PyPI publish on release
- `.github/workflows/sync-branch-incubation.yaml` — Main → incubation sync
- `.github/workflows/sync-branch-stable.yaml` — Incubation → stable sync
- `.tekton/odh-trustyai-garak-lls-provider-dsp-release-push.yaml` — Tekton/Konflux pipeline

### Testing
- `tests/conftest.py` — Shared fixtures
- `tests/test_config.py` — Config and deep merge tests
- `tests/test_utils.py` — Utility and result parsing tests
- `tests/test_pipeline_steps.py` — Pipeline step business logic tests
- `tests/test_intents.py` — Taxonomy and intent generation tests
- `tests/test_evalhub_adapter.py` — Eval-hub adapter lifecycle tests
- `tests/test_sdg_params.py` — SDG parameter resolution tests
- `tests/fixtures/` — Sample test data
- `tests/_resources/` — Test resource files (JSONL)

### Configuration
- `pyproject.toml` — Package config, pytest, coverage, ruff, mypy
- `Makefile` — Build and test targets
- `.pre-commit-config.yaml` — Pre-commit hooks
- `.github/dependabot.yml` — Dependabot (pip)
- `Containerfile` — Container image definition

### Agent Rules
- `CLAUDE.md` — AI agent context
- `AGENTS.md` — AI agent context (duplicate)
