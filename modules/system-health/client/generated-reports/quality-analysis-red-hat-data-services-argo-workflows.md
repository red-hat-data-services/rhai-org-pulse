---
repository: "red-hat-data-services/argo-workflows"
overall_score: 6.8
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Strong unit test coverage (286 test files for 666 code files, 43% ratio) using Go testing + testify, with Windows cross-platform testing"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Comprehensive E2E suite with 49 test files, multi-database (MySQL/Postgres), multi-K8s version testing (v1.33-v1.35), and custom Given/When/Then framework"
  - dimension: "Build Integration"
    score: 5.0
    status: "Upstream Docker image builds run on PRs with caching; downstream Konflux builds are comment/label-triggered only, not automatic"
  - dimension: "Image Testing"
    score: 5.5
    status: "PR-time image builds with multi-target (argoexec, argocli); UBI9 + FIPS downstream images but no runtime validation or startup testing"
  - dimension: "Coverage Tracking"
    score: 5.0
    status: "Codecov integration exists but only uploads on main branch (not PRs), 2% threshold with patch coverage disabled"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "Well-organized CI with smart file-change detection, concurrency control, and caching; but downstream is behind upstream versions and missing some workflows"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory present — zero AI-assisted development guidance"
critical_gaps:
  - title: "Downstream significantly behind upstream"
    impact: "Red Hat fork uses Go 1.24 vs upstream Go 1.26, older action versions (checkout v4 vs v6), and module path v3 vs v4 — indicates staleness and potential security gaps"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No PR-time coverage reporting"
    impact: "Coverage uploads only on main branch. Developers cannot see coverage impact of their changes during review"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container runtime validation"
    impact: "Built images are never started or health-checked during CI. Startup failures only discovered in production"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Konflux builds not automatic on PRs"
    impact: "Downstream Konflux builds require manual /build-konflux comment or kfbuild-all label — build failures discovered late"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No secret detection or SAST scanning"
    impact: "No Gitleaks, TruffleHog, or CodeQL configured. Secrets or vulnerabilities may be committed undetected"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "Reduced linter configuration downstream"
    impact: "Downstream golangci-lint has 18 linters vs upstream's 42. Missing gosec, errorlint, gocritic, revive, and many others"
    severity: "MEDIUM"
    effort: "4-8 hours"
quick_wins:
  - title: "Enable PR-time coverage reporting"
    effort: "1-2 hours"
    impact: "Developers see coverage delta on every PR, catching regressions before merge"
  - title: "Add Gitleaks secret detection"
    effort: "1-2 hours"
    impact: "Prevents accidental secret commits in PRs"
  - title: "Create basic CLAUDE.md agent rules"
    effort: "2-3 hours"
    impact: "AI-assisted development follows project conventions for test patterns, PR requirements, and code style"
  - title: "Add container startup smoke test"
    effort: "2-3 hours"
    impact: "Catch image build issues (missing binaries, wrong entrypoint) before deployment"
  - title: "Make Konflux builds automatic on PRs"
    effort: "1-2 hours"
    impact: "Downstream build failures caught automatically instead of requiring manual trigger"
recommendations:
  priority_0:
    - "Sync downstream fork closer to upstream — Go version, action versions, and module path are significantly behind"
    - "Enable PR-time codecov reporting to catch coverage regressions"
    - "Add container runtime validation (health check, startup test) to CI pipeline"
  priority_1:
    - "Align downstream golangci-lint config with upstream (18 vs 42 linters)"
    - "Add CodeQL or gosec SAST scanning to PR workflow"
    - "Add Gitleaks or TruffleHog for secret detection"
    - "Make Konflux builds automatic (remove comment/label gating)"
  priority_2:
    - "Create CLAUDE.md and .claude/rules/ for AI-assisted development"
    - "Add pre-commit hooks for consistent local development"
    - "Add fuzz testing for security-sensitive parsers"
    - "Add image vulnerability scanning (Trivy) to PR workflow"
---

# Quality Analysis: red-hat-data-services/argo-workflows

## Executive Summary

- **Overall Score: 6.8/10**
- **Repository Type**: Go-based Kubernetes workflow engine (downstream fork of argoproj/argo-workflows)
- **Primary Languages**: Go (backend), TypeScript/React (UI)
- **Fork Nature**: Red Hat Data Services downstream fork with Konflux/RHOAI integration, custom UBI9 Dockerfiles, and FIPS-compliant builds

### Key Strengths
- Excellent upstream E2E testing framework with Given/When/Then pattern and multi-database/multi-K8s testing
- Smart CI with file-change detection to skip unnecessary jobs
- Comprehensive upstream linting (42 linters with detailed govet and revive rules)
- Konfux/Tekton pipeline integration for downstream builds
- Snyk dependency scanning and Dependabot for dependency updates

### Critical Gaps
- Downstream fork is significantly behind upstream (Go 1.24 vs 1.26, v3 vs v4 module path)
- No PR-time coverage reporting (only uploads on main)
- No container runtime validation or startup testing
- No secret detection (Gitleaks/TruffleHog) or SAST scanning (CodeQL)
- Zero agent rules for AI-assisted development

### Agent Rules Status: **Missing**
No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory. No test automation guidance for AI agents.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | Strong test-to-code ratio (43%), Go testing + testify, cross-platform (Linux + Windows) |
| Integration/E2E | 8.0/10 | 49 E2E test files, custom framework, multi-DB (MySQL/Postgres), multi-K8s version (v1.33-v1.35) |
| **Build Integration** | **5.0/10** | **Upstream builds images on PRs; downstream Konflux builds require manual trigger** |
| Image Testing | 5.5/10 | Multi-target Docker builds on PRs; UBI9 + FIPS downstream, but no runtime validation |
| Coverage Tracking | 5.0/10 | Codecov configured but PR reporting disabled; 2% threshold, patch coverage off |
| CI/CD Automation | 7.0/10 | Smart change detection, concurrency control, caching; downstream behind on versions |
| Agent Rules | 0.0/10 | No agent rules, no test creation guidance, no development standards for AI |

## Critical Gaps

### 1. Downstream Fork Significantly Behind Upstream
- **Impact**: Security vulnerabilities in older dependencies, missing upstream improvements, module path divergence (v3 vs v4)
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**:
  - Go version: 1.24 (downstream) vs 1.26 (upstream)
  - Actions checkout: v4.1.1 (downstream) vs v6.0.2 (upstream)
  - Module path: `v3` (downstream) vs `v4` (upstream)
  - Downstream is missing: pr-feature.yaml, devcontainer.yaml workflows
  - Downstream has fewer linters (18 vs 42)
  - Downstream missing gotestsum integration for test result aggregation

### 2. No PR-Time Coverage Reporting
- **Impact**: Developers cannot see coverage delta during PR review. Regressions merge silently
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Current State**: `if: github.ref == 'refs/heads/main'` gate prevents PR uploads
- **Comment in code**: "engineers just ignore this in PRs, so lets not even run it"

### 3. No Container Runtime Validation
- **Impact**: Built images never started or health-checked. Startup failures (missing libs, wrong entrypoint, missing config) only caught in production
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Images are built and archived but never `docker run` tested

### 4. Konflux Builds Not Automatic on PRs
- **Impact**: Downstream Konflux builds require `/build-konflux argoexec` comment or `kfbuild-all` label. Build failures discovered late
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: Tekton PipelineRuns use `on-comment` and `on-label` triggers, not `on-event: pull_request`

### 5. No Secret Detection or SAST
- **Impact**: No static application security testing. Secrets could be committed. Code vulnerabilities not scanned
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Missing**: Gitleaks, TruffleHog, CodeQL, Semgrep

### 6. Reduced Linter Coverage Downstream
- **Impact**: Downstream misses 24 linters present upstream including gosec (partially), errorlint, gocritic, revive, contextcheck, containedctx, and more
- **Severity**: MEDIUM
- **Effort**: 4-8 hours

## Quick Wins

### 1. Enable PR-Time Coverage Reporting
- **Effort**: 1-2 hours
- **Impact**: Immediate visibility into coverage impact per PR
- **Implementation**: Remove the `if: github.ref == 'refs/heads/main'` gate on codecov upload step, or use codecov PR comments

### 2. Add Gitleaks Secret Detection
- **Effort**: 1-2 hours
- **Impact**: Prevents accidental secret commits
- **Implementation**:
```yaml
- name: Gitleaks
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 3. Create Basic CLAUDE.md Agent Rules
- **Effort**: 2-3 hours
- **Impact**: AI-assisted development follows project conventions
- **Implementation**: Create `CLAUDE.md` with Go testing patterns, PR requirements, linting rules

### 4. Add Container Startup Smoke Test
- **Effort**: 2-3 hours
- **Impact**: Catch image build issues before deployment
- **Implementation**: After image build, run `docker run --rm quay.io/argoproj/argoexec:latest argoexec version`

### 5. Make Konflux Builds Automatic on PRs
- **Effort**: 1-2 hours
- **Impact**: Catch downstream build failures automatically
- **Implementation**: Change Tekton PipelineRun to trigger on `pull_request` event instead of comment/label

## Detailed Findings

### CI/CD Pipeline

#### Workflow Inventory (Downstream: `red-hat-data-services/argo-workflows`)

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci-build.yaml` | push (main, stable, rhoai-*), PR | Unit tests, E2E tests, lint, codegen, UI, image builds |
| `build-main.yml` | push (main), workflow_dispatch | Build and push ODH images to Quay |
| `pr.yaml` | pull_request_target | PR title semantic conformance check |
| `docs.yaml` | push/PR to main | Docs build and lint |
| `snyk.yml` | schedule (daily), push to main | Go and Node dependency vulnerability scanning |
| `dependabot-reviewer.yml` | pull_request | Auto-approve/merge Dependabot PRs |
| `release.yaml` | tag push, push to main/dev-* | Multi-arch release build |
| `stale.yaml` | schedule (daily) | Mark stale issues/PRs |
| `retest.yaml` | issue_comment | Re-run tests via `/retest` comment |

#### Tekton/Konflux Pipeline Inventory

| Pipeline | Trigger | Purpose |
|----------|---------|---------|
| `argo-argoexec-pull-request` | `/build-konflux argoexec` comment, `kfbuild-*` label | Build argoexec Konflux image on PR |
| `argo-workflowcontroller-pull-request` | `/build-konflux workflowcontroller` comment, `kfbuild-*` label | Build workflow-controller Konflux image on PR |
| `argo-argoexec-push` | push to stable | Build and push argoexec release image |
| `argo-workflowcontroller-push` | push to stable | Build and push workflow-controller release image |
| `argo-argoexec-pull` | PR to stable (ODH) | ODH PR build for argoexec |
| `argo-workflowcontroller-pull` | PR to stable (ODH) | ODH PR build for workflow-controller |

**Strengths**:
- Smart file-change detection avoids running unnecessary jobs
- Concurrency control with `cancel-in-progress: true`
- Docker layer caching with GHA cache backend
- Parallel test matrix for E2E with multiple profiles

**Gaps**:
- Downstream uses older action versions (checkout v4 vs v6)
- Missing upstream workflows: `pr-feature.yaml`, `devcontainer.yaml`
- Konflux builds require manual trigger on PRs

### Test Coverage

#### Unit Tests
- **Framework**: Go standard `testing` package + `github.com/stretchr/testify` (assert, require, suite)
- **Test Files**: 236 downstream (286 upstream)
- **Code Files**: 554 downstream (666 upstream)
- **Test-to-Code Ratio**: 43% (solid for a Go project)
- **Cross-Platform**: Tests run on both Ubuntu 24.04 and Windows 2022
- **Coverage Generation**: `go test -covermode=atomic -coverprofile=coverage.out`
- **Parallelism**: `-p 20` for test parallelism
- **Mocking**: Extensive use of mock objects (10+ mock directories)
- **Test Runner**: `gotestsum` with JSON output and rerun-fails support (upstream)

#### E2E Tests
- **Framework**: Custom Given/When/Then framework (`test/e2e/fixtures/`)
- **Test Files**: 49 E2E test files
- **Infrastructure**: K3S cluster provisioned in CI
- **Database Testing**: MySQL, Postgres profiles
- **K8s Version Testing**: v1.33 (min) and v1.35 (max)
- **Test Suites**: artifacts, executor, corefunctional, functional, api, metrics, tracing, telemetry, cli, cron, examples, plugins, SDK tests (Go + Java)
- **Retry Mechanism**: 2 retries by default, 0 for cron/examples/telemetry
- **Debugging**: Extensive failure debugging (K3S logs, pod logs, workflow descriptions)

#### UI Tests
- **Framework**: Jest/React testing
- **Test Files**: 22 test files
- **Coverage**: Tests for components, services, utilities
- **Build Validation**: UI build + startup check in CI

### Code Quality

#### Linting (Downstream vs Upstream)

| Aspect | Downstream | Upstream |
|--------|-----------|----------|
| Linters enabled | 18 | 42 |
| Revive rules | Not configured | 43 rules |
| Govet checks | Default | 35+ explicit checks |
| Formatter | gofmt + goimports | gofmt + goimports |
| Version | golangci-lint v2 | golangci-lint v2 |

**Missing downstream linters**: asciicheck, bidichk (partial), contextcheck, containedctx, copyloopvar (present), durationcheck, errorlint, exptostd, gocheckcompilerdirectives, gocritic, iface, iotamixing, mirror, modernize, nilerr, noctx, nolintlint, predeclared, revive, unconvert, usestdlibvars, usetesting, wastedassign, whitespace

#### Other Quality Tools
- **CodeRabbit**: Configured with golangci-lint, shellcheck, yamllint, markdownlint, actionlint
- **Pre-commit hooks**: Not configured
- **Markdownlint**: Configured (`.markdownlint.yaml`)
- **Spelling**: Custom dictionary (`.spelling`)
- **SHA-pinned actions**: Enforced via `zgosalvez/github-actions-ensure-sha-pinned-actions`

### Container Images

#### Upstream (Dockerfile)
- Multi-stage build with 7 stages
- Base: `golang:1.26.1-alpine3.23` (builder), `gcr.io/distroless/static-debian13` (runtime)
- Targets: argoexec, argoexec-nonroot, workflow-controller, argocli
- Build caching: `--mount=type=cache` for Go modules and build cache
- Non-root user (8737) for runtime images
- SHA-pinned base images

#### Downstream Konflux (Dockerfile.konflux)
- Base: `registry.access.redhat.com/ubi9/go-toolset:1.24` (builder), `registry.redhat.io/ubi9/ubi-minimal` (runtime)
- FIPS support: Dual binary build (standard + FIPS with `strictfipsruntime`)
- Red Hat labels for container metadata
- Non-root user (2000)
- SHA-pinned base images

#### Downstream ODH (Dockerfile.ODH)
- Separate Dockerfiles for ODH builds
- Uses `registry.redhat.io/ubi8/go-toolset:1.21` (older!)
- No FIPS binary

#### Downstream RHOAI (rhoai/)
- Separate Dockerfiles for RHOAI certification
- Uses `registry.redhat.io/ubi8/go-toolset:1.21`

**Gaps**:
- No runtime validation or startup testing
- No Trivy/vulnerability scanning in CI
- ODH/RHOAI Dockerfiles use UBI8 with Go 1.21 (very old)
- No image signing in downstream CI (upstream has cosign.pub)

### Security

| Practice | Status |
|----------|--------|
| Snyk dependency scanning | ✅ Daily + push (Go + Node) |
| Dependabot | ✅ Go, npm, pip, GH Actions, devcontainers |
| SHA-pinned actions | ✅ Enforced in CI |
| Cosign image signing | ✅ (upstream only) |
| OpenSSF Scorecard | ✅ (upstream) |
| OpenSSF Best Practices | ✅ (upstream) |
| SECURITY.md | ✅ Responsible disclosure via GitHub Security Advisories |
| CODEOWNERS | ✅ Configured |
| Permissions minimized | ✅ `contents: read` default |
| CodeQL/SAST | ❌ Not configured |
| Gitleaks/Secret Detection | ❌ Not configured |
| Trivy/Image Scanning | ❌ Not configured (images scanned externally via Snyk app) |
| SBOM Generation | ❌ Not configured |
| Pre-commit hooks | ❌ Not configured |

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **Test automation guidance**: None
- **Gaps**: Complete absence of AI-assisted development infrastructure
- **Coverage**: 0/7 test type rules
- **Recommendation**: Generate comprehensive rules with `/test-rules-generator` covering:
  - Go unit test patterns (testify, table-driven tests, mock usage)
  - E2E test patterns (Given/When/Then framework)
  - UI test patterns (Jest, React Testing Library)
  - PR requirements and conventions (semantic PR titles)
  - Linting and code style standards

## Recommendations

### Priority 0 (Critical)

1. **Sync downstream fork with upstream** — Go 1.24→1.26, module v3→v4, action versions, and missing workflows. The divergence is creating security and maintainability risk
2. **Enable PR-time coverage reporting** — Remove the `if: github.ref == 'refs/heads/main'` gate on codecov upload to provide coverage feedback during review
3. **Add container runtime validation** — After image build, run a startup smoke test to catch missing dependencies or broken entrypoints

### Priority 1 (High Value)

4. **Align downstream golangci-lint with upstream** — Add the 24 missing linters, particularly errorlint, gocritic, revive, and contextcheck
5. **Add CodeQL/SAST scanning** — Configure CodeQL for Go analysis on PRs
6. **Add secret detection** — Add Gitleaks to PR workflow
7. **Make Konflux builds automatic on PRs** — Remove comment/label gating, trigger on all PRs
8. **Update RHOAI/ODH Dockerfiles** — Move from UBI8/Go 1.21 to UBI9/Go 1.24+

### Priority 2 (Nice-to-Have)

9. **Create CLAUDE.md and .claude/rules/** — AI-assisted development guidance
10. **Add pre-commit hooks** — Enforce linting and formatting locally before push
11. **Add fuzz testing** — No fuzz tests exist despite security-sensitive YAML/JSON parsing
12. **Add Trivy scanning** — Container vulnerability scanning in CI
13. **Add SBOM generation** — Supply chain security for built images
14. **Enable image signing in downstream** — Extend cosign signing to Konflux builds

## Comparison to Gold Standards

| Dimension | argo-workflows (RH) | odh-dashboard | notebooks | kserve |
|-----------|---------------------|---------------|-----------|--------|
| Unit Test Coverage | 43% ratio, no enforcement | 80%+ enforced | N/A | 80%+ enforced |
| E2E Testing | Excellent (multi-DB, multi-K8s) | Good (Cypress) | Basic | Good |
| Coverage Tracking | Main-only upload | PR enforcement | N/A | PR enforcement |
| Image Testing | Build only, no runtime | Build + smoke | 5-layer validation | Build + deploy |
| Security Scanning | Snyk (daily) | Trivy + CodeQL | Trivy | Trivy + CodeQL |
| Agent Rules | None | Comprehensive | None | Partial |
| Linting | 18 linters (downstream) | ESLint + Stylelint | N/A | golangci-lint |
| PR Coverage Report | No | Yes | N/A | Yes |
| Secret Detection | No | Yes (Gitleaks) | No | No |
| FIPS Support | Yes (Konflux) | No | No | No |

## File Paths Reference

### CI/CD
- `.github/workflows/ci-build.yaml` — Main CI pipeline (unit, E2E, lint, codegen, UI)
- `.github/workflows/build-main.yml` — ODH image build and push
- `.github/workflows/snyk.yml` — Security scanning
- `.tekton/` — Konflux pipeline definitions (synced from konflux-central)
- `Makefile` — Build, test, and development targets

### Testing
- `test/e2e/` — E2E test suite (49 files)
- `test/e2e/fixtures/` — Custom Given/When/Then framework
- `workflow/controller/controller_test.go` — Example unit test
- `ui/src/**/*.test.{ts,tsx}` — UI tests (22 files)

### Code Quality
- `.golangci.yml` — Go linter configuration (18 linters downstream)
- `.coderabbit.yaml` — CodeRabbit review bot configuration
- `.markdownlint.yaml` — Markdown linting rules
- `.spelling` — Custom spelling dictionary

### Container Images
- `Dockerfile` — Upstream multi-stage Dockerfile
- `argo-argoexec/Dockerfile.konflux` — Downstream Konflux argoexec (UBI9, FIPS)
- `argo-argoexec/Dockerfile.ODH` — ODH argoexec build
- `argo-workflowcontroller/Dockerfile.konflux` — Downstream Konflux workflow-controller
- `rhoai/Dockerfile.argoexec` — RHOAI argoexec build
- `rhoai/Dockerfile.workflowcontroller` — RHOAI workflow-controller build

### Coverage & Security
- `.codecov.yml` — Codecov configuration (2% threshold, patch off)
- `.github/dependabot.yml` — Dependabot for Go, npm, pip, GH Actions
- `SECURITY.md` — Vulnerability disclosure policy
- `cosign.pub` — Image signing public key (upstream)
- `CODEOWNERS` — Code ownership (minimal downstream)
- `renovate.json` — Renovate config (extends konflux-central)
