---
repository: "elyra-ai/pipeline-editor"
overall_score: 4.8
scorecard:
  - dimension: "Unit Tests"
    score: 6.5
    status: "Decent Jest test suite (190 cases) with Testing Library, but 12 source files lack any tests and no coverage thresholds enforced"
  - dimension: "Integration/E2E"
    score: 2.5
    status: "Cypress configured but only 1 trivial E2E test; no real user-flow coverage"
  - dimension: "Build Integration"
    score: 1.0
    status: "No container builds, no Konflux simulation, no image validation — library only"
  - dimension: "Image Testing"
    score: 0.0
    status: "No Dockerfile or container image testing — published as npm package only"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "Codecov upload exists in CI but no thresholds, no PR gates, no enforcement"
  - dimension: "CI/CD Automation"
    score: 5.5
    status: "Single workflow covers lint/test/cypress/coverage with caching, but no concurrency control, outdated actions, no release automation"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules or test automation guidance"
critical_gaps:
  - title: "Cypress E2E suite is effectively empty"
    impact: "No user-flow regression testing — UI regressions ship undetected"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No coverage enforcement or thresholds"
    impact: "Coverage can silently regress; no PR gate prevents untested code from merging"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "12 source modules have zero test coverage"
    impact: "CustomFormControls (7 files) and all pipeline-services validators (5 files) are entirely untested"
    severity: "HIGH"
    effort: "12-20 hours"
  - title: "No security scanning of any kind"
    impact: "No dependency vulnerability detection, no SAST, no secret scanning — vulnerabilities ship silently"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Outdated codecov-action@v1 and legacy Husky configuration"
    impact: "codecov-action@v1 is deprecated and may stop working; Husky v4-style config in package.json is ignored by newer Husky versions"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add coverage thresholds to Jest config"
    effort: "1 hour"
    impact: "Prevent coverage regression on every PR"
  - title: "Add Dependabot or Renovate for dependency updates"
    effort: "1 hour"
    impact: "Automated security patches and dependency freshness"
  - title: "Add CodeQL or Trivy scanning workflow"
    effort: "1-2 hours"
    impact: "Catch known vulnerabilities in dependencies before they ship"
  - title: "Upgrade codecov-action from v1 to v4"
    effort: "30 minutes"
    impact: "Fix deprecated action before it breaks, get PR coverage comments"
  - title: "Add concurrency control to CI workflow"
    effort: "30 minutes"
    impact: "Cancel redundant workflow runs, save CI minutes"
recommendations:
  priority_0:
    - "Add Jest coverage thresholds (global and per-package) to prevent regression"
    - "Add security scanning — at minimum CodeQL for SAST and npm audit/Dependabot for dependency vulnerabilities"
    - "Write unit tests for all 5 untested validators in pipeline-services"
  priority_1:
    - "Build out Cypress E2E suite with real user-flow tests (drag-drop, node editing, validation, export)"
    - "Write tests for CustomFormControls components (7 untested files)"
    - "Upgrade from Husky v4 to v9 with modern .husky/ directory hooks"
    - "Add accessibility testing (axe-core integration) given JSX a11y plugin is already configured"
  priority_2:
    - "Create agent rules (.claude/rules/) for test creation patterns"
    - "Add visual regression testing for the pipeline editor canvas"
    - "Add release automation workflow (changelog, npm publish)"
    - "Add concurrency groups and workflow_dispatch to CI"
---

# Quality Analysis: elyra-ai/pipeline-editor

## Executive Summary

- **Overall Score: 4.8/10**
- **Repository Type**: TypeScript/React monorepo (Lerna) — visual pipeline editor library
- **Packages**: `@elyra/pipeline-editor` (React UI) + `@elyra/pipeline-services` (validation/migration logic)
- **Primary Language**: TypeScript (100%)
- **Last Activity**: May 28, 2026 (dependency bump)
- **Agent Rules Status**: Missing — no CLAUDE.md, no `.claude/` directory

**Key Strengths:**
- Solid unit test suite for core logic (190 test cases across 22 files)
- Testing Library + Jest DOM for React component testing (modern approach)
- Codecov integration exists in CI
- Strict TypeScript configuration (all strict flags enabled)
- Comprehensive ESLint setup with import ordering, license headers, and JSX-a11y
- Pre-commit hooks configured via Husky + lint-staged (Prettier formatting)

**Critical Gaps:**
- Cypress E2E suite has only 1 trivial test — effectively no UI regression coverage
- 12 source modules (24% of codebase) have zero test coverage
- No coverage thresholds — coverage can regress silently
- Zero security scanning (no SAST, no dependency scanning, no secret detection)
- No container/image testing (library-only, but downstream consumers affected)
- No agent rules for AI-assisted development

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.5/10 | 190 test cases, 43% test-to-code ratio by lines, but 12 modules untested |
| Integration/E2E | 2.5/10 | Cypress configured but only 1 trivial test exists |
| Build Integration | 1.0/10 | No container builds or integration validation |
| Image Testing | 0.0/10 | No Dockerfile — library published via npm only |
| Coverage Tracking | 4.0/10 | Codecov upload exists but no thresholds or PR gates |
| CI/CD Automation | 5.5/10 | Single workflow covers basics but has gaps |
| Agent Rules | 0.0/10 | No agent rules or test automation guidance |

## Critical Gaps

### 1. Cypress E2E Suite Is Effectively Empty
- **Severity**: HIGH
- **Impact**: No user-flow regression testing — the visual pipeline editor's drag-and-drop, node editing, property panels, validation feedback, and export flows are all untested at the integration level
- **Current State**: Only 1 Cypress test exists (`no-toolbar.ts`) that checks if an empty pipeline message renders — a smoke test at best
- **Effort**: 16-24 hours to build meaningful coverage
- **Evidence**: `cypress/integration/no-toolbar.ts` — the only integration test file

### 2. No Coverage Enforcement or Thresholds
- **Severity**: HIGH
- **Impact**: Coverage can silently regress with every PR; no gate prevents untested code from merging
- **Current State**: `jest.config.js` configures `collectCoverageFrom` and `coverageReporters: ["lcov", "text"]` but has no `coverageThreshold` setting; Codecov uploads results but has no `.codecov.yml` configuration for PR checks
- **Effort**: 2-4 hours

### 3. 12 Source Modules Have Zero Test Coverage
- **Severity**: HIGH
- **Impact**: Critical UI components and all validation logic formatters are untested
- **Untested Files**:
  - `packages/pipeline-editor/src/CustomFormControls/` — 7 files (CustomArray, CustomFieldTemplate, CustomOneOf, ErrorMessage, FileWidget, components, index)
  - `packages/pipeline-editor/src/IconButton/index.tsx`
  - `packages/pipeline-services/src/validation/validators/` — 5 files (enum-validators, nested-enum-validators, number-validators, string-array-validators, string-validators)
- **Effort**: 12-20 hours

### 4. Zero Security Scanning
- **Severity**: HIGH
- **Impact**: No automated detection of known vulnerabilities in 400+ npm dependencies, no SAST for code patterns, no secret detection
- **Current State**: No CodeQL, no Trivy, no Snyk, no npm audit in CI, no Dependabot/Renovate, no `.gitleaks.toml`, no `SECURITY.md`
- **Effort**: 2-4 hours for basic setup

### 5. Outdated CI Dependencies
- **Severity**: MEDIUM
- **Impact**: `codecov/codecov-action@v1` is deprecated (current is v4); Husky v4-style config in `package.json` is ignored by newer Husky versions (no `.husky/` directory exists)
- **Effort**: 1-2 hours

## Quick Wins

### 1. Add Coverage Thresholds (1 hour)
Add `coverageThreshold` to `jest.config.js`:
```javascript
module.exports = {
  // ...existing config...
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 65,
      statements: 65,
    },
  },
};
```

### 2. Add Dependabot (1 hour)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 3. Add CodeQL Scanning (1-2 hours)
Create `.github/workflows/codeql.yml`:
```yaml
name: "CodeQL"
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: "0 6 * * 1"
jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript
      - uses: github/codeql-action/analyze@v3
```

### 4. Upgrade codecov-action (30 minutes)
Change `codecov/codecov-action@v1` to `codecov/codecov-action@v4` and add a token.

### 5. Add Concurrency Control (30 minutes)
Add to `build.yaml`:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

## Detailed Findings

### CI/CD Pipeline

**Workflow**: Single `build.yaml` triggered on all push and PR events.

**Jobs** (5 total):
1. `prepare-yarn-cache` — Installs dependencies and caches `node_modules` + Cypress binary
2. `lint` — Runs ESLint + Prettier format check
3. `test` — Builds all packages, runs Jest
4. `test-coverage` — Builds, runs Jest with `--coverage`, uploads to Codecov
5. `test-integration` — Builds, runs Cypress E2E via Storybook

**Strengths**:
- Yarn cache shared across jobs via `actions/cache@v4`
- Separate lint/test/coverage/integration jobs
- Node 22 (current LTS)
- `FORCE_COLOR: true` for readable CI logs

**Weaknesses**:
- No concurrency control — redundant runs on rapid pushes
- `codecov/codecov-action@v1` is deprecated (3 major versions behind)
- `test` and `test-coverage` jobs are redundant — tests run twice
- No matrix testing across Node versions
- No release/publish workflow
- No branch protection or required status checks visible
- `--frozen-lockfile` commented out in install step
- `--openssl-legacy-provider` flag in Cypress job suggests outdated dependency issues

### Test Coverage

**Framework**: Jest + ts-jest + Testing Library (React) + jest-dom

**Test Distribution**:
- `pipeline-editor` package: 10 test files, 122 test cases
- `pipeline-services` package: 12 test files, 68 test cases
- Cypress E2E: 1 test file, 1 test case
- **Total**: 22 unit test files, 190 test cases

**Test-to-Code Ratio**: 5,310 test lines / 12,338 source lines = **43%** (adequate for a UI library)

**Well-Tested Areas**:
- `PipelineController` (55 tests) — core pipeline manipulation logic
- `NodeTooltip/utils` (27 tests) — tooltip rendering logic
- `migration/` (all 8 versions tested) — data migration paths
- `validation/` (23 tests) — pipeline validation core

**Untested Areas**:
- `CustomFormControls/` (7 files, 0 tests) — form rendering components
- `validation/validators/` (5 files, 0 tests) — individual validation rules
- `IconButton` (0 tests) — UI component
- `properties-panels/NodeProperties.tsx`, `PipelineProperties.tsx`, `PropertiesPanel.tsx` — complex panels partially tested through `properties-panels/index.test.tsx`

### Code Quality

**ESLint Configuration** (Strong):
- Extends: `react-app`, `plugin:jest/recommended`, `plugin:jest/style`, `plugin:testing-library/react`, `plugin:jest-dom/recommended`
- Plugins: `import` (ordering), `header` (license enforcement), `jsx-a11y` (via react-app)
- Import ordering rules with alphabetization
- Separate overrides for cypress, stories, and test files

**TypeScript** (Strong):
- `strict: true` with all strict sub-options enabled
- `noImplicitReturns`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`
- `isolatedModules: true` for compatibility

**Pre-commit Hooks** (Weak):
- Husky + lint-staged configured in `package.json` (v4 style)
- Only runs Prettier formatting — no lint or test checks
- No `.husky/` directory exists (modern Husky v5+ requires it)
- Hooks likely non-functional with current Husky versions

**Formatting**:
- Prettier configured (`.prettierrc` exists but is empty `{}` — uses all defaults)
- `format:check` runs in CI

### Container Images

- **No Dockerfile or Containerfile exists**
- Published as npm packages (`@elyra/pipeline-editor`, `@elyra/pipeline-services`)
- No container-level testing applicable
- Consumed downstream by Elyra (JupyterLab extension) which has its own container builds

### Security

- **No security scanning of any kind**
- No CodeQL/SAST
- No dependency scanning (Dependabot/Renovate/Snyk)
- No secret detection (Gitleaks/TruffleHog)
- No `SECURITY.md` policy
- No npm audit in CI pipeline
- `eslint-plugin-jsx-a11y` provides some accessibility checking (via `react-app` config)

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory exists
- **Quality**: N/A
- **Gaps**: No test automation guidance, no coding standards for AI agents, no test creation rules
- **Recommendation**: Generate rules with `/test-rules-generator` to establish:
  - Unit test patterns (Jest + Testing Library conventions)
  - Component test patterns (React component testing approach)
  - Validation test patterns (pipeline-services test structure)
  - Migration test patterns (version-by-version migration testing)

## Recommendations

### Priority 0 (Critical)

1. **Add Jest coverage thresholds** — Set global minimums (60% branches, 65% lines) and fail CI when coverage regresses. Start conservative and ratchet up.

2. **Add security scanning** — At minimum: CodeQL for SAST, `npm audit` in CI, and Dependabot for automated dependency updates. The repo has 400+ npm dependencies with zero vulnerability monitoring.

3. **Write tests for pipeline-services validators** — The 5 validator files (`enum-validators.ts`, `nested-enum-validators.ts`, `number-validators.ts`, `string-array-validators.ts`, `string-validators.ts`) are pure logic with no tests. These are the easiest wins for coverage improvement.

### Priority 1 (High Value)

4. **Build real Cypress E2E tests** — The pipeline editor's core value is its visual interface. Cover: creating/deleting nodes, drag-drop connections, property panel editing, validation error display, pipeline export/import. Use Storybook stories as test fixtures.

5. **Write tests for CustomFormControls** — 7 untested React components. Use existing Testing Library patterns from `properties-panels/index.test.tsx` as a template.

6. **Upgrade Husky to v9** — Current v4-style `package.json` hooks are non-functional with modern Husky. Create `.husky/pre-commit` with lint-staged invocation.

7. **Add accessibility testing** — `eslint-plugin-jsx-a11y` is already in the lint chain. Add `@axe-core/react` or `jest-axe` for runtime a11y assertions in component tests.

### Priority 2 (Nice-to-Have)

8. **Create agent rules** — Add `.claude/rules/` with test creation patterns for Jest, Testing Library, and Cypress conventions specific to this project.

9. **Add visual regression testing** — Consider Chromatic (integrates with existing Storybook) or Percy for catching unintended UI changes to the pipeline canvas.

10. **Add release automation** — Create a workflow for automated npm publishing with changelog generation (e.g., Changesets or semantic-release).

11. **Deduplicate test/test-coverage CI jobs** — The `test` and `test-coverage` jobs run the same tests; merge them into one job that always generates coverage.

12. **Add concurrency control** — Prevent redundant CI runs on rapid pushes to the same branch.

## Comparison to Gold Standards

| Dimension | pipeline-editor | odh-dashboard | notebooks | kserve |
|-----------|----------------|---------------|-----------|--------|
| Unit Tests | 6.5 — 190 cases, gaps in forms/validators | 9.0 — Comprehensive with coverage enforcement | 7.0 — Python-focused | 8.5 — Go testing with coverage gates |
| Integration/E2E | 2.5 — 1 trivial Cypress test | 9.5 — Multi-layer Cypress + contract tests | 6.0 — Notebook-level integration | 9.0 — Multi-version E2E |
| Build Integration | 1.0 — No image builds | 8.0 — PR-time build validation | 9.0 — Multi-arch image builds | 7.0 — Operator manifests |
| Image Testing | 0.0 — N/A (library) | 7.0 — Image startup checks | 9.5 — 5-layer validation | 7.0 — Deployment testing |
| Coverage Tracking | 4.0 — Upload only, no gates | 8.5 — Codecov with enforcement | 5.0 — Basic tracking | 8.0 — Thresholds enforced |
| CI/CD Automation | 5.5 — Basic but functional | 9.0 — Comprehensive with concurrency | 8.0 — Well-organized | 8.5 — Multi-env testing |
| Agent Rules | 0.0 — None | 8.0 — Comprehensive rules | 3.0 — Minimal | 2.0 — Basic |
| **Overall** | **4.8** | **8.7** | **7.1** | **7.4** |

### Key Takeaways from Gold Standard Comparison

1. **vs. odh-dashboard**: The most relevant comparison (both TypeScript/React). odh-dashboard demonstrates what good looks like for this type of project: multi-layer testing (unit → component → integration → E2E → contract), coverage enforcement, comprehensive agent rules, and well-organized CI with concurrency control.

2. **vs. notebooks/kserve**: Less directly comparable (different tech stacks), but their security scanning and coverage enforcement practices are universally applicable.

3. **Biggest gap**: The E2E testing dimension. For a visual editor component, UI-level testing is arguably more important than for a backend service, yet pipeline-editor has the weakest E2E coverage of any compared project.

## File Paths Reference

### CI/CD
- `.github/workflows/build.yaml` — Single CI workflow (lint, test, coverage, cypress)
- `.github/PULL_REQUEST_TEMPLATE` — PR template with DCO certification

### Testing
- `jest.config.js` — Root Jest config (multi-project)
- `jest.config.base.js` — Shared Jest base config (ts-jest, node env)
- `packages/pipeline-editor/jest.config.js` — UI package config (jsdom env, Testing Library)
- `packages/pipeline-services/jest.config.js` — Services package config
- `cypress.json` — Cypress config (baseUrl: localhost:6006)
- `cypress/integration/no-toolbar.ts` — Only E2E test

### Code Quality
- `.eslintrc.js` — ESLint config (react-app + jest + testing-library + jest-dom)
- `tsconfig.base.json` — TypeScript strict config
- `.prettierrc` — Prettier config (empty = defaults)
- `package.json` — Husky v4 + lint-staged config

### Build
- `lerna.json` — Lerna monorepo config (v1.13.0, yarn)
- `packages/pipeline-editor/package.json` — UI package (microbundle)
- `packages/pipeline-services/package.json` — Services package (tsc)

### Storybook
- `.storybook/` — Storybook configuration
- `stories/` — Story files (used as Cypress test fixtures)
