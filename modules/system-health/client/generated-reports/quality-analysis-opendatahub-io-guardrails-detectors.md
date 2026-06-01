---
repository: "opendatahub-io/guardrails-detectors"
overall_score: 5.9
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Strong test suite with 16 test files covering all 3 detector types, good use of parametrized tests and mocking"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "No integration or E2E tests; client integration test is unit-level with mocked dependencies"
  - dimension: "Build Integration"
    score: 2.0
    status: "No PR-time Docker image builds, no Konflux simulation, no image validation in CI"
  - dimension: "Image Testing"
    score: 2.5
    status: "Three Dockerfiles exist with multi-stage builds but no runtime validation, no container scanning in CI"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "pytest-cov runs in CI with term-missing output but no codecov integration, no thresholds, no PR gating"
  - dimension: "CI/CD Automation"
    score: 6.5
    status: "Well-structured per-component workflows with path filtering, caching, and composite action; but no concurrency control"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, .claude/ directory, or agent rules of any kind"
critical_gaps:
  - title: "No integration or E2E testing"
    impact: "API contract violations, inter-component issues, and deployment failures are not caught before merge"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No PR-time container image builds or validation"
    impact: "Dockerfile regressions discovered only in downstream Konflux builds after merge"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No coverage enforcement or tracking"
    impact: "Coverage can silently degrade with no visibility into trends or regressions"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container image scanning in CI"
    impact: "Built images may ship with known vulnerabilities in base images or pip-installed packages"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No pre-commit hooks configured"
    impact: "Linting is referenced in CI composite action but .pre-commit-config.yaml is missing; linting step silently skips"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add codecov integration and PR gating"
    effort: "2-4 hours"
    impact: "Immediate visibility into coverage trends and regression prevention"
  - title: "Create .pre-commit-config.yaml with ruff/black/mypy"
    effort: "1-2 hours"
    impact: "Consistent code quality enforcement; currently linting step in CI silently skips"
  - title: "Add concurrency control to PR workflows"
    effort: "30 minutes"
    impact: "Cancel stale CI runs on force-push, reducing resource waste"
  - title: "Add PR-time Dockerfile build smoke test"
    effort: "2-3 hours"
    impact: "Catch Dockerfile regressions before merge"
recommendations:
  priority_0:
    - "Add codecov integration with coverage thresholds (e.g., 70% minimum, no PR regressions)"
    - "Create .pre-commit-config.yaml with ruff, black, mypy, and bandit"
    - "Add container image build validation to PR workflows for all 3 Dockerfiles"
  priority_1:
    - "Implement FastAPI TestClient integration tests that exercise the full API path per detector"
    - "Add Trivy container image scanning to CI for built images"
    - "Create agent rules (.claude/rules/) for unit test and integration test patterns"
    - "Add concurrency control to all PR workflows"
  priority_2:
    - "Add E2E tests with testcontainers or docker-compose for multi-detector scenarios"
    - "Implement contract tests for the IBM Detector API specification"
    - "Add performance regression testing (latency/throughput benchmarks)"
    - "Add multi-architecture image build validation (ppc64le, s390x)"
---

# Quality Analysis: guardrails-detectors

## Executive Summary

- **Overall Score: 5.9/10**
- **Repository Type**: Python library/microservices — detector algorithms for FMS Guardrails Orchestrator
- **Primary Language**: Python 3.11
- **Framework**: FastAPI + uvicorn, deployed as containerized microservices
- **Components**: 3 detector types (built-in, Hugging Face, LLM Judge) + common library
- **Key Strengths**: Good unit test coverage with parametrized tests, well-structured per-component CI, comprehensive Trivy filesystem security scanning, multi-arch Docker support
- **Critical Gaps**: No integration/E2E tests, no PR-time image builds, no coverage tracking/enforcement, no pre-commit hooks despite CI referencing them, no agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, no .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | Strong test suite: 16 test files, 2,777 LOC tests vs 1,964 LOC source (1.41:1 ratio), parametrized tests, good mocking |
| Integration/E2E | 3.0/10 | No integration or E2E tests; no multi-component testing |
| **Build Integration** | **2.0/10** | **No PR-time Docker builds, no Konflux simulation, no image validation** |
| Image Testing | 2.5/10 | Three Dockerfiles with multi-stage builds exist but zero runtime/startup validation |
| Coverage Tracking | 4.0/10 | pytest-cov runs in CI but no codecov/coveralls, no thresholds, no PR gating |
| CI/CD Automation | 6.5/10 | Well-organized per-component workflows with path filtering and caching; composite action for DRY setup |
| Agent Rules | 0.0/10 | Completely absent — no CLAUDE.md, no .claude/ directory, no test automation guidance |

## Critical Gaps

### 1. No Integration or E2E Testing
- **Impact**: API contract violations, detector inter-component issues, and deployment configuration errors are not caught before merge
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Detail**: The test suite consists entirely of unit tests with mocked dependencies. There are no tests that start the FastAPI server, invoke endpoints through HTTP, or validate detector behavior end-to-end. The `test_client_integration.py` file is misleadingly named — it tests with mocks, not actual service integration.

### 2. No PR-Time Container Image Build Validation
- **Impact**: Dockerfile regressions (broken COPY paths, missing dependencies, syntax errors) are only discovered in downstream Konflux builds after merge
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Detail**: Three Dockerfiles exist (`Dockerfile.hf`, `Dockerfile.judge`, `Dockerfile.builtIn`) but none are built or validated in PR CI. The HF Dockerfile is particularly complex with multi-arch support for ppc64le/s390x.

### 3. No Coverage Tracking or Enforcement
- **Impact**: Coverage can silently regress with no visibility; no baseline, no trends, no PR-level reporting
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Detail**: While `pytest --cov` runs in CI and outputs terminal coverage, there is no codecov.yml, no .coveragerc, no coverage upload step, and no minimum threshold enforcement.

### 4. No Container Image Scanning in CI
- **Impact**: Built container images may ship with known CVEs in base images (UBI9) or pip-installed packages
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Detail**: The security-scan.yaml workflow performs filesystem scanning with Trivy (good!) but does NOT scan the actual built container images. Filesystem scanning catches Python dependency vulnerabilities but misses base image CVEs and build-time injections.

### 5. Pre-commit Configuration Missing
- **Impact**: The CI composite action checks for `.pre-commit-config.yaml` and silently skips linting when it's not found, meaning no code quality enforcement happens
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Detail**: The `test-setup` composite action has a `precommit_paths` input and a "Lint with pre-commit" step, but the repo has no `.pre-commit-config.yaml` file. This step is a no-op in CI. The `requirements-dev.txt` lists `pre-commit==3.8.0` as a dependency, suggesting pre-commit was intended but never configured.

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
Immediate visibility into coverage trends with zero test-writing effort:
```yaml
# Add to each test workflow after pytest step:
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    flags: ${{ matrix.component || 'builtin' }}
    fail_ci_if_error: false
```
Plus add `.codecov.yml`:
```yaml
coverage:
  status:
    project:
      default:
        target: 70%
    patch:
      default:
        target: 80%
```

### 2. Create .pre-commit-config.yaml (1-2 hours)
Enable the linting path that CI already attempts to run:
```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.4.0
    hooks:
      - id: ruff
      - id: ruff-format
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.10.0
    hooks:
      - id: mypy
        additional_dependencies: [pydantic, fastapi]
  - repo: https://github.com/PyCQA/bandit
    rev: 1.7.8
    hooks:
      - id: bandit
        args: ['-c', 'pyproject.toml']
```

### 3. Add Concurrency Control (30 minutes)
Prevent wasted CI runs on rapid pushes:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 4. Add PR-Time Dockerfile Build Smoke Test (2-3 hours)
Catch Dockerfile regressions before merge:
```yaml
- name: Build Docker image (smoke test)
  run: |
    docker build -t test-builtin:ci -f detectors/Dockerfile.builtIn detectors/
```

## Detailed Findings

### CI/CD Pipeline

**Workflows (6 total):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test-builtin-detectors.yaml` | PR + push (path-filtered) | Unit tests for built-in detectors |
| `test-huggingface-runtime.yaml` | PR + push (path-filtered) | Unit tests for HF detector + model loading verification |
| `test-llm-judge.yaml` | PR + push (path-filtered) | Unit tests for LLM Judge detector |
| `security-scan.yaml` | PR + push + weekly schedule + manual | Trivy filesystem scanning per component |
| `sync-branch-incubation.yaml` | Push to main | Auto-sync main → incubation via PR |
| `sync-branch-stable.yaml` | Push to incubation | Auto-sync incubation → stable via PR |

**Strengths:**
- Path-filtered triggers — tests only run when relevant code changes
- Shared composite action (`.github/actions/test-setup/action.yaml`) for DRY setup
- Pip dependency caching with hash-based cache keys
- Per-component Trivy security scanning with SARIF upload to GitHub Security tab
- Mergify configured for automated branch syncing (main → incubation → stable)
- Timeout limits on test steps to prevent hung tests

**Gaps:**
- No concurrency control — rapid pushes run parallel redundant CI
- No E2E or integration test workflows
- No container image build step in any PR workflow
- Pre-commit linting step in composite action is a no-op (no config file)

### Test Coverage

**Test-to-Code Ratio**: 1.41:1 (2,777 test LOC / 1,964 source LOC) — excellent ratio

**Per-Component Breakdown:**

| Component | Test Files | Test LOC | Source LOC | Ratio |
|-----------|-----------|----------|------------|-------|
| Built-in | 4 | 1,068 | 558 | 1.91:1 |
| Hugging Face | 10 | 987 | 496 | 1.99:1 |
| LLM Judge | 2 | 722 | 275 | 2.63:1 |
| Common | 0 | 0 | 459 | 0:1 |

**Strengths:**
- Excellent parametrized tests for regex detectors (credit cards, PII patterns, edge cases)
- Good mock-based testing for LLM Judge detector
- Dummy model infrastructure for HF detector testing
- Error handling tests (invalid regex, missing env vars, null scores)
- Shared conftest.py with path setup and Prometheus directory management

**Gaps:**
- No tests for `detectors/common/` (app.py, scheme.py, instrumented_detector.py = 459 LOC untested)
- No integration tests that exercise the FastAPI TestClient across component boundaries
- No API contract tests validating against the IBM Detector API specification
- No performance/load testing (locust is in dev requirements but no test files use it)
- `test_client_integration.py` is misnamed — uses mocks, not real client integration

### Code Quality

**Linting**: No active enforcement
- No `.pre-commit-config.yaml` (despite `pre-commit` being in dev dependencies)
- No `ruff.toml`, `.flake8`, `mypy.ini`, or `pyproject.toml` with tool sections
- No `setup.cfg` or `setup.py` — not packaged as a Python library
- CI linting step silently skips due to missing config

**Static Analysis**: Filesystem-level only
- Trivy filesystem scanning runs on PRs (good for dependency vulns)
- No CodeQL, Semgrep, or Bandit integration
- No type checking (mypy/pyright) despite type hints in code

**Code Organization**: Well-structured
- Clear separation: `detectors/{component}/` for source, `tests/detectors/{component}/` for tests
- Shared common library with Pydantic models and FastAPI app base
- `tox.ini` for local test execution

### Container Images

**Dockerfiles (3):**

| Image | Base | Multi-stage | Multi-arch | Complexity |
|-------|------|-------------|------------|------------|
| `Dockerfile.hf` | UBI9 minimal | Yes (4 stages) | x86_64, ppc64le, s390x | High — builds PyTorch from source for ppc64le/s390x |
| `Dockerfile.judge` | UBI9 minimal | Yes (3 stages) | x86_64 only | Low |
| `Dockerfile.builtIn` | UBI9 minimal | Yes (3 stages) | x86_64 only | Low |

**Strengths:**
- Multi-stage builds for smaller final images
- UBI9 minimal base image (Red Hat supported)
- Prometheus metrics directory configured
- HF image supports 3 architectures with conditional torch builds

**Gaps:**
- No HEALTHCHECK directives
- No image startup validation in CI
- No container scanning of built images
- No user directive (runs as root by default)
- No `.dockerignore` file — build context may include unnecessary files
- CACHEBUST arg without proper documentation

### Security

**Strengths:**
- Comprehensive Trivy filesystem scanning per component
- Weekly scheduled security scans
- SARIF upload to GitHub Security tab for trend tracking
- Secret scanning enabled in Trivy config
- Vuln + config scanning both run

**Gaps:**
- No container image scanning (filesystem only)
- No SAST/CodeQL integration
- No Bandit for Python-specific security analysis
- No dependency pinning validation (requirements.txt uses mixed pinned/unpinned)
- No secret detection pre-commit hook (gitleaks/trufflehog)
- Base images not pinned to digest (uses tag `ubi9/ubi-minimal`)

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: 
  - No test creation rules for any test type
  - No coding standards documentation for agents
  - No framework-specific guidance (FastAPI, pytest patterns)
  - No PR checklist or quality gates
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - Unit test patterns (pytest, FastAPI TestClient, parametrize)
  - Integration test patterns (testcontainers, docker-compose)
  - Mock patterns (AsyncMock for vllm_judge, HF transformers)
  - Code review checklist

## Recommendations

### Priority 0 (Critical — Do These First)

1. **Add codecov integration with coverage thresholds** (2-4 hours)
   - Upload coverage artifacts from all 3 test workflows
   - Set minimum 70% project coverage, 80% patch coverage
   - Enable PR comments with coverage diff

2. **Create .pre-commit-config.yaml** (1-2 hours)
   - ruff (linting + formatting), mypy (type checking), bandit (security)
   - This makes the existing CI linting step functional

3. **Add PR-time Docker image builds** (3-4 hours)
   - Build all 3 images as smoke tests in PR CI
   - Verify images start and respond to health check

### Priority 1 (High Value — Next Sprint)

4. **Add FastAPI integration tests** (8-12 hours)
   - Use `TestClient` with real (not mocked) detector instances where feasible
   - Test full API paths: POST /api/v1/text/contents, GET /registry, GET /metrics
   - Validate response schemas against IBM Detector API spec

5. **Add Trivy container image scanning** (4-6 hours)
   - Build images in CI, then scan with Trivy
   - Set severity thresholds (fail on HIGH/CRITICAL)
   - Upload SARIF results alongside filesystem scan results

6. **Create agent rules** (3-4 hours)
   - `.claude/rules/unit-tests.md` — pytest patterns, fixtures, parametrize
   - `.claude/rules/integration-tests.md` — FastAPI TestClient, test isolation
   - `CLAUDE.md` — project overview, coding standards, PR checklist

7. **Add concurrency control to all workflows** (30 minutes)

### Priority 2 (Nice-to-Have — Backlog)

8. **Add contract tests for IBM Detector API** (8-12 hours)
   - Validate all endpoints match the upstream API specification
   - Test serialization/deserialization of all Pydantic models

9. **Add performance regression testing** (4-6 hours)
   - locust is already in dev dependencies but unused
   - Create locustfile for each detector type
   - Set latency/throughput baselines

10. **Add multi-arch image build validation** (4-6 hours)
    - Validate ppc64le/s390x builds in CI with QEMU
    - Critical for Dockerfile.hf which has complex arch-specific logic

11. **Add E2E tests with testcontainers** (12-16 hours)
    - Spin up detector containers
    - Send real inference requests
    - Validate end-to-end behavior

## Comparison to Gold Standards

| Dimension | guardrails-detectors | odh-dashboard | notebooks | kserve |
|-----------|---------------------|---------------|-----------|--------|
| Unit Tests | 7.5 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 3.0 | 9.0 | 7.0 | 9.0 |
| Build Integration | 2.0 | 7.0 | 8.0 | 7.0 |
| Image Testing | 2.5 | 6.0 | 9.0 | 7.0 |
| Coverage Tracking | 4.0 | 8.0 | 5.0 | 9.0 |
| CI/CD Automation | 6.5 | 9.0 | 8.0 | 9.0 |
| Agent Rules | 0.0 | 8.0 | 3.0 | 2.0 |
| **Overall** | **5.9** | **8.5** | **7.0** | **8.0** |

**Key Takeaways vs Gold Standards:**
- Unit tests are a strength — ratio exceeds most gold standards
- Biggest gaps are in integration testing, image validation, and coverage tracking
- Security scanning (filesystem) is above average with per-component Trivy
- Agent rules are a greenfield opportunity
- Branch syncing automation (main → incubation → stable) is well-implemented

## File Paths Reference

### CI/CD
- `.github/workflows/test-builtin-detectors.yaml` — Built-in detector unit tests
- `.github/workflows/test-huggingface-runtime.yaml` — HF detector unit tests + model loading
- `.github/workflows/test-llm-judge.yaml` — LLM Judge unit tests
- `.github/workflows/security-scan.yaml` — Trivy filesystem scanning (per-component + repo-wide)
- `.github/workflows/sync-branch-incubation.yaml` — Auto-sync main → incubation
- `.github/workflows/sync-branch-stable.yaml` — Auto-sync incubation → stable
- `.github/actions/test-setup/action.yaml` — Shared composite action for test setup

### Testing
- `tests/conftest.py` — Shared fixtures (path setup, Prometheus dir)
- `tests/detectors/builtIn/` — 4 test files (regex, filetype, custom, metrics)
- `tests/detectors/huggingface/` — 10 test files (methods, integration, metrics)
- `tests/detectors/llm_judge/` — 2 test files (detector, performance)
- `tests/dummy_models/` — Pre-built BERT and GPT2 dummy models for testing
- `tox.ini` — Local test runner configuration

### Container Images
- `detectors/Dockerfile.hf` — HF detector (multi-arch, 4-stage)
- `detectors/Dockerfile.judge` — LLM Judge detector (3-stage)
- `detectors/Dockerfile.builtIn` — Built-in detector (3-stage)

### Configuration
- `.mergify.yml` — Branch backport automation
- `.github/pull.yml` — Upstream sync from trustyai-explainability
- `detectors/common/requirements-dev.txt` — Dev dependencies (pytest, pre-commit, locust)
