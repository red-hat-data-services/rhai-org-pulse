---
repository: "red-hat-data-services/data-science-pipelines-tekton"
overall_score: 4.3
scorecard:
  - dimension: "Unit Tests"
    score: 6.0
    status: "Decent Go/Python/TS unit test coverage but no coverage tracking or enforcement"
  - dimension: "Integration/E2E"
    score: 5.0
    status: "Kind-based integration tests on PRs but E2E requires manual cluster setup"
  - dimension: "Build Integration"
    score: 5.0
    status: "PR image builds with Quay push but no Konflux simulation or startup validation"
  - dimension: "Image Testing"
    score: 3.0
    status: "Multi-stage Dockerfiles but no runtime validation, scanning, or SBOM"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No codecov, coveralls, or any coverage tracking whatsoever"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "PR builds and unit tests automated; outdated action versions and Python versions"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules of any kind"
critical_gaps:
  - title: "Zero coverage tracking or enforcement"
    impact: "No visibility into test coverage trends; regressions go undetected"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container image security scanning"
    impact: "Vulnerabilities in base images and dependencies ship to production undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No image runtime validation"
    impact: "Broken images not caught until deployment; startup failures discovered in production"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "Outdated CI dependencies (Python 3.7, actions/checkout@v2, Go 1.19)"
    impact: "Security risk from EOL runtimes; incompatibility with modern tooling"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No SAST or CodeQL integration"
    impact: "Security vulnerabilities in Go/Python code not detected at PR time"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents produce inconsistent test patterns and miss project conventions"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add codecov integration to unit test workflow"
    effort: "2-3 hours"
    impact: "Immediate visibility into coverage trends and enforcement on PRs"
  - title: "Add Trivy scanning to PR image build workflow"
    effort: "1-2 hours"
    impact: "Catch CVEs in container images before merge"
  - title: "Upgrade GitHub Actions to current versions (checkout@v4, setup-python@v5)"
    effort: "1-2 hours"
    impact: "Fix deprecation warnings and improve CI reliability"
  - title: "Add CodeQL workflow for Go and Python"
    effort: "1-2 hours"
    impact: "Automated SAST scanning with GitHub-native integration"
  - title: "Update Python matrix to 3.9-3.12 (drop EOL 3.7/3.8)"
    effort: "2-3 hours"
    impact: "Eliminate security risk from EOL Python versions"
recommendations:
  priority_0:
    - "Add coverage tracking (codecov/coveralls) with minimum threshold enforcement on PRs"
    - "Add container security scanning (Trivy) to all image builds"
    - "Upgrade all GitHub Actions to current versions and drop EOL Python/Go versions"
  priority_1:
    - "Add image runtime validation (startup tests) for all built container images"
    - "Add CodeQL or gosec SAST scanning workflow"
    - "Create comprehensive agent rules (.claude/rules/) for test automation patterns"
    - "Add pre-commit hooks for linting enforcement"
  priority_2:
    - "Add SBOM generation for container images"
    - "Add image signing/attestation (cosign)"
    - "Implement multi-architecture image builds"
    - "Add performance regression testing for API server endpoints"
---

# Quality Analysis: data-science-pipelines-tekton

## Executive Summary

- **Overall Score: 4.3/10**
- **Repository**: [red-hat-data-services/data-science-pipelines-tekton](https://github.com/red-hat-data-services/data-science-pipelines-tekton)
- **Type**: Polyglot Kubernetes application (Go backend, TypeScript frontend, Python SDK)
- **Framework**: Kubeflow Pipelines with Tekton backend
- **Primary Languages**: Go (432 source files), TypeScript (230 source files), Python (227 source files)
- **Agent Rules Status**: Missing — no CLAUDE.md, no .claude/ directory

### Key Strengths
- Good unit test breadth across all three languages (69 Go, 26 TS, 50+ Python test files)
- PR-triggered image builds with Quay push and automatic PR comments
- Kind-based backend integration testing automated in CI
- Structured test organization with clear separation of unit, integration, and E2E tests
- License compliance tooling (go-licenses.yaml) and OWNERS file for code review

### Critical Gaps
- **Zero coverage tracking** — no codecov, coveralls, or any coverage measurement
- **No container security scanning** — no Trivy, Snyk (config exists but excludes key dirs), or vulnerability scanning
- **Severely outdated dependencies** — Python 3.7/3.8 (EOL), Go 1.19 (EOL), actions/checkout@v2
- **No SAST/CodeQL** — no static analysis for security vulnerabilities
- **No image runtime validation** — images built but never tested for startup or functionality
- **No agent rules** — no guidance for AI-assisted development or test generation

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 6.0/10 | 20% | Decent breadth across Go/Python/TS but no coverage tracking |
| Integration/E2E | 5.0/10 | 25% | Kind-based integration on PRs; E2E requires manual cluster |
| Build Integration | 5.0/10 | — | PR image builds work but no Konflux simulation |
| Image Testing | 3.0/10 | 20% | Multi-stage Dockerfiles but no runtime validation or scanning |
| Coverage Tracking | 1.0/10 | 15% | No coverage tool of any kind |
| CI/CD Automation | 5.0/10 | 20% | Functional but outdated; missing modern CI practices |
| Agent Rules | 0.0/10 | — | Completely absent |

**Weighted Score: 4.3/10**

## Critical Gaps

### 1. Zero Coverage Tracking or Enforcement
- **Severity**: HIGH
- **Impact**: No visibility into test coverage trends; regressions go undetected. Cannot enforce minimum coverage on PRs.
- **Effort**: 4-6 hours
- **Details**: No `.codecov.yml`, no coveralls config, no `--coverprofile` in Go test commands, no `--cov` in Python tests. The project has decent test files but zero measurement of what they actually cover.
- **Implementation**:
  ```yaml
  # Add to kfp-tekton-unittests.yml
  - name: Run Go tests with coverage
    run: go test -coverprofile=coverage.out ./...
  - name: Upload coverage
    uses: codecov/codecov-action@v4
    with:
      files: ./coverage.out
      token: ${{ secrets.CODECOV_TOKEN }}
  ```

### 2. No Container Image Security Scanning
- **Severity**: HIGH
- **Impact**: Vulnerabilities in UBI base images and Go/Python dependencies ship to production undetected.
- **Effort**: 2-4 hours
- **Details**: A `.snyk` file exists but explicitly excludes `tekton-catalog/**` and `frontend/**`. No Trivy, no Grype, no vulnerability scanning in any workflow. With 21 Dockerfiles, this is a significant gap.
- **Implementation**:
  ```yaml
  - name: Run Trivy vulnerability scanner
    uses: aquasecurity/trivy-action@master
    with:
      image-ref: ${{ matrix.image }}
      format: 'sarif'
      output: 'trivy-results.sarif'
      severity: 'CRITICAL,HIGH'
  ```

### 3. Severely Outdated CI Dependencies
- **Severity**: HIGH
- **Impact**: Python 3.7 and 3.8 are EOL (no security patches). Go 1.19 is EOL. GitHub Actions v2 are deprecated.
- **Effort**: 4-6 hours
- **Details**:
  - Python test matrix: 3.7, 3.8, 3.9 → should be 3.9, 3.10, 3.11, 3.12
  - Go version: 1.19 → should be 1.21+ (go.mod uses Go toolset 1.21 in Dockerfile)
  - `actions/checkout@v2` → should be `@v4`
  - `actions/setup-python@v2` → should be `@v5`
  - `actions/setup-go@v2` → should be `@v5`
  - `actions/upload-artifact@v2` → should be `@v4`

### 4. No Image Runtime Validation
- **Severity**: HIGH
- **Impact**: Images are built on PRs and pushed to Quay but never tested for startup, health checks, or basic functionality.
- **Effort**: 4-8 hours
- **Details**: The build-prs workflow builds 5 images (api-server, frontend, persistenceagent, scheduledworkflow, artifact-manager) and pushes them but performs no validation. The comment-on-pr job provides manual testing instructions but no automated checks.

### 5. No SAST / Static Security Analysis
- **Severity**: MEDIUM
- **Impact**: SQL injection, command injection, and other security issues in Go/Python code not detected.
- **Effort**: 2-4 hours
- **Details**: No CodeQL, gosec, bandit, or Semgrep integration. The Go backend handles database queries (SQL), file uploads, and API requests — all high-risk surfaces.

### 6. No Agent Rules for AI-Assisted Development
- **Severity**: MEDIUM
- **Impact**: AI coding assistants cannot follow project-specific testing patterns, naming conventions, or quality gates.
- **Effort**: 4-6 hours
- **Details**: No `CLAUDE.md`, no `.claude/` directory, no `AGENTS.md`. The repo has established patterns (testify suites for Go, unittest for Python, jest for TS) that could be codified.

## Quick Wins

### 1. Add Codecov Integration (2-3 hours)
```yaml
# Add to run-go-unittests job
- name: Run Go tests with coverage
  run: go test -coverprofile=coverage.out -covermode=atomic ./backend/...
- name: Upload Go coverage
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage.out
    flags: backend-go
    token: ${{ secrets.CODECOV_TOKEN }}
```

### 2. Add Trivy Scanning (1-2 hours)
```yaml
# Add as a new job in build-prs.yml
trivy-scan:
  runs-on: ubuntu-latest
  needs: build-pr-images
  strategy:
    matrix:
      image: [ds-pipelines-api-server, ds-pipelines-frontend]
  steps:
    - uses: aquasecurity/trivy-action@master
      with:
        image-ref: quay.io/opendatahub/${{ matrix.image }}:pr-${{ needs.fetch-data.outputs.pr_number }}
        severity: 'CRITICAL,HIGH'
        exit-code: '1'
```

### 3. Upgrade GitHub Actions (1-2 hours)
Replace all `@v2` action references with current versions. This is a find-and-replace across 8 workflow files.

### 4. Add CodeQL Workflow (1-2 hours)
```yaml
name: "CodeQL"
on:
  push:
    branches: [master]
  pull_request:
    branches: [master]
jobs:
  analyze:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        language: ['go', 'python', 'javascript']
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

### 5. Drop EOL Python Versions (2-3 hours)
Update the matrix in `kfp-tekton-unittests.yml` from `[3.7, 3.8, 3.9]` to `[3.9, 3.10, 3.11, 3.12]` and fix any compatibility issues.

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory** (8 total):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `kfp-tekton-unittests.yml` | PR + push to master | Python unit tests, Go unit tests, lint, backend integration |
| `build-prs-trigger.yaml` | PR (opened/sync/close) | Uploads PR metadata artifact |
| `build-prs.yml` | workflow_run completion | Builds 5 Docker images, pushes to Quay, comments on PR |
| `build-master.yml` | push to master | Builds production images |
| `build-images.yaml` | workflow_call | Reusable image build workflow |
| `tag-release-quay.yml` | workflow_dispatch | Tags release images in Quay |
| `add-issues-to-dsp-project.yml` | issue opened | Adds issues to GitHub project board |
| `add-issues-to-odh-project.yml` | issue opened | Adds issues to ODH project board |

**Strengths**:
- Concurrency control on master builds (`cancel-in-progress: true`)
- Matrix strategy for multi-Python-version testing
- Conditional backend integration tests (only run when backend files change)
- Kind cluster deployment for integration testing
- Automatic PR image cleanup when PRs close

**Weaknesses**:
- No caching (no `actions/cache` for Go modules, npm, or pip)
- All actions use deprecated v2 versions
- No workflow reuse between PR and master builds (duplication)
- No timeout limits on jobs
- No retry logic for flaky tests
- Python 3.7/3.8 in test matrix (EOL)

### Test Coverage

**Unit Tests (145 test files total)**:

| Language | Test Files | Source Files | Ratio | Framework |
|----------|-----------|-------------|-------|-----------|
| Go | 69 | 432 | 0.16 | `testing` + testify |
| TypeScript | 26 | 230 | 0.11 | jest |
| Python | 50+ | 227 | 0.22 | unittest + pytest |

**Go Tests**: Well-structured with testify suites. Cover apiserver (server, storage, resource, filter, list, auth, template), cache (admission, mutation, storage), and common utilities. Integration tests use a real Kind cluster.

**TypeScript Tests**: Frontend server tests (7 files) and source lib tests (13 files). Integration tests for artifact proxy and tensorboard. Missing: component-level tests, accessibility tests, visual regression tests.

**Python Tests**: SDK compiler tests are comprehensive with golden YAML testdata validation. Auto-generated API client tests exist but are boilerplate. Performance test infrastructure exists (`performance_tests.py`).

**Coverage Tracking**: **NONE**. No codecov, coveralls, or any coverage measurement tool. No `--coverprofile` flags in Go tests. No `--cov` in Python tests. No coverage reporting of any kind.

### Code Quality

**Linting**:
- Python: `flake8` with selective rules (`E9,E2,E3,E5,F63,F7,F82,F4,F841,W291,W292`) — limited rule set
- Python formatting: `.style.yapf` (yapf) and `.pylintrc` configured but not enforced in CI
- Go: No `.golangci.yaml` — no Go linting in CI
- TypeScript: ESLint integrated via `react-scripts build` (runs `lint` as part of build)
- No pre-commit hooks (`.pre-commit-config.yaml` absent)

**Static Analysis**:
- No CodeQL
- No gosec
- No bandit (Python)
- No Semgrep

**Code Formatting**:
- `.style.yapf` exists for Python
- `.pylintrc` exists but appears unused in CI
- No Go formatter enforcement (gofmt/goimports)
- No Prettier for TypeScript

### Container Images

**Dockerfiles** (21 total):
- Backend: 8 Dockerfiles (apiserver, cacheserver, persistenceagent, scheduledworkflow, viewercontroller, visualization, artifact_manager, metadata_writer)
- Frontend: 1 Dockerfile
- Tests: 1 Dockerfile
- Tekton catalog: 3 Dockerfiles
- Third-party: 2 Dockerfiles
- Tools/scripts: 6 Dockerfiles

**Build Patterns**:
- Multi-stage builds used (builder + runtime)
- UBI8 base images (`registry.access.redhat.com/ubi8/go-toolset:1.21`, `registry.redhat.io/ubi8/ubi-minimal`)
- Proper user switching (non-root execution with `USER 1001`)
- Labels present for image metadata

**Gaps**:
- No vulnerability scanning (Trivy, Grype)
- No SBOM generation
- No image signing/attestation
- No multi-architecture builds
- No health check instructions in Dockerfiles
- No image startup validation in CI
- Node.js base image (`node:14.18.2`) is severely outdated (Node 14 EOL April 2023)

### Security

| Practice | Status | Details |
|----------|--------|---------|
| SAST/CodeQL | Missing | No static security analysis |
| Dependency scanning | Partial | `.snyk` exists but excludes key directories |
| Secret detection | Missing | No gitleaks or TruffleHog |
| Container scanning | Missing | No Trivy, Grype, or equivalent |
| Image signing | Missing | No cosign or Notary |
| SBOM | Missing | No Syft, SPDX, or CycloneDX |
| License compliance | Present | `go-licenses.yaml` with comprehensive overrides |
| RBAC review | Missing | No automated RBAC testing |

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: All test types need rules (Go unit tests with testify, Python unittest/pytest, TypeScript jest, integration tests with Kind, E2E tests)
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - Go unit tests (testify suites, table-driven tests, mock patterns)
  - Python SDK tests (compiler test patterns, golden YAML validation)
  - TypeScript frontend tests (jest, server integration tests)
  - Integration tests (Kind cluster setup, API client testing)
  - E2E tests (OpenShift deployment, bash test framework)

## Recommendations

### Priority 0 (Critical)

1. **Add coverage tracking with enforcement** — Integrate codecov for Go, Python, and TypeScript tests. Set minimum threshold (e.g., 60%) with PR status checks. This is the single highest-impact improvement.

2. **Add container security scanning** — Add Trivy to the PR image build workflow. With 21 Dockerfiles and UBI8/Node14 base images, vulnerability exposure is high.

3. **Upgrade all CI dependencies to current versions** — Python 3.7/3.8 are EOL and receiving no security patches. Go 1.19 is EOL. All GitHub Actions are on deprecated v2. This is a security risk.

### Priority 1 (High Value)

4. **Add image runtime validation** — After building PR images, run basic startup and health check tests. Use `docker run --rm` with a timeout to verify containers start successfully.

5. **Add CodeQL or gosec for SAST** — The Go backend handles SQL queries, file uploads, and API requests. Static analysis would catch injection vulnerabilities.

6. **Create agent rules for test automation** — Add `.claude/rules/` with patterns for Go (testify), Python (unittest), and TypeScript (jest) test creation.

7. **Add pre-commit hooks** — Enforce linting (flake8, gofmt) and formatting before commits reach CI.

8. **Add Go linting with golangci-lint** — No Go linting exists. Add `.golangci.yaml` with recommended linters (errcheck, gosec, govet, staticcheck).

### Priority 2 (Nice-to-Have)

9. **Add SBOM generation** for container images (Syft or SPDX)
10. **Add image signing/attestation** with cosign
11. **Implement multi-architecture image builds** (amd64/arm64)
12. **Add performance regression testing** for API server endpoints
13. **Upgrade Node.js base image** from 14.x (EOL) to 20.x LTS
14. **Add CI caching** for Go modules, npm packages, and pip dependencies
15. **Add secret detection** with gitleaks or TruffleHog

## Comparison to Gold Standards

| Practice | data-science-pipelines-tekton | odh-dashboard | notebooks | kserve |
|----------|-------------------------------|---------------|-----------|--------|
| Unit Tests | Basic (3 langs) | Comprehensive | N/A | Comprehensive |
| Integration Tests | Kind-based (conditional) | Contract tests | N/A | envtest |
| E2E Tests | Manual cluster required | Cypress automated | Automated | Automated |
| Coverage Tracking | None | Codecov enforced | N/A | Codecov enforced |
| Coverage Threshold | None | Yes (enforced) | N/A | Yes (enforced) |
| Container Scanning | None | Trivy | Trivy | Trivy |
| SAST/CodeQL | None | CodeQL | N/A | CodeQL |
| Pre-commit Hooks | None | Yes | Yes | Yes |
| Go Linting | None | golangci-lint | N/A | golangci-lint |
| Image Validation | None | Startup tests | 5-layer validation | Health checks |
| Agent Rules | None | Comprehensive | Partial | None |
| CI Caching | None | Yes | Yes | Yes |
| Action Versions | v2 (deprecated) | v4 (current) | v4 (current) | v4 (current) |

## File Paths Reference

### CI/CD
- `.github/workflows/kfp-tekton-unittests.yml` — Unit tests, lint, integration
- `.github/workflows/build-prs.yml` — PR image builds
- `.github/workflows/build-prs-trigger.yaml` — PR build trigger
- `.github/workflows/build-master.yml` — Master branch image builds
- `.github/workflows/build-images.yaml` — Reusable build workflow
- `.tekton/pipeline.yaml` — Tekton CI pipeline definition
- `Makefile` — Build and test targets

### Testing
- `backend/src/apiserver/server/*_test.go` — API server unit tests
- `backend/src/apiserver/storage/*_test.go` — Storage layer unit tests
- `backend/test/integration/*_test.go` — Backend integration tests
- `frontend/server/*.test.ts` — Server unit tests
- `frontend/src/lib/*.test.ts` — Frontend library tests
- `sdk/python/tests/compiler/compiler_tests.py` — SDK compiler tests
- `tests/basictests/ds-pipelines.sh` — E2E bash tests
- `scripts/deploy/github/e2e-test.sh` — CI E2E runner

### Container Images
- `backend/Dockerfile` — API server image
- `backend/Dockerfile.cacheserver` — Cache server image
- `backend/Dockerfile.persistenceagent` — Persistence agent image
- `backend/Dockerfile.scheduledworkflow` — Scheduled workflow image
- `frontend/Dockerfile` — Frontend image
- `backend/artifact_manager/Dockerfile` — Artifact manager image

### Code Quality
- `.pylintrc` — Python linting config (not enforced in CI)
- `.style.yapf` — Python formatting config
- `.snyk` — Snyk policy (excludes tekton-catalog and frontend)

### Security
- `.snyk` — Snyk exclusion policy
- `go-licenses.yaml` — License compliance configuration
