---
repository: "opendatahub-io/operator-chaos"
overall_score: 5.5
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "Outstanding test-to-code ratio (1.35x LOC), 128 test files, 12 fuzz tests, 55 table-driven patterns"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "envtest integration tests and SDK tests present, but no automated E2E in PR CI"
  - dimension: "Build Integration"
    score: 5.0
    status: "Go binary and dashboard UI builds in CI, but no container image or kustomize validation"
  - dimension: "Image Testing"
    score: 5.0
    status: "Multi-stage Dockerfiles with distroless runtime, but no CI image build or runtime validation"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tooling, thresholds, or PR reporting configured"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "PR-triggered CI with lint and race-enabled tests, but no concurrency control or test matrix"
  - dimension: "Static Analysis"
    score: 5.0
    status: "golangci-lint with 5 linters in CI, but no Dependabot, pre-commit, or FIPS build tags"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Test coverage regressions go undetected; no visibility into which code paths lack tests"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container image build in PR CI"
    impact: "Containerfile breakage discovered post-merge; no Konflux simulation"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No dependency alert configuration"
    impact: "Vulnerable or outdated dependencies not flagged automatically"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents lack context for test patterns, coding standards, and repo conventions"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add Dependabot for Go modules and GitHub Actions"
    effort: "1-2 hours"
    impact: "Automated dependency update PRs with security alerts"
  - title: "Add codecov integration with --coverprofile"
    effort: "2-4 hours"
    impact: "Coverage visibility, PR comments, and threshold enforcement"
  - title: "Enable more golangci-lint linters"
    effort: "1-2 hours"
    impact: "Catch more code quality issues (gosimple, gofmt, goimports, exhaustive, nilerr)"
  - title: "Add container image build to PR CI"
    effort: "2-3 hours"
    impact: "Catch Containerfile breakage before merge"
recommendations:
  priority_0:
    - "Add --coverprofile to CI test step and integrate Codecov with threshold enforcement"
    - "Add container image build step to PR CI workflow for both CLI and dashboard images"
    - "Configure Dependabot for gomod, npm, and github-actions ecosystems"
  priority_1:
    - "Add concurrency control and timeout-minutes to CI workflows"
    - "Enable more golangci-lint linters (gosimple, gofmt, goimports, exhaustive, nilerr, gocritic)"
    - "Create CLAUDE.md with testing patterns, framework conventions, and quality standards"
    - "Add kustomize build validation to PR CI"
  priority_2:
    - "Add pre-commit hooks for formatting and linting"
    - "Consider UBI base images for FIPS compatibility"
    - "Add multi-version K8s testing matrix to upgrade-gate workflow"
    - "Add testcontainers-based runtime validation for container images"
---

# Quality Analysis: operator-chaos

## Executive Summary

- **Overall Score: 5.5/10**
- **Repository**: [opendatahub-io/operator-chaos](https://github.com/opendatahub-io/operator-chaos)
- **Jira**: RHOAIENG / AI Core Platform Security (midstream)
- **Type**: Kubernetes operator / chaos engineering framework (Go + Node.js dashboard)
- **Framework**: controller-runtime operator with CLI, SDK, and dashboard components

### Key Strengths
- **Exceptional test culture**: 128 test files for 156 source files (0.82 file ratio), with test LOC exceeding source LOC (35,091 vs 25,951 — 1.35x ratio)
- **Fuzz testing**: 12 fuzz tests covering reconciler, parser, and SDK paths — rare and valuable
- **Integration tests with envtest**: Controller tests use envtest with CRD installation
- **Well-structured project**: Clean separation of pkg/, internal/, cmd/, tests/, with dedicated SDK test suites for opendatahub and certmanager operators

### Critical Gaps
- **No coverage tracking**: Zero coverage tooling — no codecov, no --coverprofile, no thresholds
- **No container image build in CI**: Containerfile changes untested until post-merge
- **No dependency alerts**: No Dependabot or Renovate configured
- **No agent rules**: No CLAUDE.md or .claude/ directory for AI-assisted development

### Agent Rules Status: Missing

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 9.0/10 | Outstanding test-to-code ratio, 12 fuzz tests, 55 table-driven patterns |
| Integration/E2E | 20% | 7.0/10 | envtest + SDK tests present, but no automated E2E in PR CI |
| Build Integration | 15% | 5.0/10 | Go binary + UI builds in CI, no container or kustomize validation |
| Image Testing | 10% | 5.0/10 | Multi-stage Dockerfiles with distroless, no CI build or runtime tests |
| Coverage Tracking | 10% | 1.0/10 | No coverage tooling at all |
| CI/CD Automation | 15% | 6.0/10 | PR-triggered CI with lint + race, no concurrency control or matrix |
| Static Analysis | 10% | 5.0/10 | golangci-lint (5 linters), no Dependabot, pre-commit, or FIPS tags |
| Agent Rules | 5% | 0.0/10 | No agent rules or AI development guidance |
| **Overall** | **100%** | **5.5/10** | |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: Test coverage regressions go undetected; no visibility into which code paths lack tests
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Despite having an excellent test suite (128 test files, 12 fuzz tests), there is zero coverage infrastructure. No `.codecov.yml`, no `--coverprofile` in CI or Makefile, no coverage thresholds, and no PR coverage reporting. This means the strong testing culture has no guardrails to prevent regression.

### 2. No Container Image Build in PR CI
- **Impact**: Containerfile breakage discovered only after merge; no Konflux build simulation
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The CI workflow builds Go binaries (`go build -o /dev/null ./...`) and the dashboard UI (`npm ci && npm run build`), but never builds the container images. Both `Containerfile` and `dashboard/Containerfile` changes go untested in PRs. No kustomize build validation either.

### 3. No Dependency Alert Configuration
- **Impact**: Vulnerable or outdated dependencies not flagged automatically
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: No `.github/dependabot.yml` and no Renovate configuration. The project depends on 60+ Go modules including security-sensitive Kubernetes client libraries, plus npm dependencies for the dashboard.

### 4. No Agent Rules for AI-Assisted Development
- **Impact**: AI agents lack context for test patterns, coding standards, and repo conventions
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory. Given the project's strong testing patterns (fuzz tests, table-driven tests, envtest integration), documenting these patterns for AI agents would amplify test quality.

## Quick Wins

### 1. Add Dependabot for Go Modules and GitHub Actions
- **Effort**: 1-2 hours
- **Impact**: Automated dependency update PRs with security alerts
- **Implementation**:
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "gomod"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "npm"
    directory: "/dashboard/ui"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 2. Add Codecov Integration with --coverprofile
- **Effort**: 2-4 hours
- **Impact**: Coverage visibility, PR comments, and threshold enforcement
- **Implementation**:
```yaml
# Add to .github/workflows/ci.yaml in go-checks job:
- name: Run tests with coverage
  run: go test -race -coverprofile=coverage.out ./... -count=1
- name: Upload coverage
  uses: codecov/codecov-action@v5
  with:
    files: coverage.out
    fail_ci_if_error: false
```
```yaml
# .codecov.yml
coverage:
  status:
    project:
      default:
        target: auto
        threshold: 2%
    patch:
      default:
        target: 80%
```

### 3. Enable More golangci-lint Linters
- **Effort**: 1-2 hours
- **Impact**: Catch more code quality issues
- **Implementation**:
```yaml
# .golangci.yml
version: "2"
linters:
  enable:
    - govet
    - errcheck
    - staticcheck
    - unused
    - ineffassign
    - gosimple
    - gofmt
    - goimports
    - exhaustive
    - nilerr
    - gocritic
    - bodyclose
    - noctx
```

### 4. Add Container Image Build to PR CI
- **Effort**: 2-3 hours
- **Impact**: Catch Containerfile breakage before merge
- **Implementation**:
```yaml
# Add to .github/workflows/ci.yaml:
container-build:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v5
    - name: Build CLI image
      run: docker build -f Containerfile -t operator-chaos:test .
    - name: Build dashboard image
      run: |
        cd dashboard/ui && npm ci && npm run build && cd ../..
        docker build -f dashboard/Containerfile -t chaos-dashboard:test .
```

## Detailed Findings

### Unit Tests
- **Score: 9.0/10**
- **Test files**: 128 test files for 156 source files (0.82 ratio)
- **Test LOC**: 35,091 lines of test code vs 25,951 lines of source code (1.35x ratio — tests exceed source)
- **Framework**: Go standard `testing` package with `testify` (require, assert)
- **Patterns**: 55 table-driven test patterns, 20 uses of `t.Parallel()`/`t.Helper()`/`t.Cleanup()`
- **Fuzz testing**: 12 fuzz tests covering:
  - `FuzzChaosExperimentReconciler` and `FuzzChaosExperimentWithSpecificFaults` (controller)
  - `FuzzODHReconciler` and `FuzzDSCIReconciler` (SDK opendatahub)
  - `FuzzCertManagerReconciler` (SDK certmanager)
  - `FuzzDecodeFaultConfig` and `FuzzHarnessRun` (SDK fuzz)
  - `FuzzParseFaultConfig` (SDK configmap)
  - `FuzzUnwrapRollbackData` (safety)
  - `FuzzKnowledgeParse` and `FuzzExperimentParse` (model/experiment)
- **Coverage breadth**: Tests cover injection types (20+ fault types), safety mechanisms (TTL, mutex, blast radius, rollback), SDK client/transport, model/knowledge loading, CLI commands, dashboard API handlers, reporters (JSON, HTML, JUnit, markdown), and diff/analyzer packages
- **Minor gap**: Could add more `t.Parallel()` usage for faster test execution

### Integration/E2E Tests
- **Score: 7.0/10**
- **envtest integration**: `internal/controller/suite_test.go` sets up envtest with CRDs for controller integration testing (build-tagged as `//go:build integration`)
- **Integration test**: `tests/integration/experiment_test.go` (277 lines) tests experiment lifecycle with envtest
- **SDK operator tests**: `tests/sdk/opendatahub/` (DSC/DSCI reconciler + fuzz) and `tests/sdk/certmanager/` (reconciler + fuzz) — 787 lines total
- **Model integration**: `pkg/model/integration_test.go` and `pkg/diff/integration_test.go` test cross-package behavior
- **Dashboard store**: `dashboard/internal/store/integration_test.go` tests SQLite integration
- **Kind cluster**: Used in `upgrade-gate.yaml` workflow for real cluster testing
- **Gaps**:
  - Upgrade-gate workflow is dispatch-only, not PR-triggered
  - No automated E2E tests running in PR CI
  - No multi-version K8s testing matrix

### Build Integration
- **Score: 5.0/10**
- **CI builds**: `go build -o /dev/null ./...` validates all Go packages compile
- **Dashboard build**: `npm ci && npm run build` in CI
- **Experiment validation**: CI validates all experiment YAML files using `operator-chaos validate`
- **CRD generation**: `make manifests` generates CRD YAMLs via controller-gen
- **Kustomize config**: Full kustomize setup in `config/` (default, controller, dashboard, rbac, crd, grafana, tekton)
- **Gaps**:
  - No container image build in PR CI
  - No kustomize build validation (`kustomize build config/default/`) in CI
  - No Konflux build simulation
  - No `kubectl apply --dry-run` validation

### Image Testing
- **Score: 5.0/10**
- **Multi-stage builds**: Both `Containerfile` and `dashboard/Containerfile` use multi-stage builds
- **Base images**: `golang:1.25` (builder) → `gcr.io/distroless/static:nonroot` (runtime)
- **Dashboard**: `node:18-alpine` (UI build) → `golang:1.25` (backend) → `distroless/static:nonroot` (runtime)
- **Security**: Non-root user `65532:65532`, distroless runtime, `.dockerignore` configured
- **Multi-arch**: `TARGETARCH` build arg support
- **Health checks**: Liveness and readiness probes defined in K8s deployment manifests (`config/controller/deployment.yaml`, `config/dashboard/deployment.yaml`)
- **Gaps**:
  - No container image build in CI
  - No runtime validation (testcontainers, docker run)
  - No image startup testing
  - Not using UBI base images (FIPS concern)
  - No `docker buildx` for multi-platform builds

### Coverage Tracking
- **Score: 1.0/10**
- **No `.codecov.yml`** or any coverage configuration
- **No `--coverprofile`** in CI test command or Makefile test target
- **No coverage thresholds** or enforcement
- **No PR coverage reporting** or comments
- **Context**: Despite having one of the strongest test suites in the RHOAI ecosystem (1.35x test-to-source LOC ratio), there is zero tooling to track or enforce coverage. This is a critical miss.

### CI/CD Automation
- **Score: 6.0/10**
- **Workflows**: 3 workflows
  - `ci.yaml`: PR + push to main — go vet, tests (race), golangci-lint, experiment validation, full build
  - `docs.yaml`: Push to main (path-filtered) — MkDocs deployment
  - `upgrade-gate.yaml`: dispatch/call only — Kind cluster provisioning + playbook execution + JUnit reporting
- **Strengths**:
  - Race detector enabled (`-race` flag)
  - golangci-lint via official action (v9)
  - Go caching via actions/setup-go
  - JUnit report publishing in upgrade-gate
  - Proper permissions scoping (`contents: read`, `checks: write`)
- **Gaps**:
  - No concurrency control (`concurrency:` not set) — parallel PR CI runs can waste resources
  - No `timeout-minutes` set on jobs
  - No test matrix (single Go version, single OS)
  - Upgrade-gate not triggered on PRs
  - No container build in CI
  - No caching for npm dependencies

### Static Analysis
- **Score: 5.0/10**
- **golangci-lint**: Configured with 5 linters: `govet`, `errcheck`, `staticcheck`, `unused`, `ineffassign`
- **CI integration**: golangci-lint runs in CI via `golangci/golangci-lint-action@v9`
- **FIPS compatibility**:
  - Uses `math/rand/v2` in 5 files — acceptable for chaos engineering (non-cryptographic randomness)
  - No FIPS build tags (`-tags=fips`, `GOEXPERIMENT=boringcrypto`)
  - Uses `gcr.io/distroless/static:nonroot` and `node:18-alpine` base images instead of UBI
- **Gaps**:
  - Only 5 linters enabled (could add `gosimple`, `gofmt`, `goimports`, `exhaustive`, `nilerr`, `gocritic`, `bodyclose`, `noctx`)
  - No `.pre-commit-config.yaml`
  - No `.github/dependabot.yml` or Renovate configuration
  - No FIPS build tags (may not be required for this tool)

### Agent Rules
- **Score: 0.0/10**
- **Status**: Missing
- **No `CLAUDE.md`** or `AGENTS.md` in repository root
- **No `.claude/` directory**, no `.claude/rules/` for test creation rules
- **Impact**: Given the project's excellent testing patterns (fuzz tests, table-driven tests, envtest integration, SDK test harnesses), documenting these patterns in agent rules would significantly improve AI-generated test quality
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - Go testing conventions (table-driven tests, testify usage)
  - Fuzz test patterns for parsers and reconcilers
  - envtest setup for controller integration tests
  - SDK test harness patterns
  - Experiment YAML validation patterns

## Recommendations

### Priority 0 (Critical)
1. **Add coverage tracking with Codecov** — Add `--coverprofile=coverage.out` to CI test step, integrate `codecov/codecov-action@v5`, create `.codecov.yml` with project/patch thresholds
2. **Add container image build to PR CI** — Build both `Containerfile` and `dashboard/Containerfile` in CI to catch breakage before merge
3. **Configure Dependabot** — Add `.github/dependabot.yml` covering `gomod`, `npm`, and `github-actions` ecosystems

### Priority 1 (High Value)
4. **Add concurrency control and timeouts** — Set `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }` and `timeout-minutes: 15` on CI jobs
5. **Enable more golangci-lint linters** — Add `gosimple`, `gofmt`, `goimports`, `exhaustive`, `nilerr`, `gocritic`, `bodyclose`, `noctx` for better code quality
6. **Create CLAUDE.md with testing patterns** — Document the project's testing conventions, fuzz test patterns, envtest setup, and SDK test harness for AI-assisted development
7. **Add kustomize build validation to CI** — Run `kustomize build config/default/` in PR CI to catch manifest issues

### Priority 2 (Nice-to-Have)
8. **Add pre-commit hooks** — Configure `.pre-commit-config.yaml` with `gofmt`, `govet`, `golangci-lint` for local quality enforcement
9. **Consider UBI base images** — Evaluate switching from `distroless/static` to UBI-based images for FIPS compatibility
10. **Add multi-version K8s testing** — Add matrix strategy to upgrade-gate workflow testing multiple K8s versions
11. **Add testcontainers runtime validation** — Test container image startup and basic functionality in CI

## Comparison to Gold Standards

| Capability | operator-chaos | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit test ratio | 1.35x LOC (excellent) | High | Moderate | High |
| Fuzz testing | 12 fuzz tests | None | None | None |
| Integration tests | envtest + SDK | Multi-layer | Image testing | envtest |
| E2E automation | Dispatch-only | PR-triggered | PR-triggered | PR-triggered |
| Coverage tracking | None | Codecov | Present | Codecov with enforcement |
| PR image build | None | Present | Multi-layer | Present |
| golangci-lint | 5 linters | Comprehensive | N/A | Comprehensive |
| Dependabot | None | Configured | Configured | Configured |
| Agent rules | None | Comprehensive | Basic | Basic |
| FIPS checks | None | Present | Present | Present |

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yaml` — Main CI (tests, lint, build, validation)
- `.github/workflows/docs.yaml` — MkDocs deployment
- `.github/workflows/upgrade-gate.yaml` — Dispatch-only upgrade testing
- `Makefile` — Build, test, lint, container, docs targets

### Testing
- `*_test.go` — 128 test files across all packages
- `tests/integration/experiment_test.go` — envtest integration tests
- `tests/sdk/opendatahub/` — ODH operator SDK tests + fuzz
- `tests/sdk/certmanager/` — cert-manager SDK tests + fuzz
- `internal/controller/suite_test.go` — Controller envtest suite
- `internal/controller/chaos_fuzz_test.go` — Controller fuzz tests
- `testdata/` — Test fixtures (experiments, knowledge, go source)

### Container Images
- `Containerfile` — CLI multi-stage build (golang → distroless)
- `dashboard/Containerfile` — Dashboard multi-stage build (node → golang → distroless)
- `.dockerignore` — Build context exclusions

### Code Quality
- `.golangci.yml` — Linter configuration (5 linters)
- `go.mod` — Go module dependencies

### Kubernetes
- `config/crd/bases/chaos.operatorchaos.io_chaosexperiments.yaml` — CRD definition
- `config/default/kustomization.yaml` — Default kustomize overlay
- `config/controller/deployment.yaml` — Controller deployment with probes
- `config/dashboard/deployment.yaml` — Dashboard deployment with probes
- `config/rbac/` — RBAC manifests
- `config/grafana/` — Grafana dashboard

### Project-Specific
- `knowledge/` — Operator knowledge models (25+ YAML files)
- `experiments/` — Chaos experiment definitions
- `profiles/` — Operator-specific experiment profiles
- `templates/` — Experiment templates (13 fault types)
- `pkg/injection/` — Fault injection implementations (20+ types)
- `pkg/safety/` — Safety mechanisms (TTL, mutex, blast radius, rollback)
