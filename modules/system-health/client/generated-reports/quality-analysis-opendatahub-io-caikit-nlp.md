---
repository: "opendatahub-io/caikit-nlp"
overall_score: 4.6
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Good module-level coverage with pytest, tiny model fixtures, parameterized tests"
  - dimension: "Integration/E2E"
    score: 2.0
    status: "No integration or E2E test suites; no runtime/gRPC endpoint testing"
  - dimension: "Build Integration"
    score: 3.0
    status: "Docker image builds on PR but no runtime validation, no Konflux simulation"
  - dimension: "Image Testing"
    score: 2.0
    status: "Image build only - no startup validation, no functional testing, no scanning"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "pytest-cov generates terminal+HTML reports but no codecov integration or enforcement"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "Basic PR workflows for build/lint/format; no caching, outdated actions, no concurrency control"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules or test automation guidance"
critical_gaps:
  - title: "No integration or E2E tests"
    impact: "Runtime behavior (gRPC/HTTP serving, model loading, TGIS backend) untested end-to-end"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No coverage enforcement or codecov integration"
    impact: "Coverage can silently regress with no PR-level feedback; no thresholds enforced"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container image security scanning"
    impact: "Vulnerabilities in base images and dependencies shipped without detection"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No SAST/CodeQL or secret detection"
    impact: "Security vulnerabilities and leaked secrets not caught in CI"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No image runtime validation"
    impact: "Built images may fail to start or import caikit_nlp correctly in production"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "Outdated CI actions (checkout@v3, setup-python@v3/v4)"
    impact: "Using deprecated Node.js 16 runners; will stop working when GitHub removes them"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add codecov integration to PR workflow"
    effort: "2-3 hours"
    impact: "PR-level coverage feedback and regression prevention"
  - title: "Upgrade GitHub Actions to latest versions (v4/v5)"
    effort: "30 minutes"
    impact: "Fix deprecated Node.js 16 warnings, improve security"
  - title: "Add Trivy container scanning to image build workflow"
    effort: "1-2 hours"
    impact: "Detect known CVEs in container images before merge"
  - title: "Add concurrency control to PR workflows"
    effort: "30 minutes"
    impact: "Cancel redundant CI runs, save compute resources"
  - title: "Add CodeQL/SAST workflow"
    effort: "1-2 hours"
    impact: "Automated security vulnerability detection in Python code"
recommendations:
  priority_0:
    - "Add codecov integration with coverage threshold enforcement (e.g., 70% minimum)"
    - "Add Trivy or Snyk container image scanning to the build-image workflow"
    - "Add CodeQL or Bandit SAST scanning workflow"
    - "Add image runtime validation (import test, health check) to build-image workflow"
  priority_1:
    - "Create integration tests exercising gRPC/HTTP runtime with real model loading"
    - "Add E2E tests for the full inference pipeline using tiny models"
    - "Upgrade all GitHub Actions to current versions (checkout@v4, setup-python@v5)"
    - "Add concurrency groups to prevent redundant workflow runs"
    - "Add pip dependency caching to build and lint workflows"
  priority_2:
    - "Create agent rules (.claude/rules/) for unit and integration test patterns"
    - "Add multi-architecture Docker image builds (amd64, arm64)"
    - "Add performance regression benchmarks to CI"
    - "Add Gitleaks secret detection scanning"
    - "Add SBOM generation for container images"
---

# Quality Analysis: caikit-nlp (opendatahub-io/caikit-nlp)

## Executive Summary

- **Overall Score: 4.6/10**
- **Repository Type**: Python ML library (NLP modules for the Caikit AI framework)
- **Primary Language**: Python 3.9+
- **Framework**: Caikit AI framework with HuggingFace Transformers, PyTorch, PEFT
- **Key Strengths**: Solid unit test suite with parameterized tests, tiny model fixtures for fast testing, pre-commit hooks for formatting, pylint enforcement
- **Critical Gaps**: No integration/E2E tests, no coverage enforcement, no container security scanning, no SAST, no agent rules
- **Agent Rules Status**: Missing - no CLAUDE.md, no .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.0/10 | Good module-level coverage with pytest, tiny model fixtures, parameterized tests |
| Integration/E2E | 2.0/10 | No integration or E2E test suites; no runtime/gRPC endpoint testing |
| **Build Integration** | **3.0/10** | **Docker image builds on PR but no runtime validation, no Konflux simulation** |
| Image Testing | 2.0/10 | Image build only - no startup validation, no functional testing, no scanning |
| Coverage Tracking | 3.0/10 | pytest-cov generates local reports but no codecov integration or enforcement |
| CI/CD Automation | 5.0/10 | Basic PR workflows for build/lint/format; no caching, outdated actions |
| Agent Rules | 0.0/10 | No CLAUDE.md, no .claude/ directory, no agent rules or test automation guidance |

## Critical Gaps

### 1. No Integration or E2E Tests
- **Impact**: Runtime behavior (gRPC/HTTP serving, model loading pipeline, TGIS backend integration) is completely untested end-to-end
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: Unit tests use `StubTGISClient` mocks extensively. While this isolates unit behavior, there are no tests that exercise the actual runtime, model serving, or end-to-end inference pipelines. No `e2e/` or `integration/` directories exist.

### 2. No Coverage Enforcement
- **Impact**: Code coverage can silently degrade with no PR-level feedback or minimum thresholds
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: `tox.ini` generates coverage via `pytest-cov` (`--cov=caikit_nlp --cov-report=term --cov-report=html`) but there is no `--cov-fail-under` threshold, no `.codecov.yml`, and no codecov/coveralls GitHub integration. Coverage data is generated but never enforced or reported on PRs.

### 3. No Container Security Scanning
- **Impact**: Vulnerabilities in the UBI9 base image and pip dependencies are shipped without automated detection
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: The `build-image.yml` workflow builds the Docker image but performs no vulnerability scanning. No Trivy, Snyk, or Grype integration exists. The `.whitesource` config exists but only inherits from an external config.

### 4. No SAST/CodeQL or Secret Detection
- **Impact**: Python security vulnerabilities (injection, unsafe deserialization, etc.) and leaked secrets not caught
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: No CodeQL workflow, no Bandit integration, no Semgrep, no Gitleaks/TruffleHog. PyTorch/ML codebases often handle model loading from untrusted sources, making SAST particularly important.

### 5. No Image Runtime Validation
- **Impact**: Docker image may build successfully but fail to start, import, or serve correctly
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: `build-image.yml` only runs `docker build` with no follow-up `docker run` to validate the image starts, can import `caikit_nlp`, or responds to health checks.

### 6. Outdated GitHub Actions
- **Impact**: Using deprecated Node.js 16 runners; will break when GitHub removes support
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: Uses `actions/checkout@v3`, `actions/setup-python@v3` and `@v4`. Current versions are `@v4` and `@v5` respectively. `docker/setup-buildx-action@v3` and `docker/build-push-action@v5` are current.

## Quick Wins

### 1. Add Codecov Integration (2-3 hours)
Upload coverage data from the existing pytest-cov output to Codecov for PR-level reporting.

```yaml
# Add to build-library.yml after tox step
- name: Upload coverage
  uses: codecov/codecov-action@v5
  with:
    files: ./coverage.xml
    fail_ci_if_error: true
```

Also update `tox.ini` to generate XML coverage:
```ini
commands = pytest --durations=42 --cov=caikit_nlp --cov-report=term --cov-report=html --cov-report=xml --cov-fail-under=60 {posargs:tests}
```

### 2. Upgrade GitHub Actions (30 minutes)
```yaml
# In all workflows, update:
- uses: actions/checkout@v4      # was @v3
- uses: actions/setup-python@v5  # was @v3/@v4
```

### 3. Add Trivy Container Scanning (1-2 hours)
```yaml
# Add to build-image.yml after build step
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'caikit-nlp:latest'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
- name: Upload Trivy scan results
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: 'trivy-results.sarif'
```

### 4. Add Concurrency Control (30 minutes)
```yaml
# Add to each workflow
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

### 5. Add CodeQL Scanning (1-2 hours)
```yaml
name: CodeQL
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: python
      - uses: github/codeql-action/analyze@v3
```

## Detailed Findings

### CI/CD Pipeline

**Workflows (4 total)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build-library.yml` | push/PR to main, release-* | Build & test with tox (Python 3.9, 3.10) |
| `lint-code.yml` | push/PR to main, release-* | Format check (pre-commit) + pylint |
| `build-image.yml` | push to main (path-filtered) + all PRs | Docker image build with BuildKit caching |
| `publish-library.yml` | release published | Build wheel + publish to PyPI |

**Strengths**:
- Multi-Python version testing (3.9, 3.10)
- Docker BuildKit with GHA cache (`cache-from: type=gha`)
- Separate lint and build workflows
- Release-based PyPI publishing

**Weaknesses**:
- No concurrency control on any workflow
- No pip dependency caching (no `actions/cache`)
- No timeout limits on jobs
- Outdated action versions (checkout@v3, setup-python@v3/v4)
- No workflow_dispatch triggers for manual runs
- `build-image.yml` has asymmetric triggers (path-filtered on push, all PRs)

### Test Coverage

**Test Structure** (19 test files, ~4,930 lines):

| Directory | Files | Description |
|-----------|-------|-------------|
| `tests/modules/text_generation/` | 5 | PEFT, TGIS, local generation modules |
| `tests/modules/text_embedding/` | 2 | Embedding and crossencoder |
| `tests/modules/text_classification/` | 1 | Sequence classification |
| `tests/modules/token_classification/` | 1 | Filtered span classification |
| `tests/modules/tokenization/` | 1 | Regex sentence splitter |
| `tests/toolkit/` | 6 | Verbalizers, data utils, model run utils |
| `tests/data_model/` | 1 | Generation data model |
| `tests/model_management/` | 1 | TGIS auto finder |
| `tests/resources/` | 1 | Pretrained model |

**Test-to-Code Ratio**: 0.56 (4,930 test lines / 8,720 source lines)
- This is below the ideal 1:1 ratio but reasonable for an ML library

**Testing Patterns** (Good):
- Extensive use of `@pytest.mark.parametrize` for boundary testing
- Tiny model fixtures (BertForSequenceClassification, BloomForCausalLM, T5ForConditionalGeneration) committed to repo for fast, offline testing
- Session-scoped fixtures for expensive model operations
- `StubTGISClient` and `StubTGISBackend` for isolating external dependencies
- Error case testing with `pytest.raises` and match patterns

**Testing Gaps**:
- No integration tests exercising actual gRPC/HTTP runtime
- No E2E tests with real model loading pipeline
- No tests for Dockerfile or container behavior
- No contract tests between caikit-nlp and upstream caikit/caikit-tgis-backend
- No performance/regression benchmarks in CI (benchmark dir exists but unused in CI)

### Code Quality

**Linting**:
- **pylint**: Configured via `.pylintrc` with `fail-under=10` (strict - requires perfect score)
- Extensive disable list (18 checks disabled) including `missing-*-docstring`, `too-many-*`, `no-member`
- Run via tox `lint` environment

**Formatting**:
- **black** (v22.3.0): Code formatting via pre-commit
- **isort** (v5.11.5): Import ordering via pre-commit, configured for caikit's section headers
- **prettier** (v2.1.2): Non-Python file formatting
- All enforced via `scripts/fmt.sh` → `pre-commit run --all-files`

**Weaknesses**:
- Pre-commit hook versions are pinned to older releases (black 22.3.0 → current is 25.x)
- No type checking (no mypy, no pyright, no type annotations enforcement)
- No ruff (modern all-in-one Python linter/formatter)
- pylint disables 18 checks, reducing effective coverage

### Container Images

**Dockerfile**:
- Multi-stage build (base → builder → deploy)
- Uses `registry.access.redhat.com/ubi9/ubi-minimal:latest` as base
- Builds wheel via tox in builder stage
- Creates non-root user (`caikit`, UID 1001)
- Removes build tools after pip install (gcc, python3-devel)
- Uses pip cache mounts for faster rebuilds

**Gaps**:
- No `HEALTHCHECK` instruction
- No image startup validation in CI
- No vulnerability scanning
- No multi-architecture support (no `--platform` flag)
- No SBOM generation
- No image signing or attestation
- `latest` tag on base image is non-deterministic

### Security

**Present**:
- WhiteSource (Mend) configuration (`.whitesource`) for dependency scanning
- Dependabot configured for daily pip dependency updates
- Non-root container user
- Build tool removal in Docker image

**Missing**:
- No CodeQL/SAST
- No container vulnerability scanning (Trivy/Snyk/Grype)
- No secret detection (Gitleaks/TruffleHog)
- No SBOM generation
- No image signing
- No security policy beyond `SECURITY.md`
- No `pip-audit` for Python dependency vulnerabilities

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None - no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: Complete absence of AI agent guidance for test creation, code review, or development patterns
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - Unit test patterns for caikit modules (fixture setup, tiny model usage)
  - Integration test patterns for TGIS backend
  - Mock patterns (StubTGISClient usage)
  - Coverage requirements and enforcement

## Recommendations

### Priority 0 (Critical)

1. **Add codecov integration with coverage threshold** - Upload pytest-cov XML reports, enforce minimum (e.g., 60%) on PRs
2. **Add Trivy container scanning** - Scan built images for known CVEs before merge
3. **Add CodeQL/Bandit SAST** - Detect Python security vulnerabilities automatically
4. **Add image runtime validation** - After docker build, run `docker run caikit-nlp:latest python -c "import caikit_nlp"` to verify

### Priority 1 (High Value)

1. **Create integration tests** - Exercise gRPC/HTTP runtime endpoints with real model loading
2. **Add E2E smoke tests** - Full inference pipeline test using tiny models
3. **Upgrade GitHub Actions** - Update to checkout@v4, setup-python@v5
4. **Add concurrency control** - Prevent redundant workflow runs on rapid pushes
5. **Add pip caching** - Use `actions/cache` for pip dependencies to speed up CI
6. **Add type checking** - Integrate mypy with gradual typing enforcement

### Priority 2 (Nice-to-Have)

1. **Create agent rules** - `.claude/rules/` for test automation patterns specific to caikit-nlp
2. **Add multi-arch Docker builds** - Support amd64 and arm64 platforms
3. **Add performance benchmarks to CI** - Use existing benchmarks directory for regression detection
4. **Add Gitleaks secret detection** - Prevent accidental secret commits
5. **Add SBOM generation** - Produce Software Bill of Materials for container images
6. **Modernize linting** - Consider ruff as replacement for black+isort+pylint combo
7. **Pin base image digest** - Replace `ubi9/ubi-minimal:latest` with specific digest

## Comparison to Gold Standards

| Dimension | caikit-nlp | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | 7/10 | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 2/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 3/10 | 8/10 | 9/10 | 8/10 |
| Image Testing | 2/10 | 7/10 | 10/10 | 7/10 |
| Coverage Tracking | 3/10 | 9/10 | 6/10 | 9/10 |
| CI/CD Automation | 5/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 0/10 | 8/10 | 3/10 | 2/10 |
| **Overall** | **4.6/10** | **8.7/10** | **7.6/10** | **8.1/10** |

## File Paths Reference

| File | Purpose |
|------|---------|
| `.github/workflows/build-library.yml` | Build & test with tox |
| `.github/workflows/lint-code.yml` | Format check + pylint |
| `.github/workflows/build-image.yml` | Docker image build |
| `.github/workflows/publish-library.yml` | PyPI publishing |
| `.github/dependabot.yml` | Dependabot config (pip, daily) |
| `tox.ini` | Test environments (py, lint, fmt, build, twinecheck) |
| `.pylintrc` | Pylint configuration |
| `.pre-commit-config.yaml` | Pre-commit hooks (prettier, black, isort) |
| `.isort.cfg` | Import sorting configuration |
| `Dockerfile` | Multi-stage container build |
| `.whitesource` | Mend/WhiteSource dependency scanning |
| `pyproject.toml` | Package configuration and dependencies |
| `tests/conftest.py` | Global test configuration |
| `tests/fixtures/__init__.py` | Test fixtures, tiny model paths, TGIS stubs |
| `CODEOWNERS` | Code ownership (6 maintainers) |
