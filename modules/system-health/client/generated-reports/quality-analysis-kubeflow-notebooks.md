---
repository: "kubeflow/notebooks"
analyzed_branch: "notebooks-v2"
overall_score: 6.8
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Good unit test coverage across Go backend/controller and React frontend with Jest and envtest"
  - dimension: "Integration/E2E"
    score: 7.5
    status: "Controller E2E with Kind cluster; Cypress mocked UI tests; full-stack E2E still TODO"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-triggered multi-arch image builds with Docker Buildx; no Konflux simulation"
  - dimension: "Image Testing"
    score: 6.0
    status: "Multi-stage distroless builds with multi-arch support; no runtime validation or health checks"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "Local coverprofile generation but no CI coverage reporting, no codecov, no thresholds"
  - dimension: "CI/CD Automation"
    score: 7.5
    status: "Well-structured component-scoped workflows with path filtering; limited concurrency controls"
  - dimension: "Static Analysis"
    score: 7.0
    status: "Excellent golangci-lint (27 linters) and ESLint configs; no Dependabot/Renovate, no FIPS"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory present"
critical_gaps:
  - title: "No coverage tracking or enforcement in CI"
    impact: "Coverage regressions go undetected; no visibility into test quality trends"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No Dependabot or Renovate for dependency management"
    impact: "Vulnerable or outdated dependencies may go unnoticed"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "Full-stack E2E tests are TODO"
    impact: "No automated end-to-end validation of controller + backend + frontend integration"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No FIPS compliance checks or UBI base images"
    impact: "Non-FIPS-compliant for regulated environments; uses distroless and alpine base images"
    severity: "MEDIUM"
    effort: "8-16 hours"
  - title: "No container runtime validation"
    impact: "Image startup failures not caught until deployment"
    severity: "MEDIUM"
    effort: "4-8 hours"
quick_wins:
  - title: "Add codecov integration with coverage thresholds"
    effort: "4-6 hours"
    impact: "Automated coverage tracking, PR comments, regression detection"
  - title: "Enable Dependabot for Go modules, npm, and GitHub Actions"
    effort: "1-2 hours"
    impact: "Automated security and dependency updates with PR generation"
  - title: "Add concurrency controls to test workflows"
    effort: "1 hour"
    impact: "Prevent redundant CI runs on rapid pushes, reduce resource waste"
  - title: "Create CLAUDE.md with test creation guidelines"
    effort: "2-3 hours"
    impact: "Improve AI-assisted development consistency and test quality"
recommendations:
  priority_0:
    - "Add codecov integration with coverage thresholds and PR reporting for both Go and frontend"
    - "Enable Dependabot for gomod, npm, and github-actions ecosystems"
    - "Implement full-stack E2E tests (currently TODO in testing/Makefile)"
  priority_1:
    - "Add container runtime validation tests (image startup, health checks)"
    - "Add FIPS-compatible base images (UBI) and build tags for regulated deployments"
    - "Add concurrency controls to all test/build workflows"
    - "Create comprehensive agent rules (CLAUDE.md, .claude/rules/) for test patterns"
  priority_2:
    - "Add pre-commit hooks via .pre-commit-config.yaml for repo-wide enforcement"
    - "Add Cypress E2E tests against real backend (not just mocked)"
    - "Add contract tests between frontend API layer and backend OpenAPI spec"
---

# Quality Analysis: kubeflow/notebooks

**Branch Analyzed:** `notebooks-v2` (active development branch)
**Analysis Date:** 2026-07-21
**Repository Type:** Kubernetes Application (Controller + Backend API + React Frontend)
**Primary Languages:** Go, TypeScript/React
**Jira Component:** Notebooks Server (RHOAIENG)

## Executive Summary

**Overall Score: 6.8/10**

Kubeflow Notebooks v2 is a well-structured monorepo with three components — a Kubernetes controller (Go/kubebuilder), a REST backend (Go/Swagger), and a React frontend (TypeScript/MUI). The project demonstrates strong practices in static analysis, unit testing, and PR-triggered image builds. However, it has significant gaps in coverage tracking, dependency management, FIPS compliance, and agent rules.

**Key Strengths:**
- Comprehensive golangci-lint configuration with 27 linters across both Go components
- Rich ESLint configuration with accessibility, spelling, and custom local rules
- PR-triggered multi-architecture Docker image builds (amd64, ppc64le, arm64)
- Controller E2E tests with Kind cluster and envtest-based unit tests
- Cypress UI tests with page object pattern, screenshot/video capture on failure
- Husky pre-commit hooks for frontend lint enforcement

**Critical Gaps:**
- No coverage tracking in CI (coverprofile generated locally but not reported)
- No Dependabot or Renovate configured
- Full-stack E2E tests are explicitly TODO
- No FIPS compliance (distroless/alpine base images, no FIPS build tags)
- No agent rules for AI-assisted development

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 7.0/10 | 15% | 1.05 | Good coverage with Go envtest and Jest/Cypress |
| Integration/E2E | 7.5/10 | 20% | 1.50 | Controller E2E + Cypress UI; full-stack TODO |
| Build Integration | 7.0/10 | 15% | 1.05 | Multi-arch PR builds; no Konflux simulation |
| Image Testing | 6.0/10 | 10% | 0.60 | Multi-stage distroless; no runtime validation |
| Coverage Tracking | 4.0/10 | 10% | 0.40 | Local coverprofile only; no CI reporting |
| CI/CD Automation | 7.5/10 | 15% | 1.13 | Well-structured; limited concurrency |
| Static Analysis | 7.0/10 | 10% | 0.70 | Excellent linting; missing dep alerts + FIPS |
| Agent Rules | 0.0/10 | 5% | 0.00 | No agent rules present |
| **Overall** | **6.8/10** | **100%** | **6.43** | |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement in CI
- **Severity:** HIGH
- **Impact:** Coverage regressions go undetected across PRs; no team visibility into test quality
- **Current State:** Both Go components generate `cover.out` via `go test -coverprofile` and frontend has `test:coverage` npm script with istanbul/nyc, but none are uploaded to any coverage service in CI workflows
- **Effort:** 4-6 hours
- **Fix:** Add codecov/codecov-action to all three test workflows with threshold enforcement

### 2. No Dependabot or Renovate Configuration
- **Severity:** HIGH
- **Impact:** Vulnerable or outdated Go modules, npm packages, and GitHub Actions may go unnoticed
- **Current State:** No `.github/dependabot.yml` or `renovate.json` found on the `notebooks-v2` branch (main branch had one but it's been removed or not ported)
- **Effort:** 1-2 hours
- **Fix:** Add `.github/dependabot.yml` covering `gomod`, `npm`, `docker`, and `github-actions` ecosystems

### 3. Full-Stack E2E Tests Are TODO
- **Severity:** HIGH
- **Impact:** No automated validation that controller + backend + frontend work together correctly
- **Current State:** `testing/Makefile` has `local-e2e` target that prints "TODO: there are no e2e tests yet, they will be defined in Cypress..." — the infrastructure (Kind cluster setup, deploy-all, sanity-check) exists but actual tests are missing
- **Effort:** 16-24 hours
- **Fix:** Implement Cypress tests against a real deployed stack in Kind, exercising workspace CRUD operations

### 4. No FIPS Compliance Checks
- **Severity:** MEDIUM
- **Impact:** Cannot be used in FIPS-regulated environments without rework
- **Current State:** Backend and controller use `gcr.io/distroless/static:nonroot`; frontend uses `nginx:alpine`. No FIPS build tags, no BoringCrypto, no UBI base images
- **Effort:** 8-16 hours
- **Fix:** Switch to UBI-based images, add FIPS build tags (`GOEXPERIMENT=boringcrypto`), validate crypto imports

### 5. No Container Runtime Validation
- **Severity:** MEDIUM
- **Impact:** Image startup failures, port misconfigurations, or missing dependencies not caught until deployment
- **Current State:** PR workflows build images but don't run them; no health checks or startup tests
- **Effort:** 4-8 hours
- **Fix:** Add `docker run` smoke tests after image build to verify startup, port exposure, and basic health

## Quick Wins

### 1. Enable Dependabot (1-2 hours)
Add `.github/dependabot.yml`:
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
  - package-ecosystem: "github-actions"
    directory: "/"
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
```

### 2. Add Codecov Integration (4-6 hours)
Add to each test workflow after the test step:
```yaml
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: ./cover.out  # or coverage/coverage-final.json for frontend
    flags: backend  # or controller, frontend
    fail_ci_if_error: true
```
Add `.codecov.yml` with thresholds:
```yaml
coverage:
  status:
    project:
      default:
        target: 60%
        threshold: 5%
    patch:
      default:
        target: 70%
```

### 3. Add Concurrency Controls (1 hour)
Add to test workflows that currently lack them:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 4. Create Agent Rules (2-3 hours)
Create `CLAUDE.md` with test creation guidelines covering Go envtest patterns, Cypress page object conventions, and naming standards.

## Detailed Findings

### Unit Tests (7.0/10)

**Go Backend (16 test files):**
- Framework: Go standard `testing` + envtest (kubebuilder)
- Test files: `api/*_test.go` covering all REST handlers (healthcheck, namespaces, PVCs, secrets, workspaces, workspace kinds)
- Internal tests: `helper/validation_test.go`, model function tests
- Suite tests use envtest with Kubernetes API server for realistic controller-runtime testing
- Coverage profile generated: `go test ./... -coverprofile cover.out`
- Lint enforced before tests: `make lint` in CI

**Go Controller (10 test files):**
- Framework: Ginkgo/Gomega + envtest
- Test files: workspace_controller_test.go, workspacekind_controller_test.go, webhook tests
- Suite test setup with envtest binary at K8s version 1.31.0
- E2E tests excluded from unit runs: `go list ./... | grep -v /e2e`
- Coverage profile generated

**React Frontend (9 Jest spec files):**
- Framework: Jest 30 + React Testing Library
- Test files: utility tests (apiUtils, devAuth, imageUtils, valueUnits), form helper tests, hook tests
- Coverage tooling: jest-coverage with istanbul merge for combined Jest + Cypress coverage
- Type checking enforced in CI

**Test-to-Code Ratios:**
- Go: 26 test files / 95 source files = 27% (moderate)
- Frontend Jest: 9 test files / 164 source files = 5.5% (low — Cypress covers more)

### Integration/E2E Tests (7.5/10)

**Controller E2E (2 test files, 539 lines):**
- Framework: Ginkgo with Kind cluster
- PR-triggered with `helm/kind-action` (Kind 1.35)
- Tests workspace and workspacekind lifecycle in a real Kubernetes cluster
- Istioctl installed for service mesh validation
- Run via `go test ./test/e2e/ -v -ginkgo.v`

**Frontend Cypress (21 test files):**
- Framework: Cypress 13+ with Chrome browser
- Comprehensive page object pattern with dedicated page files for each feature area
- Tests cover: workspace CRUD, workspace kinds, secrets management, volume management, form validation, redirect handling, filtering
- Currently mocked only (`CY_MOCK=1`) — intercepts API calls
- Accessibility testing via `cypress-axe`
- CI uploads test reports (JUnit XML), screenshots and videos on failure
- Coverage support via istanbul/nyc instrumentation

**Full-Stack E2E (TODO):**
- Infrastructure exists in `testing/`: Kind cluster setup, cert-manager, Istio, deploy-all targets
- `local-e2e` target is explicitly stubbed: "TODO: there are no e2e tests yet"
- CI workflow `ws-e2e-test.yml` exists but calls the TODO target

### Build Integration (7.0/10)

**PR Image Builds:**
- All three components build Docker images on PRs via reusable `ws-build-image.yml` workflow
- Multi-architecture: `linux/amd64,linux/ppc64le,linux/arm64/v8`
- Uses Docker Buildx with QEMU for cross-platform builds
- SHA-based tagging for image traceability
- Porcelain checks ensure no uncommitted changes after builds

**Deployment Manifests:**
- Kustomize overlays for Istio integration per component
- CRD generation via controller-gen for webhook, RBAC, and CRD manifests
- Deployment to Kind cluster supported for development

**Gaps:**
- No Konflux build simulation
- No `kubectl apply --dry-run` manifest validation in CI
- Image builds don't test runtime behavior

### Image Testing (6.0/10)

**Dockerfiles:**
- Backend: Multi-stage (golang:1.24 builder → distroless/static:nonroot). Non-root user (65532). Exposes port 4000.
- Controller: Multi-stage (golang:1.24 builder → distroless/static:nonroot). Non-root user (65532).
- Frontend: Multi-stage (node:24-slim builder → nginx:alpine). Nginx configured for non-root (UID 101) with proper directory permissions.

**Strengths:**
- All Dockerfiles use multi-stage builds for minimal image size
- Build args for cross-platform compilation (`BUILDPLATFORM`, `TARGETOS`, `TARGETARCH`)
- Non-root execution in all containers
- Go builds with `CGO_ENABLED=0` for static binaries

**Gaps:**
- No HEALTHCHECK instructions in any Dockerfile
- No container runtime validation tests (startup, port check, basic request)
- No Testcontainers or equivalent for integration testing with actual containers
- Frontend uses `nginx:alpine` (not FIPS-compatible)
- Backend/controller use `gcr.io/distroless/static:nonroot` (not UBI)

### Coverage Tracking (4.0/10)

**Current State:**
- Go backend: `go test ./... -coverprofile cover.out` (local only)
- Go controller: `go test ... -coverprofile cover.out` (local only, excludes E2E)
- Frontend: `test:coverage` npm script with Jest coverage + Cypress coverage merged via istanbul
- **None of these are uploaded to any coverage service in CI**

**Gaps:**
- No `.codecov.yml` or `coveralls.yml`
- No `codecov/codecov-action` in any workflow
- No coverage thresholds or gates
- No PR coverage comments
- Coverage data exists but is not tracked or enforced

### CI/CD Automation (7.5/10)

**Workflow Inventory:**
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ws-backend-test.yml` | PR + push | Build, lint, unit test, image build |
| `ws-controller-test.yml` | PR + push | Build, lint, unit test, E2E, image build |
| `ws-frontend-test.yml` | PR + push | Build, lint, type-check, Jest + Cypress, image build |
| `ws-e2e-test.yml` | PR + push | Full-stack E2E (currently TODO) |
| `ws-build-image.yml` | Reusable | Multi-arch image build with Buildx/QEMU |
| `ws-publish.yml` | Push to main | Build and push all images to GHCR |
| `semantic-prs.yaml` | PR | Enforce conventional commit titles |
| `gh-workflow-approve.yaml` | PR label | Auto-approve workflows for org members |

**Strengths:**
- Path-scoped triggers prevent unnecessary CI runs (e.g., backend tests only on backend changes)
- Cross-component awareness (backend tests also trigger on controller changes)
- Reusable workflow pattern for image building reduces duplication
- Semantic PR title enforcement for clean changelogs
- GitHub Actions pinned to commit SHAs for supply chain security
- Go dependency caching via `cache-dependency-path`
- Cypress artifact collection (reports, screenshots, videos)

**Gaps:**
- No concurrency controls on test/build workflows (only on semantic-prs and approve)
- No timeout-minutes set on any workflow
- No test parallelization/sharding
- No scheduled/periodic test runs

### Static Analysis (7.0/10)

#### Linting

**Go (golangci-lint v2.12.2):**
- 27 linters enabled across both backend and controller
- Key linters: gosec, govet, errcheck, staticcheck, gocyclo, dupl, goconst, revive, modernize
- License header enforcement via goheader
- goimports with local package ordering
- Version 2 config format with explicit `default: none` (no implicit linters)

**Frontend (ESLint):**
- Extensive configuration with 14 plugins including:
  - `@typescript-eslint` for type-aware rules
  - `jsx-a11y` for accessibility
  - `react-hooks` for hook correctness
  - `no-only-tests` to prevent `.only()` leaks
  - `@cspell/spellchecker` for code spelling
  - `local-rules` for custom project-specific rules
  - `prettier` for formatting
  - `import` for import order enforcement
- Cypress-specific overrides with `plugin:cypress/recommended`
- Naming conventions enforced (camelCase variables, PascalCase types)

#### Pre-commit Hooks

- Husky pre-commit hook for frontend: runs `npm run test:lint` on staged frontend changes
- No repo-wide `.pre-commit-config.yaml`
- No pre-commit hooks for Go code (relies on CI)

#### FIPS Compatibility

- No FIPS build tags (`-tags=fips`, `GOEXPERIMENT=boringcrypto`)
- No non-FIPS crypto imports found (no `crypto/md5`, `crypto/des`, `crypto/rc4`)
- Base images are not FIPS-capable (distroless, alpine)
- No FIPS compliance checking in CI

#### Dependency Alerts

- **No Dependabot configured** on `notebooks-v2` branch
- **No Renovate configured**
- GitHub Actions are pinned to SHAs (good supply chain practice) but no automated update mechanism

### Agent Rules (0.0/10)

- **No `CLAUDE.md` or `AGENTS.md`** in repository root
- **No `.claude/` directory** with rules or skills
- **No test automation guidance** for AI agents
- No documentation on test patterns, naming conventions, or quality gates for AI-assisted contributions

## Recommendations

### Priority 0 (Critical)

1. **Add codecov integration with coverage thresholds** — Both Go components already generate coverprofiles and the frontend has istanbul/nyc infrastructure. Wire these into CI with `codecov/codecov-action` and set project-level (60%) and patch-level (70%) thresholds.

2. **Enable Dependabot** for all package ecosystems — Go modules, npm, Docker base images, and GitHub Actions. This is a ~30-minute configuration change with high security value.

3. **Implement full-stack E2E tests** — The Kind cluster infrastructure and deploy-all targets exist. Implement Cypress tests that run against the deployed stack (not mocked) to validate workspace lifecycle end-to-end.

### Priority 1 (High Value)

4. **Add container runtime validation** — After PR image builds, run basic smoke tests: start the container, verify port is listening, send a health check request. This catches Dockerfile misconfigurations before merge.

5. **Add FIPS-compatible base images** — For Red Hat/RHOAI downstream, switch Go components to UBI-based images and add `GOEXPERIMENT=boringcrypto` build flag. Frontend should use UBI + nginx instead of `nginx:alpine`.

6. **Add concurrency controls and timeouts** — Add `concurrency: cancel-in-progress: true` and `timeout-minutes: 30` to all test/build workflows to prevent resource waste.

7. **Create comprehensive agent rules** — Add `CLAUDE.md` with guidelines for Go envtest patterns, Cypress page object conventions, test naming, and quality gate checklists. Consider using `/test-rules-generator` to bootstrap rules from existing patterns.

### Priority 2 (Nice-to-Have)

8. **Add repo-wide `.pre-commit-config.yaml`** — Extend the Husky-based frontend linting to cover Go code with golangci-lint pre-commit hooks.

9. **Add real backend Cypress tests** — Current Cypress tests are all mocked (`CY_MOCK=1`). Add a test suite that runs against the actual backend for higher confidence.

10. **Add contract tests** — Validate frontend generated API types match the backend's OpenAPI spec to prevent API drift.

## Comparison to Gold Standards

| Capability | kubeflow/notebooks | odh-dashboard | kserve | notebooks (gold) |
|-----------|-------------------|---------------|--------|-----------------|
| Unit Tests | Go envtest + Jest | Jest + RTL | Go testing | Go testing |
| E2E Tests | Controller E2E + Cypress (mocked) | Cypress (mocked + real) | Ginkgo E2E | Multi-layer |
| Coverage CI | None | Codecov | Codecov | Codecov |
| Coverage Gate | None | Yes (80%) | Yes | Yes |
| Dependabot | None | Configured | Configured | Configured |
| FIPS | None | UBI images | Partial | UBI + BoringCrypto |
| Pre-commit | Husky (frontend) | .pre-commit-config | .pre-commit-config | .pre-commit-config |
| Agent Rules | None | CLAUDE.md + rules | None | None |
| Multi-arch | Yes (3 platforms) | Yes | Yes | Yes |
| Image Build on PR | Yes | Yes | Yes | Yes |
| Concurrency | Partial (2/8 workflows) | Full | Full | Full |
| Semantic PRs | Yes | Yes | No | No |

## File Paths Reference

### CI/CD Workflows
- `.github/workflows/ws-backend-test.yml` — Backend build, lint, unit tests, image build
- `.github/workflows/ws-controller-test.yml` — Controller build, lint, unit + E2E tests, image build
- `.github/workflows/ws-frontend-test.yml` — Frontend build, lint, type-check, Jest + Cypress, image build
- `.github/workflows/ws-e2e-test.yml` — Full-stack E2E (TODO)
- `.github/workflows/ws-build-image.yml` — Reusable multi-arch image build
- `.github/workflows/ws-publish.yml` — Push images to GHCR
- `.github/workflows/semantic-prs.yaml` — PR title validation
- `.github/workflows/gh-workflow-approve.yaml` — Auto-approve for org members

### Build & Deploy
- `workspaces/backend/Makefile` — Backend build, test, lint, deploy targets
- `workspaces/controller/Makefile` — Controller build, test, E2E, deploy targets
- `workspaces/frontend/Makefile` — Frontend image build and deploy targets
- `testing/Makefile` — Full-stack E2E cluster setup and test targets
- `workspaces/backend/Dockerfile` — Multi-stage Go → distroless
- `workspaces/controller/Dockerfile` — Multi-stage Go → distroless
- `workspaces/frontend/Dockerfile` — Multi-stage Node → nginx:alpine

### Static Analysis
- `workspaces/backend/.golangci.yml` — 27 linters, v2 config
- `workspaces/controller/.golangci.yml` — 27 linters, v2 config
- `workspaces/frontend/.eslintrc.js` — ESLint with 14 plugins

### Testing
- `workspaces/backend/api/*_test.go` — Backend handler unit tests (16 files)
- `workspaces/controller/internal/controller/*_test.go` — Controller unit tests
- `workspaces/controller/internal/webhook/*_test.go` — Webhook validation tests
- `workspaces/controller/test/e2e/` — Controller E2E tests with Kind
- `workspaces/frontend/src/__tests__/cypress/` — Cypress test suite (21 test files)
- `workspaces/frontend/src/**/*.spec.ts` — Jest unit tests (9 files)

### Pre-commit
- `workspaces/frontend/.husky/pre-commit` — Frontend lint hook
