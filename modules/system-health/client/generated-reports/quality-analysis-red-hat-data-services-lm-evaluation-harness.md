---
repository: "red-hat-data-services/lm-evaluation-harness"
overall_score: 4.2
scorecard:
  - dimension: "Unit Tests"
    score: 5.0
    status: "Pytest framework with xdist parallelization but low test-to-code ratio (6.9%)"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "No dedicated E2E infrastructure; external model tests disabled in CI"
  - dimension: "Build Integration"
    score: 6.0
    status: "Tekton/Konflux PR pipeline with multi-arch builds, but not auto-triggered"
  - dimension: "Image Testing"
    score: 5.0
    status: "Sophisticated multi-stage Dockerfiles with multi-arch but no runtime validation"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "pytest-cov dependency exists but coverage is never run or enforced in CI"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "Basic PR test workflow with parallelization; linter and model tests disabled"
  - dimension: "Static Analysis"
    score: 5.0
    status: "Pre-commit hooks with ruff and codespell but linting disabled in CI; no Dependabot"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "Coverage tracking not enforced in CI"
    impact: "No visibility into test coverage; regressions in coverage go undetected"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Linter and task-change test jobs disabled in CI"
    impact: "Code quality checks bypass; style/type issues merge uncaught"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No dedicated E2E or integration test infrastructure"
    impact: "Container startup failures, deployment issues, and model-loading problems are only caught in production"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No dependency alert configuration (Dependabot/Renovate)"
    impact: "Vulnerable or outdated dependencies go unnoticed; manual tracking required"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No concurrency control in CI workflows"
    impact: "Multiple PR builds can pile up and waste runner time"
    severity: "MEDIUM"
    effort: "1 hour"
  - title: "Tekton build pipeline not auto-triggered on PRs"
    impact: "Konflux build issues only caught when manually triggered via /build-konflux comment or label"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Re-enable the linter CI job"
    effort: "30 minutes"
    impact: "Enforce pre-commit hooks (ruff, codespell) in CI, catching style/lint issues before merge"
  - title: "Add Dependabot configuration for pip and docker ecosystems"
    effort: "1-2 hours"
    impact: "Automated dependency vulnerability alerts and update PRs"
  - title: "Add coverage reporting to CI test step"
    effort: "2-3 hours"
    impact: "Visibility into test coverage on every PR with pytest-cov already available"
  - title: "Add concurrency control to unit_tests.yml"
    effort: "30 minutes"
    impact: "Cancel stale PR runs, reduce CI queue time"
  - title: "Create basic CLAUDE.md with test patterns"
    effort: "2-3 hours"
    impact: "AI agent-generated code follows project testing conventions"
recommendations:
  priority_0:
    - "Re-enable linter CI job and enforce pre-commit checks on PRs"
    - "Add pytest-cov to CI with coverage threshold enforcement and codecov integration"
    - "Configure Dependabot for pip and docker dependency alerts"
  priority_1:
    - "Build dedicated integration tests for container image startup and model loading"
    - "Enable multi-version Python testing matrix (3.11, 3.12)"
    - "Auto-trigger Tekton Konflux builds on PRs instead of requiring manual comment/label"
    - "Add concurrency control to CI workflows"
  priority_2:
    - "Create comprehensive CLAUDE.md and .claude/rules/ for test automation guidance"
    - "Add container HEALTHCHECK to Dockerfiles"
    - "Re-enable external model tests or create a periodic CI job for them"
    - "Add mypy enforcement (currently all modules have ignore_errors = True)"
---

# Quality Analysis: red-hat-data-services/lm-evaluation-harness

## Executive Summary

- **Overall Score: 4.2/10**
- **Repository Type**: Python library — LLM evaluation framework (downstream fork of EleutherAI/lm-evaluation-harness)
- **Primary Language**: Python 3.11+
- **Jira**: RHOAIENG / AI Safety (downstream tier)
- **Key Strengths**: Sophisticated multi-stage, multi-arch Docker builds with Konflux/Tekton integration; good pre-commit hook setup with ruff and codespell; pytest with xdist parallelization
- **Critical Gaps**: Coverage not enforced in CI; linter job disabled; no dedicated E2E tests; no Dependabot; no agent rules
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 5.0/10 | 15% | 0.75 | Pytest + xdist but 6.9% test-to-code ratio |
| Integration/E2E | 3.0/10 | 20% | 0.60 | No dedicated E2E; model tests disabled |
| Build Integration | 6.0/10 | 15% | 0.90 | Tekton/Konflux multi-arch; not auto-triggered |
| Image Testing | 5.0/10 | 10% | 0.50 | Multi-stage builds, no runtime validation |
| Coverage Tracking | 2.0/10 | 10% | 0.20 | .coveragerc exists but CI never runs coverage |
| CI/CD Automation | 5.0/10 | 15% | 0.75 | Basic PR tests; linter+model tests disabled |
| Static Analysis | 5.0/10 | 10% | 0.50 | Pre-commit hooks exist; not enforced in CI |
| Agent Rules | 0.0/10 | 5% | 0.00 | No CLAUDE.md or .claude/ |
| **Overall** | **4.2/10** | **100%** | **4.20** | |

## Critical Gaps

### 1. Coverage Tracking Not Enforced in CI
- **Impact**: No visibility into test coverage trends; regressions in coverage go undetected and unchallenged
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: `.coveragerc` exists and `pytest-cov` is listed in dev dependencies, but the CI pytest command (`python -m pytest --showlocals -s -vv -n=auto`) does not include `--cov`. No codecov.yml or coveralls integration. No coverage thresholds. Coverage infrastructure is set up but never activated.

### 2. Linter and Task-Change Test Jobs Disabled in CI
- **Impact**: Code quality checks are completely bypassed; style issues, type errors, and codespell violations merge uncaught
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: In `unit_tests.yml`, the linter job has `if: false` which completely disables it. The pre-commit action step (which runs ruff, codespell, etc.) never executes. Similarly, `new_tasks.yml` has `if: false`, so task-change-triggered tests never run. The `testmodels` job for external LM tests is also disabled.

### 3. No Dedicated E2E or Integration Test Infrastructure
- **Impact**: Container startup failures, model-loading regressions, and deployment issues are only caught in production or manual testing
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: No `e2e/` or `integration/` directories. No cluster setup tests (Kind, Minikube). No testcontainers. No multi-version testing (only Python 3.11). The existing test_evaluator.py functions more as integration tests but runs with a mock dummy model, not real container infrastructure.

### 4. No Dependency Alert Configuration
- **Impact**: Vulnerable or outdated dependencies go unnoticed; the 250+ pinned dependencies in requirements.txt require manual tracking
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: No `.github/dependabot.yml`, no `renovate.json` or `.renovaterc`. With 250+ pinned dependencies in `requirements.txt` and a `poetry.lock`, automated dependency alerts are essential.

### 5. Tekton Build Pipeline Not Auto-Triggered
- **Impact**: Konflux build issues only caught when someone manually comments `/build-konflux` or applies a label
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: The Tekton PipelineRun in `.tekton/odh-ta-lmes-job-pull-request.yaml` is triggered via `on-comment: "^/build-konflux"` and `on-label: "[kfbuild-all, kfbuild-lm-evaluation-harness]"` — not automatically on every PR event.

## Quick Wins

### 1. Re-enable the Linter CI Job (30 minutes)
Remove `if: false` from the linter job in `.github/workflows/unit_tests.yml` to enforce pre-commit hooks (ruff, codespell, check-yaml, etc.) on every PR.

```yaml
# In .github/workflows/unit_tests.yml
jobs:
  linter:
    # Remove: if: false  # Disabled
    name: Linters
    runs-on: ubuntu-latest
    timeout-minutes: 5
```

### 2. Add Dependabot Configuration (1-2 hours)
Create `.github/dependabot.yml` covering pip and Docker ecosystems:

```yaml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
```

### 3. Add Coverage Reporting to CI (2-3 hours)
Add `--cov` flag to the pytest command and integrate with codecov:

```yaml
    - name: Test with pytest
      run: python -m pytest --showlocals -s -vv -n=auto --cov=lm_eval --cov-report=xml --ignore=tests/models/test_neuralmagic.py --ignore=tests/models/test_openvino.py --ignore=tests/models/test_hf_steered.py
    - name: Upload coverage
      uses: codecov/codecov-action@v4
      with:
        file: ./coverage.xml
        fail_ci_if_error: false
```

### 4. Add Concurrency Control (30 minutes)
Add concurrency group to prevent stale PR runs from wasting resources:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 5. Create Basic CLAUDE.md (2-3 hours)
Create a `CLAUDE.md` with project structure, test patterns, and contribution guidelines so AI agents generate tests consistent with the project's conventions.

## Detailed Findings

### Unit Tests

**Files Analyzed**: 24 test files in `tests/` directory (14 root-level + 10 model-specific in `tests/models/`)

**Framework**: pytest with pytest-xdist (parallel execution) and pytest-cov (coverage, unused)

**Test-to-Code Ratio**: 24 test files / 349 source files = **6.9%** (low; gold standard targets 30%+)

**Test Files**:
- `tests/test_evaluator.py` — Parametrized evaluation tests with dummy model
- `tests/test_cli.py` — CLI argument parsing tests
- `tests/test_tasks.py` — Task configuration validation
- `tests/test_task_manager.py` — Task manager with fixtures
- `tests/test_utils.py` — Utility function tests
- `tests/test_prompt.py` — Prompt formatting tests
- `tests/test_misc.py` — Miscellaneous helpers
- `tests/test_requests_caching.py` — Request caching with autouse fixture
- `tests/test_janitor.py` — Cleanup utility tests
- `tests/test_include_path.py` — Path inclusion tests
- `tests/test_job_spec_parameters_path.py` — Job spec parameter path validation (good monkeypatch usage)
- `tests/test_adapter_offline_inference.py` — Offline inference adapter tests
- `tests/test_evalhub_error_sanitize.py` — Error sanitization tests
- `tests/models/test_*.py` — Model-specific tests (8 files: huggingface, vllm, sglang, gguf, gptqmodel, api, openvino, neuralmagic, hf_steered)

**Test Isolation**:
- Uses `pytest.fixture` (autouse, module scope)
- Uses `monkeypatch` for path and env overrides
- Uses `unittest.mock.patch` for model mocking
- No shared `conftest.py` for cross-test fixtures

**Gaps**:
- Many source modules in `lm_eval/` have no corresponding test file (filters, loggers, caching, decontamination, prompts)
- `test_evaluator.py` acknowledges it needs "more fine grained unit tests"
- 3 model tests are excluded from CI: `test_neuralmagic.py`, `test_openvino.py`, `test_hf_steered.py`

### Integration/E2E Tests

**No dedicated integration or E2E test infrastructure.**

- No `e2e/`, `integration/`, or `test/e2e/` directories
- No Kubernetes cluster setup (Kind, Minikube, envtest)
- No testcontainers usage for container-level testing
- No docker-compose test configuration
- No multi-version testing (single Python 3.11 in CI matrix)
- External model tests job (`testmodels`) is disabled with `if: false`
- The `new_tasks.yml` workflow (task-change-triggered tests) is also disabled with `if: false`

**What exists**: `test_evaluator.py` functions as a lightweight integration test by running evaluation pipelines end-to-end with a dummy model, but it doesn't test the containerized deployment scenario.

### Build Integration

**Strengths**:
- **Tekton/Konflux pipeline**: `.tekton/odh-ta-lmes-job-pull-request.yaml` defines a PipelineRun for PR builds
- **Multi-arch builds**: Supports x86_64, arm64 (linux-m2xlarge), ppc64le, s390x
- **Multi-stage Dockerfiles**: 5-stage builds (builder → arrow-builder → torch-builder → openblas-builder → final-build)
- **Dedicated Konflux Dockerfile**: `Dockerfile.konflux.lmes-job` with Konflux-specific optimizations (reads versions from requirements.txt instead of hardcoding)
- **Image expiry**: PR images expire after 5 days
- **Pipeline cancel-in-progress**: `pipelinesascode.tekton.dev/cancel-in-progress: "true"`
- **Cert preflight checks**: ecosystem-cert-preflight-checks task included

**Weaknesses**:
- Tekton pipeline triggered only on `/build-konflux` comment or `kfbuild-*` label, not automatically
- No Docker build step in GitHub Actions PR workflow
- No `kubectl apply --dry-run` or manifest validation
- No image startup testing after build
- Publish workflow only triggers on tags, no release validation

### Image Testing

**Dockerfile Quality** (Dockerfile.lmes-job, Dockerfile.konflux.lmes-job):
- Multi-stage builds with 5 stages for efficient layering
- UBI9 base images (`registry.access.redhat.com/ubi9/python-311:latest`) — FIPS-capable
- Architecture-conditional builds with `$TARGETARCH`
- Non-root user (`USER 65532:65532` for runtime)
- License file inclusion
- `.dockerignore` present (excludes __pycache__, .git, .venv, .tekton)
- Pinned requirements.txt for reproducible builds
- Mount cache for torch/arrow wheels
- s390x-specific patches for parquet support

**Gaps**:
- No `HEALTHCHECK` instruction in either Dockerfile
- No runtime validation tests (container startup, model import, endpoint readiness)
- No testcontainers or docker-compose test setup
- No readiness/liveness probe definitions (though this is a batch job, not a long-running service)

### Coverage Tracking

**Configuration exists but is not active**:
- `.coveragerc` present with run omissions and report exclusion patterns
- `pytest-cov==6.0.0` listed in dev and testing dependencies
- `testing` extra: `["pytest==8.3.3", "pytest-cov==6.0.0", "pytest-xdist==3.6.1"]`

**Not enforced**:
- CI pytest command: `python -m pytest --showlocals -s -vv -n=auto` (no `--cov` flag)
- No `.codecov.yml` or `codecov.yml`
- No coverage thresholds in any configuration
- No PR coverage reporting
- No coverage gate enforcement

### CI/CD Automation

**Workflows** (3 total in `.github/workflows/`):

| Workflow | Trigger | Status |
|----------|---------|--------|
| `unit_tests.yml` | PR to main/release-*, push to main | **Partially active** (linter disabled) |
| `new_tasks.yml` | PR/push to main | **Disabled** (`if: false`) |
| `publish.yml` | Tag push | Active |

**Active features**:
- Pip caching via `actions/setup-python` cache
- pytest-xdist parallel execution (`-n=auto`)
- Timeout controls (5 min linter, 30 min tests)
- Test artifact archiving
- Workflow dispatch support

**Disabled features**:
- Linter job (pre-commit action with ruff, codespell)
- Task-change-triggered testing
- External model testing
- mypy type checking (commented out even in pre-commit)

**Missing features**:
- No concurrency control (concurrent runs can pile up)
- No scheduled/periodic CI runs
- No Python version matrix (only 3.11, despite supporting 3.11-3.12)
- No dependency caching beyond pip

### Static Analysis

#### Linting
- **flake8**: `.flake8` configured with max-complexity=10, max-line-length=127
- **ruff**: Configured in pre-commit hooks (`ruff` linter + `ruff-format`), but pre-commit is not enforced in CI
- **mypy**: `mypy.ini` has strict options but all modules have `ignore_errors = True`, making it effectively disabled
- **codespell**: Configured in pre-commit hooks

#### Pre-commit Hooks
`.pre-commit-config.yaml` includes:
- `pre-commit-hooks` v5.0.0: check-added-large-files, check-ast, check-yaml, detect-private-key, etc.
- `ruff-pre-commit` v0.9.3: ruff linter (with --fix) and formatter
- `codespell` v2.4.1: spell checking
- Local hook: `generate_dataset_table.py` for benchmark mapping docs

Pre-commit hooks are well-configured but the CI job that runs them is disabled.

#### FIPS Compatibility
- **Source code**: No FIPS-problematic crypto imports found (no hashlib.md5, Crypto.Cipher.DES, etc.)
- **Base images**: Uses `registry.access.redhat.com/ubi9/python-311:latest` — FIPS-capable UBI9 images
- **Assessment**: Good FIPS posture — clean source and FIPS-capable base images

#### Dependency Alerts
- **No Dependabot configuration** (`.github/dependabot.yml` absent)
- **No Renovate configuration** (`renovate.json`, `.renovaterc` absent)
- With 250+ pinned dependencies in `requirements.txt`, automated dependency alerts are critical

### Agent Rules

**Status**: Missing

- No `CLAUDE.md` or `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` for test creation rules
- No `.claude/skills/` for custom skills
- `CODEOWNERS` file exists but references upstream EleutherAI maintainers

**Recommendation**: Generate test rules with `/test-rules-generator` to establish pytest conventions, fixture patterns, monkeypatch usage, and model mocking standards.

## Recommendations

### Priority 0 (Critical)

1. **Re-enable linter CI job** — Remove `if: false` from the linter job in `unit_tests.yml`. The pre-commit hooks (ruff, codespell) are already configured and ready; they just need to run in CI.

2. **Add coverage tracking to CI** — Add `--cov=lm_eval --cov-report=xml` to the pytest command, integrate codecov, and set an initial coverage threshold. The .coveragerc and pytest-cov are already in place.

3. **Configure Dependabot** — Create `.github/dependabot.yml` covering pip, docker, and github-actions ecosystems. With 250+ pinned dependencies, automated vulnerability alerts are essential.

### Priority 1 (High Value)

4. **Build integration tests for container image** — Create tests that build the Docker image, verify it starts, and confirm `lm_eval` can be imported. Consider testcontainers or a simple `docker build && docker run` step in CI.

5. **Enable multi-version Python testing** — Expand the CI matrix to test Python 3.11 and 3.12, matching the `requires-python = ">=3.11,<3.13"` specification.

6. **Auto-trigger Tekton builds on PRs** — Change the Tekton pipeline trigger from comment/label-based to automatic on PR events, or add a GitHub Actions step that builds the Docker image.

7. **Add concurrency control** — Add `concurrency: group/cancel-in-progress` to `unit_tests.yml` to prevent stale runs.

### Priority 2 (Nice-to-Have)

8. **Create CLAUDE.md and .claude/rules/** — Document test patterns, pytest conventions, fixture usage, and model mocking standards for AI agent consistency.

9. **Add HEALTHCHECK to Dockerfiles** — While this is a batch job, a health check can still validate the Python environment is functional.

10. **Re-enable external model tests** — Either re-enable the `testmodels` job or create a scheduled periodic workflow for model integration testing.

11. **Enforce mypy** — Gradually remove `ignore_errors = True` from mypy.ini modules and enable type checking in CI.

## Comparison to Gold Standards

| Feature | lm-evaluation-harness | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|---------|----------------------|---------------------|------------------|---------------|
| Unit test ratio | 6.9% | 40%+ | 25%+ | 35%+ |
| E2E tests | None | Cypress + API | Multi-layer | Ginkgo + envtest |
| Coverage enforcement | Not enforced | Codecov + thresholds | Thresholds | Codecov + gates |
| CI linting | Disabled | ESLint + prettier | Active | golangci-lint |
| Multi-version testing | Single (3.11) | Node matrix | Python matrix | Go + K8s matrix |
| Dependency alerts | None | Dependabot | Dependabot | Dependabot |
| Container testing | None | Build + startup | 5-layer validation | envtest |
| Agent rules | None | Comprehensive | Present | Present |
| Multi-arch builds | x86, arm64, ppc64le, s390x | x86, arm64 | x86, arm64 | x86, arm64 |
| Konflux integration | Tekton (manual trigger) | Tekton (auto) | Tekton (auto) | Tekton (auto) |
| FIPS compliance | Clean (UBI9 base) | UBI-based | UBI-based | UBI-based |

## File Paths Reference

### CI/CD
- `.github/workflows/unit_tests.yml` — Main PR test workflow (linter disabled)
- `.github/workflows/new_tasks.yml` — Task-change tests (fully disabled)
- `.github/workflows/publish.yml` — PyPI publish on tag
- `.tekton/odh-ta-lmes-job-pull-request.yaml` — Konflux build pipeline

### Testing
- `tests/test_*.py` — Unit/integration tests (14 files)
- `tests/models/test_*.py` — Model-specific tests (10 files)
- `tests/testconfigs/` — Test configuration files
- `tests/testdata/` — Test data fixtures
- `tests/testyamls/` — Test YAML fixtures

### Build & Container
- `Dockerfile.lmes-job` — Standard Docker build
- `Dockerfile.konflux.lmes-job` — Konflux-specific build
- `.dockerignore` — Docker build exclusions
- `patches/s390x/parquet-support.patch` — s390x-specific patch

### Code Quality
- `.flake8` — Flake8 linting configuration
- `mypy.ini` — Type checking (all errors ignored)
- `.pre-commit-config.yaml` — Pre-commit hooks (ruff, codespell)
- `.coveragerc` — Coverage exclusion patterns

### Project Configuration
- `pyproject.toml` — Package metadata, dependencies
- `requirements.txt` — Pinned dependencies (250+)
- `poetry.lock` — Poetry lockfile
- `setup.py` — Legacy build configuration
- `CODEOWNERS` — Code ownership
