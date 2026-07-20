---
repository: "red-hat-data-services/fms-hf-tuning"
overall_score: 4.5
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Good pytest coverage with parametrization across 4 Python versions"
  - dimension: "Integration/E2E"
    score: 2.0
    status: "No integration or E2E test suites; GPU tests exist but are not automated in CI"
  - dimension: "Build Integration"
    score: 5.0
    status: "Tekton/Konflux pipelines configured; PR image builds only via /build comment"
  - dimension: "Image Testing"
    score: 4.0
    status: "Multi-stage UBI9 builds but minimal runtime validation"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "Coverage generated but no thresholds, no codecov integration, no PR gates"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "Good workflow inventory but missing concurrency, caching, and timeouts"
  - dimension: "Static Analysis"
    score: 7.0
    status: "pylint + pre-commit (black/isort) + Dependabot; no type checker"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No integration or E2E test suite"
    impact: "End-to-end training workflows not validated; GPU-dependent tests not automated in CI"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "Coverage tracking without enforcement"
    impact: "Coverage is generated but never gates PRs — regressions go unnoticed"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No automatic PR-time image build"
    impact: "Docker build failures discovered only after merge or via manual /build comment"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No concurrency control or job timeouts in CI"
    impact: "Redundant workflow runs waste resources; hung jobs block queues indefinitely"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "Missing agent rules for test creation"
    impact: "AI agents lack guidance on test patterns, fixtures, and project conventions"
    severity: "MEDIUM"
    effort: "3-4 hours"
quick_wins:
  - title: "Add codecov integration with PR coverage gates"
    effort: "2-4 hours"
    impact: "Automatic coverage reporting and regression prevention on every PR"
  - title: "Add concurrency control and timeouts to all workflows"
    effort: "1-2 hours"
    impact: "Cancel redundant runs, prevent hung jobs from blocking CI"
  - title: "Promote PR image build from /build comment to automatic"
    effort: "2-3 hours"
    impact: "Catch Dockerfile breakage on every PR, not just when someone remembers to type /build"
  - title: "Add coverage fail_under threshold"
    effort: "1 hour"
    impact: "Prevent coverage regressions from being merged"
  - title: "Create basic CLAUDE.md with testing conventions"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality and consistency"
recommendations:
  priority_0:
    - "Add codecov/coveralls integration with PR reporting and fail_under thresholds"
    - "Make Docker image build automatic on every PR (move from /build comment trigger to pull_request trigger)"
    - "Add concurrency control and timeout-minutes to all CI workflows"
  priority_1:
    - "Create an integration/E2E test suite that validates end-to-end training on a small model"
    - "Add caching for pip dependencies in CI workflows"
    - "Add type checking with mypy or pyright to the lint pipeline"
    - "Create comprehensive agent rules for test automation (.claude/rules/)"
    - "Add conftest.py with shared fixtures to reduce test setup duplication"
  priority_2:
    - "Add HEALTHCHECK to Dockerfiles"
    - "Add multi-architecture image builds (amd64, arm64)"
    - "Add Testcontainers-based runtime validation for built images"
    - "Add GPU-based CI runner for acceleration and training tests"
---

# Quality Analysis: red-hat-data-services/fms-hf-tuning

## Executive Summary
- **Overall Score: 4.5/10**
- **Repository Type**: Python library for HuggingFace model fine-tuning (downstream fork of `foundation-model-stack/fms-hf-tuning`)
- **Primary Language**: Python (105 files)
- **Jira**: RHOAIENG / Training Kubeflow (downstream tier)
- **Key Strengths**: Good unit test patterns with pytest parametrization, multi-Python-version testing, UBI9 base images, Dependabot enabled, pre-commit hooks with black/isort
- **Critical Gaps**: No E2E tests, no coverage enforcement, no automatic PR image builds, no agent rules
- **Agent Rules Status**: Missing

## Quality Scorecard
| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 7/10 | 15% | 1.05 | Good pytest coverage with parametrization across 4 Python versions |
| Integration/E2E | 2/10 | 20% | 0.40 | No integration or E2E test suites; GPU tests exist but not automated |
| Build Integration | 5/10 | 15% | 0.75 | Tekton/Konflux pipelines configured; PR builds only via /build comment |
| Image Testing | 4/10 | 10% | 0.40 | Multi-stage UBI9 builds but minimal runtime validation |
| Coverage Tracking | 3/10 | 10% | 0.30 | Coverage generated but no thresholds, no codecov, no PR gates |
| CI/CD Automation | 6/10 | 15% | 0.90 | Good workflow inventory but missing concurrency, caching, timeouts |
| Static Analysis | 7/10 | 10% | 0.70 | pylint + pre-commit (black/isort) + Dependabot; no type checker |
| Agent Rules | 0/10 | 5% | 0.00 | No CLAUDE.md, AGENTS.md, or .claude/ directory |
| **Overall** | **4.5/10** | | **4.50** | |

## Critical Gaps

### 1. No Integration or E2E Test Suite
- **Impact**: End-to-end training workflows are never validated in CI. GPU-dependent test envs (`tox -e gpu`, `tox -e accel`) exist but are not automated.
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: The `tests/` directory contains only unit tests. There are no `e2e/`, `integration/`, or similar directories. While `tox.ini` defines `gpu` and `accel` environments, these require GPU hardware and are never triggered in CI workflows. The core training workflow (`sft_trainer.py → accelerate_launch.py → model output`) has no end-to-end validation.

### 2. Coverage Tracking Without Enforcement
- **Impact**: Coverage is generated via `tox -e coverage` on every PR, but there are no thresholds (`fail_under`), no codecov/coveralls integration, and no PR comments showing coverage changes. Regressions go unnoticed.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The `coverage.yaml` workflow runs `tox -e coverage` which generates a coverage report and XML, plus a badge via `genbadge`. But the workflow doesn't fail on low coverage, doesn't upload to codecov, and doesn't comment on PRs.

### 3. No Automatic PR-Time Image Build
- **Impact**: Docker build failures are discovered only after merge (Konflux/Tekton) or when a reviewer manually types `/build` in a PR comment. This delays failure detection.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The `pr-command.yaml` workflow builds a Docker image only when triggered by a `/build` comment. The `image.yaml` workflow builds only on push to `main`. The `release-image.yaml` builds on PR to `release` branch but not `main`. Tekton pipelines run Konflux builds on PRs but these are separate from the GitHub Actions CI.

### 4. No Concurrency Control or Job Timeouts
- **Impact**: Pushing multiple commits to a PR triggers redundant workflow runs that waste CI resources. Long-running or hung jobs have no timeout and block the queue indefinitely.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: None of the 12 workflows define `concurrency:` groups or `timeout-minutes:`. The test matrix (4 Python versions) multiplies this waste.

### 5. Missing Agent Rules
- **Impact**: AI coding assistants have no context on test patterns, pytest conventions, fixture usage, or project structure when generating code or tests.
- **Severity**: MEDIUM
- **Effort**: 3-4 hours

## Quick Wins

### 1. Add Codecov Integration with PR Coverage Gates
- **Effort**: 2-4 hours
- **Impact**: Automatic coverage reporting and regression prevention on every PR
- **Implementation**:
  ```yaml
  # Add to .github/workflows/coverage.yaml after "Check Coverage" step:
  - name: Upload coverage to Codecov
    uses: codecov/codecov-action@v4
    with:
      files: ./coverage.xml
      flags: unittests
      fail_ci_if_error: true
      token: ${{ secrets.CODECOV_TOKEN }}
  ```
  ```yaml
  # Create .codecov.yml
  coverage:
    status:
      project:
        default:
          target: 70%
          threshold: 2%
      patch:
        default:
          target: 60%
  ```

### 2. Add Concurrency Control and Timeouts
- **Effort**: 1-2 hours
- **Impact**: Cancel redundant runs, prevent hung jobs
- **Implementation**: Add to each workflow:
  ```yaml
  concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: true

  jobs:
    build:
      timeout-minutes: 30
  ```

### 3. Promote PR Image Build to Automatic
- **Effort**: 2-3 hours
- **Impact**: Catch Dockerfile breakage on every PR automatically
- **Implementation**: Add a new workflow or modify `image.yaml`:
  ```yaml
  name: PR Image Build
  on:
    pull_request:
      branches: ["main"]
  jobs:
    build:
      runs-on: ubuntu-latest
      timeout-minutes: 45
      steps:
        - uses: actions/checkout@v4
        - uses: ./.github/actions/free-up-disk-space
        - name: Build UBI9 Image
          run: docker build -t fms-hf-tuning:pr-test -f build/Dockerfile .
        - name: Sanity check
          run: |
            docker run --rm --entrypoint which fms-hf-tuning:pr-test accelerate
            docker run --rm --entrypoint python fms-hf-tuning:pr-test -c "import tuning; print('OK')"
  ```

### 4. Add Coverage fail_under Threshold
- **Effort**: 1 hour
- **Impact**: Prevent coverage regressions from being merged
- **Implementation**: Update `tox.ini`:
  ```ini
  [testenv:coverage]
  commands =
      coverage run --omit=*/_version.py,*/launch_training.py --source=tuning,build --module pytest tests/
      coverage report -m --fail-under=70
      coverage xml
      genbadge coverage -s -i coverage.xml
  ```

### 5. Create Basic CLAUDE.md
- **Effort**: 2-3 hours
- **Impact**: Improve AI-generated test quality and consistency
- **Implementation**:
  ```markdown
  # CLAUDE.md

  ## Project
  Python library for HuggingFace SFT (Supervised Fine-Tuning) with accelerate.

  ## Testing Conventions
  - Framework: pytest
  - Tests in `tests/` mirroring `tuning/` structure
  - Use `@pytest.mark.parametrize` for data-driven tests
  - Use `@pytest.mark.skipif` for optional-dependency tests
  - Use `tempfile.TemporaryDirectory()` for output isolation
  - Run: `tox -e py` (unit), `tox -e coverage` (with coverage)

  ## Code Quality
  - Formatter: black (via pre-commit)
  - Import sorter: isort (profile=black)
  - Linter: pylint (see .pylintrc)
  - Run: `make fmt` then `make lint`
  ```

## Detailed Findings

### Unit Tests

**Status: Good (7/10)**

**Strengths:**
- 21 test files covering 48 source files (43% test-to-code ratio)
- pytest framework with good use of `@pytest.mark.parametrize` (20+ parametrized test sets in `tests/data/`)
- `@pytest.mark.skipif` for optional dependency tests (mlflow, clearml, aim, scanner)
- Session-scoped fixtures for expensive resources (`job_config`)
- Multi-Python version testing: 3.9, 3.10, 3.11, 3.12 via matrix strategy
- Well-organized test structure mirroring source: `tests/acceleration/`, `tests/build/`, `tests/data/`, `tests/trackers/`, `tests/trainercontroller/`, `tests/utils/`
- Comprehensive test data with predefined configs and artifacts in `tests/artifacts/`

**Test Coverage by Module:**
| Module | Test Files | Source Files | Coverage |
|--------|-----------|--------------|----------|
| acceleration | 2 | (external) | Partial |
| build | 2 | 3 | Good |
| data | 2 | 8 | Moderate |
| trackers | 6 | 7 | Good |
| trainercontroller | 1 | 12 | Weak |
| utils | 7 | 7 | Good |
| trainers | 0 | 1 | None |
| root (sft_trainer) | 1 | 1 | Good |

**Gaps:**
- No `conftest.py` with shared fixtures — setup is duplicated across test files
- `tuning/trainers/` has no test file (sum_loss_sft_trainer.py untested)
- `tuning/trainercontroller/` has 12 source files but only 1 test file
- No test isolation markers (no parallel execution directives)

### Integration/E2E Tests

**Status: Critical Gap (2/10)**

**Current State:**
- No `e2e/`, `integration/`, or similar directories
- `tox.ini` defines `[testenv:gpu]` and `[testenv:accel]` environments but these are not run in CI
- No end-to-end training validation (model load → fine-tune → checkpoint → inference)
- The `/build` PR command builds an image but runs no functional tests against it

**What Exists:**
- `test_sft_trainer.py` performs some training runs with tiny models but these are closer to unit tests than E2E tests
- `tests/build/test_launch_script.py` tests the launch script but is partially deprecated (`@pytest.mark.skipif(True, reason="This test is deprecated so always skipped")`)
- GPU-dependent test infrastructure exists in `tox.ini` but has no CI runner

**Recommendations:**
1. Create `tests/e2e/` with end-to-end training workflow tests using small models
2. Add a CI workflow with GPU runners (or use mock GPU context) for acceleration tests
3. Add post-image-build functional tests that validate the training entrypoint works

### Build Integration

**Status: Moderate (5/10)**

**Strengths:**
- Tekton/Konflux pipelines in `.tekton/`:
  - `fms-hf-tuning-pull-request.yaml`: Builds Docker image on PRs to `main`
  - `fms-hf-tuning-push.yaml`: Builds on push to `main`
  - `fms-hf-tuning-patch-release-push.yaml`: Builds on tag pushes
- `/build` PR command triggers image build via `pr-command.yaml`
- `/merge` PR command for maintainer-driven merges
- `monitor-tags.yaml`: Hourly sync of upstream tags with automatic Tekton file injection
- `push-upstream-tag.yaml`: Ensures Tekton files are present in synced tags

**Gaps:**
- GitHub Actions do **not** automatically build Docker images on PRs to `main` — only on `/build` comment or Tekton (separate system)
- `image.yaml` runs basic sanity (`docker run --entrypoint which accelerate`) only on push to `main`, not PRs
- No `kustomize` validation (not applicable for a library)
- Upstream tag sync workflow (`monitor-tags.yaml`) has no error notification mechanism

### Image Testing

**Status: Weak (4/10)**

**Strengths:**
- Two well-structured Dockerfiles:
  - `build/Dockerfile`: Multi-stage build (5 stages: base → release-base → cuda-base → cuda-devel → python-installations → release)
  - `build/nvcr.Dockerfile`: NVCR-based build (2 stages: builder → runtime)
- UBI9 base image (`registry.access.redhat.com/ubi9/ubi`) — FIPS-capable
- Non-root user (`tuning`, UID 1000) in UBI Dockerfile
- Conditional optional dependencies via build ARGs (ENABLE_AIM, ENABLE_MLFLOW, etc.)
- Build cache mounts (`--mount=type=cache`) for pip in UBI Dockerfile
- CVE reduction: release-base stage strips python/dnf packages

**Gaps:**
- No HEALTHCHECK in either Dockerfile
- Only one basic sanity check: `docker run --entrypoint which "$IMAGE_NAME" accelerate`
- No Testcontainers or structured runtime validation
- No multi-architecture support (amd64 only)
- nvcr.Dockerfile runs as root (no non-root USER directive in runtime stage)
- No image size optimization tracking

### Coverage Tracking

**Status: Weak (3/10)**

**Current State:**
- `coverage.yaml` workflow runs on push/PR to `main`
- `tox -e coverage` runs: `coverage run` → `coverage report -m` → `coverage xml` → `genbadge coverage`
- Omits: `_version.py`, `launch_training.py`
- Source tracking: `tuning/` and `build/`

**Gaps:**
- **No codecov or coveralls integration** — coverage data is generated but never uploaded or displayed on PRs
- **No fail_under threshold** — PRs can reduce coverage to any level without failure
- **No PR coverage comments** — reviewers don't see coverage impact
- **No per-module coverage targets** — some modules may have near-zero coverage
- Coverage badge generated by `genbadge` but not displayed (no badge in README pointing to it)

### CI/CD Automation

**Status: Adequate (6/10)**

**Workflow Inventory:**
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yaml` | PR/push to main/release | Unit tests (4 Python versions) |
| `coverage.yaml` | PR/push to main | Coverage report |
| `format.yml` | PR/push to main/release | Black + isort + pylint |
| `labelpr.yaml` | PR opened/edited | Conventional commit label |
| `image.yaml` | Push to main | Build NVCR image + basic sanity |
| `release-image.yaml` | PR/push to release | Build UBI9 prod image |
| `staging-image.yaml` | Tag/release | Build staging NVCR image |
| `build-and-publish.yaml` | Release published | Build + publish to PyPI |
| `pr-command.yaml` | PR comment /build or /merge | On-demand image build or merge |
| `monitor-tags.yaml` | Hourly cron | Sync upstream tags |
| `push-upstream-tag.yaml` | Manual dispatch | Push tag with Tekton files |

**Strengths:**
- Good coverage of the development lifecycle (test, lint, build, release, publish)
- Multi-Python version matrix (3.9-3.12) in test workflow
- Conventional commit enforcement via `labelpr.yaml`
- Free-up-disk-space custom action to handle large ML dependencies
- Tag monitoring for upstream sync

**Gaps:**
- **No concurrency control** on any workflow — pushing 3 commits triggers 3 full test matrix runs
- **No pip caching** — every run installs tox and dependencies from scratch
- **No timeout-minutes** — long-running ML test jobs can hang indefinitely
- **No workflow status badges** in README
- Test workflow doesn't use `free-up-disk-space` action (may run out of space with ML dependencies)

### Static Analysis

**Status: Good (7/10)**

#### Linting
- **pylint** configured with comprehensive `.pylintrc` (detailed rules)
- Runs on every PR via `tox -e lint` in `format.yml`
- Covers: `tuning/`, `scripts/*.py`, `build/*.py`, `tests/`

#### Formatting
- **black** (code formatter) via pre-commit hooks
- **isort** (import sorter) with `profile=black` and first-party detection
- `scripts/fmt.sh` runs `pre-commit run --all-files`
- Formatting checked in CI via `tox -e fmt` in `format.yml`

#### FIPS Compatibility
- **No FIPS issues found** in source code — no non-FIPS crypto imports detected
- UBI9 base image is FIPS-capable
- nvcr.io base image is not FIPS-certified (NVIDIA container)
- No FIPS build tags needed (Python library, not Go)

#### Dependency Alerts
- **Dependabot configured** (`.github/dependabot.yml`) for pip ecosystem with daily updates
- Missing: Docker ecosystem coverage, GitHub Actions ecosystem coverage
- No Renovate configuration

**Gaps:**
- **No type checking** (mypy, pyright) — type errors not caught before merge
- **No ruff** — could replace/supplement pylint with faster execution
- pre-commit hooks are outdated: black 22.3.0 (current is 24.x), isort 5.11.5 (current is 5.13.x)
- Dependabot only covers pip, not Docker or GitHub Actions

### Agent Rules

**Status: Missing (0/10)**

**Current State:**
- No `CLAUDE.md` or `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` for test creation guidance
- No custom skills defined

**Impact:**
When AI agents are asked to generate tests or code for this codebase, they lack context on:
- pytest conventions (parametrize, skipif patterns)
- Fixture patterns (session-scoped for expensive resources)
- Test data management (`tests/artifacts/` with predefined configs)
- Module structure and naming conventions
- Optional dependency handling in tests
- tox environment usage

**Recommendations:**
1. Create `CLAUDE.md` with project overview and testing conventions
2. Create `.claude/rules/unit-tests.md` with pytest patterns specific to this project
3. Use `/test-rules-generator` to bootstrap comprehensive agent rules

## Recommendations

### Priority 0 (Critical)
1. **Add codecov integration with PR reporting and fail_under thresholds** — Coverage data exists but is never enforced. Add `codecov/codecov-action` to `coverage.yaml` and set `fail_under=70` in `tox.ini`.
2. **Make Docker image build automatic on every PR** — Move from `/build` comment trigger to `pull_request` trigger. Add basic sanity checks (import test, entrypoint validation).
3. **Add concurrency control and timeout-minutes to all CI workflows** — Prevent resource waste and hung jobs.

### Priority 1 (High Value)
4. **Create an integration/E2E test suite** — Add `tests/e2e/` with end-to-end training validation using a tiny model. Even without GPU, validate the full pipeline: config parsing → data loading → model loading → training loop (1 step) → checkpoint saving.
5. **Add pip caching in CI workflows** — Use `actions/setup-python` with `cache: pip` or `actions/cache` for `~/.cache/pip` to speed up CI.
6. **Add type checking with mypy** — Python library with complex config dataclasses benefits significantly from type checking.
7. **Create comprehensive agent rules** — Add `.claude/rules/` with pytest patterns, fixture conventions, and project-specific test data management.
8. **Add conftest.py with shared fixtures** — Reduce test setup duplication (model loading, tokenizer creation, temp directories).

### Priority 2 (Nice-to-Have)
9. **Add HEALTHCHECK to Dockerfiles** — Enable container orchestrators to monitor health.
10. **Add multi-architecture image builds** — Support arm64 in addition to amd64.
11. **Upgrade pre-commit hook versions** — black 22.3.0 → 24.x, isort 5.11.5 → 5.13.x.
12. **Expand Dependabot coverage** — Add `docker` and `github-actions` ecosystems.
13. **Add GPU CI runner** — Automate `tox -e gpu` and `tox -e accel` tests.

## Comparison to Gold Standards

| Dimension | fms-hf-tuning | odh-dashboard | notebooks | kserve | Gap |
|-----------|---------------|---------------|-----------|--------|-----|
| Unit Tests | 7/10 | 9/10 | 8/10 | 8/10 | -2 (Add conftest, cover trainers/) |
| Integration/E2E | 2/10 | 10/10 | 7/10 | 9/10 | -8 (Create E2E suite) |
| Build Integration | 5/10 | 9/10 | 8/10 | 4/10 | -4 (Auto PR builds) |
| Image Testing | 4/10 | 7/10 | 10/10 | 6/10 | -6 (Runtime validation) |
| Coverage Tracking | 3/10 | 9/10 | 8/10 | 8/10 | -6 (Codecov + thresholds) |
| CI/CD Automation | 6/10 | 9/10 | 8/10 | 9/10 | -3 (Caching, concurrency) |
| Static Analysis | 7/10 | 9/10 | 8/10 | 7/10 | -2 (Type checking) |
| Agent Rules | 0/10 | 8/10 | 6/10 | 2/10 | -8 (Create from scratch) |

**Key Takeaways:**
- **Biggest gaps**: Integration/E2E (2/10) and Agent Rules (0/10) — these are the areas with the most room for improvement
- **Second tier gaps**: Coverage Tracking (3/10) and Image Testing (4/10) — quick wins available
- **Relative strengths**: Unit Tests (7/10) and Static Analysis (7/10) show solid foundations
- **Unique challenge**: As an ML training library, E2E testing requires GPU resources, making this more complex than typical K8s operator testing

## File Paths Reference

### CI/CD
- `.github/workflows/test.yaml` — Unit test workflow (4 Python versions)
- `.github/workflows/coverage.yaml` — Coverage report workflow
- `.github/workflows/format.yml` — Black + isort + pylint workflow
- `.github/workflows/image.yaml` — NVCR image build on push to main
- `.github/workflows/release-image.yaml` — UBI9 prod image build
- `.github/workflows/staging-image.yaml` — Staging NVCR image build
- `.github/workflows/build-and-publish.yaml` — PyPI publish on release
- `.github/workflows/pr-command.yaml` — /build and /merge PR commands
- `.github/workflows/labelpr.yaml` — Conventional commit label enforcement
- `.github/workflows/monitor-tags.yaml` — Hourly upstream tag sync
- `.github/workflows/push-upstream-tag.yaml` — Tag push with Tekton files

### Tekton/Konflux
- `.tekton/fms-hf-tuning-pull-request.yaml` — Konflux PR build pipeline
- `.tekton/fms-hf-tuning-push.yaml` — Konflux push build pipeline
- `.tekton/fms-hf-tuning-patch-release-push.yaml` — Konflux release build

### Testing
- `tests/test_sft_trainer.py` — Core trainer unit tests
- `tests/acceleration/` — Acceleration framework tests
- `tests/build/` — Build script and launch tests
- `tests/data/` — Data handlers and preprocessing tests
- `tests/trackers/` — Tracker integration tests (aim, mlflow, clearml, etc.)
- `tests/trainercontroller/` — Trainer controller tests
- `tests/utils/` — Utility function tests
- `tests/artifacts/` — Test data and predefined configs

### Code Quality / Static Analysis
- `.pylintrc` — Comprehensive pylint configuration
- `.pre-commit-config.yaml` — Black + isort hooks
- `.isort.cfg` — Import sorting configuration
- `.github/dependabot.yml` — Pip dependency alerts (daily)

### Container Images
- `build/Dockerfile` — Multi-stage UBI9 production Dockerfile
- `build/nvcr.Dockerfile` — NVCR-based development Dockerfile
- `build/accelerate_launch.py` — Container entrypoint script
- `build/utils.py` — Build utilities

### Configuration
- `pyproject.toml` — Package metadata, dependencies, build config
- `pytest.ini` — Pytest configuration
- `tox.ini` — Tox environments (py, fmt, lint, coverage, gpu, accel)
- `Makefile` — Convenience targets (test, fmt, lint)

### Agent Rules
- `CLAUDE.md` — **Missing** (needs creation)
- `.claude/rules/unit-tests.md` — **Missing** (needs creation)
- `.claude/rules/e2e-tests.md` — **Missing** (needs creation)
