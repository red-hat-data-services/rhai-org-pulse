---
repository: "ogx-ai/ogx-demos"
overall_score: 3.1
scorecard:
  - dimension: "Unit Tests"
    score: 1.0
    status: "No unit tests — only eval/integration scripts exist, no pytest or unittest usage"
  - dimension: "Integration/E2E"
    score: 4.0
    status: "Manual eval test harness with 1,100+ queries but no CI automation"
  - dimension: "Build Integration"
    score: 1.0
    status: "No PR-time build validation, no image builds in CI"
  - dimension: "Image Testing"
    score: 1.5
    status: "Single Dockerfile for MCP server, no runtime validation or scanning"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage generation, no codecov/coveralls, no thresholds"
  - dimension: "CI/CD Automation"
    score: 3.0
    status: "Single pre-commit workflow; no test, build, or release automation"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no test automation rules"
critical_gaps:
  - title: "No unit tests whatsoever"
    impact: "Regressions in demo code, utility functions, and shared modules go undetected"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "Eval tests not automated in CI"
    impact: "1,100+ eval queries exist but never run on PRs — tool call regressions can ship"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No coverage tracking"
    impact: "No visibility into which code paths are exercised, impossible to set quality gates"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container image scanning or runtime validation"
    impact: "Vulnerabilities in the MCP Dockerfile base image (python:3.11-slim) undetected"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No SAST, dependency scanning, or secret detection"
    impact: "Code and dependency vulnerabilities not caught before merge"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "Pre-commit hooks are minimal (3 basic checks)"
    impact: "No linting, type checking, or formatting enforcement"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add ruff linting to pre-commit and CI"
    effort: "1-2 hours"
    impact: "Catch style issues, unused imports, and basic bugs automatically"
  - title: "Add Trivy scanning for the MCP Dockerfile"
    effort: "1-2 hours"
    impact: "Detect known vulnerabilities in the python:3.11-slim base image"
  - title: "Add pytest with a smoke test suite for demo imports"
    effort: "2-3 hours"
    impact: "Ensure all 47 demo scripts at least import without errors"
  - title: "Wire up the eval test harness in CI (even a subset)"
    effort: "3-4 hours"
    impact: "Automated validation of tool call accuracy on every PR"
recommendations:
  priority_0:
    - "Add unit tests for shared utilities (utils.py, client_tools/) and eval test infrastructure"
    - "Automate the eval test harness in CI — run against a local mock or lightweight server"
    - "Add coverage tracking with pytest-cov and integrate codecov"
  priority_1:
    - "Add ruff linting and mypy type checking to pre-commit hooks and CI"
    - "Add Trivy container scanning for the MCP Dockerfile"
    - "Add CodeQL or Semgrep SAST scanning"
    - "Create agent rules (.claude/rules/) for test creation patterns"
  priority_2:
    - "Add Gitleaks or TruffleHog for secret detection in CI"
    - "Add multi-architecture builds for the MCP server image"
    - "Add a smoke test that exercises each demo module's import path"
    - "Add Dependabot or Renovate for dependency updates"
---

# Quality Analysis: ogx-ai/ogx-demos

## Executive Summary

- **Overall Score: 3.1/10**
- **Repository Type**: Python demo/example collection for the OGX AI platform
- **Primary Language**: Python (59 `.py` files, ~8,500 LOC)
- **Framework**: OGX client SDK + Llama Stack, FastAPI, Streamlit
- **License**: Apache 2.0

**Key Strengths**:
- Well-structured progressive demo collection (7 phases, 47+ demo scripts)
- Eval test infrastructure with 1,100+ curated tool-call queries across 6 query sets
- Kubernetes deployment manifests with Kustomize overlays (vLLM, MCP)
- Pre-commit hooks enforced in CI

**Critical Gaps**:
- Zero unit tests — no pytest, unittest, or any test framework usage
- Eval tests exist but are never run in CI
- No coverage tracking, no linting, no type checking
- No container scanning, SAST, or secret detection
- No agent rules or AI-assisted test creation guidance

**Agent Rules Status**: Missing — no `.claude/` directory, no `CLAUDE.md`, no test automation rules

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 1.0/10 | No unit tests — only manual eval scripts |
| Integration/E2E | 4.0/10 | Manual eval harness with 1,100+ queries but no CI automation |
| Build Integration | 1.0/10 | No PR-time build validation, no image builds in CI |
| Image Testing | 1.5/10 | Single Dockerfile, no runtime validation or scanning |
| Coverage Tracking | 0.0/10 | No coverage generation, no thresholds |
| CI/CD Automation | 3.0/10 | Only a pre-commit workflow; no test/build/release automation |
| Agent Rules | 0.0/10 | No agent rules or test automation guidance |

**Weighted Overall: 3.1/10**

## Critical Gaps

### 1. No Unit Tests (Severity: HIGH)
- **Impact**: Regressions in demo code, shared utilities (`demos/shared/utils.py`, `demos/client_tools/`), and eval infrastructure (`tests/eval_tests/utils.py`) go completely undetected
- **Current State**: Zero `*_test.py` files, no pytest configuration, no `[tool.pytest]` section in `pyproject.toml`
- **Effort**: 8-12 hours to create initial test suite
- **Gold Standard Gap**: odh-dashboard has 2,000+ unit tests; this repo has 0

### 2. Eval Tests Not Automated in CI (Severity: HIGH)
- **Impact**: 1,100+ carefully curated queries across 6 datasets (Ansible, GitHub, OpenShift, custom, client tools) exist in `tests/eval_tests/` but are only runnable manually. Tool call regressions can ship silently.
- **Current State**: `tests/eval_tests/tests.py` requires a running OGX server (`REMOTE_BASE_URL`) and MCP servers. No CI workflow runs these tests.
- **Effort**: 4-6 hours (could run a subset against mocked responses or a lightweight server in CI)

### 3. No Coverage Tracking (Severity: HIGH)
- **Impact**: No visibility into which code paths are exercised. Cannot set quality gates.
- **Current State**: No `.coveragerc`, no codecov integration, no `pytest-cov` in dependencies
- **Effort**: 2-4 hours

### 4. No Container Image Security Scanning (Severity: HIGH)
- **Impact**: The MCP server Dockerfile uses `python:3.11-slim` — vulnerabilities in the base image or pip dependencies are undetected
- **Current State**: Single `deployment/kubernetes/mcp-servers/math-mcp/Dockerfile` with no Trivy, Snyk, or any scanning
- **Effort**: 2-3 hours to add Trivy scanning workflow

### 5. No SAST or Dependency Scanning (Severity: MEDIUM)
- **Impact**: No CodeQL, Semgrep, Bandit, or any static analysis. Dependency vulnerabilities not tracked.
- **Effort**: 2-4 hours

### 6. Pre-commit Hooks Are Minimal (Severity: MEDIUM)
- **Impact**: Only 3 basic checks (trailing-whitespace, end-of-file-fixer, check-added-large-files). No linting (ruff), no type checking (mypy), no formatting enforcement (black/ruff format).
- **Effort**: 1-2 hours to add ruff + mypy

## Quick Wins

### 1. Add Ruff Linting to Pre-commit and CI (1-2 hours)
- **Impact**: Catch unused imports, style issues, and basic bugs automatically
- **Implementation**:
```yaml
# .pre-commit-config.yaml - add this repo
- repo: https://github.com/astral-sh/ruff-pre-commit
  rev: v0.8.0
  hooks:
    - id: ruff
      args: [--fix]
    - id: ruff-format
```

### 2. Add Trivy Container Scanning (1-2 hours)
- **Impact**: Detect known CVEs in the python:3.11-slim base image
- **Implementation**:
```yaml
# .github/workflows/trivy.yaml
name: Trivy Scan
on: [pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'HIGH,CRITICAL'
```

### 3. Add Pytest Smoke Tests for Demo Imports (2-3 hours)
- **Impact**: Ensure all 47 demo scripts at least import without errors
- **Implementation**:
```python
# tests/test_demo_imports.py
import importlib
import pytest

DEMO_MODULES = [
    "demos.01_foundations.01_client_setup",
    "demos.01_foundations.02_chat_completion",
    # ... all demo modules
]

@pytest.mark.parametrize("module", DEMO_MODULES)
def test_demo_imports(module):
    importlib.import_module(module)
```

### 4. Wire Up Eval Tests in CI (3-4 hours)
- **Impact**: Automated validation of tool call accuracy on every PR
- Run a subset of the 1,100+ queries against a mock or lightweight server

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory**:
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pre-commit.yaml` | PR to `main` | Run pre-commit hooks |

**Analysis**:
- Only **1 workflow** exists — `pre-commit.yaml`
- Runs on PRs to `main` only
- Uses `actions/checkout@v4`, `actions/setup-python@v3` (outdated — v5 is current), `pre-commit/action@v3.0.1`
- No concurrency control (multiple PRs could run simultaneously)
- No caching (no pip cache, no pre-commit cache)
- No test execution in CI at all
- No build or release workflows
- No image build or push workflows
- No dependency update automation (Dependabot/Renovate)

**Missing Workflows**:
- Test execution (pytest)
- Linting (ruff)
- Type checking (mypy)
- Container build & push
- Container scanning (Trivy)
- SAST (CodeQL/Semgrep)
- Release automation
- Dependency updates

### Test Coverage

**Unit Tests**: **None**
- Zero `*_test.py` files following pytest conventions
- No pytest configuration in `pyproject.toml`
- No testing framework in dependencies

**Eval/Integration Tests**: `tests/eval_tests/`
- `tests.py` (414 lines) — main test harness for MCP tool call evaluation
- `utils.py` (280 lines) — metrics collection, logging, plotting
- 6 query datasets totaling **1,139 queries**:
  - `client_tool_queries.json`: 630 queries
  - `client_tool_queries_bad_functions.json`: 480 queries
  - `ocp_queries.json`: 5 queries
  - `github_queries.json`: 13 queries
  - `ansible_queries.json`: 8 queries
  - `custom_queries.json`: 3 queries
- 4 tool definition variants for testing different function naming patterns
- Results visualization with matplotlib (saved as JPEG plots)
- Analysis notebooks: `tests_analysis.ipynb`, `tool_test_analysis.ipynb`

**Test Scripts**: `tests/scripts/`
- 4 manual test scripts for agent functionality
- `0_simple_agent.py`, `1_simple_agent_with_RAG.py`, `4_OCP_version_info_email.py`, `agent_with_mcp_ocp_slack.py`

**Test-to-Code Ratio**: ~0.23 (11 test files / 47 demo files) — but these are evaluation scripts, not true unit tests

**Coverage Tracking**: None — no `.coveragerc`, no codecov, no coverage generation

### Code Quality

**Linting**: None configured
- No `ruff.toml`, `.flake8`, or any Python linter configuration
- No type checking (no `mypy.ini`, no `[tool.mypy]` in pyproject.toml)

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- `trailing-whitespace` — removes trailing whitespace
- `end-of-file-fixer` — ensures files end with newline
- `check-added-large-files` — prevents large files
- **Missing**: ruff, mypy, black/ruff-format, bandit, detect-secrets

**Static Analysis**: None
- No CodeQL, Semgrep, or Bandit
- No dependency scanning
- No secret detection (no Gitleaks, no TruffleHog)

### Container Images

**Dockerfiles**: 1 (minimal)
- `deployment/kubernetes/mcp-servers/math-mcp/Dockerfile`
  - Base: `python:3.11-slim` (not pinned to digest)
  - Single-stage build
  - No multi-architecture support
  - No health check
  - No non-root user
  - Exposes port 8080
  - Runs as root (security concern)

**Makefile Build Targets**:
- `build_llamastack` — builds Llama Stack container with podman
- `build_mcp` — builds MCP server container
- `build_ui` — builds Streamlit UI container
- All use `podman` with `linux/amd64` only — no multi-arch

**Runtime Testing**: None
- No container startup validation
- No health check testing
- No Testcontainers or equivalent
- No integration testing of deployed containers

**Security Scanning**: None
- No Trivy, Snyk, or Grype
- No SBOM generation
- No image signing/attestation

### Security

| Practice | Status |
|----------|--------|
| Container Scanning | Not present |
| SAST/CodeQL | Not present |
| Dependency Scanning | Not present |
| Secret Detection | Not present |
| `.gitignore` for secrets | Partial — excludes `.env` and `*private-secret.yaml` |
| Base image pinning | Not present (uses tag, not digest) |
| Non-root container | Not present |

**Positive**: The `.gitignore` excludes `.env` files and private secrets. The `.env.example` provides a template without actual values.

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **`.claude/` directory**: Not present
- **`.claude/rules/`**: Not present
- **Test automation rules**: Not present
- **Coverage**: No test types have agent rules
- **Quality**: N/A
- **Gaps**: Everything is missing — no guidance for AI agents creating tests, reviewing code, or following patterns
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - Unit test patterns for OGX client utilities
  - Eval test patterns for tool call validation
  - Integration test patterns for demo scripts
  - Code style and documentation standards

## Recommendations

### Priority 0 (Critical)

1. **Add unit tests for shared utilities and eval infrastructure**
   - Create `tests/test_utils.py` for `demos/shared/utils.py`
   - Create `tests/test_eval_utils.py` for `tests/eval_tests/utils.py`
   - Create `tests/test_client_tools.py` for `demos/client_tools/`
   - Add `pytest` and `pytest-cov` to `pyproject.toml` dependencies
   - Effort: 8-12 hours

2. **Automate eval tests in CI**
   - Create `.github/workflows/tests.yaml` that runs the eval harness
   - Use a mock OGX server or run a subset of queries
   - At minimum, validate query file format and tool definitions
   - Effort: 4-6 hours

3. **Add coverage tracking**
   - Add `pytest-cov` to dependencies
   - Configure `.coveragerc` or `[tool.coverage]` in pyproject.toml
   - Integrate codecov and add PR coverage reporting
   - Set minimum coverage threshold (start at 30%, increase over time)
   - Effort: 2-4 hours

### Priority 1 (High Value)

4. **Add ruff linting and mypy type checking**
   - Add ruff to pre-commit hooks and CI
   - Add mypy with gradual typing (`--disallow-untyped-defs` per-module)
   - Add `[tool.ruff]` and `[tool.mypy]` sections to `pyproject.toml`
   - Effort: 2-3 hours

5. **Add Trivy container scanning**
   - Scan the MCP Dockerfile in CI
   - Set severity thresholds (fail on HIGH/CRITICAL)
   - Pin base image to digest for reproducibility
   - Add non-root user to Dockerfile
   - Effort: 2-3 hours

6. **Add CodeQL or Semgrep SAST**
   - Enable CodeQL for Python
   - Add `.github/workflows/codeql.yaml`
   - Effort: 1-2 hours

7. **Create agent rules (`.claude/rules/`)**
   - `unit-tests.md` — patterns for testing OGX utilities
   - `eval-tests.md` — patterns for creating eval query datasets
   - `code-style.md` — Python style conventions
   - Effort: 3-4 hours

### Priority 2 (Nice-to-Have)

8. **Add secret detection**
   - Add Gitleaks or TruffleHog to CI
   - Effort: 1-2 hours

9. **Add Dependabot/Renovate**
   - Auto-update Python dependencies
   - Auto-update GitHub Actions versions
   - Effort: 30 minutes

10. **Add multi-architecture container builds**
    - Build for both `linux/amd64` and `linux/arm64`
    - Effort: 2-3 hours

11. **Add demo smoke test workflow**
    - Import each demo module to verify no broken imports
    - Effort: 2-3 hours

12. **Add SBOM generation**
    - Use Syft or Trivy to generate SBOMs for container images
    - Effort: 1-2 hours

## Comparison to Gold Standards

| Dimension | ogx-demos | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | 0 tests | 2,000+ tests | 200+ tests | 500+ tests |
| Integration/E2E | Manual eval harness | Automated Cypress E2E | Automated notebooks | Automated E2E |
| Coverage Tracking | None | Codecov enforced | Coverage reports | Codecov enforced |
| CI Workflows | 1 (pre-commit only) | 15+ workflows | 10+ workflows | 20+ workflows |
| Container Scanning | None | Trivy + SBOM | Trivy + multi-arch | Trivy + signing |
| SAST | None | CodeQL | Bandit | CodeQL |
| Pre-commit Hooks | 3 basic checks | 10+ hooks (lint, type) | 8+ hooks | Comprehensive |
| Agent Rules | None | Comprehensive | Basic | None |
| Secret Detection | .gitignore only | Gitleaks in CI | Gitleaks | Gitleaks |
| Dependency Updates | None | Dependabot | Renovate | Dependabot |

## File Paths Reference

### CI/CD
- `.github/workflows/pre-commit.yaml` — sole CI workflow

### Testing
- `tests/eval_tests/tests.py` — main eval test harness
- `tests/eval_tests/utils.py` — metrics and plotting utilities
- `tests/eval_tests/queries/*.json` — 6 query datasets (1,139 total queries)
- `tests/eval_tests/tools/*.py` — 4 tool definition variants
- `tests/eval_tests/results/` — saved results and plots
- `tests/scripts/` — 4 manual agent test scripts

### Code Quality
- `.pre-commit-config.yaml` — 3 basic pre-commit hooks
- `pyproject.toml` — project config (no lint/test/coverage config)

### Container Images
- `deployment/kubernetes/mcp-servers/math-mcp/Dockerfile` — MCP server image

### Deployment
- `deployment/kubernetes/vllm-serve/` — vLLM server deployment (Kustomize)
- `deployment/kubernetes/llama-stack/` — Llama Stack CR
- `deployment/kubernetes/mcp-servers/` — MCP server deployment
- `Makefile` — container build targets (podman)

### Configuration
- `.env.example` — environment variable template
- `.gitignore` — excludes .env and private secrets
- `.gitmodules` — git submodule reference

### Documentation
- `README.md` — main documentation
- `DEMOS_STRUCTURE.md` — comprehensive demo structure plan
- `demos/*/` — 7 demo phases with 47+ Python scripts
