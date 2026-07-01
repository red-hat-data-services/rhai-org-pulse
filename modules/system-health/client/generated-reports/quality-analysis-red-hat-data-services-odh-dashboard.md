---
repository: "red-hat-data-services/odh-dashboard"
overall_score: 9.2
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "891 test files across frontend/backend/packages with Jest + coverage upload to Codecov"
  - dimension: "Integration/E2E"
    score: 9.5
    status: "181 Cypress mock tests, 23 E2E test groups with cluster failover, contract tests for BFF APIs"
  - dimension: "Build Integration"
    score: 9.5
    status: "PR-time Konflux simulator with hermetic build testing, kustomize validation, workspace COPY verification"
  - dimension: "Image Testing"
    score: 8.5
    status: "13 Dockerfiles including Konflux and Sealights variants, multi-arch support, but no runtime validation"
  - dimension: "Coverage Tracking"
    score: 8.5
    status: "Codecov integration with merged unit+Cypress coverage, 70% patch target (informational mode)"
  - dimension: "CI/CD Automation"
    score: 9.5
    status: "26 workflows with concurrency control, turbo caching, matrix strategies, and path-filtered triggers"
  - dimension: "Agent Rules"
    score: 10.0
    status: "20 agent rules covering all test types, 23 custom skills, AGENTS.md with full architecture guidance"
critical_gaps:
  - title: "Coverage enforcement is informational only"
    impact: "Coverage regressions can merge without blocking; the 70% patch target is advisory"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No container runtime validation in CI"
    impact: "Image startup failures or misconfiguration not caught until deployment"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No SAST/CodeQL workflow in GitHub Actions"
    impact: "Static application security testing relies solely on semgrep rules (1875 lines) but no automated SAST pipeline"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No Trivy/Snyk container scanning in CI"
    impact: "Container image vulnerabilities not caught until Konflux/production scanning"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Switch Codecov patch coverage from informational to blocking"
    effort: "30 minutes"
    impact: "Prevents coverage regressions from merging; enforces 70% threshold"
  - title: "Add CodeQL or Semgrep CI workflow"
    effort: "1-2 hours"
    impact: "Automated SAST scanning on every PR, complementing the existing semgrep rules"
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Early detection of container image CVEs before Konflux"
  - title: "Add image smoke test to PR build validation"
    effort: "2-3 hours"
    impact: "Validates container starts and serves healthcheck endpoint"
recommendations:
  priority_0:
    - "Enforce Codecov coverage thresholds (change informational to required) to prevent silent coverage decay"
    - "Add container image vulnerability scanning (Trivy) to PR workflow for early CVE detection"
  priority_1:
    - "Add CodeQL/Semgrep automated SAST workflow alongside the existing semgrep.yaml rules"
    - "Add container runtime smoke test (health check, port binding) to PR Build Validation workflow"
    - "Enable the disabled quality gate checks (Mock Tests, Contract Testing, Bundle Size) in modular-arch-quality-gates.yml"
  priority_2:
    - "Add performance regression testing for API endpoints and frontend bundle size tracking"
    - "Add accessibility testing (axe-core) to Cypress test suite"
    - "Implement visual regression testing for UI components"
---

# Quality Analysis: odh-dashboard (red-hat-data-services/odh-dashboard)

## Executive Summary

- **Overall Score: 9.2/10**
- **Repository Type**: TypeScript/React monorepo with Go BFFs and a Kubernetes operator
- **Primary Technologies**: React 18, TypeScript, PatternFly v6, Go, Cypress, Jest, Turbo
- **Monorepo Structure**: 29 packages + frontend + backend + dashboard-operator + distributions
- **Agent Rules Status**: Exemplary - 20 rules, 23 skills, comprehensive AGENTS.md

The odh-dashboard repository represents a **gold-standard** for quality practices in the OpenShift AI ecosystem. It features multi-layer testing (unit, mock Cypress, E2E with live clusters, contract tests), a Konflux build simulator for PR-time validation, comprehensive agent rules for AI-assisted development, and sophisticated CI/CD automation with 26 workflows. The few gaps are largely in the container security scanning and coverage enforcement areas.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 9.0/10 | 891 test files, Jest + coverage, turbo parallelization |
| Integration/E2E | 9.5/10 | 181 mock Cypress + 23 E2E groups + contract tests + cluster failover |
| **Build Integration** | **9.5/10** | **PR-time Konflux simulator, hermetic build testing, kustomize validation** |
| Image Testing | 8.5/10 | 13 Dockerfiles, multi-arch, but no runtime validation |
| Coverage Tracking | 8.5/10 | Codecov with merged coverage, but informational-only enforcement |
| CI/CD Automation | 9.5/10 | 26 workflows, concurrency control, turbo caching, matrix strategies |
| Agent Rules | 10.0/10 | 20 rules, 23 skills, comprehensive architecture guidance |

## Critical Gaps

### 1. Coverage Enforcement is Informational Only
- **Impact**: Coverage regressions can merge without blocking the PR
- **Severity**: MEDIUM
- **Effort**: 30 minutes
- **Details**: The `.codecov.yml` sets both `project` and `patch` status to `informational: true` with a 70% patch target. This means Codecov reports coverage but does not block merges when coverage drops.
- **Fix**: Change `informational: true` to `informational: false` for the `patch` status

### 2. No Container Runtime Validation
- **Impact**: Image startup failures or misconfiguration not caught until deployment
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: While the PR Build Validation workflow tests hermetic builds, it does not start the built container and validate it responds to health checks. The Dockerfile builds are verified but runtime behavior is not.

### 3. No Automated SAST Pipeline
- **Impact**: 1875-line semgrep.yaml exists but no CI workflow runs it automatically
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: The repository has an extensive `semgrep.yaml` configuration covering Go, TypeScript, Python, YAML, and generic secrets detection, but there is no GitHub Actions workflow that runs Semgrep on PRs. The rules need a workflow to be executed.

### 4. No Container Image Vulnerability Scanning
- **Impact**: Image CVEs discovered only at Konflux stage, not during PR review
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: Despite having gitleaks for secret detection, there is no Trivy, Snyk, or Grype scanning workflow for container images.

## Quick Wins

### 1. Enforce Codecov Patch Coverage (30 minutes)
Change `.codecov.yml`:
```yaml
patch:
  default:
    informational: false  # was: true
    target: 70%
```

### 2. Add Semgrep CI Workflow (1-2 hours)
Create `.github/workflows/semgrep.yml` to run the existing 1875-line semgrep rules on PRs:
```yaml
name: Semgrep SAST
on: [pull_request]
jobs:
  semgrep:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: semgrep/semgrep-action@v1
        with:
          config: semgrep.yaml
```

### 3. Add Trivy Container Scanning (1-2 hours)
Add a Trivy scan step to the PR Build Validation workflow after the Docker build:
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'odh-dashboard:pr-test'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'
```

### 4. Add Container Smoke Test (2-3 hours)
Add a step to PR Build Validation that starts the built container and validates health:
```yaml
- name: Container smoke test
  run: |
    docker run -d --name smoke-test -p 8080:8080 odh-dashboard:pr-test
    sleep 5
    curl -f http://localhost:8080/api/health || exit 1
    docker stop smoke-test
```

## Detailed Findings

### CI/CD Pipeline

**Score: 9.5/10** - Exceptional

The repository has 26 GitHub Actions workflows with sophisticated automation:

**PR-Triggered Workflows (13)**:
- `test.yml` - Main test pipeline (lint, type-check, unit tests, contract tests, Cypress mock tests, coverage upload)
- `pr-build-validation.yml` - Konflux build simulator with hermetic build testing
- `validate-kustomize.yml` - Kustomize manifest validation (RHOAI + ODH)
- `dependency-validation.yml` - npm audit with base comparison (blocks new vulnerabilities)
- `modular-arch-quality-gates.yml` - Per-module testing maturity assessment
- 8 BFF/module-specific test workflows (automl, autorag, core, eval-hub, gen-ai, maas, mlflow, model-registry)

**Periodic/Dispatch Workflows (6)**:
- `agentready-weekly.yml` - Weekly agent readiness assessment
- `cypress-e2e-test.yml` - E2E tests with cluster failover (dash-e2e-int primary, dash-e2e secondary)
- `release-auto-merge.yml` - Sync main to ODH/RHOAI release branches
- `release-odh-dashboard.yml` - Release automation
- `stale.yml` - Stale issue/PR management
- `pr-image-expiry.yml` - PR image cleanup

**Key Strengths**:
- Concurrency control on all PR workflows (`cancel-in-progress: true`)
- Turbo caching for build and test parallelization
- Dynamic test group discovery for Cypress (matrix strategy)
- Path-filtered triggers (only run relevant tests for changed code)
- npm audit comparison between base and head (blocks new vulnerabilities)
- Module federation port validation on every commit
- Tekton pipelines (22 files) for Konflux CI/CD

### Test Coverage

**Score: 9.0/10** - Excellent

**Unit Tests (331 frontend + 10 backend + 543 packages = 884 total)**:
- Framework: Jest with TypeScript
- Test-to-code ratio: 0.19 (891 test files / 4569 source files)
- Coverage: Generated via `test-unit-coverage` with nyc aggregation
- Organization: `__tests__` directories co-located with source

**Cypress Mock Tests (181 .cy.ts files, 25 test groups)**:
- Framework: Cypress with TypeScript
- Coverage: Istanbul instrumentation with `cypress:server:build:coverage`
- Parallel execution: Dynamic matrix strategy based on test directory discovery
- Groups: applications, clusterSettings, connectionTypes, customServingRuntimes, distributedWorkloads, featureStore, hardwareProfiles, home, modelRegistry, modelServing, modelTraining, pipelines, projects, and more

**Cypress E2E Tests (23 test groups)**:
- Run against live clusters with failover (primary: dash-e2e-int, secondary: dash-e2e)
- Smart test selection via PR labels (`test:*`), auto-detection from turbo, and manual override
- BFF support: auto-starts backend-for-frontend services for packages with `bffConfig.enabled`
- Tags: `@ci-dashboard-regression-tags` always runs, plus package-specific tags

**Contract Tests (23 files)**:
- Framework: Custom schema validation + OpenAPI validation
- Scope: BFF API contracts (model-registry, gen-ai, mlflow, core-bff)
- Features: Schema conversion, HTML report generation, Go BFF consumer testing
- Runs sequentially via turbo (`--concurrency=1`)

**Dashboard Operator Tests (8 Go test files / 10 source files)**:
- Framework: Go testing with envtest (controller-runtime)
- Coverage: Reconciler tests, webhook tests, action tests, config tests, module tests
- Excellent ratio: 8 test files for 10 source files (0.8 ratio)

### Code Quality

**Score: 9.0/10** - Excellent

**Linting**:
- ESLint: Custom configuration with shared packages (`@odh-dashboard/eslint-config`, `@odh-dashboard/eslint-plugin`)
- Prettier: Configured via `.prettierrc`
- TypeScript: Strict type checking via `npm run type-check` (turbo)
- Go: `golangci-lint` for dashboard-operator and BFF packages

**Pre-commit Hooks**:
- Husky pre-commit hook with lint-staged
- Module federation port validation on package.json changes
- Detailed error messages with fix instructions
- Skip/force override mechanisms (`SKIP_LINT_HOOK`, `FORCE_LINT_HOOK`)

**Static Analysis**:
- Semgrep: 1875-line unified configuration covering Go, TypeScript, Python, YAML, and generic secrets
- Gitleaks: Configured with comprehensive allowlists for test files and known test credentials
- CodeRabbit: "Assertive" profile with detailed path-specific review instructions
- Dependency validation: npm audit with base comparison on PRs

### Build Integration

**Score: 9.5/10** - Exceptional

**PR Build Validation (Konflux Simulator)** - This is a standout feature:
1. **Phase 0: Hermetic Build Preflight**
   - Validates lockfile for Hermeto/Cachi2 compatibility
   - Tests hermetic npm install (offline mode in Docker)
   - Validates workspace dependencies vs Dockerfile COPY statements
   
2. **Phase 1: Multi-Variant Docker Build**
   - Builds multiple Dockerfile variants (Konflux, Sealights, dashboard-operator)
   - Tests both RHOAI and ODH build modes
   - Validates all distribution builds

3. **Kustomize Validation**
   - Validates manifests for both RHOAI and ODH overlays
   - Pinned kustomize version with caching

4. **Modular Architecture Quality Gates**
   - Per-module testing maturity assessment
   - Checks for unit tests, E2E tests, mock tests, contract tests
   - RHOAI quality threshold (75%)

### Container Images

**Score: 8.5/10** - Strong

**Dockerfiles (13 total)**:
- `Dockerfile` - Main development build
- `Dockerfile.konflux` - RHOAI Konflux build (hermetic)
- `Dockerfile.konflux.{agent-ops,automl,autorag,core-bff,eval-hub,genai,maas,mlflow,modelregistry}` - Module-specific builds
- `Dockerfile.konflux.dashboard-operator` - Go operator build
- `Dockerfile.konflux.sealights` - Sealights instrumented build

**Build Features**:
- Multi-stage builds (builder → runtime)
- UBI9 base images (Red Hat certified)
- FIPS compliance (esbuild binary removal)
- Production dependency pruning
- Multi-architecture support via `docker buildx` (linux/s390x, linux/amd64, linux/ppc64le)

**Gaps**:
- No container image vulnerability scanning (Trivy/Snyk)
- No runtime validation (health check testing)
- No SBOM generation in CI

### Security

**Score: 8.0/10** - Strong

**Implemented**:
- Gitleaks configuration with comprehensive test file exclusions
- Semgrep rules (1875 lines) covering secrets, injection, XSS, SSRF, path traversal
- npm audit with base comparison (blocks new vulnerabilities)
- CodeRabbit security-focused review instructions
- Pin all GitHub Actions to commit SHAs (supply chain protection)
- Dependency validation workflow
- FIPS compliance in Docker builds

**Gaps**:
- No GitHub Actions workflow runs semgrep/CodeQL automatically
- No container image scanning (Trivy, Snyk, Grype)
- No SBOM generation
- No image signing/attestation

### Agent Rules (Agentic Flow Quality)

**Score: 10.0/10** - Gold Standard

This is the most comprehensive agent rules setup in the ecosystem.

**AGENTS.md / CLAUDE.md** (11,204 bytes):
- Full repository structure documentation
- Development requirements and key technologies
- Common commands reference
- Architecture guidance for the monorepo

**Agent Rules (20 files in `.claude/rules/`)**:
| Rule | Purpose |
|------|---------|
| `unit-tests.md` (16,767 bytes) | Comprehensive unit test patterns with Jest |
| `cypress-mock.md` (39,396 bytes) | Exhaustive Cypress mock test guide |
| `cypress-e2e.md` (23,697 bytes) | E2E test patterns and infrastructure |
| `contract-tests.md` (27,578 bytes) | BFF API contract testing guide |
| `react.md` (14,448 bytes) | React component patterns |
| `jira-creation.md` (20,911 bytes) | Jira issue creation standards |
| `architecture.md` (6,390 bytes) | Monorepo architecture guide |
| `bff-go.md` (6,113 bytes) | Go BFF development patterns |
| `operator-controller.md` (9,556 bytes) | Dashboard operator testing |
| `module-federation.md` (5,316 bytes) | Module federation patterns |
| `modular-architecture.md` (5,540 bytes) | Modular architecture guide |
| `module-onboarding.md` (8,046 bytes) | New module onboarding |
| `distributions.md` (5,034 bytes) | Distribution build guide |
| `css-patternfly.md` (7,794 bytes) | CSS and PatternFly patterns |
| `conventions.md` (3,988 bytes) | Code conventions |
| `security.md` (2,574 bytes) | Security guidelines |
| `testing-standards.md` (3,172 bytes) | Testing standards overview |
| `pull-requests.md` (1,222 bytes) | PR guidelines |
| `third-party-theming.md` (3,290 bytes) | Theming guide |

**Custom Skills (23 in `.claude/skills/`)**:
- `preflight` - Pre-flight checks before commits
- `upstream-sync` / `upstream-sync-status` - Upstream synchronization
- `style-review` - Style review automation
- `rbac-review` - RBAC configuration review
- `module-onboarding` - Module onboarding automation
- `jira-triage` / `jira-assign-scrum-team` / `jira-evaluate-blockers` - Jira workflow automation
- `konflux-onboarding` - Konflux CI onboarding
- `ci-flake-classifier` - CI flake detection
- `coderabbit-autofix` / `coderabbit-code-review` / `coderabbit-review` - CodeRabbit integration
- `dev-workflow` - Development workflow automation
- `docs-create` / `docs-create-package` / `docs-update` - Documentation automation
- And more...

**Additional AI Tooling**:
- `.coderabbit.yaml` - CodeRabbit configuration with assertive review profile
- `.cursor/` directory - Cursor IDE configuration
- `constitution.md` - AI agent behavior constitution
- `claude-preflight.yml` - Claude agent preflight workflow

## Recommendations

### Priority 0 (Critical)
1. **Enforce Codecov coverage thresholds** - Change `informational: true` to `false` for patch coverage to prevent silent coverage decay (30 minutes)
2. **Add container vulnerability scanning** - Add Trivy scanning to PR Build Validation workflow (2-3 hours)

### Priority 1 (High Value)
3. **Add SAST CI workflow** - Create a workflow to run the existing 1875-line semgrep rules on PRs (1-2 hours)
4. **Add container runtime smoke test** - Validate built images start and serve health endpoint (2-3 hours)
5. **Enable disabled quality gates** - Activate Mock Tests, Contract Testing, Bundle Size checks in `modular-arch-quality-gates.yml` (4-8 hours)
6. **Add SBOM generation** - Add Syft/Trivy SBOM generation to Konflux builds (2-3 hours)

### Priority 2 (Nice-to-Have)
7. **Add accessibility testing** - Integrate axe-core into Cypress test suite (4-8 hours)
8. **Add visual regression testing** - Implement screenshot comparison for UI components (8-16 hours)
9. **Add API performance regression testing** - Track BFF response times over time (8-16 hours)
10. **Add bundle size tracking** - Track frontend bundle size regressions per PR (2-4 hours)

## Comparison to Gold Standards

| Dimension | odh-dashboard | notebooks | kserve | Industry Best |
|-----------|:---:|:---:|:---:|:---:|
| Unit Tests | 9.0 | 6.0 | 8.0 | 9.0 |
| Integration/E2E | 9.5 | 7.0 | 8.0 | 9.0 |
| Build Integration | 9.5 | 6.0 | 5.0 | 8.0 |
| Image Testing | 8.5 | 9.0 | 6.0 | 9.0 |
| Coverage Tracking | 8.5 | 5.0 | 8.0 | 9.0 |
| CI/CD Automation | 9.5 | 7.0 | 8.0 | 9.0 |
| Agent Rules | 10.0 | 2.0 | 3.0 | 7.0 |
| **Overall** | **9.2** | **6.0** | **6.7** | **8.7** |

odh-dashboard **exceeds** the industry best practice in several dimensions, particularly in Build Integration (Konflux simulator) and Agent Rules. It **sets the gold standard** for AI-assisted development practices and PR-time build validation in the OpenShift AI ecosystem.

## File Paths Reference

### CI/CD
- `.github/workflows/test.yml` - Main test pipeline
- `.github/workflows/pr-build-validation.yml` - Konflux build simulator
- `.github/workflows/cypress-e2e-test.yml` - E2E tests with cluster failover
- `.github/workflows/modular-arch-quality-gates.yml` - Module quality gates
- `.github/workflows/validate-kustomize.yml` - Manifest validation
- `.github/workflows/dependency-validation.yml` - npm audit comparison
- `.github/workflows/dashboard-operator-tests.yml` - Operator tests
- `.github/workflows/{automl,autorag,core,eval-hub,gen-ai,maas,mlflow,model-registry}-bff-tests.yml` - BFF tests
- `.tekton/` - 22 Tekton pipeline configurations

### Testing
- `frontend/src/` - 331 unit test files (Jest)
- `backend/src/__tests__/` - 10 backend test files
- `packages/*/` - 543 package test files
- `packages/cypress/cypress/tests/mocked/` - 25 mock test groups (181 .cy.ts files)
- `packages/cypress/cypress/tests/e2e/` - 23 E2E test groups
- `packages/contract-tests/` - Contract test framework (23 files)
- `dashboard-operator/` - 8 Go test files (envtest)

### Code Quality
- `.eslintrc.js` - ESLint configuration
- `.prettierrc` - Prettier configuration
- `.husky/pre-commit` - Pre-commit hooks with lint-staged
- `semgrep.yaml` - 1875-line Semgrep rules
- `.gitleaks.toml` - Gitleaks configuration
- `.coderabbit.yaml` - CodeRabbit review configuration
- `turbo.jsonc` - Turbo monorepo configuration

### Container Images
- `Dockerfile` - Main development build
- `Dockerfile.konflux` - RHOAI Konflux build
- `Dockerfile.konflux.*` - 11 module-specific Konflux builds
- `.dockerignore` - Docker build exclusions

### Coverage
- `.codecov.yml` - Codecov configuration (informational mode)

### Agent Rules
- `AGENTS.md` / `CLAUDE.md` - Repository documentation for AI agents
- `.claude/rules/` - 20 agent rule files
- `.claude/skills/` - 23 custom Claude skills
- `.claude/commands/` - 3 custom Claude commands
- `constitution.md` - AI agent behavior constitution
