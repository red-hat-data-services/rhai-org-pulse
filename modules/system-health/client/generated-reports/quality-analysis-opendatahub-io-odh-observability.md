---
repository: "opendatahub-io/odh-observability"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "Excellent unit tests with table-driven patterns and comprehensive edge case coverage"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Comprehensive E2E suite with 10+ test groups covering full operator lifecycle"
  - dimension: "Build Integration"
    score: 7.0
    status: "Tekton/Konflux pipelines for PR and push builds; no PR-time manifest validation"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage UBI9 builds with FIPS; multi-arch support; no runtime validation"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "Makefile generates coverprofile but no Codecov integration or threshold enforcement"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "Tekton/Konflux only — no GitHub Actions for PR linting, testing, or coverage"
  - dimension: "Static Analysis"
    score: 6.0
    status: "go fmt/vet in Makefile; excellent FIPS config; no golangci-lint, no Dependabot"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No CI-driven test execution on PRs"
    impact: "Unit tests and linting rely on developer discipline — regressions can merge undetected"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No coverage tracking or enforcement"
    impact: "No visibility into test coverage trends; no gates preventing coverage regression"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No golangci-lint configuration"
    impact: "Only go vet/fmt run; advanced static analysis bugs not caught"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No dependency management automation"
    impact: "Security vulnerabilities in dependencies not detected automatically"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No agent rules for test automation"
    impact: "AI agents lack guidance on testing patterns, conventions, and quality gates"
    severity: "LOW"
    effort: "3-4 hours"
quick_wins:
  - title: "Add GitHub Actions workflow for PR testing and linting"
    effort: "4-6 hours"
    impact: "Automated test and lint enforcement on every PR"
  - title: "Add Codecov integration with coverage thresholds"
    effort: "2-3 hours"
    impact: "Track coverage trends and prevent regression"
  - title: "Add golangci-lint configuration"
    effort: "2-3 hours"
    impact: "Catch bugs that go vet misses — errcheck, staticcheck, revive, gocritic"
  - title: "Enable Dependabot for Go modules and Docker images"
    effort: "1-2 hours"
    impact: "Automated security and dependency update PRs"
  - title: "Create basic CLAUDE.md and agent rules"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality and consistency"
recommendations:
  priority_0:
    - "Add GitHub Actions CI workflow for unit tests, linting, and coverage on PRs"
    - "Integrate Codecov with coverage thresholds (80% project, 70% patch)"
    - "Add golangci-lint with comprehensive linter set"
  priority_1:
    - "Enable Dependabot for gomod, docker, and github-actions ecosystems"
    - "Add PR-time Helm chart and Kustomize validation (helm lint, kubectl --dry-run)"
    - "Create comprehensive agent rules for test automation (.claude/rules/)"
    - "Add pre-commit hooks for linting enforcement"
  priority_2:
    - "Add container runtime validation tests (startup, health checks)"
    - "Add performance regression testing for reconciliation loops"
    - "Implement chaos engineering tests for operator resilience"
---

# Quality Analysis: opendatahub-io/odh-observability

## Executive Summary
- **Overall Score: 7.6/10**
- **Repository Type**: Go Kubernetes Operator (controller-runtime)
- **Primary Language**: Go 1.25
- **Jira Component**: AI Core Platform (RHOAIENG)
- **Tier**: Midstream
- **Key Strengths**: Exceptional unit test quality with table-driven patterns, comprehensive E2E test suite covering full operator lifecycle, excellent FIPS compliance (strictfipsruntime + UBI9 base images), clean architecture
- **Critical Gaps**: No GitHub Actions CI for PR testing/linting, no coverage tracking or enforcement, no golangci-lint, no dependency alerting, no agent rules
- **Agent Rules Status**: Missing

## Quality Scorecard
| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 9/10 | 15% | Excellent unit tests with table-driven patterns and comprehensive edge case coverage |
| Integration/E2E | 9/10 | 20% | Comprehensive E2E suite with 10+ test groups covering full operator lifecycle |
| Build Integration | 7/10 | 15% | Tekton/Konflux pipelines for PR and push builds; no PR-time manifest validation |
| Image Testing | 7/10 | 10% | Multi-stage UBI9 builds with FIPS; multi-arch support; no runtime validation |
| Coverage Tracking | 4/10 | 10% | Makefile generates coverprofile but no Codecov integration or threshold enforcement |
| CI/CD Automation | 5/10 | 15% | Tekton/Konflux only — no GitHub Actions for PR linting, testing, or coverage |
| Static Analysis | 6/10 | 10% | go fmt/vet in Makefile; excellent FIPS config; no golangci-lint, no Dependabot |
| Agent Rules | 0/10 | 5% | No CLAUDE.md, AGENTS.md, or .claude/ directory |

## Critical Gaps

1. **No CI-driven test execution on PRs**
   - Impact: Unit tests and linting rely on developer discipline — regressions can merge undetected
   - Severity: HIGH
   - Effort: 4-8 hours
   - Detail: The repository uses Tekton/Konflux pipelines for image building only. There are no GitHub Actions workflows to run `make test`, linting, or any code quality checks on pull requests. The Tekton PR pipeline only builds the container image.

2. **No coverage tracking or enforcement**
   - Impact: No visibility into test coverage trends; no gates preventing coverage regression
   - Severity: HIGH
   - Effort: 2-4 hours
   - Detail: The Makefile includes `--coverprofile cover.out` in `make test` but no `.codecov.yml`, no coverage upload step, and no threshold enforcement. Coverage data is generated locally but never tracked or reported.

3. **No golangci-lint configuration**
   - Impact: Only `go vet` and `go fmt` run; advanced static analysis bugs not caught
   - Severity: MEDIUM
   - Effort: 2-3 hours
   - Detail: No `.golangci.yaml` or `.golangci.yml` file. Missing linters like errcheck, staticcheck, revive, gocritic, nilaway, and gosec (non-security scanning scope).

4. **No dependency management automation**
   - Impact: Security vulnerabilities in dependencies not detected automatically
   - Severity: MEDIUM
   - Effort: 1-2 hours
   - Detail: No `.github/dependabot.yml` or `renovate.json`. Manual dependency updates only. The `go.mod` shows many transitive dependencies that could have vulnerabilities.

5. **No agent rules for test automation**
   - Impact: AI agents lack guidance on testing patterns, conventions, and quality gates
   - Severity: LOW
   - Effort: 3-4 hours
   - Detail: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory. When AI agents generate tests, they lack context on preferred patterns (table-driven tests, fake client usage, conditions manager).

## Quick Wins

1. **Add GitHub Actions workflow for PR testing and linting**
   - Effort: 4-6 hours
   - Impact: Automated test and lint enforcement on every PR
   - Implementation:
   ```yaml
   # .github/workflows/pr.yml
   name: PR Checks
   on:
     pull_request:
       branches: [main]
   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: true
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-go@v5
           with:
             go-version-file: go.mod
         - run: make test
         - uses: codecov/codecov-action@v4
           with:
             files: cover.out
             fail_ci_if_error: true
     lint:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-go@v5
           with:
             go-version-file: go.mod
         - uses: golangci/golangci-lint-action@v6
   ```

2. **Add Codecov integration with coverage thresholds**
   - Effort: 2-3 hours
   - Impact: Track coverage trends and prevent regression
   - Implementation:
   ```yaml
   # .codecov.yml
   coverage:
     status:
       project:
         default:
           target: 80%
           threshold: 2%
       patch:
         default:
           target: 70%
   ```

3. **Add golangci-lint configuration**
   - Effort: 2-3 hours
   - Impact: Catch bugs that go vet misses — errcheck, staticcheck, revive, gocritic
   - Implementation:
   ```yaml
   # .golangci.yml
   linters:
     enable:
       - errcheck
       - govet
       - staticcheck
       - unused
       - ineffassign
       - revive
       - gocritic
       - misspell
       - gofmt
       - goimports
       - prealloc
   run:
     timeout: 5m
   ```

4. **Enable Dependabot for Go modules and Docker images**
   - Effort: 1-2 hours
   - Impact: Automated security and dependency update PRs
   - Implementation:
   ```yaml
   # .github/dependabot.yml
   version: 2
   updates:
     - package-ecosystem: "gomod"
       directory: "/"
       schedule:
         interval: "weekly"
       open-pull-requests-limit: 10
     - package-ecosystem: "docker"
       directory: "/"
       schedule:
         interval: "weekly"
     - package-ecosystem: "github-actions"
       directory: "/"
       schedule:
         interval: "monthly"
   ```

5. **Create basic CLAUDE.md and agent rules**
   - Effort: 2-3 hours
   - Impact: Improve AI-generated test quality and consistency
   - Implementation: Create `CLAUDE.md` and `.claude/rules/unit-tests.md` with Go testing patterns specific to this operator.

## Detailed Findings

### Unit Tests

**Status: Excellent (9/10)**

The repository demonstrates exemplary unit testing practices:

**File Metrics:**
- Total Go source files: 13 (excluding tests)
- Total test files: 16
- Test-to-code ratio: 123% (Outstanding)

**Strengths:**
- **Table-driven tests**: Extensively used across all packages (`TestIsLocalServiceEndpoint`, `TestDetermineTLSEnabled`, `TestGetResourceValueOrDefault`, `TestIsExpectedKind`)
- **Test helpers**: Clean `newTestScheme()`, `newTestReconciler()`, `newMonitoring()` helpers with `t.Helper()` annotation
- **Fake client usage**: Proper use of `sigs.k8s.io/controller-runtime/pkg/client/fake` for controller testing
- **Edge case coverage**: Tests for nil inputs, empty data, missing resources, boundary conditions
- **Security validation tests**: Comprehensive exporter validation tests (`TestValidateExporters_InsecureExternalEndpoint`, `TestValidateExporters_OversizedConfig`, `TestValidateExporters_ExcessiveNesting`)
- **API type tests**: DeepCopy, status manipulation, constant validation
- **Webhook tests**: Full admission webhook coverage including nil decoder/client, unexpected kind, namespace labeling, lifecycle

**Test categories covered:**
- Controller reconciliation (Removed, PreconditionsFailed, NothingConfigured, ReleasesPopulated, ObservedGenerationSet)
- Helper functions (hasCRD, syncPrometheusWebTLSCA, syncStatusURL)
- Template data building (storage, replicas, traces, resource defaults, image URLs, Perses)
- Action functions (MonitoringStack, TracingStack, OTelCollector, Alerting, Perses, NodeMetrics, WebhookInfrastructure)
- Exporter validation (reserved names, schema, security, types)
- Webhook injection (ServiceMonitor, PodMonitor, label preservation, lifecycle)

**Gaps:**
- No `t.Parallel()` usage — tests could run faster with parallelization
- No explicit coverage target enforcement

### Integration/E2E Tests

**Status: Excellent (9/10)**

The `tests/e2e/` directory contains a comprehensive E2E test suite with 10 organized test groups:

**Test Groups:**
1. **Base Configuration** — Default CR content validation
2. **Metrics & MonitoringStack** — Stack creation, configuration, replicas, PrometheusRules lifecycle, TLS, reconciliation stability
3. **OpenTelemetry Collector** — Configurations (traces, exporters), replicas, TLS
4. **Target Allocator** — Deployment, Service/ConfigMap, lifecycle, RBAC
5. **Thanos Querier** — Deployment, NetworkPolicy, lifecycle
6. **Traces with PV Backend** — TempoMonolithic CR creation
7. **Traces with Cloud Storage** — S3/GCS TempoStack, Perses TLS, Instrumentation lifecycle, reserved name validation
8. **Perses** — CR creation, configuration, lifecycle, NetworkPolicy, datasources
9. **Networking and RBAC** — Prometheus restricted resources, secure proxy authentication, node metrics endpoint, RBAC
10. **Webhook** — Admission webhook injection tests
11. **Negative Conditions** — Negative condition tests
12. **Disabled** — Monitoring service disabled/cleanup

**Strengths:**
- Uses Gomega matchers with custom `jq.Match()` for precise JSON assertions on unstructured objects
- Test context pattern (`TestContext`, `MonitoringTestCtx`) for clean state management
- Proper cleanup with `t.Cleanup()` in every group
- Tests cover both positive and negative paths (resource creation AND deletion)
- Lifecycle tests verify create → delete → recreate flows
- Reconciliation stability test detects reconciliation loops via resourceVersion monitoring
- Multi-backend testing (PV, S3, GCS for traces storage)
- SNO-aware replica detection

**Gaps:**
- E2E tests require a live cluster (no envtest)
- No multi-version K8s/OCP matrix testing visible in CI configuration

### Build Integration

**Status: Good (7/10)**

**Strengths:**
- **Tekton/Konflux integration**: Both PR and push pipelines configured in `.tekton/`
  - `odh-observability-pull-request.yaml`: Triggered on PRs to main, builds with `odh-pr` tag
  - `odh-observability-push.yaml`: Triggered on push to main, builds with `odh-stable` tag
- **Centralized pipeline**: Uses `opendatahub-io/odh-konflux-central` multi-arch container build pipeline
- **Pipelinesascode annotations**: Max 3 runs kept, cancel-in-progress false
- **Multi-arch**: Refers to `multi-arch-container-build.yaml` pipeline
- **Helm chart**: `charts/odh-observability/` with `helm-lint` and `helm-template` Makefile targets
- **Makefile targets**: `build`, `docker-build`, `manifests`, `generate`, `deploy`, `helm-update-crds`

**Gaps:**
- No PR-time Helm chart validation in CI (only local `make helm-lint`)
- No Kustomize dry-run validation
- No CRD installation validation in CI
- Tekton pipelines only build images — they don't run tests or linting

### Image Testing

**Status: Good (7/10)**

**Strengths:**
- **Multi-stage builds**: Both `Dockerfile` and `Dockerfile.konflux` use builder → runtime pattern
- **UBI9 base images**: `registry.access.redhat.com/ubi9/go-toolset` (builder) and `ubi9/ubi-minimal` (runtime) — FIPS-capable
- **FIPS compliance**: `GOEXPERIMENT=strictfipsruntime` and `-tags strictfipsruntime` in Konflux build
- **CGO_ENABLED=1**: Required for FIPS compliance with BoringCrypto
- **Non-root user**: Both Dockerfiles run as non-root (1001 / 1000)
- **Build optimization**: `-trimpath -ldflags="-s -w"` for smaller binaries
- **Multi-arch**: Platform build args (`BUILDPLATFORM`, `TARGETPLATFORM`, `TARGETARCH`)
- **Konflux image pinning**: SHA256-pinned base images in `Dockerfile.konflux`
- **Red Hat labels**: Proper LABEL annotations in Konflux Dockerfile

**Gaps:**
- No HEALTHCHECK instruction in Dockerfiles
- No runtime validation tests (Testcontainers or equivalent)
- No `.dockerignore` file (could improve build context size)
- No image startup validation in CI

### Coverage Tracking

**Status: Weak (4/10)**

**Current State:**
- `make test` generates `cover.out` via `--coverprofile`
- No `.codecov.yml` or coverage service integration
- No coverage threshold enforcement
- No PR coverage reporting
- No coverage badge in README

**Impact:**
- No visibility into coverage trends over time
- No gates to prevent coverage regression on PRs
- Coverage data generated but not tracked or acted upon

### CI/CD Automation

**Status: Below Average (5/10)**

**Current State:**
- **Tekton/Konflux only**: `.tekton/odh-observability-pull-request.yaml` and `.tekton/odh-observability-push.yaml`
- **No GitHub Actions**: No `.github/workflows/` directory at all
- **Tekton scope**: Only builds container images — no test execution, linting, or coverage

**Strengths:**
- Tekton pipelines are well-structured with proper annotations
- Max-keep-runs and cancel-in-progress configured
- Multi-arch build pipeline from centralized config

**Gaps:**
- No PR-triggered test execution
- No linting enforcement on PRs
- No coverage reporting on PRs
- No concurrency control for test runs
- No caching strategies for Go modules in CI
- No timeout configuration visible

**Recommendations:**
- Add GitHub Actions workflow for tests, linting, and coverage (complements Tekton builds)
- Tekton handles image builds well — GitHub Actions should handle code quality checks

### Static Analysis

**Status: Adequate (6/10)**

#### Linting

**Current State:**
- `make fmt` runs `go fmt ./...`
- `make vet` runs `go vet ./...`
- No `.golangci.yaml` or `.golangci.yml`
- No `.pre-commit-config.yaml`

**Impact:**
- Only basic formatting and vet checks — misses errcheck, staticcheck, revive, gocritic
- No pre-commit enforcement

#### FIPS Compatibility

**Status: Excellent (No Issues Found)**

**Source Code:**
- No `crypto/md5`, `crypto/des`, `crypto/rc4`, or `math/rand` imports found
- Clean crypto usage throughout

**Build Configuration:**
- `Dockerfile`: `GOEXPERIMENT=strictfipsruntime`, `CGO_ENABLED=1`
- `Dockerfile.konflux`: `GOEXPERIMENT=strictfipsruntime`, `CGO_ENABLED=1`, `-tags strictfipsruntime`
- Both Dockerfiles use UBI9 base images (FIPS-capable)

**Base Images:**
- Builder: `registry.access.redhat.com/ubi9/go-toolset` (FIPS-certified)
- Runtime: `registry.access.redhat.com/ubi9/ubi-minimal` (FIPS-certified)
- Konflux: SHA256-pinned UBI9 images

This is one of the best FIPS configurations seen across analyzed repositories.

#### Dependency Alerts

**Status: Not Configured**

- No `.github/dependabot.yml`
- No `renovate.json` or `.renovaterc`
- Manual dependency updates only

### Agent Rules

**Status: Missing (0/10)**

**Current State:**
- No `CLAUDE.md` or `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` for test creation guidance
- No custom skills defined

**Impact:**
AI agents asked to generate tests for this codebase lack context on:
- Table-driven test patterns used consistently across the repo
- Fake client setup patterns (`newTestScheme()`, `newTestReconciler()`)
- Conditions manager testing patterns
- GVK registration patterns for unstructured types
- Helper function conventions (`t.Helper()`, `objKey()`, `registerCRDs()`)
- E2E test framework patterns (jq matchers, TestContext, MonitoringTestCtx)

**Recommendations:**
1. Create `.claude/rules/unit-tests.md` with Go unit testing patterns:
   ```markdown
   # Unit Test Rules for odh-observability

   ## Framework
   - Use Go's built-in `testing` package
   - Use `sigs.k8s.io/controller-runtime/pkg/client/fake` for K8s client mocking
   - Use `stretchr/testify` for assertions where already imported

   ## Patterns
   - Use table-driven tests for multiple scenarios
   - Use `t.Helper()` in all helper functions
   - Create shared test helpers (newTestScheme, newTestReconciler, newMonitoring)
   - Register unstructured CRD types with registerCRDs() helper
   - Use `t.Setenv()` for environment variable overrides (auto-cleanup)
   - Test both positive and negative paths

   ## Controller Testing
   - Test reconcile() directly, not Reconcile() (avoids status patch complexity)
   - Verify condition types and statuses after reconciliation
   - Test Removed management state, precondition failures, and happy path
   ```

2. Create `CLAUDE.md` with project-level guidance.

3. Quick win: Generate rules with `/test-rules-generator`

## Recommendations

### Priority 0 (Critical)
- Add GitHub Actions CI workflow running `make test`, golangci-lint, and coverage upload on every PR
- Integrate Codecov with coverage thresholds (80% project, 70% patch)
- Add golangci-lint configuration with comprehensive linter set (errcheck, staticcheck, revive, gocritic, misspell, goimports)

### Priority 1 (High Value)
- Enable Dependabot for gomod, docker, and github-actions ecosystems
- Add PR-time Helm chart validation (`helm lint`, `helm template`, `kubectl apply --dry-run`)
- Create comprehensive agent rules for test automation (`.claude/rules/`)
- Add pre-commit hooks for local linting enforcement
- Add container runtime validation tests (image startup, health endpoint)

### Priority 2 (Nice-to-Have)
- Add performance regression testing for reconciliation loop timing
- Implement chaos engineering tests for operator resilience
- Add `.dockerignore` for build context optimization
- Add HEALTHCHECK instruction to Dockerfiles
- Enable `t.Parallel()` in unit tests for faster execution

## Comparison to Gold Standards

| Dimension | odh-observability | odh-dashboard | notebooks | kserve | Gap |
|-----------|------------------|---------------|-----------|--------|-----|
| Unit Tests | 9/10 | 9/10 | 8/10 | 8/10 | 0 (At gold standard) |
| Integration/E2E | 9/10 | 10/10 | 7/10 | 9/10 | -1 (Add envtest, multi-version matrix) |
| Build Integration | 7/10 | 9/10 | 8/10 | 4/10 | -2 (Add PR-time manifest validation) |
| Image Testing | 7/10 | 7/10 | 10/10 | 6/10 | -3 (Add runtime validation) |
| Coverage Tracking | 4/10 | 9/10 | 8/10 | 8/10 | -5 (Add Codecov integration) |
| CI/CD Automation | 5/10 | 9/10 | 8/10 | 9/10 | -4 (Add GitHub Actions for quality) |
| Static Analysis | 6/10 | 9/10 | 8/10 | 7/10 | -3 (Add golangci-lint, Dependabot) |
| Agent Rules | 0/10 | 8/10 | 6/10 | 2/10 | -8 (Create comprehensive rules) |

**Key Takeaways:**
- **Biggest strength**: Unit test quality (9/10) is at gold standard level — table-driven tests, comprehensive edge cases, clean helpers
- **Biggest gap**: CI/CD automation and coverage tracking — the code quality is high but not enforced in CI
- **FIPS standout**: Best FIPS configuration seen (strictfipsruntime + pinned UBI9) — exceeds gold standards
- **Quick win potential**: Adding GitHub Actions + Codecov would raise the score from 7.6 to ~8.5

## File Paths Reference

### CI/CD
- `.tekton/odh-observability-pull-request.yaml` — Tekton PR pipeline
- `.tekton/odh-observability-push.yaml` — Tekton push pipeline
- `Makefile` — Build targets (test, build, docker-build, helm-lint)

### Testing
- `internal/controller/monitoring_reconciler_test.go` — Controller reconciliation tests
- `internal/controller/helpers_test.go` — Helper function tests (hasCRD, syncPrometheusWebTLSCA, syncStatusURL)
- `internal/controller/actions_test.go` — Action function tests (deploy*, conditions)
- `internal/controller/templatedata_test.go` — Template data validation tests
- `internal/controller/templatedata_extended_test.go` — Extended template/precondition tests
- `internal/webhook/mutating_test.go` — Webhook admission tests
- `api/v1alpha1/monitoring_types_test.go` — API type tests
- `tests/e2e/monitoring_test.go` — Comprehensive E2E test suite
- `tests/e2e/e2e_test.go` — E2E test entry point
- `tests/e2e/config_test.go` — E2E test configuration
- `tests/e2e/helper_test.go` — E2E test helpers
- `tests/e2e/test_context_test.go` — E2E test context
- `tests/e2e/resource_options_test.go` — E2E resource option helpers
- `tests/e2e/monitoring_webhook_test.go` — E2E webhook tests
- `tests/e2e/monitoring_negative_test.go` — E2E negative condition tests

### Container Images
- `Dockerfile` — Main operator image (UBI9 + FIPS)
- `Dockerfiles/Dockerfile.konflux` — Konflux build image (pinned UBI9 + strictfipsruntime)

### Source Code
- `cmd/main.go` — Operator entrypoint
- `internal/controller/monitoring_reconciler.go` — Main reconciler
- `internal/controller/actions.go` — Action functions (deploy*)
- `internal/controller/helpers.go` — Helper functions
- `internal/controller/templatedata.go` — Template data builder
- `internal/webhook/mutating.go` — Mutating admission webhook
- `api/v1alpha1/monitoring_types.go` — API types

### Deployment
- `charts/odh-observability/` — Helm chart
- `charts/odh-observability/Chart.yaml` — Chart metadata

### Missing (Needs Creation)
- `.github/workflows/*.yml` — GitHub Actions CI workflows
- `.codecov.yml` — Coverage configuration
- `.golangci.yml` — Linting configuration
- `.github/dependabot.yml` — Dependency management
- `.pre-commit-config.yaml` — Pre-commit hooks
- `CLAUDE.md` — Agent rules
- `.claude/rules/unit-tests.md` — Unit test patterns
