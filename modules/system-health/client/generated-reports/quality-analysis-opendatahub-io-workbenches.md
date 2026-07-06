---
repository: "opendatahub-io/workbenches"
overall_score: 6.9
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Good Go + Jest unit test coverage across all three components"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "Controller E2E with Kind; Cypress mocked E2E for frontend; full-stack E2E scaffolded but not yet implemented"
  - dimension: "Build Integration"
    score: 5.0
    status: "Multi-arch image builds on PR but no Konflux simulation; Tekton only covers controller"
  - dimension: "Image Testing"
    score: 5.5
    status: "Multi-stage distroless builds with multi-arch support; no runtime validation or startup testing"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "Coverage files generated locally (cover.out, nyc) but no codecov integration or PR enforcement"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "Well-structured per-component workflows with path filtering, concurrency control, and artifact uploads"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude directory, no agent rules for test automation"
critical_gaps:
  - title: "No coverage tracking or enforcement on PRs"
    impact: "Coverage can silently degrade — no visibility into coverage trends or regressions"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No security scanning (Trivy, CodeQL, SAST)"
    impact: "Vulnerability and code quality issues not detected before merge"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Full-stack E2E tests not implemented"
    impact: "testing/Makefile local-e2e target is a no-op TODO — no end-to-end validation across controller+backend+frontend"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "Tekton/Konflux only covers controller image"
    impact: "Backend and frontend images have no Konflux pipeline — production build drift for 2 of 3 components"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "No container runtime validation"
    impact: "Images built on PR are not tested for startup, health checks, or functional correctness"
    severity: "MEDIUM"
    effort: "8-12 hours"
quick_wins:
  - title: "Add Codecov integration to Go and frontend test workflows"
    effort: "2-4 hours"
    impact: "Immediate PR-level coverage visibility and trend tracking"
  - title: "Add Trivy container scanning to ws-build-image.yml"
    effort: "1-2 hours"
    impact: "Catch CVEs in base images and dependencies before merge"
  - title: "Add CodeQL / gosec SAST workflow"
    effort: "2-3 hours"
    impact: "Static analysis for security vulnerabilities in Go and TypeScript code"
  - title: "Create basic CLAUDE.md and agent test rules"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality and consistency for contributors"
  - title: "Add Tekton pipelines for backend and frontend components"
    effort: "2-4 hours"
    impact: "Consistent Konflux build coverage across all three components"
recommendations:
  priority_0:
    - "Add Codecov/Coveralls integration with minimum coverage thresholds on PRs"
    - "Add container vulnerability scanning (Trivy) to the reusable ws-build-image.yml workflow"
    - "Add SAST scanning (CodeQL for Go + TypeScript) as a PR workflow"
  priority_1:
    - "Implement full-stack E2E tests in testing/ directory (currently a TODO placeholder)"
    - "Add container runtime validation — startup probe, health check, basic HTTP smoke test"
    - "Create Tekton/Konflux pipelines for backend and frontend components (currently only controller)"
    - "Add dependency scanning (Dependabot or Renovate) for Go modules and npm packages"
  priority_2:
    - "Create CLAUDE.md and .claude/rules/ with test automation guidance for AI agents"
    - "Add pre-commit hooks for Go formatting/vetting (currently only frontend has Husky hooks)"
    - "Add secret detection (Gitleaks) workflow"
    - "Add accessibility testing enforcement in Cypress (axe-core commands exist but no CI enforcement)"
---

# Quality Analysis: opendatahub-io/workbenches

## Executive Summary

- **Overall Score: 6.9/10**
- **Repository Type**: Kubernetes operator monorepo (Go controller + Go backend API + TypeScript/React frontend)
- **Primary Languages**: Go (controller, backend), TypeScript/React (frontend)
- **Framework**: Kubeflow Workspaces — Kubernetes controller with REST API and PatternFly 6 UI

### Key Strengths
- **Well-structured monorepo CI/CD**: Per-component workflows with smart path-based triggers avoid unnecessary builds
- **Multi-layer testing**: Unit tests (envtest for Go, Jest for TS), Cypress mocked E2E, controller Kind-based E2E
- **Strong linting**: 25+ golangci-lint rules per Go component; comprehensive ESLint with TypeScript strict mode, accessibility, spell-checking, and custom local rules
- **Multi-architecture builds**: All three images built for `linux/amd64`, `linux/ppc64le`, `linux/arm64/v8`
- **Semantic PR enforcement**: PR title validation with conventional commit types
- **Developer tooling**: Tiltfile for local development with hot-reload, Husky pre-commit hooks for frontend

### Critical Gaps
- **No coverage tracking or enforcement** — `cover.out` generated but never uploaded or gated
- **No security scanning** — no Trivy, CodeQL, gosec, Snyk, or Gitleaks
- **Full-stack E2E is a TODO** — `make local-e2e` prints "no e2e tests yet"
- **Tekton/Konflux gap** — only controller has Tekton pipelines; backend and frontend are missing

### Agent Rules Status: **Missing**
- No `CLAUDE.md`, no `.claude/` directory, no test automation rules for AI agents

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | Good coverage: 15 backend test files, 10 controller test files, 35 frontend spec files |
| Integration/E2E | 7.0/10 | Controller E2E via Kind; Cypress mocked E2E; full-stack E2E not yet implemented |
| **Build Integration** | **5.0/10** | **Multi-arch PR image builds but no Konflux sim; Tekton only for controller** |
| Image Testing | 5.5/10 | Multi-stage distroless/nginx builds; no runtime validation or startup testing |
| Coverage Tracking | 4.0/10 | Local coverage generation only; no CI integration, no thresholds, no PR reporting |
| CI/CD Automation | 8.0/10 | 7 well-organized workflows with path filtering, concurrency control, artifact uploads |
| Agent Rules | 0.0/10 | No agent rules, no test automation guidance |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: Coverage can silently degrade with no visibility into trends or regressions
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Both Go components generate `cover.out` via `go test -coverprofile`, and the frontend has `.nycrc.json` for Istanbul coverage, but none are uploaded to Codecov/Coveralls or enforced on PRs. The frontend even has `test:coverage` and `test:coverage:merge` scripts combining Jest + Cypress coverage, but these aren't run in CI.

### 2. No Security Scanning
- **Impact**: CVEs in base images, dependency vulnerabilities, and code-level security issues go undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Trivy scanning on container images, no CodeQL/gosec SAST analysis, no dependency vulnerability scanning (Dependabot/Renovate), no secret detection (Gitleaks). The distroless base images help reduce attack surface, but there's no automated verification.

### 3. Full-Stack E2E Tests Not Implemented
- **Impact**: No end-to-end validation across controller + backend + frontend in a realistic environment
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: The `testing/Makefile` has a `local-e2e` target that prints "TODO: there are no e2e tests yet, they will be defined in Cypress..." The infrastructure is in place (Kind cluster setup, cert-manager, Istio, all-component deployment, sanity check), but the actual E2E test suite is not written.

### 4. Tekton/Konflux Only Covers Controller
- **Impact**: Backend and frontend images have no Konflux pipeline — production build divergence risk
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: Only `.tekton/odh-workbenches-controller-{push,pull-request}.yaml` exist. Backend and frontend components lack Tekton PipelineRuns, meaning their Konflux builds may diverge from GitHub Actions builds.

### 5. No Container Runtime Validation
- **Impact**: Built images never verified for startup, health, or basic functionality
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Details**: The `ws-build-image.yml` reusable workflow builds multi-arch images but doesn't test them. No `docker run` health check, no Testcontainers validation, no Kind deployment smoke test after image build.

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
- **Impact**: Immediate PR-level coverage visibility and trend tracking
- **Implementation**: Add `codecov/codecov-action` to backend and controller test jobs (upload `cover.out`), and to frontend test job (upload Jest + Cypress coverage). Add `.codecov.yml` with minimum thresholds.

### 2. Add Trivy Container Scanning (1-2 hours)
- **Impact**: Catch CVEs in base images and dependencies before merge
- **Implementation**: Add `aquasecurity/trivy-action` step to `ws-build-image.yml` after the build step.

### 3. Add CodeQL SAST Workflow (2-3 hours)
- **Impact**: Static analysis for security vulnerabilities across Go and TypeScript
- **Implementation**: Add a `.github/workflows/codeql.yml` workflow with Go and JavaScript language analysis.

### 4. Create Agent Test Rules (2-3 hours)
- **Impact**: Better AI-generated test quality for contributors using Claude Code or similar tools
- **Implementation**: Create `CLAUDE.md` and `.claude/rules/` with test patterns for Go envtest, Jest, and Cypress.

### 5. Add Backend/Frontend Tekton Pipelines (2-4 hours)
- **Impact**: Consistent Konflux build coverage across all components
- **Implementation**: Copy and adapt the controller Tekton PipelineRun files for backend and frontend.

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory** (7 workflows + 1 OWNERS):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ws-backend-test.yml` | PR (paths: backend, controller) + push | Build, lint, image build, unit tests |
| `ws-controller-test.yml` | PR (paths: controller, backend) + push | Build, lint, image build, unit tests, E2E |
| `ws-frontend-test.yml` | PR (paths: frontend) + push | Build, lint, test (Jest + Cypress), image build |
| `ws-e2e-test.yml` | PR (paths: workspaces/**) + push | Kind cluster setup, deploy all, sanity check, E2E (TODO) |
| `ws-build-image.yml` | Reusable (workflow_call) | Multi-arch image build with metadata tags |
| `ws-publish.yml` | Push to main/v*-branch | Publish all 3 images with semver + SHA tags |
| `semantic-prs.yaml` | PR (open/edit/sync) | Conventional commit PR title validation |
| `gh-workflow-approve.yaml` | PR (labeled/sync) | Auto-approve workflows for org members |

**Strengths**:
- Smart path-based filtering — backend changes trigger backend + controller tests (due to dependency)
- Reusable `ws-build-image.yml` workflow avoids duplication across components
- Concurrency control with `cancel-in-progress: true` on all workflows
- Porcelain check — detects uncommitted file changes after code generation steps
- All actions pinned to specific commit SHAs (supply chain security)

**Gaps**:
- No coverage upload or enforcement step in any test workflow
- No security scanning workflow
- `ws-e2e-test.yml` runs but the actual E2E tests are not implemented (TODO)

### Test Coverage

#### Backend (Go)
- **15 test files** / 69 source files (22% test-to-source ratio)
- **Framework**: Go testing + envtest (Kubernetes API server mock)
- **Pattern**: Suite-based tests (`suite_test.go` with Ginkgo/Gomega), handler-level unit tests
- **Coverage**: `go test -coverprofile cover.out` — generated but not uploaded
- **Key test files**: Handler tests for workspaces, workspace kinds, secrets, PVCs, namespaces, storage classes, health check

#### Controller (Go)
- **10 test files** / 21 source files (48% test-to-source ratio — excellent)
- **Framework**: Go testing + envtest + Ginkgo/Gomega
- **Unit tests**: Controller and webhook tests with envtest
- **E2E tests**: Full Kind-based E2E in `test/e2e/e2e_test.go` (408 lines) — tests CRD deployment, workspace lifecycle, pod creation, service routing, connectivity
- **Coverage**: `go test -coverprofile cover.out` — generated but not uploaded

#### Frontend (TypeScript/React)
- **35 unit test files** (`.spec.ts/.spec.tsx` in `__tests__` dirs)
- **~10 Cypress test files** (mocked E2E in `cypress/tests/mocked/`)
- **164 source files** (21% test-to-source ratio for unit tests)
- **Frameworks**: Jest (unit), Cypress (component/E2E with mocks)
- **Coverage infrastructure**: `.nycrc.json` for Istanbul/nyc, `jest.config.js` with `coverageDirectory`, `test:coverage:merge` script to combine Jest + Cypress — but never run in CI
- **Page Object pattern**: Cypress tests use page objects (`cypress/pages/`)
- **Accessibility**: axe-core commands exist (`commands/axe.ts`) but not enforced in CI

### Code Quality

#### Linting
- **Backend Go**: `.golangci.yml` with 25 linters enabled (asciicheck, bodyclose, dupl, errcheck, errorlint, exhaustive, ginkgolinter, goconst, gocritic, gocyclo, gofmt, goheader, goimports, gosec, govet, and more). Excellent configuration with test-specific exclusions.
- **Controller Go**: Identical golangci-lint setup with 25 linters
- **Frontend TS**: Comprehensive `.eslintrc.js` with TypeScript strict rules, React hooks enforcement, import ordering, accessibility (jsx-a11y), spelling (@cspell), Prettier integration, custom local rules (`no-react-hook-namespace`, `no-raw-react-router-hook`), and Cypress-specific overrides. One of the most thorough ESLint configs I've seen.

#### Pre-commit Hooks
- **Frontend only**: Husky pre-commit hook runs `npm run test:lint` when `workspaces/frontend/` files are staged
- **Backend/Controller**: No pre-commit hooks — linting only runs in CI

#### Static Analysis
- **No SAST tools** (CodeQL, gosec standalone, Semgrep)
- **No dependency scanning** (Dependabot, Renovate)
- **No secret detection** (Gitleaks, TruffleHog)

### Container Images

#### Build Process
- **Backend**: Multi-stage Go build → `gcr.io/distroless/static:nonroot` (minimal attack surface)
- **Controller**: Multi-stage Go build → `gcr.io/distroless/static:nonroot`
- **Frontend**: Multi-stage Node 20 build → nginx:alpine with envsubst
- **Multi-arch**: All three built for `linux/amd64`, `linux/ppc64le`, `linux/arm64/v8`
- **Non-root**: All images run as non-root users (UID 65532 for Go, UID 101 for nginx)

#### Runtime Testing
- **None**: No image startup validation, no health check testing, no functional smoke tests
- **No Trivy/Snyk scanning**: No vulnerability scanning on built images

#### Tekton/Konflux
- **Controller only**: PipelineRuns for pull-request and push events, using `odh-konflux-central` multi-arch build pipeline
- **Backend/Frontend**: No Tekton pipelines — Konflux gap

### Security

| Practice | Status |
|----------|--------|
| Container scanning (Trivy/Snyk) | ❌ Not configured |
| SAST (CodeQL/gosec) | ❌ Not configured |
| Dependency scanning | ❌ Not configured |
| Secret detection | ❌ Not configured |
| Action SHA pinning | ✅ All actions pinned to commit SHAs |
| Non-root containers | ✅ All images run as non-root |
| Distroless base images | ✅ Go components use distroless |
| `.dockerignore` | ✅ Present at root and workspaces level |
| Semantic PR validation | ✅ Enforced conventional commits |

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `CLAUDE.md`, no `.claude/` directory, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: 
  - No test creation rules for any framework (Go envtest, Jest, Cypress)
  - No coding conventions documented for AI agents
  - No quality gates or checklists for AI-generated contributions
- **Recommendation**: Generate comprehensive rules with `/test-rules-generator` covering:
  - Go unit tests with envtest patterns
  - Jest unit tests for React hooks and components
  - Cypress E2E tests with page object pattern
  - Ginkgo/Gomega test patterns for controller tests

### Developer Experience

**Strengths**:
- **Tiltfile**: Full local development setup with hot-reload for all three components
- **Kind configuration**: Pre-configured Kind cluster with cert-manager and Istio for local testing
- **Developing directory**: Separate `developing/` directory with Makefile for local iteration
- **Swagger/OpenAPI**: Auto-generated API documentation from Go annotations
- **CONTRIBUTING.md** and **DEVELOPMENT_GUIDE.md**: Clear contributor documentation

## Recommendations

### Priority 0 (Critical)

1. **Add Codecov/Coveralls integration with coverage thresholds**
   - Upload `cover.out` from backend and controller test jobs
   - Upload Jest + Cypress coverage from frontend test job
   - Set minimum coverage thresholds (e.g., 70% for new PRs)
   - Add `.codecov.yml` with patch and project coverage requirements

2. **Add container vulnerability scanning**
   - Add Trivy scan step to `ws-build-image.yml` reusable workflow
   - Set severity thresholds (fail on CRITICAL/HIGH)
   - Generate SBOM with Syft or Trivy

3. **Add SAST scanning workflow**
   - CodeQL for Go + JavaScript/TypeScript
   - Schedule weekly full scans + PR-triggered incremental scans

### Priority 1 (High Value)

4. **Implement full-stack E2E tests**
   - The infrastructure is ready (Kind setup, deploy-all, sanity-check)
   - Write Cypress tests that hit the real backend API through the frontend
   - Cover workspace CRUD, workspace kind management, and error scenarios

5. **Add container runtime validation**
   - After image build, run `docker run --rm <image> --help` or health check
   - For backend/controller: verify binary starts and responds to health endpoint
   - For frontend: verify nginx serves the index page

6. **Create Tekton/Konflux pipelines for backend and frontend**
   - Mirror the controller pipeline structure
   - Ensure consistent build process across all components

7. **Add dependency scanning**
   - Dependabot for Go modules and npm packages
   - Or Renovate for more fine-grained control

### Priority 2 (Nice-to-Have)

8. **Create agent rules for test automation**
   - `CLAUDE.md` with project overview and conventions
   - `.claude/rules/unit-tests.md` for Go and Jest patterns
   - `.claude/rules/e2e-tests.md` for Cypress and Ginkgo patterns
   - `.claude/rules/controller-tests.md` for envtest patterns

9. **Add pre-commit hooks for Go components**
   - Extend Husky or use `.pre-commit-config.yaml` for `go fmt`, `go vet`

10. **Add secret detection**
    - Gitleaks workflow for scanning commits and PRs

11. **Enforce accessibility testing**
    - The Cypress axe-core commands exist — add explicit a11y test assertions

## Comparison to Gold Standards

| Dimension | workbenches | odh-dashboard | notebooks | kserve |
|-----------|-------------|---------------|-----------|--------|
| Unit Tests | 7.5 — Good Go + Jest coverage | 9 — Comprehensive Jest + Go | 6 — Notebook-focused | 8 — Extensive Go unit tests |
| Integration/E2E | 7.0 — Controller E2E + Cypress mocked | 9 — Multi-layer Cypress | 5 — Image-based testing | 9 — Multi-version E2E |
| Build Integration | 5.0 — PR image builds, partial Tekton | 7 — Full Konflux coverage | 7 — Multi-image pipeline | 6 — Standard Tekton |
| Image Testing | 5.5 — Multi-arch builds, no runtime test | 6 — Basic image validation | 9 — 5-layer image testing | 5 — Standard image build |
| Coverage Tracking | 4.0 — Local generation only | 8 — Codecov with enforcement | 4 — No tracking | 8 — Coverage enforcement |
| CI/CD Automation | 8.0 — Well-structured, path-filtered | 9 — Comprehensive CI/CD | 7 — Solid automation | 8 — Full automation |
| Agent Rules | 0.0 — None | 8 — Comprehensive rules | 2 — Minimal | 2 — Minimal |
| **Overall** | **6.9** | **8.5** | **6.0** | **7.5** |

## File Paths Reference

### CI/CD
- `.github/workflows/ws-backend-test.yml` — Backend build + test
- `.github/workflows/ws-controller-test.yml` — Controller build + test + E2E
- `.github/workflows/ws-frontend-test.yml` — Frontend build + test (Jest + Cypress)
- `.github/workflows/ws-e2e-test.yml` — Full-stack E2E (TODO)
- `.github/workflows/ws-build-image.yml` — Reusable multi-arch image build
- `.github/workflows/ws-publish.yml` — Image publishing on merge
- `.github/workflows/semantic-prs.yaml` — PR title validation
- `.tekton/odh-workbenches-controller-pull-request.yaml` — Konflux PR pipeline
- `.tekton/odh-workbenches-controller-push.yaml` — Konflux push pipeline

### Testing
- `workspaces/backend/api/*_test.go` — Backend handler unit tests (15 files)
- `workspaces/controller/internal/controller/*_test.go` — Controller unit tests
- `workspaces/controller/internal/webhook/*_test.go` — Webhook validation tests
- `workspaces/controller/test/e2e/e2e_test.go` — Controller E2E tests (408 lines)
- `workspaces/frontend/src/__tests__/` — Jest unit tests
- `workspaces/frontend/src/__tests__/cypress/` — Cypress mocked E2E tests
- `testing/` — Full-stack E2E infrastructure (Kind + Istio + cert-manager)

### Code Quality
- `workspaces/backend/.golangci.yml` — Backend linting (25 linters)
- `workspaces/controller/.golangci.yml` — Controller linting (25 linters)
- `workspaces/frontend/.eslintrc.js` — Comprehensive ESLint config
- `workspaces/frontend/.prettierrc` — Prettier config
- `workspaces/frontend/.husky/pre-commit` — Frontend lint pre-commit hook
- `workspaces/frontend/config/cspell.json` — Spell checking config

### Container Images
- `workspaces/backend/Dockerfile` — Go multi-stage → distroless
- `workspaces/controller/Dockerfile` — Go multi-stage → distroless
- `workspaces/frontend/Dockerfile` — Node build → nginx:alpine

### Coverage
- `workspaces/backend/Makefile` (line 73) — `go test -coverprofile cover.out`
- `workspaces/controller/Makefile` (line 81) — `go test -coverprofile cover.out`
- `workspaces/frontend/.nycrc.json` — Istanbul/nyc config for Cypress coverage
- `workspaces/frontend/jest.config.js` — Jest coverage config

### Developer Tools
- `developing/Tiltfile` — Local development with hot-reload
- `developing/Makefile` — Local Kind cluster management
- `testing/Makefile` — E2E test infrastructure
