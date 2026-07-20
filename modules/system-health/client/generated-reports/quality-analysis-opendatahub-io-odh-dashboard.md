---
repository: "opendatahub-io/odh-dashboard"
overall_score: 8.5
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "1,024 test files across monorepo with Jest, shared mock factories, and 0.20 test-to-code ratio"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "756 Cypress test files, cluster failover E2E, contract tests across 8 packages, BFF Go tests"
  - dimension: "Build Integration"
    score: 9.0
    status: "5-phase Konflux simulator with hermetic build, dual-mode Docker, Kind operator integration"
  - dimension: "Image Testing"
    score: 8.0
    status: "Multi-stage UBI9 Dockerfile, runtime validation, FIPS compliance checks, multi-arch support"
  - dimension: "Coverage Tracking"
    score: 7.0
    status: "Codecov with merged unit+Cypress coverage, but enforcement is informational-only (no hard gates)"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "28+ workflows, concurrency controls, smart Cypress test selection, Tekton pipelines"
  - dimension: "Static Analysis"
    score: 8.0
    status: "Shared ESLint config package, golangci-lint, Husky pre-commit, Dependabot with grouping"
  - dimension: "Agent Rules"
    score: 10.0
    status: "Gold standard: 21 rule files (6,400+ lines), 26 skills, contract test rules, testing standards"
critical_gaps:
  - title: "Coverage enforcement is informational-only"
    impact: "PRs can merge with 0% coverage without blocking; 70% patch target not enforced"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No pre-commit-config.yaml for standardized hooks"
    impact: "Husky hooks are npm-only; Go/Python contributors bypass linting unless they run npm"
    severity: "LOW"
    effort: "2-3 hours"
  - title: "Phase 5 manifest validation not yet implemented"
    impact: "PR build validation pipeline has a gap in ConfigMap/resource manifest validation"
    severity: "LOW"
    effort: "4-6 hours"
quick_wins:
  - title: "Switch Codecov coverage from informational to enforcing"
    effort: "1-2 hours"
    impact: "Prevent regressions by blocking PRs that drop below coverage thresholds"
  - title: "Add pre-commit-config.yaml for cross-language hook enforcement"
    effort: "2-3 hours"
    impact: "Ensure Go/Python contributors also run linting and formatting checks"
  - title: "Implement Phase 5 manifest validation in PR build workflow"
    effort: "4-6 hours"
    impact: "Complete the Konflux simulator pipeline with ConfigMap and resource validation"
recommendations:
  priority_0:
    - "Enable coverage enforcement by setting informational: false in .codecov.yml for both project and patch status"
  priority_1:
    - "Implement Phase 5 manifest validation in PR Build Validation workflow"
    - "Add pre-commit-config.yaml with hooks for ESLint, golangci-lint, prettier, and markdown-lint"
    - "Expand contract tests beyond gen-ai to all BFF packages (most have only 1 test file)"
  priority_2:
    - "Add accessibility testing (axe-core) to Cypress E2E or unit test suite"
    - "Add performance regression testing for page load times and bundle sizes"
    - "Consider adding visual regression testing for PatternFly component changes"
---

# Quality Analysis: odh-dashboard

## Executive Summary

- **Overall Score: 8.5/10**
- **Repository Type**: TypeScript/React monorepo (Turborepo) with Go BFF services and Go operator
- **Primary Languages**: TypeScript (frontend/backend), Go (BFF, operator)
- **Frameworks**: React 18, PatternFly v6, Cypress, Jest, controller-runtime
- **Jira**: RHOAIENG / AI Core Dashboard (midstream tier)
- **Key Strengths**: Best-in-class Konflux build simulation, comprehensive agent rules, multi-layer testing (unit + mock + E2E + contract), sophisticated CI/CD with smart test selection
- **Critical Gaps**: Coverage enforcement is informational-only, Phase 5 manifest validation not yet implemented
- **Agent Rules Status**: Gold standard (21 rules, 26 skills, comprehensive testing guidance)

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 8/10 | 15% | 1,024 test files, Jest + shared config, 0.20 test-to-code ratio |
| Integration/E2E | 9/10 | 20% | 756 Cypress files, cluster failover E2E, contract tests, BFF tests |
| Build Integration | 9/10 | 15% | 5-phase Konflux simulator, dual-mode Docker, Kind operator integration |
| Image Testing | 8/10 | 10% | Multi-stage UBI9, runtime validation, FIPS checks, multi-arch |
| Coverage Tracking | 7/10 | 10% | Codecov with merged coverage, but informational-only enforcement |
| CI/CD Automation | 9/10 | 15% | 28+ workflows, concurrency controls, smart test selection, Tekton |
| Static Analysis | 8/10 | 10% | Shared ESLint package, golangci-lint, Husky hooks, Dependabot |
| Agent Rules | 10/10 | 5% | 21 rule files (6,400+ lines), 26 skills, all test types covered |
| **Overall** | **8.5/10** | | |

## Critical Gaps

1. **Coverage enforcement is informational-only**
   - Impact: PRs can merge even when coverage drops significantly; the 70% patch target is advisory
   - Severity: MEDIUM
   - Effort: 2-4 hours
   - Details: `.codecov.yml` sets `informational: true` for both project and patch status, meaning coverage failures appear as warnings but never block merges

2. **Phase 5 manifest validation not yet implemented**
   - Impact: ConfigMap generation and resource manifest validation are skipped in the PR build pipeline
   - Severity: LOW
   - Effort: 4-6 hours
   - Details: The PR Build Validation workflow has a comment `# Phase 5 (Manifest Validation) is not yet included`

3. **Contract tests are skeletal in most packages**
   - Impact: Only gen-ai has 2+ test files; all other BFF packages have exactly 1 contract test file
   - Severity: LOW
   - Effort: 8-12 hours
   - Details: The contract-tests framework exists in 8 packages but most have minimal coverage

## Quick Wins

1. **Switch Codecov from informational to enforcing**
   - Effort: 1-2 hours
   - Impact: Prevent coverage regressions by blocking PRs below threshold
   - Implementation: Set `informational: false` in `.codecov.yml` for patch status
   ```yaml
   coverage:
     status:
       patch:
         default:
           informational: false  # Changed from true
           target: 70%
   ```

2. **Add pre-commit-config.yaml for cross-language hooks**
   - Effort: 2-3 hours
   - Impact: Ensure Go contributors also run linting (currently only npm/Husky-based)
   - Implementation:
   ```yaml
   repos:
     - repo: https://github.com/golangci/golangci-lint
       hooks:
         - id: golangci-lint
           args: [--config, dashboard-operator/.golangci.yml]
     - repo: https://github.com/pre-commit/mirrors-prettier
       hooks:
         - id: prettier
   ```

3. **Expand contract test coverage for BFF packages**
   - Effort: 4-8 hours
   - Impact: Validate API contracts between frontend consumers and BFF providers
   - Details: Use the existing `@odh-dashboard/contract-tests` framework to add tests for automl, autorag, maas, mlflow, eval-hub, model-registry, and agent-ops BFFs

## Detailed Findings

### Unit Tests

**Score: 8/10**

- **Test file count**: 1,024 test files (`.spec.ts`, `.spec.tsx`, `.test.ts`, `.test.tsx`)
- **Source file count**: 5,100 non-test TypeScript files
- **Test-to-code ratio**: 0.20 (1 test file per 5 source files)
- **Framework**: Jest with shared `@odh-dashboard/jest-config` package
- **Test isolation**: `__tests__/` directories adjacent to source files
- **Mock data**: Shared mock factories via `@odh-dashboard/internal/__mocks__`
- **Custom matchers**: Provided by jest-config package

**Well-tested areas** (by file count):
- `frontend/src/utilities/__tests__/` — 32 test files
- `frontend/src/api/k8s/__tests__/` — 24 test files
- `packages/notebooks/upstream/workspaces/` — 17 test files
- `packages/gen-ai/frontend/` — 16+ test files
- `packages/feature-store/` — 15 test files

**Go tests**: 8 test files in `dashboard-operator/` covering controller, webhook, API types, chart sync, and support utilities. 278 Go test files across BFF packages.

### Integration/E2E Tests

**Score: 9/10**

**Cypress E2E (Live Cluster)**:
- 756 Cypress test files across the monorepo
- Cluster failover: Primary (`dash-e2e-int`) with fallback to secondary (`dash-e2e`)
- Health check via DSC conditions (Available, Degraded, odh-dashboardReady)
- Smart test selection with 3 modes:
  1. Manual input via workflow_dispatch
  2. PR labels (`test:Pipelines`, `test:ModelServing`, etc.)
  3. Auto-detection via Turbo change detection + git diff
- Default regression suite: `@ci-dashboard-regression-tags`
- Max 5 additional tags to prevent runner exhaustion (10 runners shared across 30+ devs)

**Cypress Mock Tests**:
- Component/integration tests with mocked backends
- Per-package Cypress configs in `packages/*/frontend/src/__tests__/cypress/`
- Shared test framework in `packages/cypress/`

**Contract Tests**:
- Framework: `@odh-dashboard/contract-tests` (shared package)
- Packages with contract tests: gen-ai, model-registry, mlflow, eval-hub, autorag, automl, agent-ops, core-bff
- OpenAPI schemas as contract source of truth
- Coverage is nascent — most packages have only 1 test file

**BFF Go Tests**:
- Dedicated workflows for automl, autorag, maas, mlflow, model-registry, eval-hub BFF tests
- PR-triggered on package path changes
- Uses Go 1.26.x

**Dashboard Operator Tests**:
- envtest-based controller tests (reconciler, actions, config, modules)
- Webhook validation tests
- Helm chart validation (lint + template render)
- PR-triggered on `dashboard-operator/**` and `manifests/**` changes

### Build Integration

**Score: 9/10**

**PR Build Validation (Konflux Simulator)** — 5-phase pipeline:

| Phase | Name | Description |
|-------|------|-------------|
| 0 | Hermetic Build Preflight | Lockfile validation (Hermeto/Cachi2 compatibility), hermetic npm install test, workspace dependency validation, FIPS compliance check |
| 1 | Docker Build | Builds images in both ODH and RHOAI modes; saves/uploads as artifacts |
| 2-3 | Runtime & Module Federation | Downloads built images, validates container startup, checks branding artifacts (logos, favicons) for both ODH and RHOAI |
| 4 | Operator Integration | Creates Kind cluster, applies kustomize manifests (`manifests/overlays/odh` or `manifests/odh`), validates deployment |
| 5 | Manifest Validation | *Not yet implemented* |

**Kustomize Validation Workflow**:
- Validates manifests for both RHOAI and ODH overlays
- Matrix strategy (fail-fast: false)
- Pinned kustomize version (v5.4.1) with caching
- PR-triggered on `manifests/**` changes

**Module Federation Validation**:
- Port uniqueness validation in pre-commit hook and CI
- `validate:ports` npm script

**Tekton Pipelines**:
- 22 Tekton pipeline definitions in `.tekton/`
- Covers: main dashboard, core-bff, operator, and all modular architecture packages
- Both pull-request and push triggers

### Image Testing

**Score: 8/10**

- **Multi-stage build**: Builder stage (UBI9/nodejs-22) → Runtime stage
- **Base image**: `registry.access.redhat.com/ubi9/nodejs-22:latest` (FIPS-capable UBI)
- **FIPS compliance**:
  - Removes esbuild binaries (`rm -rf node_modules/esbuild node_modules/@esbuild`)
  - PR build checks for Go `strictfipsruntime` tags
  - PR build validates esbuild removal in Dockerfile
- **Runtime validation**: Phase 2-3 of PR build validates container startup and extracts/checks branding assets
- **Health probes**: curl installed for liveness/readiness checks
- **Multi-arch**: Makefile has `docker-buildx` target for `linux/s390x,linux/amd64,linux/ppc64le`
- **No Testcontainers**: Runtime validation uses direct `docker run` rather than Testcontainers framework

### Coverage Tracking

**Score: 7/10**

- **Codecov integration**: Yes, via `codecov/codecov-action` v4.6.0
- **Coverage configuration**:
  - Precision: 2 decimal places
  - Range: 50-70%
  - Project status: informational, auto target, 1% threshold
  - Patch status: informational, 70% target
- **Coverage generation**:
  - Jest unit tests: `--coverage --coverageReporters=json --coverageReporters=lcov`
  - Cypress coverage: Istanbul instrumentation
  - Merged reports: `nyc merge` combines unit + Cypress coverage
- **Coverage merge pipeline**: Unit coverage + per-group Cypress coverage → merged → cleaned → HTML + text-summary report
- **Gap**: Enforcement is `informational: true` — coverage failures never block PRs

### CI/CD Automation

**Score: 9/10**

**Workflow inventory** (28+ files):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| test.yml | push, PR | Unit tests, type-check, lint, Cypress mock tests, coverage |
| cypress-e2e-test.yml | After test.yml, dispatch | E2E on live clusters with failover |
| pr-build-validation.yml | PR (main) | 5-phase Konflux simulation |
| validate-kustomize.yml | push/PR (manifests) | Kustomize overlay validation |
| dashboard-operator-tests.yml | push/PR (operator) | Go operator tests + Helm validation |
| dependency-validation.yml | PR (lockfile changes) | npm audit on changed lockfiles |
| modular-arch-quality-gates.yml | PR (packages) | Per-module quality gates |
| *-bff-tests.yml (×6) | push/PR (package paths) | BFF Go tests for each package |
| claude-preflight.yml | PR | AI agent code quality checks |
| dependabot-auto-merge.yml | workflow_run | Auto-merge Dependabot PRs |
| release-auto-merge.yml | dispatch | Release branch management |
| stale.yml | schedule | Stale issue/PR management |
| agentready-weekly.yml | weekly schedule | Agent readiness checks |

**Concurrency controls**: 8 workflows use `concurrency` with `cancel-in-progress: true`

**Caching strategies**:
- Module caches (npm dependencies via custom action)
- Kustomize binary cache
- Build artifact passing between phases

**Parallelization**:
- Matrix strategies for Cypress test groups, kustomize targets, BFF tests
- Smart test selection reduces unnecessary E2E runs
- Turborepo for monorepo task parallelization

### Static Analysis

**Score: 8/10**

#### Linting
- **ESLint**: Shared `@odh-dashboard/eslint-config` package with presets for:
  - React + TypeScript (`recommendedReactTypescript`)
  - Node.js, Markdown, YAML
  - Package restrictions
  - Custom ESLint plugin (`@odh-dashboard/eslint-plugin`)
- **Prettier**: Configured (`.prettierrc`) with consistent formatting rules
- **golangci-lint**: Configured for dashboard operator (`.golangci.yml`) and all BFF packages (`.golangci.yaml`)
- **Semgrep**: Custom rules in `semgrep.yaml` (63KB — extensive rule set)

#### Pre-commit Hooks
- **Husky**: Pre-commit hook runs `lint-staged` on staged files
- **Module federation ports**: Validates port uniqueness when package.json or federation manifests change
- **No `.pre-commit-config.yaml`**: Hooks are npm-only (Husky), so Go/Python changes bypass hooks unless committed through npm

#### FIPS Compatibility
- Dockerfile removes non-FIPS-compliant esbuild binaries
- PR build validates FIPS compliance (esbuild removal, Go strictfipsruntime)
- UBI9 base image (FIPS-capable)

#### Dependency Alerts
- **Dependabot**: Comprehensive configuration covering npm (9 directories) and github-actions
  - Grouping: PatternFly, React, Fastify, patch updates
  - Cooldown: 14 days default, 30 days for major
  - Auto-merge workflow for Dependabot PRs
  - Version pinning via `versioning-strategy: lockfile-only`
- **Dependency validation workflow**: Runs `npm audit` on changed lockfiles with bypass label support

### Agent Rules

**Score: 10/10** (Gold Standard)

**Agent configuration**:
- `CLAUDE.md` → `AGENTS.md` symlink (comprehensive 12KB document)
- `.claude/rules/` — 21 rule files totaling 6,405 lines
- `.claude/skills/` — 26 custom skills
- `.claude/commands/` — Command definitions

**Rule coverage**:

| Rule File | Lines | Coverage |
|-----------|-------|----------|
| cypress-mock.md | 1,206 | Mock test patterns, data factories, API contracts |
| contract-tests.md | 997 | BFF API contract validation framework |
| cypress-e2e.md | 668 | E2E test patterns, cluster interaction, tags |
| unit-tests.md | 610 | Jest patterns, RTL usage, shared config |
| react.md | 490 | React component patterns, hooks, PatternFly |
| jira-creation.md | 473 | Jira ticket creation standards |
| operator-controller.md | 288 | Go controller-runtime patterns |
| module-onboarding.md | 244 | New module setup guide |
| css-patternfly.md | 217 | PatternFly v6 styling rules |
| bff-go.md | 186 | Go BFF development patterns |
| testing-standards.md | 69 | Cross-cutting test type selection guide |

**Strengths**:
- Framework-specific examples (Jest, Cypress, Go testing)
- Actionable patterns with code snippets
- Quality gate checklists
- Test type selection matrix
- All test types covered: unit, mock, E2E, contract
- Architecture and module federation guidance

## Recommendations

### Priority 0 (Critical)

1. **Enable coverage enforcement** — Change `informational: true` to `informational: false` in `.codecov.yml` for at least the `patch` status to prevent coverage regressions on new code

### Priority 1 (High Value)

1. **Implement Phase 5 manifest validation** — Complete the PR Build Validation pipeline with ConfigMap generation validation and resource manifest checks
2. **Add pre-commit-config.yaml** — Ensure Go/Python contributors also run linting and formatting checks via language-agnostic hooks
3. **Expand contract test coverage** — Most BFF packages have only 1 contract test file; expand using the existing `@odh-dashboard/contract-tests` framework

### Priority 2 (Nice-to-Have)

1. **Add accessibility testing** — Integrate axe-core into Cypress or Jest for automated a11y checks on PatternFly components
2. **Add performance regression testing** — Monitor bundle sizes and page load times across PRs
3. **Visual regression testing** — Consider screenshot comparison for PatternFly component changes

## Comparison to Gold Standards

| Dimension | odh-dashboard | Gold Standard | Gap |
|-----------|--------------|---------------|-----|
| Unit Tests | 1,024 files, Jest, shared config | Strong baseline | Minor: could improve ratio from 0.20 |
| Integration/E2E | Cypress + cluster failover + contracts | odh-dashboard IS the gold standard | Sets the bar for other repos |
| Build Integration | 5-phase Konflux simulator | odh-dashboard IS the gold standard | Phase 5 not yet implemented |
| Image Testing | UBI9, FIPS, runtime validation | notebooks (5-layer) | Missing Testcontainers, fewer validation layers |
| Coverage Tracking | Codecov merged, informational | kserve (enforcing thresholds) | Switch to enforcing mode |
| CI/CD Automation | 28+ workflows, smart selection | odh-dashboard IS the gold standard | Near-perfect |
| Static Analysis | ESLint shared package, golangci-lint | Strong | Add pre-commit-config.yaml |
| Agent Rules | 21 rules, 26 skills, 6,400+ lines | odh-dashboard IS the gold standard | Unmatched in the org |

## File Paths Reference

### CI/CD
- `.github/workflows/test.yml` — Main test workflow (unit, lint, type-check, Cypress mock, coverage)
- `.github/workflows/cypress-e2e-test.yml` — E2E tests on live clusters
- `.github/workflows/pr-build-validation.yml` — 5-phase Konflux simulator
- `.github/workflows/validate-kustomize.yml` — Kustomize overlay validation
- `.github/workflows/dashboard-operator-tests.yml` — Go operator tests
- `.github/workflows/dependency-validation.yml` — npm audit on lockfile changes
- `.github/workflows/modular-arch-quality-gates.yml` — Per-module quality gates
- `.github/workflows/dependabot-auto-merge.yml` — Dependabot auto-merge
- `.tekton/` — 22 Tekton pipeline definitions

### Testing
- `frontend/jest.config.ts` — Frontend Jest configuration
- `backend/jest.config.ts` — Backend Jest configuration
- `packages/cypress/cypress.config.ts` — Main Cypress configuration
- `packages/contract-tests/` — Contract test framework
- `dashboard-operator/internal/controller/*_test.go` — Operator controller tests
- `packages/*/bff/` — BFF Go code with tests

### Code Quality
- `.eslintrc.js` — Root ESLint config
- `packages/eslint-config/` — Shared ESLint configuration package
- `packages/eslint-plugin/` — Custom ESLint plugin
- `.prettierrc` — Prettier configuration
- `.husky/pre-commit` — Pre-commit hook (lint-staged + port validation)
- `dashboard-operator/.golangci.yml` — Go linter config (operator)
- `packages/*/bff/.golangci.yaml` — Go linter config (BFF packages)
- `.github/dependabot.yml` — Dependabot configuration
- `semgrep.yaml` — Custom Semgrep rules

### Container Images
- `Dockerfile` — Multi-stage build (UBI9 base)
- `.dockerignore` — Docker ignore rules
- `Makefile` — Build, push, deploy targets + multi-arch buildx

### Coverage
- `.codecov.yml` — Codecov configuration
- `frontend/package.json` — Coverage scripts (test:coverage, coverage:merge)

### Agent Rules
- `AGENTS.md` / `CLAUDE.md` — Comprehensive agent guidance
- `.claude/rules/*.md` — 21 specialized rule files
- `.claude/skills/` — 26 custom skills
- `.claude/commands/` — Command definitions
