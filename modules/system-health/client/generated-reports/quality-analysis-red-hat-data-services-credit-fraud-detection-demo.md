---
repository: "red-hat-data-services/credit-fraud-detection-demo"
overall_score: 1.4
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No test files exist anywhere in the repository"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or end-to-end tests"
  - dimension: "Build Integration"
    score: 0.5
    status: "Two basic Dockerfiles present, no CI build validation"
  - dimension: "Image Testing"
    score: 0.5
    status: "Dockerfiles exist but no runtime validation, scanning, or multi-arch support"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling or reporting configured"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "No CI/CD pipelines of any kind (no GitHub Actions, GitLab CI, Jenkins, or Makefile)"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No CI/CD pipeline exists"
    impact: "Changes are merged without any automated validation — no tests, no linting, no build checks"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "Zero test coverage"
    impact: "No unit, integration, or E2E tests — regressions are invisible until runtime failures"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No container security scanning"
    impact: "Known vulnerabilities in base images and dependencies go undetected; outdated packages (TensorFlow 2.10, Gradio 3.13) may have CVEs"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Dockerfile security: containers run as root"
    impact: "No USER directive in either Dockerfile — containers run with root privileges, violating container security best practices"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "Dependencies partially unpinned and outdated"
    impact: "model/requirements.txt has 6/9 packages unpinned; all pinned versions are significantly outdated (TensorFlow 2.10 released Oct 2022, Gradio 3.13 released Dec 2022)"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No .dockerignore files"
    impact: "Build context includes unnecessary files (data CSV, images, .git) increasing build time and image size"
    severity: "MEDIUM"
    effort: "1 hour"
quick_wins:
  - title: "Add a basic GitHub Actions CI workflow with linting and Dockerfile build validation"
    effort: "2-4 hours"
    impact: "Catches syntax errors, broken imports, and Dockerfile build failures before merge"
  - title: "Add non-root USER to Dockerfiles"
    effort: "30 minutes"
    impact: "Eliminates running containers as root — a critical container security practice"
  - title: "Add .dockerignore files"
    effort: "30 minutes"
    impact: "Reduces build context size and prevents leaking unnecessary files into images"
  - title: "Pin all dependencies in model/requirements.txt"
    effort: "1 hour"
    impact: "Ensures reproducible builds and prevents surprise breakages from upstream updates"
  - title: "Add Trivy or Snyk scanning to CI"
    effort: "1-2 hours"
    impact: "Automatically detects known CVEs in base images and Python packages"
  - title: "Add basic unit tests for predict functions"
    effort: "2-3 hours"
    impact: "Validates prediction logic (threshold, input/output format) without requiring a running model server"
recommendations:
  priority_0:
    - "Create a GitHub Actions workflow with at minimum: Python linting (ruff/flake8), Dockerfile build validation, and dependency vulnerability scanning"
    - "Add unit tests for the predict() functions in both application variants — test the threshold logic, input validation, and error handling"
    - "Add non-root USER directives to both Dockerfiles and add .dockerignore files"
    - "Pin all dependencies to specific versions and update to current releases (TensorFlow 2.x latest, Gradio 4.x or 5.x, MLFlow 2.x latest)"
  priority_1:
    - "Add integration tests that validate the Gradio app starts and responds to health checks"
    - "Add Trivy container scanning to CI workflow"
    - "Add pre-commit hooks for Python linting and formatting"
    - "Add a Makefile with standard targets (lint, test, build, run)"
    - "Implement multi-stage Docker builds to reduce image size"
  priority_2:
    - "Add CLAUDE.md with repository context and contribution guidelines"
    - "Add notebook validation (nbval or papermill) to CI to ensure model.ipynb runs cleanly"
    - "Add SBOM generation for container images"
    - "Add multi-architecture (amd64/arm64) image builds"
    - "Consider adding model validation tests (accuracy thresholds, data schema checks)"
---

# Quality Analysis: credit-fraud-detection-demo

## Executive Summary
- Overall Score: 1.4/10
- Key Strengths: Clear tutorial documentation with step-by-step instructions; working Dockerfiles for two application variants; proper use of .gitignore to exclude sensitive files
- Critical Gaps: No CI/CD pipeline, zero test coverage, no security scanning, containers run as root, outdated and partially unpinned dependencies
- Agent Rules Status: Missing

This is a **demo/tutorial repository** for Credit Card Fraud Detection using MLFlow and Red Hat OpenShift Data Science (RHODS). It contains a Jupyter notebook for model training, two Gradio-based inference applications (RHODS Model Serving and MLFlow Serving variants), and a sample dataset. The repository has **no quality infrastructure** — no CI/CD, no tests, no linting, no security scanning, and no agent rules.

## Repository Profile
- **Type**: Demo / Tutorial application
- **Primary Language**: Python
- **Frameworks**: TensorFlow/Keras (ML), MLFlow (experiment tracking), Gradio (web UI), ONNX (model export)
- **Size**: 41 files, ~150 lines of application code
- **License**: GPL v3
- **Last Activity**: Repository appears to be in maintenance mode

## Quality Scorecard
| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0.0/10 | No test files exist anywhere in the repository |
| Integration/E2E | 0.0/10 | No integration or end-to-end tests |
| **Build Integration** | **0.5/10** | **Two basic Dockerfiles present, no CI build validation** |
| Image Testing | 0.5/10 | Dockerfiles exist but no runtime validation, scanning, or multi-arch support |
| Coverage Tracking | 0.0/10 | No coverage tooling or reporting configured |
| CI/CD Automation | 0.0/10 | No CI/CD pipelines of any kind |
| Agent Rules | 0.0/10 | No CLAUDE.md, AGENTS.md, or .claude/ directory |

## Critical Gaps

1. **No CI/CD pipeline exists**
   - Impact: Changes are merged without any automated validation — no tests, no linting, no build checks
   - Severity: HIGH
   - Effort: 4-8 hours
   - Details: No `.github/workflows/`, no `.gitlab-ci.yml`, no `Jenkinsfile`, no `Makefile`. PRs are merged on trust alone.

2. **Zero test coverage**
   - Impact: No unit, integration, or E2E tests — regressions are invisible until runtime failures
   - Severity: HIGH
   - Effort: 8-16 hours
   - Details: No `*_test.py`, `test_*.py`, `*_spec.py`, or `tests/` directory. The `predict()` functions in both application files are untested. The notebook has no validation.

3. **No container security scanning**
   - Impact: Known vulnerabilities in base images and dependencies go undetected
   - Severity: HIGH
   - Effort: 2-4 hours
   - Details: No Trivy, Snyk, or any scanning tool. Base image `python:3.10.4` is over 3 years old and likely has known CVEs. TensorFlow 2.10 (Oct 2022) has known security advisories.

4. **Dockerfile security: containers run as root**
   - Impact: No USER directive in either Dockerfile — containers run with root privileges
   - Severity: HIGH
   - Effort: 1-2 hours
   - Details: Both `application/Dockerfile` and `application_mlflow_serving/Dockerfile` lack a `USER` directive. They also use `/tmp` as WORKDIR, which is unconventional and can conflict with system temp files.

5. **Dependencies partially unpinned and significantly outdated**
   - Impact: Non-reproducible builds; potential security vulnerabilities in old packages
   - Severity: MEDIUM
   - Effort: 2-4 hours
   - Details: `model/requirements.txt` has 6 of 9 packages unpinned (`numpy`, `pandas`, `matplotlib`, `sklearn`, `seaborn`, `mlflow`, `tf2onnx`, `onnxruntime`). All pinned versions are 2+ years old: TensorFlow 2.10 (Oct 2022), Gradio 3.13 (Dec 2022), MLFlow 2.0.1 (Dec 2022), NumPy 1.23.5 (Nov 2022).

6. **No .dockerignore files**
   - Impact: Build context includes unnecessary files — `data/card_transdata.csv` (sample data), `img/` directory (30 PNG files), `.git/` directory
   - Severity: MEDIUM
   - Effort: 1 hour

## Quick Wins

1. **Add a basic GitHub Actions CI workflow** (2-4 hours)
   - Impact: Catches syntax errors, broken imports, and Dockerfile build failures before merge
   - Implementation:
   ```yaml
   # .github/workflows/ci.yml
   name: CI
   on: [push, pull_request]
   jobs:
     lint:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-python@v5
           with:
             python-version: '3.10'
         - run: pip install ruff
         - run: ruff check application/ application_mlflow_serving/
     build:
       runs-on: ubuntu-latest
       strategy:
         matrix:
           app: [application, application_mlflow_serving]
       steps:
         - uses: actions/checkout@v4
         - run: docker build -t test-${{ matrix.app }} ${{ matrix.app }}/
   ```

2. **Add non-root USER to Dockerfiles** (30 minutes)
   - Impact: Eliminates running containers as root
   - Implementation:
   ```dockerfile
   RUN useradd -m appuser
   USER appuser
   WORKDIR /home/appuser
   ```

3. **Add .dockerignore files** (30 minutes)
   - Impact: Reduces build context size significantly
   - Implementation:
   ```
   # .dockerignore (root level)
   .git
   data/
   img/
   model/
   *.md
   LICENSE
   ```

4. **Pin all dependencies in model/requirements.txt** (1 hour)
   - Impact: Ensures reproducible notebook execution
   - Run `pip freeze` in a working environment and capture exact versions

5. **Add Trivy scanning to CI** (1-2 hours)
   - Impact: Automatically detects known CVEs
   - Implementation:
   ```yaml
   - name: Run Trivy
     uses: aquasecurity/trivy-action@master
     with:
       image-ref: 'test-${{ matrix.app }}'
       severity: 'CRITICAL,HIGH'
   ```

6. **Add basic unit tests for predict functions** (2-3 hours)
   - Impact: Validates prediction logic without requiring a running model server
   - Implementation:
   ```python
   # tests/test_predict.py
   import pytest
   from unittest.mock import patch, MagicMock

   def test_predict_returns_fraud_above_threshold():
       with patch('requests.post') as mock_post:
           mock_post.return_value.json.return_value = {
               'outputs': [{'data': [0.999]}]
           }
           # Import and test predict function
           # Should return "Fraud" for values >= 0.995

   def test_predict_returns_not_fraud_below_threshold():
       with patch('requests.post') as mock_post:
           mock_post.return_value.json.return_value = {
               'outputs': [{'data': [0.5]}]
           }
           # Should return "Not fraud" for values < 0.995
   ```

## Detailed Findings

### CI/CD Pipeline
**Status: Non-existent**

No CI/CD configuration was found anywhere in the repository:
- No `.github/workflows/` directory
- No `.gitlab-ci.yml`
- No `Jenkinsfile`
- No `Makefile`
- No build scripts

This means:
- No automated linting or formatting checks
- No automated testing
- No Docker image build validation
- No dependency vulnerability checking
- No notebook validation

### Test Coverage
**Status: Zero coverage**

No test files of any type were found:
- No `*_test.py` or `test_*.py` files
- No `tests/` or `test/` directories
- No `pytest.ini`, `setup.cfg`, or `pyproject.toml` with test configuration
- No `tox.ini`
- No coverage configuration (`.coveragerc`, `codecov.yml`)

**Untested code paths:**
- `application/model_application.py:predict()` — constructs inference payload and parses response; threshold logic at 0.995
- `application_mlflow_serving/model_application_mlflow_serve.py:predict()` — loads model from MLFlow and runs prediction
- Gradio interface initialization and configuration
- Error handling (none exists — `response.json()['outputs'][0]['data'][0]` will crash on non-200 responses)

### Code Quality
**Status: No tooling**

- No linting configuration (no ruff, flake8, pylint, mypy)
- No pre-commit hooks
- No code formatting (no black, isort)
- No type hints in any Python file
- No static analysis tools (no CodeQL, bandit, semgrep)
- No editor configuration (.editorconfig)

**Code quality observations:**
- Application code is clean and readable (~50 lines each)
- No input validation on the predict function parameters
- No error handling for failed API responses
- Hardcoded model name and version (`"DNN-credit-card-fraud"`, version `1`)
- Environment variables accessed without defaults or validation (`os.getenv()` returns None if unset, `int(None)` would crash)

### Container Images
**Status: Minimal**

Two Dockerfiles found:
- `application/Dockerfile` — Gradio app calling RHODS Model Serving
- `application_mlflow_serving/Dockerfile` — Gradio app calling MLFlow directly

**Issues identified:**
| Issue | Severity | Details |
|-------|----------|---------|
| Running as root | HIGH | No `USER` directive in either Dockerfile |
| Outdated base image | HIGH | `python:3.10.4` is from April 2022; current is 3.10.x or 3.12.x |
| No multi-stage build | MEDIUM | Full Python image (~1GB) used instead of slim variant |
| WORKDIR /tmp | LOW | Unconventional; may conflict with system temp file usage |
| No health check | LOW | No HEALTHCHECK directive for container orchestration |
| No .dockerignore | MEDIUM | Build context includes data, images, and .git |

**No container testing:**
- No image startup validation
- No Trivy/Snyk scanning
- No SBOM generation
- No image signing
- No multi-architecture support

### Security
**Status: Minimal**

**Positive findings:**
- `.gitignore` excludes `.env` files (prevents secret leakage)
- No hardcoded secrets in code

**Negative findings:**
- No SAST/DAST tools
- No dependency scanning (Dependabot, Snyk, etc.)
- No secret detection (Gitleaks, TruffleHog)
- No container scanning
- `sklearn` import is deprecated — should use `scikit-learn`
- No input validation on inference endpoint (potential for injection via malicious payload)
- INFERENCE_ENDPOINT from environment variable used directly in `requests.post()` without validation (SSRF risk)

### Agent Rules (Agentic Flow Quality)
**Status: Missing**

- No `CLAUDE.md` in repository root
- No `AGENTS.md`
- No `.claude/` directory
- No `.claude/rules/` test creation rules
- No `.claude/skills/` custom skills
- No testing documentation in `docs/`

**Recommendation:** Generate test creation rules using `/test-rules-generator` to establish:
- Unit test patterns for Python ML applications
- Gradio application testing patterns
- MLFlow integration test patterns
- Notebook validation patterns

## Recommendations

### Priority 0 (Critical)
- Create a GitHub Actions workflow with at minimum: Python linting (ruff/flake8), Dockerfile build validation, and dependency vulnerability scanning
- Add unit tests for the `predict()` functions in both application variants — test the threshold logic, input validation, and error handling
- Add non-root USER directives to both Dockerfiles and add .dockerignore files
- Pin all dependencies to specific versions and update to current releases (TensorFlow 2.x latest, Gradio 4.x or 5.x, MLFlow 2.x latest)

### Priority 1 (High Value)
- Add integration tests that validate the Gradio app starts and responds to health checks
- Add Trivy container scanning to CI workflow
- Add pre-commit hooks for Python linting and formatting
- Add a Makefile with standard targets (lint, test, build, run)
- Implement multi-stage Docker builds to reduce image size
- Add input validation and error handling to predict functions

### Priority 2 (Nice-to-Have)
- Add CLAUDE.md with repository context and contribution guidelines
- Add notebook validation (nbval or papermill) to CI to ensure model.ipynb runs cleanly
- Add SBOM generation for container images
- Add multi-architecture (amd64/arm64) image builds
- Consider adding model validation tests (accuracy thresholds, data schema checks)
- Add type hints to Python code
- Replace deprecated `sklearn` import with `scikit-learn`

## Comparison to Gold Standards

| Capability | credit-fraud-detection-demo | odh-dashboard | notebooks | kserve |
|---|---|---|---|---|
| CI/CD Pipeline | None | Multi-workflow | Comprehensive | Extensive |
| Unit Tests | None | Jest + Go testing | Python tests | Go testing |
| Integration Tests | None | Cypress E2E | Image validation | envtest |
| Coverage Tracking | None | Codecov + thresholds | Per-image | Codecov |
| Container Scanning | None | Trivy + Snyk | Trivy | Trivy |
| Multi-arch Builds | None | Yes | Yes | Yes |
| Pre-commit Hooks | None | ESLint + Prettier | Yes | golangci-lint |
| Agent Rules | None | Comprehensive .claude/ | Partial | None |
| Dependency Pinning | Partial | Full (lockfile) | Full | go.mod |
| Non-root Container | No | Yes | Yes | Yes |

## File Paths Reference

### Application Code
- `application/model_application.py` — Gradio app using RHODS Model Serving
- `application_mlflow_serving/model_application_mlflow_serve.py` — Gradio app using MLFlow serving

### Container Images
- `application/Dockerfile` — RHODS serving variant
- `application_mlflow_serving/Dockerfile` — MLFlow serving variant

### Dependencies
- `application/requirements.txt` — App dependencies (mostly pinned)
- `application_mlflow_serving/requirements.txt` — App dependencies (mostly pinned)
- `model/requirements.txt` — Notebook dependencies (partially unpinned)

### Data & Model
- `data/card_transdata.csv` — Training dataset
- `model/model.ipynb` — Model training notebook (20 cells, Python 3.9 kernel)

### Configuration
- `.gitignore` — Excludes flagged/, mlruns/, mlflow.db, .env
- `LICENSE` — GPL v3
