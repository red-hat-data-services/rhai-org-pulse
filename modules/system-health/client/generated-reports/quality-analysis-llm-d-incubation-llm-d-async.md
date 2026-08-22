---
repository: "llm-d-incubation/llm-d-async"
overall_score: 7.0
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Excellent 2:1 test-to-code LOC ratio with testify and gomega; envtest for K8s API testing; no t.Parallel() usage"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Comprehensive E2E suite deploying full stack on Kind; 12 integration tests with mock servers; Helm unit tests"
  - dimension: "Build Integration"
    score: 6.0
    status: "PR-time container build with smart path filtering; no Konflux simulation or manifest dry-run validation"
  - dimension: "Image Testing"
    score: 5.0
    status: "Multi-stage distroless build with non-root user; multi-arch support in Makefile; no runtime validation or UBI base"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "Generates coverprofile locally but no codecov integration, PR reporting, or threshold enforcement"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "14 well-organized workflows with concurrency control, Go caching, nightly E2E with auto-issue creation"
  - dimension: "Static Analysis"
    score: 8.0
    status: "golangci-lint v2 with 7 linters; comprehensive pre-commit hooks; Dependabot for 3 ecosystems; yamllint and typos"
  - dimension: "Agent Rules"
    score: 5.0
    status: "CLAUDE.md present with code conventions and build commands; no .claude/rules/ directory or test-specific agent rules"
critical_gaps:
  - title: "No coverage reporting or enforcement"
    impact: "Coverage regressions go undetected; no visibility into coverage trends or per-PR impact"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No FIPS-compatible base images"
    impact: "Distroless base images are not FIPS-certified; math/rand import in production code is not crypto-safe"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "E2E tests not triggered on PRs"
    impact: "E2E regressions discovered only in nightly runs, not before merge"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No PR-time Konflux build simulation"
    impact: "Build configuration mismatches between PR builds and Konflux discovered post-merge"
    severity: "MEDIUM"
    effort: "8-12 hours"
quick_wins:
  - title: "Add codecov integration with coverage thresholds"
    effort: "2-4 hours"
    impact: "Automatic coverage reporting on PRs with regression prevention via configurable thresholds"
  - title: "Add t.Parallel() to unit tests"
    effort: "2-3 hours"
    impact: "Faster test execution and improved test isolation; catches shared-state bugs"
  - title: "Create .claude/rules/ with test creation rules"
    effort: "2-3 hours"
    impact: "Consistent AI-generated tests following project patterns (testify, gomega, envtest)"
  - title: "Replace math/rand with crypto/rand or deterministic seed"
    effort: "1-2 hours"
    impact: "FIPS compliance for crypto-adjacent randomness; cleaner static analysis"
recommendations:
  priority_0:
    - "Add codecov.yml with coverage thresholds (e.g., 70% project, 50% patch) and integrate with CI"
    - "Evaluate switching to UBI-based images for FIPS compatibility in Red Hat environments"
    - "Replace math/rand import in pkg/asyncworker/worker.go with crypto/rand or document non-security context"
  priority_1:
    - "Add PR-triggered E2E test workflow (at least for critical paths) to catch regressions before merge"
    - "Create comprehensive .claude/rules/ with test patterns for unit, integration, and E2E tests"
    - "Add t.Parallel() to unit tests for faster execution and better isolation"
  priority_2:
    - "Add Dockerfile HEALTHCHECK instruction for container-level health monitoring"
    - "Add PR-time manifest validation (kustomize build --dry-run, helm template)"
    - "Explore Konflux build simulation in PR pipeline to match production build environment"
---

# Quality Analysis: llm-d-async

## Executive Summary

- **Overall Score: 7.0/10**
- **Repository Type**: Go multi-module service (async dispatch processor for llm-d)
- **Primary Language**: Go (4 modules: root, api/, pipeline/, producer/)
- **Jira**: INFERENG / llm-d (upstream tier)
- **Key Strengths**: Outstanding test coverage with 2:1 test-to-code LOC ratio, comprehensive E2E suite deploying a full Kind cluster stack, well-organized CI/CD with 14 workflows, strong static analysis with golangci-lint v2 and pre-commit hooks
- **Critical Gaps**: No coverage reporting/enforcement, non-FIPS-compliant base images, E2E tests only run nightly (not on PRs)
- **Agent Rules Status**: CLAUDE.md present with solid conventions; no .claude/rules/ directory

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.0/10 | 15% | 1.20 | Excellent test-to-code ratio; testify + gomega frameworks |
| Integration/E2E | 9.0/10 | 20% | 1.80 | Full-stack Kind E2E + mock-server integration tests |
| Build Integration | 6.0/10 | 15% | 0.90 | PR container build; no Konflux simulation |
| Image Testing | 5.0/10 | 10% | 0.50 | Multi-stage distroless; no runtime validation |
| Coverage Tracking | 3.0/10 | 10% | 0.30 | Local coverprofile only; no reporting/thresholds |
| CI/CD Automation | 8.0/10 | 15% | 1.20 | 14 workflows with concurrency control and caching |
| Static Analysis | 8.0/10 | 10% | 0.80 | golangci-lint v2, pre-commit, Dependabot for 3 ecosystems |
| Agent Rules | 5.0/10 | 5% | 0.25 | CLAUDE.md present; no rules directory |
| **Overall** | **7.0/10** | **100%** | **6.95** | |

## Critical Gaps

### 1. No Coverage Reporting or Enforcement (HIGH)
- **Impact**: Coverage regressions go undetected; no visibility into coverage trends or per-PR impact
- **Current State**: `make test` generates `cover.out` and `cover-producer.out` locally, but no CI uploads or threshold checks
- **Missing**: `.codecov.yml`, `codecov/codecov-action` step in CI, coverage thresholds
- **Effort**: 4-6 hours
- **Files**: `Makefile:103`, `.github/workflows/pre-commit.yml`

### 2. Non-FIPS-Compatible Base Images (HIGH)
- **Impact**: Distroless base images are not FIPS-certified; deployment in FIPS-enforced environments requires UBI-based images
- **Current State**: Builder: `quay.io/projectquay/golang:1.26`, Runtime: `gcr.io/distroless/static:nonroot`
- **Additional Finding**: `math/rand` import in `pkg/asyncworker/worker.go:9` — while used for jitter (not crypto), this is flagged in FIPS audits
- **Effort**: 8-12 hours (image migration + testing)
- **Files**: `Dockerfile:1-2`, `pkg/asyncworker/worker.go:9`

### 3. E2E Tests Not Triggered on PRs (MEDIUM)
- **Impact**: E2E regressions discovered only in nightly runs (3:17 AM daily), potentially 24+ hours after the breaking merge
- **Current State**: Nightly schedule + manual workflow_dispatch only; auto-creates GitHub issues on failure
- **Effort**: 4-6 hours (add PR trigger with path filter for code changes)
- **Files**: `.github/workflows/ci-e2e-tests.yaml:3-12`

### 4. No PR-time Konflux Build Simulation (MEDIUM)
- **Impact**: Build configuration mismatches between PR Docker builds and Konflux pipeline discovered post-merge
- **Current State**: PR workflow builds with `docker buildx build` but doesn't simulate Konflux environment
- **Effort**: 8-12 hours
- **Files**: `.github/workflows/pre-commit.yml:67-83`

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
Add `.codecov.yml` and upload coverage in CI:
```yaml
# .codecov.yml
coverage:
  status:
    project:
      default:
        target: 70%
    patch:
      default:
        target: 50%
```
Add to `pre-commit.yml` after the test step:
```yaml
- name: Upload coverage
  uses: codecov/codecov-action@v5
  with:
    files: cover.out,producer/cover-producer.out
    fail_ci_if_error: false
```

### 2. Add t.Parallel() to Unit Tests (2-3 hours)
Currently 0 test functions call `t.Parallel()`. Adding it to unit tests improves test isolation and execution speed:
```go
func TestSomething(t *testing.T) {
    t.Parallel()
    // ...
}
```

### 3. Create Agent Test Rules (2-3 hours)
Create `.claude/rules/` directory with test-specific rules for the project's frameworks:
- `unit-tests.md` — testify patterns, envtest usage, table-driven tests
- `e2e-tests.md` — Ginkgo/Gomega patterns, Kind cluster conventions
- `integration-tests.md` — mock server patterns, Redis test fixtures

### 4. Replace math/rand Import (1-2 hours)
In `pkg/asyncworker/worker.go:9`, replace `math/rand` with `crypto/rand` or use `math/rand/v2` (Go 1.22+) with explicit seeding to clarify the non-security intent.

## Detailed Findings

### Unit Tests

**Files**: 36 unit test files across `pkg/`, `internal/`, `cmd/`, `api/`, `producer/`
**LOC**: 16,622 test LOC vs 8,077 source LOC (2.06:1 ratio — excellent)
**Frameworks**: testify (708 assert/require usages), gomega (341 Expect usages)

**Strengths**:
- Outstanding test-to-code ratio exceeding 2:1
- Dual framework usage (testify for unit, gomega for BDD-style)
- envtest setup for Kubernetes API testing (`setup-envtest` in Makefile)
- `make test` runs fmt + vet before tests (fail-fast on formatting)
- Separate coverage for producer submodule

**Gaps**:
- No `t.Parallel()` usage (0 occurrences) — tests run sequentially
- No table-driven test patterns detected consistently
- Coverage files generated but not uploaded or reported

**Key Test Files**:
- `pkg/asyncworker/worker_test.go` — worker lifecycle tests
- `pkg/asyncworker/http_client_test.go` — HTTP client behavior
- `pkg/redis/redisimpl_test.go` — Redis implementation (uses miniredis)
- `pkg/async/inference/flowcontrol/gate_factory_test.go` — gate factory patterns
- `internal/health/health_test.go` — health check logic

### Integration/E2E Tests

**Integration Tests** (12 files in `test/integration/`):
- Each test spawns its own mock server — excellent isolation
- Build tag: `//go:build integration` for selective execution
- Covers: Redis PubSub, dispatch gates, merge policies, gate factories, OTel tracing, worker dispatch, endpoint scraping, pool gates, sorted set quota
- Run via `make test-integration` with clear pass/fail output

**E2E Tests** (14 files in `test/e2e/`):
- Full-stack Kind cluster deployment: async-processor, EPP, Redis, Prometheus, Envoy, Jaeger, llm-d-inference-sim
- Ginkgo/Gomega BDD framework with `RunSpecs`
- 12 Helm releases installed for different test configurations (integration, saturation, budget, redis-gate, quota, composite, prometheus-query, endpoint-scrape, short-drain, multitenant, tier-priority, mt-merge)
- Test scenarios: health checks, OTel tracing, multitenancy, merge policies, budget gates, composite gates, attribute routing, endpoint scraping, saturation gates, tier priority, query gates
- Automatic artifact collection on failure (Kind logs, pod descriptions, events)
- Docker/Podman auto-detection for container runtime

**Helm Tests** (2 files in `charts/async-processor/tests/`):
- `deployment_test.yaml` — 30+ assertions covering security context, resources, ports, args, TLS, OTel, validation guards
- `observability_test.yaml` — Prometheus PodMonitor and PrometheusRule validation

**Strengths**:
- One of the most thorough E2E suites seen — deploys entire inference pipeline
- Integration tests with clean isolation (each test creates its own mock)
- Helm unit tests validate chart rendering and validation guards
- Nightly E2E automatically creates GitHub issues on failure

**Gaps**:
- No multi-K8s-version matrix testing
- E2E only on nightly schedule, not on PRs
- No contract tests between async-processor and downstream services

### Build Integration

**PR Workflow** (`.github/workflows/pre-commit.yml`):
- Runs on push to main/release-* and all PRs
- Steps: pre-commit hooks → integration tests → Helm lint → Helm unit tests
- Separate `container-build` job builds Docker image (no push) with `docker buildx`
- Smart path filter: skips container build for docs-only and markdown-only changes

**Build Process**:
- `make build` compiles binary with ldflags (version, commit, date)
- `make docker-build` builds container image
- `make docker-buildx` supports cross-platform builds (linux/arm64, linux/amd64)
- Multi-stage Dockerfile with dependency caching (go mod download before source copy)

**Deployment**:
- Helm chart (`charts/async-processor/`) for Kubernetes deployment
- Kind emulator setup scripts for local development
- Kustomize-based deployment (`make deploy`)

**Gaps**:
- No PR-time Konflux build simulation
- No `kustomize build --dry-run` or `kubectl apply --dry-run` in CI
- No operator bundle or CRD validation (this repo is not an operator)

### Image Testing

**Dockerfile Analysis**:
- Multi-stage build: `quay.io/projectquay/golang:1.26` → `gcr.io/distroless/static:nonroot`
- Non-root user: `USER 65532:65532`
- CGO disabled: `CGO_ENABLED=0`
- Layer optimization: dependencies cached before source copy
- Minimal final image: distroless base

**Multi-Architecture**:
- Makefile supports `docker-buildx` with `PLATFORMS=linux/arm64,linux/amd64`
- Not currently used in CI (PR builds are amd64 only)

**Gaps**:
- No `HEALTHCHECK` instruction in Dockerfile
- No runtime validation (testcontainers, container startup tests)
- Not UBI-based (distroless is not FIPS-certified)
- No multi-arch builds in CI pipelines

### Coverage Tracking

**Current State**:
- `make test` generates `cover.out` for root module
- `make test` generates `cover-producer.out` for producer submodule
- No `.codecov.yml` or coverage tool configuration
- No codecov/coveralls upload action in CI
- No coverage threshold enforcement
- No PR coverage comments

**Impact**: Developers can check coverage locally but there is no team-wide visibility, trend tracking, or regression prevention.

### CI/CD Automation

**Workflow Inventory** (14 workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pre-commit.yml` | push/PR | Pre-commit hooks, integration tests, Helm lint/test, container build |
| `ci-e2e-tests.yaml` | schedule (nightly) / dispatch | Full E2E suite on Kind cluster |
| `ci-release.yaml` | push main/tags / release | Build and push container images |
| `ci-build-images.yaml` | workflow_call | Reusable image build and push |
| `ci-dco-signoff.yml` | PR | DCO sign-off verification |
| `ci-signed-commits.yaml` | PR target | Signed commit verification |
| `ci-tag-submodules.yaml` | tag push | Auto-tag Go submodules |
| `non-main-gatekeeper.yml` | PR | Branch protection enforcement |
| `pre-commit.yml` (container) | PR (code changes) | Docker build validation |
| `prow-github.yml` | issue comment | Prow-style /lgtm /approve commands |
| `prow-pr-automerge.yml` | schedule (5 min) | Auto-merge approved PRs |
| `prow-pr-remove-lgtm.yml` | PR | Remove LGTM on new pushes |
| `stale.yaml` | schedule (daily) | Mark stale issues |
| `unstale.yaml` | issue reopen/comment | Remove stale label |

**Strengths**:
- Concurrency control on 3 key workflows (pre-commit, DCO, E2E) with cancel-in-progress
- Go module caching enabled (`cache: true` with `setup-go`)
- 45-minute timeout on E2E tests
- Automatic issue creation on nightly E2E failure
- Prow-style label management (lgtm, approve, automerge)
- Reusable workflows from `llm-d/llm-d-infra`

**Gaps**:
- No test parallelization or matrix strategy for unit tests
- Limited caching beyond Go modules (no Docker layer cache in CI)
- No Copilot/AI review integration beyond setup steps

### Static Analysis

**golangci-lint** (`.golangci.yml`):
- Version: v2.11.4
- 7 linters enabled: `depguard`, `errcheck`, `gochecknoglobals`, `govet`, `staticcheck`, `unused`, `wrapcheck`
- Custom `depguard` rule: bans `log` package in non-test code (enforces logr usage)
- Targeted exclusions for metrics, version vars, and existing code
- Test files excluded from `gochecknoglobals` and `wrapcheck`

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- General: trailing-whitespace, end-of-file-fixer, check-yaml, check-json, check-added-large-files (1MB limit), check-merge-conflict, mixed-line-ending, check-case-conflict
- Go: go-fmt, go-mod-tidy, go-build, go-vet, goimports (optional), golangci-lint (optional), gosec (optional)
- Release: release-notes fragment linting
- Run in CI via `pre-commit/action@v3.0.1`

**Dependabot** (`.github/dependabot.yml`):
- 3 ecosystems: github-actions, gomod, docker
- Weekly schedule for all
- 10 PR limit for Go modules
- Grouped k8s dependencies
- Ignores major version bumps (except actions)
- Conventional commit prefixes: `deps(actions)`, `deps(go)`, `deps(docker)`

**Additional Tools**:
- `.yamllint.yml` — YAML linting configuration
- `.typos.toml` — Typo checking configuration
- `gosec` — Security scanning in pre-commit (optional)

**FIPS Compatibility**:
- `math/rand` imported in `pkg/asyncworker/worker.go:9` — used for jitter, not crypto, but flagged in FIPS audits
- No FIPS build tags (`-tags=fips`, `GOEXPERIMENT=boringcrypto`)
- Non-UBI base images: `quay.io/projectquay/golang:1.26` (builder), `gcr.io/distroless/static:nonroot` (runtime)

### Agent Rules

**CLAUDE.md** (root):
- General principles: think before coding, simplicity first, surgical changes
- Code conventions: logr logging, compile-time interface verification, error wrapping, no mutable globals, no panic, YAGNI
- Build commands: `make build`, `make ci`, `make lint`, `make lint-fix`
- Testing commands: `make test`, `make test-integration`, `make test-all`, `make test-e2e`
- Multi-module documentation

**Gaps**:
- No `.claude/` directory or `.claude/rules/`
- No test-specific rules (unit test patterns, integration test conventions, E2E test framework guidance)
- No AGENTS.md
- CLAUDE.md doesn't include framework-specific examples (testify assertions, gomega matchers, envtest patterns)

## Recommendations

### Priority 0 (Critical)

1. **Add codecov integration with coverage thresholds**
   - Create `.codecov.yml` with project target (70%) and patch target (50%)
   - Add `codecov/codecov-action@v5` step to pre-commit workflow after test step
   - Upload both `cover.out` and `producer/cover-producer.out`
   - Effort: 4-6 hours

2. **Evaluate UBI-based images for FIPS environments**
   - Replace `gcr.io/distroless/static:nonroot` with `registry.access.redhat.com/ubi9-micro:latest`
   - Replace builder image with UBI-based Go builder
   - Add FIPS build tags if needed for downstream consumption
   - Effort: 8-12 hours

3. **Address math/rand import**
   - Replace `math/rand` in `pkg/asyncworker/worker.go` with `math/rand/v2` (Go 1.22+) or explicitly document non-security context
   - Effort: 1-2 hours

### Priority 1 (High Value)

4. **Add PR-triggered E2E tests**
   - Add `pull_request` trigger to `ci-e2e-tests.yaml` with path filter for code changes
   - Consider running a subset of E2E tests on PRs (focused suite) and full suite nightly
   - Effort: 4-6 hours

5. **Create comprehensive agent rules**
   - Create `.claude/rules/unit-tests.md` with testify patterns, envtest usage, table-driven tests
   - Create `.claude/rules/e2e-tests.md` with Ginkgo/Gomega conventions, Kind cluster patterns
   - Create `.claude/rules/integration-tests.md` with mock server patterns, Redis fixtures
   - Effort: 2-3 hours (or use `/test-rules-generator`)

6. **Add t.Parallel() to unit tests**
   - Systematically add `t.Parallel()` to unit test functions
   - Identifies hidden shared state bugs and improves CI speed
   - Effort: 2-3 hours

### Priority 2 (Nice-to-Have)

7. **Add Dockerfile HEALTHCHECK**
   - Add `HEALTHCHECK --interval=30s --timeout=5s CMD ["/async-processor", "--health-check"]` or equivalent
   - Effort: 1-2 hours

8. **Add PR-time manifest validation**
   - Add `kustomize build config/default | kubectl apply --dry-run=client -f -` to CI
   - Add `helm template charts/async-processor | kubectl apply --dry-run=client -f -`
   - Effort: 2-3 hours

9. **Add multi-K8s-version matrix for E2E**
   - Test against multiple Kubernetes versions (e.g., 1.30, 1.31, 1.32) in E2E workflow
   - Effort: 4-6 hours

10. **Enable multi-arch CI builds**
    - Add `docker-buildx` with `linux/arm64,linux/amd64` to release workflow
    - Effort: 2-4 hours

## Comparison to Gold Standards

| Capability | llm-d-async | odh-dashboard | notebooks | kserve |
|-----------|-------------|---------------|-----------|--------|
| Unit test ratio | 2:1 LOC (excellent) | Multi-layer | Moderate | Strong |
| E2E automation | Nightly (Kind) | PR-triggered | PR-triggered | Multi-version |
| Coverage enforcement | None | Codecov gates | Codecov | Codecov threshold |
| Build integration | PR container build | PR + Konflux | Multi-stage | PR + kind |
| Image testing | Multi-stage distroless | Runtime validation | 5-layer validation | Container tests |
| Static analysis | golangci-lint v2 + pre-commit | ESLint + TypeScript | Linting | golangci-lint |
| Agent rules | CLAUDE.md only | Comprehensive rules | Basic | Moderate |
| Dependabot | 3 ecosystems | Configured | Configured | Configured |
| FIPS | No (distroless) | UBI-based | UBI-based | UBI-based |

## File Paths Reference

### CI/CD
- `.github/workflows/pre-commit.yml` — Main PR validation (pre-commit, integration tests, container build)
- `.github/workflows/ci-e2e-tests.yaml` — Nightly E2E test suite
- `.github/workflows/ci-release.yaml` — Release image build and push
- `.github/workflows/ci-build-images.yaml` — Reusable image build workflow
- `.github/workflows/ci-dco-signoff.yml` — DCO sign-off check
- `.github/workflows/ci-signed-commits.yaml` — Signed commit verification
- `.github/workflows/ci-tag-submodules.yaml` — Auto-tag Go submodules

### Testing
- `pkg/` — 19 unit test files (asyncworker, redis, pubsub, plugins, metrics, server, util, flowcontrol, mergepolicy)
- `internal/` — 3 unit test files (health, logging, otel)
- `cmd/main_test.go` — Main entrypoint tests
- `api/internal_api_test.go` — API unit tests
- `producer/redis_sortedset_producer_test.go` — Producer unit tests
- `test/e2e/` — 14 E2E test files (Ginkgo/Gomega, Kind cluster)
- `test/integration/` — 12 integration test files (mock servers)
- `charts/async-processor/tests/` — 2 Helm unit test files

### Build & Image
- `Dockerfile` — Multi-stage build (golang → distroless)
- `Makefile` — Build, test, deploy targets
- `charts/async-processor/` — Helm chart for Kubernetes deployment

### Static Analysis
- `.golangci.yml` — golangci-lint v2 configuration (7 linters)
- `.pre-commit-config.yaml` — Pre-commit hooks (12 hooks)
- `.github/dependabot.yml` — Dependabot for github-actions, gomod, docker
- `.yamllint.yml` — YAML linting
- `.typos.toml` — Typo checking

### Agent Rules
- `CLAUDE.md` — Code conventions, build/test commands, multi-module docs
