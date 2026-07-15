---
repository: "opendatahub-io/odh-dashboard"
overall_score: 8.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "908 test files across Jest + React Testing Library with shared config package"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Multi-layer Cypress (mock + E2E + package-level) with contract tests and live cluster failover"
  - dimension: "Build Integration"
    score: 9.5
    status: "Gold-standard PR-time Konflux simulation with hermetic preflight, runtime validation, and Kind operator integration"
  - dimension: "Image Testing"
    score: 8.0
    status: "Multi-stage Docker builds with runtime branding validation but no container vulnerability scanning in CI"
  - dimension: "Coverage Tracking"
    score: 7.5
    status: "Codecov integration with 70% patch target but informational-only (non-blocking) thresholds"
  - dimension: "CI/CD Automation"
    score: 9.5
    status: "26 workflows with concurrency control, Turbo caching, smart test selection, and Claude AI preflight"
  - dimension: "Agent Rules"
    score: 9.5
    status: "22 specialized rules, 25 custom skills, package-level AGENTS.md, Claude preflight workflow"
critical_gaps:
  - title: "No container vulnerability scanning in GitHub Actions CI"
    impact: "Security vulnerabilities in container images and dependencies not caught at PR time despite semgrep.yaml (1875 rules) and gitleaks.toml existing but not wired into workflows"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Coverage thresholds are informational-only"
    impact: "PRs can merge with declining coverage; 50-70% range is moderate for a critical UI project"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No pre-commit-config.yaml (only Husky lint-staged)"
    impact: "Missing standardized security checks (gitleaks, semgrep) at commit time; Husky only runs lint-staged"
    severity: "LOW"
    effort: "2-3 hours"
quick_wins:
  - title: "Add Trivy container scanning to PR workflow"
    effort: "2-3 hours"
    impact: "Catch CVEs in container images before merge; complements existing semgrep.yaml rules"
  - title: "Wire semgrep.yaml into a GitHub Actions workflow"
    effort: "1-2 hours"
    impact: "Activate the 1875 existing SAST rules that are currently dormant in CI"
  - title: "Switch codecov from informational to enforcing mode"
    effort: "1 hour"
    impact: "Prevent coverage regression by blocking PRs that drop below threshold"
  - title: "Add pre-commit hooks for gitleaks and semgrep"
    effort: "2-3 hours"
    impact: "Catch secrets and security issues at commit time, before push"
recommendations:
  priority_0:
    - "Add Trivy or Snyk container scanning to the pr-build-validation.yml workflow to scan built images before merge"
    - "Create a Semgrep CI workflow using the existing 1875-rule semgrep.yaml configuration"
  priority_1:
    - "Switch codecov coverage thresholds from informational to enforcing with a 65% project target"
    - "Add CodeQL or Semgrep SAST scanning as a required PR check"
    - "Add performance regression testing for dashboard load times and API response times"
  priority_2:
    - "Expand cypress-axe accessibility testing beyond its current integration"
    - "Add Storybook for component documentation and visual regression testing"
    - "Implement chaos engineering tests for operator resilience"
---

# Quality Analysis: odh-dashboard

## Executive Summary

- **Overall Score: 8.6/10** — One of the strongest quality-engineered repositories in the OpenShift AI ecosystem
- **Key Strengths**: Gold-standard PR-time Konflux build simulation, comprehensive multi-layer testing (unit → mock → contract → E2E), exceptional agent rules with 22 specialized rules and 25 skills, and sophisticated CI/CD with 26 workflows including Claude AI preflight
- **Critical Gaps**: Container vulnerability scanning (Trivy/Snyk/CodeQL) completely absent from GitHub Actions despite having semgrep.yaml with 1875 rules; coverage enforcement is informational-only
- **Agent Rules Status**: Gold standard — 22 rules covering all test types, architecture, security, and development workflows

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | 908 test files, Jest + RTL, shared config package, coverage artifacts |
| Integration/E2E | 9.0/10 | Multi-layer Cypress (mock + E2E), contract tests for 8 BFF packages, live cluster failover |
| **Build Integration** | **9.5/10** | **PR-time Konflux simulation, hermetic preflight, dual-mode Docker builds, Kind operator integration** |
| Image Testing | 8.0/10 | Multi-stage builds, runtime validation, 24+ Dockerfiles, but no vulnerability scanning |
| Coverage Tracking | 7.5/10 | Codecov with 70% patch target, informational-only mode |
| CI/CD Automation | 9.5/10 | 26 workflows, concurrency control, Turbo caching, Claude AI preflight |
| Agent Rules | 9.5/10 | 22 rules, 25 skills, package-level AGENTS.md, Claude preflight workflow |

## Critical Gaps

### 1. No Container Vulnerability Scanning in CI
- **Impact**: Security vulnerabilities in container images and dependencies not caught at PR time
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The repo has an extensive `semgrep.yaml` (1875 rules) and `.gitleaks.toml` configured, but neither is wired into any GitHub Actions workflow. No Trivy, Snyk, or CodeQL workflows exist. Security scanning appears to be deferred to Tekton/Konflux pipelines, leaving a gap in the PR review cycle.
- **Fix**: Add a `security-scan.yml` workflow that runs Trivy on built images and Semgrep on source code.

### 2. Coverage Thresholds Are Informational-Only
- **Impact**: PRs can merge with declining coverage; the 50-70% range allows significant untested code
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: `.codecov.yml` has `informational: true` for both project and patch status. The 70% patch target is reasonable but unenforced. Coverage range of 50-70% is moderate for a critical production UI.
- **Fix**: Set `informational: false` and increase the project target to 65%.

### 3. No Pre-Commit Security Hooks
- **Impact**: Secrets and SAST findings not caught until CI, increasing remediation cycle time
- **Severity**: LOW
- **Effort**: 2-3 hours
- **Details**: Husky runs lint-staged (ESLint, Prettier, module federation port validation) but no `.pre-commit-config.yaml` exists. The gitleaks configuration sits unused at commit time.
- **Fix**: Add `.pre-commit-config.yaml` with gitleaks and semgrep hooks.

## Quick Wins

### 1. Wire Semgrep into GitHub Actions (1-2 hours)
The repo already has a comprehensive 1875-rule `semgrep.yaml`. Creating a workflow is trivial:

```yaml
name: Semgrep SAST
on: [pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: semgrep/semgrep-action@v1
        with:
          config: semgrep.yaml
```

### 2. Add Trivy to PR Build Validation (2-3 hours)
Since `pr-build-validation.yml` already builds Docker images, add a scan step after the build:

```yaml
- name: Scan image with Trivy
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'odh-dashboard:odh-test'
    format: 'sarif'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'
```

### 3. Enforce Coverage Thresholds (1 hour)
Update `.codecov.yml`:

```yaml
coverage:
  status:
    project:
      default:
        informational: false  # was: true
        target: 65%
        threshold: 2%
    patch:
      default:
        informational: false  # was: true
        target: 70%
```

### 4. Add Pre-Commit Hooks (2-3 hours)
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
  - repo: https://github.com/semgrep/semgrep
    rev: v1.50.0
    hooks:
      - id: semgrep
        args: ['--config', 'semgrep.yaml']
```

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (26 workflows)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | push, PR | Core: Setup → Type-Check → Lint → Unit Tests → Cypress Mock Tests (matrix) → Coverage upload |
| `pr-build-validation.yml` | PR | Konflux simulation: hermetic preflight → Docker build (ODH + RHOAI) → runtime validation → Kind operator integration |
| `cypress-e2e-test.yml` | workflow_run (after Test), dispatch | Live cluster E2E with failover between `dash-e2e-int` and `dash-e2e` clusters |
| `modular-arch-quality-gates.yml` | PR (packages/), dispatch | Module architecture validation for changed packages |
| `validate-kustomize.yml` | push, PR | Kustomize manifest validation for ODH and RHOAI overlays |
| `dependency-validation.yml` | PR | npm audit on changed package-lock.json files |
| `claude-preflight.yml` | PR target, issue comment | Claude AI agent preflight checks on PRs |
| `*-bff-tests.yml` (7 workflows) | push, PR | Per-package BFF test suites (automl, autorag, core, eval-hub, gen-ai, maas, mlflow, model-registry) |
| `*-frontend-tests.yml` (3 workflows) | push, PR | Per-package frontend test suites (eval-hub, gen-ai, model-registry) |
| `dashboard-operator-tests.yml` | push, PR | Go operator unit tests |
| `release-*.yml` | dispatch | Release management |
| `stale.yml` | schedule | Stale issue/PR management |
| `agentready-weekly.yml` | schedule, dispatch | Weekly agent readiness checks |

**Strengths**:
- Concurrency control on every PR workflow with `cancel-in-progress: true`
- Smart caching: Turbo build cache, npm module cache, Kustomize binary cache
- Matrix-based Cypress test splitting via `generate-cypress-test-matrix.js`
- E2E smart test selection based on PR labels, Turbo change detection, and manual tags
- Cluster failover with health checks (DSC conditions: Available, Degraded, odh-dashboardReady)
- Per-package BFF test workflows avoid unnecessary runs

**Areas for Improvement**:
- No security scanning workflow (Trivy, Semgrep, CodeQL all absent from GitHub Actions)
- E2E tests are `workflow_dispatch` only (not directly required on PRs — triggered indirectly via `workflow_run`)

### Test Coverage

**Test Type Breakdown**:

| Type | Framework | Count | Location |
|------|-----------|-------|----------|
| Unit Tests (TS) | Jest + RTL | 908 files | `**/__tests__/*.spec.ts(x)` |
| Cypress Mock | Cypress | 278 files (98 core + 180 package) | `packages/cypress/tests/mocked/` + `packages/*/frontend/src/__tests__/cypress/` |
| Cypress E2E | Cypress | 91 files | `packages/cypress/tests/e2e/` |
| Contract Tests | Jest + custom framework | 8 test files | `packages/*/contract-tests/__tests__/` |
| Go BFF Tests | Go testing | 233 files | `packages/*/bff/` + `packages/*/upstream/bff/` |
| Go Operator Tests | Go testing | 8 files | `dashboard-operator/` |

**Test-to-Code Ratio**: 908 TS test files / 4,790 TS source files = **19%** (good for a UI project)

**Go Test Coverage**: 315 Go test files / 1,174 Go files = **27%** (strong for BFF services)

**Contract Test Framework**:
- Central `@odh-dashboard/contract-tests` package with schema validators, OpenAPI validation, and HTML report generation
- 8 packages have contract tests: agent-ops, automl, autorag, eval-hub, gen-ai, mlflow, model-registry
- Consumer-driven contracts validating frontend expectations against BFF APIs

**Coverage Tracking**:
- Codecov integration with artifact upload
- 70% patch target, 50-70% range
- Informational-only (does not block merges)
- Aggregated coverage via `scripts/unit-test-coverage-aggregator.js`

### Code Quality

**Linting**:
- ESLint via shared `@odh-dashboard/eslint-config` package
- Prettier with consistent config (single quotes, 100-char width, trailing commas)
- TypeScript strict mode via shared `@odh-dashboard/tsconfig`
- Turbo-orchestrated lint across all packages

**Pre-Commit Hooks**:
- Husky with lint-staged
- Module Federation port validation on package.json changes
- Skip/force override mechanisms (`SKIP_LINT_HOOK`, `FORCE_LINT_HOOK`)
- Missing: `.pre-commit-config.yaml` (no gitleaks/semgrep at commit time)

**Static Analysis**:
- `semgrep.yaml`: 1875 lines covering Go, Python, TypeScript, YAML, and generic secrets detection — **NOT wired into CI**
- `.gitleaks.toml`: Comprehensive secret detection config with test file exclusions — **NOT wired into CI**
- CodeRabbit: Assertive review profile with path-specific instructions and architecture guidance
- No CodeQL workflow

### Container Images

**Build Process**:
- 24+ Dockerfiles across the monorepo
- Multi-stage builds (builder → runtime)
- UBI9 base images (`ubi9/nodejs-22`)
- Dual-mode builds: ODH and RHOAI branding
- FIPS compliance: esbuild binary removal
- Production manifest optimization (`prepare-production-manifest.js`)

**Runtime Validation** (in `pr-build-validation.yml`):
- Branding validation: Extracts built HTML and checks for correct logos, favicons, product names
- Health probe validation: Starts container and checks `/api/health` endpoint
- Module Federation validation: Verifies exposed modules are accessible

**Operator Integration** (in `pr-build-validation.yml`):
- Kind cluster creation with image loading
- CRD and operator deployment
- Dashboard CR creation and reconciliation
- Health check verification in-cluster

**Missing**:
- No Trivy/Snyk/Grype container scanning
- No SBOM generation
- No image signing/attestation

### Security

**Present**:
- Gitleaks configuration (`.gitleaks.toml`) with test exclusions
- Semgrep rules (1875 lines) covering OWASP categories
- Security agent rule (`.claude/rules/security.md`) for auth, secrets, input validation
- `.gitleaksignore` for known false positives
- Dependency validation workflow (npm audit on changed lockfiles)
- Dependabot auto-merge workflow with security patch support

**Missing from CI**:
- No Trivy/Snyk container scanning workflow
- No CodeQL SAST workflow
- No Semgrep CI workflow (rules exist but aren't run)
- No gitleaks CI workflow (config exists but isn't run)
- Security scanning likely deferred to Tekton/Konflux (`.tekton/` directory present)

### Agent Rules (Agentic Flow Quality)

**Status**: Gold standard — the most comprehensive agent rules setup observed

**Coverage (22 rules in `.claude/rules/`)**:

| Rule Category | Rules | Coverage |
|---------------|-------|----------|
| Testing | `unit-tests.md`, `cypress-mock.md`, `cypress-e2e.md`, `contract-tests.md`, `testing-standards.md` | All 4 test types + cross-cutting standards |
| Architecture | `architecture.md`, `modular-architecture.md`, `module-federation.md`, `module-onboarding.md`, `distributions.md` | Complete monorepo guidance |
| Development | `conventions.md`, `react.md`, `css-patternfly.md`, `bff-go.md`, `third-party-theming.md` | Framework-specific patterns |
| Security | `security.md` | Auth, secrets, input validation, K8s API |
| Workflow | `pull-requests.md`, `jira-creation.md`, `operator-controller.md`, `prototype-fork-ops.md` | PR creation, issue management |

**Custom Skills (25 in `.claude/skills/`)**:
- Development: `dev-workflow`, `module-onboarding`, `konflux-onboarding`
- Review: `coderabbit-code-review`, `coderabbit-autofix`, `rbac-review`, `style-review`, `preflight`
- Documentation: `docs-create`, `docs-update`, `docs-create-package`
- Jira: `jira-triage`, `jira-assign-scrum-team`, `jira-evaluate-blockers`, `jira-validate-*` (4 validators)
- Prototyping: `prototype-spec`, `prototype-tickets`
- Infrastructure: `ci-flake-classifier`, `upstream-sync`, `upstream-sync-status`

**Unique Strengths**:
- Package-level AGENTS.md files (autorag, automl, agent-ops, eval-hub, maas, mlflow, core-bff, dashboard-operator)
- Claude AI preflight workflow that runs automatically on PRs
- CodeRabbit with assertive review profile and monorepo-aware path instructions
- Testing standards rule that provides clear decision matrix for test type selection
- Contract test rule with detailed central framework guidelines

### Build Integration (Konflux Simulation)

**This is the standout dimension.** The `pr-build-validation.yml` workflow (38KB) implements a comprehensive PR-time Konflux simulation:

**Phase 0 — Hermetic Preflight**:
- Validates `package-lock.json` for Hermeto/Cachi2 compatibility (no `git+`, `github:`, or `file:` protocols)
- Verifies all dependencies have resolved URLs
- Tests hermetic npm install via Docker multi-stage build

**Phase 1 — Docker Builds**:
- Builds in both ODH and RHOAI modes
- Full multi-stage production Dockerfile
- Saves images as artifacts for downstream validation

**Phase 2-3 — Runtime Validation**:
- Extracts and validates built artifacts (HTML, favicon, logos)
- Branding correctness checks per mode
- Container startup and health probe validation
- Module Federation module accessibility

**Phase 4 — Operator Integration**:
- Creates Kind cluster
- Loads built image
- Deploys CRDs and operator
- Creates Dashboard CR and validates reconciliation

**Additional Build Validation**:
- `validate-kustomize.yml`: Builds both RHOAI and ODH Kustomize overlays
- `modular-arch-quality-gates.yml`: Per-module quality validation for changed packages
- `dependency-validation.yml`: npm audit on changed lockfiles

## Recommendations

### Priority 0 (Critical)

1. **Add container vulnerability scanning to PR workflow** — Implement Trivy scanning in `pr-build-validation.yml` after Docker build steps. The images are already built and available as artifacts; scanning them adds minimal overhead.

2. **Wire semgrep.yaml into a GitHub Actions workflow** — The 1875-rule configuration already exists; creating a workflow to run it is a 1-2 hour task that immediately activates Go, TypeScript, Python, YAML, and generic secrets scanning.

### Priority 1 (High Value)

3. **Enforce coverage thresholds** — Switch `.codecov.yml` from `informational: true` to `informational: false` with a 65% project target. This prevents coverage regression without being overly restrictive.

4. **Add CodeQL SAST scanning** — As a GitHub-native solution, CodeQL requires minimal setup and provides deep semantic analysis for TypeScript and Go. Complements the pattern-based Semgrep rules.

5. **Add performance regression testing** — The modular architecture quality gates workflow has a TODO for API performance testing. Dashboard load time and API response time baselines would catch regressions from Module Federation changes.

### Priority 2 (Nice-to-Have)

6. **Expand accessibility testing** — `cypress-axe` is installed but coverage is unclear. Add systematic axe-core checks to Cypress mock tests for PatternFly components.

7. **Add Storybook** — For a complex UI with PatternFly v6 components and Module Federation, Storybook would provide component documentation and visual regression testing.

8. **Image signing and SBOM** — Add cosign signing and Syft SBOM generation to complement the Tekton/Konflux pipeline. This is likely already handled in Tekton but could be validated at PR time.

## Comparison to Gold Standards

| Dimension | odh-dashboard | notebooks | kserve | K8s Best Practice |
|-----------|:----:|:----:|:----:|:----:|
| Unit Tests | ✅ 908 files, Jest+RTL | ⚪ Minimal | ✅ Go testing | ✅ Comprehensive |
| Integration/E2E | ✅ Multi-layer Cypress | ⚪ Image boot | ✅ envtest + E2E | ✅ envtest + E2E |
| Build Integration | ✅✅ Konflux sim | ⚪ Image build only | ⚪ Basic | ⚪ Basic |
| Contract Tests | ✅ 8 BFF packages | ❌ None | ❌ None | ⚪ Rare |
| Image Testing | ✅ Runtime validation | ✅✅ 5-layer | ⚪ Basic | ⚪ Basic |
| Coverage Tracking | ⚪ Informational | ❌ None | ✅ Enforced | ✅ Enforced |
| Security Scanning | ⚪ Config exists, not in CI | ⚪ Minimal | ⚪ Basic | ✅ Trivy + CodeQL |
| Agent Rules | ✅✅ 22 rules, 25 skills | ❌ None | ❌ None | ❌ None |
| CI/CD | ✅✅ 26 workflows | ✅ Well-organized | ✅ Strong | ✅ Strong |

**Legend**: ✅✅ = Gold standard, ✅ = Strong, ⚪ = Adequate, ❌ = Missing

**odh-dashboard sets the gold standard for**:
- Build Integration (Konflux simulation)
- Agent Rules (22 rules + 25 skills)
- CI/CD breadth and sophistication
- Contract testing in a frontend monorepo

## File Paths Reference

### CI/CD
- `.github/workflows/test.yml` — Core test pipeline (type-check, lint, unit tests, Cypress mock)
- `.github/workflows/pr-build-validation.yml` — Konflux build simulation (38KB, 4 phases)
- `.github/workflows/cypress-e2e-test.yml` — Live cluster E2E with failover
- `.github/workflows/modular-arch-quality-gates.yml` — Module architecture validation
- `.github/workflows/validate-kustomize.yml` — Kustomize manifest validation
- `.github/workflows/dependency-validation.yml` — npm audit on lockfile changes
- `.github/workflows/claude-preflight.yml` — Claude AI preflight on PRs
- `.tekton/` — 22 Tekton pipeline definitions for Konflux

### Testing
- `packages/cypress/` — Cypress test framework (mock + E2E)
- `packages/contract-tests/` — Central contract testing framework
- `packages/jest-config/` — Shared Jest configuration and custom matchers
- `frontend/src/__mocks__/` — Shared mock data factories
- `packages/*/contract-tests/__tests__/` — Per-package contract tests (8 packages)
- `packages/*/bff/` — Go BFF code with tests (233 test files across 8 packages)
- `dashboard-operator/` — Go operator with 8 test files

### Code Quality
- `.eslintrc.js` — Root ESLint config (delegates to `@odh-dashboard/eslint-config`)
- `.prettierrc` — Prettier config
- `.husky/pre-commit` — Husky pre-commit hook with lint-staged and port validation
- `turbo.jsonc` — Turbo monorepo task configuration

### Security
- `semgrep.yaml` — 1875 lines of SAST rules (Go, Python, TS, YAML, generic)
- `.gitleaks.toml` — Secret detection configuration
- `.gitleaksignore` — Known false positive exclusions

### Coverage
- `.codecov.yml` — Codecov configuration (informational mode, 70% patch target)
- `scripts/unit-test-coverage-aggregator.js` — Cross-package coverage aggregation

### Agent Rules
- `AGENTS.md` — Comprehensive monorepo documentation for AI agents
- `.claude/rules/` — 22 specialized rules (testing, architecture, security, workflows)
- `.claude/skills/` — 25 custom skills (review, docs, Jira, CI, prototyping)
- `.claude/commands/` — 3 slash commands (docs-create, docs-update, create-package-doc)
- `.coderabbit.yaml` — CodeRabbit assertive review with monorepo-aware instructions

### Container
- `Dockerfile` — Main multi-stage production Dockerfile (UBI9 base)
- `packages/*/Dockerfile` — Per-package Dockerfiles (14+ packages)
- `distributions/*/Dockerfile` — Distribution-specific Dockerfiles
- `.dockerignore` — Docker build exclusions
