---
repository: "red-hat-data-services/eval-hub-sobha"
overall_score: 7.0
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Excellent 116% test-to-code line ratio with 45 Go test files across all packages"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "BDD-style godog FVT tests with Kubernetes and MLflow integration suites"
  - dimension: "Build Integration"
    score: 7.0
    status: "Konflux PR pipeline with FIPS build; GH CI builds on push with dry-run validation"
  - dimension: "Image Testing"
    score: 6.0
    status: "Multi-stage UBI9 builds with multi-arch support; limited runtime validation"
  - dimension: "Coverage Tracking"
    score: 8.0
    status: "Codecov integration with fail_ci_if_error, multiple coverage profiles merged"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "Well-organized workflows with Tekton/Konflux; missing concurrency controls and caching"
  - dimension: "Static Analysis"
    score: 6.0
    status: "Pre-commit hooks with Ruff/mypy/commitizen; missing golangci-lint"
  - dimension: "Agent Rules"
    score: 6.0
    status: "Comprehensive CLAUDE.md with architecture docs; no test-specific agent rules"
critical_gaps:
  - title: "No golangci-lint configuration"
    impact: "Go code relies only on go vet; misses dozens of bug-finding linters (errcheck, staticcheck, gosimple, unused, etc.)"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No PR-time Docker build validation in GitHub CI"
    impact: "Container build issues only caught by Konflux pipeline or post-merge; no GH CI feedback on Dockerfile changes"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No multi-version Kubernetes testing"
    impact: "Compatibility issues with different K8s/OCP versions discovered only in production environments"
    severity: "MEDIUM"
    effort: "8-12 hours"
quick_wins:
  - title: "Add golangci-lint with recommended linters"
    effort: "2-4 hours"
    impact: "Catch bugs, enforce style, and detect unused code automatically on every PR"
  - title: "Add concurrency control to CI workflows"
    effort: "30 minutes"
    impact: "Prevent redundant CI runs on rapid pushes, save compute resources"
  - title: "Create .claude/rules/ with test creation rules"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality with framework-specific patterns (godog, Go testing)"
  - title: "Add Go module caching to CI"
    effort: "30 minutes"
    impact: "Faster CI runs by caching Go module downloads"
recommendations:
  priority_0:
    - "Add golangci-lint with errcheck, staticcheck, gosimple, unused, and gocritic linters"
    - "Add concurrency control (concurrency: group/cancel-in-progress) to CI workflows"
  priority_1:
    - "Add PR-time Docker build step (build-only, no push) in GitHub CI for Containerfile changes"
    - "Create .claude/rules/ with unit test and FVT test patterns for AI-assisted development"
    - "Add Go module caching via actions/setup-go cache option"
  priority_2:
    - "Add multi-version Kubernetes testing matrix for E2E scenarios"
    - "Add container HEALTHCHECK or startup validation test in CI"
    - "Add codecov.yml coverage thresholds (patch and project minimums)"
---

# Quality Analysis: eval-hub-sobha

## Executive Summary

- **Overall Score: 7.0/10**
- **Repository**: `red-hat-data-services/eval-hub-sobha` (downstream, AI Safety)
- **Type**: Go REST API service with Python server component
- **Framework**: Standard library `net/http` with godog BDD testing
- **Primary Language**: Go 1.25, Python 3.11+

### Key Strengths
- Excellent test-to-code ratio (116% — more test lines than source lines)
- Comprehensive BDD-style FVT tests covering evaluations, collections, providers, Kubernetes resources, and MLflow
- Strong Codecov integration with multiple coverage profiles and `fail_ci_if_error`
- Konflux/Tekton PR pipeline with FIPS-compliant builds (`GOEXPERIMENT=strictfipsruntime`)
- Well-crafted CLAUDE.md with detailed architecture documentation
- Pre-commit hooks with mypy, Ruff, commitizen, and Go tests

### Critical Gaps
- No golangci-lint — relies only on `go vet` for static analysis
- No PR-time Docker build in GitHub CI (only on push)
- No multi-version Kubernetes testing
- No test-specific agent rules in `.claude/rules/`

### Agent Rules Status: **Partial** — CLAUDE.md present but no `.claude/rules/` directory

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.0/10 | 15% | 1.20 | Excellent 116% test-to-code line ratio with 45 Go test files |
| Integration/E2E | 7.0/10 | 20% | 1.40 | BDD godog FVT tests with K8s and MLflow integration suites |
| Build Integration | 7.0/10 | 15% | 1.05 | Konflux PR pipeline with FIPS; GH CI builds on push with dry-run |
| Image Testing | 6.0/10 | 10% | 0.60 | Multi-stage UBI9, multi-arch; limited runtime validation |
| Coverage Tracking | 8.0/10 | 10% | 0.80 | Codecov with fail_ci_if_error, multiple coverage profiles |
| CI/CD Automation | 7.0/10 | 15% | 1.05 | Well-organized GH + Tekton; missing concurrency/caching |
| Static Analysis | 6.0/10 | 10% | 0.60 | Pre-commit hooks; no golangci-lint for Go |
| Agent Rules | 6.0/10 | 5% | 0.30 | Comprehensive CLAUDE.md; no test-specific rules |
| **Overall** | **7.0/10** | **100%** | **7.00** | |

## Critical Gaps

### 1. No golangci-lint Configuration
- **Impact**: Go code relies only on `go vet`, missing dozens of bug-finding linters (errcheck, staticcheck, gosimple, unused, gocritic, etc.)
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Current state**: Makefile `lint` target just runs `go vet ./...`
- **Recommendation**: Add `.golangci.yml` with recommended linters and update CI

### 2. No PR-time Docker Build in GitHub CI
- **Impact**: Containerfile/Dockerfile changes are only validated by Konflux pipeline; no GH CI feedback loop on build failures
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Current state**: `docker-build-push` job runs only on push (`if: github.event_name == 'push'`)
- **Note**: Tekton pipeline does cover PR builds for Konflux, partially mitigating this gap

### 3. No Multi-version Kubernetes Testing
- **Impact**: Compatibility issues with different K8s/OCP versions discovered only in production
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Current state**: Kubernetes feature tests exist but no matrix testing across versions

## Quick Wins

### 1. Add golangci-lint (2-4 hours)
Add `.golangci.yml` and update Makefile/CI:
```yaml
# .golangci.yml
run:
  timeout: 5m
linters:
  enable:
    - errcheck
    - staticcheck
    - gosimple
    - unused
    - gocritic
    - govet
    - ineffassign
    - typecheck
```

### 2. Add Concurrency Control (30 minutes)
```yaml
# Add to ci.yml at the top level
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 3. Create Test Agent Rules (2-3 hours)
Create `.claude/rules/` with patterns for Go unit tests and godog FVT tests to guide AI-assisted test creation.

### 4. Add Go Module Caching (30 minutes)
The `actions/setup-go` action already caches by default, but verify `cache: true` is explicit:
```yaml
- uses: actions/setup-go@v5
  with:
    go-version: '1.25'
    cache: true
```

## Detailed Findings

### Unit Tests
- **45 Go test files** covering auth, internal packages, cmd, and pkg
- **14,639 test lines vs 12,611 source lines** (116% ratio — excellent)
- **Test file ratio**: 45/91 = 49.5% of Go source files have corresponding tests
- **Framework**: Standard Go `testing` package
- **Key test areas**:
  - `auth/rules_test.go` — authorization rule testing
  - `internal/eval_hub/handlers/*_test.go` — HTTP handler tests (evaluations, collections, providers, health, OpenAPI)
  - `internal/eval_hub/runtimes/k8s/*_test.go` — Kubernetes runtime tests (job builders, config, helpers)
  - `internal/eval_hub/server/*_test.go` — Server, middleware, CORS, execution context tests
  - `internal/eval_hub/storage/sql/*_test.go` — SQL storage layer tests
  - `internal/eval_hub/validation/validator_test.go` — Input validation tests
  - `internal/eval_runtime_sidecar/**/*_test.go` — Sidecar config, handlers, proxy, auth tests
  - `pkg/api/evaluations_test.go` — API type tests
- **Python tests**: 1 test file (`python-server/tests/test_main.py`) with 3 unit tests for the CLI wrapper
- **Build includes `-race` flag**: Race detector enabled for all test runs

### Integration/E2E Tests
- **BDD-style FVT** using [godog](https://github.com/cucumber/godog) framework
- **7 feature files** with 2,052 lines of Gherkin scenarios:
  - `tests/features/evaluations.feature` — CRUD operations, pagination, filtering, status transitions
  - `tests/features/collections.feature` — Collection management and evaluation grouping
  - `tests/features/providers.feature` — Provider configuration and management
  - `tests/features/health.feature` — Health endpoint validation
  - `tests/features/metrics.feature` — Prometheus metrics endpoint
  - `tests/kubernetes/features/kubernetes_resources.feature` — K8s Job and ConfigMap validation
  - `tests/mlflow/features/experiments.feature` — MLflow experiment CRUD operations
- **FVT execution modes**:
  - `make test-fvt` — Run against existing server
  - `make test-fvt-server` — Starts server, runs FVT, stops server
  - `make test-fvt-server-coverage` — Same with coverage instrumentation
- **JUnit and Cucumber report generation**: FVT outputs JUnit XML and can generate HTML reports
- **Environment-aware scenarios**: Use `{{env:VAR|default}}` patterns for flexible test configuration
- **Cluster-tagged scenarios**: `@cluster` tag marks scenarios requiring actual K8s cluster
- **Missing**: No Kind/Minikube setup, no multi-version K8s matrix

### Build Integration
- **GitHub CI**: Builds Go binaries with `-race` flag on every PR and push
- **Tekton/Konflux PR pipeline** (`.tekton/odh-eval-hub-pull-request.yaml`):
  - Triggered on PR events and `/build-konflux` comments
  - Uses `Dockerfile.konflux` with FIPS runtime (`GOEXPERIMENT=strictfipsruntime`)
  - Hermetic build with gomod prefetch
  - Builds for `linux/x86_64`
- **Docker build on push**: Multi-arch (amd64 + arm64) via QEMU/Buildx
  - Pushes to `quay.io/evalhub/evalhub`
  - **Dry-run validation**: `docker run --rm <image> /app/eval-hub --local --help`
  - Image expiration annotations for non-tag builds (12 weeks)
- **Cross-compilation**: Makefile supports Linux, macOS, and Windows builds
- **Python wheel publishing**: Multi-platform wheels for PyPI distribution
- **Gap**: Docker build step skipped on PRs in GH CI (`if: github.event_name == 'push'`)

### Image Testing
- **Multi-stage builds**: Builder stage (UBI9 go-toolset) → Runtime stage (UBI9 ubi-minimal)
- **UBI9 base images**: FIPS-capable Red Hat Universal Base Images
- **Non-root execution**: User `evalhub` (UID 1000) with proper ownership
- **Multi-architecture**: linux/amd64 and linux/arm64 via Docker Buildx + QEMU
- **Docker dry-run**: CI validates the built image starts and responds to `--help`
- **Comprehensive .dockerignore**: Excludes tests, docs, IDE files, build artifacts
- **Missing**: No container HEALTHCHECK (commented out — wget not available in ubi-minimal), no Testcontainers

### Coverage Tracking
- **Codecov integration** via `codecov/codecov-action@v5`
- **Multiple coverage profiles uploaded**:
  - `bin/coverage.out` — Unit test coverage
  - `bin/coverage-fvt.out` — FVT integration test coverage
  - `bin/coverage-init.out` — Init binary coverage
- **Configuration** (`codecov.yml`):
  - Range: 50-75% (red → yellow → green)
  - Precision: 1 decimal place
  - `fail_ci_if_error: true` (with Dependabot exception)
- **Coverage flags**: `-covermode=atomic` and `-coverprofile` in all test modes
- **HTML reports**: Generated locally via `go tool cover -html`
- **Build-level coverage**: `build-coverage` target compiles binaries with `-cover -covermode=atomic -coverpkg=./...` for integration-level coverage
- **Gap**: No explicit patch or project threshold enforcement in codecov.yml

### CI/CD Automation
- **5 GitHub workflows**:
  1. `ci.yml` — Main CI: quality checks (fmt, lint, vet, test, coverage, docs), security scan, Docker build
  2. `commitlint.yml` — Commitizen conventional commit enforcement on PRs
  3. `publish-python-server.yml` — Multi-platform Go binary + Python wheel build/publish
  4. `sync-branch-incubation.yaml` — Auto-sync main → incubation
  5. `sync-branch-stable.yaml` — Auto-sync incubation → stable
- **Tekton pipeline**: Konflux build on PR events
- **PR template**: Structured with type checkboxes and testing section
- **Issue templates**: Bug report, feature request, question
- **CodeRabbit**: AI-assisted code review configured
- **Missing**:
  - No `concurrency:` control on any workflow (redundant runs on rapid pushes)
  - No explicit caching strategy (relies on setup-go defaults)
  - No test parallelization/sharding
  - No timeout-minutes on jobs

### Static Analysis

#### Linting
- **Go**: `go vet ./...` only — no golangci-lint configuration
- **Python**: Ruff (linting + formatting) via pre-commit
- **Python type checking**: mypy configured in pre-commit for `python-server/`

#### Pre-commit Hooks
Comprehensive `.pre-commit-config.yaml`:
- Ruff linting and formatting (Python)
- Standard hooks: trailing-whitespace, end-of-file-fixer, check-yaml, check-json, check-toml, check-merge-conflict, check-added-large-files (1MB limit)
- Commitizen commit message linting (commit-msg stage)
- No-commit-to-main branch protection (pre-push stage)
- Debug statements detection
- mypy type checking (Python)
- pytest unit tests (Python, pre-commit)
- Go test + FVT (pre-commit)

#### FIPS Compatibility
- **Konflux build**: `GOEXPERIMENT=strictfipsruntime` in `Dockerfile.konflux`
- **Base images**: UBI9 (FIPS-capable) in both Containerfile and Dockerfile.konflux
- **No non-FIPS crypto imports**: No `crypto/md5`, `crypto/des`, `crypto/rc4`, or `math/rand` detected
- **Community build**: No FIPS flags in `Containerfile` (expected — FIPS only for downstream/Konflux)

#### Dependency Alerts
- **Renovate**: Configured (`.github/renovate.json`) extending `red-hat-data-services/konflux-central` defaults
- **No Dependabot**: Renovate used instead (acceptable alternative)

### Agent Rules
- **CLAUDE.md**: Present and comprehensive (~250 lines)
  - Build/test/quality commands
  - Full architecture overview with package descriptions
  - ExecutionContext pattern documentation
  - Configuration system documentation
  - Structured logging details
  - Routing pattern with examples
  - Testing strategy (unit + FVT)
  - Server lifecycle documentation
- **No `.claude/` directory**: No `.claude/rules/` for test-specific agent rules
- **No AGENTS.md**: Not present
- **Gap**: No test creation rules specifying:
  - How to write Go unit tests for handlers (mock patterns, test helpers)
  - How to write godog FVT scenarios (step definition patterns, feature file conventions)
  - How to write Kubernetes resource validation tests
  - Coverage expectations for new code

## Recommendations

### Priority 0 (Critical)
1. **Add golangci-lint**: Configure `.golangci.yml` with errcheck, staticcheck, gosimple, unused, gocritic. Update Makefile `lint` target and CI workflow. This is the single highest-impact quality improvement.
2. **Add concurrency control**: Add `concurrency: { group, cancel-in-progress }` to all workflows to prevent redundant CI runs.

### Priority 1 (High Value)
3. **Add PR-time Docker build**: Add a build-only (no push) Docker step to `ci.yml` for PRs that modify Containerfile or Dockerfile.
4. **Create `.claude/rules/` with test patterns**: Document Go unit test conventions, godog FVT patterns, and coverage expectations for AI-assisted development.
5. **Add explicit caching**: Verify `actions/setup-go` cache is enabled; add Node module caching for docs build step.
6. **Add codecov thresholds**: Configure patch and project coverage minimums in `codecov.yml`.

### Priority 2 (Nice-to-Have)
7. **Multi-version K8s testing**: Add matrix strategy testing against multiple K8s versions for the Kubernetes resource validation features.
8. **Container startup validation**: Add a lightweight container startup test in CI beyond `--help` (e.g., health endpoint check).
9. **Add job timeout-minutes**: Set `timeout-minutes` on CI jobs to prevent runaway builds.
10. **OpenAPI contract testing**: Add automated API contract validation comparing implementation against `docs/openapi.yaml` specification.

## Comparison to Gold Standards

| Practice | eval-hub-sobha | odh-dashboard | notebooks | kserve |
|----------|---------------|---------------|-----------|--------|
| Unit test ratio | 116% lines | ~40% | ~30% | ~50% |
| BDD/FVT tests | godog (7 features) | Cypress E2E | N/A | N/A |
| Coverage enforcement | Codecov (50-75 range) | Codecov + thresholds | N/A | Codecov + thresholds |
| golangci-lint | Missing | N/A (TypeScript) | N/A | Configured |
| Pre-commit hooks | Comprehensive | Present | Present | Present |
| Multi-arch builds | amd64 + arm64 | Single arch | Multi-arch | Multi-arch |
| FIPS compliance | Konflux strictfipsruntime | N/A | UBI + FIPS | Go FIPS |
| Konflux pipeline | Configured | Configured | Configured | Configured |
| Agent rules (CLAUDE.md) | Comprehensive | Comprehensive | Basic | None |
| Test-specific agent rules | Missing | Present | Missing | Missing |
| Dependency management | Renovate | Dependabot | Dependabot | Dependabot |
| Commit conventions | Commitizen | Conventional | N/A | N/A |

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yml` — Main CI pipeline
- `.github/workflows/commitlint.yml` — Commit message linting
- `.github/workflows/publish-python-server.yml` — Python wheel publishing
- `.github/workflows/sync-branch-incubation.yaml` — Branch sync
- `.github/workflows/sync-branch-stable.yaml` — Branch sync
- `.tekton/odh-eval-hub-pull-request.yaml` — Konflux PR pipeline
- `Makefile` — Build, test, and quality targets

### Testing
- `tests/features/*.feature` — Main FVT scenarios (evaluations, collections, providers, health, metrics)
- `tests/kubernetes/features/*.feature` — Kubernetes resource validation
- `tests/mlflow/features/*.feature` — MLflow integration tests
- `internal/**/*_test.go` — Unit tests (handlers, runtimes, server, storage, validation)
- `auth/*_test.go` — Auth unit tests
- `python-server/tests/test_main.py` — Python CLI wrapper tests

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks (Ruff, mypy, commitizen, Go tests)
- `.coderabbit.yaml` — CodeRabbit AI review config
- `.cz.toml` — Commitizen configuration

### Container Images
- `Containerfile` — Community/upstream container build
- `Dockerfile.konflux` — FIPS-compliant downstream Konflux build
- `.dockerignore` — Docker build exclusions

### Coverage
- `codecov.yml` — Codecov configuration (range 50-75)

### Agent Rules
- `CLAUDE.md` — Claude Code guidance (architecture, commands, patterns)
- `ARCHITECTURE.md` — Architecture documentation

### Dependency Management
- `.github/renovate.json` — Renovate configuration
- `go.mod` / `go.sum` — Go module dependencies
- `python-server/pyproject.toml` — Python dependencies
