---
repository: "eval-hub/eval-hub"
overall_score: 8.3
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "Outstanding test-to-code ratio (0.95:1) with 469 t.Parallel() calls and strong isolation patterns"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "15 BDD feature files via godog with FVT against live server; Kubernetes, MLflow, and MCP test suites"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-triggered Docker build with dry-run validation; multi-arch support; Python wheel build checks"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage UBI9 Containerfile with multi-arch; dry-run validation on PR; missing healthcheck"
  - dimension: "Coverage Tracking"
    score: 8.0
    status: "Codecov integration with fail_ci_if_error=true; multiple coverage profiles; moderate thresholds (50-75)"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "15 workflows with path-based triggers, runner hardening, OpenSSF Scorecard, and concurrency control"
  - dimension: "Static Analysis"
    score: 8.0
    status: "golangci-lint, go vet, gofmt enforcement, pre-commit hooks, Dependabot (3 ecosystems), gitleaks, shellcheck"
  - dimension: "Agent Rules"
    score: 9.0
    status: "CLAUDE.md, AGENTS.md, 2 scoped .claude/rules, custom fix-fvt-test skill with path scoping"
critical_gaps:
  - title: "No custom golangci-lint configuration"
    impact: "Using default linters only — missing stricter checks like revive, errcheck, gosec, gocritic that catch bugs early"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "Coverage thresholds are moderate (50-75 range)"
    impact: "PRs with low coverage can merge; no per-PR diff coverage enforcement"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No container HEALTHCHECK instruction"
    impact: "Container orchestrators cannot verify runtime health via Docker-native checks (relying solely on K8s probes)"
    severity: "LOW"
    effort: "1 hour"
  - title: "No timeout-minutes on CI workflows"
    impact: "Hung jobs can consume runner minutes indefinitely"
    severity: "MEDIUM"
    effort: "1 hour"
quick_wins:
  - title: "Add timeout-minutes to all CI workflow jobs"
    effort: "1 hour"
    impact: "Prevents hung jobs from consuming runner quota; typical Go CI should complete in 15-20 minutes"
  - title: "Raise Codecov coverage thresholds"
    effort: "30 minutes"
    impact: "Enforce higher baseline (e.g., 65..85 range) to prevent coverage regression"
  - title: "Add a .golangci.yml with explicit linter configuration"
    effort: "2-3 hours"
    impact: "Enable gocritic, revive, errcheck, unparam, and other linters for deeper static analysis"
  - title: "Add concurrency groups to main CI workflows"
    effort: "30 minutes"
    impact: "Cancel superseded PR runs to free up runner capacity"
recommendations:
  priority_0:
    - "Add timeout-minutes to all CI workflow jobs to prevent resource waste on hung builds"
    - "Create a .golangci.yml config enabling a broader linter set (gocritic, revive, errcheck, unparam, gosimple)"
  priority_1:
    - "Raise Codecov thresholds from 50-75 to 65-85 range to enforce higher coverage baseline"
    - "Add concurrency groups to ci.yml and ci-mcp.yml to cancel outdated PR runs"
    - "Add HEALTHCHECK to Containerfile (or document why it's intentionally omitted for K8s-only probes)"
  priority_2:
    - "Add multi-version testing for Go versions to catch compatibility issues early"
    - "Consider adding contract tests for the Python SDK against the Go API"
    - "Add performance regression testing for API endpoints"
---

# Quality Analysis: eval-hub/eval-hub

## Executive Summary

- **Overall Score: 8.3/10** — This is an exceptionally well-maintained repository
- **Repository Type**: Go REST API service (evaluation hub) with MCP server and Python distribution wrappers
- **Primary Language**: Go (with Python packaging for distribution)
- **Jira**: RHOAIENG / AI Safety (upstream tier)
- **Key Strengths**: Outstanding test-to-code ratio, comprehensive BDD/FVT testing, strong CI/CD with security hardening, excellent agent rules
- **Critical Gaps**: No custom golangci-lint config, moderate coverage thresholds, missing CI timeout settings
- **Agent Rules Status**: Excellent — CLAUDE.md, AGENTS.md, 2 scoped rules, and a custom FVT debugging skill

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 9.0/10 | 15% | 1.35 | Outstanding test ratio (0.95:1), 469 t.Parallel() calls |
| Integration/E2E | 8.0/10 | 20% | 1.60 | 15 BDD feature files via godog; K8s, MLflow, MCP suites |
| Build Integration | 8.0/10 | 15% | 1.20 | PR Docker build + dry-run; multi-arch; wheel validation |
| Image Testing | 7.0/10 | 10% | 0.70 | Multi-stage UBI9, multi-arch; missing HEALTHCHECK |
| Coverage Tracking | 8.0/10 | 10% | 0.80 | Codecov with enforcement; moderate thresholds |
| CI/CD Automation | 9.0/10 | 15% | 1.35 | 15 workflows, hardened runners, OpenSSF Scorecard |
| Static Analysis | 8.0/10 | 10% | 0.80 | golangci-lint, gofmt, pre-commit, Dependabot, gitleaks |
| Agent Rules | 9.0/10 | 5% | 0.45 | CLAUDE.md + AGENTS.md + scoped rules + custom skill |
| **Overall** | **8.3/10** | **100%** | **8.25** | |

## Critical Gaps

### 1. No Custom golangci-lint Configuration
- **Impact**: Using only default Go linters — missing stricter checks like revive, errcheck, gocritic, unparam that catch subtle bugs and anti-patterns
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Current State**: golangci-lint is used via pre-commit hooks (v2.12.2) but with no `.golangci.yml` to configure enabled linters or severity
- **Gold Standard**: kserve uses a comprehensive `.golangci.yaml` with 15+ linters enabled

### 2. Moderate Coverage Thresholds
- **Impact**: Codecov range is `50..75` — PRs with relatively low coverage pass as "yellow" rather than failing
- **Severity**: MEDIUM
- **Effort**: 1-2 hours to adjust codecov.yml and add per-patch thresholds
- **Gold Standard**: kserve enforces 80%+ with patch coverage requirements

### 3. Missing CI Timeout Settings
- **Impact**: No `timeout-minutes` on any workflow job — hung builds can consume runner minutes indefinitely
- **Severity**: MEDIUM
- **Effort**: 1 hour
- **Recommendation**: Add `timeout-minutes: 20` to quality-checks, `timeout-minutes: 10` to lighter jobs

### 4. No Container HEALTHCHECK
- **Impact**: Container-level health checking not available; relies solely on Kubernetes probes
- **Severity**: LOW
- **Effort**: 1 hour
- **Note**: The Containerfile comments this out because `wget` isn't available in ubi-minimal. Could install `curl` or use a static health binary

## Quick Wins

### 1. Add timeout-minutes to CI workflows (~1 hour)
```yaml
jobs:
  quality-checks:
    runs-on: ubuntu-latest
    timeout-minutes: 20
```

### 2. Raise Codecov thresholds (~30 minutes)
```yaml
# codecov.yml
coverage:
  range: 65..85
  status:
    project:
      default:
        target: 70%
    patch:
      default:
        target: 80%
```

### 3. Add concurrency groups to main CI (~30 minutes)
```yaml
# In ci.yml
concurrency:
  group: ci-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

### 4. Create .golangci.yml (~2-3 hours)
```yaml
linters:
  enable:
    - gocritic
    - revive
    - errcheck
    - unparam
    - gosimple
    - prealloc
    - misspell
    - bodyclose
    - noctx
```

## Detailed Findings

### Unit Tests

**Score: 9.0/10**

This repository demonstrates outstanding unit test practices:

- **134 test files** against **141 source files** — a remarkable 0.95:1 test-to-code ratio
- Uses Go standard `testing` package consistently
- **469 `t.Parallel()` invocations** — excellent test parallelization adoption
- **221 test isolation calls** (`t.Setenv`, `t.TempDir`, `t.Cleanup`) — strong test hygiene
- Race detection enabled (`-race` flag) in both test and build commands
- Tests organized alongside code in `*_test.go` files following Go conventions
- Comprehensive coverage across all packages: `internal/`, `cmd/`, `pkg/`
- Separate coverage profiles for unit tests, FVT, and init container

**Key test packages**:
- `internal/eval_hub/handlers/` — 18 test files covering all HTTP handlers
- `internal/evalhub_mcp/server/` — 12 test files for MCP server capabilities
- `pkg/mlflowclient/` — 6 test files for MLflow client library
- `pkg/ociclient/` — 4 test files for OCI registry client
- `internal/eval_runtime_sidecar/` — 6 test files for sidecar proxy and handlers

### Integration/E2E Tests

**Score: 8.0/10**

Comprehensive BDD-style functional verification testing:

- **15 Gherkin feature files** using godog (Cucumber for Go)
- FVT tests run against an actual HTTP server (`make test-fvt-server` starts the service)
- Well-organized test suites by domain:
  - `tests/features/` — Core API FVTs (evaluations, providers, collections, health, metrics, GPU resources)
  - `tests/mcp/features/` — MCP server FVTs (tools, resources, prompts, server)
  - `tests/mlflow/features/` — MLflow integration tests
  - `tests/kubernetes/features/` — Kubernetes resource tests
- Test tag system for environment-specific execution:
  - `@cluster` — Kubernetes-only tests
  - `@local_runtime` — Full local evaluation runtime tests
  - `@mlflow` — MLflow integration tests
  - `@negative` — Error-path tests
  - `@gha-wheel-sanity` — CI wheel validation subset
- PostgreSQL test infrastructure (`tests/postgres/`)
- Jaeger/OTEL test infrastructure (`tests/jaeger/`, `tests/otel/`)

**Areas for improvement**:
- No multi-version Kubernetes testing via matrix strategy
- No explicit contract tests between Python SDK and Go API

### Build Integration

**Score: 8.0/10**

Strong PR-time build validation:

- **`docker-build-check` job** on PRs: builds the Containerfile with buildx and runs a dry-run validation
  ```
  docker run --rm evalhub:pr-check /app/eval-hub --local --help
  ```
- **Multi-architecture builds** on push (linux/amd64, linux/arm64 via QEMU)
- **Python wheel build validation** on PRs for both `python-server` and `python-mcp`
  - `ci-python-server.yml`: builds wheel, installs, runs sanity test
  - `ci-python-mcp.yml`: builds MCP wheel, installs, verifies version
- **Config validation workflow** (`validate-configs.yml`): validates YAML provider/collection configs via Go CLI
- **API documentation validation** in CI: `make documentation` with diff check
- Path-based triggering ensures only relevant builds run on changes

**Missing**:
- No Konflux build simulation (but PR Docker builds partially cover this)
- No operator manifest testing (not applicable — this is an API service, not an operator)

### Image Testing

**Score: 7.0/10**

Good container practices with room for improvement:

- **Multi-stage build**: UBI9 go-toolset builder → UBI9 ubi-minimal runtime
- **UBI9 base images** — FIPS-capable, Red Hat supported
- **Multi-architecture support**: `linux/amd64`, `linux/arm64` via QEMU + buildx
- **Non-root user**: Creates `evalhub` user (UID 1000), runs as numeric UID
- **4 binaries built**: eval-hub, eval-runtime-sidecar, eval-runtime-init, evalhub-mcp
- **`.dockerignore`** present for optimized build context
- **OCI labels** for metadata (title, description, version, created, authors, vendor)
- **Dry-run on PR**: `docker run --rm evalhub:pr-check /app/eval-hub --local --help`
- **Dry-run on push**: After push to registry, pulls and runs against published digest

**Missing**:
- **HEALTHCHECK** commented out — `wget` not available in ubi-minimal
- No Testcontainers or runtime functional testing of the container
- No image size optimization tracking

### Coverage Tracking

**Score: 8.0/10**

Solid coverage infrastructure with enforcement:

- **codecov.yml** configured with `range: 50..75` (yellow at 50%, green at 75%)
- **Codecov action** in CI with `fail_ci_if_error: true` — PRs fail if coverage upload fails
- **Three coverage profiles** collected:
  - `coverage.out` — Unit tests (`./internal/...`, `./cmd/...`, `./pkg/...`)
  - `coverage-fvt.out` — Functional verification tests
  - `coverage-init.out` — Init container tests
- `-covermode=atomic` with `-race` for accurate concurrent coverage
- HTML coverage reports generated locally (`make test-coverage`)
- Coverage-instrumented binaries available (`make build-coverage`)

**Areas for improvement**:
- Coverage thresholds are moderate (50-75); projects like kserve use 80%+
- No per-patch coverage requirement configured
- No coverage trend tracking or PR comments showing delta

### CI/CD Automation

**Score: 9.0/10**

Exceptional CI/CD setup with strong security posture:

**Workflow Inventory (15 workflows)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | PR + push | Main CI: lint, test, coverage, Docker build |
| `ci-mcp.yml` | PR + push (path-scoped) | MCP component CI |
| `ci-python-mcp.yml` | PR (path-scoped) | Python MCP wheel build/test |
| `ci-python-server.yml` | PR (path-scoped) | Python server wheel build/test |
| `validate-configs.yml` | PR + push | YAML config validation |
| `commitlint.yml` | PR | Conventional commits enforcement |
| `dependency-review.yml` | PR | Dependency vulnerability review |
| `required-reviewer-approvals.yml` | PR events | Reviewer approval verification |
| `codeql.yml` | PR + push + schedule | CodeQL analysis |
| `scorecard.yml` | push + weekly | OpenSSF Scorecard |
| `publish-python-mcp.yml` | Release | Python MCP wheel publishing |
| `publish-python-server.yml` | Release | Python server wheel publishing |
| `release-mcp.yml` | Tag push | MCP binary release with checksums |
| `check-trustyai-service-operator-configmap-sync.yml` | Various | ConfigMap sync validation |

**Security hardening**:
- `step-security/harden-runner` with egress auditing on all workflows
- `persist-credentials: false` on all checkout actions
- Pinned action versions with SHA hashes (not tags)
- Minimal `permissions` declarations
- OpenSSF Scorecard integration

**Build optimization**:
- Go module caching via `setup-go` with `cache: true`
- uv caching for Python workflows
- Path-based triggers for component-specific workflows

**Missing**:
- No `timeout-minutes` on any workflow jobs
- No concurrency groups on main CI workflows (only on required-reviewer-approvals)

### Static Analysis

**Score: 8.0/10**

#### Linting
- **golangci-lint** via pre-commit hooks (v2.12.2) — latest stable
- **go vet** in CI (both `make lint` and `make vet`)
- **gofmt** enforcement with `git diff --exit-code` check in CI
- No `.golangci.yml` config file — using default linters only
- Could enable additional linters: gocritic, revive, errcheck, unparam, gosimple, bodyclose

#### Pre-commit Hooks
Comprehensive `.pre-commit-config.yaml`:
- `pre-commit-hooks`: trailing-whitespace, end-of-file-fixer, check-yaml, check-json, check-toml, check-merge-conflict, check-added-large-files, debug-statements, no-commit-to-branch
- `commitizen`: Conventional commit enforcement on commit-msg
- `local: go-test`: Runs `make test test-fvt` on Go files
- `gitleaks`: Secret detection
- `golangci-lint`: Go linting
- `shellcheck`: Shell script linting

#### FIPS Compatibility
- **Base images**: UBI9 (FIPS-capable) — good
- `CGO_ENABLED=0` — static binary, no boringcrypto
- No FIPS build tags (`-tags=fips`, `GOEXPERIMENT=boringcrypto`)
- No non-FIPS crypto imports detected (`crypto/md5`, `crypto/des`, `crypto/rc4` not found)

#### Dependency Alerts
- **Dependabot** configured for 3 ecosystems: github-actions, gomod, npm (daily schedule)
- **Dependency review action** on PRs — surfaces vulnerable package changes
- No auto-merge policies for patch/minor updates

### Agent Rules

**Score: 9.0/10**

Exceptional agent rule configuration:

**Root-level documentation**:
- **`CLAUDE.md`** — CVE fixing instructions, Go version management, npm devDependency handling
- **`AGENTS.md`** — Comprehensive 11KB guide covering:
  - All build/test/run commands
  - Architecture overview with component descriptions
  - Project structure with package-level descriptions
  - Server lifecycle documentation
  - MCP server configuration and transport details
  - Configuration discovery and secrets loading
  - Request identity flow (kube-rbac-proxy)
  - Git commit conventions with AI attribution guidance

**Scoped rules** (`.claude/rules/`):
- **`evalhub-service.md`** — Path-scoped to `cmd/eval_hub/**`, `internal/eval_hub/**`, `config/`
  - Build & test commands for the service
  - ExecutionContext pattern documentation with code examples
  - Two-tier configuration system (Viper + env + secrets)
  - Structured logging patterns
  - Routing patterns with method switching
  - Database setup (SQLite + PostgreSQL)
  - Testing strategy: unit tests + FVT with tag system
- **`evalhub-mcp-service.md`** — Path-scoped to `cmd/evalhub_mcp/**`, `internal/evalhub_mcp/**`
  - MCP-specific build & test commands
  - CLI flags and configuration precedence
  - Testing with `mcp.NewInMemoryTransports()`

**Custom skills** (`.claude/skills/`):
- **`fix-fvt-test/SKILL.md`** — Scripted workflow for diagnosing FVT test failures
  - Step-by-step process: read JUnit, analyze logs, check pod logs, root cause, propose PR
  - References to external resources (SDK, OpenAPI spec)
  - Path-scoped to `tests/**`

**Assessment**:
- Rules are comprehensive, up-to-date, and actionable
- Path scoping ensures relevant rules load for the right context
- Framework-specific examples (godog, ExecutionContext, MCP transports)
- Testing guidance covers both unit and FVT patterns
- Only gap: no dedicated integration test rule for MLflow or Kubernetes test suites

## Recommendations

### Priority 0 (Critical)

1. **Add `timeout-minutes` to all CI workflow jobs** — Hung builds can waste runner minutes indefinitely. Add `timeout-minutes: 20` to quality-checks jobs and `timeout-minutes: 10` to lighter validation jobs.

2. **Create a `.golangci.yml` with explicit linter configuration** — Enable gocritic, revive, errcheck, unparam, gosimple, bodyclose, noctx, prealloc, misspell to catch a broader class of bugs and anti-patterns. The pre-commit hook already runs golangci-lint; a config file simply expands what it checks.

### Priority 1 (High Value)

3. **Raise Codecov coverage thresholds** — Move from `50..75` to `65..85` range and add per-patch coverage requirements (e.g., `target: 80%` for new/changed lines).

4. **Add concurrency groups to ci.yml and ci-mcp.yml** — Cancel outdated PR runs to free up runner capacity:
   ```yaml
   concurrency:
     group: ci-${{ github.event.pull_request.number || github.ref }}
     cancel-in-progress: true
   ```

5. **Add HEALTHCHECK to Containerfile** — Either install `curl` in the runtime stage or build a minimal health binary in the builder stage. This provides Docker-native health checking alongside K8s probes.

### Priority 2 (Nice-to-Have)

6. **Add multi-version Go testing** — Use matrix strategy to test against current and previous Go versions to catch compatibility issues early.

7. **Add contract tests between Python SDK and Go API** — Ensure the Python client wrappers stay in sync with API changes. Could use OpenAPI spec as the contract.

8. **Add performance regression testing** — Benchmark key API endpoints and track performance over time using Go benchmarks (`go test -bench`).

## Comparison to Gold Standards

| Practice | eval-hub | odh-dashboard | kserve | notebooks |
|----------|----------|---------------|--------|-----------|
| Test-to-code ratio | 0.95:1 ★ | ~0.8:1 | ~0.7:1 | ~0.5:1 |
| BDD/FVT tests | 15 features ★ | Contract tests | E2E suite | N/A |
| PR Docker build + dry-run | Yes ★ | No | No | Yes |
| Multi-arch images | Yes ★ | No | No | Yes ★ |
| Coverage enforcement | Moderate | Strong | Strong ★ | Moderate |
| Coverage thresholds | 50-75 | 80+ ★ | 80+ ★ | N/A |
| Pre-commit hooks | Comprehensive ★ | Basic | Basic | Basic |
| Dependabot ecosystems | 3 ★ | 1-2 | 1-2 | 1-2 |
| Runner hardening | Yes ★ | No | No | No |
| OpenSSF Scorecard | Yes ★ | No | No | No |
| Agent rules | Excellent ★ | Good | Minimal | None |
| Custom skills | Yes ★ | No | No | No |
| UBI base images | Yes | Yes | Yes | Yes |
| Conventional commits | Enforced ★ | No | No | No |

**Legend**: ★ = Best-in-class for this practice

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yml` — Main CI pipeline
- `.github/workflows/ci-mcp.yml` — MCP component CI
- `.github/workflows/ci-python-mcp.yml` — Python MCP wheel CI
- `.github/workflows/ci-python-server.yml` — Python server wheel CI
- `.github/workflows/validate-configs.yml` — Config validation
- `.github/workflows/commitlint.yml` — Commit message linting
- `.github/workflows/dependency-review.yml` — Dependency vulnerability review
- `.github/workflows/required-reviewer-approvals.yml` — PR approval enforcement
- `.github/workflows/scorecard.yml` — OpenSSF Scorecard
- `.github/workflows/release-mcp.yml` — MCP binary release
- `.github/workflows/publish-python-mcp.yml` — Python MCP wheel publish
- `.github/workflows/publish-python-server.yml` — Python server wheel publish

### Testing
- `tests/features/*.feature` — Core API FVT feature files
- `tests/features/*_test.go` — FVT step definitions and helpers
- `tests/mcp/features/*.feature` — MCP FVT feature files
- `tests/mlflow/features/*.feature` — MLflow integration tests
- `tests/kubernetes/features/*.feature` — Kubernetes resource tests
- `internal/**/*_test.go` — Unit tests (alongside source)
- `pkg/**/*_test.go` — Package unit tests
- `cmd/**/*_test.go` — Command entry point tests

### Container
- `Containerfile` — Multi-stage build (UBI9)
- `.dockerignore` — Build context exclusions

### Coverage
- `codecov.yml` — Codecov configuration

### Static Analysis
- `.pre-commit-config.yaml` — Pre-commit hook configuration
- `.github/dependabot.yml` — Dependency update automation
- `.markdownlint.json` — Markdown linting rules
- `.cz.toml` — Commitizen configuration

### Agent Rules
- `CLAUDE.md` — CVE fixing instructions
- `AGENTS.md` — Comprehensive build/test/architecture guide
- `.claude/rules/evalhub-service.md` — API service rules (path-scoped)
- `.claude/rules/evalhub-mcp-service.md` — MCP service rules (path-scoped)
- `.claude/skills/fix-fvt-test/SKILL.md` — FVT test failure debugging skill

### Build
- `Makefile` — 38KB comprehensive build system
- `go.mod` — Go module definition
- `package.json` — npm (for API documentation tooling)
- `python-server/pyproject.toml` — Python server wheel config
- `python-mcp/pyproject.toml` — Python MCP wheel config
