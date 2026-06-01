---
repository: "opendatahub-io/model-registry"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Strong Go unit tests with Testcontainers, solid frontend specs with Jest/Cypress"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Multi-version KinD E2E, Python client E2E, CSI E2E, catalog E2E, fuzz testing"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time image build + KinD deployment with operator validation, but no Konflux simulation"
  - dimension: "Image Testing"
    score: 7.0
    status: "PR image build + KinD deployment, multi-Dockerfile setup, but no startup probe or multi-arch PR validation"
  - dimension: "Coverage Tracking"
    score: 6.5
    status: "Codecov integration for Go and Python, but no codecov.yml config, no threshold enforcement"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "33 workflows, smart path filtering, concurrency via prepare job, multi-K8s-version matrix"
  - dimension: "Agent Rules"
    score: 7.5
    status: "Excellent CLAUDE.md/AGENTS.md with repo map, commands, conventions, but no .claude/rules/"
critical_gaps:
  - title: "No coverage threshold enforcement"
    impact: "Coverage can silently regress without breaking CI"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No CodeQL or SAST analysis on PRs"
    impact: "Security vulnerabilities in code not caught until post-merge or manual review"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No PR-time Konflux build simulation"
    impact: "Konflux-specific build failures discovered only post-merge"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "Trivy scanning is scheduled-only, not on PRs"
    impact: "New vulnerabilities introduced in PRs not caught until next weekly scan"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No .claude/rules/ directory for test automation patterns"
    impact: "AI-generated tests may not follow project-specific patterns"
    severity: "LOW"
    effort: "4-6 hours"
quick_wins:
  - title: "Add codecov.yml with coverage thresholds"
    effort: "1-2 hours"
    impact: "Prevent coverage regression on PRs with automatic enforcement"
  - title: "Add CodeQL workflow for Go and Python analysis"
    effort: "2-3 hours"
    impact: "Automated SAST scanning catches security vulnerabilities on every PR"
  - title: "Add Trivy scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Catch new container vulnerabilities before merge rather than weekly"
  - title: "Generate .claude/rules/ for test patterns"
    effort: "2-3 hours"
    impact: "Improve AI agent test quality by codifying Go, Python, and TypeScript test conventions"
recommendations:
  priority_0:
    - "Add codecov.yml with patch and project coverage thresholds (e.g., 80% target)"
    - "Add CodeQL SAST scanning workflow triggered on PRs"
    - "Move Trivy image scanning to run on PR builds, not just weekly schedule"
  priority_1:
    - "Add PR-time Konflux build simulation to catch downstream build issues"
    - "Add multi-architecture image build validation on PRs (currently only single-arch)"
    - "Create .claude/rules/ with test patterns for Go (Testcontainers, envtest), Python (pytest, nox), TypeScript (Jest, Cypress)"
    - "Add container startup validation (health check) after KinD deployment in PR workflow"
  priority_2:
    - "Add dependency review action for PRs to flag license and vulnerability issues"
    - "Add UI E2E tests running on PRs (Cypress tests exist but no PR workflow runs them)"
    - "Add performance regression testing for API endpoints"
    - "Consider adding contract tests between Python client and Go server"
---

# Quality Analysis: model-registry (opendatahub-io)

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Multi-language monorepo (Go server + Python clients + React/TypeScript UI + Kubernetes controller)
- **Key Strengths**: Excellent CI/CD with 33 workflows, comprehensive E2E testing on KinD with multi-K8s-version matrix, strong agent documentation (CLAUDE.md/AGENTS.md), Testcontainers for DB integration tests, fuzz testing, OpenSSF Scorecard
- **Critical Gaps**: No coverage thresholds, no SAST/CodeQL on PRs, Trivy scanning is weekly-only, no Konflux build simulation
- **Agent Rules Status**: CLAUDE.md and AGENTS.md present and comprehensive, but no `.claude/rules/` directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Strong Go tests (148 files) with Testcontainers, 55 frontend specs, 36 Python tests |
| Integration/E2E | 8.5/10 | Multi-version KinD E2E, Python client E2E, CSI E2E, catalog E2E, fuzz testing |
| **Build Integration** | **7.0/10** | **PR-time image build + KinD deploy + operator validation, no Konflux simulation** |
| Image Testing | 7.0/10 | PR image build + KinD deployment, 8 Dockerfiles, no multi-arch PR validation |
| Coverage Tracking | 6.5/10 | Codecov uploads for Go & Python, but no config file and no thresholds |
| CI/CD Automation | 8.5/10 | 33 workflows, smart path filters, multi-K8s matrix, concurrency control |
| Agent Rules | 7.5/10 | Excellent CLAUDE.md/AGENTS.md, repo map, commands, but no .claude/rules/ |

## Critical Gaps

### 1. No Coverage Threshold Enforcement
- **Impact**: Coverage can silently regress without failing CI
- **Severity**: HIGH
- **Current State**: Codecov uploads exist in `build.yml` and `python-tests.yml` but `fail_ci_if_error: true` only validates the upload succeeded, not coverage thresholds
- **Missing**: No `codecov.yml` or `.codecov.yml` config file with `project` or `patch` coverage targets
- **Effort**: 2-4 hours
- **Fix**: Create `codecov.yml` with minimum coverage thresholds

### 2. No CodeQL or SAST Scanning on PRs
- **Impact**: Security vulnerabilities in Go, Python, or TypeScript code not caught until manual review
- **Severity**: HIGH
- **Current State**: Only Trivy for container images (weekly) and OpenSSF Scorecard (weekly). No code-level static analysis
- **Missing**: CodeQL, gosec, Semgrep, or equivalent SAST tool on PR trigger
- **Effort**: 2-4 hours
- **Fix**: Add CodeQL workflow for Go and Python, or add gosec to golangci-lint config

### 3. Trivy Image Scanning is Weekly-Only
- **Impact**: New vulnerabilities introduced by dependency changes in PRs are not caught until the next Monday scan
- **Severity**: HIGH
- **Current State**: `trivy-image-scanning.yaml` runs on schedule (`0 0 * * 1`) scanning published `latest` images
- **Missing**: Trivy scan on PR-built images before merge
- **Effort**: 2-3 hours
- **Fix**: Add Trivy scan step to `build-image-pr.yml` after building the image

### 4. No PR-time Konflux Build Simulation
- **Impact**: Konflux-specific build issues (different base images, build args, security policies) only discovered post-merge
- **Severity**: MEDIUM
- **Current State**: PR workflow builds with standard Dockerfile. No Konflux/RHTAP pipeline simulation
- **Effort**: 8-12 hours

### 5. No `.claude/rules/` Directory for Test Automation
- **Impact**: AI agents generating tests may not follow project-specific patterns (Testcontainers, envtest, nox sessions)
- **Severity**: LOW
- **Current State**: CLAUDE.md/AGENTS.md document testing commands but don't provide structured rules for test creation patterns
- **Effort**: 4-6 hours

## Quick Wins

### 1. Add `codecov.yml` with Coverage Thresholds (1-2 hours)
```yaml
# codecov.yml
coverage:
  status:
    project:
      default:
        target: 60%
        threshold: 2%
    patch:
      default:
        target: 70%
```

### 2. Add CodeQL Workflow (2-3 hours)
```yaml
name: CodeQL Analysis
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
permissions:
  security-events: write
  contents: read
jobs:
  analyze:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        language: [go, python, javascript]
    steps:
      - uses: actions/checkout@v6
      - uses: github/codeql-action/init@v4
        with:
          languages: ${{ matrix.language }}
      - uses: github/codeql-action/autobuild@v4
      - uses: github/codeql-action/analyze@v4
```

### 3. Add Trivy to PR Image Build (1-2 hours)
Add after the `Build Image` step in `build-image-pr.yml`:
```yaml
- name: Run Trivy scan on PR image
  uses: aquasecurity/trivy-action@v0.36.0
  with:
    image-ref: '${{ env.IMG_REGISTRY }}/${{ env.IMG_ORG }}/${{ env.IMG_REPO }}:${{ steps.tags.outputs.tag }}'
    format: 'table'
    exit-code: '1'
    severity: 'CRITICAL,HIGH'
```

### 4. Generate `.claude/rules/` for Test Patterns (2-3 hours)
Use `/test-rules-generator` to create rules for:
- Go unit tests (testify, Testcontainers pattern)
- Go controller tests (envtest pattern)
- Python tests (pytest, nox session pattern)
- TypeScript tests (Jest spec pattern, Cypress component test pattern)

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (33 workflows)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build.yml` | PR + push | Build + unit tests + coverage upload |
| `build-image-pr.yml` | PR | Build image, deploy to KinD, test with operator |
| `build-image-ui-pr.yml` | PR | Build UI container image |
| `python-tests.yml` | PR + push | Lint + E2E on KinD (multi-K8s, multi-Python, multi-DB) |
| `controller-test.yml` | PR (path-filtered) | Controller envtest + image build |
| `csi-test.yml` | PR (path-filtered) | CSI E2E on KinD |
| `async-upload-test.yml` | PR (path-filtered) | Python unit + integration + E2E |
| `ui-frontend-build.yml` | PR + push | Frontend test + build |
| `ui-bff-build.yml` | PR + push | BFF build |
| `check-openapi-spec-pr.yaml` | PR (path-filtered) | OpenAPI spec validation |
| `check-db-schema-structs.yaml` | PR | DB schema struct validation |
| `check-gitattributes.yaml` | PR | Git attributes check |
| `go-mod-tidy-diff-check.yml` | PR | Go module tidiness |
| `go-generate.yml` | PR | Generated code sync check |
| `trivy-image-scanning.yaml` | Weekly schedule | Container vulnerability scan |
| `scorecard.yml` | Weekly + push | OpenSSF Scorecard |
| `test-fuzz.yml` | Manual dispatch | Fuzz testing |
| `build-and-push-*.yml` (6) | Push/tag | Image publishing |
| `python-release.yml` | Manual | Python package release |
| `stale.yaml` | Schedule | Stale issue management |
| `labeler.yml` | PR | Auto-labeling |

**Strengths**:
- Smart path filtering avoids unnecessary CI runs (controller tests only on controller changes, etc.)
- Concurrency control via `prepare.yml` reusable workflow
- Multi-version testing matrix: K8s v1.33.7 + v1.34.3, Python 3.10-3.14, MySQL + PostgreSQL
- Pin commit SHAs for all GitHub Actions (supply chain security)
- Permissions scoped to minimum required (OpenSSF ScoreCard compliant)

**Gaps**:
- No concurrency groups to cancel outdated PR runs
- No explicit caching for Go modules or npm in workflows (relies on setup-go defaults)

### Test Coverage

**Go Tests (148 test files / 467 source files = 31.7% ratio)**:
- Core business logic: `internal/core/*_test.go` (12 files) — comprehensive domain tests
- Database service layer: `internal/db/service/*_test.go` (16 files) — Testcontainers integration
- Filter/query: `internal/db/filter/*_test.go` (4 files) — parser and cross-DB tests
- Converter: `internal/converter/*_test.go` (3 files)
- Controller: `cmd/controller/internal/controllers/*_test.go` (2 files) — envtest
- CSI: `cmd/csi/internal/storage/*_test.go` (1 file)
- Platform/DB: `internal/platform/db/{mysql,postgres}/*_test.go` (4 files) — Testcontainers

**Python Tests (36 test files / 190 source files = 18.9% ratio)**:
- Python client: `clients/python/` — pytest via nox
- Catalog client: `catalog/clients/python/`
- Async upload job: `jobs/async-upload/tests/` (5 unit + 1 integration)

**TypeScript/Frontend Tests (55 spec files / 333 source files = 16.5% ratio)**:
- Unit specs: Jest-based (55 `.spec.ts`/`.spec.tsx`/`.test.ts`/`.test.tsx` files)
- Cypress E2E: 22 `.cy.ts` component tests (mocked)
- Note: Cypress tests appear to be mocked component tests, not true browser E2E

**Key Testing Patterns**:
- Go: `stretchr/testify` for assertions, `Testcontainers` for MySQL/PostgreSQL integration
- Controller: `envtest` (kubebuilder) for Kubernetes API testing
- Python: `pytest` + `nox` sessions for lint/test/e2e/fuzz
- Frontend: Jest + Cypress (mocked mode)
- Fuzz testing: Dedicated `test-fuzz.yml` workflow for API fuzzing

### Code Quality

**Linting**:
- Go: `golangci-lint` v2.9.0 with default config (no custom `.golangci.yml`)
- Python: `ruff` for linting/formatting, `mypy` for type checking (via nox sessions)
- TypeScript: ESLint configured (`.eslintrc.cjs`)
- `go vet` run as part of `make build`

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- `pre-commit-hooks`: large files, AST, case conflicts, JSON, merge conflicts, debug statements, private key detection, EOF fixer, trailing whitespace
- `ruff`: Python linting + formatting
- Good: Detects private keys (excludes test files appropriately)

**Secret Detection**:
- `gitleaks.toml` configured with allowlist for known test credentials
- `detect-private-key` hook in pre-commit

**Static Analysis**:
- OpenSSF Scorecard runs weekly with SARIF upload to GitHub Security
- Missing: CodeQL, gosec, Semgrep for code-level SAST

### Container Images

**Dockerfiles (8)**:
- `Dockerfile` — Main server (multi-stage, UBI9 base, distroless-style)
- `Dockerfile.odh` — ODH-specific build
- `Dockerfile.testops` — Test operations image
- `clients/ui/Dockerfile` — UI image
- `clients/ui/Dockerfile.standalone` — Standalone UI
- `cmd/controller/Dockerfile.controller` — Controller image
- `cmd/csi/Dockerfile.csi` — CSI storage initializer
- `jobs/async-upload/Dockerfile` — Async upload job

**Build & Testing**:
- PR-time image build + KinD deployment in `build-image-pr.yml`
- Operator deployment and ModelRegistry CR creation in KinD
- Python client connectivity test against deployed image
- UI image build validation on PRs via `build-image-ui-pr.yml`

**Strengths**:
- Multi-stage builds with UBI9 base images
- `BUILDPLATFORM`/`TARGETOS`/`TARGETARCH` for cross-platform support
- Non-root user (`65532:65532`) in production images
- Go module caching layer in Dockerfile

**Gaps**:
- No multi-architecture build validation on PRs (only support in Dockerfile, not tested)
- No explicit health check / startup probe validation
- Trivy scanning only on published images (weekly), not PR-built images

### Security

**Present**:
- OpenSSF Scorecard (weekly + push to main)
- Trivy image scanning (weekly, SARIF upload to GitHub Security)
- Gitleaks secret detection config
- Pre-commit private key detection
- Pinned GitHub Action SHAs (supply chain protection)
- Scoped permissions in all workflows

**Missing**:
- No CodeQL or SAST on PRs
- No dependency review action for license/vulnerability checking
- No gosec or go-specific security scanner
- Trivy not integrated into PR workflow

### Agent Rules (Agentic Flow Quality)

**Status**: Present and comprehensive (CLAUDE.md + AGENTS.md)

**Strengths**:
- Detailed CLAUDE.md identical to AGENTS.md — comprehensive repo map, build/test commands, code generation workflow
- Clear agent behavior policy (atomic changes, no CI modification, DCO sign-off)
- Explicit "do NOT edit" list for auto-generated files
- Testing requirements documented (bug fixes must include tests)
- Language-specific conventions (Go, TypeScript, Python)
- Security checklist for agents
- OpenAPI change workflow documented

**Gaps**:
- No `.claude/` directory or `.claude/rules/` for structured test creation rules
- No test pattern examples (e.g., how to write a Testcontainers test, envtest test)
- No explicit coverage requirements or quality gates
- Rules are documentation-oriented, not structured for agent consumption

**Recommendation**: Generate structured `.claude/rules/` using `/test-rules-generator` for:
- `go-unit-tests.md` — testify patterns, table-driven tests
- `go-integration-tests.md` — Testcontainers MySQL/PostgreSQL patterns
- `go-controller-tests.md` — envtest patterns
- `python-tests.md` — pytest/nox patterns
- `typescript-tests.md` — Jest spec and Cypress component test patterns

## Recommendations

### Priority 0 (Critical)

1. **Add `codecov.yml` with coverage thresholds** — Prevent silent coverage regression. Currently coverage is uploaded but not enforced.
2. **Add CodeQL SAST workflow on PRs** — No static application security testing exists for code-level vulnerabilities.
3. **Move Trivy scanning to PR workflow** — Weekly scanning misses vulnerabilities introduced between scans.

### Priority 1 (High Value)

4. **Add PR-time Konflux build simulation** — Catch downstream build issues before merge.
5. **Add multi-architecture image build validation** — Dockerfiles support multi-arch but it's not validated on PRs.
6. **Create `.claude/rules/` test patterns** — Structured rules for AI-assisted test generation across all languages.
7. **Add container health check validation** — After KinD deployment, validate startup probes and readiness.
8. **Add concurrency groups to PR workflows** — Cancel outdated runs when new commits are pushed.

### Priority 2 (Nice-to-Have)

9. **Add dependency review action** — Flag license and vulnerability issues in dependency changes.
10. **Run Cypress E2E tests on PRs** — 22 Cypress tests exist but no PR workflow executes them.
11. **Add API contract tests** — Validate Python client compatibility with Go server at API level.
12. **Add performance regression testing** — Benchmark API latency for registry operations.
13. **Add custom golangci-lint config** — Enable additional linters beyond defaults (e.g., `gocritic`, `errcheck`, `ineffassign`).

## Comparison to Gold Standards

| Dimension | model-registry | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit Tests | 8.5 — 148 Go + 55 TS + 36 Py | 9.0 — Multi-layer | 7.0 — Image-focused | 8.5 — Comprehensive |
| Integration/E2E | 8.5 — KinD multi-version | 9.0 — Contract tests | 8.0 — 5-layer validation | 9.0 — Multi-version |
| Build Integration | 7.0 — PR image + KinD | 8.0 — Module Federation | 7.0 — Image pipelines | 7.0 — Operator build |
| Image Testing | 7.0 — PR build + deploy | 7.0 — Basic | 9.0 — 5-layer | 7.0 — Basic |
| Coverage | 6.5 — Codecov, no thresholds | 8.0 — Enforced | 6.0 — Minimal | 9.0 — Enforced |
| CI/CD | 8.5 — 33 workflows | 9.0 — Comprehensive | 8.0 — Multi-arch | 8.5 — Multi-version |
| Agent Rules | 7.5 — CLAUDE.md/AGENTS.md | 8.5 — .claude/rules/ | 3.0 — None | 4.0 — Basic |
| **Overall** | **7.6** | **8.4** | **6.9** | **7.6** |

## File Paths Reference

### CI/CD
- `.github/workflows/build.yml` — Main build + unit tests
- `.github/workflows/build-image-pr.yml` — PR image build + KinD deploy
- `.github/workflows/python-tests.yml` — Python lint + E2E (multi-matrix)
- `.github/workflows/controller-test.yml` — Controller envtest
- `.github/workflows/csi-test.yml` — CSI E2E on KinD
- `.github/workflows/trivy-image-scanning.yaml` — Weekly Trivy scan
- `.github/workflows/scorecard.yml` — OpenSSF Scorecard

### Testing
- `internal/core/*_test.go` — Core business logic tests
- `internal/db/service/*_test.go` — Database integration tests (Testcontainers)
- `internal/testutils/` — Shared test utilities (MySQL/PostgreSQL Testcontainers)
- `cmd/controller/internal/controllers/suite_test.go` — Controller envtest suite
- `clients/python/` — Python client tests (pytest/nox)
- `clients/ui/frontend/src/__tests__/cypress/` — Cypress component tests
- `test/` — Integration test scripts

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks (gitleaks, ruff, etc.)
- `.gitleaks.toml` — Secret detection configuration
- `clients/ui/frontend/.eslintrc.cjs` — Frontend ESLint config

### Container Images
- `Dockerfile` — Main server (multi-stage, UBI9)
- `Dockerfile.odh` — ODH variant
- `cmd/controller/Dockerfile.controller` — Controller
- `cmd/csi/Dockerfile.csi` — CSI storage initializer
- `clients/ui/Dockerfile` — UI image

### Agent Rules
- `CLAUDE.md` — Comprehensive agent instructions (identical to AGENTS.md)
- `AGENTS.md` — Agent behavior policy and conventions
- No `.claude/` directory present
