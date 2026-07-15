---
repository: "red-hat-data-services/odh-dashboard-sync"
overall_score: 6.4
scorecard:
  - dimension: "Unit Tests"
    score: 6.5
    status: "170 spec files for 1543 source files (11% ratio); Jest + Testing Library; good docs but low backend coverage"
  - dimension: "Integration/E2E"
    score: 7.5
    status: "77 Cypress tests (mocked + 16 e2e); page object model; comprehensive mocked UI coverage"
  - dimension: "Build Integration"
    score: 3.0
    status: "No PR-time Docker build; no Konflux simulation; no manifest validation in CI"
  - dimension: "Image Testing"
    score: 2.5
    status: "Multi-stage Dockerfile exists but no runtime validation, no startup test, no image scanning"
  - dimension: "Coverage Tracking"
    score: 6.0
    status: "Codecov integration with PR comments but status checks are informational only (non-blocking)"
  - dimension: "CI/CD Automation"
    score: 5.5
    status: "Single test workflow with caching; no concurrency control; only 3 workflows total"
  - dimension: "Agent Rules"
    score: 1.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules or test automation guidance"
critical_gaps:
  - title: "No container image scanning or security testing"
    impact: "Vulnerabilities in base images and dependencies are never caught before deployment"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No PR-time Docker build validation"
    impact: "Dockerfile build failures discovered only after merge in Konflux/production"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Coverage checks are informational-only (non-blocking)"
    impact: "Coverage can regress without blocking PRs; no enforcement of quality gate"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "Backend has only 3 test files for 100 source files"
    impact: "Backend API logic (Fastify routes, K8s client interactions) is largely untested"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No SAST/CodeQL or secret detection"
    impact: "Security vulnerabilities and leaked secrets not detected in CI"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No pre-commit hooks"
    impact: "Linting and formatting issues only caught in CI, not at development time"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Catch CVEs in base images and npm dependencies before merge"
  - title: "Make Codecov status checks required (non-informational)"
    effort: "30 minutes"
    impact: "Prevent coverage regressions from being merged"
  - title: "Add CodeQL/SAST workflow"
    effort: "1-2 hours"
    impact: "Detect XSS, injection, and other security issues automatically"
  - title: "Add concurrency control to test workflow"
    effort: "15 minutes"
    impact: "Cancel stale CI runs, save runner minutes"
  - title: "Add pre-commit hooks for lint + format"
    effort: "1-2 hours"
    impact: "Shift lint failures left to developer workstation"
recommendations:
  priority_0:
    - "Add container image vulnerability scanning (Trivy) to PR workflow"
    - "Make Codecov status checks blocking (remove informational: true)"
    - "Add PR-time Docker build validation step"
  priority_1:
    - "Expand backend unit test coverage (routes, plugins, K8s client calls)"
    - "Add CodeQL/SAST security scanning workflow"
    - "Add Kustomize manifest validation to CI"
    - "Create agent rules (.claude/rules/) for test creation patterns"
  priority_2:
    - "Add pre-commit hooks (ESLint, Prettier, type-check)"
    - "Add secret detection (Gitleaks)"
    - "Add performance/bundle size regression checks"
    - "Add SBOM generation to image build"
---

# Quality Analysis: odh-dashboard-sync

## Executive Summary

- **Overall Score: 6.4/10**
- **Repository Type**: TypeScript/React web application with Node.js/Fastify backend (sync mirror of opendatahub-io/odh-dashboard)
- **Primary Language**: TypeScript (2,013 .ts/.tsx files)
- **Key Strengths**: Comprehensive Cypress mocked UI tests, strong ESLint configuration, good testing documentation, Codecov integration with coverage merging (Jest + Cypress), accessibility testing support (cypress-axe)
- **Critical Gaps**: No container scanning, no PR-time build validation, coverage is informational-only (non-blocking), backend severely under-tested, no SAST/secret detection, no agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, no .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.5/10 | 170 spec files for ~1543 source files; strong frontend utility coverage, weak backend |
| Integration/E2E | 7.5/10 | 77 Cypress tests with mocked + 16 e2e; page object model; good feature coverage |
| **Build Integration** | **3.0/10** | **No PR-time Docker build; no Konflux simulation; no manifest validation** |
| Image Testing | 2.5/10 | Multi-stage Dockerfile but no scanning, no runtime validation |
| Coverage Tracking | 6.0/10 | Codecov with merged Jest+Cypress coverage but informational-only status |
| CI/CD Automation | 5.5/10 | Single test workflow with caching; no concurrency; minimal workflow count |
| Agent Rules | 1.0/10 | No agent rules, no CLAUDE.md, no test automation guidance |

## Critical Gaps

### 1. No Container Image Scanning or Security Testing
- **Impact**: Vulnerabilities in UBI8/Node.js 18 base images and npm dependencies go undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Detail**: The Dockerfile uses `registry.access.redhat.com/ubi8/nodejs-18:latest` but no Trivy, Snyk, or Grype scanning is configured. The `npm ci` step could pull vulnerable packages with no gate.

### 2. No PR-time Docker Build Validation
- **Impact**: Dockerfile changes, build-arg issues, or broken npm builds are only caught post-merge in Konflux
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Detail**: The CI workflow runs `npm run test:backend && npm run test:frontend:coverage` but never actually builds the Docker image. A Dockerfile change that passes lint/tests could still break the containerized build.

### 3. Coverage Checks Are Informational-Only
- **Impact**: Coverage regressions can be merged without any CI gate
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Detail**: `.codecov.yml` sets `informational: true` for both project and patch status, and `fail_ci_if_error: false` on the upload action. The 70% patch target is aspirational, not enforced.

### 4. Backend Is Severely Under-Tested
- **Impact**: Fastify routes, K8s client interactions, plugins, and server logic have minimal test coverage
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Detail**: Only 3 test files (`objUtils.spec.ts`, `imageUtils.spec.ts`, `dockerRepositoryURL.spec.ts`) exist for 100+ backend source files covering routes, plugins, server setup, and utilities.

### 5. No SAST/CodeQL or Secret Detection
- **Impact**: XSS, injection vulnerabilities, and leaked secrets not caught in CI
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Detail**: No CodeQL workflow, no Semgrep, no Gitleaks, no TruffleHog. The `.env` files are committed (though they appear to contain non-sensitive defaults).

### 6. No Pre-commit Hooks
- **Impact**: Linting and formatting issues only caught in CI, increasing feedback loop time
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Detail**: No `.pre-commit-config.yaml` exists. ESLint is only run during `npm run test` in CI.

## Quick Wins

### 1. Add Trivy Container Scanning to PR Workflow
- **Effort**: 1-2 hours
- **Impact**: Catch CVEs in base images and npm dependencies before merge
- **Implementation**:
```yaml
- name: Build image for scanning
  run: docker build -t odh-dashboard:pr-${{ github.event.pull_request.number }} .
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'odh-dashboard:pr-${{ github.event.pull_request.number }}'
    format: 'sarif'
    exit-code: '1'
    severity: 'CRITICAL,HIGH'
```

### 2. Make Codecov Status Checks Required
- **Effort**: 30 minutes
- **Impact**: Prevent coverage regressions from being merged
- **Implementation**: In `.codecov.yml`, change `informational: true` to `informational: false` and set `fail_ci_if_error: true` on the upload action.

### 3. Add CodeQL/SAST Workflow
- **Effort**: 1-2 hours
- **Impact**: Detect XSS, injection, and other security issues automatically
- **Implementation**:
```yaml
name: CodeQL
on: [push, pull_request]
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript
      - uses: github/codeql-action/analyze@v3
```

### 4. Add Concurrency Control
- **Effort**: 15 minutes
- **Impact**: Cancel stale CI runs when new commits are pushed
- **Implementation**: Add to `test.yml`:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 5. Add Pre-commit Hooks
- **Effort**: 1-2 hours
- **Impact**: Shift lint failures left to developer workstation
- **Implementation**: Create `.pre-commit-config.yaml` with eslint, prettier, and type-check hooks.

## Detailed Findings

### CI/CD Pipeline

**Workflows (3 total)**:
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | push, pull_request | Lint, type-check, unit tests (Jest), Cypress mocked tests, coverage upload |
| `create-tag-release.yml` | workflow_dispatch | Create/push Quay image tags for releases |
| `pr-close-image-delete.yml` | PR closed | Clean up PR-specific Quay images |

**Strengths**:
- Node modules caching for repo, backend, and frontend (3 separate cache layers)
- Combined test pipeline covers lint + type-check + unit tests + Cypress in single job
- Cypress results uploaded as artifacts for debugging
- Codecov integration with coverage merging (Jest + Cypress instrumentation)

**Weaknesses**:
- No concurrency control — multiple CI runs for same PR waste runner time
- Single Node.js version matrix (18.x only) — no multi-version testing
- No Docker build validation in PR workflow
- No separate workflow for security scanning
- `fail_ci_if_error: false` on Codecov upload means coverage upload failures are silent

### Test Coverage

**Unit Tests (Jest)**:
- **Frontend**: 167 spec files testing utilities, hooks, and component logic
- **Backend**: Only 3 spec files (objUtils, imageUtils, dockerRepositoryURL)
- **Test-to-code ratio**: ~11% (170 test files / 1543 source files)
- **Framework**: Jest 28/29 with ts-jest, jsdom environment for frontend
- **Testing Library**: @testing-library/react, @testing-library/jest-dom, @testing-library/user-event
- **Coverage config**: collectCoverageFrom configured, excludes third_party and test files

**Cypress Tests (77 test files)**:
- **Mocked tests**: ~61 test files covering 18+ feature areas (model registry, pipelines, projects, model serving, hardware profiles, etc.)
- **E2E tests**: 16 test files (storage classes, data science projects, pipelines, dashboard navigation, settings, workbenches)
- **Infrastructure**: Page object model (75 page objects), custom commands, WebSocket support, intercept snapshots
- **Reporting**: Mochawesome + JUnit reporters, video on failure, screenshot capture
- **Coverage**: Cypress code coverage with @cypress/code-coverage, merged with Jest coverage via istanbul-merge

**Mock Infrastructure**:
- 103 mock factory files in `frontend/src/__mocks__/` covering K8s resources (Secrets, Routes, Roles, etc.)
- Well-structured mock pattern following project guidelines in `docs/testing.md`

**Accessibility Testing**:
- cypress-axe integrated for a11y checks
- Custom axe command in `cypress/support/commands/axe.ts`

### Code Quality

**ESLint Configuration**:
- **Frontend**: Comprehensive setup with 50+ rules including:
  - `@typescript-eslint` strict rules (no-unnecessary-condition, no-base-to-string, consistent-type-assertions)
  - React hooks rules (exhaustive-deps, rules-of-hooks)
  - Accessibility (jsx-a11y plugin with custom anchor/autofocus rules)
  - Import ordering and restrictions
  - No hard-coded product names (enforced via no-restricted-syntax)
  - Cypress-specific overrides for test files
  - `no-only-tests` plugin prevents committed `.only` tests
  - `no-console` enforced in production code
- **Backend**: Lighter ESLint config with prettier integration, `@typescript-eslint/explicit-module-boundary-types` enforced

**TypeScript Strictness**:
- **Frontend**: `strict: true` with `noImplicitReturns`, `noImplicitThis`, `noImplicitAny`
- **Backend**: Only `noImplicitAny: true` (not full strict mode)

**Formatting**: Prettier configured with consistent settings (singleQuote, trailingComma: all, printWidth: 100)

**No pre-commit hooks**: Linting only runs in CI

### Container Images

**Dockerfile**:
- Multi-stage build (builder → runtime)
- UBI8/Node.js 18 base image
- Non-root user (1001:0)
- Production-only npm install in runtime stage (`--omit=dev --omit=optional`)
- Proper COPY --chown for file ownership
- Labeled with OKD/OpenShift metadata

**Missing**:
- No image scanning (Trivy, Snyk, Grype)
- No runtime startup validation
- No healthcheck defined in Dockerfile
- No SBOM generation
- No image signing/attestation
- No multi-architecture build in CI (Makefile has `docker-buildx` target but it's manual only)

### Build Integration

**Makefile targets**: build, push, deploy, undeploy, port-forward, docker-buildx
- `docker-buildx` supports linux/s390x, linux/amd64, linux/ppc64le
- But none of these targets are invoked in CI

**Kustomize manifests**: 29 kustomization.yaml files covering ODH, RHOAI (addon, onprem, shared), common resources
- No CI validation of Kustomize builds
- No manifest linting (kube-linter, conftest)

### Security

**Present**:
- Dependabot for GitHub Actions updates (monthly, Mondays)
- Non-root container user
- `chromeWebSecurity: false` in Cypress (test-only, acceptable)

**Missing**:
- No SAST (CodeQL, Semgrep, gosec)
- No container scanning (Trivy, Snyk)
- No secret detection (Gitleaks, TruffleHog)
- No dependency vulnerability scanning for npm packages
- Dependabot only covers GitHub Actions, not npm packages
- `.env` files committed (appear to be non-sensitive defaults, but pattern is risky)

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no CLAUDE.md, no AGENTS.md, no `.claude/` directory
- **Quality**: N/A
- **Gaps**: Complete absence of agent rules for any test type
- **Documentation**: `docs/testing.md` exists with good unit test guidelines but no agent-consumable rules
- **Recommendation**: Generate rules with `/test-rules-generator` covering:
  - Unit test patterns (Jest + Testing Library)
  - Cypress mocked test patterns
  - Cypress E2E test patterns
  - Mock factory patterns
  - Page object patterns

## Recommendations

### Priority 0 (Critical)

1. **Add container image vulnerability scanning** — Integrate Trivy into the PR workflow to scan the built Docker image. This is the single highest-impact security improvement. (2-4 hours)

2. **Make Codecov status checks blocking** — Change `informational: true` to `informational: false` in `.codecov.yml` and set `fail_ci_if_error: true`. This enforces the 70% patch target. (30 minutes)

3. **Add PR-time Docker build validation** — Add a job to `test.yml` that runs `docker build` to catch Dockerfile issues before merge. (4-6 hours)

### Priority 1 (High Value)

4. **Expand backend unit test coverage** — The backend has only 3 test files for 100+ source files. Prioritize testing routes (model serving, pipelines, projects), plugins, and K8s client utilities. (16-24 hours)

5. **Add CodeQL/SAST security scanning** — Add a CodeQL workflow for JavaScript/TypeScript to catch XSS, injection, and other vulnerabilities. (1-2 hours)

6. **Add Kustomize manifest validation** — Run `kustomize build` on all overlays in CI to catch manifest errors before merge. (2-3 hours)

7. **Create agent rules for test automation** — Use `/test-rules-generator` to generate `.claude/rules/` with unit, Cypress, mock factory, and page object patterns. (2-3 hours)

### Priority 2 (Nice-to-Have)

8. **Add pre-commit hooks** — Create `.pre-commit-config.yaml` with ESLint, Prettier, and type-check hooks. (1-2 hours)

9. **Add secret detection** — Integrate Gitleaks as a pre-commit hook and CI check. (1-2 hours)

10. **Add bundle size regression checks** — Use webpack-bundle-analyzer or size-limit to track bundle size in PRs. (2-3 hours)

11. **Add SBOM generation** — Use Syft or Docker SBOM to generate software bill of materials during image build. (1-2 hours)

12. **Extend Dependabot to npm packages** — Add npm ecosystem to `.github/dependabot.yml` for automated dependency updates. (15 minutes)

## Comparison to Gold Standards

| Dimension | odh-dashboard-sync | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|-----------|-------------------|---------------------|-------------------|---------------|
| Unit Tests | 6.5 — 170 files, 11% ratio | 9.0 — comprehensive | 7.0 — scripts/tests | 8.5 — Go testing |
| Integration/E2E | 7.5 — 77 Cypress tests | 9.0 — multi-layer | 6.0 — image testing | 9.0 — multi-version |
| Build Integration | 3.0 — no PR build | 7.0 — PR builds | 8.0 — image pipelines | 7.5 — operator testing |
| Image Testing | 2.5 — no scanning | 6.0 — basic scanning | 9.5 — 5-layer validation | 7.0 — multi-arch |
| Coverage Tracking | 6.0 — informational | 8.5 — enforced | 5.0 — minimal | 8.0 — thresholds |
| CI/CD Automation | 5.5 — 3 workflows | 9.0 — comprehensive | 8.0 — well-organized | 8.5 — with caching |
| Agent Rules | 1.0 — none | 8.0 — comprehensive | 3.0 — basic | 2.0 — minimal |

**Note**: This repository (`red-hat-data-services/odh-dashboard-sync`) is a sync/mirror of `opendatahub-io/odh-dashboard`. The upstream repo may have additional CI/CD configurations not present in this downstream mirror. Some gaps (like missing workflows) may be intentional if CI runs upstream only.

## File Paths Reference

| Category | File |
|----------|------|
| CI Test Workflow | `.github/workflows/test.yml` |
| CI Release | `.github/workflows/create-tag-release.yml` |
| CI PR Cleanup | `.github/workflows/pr-close-image-delete.yml` |
| Dockerfile | `Dockerfile` |
| Makefile | `Makefile` |
| Codecov Config | `.codecov.yml` |
| Frontend ESLint | `frontend/.eslintrc` |
| Backend ESLint | `backend/.eslintrc` |
| Frontend Jest Config | `frontend/jest.config.js` |
| Backend Jest Config | `backend/jest.config.js` |
| Cypress Config | `frontend/src/__tests__/cypress/cypress.config.ts` |
| Frontend TypeScript | `frontend/tsconfig.json` |
| Backend TypeScript | `backend/tsconfig.json` |
| Testing Docs | `docs/testing.md` |
| Dependabot | `.github/dependabot.yml` |
| Mock Factories | `frontend/src/__mocks__/` (103 files) |
| Cypress Pages | `frontend/src/__tests__/cypress/cypress/pages/` (75 files) |
| Kustomize Manifests | `manifests/` (29 kustomization.yaml files) |
