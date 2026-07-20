---
repository: "red-hat-data-services/llm-d-inference-scheduler"
overall_score: 8.3
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "237 test files / 380 source files (62% ratio). Go testing + testify + Ginkgo/Gomega. Race detection enabled. Comprehensive plugin-level coverage."
  - dimension: "Integration/E2E"
    score: 9.5
    status: "Extensive E2E with Kind clusters, hermetic integration via envtest, multi-suite matrix (traffic, metrics, disruption, extended, PD variants). Ginkgo label-filtered parallel suites."
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-time Docker image builds for EPP, sidecar, builder. Tekton/Konflux pipelines for downstream. Helm chart verification. No PR-time Konflux simulation in GH Actions."
  - dimension: "Image Testing"
    score: 7.5
    status: "Multi-stage builds, distroless base (upstream) and UBI9 (Konflux). E2E loads and runs built images in Kind. No standalone container health/startup tests."
  - dimension: "Coverage Tracking"
    score: 8.5
    status: "Per-component coverprofile (epp.out, sidecar.out). Coverage comparison against main baseline with regression detection. Coverage gate enforced on PRs. No external dashboard (Codecov)."
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "21 workflows. PR-triggered tests, lint, build, dependency review, signed commits. Concurrency control with cancel-in-progress. Go module and build caching. Matrix strategy for E2E suites. Path-based change filtering."
  - dimension: "Static Analysis"
    score: 8.5
    status: "golangci-lint v2 with 22+ linters. typos checker. govulncheck. Dependabot (gomod, actions, docker) + Renovate for Konflux. Pre-commit hooks. math/rand usage in non-crypto context (minor FIPS note). Konflux sidecar uses -tags strictfipsruntime."
  - dimension: "Agent Rules"
    score: 9.0
    status: "Comprehensive AGENTS.md covering operating rules, code style, logging conventions, Git workflow, PR standards. Gemini settings.json present. No .claude/rules/ directory but AGENTS.md is thorough and actionable."
critical_gaps:
  - title: "No external coverage dashboard (Codecov/Coveralls)"
    impact: "Coverage trends over time not visible to contributors. PR coverage comments not generated automatically."
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "math/rand usage in scheduling plugins without FIPS review"
    impact: "9 files import math/rand. While used for non-crypto purposes (scheduling randomization), FIPS audits may flag these. Upstream EPP Dockerfile uses CGO_ENABLED=0 without FIPS tags."
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "No standalone container runtime validation"
    impact: "Built images are tested only via E2E Kind deployment. No isolated container startup/health check tests."
    severity: "LOW"
    effort: "4-6 hours"
quick_wins:
  - title: "Add Codecov integration for PR coverage comments and trend tracking"
    effort: "2-3 hours"
    impact: "Coverage profiles already generated; just add codecov-action upload step and .codecov.yml thresholds"
  - title: "Add .claude/rules/ directory with test-specific rules"
    effort: "2-3 hours"
    impact: "AGENTS.md is excellent for general guidance; dedicated test rules would help AI agents generate framework-correct tests (Ginkgo vs testify patterns, label conventions)"
  - title: "Add container startup smoke test to CI"
    effort: "3-4 hours"
    impact: "docker run + health endpoint check after image build would catch startup failures before E2E"
recommendations:
  priority_0:
    - "Add Codecov integration with .codecov.yml and coverage-action upload to make coverage trends visible and enforce thresholds in PRs"
    - "Review math/rand usage in scheduling plugins for FIPS compliance documentation; consider crypto/rand or document non-crypto context explicitly"
  priority_1:
    - "Add container startup validation step in ci-pr-checks.yaml after image build (docker run --rm + health probe check)"
    - "Create .claude/rules/ directory with test pattern rules (when to use Ginkgo vs testify, label conventions, hermetic vs cluster test patterns)"
    - "Add FIPS build tags to upstream EPP Dockerfile (currently only Konflux sidecar has -tags strictfipsruntime)"
  priority_2:
    - "Add benchmarking regression detection in CI (beyond the existing tokenizer benchmark)"
    - "Consider adding contract tests for the plugin interface boundaries"
    - "Add coverage badge to README.md for visibility"
---

# Quality Analysis: llm-d-inference-scheduler

**Repository**: [red-hat-data-services/llm-d-inference-scheduler](https://github.com/red-hat-data-services/llm-d-inference-scheduler)
**Jira**: INFERENG / llm-d (downstream tier)
**Analysis Date**: 2026-07-20
**Primary Language**: Go 1.25
**Type**: Inference routing service (Endpoint Picker + disaggregated sidecar)
**Frameworks**: Kubernetes controller-runtime, Ginkgo/Gomega, testify, envtest, Kind

## Executive Summary

- **Overall Score: 8.3/10** - This is one of the strongest repositories analyzed. The llm-d-inference-scheduler demonstrates mature engineering practices across nearly all quality dimensions.
- **Key Strengths**: Exceptionally high test-to-code ratio (62%), comprehensive E2E with multiple matrix suites, sophisticated coverage comparison with regression detection, strong linting with 22+ golangci-lint rules, well-written AGENTS.md.
- **Critical Gaps**: No external coverage dashboard (Codecov), some FIPS compliance gaps in upstream Dockerfiles, no standalone container runtime validation.
- **Agent Rules Status**: Present and comprehensive (AGENTS.md with detailed operating rules, code style, logging conventions)

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 9.0/10 | 237 test files, 62% test-to-code ratio, race detection, testify + Ginkgo |
| Integration/E2E | 20% | 9.5/10 | Extensive Kind-based E2E, hermetic envtest integration, matrix suites |
| Build Integration | 15% | 8.0/10 | PR image builds, Tekton/Konflux pipelines, Helm verification |
| Image Testing | 10% | 7.5/10 | Multi-stage builds, distroless + UBI9, E2E image loading |
| Coverage Tracking | 10% | 8.5/10 | Per-component coverprofile, baseline comparison, PR regression gate |
| CI/CD Automation | 15% | 9.0/10 | 21 workflows, concurrency control, caching, matrix E2E |
| Static Analysis | 10% | 8.5/10 | golangci-lint v2, govulncheck, typos, Dependabot + Renovate |
| Agent Rules | 5% | 9.0/10 | Comprehensive AGENTS.md with operating rules and code style |

**Weighted Overall: 8.3/10**

## Critical Gaps

### 1. No External Coverage Dashboard
- **Impact**: Coverage profiles are generated and compared against baselines, but there is no Codecov/Coveralls integration. Contributors cannot see coverage trends over time, and PR comments with coverage deltas are not generated automatically.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: The infrastructure is 90% there - `coverage/*.out` files are already produced. Adding `codecov/codecov-action` to the CI workflow and a `.codecov.yml` config would complete the picture.

### 2. FIPS Compliance Gaps in Upstream Dockerfiles
- **Impact**: 9 files import `math/rand` (used for scheduling randomization, not cryptography). The upstream `Dockerfile.epp` builds with `CGO_ENABLED=0` and no FIPS build tags. Only the Konflux sidecar Dockerfile uses `-tags strictfipsruntime`.
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: The `math/rand` usage is for scheduling plugin randomization (tie-breaking, weighted random selection) which is non-cryptographic. However, FIPS audits may flag these. The upstream EPP Dockerfile lacks FIPS build tags that are present in `Dockerfile.epp.konflux`.

### 3. No Standalone Container Runtime Validation
- **Impact**: Built images are tested only through E2E Kind cluster deployment. There are no isolated container startup/health check tests that could catch basic runtime failures (missing certs, wrong entrypoint, port binding issues) without the overhead of a full E2E run.
- **Severity**: LOW
- **Effort**: 4-6 hours

## Quick Wins

### 1. Add Codecov Integration (2-3 hours)
Coverage profiles are already generated in CI. Add upload step and config:
```yaml
# Add to ci-pr-checks.yaml after test step
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v5
  with:
    files: coverage/epp.out,coverage/sidecar.out
    flags: unittests
```
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

### 2. Add .claude/rules/ for Test Patterns (2-3 hours)
AGENTS.md is excellent for general guidance. Add dedicated test creation rules:
- When to use Ginkgo/Gomega (E2E, integration) vs testify (unit tests)
- Label conventions (`GAIEMetrics`, `Disruptive`, `Extended`, `SharedStorage`)
- Hermetic vs cluster test patterns
- Coverage profile generation conventions

### 3. Container Startup Smoke Test (3-4 hours)
Add a simple validation after image build in CI:
```yaml
- name: Smoke test EPP image
  run: |
    docker run --rm -d --name epp-smoke ${{ env.EPP_IMAGE }} --help
    docker stop epp-smoke || true
```

## Detailed Findings

### Unit Tests (9.0/10)

**Strengths**:
- **237 test files** across 380 source files, yielding a **62% test-to-code ratio** - exceptional for a Go project
- Dual framework approach: `testify/assert` + `testify/require` for unit tests, `Ginkgo/Gomega` for BDD-style E2E and integration
- Race detection enabled via `-race` flag in all test targets
- Tests organized alongside source code (same package), following Go conventions
- Comprehensive plugin-level testing: every scheduler filter, scorer, picker, and profile handler has dedicated tests
- Benchmark tests for flow control, tokenizer, and scheduler performance
- Test isolation patterns: separate test packages for epp vs sidecar (`epp_TEST_PACKAGES`, `sidecar_TEST_PACKAGES`)

**Coverage by area**:
- `pkg/epp/framework/plugins/scheduling/` - All filters, scorers, pickers tested (21+ test files)
- `pkg/epp/framework/plugins/requestcontrol/` - Data producers, admitters, preadmitters tested (25+ test files)
- `pkg/epp/framework/plugins/flowcontrol/` - Fairness, ordering, eviction, saturation detectors (18+ test files)
- `pkg/epp/handlers/` - Request/response parsing, server abort handling
- `pkg/sidecar/proxy/` - 14 test files covering all proxy connector types

**Minor gaps**:
- Some internal packages (`internal/tls/`, `internal/runnable/`) lack test files
- `pkg/generator/main.go` has no test coverage

### Integration/E2E Tests (9.5/10)

**Strengths**:
- **Three-tier test architecture**:
  1. **Hermetic integration** (`test/integration/epp/`): Uses `envtest` (controller-runtime's Kubernetes API server simulator) - no real cluster needed. 11 test files covering gRPC, session affinity, runtime polling/notification, data layer integration, config smoke tests
  2. **E2E scheduler** (`test/e2e/`): Kind cluster with matrix strategy - 6 suites: pd, pd-shared-storage-deprecated, pd-shared-storage-disagg, pd-metrics, extended, disruption
  3. **E2E GAIE** (`test/e2e/epp/`): Separate GAIE-specific E2E suite with 2 sub-suites (traffic, metrics)
  4. **Sidecar E2E** (`test/sidecar/e2e/`): Dedicated sidecar integration tests
- **Matrix strategy**: E2E suites run in parallel via `strategy.matrix` with `fail-fast: false`
- **Label filtering**: Ginkgo label-based test selection (`GAIEMetrics`, `GAIELeaderElection`, `Disruptive`, `Extended`, `SharedStorage`, `Disagg`)
- **Image artifact pipeline**: E2E images built in parallel jobs, uploaded as artifacts, downloaded by E2E test jobs - efficient and reusable
- **Kind cluster management**: Automated cluster creation/teardown in E2E suites
- **60-minute timeout** for test job, 45 min for router E2E, 20 min for image builds

**Infrastructure**:
- `test/testdata/` - Kubernetes manifests for test scenarios (inference pools, deployments, RBAC, envoy config)
- `test/utils/` - Shared test utilities (K8s objects, network, server, context, handle)
- `test/scripts/run_e2e.sh` - E2E runner script
- `hack/test-e2e.sh` - Alternative E2E entry point
- `.github/actions/e2e-runner-setup/` - Composite action for E2E environment setup
- `.github/actions/docker-build-and-push/` - Reusable build action

### Build Integration (8.0/10)

**Strengths**:
- **PR-time image builds**: `ci-pr-checks.yaml` builds EPP, sidecar, and builder images on every PR
- **Multiple Dockerfile variants**: Upstream (distroless) and Konflux (UBI9) for both EPP and sidecar
- **Tekton/Konflux pipelines**: `.tekton/` directory with PR and push pipeline runs for both components, referencing `odh-konflux-central` shared pipeline
- **Helm chart verification**: `verify-helm-charts` target validates Helm charts with `kubectl-validate` on PRs
- **Manifest validation**: `verify-manifests` target validates deployment manifests
- **Builder container pattern**: All build/test operations run inside a builder container for reproducibility
- **Multi-architecture support**: `BUILDPLATFORM` and `TARGETARCH` support in Dockerfiles

**Gaps**:
- No PR-time Konflux build simulation in GitHub Actions (Tekton pipelines handle this in the Konflux environment)
- No Kustomize overlay validation in CI (though Helm is validated)

### Image Testing (7.5/10)

**Strengths**:
- **Multi-stage builds** in all Dockerfiles (builder + runtime stages)
- **Base image strategy**: Distroless (`gcr.io/distroless/static:nonroot`) for upstream, UBI9 minimal for Konflux
- **Non-root user**: `USER 65532:65532` in all Dockerfiles
- **Layer caching**: Go module download as separate cached layer
- **E2E image loading**: Built images are loaded into Kind clusters for E2E testing
- **Precompile optimization**: Dockerfile includes a precompile step without version flags to leverage Docker layer cache
- **Pin-by-digest**: Konflux Dockerfiles use `@sha256:...` for reproducible builds

**Gaps**:
- No standalone container startup/health check tests outside of E2E
- No `HEALTHCHECK` directive in Dockerfiles (health checks are Kubernetes probes, which is correct for K8s workloads)
- No explicit multi-arch build testing in PR workflow (handled by Konflux pipelines)
- `.dockerignore` exists but not reviewed for completeness

### Coverage Tracking (8.5/10)

**Strengths**:
- **Per-component coverage**: Separate coverage profiles for EPP (`coverage/epp.out`) and sidecar (`coverage/sidecar.out`)
- **Coverage comparison**: `scripts/compare-coverage.sh` generates markdown tables comparing current vs baseline coverage
- **Baseline caching**: Main branch coverage cached via `actions/cache` for PR comparison
- **Regression gate**: Coverage gate enforced on PRs - fails if regression detected beyond threshold (configurable, default 2.0 percentage points)
- **Release branch comparison**: PRs also compared against latest release branch coverage
- **HTML reports**: `coverage-report` Makefile target generates browsable HTML coverage reports
- **Atomic coverage mode**: `-covermode=atomic` for accurate concurrent coverage

**Gaps**:
- No external coverage service (Codecov, Coveralls) for trend visualization
- No coverage badge in README
- Coverage threshold is configurable but defaults to 0 (report-only)
- No patch-level coverage enforcement (only total regression detection)

### CI/CD Automation (9.0/10)

**Strengths**:
- **21 workflows** covering the full development lifecycle
- **Change detection**: `dorny/paths-filter` to skip unnecessary CI runs
- **Concurrency control**: `concurrency` groups with `cancel-in-progress: true` on all PR workflows
- **Go caching**: Custom Go module and build cache strategy with `actions/cache`
- **Matrix E2E**: 8 E2E suite variants run in parallel via `strategy.matrix`
- **Artifact pipeline**: Images built, uploaded as artifacts, and downloaded by dependent E2E jobs
- **Security**: Dependency review (`actions/dependency-review-action`), signed commit verification, govulncheck
- **Release automation**: `ci-release.yaml` and `ci-dev.yaml` for automated image builds on tags/pushes
- **PR management**: Stale/unstale issue management, PR size labeler, kind labels, hold gate
- **Tekton integration**: 4 Tekton pipeline runs for Konflux PR and push builds

**Workflow inventory**:
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| ci-pr-checks | PR, push:main | Unit tests, hermetic integration, E2E (8 suites), coverage gate |
| ci-lint | PR, push:main | golangci-lint, govulncheck, go mod tidy, typos |
| ci-build-images | workflow_call | Build + push EPP and sidecar images |
| ci-dev | push:main,release | Dev image builds |
| ci-release | tag push, release | Release image builds |
| ci-dependency-review | PR | Dependency vulnerability check |
| ci-signed-commits | PR | DCO sign-off verification |
| check-typos | PR | Typo detection |
| md-link-check | PR | Markdown link validation |
| pr-size-labeler | PR | Auto-size labels |
| pr-kind-label | PR | Auto-kind labels |
| pr-hold-gate | PR | Hold label gate |
| stale/unstale | schedule | Issue/PR staleness management |
| release-notes-* | various | Release note automation |

### Static Analysis (8.5/10)

**Linting** (Strong):
- **golangci-lint v2** with **22+ enabled linters** including:
  - Code quality: `govet`, `staticcheck`, `ineffassign`, `unused`, `errcheck`, `goconst`
  - Style: `revive` (with 15 rules), `importas` (with project-specific aliases), `gofmt`, `goimports`
  - Performance: `prealloc`, `perfsprint`, `bodyclose`
  - Correctness: `copyloopvar`, `durationcheck`, `fatcontext`, `loggercheck`, `nakedret`, `nilnil`
  - Test-specific: `ginkgolinter`
  - Spelling: `misspell`, `dupword`
- **typos** checker for additional spell checking
- **govulncheck** for known Go vulnerability detection
- `go mod tidy -diff` to ensure clean module state
- Lint runs with `--new` flag option for incremental checking

**FIPS Compatibility** (Moderate):
- `math/rand` imported in 9 files (scheduling randomization, not cryptographic use)
- No `crypto/md5`, `crypto/des`, or `crypto/rc4` imports found
- Konflux sidecar uses `-tags strictfipsruntime` with `CGO_ENABLED=1` and UBI9 base
- Upstream EPP uses `CGO_ENABLED=0` with distroless base - no FIPS tags
- Konflux EPP uses `CGO_ENABLED=1` with UBI9 - no explicit FIPS tags but compatible base

**Dependency Alerts** (Strong):
- **Dependabot** configured for 3 ecosystems:
  - `gomod`: Weekly, patch-only (major/minor handled via `make upgrade-deps`), grouped updates
  - `github-actions`: Weekly, all update types
  - `docker`: Weekly, patch-only
- **Renovate** configured for Konflux: extends `red-hat-data-services/konflux-central` defaults
- Dependency review action in CI (`actions/dependency-review-action` with `fail-on-severity: high`)

**Pre-commit Hooks**:
- Git hooks directory at `hooks/pre-commit`
- `make install-hooks` target to configure `core.hooksPath`

### Agent Rules (9.0/10)

**AGENTS.md** (Comprehensive):
- **Operating rules**: Clear allowed/ask-first/never boundaries for agent actions
- **Working in the codebase**: 8 specific rules covering interpretation, test-first development, pattern following, verification
- **Pull requests**: Minimalism, issue tracking, scope control, self-check
- **Code style**: Format/lint references, comment philosophy, temporal framing prohibition
- **Logging conventions**: go-logr verbosity levels with named constants, guard patterns
- **Git workflow**: DCO sign-off, commit message format, no hook bypassing

**Additional agent support**:
- `.gemini/settings.json` for Gemini agent configuration
- CLAUDE.md is the same content as AGENTS.md (comprehensive)

**Gaps**:
- No `.claude/rules/` directory with framework-specific test rules
- No dedicated test creation rules (when to use Ginkgo vs testify, label conventions)
- No `.claude/skills/` for custom analysis skills

## Recommendations

### Priority 0 (Critical)
1. **Add Codecov integration** - Coverage profiles already generated; add `codecov/codecov-action` upload and `.codecov.yml` with thresholds. This provides PR coverage comments, trend visualization, and patch-level coverage enforcement. (2-3 hours)
2. **Document FIPS compliance status** - Audit `math/rand` usage in scheduling plugins to document that it is non-cryptographic. Add FIPS build tags to upstream EPP Dockerfile for consistency with Konflux variants. (4-8 hours)

### Priority 1 (High Value)
3. **Add container startup validation** - After image build in CI, run a quick `docker run --rm` + health check. Catches startup failures (missing certs, wrong entrypoint) without full E2E overhead. (3-4 hours)
4. **Create .claude/rules/ for test patterns** - Add framework-specific test rules covering Ginkgo vs testify conventions, label taxonomy, hermetic vs cluster patterns. (2-3 hours)
5. **Add coverage badge to README** - Once Codecov is integrated, add the coverage badge for visibility. (30 minutes)

### Priority 2 (Nice-to-Have)
6. **Add benchmark regression detection** - Extend the existing tokenizer benchmark to detect performance regressions in CI via `benchstat` comparison. (4-6 hours)
7. **Add contract tests for plugin interfaces** - The plugin model is the main extension surface; contract tests would formalize the interface guarantees. (8-12 hours)
8. **Add Kustomize overlay validation** - Helm is validated but Kustomize overlays (if any) are not verified in CI. (2-3 hours)

## Comparison to Gold Standards

| Dimension | llm-d-inference-scheduler | odh-dashboard | notebooks | kserve |
|-----------|:------------------------:|:-------------:|:---------:|:------:|
| Unit Tests | 9.0 | 8.5 | 6.0 | 8.0 |
| Integration/E2E | 9.5 | 9.0 | 7.0 | 9.0 |
| Build Integration | 8.0 | 8.0 | 7.5 | 7.5 |
| Image Testing | 7.5 | 6.0 | 9.0 | 6.5 |
| Coverage Tracking | 8.5 | 8.0 | 5.0 | 8.5 |
| CI/CD Automation | 9.0 | 9.0 | 7.0 | 8.5 |
| Static Analysis | 8.5 | 7.5 | 6.0 | 7.5 |
| Agent Rules | 9.0 | 7.0 | 3.0 | 4.0 |
| **Overall** | **8.3** | **8.0** | **6.5** | **7.5** |

The llm-d-inference-scheduler is a standout repository. It exceeds most gold standards in unit testing, E2E coverage, and agent rules. The main areas for improvement are external coverage tooling integration and FIPS compliance documentation.

## File Paths Reference

### CI/CD
- `.github/workflows/ci-pr-checks.yaml` - Main PR test workflow (unit, integration, E2E)
- `.github/workflows/ci-lint.yaml` - Linting, govulncheck, typos
- `.github/workflows/ci-build-images.yaml` - Image build/push (reusable)
- `.github/workflows/ci-dev.yaml` - Dev image builds on push
- `.github/workflows/ci-release.yaml` - Release image builds
- `.github/workflows/ci-dependency-review.yaml` - Dependency vulnerability review
- `.tekton/` - Konflux pipeline runs (4 files)

### Testing
- `test/e2e/` - Scheduler E2E tests (Ginkgo, Kind cluster)
- `test/e2e/epp/` - GAIE E2E tests
- `test/sidecar/e2e/` - Sidecar E2E tests
- `test/integration/` - Integration tests (envtest-based hermetic)
- `test/integration/epp/` - EPP-specific integration tests
- `test/testdata/` - Test manifests and fixtures
- `test/utils/` - Shared test utilities
- `test/profiling/tokenizerbench/` - Tokenizer benchmarks

### Build
- `Dockerfile.epp` - Upstream EPP (distroless)
- `Dockerfile.sidecar` - Upstream sidecar (distroless)
- `Dockerfile.builder` - Builder container (Go + tools)
- `Dockerfile.epp.konflux` - Downstream EPP (UBI9)
- `Dockerfile.sidecar.konflux` - Downstream sidecar (UBI9, FIPS)
- `Makefile` - Main Makefile with all targets

### Code Quality
- `.golangci.yml` - golangci-lint v2 config (22+ linters)
- `.typos.toml` - Typos checker config
- `.github/dependabot.yml` - Dependabot (gomod, actions, docker)
- `.github/renovate.json` - Renovate for Konflux
- `hooks/pre-commit` - Git pre-commit hook
- `scripts/compare-coverage.sh` - Coverage comparison script

### Agent Rules
- `AGENTS.md` - Comprehensive agent operating rules and code style
- `.gemini/settings.json` - Gemini agent configuration
