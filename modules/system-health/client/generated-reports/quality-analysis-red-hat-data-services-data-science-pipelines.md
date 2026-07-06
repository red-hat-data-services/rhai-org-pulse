---
repository: "red-hat-data-services/data-science-pipelines"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "463 test files across Go/Python/TS; multi-version Python matrix; no coverage enforcement"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Exceptional E2E suite: multi-K8s-version, multi-Argo-version, TLS/proxy/cache/multi-user matrix"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR image builds with Quay push; Konflux pipelines on-label; no PR-time Konflux simulation"
  - dimension: "Image Testing"
    score: 6.5
    status: "12+ Dockerfiles with Konflux variants; SBOM via Syft; no runtime validation or startup testing"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "Frontend coverage baseline script exists but no backend/SDK coverage tracking; no codecov integration"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "48 workflows; excellent concurrency control; reusable actions; smart path-based triggers"
  - dimension: "Agent Rules"
    score: 8.0
    status: "Comprehensive 683-line AGENTS.md with architectural, testing, and commit policies"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Coverage regressions go undetected; no visibility into test effectiveness"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No container image runtime validation"
    impact: "Image startup failures and runtime issues not caught until deployment"
    severity: "HIGH"
    effort: "6-10 hours"
  - title: "Pre-commit workflow disabled in downstream"
    impact: "Linting enforcement relies on upstream; code quality issues can slip through PRs"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "CodeQL runs only on weekly schedule, not on PRs"
    impact: "Security vulnerabilities in PRs not caught until weekly scan"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No secret detection tooling"
    impact: "Secrets could be accidentally committed without automated detection"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add codecov integration to SDK and backend unit test workflows"
    effort: "3-4 hours"
    impact: "Immediate visibility into coverage trends and PR-level coverage changes"
  - title: "Enable CodeQL on pull requests"
    effort: "30 minutes"
    impact: "Security vulnerabilities caught before merge rather than on weekly schedule"
  - title: "Add Gitleaks secret detection to CI"
    effort: "1-2 hours"
    impact: "Prevent accidental credential leaks in commits"
  - title: "Re-enable pre-commit linting workflow for downstream"
    effort: "1-2 hours"
    impact: "Enforce code quality standards consistently on all PRs"
recommendations:
  priority_0:
    - "Implement codecov/coveralls integration for Go backend, Python SDK, and frontend"
    - "Add container startup validation tests for all built images"
    - "Enable CodeQL SAST scanning on pull requests, not just weekly schedule"
  priority_1:
    - "Add Gitleaks or TruffleHog for secret detection in CI pipeline"
    - "Re-enable pre-commit/golangci-lint workflow for downstream PRs"
    - "Add coverage thresholds with ratcheting to prevent regressions"
    - "Add PR-time Konflux build simulation to catch hermetic build failures early"
  priority_2:
    - "Add container image vulnerability scanning on PR-built images"
    - "Add performance regression testing for API server endpoints"
    - "Create .claude/rules/ directory with test-type-specific agent rules"
    - "Add contract tests between SDK compiler output and API server input"
---

# Quality Analysis: data-science-pipelines

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Polyglot monorepo (Go backend, Python SDK, TypeScript frontend) - Kubeflow Pipelines fork for Red Hat OpenShift AI
- **Key Strengths**: Exceptional E2E test infrastructure with multi-dimensional matrix testing across K8s versions, Argo versions, TLS/proxy/cache/multi-user configurations; comprehensive CI/CD with 48 workflows and well-organized reusable actions; strong AGENTS.md with architectural policies
- **Critical Gaps**: No coverage tracking or enforcement anywhere in the pipeline; no container runtime validation; CodeQL security scanning only runs weekly rather than on PRs; pre-commit workflow disabled for downstream
- **Agent Rules Status**: Present - comprehensive 683-line AGENTS.md covering architecture, testing, commit, and code reuse policies; no `.claude/rules/` directory for test-type-specific rules

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | 463 test files across Go/Python/TS; multi-version Python matrix; no coverage enforcement |
| Integration/E2E | 9.0/10 | Exceptional multi-dimensional matrix testing across K8s/Argo/TLS/proxy/cache/multi-user |
| **Build Integration** | **7.0/10** | **PR image builds with Quay push; Konflux pipelines on-label; no PR-time Konflux simulation** |
| Image Testing | 6.5/10 | 12+ Dockerfiles with Konflux variants; SBOM via Syft; no runtime validation |
| Coverage Tracking | 3.0/10 | Frontend coverage baseline script exists but unused in CI; no codecov/coveralls |
| CI/CD Automation | 9.0/10 | 48 workflows with excellent concurrency control, reusable actions, path-based triggers |
| Agent Rules | 8.0/10 | Comprehensive AGENTS.md; no `.claude/rules/` for test-specific guidance |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: Coverage regressions go undetected; no visibility into test effectiveness across any language
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: Neither the Go backend nor the Python SDK workflows generate or upload coverage reports. The frontend has a `coverage-baseline.mjs` script but it's not integrated into CI. No codecov.yml or coveralls configuration exists anywhere in the repository.

### 2. No Container Image Runtime Validation
- **Impact**: Image startup failures and runtime issues not caught until deployment to OpenShift
- **Severity**: HIGH
- **Effort**: 6-10 hours
- **Details**: While the CI builds 12+ images as part of E2E test setup, there is no explicit startup validation (health check probes, basic API readiness) as a standalone test step. Images are built and loaded into Kind but only tested implicitly through E2E scenarios.

### 3. Pre-commit Workflow Disabled in Downstream
- **Impact**: Code quality enforcement relies entirely on upstream; linting issues can enter downstream PRs
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: The `pre-commit.yml` workflow has `on: []` (disabled) with a comment explaining "This workflow is disabled in downstream because we require linting upstream." While `.golangci.yaml` and `.pre-commit-config.yaml` are comprehensive, they're not enforced on PRs in this fork.

### 4. CodeQL SAST Only on Weekly Schedule
- **Impact**: Security vulnerabilities in PRs not caught until the weekly Friday scan
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: CodeQL analyzes Go, JavaScript, and Python but only runs on a weekly cron schedule (`39 19 * * 5`). PRs are not scanned for SAST vulnerabilities before merge.

### 5. No Secret Detection
- **Impact**: Credentials could be accidentally committed without automated detection
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: No Gitleaks, TruffleHog, or other secret detection tool is configured. The `.pre-commit-config.yaml` includes basic checks but not secret scanning.

## Quick Wins

### 1. Add Codecov Integration (3-4 hours)
- **Impact**: Immediate visibility into coverage trends and PR-level coverage deltas
- **Implementation**:
  - Add `pytest-cov` output upload to `kfp-sdk-unit-tests.yml` (already installs `pytest-cov`)
  - Add `-coverprofile=coverage.out` to Go test commands in `unit-tests.yaml`
  - Create `.codecov.yml` with per-language configuration
  - Upload reports via `codecov/codecov-action`

### 2. Enable CodeQL on Pull Requests (30 minutes)
- **Impact**: Security vulnerabilities caught before merge
- **Implementation**: Add `pull_request` trigger to `.github/workflows/codeql.yml`

### 3. Add Gitleaks Secret Detection (1-2 hours)
- **Impact**: Prevent accidental credential leaks
- **Implementation**: Add Gitleaks GitHub Action to run on PRs with appropriate `.gitleaks.toml` baseline

### 4. Re-enable Pre-commit Linting (1-2 hours)
- **Impact**: Enforce golangci-lint, yapf, isort consistently on all PRs
- **Implementation**: Uncomment/re-enable the PR triggers in `pre-commit.yml` or integrate linting into existing CI checks workflow

## Detailed Findings

### CI/CD Pipeline

**Exceptional infrastructure** with 48 workflow files covering the full development lifecycle:

**PR-Triggered Workflows (16)**:
- `unit-tests.yaml` - Go backend unit tests
- `kfp-sdk-unit-tests.yml` - Python SDK tests (Python 3.9, 3.13 matrix)
- `frontend.yml` - Frontend tests with lockfile drift detection
- `api-server-tests.yml` - API server integration tests (multi-K8s/Argo matrix)
- `e2e-test.yml` - E2E pipeline tests (multi-dimensional matrix)
- `e2e-test-frontend.yml` - Frontend integration tests with Kind cluster
- `compiler-tests.yml` - Workflow compiler tests
- `integration-tests-v1.yml` - V1 API integration tests
- `upgrade-test.yml` - Upgrade compatibility tests
- `validate-generated-files.yml` - Proto/CRD generation validation with backwards compatibility check
- `ci-checks.yml` - CI status gate with polling
- `build-prs.yml` - PR image builds to Quay
- `trivy.yml` - Trivy vulnerability scanning (also on PRs)
- `image-builds.yml` - Reusable image build workflow
- `kfp-kubernetes-library-test.yml`, `kfp-sdk-tests.yml`, `kfp-sdk-client-tests.yml`

**Periodic/Push Workflows**:
- `codeql.yml` - Weekly SAST scanning (Go, JS, Python)
- `build-master.yml`, `build-and-push.yml` - Release builds
- `stale.yml` - Issue/PR management
- `upstream-sync.yml` - Upstream tracking

**Strengths**:
- Excellent concurrency control: Every PR-triggered workflow uses `cancel-in-progress: true`
- Smart path-based triggers: Workflows only run when relevant files change
- 9 reusable composite actions: `create-cluster`, `deploy`, `test-and-report`, `build`, `junit-summary`, `kfp-k8s`, `protobuf`, `setup-go`, `github-disk-cleanup`
- Matrix testing across K8s versions (v1.29.2, v1.31.0, v1.31.14, v1.34.0, v1.35.0), Argo versions (v3.5.14, v3.7.3, v4.0.4), and configurations (TLS, proxy, cache, multi-user, pipeline store)
- Ginkgo-based test execution with parallel nodes (up to 15)
- JUnit report generation and summary
- PR image builds with Quay push and automated comment with deployment instructions

**Weaknesses**:
- Pre-commit workflow disabled for downstream
- No caching of Go modules or Python packages in some workflows
- CodeQL only on schedule

### Test Coverage

**Test File Distribution**:
- Go test files: 165 (`*_test.go`)
- Python test files: 254 (`test_*.py`, `*_test.py`)
- JS/TS test files: 44 (`*.spec.ts`, `*.test.ts`)
- **Total: 463 test files**

**Test-to-Code Ratios**:
- Go: 165 test files / 685 source files = 0.24 (adequate)
- Python: 254 test files / 1,092 source files = 0.23 (adequate)

**Unit Test Frameworks**:
- Go: Standard `testing` package + Ginkgo/Gomega for structured tests
- Python: pytest with pytest-cov installed (but coverage not collected in CI)
- Frontend: Vitest with coverage capability configured

**Integration/E2E Tests** (Exceptional):
- API Server tests: Multi-K8s-version x multi-Argo-version x cache/proxy/TLS matrix (15+ configurations)
- E2E pipeline tests: Critical/Essential/Failure/Proxy/MLflow test labels with multi-dimensional matrix
- Frontend integration tests: Dockerized Cypress-style tests deployed to Kind cluster
- Multi-user tests: Authentication and namespace isolation testing
- Upgrade tests: Deploy previous release, run preparation tests, upgrade, verify (opendatahub-io fork only)
- Compiler tests: Workflow compiler validation
- K8s Native migration tests: Pipeline store migration testing

**Coverage Tracking**:
- No codecov.yml or coveralls integration
- Frontend has `coverage-baseline.mjs` for baseline capture/comparison but not integrated into CI
- `pytest-cov` is installed as a dependency in SDK tests but coverage output is not uploaded
- No Go coverage profile generation in CI

### Code Quality

**Linting Configuration** (Good):
- `.golangci.yaml` (v2): 6 linters enabled (gocritic, govet, ineffassign, misspell, staticcheck, unused) + gofmt/goimports formatters
- `.eslintrc.yaml`: TypeScript ESLint with React hooks, JSX accessibility, and import plugins
- `.pylintrc`: Python linting configuration present
- `mypy.ini`: Python type checking configured
- `.style.yapf`: Python code formatting
- `.isort.cfg`: Python import sorting

**Pre-commit Hooks** (Comprehensive but disabled in CI):
- `.pre-commit-config.yaml` includes 10+ hooks:
  - YAML/JSON validation, trailing whitespace, merge conflict detection
  - flake8 (W605), pycln, isort, yapf, docformatter
  - golangci-lint (with `--new-from-rev HEAD` for incremental)
  - actionlint for GitHub workflow validation
- **But**: The `pre-commit.yml` workflow is disabled (`on: []`) in downstream

**Static Analysis**:
- golangci-lint v2.10 with staticcheck (all checks)
- CodeQL for Go, JavaScript, Python (weekly only)
- No gosec, Semgrep, or additional SAST tools

### Container Images

**Dockerfiles** (12+ images):
- Backend: `Dockerfile` (API server), `Dockerfile.persistenceagent`, `Dockerfile.scheduledworkflow`, `Dockerfile.driver`, `Dockerfile.launcher`, `Dockerfile.visualization`, `Dockerfile.viewercontroller`, `Dockerfile.cacheserver`, `Dockerfile.conformance`
- Konflux variants: `Dockerfile.konflux.api`, `Dockerfile.konflux.persistenceagent`, `Dockerfile.konflux.scheduledworkflow`, `Dockerfile.konflux.launcher`, `Dockerfile.konflux.driver`
- Frontend: `frontend/Dockerfile`
- Proxy: `proxy/Dockerfile`
- Third-party: minio, ml-metadata, metadata_envoy

**Build Process**:
- Multi-stage builds with UBI9 base images (Red Hat certified)
- Go FIPS 140 compliance (`GOFIPS140=v1.0.0`)
- Multi-architecture support: x86_64, arm64, ppc64le (via Konflux)
- SBOM generation configured via `.syft.yaml` (scoped to Go backend only)
- Image signing via Tekton/Konflux pipelines

**Security Scanning**:
- Trivy: Filesystem scan on PRs and push, CRITICAL/HIGH severity, SARIF upload to GitHub Security tab
- No Trivy container image scanning (only filesystem)
- No Snyk integration
- No runtime vulnerability scanning of built images

**Gaps**:
- No explicit image startup/health check validation
- No Testcontainers or similar runtime testing
- Trivy only scans the repository filesystem, not the built container images

### Security

**Strengths**:
- Trivy vulnerability scanning with SARIF integration on PRs
- CodeQL SAST for 3 languages (Go, JS, Python)
- FIPS 140 compliance in Go builds
- UBI9 minimal base images (Red Hat security-hardened)
- Hermetic Konflux builds with prefetch
- Image signing and attestation via Tekton pipelines
- SBOM generation via Syft

**Gaps**:
- CodeQL only on weekly schedule, not PRs
- No secret detection (Gitleaks, TruffleHog)
- No dependency vulnerability scanning beyond Trivy filesystem scan
- No container image scanning (only filesystem scanning)

### Agent Rules (Agentic Flow Quality)

**Status**: Present - comprehensive AGENTS.md (683 lines, symlinked as CLAUDE.md)

**Coverage**:
- Architectural boundary policy: ResourceManager scope, compiler boundaries, engine neutrality
- Testing policy: Requires unit tests for non-trivial functions, existing tests must pass, regression checks
- Commit policy: Signed-off commits (`git commit -s`), no AI co-authors
- Code reuse policy: Reuse existing functions, avoid duplication, descriptive naming
- Local development: Complete setup instructions for Go, Python, frontend
- Local testing: Commands for all test suites (Go, Python SDK, kfp-kubernetes, frontend)
- CI/CD documentation: Workflow descriptions and matrix testing parameters

**Quality Assessment**:
- Well-structured with clear sections and code examples
- Maintenance instructions for keeping the guide current
- Comprehensive end-to-end flow documentation
- Local cluster deployment instructions (standalone and dev mode)

**Gaps**:
- No `.claude/rules/` directory with test-type-specific rules
- No rules for E2E test patterns, integration test patterns, or mocking strategies
- No rules for container image testing or Konflux build patterns
- Agent rules don't cover how to add coverage tracking or security scanning

## Recommendations

### Priority 0 (Critical)

1. **Implement codecov/coveralls integration** across all languages
   - Add `-coverprofile=coverage.out` to Go test commands
   - Upload Python pytest-cov reports (already installed)
   - Integrate frontend coverage-baseline into CI
   - Create `.codecov.yml` with minimum coverage thresholds

2. **Add container startup validation tests** for all built images
   - Verify each image starts successfully
   - Check health/readiness endpoints respond
   - Validate expected binaries and configurations exist

3. **Enable CodeQL on pull requests** in addition to weekly schedule
   - Simple trigger change: add `pull_request` to codeql.yml `on` section

### Priority 1 (High Value)

4. **Add Gitleaks secret detection** to CI pipeline
   - Add `.gitleaks.toml` with baseline for known false positives
   - Run on all PRs before merge

5. **Re-enable pre-commit linting workflow** for downstream
   - Enable PR triggers in `pre-commit.yml`
   - Or integrate golangci-lint directly into existing backend test workflows

6. **Add coverage ratcheting** to prevent regressions
   - Set baseline thresholds and only allow increases
   - Use frontend `coverage-baseline.mjs` pattern across all languages

7. **Add PR-time Konflux build simulation**
   - Test hermetic builds with prefetch on PRs
   - Catch build failures before merge

### Priority 2 (Nice-to-Have)

8. **Add container image Trivy scanning** on built PR images
   - Extend existing Trivy workflow to scan Docker images, not just filesystem

9. **Create `.claude/rules/` directory** with test-type-specific agent rules
   - `unit-tests.md` - Go testing + pytest patterns
   - `e2e-tests.md` - Ginkgo E2E patterns with Kind clusters
   - `integration-tests.md` - API server integration test patterns
   - Use `/test-rules-generator` skill to bootstrap these

10. **Add performance regression testing** for API server endpoints
    - Track response times across releases
    - Alert on significant regressions

11. **Add contract tests** between SDK compiler output and API server input
    - Validate pipeline spec compatibility across SDK versions
    - Test generated protobuf backwards compatibility (partially done via `validate-backwards-compatibility`)

## Comparison to Gold Standards

| Dimension | data-science-pipelines | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|-----------|----------------------|---------------------|-------------------|---------------|
| Unit Tests | 7.5 (463 files, no coverage) | 9.0 (comprehensive + enforced coverage) | 7.0 (focused on notebooks) | 9.0 (high coverage with enforcement) |
| Integration/E2E | 9.0 (exceptional matrix) | 9.0 (multi-layer) | 7.0 (image testing) | 8.5 (multi-version) |
| Build Integration | 7.0 (PR builds + Konflux on-label) | 8.0 (full PR validation) | 8.0 (multi-arch) | 7.5 (PR builds) |
| Image Testing | 6.5 (build only, no runtime) | 7.0 (startup validation) | 9.0 (5-layer validation) | 7.0 (runtime tests) |
| Coverage Tracking | 3.0 (none active) | 9.0 (codecov + enforcement) | 5.0 (partial) | 9.0 (enforcement) |
| CI/CD Automation | 9.0 (48 workflows) | 9.0 (comprehensive) | 8.0 (well-organized) | 8.5 (mature) |
| Agent Rules | 8.0 (excellent AGENTS.md) | 9.0 (AGENTS.md + .claude/rules/) | 4.0 (basic) | 3.0 (minimal) |

## File Paths Reference

### CI/CD
- `.github/workflows/` - 48 workflow files
- `.github/actions/` - 9 reusable composite actions (build, create-cluster, deploy, test-and-report, etc.)
- `.tekton/` - 5 Konflux/Tekton pipeline configurations

### Testing
- `backend/test/` - Go integration, E2E, compiler, proto, webhook tests
- `backend/test/v2/api/` - V2 API test suite (Ginkgo-based)
- `backend/test/end2end/` - E2E pipeline tests
- `backend/test/compiler/` - Workflow compiler tests
- `backend/test/integration/` - V1 integration tests
- `sdk/python/kfp/` - Python SDK tests (254 files)
- `frontend/` - Frontend tests (44 spec/test files)
- `test/` - Test scripts, infrastructure, and helper utilities

### Code Quality
- `.golangci.yaml` - golangci-lint v2 config (6 linters + formatters)
- `.pre-commit-config.yaml` - 10+ pre-commit hooks (disabled in CI)
- `.pylintrc` - Python linting
- `mypy.ini` - Python type checking
- `frontend/.eslintrc.yaml` - TypeScript ESLint config

### Container Images
- `backend/Dockerfile*` - 10+ backend Dockerfiles (including Konflux variants)
- `frontend/Dockerfile` - Frontend Dockerfile
- `.syft.yaml` - SBOM generation scope configuration

### Security
- `.github/workflows/trivy.yml` - Trivy filesystem scanning
- `.github/workflows/codeql.yml` - CodeQL SAST (weekly)

### Agent Rules
- `AGENTS.md` (683 lines) - Comprehensive agent/developer guide
- `CLAUDE.md` - Symlink to AGENTS.md
