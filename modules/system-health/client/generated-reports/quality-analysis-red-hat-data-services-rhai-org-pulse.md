---
repository: "red-hat-data-services/rhai-org-pulse"
overall_score: 8.2
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "293 unit tests via Vitest across client/server; strong test-to-code ratio (0.86:1); modules like releases (105) and team-tracker (79) have excellent coverage. Gaps in okr-hub and system-health (0 tests each)."
  - dimension: "Integration/E2E"
    score: 8.0
    status: "14 Playwright specs covering smoke + integration; matrix-driven CI for per-module integration; containerized test execution; shared helpers and constants."
  - dimension: "Build Integration"
    score: 8.5
    status: "PR-time container builds with smoke tests for both core and AI Eng images; kustomize overlay validation; multi-image build pipeline with layered architecture."
  - dimension: "Image Testing"
    score: 7.5
    status: "Smoke tests validate image startup, health endpoints, UI rendering, and routing. No vulnerability scanning (Trivy/Snyk) or SBOM generation."
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "No codecov/coveralls integration; no coverage thresholds; no PR coverage reporting; no coverage generation configured in vitest."
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "Mature 7-workflow pipeline: CI, integration tests, build/push, Claude AI review, guard configs, sync-preprod, claude-issues. Smart change detection, concurrency control, matrix strategy."
  - dimension: "Agent Rules"
    score: 9.5
    status: "Exceptional: AGENTS.md (vendor-neutral), .claude/CLAUDE.md (deep architecture), .claude/commands/ (pr-review, create-module), .github/instructions/review.instructions.md (automated review checklist). Guard workflow protects AI config changes."
critical_gaps:
  - title: "No code coverage tracking or enforcement"
    impact: "Cannot measure test effectiveness; no PR coverage regression alerts; blind spots in untested modules go undetected"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container vulnerability scanning"
    impact: "CVEs in base images and dependencies not detected until production; no SBOM for compliance"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Zero unit tests for okr-hub and system-health modules"
    impact: "Two active modules have no test coverage at all; bugs ship undetected"
    severity: "MEDIUM"
    effort: "8-16 hours"
  - title: "No SAST/CodeQL or secret detection"
    impact: "Static analysis vulnerabilities and leaked secrets not caught pre-merge"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add Vitest coverage generation and codecov integration"
    effort: "3-4 hours"
    impact: "Immediate visibility into coverage gaps; PR-level coverage reporting; prevents coverage regressions"
  - title: "Add Trivy container scanning to build-images workflow"
    effort: "1-2 hours"
    impact: "Automated CVE detection for all 6 container images before push to Quay"
  - title: "Enable CodeQL analysis workflow"
    effort: "1-2 hours"
    impact: "Free GitHub-native SAST scanning for JavaScript vulnerabilities"
  - title: "Add unit tests for system-health module"
    effort: "4-6 hours"
    impact: "Cover 6 Vue components and 8 JS files currently at 0% test coverage"
recommendations:
  priority_0:
    - "Add Vitest coverage generation (--coverage flag + v8/istanbul provider) and integrate with codecov for PR-level reporting"
    - "Add Trivy/Grype container scanning step to build-images.yml before pushing to Quay"
    - "Write unit tests for okr-hub and system-health modules (currently 0 tests each)"
  priority_1:
    - "Enable GitHub CodeQL workflow for JavaScript SAST scanning"
    - "Add Gitleaks or TruffleHog for secret detection in PRs"
    - "Add coverage thresholds (e.g., 70% minimum) to prevent coverage regressions"
    - "Add customer-insights module unit tests (only 1 test for 38 files)"
  priority_2:
    - "Add multi-architecture image builds (arm64) for developer parity"
    - "Add SBOM generation (Syft/SPDX) for compliance tracking"
    - "Consider adding API contract tests for the /api/modules/* endpoints"
    - "Add performance testing for dashboard load times"
---

# Quality Analysis: rhai-org-pulse

## Executive Summary

- **Overall Score: 8.2/10**
- **Repository Type**: Vue 3 + Express modular engineering dashboard
- **Primary Language**: JavaScript (646 JS files, 371 Vue components)
- **Framework**: Vue 3 SPA + Express backend, deployed on OpenShift via ArgoCD
- **Key Strengths**: Exceptionally mature CI/CD pipeline with 7 workflows, outstanding agent rules documentation, strong unit test coverage with 293 tests, innovative AI-powered code review with autofix, PR-time container smoke testing
- **Critical Gaps**: No coverage tracking/enforcement, no vulnerability scanning, two modules with zero tests
- **Agent Rules Status**: **Exemplary** — best-in-class multi-vendor AI agent documentation with config guard workflow

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | 293 tests via Vitest; strong coverage in core modules; gaps in okr-hub, system-health |
| Integration/E2E | 8.0/10 | 14 Playwright specs; matrix-driven CI; containerized execution |
| **Build Integration** | **8.5/10** | **PR-time container builds + smoke tests; kustomize validation; layered image architecture** |
| Image Testing | 7.5/10 | Health endpoint + UI smoke tests; no vulnerability scanning or SBOM |
| Coverage Tracking | 3.0/10 | No codecov; no thresholds; no PR reporting; no coverage generation |
| CI/CD Automation | 9.0/10 | 7 workflows; smart change detection; AI review; concurrency control |
| Agent Rules | 9.5/10 | AGENTS.md + .claude/CLAUDE.md + review instructions + guard workflow + commands |

**Weighted Overall: 8.2/10**

## Critical Gaps

### 1. No Code Coverage Tracking or Enforcement
- **Impact**: Cannot measure test effectiveness; coverage regressions go undetected; untested modules like okr-hub (0 tests) have no visibility
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Vitest supports `--coverage` with V8 or Istanbul providers. No `.codecov.yml`, no coverage thresholds in CI, no PR coverage comments. The 293 unit tests may cover a solid percentage but there's no way to know or enforce it.

### 2. No Container Vulnerability Scanning
- **Impact**: CVEs in Red Hat UBI9, Node.js 22, nginx base images and npm dependencies not detected before push to Quay
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: 6 Dockerfiles produce images pushed to Quay.io with no scanning step. `npm audit --omit=dev --audit-level=high` runs in CI (good) but only covers npm deps, not OS-level packages in base images. No Trivy, Snyk, or Grype integration. No SBOM generation.

### 3. Zero Unit Tests for okr-hub and system-health Modules
- **Impact**: Two active modules ship with zero automated test coverage
- **Severity**: MEDIUM
- **Effort**: 8-16 hours
- **Details**: okr-hub has 14 Vue components + 8 JS files, system-health has 6 Vue + 8 JS — all untested. customer-insights has only 1 test for 38 source files. This is a significant gap given the project's otherwise strong testing culture.

### 4. No SAST/CodeQL or Secret Detection
- **Impact**: Static analysis vulnerabilities and accidentally committed secrets not caught
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: No CodeQL, gosec, Semgrep, Gitleaks, or TruffleHog configured. While the Claude AI review catches some issues, it doesn't replace purpose-built static analysis tools. Socket Security is used for supply chain (good) but doesn't cover application-level SAST.

## Quick Wins

### 1. Add Vitest Coverage Generation + Codecov (3-4 hours)
Add to `vitest.config.mjs`:
```js
coverage: {
  provider: 'v8',
  reporter: ['text', 'lcov'],
  reportsDirectory: './coverage',
  thresholds: { lines: 60 }
}
```
Add to CI:
```yaml
- name: Run tests with coverage
  run: npm test -- --coverage
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: coverage/lcov.info
```

### 2. Add Trivy Container Scanning (1-2 hours)
Add after each image build in `build-images.yml`:
```yaml
- name: Scan image for vulnerabilities
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.CORE_BACKEND_IMAGE }}:${{ env.BUILD_SHA }}
    severity: CRITICAL,HIGH
    exit-code: 1
```

### 3. Enable CodeQL Analysis (1-2 hours)
```yaml
name: CodeQL
on: [push, pull_request]
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: github/codeql-action/init@v3
        with: { languages: javascript }
      - uses: github/codeql-action/analyze@v3
```

### 4. Add Unit Tests for system-health Module (4-6 hours)
- 6 Vue components + 8 JS server files with zero test coverage
- Start with server route handlers and data transformation logic
- Use existing patterns from `modules/team-tracker/server/__tests__/` as templates

## Detailed Findings

### CI/CD Pipeline

**Score: 9.0/10** — One of the most mature CI/CD setups analyzed.

**Workflow Inventory** (7 workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | PR, merge_group | Lint, test, build, kustomize validate, smoke tests |
| `integration-tests.yml` | PR, merge_group | Matrix-driven per-module Playwright tests |
| `build-images.yml` | Push to main/preprod | Build 6 images, smoke test, push to Quay, update deploy tags |
| `claude-review.yml` | PR (all types) | AI code review with autofix + structured verdict |
| `guard-ai-configs.yml` | PR | Protect AI config files (AGENTS.md, .claude/) |
| `claude-issues.yml` | Issue creation | AI-powered issue triage |
| `sync-preprod.yml` | Weekly cron | Auto-create main→preprod sync PR |

**Strengths**:
- Smart change detection using `dorny/paths-filter` and `git diff` — only builds/tests what changed
- Concurrency control (`cancel-in-progress: true`) on integration tests and builds
- Matrix strategy for integration tests — automatically tests only changed modules
- Merge queue support across all required checks (no-op jobs for queue events)
- Version bumping with collision detection (bumps until unused tag found)
- Layered image architecture: core → AI Eng, with proper `FROM` chain
- Socket Security for supply chain protection during `npm ci`

**Gaps**:
- No caching of Docker layers between builds (each CI run rebuilds from scratch)
- No parallel image builds (core backend + frontend build sequentially due to dependencies)
- Could benefit from build time reporting

### Test Coverage

**Unit Tests (8.5/10)**:

| Area | Test Files | Source Files | Ratio |
|------|-----------|-------------|-------|
| releases module | 105 | 186 | 0.56 |
| team-tracker module | 79 | 140 | 0.56 |
| ai-impact module | 35 | 94 | 0.37 |
| server/ | 13 | ~20 | 0.65 |
| shared/server/ | 25 | ~25 | 1.00 |
| product-builds | 7 | 27 | 0.26 |
| ai-catalyst | 5 | 27 | 0.19 |
| upstream-pulse | 3 | 24 | 0.13 |
| customer-insights | 1 | 38 | 0.03 |
| **okr-hub** | **0** | **22** | **0.00** |
| **system-health** | **0** | **14** | **0.00** |

- **Testing framework**: Vitest 4.x with jsdom (client) + node (server) projects
- **Vue testing**: @vue/test-utils for component tests
- **Mock patterns**: In-memory mock storage, scope registries, proper test isolation
- **Test quality**: Well-structured with `describe`/`it` blocks, proper setup/teardown
- **Workspace config**: Separate Vitest projects for server (node env) and client (jsdom env)

**Integration/E2E Tests (8.0/10)**:

- 14 Playwright specs: 1 smoke test + 13 integration tests (11 module + 2 cross-cutting)
- Container-based execution using `quay.io/browser/playwright-chromium` — no local browser installs needed
- Reusable composite action (`.github/actions/test-org-pulse-module/`) for CI
- Shared helpers (`helpers.js`) and constants (`constants.js`) for consistent patterns
- Tests cover: sidebar visibility, view loading, content rendering, API integration, error tracking
- Tag-based filtering (`@module-name`) for selective execution

**Coverage Tracking (3.0/10)**:
- **No coverage generation** configured in `vitest.config.mjs`
- **No codecov/coveralls** integration
- **No coverage thresholds** to prevent regressions
- **No PR-level coverage reporting**
- This is the biggest quality gap for an otherwise well-tested project

### Code Quality

**Score: 8.0/10**

**Linting**:
- ESLint 10.x with Vue plugin (`flat/essential` config)
- Custom ESLint rules: `no-cross-module-imports` (enforces module isolation), `no-module-process-env` (enforces secrets system)
- `lint-staged` + `husky` pre-commit hook runs ESLint on staged files
- CI lint step in both `ci.yml` and `build-images.yml`

**Validation scripts**:
- `validate:modules` — validates module.json manifests
- `validate:platform` — validates platform extension manifests
- `validate:openapi` — validates OpenAPI JSDoc annotations (minimum operation count)

**Code Organization**:
- Clean modular architecture with clear boundaries
- `@shared` alias for cross-cutting code
- Storage abstraction prevents raw filesystem access
- Module isolation enforced at lint level

**Gaps**:
- No `.pre-commit-config.yaml` (uses husky instead — adequate but less comprehensive)
- No TypeScript (by design — constraint #6), but no JSDoc type checking either
- No dead code detection or dependency analysis tools

### Container Images

**Score: 7.5/10**

**Build Process**:
- 6 Dockerfiles with multi-stage builds
- Red Hat UBI9 base images (`ubi9/nodejs-22-minimal`, `hi/nodejs`, `hi/nginx`)
- Hardened runtime images (distroless-like, minimal CVE surface)
- Layered architecture: core images → AI Eng extends core
- Proper USER directives (runs as non-root user 65532)

**Runtime Testing**:
- Backend smoke test: health endpoint validation (`/api/healthz`)
- Frontend smoke test: Full Playwright suite against containerized app
- Both core and AI Eng image variants tested
- Demo mode enables testing without external credentials

**Gaps**:
- **No vulnerability scanning** (Trivy, Snyk, Grype)
- **No SBOM generation** (Syft, SPDX)
- **No image signing/attestation** (cosign, Sigstore)
- No multi-architecture builds (Linux amd64 only; ARM workaround documented but not automated)
- No Docker layer caching in CI

### Security

**Score: 6.5/10**

**What's in place**:
- Socket Security supply chain protection during `npm ci`
- `npm audit --omit=dev --audit-level=high` in CI
- Guard workflow protecting AI configuration changes (AGENTS.md, .claude/)
- Non-root container execution (user 65532)
- Red Hat hardened base images (minimal attack surface)
- OAuth proxy for production auth
- Storage abstraction prevents path traversal
- DOMPurify for HTML sanitization (via `dompurify` dependency)
- Claude AI review checks for OWASP top 10 vulnerabilities

**Gaps**:
- No CodeQL/SAST workflow
- No Gitleaks/TruffleHog for secret detection
- No container vulnerability scanning
- No dependency pinning for GitHub Actions (some use `@v7`, `@v6` floating tags)
- No `.trivyignore` or vulnerability management process

### Agent Rules (Agentic Flow Quality)

**Score: 9.5/10** — Best-in-class among analyzed repositories.

**What's in place**:

| File | Purpose | Quality |
|------|---------|---------|
| `AGENTS.md` | Vendor-neutral conventions, hard constraints, architecture | Excellent — 9 hard constraints, testing policy, code style |
| `.claude/CLAUDE.md` | Deep architecture, API routes, deployment details, data flow | Excellent — comprehensive reference for AI agents |
| `.claude/commands/pr-review.md` | Structured PR review command | Good — clear steps |
| `.claude/commands/create-module.md` | Module scaffolding command | Good — automates boilerplate |
| `.github/instructions/review.instructions.md` | Review checklist with integration test enforcement | Excellent — OWASP, hard constraint validation, verdict rules |
| `.github/workflows/guard-ai-configs.yml` | Protects AI config files from unauthorized changes | Excellent — team-based approval via commit status API |
| `.github/workflows/claude-review.yml` | Automated AI code review on PRs with autofix | Excellent — fork-safe, structured verdict, Vertex AI backend |
| `.github/workflows/claude-issues.yml` | AI-powered issue triage | Good — automated classification |

**Strengths**:
- **Vendor-neutral**: `AGENTS.md` works for Claude, Copilot, Cursor, and any future AI tool
- **Defense in depth**: Guard workflow prevents unauthorized AI config changes
- **Integration test enforcement**: Review instructions require integration tests for module changes
- **Structured output**: Claude review uses JSON schema for machine-readable PASS/FAIL verdicts
- **Fork safety**: Separate read-only review path for fork PRs (no code execution)
- **Autofix**: Claude review can push fix commits directly, with lint+test validation

**Minor gaps**:
- No `.claude/rules/` directory with test type-specific rules
- Could benefit from test generation templates in agent instructions

## Recommendations

### Priority 0 (Critical)

1. **Add Vitest coverage generation + codecov integration** — The most impactful gap. 293 tests exist but coverage is unmeasured. Add `--coverage` flag and codecov upload. Effort: 3-4 hours.

2. **Add Trivy container scanning** — 6 images pushed to Quay with no vulnerability scanning. Add `aquasecurity/trivy-action` step before each image push. Effort: 1-2 hours.

3. **Write unit tests for okr-hub and system-health** — Two modules with 0 tests. Start with server-side logic and data transformations. Effort: 8-16 hours.

### Priority 1 (High Value)

4. **Enable CodeQL analysis** — Free SAST scanning for JavaScript. GitHub-native, minimal setup. Effort: 1-2 hours.

5. **Add secret detection** — Gitleaks or TruffleHog workflow to catch accidentally committed credentials. Effort: 1-2 hours.

6. **Add coverage thresholds** — Once codecov is integrated, set minimum thresholds (e.g., 60-70%) to prevent coverage regressions. Effort: 1 hour.

7. **Increase customer-insights test coverage** — Only 1 test for 38 source files (27 JS server files + 11 Vue components). Effort: 6-8 hours.

### Priority 2 (Nice-to-Have)

8. **Multi-architecture image builds** — Add `docker/build-push-action` with `platforms: linux/amd64,linux/arm64`. Effort: 4-6 hours.

9. **SBOM generation** — Add Syft/SPDX step for compliance. Effort: 2-3 hours.

10. **API contract tests** — The extensive OpenAPI annotations could drive automated contract testing against the Express API. Effort: 8-12 hours.

11. **Pin GitHub Actions by SHA** — Some actions use floating tags (`@v7`, `@v6`). Pin to commit SHA for supply chain safety. Effort: 2-3 hours.

12. **Docker layer caching** — Add `docker/setup-buildx-action` + cache-to/cache-from for faster CI builds. Effort: 2-3 hours.

## Comparison to Gold Standards

| Dimension | rhai-org-pulse | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit Tests | 8.5 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 8.0 | 9.0 | 6.0 | 8.0 |
| Build Integration | 8.5 | 7.0 | 8.0 | 7.0 |
| Image Testing | 7.5 | 7.0 | 9.0 | 6.0 |
| Coverage Tracking | 3.0 | 8.0 | 5.0 | 9.0 |
| CI/CD Automation | 9.0 | 8.0 | 7.0 | 8.0 |
| Agent Rules | **9.5** | 8.0 | 3.0 | 2.0 |
| **Overall** | **8.2** | **8.0** | **6.5** | **7.0** |

**Standout areas**:
- **Agent rules**: Best-in-class among all analyzed repositories — the guard workflow for AI configs is unique
- **CI/CD automation**: 7 workflows covering the full lifecycle including AI-powered review
- **Build integration**: PR-time container builds with Playwright smoke tests is gold-standard
- **Module isolation**: ESLint-enforced module boundaries with lint-time prevention

**Key gaps vs gold standards**:
- **Coverage tracking**: Significantly behind kserve (coverage enforcement) and odh-dashboard (codecov integration)
- **Vulnerability scanning**: Behind notebooks (Trivy + multi-layer validation)
- **SAST**: Behind odh-dashboard (CodeQL integration)

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yml` — PR validation (lint, test, build, kustomize)
- `.github/workflows/integration-tests.yml` — Per-module Playwright tests
- `.github/workflows/build-images.yml` — Image build, smoke test, push, deploy
- `.github/workflows/claude-review.yml` — AI code review with autofix
- `.github/workflows/guard-ai-configs.yml` — AI config change protection
- `.github/workflows/sync-preprod.yml` — Weekly main→preprod sync
- `.github/actions/test-org-pulse-module/action.yml` — Reusable integration test action

### Testing
- `vitest.config.mjs` — Vitest configuration (server + client projects)
- `playwright.config.js` — Playwright configuration
- `vitest.setup.js` — Vitest setup file
- `tests/smoke/app-loads.spec.js` — Smoke tests
- `tests/integration/*.spec.js` — Integration tests (13 files)
- `src/__tests__/` — Frontend unit tests (9 files)
- `server/__tests__/` — Server unit tests (9 files)
- `shared/server/__tests__/` — Shared server unit tests (13 files)
- `modules/*/__tests__/` — Module-specific unit tests

### Code Quality
- `eslint.config.mjs` — ESLint flat config with custom rules
- `eslint-rules/no-cross-module-imports.js` — Custom ESLint rule
- `eslint-rules/no-module-process-env.js` — Custom ESLint rule
- `.husky/pre-commit` — Runs lint-staged

### Container Images
- `deploy/core.backend.Dockerfile` — Core backend (UBI9 + hardened Node)
- `deploy/core.frontend.Dockerfile` — Core frontend (UBI9 + hardened nginx)
- `deploy/core.frontend-builder.Dockerfile` — Frontend builder stage
- `deploy/core.frontend-runtime.Dockerfile` — Frontend runtime stage
- `deploy/ai-eng.backend.Dockerfile` — AI Eng backend (extends core)
- `deploy/ai-eng.frontend.Dockerfile` — AI Eng frontend (extends core)

### Agent Rules
- `AGENTS.md` — Vendor-neutral agent conventions
- `.claude/CLAUDE.md` — Claude-specific deep reference
- `.claude/commands/pr-review.md` — PR review command
- `.claude/commands/create-module.md` — Module scaffolding command
- `.github/instructions/review.instructions.md` — Shared review checklist
