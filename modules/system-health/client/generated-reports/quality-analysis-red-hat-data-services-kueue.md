---
repository: "red-hat-data-services/kueue"
overall_score: 7.4
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "100 unit test files across pkg/ with Go testing + Gomega; coverage profile generated but no enforcement threshold"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "76 integration + 29 E2E test files; multi-version K8s testing (1.30-1.32); envtest + Kind; Ginkgo/Gomega BDD; 400+ test specs"
  - dimension: "Build Integration"
    score: 5.0
    status: "Konflux Tekton PR pipeline with multi-arch builds; no PR-time unit/integration/E2E test execution; post-merge test gap"
  - dimension: "Image Testing"
    score: 5.5
    status: "Three Dockerfiles (upstream, Konflux, RHOAI); multi-arch (x86_64, ppc64le, s390x, arm64); no runtime validation or startup testing"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "Cover.out generated via make test but no codecov/coveralls integration; no PR coverage gating or reporting"
  - dimension: "CI/CD Automation"
    score: 5.5
    status: "Upstream CI lives in kubernetes-sigs/kueue; fork has only manual dispatch workflows + Tekton PR build; no automated test workflows"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No .claude/ directory, no CLAUDE.md, no agent rules or test automation guidance"
critical_gaps:
  - title: "No automated test execution in PR workflows"
    impact: "Unit, integration, and E2E tests are never run automatically on PRs in this fork; regressions can merge undetected"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Coverage profile is generated locally but not uploaded or gated; coverage can silently decrease"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No security scanning in CI"
    impact: "No Trivy, CodeQL, gosec, or SAST in any workflow; Snyk config exists but is not wired into CI"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container runtime validation"
    impact: "Images built via Konflux but never tested for startup, health, or functional correctness before merge"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents have no guidance on test patterns, coding standards, or quality gates for this repo"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add codecov integration to unit test workflow"
    effort: "2-3 hours"
    impact: "PR-level coverage reporting and threshold enforcement"
  - title: "Add Trivy container scanning to Tekton PR pipeline"
    effort: "1-2 hours"
    impact: "Catch CVEs in base images and dependencies before merge"
  - title: "Create GitHub Actions workflow for unit tests on PRs"
    effort: "2-3 hours"
    impact: "Automated regression detection on every PR"
  - title: "Generate basic agent rules with /test-rules-generator"
    effort: "1-2 hours"
    impact: "Consistent AI-generated tests following repo patterns"
  - title: "Add golangci-lint workflow for PRs"
    effort: "1 hour"
    impact: "Automated lint enforcement; config already exists and is comprehensive"
recommendations:
  priority_0:
    - "Create a GitHub Actions PR workflow that runs 'make test' (unit tests with coverage) and 'make test-integration' on every PR"
    - "Add codecov/coveralls integration with minimum coverage threshold (e.g., 70%) to prevent coverage regression"
    - "Add security scanning (Trivy + gosec) to the Tekton PR pipeline or a GitHub Actions workflow"
  priority_1:
    - "Add container runtime validation tests that verify image startup and health endpoint"
    - "Create comprehensive agent rules (.claude/rules/) covering unit test, integration test, and E2E test patterns"
    - "Wire Snyk integration into CI (config already exists at .snyk)"
    - "Add a golangci-lint GitHub Actions workflow to enforce the existing .golangci.yaml config on PRs"
  priority_2:
    - "Add performance regression testing to CI (framework already exists in test/performance/)"
    - "Implement pre-commit hooks for local development (gofmt, goimports, lint)"
    - "Add SBOM generation to the Tekton PR pipeline (workflow exists for upstream but not automated)"
---

# Quality Analysis: red-hat-data-services/kueue

## Executive Summary

- **Overall Score: 7.4/10**
- **Repository Type**: Kubernetes operator (Go) - fork of upstream `kubernetes-sigs/kueue`
- **Key Strengths**: Exceptional test infrastructure inherited from upstream (400+ Ginkgo specs across unit/integration/E2E/performance), multi-version K8s testing (1.30-1.32), multi-arch Konflux builds, comprehensive golangci-lint config with 17+ linters, well-structured test directories with envtest, Kind, and performance benchmarking
- **Critical Gaps**: The fork has almost no CI automation for tests - upstream CI lives in `kubernetes-sigs/kueue` Prow jobs but the Red Hat fork only has Tekton image builds and manual-dispatch workflows. No coverage tracking, no security scanning, no agent rules.
- **Agent Rules Status**: Missing - no `.claude/` directory or agent rules

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | 100 test files in pkg/; Go testing + Gomega; coverage profile generated but not tracked |
| Integration/E2E | 9.0/10 | 76 integration + 29 E2E files; multi-version K8s; envtest + Kind; Ginkgo BDD; 400+ specs |
| **Build Integration** | **5.0/10** | **Konflux Tekton PR builds with multi-arch; no test execution in PR pipeline** |
| Image Testing | 5.5/10 | Three Dockerfiles (upstream, Konflux, RHOAI); multi-arch; no runtime validation |
| Coverage Tracking | 4.0/10 | `cover.out` generated but no codecov/coveralls; no PR gates |
| CI/CD Automation | 5.5/10 | Fork-specific CI is minimal; relies on upstream Prow; Tekton for image builds only |
| Agent Rules | 0.0/10 | No .claude/ directory, no CLAUDE.md, no test automation guidance |

## Critical Gaps

### 1. No Automated Test Execution in PR Workflows
- **Impact**: Unit, integration, and E2E tests are never run automatically on PRs in this fork. Regressions from downstream patches can merge undetected.
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Details**: The fork has 5 GitHub Actions workflows, but none run tests:
  - `krew-release.yml` - Krew plugin release (release-triggered)
  - `odh-build-and-publish-kueue-image.yaml` - Manual dispatch image build
  - `odh-release.yml` - Manual dispatch release
  - `openvex.yaml` - Manual dispatch VEX generation
  - `sbom.yaml` - Manual dispatch SBOM generation
- **Upstream**: Tests run via Kubernetes Prow CI in `kubernetes-sigs/kueue`, but this fork doesn't replicate that.
- **Recommendation**: Create a PR-triggered GitHub Actions workflow running `make test` and `make test-integration-baseline`.

### 2. No Coverage Tracking or Enforcement
- **Impact**: Coverage profile is generated by `make test` (`-coverprofile cover.out`) but never uploaded or gated. Coverage can silently regress.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Recommendation**: Add codecov integration with PR comments and minimum threshold.

### 3. No Security Scanning in CI
- **Impact**: No automated vulnerability scanning on PRs or periodically. Snyk config (`.snyk`) exists but is not wired into any workflow.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**:
  - `.snyk` file exists but only as a policy (excludes `cmd/kueuectl/**` and `test/**`)
  - No Trivy, CodeQL, gosec, Semgrep, or Gitleaks in any workflow
  - Dependabot is referenced in SECURITY-INSIGHTS.yaml but not configured in this fork
  - OpenVEX and SBOM workflows exist but are manual-dispatch only

### 4. No Container Runtime Validation
- **Impact**: Images are built via Konflux but never tested for startup, health check, or functional correctness.
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: The Tekton PR pipeline (`odh-kueue-controller-pull-request.yaml`) builds multi-arch images (x86_64, ppc64le, s390x, arm64) but only validates the build succeeds, not that the resulting image works.

### 5. No Agent Rules for AI-Assisted Development
- **Impact**: AI agents generating tests or code have no repo-specific guidance.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours

## Quick Wins

### 1. Add Codecov Integration (2-3 hours)
- **Impact**: PR-level coverage reporting and threshold enforcement
- **Implementation**: Add `codecov/codecov-action@v4` step after `make test` in a new PR workflow

### 2. Add Trivy Container Scanning (1-2 hours)
- **Impact**: Catch CVEs in base images and Go dependencies before merge
- **Implementation**: Add `aquasecurity/trivy-action@master` step to Tekton pipeline or GitHub Actions

### 3. Create PR Unit Test Workflow (2-3 hours)
- **Impact**: Automated regression detection on every PR
- **Implementation**:
```yaml
name: Unit Tests
on:
  pull_request:
    branches: [main, release-*]
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
          file: bin/cover.out
```

### 4. Generate Agent Rules (1-2 hours)
- **Impact**: Consistent AI-generated tests following existing patterns
- **Implementation**: Run `/test-rules-generator` on this repository

### 5. Add golangci-lint Workflow (1 hour)
- **Impact**: Enforce existing comprehensive lint config on PRs
- **Implementation**: Add `golangci/golangci-lint-action@v6` workflow

## Detailed Findings

### CI/CD Pipeline

#### GitHub Actions Workflows (5 total)
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `krew-release.yml` | `release` (non-prerelease) | Publish krew plugin |
| `odh-build-and-publish-kueue-image.yaml` | `workflow_dispatch` | Build and publish to Quay |
| `odh-release.yml` | `workflow_dispatch` / `push tags` | Compile E2E tests and release |
| `openvex.yaml` | `workflow_dispatch` | Generate OpenVEX data |
| `sbom.yaml` | `workflow_dispatch` | Generate SBOM |

**Key Finding**: No workflow runs on `pull_request` events. All test execution is manual or relies on upstream CI.

#### Tekton/Konflux Pipeline
- **File**: `.tekton/odh-kueue-controller-pull-request.yaml`
- **Trigger**: PR events (on-event: pull_request), manual (`/build-konflux` comment), or label (`kfbuild-all`, `kfbuild-kueue`)
- **Builds**: Multi-arch container image (x86_64, ppc64le, s390x, arm64)
- **Dockerfile**: `Dockerfile.konflux` (uses `brew.registry.redhat.io` builder, FIPS-compliant with `strictfipsruntime`)
- **Hermetic**: Yes
- **Missing**: No test execution, no vulnerability scanning, no SBOM in PR pipeline

### Test Coverage

#### Unit Tests (7.5/10)
- **Files**: 100 test files in `pkg/`
- **Framework**: Go testing + `gomega` matchers + `go-cmp`
- **Coverage**: Generated via `make test` with `-coverpkg=./... -coverprofile cover.out`
- **JUnit**: Output via `gotestsum --junitfile junit.xml`
- **Race Detection**: Enabled (`-race` flag)
- **Key Test Areas**:
  - `pkg/cache/` - 8 test files (cache, snapshot, TAS, fair sharing, resource)
  - `pkg/webhooks/` - 3 test files (workload, resource flavor, cluster queue)
  - `pkg/scheduler/` - 1 test file (scheduler)
  - `pkg/queue/` - 2 test files (manager, cluster queue)
  - `pkg/workload/` - 3 test files (workload, resources, admission checks)
  - `pkg/config/` - 2 test files (config, validation)
- **Gap**: No coverage threshold enforcement

#### Integration Tests (9.0/10)
- **Files**: 76 test files across `test/integration/`
- **Total Lines**: ~34,000 lines of integration test code
- **Framework**: Ginkgo v2 + Gomega + envtest (kubebuilder)
- **Parallelism**: 4 processes (singlecluster), 3 processes (multikueue)
- **Categories**:
  - `singlecluster/controller/` - Core controller tests (jobs, admission checks, job framework)
  - `singlecluster/scheduler/` - Scheduler tests including fair sharing, pods-ready
  - `singlecluster/webhook/` - Webhook validation tests (core, jobs)
  - `singlecluster/tas/` - Topology-Aware Scheduling tests
  - `singlecluster/kueuectl/` - CLI tool tests
  - `singlecluster/importer/` - Importer tests
  - `multikueue/` - Multi-cluster queue tests
- **Key Spec Counts**:
  - Scheduler: 42 specs
  - Job controller: 33 specs
  - TAS: 27 specs
  - Pod controller: 23 specs
  - Provisioning: 17 specs
  - Multikueue jobs: 17 specs
- **Strengths**: Baseline vs. extended split (`--label-filter="!slow && !redundant"`), JUnit + JSON reports, ginkgo-top performance analysis

#### E2E Tests (9.0/10)
- **Files**: 29 test files across `test/e2e/`
- **Total Lines**: ~9,400 lines of E2E test code
- **Framework**: Ginkgo v2 + Kind clusters
- **Multi-version**: K8s 1.30.10, 1.31.6, 1.32.3
- **Categories**:
  - `singlecluster/` - Core E2E (jobs, pods, metrics, visibility, deployments, stateful sets, LeaderWorkerSet)
  - `multikueue/` - Multi-cluster E2E
  - `tas/` - Topology-Aware Scheduling E2E (jobs, pod groups, ray jobs)
  - `certmanager/` - Cert-manager integration E2E
  - `customconfigs/` - Custom configuration E2E
- **Strengths**: Multiple E2E target variants (singlecluster, multikueue, TAS, customconfigs, certmanager), Ginkgo JSON reports + top analysis

#### Performance Tests
- **Infrastructure**: Complete performance testing framework in `test/performance/`
- **Scheduler benchmarks**: Generator-based workload simulation with envtest
- **Runner**: Custom `performance-scheduler-runner` binary
- **MinimalKueue**: Lightweight Kueue binary for benchmarking
- **Metrics scraping**: Prometheus metrics collection during tests
- **CPU profiling**: Optional via `SCALABILITY_CPU_PROFILE`
- **Retry mechanism**: Performance tests retry up to 2 times
- **E2E performance**: Pod groups and jobs performance scenarios

### Code Quality

#### Linting (8.0/10)
- **Tool**: golangci-lint with `.golangci.yaml`
- **Enabled Linters** (17):
  - `copyloopvar`, `dupword`, `durationcheck`, `fatcontext`
  - `gci` (import ordering with kueue-specific prefix)
  - `ginkgolinter` (Ginkgo test style enforcement)
  - `gocritic` (dupImport, stringsCompare)
  - `goheader` (license header enforcement)
  - `govet` (with nilness)
  - `loggercheck`, `misspell`, `nilerr`, `nilnesserr`
  - `nolintlint` (requires specific linter + explanation)
  - `perfsprint`, `revive`, `unconvert`, `makezero`
- **Strengths**: Strict nolint requirements, Ginkgo-specific linting, comprehensive import ordering
- **Gap**: Not run in any CI workflow in this fork

#### Shell Checking
- `.shellcheckrc` exists for shell script linting
- Dedicated shellcheck Dockerfile in `hack/shellcheck/`

#### Code Generation
- `update-codegen.sh` for API code generation
- Helm chart updates via `update-helm.sh`
- TOC generation and verification

### Container Images

#### Dockerfiles (3)
| File | Purpose | Base Image | FIPS |
|------|---------|------------|------|
| `Dockerfile` | Upstream | `golang:1.24.13` / `distroless/static:nonroot` | No |
| `Dockerfile.konflux` | Konflux/Tekton | `brew.registry.redhat.io` builder / `ubi9-minimal` | Yes (`strictfipsruntime`) |
| `Dockerfile.rhoai` | RHOAI | `rh-osbs/openshift-golang-builder` / `ubi9` | No |

- **Multi-arch**: x86_64, ppc64le, s390x, arm64 (Tekton pipeline)
- **Multi-stage**: All three use multi-stage builds
- **User**: Non-root (65532:65532)
- **Gap**: No runtime validation, startup testing, or health check verification

#### Additional Dockerfiles
- `hack/debugpod/Dockerfile` - Debug pod for troubleshooting
- `hack/internal/test-images/ray/Dockerfile` - Test Ray image
- `cmd/importer/Dockerfile` - Importer tool
- `cmd/experimental/kueue-viz/` - Frontend + backend Dockerfiles for Kueue visualizer

### Security

#### Current State
- **Snyk**: Policy file (`.snyk`) exists, excludes `cmd/kueuectl/**` and `test/**`
- **OpenVEX**: Templates in `.openvex/`; manual dispatch workflow
- **SBOM**: Manual dispatch workflow using `kubernetes-sigs/release-actions/setup-bom`
- **SECURITY-INSIGHTS.yaml**: References Dependabot, HackerOne bug bounty, security contacts
- **SECURITY.md**: Points to Kubernetes security policies
- **FIPS**: Konflux Dockerfile uses `strictfipsruntime` build tag

#### Missing
- No Trivy or container scanning in CI
- No CodeQL or SAST in any workflow
- No gosec or Semgrep
- No Gitleaks or secret detection
- No Dependabot configuration in this fork
- Security scanning is entirely manual

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None - no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**:
  - No unit test creation rules (Go testing + Gomega patterns)
  - No integration test rules (envtest + Ginkgo patterns)
  - No E2E test rules (Kind cluster + Ginkgo patterns)
  - No webhook test rules
  - No performance test rules
- **Recommendation**: Generate rules using `/test-rules-generator` covering:
  - Go unit test patterns with `gomega` matchers
  - Ginkgo BDD integration test patterns with envtest
  - E2E test patterns with Kind clusters
  - Webhook validation test patterns
  - Performance test patterns

## Recommendations

### Priority 0 (Critical)

1. **Create PR-triggered test workflow** - Add GitHub Actions workflow that runs `make test` and `make test-integration-baseline` on every PR. This is the single most impactful improvement.
2. **Add coverage tracking** - Integrate codecov with minimum threshold enforcement. Coverage profile is already generated; just needs upload and gating.
3. **Add security scanning** - Wire Trivy container scanning into Tekton pipeline and add gosec to a GitHub Actions workflow.

### Priority 1 (High Value)

4. **Add container runtime validation** - Test that built images start correctly and respond to health checks.
5. **Create agent rules** - Use `/test-rules-generator` to create comprehensive `.claude/rules/` covering all test types.
6. **Wire Snyk into CI** - Policy file exists but is not connected to any automated workflow.
7. **Add golangci-lint workflow** - Comprehensive config exists at `.golangci.yaml` with 17 linters but is not enforced in CI.

### Priority 2 (Nice-to-Have)

8. **Automate performance regression testing** - Framework exists; wire into periodic CI.
9. **Add pre-commit hooks** - gofmt, goimports, lint for local development.
10. **Automate SBOM and OpenVEX** - Currently manual dispatch; should run on release tags automatically.

## Comparison to Gold Standards

| Dimension | kueue (fork) | odh-dashboard | notebooks | kserve |
|-----------|-------------|---------------|-----------|--------|
| Unit Tests | 7.5 - Coverage generated, no tracking | 9.0 - Jest + coverage gates | 6.0 - Notebook-focused | 8.5 - Coverage enforcement |
| Integration/E2E | 9.0 - Excellent test infra (inherited) | 9.0 - Cypress + contract tests | 7.0 - Image-focused | 9.0 - Multi-version |
| Build Integration | 5.0 - Tekton build only, no test | 8.0 - Full PR validation | 7.0 - Image build + test | 7.0 - Build + test |
| Image Testing | 5.5 - Multi-arch, no runtime | 7.0 - Startup + health | 9.0 - 5-layer validation | 6.0 - Basic |
| Coverage Tracking | 4.0 - Generated, not tracked | 9.0 - Codecov + thresholds | 5.0 - No tracking | 8.0 - Codecov |
| CI/CD Automation | 5.5 - Minimal fork-specific CI | 9.0 - Comprehensive | 8.0 - Matrix builds | 8.0 - Prow + GHA |
| Agent Rules | 0.0 - None | 8.0 - Comprehensive | 2.0 - Basic | 3.0 - Minimal |

**Key Insight**: This fork inherits an outstanding test infrastructure from upstream `kubernetes-sigs/kueue` (one of the best-tested K8s projects), but the fork-specific CI is almost entirely missing. The test code exists and is mature; the gap is in automation and enforcement.

## File Paths Reference

### CI/CD
- `.github/workflows/krew-release.yml` - Krew plugin release
- `.github/workflows/odh-build-and-publish-kueue-image.yaml` - Manual image build
- `.github/workflows/odh-release.yml` - Manual release
- `.github/workflows/openvex.yaml` - Manual VEX generation
- `.github/workflows/sbom.yaml` - Manual SBOM generation
- `.tekton/odh-kueue-controller-pull-request.yaml` - Konflux PR pipeline

### Testing
- `Makefile-test.mk` - All test targets
- `test/integration/singlecluster/` - Singlecluster integration tests (envtest)
- `test/integration/multikueue/` - Multi-cluster integration tests
- `test/e2e/singlecluster/` - Singlecluster E2E tests (Kind)
- `test/e2e/multikueue/` - Multi-cluster E2E tests
- `test/e2e/tas/` - Topology-Aware Scheduling E2E tests
- `test/e2e/certmanager/` - Cert-manager E2E tests
- `test/performance/` - Performance benchmarks
- `pkg/**/*_test.go` - Unit tests (100 files)
- `hack/e2e-test.sh` - E2E test runner script
- `hack/multikueue-e2e-test.sh` - Multi-cluster E2E runner

### Code Quality
- `.golangci.yaml` - 17 linters configured
- `.shellcheckrc` - Shell script linting config

### Container Images
- `Dockerfile` - Upstream (distroless)
- `Dockerfile.konflux` - Konflux/FIPS (UBI9-minimal)
- `Dockerfile.rhoai` - RHOAI (UBI9)

### Security
- `.snyk` - Snyk policy (not wired to CI)
- `.openvex/` - OpenVEX templates
- `SECURITY-INSIGHTS.yaml` - Security metadata
- `SECURITY.md` - Security policy
