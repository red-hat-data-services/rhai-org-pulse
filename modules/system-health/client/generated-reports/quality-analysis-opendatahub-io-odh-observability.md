---
repository: "opendatahub-io/odh-observability"
overall_score: 3.5
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Excellent 0.96:1 test-to-code ratio with 125 test functions across 8 files"
  - dimension: "Integration/E2E"
    score: 2.0
    status: "E2E Makefile target exists but no tests directory or tests; no envtest integration tests"
  - dimension: "Build Integration"
    score: 3.0
    status: "Tekton image builds only; no PR-time test execution or Konflux simulation"
  - dimension: "Image Testing"
    score: 3.0
    status: "Multi-stage UBI9 builds with FIPS; no vulnerability scanning, SBOM, or runtime validation"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "Makefile generates cover.out but no codecov integration, thresholds, or PR reporting"
  - dimension: "CI/CD Automation"
    score: 3.0
    status: "Tekton pipelines build images but no tests, linting, or quality gates run in CI"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No agent rules; CLAUDE.md is explicitly .gitignored; no .claude/ directory"
critical_gaps:
  - title: "No tests run in CI/CD pipeline"
    impact: "Unit tests exist but never execute in PR or push pipelines; regressions can merge undetected"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No E2E or integration test suite"
    impact: "Operator behavior against a real cluster is entirely untested; deployment failures caught only in staging"
    severity: "HIGH"
    effort: "40-80 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Coverage regressions invisible; new code can merge with zero test coverage"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No vulnerability scanning (Trivy/Snyk)"
    impact: "Container image vulnerabilities and dependency CVEs are not detected before release"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No linting in CI (golangci-lint)"
    impact: "Code quality issues, potential bugs, and style violations are not caught automatically"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No agent rules for test automation"
    impact: "AI-assisted development produces inconsistent test patterns; CLAUDE.md is .gitignored"
    severity: "LOW"
    effort: "4-8 hours"
quick_wins:
  - title: "Add a Tekton task to run 'make test' before image build"
    effort: "2-4 hours"
    impact: "Catch regressions on every PR; blocks merge if tests fail"
  - title: "Add codecov integration with coverage thresholds"
    effort: "2-4 hours"
    impact: "Visibility into coverage trends; enforce minimum coverage on PRs"
  - title: "Add golangci-lint configuration and CI task"
    effort: "2-4 hours"
    impact: "Catch bugs, style issues, and inefficiencies automatically"
  - title: "Add Trivy container scanning to push pipeline"
    effort: "1-2 hours"
    impact: "Detect known CVEs in base images and dependencies before release"
  - title: "Create basic .claude/rules/ for test patterns"
    effort: "2-3 hours"
    impact: "Consistent AI-generated tests following the project's existing Go testing patterns"
recommendations:
  priority_0:
    - "Add test execution (make test) to Tekton PR pipeline as a required gate"
    - "Integrate codecov with coverage threshold enforcement (recommend 70% minimum)"
    - "Add golangci-lint configuration and run it in PR pipeline"
  priority_1:
    - "Build envtest-based integration tests for the reconciler (real API server, fake etcd)"
    - "Create E2E test suite using Kind cluster for operator deployment validation"
    - "Add Trivy container image scanning to both PR and push pipelines"
    - "Add SBOM generation to container build"
  priority_2:
    - "Create .claude/rules/ with unit test, integration test, and operator test patterns"
    - "Add pre-commit hooks for fmt, vet, and lint"
    - "Add Helm chart linting to PR pipeline"
    - "Consider multi-architecture container builds for ARM64 support"
---

# Quality Analysis: odh-observability

## Executive Summary

- **Overall Score: 3.5/10**
- **Repository Type**: Kubernetes Operator (Go, controller-runtime)
- **Primary Language**: Go 1.25.7
- **Key Strengths**: Excellent unit test coverage with a near 1:1 test-to-code ratio (3,055 test LOC vs 3,184 source LOC), 125 well-structured test functions covering reconciler logic, conditions management, template data, webhook injection, and API types. Clean operator architecture using odh-platform-utilities.
- **Critical Gaps**: Despite strong local test quality, no tests execute in CI/CD. The Tekton pipelines only build container images. No coverage tracking, no linting, no vulnerability scanning, no E2E tests.
- **Agent Rules Status**: Missing. CLAUDE.md is explicitly `.gitignored`.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.0/10 | Excellent 0.96:1 test-to-code ratio with 125 test functions |
| Integration/E2E | 2.0/10 | E2E Makefile target exists but no tests; no envtest |
| **Build Integration** | **3.0/10** | **Tekton image builds only; no PR-time test execution** |
| Image Testing | 3.0/10 | Multi-stage UBI9 + FIPS; no scanning or runtime validation |
| Coverage Tracking | 1.0/10 | `cover.out` generated locally but nothing in CI |
| CI/CD Automation | 3.0/10 | Only Tekton image builds; no quality gates |
| Agent Rules | 0.0/10 | No rules; CLAUDE.md is .gitignored |

## Critical Gaps

### 1. No Tests Run in CI/CD Pipeline
- **Impact**: Unit tests exist but never execute in PR or push pipelines; regressions can merge undetected
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The `.tekton/odh-observability-pull-request.yaml` pipeline only builds a container image. Despite having 125 well-written test functions, `make test` or `make unit-test` is never called in CI. A contributor could break any tested behavior and the PR would still pass.

### 2. No E2E or Integration Test Suite
- **Impact**: Operator behavior against a real/simulated cluster is entirely untested
- **Severity**: HIGH
- **Effort**: 40-80 hours
- **Details**: The Makefile defines an `e2e-test` target (`go test ./tests/e2e/ -v -timeout 120m`) but the `tests/e2e/` directory does not exist. There are no envtest-based integration tests that test the reconciler against a real API server. All tests use `fake.NewClientBuilder()` which doesn't validate webhook behavior, RBAC, or CRD validation.

### 3. No Coverage Tracking or Enforcement
- **Impact**: Coverage regressions are invisible; new code can merge with zero coverage
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: `make test` generates `cover.out` locally, but there is no codecov/coveralls integration, no coverage thresholds, and no PR coverage reporting.

### 4. No Container Vulnerability Scanning
- **Impact**: Known CVEs in base images and Go dependencies are not detected before release
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Neither the PR nor push Tekton pipelines include Trivy, Snyk, or any vulnerability scanner. The Konflux central pipeline may include scanning, but it's not visible in this repository's configuration.

### 5. No Linting Configuration or CI Enforcement
- **Impact**: Code quality issues, potential bugs, and inconsistencies are not caught automatically
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: No `.golangci.yaml` or `.golangci.yml` exists. The Makefile has `fmt` and `vet` targets but they aren't run in CI. No `go vet` or `staticcheck` in the pipeline.

### 6. No Agent Rules for Test Automation
- **Impact**: AI-assisted development has no guidance on test patterns, frameworks, or quality expectations
- **Severity**: LOW
- **Effort**: 4-8 hours
- **Details**: `CLAUDE.md` is in `.gitignore`. No `.claude/` directory, no `.claude/rules/`, no `AGENTS.md`. The existing test patterns are high quality and could serve as excellent templates for agent rules.

## Quick Wins

### 1. Add Test Execution to Tekton PR Pipeline
- **Effort**: 2-4 hours
- **Impact**: Catches regressions on every PR
- **Implementation**: Add a Tekton Task that runs `make unit-test` before the image build in `.tekton/odh-observability-pull-request.yaml`.

### 2. Add Codecov Integration
- **Effort**: 2-4 hours
- **Impact**: Coverage visibility and trend tracking
- **Implementation**: Generate `cover.out` in CI, upload to Codecov, add `codecov.yml` with threshold configuration.

### 3. Add golangci-lint
- **Effort**: 2-4 hours
- **Impact**: Automated bug and style detection
- **Implementation**: Create `.golangci.yaml` with recommended linters (errcheck, gosimple, govet, ineffassign, staticcheck, unused, gosec, misspell).

### 4. Add Trivy Scanning to Push Pipeline
- **Effort**: 1-2 hours
- **Impact**: CVE detection before image publish
- **Implementation**: Add a Trivy scan task after image build in the push pipeline.

### 5. Create Basic Agent Rules
- **Effort**: 2-3 hours
- **Impact**: Consistent AI-generated test quality
- **Implementation**: Remove `CLAUDE.md` from `.gitignore`, create `.claude/rules/unit-tests.md` documenting the project's Go testing patterns.

## Detailed Findings

### CI/CD Pipeline

**Pipeline Architecture**: Tekton/Konflux (no GitHub Actions)

| Pipeline | Trigger | Purpose | Tests? |
|----------|---------|---------|--------|
| `odh-observability-pull-request.yaml` | PR to `main` | Build container image | No |
| `odh-observability-push.yaml` | Push to `main` | Build + publish stable image | No |

- Both pipelines reference `odh-konflux-central.git` for the `multi-arch-container-build.yaml` pipeline definition
- Cancel-in-progress is set to `false` (allows concurrent builds)
- Max keep runs: 3
- **Critical**: Neither pipeline runs `make test`, `make unit-test`, `go vet`, or any linting

**Build Targets** (from Makefile):
- `make test` - Full pipeline (manifests, generate, fmt, vet, test with coverage)
- `make unit-test` - Quick unit tests only
- `make test-verbose` - Verbose output
- `make e2e-test` - E2E target (but no tests exist)
- `make build` - Binary compilation
- `make docker-build` - Container image build
- `make helm-lint` - Helm chart linting
- `make helm-template` - Template rendering

### Test Coverage

**Test Metrics**:
- Source files: 11 Go files (3,184 LOC)
- Test files: 8 Go files (3,055 LOC)
- Test-to-code ratio: **0.96:1** (excellent)
- Total test functions: **125**
- Testing framework: Go standard `testing` package (no testify)
- Mocking strategy: `controller-runtime/client/fake` + `k8s.io/client-go/kubernetes/fake`

**Test Coverage by Component**:

| Component | Test File | Functions | Coverage |
|-----------|-----------|-----------|----------|
| API Types | `monitoring_types_test.go` | 10 | Constants, status accessors, conditions, deep copy |
| Reconciler | `monitoring_reconciler_test.go` | 7 | Removed state, preconditions, nothing-configured, status URL, releases, observed generation |
| Actions | `actions_test.go` | 18 | All deploy* functions (monitoring stack, tracing, OTel, alerting, node metrics, Perses variants) |
| Conditions | `conditions_test.go` | 8 | Aggregate ready logic, degraded states, phase transitions |
| Helpers | `helpers_test.go` | 17 | CRD detection, TLS CA sync, status URL, local endpoint detection, TLS determination, resource defaults, GVK resolution |
| Template Data | `templatedata_test.go` | 28 | Storage/replicas/traces data, resource data, image URLs, env overrides, build template data, exporter schema validation |
| Template Validation | `templatedata_extended_test.go` | 18 | Exporter validation (reserved names, invalid formats, oversized configs, nesting, security checks) |
| Webhook | `mutating_test.go` | 11 | Nil decoder/client, unexpected kind, namespace labeling, label injection, preserve existing labels, delete operations |

**Test Quality Assessment**:
- Tests are well-structured with clear names describing the scenario being tested
- Good use of table-driven tests (especially in helpers and template data tests)
- Proper use of `t.Helper()` for test setup functions
- Good edge case coverage (nil inputs, missing CRDs, empty data)
- Tests verify both positive paths and error conditions
- No use of `testify/assert` — uses standard `t.Errorf`/`t.Fatalf`

**Gaps**:
- No envtest integration tests (reconciler tests use fake client)
- No E2E tests (directory referenced in Makefile doesn't exist)
- No fuzz testing for template rendering or YAML parsing
- No webhook integration tests with real admission requests
- No Helm chart template tests

### Code Quality

**Linting**: None configured
- No `.golangci.yaml` or `.golangci.yml`
- No `.pre-commit-config.yaml`
- Makefile has `fmt` and `vet` targets but not enforced in CI

**Static Analysis**: None
- No CodeQL, gosec, or Semgrep configuration
- No SAST in pipelines

**Code Style**:
- Consistent Go coding style
- Good use of package structure (`api/`, `internal/controller/`, `internal/webhook/`)
- Proper error wrapping with `fmt.Errorf` and `%w`
- Clean separation of concerns (actions, conditions, helpers, template data)

### Container Images

**Dockerfiles**:
1. `Dockerfile` (community/upstream)
   - Multi-stage build: `ubi9/go-toolset` builder → `ubi9/ubi-minimal` runtime
   - FIPS support: `GOEXPERIMENT=strictfipsruntime`
   - Build args: `BUILDPLATFORM`, `TARGETPLATFORM`, `CGO_ENABLED`
   - Non-root user (UID 1001)
   - Platform default: `linux/amd64` only

2. `Dockerfiles/Dockerfile.konflux` (production/RHOAI)
   - Pinned base image digests (reproducible builds)
   - FIPS: both `GOEXPERIMENT` and `-tags strictfipsruntime`
   - Creates dedicated `odh-observability` user (UID 1000)
   - Red Hat labels for product metadata
   - No multi-arch annotations

**Gaps**:
- No vulnerability scanning (Trivy, Snyk)
- No SBOM generation
- No image startup validation
- No runtime testing (Testcontainers, etc.)
- No image signing/attestation at repo level
- Community Dockerfile defaults to single architecture

### Security Practices

| Practice | Status |
|----------|--------|
| Container scanning (Trivy/Snyk) | Not configured |
| SAST (CodeQL/gosec) | Not configured |
| Dependency scanning | Not configured |
| Secret detection (Gitleaks) | Not configured |
| FIPS compliance | Enabled in build |
| Non-root container | Yes (UID 1001/1000) |
| Pinned base images | Konflux only (digests) |
| SBOM generation | Not configured |

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No test types have rules
- **Quality**: N/A
- **Gaps**:
  - `CLAUDE.md` is in `.gitignore` — agents cannot discover project conventions
  - No `.claude/` directory or `.claude/rules/` files
  - No `AGENTS.md` for multi-agent guidance
  - The existing test patterns (fake clients, table-driven tests, condition assertions) would make excellent rule templates
- **Recommendation**: Remove `CLAUDE.md` from `.gitignore`, run `/test-rules-generator` to create rules from existing test patterns

## Recommendations

### Priority 0 (Critical)

1. **Add test execution to Tekton PR pipeline**
   - Run `make unit-test` as a required pre-build step
   - Gate the image build on test success
   - Estimated effort: 4-8 hours

2. **Integrate coverage tracking**
   - Generate `cover.out` in CI
   - Upload to Codecov
   - Set minimum coverage threshold (recommend 70% given current good coverage)
   - Add PR check for coverage delta
   - Estimated effort: 2-4 hours

3. **Add golangci-lint**
   - Create `.golangci.yaml` with recommended Go linters
   - Add lint check to PR pipeline
   - Estimated effort: 2-4 hours

### Priority 1 (High Value)

4. **Build envtest integration tests**
   - Use `controller-runtime/envtest` for reconciler testing against real API server
   - Test CRD validation, webhook admission, RBAC
   - Covers gaps that fake client tests miss
   - Estimated effort: 20-40 hours

5. **Create E2E test suite**
   - Implement `tests/e2e/` that the Makefile already references
   - Use Kind or Minikube for cluster provisioning
   - Test operator deployment, CR creation, monitoring stack provisioning
   - Estimated effort: 40-80 hours

6. **Add container image security scanning**
   - Trivy scan in push pipeline (HIGH/CRITICAL threshold)
   - Consider adding to PR pipeline for early detection
   - Add SBOM generation (Syft/Trivy)
   - Estimated effort: 4-8 hours

### Priority 2 (Nice-to-Have)

7. **Create agent rules for test automation**
   - Remove `CLAUDE.md` from `.gitignore`
   - Create `.claude/rules/unit-tests.md` documenting Go testing patterns
   - Create `.claude/rules/operator-tests.md` for CRD/condition testing
   - Estimated effort: 4-8 hours

8. **Add pre-commit hooks**
   - `go fmt`, `go vet`, `golangci-lint`
   - Helm chart linting
   - Estimated effort: 2-4 hours

9. **Helm chart testing**
   - Add `helm-lint` and `helm-template` to CI
   - Consider `chart-testing` (ct) for chart validation
   - Estimated effort: 2-4 hours

10. **Multi-architecture container builds**
    - Update community Dockerfile for ARM64 support
    - Test on both amd64 and arm64
    - Estimated effort: 4-8 hours

## Comparison to Gold Standards

| Dimension | odh-observability | odh-dashboard (Gold) | notebooks (Gold) | Gap |
|-----------|-------------------|---------------------|-------------------|-----|
| Unit Test Ratio | 0.96:1 | ~0.8:1 | ~0.5:1 | Ahead |
| Test Functions | 125 | 500+ | 200+ | Scale difference |
| E2E Tests | None | Cypress + Playwright | Multi-layer | Critical gap |
| Coverage Tracking | Local only | Codecov enforced | Codecov | Missing |
| CI Test Execution | None | GitHub Actions | GitHub Actions | Critical gap |
| Linting | None | ESLint + Prettier | golangci-lint | Missing |
| Container Scanning | None | Trivy | Trivy + Snyk | Missing |
| SBOM | None | Generated | Generated | Missing |
| Agent Rules | None | Comprehensive | Basic | Missing |
| Pre-commit Hooks | None | Husky | Pre-commit | Missing |

## File Paths Reference

### Source Code
- `cmd/main.go` - Operator entrypoint
- `api/v1alpha1/` - CRD API types (Monitoring, MonitoringSpec, MonitoringStatus)
- `internal/controller/` - Reconciler, actions, helpers, template data, conditions
- `internal/webhook/` - Mutating admission webhook
- `internal/controller/resources/` - YAML templates (29 template files)

### Build & Deploy
- `Makefile` - Build targets (test, build, docker-build, deploy, helm-lint)
- `Dockerfile` - Community container build
- `Dockerfiles/Dockerfile.konflux` - Production/RHOAI container build
- `charts/odh-observability/` - Helm chart

### CI/CD
- `.tekton/odh-observability-pull-request.yaml` - PR pipeline (image build only)
- `.tekton/odh-observability-push.yaml` - Push pipeline (image build + publish)

### Test Files
- `api/v1alpha1/monitoring_types_test.go`
- `internal/controller/actions_test.go`
- `internal/controller/conditions/conditions_test.go`
- `internal/controller/helpers_test.go`
- `internal/controller/monitoring_reconciler_test.go`
- `internal/controller/templatedata_test.go`
- `internal/controller/templatedata_extended_test.go`
- `internal/webhook/mutating_test.go`

### Missing Files (Expected)
- `.golangci.yaml` - Go linter configuration
- `.pre-commit-config.yaml` - Pre-commit hooks
- `.codecov.yml` - Coverage configuration
- `.github/workflows/` - GitHub Actions (uses Tekton instead)
- `tests/e2e/` - E2E test directory (referenced in Makefile but absent)
- `.claude/rules/` - Agent test rules
