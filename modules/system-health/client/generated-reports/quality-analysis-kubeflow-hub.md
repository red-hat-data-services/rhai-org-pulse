---
repository: "kubeflow/hub"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Good Go/Python/TS coverage with testify, pytest, Jest; multi-DB testing but no enforcement thresholds"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Excellent KinD-based E2E across multi-K8s, multi-DB, multi-Python versions; fuzz testing included"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-time image build + KinD deployment + connectivity test for server, UI, controller, CSI"
  - dimension: "Image Testing"
    score: 7.5
    status: "Multi-arch builds (amd64+arm64), multi-stage Dockerfiles, UBI base, PR-time build validation"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "Codecov badge present but no codecov.yml config, no CI upload, no enforcement thresholds"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "33 workflows with excellent path filtering, SHA-pinned actions, OpenSSF Scorecard, SBOM+cosign"
  - dimension: "Agent Rules"
    score: 7.0
    status: "Comprehensive AGENTS.md with repo map, commands, and conventions; 4 custom skills; missing .claude/rules/"
critical_gaps:
  - title: "No coverage tracking or enforcement in CI"
    impact: "Coverage can silently regress on any PR without detection; codecov badge may be stale"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No SAST/CodeQL scanning"
    impact: "Security vulnerabilities in code patterns (injection, auth bypass) go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Trivy scanning only weekly, not on PRs"
    impact: "Vulnerable dependencies can be merged and deployed before weekly scan catches them"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No secret scanning workflow (Gitleaks/TruffleHog)"
    impact: "Accidentally committed secrets may not be caught by pre-commit alone"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No test-specific agent rules (.claude/rules/)"
    impact: "AI-generated tests may not follow project patterns for testcontainers, envtest, nox sessions"
    severity: "LOW"
    effort: "3-4 hours"
quick_wins:
  - title: "Add codecov.yml and enable coverage upload in build.yml"
    effort: "2-3 hours"
    impact: "Immediate visibility into coverage trends and PR-level regression detection"
  - title: "Add CodeQL workflow for Go and Python"
    effort: "1-2 hours"
    impact: "Automated detection of code-level security vulnerabilities"
  - title: "Add Trivy scanning to PR image build workflow"
    effort: "1-2 hours"
    impact: "Catch vulnerable dependencies before merge, not days later"
  - title: "Add Gitleaks to pre-commit or CI"
    effort: "1 hour"
    impact: "Prevent accidental secret commits beyond the basic detect-private-key hook"
  - title: "Create .claude/rules/ for test patterns"
    effort: "2-3 hours"
    impact: "AI agents produce tests matching project conventions (testcontainers, envtest, nox)"
recommendations:
  priority_0:
    - "Configure codecov.yml with coverage thresholds and upload coverage from build.yml workflow"
    - "Add CodeQL analysis workflow for Go and Python SAST scanning"
  priority_1:
    - "Move Trivy scanning to PR workflow in addition to weekly schedule"
    - "Add Gitleaks secret scanning to CI pipeline"
    - "Create .claude/rules/ with test pattern rules for Go (testcontainers), Python (nox/pytest), and TypeScript (Jest)"
  priority_2:
    - "Add golangci-lint configuration file (.golangci.yml) with explicit linter selection"
    - "Add accessibility testing for the UI frontend"
    - "Add contract tests between UI BFF and backend API"
    - "Consider adding E2E tests for the UI (Cypress/Playwright)"
---

# Quality Analysis: kubeflow/hub

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Polyglot monorepo (Go backend, Python clients, TypeScript/React UI)
- **Components**: Model Registry server, Catalog service, Controller, CSI storage-initializer, UI (BFF + frontend), async-upload job
- **Key Strengths**: Exceptional E2E testing with multi-version KinD deployments, comprehensive CI/CD with 33 workflows, SBOM generation + cosign signing, OpenSSF Scorecard, and a thorough AGENTS.md
- **Critical Gaps**: No coverage tracking/enforcement in CI, no SAST scanning, Trivy only runs weekly
- **Agent Rules Status**: Present and comprehensive (AGENTS.md), but missing `.claude/rules/` for test-specific patterns

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.0/10 | Good test coverage with testify, pytest, Jest; multi-DB testing |
| Integration/E2E | 9.0/10 | Excellent KinD-based E2E, multi-K8s/DB/Python versions, fuzz testing |
| **Build Integration** | **8.0/10** | **PR-time image build + KinD deployment + connectivity verification** |
| Image Testing | 7.5/10 | Multi-arch (amd64+arm64), multi-stage builds, UBI base images |
| Coverage Tracking | 4.0/10 | Coverage generation exists locally but no CI upload or enforcement |
| CI/CD Automation | 9.0/10 | 33 workflows, SHA-pinned actions, path filtering, OpenSSF Scorecard |
| Agent Rules | 7.0/10 | Comprehensive AGENTS.md + 4 custom skills, missing test-specific rules |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement in CI
- **Impact**: Coverage can silently regress on any PR without detection
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The repository has a Codecov badge in the README and `make test-cover` generates coverage locally, but there is no `codecov.yml` configuration file, no coverage upload step in the `build.yml` workflow, and no enforcement thresholds. The badge may be stale or non-functional.
- **Fix**: Add `codecov.yml` with project/patch coverage thresholds; add coverage upload step after `make test-cover` in `build.yml`; configure PR comments showing coverage diff.

### 2. No SAST/CodeQL Scanning
- **Impact**: Code-level security vulnerabilities (SQL injection, command injection, auth bypass) go undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: While Trivy scans container images for OS/library vulnerabilities, there is no static application security testing. CodeQL is referenced only for uploading Scorecard SARIF results, not for actual code analysis.
- **Fix**: Add a CodeQL analysis workflow scanning Go and Python code on PRs and pushes to main.

### 3. Trivy Scanning Only Weekly
- **Impact**: Vulnerable dependencies can be merged and remain in production for up to a week before detection
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: `trivy-image-scanning.yaml` runs on a weekly schedule (Monday 00:00 UTC). No vulnerability scanning occurs during the PR workflow. The `build-image-pr.yml` builds and deploys images but doesn't scan them.
- **Fix**: Add Trivy filesystem/repo scanning to PR workflows; optionally scan the built image in `build-image-pr.yml`.

### 4. No Secret Scanning Workflow
- **Impact**: Pre-commit `detect-private-key` catches only private key patterns, not other secret types
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: The pre-commit config includes `detect-private-key` but excludes test files. No Gitleaks, TruffleHog, or GitHub Secret Scanning workflow exists.

### 5. Missing Test-Specific Agent Rules
- **Impact**: AI agents generating tests may not follow project-specific patterns
- **Severity**: LOW
- **Effort**: 3-4 hours
- **Details**: AGENTS.md mentions testing requirements at a high level but lacks `.claude/rules/` with detailed test patterns for each component (Go testcontainers, envtest, Python nox sessions, TypeScript Jest patterns).

## Quick Wins

### 1. Add Codecov Configuration and Upload (2-3 hours)
Add `codecov.yml` and update `build.yml`:

```yaml
# codecov.yml
coverage:
  status:
    project:
      default:
        target: auto
        threshold: 2%
    patch:
      default:
        target: 80%
```

Add to `build.yml` after `make test-cover`:
```yaml
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: coverage.txt
    flags: go-unit
    token: ${{ secrets.CODECOV_TOKEN }}
```

### 2. Add CodeQL Workflow (1-2 hours)
```yaml
name: CodeQL
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'
permissions:
  security-events: write
  contents: read
jobs:
  analyze:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        language: [go, python]
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

### 3. Add Trivy to PR Image Build (1-2 hours)
Add after the image build step in `build-image-pr.yml`:
```yaml
- name: Trivy vulnerability scan
  uses: aquasecurity/trivy-action@v0
  with:
    image-ref: "${{ env.IMG_REGISTRY }}/${{ env.IMG_ORG }}/${{ env.IMG_REPO }}:${{ steps.tags.outputs.tag }}"
    format: table
    exit-code: 1
    severity: CRITICAL,HIGH
```

### 4. Add Gitleaks (1 hour)
Add to `.pre-commit-config.yaml`:
```yaml
- repo: https://github.com/gitleaks/gitleaks
  rev: v8.18.0
  hooks:
    - id: gitleaks
```

### 5. Create Test Pattern Agent Rules (2-3 hours)
Create `.claude/rules/` with rules for:
- `go-unit-tests.md` — testify assertions, testcontainers for DB tests, table-driven tests
- `go-controller-tests.md` — envtest setup, kubebuilder patterns
- `python-tests.md` — nox sessions, pytest fixtures, E2E with KinD
- `typescript-tests.md` — Jest patterns, PatternFly component testing

## Detailed Findings

### CI/CD Pipeline

**Strengths:**
- **33 workflow files** covering all components with intelligent path filtering
- **SHA-pinned actions** throughout — excellent supply chain security practice
- **OpenSSF Scorecard** integrated with weekly analysis and badge
- **Dependabot** configured for all 5 ecosystems (gomod, pip, docker, github-actions, npm)
- **Path-based triggers** prevent unnecessary CI runs
- **Reusable workflows** (`prepare.yml` called by multiple workflows)
- **First-time contributor handling** with automated welcome and approval flow
- **Concurrency control** in workflow approval

**PR Workflows (13 total):**
| Workflow | Trigger | What It Tests |
|----------|---------|---------------|
| `build.yml` | All PRs | Go compile + unit tests with coverage |
| `build-image-pr.yml` | Backend PRs | Docker build + KinD deploy + Python client connectivity |
| `build-image-ui-pr.yml` | UI PRs | UI Docker image build |
| `controller-test.yml` | Controller paths | envtest + controller image build |
| `csi-test.yml` | CSI paths | Full KinD E2E with storage-initializer |
| `python-tests.yml` | All PRs | Lint, mypy, unit tests, E2E on KinD, fuzz testing, catalog E2E |
| `async-upload-test.yml` | Async job paths | Python tests + E2E |
| `ui-frontend-build.yml` | UI paths | npm test + build |
| `ui-bff-build.yml` | UI paths | golangci-lint + Go build |
| `check-db-schema-structs.yaml` | All PRs | DB schema struct generation check |
| `check-gitattributes.yaml` | All PRs | .gitattributes validation |
| `check-openapi-spec-pr.yaml` | OpenAPI paths | OpenAPI spec validation |
| `go-mod-tidy-diff-check.yml` | All PRs | go.mod/go.sum cleanliness |

**Release Workflows (6 total):**
- All images: cosign signing + SBOM (SPDX JSON) + attestation
- Multi-architecture: linux/amd64 + linux/arm64 via buildx
- Python client release to PyPI via Poetry

**Gaps:**
- No coverage upload to external service
- No SAST scanning
- No Trivy on PRs

### Test Coverage

**Go (157 test files / 508 source files = 31% ratio):**
- `internal/core/` — Comprehensive business logic tests (artifact, experiment, inference_service, model_version, registered_model, serving_environment, etc.)
- `internal/converter/` — Converter utility tests
- `internal/db/service/` — Database service tests with testcontainers (MySQL, PostgreSQL)
- `internal/server/openapi/` — API service tests
- `internal/datastore/embedmd/` — Embedded metadata tests
- `pkg/inferenceservice-controller/` — Controller tests with envtest/kubebuilder
- `tools/catalog-gen/` — Catalog generator tests
- `catalog/cmd/` — Catalog config tests

**Python (38 test files / 210 source files = 18% ratio):**
- `clients/python/` — Model registry Python client with nox sessions (lint, mypy, tests, e2e, fuzz)
- `catalog/clients/python/` — Catalog Python client with E2E
- `jobs/async-upload/tests/` — Upload, download, config, models, MR client tests
- `tools/csv-exporter/tests/` — CSV export and compliance tests
- `test/python/` — Integration test (MR connectivity)

**TypeScript (55 test files / 347 source files = 16% ratio):**
- `clients/ui/frontend/src/` — Component tests, hook tests, API tests, utility tests
- PatternFly component testing
- Context provider tests
- Markdown component tests

**E2E Testing (Exceptional):**
- KinD cluster deployment for Python E2E (multi-K8s: v1.33.7, v1.34.3)
- Multi-database: MySQL (`db` overlay) and PostgreSQL (`postgres` overlay)
- Multi-Python: 3.10, 3.11, 3.12, 3.13, 3.14
- CSI E2E with Helm, KinD, and kustomize
- Fuzz testing on main pushes and OpenAPI-changing PRs
- Catalog E2E with dedicated KinD deployment
- Port-forwarding for service connectivity

**Coverage Generation:**
- `make test-cover` produces `coverage.txt` and `coverage.html`
- `make -C catalog test-cover` for catalog component
- Python: `--cov-report=xml` used in E2E nox session
- No upload to external tracking service

### Code Quality

**Linting:**
- Go: golangci-lint v2.9.0 (build) / v2.12.2 (BFF) — no project-level config file, using defaults
- Python: ruff (linting + formatting) + mypy (type checking) via nox sessions
- OpenAPI spec validation via openapi-generator-cli
- DB schema struct validation (generated code check)
- Go mod tidy diff check
- Gitattributes validation

**Pre-commit Hooks:**
- `check-added-large-files` — prevents large file commits
- `check-ast` — validates Python AST
- `check-json` — validates JSON syntax
- `check-merge-conflict` — catches unresolved conflicts
- `detect-private-key` — basic secret detection (excludes test files)
- `end-of-file-fixer` / `trailing-whitespace` — formatting
- `ruff` — Python linting + formatting (scoped to `clients/python`)

**Missing:**
- No project-level `.golangci.yml` with explicit linter selection
- Pre-commit hooks only cover Python (ruff), not Go linting
- No ESLint configuration visible (likely in `package.json` or webpack config)

### Container Images

**Dockerfiles (7 total):**
| Image | Dockerfile | Base | Build |
|-------|-----------|------|-------|
| Server | `Dockerfile` | UBI9 go-toolset → UBI9 minimal | Multi-stage, multi-arch |
| Server (ODH) | `Dockerfile.odh` | UBI9 go-toolset → UBI9 minimal | Multi-stage, amd64 only |
| UI | `clients/ui/Dockerfile` | — | Multi-arch |
| UI Standalone | `clients/ui/Dockerfile.standalone` | — | Multi-arch |
| Controller | `cmd/controller/Dockerfile.controller` | — | Multi-arch |
| CSI | `cmd/csi/Dockerfile.csi` | — | Multi-arch |
| Async Upload | `jobs/async-upload/Dockerfile` | — | Multi-arch |

**Security Features:**
- Cosign signing on all release images
- SBOM generation (SPDX JSON) via Syft/anchore on all release images
- SBOM attestation via cosign
- Non-root user (65532:65532) in server Dockerfile
- UBI9 minimal base images (Red Hat certified)
- Multi-stage builds with dependency caching

**PR Validation:**
- `build-image-pr.yml` builds server image, deploys to KinD, tests connectivity
- `build-image-ui-pr.yml` builds UI image
- Controller and CSI workflows also build images on PR

### Security

**Strengths:**
- OpenSSF Scorecard with published badge
- Trivy image scanning (5 images, CRITICAL+HIGH severity, SARIF upload)
- Cosign image signing and SBOM attestation
- Dependabot across all ecosystems
- SHA-pinned GitHub Actions throughout
- `permissions: read-all` default with minimal escalation
- FOSSA license compliance scanning
- UBI9 minimal base images

**Gaps:**
- No CodeQL/SAST scanning for code-level vulnerabilities
- No Gitleaks/TruffleHog for comprehensive secret detection
- Trivy only weekly, not on PRs
- No Snyk integration
- `detect-private-key` pre-commit hook excludes test files

### Agent Rules (Agentic Flow Quality)

**Status**: Present and comprehensive

**AGENTS.md (17KB):**
- Agent behavior policy with clear DOs and DON'Ts
- Context awareness guidelines
- Complete repository map with directory descriptions
- All commands documented (setup, build, lint, test, code generation, Docker)
- CI checks table explaining what runs on PRs
- Development workflow for AI agents (before changes, validation, commit hygiene)
- Auto-generated files clearly identified
- Core development principles per language (Go, TypeScript, Python)
- Testing requirements (bug fixes MUST include tests)
- Security checklist
- Database and OpenAPI change workflows

**Custom Skills (.agents/skills/):**
- `catalog-add-route` — Add new catalog routes
- `catalog-sample-data` — Generate sample catalog data
- `init-catalog` — Initialize catalog service
- `sync-catalog` — Sync catalog data

**Gaps:**
- No `.claude/rules/` directory with test-specific patterns
- No rules for testcontainers setup patterns
- No rules for envtest/kubebuilder test patterns
- No rules for nox session configuration
- No rules for PatternFly/Jest component testing patterns
- Custom skills are catalog-focused, no testing skills

**Recommendation**: Generate test pattern rules with `/test-rules-generator` covering:
- Go unit tests (testify, table-driven)
- Go integration tests (testcontainers MySQL/PostgreSQL)
- Go controller tests (envtest)
- Python tests (nox, pytest, E2E with KinD)
- TypeScript tests (Jest, PatternFly)

## Recommendations

### Priority 0 (Critical)

1. **Configure coverage tracking and enforcement**
   - Create `codecov.yml` with project coverage target (auto) and patch target (80%)
   - Add coverage upload step in `build.yml` after `make test-cover` and `make -C catalog test-cover`
   - Add Python coverage upload from E2E workflow (`--cov-report=xml`)
   - Enable PR comments showing coverage delta
   - Effort: 4-6 hours

2. **Add CodeQL analysis workflow**
   - Create `.github/workflows/codeql.yml` for Go and Python SAST scanning
   - Run on PRs and pushes to main, plus weekly schedule
   - Effort: 2-4 hours

### Priority 1 (High Value)

3. **Add PR-time vulnerability scanning**
   - Add Trivy filesystem scan to `build.yml` for dependency vulnerabilities
   - Add Trivy image scan to `build-image-pr.yml` for the built image
   - Set exit-code: 1 for CRITICAL severity, warning for HIGH
   - Effort: 2-3 hours

4. **Add comprehensive secret scanning**
   - Add Gitleaks to pre-commit config (all file types, not just private keys)
   - Optionally add a Gitleaks CI workflow for historical scanning
   - Effort: 1-2 hours

5. **Create test-specific agent rules**
   - Create `.claude/rules/go-unit-tests.md` with testify patterns, table-driven tests
   - Create `.claude/rules/go-integration-tests.md` with testcontainers patterns
   - Create `.claude/rules/go-controller-tests.md` with envtest patterns
   - Create `.claude/rules/python-tests.md` with nox/pytest patterns
   - Create `.claude/rules/typescript-tests.md` with Jest/PatternFly patterns
   - Effort: 3-4 hours

### Priority 2 (Nice-to-Have)

6. **Add explicit golangci-lint configuration**
   - Create `.golangci.yml` with specific linter selection rather than defaults
   - Enable security-focused linters (gosec, goconst, exhaustive)
   - Effort: 2-3 hours

7. **Add UI E2E testing**
   - Implement Cypress or Playwright E2E tests for the React frontend
   - Add to CI with the existing KinD-based deployment
   - Effort: 16-24 hours

8. **Add contract tests between UI BFF and backend**
   - Define API contracts between BFF and model registry server
   - Prevent breaking changes from being merged
   - Effort: 8-12 hours

9. **Add accessibility testing for UI**
   - Integrate axe-core or pa11y for automated a11y checks
   - Add to UI frontend build workflow
   - Effort: 4-6 hours

## Comparison to Gold Standards

| Dimension | kubeflow/hub | odh-dashboard | notebooks | kserve |
|-----------|-------------|---------------|-----------|--------|
| Unit Tests | Good (31% Go ratio) | Excellent | Good | Excellent |
| Integration/E2E | **Excellent** (multi-K8s/DB/Py) | Excellent | Good | Excellent |
| Build Integration | **Strong** (KinD deploy on PR) | Strong | N/A | Good |
| Image Testing | Strong (multi-arch, UBI, SBOM) | Good | **Excellent** (5-layer) | Good |
| Coverage Tracking | **Weak** (no CI upload) | Strong | Moderate | **Excellent** (enforcement) |
| CI/CD Automation | **Excellent** (33 workflows) | Excellent | Good | Excellent |
| Security Scanning | Good (Trivy, cosign, SBOM) | Good | Good | Good |
| Agent Rules | Good (AGENTS.md) | **Excellent** (rules/) | None | None |
| Fuzz Testing | **Present** (Python fuzz) | None | None | Limited |
| OpenSSF Scorecard | **Yes** | No | No | No |

**Notable Strengths vs. Gold Standards:**
- Fuzz testing is uncommon — kubeflow/hub has it
- OpenSSF Scorecard integration with published badge is best-in-class
- Multi-K8s version E2E testing (v1.33.7 + v1.34.3) exceeds most projects
- SBOM generation + cosign attestation on all release images is exemplary
- Multi-Python version testing (3.10-3.14) demonstrates broad compatibility commitment
- AGENTS.md is among the most comprehensive agent documentation seen

**Key Gap vs. Gold Standards:**
- Coverage tracking is the biggest gap — kserve has enforcement, odh-dashboard has reporting, hub has neither in CI

## File Paths Reference

### CI/CD Workflows
- `.github/workflows/build.yml` — Main build + unit tests
- `.github/workflows/build-image-pr.yml` — PR image build + KinD deploy
- `.github/workflows/python-tests.yml` — Python lint, unit, E2E, fuzz, catalog
- `.github/workflows/controller-test.yml` — Controller envtest
- `.github/workflows/csi-test.yml` — CSI E2E on KinD
- `.github/workflows/trivy-image-scanning.yaml` — Weekly Trivy scan
- `.github/workflows/scorecard.yml` — OpenSSF Scorecard
- `.github/workflows/build-and-push-image.yml` — Release with cosign + SBOM

### Test Directories
- `internal/core/*_test.go` — Business logic unit tests
- `internal/db/service/*_test.go` — Database integration tests (testcontainers)
- `pkg/inferenceservice-controller/*_test.go` — Controller tests (envtest)
- `clients/python/` — Python client (nox: lint, mypy, tests, e2e, fuzz)
- `catalog/clients/python/` — Catalog Python client (nox: lint, e2e)
- `clients/ui/frontend/src/**/*.spec.ts(x)` — UI component tests
- `test/csi/e2e_test.sh` — CSI E2E test script
- `jobs/async-upload/tests/` — Async upload Python tests

### Configuration
- `.pre-commit-config.yaml` — Pre-commit hooks
- `.github/dependabot.yml` — Dependency updates (5 ecosystems)
- `Makefile` — Build, test, lint, code generation targets
- `AGENTS.md` / `CLAUDE.md` — Agent rules and documentation
- `.agents/skills/` — Custom catalog skills
