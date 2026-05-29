---
repository: "trustyai-explainability/guardrails-detectors"
overall_score: 5.2
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Good test-to-code ratio (1.41:1) with 16 test files across all 3 detector modules"
  - dimension: "Integration/E2E"
    score: 5.0
    status: "FastAPI TestClient integration tests exist but no true E2E or multi-service testing"
  - dimension: "Build Integration"
    score: 2.0
    status: "No PR-time image builds, no Konflux simulation, no deployment testing"
  - dimension: "Image Testing"
    score: 3.0
    status: "Multi-stage Dockerfiles with multi-arch support but no image build or runtime validation in CI"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "pytest-cov generates terminal reports but no codecov integration or enforcement"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "Well-organized per-component workflows with shared actions and pip caching"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory exists"
critical_gaps:
  - title: "No container image build or test in CI"
    impact: "Dockerfile regressions (broken builds, missing deps, startup failures) are undetectable until post-merge or deployment"
    severity: "HIGH"
    effort: "6-8 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Coverage can silently degrade without any visibility; no PR-level coverage gates"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No pre-commit configuration"
    impact: "Linting, formatting, and static analysis are not enforced despite pre-commit being in dev requirements"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No dependency update automation"
    impact: "Vulnerable dependencies remain unpatched; no Dependabot or Renovate bot configured"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No E2E or contract tests"
    impact: "No verification that detectors work correctly when deployed as KServe InferenceServices"
    severity: "MEDIUM"
    effort: "16-24 hours"
quick_wins:
  - title: "Add codecov integration with coverage thresholds"
    effort: "2-4 hours"
    impact: "Immediate visibility into coverage trends; prevent coverage regression on PRs"
  - title: "Create .pre-commit-config.yaml with ruff, mypy, and formatting"
    effort: "2-3 hours"
    impact: "Enforce consistent code quality and catch type errors before CI"
  - title: "Enable Dependabot for Python dependencies"
    effort: "30 minutes"
    impact: "Automated security patches for pinned dependency versions"
  - title: "Add PR-time Docker build validation"
    effort: "3-4 hours"
    impact: "Catch Dockerfile regressions before merge for all 3 detector images"
  - title: "Add concurrency control to GitHub Actions workflows"
    effort: "30 minutes"
    impact: "Prevent redundant CI runs on rapid PR pushes, saving compute"
recommendations:
  priority_0:
    - "Add codecov integration with minimum coverage threshold (e.g., 80%) and PR coverage diff reporting"
    - "Add PR-time Docker image build validation for all 3 Dockerfiles (Dockerfile.hf, Dockerfile.judge, Dockerfile.builtIn)"
    - "Enable Dependabot or Renovate for automated dependency updates across all requirements.txt files"
  priority_1:
    - "Create .pre-commit-config.yaml with ruff (linting+formatting), mypy (type checking), and basic hooks"
    - "Add concurrency control (concurrency: group + cancel-in-progress) to all CI workflows"
    - "Create agent rules (.claude/rules/) for unit test, integration test, and API test patterns"
    - "Add container image startup validation (health check) in CI after build"
  priority_2:
    - "Add E2E tests that deploy detectors as KServe InferenceServices in Kind cluster"
    - "Add contract tests validating the FMS Guardrails Orchestrator detector API schema"
    - "Add SBOM generation and image signing to the build process"
    - "Integrate locust load testing into periodic CI runs (already in dev dependencies)"
---

# Quality Analysis: guardrails-detectors

## Executive Summary

- **Overall Score: 5.2/10**
- **Repository Type**: Python ML microservices (FastAPI-based detector algorithms for FMS Guardrails Orchestrator)
- **Primary Language**: Python 3.11
- **Key Strengths**: Strong unit test coverage with 1.41:1 test-to-code ratio, well-organized per-component CI workflows with shared composite actions, comprehensive Trivy security scanning, and multi-architecture Docker support
- **Critical Gaps**: No container image testing in CI, no coverage tracking/enforcement, no pre-commit or linting configuration, no dependency update automation
- **Agent Rules Status**: Missing - No CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | Good test-to-code ratio (1.41:1) with 16 test files across all 3 detector modules |
| Integration/E2E | 5.0/10 | FastAPI TestClient integration tests exist but no true E2E or multi-service testing |
| **Build Integration** | **2.0/10** | **No PR-time image builds, no Konflux simulation, no deployment testing** |
| Image Testing | 3.0/10 | Multi-stage Dockerfiles with multi-arch support but no image build or runtime validation in CI |
| Coverage Tracking | 3.0/10 | pytest-cov generates terminal reports but no codecov integration or enforcement |
| CI/CD Automation | 7.0/10 | Well-organized per-component workflows with shared actions and pip caching |
| Agent Rules | 0.0/10 | No CLAUDE.md, AGENTS.md, or .claude/ directory exists |

## Critical Gaps

### 1. No Container Image Build or Test in CI
- **Impact**: Dockerfile regressions (broken builds, missing dependencies, startup failures) are undetectable until post-merge or deployment. Three separate Dockerfiles (`Dockerfile.hf`, `Dockerfile.judge`, `Dockerfile.builtIn`) are never validated in PR workflows.
- **Severity**: HIGH
- **Effort**: 6-8 hours
- **Details**: The repo has well-structured multi-stage Dockerfiles including multi-architecture support (ppc64le, s390x) for the HF detector, but none are built or tested during PR review. A broken `pip install` or missing COPY target would only surface after merge.

### 2. No Coverage Tracking or Enforcement
- **Impact**: Coverage can silently degrade over time with no visibility. No PR-level coverage gates exist to prevent regressions.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: All 3 test workflows use `--cov` and `--cov-report=term-missing`, but coverage results are only printed to CI logs. No codecov/coveralls integration, no threshold enforcement, no historical tracking.

### 3. No Pre-commit Configuration
- **Impact**: Linting, formatting, and static analysis are not enforced despite `pre-commit==3.8.0` being in `detectors/common/requirements-dev.txt`.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: The shared test-setup action attempts to run pre-commit (`find ... | xargs pre-commit run --files`) but gracefully skips with `continue-on-error: true` when no `.pre-commit-config.yaml` exists. This means linting is aspirational but not enforced. No `ruff.toml`, `.flake8`, or `mypy.ini` exists either.

### 4. No Dependency Update Automation
- **Impact**: Pinned dependencies across 6 `requirements.txt` files can accumulate known vulnerabilities without notification.
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: While Trivy filesystem scanning catches known CVEs weekly, there's no automated PR creation for dependency updates. Libraries like `torch`, `transformers`, `fastapi`, and `urllib3` are version-pinned with no Dependabot or Renovate configuration.

### 5. No E2E or Contract Tests
- **Impact**: No verification that detectors function correctly when deployed as KServe InferenceServices or integrated with the FMS Guardrails Orchestrator.
- **Severity**: MEDIUM
- **Effort**: 16-24 hours
- **Details**: Tests validate detector logic via FastAPI TestClient (in-process), but never test the actual container deployment, KServe serving runtime configuration, or end-to-end orchestrator integration.

## Quick Wins

### 1. Add Codecov Integration with Coverage Thresholds
- **Effort**: 2-4 hours
- **Impact**: Immediate visibility into coverage trends and prevention of regression
- **Implementation**:
  ```yaml
  # Add to each test workflow after pytest step
  - name: Upload coverage
    uses: codecov/codecov-action@v4
    with:
      flags: ${{ matrix.component || 'builtin' }}
      fail_ci_if_error: false
  ```
  Add `.codecov.yml`:
  ```yaml
  coverage:
    status:
      project:
        default:
          target: 80%
      patch:
        default:
          target: 80%
  ```

### 2. Create .pre-commit-config.yaml
- **Effort**: 2-3 hours
- **Impact**: Enforce consistent code quality across all detector modules
- **Implementation**:
  ```yaml
  repos:
    - repo: https://github.com/astral-sh/ruff-pre-commit
      rev: v0.4.0
      hooks:
        - id: ruff
          args: [--fix]
        - id: ruff-format
    - repo: https://github.com/pre-commit/mirrors-mypy
      rev: v1.10.0
      hooks:
        - id: mypy
          additional_dependencies: [pydantic, fastapi]
  ```

### 3. Enable Dependabot
- **Effort**: 30 minutes
- **Impact**: Automated PRs for vulnerable dependency updates
- **Implementation**: Create `.github/dependabot.yml`:
  ```yaml
  version: 2
  updates:
    - package-ecosystem: "pip"
      directory: "/detectors/common"
      schedule:
        interval: "weekly"
    - package-ecosystem: "pip"
      directory: "/detectors/huggingface"
      schedule:
        interval: "weekly"
    - package-ecosystem: "pip"
      directory: "/detectors/llm_judge"
      schedule:
        interval: "weekly"
    - package-ecosystem: "pip"
      directory: "/detectors/built_in"
      schedule:
        interval: "weekly"
    - package-ecosystem: "github-actions"
      directory: "/"
      schedule:
        interval: "weekly"
  ```

### 4. Add PR-time Docker Build Validation
- **Effort**: 3-4 hours
- **Impact**: Catch Dockerfile regressions before merge
- **Implementation**:
  ```yaml
  # New workflow: .github/workflows/build-images.yaml
  name: Build Docker Images
  on:
    pull_request:
      paths: ['detectors/**', 'Dockerfile*']
  jobs:
    build:
      runs-on: ubuntu-latest
      strategy:
        matrix:
          include:
            - name: builtin
              dockerfile: detectors/Dockerfile.builtIn
            - name: huggingface
              dockerfile: detectors/Dockerfile.hf
            - name: llm-judge
              dockerfile: detectors/Dockerfile.judge
      steps:
        - uses: actions/checkout@v4
        - name: Build image
          run: docker build -f ${{ matrix.dockerfile }} detectors/
  ```

### 5. Add Concurrency Control
- **Effort**: 30 minutes
- **Impact**: Prevent redundant CI runs, save compute resources
- **Implementation**: Add to each workflow:
  ```yaml
  concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: true
  ```

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory** (4 workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test-builtin-detectors.yaml` | push/PR (path-filtered) | Unit tests for built-in detectors |
| `test-huggingface-runtime.yaml` | push/PR (path-filtered) | Unit tests for HuggingFace detector |
| `test-llm-judge.yaml` | push/PR (path-filtered) | Unit tests for LLM Judge detector |
| `security-scan.yaml` | push/PR/schedule/dispatch | Trivy vulnerability + secret scanning |

**Strengths**:
- Smart path-based filtering per component (e.g., `detectors/built_in/**` only triggers built-in tests)
- Shared composite action (`.github/actions/test-setup/action.yaml`) for DRY setup
- Pip dependency caching with hash-based cache keys
- Timeout controls on test steps (20min HF, 15min LLM Judge)
- Trivy scanning with SARIF upload, per-component matrix, and human-readable reports

**Weaknesses**:
- No concurrency control on any workflow
- No Docker image build or test workflow
- No E2E or deployment test workflow
- No Makefile with standardized targets
- Pre-commit check always silently passes (`continue-on-error: true`)

### Test Coverage

**Test Structure** (16 test files, 2,777 lines):

| Module | Test Files | Key Tests |
|--------|-----------|-----------|
| Built-in (`tests/detectors/builtIn/`) | 4 | Regex patterns (PII, credit cards), file type validation (JSON/XML/YAML with schemas), custom detector security, Prometheus metrics |
| HuggingFace (`tests/detectors/huggingface/`) | 9 | Method-level tests (model init, device, parsing, classification), client integration, Prometheus metrics |
| LLM Judge (`tests/detectors/llm_judge/`) | 2 | Content/generation analysis, parameter validation, concurrency performance |

**Test Quality Highlights**:
- Parametrized tests for thorough input coverage (regex patterns, credit card types)
- Security-focused tests (unsafe code detection in custom detectors, import sandboxing)
- Performance tests with concurrency validation (asyncio.gather with timing assertions)
- Prometheus metrics instrumentation tests (counters, runtime, detection rates)
- Dummy models included in repo for reproducible HF testing
- Error handling tests (invalid inputs, missing params, malformed data)

**Test Gaps**:
- No coverage thresholds or gates
- No snapshot/golden-file tests for API responses
- No property-based testing (hypothesis)
- No multi-model integration tests for HF detector
- Locust load testing tool in dev deps but not integrated into CI

### Code Quality

| Tool | Status | Notes |
|------|--------|-------|
| Linting (ruff/flake8) | Missing | No configuration files found |
| Type checking (mypy) | Missing | No mypy.ini or pyproject.toml type config |
| Formatting (black/ruff) | Missing | No formatter configured |
| Pre-commit | Partial | In requirements-dev.txt but no .pre-commit-config.yaml |
| Static analysis (SAST) | Missing | No CodeQL or Semgrep |
| Secret detection | Present | Trivy secret scanner in security workflow |
| tox | Present | Configured for py311 with combined coverage |

### Container Images

**3 Dockerfiles analyzed**:

| Image | Base | Multi-stage | Multi-arch | Complexity |
|-------|------|------------|------------|------------|
| `Dockerfile.hf` | UBI9 minimal | Yes (4 stages) | Yes (ppc64le, s390x, amd64) | High - builds PyTorch and OpenBLAS from source for non-x86 |
| `Dockerfile.judge` | UBI9 minimal | Yes (2 stages) | No | Low |
| `Dockerfile.builtIn` | UBI9 minimal | Yes (2 stages) | No | Low |

**Strengths**: UBI9 base images (Red Hat certified), multi-stage builds for smaller final images, Prometheus multiproc dir setup
**Gaps**: No image build in CI, no runtime/health check testing, no SBOM generation, no image signing, no vulnerability scanning of built images (only filesystem scanning)

### Security

**Strengths**:
- Comprehensive Trivy scanning: filesystem vulnerability + secret detection + configuration scanning
- Per-component matrix scanning (builtin, huggingface, llm-judge, common)
- SARIF results uploaded to GitHub Security tab
- Weekly scheduled scans (Mondays 2 AM UTC)
- Manual workflow_dispatch trigger available
- Custom detector sandboxing (import restriction, unsafe code detection)

**Gaps**:
- No CodeQL/SAST for code-level vulnerability detection
- No Dependabot/Renovate for dependency updates
- No image scanning (only filesystem)
- No .trivyignore for known false positives
- Trivy `exit-code: '0'` means scans never fail the build

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None - no `.claude/`, `CLAUDE.md`, or `AGENTS.md` exists
- **Quality**: N/A
- **Gaps**: No test creation rules, no coding standards documentation for AI agents, no test patterns or examples
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - Unit test patterns for FastAPI TestClient-based detector testing
  - Mock patterns for ML models (torch, transformers, vllm_judge)
  - Integration test patterns for KServe deployment
  - Security test patterns for custom detector sandboxing
  - Prometheus metrics testing patterns

## Recommendations

### Priority 0 (Critical)

1. **Add codecov integration** with minimum 80% coverage threshold and PR diff reporting. All 3 test workflows already generate coverage data via `--cov` — just upload and enforce it.

2. **Add PR-time Docker image build validation** for all 3 Dockerfiles. The HuggingFace Dockerfile has complex multi-arch logic that could silently break without CI validation.

3. **Enable Dependabot** for all 6 requirements.txt files and GitHub Actions. Pinned versions like `torch==2.9.1`, `transformers==4.57.1`, and `urllib3==2.6.2` need automated update monitoring.

### Priority 1 (High Value)

4. **Create `.pre-commit-config.yaml`** with ruff (linting + formatting) and mypy (type checking). Pre-commit is already a dev dependency — just add the config.

5. **Add concurrency control** to all CI workflows to prevent redundant runs on rapid PR pushes.

6. **Create agent rules** (`.claude/rules/`) for test automation guidance covering the FastAPI TestClient, ML model mocking, and Prometheus metrics testing patterns specific to this codebase.

7. **Add container health check validation** in CI — after building each image, run it briefly and verify the `/health` endpoint responds.

### Priority 2 (Nice-to-Have)

8. **Add E2E tests** deploying detectors as KServe InferenceServices in a Kind cluster, validating the full serving pipeline.

9. **Add contract tests** ensuring API responses match the FMS Guardrails Orchestrator detector API schema.

10. **Add SBOM generation** (e.g., Syft) and image signing (e.g., cosign) to the container build process.

11. **Integrate locust load testing** into periodic CI runs — `locust==2.31.1` is already in dev dependencies but never used in CI.

12. **Make Trivy scans fail on HIGH/CRITICAL** vulnerabilities by changing `exit-code: '0'` to `exit-code: '1'` in the security workflow.

## Comparison to Gold Standards

| Dimension | guardrails-detectors | odh-dashboard (Gold) | notebooks (Gold) | Gap |
|-----------|---------------------|---------------------|------------------|-----|
| Unit Test Ratio | 1.41:1 | ~1.5:1 | ~1.0:1 | Close to gold |
| Coverage Enforcement | None | Codecov with thresholds | Codecov | Major gap |
| E2E Tests | None | Cypress + multi-env | Image validation suite | Major gap |
| Image Testing | No CI builds | PR-time builds | 5-layer validation | Major gap |
| Pre-commit | Config missing | Full config (eslint, prettier) | Full config | Major gap |
| Security Scanning | Trivy filesystem | Trivy + CodeQL + Snyk | Trivy + image scan | Moderate gap |
| Agent Rules | None | Comprehensive rules | Basic rules | Major gap |
| CI Organization | Good (per-component) | Excellent (matrix) | Good (per-image) | Minor gap |
| Dependency Updates | None | Dependabot | Dependabot | Major gap |

## File Paths Reference

### CI/CD
- `.github/workflows/test-builtin-detectors.yaml` - Built-in detector tests
- `.github/workflows/test-huggingface-runtime.yaml` - HuggingFace detector tests
- `.github/workflows/test-llm-judge.yaml` - LLM Judge detector tests
- `.github/workflows/security-scan.yaml` - Trivy security scanning
- `.github/actions/test-setup/action.yaml` - Shared composite action

### Source Code
- `detectors/common/` - Shared code (FastAPI app base, Pydantic schemas, instrumentation)
- `detectors/built_in/` - Built-in detectors (regex, file type, custom)
- `detectors/huggingface/` - HuggingFace model detector
- `detectors/llm_judge/` - LLM-as-Judge detector (vllm_judge integration)

### Tests
- `tests/conftest.py` - Shared test fixtures (path setup, Prometheus temp dir)
- `tests/detectors/builtIn/` - 4 test files (regex, filetype, custom, metrics)
- `tests/detectors/huggingface/` - 9 test files (method-level, integration, metrics)
- `tests/detectors/llm_judge/` - 2 test files (detector, performance)
- `tests/dummy_models/` - Pre-trained model files for testing

### Container Images
- `detectors/Dockerfile.hf` - HuggingFace detector (multi-arch, 4-stage)
- `detectors/Dockerfile.judge` - LLM Judge detector
- `detectors/Dockerfile.builtIn` - Built-in detector

### Deployment
- `detectors/huggingface/deploy/` - KServe manifests (ISVC, ServingRuntime, ModelContainer)
- `detectors/llm_judge/deploy/` - KServe manifests (ISVC, ServingRuntime)

### Configuration
- `tox.ini` - Test environment configuration
- `detectors/common/requirements-dev.txt` - Dev dependencies (pytest, coverage, pre-commit, locust)
