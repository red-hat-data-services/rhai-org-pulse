---
repository: "opendatahub-io/caikit-tgis-serving"
overall_score: 4.3
scorecard:
  - dimension: "Unit Tests"
    score: 1.0
    status: "No unit tests exist; only a single smoke test script"
  - dimension: "Integration/E2E"
    score: 6.0
    status: "Docker Compose and KServe smoke tests with Kind cluster deployment"
  - dimension: "Build Integration"
    score: 5.0
    status: "PR-triggered Docker image build; no Konflux simulation or operator manifest validation"
  - dimension: "Image Testing"
    score: 5.5
    status: "Multi-stage UBI-based Dockerfile with runtime smoke tests but no health check testing"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling, thresholds, or reporting configured"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "PR and scheduled workflows exist but lack caching, concurrency control, timeouts, and matrix strategies"
  - dimension: "Static Analysis"
    score: 3.0
    status: "Dependabot configured with good ecosystem coverage; no linting, FIPS checks, or pre-commit hooks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/rules/ present"
critical_gaps:
  - title: "No unit tests exist"
    impact: "Code changes cannot be validated at the unit level; regressions go undetected until integration"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "Zero coverage tracking or enforcement"
    impact: "No visibility into code coverage; no gate to prevent coverage regression"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No static analysis or linting"
    impact: "Code quality issues, style inconsistencies, and potential bugs not caught before merge"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No CI concurrency control or timeouts"
    impact: "Redundant CI runs consume resources; stuck jobs block the queue indefinitely"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI code generation lacks project-specific guidance for testing patterns and conventions"
    severity: "LOW"
    effort: "2-3 hours"
quick_wins:
  - title: "Add concurrency control and timeout-minutes to all workflows"
    effort: "1 hour"
    impact: "Prevent redundant CI runs and stuck jobs from wasting resources"
  - title: "Add ruff linter configuration"
    effort: "1-2 hours"
    impact: "Catch code quality issues, enforce consistent style, and detect common Python bugs"
  - title: "Add pre-commit hooks with ruff and basic checks"
    effort: "1-2 hours"
    impact: "Enforce code quality standards before code reaches CI"
  - title: "Create basic CLAUDE.md with testing conventions"
    effort: "1-2 hours"
    impact: "Guide AI-assisted development with project-specific patterns"
recommendations:
  priority_0:
    - "Add unit tests for the smoke-test module and any utility code (utils/convert.py)"
    - "Configure pytest with coverage reporting and integrate codecov"
    - "Add ruff linter with pyproject.toml configuration"
  priority_1:
    - "Add concurrency control groups to all PR-triggered workflows"
    - "Set timeout-minutes on all workflow jobs (recommend 30 min for build, 45 min for KServe tests)"
    - "Add pre-commit hooks for ruff, yaml validation, and dockerfile linting"
    - "Create CLAUDE.md with project testing patterns and conventions"
  priority_2:
    - "Add multi-architecture build support (linux/arm64)"
    - "Add HEALTHCHECK instruction to Dockerfile"
    - "Consider adding contract tests for caikit-nlp-client API boundaries"
    - "Add FIPS compliance build tags and validation"
---

# Quality Analysis: caikit-tgis-serving

## Executive Summary

- **Overall Score: 4.3/10**
- **Repository Type**: Python packaging/deployment project (model serving runtime)
- **Primary Language**: Python 3.11 (poetry-managed)
- **Jira Component**: Model Runtimes (RHOAIENG)
- **Tier**: Midstream
- **Key Strengths**: Good integration testing with Docker Compose and KServe/Kind; UBI-based multi-stage Docker build; well-configured Dependabot with pip, docker, and github-actions ecosystems
- **Critical Gaps**: No unit tests, no coverage tracking, no linting/static analysis, no agent rules
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 1.0/10 | 15% | No unit tests; only a single smoke test script |
| Integration/E2E | 6.0/10 | 20% | Docker Compose + KServe smoke tests on Kind cluster |
| Build Integration | 5.0/10 | 15% | PR-triggered image build; no Konflux simulation |
| Image Testing | 5.5/10 | 10% | Multi-stage UBI build with runtime smoke tests |
| Coverage Tracking | 0.0/10 | 10% | No coverage tooling configured |
| CI/CD Automation | 5.0/10 | 15% | Workflows exist but lack optimization patterns |
| Static Analysis | 3.0/10 | 10% | Dependabot only; no linting or FIPS checks |
| Agent Rules | 0.0/10 | 5% | No agent rules present |

## Critical Gaps

### 1. No Unit Tests Exist
- **Impact**: Code changes cannot be validated at the unit level; regressions go undetected until integration testing
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Details**: The repository has only 2 Python source files (`utils/convert.py` and `test/smoke-test.py`). Neither `convert.py` nor the smoke test have corresponding unit tests. The smoke test (`test/smoke-test.py`) is a functional test that requires running services.

### 2. Zero Coverage Tracking or Enforcement
- **Impact**: No visibility into code coverage percentages; no gate to prevent coverage regression on PRs
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No `.codecov.yml`, `.coveragerc`, or `pytest-cov` configuration exists. No CI workflow generates coverage reports. No coverage thresholds are enforced.

### 3. No Static Analysis or Linting Configured
- **Impact**: Code quality issues, style inconsistencies, type errors, and common Python bugs are not caught before merge
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No ruff, flake8, mypy, or any Python linter is configured. No pre-commit hooks exist. The `pyproject.toml` contains only poetry dependency configuration with no tool sections.

### 4. No CI Concurrency Control or Timeouts
- **Impact**: Redundant CI runs on rapid pushes waste resources; stuck jobs can block the queue indefinitely
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: No `concurrency:` groups defined on any workflow. No `timeout-minutes:` set on any jobs. The KServe test job involves deploying a Kind cluster which could hang indefinitely.

### 5. No Agent Rules for AI-Assisted Development
- **Impact**: AI tools (Claude Code, GitHub Copilot) lack project-specific guidance for testing patterns, architecture decisions, and coding conventions
- **Severity**: LOW
- **Effort**: 2-3 hours
- **Details**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/rules/` directory exists.

## Quick Wins

### 1. Add Concurrency Control and Timeouts (1 hour)
Add to `build-and-test.yml`:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```
Add `timeout-minutes: 30` to build jobs and `timeout-minutes: 45` to KServe test jobs.

### 2. Add Ruff Linter Configuration (1-2 hours)
Add to `pyproject.toml`:
```toml
[tool.ruff]
target-version = "py311"
line-length = 120

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP"]
```

### 3. Add Pre-commit Hooks (1-2 hours)
Create `.pre-commit-config.yaml`:
```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.5.0
    hooks:
      - id: ruff
      - id: ruff-format
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
```

### 4. Create Basic CLAUDE.md (1-2 hours)
Document project conventions, test patterns, and the caikit/tgis architecture for AI-assisted development.

## Detailed Findings

### Unit Tests
- **Score: 1.0/10**
- **Test Files**: 0 unit test files (0 `test_*.py` or `*_test.py` files with pytest/unittest patterns)
- **Source Files**: 2 Python files (`utils/convert.py`, `test/smoke-test.py`)
- **Test-to-Code Ratio**: 0:1 (no unit tests)
- **Framework**: None configured (no pytest.ini, no `[tool.pytest]` in pyproject.toml)
- **Score Rationale**: The only test file (`test/smoke-test.py`) is a functional smoke test requiring running caikit and tgis services. It validates HTTP and gRPC endpoints but does not test individual functions or modules in isolation. The score of 1.0 (rather than 0) acknowledges the existence of the smoke test script.

### Integration/E2E Tests
- **Score: 6.0/10**
- **Docker Compose Smoke Test**: `test/compose/smoke-test.sh` builds the image, starts caikit + tgis services, downloads and converts a model, then runs `test/smoke-test.py` against HTTP and gRPC endpoints
- **KServe Integration Test**: `build-and-test.yml` deploys to a Kind cluster with KServe, creates a `ServingRuntime` and `InferenceService`, and validates HTTP inference
- **Multi-version Testing**: Not present; tests run against a single KServe version (v0.12.1.4)
- **Separate KServe Test Workflow**: `kserve-test.yml` exists but is disabled for PRs (push/PR triggers are commented out); only runs weekly on schedule
- **Score Rationale**: Good smoke test coverage with both Docker Compose and KServe paths. The KServe test runs on PRs via `build-and-test.yml`. However, only single-version testing is performed, gRPC testing is incomplete (marked TODO), and there are no negative test cases.

### Build Integration
- **Score: 5.0/10**
- **PR Build**: `build-and-test.yml` triggers on PRs and builds the Docker image using `docker/build-push-action@v5`
- **Image Artifact**: Built image is exported as a Docker tar and shared via `upload-artifact`/`download-artifact` between jobs
- **Konflux Simulation**: None
- **Operator Manifest Validation**: None (not an operator, but no kustomize validation of KServe manifests)
- **Dry-run Validation**: No `kubectl apply --dry-run` on manifests
- **Score Rationale**: The PR workflow builds the image and tests it, which is good. However, there's no Konflux simulation, no manifest validation, and no build mode testing (ODH vs RHOAI).

### Image Testing
- **Score: 5.5/10**
- **Dockerfile Analysis**:
  - Multi-stage build: Yes (poetry-builder → deploy)
  - Base image: `registry.access.redhat.com/ubi9/ubi-minimal:latest` (FIPS-capable UBI)
  - Non-root user: Yes (caikit user, UID 1001)
  - Security: Runs `microdnf -y update` and `microdnf clean all`
- **Runtime Testing**: Smoke tests validate the image can start and serve inference requests
- **Health Probes**: Defined in KServe `ServingRuntime` manifest (readiness/liveness via `caikit_health_probe`) but not in the Dockerfile itself
- **Multi-arch**: Not supported (hardcoded `DOCKER_DEFAULT_PLATFORM=linux/amd64` in Makefile)
- **HEALTHCHECK**: Not present in Dockerfile
- **Score Rationale**: Good base image choice (UBI) and multi-stage build. Non-root user is configured. However, no Dockerfile HEALTHCHECK, no multi-arch support, and `.dockerignore` exists but only excludes venv/env directories (could be more comprehensive).

### Coverage Tracking
- **Score: 0.0/10**
- **Coverage Configuration**: None
- **CI Integration**: No coverage generation in any workflow
- **Threshold Enforcement**: None
- **PR Reporting**: None
- **Score Rationale**: Complete absence of coverage tooling. No `.codecov.yml`, no `pytest-cov`, no `--cov` flags anywhere.

### CI/CD Automation
- **Score: 5.0/10**
- **Workflow Inventory**:
  | Workflow | Trigger | Purpose |
  |----------|---------|---------|
  | `build-and-test.yml` | PR, push(main), schedule(weekly), dispatch | Build image + compose smoke test + KServe smoke test |
  | `kserve-test.yml` | schedule(weekly), dispatch | Standalone KServe test (PR triggers commented out) |
  | `pr-close-image-delete.yaml` | PR closed | Clean up quay.io PR images |
  | `run-update.yml` | schedule(weekly), dispatch | Update poetry lockfiles |
  | `dependabot-autoapprove.yaml` | PR | Auto-approve Dependabot PRs |
- **Concurrency Control**: None on any workflow
- **Caching**: No build or dependency caching (the `tool-cache: false` entries are for the free-disk-space action, not build caching)
- **Timeouts**: None set on any job
- **Matrix/Parallelization**: No matrix strategies
- **PR Image Lifecycle**: Good practice — PR images are built and pushed to quay.io, then cleaned up on PR close
- **Score Rationale**: The workflow structure is logical with build → test pipeline and artifact sharing. However, missing concurrency control means redundant runs on rapid pushes. No caching increases build times. No timeouts risk stuck jobs. No matrix testing limits version coverage.

### Static Analysis

#### Linting
- **Configuration**: None
- **Details**: No ruff, flake8, pylint, or any Python linter configured. The `pyproject.toml` has no `[tool.ruff]`, `[tool.flake8]`, or similar sections. No linting step in any CI workflow.

#### FIPS Compatibility
- **Source Code**: No non-FIPS-compliant crypto imports found (no `hashlib.md5`, `crypto/md5`, etc.)
- **Build Configuration**: No FIPS build tags or configuration (no `-tags=fips`, `GOEXPERIMENT=boringcrypto`)
- **Base Image**: UBI9-minimal (FIPS-capable) — good choice
- **Assessment**: The repo itself has minimal Python code, so FIPS risk is low. The UBI base image is FIPS-capable. However, FIPS compliance of the caikit/caikit-nlp/caikit-tgis-backend dependencies is not validated.

#### Dependency Alerts
- **Dependabot**: Configured (`.github/dependabot.yml`) with good coverage:
  - `pip` ecosystem (daily)
  - `docker` ecosystem (daily)
  - `github-actions` ecosystem (weekly)
- **Auto-approve**: Dependabot PRs are auto-approved via `dependabot-autoapprove.yaml`
- **Renovate**: Not configured (Dependabot suffices)
- **Assessment**: Well-configured dependency alerting with broad ecosystem coverage and auto-approval workflow.

### Agent Rules
- **Score: 0.0/10**
- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **Test rules**: Not present
- **Documentation**: The `docs/` directory has only a `README.md`; no testing guidelines or conventions documented
- **Recommendation**: Generate agent rules using `/test-rules-generator` to establish unit test patterns, smoke test conventions, and KServe integration test guidance

## Recommendations

### Priority 0 (Critical)
1. **Add unit tests for utility code and smoke test helpers** — Even with minimal source code, `utils/convert.py` and the helper functions in `test/smoke-test.py` (`wait_until`, etc.) should have unit tests
2. **Configure pytest with coverage** — Add `[tool.pytest.ini_options]` to `pyproject.toml`, install `pytest-cov`, and integrate with codecov
3. **Add ruff linter** — Configure ruff in `pyproject.toml` and add a lint step to the PR workflow

### Priority 1 (High Value)
4. **Add concurrency control to PR workflows** — Prevent redundant CI runs with `concurrency:` groups
5. **Set timeout-minutes on all jobs** — Prevent stuck Kind cluster deployments from blocking CI indefinitely
6. **Add pre-commit hooks** — Enforce ruff, yaml validation, and basic file checks before CI
7. **Create CLAUDE.md with project conventions** — Document caikit architecture, testing patterns, and deployment conventions for AI-assisted development

### Priority 2 (Nice-to-Have)
8. **Add multi-architecture builds** — Support `linux/arm64` in addition to `linux/amd64`
9. **Add HEALTHCHECK to Dockerfile** — Docker-native health monitoring
10. **Enable multi-version KServe testing** — Use matrix strategy to test against multiple KServe versions
11. **Add contract tests** — Validate caikit-nlp-client API contract against the serving runtime
12. **Add FIPS compliance validation** — Validate that caikit dependencies use FIPS-compliant crypto

## Comparison to Gold Standards

| Dimension | caikit-tgis-serving | odh-dashboard | notebooks | kserve |
|-----------|:-------------------:|:-------------:|:---------:|:------:|
| Unit Tests | 1.0 | 8.5 | 6.0 | 8.0 |
| Integration/E2E | 6.0 | 9.0 | 7.0 | 9.0 |
| Build Integration | 5.0 | 8.0 | 7.5 | 7.5 |
| Image Testing | 5.5 | 7.0 | 9.0 | 6.0 |
| Coverage Tracking | 0.0 | 8.0 | 5.0 | 8.0 |
| CI/CD Automation | 5.0 | 9.0 | 7.0 | 8.5 |
| Static Analysis | 3.0 | 8.0 | 6.0 | 7.5 |
| Agent Rules | 0.0 | 8.0 | 3.0 | 2.0 |
| **Overall** | **4.3** | **8.3** | **6.5** | **7.5** |

### Key Gaps vs Gold Standards
- **Unit testing** is the biggest gap — gold standard repos have extensive unit test suites
- **Coverage tracking** is completely absent, while gold standards enforce thresholds
- **Static analysis** is minimal compared to multi-linter setups in gold standards
- **CI optimization** patterns (caching, concurrency, matrix) are not utilized

## File Paths Reference

### CI/CD
- `.github/workflows/build-and-test.yml` — Main PR workflow (build + smoke tests)
- `.github/workflows/kserve-test.yml` — Standalone KServe test (scheduled only)
- `.github/workflows/run-update.yml` — Poetry lockfile updater
- `.github/workflows/pr-close-image-delete.yaml` — PR image cleanup
- `.github/workflows/dependabot-autoapprove.yaml` — Auto-approve Dependabot PRs
- `.github/dependabot.yml` — Dependabot configuration

### Source & Tests
- `utils/convert.py` — Model conversion utility (24 lines)
- `test/smoke-test.py` — Smoke test script with HTTP/gRPC validation (73 lines)
- `test/compose/smoke-test.sh` — Docker Compose test runner
- `test/compose/docker-compose.yml` — Compose configuration for local testing

### Build & Container
- `Dockerfile` — Multi-stage UBI9 build
- `.dockerignore` — Container build exclusions
- `Makefile` — Image build targets
- `pyproject.toml` — Poetry dependency configuration
- `poetry.lock` — Locked dependency versions

### KServe Test Fixtures
- `test/kserve/caikit-tgis-serving.yaml` — ServingRuntime + InferenceService manifests
- `test/kserve/setup.yaml` — PVC and model download pod
- `test/kserve/kind_config.yaml` — Kind cluster configuration

### Configuration
- `caikit.yml` — Caikit runtime configuration
