---
repository: "opendatahub-io/gpt-researcher"
overall_score: 3.4
scorecard:
  - dimension: "Unit Tests"
    score: 3.0
    status: "13 test files exist but most require live API keys; only 2 use proper mocking"
  - dimension: "Integration/E2E"
    score: 2.0
    status: "No automated integration or E2E tests; docker-compose test profile runs only 2 files"
  - dimension: "Build Integration"
    score: 1.0
    status: "No PR-triggered CI at all; build only runs on push to master"
  - dimension: "Image Testing"
    score: 2.0
    status: "Multi-stage Dockerfile present but no image validation, scanning, or startup testing"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tool, no codecov integration, no thresholds"
  - dimension: "CI/CD Automation"
    score: 3.0
    status: "3 workflows exist but none run on PRs; tests are dispatch-only"
  - dimension: "Agent Rules"
    score: 5.0
    status: "Claude SKILL.md with architecture references exists; no test rules or .claude/rules/"
critical_gaps:
  - title: "No CI runs on pull requests"
    impact: "Bugs, regressions, and breaking changes are not caught before merge"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No test coverage tracking"
    impact: "No visibility into what code is tested; coverage can silently regress"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Tests require live API keys to run"
    impact: "Tests cannot run in CI without expensive secrets; no offline test suite"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No container image security scanning"
    impact: "Vulnerable dependencies in images go undetected until production"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No linting or static analysis in CI"
    impact: "Code quality regressions not caught; no type checking enforcement"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No pre-commit hooks"
    impact: "Developers can commit code that violates standards without warning"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add PR-triggered lint + type-check workflow"
    effort: "2-3 hours"
    impact: "Catch syntax errors, type issues, and style violations before merge"
  - title: "Add Trivy container scanning to build workflow"
    effort: "1-2 hours"
    impact: "Detect known CVEs in container images before deployment"
  - title: "Add pytest coverage reporting with codecov"
    effort: "2-3 hours"
    impact: "Visibility into test coverage; set baseline for improvement"
  - title: "Add pre-commit hooks (ruff, mypy, prettier)"
    effort: "1-2 hours"
    impact: "Enforce code quality locally before push"
  - title: "Create unit test rules in .claude/rules/"
    effort: "2-3 hours"
    impact: "Guide AI-assisted test generation for consistent, high-quality tests"
recommendations:
  priority_0:
    - "Create PR-triggered CI workflow running linting, type checking, and unit tests"
    - "Add pytest coverage with codecov and set minimum threshold (e.g., 50% to start)"
    - "Refactor tests to use mocks/fixtures instead of requiring live API keys"
  priority_1:
    - "Add Trivy or Snyk container scanning to build pipeline"
    - "Create comprehensive integration test suite using docker-compose"
    - "Add pre-commit hooks with ruff, mypy, and prettier"
    - "Create .claude/rules/ with unit-test, integration-test, and security-test patterns"
  priority_2:
    - "Add CodeQL or Semgrep SAST scanning"
    - "Implement Gitleaks secret detection"
    - "Add multi-architecture Docker builds"
    - "Create performance regression tests for research pipelines"
    - "Add frontend test infrastructure (Jest/Vitest for Next.js)"
---

# Quality Analysis: opendatahub-io/gpt-researcher

## Executive Summary

- **Overall Score: 3.4/10**
- **Repository Type**: Python AI agent application (LLM-based research agent) with Next.js frontend
- **Primary Language**: Python (188 files), TypeScript/JavaScript (91 files)
- **Framework**: FastAPI backend, Next.js frontend, LangChain/LangGraph orchestration

### Key Strengths
- Mature eval framework with hallucination detection and SimpleQA benchmarks
- Claude Code SKILL.md with comprehensive architecture references
- Multi-stage Dockerfile with non-root user security pattern
- Docker Compose setup for local development and testing

### Critical Gaps
- **No CI runs on pull requests** - all workflows are push-to-master or manual dispatch only
- **No test coverage tracking** - zero coverage tooling or enforcement
- **Most tests require live API keys** - cannot run offline or in standard CI
- **No container security scanning** - no Trivy, Snyk, or CodeQL integration
- **No linting in CI** - no ruff, mypy, or eslint enforcement

### Agent Rules Status: **Partial**
- `.claude/SKILL.md` exists with architecture docs and references
- No `.claude/rules/` directory for test automation guidance
- No `CLAUDE.md` at repo root

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 3/10 | 13 test files exist but most require live API keys; only 2 use proper mocking |
| Integration/E2E | 2/10 | No automated integration or E2E tests; docker-compose test profile runs only 2 files |
| **Build Integration** | **1/10** | **No PR-triggered CI at all; build only runs on push to master** |
| Image Testing | 2/10 | Multi-stage Dockerfile present but no image validation, scanning, or startup testing |
| Coverage Tracking | 0/10 | No coverage tool, no codecov integration, no thresholds |
| CI/CD Automation | 3/10 | 3 workflows exist but none run on PRs; tests are dispatch-only |
| Agent Rules | 5/10 | Claude SKILL.md with architecture references exists; no test rules |

## Critical Gaps

### 1. No CI Runs on Pull Requests
- **Impact**: Bugs, regressions, and breaking changes are never caught before merge. All quality gates are post-merge or manual.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The `build.yml` workflow only triggers on `push` to `master`. The `docker-build.yml` (test runner) has PR triggers **commented out** and is `workflow_dispatch` only. The `deploy.yml` runs Terraform on push/PR for terraform paths only. There is zero automated validation of application code changes before merge.

### 2. No Test Coverage Tracking
- **Impact**: No visibility into what percentage of code is tested. Coverage can silently regress to near-zero with no one noticing.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No `.codecov.yml`, no `.coveragerc`, no `--cov` flags in pytest configuration. The `pyproject.toml` has `[tool.pytest.ini_options]` but no coverage plugins.

### 3. Tests Require Live API Keys
- **Impact**: Tests cannot run in a standard CI environment without provisioning expensive API keys (OpenAI, Tavily, LangChain). This makes automated testing impractical and expensive.
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Details**: Of 13 test files, only `test_security_fix.py` and `test_logging.py` can run without external API access. The remaining tests (`test_mcp.py`, `test_quick_search.py`, `test_researcher_logging.py`, `research_test.py`, etc.) all require live LLM and search API keys. `test_quick_search.py` demonstrates proper mocking patterns but is the exception, not the rule.

### 4. No Container Image Security Scanning
- **Impact**: Known CVEs in base images and dependencies ship to production undetected.
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: The Dockerfile uses `python:3.12-slim-bookworm` and installs Chromium, Firefox, and numerous Python packages. No Trivy, Snyk, or Grype scanning is configured. No `.trivyignore` exists.

### 5. No Linting or Static Analysis in CI
- **Impact**: Code style violations, unused imports, type errors, and potential bugs are not caught automatically.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: No `ruff.toml`, `mypy.ini`, or `.flake8` configuration at the repo root. The frontend has `.eslintrc.json` but no CI step runs it. No Python type checking is enforced anywhere.

### 6. No Pre-commit Hooks
- **Impact**: Developers can commit and push code that violates quality standards without any local warning.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: No `.pre-commit-config.yaml` exists.

## Quick Wins

### 1. Add PR-Triggered Lint + Type-Check Workflow (2-3 hours)
Create `.github/workflows/ci.yml`:
```yaml
name: CI
on:
  pull_request:
    branches: [master]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install ruff mypy
      - run: ruff check .
      - run: ruff format --check .
```

### 2. Add Trivy Container Scanning (1-2 hours)
Add to `build.yml` after the Docker build step:
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ steps.login-ecr.outputs.registry }}/${{ steps.extract_short_name_repo.outputs.REPO_NAME }}:${{ steps.image-tag.outputs.tag }}
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
```

### 3. Add Pytest Coverage with Codecov (2-3 hours)
Add to `pyproject.toml`:
```toml
[tool.pytest.ini_options]
addopts = "-v --cov=gpt_researcher --cov=backend --cov-report=xml"
```
Then add codecov upload to the CI workflow.

### 4. Add Pre-commit Hooks (1-2 hours)
Create `.pre-commit-config.yaml`:
```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.5.0
    hooks:
      - id: ruff
      - id: ruff-format
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
```

### 5. Create Unit Test Rules in `.claude/rules/` (2-3 hours)
Generate test automation rules using `/test-rules-generator` to ensure AI-assisted test generation follows consistent patterns for mocking, fixtures, and assertion styles.

## Detailed Findings

### CI/CD Pipeline

**Workflows Found**: 3

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build.yml` | push to master | Build Docker image, push to ECR, trigger deploy |
| `deploy.yml` | push to master (terraform/), workflow_dispatch | Terraform plan/apply to ECS |
| `docker-build.yml` | workflow_dispatch only (PR trigger commented out) | Run tests via docker-compose |

**Key Issues**:
- **No PR gates**: All workflows run post-merge or manually. PRs merge without any automated validation.
- **Test workflow disabled**: `docker-build.yml` has `pull_request` trigger commented out. Tests only run via manual `workflow_dispatch`.
- **No concurrency control**: The `build.yml` workflow has no concurrency group, so parallel pushes could race.
- **No caching**: No pip cache, no Docker layer cache in workflows.
- **Build-deploy coupling**: Build workflow directly triggers deploy via API call, with no approval gate.

### Test Coverage

**Test Files**: 13 Python files in `tests/` (1,557 total lines)

| Test File | Lines | Needs API Keys | Uses Mocks | Framework |
|-----------|-------|----------------|------------|-----------|
| `test_security_fix.py` | 351 | No | Yes | pytest |
| `test_mcp.py` | 268 | Yes | No | Script (not pytest) |
| `test_logging.py` | 60 | No | Yes (AsyncMock) | pytest |
| `test_logging_output.py` | 62 | Yes | Partial | pytest |
| `test_researcher_logging.py` | 70 | Yes | No | pytest |
| `test_quick_search.py` | 46 | No* | Yes (full mock) | unittest |
| `test_logs.py` | 47 | No | No | Script |
| `research_test.py` | 110 | Yes | No | Script |
| `vector-store.py` | 236 | Yes | No | pytest |
| `report-types.py` | 47 | Yes | No | pytest |
| `test-loaders.py` | 16 | Yes | No | Script |
| `test-your-llm.py` | 23 | Yes | No | Script |
| `test-your-embeddings.py` | 55 | Yes | No | Script |

**Test-to-Code Ratio**: ~1,557 test lines / ~10,000+ source lines = **~15%** (very low)

**Eval Framework**: The `evals/` directory contains:
- `simple_evals/`: SimpleQA evaluation with 100-problem benchmark
- `hallucination_eval/`: Hallucination detection using the `judges` library
- These are research quality evals, not software quality tests

**Docker Compose Test Profile**: Runs only `report-types.py` and `vector-store.py` via `docker-compose --profile test`.

### Code Quality

**Linting**: 
- No Python linter configured (no ruff, flake8, pylint)
- Frontend has `.eslintrc.json` but no CI enforcement
- No type checking (no mypy, pyright, or pytype)

**Formatting**:
- No formatter configured (no black, ruff format)
- Inconsistent naming in test files (mix of `test_name.py` and `test-name.py`)

**Pre-commit Hooks**: None

**Static Analysis**: None (no CodeQL, Semgrep, Bandit, or gosec)

### Container Images

**Dockerfiles Found**: 7

| File | Purpose | Multi-stage | Non-root |
|------|---------|-------------|----------|
| `Dockerfile` | Main backend | Yes (3-stage) | Yes |
| `Dockerfile.fullstack` | Full app | Unknown | Unknown |
| `backend/Dockerfile` | Backend only | Unknown | Unknown |
| `frontend/nextjs/Dockerfile` | Production frontend | Unknown | Unknown |
| `frontend/nextjs/Dockerfile.dev` | Dev frontend | Unknown | Unknown |
| `docs/discord-bot/Dockerfile` | Discord bot | Unknown | Unknown |
| `docs/discord-bot/Dockerfile.dev` | Dev Discord bot | Unknown | Unknown |

**Strengths**:
- Main Dockerfile uses 3-stage build pattern
- Non-root user (`gpt-researcher`) for security
- `.dockerignore` present (though minimal - only `.git` and `output/`)

**Gaps**:
- No image vulnerability scanning
- No image startup validation test
- No SBOM generation
- No image signing/attestation
- No multi-architecture builds (no `--platform` flag)
- `.dockerignore` is too permissive (should exclude `tests/`, `docs/`, `terraform/`, etc.)

### Security

**Security Practices**:
- `.env.example` present (good - documents required secrets)
- Non-root Docker user (good)
- `test_security_fix.py` - comprehensive path traversal security tests (good)
- Secrets managed via GitHub Actions secrets (adequate)

**Gaps**:
- No Trivy/Snyk/Grype container scanning
- No CodeQL/Semgrep SAST
- No Gitleaks/TruffleHog secret detection
- No dependency scanning (Dependabot/Renovate not configured)
- No SBOM generation
- `docker-compose.yml` runs as `user: root` (contradicts Dockerfile non-root pattern)

### Agent Rules (Agentic Flow Quality)

**Status**: Partial

**What Exists**:
- `.claude/SKILL.md` - Comprehensive development skill with architecture overview, key file locations, config reference, and coding patterns
- `.claude/references/` - 13 reference files covering architecture, API, components, MCP, prompts, retrievers, etc.
- `CURSOR_RULES.md` / `.cursorrules` - Detailed Cursor IDE rules with project structure, coding standards, and development guidelines

**What's Missing**:
- No `.claude/rules/` directory for test automation rules
- No `CLAUDE.md` at repo root (general development rules)
- No test-specific rules (unit-tests.md, e2e-tests.md, security-tests.md)
- Cursor rules mention testing but don't provide specific patterns, fixtures, or mock strategies
- No quality gates or checklists for PRs

**Recommendation**: Generate test automation rules using `/test-rules-generator` to create `.claude/rules/unit-tests.md`, `.claude/rules/integration-tests.md`, and `.claude/rules/security-tests.md`.

## Recommendations

### Priority 0 (Critical)

1. **Create PR-triggered CI workflow** running linting (ruff), type checking (mypy), and unit tests (pytest with mocks only)
2. **Add pytest coverage** with codecov integration and set a minimum threshold starting at 50%
3. **Refactor tests to use mocks/fixtures** instead of requiring live API keys - use `test_quick_search.py` and `test_security_fix.py` as patterns

### Priority 1 (High Value)

4. **Add Trivy container scanning** to the build pipeline
5. **Create comprehensive integration test suite** using docker-compose with mock LLM server
6. **Add pre-commit hooks** with ruff, mypy, and prettier
7. **Create `.claude/rules/`** with unit-test, integration-test, and security-test patterns
8. **Fix test file naming** - standardize to `test_*.py` pattern (currently mix of `test_name.py` and `test-name.py`)

### Priority 1 (High Value)

9. **Enable Dependabot/Renovate** for automated dependency updates
10. **Expand `.dockerignore`** to exclude tests, docs, terraform, and other non-runtime files

### Priority 2 (Nice-to-Have)

11. **Add CodeQL or Semgrep SAST scanning** for Python security analysis
12. **Implement Gitleaks** secret detection in CI
13. **Add multi-architecture Docker builds** for ARM64 support
14. **Create performance regression tests** for research pipeline latency
15. **Add frontend test infrastructure** (Jest/Vitest for Next.js components)
16. **Add SBOM generation** to container builds

## Comparison to Gold Standards

| Dimension | gpt-researcher | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| PR CI Gates | None | Comprehensive | Comprehensive | Comprehensive |
| Unit Test Coverage | ~15% (estimated) | >80% | >70% | >80% |
| Coverage Enforcement | None | Codecov + thresholds | Codecov | Codecov + thresholds |
| Container Scanning | None | Trivy | Trivy | Trivy |
| SAST | None | CodeQL | Limited | CodeQL |
| Pre-commit Hooks | None | Yes | Yes | Yes |
| Secret Detection | None | Gitleaks | Limited | Gitleaks |
| E2E Tests | Manual only | Cypress + automated | Automated | KubeTest + automated |
| Agent Rules | Partial (SKILL.md) | Comprehensive | None | None |
| Image Testing | None | Build + validate | 5-layer validation | Build + deploy test |

## File Paths Reference

### CI/CD
- `.github/workflows/build.yml` - Build and push to ECR
- `.github/workflows/deploy.yml` - Terraform deployment
- `.github/workflows/docker-build.yml` - Docker test runner (dispatch only)

### Testing
- `tests/` - All test files (13 Python files)
- `tests/test_security_fix.py` - Best example of proper mocked tests
- `tests/test_quick_search.py` - Good mocking pattern example
- `evals/` - Research quality evaluation framework
- `docker-compose.yml` - Test profile configuration

### Code Quality
- `pyproject.toml` - Project config and pytest settings
- `frontend/nextjs/.eslintrc.json` - Frontend linting (not enforced in CI)

### Container Images
- `Dockerfile` - Main 3-stage backend image
- `Dockerfile.fullstack` - Full application image
- `docker-compose.yml` - Service definitions
- `.dockerignore` - Build exclusions (minimal)

### Agent Rules
- `.claude/SKILL.md` - Development skill with architecture reference
- `.claude/references/` - 13 reference docs
- `CURSOR_RULES.md` / `.cursorrules` - Cursor IDE development rules

### Security
- `.env.example` - Secret documentation
- `tests/test_security_fix.py` - Path traversal security tests
