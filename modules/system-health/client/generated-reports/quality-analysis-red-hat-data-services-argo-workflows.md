---
repository: "red-hat-data-services/argo-workflows"
overall_score: 6.4
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "207 test files, 1034 test functions, strong Go testify usage, 38% test-to-code ratio by LOC"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "29 E2E test files with 285 test functions, multi-profile matrix (minimal/mysql/plugins), K3S-based, multi-K8s-version testing"
  - dimension: "Build Integration"
    score: 5.0
    status: "PR builds Docker images and runs E2E against K3S, but no Konflux simulation at PR time; Konflux builds are label/comment triggered only"
  - dimension: "Image Testing"
    score: 4.5
    status: "Images built on PR but no runtime validation, no startup testing, no Trivy/vulnerability scanning"
  - dimension: "Coverage Tracking"
    score: 5.5
    status: "Codecov configured with 2% threshold, but coverage only uploaded on main (not on PRs), patch coverage disabled"
  - dimension: "CI/CD Automation"
    score: 7.5
    status: "Well-organized workflows with smart changed-file filtering, concurrency control, matrix E2E strategy, Tekton/Konflux for RHOAI builds"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules for test patterns"
critical_gaps:
  - title: "No container vulnerability scanning"
    impact: "Security vulnerabilities in container images are not detected before merge or release in the downstream fork"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No PR-time coverage reporting"
    impact: "Coverage regressions are invisible during code review; codecov only runs on main branch pushes"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No pre-commit hooks"
    impact: "Code quality checks only run in CI, allowing poorly-formatted or lint-failing code to be committed"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No image runtime validation"
    impact: "Built images are not tested for startup/health, issues only found during deployment"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Snyk scanning only runs on upstream repo"
    impact: "Fork (red-hat-data-services) never runs Snyk because of 'if: github.repository == argoproj/argo-workflows' guard"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "Konflux builds only triggered by label/comment"
    impact: "Konflux build failures are not caught automatically on every PR; rely on manual trigger"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Enable codecov on PRs (not just main)"
    effort: "30 minutes"
    impact: "Developers see coverage impact during review, catch regressions before merge"
  - title: "Remove upstream-only guards from Snyk workflow"
    effort: "30 minutes"
    impact: "Enable security scanning on the downstream fork"
  - title: "Add Trivy container scanning to CI"
    effort: "1-2 hours"
    impact: "Catch CVEs in container images before merge"
  - title: "Add pre-commit hooks with golangci-lint"
    effort: "1-2 hours"
    impact: "Catch lint/format issues before push, faster feedback loop"
  - title: "Create basic agent rules for test patterns"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality and consistency"
recommendations:
  priority_0:
    - "Remove 'if: github.repository == argoproj/argo-workflows' guards from Snyk workflow to enable security scanning on the fork"
    - "Enable codecov coverage reporting on PRs, not just main branch pushes"
    - "Add container vulnerability scanning (Trivy) to PR and main workflows"
  priority_1:
    - "Add image startup validation after Docker build in CI (health check endpoint, binary execution test)"
    - "Enable automatic Konflux PR builds instead of label/comment-only triggers"
    - "Add pre-commit hooks configuration (.pre-commit-config.yaml) for Go formatting and linting"
    - "Increase UI test coverage (currently 11 test files for 239 source files = 4.6% file coverage)"
  priority_2:
    - "Create comprehensive agent rules (.claude/rules/) for unit test, E2E test, and integration test patterns"
    - "Add SBOM generation for downstream RHOAI images (upstream has it for release only)"
    - "Enable CodeQL or gosec as standalone SAST workflow for the fork"
    - "Add contract testing between workflow controller and argoexec components"
---

# Quality Analysis: red-hat-data-services/argo-workflows

## Executive Summary

- **Overall Score: 6.4/10**
- **Repository Type**: Go-based Kubernetes workflow engine (Argo Workflows fork for Red Hat OpenShift AI / Data Science Pipelines)
- **Primary Languages**: Go (backend, ~162K LOC), TypeScript/React (UI, ~239 source files)
- **Key Strengths**: Comprehensive E2E test matrix with K3S, smart changed-file CI filtering, well-structured golangci-lint config, Konflux integration for RHOAI builds
- **Critical Gaps**: No container vulnerability scanning on fork, coverage not reported on PRs, no image runtime validation, Snyk guards prevent scanning on fork
- **Agent Rules Status**: Missing - No CLAUDE.md, no .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | 207 test files, 1034 test functions, testify framework |
| Integration/E2E | 8.0/10 | 29 E2E files, 285 functions, multi-profile K3S matrix |
| **Build Integration** | **5.0/10** | **PR builds images but no Konflux simulation** |
| Image Testing | 4.5/10 | Images built but no runtime/vulnerability validation |
| Coverage Tracking | 5.5/10 | Codecov present but disabled on PRs |
| CI/CD Automation | 7.5/10 | Smart filtering, concurrency, matrix strategy |
| Agent Rules | 0.0/10 | No agent rules exist |

## Critical Gaps

### 1. No Container Vulnerability Scanning on Fork
- **Impact**: Security vulnerabilities in container images are not detected before merge on the `red-hat-data-services` fork
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The upstream Snyk workflow has `if: github.repository == 'argoproj/argo-workflows'` guards that prevent it from running on the fork. There is no Trivy, Grype, or other scanner configured independently.

### 2. Coverage Not Reported on PRs
- **Impact**: Coverage regressions are invisible during code review
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: The CI workflow generates `coverage.out` on PRs but only uploads to Codecov on `main`. The comment in the workflow says "engineers just ignore this in PRs, so lets not even run it." Patch coverage is also explicitly disabled in `.codecov.yml`.

### 3. No Image Runtime Validation
- **Impact**: Built images are not tested for startup, health, or basic functionality before E2E tests load them
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The `argo-images` job builds argoexec and argocli images and uploads them as artifacts, but there is no validation step (startup test, entrypoint check, health probe) between build and E2E consumption.

### 4. Snyk Scanning Disabled on Fork
- **Impact**: Go and Node dependency vulnerability scanning never runs on `red-hat-data-services/argo-workflows`
- **Severity**: HIGH
- **Effort**: 30 minutes (remove or update the `if` guard)
- **Details**: `.github/workflows/snyk.yml` uses `if: github.repository == 'argoproj/argo-workflows'` on both the `golang` and `node` jobs.

### 5. Konflux Builds Only Triggered by Label/Comment
- **Impact**: Konflux build failures are not caught automatically on every PR
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: Tekton PipelineRuns in `.tekton/` use `on-comment: "^/build-konflux workflowcontroller"` and `on-label` triggers. This means Konflux builds require manual action and are easy to skip.

### 6. No Pre-commit Hooks
- **Impact**: Lint and format errors are only caught in CI, not at commit time
- **Severity**: MEDIUM
- **Effort**: 1-2 hours

## Quick Wins

### 1. Enable Codecov on PRs (30 minutes)
Remove the `if: github.ref == 'refs/heads/main'` condition from the coverage upload step in `ci-build.yaml`:
```yaml
- name: Upload coverage report
  uses: codecov/codecov-action@84508663e988701840491b86de86b666e8a86bed
  with:
    fail_ci_if_error: true
  env:
    CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}
```

### 2. Remove Upstream-Only Guards from Snyk (30 minutes)
Update `.github/workflows/snyk.yml` to remove or change:
```yaml
# Before:
if: github.repository == 'argoproj/argo-workflows'
# After (remove or update):
if: true
```

### 3. Add Trivy Container Scanning (1-2 hours)
Add to `.github/workflows/ci-build.yaml` after image build:
```yaml
- name: Scan image with Trivy
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: quay.io/argoproj/${{matrix.image}}:latest
    format: 'sarif'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'
```

### 4. Add Pre-commit Hooks (1-2 hours)
Create `.pre-commit-config.yaml`:
```yaml
repos:
  - repo: https://github.com/golangci/golangci-lint
    rev: v2.1.6
    hooks:
      - id: golangci-lint
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
```

### 5. Create Basic Agent Rules (2-3 hours)
Generate test automation rules with `/test-rules-generator` to create `.claude/rules/` with Go and TypeScript test patterns.

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory** (11 workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci-build.yaml` | PR + push (main, stable, rhoai-*) | Unit tests, lint, codegen, E2E, UI, image builds |
| `build-main.yml` | push (main) + dispatch | Build & push ODH images to Quay |
| `pr.yaml` | pull_request_target | PR title semantic check |
| `release.yaml` | tags (v*) + push (main) | Multi-arch build, cosign signing, SBOM, release |
| `snyk.yml` | scheduled (daily) + push (main) | Go + Node dependency scanning (upstream only) |
| `dependabot-reviewer.yml` | pull_request | Auto-approve and merge dependabot PRs |
| `docs.yaml` | Push/PR | Documentation build |
| `sdks.yaml` | Push/PR | SDK generation/validation |
| `changelog.yaml` | Push | Changelog generation |
| `stale.yaml` | Scheduled | Stale issue/PR management |
| `retest.yaml` | issue_comment | `/retest` support |

**Strengths**:
- Smart changed-file detection using `tj-actions/changed-files` to skip irrelevant CI jobs
- Concurrency control with `cancel-in-progress: true`
- Matrix E2E strategy with 12 combinations (executor, core, functional, API, CLI, cron, examples, plugins, SDKs, multi-K8s-version)
- GHA SHA pinning enforced via `zgosalvez/github-actions-ensure-sha-pinned-actions`
- Docker layer caching with GHA cache

**Weaknesses**:
- Windows unit tests disabled (`if: false`) due to FIPS requirements
- No CodeQL or SAST workflow
- Security scanning (Snyk) has upstream-only guards
- Konflux builds require manual trigger

**Tekton/Konflux Integration**:
- 2 Tekton PipelineRuns for workflowcontroller and argoexec PR builds
- Multi-arch builds (x86_64, arm64, ppc64le)
- Hermetic builds with prefetch for gomod and rpm
- Source image generation enabled
- But trigger requires label (`kfbuild-all/kfbuild-workflowcontroller`) or comment (`/build-konflux`)

### Test Coverage

**Go Unit Tests**:
- 207 test files (excluding E2E) with 1,034 test functions
- ~61,718 lines of test code for ~161,741 lines of source code (38% ratio)
- Framework: Go's built-in `testing` package + `stretchr/testify` (assert/require)
- Mocking: Fake implementations (not gomock/mockgen)
- Coverage generation: `go test -covermode=atomic -coverprofile=coverage.out`
- Key coverage areas: workflow controller, server, util, persist, pkg, cmd

**E2E Tests**:
- 29 test files with 285 test functions (~10,960 LOC)
- Infrastructure: K3S with custom fixtures framework (given/when/then pattern)
- Multi-profile: minimal, mysql, postgres, plugins, sso
- Multi-K8s-version: min + max version testing
- Test parallelism: 20 concurrent tests, 15-20m suite timeout
- Coverage areas: executor, workflow lifecycle, artifacts, hooks, cron, CLI, server API, SDK clients

**UI Tests**:
- Only 11 test files for 239 source files (4.6% file coverage)
- Framework: Jest
- Coverage areas: shared utilities, services, components (very sparse)
- TypeScript with React

**Missing**:
- No envtest usage (Kubernetes controller-runtime envtest)
- No contract tests between components
- No performance/load tests in CI
- Very low UI test coverage

### Code Quality

**Linting** (golangci-lint v2):
- 18 linters enabled including `gosec`, `staticcheck`, `errcheck`, `bodyclose`, `testifylint`
- Build tags for all test suites: api, cli, cron, executor, examples, corefunctional, functional, plugins
- Formatters: `gofmt`, `goimports` with local prefix enforcement
- Extensive exclusion paths (vendor, docs, examples, hack, UI)
- Custom gosec rules (G304, G307 only)

**UI Linting**:
- ESLint configured (run via `yarn lint` in CI)
- TypeScript strict mode via `tsconfig.json`

**Other Quality Tools**:
- `.markdownlint.yaml` for documentation
- `.mlc_config.json` for markdown link checking
- `.spelling` word list
- Renovate for dependency updates (extends konflux-central config)
- Dependabot auto-merge for upstream

**Missing**:
- No `.pre-commit-config.yaml`
- No standalone SAST (CodeQL/Semgrep)
- No secret detection (Gitleaks/TruffleHog)

### Container Images

**Dockerfiles** (8 total):
- `Dockerfile` - Upstream multi-stage (argoexec, argocli, workflow-controller targets)
- `Dockerfile.windows` - Windows argoexec build
- `argo-workflowcontroller/Dockerfile.konflux` - Konflux build (UBI9, go-toolset 1.26.3, FIPS-enabled)
- `argo-workflowcontroller/Dockerfile.ODH` - ODH community build
- `argo-argoexec/Dockerfile.konflux` - Konflux argoexec build (UBI9, FIPS-enabled)
- `argo-argoexec/Dockerfile.ODH` - ODH community argoexec
- `rhoai/Dockerfile.workflowcontroller` - RHOAI build (UBI8, older go-toolset 1.21)
- `rhoai/Dockerfile.argoexec` - RHOAI argoexec

**Build Practices**:
- Multi-stage builds throughout
- UBI base images for RHOAI/Konflux
- FIPS compliance: `GOFIPS140=v1.0.0`, `CGO_ENABLED=0`, `-tags no_openssl`
- Non-root user execution (user 8737 for controller, 2000 for argoexec)
- Docker layer caching in CI
- Multi-arch: amd64, arm64 (upstream), + ppc64le (Konflux)

**Security**:
- Cosign image signing in upstream release workflow
- SBOM generation (spdx/bom) in upstream release
- Image digest pinning in Konflux Dockerfiles

**Missing**:
- No Trivy/vulnerability scanning in any workflow
- No image startup validation
- No SBOM for downstream RHOAI builds
- RHOAI Dockerfiles use older UBI8 + go-toolset 1.21 (may be stale)
- No `.trivyignore` or vulnerability allowlist

### Security

**Present**:
- Snyk dependency scanning (Go + Node) - but upstream-only
- Cosign image signing (upstream releases)
- SBOM generation (upstream releases)
- GHA SHA pinning enforcement
- Renovate for dependency updates
- gosec linter enabled in golangci-lint (limited rules: G304, G307)
- Dependabot auto-merge with metadata validation

**Missing**:
- No container image scanning (Trivy/Grype/Snyk Container)
- No CodeQL/SAST workflow
- No secret detection (Gitleaks/TruffleHog)
- No SBOM for downstream RHOAI/Konflux images
- Snyk workflow disabled on fork (`if: github.repository == 'argoproj/argo-workflows'`)
- Limited gosec coverage (only 2 rules enabled)

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None - no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: Complete absence of agent rules for any test type
- **Recommendation**: Generate rules with `/test-rules-generator` covering:
  - Go unit test patterns (testify assertions, table-driven tests)
  - E2E test patterns (given/when/then fixtures, K3S setup)
  - UI test patterns (Jest, React component testing)
  - Controller test patterns (workflow operator testing)

## Recommendations

### Priority 0 (Critical)

1. **Remove upstream-only guards from Snyk workflow** - The `if: github.repository == 'argoproj/argo-workflows'` condition in `.github/workflows/snyk.yml` prevents security scanning on the fork. Either remove it or create a fork-specific security scanning workflow.

2. **Enable codecov coverage on PRs** - Remove the `if: github.ref == 'refs/heads/main'` guard in `ci-build.yaml` so developers see coverage impact during review.

3. **Add container vulnerability scanning** - Add Trivy or Grype scanning to the `argo-images` job in `ci-build.yaml` to catch CVEs before E2E tests consume the images.

### Priority 1 (High Value)

4. **Add image startup validation** - After building argoexec and argocli images, add a step to verify the entrypoint works (`docker run --entrypoint /bin/argoexec image --help`).

5. **Enable automatic Konflux PR builds** - Change Tekton PipelineRun triggers from label/comment-only to `on-event: "[pull_request]"` so Konflux builds run on every PR.

6. **Add pre-commit hooks** - Create `.pre-commit-config.yaml` with golangci-lint, go fmt, and basic file hygiene hooks.

7. **Increase UI test coverage** - From 4.6% (11/239 files) to at least 30%. Focus on shared components, services, and critical user flows.

### Priority 2 (Nice-to-Have)

8. **Create comprehensive agent rules** - Use `/test-rules-generator` to generate `.claude/rules/` covering Go unit tests, E2E tests, and React component tests.

9. **Add SBOM generation for RHOAI images** - Upstream has SBOM for releases; extend to downstream Konflux/RHOAI images.

10. **Enable CodeQL or expand gosec coverage** - Add a standalone CodeQL workflow or enable more gosec rules beyond G304/G307.

11. **Update RHOAI Dockerfiles** - `rhoai/Dockerfile.workflowcontroller` uses UBI8 + go-toolset 1.21 while Konflux Dockerfiles use UBI9 + go-toolset 1.26.3. This may be stale.

12. **Add contract testing** - Test the interface between workflow-controller and argoexec to catch breaking changes in the protocol.

## Comparison to Gold Standards

| Dimension | argo-workflows | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit Tests | 7.5 (207 files, testify) | 9.0 (Jest+RTL, high coverage) | 6.0 (limited) | 8.5 (high coverage, envtest) |
| Integration/E2E | 8.0 (K3S matrix, multi-profile) | 8.5 (Cypress+Playwright) | 7.0 (image validation) | 8.0 (multi-version K8s) |
| Build Integration | 5.0 (builds but no Konflux sim) | 7.0 (PR build validation) | 6.0 (image builds) | 5.0 (no Konflux sim) |
| Image Testing | 4.5 (build only) | 5.0 (basic) | 9.0 (5-layer validation) | 5.0 (basic) |
| Coverage Tracking | 5.5 (codecov, main-only) | 8.0 (PR coverage, thresholds) | 4.0 (no tracking) | 8.5 (enforcement + thresholds) |
| CI/CD Automation | 7.5 (smart filtering) | 8.5 (comprehensive) | 7.0 (periodic jobs) | 8.0 (well-organized) |
| Agent Rules | 0.0 (none) | 8.0 (comprehensive) | 2.0 (minimal) | 3.0 (basic) |
| **Overall** | **6.4** | **8.0** | **6.0** | **7.0** |

## File Paths Reference

### CI/CD
- `.github/workflows/ci-build.yaml` - Main CI workflow (tests, lint, E2E, images)
- `.github/workflows/build-main.yml` - ODH image builds
- `.github/workflows/snyk.yml` - Snyk dependency scanning (upstream-only)
- `.github/workflows/release.yaml` - Multi-arch release + cosign + SBOM
- `.github/workflows/pr.yaml` - PR title check
- `.tekton/odh-data-science-pipelines-argo-workflowcontroller-pull-request.yaml` - Konflux build
- `.tekton/odh-data-science-pipelines-argo-argoexec-pull-request.yaml` - Konflux build

### Testing
- `test/e2e/` - 29 E2E test files with fixtures framework
- `test/e2e/fixtures/` - Given/When/Then test framework
- `test/e2e/manifests/` - K3S test cluster manifests
- `workflow/controller/*_test.go` - Controller unit tests
- `server/*_test.go` - Server unit tests
- `ui/src/**/*.test.ts` - 11 UI test files

### Code Quality
- `.golangci.yml` - 18 linters + formatters
- `.codecov.yml` - Coverage config (2% threshold, patch off)
- `.markdownlint.yaml` - Markdown linting
- `renovate.json` - Dependency updates (extends konflux-central)

### Container Images
- `Dockerfile` - Upstream multi-stage build
- `argo-workflowcontroller/Dockerfile.konflux` - RHOAI Konflux (UBI9, FIPS)
- `argo-argoexec/Dockerfile.konflux` - RHOAI Konflux (UBI9, FIPS)
- `rhoai/Dockerfile.workflowcontroller` - RHOAI legacy (UBI8)
- `cosign.pub` - Cosign public key

### Security
- `.github/workflows/snyk.yml` - Snyk scanning (upstream-only)
- `cosign.pub` - Image signing public key
