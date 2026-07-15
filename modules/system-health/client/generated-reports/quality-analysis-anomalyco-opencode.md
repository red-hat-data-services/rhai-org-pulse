---
repository: "anomalyco/opencode"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "675 test files across 30+ packages with bun:test, strong test-to-code ratio (1:3.3)"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "52 Playwright E2E specs with regression, smoke, and performance suites, cross-platform CI"
  - dimension: "Build Integration"
    score: 5.0
    status: "Container builds only on push to dev, no PR-time image validation or multi-arch PR testing"
  - dimension: "Image Testing"
    score: 5.5
    status: "Multi-arch Dockerfile with startup validation (RUN opencode --version), but no runtime testing"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "No codecov/coveralls integration, no coverage thresholds, no PR coverage reporting"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "24+ workflows with concurrency control, Turbo caching, Blacksmith runners, multi-platform"
  - dimension: "Agent Rules"
    score: 9.0
    status: "Comprehensive AGENTS.md with style guide, test patterns, commit conventions; .opencode/ with custom tools, agents, and skills"
critical_gaps:
  - title: "No test coverage tracking or enforcement"
    impact: "Coverage regressions go undetected; no visibility into which code paths are untested"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No security scanning in CI (no Trivy, CodeQL, or SAST)"
    impact: "Vulnerabilities in dependencies and code are not detected before merge"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No PR-time container image build validation"
    impact: "Image build failures discovered only after merge to dev branch"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "No dependency vulnerability scanning"
    impact: "Known CVEs in npm packages can ship without detection"
    severity: "HIGH"
    effort: "2-4 hours"
quick_wins:
  - title: "Add codecov integration with bun:test coverage output"
    effort: "3-4 hours"
    impact: "Immediate visibility into test coverage trends and PR-level coverage delta reporting"
  - title: "Add GitHub CodeQL or Semgrep workflow"
    effort: "1-2 hours"
    impact: "Automated SAST catches injection, XSS, and prototype pollution in TypeScript"
  - title: "Add npm audit / Snyk to PR workflow"
    effort: "1-2 hours"
    impact: "Block PRs that introduce dependencies with known critical vulnerabilities"
  - title: "Add container build step to PR test workflow"
    effort: "2-3 hours"
    impact: "Catch Dockerfile and build script failures before merge"
recommendations:
  priority_0:
    - "Implement test coverage tracking with codecov or coveralls - bun:test supports coverage output, wire it into CI and set minimum thresholds"
    - "Add SAST scanning (CodeQL or Semgrep) to PR workflow for automated security analysis"
    - "Add dependency vulnerability scanning (npm audit, Snyk, or Dependabot) to catch known CVEs"
  priority_1:
    - "Add PR-time container image build validation to catch Dockerfile issues before merge"
    - "Add Trivy or Snyk container scanning to the containers workflow for image vulnerability detection"
    - "Add integration tests for the HTTP API server with full request-response lifecycle validation"
  priority_2:
    - "Add accessibility testing (axe-core) to the Playwright E2E suite"
    - "Add visual regression testing with Playwright screenshot comparison"
    - "Consider adding mutation testing to validate test quality"
---

# Quality Analysis: OpenCode (anomalyco/opencode)

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: TypeScript/Bun monorepo - AI-powered development tool (TUI, web app, desktop app, CLI, SDK)
- **Primary Language**: TypeScript (2,261 source files)
- **Package Manager**: Bun 1.3.14 with Turborepo
- **Framework**: SolidJS (frontend), Effect (backend), Playwright (E2E), Electron (desktop)

### Key Strengths
- **Exceptional test density**: 675 test files across 30+ packages with a 1:3.3 test-to-source ratio
- **Comprehensive E2E suite**: 52 Playwright specs organized into smoke, regression, and performance categories with cross-platform (Linux + Windows) CI
- **Sophisticated CI/CD**: 24+ GitHub Actions workflows with concurrency control, Turbo caching, Blacksmith runners, and matrix strategies
- **Strong agent rules**: Detailed AGENTS.md with style guide, testing philosophy, and commit conventions; plus `.opencode/` directory with custom tools, agents, commands, and skills
- **Contract testing**: Schema contract hygiene tests and client-server contract identity verification
- **Performance testing**: Dedicated Playwright performance benchmarks with Chrome trace analysis

### Critical Gaps
- **No test coverage tracking** - No codecov, coveralls, or any coverage reporting
- **No security scanning** - No CodeQL, Semgrep, Trivy, or SAST in any workflow
- **No dependency scanning** - No npm audit, Snyk, or Dependabot configuration
- **Container builds not validated on PRs** - Image builds only run on push to dev

### Agent Rules Status: **Comprehensive**
- AGENTS.md provides detailed style guide, testing philosophy ("avoid mocks"), commit conventions
- `.opencode/` directory with custom tools, agents, commands, skills, and glossaries
- Performance test suite has its own AGENTS.md with benchmark-specific guidance

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | 675 test files, bun:test framework, strong coverage across all packages |
| Integration/E2E | 8.5/10 | 52 Playwright specs, cross-platform CI (Linux + Windows), regression + smoke + perf |
| **Build Integration** | **5.0/10** | **Container builds on push to dev only, no PR-time image validation** |
| Image Testing | 5.5/10 | Multi-arch Dockerfile with startup check, but no runtime or security scanning |
| Coverage Tracking | 2.0/10 | No coverage tool integration, no thresholds, no PR reporting |
| CI/CD Automation | 8.5/10 | 24+ workflows, concurrency control, Turbo cache, Blacksmith, multi-platform |
| Agent Rules | 9.0/10 | AGENTS.md + .opencode/ with tools, agents, commands, skills, glossaries |

## Critical Gaps

### 1. No Test Coverage Tracking or Enforcement
- **Impact**: Coverage regressions go completely undetected; no visibility into which code paths lack tests
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Despite 675 test files, there is no codecov/coveralls integration, no coverage thresholds, and no PR-level coverage delta reporting. `bun:test` supports `--coverage` flag but it's not wired into CI.

### 2. No Security Scanning in CI
- **Impact**: Vulnerabilities in code and dependencies are not detected before merge
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No CodeQL, Semgrep, Trivy, Snyk, or any SAST/DAST tool is configured in any workflow. The `.gitleaksignore` file exists (for test data), but no Gitleaks workflow runs. The project has a SECURITY.md with threat model but no automated scanning.

### 3. No Dependency Vulnerability Scanning
- **Impact**: Known CVEs in npm packages can ship without detection
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Dependabot, Renovate, npm audit, or Snyk configured. The project has 14+ patched dependencies (listed in package.json `patchedDependencies`), suggesting awareness of dependency issues, but no automated scanning catches new ones.

### 4. No PR-Time Container Image Build Validation
- **Impact**: Dockerfile or build script failures discovered only after merge to dev
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: The `containers.yml` workflow only triggers on push to dev branch (paths: `packages/containers/**`). The main `opencode` Dockerfile is not built or validated on PRs at all.

## Quick Wins

### 1. Add Codecov Integration (3-4 hours)
- **Impact**: Immediate visibility into test coverage trends and PR-level coverage delta
- **Implementation**:
  ```yaml
  # Add to .github/workflows/test.yml after "Run unit tests" step
  - name: Generate coverage
    run: bun turbo test -- --coverage
  - name: Upload coverage
    uses: codecov/codecov-action@v4
    with:
      token: ${{ secrets.CODECOV_TOKEN }}
  ```

### 2. Add CodeQL/Semgrep Workflow (1-2 hours)
- **Impact**: Automated SAST catches injection, XSS, and prototype pollution patterns
- **Implementation**:
  ```yaml
  # .github/workflows/codeql.yml
  name: CodeQL
  on: [push, pull_request]
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

### 3. Add npm audit to PR Workflow (1-2 hours)
- **Impact**: Block PRs that introduce dependencies with known critical vulnerabilities
- **Implementation**: Add `bun pm audit` or equivalent step to the test workflow.

### 4. Add Container Build to PR Workflow (2-3 hours)
- **Impact**: Catch Dockerfile and build script failures before merge
- **Implementation**: Add a build-only (no push) container step to the test workflow with path filtering.

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory (24+ workflows):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | PR, push to dev | Unit tests (Linux + Windows matrix) + E2E (Playwright, Linux + Windows) |
| `typecheck.yml` | PR to dev, push to dev | TypeScript type checking via `bun typecheck` |
| `storybook.yml` | PR to dev, push to dev | Storybook build validation (path-filtered) |
| `nix-eval.yml` | PR to dev, push to dev | Nix flake evaluation across 4 platforms |
| `containers.yml` | Push to dev (path-filtered) | Multi-arch container builds with QEMU/Buildx |
| `publish.yml` | Push to dev/ci/beta, manual | Full release pipeline: version, build, publish |
| `deploy.yml` | Push to dev/production | SST deployment to AWS |
| `pr-standards.yml` | PR opened/edited/sync | Conventional commit title enforcement, issue linking |
| `pr-management.yml` | PR opened | Duplicate PR detection (AI-powered via opencode) |
| `review.yml` | Issue comment `/review` | AI-powered code review (uses opencode + GPT-5.5) |
| `opencode.yml` | Issue/PR comment `/oc` | AI coding assistant triggered by comments |
| `beta.yml` | Hourly schedule | Beta branch sync |
| `close-issues.yml` / `close-prs.yml` | Scheduled | Stale issue/PR management |

**Strengths:**
- Concurrency control with smart grouping (keeps dev runs, cancels stale PRs)
- Turbo cache with SHA-based keys for fast incremental builds
- Blacksmith runners (4-vCPU) for faster CI execution
- Cross-platform testing (Linux + Windows) for both unit and E2E
- Pinned action versions with SHA hashes (supply chain security)
- Artifact upload for Playwright test results with 7-day retention
- AI-powered PR review and duplicate detection workflows

**Gaps:**
- No security scanning workflows
- No coverage upload step
- Container builds not validated on PRs

### Test Coverage

**Unit Tests (Score: 8.5/10)**
- **Framework**: `bun:test` (native Bun test runner)
- **Test files**: 675 across all packages
- **Source files**: 2,261 TypeScript files
- **Test-to-code ratio**: 1:3.3 (strong)
- **Key packages tested**: core (100+ test files), opencode (80+ test files), llm, tui, client, schema, protocol, session-ui, ui
- **Testing philosophy**: "Avoid mocks as much as possible... Test actual implementation, do not duplicate logic into tests" (AGENTS.md)
- **Notable patterns**: Effect-based test helpers, custom `testEffect` wrappers, fixture-based testing

**Integration/E2E Tests (Score: 8.5/10)**
- **Framework**: Playwright 1.59.1 with Chromium
- **E2E specs**: 52 Playwright spec files
- **Organization**: `smoke/`, `regression/`, `performance/` directories
- **Configuration**: 60s timeout, retry on CI (2 retries), parallel execution, trace on retry, screenshot on failure, video on failure
- **Mock server**: Custom SSE transport mock for testing without real LLM backends
- **Performance suite**: Chrome trace analysis, visual stability benchmarks, navigation milestone tracking
- **Cross-platform**: Runs on both Linux and Windows in CI
- **Special**: HTTP API exerciser (`test:httpapi`) with coverage, auth, and effect modes

**Contract Tests**
- Schema contract hygiene tests verify type safety and encoding
- Client contract identity tests ensure Core and Server reuse authoritative Schema values
- Import boundary tests verify package dependency constraints

**Coverage Tracking (Score: 2.0/10)**
- No codecov or coveralls integration
- No coverage thresholds configured
- No PR coverage reporting
- `bun:test` supports `--coverage` but it's not used in CI

### Code Quality

**Linting (Strong)**
- **Tool**: OxLint 1.60.0 (fast Rust-based linter)
- **Configuration**: `.oxlintrc.json` with type-aware mode enabled
- **Categories**: `suspicious: warn` with targeted rule overrides
- **Notable rules**: `typescript/no-floating-promises: warn`, `typescript/no-misused-spread: warn`
- **Ignore patterns**: node_modules, dist, .build, .sst, .d.ts, generated files

**Formatting**
- **Tool**: Prettier 3.6.2
- **Config**: `semi: false`, `printWidth: 120`
- **EditorConfig**: UTF-8, LF line endings, 2-space indent

**Pre-commit Hooks**
- **Tool**: Husky 9.1.7
- **Setup**: `prepare: "husky"` script in package.json
- No `.pre-commit-config.yaml` (uses Husky directly)

**TypeScript**
- Extends `@tsconfig/bun/tsconfig.json`
- Type checking via `bun typecheck` (Turbo-orchestrated)
- Enforced in CI via dedicated `typecheck.yml` workflow

**Static Analysis**
- OxLint provides some static analysis via its `suspicious` category
- No dedicated SAST tool (CodeQL, Semgrep) configured

### Container Images

**Build Process (Score: 5.5/10)**
- 7 Dockerfiles across packages (opencode, stats/server, containers/*)
- Main Dockerfile uses multi-stage build with Alpine base
- Multi-architecture support (amd64, arm64) via QEMU/Buildx
- Startup validation: `RUN opencode --version` in Dockerfile
- GHCR registry with automated push

**Gaps:**
- No container vulnerability scanning (Trivy, Snyk)
- No SBOM generation
- No image signing/attestation
- No runtime functional testing of containers
- Container builds not in PR workflow

### Security

**Current State:**
- `.gitleaksignore` file exists (for test fixture false positives)
- SECURITY.md with detailed threat model and responsible disclosure
- Action SHAs pinned in workflows (supply chain security)
- `.dockerignore` present

**Missing:**
- No CodeQL, Semgrep, or any SAST tool
- No Trivy, Snyk, or container scanning
- No Dependabot or Renovate for dependency updates
- No npm audit in CI
- No secret scanning workflow (despite `.gitleaksignore`)

### Agent Rules (Agentic Flow Quality)

**Status**: Comprehensive and well-structured

**AGENTS.md** (root-level):
- Detailed style guide covering imports, variables, control flow, destructuring
- Schema definitions (Drizzle conventions)
- Testing philosophy ("avoid mocks", "test actual implementation")
- Commit conventions (conventional commits)
- Branch naming conventions
- TypeScript checking guidelines
- V2 Session Core architectural constraints

**.opencode/ Directory**:
- Custom tools: `github-triage.ts`, `github-pr-search.ts`
- Custom agents: `triage.md`, `duplicate-pr.md`
- Custom commands: `translate.md`, `spellcheck.md`, `rmslop.md`, `learn.md`, `issues.md`, `commit.md`, `changelog.md`, `ai-deps.md`
- Skills: `effect/SKILL.md`
- Themes: Custom TUI themes
- Glossaries: 15+ language glossaries for i18n
- Plugins: TUI smoke test plugin

**Performance Tests AGENTS.md**: Dedicated agent rules for benchmark authoring

**Assessment**: This is one of the most comprehensive agent rule setups seen in any repository. The `.opencode/` directory functions as a complete agent development ecosystem with tools, commands, agents, and skills.

## Recommendations

### Priority 0 (Critical)

1. **Implement test coverage tracking with codecov**
   - Wire `bun:test --coverage` into CI
   - Upload to codecov with PR comments
   - Set minimum thresholds (e.g., 60% initial, ratchet up)
   - Estimated effort: 4-6 hours

2. **Add SAST scanning to PR workflow**
   - Add CodeQL for TypeScript/JavaScript analysis
   - Or Semgrep with TypeScript rules
   - Block PRs with high-severity findings
   - Estimated effort: 2-4 hours

3. **Add dependency vulnerability scanning**
   - Enable Dependabot or configure Snyk
   - Add `bun pm audit` step to test workflow
   - Set severity thresholds for blocking
   - Estimated effort: 2-4 hours

### Priority 1 (High Value)

4. **Add PR-time container build validation**
   - Add build-only Docker step to test workflow (path-filtered)
   - Validate multi-arch builds before merge
   - Estimated effort: 4-8 hours

5. **Add Trivy container scanning**
   - Integrate into `containers.yml` workflow
   - Scan for OS and library vulnerabilities
   - Generate SBOM as build artifact
   - Estimated effort: 2-4 hours

6. **Add secret scanning with Gitleaks**
   - Create dedicated workflow (the `.gitleaksignore` already exists)
   - Run on PRs and periodic schedule
   - Estimated effort: 1-2 hours

### Priority 2 (Nice-to-Have)

7. **Add accessibility testing**
   - Integrate `@axe-core/playwright` into E2E suite
   - Validate WCAG compliance for web UI
   - Estimated effort: 4-6 hours

8. **Add visual regression testing**
   - Use Playwright screenshot comparison
   - Baseline screenshots for key UI states
   - Estimated effort: 4-6 hours

9. **Consider mutation testing**
   - Evaluate Stryker for TypeScript
   - Validate that existing tests catch real bugs
   - Estimated effort: 8-12 hours

## Comparison to Gold Standards

| Dimension | OpenCode | odh-dashboard | notebooks | kserve |
|-----------|----------|---------------|-----------|--------|
| Unit Tests | 8.5 | 9.0 | 7.0 | 8.5 |
| Integration/E2E | 8.5 | 9.5 | 6.0 | 9.0 |
| Build Integration | 5.0 | 7.0 | 8.0 | 7.0 |
| Image Testing | 5.5 | 6.0 | 9.5 | 6.0 |
| Coverage Tracking | 2.0 | 8.0 | 5.0 | 9.0 |
| CI/CD Automation | 8.5 | 9.0 | 8.0 | 8.5 |
| Agent Rules | 9.0 | 8.0 | 3.0 | 2.0 |
| **Security Scanning** | **1.0** | **7.0** | **6.0** | **7.0** |

**Key Takeaway**: OpenCode excels in testing, CI/CD, and agent rules but has significant blind spots in coverage tracking and security scanning that most mature projects have addressed.

## File Paths Reference

### CI/CD
- `.github/workflows/test.yml` - Main test workflow (unit + E2E)
- `.github/workflows/typecheck.yml` - TypeScript checking
- `.github/workflows/containers.yml` - Container builds
- `.github/workflows/publish.yml` - Release pipeline
- `.github/workflows/deploy.yml` - SST deployment
- `.github/workflows/pr-standards.yml` - PR conventional commit enforcement
- `.github/workflows/pr-management.yml` - AI duplicate detection
- `.github/workflows/review.yml` - AI code review
- `.github/workflows/storybook.yml` - Storybook build
- `.github/workflows/nix-eval.yml` - Nix flake evaluation

### Testing
- `packages/core/test/` - Core package tests (100+ files)
- `packages/opencode/test/` - OpenCode package tests (80+ files)
- `packages/app/e2e/` - Playwright E2E tests (52 specs)
- `packages/app/e2e/regression/` - Regression tests
- `packages/app/e2e/smoke/` - Smoke tests
- `packages/app/e2e/performance/` - Performance benchmarks
- `packages/schema/test/contract-hygiene.test.ts` - Contract hygiene
- `packages/client/test/contract-identity.test.ts` - Contract identity

### Code Quality
- `.oxlintrc.json` - OxLint configuration (type-aware)
- `tsconfig.json` - TypeScript configuration
- `.editorconfig` - Editor configuration
- `turbo.json` - Turborepo task configuration

### Container Images
- `packages/opencode/Dockerfile` - Main CLI container
- `packages/containers/` - Build containers (base, bun-node, rust, publish, tauri-linux)
- `.dockerignore` - Docker build context exclusions

### Agent Rules
- `AGENTS.md` - Main agent rules and style guide
- `.opencode/tool/` - Custom agent tools
- `.opencode/agent/` - Custom agents
- `.opencode/command/` - Custom commands
- `.opencode/skills/` - Custom skills
- `.opencode/glossary/` - i18n glossaries
- `packages/app/e2e/performance/AGENTS.md` - Performance test agent rules

### Security
- `SECURITY.md` - Security policy and threat model
- `.gitleaksignore` - Gitleaks false positive suppressions
