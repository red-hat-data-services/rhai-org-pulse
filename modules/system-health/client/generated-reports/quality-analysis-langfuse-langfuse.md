---
repository: "langfuse/langfuse"
overall_score: 8.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "170 test files (72K+ lines) using Vitest across web, worker, and shared packages with smart isolation strategies"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Playwright E2E + server E2E tests, multi-deploy-mode matrix (default, Azure, Redis cluster), multi-Postgres-version testing"
  - dimension: "Build Integration"
    score: 9.0
    status: "PR-time Docker compose build with health checks, client bundle scanning, full service startup validation"
  - dimension: "Image Testing"
    score: 8.5
    status: "Multi-arch builds (amd64/arm64), Docker health checks, Snyk container scanning, runtime startup validation"
  - dimension: "Coverage Tracking"
    score: 5.0
    status: "v8 coverage provider configured in worker vitest but no enforcement, no codecov integration, no PR coverage reporting"
  - dimension: "CI/CD Automation"
    score: 9.5
    status: "Comprehensive 24-workflow pipeline with merge queue, concurrency control, turbo caching, duplicate skip, Slack notifications"
  - dimension: "Agent Rules"
    score: 9.5
    status: "Exceptional .agents/ setup with 25+ skills, architecture principles, code review, security review, and testing guidance"
critical_gaps:
  - title: "No coverage enforcement or reporting"
    impact: "Coverage can silently degrade without detection; no PR coverage diffs or minimum thresholds"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Minimal Playwright E2E test coverage"
    impact: "Only 2 E2E spec files (auth + create-project) out of a large web application; many user flows untested end-to-end"
    severity: "MEDIUM"
    effort: "20-40 hours"
  - title: "No pre-commit hooks for security scanning"
    impact: "Security issues only caught in CI, not at commit time; developers may push vulnerable code"
    severity: "LOW"
    effort: "2-3 hours"
quick_wins:
  - title: "Add Codecov integration with PR coverage reporting"
    effort: "2-4 hours"
    impact: "Visibility into coverage trends and PR-level coverage diffs; prevent silent coverage regression"
  - title: "Add coverage threshold enforcement"
    effort: "1-2 hours"
    impact: "Prevent coverage from dropping below baseline; worker already has v8 provider configured"
  - title: "Expand Playwright E2E tests for critical user flows"
    effort: "8-16 hours"
    impact: "Cover login, dashboard, trace viewing, project settings, and API key management flows"
recommendations:
  priority_0:
    - "Integrate Codecov or similar with coverage thresholds and PR reporting"
    - "Add coverage enforcement gates to the CI pipeline"
  priority_1:
    - "Expand Playwright E2E test suite to cover core user journeys (dashboard, traces, evaluations, prompts)"
    - "Add contract tests for tRPC API boundaries between web and shared packages"
    - "Add Storybook visual regression testing (already have 19 stories and Storybook CI)"
  priority_2:
    - "Add performance regression testing for API endpoints"
    - "Add load testing for ingestion pipeline"
    - "Consider adding SBOM generation to release image builds"
---

# Quality Analysis: langfuse/langfuse

## Executive Summary

- **Overall Score: 8.6/10**
- **Repository Type**: TypeScript monorepo (pnpm + Turborepo)
- **Primary Language**: TypeScript (Node 24)
- **Framework**: Next.js (web) + Express (worker) + Prisma + ClickHouse
- **Key Strengths**: Exceptionally mature CI/CD pipeline, outstanding agent rules ecosystem, comprehensive multi-mode testing matrix, PR-time Docker build validation with health checks
- **Critical Gaps**: No coverage enforcement or reporting despite v8 provider being configured; minimal E2E test coverage (only 2 Playwright specs)
- **Agent Rules Status**: Excellent - 25+ skills, architecture principles, code review, and testing guidance

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | 170 test files (72K+ lines) with smart isolation strategies |
| Integration/E2E | 8.0/10 | Multi-mode matrix testing + Playwright + Storybook tests |
| Build Integration | 9.0/10 | PR-time Docker build with health checks and bundle scanning |
| Image Testing | 8.5/10 | Multi-arch builds, Snyk scanning, runtime validation |
| Coverage Tracking | 5.0/10 | v8 configured but no enforcement, no codecov, no PR reporting |
| CI/CD Automation | 9.5/10 | 24 workflows, merge queue, turbo caching, smart skip logic |
| Agent Rules | 9.5/10 | 25+ agent skills, architecture principles, comprehensive guidance |

## Critical Gaps

### 1. No Coverage Enforcement or Reporting
- **Impact**: Coverage can silently degrade without anyone noticing; no PR-level coverage diffs or minimum thresholds enforced
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Detail**: The worker `vitest.config.ts` has `coverage.provider: "v8"` configured with include/exclude patterns, but coverage is never generated in CI, there's no codecov.yml, and no coverage thresholds are enforced. This is a significant gap for a 170-test-file codebase.

### 2. Minimal Playwright E2E Coverage
- **Impact**: Only 2 E2E spec files (`auth.spec.ts` and `create-project.spec.ts`) for a feature-rich web application with dashboards, trace viewers, evaluations, prompts, and more
- **Severity**: MEDIUM
- **Effort**: 20-40 hours
- **Detail**: The Playwright infrastructure is well-configured (3-minute timeout, failure screenshots/traces, CI web server setup), but the actual test coverage is minimal. The server E2E tests partially compensate but don't test the full UI flow.

### 3. No Pre-commit Security Scanning
- **Impact**: Security issues caught only in CI (Semgrep, CodeQL, Snyk), not at commit time
- **Severity**: LOW
- **Effort**: 2-3 hours
- **Detail**: Husky pre-commit hooks run `format:check` and `lint` but no security scanning. Adding a lightweight pre-commit security check would shift detection left.

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
- **Impact**: Immediate visibility into coverage trends and PR-level diffs
- **Implementation**: Add `codecov.yml` config and a coverage upload step to the `tests-worker` and `tests-web` jobs
```yaml
# Add to tests-worker job after "run tests" step
- name: Upload coverage
  if: matrix.deploy-mode == '' && matrix.postgres-version == 15
  uses: codecov/codecov-action@v5
  with:
    flags: worker
    fail_ci_if_error: false
```

### 2. Add Coverage Threshold Enforcement (1-2 hours)
- **Impact**: Prevent coverage from dropping below baseline
- **Implementation**: Add `thresholds` to the existing worker vitest coverage config:
```typescript
coverage: {
  provider: "v8",
  thresholds: {
    lines: 60,
    functions: 60,
    branches: 50,
  },
}
```

### 3. Enable Storybook Visual Regression (2-4 hours)
- **Impact**: Catch visual regressions in 19 existing stories automatically
- **Implementation**: The Storybook test infrastructure already runs in CI (`tests-storybook` job). Add visual snapshot comparisons via `@storybook/test-runner` with `--snapshot` flag.

## Detailed Findings

### CI/CD Pipeline

**Score: 9.5/10** - One of the most comprehensive CI/CD setups analyzed.

**Pipeline Architecture** (`pipeline.yml` - 1339 lines):
- **24 GitHub Actions workflows** covering CI, security, deployment, and automation
- **Triggers**: PR, push to main, merge queue, tags, scheduled (CodeQL weekly, model price audit bi-weekly)
- **Concurrency control**: Smart cancellation for PRs, group-based dedup
- **Pre-job skip logic**: Tree-SHA-based duplicate detection to skip redundant push-to-main runs
- **Merge queue support**: First-class `merge_group` event handling

**PR-Triggered Jobs** (12 parallel jobs):
1. `lint` - ESLint + TypeScript type checking
2. `knip` - Dead code detection
3. `prettier-check` - Format checking (only changed files, smart diff-based)
4. `tests-eslint-plugin` - Custom ESLint plugin tests
5. `tests-storybook` - Storybook component tests via Playwright
6. `tests-shared` - Shared package unit tests
7. `test-docker-build` - Full Docker compose build + health check validation
8. `tests-web` - Matrix: 2 Postgres versions x 3 deploy modes = 6 configurations
9. `tests-worker` - Matrix: 2 Postgres versions x 3 deploy modes = 6 configurations
10. `test-worker-llm-connections` - LLM provider connectivity tests (path-filtered)
11. `e2e-tests` - Playwright browser E2E tests
12. `e2e-server-tests` - Server-side E2E with full app startup

**Additional Workflows**:
- `codeql.yml` - CodeQL SAST (PR + weekly schedule)
- `semgrep.yml` - Semgrep security scanning on PRs
- `snyk-web.yml` / `snyk-worker.yml` - Snyk container vulnerability scanning
- `zizmor.yml` - GitHub Actions security auditing
- `codespell.yml` - Spelling error detection
- `licencecheck.yml` - License compliance (fail on copyleft)
- `claude-code-security-review.yml` - AI-powered security review on PRs using Claude Opus
- `model-price-audit.yml` - Automated LLM pricing audit with Claude Code agent
- `storybook-preview.yml` - Storybook preview deploys on PRs
- `validate-pr-title.yml` - PR title validation
- `label-prs-with-conflicts.yml` - Auto-label conflicting PRs
- `dependabot-rebase-stale.yml` - Stale Dependabot PR management
- `deploy.yml` - ECS deployment with multi-environment support
- `promote-main-to-production.yml` - Production promotion

**Caching Strategy**:
- pnpm store caching with dependency-path keys
- Turbo cache with SHA-based keys and mode-scoped segments
- Next.js build cache for E2E jobs
- Smart cache poisoning protection for fork PRs (`CI_CACHE_ALLOWED` flag)
- Turbo cache pruning (entries older than 3 days)

**Release Pipeline**:
- Multi-architecture Docker image builds (amd64 + arm64) using Blacksmith runners
- Dual registry publishing (GHCR + Docker Hub)
- Digest-based multi-platform manifest creation
- Semver tagging (major, minor, patch, latest)
- Slack failure notifications

### Test Coverage

**Score: 8.5/10** for unit tests, **8.0/10** for integration/E2E

**Test Infrastructure**:
- **Framework**: Vitest for unit/integration, Playwright for browser E2E
- **Test Files**: 170 files with 72,006 total lines of test code
- **Source Files**: ~2,308 TypeScript files
- **Test-to-Code Ratio**: ~7.4% by file count, strong for the codebase size
- **Testing Workspace**: `vitest.workspace.ts` + per-package configs

**Web Tests** (vitest.config.mts - 7 project configurations):
1. `in-source` - In-source vitest tests
2. `client` - jsdom browser tests with `@testing-library/jest-dom`
3. `server` - Shared-context server tests (non-isolated for performance)
4. `server-isolated` - Isolated server tests (for files with global state mutation)
5. `server-unit` - Pure unit tests without DB
6. `storybook` - Storybook component tests via Playwright browser
7. `e2e-server` - Server E2E tests

**Smart Test Isolation**:
- Content-based classification: files with `vi.mock`, `vi.spyOn`, `process.env` mutation get isolated
- Shared-context files run `isolate: false` for performance (371s import overhead vs 264s test time)
- Custom `VitestCiReporter` for CI-specific output and top-10 slowest test summary

**Worker Tests** (82 test files in `worker/src/__tests__/`):
- Comprehensive coverage of: webhooks, URL normalization, trace/score deletion, Slack integration, LLM connections, monitoring, ingestion, evaluation, storage, and more
- `pool: "forks"` for process isolation
- v8 coverage provider configured

**E2E Tests**:
- 2 Playwright specs: `auth.spec.ts`, `create-project.spec.ts`
- Server E2E via vitest with full app startup
- 3-minute test timeout, 60s assertion timeout
- Failure screenshots and traces retained

**Storybook Tests**:
- 19 stories across charts, tables, search bar, feature previews, and in-app agent
- Storybook tests run in CI via Playwright browser provider
- Accessibility addon (`@storybook/addon-a11y`) integrated

**Multi-Mode Testing Matrix**:
- 3 deploy modes: default, Azure, Redis cluster
- 2 Postgres versions: 12, 15
- Path-filtered LLM connection tests (OpenAI, Anthropic, Azure, Bedrock, VertexAI, Google AI Studio)

**CI Test Configuration**:
- Retry count: 3 on CI (0 locally)
- 30s test timeout
- `passed-only` silent mode in CI
- 2s slow test threshold in CI (vs 300ms locally)

### Code Quality

**Score: 8.5/10**

**Linting**:
- ESLint flat config (`eslint.config.mjs`) in web, worker, ee, and shared packages
- Custom `@repo/eslint-plugin` with its own test suite
- Rule: no widening ESLint disable comments without explicit approval
- Knip for dead code detection (runs in CI)

**Formatting**:
- Prettier with `prettier.config.cjs`
- CI check on changed files only (smart diff-based, avoiding Next.js bracket-path issues)
- Husky pre-commit hook runs `format:check` + `lint`

**Spell Checking**:
- Codespell integration with `.codespellrc` config
- Runs on PRs and pushes

**Dead Code Detection**:
- Knip (`knip.jsonc`) runs in CI to detect unused exports, dependencies, and files

**Client Bundle Scanning**:
- Custom `scripts/scan-client-bundle.mjs` scans production web builds
- Detects minifier-dropped bindings and Node-only globals leaking into browser chunks
- Runs in both E2E job and as a general CI check

**License Compliance**:
- `license-checker` with `action-pip-license-checker`
- Fails on WeakCopyleft, StrongCopyleft, NetworkCopyleft licenses

**Supply Chain Protection**:
- `minimumReleaseAge: 7200` (5-day delay) for new dependency versions
- Explicit `allowBuilds` list for native modules
- Pin-based action references with SHA hashes throughout workflows

### Container Images

**Score: 8.5/10**

**Web Dockerfile**:
- Multi-stage build (7 stages): alpine -> build-base -> runtime-base -> pruner -> builder -> migrate-builder -> runner
- Turbo prune for minimal workspace isolation
- Non-root user (`nextjs:nodejs`, UID/GID 1001)
- `dumb-init` for proper signal handling
- Custom Go migrate CLI built from source (avoids upstream CVEs from unused drivers)
- Package manager removal from runtime image (npm, corepack, yarn removed after use)
- Alpine-based with security upgrades (`libcrypto3`, `libssl3`)
- Next.js output tracing for minimal image size

**Worker Dockerfile**:
- Similar multi-stage build with production dependency deployment
- Non-root user (`expressjs:expressjs`)
- All package managers removed from runtime
- Prisma client artifacts properly handled

**PR-Time Build Validation** (`test-docker-build` job):
- Full `docker-compose.build.yml` build
- Background dependency container startup overlapping image build
- Health check validation for both web (`/api/public/health`) and worker (`/api/health`)
- Comprehensive failure diagnostics: container state, docker events, host listeners, per-service logs
- Diagnostic artifact upload on failure

**Multi-Architecture Support**:
- amd64 and arm64 builds in release pipeline
- Blacksmith runners for native ARM builds
- Digest-based multi-platform manifest creation

**Container Scanning**:
- Snyk container scanning for both web and worker images
- SARIF output uploaded to GitHub Code Scanning
- Runs on push to main/production (not PR-time for container scanning)

### Security

**Score: 9.0/10** - Exceptional security posture

**SAST Tools**:
- **CodeQL**: JavaScript/TypeScript analysis on PRs + weekly schedule
- **Semgrep**: PR-time security scanning with baseline comparison (v1.162.0 pinned)
- **Claude Code Security Review**: AI-powered security review using Claude Opus on every non-draft PR

**Container Security**:
- **Snyk**: Container vulnerability scanning for web and worker images
- **zizmor**: GitHub Actions security auditing (checks for cache poisoning, credential exposure, etc.)

**Dependency Security**:
- 5-day `minimumReleaseAge` for new package versions (supply chain attack mitigation)
- Explicit `allowBuilds` list for native modules
- Security overrides for known vulnerable packages (`nanoid`, `katex`, `tar-fs`, `qs`, `path-to-regexp`, `ip-address`)
- License compliance checking

**CI Security Hardening**:
- `persist-credentials: false` on all checkout actions
- SHA-pinned action references throughout
- Fork PR cache isolation (`CI_CACHE_ALLOWED` flag)
- LLM connection tests deliberately cache-cold to protect API credentials
- Minimal permissions per workflow (`contents: read` default)
- Hook-disabled commit path in automated workflows with staged-blob validation

**Secret Management**:
- `.env*.example` files for documentation
- Agent rules prohibit committing secrets
- SECURITY.md with disclosure policy

### Agent Rules (Agentic Flow Quality)

**Score: 9.5/10** - Best-in-class agent rules ecosystem

**Structure**:
- `.agents/AGENTS.md` - Comprehensive root guide (canonical, symlinked as `AGENTS.md` and `CLAUDE.md`)
- `.agents/ARCHITECTURE_PRINCIPLES.md` - Architecture decision records
- `.agents/config.json` - Agent configuration
- `.agents/skills/` - 25+ specialized skills

**Skills Coverage** (25+ skills):
1. **add-model-price** - Automated LLM pricing audit with validation scripts
2. **agent-setup-maintenance** - Agent configuration management
3. **analyze-cloud-costs** - Cloud cost analysis
4. **backend-dev-guidelines** - Architecture, DB patterns, routing, services, testing
5. **changelog-writing** - Release changelog generation
6. **clickhouse-best-practices** - 25+ ClickHouse rules (schema, queries, inserts, partitions)
7. **code-review** - Review checklist and standards
8. **create-repo-agent** - Repository agent creation with security standards
9. **datadog-query-recipes** - Observability query templates
10. **debug-issue-with-datadog** - Issue debugging playbook
11. **frontend-browser-review** - Frontend review guidelines
12. **frontend-large-feature-architecture** - Large feature planning
13. **git-workflow** - Git workflow standards
14. **housekeeping** - Repository maintenance
15. **infra-scaling** - Infrastructure scaling guidance
16. **langfuse-codebase-navigator** - Repository map and navigation
17. **linear-bug-triage** - Bug triage workflow
18. **pnpm-upgrade-package** - Package upgrade with release-age checking
19. **security-review** - Security checklist and outbound URL validation
20. **seed-test-data** - Test data seeding
21. **skill-creator** - Meta-skill for creating new skills
22. **storybook** - Storybook component development
23. **turborepo** - Turborepo best practices (caching, CI, configuration, filtering)
24. **weekly-production-review** - Production health review

**Quality of Rules**:
- **Comprehensive**: Testing guide, architecture overview, database patterns, middleware, routing, services
- **Actionable**: Specific commands, file paths, verification steps
- **Up-to-date**: Agent shim sync mechanism (`agents:sync` / `agents:check`)
- **Progressive disclosure**: Skills reference sub-files for deep dives
- **Multi-provider**: OpenAI YAML configs alongside Claude/AGENTS.md

**Testing Guidance**:
- Bug fix workflow: "write failing test first, confirm it fails, then fix"
- Seed CLI usage for reproducible test data
- Verification matrix by package scope
- Client bundle soundness verification

## Recommendations

### Priority 0 (Critical)

1. **Integrate Codecov with coverage thresholds and PR reporting**
   - The worker vitest already has v8 coverage provider configured
   - Add codecov.yml with minimum coverage thresholds
   - Upload coverage from `tests-worker` and `tests-web` CI jobs
   - Enable PR-level coverage diff reporting
   - **Effort**: 4-6 hours

2. **Add coverage enforcement gates**
   - Set minimum line/branch/function coverage thresholds
   - Fail CI if coverage drops below baseline
   - Start with current coverage as baseline, ratchet up over time
   - **Effort**: 2-3 hours

### Priority 1 (High Value)

3. **Expand Playwright E2E test suite**
   - Current: 2 specs (auth, create-project)
   - Target: Cover dashboard, trace viewing, evaluations, prompt management, API key management
   - The infrastructure is already excellent (config, CI job, screenshots/traces on failure)
   - **Effort**: 20-40 hours

4. **Add Storybook visual regression testing**
   - 19 stories already exist with Storybook tests in CI
   - Add visual snapshot comparisons for regression detection
   - **Effort**: 4-8 hours

5. **Add contract tests for tRPC API boundaries**
   - Validate web-to-shared and worker-to-shared tRPC contracts
   - Prevent breaking API changes across package boundaries
   - **Effort**: 8-12 hours

### Priority 2 (Nice-to-Have)

6. **Add SBOM generation to release image builds**
   - Currently `sbom: false` in release Docker builds
   - Enable for supply chain transparency
   - **Effort**: 1-2 hours

7. **Add performance regression testing**
   - Benchmark critical API endpoints (ingestion, trace retrieval)
   - Track performance metrics over time
   - **Effort**: 12-20 hours

8. **Add pre-commit security scanning**
   - Lightweight Semgrep or Gitleaks in husky pre-commit hook
   - Shift security detection left
   - **Effort**: 2-3 hours

## Comparison to Gold Standards

| Dimension | langfuse | odh-dashboard | notebooks | kserve |
|-----------|---------|---------------|-----------|--------|
| Unit Tests | 8.5 - 170 files, smart isolation | 9.0 - Multi-layer | 7.0 - Standard | 8.5 - envtest |
| Integration/E2E | 8.0 - Multi-mode matrix | 9.0 - Contract tests | 6.0 - Manual | 8.0 - Multi-version |
| Build Integration | 9.0 - Docker build + health | 8.0 - Konflux sim | 7.0 - Image builds | 7.0 - Standard |
| Image Testing | 8.5 - Multi-arch + Snyk | 7.0 - Basic | 9.5 - 5-layer | 7.0 - Standard |
| Coverage Tracking | 5.0 - Configured, not enforced | 8.0 - Enforced | 6.0 - Basic | 9.0 - Thresholds |
| CI/CD Automation | 9.5 - 24 workflows, exceptional | 8.5 - Good | 7.0 - Standard | 8.0 - Good |
| Agent Rules | 9.5 - 25+ skills, best-in-class | 8.0 - Good | 3.0 - Minimal | 2.0 - None |
| **Overall** | **8.6** | **8.2** | **6.5** | **7.1** |

**Notable Strengths vs Gold Standards**:
- Agent rules ecosystem is the most comprehensive analyzed - 25+ skills with progressive disclosure
- CI/CD pipeline is among the most sophisticated (merge queue, smart skip, 24 workflows)
- Security posture is exceptional (5 security scanning tools including AI-powered review)
- Multi-mode testing matrix (3 deploy modes x 2 Postgres versions) is excellent
- Supply chain protection (5-day release age, SHA-pinned actions) is industry-leading

**Areas Where Gold Standards Excel**:
- kserve has better coverage enforcement with thresholds
- odh-dashboard has contract testing between components
- notebooks has deeper image testing with 5-layer validation

## File Paths Reference

### CI/CD
- `.github/workflows/pipeline.yml` - Main CI/CD pipeline (1339 lines, 24 jobs)
- `.github/workflows/codeql.yml` - CodeQL SAST
- `.github/workflows/semgrep.yml` - Semgrep security scanning
- `.github/workflows/snyk-web.yml` / `snyk-worker.yml` - Container scanning
- `.github/workflows/zizmor.yml` - GitHub Actions security audit
- `.github/workflows/claude-code-security-review.yml` - AI security review
- `.github/workflows/model-price-audit.yml` - Automated pricing audit
- `.github/workflows/deploy.yml` - ECS deployment
- `.github/workflows/storybook-preview.yml` - Storybook PR previews

### Testing
- `vitest.workspace.ts` - Root vitest workspace
- `web/vitest.config.mts` - Web test config (7 project configurations)
- `worker/vitest.config.ts` - Worker test config with v8 coverage
- `web/playwright.config.ts` - Playwright E2E config
- `web/src/__e2e__/*.spec.ts` - Playwright E2E tests (2 files)
- `worker/src/__tests__/*.test.ts` - Worker unit/integration tests (82+ files)

### Code Quality
- `web/eslint.config.mjs` - Web ESLint config
- `worker/eslint.config.mjs` - Worker ESLint config
- `packages/eslint-plugin/` - Custom ESLint plugin
- `prettier.config.cjs` - Prettier config
- `knip.jsonc` - Dead code detection config
- `.husky/pre-commit` - Pre-commit hooks (format + lint)
- `.codespellrc` - Spell checking config

### Container Images
- `web/Dockerfile` - Web multi-stage build
- `worker/Dockerfile` - Worker multi-stage build
- `docker-compose.build.yml` - Build compose with health checks
- `docker-compose.dev.yml` - Dev environment
- `docker-compose.dev-azure.yml` - Azure dev environment
- `docker-compose.dev-redis-cluster.yml` - Redis cluster dev environment

### Agent Rules
- `.agents/AGENTS.md` - Root agent guide
- `.agents/ARCHITECTURE_PRINCIPLES.md` - Architecture principles
- `.agents/skills/` - 25+ specialized skills
- `.agents/skills/backend-dev-guidelines/` - Testing guide, DB patterns, architecture
- `.agents/skills/clickhouse-best-practices/` - 25+ ClickHouse rules
- `.agents/skills/security-review/` - Security checklist

### Security
- `SECURITY.md` - Security disclosure policy
- `.semgrepignore` - Semgrep exclusions
- `pnpm-workspace.yaml` - Supply chain controls (minimumReleaseAge, allowBuilds)
