---
repository: "opendatahub-io/argo-workflows"
overall_score: 7.4
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Strong Go test suite (236 test files / 554 source files = 43% ratio) using testify and table-driven patterns"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Comprehensive E2E suite with K3S, multi-version K8s testing (v1.28–v1.31), 13-matrix strategy, SDK tests"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time Docker image builds (argoexec, argocli) with ODH-specific Dockerfiles, but no Konflux simulation"
  - dimension: "Image Testing"
    score: 6.5
    status: "Multi-stage builds, UBI9 base images for ODH, distroless upstream, but limited runtime validation"
  - dimension: "Coverage Tracking"
    score: 6.0
    status: "Codecov integration with 2% threshold tolerance, but coverage upload only on main (not PRs)"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "Well-organized workflows with concurrency control, changed-file detection, caching, multi-platform builds"
  - dimension: "Static Analysis"
    score: 8.0
    status: "18 golangci-lint linters enabled, FIPS-compliant builds (GOFIPS140=v1.0.0), Dependabot + Renovate configured"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory present"
critical_gaps:
  - title: "No coverage enforcement on PRs"
    impact: "Coverage regressions can be merged without detection; coverage only uploaded on main branch"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No Konflux build simulation on PRs"
    impact: "ODH/RHOAI build failures discovered only after merge in Konflux pipeline"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No container image runtime validation"
    impact: "Image startup issues or missing dependencies not caught until deployment"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents lack guidance on test patterns, coding standards, and project conventions"
    severity: "LOW"
    effort: "2-3 hours"
quick_wins:
  - title: "Enable coverage reporting on PRs (not just main)"
    effort: "1-2 hours"
    impact: "Catch coverage regressions before merge; currently only uploads on main"
  - title: "Add pre-commit hooks for consistent local linting"
    effort: "1-2 hours"
    impact: "Catch lint and formatting issues before CI, reducing feedback loop time"
  - title: "Create basic CLAUDE.md with test patterns and conventions"
    effort: "2-3 hours"
    impact: "Improve AI-generated code quality and consistency for contributors using Claude Code"
  - title: "Add container health check in Dockerfile"
    effort: "1 hour"
    impact: "Enable Kubernetes liveness/readiness probes from container definition"
recommendations:
  priority_0:
    - "Enable codecov coverage reporting on PRs with threshold enforcement to catch regressions before merge"
    - "Add PR-time Konflux build simulation for ODH Dockerfiles to catch build failures pre-merge"
  priority_1:
    - "Add container runtime validation tests (image startup, binary execution) in CI"
    - "Create comprehensive agent rules (.claude/rules/) covering Go testing patterns, E2E conventions, and FIPS compliance"
    - "Increase t.Parallel() usage across unit tests (only 16 tests currently use it)"
  priority_2:
    - "Add pre-commit hooks (.pre-commit-config.yaml) for golangci-lint and gofmt"
    - "Add stress/performance testing to PR pipeline (currently manual test/stress/ only)"
    - "Consider adding contract tests for gRPC/REST API boundaries"
---

# Quality Analysis: opendatahub-io/argo-workflows

## Executive Summary

- **Overall Score: 7.4/10**
- **Repository Type**: Kubernetes workflow engine (Go + React/TypeScript UI)
- **Primary Language**: Go (554 source files), TypeScript (UI)
- **Tier**: Midstream (opendatahub-io fork of argoproj/argo-workflows)
- **Jira Component**: AI Pipelines (RHOAIENG)

**Key Strengths**: Comprehensive E2E test suite with multi-version K8s testing, strong CI/CD automation with intelligent change detection, excellent FIPS compliance with `GOFIPS140=v1.0.0` in ODH builds, and thorough static analysis with 18 golangci-lint linters.

**Critical Gaps**: Coverage is not enforced on PRs (only uploaded on main), no Konflux build simulation for ODH Dockerfiles, and zero agent rules for AI-assisted development.

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 7.5/10 | 15% | Strong Go test suite with testify and table-driven patterns |
| Integration/E2E | 9.0/10 | 20% | Comprehensive E2E with K3S, multi-version K8s, SDK tests |
| Build Integration | 7.0/10 | 15% | PR-time image builds present but no Konflux simulation |
| Image Testing | 6.5/10 | 10% | Multi-stage builds, UBI9 for ODH, limited runtime validation |
| Coverage Tracking | 6.0/10 | 10% | Codecov integrated but upload restricted to main branch |
| CI/CD Automation | 8.5/10 | 15% | Excellent workflow design with change detection and caching |
| Static Analysis | 8.0/10 | 10% | 18 linters, FIPS compliance, Dependabot + Renovate |
| Agent Rules | 0.0/10 | 5% | No CLAUDE.md, AGENTS.md, or .claude/ directory |

## Critical Gaps

### 1. No Coverage Enforcement on PRs (HIGH)
- **Impact**: Coverage regressions can be merged undetected
- **Details**: The CI workflow generates `coverage.out` with `--coverprofile` on every run, but the codecov upload step is gated with `if: github.ref == 'refs/heads/main'`. This means PR authors never see coverage impact.
- **Effort**: 2-4 hours
- **Fix**: Remove the `if` condition from the codecov upload step and add a `coverage.status.patch` check with a threshold

### 2. No Konflux Build Simulation on PRs (HIGH)
- **Impact**: ODH/RHOAI-specific build failures (UBI9 base images, GOFIPS140 flags, `no_openssl` tags) are only discovered after merge when Konflux pipeline runs
- **Details**: The repo has ODH-specific Dockerfiles (`argo-workflowcontroller/Dockerfile.ODH`, `argo-argoexec/Dockerfile.ODH`) that use `registry.access.redhat.com/ubi9/go-toolset` and `GOFIPS140=v1.0.0`, but the PR CI only builds the upstream `Dockerfile` (alpine-based)
- **Effort**: 8-12 hours

### 3. No Container Runtime Validation (MEDIUM)
- **Impact**: Image startup issues, missing runtime dependencies, or binary execution failures not caught until deployment
- **Details**: Images are built in CI but not tested for runtime correctness (no `docker run` / health checks / smoke tests)
- **Effort**: 4-6 hours

### 4. No Agent Rules (LOW)
- **Impact**: AI agents lack project-specific guidance for test patterns, FIPS requirements, and coding standards
- **Details**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory present
- **Effort**: 2-3 hours

## Quick Wins

### 1. Enable Coverage Reporting on PRs (1-2 hours)
Remove the `if: github.ref == 'refs/heads/main'` condition from the codecov upload step in `.github/workflows/ci-build.yaml`:

```yaml
- name: Upload coverage report
  uses: codecov/codecov-action@84508663e988701840491b86de86b666e8a86bed # v4.3.0
  with:
    fail_ci_if_error: true
  env:
    CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}
```

And update `.codecov.yml` to enable patch coverage:
```yaml
coverage:
  status:
    patch:
      default:
        threshold: 5
    project:
      default:
        threshold: 2
```

### 2. Add Pre-commit Hooks (1-2 hours)
Create `.pre-commit-config.yaml`:
```yaml
repos:
  - repo: https://github.com/golangci/golangci-lint
    rev: v2.x.x
    hooks:
      - id: golangci-lint
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.x.x
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
```

### 3. Create Basic CLAUDE.md (2-3 hours)
Add a `CLAUDE.md` with test patterns, FIPS requirements, E2E conventions, and project-specific guidelines to improve AI-assisted development quality.

## Detailed Findings

### Unit Tests

**Score: 7.5/10**

| Metric | Value |
|--------|-------|
| Test files | 236 |
| Source files | 554 |
| Test-to-code ratio | 42.6% |
| Testing framework | Go testing + testify (7,540 assert/require calls) |
| Table-driven tests | 90 instances |
| Parallel tests | 16 instances of `t.Parallel()` |
| UI test files | 11 spec files (Jest) |

**Strengths**:
- Good test-to-code ratio at 42.6%
- Extensive use of testify assertions (7,540 calls)
- Table-driven test patterns (90 instances)
- Tests cover core packages: `workflow/`, `server/`, `cmd/`, `pkg/`, `persist/`, `config/`, `errors/`
- UI has its own Jest test suite with 11 test files

**Gaps**:
- Low `t.Parallel()` adoption (only 16 tests) — sequential execution slows CI
- Windows unit tests disabled due to FIPS/go-toolset dependency
- UI test coverage appears thin relative to UI codebase size

### Integration/E2E Tests

**Score: 9.0/10**

| Metric | Value |
|--------|-------|
| E2E test files | 29 (in `test/e2e/`) |
| Cluster setup | K3S on GitHub Actions |
| K8s versions tested | v1.28.13 (min), v1.31.0 (max) |
| Matrix strategies | 13 test configurations |
| SDK tests | Java and Python SDK E2E |
| Stress tests | Present (`test/stress/`) |
| Timeout | 60 minutes |

**Strengths**:
- **13-entry matrix** covering executor, core functional, functional, API, CLI, cron, examples, plugins, and SDK tests
- **Multi-version K8s testing**: min (v1.28.13) and max (v1.31.0) for executor, core functional, and functional tests
- **Multiple profiles**: minimal, mysql, plugins — testing different backend configurations
- **SDK integration**: Java SDK (Maven) and Python SDK tests run in E2E
- **Smart change detection**: E2E tests only run when relevant files change (via `tj-actions/changed-files`)
- **Comprehensive failure debugging**: K3S logs, pod logs, workflow descriptions on failure
- **Stress testing**: `test/stress/` with massive workflow and pod limits scenarios

**Gaps**:
- No OpenShift-specific E2E testing (only K3S/vanilla K8s)
- No multi-namespace testing scenarios

### Build Integration

**Score: 7.0/10**

| Metric | Value |
|--------|-------|
| PR image builds | Yes (argoexec, argocli via Docker Buildx) |
| ODH Dockerfiles | 2 (Dockerfile.ODH for workflowcontroller and argoexec) |
| Build caching | GHA cache + Docker layer caching |
| Multi-platform | linux/amd64, linux/arm64 (release only) |
| Codegen validation | Yes (with `git diff --exit-code` check) |
| Konflux simulation | No |

**Strengths**:
- PR CI builds Docker images for argoexec and argocli and uploads as artifacts
- Images are loaded into K3S for E2E testing (build-then-test pattern)
- Build caching via `type=gha` and Go module caching
- Codegen validation ensures generated code is committed
- ODH-specific Dockerfiles use UBI9 base images with FIPS support

**Gaps**:
- ODH Dockerfiles (`Dockerfile.ODH`) are not built or tested in PR CI — only the upstream `Dockerfile` is used
- No Konflux build simulation
- No `kustomize build` or operator manifest validation in PR pipeline

### Image Testing

**Score: 6.5/10**

| Metric | Value |
|--------|-------|
| Dockerfiles | 3 (Dockerfile, Dockerfile.windows, 2x Dockerfile.ODH) |
| Multi-stage builds | Yes (builder, UI, build targets, final distroless) |
| Base images (upstream) | `golang:1.26.1-alpine3.23` (builder), `gcr.io/distroless/static-debian13` (runtime) |
| Base images (ODH) | `registry.access.redhat.com/ubi9/go-toolset:1.26.3` (builder), `registry.redhat.io/ubi9/ubi-minimal:9.5` (runtime) |
| Non-root user | Yes (USER 8737 for upstream, USER 2000 for ODH argoexec) |
| HEALTHCHECK | No |
| Runtime validation | No |
| Multi-arch | linux/amd64, linux/arm64 (release only) |

**Strengths**:
- Multi-stage builds with separate build and runtime stages
- Distroless final images (upstream) and UBI-minimal (ODH) — minimal attack surface
- Non-root user configuration
- `.dockerignore` likely present (standard practice)
- Windows container support (`Dockerfile.windows`)

**Gaps**:
- No `HEALTHCHECK` instruction in any Dockerfile
- No runtime validation (no `docker run` smoke test in CI)
- No image scanning in PR pipeline (handled by org-level tooling)
- ODH images not tested in PR CI

### Coverage Tracking

**Score: 6.0/10**

| Metric | Value |
|--------|-------|
| Coverage tool | `--coverprofile=coverage.out` with `covermode=atomic` |
| Reporting | Codecov (`codecov/codecov-action@v4.3.0`) |
| PR coverage | Disabled (upload only on main) |
| Threshold | 2% regression tolerance (project-level) |
| Patch coverage | Disabled (`patch: off`) |
| Ignored paths | Generated files, test files, vendor, pkg/client |

**Strengths**:
- Coverage generation is part of the test pipeline (`--coverprofile=coverage.out`)
- Codecov integration with token-based auth
- Sensible ignore patterns for generated code and vendor
- Project-level threshold of 2% prevents major regressions

**Gaps**:
- **Coverage not reported on PRs** — the upload step has `if: github.ref == 'refs/heads/main'`
- Patch coverage explicitly disabled (`patch: off`) — new code not checked
- No coverage gates that block PR merge
- Comment in code: "engineers just ignore this in PRs, so lets not even run it"

### CI/CD Automation

**Score: 8.5/10**

| Metric | Value |
|--------|-------|
| Total workflows | 11 |
| PR-triggered | 3 (ci-build, pr, docs) |
| Push-triggered | 3 (ci-build, build-main, docs) |
| Tag/release | 2 (release, sdks) |
| Periodic | 1 (stale) |
| Manual/dispatch | 1 (build-main) |
| Comment-triggered | 2 (retest, ci-build) |
| Concurrency control | Yes (group + cancel-in-progress) |
| Change detection | Yes (tj-actions/changed-files with YAML groups) |
| Caching | Go modules, Docker layers (GHA), yarn |
| Timeout limits | Yes (6-60 minutes per job) |

**Workflow Inventory**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci-build.yaml` | PR, push | Unit tests, E2E, lint, codegen, UI, image builds |
| `pr.yaml` | PR | Semantic PR title check |
| `build-main.yml` | push to main, dispatch | ODH image builds (workflowcontroller, argoexec) |
| `release.yaml` | tag push | Multi-platform release builds + signing |
| `sdks.yaml` | tag push | Java/Python SDK publishing |
| `docs.yaml` | PR, push | Documentation build and lint |
| `stale.yaml` | cron (daily) | Stale issue/PR management |
| `retest.yaml` | issue comment | Re-run failed CI on `/retest` |
| `dependabot-reviewer.yml` | PR | Dependabot PR auto-review |
| `changelog.yaml` | — | Changelog generation |
| `snyk.yml` | — | Security scanning |

**Strengths**:
- **Smart change detection**: 5 file groups (tests, e2e-tests, codegen, lint, ui) with precise path matching
- **Concurrency control**: `cancel-in-progress: true` prevents duplicate runs
- **Custom actions**: `setup-go` and `build_and_tag` for consistency
- **SHA-pinned actions**: Enforced via `zgosalvez/github-actions-ensure-sha-pinned-actions`
- **Comment-based retesting**: `/retest` and `/test` commands
- **Comprehensive failure debugging** in E2E tests

**Gaps**:
- ODH builds (`build-main.yml`) only run on push to main / manual dispatch — not on PRs
- No test result reporting (e.g., JUnit XML upload)

### Static Analysis

**Score: 8.0/10**

#### Linting
- **golangci-lint v2** with 18 linters enabled:
  - `asasalint`, `bidichk`, `bodyclose`, `copyloopvar`, `errcheck`, `gosec`, `govet`, `ineffassign`, `misspell`, `nakedret`, `nosprintfhostport`, `reassign`, `rowserrcheck`, `sqlclosecheck`, `staticcheck`, `testifylint`, `unparam`, `unused`
- **Formatters**: `gofmt`, `goimports` (with local prefix `github.com/argoproj/argo-workflows/`)
- **gosec** configured with specific includes (G304, G307) and excludes (G106, G402)
- **staticcheck** with all checks minus some style rules (ST1003, ST1005, ST1016)
- **UI**: ESLint configured via `yarn lint` with auto-fix
- **Docs**: Markdown linting (`.markdownlint.yaml`, `.mlc_config.json`), spell checking (`.spelling`)
- **GH Actions**: SHA pinning enforcement

#### FIPS Compatibility
- **Go module**: `godebug fips140=on` in `go.mod` — FIPS mode enabled at module level
- **ODH Dockerfiles**: `GOFIPS140=v1.0.0` build flag with `-tags no_openssl`
- **Base images**: UBI9 go-toolset for builder, UBI9 ubi-minimal for runtime — fully FIPS-capable
- **Upstream Dockerfile**: Uses `golang:alpine` (not FIPS-capable) but this is expected for upstream
- **Minor issue**: `math/rand` imported in `workflow/util/util.go` — not a security concern for workflow ID generation but worth noting
- **Windows tests disabled** due to FIPS/go-toolset unavailability

#### Dependency Alerts
- **Dependabot**: Comprehensive configuration covering 4 ecosystems:
  - `gomod` (Go dependencies)
  - `npm` (UI dependencies with dev/prod grouping)
  - `pip` (docs dependencies)
  - `github-actions` (CI action pinning)
  - Security-only updates (non-security PRs limited via `open-pull-requests-limit: 0`)
- **Renovate**: Configured for Nix flake updates only (`dev/nix/flake.nix`)

#### Pre-commit Hooks
- **Not configured** — no `.pre-commit-config.yaml`
- Linting runs in CI only, not enforced locally

### Agent Rules

**Score: 0.0/10**

- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **`.claude/` directory**: Not present
- **`.claude/rules/`**: Not present

**Recommendation**: Generate agent rules using `/test-rules-generator` to create:
- Go unit test patterns (testify assertions, table-driven tests)
- E2E test conventions (K3S setup, fixtures, test profiles)
- FIPS compliance requirements (GOFIPS140, UBI base images)
- Code generation workflow (make codegen, proto files)
- PR guidelines (semantic commits, change detection groups)

## Recommendations

### Priority 0 (Critical)
1. **Enable codecov on PRs**: Remove the `if: github.ref == 'refs/heads/main'` gate and enable patch coverage to catch regressions before merge
2. **Add PR-time ODH Dockerfile builds**: Build `Dockerfile.ODH` variants in the CI pipeline to catch FIPS/UBI-specific build failures before merge

### Priority 1 (High Value)
3. **Add container runtime validation**: After building images, run `docker run --rm <image> --help` or similar smoke test to verify binary execution
4. **Create agent rules**: Add `.claude/rules/` with test patterns, FIPS requirements, and project conventions
5. **Increase t.Parallel() adoption**: Only 16 of 236 test files use parallel execution — systematic adoption could cut CI time significantly

### Priority 2 (Nice-to-Have)
6. **Add pre-commit hooks**: Configure `.pre-commit-config.yaml` for local linting/formatting enforcement
7. **Integrate stress testing in CI**: The `test/stress/` scenarios are available but not run in automated CI
8. **Add JUnit XML test reporting**: Upload test results for better GitHub PR integration and test analytics

## Comparison to Gold Standards

| Dimension | argo-workflows | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit Tests | 7.5 | 9.0 | 7.0 | 8.0 |
| Integration/E2E | 9.0 | 9.0 | 8.0 | 9.0 |
| Build Integration | 7.0 | 8.0 | 9.0 | 7.0 |
| Image Testing | 6.5 | 7.0 | 9.0 | 6.0 |
| Coverage Tracking | 6.0 | 9.0 | 6.0 | 8.0 |
| CI/CD Automation | 8.5 | 9.0 | 8.0 | 8.0 |
| Static Analysis | 8.0 | 8.0 | 7.0 | 7.0 |
| Agent Rules | 0.0 | 8.0 | 2.0 | 2.0 |
| **Overall** | **7.4** | **8.7** | **7.4** | **7.3** |

**Notable**: argo-workflows matches or exceeds gold standards in E2E testing and CI/CD automation. The main gaps are coverage enforcement, agent rules, and ODH-specific build validation.

## File Paths Reference

### CI/CD
- `.github/workflows/ci-build.yaml` — Main CI pipeline (unit tests, E2E, lint, codegen, UI)
- `.github/workflows/pr.yaml` — PR title semantic check
- `.github/workflows/build-main.yml` — ODH image builds
- `.github/workflows/release.yaml` — Multi-platform release builds
- `.github/workflows/docs.yaml` — Documentation build/lint
- `.github/workflows/retest.yaml` — Comment-triggered retest
- `.github/actions/setup-go/` — Custom Go setup action
- `.github/actions/build_and_tag/` — Custom build/tag action

### Testing
- `test/e2e/` — 29 E2E test files with fixtures and manifests
- `test/stress/` — Stress testing scenarios
- `test/util/` — Test utilities
- `hack/k8s-versions.sh` — K8s version matrix configuration
- `ui/jest.config.js` — UI test configuration

### Build / Images
- `Dockerfile` — Upstream multi-stage Dockerfile (alpine/distroless)
- `Dockerfile.windows` — Windows container support
- `argo-workflowcontroller/Dockerfile.ODH` — ODH workflow controller (UBI9/FIPS)
- `argo-argoexec/Dockerfile.ODH` — ODH argoexec (UBI9/FIPS)
- `Makefile` — Build, test, lint, codegen targets

### Code Quality
- `.golangci.yml` — 18 linters + formatters configured
- `.codecov.yml` — Coverage tracking (2% threshold, patch off)
- `.github/dependabot.yml` — 4-ecosystem dependency management
- `renovate.json` — Nix flake updates
- `.markdownlint.yaml` — Markdown linting
- `.spelling` — Spell check dictionary

### FIPS
- `go.mod` — `godebug fips140=on`
- `argo-workflowcontroller/Dockerfile.ODH` — `GOFIPS140=v1.0.0`
- `argo-argoexec/Dockerfile.ODH` — `GOFIPS140=v1.0.0`
