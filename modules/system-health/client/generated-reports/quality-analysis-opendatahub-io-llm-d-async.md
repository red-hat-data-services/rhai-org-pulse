---
repository: "opendatahub-io/llm-d-async"
overall_score: 7.0
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Excellent test-to-code ratio (1.18) with Go testing + testify, plus Helm chart unit tests"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Comprehensive integration (miniredis) and E2E suite (Kind + Ginkgo), but E2E runs nightly only"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time container build + Tekton Konflux pipeline, but no PR-time deployment validation"
  - dimension: "Image Testing"
    score: 5.0
    status: "Dual Dockerfiles with multi-stage builds and multi-arch, but no runtime validation"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "coverprofile generated locally but no CI integration, thresholds, or enforcement"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "14 workflows with concurrency control, failure alerting, and Tekton Konflux pipelines"
  - dimension: "Static Analysis"
    score: 8.0
    status: "golangci-lint with 7 linters, pre-commit hooks, Dependabot, FIPS-aware Konflux build"
  - dimension: "Agent Rules"
    score: 6.0
    status: "Solid CLAUDE.md with conventions and commands, but no .claude/rules/ or test-specific rules"
critical_gaps:
  - title: "No coverage tracking in CI"
    impact: "Coverage regressions go undetected — no thresholds, no PR reporting, no historical tracking"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container runtime validation"
    impact: "Image startup failures and misconfigurations not caught until deployment"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "E2E tests not triggered on PRs"
    impact: "Regressions caught only by nightly runs, delaying feedback by up to 24 hours"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add Codecov integration with coverage thresholds"
    effort: "2-4 hours"
    impact: "Automated coverage tracking, PR comments, regression prevention"
  - title: "Add test-specific agent rules in .claude/rules/"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality and consistency across unit/integration/E2E"
  - title: "Add t.Parallel() to unit tests"
    effort: "2-3 hours"
    impact: "Faster test execution and improved test isolation"
recommendations:
  priority_0:
    - "Add Codecov integration with .codecov.yml and coverage thresholds (e.g., 70% project, 5% patch minimum)"
    - "Add HEALTHCHECK to Dockerfiles and container startup validation in CI"
  priority_1:
    - "Trigger E2E tests on PRs for critical path changes (or at minimum as an opt-in label trigger)"
    - "Create .claude/rules/ with unit-tests.md, integration-tests.md, and e2e-tests.md"
    - "Replace math/rand with crypto/rand or math/rand/v2 in worker.go for FIPS cleanliness"
  priority_2:
    - "Add t.Parallel() to unit tests for faster execution and better isolation"
    - "Add performance/load testing for dispatch throughput benchmarking"
    - "Consider adding contract tests for the api/ module boundary"
---

# Quality Analysis: llm-d-async

**Repository**: [opendatahub-io/llm-d-async](https://github.com/opendatahub-io/llm-d-async)
**Analysis Date**: 2026-07-20
**Jira**: INFERENG / llm-d (midstream)
**Type**: Go service — asynchronous dispatch processor for llm-d inference

## Executive Summary

- **Overall Score: 7.0/10**
- **Key Strengths**: Excellent test coverage ratio (1.18 test-to-source), comprehensive integration and E2E test suites, strong CI/CD pipeline with 14 workflows, well-configured linting and pre-commit hooks, FIPS-aware Konflux builds
- **Critical Gaps**: No CI coverage tracking or enforcement, no container runtime validation, E2E tests run nightly only (not on PRs)
- **Agent Rules Status**: Present (CLAUDE.md) but incomplete — lacks test-specific rules in `.claude/rules/`

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.0/10 | 15% | 1.20 | Excellent test-to-code ratio with Go testing + testify + Helm chart tests |
| Integration/E2E | 8.0/10 | 20% | 1.60 | Comprehensive integration (miniredis) and E2E (Kind + Ginkgo) suites |
| Build Integration | 7.0/10 | 15% | 1.05 | PR-time container build + Tekton Konflux, no PR-time deployment test |
| Image Testing | 5.0/10 | 10% | 0.50 | Multi-stage + multi-arch builds, no runtime validation |
| Coverage Tracking | 3.0/10 | 10% | 0.30 | coverprofile generated locally, no CI integration or thresholds |
| CI/CD Automation | 8.0/10 | 15% | 1.20 | Well-organized workflows with concurrency, caching, failure alerting |
| Static Analysis | 8.0/10 | 10% | 0.80 | golangci-lint (7 linters), pre-commit, Dependabot, FIPS-aware Konflux |
| Agent Rules | 6.0/10 | 5% | 0.30 | Solid CLAUDE.md, missing .claude/rules/ and test-specific guidance |
| **Overall** | **7.0/10** | **100%** | **6.95** | |

## Critical Gaps

### 1. No Coverage Tracking in CI
- **Severity**: HIGH
- **Impact**: Coverage regressions go completely undetected. The Makefile generates `cover.out` and `cover-producer.out` via `--coverprofile`, but these are never uploaded, tracked, or enforced in CI. No `.codecov.yml`, no coverage comment bot, no threshold gates.
- **Effort**: 4-6 hours
- **Fix**: Add Codecov integration with `.codecov.yml`, upload coverage in the pre-commit workflow, set project/patch thresholds.

### 2. No Container Runtime Validation
- **Severity**: MEDIUM
- **Impact**: Image startup issues (missing binaries, wrong entrypoint, permission errors) are only caught at deployment time. Neither Dockerfile includes a `HEALTHCHECK`. No Testcontainers or `docker run` smoke tests in CI.
- **Effort**: 4-6 hours
- **Fix**: Add a `docker run --rm <image> --help` smoke test after the `container-build` job, or add Testcontainers-based startup validation.

### 3. E2E Tests Not PR-Triggered
- **Severity**: MEDIUM
- **Impact**: The comprehensive E2E suite (`test/e2e/`, 14 test files, Kind cluster with full stack) runs only on nightly schedule and manual dispatch. Regressions may not be caught for up to 24 hours after merge.
- **Effort**: 2-4 hours
- **Fix**: Add a PR-triggered E2E job (possibly opt-in via label like `run-e2e`) or at minimum trigger on changes to `pkg/`, `cmd/`, `internal/`, or `test/e2e/`.

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
Upload the existing `cover.out` to Codecov and add threshold enforcement:

```yaml
# .codecov.yml
coverage:
  status:
    project:
      default:
        target: 70%
        threshold: 2%
    patch:
      default:
        target: 80%
```

Add to `pre-commit.yml` after the test step:
```yaml
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: cover.out,producer/cover-producer.out
    fail_ci_if_error: false
```

### 2. Add Test-Specific Agent Rules (2-3 hours)
Create `.claude/rules/` directory with rules for each test type. Generate these with `/test-rules-generator`:
- `unit-tests.md` — testify patterns, table-driven tests, error wrapping checks
- `integration-tests.md` — `//go:build integration` tag, miniredis usage, test isolation
- `e2e-tests.md` — Ginkgo/Gomega patterns, Kind cluster setup, cleanup

### 3. Add t.Parallel() to Unit Tests (2-3 hours)
No unit tests currently use `t.Parallel()`. Adding it improves execution time and reveals hidden shared state:
```go
func TestSomething(t *testing.T) {
    t.Parallel()
    // ...
}
```

## Detailed Findings

### Unit Tests

**Score: 8.0/10**

| Metric | Value |
|--------|-------|
| Test files (unit) | 36 (excluding e2e/integration) |
| Source files | 53 |
| Test-to-code ratio | 1.18 |
| Framework | Go `testing` + `testify/assert` + `testify/require` |
| Helm tests | 2 files (deployment_test.yaml, observability_test.yaml) |
| t.Parallel() | Not used |
| Table-driven tests | Present in some files |

**Strengths**:
- Every significant package has corresponding test files
- Strong coverage of flowcontrol subsystem (13 test files for gates, metrics, factories)
- Helm chart unit tests validate deployment manifests, security contexts, resource limits, and configuration guards
- Tests use `envtest` via `setup-envtest` for Kubernetes API testing
- Well-structured test helpers and utilities

**Gaps**:
- No `t.Parallel()` usage across any unit tests
- Some packages lack negative/error-path testing

**Key test files**:
- `pkg/async/inference/flowcontrol/*_test.go` — 13 files testing dispatch gates, metric sources, composite gates
- `pkg/asyncworker/worker_test.go`, `worker_transform_test.go` — worker dispatch and transform chain tests
- `charts/async-processor/tests/deployment_test.yaml` — 30+ Helm chart assertions

### Integration/E2E Tests

**Score: 8.0/10**

**Integration Tests** (`test/integration/`, 12 files):
- Build tag: `//go:build integration` — properly isolated from unit tests
- Uses `miniredis/v2` for in-process Redis testing (no external dependency)
- Coverage: Redis pub/sub, sorted set, dispatch gates, quota gates, worker dispatch, OTel, Prometheus gate factory, merge policies, endpoint scrape
- Run on every PR via `make test-integration` in `pre-commit.yml`

**E2E Tests** (`test/e2e/`, 14 files):
- Framework: Ginkgo v2 + Gomega
- Infrastructure: Kind cluster with full stack — async-processor, EPP, llm-d-inference-sim, Envoy, Prometheus, Redis, Jaeger
- Test scenarios: end-to-end processing, budget gates, composite gates, saturation gates, tier priority, multi-tenant, multi-tenant merge, health checks, OTel tracing, attribute gates, endpoint scrape gates, query gates
- Helm chart values for each test scenario in `test/e2e/helm/`
- Kubernetes YAML manifests for test infrastructure in `test/e2e/yaml/`
- 45-minute timeout with artifact collection on failure
- Auto-creates GitHub issues on nightly failure

**Gaps**:
- E2E tests are nightly/manual only — not triggered on PRs
- No multi-version Kubernetes testing (single K8s version)

### Build Integration

**Score: 7.0/10**

**PR-Time Build Validation**:
- `container-build` job in `pre-commit.yml` builds Docker image on PRs (`docker buildx build --platform linux/amd64`, no push)
- Only runs when code files change (excludes docs, markdown, LICENSE)
- Tekton Konflux pipeline (`.tekton/odh-llm-d-async-pull-request.yaml`) builds from `Dockerfile.konflux` on PRs to main
- Builds multi-arch via `multi-arch-container-build.yaml` pipeline

**CI Build Chain**:
- `make ci` target runs: fmt → vet → lint → test
- `make build` compiles binary with LDFLAGS for version injection
- Pre-commit hooks include `go build` verification
- Helm lint + unittest in PR workflow

**Gaps**:
- No PR-time Kind/deployment testing (only nightly E2E)
- No Kustomize dry-run validation in CI
- Konflux pipeline is building the image but not running any validation against it

### Image Testing

**Score: 5.0/10**

**Dockerfile Analysis**:

| Aspect | Dockerfile | Dockerfile.konflux |
|--------|-----------|-------------------|
| Base (builder) | `quay.io/projectquay/golang:1.26` | `registry.access.redhat.com/ubi9/go-toolset:1.25.8` (pinned SHA) |
| Base (runtime) | `gcr.io/distroless/static:nonroot` | `registry.access.redhat.com/ubi9/ubi-minimal:9.7` (pinned SHA) |
| Multi-stage | Yes | Yes |
| Non-root user | `USER 65532:65532` | `USER 1001:1001` |
| CGO_ENABLED | 0 (static binary) | 1 (FIPS-compatible) |
| FIPS | No | `GOEXPERIMENT=strictfipsruntime` |
| Image pinning | Tag only | SHA256 digest pinned |

**Multi-arch**: Release workflow builds for `linux/amd64,linux/arm64` using `docker buildx`.

**Strengths**:
- Proper multi-stage builds with dep caching layer
- Non-root user in both images
- Konflux Dockerfile has SHA-pinned base images and FIPS configuration
- Separate Dockerfiles for upstream (distroless) and downstream (UBI9)

**Gaps**:
- No `HEALTHCHECK` in either Dockerfile
- No container startup validation in CI (no `docker run` smoke test)
- No Testcontainers or runtime testing
- No `.dockerignore` for build context optimization (actually present: `.dockerignore` is not listed — this is a minor gap)

### Coverage Tracking

**Score: 3.0/10**

**Current State**:
- Makefile `test` target generates `cover.out` via `--coverprofile`
- Producer submodule generates `cover-producer.out`
- Coverage is purely local — not uploaded, tracked, or enforced

**Missing**:
- No `.codecov.yml` or `codecov.yml`
- No `codecov/codecov-action` in any workflow
- No coverage threshold enforcement
- No PR coverage reporting or comments
- No historical coverage tracking
- Integration tests (`test/integration/`) do not generate coverage

### CI/CD Automation

**Score: 8.0/10**

**Workflow Inventory** (14 workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pre-commit.yml` | PR, push to main/release | Lint, build, integration tests, container build, Helm tests |
| `ci-e2e-tests.yaml` | Nightly (3:17 UTC), manual | Full E2E suite on Kind cluster |
| `ci-release.yaml` | Push to main, tags, releases | Build + push multi-arch images, publish Helm chart |
| `ci-build-images.yaml` | Reusable (called by release) | Build and push container images |
| `ci-dco-signoff.yml` | PR | DCO sign-off verification |
| `ci-signed-commits.yaml` | PR | Signed commit verification |
| `ci-tag-submodules.yaml` | Tags | Tag Go submodules on release |
| `non-main-gatekeeper.yml` | PR | Branch protection enforcement |
| `pre-commit.yml` (container-build) | PR (code changes) | Docker image build validation |
| `prow-github.yml` | Issue comments | Prow-style commands (/lgtm, /approve) |
| `prow-pr-automerge.yml` | Prow events | Auto-merge approved PRs |
| `prow-pr-remove-lgtm.yml` | Prow events | Remove LGTM on new pushes |
| `stale.yaml` | Daily (1:00 UTC) | Mark stale issues |
| `unstale.yaml` | Events | Unstale issues on activity |
| `copilot-setup-steps.yml` | Codespaces/Copilot | Dev environment setup |

**Tekton Pipelines**:
- `odh-llm-d-async-pull-request.yaml` — Konflux PR build
- `odh-llm-d-async-push.yaml` — Konflux push build

**Strengths**:
- Concurrency control on pre-commit, E2E, and DCO workflows
- Go dependency caching in pre-commit
- 45-minute timeout on E2E tests
- Artifact upload on E2E failure (Kind logs, pod descriptions, events, processor logs)
- Auto-create GitHub issues on nightly E2E failure
- Path-based filtering (`check-code-changes`) to skip container builds on docs-only changes

**Gaps**:
- No test parallelization (matrix strategy) in CI
- Go cache only in pre-commit, not in E2E workflow
- No scheduled unit test runs (only integration tests in pre-commit)

### Static Analysis

**Score: 8.0/10**

**golangci-lint** (`.golangci.yml`, v2.11.4):
- 7 linters enabled: `depguard`, `errcheck`, `gochecknoglobals`, `govet`, `staticcheck`, `unused`, `wrapcheck`
- Targeted exclusions for known patterns (Prometheus metrics, version vars, existing unwrapped errors)
- Test files excluded from `gochecknoglobals` and `wrapcheck`
- `depguard` enforces `logr` over stdlib `log` in production code

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- Standard hooks: trailing-whitespace, end-of-file-fixer, check-yaml, check-json, check-added-large-files (1MB limit), check-merge-conflict, mixed-line-ending, check-case-conflict
- Go hooks: go-fmt, go-mod-tidy, go-build, go-vet, goimports (optional), golangci-lint (optional), gosec (optional)
- Custom: release-notes fragment linting

**Additional Tools**:
- `.yamllint.yml` — YAML linting configuration
- `.typos.toml` — Typo detection configuration

**FIPS Compatibility**:
- Konflux Dockerfile: `GOEXPERIMENT=strictfipsruntime`, `CGO_ENABLED=1`, UBI9 base images — **FIPS-compliant build**
- Upstream Dockerfile: `CGO_ENABLED=0`, distroless base — not FIPS-targeted (expected for upstream)
- Source: `math/rand` imported in `pkg/asyncworker/worker.go` — not cryptographic context but worth cleaning up for FIPS hygiene

**Dependency Alerts** (`.github/dependabot.yml`):
- Covers 3 ecosystems: `github-actions`, `gomod`, `docker`
- Weekly schedule with grouped updates (Kubernetes deps, Go deps)
- Ignores major version bumps for k8s.io and sigs.k8s.io (intentional)
- Commit message prefixes (`deps(actions)`, `deps(go)`, `deps(docker)`)
- No Renovate (Dependabot is sufficient)

### Agent Rules

**Score: 6.0/10**

**CLAUDE.md** (root):
- General principles: think before coding, simplicity first, surgical changes
- Code conventions: logr logging, interface compliance, error wrapping, no mutable globals, no panic, YAGNI, porting rules
- Build & verify: `make build`, `make ci`, `make lint`, `make lint-fix`
- Testing: `make test`, `make test-integration`, `make test-all`, `make test-e2e`
- Multi-module documentation: root, `api/`, `pipeline/`, `producer/`

**Strengths**:
- Comprehensive coding conventions specific to this project
- Clear build/test command reference
- Multi-module repo awareness

**Gaps**:
- No `.claude/` directory
- No `.claude/rules/` with test-specific rules
- No AGENTS.md
- No test creation guidelines (what framework to use, how to structure tests, assertion patterns)
- No example test patterns for the different test types (unit, integration, E2E)

## Recommendations

### Priority 0 (Critical)

1. **Add Codecov integration with coverage thresholds**
   - Create `.codecov.yml` with project target (70%) and patch target (80%)
   - Add `codecov/codecov-action` to pre-commit workflow after test step
   - Upload both `cover.out` and `cover-producer.out`
   - Effort: 2-4 hours

2. **Add container runtime validation**
   - Add `docker run --rm <image> --help` smoke test after container-build in pre-commit workflow
   - Add `HEALTHCHECK` to Dockerfiles
   - Effort: 4-6 hours

### Priority 1 (High Value)

3. **Enable PR-triggered E2E tests**
   - Add E2E as a separate PR job, triggered by label (`run-e2e`) or on changes to `pkg/`, `cmd/`, `internal/`
   - Alternatively, run a subset of E2E tests on PRs (smoke tests) and full suite nightly
   - Effort: 2-4 hours

4. **Create test-specific agent rules**
   - Create `.claude/rules/unit-tests.md` — testify patterns, table-driven tests, error wrapping
   - Create `.claude/rules/integration-tests.md` — `//go:build integration`, miniredis, test isolation
   - Create `.claude/rules/e2e-tests.md` — Ginkgo/Gomega patterns, Kind cluster, Helm values
   - Use `/test-rules-generator` to bootstrap
   - Effort: 2-3 hours

5. **Clean up math/rand usage**
   - Replace `math/rand` import in `pkg/asyncworker/worker.go` with `math/rand/v2` (Go 1.22+) for FIPS cleanliness
   - Effort: 1 hour

### Priority 2 (Nice-to-Have)

6. **Add t.Parallel() to unit tests** for faster execution and isolation — effort: 2-3 hours
7. **Add multi-version K8s testing** in E2E suite (matrix strategy for K8s versions) — effort: 4-6 hours
8. **Add performance benchmarks** for dispatch throughput (`go test -bench`) — effort: 4-6 hours
9. **Add contract tests** for the `api/` module boundary — effort: 4-6 hours

## Comparison to Gold Standards

| Practice | llm-d-async | odh-dashboard | notebooks | kserve |
|----------|-------------|---------------|-----------|--------|
| Unit test ratio | 1.18 (excellent) | High | Medium | High |
| Integration tests | 12 files, miniredis | Contract tests | N/A | envtest |
| E2E tests | Kind + Ginkgo (nightly) | Cypress + CI | Image validation | Kind + multi-version |
| PR container build | Yes (buildx) | Yes | Yes | Yes |
| Konflux pipeline | Yes (PR + push) | Yes | Yes | Yes |
| Coverage enforcement | None | Codecov | None | Codecov |
| golangci-lint | 7 linters | Yes | N/A | Yes |
| Pre-commit hooks | Comprehensive | Yes | Partial | Partial |
| FIPS compliance | Konflux only | Yes | Yes | Yes |
| Dependabot | 3 ecosystems | Yes | Yes | Yes |
| Agent rules (CLAUDE.md) | Present | Comprehensive | Partial | Partial |
| Agent rules (.claude/rules/) | Missing | Present | Missing | Missing |
| Helm chart tests | Yes (unittest) | N/A | N/A | N/A |

## File Paths Reference

### CI/CD
- `.github/workflows/pre-commit.yml` — Main PR workflow (lint, test, build)
- `.github/workflows/ci-e2e-tests.yaml` — Nightly E2E test suite
- `.github/workflows/ci-release.yaml` — Release and image publishing
- `.tekton/odh-llm-d-async-pull-request.yaml` — Konflux PR build
- `.tekton/odh-llm-d-async-push.yaml` — Konflux push build
- `Makefile` — Build targets (ci, test, test-integration, test-e2e, lint)

### Testing
- `pkg/async/inference/flowcontrol/*_test.go` — Unit tests (13 files)
- `pkg/asyncworker/*_test.go` — Worker unit tests (4 files)
- `test/integration/` — Integration tests (12 files, `//go:build integration`)
- `test/e2e/` — E2E tests (14 files, Ginkgo/Gomega)
- `charts/async-processor/tests/` — Helm chart unit tests (2 files)

### Code Quality
- `.golangci.yml` — Linter configuration (7 linters)
- `.pre-commit-config.yaml` — Pre-commit hooks (12 hooks)
- `.yamllint.yml` — YAML linting
- `.typos.toml` — Typo detection
- `.github/dependabot.yml` — Dependency alerts (3 ecosystems)

### Container Images
- `Dockerfile` — Upstream (distroless, CGO_ENABLED=0)
- `Dockerfile.konflux` — Downstream (UBI9, FIPS, CGO_ENABLED=1)

### Agent Rules
- `CLAUDE.md` — Root-level agent rules and conventions
