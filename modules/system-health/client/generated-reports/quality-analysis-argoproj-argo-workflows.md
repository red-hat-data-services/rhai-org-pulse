---
repository: "argoproj/argo-workflows"
overall_score: 7.4
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "307 test files with 419+ test functions; Go testing + gotestsum; cross-platform (Linux + Windows)"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "37 E2E test files; 28+ matrix configs; multi-K8s-version testing (v1.33-v1.36); Playwright UI E2E"
  - dimension: "Build Integration"
    score: 7.0
    status: "Tilt-based PR image builds deployed to k3d; manifest validation; no Konflux simulation"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage distroless images; multi-arch (amd64/arm64); images deployed and tested in E2E via Tilt"
  - dimension: "Coverage Tracking"
    score: 6.0
    status: "Codecov integration with threshold but coverage only uploaded on main, not enforced on PRs"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "17 workflows; smart change detection; concurrency control; extensive caching; matrix E2E"
  - dimension: "Static Analysis"
    score: 7.0
    status: "golangci-lint v2 with 35+ linters; Dependabot + Renovate; no pre-commit hooks; no FIPS config"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory present"
critical_gaps:
  - title: "No coverage enforcement on PRs"
    impact: "Coverage regressions can merge undetected; coverage only uploaded to Codecov on main branch"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No FIPS build configuration"
    impact: "Non-FIPS-compliant crypto usage (crypto/md5); alpine/distroless base images are not FIPS-capable without extra work"
    severity: "MEDIUM"
    effort: "8-16 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents have no guidance for test patterns, code standards, or contribution workflows"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No pre-commit hooks"
    impact: "Lint and formatting issues caught only in CI, not locally before commit"
    severity: "LOW"
    effort: "1-2 hours"
quick_wins:
  - title: "Enable PR coverage reporting in Codecov"
    effort: "1-2 hours"
    impact: "Catch coverage regressions before merge; currently only uploads on main"
  - title: "Add pre-commit hooks with golangci-lint and goimports"
    effort: "1-2 hours"
    impact: "Catch lint/formatting issues locally before pushing to CI"
  - title: "Create basic CLAUDE.md with test patterns and contribution guidelines"
    effort: "2-3 hours"
    impact: "Enable AI agents to generate conformant tests and code"
  - title: "Increase t.Parallel() usage in unit tests"
    effort: "4-6 hours"
    impact: "Faster unit test execution; currently only 3 files use t.Parallel()"
recommendations:
  priority_0:
    - "Enable Codecov PR coverage uploads and enforce minimum threshold on PRs"
    - "Add FIPS build configuration (boringcrypto tags, UBI base images) for Red Hat downstream consumption"
  priority_1:
    - "Create comprehensive agent rules (CLAUDE.md, .claude/rules/) for test automation guidance"
    - "Add pre-commit hooks for lint, formatting, and typo checking"
    - "Increase t.Parallel() adoption across unit test files"
  priority_2:
    - "Add container runtime validation tests (Testcontainers or equivalent)"
    - "Add HEALTHCHECK instructions to production Dockerfiles"
    - "Expand Playwright UI E2E test coverage beyond login and workflow list"
---

# Quality Analysis: argoproj/argo-workflows

## Executive Summary

- **Overall Score: 7.4/10**
- **Repository Type**: Kubernetes workflow engine (Go backend + React UI)
- **Primary Language**: Go (693 source files) with TypeScript UI
- **Jira Component**: AI Pipelines (RHOAIENG)
- **Tier**: Upstream

**Key Strengths**: Exceptional E2E testing infrastructure with 28+ matrix configurations, smart CI change detection that only runs relevant checks, comprehensive golangci-lint setup with 35+ linters, and multi-version K8s testing (v1.33-v1.36). The project uses Tilt-based development workflow that builds and deploys real container images to k3d clusters for E2E testing.

**Critical Gaps**: Coverage is not enforced on PRs (only uploaded on main), no FIPS build configuration for downstream consumption, no AI agent rules, and no pre-commit hooks.

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.0/10 | 15% | 1.20 | 307 test files, 419+ functions, cross-platform |
| Integration/E2E | 9.0/10 | 20% | 1.80 | 37 E2E files, 28+ matrix configs, multi-K8s |
| Build Integration | 7.0/10 | 15% | 1.05 | Tilt builds + k3d deploy on PRs |
| Image Testing | 7.0/10 | 10% | 0.70 | Multi-stage distroless, multi-arch |
| Coverage Tracking | 6.0/10 | 10% | 0.60 | Codecov present but not enforced on PRs |
| CI/CD Automation | 9.0/10 | 15% | 1.35 | 17 workflows, smart change detection |
| Static Analysis | 7.0/10 | 10% | 0.70 | 35+ linters, Dependabot + Renovate |
| Agent Rules | 0.0/10 | 5% | 0.00 | No agent rules present |
| **Overall** | **7.4/10** | **100%** | **7.40** | |

## Critical Gaps

### 1. No Coverage Enforcement on PRs
- **Impact**: Coverage regressions can merge undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The CI workflow explicitly comments "engineers just ignore this in PRs, so lets not even run it" and only uploads coverage to Codecov on pushes to main. The `.codecov.yml` has `patch: off`, meaning per-commit coverage is not checked. While a 2% project-level threshold exists, it only applies retroactively on main.

### 2. No FIPS Build Configuration
- **Impact**: Downstream Red Hat builds require FIPS-compliant crypto; current setup uses non-FIPS libraries
- **Severity**: MEDIUM
- **Effort**: 8-16 hours
- **Details**: One file (`workflow/util/util.go`) imports `crypto/md5`. No FIPS build tags (`-tags=fips`, `GOEXPERIMENT=boringcrypto`) exist. Base images use `golang:alpine` and `gcr.io/distroless/static-debian13` rather than UBI.

### 3. No Agent Rules
- **Impact**: AI agents have no guidance for contributing conformant code
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory. AI-assisted development produces inconsistent test patterns and code styles.

### 4. No Pre-commit Hooks
- **Impact**: Lint and formatting issues only caught in CI, wasting PR cycle time
- **Severity**: LOW
- **Effort**: 1-2 hours
- **Details**: No `.pre-commit-config.yaml` found. The project has excellent lint tooling (golangci-lint v2 with 35+ linters) but it only runs in CI.

## Quick Wins

### 1. Enable PR Coverage Reporting (1-2 hours)
Remove the `if: github.ref == 'refs/heads/main'` condition from the Codecov upload step in `ci-build.yaml` and enable patch coverage in `.codecov.yml`:
```yaml
# .codecov.yml
coverage:
  status:
    patch:
      default:
        target: 80%
    project:
      default:
        threshold: 2
```

### 2. Add Pre-commit Hooks (1-2 hours)
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/golangci/golangci-lint
    rev: v2.2.1
    hooks:
      - id: golangci-lint
        args: [--fix]
  - repo: https://github.com/crate-ci/typos
    rev: v1.29.10
    hooks:
      - id: typos
```

### 3. Create Basic Agent Rules (2-3 hours)
Create `CLAUDE.md` with project test patterns, naming conventions, and contribution guidelines to enable AI-assisted development.

### 4. Increase t.Parallel() Usage (4-6 hours)
Only 3 test files use `t.Parallel()`. Adding parallel test execution across the 307 test files would significantly reduce CI time.

## Detailed Findings

### Unit Tests

**Score: 8.0/10**

| Metric | Value |
|--------|-------|
| Test files | 307 |
| Source files | 693 |
| Test-to-code ratio | 0.44 |
| Test functions | 419+ |
| Framework | Go `testing` + `gotestsum` |
| Cross-platform | Linux + Windows |
| t.Parallel() usage | 3 files (low) |

**Strengths**:
- Solid test-to-code ratio of 0.44 (307 test files / 693 source files)
- Tests run on both Ubuntu 24.04 and Windows 2022
- Uses `gotestsum` with JSON output for structured test reporting
- Test retries with `--rerun-fails-run-root-test` for flaky test handling
- `-covermode=atomic` for accurate concurrent coverage measurement
- `-p 20` for parallel package execution

**Gaps**:
- Only 3 files use `t.Parallel()` for intra-package parallelism
- Coverage not uploaded on PRs

**Key Files**:
- `Makefile` - Test targets with `gotest` function
- `.github/workflows/ci-build.yaml` - Unit test job
- `test/reports/json/` - JSON test output directory

### Integration/E2E Tests

**Score: 9.0/10**

| Metric | Value |
|--------|-------|
| E2E test files | 37 |
| E2E test functions | 34 top-level (many subtests) |
| UI E2E files | 2 Playwright specs |
| Matrix configurations | 28+ |
| K8s versions tested | v1.33 (min), v1.36 (max) |
| Cluster tool | k3d |
| Orchestration | Tilt |
| Profiles | minimal, mysql, postgres, telemetry, plugins, telemetry-stack |

**Strengths**:
- Comprehensive E2E matrix testing 28+ configurations:
  - Multiple test suites: artifacts, executor, functional, API, metrics, tracing, CLI, cron, examples, plugins, SDK
  - Multiple database backends: MySQL and PostgreSQL
  - Multiple K8s versions via k3d
  - Initless and non-initless configurations
- Real cluster testing with k3d + Tilt:
  - Builds production Docker images
  - Deploys to k3d cluster
  - Port-forwards argo-server, MinIO, databases
  - `tilt wait --for=condition=Ready` for reliable readiness gating
- UI E2E with Playwright:
  - Tests login and workflow list
  - Page Object Model pattern (`ui/e2e/pages/`)
  - Fixtures-based test architecture
  - Playwright report upload on failure
- Stress tests in `test/stress/` (massive workflows, pod limits)
- SDK testing (Go SDK and Java SDK) as part of E2E
- Comprehensive failure debugging (pod logs, resource descriptions)

**Gaps**:
- UI E2E coverage is still limited (2 spec files: login, workflow-list)
- E2E timeout set to 60 minutes (some tests are slow under resource contention)

**Key Files**:
- `test/e2e/` - Go E2E tests (artifacts, functional, CLI, cron, etc.)
- `ui/e2e/` - Playwright UI E2E tests
- `ui/playwright.config.ts` - Playwright configuration
- `hack/k8s-versions.sh` - K8s version configuration
- `Tiltfile` - Development/CI orchestration

### Build Integration

**Score: 7.0/10**

**Strengths**:
- PR CI builds production Docker images via Tilt and deploys to k3d
- Multi-stage Dockerfile with separate targets for each binary
- `make manifests-validate` runs during E2E to validate release manifests
- Docker buildx used for release builds with caching
- Build metadata injected via ldflags (GIT_COMMIT, GIT_TAG, GIT_TREE_STATE)
- Codegen validation: `git diff --exit-code` after `make codegen` to catch uncommitted generated code

**Gaps**:
- No explicit Konflux build simulation (upstream project, not expected)
- No explicit `kustomize build` dry-run validation in PR CI
- No explicit `kubectl apply --dry-run` for manifest validation in CI
- Build process relies on Tilt (complex local development tool) rather than standard Docker build in CI

**Key Files**:
- `Dockerfile` - Multi-stage build (10+ stages)
- `Dockerfile.windows` - Windows container support
- `Tiltfile` - Development/CI orchestration
- `Makefile` - Build targets (dist/argo, dist/workflow-controller, dist/argoexec)

### Image Testing

**Score: 7.0/10**

**Strengths**:
- Multi-stage Dockerfile with clear separation of builder and runtime stages
- Distroless base images for production (`gcr.io/distroless/static-debian13`)
- Alpine for dev images (minimal surface area)
- Multi-architecture support (linux/amd64, linux/arm64) in release workflow
- Images are actually deployed and tested as part of E2E (Tilt + k3d)
- Non-root user (UID 8737) for production images
- Docker buildx with zstd compression and registry caching
- Pinned base image digests (e.g., `@sha256:9197324ba...`)

**Gaps**:
- No `HEALTHCHECK` instruction in Dockerfile (health checks exist in K8s manifests only)
- No explicit Testcontainers or standalone container validation tests
- No `.dockerignore` verification (may exist but not checked)
- Dev images use alpine (acceptable for dev, but not for FIPS)

**Key Files**:
- `Dockerfile` - Multi-stage production build
- `Dockerfile.windows` - Windows container support
- `.devcontainer/builder/Dockerfile` - Dev container
- `manifests/base/workflow-controller/workflow-controller-deployment.yaml` - K8s liveness probes

### Coverage Tracking

**Score: 6.0/10**

**Strengths**:
- `.codecov.yml` present and configured
- `--coverprofile=coverage.out` used in CI unit tests
- `--covermode=atomic` for accurate concurrent coverage
- Project-level coverage threshold (2% drop tolerance)
- Generated and test files excluded from coverage
- Both Linux and Windows tests generate coverage

**Gaps**:
- **Coverage only uploaded on main branch** — CI explicitly skips PR uploads: "engineers just ignore this in PRs, so lets not even run it"
- `patch: off` in `.codecov.yml` — per-commit coverage changes not tracked
- No coverage gate on PRs — coverage regressions can merge silently
- No minimum coverage floor enforced
- E2E tests don't generate coverage profiles

**Key Files**:
- `.codecov.yml` - Codecov configuration
- `.github/workflows/ci-build.yaml` - Coverage generation (unit tests only)

### CI/CD Automation

**Score: 9.0/10**

**Strengths**:
- **17 workflow files** covering CI, PRs, release, docs, cherry-picks, and more
- **Smart change detection** with `tj-actions/changed-files`:
  - Only runs unit tests when Go source files change
  - Only runs E2E when test infrastructure or manifests change
  - Only runs UI tests when `ui/` changes
  - Only runs lint when relevant files change
- **Concurrency control**: `cancel-in-progress: true` on CI workflow
- **Comprehensive caching**:
  - Go module cache via `actions/setup-go`
  - Yarn cache for UI builds
  - Docker buildx cache for release builds
- **Matrix strategy**: 28+ E2E configurations with fail-fast disabled
- **Timeout management**: All jobs have `timeout-minutes` set
- **PR quality automation**:
  - PR title check (semantic PR)
  - PR feature check (validates feature flag file for `feat:` PRs)
  - PR readiness helper (sticky comment with contributor guidance)
  - Dependabot auto-reviewer
- **Artifact management**: Test results uploaded for debugging
- **Composite status check**: Aggregates matrix results into single check
- **GH Actions SHA pinning** enforced in CI

**Gaps**:
- No explicit test parallelization sharding (relies on Go's `-p` flag)
- No periodic/scheduled test runs visible (no `on: schedule`)
- Stale bot could be more aggressive with issue triage

**Key Files**:
- `.github/workflows/ci-build.yaml` - Main CI (unit, E2E, lint, codegen, UI)
- `.github/workflows/pr.yaml` - PR title check
- `.github/workflows/pr-readiness.yaml` - PR readiness bot
- `.github/workflows/pr-feature.yaml` - Feature flag check
- `.github/workflows/release.yaml` - Multi-arch release builds
- `.github/workflows/dependabot-reviewer.yml` - Auto-review Dependabot PRs

### Static Analysis

**Score: 7.0/10**

#### Linting

**golangci-lint v2** with an exceptionally comprehensive configuration:
- **35+ linters enabled** including: gosec, staticcheck, revive, errorlint, govet, bodyclose, contextcheck, ineffassign, misspell, nakedret, nilerr, unconvert, unused, and many more
- **govet** with 30+ analyzers (shadow, nilness, lostcancel, waitgroup, slog, etc.)
- **revive** with 30+ rules (atomic, datarace, defer, early-return, etc.)
- **Formatters**: gofmt, goimports with local prefix enforcement
- **UI**: `yarn lint` (ESLint/equivalent)
- **Additional**: `_typos.toml`, `.cspell.json`, `.markdownlint.yaml` for documentation quality

#### FIPS Compatibility

| Check | Status |
|-------|--------|
| Non-FIPS crypto imports | `crypto/md5` in `workflow/util/util.go` |
| FIPS build tags | Not present |
| `GOEXPERIMENT=boringcrypto` | Not configured |
| Base images | Alpine/Distroless (not UBI) |

The repository has no FIPS build configuration. For downstream Red Hat consumption, FIPS-compliant builds would need:
- Replace `crypto/md5` usage with FIPS-approved alternatives
- Add `-tags=fips` or `GOEXPERIMENT=boringcrypto` build configuration
- Consider UBI base images for production containers

#### Dependency Alerts

| Tool | Status | Coverage |
|------|--------|----------|
| Dependabot | Configured | gomod, npm, pip, github-actions, devcontainers |
| Renovate | Configured | nix, custom k8s versions, automerge patches |

Both Dependabot and Renovate are configured — comprehensive dependency management:
- **Dependabot**: Security-only updates (open-pull-requests-limit: 0), covers 5 ecosystems
- **Renovate**: Automerge for patch updates on main, conservative updates on release branches, OSV vulnerability alerts enabled, lock file maintenance

**Key Files**:
- `.golangci.yml` - golangci-lint v2 configuration
- `.github/dependabot.yml` - Dependabot configuration (5 ecosystems)
- `renovate.json` - Renovate with automerge and OSV alerts
- `_typos.toml` - Typo checking configuration
- `.cspell.json` - Spell checking
- `.markdownlint.yaml` - Markdown linting

### Agent Rules

**Score: 0.0/10**

- **Status**: Missing
- **Coverage**: None
- **Quality**: N/A
- **Gaps**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory
- **Recommendation**: Generate test automation rules with `/test-rules-generator` to cover:
  - Go unit test patterns (table-driven tests, test isolation, error assertion)
  - E2E test patterns (test/e2e framework, fixtures, expected failures)
  - UI test patterns (Jest unit tests, Playwright E2E)
  - Code style and contribution guidelines

## Recommendations

### Priority 0 (Critical)

1. **Enable Codecov PR coverage uploads and enforce minimum threshold on PRs**
   - Remove `if: github.ref == 'refs/heads/main'` from Codecov upload step
   - Enable `patch` coverage in `.codecov.yml` with a reasonable target (e.g., 70%)
   - This is the most impactful quick win — prevents silent coverage regression

2. **Add FIPS build configuration for Red Hat downstream consumption**
   - Replace `crypto/md5` usage in `workflow/util/util.go`
   - Add `GOEXPERIMENT=boringcrypto` build variant
   - Consider UBI base images for production Dockerfiles

### Priority 1 (High Value)

3. **Create comprehensive agent rules (CLAUDE.md, .claude/rules/)**
   - Document Go test patterns (table-driven, t.Parallel, test fixtures)
   - Document E2E test structure (test/e2e framework, Tilt workflow)
   - Document UI test patterns (Jest for unit, Playwright for E2E)
   - Include code style expectations and contribution workflow

4. **Add pre-commit hooks for lint and formatting**
   - Configure `.pre-commit-config.yaml` with golangci-lint, typos, goimports
   - Catches issues locally before CI round-trip

5. **Increase t.Parallel() adoption across unit test files**
   - Only 3 out of 307 test files use `t.Parallel()`
   - Adding parallel execution would reduce CI unit test time

### Priority 2 (Nice-to-Have)

6. **Add container runtime validation tests**
   - Use Testcontainers or equivalent for standalone image validation
   - Test image startup, health endpoints, signal handling independently of k3d

7. **Expand Playwright UI E2E coverage**
   - Currently only 2 spec files (login, workflow-list)
   - Add tests for workflow creation, cron workflows, workflow templates, cluster templates

8. **Add scheduled CI runs**
   - No `on: schedule` workflows detected
   - Periodic full test runs would catch flaky tests and upstream dependency issues

## Comparison to Gold Standards

| Dimension | argo-workflows | odh-dashboard | notebooks | kserve | Best Practice |
|-----------|---------------|---------------|-----------|--------|---------------|
| Unit Tests | 8.0 | 9.0 | 7.0 | 8.0 | Table-driven, parallel, comprehensive |
| Integration/E2E | 9.0 | 9.0 | 8.0 | 9.0 | Multi-version, matrix, real clusters |
| Build Integration | 7.0 | 8.0 | 7.0 | 7.0 | PR-time build validation |
| Image Testing | 7.0 | 7.0 | 9.0 | 6.0 | Multi-arch, runtime validation |
| Coverage Tracking | 6.0 | 8.0 | 6.0 | 8.0 | PR enforcement, thresholds |
| CI/CD Automation | 9.0 | 9.0 | 8.0 | 8.0 | Smart triggers, caching, matrix |
| Static Analysis | 7.0 | 8.0 | 6.0 | 7.0 | Comprehensive linting, FIPS |
| Agent Rules | 0.0 | 8.0 | 2.0 | 2.0 | CLAUDE.md, .claude/rules/ |
| **Overall** | **7.4** | **8.5** | **7.0** | **7.2** | |

**Relative to gold standards**: argo-workflows excels in E2E testing (28+ matrix configs, multi-K8s-version, real cluster deployment) and CI/CD automation (smart change detection, comprehensive caching). The main gaps vs. odh-dashboard are coverage enforcement on PRs and agent rules.

## File Paths Reference

### CI/CD
- `.github/workflows/ci-build.yaml` - Main CI workflow (unit, E2E, lint, codegen, UI)
- `.github/workflows/pr.yaml` - PR title semantic check
- `.github/workflows/pr-readiness.yaml` - PR readiness helper bot
- `.github/workflows/pr-feature.yaml` - Feature flag PR check
- `.github/workflows/release.yaml` - Multi-arch release builds
- `.github/workflows/dependabot-reviewer.yml` - Auto-review Dependabot PRs
- `.github/workflows/stale.yaml` - Stale issue/PR management
- `.github/workflows/cherry-pick.yml` - Cherry-pick automation
- `Makefile` - Build/test/lint targets

### Testing
- `test/e2e/` - 37 Go E2E test files (artifacts, functional, CLI, cron, metrics, etc.)
- `ui/e2e/` - Playwright UI E2E tests (login, workflow-list)
- `ui/src/**/*.test.*` - 27 Jest UI unit tests
- `test/stress/` - Stress test configurations
- `ui/jest.config.js` - Jest configuration
- `ui/playwright.config.ts` - Playwright configuration

### Code Quality
- `.golangci.yml` - golangci-lint v2 (35+ linters)
- `.github/dependabot.yml` - Dependabot (5 ecosystems)
- `renovate.json` - Renovate with automerge
- `_typos.toml` - Typo checking
- `.cspell.json` - Spell checking
- `.markdownlint.yaml` - Markdown linting

### Container Images
- `Dockerfile` - Multi-stage build (10+ stages, distroless production)
- `Dockerfile.windows` - Windows container build
- `.devcontainer/` - Dev container configuration

### Coverage
- `.codecov.yml` - Codecov configuration (patch: off, threshold: 2%)

### Kubernetes
- `manifests/` - Kustomize manifests
- `hack/k8s-versions.sh` - K8s version pinning (v1.33-v1.36)
- `Tiltfile` - Development/CI orchestration
