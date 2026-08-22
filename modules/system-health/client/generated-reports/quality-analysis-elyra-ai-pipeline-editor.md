---
repository: "elyra-ai/pipeline-editor"
overall_score: 4.9
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Good test coverage with Jest and React Testing Library; 22 test files for 51 source files (43% ratio)"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "Cypress present but minimal — only 1 integration test scenario; Storybook-based test runner"
  - dimension: "Build Integration"
    score: 2.0
    status: "No Docker image builds, no Konflux simulation, no manifest validation in CI"
  - dimension: "Image Testing"
    score: 0.0
    status: "No Dockerfile, no container image builds, no runtime validation"
  - dimension: "Coverage Tracking"
    score: 5.0
    status: "Codecov integration exists but no coverage thresholds enforced; uses outdated codecov-action v1"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "Single workflow with lint, test, coverage, and integration jobs; missing concurrency control, timeouts, and matrix testing"
  - dimension: "Static Analysis"
    score: 5.0
    status: "ESLint configured with multiple plugins; Prettier with husky pre-commit hooks; no Dependabot or Renovate; strict TypeScript"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory; no AI agent test creation guidance"
critical_gaps:
  - title: "No container image or Dockerfile"
    impact: "Library is consumed as an npm package but downstream consumers (elyra, odh) build images — no validation at source"
    severity: "MEDIUM"
    effort: "N/A (library repo)"
  - title: "Cypress E2E suite has only 1 test scenario"
    impact: "Integration testing provides almost no regression protection for the visual pipeline editor"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No coverage thresholds enforced"
    impact: "Coverage can silently regress without anyone noticing; no gate prevents merging low-coverage PRs"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No Dependabot or Renovate for dependency alerts"
    impact: "Vulnerable or outdated dependencies go unnoticed; manual dependency updates only"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No concurrency control or timeout in CI workflow"
    impact: "Redundant workflow runs waste resources; stuck jobs can block the queue indefinitely"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "Codecov action uses deprecated v1"
    impact: "May stop working at any time; v1 has known security issues and is no longer maintained"
    severity: "HIGH"
    effort: "1 hour"
quick_wins:
  - title: "Add .github/dependabot.yml for npm ecosystem"
    effort: "1-2 hours"
    impact: "Automated dependency update PRs and security alerts for npm packages"
  - title: "Upgrade codecov-action from v1 to v4 and add coverage thresholds"
    effort: "2-3 hours"
    impact: "Secure, maintained coverage reporting with threshold enforcement to prevent regressions"
  - title: "Add concurrency control and timeouts to CI workflow"
    effort: "1 hour"
    impact: "Cancel redundant runs on same PR; prevent stuck jobs from blocking CI"
  - title: "Create basic CLAUDE.md with testing conventions"
    effort: "2-3 hours"
    impact: "AI-assisted contributions follow existing patterns (Jest, Testing Library, Cypress)"
recommendations:
  priority_0:
    - "Upgrade codecov/codecov-action from v1 to v4 — v1 is deprecated and has known security vulnerabilities"
    - "Add coverage thresholds in jest.config.js (coverageThreshold) to prevent coverage regression"
    - "Add .github/dependabot.yml with npm ecosystem configuration for automated security alerts"
  priority_1:
    - "Expand Cypress E2E suite — currently only 1 test (no-toolbar scenario); add tests for node creation, pipeline validation, drag-and-drop, properties panel interactions"
    - "Add concurrency control (concurrency: group/cancel-in-progress) and timeout-minutes to all CI jobs"
    - "Add pre-commit-config.yaml to formalize hook enforcement beyond husky (which is npm-only)"
  priority_2:
    - "Create CLAUDE.md and .claude/rules/ with test creation patterns for Jest, React Testing Library, and Cypress"
    - "Add Storybook visual regression tests alongside functional Cypress tests"
    - "Consider adding accessibility testing (jest-axe or cypress-axe) for the pipeline editor UI"
---

# Quality Analysis: elyra-ai/pipeline-editor

## Executive Summary
- **Overall Score: 4.9/10**
- **Repository Type**: TypeScript monorepo (React component library)
- **Primary Language**: TypeScript
- **Framework**: React + Lerna monorepo
- **RHOAI Component**: Notebooks Extensions (RHOAIENG)
- **Tier**: Upstream

**Key Strengths**: Solid unit test foundation with Jest and React Testing Library; well-configured ESLint with multiple plugins; strict TypeScript configuration; husky pre-commit hooks with lint-staged.

**Critical Gaps**: Minimal Cypress E2E coverage (1 test), no coverage thresholds, deprecated codecov-action v1, no dependency update automation (Dependabot/Renovate), no container image testing (library repo), no AI agent rules.

**Agent Rules Status**: Missing — No CLAUDE.md, AGENTS.md, or .claude/ directory.

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 7.0/10 | Good coverage with Jest + Testing Library |
| Integration/E2E | 20% | 3.0/10 | Cypress exists but only 1 test scenario |
| Build Integration | 15% | 2.0/10 | No image builds or manifest validation |
| Image Testing | 10% | 0.0/10 | No Dockerfile — library consumed as npm package |
| Coverage Tracking | 10% | 5.0/10 | Codecov present but no thresholds; deprecated action |
| CI/CD Automation | 15% | 5.0/10 | Functional but lacks concurrency/timeouts/matrix |
| Static Analysis | 10% | 5.0/10 | ESLint good; no Dependabot/Renovate |
| Agent Rules | 5% | 0.0/10 | No AI agent rules or test guidance |

**Overall: 4.9/10** (weighted average)

## Critical Gaps

### 1. Cypress E2E Suite Has Only 1 Test Scenario
- **Impact**: The visual pipeline editor is a complex drag-and-drop UI, yet integration testing covers only a single "no toolbar" scenario. Regressions in core features (node creation, pipeline validation, property editing, link management) go undetected.
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **File**: `cypress/integration/no-toolbar.ts`

### 2. No Coverage Thresholds Enforced
- **Impact**: While `jest --coverage` runs in CI and uploads to Codecov, there are no `coverageThreshold` settings in `jest.config.js`. Coverage can silently regress without blocking PRs.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Files**: `jest.config.js`, `jest.config.base.js`

### 3. Codecov Action Uses Deprecated v1
- **Impact**: `codecov/codecov-action@v1` is no longer maintained and has known security vulnerabilities. It may stop functioning without warning.
- **Severity**: HIGH
- **Effort**: 1 hour
- **File**: `.github/workflows/build.yaml:98`

### 4. No Dependency Update Automation
- **Impact**: No `dependabot.yml` or Renovate configuration. Vulnerable or outdated dependencies (e.g., `cypress@^9.2.1`, Storybook `^6.4.9`) require manual tracking and updating.
- **Severity**: HIGH
- **Effort**: 1-2 hours

### 5. No Concurrency Control or Timeouts in CI
- **Impact**: Pushing multiple commits to a PR triggers redundant workflows that all run to completion. No `timeout-minutes` means a stuck job blocks the queue indefinitely.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **File**: `.github/workflows/build.yaml`

## Quick Wins

### 1. Add `.github/dependabot.yml` (1-2 hours)
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 2. Upgrade Codecov Action and Add Thresholds (2-3 hours)
```yaml
# In .github/workflows/build.yaml
- name: Upload coverage report
  uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    fail_ci_if_error: true
```

Add to `jest.config.js`:
```javascript
coverageThreshold: {
  global: {
    branches: 60,
    functions: 60,
    lines: 60,
    statements: 60,
  },
},
```

### 3. Add Concurrency Control and Timeouts (1 hour)
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    timeout-minutes: 15
    # ...
```

### 4. Create Basic CLAUDE.md (2-3 hours)
Create `CLAUDE.md` with testing patterns:
- Jest unit testing conventions
- React Testing Library patterns used
- Cypress integration test structure
- Build/lint commands

## Detailed Findings

### Unit Tests
- **Framework**: Jest 29 with ts-jest preset
- **UI Testing**: React Testing Library (`@testing-library/react` v13, `@testing-library/jest-dom`)
- **Test Files**: 22 test files across 2 packages
  - `pipeline-editor`: 10 test files (component tests with render, screen, waitFor)
  - `pipeline-services`: 12 test files (validation and migration logic)
- **Source Files**: 51 TypeScript source files
- **Test-to-Code Ratio**: 43% (22/51) — good for a component library
- **Test Lines**: ~5,310 lines of tests vs ~11,688 lines of source (45% ratio)
- **Test Patterns**: Proper use of custom test-utils (`render`, `screen`, `samplePipeline`, `createPalette`), mock setup in `jest.setup.js`
- **Environments**: jsdom for component tests, node for service tests
- **Strengths**: Tests cover rendering, error handling, imperative handles, validation logic, migration paths (v1-v8)
- **Gaps**: No `beforeEach` reset patterns visible; some components lack test files (errors/, IconButton/, CustomFormControls/)

### Integration/E2E Tests
- **Framework**: Cypress 9.2.1 (outdated — current is v13+)
- **Test Runner**: Storybook-based (`start-server-and-test` with Storybook CI mode on port 6006)
- **Test Count**: 1 integration test file with 1 test case
- **Test File**: `cypress/integration/no-toolbar.ts` — tests only "renders empty pipeline message"
- **Configuration**: `cypress.json` with baseUrl `http://localhost:6006`, video disabled
- **Testing Library Integration**: `@testing-library/cypress` installed for `cy.findByText`
- **Critical Gap**: Only 1 E2E test for a complex visual pipeline editor. No tests for:
  - Node creation/deletion
  - Pipeline validation
  - Drag-and-drop interactions
  - Properties panel editing
  - Link creation between nodes
  - Toolbar actions
  - Error states

### Build Integration
- **CI Build**: `yarn build` runs in test and test-coverage jobs (Lerna builds both packages)
- **Build Tool**: `microbundle` for pipeline-editor (CJS bundle), `tsc` for pipeline-services
- **No Docker Builds**: This is a library consumed as an npm package — no container image is built in CI
- **No Manifest Validation**: Not applicable for a library repo
- **No Konflux Integration**: No PR-time build simulation
- **Monorepo Build**: Lerna orchestrates cross-package builds; both packages must build together

### Image Testing
- **No Dockerfiles**: Repository has no Dockerfile or Containerfile
- **No Container Images**: Library is consumed via npm, not as a container image
- **Context**: Downstream consumers (elyra, odh-dashboard) build images that include this library — validation happens there, not here
- **Score Rationale**: 0/10 because no image testing exists; however, for a pure library repo, this dimension has reduced relevance

### Coverage Tracking
- **Coverage Generation**: `jest --coverage` configured in `package.json` (`yarn test:cover`)
- **Coverage Reporters**: `lcov` and `text` configured in `jest.config.js`
- **Collection Scope**: All `.ts/.tsx` files excluding index, declarations, test-utils, and test files
- **Upload**: `codecov/codecov-action@v1` in CI (deprecated)
- **Thresholds**: NONE — no `coverageThreshold` in jest config
- **PR Reporting**: Codecov uploads but no `fail_ci_if_error` flag
- **No `.codecov.yml`**: No Codecov configuration file for project-level settings

### CI/CD Automation
- **Workflows**: 1 workflow (`build.yaml`) — "Validate"
- **Triggers**: `push` and `pull_request` (both branches)
- **Jobs**: 4 jobs
  1. `prepare-yarn-cache` — installs dependencies and caches `node_modules` + Cypress cache
  2. `lint` — ESLint + Prettier format check
  3. `test-coverage` — build + jest coverage + codecov upload
  4. `test` — build + jest tests
  5. `test-integration` — build + Cypress (Storybook-based)
- **Caching**: Yarn cache with `hashFiles('**/yarn.lock')` — good strategy
- **Node Version**: 22 (set via env variable)
- **Package Manager**: Yarn 3.5.0 (via corepack)
- **Missing**: No `concurrency:` control, no `timeout-minutes:`, no matrix testing (single Node version), no scheduled/periodic runs

### Static Analysis

#### Linting
- **ESLint**: Configured via `.eslintrc.js` at root level
- **Extensions**: react-app, jest/recommended, jest/style, testing-library/react, jest-dom/recommended
- **Plugins**: import, header (license enforcement)
- **Rules**: Import ordering with alphabetization, no-extraneous-dependencies, newline-after-import
- **Overrides**: Cypress files, stories, webpack configs, test files have tailored rules
- **Max Warnings**: `--max-warnings=0` enforced (strict)
- **TypeScript**: `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser`

#### Formatter
- **Prettier**: Configured (`.prettierrc` with empty config = defaults)
- **Lint-Staged**: Prettier runs on pre-commit via husky for `tsx,ts,js,md,css,html,json`

#### TypeScript Strictness
- `strict: true` in `tsconfig.base.json`
- `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization` all enabled
- `noImplicitReturns`, `noFallthroughCasesInSwitch` enabled
- `forceConsistentCasingInFileNames`, `isolatedModules` enabled

#### FIPS Compatibility
- No non-FIPS crypto imports found in source code
- No FIPS build tags needed (TypeScript/React library, not a Go service)
- No Dockerfile base images to evaluate

#### Dependency Alerts
- **Dependabot**: NOT configured — no `.github/dependabot.yml`
- **Renovate**: NOT configured — no `renovate.json` or `.renovaterc`
- **Impact**: Dependencies are significantly outdated (Cypress 9, Storybook 6, eslint 7)

### Agent Rules
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **Test Creation Rules**: None
- **Impact**: AI agents contributing to this repo have no guidance on testing patterns, build conventions, or quality expectations
- **Recommendation**: Generate missing rules with `/test-rules-generator`

## Recommendations

### Priority 0 (Critical)
1. **Upgrade `codecov/codecov-action` from v1 to v4** — v1 is deprecated, unmaintained, and has known security vulnerabilities. Add `token` secret and `fail_ci_if_error: true`.
2. **Add coverage thresholds** — Add `coverageThreshold` to `jest.config.js` to prevent silent coverage regression. Start with 60% across all metrics and ratchet up.
3. **Add `.github/dependabot.yml`** — Configure for npm and github-actions ecosystems. Dependencies are significantly outdated (Cypress 9, Storybook 6, ESLint 7).

### Priority 1 (High Value)
4. **Expand Cypress E2E test suite** — Add tests for node CRUD, link management, pipeline validation errors, properties panel, toolbar actions, and keyboard navigation. Current single test provides almost no regression protection.
5. **Add concurrency control and timeouts** — Prevent redundant CI runs and stuck jobs.
6. **Upgrade outdated dependencies** — Cypress 9→13, Storybook 6→8, ESLint 7→9 (flat config). Many of these have breaking changes but also security fixes and performance improvements.

### Priority 2 (Nice-to-Have)
7. **Create CLAUDE.md and .claude/rules/** — Document testing patterns (Jest, React Testing Library, Cypress), build commands, and contribution guidelines for AI agents.
8. **Add visual regression testing** — Use Storybook's built-in visual testing or Chromatic for the pipeline editor components.
9. **Add accessibility testing** — `jest-axe` for unit tests, `cypress-axe` for E2E, since this is a complex interactive UI.
10. **Add `.codecov.yml`** — Configure project-level coverage settings, PR comment format, and coverage target.

## Comparison to Gold Standards

| Dimension | pipeline-editor | odh-dashboard | notebooks | kserve |
|-----------|----------------|---------------|-----------|--------|
| Unit Tests | 7.0 — Good ratio, Testing Library | 9.0 — Comprehensive, mocks | 6.0 — Image-focused | 8.0 — Go testing, table-driven |
| Integration/E2E | 3.0 — 1 Cypress test | 9.0 — Cypress + contract | 7.0 — Multi-layer | 9.0 — envtest + E2E |
| Build Integration | 2.0 — Lerna build only | 8.0 — Multi-mode builds | 8.0 — Image validation | 7.0 — Operator testing |
| Image Testing | 0.0 — No containers | 7.0 — Multi-stage | 10.0 — 5-layer validation | 7.0 — Runtime tests |
| Coverage Tracking | 5.0 — Codecov, no thresholds | 8.0 — Enforced thresholds | 5.0 — Basic | 9.0 — Strict enforcement |
| CI/CD Automation | 5.0 — Single workflow | 9.0 — Comprehensive | 8.0 — Multi-workflow | 9.0 — Matrix + caching |
| Static Analysis | 5.0 — ESLint, no Dependabot | 8.0 — Full toolchain | 6.0 — Basic linting | 8.0 — golangci-lint + FIPS |
| Agent Rules | 0.0 — None | 8.0 — Comprehensive | 3.0 — Minimal | 5.0 — Basic |

## File Paths Reference

| Category | File Path |
|----------|-----------|
| CI Workflow | `.github/workflows/build.yaml` |
| Jest Config (root) | `jest.config.js`, `jest.config.base.js` |
| Jest Config (editor) | `packages/pipeline-editor/jest.config.js` |
| Jest Config (services) | `packages/pipeline-services/jest.config.js` |
| ESLint Config | `.eslintrc.js` |
| TypeScript Config | `tsconfig.base.json` |
| Cypress Config | `cypress.json` |
| Cypress Tests | `cypress/integration/no-toolbar.ts` |
| Package Config | `package.json` |
| Lerna Config | `lerna.json` |
| Makefile | `Makefile` |
| Prettier Config | `.prettierrc` |
| Test Setup | `packages/pipeline-editor/jest.setup.js` |
| Test Utilities | `packages/pipeline-editor/src/test-utils.tsx` |
