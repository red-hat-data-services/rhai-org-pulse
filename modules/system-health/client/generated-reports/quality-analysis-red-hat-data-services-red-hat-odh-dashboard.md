---
repository: "red-hat-data-services/red-hat-odh-dashboard"
overall_score: 5.5
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "170 Jest specs with strong mock infrastructure (103 mock files), 11% test-to-code ratio"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "72 Cypress tests (56 mocked + 16 E2E) with page object pattern and accessibility testing"
  - dimension: "Build Integration"
    score: 4.0
    status: "Dockerfile and Kustomize manifests present but no PR-time build validation in CI"
  - dimension: "Image Testing"
    score: 4.0
    status: "Multi-stage UBI Dockerfile with multi-arch Makefile target but no runtime validation"
  - dimension: "Coverage Tracking"
    score: 7.0
    status: "Codecov with merged Jest+Cypress coverage but informational-only (no enforcement)"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "Single test workflow with caching, missing concurrency, timeouts, and parallelization"
  - dimension: "Static Analysis"
    score: 6.0
    status: "Comprehensive ESLint with strict TypeScript, but Dependabot only covers GitHub Actions"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory present"
critical_gaps:
  - title: "No PR-time build validation"
    impact: "Docker image build failures discovered only after merge in Konflux; broken kustomize overlays not caught until deployment"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "Coverage enforcement is informational-only"
    impact: "Coverage can regress without blocking PRs; 50-70% target range is not enforced"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container runtime validation"
    impact: "Image startup issues, missing dependencies, and runtime errors not caught until deployment"
    severity: "HIGH"
    effort: "6-8 hours"
  - title: "Dependabot only covers GitHub Actions ecosystem"
    impact: "npm dependency vulnerabilities and updates not automatically tracked or reported"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No CI concurrency controls or timeouts"
    impact: "Duplicate CI runs waste resources; hung workflows can block PRs indefinitely"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Expand Dependabot to cover npm ecosystem"
    effort: "30 minutes"
    impact: "Automated npm security and dependency updates with PR generation"
  - title: "Add concurrency controls and timeout-minutes to test workflow"
    effort: "1 hour"
    impact: "Prevents duplicate runs and hung workflows from blocking PRs"
  - title: "Enable coverage enforcement (remove informational flag)"
    effort: "1 hour"
    impact: "Prevents test coverage regressions on PRs"
  - title: "Add PR-time Docker build step to test.yml"
    effort: "2-3 hours"
    impact: "Catches Dockerfile and build errors before merge"
  - title: "Add pre-commit hooks for linting and formatting"
    effort: "2 hours"
    impact: "Catches lint/format issues locally before pushing"
  - title: "Create basic CLAUDE.md with test patterns and coding standards"
    effort: "2-3 hours"
    impact: "Improves AI-generated code and test quality, consistency across contributors"
recommendations:
  priority_0:
    - "Add PR-time Docker image build validation to the test workflow to catch build failures before merge"
    - "Enable coverage enforcement by removing informational: true from .codecov.yml"
    - "Expand Dependabot configuration to include npm ecosystem alongside github-actions"
  priority_1:
    - "Add container runtime validation (image startup test, health check) in CI"
    - "Add concurrency controls and timeout-minutes to all CI workflows"
    - "Create comprehensive CLAUDE.md with Jest/Cypress test patterns and coding standards"
    - "Add kustomize build validation step to PR workflow"
  priority_2:
    - "Add pre-commit hooks for ESLint and Prettier enforcement"
    - "Add multi-version Node.js testing matrix (18.x, 20.x)"
    - "Add contract testing for backend API boundaries"
    - "Add HEALTHCHECK instruction to Dockerfiles"
---

# Quality Analysis: red-hat-data-services/red-hat-odh-dashboard

## Executive Summary

- **Overall Score: 5.5/10**
- **Repository Type**: TypeScript/React web application (downstream fork of opendatahub-io/odh-dashboard)
- **Stack**: React 18 + PatternFly 6 frontend, Fastify 4 Node.js backend
- **Tier**: Downstream (RHOAIENG / AI Core Dashboard)
- **Key Strengths**: Comprehensive Cypress test infrastructure with page object pattern, strong ESLint configuration with strict TypeScript, merged Jest+Cypress coverage reporting to Codecov, well-organized Kustomize manifests for ODH/RHOAI
- **Critical Gaps**: No PR-time build validation, coverage enforcement is informational-only, no container runtime validation, Dependabot only covers GitHub Actions (not npm)
- **Agent Rules Status**: Missing - No CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 7.0/10 | 15% | 1.05 | 170 Jest specs, strong mock infrastructure |
| Integration/E2E | 7.0/10 | 20% | 1.40 | 72 Cypress tests with page objects + a11y |
| Build Integration | 4.0/10 | 15% | 0.60 | Dockerfile exists, no PR-time validation |
| Image Testing | 4.0/10 | 10% | 0.40 | Multi-stage UBI, no runtime validation |
| Coverage Tracking | 7.0/10 | 10% | 0.70 | Codecov with merged coverage, informational-only |
| CI/CD Automation | 5.0/10 | 15% | 0.75 | Basic CI with caching, missing controls |
| Static Analysis | 6.0/10 | 10% | 0.60 | Strong ESLint, weak dependency alerts |
| Agent Rules | 0.0/10 | 5% | 0.00 | No agent rules present |
| **Overall** | **5.5/10** | **100%** | **5.50** | |

## Critical Gaps

### 1. No PR-time Build Validation
- **Impact**: Docker image build failures and kustomize overlay errors are only discovered after merge in Konflux
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: The test.yml workflow runs linting, type-checking, Jest, and Cypress tests, but never builds the Docker image or validates kustomize manifests. The Dockerfile.konflux sets RHOAI-specific env vars (ODH_LOGO, ODH_PRODUCT_NAME, etc.) that could fail silently. Kustomize overlays for ODH, RHOAI addon, RHOAI onprem, and dev are never validated in CI.

### 2. Coverage Enforcement is Informational-Only
- **Impact**: Test coverage can regress freely without blocking PRs
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The `.codecov.yml` sets both `project` and `patch` statuses to `informational: true`, meaning coverage failures never block PRs. The 70% patch target and 50-70% range are merely advisory. Coverage merging (Jest + Cypress) is well-implemented but the results have no teeth.

### 3. No Container Runtime Validation
- **Impact**: Image startup issues, missing dependencies, runtime crashes not caught until deployment
- **Severity**: HIGH
- **Effort**: 6-8 hours
- **Details**: No HEALTHCHECK instruction in either Dockerfile. No container startup testing. No Testcontainers usage. The runtime stage copies built artifacts but is never validated to actually start correctly.

### 4. Dependabot Only Covers GitHub Actions
- **Impact**: npm dependency vulnerabilities are not automatically tracked
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: `.github/dependabot.yml` only configures the `github-actions` ecosystem. The `npm` ecosystem is not covered, leaving frontend and backend npm dependencies without automated update PRs. This is significant for a project with 80+ npm dependencies.

### 5. No CI Concurrency Controls or Timeouts
- **Impact**: Duplicate workflow runs waste resources; hung workflows can block PRs indefinitely
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: The test.yml workflow has no `concurrency` group configuration and no `timeout-minutes` setting. Multiple pushes to the same PR branch will trigger parallel redundant runs.

## Quick Wins

### 1. Expand Dependabot to npm Ecosystem (30 minutes)
Add npm ecosystem to `.github/dependabot.yml`:
```yaml
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
    labels:
      - "dependencies"
```

### 2. Add Concurrency Controls and Timeouts (1 hour)
Add to `.github/workflows/test.yml`:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  Tests:
    timeout-minutes: 30
```

### 3. Enable Coverage Enforcement (1 hour)
Update `.codecov.yml` to enforce coverage:
```yaml
coverage:
  status:
    project:
      default:
        target: 50%
        threshold: 2%
    patch:
      default:
        target: 70%
```

### 4. Add PR-time Docker Build Step (2-3 hours)
Add a build job to `.github/workflows/test.yml`:
```yaml
  Build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker image
        run: docker build -f Dockerfile -t test-build .
      - name: Build Konflux Docker image
        run: docker build -f Dockerfile.konflux -t test-build-konflux .
```

### 5. Add Pre-commit Hooks (2 hours)
Create `.pre-commit-config.yaml`:
```yaml
repos:
  - repo: https://github.com/pre-commit/mirrors-eslint
    rev: v8.57.0
    hooks:
      - id: eslint
        files: \.[jt]sx?$
  - repo: https://github.com/pre-commit/mirrors-prettier
    rev: v2.2.1
    hooks:
      - id: prettier
```

### 6. Create Basic CLAUDE.md (2-3 hours)
Create agent rules documenting Jest test patterns, Cypress page object conventions, mock file structure, and PatternFly component standards.

## Detailed Findings

### Unit Tests

**Framework**: Jest 28 with ts-jest  
**Test Environment**: jest-environment-jsdom (frontend), node (backend)  
**Test Files**: 170 spec files (167 frontend, 3 backend)  
**Source Files**: ~1,530 (1,432 frontend + 98 backend)  
**Test-to-Code Ratio**: ~11% (170/1,530)  
**Mock Infrastructure**: 103 mock files in `frontend/src/__mocks__/`

**Strengths**:
- Well-organized mock infrastructure with typed Kubernetes resource mocks (`mockServingRuntimeK8sResource.ts`, `mockRegisteredModel.ts`, etc.)
- Jest configured with clearMocks: true for proper test isolation
- Coverage collection configured with appropriate exclusions (third_party, tests, mocks)
- Module path aliases (`~/` prefix) for clean imports
- Transform ignore patterns properly configured for ESM dependencies
- Backend has separate Jest config with ts-jest preset

**Gaps**:
- Low test-to-code ratio (11%) - industry best practice is 30-50%
- Only 3 backend test files vs. 98 backend source files (~3% ratio)
- No snapshot testing utilized
- No test for TypeScript type correctness beyond tsc --noEmit

**Key Files**:
- `frontend/jest.config.js` - Frontend Jest configuration
- `backend/jest.config.js` - Backend Jest configuration
- `frontend/src/__tests__/unit/jest.setup.ts` - Test setup
- `frontend/src/__mocks__/` - 103 mock resource files

### Integration/E2E Tests

**Framework**: Cypress 13.x  
**Mocked Tests**: 56 Cypress test files (testing against built app with mocked backend)  
**E2E Tests**: 16 Cypress test files (testing against real clusters)  
**Page Objects**: 30+ page object files organized by feature  
**Total Cypress Test Files**: ~195 (including support, utils, fixtures)

**Strengths**:
- Mature page object pattern with dedicated `cypress/pages/` directory
- Two-tier testing strategy: mocked tests (fast, CI) + E2E tests (real cluster)
- Accessibility testing with cypress-axe
- High-resolution viewport testing (1920x1080)
- JUnit + Mochawesome reporters for CI integration
- Code coverage via @cypress/code-coverage with istanbul
- E2E retry configuration (runMode: 2 retries)
- Video recording with automatic cleanup for passing specs
- Snapshot recording mode for API response capture
- WebSocket testing support

**Feature Coverage (Mocked Tests)**:
- Accelerator profiles, applications, cluster settings
- Connection types, custom serving runtimes
- Distributed workloads, model registry, model serving
- Notebook image settings, pipelines, projects
- Storage classes, user management

**Feature Coverage (E2E)**:
- Applications, dashboard navigation
- Data science pipelines, data science projects
- Learning resources, settings, storage classes

**Gaps**:
- No multi-version testing (single Node.js version, no OCP version matrix)
- No cluster setup in CI (Kind/Minikube) - E2E runs appear to be done separately
- E2E tests are fewer in number (16) compared to mocked tests (56)

**Key Files**:
- `frontend/src/__tests__/cypress/cypress.config.ts` - Cypress configuration
- `frontend/src/__tests__/cypress/cypress/tests/mocked/` - Mocked test suite
- `frontend/src/__tests__/cypress/cypress/tests/e2e/` - E2E test suite
- `frontend/src/__tests__/cypress/cypress/pages/` - Page objects

### Build Integration

**Dockerfiles**: `Dockerfile` (ODH), `Dockerfile.konflux` (RHOAI/Konflux)  
**Build Tool**: Makefile with podman/docker support  
**Manifests**: Kustomize-based with multiple overlays

**Strengths**:
- Two Dockerfiles: generic (parameterized base image) and Konflux-specific (pinned UBI digest)
- Multi-stage builds (builder → runtime) in both Dockerfiles
- Kustomize manifests well-organized across deployment targets (ODH, RHOAI addon, RHOAI onprem, dev)
- Multi-arch build support in Makefile (s390x, amd64, ppc64le via docker-buildx)
- CRD manifests in `manifests/common/crd/`
- Connection type manifests in `manifests/common/connection-types/`

**Gaps**:
- No PR-triggered Docker image build in CI workflow
- No kustomize validation (`kustomize build`) in CI
- No Konflux build simulation on PRs
- No manifest dry-run validation (`kubectl apply --dry-run`)
- Build failures only discovered post-merge in Konflux pipeline
- No image startup testing after build

**Key Files**:
- `Dockerfile` - Generic multi-stage build
- `Dockerfile.konflux` - RHOAI Konflux build with pinned UBI digest
- `Makefile` - Build, push, deploy targets
- `manifests/` - Kustomize overlays (10 kustomization.yaml files)

### Image Testing

**Base Image**: UBI8/nodejs-18 (FIPS-capable)  
**Build**: Multi-stage (builder → runtime)  
**Multi-arch**: Supported via Makefile

**Strengths**:
- UBI8 base images (FIPS-capable, Red Hat supported)
- Konflux Dockerfile uses pinned SHA256 digest for reproducibility
- Multi-stage build properly separates build-time and runtime dependencies
- Runtime image only includes production artifacts (public/, dist/, package.json)
- Proper user setup (USER 1001:0, non-root)
- Multi-arch support for s390x, amd64, ppc64le

**Gaps**:
- No HEALTHCHECK instruction in Dockerfiles
- No container startup validation tests
- No Testcontainers or similar runtime testing
- No image scanning or validation step
- `.dockerignore` exists but is minimal (only 3 entries)
- No readiness/liveness probe validation

**Key Files**:
- `Dockerfile` - 36 lines, multi-stage build
- `Dockerfile.konflux` - 50 lines, RHOAI-branded build
- `.dockerignore` - Minimal exclusions

### Coverage Tracking

**Tool**: Codecov  
**Configuration**: `.codecov.yml` with informational-only status  
**Coverage Sources**: Jest (unit) + Cypress (E2E) merged via istanbul-merge

**Strengths**:
- Codecov integration with PR reporting
- Coverage merge pipeline: Jest → jest-coverage/, Cypress → cypress/coverage/, merged → coverage/
- Jest coverageReporters: json + lcov
- Cypress coverage via @cypress/code-coverage + istanbul
- nyc for report generation (HTML + JSON summary)
- Codecov upload in CI via codecov-action v4.6.0
- PR comment layout configured (reach, diff, flags, files)

**Gaps**:
- Both project and patch status are `informational: true` - coverage failures never block PRs
- Coverage range 50-70% is low for a critical dashboard component
- Patch target 70% is reasonable but not enforced
- No branch coverage enforcement
- fail_ci_if_error: false in the Codecov action

**Key Files**:
- `.codecov.yml` - Coverage configuration
- `frontend/jest.config.js` - Jest coverage settings (coverageDirectory, collectCoverageFrom)
- `frontend/package.json` - Coverage merge scripts

### CI/CD Automation

**Workflows**: 3 total  
**PR-triggered**: 1 (test.yml on push+pull_request)  
**Manual**: 1 (create-tag-release.yml on workflow_dispatch)  
**Event-driven**: 1 (pr-close-image-delete.yml on PR close)

**Workflow Details**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| test.yml | push, pull_request | Lint, type-check, Jest, Cypress, Codecov upload |
| create-tag-release.yml | workflow_dispatch | Create Quay tag from existing tag (authorized users only) |
| pr-close-image-delete.yml | pull_request:closed | Delete PR-specific Quay image |

**Strengths**:
- Good caching strategy with 3 separate npm cache layers (repo, backend, frontend)
- Cache keys based on package-lock.json hashes
- Cypress results uploaded as artifacts
- PR image cleanup on close (good hygiene)
- Tag release with authorized user check

**Gaps**:
- No concurrency control - duplicate runs on rapid pushes
- No timeout-minutes on any workflow
- No test parallelization (single matrix: node 18.x only)
- No scheduled/periodic test runs
- No build validation job
- No multi-version Node.js testing
- Artifacts not retained for build outputs

**Key Files**:
- `.github/workflows/test.yml` - Main CI pipeline
- `.github/workflows/create-tag-release.yml` - Release management
- `.github/workflows/pr-close-image-delete.yml` - PR cleanup

### Static Analysis

#### Linting
- **Frontend ESLint**: Extensive configuration with 30+ rules
  - TypeScript strict rules (@typescript-eslint/no-unnecessary-condition, no-base-to-string, naming-convention, etc.)
  - React hooks rules (exhaustive-deps, rules-of-hooks as errors)
  - Accessibility (jsx-a11y plugin with anchor-is-valid, no-autofocus)
  - Import ordering and no-relative-import-paths
  - no-only-tests plugin to prevent committed test.only()
  - Custom restricted imports (axios, PatternFly Select)
  - Product name hardcoding prevention (Red Hat OpenShift AI / Open Data Hub)
  - Prettier integration
  - Separate Cypress-specific overrides with type-import enforcement
  - Goal config (.eslintrc.goal.js) for aspirational rules
- **Backend ESLint**: Basic TypeScript rules with Prettier
- **TypeScript**: `strict: true` in frontend tsconfig with noImplicitAny, noImplicitReturns, noImplicitThis
- **Prettier**: Configured (.prettierrc) with consistent formatting
- **Lint runs in CI**: `--max-warnings 0` enforced for both frontend and backend

#### FIPS Compatibility
- **Base Images**: UBI8/nodejs-18 (FIPS-capable) - GOOD
- **Konflux Dockerfile**: Uses pinned SHA256 digest - GOOD
- **Source Code**: No non-FIPS crypto imports detected - GOOD (TypeScript/Node.js project)
- **Assessment**: FIPS-ready through UBI base image usage

#### Dependency Alerts
- **Dependabot**: Configured but only for `github-actions` ecosystem (monthly, 2 PR limit)
- **npm ecosystem NOT covered**: Major gap for a project with 80+ npm dependencies
- **No Renovate**: Not configured
- **No auto-merge policies**: Not configured

#### Pre-commit Hooks
- **Not configured**: No `.pre-commit-config.yaml`

**Key Files**:
- `frontend/.eslintrc` - 250+ line comprehensive ESLint config
- `backend/.eslintrc` - Basic ESLint config
- `frontend/tsconfig.json` - Strict TypeScript configuration
- `.prettierrc` - Prettier configuration
- `.github/dependabot.yml` - GitHub Actions-only Dependabot

### Agent Rules

- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **Test automation guidance**: None
- **Coverage**: No test types have agent rules

**Gaps**:
- No guidance for AI agents on Jest test patterns
- No Cypress page object conventions documented for agents
- No mock file structure documentation
- No PatternFly component usage patterns
- No coding standards for AI-assisted development

**Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
- Jest unit test patterns (mock usage, test isolation, assertions)
- Cypress mocked test patterns (interceptors, page objects, fixtures)
- Cypress E2E test patterns (login, cluster interaction)
- TypeScript conventions (strict mode, naming, import order)
- PatternFly component usage (Select alternatives, modal patterns)

## Recommendations

### Priority 0 (Critical)

1. **Add PR-time Docker build validation** to the test workflow to catch build failures before merge. Build both `Dockerfile` and `Dockerfile.konflux` on every PR.

2. **Enable coverage enforcement** by removing `informational: true` from `.codecov.yml` project and patch status. Set minimum thresholds that block PR merges.

3. **Expand Dependabot to npm ecosystem** — the current config only covers GitHub Actions, leaving 80+ npm dependencies without automated vulnerability tracking.

### Priority 1 (High Value)

4. **Add container runtime validation** — test that the built Docker image starts correctly, responds on the expected port, and serves the dashboard.

5. **Add concurrency controls and timeouts** to all CI workflows to prevent resource waste and hung builds.

6. **Create comprehensive CLAUDE.md** with test patterns, coding standards, and contribution guidelines for AI-assisted development.

7. **Add kustomize build validation** — run `kustomize build` for all overlays (ODH, RHOAI addon, RHOAI onprem) in CI to catch manifest errors.

### Priority 2 (Nice-to-Have)

8. **Add pre-commit hooks** for ESLint and Prettier to catch issues locally before pushing.

9. **Add multi-version Node.js matrix** — test against both Node.js 18.x and 20.x for forward compatibility.

10. **Add contract testing** for the Fastify backend API to validate API contracts between frontend and backend.

11. **Add HEALTHCHECK** instruction to Dockerfiles for container orchestration readiness.

12. **Increase backend test coverage** — only 3 test files for 98 source files (~3% coverage).

## Comparison to Gold Standards

| Dimension | red-hat-odh-dashboard | odh-dashboard (upstream) | notebooks | Best Practice |
|-----------|----------------------|--------------------------|-----------|---------------|
| Unit Tests | 7/10 - 170 specs, 11% ratio | 8/10 - Higher ratio | 6/10 | 30-50% test-to-code ratio |
| Integration/E2E | 7/10 - Cypress with POM | 8/10 - More E2E coverage | 7/10 | Multi-version, automated cluster |
| Build Integration | 4/10 - No PR build | 5/10 - Limited PR build | 7/10 - Image validation | PR-time build + Konflux sim |
| Image Testing | 4/10 - Multi-stage only | 5/10 | 9/10 - 5-layer validation | Runtime + health checks |
| Coverage Tracking | 7/10 - Informational | 8/10 - Enforced | 6/10 | Enforced thresholds, 80%+ |
| CI/CD Automation | 5/10 - Basic | 7/10 - More workflows | 8/10 | Concurrency, parallelization |
| Static Analysis | 6/10 - Strong ESLint | 7/10 | 7/10 | Full Dependabot + pre-commit |
| Agent Rules | 0/10 - None | 6/10 - Has CLAUDE.md | 2/10 | Comprehensive test rules |

## File Paths Reference

### CI/CD
- `.github/workflows/test.yml` - Main test pipeline
- `.github/workflows/create-tag-release.yml` - Release management
- `.github/workflows/pr-close-image-delete.yml` - PR cleanup
- `Makefile` - Build, push, deploy targets

### Testing
- `frontend/jest.config.js` - Jest configuration
- `backend/jest.config.js` - Backend Jest configuration
- `frontend/src/__tests__/unit/jest.setup.ts` - Test setup
- `frontend/src/__tests__/cypress/cypress.config.ts` - Cypress configuration
- `frontend/src/__tests__/cypress/cypress/tests/mocked/` - 56 mocked test files
- `frontend/src/__tests__/cypress/cypress/tests/e2e/` - 16 E2E test files
- `frontend/src/__tests__/cypress/cypress/pages/` - 30+ page objects
- `frontend/src/__mocks__/` - 103 mock K8s resource files

### Code Quality
- `frontend/.eslintrc` - Comprehensive frontend ESLint (250+ lines)
- `backend/.eslintrc` - Backend ESLint
- `frontend/tsconfig.json` - Strict TypeScript config
- `.prettierrc` - Prettier configuration
- `.github/dependabot.yml` - GitHub Actions-only Dependabot

### Container Images
- `Dockerfile` - Generic multi-stage build (UBI8/nodejs-18)
- `Dockerfile.konflux` - RHOAI Konflux build (pinned digest)
- `.dockerignore` - Build exclusions

### Coverage
- `.codecov.yml` - Codecov configuration (informational-only)

### Manifests
- `manifests/odh/kustomization.yaml` - ODH overlay
- `manifests/rhoai/addon/kustomization.yaml` - RHOAI addon overlay
- `manifests/rhoai/onprem/kustomization.yaml` - RHOAI on-prem overlay
- `manifests/rhoai/shared/kustomization.yaml` - RHOAI shared base
- `manifests/core-bases/base/kustomization.yaml` - Core base resources
- `manifests/common/crd/kustomization.yaml` - CRD definitions
