---
repository: "red-hat-data-services/guardrails-detectors"
overall_score: 5.9
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Good test coverage with pytest, 16 test files covering all 3 detector types"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "Basic integration test for HF detector lifespan only; no E2E or contract tests"
  - dimension: "Build Integration"
    score: 4.5
    status: "Konflux/Tekton builds on PR (comment/label-triggered), but no PR-time image validation or smoke tests"
  - dimension: "Image Testing"
    score: 3.0
    status: "5 Dockerfiles exist but no runtime validation, no startup tests, no image scanning in PR workflow"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "pytest-cov generates terminal reports but no codecov/coveralls integration, no thresholds"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "Well-structured component-specific workflows with path filters, reusable composite action, caching, and Trivy scanning"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, .claude/ directory, or agent rules of any kind"
critical_gaps:
  - title: "No integration or E2E test suite"
    impact: "API contract violations and detector interoperability issues not caught until deployment"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No coverage enforcement or reporting"
    impact: "Coverage can silently regress; no visibility in PRs"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container image runtime validation"
    impact: "Image startup failures, missing dependencies, or broken endpoints not caught until deployment"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "Missing LLM Judge Dockerfile for Konflux"
    impact: "LLM Judge component lacks a Konflux build pipeline; only builtIn and HF have Konflux Dockerfiles"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No pre-commit enforcement"
    impact: "Linting runs in CI with continue-on-error: true; code quality issues can merge freely"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add codecov integration and coverage thresholds"
    effort: "2-4 hours"
    impact: "Immediate visibility into coverage trends and regressions on every PR"
  - title: "Enforce pre-commit linting (remove continue-on-error)"
    effort: "1-2 hours"
    impact: "Prevent code style/quality issues from merging"
  - title: "Add container startup smoke test to CI"
    effort: "3-4 hours"
    impact: "Catch Dockerfile/dependency issues before merge"
  - title: "Create basic agent rules for unit test patterns"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality and consistency"
  - title: "Add Dockerfile hadolint linting"
    effort: "1-2 hours"
    impact: "Catch Dockerfile best-practice violations early"
recommendations:
  priority_0:
    - "Add codecov.yml and upload coverage reports to Codecov with a minimum threshold (e.g., 70%)"
    - "Create integration/E2E tests that start each detector service and verify API contracts"
    - "Add container image startup validation tests for all 3 detector types"
  priority_1:
    - "Create Dockerfile.konflux.judge for LLM Judge to match builtIn and HF patterns"
    - "Add contract tests verifying detector API schema compliance with the Orchestrator interface"
    - "Create .claude/rules/ with test creation guidance for all detector types"
    - "Enforce pre-commit hooks by removing continue-on-error from the composite action"
  priority_2:
    - "Add multi-architecture image build testing in CI (not just Konflux)"
    - "Add performance regression testing with benchmarks for built-in detectors"
    - "Implement SBOM generation and image signing"
    - "Add Makefile with standard targets (test, lint, build, run)"
---

# Quality Analysis: guardrails-detectors

## Executive Summary

- **Overall Score: 5.9/10**
- **Repository Type**: Python microservices collection (3 detector types: built-in, HuggingFace, LLM Judge)
- **Primary Language**: Python 3.11+
- **Framework**: FastAPI (uvicorn), deployed as container images via Konflux/Tekton
- **Key Strengths**: Well-organized component-specific CI workflows, good unit test coverage with pytest, comprehensive Trivy security scanning, reusable composite GitHub Action, multi-architecture Konflux builds
- **Critical Gaps**: No integration/E2E tests, no coverage enforcement or reporting, no container runtime validation, missing Konflux Dockerfile for LLM Judge, no agent rules
- **Agent Rules Status**: Missing (no CLAUDE.md, no .claude/ directory)

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | Good test coverage with pytest, 16 test files covering all 3 detector types |
| Integration/E2E | 3.0/10 | Basic HF lifespan integration test only; no E2E or contract tests |
| **Build Integration** | **4.5/10** | **Konflux/Tekton builds on PR (comment/label-triggered), no PR-time image validation** |
| Image Testing | 3.0/10 | 5 Dockerfiles exist but no runtime validation or startup testing |
| Coverage Tracking | 4.0/10 | pytest-cov terminal output only; no codecov, no thresholds |
| CI/CD Automation | 7.0/10 | Well-structured workflows with path filters, caching, reusable action |
| Agent Rules | 0.0/10 | No CLAUDE.md, .claude/ directory, or agent rules |

## Critical Gaps

### 1. No Integration or E2E Test Suite
- **Impact**: API contract violations, detector interoperability issues, and request/response schema mismatches are not caught until deployment
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: The only integration test is `test_client_integration.py` for the HF detector (testing FastAPI lifespan context). There are no end-to-end tests that start a detector service, send requests, and validate responses. No contract tests verify compliance with the FMS Guardrails Orchestrator API.

### 2. No Coverage Enforcement or Reporting
- **Impact**: Coverage can silently regress with no visibility; developers don't see coverage changes in PRs
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: `pytest-cov` generates terminal output (`--cov-report=term-missing`), but results are not uploaded to Codecov/Coveralls, not reported on PRs, and no minimum thresholds are enforced. Coverage data is ephemeral.

### 3. No Container Image Runtime Validation
- **Impact**: Broken imports, missing dependencies, or misconfigured entry points not caught until Kubernetes deployment
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: There are 5 Dockerfiles (3 standard + 2 Konflux), but no CI step builds and smoke-tests the images. The HF workflow has a basic Python import check, but doesn't actually build or start the container.

### 4. Missing Konflux Dockerfile for LLM Judge
- **Impact**: LLM Judge component doesn't have a hermetic Konflux build pipeline; inconsistency across detector types
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: `Dockerfile.konflux.builtIn` and `Dockerfile.konflux.hf` exist for Konflux builds, but there is no `Dockerfile.konflux.judge`. The `.tekton/` directory also lacks a pipeline for the LLM Judge component.

### 5. No Pre-commit Enforcement
- **Impact**: Code quality issues can merge; linting is advisory only
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: The composite action runs pre-commit with `continue-on-error: true`, and only if `.pre-commit-config.yaml` exists (which it doesn't in the repo). Linting is effectively not enforced at all.

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
Upload coverage reports and enforce thresholds:
```yaml
# Add to each test workflow after pytest step:
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    flags: builtin  # or huggingface, llm-judge
    fail_ci_if_error: true
```

### 2. Enforce Pre-commit Linting (1-2 hours)
- Create `.pre-commit-config.yaml` with ruff, black, and mypy
- Remove `continue-on-error: true` from the composite action
- Add a dedicated lint job to catch issues early

### 3. Add Container Startup Smoke Test (3-4 hours)
```yaml
- name: Build and smoke-test image
  run: |
    docker build -t test-image -f detectors/Dockerfile.builtIn detectors/
    docker run -d --name smoke -p 8080:8080 test-image
    sleep 5
    curl -f http://localhost:8080/health || exit 1
    docker stop smoke
```

### 4. Create Basic Agent Rules (2-3 hours)
- Create `.claude/rules/unit-tests.md` with pytest patterns
- Include detector-specific test patterns (mocking, fixtures, TestClient)
- Add test naming conventions and coverage expectations

### 5. Add Dockerfile Linting (1-2 hours)
```yaml
- name: Lint Dockerfiles
  uses: hadolint/hadolint-action@v3
  with:
    dockerfile: detectors/Dockerfile.builtIn
```

## Detailed Findings

### CI/CD Pipeline

**Strengths:**
- **Component-specific workflows**: Each detector type (builtIn, HF, LLM Judge) has its own workflow with path filters, ensuring only relevant tests run on changes
- **Reusable composite action**: `.github/actions/test-setup/action.yaml` standardizes Python setup, caching, and dependency installation across all test workflows
- **Pip caching**: Cache keys are generated from `pyproject.toml` hash for deterministic caching
- **Trivy security scanning**: Comprehensive security workflow scans all components individually plus the full repository, with SARIF upload to GitHub Security tab
- **Scheduled security scans**: Weekly Trivy scans (Mondays 2 AM UTC) for ongoing vulnerability detection
- **Konflux/Tekton integration**: PR-triggered Konflux builds for builtIn and HF detectors with multi-architecture support (x86_64, arm64, ppc64le, s390x)
- **Cancel-in-progress**: Tekton pipelines use `cancel-in-progress: "true"` to avoid redundant builds

**Weaknesses:**
- No Makefile for standardized build/test/lint targets
- Tekton builds are comment/label-triggered, not automatic on all PRs
- No GitHub Actions for building Docker images in CI
- Pre-commit runs with `continue-on-error: true` and config file doesn't exist
- No workflow for the LLM Judge Konflux build

### Test Coverage

**Test Inventory (16 test files, ~3,087 lines):**

| Component | Test Files | Lines | Key Areas |
|-----------|-----------|-------|-----------|
| Built-in | 4 | 1,068 | Regex detectors, file-type validation, custom detectors, metrics |
| HuggingFace | 9 | 1,251 | Device init, model loading, parse output, process classification, integration, metrics |
| LLM Judge | 2 | 722 | Content/generation analysis, concurrent evaluations, batch processing |
| Shared | 1 (conftest) | 46 | Path setup, Prometheus temp dir |

**Test-to-Code Ratio**: 3,087 test lines / 2,131 source lines = **1.45:1** (good)

**Strengths:**
- Comprehensive unit tests for all three detector types
- Good use of pytest fixtures, parametrize, and TestClient
- Performance tests validate concurrent evaluation (LLM Judge)
- Dummy models for offline HuggingFace testing
- Well-structured test hierarchy mirroring source layout

**Weaknesses:**
- Only 1 integration test (HF lifespan context)
- No end-to-end tests starting real services
- No contract tests for API schema compliance
- No negative/error path tests for common/scheme.py
- No tests for `detectors/common/app.py` (the base FastAPI app)
- No tests for `detectors/common/instrumented_detector.py`
- Coverage is terminal-only, not tracked or enforced

### Code Quality

**Strengths:**
- Clean project structure with `pyproject.toml` for dependency management
- Type hints used throughout (typing module)
- Pydantic models for request/response schemas
- Prometheus metrics instrumentation
- Structured logging configuration (`log_conf.yaml`)
- Good separation of concerns (common/scheme for shared types)

**Weaknesses:**
- No `.pre-commit-config.yaml` file exists in the repository
- No linter configuration (no ruff.toml, .flake8, mypy.ini)
- No formatter configuration (no black, isort)
- No static type checking (no mypy, pyright)
- `tox.ini` exists but no Makefile for additional targets
- No docstring coverage enforcement

### Container Images

**Dockerfile Inventory:**

| File | Base Image | Multi-stage | Multi-arch | User |
|------|-----------|-------------|------------|------|
| `Dockerfile.builtIn` | ubi9/python-312 | Yes (2 stages) | No | Default (root) |
| `Dockerfile.hf` | ubi9/python-312 | Yes (2 stages) | No | 1001 |
| `Dockerfile.judge` | ubi9/python-312 | Yes (2 stages) | No | Default (root) |
| `Dockerfile.konflux.builtIn` | aipcc/base-images | No | Via Tekton | 1001 |
| `Dockerfile.konflux.hf` | ubi9/python-312 | Yes (4 stages) | Yes (ppc64le, s390x, arm64) | 1001 |

**Strengths:**
- UBI9 base images (Red Hat supported)
- Multi-stage builds for standard Dockerfiles
- Complex multi-architecture support in Konflux HF Dockerfile (builds PyTorch from source for ppc64le/s390x)
- Non-root user in production Dockerfiles (1001)
- Prometheus multiprocess directory setup
- Red Hat labels and metadata in Konflux images

**Weaknesses:**
- `Dockerfile.builtIn` and `Dockerfile.judge` run as root (no USER instruction or USER root without drop)
- No `.dockerignore` file (entire repo context sent to builder)
- No health check endpoints in Dockerfiles (HEALTHCHECK instruction)
- No image scanning in CI for standard Dockerfiles
- CACHEBUST ARG pattern is unusual and may break layer caching
- `Dockerfile.judge` lacks Konflux equivalent
- No SBOM generation or image signing

### Security

**Strengths:**
- **Trivy scanning**: Comprehensive per-component filesystem scanning plus repository-wide scan
- **SARIF upload**: Results integrated into GitHub Security tab
- **Configuration scanning**: Trivy config scan for misconfigurations
- **Scheduled scans**: Weekly automated security scans
- **Pinned action versions**: Trivy action uses SHA-pinned version
- **Vulnerability and secret scanning**: Both `vuln` and `secret` scanners enabled

**Weaknesses:**
- Security scan uses `exit-code: '0'` — vulnerabilities don't fail the build
- No dependency review action for PR dependency changes
- No CodeQL/SAST for source code analysis
- No Gitleaks or TruffleHog for commit-level secret detection
- No container image scanning (only filesystem scanning)
- No `.trivyignore` for known false positives management
- Trivy config scan has `continue-on-error: true`

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no CLAUDE.md, AGENTS.md, or .claude/ directory
- **Quality**: N/A
- **Gaps**: All test types lack agent rules:
  - No unit test creation rules
  - No integration test patterns
  - No detector-specific test guidance
  - No mocking/fixture patterns documented for agents
  - No code quality or review rules
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - pytest patterns for each detector type
  - TestClient usage for FastAPI endpoints
  - Mock patterns for vllm_judge, transformers
  - Dummy model usage for HuggingFace tests
  - Coverage expectations and conventions

## Recommendations

### Priority 0 (Critical)

1. **Add Codecov integration with coverage thresholds**
   - Upload coverage from all 3 test workflows
   - Set minimum threshold at 70% (current likely ~65-75% based on test-to-code ratio)
   - Configure PR comments for coverage diff

2. **Create integration/E2E tests**
   - Start each detector as a FastAPI TestClient
   - Validate all API endpoints (`/api/v1/text/contents`, `/api/v1/text/doc`, etc.)
   - Test error handling (invalid payloads, missing params)
   - Verify Prometheus metrics are exposed correctly

3. **Add container image startup validation**
   - Build each Dockerfile in CI
   - Run container and verify health endpoint responds
   - Check all expected endpoints are registered

### Priority 1 (High Value)

4. **Create `Dockerfile.konflux.judge`** and corresponding Tekton pipeline
   - Mirror patterns from `Dockerfile.konflux.builtIn`
   - Add to `konflux-central` repository

5. **Add contract tests** for Orchestrator API compliance
   - Verify request/response schemas match the FMS Guardrails Orchestrator spec
   - Test with known-good request payloads from orchestrator

6. **Create comprehensive agent rules** (`.claude/rules/`)
   - Unit test patterns for each detector type
   - Mocking guidance for external dependencies
   - TestClient patterns for FastAPI
   - Coverage expectations

7. **Enforce pre-commit hooks**
   - Create `.pre-commit-config.yaml` with ruff, black, mypy
   - Remove `continue-on-error: true` from composite action
   - Make linting a hard gate

### Priority 2 (Nice-to-Have)

8. **Add a Makefile** with standard targets (`test`, `lint`, `build`, `run`, `clean`)

9. **Performance regression testing** — benchmark built-in detectors (regex, filetype) and track over time

10. **SBOM generation and image signing** for supply chain security

11. **Add Dockerfile health checks** (`HEALTHCHECK --interval=30s CMD curl -f http://localhost:8080/health || exit 1`)

12. **Add `.dockerignore`** to reduce build context size

## Comparison to Gold Standards

| Feature | guardrails-detectors | odh-dashboard | notebooks | kserve |
|---------|---------------------|---------------|-----------|--------|
| Unit Tests | Good (16 files) | Excellent (400+) | Good | Excellent |
| Integration Tests | Minimal (1 file) | Comprehensive | Good | Comprehensive |
| E2E Tests | None | Cypress + API | Full pipeline | Multi-version |
| Coverage Tracking | Terminal only | Codecov enforced | Basic | Codecov enforced |
| Coverage Threshold | None | 80%+ | None | 80%+ |
| Container Testing | None | Build validation | 5-layer testing | Image validation |
| Security Scanning | Trivy (non-blocking) | Trivy + Snyk | Trivy | Trivy + CodeQL |
| Pre-commit | Not configured | Enforced | Basic | Enforced |
| Agent Rules | None | Comprehensive | None | Partial |
| CI Path Filters | Yes | Yes | Yes | Yes |
| Multi-arch | Konflux only | N/A | Yes | Yes |
| Linting | None enforced | ESLint strict | Basic | golangci-lint |

## File Paths Reference

### CI/CD
- `.github/workflows/test-builtin-detectors.yaml` — Built-in detector unit tests
- `.github/workflows/test-huggingface-runtime.yaml` — HuggingFace runtime unit tests
- `.github/workflows/test-llm-judge.yaml` — LLM Judge unit tests
- `.github/workflows/security-scan.yaml` — Trivy security scanning
- `.github/actions/test-setup/action.yaml` — Reusable composite action

### Tekton/Konflux
- `.tekton/odh-built-in-detector-pull-request.yaml` — Konflux PR build for built-in
- `.tekton/odh-guardrails-detector-huggingface-runtime-pull-request.yaml` — Konflux PR build for HF

### Testing
- `tests/conftest.py` — Shared fixtures (path setup, Prometheus temp dir)
- `tests/detectors/builtIn/` — 4 test files for built-in detectors
- `tests/detectors/huggingface/` — 9 test files for HF runtime
- `tests/detectors/llm_judge/` — 2 test files for LLM Judge
- `tests/dummy_models/` — Offline HuggingFace models for testing

### Source Code
- `detectors/pyproject.toml` — Package definition and dependencies
- `detectors/common/` — Shared FastAPI app, schema, instrumentation
- `detectors/built_in/` — Regex, filetype, custom detectors
- `detectors/huggingface/` — HuggingFace model detector
- `detectors/llm_judge/` — vLLM Judge detector

### Container Images
- `detectors/Dockerfile.builtIn` — Standard builtIn image
- `detectors/Dockerfile.hf` — Standard HuggingFace image
- `detectors/Dockerfile.judge` — Standard LLM Judge image
- `detectors/Dockerfile.konflux.builtIn` — Hermetic Konflux builtIn build
- `detectors/Dockerfile.konflux.hf` — Multi-arch Konflux HF build

### Configuration
- `tox.ini` — Tox test runner configuration
- `.gitignore` — Git ignore rules
