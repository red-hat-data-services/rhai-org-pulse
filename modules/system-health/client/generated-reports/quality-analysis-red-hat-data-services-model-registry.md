---
repository: "red-hat-data-services/model-registry"
overall_score: 8.1
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Excellent coverage with 157 Go, 38 Python, 55 TS/JS test files; testify + pytest + Jest + Cypress"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Outstanding E2E with Kind clusters, multi-K8s version matrix, multi-DB (MySQL + PostgreSQL), Python client E2E, Cypress mocked E2E"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-time image build + Kind deployment + operator integration + Python client connectivity test; Konflux/Tekton PR pipelines with multi-arch"
  - dimension: "Image Testing"
    score: 7.5
    status: "PR image builds validated via Kind deployment; Trivy scanning weekly (not PR-time); SBOM via Syft; multi-arch (x86_64, ppc64le, s390x, arm64)"
  - dimension: "Coverage Tracking"
    score: 7.0
    status: "Codecov integration with fail_ci_if_error for Go and Python; no .codecov.yml config file with thresholds; no coverage gates"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "35 workflow files covering build, test, lint, image push, fuzz, schema validation, OpenSSF Scorecard; actions pinned to SHA; path-scoped triggers"
  - dimension: "Agent Rules"
    score: 8.0
    status: "Comprehensive AGENTS.md with repo map, commands, CI checks table, conventions, and 6 custom skills in .agents/; missing .claude/rules/ test-type rules"
critical_gaps:
  - title: "No PR-time container vulnerability scanning"
    impact: "Vulnerabilities only detected on weekly Trivy scans, not at PR time — risky dependencies can merge undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No .codecov.yml with coverage thresholds"
    impact: "Coverage uploads exist but no minimum threshold enforcement — coverage can silently regress without blocking PRs"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "Missing concurrency controls on most workflows"
    impact: "Duplicate workflow runs for rapid-fire pushes waste CI resources; only gh-workflow-approve.yml has concurrency"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No golangci-lint configuration file"
    impact: "Using default linter set; no custom rule enforcement, no severity tuning — misses project-specific code quality rules"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No Go fuzz tests in codebase"
    impact: "Fuzz workflow exists for Python but no Go fuzz functions (Func Fuzz*) defined — API parsing not fuzz-tested"
    severity: "LOW"
    effort: "4-8 hours"
quick_wins:
  - title: "Add .codecov.yml with coverage thresholds"
    effort: "1 hour"
    impact: "Prevent silent coverage regression on PRs with project/patch level gates"
  - title: "Add Trivy scanning to PR image build workflow"
    effort: "2 hours"
    impact: "Catch CVEs at PR time before merge — 5 lines added to build-image-pr.yml"
  - title: "Add concurrency groups to PR-triggered workflows"
    effort: "1 hour"
    impact: "Cancel redundant in-flight runs on force-push, save CI minutes"
  - title: "Create .golangci.yml with expanded linter set"
    effort: "2-3 hours"
    impact: "Enforce stricter Go code quality (errcheck, gocritic, gosec, etc.)"
  - title: "Add .claude/rules/ for test creation patterns"
    effort: "2-3 hours"
    impact: "Guide AI agents to generate tests matching existing Go testcontainers, pytest, and Cypress patterns"
recommendations:
  priority_0:
    - "Add Trivy container scanning to build-image-pr.yml to catch vulnerabilities at PR time"
    - "Create .codecov.yml with project coverage thresholds (e.g., 70% minimum) and patch coverage gates"
  priority_1:
    - "Add concurrency groups to all PR-triggered workflows (build.yml, python-tests.yml, build-image-pr.yml, controller-test.yml, csi-test.yml)"
    - "Create .golangci.yml enabling additional linters: errcheck, gocritic, gosec, prealloc, unconvert"
    - "Create .claude/rules/ with test-type-specific rules (unit-tests.md, integration-tests.md, e2e-tests.md) using /test-rules-generator"
  priority_2:
    - "Add Go fuzz tests for OpenAPI parsing and request validation endpoints"
    - "Add workflow caching for Go modules (actions/cache) to build.yml and controller-test.yml"
    - "Consider PR-time SAST scanning with Semgrep CI (semgrep.yaml config already exists)"
---

# Quality Analysis: Model Registry (red-hat-data-services/model-registry)

## Executive Summary

- **Overall Score: 8.1/10**
- **Repository Type**: Polyglot monorepo — Go server + Python clients + TypeScript/React UI + Kubernetes controllers
- **Primary Languages**: Go (505 source files), Python (191 files), TypeScript/JavaScript (360+ files)
- **Key Strengths**: Exceptional E2E testing with Kind cluster deployments, multi-K8s version matrix, multi-database testing (MySQL + PostgreSQL), comprehensive CI workflows (35 files), strong agent documentation (AGENTS.md), OpenSSF Scorecard, Konflux/Tekton pipelines with multi-arch builds
- **Critical Gaps**: No PR-time vulnerability scanning, no coverage thresholds in codecov, missing concurrency controls, no golangci-lint config file
- **Agent Rules Status**: Strong — AGENTS.md is comprehensive with repo map, commands, CI checks, and conventions; 6 custom skills in `.agents/`; missing `.claude/rules/` test-type-specific guidance

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | 157 Go + 38 Python + 55 TS/JS test files; testify, pytest, Jest, Cypress |
| Integration/E2E | 9.0/10 | Kind clusters, multi-K8s versions, multi-DB, Python E2E, Cypress mocked E2E |
| **Build Integration** | **8.0/10** | **PR image build + Kind deploy + operator integration; Konflux/Tekton multi-arch** |
| Image Testing | 7.5/10 | PR builds validated via Kind; Trivy weekly (not PR); SBOM via Syft; 4-arch |
| Coverage Tracking | 7.0/10 | Codecov with fail_ci_if_error; no .codecov.yml thresholds; no patch gates |
| CI/CD Automation | 8.5/10 | 35 workflows; SHA-pinned actions; path-scoped triggers; OpenSSF Scorecard |
| Agent Rules | 8.0/10 | Comprehensive AGENTS.md; 6 custom skills; missing .claude/rules/ test rules |

## Critical Gaps

### 1. No PR-time Container Vulnerability Scanning
- **Impact**: Vulnerabilities only detected on weekly Monday Trivy scans — risky dependencies can merge and ship before next scan
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: `trivy-image-scanning.yaml` runs only on schedule (`0 0 * * 1`) and `workflow_dispatch`. The `build-image-pr.yml` workflow builds and deploys images on PRs but never scans them.
- **Fix**: Add a Trivy scan step to `build-image-pr.yml` after the image build step

### 2. No Coverage Threshold Enforcement
- **Impact**: Coverage reports are uploaded to Codecov but no minimum thresholds are configured — coverage can silently drop without blocking PRs
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: Both `build.yml` and `python-tests.yml` upload to Codecov with `fail_ci_if_error: true`, but there is no `.codecov.yml` file defining project/patch coverage targets.
- **Fix**: Create `.codecov.yml` with `coverage.status.project.default.target` and `patch` settings

### 3. Missing Concurrency Controls
- **Impact**: Rapid-fire pushes to PRs trigger duplicate workflow runs, wasting CI resources
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: Only `gh-workflow-approve.yml` has concurrency controls. Major workflows like `build.yml`, `python-tests.yml`, `build-image-pr.yml` lack `concurrency` groups.

### 4. No golangci-lint Configuration File
- **Impact**: Using default golangci-lint settings — no project-specific linter tuning or expanded rule sets
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: `make lint` runs `golangci-lint` but no `.golangci.yml` or `.golangci.yaml` exists. Default configuration misses linters like errcheck, gocritic, gosec, prealloc.

### 5. No Go Fuzz Tests
- **Impact**: OpenAPI parsing and request validation not fuzz-tested — potential edge-case crashes
- **Severity**: LOW
- **Effort**: 4-8 hours
- **Details**: A `test-fuzz.yml` workflow exists for Python fuzz testing (Schemathesis-based), but no Go `func Fuzz*` functions are defined. The API server has complex parsing logic that would benefit from fuzzing.

## Quick Wins

### 1. Add `.codecov.yml` with Coverage Thresholds (1 hour)
```yaml
coverage:
  status:
    project:
      default:
        target: 70%
        threshold: 2%
    patch:
      default:
        target: 80%
```

### 2. Add Trivy Scanning to PR Image Build (2 hours)
Add to `build-image-pr.yml` after the "Build Image" step:
```yaml
- name: Trivy vulnerability scan
  uses: aquasecurity/trivy-action@v0.36.0
  with:
    image-ref: '${{ env.IMG_REGISTRY }}/${{ env.IMG_ORG }}/${{ env.IMG_REPO }}:${{ steps.tags.outputs.tag }}'
    format: 'table'
    exit-code: '1'
    ignore-unfixed: true
    severity: 'CRITICAL,HIGH'
```

### 3. Add Concurrency Groups (1 hour)
Add to all PR-triggered workflows:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

### 4. Create `.golangci.yml` (2-3 hours)
```yaml
linters:
  enable:
    - errcheck
    - gocritic
    - gosec
    - prealloc
    - unconvert
    - misspell
```

### 5. Generate `.claude/rules/` Test Rules (2-3 hours)
Use `/test-rules-generator` to create test-type-specific rules matching existing patterns:
- `unit-tests.md` — Go testify + testcontainers patterns, Python pytest patterns
- `integration-tests.md` — MySQL/PostgreSQL testcontainers, envtest for controllers
- `e2e-tests.md` — Kind cluster deployment, Python client E2E, Cypress mocked E2E

## Detailed Findings

### CI/CD Pipeline

**Strengths:**
- **35 workflow files** covering comprehensive automation
- **Path-scoped triggers** — controller tests only run on controller changes, CSI tests on CSI changes, async-upload on job changes
- **Actions pinned to SHA** for supply chain security (e.g., `actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0`)
- **OpenSSF Scorecard** integration for supply chain security assessment
- **Permissions minimized** — `contents: read` at top-level per ScoreCard rule
- **DB schema validation** — `check-db-schema-structs.yaml` verifies GORM structs match both MySQL and PostgreSQL schemas
- **OpenAPI spec validation** — `check-openapi-spec-pr.yaml` catches spec drift
- **Go module tidy check** — `go-mod-tidy-diff-check.yml` prevents dirty modules
- **Autogenerated code sync** — checks in `python-tests.yml` and `async-upload-test.yml` verify generated code is in sync

**Gaps:**
- No concurrency groups on most PR workflows
- No workflow caching for Go modules in `build.yml` (only in `go-mod-tidy-diff-check.yml`)
- Trivy scanning is periodic, not PR-triggered

### Test Coverage

**Go (157 test files / 505 source files = 31% file ratio):**
- Strong unit test coverage across `internal/core/`, `internal/db/service/`, `internal/converter/`
- Integration tests using **Testcontainers** for MySQL and PostgreSQL (real database testing)
- Controller tests using **envtest** (kubebuilder test framework)
- BFF tests with 39 test files covering API handlers and repositories
- Uses `stretchr/testify` for assertions throughout

**Python (38 test files):**
- Client tests with pytest: unit tests, regression tests, type tests
- E2E tests running on Kind with multiple Python versions (3.10-3.14)
- Multi-K8s version matrix (v1.33.7, v1.34.3)
- Multi-database testing (MySQL and PostgreSQL) via `manifest-db` matrix
- Catalog client tests with separate test suite
- Async upload job tests with both unit and integration tests
- **Fuzz testing** via Schemathesis (triggered on OpenAPI spec changes)

**TypeScript/React (55 test files):**
- Unit tests with Jest (`.spec.ts`, `.spec.tsx`)
- Cypress E2E tests (24 test files) covering model registry, catalog, settings
- BFF Go backend has 39 test files
- Comprehensive page object model for Cypress tests

### Code Quality

**Strengths:**
- **Pre-commit hooks** with check-json, check-merge-conflict, detect-private-key, trailing-whitespace, ruff (Python)
- **Gitleaks** configuration for secret detection with well-structured allowlists
- **Semgrep** rules (64KB config covering Go, Python, TypeScript, YAML, generic patterns)
- **ESLint** for TypeScript with `--max-warnings 0` enforcement
- **Ruff** for Python linting and formatting
- **mypy** for Python type checking
- **TypeScript strict mode** checks (`tsc --noEmit`)

**Gaps:**
- No `.golangci.yml` config file — using default linter set
- No dedicated CodeQL/SAST workflow (though Semgrep config exists, no CI workflow runs it on PRs)

### Container Images

**Strengths:**
- **10 Dockerfiles** for different components (server, controller, CSI, UI, async-upload, testops)
- **Multi-stage builds** — separate builder and runtime stages
- **Multi-architecture** — supports x86_64, ppc64le, s390x, arm64 via Konflux/Tekton
- **Distroless/minimal base** — UBI9 minimal for production images
- **FIPS compliance** — `Dockerfile.konflux` uses `strictfipsruntime` build tags
- **SBOM generation** — Syft configured (`.syft.yaml`) excluding UI components
- **Konflux/Tekton pipelines** — PR and push pipelines with hermetic builds, source image builds, multi-arch index
- **PR-time image testing** — `build-image-pr.yml` builds image, deploys to Kind, deploys operator, creates test registry, runs Python client connectivity test
- **Image expiry** — PR images expire after 5 days

**Gaps:**
- No Trivy scan in PR image build workflow
- No image startup validation (health check testing) in Dockerfile
- No dedicated image composition tests (testing that the binary runs correctly in the container before Kind deployment)

### Security

**Strengths:**
- **Gitleaks** — well-configured with path and regex allowlists
- **Trivy** — weekly scanning of 5 images with SARIF upload to GitHub Security tab
- **OpenSSF Scorecard** — scheduled analysis with badge publication
- **Semgrep** — comprehensive rules covering CWE-798 (hardcoded secrets), SQL injection, command injection, XSS
- **SHA-pinned actions** — GitHub Actions pinned to commit SHAs for supply chain security
- **Permissions model** — read-only by default with explicit escalation
- **FIPS** — Konflux build uses `strictfipsruntime` for compliance
- **Pre-commit detect-private-key** — catches private key files before commit

**Gaps:**
- No Semgrep CI workflow running on PRs (config exists but no workflow)
- No Dependabot or Renovate for automated dependency updates (`.github/dependabot.yml` is path-ignored)
- No SAST/CodeQL GitHub workflow

### Agent Rules (Agentic Flow Quality)

**Status**: Strong — Present and Comprehensive

**Coverage:**
- **AGENTS.md (380 lines)**: Comprehensive guide covering agent behavior policy, repository map, all build/test commands, CI checks table, development workflow, conventions for all 3 languages, testing requirements, security checklist, database/OpenAPI change procedures
- **CLAUDE.md**: Symlink to AGENTS.md
- **.agents/skills/**: 6 custom skills (sync-catalog, init-catalog with 3 sub-guides, catalog-sample-data, catalog-add-route)
- **.claude/ directory**: Exists but empty (no rules files)

**Quality Assessment:**
- AGENTS.md is one of the best examples of AI agent guidance seen — includes repo map, explicit "do NOT" rules, command reference table, auto-generated file warnings, and CI checks matrix
- Skills in `.agents/` are catalog-focused — good specialization

**Gaps:**
- No `.claude/rules/` directory with test-type-specific rules
- No dedicated test creation guidance (unit test patterns, integration test patterns, E2E test patterns)
- No explicit coverage targets or quality gates documented for agents
- Skills focused on catalog operations only — no test automation or quality skills

**Recommendation:** Generate comprehensive test creation rules using `/test-rules-generator` to codify existing patterns:
- Go: testify assertions, testcontainers for MySQL/PostgreSQL, envtest for controllers
- Python: pytest with markers (@pytest.mark.e2e), nox sessions, conftest fixtures
- TypeScript: Jest unit tests, Cypress page objects, mocked API patterns

## Recommendations

### Priority 0 (Critical)

1. **Add Trivy scanning to PR image build** — Container vulnerabilities should be caught before merge, not on weekly scans
2. **Create `.codecov.yml` with coverage thresholds** — Prevent silent coverage regression with project (70%) and patch (80%) gates

### Priority 1 (High Value)

3. **Add concurrency groups to PR workflows** — Cancel redundant runs, save CI resources
4. **Create `.golangci.yml`** — Enable additional linters for stronger Go code quality enforcement
5. **Generate `.claude/rules/` test creation guidance** — Use `/test-rules-generator` to create test-type rules matching existing Go, Python, and TypeScript patterns
6. **Add Semgrep CI workflow** — Rules exist (64KB config), just need a workflow to run on PRs

### Priority 2 (Nice-to-Have)

7. **Add Go fuzz tests** — Fuzz OpenAPI parsing and request validation with `func Fuzz*` test functions
8. **Add Go module caching** to `build.yml` and `controller-test.yml` — Speed up CI with `actions/cache`
9. **Add Dependabot/Renovate** — Automate dependency update PRs
10. **Add HEALTHCHECK to Dockerfiles** — Runtime health validation in container definitions

## Comparison to Gold Standards

| Dimension | model-registry | odh-dashboard (gold) | notebooks (gold) | kserve (gold) |
|-----------|---------------|---------------------|-------------------|--------------|
| Unit Tests | 8.5 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 9.0 | 9.0 | 8.0 | 9.0 |
| Build Integration | 8.0 | 7.0 | 6.0 | 7.0 |
| Image Testing | 7.5 | 7.0 | 9.0 | 7.0 |
| Coverage Tracking | 7.0 | 8.0 | 5.0 | 9.0 |
| CI/CD Automation | 8.5 | 9.0 | 8.0 | 8.0 |
| Agent Rules | 8.0 | 9.0 | 3.0 | 4.0 |
| **Overall** | **8.1** | **8.5** | **7.0** | **7.8** |

**Notable strengths vs gold standards:**
- **Build Integration (8.0)** exceeds gold standards — PR-time Kind deployment with operator integration is best-in-class
- **Integration/E2E (9.0)** matches gold standards — multi-K8s version, multi-DB, multi-Python version matrix is exceptional
- **Agent Rules (8.0)** — AGENTS.md is one of the most comprehensive agent guidance files in the ecosystem

## File Paths Reference

### CI/CD Workflows
- `.github/workflows/build.yml` — Go build + unit tests + coverage
- `.github/workflows/build-image-pr.yml` — PR image build + Kind deployment test
- `.github/workflows/python-tests.yml` — Python lint, unit, E2E, fuzz tests
- `.github/workflows/controller-test.yml` — Controller unit tests + image build
- `.github/workflows/csi-test.yml` — CSI E2E on Kind
- `.github/workflows/async-upload-test.yml` — Async upload job tests
- `.github/workflows/trivy-image-scanning.yaml` — Weekly Trivy scans
- `.github/workflows/scorecard.yml` — OpenSSF Scorecard

### Testing Infrastructure
- `internal/testutils/` — Go test utilities (MySQL testcontainers, cleanup)
- `internal/core/*_test.go` — Core business logic tests (12 files)
- `internal/db/service/*_test.go` — Database service tests with testcontainers (16 files)
- `clients/python/tests/` — Python client tests (pytest)
- `clients/ui/frontend/src/__tests__/cypress/` — Cypress E2E tests (24 files)
- `clients/ui/bff/internal/api/*_test.go` — BFF API handler tests (21 files)
- `test/csi/e2e_test.sh` — CSI E2E test script

### Security & Quality
- `.gitleaks.toml` — Secret detection configuration
- `semgrep.yaml` — SAST rules (Go, Python, TypeScript, YAML, generic)
- `.pre-commit-config.yaml` — Pre-commit hooks
- `.syft.yaml` — SBOM generation config
- `.tekton/` — Konflux/Tekton PR and push pipelines

### Agent Rules
- `AGENTS.md` — Comprehensive agent guidance (380 lines)
- `CLAUDE.md` — Symlink to AGENTS.md
- `.agents/skills/` — 6 custom catalog skills
- `.claude/` — Directory exists but empty
