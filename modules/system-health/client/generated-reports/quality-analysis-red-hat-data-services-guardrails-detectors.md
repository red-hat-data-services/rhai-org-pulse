---
repository: "red-hat-data-services/guardrails-detectors"
overall_score: 5.9
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Good per-component test coverage with pytest, well-structured test classes, parametrized tests, and mock-based testing for external dependencies"
  - dimension: "Integration/E2E"
    score: 4.0
    status: "Basic FastAPI TestClient integration tests exist but no true E2E tests against running containers or deployed services"
  - dimension: "Build Integration"
    score: 3.0
    status: "No PR-time Docker image build validation; Konflux builds are comment/label-triggered only, not automatic on PR"
  - dimension: "Image Testing"
    score: 2.5
    status: "No container runtime validation, no image startup testing, no healthcheck verification in CI"
  - dimension: "Coverage Tracking"
    score: 3.5
    status: "pytest-cov generates terminal reports but no codecov integration, no coverage thresholds, no PR coverage gating"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "Well-organized per-component workflows with path filtering, caching, and shared composite action; security scanning is strong"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules or AI-assisted test guidance"
critical_gaps:
  - title: "No container image runtime validation in CI"
    impact: "Image startup failures, missing dependencies, and runtime errors not caught until deployment"
    severity: "HIGH"
    effort: "6-8 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Coverage can silently decrease with each PR; no visibility into coverage trends"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No PR-time Docker build validation"
    impact: "Dockerfile changes can break builds that are only discovered when Konflux builds are manually triggered"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No E2E tests for detector services"
    impact: "API contract regressions, inter-component integration issues, and deployment failures not caught before merge"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No pre-commit configuration"
    impact: "Code style and quality inconsistencies; linting step in CI is a no-op (checks for .pre-commit-config.yaml which doesn't exist)"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI code assistants lack project-specific context for testing patterns, API contracts, and detector architecture"
    severity: "MEDIUM"
    effort: "3-4 hours"
quick_wins:
  - title: "Add codecov integration and coverage thresholds"
    effort: "2-3 hours"
    impact: "Immediate visibility into coverage trends; prevent regressions with PR gating"
  - title: "Create .pre-commit-config.yaml with ruff, mypy, and basic hooks"
    effort: "1-2 hours"
    impact: "Consistent code quality; existing CI step already checks for this file"
  - title: "Add PR-time Docker build smoke test"
    effort: "3-4 hours"
    impact: "Catch Dockerfile breakages before merge; especially critical for multi-arch HF detector"
  - title: "Add basic agent rules (.claude/rules/)"
    effort: "2-3 hours"
    impact: "Better AI-assisted test generation aligned with project patterns"
recommendations:
  priority_0:
    - "Add codecov.yml with coverage thresholds (e.g., 80%) and PR checks"
    - "Add PR-time Docker build validation for all 3 detector images"
    - "Create .pre-commit-config.yaml with ruff linter, mypy type checking, and standard hooks"
  priority_1:
    - "Add E2E tests that build and start detector containers, send requests, and verify responses"
    - "Add container healthcheck endpoint testing in CI"
    - "Create comprehensive agent rules for unit test patterns, integration test patterns, and detector architecture"
    - "Add API contract tests to verify request/response schema compliance"
  priority_2:
    - "Add load/performance testing with locust (dependency already exists in requirements-dev.txt)"
    - "Add image vulnerability scanning with severity thresholds that fail the build"
    - "Add SBOM generation for container images"
    - "Add multi-version Python testing (3.11 + 3.12)"
---

# Quality Analysis: guardrails-detectors

## Executive Summary

- **Overall Score: 5.9/10**
- **Repository Type**: Python microservices (FastAPI-based detector algorithms for FMS Guardrails Orchestrator)
- **Primary Language**: Python 3.11
- **Framework**: FastAPI + uvicorn, PyTorch/Transformers for ML inference
- **Key Strengths**: Well-organized per-component unit tests with good parametrization, comprehensive Trivy security scanning, well-structured CI workflows with shared composite action and pip caching, multi-architecture Konflux builds (x86, ppc64le, arm64, s390x)
- **Critical Gaps**: No coverage tracking/enforcement, no container runtime testing, no PR-time Docker build validation, no pre-commit hooks, no E2E tests
- **Agent Rules Status**: Missing - no CLAUDE.md, no .claude/ directory, no agent rules

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | Good per-component coverage with pytest, parametrized tests, mocks |
| Integration/E2E | 4.0/10 | Basic FastAPI TestClient integration, no container-level E2E |
| **Build Integration** | **3.0/10** | **Konflux builds comment/label-triggered only, no auto PR build** |
| Image Testing | 2.5/10 | No container runtime validation or healthcheck testing |
| Coverage Tracking | 3.5/10 | Terminal-only coverage reports, no thresholds or gating |
| CI/CD Automation | 7.0/10 | Well-organized workflows with path filtering and caching |
| Agent Rules | 0.0/10 | No agent rules or AI development guidance |

## Critical Gaps

### 1. No Container Image Runtime Validation
- **Impact**: Image startup failures, missing dependencies, and runtime configuration errors are not caught until deployment to staging/production
- **Severity**: HIGH
- **Effort**: 6-8 hours
- **Details**: The repo builds 5 Dockerfiles (3 standard + 2 Konflux variants) but none are tested in CI. The HF detector Dockerfile is particularly complex with multi-arch PyTorch compilation for ppc64le/s390x, making it especially prone to breakage.

### 2. No Coverage Tracking or Enforcement
- **Impact**: Test coverage can decrease silently with each PR. No visibility into coverage trends or ability to prevent regressions.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: `pytest-cov` is used to generate terminal reports (`--cov-report=term-missing`) in all 3 test workflows, but there is no codecov/coveralls integration, no `.codecov.yml`, no coverage thresholds, and no PR coverage checks. Coverage data is generated but discarded.

### 3. No PR-Time Docker Build Validation
- **Impact**: Dockerfile changes break production builds that are discovered only when someone manually triggers a Konflux build via PR comment (`/build-konflux`) or label
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Tekton PipelineRuns in `.tekton/` are triggered by labels (`kfbuild-all`, `kfbuild-built-in-detector`) or comments, not automatically on PR. The gap between GitHub CI (tests only) and Konflux (builds only) means build-breaking changes can merge.

### 4. No E2E Tests for Detector Services
- **Impact**: API contract regressions, service startup issues, and inter-component integration problems not caught before merge
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: While unit tests use FastAPI TestClient for in-process API testing, there are no tests that build actual containers, start services, and verify the full request/response cycle. This is critical given the 3 different detector types with different APIs and dependencies.

### 5. No Pre-Commit Configuration
- **Impact**: Code style inconsistencies; the CI composite action checks for `.pre-commit-config.yaml` but the file doesn't exist, so linting is silently skipped
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: The shared test-setup composite action (`.github/actions/test-setup/action.yaml`) has a "Lint with pre-commit" step that checks `if [ -f .pre-commit-config.yaml ]` - since the file doesn't exist, this step always says "No pre-commit config found, skipping linting" and does nothing. This is a dead code path that creates a false sense of linting coverage.

### 6. No Agent Rules for AI-Assisted Development
- **Impact**: AI coding assistants cannot follow project-specific testing conventions, detector architecture patterns, or API contracts
- **Severity**: MEDIUM
- **Effort**: 3-4 hours

## Quick Wins

### 1. Add Codecov Integration (2-3 hours)
- **Impact**: Immediate coverage visibility and regression prevention
- **Implementation**:
  - Add `.codecov.yml` with target thresholds
  - Update workflows to upload coverage XML reports
  - Add codecov badge to README

### 2. Create `.pre-commit-config.yaml` (1-2 hours)
- **Impact**: Code quality enforcement; existing CI infra already supports it
- **Implementation**:
  - Add ruff for linting/formatting
  - Add mypy for type checking
  - Add trailing-whitespace, end-of-file-fixer, check-yaml hooks
  - The CI composite action will automatically pick it up

### 3. Add PR-Time Docker Build Smoke Test (3-4 hours)
- **Impact**: Catch Dockerfile breakages before merge
- **Implementation**:
  - Add workflow that builds Docker images (no push) on PR when Dockerfiles or requirements change
  - Start with the simpler Dockerfile.builtIn and Dockerfile.judge
  - Skip Dockerfile.hf multi-arch builds (too slow) but test x86 only

### 4. Add Basic Agent Rules (2-3 hours)
- **Impact**: Better AI-generated code quality
- **Implementation**:
  - Create `.claude/rules/unit-tests.md` with pytest patterns
  - Create `.claude/rules/integration-tests.md` with TestClient patterns
  - Document detector architecture and API contracts

## Detailed Findings

### CI/CD Pipeline

**Workflows (4 total):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test-builtin-detectors.yaml` | PR + push (path-filtered) | Unit tests for built-in detectors |
| `test-huggingface-runtime.yaml` | PR + push (path-filtered) | Unit tests + model loading for HF detector |
| `test-llm-judge.yaml` | PR + push (path-filtered) | Unit tests + initialization for LLM Judge |
| `security-scan.yaml` | PR + push + weekly schedule | Trivy vulnerability & config scanning |

**Strengths:**
- Path-filtered triggers prevent unnecessary builds (e.g., built-in detector tests only run when `detectors/built_in/**` changes)
- Shared composite action (`.github/actions/test-setup/`) reduces duplication across workflows
- Pip dependency caching with hash-based cache keys
- Trivy scanning covers all 4 components independently + full repo scan
- SARIF upload to GitHub Security tab for vulnerability visibility
- Weekly scheduled security scans catch new CVEs

**Weaknesses:**
- No concurrency control (missing `concurrency:` blocks to cancel outdated runs)
- No workflow dependency chain (tests and security scans run independently, no required checks)
- No Docker build step in any PR workflow
- Pre-commit linting is effectively disabled (no config file)
- Only Python 3.11 tested (no matrix for 3.12+)

### Test Coverage

**Test Structure:**
```
tests/
  conftest.py                          (46 lines - shared fixtures)
  detectors/
    builtIn/
      test_custom.py               (171 lines)
      test_filetype.py             (358 lines)
      test_metrics.py              (287 lines)
      test_regex.py                (252 lines)
    huggingface/
      test_client_integration.py   (70 lines)
      test_method_get_probabilities.py (57 lines)
      test_method_initalize_device.py  (44 lines)
      test_method_initialize_model.py  (80 lines)
      test_method_parse_output.py      (89 lines)
      test_method_process_causal_lm.py (99 lines)
      test_method_process_sequence_classification.py (87 lines)
      test_method_process_token_classification.py    (188 lines)
      test_method_run.py               (156 lines)
      test_metrics.py                  (117 lines)
    llm_judge/
      test_llm_judge_detector.py   (587 lines)
      test_performance.py          (135 lines)
```

**Source-to-Test Ratio:** 2,823 test lines / 1,964 source lines = **1.44:1** (good ratio)

**Strengths:**
- Well-structured test organization mirroring source layout
- Extensive parametrized tests for regex detectors (credit cards, PII patterns)
- Good use of pytest fixtures and mock-based isolation
- Performance tests verifying concurrent evaluation
- Dummy models included for HF detector testing (BERT, GPT2)
- Prometheus metrics testing for observability validation
- Error handling tests (invalid regex, missing env vars, unreachable URLs)

**Weaknesses:**
- No coverage thresholds or enforcement
- No `conftest.py` files in subdirectories (could improve fixture locality)
- Some test files test individual methods rather than behavior (test_method_* pattern)
- No API contract/schema validation tests
- No negative testing for the common module (`detectors/common/`)

### Code Quality

**Linting:**
- **Status**: NOT configured
- No `.pre-commit-config.yaml`
- No `ruff.toml`, `pyproject.toml`, `.flake8`, or `mypy.ini`
- CI has dead code path checking for pre-commit config that doesn't exist
- `pre-commit` is listed as a dev dependency but never configured

**Type Checking:**
- No mypy or pyright configuration
- Some type annotations present in test files (e.g., `-> None`, `Tuple[LLMJudgeDetector, AsyncMock]`)
- Source code has minimal type annotations

**Dependency Management:**
- Per-component requirements.txt files (good isolation)
- `tox.ini` for local unified testing
- No `pyproject.toml` (would modernize the project)
- Some pinned versions, some unpinned (inconsistent)

### Container Images

**Dockerfiles (5 total):**

| File | Purpose | Multi-arch |
|------|---------|------------|
| `Dockerfile.builtIn` | Built-in detector (simple) | No |
| `Dockerfile.hf` | HuggingFace detector | Yes (x86, ppc64le, s390x) |
| `Dockerfile.judge` | LLM Judge detector (simple) | No |
| `Dockerfile.konflux.builtIn` | Konflux variant of built-in | No |
| `Dockerfile.konflux.hf` | Konflux variant of HF detector | Yes |

**Strengths:**
- UBI9 base images (Red Hat supported, security-hardened)
- Multi-stage builds for all images
- Multi-architecture support for HF detector (ppc64le, s390x with custom PyTorch builds)
- `--no-cache-dir` for pip installs (smaller images)
- Proper Red Hat labels on Konflux images

**Weaknesses:**
- No HEALTHCHECK instructions in any Dockerfile
- No non-root USER directive (runs as root)
- No `.dockerignore` file (could include unnecessary files)
- CACHEBUST ARG pattern is fragile (manual cache invalidation)
- No image vulnerability scanning in CI that fails the build
- Dockerfile.hf is extremely complex (200+ lines) with conditional multi-arch compilation

### Security

**Strengths (7.5/10):**
- Comprehensive Trivy scanning with 4 scan types:
  - Per-component filesystem vulnerability scanning
  - Per-component configuration scanning
  - Full repository scanning
  - Both SARIF (for GitHub Security tab) and human-readable table output
- Weekly scheduled scans (Monday 2 AM UTC)
- SARIF results uploaded to GitHub Security tab
- Scan artifacts retained for 30 days
- Secret detection enabled (`scanners: 'vuln,secret'`)
- Proper `.gitignore` excludes `.env` files

**Weaknesses:**
- Security scan exit code is `0` (never fails the build on vulnerabilities)
- No dependency lock files (pip freeze not committed)
- No SBOM generation
- No image signing or attestation
- No CodeQL/SAST for Python source code analysis

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None - no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: All test type rules missing (unit tests, integration tests, E2E tests)
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - Detector architecture overview
  - Unit test patterns (pytest + FastAPI TestClient)
  - Mock patterns for external dependencies (vllm_judge, transformers)
  - API contract schemas (ContentAnalysisHttpRequest/Response)
  - Prometheus metrics testing patterns

## Recommendations

### Priority 0 (Critical)

1. **Add codecov integration with coverage thresholds**
   - Add `.codecov.yml` with 80% target
   - Update all 3 test workflows to upload coverage XML
   - Add codecov PR status checks

2. **Add PR-time Docker build validation**
   - New workflow triggered on Dockerfile or requirements.txt changes
   - Build images (docker build, no push) to catch syntax and dependency issues
   - Start with builtIn and judge (simple), add HF x86-only later

3. **Create .pre-commit-config.yaml**
   - ruff for linting + formatting
   - mypy for type checking (even in basic mode)
   - Standard pre-commit hooks (trailing-whitespace, check-yaml, etc.)
   - This will activate the existing dead CI step

### Priority 1 (High Value)

4. **Add E2E container tests**
   - Build detector images, start containers, send API requests, verify responses
   - Use testcontainers-python or docker-compose for test orchestration
   - Cover all 3 detector types with basic smoke tests

5. **Add API contract tests**
   - Validate request/response schemas match the FMS Guardrails Orchestrator API spec
   - Test error responses, malformed inputs, edge cases

6. **Create agent rules for AI-assisted development**
   - `.claude/rules/unit-tests.md` - pytest patterns, fixture usage, mock strategies
   - `.claude/rules/architecture.md` - detector class hierarchy, API contracts
   - `CLAUDE.md` - project overview, development workflow, testing instructions

7. **Enforce security scan failures**
   - Change Trivy `exit-code` from `0` to `1` for HIGH/CRITICAL vulnerabilities
   - Add severity-based build failure thresholds

### Priority 2 (Nice-to-Have)

8. **Implement performance testing with locust**
   - locust is already a dev dependency but appears unused
   - Add load testing for all detector endpoints
   - Establish latency baselines and regression thresholds

9. **Add multi-version Python testing**
   - Test Python 3.12 in addition to 3.11
   - Prepare for Python 3.13 compatibility

10. **Add SBOM generation and image signing**
    - Generate SBOMs during Konflux builds
    - Add cosign signing for release images

11. **Modernize to pyproject.toml**
    - Consolidate tox.ini, requirements files, and tool configs
    - Use modern Python packaging standards

## Comparison to Gold Standards

| Dimension | guardrails-detectors | odh-dashboard (Gold) | notebooks (Gold) | Gap |
|-----------|---------------------|----------------------|-------------------|-----|
| Unit Tests | 7.5 | 9.0 | 7.0 | Need coverage enforcement |
| Integration/E2E | 4.0 | 9.0 | 8.0 | Need container-level E2E |
| Build Integration | 3.0 | 8.0 | 7.0 | Need PR-time build validation |
| Image Testing | 2.5 | 7.0 | 9.0 | Need runtime validation, healthchecks |
| Coverage Tracking | 3.5 | 9.0 | 6.0 | Need codecov + thresholds |
| CI/CD Automation | 7.0 | 9.0 | 8.0 | Need concurrency control, required checks |
| Agent Rules | 0.0 | 8.0 | 2.0 | Need full agent rule set |
| **Overall** | **5.9** | **8.7** | **7.0** | **-1.1 to -2.8** |

## File Paths Reference

### CI/CD
- `.github/workflows/test-builtin-detectors.yaml` - Built-in detector unit tests
- `.github/workflows/test-huggingface-runtime.yaml` - HF detector tests + model loading
- `.github/workflows/test-llm-judge.yaml` - LLM Judge tests + initialization
- `.github/workflows/security-scan.yaml` - Trivy vulnerability scanning
- `.github/actions/test-setup/action.yaml` - Shared composite action
- `.tekton/odh-built-in-detector-pull-request.yaml` - Konflux build for built-in
- `.tekton/odh-guardrails-detector-huggingface-runtime-pull-request.yaml` - Konflux build for HF

### Testing
- `tests/conftest.py` - Shared fixtures (path setup, Prometheus dir)
- `tests/detectors/builtIn/` - 4 test files (regex, filetype, custom, metrics)
- `tests/detectors/huggingface/` - 10 test files (methods, integration, metrics)
- `tests/detectors/llm_judge/` - 2 test files (detector, performance)
- `tests/dummy_models/` - BERT and GPT2 test models
- `tox.ini` - Local test runner configuration

### Source Code
- `detectors/common/` - Shared utilities (FastAPI app, schemas, instrumentation)
- `detectors/built_in/` - Built-in detector (regex, file type, custom)
- `detectors/huggingface/` - HuggingFace model detector
- `detectors/llm_judge/` - LLM Judge detector (vllm_judge integration)

### Container Images
- `detectors/Dockerfile.builtIn` - Built-in detector image
- `detectors/Dockerfile.hf` - HuggingFace detector (multi-arch)
- `detectors/Dockerfile.judge` - LLM Judge detector image
- `detectors/Dockerfile.konflux.builtIn` - Konflux variant of built-in
- `detectors/Dockerfile.konflux.hf` - Konflux variant of HF (multi-arch)

### Dependencies
- `detectors/common/requirements.txt` - Shared deps (FastAPI, uvicorn, prometheus)
- `detectors/common/requirements-dev.txt` - Dev deps (pytest, coverage, locust, pre-commit)
- `detectors/built_in/requirements.txt` - Built-in deps (jsonschema, xmlschema)
- `detectors/huggingface/requirements.txt` - HF deps (transformers, tiktoken)
- `detectors/llm_judge/requirements.txt` - Judge deps (vllm-judge)
