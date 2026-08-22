---
repository: "red-hat-data-services/workbenches"
overall_score: 6.7
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Good Go test coverage (envtest + Ginkgo), sparse frontend Jest unit tests"
  - dimension: "Integration/E2E"
    score: 7.5
    status: "Kind-based controller E2E and Cypress mocked tests in CI"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time multi-arch image builds, no Konflux simulation"
  - dimension: "Image Testing"
    score: 6.0
    status: "Multi-stage builds with distroless, no runtime validation"
  - dimension: "Coverage Tracking"
    score: 4.5
    status: "Coverage generated locally but no CI reporting or threshold enforcement"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "Well-organized path-filtered workflows with reusable image builder"
  - dimension: "Static Analysis"
    score: 7.0
    status: "Comprehensive golangci-lint and ESLint, missing Dependabot/Renovate"
  - dimension: "Agent Rules"
    score: 1.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No CI coverage reporting or threshold enforcement"
    impact: "Coverage is generated locally but never reported in PRs—regressions go unnoticed"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No dependency alert configuration (Dependabot/Renovate)"
    impact: "Vulnerable or outdated dependencies are not surfaced automatically"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "Frontend uses non-UBI base images (nginx:alpine)"
    impact: "Not FIPS-capable out of the box, may fail downstream compliance checks"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "Single K8s version in controller E2E tests"
    impact: "Compatibility issues with other K8s/OCP versions not caught before merge"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add Dependabot configuration for Go, npm, and Docker ecosystems"
    effort: "1-2 hours"
    impact: "Automated dependency update PRs and vulnerability alerts"
  - title: "Add codecov integration to CI workflows"
    effort: "2-4 hours"
    impact: "PR-level coverage reporting and regression detection"
  - title: "Add concurrency control to test workflows"
    effort: "30 minutes"
    impact: "Prevent redundant CI runs on rapid PR updates"
  - title: "Create basic CLAUDE.md with test patterns and project conventions"
    effort: "2-3 hours"
    impact: "Improve AI-assisted development quality and consistency"
recommendations:
  priority_0:
    - "Add codecov integration with threshold enforcement for all three components"
    - "Configure Dependabot for gomod, npm, and docker ecosystems"
  priority_1:
    - "Add multi-version K8s testing matrix for controller E2E tests"
    - "Add container runtime validation (image startup tests) in CI"
    - "Migrate frontend base image from nginx:alpine to UBI-based nginx for FIPS compliance"
  priority_2:
    - "Create comprehensive agent rules (.claude/rules/) for test patterns"
    - "Add concurrency control and timeout-minutes to test workflows"
    - "Add FIPS build tags for Go binaries"
---

# Quality Analysis: workbenches

**Repository**: [red-hat-data-services/workbenches](https://github.com/red-hat-data-services/workbenches)
**Tier**: Downstream
**Jira**: RHOAIENG / Notebooks Server
**Analysis Date**: 2026-07-20
**Repo Type**: Monorepo (Go + TypeScript) — Kubernetes controller, Go backend API, React frontend

## Executive Summary

- **Overall Score: 6.7/10**
- **Key Strengths**: Well-structured monorepo with comprehensive CI workflows, solid Go test infrastructure (envtest + Ginkgo), multi-arch image builds on PRs, and thorough linting across all components (28 golangci-lint rules, ESLint with accessibility and custom rules).
- **Critical Gaps**: No CI coverage reporting or threshold enforcement, no dependency alerting (Dependabot/Renovate), frontend uses non-UBI base images, single K8s version in E2E.
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or `.claude/` directory.

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 7.5/10 | 15% | Good Go test coverage (envtest + Ginkgo), sparse frontend Jest unit tests |
| Integration/E2E | 7.5/10 | 20% | Kind-based controller E2E and 21 Cypress mocked tests in CI |
| Build Integration | 7.0/10 | 15% | PR-time multi-arch image builds, no Konflux simulation |
| Image Testing | 6.0/10 | 10% | Multi-stage builds with distroless, no runtime validation |
| Coverage Tracking | 4.5/10 | 10% | Coverage generated locally but no CI reporting or enforcement |
| CI/CD Automation | 8.0/10 | 15% | Well-organized path-filtered workflows with reusable builder |
| Static Analysis | 7.0/10 | 10% | Comprehensive golangci-lint and ESLint, missing Dependabot |
| Agent Rules | 1.0/10 | 5% | No agent rules present |

## Critical Gaps

### 1. No CI coverage reporting or threshold enforcement
- **Impact**: Coverage is generated locally (`--coverprofile`, jest `--coverage`, Cypress code coverage with istanbul-merge) but never uploaded or reported in PRs. Regressions go unnoticed.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The infrastructure for coverage generation is already in place across all three components. Adding codecov or coveralls integration is straightforward.

### 2. No dependency alert configuration
- **Impact**: Vulnerable or outdated dependencies in Go modules, npm packages, and Docker base images are not surfaced automatically. Manual review is the only safeguard.
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: No `.github/dependabot.yml` or `renovate.json` found. This is a quick win.

### 3. Frontend uses non-UBI base images
- **Impact**: `nginx:alpine` production image is not FIPS-capable. May fail downstream compliance requirements for Red Hat products.
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: Builder stage uses `node:20-slim`, production uses `nginx:alpine`. Go components use `distroless:nonroot` which is also not UBI but is more minimal.

### 4. Single K8s version in controller E2E
- **Impact**: Controller E2E tests only run against Kind `v1.25.16`. Compatibility issues with newer K8s/OCP versions are not caught before merge.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: Adding a matrix strategy with 2-3 K8s versions would significantly improve confidence.

## Quick Wins

### 1. Add Dependabot configuration (1-2 hours)
Create `.github/dependabot.yml` covering all ecosystems:
```yaml
version: 2
updates:
  - package-ecosystem: "gomod"
    directory: "/workspaces/backend"
    schedule:
      interval: "weekly"
  - package-ecosystem: "gomod"
    directory: "/workspaces/controller"
    schedule:
      interval: "weekly"
  - package-ecosystem: "npm"
    directory: "/workspaces/frontend"
    schedule:
      interval: "weekly"
  - package-ecosystem: "docker"
    directory: "/workspaces/backend"
    schedule:
      interval: "monthly"
  - package-ecosystem: "docker"
    directory: "/workspaces/controller"
    schedule:
      interval: "monthly"
  - package-ecosystem: "docker"
    directory: "/workspaces/frontend"
    schedule:
      interval: "monthly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 2. Add codecov integration (2-4 hours)
Add coverage upload steps to each test workflow and create `.codecov.yml` with thresholds.

### 3. Add concurrency control to test workflows (30 minutes)
Add to each test workflow:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 4. Create basic CLAUDE.md (2-3 hours)
Document test patterns, frameworks used, and project conventions for AI-assisted development.

## Detailed Findings

### Unit Tests

**Backend (Go)** — 15 test files / 69 source files (21.7% ratio)
- Framework: envtest + Ginkgo (`suite_test.go` pattern)
- Coverage generation: `--coverprofile cover.out` via `make test`
- Test areas: handlers (workspaces, workspacekinds, namespaces, PVCs, secrets, storageclasses, healthcheck, workspace_actions, workspacekind_assets, workspacekind_podtemplate_options), response errors, helpers, models
- Runs as a separate CI job after build passes

**Controller (Go)** — 10 test files / 21 source files (47.6% ratio)
- Framework: envtest + Ginkgo with `suite_test.go`
- Coverage generation: `--coverprofile cover.out` via `make test` (excludes e2e)
- Test areas: workspace/workspacekind controllers, webhooks, helpers (graph)
- Uses `setup-envtest` with K8s v1.31.0

**Frontend (TypeScript)** — 8 Jest unit test files / 167 source files (4.8% ratio)
- Framework: Jest with `jest-environment-jsdom`
- Test areas: utilities (valueUnits, imageUtils), hooks (useToolbarFilters), API utils, form helpers
- Coverage available via `npm run test:jest:coverage`
- Sparse coverage — most frontend logic is tested via Cypress mocked tests instead

### Integration/E2E Tests

**Controller E2E** — 2 test files + 5 utility files
- 406-line e2e_test.go with Ginkgo
- Kind cluster setup in CI (kind-action, v1.25.16)
- Test utilities for cert-manager, Istio, Prometheus integration
- Automated in PR CI on every controller or backend change

**Frontend Cypress** — 21 mocked test files
- Well-organized: `tests/mocked/workspaces/` and `tests/mocked/workspaceKinds/`
- Tests cover: CRUD operations, filtering, redirects, styling, secrets management, volumes, option cards, summary views
- Mochawesome + JUnit reporting with artifact upload
- Screenshots and video recording on failure
- Retries configured (2 in runMode)
- Code coverage integration via `@cypress/code-coverage`
- Separate e2e spec pattern supported but only mocked tests run in CI

**Local Development**
- Tiltfile provides full-stack development with Kind, Istio, cert-manager
- Live-reload for frontend via webpack HMR
- Port-forwarding for API and dashboard access

### Build Integration

- **PR image builds**: All 3 component images built on PRs (not pushed) — validates Dockerfile correctness ✅
- **Multi-arch**: `linux/amd64,linux/ppc64le,linux/arm64/v8` via docker buildx ✅
- **Reusable workflow**: `ws-build-image.yml` is a well-designed reusable workflow with flexible tagging (SHA, semver, latest) ✅
- **CRD generation**: Controller `make test` runs `manifests` target first, validating CRD generation ✅
- **Kustomize**: Deploy targets use kustomize overlays, manifests are structured properly ✅
- **Porcelain check**: Backend and frontend workflows check for uncommitted changes (catches stale generated code) ✅
- **Missing**: No Konflux build simulation, no `kubectl apply --dry-run` in CI

### Image Testing

- **Multi-stage builds**: All 3 Dockerfiles use multi-stage builds ✅
- **Security**: Go components use `gcr.io/distroless/static:nonroot` with UID 65532 ✅
- **Frontend**: Uses `nginx:alpine` with non-root user (UID 101) ✅
- **Multi-arch**: Full multi-arch support via `--platform=$BUILDPLATFORM` ✅
- **K8s probes**: All components have liveness/readiness probes defined in kustomize manifests ✅
- **Missing**: No image startup testing, no testcontainers, no runtime validation in CI
- **Base images**: Not UBI-based — `distroless` for Go, `nginx:alpine` for frontend

### Coverage Tracking

- **Go**: `--coverprofile cover.out` in both backend and controller Makefiles ✅
- **Frontend Jest**: `--coverage` with `coverageReporters=json,lcov` ✅
- **Frontend Cypress**: `@cypress/code-coverage` + NYC config ✅
- **Coverage merge**: `istanbul-merge` combines Jest + Cypress coverage ✅
- **Missing**: No `.codecov.yml`, no CI upload, no threshold enforcement, no PR coverage comments

The coverage infrastructure is mature (especially the Jest + Cypress merge) — it just needs CI integration to be actionable.

### CI/CD Automation

**7 workflows total:**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ws-backend-test.yml` | PR + push | Build, lint, unit test, image build |
| `ws-controller-test.yml` | PR + push | Build, lint, unit test, e2e (Kind), image build |
| `ws-frontend-test.yml` | PR + push | Build, lint, type-check, unit test, Cypress, image build |
| `ws-build-image.yml` | workflow_call | Reusable multi-arch image builder |
| `ws-publish.yml` | push (main) | Matrix build + push all 3 images |
| `gh-workflow-approve.yaml` | PR label | Auto-approve workflow runs for external PRs |
| `semantic-prs.yaml` | PR | Enforce conventional commit PR titles |

**Strengths:**
- Path-filtered triggers (e.g., backend tests only run on backend changes) ✅
- SHA-pinned GitHub Actions references ✅
- Reusable image build workflow ✅
- Matrix strategy for publish workflow ✅
- Multi-branch support (main, notebooks-v2, v*-branch) ✅
- Go dependency caching via `cache-dependency-path` ✅
- Test artifact upload (Cypress reports, screenshots, videos) ✅
- Porcelain checks to catch stale generated code ✅

**Gaps:**
- No concurrency control on test workflows (rapid PR updates trigger redundant runs) ❌
- No explicit `timeout-minutes` on test jobs ❌
- No test parallelization/sharding ❌

### Static Analysis

#### Linting
- **Backend**: `.golangci.yml` with 28 linters enabled including `gosec`, `gocritic` (all tags), `errorlint`, `exhaustive`, `ginkgolinter`, `goheader` (license check). 5-minute timeout. ✅
- **Controller**: `.golangci.yml` with identical 28-linter configuration. ✅
- **Frontend**: `.eslintrc.js` with extensive configuration — TypeScript strict mode, React hooks rules, accessibility (`jsx-a11y`), import ordering, Prettier integration, custom local rules (`no-react-hook-namespace`, `no-raw-react-router-hook`), CSpell spell checking, `no-only-tests`. ✅
- **Frontend pre-commit**: Husky hook runs `npm run test:lint` on staged frontend changes. ✅
- **Go tooling**: `go fmt`, `go vet` run as part of `make test`. ✅

#### FIPS Compatibility
- No FIPS-incompatible crypto imports found (no `crypto/md5`, `crypto/des`, etc.) ✅
- No FIPS build tags configured (`-tags=fips`, `GOEXPERIMENT=boringcrypto`) ⚠️
- Base images are not UBI-based ⚠️

#### Dependency Alerts
- **No Dependabot configuration** — `.github/dependabot.yml` is absent ❌
- **No Renovate configuration** — no `renovate.json` or `.renovaterc` ❌
- GitHub Actions are SHA-pinned (good), but no automated update mechanism ❌

### Agent Rules

- **Status**: Missing
- **Coverage**: No test creation rules, no coding conventions documented for agents
- **Quality**: N/A
- **Gaps**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory
- **Available docs**: `DEVELOPMENT_GUIDE.md` (8.5KB) covers local development setup, component-level READMEs exist
- **Recommendation**: Generate test rules with `/test-rules-generator` and create `CLAUDE.md` from `DEVELOPMENT_GUIDE.md`

## Recommendations

### Priority 0 (Critical)

1. **Add codecov integration with threshold enforcement** — Coverage infrastructure already exists for all 3 components. Add `codecov/codecov-action` steps to upload `cover.out` (Go) and merged coverage (frontend). Create `.codecov.yml` with minimum thresholds.

2. **Configure Dependabot for all ecosystems** — Add `.github/dependabot.yml` covering gomod, npm, docker, and github-actions. This is a 1-2 hour quick win with high security impact.

### Priority 1 (High Value)

3. **Add multi-version K8s matrix for controller E2E** — Currently testing only `v1.25.16`. Add at least v1.28 and v1.30 to catch compatibility issues.

4. **Add container runtime validation** — Add a CI step that builds and runs each image, verifying it starts and responds to health checks.

5. **Migrate frontend base image to UBI** — Replace `nginx:alpine` with a UBI-based nginx image for FIPS compliance readiness.

### Priority 2 (Nice-to-Have)

6. **Create comprehensive agent rules** — Add `CLAUDE.md` documenting Go test patterns (envtest + Ginkgo), Cypress mocked test patterns, and project conventions. Add `.claude/rules/` with test creation guides.

7. **Add concurrency and timeout controls** — Add `concurrency` groups and `timeout-minutes` to test workflows.

8. **Configure FIPS build tags** — Add `-tags=fips` or `GOEXPERIMENT=boringcrypto` to Go build configurations for FIPS-compliant binaries.

## Comparison to Gold Standards

| Aspect | workbenches | odh-dashboard | notebooks | kserve |
|--------|-------------|---------------|-----------|--------|
| Unit test ratio | Moderate (Go: good, Frontend: sparse) | High | Moderate | High |
| E2E in CI | ✅ Kind + Cypress mocked | ✅ Multi-layer | ✅ 5-layer | ✅ Multi-version |
| Coverage enforcement | ❌ No CI reporting | ✅ Codecov | ✅ | ✅ Thresholds |
| Multi-arch builds | ✅ 3 architectures | ✅ | ✅ | ✅ |
| Dependency alerts | ❌ Missing | ✅ Dependabot | ✅ | ✅ |
| Agent rules | ❌ Missing | ✅ Comprehensive | Partial | Partial |
| Linting depth | ✅ 28 Go linters + ESLint | ✅ | ✅ | ✅ |
| FIPS readiness | ⚠️ No config | ⚠️ | ✅ UBI images | ⚠️ |
| Pre-commit hooks | ✅ Husky (frontend) | ✅ | ✅ | ✅ |
| Reusable workflows | ✅ Image builder | ✅ | ✅ | ✅ |

## File Paths Reference

### CI/CD Workflows
- `.github/workflows/ws-backend-test.yml` — Backend build + test
- `.github/workflows/ws-controller-test.yml` — Controller build + test + e2e
- `.github/workflows/ws-frontend-test.yml` — Frontend build + test
- `.github/workflows/ws-build-image.yml` — Reusable image builder
- `.github/workflows/ws-publish.yml` — Image publish on merge
- `.github/workflows/gh-workflow-approve.yaml` — External PR auto-approve
- `.github/workflows/semantic-prs.yaml` — PR title validation

### Testing
- `workspaces/backend/api/*_test.go` — Backend unit tests (12 files)
- `workspaces/backend/internal/**/funcs_test.go` — Backend internal tests (3 files)
- `workspaces/controller/internal/controller/*_test.go` — Controller unit tests
- `workspaces/controller/internal/webhook/*_test.go` — Webhook tests
- `workspaces/controller/test/e2e/` — Controller E2E tests (Kind)
- `workspaces/frontend/src/__tests__/cypress/cypress/tests/mocked/` — Cypress mocked tests (21 files)
- `workspaces/frontend/src/**/__tests__/*.spec.ts` — Jest unit tests (8 files)

### Build & Containers
- `workspaces/backend/Dockerfile` — Go multi-stage → distroless
- `workspaces/controller/Dockerfile` — Go multi-stage → distroless
- `workspaces/frontend/Dockerfile` — Node multi-stage → nginx:alpine
- `workspaces/backend/Makefile` — Build, test, lint, deploy targets
- `workspaces/controller/Makefile` — Build, test, e2e, CRD generation targets
- `workspaces/frontend/Makefile` — Docker build targets

### Static Analysis
- `workspaces/backend/.golangci.yml` — 28 linters enabled
- `workspaces/controller/.golangci.yml` — 28 linters enabled
- `workspaces/frontend/.eslintrc.js` — Comprehensive ESLint config
- `workspaces/frontend/.husky/pre-commit` — Lint hook

### Coverage
- `workspaces/frontend/.nycrc.json` — NYC coverage config (Cypress)
- `workspaces/frontend/jest.config.js` — Jest config with coverage settings

### Development
- `developing/Tiltfile` — Full-stack dev with Kind + Istio
- `developing/Makefile` — Dev environment setup
- `DEVELOPMENT_GUIDE.md` — Local development instructions
