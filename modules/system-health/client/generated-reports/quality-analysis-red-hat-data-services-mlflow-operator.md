---
repository: "red-hat-data-services/mlflow-operator"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Strong envtest-based unit tests with 1.76x test-to-code ratio using Ginkgo/Gomega"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Comprehensive matrix testing across K8s versions, storage backends, TLS, and upgrade paths"
  - dimension: "Build Integration"
    score: 7.5
    status: "PR-time Docker build and Kind deployment; Tekton/Konflux for production; no PR-time Konflux simulation"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage FIPS-compliant Dockerfiles with multi-arch via Tekton; SBOM via Syft; no explicit vulnerability scanning in GHA"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "cover.out generated locally but no codecov integration, thresholds, or PR reporting"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "11 GitHub Actions workflows plus Tekton pipelines; custom composite actions; daily version alignment checks"
  - dimension: "Agent Rules"
    score: 5.0
    status: "Comprehensive AGENTS.md but no .claude/ directory or structured test creation rules"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Coverage regressions go undetected; no visibility into which code paths lack tests"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container vulnerability scanning in GitHub Actions"
    impact: "Vulnerabilities in base images or dependencies not caught until Konflux pipeline; delayed feedback"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No secret detection in CI"
    impact: "Accidental credential leaks could be merged undetected"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No pre-commit hooks"
    impact: "Developers may push code that fails lint/format checks, wasting CI cycles"
    severity: "LOW"
    effort: "1-2 hours"
quick_wins:
  - title: "Add Codecov integration with coverage thresholds"
    effort: "4-6 hours"
    impact: "Immediate coverage visibility, PR-level regression detection, coverage badge"
  - title: "Add Trivy container scanning to PR workflow"
    effort: "2-3 hours"
    impact: "Early detection of CVEs in base images and dependencies before Konflux"
  - title: "Add Gitleaks secret detection to PR workflow"
    effort: "1-2 hours"
    impact: "Prevent accidental credential leaks from being merged"
  - title: "Add pre-commit hooks for linting and formatting"
    effort: "1-2 hours"
    impact: "Faster developer feedback; fewer CI failures from formatting issues"
recommendations:
  priority_0:
    - "Add Codecov or Coveralls integration with coverage thresholds and PR status checks"
    - "Add Trivy or Snyk container image scanning to PR-triggered workflows"
  priority_1:
    - "Add CodeQL or gosec SAST analysis for security vulnerabilities"
    - "Add Gitleaks secret detection to PR workflow"
    - "Create structured .claude/rules/ for test creation guidance"
    - "Add concurrency control to integration-tests.yml and upgrade-tests.yml workflows"
  priority_2:
    - "Add pre-commit hooks for golangci-lint, gofmt, and goimports"
    - "Add performance/load testing for MLflow server endpoints"
    - "Add chaos engineering tests for operator resilience"
    - "Consider adding contract tests between operator and MLflow runtime"
---

# Quality Analysis: mlflow-operator

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Kubernetes Operator (Go, Kubebuilder v4)
- **Primary Language**: Go 1.24 with Python integration tests
- **Framework**: controller-runtime, Helm chart-based reconciliation, Ginkgo/Gomega testing

### Key Strengths
- **Exceptional test coverage**: 1.76x test-to-code ratio with 18 Go unit test files and 7 Python integration test files
- **Comprehensive CI/CD**: 11 GitHub Actions workflows covering lint, unit tests, E2E, integration, upgrade paths, sample validation, manifest verification, version alignment, and workflow linting
- **Matrix testing**: Tests across multiple K8s versions (v1.29.0, v1.34.0), storage backends (SQLite, PostgreSQL), artifact storage (file, S3), and TLS configurations
- **Production-grade builds**: Tekton/Konflux pipelines with multi-arch support (x86_64, arm64, ppc64le, s390x), FIPS compliance, and hermetic builds
- **Upgrade path testing**: Dedicated workflow validates operator-managed migration from MLflow 3.10.0 to current version

### Critical Gaps
- **No coverage tracking**: `cover.out` is generated but not uploaded to any service; no thresholds or PR reporting
- **No vulnerability scanning in GHA**: Trivy/Snyk/CodeQL absent from GitHub workflows (Konflux may cover some)
- **No secret detection**: No Gitleaks or TruffleHog configuration

### Agent Rules Status: **Partial**
- `AGENTS.md` present (420+ lines, comprehensive)
- No `.claude/` directory or structured test creation rules

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Strong envtest-based unit tests with 1.76x test-to-code ratio |
| Integration/E2E | 9.0/10 | Comprehensive matrix testing across K8s versions, storage, TLS, upgrades |
| **Build Integration** | **7.5/10** | PR-time Docker build + Kind deployment; Tekton for production |
| Image Testing | 7.0/10 | Multi-stage FIPS Dockerfiles; multi-arch; SBOM; no CVE scanning in GHA |
| Coverage Tracking | 3.0/10 | cover.out generated locally; no codecov, thresholds, or PR reporting |
| CI/CD Automation | 9.0/10 | 11 workflows + Tekton; custom actions; daily alignment checks |
| Agent Rules | 5.0/10 | AGENTS.md comprehensive but no .claude/rules/ directory |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: Coverage regressions go undetected; no visibility into which code paths lack tests
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: `make test` generates `cover.out` via `go test -coverprofile`, but this file is never uploaded to Codecov/Coveralls. No coverage thresholds exist, no PR comments show coverage changes, and no badge indicates current coverage level.

### 2. No Container Vulnerability Scanning in GitHub Actions
- **Impact**: Vulnerabilities in UBI9 base images or Go dependencies not caught until Konflux pipeline
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: Neither Trivy, Snyk, nor any other CVE scanner runs in the GHA workflows. Konflux pipelines may include scanning, but feedback comes post-merge, not at PR time.

### 3. No Secret Detection
- **Impact**: Accidental credential leaks could be merged undetected
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: No Gitleaks, TruffleHog, or similar tool configured in CI or pre-commit.

### 4. No Pre-commit Hooks
- **Impact**: Developers may push code that fails lint/format checks, wasting CI cycles
- **Severity**: LOW
- **Effort**: 1-2 hours
- **Details**: No `.pre-commit-config.yaml` file. Linting only runs in CI, not locally.

## Quick Wins

### 1. Add Codecov Integration (4-6 hours)
```yaml
# Add to .github/workflows/test.yml after "Running Tests" step
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: cover.out
    fail_ci_if_error: true
    token: ${{ secrets.CODECOV_TOKEN }}
```
Add `.codecov.yml`:
```yaml
coverage:
  status:
    project:
      default:
        target: 70%
        threshold: 2%
    patch:
      default:
        target: 80%
```

### 2. Add Trivy Container Scanning (2-3 hours)
```yaml
# New workflow or add to existing PR workflow
- name: Build image for scanning
  run: make docker-build IMG=mlflow-operator:scan

- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'mlflow-operator:scan'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'

- name: Upload Trivy scan results
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: 'trivy-results.sarif'
```

### 3. Add Gitleaks Secret Detection (1-2 hours)
```yaml
# New workflow: .github/workflows/gitleaks.yml
name: Gitleaks
on: [pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 4. Add Pre-commit Hooks (1-2 hours)
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/golangci/golangci-lint
    rev: v2.5.0
    hooks:
      - id: golangci-lint
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.4
    hooks:
      - id: gitleaks
```

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (11 workflows)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `lint.yml` | PR + push to main | golangci-lint v2.5.0 |
| `test.yml` | PR + push to main | Unit tests with envtest |
| `test-e2e.yml` | PR + push to main | E2E tests on Kind cluster |
| `integration-tests.yml` | PR + push + dispatch | Python integration test matrix |
| `upgrade-tests.yml` | PR + push to main | Upgrade path testing (3.10.0 → current) |
| `validate-samples.yaml` | PR + push to main | CRD sample validation on Kind |
| `verify-codegen.yml` | PR + push to main | Generated code freshness check |
| `verify-kustomize.yml` | PR + push to main | Kustomize/Helm manifest build verification |
| `verify-mlflow-version-alignment.yml` | PR + push + daily cron | MLflow version drift detection |
| `workflow-linter.yml` | PR + push to main | actionlint for GHA workflow quality |
| `build-and-push-test-image.yml` | Push to main/release | Build test image to Quay.io |

**Custom Composite Actions**:
- `.github/actions/create-cluster/` - Kind cluster setup with retry
- `.github/actions/deploy/` - Full MLflow deployment with configurable storage (65K Python deploy script)
- `.github/actions/build/` - Operator image build

**Tekton/Konflux Pipelines (4 PipelineRuns)**:
- `mlflow-operator-pull-request.yaml` - Multi-arch PR build (hermetic, x86_64/arm64/ppc64le/s390x)
- `mlflow-operator-push.yaml` - Production push build
- `mlflow-tests-pull-request.yaml` - Test image PR build
- `mlflow-tests-push.yaml` - Test image push build

**Strengths**:
- Extensive workflow coverage for nearly all quality dimensions
- Daily cron for version alignment drift detection
- Workflow self-linting with actionlint
- Custom composite actions for reusable CI components

**Gaps**:
- `integration-tests.yml` and `upgrade-tests.yml` lack concurrency control (could run multiple expensive jobs in parallel on the same PR)
- No caching of Go modules in `test-e2e.yml` or `upgrade-tests.yml`

### Test Coverage

**Unit Tests (Go - envtest)**:
- **18 test files** in `internal/controller/`
- **Framework**: Ginkgo v2 + Gomega + envtest
- **Test-to-code ratio**: 6,975 test lines / 3,955 source lines = **1.76x** (excellent)
- **Coverage**: Tests use real K8s API via envtest (CRD loading, scheme registration)
- **Test areas**: Helm rendering (CA bundles, CORS, env, GC, images, metrics, network policies, pod metadata, storage, workloads), migration controller, MLflow controller, status URLs
- **Naming**: Well-organized by feature area (e.g., `helm_cors_test.go`, `helm_storage_test.go`)

**E2E Tests (Go - Kind)**:
- 2 test files (`e2e_test.go`, `upgrade_e2e_test.go`)
- Kind cluster with restricted pod security policy
- CRD installation and operator deployment validation
- Metrics endpoint verification
- Upgrade path testing (3.10.0 → current with migration validation)

**Integration Tests (Python - pytest)**:
- **7 test files** in `mlflow-tests/tests/`
- Tests: experiments, models, traces, trace actions, artifacts, workspaces, resource mapping
- **Matrix**: K8s v1.29.0 + v1.34.0, SQLite + PostgreSQL, file + S3, serve_artifacts on/off, TLS variants
- Shared test context and test data modules
- HTML and JUnit XML reporting
- Debug log collection on failure

**Validation Tests**:
- Sample CR validation against CRD schema (Kind cluster with kubeconform)
- Kustomize overlay build verification for all overlays (base, dev, kind, odh, openshift, rhoai)
- Helm chart rendering verification
- Generated code freshness check (manifests + deepcopy)
- MLflow version alignment verification

### Code Quality

**Linting**:
- **golangci-lint v2.5.0** with **15 enabled linters**:
  `copyloopvar, dupl, errcheck, ginkgolinter, govet, ineffassign, lll, misspell, nakedret, prealloc, revive, staticcheck, unconvert, unparam, unused`
- **Formatters**: gofmt, goimports
- **revive rules**: comment-spacings, import-shadowing
- **Exclusions**: Sensible exclusions for API directory (lll), internal directory (dupl, lll)
- **ginkgolinter**: Enforces Ginkgo testing best practices

**Strengths**:
- Good linter diversity covering correctness (errcheck, staticcheck, govet), style (revive, misspell), and performance (prealloc)
- ginkgolinter ensures test code quality
- actionlint for workflow quality

**Gaps**:
- No pre-commit hooks for local enforcement
- No SAST tools (CodeQL, gosec, Semgrep)

### Container Images

**Production Dockerfile (Dockerfile.konflux)**:
- Multi-stage build: UBI9 go-toolset builder → UBI9 ubi-minimal runtime
- FIPS compliance: `GOEXPERIMENT=strictfipsruntime`, `-tags strictfipsruntime`
- CGO enabled for FIPS
- Pinned base image digests
- Non-root user (1001)
- Helm chart copied into image for reconciliation
- Red Hat container labels

**Development Dockerfile**:
- Similar structure but allows CGO_ENABLED=0 for Apple Silicon
- Uses `:latest` tag for base (not pinned)

**Test Image (mlflow-tests/images/Dockerfile.konflux)**:
- UBI9 minimal with Python 3.12
- Includes oc, kubectl, kustomize CLIs
- uv for Python dependency management
- Locked dependencies via uv.lock

**SBOM**:
- `.syft.yaml` configured with sensible exclusions

**Multi-arch**:
- Tekton PR pipeline: `linux/x86_64, linux-m2xlarge/arm64, linux/ppc64le, linux/s390x`
- Makefile `docker-buildx` target for local multi-arch builds

**Gaps**:
- No Trivy/Snyk scanning in GitHub Actions
- No image startup validation tests in CI
- Development Dockerfile uses `:latest` tag

### Security

**Strengths**:
- FIPS compliance in production builds
- Pod security restricted policy enforced in E2E tests
- Non-root container user (1001)
- UBI9 base images (Red Hat supported/scanned)
- Hermetic Tekton builds for operator

**Gaps**:
- No CodeQL or SAST in GitHub Actions
- No Gitleaks or secret detection
- No Trivy/Snyk container scanning in GHA
- No dependency scanning (Dependabot/Renovate not visible)

### Agent Rules (Agentic Flow Quality)

**Status**: Partial

**What exists**:
- `AGENTS.md` (420+ lines) - Comprehensive project documentation covering:
  - Project structure and API definitions
  - Development workflow (manifests, code generation)
  - Deployment modes (RHOAI, OpenDataHub)
  - Helm chart usage and storage configuration
  - Migration behavior and operator semantics
  - Testing instructions (unit, E2E, linting)
  - Sample CR maintenance checklist
  - CI/CD workflow descriptions
  - Agent notes with 5 key principles
- `ARCHITECTURE.md` - Detailed architecture documentation with Mermaid diagrams

**What's missing**:
- No `.claude/` directory
- No `.claude/rules/` for test creation guidance
- No structured rules for unit test patterns, E2E test patterns, or integration test patterns
- No agent skills for common development tasks

**Recommendation**: Generate structured test creation rules with `/test-rules-generator` covering:
1. Go unit tests with envtest and Ginkgo/Gomega patterns
2. E2E tests with Kind cluster setup
3. Python integration tests with pytest
4. Helm chart test patterns

## Recommendations

### Priority 0 (Critical)

1. **Add Codecov integration with coverage thresholds**
   - Upload `cover.out` from `test.yml` workflow
   - Set project target at 70%, patch target at 80%
   - Add coverage badge to README
   - Effort: 4-6 hours

2. **Add container vulnerability scanning to PR workflow**
   - Trivy action scanning built image
   - Upload SARIF results to GitHub Security tab
   - Fail on CRITICAL/HIGH severity
   - Effort: 2-3 hours

### Priority 1 (High Value)

3. **Add CodeQL or gosec SAST analysis**
   - Schedule weekly + PR-triggered scans
   - Focus on Go security patterns
   - Effort: 2-4 hours

4. **Add Gitleaks secret detection**
   - Run on all PRs
   - Prevent credential leaks pre-merge
   - Effort: 1-2 hours

5. **Create structured `.claude/rules/` test creation guidance**
   - Unit test rules with envtest patterns
   - E2E test rules with Kind setup
   - Integration test rules with pytest
   - Effort: 4-6 hours

6. **Add concurrency control to expensive workflows**
   - `integration-tests.yml` and `upgrade-tests.yml` should cancel in-progress runs on new pushes
   - Effort: 30 minutes

### Priority 2 (Nice-to-Have)

7. **Add pre-commit hooks**
   - golangci-lint, gofmt, goimports, gitleaks
   - Effort: 1-2 hours

8. **Add performance/load testing**
   - Benchmark MLflow server under load
   - Regression detection for API latency
   - Effort: 8-16 hours

9. **Add contract tests between operator and MLflow runtime**
   - Validate Helm chart values ↔ MLflow runtime expectations
   - Effort: 8-12 hours

10. **Consider chaos engineering tests**
    - Pod failure recovery
    - Network partition handling
    - Migration Job failure scenarios
    - Effort: 16-24 hours

## Comparison to Gold Standards

| Dimension | mlflow-operator | odh-dashboard | notebooks | kserve |
|-----------|----------------|---------------|-----------|--------|
| Unit Tests | 8.5 (envtest, 1.76x ratio) | 9.0 (multi-layer) | 7.0 | 9.0 (coverage enforced) |
| Integration/E2E | 9.0 (matrix + upgrade) | 9.0 (contract tests) | 8.0 | 9.0 (multi-version) |
| Build Integration | 7.5 (Kind + Tekton) | 8.0 | 7.0 | 7.0 |
| Image Testing | 7.0 (FIPS, multi-arch) | 7.0 | 9.0 (5-layer) | 7.0 |
| Coverage Tracking | 3.0 (local only) | 8.0 (codecov) | 6.0 | 8.0 (enforced) |
| CI/CD Automation | 9.0 (11 workflows) | 9.0 | 8.0 | 9.0 |
| Agent Rules | 5.0 (AGENTS.md only) | 8.0 (comprehensive) | 4.0 | 3.0 |

## File Paths Reference

### CI/CD
- `.github/workflows/lint.yml` - Linting
- `.github/workflows/test.yml` - Unit tests
- `.github/workflows/test-e2e.yml` - E2E tests
- `.github/workflows/integration-tests.yml` - Integration test matrix
- `.github/workflows/upgrade-tests.yml` - Upgrade path tests
- `.github/workflows/validate-samples.yaml` - Sample CR validation
- `.github/workflows/verify-codegen.yml` - Generated code verification
- `.github/workflows/verify-kustomize.yml` - Manifest build verification
- `.github/workflows/verify-mlflow-version-alignment.yml` - Version alignment
- `.github/workflows/workflow-linter.yml` - actionlint
- `.github/workflows/build-and-push-test-image.yml` - Test image build
- `.github/actions/create-cluster/action.yml` - Kind cluster setup
- `.github/actions/deploy/action.yml` - MLflow deployment
- `.github/actions/deploy/deploy.py` - Deployment automation (65K lines)
- `.tekton/` - 4 Tekton PipelineRun configs

### Testing
- `internal/controller/*_test.go` - 18 unit test files (envtest + Ginkgo)
- `test/e2e/e2e_test.go` - E2E test suite
- `test/e2e/upgrade_e2e_test.go` - Upgrade E2E tests
- `mlflow-tests/tests/test_*.py` - 7 Python integration test files
- `test/scripts/validate-samples.sh` - Sample validation
- `test/scripts/verify-manifests.sh` - Manifest verification
- `test/scripts/verify_mlflow_version_alignment.py` - Version alignment

### Code Quality
- `.golangci.yml` - 15 enabled linters with v2 config

### Container Images
- `Dockerfile.konflux` - Production (FIPS, pinned digests)
- `Dockerfile` - Development
- `mlflow-tests/images/Dockerfile.konflux` - Test image
- `.syft.yaml` - SBOM configuration

### Agent Rules
- `AGENTS.md` - Comprehensive project documentation
- `ARCHITECTURE.md` - Architecture documentation
