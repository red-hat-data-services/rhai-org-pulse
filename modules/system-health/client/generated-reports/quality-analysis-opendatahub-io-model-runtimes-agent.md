---
repository: "opendatahub-io/model-runtimes-agent"
overall_score: 3.0
scorecard:
  - dimension: "Unit Tests"
    score: 5.0
    status: "5 test files (717 lines) covering validators, report rendering, QA helpers, and SSRF; test-to-code ratio ~12%"
  - dimension: "Integration/E2E"
    score: 1.0
    status: "No integration or E2E test suites; cluster-dependent flows are untested in CI"
  - dimension: "Build Integration"
    score: 0.0
    status: "No CI/CD pipeline exists — no PR builds, no Konflux simulation, no automated checks"
  - dimension: "Image Testing"
    score: 0.0
    status: "No Dockerfile/Containerfile; no container image build or runtime validation"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tool configured — no codecov, coveralls, or coverage threshold enforcement"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "No .github/workflows, no .gitlab-ci.yml, no Jenkinsfile — zero CI/CD automation"
  - dimension: "Agent Rules"
    score: 4.0
    status: "AGENTS.md present with detailed specialist flow and stability rubric; no .claude/ rules or test automation guidance"
critical_gaps:
  - title: "No CI/CD pipeline of any kind"
    impact: "No automated testing, linting, or quality checks run on PRs or merges — all quality assurance is manual"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Test coverage is unknown and unmonitored; regressions go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No linting, type checking, or static analysis"
    impact: "Code quality issues, type errors, and style inconsistencies are caught only by human review"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container image build or testing"
    impact: "Application is not packaged as a container — no image-based deployment or validation possible"
    severity: "MEDIUM"
    effort: "8-16 hours"
  - title: "No integration or E2E tests in CI"
    impact: "The core agent pipeline (supervisor → specialist chain → KServe QA) is only validated manually"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No security scanning (SAST, dependency scanning, secret detection)"
    impact: "Vulnerabilities in dependencies (langchain, kubernetes, etc.) and secrets in code go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
quick_wins:
  - title: "Add GitHub Actions CI workflow with pytest"
    effort: "2-3 hours"
    impact: "Automated test execution on every PR — catches regressions immediately"
  - title: "Add ruff linter + type checking with mypy"
    effort: "1-2 hours"
    impact: "Catches style issues, unused imports, type errors across 6k+ lines of Python"
  - title: "Add codecov integration with coverage threshold"
    effort: "1-2 hours"
    impact: "Visibility into test coverage with enforcement on PRs"
  - title: "Add Dependabot or Renovate for dependency updates"
    effort: "30 minutes"
    impact: "Automated alerts for vulnerable or outdated dependencies (langchain, kubernetes, etc.)"
  - title: "Add pre-commit hooks (ruff, mypy, trailing whitespace)"
    effort: "1 hour"
    impact: "Catch quality issues before commit, enforce consistent code style"
  - title: "Create .claude/rules/ with test creation guidance"
    effort: "2-3 hours"
    impact: "AI-generated tests follow project patterns consistently"
recommendations:
  priority_0:
    - "Create a GitHub Actions CI pipeline with pytest, ruff linting, and mypy type checking on every PR"
    - "Add coverage tracking (pytest-cov + codecov) with a minimum threshold (e.g. 60%)"
    - "Enable Dependabot or Renovate for automated security updates on Python dependencies"
  priority_1:
    - "Add integration tests that exercise the agent pipeline with mocked LLM responses and stubbed oc CLI"
    - "Create a Dockerfile for containerized deployment and add container image build/test to CI"
    - "Add CodeQL or Semgrep SAST scanning to the CI pipeline"
    - "Create comprehensive .claude/rules/ for unit test, integration test, and security test patterns"
  priority_2:
    - "Add pre-commit hooks for ruff, mypy, and secret detection (gitleaks)"
    - "Create E2E tests that validate the Streamlit UI workflow with mocked backends"
    - "Add performance benchmarking for the deployability engine's decision matrix computation"
    - "Implement SBOM generation for supply chain transparency"
---

# Quality Analysis: model-runtimes-agent

## Executive Summary

- **Overall Score: 3.0/10**
- **Repository Type**: Python LLM agent application (LangChain + Streamlit UI)
- **Primary Language**: Python 3.12+
- **Framework**: LangChain supervisor agent with Google Gemini, Streamlit web UI
- **Key Strengths**: Well-structured AGENTS.md with detailed specialist flow documentation; deterministic deployability engine with good unit test coverage; security-conscious oc CLI allowlist pattern; SSRF protection on inference URLs
- **Critical Gaps**: Zero CI/CD automation; no linting, type checking, or coverage tracking; no container image; no integration/E2E tests; no security scanning
- **Agent Rules Status**: Partial (AGENTS.md exists but no .claude/ rules)

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 5.0/10 | 5 test files (717 lines) covering validators, report, QA helpers; test-to-code ratio ~12% |
| Integration/E2E | 1.0/10 | No integration or E2E test suites exist |
| **Build Integration** | **0.0/10** | **No CI/CD pipeline — no PR builds, no Konflux simulation** |
| Image Testing | 0.0/10 | No Dockerfile/Containerfile; no image build or runtime validation |
| Coverage Tracking | 0.0/10 | No coverage tool configured |
| CI/CD Automation | 0.0/10 | No .github/workflows, .gitlab-ci.yml, or Jenkinsfile |
| Agent Rules | 4.0/10 | AGENTS.md with specialist flow docs but no .claude/ test rules |

## Critical Gaps

### 1. No CI/CD Pipeline of Any Kind
- **Impact**: All quality assurance is entirely manual. No automated testing, linting, or validation runs on PRs or merges.
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Detail**: The repository has zero CI configuration — no `.github/workflows/`, no `.gitlab-ci.yml`, no `Jenkinsfile`, no `Makefile`. The only documented way to run tests is `uv run pytest` manually.

### 2. No Coverage Tracking or Enforcement
- **Impact**: Test coverage is unknown and unmonitored. There's no way to detect coverage regressions.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Detail**: No `.coveragerc`, no codecov/coveralls integration, no coverage thresholds. The existing 5 test files cover ~717 lines against ~6,144 lines of source code (~12% test-to-code ratio by line count), but actual statement coverage is unknown.

### 3. No Linting, Type Checking, or Static Analysis
- **Impact**: Code quality issues, type errors, unused imports, and style inconsistencies are caught only by human review.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Detail**: No ruff, flake8, pylint, mypy, or any linting configuration exists. No `.pre-commit-config.yaml`. The codebase uses type hints extensively (`from __future__ import annotations`, typed function signatures) but never validates them.

### 4. No Security Scanning
- **Impact**: Vulnerabilities in dependencies (langchain, kubernetes, google-genai, streamlit) and potential secrets in code are undetected.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Detail**: No CodeQL, Semgrep, Bandit, Dependabot, gitleaks, or Trivy integration. The project depends on rapidly-evolving LLM libraries (langchain >= 1.0.3) where security patches are frequent.

### 5. No Container Image
- **Impact**: The application cannot be deployed as a container. No image-based testing, scanning, or production deployment path.
- **Severity**: MEDIUM
- **Effort**: 8-16 hours
- **Detail**: No Dockerfile or Containerfile exists. The app runs via `uv run streamlit run app.py` or `agent` CLI. For production deployment in OpenShift, a containerized distribution is essential.

### 6. No Integration or E2E Tests
- **Impact**: The core agent pipeline (supervisor → Configuration → Accelerator → Decision → QA specialists) is only validated manually.
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Detail**: All existing tests are pure unit tests. The LangChain agent orchestration, specialist handoffs, Streamlit UI workflows, and KServe deployment pipeline have zero automated integration coverage. Tests that mock the Gemini LLM responses and stub `oc` CLI calls would be high-value.

## Quick Wins

### 1. Add GitHub Actions CI Workflow with pytest (2-3 hours)
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv sync
      - run: uv run pytest -v --tb=short
```

### 2. Add ruff Linter + mypy Type Checking (1-2 hours)
```toml
# Add to pyproject.toml
[tool.ruff]
target-version = "py312"
line-length = 120

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM", "S"]

[tool.mypy]
python_version = "3.12"
warn_return_any = true
warn_unused_configs = true
```

### 3. Add Codecov Integration (1-2 hours)
```yaml
# Add to CI workflow
- run: uv run pytest --cov=runtimes_dep_agent --cov-report=xml
- uses: codecov/codecov-action@v4
  with:
    file: coverage.xml
    fail_ci_if_error: true
```

### 4. Add Dependabot (30 minutes)
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: pip
    directory: "/"
    schedule:
      interval: weekly
    open-pull-requests-limit: 10
```

### 5. Add Pre-commit Hooks (1 hour)
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
        additional_dependencies: [types-PyYAML]
```

## Detailed Findings

### CI/CD Pipeline

**Status: Non-existent**

The repository has zero CI/CD configuration:
- No `.github/workflows/` directory
- No `.gitlab-ci.yml`
- No `Jenkinsfile`
- No `Makefile` with test/lint targets
- No `tox.ini`

The only documented test execution path is manual: `uv run pytest`.

### Test Coverage

**Status: Partial unit tests, no integration/E2E**

**Test files (5 total, 717 lines):**

| Test File | Lines | What It Tests |
|-----------|-------|---------------|
| `test_qa_kserve.py` | 373 | QA pipeline helpers: SSRF blocking, sanitize names, dockerconfig encoding, YAML rendering, OOM heuristics, oc allowlist, remediation JSON parsing, self-heal defaults |
| `test_deployability_engine.py` | 109 | Deployment matrix computation: accelerator family inference, FP8 compatibility checks, capacity/TP sizing, quantization inference |
| `test_html_report_narrative.py` | 95 | Report generation: markdown-to-HTML headings, narrative alignment when matrix contradicts stale prose, badge rendering |
| `test_deployability_reconcile.py` | 93 | FP8/GPU reconciliation: H100 detection, false-negative flipping, file handling |
| `test_decision_fit.py` | 47 | Tensor-parallel heuristics: VRAM-to-TP calculation, GPU inventory parsing |

**Source code (21 files, ~6,144 lines):**

Key untested modules:
- `agent/llm_agent.py` (260 lines) — Supervisor orchestration
- `agent/specialists/*.py` (~950 lines) — All four specialist builders
- `execute_agent.py` (360 lines) — CLI entrypoint and oc login
- `qa_kserve/pipeline.py` (789 lines) — Full KServe QA pipeline
- `qa_kserve/post_deploy.py` (337 lines) — Post-deployment smoke tests
- `config/model_config.py` (225 lines) — YAML + skopeo helpers
- `app.py` (2042 lines) — Entire Streamlit UI

**Test-to-code ratio**: ~12% by line count (717 test lines / 6,144 source lines)

**Coverage tracking**: None. No `.coveragerc`, no codecov integration, no pytest-cov in dependencies.

**Strengths**: Existing tests are well-written with clear assertions, good edge case coverage for deterministic components (deployability engine, reconciliation logic), and proper SSRF validation testing.

### Code Quality

**Status: No tooling configured**

- **Linting**: None. No ruff, flake8, pylint, or ESLint configuration.
- **Type checking**: None. Code uses extensive type annotations (`from __future__ import annotations`, typed parameters) but mypy is not configured or run.
- **Formatting**: None. No black, ruff-format, or any formatter configuration.
- **Pre-commit**: None. No `.pre-commit-config.yaml`.
- **Static analysis**: None. No CodeQL, Semgrep, Bandit, or any SAST tool.

**Positive observations**: The codebase follows consistent patterns — all modules use `from __future__ import annotations`, functions have type annotations, and test files follow a uniform structure.

### Container Images

**Status: No container image**

- No `Dockerfile` or `Containerfile` exists
- No `.dockerignore` (beyond the standard gitignore)
- No container build configuration
- No multi-architecture support
- No vulnerability scanning
- No SBOM generation

The application is distributed as a Python package installable via `pip install -e .` or `uv sync`, with a `pyproject.toml`-based build system.

### Security

**Status: Mixed — good code practices, no automated scanning**

**Positive patterns found in code:**
- `oc_cli.py`: Command allowlisting via `ALLOWED_OC_SUBCOMMANDS` frozenset — only permits `get`, `apply`, `create`, `delete`, `patch`, `logs`, `wait`, `project`, `describe`, `whoami`, `version`
- `post_deploy.py`: SSRF protection via `_inference_url_ssrf_block_reason()` — blocks loopback IPs, non-HTTP schemes
- Tests explicitly validate these security controls (`TestOcAllowlist`, `TestPostDeploySsrf`)
- `shlex`-based input handling for oc login commands

**Missing:**
- No Dependabot/Renovate for dependency vulnerability monitoring
- No CodeQL or Semgrep SAST scanning
- No gitleaks or TruffleHog for secret detection
- No Trivy/Snyk for dependency scanning
- No SBOM generation
- Sensitive data (API keys, pull secrets) handled via environment variables — good, but `app.py` stores secrets in `st.session_state` and `os.environ` at runtime

### Agent Rules (Agentic Flow Quality)

**Status: Partial**

- **AGENTS.md**: Present and comprehensive (detailed specialist flow, quantization compatibility matrix, verdict rubric, stability/reproducibility checklist, artifact documentation)
- **CLAUDE.md**: Not present
- **.claude/ directory**: Not present
- **.claude/rules/**: Not present — no test creation rules
- **.claude/skills/**: Not present — no custom skills

**Quality of AGENTS.md**: High — includes Mermaid flow diagram, per-specialist responsibilities, deterministic vs LLM-driven behavior table, stable verdict rubric, quantization × hardware reference table, and drift policy. This is well above average for project documentation.

**Gaps**: No `.claude/rules/` directory with test creation guidance. No rules for how AI agents should write unit tests, integration tests, or handle the LangChain specialist pattern. The AGENTS.md focuses on runtime behavior, not on test automation.

## Recommendations

### Priority 0 (Critical)

1. **Create a GitHub Actions CI pipeline** with pytest, ruff linting, and mypy type checking on every PR. This is the single highest-impact improvement — the repository currently has zero automated quality gates.

2. **Add coverage tracking** (pytest-cov + codecov) with a minimum threshold (e.g., 60% initially, increasing over time). The existing unit tests provide a foundation to build on.

3. **Enable Dependabot** for automated security updates. The project depends on rapidly-evolving LLM libraries (langchain >= 1.0.3, langchain-google-genai >= 3.2.0) where security patches are frequent.

### Priority 1 (High Value)

4. **Add integration tests** that exercise the agent pipeline with mocked LLM responses (using `langchain.testing` or `unittest.mock`) and stubbed `oc` CLI calls. Focus on the supervisor → specialist handoff chain and the KServe QA pipeline decision paths.

5. **Create a Dockerfile** for containerized deployment and add container image build/test to CI. Essential for production deployment in OpenShift environments.

6. **Add CodeQL or Semgrep** SAST scanning to the CI pipeline. The codebase uses `subprocess.run` in multiple modules — static analysis would catch any injection risks.

7. **Create .claude/rules/** with test creation rules specific to this project's patterns (LangChain agents, specialist tools, deterministic validators, YAML rendering).

### Priority 2 (Nice-to-Have)

8. **Add pre-commit hooks** for ruff, mypy, and secret detection (gitleaks).

9. **Create E2E tests** for the Streamlit UI workflow using `streamlit.testing` or similar.

10. **Add performance benchmarking** for the deployability engine's decision matrix computation — this is deterministic and measurable.

11. **Implement SBOM generation** for supply chain transparency.

## Comparison to Gold Standards

| Dimension | model-runtimes-agent | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|-----------|---------------------|---------------------|------------------|---------------|
| CI/CD Pipeline | None | Multi-workflow GitHub Actions | Comprehensive GHA | Extensive GHA + Prow |
| Unit Tests | 5 files, ~12% ratio | Hundreds of tests, >70% | Extensive | >80% coverage |
| Integration/E2E | None | Cypress + contract tests | Multi-layer validation | envtest + E2E |
| Coverage Tracking | None | Codecov enforced | Coverage reports | Codecov enforced |
| Linting | None | ESLint + Prettier + strict TS | Various | golangci-lint (30+ linters) |
| Container Testing | None | Image build in CI | 5-layer image validation | Multi-arch builds |
| Security Scanning | None (code-level SSRF/allowlist only) | Trivy + CodeQL | Trivy + scanning | CodeQL + Snyk |
| Agent Rules | AGENTS.md only | Comprehensive .claude/rules/ | N/A | N/A |
| Pre-commit | None | Husky + lint-staged | Pre-commit hooks | Pre-commit hooks |

## File Paths Reference

### Configuration
- `pyproject.toml` — Project metadata, dependencies, build config
- `sample_modelcar_config.yaml` — Example model-car YAML input
- `example-env.sh` — Environment variable template

### Source Code (21 Python files, ~6,144 lines)
- `src/runtimes_dep_agent/agent/llm_agent.py` — Supervisor agent
- `src/runtimes_dep_agent/agent/specialists/` — Four specialist builders
- `src/runtimes_dep_agent/qa_kserve/pipeline.py` — KServe QA pipeline
- `src/runtimes_dep_agent/qa_kserve/oc_cli.py` — Allowlisted oc CLI wrapper
- `src/runtimes_dep_agent/validators/deployability_engine.py` — Deterministic deploy/no-deploy
- `src/runtimes_dep_agent/report/html_report.py` — HTML report generator
- `app.py` — Streamlit web UI (2,042 lines)

### Tests (5 files, 717 lines)
- `tests/test_qa_kserve.py` — QA pipeline helper tests
- `tests/test_deployability_engine.py` — Deployability engine tests
- `tests/test_html_report_narrative.py` — Report narrative alignment tests
- `tests/test_deployability_reconcile.py` — FP8/GPU reconciliation tests
- `tests/test_decision_fit.py` — Tensor-parallel heuristic tests

### Agent Documentation
- `AGENTS.md` — Specialist flow, stability rubric, quantization matrix
- `deployment-yamls/agents.md` — KServe QA playbook and apply order

### Missing (Expected)
- `.github/workflows/` — No CI/CD
- `.claude/` — No agent rules
- `Dockerfile` — No container image
- `.pre-commit-config.yaml` — No pre-commit hooks
- `.codecov.yml` — No coverage config
- `ruff.toml` / `mypy.ini` — No linting config
