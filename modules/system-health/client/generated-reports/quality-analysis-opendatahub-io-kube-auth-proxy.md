---
repository: "opendatahub-io/kube-auth-proxy"
overall_score: 6.1
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Excellent test-to-code ratio (0.96) with 238 test functions and 228 Ginkgo specs across Go testing + Ginkgo/Gomega frameworks"
  - dimension: "Integration/E2E"
    score: 5.0
    status: "Integration test suite with mock OIDC/OpenShift OAuth providers; no full E2E with cluster deployment or multi-version testing"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR Docker builds with Tekton/Konflux pipelines (PR, push, release); FIPS build via Dockerfile.redhat"
  - dimension: "Image Testing"
    score: 5.0
    status: "Multi-stage builds with FIPS check-payload scanning; no runtime validation or health checks"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "Code Climate integration with coverprofile generation; no threshold enforcement or coverage gates"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "7 GitHub workflows plus Tekton pipelines; missing concurrency control, caching, and timeouts"
  - dimension: "Static Analysis"
    score: 8.0
    status: "golangci-lint v2 with 16 linters, pre-commit hooks, FIPS compliance CI, and Renovate for dependencies"
  - dimension: "Agent Rules"
    score: 4.0
    status: "AGENTS.md provides project overview and build commands; no .claude/ directory or detailed test creation rules"
critical_gaps:
  - title: "No coverage threshold enforcement"
    impact: "Coverage can regress silently on any PR without blocking merge"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No full E2E test suite with cluster deployment"
    impact: "Authentication proxy behavior not validated in a real Kubernetes/OpenShift environment"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No CI concurrency control, caching, or timeouts"
    impact: "Redundant CI runs on rapid pushes; no Go module caching wastes build time; runaway tests can hang indefinitely"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No container runtime validation"
    impact: "Image startup failures and misconfigurations not caught until deployment"
    severity: "MEDIUM"
    effort: "4-8 hours"
quick_wins:
  - title: "Add concurrency control and Go module caching to CI workflow"
    effort: "1-2 hours"
    impact: "Prevent redundant CI runs and speed up builds with module caching"
  - title: "Add coverage threshold enforcement with Code Climate or Codecov"
    effort: "2-4 hours"
    impact: "Prevent silent coverage regressions on every PR"
  - title: "Add timeout-minutes to all CI jobs"
    effort: "30 minutes"
    impact: "Prevent runaway test processes from consuming CI resources indefinitely"
  - title: "Create .claude/rules/ with test creation guidelines"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality with framework-specific patterns and quality gates"
recommendations:
  priority_0:
    - "Add coverage threshold enforcement — configure Code Climate or add Codecov with minimum coverage gate"
    - "Add CI concurrency control to cancel redundant PR workflow runs"
  priority_1:
    - "Build an E2E test suite that deploys kube-auth-proxy to a Kind cluster and validates authentication flows end-to-end"
    - "Add container startup validation test that verifies the built image starts and responds to health probes"
    - "Create comprehensive .claude/rules/ with Ginkgo/Gomega test patterns and integration test examples"
  priority_2:
    - "Add Go module caching to CI workflow for faster builds"
    - "Add multi-version K8s/OCP testing via CI matrix strategy"
    - "Add HEALTHCHECK instruction to Dockerfiles"
---

# Quality Analysis: kube-auth-proxy

## Executive Summary

- **Overall Score: 6.1/10**
- **Repository Type**: Go authentication proxy (Kubernetes/OpenShift)
- **Primary Language**: Go 1.26
- **Frameworks**: Go testing, Ginkgo/Gomega (BDD), Tekton/Konflux
- **RHOAI Component**: AI Core Platform (RHOAIENG)
- **Tier**: midstream

**Key Strengths**: Excellent unit test coverage with a near 1:1 test-to-code ratio, strong static analysis with 16 golangci-lint rules and pre-commit hooks, dedicated FIPS compliance CI workflow with `check-payload` scanning, and Tekton/Konflux integration for PR and push builds.

**Critical Gaps**: No coverage threshold enforcement allows silent regression; no E2E tests with actual cluster deployment; CI workflows lack concurrency control, caching, and timeouts; no container runtime validation beyond build.

**Agent Rules Status**: AGENTS.md present with build/test overview; no CLAUDE.md or `.claude/rules/` directory for detailed test automation guidance.

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.0/10 | 15% | 1.20 | Excellent test-to-code ratio (0.96) with dual frameworks |
| Integration/E2E | 5.0/10 | 20% | 1.00 | Integration tests with mocks; no cluster-level E2E |
| Build Integration | 7.0/10 | 15% | 1.05 | PR Docker builds + Tekton/Konflux pipelines |
| Image Testing | 5.0/10 | 10% | 0.50 | Multi-stage builds + FIPS scanning; no runtime tests |
| Coverage Tracking | 4.0/10 | 10% | 0.40 | Code Climate reporting; no thresholds |
| CI/CD Automation | 6.0/10 | 15% | 0.90 | Good workflow set; missing optimization |
| Static Analysis | 8.0/10 | 10% | 0.80 | Strong linting + pre-commit + Renovate |
| Agent Rules | 4.0/10 | 5% | 0.20 | AGENTS.md present; no detailed test rules |
| **Overall** | **6.1/10** | **100%** | **6.05** | |

## Critical Gaps

### 1. No Coverage Threshold Enforcement
- **Severity**: HIGH
- **Impact**: Coverage can regress silently on any PR without blocking merge. The `--coverprofile c.out` flag generates coverage data and Code Climate ingests it, but there is no minimum threshold gate that would fail a PR.
- **Effort**: 4-6 hours
- **Current State**: `Makefile` generates `c.out` when `COVER=true`; `test.sh` pipes results to Code Climate's `cc-test-reporter`. No `.codecov.yml` or threshold config exists.

### 2. No Full E2E Test Suite with Cluster Deployment
- **Severity**: HIGH
- **Impact**: The proxy's core behavior — authenticating requests against real OIDC providers or OpenShift OAuth in a Kubernetes cluster — is only validated with mock providers. Real cluster interactions (RBAC, service accounts, token review API) are not exercised in CI.
- **Effort**: 16-24 hours
- **Current State**: `integration_suite_test.go` uses `//go:build integration` tag with mock OIDC and OpenShift OAuth servers. `test/integration/testutil/` provides helpers for spinning up httptest servers with mock providers. No Kind/Minikube/envtest cluster setup exists.

### 3. No CI Concurrency Control, Caching, or Timeouts
- **Severity**: MEDIUM
- **Impact**: Rapid pushes to the same branch trigger multiple redundant CI runs. Go module downloads happen fresh on every run without caching. No timeout-minutes means a hung test process can consume CI resources indefinitely.
- **Effort**: 2-4 hours
- **Current State**: `ci.yml` has no `concurrency:` block, no `cache:` action for Go modules, no `timeout-minutes:` on jobs, and no `strategy: matrix` for parallel testing.

### 4. No Container Runtime Validation
- **Severity**: MEDIUM
- **Impact**: Built images are never started in CI to verify they actually run and respond. Entrypoint issues, missing runtime dependencies, or configuration errors are only caught at deployment time.
- **Effort**: 4-8 hours
- **Current State**: CI builds Docker images but does not `docker run` them. No `HEALTHCHECK` in Dockerfiles. No Testcontainers or equivalent runtime validation.

## Quick Wins

### 1. Add Concurrency Control and Go Module Caching to CI (1-2 hours)

```yaml
# Add to ci.yml at the top level
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

# Add after setup-go step in build job
- name: Cache Go modules
  uses: actions/cache@v4
  with:
    path: |
      ~/go/pkg/mod
      ~/.cache/go-build
    key: ${{ runner.os }}-go-${{ hashFiles('**/go.sum') }}
    restore-keys: |
      ${{ runner.os }}-go-
```

### 2. Add Coverage Threshold Enforcement (2-4 hours)

Option A — Add `.codecov.yml`:
```yaml
coverage:
  status:
    project:
      default:
        target: 60%
        threshold: 2%
    patch:
      default:
        target: 70%
```

Option B — Add Code Climate threshold in CI:
```yaml
- name: Check coverage threshold
  run: |
    COVERAGE=$(go tool cover -func=c.out | grep total | awk '{print $3}' | sed 's/%//')
    echo "Total coverage: ${COVERAGE}%"
    if (( $(echo "$COVERAGE < 60" | bc -l) )); then
      echo "::error::Coverage ${COVERAGE}% is below 60% threshold"
      exit 1
    fi
```

### 3. Add Timeout to All CI Jobs (30 minutes)

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    # ...
  docker:
    runs-on: ubuntu-latest
    timeout-minutes: 15
```

### 4. Create `.claude/rules/` with Test Guidelines (2-3 hours)

Create `.claude/rules/unit-tests.md` with Ginkgo/Gomega patterns used throughout the codebase, and `.claude/rules/integration-tests.md` with mock provider patterns from `test/integration/testutil/`.

## Detailed Findings

### Unit Tests

**Score: 8.0/10**

| Metric | Value |
|--------|-------|
| Test files | 110 |
| Source files | 114 |
| Test-to-code ratio | 0.96 |
| Test functions (`func Test*`) | 238 |
| Ginkgo `Describe` blocks | 65 |
| Ginkgo `It()` specs | 228 |
| Framework | Go testing + Ginkgo/Gomega |

**Strengths**:
- Near 1:1 test-to-code file ratio indicates excellent coverage discipline
- Dual framework usage: standard Go `testing` for straightforward tests, Ginkgo/Gomega BDD for complex behavioral specs
- Tests co-located with source files following Go conventions
- Suite files (`*_suite_test.go`) properly organize Ginkgo test suites
- Edge case testing: dedicated `edge_cases_test.go` at root
- Provider-specific tests: `openshift_test.go`, `oidc_test.go` for auth provider logic

**Key test files**:
- `oauthproxy_test.go` — Core proxy logic tests
- `k8s_integration_test.go` — Kubernetes token authentication tests
- `openshift_oauth_flow_test.go` — OpenShift OAuth flow validation
- `oidc_flow_test.go` — OIDC authentication flow validation
- `pkg/validation/*_test.go` — Configuration validation tests (8 test files)
- `pkg/middleware/*_test.go` — Middleware layer tests
- `pkg/encryption/*_test.go` — Crypto utility tests
- `providers/*_test.go` — Auth provider implementation tests

**Gaps**:
- No explicit `t.Parallel()` usage detected — tests may run sequentially
- No table-driven test pattern consistency (some use Ginkgo `DescribeTable`, others don't)

### Integration/E2E Tests

**Score: 5.0/10**

**Strengths**:
- Dedicated integration test suite with `//go:build integration` tag for selective execution
- `integration_suite_test.go` provides Ginkgo-based integration framework at root
- `test/integration/testutil/` contains reusable test infrastructure:
  - `mock_openshift_oauth.go` — Mock OpenShift OAuth server with discovery, authorize, token, and user info endpoints
  - `mock_oidc.go` — Mock OIDC provider for testing standard OIDC flows
  - `proxy_helpers.go` — Helpers for starting proxy on free-port listeners
- Separate `make test-integration` target in Makefile
- Mock providers test real HTTP flows (not just unit mocks)

**Gaps**:
- No E2E tests with actual Kubernetes cluster (Kind, Minikube, or envtest)
- No multi-version K8s/OCP testing
- Integration tests not executed in CI (`make test` does not include `-tags integration`)
- No test for actual Kubernetes TokenReview API interaction
- No deployment manifest validation (the proxy gets deployed but deployment configs aren't tested)
- Missing end-to-end authentication flow testing with real OAuth providers in a cluster

### Build Integration

**Score: 7.0/10**

**Strengths**:
- **PR Docker builds**: `ci.yml` builds Docker image on every PR via `make build-docker` (amd64 for PRs)
- **Tekton/Konflux integration**: Three Tekton pipelines in `.tekton/`:
  - `kube-auth-proxy-pull-request.yaml` — Builds FIPS image on PRs using `Dockerfile.redhat`
  - `kube-auth-proxy-push.yaml` — Builds on push to main
  - `kube-auth-proxy-release-push.yaml` — Release builds
- **Multi-arch builds**: Docker Buildx with QEMU for amd64, arm64, ppc64le, s390x
- **FIPS build target**: Separate `make build-fips` with `CGO_ENABLED=1 GOEXPERIMENT=strictfipsruntime`
- **Code generation verification**: `make verify-generate` in CI ensures generated code is committed
- **Konflux central pipeline**: Uses shared `odh-konflux-central` pipeline for standardized builds

**Gaps**:
- No `kustomize build` or operator manifest validation (not an operator, so less critical)
- No image startup validation after build
- PR build uses generic `Dockerfile` while Konflux uses `Dockerfile.redhat` — potential divergence
- No `kubectl apply --dry-run` or deployment testing

### Image Testing

**Score: 5.0/10**

**Strengths**:
- **Multi-stage builds**: Both `Dockerfile` and `Dockerfile.redhat` use proper multi-stage patterns (builder + runtime)
- **FIPS-compliant image**: `Dockerfile.redhat` uses UBI9 base images (`ubi9/go-toolset:1.26` builder, `ubi9/ubi-minimal` runtime)
- **Multi-arch support**: Handles amd64, arm64, ppc64le, s390x via TARGETPLATFORM ARG
- **FIPS compliance CI**: Dedicated `fips-compliance.yml` workflow builds `Dockerfile.redhat` and runs `check-payload scan local`
- **Security practices**: Non-root user (1001), proper file permissions, license file inclusion
- **.dockerignore**: Present to reduce build context size
- **OCI labels**: Both Dockerfiles include standard OCI image labels

**Gaps**:
- No `HEALTHCHECK` instruction in either Dockerfile
- No container startup validation (`docker run` + health probe) in CI
- No Testcontainers or equivalent runtime testing
- No readiness/liveness probe definitions in any K8s manifests within the repo
- Main `Dockerfile` uses placeholder build/runtime images — relies on external resolution

### Coverage Tracking

**Score: 4.0/10**

**Strengths**:
- `Makefile` supports `--coverprofile c.out` when `COVER=true` is set
- CI sets `COVER: true` environment variable in the build job
- Code Climate integration via `cc-test-reporter` for coverage reporting
- `test.sh` script handles before-build/after-build reporting lifecycle

**Gaps**:
- No `.codecov.yml` — uses Code Climate instead (acceptable, but less common in ODH ecosystem)
- No coverage threshold enforcement — reports are generated but no minimum gate
- No PR coverage comments or diff-coverage reporting
- No `coverageThreshold` or `coverage-minimum` configuration anywhere
- Coverage gate is entirely absent — any PR can merge regardless of coverage impact
- Code Climate reporter requires `CC_TEST_REPORTER_ID` secret, which may silently skip if unconfigured

### CI/CD Automation

**Score: 6.0/10**

**Workflow Inventory**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | push, pull_request | Build, lint, test, Docker build |
| `codeql.yml` | push, PR, schedule (Tue) | Code scanning |
| `fips-compliance.yml` | PR to main | FIPS build + check-payload scan |
| `prepare-release.yml` | workflow_dispatch | Prepare release branch |
| `tag-release.yml` | workflow_dispatch | Tag and publish release |
| `stale.yml` | schedule (daily) | Mark stale issues/PRs |
| `labeler.yml` | (implied) | PR labeling |

**Tekton Pipelines**:

| Pipeline | Trigger | Purpose |
|----------|---------|---------|
| `kube-auth-proxy-pull-request.yaml` | PR to main | Konflux FIPS image build |
| `kube-auth-proxy-push.yaml` | Push to main | Konflux stable image build |
| `kube-auth-proxy-release-push.yaml` | Release | Konflux release image build |

**Strengths**:
- Good workflow coverage: PR validation, FIPS compliance, release automation, stale issue management
- Tekton/Konflux pipelines for production builds alongside GitHub Actions for CI
- Pinned action versions with SHA hashes for supply chain security
- FIPS compliance check as separate PR-triggered workflow

**Gaps**:
- No `concurrency:` block — rapid pushes trigger redundant runs
- No Go module caching — every run downloads dependencies fresh
- No `timeout-minutes:` — runaway processes can hang indefinitely
- No `strategy: matrix` — single-configuration testing only
- No test parallelization
- Integration tests (`make test-integration`) not run in CI
- No scheduled regression testing beyond CodeQL

### Static Analysis

**Score: 8.0/10**

**Linting Configuration** (`.golangci.yml` v2):

16 linters enabled:
`bodyclose`, `copyloopvar`, `dogsled`, `goconst`, `gocritic`, `goprintffuncname`, `gosec`, `govet`, `ineffassign`, `misspell`, `prealloc`, `revive`, `staticcheck`, `unconvert`, `unused`

Formatters: `gofmt`, `goimports`

Test file exclusions properly relaxed for `bodyclose`, `goconst`, `gocritic`, `gosec`, `revive`, `unconvert`.

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- `trailing-whitespace`, `end-of-file-fixer`, `check-yaml`, `check-added-large-files`, `check-merge-conflict`
- Local hooks: `go fmt`, `go vet`, `golangci-lint`
- Pre-push hook: `go test` (unit tests run before push)

**FIPS Compatibility**:
- `Dockerfile.redhat`: `CGO_ENABLED=1 GOEXPERIMENT=strictfipsruntime -tags strictfipsruntime`
- `Makefile`: `build-fips` target with same FIPS flags
- UBI9 base images (FIPS-capable)
- Dedicated `fips-compliance.yml` CI workflow with `check-payload scan local`
- One `math/rand` import found in `pkg/sessions/cookie/session_store_test.go` (test file — acceptable)
- No non-FIPS crypto imports (`crypto/md5`, `crypto/des`, `crypto/rc4`) detected in source

**Dependency Alerts**:
- Renovate configured (`.github/renovate.json5`) covering: `dockerfile`, `docker-compose`, `gomod`, `github-actions`, `helmv3`, `npm`, `custom.regex`
- Custom managers for Alpine version in Makefile and workflow tool versions
- Semantic commits enabled
- No Dependabot (Renovate is a valid alternative)

**Gaps**:
- Could benefit from additional linters: `errcheck`, `nilerr`, `exhaustive`
- No `typecheck` or `nilaway` for nil-safety analysis

### Agent Rules

**Score: 4.0/10**

**Present**:
- `AGENTS.md` at repository root with:
  - Project overview (authentication proxy for RHOAI, FIPS-compliant)
  - Architecture diagram (text-based directory layout)
  - Build and run commands (`make build`, `make test`, etc.)
  - Test guidelines (standard Go testing, integration tags, coverage env var)
  - Debug and troubleshooting guidance

**Missing**:
- No `CLAUDE.md` at root
- No `.claude/` directory
- No `.claude/rules/` with test creation guidelines
- No `.claude/skills/` for custom skills
- No framework-specific test examples (Ginkgo patterns, mock provider patterns)
- No quality gate checklists for PRs
- Test guidelines in `AGENTS.md` are generic — no examples of how to write tests for this specific codebase

## Recommendations

### Priority 0 (Critical)

1. **Add coverage threshold enforcement** — Configure Code Climate or add Codecov with a minimum 60% project coverage gate and 70% patch coverage. This prevents silent regression on every PR. Without this, any PR can merge regardless of how much coverage it removes.

2. **Add CI concurrency control** — Add `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }` to `ci.yml` to prevent redundant CI runs on rapid pushes.

### Priority 1 (High Value)

3. **Build an E2E test suite with Kind cluster** — Create an E2E test that:
   - Spins up a Kind cluster in CI
   - Deploys kube-auth-proxy with a real configuration
   - Validates OIDC and OpenShift OAuth authentication flows end-to-end
   - Tests Kubernetes TokenReview API integration

4. **Add container startup validation** — After building the Docker image in CI, run it and verify it starts correctly:
   ```yaml
   - name: Validate image startup
     run: |
       docker run -d --name test-proxy \
         -p 4180:4180 \
         kube-auth-proxy:test --help
       docker logs test-proxy
       docker rm -f test-proxy
   ```

5. **Create comprehensive agent rules** — Add `.claude/rules/unit-tests.md` with Ginkgo/Gomega patterns, `.claude/rules/integration-tests.md` with mock provider patterns, and a quality gate checklist.

6. **Run integration tests in CI** — Add a CI job that runs `make test-integration` so the existing integration test suite is actually exercised in CI.

### Priority 2 (Nice-to-Have)

7. **Add Go module caching** — Use `actions/cache` for `~/go/pkg/mod` and `~/.cache/go-build` to speed up CI builds.

8. **Add multi-version testing** — Use matrix strategy to test against multiple Go versions and validate compatibility.

9. **Add HEALTHCHECK to Dockerfiles** — Add `HEALTHCHECK CMD ["/bin/kube-auth-proxy", "--ping"]` or equivalent to enable Docker-level health monitoring.

10. **Add timeout-minutes to all CI jobs** — Prevent runaway processes from consuming CI resources.

## Comparison to Gold Standards

| Dimension | kube-auth-proxy | odh-dashboard | notebooks | kserve |
|-----------|----------------|---------------|-----------|--------|
| Unit Tests | 8.0 — 0.96 ratio, dual frameworks | 9.0 — Multi-layer testing | 7.0 — Image-focused | 8.0 — Comprehensive |
| Integration/E2E | 5.0 — Mock providers only | 9.0 — Contract + E2E | 8.0 — Multi-version | 9.0 — Multi-version K8s |
| Build Integration | 7.0 — PR Docker + Konflux | 8.0 — Full pipeline | 9.0 — Image pipeline | 7.0 — Build validation |
| Image Testing | 5.0 — Build only, FIPS scan | 6.0 — Basic validation | 9.0 — 5-layer validation | 6.0 — Basic |
| Coverage Tracking | 4.0 — Code Climate, no gates | 8.0 — Enforced thresholds | 5.0 — Basic | 9.0 — Strict enforcement |
| CI/CD Automation | 6.0 — Good set, no optimization | 9.0 — Comprehensive | 8.0 — Multi-workflow | 9.0 — Matrix + caching |
| Static Analysis | 8.0 — 16 linters + FIPS CI | 8.0 — ESLint strict | 7.0 — Basic | 8.0 — golangci strict |
| Agent Rules | 4.0 — AGENTS.md only | 8.0 — Full .claude/ | 3.0 — Minimal | 3.0 — Minimal |
| **Overall** | **6.1** | **8.3** | **7.2** | **7.5** |

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yml` — Main CI workflow (build, lint, test, Docker build)
- `.github/workflows/codeql.yml` — CodeQL code scanning
- `.github/workflows/fips-compliance.yml` — FIPS compliance check with check-payload
- `.github/workflows/prepare-release.yml` — Release preparation
- `.github/workflows/tag-release.yml` — Release tagging and publishing
- `.github/workflows/stale.yml` — Stale issue/PR management
- `.github/workflows/test.sh` — Test runner with Code Climate integration
- `.tekton/kube-auth-proxy-pull-request.yaml` — Konflux PR build pipeline
- `.tekton/kube-auth-proxy-push.yaml` — Konflux push build pipeline
- `.tekton/kube-auth-proxy-release-push.yaml` — Konflux release pipeline

### Testing
- `*_test.go` (root) — Core proxy tests (oauthproxy, main, validators, flows)
- `providers/*_test.go` — Auth provider tests
- `pkg/*/` — Package-level test files co-located with source
- `integration_suite_test.go` — Ginkgo integration test suite
- `k8s_integration_test.go` — Kubernetes token authentication tests
- `test/integration/testutil/` — Integration test helpers and mock providers
- `testdata/openredirects.txt` — Open redirect test data

### Build & Container
- `Makefile` — Build, test, lint, Docker targets
- `Dockerfile` — Standard multi-stage build (placeholder images)
- `Dockerfile.redhat` — FIPS-compliant build with UBI9 base
- `.dockerignore` — Build context exclusions

### Code Quality
- `.golangci.yml` — golangci-lint v2 configuration (16 linters)
- `.pre-commit-config.yaml` — Pre-commit hooks (fmt, vet, lint, test)
- `.github/renovate.json5` — Renovate dependency update config

### Agent Rules
- `AGENTS.md` — Project overview and agent guidelines
- `DESIGN.md` — Architecture and requirements documentation

### Project
- `go.mod` — Go 1.26 module definition
- `VERSION` — Version file for build
- `dist.sh` — Release distribution script
