---
repository: "opendatahub-io/mcp-server-operator"
overall_score: 4.1
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Solid table-driven tests for all reconciler functions using fake clients and envtest"
  - dimension: "Integration/E2E"
    score: 6.0
    status: "E2E suite exists with Kind cluster tests but not wired to CI"
  - dimension: "Build Integration"
    score: 3.0
    status: "No PR-time image build, Konflux simulation, or manifest validation in CI"
  - dimension: "Image Testing"
    score: 2.0
    status: "Multi-stage Dockerfile present but no runtime validation, health checks, or UBI base image"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "Coverprofile generated locally but no upload, thresholds, or PR reporting"
  - dimension: "CI/CD Automation"
    score: 3.0
    status: "Only lint and test workflows; no caching, concurrency control, or E2E in CI"
  - dimension: "Static Analysis"
    score: 5.0
    status: "Good golangci-lint config with 20 linters; missing Dependabot, FIPS tags, pre-commit"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "E2E tests not running in CI"
    impact: "Operator reconciliation and route exposure are only validated manually; regressions can merge undetected"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No PR-time container image build"
    impact: "Dockerfile breakage and image issues discovered only post-merge in Konflux"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Non-UBI base images (distroless)"
    impact: "Not FIPS-capable; may block deployment in regulated OpenShift environments"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Test coverage can silently regress with no visibility on PRs"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No concurrency control or caching in CI"
    impact: "Duplicate workflow runs waste resources; slow builds from re-downloading Go modules every run"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add Go module caching and concurrency control to CI workflows"
    effort: "1-2 hours"
    impact: "Faster CI runs and no duplicate workflow executions on PRs"
  - title: "Enable Dependabot for Go module and Docker dependency alerts"
    effort: "1 hour"
    impact: "Automated dependency update PRs and security vulnerability alerts"
  - title: "Add codecov integration with coverage upload"
    effort: "2-3 hours"
    impact: "PR-level coverage visibility and regression detection"
  - title: "Add PR-time Docker image build step to test workflow"
    effort: "2-3 hours"
    impact: "Catch Dockerfile breakage before merge"
  - title: "Create basic CLAUDE.md with test patterns"
    effort: "1-2 hours"
    impact: "Enable AI agents to generate consistent, framework-specific tests"
recommendations:
  priority_0:
    - "Wire E2E tests into CI with a Kind cluster workflow to catch reconciliation regressions"
    - "Switch Dockerfile base images from distroless to UBI for FIPS compatibility"
    - "Add PR-time container image build to CI workflow"
  priority_1:
    - "Add codecov.yml with coverage thresholds and PR reporting"
    - "Enable Dependabot for gomod and docker ecosystems"
    - "Add concurrency control and Go module caching to workflows"
    - "Add container health/readiness probes to managed Deployment spec"
  priority_2:
    - "Create CLAUDE.md with test patterns and contribution guidelines"
    - "Add pre-commit hooks for formatting and linting"
    - "Add multi-version Kubernetes testing via matrix strategy"
    - "Add FIPS build tags for regulated environments"
---

# Quality Analysis: mcp-server-operator

## Executive Summary

- **Overall Score: 4.1/10**
- **Repository Type**: Kubernetes Operator (Kubebuilder / controller-runtime)
- **Language**: Go 1.23
- **Jira**: RHOAIENG / AI Core Platform (midstream tier)
- **Key Strengths**: Thorough unit tests with table-driven patterns, envtest integration, existing E2E framework
- **Critical Gaps**: E2E not in CI, no PR-time image build, non-UBI base images, no coverage tracking
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 7.0/10 | 15% | 1.05 | Solid table-driven tests for all reconciler functions |
| Integration/E2E | 6.0/10 | 20% | 1.20 | E2E suite exists but not wired to CI |
| Build Integration | 3.0/10 | 15% | 0.45 | No PR-time image build or manifest validation |
| Image Testing | 2.0/10 | 10% | 0.20 | Multi-stage Dockerfile but no runtime validation |
| Coverage Tracking | 2.0/10 | 10% | 0.20 | Coverprofile generated locally, never uploaded |
| CI/CD Automation | 3.0/10 | 15% | 0.45 | Minimal CI — lint + test only, no caching |
| Static Analysis | 5.0/10 | 10% | 0.50 | Good linter config, missing dependency alerts/FIPS |
| Agent Rules | 0.0/10 | 5% | 0.00 | No agent rules present |
| **Overall** | **4.1/10** | | **4.05** | |

## Critical Gaps

### 1. E2E Tests Not Running in CI
- **Impact**: Operator reconciliation, route exposure, and SSE endpoint validation are only tested manually. Regressions can merge undetected.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The `test/e2e/` suite exists and tests MCPServer CR reconciliation through to a working route, but `make test-e2e` is not called from any GitHub Actions workflow. Only `make test` (envtest-based unit tests) runs in CI.

### 2. No PR-Time Container Image Build
- **Impact**: Dockerfile breakage discovered only post-merge in Konflux builds. Build issues delay releases.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The `test.yml` workflow only runs `make test`. The Makefile has `docker-build` and `docker-buildx` targets but neither is called in any CI workflow.

### 3. Non-UBI Base Images
- **Impact**: The `gcr.io/distroless/static:nonroot` runtime image is not FIPS-capable. This may block deployment in regulated OpenShift environments requiring FIPS compliance.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Builder image uses `docker.io/golang:1.23` and runtime uses `gcr.io/distroless/static:nonroot`. Neither is UBI-based. No FIPS build tags (`-tags=fips`, `GOEXPERIMENT=boringcrypto`) are configured. No non-FIPS crypto imports were found in source code (positive).

### 4. No Coverage Tracking or Enforcement
- **Impact**: Test coverage can silently regress with no visibility on PRs or enforcement gates.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: `make test` generates `cover.out` via `--coverprofile` but the file is never uploaded to Codecov or any coverage service. No `.codecov.yml`, no coverage thresholds, no PR comments.

### 5. No CI Concurrency Control or Caching
- **Impact**: Duplicate workflow runs on push+PR events waste resources. Every run re-downloads all Go modules.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: Both workflows trigger on `push` AND `pull_request` without `concurrency:` groups, causing duplicate runs. No `actions/cache` for Go modules.

## Quick Wins

### 1. Add Go Module Caching and Concurrency Control (1-2 hours)
Add caching and concurrency to both workflows:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

steps:
  - uses: actions/setup-go@v5
    with:
      go-version-file: go.mod
      cache: true  # Built-in Go caching
```

### 2. Enable Dependabot (1 hour)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "gomod"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 3. Add Codecov Integration (2-3 hours)
Add to `test.yml` after the test step:
```yaml
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: cover.out
    fail_ci_if_error: true
```
Create `.codecov.yml`:
```yaml
coverage:
  status:
    project:
      default:
        target: 60%
    patch:
      default:
        target: 70%
```

### 4. Add PR-Time Docker Build (2-3 hours)
Add a build job to `test.yml`:
```yaml
  build:
    name: Build Image
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker image
        run: docker build -t mcp-server-operator:test .
```

### 5. Create Basic CLAUDE.md (1-2 hours)
Create `CLAUDE.md` with project conventions, test patterns (table-driven Go tests, Ginkgo BDD), and build commands. Use `/test-rules-generator` skill.

## Detailed Findings

### Unit Tests

**Score: 7.0/10**

**Strengths:**
- `mcpserver_test.go` (878 lines) contains comprehensive table-driven tests covering all reconciler helper functions:
  - `TestMCPServerReconciler_reconcileMCPServerDeployment` — 3 cases (create, exists, custom command/args)
  - `TestMCPServerReconciler_reconcileMCPServerService` — 2 cases (create, exists)
  - `TestMCPServerReconciler_reconcileMCPServerRoute` — 2 cases (create, exists)
  - `TestMCPServerReconciler_getDeploymentCondition` — 5 cases (not found, get failed, not ready, missing status, ready)
  - `TestMCPServerReconciler_getServiceCondition` — 3 cases (not found, get failed, exists)
  - `TestMCPServerReconciler_getRouteCondition` — 5 cases (not found, get failed, not admitted, missing ingress, admitted)
  - `TestMCPServerReconciler_getOverallCondition` — 7 cases (all ready, dep/svc/route not ready, nil conditions)
- Uses `controller-runtime/client/fake` for unit-level isolation
- Uses mock error client for error path testing
- `mcpserver_controller_test.go` provides envtest-based integration test for the full reconcile loop
- `suite_test.go` properly bootstraps envtest with CRD installation
- Test-to-source file ratio: 5 test files / 8 source files (63%)

**Gaps:**
- `mcpserver_controller_test.go` has only 1 basic test case — could test error paths, multiple reconcile cycles, update scenarios
- No tests for `mapResourceToMCPServer` function
- No API validation tests for `MCPServerSpec` (e.g., empty image rejection)
- No tests for the `SetupWithManager` label predicate logic
- Some TODO comments remain in scaffold tests

**Key Files:**
- `internal/controller/mcpserver_test.go` — Main unit test file
- `internal/controller/mcpserver_controller_test.go` — Envtest integration test
- `internal/controller/suite_test.go` — Test suite setup

### Integration/E2E Tests

**Score: 6.0/10**

**Strengths:**
- E2E test suite at `test/e2e/` with Ginkgo framework
- Tests the full operator lifecycle:
  1. Namespace creation with restricted PSA
  2. CRD installation
  3. Controller deployment
  4. MCPServer CR creation and reconciliation
  5. Route creation and SSE endpoint verification
- Good test infrastructure:
  - CertManager installation/detection
  - AfterEach debug info collection (logs, events, pod descriptions)
  - Proper cleanup in AfterAll
- `test/utils/utils.go` provides reusable helpers for Kind cluster operations

**Gaps:**
- **Not wired to CI** — `make test-e2e` exists but no CI workflow calls it
- No multi-version Kubernetes testing (single version only)
- No matrix strategy for OCP versions
- No negative E2E test cases (e.g., invalid CR, resource deletion)
- No scaling or stress tests
- Hardcoded image reference in `e2e_suite_test.go` (`quay.io/rh-ee-cmclaugh/mcp-server-operator:rhoaieng-24259`)

**Key Files:**
- `test/e2e/e2e_test.go` — E2E test scenarios
- `test/e2e/e2e_suite_test.go` — E2E suite setup
- `test/utils/utils.go` — Test utilities

### Build Integration

**Score: 3.0/10**

**Strengths:**
- Makefile has comprehensive build targets: `build`, `docker-build`, `docker-push`, `docker-buildx`, `build-installer`
- `build-installer` target generates consolidated YAML with kustomize
- Multi-arch build support via `docker-buildx` (linux/arm64, amd64, s390x, ppc64le)
- `install`/`uninstall` targets for CRD management
- `deploy`/`undeploy` targets for controller lifecycle

**Gaps:**
- No PR-time Docker image build in CI
- No Konflux simulation or pipeline validation
- No `kustomize build` validation in CI
- No CRD validation (kubectl apply --dry-run) in CI
- No operator bundle generation or validation
- `build-installer` not tested in CI
- No manifest generation tests

**Key Files:**
- `Makefile` — Build targets
- `Dockerfile` — Container image definition
- `config/default/kustomization.yaml` — Kustomize configuration

### Image Testing

**Score: 2.0/10**

**Strengths:**
- Multi-stage Dockerfile (builder + runtime)
- Minimal distroless base image for runtime (small attack surface)
- Non-root user (`USER 65532:65532`)
- `.dockerignore` present
- Go module layer caching in Dockerfile

**Gaps:**
- **Non-UBI base images**: `gcr.io/distroless/static:nonroot` is not UBI-based, not FIPS-capable
- No `HEALTHCHECK` instruction in Dockerfile
- No container runtime validation in CI or tests
- No Testcontainers usage
- No image startup testing
- No health/readiness/liveness probes in the managed Deployment spec (see `mcpserver.go:78-86`)
- Multi-arch build target exists in Makefile but not exercised in CI

**Key Files:**
- `Dockerfile` — Container definition
- `.dockerignore` — Build context exclusions

### Coverage Tracking

**Score: 2.0/10**

**Strengths:**
- `make test` generates `cover.out` via `--coverprofile`
- Coverage file captures all non-E2E package coverage

**Gaps:**
- No `.codecov.yml` or coverage service configuration
- No coverage upload in CI
- No coverage threshold enforcement
- No PR coverage reporting or comments
- No coverage gates (PRs can merge with 0% coverage changes)
- E2E tests excluded from coverage (`grep -v /e2e`)

**Key Files:**
- `Makefile:62` — `--coverprofile cover.out` flag

### CI/CD Automation

**Score: 3.0/10**

**Strengths:**
- Two workflows present: `lint.yml` and `test.yml`
- Both trigger on push and pull_request events
- Uses `actions/setup-go@v5` with `go-version-file: go.mod` (version pinned via go.mod)
- Uses `golangci/golangci-lint-action@v6` for linting
- `make test` runs envtest-based tests

**Gaps:**
- **No concurrency control** — both workflows trigger on push AND pull_request, causing duplicate runs
- **No Go module caching** — dependencies re-downloaded every run
- **No E2E workflow** — E2E tests not executed in CI
- **No image build/push workflow** — no CI-driven image pipeline
- **No release workflow** — no tag-based releases or changelogs
- **No timeout-minutes** configured
- **No matrix strategy** — single OS/Go version only
- **No periodic/scheduled workflows** — no nightly or weekly validation
- **No test parallelization** — tests run sequentially

**Key Files:**
- `.github/workflows/test.yml` — Test workflow
- `.github/workflows/lint.yml` — Lint workflow

### Static Analysis

**Score: 5.0/10**

#### Linting
- `.golangci.yml` configured with `disable-all: true` and 20 explicitly enabled linters:
  - `dupl`, `errcheck`, `copyloopvar`, `ginkgolinter`, `goconst`, `gocyclo`, `gofmt`, `goimports`, `gosimple`, `govet`, `ineffassign`, `lll`, `misspell`, `nakedret`, `prealloc`, `revive`, `staticcheck`, `typecheck`, `unconvert`, `unparam`, `unused`
- Ginkgo-specific linter enabled (good for BDD test patterns)
- Lint runs in CI via `golangci/golangci-lint-action@v6`
- 5-minute timeout configured for lint runs
- Path-based exclusions for API and internal packages

#### FIPS Compatibility
- **No non-FIPS crypto imports found** in source (positive)
- **No FIPS build tags** (`-tags=fips`, `GOEXPERIMENT=boringcrypto`) configured
- **Base images not UBI-based**: Builder uses `golang:1.23`, runtime uses `distroless/static:nonroot`
- No `CGO_ENABLED=1` (CGO is explicitly disabled: `CGO_ENABLED=0`)

#### Dependency Alerts
- **No Dependabot** configuration (`.github/dependabot.yml` absent)
- **No Renovate** configuration
- Dependencies are not automatically monitored for vulnerabilities

**Key Files:**
- `.golangci.yml` — Linter configuration
- `Dockerfile` — Base image selection
- `Makefile` — Build flags

### Agent Rules

**Score: 0.0/10**

- No `CLAUDE.md` in repository root
- No `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` with test creation rules
- No `.claude/skills/` with custom skills
- No testing documentation or contribution guidelines

**Recommendation**: Use `/test-rules-generator` skill to generate framework-specific rules covering:
- Go table-driven test patterns
- Ginkgo/Gomega BDD patterns
- Envtest setup for controller tests
- Fake client patterns for unit tests

## Recommendations

### Priority 0 (Critical)

1. **Wire E2E tests into CI with Kind cluster**
   - Create `.github/workflows/e2e.yml` that spins up a Kind cluster and runs `make test-e2e`
   - Consider triggering on PR and push to main
   - Example workflow structure:
   ```yaml
   jobs:
     e2e:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-go@v5
           with:
             go-version-file: go.mod
             cache: true
         - name: Create Kind cluster
           uses: helm/kind-action@v1
         - name: Build and load image
           run: |
             make docker-build IMG=mcp-server-operator:test
             kind load docker-image mcp-server-operator:test
         - name: Run E2E tests
           run: make test-e2e
   ```

2. **Switch to UBI base images for FIPS compatibility**
   - Replace `docker.io/golang:1.23` with `registry.access.redhat.com/ubi9/go-toolset:1.23`
   - Replace `gcr.io/distroless/static:nonroot` with `registry.access.redhat.com/ubi9-micro:latest`
   - Add FIPS build tags when building for regulated environments

3. **Add PR-time container image build**
   - Add a `docker build` step to the test workflow
   - Validates Dockerfile correctness before merge

### Priority 1 (High Value)

4. **Add Codecov integration** — Upload `cover.out`, set thresholds (60% project, 70% patch), enable PR comments
5. **Enable Dependabot** — Cover `gomod`, `docker`, and `github-actions` ecosystems
6. **Add CI caching and concurrency** — Use `actions/setup-go` caching, add `concurrency:` groups to prevent duplicate runs
7. **Add health/readiness probes** — Add readiness and liveness probes to the managed Deployment container spec in `mcpserver.go`

### Priority 2 (Nice-to-Have)

8. **Create CLAUDE.md** — Document test patterns, build commands, contribution guidelines for AI-assisted development
9. **Add pre-commit hooks** — Format/lint checks before commits via `.pre-commit-config.yaml`
10. **Multi-version testing** — Add matrix strategy for multiple Kubernetes versions in CI
11. **Add FIPS build configuration** — Build tags and BoringCrypto support for regulated environments
12. **Expand E2E test coverage** — Add negative cases (invalid CR, resource deletion, update scenarios)

## Comparison to Gold Standards

| Capability | mcp-server-operator | odh-dashboard | notebooks | kserve |
|-----------|:-------------------:|:-------------:|:---------:|:------:|
| Unit Tests | Table-driven, envtest | Multi-layer, mocks | Parameterized | Comprehensive |
| E2E/Integration | Exists, not in CI | Automated in CI | Multi-version | Multi-version |
| Build Integration | Manual only | PR-time builds | Image pipeline | Bundle validation |
| Image Testing | No validation | Runtime tests | 5-layer validation | Startup tests |
| Coverage Tracking | Local only | Codecov enforced | Coverage gates | Enforced thresholds |
| CI/CD Automation | 2 basic workflows | Full pipeline | Multi-arch CI | Matrix testing |
| Static Analysis | 20 linters | Comprehensive | FIPS checks | Full suite |
| Agent Rules | None | CLAUDE.md + rules | Basic | Basic |

## File Paths Reference

### CI/CD
- `.github/workflows/lint.yml` — Lint workflow
- `.github/workflows/test.yml` — Test workflow
- `Makefile` — Build and test targets

### Testing
- `internal/controller/mcpserver_test.go` — Unit tests (878 lines, table-driven)
- `internal/controller/mcpserver_controller_test.go` — Envtest integration test
- `internal/controller/suite_test.go` — Test suite setup with envtest
- `test/e2e/e2e_test.go` — E2E test scenarios
- `test/e2e/e2e_suite_test.go` — E2E suite setup
- `test/utils/utils.go` — Shared test utilities

### Source Code
- `cmd/main.go` — Entry point
- `api/v1/mcpserver_types.go` — CRD type definitions
- `internal/controller/mcpserver_controller.go` — Reconciler
- `internal/controller/mcpserver.go` — Resource reconciliation helpers
- `pkg/cluster/gvk/gvk.go` — GVK utilities

### Container
- `Dockerfile` — Multi-stage container build
- `.dockerignore` — Build context exclusions

### Static Analysis
- `.golangci.yml` — Linter configuration (20 linters)

### Kubernetes Config
- `config/crd/bases/mcpserver.opendatahub.io_mcpservers.yaml` — CRD definition
- `config/default/kustomization.yaml` — Default kustomize overlay
- `config/manager/manager.yaml` — Controller manager deployment
- `config/rbac/` — RBAC configuration
