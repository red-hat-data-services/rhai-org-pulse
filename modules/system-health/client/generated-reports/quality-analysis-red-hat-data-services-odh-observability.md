---
repository: "red-hat-data-services/odh-observability"
overall_score: 4.3
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "125 test functions across 8 files; 1.04:1 test-to-code ratio using Go stdlib testing with fakes"
  - dimension: "Integration/E2E"
    score: 2.0
    status: "Makefile e2e target defined but no tests/e2e directory or test files exist"
  - dimension: "Build Integration"
    score: 6.0
    status: "Konflux/Tekton PR pipeline builds images; Helm lint/template targets; no PR-time test execution"
  - dimension: "Image Testing"
    score: 6.0
    status: "Multi-stage UBI9 builds, multi-arch support, health checks; no runtime validation"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "Local --coverprofile in Makefile only; no CI integration, no thresholds, no PR reporting"
  - dimension: "CI/CD Automation"
    score: 4.0
    status: "Tekton pipelines for image builds on PR/push; no CI test execution or caching"
  - dimension: "Static Analysis"
    score: 4.0
    status: "go fmt/vet only; excellent FIPS compliance; no linter config, pre-commit, or dependency alerts"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No CI-integrated test execution"
    impact: "Unit tests exist locally but never run in CI — regressions can merge undetected"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No e2e/integration tests"
    impact: "Operator behavior against real clusters is untested; Makefile target exists with no tests behind it"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Coverage can silently regress; no visibility into test gaps on PRs"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No static analysis linter configuration"
    impact: "Only go fmt/vet run; common bugs and style issues not caught automatically"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add GitHub Actions workflow to run unit tests on PRs"
    effort: "2-4 hours"
    impact: "Prevents regressions from merging; validates all 125 existing tests in CI"
  - title: "Add .golangci.yaml with recommended linters"
    effort: "2-3 hours"
    impact: "Catches common Go bugs, style violations, and security issues automatically"
  - title: "Enable Dependabot for Go module dependency alerts"
    effort: "1 hour"
    impact: "Automated security vulnerability alerts and dependency update PRs"
  - title: "Add Codecov integration with coverage thresholds"
    effort: "2-3 hours"
    impact: "PR-level coverage reporting and regression prevention"
recommendations:
  priority_0:
    - "Add CI workflow (GitHub Actions or Tekton task) to run `go test ./...` on every PR"
    - "Integrate Codecov with coverage thresholds to prevent regression"
    - "Add .golangci.yaml with golangci-lint in CI"
  priority_1:
    - "Implement e2e tests using envtest for the reconciler against a simulated API server"
    - "Add Dependabot configuration for gomod ecosystem"
    - "Add pre-commit hooks for fmt, vet, and lint"
  priority_2:
    - "Create CLAUDE.md with test creation rules for AI-assisted development"
    - "Add Helm chart testing (helm unittest or ct lint-and-install)"
    - "Add webhook integration tests with envtest"
---

# Quality Analysis: odh-observability

## Executive Summary

- **Overall Score: 4.3/10**
- **Repository**: [red-hat-data-services/odh-observability](https://github.com/red-hat-data-services/odh-observability) (downstream, RHOAIENG / AI Core Platform)
- **Type**: Go Kubernetes Operator (observability/monitoring module for Open Data Hub)
- **Framework**: controller-runtime with Helm chart deployment
- **Key Strengths**: Excellent unit test coverage (125 tests, 1.04:1 ratio), strong FIPS compliance, multi-arch image builds via Konflux
- **Critical Gaps**: No CI test execution, no e2e tests, no coverage tracking, no static analysis tooling
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.0/10 | 15% | 1.20 | 125 test functions, 1.04:1 test-to-code ratio |
| Integration/E2E | 2.0/10 | 20% | 0.40 | Makefile target exists but no test files |
| Build Integration | 6.0/10 | 15% | 0.90 | Konflux pipeline builds images on PR; no test execution |
| Image Testing | 6.0/10 | 10% | 0.60 | Multi-stage UBI9, multi-arch; no runtime validation |
| Coverage Tracking | 2.0/10 | 10% | 0.20 | Local coverprofile only; no CI integration |
| CI/CD Automation | 4.0/10 | 15% | 0.60 | Tekton image builds; no test automation in CI |
| Static Analysis | 4.0/10 | 10% | 0.40 | go fmt/vet only; excellent FIPS; no linter/dependabot |
| Agent Rules | 0.0/10 | 5% | 0.00 | No agent rules present |
| **Overall** | **4.3/10** | **100%** | **4.30** | |

## Critical Gaps

### 1. No CI-Integrated Test Execution
- **Impact**: The repo has 125 unit tests (3,055 LOC) but no CI pipeline runs them. Tests only execute locally via `make test` or `make unit-test`. Regressions can merge undetected.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Root Cause**: Tekton pipelines (`.tekton/`) only build container images; no task for `go test`. No GitHub Actions workflows exist.

### 2. No E2E/Integration Tests
- **Impact**: The Makefile defines `e2e-test` targeting `./tests/e2e/` but this directory does not exist. The operator's reconciliation logic, webhook behavior, and Helm chart deployment are never tested against a real or simulated cluster.
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Root Cause**: The project is relatively new and e2e test infrastructure hasn't been built yet.

### 3. No Coverage Tracking or Enforcement
- **Impact**: `make test` generates `cover.out` locally, but there is no Codecov integration, no coverage thresholds, and no PR coverage reporting. Coverage can silently regress.
- **Severity**: HIGH
- **Effort**: 2-4 hours

### 4. No Static Analysis Linter Configuration
- **Impact**: Only `go fmt` and `go vet` are configured. No `.golangci.yaml` means common bugs, unused code, error handling issues, and security problems are not caught.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours

## Quick Wins

### 1. Add GitHub Actions Workflow for Unit Tests (2-4 hours)
Create `.github/workflows/tests.yml` to run `go test ./... -coverprofile cover.out` on every PR:

```yaml
name: Tests
on:
  pull_request:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version-file: go.mod
      - run: go test ./... -coverprofile cover.out -race
      - uses: codecov/codecov-action@v4
        with:
          files: cover.out
```

### 2. Add .golangci.yaml (2-3 hours)
```yaml
linters:
  enable:
    - errcheck
    - govet
    - staticcheck
    - unused
    - gosimple
    - ineffassign
    - typecheck
    - misspell
    - gocritic
    - revive
run:
  timeout: 5m
```

### 3. Enable Dependabot (1 hour)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: gomod
    directory: /
    schedule:
      interval: weekly
  - package-ecosystem: docker
    directory: /
    schedule:
      interval: weekly
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

### 4. Add Codecov Configuration (2-3 hours)
Create `.codecov.yml`:
```yaml
coverage:
  status:
    project:
      default:
        target: 60%
        threshold: 5%
    patch:
      default:
        target: 70%
```

## Detailed Findings

### Unit Tests

**Score: 8.0/10**

The repository has excellent unit test coverage for its size:

| Test File | Tests | LOC | Coverage Area |
|-----------|-------|-----|---------------|
| `internal/controller/templatedata_extended_test.go` | 41 | 750 | Template data building, preconditions, storage, traces, image URLs |
| `internal/controller/actions_test.go` | 18 | 489 | Controller actions (deploy monitoring stack, collectors, Perses) |
| `internal/controller/helpers_test.go` | 18 | 442 | CRD detection, ConfigMap/Secret helpers, Perses version detection |
| `internal/webhook/mutating_test.go` | 10 | 361 | Webhook admission handling, label injection |
| `internal/controller/monitoring_reconciler_test.go` | 8 | 311 | Reconciler lifecycle (Removed state, preconditions, status) |
| `internal/controller/conditions/conditions_test.go` | 8 | 259 | Condition management utilities |
| `api/v1alpha1/monitoring_types_test.go` | 9 | 236 | API type constants and validation |
| `internal/controller/templatedata_test.go` | 13 | 207 | Template data computation |
| **Total** | **125** | **3,055** | |

**Strengths**:
- Test-to-code ratio of 1.04:1 (3,055 test LOC vs 2,935 source LOC)
- Uses Go standard library `testing` package (simple, fast, no framework dependency)
- Good helper pattern: `newTestScheme()`, `newTestReconciler()`, `newMonitoring()`
- Uses `controller-runtime/client/fake` and `client-go/kubernetes/fake` for isolation
- Table-driven tests (`TestIsExpectedKind`, `TestGetEnvOrDefault`)
- Tests cover API types, controller logic, webhook handling, and conditions

**Gaps**:
- No `t.Parallel()` usage for faster test execution
- No benchmark tests
- No fuzzing tests

### Integration/E2E Tests

**Score: 2.0/10**

- **Makefile target**: `e2e-test` is defined but targets `./tests/e2e/` which does not exist
- **No integration test directory**: No `test/`, `tests/`, `e2e/`, or `integration/` directories
- **No envtest**: The reconciler tests use fake clients, not envtest (which would test against a real API server)
- **No cluster testing**: No Kind, Minikube, or real cluster test infrastructure
- **No multi-version testing**: No matrix strategies for different K8s/OCP versions

The only reason this scores 2 rather than 0 is the Makefile target definition showing intent.

### Build Integration

**Score: 6.0/10**

**Strengths**:
- Tekton/Konflux pipelines (`.tekton/odh-observability-pull-request.yaml`) build container images on every PR
- Uses centralized multi-arch build pipeline from `odh-konflux-central`
- Dedicated `Dockerfile.konflux` for production builds with pinned base images
- Makefile targets: `build`, `docker-build`, `manifests`, `generate`
- Helm chart with `helm-lint` and `helm-template` validation targets
- CRD generation via `controller-gen` with `helm-update-crds` target

**Gaps**:
- PR pipeline only builds the image; does not run `go test` or `go vet`
- No kustomize overlay validation in CI
- No dry-run deployment testing
- `helm-lint` is a Makefile target but not integrated into CI

### Image Testing

**Score: 6.0/10**

**Strengths**:
- Multi-stage Dockerfile (builder + runtime separation)
- UBI9 base images (FIPS-capable): `registry.access.redhat.com/ubi9/go-toolset` and `ubi9/ubi-minimal`
- Multi-architecture support via `BUILDPLATFORM`, `TARGETPLATFORM`, `TARGETOS`, `TARGETARCH`
- Tekton uses `multi-arch-container-build.yaml` pipeline
- Konflux Dockerfile uses pinned SHA digests for reproducibility
- Health endpoints (`/healthz`, `/readyz`) implemented in the manager
- Liveness and readiness probes in Helm chart deployment template
- Non-root user (UID 1001 / 1000)

**Gaps**:
- No runtime container validation (no testcontainers, no image startup tests)
- No `.dockerignore` file
- No image scanning in PR pipeline (handled by org-level tooling — out of scope)

### Coverage Tracking

**Score: 2.0/10**

- `make test` runs `go test ./... -coverprofile cover.out` locally
- No `.codecov.yml` or `codecov.yml` configuration
- No coverage threshold enforcement
- No PR coverage reporting (no Codecov/Coveralls action in CI)
- No coverage gate in any pipeline
- `make unit-test` runs tests without coverage (`go test ./...`)

### CI/CD Automation

**Score: 4.0/10**

**What exists**:
- Tekton PipelineRun for PR events (`.tekton/odh-observability-pull-request.yaml`)
  - Triggers on `event == "pull_request" && target_branch == "main"`
  - Builds container image via Konflux centralized pipeline
  - `max-keep-runs: 3`
- Tekton PipelineRun for push events (`.tekton/odh-observability-push.yaml`)
  - Triggers on `event == "push" && target_branch == "main"`
  - Builds and pushes `odh-stable` tag

**What's missing**:
- No GitHub Actions workflows at all
- No unit test execution in any CI pipeline
- No linting in CI
- No coverage reporting in CI
- No caching strategy
- No test parallelization
- No scheduled/periodic jobs
- No concurrency control beyond PipelinesAsCode defaults

### Static Analysis

**Score: 4.0/10**

#### Linting
- `go fmt` configured in Makefile (`make fmt`)
- `go vet` configured in Makefile (`make vet`)
- No `.golangci.yaml` or `.golangci.yml` — no advanced linters enabled
- No ESLint/ruff (not applicable — Go only)

#### FIPS Compatibility
**Excellent FIPS posture**:
- `GOEXPERIMENT=strictfipsruntime` set in both Dockerfiles
- `-tags strictfipsruntime` used in Konflux build
- `CGO_ENABLED=1` (required for FIPS)
- No FIPS-incompatible crypto imports (`crypto/md5`, `crypto/des`, `crypto/rc4`, `math/rand`) found
- UBI9 base images (FIPS-capable, Red Hat certified)

#### Dependency Alerts
- No `.github/dependabot.yml`
- No `renovate.json` or `.renovaterc`
- Dependencies are not automatically monitored for vulnerabilities

#### Pre-commit Hooks
- No `.pre-commit-config.yaml`
- No git hooks configured

### Agent Rules

**Score: 0.0/10**

- No `CLAUDE.md` in repository root
- No `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` test creation rules
- No `.claude/skills/` custom skills
- No testing documentation or guidelines

**Recommendation**: Use `/test-rules-generator` to create initial agent rules based on the existing test patterns (Go stdlib testing with controller-runtime fakes).

## Recommendations

### Priority 0 (Critical)

1. **Add CI workflow to run unit tests on PRs** — The 125 existing tests are worthless if they never run in CI. Add a GitHub Actions workflow or Tekton task that runs `go test ./... -race -coverprofile cover.out` on every PR.

2. **Integrate Codecov with coverage thresholds** — Add `.codecov.yml` with a project target of 60% and patch target of 70%. Wire up the Codecov action in the test workflow.

3. **Add golangci-lint configuration** — Create `.golangci.yaml` enabling errcheck, staticcheck, gosimple, unused, gocritic, revive, and misspell. Run in the CI workflow.

### Priority 1 (High Value)

4. **Implement e2e tests using envtest** — The reconciler, webhook, and Helm chart deployment should be tested against a simulated Kubernetes API server. Start with reconciler e2e tests using `envtest` from controller-runtime.

5. **Add Dependabot for Go module dependency alerts** — Create `.github/dependabot.yml` covering gomod, docker, and github-actions ecosystems.

6. **Add pre-commit hooks** — Configure `.pre-commit-config.yaml` with go-fmt, go-vet, and golangci-lint hooks to catch issues before commit.

### Priority 2 (Nice-to-Have)

7. **Create CLAUDE.md with test creation rules** — Document test patterns (Go stdlib testing, fake client usage, helper functions) so AI-assisted development produces consistent tests.

8. **Add Helm chart testing** — Use `helm unittest` or `ct lint-and-install` to validate the Helm chart renders correctly and can install.

9. **Add webhook integration tests** — Test the mutating webhook handler with envtest to validate admission behavior against a real API server.

## Comparison to Gold Standards

| Capability | odh-observability | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|-----------|-------------------|---------------------|-------------------|---------------|
| Unit test ratio | 1.04:1 | ~0.8:1 | N/A | ~0.6:1 |
| E2E tests | Stub only | Cypress + API | Multi-layer | Ginkgo suite |
| Coverage tracking | Local only | Codecov enforced | Codecov | Codecov enforced |
| CI test execution | None | GH Actions | GH Actions | GH Actions |
| Linting | go fmt/vet | ESLint + strict TS | shellcheck | golangci-lint |
| FIPS compliance | Excellent | N/A (frontend) | UBI + FIPS tags | UBI + FIPS |
| Dependency alerts | None | Dependabot | Dependabot | Dependabot |
| Agent rules | None | Comprehensive | Basic | None |
| Multi-arch builds | Yes (Konflux) | Yes | Yes | Yes |
| Pre-commit hooks | None | Husky | None | None |

## File Paths Reference

### Source Code
- `cmd/main.go` — Operator entrypoint with health checks
- `api/v1alpha1/monitoring_types.go` — CRD type definitions
- `internal/controller/monitoring_reconciler.go` — Main reconciler
- `internal/controller/actions.go` — Reconciler actions (deploy stacks, collectors)
- `internal/controller/templatedata.go` — Template data builder
- `internal/controller/helpers.go` — CRD detection, ConfigMap/Secret helpers
- `internal/controller/gvk/gvk.go` — GroupVersionKind constants
- `internal/webhook/mutating.go` — Mutating admission webhook

### Test Files
- `internal/controller/templatedata_extended_test.go` (41 tests, 750 LOC)
- `internal/controller/actions_test.go` (18 tests, 489 LOC)
- `internal/controller/helpers_test.go` (18 tests, 442 LOC)
- `internal/webhook/mutating_test.go` (10 tests, 361 LOC)
- `internal/controller/monitoring_reconciler_test.go` (8 tests, 311 LOC)
- `internal/controller/conditions/conditions_test.go` (8 tests, 259 LOC)
- `api/v1alpha1/monitoring_types_test.go` (9 tests, 236 LOC)
- `internal/controller/templatedata_test.go` (13 tests, 207 LOC)

### Build & Deployment
- `Dockerfile` — Development multi-stage build (UBI9, FIPS-enabled)
- `Dockerfiles/Dockerfile.konflux` — Production Konflux build (pinned digests)
- `Makefile` — Build, test, deploy targets
- `.tekton/odh-observability-pull-request.yaml` — PR build pipeline
- `.tekton/odh-observability-push.yaml` — Push build pipeline
- `charts/odh-observability/` — Helm chart
- `charts/odh-observability/Chart.yaml` — Chart metadata
- `charts/odh-observability/values.yaml` — Default values
- `charts/odh-observability/crds/` — Generated CRDs
