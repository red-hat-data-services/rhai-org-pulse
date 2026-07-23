---
repository: "SeldonIO/MLServer"
overall_score: 4.5
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Strong pytest suite with 103 test files, async support, parametrize, and per-runtime test isolation"
  - dimension: "Integration/E2E"
    score: 5.0
    status: "Integration-style tests for REST/gRPC/Kafka/CLI but no proper E2E deployment testing"
  - dimension: "Build Integration"
    score: 3.0
    status: "No PR-time Docker build validation; image builds only happen at release time"
  - dimension: "Image Testing"
    score: 4.0
    status: "Multi-stage Dockerfile with UBI9 base but no runtime validation or multi-arch support"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tooling configured — no codecov, no pytest-cov, no thresholds"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "PR-triggered tests with Python version matrix but no caching, concurrency, or timeouts"
  - dimension: "Static Analysis"
    score: 6.0
    status: "flake8, mypy, black configured; Dependabot for all runtimes; no pre-commit hooks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory — zero AI agent guidance"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Regressions in test coverage go undetected; no visibility into which code paths are untested"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No PR-time Docker image build validation"
    impact: "Image build failures discovered only at release time, causing release delays"
    severity: "HIGH"
    effort: "6-8 hours"
  - title: "No E2E deployment testing"
    impact: "Integration issues between MLServer and K8s/KServe discovered only in production environments"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No CI caching or concurrency control"
    impact: "Slow CI feedback loops; redundant workflow runs waste resources"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No container health checks or runtime validation"
    impact: "Image startup failures and runtime issues not caught until deployment"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add pytest-cov and codecov integration"
    effort: "4-6 hours"
    impact: "Immediate visibility into test coverage with PR-level reporting and threshold enforcement"
  - title: "Add concurrency control and caching to CI workflows"
    effort: "2-3 hours"
    impact: "Faster CI feedback, reduced resource waste from redundant workflow runs"
  - title: "Add pre-commit hooks for flake8, mypy, black"
    effort: "1-2 hours"
    impact: "Catch formatting and type issues locally before pushing to CI"
  - title: "Add timeout-minutes to all CI jobs"
    effort: "30 minutes"
    impact: "Prevent hung jobs from consuming CI resources indefinitely"
  - title: "Create basic CLAUDE.md with test patterns"
    effort: "2-3 hours"
    impact: "Guide AI agents to generate consistent, framework-appropriate tests"
recommendations:
  priority_0:
    - "Add pytest-cov to tox.ini and CI workflows with coverage threshold enforcement (target: 70%)"
    - "Add PR-time Docker image build validation in tests.yml workflow"
    - "Add HEALTHCHECK instruction to Dockerfile and container startup validation in CI"
  priority_1:
    - "Create E2E test suite that deploys MLServer in a container and validates inference endpoints"
    - "Add concurrency control, pip/poetry caching, and timeout-minutes to all CI workflows"
    - "Add multi-architecture Docker build support (amd64/arm64) using docker buildx"
    - "Add pre-commit hooks configuration (.pre-commit-config.yaml)"
  priority_2:
    - "Create CLAUDE.md and .claude/rules/ with test creation guidelines"
    - "Migrate from flake8 to ruff for faster, more comprehensive linting"
    - "Add Dependabot configuration for GitHub Actions ecosystem"
    - "Move benchmark tests to PR-triggered (at least on specific paths)"
---

# Quality Analysis: SeldonIO/MLServer

## Executive Summary

- **Overall Score: 4.5/10**
- **Repository Type**: Python ML inference server library with multiple runtime backends
- **Primary Language**: Python (348 .py files)
- **Framework**: FastAPI (REST) + gRPC, KFServing V2 Dataplane compliant
- **Package Manager**: Poetry with tox for test orchestration
- **RHOAI Component**: Model Runtimes (RHOAIENG)
- **Tier**: Upstream

**Key Strengths:**
- Solid unit test infrastructure with pytest, 103 test files across core and 9 ML runtime backends
- Well-organized test structure with per-runtime isolation via tox
- Multi-Python-version matrix testing (3.9-3.12) on PRs
- Comprehensive Dependabot coverage for all runtime directories
- UBI9 base image with multi-stage Docker build

**Critical Gaps:**
- **Zero coverage tracking** — no codecov, no pytest-cov, no coverage thresholds anywhere
- **No PR-time image build** — Docker builds only happen at release time
- **No E2E deployment testing** — no Kind/Minikube/container deployment tests
- **No CI caching or concurrency** — slow feedback loops, wasted resources
- **No agent rules** — zero guidance for AI-assisted development

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 7.0/10 | 15% | 1.05 | Strong pytest suite with async, parametrize, per-runtime tests |
| Integration/E2E | 5.0/10 | 20% | 1.00 | Integration-style tests exist but no deployment E2E |
| Build Integration | 3.0/10 | 15% | 0.45 | No PR-time build validation; release-only Docker builds |
| Image Testing | 4.0/10 | 10% | 0.40 | Multi-stage UBI9 Dockerfile but no runtime validation |
| Coverage Tracking | 1.0/10 | 10% | 0.10 | No coverage tooling configured at all |
| CI/CD Automation | 6.0/10 | 15% | 0.90 | Matrix testing on PRs but no caching/concurrency |
| Static Analysis | 6.0/10 | 10% | 0.60 | flake8+mypy+black with Dependabot; no pre-commit |
| Agent Rules | 0.0/10 | 5% | 0.00 | No AI agent guidance whatsoever |
| **Overall** | **4.5/10** | **100%** | **4.50** | |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Severity**: HIGH
- **Impact**: Test coverage regressions go completely undetected. No visibility into which code paths lack testing. Contributors can merge code with zero test coverage.
- **Evidence**: No `.codecov.yml`, no `pytest-cov` in any dependency group, no `--cov` flags in tox.ini or CI workflows, no `.coveragerc` configuration.
- **Effort**: 4-6 hours
- **Fix**: Add `pytest-cov` to dev dependencies, configure `.coveragerc`, add `codecov/codecov-action` to tests.yml, set minimum coverage threshold.

### 2. No PR-Time Docker Image Build Validation
- **Severity**: HIGH
- **Impact**: Docker image build failures are only discovered at release time (via `workflow_dispatch` in `release.yml`). This can delay releases and require hotfixes. The Dockerfile is complex (multi-stage, Conda, multiple runtimes) and prone to breakage.
- **Evidence**: `tests.yml` (PR-triggered) has no Docker build step. `release.yml` and `release-sc.yml` are `workflow_dispatch` only. `security.yml` builds the image but only on push to master/release branches.
- **Effort**: 6-8 hours
- **Fix**: Add a Docker build job to `tests.yml` that builds the image on PR (without pushing).

### 3. No E2E Deployment Testing
- **Severity**: HIGH
- **Impact**: Integration issues between MLServer and its deployment environments (Kubernetes, KServe) are only discovered in production. No validation that the built container actually starts and serves inference requests correctly.
- **Evidence**: No `e2e/` or `integration/` test directories. No Kind/Minikube/envtest setup. No testcontainers usage. Benchmarks use a locally started server, not a containerized deployment.
- **Effort**: 16-24 hours
- **Fix**: Create E2E test suite using testcontainers or Kind that deploys MLServer and validates REST/gRPC inference endpoints.

### 4. No CI Caching or Concurrency Control
- **Severity**: MEDIUM
- **Impact**: Every CI run installs all dependencies from scratch. Multiple runs for the same PR accumulate rather than cancelling superseded runs. No timeout limits means hung jobs can consume resources indefinitely.
- **Evidence**: No `concurrency:` blocks in any workflow. No `cache:` actions for pip/poetry. No `timeout-minutes:` on any job.
- **Effort**: 2-4 hours
- **Fix**: Add `concurrency` groups, pip cache action, and `timeout-minutes` to all jobs.

### 5. No Container Health Checks or Runtime Validation
- **Severity**: MEDIUM
- **Impact**: The Dockerfile has no `HEALTHCHECK` instruction. No CI step validates that the built image starts successfully, responds to health probes, or serves correct predictions.
- **Evidence**: No `HEALTHCHECK` in Dockerfile. No `docker run` or health check validation in any workflow.
- **Effort**: 4-6 hours
- **Fix**: Add `HEALTHCHECK` to Dockerfile. Add a CI step that builds, starts, and validates the container.

## Quick Wins

### 1. Add pytest-cov and Codecov Integration (4-6 hours)
Add coverage measurement to the test suite and integrate with Codecov for PR reporting.

```toml
# pyproject.toml - add to dev dependencies
[tool.poetry.group.dev.dependencies]
pytest-cov = "5.0.0"

# Add coverage config
[tool.coverage.run]
source = ["mlserver"]
omit = ["*/tests/*", "*/grpc/dataplane_pb2*", "*/grpc/model_repository_pb2*"]

[tool.coverage.report]
fail_under = 70
show_missing = true
```

```ini
# tox.ini - add --cov flags
commands =
    python -m pytest {posargs} -n auto --cov=mlserver --cov-report=xml \
        {toxinidir}/tests \
```

```yaml
# tests.yml - add codecov upload step
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: coverage.xml
          fail_ci_if_error: false
```

### 2. Add Concurrency Control and Caching (2-3 hours)
```yaml
# tests.yml - add at top level
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

# Add to each job's steps after checkout
      - name: Cache pip
        uses: actions/cache@v4
        with:
          path: ~/.cache/pip
          key: ${{ runner.os }}-pip-${{ matrix.python-version }}-${{ hashFiles('**/poetry.lock') }}
          restore-keys: |
            ${{ runner.os }}-pip-${{ matrix.python-version }}-
```

### 3. Add Pre-commit Hooks (1-2 hours)
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/psf/black
    rev: 24.4.2
    hooks:
      - id: black
  - repo: https://github.com/PyCQA/flake8
    rev: 7.0.0
    hooks:
      - id: flake8
        args: [--max-line-length=88, --extend-ignore=E203]
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.10.0
    hooks:
      - id: mypy
        additional_dependencies: [pydantic]
```

### 4. Add Timeout Limits (30 minutes)
```yaml
# Add to each job in tests.yml
  lint:
    timeout-minutes: 10
  test-mlserver:
    timeout-minutes: 30
  test-runtimes:
    timeout-minutes: 30
  test-all-runtimes:
    timeout-minutes: 60
```

### 5. Create Basic CLAUDE.md (2-3 hours)
Generate test creation rules using `/test-rules-generator` to establish AI agent guidelines for consistent test patterns across all runtimes.

## Detailed Findings

### Unit Tests

**Score: 7.0/10**

**Strengths:**
- **103 test files** in the core `tests/` directory covering REST, gRPC, Kafka, CLI, parallel processing, codecs, batching, caching, tracing, and more
- **33 additional test files** across 7 runtime backends (sklearn, xgboost, lightgbm, mlflow, huggingface, catboost, alibi)
- **Test-to-code ratio**: ~1:1 (103 test files vs 101 source files in `mlserver/`)
- **pytest ecosystem**: pytest-asyncio (auto mode), pytest-mock, pytest-cases, pytest-xdist for parallelization
- **23 conftest.py files** showing well-organized fixture hierarchy
- **40 files using parametrize** for data-driven testing
- **39 files with async tests** leveraging pytest-asyncio
- **Test parallelization**: `-n auto` via pytest-xdist in all tox environments
- **Known flaky tests isolated**: Kafka, parallel, gRPC, env, CLI tests run separately due to parallel flakiness

**Weaknesses:**
- No test coverage measurement (scored under Coverage Tracking)
- Some test flakiness acknowledged in tox.ini comments (kafka, parallel, grpc, env, cli tests)
- No `alibi-explain` or `alibi-detect` test files visible in runtime test directories (tests may be in separate packages)
- No `mllib` tests visible in runtime test directories

**Key Files:**
- `tests/` — 14 subdirectories covering all major subsystems
- `runtimes/*/tests/` — per-runtime test suites
- `tox.ini` — test orchestration with 3 environments (mlserver, all-runtimes, py3)
- `pyproject.toml:71` — pytest configuration with asyncio_mode=auto

### Integration/E2E Tests

**Score: 5.0/10**

**Strengths:**
- Tests effectively function as integration tests for several subsystems:
  - `tests/rest/` — REST API endpoint testing with actual FastAPI test client
  - `tests/grpc/` — gRPC server testing
  - `tests/kafka/` — Kafka integration testing
  - `tests/tracing/` — OpenTelemetry tracing integration tests
  - `tests/parallel/` — Multi-process model serving tests
  - `tests/env/` — Environment/configuration integration tests
  - `tests/cli/` — CLI command testing
- `test-all-runtimes` tox environment verifies all runtimes work together (cross-runtime integration)
- Benchmarks with k6 validate performance under load (REST + gRPC scenarios)
- `docker` Python SDK in dev dependencies suggests some container-level test capability

**Weaknesses:**
- **No dedicated E2E directory** — no `e2e/` or `integration/` directory
- **No container deployment testing** — no Kind, Minikube, or testcontainers
- **No multi-version testing** — tests only vary Python version, not K8s/KServe version
- **No KServe protocol compliance validation** — despite being KFServing V2 Dataplane compliant
- **Benchmarks are schedule-only** — not triggered on PRs
- **test-all-runtimes only runs on push** — not on PRs (`if: github.event_name == 'push'`)

**Key Files:**
- `tests/rest/`, `tests/grpc/`, `tests/kafka/` — integration-style test suites
- `benchmarking/` — k6-based performance tests (schedule-only)
- `.github/workflows/tests.yml:155` — test-all-runtimes job (push-only)

### Build Integration

**Score: 3.0/10**

**Strengths:**
- Code generation validation on PRs: `generate` job validates that dataplane and model-repository code is up to date
- `lint-no-changes` check ensures generated code is committed
- Release workflows handle full Docker image build with proper labeling

**Weaknesses:**
- **No PR-time Docker build** — the Dockerfile is complex (multi-stage, Conda, multiple runtimes) but never built on PRs
- **Docker image build only at release time** — `release.yml` and `release-sc.yml` are `workflow_dispatch` only
- **Security scan builds on push but not PR** — `security.yml` builds the image only on push to master/release
- **No Konflux simulation** — no PR-time build pipeline validation
- **No operator/manifest validation** — no kustomize, CRD, or K8s manifest testing
- **No build mode testing** — single build configuration only

**Key Files:**
- `Dockerfile` — Complex multi-stage build (~100 lines)
- `.github/workflows/tests.yml` — PR-triggered but no Docker build
- `.github/workflows/release.yml` — Release-only Docker build
- `.github/workflows/security.yml` — Push-only security scanning with image build
- `Makefile:build` — Calls `hack/build-images.sh` for local builds

### Image Testing

**Score: 4.0/10**

**Strengths:**
- **Multi-stage build**: Wheel builder stage + UBI9 runtime stage (good separation of build and runtime)
- **UBI9 base image** (`registry.access.redhat.com/ubi9/ubi-minimal`) — FIPS-capable, Red Hat supported
- **Non-root user**: Runs as UID 1000 with proper permissions
- **`.dockerignore`** present and comprehensive
- **Environment tarball support**: Can hot-load custom environments at startup
- **Conda-based Python**: Controlled Python version management

**Weaknesses:**
- **No `HEALTHCHECK` instruction** in Dockerfile
- **No container startup validation** in CI
- **No testcontainers** or equivalent for runtime testing
- **No multi-architecture support** — no `docker buildx`, no `--platform` flags
- **No readiness/liveness probe definitions** in repository
- **Hardcoded Python 3.10.12** in Dockerfile ARG (not aligned with CI matrix testing 3.9-3.12)
- **Conda 23.11.0 pinned** — potentially outdated

**Key Files:**
- `Dockerfile` — Multi-stage build with UBI9 base
- `.dockerignore` — Build context exclusions
- `hack/build-wheels.sh` — Wheel building script
- `hack/build-env.sh`, `hack/activate-env.sh` — Environment management

### Coverage Tracking

**Score: 1.0/10**

**Strengths:**
- None identified. This is the most significant quality gap in the repository.

**Weaknesses:**
- **No coverage tool configured** — no `pytest-cov` in any dependency group
- **No coverage configuration** — no `.codecov.yml`, `codecov.yml`, or `.coveragerc`
- **No coverage flags in test commands** — no `--cov` in tox.ini or CI workflows
- **No coverage thresholds** — no minimum coverage enforcement
- **No PR coverage reporting** — no codecov/coveralls integration
- **No coverage generation at all** — not even local coverage reports

**Key Files:**
- `tox.ini` — Test commands without coverage flags
- `pyproject.toml` — No coverage dependencies or configuration
- `.github/workflows/tests.yml` — No coverage upload steps

### CI/CD Automation

**Score: 6.0/10**

**Strengths:**
- **PR-triggered test workflow** (`tests.yml`) with comprehensive jobs: generate, lint, test-mlserver, test-runtimes
- **Multi-Python matrix**: Tests run across Python 3.9, 3.10, 3.11, 3.12
- **Per-runtime test isolation**: Each runtime tested independently via tox
- **fail-fast: false** on test matrices — all combinations run even if one fails
- **Scheduled benchmarks** with k6 (daily)
- **Scheduled security scanning** with Snyk (daily)
- **License change detection** with automated PR creation
- **OS matrix** (Ubuntu + macOS commented out but present)
- **7 well-organized workflow files**: tests, benchmark, licenses, publish, release, release-sc, security

**Weaknesses:**
- **No concurrency control** — multiple runs for same PR accumulate
- **No pip/poetry caching** — full dependency install on every run
- **No timeout-minutes** — hung jobs can run indefinitely
- **test-all-runtimes is push-only** — the comprehensive cross-runtime test skips PRs
- **No artifact upload** — test results not preserved
- **Benchmarks not PR-gated** — performance regressions not caught before merge
- **No branch protection evidence** — can't verify required status checks

**Key Files:**
- `.github/workflows/tests.yml` — Main test workflow (7 jobs)
- `.github/workflows/benchmark.yml` — k6 benchmarks (schedule-only)
- `.github/workflows/security.yml` — Snyk security scanning
- `.github/workflows/licenses.yml` — License compliance checking
- `.github/workflows/release.yml` — Release pipeline
- `.github/workflows/publish.yml` — Changelog and tagging

### Static Analysis

**Score: 6.0/10**

#### Linting
- **black**: Code formatting enforced in `make lint` (`black --check .`)
- **flake8**: Configured in `setup.cfg` with `max-line-length = 88`, `extend-ignore = E203` (compatible with black)
- **mypy**: Configured in `pyproject.toml` with `pydantic.mypy` plugin, `ignore_missing_imports = true`
- Linting runs on PRs across all Python versions (3.9-3.12 matrix)

#### FIPS Compatibility
- **No FIPS-noncompliant crypto imports** found in `mlserver/` or `runtimes/`
- **UBI9 base image** (`registry.access.redhat.com/ubi9/ubi-minimal`) is FIPS-capable
- No explicit FIPS build tags or configuration (Python project, relies on system crypto)

#### Dependency Alerts
- **Dependabot configured** (`.github/dependabot.yml`) with comprehensive coverage:
  - Root pip directory
  - All 9 runtime directories individually (alibi-detect, alibi-explain, huggingface, lightgbm, mlflow, mllib, sklearn, xgboost, catboost)
  - Docker ecosystem
  - Weekly schedule with `SeldonIO/mlops` reviewers
- **Missing**: GitHub Actions ecosystem not covered by Dependabot
- **No Renovate** configured

#### Pre-commit Hooks
- **Not configured** — no `.pre-commit-config.yaml`
- Formatting/linting enforced only in CI, not locally

**Key Files:**
- `setup.cfg` — flake8 configuration
- `pyproject.toml:62-69` — mypy configuration
- `Makefile:lint` — `black --check . && flake8 . && mypy ./mlserver`
- `.github/dependabot.yml` — Comprehensive dependency update configuration

### Agent Rules

**Score: 0.0/10**

- **No `CLAUDE.md`** in repository root
- **No `AGENTS.md`** in repository root
- **No `.claude/` directory** — no rules, no skills, no configuration
- **No test creation guidelines** for AI agents
- **`CONTRIBUTING.md`** exists but contains only basic PR/contribution workflow — no testing standards, no test patterns, no framework-specific guidance
- **No testing documentation** in `docs/` that could serve as agent guidance

**Key Files:**
- `CONTRIBUTING.md` — Basic contribution guide without test patterns
- `docs/` — User-facing documentation, not development/testing guidance

## Recommendations

### Priority 0 (Critical)

1. **Add pytest-cov and Codecov integration** — This is the single highest-impact improvement. Add `pytest-cov` to dev dependencies, configure `.coveragerc` with appropriate source/omit settings, add `--cov` flags to tox.ini, and integrate `codecov/codecov-action` in tests.yml. Set minimum threshold at 70% and enable PR commenting.

2. **Add PR-time Docker image build** — Add a job to `tests.yml` that builds the Docker image on every PR. The Dockerfile is complex enough that build breakages are likely. Even without pushing, validating the build catches issues before merge.

3. **Add container health check and startup validation** — Add `HEALTHCHECK CMD mlserver --version || exit 1` (or equivalent) to the Dockerfile. Add a CI step that starts the container and validates it responds to the health endpoint.

### Priority 1 (High Value)

4. **Create E2E test suite** — Build a test suite using testcontainers (Python) that starts the MLServer container, loads a test model, and validates REST/gRPC inference endpoints. This catches deployment issues that unit/integration tests miss.

5. **Add CI performance optimizations** — Add `concurrency` groups to cancel superseded runs, pip/poetry caching to speed up dependency installation, and `timeout-minutes` to prevent hung jobs.

6. **Add multi-architecture Docker build** — Add `docker buildx` support for amd64/arm64 builds, initially just validation (no push) on PRs.

7. **Add pre-commit hooks** — Configure `.pre-commit-config.yaml` with black, flake8, and mypy to catch issues before CI.

### Priority 2 (Nice-to-Have)

8. **Create CLAUDE.md and agent rules** — Generate rules with `/test-rules-generator` covering pytest patterns, async test patterns, conftest.py conventions, per-runtime test isolation, and fixture organization.

9. **Migrate from flake8 to ruff** — ruff is significantly faster and replaces both flake8 and several plugins. It also supports auto-fixing.

10. **Add Dependabot for GitHub Actions** — The current Dependabot config covers pip and docker but not GitHub Actions. Add `package-ecosystem: "github-actions"` to catch action version updates.

11. **Move benchmarks to PR-gated** — At minimum, run benchmarks on PRs that modify `mlserver/` core files to catch performance regressions before merge.

## Comparison to Gold Standards

| Capability | MLServer | odh-dashboard | notebooks | kserve |
|-----------|----------|---------------|-----------|--------|
| Unit Tests | pytest + async + parametrize | Jest + React Testing Library | pytest | Go testing + testify |
| Test-to-Code Ratio | ~1:1 | ~1:1 | ~0.8:1 | ~1:1 |
| Integration/E2E | REST/gRPC/Kafka tests (no deployment) | Cypress E2E + API mocks | Multi-layer image tests | E2E with Kind + multi-K8s versions |
| Coverage Tracking | **None** | Codecov with thresholds | Coverage reporting | Codecov with enforcement |
| PR Docker Build | **None** | Yes (build validation) | Yes (multi-arch) | Yes (build + test) |
| CI Caching | **None** | pip/npm caching | pip caching | go mod cache |
| Concurrency Control | **None** | Yes | Yes | Yes |
| Pre-commit Hooks | **None** | Yes | Yes | Yes |
| Dependabot/Renovate | Dependabot (pip + docker) | Dependabot | Dependabot | Dependabot |
| FIPS Compliance | UBI9 base (implicit) | N/A (frontend) | UBI base + checks | FIPS build tags |
| Agent Rules | **None** | Comprehensive CLAUDE.md | Partial | Partial |
| Multi-arch Builds | **None** | N/A | Yes (5 architectures) | Yes |
| Container Health | **No HEALTHCHECK** | N/A | Health probes | Health probes |
| Benchmark Tests | k6 (schedule-only) | None | None | Load tests |

## File Paths Reference

### CI/CD
- `.github/workflows/tests.yml` — Main test workflow (PR + push triggered)
- `.github/workflows/benchmark.yml` — k6 performance benchmarks (schedule)
- `.github/workflows/security.yml` — Snyk security scanning (push + schedule)
- `.github/workflows/licenses.yml` — License compliance (schedule)
- `.github/workflows/release.yml` — Release pipeline (manual dispatch)
- `.github/workflows/release-sc.yml` — SC release pipeline (manual dispatch)
- `.github/workflows/publish.yml` — Changelog updates (on release)

### Testing
- `tests/` — Core test suite (14 subdirectories, 103 test files)
- `runtimes/*/tests/` — Per-runtime test suites (33 test files across 7 runtimes)
- `tox.ini` — Test orchestration (mlserver, all-runtimes, py3 environments)
- `tox.runtime.ini` — Per-runtime tox configuration
- `benchmarking/` — k6 performance benchmarks

### Build & Container
- `Dockerfile` — Multi-stage Docker build (wheel-builder + UBI9 runtime)
- `.dockerignore` — Build context exclusions
- `hack/build-wheels.sh` — Wheel building script
- `hack/build-images.sh` — Image building script
- `Makefile` — Build, test, lint, and push targets

### Code Quality
- `setup.cfg` — flake8 configuration
- `pyproject.toml` — mypy, pytest configuration + dependencies
- `.github/dependabot.yml` — Dependency update configuration (pip + docker)
- `.snyk` — Snyk security policy

### Documentation
- `CONTRIBUTING.md` — Contribution guidelines
- `RELEASE.md` — Release process documentation
- `docs/` — User documentation (ReadTheDocs)
- `openapi/` — OpenAPI specification files
