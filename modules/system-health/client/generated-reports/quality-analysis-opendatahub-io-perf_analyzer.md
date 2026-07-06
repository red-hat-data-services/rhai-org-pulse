---
repository: "opendatahub-io/perf_analyzer"
overall_score: 5.4
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Strong genai-perf Python tests (449 functions, 65 files), but zero C++ unit tests for 51K-line core"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "Only 2 integration test files (255 lines); no E2E test infrastructure; external GitLab CI unclear"
  - dimension: "Build Integration"
    score: 2.0
    status: "No PR-time container build; no Konflux simulation; CMake C++ build not validated in GitHub CI"
  - dimension: "Image Testing"
    score: 1.0
    status: "No Dockerfiles in repo; no image build or runtime validation; no container scanning"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "Coverage generated locally (--cov flags) but not uploaded to Codecov/Coveralls; no thresholds or PR gates"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "4 PR-triggered workflows (pytest, pre-commit, CodeQL, GitLab mirror); no caching or concurrency controls"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory; no AI agent test guidance"
critical_gaps:
  - title: "Zero C++ unit tests for 51K-line core engine"
    impact: "The perf_analyzer C++ binary (170 source files, 51K lines) has no unit test coverage in the GitHub repo; regressions in the core performance measurement engine go undetected"
    severity: "HIGH"
    effort: "40-80 hours"
  - title: "No container image build or testing"
    impact: "No Dockerfiles, no image build CI, no runtime validation — container issues only found after downstream consumers build images"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "Coverage generated but never uploaded or enforced"
    impact: "pytest --cov generates reports locally but no Codecov/Coveralls integration; no coverage gates prevent regression"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No concurrency controls or caching in CI"
    impact: "Duplicate workflow runs on rapid pushes waste CI resources; no pip/CMake caching slows builds"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "Minimal integration/E2E test coverage"
    impact: "Only 2 integration tests (multiturn + telemetry); no end-to-end tests against actual inference servers"
    severity: "HIGH"
    effort: "24-40 hours"
quick_wins:
  - title: "Add Codecov integration to pytest workflow"
    effort: "1-2 hours"
    impact: "Immediate visibility into coverage trends and PR-level coverage diff reporting"
  - title: "Add concurrency controls to all PR workflows"
    effort: "30 minutes"
    impact: "Prevent duplicate workflow runs, save CI minutes on rapid pushes"
  - title: "Add pip dependency caching to Python CI"
    effort: "30 minutes"
    impact: "Reduce CI run time by 30-50% via cached pip downloads"
  - title: "Upgrade outdated GitHub Actions versions"
    effort: "1 hour"
    impact: "actions/checkout@v3 and setup-python@v3 are outdated; upgrade to v4/v5 for security and features"
  - title: "Create basic .claude/rules/ for test patterns"
    effort: "2-3 hours"
    impact: "Enable AI agents to generate consistent, high-quality tests following project conventions"
recommendations:
  priority_0:
    - "Add C++ unit testing framework (GoogleTest/doctest) and create initial test suite for core perf_analyzer engine"
    - "Integrate Codecov with coverage thresholds (e.g., 70% minimum, no decrease on PRs)"
    - "Add container image build and basic runtime validation to PR workflow"
  priority_1:
    - "Expand integration test coverage beyond the 2 existing test files"
    - "Add Trivy or Snyk container scanning to CI pipeline"
    - "Create E2E test infrastructure that validates against mock/real inference servers"
    - "Add concurrency controls and dependency caching to all workflows"
  priority_2:
    - "Create comprehensive .claude/rules/ for unit, integration, and E2E test patterns"
    - "Add performance regression testing benchmarks"
    - "Upgrade all GitHub Actions to latest stable versions"
    - "Add SBOM generation for supply chain security"
---

# Quality Analysis: opendatahub-io/perf_analyzer

## Executive Summary

- **Overall Score: 5.4/10**
- **Repository Type**: Performance benchmarking CLI tool (C++ core + Python GenAI-Perf wrapper)
- **Primary Languages**: C++ (51K lines), Python (33K lines)
- **Fork of**: `triton-inference-server/perf_analyzer` (NVIDIA upstream)
- **Key Strengths**: Strong Python unit test suite for genai-perf (449 test functions), comprehensive pre-commit hook configuration (8 hooks including mypy, black, flake8, isort), CodeQL SAST scanning on PRs
- **Critical Gaps**: Zero C++ unit tests for the 51K-line core engine, no container image build/testing, coverage generated but never uploaded or enforced, minimal integration/E2E coverage
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.0/10 | Strong genai-perf Python tests (449 functions across 65 files), but zero C++ tests for 51K-line core |
| Integration/E2E | 3.0/10 | Only 2 integration test files (255 lines); no E2E infrastructure |
| **Build Integration** | **2.0/10** | **No PR-time container build; CMake C++ build not validated in GitHub CI** |
| Image Testing | 1.0/10 | No Dockerfiles, no image builds, no container scanning |
| Coverage Tracking | 4.0/10 | `--cov` flags generate reports but no upload to Codecov; no thresholds |
| CI/CD Automation | 5.0/10 | 4 PR-triggered workflows; no caching or concurrency controls |
| Agent Rules | 0.0/10 | No agent rules or AI test guidance present |

## Critical Gaps

### 1. Zero C++ Unit Tests for Core Engine
- **Impact**: The perf_analyzer C++ binary (170 source files, ~51,600 lines of code) is the core performance measurement engine. It has **zero unit tests** in the GitHub repository. While the `doctest.h` header is listed in CMakeLists.txt, no test files using it exist. Regressions in request scheduling, metrics collection, and protocol handling go completely undetected.
- **Severity**: HIGH
- **Effort**: 40-80 hours (initial framework setup + critical path coverage)
- **Note**: The external GitLab CI (triggered via `trigger_ci.yml`) may run C++ tests, but this is opaque to contributors and PR reviewers.

### 2. No Container Image Build or Testing
- **Impact**: The repository contains no Dockerfiles or Containerfiles. There is no CI step that builds a container image, validates runtime behavior, or scans for vulnerabilities. Downstream consumers (like ODH) must build images independently, discovering issues late.
- **Severity**: HIGH
- **Effort**: 16-24 hours

### 3. Coverage Generated but Never Enforced
- **Impact**: The Python CI workflow runs `pytest --cov=genai_perf --cov-report=xml --cov-report=html`, generating coverage reports. However, these reports are **never uploaded** to Codecov, Coveralls, or any tracking service. No coverage thresholds are enforced — a PR could drop coverage to 0% and still pass.
- **Severity**: HIGH
- **Effort**: 2-4 hours

### 4. Minimal Integration/E2E Coverage
- **Impact**: Only 2 integration test files exist (`test_multiturn.py` at 89 lines, `test_telemetry.py` at 166 lines). No end-to-end tests validate the tool against actual or mock inference servers. The `test_models` directory is referenced in CI (`--ignore-glob=test_models`) but doesn't exist in the repo.
- **Severity**: HIGH
- **Effort**: 24-40 hours

### 5. No Concurrency Controls or Caching
- **Impact**: None of the 4 workflows use `concurrency` groups. Rapid pushes to a PR trigger duplicate runs. No `actions/cache` is used for pip dependencies or CMake builds, resulting in slower CI.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours

## Quick Wins

### 1. Add Codecov Integration (1-2 hours)
Add coverage upload to the existing pytest workflow:
```yaml
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v4
      with:
        file: genai-perf/tests/coverage.xml
        flags: genai-perf
        fail_ci_if_error: true
      env:
        CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}
```

### 2. Add Concurrency Controls (30 minutes)
Add to each workflow:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

### 3. Add pip Dependency Caching (30 minutes)
```yaml
    - name: Set up Python ${{ matrix.python-version }}
      uses: actions/setup-python@v5
      with:
        python-version: ${{ matrix.python-version }}
        cache: 'pip'
```

### 4. Upgrade GitHub Actions Versions (1 hour)
Current outdated versions:
- `actions/checkout@v3` → `@v4`
- `actions/setup-python@v3` → `@v5`
- `github/codeql-action/*@v2` → `@v3`

### 5. Create Basic Agent Rules (2-3 hours)
Create `.claude/rules/` with test patterns for pytest conventions used in the project.

## Detailed Findings

### CI/CD Pipeline

**Workflows (4 total, all PR-triggered):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `python-package-genai.yml` | PR | Run pytest for genai-perf with coverage |
| `pre-commit.yml` | PR | Run pre-commit hooks on changed files |
| `codeql.yml` | PR | CodeQL SAST scanning for Python |
| `trigger_ci.yml` | PR (non-docs) | Mirror to GitLab and trigger external CI pipeline |

**Strengths:**
- All 4 workflows run on every PR
- External GitLab CI pipeline likely runs additional C++ builds/tests (opaque)
- Pre-commit runs only on changed files (efficient)

**Weaknesses:**
- No concurrency controls on any workflow
- No dependency caching
- No periodic/scheduled workflows (nightly builds, etc.)
- Single Python version tested (3.10 only)
- Single OS tested (ubuntu-22.04 only)
- Outdated action versions (checkout@v3, setup-python@v3, codeql@v2)
- C++ build is completely absent from GitHub CI

### Test Coverage

**Python (genai-perf):**
- **65 test files** with **449 test functions** across 17,232 lines
- Well-organized test directories by component:
  - `test_converters/` (6 files) — protocol converter tests
  - `test_data_parser/` (4 files) — data parsing tests
  - `test_exporters/` (5 files) — export format tests
  - `test_metrics/` (4 files) — metrics calculation tests
  - `test_retrievers/` (6 files) — data retrieval tests
  - `test_statistics/` (2 files) — statistical computation tests
  - `test_collectors/` (4 files) — telemetry collector tests
  - `integration_tests/` (2 files) — integration tests
- **Test-to-code ratio**: 0.52 (17,232 test lines / 33,122 source lines) — moderate
- **Mocking**: 40 test files use mocking (61% of test files)
- **Parametrize**: 16 test files use `@pytest.mark.parametrize`
- **Framework**: pytest with pytest-mock, pytest-timeout, pytest-cov, psutil

**C++ (perf_analyzer core):**
- **0 test files** for **170 source files** (51,626 lines)
- `doctest.h` is listed in CMakeLists.txt but no tests use it
- No `add_test()`, `enable_testing()`, or `ctest` configuration
- **Test-to-code ratio**: 0.00 — critical gap

**Integration Tests:**
- Only 2 files in `integration_tests/`:
  - `test_multiturn.py` (89 lines) — multi-turn conversation testing
  - `test_telemetry.py` (166 lines) — telemetry data collection testing
- Both use unittest.mock, suggesting they're closer to unit tests with mocks than true integration tests

### Code Quality

**Pre-commit Hooks (Excellent — 9 hooks):**
- `isort` — import sorting
- `black` — code formatting
- `flake8` — linting (max-line-length=88)
- `clang-format` — C/C++/CUDA formatting
- `codespell` — spell checking
- `mypy` — static type checking
- `pre-commit-hooks` — trailing whitespace, merge conflicts, YAML/JSON validation
- `add-license` — copyright header enforcement

**Static Analysis:**
- CodeQL scanning on PRs (Python language)
- mypy type checking via pre-commit
- `.clang-format` configured (Google-based style)
- No `ruff` (mentioned in pyproject.toml but not active as a hook)

**Weaknesses:**
- No `pylint` or `ruff` as primary linter (using flake8 only)
- No C++ static analysis (cppcheck, clang-tidy) in CI
- mypy runs via pre-commit but not in CI separately

### Container Images

- **No Dockerfiles or Containerfiles** in the repository
- **No image build in CI** — zero container build validation
- **No runtime testing** — no Testcontainers or equivalent
- **No vulnerability scanning** — no Trivy, Snyk, or Grype
- **No SBOM generation** — no syft, cyclonedx, or spdx
- **No image signing** — no cosign or Notary
- This is a significant gap for a project consumed by ODH/RHOAI pipelines

### Security

**Strengths:**
- CodeQL SAST scanning on every PR (Python, with `security-and-quality` query pack)
- `SECURITY.md` with vulnerability disclosure process (NVIDIA PSIRT)
- Pre-commit hooks catch common issues (merge conflicts, executables, etc.)

**Weaknesses:**
- No dependency scanning (Dependabot, Renovate, or equivalent)
- No secret detection (gitleaks, TruffleHog)
- No container vulnerability scanning
- CodeQL only scans Python, not C++ (despite C++ being the larger codebase)
- No SBOM or software supply chain security

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/`, `CLAUDE.md`, or `AGENTS.md` present
- **Quality**: N/A
- **Gaps**: Complete absence of AI agent guidance for test creation, code review, or contribution patterns
- **Recommendation**: Generate test rules with `/test-rules-generator` covering:
  - Python unit test patterns (pytest conventions, mock patterns)
  - Converter/parser test structure
  - Integration test patterns
  - C++ test patterns (if/when C++ tests are added)

## Recommendations

### Priority 0 (Critical)

1. **Add C++ unit testing framework and initial tests**
   - Configure GoogleTest or doctest with CTest in CMakeLists.txt
   - Write initial tests for critical paths: request scheduling, metrics collection, protocol handling
   - Add C++ test execution to GitHub Actions CI

2. **Integrate Codecov with coverage thresholds**
   - Upload existing pytest coverage reports to Codecov
   - Set minimum coverage threshold (start at current level, prevent regression)
   - Add PR-level coverage diff reporting

3. **Add container image build to PR workflow**
   - Create a Dockerfile for perf_analyzer
   - Add image build step to CI
   - Validate the binary starts and responds to `--help`

### Priority 1 (High Value)

4. **Expand integration test coverage**
   - Add integration tests for each converter type
   - Add tests for CLI argument combinations
   - Create mock server fixtures for testing against simulated inference endpoints

5. **Add container vulnerability scanning**
   - Integrate Trivy or Snyk into CI pipeline
   - Set vulnerability severity thresholds (CRITICAL/HIGH block PRs)

6. **Add CI caching and concurrency controls**
   - Add concurrency groups to all 4 workflows
   - Add pip caching to Python workflows
   - Consider matrix expansion (Python 3.10 + 3.12, Ubuntu 22.04 + 24.04)

7. **Upgrade GitHub Actions to current versions**
   - `actions/checkout@v3` → `@v4`
   - `actions/setup-python@v3` → `@v5`
   - `github/codeql-action/*@v2` → `@v3`

### Priority 2 (Nice-to-Have)

8. **Create comprehensive agent rules** (`.claude/rules/`)
   - Unit test patterns for genai-perf
   - Integration test patterns
   - C++ test conventions

9. **Add performance regression benchmarks**
   - Create benchmark suite for genai-perf CLI
   - Track execution time trends
   - Alert on significant regressions

10. **Enable C++ CodeQL scanning**
    - Add `cpp` to the CodeQL language matrix
    - Configure autobuild for CMake

11. **Add dependency update automation**
    - Configure Dependabot or Renovate for Python and C++ dependencies
    - Set update schedule and auto-merge for minor/patch updates

## Comparison to Gold Standards

| Capability | perf_analyzer | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit Tests | Python: Strong (449 functions); C++: None | Comprehensive (Jest + React Testing Library) | Present | Strong (Go testing) |
| Integration Tests | 2 files only | Contract tests + API mocks | Image lifecycle tests | Multi-version |
| E2E Tests | None | Cypress + Playwright | 5-layer validation | Kind-based |
| Coverage Tracking | Generated, not uploaded | Codecov with enforcement | N/A | Codecov with thresholds |
| Container Scanning | None | Trivy in CI | Image validation suite | Trivy + Snyk |
| Pre-commit Hooks | Excellent (9 hooks) | ESLint + Prettier | Basic | golangci-lint |
| SAST | CodeQL (Python only) | CodeQL + ESLint security | N/A | CodeQL + gosec |
| Agent Rules | None | Comprehensive .claude/ | None | None |
| CI Caching | None | Yarn + Docker layer | Docker layer | Go modules |
| Concurrency Control | None | Present | Present | Present |

## File Paths Reference

| Category | Path | Notes |
|----------|------|-------|
| CI Workflows | `.github/workflows/python-package-genai.yml` | pytest for genai-perf |
| CI Workflows | `.github/workflows/pre-commit.yml` | Pre-commit hooks |
| CI Workflows | `.github/workflows/codeql.yml` | SAST scanning |
| CI Workflows | `.github/workflows/trigger_ci.yml` | GitLab CI trigger |
| Pre-commit | `.pre-commit-config.yaml` | 9 hooks configured |
| Python Config | `pyproject.toml` | Root project config |
| Python Config | `genai-perf/pyproject.toml` | GenAI-Perf config |
| Python Tests | `genai-perf/tests/` | 65 test files, 449 functions |
| Integration Tests | `genai-perf/tests/integration_tests/` | 2 files |
| C++ Source | `src/` | 170 files, 51K lines |
| C++ Build | `CMakeLists.txt` | CMake build system |
| Code Formatting | `.clang-format` | Google-based C++ style |
| Pytest Config | `genai-perf/pytest.ini` | Test configuration |
| Security | `SECURITY.md` | NVIDIA vulnerability disclosure |
