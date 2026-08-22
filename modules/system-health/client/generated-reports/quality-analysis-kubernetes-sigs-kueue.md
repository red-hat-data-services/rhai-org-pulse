---
repository: "kubernetes-sigs/kueue"
overall_score: 7.3
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Excellent test-to-code ratio (0.55) with 437 test files, gotestsum, sharding support, and coverage profiling"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Exceptional coverage with 200+ test files, multi-version K8s testing (1.34-1.36), Kind clusters, envtest, upgrade and performance tests"
  - dimension: "Build Integration"
    score: 7.0
    status: "Multi-stage Docker builds, multi-arch support, CloudBuild pipelines, but no PR-time image build validation"
  - dimension: "Image Testing"
    score: 6.0
    status: "Distroless base image, multi-arch builds, health probes in K8s manifests, but no container runtime validation"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "Coverage profiles generated via --coverprofile but no codecov integration, thresholds, or PR reporting"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "Prow-based CI with Make infrastructure, test sharding, Ginkgo parallelization, comprehensive verify pipeline"
  - dimension: "Static Analysis"
    score: 7.0
    status: "golangci-lint v2 with 21+ linters, Dependabot across 4 ecosystems, no pre-commit hooks or FIPS configuration"
  - dimension: "Agent Rules"
    score: 9.0
    status: "CLAUDE.md + AGENTS.md with 6 operational skills and 30+ code review skills covering security, architecture, and code style"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Coverage regressions go undetected; no PR-level coverage feedback for contributors"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No PR-time container image build validation"
    impact: "Image build failures only discovered post-merge via CloudBuild"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "No container runtime validation"
    impact: "Image startup issues and runtime failures not caught until deployment"
    severity: "MEDIUM"
    effort: "6-10 hours"
  - title: "No FIPS build configuration"
    impact: "Binary not built with FIPS-compliant crypto; distroless base not FIPS-capable"
    severity: "MEDIUM"
    effort: "8-16 hours"
quick_wins:
  - title: "Add Codecov integration with PR reporting"
    effort: "2-4 hours"
    impact: "Immediate visibility into coverage changes per PR with threshold enforcement"
  - title: "Add pre-commit hooks for linting and formatting"
    effort: "1-2 hours"
    impact: "Catch formatting and lint issues before CI, faster developer feedback"
  - title: "Add PR-triggered Docker build step to Prow"
    effort: "2-4 hours"
    impact: "Catch image build failures before merge"
recommendations:
  priority_0:
    - "Implement Codecov integration with .codecov.yml, coverage thresholds, and PR coverage comments"
    - "Add PR-time container image build validation to catch build failures pre-merge"
  priority_1:
    - "Add container runtime validation tests (image startup, binary execution check)"
    - "Configure pre-commit hooks for golangci-lint and gofmt"
    - "Consider FIPS build configuration for downstream consumption (UBI base, boringcrypto)"
  priority_2:
    - "Expand t.Parallel() usage across unit tests for faster execution"
    - "Add HEALTHCHECK instruction to Dockerfile for container orchestration"
    - "Consider adding contract tests for API boundaries"
---

# Quality Analysis: kubernetes-sigs/kueue

## Executive Summary

- **Overall Score: 7.3/10**
- **Repository Type**: Kubernetes Operator (Go, batch job queueing system)
- **Primary Language**: Go 1.26
- **Framework**: controller-runtime, Ginkgo/Gomega
- **Jira**: RHOAIENG / Workload Orchestration (upstream tier)

**Key Strengths**: Kueue demonstrates exceptional testing practices with a 0.55 test-to-code ratio, comprehensive E2E testing across multiple Kubernetes versions, and an outstanding set of agent rules with 30+ code review skills. The Prow-based CI infrastructure with Make-driven test sharding and parallelization is mature and well-organized.

**Critical Gaps**: The most significant gap is the absence of coverage tracking and enforcement — coverage profiles are generated but never reported or gated. Additionally, there is no PR-time container image build validation, and no FIPS build configuration for downstream Red Hat consumption.

**Agent Rules Status**: Present and comprehensive — CLAUDE.md references AGENTS.md which includes AI contribution policy, 6 operational skills, and 30+ granular code review skills.

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.0/10 | 15% | 1.20 | Excellent test-to-code ratio with sharding and coverage profiling |
| Integration/E2E | 9.0/10 | 20% | 1.80 | Exceptional multi-version, multi-cluster E2E with upgrade tests |
| Build Integration | 7.0/10 | 15% | 1.05 | Multi-stage Docker builds, CloudBuild, but no PR-time validation |
| Image Testing | 6.0/10 | 10% | 0.60 | Distroless base, multi-arch, but no runtime validation |
| Coverage Tracking | 3.0/10 | 10% | 0.30 | Profiles generated but no reporting or enforcement |
| CI/CD Automation | 8.0/10 | 15% | 1.20 | Prow + Make with sharding, parallelization, verify pipeline |
| Static Analysis | 7.0/10 | 10% | 0.70 | 21+ linters, Dependabot, no pre-commit or FIPS |
| Agent Rules | 9.0/10 | 5% | 0.45 | AGENTS.md with 36+ skills and AI contribution policy |
| **Overall** | **7.3/10** | **100%** | **7.30** | |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: Coverage regressions go undetected; no PR-level coverage feedback for contributors
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The `make test` target generates `--coverprofile` output, but there is no `.codecov.yml`, no codecov/coveralls GitHub Action, and no coverage threshold enforcement. Contributors receive zero coverage feedback on PRs.
- **Evidence**: No `.codecov.yml`, no `codecov` references in `.github/workflows/`

### 2. No PR-time Container Image Build Validation
- **Impact**: Image build failures only discovered post-merge via CloudBuild postsubmit
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: The `cloudbuild.yaml` is postsubmit only. GitHub workflows do not include Docker image building. Dockerfile changes can break the build but won't be caught until after merge.
- **Evidence**: `cloudbuild.yaml` triggered on postsubmit only; no `docker build` in PR workflows

### 3. No Container Runtime Validation
- **Impact**: Image startup issues and runtime failures not caught until deployment
- **Severity**: MEDIUM
- **Effort**: 6-10 hours
- **Details**: While the E2E tests deploy to Kind clusters (which implicitly tests the image), there's no explicit container startup validation or Testcontainers-based testing. No HEALTHCHECK instruction in Dockerfile.

### 4. No FIPS Build Configuration
- **Impact**: Binary not built with FIPS-compliant crypto; distroless base not FIPS-capable
- **Severity**: MEDIUM
- **Effort**: 8-16 hours
- **Details**: No FIPS build tags (`-tags=fips`, `GOEXPERIMENT=boringcrypto`), no UBI base image. The distroless base (`gcr.io/distroless/static:nonroot`) is not FIPS-capable. No non-compliant crypto imports were found, which is positive.

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
- **Impact**: Immediate visibility into coverage changes per PR with threshold enforcement
- **Implementation**:
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
  comment:
    layout: "reach, diff, flags, files"
    behavior: default
  ```
  Add codecov upload step to Prow job or create a GitHub Action triggered on PR.

### 2. Add Pre-commit Hooks (1-2 hours)
- **Impact**: Catch formatting and lint issues before CI, faster developer feedback
- **Implementation**:
  ```yaml
  # .pre-commit-config.yaml
  repos:
    - repo: https://github.com/golangci/golangci-lint
      rev: v2.x.x
      hooks:
        - id: golangci-lint
    - repo: https://github.com/dnephin/pre-commit-golang
      rev: master
      hooks:
        - id: go-fmt
  ```

### 3. Add PR-triggered Docker Build (2-4 hours)
- **Impact**: Catch image build failures before merge
- **Implementation**: Add `make image-local-build` to Prow presubmit or create a GitHub Actions workflow triggered on PR for Dockerfile changes.

## Detailed Findings

### Unit Tests

**Score: 8.0/10**

- **Test Files**: 437 test files vs 783 source files (0.55 ratio — excellent)
- **Lines of Test Code**: 174,293 lines of unit test code
- **Framework**: Go standard testing + Ginkgo/Gomega (v2.32.0)
- **Test Runner**: gotestsum with JUnit XML output
- **Coverage**: `--coverprofile` flag generates coverage data
- **Sharding**: Unit test sharding via `UNIT_TOTAL_SHARDS` / `UNIT_SHARD_INDEX` for parallel CI
- **Race Detection**: `--race` flag enabled by default
- **Mock Generation**: mockgen for interface mocking (`internal/mocks/`)

**Strengths**:
- Outstanding test-to-code ratio
- Sophisticated sharding support for CI parallelization
- Race detection enabled by default
- gotestsum provides structured test output

**Gaps**:
- Very limited `t.Parallel()` usage (only 1 file) — sequential test execution within packages
- Coverage generated but not tracked or reported

### Integration/E2E Tests

**Score: 9.0/10**

- **Integration Tests**: 123 test files, 70,617 lines
- **E2E Tests**: 77 test files, 25,373 lines
- **Test Specs**: 1,026 Ginkgo `It` blocks, 667 `Describe`/`Context`/`When` blocks
- **Cluster Setup**: Kind clusters for E2E, envtest for integration
- **Multi-version**: K8s 1.34.8, 1.35.5, 1.36.1
- **Test Tiers**: Baseline/Extended split via Ginkgo label filters

**Test Coverage Areas**:
- Singlecluster: controller, webhook, scheduler, TAS, kueuectl, importer, conversion
- Multikueue: scheduler, TAS, baseline, extended, sequential, DRA
- Special: certmanager, DRA (counter, whole-device), upgrade validation
- Performance: scheduler benchmarks with stats/scraper/recorder infrastructure
- KueueViz: Cypress-based frontend E2E tests

**Strengths**:
- Comprehensive multi-cluster testing (singlecluster + multikueue)
- Multi-version Kubernetes testing across 3 versions
- Upgrade validation testing
- Performance/scalability testing infrastructure
- Integration test sharding for CI optimization
- Ginkgo parallelization with configurable NPROCS
- Extensive label-based test filtering system

**Gaps**:
- Minor: could benefit from more structured contract tests between components

### Build Integration

**Score: 7.0/10**

- **Dockerfile**: Multi-stage build (Go builder → distroless runtime)
- **Multi-arch**: docker buildx with configurable PLATFORMS
- **Build System**: CloudBuild (postsubmit + periodic)
- **Makefile Targets**: `build`, `image-build`, `image-push`, `image-local-build`
- **Operator Patterns**: controller-gen for CRD/RBAC generation, kustomize for manifests
- **Helm**: Chart with unit tests (5 test files) via helm-unittest plugin
- **Verify Pipeline**: Comprehensive `make verify` with parallel phase, tree-diff checks

**Strengths**:
- Well-structured multi-stage Docker build with retry logic
- Multi-architecture support
- Helm chart unit testing
- Comprehensive `make verify` pipeline with parallelized verification

**Gaps**:
- No PR-time Docker image build (CloudBuild is postsubmit only)
- No Konflux build simulation
- No kustomize build validation in PR checks

### Image Testing

**Score: 6.0/10**

- **Base Image**: `gcr.io/distroless/static:nonroot` (secure, minimal)
- **Multi-stage**: Yes (golang builder → distroless)
- **Multi-arch**: Yes, via `--platform` and `docker buildx`
- **Health Probes**: readiness/liveness probes in K8s deployment manifests
- **.dockerignore**: Present and well-configured

**Strengths**:
- Distroless base for minimal attack surface
- Non-root user (65532:65532)
- Well-configured .dockerignore
- Health probes defined in K8s manifests

**Gaps**:
- No HEALTHCHECK instruction in Dockerfile
- No Testcontainers or explicit container runtime validation
- No container startup testing in CI
- E2E tests implicitly validate (via Kind deployment) but no isolated image tests

### Coverage Tracking

**Score: 3.0/10**

- **Coverage Generation**: `--coverprofile` in `make test`
- **Codecov Config**: Not present
- **Coverage Reporting**: Not configured
- **Threshold Enforcement**: None

**Details**:
The unit test target generates coverage profiles (`cover.out`), but the data is never uploaded, analyzed, or enforced. There is no `.codecov.yml`, no codecov/coveralls GitHub Action, and no coverage threshold configuration. This is the most significant quality gap in the repository.

### CI/CD Automation

**Score: 8.0/10**

- **Primary CI**: Prow (Kubernetes standard — managed in k/test-infra)
- **GitHub Workflows**: Release (krew), SBOM, OpenVEX, Dependabot sync (5 workflows)
- **CloudBuild**: Image building (postsubmit + periodic)
- **Make Infrastructure**: Comprehensive Makefile system split across 4 files
- **Test Parallelization**: Ginkgo `--procs`, unit/integration sharding
- **JUnit Output**: gotestsum with `--junitfile`

**CI Job Hierarchy**:
- `make test` — Unit tests with sharding
- `make test-integration` — Integration tests (baseline/extended/multikueue)
- `make test-e2e-*` — E2E tests (baseline/extended, TAS, multikueue, DRA, upgrade)
- `make verify` — Comprehensive verification (linting, generation, formatting, helm tests)
- `make test-performance-scheduler` — Scheduler performance benchmarks

**Strengths**:
- Prow provides mature CI with extensive Kubernetes ecosystem integration
- Sophisticated test sharding across unit and integration tiers
- Parallel verification with configurable worker count
- JUnit XML output for CI integration
- Multiple e2e test shards for parallel CI execution

**Gaps**:
- GitHub workflows are minimal (release/SBOM only) — all testing is via Prow (which is correct for k-sigs but means CI config is external)
- No concurrency controls in GitHub workflows (minor — Prow handles this)

### Static Analysis

**Score: 7.0/10**

**Linting**:
- golangci-lint v2 with 21+ linters enabled
- Notable linters: gocritic, revive, ginkgolinter, loggercheck, forbidigo, perfsprint, modernize, usetesting
- Formatting: gci (import ordering) + golines (line length 200)
- Additional KAL (kube-api-linter) config for API-specific checks
- Nolint directives require explanation and specificity

**Dependency Management**:
- Dependabot configured for 4 ecosystems: gomod, github-actions, docker, npm
- 5 gomod directories tracked
- 18 docker directories tracked
- 3 npm directories tracked
- Groups: kubernetes, MUI, vite-stack
- Auto-labeling: `ok-to-test`, `release-note-none`, `dependencies`

**FIPS Compatibility**:
- No non-compliant crypto imports (clean scan)
- No FIPS build tags configured
- Base image: distroless (not FIPS-capable)

**Strengths**:
- Extensive golangci-lint configuration with 21+ linters
- Comprehensive Dependabot coverage across all ecosystems
- Clean crypto usage (no banned imports)

**Gaps**:
- No pre-commit hooks
- No FIPS build configuration
- Distroless base is not UBI/FIPS-capable

### Agent Rules

**Score: 9.0/10**

- **CLAUDE.md**: Present (references AGENTS.md)
- **AGENTS.md**: Comprehensive with canary marker, AI contribution policy, skills index
- **Operational Skills** (6):
  - `kueue-who-preempted` — Preemption investigation
  - `kueue-lineage` — Workload-to-pod tracing
  - `kueue-flake-debugger` — CI flake debugging
  - `kueue-release-notes` — PR release note generation
  - `was-cluster` — WAS cluster management
  - `reviewer/` — Code review orchestration

- **Code Review Skills** (30+):
  - Architecture: illogical-structure, nonsensical-decisions, avoidable-complexity, duplicated-logic, scope-creep, misplaced-logic
  - Bugs: logic-errors, feature-gate-interaction-bugs, deleted-backwards-compatibility-code, unnecessary-guard-conditions
  - Code Style: imprecise-names, convention-drift, reinvented-helpers, wrong-log-verbosity, misaligned-test-names, typos
  - Comments: over-commenting, wrong-kind-of-comment, inaccurate-comments, missing-deferred-removal-markers
  - Security: input-validation, injection, path-traversal, resource-bounds-dos, nil-safety, authn-authz-relaxation, information-disclosure
  - Testing: table-driven-tests, split-test-files, integration-tests-for-updates

**Strengths**:
- One of the most comprehensive agent rule setups in any Kubernetes project
- Granular security review skills with specific vulnerability categories
- Canary marker for instruction-following degradation detection
- AI Contribution Policy aligned with Kubernetes standards
- Code review skills cover all major quality dimensions

**Gaps**:
- Skills are in `cmd/experimental/skills/` (non-standard location, not in `.claude/`)
- No `.claude/rules/` directory
- Could add test creation rules for unit/integration test patterns

## Recommendations

### Priority 0 (Critical)

1. **Implement Codecov integration** — Add `.codecov.yml` with project/patch coverage targets, upload coverage from `make test` via Prow or GitHub Action. This is the single highest-impact improvement available.

2. **Add PR-time image build validation** — Add a Prow presubmit job or GitHub Action that runs `make image-local-build` on Dockerfile changes to catch build failures before merge.

### Priority 1 (High Value)

3. **Add container runtime validation** — Implement basic container startup validation after image build (e.g., verify `/manager --help` runs successfully in the built image).

4. **Configure pre-commit hooks** — Add `.pre-commit-config.yaml` with golangci-lint and gofmt hooks for faster local developer feedback.

5. **Consider FIPS build configuration** — For downstream Red Hat consumption, add FIPS build tags (`-tags=strictfipsruntime`, `GOEXPERIMENT=boringcrypto`) and UBI-based Dockerfile variant.

### Priority 2 (Nice-to-Have)

6. **Expand t.Parallel() usage** — Only 1 test file uses `t.Parallel()`. Enabling parallel test execution within packages would reduce unit test runtime.

7. **Add HEALTHCHECK to Dockerfile** — While K8s manifests define probes, a Dockerfile HEALTHCHECK provides an additional layer of container health validation.

8. **Add contract tests for API boundaries** — Formal contract tests between Kueue components (scheduler, webhook, controller) would catch interface drift.

## Comparison to Gold Standards

| Dimension | Kueue (7.3) | odh-dashboard | notebooks | kserve | K8s Best Practice |
|-----------|-------------|---------------|-----------|--------|-------------------|
| Unit Tests | 8.0 | 8.0 | 6.0 | 8.0 | 8.0 |
| Integration/E2E | 9.0 | 9.0 | 7.0 | 9.0 | 9.0 |
| Build Integration | 7.0 | 7.0 | 8.0 | 6.0 | 8.0 |
| Image Testing | 6.0 | 5.0 | 9.0 | 5.0 | 7.0 |
| Coverage Tracking | 3.0 | 8.0 | 4.0 | 8.0 | 8.0 |
| CI/CD Automation | 8.0 | 9.0 | 7.0 | 8.0 | 8.0 |
| Static Analysis | 7.0 | 7.0 | 5.0 | 7.0 | 7.0 |
| Agent Rules | 9.0 | 8.0 | 2.0 | 3.0 | 5.0 |

**Notable**: Kueue leads in Agent Rules with one of the most comprehensive AI-assisted development setups across all analyzed repositories. Its Integration/E2E testing is also top-tier. Coverage tracking is the primary gap holding back the overall score.

## File Paths Reference

### CI/CD
- `.github/workflows/` — Release, SBOM, OpenVEX, Dependabot sync
- `cloudbuild.yaml` — Postsubmit image building
- `cloudbuild-periodic.yaml` — Periodic image building
- `Makefile` — Primary build system
- `Makefile-test.mk` — Test targets and configuration
- `Makefile-verify.mk` — Verification pipeline
- `Makefile-deps.mk` — Tool dependency management

### Testing
- `test/integration/singlecluster/` — Singlecluster integration tests
- `test/integration/multikueue/` — MultiKueue integration tests
- `test/e2e/singlecluster/` — Singlecluster E2E tests
- `test/e2e/multikueue/` — MultiKueue E2E tests
- `test/e2e/tas/` — TAS E2E tests
- `test/e2e/dra/` — DRA E2E tests
- `test/e2e/upgrade/` — Upgrade validation tests
- `test/e2e/certmanager/` — Cert-manager E2E tests
- `test/performance/` — Performance benchmarks
- `hack/testing/` — Test infrastructure and utilities

### Code Quality
- `.golangci.yaml` — golangci-lint v2 configuration (21+ linters)
- `.golangci-kal.yaml` — Kube API Linter config
- `.github/dependabot.yml` — Dependabot (gomod, actions, docker, npm)
- `hack/boilerplate.txt` — License header template

### Container Images
- `Dockerfile` — Main multi-stage Dockerfile
- `cmd/importer/Dockerfile` — Importer Dockerfile
- `.dockerignore` — Docker build context exclusions

### Agent Rules
- `CLAUDE.md` — Claude Code instructions (references AGENTS.md)
- `AGENTS.md` — Comprehensive agent instructions
- `cmd/experimental/skills/` — 6 operational skills + 30+ review skills
