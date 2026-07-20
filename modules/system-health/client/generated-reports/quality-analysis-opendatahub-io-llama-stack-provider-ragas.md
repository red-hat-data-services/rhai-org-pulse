---
repository: "opendatahub-io/llama-stack-provider-ragas"
overall_score: 3.3
scorecard:
  - dimension: "Unit Tests"
    score: 3.0
    status: "All tests require external services; no true isolated unit tests exist"
  - dimension: "Integration/E2E"
    score: 5.0
    status: "Good integration test structure with Kubeflow/Llama Stack but not automated in CI"
  - dimension: "Build Integration"
    score: 2.0
    status: "No PR-time build validation; Containerfile not built or tested in CI"
  - dimension: "Image Testing"
    score: 2.0
    status: "Minimal Containerfile using non-UBI base image, no runtime validation"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "pytest-cov in dev dependencies but completely unused in CI"
  - dimension: "CI/CD Automation"
    score: 4.0
    status: "CI runs pre-commit only; no test execution; release has smoke tests"
  - dimension: "Static Analysis"
    score: 6.0
    status: "Good ruff/mypy/pre-commit setup but no Dependabot and non-UBI base image"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "CI does not execute any tests"
    impact: "Test regressions are invisible; broken code can merge freely since CI only runs pre-commit linters"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No unit tests — all tests require live infrastructure"
    impact: "No fast feedback loop; every test requires a running Llama Stack server and/or Kubeflow cluster"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No PR-time container image build or validation"
    impact: "Containerfile breakage only discovered post-merge or during deployment"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Test coverage unknown; regressions in coverage invisible; pytest-cov dependency goes unused"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "Containerfile uses python:3.12 base image (not UBI)"
    impact: "Not FIPS-capable; may fail Red Hat compliance requirements for production builds"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add pytest execution to CI workflow"
    effort: "2-3 hours"
    impact: "Catch test regressions on every PR; pre-commit hook already runs non-integration tests"
  - title: "Enable Dependabot for dependency alerts"
    effort: "1-2 hours"
    impact: "Automated security alerts and dependency update PRs for pip, npm, and docker ecosystems"
  - title: "Add Containerfile build step to CI"
    effort: "2-3 hours"
    impact: "Validate container builds on every PR before merge"
  - title: "Add codecov integration with coverage reporting"
    effort: "2-4 hours"
    impact: "Track coverage over time and enforce minimum thresholds on PRs"
  - title: "Create CLAUDE.md with test patterns and project context"
    effort: "2-3 hours"
    impact: "Improve AI-assisted development with project-specific guidance"
recommendations:
  priority_0:
    - "Add pytest job to CI that runs non-integration tests on every PR (currently only pre-commit hook runs them)"
    - "Write true unit tests with mocked dependencies for provider, config, compat, and wrapper modules"
    - "Add Containerfile build validation to PR workflow"
  priority_1:
    - "Enable codecov integration with coverage thresholds (start at current baseline)"
    - "Add Dependabot configuration for pip, npm, and docker ecosystems"
    - "Switch Containerfile base image from python:3.12 to UBI-based image for FIPS compatibility"
    - "Add multi-stage Containerfile build to reduce image size"
  priority_2:
    - "Create CLAUDE.md and .claude/rules/ with test creation guidance"
    - "Add HEALTHCHECK to Containerfile"
    - "Add integration test CI job (scheduled/manual) for live infrastructure tests"
    - "Add multi-arch container build support"
---

# Quality Analysis: llama-stack-provider-ragas

**Repository**: [opendatahub-io/llama-stack-provider-ragas](https://github.com/opendatahub-io/llama-stack-provider-ragas)
**Component**: AI Safety (RHOAIENG)
**Tier**: Midstream
**Primary Language**: Python 3.12
**Type**: Library / Llama Stack Provider
**Analysis Date**: 2026-07-20

## Executive Summary

- **Overall Score: 3.3/10**
- **Key Strengths**: Well-configured static analysis (ruff, mypy, pre-commit hooks), structured integration tests with good parametrization, release workflow includes smoke testing
- **Critical Gaps**: CI does not run any tests, no true unit tests, no coverage tracking, no PR-time container build validation, no dependency alerts
- **Agent Rules Status**: Missing

This repository provides a Ragas evaluation provider for Llama Stack with both inline and remote (Kubeflow-based) execution modes. While it has a reasonable set of integration tests and good linting configuration, the CI pipeline critically **does not execute any test suite** — it only runs pre-commit linters. All existing tests require live infrastructure (Llama Stack server, Kubeflow cluster) with no isolated unit tests for fast feedback.

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 3/10 | 15% | 0.45 | All tests require external services; no true isolated unit tests |
| Integration/E2E | 5/10 | 20% | 1.00 | Good structure with Kubeflow/Llama Stack but not automated in CI |
| Build Integration | 2/10 | 15% | 0.30 | No PR-time build validation; Containerfile not tested |
| Image Testing | 2/10 | 10% | 0.20 | Minimal Containerfile, non-UBI base, no runtime validation |
| Coverage Tracking | 1/10 | 10% | 0.10 | pytest-cov dependency exists but unused |
| CI/CD Automation | 4/10 | 15% | 0.60 | Pre-commit checks only; no test execution in CI |
| Static Analysis | 6/10 | 10% | 0.60 | Good ruff/mypy setup; no Dependabot; non-UBI base |
| Agent Rules | 0/10 | 5% | 0.00 | Completely absent |
| **Overall** | **3.3/10** | **100%** | **3.25** | |

## Critical Gaps

### 1. CI Does Not Execute Any Tests
- **Severity**: HIGH
- **Impact**: Test regressions are completely invisible. The CI workflow (`.github/workflows/ci.yml`) only runs pre-commit hooks (ruff, mypy, trailing whitespace, etc.). While pre-commit config includes a pytest hook that runs non-integration tests, this does not run in the CI workflow — only locally on developer machines.
- **Effort**: 4-6 hours
- **Evidence**: The CI job named "Pre-commit Checks" runs `uv run pre-commit run --all-files` which exercises linters but the pytest pre-commit hook may silently pass if no non-integration tests exist (exit code 5 → treated as success).

### 2. No True Unit Tests — All Tests Require Live Infrastructure
- **Severity**: HIGH
- **Impact**: Every test in the repository is marked with `pytestmark = pytest.mark.integration_test` and requires either a running Llama Stack server (`http://localhost:8321`) or a Kubeflow cluster with S3 storage. There is no fast feedback loop for developers.
- **Effort**: 8-16 hours
- **Key Source Files Lacking Unit Tests**:
  - `config.py` (122 lines) — Configuration validation and parsing
  - `compat.py` (110 lines) — Compatibility layer with version-specific imports
  - `constants.py` (33 lines) — Metric mapping
  - `errors.py` (16 lines) — Error handling
  - `logging_utils.py` (34 lines) — Table rendering
  - `inline/wrappers_inline.py` (251 lines) — Inline LLM/embedding wrappers
  - `remote/wrappers_remote.py` (245 lines) — Remote LLM/embedding wrappers

### 3. No PR-Time Container Image Build or Validation
- **Severity**: HIGH
- **Impact**: The `Containerfile` is never built or validated in CI. Breakage in the container build is only discovered post-merge or during downstream builds. The release workflow builds a Python package (wheel/sdist) but does not build the container.
- **Effort**: 4-6 hours

### 4. No Coverage Tracking or Enforcement
- **Severity**: MEDIUM
- **Impact**: `pytest-cov` is listed in dev dependencies but never used — no `--cov` flag in pytest configuration, no `.codecov.yml`, no coverage reporting in CI, no thresholds. Test coverage is a complete unknown.
- **Effort**: 4-6 hours

### 5. Non-UBI Base Image in Containerfile
- **Severity**: MEDIUM
- **Impact**: The Containerfile uses `FROM python:3.12` (Debian-based) which is not FIPS-capable and may not meet Red Hat compliance requirements. For RHOAI/downstream builds, UBI-based images are expected.
- **Effort**: 2-4 hours

## Quick Wins

### 1. Add pytest Execution to CI Workflow (2-3 hours)
Add a dedicated test job to `.github/workflows/ci.yml`:
```yaml
  test:
    name: Run Tests
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v4
      with:
        python-version: "3.12"
    - uses: astral-sh/setup-uv@v4
      with:
        version: "0.8.11"
    - run: uv sync --extra dev
    - run: |
        KUBEFLOW_BASE_IMAGE=dummy uv run pytest -v \
          -m "not integration_test" \
          --tb=short --cov=src --cov-report=xml
    - uses: codecov/codecov-action@v4
      with:
        files: coverage.xml
```

### 2. Enable Dependabot (1-2 hours)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
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
```

### 3. Add Containerfile Build to CI (2-3 hours)
Add a container build job to validate the Containerfile on PRs:
```yaml
  container-build:
    name: Container Build Validation
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - run: docker build -f Containerfile -t test-image .
```

### 4. Add Codecov Integration (2-4 hours)
Create `.codecov.yml`:
```yaml
coverage:
  status:
    project:
      default:
        target: auto
        threshold: 5%
    patch:
      default:
        target: 80%
comment:
  layout: "reach, diff, flags, files"
```

### 5. Create CLAUDE.md (2-3 hours)
Create a `CLAUDE.md` file with project-specific test patterns, architecture overview, and contribution guidelines for AI-assisted development.

## Detailed Findings

### Unit Tests

**Score: 3/10**

| Metric | Value |
|--------|-------|
| Test files | 5 (4 test + 1 conftest) |
| Test lines | 559 |
| Source files (non-`__init__`) | 15 |
| Source lines | ~1,750 |
| Test-to-source ratio | 0.32 (559/1,754) |
| Framework | pytest + pytest-asyncio |
| Isolation | None — all tests require live services |

**Findings**:
- All 4 test files are marked as integration tests (`pytestmark = pytest.mark.integration_test`)
- The pre-commit hook runs `pytest -m "not integration_test"` which effectively runs zero tests
- `conftest.py` has well-structured fixtures for test data, config objects, and clients
- Tests use parametrization (`@pytest.mark.parametrize`) for metric variation
- No mocking/patching in unit-test scope (only `test_kubeflow_integration.py` uses mocks but within a KFP component, not in isolated unit tests)

**Missing Unit Test Coverage**:
- Config validation (valid/invalid configs, environment variable handling)
- Metric mapping and constant lookups
- Compatibility layer version detection
- Wrapper initialization and error handling
- Logging utility formatting

### Integration/E2E Tests

**Score: 5/10**

| Test File | Scope | Infrastructure Required |
|-----------|-------|------------------------|
| `test_inline_evaluation.py` | Inline Ragas eval via Llama Stack API | Llama Stack server |
| `test_remote_evaluation.py` | Remote eval with LLM/embedding wrappers | Llama Stack server, Kubeflow |
| `test_remote_wrappers.py` | LLM and embedding wrapper validation | Llama Stack server, Kubeflow |
| `test_kubeflow_integration.py` | Full KFP pipeline execution | Llama Stack, Kubeflow, S3, OpenShift |

**Strengths**:
- Tests cover both sync and async execution paths (`@pytest.mark.asyncio`)
- Parametrized metric testing allows easy expansion
- `test_kubeflow_integration.py` tests the full pipeline lifecycle from data retrieval through evaluation
- Good assertion patterns: type checks, range validation, response structure verification

**Gaps**:
- No CI automation for integration tests (no scheduled workflow, no manual dispatch)
- No multi-version testing (single Python version, no version matrix for Llama Stack or Ragas)
- No cluster setup automation (Kind, Minikube) — requires pre-existing infrastructure
- Test data is hardcoded rather than parameterized for broader coverage

### Build Integration

**Score: 2/10**

**Findings**:
- **No PR-time build validation**: The CI workflow only runs pre-commit checks
- **Release workflow builds Python package**: `uv build` creates wheel and sdist with smoke tests (import validation)
- **No Containerfile build in any workflow**: The container image is never validated in CI
- **No Konflux simulation**: No `.tekton/` pipeline definitions in the analyzed branch (though Mergify skips `.tekton/` changes, suggesting they may exist on other branches)
- **No manifest validation**: Distribution `run.yaml` is not validated in CI

**What Release Workflow Does Right**:
- Builds both wheel and sdist
- Smoke tests both artifacts (`python -c "import llama_stack_provider_ragas"`)
- Verifies post-publish installation from PyPI
- Uses trusted publishing (OIDC-based PyPI auth)

### Image Testing

**Score: 2/10**

**Containerfile Analysis**:
```dockerfile
FROM python:3.12
WORKDIR /usr/local/src/kfp/components
COPY . .
RUN pip install --no-cache-dir -e ".[remote]"
```

**Issues**:
- **Not multi-stage**: Single stage copies everything including `.git`, tests, docs
- **Non-UBI base image**: `python:3.12` is Debian-based, not FIPS-capable
- **No HEALTHCHECK**: No container health validation
- **No runtime validation**: No tests verify the image starts correctly or serves requests
- **No multi-arch support**: No `--platform` or `buildx` configuration
- **Editable install in production**: `pip install -e` is unusual for production containers

**Positives**:
- `.dockerignore` exists and excludes `.venv`, `.git`, `.github`, `.vscode`
- `--no-cache-dir` flag reduces image size

### Coverage Tracking

**Score: 1/10**

**Findings**:
- `pytest-cov` is listed in `[project.optional-dependencies.dev]`
- No `--cov` or `--coverprofile` flags in pytest configuration (`pyproject.toml` `addopts = "-v"`)
- No `.codecov.yml` or coverage configuration file
- No coverage reporting in any CI workflow
- No coverage thresholds or enforcement
- The pre-commit pytest hook does not include `--cov` flag

### CI/CD Automation

**Score: 4/10**

**Workflow Inventory**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | push/PR to main/develop | Pre-commit linter checks only |
| `release.yaml` | release published | Build + publish to PyPI |
| `docs.yml` | push/PR on docs paths | Build Antora documentation |

**Strengths**:
- UV dependency caching in CI (`actions/cache@v3` with `uv.lock` hash key)
- Concurrency control on docs workflow (`cancel-in-progress: false` for pages)
- Path filtering on docs workflow (only triggers on docs changes)
- Mergify configuration for automated branch sync (main → incubation → stable)
- Release workflow has excellent smoke testing pipeline

**Gaps**:
- **No test execution in CI** — the most critical gap
- No matrix strategy for Python versions (only 3.12)
- No timeout configuration on CI jobs
- No concurrency control on CI workflow
- No scheduled/dispatch workflow for integration tests
- CI uses deprecated `actions/setup-python@v4` and `actions/cache@v3`

### Static Analysis

**Score: 6/10**

**Linting (Ruff)**:
- Configured in `pyproject.toml` with 7 rule categories: `E` (pycodestyle errors), `W` (warnings), `F` (pyflakes), `I` (isort), `B` (bugbear), `C4` (comprehensions), `UP` (pyupgrade)
- Target version: Python 3.12
- Reasonable ignore list: `E501` (line length), `B008` (function calls in defaults), `C901` (complexity)

**Type Checking (mypy)**:
- Configured in `pyproject.toml` with reasonable strictness
- `check_untyped_defs = true`, `warn_return_any = true`, `strict_equality = true`
- `disallow_untyped_defs = false` — could be stricter
- `ignore_missing_imports = true` — necessary for the ecosystem

**Pre-commit Hooks**:
- 4 repo sources with 8+ hooks total
- Standard hooks: trailing-whitespace, end-of-file-fixer, check-yaml, check-added-large-files, check-merge-conflict, debug-statements
- Ruff: lint check with auto-fix + formatting
- mypy with `types-requests` additional dependency
- Local pytest hook (runs non-integration tests)

**FIPS Compatibility**:
- No FIPS-problematic crypto imports found in source code
- Containerfile uses `python:3.12` (Debian-based, not FIPS-capable)
- No FIPS build tags or BoringCrypto configuration (N/A for Python)

**Dependency Alerts**:
- **No Dependabot configuration** (`.github/dependabot.yml` absent)
- **No Renovate configuration** (`renovate.json` / `.renovaterc` absent)
- Multiple dependency ecosystems to cover: pip, npm, docker, github-actions

### Agent Rules

**Score: 0/10**

**Findings**:
- No `CLAUDE.md` in repository root
- No `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` test creation rules
- No `.claude/skills/` custom skills
- No testing documentation beyond README

**What Should Exist**:
- `CLAUDE.md` with project architecture, test patterns, and contribution guidelines
- `.claude/rules/unit-tests.md` with mock patterns for Llama Stack client, Ragas, and Kubeflow
- `.claude/rules/integration-tests.md` with infrastructure setup requirements
- Testing style guide covering async patterns, parametrization, and fixture usage

## Recommendations

### Priority 0 (Critical)

1. **Add pytest execution to CI workflow** — The single highest-impact change. Add a job that runs `pytest -m "not integration_test"` with coverage reporting. Currently no tests run in CI at all.

2. **Write true unit tests for core modules** — Create tests that mock external dependencies:
   - `test_config.py`: Validate config parsing, defaults, and error handling
   - `test_compat.py`: Test compatibility layer with version detection
   - `test_constants.py`: Verify metric mappings
   - `test_wrappers_unit.py`: Test wrapper initialization and method delegation with mocked clients

3. **Add Containerfile build validation to PR workflow** — Add a CI job that builds the container image to catch Containerfile breakage before merge.

### Priority 1 (High Value)

4. **Enable codecov integration** — Add `pytest-cov` usage to CI, create `.codecov.yml`, enforce coverage thresholds on PRs.

5. **Add Dependabot configuration** — Cover pip, npm, docker, and github-actions ecosystems.

6. **Switch Containerfile to UBI base image** — Replace `FROM python:3.12` with `FROM registry.access.redhat.com/ubi9/python-312` for FIPS compatibility and Red Hat compliance.

7. **Implement multi-stage Containerfile** — Separate build and runtime stages, exclude test/dev files, use non-editable install.

### Priority 2 (Nice-to-Have)

8. **Create CLAUDE.md and agent rules** — Add AI-assisted development guidance with test patterns and project context.

9. **Add HEALTHCHECK to Containerfile** — Enable container orchestrators to detect unhealthy instances.

10. **Add integration test CI job** — Create a `workflow_dispatch` or scheduled workflow that runs integration tests against live infrastructure.

11. **Add multi-arch container build support** — Enable `linux/amd64` and `linux/arm64` builds.

12. **Update CI action versions** — Upgrade to `actions/setup-python@v5`, `actions/cache@v4`.

## Comparison to Gold Standards

| Capability | llama-stack-provider-ragas | odh-dashboard | notebooks | kserve |
|------------|---------------------------|---------------|-----------|--------|
| Unit tests in CI | No | Yes | Yes | Yes |
| Integration tests in CI | No | Yes (Cypress) | Yes | Yes (envtest) |
| Coverage enforcement | No | Yes (codecov) | Partial | Yes |
| PR container build | No | Yes | Yes | Yes |
| Multi-stage Dockerfile | No | Yes | Yes | Yes |
| UBI base image | No | Yes | Yes | Yes |
| HEALTHCHECK | No | N/A | Partial | Yes |
| Dependabot/Renovate | No | Yes | Yes | Yes |
| Pre-commit hooks | Yes | Yes | Partial | Yes |
| Ruff/linting | Yes (ruff+mypy) | Yes (ESLint) | Partial | Yes (golangci-lint) |
| Agent rules | No | Yes | No | No |
| Multi-arch builds | No | N/A | Yes | Yes |
| Test parallelization | No | Yes | Yes | Yes (matrix) |
| Concurrency control | Partial (docs only) | Yes | Yes | Yes |

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yml` — Pre-commit checks (linting only)
- `.github/workflows/release.yaml` — PyPI publishing with smoke tests
- `.github/workflows/docs.yml` — Antora documentation build/deploy
- `.github/pull.yml` — Upstream sync configuration
- `.mergify.yml` — Branch backport rules (main → incubation → stable)

### Testing
- `tests/conftest.py` — Shared fixtures (client, config, test data)
- `tests/test_inline_evaluation.py` — Inline eval integration tests
- `tests/test_remote_evaluation.py` — Remote eval integration tests
- `tests/test_remote_wrappers.py` — LLM/embedding wrapper integration tests
- `tests/test_kubeflow_integration.py` — Full KFP pipeline integration tests
- `pyproject.toml` — pytest configuration (`[tool.pytest.ini_options]`)

### Source Code
- `src/llama_stack_provider_ragas/` — Main package (19 Python files, ~1,750 lines)
- `src/llama_stack_provider_ragas/inline/` — Inline evaluation provider
- `src/llama_stack_provider_ragas/remote/` — Remote evaluation provider
- `src/llama_stack_provider_ragas/remote/kubeflow/` — Kubeflow pipeline components

### Build / Container
- `Containerfile` — Container image definition (python:3.12 base)
- `.dockerignore` — Docker build exclusions
- `pyproject.toml` — Python build system (hatchling)
- `distribution/run.yaml` — Llama Stack distribution configuration

### Static Analysis
- `pyproject.toml` — Ruff and mypy configuration
- `.pre-commit-config.yaml` — Pre-commit hooks (ruff, mypy, pytest, standard hooks)
