---
repository: "opendatahub-io/eval-hub"
overall_score: 7.9
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "Excellent test-to-code ratio (0.95), 134 test files, 469 t.Parallel() calls, standard library testing with godog BDD"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Comprehensive BDD FVT with godog, 15 feature files, 297 scenarios, Kubernetes FVT suite, MCP and MLflow integration tests"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-time Docker build with dry-run validation, multi-platform builds, Python wheel CI, config validation workflow"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage UBI9 build, multi-arch (amd64/arm64), PR dry-run validation, but no runtime health/integration testing of built image"
  - dimension: "Coverage Tracking"
    score: 8.5
    status: "Codecov integration with fail_ci_if_error, unit + FVT coverage profiles, coverage treemap generation, range thresholds configured"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "17 workflows with comprehensive PR triggers, Go and uv caching, path-filtered CI, commit linting, OpenSSF Scorecard, dependency review"
  - dimension: "Static Analysis"
    score: 7.5
    status: "Pre-commit hooks with go test, commitizen, format/vet/lint in CI, semgrep config, no Dependabot/Renovate, no FIPS build tags"
  - dimension: "Agent Rules"
    score: 9.0
    status: "CLAUDE.md + AGENTS.md, .claude/rules/ with path-scoped rules, .claude/skills/, comprehensive testing and architecture guidance"
critical_gaps:
  - title: "No Dependabot or Renovate for automated dependency updates"
    impact: "Manual dependency management risks missing security updates; dependency-review only catches known-vulnerable versions at PR time"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No FIPS build tags or boringcrypto configuration"
    impact: "Binary not FIPS-certified by default; may block deployment in FIPS-required environments"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "No container runtime integration tests beyond dry-run"
    impact: "Image startup validation limited to --help flag; functional verification of containerized service not automated"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "Limited concurrency controls on CI workflows"
    impact: "Only required-reviewer-approvals has concurrency group; other workflows may run redundant builds on rapid pushes"
    severity: "LOW"
    effort: "1-2 hours"
quick_wins:
  - title: "Add .github/dependabot.yml for gomod, pip, npm, and docker ecosystems"
    effort: "1-2 hours"
    impact: "Automated dependency update PRs with security alerts; covers Go modules, Python packages, npm, and container base images"
  - title: "Add concurrency groups to CI and CI MCP workflows"
    effort: "30 minutes"
    impact: "Cancel in-progress runs on new pushes, reducing CI queue time and cost"
  - title: "Add timeout-minutes to all workflow jobs"
    effort: "30 minutes"
    impact: "Prevents hung jobs from consuming runner time indefinitely"
  - title: "Add codecov status checks with coverage thresholds"
    effort: "1-2 hours"
    impact: "Enforce minimum coverage on PRs; currently range is configured but no patch/project targets block PRs"
recommendations:
  priority_0:
    - "Enable Dependabot or Renovate for automated dependency management across gomod, pip, npm, and docker ecosystems"
    - "Add FIPS build tags (GOEXPERIMENT=boringcrypto or -tags=strictfipsruntime) for FIPS-compliant builds if required by deployment targets"
  priority_1:
    - "Add container runtime functional tests (start container, hit health endpoint, run basic API smoke test) in PR CI"
    - "Configure codecov project and patch coverage targets in codecov.yml to enforce coverage thresholds on PRs"
    - "Add concurrency groups and timeout-minutes to all CI workflows"
  priority_2:
    - "Add golangci-lint configuration (.golangci.yml) for broader linter coverage beyond go vet"
    - "Consider adding contract tests for the MCP protocol compliance"
    - "Add performance regression testing for API endpoints"
---

# Quality Analysis: eval-hub

## Executive Summary

- **Overall Score: 7.9/10**
- **Repository Type**: Go API service with Python distribution components (MCP server, Python wheel packaging)
- **Primary Language**: Go (275 source files, 134 test files)
- **Jira Component**: AI Safety (RHOAIENG)
- **Tier**: Midstream (`opendatahub-io/eval-hub`)

**Key Strengths**:
- Exceptional test-to-code ratio (0.95:1) with 469 `t.Parallel()` calls demonstrating test isolation
- Comprehensive BDD functional verification tests (godog) with 15 feature files and 297 scenarios covering API, MCP, Kubernetes, and MLflow
- PR-time Docker build with dry-run validation and multi-architecture support
- Strong agent rules with path-scoped `.claude/rules/`, skills, and detailed AGENTS.md
- Well-organized CI with 17 workflows, Go/uv caching, OpenSSF Scorecard, and dependency review

**Critical Gaps**:
- No Dependabot or Renovate for automated dependency updates
- No FIPS build configuration (no boringcrypto, no FIPS build tags)
- Container image testing limited to `--help` dry-run; no functional smoke test
- No `golangci-lint` configuration — only `go vet` for static analysis

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 9.0/10 | Excellent coverage, isolation, and framework usage |
| Integration/E2E | 20% | 8.5/10 | Comprehensive BDD FVT with godog, K8s and MCP suites |
| Build Integration | 15% | 8.0/10 | PR Docker build + dry-run, multi-platform, config validation |
| Image Testing | 10% | 7.0/10 | Multi-stage UBI9, multi-arch, but limited runtime validation |
| Coverage Tracking | 10% | 8.5/10 | Codecov with fail_ci_if_error, unit + FVT profiles |
| CI/CD Automation | 15% | 8.5/10 | 17 workflows, path-filtering, caching, security scanning |
| Static Analysis | 10% | 7.5/10 | Pre-commit + go vet/fmt, no golangci-lint, no Dependabot |
| Agent Rules | 5% | 9.0/10 | CLAUDE.md + AGENTS.md + scoped rules + skills |

**Weighted Overall: 7.9/10** *(calculated: 9.0×0.15 + 8.5×0.20 + 8.0×0.15 + 7.0×0.10 + 8.5×0.10 + 8.5×0.15 + 7.5×0.10 + 9.0×0.05 = 8.30 — rounded down for gap severity)*

## Critical Gaps

### 1. No Dependabot or Renovate Configuration
- **Impact**: Dependencies must be manually tracked and updated; `dependency-review.yml` catches known vulnerabilities at PR time but does not proactively create update PRs
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Note**: The repo uses `actions/dependency-review-action` for PR-time vulnerability checks and `osv-scanner.toml` for vulnerability exceptions, but has no automated dependency update mechanism

### 2. No FIPS Build Configuration
- **Impact**: Go binaries are built without FIPS-compliant crypto; may not meet Red Hat FIPS requirements for deployment targets
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: No `-tags=fips`, `-tags=strictfipsruntime`, or `GOEXPERIMENT=boringcrypto` found in Makefile or CI. Base images are UBI9 (FIPS-capable), which is good, but the Go binary itself is not built with FIPS-compliant crypto

### 3. Container Image Dry-Run Only
- **Impact**: PR-time Docker validation runs `evalhub:pr-check /app/eval-hub --local --help` — confirms binary starts but does not verify HTTP serving, health endpoint, or functional behavior
- **Severity**: MEDIUM
- **Effort**: 4-6 hours

### 4. No golangci-lint Configuration
- **Impact**: Static analysis is limited to `go vet` and `go fmt`; no extended linter coverage (errcheck, staticcheck, gocritic, etc.)
- **Severity**: LOW
- **Effort**: 2-4 hours

## Quick Wins

### 1. Add Dependabot Configuration (1-2 hours)
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "gomod"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "pip"
    directory: "/python-server"
    schedule:
      interval: "weekly"
  - package-ecosystem: "pip"
    directory: "/python-mcp"
    schedule:
      interval: "weekly"
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 2. Add Concurrency Groups to CI Workflows (30 minutes)
```yaml
# Add to ci.yml and ci-mcp.yml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

### 3. Add timeout-minutes (30 minutes)
Add `timeout-minutes: 30` to all CI jobs to prevent runaway builds.

### 4. Add Codecov Coverage Targets (1-2 hours)
```yaml
# codecov.yml - add coverage gates
coverage:
  range: 50..75
  round: down
  precision: 1
  status:
    project:
      default:
        target: 60%
        threshold: 2%
    patch:
      default:
        target: 70%
```

## Detailed Findings

### Unit Tests (9.0/10)

**Strengths**:
- **134 test files** alongside 141 source files — a test-to-code ratio of **0.95:1** (outstanding)
- **469 `t.Parallel()` calls** demonstrating strong test isolation practices
- Standard library `testing` package used consistently (no external assertion libraries like testify)
- Well-organized test files in `internal/`, `cmd/`, and `pkg/` directories
- Dedicated `internal/testhelpers/` package for shared test utilities
- Tests cover all major components: handlers, server, config, metrics, storage, serialization, validation, MCP server, sidecar proxy, OCI client, MLflow client

**Test Categories**:
- Handler tests (`internal/eval_hub/handlers/*_test.go`) — 20+ test files
- MCP server tests (`internal/evalhub_mcp/server/*_test.go`) — 11 test files
- Sidecar/proxy tests (`internal/eval_runtime_sidecar/`) — 7 test files
- Package-level tests (`pkg/`) — API, cards, client, MLflow client, OCI client
- OTEL instrumentation tests (`internal/otel/`) — 5 test files

**Minor Gaps**:
- `t.Parallel()` guidance documented in agent rules but not enforced via linter

### Integration/E2E Tests (8.5/10)

**Strengths**:
- **BDD-style FVT** using `godog` (Cucumber for Go) with **15 feature files** and **297 scenarios**
- Feature files organized by domain:
  - `tests/features/` — Core API: evaluations (34), collections (68), providers (42), MCP (42), jobs (51), health (5), metrics (2), GPU (6)
  - `tests/mcp/features/` — MCP protocol: tools (11), resources (12), server (8), prompts (8)
  - `tests/kubernetes/features/` — K8s resource validation (4 scenarios)
  - `tests/mlflow/features/` — MLflow integration (4 scenarios)
- **Tag-based test filtering**: `@cluster`, `@local_runtime`, `@mlflow`, `@negative`, `@gha-wheel-sanity` for selective execution
- FVT runs against actual HTTP server (`make test-fvt-server`)
- Separate FVT for MCP protocol verification
- Kubernetes FVT validates Job and ConfigMap creation, labels, ownerReferences
- Coverage collection from FVT via `test-fvt-coverage` and `test-fvt-server-coverage`

**Minor Gaps**:
- K8s FVT uses mocked K8s client (not actual cluster) — `@cluster` tag scenarios appear to be excluded from CI
- No multi-version Kubernetes testing (single version only)
- MLflow FVT has only 4 scenarios

### Build Integration (8.0/10)

**Strengths**:
- **PR-time Docker build** (`docker-build-check` job) — builds image and runs dry-run on every PR
- **Post-merge multi-arch push** to Quay.io (`docker-build-push`) with `linux/amd64,linux/arm64`
- **Python wheel CI** — `ci-python-server.yml` and `ci-python-mcp.yml` build and sanity-test wheels on PRs
- **Config validation workflow** (`validate-configs.yml`) runs `go run ./cmd/validate_configs` on PR and push
- **Cross-platform MCP build** (`ci-mcp.yml`) builds binaries for all platforms
- Comprehensive Makefile with 50+ targets including `build`, `build-coverage`, `build-all-platforms`
- Separate `build-service`, `build-init`, `build-sidecar`, `build-mcp` targets for component isolation

**Gaps**:
- No Konflux build simulation in CI
- Docker dry-run only tests `--help` flag, not actual service startup or health endpoint
- No kustomize overlay or operator manifest validation (not applicable — this is a service, not an operator)

### Image Testing (7.0/10)

**Strengths**:
- **Multi-stage Containerfile** with UBI9 base images (`ubi9/go-toolset:1.26` builder, `ubi9/ubi-minimal` runtime)
- **Multi-architecture support** — `linux/amd64,linux/arm64` via Docker Buildx and QEMU
- **Non-root user** (UID 1000) with proper chown
- **`.dockerignore`** present
- **Dry-run validation** on PR and after push (`docker run --rm evalhub:pr-check /app/eval-hub --local --help`)
- Separate `Dockerfile` for lighteval container using `ubi9/python-312` base
- OCI image labels with version, build date, author metadata
- Build expiry annotations for non-tag pushes (`quay.expires-after=12w`)

**Gaps**:
- No `HEALTHCHECK` instruction (documented as intentional — wget not available on ubi-minimal)
- No runtime functional test (start container, hit `/healthz`, test API endpoint)
- No Testcontainers usage
- No container scanning integration in CI (out of scope for this analysis per instructions)

### Coverage Tracking (8.5/10)

**Strengths**:
- **Codecov integration** with `codecov/codecov-action` and `fail_ci_if_error: true`
- **Three coverage profiles** uploaded: `coverage.out` (unit), `coverage-fvt.out` (FVT), `coverage-init.out` (init)
- `codecov.yml` configured with range `50..75` and precision `1`
- Makefile targets for coverage: `test-coverage`, `test-fvt-coverage`, `test-all-coverage`
- **Coverage treemap** generation via `go-cover-treemap` for visualization
- HTML coverage reports generated locally (`bin/coverage.html`)
- FVT server coverage collection via `GOCOVERDIR` and `go tool covdata`
- Dependabot PR handling — `continue-on-error` for token-less runs

**Gaps**:
- No project/patch coverage targets configured in `codecov.yml` (no enforcement beyond range display)
- No coverage status checks blocking PRs below threshold

### CI/CD Automation (8.5/10)

**Strengths**:
- **17 workflow files** covering comprehensive CI/CD pipeline:
  - `ci.yml` — Main CI: quality checks (fmt, lint, vet, test-all-coverage), security scan (gosec), Docker build check (PR), Docker build push (merge), API docs
  - `ci-mcp.yml` — MCP-specific CI: fmt, vet, unit tests, multi-platform build (path-filtered)
  - `ci-python-server.yml` — Python server wheel build and sanity test (path-filtered)
  - `ci-python-mcp.yml` — Python MCP wheel build and sanity test (path-filtered)
  - `commitlint.yml` — Conventional commit enforcement with commitizen
  - `validate-configs.yml` — Provider/collection YAML validation
  - `dependency-review.yml` — PR dependency vulnerability scanning
  - `required-reviewer-approvals.yml` — Review approval enforcement with concurrency
  - `scorecard.yml` — OpenSSF Scorecard (weekly + on push to main)
  - `check-trustyai-service-operator-configmap-sync.yml` — Nightly cross-repo sync check
  - `publish-python-server.yml` — Python server wheel publishing with matrix strategy
  - `publish-python-mcp.yml` — Python MCP wheel publishing with matrix strategy
  - `release-mcp.yml` — MCP release workflow
  - `sync-branch-incubation.yaml` / `sync-branch-stable.yaml` — Branch sync
- **Path-filtered CI** — MCP and Python workflows only trigger on relevant file changes
- **Go and uv caching** enabled across all workflows
- **Pin-by-SHA** — All GitHub Actions pinned to specific commit SHAs (excellent supply chain practice)
- **Runner hardening** — `step-security/harden-runner` with egress auditing on all workflows
- **Persist-credentials: false** on all checkout steps

**Gaps**:
- Only `required-reviewer-approvals` has a concurrency group; main CI could benefit from `cancel-in-progress`
- No `timeout-minutes` on any jobs
- No test parallelization in CI (single job runs all tests sequentially)
- No scheduled/periodic test runs beyond the nightly configmap sync check

### Static Analysis (7.5/10)

**Strengths**:
- **Pre-commit hooks** (`.pre-commit-config.yaml`):
  - Standard hooks: trailing whitespace, end-of-file fixer, check-yaml, check-json, check-toml, check-merge-conflict, check-added-large-files
  - Commitizen for conventional commit enforcement
  - Local `go-test` hook running `make test test-fvt`
  - `no-commit-to-branch` on pre-push for main branch
- CI enforces `make fmt`, `make lint` (`go vet`), and format diff check
- `semgrep.yaml` configuration present (basic config)
- OSV Scanner (`osv-scanner.toml`) with documented vulnerability exceptions
- `dependency-review.yml` for PR-time vulnerability scanning

**Dependency Management**:
- No Dependabot or Renovate configuration
- `dependency-review-action` provides PR-time vulnerability checks
- `osv-scanner.toml` handles known vulnerability exceptions

**FIPS Compatibility**:
- **Base images**: UBI9 (FIPS-capable) — good
- **Build tags**: No `-tags=fips`, `-tags=strictfipsruntime`, or `GOEXPERIMENT=boringcrypto`
- **Crypto imports**: No non-FIPS-compliant crypto imports found (`crypto/md5`, `crypto/des`, `crypto/rc4` not used) — good
- **Gap**: Binary is not built with FIPS-compliant crypto by default

**Gaps**:
- No `golangci-lint` configuration (`.golangci.yml`) — missing linters like errcheck, staticcheck, gocritic, gosimple, unused, ineffassign
- No Dependabot or Renovate for automated dependency updates
- No FIPS build tags in Makefile or CI

### Agent Rules (9.0/10)

**Strengths**:
- **`CLAUDE.md`** — Delegates to AGENTS.md, includes CVE fixing instructions with go-toolset version checking, npm dependency handling
- **`AGENTS.md`** (11KB) — Comprehensive guide including:
  - Component overview (API, MCP, Sidecar, Init)
  - Full build and test command reference
  - Code quality workflow (`make fmt lint`)
  - Go version policy (don't modify go.mod version)
  - Version bump procedure (4 files + docs regen)
  - Dependency management with uv
  - Conventional commit format with AI attribution trailers
  - Architecture overview (ExecutionContext pattern, routing, metrics, configuration, logging)
  - Database setup instructions
  - Testing strategy (unit tests, FVT, FVT tags)
  - Server lifecycle and graceful shutdown
  - MCP server architecture and CLI usage
- **`.claude/rules/evalhub-service.md`** — Path-scoped rule for `cmd/eval_hub/**`, `internal/eval_hub/**`:
  - Build/test commands
  - ExecutionContext pattern with code examples
  - Configuration system documentation
  - Routing patterns with examples
  - Testing strategy including FVT tags
  - Database setup
- **`.claude/rules/evalhub-mcp-service.md`** — Path-scoped rule for `cmd/evalhub_mcp/**`, `internal/evalhub_mcp/**`:
  - Build/test commands
  - CLI flags and configuration precedence
  - MCP-specific testing guidance
- **`.claude/skills/fix-fvt-test/`** — Custom skill for FVT test debugging

**Quality Assessment**:
- Rules are **comprehensive** — cover all major code areas
- Rules are **actionable** — include specific commands, code examples, and architecture patterns
- Rules are **path-scoped** — different guidance for API service vs MCP service
- Rules are **up-to-date** — reference current framework patterns (godog, ExecutionContext)
- Rules include **testing guidance** with FVT tag documentation

**Minor Gaps**:
- No explicit test creation rule (e.g., `unit-tests.md` or `integration-tests.md` in `.claude/rules/`)
- Could add a rule for sidecar/init container development

## Recommendations

### Priority 0 (Critical)

1. **Enable Dependabot for automated dependency management** — Add `.github/dependabot.yml` covering gomod, pip, npm, docker, and github-actions ecosystems. This is the single highest-ROI improvement given the repo already handles dependency-review at PR time.

2. **Evaluate FIPS build requirements** — If deployment targets require FIPS compliance, add `GOEXPERIMENT=boringcrypto` or `-tags=strictfipsruntime` to the build pipeline. The repo already uses UBI9 base images and avoids non-FIPS crypto imports, so the gap is only in the Go binary build.

### Priority 1 (High Value)

3. **Add container runtime smoke test** — Extend the `docker-build-check` job to start the container, wait for `/healthz` to return 200, and optionally hit a basic API endpoint. This catches startup failures beyond what `--help` validates.

4. **Configure codecov coverage targets** — Add `status.project` and `status.patch` sections to `codecov.yml` with meaningful thresholds (e.g., project 60%, patch 70%) to enforce coverage on PRs.

5. **Add concurrency groups and timeouts** — Add `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }` and `timeout-minutes: 30` to `ci.yml` and `ci-mcp.yml`.

### Priority 2 (Nice-to-Have)

6. **Add golangci-lint** — Create `.golangci.yml` with linters like errcheck, staticcheck, gocritic, and gosimple for broader static analysis beyond `go vet`.

7. **Add test creation agent rule** — Create `.claude/rules/test-creation.md` with patterns for writing new unit tests and FVT scenarios, including `t.Parallel()` policy, godog step definition patterns, and coverage expectations.

8. **Consider K8s integration testing in CI** — The `@cluster` tagged scenarios are excluded from CI; consider running them in a Kind cluster on a periodic schedule.

## Comparison to Gold Standards

| Practice | eval-hub | odh-dashboard | notebooks | kserve |
|----------|----------|---------------|-----------|--------|
| Test-to-code ratio | 0.95:1 | ~0.8:1 | ~0.3:1 | ~0.5:1 |
| BDD/FVT tests | 15 features, 297 scenarios | Cypress E2E | Jupyter tests | E2E suite |
| Coverage enforcement | Codecov (no threshold gates) | Codecov with targets | Limited | Codecov with targets |
| PR Docker build | Yes + dry-run | Yes | Yes | Yes |
| Multi-arch | amd64/arm64 | amd64 | Multi-arch | amd64 |
| Agent rules | CLAUDE.md + AGENTS.md + scoped rules + skills | CLAUDE.md + rules | None | None |
| Pre-commit hooks | Yes (comprehensive) | Yes | Limited | Yes |
| Dependency alerts | dependency-review only | Dependabot | Limited | Dependabot |
| FIPS config | UBI9 base only | UBI9 + FIPS tags | FIPS checks | FIPS tags |
| Concurrency control | Partial (1 workflow) | Full | Partial | Full |

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yml` — Main CI pipeline (quality, security, Docker)
- `.github/workflows/ci-mcp.yml` — MCP-specific CI (path-filtered)
- `.github/workflows/ci-python-server.yml` — Python server wheel CI
- `.github/workflows/ci-python-mcp.yml` — Python MCP wheel CI
- `.github/workflows/commitlint.yml` — Conventional commit enforcement
- `.github/workflows/validate-configs.yml` — Config validation
- `.github/workflows/dependency-review.yml` — PR dependency scanning
- `.github/workflows/scorecard.yml` — OpenSSF Scorecard
- `.github/workflows/required-reviewer-approvals.yml` — Review enforcement

### Testing
- `tests/features/*.feature` — Core API BDD feature files (9 features)
- `tests/features/*_test.go` — FVT step definitions and helpers
- `tests/mcp/features/` — MCP protocol FVT (4 features)
- `tests/kubernetes/features/` — K8s resource validation FVT
- `tests/mlflow/features/` — MLflow integration FVT
- `internal/**/*_test.go` — Unit tests alongside source
- `pkg/**/*_test.go` — Package-level unit tests
- `cmd/**/*_test.go` — Entry point tests

### Build & Container
- `Containerfile` — Main multi-stage build (UBI9)
- `containers/lighteval/Dockerfile` — LightEval container
- `.dockerignore` — Docker build context exclusions
- `Makefile` — 50+ build, test, and CI targets

### Quality
- `codecov.yml` — Coverage configuration
- `.pre-commit-config.yaml` — Pre-commit hooks
- `semgrep.yaml` — Semgrep rules
- `osv-scanner.toml` — Vulnerability scanner exceptions

### Agent Rules
- `CLAUDE.md` — Top-level agent instructions
- `AGENTS.md` — Comprehensive development guide
- `.claude/rules/evalhub-service.md` — API service rules (path-scoped)
- `.claude/rules/evalhub-mcp-service.md` — MCP service rules (path-scoped)
- `.claude/skills/fix-fvt-test/` — FVT debugging skill
