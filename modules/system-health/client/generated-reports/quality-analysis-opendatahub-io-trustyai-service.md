---
repository: "opendatahub-io/trustyai-service"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Excellent unit test suite with 445 tests, property-based testing via Hypothesis, strong test-to-code ratio"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "Good integration tests with real MariaDB in CI, FastAPI TestClient usage, but no dedicated E2E suite"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-time Docker builds with CI image publishing, Tekton/Konflux pipelines, operator manifest generation"
  - dimension: "Image Testing"
    score: 6.5
    status: "Multi-stage UBI10 build with FIPS policy support, but no runtime validation or multi-arch in GitHub CI"
  - dimension: "Coverage Tracking"
    score: 7.0
    status: "Codecov integration with pytest-cov, but no coverage thresholds or gate enforcement"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "Well-organized workflows with concurrency control, uv caching, matrix testing, pinned actions"
  - dimension: "Static Analysis"
    score: 9.0
    status: "Comprehensive ruff ALL rules, pyrefly type checking, bandit security, pre-commit hooks, Dependabot for 3 ecosystems"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory present"
critical_gaps:
  - title: "No coverage threshold enforcement"
    impact: "Coverage can silently regress without any CI gate to catch it"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No dedicated E2E test suite"
    impact: "End-to-end service behavior in a Kubernetes-like environment is not validated pre-merge"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No container runtime validation"
    impact: "Image startup issues and health check failures not caught until deployment"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents have no guidance for test patterns, code conventions, or contribution standards"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add Codecov coverage threshold to fail PRs below minimum"
    effort: "1-2 hours"
    impact: "Prevent silent coverage regression with a hard gate in CI"
  - title: "Create .claude/rules/ with test creation rules"
    effort: "2-3 hours"
    impact: "Guide AI agents to produce tests matching existing patterns (pytest, Hypothesis, TestClient)"
  - title: "Add container startup smoke test in CI"
    effort: "2-4 hours"
    impact: "Catch image build issues and startup failures before merge"
  - title: "Add HEALTHCHECK instruction to Containerfile"
    effort: "1 hour"
    impact: "Enable container orchestrators to detect unhealthy instances"
recommendations:
  priority_0:
    - "Add Codecov coverage threshold enforcement (e.g., 80% minimum, 5% max regression per PR)"
    - "Add container runtime smoke test in CI build workflow (docker run + health check)"
  priority_1:
    - "Create E2E test suite that validates the service in a realistic deployment scenario"
    - "Add CLAUDE.md and .claude/rules/ with test automation guidance for AI agents"
    - "Add multi-architecture build support in GitHub Actions CI"
  priority_2:
    - "Add HEALTHCHECK instruction to Containerfile"
    - "Add contract tests for all API endpoints beyond the current async storage contract test"
    - "Consider adding performance regression tests for fairness/drift metric endpoints"
---

# Quality Analysis: trustyai-service

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Python FastAPI service for AI explainability, fairness, and drift detection
- **Primary Language**: Python 3.12+ (targeting 3.14)
- **Framework**: FastAPI with Hypercorn ASGI server
- **Jira**: RHOAIENG / AI Safety (midstream tier)

**Key Strengths**: Exceptional static analysis setup (ruff with ALL rules, pyrefly type checking, bandit security scanning), comprehensive pre-commit hooks with conventional commits, strong unit test suite with property-based testing via Hypothesis, PR-time Docker image builds with CI manifest generation, and well-structured Tekton/Konflux pipelines.

**Critical Gaps**: No coverage enforcement thresholds, no dedicated E2E test suite for Kubernetes deployment scenarios, no container runtime validation, and no agent rules for AI-assisted development.

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 8.5/10 | Excellent test suite with 445 tests, Hypothesis property-based testing |
| Integration/E2E | 20% | 7.0/10 | Good integration tests with real MariaDB, no dedicated E2E suite |
| Build Integration | 15% | 8.0/10 | PR-time Docker builds, Tekton/Konflux pipelines, operator manifests |
| Image Testing | 10% | 6.5/10 | Multi-stage UBI10 build, FIPS policy, no runtime validation |
| Coverage Tracking | 10% | 7.0/10 | Codecov integration, no threshold enforcement |
| CI/CD Automation | 15% | 8.5/10 | Well-organized, concurrency control, matrix testing, pinned actions |
| Static Analysis | 10% | 9.0/10 | ruff ALL rules, pyrefly, bandit, pre-commit, Dependabot 3 ecosystems |
| Agent Rules | 5% | 0.0/10 | No CLAUDE.md, AGENTS.md, or .claude/ directory |

**Weighted Overall: 7.6/10**

## Critical Gaps

### 1. No Coverage Threshold Enforcement
- **Severity**: HIGH
- **Impact**: Coverage can silently regress without any CI gate. The `codecov-action` is configured with `fail_ci_if_error: false`, so even upload failures don't block PRs. No `.codecov.yml` exists to define coverage targets.
- **Effort**: 2-4 hours
- **Fix**: Create `.codecov.yml` with project and patch coverage thresholds:
  ```yaml
  coverage:
    status:
      project:
        default:
          target: 80%
          threshold: 2%
      patch:
        default:
          target: 90%
  ```

### 2. No Dedicated E2E Test Suite
- **Severity**: HIGH
- **Impact**: The service's behavior in a Kubernetes-like environment (operator deployment, model serving integration, PVC storage mounting) is not validated before merge. The existing `test_app_integration.py` validates FastAPI endpoint registration but not deployed-service behavior.
- **Effort**: 16-24 hours
- **Fix**: Create an `e2e/` directory with tests that deploy the service container and validate health endpoints, metric computation, and data upload workflows.

### 3. No Container Runtime Validation
- **Severity**: MEDIUM
- **Impact**: The CI Build workflow (`ci-build.yaml`) builds the Docker image but does not verify it starts correctly or responds to health checks. Image startup failures (missing dependencies, import errors) would not be caught until deployment.
- **Effort**: 4-8 hours
- **Fix**: Add a smoke test step after `docker build` that runs the container and verifies health endpoints respond.

### 4. No Agent Rules
- **Severity**: MEDIUM
- **Impact**: AI coding agents have no guidance for test patterns (pytest conventions, Hypothesis usage, TestClient patterns), code style (ruff ALL rules expectations), or contribution standards (conventional commits, signed-off-by).
- **Effort**: 2-4 hours
- **Fix**: Create `CLAUDE.md` and `.claude/rules/` directory with test creation guidance.

## Quick Wins

### 1. Add Codecov Coverage Threshold
- **Effort**: 1-2 hours
- **Impact**: Prevent silent coverage regression
- **Implementation**: Create `.codecov.yml` at repo root with coverage gates

### 2. Create Agent Rules for Test Patterns
- **Effort**: 2-3 hours
- **Impact**: Guide AI agents to produce consistent, high-quality tests
- **Implementation**: Create `CLAUDE.md` documenting:
  - pytest conventions used (class-based test organization, `@pytest.mark.xdist_group`)
  - Hypothesis property-based testing patterns for metrics
  - FastAPI TestClient usage for endpoint tests
  - MariaDB test isolation with `@pytest.mark.xdist_group("mariadb")`

### 3. Add Container Startup Smoke Test
- **Effort**: 2-4 hours
- **Impact**: Catch image startup failures before merge
- **Implementation**: Add to `ci-build.yaml`:
  ```yaml
  - name: Smoke test
    run: |
      docker run -d --name smoke -p 8080:8080 trustyai-ci:${{ github.event.pull_request.head.sha }}
      sleep 5
      curl -f http://localhost:8080/q/health/ready || exit 1
      docker stop smoke
  ```

### 4. Add HEALTHCHECK to Containerfile
- **Effort**: 1 hour
- **Impact**: Enable container orchestrators to detect unhealthy instances
- **Implementation**: Add before `CMD`:
  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/q/health/ready')" || exit 1
  ```

## Detailed Findings

### Unit Tests

**Score: 8.5/10**

Excellent unit test suite with strong coverage across the codebase:

- **44 test files** containing **445 test methods** covering core metrics, endpoints, serialization, storage, and middleware
- **Test-to-code ratio**: 0.66:1 by file count (44 test files / 67 source files), 0.90:1 by line count (10,945 test lines / 12,160 source lines) — strong ratio
- **Framework**: pytest with `pytest-asyncio` for async tests, `pytest-xdist` for parallel execution (4 workers by default)
- **Property-based testing**: Hypothesis used for fairness metrics and drift detection tests with configurable `max_examples` and `deadline` settings
- **Test organization**: Well-structured class-based tests that mirror source code structure
- **Test isolation**: `@pytest.mark.xdist_group("mariadb")` for database tests, async fixtures for service tests
- **Advanced patterns**: Contract testing (`test_async_contract.py`) that verifies storage interface compliance via reflection

**Strengths**:
- `ruff` lint rules include test file exemptions (`S101`, `PT019`, `SLF001`) showing thoughtful configuration
- `pytest.ini_options` configured with `asyncio_mode = "strict"` and `addopts = "--dist=loadgroup -n 4"` for parallel execution
- Factory pattern in `tests/endpoints/metrics/drift/factory.py` and `tests/core/metrics/drift/factory.py` for reusable test data generation

**Files**:
- `pyproject.toml` — pytest config, test dependencies (lines 41-49, 131-133)
- `tests/` — comprehensive test tree mirroring `src/` structure

### Integration/E2E Tests

**Score: 7.0/10**

Good integration testing with real database backends, but lacking a dedicated E2E suite:

- **MariaDB integration**: Real MariaDB instance spun up in CI via `getong/mariadb-action` with schema population from SQL dump
- **FastAPI TestClient**: Used across 10+ test files for endpoint integration testing
- **App integration**: `test_app_integration.py` validates endpoint registration, health checks, OpenAPI docs, and Prometheus metrics
- **Storage integration**: Tests against both PVC and MariaDB storage backends
- **Async contract test**: Verifies all storage implementations comply with async interface contract

**Gaps**:
- No dedicated `e2e/` or `integration/` directory — integration tests are mixed with unit tests in `tests/`
- No Kubernetes-based testing (no Kind, Minikube, or envtest)
- No multi-version testing beyond Python version matrix (3.12, 3.14)
- No operator deployment validation or model serving integration tests

### Build Integration

**Score: 8.0/10**

Strong PR-time build validation with a sophisticated two-stage CI pipeline:

- **PR Docker builds**: `ci-build.yaml` builds the Containerfile on every labeled PR, saves image as artifact
- **CI image publishing**: `ci-publish.yaml` publishes PR images to Quay.io after successful build, generates operator manifests for testing
- **Operator manifest generation**: Automatically clones `trustyai-service-operator`, patches image references, and pushes CI manifests to a dedicated repo (`trustyai-service-operator-ci`)
- **PR commenting**: Posts image URL and manifest configuration instructions on the PR
- **Tekton/Konflux**: `.tekton/` directory with pull-request and push pipelines referencing `odh-konflux-central` multi-arch container build pipeline
- **Release pipeline**: `build-and-push.yaml` handles tagged releases with semantic versioning and multi-tag support

**Strengths**:
- Pinned GitHub Actions with SHA hashes (not tag references) — excellent supply chain security
- `read-all` permissions with granular per-job overrides
- Concurrency control on all workflows
- Automated expiry labels (`quay.expires-after=7d`) on CI images

**Gaps**:
- No image startup validation after build (build passes but image may not start)
- No dry-run manifest validation (`kubectl apply --dry-run`)

### Image Testing

**Score: 6.5/10**

Well-crafted Containerfile with FIPS awareness but limited runtime validation:

- **Multi-stage build**: Builder stage (UBI10 Python 3.14 minimal with dev tools) + Runtime stage (minimal, no compilers)
- **UBI10 base**: `registry.access.redhat.com/ubi10/python-314-minimal:latest` — FIPS-capable base image
- **FIPS crypto policy**: Configurable via `ENABLE_FIPS_POLICY` build arg, sets system crypto policy to FIPS
- **Conditional dependencies**: MariaDB C libraries only installed when `EXTRAS` includes `mariadb`
- **Security**: Non-root user (1001), no unnecessary packages in runtime stage
- **OCI labels**: Full set of OCI image labels including FIPS compatibility markers

**Gaps**:
- No `HEALTHCHECK` instruction in Containerfile
- No multi-architecture build in GitHub Actions (Tekton handles multi-arch via `odh-konflux-central`)
- No runtime smoke test after image build
- No `.dockerignore` file found (could include test files and dev artifacts in image context)

### Coverage Tracking

**Score: 7.0/10**

Coverage generation and reporting in place, but no enforcement:

- **pytest-cov**: Tests run with `--cov=src --cov-report=xml` generating XML coverage reports
- **Codecov upload**: `codecov/codecov-action@v7.0.0` uploads coverage on every test run
- **Multi-Python coverage**: Coverage generated for both Python 3.12 and 3.14 matrix builds
- **Coverage in dev deps**: `pytest-cov>=7.1.0` listed in test dependency group

**Gaps**:
- **No `.codecov.yml`**: No coverage thresholds defined
- **No gate enforcement**: `fail_ci_if_error: false` means even upload failures don't block PRs
- **No patch coverage**: No requirement for new code to meet minimum coverage
- **No coverage badge**: No README badge showing current coverage percentage

### CI/CD Automation

**Score: 8.5/10**

Well-organized CI/CD with excellent security and automation practices:

**Workflow Inventory** (6 workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `python-tests.yaml` | push (main), PR | Lint, type check, test (matrix 3.12/3.14) |
| `ci-build.yaml` | PR (labeled) | Build Docker image |
| `ci-publish.yaml` | workflow_run (CI Build) | Publish CI image, generate operator manifests |
| `build-and-push.yaml` | push (main), tags | Release image to Quay.io |
| `security-scan.yaml` | push (main), PR, dispatch | Bandit + CodeQL security scans |
| `scorecard.yaml` | schedule (weekly), push (main) | OpenSSF Scorecard |

**Strengths**:
- **Concurrency control**: All PR workflows use `cancel-in-progress: true`
- **Caching**: `setup-uv` with `enable-cache: true` and `cache-dependency-glob: "uv.lock"`
- **Matrix testing**: Python 3.12 + 3.14 (pre-release) with `fail-fast: false`
- **Pinned actions**: All actions pinned to commit SHAs, not tags
- **Least privilege**: `permissions: read-all` at workflow level with granular per-job overrides
- **Path filtering**: CI Build and Build-and-Push ignore docs/license changes
- **Test parallelization**: `pytest-xdist` with `-n 4` workers by default

**Gaps**:
- No scheduled/periodic test runs (only OpenSSF Scorecard runs on schedule)
- No performance benchmarking in CI

### Static Analysis

**Score: 9.0/10**

Comprehensive static analysis with multiple layers of quality enforcement:

#### Linting
- **ruff**: `select = ["ALL"]` — the most comprehensive ruff configuration possible, with only 4 rules disabled (conflicting rules). Per-file ignores are carefully documented for both src and test files.
- **ruff-format**: Integrated formatter with format checking in CI

#### Type Checking
- **pyrefly**: Meta's Python type checker with detailed per-file suppression configs. Currently has broad suppressions for pre-existing issues but they are documented as "will be tightened as code PRs fix root causes."

#### Security Scanning
- **bandit**: Configured in both `pyproject.toml` and `.bandit` with justified skip rules (B608 SQL false positives, B104 intentional 0.0.0.0 binding, B108 /tmp usage)
- **bandit CI integration**: SARIF output uploaded to GitHub Security tab

#### FIPS Compatibility
- **Source code**: One `hashlib.md5` usage found with `usedforsecurity=False` annotation — correctly marked as non-security usage (UUID generation). No other non-FIPS-compliant crypto imports detected.
- **Containerfile**: UBI10 base images (FIPS-capable), configurable FIPS crypto policy via `update-crypto-policies --set FIPS`
- **Assessment**: Good FIPS awareness with appropriate mitigations

#### Dependency Alerts
- **Dependabot**: Configured for 3 ecosystems:
  - `pip` — weekly updates for Python dependencies
  - `github-actions` — weekly updates for CI actions
  - `docker` — weekly updates for container base images
- Assigned to `trustyai-explainability/reviewers` team

#### Pre-commit Hooks
Comprehensive `.pre-commit-config.yaml` with:
- File checks: trailing whitespace, end-of-file, merge conflict, AST, TOML, YAML
- Code quality: ruff-check, ruff-format
- Type checking: pyrefly (system hook)
- CI linting: actionlint for workflow files
- Markdown: markdownlint (warn-only)
- Commit message: Signed-off-by and conventional commit validation
- `ci:` configuration for pre-commit.ci with appropriate skips for system hooks

### Agent Rules

**Score: 0.0/10**

No agent rules infrastructure present:

- **No `CLAUDE.md`** at repository root
- **No `AGENTS.md`** at repository root
- **No `.claude/` directory** (no rules, no skills)
- **No test creation guidance** for AI agents
- **No code convention documentation** that agents could reference

**Recommendation**: Generate comprehensive agent rules using `/test-rules-generator` to create:
- Unit test patterns (pytest, Hypothesis, class-based organization)
- Endpoint test patterns (FastAPI TestClient, HTTP status assertions)
- Storage test patterns (MariaDB xdist groups, PVC mocking)
- Code style expectations (ruff ALL rules, conventional commits)

## Recommendations

### Priority 0 (Critical)

1. **Add Codecov coverage threshold enforcement** — Create `.codecov.yml` with project target (80%) and patch target (90%) to prevent silent coverage regression. Set `fail_ci_if_error: true` in the Codecov action.

2. **Add container runtime smoke test** — After building the Docker image in `ci-build.yaml`, run the container and verify health endpoints respond before declaring the build successful.

### Priority 1 (High Value)

3. **Create E2E test suite** — Build an `e2e/` directory with tests that deploy the service container (via Docker Compose or Kind) and validate end-to-end workflows: health checks, data upload, metric computation, Prometheus metric emission.

4. **Create CLAUDE.md and .claude/rules/** — Document test patterns, code conventions, and contribution standards for AI-assisted development. Use `/test-rules-generator` to bootstrap rules from existing test patterns.

5. **Add multi-architecture support in GitHub CI** — While Tekton/Konflux handles multi-arch, the GitHub CI pipeline only builds for the runner's architecture. Consider adding `docker buildx` for cross-platform validation.

### Priority 2 (Nice-to-Have)

6. **Add HEALTHCHECK instruction to Containerfile** — Enable container orchestrators to detect unhealthy instances natively.

7. **Expand contract testing** — The existing `test_async_contract.py` is excellent. Extend this pattern to API endpoints (validate request/response schemas match OpenAPI spec).

8. **Add performance regression testing** — For fairness and drift metric computation endpoints, establish baseline latencies and detect regressions in CI.

9. **Add scheduled periodic test runs** — Currently only OpenSSF Scorecard runs on a schedule. Consider weekly full test suite runs to catch flaky tests and dependency issues early.

## Comparison to Gold Standards

| Practice | trustyai-service | odh-dashboard | notebooks | kserve |
|----------|-----------------|---------------|-----------|--------|
| Unit test framework | pytest + Hypothesis | Jest + RTL | pytest | Go testing |
| Test-to-code ratio | 0.90:1 (lines) | ~0.8:1 | ~0.5:1 | ~0.7:1 |
| Integration tests | Real MariaDB in CI | Mock + real | Image testing | envtest |
| E2E suite | None | Cypress | Multi-layer | Ginkgo |
| Coverage tracking | Codecov (no gates) | Codecov (with gates) | None | Codecov (with gates) |
| Coverage enforcement | None | Yes | No | Yes |
| PR Docker build | Yes (with CI publish) | Yes | Yes | Yes |
| Container runtime test | No | No | Yes (5-layer) | No |
| FIPS compliance | UBI10 + crypto policy | N/A | UBI + FIPS tags | N/A |
| Static analysis | ruff ALL + pyrefly + bandit | ESLint + TypeScript | flake8 | golangci-lint |
| Pre-commit hooks | Comprehensive (10+ hooks) | Husky | None | None |
| Dependabot | 3 ecosystems | GitHub Actions only | None | Go modules |
| Agent rules | None | Comprehensive | None | None |
| Pinned actions | SHA-pinned (all) | Tag-pinned | Tag-pinned | SHA-pinned |
| Concurrency control | All workflows | Some workflows | None | All workflows |
| OpenSSF Scorecard | Weekly | None | None | None |

## File Paths Reference

### CI/CD
- `.github/workflows/python-tests.yaml` — Test + lint + type check pipeline
- `.github/workflows/ci-build.yaml` — PR Docker image build
- `.github/workflows/ci-publish.yaml` — CI image publish + operator manifest generation
- `.github/workflows/build-and-push.yaml` — Release image pipeline
- `.github/workflows/security-scan.yaml` — Bandit + CodeQL security scanning
- `.github/workflows/scorecard.yaml` — OpenSSF Scorecard
- `.tekton/odh-trustyai-service-pull-request.yaml` — Konflux PR pipeline
- `.tekton/odh-trustyai-service-push.yaml` — Konflux push pipeline

### Testing
- `tests/` — All tests (44 test files, 445 test methods)
- `tests/test_app_integration.py` — App-level integration tests
- `tests/service/data/test_async_contract.py` — Storage async contract test
- `tests/core/metrics/drift/factory.py` — Hypothesis property-based test factory
- `tests/resources/legacy_database_dump.sql` — MariaDB test data

### Code Quality
- `pyproject.toml` — ruff, pytest, pyrefly, bandit configuration
- `.pre-commit-config.yaml` — 10+ pre-commit hooks
- `.bandit` — Legacy bandit configuration (also in pyproject.toml)
- `.github/dependabot.yml` — Dependabot for pip, github-actions, docker

### Container
- `Containerfile` — Multi-stage UBI10 build with FIPS policy support
