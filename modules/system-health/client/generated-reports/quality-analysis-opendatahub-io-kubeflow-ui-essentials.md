---
repository: "opendatahub-io/kubeflow-ui-essentials"
overall_score: 3.6
scorecard:
  - dimension: "Unit Tests"
    score: 4.0
    status: "15 test files for 167 source files (9% ratio); mod-arch-kubeflow and installer have zero tests"
  - dimension: "Integration/E2E"
    score: 2.0
    status: "No E2E or integration tests; docs/testing.md is entirely 'Coming soon' placeholders"
  - dimension: "Build Integration"
    score: 5.0
    status: "PR CI builds all packages and verifies dist; no PR-time Docker build or Konflux simulation"
  - dimension: "Image Testing"
    score: 3.0
    status: "Multi-stage Dockerfile with distroless base; no scanning, SBOM, or runtime validation"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "Jest coverage config present; CI runs coverage but no codecov integration or thresholds"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "3 workflows with semantic release and npm provenance; missing concurrency control and security scanning"
  - dimension: "Agent Rules"
    score: 6.0
    status: "Excellent AGENTS.md with per-package rules; no test creation rules in .claude/rules/"
critical_gaps:
  - title: "No E2E or integration test infrastructure"
    impact: "User journeys across deployment modes (standalone, federated, kubeflow) are completely untested"
    severity: "HIGH"
    effort: "20-30 hours"
  - title: "No security scanning in CI"
    impact: "Vulnerabilities in dependencies and container images are not detected before release"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Extremely low unit test coverage for shared components"
    impact: "Only 3 of 24 shared UI components have tests (12.5%); regressions in core UI library go undetected"
    severity: "HIGH"
    effort: "15-20 hours"
  - title: "No coverage thresholds or PR reporting"
    impact: "Coverage can silently decrease with no enforcement; no visibility on PR-level coverage changes"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "mod-arch-kubeflow has zero tests"
    impact: "Theme context, hooks, and style utility code completely untested despite being consumed by downstream apps"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No container image scanning"
    impact: "Published npm packages and Docker images not scanned for known CVEs"
    severity: "HIGH"
    effort: "2-4 hours"
quick_wins:
  - title: "Add codecov integration with PR comments"
    effort: "2-3 hours"
    impact: "Immediate visibility into coverage changes on every PR; blocks coverage regressions"
  - title: "Add Trivy container scanning to CI"
    effort: "1-2 hours"
    impact: "Catch CVEs in base images and Go/Node dependencies before release"
  - title: "Add concurrency control to test workflow"
    effort: "30 minutes"
    impact: "Prevent redundant CI runs on rapid pushes; save compute resources"
  - title: "Create .claude/rules/ for unit test patterns"
    effort: "2-3 hours"
    impact: "Ensure AI-generated tests follow repo conventions (RTL, Jest, __tests__/ directories)"
  - title: "Add CodeQL SAST scanning workflow"
    effort: "1-2 hours"
    impact: "Free GitHub-native static analysis for TypeScript and Go code"
  - title: "Set Jest coverage thresholds"
    effort: "1 hour"
    impact: "Prevent coverage regressions by failing CI when thresholds are not met"
recommendations:
  priority_0:
    - "Add unit tests for mod-arch-kubeflow (ThemeContext, useThemeContext hook, style utilities)"
    - "Add tests for remaining 21 untested shared components in mod-arch-shared"
    - "Add security scanning - Trivy for containers, CodeQL for TypeScript/Go SAST"
    - "Integrate codecov with coverage thresholds and PR reporting"
  priority_1:
    - "Set up Cypress or Playwright E2E test infrastructure for the mod-arch-starter"
    - "Add contract tests for BFF API endpoints using OpenAPI spec validation"
    - "Create .claude/rules/ for unit-tests.md, e2e-tests.md, and integration-tests.md"
    - "Add PR-time Docker image build validation for mod-arch-starter"
    - "Add dependency scanning (npm audit in CI, Dependabot or Renovate)"
  priority_2:
    - "Add accessibility testing automation (axe-core in Jest)"
    - "Add performance testing for shared components (React profiler)"
    - "Add visual regression testing for UI components"
    - "Complete the docs/testing.md documentation"
    - "Add SBOM generation for published npm packages"
---

# Quality Analysis: opendatahub-io/kubeflow-ui-essentials

## Executive Summary
- Overall Score: 3.6/10
- Key Strengths: Well-structured monorepo with comprehensive AGENTS.md, solid ESLint configuration, semantic release with npm provenance, good BFF Go test patterns for proxy/SSRF code
- Critical Gaps: Extremely low test coverage (9% test file ratio), zero E2E/integration tests, no security scanning, no coverage enforcement, mod-arch-kubeflow entirely untested
- Agent Rules Status: Present and well-structured (AGENTS.md + per-package rules) but missing test creation guidance

## Quality Scorecard
| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 4.0/10 | 15 test files for 167 source files (9% ratio); mod-arch-kubeflow and installer have zero tests |
| Integration/E2E | 2.0/10 | No E2E or integration tests; docs/testing.md is entirely "Coming soon" placeholders |
| **Build Integration** | **5.0/10** | **PR CI builds all packages and verifies dist; no PR-time Docker build or Konflux simulation** |
| Image Testing | 3.0/10 | Multi-stage Dockerfile with distroless base; no scanning, SBOM, or runtime validation |
| Coverage Tracking | 3.0/10 | Jest coverage config present; CI runs coverage but no codecov integration or thresholds |
| CI/CD Automation | 6.0/10 | 3 workflows with semantic release and npm provenance; missing concurrency control and security scanning |
| Agent Rules | 6.0/10 | Excellent AGENTS.md with per-package rules; no test creation rules in .claude/rules/ |

## Critical Gaps

1. **No E2E or Integration Test Infrastructure**
   - Impact: User journeys across three deployment modes (standalone, federated, kubeflow) are completely untested. Module Federation remotes, BFF proxy flows, and theme switching are validated only manually.
   - Severity: HIGH
   - Effort: 20-30 hours

2. **No Security Scanning in CI**
   - Impact: Vulnerabilities in npm dependencies, Go modules, and container base images are not detected before release. Published npm packages could carry known CVEs.
   - Severity: HIGH
   - Effort: 4-6 hours

3. **Extremely Low Unit Test Coverage for Shared Components**
   - Impact: Only 3 of 24 shared UI components (`FieldGroupHelpLabelIcon`, `ManageColumnsModal`, `useManageColumns`) have tests. Critical components like `SimpleSelect`, `TypeaheadSelect`, `MarkdownView`, `ApplicationsPage` are untested.
   - Severity: HIGH
   - Effort: 15-20 hours

4. **mod-arch-kubeflow Has Zero Tests**
   - Impact: `ThemeContext`, `useThemeContext` hook, and all style utilities are consumed by downstream applications but have no test coverage. Theme-related regressions propagate silently to consumers.
   - Severity: HIGH
   - Effort: 8-12 hours

5. **No Coverage Thresholds or PR Reporting**
   - Impact: Coverage can silently decrease with each merge. No codecov/coveralls integration means no visibility on PR-level coverage impact.
   - Severity: MEDIUM
   - Effort: 2-4 hours

6. **No Container Image Scanning**
   - Impact: The Dockerfile uses `gcr.io/distroless/static:nonroot` (good), but no Trivy/Snyk scan validates the final image or intermediate stages for CVEs.
   - Severity: HIGH
   - Effort: 2-4 hours

## Quick Wins

1. **Add Codecov Integration with PR Comments** (2-3 hours)
   - Impact: Immediate coverage visibility on every PR
   - Implementation:
     ```yaml
     # Add to test.yml after coverage run
     - name: Upload coverage
       uses: codecov/codecov-action@v4
       with:
         token: ${{ secrets.CODECOV_TOKEN }}
         files: mod-arch-core/jest-coverage/lcov.info,mod-arch-shared/jest-coverage/lcov.info
         fail_ci_if_error: true
     ```

2. **Add Trivy Container Scanning** (1-2 hours)
   - Impact: Catch CVEs in base images and dependencies
   - Implementation:
     ```yaml
     # New workflow: .github/workflows/security.yml
     name: Security
     on: [push, pull_request]
     jobs:
       trivy:
         runs-on: ubuntu-latest
         steps:
         - uses: actions/checkout@v4
         - uses: aquasecurity/trivy-action@master
           with:
             scan-type: 'fs'
             scan-ref: '.'
             severity: 'CRITICAL,HIGH'
     ```

3. **Add Concurrency Control to Test Workflow** (30 minutes)
   - Impact: Prevent redundant CI runs on rapid pushes
   - Implementation:
     ```yaml
     # Add to test.yml at the top level
     concurrency:
       group: ${{ github.workflow }}-${{ github.ref }}
       cancel-in-progress: true
     ```

4. **Create `.claude/rules/` for Unit Test Patterns** (2-3 hours)
   - Impact: AI-generated tests follow established conventions
   - Create `.claude/rules/unit-tests.md` covering:
     - Use Jest + React Testing Library
     - Tests go in `__tests__/` directories alongside source
     - File naming: `*.test.ts` or `*.test.tsx`
     - Mock patterns: `config/transform.style.js` for CSS, `config/transform.file.js` for assets
     - Coverage: always add to `collectCoverageFrom` in jest.config.js

5. **Add CodeQL SAST Scanning** (1-2 hours)
   - Impact: Free GitHub-native static analysis for TypeScript and Go
   - Implementation: Use the standard CodeQL workflow template for `javascript` and `go` languages

6. **Set Jest Coverage Thresholds** (1 hour)
   - Impact: Fail CI when coverage drops below minimum
   - Implementation:
     ```js
     // Add to jest.config.js in each package
     coverageThreshold: {
       global: {
         branches: 50,
         functions: 50,
         lines: 60,
         statements: 60,
       },
     },
     ```

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory:**
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | push/PR to main | Lint PR title, build, lint, test (all + individual packages), coverage |
| `publish.yml` | workflow_dispatch | Manual npm publish with version input |
| `release.yml` | push to main | Semantic release with npm provenance publishing |

**Strengths:**
- Semantic PR title enforcement via `action-semantic-pull-request`
- Matrix strategy for testing individual packages (core, shared, kubeflow)
- Semantic release with conventional commits
- npm provenance for supply chain security (`--provenance` flag)
- OIDC trusted publishing with Node 22.14+ verification
- Dist output verification before publish (`scripts/verify-dist.mjs`)
- npm caching in all workflows

**Gaps:**
- No concurrency control — pushes in quick succession run duplicate workflows
- No E2E test job
- No Docker image build validation in PR workflow
- No security scanning workflow (Trivy, CodeQL, Dependabot)
- No Konflux build simulation
- Test coverage runs but results are not uploaded to any service

### Test Coverage

**TypeScript Library Packages:**

| Package | Source Files | Test Files | Test Ratio | Key Gaps |
|---------|------------|------------|------------|----------|
| mod-arch-core | ~40 | 7 | 17.5% | Missing: `useSettings`, `useTimeBasedRefresh`, `useQueryParamNamespaces`, `BrowserStorageContext`, `NotificationContext` |
| mod-arch-shared | ~50 | 6 | 12% | Only 3/24 components tested. Missing: `SimpleSelect`, `TypeaheadSelect`, `MarkdownView`, `ApplicationsPage`, `EditableLabelsDescriptionListGroup`, and 18 others |
| mod-arch-kubeflow | ~15 | 0 | 0% | Zero tests. Missing: `ThemeContext`, `useThemeContext`, `generate-mui-theme.mjs` |
| mod-arch-installer | ~5 | 0 | 0% | Zero direct tests. Has flavor test infrastructure via `scripts/test-flavor.mjs` |

**Overall TypeScript metrics:**
- 167 source files, 15 test files (9% ratio)
- 10,076 source LOC, 2,295 test LOC (22.8% test-to-code ratio)

**Go BFF (mod-arch-starter):**

| Area | Test Files | Coverage |
|------|-----------|----------|
| `internal/proxy/` | 3 | WebSocket upgrader, TLS config, tracker — well tested |
| `internal/ssrf/` | 1 | Private IP validation, hostname resolution — comprehensive |
| `internal/integrations/bffclient/` | 4 | Client, config, errors, factory — good coverage |
| `cmd/` | 1 | Helper functions |
| `internal/api/` | 1 (helpers only) | Handlers NOT tested — no tests for namespace, user, health endpoints |
| `internal/repositories/` | 0 | Zero tests for repository layer |

**Go BFF metrics:**
- 3,803 source LOC, 1,575 test LOC (41.4% test-to-code ratio)
- Uses envtest for Kubernetes API testing (good infrastructure, limited use)
- Self-contained tests using `httptest.NewServer` — no external cluster needed

**Testing Frameworks:**
- Frontend: Jest 29 + React Testing Library 16 + ts-jest
- BFF: Go standard testing + envtest + httptest
- Test environment: jest-environment-jsdom

### Code Quality

**TypeScript Linting (ESLint):**
- Very comprehensive configuration with strict rules
- Plugins: `@typescript-eslint`, `react-hooks`, `jsx-a11y`, `import`, `no-only-tests`, `prettier`
- Notable strict rules:
  - `no-console: error` — prevents debug logging
  - `@typescript-eslint/explicit-module-boundary-types: error` — enforces return types
  - `@typescript-eslint/no-unnecessary-condition: error` — catches dead code
  - `no-only-tests/no-only-tests: error` — prevents `.only()` from being committed
  - `no-restricted-properties: sort` — enforces `.toSorted()` over `.sort()`
  - `@typescript-eslint/consistent-type-assertions: never` — bans type assertions outside tests
- Accessibility: `jsx-a11y` plugin with anchor and autofocus rules
- Import ordering enforced with specific group order
- Prettier integration for consistent formatting

**Go Linting:**
- golangci-lint v2 configured (`.golangci.yaml`)
- Minimal custom configuration — uses mostly default linters with exclusion presets
- `go fmt` and `go vet` in Makefile

**Pre-commit Hooks:**
- Husky pre-commit runs `npx lint-staged`
- lint-staged: ESLint with `--max-warnings 0` on all `mod-arch-*/**/*.{js,ts,jsx,tsx}` files
- No pre-commit for Go code

**Static Analysis:**
- No CodeQL/SAST
- No Semgrep
- No gosec
- No dependency scanning beyond npm's `audit-level=moderate`
- No secret detection (no Gitleaks/TruffleHog)

### Container Images

**Build Process:**
- Multi-stage Dockerfile in `mod-arch-starter/`:
  - Stage 1: Node 22 — builds React frontend
  - Stage 2: Go 1.24.3 — builds BFF binary
  - Stage 3: `gcr.io/distroless/static:nonroot` — minimal runtime image
- Supports multiple deployment modes via build args (`DEPLOYMENT_MODE`, `STYLE_THEME`)
- Multi-architecture support via `docker buildx` with `PLATFORM` variable
- Kind deployment script for local testing (`scripts/deploy_kind_cluster.sh`)

**Gaps:**
- No container image scanning (Trivy, Snyk, Grype)
- No SBOM generation (Syft, Anchore)
- No image signing or attestation (Cosign, Sigstore)
- No runtime validation tests
- No image startup tests in CI
- Docker builds are not part of PR workflow — build issues discovered only post-merge

### Security

**Strengths:**
- Distroless base image — minimal attack surface
- npm provenance for supply chain transparency
- SSRF protection in BFF code (`internal/ssrf/`) with comprehensive tests
- npm `audit-level=moderate` in `.npmrc`
- `nonroot` user in container (UID 65532)
- Pinned GitHub Actions with SHA hashes in some workflows

**Gaps:**
- No Trivy/Snyk container scanning
- No CodeQL/SAST for code analysis
- No Dependabot/Renovate for dependency updates
- No secret detection (Gitleaks/TruffleHog)
- No npm audit step in CI workflow
- Not all GitHub Actions pinned to SHAs (some use `@v4` tags)

### Agent Rules (Agentic Flow Quality)

**Status:** Present and well-structured

**Coverage:**

| Location | Type | Content |
|----------|------|---------|
| `CLAUDE.md` | Root | Points to AGENTS.md |
| `AGENTS.md` | Root | Comprehensive: repo overview, structure, commands, code style, testing, architecture |
| `mod-arch-kubeflow/AGENTS.md` | Package | Theming rules, PatternFly tokens, MUI integration |
| `mod-arch-kubeflow/.claude/rules/` | Rules (3) | `patternfly-design-tokens.md`, `scss-architecture.md`, `workflow.md` |
| `mod-arch-starter/AGENTS.md` | Package | Mandatory development flow (contract-first), project structure |
| `mod-arch-starter/CLAUDE.md` | Package | Points to AGENTS.md |
| `.claude/rules/jira-creation.md` | Rule | Detailed Jira issue creation workflows for RHOAIENG |

**Quality Assessment:**
- Root AGENTS.md is excellent — covers workspace commands, code conventions, import order, testing patterns
- mod-arch-kubeflow rules are thorough for their domain (theming/styling)
- mod-arch-starter's contract-first development flow is a strong opinionated guide
- Jira creation rule is very detailed with templates for Bug/Story/Task/Epic

**Gaps:**
- No `.claude/rules/` for test creation patterns (unit, integration, E2E)
- No test pattern documentation for AI agents
- No rules for component testing conventions
- No rules for Go BFF testing patterns
- No snapshot testing guidelines
- Recommendation: Generate test rules with `/test-rules-generator`

## Recommendations

### Priority 0 (Critical)
- Add unit tests for mod-arch-kubeflow (`ThemeContext`, `useThemeContext`, style utilities)
- Add tests for the 21 untested shared components in mod-arch-shared
- Add security scanning — Trivy for filesystem/container scanning, CodeQL for TypeScript/Go SAST
- Integrate codecov with coverage thresholds and PR reporting
- Add `npm audit` step to the test workflow

### Priority 1 (High Value)
- Set up Cypress or Playwright E2E infrastructure for mod-arch-starter (covering standalone, federated, kubeflow modes)
- Add contract tests for BFF API endpoints using OpenAPI spec validation
- Create `.claude/rules/` for unit-tests.md, e2e-tests.md, integration-tests.md
- Add PR-time Docker image build validation for mod-arch-starter
- Add dependency management (Dependabot or Renovate) for npm and Go dependencies
- Add concurrency control to CI workflows
- Pin all GitHub Actions to SHA hashes for supply chain security

### Priority 2 (Nice-to-Have)
- Add accessibility testing automation (axe-core in Jest component tests)
- Add performance testing for shared components
- Add visual regression testing for UI components (Chromatic or Percy)
- Complete the `docs/testing.md` documentation (currently all placeholders)
- Add SBOM generation for published npm packages
- Add image signing with Cosign/Sigstore
- Add Gitleaks secret detection

## Comparison to Gold Standards

| Dimension | kubeflow-ui-essentials | odh-dashboard (Gold) | notebooks (Gold) | Gap |
|-----------|----------------------|---------------------|------------------|-----|
| Unit Test Ratio | 9% file ratio | ~40%+ | N/A (image-focused) | 4x below gold standard |
| E2E Tests | None | Cypress + mocked tests | N/A | No E2E infrastructure at all |
| Coverage Tracking | Config only, no reporting | Codecov with thresholds | N/A | Missing enforcement and visibility |
| Security Scanning | None | CodeQL + dependency scanning | Trivy + image scanning | No scanning of any kind |
| Container Scanning | None | Limited | 5-layer validation | No image testing pipeline |
| Agent Rules | Good AGENTS.md, partial .claude/rules/ | Comprehensive rules + skills | N/A | Missing test creation rules |
| Pre-commit | Husky + lint-staged (TS only) | Comprehensive pre-commit | N/A | No Go pre-commit hooks |
| CI Automation | 3 workflows, basic | Multi-workflow, comprehensive | Periodic + PR | Missing security and E2E jobs |

## File Paths Reference

### CI/CD
- `.github/workflows/test.yml` — PR/push test workflow (lint, build, test, coverage)
- `.github/workflows/publish.yml` — Manual npm publish workflow
- `.github/workflows/release.yml` — Semantic release on main push
- `.releaserc.json` — Semantic release configuration

### Testing
- `mod-arch-core/jest.config.js` — Core package Jest config
- `mod-arch-shared/jest.config.js` — Shared package Jest config
- `mod-arch-kubeflow/jest.config.js` — Kubeflow package Jest config (0 tests)
- `mod-arch-core/__tests__/` — Core test directory
- `mod-arch-shared/__tests__/` — Shared test directory
- `mod-arch-starter/bff/Makefile` — BFF test targets (uses envtest)
- `docs/testing.md` — Testing documentation (mostly placeholders)

### Code Quality
- `mod-arch-core/.eslintrc.cjs` — ESLint config (comprehensive)
- `mod-arch-shared/.eslintrc.cjs` — ESLint config (comprehensive)
- `mod-arch-starter/bff/.golangci.yaml` — Go linter config (minimal)
- `.husky/pre-commit` — Pre-commit hook (lint-staged)

### Container Images
- `mod-arch-starter/Dockerfile` — Multi-stage build (Node + Go → distroless)
- `mod-arch-starter/Makefile` — Docker build/push/deploy targets
- `mod-arch-starter/scripts/deploy_kind_cluster.sh` — Kind deployment

### Agent Rules
- `CLAUDE.md` — Root agent instructions
- `AGENTS.md` — Comprehensive repo guide
- `.claude/rules/jira-creation.md` — Jira issue creation guide
- `mod-arch-kubeflow/AGENTS.md` — Kubeflow theming guide
- `mod-arch-kubeflow/.claude/rules/` — 3 theming rules
- `mod-arch-starter/AGENTS.md` — Starter template guide (contract-first flow)

### Security
- `.npmrc` — `audit-level=moderate`
- `mod-arch-starter/bff/internal/ssrf/` — SSRF protection (with tests)
