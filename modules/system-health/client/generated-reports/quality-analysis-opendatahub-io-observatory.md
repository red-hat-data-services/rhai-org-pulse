---
repository: "opendatahub-io/observatory"
overall_score: 3.4
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Strong backend test suite with pytest + httpx AsyncClient; weak frontend coverage"
  - dimension: "Integration/E2E"
    score: 4.0
    status: "API-level integration tests exist but no browser E2E or multi-version testing"
  - dimension: "Build Integration"
    score: 2.0
    status: "No CI workflows; Makefile build targets are local-only"
  - dimension: "Image Testing"
    score: 5.0
    status: "Good Dockerfile with multi-stage build and health checks; no runtime validation or UBI base"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tooling, thresholds, or PR reporting configured"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "No CI/CD workflows — no GitHub Actions, GitLab CI, or Jenkinsfile"
  - dimension: "Static Analysis"
    score: 3.0
    status: "Minimal ruff config; no pre-commit hooks, no Dependabot/Renovate"
  - dimension: "Agent Rules"
    score: 7.0
    status: "AGENTS.md with coding standards and 3 custom Claude skills with tests"
critical_gaps:
  - title: "No CI/CD pipeline exists"
    impact: "Tests, linting, and builds never run automatically — regressions reach production unchecked"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No code coverage tracking"
    impact: "Cannot measure or enforce test coverage; blind spots accumulate silently"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No PR-time build validation"
    impact: "Dockerfile and Kustomize breakage discovered only after merge or manual testing"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No browser-based E2E tests"
    impact: "React frontend with 30+ components has only 4 test files; UI regressions undetected"
    severity: "MEDIUM"
    effort: "16-24 hours"
  - title: "Non-UBI base images"
    impact: "python:3.11-slim and node:20-alpine are not FIPS-capable; blocks FIPS certification"
    severity: "MEDIUM"
    effort: "4-8 hours"
quick_wins:
  - title: "Add GitHub Actions CI workflow for tests and lint"
    effort: "2-4 hours"
    impact: "Automated quality gates on every PR; prevents regressions from merging"
  - title: "Enable pytest-cov and add Codecov integration"
    effort: "1-2 hours"
    impact: "Immediate visibility into test coverage with PR-level reporting"
  - title: "Add Dependabot configuration"
    effort: "30 minutes"
    impact: "Automated dependency update PRs with security alerts"
  - title: "Add pre-commit hooks with ruff"
    effort: "1 hour"
    impact: "Enforce linting before commits; catch issues earlier in the workflow"
  - title: "Expand ruff config with recommended rule sets"
    effort: "1 hour"
    impact: "Catch more bugs and style issues with minimal effort"
recommendations:
  priority_0:
    - "Create GitHub Actions CI pipeline with test, lint, and build jobs on every PR"
    - "Add pytest-cov to dev dependencies and configure coverage thresholds (target: 70%)"
    - "Add Codecov integration for PR coverage reporting and enforcement"
  priority_1:
    - "Add Playwright or Cypress for browser-based E2E testing of critical frontend flows"
    - "Switch base images to UBI (ubi9/python-311, ubi9/nodejs-20) for FIPS capability"
    - "Add PR-time Docker build validation in CI to catch image breakage before merge"
    - "Add .pre-commit-config.yaml with ruff, trailing whitespace, and YAML checks"
  priority_2:
    - "Add Dependabot or Renovate for automated dependency updates"
    - "Create .claude/rules/ with test creation guidelines for backend and frontend"
    - "Add Kustomize build validation in CI (kustomize build k8s/overlays/prod)"
    - "Add container startup smoke test in CI (docker run + curl /healthz)"
---

# Quality Analysis: observatory

## Executive Summary

- **Overall Score: 3.4/10**
- **Repository**: [opendatahub-io/observatory](https://github.com/opendatahub-io/observatory)
- **Jira**: RHOAIENG / CI/CD (midstream tier)
- **Type**: Web application (FastAPI backend + React frontend, SQLite, single container)
- **Languages**: Python (155 files), TypeScript (38 files)
- **Key Strengths**: Solid backend test suite (34 test files, 9,017 lines), real-database testing pattern, well-structured AGENTS.md, multi-stage Dockerfile with health checks
- **Critical Gaps**: **Zero CI/CD automation** — no GitHub Actions, GitLab CI, or any automated pipeline. No coverage tracking, no PR-time build validation, minimal static analysis configuration
- **Agent Rules Status**: Present — AGENTS.md with coding standards + 3 Claude skills with tests; missing .claude/rules/

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 7.0/10 | 15% | 1.05 | Strong backend test suite with pytest + httpx AsyncClient; weak frontend coverage |
| Integration/E2E | 4.0/10 | 20% | 0.80 | API-level integration tests exist but no browser E2E or multi-version testing |
| Build Integration | 2.0/10 | 15% | 0.30 | No CI workflows; Makefile build targets are local-only |
| Image Testing | 5.0/10 | 10% | 0.50 | Good Dockerfile with multi-stage build and health checks; no runtime validation |
| Coverage Tracking | 1.0/10 | 10% | 0.10 | No coverage tooling, thresholds, or PR reporting configured |
| CI/CD Automation | 0.0/10 | 15% | 0.00 | No CI/CD workflows at all |
| Static Analysis | 3.0/10 | 10% | 0.30 | Minimal ruff config; no pre-commit hooks, no Dependabot/Renovate |
| Agent Rules | 7.0/10 | 5% | 0.35 | AGENTS.md + 3 custom Claude skills with their own test suites |
| **Overall** | **3.4/10** | **100%** | **3.40** | |

## Critical Gaps

### 1. No CI/CD Pipeline Exists
- **Severity**: HIGH
- **Impact**: Tests, linting, and builds never run automatically. Regressions, broken imports, and failing tests reach production unchecked. The Makefile `test` and `lint` targets exist but only run when a developer remembers to invoke them locally.
- **Effort**: 8-16 hours
- **Evidence**: No `.github/workflows/`, no `.gitlab-ci.yml`, no `Jenkinsfile` found in the repository. All quality gates depend on manual developer discipline.

### 2. No Code Coverage Tracking
- **Severity**: HIGH
- **Impact**: Cannot measure test coverage, set coverage thresholds, or enforce coverage gates on PRs. Coverage blind spots accumulate silently as the codebase grows (currently 15,942 lines of backend source code).
- **Effort**: 2-4 hours
- **Evidence**: No `.codecov.yml`, no `pytest-cov` in dependencies, no `--coverage` flags anywhere, no coverage thresholds configured.

### 3. No PR-Time Build Validation
- **Severity**: HIGH
- **Impact**: The multi-stage Dockerfile and Kustomize overlays are never validated automatically. Image build failures and K8s manifest errors are discovered only after manual testing or production deployment.
- **Effort**: 4-8 hours
- **Evidence**: Dockerfile exists with proper multi-stage build, `k8s/base/` and `k8s/overlays/prod/` have Kustomize manifests, but no CI step validates any of them.

### 4. No Browser-Based E2E Tests
- **Severity**: MEDIUM
- **Impact**: The React frontend has 30+ components and pages across 12,128 lines of TypeScript, but only 4 test files (401 lines). Critical user flows like the Chat interface, StatusBoard, pipeline management, SBOM viewer, and vulnerability dashboard have zero test coverage.
- **Effort**: 16-24 hours
- **Evidence**: `src/frontend/src/pages/` has 15 page components; only `Hallucinations.test.tsx`, `ClaimAssurance.test.tsx` are tested. No Playwright or Cypress configuration.

### 5. Non-UBI Base Images
- **Severity**: MEDIUM
- **Impact**: The Dockerfile uses `node:20-alpine` (build stage) and `python:3.11-slim` (runtime). Neither is FIPS-capable. This blocks FIPS certification requirements if observatory needs to run in regulated environments.
- **Effort**: 4-8 hours
- **Evidence**: `FROM node:20-alpine AS frontend-build` and `FROM python:3.11-slim AS runtime` in `Dockerfile`.

## Quick Wins

### 1. Add GitHub Actions CI Workflow (2-4 hours)
Create `.github/workflows/ci.yml` with test, lint, and build jobs:

```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: uv sync --dev
      - run: uv run pytest --tb=short
      - run: uv run ruff check src/

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: src/frontend/package-lock.json
      - run: npm ci --prefix src/frontend
      - run: npm run build --prefix src/frontend
      - run: npm test --prefix src/frontend

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t observatory:test .
```

### 2. Enable pytest-cov and Codecov (1-2 hours)
Add `pytest-cov` to dev dependencies and configure:

```toml
# pyproject.toml additions
[project.optional-dependencies]
dev = [
    "pytest-cov>=5.0.0",
    # ... existing deps
]

[tool.pytest.ini_options]
addopts = "--cov=backend --cov-report=term-missing --cov-fail-under=60"
```

### 3. Add Dependabot Configuration (30 minutes)
Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: pip
    directory: /
    schedule:
      interval: weekly
  - package-ecosystem: npm
    directory: /src/frontend
    schedule:
      interval: weekly
  - package-ecosystem: docker
    directory: /
    schedule:
      interval: weekly
```

### 4. Add Pre-Commit Hooks (1 hour)
Create `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
```

### 5. Expand Ruff Config (1 hour)
The current ruff config only sets `target-version` and `line-length`. Add recommended rules:

```toml
[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM", "RUF"]
```

## Detailed Findings

### Unit Tests

**Score: 7.0/10**

**Backend (Strong):**
- 34 test files in `src/tests/` with 9,017 lines of test code
- Framework: pytest + pytest-asyncio + httpx AsyncClient
- Test-to-code ratio: 0.57 (9,017 test lines / 15,942 source lines)
- Real SQLite testing pattern — `conftest.py` creates a temp database per test, no mocks
- Excellent coverage of API endpoints: pipelines, runs, auth, API keys, credentials, collectors (GitHub + GitLab), OTLP ingestion, MLflow, manifests, claim assurance, claim consolidation, artifacts, admin, logs, retention, provenance, SBOMs, telemetry, chat, seed, pipeline metadata, health status, job filter, org pulse, OTel parser
- Good test isolation with fixture-based setup/teardown

**Frontend (Weak):**
- Only 4 test files out of ~30 components/pages (401 lines)
- Framework: vitest + React Testing Library + jsdom
- Tested: `Markdown.tsx`, `ClaimConsolidation.tsx`, `ClaimAssurance.tsx`, `Hallucinations.tsx`
- Untested: StatusBoard, PipelineDetail, Chat, Admin, Artifacts, Collector, Provenance, SBOMViewer, TraceExplorer, OtelExplorer, Telemetry, IntelligenceSettings, KnowledgeBase, VulnerabilityDashboard, Sidebar, PipelineCard, HealthDot, ChatMessage, ChatToolCall, ChatActivity

**Skill Tests:**
- 6 test files in `.claude/skills/` covering extract-claims, verify-claims, and explain-claims skill validation

**Key Files:**
- `src/tests/conftest.py` — test fixtures with real SQLite
- `pyproject.toml` — pytest config with asyncio_mode = "auto"
- `src/frontend/package.json` — vitest configuration

### Integration/E2E Tests

**Score: 4.0/10**

- No dedicated `e2e/` or `integration/` directory
- The pytest test suite effectively functions as API integration tests (full FastAPI + SQLite stack via AsyncClient), which is a strength
- No browser-based E2E testing (no Playwright, Cypress, or Selenium)
- No multi-version testing or matrix strategies
- No cluster setup testing (Kind, Minikube, envtest)
- No Testcontainers usage
- `compose.yaml` exists but is for development only, not CI-driven integration testing
- The API-level integration tests are solid but don't validate the frontend-to-backend integration path

### Build Integration

**Score: 2.0/10**

- **No CI workflows exist** — this is the single biggest quality gap
- Makefile provides `test`, `lint`, `dev`, `build`, `seed` targets but all are local-only
- Dockerfile has a well-structured multi-stage build (node:20-alpine → python:3.11-slim)
- Kustomize overlays exist (`k8s/base/`, `k8s/overlays/prod/`) but are never validated
- No PR-time Docker build validation
- No Konflux simulation
- No `kustomize build` validation in any pipeline
- No `kubectl apply --dry-run` validation
- compose.yaml only maps port 8000, no test services

### Image Testing

**Score: 5.0/10**

**Strengths:**
- Multi-stage Dockerfile (frontend build → runtime)
- `HEALTHCHECK` directive with proper intervals (30s interval, 5s timeout, 10s start-period)
- K8s deployment has both liveness and readiness probes (`/healthz`)
- `.dockerignore` properly excludes tests, docs, .git, .venv, node_modules
- Non-root user (UID 1000) for security
- Resource limits defined (256Mi-512Mi memory, 100m-500m CPU)

**Gaps:**
- No runtime image validation (no Testcontainers, no `docker run` + smoke test)
- No multi-architecture support (no `--platform`, no `docker buildx`)
- Base images not UBI-based — `python:3.11-slim` and `node:20-alpine` are not FIPS-capable
- No image startup testing in any pipeline

### Coverage Tracking

**Score: 1.0/10**

- No `.codecov.yml` or `codecov.yml`
- No `pytest-cov` in dependencies (`pyproject.toml` dev dependencies only include pytest, pytest-asyncio, httpx, ruff, honcho)
- No `--coverprofile` or `--coverage` flags anywhere
- No coverage thresholds configured
- No PR coverage reporting
- No frontend coverage configuration (vitest supports coverage but not configured)

### CI/CD Automation

**Score: 0.0/10**

- **No GitHub Actions workflows** (`.github/workflows/` does not exist)
- No `.gitlab-ci.yml`
- No `Jenkinsfile`
- No `Taskfile.yml`
- Makefile exists but is local-only — no CI integration
- No concurrency control, caching strategies, or test parallelization
- No PR-triggered automation of any kind
- No scheduled/periodic jobs

### Static Analysis

**Score: 3.0/10**

**Linting:**
- Ruff configured in `pyproject.toml` with minimal settings (only `target-version = "py311"` and `line-length = 120`)
- No rule selection — uses ruff defaults only
- No ruff format configuration
- Frontend `package.json` has a `lint` script but no ESLint configuration file found
- No `.eslintrc.*` or `eslint.config.*` in the frontend directory

**FIPS Compatibility:**
- Uses `hashlib.sha256` (FIPS-compliant) for API key hashing and claim deduplication
- `cryptography>=43.0.0` dependency present (supports FIPS mode)
- No non-compliant crypto imports (`crypto/md5`, `crypto/des`, `crypto/rc4` — not applicable to Python)
- No FIPS build configuration (no UBI base images, no FIPS provider config)
- Base images (`python:3.11-slim`, `node:20-alpine`) are not FIPS-capable

**Dependency Alerts:**
- No `.github/dependabot.yml`
- No `renovate.json` or `.renovaterc`
- No automated dependency update mechanism

**Pre-commit Hooks:**
- No `.pre-commit-config.yaml`
- No hook enforcement

### Agent Rules

**Score: 7.0/10**

**AGENTS.md (Strong):**
- Comprehensive coding standards for backend (Python/FastAPI) and frontend (React/TypeScript)
- Explicit testing requirements: "Every API endpoint must have at least one happy-path test"
- "Database operations must be tested against a real SQLite instance (no mocks)"
- "Frontend components with logic must have tests"
- Well-defined workflow with task management
- Repository conventions documented (ADRs, plans, tasks, bugs)

**Claude Skills (Strong):**
- 3 custom skills: `explain-claims`, `extract-claims`, `verify-claims`
- Each skill has its own `SKILL.md` with proper frontmatter
- Skills include their own test suites (6 test files total)
- Skills are domain-specific and actionable

**Gaps:**
- No `.claude/rules/` directory with test creation rules
- No rule files for unit test patterns, E2E test patterns, or integration test patterns
- Missing framework-specific test examples (pytest patterns, vitest patterns)
- No quality gate checklists

## Recommendations

### Priority 0 (Critical)

1. **Create GitHub Actions CI pipeline** — This is the single most impactful improvement. Without CI, every other quality practice depends on manual discipline. Start with test, lint, and Docker build jobs triggered on PR and push to main.

2. **Add pytest-cov with coverage thresholds** — Add `pytest-cov>=5.0.0` to dev dependencies, configure `--cov-fail-under=60` as a starting threshold, and integrate with Codecov for PR-level reporting.

3. **Add Codecov integration** — Once CI exists and pytest-cov generates coverage data, add `codecov/codecov-action` to the workflow for automated coverage reporting and enforcement on PRs.

### Priority 1 (High Value)

4. **Add browser E2E testing** — Install Playwright, create tests for critical user flows (StatusBoard, Chat, Pipeline management). Target the 15 untested page components. Start with smoke tests for each page route.

5. **Switch to UBI base images** — Replace `python:3.11-slim` with `registry.access.redhat.com/ubi9/python-311` and `node:20-alpine` with a UBI-based Node.js image for FIPS capability.

6. **Add PR-time Docker build validation** — Include `docker build -t observatory:test .` in CI to catch Dockerfile breakage before merge. Optionally add `docker run` + `curl /healthz` smoke test.

7. **Add pre-commit hooks** — Create `.pre-commit-config.yaml` with ruff linting/formatting, trailing whitespace, YAML validation, and large file checks.

### Priority 2 (Nice-to-Have)

8. **Add Dependabot** — Create `.github/dependabot.yml` covering pip, npm, and Docker ecosystems for automated dependency updates and security alerts.

9. **Create .claude/rules/ directory** — Add test creation rules for pytest patterns (async fixtures, real DB testing), vitest patterns (React Testing Library), and API test patterns specific to this codebase.

10. **Add Kustomize validation in CI** — Run `kustomize build k8s/overlays/prod` in CI to catch manifest errors.

11. **Add container startup smoke test** — After Docker build in CI, run `docker run -d` + `curl /healthz` to validate the image starts correctly.

12. **Expand ruff configuration** — Add rule selections (`select = ["E", "F", "I", "UP", "B", "SIM", "RUF"]`) and consider enabling ruff format.

## Comparison to Gold Standards

| Practice | observatory | odh-dashboard | notebooks | kserve |
|----------|------------|---------------|-----------|--------|
| CI/CD Pipeline | None | Comprehensive GitHub Actions | Multi-workflow | Extensive |
| Unit Tests | Strong backend (34 files) | Multi-layer (Jest + Cypress) | Per-image tests | Go testing + envtest |
| Integration/E2E | API-level only | Cypress E2E + Contract tests | Image validation suite | Multi-version matrix |
| Coverage | None | Codecov with thresholds | Coverage reporting | Codecov enforcement |
| Build Validation | Local Makefile only | PR Docker builds | 5-layer image validation | PR build + deploy test |
| Image Testing | Good Dockerfile, no validation | Multi-arch, runtime tests | Testcontainers, 5-layer | Kind cluster testing |
| Static Analysis | Minimal ruff | ESLint + Prettier + comprehensive | FIPS checks + linting | golangci-lint, 20+ linters |
| Dependency Alerts | None | Dependabot configured | Dependabot + Renovate | Dependabot |
| Agent Rules | AGENTS.md + 3 skills | Comprehensive .claude/rules/ | Basic CLAUDE.md | None |
| FIPS Readiness | Not FIPS-capable (alpine/slim base) | UBI-based images | FIPS build tags | FIPS-compatible |

## File Paths Reference

| Category | Path | Status |
|----------|------|--------|
| Makefile | `Makefile` | Present — local test/lint/build targets |
| Dockerfile | `Dockerfile` | Present — multi-stage, health check, non-root |
| .dockerignore | `.dockerignore` | Present — properly configured |
| compose.yaml | `compose.yaml` | Present — development only |
| pyproject.toml | `pyproject.toml` | Present — minimal ruff, no coverage |
| K8s manifests | `k8s/base/`, `k8s/overlays/prod/` | Present — Kustomize with probes |
| AGENTS.md | `AGENTS.md` | Present — comprehensive coding standards |
| Claude skills | `.claude/skills/` | Present — 3 skills with tests |
| Backend tests | `src/tests/` | Present — 34 files, 9,017 lines |
| Frontend tests | `src/frontend/src/**/*.test.tsx` | Sparse — 4 files, 401 lines |
| CI workflows | `.github/workflows/` | **MISSING** |
| Coverage config | `.codecov.yml` | **MISSING** |
| Pre-commit | `.pre-commit-config.yaml` | **MISSING** |
| Dependabot | `.github/dependabot.yml` | **MISSING** |
| Claude rules | `.claude/rules/` | **MISSING** |
| ESLint config | `.eslintrc.*` or `eslint.config.*` | **MISSING** |
