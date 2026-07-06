---
repository: "opendatahub-io/langfuse"
overall_score: 7.4
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "190+ test files across web (Jest) and worker (Vitest) with good domain coverage"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Multi-mode CI matrix (Postgres 12/15, Azure, Redis-cluster), Playwright E2E, server E2E, sharded test runs"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-time Docker build with health checks, docker-compose integration, multi-arch support on release"
  - dimension: "Image Testing"
    score: 6.5
    status: "Docker build + health check validation in CI but no Trivy/vulnerability scanning on PR"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "Worker has vitest coverage command but no CI enforcement, no codecov, no PR coverage gates"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "Comprehensive pipeline with smart skip-checks, concurrency control, turbo caching, Slack notifications"
  - dimension: "Agent Rules"
    score: 9.0
    status: "Extensive CLAUDE.md, AGENTS.md, REVIEW.md, .claude/skills/, .cursor/rules/, web/.agents/ with detailed patterns"
critical_gaps:
  - title: "No coverage tracking or enforcement in CI"
    impact: "Cannot detect coverage regressions; untested code merges without visibility"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container vulnerability scanning on PRs"
    impact: "Snyk only runs on push to main/production, not on PRs - vulnerabilities discovered post-merge"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No shared package tests"
    impact: "Core shared library (types, schemas, DB queries) has zero dedicated test files"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No pre-commit-config.yaml for standardized hooks"
    impact: "Husky hooks only check formatting; no lint, type-check, or secret detection at commit time"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No secret detection tooling"
    impact: "No gitleaks/trufflehog integration; relying on .gitignore and developer discipline"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add codecov integration to pipeline.yml"
    effort: "2-4 hours"
    impact: "Enables coverage tracking, PR annotations, and regression detection"
  - title: "Add Trivy scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Catch container vulnerabilities before merge instead of only on main/production"
  - title: "Add gitleaks secret detection to CI"
    effort: "1-2 hours"
    impact: "Prevent accidental secret commits with automated scanning"
  - title: "Add coverage thresholds to vitest and jest configs"
    effort: "1-2 hours"
    impact: "Enforce minimum coverage standards on new code"
recommendations:
  priority_0:
    - "Implement codecov/coveralls integration with PR coverage gates and minimum thresholds"
    - "Move Snyk container scanning to PR-time (not just push to main/production)"
    - "Add dedicated tests for packages/shared (DB queries, schemas, queue contracts)"
  priority_1:
    - "Add gitleaks/trufflehog secret detection to PR workflow"
    - "Add pre-commit hooks for lint, typecheck, and secret scanning"
    - "Add SBOM generation to Docker image builds"
  priority_2:
    - "Add performance regression testing for API endpoints"
    - "Add contract tests between web/worker via shared queue schemas"
    - "Add accessibility testing for web frontend (axe-core)"
---

# Quality Analysis: opendatahub-io/langfuse

## Executive Summary

- **Overall Score: 7.4/10**
- **Repository Type**: TypeScript monorepo (pnpm + Turbo) - LLM observability platform
- **Primary Language**: TypeScript (Node 24)
- **Architecture**: Next.js 14 web app + Express.js worker + shared packages
- **Key Strengths**: Exceptionally mature CI/CD pipeline with multi-mode testing matrix, comprehensive agent rules ecosystem, PR-time Docker build validation with health checks
- **Critical Gaps**: No coverage tracking/enforcement, no PR-time vulnerability scanning, zero tests for shared package
- **Agent Rules Status**: Excellent - comprehensive CLAUDE.md, AGENTS.md, REVIEW.md, plus .claude/skills/ and .cursor/rules/

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | 190+ test files across web (Jest) and worker (Vitest) with good domain coverage |
| Integration/E2E | 8.5/10 | Multi-mode CI matrix (PG 12/15, Azure, Redis-cluster), Playwright E2E, server E2E, sharded runs |
| **Build Integration** | **8.0/10** | **PR-time Docker build with health checks, docker-compose integration, multi-arch on release** |
| Image Testing | 6.5/10 | Docker build + health check validation in CI; no PR-time vulnerability scanning |
| Coverage Tracking | 3.0/10 | Worker has vitest coverage command but no CI enforcement, no codecov, no PR gates |
| CI/CD Automation | 8.5/10 | Comprehensive pipeline with smart skip-checks, concurrency, turbo caching, Slack notifications |
| Agent Rules | 9.0/10 | Extensive CLAUDE.md, AGENTS.md, REVIEW.md, .claude/skills/, .cursor/rules/, web/.agents/ |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement in CI
- **Impact**: Cannot detect coverage regressions; untested code merges without visibility
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Worker has a `coverage` script in package.json (`vitest run --coverage`) but it's never invoked in CI. No codecov.yml, no coverage upload steps, no PR annotations. Web (Jest) has no coverage configuration at all. Teams have no visibility into what percentage of code is tested.

### 2. No Container Vulnerability Scanning on PRs
- **Impact**: Snyk only runs on push to main/production - vulnerabilities discovered post-merge
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: `snyk-web.yml` and `snyk-worker.yml` only trigger on `push` to `production` and `main` branches. PRs have no vulnerability scanning at all. This means a PR introducing a vulnerable dependency merges before Snyk flags it.

### 3. No Shared Package Tests
- **Impact**: Core shared library (types, schemas, DB queries, queue contracts) has zero dedicated test files
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: `packages/shared/` contains Prisma schemas, ClickHouse migrations, queue contracts, and shared utilities used by both web and worker. Zero test files exist in this package. While some shared code is indirectly tested via web/worker tests, there's no isolated testing of the shared layer.

### 4. Husky Hooks Only Check Formatting
- **Impact**: No lint, type-check, or secret detection at commit time
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: Pre-commit hook runs only `pnpm run format:check` (Prettier). No linting, no type checking, no secret scanning. Pre-push hook only confirms intent when pushing to main.

### 5. No Secret Detection Tooling
- **Impact**: Relying on .gitignore and developer discipline to prevent secret commits
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: No gitleaks, trufflehog, or similar secret detection in CI or pre-commit hooks. Given the extensive use of API keys (OpenAI, Anthropic, Azure, Bedrock, etc. in CI secrets), this is a notable gap.

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
Add coverage generation and upload to `pipeline.yml`:
```yaml
- name: Generate coverage
  run: pnpm --filter=worker run coverage
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    files: ./worker/coverage/lcov.info
```

### 2. Add Trivy Scanning to PR Workflow (1-2 hours)
Add a Trivy scan step after the Docker build in the `test-docker-build` job:
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    scan-type: 'fs'
    scan-ref: '.'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'
```

### 3. Add Gitleaks Secret Detection (1-2 hours)
Add a workflow or step for secret scanning:
```yaml
- name: Run gitleaks
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 4. Add Coverage Thresholds (1-2 hours)
Configure vitest.config.ts with coverage thresholds:
```typescript
coverage: {
  provider: 'v8',
  thresholds: {
    lines: 60,
    branches: 50,
    functions: 60,
    statements: 60
  }
}
```

## Detailed Findings

### CI/CD Pipeline

**Score: 8.5/10** - Exceptionally well-organized pipeline with sophisticated features.

**Workflow Inventory** (16 workflow files):
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pipeline.yml` | PR, push, merge_group | Main CI: lint, prettier, tests, Docker build, E2E |
| `codeql.yml` | PR, push, schedule | CodeQL SAST scanning (JavaScript/TypeScript) |
| `codespell.yml` | PR, push, merge_group | Spell checking |
| `deploy.yml` | push main/production, dispatch | ECS deployment (staging, prod-eu/us/hipaa) |
| `snyk-web.yml` | push main/production | Snyk container scanning (web) |
| `snyk-worker.yml` | push main/production | Snyk container scanning (worker) |
| `licencecheck.yml` | PR, push, merge_group | License compliance (blocks copyleft) |
| `validate-pr-title.yml` | PR events | Conventional commits enforcement |
| `sdk-api-spec.yml` | push main (fern/**) | SDK spec generation |
| `release.yml` | tag push (v3.*) | Promote main to production |
| `promote-main-to-production.yml` | manual dispatch | Force-push main to production |
| `stale_issues.yml` | cron (daily) | Auto-close stale issues |
| `dependabot-rebase-stale.yml` | push main | Rebase stale Dependabot PRs |
| `_deploy_ecs_service.yml` | reusable workflow | ECS deployment helper |
| `ci.yml.template` | N/A | Template for CI workflow |

**Strengths**:
- Smart duplicate action skipping (`fkirc/skip-duplicate-actions`)
- Path-based filtering (LLM connection tests only run when relevant files change)
- Concurrency control with PR cancellation
- Turbo build caching (`actions/cache` for `.turbo`)
- Next.js build caching
- Test sharding (web tests split 3 ways)
- Multi-mode testing matrix (default, Azure, Redis-cluster)
- Multi-Postgres version testing (12, 15)
- Docker build health check validation on PRs
- Failure diagnostics (docker logs, container inspect, host listeners)
- Slack notifications on CI failure
- Branch protection via `all-ci-passed` gate job
- Dependabot with grouped updates (prisma, next, lodash, observability, radix-ui)

**Gaps**:
- No coverage upload or reporting step
- Snyk not running on PRs
- No artifact caching for Docker layers (only turbo/nextjs cache)

### Test Coverage

**Unit Tests (7.5/10)**:
- **190+ test files total** (77 worker, 113 web)
- **Test-to-code ratio**: ~10.3% (190 test files / 1,853 source files) - moderate
- **Worker tests**: Vitest framework, well-organized in `__tests__/` with domain subfolders (chatml adapters, evaluation, ingestion, experiments)
- **Web tests**: Jest framework with two projects (server, client)
  - Server tests (`*.servertest.ts`): ~70 files covering APIs, tRPC routes, query builders, integrations
  - Client tests (`*.clienttest.ts`): ~15 files covering UI utilities, chart utils, table views
- **Shared package**: Zero test files - significant gap given it contains core DB logic
- **Notable test domains**: MCP tools, OTEL ingestion, evaluation pipelines, batch processing, encryption, webhooks, Slack integration

**Integration/E2E Tests (8.5/10)**:
- **Playwright E2E**: 2 spec files (`auth.spec.ts`, `create-project.spec.ts`) - minimal browser E2E
- **Server E2E**: Dedicated `e2e-server-tests` job that starts full app and runs tests against it
- **Multi-mode testing**: Tests run across 3 deployment modes (default, Azure storage, Redis cluster)
- **Multi-database testing**: Tests run against Postgres 12 and 15
- **Infrastructure**: Full docker-compose with Postgres, ClickHouse, Redis, MinIO
- **Test isolation**: Good test independence (CLAUDE.md explicitly mentions no `pruneDatabase`, tests must run concurrently)

### Code Quality

**Linting & Formatting (7.5/10)**:
- ESLint with shared base config (JS recommended + TypeScript plugin + Prettier + Turbo)
- Prettier with config file and format-on-PR check (changed files only)
- TypeScript strict mode enabled
- Codespell for spelling checks
- Conventional commits enforced via PR title validation
- No pre-commit-config.yaml (uses Husky instead, format-only)

**Static Analysis**:
- CodeQL enabled for JavaScript/TypeScript (PR + push + weekly schedule)
- Snyk container scanning (but only on main/production push)
- Dependabot with daily npm updates and grouped PRs
- License compliance checking (blocks copyleft licenses)
- No gosec equivalent for TypeScript
- No SBOM generation

### Container Images

**Build Process (8.0/10)**:
- Well-designed multi-stage Dockerfiles for both web and worker
- `turbo prune --scope=<app> --docker` for minimal build context
- Non-root user (`nextjs`/`expressjs` with UID 1001)
- `dumb-init` for proper signal handling
- Base image security updates (`apk upgrade --no-cache libcrypto3 libssl3`)
- Multi-architecture support (amd64 + arm64 on tagged releases)
- Frozen lockfile installs (`pnpm install --frozen-lockfile`)
- Healthchecks defined in docker-compose
- **CI Docker build test**: PR job builds both images and validates health endpoints

**Runtime Testing (6.5/10)**:
- Health endpoint validation (`/api/health`, `/api/public/health`)
- Docker compose integration test with service dependencies
- Failure diagnostics capture (logs, inspect, network state)
- No Trivy/Snyk on PR-time builds
- No SBOM generation
- No image signing/attestation

### Security

**Score: 6.0/10**:
- CodeQL SAST on PRs and pushes (strong)
- Snyk container scanning on main/production only (not PRs)
- Dependabot daily updates with smart grouping
- License compliance checking
- No secret detection (gitleaks/trufflehog)
- No SBOM generation
- Non-root Docker users
- `SECURITY.md` present but minimal (points to docs page)
- No `.trivyignore` or vulnerability threshold configuration

### Agent Rules (Agentic Flow Quality)

**Score: 9.0/10** - One of the most comprehensive agent rule ecosystems observed.

**Status**: Excellent - multi-layered guidance across multiple AI coding tools

**Coverage**:
- `CLAUDE.md` (root): 9KB comprehensive project guide covering architecture, dev commands, testing, code conventions, TypeScript best practices
- `AGENTS.md` (root): 5.8KB monorepo-level guide with dependency graph, verification matrix, testing guidelines
- `REVIEW.md` (root): Detailed code review checklist (ClickHouse, Postgres, Redis, environment variables, security)
- `.claude/settings.json`: Permission configuration and hooks
- `.claude/hooks/`: Skill activation and post-tool-use tracking hooks
- `.claude/skills/`: 4 skills (add-model-price, backend-dev-guidelines, skill-developer, skill-rules)
- `.claude/agents/`: changelog-writer agent
- `.cursor/rules/`: 8 rule files covering authorization, RBAC, entitlements, frontend, public API, tests, general info, global settings
- `web/.agents/skills/`: Vercel composition patterns and React best practices with 50+ detailed rule files

**Quality Assessment**:
- Rules are highly actionable with specific code examples (TypeScript patterns, single-param objects)
- Verification matrix maps change scope to minimum verification commands
- Dependency direction explicitly documented and enforced
- Testing guidelines are specific (no `pruneDatabase`, test independence, test-then-fix workflow)
- Code review rules cover domain-specific concerns (ClickHouse cluster replication, Redis call patterns)
- Multi-tool support (Claude Code, Cursor, Codex) with distinct rule files

**Gaps**:
- No explicit integration/E2E test writing rules
- No performance testing guidelines
- Package-specific AGENTS.md files referenced but not in shallow clone scope

## Recommendations

### Priority 0 (Critical)

1. **Implement codecov/coveralls integration** with PR coverage gates and minimum thresholds. Worker already has a coverage script; add it to CI and configure upload. Add Jest coverage to web tests.
2. **Move Snyk container scanning to PR-time**. Currently only runs on push to main/production. Add scanning to the `test-docker-build` job or create a dedicated PR workflow.
3. **Add dedicated tests for packages/shared**. This package contains Prisma schemas, ClickHouse query builders, queue contracts, and shared utilities. At minimum, test schema validation, queue contract serialization, and critical shared utilities.

### Priority 1 (High Value)

4. **Add gitleaks/trufflehog secret detection** to the PR workflow. Given the numerous API keys used in CI (OpenAI, Anthropic, Azure, Bedrock, Google AI), preventing accidental commits is critical.
5. **Enhance pre-commit hooks** to include linting and type-checking, not just formatting. Consider adopting `.pre-commit-config.yaml` for standardized hook management.
6. **Add SBOM generation** to Docker image builds. Use `syft` or `docker buildx --sbom` for software bill of materials.
7. **Expand Playwright E2E coverage**. Only 2 spec files (auth, create-project) for a feature-rich platform. Add E2E tests for core workflows (tracing, evaluation, prompt management).

### Priority 2 (Nice-to-Have)

8. **Add performance regression testing** for API endpoints (ingestion, query builder, dashboard metrics).
9. **Add contract tests** between web and worker via shared queue payload schemas.
10. **Add accessibility testing** (axe-core/pa11y) for the web frontend.
11. **Add image signing/attestation** with cosign for supply chain security.

## Comparison to Gold Standards

| Dimension | langfuse | odh-dashboard | notebooks | kserve |
|-----------|---------|---------------|-----------|--------|
| Unit Tests | 7.5 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 8.5 | 9.5 | 7.0 | 9.0 |
| Build Integration | 8.0 | 8.5 | 7.0 | 7.5 |
| Image Testing | 6.5 | 7.0 | 9.5 | 7.0 |
| Coverage Tracking | 3.0 | 9.0 | 5.0 | 9.0 |
| CI/CD Automation | 8.5 | 9.0 | 8.0 | 8.5 |
| Agent Rules | 9.0 | 9.0 | 3.0 | 4.0 |

**Summary**: Langfuse excels in CI/CD automation and agent rules but significantly lags in coverage tracking. The multi-mode testing matrix (Postgres versions, deployment modes) and Docker build validation are strong. The main area for improvement is adding coverage measurement and enforcement to match kserve/odh-dashboard standards.

## File Paths Reference

### CI/CD
- `.github/workflows/pipeline.yml` - Main CI/CD pipeline
- `.github/workflows/codeql.yml` - CodeQL SAST
- `.github/workflows/snyk-web.yml` - Snyk web container scan
- `.github/workflows/snyk-worker.yml` - Snyk worker container scan
- `.github/workflows/deploy.yml` - ECS deployment
- `.github/workflows/codespell.yml` - Spell checking
- `.github/workflows/licencecheck.yml` - License compliance
- `.github/workflows/validate-pr-title.yml` - Conventional commits
- `.github/dependabot.yml` - Dependency updates

### Testing
- `web/src/__tests__/server/` - Web server tests (Jest, ~70 files)
- `web/src/__tests__/*.clienttest.ts` - Web client tests (Jest, ~15 files)
- `web/src/__e2e__/` - Playwright E2E tests (2 spec files)
- `worker/src/__tests__/` - Worker tests (Vitest, ~65 files)
- `worker/src/features/` - Feature-specific tests
- `web/playwright.config.ts` - Playwright configuration

### Code Quality
- `packages/config-eslint/base.js` - Shared ESLint config
- `packages/config-typescript/base.json` - Shared TypeScript config
- `prettier.config.cjs` - Prettier configuration
- `.codespellrc` - Codespell configuration
- `.husky/pre-commit` - Pre-commit hook (format check only)
- `turbo.json` - Turbo monorepo configuration

### Container Images
- `web/Dockerfile` - Web app multi-stage Docker build
- `worker/Dockerfile` - Worker multi-stage Docker build
- `docker-compose.build.yml` - CI Docker build test
- `docker-compose.dev.yml` - Development infrastructure
- `.dockerignore` - Docker ignore patterns

### Agent Rules
- `CLAUDE.md` - Main Claude Code instructions
- `AGENTS.md` - Codex/multi-agent guidelines
- `REVIEW.md` - Code review checklist
- `.claude/settings.json` - Claude Code permissions
- `.claude/skills/` - Claude Code skills (4 skills)
- `.claude/agents/` - Claude Code agents
- `.claude/hooks/` - Claude Code hooks
- `.cursor/rules/` - Cursor AI rules (8 files)
- `web/.agents/skills/` - Vercel/React best practice rules

### Security
- `SECURITY.md` - Security policy
- `.github/dependabot.yml` - Dependency update configuration
