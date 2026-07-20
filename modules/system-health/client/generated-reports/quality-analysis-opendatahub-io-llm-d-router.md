---
repository: "opendatahub-io/llm-d-router"
jira_project: "INFERENG"
jira_component: "llm-d"
tier: "midstream"
overall_score: 8.5
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "309 test files across 450 source files; testify, Ginkgo, and standard Go testing with t.Parallel()"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Multi-suite E2E with 6-way matrix strategy; hermetic integration tests; Kind cluster testing"
  - dimension: "Build Integration"
    score: 9.0
    status: "Tekton/Konflux pipelines with PR builds; Helm chart verification; kubectl-validate manifest checks"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage builds with UBI9/distroless; images exercised in E2E but no standalone container tests"
  - dimension: "Coverage Tracking"
    score: 8.0
    status: "Custom coverage comparison against main and release baselines with regression gate enforcement"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "20+ workflows with concurrency control, path filtering, caching, and matrix strategies"
  - dimension: "Static Analysis"
    score: 8.0
    status: "golangci-lint v2 with 20+ linters; Dependabot for 3 ecosystems; govulncheck; FIPS build tags"
  - dimension: "Agent Rules"
    score: 7.0
    status: "Comprehensive AGENTS.md with operating rules, code style, and git workflow; no test-specific .claude/rules/"
critical_gaps:
  - title: "No external coverage reporting service"
    impact: "Coverage trends not visible to contributors; PR coverage changes not surfaced in PR comments"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No standalone container runtime validation tests"
    impact: "Container startup, port binding, and health probe issues caught only during full E2E runs"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "math/rand usage in scheduling paths not flagged"
    impact: "Non-cryptographic PRNG used in scheduling; acceptable for load balancing but should be documented"
    severity: "LOW"
    effort: "1-2 hours"
quick_wins:
  - title: "Add codecov.yml with PR comment reporting"
    effort: "2-3 hours"
    impact: "Coverage visibility in PRs; trend tracking across branches"
  - title: "Create .claude/rules/ with test-specific guidance"
    effort: "2-3 hours"
    impact: "Consistent AI-generated tests following project patterns (testify, Ginkgo, t.Parallel)"
  - title: "Add .pre-commit-config.yaml for pre-commit framework"
    effort: "1-2 hours"
    impact: "Standardized hook management; easier contributor onboarding alongside existing hooks/pre-commit"
recommendations:
  priority_0:
    - "Add codecov integration for PR coverage reporting and trend tracking"
    - "Document FIPS compliance strategy (strictfipsruntime in Konflux, math/rand acceptable for scheduling)"
  priority_1:
    - "Add standalone container startup tests using Testcontainers for EPP and sidecar images"
    - "Create .claude/rules/ with test creation rules covering unit (testify), E2E (Ginkgo), and integration patterns"
    - "Add contract tests for gRPC and HTTP API boundaries"
  priority_2:
    - "Extend nightly performance suite with additional workload profiles"
    - "Add chaos engineering tests for pod disruption and network partition scenarios"
    - "Adopt pre-commit framework alongside existing custom hooks"
---

# Quality Analysis: llm-d-router

## Executive Summary

- **Overall Score: 8.5/10** - Exemplary quality practices across nearly all dimensions
- **Repository**: [opendatahub-io/llm-d-router](https://github.com/opendatahub-io/llm-d-router)
- **Jira**: INFERENG / llm-d (midstream tier)
- **Type**: Go service (LLM inference router with Endpoint Picker and disaggregated sidecar)
- **Key Strengths**: Exceptional test coverage (309 test files, 0.69 test-to-code ratio), comprehensive multi-suite E2E testing with matrix strategy, Tekton/Konflux build integration, custom coverage regression gates, 20+ CI workflows with concurrency control
- **Critical Gaps**: No external coverage service (codecov); no standalone container runtime tests; missing .claude/rules/ for test patterns
- **Agent Rules Status**: Present (comprehensive AGENTS.md with CLAUDE.md symlink; no .claude/rules/)

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 9.0/10 | 309 test files; testify + Ginkgo + stdlib; t.Parallel() in 45 files |
| Integration/E2E | 20% | 9.0/10 | 6-way matrix E2E; hermetic integration; Kind cluster; 3 E2E suites |
| Build Integration | 15% | 9.0/10 | Tekton/Konflux pipelines; Helm verification; manifest validation |
| Image Testing | 10% | 7.0/10 | Multi-stage builds; UBI9 + distroless; tested via E2E only |
| Coverage Tracking | 10% | 8.0/10 | Custom coverage-compare with regression gate; no codecov |
| CI/CD Automation | 15% | 9.0/10 | 20+ workflows; path filtering; caching; nightly perf tests |
| Static Analysis | 10% | 8.0/10 | 20+ linters; Dependabot (3 ecosystems); govulncheck; typos |
| Agent Rules | 5% | 7.0/10 | AGENTS.md comprehensive; no test-specific .claude/rules/ |

## Critical Gaps

### 1. No External Coverage Reporting Service
- **Impact**: Coverage trends not visible to contributors outside of CI logs; PR coverage changes not surfaced in PR comments
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: The repo has excellent custom coverage tooling (`scripts/compare-coverage.sh`, `make coverage-compare`) with regression gate enforcement, but no codecov.yml or coveralls integration. Coverage deltas appear in the job summary but not as PR comments.

### 2. No Standalone Container Runtime Validation
- **Impact**: Container startup failures, port binding issues, and health probe misconfigurations only caught during full E2E runs (~45 min)
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: While images are built and loaded into Kind clusters during E2E, there are no fast standalone tests that verify container startup, health endpoints, and signal handling in isolation.

### 3. No Test-Specific Agent Rules
- **Impact**: AI agents generating tests may not follow project-specific patterns (testify assertions, Ginkgo E2E, t.Parallel() usage, test data conventions)
- **Severity**: LOW
- **Effort**: 2-3 hours
- **Details**: AGENTS.md covers general code style and workflow but lacks specific test creation guidance in `.claude/rules/`.

## Quick Wins

### 1. Add codecov.yml with PR Comment Reporting (2-3 hours)
- **Impact**: Coverage visibility in PRs; trend tracking across branches
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
  layout: "reach,diff,flags,files"
  behavior: default
```
Add `codecov/codecov-action` step after test-unit in `ci-pr-checks.yaml`.

### 2. Create .claude/rules/ with Test Patterns (2-3 hours)
- **Impact**: Consistent AI-generated tests following project conventions
- **Implementation**: Use `/test-rules-generator` to generate rules covering:
  - Unit tests: `testify` assertions, `t.Parallel()`, table-driven tests
  - E2E tests: Ginkgo/Gomega patterns, Kind cluster setup, label filtering
  - Integration tests: hermetic vs. live cluster, `envtest` usage

### 3. Adopt Pre-Commit Framework (1-2 hours)
- **Impact**: Standardized hook management with version pinning
- **Implementation**: Create `.pre-commit-config.yaml` wrapping existing `make lint` and `make test` targets, complementing the existing `hooks/pre-commit` script.

## Detailed Findings

### Unit Tests

**Score: 9.0/10**

| Metric | Value |
|--------|-------|
| Test files | 309 |
| Source files | 450 |
| Test-to-code ratio | 0.69 |
| Testing frameworks | stdlib `testing.T` (272), `testify` (177), `ginkgo` (26) |
| Test isolation | `t.Parallel()` in 45 files |
| Benchmark tests | Present (`scheduler_bench_test.go`, `benchmark_test.go`) |

**Strengths**:
- Near 1:1 test-to-code ratio across all packages
- Comprehensive coverage of core routing logic: schedulers, scorers, filters, pickers, profile handlers
- Benchmark tests for performance-critical paths (scheduler, tokenizer, flow control)
- Multiple test frameworks used appropriately: stdlib for unit tests, testify for assertions, Ginkgo for E2E
- Test isolation with `t.Parallel()` widely adopted

**Package coverage highlights**:
- `pkg/epp/framework/plugins/scheduling/` - Every scorer, filter, and picker has tests
- `pkg/epp/flowcontrol/` - Integration tests, benchmark tests, eviction tests
- `pkg/sidecar/proxy/` - Comprehensive connector tests (nixl, sglang, mooncake, p2p)
- `pkg/kvcache/` - Index, scorer, memory management all tested
- `pkg/coordinator/` - Pipeline, steps, config, gateway all tested

### Integration/E2E Tests

**Score: 9.0/10**

**E2E Test Suites** (matrix strategy with 6 parallel legs):
| Suite | Label Filter | Focus |
|-------|-------------|-------|
| pd | !Disruptive && !Extended && !SharedStorage && !Metrics | Core prefill-decode routing |
| pd-shared-storage-deprecated | SharedStorage && DeprecatedPD | Legacy shared storage |
| pd-shared-storage-disagg | SharedStorage && Disagg | Disaggregated shared storage |
| pd-metrics | Metrics | Metrics collection and reporting |
| extended | Extended | Extended scenarios with vLLM renderer |
| disruption | Disruptive | Pod disruption and failover |

**Integration Tests**:
- `test/integration/` with hermetic tests (envtest, no live cluster required)
- Live cluster integration tests requiring `KUBECONFIG`
- Session affinity, dynamic attributes, runtime notification, polling tests
- Well-known config smoke tests validating all shipped configurations

**E2E Infrastructure**:
- Kind cluster setup with automated image loading
- Simulator deployment for testing without GPU
- Custom e2e-runner-setup GitHub Action
- Coordinator E2E tests in separate suite (`test/coordinator/e2e/`)
- Sidecar E2E tests with Kind config (`test/sidecar/e2e/`)

**Performance Testing**:
- Nightly performance test workflow (`nightly-router-perf-test-optimized-baseline-10k-1k.yaml`)
- GKE cluster deployment for realistic perf testing
- `test/perf/` with configuration and Python test runner

### Build Integration

**Score: 9.0/10**

**PR-Time Build Validation**:
- Docker images built on every PR via matrix strategy (builder, EPP, sidecar)
- Images loaded into Kind cluster and exercised in E2E tests
- Helm chart verification (`make verify-helm-charts`) on PRs touching chart files
- Manifest validation with `kubectl-validate` against CRDs from multiple upstream projects

**Tekton/Konflux Integration**:
- 6 Tekton PipelineRun files covering pull-request, push, and tag events
- EPP and sidecar both have Konflux-specific Dockerfiles (`Dockerfile.konflux.epp`, `Dockerfile.konflux.sidecar`)
- UBI9 base images with pinned SHA digests for reproducibility
- FIPS compliance via `-tags=strictfipsruntime` and `CGO_ENABLED=1` in Konflux sidecar build
- Multi-arch pipeline referenced from `odh-konflux-central`

**Artifact Generation**:
- `make artifacts` generates CRD manifests via kustomize
- Kustomize overlays for multiple deployment environments (dev, kubernetes, coordinator)
- Helm charts for standalone and gateway deployments

### Image Testing

**Score: 7.0/10**

**Dockerfiles** (6 total):
| Dockerfile | Base Image | Multi-Stage | Multi-Arch | Purpose |
|-----------|-----------|-------------|------------|---------|
| Dockerfile.epp | distroless/static:nonroot | Yes | Yes (`--platform`) | EPP upstream |
| Dockerfile.sidecar | distroless/static:nonroot | Yes | Yes | Sidecar upstream |
| Dockerfile.coordinator | golang + configurable base | Yes | Yes | Coordinator |
| Dockerfile.builder | golang:1.26.5 | No | N/A | CI builder |
| Dockerfile.konflux.epp | UBI9 go-toolset + ubi-minimal | Yes | Yes | EPP Konflux |
| Dockerfile.konflux.sidecar | UBI9 go-toolset + ubi-minimal | Yes | Yes | Sidecar Konflux |

**Strengths**:
- Multi-stage builds separate build and runtime
- Configurable `BASE_IMAGE` ARG allows switching between distroless and UBI
- Non-root user (65532) in runtime images
- Layer caching optimization with separate `go mod download` step
- Precompilation step for Docker layer cache efficiency
- Red Hat labels on Konflux images
- SHA-pinned base images in Konflux Dockerfiles

**Health Probes**: Defined in deployment manifests for EPP, coordinator, and vLLM components (liveness + readiness probes)

**Gap**: No standalone container startup validation tests (e.g., Testcontainers-based).

### Coverage Tracking

**Score: 8.0/10**

**Coverage Infrastructure**:
- `--coverprofile` and `--covermode=atomic` for all test types (unit, integration, hermetic)
- Separate coverage profiles per component: `epp.out`, `sidecar.out`, `integration.out`, `integration-hermetic.out`
- `scripts/compare-coverage.sh` generates markdown tables comparing baseline vs. current
- Coverage comparison output posted to GitHub Job Summary

**Coverage Gate**:
- Main branch coverage cached and restored on PRs
- `make coverage-compare` runs against main baseline on every PR
- Release branch coverage baselines also compared
- Coverage regression blocks merge via `Enforce coverage gate` step
- Max regression tolerance of 2.0 percentage points (configurable)

**Coverage Reporting**:
- `make coverage-report` generates HTML coverage reports
- `make test-coverage` and `make test-coverage-integration` as convenience aliases

**Gap**: No external service (codecov/coveralls) for persistent trend tracking and PR comment annotations.

### CI/CD Automation

**Score: 9.0/10**

**Workflow Inventory** (20+ workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| ci-pr-checks | PR, push(main) | Unit tests, integration, E2E, coverage |
| ci-lint | PR, push | golangci-lint, format check, go mod tidy |
| ci-coordinator | PR, push | Coordinator unit and E2E tests |
| ci-build-images | Reusable | Build and push container images |
| ci-dev | push(main) | Dev image builds |
| ci-release | tag(v*) | Release image builds and artifacts |
| ci-dependency-review | PR | Dependency vulnerability review |
| ci-signed-commits | PR | DCO sign-off verification |
| check-typos | PR, push | Typo checking with `typos` |
| md-link-check | PR, push | Markdown link verification with `lychee` |
| nightly-router-perf-test | cron(daily 09:00 UTC) | Performance regression testing on GKE |
| stale/unstale | cron(daily)/PR | Stale issue/PR management |
| pr-size-labeler | PR | Auto-label PR by size |
| pr-kind-label | PR | Auto-label PR by kind from body |
| pr-hold-gate | PR | Block merge while held |
| pr-rebase | comment | Automated PR rebasing |
| release-notes-* | PR merge, tag | Release notes automation |
| non-main-gatekeeper | PR | Label non-main-targeted PRs |
| re-run-action | comment | Re-run PR tests via comment |

**Optimization Features**:
- Concurrency control with `cancel-in-progress: true` on all test/lint workflows
- Path filtering (`dorny/paths-filter`) to skip unnecessary CI runs
- Go module and build cache with `actions/cache`
- Matrix strategy for E2E suites (6 parallel legs)
- Timeout configuration on test jobs (30-60 minutes)
- Image artifact passing between jobs for E2E (no redundant rebuilds)

### Static Analysis

**Score: 8.0/10**

**Linting** (`.golangci.yml` v2):
- 20+ linters enabled: `importas`, `bodyclose`, `copyloopvar`, `dupword`, `durationcheck`, `errcheck`, `fatcontext`, `ginkgolinter`, `goconst`, `gocritic`, `govet`, `ineffassign`, `loggercheck`, `makezero`, `misspell`, `nakedret`, `nilnil`, `perfsprint`, `prealloc`, `revive`, `staticcheck`, `unparam`, `unused`, `unconvert`
- Import alias enforcement for internal packages
- Revive rules for Go best practices
- Formatters: `goimports` + `gofmt`
- No issue count limits (`max-issues-per-linter: 0`, `max-same-issues: 0`)

**Additional Static Analysis**:
- `typos` tool for spell checking
- `lychee` for markdown link checking
- `govulncheck` for known vulnerability detection (in presubmit)
- `kubectl-validate` for manifest validation

**Dependency Alerts**:
- Dependabot configured for 3 ecosystems: `gomod`, `github-actions`, `docker`
- Patch-only updates for Go and Docker; all updates for Actions
- Grouped updates by ecosystem
- GAIE dependency explicitly ignored (manual-only)

**FIPS Compatibility**:
- `math/rand` used in scheduling paths (acceptable for load balancing, not security-sensitive)
- Konflux sidecar: `-tags=strictfipsruntime` + `CGO_ENABLED=1` + UBI9 base (FIPS-compliant)
- Konflux EPP: `CGO_ENABLED=1` + UBI9 base
- No `crypto/md5`, `crypto/des`, or `crypto/rc4` usage

**Pre-Commit**:
- Custom pre-commit hook (`hooks/pre-commit`) runs `make lint` and `make test`
- No `.pre-commit-config.yaml` (custom hook, not pre-commit framework)

### Agent Rules

**Score: 7.0/10**

**Present**:
- `AGENTS.md` (comprehensive, 5.8KB) covering:
  - Agent operating rules (allowed/ask-first/never actions)
  - Codebase working guidelines
  - Pull request conventions (minimalism, issue tracking, template)
  - Code style (standard Go, terse comments)
  - Logging conventions with verbosity levels
  - Git workflow (DCO sign-off, imperative commit messages)
- `CLAUDE.md` symlinked to `AGENTS.md`
- `.gemini/settings.json` configured to reference `AGENTS.md`

**Quality Assessment**:
- Comprehensive and actionable general rules
- Security-aware (explicit authorization requirements for public actions)
- Architecture-aware (references plugin model, docs/architecture.md)
- Workflow-aware (`make presubmit` as gate, PR template requirements)

**Gaps**:
- No `.claude/rules/` directory
- No test-specific rules (unit test patterns, E2E conventions, coverage expectations)
- No framework-specific guidance (testify assertion patterns, Ginkgo label conventions)
- **Recommendation**: Use `/test-rules-generator` to generate `.claude/rules/` with project-specific test patterns

## Recommendations

### Priority 0 (Critical)

1. **Add codecov integration** for PR coverage reporting and trend tracking
   - Configure `.codecov.yml` with project and patch targets
   - Add `codecov/codecov-action` to `ci-pr-checks.yaml` after test-unit
   - This complements the existing custom `coverage-compare` tooling

2. **Document FIPS compliance strategy**
   - `math/rand` usage in scheduling is acceptable (non-security-sensitive randomization)
   - Konflux builds already use `strictfipsruntime` for sidecar
   - Verify Konflux EPP also needs FIPS build tags (currently only `CGO_ENABLED=1`)

### Priority 1 (High Value)

3. **Add standalone container startup tests**
   - Use Testcontainers-go to verify EPP and sidecar images start, bind ports, and respond to health probes
   - Faster feedback than full E2E (~seconds vs. ~45 minutes)

4. **Create .claude/rules/ with test creation guidance**
   - Unit test rules: testify assertions, `t.Parallel()`, table-driven tests, test naming
   - E2E test rules: Ginkgo label conventions (`Disruptive`, `Extended`, `SharedStorage`), Kind setup
   - Integration test rules: hermetic vs. live cluster, `envtest` usage, test data conventions

5. **Add contract tests for API boundaries**
   - gRPC service contracts between EPP and sidecar
   - HTTP API contracts for external-facing endpoints
   - Envoy xDS filter protocol contracts

### Priority 2 (Nice-to-Have)

6. **Extend nightly performance suite** with additional workload profiles beyond the current optimized-baseline-10k-1k
7. **Add chaos engineering tests** for pod disruption budget validation and network partition scenarios (beyond current `Disruptive` E2E suite)
8. **Adopt pre-commit framework** (`.pre-commit-config.yaml`) alongside existing custom hooks for standardized hook management

## Comparison to Gold Standards

| Practice | llm-d-router | odh-dashboard | notebooks | kserve |
|----------|-------------|---------------|-----------|--------|
| Unit test ratio | 0.69 (309/450) | 0.8+ | N/A | 0.5+ |
| E2E automation | 6-suite matrix | Multi-layer | 5-layer | Multi-version |
| Coverage gate | Custom regression gate | Codecov + threshold | Basic | Codecov enforcement |
| PR image build | Yes (matrix) | Yes | Yes | Yes |
| Konflux integration | Yes (6 pipelines) | Yes | Yes | Yes |
| Manifest validation | kubectl-validate | - | - | - |
| FIPS compliance | strictfipsruntime in Konflux | - | UBI-based | - |
| Agent rules | Comprehensive AGENTS.md | CLAUDE.md + rules/ | - | - |
| Performance testing | Nightly GKE suite | - | - | - |
| Dependency alerts | Dependabot (3 ecosystems) | Dependabot | Dependabot | Dependabot |

## File Paths Reference

### CI/CD
- `.github/workflows/ci-pr-checks.yaml` - Main test, coverage, and E2E workflow
- `.github/workflows/ci-lint.yaml` - Lint and format checks
- `.github/workflows/ci-coordinator.yaml` - Coordinator-specific tests
- `.github/workflows/ci-build-images.yaml` - Reusable image build workflow
- `.github/workflows/nightly-router-perf-test-optimized-baseline-10k-1k.yaml` - Nightly perf tests
- `.tekton/` - 6 Tekton PipelineRun files for Konflux builds

### Testing
- `test/e2e/` - Main E2E test suite (Ginkgo)
- `test/integration/` - Integration tests (hermetic + live cluster)
- `test/coordinator/e2e/` - Coordinator E2E tests
- `test/sidecar/e2e/` - Sidecar E2E tests
- `test/perf/` - Performance test configuration and runner
- `test/profiling/` - Tokenizer benchmarks

### Code Quality
- `.golangci.yml` - Linter configuration (v2, 20+ linters)
- `.github/dependabot.yml` - Dependency update configuration (3 ecosystems)
- `hooks/pre-commit` - Custom pre-commit hook
- `.typos.toml` - Typo checker configuration
- `.lychee.toml` - Link checker configuration

### Container Images
- `Dockerfile.epp` - EPP upstream (distroless)
- `Dockerfile.sidecar` - Sidecar upstream (distroless)
- `Dockerfile.konflux.epp` - EPP Konflux (UBI9)
- `Dockerfile.konflux.sidecar` - Sidecar Konflux (UBI9, strictfipsruntime)
- `Dockerfile.coordinator` - Coordinator
- `Dockerfile.builder` - CI builder image

### Coverage
- `scripts/compare-coverage.sh` - Coverage comparison script
- `Makefile` targets: `test-coverage`, `coverage-report`, `coverage-compare`

### Agent Rules
- `AGENTS.md` - Comprehensive agent operating rules
- `CLAUDE.md` -> `AGENTS.md` (symlink)
- `.gemini/settings.json` - Gemini agent configuration

### Deployment
- `config/charts/` - Helm charts (routerlib, standalone, gateway)
- `deploy/` - Kustomize overlays for various environments
- `config/crd/` - CRD definitions and kustomization
- `hack/verify-manifests.sh` - Manifest validation script
