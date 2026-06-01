---
repository: "opendatahub-io/model-runtimes-agent"
overall_score: 3.2
scorecard:
  - dimension: "Unit Tests"
    score: 5.0
    status: "5 test files with 717 lines covering core validators and QA helpers; 0.12 test-to-code ratio"
  - dimension: "Integration/E2E"
    score: 1.0
    status: "No integration or E2E tests; no cluster-level testing in CI; QA pipeline only runs live on real clusters"
  - dimension: "Build Integration"
    score: 0.0
    status: "No CI/CD pipeline exists; no PR builds, no Konflux, no image validation"
  - dimension: "Image Testing"
    score: 0.0
    status: "No Dockerfile or container image; no image build or runtime validation"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tool configured; no codecov, no coverage thresholds, no PR reporting"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "No .github/workflows, no .gitlab-ci.yml, no Jenkinsfile, no CI of any kind"
  - dimension: "Agent Rules"
    score: 4.0
    status: "AGENTS.md provides strong specialist behavior docs but no .claude/ rules directory; no test creation guidance"
critical_gaps:
  - title: "No CI/CD pipeline of any kind"
    impact: "No automated quality gates; code changes have zero automated validation before merge"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Test coverage unknown and not enforced; regressions go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container image or Dockerfile"
    impact: "Application cannot be deployed as a container; no image testing possible"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No integration or E2E tests in CI"
    impact: "QA pipeline only tested manually on live clusters; no automated regression detection"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No security scanning (SAST, dependency, secret detection)"
    impact: "Vulnerabilities in dependencies or code not detected; secrets may leak"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No linting or static analysis configured"
    impact: "Code style inconsistencies and potential bugs not caught automatically"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add GitHub Actions CI workflow with pytest + ruff"
    effort: "2-3 hours"
    impact: "Immediate automated testing and linting on every PR"
  - title: "Add pytest-cov and codecov integration"
    effort: "1-2 hours"
    impact: "Visibility into test coverage with PR-level reporting"
  - title: "Add pre-commit hooks (ruff, mypy)"
    effort: "1-2 hours"
    impact: "Catch style and type errors before commit"
  - title: "Add Dockerfile for containerized deployment"
    effort: "2-4 hours"
    impact: "Enable container builds, image scanning, and Konflux integration"
recommendations:
  priority_0:
    - "Create GitHub Actions CI workflow: run pytest on PRs, enforce ruff linting, add mypy type checking"
    - "Add coverage tracking with pytest-cov and integrate codecov with minimum thresholds"
    - "Add Dependabot or Renovate for automated dependency updates and vulnerability alerts"
  priority_1:
    - "Create a Dockerfile/Containerfile for the application with multi-stage build"
    - "Add integration tests that mock cluster interactions (oc_cli, K8s API)"
    - "Create .claude/rules/ directory with test creation guidance for unit and integration tests"
    - "Add security scanning (CodeQL for SAST, Trivy for dependency scanning)"
  priority_2:
    - "Add E2E test infrastructure with Kind/Minikube for KServe pipeline validation"
    - "Implement pre-commit hooks with ruff, mypy, and secret detection"
    - "Add API contract tests for LangChain specialist tool interfaces"
---

# Quality Analysis: model-runtimes-agent

## Executive Summary

- **Overall Score: 3.2/10**
- **Repository Type**: Python LangChain agent application (Streamlit UI + CLI)
- **Primary Language**: Python 3.12+
- **Framework**: LangChain + LangGraph supervisor agent, Streamlit, KServe deployment QA
- **Key Strengths**: Good AGENTS.md documentation, security-aware patterns (SSRF blocking, oc allowlist), well-structured deterministic validators with tests
- **Critical Gaps**: No CI/CD pipeline whatsoever, no container image, no coverage tracking, no linting, no security scanning
- **Agent Rules Status**: Partial — AGENTS.md exists with strong specialist behavior docs, but no `.claude/` rules directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 5.0/10 | 5 test files (717 lines) covering core validators; 0.12 test-to-code ratio |
| Integration/E2E | 1.0/10 | No integration or E2E tests; QA pipeline only runs on live clusters |
| **Build Integration** | **0.0/10** | **No CI/CD of any kind; no PR builds, no Konflux** |
| Image Testing | 0.0/10 | No Dockerfile or container image exists |
| Coverage Tracking | 0.0/10 | No coverage tool, no thresholds, no PR reporting |
| CI/CD Automation | 0.0/10 | No GitHub Actions, no GitLab CI, no Jenkins |
| Agent Rules | 4.0/10 | AGENTS.md provides specialist docs; no `.claude/rules/` for test guidance |

## Critical Gaps

### 1. No CI/CD Pipeline
- **Impact**: No automated quality gates. Code merges without any automated tests, linting, or validation.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The repository has zero CI configuration — no `.github/workflows/`, no `.gitlab-ci.yml`, no `Jenkinsfile`. The only merge seen is #8 with no associated CI checks. Tests must be run manually with `uv run pytest`.

### 2. No Coverage Tracking
- **Impact**: Test coverage is unknown and not enforced. Coverage could silently degrade.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No `.codecov.yml`, no `pytest-cov` in dependencies, no `.coveragerc`. The project has no visibility into what percentage of code is tested.

### 3. No Container Image
- **Impact**: Cannot deploy as a container, no image testing, no Konflux integration possible.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: No `Dockerfile` or `Containerfile` exists. The application runs via `uv run streamlit run app.py` or the `agent` CLI entry point but has no container packaging.

### 4. No Integration/E2E Tests
- **Impact**: The KServe QA pipeline (the core value proposition) is only tested on live clusters, never in CI.
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Details**: The existing tests are good unit tests for individual validators and helpers, but there are no tests that exercise the full supervisor pipeline, the Streamlit app, or the QA deployment flow — even with mocked cluster interactions.

### 5. No Security Scanning
- **Impact**: Dependency vulnerabilities and code-level security issues not detected automatically.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No CodeQL, no Trivy, no Snyk, no Dependabot, no Gitleaks. The codebase does show strong security patterns (SSRF blocking in `post_deploy.py`, oc subcommand allowlisting in `oc_cli.py`), but these are not verified by automated scanning.

### 6. No Linting or Static Analysis
- **Impact**: Code style drift, potential bugs, and type errors not caught.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: No `ruff.toml`, `mypy.ini`, `.flake8`, or `.pre-commit-config.yaml`. Python type hints are used inconsistently.

## Quick Wins

### 1. Add GitHub Actions CI (2-3 hours)
Create `.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
      - run: uv sync
      - run: uv run ruff check src/ tests/
      - run: uv run pytest --tb=short -q
```

### 2. Add Coverage Tracking (1-2 hours)
Add `pytest-cov` to dev dependencies and configure codecov:
```yaml
# In CI workflow
- run: uv run pytest --cov=src --cov-report=xml
- uses: codecov/codecov-action@v4
```

### 3. Add Pre-commit Hooks (1-2 hours)
Create `.pre-commit-config.yaml`:
```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
      - id: ruff-format
```

### 4. Add Dockerfile (2-4 hours)
Create a multi-stage Dockerfile for containerized deployment of the Streamlit app.

## Detailed Findings

### CI/CD Pipeline
- **Status**: Non-existent
- **Workflows**: None
- **PR Gates**: None
- **Periodic Jobs**: None
- **Build Automation**: None (manual `uv sync` and `pip install -e .`)

The repository has a single merge commit visible (PR #8). No CI checks run on PRs.

### Test Coverage

**Unit Tests (5 files, 717 lines)**:

| Test File | Lines | Coverage Area |
|-----------|-------|---------------|
| `test_qa_kserve.py` | 373 | QA helpers: K8s name sanitization, Docker config encoding, pod classification, YAML rendering, serving runtime templates, remediation JSON parsing, SSRF blocking |
| `test_deployability_engine.py` | 109 | GPU inventory parsing, accelerator family inference, FP8/capacity deploy decisions, tensor-parallel sizing |
| `test_deployability_reconcile.py` | 93 | FP8/GPU generation reconciliation logic when matrix contradicts actual hardware |
| `test_html_report_narrative.py` | 95 | HTML report generation, verdict badge alignment, markdown-to-HTML heading conversion |
| `test_decision_fit.py` | 47 | Tensor-parallel minimum calculation, GPU inventory parsing edge cases |

**Strengths**:
- Tests cover the **deterministic** validators well (deployability engine, reconciliation, rendering)
- Good edge case coverage (SSRF blocking, OOM detection, invalid quantities)
- Security-relevant test: SSRF loopback blocking, oc subcommand allowlist enforcement

**Weaknesses**:
- **0.12 test-to-code ratio** (717 test lines / 6,145 source lines) — well below industry standard of 0.5-1.0
- No tests for: `app.py` (2,041 lines), `llm_agent.py`, any specialist modules, `preflight.py`, `execute_agent.py`, `config/model_config.py`
- No mocked integration tests for the supervisor pipeline
- No tests for the Streamlit UI

### Code Quality

- **Linting**: None configured (no ruff, flake8, pylint)
- **Type Checking**: No mypy or pyright configuration; type hints used in some files but not enforced
- **Formatting**: No formatter configured (no black, ruff format)
- **Pre-commit Hooks**: None (`.pre-commit-config.yaml` does not exist)
- **Static Analysis**: No SAST tools
- **Positive**: Good use of `dataclasses`, `typing`, `__future__ annotations`; consistent module structure

### Container Images
- **Status**: No container image exists
- No `Dockerfile` or `Containerfile`
- No `docker-compose.yml`
- No `.dockerignore` (beyond the generated `.gitignore` which covers similar patterns)
- Application is designed to run directly with `uv` or `pip install`

### Security

**Positive Patterns** (in application code):
- **SSRF Protection**: `post_deploy.py` blocks loopback, RFC1918, metadata, and ULA addresses before making HTTP requests (`_V4_SSRF_NETWORKS`, `_V6_SSRF_NETWORKS`)
- **Command Injection Prevention**: `oc_cli.py` uses an explicit `ALLOWED_OC_SUBCOMMANDS` allowlist
- **TLS by Default**: Smoke tests use verified TLS by default; insecure mode requires explicit opt-in via `QA_SMOKE_TLS_INSECURE`
- **Input Validation**: `sanitize_k8s_name()` normalizes user-provided names for K8s resources

**Missing**:
- No automated dependency vulnerability scanning (Dependabot, Renovate)
- No SAST (CodeQL, Semgrep, Bandit)
- No secret detection (Gitleaks, TruffleHog)
- No container scanning (N/A — no container)

### Agent Rules (Agentic Flow Quality)

- **Status**: Partial
- **AGENTS.md**: Comprehensive (227 lines) — documents specialist flow, artifact contracts, verdict rubric, quantization compatibility tables, deterministic vs LLM behavior, reproducibility checklist
- **CLAUDE.md**: Not present
- **`.claude/` directory**: Not present
- **`.claude/rules/`**: Not present — no test creation guidance for AI agents
- **Test Documentation**: No dedicated testing documentation beyond inline comments and README "Development" section

**AGENTS.md Strengths**:
- Clear end-to-end flow diagram (Mermaid)
- Explicit verdict text contract for parsers
- Quantization × hardware compatibility matrix with upstream source of truth
- Drift policy for keeping code and docs aligned
- Stability/reproducibility checklist

**Gaps**:
- No guidance for AI agents on how to write tests (unit test patterns, mocking strategies, test fixtures)
- No guidance on code style, import order, or naming conventions
- No guidance on PR review criteria or quality gates

## Recommendations

### Priority 0 (Critical — Do First)

1. **Create CI/CD Pipeline** (4-8 hours)
   - Add `.github/workflows/ci.yml` with pytest, ruff lint, and type checking
   - Gate all PRs on CI passing
   - Add branch protection rules

2. **Add Coverage Tracking** (2-4 hours)
   - Add `pytest-cov` to dev dependencies
   - Integrate with codecov or coveralls
   - Set minimum coverage threshold (start at 15%, increase to 40%+ over time)

3. **Add Dependency Scanning** (1-2 hours)
   - Enable Dependabot or Renovate for automated dependency updates
   - Add `pip-audit` or Snyk to CI for vulnerability detection

### Priority 1 (High Value)

4. **Create Container Image** (4-8 hours)
   - Add Dockerfile with multi-stage build (build → runtime)
   - Add `.dockerignore`
   - Add image build to CI workflow

5. **Add Integration Tests** (8-16 hours)
   - Mock `oc_cli.run_oc` and K8s interactions
   - Test full supervisor pipeline with mocked Gemini responses
   - Test Streamlit app initialization
   - Target: raise test-to-code ratio to 0.3+

6. **Create `.claude/rules/` Test Guidance** (2-3 hours)
   - Add unit test patterns for validators and specialists
   - Add mocking strategies for LangChain tools and oc_cli
   - Document test fixture patterns

7. **Add Security Scanning** (2-4 hours)
   - Enable CodeQL for Python SAST
   - Add Gitleaks for secret detection in CI
   - Add Bandit for Python-specific security analysis

### Priority 2 (Nice-to-Have)

8. **Add Pre-commit Hooks** (1-2 hours)
   - ruff (lint + format), mypy, gitleaks

9. **Add E2E Test Infrastructure** (16-24 hours)
   - Set up Kind cluster in CI for KServe pipeline testing
   - Mock Gemini API responses for deterministic E2E runs

10. **Add API Contract Tests** (4-8 hours)
    - Test specialist tool interfaces (input/output shapes)
    - Validate `deployment_matrix.json` schema
    - Test HTML report generation with various matrix states

## Comparison to Gold Standards

| Dimension | model-runtimes-agent | odh-dashboard | notebooks | kserve |
|-----------|---------------------|---------------|-----------|--------|
| CI/CD Pipeline | None | Comprehensive (PR + periodic) | Multi-workflow | Extensive |
| Unit Tests | 5 files, 0.12 ratio | Hundreds, high ratio | Image-specific | Broad coverage |
| Integration/E2E | None in CI | Multi-layer | 5-layer validation | Multi-version |
| Coverage | None | Codecov enforced | Tracked | Enforced thresholds |
| Container Image | None | Multi-stage builds | Specialized images | Published images |
| Security Scanning | None (but good app-level patterns) | Trivy + CodeQL | Vulnerability scanning | Full scanning |
| Linting | None | ESLint + strict TS | Per-image | golangci-lint |
| Agent Rules | AGENTS.md only | Comprehensive `.claude/` | None | None |

## File Paths Reference

### Repository Structure
```
model-runtimes-agent/
├── app.py                          # Streamlit UI (2,041 lines)
├── pyproject.toml                  # Project config, dependencies
├── AGENTS.md                       # Specialist behavior documentation
├── README.md                       # Installation and usage docs
├── sample_modelcar_config.yaml     # Example model-car config
├── src/runtimes_dep_agent/
│   ├── execute_agent.py            # CLI entrypoint
│   ├── preflight.py                # Pre-flight dependency checks
│   ├── agent/
│   │   ├── llm_agent.py            # Supervisor agent (LangGraph)
│   │   └── specialists/            # Config, Accelerator, Decision, QA
│   ├── config/model_config.py      # YAML + skopeo helpers
│   ├── qa_kserve/                  # KServe QA pipeline
│   │   ├── pipeline.py             # Main QA orchestrator (789 lines)
│   │   ├── render.py               # Template rendering
│   │   ├── post_deploy.py          # Smoke inference, SSRF blocking
│   │   ├── oc_cli.py               # Allowlisted oc wrapper
│   │   ├── heuristics.py           # Pod/log classification
│   │   └── remediation_llm.py      # LLM-driven failure remediation
│   ├── validators/                 # Deterministic validators
│   │   ├── deployability_engine.py # GPU/quantization deploy decisions
│   │   ├── deployability_reconcile.py # FP8 reconciliation
│   │   ├── accelerator_validator.py   # GPU discovery
│   │   └── matrix_prose_sync.py    # Matrix-prose alignment
│   └── report/html_report.py       # HTML report generator
├── tests/
│   ├── test_qa_kserve.py           # QA helper tests (373 lines)
│   ├── test_deployability_engine.py # Deploy engine tests (109 lines)
│   ├── test_deployability_reconcile.py # Reconciliation tests (93 lines)
│   ├── test_html_report_narrative.py   # Report tests (95 lines)
│   └── test_decision_fit.py        # Decision fit tests (47 lines)
├── deployment-yamls/               # KServe manifest templates
└── info/                           # Runtime artifacts
```

### Key Missing Files
- `.github/workflows/*.yml` — No CI/CD
- `Dockerfile` / `Containerfile` — No container image
- `.codecov.yml` / `.coveragerc` — No coverage config
- `ruff.toml` / `mypy.ini` — No linting/type checking config
- `.pre-commit-config.yaml` — No pre-commit hooks
- `.claude/` directory — No agent rules for test creation
