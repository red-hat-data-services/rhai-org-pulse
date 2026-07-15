---
repository: "assafelovic/gpt-researcher"
overall_score: 3.4
scorecard:
  - dimension: "Unit Tests"
    score: 4.0
    status: "20 test files with pytest, but only 2,096 lines of tests for 18,195 lines of source (11.5% ratio); no tests run on PRs"
  - dimension: "Integration/E2E"
    score: 2.0
    status: "Docker Compose test profile exists but only runs 2 legacy test files; no automated E2E or integration suite"
  - dimension: "Build Integration"
    score: 2.0
    status: "No PR-time build validation; Docker builds only on push to master; no image validation or startup testing"
  - dimension: "Image Testing"
    score: 2.0
    status: "Multi-stage Dockerfiles exist but no runtime validation, no startup testing, no vulnerability scanning"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tool configured — no .coveragerc, no codecov.yml, no coverage reporting in CI"
  - dimension: "CI/CD Automation"
    score: 3.0
    status: "5 workflows exist but tests are NOT run on PRs (trigger commented out); only LLM cost analysis runs on PRs"
  - dimension: "Agent Rules"
    score: 5.0
    status: "Good SKILL.md with architecture references in .claude/, but no test creation rules or quality gates"
critical_gaps:
  - title: "Tests are NOT run on PRs"
    impact: "Regressions merge freely — tests only run manually via workflow_dispatch. The PR trigger in docker-build.yml is commented out."
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No coverage tracking at all"
    impact: "Impossible to know what percentage of code is tested; no enforcement of coverage thresholds"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No linting, type checking, or static analysis in CI"
    impact: "Code quality issues, type errors, and potential bugs pass undetected. No ruff, mypy, flake8, or pylint configured."
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No security scanning (SAST, container, dependency)"
    impact: "Vulnerabilities in code and dependencies not detected until production. No Trivy, Snyk, CodeQL, or Bandit."
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No pre-commit hooks"
    impact: "No local quality gates. Developers can commit code without any formatting or linting checks."
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "Docker image builds without testing"
    impact: "Images pushed to ECR without any runtime validation, startup testing, or vulnerability scanning"
    severity: "HIGH"
    effort: "6-8 hours"
quick_wins:
  - title: "Uncomment PR trigger in docker-build.yml to run tests on PRs"
    effort: "30 minutes"
    impact: "Immediately prevents regressions from merging — tests exist but are simply not invoked on PRs"
  - title: "Add pytest-cov and upload to Codecov"
    effort: "2-3 hours"
    impact: "Visibility into test coverage with PR-level coverage reporting"
  - title: "Add ruff linter to CI"
    effort: "1-2 hours"
    impact: "Fast Python linter catches style issues, potential bugs, and import ordering in seconds"
  - title: "Add Trivy container scanning"
    effort: "1-2 hours"
    impact: "Detect known CVEs in base images and dependencies before deployment"
  - title: "Add .pre-commit-config.yaml with ruff + mypy"
    effort: "2-3 hours"
    impact: "Shift-left quality checks to developer workstations"
recommendations:
  priority_0:
    - "Enable test execution on PRs by uncommenting the pull_request trigger in docker-build.yml"
    - "Add coverage tracking with pytest-cov and codecov integration with a minimum threshold (e.g., 60%)"
    - "Add ruff linting and mypy type checking to the CI pipeline"
    - "Add container vulnerability scanning (Trivy) to the build workflow"
  priority_1:
    - "Expand test suite significantly — current 11.5% test-to-code ratio is very low for a production service"
    - "Add integration tests that validate the research pipeline end-to-end (without live LLM calls via mocking)"
    - "Add security scanning (CodeQL or Bandit) for SAST in the CI pipeline"
    - "Create comprehensive agent rules for test automation (.claude/rules/)"
  priority_2:
    - "Add API contract tests for the FastAPI endpoints"
    - "Add Docker image startup validation in CI (health check endpoint)"
    - "Add performance benchmarking for research pipeline execution time"
    - "Implement multi-architecture Docker builds (arm64 support)"
---

# Quality Analysis: GPT Researcher

## Executive Summary
- **Overall Score: 3.4/10**
- **Repository Type**: Python AI research agent with Next.js frontend
- **Primary Language**: Python (215 .py files, ~18K LoC)
- **Framework**: FastAPI + LangChain/LangGraph + Next.js
- **Key Strengths**: Good Claude Code SKILL.md with architecture documentation, Dependabot enabled, well-structured Dockerfiles, security policy documented
- **Critical Gaps**: Tests not run on PRs (trigger commented out), zero coverage tracking, no linting/type checking, no security scanning
- **Agent Rules Status**: Partial — SKILL.md with references exists but no test creation rules

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 4/10 | 20 test files (2,096 LoC) but only 11.5% test-to-code ratio; pytest framework |
| Integration/E2E | 2/10 | Docker Compose test profile runs only 2 legacy files; no real E2E suite |
| **Build Integration** | **2/10** | **No PR-time build validation; Docker builds only on master push** |
| Image Testing | 2/10 | Multi-stage Dockerfiles but no runtime/startup validation |
| Coverage Tracking | 0/10 | Completely absent — no coverage tool, no thresholds, no reporting |
| CI/CD Automation | 3/10 | 5 workflows but PR trigger for tests is commented out |
| Agent Rules | 5/10 | Good SKILL.md + references, but no test rules or quality gates |

## Critical Gaps

### 1. Tests Are NOT Run on Pull Requests
- **Impact**: Regressions can merge freely into master without any test validation
- **Severity**: HIGH
- **Effort**: 30 minutes (uncomment the PR trigger)
- **Details**: In `.github/workflows/docker-build.yml`, the `pull_request` trigger is explicitly commented out (`# pull_request: / #   types: [opened, synchronize]`). Tests only run via `workflow_dispatch` (manual trigger). This means every PR merges without any automated test validation.

### 2. No Coverage Tracking
- **Impact**: No visibility into what percentage of code is tested; no enforcement
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No `.coveragerc`, no `codecov.yml`, no `pytest-cov` in dependencies, no coverage reporting in any workflow. With only an 11.5% test-to-code ratio, this is especially critical.

### 3. No Linting, Type Checking, or Static Analysis
- **Impact**: Code quality issues, type errors, and potential bugs pass undetected
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: Despite having type stubs in dev dependencies (`types-aiofiles`, `types-beautifulsoup4`, etc.), there is no mypy configuration, no ruff/flake8/pylint config, and no linting step in CI. The type stubs are installed but never used.

### 4. No Security Scanning
- **Impact**: Vulnerabilities in code and dependencies not detected
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No Trivy, Snyk, CodeQL, Bandit, or any SAST tool. No container scanning despite pushing images to ECR. Dependabot is enabled for pip and Docker (good), but that's the only security measure. For a tool that executes web scraping and processes arbitrary web content, this is a significant risk.

### 5. Docker Images Built and Pushed Without Validation
- **Impact**: Broken images could reach production
- **Severity**: HIGH
- **Effort**: 6-8 hours
- **Details**: The `build.yml` workflow builds and pushes to ECR on every master push, then auto-triggers deployment via Terraform — with no health check, no startup validation, and no vulnerability scan between build and deploy.

### 6. No Pre-commit Hooks
- **Impact**: No local quality enforcement
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: No `.pre-commit-config.yaml` exists. Developers can commit any code without formatting, linting, or type checking.

## Quick Wins

### 1. Uncomment PR Test Trigger (30 minutes)
Enable test execution on PRs by uncommenting the `pull_request` trigger in `docker-build.yml`:
```yaml
on:
  workflow_dispatch:
  pull_request:
    types: [opened, synchronize]
```

### 2. Add pytest-cov and Codecov (2-3 hours)
```yaml
# In CI workflow:
- name: Run tests with coverage
  run: |
    pip install pytest pytest-asyncio pytest-cov
    pytest --cov=gpt_researcher --cov-report=xml tests/
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    file: ./coverage.xml
```

### 3. Add Ruff Linter (1-2 hours)
```yaml
# Add to PR workflow:
- name: Lint with ruff
  run: |
    pip install ruff
    ruff check .
    ruff format --check .
```

### 4. Add Trivy Container Scanning (1-2 hours)
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ steps.login-ecr.outputs.registry }}/${{ env.REPO_NAME }}:${{ steps.image-tag.outputs.tag }}
    format: 'sarif'
    exit-code: '1'
    severity: 'CRITICAL,HIGH'
```

### 5. Add Pre-commit Hooks (2-3 hours)
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.5.0
    hooks:
      - id: ruff
      - id: ruff-format
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.10.0
    hooks:
      - id: mypy
        additional_dependencies: [types-requests, types-aiofiles]
```

## Detailed Findings

### CI/CD Pipeline

**Workflows Found** (5 total):
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build.yml` | push to master | Build Docker image, push to ECR, trigger deploy |
| `deploy.yml` | push/PR (terraform/** only), workflow_dispatch | Terraform plan/apply for ECS deployment |
| `docker-build.yml` | workflow_dispatch only (PR trigger COMMENTED OUT) | Run tests via Docker Compose |
| `llm-costs.yml` | pull_request | LLM cost analysis with TokenToll |
| `plugin-quality-gate.yml` | pull_request (paths: .codex-plugin/**, skills/**, .mcp.json) | Codex plugin quality scanning |

**Key Issues**:
- Tests do NOT run on PRs — the only PR-triggered workflows are LLM cost analysis and plugin quality gate (for specific paths only)
- No concurrency control on any workflow
- No caching for pip dependencies
- Build workflow pushes to ECR and auto-deploys with no quality gate between build and deploy
- Docker Compose test profile only runs 2 legacy test scripts (`report-types.py`, `vector-store.py`) — not the 20 proper test files

### Test Coverage

**Test Files**: 20 files in `tests/` directory (2,096 lines)
**Source Files**: ~215 Python files (~18,195 lines excluding tests/evals/docs)
**Test-to-Code Ratio**: 11.5% (weak — target is 30%+)

**Testing Framework**: pytest with pytest-asyncio (configured in `pyproject.toml`)
```toml
[tool.pytest.ini_options]
asyncio_mode = "strict"
addopts = "-v"
testpaths = ["tests"]
```

**Test Categories**:
- Security tests: `test_security_fix.py` (351 lines — strongest test file, tests path traversal fixes)
- Deep research parsing: `test_deep_research_parsing.py` (316 lines)
- MCP integration: `test_mcp.py` (268 lines — but requires live API keys)
- WebSocket: `test_websocket_manager.py` (114 lines)
- Retrievers: `test_brave_retriever.py`, `test_crw_retriever.py`
- Costs/logging: Several smaller test files

**Coverage Gaps**:
- Core `GPTResearcher` agent class — no unit tests
- Report generation pipeline — no tests
- API endpoints (FastAPI) — no tests
- Frontend (Next.js) — no tests visible
- Multi-agent system — only 1 test file with 42 lines
- Configuration system — no tests

**Evals Directory**: Contains `hallucination_eval/` and `simple_evals/` — evaluation benchmarks for research quality (separate from unit tests)

### Code Quality

| Tool | Status |
|------|--------|
| Linting (ruff/flake8/pylint) | NOT configured |
| Type checking (mypy) | NOT configured (type stubs installed but unused) |
| Code formatting (black/ruff) | NOT configured |
| Pre-commit hooks | NOT configured |
| Static analysis (CodeQL/Semgrep) | NOT configured |
| Import sorting (isort) | NOT configured |

**Dev Dependencies** (from `pyproject.toml`): Type stubs for `aiofiles`, `beautifulsoup4`, `colorama`, `markdown`, `requests` are listed in `[dependency-groups] dev` — but mypy is not configured to use them.

### Container Images

**Dockerfiles** (5 total):
| File | Purpose | Multi-stage |
|------|---------|-------------|
| `Dockerfile` | Backend API server | Yes (3-stage) |
| `Dockerfile.fullstack` | Combined backend + frontend | Yes (4-stage) |
| `frontend/nextjs/Dockerfile` | Next.js production | Unknown |
| `frontend/nextjs/Dockerfile.dev` | Next.js development | Unknown |
| `backend/Dockerfile` | Backend standalone | Unknown |

**Positive Practices**:
- Multi-stage builds to reduce image size
- Non-root user in main Dockerfile (`gpt-researcher` user)
- Build args for configuration (HOST, PORT, WORKERS)
- `.dockerignore` not checked but likely present

**Gaps**:
- No vulnerability scanning (no Trivy/Snyk)
- No image startup validation
- No health check endpoint tested
- No SBOM generation
- No image signing/attestation
- Multi-architecture support only in fullstack Dockerfile (arm64-aware Chromium handling)

### Security

| Practice | Status |
|----------|--------|
| SECURITY.md | Present — clear vulnerability reporting process |
| Dependabot | Enabled (pip + docker, weekly) |
| SAST (CodeQL/Bandit) | NOT configured |
| Container scanning | NOT configured |
| Secret detection (Gitleaks) | NOT configured |
| Dependency auditing | Dependabot only |
| Security tests | 1 file (path traversal tests — good) |

**Risk Context**: GPT Researcher executes web scraping, processes arbitrary web content, interfaces with multiple LLM APIs, and handles file uploads. This attack surface makes the absence of security scanning particularly concerning.

### Agent Rules (Agentic Flow Quality)

**Status**: Partial
- **SKILL.md**: Excellent — comprehensive development skill with architecture overview, key file locations, core patterns, and 12 reference documents
- **.claude/references/**: 12 detailed reference files covering architecture, API, components, config, flows, MCP, retrievers, etc.
- **CURSOR_RULES.md**: Present with project structure and development guidelines
- **.claude/rules/**: NOT present — no test creation rules
- **Test automation guidance**: None — no rules for how to write unit tests, integration tests, or E2E tests
- **Quality gates**: None — no checklists for PR review or test requirements

**Gap**: The `.claude/` directory has strong architecture documentation but zero test-related rules. Developers (and AI agents) have no guidance on testing patterns, required test coverage, or test frameworks to use.

## Recommendations

### Priority 0 (Critical — Do These First)

1. **Enable test execution on PRs** — Uncomment the `pull_request` trigger in `docker-build.yml`. This is a 30-minute fix that immediately catches regressions. Also update the Docker Compose test command to run the full `pytest` suite, not just 2 legacy scripts.

2. **Add coverage tracking** — Install `pytest-cov`, generate XML reports, upload to Codecov with a minimum threshold (start at 30%, target 60%+). Without this, you're flying blind on test quality.

3. **Add Python linting to CI** — Use `ruff` for fast linting and formatting checks on PRs. Configure `ruff.toml` with sensible defaults. Add `mypy` for type checking since type stubs are already installed.

4. **Add container vulnerability scanning** — Add Trivy to the build workflow before pushing to ECR. Block deployments with CRITICAL/HIGH vulnerabilities.

### Priority 1 (High Value — Next Sprint)

5. **Expand test suite significantly** — Focus on the core `GPTResearcher` agent, report generation, and FastAPI endpoints. Target 30%+ test-to-code ratio. Use mocking for LLM calls.

6. **Add integration tests** — Create tests that validate the research pipeline end-to-end using mocked LLM responses. Test the full flow from query → sub-queries → scraping → report generation.

7. **Add SAST scanning** — Enable CodeQL or add Bandit to the CI pipeline. Given the web scraping and file handling, SAST is important for catching injection vulnerabilities.

8. **Create test automation agent rules** — Add `.claude/rules/unit-tests.md`, `.claude/rules/integration-tests.md` with patterns specific to this codebase (pytest-asyncio patterns, mocking LLM providers, testing retrievers).

### Priority 2 (Nice-to-Have)

9. **Add API contract tests** — Use `schemathesis` or similar to validate FastAPI endpoint schemas.

10. **Add Docker health check validation** — Test that the container starts and responds on the health endpoint before deployment.

11. **Add performance benchmarking** — Track research pipeline execution time to catch performance regressions.

12. **Implement multi-architecture builds** — Standardize arm64 support across all Dockerfiles (currently only fullstack handles it).

## Comparison to Gold Standards

| Dimension | gpt-researcher | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit Tests | 4/10 | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 2/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 2/10 | 8/10 | 7/10 | 8/10 |
| Image Testing | 2/10 | 7/10 | 9/10 | 7/10 |
| Coverage Tracking | 0/10 | 8/10 | 6/10 | 9/10 |
| CI/CD Automation | 3/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 5/10 | 9/10 | 3/10 | 3/10 |
| **Overall** | **3.4/10** | **8.5/10** | **7.0/10** | **8.0/10** |

**Key Takeaway**: gpt-researcher's biggest deficit is that the test infrastructure exists but is not connected to the PR pipeline. The tests, Docker Compose profile, and pytest configuration are all in place — they just aren't invoked automatically. This means the highest-ROI fix is simply enabling the existing tests to run on PRs.

## File Paths Reference

| Category | File |
|----------|------|
| CI: Build & Deploy | `.github/workflows/build.yml` |
| CI: Terraform Deploy | `.github/workflows/deploy.yml` |
| CI: Tests (disabled on PRs) | `.github/workflows/docker-build.yml` |
| CI: LLM Cost Analysis | `.github/workflows/llm-costs.yml` |
| CI: Plugin Quality | `.github/workflows/plugin-quality-gate.yml` |
| Dependabot | `.github/dependabot.yml` |
| Test Configuration | `pyproject.toml` (pytest section) |
| Test Directory | `tests/` (20 test files) |
| Main Dockerfile | `Dockerfile` (3-stage) |
| Fullstack Dockerfile | `Dockerfile.fullstack` (4-stage) |
| Docker Compose | `docker-compose.yml` |
| Agent Rules | `.claude/SKILL.md` + `.claude/references/` |
| Cursor Rules | `CURSOR_RULES.md` |
| Security Policy | `SECURITY.md` |
| Evals | `evals/` (hallucination + simple evals) |
