---
repository: "argoproj/argo-workflows"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "286 Go test files + 22 UI test files; Go coverage generated with coverprofile; testify + gotestsum; Windows cross-platform unit tests"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Comprehensive 16-matrix E2E suite on K3S with MySQL/Postgres profiles, multi-K8s-version testing, SDK tests (Go + Java), retry support"
  - dimension: "Build Integration"
    score: 5.0
    status: "PR-time Docker image builds (argoexec, argocli) but no Konflux simulation; manifest validation via make manifests-validate; no image startup testing"
  - dimension: "Image Testing"
    score: 6.0
    status: "Multi-stage Dockerfile with distroless base; buildx caching; multi-arch (amd64/arm64); Windows images; post-release pull tests; no runtime validation on PR"
  - dimension: "Coverage Tracking"
    score: 6.0
    status: "Codecov integration on main only (disabled on PRs); 2% threshold tolerance; generated files excluded; no PR coverage gates"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "Smart changed-file detection; concurrency control; parallelized builds; comprehensive release pipeline with cosign signing and SBOM; dependabot auto-merge"
  - dimension: "Agent Rules"
    score: 1.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory; no AI agent test creation guidance"
critical_gaps:
  - title: "No PR-level coverage enforcement"
    impact: "Coverage can silently regress on PRs since Codecov only reports on main branch pushes"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container runtime validation on PRs"
    impact: "Docker images built on PR but never started or functionally validated; startup failures only caught in E2E or post-deploy"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No CodeQL or SAST integration"
    impact: "Static application security testing is absent; only Snyk dependency scanning on main/schedule (not PRs)"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No agent rules for test automation"
    impact: "AI-assisted development has no guardrails for test patterns, leading to inconsistent quality"
    severity: "LOW"
    effort: "3-4 hours"
quick_wins:
  - title: "Enable Codecov on PRs with patch coverage threshold"
    effort: "1-2 hours"
    impact: "Prevent coverage regression on every PR"
  - title: "Add CodeQL analysis workflow"
    effort: "1-2 hours"
    impact: "Catch security vulnerabilities in Go and JavaScript code automatically"
  - title: "Add container startup smoke test in CI"
    effort: "2-3 hours"
    impact: "Verify built images can start successfully before E2E tests"
  - title: "Create basic agent rules for unit test patterns"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality and consistency"
recommendations:
  priority_0:
    - "Enable Codecov patch coverage on PRs with a minimum threshold (e.g., 60%) to catch regressions before merge"
    - "Add CodeQL/SAST workflow for Go and JavaScript scanning on PRs"
    - "Run Snyk scanning on PRs (currently only on main/schedule) to catch vulnerabilities before merge"
  priority_1:
    - "Add container image startup validation in the argo-images CI job to verify images boot correctly"
    - "Add pre-commit hook configuration (.pre-commit-config.yaml) for local linting and formatting"
    - "Create .claude/rules/ with unit test, E2E test, and integration test patterns for AI agents"
  priority_2:
    - "Add Trivy or Grype scanning for container image vulnerabilities"
    - "Consider adding performance/benchmark tests for controller hot paths"
    - "Add API contract testing between server and UI components"
---

# Quality Analysis: argoproj/argo-workflows

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Kubernetes workflow engine (Go backend + React UI)
- **Primary Languages**: Go (666 source files), TypeScript/React (269 UI files)
- **Key Strengths**: Exceptional E2E testing with 16-matrix suite, smart CI with changed-file detection, excellent release pipeline with cosign signing and SBOM generation, cross-platform (Linux/Windows) testing
- **Critical Gaps**: No PR-level coverage enforcement, no CodeQL/SAST integration, no container runtime validation, no AI agent rules
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.0/10 | 286 Go + 22 UI test files; coverage generation; cross-platform |
| Integration/E2E | 9.0/10 | 16-matrix E2E suite; multi-DB; multi-K8s version; SDK tests |
| **Build Integration** | **5.0/10** | **PR Docker builds but no Konflux simulation or startup tests** |
| Image Testing | 6.0/10 | Multi-arch builds; distroless base; post-release pull tests |
| Coverage Tracking | 6.0/10 | Codecov on main only; no PR gates; 2% threshold |
| CI/CD Automation | 9.0/10 | Smart file detection; concurrency; cosign; SBOM; dependabot |
| Agent Rules | 1.0/10 | No CLAUDE.md, AGENTS.md, or .claude/ directory |

## Critical Gaps

### 1. No PR-Level Coverage Enforcement
- **Impact**: Coverage can silently regress on PRs since Codecov only uploads on `main` branch pushes. The CI comment explicitly states: "engineers just ignore this in PRs, so lets not even run it."
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Evidence**: `.github/workflows/ci-build.yaml` lines 141-145: coverage upload conditional on `github.ref == 'refs/heads/main'`
- **Fix**: Enable `codecov-action` on PRs with `fail_ci_if_error: false` and set patch coverage thresholds in `.codecov.yml`

### 2. No CodeQL or SAST Integration
- **Impact**: No static application security testing is performed. Only Snyk dependency scanning runs on `main` and scheduled (not on PRs).
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Evidence**: No `codeql*.yml` workflow exists in `.github/workflows/`. Snyk runs on `push: main` and `schedule` only.
- **Fix**: Add a CodeQL workflow scanning Go and JavaScript, triggered on PRs

### 3. No Container Runtime Validation on PRs
- **Impact**: The `argo-images` CI job builds Docker images (`argoexec`, `argocli`) and uploads tarballs but never verifies they start correctly. Startup failures are only caught during E2E tests.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Evidence**: `.github/workflows/ci-build.yaml` lines 200-228: images built and uploaded but no startup test

### 4. Security Scanning Not on PRs
- **Impact**: Snyk dependency scanning only runs on `main` pushes and a daily schedule. Vulnerable dependencies can be merged without detection.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Evidence**: `.github/workflows/snyk.yml` only triggers on `push: main/release-*` and `schedule`

## Quick Wins

### 1. Enable Codecov on PRs
- **Effort**: 1-2 hours
- **Impact**: Catch coverage regressions before merge
- **Implementation**: Remove the `if: github.ref == 'refs/heads/main'` condition from the coverage upload step and update `.codecov.yml`:
```yaml
coverage:
  status:
    patch:
      default:
        target: 60%
    project:
      default:
        threshold: 2
```

### 2. Add CodeQL Workflow
- **Effort**: 1-2 hours
- **Impact**: Automatic security scanning for Go and JavaScript
- **Implementation**: Create `.github/workflows/codeql.yml`:
```yaml
name: CodeQL
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  schedule:
    - cron: '30 4 * * 1'
permissions:
  security-events: write
jobs:
  analyze:
    runs-on: ubuntu-24.04
    strategy:
      matrix:
        language: [go, javascript]
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

### 3. Add Container Startup Smoke Test
- **Effort**: 2-3 hours
- **Impact**: Verify built images boot successfully before E2E
- **Implementation**: Add a step to the `argo-images` job:
```yaml
- name: Smoke test image
  run: |
    docker load < /tmp/${{matrix.image}}_image.tar
    docker run --rm quay.io/argoproj/${{matrix.image}}:latest --help || \
    docker run --rm quay.io/argoproj/${{matrix.image}}:latest version
```

### 4. Create Basic Agent Rules
- **Effort**: 2-3 hours
- **Impact**: Consistent AI-generated test quality
- **Implementation**: Run `/test-rules-generator` to create `.claude/rules/` with unit test and E2E test patterns

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory** (14 total):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci-build.yaml` | PR + push (main, release-*) | Unit tests, lint, E2E, codegen, UI, images |
| `pr.yaml` | PR | Semantic PR title check |
| `pr-feature.yaml` | PR | Feature file validation for feat PRs |
| `snyk.yml` | push (main) + schedule | Dependency vulnerability scanning |
| `release.yaml` | tags + push (main, dev-*) | Multi-arch builds, signing, SBOM, releases |
| `docs.yaml` | PR + push (main) | Documentation build and lint |
| `dependabot-reviewer.yml` | PR | Auto-approve/merge dependabot PRs |
| `stale.yaml` | - | Stale issue management |
| `changelog.yaml` | - | Changelog generation |
| `cherry-pick.yml` | - | Automated cherry-picking |
| `sdks.yaml` | - | SDK-related workflows |
| `devcontainer.yaml` | - | Dev container build |
| `retest.yaml` | - | Manual retest trigger |

**Strengths**:
- Smart changed-file detection using `tj-actions/changed-files` with YAML-based file groups — tests only run when relevant files change
- Concurrency control with cancel-in-progress on all major workflows
- SHA-pinned GitHub Actions across all workflows (enforced by `zgosalvez/github-actions-ensure-sha-pinned-actions`)
- Comprehensive E2E matrix with 16 configurations covering multiple database profiles, K8s versions, and test suites
- Excellent failure debugging with k3s logs, pod descriptions, and workflow pod logs
- Release pipeline includes cosign signing, SBOM generation, and multi-platform manifests

**Gaps**:
- No CodeQL/SAST workflow
- Snyk only on main/schedule, not PRs
- No nightly/periodic quality gate workflow

### Test Coverage

**Unit Tests (Go)**:
- **286 test files** across the codebase
- Framework: `testify` (assertions + suites) + `gotestsum` (test runner with retries and JSON output)
- Coverage: `go test -covermode=atomic -coverprofile=coverage.out`
- Parallelism: `-p 20` (20 parallel packages)
- Cross-platform: Dedicated Windows unit test job on `windows-2022`
- Mocking: `go.uber.org/mock` (uber mock library)
- Component breakdown:
  - `workflow/`: 130 test files (controller, executor)
  - `test/`: 55 test files (E2E + fixtures)
  - `server/`: 30 test files (API server)
  - `cmd/`: 21 test files (CLI)
  - `pkg/`: 20 test files (APIs, client)

**Unit Tests (UI)**:
- **22 test files** in `ui/src/`
- Framework: Jest
- Tests cover: workflow services, components, utils, history, pod naming, login, event flow
- Run as part of `yarn --cwd ui test` in the `ui` CI job

**E2E Tests**:
- **49 test files** in `test/e2e/`
- Framework: Go testify suites with custom `fixtures.E2ESuite`
- K8s cluster: K3S with Docker runtime
- **16 matrix configurations**:
  - Profiles: `minimal`, `mysql`, `postgres`, `plugins`, `telemetry`, `telemetry-stack`
  - K8s versions: min and max
  - Test suites: artifacts, executor, corefunctional, functional, api, metrics, tracing, telemetry, cli, cron, examples, plugins, go-sdk, java-sdk, dbsemaphore
- Retries: `rerun-fails` with configurable retry count (default 2, some tests 0)
- Test results uploaded as JSON artifacts with 10-day retention

**Test-to-Code Ratio**:
- Go: 286 test files / 666 source files = 0.43 (moderate)
- UI: 22 test files / 269 source files = 0.08 (low)

### Code Quality

**Go Linting** (`.golangci.yml` - v2 config):
- **35+ linters enabled** including: `gosec`, `govet`, `errorlint`, `staticcheck`, `revive`, `bodyclose`, `contextcheck`, `noctx`, `ineffassign`, `unconvert`, `unparam`, `unused`, `wastedassign`, `misspell`, `modernize`, `usetesting`
- Formatters: `gofmt`, `goimports` with local prefix ordering
- Custom `revive` rules: 25+ rules including data race detection, atomic operations, defer handling
- `govet` with 40+ enabled analyzers including `shadow`, `nilness`, `waitgroup`
- `gosec` with selective rule inclusion (G304, G307)
- `staticcheck` with all checks enabled
- Exclusions: Generated files, vendor, docs, examples, pkg/client

**UI Linting**:
- ESLint with `--fix` flag
- TypeScript `--noEmit` type checking
- `yarn deduplicate` check (fails build if dedup makes changes)

**Documentation Quality**:
- Markdownlint (`.markdownlint.yaml`) with customized rules
- Markdown link checker (`.mlc_config.json`) for broken links
- Spelling check via docs workflow
- mkdocs-based documentation build

**Pre-commit Hooks**:
- No `.pre-commit-config.yaml` found
- `make pre-commit` target exists (runs codegen, lint, docs) but no git hook enforcement
- **Gap**: Local development doesn't enforce quality before commit

### Container Images

**Dockerfile Analysis**:
- Multi-stage build with 8 stages (builder, argo-ui, argoexec-build, workflow-controller-build, argocli-build, argoexec-base, argoexec-nonroot, argoexec, workflow-controller, argocli)
- Base image: `gcr.io/distroless/static-debian13` with pinned SHA digest
- Non-root execution: User `8737` for most targets
- Build caching: `--mount=type=cache` for Go modules and build cache
- `Dockerfile.windows` for Windows container support
- BuildKit syntax directive: `#syntax=docker/dockerfile:1.22`

**Multi-Architecture**:
- Linux: amd64, arm64
- Windows: amd64
- CLI cross-compilation: amd64, arm64, ppc64le, riscv64, s390x (darwin: amd64, arm64)

**Release Pipeline Image Testing**:
- Post-push pull tests for linux/amd64 and windows
- Cosign signing of all images
- SBOM generation using `bom` and `spdx-sbom-generator`

**Gaps**:
- No Trivy/Grype vulnerability scanning of built images
- No image startup validation on PRs (only post-release pull tests)
- No image size tracking or optimization checks

### Security

**Strengths**:
- Snyk dependency scanning for Go and Node (severity threshold: high)
- Dependabot with weekly updates for gomod, npm, GitHub Actions, and Docker
- Automated dependabot PR approval and auto-merge
- SHA-pinned GitHub Actions (enforced in lint)
- Cosign image signing on releases
- SBOM generation for all released images
- Minimal `permissions: contents: read` across workflows
- Distroless base images (minimal attack surface)

**Gaps**:
- No CodeQL or SAST integration
- No secret detection (Gitleaks, TruffleHog)
- Snyk only on main/schedule, not on PRs
- No `.trivyignore` or container scanning
- `gosec` in golangci-lint is limited to only 2 rules (G304, G307)

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None - no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**:
  - No unit test creation rules with patterns for testify suites
  - No E2E test rules with `fixtures.E2ESuite` patterns
  - No guidance on mock usage (`go.uber.org/mock`)
  - No UI test rules for Jest/React component testing
  - No integration test patterns for K3S/K8s testing
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - Go unit tests with testify assertions
  - E2E test fixtures and suite patterns
  - UI component tests with Jest
  - Mock generation and usage patterns

## Recommendations

### Priority 0 (Critical)

1. **Enable Codecov on PRs** - Remove the `main`-only condition for coverage uploads and set patch coverage thresholds. Currently engineers "ignore this in PRs" by design, but this means coverage can regress silently.

2. **Add CodeQL/SAST workflow** - No static security analysis exists. Add CodeQL for Go and JavaScript scanning on PRs. This is table-stakes for a CNCF project of this scale.

3. **Run Snyk on PRs** - Security scanning currently only runs on main pushes and daily schedule. Move to PR-triggered scanning to catch vulnerabilities before merge.

### Priority 1 (High Value)

4. **Add container image startup validation** - The `argo-images` CI job builds images but never tests they can start. Add a smoke test step to verify basic functionality.

5. **Add pre-commit hook configuration** - Create `.pre-commit-config.yaml` with golangci-lint, gofmt, and goimports hooks for local development quality enforcement.

6. **Create agent rules** - Add `.claude/rules/` with patterns for unit tests (testify), E2E tests (fixtures.E2ESuite), UI tests (Jest), and mock usage to guide AI-assisted development.

7. **Expand gosec rules** - Currently only G304 and G307 are enabled. Consider enabling more security-focused rules or switching to a broader SAST tool.

### Priority 2 (Nice-to-Have)

8. **Add Trivy/Grype container image scanning** - While Snyk covers dependencies, no tool scans the actual container images for OS-level vulnerabilities.

9. **Add performance/benchmark tests** - For controller hot paths (workflow processing, node completion) to catch performance regressions.

10. **Improve UI test coverage** - With only 22 test files for 269 source files (0.08 ratio), the UI is significantly under-tested compared to the Go backend.

11. **Add API contract tests** - Between the server API and UI to prevent breaking changes at the interface boundary.

12. **Track image size in CI** - Monitor container image sizes and fail if they exceed thresholds to prevent bloat.

## Comparison to Gold Standards

| Dimension | argo-workflows | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit Tests | 8.0 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 9.0 | 9.0 | 8.0 | 9.0 |
| Build Integration | 5.0 | 8.0 | 7.0 | 6.0 |
| Image Testing | 6.0 | 7.0 | 9.0 | 7.0 |
| Coverage Tracking | 6.0 | 9.0 | 6.0 | 9.0 |
| CI/CD Automation | 9.0 | 9.0 | 8.0 | 8.0 |
| Agent Rules | 1.0 | 8.0 | 3.0 | 2.0 |
| **Overall** | **7.6** | **8.7** | **7.1** | **7.6** |

**Key Differentiators**:
- argo-workflows excels at E2E testing (16-matrix suite) and CI automation (smart file detection, cosign, SBOM)
- Falls behind on PR-level quality gates (coverage, security scanning)
- Missing agent rules is common across non-Red Hat projects but addressable

## File Paths Reference

### CI/CD
- `.github/workflows/ci-build.yaml` - Main CI (tests, lint, E2E, images)
- `.github/workflows/pr.yaml` - PR title check
- `.github/workflows/pr-feature.yaml` - Feature file validation
- `.github/workflows/snyk.yml` - Snyk dependency scanning
- `.github/workflows/release.yaml` - Release pipeline
- `.github/workflows/docs.yaml` - Documentation build/lint
- `.github/workflows/dependabot-reviewer.yml` - Dependabot auto-merge
- `.github/dependabot.yml` - Dependabot configuration

### Testing
- `test/e2e/` - 49 E2E test files (Go testify suites)
- `workflow/` - 130 unit test files
- `server/` - 30 unit test files
- `cmd/` - 21 unit test files
- `ui/src/` - 22 UI test files (Jest)
- `sdks/java/tests/` - Java SDK tests

### Code Quality
- `.golangci.yml` - Go linting (35+ linters, v2 config)
- `.markdownlint.yaml` - Markdown linting
- `.mlc_config.json` - Markdown link checker
- `Makefile` - Build, test, lint targets

### Container Images
- `Dockerfile` - Multi-stage (8 stages), distroless base
- `Dockerfile.windows` - Windows container support
- `.dockerignore` - Docker build exclusions

### Coverage
- `.codecov.yml` - Codecov config (main-only, 2% threshold)

### Security
- `.github/workflows/snyk.yml` - Snyk scanning
- `.github/dependabot.yml` - Dependabot config
- `go.sum` - Dependency checksums
