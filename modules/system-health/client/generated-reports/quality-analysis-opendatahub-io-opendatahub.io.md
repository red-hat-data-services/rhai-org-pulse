---
repository: "opendatahub-io/opendatahub.io"
overall_score: 2.4
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No test files exist; no testing framework installed"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests; no Cypress/Playwright/Jest configured"
  - dimension: "Build Integration"
    score: 3.0
    status: "PR workflow runs gatsby build but no type-check, lint, or image validation"
  - dimension: "Image Testing"
    score: 0.0
    status: "No Dockerfile, no container builds, no image testing"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tools configured; no codecov, coveralls, or thresholds"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "Three workflows present (PR build, deploy, Pages) with caching but minimal validation"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "Zero test coverage — no tests of any kind"
    impact: "Regressions, broken pages, and rendering issues are completely undetectable before merge"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No linting or static analysis in CI"
    impact: "Code quality issues, unused imports, and type errors slip into main unchecked"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No security scanning"
    impact: "Vulnerable dependencies (npm) are never detected; no Dependabot, Snyk, or Trivy"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "PR workflow only runs build — no typecheck"
    impact: "TypeScript type errors can merge despite strict: true in tsconfig"
    severity: "MEDIUM"
    effort: "30 minutes"
  - title: "Duplicate deployment workflows"
    impact: "deploy-site.yml and gatsby.yml both deploy on push to main, risking race conditions"
    severity: "MEDIUM"
    effort: "1 hour"
quick_wins:
  - title: "Add npm run typecheck to PR workflow"
    effort: "30 minutes"
    impact: "Catch type errors before merge — tsconfig already has strict: true"
  - title: "Add ESLint with React/TypeScript plugins"
    effort: "2 hours"
    impact: "Catch code quality issues, unused variables, accessibility problems"
  - title: "Enable GitHub Dependabot for npm"
    effort: "30 minutes"
    impact: "Automated dependency vulnerability alerts and PRs"
  - title: "Add Lighthouse CI to PR workflow"
    effort: "2-3 hours"
    impact: "Catch performance regressions, accessibility issues, and SEO problems for every PR"
  - title: "Consolidate duplicate deploy workflows"
    effort: "1 hour"
    impact: "Eliminate race conditions between deploy-site.yml and gatsby.yml"
recommendations:
  priority_0:
    - "Add ESLint + TypeScript type checking to PR workflow to establish minimum quality gate"
    - "Enable Dependabot or Renovate for automated dependency vulnerability scanning"
    - "Add at least smoke-level unit tests for key components (Navbar, Layout, ContentCard)"
  priority_1:
    - "Add Cypress or Playwright E2E tests for critical pages (homepage, docs, blog)"
    - "Add Lighthouse CI for performance/accessibility regression detection"
    - "Create agent rules (.claude/rules/) for test creation and code quality standards"
  priority_2:
    - "Add visual regression testing (Percy, Chromatic) for UI consistency"
    - "Add link checking automation to catch broken internal/external links"
    - "Containerize the build for reproducibility and add image scanning"
---

# Quality Analysis: opendatahub.io

## Executive Summary

- **Overall Score: 2.4/10**
- **Repository Type**: Static website (Gatsby 5 + React 18 + TypeScript + PatternFly)
- **Primary Language**: TypeScript/TSX (~4,000 lines across 39 source files)
- **Key Strengths**: TypeScript strict mode enabled, Prettier configured, Gatsby build caching in CI
- **Critical Gaps**: Zero tests of any kind, no linting, no security scanning, no coverage tracking
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

This is the public-facing website for the Open Data Hub project. As a Gatsby static site with ~4,000 lines of TypeScript, it has minimal quality infrastructure. The only PR-time validation is a Gatsby build check. There are no tests, no linter, no type checking in CI, and no security scanning. The site has two competing deployment workflows that could cause race conditions.

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 0/10 | 20% | No test files exist; no testing framework installed |
| Integration/E2E | 0/10 | 25% | No integration or E2E tests configured |
| Build Integration | 3/10 | — | PR workflow runs gatsby build only — no typecheck, no lint |
| Image Testing | 0/10 | 20% | No Dockerfile, no container builds |
| Coverage Tracking | 0/10 | 15% | No coverage tools or thresholds |
| CI/CD Automation | 5/10 | 20% | Three workflows with caching but minimal validation gates |
| Agent Rules | 0/10 | — | No agent rules or test automation guidance |
| **Overall** | **2.4/10** | | **Critical quality infrastructure gaps** |

## Critical Gaps

### 1. Zero Test Coverage — No Tests of Any Kind
- **Severity**: HIGH
- **Impact**: Regressions, broken pages, rendering issues, and broken links are completely undetectable before merge. Every PR is a gamble.
- **Current State**: No `*.test.*`, `*.spec.*`, or `*_test.*` files exist. No testing framework (Jest, Vitest, Cypress, Playwright) is installed.
- **Effort to Fix**: 16-24 hours (framework setup + initial component tests + E2E smoke tests)

### 2. No Linting or Static Analysis in CI
- **Severity**: HIGH
- **Impact**: Code quality issues, unused imports, accessibility violations, and inconsistent patterns slip into main unchecked.
- **Current State**: No ESLint configuration. Only Prettier is configured (for import ordering). No pre-commit hooks.
- **Effort to Fix**: 2-4 hours (ESLint setup + CI integration + initial rule configuration)

### 3. No Security Scanning
- **Severity**: HIGH
- **Impact**: The project has 30+ npm dependencies including Gatsby plugins, React, and third-party libraries. Vulnerable dependencies are never detected.
- **Current State**: No Dependabot, no Snyk, no npm audit in CI, no CodeQL.
- **Effort to Fix**: 1-2 hours (Dependabot config + npm audit in PR workflow)

### 4. PR Workflow Missing TypeScript Type Checking
- **Severity**: MEDIUM
- **Impact**: Despite having `strict: true` in `tsconfig.json` and a `typecheck` npm script, the PR workflow only runs `npm run build`. TypeScript errors may not always be caught by the Gatsby build.
- **Effort to Fix**: 30 minutes (add `npm run typecheck` step)

### 5. Duplicate Deployment Workflows
- **Severity**: MEDIUM
- **Impact**: `deploy-site.yml` deploys via `github-pages-deploy-action` to `gh-pages` branch on push to main AND on a daily cron. `gatsby.yml` deploys via GitHub Pages action on push to main. Both trigger on the same event, potentially causing race conditions.
- **Effort to Fix**: 1 hour (consolidate into single workflow)

## Quick Wins

### 1. Add TypeScript Type Checking to PR Workflow (30 minutes)
The `typecheck` npm script already exists. Add one line to `.github/workflows/pull-request.yml`:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run typecheck
      - run: npm run build
```

### 2. Add ESLint with React/TypeScript Plugins (2 hours)
```bash
npm install --save-dev eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-react eslint-plugin-jsx-a11y
```

Add lint step to PR workflow for immediate code quality feedback.

### 3. Enable GitHub Dependabot (30 minutes)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 4. Add Lighthouse CI to PR Workflow (2-3 hours)
Gatsby sites benefit enormously from Lighthouse CI — catches performance regressions, accessibility issues, and SEO problems automatically.

### 5. Consolidate Duplicate Deploy Workflows (1 hour)
Remove `deploy-site.yml` and keep `gatsby.yml` (which uses the modern GitHub Pages deploy action with proper permissions). Update the daily cron to trigger `gatsby.yml` instead.

## Detailed Findings

### CI/CD Pipeline

**Workflows Found (3):**

| Workflow | Trigger | Purpose | Issues |
|----------|---------|---------|--------|
| `pull-request.yml` | PR | Build validation | Only runs `npm ci` + `npm run build`. No typecheck, no lint, no tests |
| `gatsby.yml` | Push to main, manual | Deploy to GitHub Pages | Modern setup with caching, Node 20, proper permissions |
| `deploy-site.yml` | Push to main, daily cron | Deploy to gh-pages branch | Legacy approach, conflicts with gatsby.yml |

**Strengths:**
- `gatsby.yml` has proper caching (Gatsby public/ and .cache/)
- Node.js version pinned to 20
- Concurrency control on Pages deployment (`cancel-in-progress: false` — correct for deployments)

**Weaknesses:**
- PR workflow uses outdated `actions/checkout@v3` (should be v4)
- No caching in PR workflow (slower builds)
- No type checking in any workflow
- No linting in any workflow
- Two competing deployment workflows

### Test Coverage

**Status: No tests exist.**

- 0 test files across the entire repository
- No testing framework in `devDependencies` (no Jest, Vitest, Cypress, Playwright, Testing Library)
- No test npm scripts
- Test-to-code ratio: 0:1
- Coverage: N/A

**What Should Be Tested:**
- **Component rendering**: Navbar, Layout, Footer, ContentCard, SectionLayout
- **Page generation**: Gatsby page creation from markdown/MDX content
- **Routing**: Blog post URLs, docs navigation, 404 handling
- **Content**: Blog posts render correctly, docs pages load, images display
- **External data**: gatsby-source-git pulls documentation correctly

### Code Quality

**Formatter:**
- Prettier configured with import ordering (`importOrder`, `importOrderSeparation`, `importOrderSortSpecifiers`)
- `.prettierignore` exists
- No Prettier check in CI — formatting is advisory only

**TypeScript:**
- `strict: true` enabled in `tsconfig.json`
- `noImplicitReturns: true`, `noImplicitThis: true`
- `noImplicitAny: false` — weakens strict mode
- `typecheck` script exists but is not run in CI

**Linting:**
- No ESLint configuration
- No accessibility linting (jsx-a11y)
- No React-specific rules

**Pre-commit Hooks:**
- None configured
- No `.pre-commit-config.yaml`
- No husky or lint-staged

### Container Images

**Status: Not applicable.** This is a static site deployed via GitHub Pages. There is no Dockerfile, Containerfile, or container build process. The site is built as static HTML/CSS/JS and served directly.

### Security

**Status: No security practices configured.**

- No Dependabot configuration
- No npm audit in CI
- No CodeQL or SAST
- No secret detection (gitleaks, trufflehog)
- No dependency review action on PRs
- Actions use unpinned versions (v3, v4 — should use SHA pinning for supply chain security)

### Agent Rules (Agentic Flow Quality)

**Status: Missing**

- No `CLAUDE.md` or `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` for test creation guidance
- No `.claude/skills/` for custom skills
- No testing documentation in `docs/`
- `CONTRIBUTING.md` exists but covers only basic dev setup — no quality standards

**Recommendation**: Generate test creation rules with `/test-rules-generator` to establish:
- Component test patterns (React Testing Library + Jest/Vitest)
- Gatsby page test patterns
- Accessibility test standards
- E2E test patterns for critical user journeys

## Recommendations

### Priority 0 (Critical — Do First)

1. **Add ESLint + TypeScript type checking to PR workflow**
   - Install ESLint with React, TypeScript, and jsx-a11y plugins
   - Add `npm run typecheck` and `npm run lint` to PR workflow
   - Provides immediate code quality gate with zero test writing required
   - Effort: 2-4 hours

2. **Enable Dependabot for npm and GitHub Actions**
   - Create `.github/dependabot.yml` for weekly vulnerability scanning
   - Add `dependency-review-action` to PR workflow
   - Effort: 30 minutes

3. **Add initial component tests**
   - Install Vitest + React Testing Library (or Jest)
   - Write smoke tests for Layout, Navbar, Footer, ContentCard
   - Add test script and CI step
   - Effort: 8-12 hours

### Priority 1 (High Value — Do Next)

4. **Add Cypress or Playwright E2E tests for critical pages**
   - Homepage renders, navigation works, blog listing loads, docs render
   - Run on PR with Gatsby serve
   - Effort: 8-12 hours

5. **Add Lighthouse CI for performance and accessibility**
   - Catch regressions in Core Web Vitals, accessibility scores, SEO
   - Set thresholds to prevent degradation
   - Effort: 2-3 hours

6. **Create agent rules (.claude/rules/)**
   - Define test patterns for React components
   - Define Gatsby-specific testing conventions
   - Establish code quality standards
   - Effort: 2-3 hours

7. **Consolidate deployment workflows**
   - Remove legacy `deploy-site.yml`
   - Add daily cron trigger to `gatsby.yml`
   - Effort: 1 hour

### Priority 2 (Nice-to-Have)

8. **Add visual regression testing** (Percy, Chromatic, or Playwright screenshots)
   - Catch unintended visual changes to the public website
   - Effort: 4-6 hours

9. **Add broken link detection**
   - Check internal links and external URLs (gatsby-plugin-check-links or similar)
   - Effort: 2-3 hours

10. **Pin GitHub Actions to SHA for supply chain security**
    - Replace `@v3`, `@v4` with full commit SHAs
    - Effort: 1 hour

## Comparison to Gold Standards

| Practice | opendatahub.io | odh-dashboard (Gold) | notebooks (Gold) |
|----------|---------------|---------------------|-----------------|
| Unit Tests | None | Jest + RTL, comprehensive | Python unittest |
| E2E Tests | None | Cypress, multi-scenario | Selenium, multi-notebook |
| Linting | Prettier only | ESLint + Stylelint + strict | Flake8 + Black |
| Type Checking | tsconfig strict (not in CI) | TypeScript strict (in CI) | N/A (Python) |
| Coverage | None | Codecov with thresholds | Coverage reports |
| Security Scanning | None | Snyk + CodeQL | Trivy + Snyk |
| Pre-commit Hooks | None | Husky + lint-staged | Pre-commit framework |
| Agent Rules | None | Comprehensive .claude/rules/ | None |
| PR Validation | Build only | Build + lint + typecheck + test | Build + test + scan |
| Image Testing | N/A | N/A (deployed separately) | 5-layer validation |
| CI Caching | Partial (deploy only) | Full (node_modules, build cache) | Full |

## File Paths Reference

| File | Purpose | Notes |
|------|---------|-------|
| `package.json` | Project config | No test scripts, no ESLint |
| `tsconfig.json` | TypeScript config | strict: true, noImplicitAny: false |
| `.prettierrc` | Formatter config | Import ordering only |
| `.github/workflows/pull-request.yml` | PR validation | Build-only, no tests/lint/typecheck |
| `.github/workflows/gatsby.yml` | Pages deployment | Modern setup with caching |
| `.github/workflows/deploy-site.yml` | Legacy deployment | Conflicts with gatsby.yml |
| `CONTRIBUTING.md` | Dev guide | Basic setup only, no quality standards |
| `gatsby-config.ts` | Gatsby plugins | Source filesystem, git sources, image processing |
| `gatsby-node.ts` | Page generation | Creates blog, docs, and content pages |
| `src/components/` | React components | 20+ components, zero tests |
