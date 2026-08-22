---
repository: "trustyai-explainability/trustyai-service"
overall_score: 6.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Strong test suite with 43 test files, 1.07:1 test-to-code LOC ratio, pytest-xdist parallelization, and Hypothesis property-based testing"
  - dimension: "Integration/E2E"
    score: 5.0
    status: "MariaDB integration tests with real database in CI, but no dedicated E2E suite, no K8s cluster testing"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time Docker build with CI image push to Quay and automatic operator manifest generation"
  - dimension: "Image Testing"
    score: 6.0
    status: "Multi-stage UBI10 build with FIPS crypto policy, but no HEALTHCHECK, no multi-arch, no runtime validation"
  - dimension: "Coverage Tracking"
    score: 5.0
    status: "pytest-cov generates coverage and uploads to Codecov, but no thresholds enforced and no codecov.yml config"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "6 well-organized workflows with concurrency control, uv caching, pytest-xdist, multi-Python matrix (3.12, 3.14), SHA-pinned actions"
  - dimension: "Static Analysis"
    score: 9.0
    status: "Ruff with ALL rules, pyrefly type checking, 15+ pre-commit hooks (detect-secrets, gitleaks, bandit, actionlint), Dependabot for 3 ecosystems"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory present"
critical_gaps:
  - title: "No E2E or operator integration testing"
    impact: "Cannot validate full deployment flow, operator interactions, or K8s-level behavior before merge"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No coverage threshold enforcement"
    impact: "Coverage can silently regress without any CI gate preventing it"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No container runtime validation"
    impact: "Image startup issues, missing dependencies, or FIPS misconfigurations not caught until deployment"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No multi-architecture image builds"
    impact: "Cannot verify the image works on ARM64/ppc64le platforms required for some deployments"
    severity: "MEDIUM"
    effort: "4-8 hours"
quick_wins:
  - title: "Add .codecov.yml with coverage thresholds"
    effort: "1-2 hours"
    impact: "Prevents coverage regression with enforced minimum thresholds and PR-level coverage checks"
  - title: "Add HEALTHCHECK to Containerfile"
    effort: "30 minutes"
    impact: "Enables container orchestrators to detect unhealthy containers automatically"
  - title: "Create basic CLAUDE.md with test patterns"
    effort: "2-3 hours"
    impact: "Improve AI-generated code and test quality for contributors using Claude Code"
  - title: "Add container startup smoke test to CI Build workflow"
    effort: "1-2 hours"
    impact: "Catch image startup failures and missing runtime dependencies at PR time"
recommendations:
  priority_0:
    - "Add codecov.yml with project and patch coverage thresholds (e.g., 70% project, 80% patch) and set fail_ci_if_error: true"
    - "Add container startup validation to ci-build.yaml: docker run the built image and verify /q/health/ready returns 200"
  priority_1:
    - "Implement E2E tests using Kind cluster with operator deployment to validate full service lifecycle"
    - "Add multi-architecture build support (docker buildx for linux/amd64,linux/arm64)"
    - "Create comprehensive CLAUDE.md and .claude/rules/ for test automation guidance"
  priority_2:
    - "Add contract tests for gRPC/REST API boundaries consumed by the operator"
    - "Implement performance regression testing for metric computation endpoints"
    - "Add HEALTHCHECK instruction to Containerfile"
---

# Quality Analysis: trustyai-service

## Executive Summary

- **Overall Score: 6.6/10**
- **Repository**: [trustyai-explainability/trustyai-service](https://github.com/trustyai-explainability/trustyai-service)
- **Type**: Python service (AI explainability, fairness, and drift monitoring)
- **Framework**: FastAPI + Hypercorn
- **Primary Language**: Python (3.12+, testing against 3.14)
- **RHOAI Component**: AI Safety (RHOAIENG)
- **Tier**: Upstream

### Key Strengths
- Excellent static analysis with ruff `ALL` rules, pyrefly type checking, and 15+ pre-commit hooks
- Well-organized CI/CD with concurrency control, caching, multi-Python matrix testing, and SHA-pinned actions
- Strong unit test suite with 43 test files, 1.07:1 test-to-code LOC ratio, and pytest-xdist parallelization
- PR-time Docker build pipeline with automatic CI image push and operator manifest generation
- FIPS-aware Containerfile with UBI10 base and crypto policy configuration

### Critical Gaps
- No E2E or operator integration tests (cannot validate K8s deployment flow)
- No coverage threshold enforcement (coverage can silently regress)
- No container runtime validation in CI (startup issues caught only at deployment time)
- No agent rules for AI-assisted development

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.0/10 | 15% | 1.20 | Strong test suite with parallelization and property-based testing |
| Integration/E2E | 5.0/10 | 20% | 1.00 | MariaDB integration tests, but no E2E or K8s cluster testing |
| Build Integration | 7.0/10 | 15% | 1.05 | PR Docker build with Quay push and manifest generation |
| Image Testing | 6.0/10 | 10% | 0.60 | Multi-stage UBI10 + FIPS policy, no HEALTHCHECK or multi-arch |
| Coverage Tracking | 5.0/10 | 10% | 0.50 | Coverage generated and uploaded, but not enforced |
| CI/CD Automation | 9.0/10 | 15% | 1.35 | Excellent workflow organization with best practices |
| Static Analysis | 9.0/10 | 10% | 0.90 | Comprehensive linting, type checking, and security scanning |
| Agent Rules | 0.0/10 | 5% | 0.00 | No agent rules present |
| **Overall** | **6.6/10** | **100%** | **6.60** | |

## Critical Gaps

### 1. No E2E or Operator Integration Testing
- **Impact**: Cannot validate full deployment flow, K8s-level behavior, or operator interactions
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: The repository has no `e2e/` or `integration/` directories. While MariaDB integration tests exist, there is no testing of the service deployed in a K8s cluster, no operator interaction testing, and no multi-version OCP testing. The `ci-publish.yaml` workflow generates operator manifests but never validates them against an actual cluster.

### 2. No Coverage Threshold Enforcement
- **Impact**: Coverage can silently regress without any CI gate preventing it
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: While `pytest-cov` generates coverage and the Codecov action uploads results, there is no `.codecov.yml` file defining thresholds and `fail_ci_if_error` is set to `false`. No coverage gate prevents merging PRs that reduce coverage.

### 3. No Container Runtime Validation
- **Impact**: Image startup issues, missing dependencies, or FIPS misconfigurations not caught until deployment
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: The CI Build workflow (`ci-build.yaml`) builds the Docker image but never starts it. Health endpoint validation, FIPS policy verification, and dependency loading are not tested at PR time.

### 4. No Multi-Architecture Image Builds
- **Impact**: Cannot verify image works on ARM64/ppc64le platforms
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: The Containerfile has no `--platform` directives and CI does not use `docker buildx`. Some Red Hat deployments require multi-arch support.

## Quick Wins

### 1. Add `.codecov.yml` with Coverage Thresholds (1-2 hours)
```yaml
# .codecov.yml
coverage:
  status:
    project:
      default:
        target: 70%
        threshold: 2%
    patch:
      default:
        target: 80%
comment:
  layout: "reach,diff,flags,files"
  behavior: default
```
Also update `python-tests.yaml` to set `fail_ci_if_error: true` on the Codecov action.

### 2. Add HEALTHCHECK to Containerfile (30 minutes)
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/q/health/ready')" || exit 1
```

### 3. Add Container Startup Smoke Test (1-2 hours)
Add to `ci-build.yaml` after the build step:
```yaml
- name: Smoke test image
  run: |
    docker run -d --name trustyai-test \
      -p 8080:8080 \
      trustyai-ci:${{ github.event.pull_request.head.sha }}
    sleep 10
    curl -f http://localhost:8080/q/health/ready || exit 1
    docker stop trustyai-test
```

### 4. Create Basic CLAUDE.md (2-3 hours)
Generate with `/test-rules-generator` to capture existing test patterns for pytest, MariaDB integration, and FastAPI endpoint testing conventions.

## Detailed Findings

### Unit Tests

**Score: 8.0/10**

| Metric | Value |
|--------|-------|
| Test files | 43 |
| Source files | 67 |
| File ratio | 0.64:1 |
| Test LOC | 13,036 |
| Source LOC | 12,160 |
| LOC ratio | 1.07:1 |
| Framework | pytest |
| Parallelization | pytest-xdist (`-n 4`, `--dist=loadgroup`) |
| Property testing | Hypothesis |
| Async testing | pytest-asyncio (strict mode) |
| Multi-Python | 3.12, 3.14 (matrix) |

**Strengths**:
- Test LOC exceeds source LOC (1.07:1 ratio)
- Comprehensive test coverage across all major modules: core metrics (drift, fairness), endpoints, service layer, serialization, payloads, prometheus
- Uses `pytest-xdist` with loadgroup distribution for parallel test execution
- `xdist_group("mariadb")` markers ensure database tests run sequentially
- `pytest.mark.skipif` for conditional MariaDB tests when extras not installed
- pytest fixtures and class-based test organization

**Gaps**:
- No Hypothesis property-based tests found in test files (dependency declared but may be used sparingly)
- No test coverage for `src/endpoints/evaluation/lm_evaluation_harness.py` or `src/endpoints/explainers/`

### Integration/E2E Tests

**Score: 5.0/10**

**What Exists**:
- `tests/test_app_integration.py`: FastAPI integration tests using `TestClient` — validates endpoint registration, health checks, OpenAPI docs, Prometheus metrics endpoint, and trailing slash handling
- MariaDB integration tests (`test_mariadb_storage.py`, `test_mariadb_migration.py`, `test_payload_reconciliation_maria.py`): Use real MariaDB via `getong/mariadb-action` service container in CI with actual SQL operations
- Database populated from legacy dump file (`tests/resources/legacy_database_dump.sql`)

**What's Missing**:
- No dedicated `e2e/` or `integration/` directories
- No K8s cluster testing (Kind, Minikube, envtest)
- No operator integration testing (despite `ci-publish.yaml` generating operator manifests)
- No multi-version K8s/OCP testing
- No gRPC endpoint testing (protobuf stubs exist but no gRPC integration tests)
- No cross-service testing with the trustyai-service-operator

### Build Integration

**Score: 7.0/10**

**What Exists**:
- **CI Build** (`ci-build.yaml`): Builds Docker image on PRs (requires label: `ok-to-test`, `lgtm`, or `approved`)
- **CI Publish** (`ci-publish.yaml`): Triggered on CI Build completion — pushes image to Quay (`trustyai-service-python-ci`), generates operator manifests by cloning `trustyai-service-operator` and patching `params.env`, pushes manifests to `trustyai-service-operator-ci` repo, and comments on PR with image tag and manifest reference
- **Build and Push** (`build-and-push.yaml`): Release builds on main/tags with proper version tagging
- Build args: `VERSION`, `BUILD_DATE`, `VCS_REF`
- CI images get `quay.expires-after=7d` label (auto-cleanup)

**What's Missing**:
- No Konflux build simulation
- No kustomize build validation
- No deployment testing (image is built and pushed but never started)
- No manifest validation (operator manifests are generated but not validated with `kubectl apply --dry-run`)

### Image Testing

**Score: 6.0/10**

**What Exists**:
- Multi-stage build (builder → runtime) for smaller image size
- UBI10 base image (`registry.access.redhat.com/ubi10/python-314-minimal`) — FIPS-capable
- FIPS crypto policy configuration via `update-crypto-policies --set FIPS`
- Non-root user (`USER 1001`)
- OCI labels with version, build date, VCS ref, FIPS status
- Conditional MariaDB library inclusion based on `EXTRAS` build arg
- Proper cleanup of build tools in runtime stage

**What's Missing**:
- No `HEALTHCHECK` instruction in Containerfile
- No multi-architecture support (`--platform`, `docker buildx`)
- No runtime validation tests (Testcontainers or similar)
- No container startup testing in CI
- No image size optimization validation

### Coverage Tracking

**Score: 5.0/10**

**What Exists**:
- `pytest-cov` in test dependencies with `--cov=src --cov-report=xml`
- Codecov action (`codecov/codecov-action@v7.0.0`) uploads `coverage.xml`
- Coverage runs on both Python 3.12 and 3.14 matrix entries

**What's Missing**:
- No `.codecov.yml` configuration file
- No coverage thresholds (project or patch level)
- `fail_ci_if_error: false` — coverage upload failures don't block PR
- No coverage badge in README
- No coverage trend tracking or regression detection

### CI/CD Automation

**Score: 9.0/10**

**Workflows (6 total)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `python-tests.yaml` | PR + push (main) | Lint (ruff), type check (pyrefly), test (pytest, matrix: 3.12/3.14) |
| `ci-build.yaml` | PR (labeled) | Build Docker image, save as artifact |
| `ci-publish.yaml` | workflow_run (CI Build) | Push CI image to Quay, generate operator manifests |
| `build-and-push.yaml` | push (main/tags) | Build and push release image |
| `scorecard.yaml` | schedule + push (main) | OpenSSF Scorecard analysis |
| `security-scan.yaml` | PR + push (main) | Bandit + CodeQL security scanning |

**Best Practices**:
- All workflows use `concurrency:` with `cancel-in-progress: true`
- uv caching with `cache-dependency-glob: "uv.lock"` across all Python jobs
- Test parallelization with `pytest-xdist -n 4`
- Multi-Python version matrix (3.12, 3.14 including pre-release)
- All GitHub Actions pinned to SHA commits (supply chain security)
- Least-privilege `permissions: read-all` with granular per-job overrides
- Proper `paths-ignore` to skip CI on docs-only changes
- Label-gated PR builds for external contributors
- Workflow chaining: CI Build → CI Publish via `workflow_run`

**Minor Gaps**:
- No `timeout-minutes` set on jobs (could hang indefinitely)

### Static Analysis

**Score: 9.0/10**

#### Linting
- **Ruff**: `select = ["ALL"]` — enables every ruff rule category, with targeted per-file ignores
- **Pyrefly**: Type checking with comprehensive sub-config suppressions for pre-existing issues
- Both run in CI (`python-tests.yaml`) and pre-commit hooks

#### Pre-commit Hooks (15+ hooks)
| Category | Hooks |
|----------|-------|
| File checks | trailing-whitespace, end-of-file-fixer, check-merge-conflict, check-ast, check-toml, check-yaml, check-builtin-literals, check-docstring-first, debug-statements |
| Code quality | ruff-check, ruff-format, pyrefly-check |
| Security | detect-secrets, gitleaks, bandit |
| CI quality | actionlint |
| Docs | markdownlint (warn-only) |
| Commit | check-signoff, conventional-pre-commit |

#### FIPS Compatibility
- `hashlib.md5` usage in `prometheus_publisher.py` uses `usedforsecurity=False` (acceptable for UUID generation)
- Containerfile configures FIPS crypto policy via `update-crypto-policies --set FIPS`
- UBI10 base image is FIPS-capable
- `io.trustyai.fips.compatible="true"` label on image
- No non-FIPS-compliant crypto imports found

#### Dependency Alerts
- **Dependabot**: Configured for 3 ecosystems (pip, github-actions, docker)
- Weekly schedule with team reviewers assigned
- Covers all major dependency categories

### Agent Rules

**Score: 0.0/10**

- **Status**: Missing
- No `CLAUDE.md` in repository root
- No `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` for test creation guidance
- No `.claude/skills/` for custom skills

**Recommendation**: Use `/test-rules-generator` to generate rules capturing the repository's testing conventions:
- pytest patterns (class-based and function-based tests)
- MariaDB integration test setup with `xdist_group` markers
- FastAPI `TestClient` usage for endpoint tests
- `pytest.mark.skipif` for conditional dependency tests
- Coverage requirements and test organization

## Recommendations

### Priority 0 (Critical)
1. **Add coverage enforcement** — Create `.codecov.yml` with 70% project and 80% patch thresholds. Set `fail_ci_if_error: true` in the Codecov action step.
2. **Add container startup validation** — After building the image in `ci-build.yaml`, start it and verify the `/q/health/ready` endpoint returns 200 before saving the artifact.

### Priority 1 (High Value)
1. **Implement E2E tests with Kind cluster** — Test full service deployment via the operator, validate CRUD operations, metric computation, and Prometheus scraping in a realistic environment.
2. **Add multi-architecture builds** — Use `docker buildx` to build for `linux/amd64` and `linux/arm64` in release workflow.
3. **Create CLAUDE.md and agent rules** — Document testing patterns, coding standards, and PR conventions for AI-assisted development.
4. **Add job timeout limits** — Set `timeout-minutes` on all workflow jobs to prevent hanging builds.

### Priority 2 (Nice-to-Have)
1. **Add API contract tests** — Test gRPC and REST API contracts against the operator's expectations.
2. **Implement performance regression testing** — Benchmark metric computation endpoints (drift, fairness) to catch performance regressions.
3. **Add HEALTHCHECK to Containerfile** — Enable container orchestrator health monitoring.
4. **Add Kustomize validation** — Run `kubectl apply --dry-run=server` on generated manifests in CI.

## Comparison to Gold Standards

| Practice | trustyai-service | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|----------|-----------------|---------------------|------------------|---------------|
| Unit test ratio | 1.07:1 LOC | ~1.5:1 | N/A | ~0.8:1 |
| Integration tests | MariaDB only | Multi-layer | Image-focused | envtest + real cluster |
| E2E tests | None | Cypress + API | Multi-tier | Multi-version K8s |
| Coverage enforcement | None | Thresholds | N/A | Codecov gates |
| PR image build | Yes (Quay push) | Yes | Yes | Yes |
| Container validation | Build only | Build + deploy | 5-layer validation | Build + deploy |
| Multi-arch | None | N/A | Yes | Yes |
| FIPS compliance | Crypto policy set | N/A | Build tags | N/A |
| Static analysis | ruff ALL + pyrefly | ESLint strict | golangci-lint | golangci-lint |
| Pre-commit hooks | 15+ hooks | Yes | Partial | Partial |
| Dependabot | 3 ecosystems | Configured | Configured | Configured |
| Agent rules | None | Comprehensive | N/A | N/A |
| CI caching | uv cache | npm cache | Go cache | Go cache |
| Test parallelization | pytest-xdist -n 4 | Jest workers | N/A | Ginkgo parallel |
| Action pinning | SHA commits | SHA commits | Mixed | SHA commits |

## File Paths Reference

### CI/CD Workflows
- `.github/workflows/python-tests.yaml` — Main test pipeline (lint, type-check, tests)
- `.github/workflows/ci-build.yaml` — PR Docker image build
- `.github/workflows/ci-publish.yaml` — CI image push and manifest generation
- `.github/workflows/build-and-push.yaml` — Release image build and push
- `.github/workflows/scorecard.yaml` — OpenSSF Scorecard
- `.github/workflows/security-scan.yaml` — Bandit + CodeQL scanning

### Testing
- `tests/` — All test files (43 test files)
- `tests/test_app_integration.py` — FastAPI integration tests
- `tests/service/data/test_mariadb_storage.py` — MariaDB integration tests
- `tests/resources/legacy_database_dump.sql` — Test database fixture

### Configuration
- `pyproject.toml` — Project config, dependencies, ruff/pytest/bandit/pyrefly settings
- `.pre-commit-config.yaml` — 15+ pre-commit hooks
- `.github/dependabot.yml` — Dependency updates for pip, actions, docker
- `.bandit` — Bandit security scanner config (legacy, also in pyproject.toml)

### Container
- `Containerfile` — Multi-stage UBI10 Python 3.14 build with FIPS crypto policy

### Build Scripts
- `scripts/generate_protos.sh` — Protobuf stub generation
- `scripts/test_upload_endpoint.sh` — Manual endpoint testing script
