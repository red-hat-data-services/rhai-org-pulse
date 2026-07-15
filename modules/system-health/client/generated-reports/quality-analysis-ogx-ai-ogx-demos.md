---
repository: "ogx-ai/ogx-demos"
overall_score: 3.6
scorecard:
  - dimension: "Unit Tests"
    score: 1.0
    status: "No unit test framework configured; no pytest, unittest, or test runner"
  - dimension: "Integration/E2E"
    score: 4.0
    status: "Shell-based demo runner and MCP eval tests exist but require live server"
  - dimension: "Build Integration"
    score: 1.0
    status: "No PR-time build validation; single Dockerfile has no CI build step"
  - dimension: "Image Testing"
    score: 1.0
    status: "Single Dockerfile for math-mcp with no build testing, scanning, or runtime validation"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tool configured; no codecov, coveralls, or .coveragerc"
  - dimension: "CI/CD Automation"
    score: 3.0
    status: "Single pre-commit workflow on PRs; no test, build, or deploy workflows"
  - dimension: "Agent Rules"
    score: 5.0
    status: "CLAUDE.md present with good project context but no .claude/rules/ for test patterns"
critical_gaps:
  - title: "No unit test framework or test suite"
    impact: "Code changes cannot be validated automatically; regressions go undetected"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No automated test execution in CI"
    impact: "PRs merge without any test validation beyond linting"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No coverage tracking"
    impact: "No visibility into what code is tested; no enforcement of quality thresholds"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No container image build or scan in CI"
    impact: "Dockerfile issues and vulnerabilities discovered only in production"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No security scanning (SAST, dependency, secrets)"
    impact: "Vulnerabilities in dependencies and code go undetected"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add pytest with basic demo validation tests"
    effort: "3-4 hours"
    impact: "Establish a test runner and validate demo structure, imports, and syntax programmatically"
  - title: "Add a CI workflow that runs tests on PRs"
    effort: "1-2 hours"
    impact: "Prevent broken demos from being merged; catch import errors and syntax issues"
  - title: "Add Trivy or Snyk scanning to CI"
    effort: "1-2 hours"
    impact: "Catch known vulnerabilities in Python dependencies automatically"
  - title: "Add codecov integration"
    effort: "1-2 hours"
    impact: "Track coverage trends and enforce minimum thresholds on PRs"
  - title: "Create .claude/rules/ for test patterns"
    effort: "2-3 hours"
    impact: "Guide AI agents to generate consistent, high-quality tests"
recommendations:
  priority_0:
    - "Add pytest framework with test discovery and a CI workflow to run tests on PRs"
    - "Create unit tests for shared utilities (demos/shared/utils.py, scripts/validate_demos.py)"
    - "Add coverage tracking with codecov and enforce a minimum threshold (e.g. 50%)"
  priority_1:
    - "Add security scanning (Trivy for dependencies, CodeQL or Bandit for SAST)"
    - "Add a CI step to validate all demo files can be imported without errors"
    - "Build and scan the math-mcp Dockerfile in CI"
    - "Create .claude/rules/ with test creation guidelines for unit and integration tests"
  priority_2:
    - "Add integration test workflow that spins up OGX and runs test_all_demos.sh"
    - "Add type checking with mypy or pyright"
    - "Add Kubernetes manifest validation (kubeconform/kubeval) in CI"
    - "Create end-to-end test for Kubernetes deployment with Kind"
---

# Quality Analysis: ogx-ai/ogx-demos

## Executive Summary

- **Overall Score: 3.6/10**
- **Repository Type**: Python demo collection / SDK showcase for OGX AI platform
- **Primary Language**: Python 3.12+
- **Package Manager**: uv
- **Key Strengths**: Good code quality tooling (Ruff + pre-commit), well-structured CLAUDE.md, thoughtful demo validation script, comprehensive demo organization
- **Critical Gaps**: No unit test framework, no test execution in CI, no coverage tracking, no security scanning, no container image validation
- **Agent Rules Status**: Partial (CLAUDE.md present, no .claude/rules/)

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 1/10 | No test framework; no pytest/unittest configured |
| Integration/E2E | 4/10 | Shell-based demo runner exists but not in CI |
| **Build Integration** | **1/10** | **No PR-time build validation for Dockerfile** |
| Image Testing | 1/10 | Single Dockerfile with no build/scan/runtime testing |
| Coverage Tracking | 0/10 | No coverage tool configured |
| CI/CD Automation | 3/10 | Pre-commit only; no test/build/deploy workflows |
| Agent Rules | 5/10 | CLAUDE.md exists with project context; no test rules |

## Critical Gaps

### 1. No Unit Test Framework or Test Suite
- **Impact**: Code changes to shared utilities, demo infrastructure, and validation scripts cannot be validated automatically. Regressions in `demos/shared/utils.py` or `scripts/validate_demos.py` go undetected.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The `pyproject.toml` has no `[tool.pytest]` section, no `pytest` in dependencies, and no `conftest.py`. The `tests/` directory contains only standalone scripts and eval notebooks — no actual unit tests.

### 2. No Automated Test Execution in CI
- **Impact**: PRs merge with only linting validation. The existing `test_all_demos.sh` script and `tests/eval_tests/tests.py` never run in CI.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The single GitHub Actions workflow (`.github/workflows/pre-commit.yaml`) only runs pre-commit hooks (trailing whitespace, Ruff linting, demo structure validation). No workflow runs any tests.

### 3. No Coverage Tracking
- **Impact**: Zero visibility into what percentage of code is exercised by tests. No enforcement mechanism to prevent coverage regression.
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: No `.coveragerc`, no `codecov.yml`, no coverage-related dependencies. Even if tests existed, there's no infrastructure to measure or report coverage.

### 4. No Container Image Build or Scan in CI
- **Impact**: The `deployment/kubernetes/mcp-servers/math-mcp/Dockerfile` is never built or validated in CI. Image issues are discovered only during manual deployment.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: The Dockerfile uses `python:3.11-slim` base but the project requires Python 3.12+ — this version mismatch would be caught by a CI build step.

### 5. No Security Scanning
- **Impact**: No SAST, dependency scanning, or secret detection. Vulnerabilities in the 15+ Python dependencies (including `openai`, `fastapi`, `streamlit`, `yfinance`) go undetected.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: No Trivy, Snyk, CodeQL, Bandit, or Gitleaks configuration found. The `.env.example` documents API keys but there's no automated secret detection to prevent accidental commits.

## Quick Wins

### 1. Add pytest with Basic Demo Validation Tests (3-4 hours)
- **Impact**: Establish a test runner that validates demo structure, imports, and basic functionality
- **Implementation**:
```bash
# Add to pyproject.toml
[project.optional-dependencies]
dev = ["pytest>=8.0", "pytest-cov>=5.0"]

[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
```

```python
# tests/test_demo_structure.py
import importlib
import pytest
from pathlib import Path

DEMO_DIR = Path("demos")

def get_demo_modules():
    """Discover all demo Python modules."""
    modules = []
    for phase_dir in sorted(DEMO_DIR.iterdir()):
        if not phase_dir.is_dir() or phase_dir.name.startswith("_"):
            continue
        for py_file in sorted(phase_dir.glob("[0-9]*.py")):
            module = str(py_file).replace("/", ".").replace(".py", "")
            modules.append(module)
    return modules

@pytest.mark.parametrize("module", get_demo_modules())
def test_demo_imports(module):
    """Verify each demo can be imported without errors."""
    importlib.import_module(module)
```

### 2. Add CI Workflow for Tests (1-2 hours)
- **Impact**: Run tests on every PR, catching breakage before merge
- **Implementation**:
```yaml
# .github/workflows/tests.yaml
name: Tests
on:
  pull_request:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: uv sync --extra dev
      - run: uv run pytest tests/ --tb=short -q
```

### 3. Add Trivy Dependency Scanning (1-2 hours)
- **Impact**: Catch known CVEs in Python dependencies
- **Implementation**:
```yaml
# .github/workflows/security.yaml
name: Security
on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'
jobs:
  trivy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          scan-ref: .
          severity: CRITICAL,HIGH
```

### 4. Add Codecov Integration (1-2 hours)
- **Impact**: Track test coverage trends and enforce minimum thresholds
- **Implementation**:
```yaml
# codecov.yml
coverage:
  status:
    project:
      default:
        target: 50%
    patch:
      default:
        target: 80%
```

### 5. Create .claude/rules/ for Test Patterns (2-3 hours)
- **Impact**: Guide AI agents to generate consistent, high-quality tests aligned with project conventions
- **Implementation**: Use `/test-rules-generator` to analyze existing patterns and generate rules

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory:**
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pre-commit.yaml` | PR to main | Run pre-commit hooks (Ruff, trailing whitespace, YAML/JSON validation, demo structure) |

**Assessment:**
- Only 1 workflow — pre-commit linting
- No test execution workflow
- No build workflow
- No deploy workflow
- No concurrency control (not needed with single workflow)
- No caching configured
- No periodic jobs (e.g., security scanning)

**Makefile Targets:**
The Makefile contains only container build/run targets (`build_llamastack`, `build_mcp`, `build_ui`, `run_ui`, `run_mcp`, `setup_local`). No test targets, no lint targets, no CI-relevant targets.

### Test Coverage

**Test-to-Code Ratio:** 11 test files / 51 source files = **0.22** (low; target is 0.5-1.0)

**Existing Test Infrastructure:**
1. **`tests/test_all_demos.sh`** — Comprehensive shell script that runs all demos against a live OGX server. Good design with timeout handling, skip conditions, colored output, and summary reporting. However, requires a running server and is never executed in CI.

2. **`tests/eval_tests/tests.py`** — MCP tool-calling evaluation harness that tests agent tool selection accuracy across multiple MCP servers (Ansible, GitHub, OpenShift, custom). Requires live server and MCP endpoints. Includes metrics collection and plot generation.

3. **`tests/eval_tests/` notebooks** — Jupyter notebooks for analyzing test results. Not automated.

4. **`scripts/validate_demos.py`** — AST-based structural validator (checks docstrings, `main()` function, `fire.Fire()` usage, file naming). Runs in pre-commit but NOT as a test suite.

**Missing:**
- No pytest framework
- No unit tests for `demos/shared/utils.py` (model resolution, document helpers)
- No unit tests for `scripts/validate_demos.py` itself
- No mock-based tests that work without a live server
- No property-based testing
- No snapshot testing for demo outputs

### Code Quality

**Linting (Strong):**
- **Ruff** configured in `pyproject.toml` with 7 rule categories (E, W, F, I, UP, B, SIM)
- Line length: 120 characters
- Target version: Python 3.12
- Isort configured with first-party packages
- Excludes eval directories appropriately

**Pre-commit Hooks (Good):**
- Standard hooks: trailing-whitespace, end-of-file-fixer, check-added-large-files (500kb), check-yaml, check-json, check-merge-conflict, debug-statements
- Ruff linting with auto-fix
- Ruff formatting
- Custom demo structure validation hook

**Missing:**
- No type checking (mypy, pyright, pytype)
- No Bandit or other Python SAST tool
- No secret detection (Gitleaks, TruffleHog)
- No complexity analysis

### Container Images

**Inventory:**
- 1 Dockerfile: `deployment/kubernetes/mcp-servers/math-mcp/Dockerfile`
  - Base image: `python:3.11-slim` (note: project requires Python 3.12+, version mismatch)
  - Single-stage build
  - No multi-architecture support
  - No health check
  - No non-root user
  - No SBOM generation

**Makefile References (not Dockerfiles):**
- `build_llamastack` — uses `llama stack build` (external tool)
- `build_mcp` — podman build (references `build_mcp` directory, not the k8s Dockerfile)
- `build_ui` — Streamlit container build

**Missing:**
- No CI build step for any container
- No vulnerability scanning (Trivy, Snyk)
- No image signing or attestation
- No runtime validation tests
- No `.dockerignore` for the math-mcp service

### Security

**Current State:**
- `.env.example` documents API keys properly
- `.gitignore` excludes `.env` and private secrets
- Pre-commit checks for large files (may catch accidental binary commits)

**Missing:**
- No SAST tool (CodeQL, Bandit, Semgrep)
- No dependency scanning (pip-audit, Safety, Trivy)
- No secret detection (Gitleaks, TruffleHog, detect-secrets)
- No security-focused CI workflow
- No `SECURITY.md` or vulnerability disclosure policy
- Dockerfile runs as root
- No pinned dependencies in Dockerfile requirements.txt

### Agent Rules (Agentic Flow Quality)

**Status**: Partial

**What Exists:**
- `CLAUDE.md` at repo root — **Good quality**. Covers project overview, development setup, running demos, key libraries, architecture, two client patterns, API routes, test infrastructure, CI, environment variables, and deployment. This gives AI agents solid context for working in the repo.

**What's Missing:**
- No `.claude/` directory
- No `.claude/rules/` with test creation rules
- No `.claude/skills/` with custom skills
- No `AGENTS.md`
- No test pattern documentation for AI agents
- No coding style rules for AI-generated code

**Recommendation**: Run `/test-rules-generator` to create `.claude/rules/` with:
- `unit-tests.md` — pytest patterns for testing shared utilities
- `integration-tests.md` — patterns for testing demos against mock servers
- `demo-structure.md` — conventions for new demo files

## Recommendations

### Priority 0 (Critical)

1. **Add pytest framework with test discovery**
   - Install pytest + pytest-cov as dev dependencies
   - Create `tests/test_demo_structure.py` to validate all demos can import
   - Create `tests/test_validate_demos.py` to unit-test the validation script
   - Create `tests/test_shared_utils.py` to test model resolution and document helpers

2. **Add CI workflow for running tests on PRs**
   - New `.github/workflows/tests.yaml` workflow
   - Use `astral-sh/setup-uv` for fast dependency installation
   - Run pytest with coverage reporting
   - Fail PR if tests fail

3. **Add coverage tracking with codecov**
   - Configure `pytest-cov` to generate coverage reports
   - Add `codecov.yml` with project and patch targets
   - Upload coverage in CI workflow
   - Add coverage badge to README

### Priority 1 (High Value)

4. **Add security scanning**
   - Add Trivy for Python dependency scanning
   - Add Bandit for Python SAST
   - Add Gitleaks for secret detection
   - Create `.github/workflows/security.yaml`

5. **Add demo import validation in CI**
   - Validate all demo files can be imported without a live server
   - Catch missing dependencies and import errors early

6. **Build and scan math-mcp Dockerfile in CI**
   - Add a workflow step to build the Dockerfile
   - Fix Python version mismatch (3.11 in Dockerfile vs 3.12 project requirement)
   - Add Trivy container scanning
   - Add non-root user to Dockerfile

7. **Create .claude/rules/ for test automation**
   - Generate rules for pytest conventions
   - Document mock patterns for testing without live OGX server
   - Include demo structure validation rules

### Priority 2 (Nice-to-Have)

8. **Add type checking with mypy or pyright**
   - Configure in `pyproject.toml`
   - Add to pre-commit hooks
   - Gradually type-annotate shared utilities

9. **Add Kubernetes manifest validation**
   - Use kubeconform or kubeval in CI
   - Validate all YAML in `deployment/kubernetes/`
   - Check kustomize overlays build correctly

10. **Create integration test workflow with Kind**
    - Spin up Kind cluster in CI
    - Deploy OGX + vLLM
    - Run `test_all_demos.sh`
    - Tear down on completion

11. **Add pre-commit hook for secret detection**
    - Add `gitleaks` or `detect-secrets` to `.pre-commit-config.yaml`
    - Prevent accidental API key commits

## Comparison to Gold Standards

| Dimension | ogx-demos | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | 1/10 | 9/10 | 6/10 | 9/10 |
| Integration/E2E | 4/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 1/10 | 8/10 | 7/10 | 8/10 |
| Image Testing | 1/10 | 7/10 | 10/10 | 7/10 |
| Coverage Tracking | 0/10 | 9/10 | 5/10 | 9/10 |
| CI/CD Automation | 3/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 5/10 | 8/10 | 3/10 | 2/10 |
| **Overall** | **3.6/10** | **8.5/10** | **7.0/10** | **8.0/10** |

**Key Gaps vs Gold Standards:**
- **odh-dashboard**: Has multi-layer testing (unit, integration, E2E with Cypress), contract tests, comprehensive CI/CD with 10+ workflows, codecov integration with enforcement, and comprehensive `.claude/rules/`
- **notebooks**: Has 5-layer image validation, multi-architecture builds, Trivy scanning, and automated image testing
- **kserve**: Has envtest for controller testing, multi-version E2E, codecov enforcement at 70%+, and 20+ CI workflows

## File Paths Reference

### CI/CD
- `.github/workflows/pre-commit.yaml` — Only CI workflow (pre-commit hooks)

### Testing
- `tests/test_all_demos.sh` — Shell-based demo runner (requires live server)
- `tests/eval_tests/tests.py` — MCP tool-calling evaluation harness
- `tests/eval_tests/utils.py` — Test utilities and metrics collection
- `tests/eval_tests/queries/` — JSON query files for eval tests
- `tests/scripts/` — Standalone integration scripts

### Code Quality
- `pyproject.toml` — Ruff configuration (linting + formatting)
- `.pre-commit-config.yaml` — Pre-commit hooks (Ruff, standard hooks, demo validation)
- `scripts/validate_demos.py` — AST-based demo structure validator

### Container Images
- `deployment/kubernetes/mcp-servers/math-mcp/Dockerfile` — Math MCP server container

### Agent Rules
- `CLAUDE.md` — Project context for AI agents (good quality)

### Deployment
- `deployment/kubernetes/` — Kind cluster deployment manifests
- `deployment/kubernetes/vllm-serve/` — vLLM model server (Kustomize with arch overlays)
- `deployment/kubernetes/ogx/` — OGX server custom resource
- `deployment/kubernetes/mcp-servers/math-mcp/` — MCP server deployment

### Key Source Files
- `demos/shared/utils.py` — Shared utilities (model resolution, document helpers)
- `demos/client_tools/` — Custom tool implementations
- `demos/01_foundations/` through `demos/06_openai_compatibility/` — Demo scripts
