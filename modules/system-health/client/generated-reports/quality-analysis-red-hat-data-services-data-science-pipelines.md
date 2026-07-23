---
repository: "red-hat-data-services/data-science-pipelines"
overall_score: 6.9
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Good unit test ratio (24% Go, 22% Python) with multi-version Python testing and Ginkgo framework"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Excellent E2E suite with multi-K8s, multi-Argo, multi-storage matrix; 10-15 parallel Ginkgo nodes"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time image builds for all components; Tekton/Konflux configs present but push-only"
  - dimension: "Image Testing"
    score: 5.0
    status: "Multi-stage builds, multi-arch support, UBI bases for main images; no runtime validation or health checks"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "pytest-cov installed but no coverage reporting, no thresholds, no codecov/coveralls integration"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "50+ workflows with extensive matrix testing, concurrency control, path-based triggers, parallelization"
  - dimension: "Static Analysis"
    score: 7.0
    status: "Strong linting (golangci-lint v2, pre-commit, flake8/isort/yapf); excellent FIPS compliance; no Dependabot/Renovate"
  - dimension: "Agent Rules"
    score: 8.0
    status: "Comprehensive 683-line AGENTS.md with testing policy, architecture guidance, and CI/CD docs"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Coverage regressions go undetected; no baseline or threshold to prevent quality erosion"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No container runtime validation"
    impact: "Image startup failures and missing dependencies not caught until deployment"
    severity: "HIGH"
    effort: "6-10 hours"
  - title: "Inconsistent Dockerfile base images"
    impact: "viewercontroller, cacheserver, conformance, and visualization use alpine/debian/python-slim instead of UBI — breaks FIPS compliance chain"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No dependency alert automation (Dependabot/Renovate)"
    impact: "Vulnerable or outdated dependencies require manual discovery and tracking"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add codecov integration with Go and Python coverage reporting"
    effort: "4-6 hours"
    impact: "Establish coverage baselines, catch regressions on PRs, enable threshold enforcement"
  - title: "Enable Dependabot for Go, Python, Docker, and GitHub Actions ecosystems"
    effort: "1-2 hours"
    impact: "Automated dependency update PRs with security alerting"
  - title: "Add HEALTHCHECK instructions to production Dockerfiles"
    effort: "2-3 hours"
    impact: "Enable container orchestrators to detect unhealthy instances automatically"
  - title: "Migrate remaining Dockerfiles to UBI base images"
    effort: "4-8 hours"
    impact: "Consistent FIPS compliance across all container images"
recommendations:
  priority_0:
    - "Add codecov integration with Go `--coverprofile` and Python `pytest-cov` reporting to PRs"
    - "Standardize all production Dockerfiles on UBI9 base images for FIPS compliance consistency"
    - "Add container startup validation in CI (e.g., `docker run --entrypoint` smoke test)"
  priority_1:
    - "Enable Dependabot for gomod, pip, docker, and github-actions ecosystems"
    - "Add coverage threshold enforcement (e.g., 60% minimum, no regression gate)"
    - "Create .claude/rules/ directory with test-type-specific rules (unit, e2e, integration)"
  priority_2:
    - "Add HEALTHCHECK instructions to production Dockerfiles"
    - "Add Go module caching in Go-based CI workflows"
    - "Enable Tekton/Konflux pipeline runs on PRs for pre-merge build validation"
---

# Quality Analysis: data-science-pipelines

**Repository**: [red-hat-data-services/data-science-pipelines](https://github.com/red-hat-data-services/data-science-pipelines)
**Type**: Polyglot monorepo (Go backend, Python SDK, React frontend) — Kubeflow Pipelines downstream fork
**Tier**: Downstream | RHOAIENG / AI Pipelines
**Analysis Date**: 2026-07-20

## Executive Summary

- **Overall Score: 6.9/10**
- **Key Strengths**: Exceptional E2E/integration testing with multi-version K8s/Argo matrices, comprehensive CI/CD with 50+ workflows, strong FIPS compliance in core images, and a detailed 683-line AGENTS.md
- **Critical Gaps**: No coverage tracking or enforcement, no container runtime validation, inconsistent base images across Dockerfiles, no dependency alert automation
- **Agent Rules Status**: Present — comprehensive AGENTS.md with CLAUDE.md symlink, no `.claude/rules/` directory

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 7.0/10 | Good test ratio with multi-version Python; no Go coverage |
| Integration/E2E | 20% | 9.0/10 | Excellent multi-version matrix with parallel Ginkgo |
| Build Integration | 15% | 7.0/10 | PR image builds for all components; Tekton push-only |
| Image Testing | 10% | 5.0/10 | Multi-stage/multi-arch; no runtime validation |
| Coverage Tracking | 10% | 2.0/10 | pytest-cov installed but unused; no reporting |
| CI/CD Automation | 15% | 8.0/10 | 50+ workflows with matrices and concurrency |
| Static Analysis | 10% | 7.0/10 | Strong linting + FIPS; no dependency alerts |
| Agent Rules | 5% | 8.0/10 | Comprehensive AGENTS.md; no `.claude/rules/` |
| **Overall** | **100%** | **6.9/10** | |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Severity**: HIGH
- **Impact**: Coverage regressions go completely undetected. No baseline exists to measure quality improvements or prevent erosion.
- **Evidence**: No `.codecov.yml`, no `--coverprofile` in Go test workflows, `pytest-cov` is installed but coverage data is never collected or reported. No coverage threshold enforcement anywhere.
- **Effort**: 4-8 hours

### 2. No Container Runtime Validation
- **Severity**: HIGH
- **Impact**: Image startup failures, missing runtime dependencies, and incorrect entrypoints are not caught until deployment.
- **Evidence**: No `testcontainers` usage, no `docker run` smoke tests in CI, no HEALTHCHECK instructions in any Dockerfile.
- **Effort**: 6-10 hours

### 3. Inconsistent Dockerfile Base Images
- **Severity**: HIGH
- **Impact**: Several production images use non-UBI bases (alpine, debian, python-slim), breaking the FIPS compliance chain established in core images.
- **Evidence**:
  - `Dockerfile.viewercontroller`: `golang:1.26.3-alpine` → `alpine:3.21`
  - `Dockerfile.cacheserver`: `golang:1.26.3-alpine` → `alpine:3.21`
  - `Dockerfile.conformance`: `golang:1.26.3-alpine` → `alpine:3.21`
  - `Dockerfile.visualization`: `python:3.11-slim`
  - Core images correctly use `ubi9/go-toolset` → `ubi9/ubi-minimal`
- **Effort**: 4-8 hours

### 4. No Dependency Alert Automation
- **Severity**: MEDIUM
- **Impact**: Vulnerable or outdated dependencies in Go modules, Python packages, Docker base images, and GitHub Actions require manual discovery.
- **Evidence**: No `.github/dependabot.yml`, no `renovate.json` or `.renovaterc`.
- **Effort**: 1-2 hours

## Quick Wins

### 1. Enable Dependabot (1-2 hours)
Create `.github/dependabot.yml` covering all ecosystems:
```yaml
version: 2
updates:
  - package-ecosystem: "gomod"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "pip"
    directory: "/sdk/python"
    schedule:
      interval: "weekly"
  - package-ecosystem: "docker"
    directory: "/backend"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 2. Add Codecov Integration (4-6 hours)
- Add `--coverprofile=coverage.out` to Go test commands in `unit-tests.yaml`
- Configure `pytest-cov` to actually generate coverage reports in SDK test workflows
- Add `.codecov.yml` with threshold configuration
- Add `codecov/codecov-action` to upload coverage from PR workflows

### 3. Add HEALTHCHECK to Production Dockerfiles (2-3 hours)
Add health check instructions to backend images (apiserver, driver, launcher, etc.) to enable Kubernetes probes.

### 4. Migrate Remaining Dockerfiles to UBI (4-8 hours)
Migrate `Dockerfile.viewercontroller`, `Dockerfile.cacheserver`, `Dockerfile.conformance`, and `Dockerfile.visualization` to UBI9 base images for consistent FIPS compliance.

## Detailed Findings

### Unit Tests

**Go Tests**: 171 test files across 689 Go source files (24.8% ratio)
- Testing framework: Standard Go `testing` package + Ginkgo/Gomega for BDD-style tests
- Backend test directories: `backend/test/` with sub-directories for compiler, end2end, initialization, integration, proto_tests, v2 API tests
- PR-triggered: `unit-tests.yaml` runs `go test ./...` on backend changes
- `t.Parallel()` not widely used (room for improvement)

**Python Tests**: 252 test files across 1,167 Python source files (21.6% ratio)
- Testing framework: pytest with `pytest.ini` configured (`testpaths = sdk/python/kfp`)
- SDK unit tests run on Python 3.9 and 3.13 (multi-version)
- PR-triggered: `kfp-sdk-unit-tests.yml` runs on `api/**` and `sdk/**` changes
- Sample pipeline tests provide good integration-level coverage

**Frontend Tests**: 44 test files
- Testing framework: Jest for unit tests, WebdriverIO for integration tests
- PR-triggered: `frontend.yml` runs on `frontend/**` changes

**Strengths**: Multi-version Python testing, good test-to-code ratio, comprehensive test directories
**Gaps**: No Go test coverage reporting, no test isolation patterns enforced (`t.Parallel()`)

### Integration/E2E Tests

This is the repository's strongest dimension with exceptional testing breadth:

**E2E Pipeline Tests** (`e2e-test.yml`):
- Matrix: K8s v1.31.0 + v1.35.0, cache enabled/disabled, multiple test labels (E2ECritical, E2EEssential, E2EParallelNested, E2EProxy, E2EFailure)
- Storage variants: SeaweedFS and MinIO
- TLS: Pod-to-pod TLS enabled/disabled
- Proxy testing: Dedicated E2EProxy label
- Parallelization: 10 Ginkgo parallel nodes

**API Server Tests** (`api-server-tests.yml`):
- Multi-version Argo: v3.5.14, v3.7.3, v4.0.4
- Pipeline stores: database and kubernetes variants
- Multi-K8s: v1.29.2, v1.31.14, v1.35.0
- Parallelization: 15 Ginkgo parallel nodes

**Additional Integration Suites**:
- Frontend integration tests: Selenium-based, K8s v1.31.14 + v1.35.0 matrix, TLS variants
- Integration tests v1: Legacy API compatibility testing
- Webhook integration tests: Multi-K8s version matrix
- Upgrade tests: Release-to-current migration validation
- Kubernetes native migration tests: Migration path testing
- Compiler tests: Argo workflow compilation validation

**Cluster Setup**: Automated Kind cluster creation via `.github/actions/create-cluster/`

**Strengths**: Multi-version K8s/Argo/storage testing, extensive matrix coverage, parallel test execution, upgrade testing
**Gaps**: Minor — most tests are push + PR triggered

### Build Integration

**PR Image Builds** (`build-prs.yml`):
- Triggered via `workflow_run` from `build-prs-trigger.yaml` on PRs
- Builds 5 component images: api-server, frontend, persistenceagent, scheduledworkflow, driver
- Uses matrix strategy for parallel builds
- Images pushed to Quay.io with `pr-{number}` tags

**Tekton/Konflux** (`.tekton/`):
- 5 Tekton PipelineRun definitions for push-to-master builds
- Components: api-server-v2, driver, launcher, persistenceagent-v2, scheduledworkflow-v2
- Currently push-only (`event == "push" && target_branch == "master"`)

**Kustomize**: Used in CI for deployment via `kubectl kustomize`

**Build Validation**:
- Go version consistency check (`go-version-consistency.yml`) verifying go.mod matches Dockerfiles
- Generated file validation (`validate-generated-files.yml`)
- Manifest validation (`kubeflow-pipelines-manifests.yml`)

**Strengths**: PR-time image builds for all major components, Konflux pipeline definitions exist, Kustomize deployment in CI
**Gaps**: Tekton/Konflux pipelines not triggered on PRs (push-only), no dry-run manifest validation

### Image Testing

**Dockerfiles**: 20+ Dockerfiles for various components
- Multi-stage builds: Backend Dockerfile uses 3 stages (builder → compiler → runtime)
- Multi-arch support: `--platform=$BUILDPLATFORM`, `TARGETARCH` parameters, buildx in CI
- Image digest pinning: All primary UBI images use SHA256 digest pinning

**Base Images**:
- ✅ Core backend (apiserver, driver, launcher, persistenceagent, scheduledworkflow): `ubi9/go-toolset` → `ubi9/ubi-minimal`
- ❌ viewercontroller: `golang:alpine` → `alpine:3.21`
- ❌ cacheserver: `golang:alpine` → `alpine:3.21`
- ❌ conformance: `golang:alpine` → `alpine:3.21`
- ❌ visualization: `python:3.11-slim`

**Missing**:
- No HEALTHCHECK in any Dockerfile
- No testcontainers or container runtime validation
- No `docker run` smoke tests in CI
- No container startup verification

### Coverage Tracking

**Current State**: Effectively absent.

- `pytest-cov` is installed in SDK test workflows (`kfp-sdk-unit-tests.yml`, `kfp-sdk-client-tests.yml`, `kfp-sdk-tests.yml`) but coverage data is never collected, reported, or enforced
- No `--coverprofile` flag in Go test workflows
- No `.codecov.yml` or `codecov.yml` configuration
- No coverage threshold enforcement
- No PR coverage commenting or reporting
- No `.coveragerc` configuration

This is the repository's weakest dimension and represents the most impactful improvement opportunity.

### CI/CD Automation

**Workflow Inventory**: 50+ workflows — one of the most comprehensive CI configurations in the RHOAI ecosystem.

**PR-Triggered Workflows** (~35):
- Unit tests: Go backend, Python SDK (multi-version), frontend
- Integration/E2E: API server, E2E pipelines, frontend integration, webhooks
- Build validation: PR image builds, manifest validation, generated file checks
- Code quality: Pre-commit, isort, yapf, docformatter, component YAML
- Security: Trivy scanning
- Process: Commit check, CI label management, stable merge check

**Concurrency Control**: Used in most workflows with `cancel-in-progress: true`

**Caching**: pip caching in Python workflows; Go module caching not explicitly configured

**Matrix Strategies**: Extensive use across E2E, API server, integration, SDK, and image build workflows

**Test Parallelization**: Ginkgo parallel nodes (10-15)

**Path-Based Triggers**: Most workflows use `paths:` filters to avoid unnecessary runs

**Scheduled Jobs**: Weekly upstream sync, stale issue management, CodeQL security scan

**Strengths**: Comprehensive workflow coverage, good concurrency control, path-based filtering, extensive matrices
**Gaps**: No Go module caching, some workflows lack `timeout-minutes`

### Static Analysis

#### Linting
- **Go**: golangci-lint v2 with 6 linters (gocritic, govet, ineffassign, misspell, staticcheck, unused) + formatters (gofmt, goimports)
- **Python**: flake8 (W605 select), pylintrc, isort, yapf, docformatter, pycln
- **TypeScript**: Mypy type checking (`mypy.ini` with `ignore_missing_imports`)
- **YAML**: actionlint for GitHub Actions validation
- **Pre-commit hooks**: Comprehensive configuration with check-yaml, check-json, end-of-file-fixer, trailing-whitespace, debug-statements, check-merge-conflict, name-tests-test, no-commit-to-branch

#### FIPS Compatibility
Excellent FIPS compliance in core images:
- `godebug fips140=on` in `go.mod`
- `GOFIPS140=v1.0.0` build flag in all core backend Dockerfiles
- `-tags no_openssl` build tag for Go FIPS module
- `CGO_ENABLED=1` for apiserver (required for FIPS)
- UBI9 base images (FIPS-capable) for core components
- `math/rand` usage limited to test utilities only (acceptable)

**FIPS Gap**: Non-core images (viewercontroller, cacheserver, conformance, visualization) use non-UBI bases, breaking FIPS compliance chain.

#### Dependency Alerts
- ❌ No `.github/dependabot.yml`
- ❌ No `renovate.json` or `.renovaterc`
- No automated dependency update mechanism

### Agent Rules

**AGENTS.md** (683 lines, linked as `CLAUDE.md`):
- **Architecture**: Baseline architecture diagram reference, end-to-end flow documentation
- **Policies**: Testing policy (unit tests required for new non-trivial code), commit policy (sign-off required, no AI co-authors), code reuse policy, architectural boundary policy
- **Development Guide**: Local development setup, cluster deployment (standalone + dev mode), local testing commands
- **CI/CD Documentation**: Test matrices, cluster setup helpers, workflow path verification
- **Quick Reference**: Essential commands and environment variables
- **Troubleshooting**: Common error patterns and fixes

**Strengths**: One of the most comprehensive AGENTS.md files in the RHOAI ecosystem. Covers architecture, policies, development workflows, and troubleshooting.

**Gaps**: No `.claude/rules/` directory with granular test creation rules. Testing policy is described in prose but not structured as actionable rules for AI agents to follow when creating tests.

## Recommendations

### Priority 0 (Critical)

1. **Add codecov integration** with Go `--coverprofile` and Python `pytest-cov` reporting to PRs. This is the single highest-impact improvement — without coverage data, quality improvements cannot be measured.

2. **Standardize all production Dockerfiles on UBI9 base images**. The FIPS compliance chain is broken for viewercontroller, cacheserver, conformance, and visualization images.

3. **Add container startup validation** in CI — at minimum, `docker run --entrypoint /bin/sh -c "exit 0"` for each built image to catch missing shared libraries and broken entrypoints.

### Priority 1 (High Value)

4. **Enable Dependabot** for gomod, pip, docker, and github-actions ecosystems. This is a 1-2 hour task with immediate ongoing value.

5. **Add coverage threshold enforcement** — start with a reasonable baseline (e.g., 60% for Python SDK) and gate PRs on no-regression.

6. **Create `.claude/rules/` directory** with test-type-specific rules for unit, E2E, and integration tests, following the patterns established in the AGENTS.md testing policy.

### Priority 2 (Nice-to-Have)

7. **Add HEALTHCHECK instructions** to production Dockerfiles for container orchestrator health detection.

8. **Add Go module caching** in Go-based CI workflows to reduce build times.

9. **Enable Tekton/Konflux pipeline runs on PRs** for pre-merge build validation — currently these are push-only to master.

10. **Add `timeout-minutes`** to workflows that lack it, preventing runaway CI jobs.

## Comparison to Gold Standards

| Feature | data-science-pipelines | odh-dashboard | notebooks | kserve |
|---------|----------------------|---------------|-----------|--------|
| Unit Test Ratio | ~23% (Good) | ~35% (Strong) | Moderate | ~25% |
| E2E Multi-Version | ✅ Excellent (K8s + Argo + storage) | ✅ Multi-OCP | ✅ Multi-platform | ✅ Multi-K8s |
| Coverage Enforcement | ❌ None | ✅ Codecov gates | Partial | ✅ Codecov |
| FIPS Compliance | ✅ Core images (gaps in non-core) | ✅ | ✅ 5-layer | ✅ |
| Dependency Alerts | ❌ None | ✅ Dependabot | ✅ | ✅ |
| Container Runtime Testing | ❌ None | Partial | ✅ Testcontainers | ✅ |
| Agent Rules | ✅ 683-line AGENTS.md | ✅ Comprehensive | Minimal | Minimal |
| Pre-commit Hooks | ✅ Comprehensive | ✅ | ✅ | ✅ |
| CI Matrix Breadth | ✅ Exceptional | ✅ | ✅ | ✅ |

## File Paths Reference

### CI/CD
- `.github/workflows/*.yml` — 50+ workflow definitions
- `.github/actions/` — Reusable actions (create-cluster, deploy, test-and-report)
- `.tekton/` — 5 Konflux pipeline definitions (push-only)
- `Makefile` — Root-level targets (check-diff, ginkgo, visualization tests)
- `backend/Makefile` — Backend build and test targets
- `justfile` — Developer convenience commands

### Testing
- `backend/test/` — Go backend tests (compiler, end2end, initialization, integration, v2)
- `sdk/python/kfp/` — Python SDK with pytest configuration
- `frontend/server/` — Frontend unit tests (*.test.ts)
- `test/frontend-integration-test/` — Selenium-based frontend E2E
- `test/` — Shell scripts for various test suites
- `pytest.ini` — pytest configuration

### Code Quality / Static Analysis
- `.golangci.yaml` — golangci-lint v2 configuration
- `.pre-commit-config.yaml` — Pre-commit hook configuration
- `.pylintrc` — Python linting configuration
- `mypy.ini` — Type checking configuration
- `.isort.cfg` — Import sorting configuration
- `.style.yapf` — YAPF formatting configuration

### Container Images
- `backend/Dockerfile` — API server (3-stage, UBI9)
- `backend/Dockerfile.*` — Driver, launcher, persistenceagent, scheduledworkflow, etc.
- `frontend/Dockerfile` — Frontend image
- `.dockerignore` — Build context exclusions

### Agent Rules
- `AGENTS.md` — Comprehensive agent guide (683 lines)
- `CLAUDE.md` — Symlink to AGENTS.md
