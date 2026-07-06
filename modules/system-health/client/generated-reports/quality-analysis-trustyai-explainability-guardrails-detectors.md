---
repository: "trustyai-explainability/guardrails-detectors"
overall_score: 6.4
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Strong unit test coverage with 161 tests across all detector components; 1.45:1 test-to-code ratio"
  - dimension: "Integration/E2E"
    score: 5.0
    status: "FastAPI TestClient integration tests for builtIn and HF detectors; no E2E with real models or orchestrator"
  - dimension: "Build Integration"
    score: 3.0
    status: "No PR-time container build validation; no Konflux simulation; Dockerfiles not tested in CI"
  - dimension: "Image Testing"
    score: 2.0
    status: "Three Dockerfiles present but no image build, startup, or runtime validation in CI"
  - dimension: "Coverage Tracking"
    score: 5.0
    status: "pytest-cov runs in CI with term-missing output; no codecov/coveralls, no thresholds, no PR gating"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "Well-structured per-component workflows with path filtering, caching, shared action; no concurrency control"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory; zero AI agent guidance"
critical_gaps:
  - title: "No container image build or runtime testing in CI"
    impact: "Image build failures and startup issues discovered only after merge/deployment"
    severity: "HIGH"
    effort: "6-8 hours"
  - title: "No coverage thresholds or PR gating"
    impact: "Coverage can regress silently; no enforcement prevents untested code from merging"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No E2E tests with real model inference or orchestrator integration"
    impact: "Integration issues between detectors and the FMS Guardrails Orchestrator go undetected until production"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No pre-commit config committed to repository"
    impact: "Code quality checks rely on CI only; developers may push linting violations"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No concurrency control on CI workflows"
    impact: "Rapid pushes can cause redundant CI runs and wasted resources"
    severity: "LOW"
    effort: "1 hour"
quick_wins:
  - title: "Add codecov integration with coverage thresholds"
    effort: "2-3 hours"
    impact: "Enforce minimum coverage on PRs and track coverage trends over time"
  - title: "Add concurrency control to all workflows"
    effort: "30 minutes"
    impact: "Cancel redundant CI runs on rapid pushes, saving runner time"
  - title: "Add container image build smoke test to PR workflow"
    effort: "2-3 hours"
    impact: "Catch Dockerfile and dependency issues before merge"
  - title: "Create .pre-commit-config.yaml with ruff and mypy"
    effort: "1-2 hours"
    impact: "Enforce code quality locally before push, reducing CI failures"
  - title: "Add basic CLAUDE.md with test patterns"
    effort: "1-2 hours"
    impact: "Guide AI agents to produce tests matching existing patterns"
recommendations:
  priority_0:
    - "Add container image build validation to PR workflows (build all three Dockerfiles)"
    - "Integrate codecov with coverage thresholds (e.g., 80% minimum, no regression on PR)"
    - "Add image startup smoke tests (container runs and responds to health check)"
  priority_1:
    - "Create E2E test suite that exercises detector APIs with real model inference"
    - "Add integration tests with FMS Guardrails Orchestrator mock or test harness"
    - "Create comprehensive CLAUDE.md and .claude/rules/ for test automation guidance"
    - "Add .pre-commit-config.yaml with ruff, mypy, and security checks"
  priority_2:
    - "Add multi-architecture image builds (amd64/arm64)"
    - "Add SBOM generation and image signing"
    - "Add load/performance testing in periodic CI (locust is already a dev dependency)"
    - "Add Dependabot or Renovate for automated dependency updates"
---

# Quality Analysis: guardrails-detectors

## Executive Summary

- **Overall Score: 6.4/10**
- **Repository**: [trustyai-explainability/guardrails-detectors](https://github.com/trustyai-explainability/guardrails-detectors)
- **Type**: Python microservices (FastAPI-based detector algorithms for FMS Guardrails Orchestrator)
- **Language**: Python 3.11+
- **Framework**: FastAPI + uvicorn, pytest for testing
- **Components**: 3 detector types (built-in, HuggingFace, LLM Judge)

### Key Strengths
- **Excellent test-to-code ratio** (3,087 test LOC vs 2,131 source LOC = 1.45:1)
- **161 well-organized unit tests** across all three detector components
- **Comprehensive security scanning** with Trivy (filesystem + config scanning, weekly scheduled runs, SARIF upload to GitHub Security)
- **Smart CI design**: shared composite action (`test-setup`), path-filtered per-component workflows, pip caching
- **FastAPI TestClient integration tests** for built-in and HuggingFace detectors
- **Dummy models** committed for reproducible HF detector testing without GPU/network

### Critical Gaps
- **No container image testing in CI** — three Dockerfiles exist but are never built or validated in workflows
- **No coverage enforcement** — pytest-cov generates reports but no thresholds or PR gating exist
- **No E2E testing** — detectors are tested in isolation; no integration with the orchestrator
- **No agent rules** — zero guidance for AI-assisted development

### Agent Rules Status: **Missing**

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.0/10 | Strong coverage with 161 tests, good mocking patterns, dummy models |
| Integration/E2E | 5.0/10 | TestClient integration tests; no E2E with real models or orchestrator |
| **Build Integration** | **3.0/10** | **No PR-time container builds; no Konflux simulation** |
| Image Testing | 2.0/10 | Dockerfiles present but never built or validated in CI |
| Coverage Tracking | 5.0/10 | pytest-cov runs but no codecov, no thresholds, no PR gating |
| CI/CD Automation | 7.0/10 | Well-structured workflows with shared action, path filtering, caching |
| Agent Rules | 0.0/10 | No CLAUDE.md, AGENTS.md, or .claude/ directory |

## Critical Gaps

### 1. No Container Image Build/Runtime Testing in CI
- **Impact**: Image build failures and startup issues discovered only post-merge
- **Severity**: HIGH
- **Effort**: 6-8 hours
- **Details**: Three Dockerfiles (`Dockerfile.hf`, `Dockerfile.judge`, `Dockerfile.builtIn`) use `registry.access.redhat.com/ubi9/python-312:latest` as base but none are built in any PR or push workflow. A simple `podman build` step would catch dependency resolution failures, COPY path issues, and base image incompatibilities.

### 2. No Coverage Enforcement
- **Impact**: Coverage can regress silently; untested code merges freely
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: All three test workflows run `pytest --cov --cov-report=term-missing` but output is only printed to logs. No `.codecov.yml`, no coverage thresholds in pytest config, no PR check gates.

### 3. No E2E Tests with Real Model Inference
- **Impact**: Integration bugs between detectors and the Guardrails Orchestrator go undetected
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: Unit tests mock all external dependencies (vllm_judge, model loading). While HF tests use dummy models for tokenizer/model initialization, there are no tests that exercise the full request→inference→response pipeline against a real (or realistic) model serving endpoint.

### 4. No Pre-commit Configuration
- **Impact**: Developers may push code with linting violations
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: The shared `test-setup` action attempts to run `pre-commit` if `.pre-commit-config.yaml` exists, but no such file is committed. The `pre-commit` package is installed as a dev dependency but goes unused.

### 5. No Concurrency Control
- **Impact**: Redundant CI runs on rapid pushes
- **Severity**: LOW
- **Effort**: 1 hour
- **Details**: None of the four workflows use `concurrency` groups. Rapid pushes to the same branch trigger duplicate runs.

## Quick Wins

### 1. Add Codecov Integration (2-3 hours)
```yaml
# Add to each test workflow after pytest step:
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    flags: ${{ matrix.component }}
    fail_ci_if_error: true
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
        target: 90%
```

### 2. Add Concurrency Control (30 minutes)
```yaml
# Add to each workflow:
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 3. Container Build Smoke Test (2-3 hours)
```yaml
# New workflow or add to existing:
- name: Build detector images
  run: |
    podman build -t test-builtin -f detectors/Dockerfile.builtIn detectors
    podman build -t test-hf -f detectors/Dockerfile.hf detectors
    podman build -t test-judge -f detectors/Dockerfile.judge detectors
```

### 4. Create .pre-commit-config.yaml (1-2 hours)
```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.4.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.9.0
    hooks:
      - id: mypy
        additional_dependencies: [types-PyYAML, types-requests]
```

### 5. Add Basic CLAUDE.md (1-2 hours)
Create a `CLAUDE.md` with test patterns, project structure, and development guidelines to guide AI agents.

## Detailed Findings

### CI/CD Pipeline

**Workflows (4 total):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test-builtin-detectors.yaml` | push/PR (path-filtered) | Unit tests for built-in detectors |
| `test-huggingface-runtime.yaml` | push/PR (path-filtered) | Unit tests for HF detector + model loading validation |
| `test-llm-judge.yaml` | push/PR (path-filtered) | Unit tests for LLM Judge detector |
| `security-scan.yaml` | push/PR + weekly schedule + manual | Trivy filesystem + config scanning per component |

**Strengths:**
- Shared composite action (`.github/actions/test-setup/`) handles Python setup, pip caching, dependency installation, and optional pre-commit — excellent DRY practice
- Path-filtered triggers prevent unnecessary CI runs when unrelated files change
- Pip dependency caching with content-hash cache keys
- Model loading verification step in HF workflow
- Security scan uses matrix strategy to scan each component independently

**Weaknesses:**
- No concurrency control on any workflow
- No container image builds in any workflow
- No release/tag workflows
- No dependency update automation (Dependabot/Renovate)
- Pre-commit step will always skip (no config file committed)

### Test Coverage

**Test Inventory:**

| Component | Test Files | Tests | LOC | Coverage Command |
|-----------|-----------|-------|-----|------------------|
| Built-in | 4 | ~50 | 1,068 | `--cov=detectors.built_in` |
| HuggingFace | 10 | ~80 | 1,251 | `--cov=detectors.huggingface` |
| LLM Judge | 2 | ~31 | 722 | `--cov=detectors.llm_judge` |
| **Total** | **16** | **161** | **3,087** | |

**Strengths:**
- Excellent test-to-code ratio: 3,087 test LOC / 2,131 source LOC = **1.45:1**
- Well-organized test structure mirrors source structure
- Method-level test files for HF detector (e.g., `test_method_process_causal_lm.py`)
- Custom detector safety tests verify sandbox (unsafe code injection detection)
- Performance/concurrency tests for LLM Judge
- Dummy models committed for reproducible testing without network/GPU access
- FastAPI TestClient used for API-level integration tests

**Weaknesses:**
- No coverage thresholds or enforcement
- No codecov/coveralls integration
- No PR coverage reporting
- All external dependencies mocked in LLM Judge tests
- No contract tests for the detector API schema
- No negative/edge-case tests for API error handling across components

### Code Quality

**Tools Present:**
- `pytest` 8.3.2 with `pytest-cov`
- `pre-commit` 3.8.0 (dev dependency, but no config file)
- `tox` for local test orchestration
- `locust` 2.31.1 (dev dependency for load testing, but no locustfile found)

**Tools Missing:**
- No `.pre-commit-config.yaml` — pre-commit is installed but not configured
- No linter configuration (no ruff.toml, flake8, mypy.ini, pylint)
- No type checking (no mypy, pyright, or pytype)
- No code formatter configuration (no black, ruff format, autopep8)

### Container Images

**Dockerfiles (3):**

| Dockerfile | Base Image | Purpose |
|-----------|-----------|---------|
| `Dockerfile.builtIn` | `ubi9/python-312` | Built-in regex/filetype/custom detectors |
| `Dockerfile.hf` | `ubi9/python-312` | HuggingFace model-based detector |
| `Dockerfile.judge` | `ubi9/python-312` | LLM Judge detector |

**Strengths:**
- Red Hat UBI9 base images (enterprise-grade, security-hardened)
- Multi-stage builds (base → builder → final)
- Non-root user execution (USER 1001)
- Prometheus multiprocess directory setup
- Minimal COPY (only required files, not full repo)

**Weaknesses:**
- No image builds in CI — build failures only caught manually
- No image startup/health check testing
- No multi-architecture support (only amd64)
- No SBOM generation
- No image signing or attestation
- `ARG CACHEBUST=1` is a workaround suggesting caching issues
- No `.dockerignore` optimization (`.gitignore` exists but no `.dockerignore`)
- Dockerfile.judge does not set non-root user

### Security

**Strengths (Security Scanning):**
- **Trivy filesystem scanning**: Runs on every push/PR, scans each component independently via matrix strategy
- **Trivy config scanning**: Checks IaC/Dockerfile misconfigurations
- **SARIF upload**: Results uploaded to GitHub Security tab for tracking
- **Weekly scheduled scans**: Catches newly discovered CVEs
- **Secret scanning**: Trivy scanners include `vuln,secret`
- **Human-readable reports**: Table format reports uploaded as artifacts
- **Custom detector sandbox**: Security-aware code — blocks unsafe imports in user-provided custom detectors

**Weaknesses:**
- No SAST/CodeQL integration
- No dependency scanning beyond Trivy (no Dependabot alerts configured)
- No container image scanning (only filesystem scanning)
- No secret detection tool (e.g., Gitleaks, TruffleHog) — relies on Trivy secrets scanner only

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **`.claude/` directory**: Not present
- **`.claude/rules/`**: Not present
- **Coverage**: Zero test types have rules
- **Quality**: N/A
- **Gaps**: Everything — no unit test patterns, no integration test guidance, no API contract definitions, no mocking standards
- **Recommendation**: Generate rules with `/test-rules-generator` covering:
  - Unit test patterns (pytest fixtures, mocking conventions)
  - FastAPI TestClient integration patterns
  - Detector API schema and contract expectations
  - Performance test patterns with async mocking
  - Custom detector safety testing patterns

## Recommendations

### Priority 0 (Critical)

1. **Add container image build validation to PR workflows**
   - Build all three Dockerfiles on every PR
   - Add basic startup validation (container starts and responds to health check)
   - Effort: 6-8 hours

2. **Integrate codecov with coverage thresholds**
   - Upload coverage from each component workflow
   - Set minimum 80% project coverage, 90% patch coverage
   - Block PR merge on coverage regression
   - Effort: 2-4 hours

3. **Add image startup smoke tests**
   - After building, run each container and verify:
     - Process starts without error
     - HTTP endpoint responds (e.g., `/docs` or health endpoint)
     - Graceful shutdown works
   - Effort: 3-4 hours

### Priority 1 (High Value)

4. **Create E2E test suite with real model inference**
   - Use smaller/quantized models for CI-feasible testing
   - Test full request → model inference → response pipeline
   - Test detector interaction with orchestrator API contracts
   - Effort: 16-24 hours

5. **Add .pre-commit-config.yaml with ruff and mypy**
   - Leverage the already-installed pre-commit dev dependency
   - Include ruff (linting + formatting), mypy (type checking), and security checks
   - Effort: 1-2 hours

6. **Create comprehensive agent rules**
   - Add CLAUDE.md with project overview, development patterns, and testing standards
   - Create `.claude/rules/` with test-type-specific rules
   - Effort: 4-6 hours

7. **Activate locust for load testing**
   - locust is already a dev dependency but no locustfile exists
   - Create locustfiles for each detector type
   - Run in periodic CI (weekly)
   - Effort: 4-6 hours

### Priority 2 (Nice-to-Have)

8. **Add multi-architecture image builds** (amd64/arm64)
9. **Add SBOM generation** (e.g., Syft) and image signing (cosign)
10. **Add Dependabot or Renovate** for automated dependency updates
11. **Add CodeQL SAST scanning** for deeper static analysis
12. **Add API contract testing** with schema validation between detectors and orchestrator

## Comparison to Gold Standards

| Dimension | guardrails-detectors | odh-dashboard | notebooks | kserve |
|-----------|---------------------|---------------|-----------|--------|
| Unit Tests | 8.0 (161 tests, 1.45:1 ratio) | 9.0 (extensive) | 7.0 | 9.0 |
| Integration/E2E | 5.0 (TestClient only) | 9.0 (multi-layer) | 8.0 | 9.0 |
| Build Integration | 3.0 (no image builds) | 7.0 | 8.0 | 7.0 |
| Image Testing | 2.0 (untested) | 6.0 | 9.0 (5-layer) | 7.0 |
| Coverage Tracking | 5.0 (no enforcement) | 8.0 (enforced) | 6.0 | 9.0 |
| CI/CD Automation | 7.0 (good structure) | 9.0 (comprehensive) | 8.0 | 9.0 |
| Agent Rules | 0.0 (missing) | 8.0 (comprehensive) | 3.0 | 2.0 |
| **Overall** | **6.4** | **8.5** | **7.5** | **8.0** |

## File Paths Reference

| Category | Path |
|----------|------|
| CI Workflows | `.github/workflows/test-builtin-detectors.yaml` |
| | `.github/workflows/test-huggingface-runtime.yaml` |
| | `.github/workflows/test-llm-judge.yaml` |
| | `.github/workflows/security-scan.yaml` |
| Shared CI Action | `.github/actions/test-setup/action.yaml` |
| Source Code | `detectors/built_in/`, `detectors/huggingface/`, `detectors/llm_judge/`, `detectors/common/` |
| Tests | `tests/detectors/builtIn/`, `tests/detectors/huggingface/`, `tests/detectors/llm_judge/` |
| Test Config | `tests/conftest.py`, `tox.ini` |
| Dummy Models | `tests/dummy_models/bert/`, `tests/dummy_models/gpt2/` |
| Dockerfiles | `detectors/Dockerfile.builtIn`, `detectors/Dockerfile.hf`, `detectors/Dockerfile.judge` |
| Project Config | `detectors/pyproject.toml` |
