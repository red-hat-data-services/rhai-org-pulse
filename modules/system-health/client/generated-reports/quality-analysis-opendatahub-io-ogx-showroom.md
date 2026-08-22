---
repository: "opendatahub-io/ogx-showroom"
overall_score: 3.3
scorecard:
  - dimension: "Unit Tests"
    score: 1.0
    status: "No unit tests found; zero test-to-code ratio across 3,600 lines of Python"
  - dimension: "Integration/E2E"
    score: 6.0
    status: "Demos run as integration tests on live ROSA cluster via CI; 2 dedicated test scripts (ABAC, persistence)"
  - dimension: "Build Integration"
    score: 3.0
    status: "No PR-time image build; Helm chart publishing on push; relies on pre-built images"
  - dimension: "Image Testing"
    score: 2.0
    status: "Single dev overlay Dockerfile; no multi-stage build, no runtime validation, no multi-arch"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling, thresholds, or PR reporting configured"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "Full lifecycle CI on ROSA with concurrency control and composite action; lacks caching and timeouts"
  - dimension: "Static Analysis"
    score: 4.0
    status: "Pre-commit hooks with shellcheck; no Python linting (ruff/mypy) or dependency alerts"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No unit tests for Python demo code"
    impact: "3,600 lines of Python with zero unit test coverage; regressions in utilities, configuration parsing, and API client logic go undetected"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No code coverage tracking"
    impact: "No visibility into what code is exercised by tests; impossible to set quality gates or measure improvement"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No PR-time image build validation"
    impact: "Dockerfile.dev changes are never validated before merge; broken builds discovered only when manually testing"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No Python linting or type checking"
    impact: "Type errors, import issues, and style inconsistencies in 3,600 lines of Python are caught only at runtime"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add ruff linter to pre-commit and CI"
    effort: "1-2 hours"
    impact: "Catches Python style issues, import errors, and common bugs automatically"
  - title: "Enable Dependabot for dependency alerts"
    effort: "30 minutes"
    impact: "Automated security alerts and dependency update PRs for pip and GitHub Actions ecosystems"
  - title: "Add pytest with basic unit tests for demos/common/utils.py"
    effort: "2-3 hours"
    impact: "Validates core configuration loading and Keycloak token logic that all demos depend on"
  - title: "Add timeout-minutes to CI workflows"
    effort: "15 minutes"
    impact: "Prevents runaway CI jobs from consuming cluster resources indefinitely"
recommendations:
  priority_0:
    - "Add unit tests for shared utilities (demos/common/utils.py, scripts/common.sh, scripts/read_k8s.py) — these are dependencies for all demos and tests"
    - "Configure coverage tracking with pytest-cov and codecov integration"
    - "Add ruff linter and mypy type checking to pre-commit hooks and CI"
  priority_1:
    - "Add PR-time Dockerfile.dev build validation to the provision workflow"
    - "Enable Dependabot for pip and github-actions ecosystems"
    - "Add timeout-minutes to all CI workflow jobs"
    - "Create CLAUDE.md with test patterns and contribution guidelines"
  priority_2:
    - "Add Helm chart lint and template validation (helm lint, helm template) to CI"
    - "Add shellcheck to CI pipeline (not just pre-commit)"
    - "Consider adding pytest markers to separate fast/slow integration tests"
---

# Quality Analysis: ogx-showroom

## Executive Summary

- **Overall Score: 3.3/10**
- **Repository Type**: Reference architecture / CI validation suite for OGX on RHOAI
- **Primary Languages**: Python (3,612 LOC), Shell (1,553 LOC), Helm charts
- **Jira Component**: RHOAIENG / OGX Core (midstream)
- **Key Strengths**: Well-structured integration CI with full lifecycle testing on ROSA; good concurrency control; comprehensive ABAC isolation test; pre-commit hooks with shellcheck
- **Critical Gaps**: Zero unit tests; no coverage tracking; no Python linting; no dependency alerts
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 1.0/10 | 15% | 0.15 | No unit tests found |
| Integration/E2E | 6.0/10 | 20% | 1.20 | Demo-driven integration tests on live ROSA cluster |
| Build Integration | 3.0/10 | 15% | 0.45 | Helm chart publishing only; no PR-time image build |
| Image Testing | 2.0/10 | 10% | 0.20 | Minimal dev overlay Dockerfile; no runtime validation |
| Coverage Tracking | 0.0/10 | 10% | 0.00 | No coverage tooling configured |
| CI/CD Automation | 6.0/10 | 15% | 0.90 | Full lifecycle CI with concurrency control |
| Static Analysis | 4.0/10 | 10% | 0.40 | Pre-commit hooks with shellcheck; no Python linting |
| Agent Rules | 0.0/10 | 5% | 0.00 | No agent rules present |
| **Overall** | **3.3/10** | **100%** | **3.30** | |

## Critical Gaps

### 1. No Unit Tests for Python Demo Code
- **Severity**: HIGH
- **Impact**: 3,612 lines of Python across 13 files have zero unit test coverage. Core utilities like `demos/common/utils.py` (configuration loading, Keycloak token acquisition) and `scripts/read_k8s.py` (K8s secret/route reading) are shared by all demos but have no isolated tests.
- **Effort**: 8-12 hours
- **Risk**: Regressions in configuration parsing, authentication flow, or K8s interaction go undetected until CI runs against a live cluster.

### 2. No Code Coverage Tracking
- **Severity**: HIGH
- **Impact**: Impossible to measure what percentage of code is exercised by any test. No quality gates, no PR coverage diffs, no improvement tracking over time.
- **Effort**: 2-4 hours to add pytest-cov and codecov integration

### 3. No PR-Time Image Build Validation
- **Severity**: MEDIUM
- **Impact**: `Dockerfile.dev` changes are never built or validated in CI. A broken Dockerfile is only discovered when someone manually runs `podman build`.
- **Effort**: 4-6 hours to add a `podman build` step to the provision workflow

### 4. No Python Linting or Type Checking
- **Severity**: MEDIUM
- **Impact**: 3,612 lines of Python with no static analysis beyond shellcheck for shell scripts. Type errors, unused imports, and style inconsistencies are caught only at runtime on a live cluster.
- **Effort**: 2-3 hours to add ruff and optionally mypy

## Quick Wins

### 1. Add ruff Linter to Pre-commit and CI (1-2 hours)
Catches Python style issues, import errors, and common bugs. Add to `.pre-commit-config.yaml`:
```yaml
- repo: https://github.com/astral-sh/ruff-pre-commit
  rev: v0.8.0
  hooks:
  - id: ruff
    args: [--fix]
  - id: ruff-format
```
And to `pyproject.toml`:
```toml
[tool.ruff]
target-version = "py312"
line-length = 120
```

### 2. Enable Dependabot for Dependency Alerts (30 minutes)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 3. Add pytest with Basic Unit Tests for Shared Utilities (2-3 hours)
Create `tests/test_utils.py` to validate `load_demo_config()`, `get_keycloak_token()`, and `read_yaml()` with mocked dependencies. These are the most critical shared functions.

### 4. Add timeout-minutes to CI Workflows (15 minutes)
Add `timeout-minutes: 45` to the `test` job in `provision.yml` to prevent runaway jobs from holding the shared cluster indefinitely.

## Detailed Findings

### Unit Tests

**Score: 1.0/10**

No unit test files were found in the repository. The search covered patterns: `*_test.py`, `*.test.py`, `*.spec.ts`, `*.test.ts`, `*.spec.js`, `*.test.js`, `*_test.go`.

| Metric | Value |
|--------|-------|
| Test files | 0 |
| Source files (Python) | 13 |
| Source lines (Python) | 3,612 |
| Test-to-code ratio | 0:1 |
| Testing framework | None configured |

The repository has 13 Python source files totaling 3,612 lines with no unit test coverage. Key untested modules:
- `demos/common/utils.py` (115 lines) - Configuration loading, Keycloak authentication
- `scripts/read_k8s.py` (101 lines) - K8s secret and route reading
- `scripts/parse-manifest.py` (58 lines) - YAML manifest parsing
- `demos/rag/demo.py` (511 lines) - RAG pipeline with OGXDemo class

The score is 1.0 rather than 0.0 because the `demos/tests/` directory contains test-like scripts (ABAC isolation, restart persistence) that provide some validation, even though they are integration tests rather than unit tests.

### Integration/E2E Tests

**Score: 6.0/10**

The repository has a well-designed integration testing approach using demo scripts as test cases:

**Strengths:**
- `provision.yml` workflow runs full lifecycle on a real ROSA cluster: setup → provision → test → unprovision → cleanup
- `demos/manifest.yaml` defines 11 demos with tags for filtering (`ci`, `fast`, `rag`, `test`)
- `test.sh` runs tagged demos as integration tests with pass/fail tracking
- `demos/tests/abac_isolation/demo.py` (823 lines) - Comprehensive ABAC resource isolation test
- `demos/tests/restarttest/restarttest.sh` (124 lines) - Pod restart persistence validation
- CI tags: 8 demos tagged `ci` run automatically on PRs

**Gaps:**
- No local test environment (Kind/Minikube/envtest) - requires live OpenShift cluster
- No multi-version testing
- No negative test scenarios beyond ABAC isolation
- No API contract testing
- Demo scripts serve dual purpose (demo + test), making failure modes harder to diagnose

**Integration test inventory:**

| Demo/Test | Type | Tags | Purpose |
|-----------|------|------|---------|
| Hello World | Python | ci, fast | Basic chat completion |
| Hello Jupyter | Jupyter | ci, fast | Jupyter notebook execution |
| RAG E2E | Shell | ci, rag | Full RAG pipeline |
| RAG Vector Search | Python | ci, rag | Embeddings + vector store |
| RAG file_search | Python | ci, rag | Server-side RAG |
| Responses API | Python | ci | Multi-turn conversation |
| Conversations API | Python | ci | Conversation CRUD |
| Multi-Agent | Python | ci, agents | Multi-agent routing |
| ABAC Isolation | Python | test, security | Cross-user resource isolation |
| Restart Persistence | Shell | test, persistence | Pod restart survival |
| Telemetry | Python | telemetry | Prometheus metrics query |

### Build Integration

**Score: 3.0/10**

**What exists:**
- `publish-charts.yml` publishes Helm charts to OCI registry on push to main/release branches
- Matrix strategy builds both `ogx-infra` and `ogx-rhoai` charts
- Dynamic versioning based on branch name
- Helm chart dependency management

**What's missing:**
- No PR-time Docker image build (`Dockerfile.dev` is never built in CI)
- No Konflux build simulation
- No Helm chart linting or template validation in CI
- No `helm template --dry-run` validation
- The CI workflow uses pre-built images (configurable via `workflow_dispatch` inputs) rather than building from source

### Image Testing

**Score: 2.0/10**

**What exists:**
- `Dockerfile.dev` - Dev overlay on parameterized base image (`ARG BASE_IMAGE`)
- Uses `pip install -e . --no-deps` for editable install
- Proper user switching (root → 1001)
- Labels for identification

**What's missing:**
- Not multi-stage (single overlay on base)
- No `HEALTHCHECK` instruction
- No multi-architecture support
- No `testcontainers` or runtime validation
- No `.dockerignore` file
- Base image is parameterized (`${BASE_IMAGE}`) so UBI compliance depends on caller
- No container startup/smoke test in CI

### Coverage Tracking

**Score: 0.0/10**

No coverage tooling is configured:
- No `.codecov.yml` or `codecov.yml`
- No `.coveragerc` or `pyproject.toml` coverage configuration
- No `pytest-cov` in dependencies
- No coverage thresholds
- No PR coverage reporting
- No `--coverage` flags in any CI step

### CI/CD Automation

**Score: 6.0/10**

**Workflow inventory:**

| Workflow | Triggers | Purpose |
|----------|----------|---------|
| `provision.yml` | `pull_request_target`, `workflow_dispatch` | Full lifecycle test on ROSA |
| `publish-charts.yml` | `push` (main, release-v*, feature-*) | Helm chart OCI publishing |

**Strengths:**
- Concurrency control: `group: openshift-cluster-1`, `cancel-in-progress: false` - serializes cluster access
- Composite action (`action.yml`) for reusable CI setup (oc, uv, helm install, cluster login, values generation)
- Pre-flight cluster checks (waits for clean state before running)
- Proper cleanup with `if: always()` for unprovision and cleanup steps
- Debug capture step for OpenShift state on failure
- `workflow_dispatch` with image override inputs for testing ODH/upstream builds
- Security note on `pull_request_target` usage

**Gaps:**
- No `timeout-minutes` on jobs (risk of indefinite hangs)
- No caching strategies (uv cache, helm cache)
- No test parallelization
- No scheduled/periodic test runs
- No artifact upload for debug logs
- Only 2 workflows total

### Static Analysis

**Score: 4.0/10**

#### Linting
- `.pre-commit-config.yaml` present with 11 hooks:
  - `pre-commit-hooks` (v5.0.0): trailing-whitespace, end-of-file-fixer, check-yaml, check-added-large-files (1MB max), check-merge-conflict, mixed-line-ending, check-executables-have-shebangs, check-shebang-scripts-are-executable, check-symlinks
  - `shellcheck-py` (v0.10.0.1): shellcheck with `--severity=warning`
- No Python linting tool configured (no ruff, flake8, pylint, black, isort)
- No type checking (no mypy, pyright)
- No `pyproject.toml` tool configuration for any linter

#### FIPS Compatibility
- No FIPS-incompatible crypto imports detected in source code
- No FIPS build tags or configuration
- `Dockerfile.dev` uses parameterized `${BASE_IMAGE}` - FIPS compliance depends on the caller's base image choice
- Not applicable for this repo type (reference architecture, not building crypto-sensitive binaries)

#### Dependency Alerts
- No `.github/dependabot.yml`
- No `renovate.json`, `.renovaterc`, or `.renovaterc.json`
- `pyproject.toml` has pinned minimum versions but no upper bounds
- `uv.lock` provides reproducible builds but no automated update mechanism

### Agent Rules

**Score: 0.0/10**

- No `CLAUDE.md` or `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` directory
- No test creation rules or automation guidance
- No testing standards documentation

**Recommendation**: Use `/test-rules-generator` to create agent rules for:
- Python demo script patterns
- Shell script testing conventions
- Helm chart validation patterns
- Integration test manifest structure

## Recommendations

### Priority 0 (Critical)

1. **Add unit tests for shared Python utilities** - Start with `demos/common/utils.py` and `scripts/read_k8s.py`. These are dependencies for all 11 demos. Use pytest with mocking for K8s and Keycloak calls. Target 80% coverage of utility functions.

2. **Configure coverage tracking** - Add pytest-cov to `pyproject.toml`, create `.codecov.yml` with a 70% threshold, and add codecov reporting to the provision workflow.

3. **Add ruff linter and optionally mypy** - Configure in `pyproject.toml` and add to `.pre-commit-config.yaml`. This catches bugs in 3,600 lines of Python that currently have zero static analysis.

### Priority 1 (High Value)

4. **Enable Dependabot** for `pip` and `github-actions` ecosystems. The repo has 10+ Python dependencies and 4 GitHub Actions with no automated update mechanism.

5. **Add PR-time image build** - Add a `podman build -f Dockerfile.dev` step to validate the Dockerfile on PRs. Use a lightweight base image for CI (e.g., `python:3.12-slim`).

6. **Add timeout-minutes** to all CI jobs. The provision workflow deploys to a shared OpenShift cluster with no timeout, risking indefinite resource consumption.

7. **Create CLAUDE.md** with project conventions: Python style, demo script patterns, Helm chart structure, and test manifest format.

### Priority 2 (Nice-to-Have)

8. **Add Helm chart validation to CI** - `helm lint charts/ogx-infra charts/ogx-rhoai` and `helm template` validation on PRs.

9. **Add scheduled periodic test runs** - Run the full integration suite on a cron schedule (e.g., nightly) to catch infrastructure regressions.

10. **Add pytest markers** to separate fast unit tests from slow integration tests, enabling quick local feedback loops.

## Comparison to Gold Standards

| Dimension | ogx-showroom | odh-dashboard | notebooks | kserve |
|-----------|-------------|---------------|-----------|--------|
| Unit Tests | 1.0 - None | 8.0 - Jest/React Testing Library | 5.0 - Moderate | 8.0 - Go testing |
| Integration/E2E | 6.0 - Demo-driven CI | 9.0 - Cypress + multi-layer | 7.0 - Image validation | 9.0 - Ginkgo E2E |
| Build Integration | 3.0 - Helm only | 7.0 - PR builds | 8.0 - Multi-image CI | 7.0 - Operator builds |
| Image Testing | 2.0 - Dev overlay | 6.0 - Multi-stage | 10.0 - 5-layer validation | 7.0 - Testcontainers |
| Coverage Tracking | 0.0 - None | 8.0 - Codecov enforcement | 5.0 - Basic | 8.0 - Thresholds |
| CI/CD Automation | 6.0 - Lifecycle CI | 9.0 - Comprehensive | 8.0 - Matrix builds | 9.0 - Multi-version |
| Static Analysis | 4.0 - Shellcheck only | 8.0 - ESLint + TypeScript | 6.0 - Basic linting | 7.0 - golangci-lint |
| Agent Rules | 0.0 - None | 8.0 - Comprehensive | 3.0 - Basic | 2.0 - Minimal |

## File Paths Reference

### CI/CD
- `.github/workflows/provision.yml` - Main CI workflow (PR + dispatch)
- `.github/workflows/publish-charts.yml` - Helm chart OCI publishing
- `action.yml` - Composite GitHub Action for CI setup

### Testing
- `test.sh` - Demo-driven test runner with tag filtering
- `demos/manifest.yaml` - Test/demo manifest with 11 entries
- `demos/tests/abac_isolation/demo.py` - ABAC resource isolation test
- `demos/tests/restarttest/restarttest.sh` - Pod restart persistence test
- `demos/common/utils.py` - Shared test/demo utilities

### Container Images
- `Dockerfile.dev` - Dev overlay Dockerfile

### Configuration
- `pyproject.toml` - Python project configuration
- `.pre-commit-config.yaml` - Pre-commit hook configuration
- `.gitignore` - Git ignore patterns
- `values-local.yaml.example` - Helm values template

### Helm Charts
- `charts/ogx-rhoai/` - RHOAI DataScienceCluster and OGXServer CR
- `charts/ogx-infra/` - Infrastructure services (postgres, etcd, milvus, minio, keycloak, monitoring)

### Scripts
- `setup.sh` - RHOAI operator installation and image injection
- `provision.sh` - Helm-based infrastructure and OGX provisioning
- `cleanup.sh` - Full cluster cleanup
- `unprovision.sh` - Helm release removal
- `scripts/common.sh` - Shared shell utilities
- `scripts/read_k8s.py` - K8s secret/route reading utility
- `scripts/parse-manifest.py` - Demo manifest YAML parser
