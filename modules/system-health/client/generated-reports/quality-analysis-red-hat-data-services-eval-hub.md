---
repository: "red-hat-data-services/eval-hub"
overall_score: 8.3
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "Exceptional 0.95:1 test-to-code ratio with race detection and parallel tests"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Comprehensive BDD/godog suite with 299 scenarios across 15 feature files"
  - dimension: "Build Integration"
    score: 9.0
    status: "PR-time Docker build with dry-run, Konflux multi-arch pipeline, config validation"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage UBI9 builds with multi-arch and startup validation, no HEALTHCHECK"
  - dimension: "Coverage Tracking"
    score: 8.0
    status: "Codecov integration with multiple profiles and CI enforcement"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "17 workflows with path filtering, caching, security hardening, OpenSSF Scorecard"
  - dimension: "Static Analysis"
    score: 7.0
    status: "Pre-commit hooks, Renovate, FIPS build config, but only go vet (no golangci-lint)"
  - dimension: "Agent Rules"
    score: 9.0
    status: "Comprehensive CLAUDE.md, AGENTS.md, path-scoped rules, and custom FVT debugging skill"
critical_gaps:
  - title: "No golangci-lint with extended linters"
    impact: "Missing detection of subtle bugs, style issues, and code smells that go vet alone cannot catch"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No container HEALTHCHECK instruction"
    impact: "Docker-native health monitoring unavailable; relies solely on K8s probes"
    severity: "LOW"
    effort: "1 hour"
  - title: "Coverage thresholds not enforced in CI"
    impact: "Coverage could regress without blocking PRs; codecov range is 50-75 (informational only)"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add golangci-lint configuration with extended linters"
    effort: "2-4 hours"
    impact: "Catch bugs like unchecked errors, inefficient string concatenation, shadow variables, and more"
  - title: "Add codecov coverage threshold enforcement"
    effort: "1-2 hours"
    impact: "Prevent coverage regressions by requiring minimum coverage on PRs"
  - title: "Add multi-version OCP/K8s testing matrix"
    effort: "4-6 hours"
    impact: "Validate compatibility across Kubernetes versions used by customers"
recommendations:
  priority_0:
    - "Add golangci-lint with a curated linter set (errcheck, govet, staticcheck, unused, gosimple, ineffassign)"
    - "Configure codecov coverage thresholds to prevent regressions (e.g., patch coverage >= 70%)"
  priority_1:
    - "Add multi-version Kubernetes testing in CI matrix for cluster-tagged FVT tests"
    - "Add Testcontainers-based runtime validation for container images"
  priority_2:
    - "Add HEALTHCHECK instruction to Containerfile for Docker-native health monitoring"
    - "Consider adding performance/load testing for API endpoints"
---

# Quality Analysis: eval-hub (red-hat-data-services/eval-hub)

## Executive Summary

- **Overall Score: 8.3/10** — This is a **high-quality repository** that demonstrates strong engineering practices across nearly all quality dimensions.
- **Key Strengths**: Exceptional test-to-code ratio (0.95:1), comprehensive BDD testing with 299 scenarios, PR-time Docker build with startup validation, Konflux multi-arch pipeline, FIPS-compliant build configuration, and outstanding agent rules with custom skills.
- **Critical Gaps**: Uses basic `go vet` instead of `golangci-lint` with extended linters; codecov thresholds are informational rather than enforced; no multi-version K8s testing.
- **Agent Rules Status**: Present and comprehensive — CLAUDE.md, AGENTS.md, path-scoped `.claude/rules/`, and a custom FVT debugging skill.
- **Jira**: RHOAIENG / AI Safety (downstream tier)

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 9/10 | 15% | 1.35 | Exceptional 0.95:1 test-to-code ratio with race detection |
| Integration/E2E | 8/10 | 20% | 1.60 | 299 BDD scenarios across evaluations, MCP, K8s, MLflow |
| Build Integration | 9/10 | 15% | 1.35 | PR Docker build + dry-run, Konflux multi-arch, config validation |
| Image Testing | 7/10 | 10% | 0.70 | Multi-stage UBI9, multi-arch, startup validation |
| Coverage Tracking | 8/10 | 10% | 0.80 | Codecov with unit + FVT + init profiles, CI enforcement |
| CI/CD Automation | 9/10 | 15% | 1.35 | 17 workflows, path filtering, security hardening |
| Static Analysis | 7/10 | 10% | 0.70 | Pre-commit, Renovate, FIPS config, but only go vet |
| Agent Rules | 9/10 | 5% | 0.45 | CLAUDE.md + AGENTS.md + path-scoped rules + custom skill |
| **Overall** | **8.3/10** | **100%** | **8.30** | |

## Critical Gaps

### 1. No golangci-lint with Extended Linters
- **Impact**: Missing detection of unchecked errors, inefficient patterns, shadow variables, and subtle bugs that `go vet` alone cannot catch
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: The `lint` Makefile target runs `go vet`, which catches a limited set of issues. Adding `golangci-lint` with linters like `errcheck`, `staticcheck`, `gosimple`, `unused`, `ineffassign`, `gocritic`, and `revive` would significantly improve static analysis coverage.

### 2. Coverage Thresholds Not Enforced
- **Impact**: Coverage can regress without blocking PRs; the `codecov.yml` range (50-75) is for color coding, not enforcement
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: While Codecov is properly integrated and the action uses `fail_ci_if_error: true` (for upload failures), there are no `target` or `threshold` settings that would block PRs with insufficient coverage.

### 3. No Multi-Version Kubernetes Testing
- **Impact**: Kubernetes API compatibility issues may not surface until deployment on specific OCP versions
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: The `@cluster` tagged tests exist but there's no CI matrix testing against multiple K8s/OCP versions. Customers run different OCP versions, and K8s API deprecations could cause silent failures.

## Quick Wins

### 1. Add golangci-lint Configuration (2-4 hours)
- **Impact**: Catch entire categories of bugs automatically
- **Implementation**:

```yaml
# .golangci.yaml
run:
  timeout: 5m

linters:
  enable:
    - errcheck
    - govet
    - staticcheck
    - unused
    - gosimple
    - ineffassign
    - gocritic
    - revive
    - misspell
    - nolintlint

linters-settings:
  errcheck:
    check-type-assertions: true
  gocritic:
    enabled-tags:
      - diagnostic
      - style
      - performance
```

### 2. Add Codecov Coverage Thresholds (1-2 hours)
- **Impact**: Prevent coverage regressions on every PR
- **Implementation**:

```yaml
# codecov.yml
coverage:
  range: 50..75
  round: down
  precision: 1
  status:
    project:
      default:
        target: auto
        threshold: 2%
    patch:
      default:
        target: 70%
```

### 3. Add Container HEALTHCHECK (1 hour)
- **Impact**: Docker-native health monitoring for non-K8s deployments
- **Implementation**: Add `HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD ["/app/eval-hub", "--healthcheck"]` or use a lightweight HTTP check.

## Detailed Findings

### Unit Tests

**Score: 9/10**

Excellent unit testing practices:

- **134 test files** for **141 Go source files** — a **0.95:1 test-to-code ratio**, which is exceptional
- Distribution: 100 in `internal/`, 2 in `cmd/`, 16 in `pkg/`, 16 in `tests/`
- Uses standard Go `testing` package consistently
- **46 files** use `t.Parallel()` for concurrent test execution
- **Race detection** enabled via `-race` flag in all test and build targets
- MCP server tests use `mcp.NewInMemoryTransports()` for in-process handshake testing
- Test configuration files (`.conf.go-test`, `.conf.go-integration-test`) provide colorized output

**Key files**:
- `pkg/api/*_test.go` — API type tests (evaluations, collections, providers, GPU)
- `pkg/mlflowclient/*_test.go` — MLflow client tests (artifacts, experiments, runs, schemas, workspaces)
- `pkg/ociclient/*_test.go` — OCI client tests (auth, credentials, naming, client)
- `internal/evalhub_mcp/server/*_test.go` — MCP server unit tests (tools, resources, auth, request context)
- `internal/otel/*_test.go` — OpenTelemetry tests (SDK, export, job logs)

### Integration/E2E Tests

**Score: 8/10**

Comprehensive BDD-style functional verification:

- **15 Gherkin feature files** with approximately **299 scenarios** total
- Uses **godog** BDD framework with step definitions in `*_test.go` files
- Tests run against actual HTTP server instances

**Domain coverage**:
| Feature Area | Scenarios | Notable Coverage |
|---|---|---|
| Collections | 68 | CRUD, filtering, pagination |
| Evaluation Jobs | 51 | Create, list, status, validation |
| MCP | 42 | Client integration, tools, resources |
| Providers | 42 | GPU resources, configuration |
| Evaluations | 34 | Create, list, error paths |
| MCP Tools | 11 | Tool execution, discovery |
| MCP Resources | 12 | Resource URIs, templates |
| MCP Prompts | 8 | Prompt templates |
| MCP Server | 8 | Transport, auth, capabilities |
| GPU Resources | 6 | Hardware profiles, GPU allocation |
| Health | 5 | Health endpoints, readiness |
| K8s Resources | 4 | ConfigMap, Job specs, labels, ownerRefs |
| MLflow Experiments | 4 | Experiment CRUD via MLflow |
| Metrics | 2 | Prometheus endpoint validation |
| Local Jobs | 2 | Local runtime execution |

**Test tags** enable selective execution:
- `@cluster` — Kubernetes-dependent (excluded from default CI)
- `@local_runtime` — Full local job execution
- `@mlflow` — MLflow integration
- `@negative` — Error path validation
- `@gha-wheel-sanity` — Wheel validation subset

**Gap**: No multi-version K8s/OCP testing matrix. The `@cluster` tests exist but aren't run in CI against multiple versions.

### Build Integration

**Score: 9/10**

Outstanding PR-time build validation:

- **`docker-build-check` job** on every PR:
  - Builds Docker image from `Containerfile`
  - Validates image startup with `docker run --rm evalhub:pr-check /app/eval-hub --local --help`
- **Konflux pipeline** (`.tekton/odh-eval-hub-pull-request.yaml`):
  - Multi-arch: `linux/x86_64`, `linux/ppc64le`, `linux/s390x`, `linux-m2xlarge/arm64`
  - Hermetic builds with `gomod` prefetch
  - Uses `Dockerfile.konflux` with FIPS-compliant build flags
  - Triggered via labels (`kfbuild-all`, `kfbuild-eval-hub`) or `/build-konflux` comment
- **Config validation**: `go run ./cmd/validate_configs` on every PR
- **API doc validation**: `make documentation` with `git diff --exit-code` check
- **Python wheel sanity**: CI builds and tests both server and MCP wheels on PRs
- **Commit lint**: Conventional Commits enforced via commitizen

### Image Testing

**Score: 7/10**

Good container practices with room for improvement:

- **Multi-stage builds**: Go builder stage → UBI9-minimal runtime
- **UBI9 base images**: `registry.access.redhat.com/ubi9/go-toolset:1.26` (builder), `ubi9/ubi-minimal` (runtime)
- **Multi-arch support**: `linux/amd64,linux/arm64` in CI; 4 architectures in Konflux
- **Non-root user**: UID 1000 (`evalhub` user) with proper ownership
- **`.dockerignore`** present to reduce build context
- **Startup validation**: `docker run --rm evalhub:pr-check /app/eval-hub --local --help`
- **OCI labels**: Comprehensive `org.opencontainers.image.*` labels
- **Separate lighteval container**: `containers/lighteval/Dockerfile` using `ubi9/python-312`

**Gaps**:
- No `HEALTHCHECK` instruction (commented out as "wget not available")
- No Testcontainers-based runtime validation
- No container-level security scanning in CI (handled at org level)

### Coverage Tracking

**Score: 8/10**

Solid coverage infrastructure:

- **`codecov.yml`** with range 50..75 (yellow/green thresholds)
- **Three coverage profiles** generated:
  - `coverage.out` — unit tests (internal, cmd, pkg)
  - `coverage-fvt.out` — FVT integration tests
  - `coverage-init.out` — init container tests
- **Atomic coverage mode** (`-covermode=atomic`)
- **Comprehensive coverage scope** (`-coverpkg=./...`)
- **HTML reports** generated (`coverage.html`, `coverage-init.html`)
- **Codecov action** with `fail_ci_if_error: true` and `disable_search: true`
- Dependabot PRs gracefully handled (`continue-on-error` for secret access)

**Gap**: No `status.project.target` or `status.patch.target` in `codecov.yml` — thresholds are informational only, not gating.

### CI/CD Automation

**Score: 9/10**

Comprehensive automation with 17 workflows:

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | PR + push | Quality checks, tests, coverage, Docker build |
| `ci-mcp.yml` | PR + push (path-filtered) | MCP-specific quality + multi-platform build |
| `ci-python-server.yml` | PR (path-filtered) | Python server wheel build + sanity |
| `ci-python-mcp.yml` | PR + dispatch (path-filtered) | Python MCP wheel build + sanity |
| `commitlint.yml` | PR | Conventional Commits enforcement |
| `validate-configs.yml` | PR + push + dispatch | Provider/collection YAML validation |
| `dependency-review.yml` | PR | Dependency vulnerability scanning |
| `required-reviewer-approvals.yml` | PR events | Reviewer approval enforcement |
| `scorecard.yml` | Push + schedule | OpenSSF Scorecard analysis |
| `publish-python-server.yml` | Release | Python server package publishing |
| `publish-python-mcp.yml` | Release | Python MCP package publishing |
| `release-mcp.yml` | Tag | MCP binary release |
| `sync-branch-incubation.yaml` | — | Branch synchronization |
| `sync-branch-stable.yaml` | — | Branch synchronization |
| `check-trustyai-*` | — | ConfigMap sync verification |

**Security hardening**:
- `step-security/harden-runner` with `egress-policy: audit` on all workflows
- `persist-credentials: false` on all checkouts
- Pinned action SHAs (not tags) for supply chain security
- OpenSSF Scorecard scheduled weekly

**Caching**: Go module cache via `setup-go`, uv cache via `setup-uv`

**Gap**: No matrix strategy for testing against multiple Go versions or K8s versions.

### Static Analysis

**Score: 7/10**

Good foundations with one key gap:

**Linting**:
- `go vet` runs in CI and pre-commit hooks
- `go fmt` with `git diff --exit-code` enforces formatting
- No `golangci-lint` — missing extended linters like `errcheck`, `staticcheck`, `gocritic`

**Pre-commit hooks** (`.pre-commit-config.yaml`):
- `trailing-whitespace`, `end-of-file-fixer`, `check-yaml`, `check-json`, `check-toml`
- `check-merge-conflict`, `check-added-large-files` (max 1000KB)
- `debug-statements`
- `no-commit-to-branch` (prevents direct commits to main)
- `commitizen` (commit message enforcement)
- Custom `go-test` hook (runs `make test test-fvt`)

**FIPS Compatibility**:
- `GOEXPERIMENT=strictfipsruntime` in `Dockerfile.konflux` for all 4 binaries
- `CGO_ENABLED=1` for FIPS crypto linkage in Konflux build
- UBI9 base images (FIPS-capable)
- **No non-FIPS crypto imports found** (no `crypto/md5`, `crypto/des`, `crypto/rc4`, `math/rand`)
- Excellent FIPS posture

**Dependency Alerts**:
- Renovate configured (`.github/renovate.json`) extending `red-hat-data-services/konflux-central` defaults
- Dependency review action on PRs (`actions/dependency-review-action`)

### Agent Rules

**Score: 9/10**

Exceptional agent configuration:

**`CLAUDE.md`**:
- CVE fixing instructions with Go version management guidance
- npm devDependencies handling rules
- Documentation build verification requirements

**`AGENTS.md`** (11KB — comprehensive):
- Complete build and development command reference
- Testing strategy with all variants (unit, FVT, coverage)
- Architecture overview with project structure
- Server lifecycle and metrics documentation
- MCP server configuration and usage
- Git commit conventions with AI attribution trailers
- Two-tier configuration system explanation
- Request identity and routing patterns

**Path-scoped rules** (`.claude/rules/`):
- `evalhub-service.md` — API service specific: ExecutionContext pattern, routing, logging, database setup, testing strategy (unit + FVT with tag documentation)
- `evalhub-mcp-service.md` — MCP service specific: build/test commands, CLI flags, testing with in-memory transports

**Custom skills** (`.claude/skills/`):
- `fix-fvt-test/SKILL.md` — Scripted workflow for FVT failure analysis: reads test logs, pod logs, performs root cause analysis, proposes fixes

**Quality signals**: Rules are framework-specific (godog, Go testing), actionable (exact commands), architecture-aware (ExecutionContext, MCP transports), and maintained (references current codebase patterns).

## Recommendations

### Priority 0 (Critical)

1. **Add golangci-lint with curated linter configuration**
   - Replace basic `go vet` with `golangci-lint` running extended linters
   - Include: `errcheck`, `staticcheck`, `gosimple`, `unused`, `ineffassign`, `gocritic`, `revive`, `misspell`
   - Create `.golangci.yaml` with appropriate settings
   - Update CI and Makefile `lint` target

2. **Configure codecov coverage thresholds**
   - Add `status.project.default.target: auto` with `threshold: 2%` to prevent regressions
   - Add `status.patch.default.target: 70%` to ensure new code has adequate coverage
   - This converts coverage from informational to enforcement

### Priority 1 (High Value)

3. **Add multi-version Kubernetes testing matrix**
   - Run `@cluster` FVT tests against 2-3 K8s versions in CI
   - Use Kind with specific K8s version images
   - Catches API deprecation issues before customer deployment

4. **Add Testcontainers-based image validation**
   - Validate container startup, port exposure, and API health
   - Test both eval-hub and evalhub-mcp containers
   - Verify non-root execution and environment variable handling

### Priority 2 (Nice-to-Have)

5. **Add container HEALTHCHECK instruction**
   - Consider embedding a lightweight health check binary or using shell-free approaches
   - Enables Docker-native health monitoring for non-K8s deployments

6. **Add API performance/load testing**
   - Benchmark key evaluation endpoints
   - Detect performance regressions in CI
   - Especially important for concurrent evaluation job creation

## Comparison to Gold Standards

| Practice | eval-hub | odh-dashboard | notebooks | kserve |
|---|---|---|---|---|
| Test-to-code ratio | **0.95:1** | ~0.7:1 | N/A | ~0.6:1 |
| BDD/E2E testing | **299 scenarios (godog)** | Cypress + Jest | Pytest notebooks | E2E suite |
| Coverage enforcement | Codecov (no threshold) | Codecov + thresholds | N/A | Codecov + thresholds |
| PR Docker build | **Yes + dry-run** | Yes | Yes | Yes |
| Konflux integration | **Yes (4 architectures)** | Yes | Yes | Yes |
| FIPS compliance | **strictfipsruntime** | N/A | UBI images | UBI images |
| Pre-commit hooks | **Yes (comprehensive)** | Yes | Limited | Yes |
| golangci-lint | No (go vet only) | N/A | N/A | **Yes** |
| Agent rules | **Exceptional (CLAUDE.md + AGENTS.md + rules + skills)** | Good (CLAUDE.md) | None | None |
| Multi-version testing | No | No | No | **Yes** |
| Security hardening | **harden-runner + pinned SHAs** | Partial | Partial | Partial |
| OpenSSF Scorecard | **Yes** | No | No | No |

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yml` — Main CI pipeline
- `.github/workflows/ci-mcp.yml` — MCP-specific CI
- `.github/workflows/ci-python-server.yml` — Python server CI
- `.github/workflows/ci-python-mcp.yml` — Python MCP CI
- `.github/workflows/commitlint.yml` — Commit message enforcement
- `.github/workflows/validate-configs.yml` — Config validation
- `.github/workflows/dependency-review.yml` — Dependency scanning
- `.github/workflows/required-reviewer-approvals.yml` — Reviewer approval enforcement
- `.github/workflows/scorecard.yml` — OpenSSF Scorecard
- `.tekton/odh-eval-hub-pull-request.yaml` — Konflux pipeline

### Testing
- `tests/features/*.feature` — BDD feature files (9 files)
- `tests/features/*_test.go` — Step definitions and helpers
- `tests/kubernetes/features/` — K8s-specific FVT
- `tests/mlflow/features/` — MLflow integration FVT
- `tests/mcp/features/` — MCP FVT (4 files)
- `pkg/*_test.go` — Package unit tests
- `internal/*_test.go` — Internal unit tests
- `.conf.go-test` — Test output colorization
- `.conf.go-integration-test` — Integration test colorization

### Container Images
- `Containerfile` — Development/CI container build
- `Dockerfile.konflux` — FIPS-compliant Konflux build
- `containers/lighteval/Dockerfile` — LightEval container
- `.dockerignore` — Build context exclusions

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks
- `.github/renovate.json` — Renovate dependency management
- `codecov.yml` — Coverage configuration
- `.cz.toml` — Commitizen configuration
- `.markdownlint.json` — Markdown linting
- `redocly.yaml` — API documentation linting
- `semgrep.yaml` — Semgrep rules

### Agent Rules
- `CLAUDE.md` — CVE fixing and dependency management guidance
- `AGENTS.md` — Comprehensive build, test, and architecture reference
- `.claude/rules/evalhub-service.md` — API service rules (path-scoped)
- `.claude/rules/evalhub-mcp-service.md` — MCP service rules (path-scoped)
- `.claude/skills/fix-fvt-test/SKILL.md` — FVT debugging skill
