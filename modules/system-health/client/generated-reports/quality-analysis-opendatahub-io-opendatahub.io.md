---
repository: "opendatahub-io/opendatahub.io"
overall_score: 2.4
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No test files, no test framework, no test scripts"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E test infrastructure"
  - dimension: "Build Integration"
    score: 3.0
    status: "PR workflow runs gatsby build but no image build or deployment validation"
  - dimension: "Image Testing"
    score: 0.0
    status: "No Dockerfile, no container image, no image testing"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling, no codecov, no thresholds"
  - dimension: "CI/CD Automation"
    score: 4.0
    status: "Three workflows (PR build, deploy, scheduled deploy) with basic caching but no concurrency on PR jobs"
  - dimension: "Static Analysis"
    score: 3.0
    status: "TypeScript strict mode and Prettier configured; no ESLint, no Dependabot, no pre-commit hooks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no AGENTS.md, no .claude/ directory"
critical_gaps:
  - title: "Zero test coverage — no unit, integration, or E2E tests"
    impact: "Regressions in layout, navigation, content rendering, and build logic go undetected until users report broken pages"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No ESLint or static analysis beyond TypeScript compiler"
    impact: "Code quality issues (unused imports, accessibility violations, React anti-patterns) are never flagged"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No dependency update automation (Dependabot/Renovate)"
    impact: "Outdated dependencies with known vulnerabilities accumulate silently; Gatsby 5 and PatternFly 4 are already behind latest"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Even if tests are added, there is no gate to prevent coverage from declining"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add Dependabot for npm dependency alerts"
    effort: "1 hour"
    impact: "Automated PRs for security patches and dependency updates"
  - title: "Add ESLint with React and accessibility plugins"
    effort: "2-3 hours"
    impact: "Catch common React bugs, accessibility issues, and code quality problems in PRs"
  - title: "Add basic smoke tests with Vitest"
    effort: "4-6 hours"
    impact: "Verify component rendering and Gatsby build output integrity"
  - title: "Create CLAUDE.md with project conventions"
    effort: "1-2 hours"
    impact: "Guide AI-assisted contributions to follow project patterns (PatternFly 4, Gatsby 5, TypeScript conventions)"
recommendations:
  priority_0:
    - "Introduce a test framework (Vitest or Jest) and add unit tests for key components and gatsby-node.ts build logic"
    - "Add ESLint with eslint-plugin-react, eslint-plugin-jsx-a11y, and TypeScript rules"
    - "Enable Dependabot for npm ecosystem to receive automated dependency update PRs"
  priority_1:
    - "Add visual regression testing with Playwright or Cypress for critical pages (home, docs, blog)"
    - "Add Codecov integration with coverage reporting on PRs"
    - "Create CLAUDE.md with project conventions and contributing guidelines for AI agents"
  priority_2:
    - "Add pre-commit hooks for Prettier and ESLint enforcement"
    - "Add accessibility testing (axe-core) to CI pipeline"
    - "Add link checking for broken internal and external links"
---

# Quality Analysis: opendatahub.io

## Executive Summary

- **Overall Score: 2.4/10**
- **Repository Type**: Static website (Gatsby 5 + React 18 + TypeScript)
- **Primary Language**: TypeScript (45 source files, ~1,532 lines)
- **Jira**: RHOAIENG / Documentation (midstream tier)
- **Key Strengths**: TypeScript strict mode enabled, Prettier for formatting, functional PR build gate
- **Critical Gaps**: Zero tests of any kind, no ESLint, no dependency automation, no coverage tracking, no agent rules
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 0.0/10 | No test files, no test framework, no test scripts |
| Integration/E2E | 20% | 0.0/10 | No integration or E2E test infrastructure |
| Build Integration | 15% | 3.0/10 | PR build gate exists but no image/deployment validation |
| Image Testing | 10% | 0.0/10 | No container images (static site deployed to GitHub Pages) |
| Coverage Tracking | 10% | 0.0/10 | No coverage tooling at all |
| CI/CD Automation | 15% | 4.0/10 | Basic 3-workflow setup with caching but minimal sophistication |
| Static Analysis | 10% | 3.0/10 | TypeScript strict + Prettier, but no ESLint or Dependabot |
| Agent Rules | 5% | 0.0/10 | No CLAUDE.md, AGENTS.md, or .claude/ directory |
| **Overall** | **100%** | **2.4/10** | |

## Critical Gaps

### 1. Zero Test Coverage — No Unit, Integration, or E2E Tests
- **Severity**: HIGH
- **Impact**: Regressions in layout, navigation, content rendering, and Gatsby build logic (`gatsby-node.ts`) go completely undetected until users report broken pages on the live site.
- **Effort**: 16-24 hours to establish foundation
- **Details**: The `package.json` contains zero test-related dependencies (no Jest, Vitest, Cypress, Playwright, or Testing Library). There are no `*.test.*`, `*.spec.*`, or `*_test.*` files. No `test/`, `tests/`, `e2e/`, or `__tests__/` directories exist. The `scripts` section has no `test` command.

### 2. No ESLint or Linting Beyond TypeScript Compiler
- **Severity**: HIGH
- **Impact**: The TypeScript compiler catches type errors, but code quality issues like unused variables, accessibility violations, React hook rule violations, and anti-patterns are never flagged.
- **Effort**: 2-4 hours
- **Details**: Only `.prettierrc` exists for formatting. No `.eslintrc.*`, `eslint.config.*`, or ESLint dependencies. For a React/TypeScript project, `eslint-plugin-react`, `eslint-plugin-react-hooks`, and `eslint-plugin-jsx-a11y` are standard expectations.

### 3. No Dependency Update Automation
- **Severity**: HIGH
- **Impact**: Dependencies accumulate known vulnerabilities silently. The project uses Gatsby 5.8.1 (latest is 5.13+), PatternFly 4 (now superseded by PatternFly 6), and React 18.2.0. Without Dependabot or Renovate, these fall further behind.
- **Effort**: 1-2 hours
- **Details**: No `.github/dependabot.yml`, `renovate.json`, `.renovaterc`, or `.renovaterc.json` found.

### 4. No Coverage Tracking or Enforcement
- **Severity**: MEDIUM
- **Impact**: Even if tests are eventually added, there is no mechanism to enforce minimum coverage or report coverage changes on PRs.
- **Effort**: 2-3 hours
- **Details**: No `.codecov.yml`, no `coverageThreshold` in any config, no coverage-related CI steps.

## Quick Wins

### 1. Add Dependabot for npm Ecosystem (1 hour)
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

### 2. Add ESLint with React and Accessibility Plugins (2-3 hours)
```bash
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin \
  eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y
```
Add an `eslint.config.mjs` with recommended rules and a `lint` script to `package.json`. Add `npm run lint` to the PR workflow.

### 3. Add Basic Smoke Tests with Vitest (4-6 hours)
```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom
```
Start with tests for:
- `gatsby-node.ts` build logic (slug generation, page creation)
- Key shared components (`Navbar`, `Footer`, `Layout`)
- Content rendering templates (`blog-post.tsx`, `docs-page.tsx`)

### 4. Create CLAUDE.md (1-2 hours)
Document project conventions: PatternFly 4 component library, Gatsby 5 patterns, TypeScript strict mode, Prettier formatting, SCSS modules, and content authoring in Markdown/AsciiDoc.

## Detailed Findings

### Unit Tests

**Score: 0.0/10**

- **Test files found**: 0
- **Test framework**: None installed
- **Test scripts**: None in `package.json`
- **Test-to-code ratio**: 0:45 (0%)

No testing infrastructure exists. The project has 45 TypeScript source files (~1,532 lines) covering React components, Gatsby page templates, and build configuration, all untested.

Key areas that would benefit from unit tests:
- `gatsby-node.ts` — Contains custom page creation logic including slug generation from AsciiDoc files, blog post page creation, and docs page creation
- `src/const.ts` — Large data file (~600+ lines) with release data, navigation config, and community information
- Shared components (`Navbar`, `Footer`, `SideNavigation`, `ContentCard`) — Used across all pages

### Integration/E2E Tests

**Score: 0.0/10**

- **E2E directory**: None
- **Integration directory**: None
- **E2E framework**: None (no Cypress, Playwright, or similar)
- **Visual regression**: None

For a public-facing website, E2E tests are important to verify:
- Page navigation works correctly
- Blog post rendering from Markdown
- Documentation pages render from the external `opendatahub-documentation` Git source
- Mobile responsiveness (the site uses PatternFly responsive components)
- External link integrity

### Build Integration

**Score: 3.0/10**

The PR workflow (`pull-request.yml`) runs `npm ci && npm run build` on every pull request. This is a basic but functional build gate — it catches TypeScript compilation errors and Gatsby build failures before merge.

**Strengths**:
- PR build gate exists and runs on every PR
- Build verifies that Gatsby can successfully generate static pages

**Gaps**:
- No Docker/container image build (site is deployed as static files to GitHub Pages)
- No deployment preview for PRs (e.g., Netlify Deploy Preview, Vercel Preview)
- No link validation or HTML validation in the build pipeline
- The PR workflow uses `actions/checkout@v3` (outdated; v4 is current)
- No concurrency control on PR builds (could waste resources on rapid pushes)

### Image Testing

**Score: 0.0/10**

This is a static website deployed to GitHub Pages — there is no Docker image or container. The score reflects the absence of containerization, which is appropriate for this project type. A containerized deployment would be over-engineering.

**Note**: This dimension is less relevant for a static website. If the team wanted to containerize for consistency with other ODH projects, they could add a simple Nginx-based Dockerfile, but it's not a priority.

### Coverage Tracking

**Score: 0.0/10**

- **Codecov**: Not configured
- **Coverage thresholds**: None
- **PR coverage reporting**: None
- **Coverage generation**: No test runner to generate coverage

This is blocked by the complete absence of tests. Once tests are added, Codecov should be configured immediately.

### CI/CD Automation

**Score: 4.0/10**

Three workflows exist:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pull-request.yml` | `on: pull_request` | Build verification (npm ci + gatsby build) |
| `gatsby.yml` | `on: push` to main + `workflow_dispatch` | Build and deploy to GitHub Pages (v4 actions) |
| `deploy-site.yml` | `on: push` to main + `on: schedule` (daily) | Legacy deploy to gh-pages branch |

**Strengths**:
- PR build gate catches build failures before merge
- Gatsby Pages deployment uses modern `actions/upload-pages-artifact@v3` and `actions/deploy-pages@v4`
- Build caching for Gatsby (`public/` and `.cache/` directories) in the Pages workflow
- `concurrency` control on Pages deployment prevents concurrent deploys

**Gaps**:
- **Duplicate deployment**: Both `gatsby.yml` and `deploy-site.yml` deploy on push to main — this is redundant and potentially conflicting
- **No concurrency control** on PR builds (`pull-request.yml`)
- **Mixed action versions**: `gatsby.yml` uses `@v4`/`@v5` while `deploy-site.yml` and `pull-request.yml` use `@v3`
- **No timeout limits** set on any workflow
- **No test execution** in any workflow (because no tests exist)
- **No caching** in PR build workflow (slower builds)
- **Daily scheduled deploy** (`deploy-site.yml`) rebuilds and deploys even when nothing changed

### Static Analysis

**Score: 3.0/10**

**TypeScript Configuration** (`tsconfig.json`):
- `strict: true` — Enables all strict type-checking options
- `noImplicitReturns: true` — Catches missing return statements
- `noImplicitThis: true` — Catches implicit `this` usage
- `noImplicitAny: false` — This weakens strict mode by allowing implicit `any` types
- `forceConsistentCasingInFileNames: true`
- A `typecheck` script exists in `package.json` (`tsc --noEmit`) but is not run in CI

**Prettier** (`.prettierrc`):
- Configured with import ordering rules
- A `prettier` script exists in `package.json`
- `.prettierignore` excludes node_modules, .cache, public, and generated files
- Not enforced in CI (no format check step in any workflow)

**Gaps**:
- **No ESLint**: No linting configuration for React, JSX accessibility, or code quality rules
- **No Dependabot/Renovate**: No automated dependency updates
- **No pre-commit hooks**: No `.pre-commit-config.yaml` or husky configuration
- **`typecheck` not in CI**: The TypeScript type-check script exists but is never run in workflows
- **FIPS**: Not applicable (static website, no server-side crypto)

### Agent Rules

**Score: 0.0/10**

- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **`.claude/` directory**: Not present
- **`.claude/rules/`**: Not present
- **Test automation guidance**: None

**Recommendation**: Generate a `CLAUDE.md` with:
- Project type: Gatsby 5 static site with React 18 and TypeScript
- Component library: PatternFly 4 (`@patternfly/react-core` v4.276.6)
- Styling: SCSS modules
- Content: Blog posts in Markdown, documentation sourced from external Git repo
- Build: `npm run build` (Gatsby), deployed to GitHub Pages
- Formatting: Prettier with import ordering

Use `/test-rules-generator` to create test rules once a test framework is adopted.

## Recommendations

### Priority 0 (Critical)

1. **Introduce Vitest and add unit tests for core components and build logic**
   - Install Vitest, @testing-library/react, @testing-library/jest-dom
   - Test `gatsby-node.ts` slug generation and page creation
   - Test shared components (Navbar, Footer, Layout, ContentCard)
   - Add `npm test` script and run it in `pull-request.yml`
   - Target: 50%+ coverage of shared components within first sprint

2. **Add ESLint with React and accessibility plugins**
   - Install @typescript-eslint/parser, eslint-plugin-react, eslint-plugin-react-hooks, eslint-plugin-jsx-a11y
   - Add `npm run lint` to PR workflow
   - Fix existing violations incrementally

3. **Enable Dependabot for npm and GitHub Actions ecosystems**
   - Create `.github/dependabot.yml` covering npm and github-actions
   - Evaluate upgrading to PatternFly 5/6, Gatsby 5 latest, and actions/checkout@v4

### Priority 1 (High Value)

4. **Add E2E tests with Playwright for critical user flows**
   - Verify home page renders correctly
   - Verify blog listing and individual blog post rendering
   - Verify documentation pages load from external Git source
   - Verify navigation between pages

5. **Add Codecov integration with PR coverage reporting**
   - Configure `.codecov.yml` with minimum coverage thresholds
   - Add coverage generation to test script (`vitest --coverage`)
   - Add `codecov/codecov-action` to PR workflow

6. **Create CLAUDE.md with project conventions and AI agent guidance**
   - Document PatternFly 4 usage, Gatsby 5 patterns, TypeScript conventions
   - Add contributing guidelines for content (blog posts, docs)
   - Use `/test-rules-generator` for test pattern rules

### Priority 2 (Nice-to-Have)

7. **Add pre-commit hooks (husky + lint-staged)**
   - Run Prettier and ESLint on staged files before commit
   - Prevent formatting/lint violations from entering the codebase

8. **Add accessibility testing (axe-core) to CI**
   - Integrate `@axe-core/playwright` or `pa11y` for automated a11y checks
   - Important for a public-facing community website

9. **Consolidate duplicate deployment workflows**
   - Remove `deploy-site.yml` (legacy gh-pages deploy) in favor of `gatsby.yml` (GitHub Pages)
   - Or clarify if both are intentional (e.g., one for opendatahub.io, one for a staging environment)

10. **Add broken link checking**
    - Use `lychee` or `markdown-link-check` in CI
    - Important since the site aggregates content from multiple sources including an external Git repo

## Comparison to Gold Standards

| Dimension | opendatahub.io | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit Tests | 0/10 — None | 8/10 — Jest + RTL | 5/10 — Bash scripts | 8/10 — Go testing |
| Integration/E2E | 0/10 — None | 8/10 — Cypress | 7/10 — Multi-notebook | 9/10 — envtest |
| Build Integration | 3/10 — Gatsby build only | 7/10 — Docker + kustomize | 8/10 — Multi-image | 7/10 — Operator bundle |
| Image Testing | 0/10 — N/A | 6/10 — Docker build | 9/10 — 5-layer validation | 6/10 — Basic |
| Coverage Tracking | 0/10 — None | 7/10 — Codecov | 4/10 — Partial | 8/10 — Enforced |
| CI/CD Automation | 4/10 — Basic | 8/10 — Comprehensive | 7/10 — Multi-workflow | 8/10 — Full matrix |
| Static Analysis | 3/10 — TS + Prettier | 7/10 — ESLint + Prettier | 5/10 — Linting | 7/10 — golangci-lint |
| Agent Rules | 0/10 — None | 6/10 — CLAUDE.md | 2/10 — Basic | 2/10 — Basic |
| **Overall** | **2.4** | **7.2** | **6.1** | **7.2** |

## File Paths Reference

### CI/CD Workflows
- `.github/workflows/pull-request.yml` — PR build gate (gatsby build)
- `.github/workflows/gatsby.yml` — GitHub Pages deployment (push to main)
- `.github/workflows/deploy-site.yml` — Legacy gh-pages deployment (push to main + daily schedule)

### Configuration
- `package.json` — Dependencies, scripts (no test script)
- `tsconfig.json` — TypeScript strict mode configuration
- `.prettierrc` — Prettier formatting rules (import ordering)
- `.prettierignore` — Prettier exclusions
- `gatsby-config.ts` — Gatsby plugins, data sources, site metadata
- `gatsby-node.ts` — Custom page creation logic (blog, docs, AsciiDoc)

### Source Code
- `src/components/shared/` — Shared React components (Navbar, Footer, Layout, etc.)
- `src/components/pages/home/` — Home page components
- `src/components/pages/community/` — Community page components
- `src/pages/` — Gatsby page components (index, blog, docs, 404)
- `src/templates/` — Page templates (blog-post, docs-page, generic page)
- `src/const.ts` — Large constants file (release data, navigation, community)
- `src/types.ts` — TypeScript type definitions

### Content
- `src/content/blog/` — Blog posts in Markdown
- `src/content/docs/` — Documentation pages in Markdown
- `src/content/assets/` — Images and static assets

### Missing (Recommended)
- `CLAUDE.md` — AI agent conventions
- `.github/dependabot.yml` — Dependency automation
- `.eslintrc.*` or `eslint.config.*` — Linting rules
- `.codecov.yml` — Coverage configuration
- `vitest.config.ts` or `jest.config.ts` — Test framework config
