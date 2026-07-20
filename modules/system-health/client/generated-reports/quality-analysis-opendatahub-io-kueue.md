---
repository: "opendatahub-io/kueue"
upstream: "kubernetes-sigs/kueue"
jira_project: "RHOAIENG"
jira_component: "Workload Orchestration"
tier: "midstream"
overall_score: 5.9
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Strong unit test coverage (119 files, 341 test functions) with Go testing + Ginkgo/Gomega"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Excellent multi-layer testing: 76 integration + 29 E2E files across singlecluster, multikueue, TAS, and customconfigs"
  - dimension: "Build Integration"
    score: 3.0
    status: "No PR-triggered CI workflows; all builds are manual dispatch or release-only"
  - dimension: "Image Testing"
    score: 4.5
    status: "Multi-stage Dockerfiles with multi-arch support but no container runtime validation"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "Coverage generation via --coverprofile exists but no codecov integration, thresholds, or PR reporting"
  - dimension: "CI/CD Automation"
    score: 2.5
    status: "Only 5 workflows, all manual-dispatch or release-triggered; zero PR automation in fork"
  - dimension: "Static Analysis"
    score: 7.5
    status: "Strong golangci-lint (18 linters), shellcheck, comprehensive Dependabot; missing FIPS tags and pre-commit hooks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory present"
critical_gaps:
  - title: "No PR-triggered CI workflows"
    impact: "Code changes merged without automated testing, linting, or build validation in the fork"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No coverage enforcement or PR reporting"
    impact: "Coverage regressions go undetected; no visibility into coverage trends"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No FIPS build configuration"
    impact: "Binary may not be FIPS-compliant for RHOAI deployment; UBI base image in Dockerfile.rhoai is good but no FIPS build tags"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "No container runtime validation"
    impact: "Image startup issues not caught until deployment; no Testcontainers or Kind-based image validation"
    severity: "MEDIUM"
    effort: "6-10 hours"
quick_wins:
  - title: "Add PR-triggered CI workflow for unit tests and linting"
    effort: "4-6 hours"
    impact: "Prevent broken code from merging; catch regressions before review"
  - title: "Integrate Codecov with PR reporting and threshold enforcement"
    effort: "2-4 hours"
    impact: "Automated coverage tracking with merge gates"
  - title: "Add CLAUDE.md with test creation rules"
    effort: "2-3 hours"
    impact: "Enable AI-assisted test generation with consistent patterns"
  - title: "Add pre-commit hooks for linting and formatting"
    effort: "1-2 hours"
    impact: "Catch formatting and lint issues before commit"
recommendations:
  priority_0:
    - "Create PR-triggered workflow running unit tests, integration tests, linting, and build validation"
    - "Add Codecov integration with coverage thresholds and PR comments"
    - "Add FIPS build tags (-tags=strictfipsruntime or GOEXPERIMENT=boringcrypto) to Makefile and CI"
  priority_1:
    - "Add container image runtime validation (startup test, healthz/readyz probe check)"
    - "Create comprehensive CLAUDE.md and .claude/rules/ for test automation guidance"
    - "Add pre-commit hooks (.pre-commit-config.yaml) enforcing golangci-lint and go fmt"
  priority_2:
    - "Add PR-time Konflux build simulation using Dockerfile.rhoai"
    - "Add concurrency controls and caching to CI workflows"
    - "Increase t.Parallel() usage in unit tests (currently only 1 file uses it)"
---

# Quality Analysis: opendatahub-io/kueue

## Executive Summary

- **Overall Score: 5.9/10**
- **Repository Type**: Go-based Kubernetes operator (midstream fork of kubernetes-sigs/kueue)
- **Jira**: RHOAIENG / Workload Orchestration
- **Primary Language**: Go 1.24.13
- **Framework**: Kubernetes operator (controller-runtime, kubebuilder, envtest)

**Key Strengths**: The upstream kueue project has an exceptionally well-structured test suite with 226 test files spanning unit, integration, E2E, and performance tests. The integration tests use envtest with Ginkgo/Gomega, E2E tests use Kind clusters with multi-version K8s testing (1.30, 1.31, 1.32), and there's even a dedicated performance/scalability testing framework. The golangci-lint configuration is thorough with 18 linters enabled, and Dependabot covers 6 package ecosystems.

**Critical Gaps**: The opendatahub-io fork has **zero PR-triggered CI workflows**. All 5 workflows are either manual dispatch (`workflow_dispatch`) or release/tag-triggered. This means no automated testing, linting, or build validation runs when PRs are submitted to the fork. Additionally, there's no codecov integration, no FIPS build configuration, no container runtime validation, and no AI agent rules.

**Agent Rules Status**: Missing — No CLAUDE.md, AGENTS.md, or .claude/ directory present.

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 7.5/10 | 15% | 1.13 | Strong test coverage with Go testing + Ginkgo/Gomega |
| Integration/E2E | 9.0/10 | 20% | 1.80 | Excellent multi-layer testing with envtest, Kind, multi-K8s-version |
| Build Integration | 3.0/10 | 15% | 0.45 | No PR-time build validation; builds are manual dispatch only |
| Image Testing | 4.5/10 | 10% | 0.45 | Multi-stage Dockerfiles, multi-arch, but no runtime validation |
| Coverage Tracking | 4.0/10 | 10% | 0.40 | Coverage generation exists but no enforcement or reporting |
| CI/CD Automation | 2.5/10 | 15% | 0.38 | No PR automation; all workflows are manual or release-triggered |
| Static Analysis | 7.5/10 | 10% | 0.75 | Strong linting (18 linters), shellcheck, Dependabot; missing FIPS and pre-commit |
| Agent Rules | 0.0/10 | 5% | 0.00 | No agent rules or test automation guidance |
| **Overall** | **5.9/10** | **100%** | **5.35** | |

## Critical Gaps

### 1. No PR-Triggered CI Workflows (HIGH)
- **Impact**: Code changes merged without any automated quality gates in the fork
- **Details**: All 5 workflows in `.github/workflows/` are either `workflow_dispatch` (manual) or `push: tags` (release). Zero workflows trigger on `pull_request`.
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Note**: The upstream kubernetes-sigs/kueue has comprehensive PR-triggered CI (via Prow), but the ODH fork doesn't inherit those workflows.

### 2. No Coverage Enforcement or PR Reporting (HIGH)
- **Impact**: Coverage regressions go undetected; no visibility into quality trends
- **Details**: The Makefile generates `cover.out` via `--coverprofile` and `--coverpkg=./...`, but there's no `.codecov.yml`, no codecov action, and no coverage thresholds.
- **Severity**: HIGH
- **Effort**: 4-6 hours

### 3. No FIPS Build Configuration (MEDIUM)
- **Impact**: Binary may not be FIPS-compliant for RHOAI environments
- **Details**: No `-tags=fips`, `-tags=strictfipsruntime`, or `GOEXPERIMENT=boringcrypto` in Makefile or CI. `Dockerfile.rhoai` uses UBI9 base (good) and `CGO_ENABLED=1` (good for boringcrypto) but no FIPS build tags. No `math/rand` or weak crypto imports found (good).
- **Severity**: MEDIUM
- **Effort**: 4-8 hours

### 4. No Container Runtime Validation (MEDIUM)
- **Impact**: Image startup issues and probe failures not caught until deployment
- **Details**: No Testcontainers usage, no post-build `docker run` health checks, no image startup validation. The E2E tests deploy to Kind but don't validate the image independently.
- **Severity**: MEDIUM
- **Effort**: 6-10 hours

## Quick Wins

### 1. Add PR-Triggered CI Workflow (4-6 hours)
Create a workflow that runs on `pull_request` with unit tests and linting:
```yaml
name: PR CI
on:
  pull_request:
    branches: [main, release-*]
jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version-file: go.mod
          cache: true
      - run: make test
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version-file: go.mod
          cache: true
      - run: make ci-lint
```

### 2. Integrate Codecov (2-4 hours)
Add `.codecov.yml` with threshold enforcement and codecov action to upload `cover.out`:
```yaml
# .codecov.yml
coverage:
  status:
    project:
      default:
        target: auto
        threshold: 1%
    patch:
      default:
        target: 80%
```

### 3. Add CLAUDE.md with Test Creation Rules (2-3 hours)
Create agent rules for consistent test generation. Use `/test-rules-generator` to bootstrap.

### 4. Add Pre-commit Hooks (1-2 hours)
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/golangci/golangci-lint
    rev: v1.62.2
    hooks:
      - id: golangci-lint
  - repo: https://github.com/dnephin/pre-commit-golang
    hooks:
      - id: go-fmt
```

## Detailed Findings

### Unit Tests (7.5/10)

**Test Infrastructure**:
- **119 unit test files** (outside `test/` directory) with **341 test functions**
- **Test-to-code ratio**: 226 test files / 450 source files = **0.50** (good)
- **Frameworks**: Standard Go `testing` package + Ginkgo v2/Gomega for BDD-style tests
- **Race detection**: Enabled via `-race` flag in `GO_TEST_FLAGS`
- **JUnit output**: Generated via `gotestsum --junitfile`
- **Coverage**: Generated with `--coverpkg=./... --coverprofile`

**Test Patterns**:
- Controllers tested with envtest
- Webhooks thoroughly tested (job, pod, deployment, statefulset, etc.)
- Utility packages have dedicated tests (priority, metrics)

**Gaps**:
- Only **1 file** uses `t.Parallel()` — significant room for parallelization
- No table-driven test documentation/patterns enforced
- Tests are comprehensive but could benefit from more isolation

### Integration/E2E Tests (9.0/10)

**Integration Tests** (76 files):
- Located in `test/integration/singlecluster/` and `test/integration/multikueue/`
- Uses **envtest** (controller-runtime) with `KUBEBUILDER_ASSETS`
- **Ginkgo v2** with parallel execution (`-procs=4` for singlecluster, `-procs=3` for multikueue)
- Baseline/extended split: `--label-filter="!slow && !redundant"` for baseline
- Covers: controllers, webhooks, schedulers, CRD validation, kueuectl CLI, fair sharing, preemption, provisioning
- **ginkgo-top** tool for test timing analysis

**E2E Tests** (29 files across 6 suites):
- `singlecluster/` — core kueue functionality
- `multikueue/` — multi-cluster workload management
- `tas/` — Topology-Aware Scheduling
- `customconfigs/` — custom configuration scenarios
- `certmanager/` — cert-manager integration
- Uses **Kind clusters** with full kueue deployment via kustomize
- **Multi-version K8s testing**: 1.30.10, 1.31.6, 1.32.3
- Installs external dependencies: AppWrapper, JobSet, Kubeflow, KubeRay, LeaderWorkerSet

**Performance Tests**:
- Dedicated `test/performance/` directory with scheduler benchmarks
- `minimalkueue` binary for scalability testing
- CPU profiling, metrics scraping, retry mechanisms
- Generator-based workload simulation

**Strengths**: This is an exemplary test suite for a Kubernetes operator. The multi-layer approach (unit → integration with envtest → E2E with Kind → performance) is a gold standard pattern.

### Build Integration (3.0/10)

**Available Build Targets**:
- `make build` — builds the manager binary
- `make image-build` — multi-platform Docker image build with buildx
- `make kind-image-build` — builds AMD64 image for Kind E2E tests
- `make image-push` — builds and pushes to registry
- Kustomize manifests: `make install` (CRDs), `make deploy` (full deployment)
- Helm chart with `make helm-lint` and `make helm-verify`

**CI Build Workflows**:
- `odh-build-and-publish-kueue-image.yaml` — **manual dispatch only**, builds single platform (linux/amd64)
- No PR-triggered builds at all

**ODH-Specific**:
- `Dockerfile.rhoai` exists with UBI9 base image and `CGO_ENABLED=1`
- No Konflux build simulation in CI
- No PR-time image build validation

**Critical Issue**: The fork has no CI that validates builds on PRs. Build breakage can only be discovered manually or after merge.

### Image Testing (4.5/10)

**Dockerfiles**:
- `Dockerfile` — upstream, multi-stage (golang builder → distroless), supports multi-arch via `BUILDPLATFORM`/`TARGETARCH`
- `Dockerfile.rhoai` — RHOAI-specific, multi-stage (UBI9 builder → UBI9 runtime), `CGO_ENABLED=1`

**Multi-Architecture Support**:
- Makefile supports 4 platforms: `linux/amd64,linux/arm64,linux/s390x,linux/ppc64le`
- Uses `docker buildx` for multi-platform builds

**Health Probes**:
- Liveness (`/healthz`) and readiness (`/readyz`) probes configured in `config/components/manager/manager.yaml`
- Health checks implemented in `cmd/kueue/main.go` using `healthz.Ping`

**Gaps**:
- No Testcontainers or equivalent runtime validation
- No post-build image startup test
- No image vulnerability scanning in fork CI
- `Dockerfile.rhoai` doesn't cache go mod download separately (less efficient builds)

### Coverage Tracking (4.0/10)

**What Exists**:
- `make test` generates coverage via `--coverpkg=./... --coverprofile $(ARTIFACTS)/cover.out`
- Coverage data is produced by unit tests

**What's Missing**:
- No `.codecov.yml` or `codecov.yml`
- No codecov GitHub Action for PR reporting
- No coverage thresholds or merge gates
- No coverage trend tracking
- Integration/E2E tests don't generate coverage data
- No coverage visualization

### CI/CD Automation (2.5/10)

**Workflow Inventory** (5 total):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `odh-build-and-publish-kueue-image.yaml` | `workflow_dispatch` | Build and push image to Quay |
| `odh-release.yml` | `workflow_dispatch` + `push: tags` | Compile E2E tests, create GitHub release |
| `krew-release.yml` | `release: released` | Update krew-index |
| `openvex.yaml` | `workflow_dispatch` | Generate OpenVEX data |
| `sbom.yaml` | `workflow_dispatch` | Generate SBOM |

**Critical Issues**:
- **Zero PR-triggered workflows** — no tests, linting, or builds run on PRs
- No concurrency controls
- No caching strategies (except one `cache: true` in sbom.yaml for Go setup)
- No test parallelization in CI
- No matrix strategies for multi-version testing in CI
- `odh-release.yml` uses hardcoded `go-version: v1.21` instead of `go-version-file: go.mod`

**Note**: The upstream kubernetes-sigs/kueue uses Prow for CI, which provides comprehensive PR testing. The ODH fork doesn't replicate this with GitHub Actions.

### Static Analysis (7.5/10)

**Linting**:
- `.golangci.yaml` with **18 linters** enabled: copyloopvar, dupword, durationcheck, fatcontext, gci, ginkgolinter, gocritic, goheader, govet, loggercheck, misspell, nilerr, nilnesserr, nolintlint, perfsprint, revive, unconvert, makezero
- Additional settings: gocritic checks, goheader with Apache 2.0 template, gci import ordering, nolintlint requiring explanations
- `make ci-lint` and `make lint-fix` targets
- `make verify` runs full verification suite (gomod, lint, fmt, shell-lint, manifests, helm)

**Shell Linting**:
- `.shellcheckrc` configured with `external-sources=true`
- `make shell-lint` target using shellcheck

**Dependency Alerts**:
- `.github/dependabot.yml` — comprehensive configuration covering **6 ecosystems**:
  - gomod (root, hack/internal/tools, site, kueue-viz backend)
  - npm (site, kueue-viz frontend)
  - github-actions
  - docker (shellcheck, kueue-viz frontend)
- Smart grouping (kubernetes packages), selective ignoring (K8s major/minor versions)
- Labels and auto-labeling configured

**FIPS Compatibility**:
- No `-tags=fips` or `GOEXPERIMENT=boringcrypto` in Makefile or CI
- No `math/rand` usage (good)
- No weak crypto imports found (good — no `crypto/md5`, `crypto/des`, `crypto/rc4`)
- `Dockerfile.rhoai` uses UBI9 (FIPS-capable) with `CGO_ENABLED=1` (good for boringcrypto)
- Missing: FIPS build tags to actually enable FIPS-compliant crypto

**Gaps**:
- No `.pre-commit-config.yaml`
- No FIPS build tags despite RHOAI deployment target
- Linting only runs via `make verify` — not enforced in CI for this fork

### Agent Rules (0.0/10)

- **No `CLAUDE.md`** in repository root
- **No `AGENTS.md`** in repository root
- **No `.claude/` directory** — no rules, skills, or configuration
- **No test automation guidance** for AI agents
- **No testing documentation** beyond code comments

**Recommendation**: Use `/test-rules-generator` to generate comprehensive agent rules based on the existing test patterns (Go testing, Ginkgo/Gomega, envtest, Kind E2E, etc.).

## Recommendations

### Priority 0 (Critical)

1. **Create PR-triggered CI workflow** — Run unit tests (`make test`), linting (`make ci-lint`), and build (`make build`) on every PR. This is the single most impactful improvement. Without it, the fork has no automated quality gates.

2. **Add Codecov integration with PR reporting** — Upload `cover.out` to Codecov, set project threshold to `auto` with 1% allowed regression, and require 80% patch coverage.

3. **Add FIPS build configuration** — Add `-tags=strictfipsruntime` or `GOEXPERIMENT=boringcrypto` to the Makefile and `Dockerfile.rhoai` build step for RHOAI compliance.

### Priority 1 (High Value)

4. **Add container image runtime validation** — After building the image in CI, run a minimal startup test (e.g., `docker run --rm <image> --version` or health probe check).

5. **Create CLAUDE.md and .claude/rules/** — Document test patterns, frameworks, and conventions for AI-assisted development. Include rules for unit tests (Go testing), integration tests (envtest + Ginkgo), and E2E tests (Kind + Ginkgo).

6. **Add pre-commit hooks** — Enforce `golangci-lint`, `gofmt`, and `shellcheck` before commits.

### Priority 2 (Nice-to-Have)

7. **Add PR-time Konflux build simulation** — Build `Dockerfile.rhoai` in PR CI to catch RHOAI-specific build issues early.

8. **Add concurrency controls and caching to CI** — Cancel previous runs on new pushes, cache Go modules and build artifacts.

9. **Increase test parallelization** — Only 1 file uses `t.Parallel()`. Adding parallel execution to unit tests would reduce CI run time.

10. **Fix Go version in odh-release.yml** — Replace hardcoded `go-version: v1.21` with `go-version-file: go.mod` (currently Go 1.24.13).

## Comparison to Gold Standards

| Practice | opendatahub-io/kueue | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|----------|---------------------|---------------------|------------------|---------------|
| PR-triggered CI | None | Comprehensive | Comprehensive | Comprehensive |
| Unit test coverage | Good (0.50 ratio) | Strong | Good | Strong |
| Integration tests | Excellent (envtest) | Contract + unit | N/A | envtest |
| E2E tests | Excellent (Kind) | Cypress | Notebook tests | Kind |
| Multi-version testing | Yes (3 K8s versions) | N/A | Multi-image | Yes |
| Coverage enforcement | No | Yes (Codecov) | Partial | Yes (Codecov) |
| Coverage PR reporting | No | Yes | No | Yes |
| Linting | 18 linters | ESLint strict | Varied | golangci-lint |
| FIPS compliance | Partial (UBI9 only) | N/A | Full | Partial |
| Dependabot/Renovate | Yes (6 ecosystems) | Renovate | Yes | Yes |
| Pre-commit hooks | No | Yes | No | Partial |
| Agent rules | None | Comprehensive | None | None |
| Performance tests | Yes (scalability) | No | No | Partial |
| Container validation | No | Docker build | 5-layer | Partial |

## File Paths Reference

### CI/CD
- `.github/workflows/odh-build-and-publish-kueue-image.yaml` — Manual image build
- `.github/workflows/odh-release.yml` — Release workflow
- `.github/workflows/krew-release.yml` — Krew plugin release
- `.github/workflows/openvex.yaml` — VEX data generation
- `.github/workflows/sbom.yaml` — SBOM generation

### Build
- `Dockerfile` — Upstream multi-stage build (distroless base)
- `Dockerfile.rhoai` — RHOAI-specific build (UBI9 base)
- `Makefile` — Primary build targets
- `Makefile-test.mk` — Test targets and configuration
- `Makefile-deps.mk` — Dependency management

### Testing
- `test/integration/singlecluster/` — 71 integration test files
- `test/integration/multikueue/` — Multi-cluster integration tests
- `test/e2e/singlecluster/` — Single-cluster E2E tests (13 files)
- `test/e2e/multikueue/` — Multi-cluster E2E tests
- `test/e2e/tas/` — Topology-Aware Scheduling E2E tests
- `test/e2e/customconfigs/` — Custom config E2E tests
- `test/e2e/certmanager/` — Cert-manager E2E tests
- `test/performance/` — Scalability and performance tests
- `test/util/` — Shared test utilities
- `hack/e2e-test.sh` — E2E test orchestration
- `hack/e2e-common.sh` — Shared E2E functions

### Static Analysis
- `.golangci.yaml` — 18 enabled linters
- `.shellcheckrc` — Shell linting config
- `.github/dependabot.yml` — 6 ecosystem dependency management

### Kubernetes
- `config/components/crd/bases/` — CRD definitions
- `config/components/manager/` — Manager deployment with health probes
- `config/components/rbac/` — RBAC configuration
- `config/components/webhook/` — Webhook configuration
- `config/default/` — Default kustomize overlay
