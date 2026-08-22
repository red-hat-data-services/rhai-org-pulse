---
repository: "red-hat-data-services/rhods-operator"
overall_score: 7.7
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "260 test files with Ginkgo/Gomega + Go testing; 351 t.Parallel() calls; envtest and fakeclient patterns"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "49 E2E test files covering 16+ components; KinD cluster testing; cloud manager matrix (azure/coreweave/aws)"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-triggered image builds; Konflux/Tekton pipelines; operator+bundle+catalog builds on PR; early-gate pipeline"
  - dimension: "Image Testing"
    score: 6.0
    status: "Multi-stage UBI9 Dockerfiles; dedicated E2E test image; no runtime validation or Testcontainers"
  - dimension: "Coverage Tracking"
    score: 5.0
    status: "Codecov integration with coverprofile; thresholds set to informational only (not enforced)"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "25+ workflows; PR-triggered linting/tests/builds; Tekton/Konflux; path-filtered triggers; prior-run dedup"
  - dimension: "Static Analysis"
    score: 9.0
    status: "golangci-lint v2 default:all; kube-linter with SARIF; pre-commit hooks; Dependabot (gomod/actions/docker); FIPS-compliant builds"
  - dimension: "Agent Rules"
    score: 9.0
    status: "CLAUDE.md + AGENTS.md; 6 rule files covering controllers/testing/review; diagnose skill; MCP server integration"
critical_gaps:
  - title: "Coverage thresholds are informational-only (not enforced)"
    impact: "Coverage can silently regress without blocking PRs; no minimum coverage gate"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container image runtime validation testing"
    impact: "Image startup issues or missing dependencies not caught until deployment"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "Limited CI caching strategy"
    impact: "Slower CI builds; no explicit Go module or Docker layer caching in most workflows"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Enforce codecov coverage thresholds"
    effort: "1-2 hours"
    impact: "Prevents silent coverage regression on PRs"
  - title: "Add Go module caching to CI workflows"
    effort: "1-2 hours"
    impact: "Faster CI builds by caching Go module downloads across runs"
  - title: "Add container startup smoke test to PR workflow"
    effort: "2-4 hours"
    impact: "Catches image startup failures before merge"
recommendations:
  priority_0:
    - "Enforce codecov coverage thresholds (change informational:true to target values with minimum patch coverage)"
    - "Add container startup validation — build image on PR and verify it starts cleanly with health endpoints"
  priority_1:
    - "Add explicit Go module caching (actions/cache) to unit-test and linter workflows"
    - "Add concurrency controls to more PR workflows to cancel stale runs"
    - "Add coverage reporting to gateway integration tests (upload to Codecov)"
  priority_2:
    - "Add multi-architecture image build validation in PR workflows"
    - "Add Testcontainers or equivalent for operator container runtime validation"
    - "Add performance/resource benchmarking for operator reconciliation"
---

# Quality Analysis: rhods-operator

## Executive Summary

- **Overall Score: 7.7/10**
- **Repository**: red-hat-data-services/rhods-operator (downstream fork of opendatahub-operator)
- **Type**: Kubernetes Operator (Go, operator-sdk/controller-runtime)
- **Jira**: RHOAIENG / AI Core Platform (downstream tier)
- **Languages**: Go (686 files)

### Key Strengths
- **Comprehensive test suite** with 260 test files (0.61 test-to-code ratio), 351 parallel test calls, and dual test infrastructure (envtest + fakeclient)
- **Mature CI/CD pipeline** with 25+ GitHub Actions workflows, Tekton/Konflux integration, and PR-triggered builds for operator, bundle, and catalog images
- **Excellent static analysis** using golangci-lint v2 with `default: all`, kube-linter with SARIF integration, pre-commit hooks, and comprehensive Dependabot configuration
- **Strong FIPS compliance** with `strictfipsruntime` build tags, `CGO_ENABLED=1`, UBI9 base images, and zero non-FIPS crypto imports
- **Industry-leading agent rules** with CLAUDE.md, AGENTS.md, 6 rule files covering controllers/testing/review patterns, a diagnose skill, and MCP server integration

### Critical Gaps
1. Coverage thresholds are informational-only — no enforcement blocks PR merges
2. No container image runtime validation testing
3. Limited CI build caching across workflows

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.0/10 | 15% | 1.20 | 260 test files; Ginkgo/Gomega + Go testing; envtest + fakeclient |
| Integration/E2E | 8.0/10 | 20% | 1.60 | 49 E2E files; KinD cluster testing; cloud manager matrix |
| Build Integration | 8.0/10 | 15% | 1.20 | PR image builds; Konflux/Tekton; operator+bundle+catalog |
| Image Testing | 6.0/10 | 10% | 0.60 | Multi-stage UBI9 Dockerfiles; no runtime validation |
| Coverage Tracking | 5.0/10 | 10% | 0.50 | Codecov present but thresholds informational-only |
| CI/CD Automation | 8.0/10 | 15% | 1.20 | 25+ workflows; path-filtered triggers; prior-run dedup |
| Static Analysis | 9.0/10 | 10% | 0.90 | golangci-lint v2 all; kube-linter SARIF; Dependabot 3-ecosystem |
| Agent Rules | 9.0/10 | 5% | 0.45 | CLAUDE.md + AGENTS.md; 6 rules; diagnose skill; MCP server |
| **Overall** | **7.7/10** | **100%** | **7.65** | |

## Critical Gaps

### 1. Coverage Thresholds Not Enforced
- **Impact**: Coverage can silently regress without blocking PR merges
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The `codecov.yml` sets both `project` and `patch` status to `informational: true`. This means Codecov reports coverage but never blocks a PR. Coverage could drop from 80% to 20% without any CI gate failing.
- **File**: `codecov.yml`

### 2. No Container Image Runtime Validation
- **Impact**: Image startup issues, missing runtime dependencies, or configuration errors not caught until deployment
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: While the PR workflow builds operator, bundle, and catalog images, there is no step that starts the built image and validates it runs correctly (health check, version output, etc.). The kube-linter checks for liveness/readiness probes in manifests, but doesn't validate the actual container.

### 3. Limited CI Caching Strategy
- **Impact**: Slower CI builds; repeated Go module downloads across workflow runs
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: Most workflows rely on `actions/setup-go` which provides some Go module caching, but there are no explicit `actions/cache` steps for Go modules, build artifacts, or kustomize outputs. The release workflows explicitly disable caching (`cache: false`).

## Quick Wins

### 1. Enforce Codecov Coverage Thresholds
- **Effort**: 1-2 hours
- **Impact**: Prevents silent coverage regression on PRs
- **Implementation**:
```yaml
# codecov.yml
coverage:
  status:
    project:
      default:
        target: auto
        threshold: 2%
    patch:
      default:
        target: 70%
```

### 2. Add Go Module Caching to CI Workflows
- **Effort**: 1-2 hours
- **Impact**: Faster CI builds (30-60% reduction in module download time)
- **Implementation**: The `actions/setup-go` action already caches the Go module cache by default when `go-version-file` is specified. Verify this is working and consider adding `actions/cache` for build artifacts.

### 3. Add Container Startup Smoke Test
- **Effort**: 2-4 hours
- **Impact**: Catches image startup failures before merge
- **Implementation**: After building the operator image in `ci-build-push-images-on-pr.yaml`, add a step to run the container and verify it starts:
```yaml
- name: Smoke test operator image
  run: |
    podman run --rm -d --name smoke-test ${{ env.IMG }} --help || true
    podman logs smoke-test 2>&1 | head -20
    podman rm -f smoke-test 2>/dev/null || true
```

## Detailed Findings

### Unit Tests

**Score: 8.0/10**

**Strengths:**
- 260 test files across the codebase (87 in `pkg/`, 92 in `internal/`, 24 in `cmd/`)
- Test-to-code ratio of 0.61 (260 test files / 426 source files)
- 351 `t.Parallel()` calls indicating strong test isolation
- Dual test infrastructure: `fakeclient.New()` for fast unit tests, `envt.New()` for envtest-based API server testing
- Ginkgo/Gomega framework for BDD-style tests
- `cmd/test-retry` tool for flaky test management with 13 test files
- `pkg/utils/test/` with shared test utilities (testf, envt, fakeclient)
- Makefile targets: `make unit-test` runs both `unit-test-operator` and `unit-test-clusterhealth`
- Prometheus rule unit tests (`tests/prometheus_unit_tests/`)
- Unit tests triggered on PR via path filtering (`internal/**`, `pkg/**`, `cmd/main.go`, `api/**`, `config/**`)

**Areas for Improvement:**
- Coverage thresholds not enforced (informational only)
- Consider adding mutation testing for critical reconciliation logic

**Key Files:**
- `Makefile:647` — `unit-test-operator` target with envtest and ginkgo
- `.github/workflows/test-unit.yaml` — PR-triggered unit test workflow with Codecov upload
- `pkg/utils/test/` — Shared test utilities

### Integration/E2E Tests

**Score: 8.0/10**

**Strengths:**
- 49 E2E test files in `tests/e2e/` covering 16+ operator components
- Component-specific E2E tests: kserve, dashboard, ray, sparkoperator, trainer, trustyai, kueue, modelregistry, etc.
- Cloud manager E2E with matrix strategy testing 3 cloud providers (azure, coreweave, aws)
- KinD cluster-based E2E testing (`test-kind-odh-e2e.yaml`)
- Gateway integration tests using envtest with coverage reporting
- E2E requirement check workflow that enforces test updates when source changes
- Dedicated E2E test Docker image (`Dockerfiles/e2e-tests/`) with precompiled tests
- Authorization checks for external contributors with trusted bot allowlists
- Prior-run dedup to skip redundant test executions on the same commit
- E2E test runner script with gotestsum and JUnit output

**Areas for Improvement:**
- Some E2E tests require label-gating (`run-integration-tests`, `run-xks-e2e`) — not fully automatic
- No multi-version K8s/OCP testing matrix in the KinD E2E workflow
- Integration tests in `test-integration.yaml` only trigger on `synchronize`/`reopened` (not `opened`)

**Key Files:**
- `.github/workflows/test-kind-odh-e2e.yaml` — KinD-based E2E tests
- `.github/workflows/test-cloudmanager-e2e.yaml` — Cloud manager E2E with provider matrix
- `.github/workflows/test-gateway-integration.yaml` — Gateway envtest integration tests
- `.github/workflows/test-e2e-requirement-check.yaml` — Enforces E2E test updates on source changes
- `Dockerfiles/e2e-tests/e2e-tests.Dockerfile` — Precompiled E2E test image

### Build Integration

**Score: 8.0/10**

**Strengths:**
- PR-triggered operator image builds (`ci-build-push-images-on-pr.yaml`) — builds operator, bundle, and catalog images
- Konflux/Tekton integration via `.tekton/` directory with PipelineRun definitions
- Early-gate Konflux pipeline (`early-gate-ci-build.yaml`, `early-gate-ci-test.yaml`) for pre-merge Konflux build simulation
- Multi-platform Dockerfile support (`BUILDPLATFORM`/`TARGETPLATFORM` args)
- Dual build modes: ODH (`-tags=odh`) and RHOAI (`-tags=rhoai`)
- Kustomize overlay validation via `make prepare`, `make install`, `make deploy`
- Comprehensive Makefile with 50+ targets for build, test, deploy, and release operations
- Bundle and catalog image builds as part of PR validation
- CRD generation and validation (`make manifests`, `make generate`)
- Manifest validation workflow (`validate-related-images.yaml`)

**Areas for Improvement:**
- Konflux early-gate pipeline is comment-triggered (`/early-gate`), not automatic on PRs
- No dry-run deployment validation in PR workflows (e.g., `kubectl apply --dry-run=server`)

**Key Files:**
- `.github/workflows/ci-build-push-images-on-pr.yaml` — PR operator/bundle/catalog builds
- `.tekton/odh-operator-pull-request.yaml` — Konflux PR pipeline
- `.tekton/early-gate-ci-build.yaml` — Early-gate Konflux build simulation
- `Makefile` — 42KB with comprehensive build/test/deploy targets
- `Dockerfiles/Dockerfile.konflux` — Konflux-specific Dockerfile with GOEXPERIMENT=strictfipsruntime

### Image Testing

**Score: 6.0/10**

**Strengths:**
- Multi-stage Dockerfiles (3 stages: manifests, builder, runtime)
- UBI9 base images across all Dockerfiles (FIPS-capable)
- `.dockerignore` present for build optimization
- Dedicated E2E test image with precompiled test binary
- Platform-aware builds with `BUILDPLATFORM`/`TARGETPLATFORM`/`TARGETARCH`
- Minimal runtime image (`ubi9/ubi-minimal`)
- Non-root user (`USER 1001`) in runtime images
- Kube-linter enforces liveness/readiness probes in K8s manifests

**Areas for Improvement:**
- No container startup validation after build (no smoke test)
- No Testcontainers or equivalent for runtime testing
- No HEALTHCHECK instruction in Dockerfiles
- No explicit multi-architecture build validation (buildx) in CI
- E2E test image uses `golang:$GOLANG_VERSION` as runtime (not UBI)

**Key Files:**
- `Dockerfiles/Dockerfile` — ODH operator image (3-stage)
- `Dockerfiles/Dockerfile.konflux` — Konflux operator image with FIPS
- `Dockerfiles/rhoai.Dockerfile` — RHOAI operator image
- `Dockerfiles/e2e-tests/e2e-tests.Dockerfile` — E2E test image
- `.dockerignore` — Build context optimization

### Coverage Tracking

**Score: 5.0/10**

**Strengths:**
- `codecov.yml` present with project and patch status configuration
- `codecov/codecov-action` in unit test workflow (`test-unit.yaml`)
- `--coverprofile=cover.out` in Makefile unit-test target
- Gateway integration tests generate `coverage.out` with `--coverprofile`
- `clusterhealth` submodule runs with `-cover` flag

**Areas for Improvement:**
- **Critical**: Both `project` and `patch` thresholds are `informational: true` — coverage is reported but never blocks PRs
- Gateway integration test coverage is not uploaded to Codecov
- No minimum coverage target defined
- No coverage trend tracking or historical comparison
- E2E tests do not generate coverage data

**Key Files:**
- `codecov.yml` — Coverage configuration (informational only)
- `.github/workflows/test-unit.yaml:37` — Codecov upload action
- `Makefile:662-663` — `--coverprofile=cover.out` in unit-test target
- `.github/workflows/test-gateway-integration.yaml:57` — Gateway test coverage generation

### CI/CD Automation

**Score: 8.0/10**

**Strengths:**
- 25+ GitHub Actions workflows covering linting, testing, building, releasing, and syncing
- PR-triggered workflows for: unit tests, linting, E2E tests (KinD), integration tests, image builds, E2E requirement checks, gateway integration tests
- Path-filtered triggers to minimize unnecessary CI runs
- Reusable workflow pattern (`get-merge-commit.yaml` called by 6+ workflows)
- Scheduled workflows: branch sync (every 2 hours), manifest SHA updates (daily)
- Workflow authorization with trusted bot allowlists and label-based gating
- Prior-run deduplication to skip redundant test runs on the same commit
- Tekton/Konflux pipelines for downstream Konflux builds
- PR comment workflows for E2E status reporting
- Concurrency control on catalog build workflow
- Release workflows for community and staging releases
- Operator-processor workflow for automated PR operations

**Areas for Improvement:**
- Limited use of concurrency groups (only 1 workflow has `concurrency:`)
- No explicit caching strategy beyond setup-go defaults
- Release workflows disable caching (`cache: false`)
- No test parallelization/sharding in unit test workflow
- Some workflows lack `timeout-minutes` constraints

**Key Files:**
- `.github/workflows/` — 25+ workflow files
- `.github/workflows/test-linter.yaml` — Linter workflow with golangci-lint + kube-linter
- `.github/workflows/test-unit.yaml` — Unit test workflow with Codecov
- `.github/workflows/test-kind-odh-e2e.yaml` — KinD E2E tests
- `.github/workflows/operator-processor.yaml` — Automated PR operations

### Static Analysis

**Score: 9.0/10**

#### Linting
- **golangci-lint v2** with `default: all` — starts with all linters enabled, selectively disables 21 that don't fit the project
- 4,500+ byte configuration with custom settings for: errcheck, exhaustive, funlen, goconst, gocritic, gocyclo, importas, ireturn, lll, nolintlint, perfsprint, revive
- Import ordering via GCI with custom section ordering
- Exclusion rules for test files (dupl), generated code, and API directories
- **Kube-linter** with comprehensive custom checks: 30+ built-in checks + custom `no-system-group-binding` CEL check
- SARIF output uploaded to GitHub Security tab
- **Pre-commit hooks**: trailing-whitespace, end-of-file-fixer, check-yaml, check-merge-conflict, go-fmt, go-vet, golangci-lint, go-unit-tests (pre-push)
- **YAML linting** via `.yamllint`
- **Semgrep** configuration (64KB `semgrep.yaml`)

#### FIPS Compatibility
- **Build tags**: `strictfipsruntime` used in all Dockerfiles (ODH, RHOAI, Konflux)
- **GOEXPERIMENT**: `strictfipsruntime` in Konflux Dockerfile
- **CGO_ENABLED**: Set to `1` across all build configurations
- **Base images**: All use UBI9 (FIPS-capable) — `ubi9/go-toolset`, `ubi9/ubi-minimal`, `ubi9/toolbox`
- **No non-FIPS crypto imports**: Zero `crypto/md5`, `crypto/des`, `crypto/rc4`, or `math/rand` usage found
- **Verdict**: Fully FIPS-compliant build pipeline

#### Dependency Alerts
- **Dependabot** configured for 3 ecosystems:
  - `gomod` (weekly, root directory)
  - `github-actions` (weekly, grouped)
  - `docker` (weekly, Dockerfiles directory)
- Auto-merge not configured (requires manual review)

**Key Files:**
- `.golangci.yml` — Comprehensive golangci-lint v2 configuration
- `.pre-commit-config.yaml` — 7 hooks including golangci-lint
- `.kube-linter.yaml` — 30+ checks with custom CEL rules
- `.github/dependabot.yml` — 3-ecosystem dependency monitoring
- `semgrep.yaml` — Custom semgrep rules (64KB)
- `Dockerfiles/Dockerfile.konflux:56` — `GOEXPERIMENT=strictfipsruntime`

### Agent Rules

**Score: 9.0/10**

**Strengths:**
- **CLAUDE.md** present (delegates to AGENTS.md)
- **AGENTS.md** — Comprehensive operator documentation with build/test commands, quality gates, conventions, critical rules, and file location patterns
- **`.claude/rules/`** — Symlinked to `.rules/` directory containing 6 rule files:
  - `api-types.md` — API type conventions (path-scoped to `api/**/*.go`)
  - `component-controller.md` — Component controller patterns with reconciler builder usage
  - `service-controller.md` — Service controller patterns
  - `cloudmanager-controller.md` — Cloud manager patterns with dynamic ownership
  - `testing.md` — Testing patterns covering fakeclient vs envtest, table-driven tests, E2E oracle independence
  - `review-instructions.md` — AI reviewer meta-guidance with anti-patterns and must-flag rules
- **`.claude/skills/diagnose/`** — Cluster diagnostic skill using MCP server tools
- **`.mcp.json`** — MCP server integration (opendatahub-health, openshift)
- Rules are **path-scoped** (e.g., `paths: ["**/*_test.go", "tests/**/*.go"]` for testing rules)
- Rules are **actionable** with specific patterns, examples, and anti-pattern guidance
- Rules are **framework-specific** (Ginkgo/Gomega, envtest, fakeclient, controller-runtime)

**Areas for Improvement:**
- No dedicated rule for e2e test patterns (e2e guidance is in `testing.md` but could be expanded)
- No rule covering Dockerfile or CI workflow conventions
- Consider adding a rule for Makefile/build patterns

**Key Files:**
- `CLAUDE.md` — Root agent configuration
- `AGENTS.md` — Comprehensive operator guide
- `.rules/testing.md` — Test pattern rules
- `.rules/review-instructions.md` — AI reviewer guidance
- `.claude/skills/diagnose/SKILL.md` — Cluster diagnostic skill
- `.mcp.json` — MCP server configuration

## Recommendations

### Priority 0 (Critical)
1. **Enforce codecov coverage thresholds** — Change `informational: true` to actual target values (e.g., `target: auto`, `threshold: 2%` for project; `target: 70%` for patch) to prevent silent coverage regression
2. **Add container startup validation** — After building the operator image in PR workflows, add a smoke test that starts the container and verifies it initializes correctly

### Priority 1 (High Value)
3. **Add explicit Go module caching** — Verify `actions/setup-go` caching is working and consider adding `actions/cache` for build artifacts in workflows that don't use `setup-go`
4. **Add concurrency controls** — Apply `concurrency:` groups to more PR-triggered workflows to cancel stale runs and reduce CI resource usage
5. **Upload gateway integration coverage** — Add Codecov upload step to `test-gateway-integration.yaml` to consolidate coverage data
6. **Add multi-version K8s testing** — Add a matrix strategy to KinD E2E tests to validate across multiple Kubernetes versions

### Priority 2 (Nice-to-Have)
7. **Add multi-architecture build validation** — Use `docker buildx` in CI to validate multi-arch builds before merge
8. **Add container runtime testing** — Consider Testcontainers for operator container runtime validation
9. **Add operator reconciliation benchmarks** — Performance testing for reconciliation latency
10. **Add Dockerfile/CI workflow agent rules** — Extend `.rules/` with guidance for container and CI patterns

## Comparison to Gold Standards

| Feature | rhods-operator | odh-dashboard | notebooks | kserve |
|---------|---------------|---------------|-----------|--------|
| Unit Test Coverage | 260 files (0.61 ratio) | Multi-layer | N/A | Comprehensive |
| E2E Tests | 49 files, KinD | Cypress + API | Image validation | Multi-version |
| Coverage Enforcement | Informational only | Enforced | N/A | Enforced thresholds |
| CI/CD Workflows | 25+ | Comprehensive | 5-layer | Extensive |
| Static Analysis | golangci-lint all + kube-linter | ESLint + TypeScript strict | Linting | golangci-lint |
| FIPS Compliance | strictfipsruntime + UBI9 | N/A | UBI base images | Build tags |
| Agent Rules | CLAUDE.md + 6 rules + skill | Comprehensive | Basic | Basic |
| Build Integration | PR builds + Konflux | PR builds | Image builds | PR builds |
| Container Testing | No runtime validation | N/A | 5-layer validation | Basic |
| Dependency Alerts | Dependabot (3 ecosystems) | Dependabot | Dependabot | Dependabot |

## File Paths Reference

### CI/CD
- `.github/workflows/` — 25+ GitHub Actions workflows
- `.tekton/` — Tekton/Konflux pipeline definitions
- `Makefile` — 42KB comprehensive build/test/deploy targets

### Testing
- `tests/e2e/` — 49 E2E test files
- `tests/envtestutil/` — envtest utilities
- `tests/prometheus_unit_tests/` — Prometheus rule tests
- `pkg/utils/test/` — Shared test utilities (fakeclient, envt, testf)
- `cmd/test-retry/` — Flaky test retry tool

### Code Quality
- `.golangci.yml` — golangci-lint v2 configuration
- `.pre-commit-config.yaml` — Pre-commit hooks
- `.kube-linter.yaml` — Kube-linter checks
- `.github/dependabot.yml` — Dependency monitoring
- `semgrep.yaml` — Semgrep rules
- `.yamllint` — YAML linting
- `.gitleaks.toml` — Secret detection config

### Container Images
- `Dockerfiles/Dockerfile` — ODH operator image
- `Dockerfiles/Dockerfile.konflux` — Konflux operator image
- `Dockerfiles/rhoai.Dockerfile` — RHOAI operator image
- `Dockerfiles/e2e-tests/e2e-tests.Dockerfile` — E2E test image
- `.dockerignore` — Build context optimization

### Coverage
- `codecov.yml` — Codecov configuration (informational)

### Agent Rules
- `CLAUDE.md` — Root agent config
- `AGENTS.md` — Operator documentation
- `.rules/` — 6 agent rule files
- `.claude/skills/diagnose/` — Diagnostic skill
- `.mcp.json` — MCP server config
