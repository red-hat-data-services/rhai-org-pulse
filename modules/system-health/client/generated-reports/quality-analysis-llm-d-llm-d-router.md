---
repository: "llm-d/llm-d-router"
overall_score: 8.2
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "Exceptional test suite — 94k test LOC vs 72k source LOC, 401 t.Parallel() calls, 644 table-driven patterns"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Comprehensive E2E matrix with Kind, envtest-based hermetic integration tests, coordinator and sidecar suites"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-triggered Docker image builds, Helm chart validation, manifest verification via kubectl-validate"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage Dockerfiles, distroless base, multi-arch builds (amd64/arm64), but no runtime container validation tests"
  - dimension: "Coverage Tracking"
    score: 9.0
    status: "Custom coverage regression gate on PRs, baseline comparison against main and release branches, coverprofile generation"
  - dimension: "CI/CD Automation"
    score: 9.5
    status: "22 workflows with path-filtered triggers, concurrency control, Go caching, nightly perf tests on GKE, matrix E2E suites"
  - dimension: "Static Analysis"
    score: 8.5
    status: "22-linter golangci-lint config, govulncheck, typos, Dependabot covering gomod/actions/docker, git pre-commit hook"
  - dimension: "Agent Rules"
    score: 7.0
    status: "Comprehensive AGENTS.md with operating rules, code style, PR workflow, and logging conventions; missing .claude/ rules"
critical_gaps:
  - title: "No FIPS build configuration or compliance checks"
    impact: "Deployment to FIPS-mandated environments (FedRAMP, RHEL FIPS mode) would require significant build pipeline changes"
    severity: "MEDIUM"
    effort: "8-16 hours"
  - title: "math/rand used in non-test production code (9 files)"
    impact: "Non-cryptographically secure randomness in routing decisions; FIPS-incompatible import"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No container runtime validation tests"
    impact: "Image startup failures, missing entrypoint args, or runtime config issues not caught before deployment"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "No codecov.yml or third-party coverage reporting"
    impact: "Coverage data not visible on PRs as inline annotations; harder for reviewers to spot coverage gaps"
    severity: "LOW"
    effort: "2-3 hours"
quick_wins:
  - title: "Add Codecov integration for PR coverage annotations"
    effort: "2-3 hours"
    impact: "Inline coverage visibility on PRs; complement the existing coverage-compare gate with per-line annotations"
  - title: "Create .claude/rules/ for test patterns"
    effort: "2-3 hours"
    impact: "AI-generated tests follow repo conventions (Ginkgo for E2E, testify for unit, t.Parallel(), table-driven)"
  - title: "Replace math/rand with crypto/rand or math/rand/v2 in production code"
    effort: "2-4 hours"
    impact: "FIPS-compatible randomness, better security posture"
  - title: "Add pre-commit-config.yaml for automated hook management"
    effort: "1-2 hours"
    impact: "Standardized hook installation across contributors; currently manual git config step"
recommendations:
  priority_0:
    - "Evaluate FIPS build requirements: add -tags=fips or GOEXPERIMENT=boringcrypto support in Makefile and Dockerfiles for downstream RHEL deployments"
    - "Replace math/rand imports in production code with crypto/rand or math/rand/v2 for FIPS compatibility"
  priority_1:
    - "Add Codecov integration with .codecov.yml configuration and PR coverage annotations"
    - "Add container runtime validation tests (image startup, health endpoint, entrypoint args)"
    - "Create .claude/rules/ directory with test-creation patterns for unit, integration, and E2E tests"
  priority_2:
    - "Standardize pre-commit hooks via .pre-commit-config.yaml for cross-contributor consistency"
    - "Consider adding contract tests for the gRPC EPP interface boundaries"
    - "Add FIPS base image option (UBI) alongside distroless in Dockerfile ARG defaults for downstream"
---

# Quality Analysis: llm-d/llm-d-router

## Executive Summary

**Overall Score: 8.2/10** — This is a high-quality, well-engineered repository with mature testing and CI/CD practices that exceed most projects in the RHOAI ecosystem.

The llm-d-router is a Go service that routes LLM inference requests to model-serving pods via an Endpoint Picker (EPP), with a sidecar for disaggregated inference coordination. It sits in the INFERENG/llm-d Jira space.

**Key Strengths:**
- Exceptional test-to-code ratio (94k test LOC vs 72k source LOC = 1.31:1)
- Comprehensive E2E test matrix with 6 labeled suites running on Kind clusters in CI
- Custom coverage regression gate comparing PR coverage against main and release branch baselines
- 22-linter golangci-lint configuration with govulncheck
- Well-structured AGENTS.md with actionable rules for contributors and AI agents

**Critical Gaps:**
- No FIPS build configuration or crypto compliance checks
- `math/rand` used in 9 production source files (non-crypto PRNG in routing paths)
- No container runtime validation tests (image startup, health checks)
- No third-party coverage reporting (Codecov/Coveralls) for PR annotations

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 9.0/10 | 15% | 1.35 | Exceptional test suite — 280 unit test files, t.Parallel(), table-driven |
| Integration/E2E | 9.0/10 | 20% | 1.80 | Comprehensive E2E matrix + envtest hermetic integration tests |
| Build Integration | 8.0/10 | 15% | 1.20 | PR Docker builds, Helm chart validation, manifest verification |
| Image Testing | 7.0/10 | 10% | 0.70 | Multi-stage distroless builds, multi-arch; no runtime validation |
| Coverage Tracking | 9.0/10 | 10% | 0.90 | Custom regression gate, baseline comparison, coverprofile |
| CI/CD Automation | 9.5/10 | 15% | 1.43 | 22 workflows, path filters, concurrency control, nightly perf |
| Static Analysis | 8.5/10 | 10% | 0.85 | 22 linters, govulncheck, typos, Dependabot (3 ecosystems) |
| Agent Rules | 7.0/10 | 5% | 0.35 | Strong AGENTS.md; missing .claude/rules/ for test patterns |
| **Overall** | **8.2/10** | **100%** | **8.58** | |

## Critical Gaps

### 1. No FIPS Build Configuration (MEDIUM)
- **Impact**: Deployment to FIPS-mandated environments requires build pipeline changes
- **Evidence**: No `-tags=fips`, `GOEXPERIMENT=boringcrypto`, or UBI base images configured
- **Effort**: 8-16 hours
- **Downstream relevance**: Red Hat downstream (red-hat-data-services/llm-d-router) will need FIPS-compliant builds for RHEL/OCP deployments

### 2. math/rand in Production Code (MEDIUM)
- **Impact**: Non-cryptographically secure randomness used in routing decisions; FIPS-incompatible import
- **Evidence**: 9 production files import `math/rand` (director.go, filter plugins, latency predictor)
- **Files affected**:
  - `pkg/epp/requestcontrol/director.go`
  - `pkg/epp/framework/plugins/scheduling/filter/sloheadroomtier/plugin.go`
  - `pkg/epp/framework/plugins/scheduling/filter/prefixcacheaffinity/plugin.go`
  - `pkg/epp/framework/plugins/requestcontrol/dataproducer/predictedlatency/decode_token_sampler.go`
  - `pkg/epp/framework/plugins/requestcontrol/dataproducer/predictedlatency/latencypredictorclient/latencypredictor_async.go`
- **Effort**: 2-4 hours

### 3. No Container Runtime Validation (MEDIUM)
- **Impact**: Image startup failures or runtime config issues not caught before deployment
- **Evidence**: E2E tests deploy to Kind but don't explicitly test container health endpoints or entrypoint behavior in isolation
- **Effort**: 4-8 hours

### 4. No Codecov/Third-Party Coverage Reporting (LOW)
- **Impact**: Coverage not visible as inline annotations on PR diffs
- **Evidence**: Custom `compare-coverage.sh` script exists but no `.codecov.yml` or codecov-action
- **Note**: The custom coverage gate is actually more rigorous than most codecov setups — this gap is about developer experience, not rigor
- **Effort**: 2-3 hours

## Quick Wins

### 1. Add Codecov Integration (2-3 hours)
Complement the existing coverage regression gate with Codecov for inline PR annotations.

```yaml
# .codecov.yml
coverage:
  precision: 2
  round: down
  status:
    project:
      default:
        target: auto
        threshold: 1%
    patch:
      default:
        target: 80%
```

### 2. Create .claude/rules/ for Test Patterns (2-3 hours)
Generate rules using `/test-rules-generator` to codify the repo's testing conventions:
- Unit tests: `testify/assert` + `testify/require`, `t.Parallel()`, table-driven patterns
- E2E tests: Ginkgo/Gomega with labeled suites, Kind cluster setup
- Integration: envtest-based hermetic tests

### 3. Replace math/rand in Production Code (2-4 hours)
```go
// Before (FIPS-incompatible)
import "math/rand"
idx := rand.Intn(len(candidates))

// After (FIPS-compatible, Go 1.22+)
import "math/rand/v2"
idx := rand.IntN(len(candidates))
```

### 4. Add .pre-commit-config.yaml (1-2 hours)
Formalize the existing `hooks/pre-commit` script with a `.pre-commit-config.yaml` so hooks install via `pre-commit install` instead of `git config core.hooksPath`.

## Detailed Findings

### Unit Tests (9.0/10)

**Strengths:**
- **280 unit test files** across `pkg/` covering EPP, sidecar, kvcache, kvevents, common utilities
- **94,338 lines of test code** vs 71,594 lines of source code (1.31:1 ratio — exceptional)
- **401 `t.Parallel()` calls** — strong test isolation and parallelization
- **644 table-driven test patterns** — thorough input coverage
- **Dual frameworks**: `testify/assert`+`require` for unit tests, Ginkgo/Gomega for E2E
- Race detection enabled: `-race` flag in all test targets
- **Benchmark tests**: `zmq_subscriber_bench_test.go`, tokenizer benchmarks

**Minor gaps:**
- Some test files in `pkg/kvcache/` and `pkg/kvevents/` excluded from linting (transferred from llm-d-kv-cache)

### Integration/E2E Tests (9.0/10)

**Strengths:**
- **E2E test matrix** with 6 labeled suites: `pd`, `pd-shared-storage-deprecated`, `pd-shared-storage-disagg`, `pd-metrics`, `extended`, `disruption`
- **Kind cluster-based E2E**: Full Kubernetes deployment with Gateway API, InferencePool CRDs
- **Hermetic integration tests**: envtest-based tests requiring no external cluster (`test-integration-hermetic`)
- **Separate coordinator E2E suite** with its own CI workflow
- **Sidecar E2E suite** at `test/sidecar/e2e/`
- **Test scripts**: `test/scripts/test-e2e-router.sh`, `test/scripts/e2e-common.sh`
- **Test data**: YAML fixtures in `test/testdata/`
- **Test utilities**: Shared helpers in `test/utils/` (server, network, context, handle, dump)

**Gaps:**
- No multi-version K8s/OCP testing in E2E matrix (single K8s version via Kind)

### Build Integration (8.0/10)

**Strengths:**
- **PR-triggered Docker image builds** in `ci-pr-checks.yaml` — EPP, builder, sidecar images built on every PR
- **Helm chart validation**: `verify-helm-charts` target with `kubectl-validate`
- **Manifest verification**: `hack/verify-manifests.sh` with `kubectl-validate`
- **Kustomize**: CRD manifests generated via `kubectl kustomize config/crd`
- **Artifact generation**: Release artifacts with CRD splitting (v1 vs experimental)
- **Builder container**: Reproducible builds via `Dockerfile.builder` with pinned tool versions

**Gaps:**
- No Konflux build simulation (expected for downstream, not necessarily for upstream)
- No dry-run deployment testing in PR CI (Kind E2E tests do full deployment but as a separate concern)

### Image Testing (7.0/10)

**Strengths:**
- **Multi-stage builds**: All 4 Dockerfiles use multi-stage (builder + runtime)
- **Distroless base image**: `gcr.io/distroless/static:nonroot` — minimal CVE surface
- **Configurable base**: `BASE_IMAGE` ARG allows override to UBI for downstream
- **Multi-architecture**: `linux/amd64,linux/arm64` builds in push workflow via `docker buildx`
- **Non-root execution**: `USER 65532:65532` in all runtime images
- **Exposed ports documented**: gRPC, health, metrics, ZMQ

**Gaps:**
- No container runtime validation tests (startup, health endpoint)
- No Testcontainers or equivalent for image testing
- No container health checks (`HEALTHCHECK`) in Dockerfiles (relies on K8s probes)

### Coverage Tracking (9.0/10)

**Strengths:**
- **Custom coverage regression gate**: `compare-coverage.sh` compares PR coverage against main branch baseline
- **Release branch baselines**: Downloads and compares coverage against latest release branches
- **Coverage generation**: `--coverprofile` with `atomic` covermode for all test types (unit, integration, hermetic)
- **Coverage HTML reports**: `make coverage-report` target generates HTML per component
- **Enforced on PRs**: CI step `Enforce coverage gate` fails the PR if coverage regresses
- **Separate coverage for components**: `epp.out`, `sidecar.out`, `integration.out`, `integration-hermetic.out`

**Gaps:**
- No `.codecov.yml` or third-party coverage reporting
- No explicit minimum coverage threshold (regression-only, not absolute floor)
- `COVERAGE_THRESHOLD` defaults to 0 in Makefile

### CI/CD Automation (9.5/10)

**Strengths:**
- **22 workflows** covering lint, test, build, release, perf, signed commits, dependency review, stale issues
- **Path-filtered triggers**: `dorny/paths-filter` to skip unnecessary CI runs
- **Concurrency control**: `cancel-in-progress: true` on all PR workflows
- **Go caching**: Custom cache dir strategy with `actions/cache@v6`
- **Matrix strategies**: E2E images (3x common + 2x router), E2E suites (6x labeled)
- **Nightly performance tests**: GKE-based perf benchmarks with `inference-perf`, pprof collection, GCS result storage
- **Signed commits check**: `ci-signed-commits.yaml` enforces DCO sign-off
- **Dependency review**: `ci-dependency-review.yaml` for supply chain safety
- **Release pipeline**: `ci-release.yaml` for tagged releases with Helm chart publishing
- **Timeout limits**: All jobs have explicit `timeout-minutes`

**Notable:**
- The CI is among the most comprehensive in the llm-d ecosystem

### Static Analysis (8.5/10)

#### Linting
- **22 linters enabled** in `.golangci.yml` v2: importas, bodyclose, copyloopvar, dupword, durationcheck, errcheck, fatcontext, ginkgolinter, goconst, gocritic, govet, ineffassign, loggercheck, makezero, misspell, nakedret, nilnil, perfsprint, prealloc, revive, staticcheck, unparam, unused, unconvert
- **Formatters**: goimports, gofmt
- **Revive rules**: 14 specific rules configured
- **Import aliasing**: Enforced via `importas` for 12 internal packages
- **govulncheck**: Run in both CI and presubmit
- **typos**: Spell checker via `.typos.toml`

#### FIPS Compatibility
- **No FIPS build configuration**: No `-tags=fips`, `GOEXPERIMENT=boringcrypto`, or FIPS build tags
- **math/rand usage**: 9 production files, 2 test files — non-FIPS-compatible import
- **No UBI base images**: Distroless default; UBI available via `BASE_IMAGE` ARG but not default
- **CGO_ENABLED=0**: Prevents linking against BoringCrypto/OpenSSL FIPS providers

#### Dependency Alerts
- **Dependabot configured** for 3 ecosystems:
  - `gomod`: Weekly, patches only (major/minor handled via `make upgrade-deps`)
  - `github-actions`: Weekly, all update types
  - `docker`: Weekly, patches only
- **Grouping**: Go deps and K8s deps grouped for batch PRs
- **Labels**: `dependencies`, `release-note-none` applied automatically

### Agent Rules (7.0/10)

**Strengths:**
- **Comprehensive AGENTS.md** covering:
  - Allowed/Ask-first/Never permission model for agent actions
  - Working in the codebase: read before writing, verify against code not filenames
  - Pull request conventions: minimalism, issue tracking, PR template usage
  - Code style: standard Go, terse comments, no temporal framing
  - Logging conventions with verbosity constants and guard patterns
  - Git workflow: DCO sign-off, imperative subjects
- **Gemini config**: `.gemini/settings.json` references `AGENTS.md`

**Gaps:**
- No `.claude/` directory or `.claude/rules/` for test-specific patterns
- No `CLAUDE.md` (uses `AGENTS.md` instead, which is fine for multi-agent support)
- No framework-specific test creation rules (e.g., when to use Ginkgo vs testify, label conventions for E2E)
- No skills or custom automation for AI agents

## Recommendations

### Priority 0 (Critical for Downstream)

1. **Evaluate FIPS build requirements**: Add `-tags=fips` or `GOEXPERIMENT=boringcrypto` support in Makefile and Dockerfiles. The downstream `red-hat-data-services/llm-d-router` will need FIPS-compliant builds for RHEL/OCP.

2. **Replace `math/rand` in production code**: Use `math/rand/v2` (Go 1.22+) or `crypto/rand` where appropriate. Current usage is in routing/scheduling paths where determinism matters more than cryptographic security, but FIPS compliance requires avoiding the `math/rand` import entirely.

### Priority 1 (High Value)

3. **Add Codecov integration**: Add `.codecov.yml` and `codecov/codecov-action` to `ci-pr-checks.yaml` for inline PR coverage annotations. The existing custom coverage gate is excellent but lacks per-line visibility.

4. **Add container runtime validation tests**: Test image startup, health endpoint availability, and entrypoint behavior. Can be added to the E2E suite or as a standalone CI step.

5. **Create .claude/rules/ directory**: Use `/test-rules-generator` to capture the repo's testing conventions for AI-assisted development. Key rules:
   - Unit tests: testify, t.Parallel(), table-driven, race detection
   - E2E tests: Ginkgo with labels (Disruptive, Extended, SharedStorage, Metrics)
   - Integration: envtest-based hermetic tests

### Priority 2 (Nice-to-Have)

6. **Standardize pre-commit hooks**: Replace `git config core.hooksPath hooks` with `.pre-commit-config.yaml` for easier contributor onboarding.

7. **Add contract tests for gRPC EPP interface**: Test the gRPC service boundary independently from full E2E deployment.

8. **Add multi-version K8s testing**: Test against multiple K8s versions in the E2E matrix to catch API compatibility issues early.

## Comparison to Gold Standards

| Capability | llm-d-router | odh-dashboard | notebooks | kserve |
|-----------|-------------|---------------|-----------|--------|
| Test-to-code ratio | 1.31:1 | ~0.8:1 | ~0.5:1 | ~0.7:1 |
| E2E automation | Matrix (6 suites) | Cypress + Jest | Multi-layer | Ginkgo E2E |
| Coverage enforcement | Custom regression gate | Codecov threshold | Basic | Codecov |
| CI workflows | 22 workflows | 15+ workflows | 10+ workflows | 20+ workflows |
| Lint config | 22 linters + govulncheck | ESLint strict | Basic | golangci-lint |
| Multi-arch | amd64/arm64 | N/A (frontend) | Multi-arch | amd64/arm64 |
| Perf testing | Nightly GKE benchmark | None | None | None |
| Agent rules | AGENTS.md (comprehensive) | CLAUDE.md | None | None |
| FIPS readiness | Not configured | N/A | Partial | Partial |
| Pre-commit hooks | Custom script | None | None | None |
| Dependabot | 3 ecosystems | Configured | Configured | Configured |

## File Paths Reference

### CI/CD
- `.github/workflows/ci-pr-checks.yaml` — Main PR test workflow (unit + hermetic integration + E2E matrix + coverage gate)
- `.github/workflows/ci-lint.yaml` — Lint, build, govulncheck
- `.github/workflows/ci-build-images.yaml` — Reusable image build workflow
- `.github/workflows/ci-dev.yaml` — Dev image push on main
- `.github/workflows/ci-coordinator.yaml` — Coordinator unit + E2E tests
- `.github/workflows/ci-release.yaml` — Tagged release pipeline
- `.github/workflows/nightly-router-perf-test-optimized-baseline-10k-1k.yaml` — Nightly perf benchmark
- `.github/workflows/ci-signed-commits.yaml` — DCO sign-off enforcement
- `.github/workflows/ci-dependency-review.yaml` — Dependency review

### Testing
- `test/e2e/` — E2E tests (Ginkgo, 8 test files)
- `test/integration/` — Integration tests (14 test files, envtest-based)
- `test/coordinator/e2e/` — Coordinator E2E tests (6 test files)
- `test/sidecar/e2e/` — Sidecar E2E tests
- `test/perf/` — Performance benchmarks (nightly GKE)
- `test/profiling/` — Tokenizer benchmarks
- `test/utils/` — Shared test utilities
- `test/testdata/` — Test fixtures
- `test/scripts/` — E2E runner scripts

### Code Quality / Static Analysis
- `.golangci.yml` — 22-linter configuration
- `.typos.toml` — Spell checker config
- `.github/dependabot.yml` — Dependabot (gomod, actions, docker)
- `hooks/pre-commit` — Git pre-commit hook (lint + test)
- `scripts/compare-coverage.sh` — Coverage regression comparison

### Container Images
- `Dockerfile.epp` — EPP image (multi-stage, distroless)
- `Dockerfile.sidecar` — Sidecar image (multi-stage, distroless)
- `Dockerfile.coordinator` — Coordinator image (multi-stage, distroless)
- `Dockerfile.builder` — Builder image (Go tools, linters, Kind, kubectl)
- `.dockerignore` — Build context exclusions

### Agent Rules
- `AGENTS.md` — Comprehensive agent operating rules
- `.gemini/settings.json` — Gemini config referencing AGENTS.md
