---
repository: "opendatahub-io/mlflow"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "~993 Python test files, ~507 JS test files; pytest + Jest; parallelized CI with 4-way splitting"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Playwright E2E on Konflux-built images; docker-compose stack; DB integration tests; multi-version fs2db migration tests"
  - dimension: "Build Integration"
    score: 7.5
    status: "Konflux Tekton pipelines for PR+push; multi-arch builds (amd64/arm64/ppc64le/s390x); E2E waits for Konflux image"
  - dimension: "Image Testing"
    score: 7.0
    status: "Konflux hermetic builds with SBOM (Syft); E2E validates runtime via docker-compose; no standalone image smoke tests"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "No codecov/coveralls integration; no coverage thresholds or PR coverage reports"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "30+ workflows; concurrency control; caching; auto-close PRs; label gating; matrix strategies; Copilot-aware"
  - dimension: "Agent Rules"
    score: 8.0
    status: "Comprehensive CLAUDE.md; .claude/rules/ with Python and GitHub Actions guides; .claude/skills/ with 8 custom skills"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Cannot measure test coverage trends, regressions, or enforce minimum thresholds on PRs"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container security scanning in CI"
    impact: "Vulnerabilities in container images not caught before deployment; relies entirely on Konflux post-build"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No SAST/CodeQL in workflows"
    impact: "No automated static application security testing on PRs or pushes"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No standalone container image smoke test"
    impact: "Image startup/health issues only caught in full E2E suite, not as a fast feedback loop"
    severity: "MEDIUM"
    effort: "3-4 hours"
quick_wins:
  - title: "Add codecov integration to PR workflow"
    effort: "4-6 hours"
    impact: "Immediate visibility into test coverage trends and enforcement on PRs"
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Early detection of CVEs in the built Konflux image before merge"
  - title: "Add CodeQL/SAST workflow"
    effort: "2-3 hours"
    impact: "Automated security bug detection on every PR"
  - title: "Add agent rules for test patterns"
    effort: "2-3 hours"
    impact: "Ensure AI-generated tests follow project conventions for E2E and integration test types"
recommendations:
  priority_0:
    - "Add pytest-cov and codecov integration to master.yml to track and enforce coverage thresholds"
    - "Add container vulnerability scanning (Trivy) as a PR check on the Konflux-built image"
  priority_1:
    - "Add CodeQL or Semgrep SAST scanning workflow for Python and JavaScript"
    - "Create a standalone container health check job that validates image startup before E2E"
    - "Add agent rules for E2E test patterns, integration test patterns, and container testing"
  priority_2:
    - "Add secret detection scanning (Gitleaks/TruffleHog) to PR workflow"
    - "Add performance regression testing for API endpoints"
    - "Consider contract tests between frontend and backend API boundaries"
---

# Quality Analysis: opendatahub-io/mlflow

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Python ML platform with TypeScript/React frontend (fork of mlflow/mlflow)
- **Primary Language**: Python (1,090 source files), TypeScript/JavaScript (507 test files)
- **Key Strengths**: Massive test suite (993 Python + 507 JS test files), sophisticated CI/CD with 30+ workflows, Konflux integration with multi-arch builds, comprehensive agent rules with custom skills, Playwright E2E tests running against real Konflux-built images
- **Critical Gaps**: No coverage tracking/enforcement, no container security scanning in CI, no SAST/CodeQL
- **Agent Rules Status**: Present and comprehensive (CLAUDE.md, 2 rule files, 8 custom skills)

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | ~993 Python test files, ~507 JS test files; pytest + Jest; 4-way parallel splitting |
| Integration/E2E | 8.0/10 | Playwright E2E on Konflux images; docker-compose stack; DB integration; fs2db migration tests |
| **Build Integration** | **7.5/10** | **Konflux Tekton pipelines for PR+push; multi-arch (amd64/arm64/ppc64le/s390x); hermetic builds** |
| Image Testing | 7.0/10 | Konflux hermetic builds with SBOM (Syft); E2E validates runtime; no standalone smoke test |
| Coverage Tracking | 3.0/10 | No codecov/coveralls; no coverage thresholds; no PR coverage reports |
| CI/CD Automation | 9.0/10 | 30+ workflows; concurrency control; caching; auto-close PRs; label gating; Copilot-aware |
| Agent Rules | 8.0/10 | Full CLAUDE.md; .claude/rules/ (Python, GH Actions); .claude/skills/ (8 custom skills) |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: Cannot measure test coverage trends or regressions; no minimum threshold enforcement on PRs; developers cannot see which lines are untested
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Despite having ~993 Python test files and ~507 JS test files, there is no `pytest-cov`, no `.codecov.yml`, no `coveralls` config, and no coverage-related steps in any workflow. The `[tool.coverage]` section in `pyproject.toml` is absent.

### 2. No Container Security Scanning in CI
- **Impact**: Vulnerabilities in container images and dependencies not caught before deployment; fully dependent on Konflux post-build scanning
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Trivy, Snyk, or Grype scanning in any GitHub workflow. The `.syft.yaml` config exists for SBOM generation (used by Konflux), but no vulnerability scanning is performed as a GitHub PR check. The only security-related workflow is `close-security-issues.yml` which just manages issue lifecycle.

### 3. No SAST/CodeQL Integration
- **Impact**: No automated static application security testing; security vulnerabilities in Python and JavaScript code not caught systematically
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: No CodeQL, Semgrep, or gosec workflows found. For a project with 60M+ monthly downloads handling ML model artifacts and credentials, this is a notable gap.

### 4. No Standalone Container Image Smoke Test
- **Impact**: Image startup and health issues only caught during full E2E suite execution, not as a fast feedback loop
- **Severity**: MEDIUM
- **Effort**: 3-4 hours
- **Details**: The E2E workflow does validate the Konflux-built image runtime (via docker-compose), but there is no lightweight standalone test that validates image startup, health endpoint, and basic API responses independent of the full Playwright test suite.

## Quick Wins

### 1. Add Codecov Integration (4-6 hours)
- **Impact**: Immediate visibility into coverage trends, PR coverage diffs, and enforcement
- **Implementation**: Add `pytest-cov` to test-requirements.txt, add `--cov=mlflow --cov-report=xml` to pytest invocations in `master.yml`, add codecov upload step

### 2. Add Trivy Container Scanning (1-2 hours)
- **Impact**: Early CVE detection on every PR before merge
- **Implementation**: Add a Trivy scan step after the Konflux image is built, either in the E2E workflow or as a standalone workflow triggered by Konflux build completion

### 3. Add CodeQL/SAST Workflow (2-3 hours)
- **Impact**: Automated detection of security bugs in Python and JavaScript
- **Implementation**: Add `.github/workflows/codeql.yml` with Python and JavaScript analysis

### 4. Add E2E/Integration Test Agent Rules (2-3 hours)
- **Impact**: Ensure AI-generated tests follow project-specific patterns for Playwright E2E, docker-compose integration, and DB tests
- **Implementation**: Create `.claude/rules/e2e-tests.md` and `.claude/rules/integration-tests.md` with Playwright patterns and docker-compose conventions

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory** (30+ workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `master.yml` | PR + push | Main Python test suite (4-way split, 120min timeout) |
| `tracing.yml` | PR + push | Tracing SDK tests (core + OTLP) |
| `js.yml` | PR + push (JS paths) | Frontend Jest tests, lint, type-check, build |
| `e2e.yml` | After JS workflow | Playwright E2E on Konflux-built image |
| `lint.yml` | PR + push | Pre-commit hooks (ruff, mypy, clint, typos, etc.) |
| `slow-tests.yml` | Daily + dispatch | Docker build tests (120min) |
| `fs2db.yml` | PR + push | Database migration tests (multi-version) |
| `examples.yml` | PR + push | Example notebook tests |
| `build-and-push-dev-image.yml` | PR + push | Dev Docker image builds |
| `gateway-benchmark.yml` | Dispatch | Gateway performance benchmarks |
| Various automation | PR events | Auto-close, stale PRs, labeling, size checks |

**Strengths**:
- Excellent concurrency control (`cancel-in-progress: true` on all workflows)
- Matrix strategies for parallel test execution (4-way split for Python tests)
- Path-based filtering to avoid unnecessary runs
- Copilot bot awareness (skips draft PRs except for Copilot)
- Action pin verification via pre-commit (`check_action_pins.py`)
- OPA/Conftest policy enforcement on workflow files
- Comprehensive reusable actions (`.github/actions/`)

**Weaknesses**:
- No coverage collection or reporting in any workflow
- No security scanning workflows
- Slow tests only run daily (not on PR for most changes)

### Test Coverage

**Python Tests** (~993 test files):
- Framework: pytest with extensive configuration in `pyproject.toml`
- Parallelization: 4-way split via `pytest-split`
- Timeout: 1200s per test
- Coverage areas: tracking, tracing, models, deployments, CLI, server, utils, 20+ ML framework integrations (OpenAI, Anthropic, LangChain, transformers, etc.)
- Integration tests: Database tests (PostgreSQL, MySQL, MSSQL via docker-compose), async logging
- Docker tests: Separate slow test suite for container builds

**JavaScript/TypeScript Tests** (~507 test files):
- Framework: Jest (unit/component tests), Playwright (E2E)
- Unit tests: 507 test files in `mlflow/server/js/src/`
- E2E tests: 3 Playwright spec files (prompt versioning, GenAI observability, experiment lifecycle)
- CI: 2-way matrix split on test path patterns

**TypeScript SDK Tests** (libs/typescript/):
- Integration tests for Claude Code, OpenAI, Anthropic, Gemini, Codex integrations
- Core library tests

**Test-to-Code Ratio**: ~0.91 (993 Python test files / 1,090 source files) - excellent

### Code Quality

**Linting** (Excellent):
- Ruff: Python linting and formatting with auto-fix
- Clint: Custom MLflow-specific linter
- mypy: Static type checking on dev/ and .claude/skills/
- ty: Unresolved import detection
- taplo: TOML formatting
- buf: Protocol buffer formatting
- Prettier: JS/TS/MD/YAML formatting
- ESLint: JS/TS linting (via `yarn lint`)
- typos: Spelling checker
- Conftest/Regal: OPA policy enforcement on workflows

**Pre-commit Hooks** (Comprehensive - 25+ hooks):
- Trailing whitespace, end-of-file fixer
- VCS permalink validation
- Ruff, format, mypy, clint
- uv-lock consistency
- Action pin verification
- Component ID registry
- Proto linting and formatting
- JS formatting
- No-spaces-in-filenames
- DCO sign-off enforcement
- MLflow-specific typo checking

**Static Analysis**:
- mypy configured for dev scripts
- ty for import resolution
- No SAST tools (CodeQL, Semgrep, gosec) - gap

### Container Images

**Dockerfile.konflux** (Production):
- Multi-stage build (3 stages: UI builder, Python builder, runtime)
- Base: UBI9 (Red Hat Universal Base Image)
- Multi-arch: amd64, arm64, ppc64le, s390x
- Hermetic builds with `--require-hashes` and `--no-deps`
- Minimal runtime image (`ubi-minimal`)
- Non-root user (1001)
- SBOM generation via Syft (`.syft.yaml` configured)
- Proper health check endpoint

**Tekton Pipelines** (`.tekton/`):
- `mlflow-pull-request.yaml`: PR builds with hermetic prefetch (pip, yarn, rpm)
- `mlflow-push.yaml`: Push builds with stable/latest tags
- References centralized pipeline from `odh-konflux-central`
- Extra memory allocation for prefetch (6Gi)

**Docker Compose** (Development/E2E):
- PostgreSQL 15 backend
- RustFS (S3-compatible) artifact storage
- Health checks on all services
- Configurable via `.env` files

**Gaps**:
- No Trivy/Snyk scanning in GitHub workflows
- No standalone image smoke test (only full E2E validates runtime)
- No image signing/attestation in GitHub workflows (may be handled by Konflux)

### Security

**Present**:
- SECURITY.md with vulnerability reporting process (GitHub private advisories)
- DCO sign-off enforcement
- Action pin verification (SHA-pinned actions)
- Hermetic Konflux builds with hash verification
- `.syft.yaml` for SBOM generation
- Non-root container user
- Input validation in E2E workflow (sanitizing image tag)

**Missing**:
- No SAST/CodeQL workflow
- No Trivy/Snyk container scanning in GitHub CI
- No Gitleaks/TruffleHog secret detection
- No dependency scanning (Dependabot/Renovate) visible in workflows
- No image signing/attestation in GitHub workflows

### Agent Rules (Agentic Flow Quality)

**Status**: Present and comprehensive

**CLAUDE.md** (7,152 bytes):
- Repository overview and quick start
- Development server setup (local + Databricks backend)
- Testing commands (pytest, uv, extras)
- Code quality commands (ruff, clint, typo checking)
- Git workflow with DCO sign-off requirements
- Pre-commit hook installation and usage
- UI development reference (links to JS CLAUDE.md)
- Code style principles (imports, docstrings, comments, workspace-aware patterns)

**Rules** (`.claude/rules/`):
- `python.md` (8,096 bytes): Comprehensive Python style guide covering docstrings, Literal types, try-catch scope, dataclasses, pathlib, subprocess, pattern matching, mock best practices, parametrized tests, decorator typing
- `github-actions.md` (956 bytes): ubuntu-slim preference, gh CLI over actions/github-script

**Skills** (`.claude/skills/`):
- 8 custom skills: add-review-comment, analyze-ci, copilot, fetch-diff, fetch-unresolved-comments, pr-review, resolve, src
- `pyproject.toml` and `README.md` for skills infrastructure

**Gaps**:
- No E2E test creation rules (Playwright patterns, docker-compose setup)
- No integration test rules
- No container/image testing rules
- No coverage/quality gate rules

## Recommendations

### Priority 0 (Critical)

1. **Add pytest-cov and codecov integration**
   - Add `pytest-cov` to `requirements/test-requirements.txt`
   - Add `--cov=mlflow --cov-report=xml` to pytest commands in `master.yml`
   - Add codecov upload step after tests
   - Create `.codecov.yml` with minimum coverage thresholds
   - Effort: 4-6 hours

2. **Add container vulnerability scanning**
   - Add Trivy scan step in E2E workflow after Konflux image pull
   - Or create standalone workflow triggered by Konflux build completion
   - Set severity thresholds (CRITICAL, HIGH)
   - Effort: 2-4 hours

### Priority 1 (High Value)

3. **Add CodeQL/SAST workflow**
   - Create `.github/workflows/codeql.yml`
   - Enable Python and JavaScript analysis
   - Run on PR and push to master
   - Effort: 2-3 hours

4. **Add standalone container health check job**
   - Create lightweight job that pulls Konflux image, starts it, validates health endpoint
   - Faster feedback than full E2E suite
   - Effort: 3-4 hours

5. **Expand agent rules for testing**
   - Create `.claude/rules/e2e-tests.md` with Playwright patterns, fixture usage, docker-compose setup
   - Create `.claude/rules/integration-tests.md` with DB test patterns
   - Effort: 2-3 hours

### Priority 2 (Nice-to-Have)

6. **Add secret detection scanning**
   - Add Gitleaks or TruffleHog to pre-commit or CI
   - Effort: 1-2 hours

7. **Add performance regression testing**
   - Extend gateway-benchmark workflow to run on PR
   - Track API endpoint latency over time
   - Effort: 8-12 hours

8. **Add contract tests for frontend/backend**
   - Define API contracts between React frontend and Python backend
   - Validate contracts on both sides
   - Effort: 12-16 hours

## Comparison to Gold Standards

| Dimension | mlflow (this) | odh-dashboard | notebooks | kserve |
|-----------|--------------|---------------|-----------|--------|
| Unit Tests | 8.5 | 9.0 | 7.0 | 8.5 |
| Integration/E2E | 8.0 | 9.0 | 8.0 | 9.0 |
| Build Integration | 7.5 | 8.0 | 7.0 | 7.0 |
| Image Testing | 7.0 | 7.0 | 9.0 | 6.0 |
| Coverage Tracking | 3.0 | 8.0 | 5.0 | 9.0 |
| CI/CD Automation | 9.0 | 9.0 | 8.0 | 8.5 |
| Agent Rules | 8.0 | 9.0 | 3.0 | 2.0 |
| **Overall** | **7.6** | **8.7** | **6.7** | **7.4** |

**Key Differentiators**:
- mlflow's test volume (1,500+ test files across Python/JS) is exceptional
- Konflux multi-arch build integration is mature (4 architectures)
- Agent rules are well-developed with 8 custom skills
- Main gap vs. gold standards is coverage tracking (3.0 vs. 8.0+ for leaders)
- E2E tests validating against real Konflux-built images is a strong pattern

## File Paths Reference

### CI/CD
- `.github/workflows/master.yml` - Main Python test suite
- `.github/workflows/js.yml` - Frontend tests
- `.github/workflows/e2e.yml` - Playwright E2E tests
- `.github/workflows/lint.yml` - Linting and pre-commit
- `.github/workflows/tracing.yml` - Tracing SDK tests
- `.github/workflows/slow-tests.yml` - Docker build tests (daily)
- `.github/workflows/fs2db.yml` - DB migration tests
- `.tekton/mlflow-pull-request.yaml` - Konflux PR pipeline
- `.tekton/mlflow-push.yaml` - Konflux push pipeline

### Testing
- `tests/` - 993 Python test files across 80+ subdirectories
- `mlflow/server/js/src/` - 507 JS/TS test files
- `mlflow/server/js/e2e/` - 3 Playwright E2E specs
- `tests/integration/` - Integration tests
- `tests/docker/` - Docker build tests

### Code Quality
- `.pre-commit-config.yaml` - 25+ pre-commit hooks
- `pyproject.toml` - pytest config, ruff settings
- `dev/clint/` - Custom MLflow linter

### Container Images
- `Dockerfile.konflux` - Production multi-stage build
- `docker-compose/docker-compose.yml` - E2E test stack
- `.syft.yaml` - SBOM generation config
- `docker/` - Development Dockerfiles

### Agent Rules
- `CLAUDE.md` - Main agent configuration
- `.claude/rules/python.md` - Python coding standards
- `.claude/rules/github-actions.md` - GH Actions guidelines
- `.claude/skills/` - 8 custom skills
