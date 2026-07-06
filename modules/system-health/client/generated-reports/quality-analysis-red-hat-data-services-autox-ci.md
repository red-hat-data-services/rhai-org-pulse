---
repository: "red-hat-data-services/autox-ci"
overall_score: 4.8
scorecard:
  - dimension: "Unit Tests"
    score: 6.5
    status: "Solid unit tests for benchmarks module; functional tests are E2E-only with no isolated unit tests for lib/"
  - dimension: "Integration/E2E"
    score: 7.5
    status: "Strong parametrized functional tests against live RHOAI clusters with positive/negative scenarios"
  - dimension: "Build Integration"
    score: 1.0
    status: "No CI/CD pipelines, no PR-time build validation, no automated checks of any kind"
  - dimension: "Image Testing"
    score: 0.0
    status: "No container images, Dockerfiles, or image testing — not applicable for a test-only repo"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage generation, no codecov/coveralls integration, no coverage thresholds"
  - dimension: "CI/CD Automation"
    score: 1.0
    status: "Zero CI/CD workflows — no GitHub Actions, no linting, no automated test runs on PRs"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules for test automation guidance"
critical_gaps:
  - title: "No CI/CD pipelines at all"
    impact: "Code changes are never automatically validated — regressions, broken imports, and style drift are only caught manually"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No linting or static analysis"
    impact: "No automated enforcement of code quality — no ruff, flake8, mypy, or pre-commit hooks"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No test coverage tracking"
    impact: "No visibility into which library code (15K+ lines) is exercised by tests; regressions go unnoticed"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No security scanning"
    impact: "No dependency vulnerability scanning, no secret detection, no SAST — credentials could leak"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No unit tests for autox_tests/lib/ (15 modules, ~4K lines)"
    impact: "Core utilities for K8s, KFP, S3, config loading, and failure diagnostics have zero isolated unit tests"
    severity: "MEDIUM"
    effort: "16-24 hours"
quick_wins:
  - title: "Add a GitHub Actions CI workflow with ruff lint + unit tests"
    effort: "2-4 hours"
    impact: "Immediately catches broken imports, style issues, and unit test regressions on every PR"
  - title: "Add ruff.toml configuration for linting and formatting"
    effort: "1-2 hours"
    impact: "Enforces consistent code style across 19K+ lines of Python"
  - title: "Add pytest-cov to benchmark unit tests"
    effort: "1-2 hours"
    impact: "Gives visibility into how much of benchmark_common and orchestrator code is tested"
  - title: "Add Dependabot or Renovate for dependency updates"
    effort: "30 minutes"
    impact: "Automated alerts for vulnerable or outdated dependencies (boto3, kubernetes, kfp)"
  - title: "Create basic CLAUDE.md with test patterns and conventions"
    effort: "2-3 hours"
    impact: "Enables AI agents to generate consistent, high-quality test code for this repo"
recommendations:
  priority_0:
    - "Create a GitHub Actions CI workflow that runs ruff lint + autox_benchmarks unit tests on every PR"
    - "Add ruff.toml with sensible defaults for Python 3.12+ linting and formatting"
    - "Add pytest-cov integration and generate coverage reports for the benchmarks unit tests"
  priority_1:
    - "Write unit tests for autox_tests/lib/ modules (settings, config_loaders, k8s_utils, s3_data, kfp_progress)"
    - "Add a periodic/dispatch GitHub Actions workflow that runs functional E2E tests against a live cluster"
    - "Add Dependabot configuration for pip ecosystem dependency scanning"
    - "Add pre-commit hooks (ruff, trailing whitespace, YAML lint, secret detection)"
  priority_2:
    - "Add mypy type checking for stricter type safety across the codebase"
    - "Create CLAUDE.md and .claude/rules/ for agent-assisted test development"
    - "Add Gitleaks or TruffleHog for secret detection in CI"
    - "Add CODEOWNERS file for review enforcement"
---

# Quality Analysis: autox-ci

## Executive Summary

- **Overall Score: 4.8/10**
- **Repository Type**: Python test framework — end-to-end integration test suites and benchmark orchestration for AutoML/AutoRAG pipelines on OpenShift AI (RHOAI)
- **Primary Language**: Python 3.12 (~19,500 lines across 2 packages)
- **Framework**: pytest + KFP v2 + Kubernetes client + boto3

### Key Strengths
- Well-structured parametrized functional tests with positive/negative scenarios and config-driven test execution
- Strong test infrastructure (conftest fixtures for KFP, S3, kubeconfig, DSPA auto-setup, cleanup tracking)
- Good benchmark unit test coverage for orchestrator, CLI, pipeline params, compare logic, and credential loading
- Comprehensive PR template with checklist and structured sections
- Excellent `run_tests.sh` wrapper with env management, suite selection, tag filtering, and dry-run mode

### Critical Gaps
- **Zero CI/CD workflows** — no GitHub Actions, no automated checks on PRs
- **No linting or static analysis** — no ruff, flake8, mypy, or pre-commit hooks
- **No test coverage tracking** — no pytest-cov, no codecov, no coverage thresholds
- **No security scanning** — no dependency scanning, no secret detection
- **No agent rules** — no CLAUDE.md, no `.claude/` directory

### Agent Rules Status: Missing

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.5/10 | Solid benchmarks unit tests (71 test functions); no unit tests for autox_tests/lib/ |
| Integration/E2E | 7.5/10 | Strong parametrized functional tests with pos/neg scenarios against live RHOAI clusters |
| **Build Integration** | **1.0/10** | **No CI/CD at all — no PR validation, no automated builds** |
| Image Testing | N/A | Not applicable — test-only repo with no container images |
| Coverage Tracking | 1.0/10 | No coverage generation or reporting |
| CI/CD Automation | 1.0/10 | Zero workflows — no GitHub Actions, no linting, no automated test runs |
| Agent Rules | 0.0/10 | No CLAUDE.md, no .claude/ directory, no test automation guidance |

## Critical Gaps

### 1. No CI/CD Pipelines
- **Impact**: Code changes are never automatically validated. Broken imports, regressions, and style drift are only caught by manual review or runtime failures on clusters.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The `.github/` directory contains only a PR template — no workflows whatsoever. There are no GitHub Actions, no GitLab CI, no Jenkins pipelines.

### 2. No Linting or Static Analysis
- **Impact**: 19,500+ lines of Python with zero automated quality enforcement. Inconsistencies in style, unused imports, and type errors accumulate silently.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No `ruff.toml`, `.flake8`, `mypy.ini`, `.pylintrc`, or `.pre-commit-config.yaml` exists. No linting is configured in `pyproject.toml` either.

### 3. No Test Coverage Tracking
- **Impact**: No visibility into which portions of the 15K+ lines of library/utility code are exercised by tests. Coverage regressions go unnoticed.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No `.coveragerc`, no `codecov.yml`, no pytest-cov configuration. The `pyproject.toml` has no coverage settings.

### 4. No Security Scanning
- **Impact**: Credentials flow through environment variables and `.env` files. No automated detection of leaked secrets, vulnerable dependencies, or insecure patterns.
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: No CodeQL, Trivy, Snyk, Gitleaks, or Dependabot configuration. The `.gitignore` properly excludes `.env` files, but there's no automated verification.

### 5. No Unit Tests for Core Library (autox_tests/lib/)
- **Impact**: 15 modules (~4,000 lines) providing Kubernetes utilities, KFP helpers, S3 operations, config loading, failure diagnostics, and settings management have zero isolated unit tests. Bugs in these shared utilities affect all functional test suites.
- **Severity**: MEDIUM
- **Effort**: 16-24 hours
- **Details**: Modules like `k8s_utils.py` (495 lines), `settings.py` (658 lines), `config_loaders.py` (324 lines), `managed_pipelines.py` (375 lines), `dspa_support.py` (401 lines) contain complex logic but are only exercised indirectly through E2E functional tests that require live clusters.

## Quick Wins

### 1. Add a GitHub Actions CI workflow (2-4 hours)
Run `ruff check` + `ruff format --check` + `pytest autox_benchmarks/tests/` on every PR.

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv sync --extra dev
        working-directory: autox_benchmarks
      - run: uv run ruff check .
      - run: uv run ruff format --check .
      - run: uv run pytest autox_benchmarks/tests/ -v --tb=short
```

### 2. Add ruff.toml configuration (1-2 hours)

```toml
# ruff.toml
target-version = "py312"
line-length = 120

[lint]
select = ["E", "F", "W", "I", "UP", "B", "SIM", "S"]
ignore = ["S101"]  # assert is expected in test code

[lint.per-file-ignores]
"tests/**" = ["S"]
"autox_tests/**" = ["S"]
```

### 3. Add pytest-cov to benchmark tests (1-2 hours)
Add `pytest-cov` to dev dependencies and run with `--cov=automl_benchmark --cov=autorag_benchmark --cov=benchmark_common`.

### 4. Add Dependabot (30 minutes)

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: pip
    directory: /
    schedule:
      interval: weekly
  - package-ecosystem: pip
    directory: /autox_benchmarks
    schedule:
      interval: weekly
```

### 5. Create CLAUDE.md with test patterns (2-3 hours)
Document the parametrized test pattern, conftest fixture hierarchy, config-driven scenario model, and positive/negative test conventions used throughout the repo.

## Detailed Findings

### CI/CD Pipeline
- **Workflows**: None. The `.github/` directory only contains `pull_request_template.md`.
- **PR Validation**: No automated checks. The PR template has a manual checklist but nothing enforces it.
- **Periodic Jobs**: None.
- **Build Automation**: None — no Makefile, no build targets.
- **Concurrency/Caching**: N/A.

### Test Coverage

#### autox_tests/ (Functional E2E Tests)
- **Test files**: 3 (`test_pipeline_functional.py`, `test_tabular_functional.py`, `test_timeseries_functional.py`)
- **Test functions**: ~13 (parametrized — actual test instances depend on config JSON scenarios)
- **Framework**: pytest with extensive conftest fixture hierarchy
- **Pattern**: Config-driven parametrized tests with positive (assert SUCCEEDED + validate artifacts) and negative (assert FAILED + verify fault task) scenarios
- **Infrastructure**: Auto-creates DSPA, manages KFP clients, builds temp kubeconfigs, tracks S3 cleanup
- **Notable**: Tests validate pipeline outputs in S3 (models, leaderboards, notebooks), execute downloaded notebooks via papermill, and optionally test KServe deployment with v1/v2 inference
- **Limitation**: Requires live RHOAI cluster — cannot run in CI without cluster access

#### autox_benchmarks/tests/ (Unit + Integration Tests)
- **Test files**: 10 (9 unit, 1 integration)
- **Test functions**: 71
- **Framework**: pytest with fixtures, monkeypatch, tmp_path, unittest.mock
- **Coverage areas**: CLI argument forwarding, orchestrator dry-run, pipeline parameter building, package path resolution, compare logic, credential loading, storage buckets, benchmark script invocation
- **Integration test**: Online smoke benchmark against live KFP + S3 (guarded by conftest prerequisite validation)
- **Strength**: Good use of test fixtures, realistic test data, edge case coverage (missing files, invalid configs, fail-fast behavior)

#### Test-to-Code Ratio
- Test lines: 2,015
- Source lines: 15,864
- **Ratio: 0.12** (low — industry target is 0.5-1.0+)

#### Conftest Infrastructure (1,680 lines across 6 files)
- Rich fixture ecosystem with session-scoped KFP clients, S3 clients, kubeconfig management
- DSPA auto-setup, health checking, and cleanup tracking
- Integration test isolation via `pytest_ignore_collect`
- Well-structured but only exercised through live cluster tests

### Code Quality
- **Linting**: None configured. No ruff, flake8, pylint, or ESLint.
- **Formatting**: No formatter configured. Code is manually formatted.
- **Type Checking**: No mypy or pyright. Type hints are used in some files (especially benchmarks) but not enforced.
- **Pre-commit Hooks**: None. No `.pre-commit-config.yaml`.
- **Static Analysis**: No SAST tools (CodeQL, Semgrep, gosec).
- **Code Style**: Generally good — docstrings on modules, clear function naming, structured logging. But inconsistent without enforcement.

### Container Images
- **Not applicable** — this is a test framework repository, not a service that produces container images. No Dockerfile, Containerfile, or image build process exists.
- The repo does include a `podman run` example in the README for running tests in containers, but no image testing is performed.

### Security
- **Dependency Scanning**: None. No Dependabot, Renovate, or Snyk.
- **Secret Detection**: None. No Gitleaks, TruffleHog, or detect-secrets.
- **SAST**: None. No CodeQL or Semgrep.
- **Credential Management**: `.env` files are properly gitignored. `.env.*.example` templates don't contain real secrets. PR template checklist includes "No secrets or credentials committed."
- **Risk**: Credentials for RHOAI clusters, S3, and KFP tokens flow through environment variables. Without automated secret scanning, accidental commits are possible.

### Agent Rules (Agentic Flow Quality)
- **Status**: Missing
- **Coverage**: No rules exist for any test type
- **Quality**: N/A
- **Gaps**: No CLAUDE.md, no AGENTS.md, no `.claude/` directory, no `.claude/rules/`, no `.claude/skills/`
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - Parametrized functional test patterns (positive/negative)
  - Conftest fixture conventions and hierarchy
  - Config-driven scenario model (JSON configs, tags, env files)
  - Benchmarks unit test patterns (dry-run, mocking, fixture usage)
  - KFP/S3/Kubernetes utility testing patterns

## Recommendations

### Priority 0 (Critical)
1. **Create a GitHub Actions CI workflow** — Run `ruff check`, `ruff format --check`, and `pytest autox_benchmarks/tests/` on every PR. This is the single highest-impact improvement.
2. **Add ruff.toml for linting/formatting** — Enforce consistent code style across all 19K+ lines. Start with a permissive ruleset and tighten over time.
3. **Add pytest-cov and generate coverage reports** — At minimum for `autox_benchmarks/tests/` which can run without a live cluster.

### Priority 1 (High Value)
4. **Write unit tests for `autox_tests/lib/` modules** — These 15 modules contain complex logic for K8s operations, config parsing, S3 data management, and failure diagnostics. Mocking the external dependencies (kubernetes client, boto3, kfp) would make them testable offline.
5. **Add a periodic/dispatch workflow for functional E2E tests** — Use `workflow_dispatch` to trigger E2E tests with cluster credentials stored as GitHub secrets.
6. **Add Dependabot for pip ecosystem** — Automated vulnerability alerts for boto3, kubernetes, kfp, and other dependencies.
7. **Add pre-commit hooks** — ruff, trailing whitespace, YAML lint, `.env` file detection.

### Priority 2 (Nice-to-Have)
8. **Add mypy type checking** — Many files already use type hints; adding mypy enforcement would catch type errors at CI time.
9. **Create CLAUDE.md and `.claude/rules/`** — Document test patterns, fixture conventions, and config-driven scenario model for AI-assisted test development.
10. **Add Gitleaks or TruffleHog** — Automated secret detection in CI to prevent accidental credential commits.
11. **Add CODEOWNERS** — Enforce review by specific team members for critical paths (conftest.py, lib/, configs/).

## Comparison to Gold Standards

| Dimension | autox-ci | odh-dashboard | notebooks | kserve |
|-----------|----------|---------------|-----------|--------|
| CI/CD Workflows | 0 workflows | 10+ workflows | 5+ workflows | 15+ workflows |
| PR Validation | Manual checklist only | Full lint + test + build | Lint + image test | Lint + unit + E2E |
| Unit Tests | 71 (benchmarks only) | 500+ | 100+ | 1000+ |
| E2E Tests | Config-driven parametrized | Multi-layer with contracts | 5-layer image validation | Multi-version + envtest |
| Coverage Tracking | None | Codecov with thresholds | Coverage reports | Codecov enforcement |
| Linting | None | ESLint + Prettier | shellcheck + yamllint | golangci-lint (40+ linters) |
| Security Scanning | None | Snyk + SAST | Trivy + SBOM | CodeQL + Snyk |
| Pre-commit | None | Comprehensive | Present | Present |
| Agent Rules | None | Comprehensive .claude/rules/ | Basic | Basic |
| Test-to-Code Ratio | 0.12 | ~0.8 | ~0.5 | ~1.0+ |

## File Paths Reference

### Project Configuration
- `pyproject.toml` — Root project dependencies, pytest config, uv sources
- `autox_benchmarks/pyproject.toml` — Benchmarks sub-package dependencies
- `.python-version` — Python 3.12
- `.gitignore` — Comprehensive Python gitignore with `.env` exclusions
- `.github/pull_request_template.md` — Structured PR template

### Test Infrastructure
- `run_tests.sh` — Main test runner with suite/tag/env management
- `autox_tests/conftest.py` — Root conftest (KFP client, DSPA, kubeconfig, S3)
- `autox_tests/automl/conftest.py` — AutoML fixtures
- `autox_tests/autorag/conftest.py` — AutoRAG fixtures
- `autox_benchmarks/tests/conftest.py` — Benchmarks test fixtures
- `autox_benchmarks/tests/integration/conftest.py` — Integration test prerequisites

### Functional Test Suites
- `autox_tests/automl/test_tabular_functional.py` — Tabular pipeline tests (345 lines)
- `autox_tests/automl/test_timeseries_functional.py` — Time series pipeline tests (346 lines)
- `autox_tests/autorag/test_pipeline_functional.py` — RAG pipeline tests (193 lines)

### Benchmark Unit Tests
- `autox_benchmarks/tests/test_automl_orchestrator_dry_run.py` — Orchestrator dry-run (240 lines)
- `autox_benchmarks/tests/test_compare_logic.py` — Compare logic (172 lines)
- `autox_benchmarks/tests/test_automl_pipeline_params.py` — Pipeline params (164 lines)
- `autox_benchmarks/tests/test_automl_cli.py` — CLI tests (148 lines)
- `autox_benchmarks/tests/test_automl_package_resolve.py` — Package resolution (147 lines)
- `autox_benchmarks/tests/integration/test_automl_online.py` — Online integration (119 lines)

### Core Library (untested)
- `autox_tests/lib/settings.py` — Settings management (658 lines)
- `autox_tests/lib/k8s_utils.py` — Kubernetes utilities (495 lines)
- `autox_tests/lib/dspa_support.py` — DSPA support (401 lines)
- `autox_tests/lib/managed_pipelines.py` — Pipeline management (375 lines)
- `autox_tests/lib/config_loaders.py` — Config loading (324 lines)
- `autox_tests/automl/utils.py` — AutoML test utilities (1,453 lines)
- `autox_tests/autorag/utils.py` — AutoRAG test utilities (356 lines)
