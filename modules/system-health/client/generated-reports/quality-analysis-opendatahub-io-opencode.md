---
repository: "opendatahub-io/opencode"
overall_score: 7.9
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "Exceptional test suite with 549 test files across 25+ packages, extensive provider and tool coverage"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Playwright E2E on Linux and Windows, smoke/regression suites, HttpApi exerciser gates"
  - dimension: "Build Integration"
    score: 7.5
    status: "PR-time multi-arch container build validation, but no Konflux simulation"
  - dimension: "Image Testing"
    score: 6.5
    status: "Multi-arch UBI9 container builds with runtime smoke (opencode --version), no deeper image functional tests"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "No coverage tool integration (no codecov, coveralls, or coverage thresholds)"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "28 workflows with concurrency control, caching, multi-platform builds, code signing, auto-publish"
  - dimension: "Agent Rules"
    score: 7.0
    status: "Comprehensive AGENTS.md with style guide, testing philosophy, and V2 session semantics"
critical_gaps:
  - title: "No test coverage tracking or enforcement"
    impact: "Cannot measure test coverage trends, regressions go undetected, no PR-level coverage reporting"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No security scanning in CI (SAST/container scanning)"
    impact: "Vulnerabilities in dependencies or code not caught until production; no Trivy, Snyk, or CodeQL"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No pre-commit hooks for code quality"
    impact: "Only pre-push typecheck hook; no lint, format, or secret detection on commit"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No dependency scanning or secret detection"
    impact: "Supply chain vulnerabilities and accidental secret commits not caught automatically"
    severity: "HIGH"
    effort: "3-5 hours"
quick_wins:
  - title: "Add codecov/coveralls integration to test workflow"
    effort: "2-4 hours"
    impact: "Immediate visibility into test coverage with PR-level reporting and trend tracking"
  - title: "Add Trivy container scanning to build-openshift-image workflow"
    effort: "1-2 hours"
    impact: "Catch critical vulnerabilities in UBI9 container images before deployment"
  - title: "Add CodeQL or Semgrep SAST workflow"
    effort: "2-3 hours"
    impact: "Automated detection of security issues in TypeScript/JavaScript code"
  - title: "Add Gitleaks secret detection to PR workflow"
    effort: "1-2 hours"
    impact: "Prevent accidental credential leaks in pull requests"
  - title: "Add pre-commit hook for oxlint"
    effort: "1 hour"
    impact: "Catch lint issues before they reach CI, faster feedback loop"
recommendations:
  priority_0:
    - "Implement test coverage tracking with codecov integration and PR-level reporting"
    - "Add container image vulnerability scanning (Trivy) to the build-openshift-image workflow"
    - "Add SAST scanning (CodeQL or Semgrep) for TypeScript/JavaScript security analysis"
  priority_1:
    - "Add dependency scanning (Dependabot or Renovate) for supply chain security"
    - "Add Gitleaks or TruffleHog secret detection to PR workflow"
    - "Add contract tests between SDK and server API boundaries"
    - "Enhance agent rules with specific test creation guidance per test type"
  priority_2:
    - "Add performance regression testing (benchmark suite with tracking)"
    - "Add accessibility testing for web/desktop UI components"
    - "Add pre-commit hooks for lint, format, and secret detection"
    - "Add SBOM generation for container images"
---

# Quality Analysis: opendatahub-io/opencode

## Executive Summary

- **Overall Score: 7.9/10**
- **Repository Type**: TypeScript/Bun monorepo — AI-powered coding assistant with CLI (TUI), desktop (Electron), and web interfaces
- **Primary Language**: TypeScript (Bun runtime)
- **Framework**: SolidJS (UI), Effect (core), Drizzle (database), Playwright (E2E)
- **Package Manager**: Bun 1.3.14 with Turborepo
- **Packages**: 25+ packages including core, opencode, app, desktop, tui, llm, ui, enterprise, and more
- **Agent Rules Status**: Present (AGENTS.md) — comprehensive style guide and testing philosophy, but no `.claude/rules/` directory

### Key Strengths
1. **Exceptional unit test coverage** — 549 test files across all major packages with deep coverage of tools, providers, sessions, and plugins
2. **Sophisticated CI/CD** — 28 GitHub workflows with concurrency control, caching, multi-platform builds, code signing, and automated publishing
3. **Cross-platform E2E** — Playwright tests running on both Linux and Windows with smoke and regression suites
4. **Multi-architecture container builds** — UBI9 Containerfile with amd64/arm64 support and PR-time build validation
5. **Strong developer guardrails** — PR standards enforcement, AI-powered code review, conventional commit validation

### Critical Gaps
1. **No test coverage tracking** — No codecov, coveralls, or any coverage measurement/enforcement
2. **No security scanning** — No SAST, container scanning, or dependency scanning in CI
3. **No secret detection** — No Gitleaks or TruffleHog integration
4. **Limited pre-commit hooks** — Only pre-push typecheck, no commit-time lint or format checks

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 9.0/10 | Exceptional — 549 test files, 0.30 test-to-source ratio, comprehensive provider/tool coverage |
| Integration/E2E | 8.0/10 | Strong — Playwright E2E (smoke + regression), HttpApi exerciser, recorded test playback |
| **Build Integration** | **7.5/10** | **Good — PR-time multi-arch container builds, but no Konflux simulation** |
| Image Testing | 6.5/10 | Adequate — Multi-arch UBI9 builds with startup validation, no functional image tests |
| Coverage Tracking | 2.0/10 | Weak — No coverage tool, no thresholds, no PR reporting |
| CI/CD Automation | 9.0/10 | Excellent — 28 workflows, concurrency, caching, multi-platform, auto-publish |
| Agent Rules | 7.0/10 | Good — Comprehensive AGENTS.md style guide, no .claude/rules/ test automation rules |

## Critical Gaps

### 1. No Test Coverage Tracking or Enforcement
- **Impact**: Cannot measure coverage trends; regressions go undetected; no PR-level visibility
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Despite having 549 test files, there is no mechanism to measure, track, or enforce test coverage. No `.codecov.yml`, `coveralls` config, or `--coverage` flag in test scripts. Teams cannot identify untested code paths or measure improvement over time.

### 2. No Security Scanning in CI
- **Impact**: Vulnerabilities in dependencies, container images, or code not detected until production
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: No Trivy, Snyk, CodeQL, or Semgrep integration. Container images are built and pushed without vulnerability scanning. No SAST analysis of TypeScript/JavaScript code. The `SECURITY.md` focuses on responsible disclosure but no automated scanning exists.

### 3. No Dependency Scanning or Secret Detection
- **Impact**: Supply chain attacks and accidental credential commits not caught
- **Severity**: HIGH
- **Effort**: 3-5 hours
- **Details**: No Dependabot, Renovate, or dependency vulnerability scanning. No Gitleaks or TruffleHog for secret detection. Given the project handles API keys and provider credentials, this is a significant gap.

### 4. Limited Pre-commit Hooks
- **Impact**: Code quality issues reach CI before being caught locally
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: Husky is installed but only has a `pre-push` hook that checks Bun version and runs typecheck. No `pre-commit` hook for lint (oxlint), format (prettier), or secret detection. Developers discover issues only at push time or in CI.

## Quick Wins

### 1. Add Codecov Integration to Test Workflow (2-4 hours)
- **Impact**: Immediate coverage visibility with PR-level reporting
- **Implementation**: Add `--coverage` to Bun test runs, upload to Codecov
```yaml
# In .github/workflows/test.yml
- name: Run unit tests with coverage
  run: bun turbo test --output-logs=errors-only -- --coverage
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
```

### 2. Add Trivy Scanning to OpenShift Image Build (1-2 hours)
- **Impact**: Catch critical vulnerabilities in UBI9 container images
```yaml
# In .github/workflows/build-openshift-image.yml
- name: Run Trivy vulnerability scan
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: opencode:validate
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
```

### 3. Add CodeQL SAST Scanning (2-3 hours)
- **Impact**: Automated detection of security issues in TypeScript/JavaScript
```yaml
name: codeql
on:
  push:
    branches: [dev]
  pull_request:
    branches: [dev]
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript
      - uses: github/codeql-action/analyze@v3
```

### 4. Add Gitleaks Secret Detection (1-2 hours)
- **Impact**: Prevent credential leaks in PRs
```yaml
- name: Gitleaks
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 5. Add Pre-commit Hook for oxlint (1 hour)
- **Impact**: Catch lint issues before CI
```bash
# .husky/pre-commit
#!/bin/sh
set -e
bun run lint
```

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (28 workflows)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | PR, push(dev) | Unit tests (Linux/Windows) + E2E (Playwright) + HttpApi exerciser |
| `typecheck.yml` | PR, push(dev) | TypeScript type checking via tsgo |
| `build-openshift-image.yml` | PR, push(dev) | Multi-arch UBI9 container build and push to Quay.io |
| `publish.yml` | push(dev/ci/beta) | Full release: CLI build, code signing, Electron, npm publish |
| `containers.yml` | push(dev) | Build and push development container images to GHCR |
| `storybook.yml` | PR, push(dev) | Storybook build validation |
| `nix-eval.yml` | PR, push(dev) | Nix flake evaluation (all systems) |
| `pr-standards.yml` | PR (opened/edited) | Conventional commit title + issue linking enforcement |
| `review.yml` | issue_comment | AI-powered code review (OpenCode-driven) |
| `opencode.yml` | issue_comment | OpenCode bot for PR/issue commands |
| `deploy.yml` | push(dev/production) | SST deployment to AWS |
| `beta.yml` | hourly schedule | Beta branch sync |
| `generate.yml` | push(dev) | Auto-generate and commit code |
| `stats.yml` | Various | Repository statistics |
| Others | Various | Docs sync, triage, close stale, notify Discord, publish VS Code/GitHub Action |

**Strengths**:
- Concurrency control with `cancel-in-progress` on most workflows
- Turbo cache for build performance
- Playwright browser caching
- Cross-platform testing (Linux + Windows) for both unit and E2E
- Multi-arch container builds (amd64 + arm64) with native runners (no QEMU emulation for production)
- Code signing for macOS and Windows binaries
- AI-powered PR review workflow

**Gaps**:
- No security scanning workflow (CodeQL, Trivy, Snyk)
- No dependency update automation (Dependabot/Renovate)
- No performance benchmark CI

### Test Coverage

**Unit Tests (Score: 9.0/10)**:
- **549 test files** across packages
- **Test-to-source ratio**: 0.30 (549 test files / 1,830 source files)
- **Testing framework**: Bun's built-in test runner
- **Key test areas**:
  - `packages/core/test/` — 100+ tests covering tools, sessions, models, plugins, filesystem, git, permissions
  - `packages/opencode/test/` — 180+ tests covering CLI, server, sessions, providers, MCP, LSP, tools, effects
  - `packages/app/src/` — 70+ tests for UI components, context, utilities
  - `packages/llm/test/` — Provider-specific tests (Anthropic, OpenAI, Bedrock, Gemini, etc.)
  - `packages/tui/test/` — 40+ tests for TUI components
  - `packages/desktop/` — Tests for Electron main/renderer processes
- **Notable pattern**: Recorded test playback (`.recorded.test.ts`) for deterministic LLM provider testing
- **HttpApi exerciser**: Automated API endpoint coverage/auth/effect validation

**E2E Tests (Score: 8.0/10)**:
- **Framework**: Playwright with Chromium
- **Structure**: Smoke tests + regression tests
- **Suites**:
  - `e2e/smoke/session-timeline.spec.ts` — Session timeline interactions
  - `e2e/regression/` — 4 regression tests for thinking levels, list loading, collapse state, context resize
- **Config**: 60s timeout, retry on CI, artifact upload (traces, reports, screenshots, video)
- **Cross-platform**: Tests run on both Linux and Windows
- **Gap**: Small E2E suite (5 specs) relative to the application's complexity

**Coverage Tracking (Score: 2.0/10)**:
- No coverage tool integration
- No `.codecov.yml` or similar configuration
- No `--coverage` flag in test scripts
- No coverage thresholds or enforcement
- No PR coverage reporting

### Code Quality

**Linting**:
- **oxlint** (v1.60.0) — Fast Rust-based linter configured at root level
- **oxlint-tsgolint** (v0.21.0) — TypeScript-specific Go-style lint rules
- `bun run lint` = `oxlint`
- No ESLint (replaced by oxlint for performance)

**Formatting**:
- **Prettier** (v3.6.2) in devDependencies
- No format check in CI or pre-commit hooks

**Type Checking**:
- **tsgo** (TypeScript Go compiler) — runs `tsgo --noEmit` per package
- `bun typecheck` via Turborepo runs typecheck across all packages
- Pre-push hook enforces typecheck before push

**Pre-commit Hooks**:
- **Husky** (v9.1.7) installed
- **pre-push only**: Bun version check + `bun typecheck`
- **No pre-commit hook**: Missing lint, format, secret detection on commit

**Static Analysis**:
- No SAST tools (CodeQL, gosec, Semgrep)
- No secret detection (Gitleaks, TruffleHog)
- No `.pre-commit-config.yaml`

### Container Images

**Build Process (Score: 6.5/10)**:
- **Main Containerfile**: Multi-stage UBI9 build
  - Stage 1 (builder): Install Bun, Node, ripgrep, build OpenCode CLI
  - Stage 2 (runtime): UBI9 minimal with Python 3.12, git, uv, opencode binary
- **SHA256 verification**: All downloaded binaries verified with checksums
- **Multi-arch**: amd64 + arm64 with native runners
- **Runtime validation**: `opencode --version` in Containerfile
- **PR validation**: `build-openshift-image.yml` builds on PRs (no push) for both platforms

**Gaps**:
- No Trivy/Snyk vulnerability scanning
- No SBOM generation
- No image signing/attestation (except for Electron desktop builds)
- No runtime functional testing beyond `--version`
- No Testcontainers or Kind deployment testing

### Security

**Security Practices (Limited)**:
- `SECURITY.md` with threat model and responsible disclosure process
- Clear out-of-scope definition for server mode, sandbox escapes, LLM provider handling
- Binary code signing (macOS + Windows) for desktop app
- Azure Trusted Signing for Windows artifacts
- SHA256 verification for all downloaded binaries in container builds

**Gaps**:
- No automated SAST scanning
- No container image scanning
- No dependency vulnerability scanning
- No secret detection in CI
- No SBOM generation
- No supply chain security (SLSA, Sigstore)

### Agent Rules (Agentic Flow Quality)

**Status**: Present — `AGENTS.md` at root
**Coverage**: Comprehensive style guide, limited test automation guidance
**Quality**: High-quality coding standards, missing test creation rules

**What's in AGENTS.md**:
- Branch naming conventions
- Commit and PR title format (conventional commits)
- Comprehensive TypeScript style guide (destructuring, imports, control flow, schema definitions)
- Testing philosophy: "Avoid mocks as much as possible", "Test actual implementation"
- V2 Session Core architectural constraints
- Package-specific guidance (`packages/opencode`, `packages/core`)

**What's Missing**:
- No `.claude/rules/` directory with test-type-specific rules
- No unit test creation patterns or templates
- No E2E test creation guidance
- No integration test patterns
- No test fixture guidance
- No coverage expectations per test type

### Build Integration

**PR Build Validation (Score: 7.5/10)**:
- Container image build validated on PRs (both amd64 + arm64)
- TypeScript typecheck on PRs
- Nix flake evaluation on PRs (all systems)
- Storybook build validation on PRs
- Unit tests + E2E tests on PRs

**Gaps**:
- No Konflux build simulation
- No operator/manifest validation (not applicable — this is not a Kubernetes operator)
- No module federation validation

## Recommendations

### Priority 0 (Critical)

1. **Implement test coverage tracking with codecov**
   - Add `--coverage` to Bun test commands
   - Configure `codecov/codecov-action` in test workflow
   - Set minimum coverage thresholds (e.g., 70% for new code)
   - Enable PR-level coverage comments

2. **Add container image vulnerability scanning**
   - Integrate Trivy in `build-openshift-image.yml`
   - Set severity thresholds (CRITICAL + HIGH block)
   - Upload SARIF results to GitHub Security tab

3. **Add SAST scanning for TypeScript code**
   - Add CodeQL workflow for `javascript-typescript` language
   - Or use Semgrep with TypeScript rulesets
   - Run on PRs and push to dev branch

### Priority 1 (High Value)

4. **Add dependency vulnerability scanning**
   - Enable Dependabot or Renovate for automated dependency updates
   - Configure security-only updates at minimum

5. **Add secret detection to PR workflow**
   - Integrate Gitleaks or TruffleHog action
   - Critical given the project handles API keys and provider credentials

6. **Add contract tests between SDK and server API**
   - The SDK is auto-generated, but API contract testing would catch drift
   - Leverage the HttpApi exerciser pattern for schema validation

7. **Enhance agent rules with test creation guidance**
   - Create `.claude/rules/` directory
   - Add `unit-tests.md` with Bun test patterns, fixtures, and naming conventions
   - Add `e2e-tests.md` with Playwright patterns for smoke and regression tests
   - Add `recorded-tests.md` with guidance on the recorded test playback pattern

### Priority 2 (Nice-to-Have)

8. **Add performance regression testing**
   - The project already has `bench:test` and `profile:test` scripts
   - Add CI workflow to track benchmarks over time

9. **Add accessibility testing for web/desktop UI**
   - Integrate axe-core with Playwright for accessibility checks
   - Add to E2E test suite

10. **Strengthen pre-commit hooks**
    - Add oxlint check to pre-commit (not just pre-push)
    - Add prettier format check
    - Add secret detection

11. **Add SBOM generation for container images**
    - Generate SBOM with syft during container build
    - Attach to container image as attestation

## Comparison to Gold Standards

| Capability | opencode | odh-dashboard | notebooks | kserve |
|-----------|----------|---------------|-----------|--------|
| Unit Tests | 549 files (Bun) | Comprehensive (Jest) | Basic | Extensive (Go) |
| E2E Tests | Playwright (5 specs) | Cypress (50+ specs) | N/A | E2E suite |
| Coverage Tracking | None | Codecov enforced | None | Codecov enforced |
| Container Scanning | None | Trivy | Trivy | Trivy |
| SAST | None | None | None | CodeQL |
| Secret Detection | None | None | None | None |
| Pre-commit Hooks | Pre-push only | Comprehensive | Basic | Basic |
| Multi-arch Builds | amd64 + arm64 | Single arch | Multi-arch | Single arch |
| Code Signing | Yes (macOS/Win) | No | No | No |
| Agent Rules | AGENTS.md | .claude/rules/ | None | None |
| PR Standards | Automated enforcement | Manual review | N/A | Manual review |
| CI Workflows | 28 workflows | 15 workflows | 10 workflows | 20 workflows |
| AI Code Review | Yes (OpenCode bot) | No | No | No |

## File Paths Reference

### CI/CD
- `.github/workflows/test.yml` — Unit tests + E2E
- `.github/workflows/typecheck.yml` — TypeScript checking
- `.github/workflows/build-openshift-image.yml` — Container builds
- `.github/workflows/publish.yml` — Release pipeline
- `.github/workflows/pr-standards.yml` — PR validation
- `.github/workflows/review.yml` — AI code review

### Testing
- `packages/core/test/` — Core library tests (100+)
- `packages/opencode/test/` — Main package tests (180+)
- `packages/app/src/` — App component tests (70+)
- `packages/app/e2e/` — Playwright E2E tests
- `packages/llm/test/` — LLM provider tests
- `packages/tui/test/` — TUI component tests

### Code Quality
- `.husky/pre-push` — Pre-push typecheck hook
- `package.json` — oxlint, prettier, husky config
- `turbo.json` — Turborepo task config

### Container Images
- `Containerfile` — Main UBI9 multi-stage build
- `packages/opencode/Dockerfile` — Development Dockerfile
- `packages/containers/` — Supporting container images

### Agent Rules
- `AGENTS.md` — Style guide and coding standards
- `CONTEXT.md` — Session runtime architecture documentation
- `CONTRIBUTING.md` — Contribution guidelines
- `SECURITY.md` — Security threat model and disclosure process
