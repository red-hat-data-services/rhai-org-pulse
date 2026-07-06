---
repository: "langflow-ai/openrag"
overall_score: 7.4
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "132 unit tests across well-organized directories with pytest, pytest-asyncio, pytest-mock"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "3-suite integration matrix (core, sdk-python, sdk-typescript) + Playwright E2E with full docker-compose stack"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR builds all 4 Docker images with caching; no Konflux simulation but strong image caching strategy"
  - dimension: "Image Testing"
    score: 6.5
    status: "PR-time image builds validated, multi-arch nightly builds, but no runtime startup validation or Trivy scanning"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "pytest-cov in dev deps and Go coverprofile generated, but no codecov integration, no thresholds, no PR reporting"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "25 workflows covering lint, test, build, release, nightly, dependency audit, autofix; concurrency control and caching"
  - dimension: "Agent Rules"
    score: 5.0
    status: "CLAUDE.md, AGENTS.md, and 2 skills present (install, sdk) but no test automation rules or .claude/rules/"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Coverage regressions go undetected; no visibility into test gaps across PRs"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container vulnerability scanning"
    impact: "CVEs in base images or dependencies not detected until production"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No image runtime validation in CI"
    impact: "Image startup failures (missing env vars, broken entrypoints) not caught until deployment"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "Python SDK has no tests"
    impact: "Python SDK regressions shipped to PyPI without detection"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No test automation agent rules"
    impact: "AI-generated tests lack consistency and miss project-specific patterns"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add codecov integration with PR reporting"
    effort: "2-4 hours"
    impact: "Immediate visibility into coverage changes per PR"
  - title: "Add Trivy scanning to nightly-build workflow"
    effort: "1-2 hours"
    impact: "Catch CVEs in all 4 container images before release"
  - title: "Add image startup smoke test to test-ci.yml"
    effort: "2-3 hours"
    impact: "Verify all images start and respond to health checks"
  - title: "Generate agent test rules with /test-rules-generator"
    effort: "1-2 hours"
    impact: "Consistent AI-generated tests following project patterns"
  - title: "Expand Dependabot to npm and pip ecosystems"
    effort: "30 minutes"
    impact: "Automated dependency update PRs across all ecosystems"
recommendations:
  priority_0:
    - "Add codecov/coveralls integration with coverage thresholds and PR gating"
    - "Add Trivy container scanning to PR and nightly workflows"
    - "Write Python SDK integration tests (parity with TypeScript SDK)"
  priority_1:
    - "Add container runtime startup validation (health check smoke tests) in CI"
    - "Create .claude/rules/ test automation rules for unit, integration, and E2E patterns"
    - "Expand Dependabot config to cover npm (frontend, sdks/typescript) and pip ecosystems"
    - "Add SBOM generation to release workflow"
  priority_2:
    - "Add performance regression tests for search and ingestion endpoints"
    - "Add frontend unit tests with Vitest (currently 0 frontend unit tests)"
    - "Add contract tests for SDK-to-backend API boundaries"
    - "Consider adding golangci-lint config file for operator (currently using defaults)"
---

# Quality Analysis: OpenRAG (langflow-ai/openrag)

## Executive Summary

- **Overall Score: 7.4/10**
- **Repository Type**: Full-stack RAG platform (Python backend + Next.js frontend + Kubernetes operator + SDKs)
- **Primary Languages**: Python 3.13, TypeScript, Go
- **Key Strengths**: Excellent CI/CD automation with 25 workflows, comprehensive integration test matrix with real docker-compose infrastructure, multi-arch image builds, automated code formatting
- **Critical Gaps**: No coverage tracking or enforcement, no container vulnerability scanning, Python SDK ships without tests
- **Agent Rules Status**: Partial — CLAUDE.md and AGENTS.md exist with 2 install/SDK skills, but no test automation rules

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.0/10 | 132 unit tests with pytest, well-organized by domain |
| Integration/E2E | 8.5/10 | 3-suite CI matrix + Playwright E2E with full stack |
| **Build Integration** | **7.0/10** | **PR builds all images with caching; no Konflux sim** |
| Image Testing | 6.5/10 | Multi-arch builds, no runtime validation or scanning |
| Coverage Tracking | 3.0/10 | pytest-cov available but no integration or enforcement |
| CI/CD Automation | 9.0/10 | 25 workflows with concurrency control, caching, autofix |
| Agent Rules | 5.0/10 | CLAUDE.md + AGENTS.md + 2 skills, no test rules |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: Coverage regressions go undetected; team has no visibility into which PRs reduce coverage
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: `pytest-cov` is in dev dependencies and the Go operator generates `cover.out`, but there's no codecov/coveralls integration, no coverage thresholds, and no PR coverage reporting. Coverage data is generated and discarded.
- **Implementation**:
  ```yaml
  # Add to test-ci.yml after pytest runs:
  - name: Upload coverage
    uses: codecov/codecov-action@v4
    with:
      token: ${{ secrets.CODECOV_TOKEN }}
      fail_ci_if_error: true
  ```

### 2. No Container Vulnerability Scanning
- **Impact**: CVEs in UBI10 base images, Python packages, or Node.js dependencies not detected until production
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The project builds 4 container images (backend, frontend, langflow, opensearch) without any scanning. No Trivy, Snyk, or Grype integration. The `dependency-audit.yml` catches npm/pip issues but misses container-layer vulnerabilities.
- **Implementation**:
  ```yaml
  - name: Trivy scan
    uses: aquasecurity/trivy-action@master
    with:
      image-ref: langflowai/openrag-backend:${{ env.CI_IMAGE_TAG }}
      severity: CRITICAL,HIGH
      exit-code: 1
  ```

### 3. Python SDK Ships Without Tests
- **Impact**: Regressions in the Python SDK (`openrag_sdk`) are published to PyPI without detection
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: The TypeScript SDK has a comprehensive `integration.test.ts` with document CRUD, search, chat, and error handling. The Python SDK has only an empty `tests/__init__.py`. The `publish-sdk-python.yml` workflow publishes without running any tests.

### 4. No Image Runtime Validation
- **Impact**: Broken entrypoints, missing env vars, or startup crashes discovered only in deployment
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: The CI builds all images on PR but only runs them through docker-compose for integration/E2E tests. There's no dedicated health check validation that verifies each image starts independently and responds correctly. The docker-compose startup is an implicit integration test but doesn't isolate image-level failures.

### 5. No Test Automation Agent Rules
- **Impact**: AI-generated tests miss project-specific patterns (conftest fixtures, RBAC setup, async patterns)
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: The `.claude/skills/` directory contains install and SDK skills but no test creation rules. Given the complex test infrastructure (session-scoped async fixtures, RBAC enforcement, OpenSearch client setup), agent-generated tests without rules will miss critical patterns.

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
- Add `codecov/codecov-action@v4` to `test-ci.yml` after unit tests run
- Create `.codecov.yml` with thresholds (e.g., 60% project, patch must not decrease)
- Add coverage badge to README
- **Impact**: Immediate visibility into coverage trends per PR

### 2. Add Trivy Scanning (1-2 hours)
- Add `aquasecurity/trivy-action` step after image builds in `nightly-build.yml`
- Set severity to CRITICAL,HIGH with exit-code 1
- Consider adding `.trivyignore` for accepted risks
- **Impact**: Catch CVEs before images reach DockerHub

### 3. Add Image Startup Smoke Test (2-3 hours)
- After docker-compose up, verify each service health endpoint
- Add a simple `curl --retry 10 --retry-delay 3 http://localhost:8000/health` step
- Already partially done in E2E setup, but could be more explicit and isolated
- **Impact**: Faster feedback on image startup issues

### 4. Generate Agent Test Rules (1-2 hours)
- Run `/test-rules-generator` against the repository
- Creates `.claude/rules/` with patterns for pytest-asyncio, conftest fixtures, RBAC setup
- **Impact**: Consistent AI-generated tests matching project conventions

### 5. Expand Dependabot Coverage (30 minutes)
- Current config only covers `github-actions` ecosystem
- Add `npm` for `frontend/`, `sdks/typescript/`, `docs/`
- Add `pip` for root and `sdks/python/`
- **Impact**: Automated dependency update PRs across all package managers

## Detailed Findings

### CI/CD Pipeline

**Strengths (9.0/10)**:
- **25 workflows** covering the full development lifecycle
- **Path-based filtering** — lint-backend only runs on `src/**/*.py` changes, operator-ci only on `kubernetes/operator/**`
- **Concurrency control** — `lint-backend`, `autofix.ci` use `cancel-in-progress: true`
- **Image caching** — PR builds use `actions/cache@v4` with content-hash keys per image
- **Automated formatting** — `autofix.ci.yml` applies ruff fixes via the autofix.ci App
- **Change detection** — `dorny/paths-filter@v3` skips E2E/integration for docs-only changes
- **Semantic PR titles** — `action-semantic-pull-request@v6.1.1` enforces conventional commits
- **Nightly builds** with PEP 440-compliant versioning and PyPI publishing
- **Multi-arch builds** — amd64 + arm64 for all 4 images with manifest creation
- **Test matrix** — integration tests split into 3 suites (core, sdk-python, sdk-typescript) running in parallel

**Gaps**:
- No `workflow_call` reuse between similar jobs (some duplication in build steps)
- Dependabot only covers `github-actions`, not `npm` or `pip`
- No manual approval gates for production releases

### Test Coverage

**Unit Tests (8.0/10)**:
- 132 Python unit test files across well-organized subdirectories
- Tests cover: services, API endpoints, connectors, config, dependencies, utilities, database migrations
- Uses pytest + pytest-asyncio + pytest-mock
- Domain-specific test fixtures with session-scoped async setup
- 5 Go operator controller tests (~2,500 lines)

**Integration Tests (8.5/10)**:
- 8 core integration tests against real docker-compose stack (OpenSearch, Langflow, backend)
- TypeScript SDK integration tests with document CRUD, search, chat, error handling
- 11 Python SDK integration tests (auth, chat, documents, e2e, errors, filters, models, search, settings)
- CI builds all images from source on PRs before running tests
- Test isolation with temp SQLite databases and env var overrides

**E2E Tests (7.0/10)**:
- Playwright-based with chromium, 2 spec files (onboarding, tasks-unified-panel)
- Full infrastructure setup via `scripts/setup-e2e.sh`
- 5-minute timeout, retry on CI, HTML reporter
- Artifact upload on failure (service logs, Playwright report)
- **Gap**: Only 2 E2E test files — limited UI test coverage for a full-featured application

**Coverage Tracking (3.0/10)**:
- `pytest-cov` in dev dependencies but no CI integration
- Go operator generates `cover.out` via `go test -coverprofile` but doesn't upload
- No `.codecov.yml` or coveralls config
- No coverage thresholds or PR checks
- No coverage badges or reporting

### Code Quality

**Linting (8.5/10)**:
- **Python**: Ruff with E, F, I, B, UP rules; mypy with Python 3.13 targeting
- **TypeScript**: Biome for linting + formatting; TypeScript strict type checking
- **Go**: golangci-lint v2.11.4 in operator CI (using defaults, no config file)
- **Frontend**: React Doctor score check (minimum threshold: 40)
- Auto-fix pipeline: ruff check --fix + ruff format via autofix.ci App on PRs

**Pre-commit Hooks**:
- `detect-secrets` (Yelp v1.5.0) with baseline file
- Only one hook configured — no formatting, linting, or type checking pre-commit
- Husky configured in frontend for lint-staged

**Static Analysis (7.0/10)**:
- CodeQL for Python and JavaScript on push/PR/weekly schedule
- No SAST beyond CodeQL (no gosec, Semgrep, or Bandit)
- `dependency-audit.yml` runs npm audit and pip-audit on schedule (Mon/Thu 9AM UTC)

### Container Images

**Build Process (7.5/10)**:
- 4 specialized Dockerfiles (backend, frontend, langflow, opensearch)
- Backend uses multi-stage build with UBI10 base (`registry.access.redhat.com/ubi10/python-314-minimal`)
- Non-root user (uid 1000) in production stage
- `--mount=type=cache` for uv/pip layer caching
- Separate builder and runtime stages minimize final image size

**Multi-Architecture (9.0/10)**:
- amd64 + arm64 for all 4 images
- Separate build jobs per arch with GHA cache
- Multi-arch manifests created via `docker buildx imagetools create`
- Self-hosted ARM64 runners with 40GB ephemeral storage

**Security Scanning (2.0/10)**:
- **No Trivy, Snyk, or Grype scanning**
- No vulnerability thresholds
- No SBOM generation
- No image signing or attestation
- Dependency audit (npm/pip) covers packages but not container layers

### Security Practices

**Strengths**:
- CodeQL on Python + JavaScript with weekly schedule
- Dependabot for GitHub Actions updates
- `detect-secrets` pre-commit hook with baseline
- SECURITY.md with responsible disclosure process and 5-day SLA
- Non-root container user
- JWT key generation with RSA
- RBAC enforcement system (opt-in, tested in CI)

**Gaps**:
- No container image scanning
- No SAST beyond CodeQL (missing gosec for Go operator)
- Dependabot only covers github-actions ecosystem
- No Gitleaks in CI (only pre-commit)

### Agent Rules (Agentic Flow Quality)

**Status**: Partial
- **CLAUDE.md**: Present — points to AGENTS.md
- **AGENTS.md**: Present — documents 2 skills (install, SDK), operational constraints, dev-local setup
- `.claude/skills/`: Contains `install/` and `sdk/` skills for OpenRAG setup and SDK integration
- **No `.claude/rules/`**: Missing test automation rules entirely
- **No test patterns documented**: Complex pytest-asyncio patterns (session fixtures, RBAC monkeypatch, temp DB setup) not captured for agent use

**Coverage**: Install and SDK guidance only — no test creation rules
**Quality**: Existing skills are well-written with YAML frontmatter and agent-neutral instructions
**Gaps**:
- No unit test rules (pytest patterns, async fixtures, mock setup)
- No integration test rules (docker-compose setup, client initialization, SDK test patterns)
- No E2E test rules (Playwright patterns, onboarding flow, test data)
- No operator test rules (Go envtest, controller reconciliation patterns)

**Recommendation**: Run `/test-rules-generator` to generate comprehensive test rules

## Recommendations

### Priority 0 (Critical)

1. **Add codecov/coveralls integration with coverage thresholds and PR gating**
   - Install `codecov/codecov-action@v4` in test-ci.yml
   - Set minimum coverage thresholds (project: 60%, patch: 70%)
   - Add coverage badge to README.md
   - Upload Go operator coverage from `cover.out`

2. **Add Trivy container scanning to PR and nightly workflows**
   - Scan all 4 images after build
   - Set `severity: CRITICAL,HIGH` with `exit-code: 1`
   - Add `.trivyignore` for accepted risks (document justifications)

3. **Write Python SDK integration tests (parity with TypeScript SDK)**
   - Mirror TypeScript SDK test coverage: document CRUD, search, chat, error handling
   - Add to CI test matrix alongside existing sdk-python suite
   - Gate `publish-sdk-python.yml` on test passage

### Priority 1 (High Value)

4. **Add container runtime startup validation in CI**
   - After image build, run each image with minimal config
   - Verify health endpoints respond correctly
   - Detect broken entrypoints, missing dependencies

5. **Create `.claude/rules/` test automation rules**
   - Document pytest-asyncio patterns, conftest fixtures, RBAC setup patterns
   - Add Playwright E2E test conventions
   - Add Go operator test patterns (envtest, controller reconciliation)

6. **Expand Dependabot to npm and pip ecosystems**
   - Add `npm` entries for `frontend/`, `sdks/typescript/`, `docs/`
   - Add `pip` entry for root project and `sdks/python/`

7. **Add SBOM generation to release workflow**
   - Use `anchore/sbom-action` or `docker/build-push-action` SBOM output
   - Attach SBOMs as release artifacts

### Priority 2 (Nice-to-Have)

8. **Add performance regression tests for search and ingestion endpoints**
   - Measure latency for document ingestion, search queries, and chat responses
   - Set baseline thresholds and fail on regression

9. **Add frontend unit tests with Vitest**
   - Currently 0 frontend unit tests (only 2 Playwright E2E specs)
   - Add component tests for critical UI paths

10. **Add contract tests for SDK-to-backend API boundaries**
    - Use Pact or similar to validate SDK expectations match backend API

11. **Add golangci-lint config file for operator**
    - Currently using defaults — enable additional linters (errcheck, gocritic, revive)

## Comparison to Gold Standards

| Dimension | OpenRAG | odh-dashboard | notebooks | kserve |
|-----------|---------|---------------|-----------|--------|
| Unit Tests | 8.0 — 132 tests, well-organized | 9.0 — Comprehensive Jest suite | 7.0 — Script-based | 9.0 — envtest + mock |
| Integration/E2E | 8.5 — 3-suite matrix + Playwright | 9.5 — Contract tests + Cypress | 6.0 — Manual | 8.5 — Multi-version |
| Build Integration | 7.0 — PR image builds, no Konflux | 7.0 — PR builds, no Konflux | 8.0 — Multi-layer validation | 7.0 — Prow-based |
| Image Testing | 6.5 — Multi-arch, no scanning | 7.0 — Basic validation | 9.5 — 5-layer validation | 7.0 — Startup tests |
| Coverage Tracking | 3.0 — No integration | 9.0 — Codecov + enforcement | 4.0 — Limited | 9.0 — PR gating |
| CI/CD Automation | 9.0 — 25 workflows, autofix | 9.0 — Comprehensive | 8.0 — Good automation | 9.0 — Prow + GHA |
| Agent Rules | 5.0 — Install/SDK skills only | 8.0 — Test rules + skills | 3.0 — None | 2.0 — None |

## File Paths Reference

### CI/CD Workflows
- `.github/workflows/test-ci.yml` — Main test pipeline (integration + E2E)
- `.github/workflows/lint-backend.yml` — Ruff + mypy on changed files
- `.github/workflows/lint-frontend.yml` — Biome + TypeScript + React Doctor
- `.github/workflows/operator-ci.yml` — Go fmt/vet/lint/test + Helm lint + Docker build
- `.github/workflows/codeql.yml` — CodeQL for Python + JavaScript
- `.github/workflows/autofix.ci.yml` — Ruff autofix via autofix.ci App
- `.github/workflows/dependency-audit.yml` — npm audit + pip-audit (Mon/Thu)
- `.github/workflows/nightly-build.yml` — Nightly multi-arch builds + PyPI publish
- `.github/workflows/build-multiarch.yml` — Release multi-arch builds

### Testing
- `tests/unit/` — 125 Python unit tests
- `tests/integration/core/` — 8 core integration tests
- `tests/integration/sdk/` — 11 SDK integration tests
- `frontend/tests/core/` — 2 Playwright E2E specs
- `kubernetes/operator/internal/controller/*_test.go` — 5 Go operator tests
- `sdks/typescript/tests/integration.test.ts` — TypeScript SDK tests

### Code Quality
- `pyproject.toml` — Ruff, mypy, pytest config
- `.pre-commit-config.yaml` — detect-secrets only
- `frontend/package.json` — Biome config
- `.github/dependabot.yml` — GitHub Actions only

### Container Images
- `Dockerfile.backend` — Multi-stage UBI10 backend image
- `Dockerfile.frontend` — Next.js frontend image
- `Dockerfile.langflow` — Langflow service image
- `Dockerfile` — OpenSearch custom image
- `kubernetes/operator/Dockerfile` — Go operator image

### Agent Rules
- `CLAUDE.md` — Points to AGENTS.md
- `AGENTS.md` — Agent instructions and skill documentation
- `.claude/skills/install/` — OpenRAG installation skill
- `.claude/skills/sdk/` — SDK integration skill
