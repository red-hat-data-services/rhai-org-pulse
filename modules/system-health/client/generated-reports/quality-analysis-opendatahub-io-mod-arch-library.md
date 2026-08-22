---
repository: "opendatahub-io/mod-arch-library"
overall_score: 4.9
scorecard:
  - dimension: "Unit Tests"
    score: 5.0
    status: "Jest + Go testing present with good patterns documented; low test-to-source ratio (~10%)"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "Cypress infrastructure exists but only 1 actual E2E test; not wired into CI"
  - dimension: "Build Integration"
    score: 5.0
    status: "PR builds TS packages; no container image build or K8s manifest validation at PR time"
  - dimension: "Image Testing"
    score: 4.0
    status: "Good Dockerfile practices (multi-stage, non-root, multi-arch) but no runtime testing; non-UBI base images"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "CI generates coverage for core/shared but no tracking, thresholds, or PR reporting"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "Well-organized workflows with PR build/test, semantic release, npm caching; missing concurrency control"
  - dimension: "Static Analysis"
    score: 6.0
    status: "Strong ESLint + golangci-lint + husky hooks; no Dependabot/Renovate or FIPS configuration"
  - dimension: "Agent Rules"
    score: 8.0
    status: "Comprehensive AGENTS.md with testing guidelines, package-specific rules, and .claude/rules; missing dedicated test creation rules"
critical_gaps:
  - title: "Minimal E2E test coverage — only 1 Cypress test exists"
    impact: "UI regressions and cross-component integration issues go undetected until manual testing or production"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No coverage tracking or enforcement"
    impact: "No visibility into test coverage trends; coverage can silently decline as new code is added"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Non-UBI base images in Dockerfile (node:22, golang, distroless)"
    impact: "Not FIPS-compatible; may fail Red Hat certification and downstream Konflux builds"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No PR-time container image build validation"
    impact: "Dockerfile breakage discovered only after merge, blocking releases"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No dependency update automation (Dependabot/Renovate)"
    impact: "Vulnerable or outdated dependencies remain unpatched; manual tracking required"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add Codecov integration with coverage thresholds"
    effort: "3-4 hours"
    impact: "Instant visibility into coverage trends and PR-level coverage reporting with gates"
  - title: "Enable Dependabot for npm and Go module ecosystems"
    effort: "1-2 hours"
    impact: "Automated security and dependency update PRs with zero ongoing maintenance"
  - title: "Add concurrency control to CI workflows"
    effort: "30 minutes"
    impact: "Prevents redundant CI runs on rapid push sequences, saves CI minutes"
  - title: "Wire Cypress tests into CI test workflow"
    effort: "2-3 hours"
    impact: "Existing Cypress infrastructure and 1 test begin running on PRs immediately"
recommendations:
  priority_0:
    - "Expand unit test coverage across all packages — target 30%+ test-to-source ratio"
    - "Add Codecov integration with minimum 50% coverage threshold, blocking PR merges below threshold"
    - "Switch Dockerfile base images to UBI (registry.access.redhat.com/ubi9) for FIPS compatibility"
  priority_1:
    - "Expand Cypress E2E tests to cover core user flows (navigation, component rendering, form interactions)"
    - "Add PR-time Docker image build step to CI workflow to catch build failures before merge"
    - "Add .claude/rules/ test creation rules for unit tests, Cypress tests, and Go tests"
  priority_2:
    - "Add timeout-minutes to all CI workflow jobs to prevent stuck builds"
    - "Add contract tests between frontend and BFF API boundaries"
    - "Add a Go coverage step to CI for the BFF package"
---

# Quality Analysis: mod-arch-library

## Executive Summary

- **Overall Score: 4.9/10**
- **Repository Type**: TypeScript/React monorepo (npm workspaces) with Go BFF starter template
- **Jira Component**: AI Core Dashboard (RHOAIENG, midstream tier)
- **Primary Languages**: TypeScript/React (libraries), Go (BFF)
- **Key Strengths**: Well-organized CI/CD with semantic release, comprehensive agent rules (AGENTS.md + package-specific rules), strong linting configuration with husky hooks, good Dockerfile practices (multi-stage, non-root, multi-arch)
- **Critical Gaps**: Very low E2E coverage (1 test), no coverage tracking/enforcement, non-UBI base images, no dependency update automation
- **Agent Rules Status**: Present and comprehensive — AGENTS.md at root + package-specific AGENTS.md + .claude/rules/ for theming; missing dedicated test creation rules

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 5.0/10 | 15% | 0.75 | Jest + Go testing with patterns documented; ~10% test-to-source ratio |
| Integration/E2E | 3.0/10 | 20% | 0.60 | Cypress infrastructure but only 1 test; not in CI |
| Build Integration | 5.0/10 | 15% | 0.75 | PR builds TS packages; no image build or manifest validation |
| Image Testing | 4.0/10 | 10% | 0.40 | Multi-stage, non-root, multi-arch; no runtime tests; non-UBI |
| Coverage Tracking | 3.0/10 | 10% | 0.30 | CI generates but doesn't track, threshold, or report |
| CI/CD Automation | 7.0/10 | 15% | 1.05 | Good workflows + semantic release; missing concurrency |
| Static Analysis | 6.0/10 | 10% | 0.60 | ESLint + golangci-lint + husky; no Dependabot or FIPS |
| Agent Rules | 8.0/10 | 5% | 0.40 | Excellent AGENTS.md coverage; missing test creation rules |
| **Overall** | **4.9/10** | **100%** | **4.85** | |

## Critical Gaps

### 1. Minimal E2E Test Coverage
- **Impact**: UI regressions and cross-component integration issues go undetected until manual testing or production
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: The Cypress infrastructure is well-configured (`cypress.config.ts` with coverage, JUnit reporting, video recording) but only 1 actual test exists (`navBar.cy.ts`). The starter template provides page objects and support commands but almost no test scenarios. Cypress is also not wired into the CI workflow, so even the existing test doesn't run on PRs.

### 2. No Coverage Tracking or Enforcement
- **Impact**: No visibility into coverage trends; coverage can silently decline as new code is added
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The CI workflow runs `npm run test:jest -- --coverage` for `mod-arch-core` and `mod-arch-shared`, but the results are not uploaded to any tracking service (no Codecov/Coveralls config). No coverage thresholds are defined in Jest configs. Go tests in the BFF have no coverage flags in CI at all.

### 3. Non-UBI Base Images in Dockerfile
- **Impact**: Not FIPS-compatible; may fail Red Hat certification and downstream Konflux builds
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The starter Dockerfile uses `node:22`, `golang:1.24.3`, and `gcr.io/distroless/static:nonroot` base images. For Red Hat downstream builds, these should be UBI-based images (`registry.access.redhat.com/ubi9`). No FIPS build tags (`-tags=fips`, `GOEXPERIMENT=boringcrypto`) are configured. `CGO_ENABLED=0` is set which precludes BoringCrypto linkage.

### 4. No PR-Time Container Image Build
- **Impact**: Dockerfile breakage discovered only after merge, blocking releases
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: The CI test workflow builds TypeScript packages but does not build the Docker image. Dockerfile issues (broken COPY paths, dependency failures, Go build errors in container context) are only caught when building images outside of the PR workflow.

### 5. No Dependency Update Automation
- **Impact**: Vulnerable or outdated dependencies remain unpatched; manual tracking required
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: No `.github/dependabot.yml` or `renovate.json` configured. The monorepo has npm, Go modules, and GitHub Actions dependencies that should all be covered by automated update tooling.

## Quick Wins

### 1. Enable Dependabot for Automated Dependency Updates
- **Effort**: 1-2 hours
- **Impact**: Automated security and dependency update PRs
- **Implementation**:
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      dev-dependencies:
        dependency-type: "development"
  - package-ecosystem: "gomod"
    directory: "/mod-arch-starter/bff"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 2. Add Concurrency Control to CI Workflows
- **Effort**: 30 minutes
- **Impact**: Prevents redundant CI runs on rapid pushes
- **Implementation**:
```yaml
# Add to .github/workflows/test.yml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

### 3. Add Codecov Integration
- **Effort**: 3-4 hours
- **Impact**: PR-level coverage reporting with trend tracking
- **Implementation**:
```yaml
# .codecov.yml
coverage:
  status:
    project:
      default:
        target: 50%
        threshold: 5%
    patch:
      default:
        target: 60%

# Add to test-coverage job in .github/workflows/test.yml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    flags: unit-tests
```

### 4. Wire Cypress into CI
- **Effort**: 2-3 hours
- **Impact**: Existing E2E test runs on every PR
- **Implementation**: Add a Cypress job to `test.yml` that builds the frontend, starts a mock BFF, and runs Cypress in headless mode against it.

## Detailed Findings

### Unit Tests

**Score: 5.0/10**

**TypeScript/React Tests (library packages)**:
- 17 test files across `mod-arch-core` (8 tests), `mod-arch-shared` (6 tests), `mod-arch-starter` (2 tests), `mod-arch-installer` (1 test)
- Framework: Jest with `ts-jest`, `jest-environment-jsdom`, React Testing Library
- Test patterns: `__tests__/` directories, `.test.tsx` and `.spec.ts` naming
- Good jest.config.js setup with `clearMocks`, `moduleNameMapper` for assets/styles, coverage directories
- ~198 TS/TSX source files vs ~17 test files = **~8.6% test-to-source ratio** (low)

**Go Tests (BFF starter)**:
- 10 Go test files totaling ~1,575 lines
- Tests cover: SSRF protection, WebSocket proxy, TLS, BFF client factory/errors/config, API helpers
- Uses `envtest` for Kubernetes API testing (ENVTEST_K8S_VERSION = 1.29.0)
- golangci-lint v2 for static analysis
- ~52 Go source files vs ~10 test files = **~19.2% test-to-source ratio** (moderate)

**Gaps**:
- No tests for most components in `mod-arch-shared/components/` (SimpleSelect, TypeaheadSelect, TruncatedText, etc.)
- No tests for `mod-arch-kubeflow` package (0 tests despite having context, hooks, utilities)
- No tests for `mod-arch-core/api/` modules beyond errorUtils
- No coverage thresholds in any jest.config.js

### Integration/E2E Tests

**Score: 3.0/10**

**Cypress Infrastructure** (mod-arch-starter):
- Well-configured `cypress.config.ts` with:
  - `@cypress/code-coverage` integration
  - JUnit reporter with merge support
  - Video recording with smart cleanup (only keep on failure)
  - High resolution support
  - Custom webpack preprocessor
  - Mock vs E2E spec pattern switching via `CY_MOCK` env var
- Page objects: `navBar.ts`, `appChrome.ts`, `pageNotFound.ts`, component pages (table, Modal, Notification, Contextual)
- Support commands: API, application, axe (accessibility)
- **Only 1 actual test file**: `navBar.cy.ts` (mocked/kubeflowStandalone)

**Kind Cluster Deployment** (mod-arch-starter):
- `deploy_kind_cluster.sh` script for local K8s deployment
- Uses kustomize overlays for deployment
- Not integrated into CI

**Gaps**:
- Cypress tests are NOT run in CI workflow (no Cypress job in `test.yml`)
- Only 1 test scenario across all Cypress tests
- No E2E tests against real API endpoints
- No multi-version K8s testing
- No integration tests between frontend and BFF
- The `mod-arch-installer` flavor has duplicate Cypress structure but also only 1 test

### Build Integration

**Score: 5.0/10**

**PR Workflow Builds**:
- CI builds all 4 npm workspace packages on every PR (`npm run build`)
- Runs linting and tests after build
- Matrix strategy tests individual packages (core, shared, kubeflow)
- npm caching with `cache: 'npm'`

**Container Image Build** (starter, not in CI):
- Multi-stage Dockerfile: `ui-builder` (Node), `bff-builder` (Go), final (distroless)
- Build args: `DEPLOYMENT_MODE`, `STYLE_THEME`
- Makefile targets: `docker-build`, `docker-build-standalone`, `docker-build-federated`
- `docker-buildx` targets for multi-platform builds

**Gaps**:
- No Docker image build step in PR CI workflow
- No Konflux build simulation
- No `kustomize build` validation in CI
- No `kubectl apply --dry-run` in CI
- Build mode variants (kubeflow, standalone, federated) not tested in CI
- `verify-dist.mjs` runs in release/publish but not in the PR test workflow

### Image Testing

**Score: 4.0/10**

**Dockerfile Best Practices**:
- Multi-stage build (3 stages: ui-builder, bff-builder, final)
- Distroless final image (`gcr.io/distroless/static:nonroot`)
- Non-root user (65532:65532)
- Multi-architecture support via `TARGETOS`/`TARGETARCH` build args
- Port 8080 exposed

**Gaps**:
- No `HEALTHCHECK` instruction in Dockerfile
- No runtime validation tests (no testcontainers, no smoke tests)
- No docker-compose test configuration
- Base images are NOT UBI-based:
  - `node:22` (Debian-based)
  - `golang:1.24.3` (Debian-based)
  - `gcr.io/distroless/static:nonroot` (not UBI)
- No readiness/liveness probe definitions in K8s manifests examined

### Coverage Tracking

**Score: 3.0/10**

**What Exists**:
- CI runs `npm run test:jest -- --coverage` for `mod-arch-core` and `mod-arch-shared` in a dedicated `test-coverage` job
- All Jest configs define `coverageDirectory: 'jest-coverage'` and `collectCoverageFrom` patterns
- Cypress config includes `@cypress/code-coverage` plugin

**Gaps**:
- No `.codecov.yml` or `codecov.yml`
- No Coveralls integration
- No coverage upload step in CI
- No `coverageThreshold` in any Jest config
- No coverage gate blocking PRs below threshold
- No Go test coverage in CI (`go test` without `-coverprofile`)
- Coverage is generated but discarded — no artifact upload or reporting

### CI/CD Automation

**Score: 7.0/10**

**Workflow Inventory**:
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | PR + push to main | Build, lint, test, coverage |
| `release.yml` | push to main | Semantic release + npm publish |
| `publish.yml` | workflow_dispatch | Manual publish with version input |

**Strengths**:
- PR title linting with `action-semantic-pull-request` (conventional commits enforcement)
- Matrix strategy for per-package testing (core, shared, kubeflow)
- npm caching enabled across all workflows
- Semantic Release with conventional commits analyzer, automated changelog, GitHub releases
- Manual publish workflow with per-package granularity
- Build verification script (`verify-dist.mjs`) in release/publish paths
- Husky + lint-staged pre-commit hooks for local quality gates
- OIDC trusted publishing for npm (provenance attestation)

**Gaps**:
- No `concurrency` control — rapid pushes can trigger redundant parallel runs
- No `timeout-minutes` on any job — stuck jobs run indefinitely
- No Cypress/E2E job in any workflow
- No Docker image build test in PR workflow
- No caching for Go modules (BFF)
- release.yml runs tests before release but doesn't gate on separate test workflow

### Static Analysis

**Score: 6.0/10**

**Linting (TypeScript)**:
- ESLint configured in all 3 library packages (`mod-arch-core`, `mod-arch-shared`, `mod-arch-kubeflow`)
- Comprehensive rule set:
  - `@typescript-eslint/recommended`
  - `plugin:jsx-a11y/recommended` (accessibility)
  - `plugin:react/recommended`
  - `plugin:prettier/recommended`
  - `no-only-tests/no-only-tests: "error"` (prevents accidental test exclusion)
  - `import/order` with grouped imports
  - `no-relative-import-paths` enforcement
- ESLint max-warnings 0 enforcement
- TypeScript type checking (`tsc --noEmit`) in test suites

**Linting (Go)**:
- golangci-lint v2 configured in `mod-arch-starter/bff/.golangci.yaml`
- Preset exclusions: comments, common-false-positives, legacy, std-error-handling

**Pre-commit Hooks**:
- Husky v9 + lint-staged
- Pre-commit runs `npx lint-staged`
- lint-staged runs ESLint (max-warnings 0) on staged `.js/.ts/.jsx/.tsx` files

**FIPS Compatibility**:
- No FIPS build tags (`-tags=fips`, `GOEXPERIMENT=boringcrypto`) found
- `CGO_ENABLED=0` in Dockerfile precludes BoringCrypto
- No UBI base images (uses node:22, golang, distroless)
- No crypto-related FIPS violations found (no crypto/md5, crypto/des, etc.)

**Dependency Alerts**:
- **No `.github/dependabot.yml`** — npm, Go, and GitHub Actions dependencies are not automatically monitored
- **No `renovate.json`** — no alternative dependency update tool configured

### Agent Rules

**Score: 8.0/10**

**Root-Level Rules**:
- `CLAUDE.md` — delegates to AGENTS.md
- `AGENTS.md` — comprehensive 250+ line guide covering:
  - Repository overview and structure table
  - Development requirements (Node 22+, npm 10+)
  - Coding standards (naming, TypeScript rules, import patterns)
  - Testing guidelines with commands, patterns, and what-to-test guidance
  - Commit message format (conventional commits)
  - PR process guidelines

**Package-Specific Rules**:
- `mod-arch-kubeflow/AGENTS.md` — detailed theming/styling rules with form-field wrapper tables, MUI theme integration patterns, PatternFly token priority order
- `mod-arch-kubeflow/.claude/rules/` — 3 rule files (patternfly-design-tokens.md, scss-architecture.md, workflow.md)
- `mod-arch-starter/AGENTS.md` — mandatory contract-first development flow, project structure, deployment modes
- `.claude/rules/jira-creation.md` — comprehensive Jira issue creation rules with field mapping, formatting guidelines, and appendices for severity/priority/labels

**Cursor Integration**:
- `.cursor/skills/review/SKILL.md` — sophisticated design token & convention review skill with 10 checks

**Gaps**:
- No dedicated test creation rules in `.claude/rules/` (e.g., `unit-tests.md`, `e2e-tests.md`, `go-tests.md`)
- Testing guidelines in AGENTS.md are high-level (test patterns, commands) but don't include:
  - Coverage requirements or targets
  - Cypress E2E test writing patterns
  - Go test patterns (table-driven tests, mocking with envtest)
  - When to use mocked vs real API tests
- No rule requiring test additions with feature PRs

## Recommendations

### Priority 0 (Critical)

1. **Expand unit test coverage across all packages** — Target 30%+ test-to-source ratio. Focus on:
   - `mod-arch-shared/components/` (SimpleSelect, TypeaheadSelect, TruncatedText, ToolbarFilter, etc.)
   - `mod-arch-kubeflow/` (0 tests currently — context, hooks, utilities all untested)
   - `mod-arch-core/api/` modules beyond errorUtils

2. **Add Codecov integration with coverage thresholds** — Upload coverage from CI, set project target at 50%, patch target at 60%. Add `.codecov.yml` configuration and `codecov-action` to the test-coverage job.

3. **Switch Dockerfile base images to UBI** — Replace `node:22` with `registry.access.redhat.com/ubi9/nodejs-22`, `golang:1.24.3` with UBI Go builder, and distroless with UBI minimal. Enable FIPS build tags for Go binary.

### Priority 1 (High Value)

4. **Expand Cypress E2E tests** — Write tests for core user flows: navigation across deployment modes (kubeflow, standalone, federated), form interactions with theme-aware components, page rendering and routing. Target 10+ test scenarios covering major pages.

5. **Wire Cypress into CI** — Add a job to `test.yml` that installs, builds, starts a mock BFF, and runs Cypress in headless mode. Start with mocked tests, add E2E later.

6. **Add PR-time Docker image build** — Add a job that builds the Docker image (without pushing) to catch Dockerfile breakage before merge. Test at least one deployment mode variant.

7. **Add dedicated test creation rules** — Create `.claude/rules/unit-tests.md`, `.claude/rules/cypress-tests.md`, and `.claude/rules/go-tests.md` with patterns, coverage requirements, and checklists.

### Priority 2 (Nice-to-Have)

8. **Add `timeout-minutes` to all CI jobs** — Prevent stuck jobs from consuming CI minutes indefinitely. Suggest 15 minutes for test jobs, 10 for builds.

9. **Add contract tests for BFF API** — Validate that the Go BFF API responses match the OpenAPI spec in `api/openapi/mod-arch.yaml`. Could use `go-swagger` or `oapi-codegen` for schema validation.

10. **Add Go coverage to CI** — Run `go test -coverprofile=cover.out ./...` in the BFF Makefile test target and upload to Codecov with a separate flag.

11. **Add `verify-dist.mjs` to PR test workflow** — Currently only runs in release/publish workflows. Running it on PRs would catch build output issues earlier.

## Comparison to Gold Standards

| Practice | mod-arch-library | odh-dashboard | notebooks | kserve |
|----------|-----------------|---------------|-----------|--------|
| Unit test ratio | ~10% | ~40% | ~25% | ~35% |
| E2E tests | 1 Cypress test | 200+ Cypress tests | Selenium suites | E2E with KinD |
| Coverage tracking | Generated, not tracked | Codecov with thresholds | CI coverage | Codecov enforced |
| Coverage thresholds | None | Yes (project + patch) | Yes | Yes |
| PR image build | No | Yes | Yes | Yes |
| Dependency alerts | None | Dependabot | Dependabot | Dependabot |
| FIPS compliance | No (non-UBI images) | Partial | UBI images | UBI images |
| Agent rules | Excellent (AGENTS.md + .claude/rules/) | Good (CLAUDE.md) | Minimal | None |
| Pre-commit hooks | Husky + lint-staged | Husky + lint-staged | Pre-commit | Pre-commit |
| Semantic release | Yes (conventional commits) | No | No | No |
| Multi-arch images | Yes (buildx) | Yes | Yes | Yes |

## File Paths Reference

### CI/CD
- `.github/workflows/test.yml` — PR test workflow (build, lint, test, coverage)
- `.github/workflows/release.yml` — Semantic release on main push
- `.github/workflows/publish.yml` — Manual publish workflow
- `.releaserc.json` — Semantic release configuration
- `.husky/pre-commit` — Pre-commit hook (lint-staged)

### Testing
- `mod-arch-core/jest.config.js` — Core package Jest config
- `mod-arch-shared/jest.config.js` — Shared package Jest config
- `mod-arch-kubeflow/jest.config.js` — Kubeflow package Jest config
- `mod-arch-starter/frontend/jest.config.js` — Starter frontend Jest config
- `mod-arch-starter/frontend/src/__tests__/cypress/cypress.config.ts` — Cypress config
- `mod-arch-starter/bff/Makefile` — BFF test targets (Go tests with envtest)

### Static Analysis
- `mod-arch-shared/.eslintrc.cjs` — Shared ESLint config
- `mod-arch-kubeflow/.eslintrc.cjs` — Kubeflow ESLint config
- `mod-arch-core/.eslintrc.cjs` — Core ESLint config
- `mod-arch-starter/frontend/eslint.config.mjs` — Starter frontend ESLint config
- `mod-arch-starter/bff/.golangci.yaml` — Go linter config

### Container Images
- `mod-arch-starter/Dockerfile` — Multi-stage Dockerfile (Node + Go + distroless)
- `mod-arch-starter/Makefile` — Docker build targets
- `mod-arch-starter/scripts/deploy_kind_cluster.sh` — Kind cluster deployment

### Agent Rules
- `CLAUDE.md` — Root CLAUDE.md (delegates to AGENTS.md)
- `AGENTS.md` — Root comprehensive agent rules
- `mod-arch-kubeflow/AGENTS.md` — Kubeflow theming/styling rules
- `mod-arch-starter/AGENTS.md` — Starter template development flow
- `.claude/rules/jira-creation.md` — Jira issue creation guidelines
- `.cursor/skills/review/SKILL.md` — Design token review skill

### Coverage (Not Configured)
- No `.codecov.yml`
- No `.github/dependabot.yml`
- No `renovate.json`
