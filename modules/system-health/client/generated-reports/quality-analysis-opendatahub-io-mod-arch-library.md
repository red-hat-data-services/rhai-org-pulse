---
repository: "opendatahub-io/mod-arch-library"
overall_score: 5.4
scorecard:
  - dimension: "Unit Tests"
    score: 6.0
    status: "Decent unit tests for core/shared packages; kubeflow package has zero tests; Go BFF well-tested"
  - dimension: "Integration/E2E"
    score: 2.0
    status: "Cypress scaffolding exists in mod-arch-starter but no CI-automated E2E or integration suites"
  - dimension: "Build Integration"
    score: 3.0
    status: "No PR-time Docker build, no Konflux simulation, no image validation in CI"
  - dimension: "Image Testing"
    score: 2.0
    status: "Dockerfile exists in mod-arch-starter only; no image build/test in any workflow"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "Coverage runs in CI but no codecov/coveralls integration, no thresholds, no PR reporting"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "Good PR workflows with lint/test/build matrix; semantic-release; npm caching; lint-staged"
  - dimension: "Agent Rules"
    score: 7.0
    status: "Comprehensive AGENTS.md, CLAUDE.md, .claude/rules and skills; missing test-specific agent rules"
critical_gaps:
  - title: "No coverage enforcement or reporting"
    impact: "Coverage runs but results are discarded — no codecov integration, no thresholds, no PR comments showing delta"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No E2E or integration tests in CI"
    impact: "Cross-package integration and user flows are untested; regressions slip through to consumers"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No container image build/test in CI"
    impact: "Dockerfile in mod-arch-starter is never built or validated on PRs; build failures surface only downstream"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No security scanning (SAST, container, dependency)"
    impact: "Vulnerabilities in dependencies or container images are not detected until downstream consumers run their own scans"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "mod-arch-kubeflow has zero test files"
    impact: "Theme context provider, hooks, and utilities are completely untested"
    severity: "MEDIUM"
    effort: "8-12 hours"
quick_wins:
  - title: "Add Codecov integration to test-coverage workflow"
    effort: "1-2 hours"
    impact: "PR-level coverage reporting with thresholds; prevents coverage regression"
  - title: "Add Trivy or Snyk dependency scanning workflow"
    effort: "1-2 hours"
    impact: "Automatic vulnerability detection on every PR"
  - title: "Add CodeQL or Semgrep SAST workflow"
    effort: "1-2 hours"
    impact: "Static analysis catches security issues and code quality problems"
  - title: "Add test creation agent rules (.claude/rules/testing.md)"
    effort: "2-3 hours"
    impact: "AI agents produce consistent, high-quality tests following repo patterns"
  - title: "Add Docker image build step to PR workflow"
    effort: "2-3 hours"
    impact: "Catches Dockerfile and build issues before merge"
recommendations:
  priority_0:
    - "Add Codecov integration with coverage thresholds (e.g., 60% minimum, no regression on PR)"
    - "Add dependency vulnerability scanning (Trivy, Snyk, or Dependabot alerts)"
    - "Add SAST scanning (CodeQL for TypeScript/Go)"
  priority_1:
    - "Write unit tests for mod-arch-kubeflow (ThemeContext, hooks, utilities)"
    - "Add E2E test framework (Cypress or Playwright) with CI integration"
    - "Add Docker image build validation to PR workflow for mod-arch-starter"
    - "Create test-specific agent rules (.claude/rules/testing.md)"
  priority_2:
    - "Add cross-package integration tests validating module exports and compatibility"
    - "Add pre-commit hooks beyond lint-staged (type-check, test affected)"
    - "Add Go test coverage tracking for BFF package"
    - "Add performance regression testing for build output size"
---

# Quality Analysis: mod-arch-library

## Executive Summary

- **Overall Score: 5.4/10**
- **Repository Type**: TypeScript/React monorepo (npm workspaces) with a Go BFF service
- **Primary Purpose**: Libraries for building scalable micro-frontend applications (mod-arch-core, mod-arch-shared, mod-arch-kubeflow, mod-arch-installer)
- **Key Strengths**: Well-structured CI with matrix testing, comprehensive ESLint configuration, semantic-release automation, good agent rules (AGENTS.md), Husky pre-commit hooks with lint-staged
- **Critical Gaps**: No coverage enforcement/reporting, no E2E or integration tests, no container image testing, no security scanning, one entire package (mod-arch-kubeflow) has zero tests
- **Agent Rules Status**: Present and comprehensive for development workflow; missing test-specific rules

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.0/10 | Decent coverage for core/shared; kubeflow untested; Go BFF well-tested |
| Integration/E2E | 2.0/10 | Cypress scaffolding exists but no CI automation |
| **Build Integration** | **3.0/10** | **No PR-time Docker build or image validation** |
| Image Testing | 2.0/10 | Dockerfile present but never built/tested in CI |
| Coverage Tracking | 3.0/10 | Coverage runs but results are discarded |
| CI/CD Automation | 7.0/10 | Good workflows with matrix testing and caching |
| Agent Rules | 7.0/10 | Comprehensive AGENTS.md; missing test automation rules |

## Critical Gaps

### 1. No Coverage Enforcement or Reporting
- **Impact**: The `test-coverage` job in CI runs Jest with `--coverage` for mod-arch-core and mod-arch-shared, but results are not uploaded anywhere. No codecov/coveralls integration, no minimum thresholds, no PR comments showing coverage delta.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Evidence**: `.github/workflows/test.yml` `test-coverage` job runs coverage but does not upload or enforce results

### 2. No E2E or Integration Tests in CI
- **Impact**: Cypress configuration exists in `mod-arch-starter/frontend/src/__tests__/cypress/` but is not referenced in any CI workflow. Cross-package integration (e.g., core exports consumed by shared/kubeflow) and user flows are completely untested in CI.
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Evidence**: No Cypress/Playwright step in any `.github/workflows/*.yml`; Cypress dirs exist but are scaffold-only

### 3. No Container Image Build/Test in CI
- **Impact**: `mod-arch-starter/Dockerfile` defines a multi-stage build (Node.js frontend + Go BFF + distroless runtime) but is never built or tested in any CI workflow. Build failures would only be discovered by downstream consumers.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Evidence**: No `docker build` or container-related step in any workflow

### 4. No Security Scanning
- **Impact**: No SAST (CodeQL, Semgrep), no container scanning (Trivy, Snyk), no dependency vulnerability scanning, no secret detection (Gitleaks). Vulnerabilities are invisible until downstream repos scan.
- **Severity**: HIGH
- **Effort**: 2-4 hours (for initial Trivy + CodeQL setup)
- **Evidence**: No security-related workflow files; no `.trivyignore`, `.gitleaks.toml`, or CodeQL configs

### 5. mod-arch-kubeflow Has Zero Test Files
- **Impact**: The ThemeContext provider, hooks (useThemeContext), and utilities in mod-arch-kubeflow have no unit tests. Jest config exists with `--passWithNoTests` flag, masking the gap.
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Evidence**: `find . -path '*/mod-arch-kubeflow/*test*'` returns zero results; jest.config.js uses `passWithNoTests`

## Quick Wins

### 1. Add Codecov Integration (1-2 hours)
Add codecov upload to the existing `test-coverage` workflow job:

```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    directory: ./mod-arch-core/jest-coverage
    flags: mod-arch-core
    
- name: Upload coverage to Codecov (shared)
  uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    directory: ./mod-arch-shared/jest-coverage
    flags: mod-arch-shared
```

Add a `.codecov.yml` with thresholds:
```yaml
coverage:
  status:
    project:
      default:
        target: 60%
    patch:
      default:
        target: 80%
```

### 2. Add Trivy Dependency Scanning (1-2 hours)
Create `.github/workflows/security.yml`:

```yaml
name: Security Scan
on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'

jobs:
  trivy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
```

### 3. Add CodeQL SAST (1-2 hours)
Create `.github/workflows/codeql.yml`:

```yaml
name: CodeQL
on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'

jobs:
  analyze:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        language: [javascript-typescript, go]
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

### 4. Add Test Creation Agent Rules (2-3 hours)
Create `.claude/rules/testing.md` with patterns for:
- React component tests (React Testing Library patterns from mod-arch-core)
- Hook tests (renderHook patterns from existing tests)
- Utility function tests (Jest patterns from mod-arch-shared)
- Go unit tests (httptest patterns from BFF)

### 5. Add Docker Build to PR Workflow (2-3 hours)
Add to `.github/workflows/test.yml`:

```yaml
docker-build:
  name: Docker Build Validation
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Build Docker image
      run: |
        cd mod-arch-starter
        docker build --build-arg DEPLOYMENT_MODE=standalone -t mod-arch-starter:test .
    - name: Verify image starts
      run: |
        docker run --rm -d --name test-container -p 8080:8080 mod-arch-starter:test
        sleep 5
        curl -f http://localhost:8080/health || exit 1
        docker stop test-container
```

## Detailed Findings

### CI/CD Pipeline

**Workflows (3 total)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | PR + push to main | Lint PR title, run tests (matrix), coverage, per-package tests |
| `release.yml` | Push to main | Semantic release with npm publish (OIDC trusted publishing) |
| `publish.yml` | Manual dispatch | Manual publish with version selection |

**Strengths**:
- PR title linting with conventional commits enforcement (semantic-pull-request action)
- Node.js version matrix testing (currently Node 22.x)
- npm cache enabled for faster CI
- Per-package test matrix (core, shared, kubeflow)
- Semantic-release automation with OIDC trusted npm publishing
- Dist verification script (`verify-dist.mjs`) catches unresolved path aliases and leaked test files
- Tests run in both release and manual publish workflows before publishing

**Gaps**:
- No concurrency control on PR workflows (multiple pushes to same PR run in parallel)
- Coverage job runs but results are not uploaded or enforced
- No E2E or integration test jobs
- No Docker build validation
- No security scanning jobs
- mod-arch-kubeflow test job passes silently with `--passWithNoTests`

### Test Coverage

**TypeScript Tests (17 test files across library packages)**:
- `mod-arch-core`: 8 test files covering API utilities, context, hooks, and utilities
- `mod-arch-shared`: 6 test files covering components (ManageColumnsModal, FieldGroupHelpLabelIcon) and utilities (time, string, markdown)
- `mod-arch-kubeflow`: **0 test files** (jest config uses `--passWithNoTests`)
- `mod-arch-installer`: 1 test file (flavor test via custom script)

**Go Tests (10 test files in mod-arch-starter/bff)**:
- Good coverage of proxy/WebSocket toolkit, SSRF protection, BFF client, helpers
- Uses `httptest.NewServer` for HTTP testing, `gorilla/websocket` for WebSocket testing
- Self-contained tests, no external cluster needed

**Test-to-Code Ratio**:
- TypeScript: 27 test files / 199 source files = ~14% (below average)
- Go: 10 test files / 52 source files = ~19% (adequate)

**Frameworks**:
- Jest with React Testing Library (TypeScript)
- Go standard testing with testify (Go)

**Coverage Configuration**:
- Jest `collectCoverageFrom` properly configured in core/shared
- `coverageDirectory: 'jest-coverage'` set but not uploaded
- No coverage thresholds defined

### Code Quality

**ESLint (Comprehensive)**:
- 60+ rules configured across core/shared/kubeflow
- Strict TypeScript rules: `explicit-module-boundary-types`, `no-unnecessary-condition`, `no-base-to-string`
- React best practices: hooks exhaustive-deps, jsx-no-constructed-context-values, no-unused-prop-types
- Import ordering enforced with path groups
- `no-console` errors (proper logging required)
- `no-only-tests` prevents `.only` in committed tests
- Custom `.sort()` banned in favor of `.toSorted()`
- Type assertions banned in production code (allowed in tests)
- Prettier integration with consistent formatting

**Husky + lint-staged**:
- Pre-commit hook runs `npx lint-staged`
- lint-staged runs ESLint on all `mod-arch-*/**/*.{js,ts,jsx,tsx}` files
- `--max-warnings 0` enforcement

**TypeScript Configuration**:
- Strict mode enabled
- `noImplicitReturns`, `noImplicitThis`, `noImplicitAny` enabled
- Path aliases (`~/`) properly configured

**Go Linting**:
- `.golangci.yaml` present in `mod-arch-starter/bff/` (v2 config)
- Uses default linter set with standard exclusion presets

**Missing**:
- No pre-commit hooks beyond lint (no type-checking, no test-affected)
- No `.pre-commit-config.yaml` (uses Husky instead — fine, but limited)

### Container Images

**Dockerfile (mod-arch-starter/Dockerfile)**:
- Multi-stage build: Node.js 22 (UI) + Go 1.24.3 (BFF) + distroless (runtime)
- ARG-based base image configuration
- Non-root user (`65532:65532`)
- Multi-architecture support via `TARGETOS`/`TARGETARCH`
- Deployment mode and style theme configurable via build args

**Gaps**:
- No image build in any CI workflow
- No image scanning (Trivy, Snyk)
- No SBOM generation
- No image startup validation
- No multi-architecture CI build testing

### Security

**Current State**: No security tooling configured.

**Missing**:
- No SAST (CodeQL, Semgrep, gosec)
- No dependency scanning (Trivy, Snyk, Dependabot alerts)
- No container image scanning
- No secret detection (Gitleaks, TruffleHog)
- No `.trivyignore` or security exception management

**Positive Note**: The BFF includes SSRF protection (`internal/ssrf/`) with comprehensive tests, which is a good security practice at the code level.

### Agent Rules (Agentic Flow Quality)

**Status**: Present and well-structured

**What Exists**:
- `CLAUDE.md` (root) — points to AGENTS.md
- `AGENTS.md` (root) — comprehensive monorepo guide with:
  - Repository structure and architecture overview
  - Development requirements and common commands
  - Code style conventions and naming rules
  - Testing patterns and guidelines
  - Package-specific guidelines references
- `.claude/rules/jira-creation.md` — detailed Jira issue creation rules for RHOAIENG project
- `.claude/skills/release-version/SKILL.md` — release workflow automation
- `.claude/skills/review-dependabot/SKILL.md` — Dependabot PR review automation
- `mod-arch-kubeflow/AGENTS.md` — package-specific theming/SCSS guidance
- `mod-arch-kubeflow/.claude/rules/` — PatternFly tokens, SCSS architecture, workflow rules
- `mod-arch-starter/CLAUDE.md` and `mod-arch-starter/AGENTS.md` — starter template guidance

**Coverage**: Development workflow, code style, architecture, deployment modes, Jira creation, release process, Dependabot review, theming/SCSS

**Quality**: High — rules are specific, actionable, and include examples and checklists

**Gaps**:
- No test-specific agent rules (no `.claude/rules/testing.md` or similar)
- Testing section in AGENTS.md is brief ("What to Test" is a bullet list without patterns or examples)
- No guidance for writing Go tests in the BFF
- No rules for coverage expectations or test quality gates

## Recommendations

### Priority 0 (Critical)

1. **Add Codecov integration with enforcement** — Upload coverage from the existing `test-coverage` job, set minimum thresholds (60% project, 80% patch), enable PR comments
2. **Add dependency vulnerability scanning** — Trivy filesystem scan on PRs + weekly schedule; block on CRITICAL/HIGH
3. **Add SAST scanning** — CodeQL for both TypeScript and Go; catches injection, XSS, and type confusion issues

### Priority 1 (High Value)

4. **Write unit tests for mod-arch-kubeflow** — ThemeContext provider, useThemeContext hook, theme utilities; remove `--passWithNoTests` once tests exist
5. **Add E2E test framework** — Cypress (already scaffolded) or Playwright for mod-arch-starter; run on PRs with mock backend
6. **Add Docker image build to PR workflow** — Build the multi-stage Dockerfile, verify image starts, basic health check
7. **Create test-specific agent rules** — `.claude/rules/testing.md` with React Testing Library patterns, hook testing patterns, utility test patterns, Go test patterns

### Priority 2 (Nice-to-Have)

8. **Add cross-package integration tests** — Verify module exports, type compatibility between core/shared/kubeflow
9. **Expand pre-commit hooks** — Add type-check and test-affected to Husky/lint-staged
10. **Add Go test coverage tracking** — Run `go test -coverprofile` in CI for BFF, upload to Codecov
11. **Add build output size monitoring** — Track and alert on package size regressions

## Comparison to Gold Standards

| Dimension | mod-arch-library | odh-dashboard | notebooks | kserve |
|-----------|-----------------|---------------|-----------|--------|
| Unit Tests | 6/10 | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 2/10 | 9/10 | 6/10 | 9/10 |
| Build Integration | 3/10 | 8/10 | 9/10 | 7/10 |
| Image Testing | 2/10 | 7/10 | 10/10 | 7/10 |
| Coverage Tracking | 3/10 | 9/10 | 5/10 | 9/10 |
| CI/CD Automation | 7/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 7/10 | 9/10 | 3/10 | 2/10 |

**Key Takeaways vs Gold Standards**:
- **CI/CD and Agent Rules are close to gold standard** — well-structured workflows, comprehensive developer guidance
- **Largest gaps are in testing depth and security** — no E2E, no coverage enforcement, no scanning
- **Image testing is the weakest area** — Dockerfile exists but is completely untested in CI
- **Agent rules are strong for development** but lack test-specific guidance that odh-dashboard excels at

## File Paths Reference

| Category | Path |
|----------|------|
| CI Workflows | `.github/workflows/test.yml`, `release.yml`, `publish.yml` |
| ESLint Config | `mod-arch-core/.eslintrc.cjs`, `mod-arch-shared/.eslintrc.cjs`, `mod-arch-kubeflow/.eslintrc.cjs` |
| Jest Config | `mod-arch-core/jest.config.js`, `mod-arch-shared/jest.config.js`, `mod-arch-kubeflow/jest.config.js` |
| TypeScript Config | `mod-arch-core/tsconfig.json`, `mod-arch-shared/tsconfig.json`, `mod-arch-kubeflow/tsconfig.json` |
| Dockerfile | `mod-arch-starter/Dockerfile` |
| Pre-commit | `.husky/pre-commit` |
| Agent Rules | `CLAUDE.md`, `AGENTS.md`, `.claude/rules/jira-creation.md` |
| Agent Skills | `.claude/skills/release-version/SKILL.md`, `.claude/skills/review-dependabot/SKILL.md` |
| Go Linting | `mod-arch-starter/bff/.golangci.yaml` |
| Semantic Release | `.releaserc.json` |
| Dist Verification | `scripts/verify-dist.mjs` |
| Testing Docs | `docs/testing.md` (mostly "Coming soon" placeholders) |
