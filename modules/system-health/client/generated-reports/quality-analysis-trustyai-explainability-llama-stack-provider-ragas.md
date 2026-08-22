---
repository: "trustyai-explainability/llama-stack-provider-ragas"
overall_score: 3.4
scorecard:
  - dimension: "Unit Tests"
    score: 3.0
    status: "All tests are integration tests requiring live infrastructure; no isolated unit tests exist"
  - dimension: "Integration/E2E"
    score: 5.0
    status: "Solid integration tests for Kubeflow and remote wrappers, but not automated in CI"
  - dimension: "Build Integration"
    score: 2.0
    status: "No PR-time build validation; container images not built or tested in CI"
  - dimension: "Image Testing"
    score: 2.0
    status: "Basic Containerfile and Dockerfile.konflux exist but no runtime validation or health checks"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "pytest-cov listed as dependency but never used; no coverage thresholds or reporting"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "Pre-commit runs on PRs; solid release workflow with smoke tests; no test execution in CI"
  - dimension: "Static Analysis"
    score: 6.0
    status: "Good ruff + mypy + pre-commit setup; missing Dependabot/Renovate for dependency alerts"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No unit tests — all tests require live infrastructure"
    impact: "Code changes cannot be validated without a running Llama Stack server and Kubeflow cluster; regressions go undetected until manual testing"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No coverage tracking or enforcement"
    impact: "No visibility into what code paths are tested; regressions can be introduced silently"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No PR-time container build validation"
    impact: "Containerfile or Dockerfile.konflux breakage discovered only after merge in Konflux"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Integration tests not automated in CI"
    impact: "Tests exist but never run automatically; manual execution required against live cluster"
    severity: "MEDIUM"
    effort: "12-20 hours"
quick_wins:
  - title: "Add unit tests with mocked external dependencies"
    effort: "4-6 hours"
    impact: "Catch regressions on every PR without requiring live infrastructure"
  - title: "Enable coverage tracking with pytest-cov in CI"
    effort: "1-2 hours"
    impact: "Immediate visibility into test coverage; pytest-cov is already a dev dependency"
  - title: "Add Dependabot configuration for dependency alerts"
    effort: "30 minutes"
    impact: "Automated security and dependency update PRs"
  - title: "Add PR-time container image build step"
    effort: "2-3 hours"
    impact: "Catch Containerfile/Dockerfile.konflux breakage before merge"
  - title: "Create basic CLAUDE.md with test guidelines"
    effort: "1-2 hours"
    impact: "Guide AI agents to produce consistent, quality-aligned contributions"
recommendations:
  priority_0:
    - "Add true unit tests with mocked LlamaStackClient, Kubeflow, and Ragas dependencies to enable CI-time validation"
    - "Enable pytest-cov in CI with a minimum coverage threshold (start at 50%, increase gradually)"
    - "Add PR-time container build validation for both Containerfile and Dockerfile.konflux"
  priority_1:
    - "Configure Dependabot for pip and docker ecosystems"
    - "Add Python version matrix testing (3.12, 3.13) in CI"
    - "Create CLAUDE.md with project-specific test patterns and contribution guidelines"
    - "Add multi-stage builds to Containerfile for smaller production images"
  priority_2:
    - "Add container runtime smoke tests (import check, health endpoint)"
    - "Add HEALTHCHECK instruction to container images"
    - "Set up a lightweight integration test environment in CI (e.g., mock Llama Stack server)"
    - "Add multi-arch container image support"
---

# Quality Analysis: llama-stack-provider-ragas

## Executive Summary

- **Overall Score: 3.4/10**
- **Repository**: [trustyai-explainability/llama-stack-provider-ragas](https://github.com/trustyai-explainability/llama-stack-provider-ragas)
- **Type**: Python library (Llama Stack provider for Ragas evaluation)
- **Primary Language**: Python 3.12
- **JIRA**: RHOAIENG / AI Safety (upstream tier)
- **Key Strengths**: Good static analysis setup with ruff + mypy + pre-commit; thoughtful integration test design with parameterized metrics; solid release workflow with wheel smoke tests
- **Critical Gaps**: No unit tests (all tests require live infrastructure), no coverage tracking, no PR-time build validation, no dependency alerting
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 3/10 | 15% | 0.45 | All tests are integration-only; no isolated unit tests |
| Integration/E2E | 5/10 | 20% | 1.00 | Good test design but not automated in CI |
| Build Integration | 2/10 | 15% | 0.30 | No PR-time build validation |
| Image Testing | 2/10 | 10% | 0.20 | Basic container files, no runtime validation |
| Coverage Tracking | 1/10 | 10% | 0.10 | pytest-cov available but unused |
| CI/CD Automation | 5/10 | 15% | 0.75 | Pre-commit + release workflow; no test execution in CI |
| Static Analysis | 6/10 | 10% | 0.60 | Ruff + mypy + pre-commit; no Dependabot |
| Agent Rules | 0/10 | 5% | 0.00 | No agent rules |
| **Overall** | **3.4/10** | **100%** | **3.40** | |

## Critical Gaps

### 1. No Unit Tests — All Tests Require Live Infrastructure (HIGH)
- **Impact**: Code changes cannot be validated without a running Llama Stack server and Kubeflow cluster
- **Detail**: All 4 test files (`test_inline_evaluation.py`, `test_remote_evaluation.py`, `test_remote_wrappers.py`, `test_kubeflow_integration.py`) are marked with `@pytest.mark.integration_test`. The pre-commit hook runs `pytest -m "not integration_test"`, which finds zero tests to execute.
- **Effort**: 8-12 hours to add unit tests with mocked dependencies

### 2. No Coverage Tracking or Enforcement (HIGH)
- **Impact**: No visibility into code coverage; impossible to track coverage trends or enforce minimums
- **Detail**: `pytest-cov` is listed in `[project.optional-dependencies.dev]` but is never used — no `--cov` flag in CI or pre-commit, no `.codecov.yml`, no coverage thresholds
- **Effort**: 2-4 hours

### 3. No PR-time Container Build Validation (HIGH)
- **Impact**: Containerfile or Dockerfile.konflux breakage discovered only post-merge in Konflux
- **Detail**: `Containerfile` (python:3.12 base) and `Dockerfile.konflux` (UBI9 base) exist but are never built in CI. The CI workflow (`ci.yml`) only runs pre-commit checks.
- **Effort**: 4-6 hours

### 4. Integration Tests Not Automated in CI (MEDIUM)
- **Impact**: Well-designed integration tests exist but are only run manually
- **Detail**: Tests require `KUBEFLOW_PIPELINES_ENDPOINT`, `KUBEFLOW_NAMESPACE`, `KUBEFLOW_LLAMA_STACK_URL`, and other environment variables pointing to live infrastructure. No CI job provisions this infrastructure.
- **Effort**: 12-20 hours (requires infrastructure provisioning or mock server)

## Quick Wins

### 1. Enable Coverage Tracking with pytest-cov (1-2 hours)
`pytest-cov` is already a dev dependency. Add `--cov` to pytest configuration:

```toml
# pyproject.toml
[tool.pytest.ini_options]
addopts = "-v --cov=src/llama_stack_provider_ragas --cov-report=term-missing --cov-fail-under=50"
```

### 2. Add Dependabot Configuration (30 minutes)
Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "pip"
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

### 3. Add PR-time Container Build Step (2-3 hours)
Add to `ci.yml`:

```yaml
  container-build:
    name: Container Build Validation
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Containerfile
        run: docker build -f Containerfile -t test-container .
      - name: Build Dockerfile.konflux
        run: docker build -f Dockerfile.konflux -t test-konflux .
      - name: Smoke test container
        run: |
          docker run --rm test-container python -c "import llama_stack_provider_ragas"
```

### 4. Create Basic CLAUDE.md (1-2 hours)
Add `CLAUDE.md` with project conventions, test patterns, and contribution guidelines. Use `/test-rules-generator` to bootstrap test-specific rules.

## Detailed Findings

### Unit Tests
- **Test Files**: 4 files (559 lines total including conftest.py)
- **Source Files**: 19 files (1,525 lines)
- **Test-to-Code Ratio**: 0.37 (lines), 0.21 (files) — appears decent but is misleading
- **Framework**: pytest with pytest-asyncio
- **Critical Issue**: Every test is marked `@pytest.mark.integration_test`. The pre-commit pytest hook runs with `-m "not integration_test"`, meaning **zero tests execute on PR**. The exit code 5 (no tests collected) is explicitly swallowed: `[ $ret = 5 ] && exit 0`.
- **What's Missing**:
  - Unit tests for `config.py` (configuration validation, defaults)
  - Unit tests for `compat.py` (compatibility layer)
  - Unit tests for `wrappers_inline.py` and `wrappers_remote.py` (with mocked LLM/embedding clients)
  - Unit tests for `ragas_inline_eval.py` and `ragas_remote_eval.py` (with mocked Ragas evaluate)
  - Unit tests for `kubeflow/components.py`, `kubeflow/pipeline.py`, `kubeflow/utils.py`

### Integration/E2E Tests
- **test_inline_evaluation.py**: Tests inline evaluation through Llama Stack eval API with parameterized metrics. Registers datasets and benchmarks, runs eval jobs.
- **test_remote_evaluation.py**: Tests remote LLM and embedding wrappers with Ragas `evaluate()`. Validates result types, column presence, value ranges.
- **test_remote_wrappers.py**: Tests `LlamaStackRemoteLLM` and `LlamaStackRemoteEmbeddings` wrappers (sync + async). Verifies embedding dimensions, LLM generation structure.
- **test_kubeflow_integration.py**: Tests Kubeflow pipeline construction and submission. Includes a clever mock-based fake evaluation component for pipeline testing.
- **Strengths**: Good use of pytest fixtures and parameterized tests, async test support, thoughtful assertions
- **Gaps**: Tests are not automated in CI, no multi-version testing, no test isolation (depends on external state)

### Build Integration
- **CI workflow** (`ci.yml`): Only runs pre-commit checks on PRs
- **Release workflow** (`release.yaml`): Builds wheel, runs smoke tests (`python -c "import llama_stack_provider_ragas"`), publishes to PyPI — but only on release tag
- **Container files**: `Containerfile` and `Dockerfile.konflux` exist but are never built or validated in CI
- **No Makefile** or build automation targets
- **Mergify**: Configured for backporting (main → incubation → stable)
- **pull.yml**: Configured for upstream sync from `trustyai-explainability:main`

### Image Testing
- **Containerfile**: Single-stage build from `python:3.12`. Simple `COPY . .` and `pip install`. No multi-stage optimization.
- **Dockerfile.konflux**: Single-stage build from `registry.redhat.io/ubi9/python-312` (FIPS-capable). Proper Red Hat labels. Installs without `[remote]` extras.
- **No HEALTHCHECK** instruction in either file
- **No runtime validation** — no testcontainers, no `docker run` tests
- **No multi-architecture** support (no `--platform`, no `docker buildx`)
- **.dockerignore** present with sensible exclusions

### Coverage Tracking
- `pytest-cov` listed in `[project.optional-dependencies.dev]` but never invoked
- No `.codecov.yml`, `codecov.yml`, or `.coveragerc`
- No `--cov` flag in any pytest invocation
- No coverage thresholds
- No PR coverage reporting or badge

### CI/CD Automation
- **Workflows**: 3 total
  - `ci.yml`: Triggered on push/PR to main/develop. Runs pre-commit (ruff, mypy, pytest with no integration tests). Uses uv with dependency caching.
  - `docs.yml`: Path-filtered for docs changes. Builds Antora docs and deploys to GitHub Pages. Has concurrency control.
  - `release.yaml`: Triggered on release publish. Builds wheel, runs smoke tests, publishes to PyPI, verifies install from PyPI. Well-structured release pipeline.
- **Caching**: uv dependency cache configured in ci.yml
- **Concurrency**: Only on docs.yml
- **Missing**: No test matrix (single Python version), no test execution in CI, no container build, no concurrency on ci.yml

### Static Analysis

#### Linting
- **ruff**: Configured in `pyproject.toml` with 7 rule categories: E (pycodestyle errors), W (warnings), F (pyflakes), I (isort), B (flake8-bugbear), C4 (comprehensions), UP (pyupgrade)
- **mypy**: Configured with moderate strictness — `check_untyped_defs = true`, `warn_return_any = true`, `strict_equality = true`, `warn_unreachable = true`, but `disallow_untyped_defs = false`
- **pre-commit**: Well-configured with 8 hooks: trailing-whitespace, end-of-file-fixer, check-yaml, check-added-large-files, check-merge-conflict, debug-statements, ruff-check (with auto-fix), ruff-format, mypy

#### FIPS Compatibility
- No FIPS-incompatible crypto imports detected in source code
- `Dockerfile.konflux` uses UBI9 base image (FIPS-capable) — good
- `Containerfile` uses `python:3.12` (not FIPS-capable) — acceptable for development/upstream use

#### Dependency Alerts
- **No Dependabot** configuration (`.github/dependabot.yml` absent)
- **No Renovate** configuration
- Dependencies are pinned in `pyproject.toml` (e.g., `ragas==0.3.0`, `greenlet==3.2.4`, `pandas<2.3.0`)

### Agent Rules
- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **Test creation rules**: None
- **Recommendation**: Generate rules with `/test-rules-generator`

## Recommendations

### Priority 0 (Critical)

1. **Add unit tests with mocked dependencies**
   - Mock `LlamaStackClient`, `kfp.Client`, and Ragas `evaluate()` for isolated testing
   - Target modules: `config.py`, `compat.py`, `wrappers_inline.py`, `wrappers_remote.py`, `ragas_inline_eval.py`, `ragas_remote_eval.py`
   - The test for `test_kubeflow_integration.py` already demonstrates mock patterns (e.g., `mock_answer_relevancy_side_effect`) that could be extracted and reused

2. **Enable coverage tracking**
   - Add `--cov=src/llama_stack_provider_ragas --cov-report=term-missing --cov-fail-under=50` to pytest config
   - Add `.codecov.yml` with PR comment integration
   - Add `codecov/codecov-action` to CI workflow

3. **Add PR-time container build validation**
   - Build `Containerfile` and `Dockerfile.konflux` on every PR
   - Run import smoke test: `docker run --rm <image> python -c "import llama_stack_provider_ragas"`

### Priority 1 (High Value)

4. **Configure Dependabot** for pip, docker, and github-actions ecosystems
5. **Add Python version matrix testing** (3.12 + 3.13) in CI
6. **Create CLAUDE.md** with project conventions, test patterns, and contribution guidelines
7. **Add multi-stage Dockerfiles** to reduce image size (builder stage + runtime stage)
8. **Add concurrency control** to `ci.yml` to cancel stale PR runs

### Priority 2 (Nice-to-Have)

9. **Add container health checks** (HEALTHCHECK instruction)
10. **Set up lightweight integration test CI** with a mock Llama Stack server
11. **Add multi-arch container support** for ARM64/AMD64
12. **Add type stubs** and increase mypy strictness (`disallow_untyped_defs = true`)

## Comparison to Gold Standards

| Practice | llama-stack-provider-ragas | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|----------|---------------------------|---------------------|-------------------|---------------|
| Unit Tests | Integration-only, no isolated tests | Multi-layer: unit, integration, contract | Comprehensive unit tests | Extensive unit + envtest |
| Integration/E2E | Manual-only, not in CI | Automated Cypress E2E | Multi-version image testing | Automated E2E with Kind |
| Build Integration | No PR-time validation | PR builds + Konflux simulation | 5-layer image validation | PR-time operator deploy |
| Image Testing | Basic Containerfiles | N/A (web app) | Multi-arch, FIPS, runtime tests | Multi-arch builds |
| Coverage | Dependency present, not used | Enforced thresholds + PR reports | Coverage gates | Codecov with thresholds |
| CI/CD | Pre-commit only | Matrix + parallel + caching | Multi-version matrix | Comprehensive matrix |
| Static Analysis | Ruff + mypy + pre-commit | ESLint + TypeScript strict | golangci-lint | golangci-lint + Dependabot |
| Agent Rules | None | CLAUDE.md + .claude/rules/ | N/A | N/A |

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yml` — PR checks (pre-commit only)
- `.github/workflows/docs.yml` — Documentation build and deploy
- `.github/workflows/release.yaml` — PyPI publish workflow
- `.mergify.yml` — Backport rules (main → incubation → stable)
- `.github/pull.yml` — Upstream sync configuration

### Testing
- `tests/conftest.py` — Shared fixtures (109 lines)
- `tests/test_inline_evaluation.py` — Inline eval integration tests (56 lines)
- `tests/test_remote_evaluation.py` — Remote eval integration tests (77 lines)
- `tests/test_remote_wrappers.py` — Remote wrapper tests (85 lines)
- `tests/test_kubeflow_integration.py` — Kubeflow pipeline integration tests (232 lines)

### Source Code
- `src/llama_stack_provider_ragas/` — Main package (19 files, 1,525 lines)
- `src/llama_stack_provider_ragas/inline/` — Inline evaluation provider
- `src/llama_stack_provider_ragas/remote/` — Remote evaluation provider
- `src/llama_stack_provider_ragas/remote/kubeflow/` — Kubeflow pipeline components

### Container Images
- `Containerfile` — Development container (python:3.12 base)
- `Dockerfile.konflux` — Production container (UBI9 base)
- `.dockerignore` — Docker build exclusions

### Configuration
- `pyproject.toml` — Project config, ruff, mypy, pytest settings
- `.pre-commit-config.yaml` — Pre-commit hooks (ruff, mypy, pytest)
- `uv.lock` — Dependency lock file
