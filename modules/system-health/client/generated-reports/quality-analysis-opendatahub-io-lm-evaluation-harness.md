---
repository: "opendatahub-io/lm-evaluation-harness"
overall_score: 4.4
scorecard:
  - dimension: "Unit Tests"
    score: 6.0
    status: "664 test functions across 32 files; good pytest usage with parametrize and fixtures, but low test-to-code ratio (32/725 = 0.044)"
  - dimension: "Integration/E2E"
    score: 2.0
    status: "No dedicated integration or E2E test directories; no cluster-based testing; limited to unit-level tests"
  - dimension: "Build Integration"
    score: 1.0
    status: "No Dockerfile, no PR-time build validation, no Konflux/Tekton pipelines, no image building in CI"
  - dimension: "Image Testing"
    score: 0.0
    status: "No container image artifacts — no Dockerfile, no Containerfile, no image build or runtime validation"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "pytest-cov listed as dev dependency but not used in CI; no codecov config, no coverage thresholds or PR reporting"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "3 workflows (unit tests, task change detection, publish); multi-Python matrix; uv caching; Mergify for upstream sync; but no concurrency control, no E2E automation"
  - dimension: "Static Analysis"
    score: 7.0
    status: "Strong ruff config with 10+ rule categories; comprehensive pre-commit hooks (codespell, pymarkdown); but no Dependabot/Renovate for dependency alerts"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory; no AI agent test creation guidance"
critical_gaps:
  - title: "No container image or build integration"
    impact: "Repository produces no container images in CI — downstream Konflux builds have no upstream validation, risking build failures discovered only post-merge"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No coverage tracking or enforcement"
    impact: "pytest-cov is a dev dependency but never invoked in CI; no coverage thresholds, no PR coverage gates — regressions in test coverage go undetected"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No integration or E2E tests"
    impact: "With 209 task directories and multiple model backends (HuggingFace, vLLM, OpenVINO, API), there are no integration tests validating end-to-end evaluation pipelines"
    severity: "HIGH"
    effort: "24-40 hours"
  - title: "Very low test-to-code ratio"
    impact: "32 test files covering 725 source files (0.044 ratio) leaves large portions of the codebase untested, especially model backends and task configurations"
    severity: "MEDIUM"
    effort: "40-80 hours"
  - title: "No dependency update automation"
    impact: "No Dependabot or Renovate configuration; dependency vulnerabilities and version drift go undetected until manual review"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Enable coverage tracking in CI"
    effort: "2-4 hours"
    impact: "Add --cov flags to pytest in unit_tests.yml and configure codecov to get PR coverage reporting and threshold enforcement"
  - title: "Add Dependabot configuration"
    effort: "1-2 hours"
    impact: "Automated dependency update PRs for pip and GitHub Actions ecosystems"
  - title: "Add concurrency control to CI workflows"
    effort: "1 hour"
    impact: "Prevent redundant workflow runs on rapid PR pushes, saving CI resources"
  - title: "Create basic CLAUDE.md with test patterns"
    effort: "2-3 hours"
    impact: "Guide AI agents to write consistent, high-quality tests matching existing pytest patterns"
recommendations:
  priority_0:
    - "Enable pytest-cov in CI and add codecov integration with minimum coverage thresholds"
    - "Add a Dockerfile for the lm-eval container image used by downstream RHOAI deployments"
    - "Create integration tests for end-to-end evaluation pipelines with at least one model backend"
  priority_1:
    - "Add Dependabot configuration covering pip and github-actions ecosystems"
    - "Add concurrency control (concurrency: group/cancel-in-progress) to all PR-triggered workflows"
    - "Create CLAUDE.md with test creation guidelines and coding standards"
    - "Increase unit test coverage for model backends (only 11 test files for the models/ module)"
  priority_2:
    - "Add multi-architecture container build support for downstream deployment targets"
    - "Create contract tests for the eval-hub-sdk integration boundary"
    - "Add performance regression tests for evaluation benchmarks"
---

# Quality Analysis: opendatahub-io/lm-evaluation-harness

## Executive Summary

- **Overall Score: 4.4/10**
- **Repository Type**: Python library/framework (LLM evaluation harness)
- **Primary Language**: Python
- **Tier**: Midstream (fork of EleutherAI/lm-evaluation-harness)
- **Jira**: RHOAIENG / AI Safety
- **Key Strengths**: Solid static analysis setup with ruff and comprehensive pre-commit hooks; decent unit test suite with 664 test functions using pytest best practices; smart CI workflow that detects task/API changes and runs targeted tests
- **Critical Gaps**: No container image or build integration whatsoever; no coverage tracking despite having pytest-cov as a dependency; no integration/E2E tests for a framework with 209 evaluation tasks and multiple model backends; no dependency update automation
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 6.0/10 | 15% | 0.90 | 664 test functions, pytest+parametrize, but low code coverage ratio |
| Integration/E2E | 2.0/10 | 20% | 0.40 | No integration or E2E test suites |
| Build Integration | 1.0/10 | 15% | 0.15 | No Dockerfile, no PR-time build validation |
| Image Testing | 0.0/10 | 10% | 0.00 | No container image artifacts at all |
| Coverage Tracking | 2.0/10 | 10% | 0.20 | pytest-cov in deps but unused in CI |
| CI/CD Automation | 6.0/10 | 15% | 0.90 | Multi-Python matrix, caching, Mergify sync |
| Static Analysis | 7.0/10 | 10% | 0.70 | Strong ruff config, pre-commit, but no Dependabot |
| Agent Rules | 0.0/10 | 5% | 0.00 | No agent rules present |
| **Overall** | **4.4/10** | **100%** | **3.25** | |

## Critical Gaps

### 1. No Container Image or Build Integration (HIGH)
- **Impact**: The repository has no Dockerfile or Containerfile. Downstream builds (Konflux/Tekton for RHOAI) have no upstream CI validation, meaning build failures are discovered only after merge in the downstream pipeline.
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Evidence**: `find . -name 'Dockerfile' -o -name 'Containerfile'` returns nothing. No `.tekton/` directory. No image build steps in any CI workflow.

### 2. No Coverage Tracking or Enforcement (HIGH)
- **Impact**: `pytest-cov` is listed in `pyproject.toml` under `[project.optional-dependencies] dev`, but it is never invoked in CI. There is no `.codecov.yml`, no coverage thresholds, and no PR coverage reporting. Coverage regressions are invisible.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Evidence**: `grep -rn 'pytest-cov\|--cov\|coverprofile\|coverage\|codecov' .github/workflows/` finds no matches. CI pytest command: `pytest -x --showlocals -s -vv -n=auto` — no `--cov` flag.

### 3. No Integration or E2E Tests (HIGH)
- **Impact**: The framework supports 209+ evaluation task directories and multiple model backends (HuggingFace, vLLM, OpenVINO, API-based). There are no integration tests that validate end-to-end evaluation pipelines (loading a task, running evaluation against a model, producing results). The commented-out `testmodels` job in `unit_tests.yml` confirms this was once attempted but is now disabled.
- **Severity**: HIGH
- **Effort**: 24-40 hours
- **Evidence**: `find . -name 'e2e' -o -name 'integration'` returns nothing. Test directory structure: `tests/`, `tests/models/`, `tests/scripts/`, `tests/testdata/`, `tests/testconfigs/`, `tests/testyamls/`, `tests/test_configs/` — all unit-level.

### 4. Very Low Test-to-Code Ratio (MEDIUM)
- **Impact**: 32 test files covering 725 source files (ratio: 0.044). The `lm_eval/tasks/` directory alone contains 209 subdirectories with task configurations, and the `lm_eval/models/` module has multiple backends with limited test coverage (11 model test files, several of which are skipped in CI).
- **Severity**: MEDIUM
- **Effort**: 40-80 hours

### 5. No Dependency Update Automation (MEDIUM)
- **Impact**: No `.github/dependabot.yml` or `renovate.json` configuration. Dependency vulnerabilities and version drift in the 30+ direct dependencies go undetected.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours

## Quick Wins

### 1. Enable Coverage Tracking in CI (2-4 hours)
Add `--cov=lm_eval --cov-report=xml` to the pytest command in `unit_tests.yml` and add a codecov upload step:

```yaml
- name: Test with pytest
  run: pytest -x --showlocals -s -vv -n=auto --cov=lm_eval --cov-report=xml --ignore=tests/models/test_openvino.py --ignore=tests/models/test_hf_steered.py --ignore=tests/scripts/test_zeno_visualize.py

- name: Upload coverage
  uses: codecov/codecov-action@v5
  with:
    files: ./coverage.xml
    fail_ci_if_error: false
```

Create `.codecov.yml`:
```yaml
coverage:
  status:
    project:
      default:
        target: auto
        threshold: 1%
    patch:
      default:
        target: 80%
```

### 2. Add Dependabot Configuration (1-2 hours)
Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
```

### 3. Add Concurrency Control (1 hour)
Add to both `unit_tests.yml` and `new_tasks.yml`:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref || github.run_id }}
  cancel-in-progress: true
```

### 4. Create Basic CLAUDE.md (2-3 hours)
Add a `CLAUDE.md` with test creation patterns, framework-specific guidelines (pytest, parametrize), and coding standards matching the existing ruff configuration.

## Detailed Findings

### Unit Tests

**Score: 6.0/10**

- **Framework**: pytest with pytest-xdist for parallel execution
- **Test Files**: 32 Python test files across `tests/`, `tests/models/`, `tests/scripts/`
- **Test Functions**: 664 test functions/methods
- **Test Lines**: ~10,312 lines of test code
- **Source Files**: 725 Python source files in `lm_eval/`
- **Test-to-Code Ratio**: 0.044 (low; healthy target is 0.3-0.5+)

**Strengths**:
- Good use of `pytest.mark.parametrize` for combinatorial testing
- Proper fixtures with `@pytest.fixture`
- Mock patterns for testing (`MockTask` in `test_group.py`)
- Well-structured test organization (by module: models, scripts, core)
- Substantial test files: `test_task_manager.py` (1,150 lines), `test_cli_subcommands.py` (953 lines)
- Test data directories (`testdata/`, `testconfigs/`, `testyamls/`, `test_configs/`) for fixture data

**Weaknesses**:
- Very low coverage ratio relative to 725 source files
- Model backend tests are partially skipped in CI (`--ignore=tests/models/test_openvino.py --ignore=tests/models/test_hf_steered.py`)
- External model tests (`testmodels` job) are completely commented out
- No test isolation patterns (no `tmp_path` fixture usage observed)

### Integration/E2E Tests

**Score: 2.0/10**

- No `e2e/`, `integration/`, or similar directories
- No cluster-based testing (no Kind, Minikube, envtest)
- No docker-compose test configurations
- The `new_tasks.yml` workflow provides some integration-like validation by running `test_tasks.py` when task files change, but this is still unit-level testing
- The commented-out `testmodels` job suggests integration testing was attempted but abandoned

**What's Missing**:
- End-to-end evaluation pipeline tests (task loading → model inference → metric computation → result output)
- Multi-model backend integration tests
- Task YAML validation across all 209 task directories
- eval-hub-sdk integration boundary tests (the `rhoai` extra depends on `eval-hub-sdk`)

### Build Integration

**Score: 1.0/10**

- No Dockerfile or Containerfile in the repository
- No PR-time build validation
- No Konflux/Tekton pipeline configuration (no `.tekton/` directory)
- No Makefile for build targets
- PyPI publishing workflow exists (`publish.yml`) but only for Python package distribution, not container images
- The only "build" step is `python3 -m build` for creating wheel/tarball distributions

**Score rationale**: Gets 1 point for having a functional PyPI publishing pipeline, but this dimension primarily evaluates container build integration which is entirely absent.

### Image Testing

**Score: 0.0/10**

- No Dockerfile or Containerfile
- No `.dockerignore`
- No `docker-compose.yml`
- No multi-stage builds
- No base image selection (no UBI, alpine, etc.)
- No Testcontainers usage
- No image startup validation
- No multi-architecture support
- No health checks or readiness probes

This repository produces no container artifacts at all. Downstream RHOAI deployments must create their own Dockerfiles, which means image build issues are discovered only in downstream pipelines.

### Coverage Tracking

**Score: 2.0/10**

- `pytest-cov` is listed as a dev dependency in `pyproject.toml`
- `pytest-cov` is **not** used in any CI workflow — the `pytest` command lacks `--cov` flags
- No `.codecov.yml` or `codecov.yml` configuration
- No `.coveragerc` configuration
- No coverage threshold enforcement
- No PR coverage reporting
- No coverage badge in README

**Score rationale**: Gets 2 points for at least having pytest-cov available as a dependency, indicating awareness of coverage tooling even though it's unused.

### CI/CD Automation

**Score: 6.0/10**

**Workflows**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `unit_tests.yml` | push to main, PRs to main, manual | Linting (pre-commit) + CPU tests across Python 3.10/3.11/3.12 |
| `new_tasks.yml` | push to main, PRs to main/release-*, manual | Detects changes in `lm_eval/tasks/` and `lm_eval/api/` and runs targeted tests |
| `publish.yml` | tag push | Build wheel/tarball and publish to PyPI + TestPyPI |
| `pull.yml` | — | Upstream sync config (pulls from EleutherAI:main) |

**Strengths**:
- Multi-Python version matrix testing (3.10, 3.11, 3.12)
- Smart change detection in `new_tasks.yml` — only runs task tests when task/API files change
- HuggingFace cache optimization with `actions/cache`
- uv package manager with caching (`astral-sh/setup-uv` with `enable-cache: true`)
- Test artifact archival on failure
- Timeout limits on all jobs (5 min for linter, 30 min for tests, 120 min for tasks)
- Mergify configuration for automated backports from `incubation` to `stable` branches
- Upstream sync via `pull.yml` (from EleutherAI:main)

**Weaknesses**:
- No concurrency control — rapid PR pushes trigger duplicate workflow runs
- No E2E or integration test automation
- External model tests are commented out (would test HuggingFace, API, OpenVINO backends)
- No test parallelization beyond `pytest-xdist` (`-n=auto`)
- No scheduled/periodic test runs (nightly, weekly)
- `fail-fast: true` means a failure in Python 3.10 cancels 3.11/3.12 runs

### Static Analysis

**Score: 7.0/10**

**Ruff Configuration** (in `pyproject.toml`):
- Preview mode enabled
- 10+ rule categories: bugbear (B), comprehension (C419), docstyle (D), pycodestyle (E), pyflakes (F), refurb (FURB), isort (I), typecheck (TC), flake8-bandit (S), simplify (SIM), pyupgrade (UP)
- Fixable rules configured for auto-fix
- Per-file ignores for `__init__.py`
- isort configured with `known-first-party`
- Google-style pydocstring convention

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- `pre-commit-hooks`: 14 hooks (check-ast, check-json, check-yaml, detect-private-key, etc.)
- `ruff-pre-commit`: linter + formatter
- `codespell`: spell checking with custom ignore
- `pymarkdown`: markdown linting with custom config
- Excludes `tests/testdata/` to avoid conflicts

**FIPS Compatibility**:
- No non-FIPS crypto imports detected (`hashlib.md5`, `Crypto.Cipher.*`, etc.)
- No FIPS build tags needed (Python library, not Go)
- Base image analysis not applicable (no Dockerfile)

**Dependency Alerts**:
- **No Dependabot** (`.github/dependabot.yml` not found)
- **No Renovate** (`renovate.json`, `.renovaterc` not found)
- No auto-merge policies

**Score rationale**: Strong linting and pre-commit setup, but missing dependency alert automation costs 3 points.

### Agent Rules

**Score: 0.0/10**

- No `CLAUDE.md` in repository root
- No `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` directory
- No test creation rules or AI agent guidance
- No `CODEOWNERS`-style agent guidelines

**Recommendation**: Generate agent rules with `/test-rules-generator` to create `CLAUDE.md` and `.claude/rules/` with pytest patterns, task YAML validation guidance, and model backend testing standards.

## Recommendations

### Priority 0 (Critical)

1. **Enable pytest-cov in CI and add codecov integration** — pytest-cov is already a dependency; add `--cov=lm_eval --cov-report=xml` to CI pytest commands and integrate with codecov for PR coverage reporting and threshold enforcement.

2. **Add a Dockerfile for the lm-eval container image** — Downstream RHOAI deployments need a container image. Building and validating the image in CI would catch packaging issues before they reach Konflux pipelines.

3. **Create integration tests for end-to-end evaluation pipelines** — At minimum, test the complete path: load task → initialize model → run evaluation → verify results for at least one task+model combination.

### Priority 1 (High Value)

4. **Add Dependabot configuration** — Cover `pip` and `github-actions` ecosystems with weekly update checks.

5. **Add concurrency control to CI workflows** — Prevent redundant workflow runs with `concurrency: group/cancel-in-progress`.

6. **Create CLAUDE.md with test creation guidelines** — Document pytest patterns, parametrize usage, fixture conventions, and task YAML validation rules for AI-assisted development.

7. **Increase unit test coverage for model backends** — The `tests/models/` directory has 11 test files but several are skipped in CI. Re-enable and expand model backend tests.

### Priority 2 (Nice-to-Have)

8. **Add multi-architecture container build support** — For downstream deployment targets that require aarch64 or s390x support.

9. **Create contract tests for eval-hub-sdk integration** — The `rhoai` extra depends on `eval-hub-sdk[adapter]==0.4.2`; boundary tests would catch breaking changes.

10. **Add performance regression tests** — Benchmark evaluation speed for key tasks to detect performance regressions.

## Comparison to Gold Standards

| Dimension | lm-evaluation-harness | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|-----------|----------------------|---------------------|-------------------|---------------|
| Unit Tests | 6.0 — 664 tests, low ratio | 9.0 — Comprehensive Jest/Cypress | 7.0 — Multi-layer | 8.0 — Extensive Go tests |
| Integration/E2E | 2.0 — None | 9.0 — Full E2E suite | 8.0 — Image validation | 9.0 — Multi-version K8s |
| Build Integration | 1.0 — PyPI only | 8.0 — PR Docker builds | 9.0 — 5-layer validation | 8.0 — Operator manifests |
| Image Testing | 0.0 — No images | 7.0 — Container validation | 9.0 — Multi-arch | 7.0 — Runtime testing |
| Coverage Tracking | 2.0 — Unused dep | 8.0 — Codecov + gates | 6.0 — Basic coverage | 9.0 — Strict thresholds |
| CI/CD Automation | 6.0 — Multi-Python, caching | 9.0 — Full pipeline | 8.0 — Comprehensive | 9.0 — Matrix testing |
| Static Analysis | 7.0 — Strong ruff | 8.0 — ESLint + Dependabot | 7.0 — Basic linting | 8.0 — golangci-lint |
| Agent Rules | 0.0 — None | 8.0 — Comprehensive rules | 5.0 — Basic CLAUDE.md | 4.0 — Minimal |
| **Overall** | **4.4** | **8.5** | **7.5** | **8.0** |

## File Paths Reference

### CI/CD
- `.github/workflows/unit_tests.yml` — Unit tests + linting (PR-triggered)
- `.github/workflows/new_tasks.yml` — Task change detection tests (PR-triggered)
- `.github/workflows/publish.yml` — PyPI publishing (tag-triggered)
- `.github/pull.yml` — Upstream sync configuration
- `.mergify.yml` — Automated backport from incubation to stable

### Testing
- `tests/` — Main test directory (32 Python test files)
- `tests/models/` — Model backend tests (11 files)
- `tests/scripts/` — Script tests (1 file)
- `tests/testdata/` — Test fixture data
- `tests/testconfigs/` — Test configuration fixtures
- `tests/testyamls/` — Test YAML fixtures
- `tests/conftest.py` — pytest configuration

### Code Quality / Static Analysis
- `pyproject.toml` — Ruff configuration, dependencies, pytest config
- `.pre-commit-config.yaml` — Pre-commit hooks (ruff, codespell, pymarkdown)

### Project Configuration
- `OWNERS` — Approvers and reviewers list
- `CODEOWNERS` — Code ownership (minimal)
- `pyproject.toml` — Project metadata, dependencies, build config
