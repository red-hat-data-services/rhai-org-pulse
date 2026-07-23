---
repository: "opendatahub-io/workbenches"
overall_score: 5.9
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Good test suites for Go (Ginkgo/envtest) and TypeScript (Jest), ~27% Go test-to-code ratio"
  - dimension: "Integration/E2E"
    score: 6.0
    status: "Controller E2E with Kind, 21 mocked Cypress tests, but full-stack E2E is a placeholder"
  - dimension: "Build Integration"
    score: 7.0
    status: "Multi-arch PR image builds for all components, Tekton/Konflux for controller only"
  - dimension: "Image Testing"
    score: 5.0
    status: "Multi-stage builds with distroless base, no runtime validation or HEALTHCHECK"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "coverprofile generated locally but no CI enforcement, no codecov, no thresholds"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "Well-organized path-filtered workflows, semantic PRs, missing concurrency controls"
  - dimension: "Static Analysis"
    score: 7.0
    status: "Comprehensive golangci-lint (~30 linters) and ESLint, Husky hooks, no Dependabot/Renovate"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory present"
critical_gaps:
  - title: "No coverage enforcement in CI"
    impact: "Coverage regressions go undetected; no PR-level reporting prevents gradual quality erosion"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Full-stack E2E tests are a placeholder"
    impact: "The ws-e2e-test.yml pipeline deploys all components but runs no actual tests ('TODO: no e2e tests yet')"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No Dependabot or Renovate for dependency updates"
    impact: "Stale dependencies with potential security vulnerabilities go undetected"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No FIPS-compatible base images"
    impact: "Frontend uses nginx:alpine, Go components use distroless — neither is UBI-based for FIPS compliance"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "Tekton/Konflux pipelines only configured for controller"
    impact: "Backend and frontend lack Konflux PR/push pipeline definitions, risking build-time divergence"
    severity: "MEDIUM"
    effort: "4-8 hours"
quick_wins:
  - title: "Enable Dependabot for automated dependency alerts"
    effort: "1-2 hours"
    impact: "Automated security and dependency updates for Go, npm, and Docker ecosystems"
  - title: "Add codecov integration to CI workflows"
    effort: "3-4 hours"
    impact: "PR-level coverage reporting and threshold enforcement for all components"
  - title: "Add concurrency controls and timeout-minutes to test workflows"
    effort: "1-2 hours"
    impact: "Prevent duplicate CI runs and stuck jobs, reduce CI cost"
  - title: "Create basic CLAUDE.md with test patterns and conventions"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality and onboarding for new contributors"
recommendations:
  priority_0:
    - "Integrate codecov with coverage thresholds and PR reporting for Go and TypeScript"
    - "Implement real full-stack E2E tests in Cypress (replace placeholder in ws-e2e-test.yml)"
    - "Add .github/dependabot.yml covering gomod, npm, and docker ecosystems"
  priority_1:
    - "Add Tekton/Konflux pipeline definitions for backend and frontend components"
    - "Switch frontend base image from nginx:alpine to UBI-based nginx for FIPS readiness"
    - "Add concurrency controls and timeout-minutes to all test workflows"
    - "Create CLAUDE.md with test patterns, framework conventions, and quality gates"
  priority_2:
    - "Add multi-version K8s testing (matrix strategy with multiple Kind configs)"
    - "Add HEALTHCHECK instructions to Dockerfiles"
    - "Add container runtime validation tests (image startup, port binding)"
    - "Implement contract tests between frontend and backend API"
---

# Quality Analysis: opendatahub-io/workbenches

## Executive Summary

- **Overall Score: 5.9/10**
- **Repository Type**: Monorepo (Go Kubernetes controller + Go backend + TypeScript/React frontend)
- **Primary Languages**: Go 1.24, TypeScript (Node 20, React)
- **Framework**: Kubernetes operator (kubebuilder), React (PatternFly), REST API
- **Jira**: RHOAIENG / Notebooks Server (midstream tier)

**Key Strengths**: Well-organized monorepo with separate CI workflows per component, comprehensive linting (30+ golangci-lint rules, extensive ESLint with accessibility checks), multi-architecture image builds, and good test isolation patterns.

**Critical Gaps**: No coverage enforcement in CI, full-stack E2E tests are a placeholder, no dependency alert configuration (Dependabot/Renovate), and no FIPS-compatible base images.

**Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory.

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 7.0/10 | 15% | Good test suites for Go (Ginkgo/envtest) and TypeScript (Jest) |
| Integration/E2E | 6.0/10 | 20% | Controller E2E with Kind, mocked Cypress tests, placeholder full-stack E2E |
| Build Integration | 7.0/10 | 15% | Multi-arch PR image builds, Tekton/Konflux for controller only |
| Image Testing | 5.0/10 | 10% | Multi-stage builds, no runtime validation or HEALTHCHECK |
| Coverage Tracking | 3.0/10 | 10% | coverprofile generated locally but not enforced in CI |
| CI/CD Automation | 7.0/10 | 15% | Well-organized path-filtered workflows, missing concurrency controls |
| Static Analysis | 7.0/10 | 10% | Comprehensive linting for Go and TypeScript, missing Dependabot |
| Agent Rules | 0.0/10 | 5% | No agent rules present |
| **Overall** | **5.9/10** | | |

## Critical Gaps

### 1. No Coverage Enforcement in CI
- **Impact**: Coverage regressions go undetected; no PR-level reporting prevents gradual quality erosion
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Both Go components generate `cover.out` via `--coverprofile` and the frontend has Jest/NYC coverage configs, but none are uploaded to codecov or enforced with thresholds in CI. Coverage merge scripts exist locally (`test:coverage:merge`) but never run in workflows.

### 2. Full-Stack E2E Tests Are a Placeholder
- **Impact**: The `ws-e2e-test.yml` workflow deploys all 3 components to a Kind cluster but the `make local-e2e` target contains only a TODO comment: "there are no e2e tests yet, they will be defined in Cypress..."
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: While the controller has its own Ginkgo E2E tests and the frontend has mocked Cypress tests, there are no tests that validate the full stack (frontend → backend → controller → K8s) working together.

### 3. No Dependency Alert Configuration
- **Impact**: Stale dependencies with potential security vulnerabilities go undetected; no automated PRs for updates
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: Neither `.github/dependabot.yml` nor `renovate.json`/`.renovaterc` exists. The repo uses Go modules, npm, and Docker base images — all require monitoring.

### 4. No FIPS-Compatible Base Images
- **Impact**: Production images cannot run in FIPS-enforced environments without base image changes
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Details**: Frontend uses `nginx:alpine` and Go components use `gcr.io/distroless/static:nonroot`. For RHOAI FIPS compliance, UBI-based images are preferred (`registry.access.redhat.com/ubi9/ubi-minimal` or `registry.access.redhat.com/ubi9/nginx-124`). No FIPS build tags or BoringCrypto configuration found, though no non-FIPS-compliant crypto imports were detected in source code.

### 5. Incomplete Tekton/Konflux Pipeline Coverage
- **Impact**: Backend and frontend lack Konflux pipeline definitions; builds may diverge between GitHub Actions and Konflux
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: Only `.tekton/odh-workbenches-controller-pull-request.yaml` and `odh-workbenches-controller-push.yaml` exist. Backend and frontend need equivalent Tekton pipeline configs referencing `odh-konflux-central`.

## Quick Wins

### 1. Enable Dependabot (1-2 hours)
Add `.github/dependabot.yml` covering all ecosystems:

```yaml
version: 2
updates:
  - package-ecosystem: "gomod"
    directory: "/workspaces/controller"
    schedule:
      interval: "weekly"
  - package-ecosystem: "gomod"
    directory: "/workspaces/backend"
    schedule:
      interval: "weekly"
  - package-ecosystem: "npm"
    directory: "/workspaces/frontend"
    schedule:
      interval: "weekly"
  - package-ecosystem: "docker"
    directory: "/workspaces/controller"
    schedule:
      interval: "monthly"
  - package-ecosystem: "docker"
    directory: "/workspaces/backend"
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

### 2. Add Codecov Integration (3-4 hours)
Add coverage upload steps to each test workflow:

**For Go workflows** (ws-backend-test.yml, ws-controller-test.yml):
```yaml
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          file: workspaces/backend/cover.out
          flags: backend-unit
          fail_ci_if_error: true
```

**Add `.codecov.yml`**:
```yaml
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

### 3. Add Concurrency Controls and Timeouts (1-2 hours)
Add to each test workflow:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
```

### 4. Create Basic CLAUDE.md (2-3 hours)
Document test patterns, framework conventions, and quality gates for AI-assisted development.

## Detailed Findings

### Unit Tests

**Go Backend (14 test files)**:
- Well-structured API handler tests: `workspaces_handler_test.go`, `namespaces_handler_test.go`, `pvcs_handler_test.go`, `secrets_handler_test.go`, etc.
- Suite-based testing with `suite_test.go` using envtest (Kubernetes API server)
- Helper/model unit tests: `validation_test.go`, `funcs_test.go`
- Test-to-code ratio: ~27% (25 test files / 91 Go source files)

**Go Controller (8 test files, 6 unit)**:
- Controller tests: `workspace_controller_test.go`, `workspacekind_controller_test.go`
- Webhook validation tests: `workspace_webhook_test.go`, `workspacekind_webhook_test.go`
- Graph helper tests: `graph_test.go`
- Suite files with envtest setup for K8s API testing

**TypeScript Frontend (35 spec files)**:
- React hook tests: `useWorkspaces.spec.tsx`, `usePolling.spec.tsx`, `useSecret.spec.tsx`, etc.
- Component tests: `RefreshCounter.spec.tsx`, `WorkspaceKindImage.spec.tsx`, `ToolbarFilter.spec.tsx`
- Page-level tests: `WorkspaceFormSummaryPanel.spec.tsx`, `TolerationModal.spec.tsx`
- Utility tests: `apiUtils.spec.ts`, `imageUtils.spec.ts`, `valueUnits.spec.ts`
- Jest config with proper module mapping and coverage collection rules

**Frameworks**: Go testing + Ginkgo/Gomega + envtest (Go), Jest + React Testing Library (TypeScript)

### Integration/E2E Tests

**Controller E2E Tests** (`workspaces/controller/test/e2e/`):
- Ginkgo-based E2E suite with Kind cluster
- Runs on PR via `ws-controller-test.yml` with `helm/kind-action`
- Kind config: `testing/kind-1-35.yaml` (single Kubernetes version)
- Tests validate controller behavior against real K8s API

**Frontend Cypress Tests** (21 test files in `src/__tests__/cypress/cypress/tests/mocked/`):
- Comprehensive mocked UI tests covering workspaces and workspaceKinds
- Covers: create, edit, list, filter, secrets, volumes, redirects, styling
- Page Object pattern with structured page files
- Test reporting: Mochawesome + JUnit with artifact upload
- Code coverage support via `@cypress/code-coverage` + NYC
- Retry support: 2 retries in run mode

**Full-Stack E2E** (`testing/`):
- `ws-e2e-test.yml` workflow deploys all components to Kind cluster
- `testing/Makefile` has `setup-cluster`, `deploy-all`, `sanity-check` targets
- Scripts for Kind setup, cert-manager, Istio installation
- **BUT**: `make local-e2e` target is a TODO placeholder with no actual tests

**Missing**: No multi-version K8s testing matrix, no contract tests between frontend/backend API

### Build Integration

**PR-Time Build Validation**:
- All 3 components build Docker images on PRs via reusable `ws-build-image.yml`
- Multi-platform builds: `linux/amd64,linux/ppc64le,linux/arm64/v8`
- QEMU + Docker Buildx for cross-platform compilation
- Docker metadata action for proper image tagging (SHA-based)

**Go Build Validation**:
- `go mod tidy` + porcelain check ensures clean module state
- Lint → Build → Image Build pipeline on PRs
- Backend additionally runs Swagger generation and validation

**Tekton/Konflux**:
- Controller has PR and push Tekton pipelines referencing `odh-konflux-central`
- Multi-arch container build pipeline via PipelineAsCode
- Output to `quay.io/opendatahub/odh-workbenches-controller`
- Backend and frontend do NOT have Tekton pipeline definitions

**Publish Workflow**:
- Matrix strategy building all 3 images on push to main
- Version-tagged images from release branches via `releasing/version/VERSION`

### Image Testing

**Dockerfiles**:
- All 3 components use multi-stage builds (builder → runtime)
- Backend/Controller: `golang:1.24` builder → `gcr.io/distroless/static:nonroot` runtime
- Frontend: `node:20-slim` builder → `nginx:alpine` runtime
- Non-root execution: Go components run as `65532:65532`, frontend as `101:101`
- Platform args: `BUILDPLATFORM`, `TARGETOS`, `TARGETARCH` for cross-compilation

**Missing**:
- No `HEALTHCHECK` instructions in any Dockerfile
- No Testcontainers or container runtime validation
- No image startup tests
- Frontend uses `nginx:alpine` (not FIPS-compatible, not UBI-based)

### Coverage Tracking

**Go Coverage**:
- Backend: `go test ./... -coverprofile cover.out` in Makefile `test` target
- Controller: `go test ... -coverprofile cover.out` (excludes e2e tests)
- Coverage files generated but never uploaded or enforced in CI

**Frontend Coverage**:
- Jest: `coverageDirectory: 'jest-coverage'` with proper `collectCoverageFrom` patterns
- Cypress: NYC config in `.nycrc.json` with lcov/html reporters
- Merge script: `test:coverage:merge` combines Jest + Cypress coverage via `istanbul-merge`
- **Not run in CI**: `test:coverage` is not part of `npm run test` pipeline

**Missing**:
- No `.codecov.yml` or `codecov.yml`
- No coverage thresholds or enforcement
- No PR coverage comments or gates
- Coverage generation and merge capability exists but is completely disconnected from CI

### CI/CD Automation

**Workflow Inventory** (8 workflows):
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ws-backend-test.yml` | PR + push | Build, lint, unit test backend |
| `ws-controller-test.yml` | PR + push | Build, lint, unit test, E2E test controller |
| `ws-frontend-test.yml` | PR + push | Build, lint, type-check, unit test, Cypress test frontend |
| `ws-e2e-test.yml` | PR + push | Full-stack E2E (placeholder) |
| `ws-build-image.yml` | Reusable | Multi-arch Docker image build |
| `ws-publish.yml` | Push | Build and publish all images |
| `semantic-prs.yaml` | PR | Enforce semantic PR titles |
| `gh-workflow-approve.yaml` | PR | Auto-approve for org members |

**Strengths**:
- Path-filtered triggers: workflows only run when relevant files change
- Semantic PR title enforcement with allowed types
- Auto-approval for Kubeflow org members
- Reusable workflow pattern for image builds
- Pinned action versions with SHA hashes (security best practice)

**Missing**:
- No concurrency controls on test workflows (only on semantic-prs and approve)
- No `timeout-minutes` on any job
- No test caching beyond Go module cache
- Frontend npm caching not configured in `actions/setup-node`
- No test parallelization strategy

### Static Analysis

#### Linting
**Go (golangci-lint)**:
- Both backend and controller have `.golangci.yml` with ~30 linters enabled
- Comprehensive coverage: `asciicheck`, `bodyclose`, `dupl`, `errcheck`, `errorlint`, `exhaustive`, `ginkgolinter`, `goconst`, `gocritic`, `gocyclo`, `gosec`, `govet`, `ineffassign`, `lll`, `misspell`, `revive`, `staticcheck`, `unconvert`, `unparam`, `unused`, and more
- gocritic with all tags enabled (diagnostic, experimental, opinionated, performance, style)
- License header enforcement via `goheader`
- Smart exclusion rules for test files and API packages

**TypeScript (ESLint)**:
- Extensive ruleset with 50+ rules configured
- TypeScript-specific rules: naming conventions, no-unused-vars, explicit-module-boundary-types
- React hooks exhaustive-deps enforcement
- Accessibility rules via `jsx-a11y`
- Import ordering and no-duplicate enforcement
- Spell checking via `@cspell/spellchecker`
- Prettier integration for consistent formatting
- Custom local ESLint rules
- Restricted imports preventing barrel imports from PatternFly, lodash, date-fns

#### FIPS Compatibility
- **No non-compliant crypto imports found** in source code (clean)
- **No FIPS build tags**: no `-tags=fips`, `GOEXPERIMENT=boringcrypto`
- **Base images are not FIPS-compatible**:
  - Backend/Controller: `gcr.io/distroless/static:nonroot`
  - Frontend: `nginx:alpine`
  - Neither uses UBI-based images

#### Dependency Alerts
- **No `.github/dependabot.yml`** — not configured
- **No `renovate.json` or `.renovaterc`** — not configured
- Three ecosystems unmonitored: Go modules, npm, Docker base images

#### Pre-commit Hooks
- Husky pre-commit hook runs ESLint on staged frontend changes
- No pre-commit hooks for Go components

### Agent Rules

- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **Test creation rules**: None
- **Quality gates**: None

**Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
- Go unit test patterns (envtest, Ginkgo, Gomega)
- TypeScript unit test patterns (Jest, React Testing Library)
- Cypress E2E test patterns (Page Object model, mocked tests)
- API handler test conventions
- Webhook validation test patterns

## Recommendations

### Priority 0 (Critical)

1. **Integrate codecov with coverage thresholds and PR reporting** (4-6 hours)
   - Add `codecov/codecov-action` to all 3 test workflows
   - Create `.codecov.yml` with project target (60%) and patch target (70%)
   - Upload `cover.out` from Go workflows and Jest/Cypress coverage from frontend

2. **Implement real full-stack E2E tests** (16-24 hours)
   - Replace the placeholder `make local-e2e` with actual Cypress E2E tests
   - Tests should validate: frontend → backend API → controller → K8s resources
   - Leverage existing `testing/Makefile` infrastructure (Kind, cert-manager, Istio)

3. **Add Dependabot configuration** (1-2 hours)
   - Cover all ecosystems: gomod (2 modules), npm, docker (3 Dockerfiles), github-actions
   - Enable auto-merge for patch updates

### Priority 1 (High Value)

4. **Add Tekton/Konflux pipelines for backend and frontend** (4-8 hours)
   - Create `.tekton/odh-workbenches-backend-pull-request.yaml` and push equivalents
   - Create `.tekton/odh-workbenches-frontend-pull-request.yaml` and push equivalents
   - Reference `odh-konflux-central` pipeline, matching controller pattern

5. **Switch frontend base image to UBI-based nginx** (4-6 hours)
   - Replace `FROM nginx:alpine` with `FROM registry.access.redhat.com/ubi9/nginx-124`
   - Adjust nginx config paths as needed for UBI layout
   - Evaluate UBI-based distroless alternatives for Go components

6. **Add concurrency controls and timeouts to all test workflows** (1-2 hours)
   - Add `concurrency: group/cancel-in-progress` to prevent duplicate CI runs
   - Set `timeout-minutes: 20` for build/test jobs, `timeout-minutes: 30` for E2E

7. **Create comprehensive agent rules** (2-3 hours)
   - Add `CLAUDE.md` documenting test patterns, framework conventions, and quality gates
   - Consider running `/test-rules-generator` to bootstrap `.claude/rules/` test patterns

### Priority 2 (Nice-to-Have)

8. **Add multi-version K8s testing** (4-6 hours)
   - Create Kind configs for multiple K8s versions (1.30, 1.31, 1.32)
   - Use matrix strategy in controller E2E workflow

9. **Add HEALTHCHECK to Dockerfiles** (1-2 hours)
   - Backend: `HEALTHCHECK CMD wget --no-verbose --tries=1 --spider http://localhost:4000/healthcheck || exit 1`
   - Frontend: `HEALTHCHECK CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1`

10. **Implement contract tests** (8-12 hours)
    - Generate OpenAPI spec from backend Swagger annotations
    - Validate frontend API client against generated spec
    - Fail CI if contract diverges

11. **Add npm caching to frontend workflow** (30 min)
    - Add `cache-dependency-path: workspaces/frontend/package-lock.json` to `actions/setup-node`
    - This is likely already handled by the `cache-dependency-path` property, but verify

## Comparison to Gold Standards

| Practice | workbenches | odh-dashboard | notebooks | kserve |
|----------|-------------|---------------|-----------|--------|
| Unit test framework | Jest + Ginkgo/envtest | Jest + Cypress | pytest | Go testing + envtest |
| Test-to-code ratio | ~20-27% | ~30% | ~15% | ~35% |
| E2E tests | Partial (controller only) | Cypress + real API | Image validation | Ginkgo E2E |
| Coverage enforcement | None | Codecov with thresholds | None | Codecov with thresholds |
| Multi-arch builds | Yes (3 platforms) | Yes | Yes (5-layer) | Yes |
| FIPS readiness | Not ready (distroless/alpine) | Partial | UBI-based | Partial |
| Dependency alerts | None | Dependabot | Dependabot | Dependabot |
| Linting depth | Excellent (30+ linters) | Excellent | Good | Good |
| Agent rules | None | Present (CLAUDE.md) | None | None |
| Semantic PRs | Yes | Yes | No | No |
| Tekton/Konflux | Controller only | Full | Full | Full |
| Pre-commit hooks | Husky (frontend only) | Husky | pre-commit | None |

## File Paths Reference

### CI/CD
- `.github/workflows/ws-backend-test.yml` — Backend build, lint, unit test
- `.github/workflows/ws-controller-test.yml` — Controller build, lint, unit test, E2E
- `.github/workflows/ws-frontend-test.yml` — Frontend build, lint, type-check, unit test, Cypress
- `.github/workflows/ws-e2e-test.yml` — Full-stack E2E (placeholder)
- `.github/workflows/ws-build-image.yml` — Reusable multi-arch image build
- `.github/workflows/ws-publish.yml` — Image publish on push
- `.github/workflows/semantic-prs.yaml` — Semantic PR title enforcement
- `.github/workflows/gh-workflow-approve.yaml` — Auto-approve for org members
- `.tekton/odh-workbenches-controller-pull-request.yaml` — Konflux PR pipeline
- `.tekton/odh-workbenches-controller-push.yaml` — Konflux push pipeline

### Testing
- `workspaces/backend/api/*_test.go` — Backend API handler tests (14 files)
- `workspaces/controller/internal/controller/*_test.go` — Controller tests
- `workspaces/controller/internal/webhook/*_test.go` — Webhook validation tests
- `workspaces/controller/test/e2e/` — Controller E2E tests (Ginkgo)
- `workspaces/frontend/src/**/__tests__/*.spec.tsx` — Frontend Jest unit tests (35 files)
- `workspaces/frontend/src/__tests__/cypress/cypress/tests/mocked/` — Cypress tests (21 files)
- `testing/Makefile` — Full-stack E2E infrastructure
- `testing/kind-1-35.yaml` — Kind cluster config

### Build
- `workspaces/backend/Dockerfile` — Backend multi-stage build (distroless)
- `workspaces/controller/Dockerfile` — Controller multi-stage build (distroless)
- `workspaces/frontend/Dockerfile` — Frontend multi-stage build (nginx:alpine)
- `workspaces/controller/Makefile` — Controller build/test/deploy targets
- `workspaces/backend/Makefile` — Backend build/test/deploy targets

### Static Analysis
- `workspaces/controller/.golangci.yml` — Controller linting config (~30 linters)
- `workspaces/backend/.golangci.yml` — Backend linting config (~30 linters)
- `workspaces/frontend/.eslintrc.js` — Frontend ESLint config (50+ rules)
- `workspaces/frontend/tsconfig.json` — TypeScript strict mode config
- `workspaces/frontend/.husky/pre-commit` — Husky pre-commit lint hook

### Coverage
- `workspaces/frontend/jest.config.js` — Jest coverage config (coverageDirectory: 'jest-coverage')
- `workspaces/frontend/.nycrc.json` — NYC/Istanbul config for Cypress coverage
- `workspaces/frontend/package.json` — `test:coverage:merge` script
