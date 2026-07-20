---
repository: "red-hat-data-services/kueue"
overall_score: 6.5
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "119 unit test files with Go testing + Ginkgo/Gomega; 0.26 test-to-code ratio"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Comprehensive suite: 76 integration + 29 e2e test files, multi-version K8s, Kind clusters, performance tests"
  - dimension: "Build Integration"
    score: 7.0
    status: "Tekton/Konflux PR pipeline with multi-arch, hermetic builds; kustomize overlays for deployment"
  - dimension: "Image Testing"
    score: 6.0
    status: "3 Dockerfiles with multi-stage builds, multi-arch support, liveness/readiness probes; no runtime validation"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "Coverage profile generated in Makefile but no codecov integration, thresholds, or PR reporting"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "Tekton PR builds + GH Actions for release; limited downstream CI automation; upstream CI via Prow"
  - dimension: "Static Analysis"
    score: 8.0
    status: "18 golangci-lint linters, comprehensive Dependabot, shellcheck, FIPS build tags in Konflux"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory; no AI agent test guidance"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Coverage regressions go undetected; no PR-level coverage reporting or threshold gates"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No AI agent rules for test creation"
    impact: "AI-assisted development produces inconsistent tests without framework-specific guidance"
    severity: "MEDIUM"
    effort: "3-4 hours"
  - title: "Limited downstream CI test automation"
    impact: "Downstream GH Actions only cover release and image publish; no PR-triggered test workflows"
    severity: "HIGH"
    effort: "8-12 hours"
quick_wins:
  - title: "Add codecov integration with coverage thresholds"
    effort: "2-4 hours"
    impact: "Enforce coverage standards on every PR with automated reporting"
  - title: "Create CLAUDE.md with test creation patterns"
    effort: "2-3 hours"
    impact: "Guide AI agents to produce consistent, Ginkgo/Gomega-based tests"
  - title: "Add pre-commit hooks for linting"
    effort: "1-2 hours"
    impact: "Catch lint issues before CI, reducing feedback loop time"
recommendations:
  priority_0:
    - "Add codecov.yml with coverage thresholds and PR reporting"
    - "Add downstream PR-triggered test workflows (unit + integration tests)"
  priority_1:
    - "Create comprehensive CLAUDE.md and .claude/rules/ for test automation"
    - "Add container image runtime validation tests (startup, health checks)"
    - "Add pre-commit hooks configuration"
  priority_2:
    - "Add HEALTHCHECK instruction to Dockerfiles"
    - "Consider adding contract tests for API boundaries"
    - "Add downstream CI caching strategies for faster builds"
---

# Quality Analysis: red-hat-data-services/kueue

## Executive Summary

- **Overall Score: 6.5/10**
- **Repository Type**: Kubernetes Operator (Go) — downstream fork of kubernetes-sigs/kueue
- **Jira Project**: RHOAIENG / Workload Orchestration
- **Tier**: Downstream

### Key Strengths
- **Exceptional integration/E2E test infrastructure**: 76 integration and 29 e2e test files with multi-version K8s testing (1.30, 1.31, 1.32), Kind clusters, multikueue, TAS, and performance testing
- **Strong static analysis**: 18 golangci-lint linters, comprehensive Dependabot covering gomod/npm/docker/github-actions, shellcheck
- **FIPS-ready Konflux builds**: `Dockerfile.konflux` uses `GOEXPERIMENT=strictfipsruntime` with `openshift-golang-builder` and UBI9 base
- **Multi-arch Tekton pipeline**: Builds for x86_64, ppc64le, s390x, arm64 via Konflux

### Critical Gaps
- No coverage tracking or enforcement (coverage profile generated but not reported or gated)
- No downstream PR-triggered test workflows (only release and image build workflows)
- No AI agent rules for test creation guidance

### Agent Rules Status: **Missing**

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 7/10 | 15% | 1.05 | 119 unit test files, Go testing + Ginkgo/Gomega |
| Integration/E2E | 9/10 | 20% | 1.80 | Comprehensive multi-version suite with Kind + envtest |
| Build Integration | 7/10 | 15% | 1.05 | Tekton/Konflux PR pipeline, kustomize overlays |
| Image Testing | 6/10 | 10% | 0.60 | Multi-stage builds, multi-arch, probes; no runtime validation |
| Coverage Tracking | 3/10 | 10% | 0.30 | Coverage generated but no reporting/enforcement |
| CI/CD Automation | 6/10 | 15% | 0.90 | Tekton PR builds + GH Actions release; limited downstream CI |
| Static Analysis | 8/10 | 10% | 0.80 | 18 linters, Dependabot, shellcheck, FIPS tags |
| Agent Rules | 0/10 | 5% | 0.00 | No CLAUDE.md or .claude/ directory |
| **Overall** | **6.5/10** | **100%** | **6.50** | |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: Coverage regressions go undetected; no visibility into PR-level coverage changes
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The Makefile generates `cover.out` via `--coverprofile` for unit tests, but there is no `.codecov.yml`, no codecov/coveralls GitHub Action, no coverage thresholds, and no PR coverage comments. Coverage data is produced but never consumed.

### 2. No Downstream PR-Triggered Test Workflows
- **Impact**: Test failures in downstream patches are only caught after merge; Tekton handles image builds but not test execution
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: GitHub Actions workflows are limited to: `odh-build-and-publish-kueue-image.yaml` (manual dispatch), `odh-release.yml` (tag push/dispatch), `krew-release.yml`, `openvex.yaml`, `sbom.yaml`. None run unit or integration tests on PRs. The upstream Prow CI covers the upstream repo, but downstream-specific changes lack CI test validation.

### 3. No AI Agent Rules
- **Impact**: AI-assisted development produces inconsistent tests without framework-specific guidance
- **Severity**: MEDIUM
- **Effort**: 3-4 hours
- **Details**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory exists. Given the complex Ginkgo/Gomega test patterns and envtest infrastructure, agent rules would significantly improve AI-generated test quality.

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
- Create `.codecov.yml` with coverage thresholds
- Add `codecov/codecov-action` to a PR workflow
- Configure patch and project coverage gates
- **Implementation**:
```yaml
# .codecov.yml
coverage:
  status:
    project:
      default:
        target: 50%
        threshold: 2%
    patch:
      default:
        target: 60%
```

### 2. Create CLAUDE.md with Test Patterns (2-3 hours)
- Document Ginkgo/Gomega patterns used in the codebase
- Include envtest setup conventions
- Reference integration test suite organization
- **Impact**: Consistent AI-generated tests matching existing patterns

### 3. Add Pre-commit Hooks (1-2 hours)
- Configure `.pre-commit-config.yaml` with golangci-lint and shellcheck
- Catch issues before CI submission
- **Implementation**:
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/golangci/golangci-lint
    rev: v1.62.0
    hooks:
      - id: golangci-lint
  - repo: https://github.com/shellcheck-py/shellcheck-py
    rev: v0.10.0
    hooks:
      - id: shellcheck
```

## Detailed Findings

### Unit Tests

**Score: 7/10**

- **Test files**: 119 unit test files (outside `test/` directory)
- **Source files**: 450 Go source files (excluding vendor)
- **Test-to-code ratio**: 0.26 (119/450)
- **Total test files**: 226 (including integration and e2e)
- **Framework**: Go standard testing + Ginkgo/Gomega (105 files use Ginkgo patterns)
- **Test isolation**: Ginkgo `BeforeEach`/`AfterEach` patterns used extensively

**Key test locations**:
- `pkg/cache/*_test.go` — Cache layer tests (snapshot, TAS, fair sharing, resource)
- `pkg/scheduler/scheduler_test.go` — Core scheduler logic
- `pkg/webhooks/*_test.go` — Webhook validation tests
- `pkg/queue/*_test.go` — Queue management tests
- `pkg/config/*_test.go` — Configuration validation
- `pkg/workload/*_test.go` — Workload handling tests
- `pkg/hierarchy/manager_test.go` — Hierarchy management
- `pkg/metrics/metrics_test.go` — Metrics tests

**Strengths**: Good coverage of core packages (cache, scheduler, webhooks, queue, config)
**Gaps**: Test-to-code ratio could be improved; no coverage enforcement

### Integration/E2E Tests

**Score: 9/10**

**Integration Tests** (76 files):
- `test/integration/singlecluster/` — Controller, webhook, scheduler, kueuectl, importer, TAS tests
- `test/integration/multikueue/` — Multi-cluster Kueue integration
- `test/integration/framework/` — Shared test framework
- Uses envtest (KUBEBUILDER_ASSETS) for K8s API server simulation
- Parallel execution: `INTEGRATION_NPROCS=4` (singlecluster), `INTEGRATION_NPROCS_MULTIKUEUE=3`
- Ginkgo JSON reporting with `ginkgo-top` analysis

**E2E Tests** (29 files):
- `test/e2e/singlecluster/` — 69 Ginkgo specs (visibility, TAS, pods, metrics, kueuectl, jobset, fair sharing)
- `test/e2e/multikueue/` — 19 Ginkgo specs (multi-cluster scenarios)
- `test/e2e/tas/` — 26 Ginkgo specs (topology-aware scheduling: jobs, jobsets, statefulsets, rayjobs, pytorch, mpi, appwrapper, leaderworkerset)
- `test/e2e/customconfigs/` — Custom configuration E2E tests
- `test/e2e/certmanager/` — Cert-manager integration E2E tests

**Multi-version K8s testing**:
- `E2E_K8S_VERSIONS = 1.30.10 1.31.6 1.32.3`
- Kind cluster creation with version-specific images
- Separate test targets for each version: `run-test-e2e-singlecluster-{version}`

**Performance Testing**:
- `test/performance/scheduler/` — Scheduler performance runner with scalability testing
- Generator config, checker tests, minimalkueue binary
- CPU profiling support, metrics scraping

**Strengths**: Exceptional test infrastructure rivaling upstream; multi-version, multi-cluster, performance testing
**Gaps**: Minimal — this is a gold-standard E2E setup

### Build Integration

**Score: 7/10**

**Tekton/Konflux Pipeline** (`.tekton/odh-kueue-controller-pull-request.yaml`):
- Triggered on: labels `kfbuild-all`/`kfbuild-kueue`, comment `/build-konflux`
- Multi-arch: x86_64, ppc64le, s390x, arm64
- Hermetic builds with gomod prefetch
- Uses `Dockerfile.konflux` (FIPS-ready, UBI9 base)
- Cancel-in-progress
- Source image and image index builds
- Image expires after 5 days for PR builds

**Kustomize Overlays**:
- `config/default/` — Default deployment
- `config/rhoai/` — RHOAI-specific overlay
- `config/components/` — CRDs, manager, RBAC, webhook, visibility
- `make install` / `make deploy` targets

**GitHub Actions Build**:
- `odh-build-and-publish-kueue-image.yaml` — Manual dispatch only, builds and pushes to Quay
- `CGO_ENABLED=1`, single platform (linux/amd64)

**Strengths**: Konflux PR pipeline with multi-arch and hermetic builds
**Gaps**: No automatic PR-trigger for GH Actions builds (label/comment-based Tekton only); no operator bundle validation in CI

### Image Testing

**Score: 6/10**

**Dockerfiles**:
- `Dockerfile` — Upstream: golang builder → distroless base, multi-stage
- `Dockerfile.konflux` — Downstream: openshift-golang-builder → UBI9 minimal, FIPS-enabled (`GOEXPERIMENT=strictfipsruntime`, `-tags strictfipsruntime`)
- `Dockerfile.rhoai` — RHOAI: UBI9 base, multi-stage with go mod download caching
- Additional: `hack/shellcheck/Dockerfile`, `hack/debugpod/Dockerfile`, `cmd/importer/Dockerfile`, `cmd/experimental/kueue-viz/` Dockerfiles

**Multi-arch**:
- Tekton pipeline builds for 4 architectures
- Upstream Dockerfile uses `BUILDPLATFORM`/`TARGETARCH` args

**Health Probes**:
- `config/components/manager/manager.yaml` defines livenessProbe and readinessProbe
- No HEALTHCHECK instruction in Dockerfiles

**Strengths**: Multi-stage builds, FIPS-ready Konflux image, multi-arch, proper probes in K8s manifests
**Gaps**: No container runtime validation tests (no Testcontainers, no `docker run` tests), no HEALTHCHECK in Dockerfiles

### Coverage Tracking

**Score: 3/10**

**What exists**:
- Makefile `test` target generates `cover.out` via `--coverprofile` and `-coverpkg=./...`
- Unit tests produce JUnit XML via `gotestsum`

**What's missing**:
- No `.codecov.yml` or codecov integration
- No coverage thresholds or minimum requirements
- No PR coverage reporting or comments
- No coverage gate enforcement
- Coverage data is generated locally but never published or tracked over time

### CI/CD Automation

**Score: 6/10**

**Workflow Inventory**:
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `odh-build-and-publish-kueue-image.yaml` | workflow_dispatch | Build + push image to Quay |
| `odh-release.yml` | workflow_dispatch / tag push | Compile e2e tests + create GH release |
| `krew-release.yml` | — | Krew plugin release |
| `openvex.yaml` | — | OpenVEX generation |
| `sbom.yaml` | — | SBOM generation |

**Tekton Pipeline**:
- PR build via Konflux (label/comment triggered)
- Cancel-in-progress concurrency control

**Upstream CI**:
- `cloudbuild.yaml` — Google Cloud Build for staging images
- Upstream Prow CI via kubernetes-sigs/kueue (not replicated downstream)

**Test Automation**:
- Integration tests: `make test-integration` with envtest, parallelized (NPROCS=4)
- E2E tests: `make test-e2e` with Kind clusters, multi-version
- Performance tests: `make test-performance-scheduler`
- All test automation available via Makefile but not triggered in downstream CI workflows

**Strengths**: Rich Makefile test targets, performance testing infrastructure, Tekton pipeline
**Gaps**: No downstream PR-triggered test workflows; no concurrency control or caching in GH Actions; test automation exists but isn't wired to downstream CI

### Static Analysis

**Score: 8/10**

#### Linting
- **golangci-lint** (`.golangci.yaml`): 18 linters enabled
  - `copyloopvar`, `dupword`, `durationcheck`, `fatcontext`, `gci`, `ginkgolinter`, `gocritic`, `goheader`, `govet`, `loggercheck`, `misspell`, `nilerr`, `nilnesserr`, `nolintlint`, `perfsprint`, `revive`, `unconvert`, `makezero`
  - Custom settings for `gocritic`, `gci`, `nolintlint` (requires specific linter + explanation), `revive`
  - Excludes vendor and bin directories
- **Shellcheck**: `.shellcheckrc` configuration, `make shell-lint` target
- **Helm linting**: `make helm-lint` target
- Makefile targets: `ci-lint`, `lint-fix`, `shell-lint`, `helm-lint`, `helm-verify`

#### FIPS Compatibility
- **Source code**: No non-FIPS crypto imports detected (`crypto/md5`, `crypto/des`, `crypto/rc4`)
- **Build tags**: `Dockerfile.konflux` uses `GOEXPERIMENT=strictfipsruntime` and `-tags strictfipsruntime`
- **Base images**: `Dockerfile.konflux` uses `openshift-golang-builder` + UBI9 minimal (FIPS-capable); `Dockerfile.rhoai` uses UBI9
- **Upstream**: `Dockerfile` uses distroless (not FIPS-capable, but appropriate for upstream)

#### Dependency Alerts
- **Dependabot** (`.github/dependabot.yml`): Comprehensive configuration
  - `gomod`: root, `/hack/internal/tools`, `/site`, `/cmd/experimental/kueue-viz/backend`
  - `npm`: `/site`, `/cmd/experimental/kueue-viz/frontend`
  - `github-actions`: root (daily interval)
  - `docker`: `/hack/shellcheck`, `/cmd/experimental/kueue-viz/frontend`
  - Grouped updates for Kubernetes deps, with ignore rules for major/minor K8s versions
  - Labels: `ok-to-test`, `release-note-none`

**Strengths**: Comprehensive linting, strong Dependabot config, FIPS compliance in Konflux build
**Gaps**: No pre-commit hooks, no Renovate (Dependabot is sufficient)

### Agent Rules

**Score: 0/10**

- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **Coverage**: No test type rules exist
- **Quality**: N/A
- **Gaps**: Complete absence of AI agent guidance

**Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
- Unit test patterns (Go testing + Ginkgo/Gomega)
- Integration test patterns (envtest, Ginkgo suites)
- E2E test patterns (Kind cluster setup, multi-version)
- Webhook validation test patterns
- Controller test patterns with reconciler mocking

## Recommendations

### Priority 0 (Critical)

1. **Add codecov integration with coverage thresholds**
   - Create `.codecov.yml` with project target (e.g., 50%) and patch target (e.g., 60%)
   - Add a PR workflow that runs unit tests and uploads coverage
   - Enforce coverage gates to prevent regression
   - Effort: 4-6 hours

2. **Add downstream PR-triggered test workflows**
   - Create a GitHub Actions workflow triggered on `pull_request` that runs `make test` and `make ci-lint`
   - Optionally add `make test-integration` for critical PRs
   - Wire up coverage upload in the same workflow
   - Effort: 8-12 hours

### Priority 1 (High Value)

3. **Create comprehensive CLAUDE.md and agent rules**
   - Add `CLAUDE.md` with project conventions, test patterns, and build instructions
   - Add `.claude/rules/` with test creation rules for unit, integration, and e2e tests
   - Include Ginkgo/Gomega patterns, envtest setup, webhook test conventions
   - Effort: 3-4 hours

4. **Add container image runtime validation**
   - Test that built images start correctly and respond to health checks
   - Add image startup tests to CI pipeline
   - Effort: 4-6 hours

5. **Add pre-commit hooks**
   - Configure `.pre-commit-config.yaml` with golangci-lint and shellcheck
   - Reduce CI feedback loop for lint issues
   - Effort: 1-2 hours

### Priority 2 (Nice-to-Have)

6. **Add HEALTHCHECK to Dockerfiles**
   - Include HEALTHCHECK instructions for container runtime validation
   - Complements existing K8s liveness/readiness probes
   - Effort: 1 hour

7. **Add downstream CI caching**
   - Add Go module caching to GitHub Actions workflows
   - Reduce build times for downstream workflows
   - Effort: 2-3 hours

8. **Consider contract tests for CRD API boundaries**
   - Add API compatibility tests between Kueue CRD versions
   - Ensure backward compatibility during upgrades
   - Effort: 8-12 hours

## Comparison to Gold Standards

| Dimension | kueue | odh-dashboard | notebooks | kserve |
|-----------|-------|---------------|-----------|--------|
| Unit Tests | 7/10 | 9/10 | 6/10 | 8/10 |
| Integration/E2E | 9/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 7/10 | 8/10 | 7/10 | 7/10 |
| Image Testing | 6/10 | 7/10 | 9/10 | 6/10 |
| Coverage Tracking | 3/10 | 8/10 | 5/10 | 8/10 |
| CI/CD Automation | 6/10 | 9/10 | 8/10 | 8/10 |
| Static Analysis | 8/10 | 8/10 | 6/10 | 7/10 |
| Agent Rules | 0/10 | 7/10 | 2/10 | 3/10 |
| **Overall** | **6.5** | **8.5** | **6.8** | **7.4** |

### Key Differences from Gold Standards

**vs. odh-dashboard**:
- Missing: Coverage enforcement, PR-triggered test workflows, agent rules
- Equal/stronger: Integration/E2E depth, static analysis configuration

**vs. notebooks**:
- Stronger: E2E infrastructure, linting depth, FIPS in Konflux
- Weaker: No image runtime validation, no coverage tracking

**vs. kserve**:
- Equal: E2E/integration depth, build integration
- Weaker: Coverage tracking, CI automation in downstream

## File Paths Reference

### CI/CD
- `.github/workflows/odh-build-and-publish-kueue-image.yaml` — Manual image build/push
- `.github/workflows/odh-release.yml` — Release workflow
- `.github/workflows/krew-release.yml` — Krew plugin release
- `.github/workflows/openvex.yaml` — OpenVEX generation
- `.github/workflows/sbom.yaml` — SBOM generation
- `.tekton/odh-kueue-controller-pull-request.yaml` — Konflux PR pipeline
- `cloudbuild.yaml` — Google Cloud Build config (upstream)

### Testing
- `test/e2e/singlecluster/` — Single-cluster E2E tests
- `test/e2e/multikueue/` — Multi-cluster E2E tests
- `test/e2e/tas/` — Topology-aware scheduling E2E
- `test/e2e/customconfigs/` — Custom config E2E
- `test/e2e/certmanager/` — Cert-manager E2E
- `test/integration/singlecluster/` — Integration tests (controller, webhook, scheduler, kueuectl, importer, TAS)
- `test/integration/multikueue/` — Multikueue integration tests
- `test/integration/framework/` — Test framework utilities
- `test/performance/scheduler/` — Performance/scalability tests
- `Makefile-test.mk` — All test targets and configuration

### Build
- `Dockerfile` — Upstream image (distroless base)
- `Dockerfile.konflux` — Konflux/FIPS image (UBI9 + strictfipsruntime)
- `Dockerfile.rhoai` — RHOAI image (UBI9)
- `Makefile` — Build targets
- `Makefile-deps.mk` — Dependency management

### Code Quality
- `.golangci.yaml` — 18 linters configured
- `.shellcheckrc` — Shell lint configuration
- `.github/dependabot.yml` — Dependency update automation

### Configuration
- `config/default/` — Default kustomize overlay
- `config/rhoai/` — RHOAI-specific overlay
- `config/components/manager/manager.yaml` — Manager deployment (with probes)
- `config/components/crd/` — CRD definitions
