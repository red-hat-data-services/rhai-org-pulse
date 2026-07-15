---
repository: "opendatahub-io/guardrails-detectors"
overall_score: 4.6
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Good test-to-code ratio (1.47:1) with pytest, fixtures, and parametrized tests; no coverage enforcement"
  - dimension: "Integration/E2E"
    score: 3.5
    status: "TestClient-based lightweight integration tests only; no E2E, contract, or deployment tests"
  - dimension: "Build Integration"
    score: 2.0
    status: "No PR-time Docker builds, no Konflux/Tekton pipeline, no manifest validation"
  - dimension: "Image Testing"
    score: 2.5
    status: "Multi-stage Dockerfiles on UBI9 base but no CI image builds, no runtime validation, no multi-arch"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "pytest-cov generates terminal output only; no codecov integration or coverage thresholds"
  - dimension: "CI/CD Automation"
    score: 6.5
    status: "Path-filtered workflows, shared composite action, Trivy scanning, Mergify branch sync; no concurrency control"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no test automation guidance for AI agents"
critical_gaps:
  - title: "No container image builds or runtime validation in CI"
    impact: "Image build failures and runtime regressions are not caught until deployment"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No coverage enforcement or PR coverage reporting"
    impact: "Coverage can silently degrade without anyone noticing; no gate prevents merging uncovered code"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No E2E or integration tests against live detector endpoints"
    impact: "API contract regressions, startup failures, and multi-component interactions are untested"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No linting configuration or pre-commit hooks file"
    impact: "Code style drift, potential bugs from unchecked patterns, inconsistent formatting"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No dependency update automation (Dependabot/Renovate)"
    impact: "Vulnerable or outdated dependencies accumulate silently"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add codecov integration with PR coverage comments"
    effort: "2-3 hours"
    impact: "Visible coverage tracking on every PR, coverage trend monitoring, prevent regressions"
  - title: "Add ruff linting and pre-commit config"
    effort: "2-3 hours"
    impact: "Consistent code style, early bug detection, auto-formatting"
  - title: "Enable Dependabot for Python dependency updates"
    effort: "30 minutes"
    impact: "Automated security patches and dependency freshness"
  - title: "Add concurrency control to PR workflows"
    effort: "30 minutes"
    impact: "Cancel stale CI runs on new pushes, saving CI resources"
  - title: "Add Docker image build step to test workflows"
    effort: "3-4 hours"
    impact: "Catch Dockerfile issues and missing dependencies before merge"
recommendations:
  priority_0:
    - "Add codecov integration with coverage threshold enforcement (e.g., 80% minimum, no decrease allowed)"
    - "Add Docker image build validation to PR workflows for all three detector images"
    - "Create .pre-commit-config.yaml with ruff, mypy, and basic hooks (trailing whitespace, YAML lint)"
  priority_1:
    - "Implement E2E tests that build images and verify detector API endpoints respond correctly"
    - "Add contract tests to validate the Guardrails Orchestrator API spec compliance"
    - "Create agent rules (.claude/rules/) for unit test, integration test, and API test patterns"
    - "Add mypy type checking with strict mode for the common and built_in modules"
  priority_2:
    - "Add multi-architecture image builds (amd64/arm64) for broader deployment support"
    - "Implement performance regression tests with locust (already a dev dependency)"
    - "Add CodeQL/Semgrep SAST analysis alongside Trivy"
    - "Add SBOM generation and image signing for supply chain security"
---

# Quality Analysis: guardrails-detectors

## Executive Summary
- **Overall Score: 4.6/10**
- **Repository Type**: Python microservice collection (FastAPI) for AI guardrails detection
- **Primary Language**: Python 3.11+
- **Components**: 3 detector types (built-in regex/filetype, HuggingFace model-based, LLM Judge)
- **Key Strengths**: Well-structured unit tests with good test-to-code ratio (1.47:1), comprehensive security scanning with Trivy, shared CI composite action for DRY workflows
- **Critical Gaps**: No container image builds in CI, no coverage enforcement, no E2E tests, no linting configuration, no agent rules
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | Good test-to-code ratio (1.47:1) with pytest, fixtures, and parametrized tests |
| Integration/E2E | 3.5/10 | TestClient-based lightweight integration tests only; no E2E |
| **Build Integration** | **2.0/10** | **No PR-time Docker builds, no Konflux/Tekton pipeline** |
| Image Testing | 2.5/10 | Multi-stage Dockerfiles on UBI9 but no CI builds or runtime validation |
| Coverage Tracking | 3.0/10 | Terminal-only coverage output; no codecov or thresholds |
| CI/CD Automation | 6.5/10 | Path-filtered workflows, shared composite action, Trivy, Mergify |
| Agent Rules | 0.0/10 | No .claude/ directory, no CLAUDE.md, no test guidance |

## Critical Gaps

### 1. No Container Image Builds or Runtime Validation in CI
- **Impact**: Image build failures and runtime regressions are not caught until deployment. Dockerfile issues (missing dependencies, broken COPY paths, etc.) can slip through.
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: Three Dockerfiles exist (`Dockerfile.hf`, `Dockerfile.judge`, `Dockerfile.builtIn`) but none are built or validated in any CI workflow. The HF detector workflow verifies model loading but not within a container context.

### 2. No Coverage Enforcement or PR Reporting
- **Impact**: Coverage can silently degrade. No gate prevents merging code that reduces overall coverage.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: All three test workflows use `--cov` and `--cov-report=term-missing`, but output goes only to the CI log. No codecov/coveralls integration, no coverage comments on PRs, and no minimum thresholds.

### 3. No E2E or Integration Tests Against Live Endpoints
- **Impact**: API contract regressions, startup failures, and multi-component interactions are untested. The built-in tests use FastAPI's `TestClient` (in-process), which is good but doesn't exercise the full server lifecycle.
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: No tests spin up actual detector services and send HTTP requests. No tests validate the KServe InferenceService integration path. The `locust` performance testing library is in dev dependencies but no load tests exist.

### 4. No Linting Configuration or Pre-Commit Hooks
- **Impact**: Code style drift, inconsistent formatting, potential bugs from unchecked anti-patterns.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: The CI composite action references `.pre-commit-config.yaml` but the file does not exist in the repository. The pre-commit step runs with `continue-on-error: true`, so failures are silently ignored. No `ruff.toml`, `flake8`, `pylint`, or `mypy` configuration exists.

### 5. No Dependency Update Automation
- **Impact**: Vulnerable or outdated dependencies accumulate silently. Pinned versions (e.g., `torch==2.11.0`, `transformers==4.57.3`) will become stale.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: No Dependabot or Renovate configuration. Dependencies are pinned in `pyproject.toml` which is good for reproducibility but requires manual updates.

## Quick Wins

### 1. Add Codecov Integration (2-3 hours)
Generate XML coverage reports and upload to Codecov for PR-level coverage tracking.
```yaml
# Add to each test workflow after the pytest step:
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    flags: ${{ matrix.component || 'builtin' }}
    fail_ci_if_error: false
```
Add `--cov-report=xml` to pytest commands. Create `.codecov.yml`:
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

### 2. Add Ruff Linting and Pre-Commit Config (2-3 hours)
Create `.pre-commit-config.yaml` (currently referenced but missing):
```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
```

### 3. Enable Dependabot (30 minutes)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/detectors"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 4. Add Concurrency Control (30 minutes)
Add to each PR workflow:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

### 5. Add Docker Image Build to Test Workflows (3-4 hours)
Add a job that builds all three detector images on PR:
```yaml
build-images:
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
      run: docker build -f ${{ matrix.dockerfile }} -t test-${{ matrix.name }}:pr detectors/
```

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory** (6 workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test-builtin-detectors.yaml` | PR/push (path-filtered) | Unit tests for built-in detectors |
| `test-huggingface-runtime.yaml` | PR/push (path-filtered) | Unit tests for HF detector + model loading |
| `test-llm-judge.yaml` | PR/push (path-filtered) | Unit tests for LLM Judge detector |
| `security-scan.yaml` | PR/push/schedule/dispatch | Trivy filesystem + config scanning |
| `sync-branch-incubation.yaml` | Push to main | Sync main → incubation |
| `sync-branch-stable.yaml` | Push to incubation | Sync incubation → stable |

**Strengths**:
- Path-filtered triggers avoid unnecessary CI runs
- Shared composite action (`.github/actions/test-setup/action.yaml`) keeps workflows DRY
- Pip caching based on `pyproject.toml` hash
- Multi-branch strategy (main → incubation → stable) with automated sync via Mergify and sync workflows
- Security scanning runs on PRs, pushes, weekly schedule, and manual dispatch

**Gaps**:
- No concurrency control — stale PR runs are not cancelled
- Single Python version (3.11) — no matrix testing across versions
- No image build validation in any workflow
- Pre-commit step has `continue-on-error: true` and no `.pre-commit-config.yaml` exists
- No test result publishing (JUnit XML, etc.)

### Test Coverage

**Test Inventory** (16 test files, ~3041 lines):

| Component | Test Files | Lines | Key Patterns |
|-----------|-----------|-------|-------------|
| Built-in | 4 files | 1,068 | FastAPI TestClient, parametrized regex/filetype tests |
| HuggingFace | 10 files | 1,251 | Method-level unit tests, dummy models, model loading |
| LLM Judge | 2 files | 722 | Async mocking, vllm_judge integration, content + generation analysis |

**Test-to-Code Ratio**: 3,041 test lines / 2,071 source lines = **1.47:1** (excellent)

**Strengths**:
- Well-organized tests mirroring source structure
- Extensive use of `@pytest.mark.parametrize` for input variations (regex patterns, credit card numbers, etc.)
- Good fixture usage (TestClient, mock judge, prometheus cleanup)
- HuggingFace tests use dummy models for isolated, reproducible testing
- LLM Judge tests properly mock async vllm_judge dependency
- Error handling tests (invalid regex, missing env vars, unreachable URLs)

**Gaps**:
- No E2E tests that exercise full server lifecycle
- No contract tests validating API schema compliance with FMS Guardrails Orchestrator
- No tests for Dockerfile builds or container startup
- Coverage reported to terminal only — not tracked over time
- No performance tests despite `locust` being a dev dependency
- `conftest.py` uses `sys.path` manipulation instead of proper package installation

### Code Quality

**Current State**:
- **Linting**: No linting configuration found (no ruff, flake8, pylint, eslint)
- **Type Checking**: No mypy or pyright configuration; some type hints used in LLM Judge tests
- **Pre-commit**: Referenced in CI composite action but `.pre-commit-config.yaml` does not exist
- **Static Analysis**: Trivy filesystem scanning covers vulnerabilities and secrets, but no SAST (CodeQL, Semgrep, Bandit)
- **Formatting**: No formatter configured (no black, ruff-format, yapf)

**Project Configuration**:
- `pyproject.toml` with well-structured optional dependencies per component
- `tox.ini` for local test execution
- Clean `.gitignore` covering common Python artifacts
- Apache 2.0 license

### Container Images

**Dockerfiles** (3 files):

| Image | Base | Stages | Port | Workers |
|-------|------|--------|------|---------|
| `Dockerfile.hf` | UBI9 Python 3.12 | 3 (base → builder → final) | 8000 | 1 |
| `Dockerfile.judge` | UBI9 Python 3.12 | 3 (base → builder → final) | 8000 | 4 |
| `Dockerfile.builtIn` | UBI9 Python 3.12 | 3 (base → builder → final) | 8080 | 4 |

**Strengths**:
- Red Hat UBI9 base images (production-ready, supported)
- Multi-stage builds for smaller final images
- Prometheus multiprocessing directory setup
- Non-root user for HF detector (USER 1001)

**Gaps**:
- No image builds in CI — Dockerfile issues caught only at deployment time
- No runtime validation (healthcheck, startup test)
- No multi-architecture support (no `--platform` or buildx)
- No SBOM generation
- No image signing/attestation (cosign, sigstore)
- No vulnerability scanning of built images (only filesystem scanning via Trivy)
- `Dockerfile.judge` does not set USER (runs as root by default)
- CACHEBUST ARG pattern is non-standard and could be replaced with `--no-cache` flag

### Security

**Strengths**:
- Comprehensive Trivy scanning:
  - Filesystem vulnerability scanning per component
  - Configuration scanning for misconfigurations
  - Repository-wide scanning
  - Secret detection enabled
- SARIF upload to GitHub Security tab
- Weekly scheduled scans (Monday 2 AM UTC)
- Manual dispatch trigger for on-demand scanning
- Scan artifacts retained for 30 days

**Gaps**:
- No CodeQL or SAST for source code analysis
- No dependency scanning automation (Dependabot/Renovate)
- No image vulnerability scanning (only filesystem)
- No `.gitleaks.toml` configuration
- Security scan `exit-code: '0'` means vulnerabilities don't fail the build
- No security policy file (`SECURITY.md`)

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No test types have rules
- **Quality**: N/A
- **Gaps**: Everything — no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Recommendation**: Generate test creation rules with `/test-rules-generator` covering:
  - Unit test patterns for FastAPI endpoints
  - Mock patterns for async vllm_judge
  - Dummy model testing patterns for HuggingFace
  - Integration test patterns with TestClient

## Recommendations

### Priority 0 (Critical)

1. **Add codecov integration with coverage enforcement**
   - Upload XML coverage from all three test workflows
   - Set minimum threshold (80% project, 90% patch)
   - Add coverage comments to PRs
   - Effort: 2-4 hours

2. **Add Docker image build validation to PR workflows**
   - Build all three detector images on every PR
   - Add basic startup/healthcheck validation
   - Effort: 4-6 hours

3. **Create `.pre-commit-config.yaml`**
   - Currently referenced but missing from the repository
   - Add ruff (linting + formatting), trailing whitespace, YAML validation
   - Remove `continue-on-error: true` from CI pre-commit step
   - Effort: 2-3 hours

### Priority 1 (High Value)

4. **Implement E2E tests for detector API endpoints**
   - Build detector images in CI, start containers, send HTTP requests
   - Validate API responses against the Guardrails Orchestrator detector API spec
   - Test startup, healthcheck, shutdown lifecycle
   - Effort: 16-24 hours

5. **Add mypy type checking**
   - Start with `common/` and `built_in/` modules (simpler dependencies)
   - Gradually extend to `huggingface/` and `llm_judge/`
   - Add to CI workflows
   - Effort: 4-8 hours

6. **Create agent rules for test automation**
   - `.claude/rules/unit-tests.md` — pytest patterns, fixtures, parametrize usage
   - `.claude/rules/integration-tests.md` — TestClient patterns, mock strategies
   - `.claude/rules/api-tests.md` — API schema validation, response format checks
   - Effort: 4-6 hours

7. **Add Dependabot for dependency management**
   - Pip ecosystem for `detectors/pyproject.toml`
   - GitHub Actions ecosystem for workflow dependencies
   - Effort: 30 minutes

### Priority 2 (Nice-to-Have)

8. **Add performance regression testing with locust**
   - `locust` is already a dev dependency but unused
   - Create load test scenarios for each detector type
   - Effort: 8-12 hours

9. **Add multi-architecture image builds**
   - Support amd64 and arm64 for broader deployment scenarios
   - Use Docker buildx or Podman multi-arch builds
   - Effort: 4-6 hours

10. **Add CodeQL/Semgrep SAST**
    - Complement Trivy with source code analysis
    - Detect injection vulnerabilities, unsafe deserialization, etc.
    - Effort: 2-4 hours

11. **Add SBOM generation and image signing**
    - Syft for SBOM, cosign for signing
    - Supply chain security compliance
    - Effort: 4-6 hours

12. **Expand Python version testing matrix**
    - Test on 3.11 and 3.12 (pyproject.toml requires >=3.11, Dockerfiles use 3.12)
    - Effort: 1-2 hours

## Comparison to Gold Standards

| Dimension | guardrails-detectors | odh-dashboard | notebooks | kserve |
|-----------|---------------------|---------------|-----------|--------|
| Unit Tests | 7.5 - Good ratio, pytest | 9.0 - Jest, comprehensive | 7.0 - Script-based | 9.0 - Go testing, envtest |
| Integration/E2E | 3.5 - TestClient only | 9.0 - Cypress, Playwright | 8.0 - Multi-layer | 9.0 - Multi-version |
| Build Integration | 2.0 - None | 7.0 - Module Federation | 8.0 - Image builds | 8.0 - Operator builds |
| Image Testing | 2.5 - Dockerfiles only | 6.0 - Basic builds | 9.0 - 5-layer validation | 7.0 - KServe runtime |
| Coverage | 3.0 - Terminal only | 8.0 - Codecov enforced | 5.0 - Basic | 9.0 - Thresholds |
| CI/CD | 6.5 - Good basics | 9.0 - Comprehensive | 8.0 - Multi-stage | 9.0 - Well-automated |
| Agent Rules | 0.0 - None | 8.0 - Comprehensive | 2.0 - Minimal | 3.0 - Basic |

## File Paths Reference

### CI/CD
- `.github/workflows/test-builtin-detectors.yaml` — Built-in detector unit tests
- `.github/workflows/test-huggingface-runtime.yaml` — HF detector unit tests
- `.github/workflows/test-llm-judge.yaml` — LLM Judge unit tests
- `.github/workflows/security-scan.yaml` — Trivy security scanning
- `.github/workflows/sync-branch-incubation.yaml` — Branch sync main → incubation
- `.github/workflows/sync-branch-stable.yaml` — Branch sync incubation → stable
- `.github/actions/test-setup/action.yaml` — Shared test setup composite action
- `.mergify.yml` — Backport rules (main → incubation → stable)
- `.github/pull.yml` — Upstream sync from trustyai-explainability

### Testing
- `tests/conftest.py` — Shared fixtures (sys.path, Prometheus dir)
- `tests/detectors/builtIn/` — 4 test files (regex, filetype, custom, metrics)
- `tests/detectors/huggingface/` — 10 test files (method-level + integration)
- `tests/detectors/llm_judge/` — 2 test files (detector + performance)
- `tests/dummy_models/` — HuggingFace dummy models for isolated testing
- `tox.ini` — Local test execution configuration

### Source Code
- `detectors/pyproject.toml` — Package configuration and dependencies
- `detectors/common/` — Shared code (scheme, instrumented detector, app base)
- `detectors/built_in/` — Built-in detector implementations (regex, filetype, custom)
- `detectors/huggingface/` — HuggingFace model-based detector
- `detectors/llm_judge/` — LLM Judge detector (vllm_judge integration)

### Container Images
- `detectors/Dockerfile.hf` — HuggingFace detector image
- `detectors/Dockerfile.judge` — LLM Judge detector image
- `detectors/Dockerfile.builtIn` — Built-in detectors image

### Deployment
- `detectors/huggingface/deploy/` — KServe InferenceService manifests
- `detectors/llm_judge/deploy/` — KServe ServingRuntime manifests
