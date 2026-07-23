---
repository: "red-hat-data-services/llama-stack-provider-ragas"
overall_score: 3.1
scorecard:
  - dimension: "Unit Tests"
    score: 2.0
    status: "No unit tests exist — all 4 test files are marked integration_test requiring live services"
  - dimension: "Integration/E2E"
    score: 4.0
    status: "Integration tests cover inline, remote, wrappers, and Kubeflow pipelines but are not executed in CI"
  - dimension: "Build Integration"
    score: 2.0
    status: "No PR-time build validation; container builds only happen at release or in Konflux"
  - dimension: "Image Testing"
    score: 3.0
    status: "Two Dockerfiles exist (dev + Konflux) but no runtime validation or multi-arch support"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "pytest-cov declared as dev dependency but never used; no coverage infrastructure"
  - dimension: "CI/CD Automation"
    score: 4.0
    status: "Good release pipeline and docs automation but CI runs zero tests on PRs"
  - dimension: "Static Analysis"
    score: 7.0
    status: "Ruff + mypy + pre-commit enforced in CI; missing Dependabot/Renovate"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory present"
critical_gaps:
  - title: "CI runs zero tests on pull requests"
    impact: "Pre-commit hook runs pytest -m 'not integration_test' but ALL test files are marked integration_test — CI collects and runs zero tests, providing no regression safety net"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No unit tests exist"
    impact: "All 4 test files require live Llama Stack server, Kubeflow Pipelines, and S3 — no tests can run without external infrastructure"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No PR-time build validation"
    impact: "Container image build failures discovered only after merge in Konflux; Containerfile and Dockerfile.konflux never validated on PRs"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Coverage regressions go undetected; no baseline or trend data available"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add true unit tests with mocked dependencies"
    effort: "4-8 hours"
    impact: "Immediately enables test execution in CI; the pre-commit pytest hook already runs non-integration tests"
  - title: "Enable Dependabot for dependency alerts"
    effort: "1-2 hours"
    impact: "Automated security and dependency updates for pip, npm, and docker ecosystems"
  - title: "Add container build step to CI workflow"
    effort: "2-3 hours"
    impact: "Catch Dockerfile/Containerfile build failures before merge"
  - title: "Enable pytest-cov in CI and add codecov"
    effort: "2-3 hours"
    impact: "Coverage visibility and regression detection on every PR"
  - title: "Create basic CLAUDE.md with test patterns"
    effort: "1-2 hours"
    impact: "Guide AI agents to generate consistent, high-quality tests"
recommendations:
  priority_0:
    - "Add unit tests with mocked Llama Stack client and Ragas dependencies — the existing pre-commit hook will automatically pick them up"
    - "Add PR-time container build validation for both Containerfile and Dockerfile.konflux"
    - "Configure pytest-cov with coverage thresholds and codecov reporting in CI"
  priority_1:
    - "Add Dependabot configuration covering pip, npm, and docker ecosystems"
    - "Add concurrency control and timeout-minutes to ci.yml workflow"
    - "Create a dedicated test job in ci.yml that runs pytest with coverage, separate from pre-commit"
  priority_2:
    - "Add CLAUDE.md with project conventions and test patterns for AI agent guidance"
    - "Add multi-stage builds to Containerfile for smaller image size"
    - "Add container image smoke test (import check) to PR workflow"
---

# Quality Analysis: llama-stack-provider-ragas

## Executive Summary

- **Overall Score: 3.1/10**
- **Repository**: [red-hat-data-services/llama-stack-provider-ragas](https://github.com/red-hat-data-services/llama-stack-provider-ragas)
- **Type**: Python library (Llama Stack evaluation provider using Ragas)
- **Language**: Python 3.12
- **Jira**: RHOAIENG / AI Safety (downstream tier)
- **Key Strengths**: Good static analysis setup with ruff + mypy + pre-commit enforced in CI; well-structured integration tests; solid release pipeline with PyPI publishing and smoke tests
- **Critical Gaps**: CI runs zero tests on PRs; no unit tests exist; no PR-time build validation; no coverage tracking
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 2/10 | 15% | 0.30 | No unit tests — all tests require live services |
| Integration/E2E | 4/10 | 20% | 0.80 | Tests exist but not automated in CI |
| Build Integration | 2/10 | 15% | 0.30 | No PR-time build validation |
| Image Testing | 3/10 | 10% | 0.30 | Basic Dockerfiles, no runtime validation |
| Coverage Tracking | 1/10 | 10% | 0.10 | pytest-cov declared but unused |
| CI/CD Automation | 4/10 | 15% | 0.60 | Good release pipeline, no CI test execution |
| Static Analysis | 7/10 | 10% | 0.70 | Ruff + mypy + pre-commit, no Dependabot |
| Agent Rules | 0/10 | 5% | 0.00 | No agent rules present |
| **Overall** | **3.1/10** | **100%** | **3.10** | |

## Critical Gaps

### 1. CI Runs Zero Tests on Pull Requests
- **Severity**: HIGH
- **Impact**: The CI workflow (`ci.yml`) runs pre-commit checks which include a pytest hook, but that hook runs `pytest -m "not integration_test"`. Since ALL 4 test files use `pytestmark = pytest.mark.integration_test`, the pytest step collects zero tests (exit code 5, treated as success). PRs merge with zero test validation.
- **Effort**: 4-8 hours
- **Evidence**: `.pre-commit-config.yaml:34` — `args: [-c, 'KUBEFLOW_BASE_IMAGE=dummy uv run pytest -v -m "not integration_test" ...']`

### 2. No Unit Tests Exist
- **Severity**: HIGH
- **Impact**: All test files (`test_inline_evaluation.py`, `test_remote_evaluation.py`, `test_remote_wrappers.py`, `test_kubeflow_integration.py`) require live external services (Llama Stack server, Kubeflow Pipelines, S3 storage). There are no tests that can run with mocked dependencies. Core logic in `config.py`, `compat.py`, `errors.py`, `constants.py`, `provider.py`, and the wrapper modules has zero unit test coverage.
- **Effort**: 8-16 hours
- **File count**: 19 source files, 4 test files (all integration), test-to-code LOC ratio: 0.32

### 3. No PR-Time Build Validation
- **Severity**: HIGH
- **Impact**: Two Dockerfiles exist (`Containerfile` for dev, `Dockerfile.konflux` for production) but neither is built or validated in CI on PRs. Build failures are discovered only post-merge in Konflux. The release workflow validates the Python wheel but not container images.
- **Effort**: 4-6 hours

### 4. No Coverage Tracking or Enforcement
- **Severity**: MEDIUM
- **Impact**: `pytest-cov` is listed as a dev dependency in `pyproject.toml` but is never used in CI. No `.codecov.yml`, no coverage thresholds, no PR coverage reporting. Coverage regressions are invisible.
- **Effort**: 2-4 hours

## Quick Wins

### 1. Add Unit Tests with Mocked Dependencies (4-8 hours)
Create tests that mock `LlamaStackClient`, Ragas evaluation, and KFP components. These will be picked up automatically by the existing pre-commit pytest hook since they won't be marked `integration_test`.

```python
# tests/test_config.py
from llama_stack_provider_ragas.config import RagasProviderInlineConfig

def test_inline_config_defaults():
    config = RagasProviderInlineConfig(embedding_model="test-model")
    assert config.embedding_model == "test-model"

def test_inline_config_validation():
    with pytest.raises(ValidationError):
        RagasProviderInlineConfig()  # missing required field
```

### 2. Enable Dependabot (1-2 hours)
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 3. Add Container Build to CI (2-3 hours)
```yaml
# Add to .github/workflows/ci.yml
  build-container:
    name: Container Build Validation
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Build Containerfile
      run: docker build -f Containerfile -t test-dev .
    - name: Build Dockerfile.konflux
      run: docker build -f Dockerfile.konflux -t test-konflux .
    - name: Smoke test
      run: |
        docker run --rm test-dev python -c "import llama_stack_provider_ragas"
```

### 4. Enable Coverage in CI (2-3 hours)
```yaml
# Add to .github/workflows/ci.yml
  test:
    name: Tests with Coverage
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v4
      with:
        python-version: "3.12"
    - uses: astral-sh/setup-uv@v4
    - run: uv sync --extra dev
    - run: uv run pytest -m "not integration_test" --cov=src --cov-report=xml
    - uses: codecov/codecov-action@v4
      with:
        file: coverage.xml
```

### 5. Create Basic CLAUDE.md (1-2 hours)
```markdown
# llama-stack-provider-ragas

## Testing
- Unit tests: `pytest -m "not integration_test"`
- Integration tests: `pytest -m integration_test` (requires live Llama Stack + Kubeflow)
- All tests in `tests/` directory using pytest + pytest-asyncio
- Use `conftest.py` fixtures for shared test data

## Code Quality
- Lint: `ruff check .`
- Format: `ruff format .`
- Type check: `mypy src/`
- Pre-commit: `pre-commit run --all-files`
```

## Detailed Findings

### Unit Tests
- **Score: 2/10**
- **Test framework**: pytest + pytest-asyncio (configured in `pyproject.toml`)
- **Test files**: 4 files in `tests/`
  - `test_inline_evaluation.py` — integration test for inline Llama Stack eval API
  - `test_remote_evaluation.py` — integration test for remote Ragas evaluation
  - `test_remote_wrappers.py` — integration test for LLM/embedding wrappers (sync + async)
  - `test_kubeflow_integration.py` — integration test for Kubeflow pipeline components
- **Test-to-code ratio**: 4/19 files (0.21), 559/1754 LOC (0.32) — below typical threshold of 0.5+
- **Critical issue**: ALL test files use `pytestmark = pytest.mark.integration_test`, meaning NO tests can run without external infrastructure
- **Fixtures**: Good shared fixtures in `conftest.py` with sample evaluation data
- **Assertions**: Tests use appropriate assertions checking types, lengths, and value ranges
- **No unit tests** for: `config.py`, `compat.py`, `errors.py`, `constants.py`, `provider.py`, `logging_utils.py`, wrapper logic

### Integration/E2E Tests
- **Score: 4/10**
- **Coverage areas**: Inline evaluation, remote evaluation, remote LLM/embedding wrappers, Kubeflow pipeline execution
- **Kubeflow tests** (`test_kubeflow_integration.py`): Comprehensive KFP component tests including mock-based fake evaluation and full pipeline execution — well-structured
- **Remote wrapper tests** (`test_remote_wrappers.py`): Good coverage of sync and async paths for both LLM and embedding wrappers
- **Weaknesses**:
  - Tests are NOT run in any CI workflow — manual execution only
  - No multi-version testing (single Python version 3.12)
  - No cluster setup automation (Kind, Minikube, envtest)
  - No test environment provisioning in CI
  - Missing test coverage for error handling and edge cases

### Build Integration
- **Score: 2/10**
- **Dockerfiles**: Two Dockerfiles exist
  - `Containerfile`: Simple, `FROM python:3.12`, installs with `pip install -e ".[remote]"`
  - `Dockerfile.konflux`: Uses `FROM registry.redhat.io/ubi9/python-312` with pinned SHA digest — production-ready
- **CI build**: No container build step in any PR workflow
- **Release**: `release.yaml` builds Python wheel and runs smoke tests (import check) — only on release tag
- **Missing**: No PR-time Konflux simulation, no container build validation, no manifest validation
- **Mergify**: Configured for backport automation (main → incubation → stable) — good release process

### Image Testing
- **Score: 3/10**
- **Container setup**: `.dockerignore` properly excludes `.venv`, `.git`, `.env` files
- **Containerfile**: Single-stage build using `python:3.12` (not FIPS-capable)
- **Dockerfile.konflux**: Single-stage build using UBI9 (FIPS-capable), with proper Red Hat labels
- **Missing**: No multi-stage builds, no HEALTHCHECK, no runtime validation, no Testcontainers, no multi-architecture support
- **Positive**: `Dockerfile.konflux` uses pinned SHA digest for reproducible builds

### Coverage Tracking
- **Score: 1/10**
- `pytest-cov` is listed in `[project.optional-dependencies] dev` in `pyproject.toml`
- No `.codecov.yml` or `codecov.yml` configuration file
- No `--cov` flag used anywhere in CI
- No coverage thresholds defined
- No PR coverage reporting or gates
- The tooling is available but completely unused

### CI/CD Automation
- **Score: 4/10**
- **Workflows**:
  - `ci.yml`: Triggers on push/PR to main/develop; runs pre-commit checks only; UV caching; matrix strategy (single Python version)
  - `docs.yml`: Triggers on push/PR for docs changes; concurrency control; npm caching; Antora build + GitHub Pages deploy
  - `release.yaml`: Triggers on release publish; builds wheel; smoke tests (import check from wheel, sdist, and PyPI); publishes to PyPI with trusted publishing
- **Strengths**: Good release pipeline with multiple smoke tests; UV dependency caching; docs automation with Antora
- **Weaknesses**:
  - No test execution in CI (despite having a test step that runs zero tests)
  - No concurrency control on `ci.yml`
  - No `timeout-minutes` on any job
  - No test parallelization
  - Single Python version matrix
- **External tools**: Mergify for backport automation; `.github/pull.yml` for upstream sync

### Static Analysis
- **Score: 7/10**
- **Ruff**: Configured in `pyproject.toml` with 7 rule categories (E, W, F, I, B, C4, UP) — good selection including bugbear and pyupgrade
- **mypy**: Configured with `check_untyped_defs`, `warn_return_any`, `strict_equality`, `show_error_codes` — reasonable settings
- **Pre-commit hooks** (`.pre-commit-config.yaml`):
  - Standard hooks: trailing-whitespace, end-of-file-fixer, check-yaml, check-added-large-files, check-merge-conflict, debug-statements
  - Ruff: lint + format
  - mypy: type checking with `types-requests` additional dependency
  - pytest: runs non-integration tests (currently zero)
- **Pre-commit enforced in CI**: Yes, via `ci.yml` — good
- **FIPS**: No non-FIPS crypto imports found in source code; Dockerfile.konflux uses UBI9 (FIPS-capable); Containerfile uses python:3.12 (not FIPS-capable) — acceptable for dev vs. prod separation
- **Dependency alerts**: No Dependabot or Renovate configuration — gap

### Agent Rules
- **Score: 0/10**
- **Status**: Missing
- No `CLAUDE.md` or `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` with test creation rules
- No `.claude/skills/` with custom skills
- No testing documentation for AI agent guidance
- **Recommendation**: Generate rules using `/test-rules-generator`

## Recommendations

### Priority 0 (Critical)
1. **Add unit tests with mocked dependencies** — Create tests for `config.py`, `compat.py`, `constants.py`, `errors.py`, and wrapper modules that don't require live services. The existing pre-commit pytest hook (`-m "not integration_test"`) will automatically pick these up in CI.
2. **Add PR-time container build validation** — Add a job to `ci.yml` that builds both `Containerfile` and `Dockerfile.konflux` and runs an import smoke test, catching build failures before merge.
3. **Configure coverage tracking** — Add `--cov` to pytest invocation in CI, set up `.codecov.yml` with minimum thresholds (e.g., 60%), and add codecov GitHub Action for PR reporting.

### Priority 1 (High Value)
4. **Add Dependabot configuration** — Cover pip, npm, docker, and github-actions ecosystems for automated dependency updates and security alerts.
5. **Add concurrency control and timeouts to ci.yml** — Prevent duplicate runs on rapid pushes and avoid hung jobs.
6. **Create dedicated test job in CI** — Separate test execution from pre-commit to make test failures more visible and enable coverage reporting.

### Priority 2 (Nice-to-Have)
7. **Add CLAUDE.md with project conventions** — Document testing patterns, code quality tools, and project structure for AI agent guidance.
8. **Add multi-stage builds** — Reduce container image size by separating build and runtime stages in Dockerfiles.
9. **Add container smoke test to PR workflow** — Run `python -c "import llama_stack_provider_ragas"` inside built container on every PR.
10. **Test with multiple Python versions** — Expand matrix strategy to test against Python 3.12 and 3.13.

## Comparison to Gold Standards

| Practice | llama-stack-provider-ragas | odh-dashboard | notebooks | kserve |
|----------|--------------------------|---------------|-----------|--------|
| Unit test coverage | None (all integration) | Comprehensive Jest suite | N/A (notebook repo) | Extensive Go unit tests |
| Integration tests in CI | Not automated | Automated in PR workflows | Multi-layer validation | Automated with envtest |
| PR build validation | None | Docker build + BFF | Image build matrix | Make docker-build |
| Coverage enforcement | None | Codecov with thresholds | N/A | Codecov with gates |
| Static analysis | Ruff + mypy + pre-commit | ESLint + TypeScript strict | Linting in CI | golangci-lint |
| Dependency alerts | None | Dependabot | Dependabot | Dependabot |
| Agent rules | None | CLAUDE.md + rules | N/A | N/A |
| Container testing | None | Image startup validation | 5-layer validation | Multi-arch builds |

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yml` — PR pre-commit checks (no test execution)
- `.github/workflows/docs.yml` — Documentation build and deploy
- `.github/workflows/release.yaml` — PyPI publishing with smoke tests
- `.github/pull.yml` — Upstream sync configuration
- `.mergify.yml` — Backport automation (main → incubation → stable)

### Testing
- `tests/conftest.py` — Shared fixtures and sample evaluation data
- `tests/test_inline_evaluation.py` — Inline evaluation integration test
- `tests/test_remote_evaluation.py` — Remote evaluation integration test
- `tests/test_remote_wrappers.py` — Remote LLM/embedding wrapper tests
- `tests/test_kubeflow_integration.py` — Kubeflow pipeline integration tests

### Code Quality
- `pyproject.toml` — Ruff, mypy, pytest configuration
- `.pre-commit-config.yaml` — Pre-commit hooks (ruff, mypy, pytest)

### Container Images
- `Containerfile` — Development container (python:3.12)
- `Dockerfile.konflux` — Production container (UBI9, pinned digest)
- `.dockerignore` — Docker build exclusions

### Source Code
- `src/llama_stack_provider_ragas/` — Main package (19 Python files, 1754 LOC)
- `src/llama_stack_provider_ragas/inline/` — Inline evaluation provider
- `src/llama_stack_provider_ragas/remote/` — Remote evaluation provider
- `src/llama_stack_provider_ragas/remote/kubeflow/` — Kubeflow pipeline components
