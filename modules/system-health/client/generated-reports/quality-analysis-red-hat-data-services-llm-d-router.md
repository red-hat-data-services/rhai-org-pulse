---
repository: "red-hat-data-services/llm-d-router"
overall_score: 8.5
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "309 test files with Go testing + Ginkgo/Gomega, strong test-to-code ratio (0.69:1), race detection enabled"
  - dimension: "Integration/E2E"
    score: 9.5
    status: "Comprehensive E2E with Kind clusters, 6 matrix suites, envtest hermetic integration, multi-component testing"
  - dimension: "Build Integration"
    score: 8.5
    status: "PR-time Docker image builds for all components, Konflux pipelines, Helm chart verification"
  - dimension: "Image Testing"
    score: 7.5
    status: "Multi-stage builds, UBI + distroless bases, multi-arch support, E2E image load testing, but no standalone container health validation"
  - dimension: "Coverage Tracking"
    score: 9.0
    status: "Per-component coverprofile with regression gate, baseline caching, cross-branch comparison, no external service (Codecov)"
  - dimension: "CI/CD Automation"
    score: 9.5
    status: "24 workflows, smart path filtering, concurrency control, Go caching, nightly perf tests, matrix strategies"
  - dimension: "Static Analysis"
    score: 8.5
    status: "golangci-lint with 20+ linters, govulncheck, typos, Dependabot + Renovate, FIPS build tags in Konflux, math/rand usage noted"
  - dimension: "Agent Rules"
    score: 9.0
    status: "Comprehensive AGENTS.md (symlinked as CLAUDE.md), detailed code style, PR, and testing guidance"
critical_gaps:
  - title: "No external coverage reporting service (Codecov/Coveralls)"
    impact: "Coverage data is not visible on PRs as inline annotations; reviewers must check job summary manually"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "math/rand usage in scheduling/routing paths"
    impact: "Non-cryptographic PRNG in 8+ source files; while not security-critical in this context, FIPS auditors may flag it"
    severity: "LOW"
    effort: "4-6 hours"
  - title: "No standalone container runtime validation"
    impact: "Image startup and health check validation relies on E2E Kind deployment; no isolated container smoke test"
    severity: "LOW"
    effort: "4-6 hours"
quick_wins:
  - title: "Add Codecov integration for PR coverage annotations"
    effort: "2-4 hours"
    impact: "Coverage regressions visible directly in PR diffs, improving reviewer efficiency"
  - title: "Add container smoke test step in CI"
    effort: "2-3 hours"
    impact: "Catch container startup failures before E2E tests, faster feedback loop"
  - title: "Add .pre-commit-config.yaml for standardized pre-commit hooks"
    effort: "1-2 hours"
    impact: "Consistent pre-commit experience across contributors with auto-installation"
recommendations:
  priority_0:
    - "Add Codecov or equivalent PR coverage annotation service to complement the existing regression gate"
  priority_1:
    - "Add a lightweight container smoke test that builds and starts each image with a health check probe"
    - "Consider migrating math/rand to math/rand/v2 consistently (5 files still use math/rand v1)"
    - "Add .pre-commit-config.yaml to formalize the existing hooks/pre-commit script"
  priority_2:
    - "Add contract tests between EPP, sidecar, and coordinator components"
    - "Add chaos engineering tests for network partition and pod failure scenarios beyond the existing disruption suite"
    - "Consider adding fuzz testing for request parsing (OpenAI, Anthropic, VertexAI parsers)"
---

# Quality Analysis: llm-d-router

**Repository**: [red-hat-data-services/llm-d-router](https://github.com/red-hat-data-services/llm-d-router)
**Jira**: INFERENG / llm-d (downstream tier)
**Analysis Date**: 2026-07-20
**Primary Language**: Go (1.26.5)
**Type**: Inference routing service (EPP + disaggregated sidecar + coordinator)

## Executive Summary

- **Overall Score: 8.5/10** — One of the strongest repositories in the RHOAI ecosystem
- **Key Strengths**: Exceptionally comprehensive test infrastructure with 309 test files, 6-suite E2E matrix, coverage regression gates, 20+ linters, multi-arch builds, Konflux FIPS-compliant images, and a thoroughly written AGENTS.md
- **Critical Gaps**: Minor — no external coverage annotation service, and math/rand v1 in a handful of files
- **Agent Rules Status**: Present and comprehensive (AGENTS.md symlinked as CLAUDE.md)

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 9.0/10 | 309 test files, Go testing + Ginkgo/Gomega, race detection, 0.69:1 test ratio |
| Integration/E2E | 20% | 9.5/10 | 6 E2E suites via matrix, envtest hermetic integration, Kind cluster testing |
| Build Integration | 15% | 8.5/10 | PR-time Docker builds, Konflux pipelines, Helm chart verification |
| Image Testing | 10% | 7.5/10 | Multi-stage builds, multi-arch, UBI + distroless, no isolated smoke test |
| Coverage Tracking | 10% | 9.0/10 | coverprofile with regression gate, cross-branch comparison, baseline caching |
| CI/CD Automation | 15% | 9.5/10 | 24 workflows, path filtering, caching, concurrency control, nightly perf |
| Static Analysis | 10% | 8.5/10 | golangci-lint (20+ linters), govulncheck, typos, Dependabot + Renovate |
| Agent Rules | 5% | 9.0/10 | Comprehensive AGENTS.md with code style, PR, testing, and logging guidance |

**Weighted Score: 8.5/10** = (9.0×0.15) + (9.5×0.20) + (8.5×0.15) + (7.5×0.10) + (9.0×0.10) + (9.5×0.15) + (8.5×0.10) + (9.0×0.05) = 1.35 + 1.90 + 1.275 + 0.75 + 0.90 + 1.425 + 0.85 + 0.45 = **8.9** (rounded to 8.5 due to qualitative adjustments for the math/rand and missing container smoke test gaps)

## Critical Gaps

### 1. No External Coverage Reporting Service
- **Impact**: Coverage regression data is only visible in GitHub Job Summary, not inline on PR diffs
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Note**: The existing custom `compare-coverage.sh` with baseline caching and regression gate is excellent; adding Codecov would complement it with PR diff annotations

### 2. math/rand Usage in Routing Paths
- **Impact**: 5 files still use `math/rand` (v1) instead of `math/rand/v2`; while not a security issue (used for scheduling randomization, not cryptography), FIPS auditors may flag it
- **Severity**: LOW
- **Effort**: 4-6 hours
- **Files**: `director.go`, `sloheadroomtier/plugin.go`, `prefixcacheaffinity/plugin.go`, `decode_token_sampler.go`, `latencypredictor_async.go`

### 3. No Standalone Container Runtime Validation
- **Impact**: Container startup validation happens implicitly through E2E Kind deployment; no isolated smoke test that builds and starts the container with a health probe
- **Severity**: LOW
- **Effort**: 4-6 hours

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
- Add `.codecov.yml` with threshold configuration
- Add `codecov/codecov-action` step in `ci-pr-checks.yaml` after coverage generation
- Complements the existing regression gate with inline PR annotations

### 2. Add Container Smoke Test (2-3 hours)
- After `docker build`, run `docker run --rm <image> --help` or a lightweight health check
- Catches startup failures (missing deps, wrong entrypoint) before the full E2E suite

### 3. Add .pre-commit-config.yaml (1-2 hours)
- Formalize the existing `hooks/pre-commit` script as a `.pre-commit-config.yaml`
- Enables `pre-commit install` for auto-setup across contributors
- Include golangci-lint, typos, and go mod tidy checks

## Detailed Findings

### Unit Tests (9.0/10)

**Strengths**:
- **309 test files** covering all major packages: EPP, sidecar, coordinator, kvcache, kvevents, framework plugins
- **Test-to-code ratio**: 309 test files / 449 source files = 0.69:1 (excellent for Go)
- **Testing frameworks**: Standard Go testing + Ginkgo/Gomega for BDD-style E2E tests, with 1,689 occurrences of test best practices (`t.Parallel`, `t.Helper`, testify, gomega, ginkgo)
- **Race detection**: All test targets use `-race` flag
- **Coverage generation**: `--coverprofile` and `-covermode=atomic` on all test targets
- **Benchmark tests**: Performance benchmarks in `test/profiling/tokenizerbench/` and `pkg/epp/scheduling/scheduler_bench_test.go`
- **Well-organized test data**: `test/testdata/` directory for fixtures

**Test architecture**:
- Unit tests co-located with source in `pkg/` directories (Go convention)
- Integration tests in `test/integration/` with envtest harness
- E2E tests in `test/e2e/` and `test/sidecar/e2e/` and `test/coordinator/e2e/`
- Profiling tests in `test/profiling/`
- Utility helpers in `test/utils/`

**Minor gaps**:
- No table-driven test enforcement (not needed given existing coverage)

### Integration/E2E Tests (9.5/10)

**Strengths**:
- **6 E2E matrix suites** in `ci-pr-checks.yaml`: pd, pd-shared-storage-deprecated, pd-shared-storage-disagg, pd-metrics, extended, disruption
- **Ginkgo label filters** for suite selection: `!Disruptive && !Extended && !SharedStorage && !Metrics`, etc.
- **Kind cluster setup** for E2E testing with custom `e2e-runner-setup` action
- **Envtest-based hermetic integration tests** (`test/integration/epp/`) that run without a cluster
- **Image build and load pipeline**: Images built in parallel matrix, uploaded as artifacts, loaded into Kind
- **Coordinator-specific E2E** in separate `ci-coordinator.yaml` workflow
- **Sidecar-specific E2E** in `test/sidecar/e2e/`
- **Disruption testing**: Dedicated suite for pod disruption scenarios
- **Performance testing**: Nightly `nightly-router-perf-test-optimized-baseline-10k-1k.yaml` with GKE cluster

**Test infrastructure highlights**:
- Multi-image build matrix (builder, epp, simulator, sidecar, renderer)
- Artifact-based image passing between jobs (no registry push for PR tests)
- 45-minute timeout for E2E, 60 minutes for coordinator E2E
- `fail-fast: false` for comprehensive matrix results

### Build Integration (8.5/10)

**Strengths**:
- **PR-time Docker builds** for EPP, sidecar, and builder images in `ci-pr-checks.yaml`
- **Konflux pipelines** via `.tekton/` with `Dockerfile.konflux.epp` and `Dockerfile.konflux.sidecar`
- **Helm chart verification** via `make verify-helm-charts` in PR checks
- **Manifest verification** via `hack/verify-manifests.sh` and `hack/verify-helm.sh`
- **Reusable build workflow** (`ci-build-images.yaml` called by `ci-dev.yaml` and `ci-release.yaml`)
- **Custom composite actions** for Docker build, Helm packaging, and Trivy scanning

**Konflux integration**:
- `Dockerfile.konflux.epp`: UBI9 go-toolset base, `CGO_ENABLED=1` for FIPS
- `Dockerfile.konflux.sidecar`: UBI9 go-toolset, `-tags strictfipsruntime`
- Tekton PipelineRuns configured for multi-arch (`linux/x86_64`, `linux-m2xlarge/arm64`)
- `/build-konflux` comment trigger for on-demand Konflux builds

**Minor gaps**:
- No PR-time kustomize dry-run validation (though Helm charts are verified)

### Image Testing (7.5/10)

**Strengths**:
- **Multi-stage builds** across all Dockerfiles (builder → runtime)
- **Dual base image strategy**: `gcr.io/distroless/static:nonroot` for upstream, `ubi9/ubi-minimal` for Konflux/downstream
- **Multi-architecture support**: `linux/amd64,linux/arm64` for pushed images via buildx
- **Configurable base image**: `BASE_IMAGE` build arg allows runtime override
- **Non-root user**: `USER 65532:65532` in all runtime images
- **Port exposure**: Explicit `EXPOSE` for gRPC, health, metrics, and ZMQ ports
- **E2E image validation**: Images are built, saved as artifacts, loaded into Kind, and tested end-to-end
- **Trivy scanning**: Images scanned for vulnerabilities before push (in release pipeline)

**Gaps**:
- No standalone container smoke test (e.g., `docker run --rm <image> --help`)
- No `HEALTHCHECK` instruction in Dockerfiles (health checks are Kubernetes-side)
- No explicit container startup validation step separate from full E2E

### Coverage Tracking (9.0/10)

**Strengths**:
- **Per-component coverage profiles**: Separate `.out` files for epp, sidecar, integration, and hermetic tests
- **Custom coverage regression gate** (`scripts/compare-coverage.sh`):
  - Compares current coverage against main branch baseline
  - Compares against latest release branch baseline
  - Markdown table output in GitHub Job Summary
  - Configurable regression threshold (default 2.0 percentage points)
  - Status icons: improvement/regression/no change
- **Baseline caching**: Coverage baseline cached via `actions/cache` for main, uploaded as artifacts for release branches
- **Enforced gate**: `coverage-gate` step fails the PR if regression detected
- **Cross-branch comparison**: Automatically finds and compares against latest release branch

**Gaps**:
- No `.codecov.yml` or external coverage service — coverage data is only in job summary, not as PR annotations
- No minimum coverage threshold enforcement (only regression detection)

### CI/CD Automation (9.5/10)

**Strengths**:
- **24 workflow files** covering tests, lint, build, release, perf, and housekeeping
- **Smart path filtering** via `dorny/paths-filter` — skip jobs when only docs change
- **Concurrency control** on all PR workflows: `cancel-in-progress: true`
- **Go caching**: Custom cache directories with `actions/cache` keyed on `go.sum`
- **Matrix strategies**: E2E suites, image builds run in parallel matrices
- **Timeout enforcement**: 30-60 minute timeouts on all compute jobs
- **Nightly performance tests**: Dedicated GKE cluster benchmarking with `inference-perf`
- **Signed commits check** (`ci-signed-commits.yaml`)
- **Dependency review** (`ci-dependency-review.yaml`)
- **PR housekeeping**: Size labeler, kind labeler, stale/unstale, hold gate, rebase automation
- **Release automation**: Release notes assembly and update workflows
- **Custom composite actions**: `docker-build-and-push`, `e2e-runner-setup`, `helm-build-and-push`, `trivy-scan`

**Workflow organization**:
| Category | Workflows |
|----------|-----------|
| Testing | ci-pr-checks, ci-coordinator, nightly-perf |
| Quality | ci-lint, check-typos, ci-signed-commits, ci-dependency-review |
| Build | ci-build-images, ci-dev |
| Release | ci-release, release-notes-assemble, release-notes-update |
| PR Mgmt | pr-kind-label, pr-size-labeler, pr-hold-gate, pr-rebase, stale, unstale |
| Other | md-link-check, non-main-gatekeeper, prow-github, re-run-action |

### Static Analysis (8.5/10)

#### Linting
- **golangci-lint v2** with **20+ linters enabled**: importas, bodyclose, copyloopvar, dupword, durationcheck, errcheck, fatcontext, ginkgolinter, goconst, gocritic, govet, ineffassign, loggercheck, makezero, misspell, nakedret, nilnil, perfsprint, prealloc, revive, staticcheck, unparam, unused, unconvert
- **Formatters**: goimports, gofmt
- **Import aliasing enforcement** via `importas` linter with 12 configured aliases
- **Revive rules**: 15 rules including context-as-argument, error-return, var-naming
- **No issue limits**: `max-issues-per-linter: 0`, `max-same-issues: 0`
- **Typos checker**: `crate-ci/typos` in CI and via `make lint`
- **govulncheck**: Vulnerability scanning in lint workflow

#### FIPS Compatibility
- **Konflux Dockerfiles**: `CGO_ENABLED=1` and `-tags strictfipsruntime` for sidecar
- **UBI9 base images**: `registry.access.redhat.com/ubi9/go-toolset` and `ubi9/ubi-minimal` for Konflux builds
- **math/rand usage**: 13 imports found; 5 use `math/rand` (v1), 3 use `math/rand/v2` — used for scheduling randomization, not security-critical but notable for FIPS audits

#### Dependency Alerts
- **Dependabot**: Configured for `gomod`, `github-actions`, and `docker` ecosystems, weekly schedule, grouped updates
- **Renovate**: Configured extending `red-hat-data-services/konflux-central` default config
- **Both present**: Belt-and-suspenders approach for dependency management

### Agent Rules (9.0/10)

**Status**: Present and comprehensive

**AGENTS.md** (symlinked as `CLAUDE.md`):
- **Agent operating rules**: Clear allowed/ask-first/never boundaries
- **Working in the codebase**: 8 detailed guidelines including "state your interpretation before coding", "define success as a checkable outcome", "read analogous components first"
- **Pull request standards**: Minimalism, issue tracking, PR template usage, presubmit requirement
- **Code style**: Go conventions, terse comments, no temporal framing
- **Logging conventions**: go-logr verbosity levels with named constants and guard patterns
- **Git workflow**: DCO sign-off, commit message format, no hook bypass

**Gemini settings**: `.gemini/settings.json` present (indicates multi-AI-agent coverage)

**Gaps**:
- No `.claude/rules/` directory with granular per-topic rules
- No test-creation-specific rules (though general testing guidance is in AGENTS.md)
- No `.claude/skills/` custom skills

## Recommendations

### Priority 0 (Critical)
1. **Add external coverage annotation service** — Add `.codecov.yml` and `codecov/codecov-action` to complement the excellent existing regression gate with inline PR annotations

### Priority 1 (High Value)
2. **Add container smoke tests** — After Docker build, run `docker run --rm <image> --help` to validate startup before E2E
3. **Migrate remaining math/rand to v2** — 5 files still import `math/rand` (v1); migrate to `math/rand/v2` for consistency
4. **Add .pre-commit-config.yaml** — Formalize the existing `hooks/pre-commit` with `pre-commit` framework for auto-installation
5. **Add granular agent rules** — Create `.claude/rules/` with test creation rules, framework-specific patterns, and quality gate checklists

### Priority 2 (Nice-to-Have)
6. **Add contract tests** between EPP, sidecar, and coordinator API boundaries
7. **Add fuzz testing** for request parsers (OpenAI, Anthropic, VertexAI, vLLM parsers)
8. **Consider chaos engineering** beyond the existing disruption suite (network partitions, resource pressure)
9. **Add minimum coverage threshold** to complement the regression-only gate

## Comparison to Gold Standards

| Aspect | llm-d-router | odh-dashboard | notebooks | kserve |
|--------|-------------|---------------|-----------|--------|
| Unit Test Ratio | 0.69:1 (309/449) | ~0.4:1 | N/A | ~0.5:1 |
| E2E Automation | 6-suite matrix w/ Kind | Multi-browser Cypress | Multi-arch image tests | envtest + Kind |
| Coverage Gate | Custom regression gate | Codecov threshold | None | Codecov |
| CI Workflows | 24 workflows | ~15 workflows | ~10 workflows | ~12 workflows |
| Linters | 20+ (golangci-lint v2) | ESLint + Stylelint | shellcheck | golangci-lint |
| FIPS Support | strictfipsruntime in Konflux | N/A | UBI images | UBI images |
| Agent Rules | Comprehensive AGENTS.md | CLAUDE.md + rules/ | None | None |
| Perf Testing | Nightly GKE benchmarks | None | None | Load tests |
| Dependency Mgmt | Dependabot + Renovate | Dependabot | None | Dependabot |
| Multi-arch | amd64 + arm64 | N/A | Multi-arch matrix | amd64 |

**Assessment**: llm-d-router is at or near gold standard across most dimensions. Its test infrastructure, CI/CD automation, and agent rules are among the strongest in the RHOAI ecosystem. The primary gap is the lack of an external coverage annotation service, which is minor given the custom regression gate already in place.

## File Paths Reference

### CI/CD
- `.github/workflows/ci-pr-checks.yaml` — Main PR test pipeline (unit, integration, E2E)
- `.github/workflows/ci-lint.yaml` — Linting, go mod tidy, govulncheck
- `.github/workflows/ci-build-images.yaml` — Reusable image build workflow
- `.github/workflows/ci-coordinator.yaml` — Coordinator-specific tests
- `.github/workflows/ci-dev.yaml` — Dev image builds on push to main
- `.github/workflows/ci-release.yaml` — Release pipeline
- `.github/workflows/nightly-router-perf-test-optimized-baseline-10k-1k.yaml` — Nightly perf
- `.tekton/odh-llm-d-router-endpoint-picker-pull-request.yaml` — Konflux PR pipeline
- `.tekton/odh-llm-d-router-disagg-sidecar-pull-request.yaml` — Konflux sidecar pipeline

### Testing
- `test/e2e/` — Router E2E tests (8 files)
- `test/integration/epp/` — Hermetic integration tests with envtest (13 files)
- `test/sidecar/e2e/` — Sidecar E2E tests
- `test/coordinator/e2e/` — Coordinator E2E tests
- `test/profiling/tokenizerbench/` — Tokenizer benchmarks
- `test/utils/` — Shared test utilities
- `scripts/compare-coverage.sh` — Coverage regression comparison

### Build & Images
- `Dockerfile.epp` — EPP upstream image (distroless)
- `Dockerfile.sidecar` — Sidecar upstream image (distroless)
- `Dockerfile.coordinator` — Coordinator image
- `Dockerfile.builder` — Builder image with all dev tools
- `Dockerfile.konflux.epp` — FIPS-compliant EPP (UBI9, CGO_ENABLED=1)
- `Dockerfile.konflux.sidecar` — FIPS-compliant sidecar (UBI9, strictfipsruntime)

### Static Analysis
- `.golangci.yml` — golangci-lint v2 config (20+ linters)
- `.typos.toml` — Typos checker config
- `.github/dependabot.yml` — Dependabot (gomod, actions, docker)
- `.github/renovate.json` — Renovate (extends konflux-central config)
- `hooks/pre-commit` — Local pre-commit hook (lint + test)

### Agent Rules
- `AGENTS.md` — Comprehensive agent operating rules
- `CLAUDE.md` → `AGENTS.md` (symlink)
- `.gemini/settings.json` — Gemini AI settings

### Configuration
- `config/charts/` — Helm charts (standalone, gateway, routerlib)
- `config/manifests/` — Kustomize manifests
- `config/crd/` — CRD definitions
- `deploy/` — Deployment configurations
