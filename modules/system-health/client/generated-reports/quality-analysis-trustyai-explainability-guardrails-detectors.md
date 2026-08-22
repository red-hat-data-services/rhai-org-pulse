---
repository: "trustyai-explainability/guardrails-detectors"
overall_score: 5.1
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Strong test suite with 16 test files, 1.4:1 test-to-code line ratio, pytest with fixtures and mocks"
  - dimension: "Integration/E2E"
    score: 4.0
    status: "FastAPI TestClient integration tests for HF detector only; no E2E, no cluster-level tests"
  - dimension: "Build Integration"
    score: 2.0
    status: "No PR-time Docker image builds, no Makefile, no manifest validation in CI"
  - dimension: "Image Testing"
    score: 3.5
    status: "3 Dockerfiles with UBI9 base and multi-stage builds, but no runtime validation or multi-arch"
  - dimension: "Coverage Tracking"
    score: 5.0
    status: "pytest-cov runs per-component in CI but no codecov integration, no thresholds, no PR reporting"
  - dimension: "CI/CD Automation"
    score: 6.5
    status: "3 component-specific test workflows with caching and path filters; no concurrency control"
  - dimension: "Static Analysis"
    score: 3.0
    status: "pre-commit in dev deps and CI action stub, but no .pre-commit-config.yaml, no linter config, no Dependabot"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No PR-time container image build validation"
    impact: "Dockerfile issues (broken COPY paths, dependency mismatches) discovered only after merge in Konflux"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No coverage threshold enforcement or PR reporting"
    impact: "Coverage can silently regress without anyone noticing; no gates on PR merges"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No E2E or integration tests with real deployment"
    impact: "Component interactions and KServe serving runtime compatibility untested before merge"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No linting configuration (.pre-commit-config.yaml, ruff, mypy)"
    impact: "Code style inconsistencies and type errors not caught until review"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No Dependabot or Renovate for dependency management"
    impact: "Stale dependencies with known vulnerabilities go undetected"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add .pre-commit-config.yaml with ruff, mypy, and basic hooks"
    effort: "2-3 hours"
    impact: "Immediate code quality enforcement; CI already has pre-commit action stub"
  - title: "Enable Dependabot for pip ecosystem"
    effort: "1 hour"
    impact: "Automated dependency update PRs with security alerts"
  - title: "Add codecov integration with --cov-fail-under threshold"
    effort: "2-3 hours"
    impact: "Coverage regression prevention and PR-level coverage visibility"
  - title: "Add concurrency control to test workflows"
    effort: "30 minutes"
    impact: "Avoid wasted CI resources on superseded pushes"
  - title: "Create CLAUDE.md with test patterns and project context"
    effort: "2-3 hours"
    impact: "AI-assisted contributions follow established patterns"
recommendations:
  priority_0:
    - "Add PR-time Docker image build validation for all 3 Dockerfiles"
    - "Configure codecov with threshold enforcement and PR coverage comments"
    - "Create .pre-commit-config.yaml with ruff linter and mypy type checker"
  priority_1:
    - "Add E2E tests that deploy detectors as KServe InferenceServices and test end-to-end"
    - "Enable Dependabot for pip, docker, and github-actions ecosystems"
    - "Add integration tests for detector-to-orchestrator communication"
  priority_2:
    - "Add multi-architecture Docker builds (amd64/arm64)"
    - "Create CLAUDE.md with project context and test creation rules"
    - "Add performance regression testing with locust (already a dev dependency)"
---

# Quality Analysis: guardrails-detectors

## Executive Summary

- **Overall Score: 5.1/10**
- **Repository**: [trustyai-explainability/guardrails-detectors](https://github.com/trustyai-explainability/guardrails-detectors)
- **Type**: Python library/service - collection of guardrails detectors (built-in, HuggingFace, LLM Judge)
- **Language**: Python 3.11+
- **Framework**: FastAPI (REST API) with pytest for testing
- **JIRA**: RHOAIENG / AI Safety (upstream tier)
- **Lines of Code**: ~2,131 (source) / ~3,087 (tests)

### Key Strengths
- Well-organized component-based test suite with 16 test files covering all 3 detector types
- Test-to-code ratio of 1.4:1 (lines) — tests are more voluminous than production code
- UBI9-based Dockerfiles (FIPS-capable base images)
- CI workflows use path-filtered triggers and pip caching via a shared composite action
- Dummy test models (BERT, GPT2) included for reproducible HF detector tests

### Critical Gaps
- No PR-time Docker image build validation — Dockerfile errors discovered post-merge
- No coverage thresholds or codecov integration — coverage can silently regress
- No E2E or cluster-level integration tests — KServe compatibility untested
- No linting enforcement — `.pre-commit-config.yaml` is missing despite pre-commit being a dev dependency
- No Dependabot/Renovate configuration for dependency updates
- No agent rules (CLAUDE.md, .claude/) for AI-assisted development

### Agent Rules Status: **Missing**

---

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 7.5/10 | 15% | 1.13 | Strong test suite with good coverage across all detector types |
| Integration/E2E | 4.0/10 | 20% | 0.80 | FastAPI TestClient tests only; no cluster-level or E2E tests |
| Build Integration | 2.0/10 | 15% | 0.30 | No PR-time Docker builds, no Makefile, no manifest validation |
| Image Testing | 3.5/10 | 10% | 0.35 | Multi-stage UBI9 Dockerfiles but no runtime validation |
| Coverage Tracking | 5.0/10 | 10% | 0.50 | pytest-cov in CI but no thresholds, no codecov, no PR reports |
| CI/CD Automation | 6.5/10 | 15% | 0.98 | Good path-filtered workflows with caching; missing concurrency control |
| Static Analysis | 3.0/10 | 10% | 0.30 | Pre-commit referenced but unconfigured; no linter, no dependency alerts |
| Agent Rules | 0.0/10 | 5% | 0.00 | No agent rules files present |
| **Overall** | **5.1/10** | **100%** | **4.35** | |

---

## Critical Gaps

### 1. No PR-time Container Image Build Validation
- **Severity**: HIGH
- **Impact**: All 3 Dockerfiles (Dockerfile.builtIn, Dockerfile.hf, Dockerfile.judge) are never built in CI. Broken COPY paths, missing dependencies, or incompatible package versions are only discovered after merge when Konflux builds run.
- **Effort**: 8-12 hours
- **Evidence**: No `docker build` or `podman build` commands in any CI workflow. No Makefile exists.

### 2. No Coverage Threshold Enforcement
- **Severity**: HIGH
- **Impact**: While `pytest-cov` runs in all 3 test workflows and generates term-missing reports, there is no `--cov-fail-under` flag, no `.codecov.yml`, and no PR coverage comment bot. Coverage can regress silently.
- **Effort**: 4-6 hours
- **Evidence**: `grep` for `fail_under`, `coverageThreshold`, and `coverage-minimum` returned no matches.

### 3. No E2E or Cluster-Level Integration Tests
- **Severity**: HIGH
- **Impact**: No `e2e/` or `integration/` directories. The only integration test is `test_client_integration.py` which uses FastAPI's `TestClient` (in-process, no network). KServe ServingRuntime and InferenceService manifests exist in `deploy/` but are never validated in CI.
- **Effort**: 16-24 hours

### 4. Missing Linting Configuration
- **Severity**: MEDIUM
- **Impact**: `pre-commit==3.8.0` is a dev dependency and the CI composite action has a pre-commit step, but `.pre-commit-config.yaml` does not exist. The CI step runs but skips with "No pre-commit config found, skipping linting". No ruff, flake8, mypy, or pylint configuration exists.
- **Effort**: 2-4 hours

### 5. No Dependency Management Automation
- **Severity**: MEDIUM
- **Impact**: No `.github/dependabot.yml` or `renovate.json`. Dependencies in `pyproject.toml` are pinned to specific versions (good for reproducibility) but will not receive automated update PRs when security vulnerabilities are discovered.
- **Effort**: 1-2 hours

---

## Quick Wins

### 1. Create `.pre-commit-config.yaml`
- **Effort**: 2-3 hours
- **Impact**: The CI infrastructure already invokes pre-commit — creating the config file will immediately enable linting enforcement.
- **Implementation**:
```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.13.0
    hooks:
      - id: mypy
        additional_dependencies: [types-PyYAML, types-requests]
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
```

### 2. Enable Dependabot
- **Effort**: 1 hour
- **Impact**: Automated dependency update PRs with security alerts.
- **Implementation**:
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/detectors"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 3. Add Coverage Threshold
- **Effort**: 2-3 hours
- **Impact**: Prevent coverage regression on every PR.
- **Implementation**: Add `--cov-fail-under=80` to pytest commands in all 3 test workflows.

### 4. Add Concurrency Control
- **Effort**: 30 minutes
- **Impact**: Cancel superseded CI runs to save resources.
- **Implementation**: Add to each workflow:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

---

## Detailed Findings

### Unit Tests (7.5/10)

**Strengths:**
- 16 test files covering all 3 detector components (built-in: 4, huggingface: 10, llm_judge: 2)
- Test-to-code ratio of 1.4:1 by line count (3,087 test lines vs 2,131 code lines)
- pytest framework with fixtures (`conftest.py`), parametrized tests (`@pytest.mark.parametrize`), and mocks (`unittest.mock`)
- Dummy models (BERT, GPT2) included in `tests/dummy_models/` for reproducible HF tests
- Good method-level test granularity for HF detector (separate test files per method: `test_method_run.py`, `test_method_parse_output.py`, etc.)

**Gaps:**
- No `test_` files for `detectors/common/` module (scheme.py, instrumented_detector.py, app.py)
- Only 2 test files for LLM Judge despite being a complex component
- No test for the shared `app.py` base class in `detectors/common/`

**Key Test Files:**
- `tests/detectors/builtIn/test_regex.py` (252 lines) — parametrized regex detection tests
- `tests/detectors/huggingface/test_client_integration.py` (70 lines) — FastAPI TestClient integration
- `tests/detectors/llm_judge/test_llm_judge_detector.py` (587 lines) — comprehensive LLM judge tests
- `tests/detectors/llm_judge/test_performance.py` — performance characterization tests

### Integration/E2E Tests (4.0/10)

**Strengths:**
- `test_client_integration.py` provides in-process integration testing of the HF detector FastAPI app lifecycle
- CI workflow for HF runtime includes model loading verification step
- CI workflow for LLM Judge includes detector initialization verification

**Gaps:**
- No `e2e/` or `integration/` directories
- No cluster-level tests (Kind, Minikube, envtest)
- No tests that validate KServe ServingRuntime or InferenceService manifests
- No tests for inter-component communication (detector <-> orchestrator)
- No multi-version testing
- Integration test only covers HF detector; built-in and LLM Judge lack integration tests

### Build Integration (2.0/10)

**Strengths:**
- 3 well-structured Dockerfiles exist (Dockerfile.builtIn, Dockerfile.hf, Dockerfile.judge)
- KServe deployment manifests exist in `detectors/*/deploy/`

**Gaps:**
- No PR-time Docker image builds in any CI workflow
- No Makefile with build targets
- No `kustomize build` or `kubectl apply --dry-run` validation
- No manifest validation for KServe resources
- KServe deployment manifests in `deploy/` are never tested or validated in CI
- Build issues only discovered post-merge in Konflux

### Image Testing (3.5/10)

**Strengths:**
- UBI9 base images (`registry.access.redhat.com/ubi9/python-312:latest`) — FIPS-capable
- Multi-stage Docker builds (base -> builder -> final)
- Health endpoint available at `/health` in the FastAPI app
- Prometheus metrics endpoint at `/metrics`

**Gaps:**
- No container runtime validation (no Testcontainers, no `docker run` tests)
- No `.dockerignore` file — potentially large unnecessary context sent during builds
- No multi-architecture support (no `--platform`, no `docker buildx`)
- No HEALTHCHECK instruction in Dockerfiles
- No image size optimization verification
- `Dockerfile.hf` runs as `USER root` then switches to `1001`, but `Dockerfile.judge` never sets a non-root user

### Coverage Tracking (5.0/10)

**Strengths:**
- `pytest-cov>=4.0` is a declared dev dependency
- All 3 test workflows use `--cov=detectors.<component>` and `--cov-report=term-missing`
- `tox.ini` configured with `--cov=detectors --cov-report=term-missing`
- `coverage==7.6.1` pinned in dev dependencies

**Gaps:**
- No `.codecov.yml` or codecov/coveralls integration
- No `--cov-fail-under` threshold in any workflow or tox.ini
- No PR coverage comment bot
- Coverage reports are terminal-only (no HTML, no XML upload)
- No combined coverage across all 3 detector components

### CI/CD Automation (6.5/10)

**Strengths:**
- 3 component-specific test workflows with path-filtered triggers (only runs when relevant files change)
- Shared composite action (`.github/actions/test-setup/action.yaml`) for consistent setup
- Pip dependency caching with content-based hash keys
- Timeout enforcement on long-running test steps (15-20 minutes)
- Python matrix strategy (currently 3.11 only, but extensible)
- Pre-commit linting step (infrastructure ready, config missing)

**Gaps:**
- No concurrency control — multiple pushes to the same PR trigger redundant runs
- No workflow for Docker image builds
- Single Python version in matrix (3.11 only)
- No scheduled test runs (only security scan runs on schedule)
- No test parallelization (tests run sequentially within each workflow)
- Security scan workflow is out of scope per analysis guidelines

### Static Analysis (3.0/10)

**Strengths:**
- `pre-commit==3.8.0` is a dev dependency
- CI composite action has pre-commit integration infrastructure
- No FIPS-incompatible crypto usage detected in source code
- UBI9 base images are FIPS-capable

**Gaps:**
- **No `.pre-commit-config.yaml`** — the CI pre-commit step always skips
- No linter configuration (no ruff.toml, .flake8, pylint, .eslintrc)
- No type checker (no mypy.ini, pyright)
- No `.github/dependabot.yml` or `renovate.json`
- No FIPS build tags or explicit FIPS configuration (Python-based, relies on OS-level FIPS)

### Agent Rules (0.0/10)

**Status**: Missing

- No `CLAUDE.md` in repository root
- No `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` test creation rules
- No `.claude/skills/` custom skills

**Recommendation**: Generate test creation rules with `/test-rules-generator` to establish:
- pytest patterns for each detector type
- Mock and fixture conventions
- FastAPI TestClient patterns
- Dummy model setup for HF tests
- Performance test patterns with locust

---

## Recommendations

### Priority 0 (Critical)

1. **Add PR-time Docker image build validation**
   - Create a CI workflow that builds all 3 Dockerfiles on PR
   - Use `docker build --target builder` to validate the build stage
   - Add startup smoke test: `docker run --rm <image> python -c "from detectors.common.app import DetectorApp; print('OK')"`

2. **Configure coverage threshold enforcement**
   - Add `--cov-fail-under=80` to all test workflow pytest commands
   - Add `.codecov.yml` with target and patch thresholds
   - Upload coverage XML to codecov for PR-level reporting

3. **Create `.pre-commit-config.yaml`**
   - Configure ruff for linting and formatting
   - Add mypy for type checking
   - Add standard pre-commit hooks (trailing whitespace, YAML validation)
   - The CI infrastructure is already in place — just needs the config file

### Priority 1 (High Value)

4. **Add E2E tests for KServe deployment**
   - Use Kind cluster to deploy InferenceServices
   - Validate detector responses through KServe prediction endpoints
   - Test detector-to-orchestrator communication patterns

5. **Enable Dependabot**
   - Cover pip, docker, and github-actions ecosystems
   - Configure auto-merge for patch updates

6. **Add integration tests for all detector types**
   - Extend FastAPI TestClient pattern from HF detector to built-in and LLM Judge
   - Test detector API contracts against orchestrator expectations

### Priority 2 (Nice-to-Have)

7. **Add multi-architecture Docker builds**
   - Use `docker buildx` for amd64/arm64 support
   - Test on both architectures in CI

8. **Create CLAUDE.md with project context**
   - Document project structure and detector types
   - Establish test creation patterns and conventions
   - Add contributing guidelines for AI-assisted development

9. **Leverage locust for performance regression testing**
   - `locust==2.31.1` is already a dev dependency
   - Create baseline performance tests for each detector type
   - Add performance regression detection to CI

---

## Comparison to Gold Standards

| Dimension | guardrails-detectors | odh-dashboard | notebooks | kserve |
|-----------|---------------------|---------------|-----------|--------|
| Unit Tests | 7.5 - Good pytest suite | 9.0 - Multi-layer Jest/RTL | 7.0 - Notebook validation | 8.5 - Comprehensive Go tests |
| Integration/E2E | 4.0 - TestClient only | 9.0 - Cypress E2E | 6.0 - Image boot tests | 9.0 - Multi-version E2E |
| Build Integration | 2.0 - No PR builds | 8.0 - Full PR validation | 7.0 - Image builds in CI | 8.5 - Operator deployment |
| Image Testing | 3.5 - UBI9, no runtime tests | 7.0 - Container validation | 9.0 - 5-layer validation | 7.0 - Runtime tests |
| Coverage Tracking | 5.0 - pytest-cov, no thresholds | 8.0 - Codecov with gates | 5.0 - Basic coverage | 9.0 - Strict enforcement |
| CI/CD Automation | 6.5 - Path filters, caching | 9.0 - Comprehensive CI | 8.0 - Matrix testing | 9.0 - Full automation |
| Static Analysis | 3.0 - Stub only | 8.0 - ESLint + TypeScript | 6.0 - Basic linting | 8.0 - golangci-lint |
| Agent Rules | 0.0 - Missing | 8.0 - Comprehensive | 3.0 - Minimal | 2.0 - Basic |
| **Overall** | **5.1** | **8.5** | **6.5** | **8.0** |

---

## File Paths Reference

### CI/CD
- `.github/workflows/test-builtin-detectors.yaml` — Built-in detector unit tests
- `.github/workflows/test-huggingface-runtime.yaml` — HuggingFace runtime unit tests
- `.github/workflows/test-llm-judge.yaml` — LLM Judge unit tests
- `.github/workflows/security-scan.yaml` — Trivy security scanning (out of scope)
- `.github/actions/test-setup/action.yaml` — Shared composite action for test setup

### Testing
- `tests/conftest.py` — Shared test fixtures (path setup, Prometheus dir)
- `tests/detectors/builtIn/` — 4 test files for built-in detectors
- `tests/detectors/huggingface/` — 10 test files for HF detector
- `tests/detectors/llm_judge/` — 2 test files for LLM Judge
- `tests/dummy_models/` — BERT and GPT2 dummy models for testing
- `tox.ini` — Tox configuration with pytest-cov

### Source Code
- `detectors/pyproject.toml` — Project dependencies and build config
- `detectors/common/` — Shared FastAPI app base, instrumentation, schema
- `detectors/built_in/` — Regex, file type, and custom detectors
- `detectors/huggingface/` — HuggingFace transformer-based detector
- `detectors/llm_judge/` — LLM Judge detector using vllm-judge

### Container Images
- `detectors/Dockerfile.builtIn` — Built-in detector image (UBI9)
- `detectors/Dockerfile.hf` — HuggingFace detector image (UBI9)
- `detectors/Dockerfile.judge` — LLM Judge detector image (UBI9)

### Deployment
- `detectors/huggingface/deploy/` — KServe ServingRuntime, InferenceService, model container manifests
- `detectors/llm_judge/deploy/` — KServe ServingRuntime and InferenceService manifests
