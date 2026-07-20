---
repository: "red-hat-data-services/odh-dashboard"
overall_score: 8.7
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "975 unit spec files with Jest + React Testing Library; 20% test-to-code ratio; shared mock factories and custom matchers"
  - dimension: "Integration/E2E"
    score: 9.5
    status: "191 Cypress E2E tests with cluster failover, smart test selection, auto-detection from PR changes; contract tests for BFF APIs; Kind cluster deployment testing"
  - dimension: "Build Integration"
    score: 9.5
    status: "PR-time Konflux simulation with hermetic build validation, Kind deployment testing, Kustomize overlay validation for RHOAI/ODH, multi-Dockerfile Konflux builds"
  - dimension: "Image Testing"
    score: 8.0
    status: "13 Dockerfiles with multi-stage builds on UBI9 base images; Kind cluster image loading and startup validation; health probes in manifests; no multi-arch builds or Testcontainers"
  - dimension: "Coverage Tracking"
    score: 7.5
    status: "Codecov integration with merged unit + Cypress coverage; informational mode with 70% patch target; no enforcement gates blocking PRs"
  - dimension: "CI/CD Automation"
    score: 9.5
    status: "29 workflows with concurrency control, caching, matrix strategies, Tekton pipelines; modular architecture quality gates; auto-merge for dependabot and releases"
  - dimension: "Static Analysis"
    score: 8.5
    status: "ESLint + golangci-lint v2; Husky pre-commit hooks with lint-staged; Dependabot for npm + GitHub Actions; FIPS strictfipsruntime check in PR build validation"
  - dimension: "Agent Rules"
    score: 10.0
    status: "Exemplary: 21 rule files (6,405 lines), 26 skills, AGENTS.md with comprehensive guidance, testing standards for all test types, framework-specific patterns"
critical_gaps:
  - title: "Coverage enforcement is informational only"
    impact: "PRs can merge with decreased coverage since codecov status checks are not blocking"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No multi-architecture container image builds"
    impact: "Only x86_64 images built; ARM64 support not validated at PR time"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "No Testcontainers or container runtime unit tests"
    impact: "Image runtime validation only happens via Kind cluster deployment, not isolated container tests"
    severity: "LOW"
    effort: "4-6 hours"
quick_wins:
  - title: "Switch codecov from informational to enforcing mode"
    effort: "1-2 hours"
    impact: "Prevent coverage regressions from merging by making coverage checks required status checks"
  - title: "Add coverage thresholds per package in monorepo"
    effort: "2-3 hours"
    impact: "Track per-package coverage trends and prevent regression in critical modules"
  - title: "Add Renovate as secondary dependency manager for Go modules"
    effort: "1-2 hours"
    impact: "Automated Go module dependency updates for dashboard-operator (Dependabot covers npm only)"
recommendations:
  priority_0:
    - "Switch codecov status checks from informational to enforcing with minimum 70% patch coverage gate"
    - "Add Dependabot configuration for Go modules ecosystem to cover dashboard-operator dependencies"
  priority_1:
    - "Add multi-architecture build support (ARM64) in PR build validation workflow"
    - "Add Testcontainers-based runtime validation for critical image startup paths"
    - "Add Go coverage reporting for dashboard-operator tests to codecov"
  priority_2:
    - "Add performance regression testing for frontend bundle size and build times"
    - "Add accessibility testing automation (axe-core integration with Cypress)"
    - "Consider adding visual regression testing with Percy or Chromatic"
---

# Quality Analysis: red-hat-data-services/odh-dashboard

## Executive Summary

- **Overall Score: 8.7/10** — This is an exemplary repository with industry-leading quality practices
- **Repository Type**: TypeScript/React monorepo with Go operator (downstream, AI Core Dashboard)
- **Jira**: RHOAIENG / AI Core Dashboard
- **Key Strengths**: Comprehensive multi-layer testing (unit, mock, E2E, contract), PR-time Konflux build simulation with Kind deployment, exceptional agent rules with 21 rule files and 26 skills
- **Critical Gaps**: Coverage enforcement is informational-only, no multi-arch image builds, Go module dependencies not covered by Dependabot
- **Agent Rules Status**: Exemplary — the gold standard for agent rule coverage

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.5/10 | 15% | 1.28 | 975 unit spec files; Jest + RTL; shared mocks |
| Integration/E2E | 9.5/10 | 20% | 1.90 | 191 Cypress E2E + contract tests + Kind deployment |
| Build Integration | 9.5/10 | 15% | 1.43 | PR-time Konflux sim, hermetic build, Kustomize validation |
| Image Testing | 8.0/10 | 10% | 0.80 | 13 multi-stage UBI9 Dockerfiles; Kind startup validation |
| Coverage Tracking | 7.5/10 | 10% | 0.75 | Codecov with merged unit+Cypress; informational only |
| CI/CD Automation | 9.5/10 | 15% | 1.43 | 29 workflows; concurrency; caching; matrix; Tekton |
| Static Analysis | 8.5/10 | 10% | 0.85 | ESLint + golangci-lint v2; Husky hooks; Dependabot |
| Agent Rules | 10.0/10 | 5% | 0.50 | 21 rules (6,405 lines), 26 skills, AGENTS.md |
| **Overall** | **8.7/10** | **100%** | **8.93** | |

## Critical Gaps

### 1. Coverage Enforcement is Informational Only
- **Impact**: PRs can merge with decreased coverage since codecov status checks use `informational: true` for both project and patch coverage
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **File**: `.codecov.yml`
- **Fix**: Change `informational: true` to `informational: false` and set `target: 70%` for patch coverage as a blocking gate

### 2. No Multi-Architecture Container Image Builds
- **Impact**: Only x86_64 images are built and tested; ARM64/s390x/ppc64le support is not validated at PR time
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Fix**: Add `docker buildx` with `--platform linux/amd64,linux/arm64` to PR build validation

### 3. Go Module Dependencies Not Covered by Dependabot
- **Impact**: The `dashboard-operator/` Go module dependencies are not automatically tracked for security updates
- **Severity**: MEDIUM
- **Effort**: 1 hour
- **Fix**: Add `gomod` ecosystem entry to `.github/dependabot.yml` with `directory: /dashboard-operator`

## Quick Wins

### 1. Switch Codecov to Enforcing Mode (1-2 hours)
Change `.codecov.yml` to enforce coverage gates:
```yaml
coverage:
  status:
    patch:
      default:
        informational: false  # was: true
        target: 70%
```

### 2. Add Dependabot for Go Modules (1 hour)
Add to `.github/dependabot.yml`:
```yaml
  - package-ecosystem: gomod
    directory: /dashboard-operator
    schedule:
      interval: weekly
      day: monday
    open-pull-requests-limit: 5
    target-branch: "main"
    labels:
      - "dependencies"
```

### 3. Add Per-Package Coverage Tracking (2-3 hours)
Configure codecov flags to track coverage per monorepo package, enabling per-module coverage trend visibility.

## Detailed Findings

### Unit Tests (8.5/10)

**Strengths:**
- **975 unit spec files** across frontend, backend, and packages using Jest + React Testing Library
- Test-to-code ratio of ~20% (975 test files / 5,100 source files)
- Shared mock data factories via `@odh-dashboard/internal/__mocks__`
- Custom jest configuration shared via `@odh-dashboard/jest-config`
- Backend tests with dedicated `jest.config.ts` using ts-jest
- Comprehensive testing rule in `.claude/rules/unit-tests.md` (610 lines)

**Files Analyzed:**
- `frontend/jest.config.ts` — Extends shared jest-config package
- `backend/jest.config.ts` — ts-jest with node environment, coverage collection
- `backend/src/__tests__/*.spec.ts` — Backend unit tests
- `frontend/src/components/__tests__/*.test.tsx` — Frontend component tests

**Minor Gaps:**
- Test-to-code ratio could be higher (industry gold standard is 30-40%)
- Some packages may have lower coverage than core frontend/backend

### Integration/E2E Tests (9.5/10)

**Strengths:**
- **191 Cypress E2E test files** with sophisticated test infrastructure
- **Contract tests** for BFF API validation across 6 packages (agent-ops, automl, autorag, eval-hub, gen-ai, maas, mlflow, model-registry)
- **21 contract test files** using `@odh-dashboard/contract-tests` shared package
- **Cluster failover**: Primary and secondary clusters with health check (DSC conditions)
- **Smart test selection**: PR labels (`test:*`), Turbo auto-detection, manual dispatch
- **Kind cluster deployment testing** in PR build validation
- Separate Cypress packages for model-serving and observability
- Matrix strategy for parallel Cypress execution by package

**E2E Infrastructure Highlights:**
- Triggered automatically after "Test" workflow completes on PRs
- Cluster health check via DSC conditions (Available, Degraded, odh-dashboardReady)
- Auto-detected tags from changed packages via Turbo and git diff
- Max 5 additional tags for labels/manual to prevent runner exhaustion (10 runners shared across 30+ devs)

**Files Analyzed:**
- `.github/workflows/cypress-e2e-test.yml` — 61,956 bytes, comprehensive E2E workflow
- `packages/cypress/` — Shared Cypress test framework
- `packages/*/contract-tests/` — Per-package contract tests
- `.github/workflows/dashboard-operator-tests.yml` — Go operator tests with envtest

### Build Integration (9.5/10)

**Strengths:**
- **PR-time Konflux build simulation** (`pr-build-validation.yml` — 38,894 bytes)
  - Hermetic build preflight checking for unsupported protocols (git+, github:, file:)
  - Validates lockfile for Hermeto/Cachi2 compatibility
  - Hermetic npm install testing
  - Docker image builds for both ODH and RHOAI modes
  - FIPS `strictfipsruntime` check for Go builds
- **Kind cluster deployment testing** — Creates cluster, loads image, deploys with mock OpenShift secrets
- **Kustomize validation** — Validates manifests for both RHOAI and ODH overlays
- **13 Konflux Dockerfiles** for different components (core-bff, dashboard-operator, gen-ai, model-registry, etc.)
- **11 Tekton pipeline files** for Konflux CI/CD
- **Modular architecture quality gates** — Per-module build validation on PR
- **Module Federation port validation** — Prevents port conflicts

**Files Analyzed:**
- `.github/workflows/pr-build-validation.yml` — Konflux simulator
- `.github/workflows/validate-kustomize.yml` — Kustomize overlay validation
- `.github/workflows/modular-arch-quality-gates.yml` — Per-module quality gates
- `Dockerfile.konflux.*` — 13 Konflux-specific Dockerfiles
- `.tekton/` — 11 Tekton pipeline files

### Image Testing (8.0/10)

**Strengths:**
- **13 Dockerfiles** with multi-stage builds (2-3 stages each)
- All Konflux images use UBI9 base images (`registry.access.redhat.com/ubi9/nodejs-22`) — FIPS-capable
- Pin-by-digest in Konflux Dockerfiles for reproducibility
- **Kind cluster deployment testing** with image loading and startup validation
- **36 health probes** defined in manifests (liveness + readiness probes)
- CrashLoopBackOff detection in PR build validation

**Gaps:**
- No `--platform` or `docker buildx` for multi-architecture builds
- No Testcontainers or isolated container runtime unit tests
- No `HEALTHCHECK` directive in Dockerfiles themselves (health checks are in K8s manifests)

**Files Analyzed:**
- `Dockerfile`, `Dockerfile.konflux`, `Dockerfile.konflux.*` — 13 total
- `manifests/modular-architecture/deployment.yaml` — Health probes
- `.github/workflows/pr-build-validation.yml` — Kind deployment section

### Coverage Tracking (7.5/10)

**Strengths:**
- **Codecov integration** with `codecov/codecov-action@v4.6.0`
- **Merged coverage** combining unit test coverage (Jest) + Cypress E2E coverage
- Coverage precision to 2 decimal places with range "50...70"
- PR coverage reporting with diff, flags, and file-level breakdown
- Backend has `collectCoverageFrom` configured for `src/**/*.{ts,tsx}`

**Gaps:**
- Both project and patch coverage are **informational only** (`informational: true`) — not blocking PRs
- Patch target is 70% but not enforced
- No per-package coverage flags in codecov config
- Go operator tests do not appear to report coverage to codecov
- No coverage gate threshold that blocks merges

**Files Analyzed:**
- `.codecov.yml` — Codecov configuration
- `.github/workflows/test.yml` — Coverage collection and upload steps

### CI/CD Automation (9.5/10)

**Strengths:**
- **29 workflow files** covering testing, builds, releases, and maintenance
- **Concurrency control** in 8 workflows — cancels in-progress runs on new commits
- **Caching strategies** — Node.js module caches, Turbo build caches, Kustomize binary cache
- **Matrix strategies** in 6 workflows — parallel package testing, module quality gates
- **Timeout controls** in 4 workflows
- **PR-triggered workflows**: test.yml, pr-build-validation.yml, validate-kustomize.yml, dependency-validation.yml, modular-arch-quality-gates.yml, 8 package-specific test workflows
- **Automated maintenance**: stale issue/PR management, dependabot auto-merge, PR image expiry
- **Release automation**: release-odh-dashboard.yml, release-auto-merge.yml (sync to ODH/RHOAI release branches)
- **Tekton pipelines**: 11 pipeline files for Konflux CI/CD
- **Agentic CI**: `.agentic-ci/config.yml` for Claude-powered PR preflight

**Workflow Inventory:**
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| Test | push, PR | Unit tests, linting, type-check, coverage |
| Cypress e2e Test | workflow_run (after Test), dispatch | E2E tests with cluster failover |
| PR Build Validation | PR | Konflux build simulation |
| Validate Kustomize | push, PR (manifests/) | Kustomize overlay validation |
| Dashboard Operator Tests | push, PR (operator/) | Go lint, build, test, Helm validation |
| Modular Architecture Quality Gates | PR (packages/) | Per-module build + test |
| 8x Package-specific Tests | push, PR | BFF and frontend tests per package |
| Dependency Validation | PR | Dependency audit and validation |
| Dependabot Auto-merge | PR target | Auto-merge dependabot PRs |
| AgentReady Weekly | schedule (Mon 9am) | Weekly quality assessment |
| Claude Preflight | PR target | AI-powered PR review |
| Release workflows | dispatch | Release management |
| Stale | schedule (daily) | Issue/PR cleanup |

### Static Analysis (8.5/10)

**Linting:**
- ESLint with shared config (`@odh-dashboard/eslint-config`) across frontend, backend, and packages
- `.eslintrc.goal.js` in frontend — suggests aspirational stricter config
- golangci-lint v2 for Go operator with `standard` defaults, govet with all checks enabled
- Runs as part of both pre-commit hooks and CI (test.yml Lint job)

**Pre-commit Hooks:**
- Husky pre-commit hook with lint-staged
- Module Federation port validation on package.json changes
- Helpful error messages with fix instructions
- Skip override available (`SKIP_LINT_HOOK=true`)

**FIPS Compatibility:**
- UBI9 base images across all Dockerfiles (FIPS-capable)
- PR build validation checks for `strictfipsruntime` Go build tag
- No non-FIPS-compliant crypto imports detected in Go operator

**Dependency Alerts:**
- Dependabot configured for:
  - `github-actions` ecosystem (monthly)
  - `npm` ecosystem (weekly) covering 9 directories
- Dependabot grouping for PatternFly, React, Fastify, and patch updates
- Auto-merge workflow for dependabot PRs
- **Gap**: No `gomod` ecosystem entry for Go operator dependencies

**Files Analyzed:**
- `.eslintrc.js` — Root ESLint config
- `frontend/.eslintrc.js`, `backend/.eslintrc.js` — Package configs
- `dashboard-operator/.golangci.yaml` — Go linting config
- `.husky/pre-commit` — Pre-commit hook script
- `.github/dependabot.yml` — Dependency management
- `.github/workflows/dependabot-auto-merge.yml` — Auto-merge

### Agent Rules (10.0/10)

**This is the gold standard for agent rules in the RHOAI ecosystem.**

**Rules (21 files, 6,405 total lines):**
| Rule | Lines | Coverage |
|------|-------|----------|
| cypress-mock.md | 1,206 | Mock/component test patterns, interceptors, fixtures |
| contract-tests.md | 997 | BFF API contract validation patterns |
| cypress-e2e.md | 668 | E2E test creation, Robot Framework migrations |
| unit-tests.md | 610 | Jest patterns, hooks, RTL, mock factories |
| react.md | 490 | React component patterns, hooks, state management |
| jira-creation.md | 473 | Jira ticket creation standards |
| operator-controller.md | 288 | Go operator/controller-runtime patterns |
| prototype-fork-ops.md | 258 | Prototype fork operations |
| module-onboarding.md | 244 | New module scaffolding |
| css-patternfly.md | 217 | PatternFly styling conventions |
| bff-go.md | 186 | Go BFF development patterns |
| architecture.md | 115 | Structural change guidelines |
| distributions.md | 114 | Distribution-specific code guidelines |
| modular-architecture.md | 109 | Plugin/extension system patterns |
| module-federation.md | 100 | Webpack Module Federation config |
| third-party-theming.md | 92 | External library theming patterns |
| conventions.md | 91 | TypeScript/React code conventions |
| testing-standards.md | 69 | Cross-cutting test type selection |
| security.md | 62 | Auth, secrets, input validation |
| pull-requests.md | 16 | PR creation standards |

**Skills (26 custom skills):**
- Development: dev-workflow, module-onboarding, konflux-onboarding
- Testing: ci-flake-classifier, preflight
- Documentation: docs-create, docs-create-package, docs-update
- Code Review: style-review, rbac-review, coderabbit-review, coderabbit-code-review, coderabbit-autofix
- Jira Integration: jira-triage, jira-eval-review, jira-evaluate-blockers, jira-validate-* (5 skills)
- Upstream Sync: upstream-sync, upstream-sync-local, upstream-sync-status
- Prototyping: prototype-spec, prototype-tickets

**Additional Quality Signals:**
- `AGENTS.md` with comprehensive repository overview, structure, commands, and technology table
- `BOOKMARKS.md` indexing key documentation
- `.agentic-ci/config.yml` for Claude-powered PR reviews
- Multi-agent workflow documentation
- Package-specific AGENTS.md files

## Recommendations

### Priority 0 (Critical)
1. **Switch codecov coverage checks from informational to enforcing** — Change `informational: true` to `false` in `.codecov.yml` to prevent coverage regressions from merging (2-4 hours)
2. **Add Dependabot configuration for Go modules** — Add `gomod` ecosystem entry for `dashboard-operator/` to catch security vulnerabilities in Go dependencies (1 hour)

### Priority 1 (High Value)
3. **Add Go operator coverage to codecov** — Report dashboard-operator test coverage alongside frontend/backend coverage for unified tracking (4-6 hours)
4. **Add multi-architecture image builds** — Validate ARM64 compatibility in PR build validation using `docker buildx` (8-12 hours)
5. **Add Testcontainers-based image validation** — Isolated container runtime tests for critical startup paths without needing a full Kind cluster (4-6 hours)

### Priority 2 (Nice-to-Have)
6. **Add performance regression testing** — Track frontend bundle size and build times across PRs (4-8 hours)
7. **Add accessibility testing** — Integrate axe-core with Cypress E2E for automated a11y checks (4-6 hours)
8. **Add visual regression testing** — Percy or Chromatic integration for UI regression detection (8-12 hours)

## Comparison to Gold Standards

| Dimension | odh-dashboard (this) | Gold Standard | Gap |
|-----------|---------------------|---------------|-----|
| Unit Tests | 975 spec files, Jest+RTL, shared mocks | odh-dashboard IS the gold standard | Reference |
| Integration/E2E | 191 Cypress + contract tests + Kind | odh-dashboard IS the gold standard | Reference |
| Build Integration | Konflux simulator, hermetic builds, Kustomize | odh-dashboard IS the gold standard | Reference |
| Image Testing | 13 multi-stage UBI9, Kind startup | notebooks 5-layer | No multi-arch, no Testcontainers |
| Coverage Tracking | Codecov merged, informational | kserve enforced gates | Informational → enforcing |
| CI/CD Automation | 29 workflows, Tekton, concurrency | odh-dashboard IS the gold standard | Reference |
| Static Analysis | ESLint+golangci, Husky, Dependabot | Full ecosystem coverage | Go deps not in Dependabot |
| Agent Rules | 21 rules, 26 skills, 6,405 lines | odh-dashboard IS the gold standard | Reference |

**Overall Assessment**: `red-hat-data-services/odh-dashboard` is the gold standard repository in the RHOAI ecosystem. It demonstrates best-in-class practices across nearly all quality dimensions. The few gaps identified (informational coverage, Go dep tracking, multi-arch builds) are relatively minor and easy to address. This repository should be used as the reference for all other RHOAI repositories.

## File Paths Reference

### CI/CD
- `.github/workflows/test.yml` — Main test workflow (unit, lint, type-check, coverage)
- `.github/workflows/cypress-e2e-test.yml` — E2E test workflow with cluster failover
- `.github/workflows/pr-build-validation.yml` — Konflux build simulation
- `.github/workflows/validate-kustomize.yml` — Kustomize overlay validation
- `.github/workflows/modular-arch-quality-gates.yml` — Per-module quality gates
- `.github/workflows/dashboard-operator-tests.yml` — Go operator tests
- `.github/workflows/dependabot-auto-merge.yml` — Dependabot auto-merge
- `.tekton/` — 11 Tekton pipeline files

### Testing
- `frontend/jest.config.ts` — Frontend Jest configuration
- `backend/jest.config.ts` — Backend Jest configuration
- `packages/cypress/` — Shared Cypress test framework
- `packages/*/contract-tests/` — Per-package contract tests
- `packages/contract-tests/` — Shared contract test utilities

### Code Quality
- `.eslintrc.js` — Root ESLint config
- `dashboard-operator/.golangci.yaml` — Go linting
- `.husky/pre-commit` — Pre-commit hooks
- `.codecov.yml` — Coverage configuration
- `.github/dependabot.yml` — Dependency alerts

### Container Images
- `Dockerfile` — Main dashboard image
- `Dockerfile.konflux` — Konflux build
- `Dockerfile.konflux.*` — 11 additional Konflux Dockerfiles

### Agent Rules
- `AGENTS.md` — Repository-level AI agent guidance
- `.claude/rules/` — 21 specialized rule files (6,405 lines)
- `.claude/skills/` — 26 custom AI agent skills
- `.agentic-ci/config.yml` — Agentic CI configuration
