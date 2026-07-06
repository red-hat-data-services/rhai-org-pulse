---
repository: "opendatahub-io/openrag"
overall_score: 5.4
scorecard:
  - dimension: "Unit Tests"
    score: 5.5
    status: "12 backend unit tests with pytest; frontend has 0 unit tests despite 29K LoC"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "Strong integration suite (11 SDK + 2 core tests) and Playwright E2E on PRs, but only 2 E2E specs"
  - dimension: "Build Integration"
    score: 3.0
    status: "No PR-time Docker image build validation; images only built on release/nightly"
  - dimension: "Image Testing"
    score: 3.5
    status: "Multi-stage Dockerfiles and multi-arch builds, but no runtime validation, no container scanning"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "pytest-cov in dev deps but no coverage generation in CI, no codecov/coveralls, no thresholds"
  - dimension: "CI/CD Automation"
    score: 6.5
    status: "Good workflow organization with path-based triggers, caching, nightly builds, but missing concurrency control and no backend lint in CI"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules or test automation guidance"
critical_gaps:
  - title: "No code coverage tracking or enforcement"
    impact: "No visibility into test coverage; regressions go undetected"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container image security scanning"
    impact: "Vulnerabilities in container images shipped to production undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No PR-time Docker build validation"
    impact: "Dockerfile changes can break builds, discovered only after merge in release pipeline"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "Zero frontend unit tests"
    impact: "29K LoC of React/TypeScript code with no unit-level validation"
    severity: "HIGH"
    effort: "40-80 hours"
  - title: "No backend linting in CI"
    impact: "Python code quality issues not caught before merge; only frontend linting enforced"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No concurrency control on PR workflows"
    impact: "Wasted CI resources on superseded PR commits"
    severity: "LOW"
    effort: "1 hour"
quick_wins:
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Early detection of CVEs in base images and dependencies"
  - title: "Add codecov integration with coverage thresholds"
    effort: "3-4 hours"
    impact: "Visibility into test coverage and prevention of coverage regression"
  - title: "Add ruff linting to CI for Python backend"
    effort: "1-2 hours"
    impact: "Consistent Python code quality enforcement before merge"
  - title: "Add concurrency control to PR workflows"
    effort: "30 minutes"
    impact: "Cancel stale CI runs, save compute costs"
  - title: "Generate agent rules for test patterns"
    effort: "2-3 hours"
    impact: "Enable AI-assisted test generation with consistent patterns"
recommendations:
  priority_0:
    - "Add pytest-cov to CI workflows and integrate with codecov for coverage tracking and PR-level reporting"
    - "Add Trivy or Grype container scanning to the multi-arch build workflow and PR builds"
    - "Add PR-time Docker build validation (build images but don't push)"
  priority_1:
    - "Add frontend unit tests with Vitest/React Testing Library for the 29K LoC codebase"
    - "Add ruff or flake8 backend linting to CI pipeline"
    - "Expand E2E Playwright test suite beyond 2 specs to cover chat, document upload, search flows"
    - "Add SBOM generation to container builds"
  priority_2:
    - "Create Claude Code agent rules (.claude/rules/) for test automation guidance"
    - "Add npm/pip dependency audit to PR workflow (currently periodic only)"
    - "Add Dependabot for npm and pip ecosystems (currently only github-actions)"
    - "Add image signing and attestation to release pipeline"
---

# Quality Analysis: OpenRAG (opendatahub-io/openrag)

## Executive Summary

- **Overall Score: 5.4/10**
- **Repository Type**: Full-stack RAG platform (Python/FastAPI backend + Next.js/React frontend + OpenSearch + Langflow)
- **Primary Languages**: Python 3.13 (backend), TypeScript/React (frontend)
- **Key Strengths**: Well-structured integration test CI pipeline, multi-arch container builds, Playwright E2E on PRs, comprehensive Makefile, good use of caching
- **Critical Gaps**: No coverage tracking, no container security scanning, no frontend unit tests, no PR-time build validation, no agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, no .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 5.5/10 | 12 backend unit tests with pytest; zero frontend unit tests |
| Integration/E2E | 7.0/10 | Strong integration suite with SDK tests + Playwright E2E, but only 2 E2E specs |
| **Build Integration** | **3.0/10** | **No PR-time Docker build; images only built on release/nightly** |
| Image Testing | 3.5/10 | Multi-stage Dockerfiles, multi-arch builds, no runtime validation or scanning |
| Coverage Tracking | 1.0/10 | pytest-cov in dev deps but unused; no CI coverage, no thresholds |
| CI/CD Automation | 6.5/10 | Path-based triggers, caching, nightly builds; missing concurrency control |
| Agent Rules | 0.0/10 | No agent rules, no test automation guidance |

## Critical Gaps

### 1. No Code Coverage Tracking or Enforcement
- **Impact**: No visibility into which code is tested; regressions in coverage go undetected
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: `pytest-cov` is in dev dependencies but never invoked in CI. No `.codecov.yml`, no coverage upload, no PR-level coverage reporting, no minimum thresholds.

### 2. No Container Image Security Scanning
- **Impact**: Vulnerabilities in 5 Dockerfiles (opensearch, backend, frontend, langflow, langflow-dev) shipped to production undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Trivy, Snyk, or Grype scanning anywhere in CI. CodeQL covers source code but not container images. The `dependency-audit.yml` workflow runs `pip-audit` and `npm audit` periodically but this is separate from container scanning and doesn't run on PRs.

### 3. No PR-Time Docker Build Validation
- **Impact**: Dockerfile changes can break builds but are discovered only after merge when the release pipeline runs
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The `build-multiarch.yml` only triggers on pushes to main when `pyproject.toml` changes. There is no PR workflow that validates Dockerfile builds. The integration test CI (`test-integration.yml`) uses `make test-ci-local` which builds images, but only on self-hosted ARM64 runners.

### 4. Zero Frontend Unit Tests
- **Impact**: 29,231 lines of React/TypeScript code with no unit-level validation; UI regressions are invisible
- **Severity**: HIGH
- **Effort**: 40-80 hours
- **Details**: The frontend has 203 source files across components, hooks, contexts, lib, and stores but zero unit test files. Only 2 Playwright E2E specs exist (`onboarding.spec.ts`, `tasks-unified-panel.spec.ts`). No Vitest, Jest, or React Testing Library configured.

### 5. No Backend Linting in CI
- **Impact**: Python code quality not enforced before merge
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: Frontend has Biome linting in CI via `lint-frontend.yml`, but there is no backend linting workflow. No `ruff.toml`, `.flake8`, or `mypy.ini` configuration exists. The `make lint` target only runs frontend linting.

## Quick Wins

### 1. Add Trivy Container Scanning (1-2 hours)
Add Trivy scanning to the multi-arch build workflow:
```yaml
- name: Scan image with Trivy
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ matrix.tag }}:${{ needs.check-version.outputs.docker_version }}-${{ matrix.arch }}
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
- name: Upload Trivy results
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: 'trivy-results.sarif'
```

### 2. Add Codecov Integration (3-4 hours)
Add coverage to test workflows:
```yaml
- name: Run tests with coverage
  run: uv run pytest tests/unit/ -v --cov=src --cov-report=xml
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    file: coverage.xml
    fail_ci_if_error: true
```

### 3. Add Ruff Backend Linting (1-2 hours)
Create `ruff.toml` and add to CI:
```yaml
- name: Run ruff
  run: uv run ruff check src/ tests/
```

### 4. Add Concurrency Control (30 minutes)
Add to E2E and integration test workflows:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

### 5. Generate Agent Rules (2-3 hours)
Run `/test-rules-generator` to create `.claude/rules/` with test automation guidance for Python pytest and Playwright patterns.

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (21 workflows)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pr-checks.yml` | PR | Semantic PR title validation |
| `lint-frontend.yml` | PR (frontend/**) | Biome linting |
| `test-e2e.yml` | PR (src/frontend/tests paths) | Playwright E2E tests |
| `test-integration.yml` | PR (*.py, sdks, flows paths) | Integration + SDK tests |
| `build-multiarch.yml` | Push to main (pyproject.toml) | Multi-arch Docker builds + PyPI publish |
| `nightly-build.yml` | Scheduled (daily 04:00 UTC) | Nightly Docker images + PyPI |
| `codeql.yml` | Push/PR/weekly | CodeQL SAST (Python + JS) |
| `dependency-audit.yml` | Scheduled (Mon/Thu 09:00) | npm audit + pip-audit |
| `deploy-docs-draft.yml` | PR (docs path) | Draft documentation deploys |
| `deploy-gh-pages.yml` | Push to main | Documentation publishing |
| `labeler.yml` | PR | Auto-labeling |
| `add-labels.yml` | PR | Additional label automation |
| `conventional-labels.yml` | PR | Conventional commit labels |
| `community-label.yml` | PR | Community contributor labels |
| `auto-delete-branch.yml` | PR merge | Delete merged branches |
| `update-uv-lock.yml` | Dispatch | Update uv.lock file |
| `publish-mcp.yml` | Release/dispatch | Publish MCP SDK |
| `publish-sdk-python.yml` | Release/dispatch | Publish Python SDK |
| `publish-sdk-typescript.yml` | Release/dispatch | Publish TypeScript SDK |
| `manual-docker-publish.yml` | Dispatch | Manual Docker image push |

**Strengths**:
- Path-based triggers minimize unnecessary CI runs
- Docker image and Playwright browser caching in E2E workflow
- Comprehensive Makefile with `test-ci` and `test-ci-local` targets
- Self-hosted ARM64 runners for integration tests

**Weaknesses**:
- No concurrency control on any workflow
- No PR-time Docker build validation
- No backend Python linting in CI
- Dependency audit is periodic only, not on PRs

### Test Coverage

**Backend Unit Tests (12 files, ~1,200 LoC)**:
- `tests/unit/test_encryption.py` — encryption utilities
- `tests/unit/test_ibm_encryption.py` — IBM-specific encryption
- `tests/unit/test_oauth_encryption.py` — OAuth encryption
- `tests/unit/test_encryption_enforcement.py` — enforcement logic
- `tests/unit/test_env_manager.py` — environment management
- `tests/unit/test_langflow_utils.py` — Langflow utilities
- `tests/unit/test_main_docs_signature.py` — main module signatures
- `tests/unit/test_opensearch_disk_space.py` — disk space checks
- `tests/unit/test_settings_refresh_endpoint.py` — settings endpoints
- `tests/unit/test_startup_checks_cleanup.py` — startup validation
- `tests/unit/test_container_manager_cleanup.py` — container cleanup
- `tests/unit/test_task_service.py` — task service

**Backend Integration Tests (11 SDK + 2 core)**:
- `tests/integration/core/test_api_endpoints.py` — API validation
- `tests/integration/core/test_startup_ingest.py` — startup ingestion
- `tests/integration/sdk/test_auth.py` — SDK authentication
- `tests/integration/sdk/test_chat.py` — SDK chat flow
- `tests/integration/sdk/test_documents.py` — document management
- `tests/integration/sdk/test_e2e.py` — SDK end-to-end
- `tests/integration/sdk/test_errors.py` — error handling
- `tests/integration/sdk/test_filters.py` — filtering
- `tests/integration/sdk/test_models.py` — model operations
- `tests/integration/sdk/test_search.py` — search functionality
- `tests/integration/sdk/test_settings.py` — settings

**Frontend E2E Tests (2 specs)**:
- `frontend/tests/core/onboarding.spec.ts` — basic onboarding check
- `frontend/tests/core/tasks-unified-panel.spec.ts` — task panel

**TypeScript SDK Tests (1 file)**:
- `sdks/typescript/tests/integration.test.ts` — SDK integration via Vitest

**Test-to-Code Ratio**:
- Backend: 3,261 LoC tests / 40,092 LoC source = **0.08** (very low; target >0.5)
- Frontend: ~30 LoC tests / 29,231 LoC source = **~0.001** (essentially untested)

### Code Quality

**Frontend**:
- **Biome** (v2.3.5): Well-configured linter with specific rules for correctness, complexity, suspicious patterns, and a11y
- **ESLint**: Also configured via `eslint-config-next`
- **Husky pre-commit**: Runs `lint-staged` on frontend
- **Knip**: Dead code detection configured
- **TypeScript**: `tsconfig.json` present

**Backend**:
- **No linter configured**: No ruff, flake8, mypy, pylint, or black
- **No type checking**: No mypy or pyright
- **Pre-commit**: Only `detect-secrets` hook configured (via Yelp/detect-secrets)

**Static Analysis**:
- **CodeQL**: Configured for Python and JavaScript on push/PR/weekly
- **detect-secrets**: Pre-commit hook with `.secrets.baseline`
- **Dependabot**: Only for `github-actions` ecosystem; does not cover npm or pip

### Container Images

**Dockerfiles (5 total)**:
1. `Dockerfile` — OpenSearch with custom plugins (2-stage, UBI9 base)
2. `Dockerfile.backend` — Python FastAPI backend (3-stage, python:3.13-slim)
3. `Dockerfile.frontend` — Next.js frontend (single-stage, node:20.20.0-slim)
4. `Dockerfile.langflow` — Langflow service
5. `Dockerfile.langflow.dev` — Langflow development

**Strengths**:
- Multi-stage builds for backend (builder/runtime separation)
- Multi-architecture support (amd64 + arm64)
- GHA build caching
- UBI9 base for OpenSearch (Red Hat compliance)
- Nightly builds with versioning

**Weaknesses**:
- No container vulnerability scanning (Trivy/Grype/Snyk)
- No SBOM generation
- No image signing/attestation
- No runtime validation tests
- Frontend Dockerfile is single-stage (build artifacts mixed with build tools)
- No `.trivyignore` for known false positives
- No health check instructions in Dockerfiles

### Security

**Strengths**:
- CodeQL SAST scanning (Python + JavaScript) on push/PR/weekly
- Secret detection via `detect-secrets` pre-commit hook with baseline
- Periodic dependency auditing (npm audit + pip-audit, Mon/Thu)
- JWT authentication infrastructure
- OIDC integration with OpenSearch

**Weaknesses**:
- No container image scanning
- No Dependabot for npm or pip dependencies (only github-actions)
- Dependency audit is periodic, not on PRs
- No SBOM generation
- No image signing

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No test types have agent rules
- **Quality**: N/A
- **Gaps**: No `CLAUDE.md`, no `.claude/` directory, no `AGENTS.md`, no test automation guidance
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - Python pytest unit test patterns
  - Integration test patterns with Docker compose
  - Playwright E2E test patterns
  - SDK test patterns (Python + TypeScript)

## Recommendations

### Priority 0 (Critical)

1. **Add code coverage tracking and enforcement**
   - Add `--cov` to pytest runs in CI
   - Integrate with Codecov or Coveralls
   - Set minimum coverage thresholds (start at current baseline, ratchet up)
   - Add PR-level coverage reporting

2. **Add container security scanning**
   - Add Trivy scanning to build workflows
   - Set severity thresholds (fail on CRITICAL/HIGH)
   - Upload results to GitHub Security tab via SARIF

3. **Add PR-time Docker build validation**
   - Build all Dockerfiles on PRs that touch Dockerfile*, pyproject.toml, or package.json
   - Don't push images, just validate they build
   - Include basic startup health checks

### Priority 1 (High Value)

4. **Add frontend unit tests**
   - Set up Vitest + React Testing Library
   - Start with utility functions (`lib/`) and hooks
   - Add component tests for critical UI (chat, document upload, knowledge management)
   - Target 50%+ coverage for new code

5. **Add backend Python linting**
   - Configure Ruff with reasonable defaults
   - Add `ruff check` and `ruff format --check` to CI
   - Consider adding mypy for type checking

6. **Expand E2E test coverage**
   - Add Playwright tests for chat flow, document upload, search, settings
   - Currently only 2 specs covering onboarding and task panel
   - Target core user journeys

7. **Add SBOM generation to container builds**
   - Use Syft or Docker BuildKit SBOM support
   - Attach SBOMs as build artifacts

### Priority 2 (Nice-to-Have)

8. **Create Claude Code agent rules**
   - Generate `.claude/rules/` with test creation patterns
   - Include pytest patterns, Playwright patterns, SDK test patterns
   - Document testing standards and quality gates

9. **Expand Dependabot coverage**
   - Add npm and pip ecosystems to dependabot.yml
   - Currently only monitors github-actions

10. **Move dependency audit to PR-time**
    - Run `npm audit` and `pip-audit` on PRs, not just periodic

11. **Add image signing and attestation**
    - Use cosign for image signing
    - Generate SLSA provenance

## Comparison to Gold Standards

| Capability | OpenRAG | odh-dashboard | notebooks | kserve |
|-----------|---------|---------------|-----------|--------|
| Unit test coverage | Partial (backend only) | Comprehensive (Jest + Go) | Moderate | Strong (Go) |
| Frontend unit tests | None | Extensive (Jest + RTL) | N/A | N/A |
| Integration tests | Strong (SDK + core) | Strong (Cypress + API) | Moderate | Strong (envtest) |
| E2E tests | Minimal (2 specs) | Comprehensive (Cypress) | N/A | Multi-version |
| Coverage tracking | None | Codecov enforced | Partial | Codecov enforced |
| Container scanning | None | Trivy | Trivy multi-layer | Trivy |
| PR build validation | None | Full build matrix | Image build + test | Full build |
| SBOM | None | Yes | Yes | Yes |
| Agent rules | None | Comprehensive | None | Partial |
| Pre-commit hooks | detect-secrets only | Multi-tool | Moderate | Multi-tool |
| Backend linting | None | golangci-lint | Various | golangci-lint |
| Frontend linting | Biome + ESLint | ESLint strict | N/A | N/A |
| Dependency scanning | Periodic | PR-time | PR-time | PR-time |
| Multi-arch builds | Yes (amd64 + arm64) | Yes | Yes | Yes |
| Nightly builds | Yes | Yes | Yes | Yes |

## File Paths Reference

### CI/CD
- `.github/workflows/pr-checks.yml` — PR title validation
- `.github/workflows/lint-frontend.yml` — Frontend Biome lint
- `.github/workflows/test-e2e.yml` — Playwright E2E tests
- `.github/workflows/test-integration.yml` — Integration + SDK tests
- `.github/workflows/build-multiarch.yml` — Multi-arch Docker builds
- `.github/workflows/nightly-build.yml` — Nightly Docker + PyPI
- `.github/workflows/codeql.yml` — CodeQL SAST
- `.github/workflows/dependency-audit.yml` — npm/pip audit

### Testing
- `tests/unit/` — Backend unit tests (12 files)
- `tests/integration/core/` — Core integration tests (2 files)
- `tests/integration/sdk/` — SDK integration tests (9 files)
- `frontend/tests/core/` — Playwright E2E specs (2 files)
- `sdks/typescript/tests/` — TypeScript SDK tests (1 file)

### Code Quality
- `frontend/biome.json` — Biome linter configuration
- `frontend/eslint.config.mjs` — ESLint configuration
- `frontend/.husky/pre-commit` — Husky pre-commit hook
- `.pre-commit-config.yaml` — detect-secrets hook
- `.secrets.baseline` — Known secrets baseline

### Container Images
- `Dockerfile` — OpenSearch (2-stage, UBI9)
- `Dockerfile.backend` — Backend (3-stage, python:3.13-slim)
- `Dockerfile.frontend` — Frontend (single-stage, node:20.20.0-slim)
- `Dockerfile.langflow` — Langflow service
- `Dockerfile.langflow.dev` — Langflow development
- `docker-compose.yml` — Main compose file
- `docker-compose.gpu.yml` — GPU override
- `docker-compose.dev.yml` — Development override

### Build
- `Makefile` — Comprehensive build/test/dev targets
- `pyproject.toml` — Python project configuration
- `frontend/package.json` — Frontend dependencies and scripts
