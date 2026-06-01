---
repository: "kubeflow/hub"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Strong Go unit tests (148 files, 31% test-to-source ratio), Jest + Cypress for UI (77 files), Python pytest (36 files). Uses testify, Testcontainers, envtest."
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Excellent multi-version K8s E2E via Kind across Python clients (3.10-3.14), multi-DB (MySQL+PostgreSQL), CSI E2E with Helm, Catalog E2E, fuzz testing on OpenAPI changes."
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time image builds with Kind deployment validation for server and UI. No Konflux simulation but solid real-cluster testing."
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-architecture builds (linux/amd64+arm64), distroless base images, UBI9 for ODH variant. Image loaded into Kind and validated on PRs."
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "Coverage files generated (coverage.txt, coverage.html, cover.out) but no Codecov/Coveralls integration, no thresholds, no PR reporting."
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "38 workflow files, well-organized with path filters, concurrency control via prepare job, Dependabot across all ecosystems, OpenSSF Scorecard."
  - dimension: "Agent Rules"
    score: 7.0
    status: "Comprehensive AGENTS.md with repo map, commands, conventions, and guardrails. CLAUDE.md mirrors. No .claude/rules/ directory for test-type-specific guidance."
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Coverage can silently regress with no visibility in PRs. No baseline, no trends, no threshold gates."
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No dedicated SAST/CodeQL workflow"
    impact: "Only Trivy for image scanning (weekly schedule). No source-level static analysis on PRs for security vulnerabilities."
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No secret detection in CI"
    impact: "No Gitleaks or TruffleHog scanning. Pre-commit has detect-private-key but excludes test files."
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "Trivy scanning is weekly-only, not on PRs"
    impact: "Vulnerable dependencies can be merged without detection. Security issues found only on Monday scans."
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No .claude/rules/ directory for test-type-specific guidance"
    impact: "AI agents lack structured per-test-type patterns (unit, integration, E2E, contract). AGENTS.md covers conventions but not actionable test templates."
    severity: "LOW"
    effort: "4-6 hours"
quick_wins:
  - title: "Add Codecov integration to build.yml"
    effort: "2-4 hours"
    impact: "Immediate coverage visibility in PRs, trend tracking, and regression prevention."
  - title: "Add CodeQL analysis workflow"
    effort: "1-2 hours"
    impact: "Automated SAST on every PR, catches SQL injection, command injection, and Go-specific vulnerabilities."
  - title: "Move Trivy scanning to PR trigger"
    effort: "1-2 hours"
    impact: "Catch vulnerable dependencies before merge, not a week later."
  - title: "Add Gitleaks pre-commit hook and CI check"
    effort: "1-2 hours"
    impact: "Prevent accidental secret commits across all languages."
  - title: "Generate .claude/rules/ for test patterns"
    effort: "3-4 hours"
    impact: "Structured AI-agent guidance for consistent test generation across Go, Python, and TypeScript."
recommendations:
  priority_0:
    - "Add Codecov/Coveralls integration with coverage thresholds (e.g., 70% minimum, no regression on PRs)"
    - "Add CodeQL or Semgrep SAST workflow running on every PR"
    - "Move Trivy image scanning to PR-triggered in addition to weekly schedule"
  priority_1:
    - "Add Gitleaks secret detection to pre-commit and CI"
    - "Create .claude/rules/ with per-test-type templates (Go unit, integration with Testcontainers, controller with envtest, Python pytest, TypeScript Jest, Cypress)"
    - "Add SBOM attestation to production image builds (already have cosign setup)"
    - "Add UI E2E (Cypress) to PR CI — currently only Jest unit tests run on PRs"
  priority_2:
    - "Add contract testing between Python clients and Go server API"
    - "Add performance regression testing for model registry operations"
    - "Add load testing for concurrent model version operations"
    - "Consider adding golangci-lint config at project root (currently using defaults)"
---

# Quality Analysis: kubeflow/hub (Kubeflow Hub / Model Registry)

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Kubernetes-native Go monorepo with Python clients, React/TypeScript UI, and controller
- **Primary Languages**: Go (server, controller, BFF, CSI), Python (clients, jobs), TypeScript/React (UI)
- **Key Strengths**: Exceptional E2E testing with multi-version Kubernetes and multi-database matrix, comprehensive CI/CD with 38 workflows, strong agent rules (AGENTS.md), OpenSSF Scorecard integration
- **Critical Gaps**: No coverage tracking/enforcement, no SAST/CodeQL on PRs, Trivy only runs weekly, no secret detection in CI
- **Agent Rules Status**: Present and comprehensive (AGENTS.md + CLAUDE.md), but no `.claude/rules/` directory for test-specific patterns

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8/10 | 148 Go test files, 55 TS test files, 36 Python test files. Strong test-to-source ratios. |
| Integration/E2E | 9/10 | Multi-K8s-version (v1.33-v1.34), multi-DB (MySQL+PostgreSQL), multi-Python (3.10-3.14) matrix. Kind-based E2E. Fuzz testing. |
| Build Integration | 7/10 | PR-time image builds validated on Kind clusters. No Konflux simulation but real deployment testing. |
| Image Testing | 7/10 | Multi-arch (amd64+arm64), distroless/UBI9 base images, Kind load + deploy validation. No PR-time vulnerability scan. |
| Coverage Tracking | 4/10 | Coverage files generated locally but no CI integration (no Codecov/Coveralls), no thresholds, no PR reporting. |
| CI/CD Automation | 9/10 | 38 workflows with smart path filters, Dependabot for all ecosystems, OpenSSF Scorecard, auto-generated code sync. |
| Agent Rules | 7/10 | Excellent AGENTS.md with repo map, commands, conventions. No `.claude/rules/` for test-type templates. |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: Coverage can silently regress with no visibility in PRs. No baseline, no trends, no threshold gates.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The Makefile generates `coverage.txt` and `coverage.html` locally, and Python E2E generates `--cov-report=xml`, but none of this is uploaded to Codecov/Coveralls. No coverage comments appear on PRs.

### 2. No Dedicated SAST/CodeQL Workflow
- **Impact**: Only Trivy for image scanning (weekly schedule). No source-level static analysis on PRs for security vulnerabilities.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: CodeQL is referenced only for uploading Trivy SARIF results, not for actual source code analysis. No Semgrep, gosec, or equivalent runs on PRs.

### 3. No Secret Detection in CI
- **Impact**: Pre-commit has `detect-private-key` but excludes test files. No Gitleaks or TruffleHog in CI pipeline.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours

### 4. Trivy Scanning is Weekly-Only
- **Impact**: Vulnerable dependencies can be merged and deployed before the next Monday scan.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: `trivy-image-scanning.yaml` runs on `schedule: cron '0 0 * * 1'` only. No PR-triggered scanning.

### 5. UI Cypress Tests Not in PR CI
- **Impact**: 22 Cypress E2E test files exist but don't appear to run in any PR workflow. Only Jest unit tests run via `npm run test`.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
- **Impact**: Immediate coverage visibility in PRs, trend tracking, regression prevention
- **Implementation**: Upload `coverage.txt` from `build.yml`, add `.codecov.yml` with threshold config

### 2. Add CodeQL Analysis Workflow (1-2 hours)
- **Impact**: Automated SAST on every PR for Go, Python, and JavaScript/TypeScript
- **Implementation**: Standard CodeQL workflow with `language: [go, python, javascript]`

### 3. Move Trivy to PR Trigger (1-2 hours)
- **Impact**: Catch vulnerable dependencies before merge
- **Implementation**: Add `pull_request:` trigger to `trivy-image-scanning.yaml`

### 4. Add Gitleaks to CI (1-2 hours)
- **Impact**: Prevent accidental secret commits
- **Implementation**: Add `gitleaks/gitleaks-action` step to PR workflows

### 5. Generate .claude/rules/ (3-4 hours)
- **Impact**: Structured AI-agent guidance for consistent test generation
- **Implementation**: Create rules for Go unit, Go integration (Testcontainers), controller (envtest), Python pytest, TypeScript Jest, Cypress E2E

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (38 files)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build.yml` | PR + push | Go compile, unit tests (server + catalog) |
| `build-image-pr.yml` | PR | Build server image, deploy on Kind, test with Python client |
| `build-image-ui-pr.yml` | PR (ui/) | Build UI image, deploy via script |
| `python-tests.yml` | PR + push | Lint, mypy, autogen check, E2E across K8s versions + DBs + Python versions |
| `controller-test.yml` | PR (controller/) | Controller unit tests with envtest, build controller image |
| `csi-test.yml` | PR (csi/) | CSI E2E on Kind with Helm |
| `async-upload-test.yml` | PR (async-upload/) | Python unit + integration + E2E + autogen check |
| `ui-bff-build.yml` | PR (ui/) | BFF Go lint + build + autogen check |
| `ui-frontend-build.yml` | PR (ui/) | Frontend npm test + build + autogen check |
| `trivy-image-scanning.yaml` | Weekly schedule | Trivy scan on 5 published images |
| `scorecard.yml` | Weekly + push | OpenSSF Scorecard analysis |
| `go-mod-tidy-diff-check.yml` | PR + push | Verify go.mod/go.sum are tidy |
| `go-generate.yml` | Weekly | Auto-PR for go generate drift |
| `check-db-schema-structs.yaml` | PR + push | Verify GORM structs match MySQL + PostgreSQL schemas |
| `check-openapi-spec-pr.yaml` | PR | Validate OpenAPI spec |
| `test-fuzz.yml` | dispatch | Fuzz testing against PR branches |
| `build-and-push-*.yml` | push (main/tags) | Build and push production images |
| `prepare.yml` | reusable | Shared preparation job |

**Strengths**:
- Smart path-based triggers (only run controller tests when controller files change)
- Multi-database testing matrix (MySQL + PostgreSQL) for E2E
- Multi-Kubernetes-version testing (v1.33.7, v1.34.3)
- Multi-Python-version testing (3.10-3.14)
- Autogen drift detection across Go, Python, and async-upload
- DB schema struct validation on PRs (both MySQL and PostgreSQL)
- Reusable workflow pattern via `prepare.yml`
- Dependabot configured for gomod, pip, docker, github-actions, npm

**Gaps**:
- No concurrency groups for PR workflows (duplicate runs can pile up)
- No caching for Go modules in `build.yml` (other workflows cache)
- Go generate is weekly-only, not on PRs

### Test Coverage

**Go (Server + Controller)**:
- 148 test files / 472 source files = 31% test-to-source ratio
- Frameworks: `testing` + `stretchr/testify` for assertions, `Testcontainers` for DB integration tests
- Controller tests use `envtest` (kubebuilder test framework)
- Coverage generated locally (`coverage.txt`, `cover.out`) but not uploaded to any service
- Test packages: `internal/core/`, `internal/db/service/`, `internal/db/filter/`, `internal/server/`, `internal/mapper/`, `internal/platform/`, `pkg/inferenceservice-controller/`

**TypeScript/React (UI)**:
- 55 test files / 396 source files = 14% test-to-source ratio
- Jest for unit tests (configured in `jest.config.js`)
- 22 Cypress `.cy.ts` files for component/E2E testing (mocked backend)
- Coverage directory configured: `jest-coverage/`
- Cypress tests appear to be mocked-mode only (not real API)

**Python (Clients + Jobs)**:
- 36 test files / 208 source files = 17% test-to-source ratio
- pytest with nox sessions
- E2E tests run against Kind-deployed server
- Integration tests for async-upload job
- Fuzz testing via nox `fuzz` session (runs against real API)

### Code Quality

**Linting**:
- **Go**: golangci-lint v2.9.0 (BFF has custom `.golangci.yaml`, server uses defaults)
- **Python**: ruff (format + lint), mypy (type checking via nox sessions)
- **TypeScript**: ESLint via `.eslintrc.cjs`
- **Pre-commit hooks**: check-json, check-merge-conflict, detect-private-key, end-of-file-fixer, trailing-whitespace, ruff (lint+format for Python)

**Static Analysis**:
- No CodeQL, gosec, or Semgrep for source analysis
- OpenSSF Scorecard (weekly + push) — good supply chain hygiene
- OpenAPI spec validation on PRs

### Container Images

**Dockerfiles**:
- `Dockerfile` — Multi-stage, UBI9/go-toolset builder, distroless runtime, multi-arch (`$BUILDPLATFORM`, `$TARGETOS`, `$TARGETARCH`)
- `Dockerfile.odh` — Red Hat variant with UBI9, CGO_ENABLED=1
- `clients/ui/Dockerfile` — Multi-stage: Node.js (UI build) + Go (BFF build) + distroless runtime
- `jobs/async-upload/Dockerfile` — Python job image

**Image Build Process**:
- PR builds: Server and UI images built and tested on Kind (real deployment validation)
- Production builds: Multi-arch (linux/amd64+arm64), SBOM generation via Syft, image signing via cosign
- 5 images scanned weekly by Trivy: server, ui, async-upload, storage-initializer, ui-standalone

**Gaps**:
- No PR-triggered Trivy scanning
- No image startup validation tests (health check probes tested implicitly via Kind deploy)

### Security

**Present**:
- OpenSSF Scorecard (supply chain security)
- Trivy image scanning (weekly, CRITICAL+HIGH severity)
- Dependabot (weekly updates for all ecosystems)
- Pinned GitHub Actions SHA references throughout
- `detect-private-key` pre-commit hook
- SARIF upload to GitHub Security tab
- Token permissions minimized (`contents: read` default)
- Cosign signing + SBOM for production images

**Missing**:
- No CodeQL/SAST for source code analysis
- No Gitleaks/TruffleHog for comprehensive secret detection
- No Snyk or equivalent for real-time dependency vulnerability tracking
- Trivy not on PR trigger

### Agent Rules (Agentic Flow Quality)

**Status**: Present and well-structured

**AGENTS.md (root)**: Comprehensive — includes:
- Agent behavior policy (atomic changes, no CI modification)
- Kubeflow AI Policy compliance (commit message attribution)
- Full repository map with directory descriptions
- Complete commands reference (build, lint, test, deploy, code generation)
- CI checks table showing what runs on PRs
- Detailed development workflow for AI agents
- Auto-generated file warnings
- Core development principles per language (Go, Python, TypeScript)
- Testing requirements (bug fixes must include tests)
- Security checklist
- Database and OpenAPI change procedures

**CLAUDE.md (root)**: Mirrors AGENTS.md content — same comprehensive guidance available for Claude Code.

**Gaps**:
- No `.claude/rules/` directory — no per-test-type templates
- No `.claude/skills/` directory — no custom skills
- AGENTS.md covers testing conventions but doesn't provide actionable templates (e.g., "here's how to write a Testcontainers integration test for a new DB service method")
- No test generation checklist or quality gates

### Fuzz Testing

**Noteworthy**: The repository has a dedicated fuzz testing infrastructure:
- Manual dispatch workflow (`test-fuzz.yml`) for PR-specific fuzz testing
- Automatic fuzz in `python-tests.yml` when OpenAPI files change or on main push
- Uses nox `fuzz` session against real Kind-deployed server
- Tests both MySQL and PostgreSQL backends

## Recommendations

### Priority 0 (Critical)

1. **Add Codecov/Coveralls integration**
   - Upload `coverage.txt` from `build.yml`, `cover.out` from `controller-test.yml`, `--cov-report=xml` from Python E2E
   - Set minimum threshold (e.g., 70%) and "no regression" policy
   - Add coverage badge to README

2. **Add CodeQL analysis workflow**
   - Configure for `go`, `python`, `javascript` languages
   - Run on `pull_request` and `push` to main
   - Upload SARIF to GitHub Security tab

3. **Add Trivy scanning on PR trigger**
   - Build image in PR, scan before merge
   - Block PRs with CRITICAL vulnerabilities

### Priority 1 (High Value)

4. **Add Gitleaks secret detection**
   - Add to pre-commit and as CI workflow step
   - Configure `.gitleaks.toml` with allowlists for test fixtures

5. **Create `.claude/rules/` directory** with test-type-specific templates:
   - `go-unit-tests.md` — testify assertions, table-driven tests, mock patterns
   - `go-integration-tests.md` — Testcontainers for MySQL+PostgreSQL
   - `go-controller-tests.md` — envtest setup, CRD validation, reconciler testing
   - `python-pytest.md` — pytest fixtures, nox sessions, E2E patterns
   - `typescript-jest.md` — component testing, hook testing, PatternFly patterns
   - `cypress-e2e.md` — mocked API patterns, page object models

6. **Run Cypress tests in PR CI**
   - Add Cypress component tests to `ui-frontend-build.yml`
   - 22 test files exist but don't run in CI

7. **Add SBOM attestation to all image builds**
   - Already have Syft/cosign for server images
   - Extend to UI, async-upload, and CSI images

### Priority 2 (Nice-to-Have)

8. **Add contract tests between Python clients and Go server**
   - Ensure Python client compatibility with API changes
   - Currently validated only via E2E (expensive)

9. **Add concurrency groups to PR workflows**
   - Prevent duplicate runs on rapid pushes
   - Example: `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }`

10. **Add project-level `.golangci.yml` for server**
    - Currently using defaults — opportunity to enable additional linters
    - BFF has its own config; server should too

11. **Add performance/load testing**
    - Benchmark model registry operations under load
    - Track regression in API response times

## Comparison to Gold Standards

| Dimension | kubeflow/hub | odh-dashboard | notebooks | kserve |
|-----------|-------------|---------------|-----------|--------|
| Unit Tests | 8/10 | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 9/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 7/10 | 8/10 | 7/10 | 7/10 |
| Image Testing | 7/10 | 7/10 | 9/10 | 7/10 |
| Coverage Tracking | 4/10 | 8/10 | 5/10 | 8/10 |
| CI/CD Automation | 9/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 7/10 | 9/10 | 3/10 | 4/10 |
| **Overall** | **7.6/10** | **8.7/10** | **7.0/10** | **7.9/10** |

**Key Differentiators**:
- kubeflow/hub excels at E2E testing with its multi-dimensional matrix (K8s versions x DBs x Python versions)
- Fuzz testing is a standout feature not commonly seen
- Agent rules (AGENTS.md) are exceptionally thorough — one of the best in the Kubeflow ecosystem
- Coverage tracking is the biggest gap relative to gold standards

## File Paths Reference

### CI/CD
- `.github/workflows/build.yml` — Main build + unit tests
- `.github/workflows/build-image-pr.yml` — PR image build + Kind deploy
- `.github/workflows/python-tests.yml` — Python lint, unit, E2E, fuzz
- `.github/workflows/controller-test.yml` — Controller tests with envtest
- `.github/workflows/csi-test.yml` — CSI E2E with Kind + Helm
- `.github/workflows/trivy-image-scanning.yaml` — Weekly Trivy scan
- `.github/workflows/scorecard.yml` — OpenSSF Scorecard
- `.github/dependabot.yml` — Multi-ecosystem dependency updates

### Testing
- `internal/db/service/*_test.go` — Integration tests (Testcontainers)
- `internal/core/*_test.go` — Core business logic unit tests
- `pkg/inferenceservice-controller/*_test.go` — Controller unit tests
- `clients/ui/frontend/src/__tests__/cypress/` — Cypress E2E tests (22 files)
- `clients/python/` — Python client tests (nox sessions)
- `jobs/async-upload/tests/` — Async upload job tests

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks
- `clients/ui/bff/.golangci.yaml` — BFF linter config
- `clients/ui/frontend/.eslintrc.cjs` — Frontend ESLint config
- `clients/ui/frontend/jest.config.js` — Jest configuration

### Container Images
- `Dockerfile` — Server image (multi-arch, distroless)
- `Dockerfile.odh` — ODH variant (UBI9, CGO_ENABLED)
- `clients/ui/Dockerfile` — UI image (Node + Go + distroless)
- `jobs/async-upload/Dockerfile` — Async upload job image

### Agent Rules
- `AGENTS.md` — Comprehensive agent behavior policy + repo map + commands
- `CLAUDE.md` — Claude Code-specific guidance (mirrors AGENTS.md)
