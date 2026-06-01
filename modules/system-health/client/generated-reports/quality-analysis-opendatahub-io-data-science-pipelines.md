---
repository: "opendatahub-io/data-science-pipelines"
overall_score: 8.1
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "569 test files across Go/Python/TS but no coverage enforcement or thresholds"
  - dimension: "Integration/E2E"
    score: 9.5
    status: "Exceptional multi-version, multi-mode E2E with Kind clusters, upgrade tests, and matrix coverage"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR image builds with 7 images, Tekton pipelines for production, but no Konflux simulation"
  - dimension: "Image Testing"
    score: 6.5
    status: "12 images built, SBOM via Syft, but no runtime validation or startup testing"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "Frontend has Vitest coverage, backend Go and SDK Python have no coverage tracking"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "50+ workflows with concurrency control, path filtering, reusable actions, multi-K8s matrix"
  - dimension: "Agent Rules"
    score: 8.5
    status: "Comprehensive 32KB AGENTS.md with testing policy, development setup, and architectural guidelines"
critical_gaps:
  - title: "No coverage tracking for Go backend or Python SDK"
    impact: "Cannot detect coverage regressions; no visibility into untested code paths in critical backend"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container image runtime validation"
    impact: "Image startup failures not caught until deployment; broken imports or missing deps undetected"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Pre-commit workflow disabled in downstream"
    impact: "Linting not enforced on PRs in downstream fork; code quality inconsistencies"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "CodeQL only runs on weekly schedule, not on PRs"
    impact: "Security vulnerabilities in new code not caught until weekly scan"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No secret detection tooling (Gitleaks/TruffleHog)"
    impact: "Accidental credential commits could go undetected"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "Unit test workflow uses outdated Go 1.21 and actions/checkout@v3"
    impact: "Unit tests may not reflect actual build behavior; outdated action versions"
    severity: "MEDIUM"
    effort: "1 hour"
quick_wins:
  - title: "Add codecov/coveralls for Go backend and Python SDK"
    effort: "4-6 hours"
    impact: "Enable coverage visibility, PR comments, and regression detection for the two largest code areas"
  - title: "Enable CodeQL on pull_request trigger"
    effort: "30 minutes"
    impact: "Catch security issues in new code before merge instead of weekly"
  - title: "Add Gitleaks secret scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Prevent accidental credential leaks in PRs"
  - title: "Update unit-tests.yaml to match current Go version and checkout@v6"
    effort: "30 minutes"
    impact: "Ensure unit test environment matches production build; consistent action versions"
  - title: "Add container startup validation to image-builds workflow"
    effort: "3-4 hours"
    impact: "Catch import errors, missing deps, and startup crashes before deployment"
recommendations:
  priority_0:
    - "Add Go backend coverage tracking with codecov integration and PR reporting"
    - "Add Python SDK coverage tracking with pytest-cov and codecov"
    - "Enable CodeQL scanning on PR trigger for all three languages (Go, Python, JavaScript)"
  priority_1:
    - "Add container image runtime validation (startup test for each built image)"
    - "Add Gitleaks/TruffleHog secret scanning to CI"
    - "Update unit-tests.yaml to current Go version and latest action versions"
    - "Re-enable pre-commit linting workflow or integrate golangci-lint into a PR-triggered workflow"
  priority_2:
    - "Add .claude/rules/ directory with test type-specific rules for agents"
    - "Add image vulnerability scanning on PR builds (Trivy on built images, not just filesystem)"
    - "Add multi-architecture build testing (arm64 validation)"
    - "Add performance/load testing for API server endpoints"
---

# Quality Analysis: data-science-pipelines

## Executive Summary

- **Overall Score: 8.1/10**
- **Repository Type**: Polyglot monorepo (Go backend, Python SDK, TypeScript frontend) for Kubeflow Pipelines
- **Key Strengths**: Exceptional E2E testing infrastructure with multi-K8s version matrices, comprehensive CI/CD with 50+ workflows, excellent AGENTS.md documentation, Tekton production pipelines, strong pre-commit configuration
- **Critical Gaps**: No coverage tracking for Go/Python (the two largest codebases), no container runtime validation, CodeQL not on PRs, no secret detection
- **Agent Rules Status**: Present and comprehensive (AGENTS.md symlinked as CLAUDE.md), but no `.claude/rules/` directory for test-type-specific guidance

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | 569 test files across 3 languages but no coverage enforcement |
| Integration/E2E | 9.5/10 | Exceptional multi-version, multi-mode E2E with Kind clusters and upgrade tests |
| Build Integration | 7.0/10 | PR image builds for 7 images, Tekton for production, no Konflux simulation |
| Image Testing | 6.5/10 | 12 images built with SBOM, but no runtime validation or startup testing |
| Coverage Tracking | 4.0/10 | Frontend has Vitest coverage; Go backend and Python SDK have none |
| CI/CD Automation | 9.0/10 | 50+ workflows with concurrency, path filtering, reusable actions |
| Agent Rules | 8.5/10 | Comprehensive 32KB AGENTS.md with testing, architectural, and commit policies |

## Critical Gaps

### 1. No Coverage Tracking for Go Backend or Python SDK
- **Impact**: Cannot detect coverage regressions; no visibility into untested code paths in the most critical components (662 Go source files, 914 Python source files)
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The Go unit test workflow (`unit-tests.yaml`) runs `go test ./...` without any coverage flags. The Python SDK tests run via `presubmit-tests-sdk.sh` with `pytest-cov` installed but no coverage reporting to an external service. No `.codecov.yml` or `coveralls.yml` exists in the repository.

### 2. No Container Image Runtime Validation
- **Impact**: Image startup failures, broken imports, or missing dependencies are not caught until actual deployment
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The `image-builds.yml` workflow builds 12 images but only saves them as tar artifacts for downstream E2E tests. No intermediate step validates that images can start, respond to health checks, or have correct entrypoints.

### 3. Pre-commit Workflow Disabled in Downstream
- **Impact**: Linting is not enforced on PRs in the downstream (opendatahub-io) fork
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: The `pre-commit.yml` workflow has `on: []` (disabled) with a comment "This workflow is disabled in downstream because we require linting upstream." However, the golangci-lint action is still configured and could be enabled. This means Go code quality enforcement depends entirely on upstream.

### 4. CodeQL Only Runs on Weekly Schedule
- **Impact**: Security vulnerabilities in new code are not caught until the next weekly scan (Friday 19:39 UTC)
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: The `codeql.yml` workflow only triggers on `schedule` (weekly). Adding `pull_request` and `push` triggers would catch security issues before merge for all three analyzed languages (Go, JavaScript, Python).

### 5. No Secret Detection Tooling
- **Impact**: Accidental credential commits could go undetected
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: No Gitleaks, TruffleHog, or similar secret scanning tool is configured. Given the repo handles cloud credentials (AWS, GCP) and cluster configurations, this is a notable gap.

### 6. Unit Test Workflow Uses Outdated Toolchain
- **Impact**: Unit tests may run against a different Go version than production builds
- **Severity**: MEDIUM
- **Effort**: 1 hour
- **Details**: `unit-tests.yaml` uses `actions/checkout@v3`, `actions/setup-go@v4` with Go 1.21.x, while the production Dockerfile uses Go 1.26 (UBI9 go-toolset). Other workflows use `actions/checkout@v6` and the `.github/actions/setup-go` composite action for consistency.

## Quick Wins

### 1. Add Codecov for Go Backend and Python SDK (4-6 hours)
- **Impact**: Enable coverage visibility, PR comments, and regression detection
- **Implementation**:
  - Go: Add `-coverprofile=coverage.out -covermode=atomic` to `go test` command
  - Python: Add `--cov --cov-report=xml` to pytest invocation
  - Add `.codecov.yml` with coverage thresholds
  - Add codecov upload step to both workflows

### 2. Enable CodeQL on PR Trigger (30 minutes)
- **Impact**: Catch security issues before merge
- **Implementation**: Add `pull_request:` and `push: branches: [main, master, stable]` triggers to `codeql.yml`

### 3. Add Gitleaks Secret Scanning (1-2 hours)
- **Impact**: Prevent accidental credential leaks
- **Implementation**: Add a new workflow or integrate gitleaks-action into existing PR checks

### 4. Update unit-tests.yaml (30 minutes)
- **Impact**: Consistent toolchain across all workflows
- **Implementation**: Replace `actions/checkout@v3` with `@v6`, `actions/setup-go@v4` with `./.github/actions/setup-go`, update Go version

### 5. Add Container Startup Validation (3-4 hours)
- **Impact**: Catch startup failures before E2E stage
- **Implementation**: After building images in `image-builds.yml`, run a quick `docker run --rm <image> --help` or health check for each image

## Detailed Findings

### CI/CD Pipeline

**Strengths**:
- **50+ workflows** covering unit tests, integration tests, E2E tests, SDK tests, frontend tests, image builds, release management, and more
- **Excellent concurrency control**: Most workflows use `concurrency` groups with `cancel-in-progress: true` to avoid redundant runs
- **Path-based triggering**: Workflows are scoped to relevant paths (e.g., `backend/**` for backend tests, `frontend/**` for frontend tests, `sdk/**` for SDK tests)
- **Reusable composite actions**: `.github/actions/` contains `create-cluster`, `deploy`, `test-and-report`, `build`, `setup-go`, `protobuf`, `kfp-k8s` — modular and DRY
- **Multi-version K8s matrix**: E2E and API tests run across K8s v1.29.2, v1.31.0, and v1.34.0
- **Multi-Argo version testing**: API server tests validate against Argo v3.5.14, v3.7.3, and v4.0.4
- **Upgrade testing**: Dedicated `upgrade-test.yml` deploys the last stable release, runs preparation tests, upgrades to branch, and verifies upgrade
- **PR image builds**: `build-prs.yml` builds 7 images per PR and posts deployment instructions as PR comments
- **Tekton pipelines**: `.tekton/` contains 5 production pipeline definitions for Konflux/RHOAI builds

**Weaknesses**:
- Pre-commit workflow disabled (`on: []`)
- CodeQL on schedule only, not on PRs
- Unit test workflow uses outdated Go version and action versions
- No workflow for dependency update automation (Dependabot/Renovate)

### Test Coverage

**File Counts**:
| Category | Test Files | Source Files | Ratio |
|----------|-----------|-------------|-------|
| Go backend | 156 | 662 | 23.6% |
| Python SDK | 59 | 914 | 6.5% |
| TypeScript frontend | 162 | 475 | 34.1% |
| K8s platform Python | 13 | - | - |
| E2E/Integration (Go) | 40 | - | - |
| **Total** | **430+** | **2,051** | **21.0%** |

**Test Frameworks**:
- **Go**: Standard `testing` package + Ginkgo/Gomega for E2E, API, and compiler tests (with parallel execution up to 15 nodes)
- **Python**: pytest with pytest-cov, pytest-xdist for parallel execution
- **TypeScript**: Vitest + Testing Library for UI tests, Vitest for server tests
- **Frontend E2E**: WebDriverIO-based containerized integration tests

**Test Organization**:
- `backend/test/v2/api/` — API server integration tests (Ginkgo, label-filterable: ApiServerTests, UpgradePreparation, UpgradeVerification)
- `backend/test/end2end/` — E2E pipeline tests (Ginkgo, labels: E2ECritical, E2EEssential, E2EParallelNested, E2EProxy, E2EFailure)
- `backend/test/compiler/` — Compiler golden tests (Ginkgo)
- `backend/test/integration/` — Legacy v1 integration tests
- `sdk/python/kfp/` — SDK unit tests (pytest)
- `frontend/` — 162 UI test files (Vitest + Testing Library)
- `test/frontend-integration-test/` — Containerized frontend E2E tests
- `test/server-integration-test/` — Node.js server integration tests
- `kubernetes_platform/python/test/` — K8s platform extension tests

**Coverage Tracking**:
- Frontend: `npm run test:ui:coverage` generates Vitest coverage; `npm run test:coverage` combines UI + server coverage
- Go backend: No coverage generation (no `-coverprofile` flag in `unit-tests.yaml`)
- Python SDK: pytest-cov is installed in `kfp-sdk-tests.yml` but output is not collected or reported
- No codecov/coveralls integration; no `.codecov.yml`

### Code Quality

**Strengths**:
- **golangci-lint v2**: Configured in `.golangci.yaml` with 6 linters enabled (gocritic, govet, ineffassign, misspell, staticcheck, unused) and gofmt/goimports formatters
- **Pre-commit hooks**: Comprehensive `.pre-commit-config.yaml` with 12+ hooks including check-yaml, check-json, flake8, pycln, isort, yapf, docformatter, golangci-lint, and actionlint
- **Python quality**: mypy configured (though with `ignore_missing_imports = true`), isort with Google profile, yapf formatter, flake8, pylint, docformatter
- **Frontend quality**: ESLint, Prettier, TypeScript strict mode checks, lockfile drift detection
- **Go version consistency**: Dedicated `go-version-consistency.yml` workflow ensures all Go-related files use the same version
- **Generated file validation**: Frontend workflow verifies generated API clients are up to date

**Weaknesses**:
- Pre-commit workflow disabled in downstream fork
- mypy configured with `ignore_missing_imports = true` (reduces type checking effectiveness)
- golangci-lint excludes all API-generated code paths
- No dependency update automation (Dependabot/Renovate)

### Container Images

**Strengths**:
- **12 images** built in CI via `image-builds.yml` using matrix strategy
- **FIPS-enabled builds**: Backend Dockerfile supports `FIPS_ENABLED=1` with BoringCrypto
- **UBI9 base images**: Using Red Hat Universal Base Image 9 (e.g., `registry.access.redhat.com/ubi9/go-toolset:1.26.2`)
- **Multi-stage builds**: Backend Dockerfile uses builder pattern
- **SBOM configuration**: `.syft.yaml` configured to exclude non-Go components from SBOM generation
- **Tekton pipelines**: 5 Tekton pipeline definitions in `.tekton/` for production Konflux builds
- **PR image cleanup**: `build-prs.yml` automatically deletes PR-tagged images when PRs are closed

**Weaknesses**:
- No runtime validation of built images (no startup tests, health checks)
- No multi-architecture build testing (TARGETARCH defaults to amd64)
- No Trivy scanning on built container images (Trivy only scans filesystem)
- No image signing or attestation in CI (likely handled by Tekton/Konflux)

### Security

**Strengths**:
- **Trivy filesystem scanning**: Runs on PRs, pushes, and weekly schedule; scans for CRITICAL and HIGH vulnerabilities; uploads SARIF to GitHub Security tab
- **CodeQL analysis**: Covers Go, JavaScript, and Python languages
- **FIPS compliance**: Backend supports FIPS-enabled builds via BoringCrypto
- **SBOM generation**: Syft configured for Go component SBOM

**Weaknesses**:
- CodeQL only runs on weekly schedule, not on PRs
- No secret detection (Gitleaks, TruffleHog)
- Trivy only scans filesystem, not built container images
- No dependency scanning (Dependabot/Renovate)
- No SAST beyond CodeQL (no gosec, Semgrep)

### Agent Rules (Agentic Flow Quality)

**Status**: Present and comprehensive
- **AGENTS.md**: 32KB+ comprehensive guide covering architecture, local development, testing, CI/CD, frontend development, troubleshooting, and quick reference
- **CLAUDE.md**: Symlink to AGENTS.md (ensuring Claude Code agents use the same guide)
- **Testing Policy**: Explicit policy requiring unit tests for non-trivial functions, all tests passing before push, and verification of existing tests when modifying code
- **Commit Policy**: Requires `git commit -s` for DCO sign-off, prohibits AI co-author credits
- **Architectural Boundary Policy**: Clear guidelines for ResourceManager, compiler boundaries, and engine-neutral design
- **Code Reuse Policy**: Explicit instructions to search for existing implementations before writing new code

**Gaps**:
- No `.claude/rules/` directory with test-type-specific rules
- No structured test patterns or templates for different test types (unit, integration, E2E)
- Agent guidance is in a single large file rather than modular, type-specific rules
- No guidance on mocking strategies or test fixture patterns beyond what's in test infrastructure code

## Recommendations

### Priority 0 (Critical)

1. **Add Go backend coverage tracking with codecov integration and PR reporting**
   - Add `-coverprofile=coverage.out -covermode=atomic` to Go test command
   - Add codecov upload step
   - Create `.codecov.yml` with target thresholds

2. **Add Python SDK coverage tracking with pytest-cov and codecov**
   - Add `--cov=kfp --cov-report=xml` to pytest invocation in `presubmit-tests-sdk.sh`
   - Add codecov upload step

3. **Enable CodeQL scanning on PR trigger**
   - Add `pull_request:` trigger to `codeql.yml`
   - Scope to relevant file paths per language

### Priority 1 (High Value)

1. **Add container image runtime validation**
   - After building images in `image-builds.yml`, add a step that runs each image with `--help` or a health check
   - Verify entrypoints are correctly configured

2. **Add Gitleaks/TruffleHog secret scanning**
   - Create `.github/workflows/secret-scan.yml` with PR trigger
   - Configure `.gitleaks.toml` with appropriate allow rules

3. **Update unit-tests.yaml to current toolchain**
   - Use `actions/checkout@v6`, `./.github/actions/setup-go`, and current Go version
   - Align with patterns used in other workflows

4. **Re-enable pre-commit linting or create dedicated Go lint workflow**
   - Either re-enable the pre-commit workflow or create a focused `golangci-lint.yml` with PR trigger

### Priority 2 (Nice-to-Have)

1. **Add `.claude/rules/` directory with test-type-specific rules**
   - Create rules for unit tests, integration tests, E2E tests, and compiler tests
   - Include framework-specific patterns (Ginkgo for Go, pytest for Python, Vitest for TS)

2. **Add Trivy container image scanning**
   - Extend Trivy to scan built images, not just filesystem
   - Set vulnerability thresholds for PR blocking

3. **Add multi-architecture build validation**
   - Test arm64 builds in CI to catch platform-specific issues

4. **Add Dependabot/Renovate for dependency updates**
   - Auto-update Go modules, Python packages, npm packages, and GitHub Actions

5. **Add performance regression testing**
   - API server response time benchmarks
   - Pipeline compilation performance tests

## Comparison to Gold Standards

| Dimension | data-science-pipelines | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|-----------|----------------------|---------------------|------------------|---------------|
| Unit Tests | 7.5 - 569 files, no coverage enforcement | 9.0 - Coverage enforced | 7.0 - Image-focused | 9.0 - Coverage thresholds |
| Integration/E2E | 9.5 - Multi-K8s, multi-mode, upgrade | 8.5 - Multi-layer | 8.0 - 5-layer validation | 9.0 - Multi-version |
| Build Integration | 7.0 - PR builds, Tekton, no Konflux sim | 8.0 - PR-time validation | 7.5 - Image pipeline | 7.0 - Standard builds |
| Image Testing | 6.5 - SBOM, no runtime validation | 7.0 - Basic validation | 9.5 - 5-layer image testing | 7.0 - Standard |
| Coverage Tracking | 4.0 - Frontend only | 9.0 - Codecov enforced | 6.0 - Partial | 9.0 - Thresholds |
| CI/CD Automation | 9.0 - 50+ workflows, excellent | 9.0 - Comprehensive | 8.0 - Strong | 8.5 - Well-organized |
| Agent Rules | 8.5 - 32KB AGENTS.md | 9.0 - Modular rules | 5.0 - Basic | 6.0 - Partial |

## File Paths Reference

### CI/CD Configuration
- `.github/workflows/` — 50+ workflow files
- `.github/actions/` — Reusable composite actions (create-cluster, deploy, test-and-report, build, setup-go, protobuf, kfp-k8s)
- `.tekton/` — 5 Tekton pipeline definitions for Konflux builds
- `Makefile` — Build and test targets
- `justfile` — Alternative task runner

### Testing Infrastructure
- `backend/test/v2/api/` — API server integration tests (Ginkgo)
- `backend/test/end2end/` — E2E pipeline tests (Ginkgo)
- `backend/test/compiler/` — Compiler golden tests (Ginkgo)
- `backend/test/integration/` — Legacy v1 integration tests
- `backend/test/initialization/` — Initialization tests
- `sdk/python/kfp/` — SDK unit tests (pytest)
- `kubernetes_platform/python/test/` — K8s platform tests (pytest)
- `frontend/` — 162 Vitest + Testing Library test files
- `test/frontend-integration-test/` — Containerized frontend E2E (WebDriverIO)
- `test/server-integration-test/` — Node.js server integration tests
- `test_data/` — Test data, compiled pipelines, golden files

### Code Quality
- `.golangci.yaml` — golangci-lint v2 configuration (6 linters)
- `.pre-commit-config.yaml` — 12+ hooks (disabled in downstream)
- `mypy.ini` — Python type checking (ignore_missing_imports)
- `.pylintrc` — Python linting
- `.isort.cfg` — Python import sorting
- `.style.yapf` — Python code formatting
- `pytest.ini` — pytest configuration

### Container Images
- `backend/Dockerfile` — Main API server (multi-stage, FIPS, UBI9)
- `backend/Dockerfile.*` — Persistence agent, scheduled workflow, driver, launcher, etc.
- `frontend/Dockerfile` — Frontend image
- `.syft.yaml` — SBOM generation configuration
- `.dockerignore` — Docker build exclusions

### Security
- `.github/workflows/trivy.yml` — Filesystem vulnerability scanning
- `.github/workflows/codeql.yml` — SAST (Go, JavaScript, Python)

### Agent Rules
- `AGENTS.md` — Comprehensive 32KB agent guide
- `CLAUDE.md` — Symlink to AGENTS.md
