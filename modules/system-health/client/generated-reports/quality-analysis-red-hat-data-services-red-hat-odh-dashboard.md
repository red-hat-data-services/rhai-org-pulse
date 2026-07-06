---
repository: "red-hat-data-services/red-hat-odh-dashboard"
overall_score: 5.2
scorecard:
  - dimension: "Unit Tests"
    score: 6.0
    status: "167 frontend spec files with Jest/RTL, but only 3 backend tests and no coverage thresholds"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "72 Cypress tests (56 mocked + 16 e2e) with page object pattern and intercept snapshots"
  - dimension: "Build Integration"
    score: 2.0
    status: "No PR-time image build, no Konflux simulation, no kustomize validation"
  - dimension: "Image Testing"
    score: 3.0
    status: "Multi-stage Dockerfiles with UBI base but no scanning, no runtime validation"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "Codecov configured but informational-only, no enforced thresholds, 70% patch target not blocking"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "Single test workflow with caching, but no concurrency control, no security scanning, minimal workflows"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No .claude directory, no CLAUDE.md, no AGENTS.md, no test creation rules"
critical_gaps:
  - title: "No security scanning in CI"
    impact: "Vulnerabilities in dependencies and container images go undetected until downstream Konflux pipeline"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No PR-time container image build or validation"
    impact: "Dockerfile/Konflux build failures discovered only after merge"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "Coverage is informational-only, no enforcement"
    impact: "Coverage can drop without blocking PRs — regressions accumulate silently"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "Backend has only 3 test files for 98 source files"
    impact: "Fastify route handlers, middleware, and K8s proxy logic are largely untested"
    severity: "HIGH"
    effort: "20-40 hours"
  - title: "No kustomize/manifest validation on PR"
    impact: "Broken kustomize overlays (ODH/RHOAI) discovered only at deployment time"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No pre-commit hooks"
    impact: "Lint and format issues caught only in CI, increasing review cycle time"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add concurrency control to test workflow"
    effort: "30 minutes"
    impact: "Cancel superseded runs to save CI minutes and reduce queue time"
  - title: "Switch Codecov from informational to blocking"
    effort: "1 hour"
    impact: "Prevent coverage regressions from being merged"
  - title: "Add Trivy container scanning to PR workflow"
    effort: "2 hours"
    impact: "Catch CVEs in base images and dependencies before merge"
  - title: "Add pre-commit hooks for lint and format"
    effort: "1-2 hours"
    impact: "Shift-left lint failures, reduce CI feedback loops"
  - title: "Add PR-time Docker build smoke test"
    effort: "2-3 hours"
    impact: "Validate that the image builds successfully before merge"
  - title: "Create basic agent rules for test patterns"
    effort: "2-3 hours"
    impact: "Enable AI-assisted test generation with consistent patterns"
recommendations:
  priority_0:
    - "Add container vulnerability scanning (Trivy/Snyk) to the PR workflow"
    - "Enforce Codecov coverage thresholds — switch from informational to required checks"
    - "Add PR-time Docker image build validation to catch build regressions pre-merge"
  priority_1:
    - "Expand backend test coverage — add tests for route handlers, middleware, and K8s proxy"
    - "Add kustomize build validation for ODH and RHOAI overlays in CI"
    - "Add CodeQL/SAST scanning workflow for static analysis"
    - "Create comprehensive agent rules for test automation (.claude/rules/)"
  priority_2:
    - "Add accessibility testing enforcement (cypress-axe is installed but underutilized)"
    - "Add pre-commit hooks via .pre-commit-config.yaml"
    - "Add performance testing for frontend bundle size regression detection"
    - "Add secret detection (Gitleaks) to CI pipeline"
---

# Quality Analysis: red-hat-odh-dashboard

## Executive Summary

- **Overall Score: 5.2/10**
- **Repository Type**: TypeScript/React web application (downstream Red Hat fork of opendatahub-io/odh-dashboard)
- **Architecture**: Frontend (React 18 + PatternFly 6) + Backend (Fastify + Node.js 18)
- **Key Strengths**: Well-structured Cypress test suite with page object pattern, strong frontend ESLint configuration, mocked + e2e test separation, Codecov integration
- **Critical Gaps**: No security scanning, no PR-time image build validation, coverage thresholds not enforced, backend nearly untested, no agent rules
- **Agent Rules Status**: Missing — no `.claude/` directory or `CLAUDE.md`

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.0/10 | 167 frontend spec files with Jest/RTL, but only 3 backend tests |
| Integration/E2E | 7.0/10 | 72 Cypress tests (56 mocked + 16 e2e) with page objects |
| **Build Integration** | **2.0/10** | **No PR-time image build, no Konflux simulation** |
| Image Testing | 3.0/10 | Multi-stage Dockerfiles but no scanning or runtime validation |
| Coverage Tracking | 4.0/10 | Codecov exists but informational-only, no enforced thresholds |
| CI/CD Automation | 5.0/10 | Single test workflow with caching, minimal security |
| Agent Rules | 0.0/10 | No test automation guidance for AI agents |

## Critical Gaps

### 1. No Security Scanning in CI
- **Impact**: Vulnerabilities in npm dependencies and UBI8 base images go undetected until the downstream Konflux pipeline or manual auditing
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No Trivy, Snyk, CodeQL, or any SAST/DAST integration. Dependabot is configured but only for GitHub Actions ecosystem updates (not npm packages)

### 2. No PR-time Container Image Build or Validation
- **Impact**: Dockerfile or Dockerfile.konflux build failures are discovered only after merge, requiring hotfixes
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The Makefile has `build` and `docker-buildx` targets, but these are not invoked in any CI workflow. The Konflux Dockerfile pins a specific UBI8 digest — stale pins can break silently

### 3. Coverage Enforcement is Informational-Only
- **Impact**: PR coverage can drop without blocking merge — regressions accumulate over time
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: `.codecov.yml` sets both `project` and `patch` status to `informational: true`. The patch target of 70% and the 1% threshold are advisory only. No Jest `coverageThreshold` is configured either

### 4. Backend is Severely Under-Tested
- **Impact**: Fastify route handlers, K8s API proxy, authentication middleware, and metrics endpoints have virtually no test coverage
- **Severity**: HIGH
- **Effort**: 20-40 hours
- **Details**: Only 3 spec files (`objUtils`, `imageUtils`, `dockerRepositoryURL`) exist for 98 backend source files (~3% test-to-code ratio). The backend handles critical RHOAI functionality including K8s resource proxying, RBAC, and SSO

### 5. No Kustomize/Manifest Validation on PR
- **Impact**: Broken kustomize overlays (ODH/RHOAI variants with `params.yaml`, `params.env`, connection types) are discovered only at deployment time
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: The `manifests/` directory contains ODH and RHOAI overlays with kustomization files, but no CI step validates that `kustomize build` succeeds

### 6. No Pre-Commit Hooks
- **Impact**: Lint and formatting issues are caught only in CI, increasing review cycle time and wasting CI minutes
- **Severity**: MEDIUM
- **Effort**: 1-2 hours

## Quick Wins

### 1. Add Concurrency Control to Test Workflow
- **Effort**: 30 minutes
- **Impact**: Cancel superseded PR runs to save CI minutes
- **Implementation**:
```yaml
# Add to .github/workflows/test.yml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

### 2. Switch Codecov to Blocking Mode
- **Effort**: 1 hour
- **Impact**: Prevent coverage regression from being merged
- **Implementation**:
```yaml
# .codecov.yml - change informational to false
coverage:
  status:
    project:
      default:
        informational: false
        target: auto
        threshold: 1%
    patch:
      default:
        informational: false
        target: 70%
```

### 3. Add Trivy Container Scanning
- **Effort**: 2 hours
- **Impact**: Catch CVEs in UBI8 base images and npm dependencies
- **Implementation**:
```yaml
# Add new workflow or step
- name: Build image for scanning
  run: docker build -t dashboard:scan .
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'dashboard:scan'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
```

### 4. Add Pre-Commit Hooks
- **Effort**: 1-2 hours
- **Impact**: Shift-left lint and format checking
- **Implementation**:
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
  - repo: https://github.com/pre-commit/mirrors-prettier
    rev: v3.1.0
    hooks:
      - id: prettier
        types_or: [typescript, tsx, json, scss]
```

### 5. Add PR-time Docker Build Smoke Test
- **Effort**: 2-3 hours
- **Impact**: Catch Dockerfile regressions before merge
- **Implementation**:
```yaml
- name: Build Docker image
  run: docker build -f Dockerfile -t dashboard:pr-${{ github.event.pull_request.number }} .
- name: Verify image starts
  run: |
    docker run -d --name smoke -p 9090:8080 dashboard:pr-${{ github.event.pull_request.number }}
    sleep 5
    curl -sf http://localhost:9090/ || exit 1
    docker stop smoke
```

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory** (4 total — minimal for a project this size):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | push, pull_request | Lint, type-check, Jest, Cypress (mocked), coverage upload |
| `pr-close-image-delete.yml` | PR closed | Delete Quay image for closed PR |
| `create-tag-release.yml` | workflow_dispatch | Retag Quay image for ODH releases |
| `dependabot.yml` | monthly | GitHub Actions ecosystem updates only |

**Strengths**:
- Good npm caching strategy (repo, backend, frontend caches with lockfile hashing)
- Cypress results uploaded as artifacts
- Coverage uploaded to Codecov
- Checks for uncommitted changes after install

**Weaknesses**:
- No concurrency control — multiple PR pushes queue redundant runs
- Single Node.js version matrix (18.x only)
- No separate job for lint vs. tests (all-or-nothing)
- No image build step in any workflow
- `fail_ci_if_error: false` on Codecov upload — failures are silently ignored
- No workflow for periodic/nightly tasks

### Test Coverage

**Frontend Unit Tests (167 spec files / 1432 source files = 11.7% test-to-code ratio)**:
- Framework: Jest 28 + React Testing Library + jest-environment-jsdom
- Well-organized co-located `__tests__/` directories per feature:
  - Utilities (`valueUnits`, `useFetchState`, `useValidation`, etc.)
  - API layer (`proxyUtils`, `k8sUtils`, `errorUtils`)
  - Components (`ErrorBoundary`, `useCheckboxTable`)
  - Concepts (`connectionTypes`, `modelRegistry`, `pipelines`)
  - Pages (`BYONImages`, `hardwareProfiles`, `modelServing`)
- Coverage collection configured (`jest-coverage/` directory)
- No coverage thresholds enforced in Jest config

**Frontend Cypress Tests (72 test files)**:
- **Mocked tests (56 files)**: Run in CI — comprehensive UI interaction testing with intercepted API responses
  - Features: home, projects, pipelines, model registry, model serving, connection types, storage classes, accelerator profiles, distributed workloads, user management
- **E2E tests (16 files)**: Run against real cluster — project creation, permissions, workbenches, pipelines, cluster settings, storage
- **Infrastructure**:
  - 74 page objects (well-structured, feature-organized)
  - Custom `cy.interceptOdh` command for API mocking
  - `cy.visitWithLogin` for authenticated navigation
  - Snapshot-based intercept recording (`CY_RECORD` mode)
  - Mochawesome + JUnit reporters
  - Code coverage integration (`@cypress/code-coverage`)
  - Coverage merging (Jest + Cypress via istanbul-merge)
  - Video capture with failure-only retention
  - Retry support for e2e tests (2 retries in run mode)
  - High-resolution screenshots (1920x1080)

**Backend Tests (3 spec files / 98 source files = 3.1% test-to-code ratio)**:
- Framework: Jest 29 + ts-jest
- Only utility functions tested (`objUtils`, `imageUtils`, `dockerRepositoryURL`)
- **Critical gap**: No tests for Fastify route handlers, K8s proxy middleware, auth flows, or metrics endpoints

### Code Quality

**Frontend ESLint** — Comprehensive and strict:
- TypeScript strict mode rules (`@typescript-eslint/no-unnecessary-condition`, `explicit-module-boundary-types`)
- React hooks rules enforced (`exhaustive-deps`, `rules-of-hooks`)
- Accessibility: `jsx-a11y` plugin with custom anchor and autofocus rules
- Import organization enforced with `eslint-plugin-import`
- Custom rules for product name abstraction (no hardcoded "Red Hat OpenShift AI" or "Open Data Hub")
- No `.only` tests allowed (`no-only-tests`)
- No type assertions outside test files
- Cypress-specific overrides for `import type` enforcement
- Custom rule against direct `cy.visit` (must use `cy.visitWithLogin`)
- `--max-warnings 0` enforced in CI

**Backend ESLint** — Basic but adequate:
- TypeScript + Prettier integration
- Custom rule against `.toString()` usage (log errors properly)
- Less strict than frontend (allows `no-explicit-any`)

**Prettier**: Configured consistently across both packages (arrowParens, singleQuote, trailingComma, printWidth: 100)

**Missing**:
- No pre-commit hooks
- No CodeQL/SAST
- No secret detection (Gitleaks/TruffleHog)
- Dependabot only covers GitHub Actions, not npm packages

### Container Images

**Dockerfiles**:
- `Dockerfile` — Standard build with configurable base image (`ubi8/nodejs-18:latest`)
- `Dockerfile.konflux` — Pinned UBI8 digest for reproducible Konflux builds, RHOAI branding env vars

**Strengths**:
- Multi-stage builds (builder → runtime)
- UBI8 base images for Red Hat compliance
- Non-root user (1001:0)
- Production-only dependencies in runtime stage
- Multi-architecture support via `docker-buildx` Makefile target (s390x, amd64, ppc64le)
- Proper LABEL metadata

**Weaknesses**:
- No vulnerability scanning (Trivy/Snyk)
- No image startup validation in CI
- No SBOM generation
- No image signing/attestation
- Konflux Dockerfile uses pinned digest but no automation to keep it current
- No `.hadolint.yaml` for Dockerfile linting

### Security

**Current State**: Minimal security tooling

| Practice | Status |
|----------|--------|
| Container scanning (Trivy/Snyk) | Not configured |
| SAST (CodeQL/Semgrep) | Not configured |
| Dependency scanning | Dependabot for GH Actions only (not npm) |
| Secret detection | Not configured |
| SBOM generation | Not configured |
| Image signing | Not configured |
| License compliance | Not configured |

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No test type rules exist
- **Quality**: N/A
- **Gaps**: No `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`, no test creation rules
- **Impact**: AI agents (Claude Code, Copilot) have no project-specific guidance for generating tests, understanding test patterns, or following established conventions
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - Jest unit test patterns (React Testing Library, hooks testing)
  - Cypress mocked test patterns (interceptOdh, page objects)
  - Cypress e2e test patterns (visitWithLogin, OC commands)
  - Backend Fastify test patterns
  - Coverage requirements and naming conventions

## Recommendations

### Priority 0 (Critical)

1. **Add container vulnerability scanning** — Integrate Trivy or Snyk into the PR workflow to catch CVEs in UBI8 base images and npm dependency tree before merge
2. **Enforce coverage thresholds** — Switch `.codecov.yml` from `informational: true` to `informational: false` on both project and patch status. Add Jest `coverageThreshold` config
3. **Add PR-time Docker image build** — Add a CI step that builds both `Dockerfile` and `Dockerfile.konflux` on PRs to catch build regressions early
4. **Expand backend test coverage** — The backend handles K8s API proxying, auth, and RBAC with only 3 test files. Priority areas: route handlers, middleware, proxy logic

### Priority 1 (High Value)

1. **Add kustomize manifest validation** — Run `kustomize build` for ODH and RHOAI overlays in CI to catch manifest errors before deployment
2. **Add CodeQL/SAST scanning** — Enable GitHub CodeQL for TypeScript to catch injection, data flow, and logic issues
3. **Extend Dependabot to npm ecosystem** — Currently only monitors GitHub Actions; npm packages should be scanned too
4. **Create comprehensive agent rules** — Generate `.claude/rules/` with test creation guidance covering Jest, Cypress mocked, and Cypress e2e patterns

### Priority 2 (Nice-to-Have)

1. **Enforce accessibility testing** — `cypress-axe` is installed but barely used; add a11y checks to core Cypress flows
2. **Add pre-commit hooks** — Shift lint and format checking left to save CI time
3. **Add bundle size monitoring** — Webpack bundle analyzer is available but not integrated into CI
4. **Add secret detection** — Integrate Gitleaks into the PR workflow
5. **Add Dockerfile linting** — Configure Hadolint for both Dockerfiles
6. **Performance regression testing** — Track Lighthouse scores or bundle metrics across PRs

## Comparison to Gold Standards

| Dimension | red-hat-odh-dashboard | odh-dashboard (upstream) | notebooks | kserve |
|-----------|----------------------|--------------------------|-----------|--------|
| Unit Tests | 6/10 (167 frontend, 3 backend) | 8/10 (comprehensive) | 5/10 | 8/10 |
| Integration/E2E | 7/10 (72 Cypress tests) | 9/10 (mocked + e2e + contract) | 6/10 | 9/10 |
| Build Integration | 2/10 (none) | 5/10 (basic) | 7/10 | 7/10 |
| Image Testing | 3/10 (build only) | 4/10 | 9/10 (5-layer) | 6/10 |
| Coverage Tracking | 4/10 (informational) | 7/10 (enforced) | 5/10 | 8/10 |
| CI/CD Automation | 5/10 (minimal) | 8/10 (comprehensive) | 8/10 | 9/10 |
| Agent Rules | 0/10 (none) | 5/10 (partial) | 2/10 | 2/10 |
| **Overall** | **5.2/10** | **7.5/10** | **7.0/10** | **8.0/10** |

**Key Differentiators vs. Upstream (odh-dashboard)**:
- Upstream has more comprehensive CI workflows and test suites
- This downstream fork has minimal CI — primarily relies on the upstream test suite
- The downstream Konflux build pipeline adds some validation but is not visible in the repo's CI
- Agent rules are absent in both, but upstream has more documentation

## File Paths Reference

### CI/CD
- `.github/workflows/test.yml` — Main test workflow
- `.github/workflows/pr-close-image-delete.yml` — PR cleanup
- `.github/workflows/create-tag-release.yml` — Release tagging
- `.github/dependabot.yml` — GH Actions updates only
- `Makefile` — Build, push, deploy targets

### Testing
- `frontend/jest.config.js` — Frontend Jest configuration
- `backend/jest.config.js` — Backend Jest configuration
- `frontend/src/__tests__/cypress/cypress.config.ts` — Cypress configuration
- `frontend/src/__tests__/unit/` — Frontend unit tests
- `frontend/src/__tests__/cypress/cypress/tests/mocked/` — Mocked Cypress tests (56 files)
- `frontend/src/__tests__/cypress/cypress/tests/e2e/` — E2E Cypress tests (16 files)
- `frontend/src/__tests__/cypress/cypress/pages/` — Page objects (74 files)
- `backend/src/__tests__/` — Backend tests (3 files)

### Code Quality
- `frontend/.eslintrc` — Comprehensive frontend ESLint config
- `backend/.eslintrc` — Backend ESLint config
- `.prettierrc` — Shared Prettier config
- `.codecov.yml` — Codecov configuration (informational mode)
- `.editorconfig` — Editor settings

### Container Images
- `Dockerfile` — Standard build (configurable base)
- `Dockerfile.konflux` — Konflux build (pinned digest, RHOAI branding)
- `.dockerignore` — Build context exclusions

### Manifests
- `manifests/odh/` — ODH deployment overlays
- `manifests/rhoai/` — RHOAI deployment overlays
- `manifests/common/` — Shared resources (connection types)
- `manifests/core-bases/` — Base configurations
