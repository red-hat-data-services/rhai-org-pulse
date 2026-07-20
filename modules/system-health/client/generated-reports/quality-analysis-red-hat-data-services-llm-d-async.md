---
repository: "red-hat-data-services/llm-d-async"
overall_score: 7.4
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Excellent test-to-code ratio (2:1 lines), 20/21 packages have tests"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Comprehensive E2E suite with Ginkgo/Gomega, Kind cluster integration, nightly schedule"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time container build validation, Konflux Tekton pipeline, but no Konflux simulation in GH Actions"
  - dimension: "Image Testing"
    score: 5.5
    status: "Multi-stage builds with UBI/distroless, health probes in Helm, but no runtime validation or .dockerignore"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "Coverprofile generated locally but no codecov integration, no PR gates, no threshold enforcement"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "Well-organized workflows with concurrency control, Prow commands, nightly E2E, artifact collection"
  - dimension: "Static Analysis"
    score: 8.5
    status: "Strong golangci-lint (7 linters), pre-commit hooks enforced in CI, Dependabot for 3 ecosystems, FIPS in Konflux build"
  - dimension: "Agent Rules"
    score: 6.0
    status: "CLAUDE.md with build/test/convention guidance, but no .claude/rules/ directory or test-specific rules"
critical_gaps:
  - title: "No coverage tracking or PR gates"
    impact: "Coverage can silently regress — no Codecov integration, no PR-level coverage reporting, no threshold enforcement"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container runtime validation"
    impact: "Image startup failures not caught until deployment; no smoke test after build"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "math/rand used in production code (pkg/asyncworker/worker.go)"
    impact: "Non-FIPS-compliant PRNG in production path — already annotated as non-security but should be reviewed for FIPS-strict builds"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No .dockerignore file"
    impact: "Unnecessary files (docs, tests, .git) included in Docker build context, slowing builds"
    severity: "LOW"
    effort: "1 hour"
quick_wins:
  - title: "Add Codecov integration with PR coverage reporting"
    effort: "3-4 hours"
    impact: "Automated coverage tracking, PR-level diffs, regression detection"
  - title: "Add .dockerignore file"
    effort: "30 minutes"
    impact: "Faster container builds by excluding docs, tests, .git from build context"
  - title: "Add container smoke test to PR workflow"
    effort: "2-3 hours"
    impact: "Catch image startup failures before merge"
  - title: "Create .claude/rules/ with test-specific agent rules"
    effort: "2-3 hours"
    impact: "Better AI-generated test quality and consistency"
recommendations:
  priority_0:
    - "Add Codecov integration with .codecov.yml and PR-level coverage reporting to catch regressions"
    - "Enforce minimum coverage threshold (e.g., 70%) as a PR gate"
  priority_1:
    - "Add container runtime smoke test (build + startup check) to the PR workflow"
    - "Create .claude/rules/ directory with unit-test and e2e-test creation rules"
    - "Review math/rand usage in worker.go for FIPS compliance in Konflux builds"
    - "Add .dockerignore to exclude docs, tests, .git, and build artifacts from container builds"
  priority_2:
    - "Enable t.Parallel() in unit tests for faster test execution"
    - "Add contract tests for the async API boundary"
    - "Consider running E2E tests on PRs (or a subset) in addition to the nightly schedule"
---

# Quality Analysis: llm-d-async

## Executive Summary

- **Overall Score: 7.4/10**
- **Repository**: `red-hat-data-services/llm-d-async` (downstream)
- **Type**: Go service — asynchronous dispatch processor for llm-d
- **Jira**: INFERENG / llm-d component
- **Language**: Go (multi-module: root, api/, pipeline/, producer/)
- **Size**: ~8,077 lines of source code, ~16,622 lines of tests

**Key Strengths**:
- Exceptional test-to-code ratio — more test code (16.6K lines) than source (8K lines)
- All 20 production packages (out of 21 total) have corresponding unit tests
- Comprehensive E2E suite using Ginkgo/Gomega with Kind cluster, 14 test files covering gates, multi-tenant, OTel, health
- Strong CI pipeline with PR-time container build, pre-commit enforcement, DCO checks, Prow integration
- Well-configured golangci-lint with 7 linters including `wrapcheck`, `depguard`, `gochecknoglobals`
- Dependabot covering 3 ecosystems (gomod, GitHub Actions, Docker)
- FIPS-compliant Konflux Dockerfile using UBI9 + `GOEXPERIMENT=strictfipsruntime`
- Helm chart with unit tests, health probes (startup/liveness/readiness)

**Critical Gaps**:
- No coverage tracking integration (Codecov/Coveralls) — coverage is generated locally but never reported or enforced
- No container runtime validation in CI
- Missing `.dockerignore` file

**Agent Rules Status**: Partial — `CLAUDE.md` present with good conventions but no `.claude/rules/` directory

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 8.5/10 | Excellent ratio, 20/21 packages tested |
| Integration/E2E | 20% | 8.0/10 | Comprehensive E2E + integration suites |
| Build Integration | 15% | 7.0/10 | PR container build, Konflux pipeline present |
| Image Testing | 10% | 5.5/10 | Multi-stage builds, probes, but no runtime test |
| Coverage Tracking | 10% | 4.0/10 | Local coverprofile only, no integration |
| CI/CD Automation | 15% | 8.0/10 | Well-organized, concurrency control, nightly E2E |
| Static Analysis | 10% | 8.5/10 | Strong linting, pre-commit, Dependabot, FIPS |
| Agent Rules | 5% | 6.0/10 | CLAUDE.md present, no .claude/rules/ |

**Weighted Overall: 7.4/10**

## Critical Gaps

### 1. No Coverage Tracking or PR Gates (HIGH)
- **Issue**: `make test` generates `cover.out` and `cover-producer.out` locally, but there is no `.codecov.yml`, no Codecov/Coveralls GitHub Action, and no coverage threshold enforcement
- **Impact**: Coverage can silently regress with each PR — no automated reporting, no baseline, no PR-level diff
- **Effort**: 4-6 hours
- **Files affected**: `.codecov.yml` (new), `.github/workflows/pre-commit.yml`

### 2. No Container Runtime Validation (MEDIUM)
- **Issue**: The PR workflow builds the container image (`docker buildx build`) but does not run it to verify startup. No Testcontainers or equivalent smoke test exists
- **Impact**: Image startup failures (missing deps, entrypoint errors, config issues) are not caught until deployment
- **Effort**: 4-6 hours
- **Files affected**: `.github/workflows/pre-commit.yml`

### 3. math/rand in Production Code (MEDIUM)
- **Issue**: `pkg/asyncworker/worker.go:9` imports `math/rand` for jitter calculation. The usage is annotated with `#nosec G404` and is not security-sensitive, but under `GOEXPERIMENT=strictfipsruntime` (used in `Dockerfile.konflux`), this should be reviewed
- **Impact**: Potential FIPS compliance concern in downstream builds
- **Effort**: 1-2 hours

### 4. Missing .dockerignore (LOW)
- **Issue**: No `.dockerignore` file exists — the entire repository (including docs, tests, .git, scalability_report.md) is sent as Docker build context
- **Impact**: Slower container builds, larger context transfers
- **Effort**: 30 minutes

## Quick Wins

### 1. Add Codecov Integration (3-4 hours)
Create `.codecov.yml` and add the `codecov/codecov-action` to the CI workflow:
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
        target: 70%
```

### 2. Add .dockerignore (30 minutes)
```
.git
.github
.tekton
docs
test
*.md
scalability_report.md
.golangci.yml
.pre-commit-config.yaml
```

### 3. Container Smoke Test in PR Workflow (2-3 hours)
Add after the container build step in `pre-commit.yml`:
```yaml
- name: Smoke test container
  run: |
    docker run --rm -d --name smoke-test \
      test-build:pr-${{ github.event.pull_request.number }} \
      --help || true
    docker logs smoke-test 2>&1 || true
    docker stop smoke-test 2>/dev/null || true
```

### 4. Create Agent Test Rules (2-3 hours)
Generate `.claude/rules/unit-tests.md` and `.claude/rules/e2e-tests.md` using `/test-rules-generator` to provide framework-specific guidance for Ginkgo/Gomega E2E tests and standard Go unit tests.

## Detailed Findings

### Unit Tests (8.5/10)

**Strengths**:
- Outstanding test-to-code ratio: 63 test files vs 53 source files; 16,622 test lines vs 8,077 source lines (~2:1)
- 20 out of 21 production packages have unit tests (only `pkg/version` lacks tests)
- `pkg/async/inference/flowcontrol` has 1:1 test file parity (13 source files, 13 test files)
- Tests use standard Go testing + `testify/assert` and `testify/require` for assertions
- Coverage profiles generated per-module: `cover.out` (root) and `cover-producer.out`
- Dedicated `make test` target that runs fmt, vet, and envtest before tests

**Gaps**:
- No `t.Parallel()` usage found across any unit test — tests run sequentially
- `pkg/version` has no unit tests
- Some packages have fewer test files than source files (e.g., `pkg/redis` has 6 source and 3 test files, `pkg/plugins` has 4 source and 1 test file)

**Key Files**:
- `Makefile:102-104` — test target with coverprofile
- `pkg/async/inference/flowcontrol/*_test.go` — most comprehensive test suite

### Integration/E2E Tests (8.0/10)

**Strengths**:
- Dedicated `test/integration/` directory with 12 test files covering Redis, PubSub, dispatch gates, Prometheus, worker dispatch, OTel, merge policies
- Dedicated `test/e2e/` directory with 14 test files using Ginkgo/Gomega framework
- E2E tests deploy a full Kind cluster with async-processor, EPP, llm-d-inference-sim, Envoy, Prometheus, and Redis
- Comprehensive E2E scenarios: composite gates, budget gates, attribute gates, saturation gates, multi-tenant, multi-tenant merge, OTel, health, tier priority, endpoint scrape, query gates
- Nightly E2E schedule (`cron: '17 3 * * *'`) with auto-issue creation on failure
- Artifact collection on failure (Kind cluster logs, pod descriptions, events)
- Integration tests executable via `make test-integration` with `//go:build integration` tag
- `make test-all` runs unit + integration tests together
- E2E supports `FOCUS` and `SKIP` patterns via workflow dispatch for targeted debugging

**Gaps**:
- E2E tests run only nightly and on manual dispatch — not on PRs (though integration tests run on PRs)
- No multi-K8s-version matrix testing
- No contract tests for the async API boundary

**Key Files**:
- `.github/workflows/ci-e2e-tests.yaml` — nightly E2E workflow
- `test/e2e/e2e_suite_test.go` — Ginkgo test suite setup
- `test/integration/` — integration tests spawning mock servers

### Build Integration (7.0/10)

**Strengths**:
- PR-time container build in `pre-commit.yml` using `docker buildx` (no push, build-only validation)
- Builds skip when only docs/markdown change (smart path filtering via `dorny/paths-filter`)
- Konflux/Tekton pipeline defined in `.tekton/odh-llm-d-async-pull-request.yaml` for downstream builds
- Tekton is auto-synced from `konflux-central` repository
- `make docker-build` and `make docker-buildx` (multi-arch) targets available
- Helm chart with unit tests (`helm unittest charts/async-processor`)
- Helm lint runs in PR workflow

**Gaps**:
- No PR-time Konflux build simulation (the Tekton pipeline exists but runs in the separate Konflux infrastructure)
- Container build validation is build-only — no startup or functional testing
- No `kustomize build --dry-run` validation in CI
- No operator manifest validation (kustomize overlays exist but are not tested)

**Key Files**:
- `.github/workflows/pre-commit.yml:67-82` — PR container build
- `.tekton/odh-llm-d-async-pull-request.yaml` — Konflux pipeline
- `Dockerfile` — development image (distroless)
- `Dockerfile.konflux` — downstream FIPS-compliant image (UBI9)

### Image Testing (5.5/10)

**Strengths**:
- Multi-stage build in both Dockerfiles (builder + minimal runtime)
- `Dockerfile.konflux` uses UBI9 base images with pinned SHA digests for reproducibility
- `Dockerfile` uses `gcr.io/distroless/static:nonroot` — minimal attack surface
- Non-root user in both images (65532 for distroless, 1001 for UBI)
- Multi-architecture support defined via `PLATFORMS ?= linux/arm64,linux/amd64` and `docker-buildx` target
- `TARGETARCH` and `TARGETOS` ARGs properly used
- Helm chart defines comprehensive health probes (startup, liveness, readiness) with configurable thresholds

**Gaps**:
- No `.dockerignore` file — entire repo context is sent during builds
- No HEALTHCHECK directive in Dockerfiles
- No container runtime testing (Testcontainers or equivalent)
- No image startup smoke test in CI
- No image size tracking or monitoring
- The development Dockerfile uses `quay.io/projectquay/golang:1.26` without SHA pinning

**Key Files**:
- `Dockerfile` — development/upstream image
- `Dockerfile.konflux` — downstream FIPS image
- `charts/async-processor/templates/ap-deployments.yaml:183-200` — K8s health probes

### Coverage Tracking (4.0/10)

**Strengths**:
- `make test` generates coverprofiles: `cover.out` (root module) and `cover-producer.out` (producer submodule)
- Coverage is generated as part of standard CI flow

**Gaps**:
- No `.codecov.yml` or `codecov.yml` configuration
- No `codecov/codecov-action` in any GitHub workflow
- No PR-level coverage reporting
- No coverage threshold enforcement
- No coverage trend tracking
- Coverage files are generated but never uploaded, compared, or gated
- This is the most significant quality gap in an otherwise well-tested repository

**Key Files**:
- `Makefile:103-104` — coverprofile generation

### CI/CD Automation (8.0/10)

**Strengths**:
- 16 workflow files covering a comprehensive CI/CD pipeline:
  - `pre-commit.yml` — PR gate (pre-commit hooks, integration tests, Helm lint, container build)
  - `ci-e2e-tests.yaml` — nightly E2E with auto-issue creation
  - `ci-release.yaml` — automated release builds on push to main and tags
  - `ci-build-images.yaml` — reusable image build workflow
  - `ci-dco-signoff.yml` — DCO verification
  - `ci-signed-commits.yaml` — commit signing checks
  - `ci-tag-submodules.yaml` — automated multi-module tagging
  - Prow integration (prow-github, prow-pr-automerge, prow-pr-remove-lgtm)
  - Stale/unstale issue management
- Concurrency control on 3 workflows (`ci-e2e-tests.yaml`, `ci-dco-signoff.yml`, `pre-commit.yml`)
- Go dependency caching enabled in `pre-commit.yml` (`cache: true` in `setup-go`)
- Timeout set on E2E tests (`timeout-minutes: 45`)
- Smart path filtering — container builds skip when only docs change
- Artifact upload on E2E failure with 7-day retention

**Gaps**:
- No matrix strategy for multi-version testing (single Go version, single K8s version)
- No test parallelization/sharding
- E2E not running on PRs (only nightly + manual)
- No caching in E2E workflow

**Key Files**:
- `.github/workflows/pre-commit.yml` — primary PR gate
- `.github/workflows/ci-e2e-tests.yaml` — nightly E2E
- `.github/workflows/ci-release.yaml` — release automation

### Static Analysis (8.5/10)

#### Linting
- **golangci-lint v2.11.4** with 7 linters enabled:
  - `depguard` — bans stdlib `log` (enforces `logr`)
  - `errcheck` — with sensible exclusions for Close methods
  - `gochecknoglobals` — prevents mutable globals (with targeted exclusions)
  - `govet` — standard Go vet
  - `staticcheck` — comprehensive static analysis
  - `unused` — dead code detection
  - `wrapcheck` — ensures error wrapping
- Well-maintained exclusion rules per-file where violations are justified (metrics, version vars, etc.)
- Additional tools: `ruff` config for Python code quality, `yamllint`, `typos` for spelling

#### Pre-commit Hooks
- Comprehensive `.pre-commit-config.yaml` with 14 hooks:
  - Standard hooks: trailing-whitespace, end-of-file-fixer, check-yaml, check-json, check-added-large-files, check-merge-conflict
  - Go hooks: go-fmt, go-mod-tidy, go-build, go-vet, goimports, golangci-lint, gosec
  - Custom: release-notes-lint
- Pre-commit hooks enforced in CI via `pre-commit/action@v3.0.1`

#### FIPS Compatibility
- `Dockerfile.konflux` uses `GOEXPERIMENT=strictfipsruntime` with `CGO_ENABLED=1`
- Builder image: `registry.access.redhat.com/ubi9/go-toolset` (FIPS-capable)
- Runtime image: `registry.access.redhat.com/ubi9/ubi-minimal` (FIPS-capable)
- Both Konflux images use SHA-pinned digests
- **Concern**: `pkg/asyncworker/worker.go:9` imports `math/rand` — annotated as `#nosec G404` for non-security jitter, but should be reviewed for strict FIPS environments
- `producer/redis_sortedset_producer.go` correctly uses `crypto/rand`

#### Dependency Alerts
- Dependabot configured for 3 ecosystems:
  - `gomod` — weekly updates with sensible ignore rules (major bumps, K8s major/minor)
  - `github-actions` — weekly
  - `docker` — weekly base image updates
- Dependency grouping for K8s packages and general Go deps
- PR limit of 10 for Go module updates

**Key Files**:
- `.golangci.yml` — linter configuration
- `.pre-commit-config.yaml` — hook configuration
- `.github/dependabot.yml` — dependency automation
- `Dockerfile.konflux:29` — FIPS build flags

### Agent Rules (6.0/10)

**Present**:
- `CLAUDE.md` at repository root with:
  - General principles (think before coding, simplicity first, surgical changes)
  - Code conventions (logging via logr, interface compliance, error wrapping, no mutable globals, no panic, YAGNI)
  - Build & verify commands (`make build`, `make ci`, `make lint`)
  - Testing commands (`make test`, `make test-integration`, `make test-all`, `make test-e2e`)
  - Multi-module repo guidance

**Missing**:
- No `.claude/` directory
- No `.claude/rules/` with framework-specific test rules (e.g., how to write Ginkgo E2E tests, what assertion patterns to use)
- No `AGENTS.md`
- No test-creation-specific rules (patterns for unit tests vs. integration tests vs. E2E tests)
- No quality gate checklists for PRs

**Recommendation**: Use `/test-rules-generator` to create `.claude/rules/unit-tests.md` and `.claude/rules/e2e-tests.md` with Go testing + Ginkgo/Gomega patterns.

## Recommendations

### Priority 0 (Critical)
1. **Add Codecov integration** — Create `.codecov.yml`, add `codecov/codecov-action` to `pre-commit.yml` after the test step, and set a project coverage target of 70% with a 2% threshold. This is the single highest-impact improvement for this repository.
2. **Enforce coverage thresholds on PRs** — Configure Codecov to fail PR checks when patch coverage drops below threshold.

### Priority 1 (High Value)
3. **Add container runtime smoke test** — After the `docker buildx build` step in the PR workflow, run the built image with `--help` or a health check endpoint to validate startup.
4. **Create .claude/rules/ for test automation** — Generate framework-specific test creation rules for both Go standard testing (unit/integration) and Ginkgo/Gomega (E2E).
5. **Review math/rand usage for FIPS** — Either replace with `crypto/rand` in `pkg/asyncworker/worker.go` or document why `math/rand` is acceptable under `strictfipsruntime`.
6. **Add .dockerignore** — Exclude docs, tests, .git, and non-essential files from the Docker build context.

### Priority 2 (Nice-to-Have)
7. **Enable t.Parallel()** in unit tests for faster execution — currently zero test files use parallel subtests.
8. **Run E2E subset on PRs** — Consider a fast E2E smoke test on PRs (tagged subset) in addition to the nightly full suite.
9. **Add multi-K8s-version testing** — Use matrix strategy to test against multiple Kubernetes versions.
10. **Add contract tests** for the async API boundary to validate client/server compatibility.
11. **Pin development Dockerfile base image** — `quay.io/projectquay/golang:1.26` should use SHA digest like the Konflux Dockerfile.

## Comparison to Gold Standards

| Dimension | llm-d-async | odh-dashboard | notebooks | kserve |
|-----------|-------------|---------------|-----------|--------|
| Unit Tests | 8.5 — 2:1 test ratio | 9.0 — Multi-layer | 7.0 — Image-focused | 8.5 — Comprehensive |
| Integration/E2E | 8.0 — Ginkgo + Kind | 9.0 — Cypress + Contract | 8.0 — Multi-arch | 9.0 — Multi-version |
| Build Integration | 7.0 — PR build, Konflux | 8.0 — Module Federation | 7.0 — Image pipeline | 8.0 — Operator manifests |
| Image Testing | 5.5 — Multi-stage, probes | 7.0 — BFF testing | 9.0 — 5-layer validation | 7.0 — Testcontainers |
| Coverage Tracking | 4.0 — Local only | 8.0 — Codecov enforced | 6.0 — Basic tracking | 9.0 — Threshold gates |
| CI/CD Automation | 8.0 — Prow + nightly | 9.0 — Comprehensive | 8.0 — Multi-image | 8.5 — Matrix strategy |
| Static Analysis | 8.5 — 7 linters, FIPS | 8.0 — ESLint strict | 7.0 — Basic linting | 8.0 — golangci-lint |
| Agent Rules | 6.0 — CLAUDE.md only | 8.0 — Full rules | 4.0 — Minimal | 5.0 — Basic |

## File Paths Reference

### CI/CD
- `.github/workflows/pre-commit.yml` — primary PR gate
- `.github/workflows/ci-e2e-tests.yaml` — nightly E2E tests
- `.github/workflows/ci-release.yaml` — release automation
- `.github/workflows/ci-build-images.yaml` — image build (reusable)
- `.github/workflows/ci-dco-signoff.yml` — DCO verification
- `.tekton/odh-llm-d-async-pull-request.yaml` — Konflux pipeline

### Testing
- `test/e2e/` — 14 E2E test files (Ginkgo/Gomega)
- `test/integration/` — 12 integration test files (testify)
- `pkg/*/` — per-package unit tests

### Container
- `Dockerfile` — development image (distroless)
- `Dockerfile.konflux` — downstream FIPS image (UBI9)
- `charts/async-processor/` — Helm chart with health probes

### Code Quality
- `.golangci.yml` — linter configuration (7 linters)
- `.pre-commit-config.yaml` — 14 hooks
- `.github/dependabot.yml` — 3 ecosystems
- `CLAUDE.md` — agent conventions
- `Makefile` — build/test/lint targets
