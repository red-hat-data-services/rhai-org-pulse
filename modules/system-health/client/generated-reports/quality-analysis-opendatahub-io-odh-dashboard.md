---
repository: "opendatahub-io/odh-dashboard"
overall_score: 9.1
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "891 test files across Jest + RTL with comprehensive coverage generation and aggregation"
  - dimension: "Integration/E2E"
    score: 9.5
    status: "181 Cypress tests (90 E2E + 91 mocked), live-cluster E2E with failover, contract tests, smart test selection"
  - dimension: "Build Integration"
    score: 9.5
    status: "PR-time Konflux simulator with 4-phase validation, hermetic build testing, dual-mode (ODH/RHOAI), runtime + Module Federation artifact validation"
  - dimension: "Image Testing"
    score: 8.5
    status: "Multi-stage Docker builds validated at PR time, branding verification, runtime startup validation, but no Trivy/Snyk scanning in CI"
  - dimension: "Coverage Tracking"
    score: 8.5
    status: "Codecov integration with merged unit+Cypress coverage, 70% patch target (informational), combined coverage report generation"
  - dimension: "CI/CD Automation"
    score: 9.5
    status: "27 workflows, path-filtered per-package triggers, concurrency control, turbo caching, dynamic test group discovery, modular quality gates"
  - dimension: "Agent Rules"
    score: 10.0
    status: "20 specialized rules, 23 custom skills, comprehensive AGENTS.md, full test type coverage with actionable guidance"
critical_gaps:
  - title: "No container vulnerability scanning (Trivy/Snyk) in PR or periodic CI"
    impact: "Vulnerabilities in base images or dependencies not detected until downstream Konflux pipeline"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No CodeQL/SAST scanning workflow"
    impact: "Static security analysis gaps — relying solely on gitleaks for secret detection"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "Coverage enforcement is informational only"
    impact: "Coverage regressions not blocked — threshold set to informational mode"
    severity: "LOW"
    effort: "1 hour"
quick_wins:
  - title: "Add Trivy container scanning to PR workflow"
    effort: "2-3 hours"
    impact: "Catch CVEs in base images and dependencies before merge"
  - title: "Enable CodeQL analysis workflow"
    effort: "1-2 hours"
    impact: "Automated SAST for TypeScript and Go code paths"
  - title: "Switch Codecov status from informational to enforced"
    effort: "30 minutes"
    impact: "Prevent coverage regressions from merging"
recommendations:
  priority_0:
    - "Add Trivy or Snyk container vulnerability scanning to the PR build validation workflow"
    - "Enable CodeQL or Semgrep SAST scanning for TypeScript and Go code"
  priority_1:
    - "Switch Codecov patch and project status from informational to enforced with appropriate thresholds"
    - "Add SBOM generation to container image builds"
  priority_2:
    - "Add multi-architecture (amd64/arm64) build validation to the Konflux simulator"
    - "Add performance regression testing for frontend bundle size tracking"
---

# Quality Analysis: odh-dashboard

## Executive Summary

- **Overall Score: 9.1/10**
- **Repository Type**: TypeScript/React monorepo + Go operator + Go BFFs
- **Key Strengths**: Industry-leading CI/CD automation, multi-layer testing pyramid, PR-time Konflux build simulation, exceptional agent rules ecosystem
- **Critical Gaps**: No container vulnerability scanning, no SAST/CodeQL integration
- **Agent Rules Status**: **Exemplary** — 20 specialized rules, 23 custom skills, comprehensive coverage of all test types

odh-dashboard is a **gold standard** repository for quality practices in the OpenShift AI ecosystem. It demonstrates exceptional test infrastructure across unit, mock, E2E, and contract testing layers. The PR Build Validation workflow simulates Konflux hermetic builds at PR time — a capability that most projects lack entirely. The agent rules ecosystem is the most comprehensive found in any analyzed repository.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 9.0/10 | 891 test files across Jest + RTL with comprehensive coverage |
| Integration/E2E | 9.5/10 | 181 Cypress tests, live-cluster E2E with failover, contract tests |
| **Build Integration** | **9.5/10** | **PR-time Konflux simulator, hermetic build testing, dual-mode validation** |
| Image Testing | 8.5/10 | Multi-stage builds validated at PR time, but no vulnerability scanning |
| Coverage Tracking | 8.5/10 | Codecov with merged unit+Cypress coverage, informational mode |
| CI/CD Automation | 9.5/10 | 27 workflows, path-filtered triggers, turbo caching, dynamic matrix |
| Agent Rules | 10.0/10 | 20 rules, 23 skills, AGENTS.md, full test type coverage |

## Critical Gaps

1. **No container vulnerability scanning in CI**
   - Impact: CVEs in base images (UBI9) and npm/Go dependencies not caught until downstream Konflux pipelines
   - Severity: MEDIUM
   - Effort: 2-4 hours
   - Note: Gitleaks covers secret detection but not CVE scanning

2. **No CodeQL/SAST scanning workflow**
   - Impact: No automated static security analysis for TypeScript or Go code
   - Severity: MEDIUM
   - Effort: 2-3 hours
   - Note: ESLint covers code quality but not security-specific patterns

3. **Coverage enforcement is informational only**
   - Impact: PRs can merge with coverage regressions; 70% patch target exists but doesn't block
   - Severity: LOW
   - Effort: 1 hour (change `informational: true` to `false` in `.codecov.yml`)

## Quick Wins

1. **Add Trivy container scanning to PR build validation**
   - Effort: 2-3 hours
   - Impact: Detect CVEs before merge, leveraging images already built by `pr-build-validation.yml`
   - Implementation: Add `aquasecurity/trivy-action` step after Docker builds

2. **Enable CodeQL analysis**
   - Effort: 1-2 hours
   - Impact: Automated SAST for TypeScript and Go code
   - Implementation: Add `.github/workflows/codeql.yml` with JavaScript/TypeScript and Go language matrix

3. **Switch Codecov to enforced mode**
   - Effort: 30 minutes
   - Impact: Block PRs that reduce coverage below threshold
   - Implementation: Change `informational: true` to `informational: false` in `.codecov.yml`

## Detailed Findings

### CI/CD Pipeline

**Score: 9.5/10** — Exceptional automation with 27 workflows.

**Workflow Inventory (27 total)**:

| Category | Workflows | Trigger |
|----------|-----------|---------|
| Core Testing | `test.yml` | push + PR |
| Per-Package BFF Tests | `automl-bff-tests.yml`, `autorag-bff-tests.yml`, `core-bff-build.yml`, `eval-hub-bff-tests.yml`, `gen-ai-bff-build.yml`, `maas-bff-tests.yml`, `mlflow-bff-tests.yml`, `model-registry-bff-tests.yml` | Path-filtered PR |
| Per-Package Frontend Tests | `eval-hub-frontend-tests.yml`, `gen-ai-frontend-build.yml`, `model-registry-frontend-tests.yml` | Path-filtered PR |
| E2E Tests | `cypress-e2e-test.yml` | After `Test` completes on PR |
| Build Validation | `pr-build-validation.yml` (Konflux Simulator) | PR to main |
| Manifest Validation | `validate-kustomize.yml` | Push/PR on `manifests/**` |
| Operator | `dashboard-operator-tests.yml` | Path-filtered PR |
| Quality Gates | `modular-arch-quality-gates.yml` | PR on `packages/**` |
| Dependency | `dependency-validation.yml`, `dependabot-auto-merge.yml` | PR |
| Agent/Claude | `claude-preflight.yml` | PR open/reopen |
| Release | `release-odh-dashboard.yml`, `release-auto-merge.yml` | Dispatch |
| Maintenance | `stale.yml`, `pr-image-expiry.yml`, `audit-bypass-notice.yml`, `agentready-weekly.yml` | Schedule/PR |

**Strengths**:
- **Concurrency control**: All major workflows use `cancel-in-progress: true`
- **Caching**: Turbo cache + Node module cache + Cypress build cache
- **Path filtering**: Package-specific workflows only run when relevant files change
- **Dynamic test groups**: Cypress mock tests discover test groups dynamically at runtime
- **Smart E2E selection**: E2E workflow uses turbo change detection + PR labels + `e2eCiTags` in package.json
- **Cluster failover**: E2E tests have primary/secondary cluster health checking

### Test Coverage

**Score: 9.0/10 (Unit) + 9.5/10 (Integration/E2E)** — Comprehensive multi-layer testing.

**Test File Counts**:
- Unit/Component tests: **891 files** (486 `.spec.ts`, 366 `.spec.tsx`, 20 `.test.ts`, 19 `.test.tsx`)
- Cypress mock tests: **91 test files** (component/integration with mocked backends)
- Cypress E2E tests: **90 test files** (live cluster, 23 feature directories)
- Contract tests: **41 files** across model-registry, mlflow, gen-ai, core-bff
- Go operator tests: **8 test files** / 10 source files (80% test ratio)
- Source files (TS/TSX/JS): ~4,918

**Test-to-Code Ratio**: ~891/4918 = **18.1%** (strong for a frontend monorepo)

**Testing Frameworks**:
- Jest + React Testing Library (unit/component)
- Cypress 13+ (mock + E2E)
- Go `testing` + controller-runtime envtest (operator)
- Custom `@odh-dashboard/contract-tests` framework (API contract validation)

**Test Types Coverage**:

| Test Type | Present | Framework | Location |
|-----------|---------|-----------|----------|
| Unit Tests | Yes | Jest + RTL | `**/__tests__/*.spec.ts(x)` |
| Cypress Mock Tests | Yes | Cypress | `packages/cypress/cypress/tests/mocked/` + per-package |
| Cypress E2E Tests | Yes | Cypress | `packages/cypress/cypress/tests/e2e/` |
| Contract Tests | Yes | Custom framework | `packages/*/contract-tests/` |
| Operator Tests | Yes | Go testing + envtest | `dashboard-operator/**/*_test.go` |
| Helm Chart Validation | Yes | Helm lint | `dashboard-operator` workflow |

### Build Integration (Konflux Simulator)

**Score: 9.5/10** — Best-in-class PR-time build validation.

The `pr-build-validation.yml` workflow is a **4-phase Konflux simulator** that catches build failures before merge:

**Phase 0: Hermetic Build Preflight** (static checks):
- Validates `package-lock.json` for unsupported protocols (git+, github:, file:)
- Tests hermetic `npm ci --offline` in a Docker container (simulates Cachi2)
- Validates workspace dependencies match Dockerfile COPY instructions
- FIPS compliance check (esbuild binary removal)

**Phase 1: Docker Build Validation**:
- Builds images in both ODH and RHOAI modes
- Full multi-stage Dockerfile build (not just npm build)
- Images saved as artifacts for later phases

**Phase 2-3: Runtime & Module Federation Validation**:
- Loads built images and extracts artifacts
- Validates branding (ODH vs RHOAI) in built HTML
- Validates Module Federation artifacts (remoteEntry.js, webpack chunks)
- Checks favicon, logo, product name in both build modes

**Phase 4: Kustomize Manifest Validation** (separate workflow):
- Validates all Kustomize overlays build successfully
- Runs on manifest changes

### Container Image Testing

**Score: 8.5/10** — Strong build validation but no vulnerability scanning.

**Strengths**:
- Multi-stage Dockerfile (builder + runtime)
- UBI9 base image
- Dual-mode builds (ODH/RHOAI) validated at PR time
- Runtime startup validation (curl health probes configured)
- FIPS compliance checking (esbuild binary removal)
- Separate operator Dockerfile with Go multi-stage build

**Gaps**:
- No Trivy/Snyk/Grype vulnerability scanning in CI
- No SBOM generation
- No image signing/attestation at PR level (handled by Konflux downstream)
- No multi-architecture build validation (amd64/arm64)

### Code Quality

**Score: 9.0/10** — Strong linting ecosystem.

**Tools Configured**:
- **ESLint**: Custom shared config (`@odh-dashboard/eslint-config`) with React/TypeScript rules
- **Prettier**: Configured (`.prettierrc`) with single quotes, trailing commas
- **TypeScript**: Strict type checking via `npm run type-check` (turbo-managed)
- **Husky**: Pre-commit hook with lint-staged
- **Gitleaks**: Secret detection with comprehensive allowlist (`.gitleaks.toml`)
- **Go linting**: `make lint` in operator workflow

**Pre-commit Hook Features**:
- lint-staged on all staged files
- Module federation port uniqueness validation
- Skip/force override mechanisms
- Helpful error messages with fix instructions

**Missing**:
- No CodeQL/SAST workflow
- No Semgrep or gosec integration
- No dependency vulnerability scanning (Dependabot auto-merge exists but no periodic scan)

### Security

**Score: 7.5/10** — Good secret detection but gaps in SAST and container scanning.

**Present**:
- Gitleaks with comprehensive allowlist covering test files, fixtures, known test credentials
- FIPS compliance validation in Konflux simulator
- Security-specific agent rule (`.claude/rules/security.md`)
- `audit-bypass-notice.yml` — PR comments when `ok-to-skip-audit` label used

**Missing**:
- No CodeQL or Semgrep SAST scanning
- No Trivy/Snyk container vulnerability scanning
- No dependency vulnerability scanning workflow (only Dependabot auto-merge)

### Agent Rules (Agentic Flow Quality)

**Score: 10.0/10** — The most comprehensive agent rules ecosystem analyzed.

**AGENTS.md**: Detailed 11K document covering repository structure, development requirements, key technologies, package-specific guidelines, and comprehensive rule/skill index tables.

**20 Specialized Rules** (`.claude/rules/`):

| Category | Rules |
|----------|-------|
| Testing | `unit-tests.md`, `cypress-e2e.md`, `cypress-mock.md`, `contract-tests.md`, `testing-standards.md` |
| Architecture | `architecture.md`, `modular-architecture.md`, `module-federation.md`, `module-onboarding.md`, `distributions.md` |
| Code Quality | `conventions.md`, `css-patternfly.md`, `react.md`, `bff-go.md`, `operator-controller.md` |
| Process | `pull-requests.md`, `jira-creation.md`, `security.md`, `third-party-theming.md` |

**23 Custom Skills** (`.claude/skills/`):

| Category | Skills |
|----------|--------|
| Development | `dev-workflow`, `module-onboarding`, `upstream-sync`, `upstream-sync-status`, `konflux-onboarding` |
| Review | `style-review`, `rbac-review`, `coderabbit-code-review`, `coderabbit-review`, `coderabbit-autofix` |
| Documentation | `docs-create`, `docs-create-package`, `docs-update` |
| Jira | `jira-triage`, `jira-validate-priority-severity`, `jira-validate-description`, `jira-evaluate-blockers`, `jira-validate-issue-type`, `jira-validate-area-label`, `jira-assign-scrum-team`, `jira-eval-review` |
| CI/Ops | `ci-flake-classifier`, `preflight` |

**Why 10/10**:
- Every test type has its own dedicated rule with framework-specific guidance
- Rules use glob patterns for automatic activation when editing relevant files
- Cross-cutting `testing-standards.md` rule helps agents choose the right test type
- Skills automate complex multi-step workflows (triage, sync, review)
- `AGENTS.md` provides a structured index that agents can navigate
- Agent-powered CI (`claude-preflight.yml`) runs on PR open/reopen

### Tekton/Konflux Pipelines

**22 Tekton pipeline files** in `.tekton/`:
- Pull request + push pipelines for: dashboard, operator, and 8 modular architecture modules
- Each module has its own dedicated pipeline (agent-ops, automl, autorag, eval-hub, gen-ai, maas, mlflow, modular-architecture)

## Recommendations

### Priority 0 (Critical)

1. **Add container vulnerability scanning**
   - Add Trivy scanning step to `pr-build-validation.yml` after Docker builds
   - Scan both ODH and RHOAI images
   - Block on HIGH/CRITICAL CVEs
   ```yaml
   - name: Scan ODH image for vulnerabilities
     uses: aquasecurity/trivy-action@0.30.0
     with:
       image-ref: odh-dashboard:odh-test
       format: 'table'
       exit-code: '1'
       severity: 'HIGH,CRITICAL'
   ```

2. **Enable CodeQL SAST scanning**
   - Add CodeQL workflow for JavaScript/TypeScript and Go
   - Run on PR and weekly schedule
   ```yaml
   name: CodeQL Analysis
   on:
     pull_request:
     schedule:
       - cron: '0 6 * * 1'
   ```

### Priority 1 (High Value)

3. **Switch Codecov to enforced mode**
   - Change `.codecov.yml` to block PRs below threshold:
   ```yaml
   status:
     project:
       default:
         informational: false  # was: true
         target: auto
         threshold: 1%
     patch:
       default:
         informational: false  # was: true
         target: 70%
   ```

4. **Add SBOM generation to image builds**
   - Use Syft or Trivy to generate SBOM alongside image builds
   - Upload as build artifact for compliance

### Priority 2 (Nice-to-Have)

5. **Multi-architecture build validation** — Validate arm64 builds in the Konflux simulator
6. **Bundle size monitoring** — Track and enforce JavaScript bundle size budgets per package
7. **Performance regression testing** — Add Lighthouse CI or similar for frontend performance baselines

## Comparison to Gold Standards

| Dimension | odh-dashboard | notebooks | kserve | k8s Best Practice |
|-----------|:------------:|:---------:|:------:|:-----------------:|
| Unit Tests | 9.0 | 5.0 | 8.0 | 8.0 |
| Integration/E2E | 9.5 | 7.0 | 8.5 | 8.0 |
| Build Integration | 9.5 | 6.0 | 5.0 | 7.0 |
| Image Testing | 8.5 | 9.0 | 6.0 | 7.0 |
| Coverage Tracking | 8.5 | 3.0 | 9.0 | 8.0 |
| CI/CD Automation | 9.5 | 7.0 | 8.5 | 8.0 |
| Agent Rules | 10.0 | 1.0 | 2.0 | 3.0 |
| Container Scanning | 0.0 | 8.0 | 5.0 | 9.0 |
| **Overall** | **9.1** | **5.8** | **7.0** | **7.3** |

**Notable**: odh-dashboard is the **reference gold standard** for agent rules, build integration, and CI/CD automation. Its only significant weakness is the absence of container vulnerability scanning and SAST — areas where the `notebooks` repo excels.

## File Paths Reference

### CI/CD
- `.github/workflows/test.yml` — Main test workflow (type-check, lint, unit, contract, cypress mock)
- `.github/workflows/cypress-e2e-test.yml` — E2E tests with cluster failover
- `.github/workflows/pr-build-validation.yml` — Konflux build simulator (4-phase)
- `.github/workflows/validate-kustomize.yml` — Kustomize manifest validation
- `.github/workflows/modular-arch-quality-gates.yml` — Per-module quality gates
- `.github/workflows/dashboard-operator-tests.yml` — Go operator tests
- `.github/workflows/*-bff-tests.yml` — Per-package BFF test workflows (8 total)
- `.github/workflows/claude-preflight.yml` — AI agent PR preflight

### Testing
- `packages/cypress/` — Cypress test framework and shared tests
- `packages/cypress/cypress/tests/e2e/` — 90 E2E test files (23 feature directories)
- `packages/cypress/cypress/tests/mocked/` — 91 mock test files
- `packages/contract-tests/` — Contract test framework
- `packages/*/contract-tests/` — Per-module contract tests
- `dashboard-operator/*_test.go` — 8 Go operator test files
- `frontend/jest.config.ts` — Frontend Jest configuration
- `backend/jest.config.ts` — Backend Jest configuration

### Code Quality
- `.eslintrc.js` — ESLint config (shared via `@odh-dashboard/eslint-config`)
- `.prettierrc` — Prettier configuration
- `.husky/pre-commit` — Pre-commit hook with lint-staged + port validation
- `.gitleaks.toml` — Secret detection configuration
- `.codecov.yml` — Coverage tracking configuration

### Container Images
- `Dockerfile` — Main dashboard multi-stage build (Node.js)
- `dashboard-operator/Dockerfile` — Go operator multi-stage build
- `.tekton/` — 22 Tekton/Konflux pipeline files

### Agent Rules
- `AGENTS.md` / `CLAUDE.md` — Comprehensive agent documentation
- `.claude/rules/` — 20 specialized rules
- `.claude/skills/` — 23 custom skills
- `.claude/commands/` — Custom commands
