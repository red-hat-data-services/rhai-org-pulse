---
repository: "triton-inference-server/perf_analyzer"
overall_score: 5.9
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Strong Python (pytest) and C++ (doctest/gtest) unit test suites with good coverage of core modules"
  - dimension: "Integration/E2E"
    score: 3.5
    status: "Only 2 Python integration tests; no E2E tests against live Triton server in CI; heavy reliance on external GitLab CI"
  - dimension: "Build Integration"
    score: 3.0
    status: "No PR-time build validation for C++ binary; CMake builds happen externally; no image build/test in GitHub CI"
  - dimension: "Image Testing"
    score: 1.0
    status: "No Dockerfile in repository; no container image build, runtime validation, or vulnerability scanning"
  - dimension: "Coverage Tracking"
    score: 5.0
    status: "pytest-cov runs in CI with XML/HTML output but no codecov integration, no enforcement thresholds, no PR reporting"
  - dimension: "CI/CD Automation"
    score: 5.5
    status: "4 GitHub workflows (CodeQL, pre-commit, pytest, GitLab trigger); critical CI offloaded to private GitLab instance"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, .claude/ directory, or any AI agent guidance"
critical_gaps:
  - title: "Critical CI/CD split between GitHub and private GitLab"
    impact: "Core C++ build, integration tests, and E2E tests run only on private NVIDIA GitLab infrastructure inaccessible to external contributors"
    severity: "HIGH"
    effort: "40+ hours"
  - title: "No container image build or testing"
    impact: "No Dockerfile in repo; image build/test/scan entirely external; no validation of runtime behavior before merge"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No coverage enforcement or PR reporting"
    impact: "Coverage data generated but not uploaded to codecov; no thresholds; regressions silently merge"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "C++ unit tests not run in GitHub CI"
    impact: "22 C++ test files with 1484+ assertions exist but only run on private GitLab; open-source contributors cannot verify C++ changes"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "Minimal integration/E2E test coverage"
    impact: "Only 2 integration tests (multiturn + telemetry); no end-to-end tests against a live Triton server in any public CI"
    severity: "MEDIUM"
    effort: "24-40 hours"
quick_wins:
  - title: "Add codecov integration to python-package-genai.yml"
    effort: "1-2 hours"
    impact: "Automated coverage tracking, PR annotations, and regression detection for Python code"
  - title: "Add coverage threshold enforcement"
    effort: "1 hour"
    impact: "Prevent coverage regressions by failing PRs that drop below a minimum threshold"
  - title: "Create basic CLAUDE.md with test patterns"
    effort: "2-3 hours"
    impact: "Guide AI-assisted development with project conventions, test patterns, and contribution standards"
  - title: "Add Trivy dependency scanning workflow"
    effort: "1-2 hours"
    impact: "Automated vulnerability detection for Python and C++ dependencies"
  - title: "Pin CodeQL action versions"
    effort: "30 minutes"
    impact: "CodeQL uses outdated v2/v3 action versions; upgrading to v3+ improves scan quality and security"
recommendations:
  priority_0:
    - "Add codecov integration with PR coverage reporting and minimum threshold enforcement"
    - "Create a GitHub CI workflow to build and run C++ unit tests (even a subset) so open-source contributors get feedback"
    - "Add container image build and basic runtime validation to CI pipeline"
  priority_1:
    - "Expand integration tests beyond the current 2 to cover more GenAI-Perf workflows"
    - "Add dependency vulnerability scanning (Trivy or Dependabot) for Python and C++ dependencies"
    - "Create CLAUDE.md and .claude/rules/ with test automation guidance"
    - "Upgrade CodeQL workflow from v2 to v3 actions and add C++ language scanning"
  priority_2:
    - "Add performance regression testing for GenAI-Perf benchmark results"
    - "Implement contract tests between GenAI-Perf Python and perf_analyzer C++ binary"
    - "Add multi-architecture build support documentation"
    - "Set up Dependabot for automated dependency updates"
---

# Quality Analysis: Triton perf_analyzer

## Executive Summary

- **Overall Score: 5.9/10**
- **Repository Type**: Performance benchmarking CLI tool + Python SDK (GenAI-Perf)
- **Languages**: C++ (51,629 LOC), Python (33,400 LOC)
- **Key Strengths**: Comprehensive pre-commit hooks (isort, black, flake8, mypy, clang-format, codespell), strong Python unit test suite (449 test functions across 65 files), solid C++ test infrastructure (22 test files, 12 mock files, 1484+ assertions using doctest/gtest)
- **Critical Gaps**: Split CI between public GitHub and private NVIDIA GitLab means C++ builds/tests are invisible to external contributors; no container image testing; no coverage enforcement; minimal integration tests
- **Agent Rules Status**: Missing - No CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | Strong Python + C++ test suites covering core modules |
| Integration/E2E | 3.5/10 | Only 2 integration tests; no E2E against live Triton |
| **Build Integration** | **3.0/10** | **No PR-time C++ build or image validation in GitHub CI** |
| Image Testing | 1.0/10 | No Dockerfile; no image build/test/scan in repo |
| Coverage Tracking | 5.0/10 | pytest-cov runs but no codecov, no thresholds |
| CI/CD Automation | 5.5/10 | 4 workflows but critical CI on private GitLab |
| Agent Rules | 0.0/10 | No AI agent guidance whatsoever |

## Critical Gaps

### 1. Split CI Infrastructure (Severity: HIGH)
- **Problem**: The `trigger_ci.yml` workflow mirrors the repo to a private NVIDIA GitLab instance and triggers CI there. C++ compilation, linking, integration tests, and E2E tests against Triton server all happen on this inaccessible infrastructure.
- **Impact**: External contributors cannot see build results, test outcomes, or coverage for C++ changes. The GitHub-visible CI only covers Python linting and unit tests.
- **Effort**: 40+ hours (requires reproducing GitLab CI steps in GitHub Actions with CUDA and Triton dependencies)

### 2. No Container Image Build or Testing (Severity: HIGH)
- **Problem**: No Dockerfile or Containerfile exists in the repository. The perf_analyzer binary is built and packaged externally.
- **Impact**: No validation that the binary works correctly in its deployment container; no vulnerability scanning of the runtime environment.
- **Effort**: 16-24 hours to create Dockerfile + CI workflow + runtime validation

### 3. No Coverage Enforcement (Severity: HIGH)
- **Problem**: The `python-package-genai.yml` workflow generates `--cov-report=xml --cov-report=html` but never uploads results to codecov or any coverage service. No minimum coverage thresholds exist.
- **Impact**: Coverage regressions merge silently. There's no visibility into which areas of the codebase are under-tested.
- **Effort**: 2-4 hours to add codecov upload + threshold configuration

### 4. C++ Tests Not in GitHub CI (Severity: HIGH)
- **Problem**: 22 C++ test files exist in `src/` using doctest (primary) and Google Test (for mocking). These are compiled and run only on the private GitLab CI.
- **Impact**: C++ test regressions are invisible to the open-source community. Contributors must trust the private CI or build locally with complex CUDA dependencies.
- **Effort**: 8-16 hours to create a simplified GitHub Actions workflow for C++ unit tests

### 5. Minimal Integration Test Coverage (Severity: MEDIUM)
- **Problem**: Only 2 integration tests exist (`test_multiturn.py`, `test_telemetry.py`), both in the GenAI-Perf Python layer. No integration tests against a live Triton inference server.
- **Impact**: Complex multi-component interactions (GenAI-Perf -> perf_analyzer -> Triton server) are not validated in any public CI.
- **Effort**: 24-40 hours to build integration test infrastructure

## Quick Wins

### 1. Add Codecov Integration (1-2 hours)
Add codecov upload to `python-package-genai.yml`:
```yaml
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v4
      with:
        files: genai-perf/tests/coverage.xml
        flags: genai-perf
        fail_ci_if_error: true
      env:
        CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}
```

### 2. Add Coverage Threshold (1 hour)
Add to `pyproject.toml` or `pytest.ini`:
```ini
[tool:pytest]
addopts = --cov-fail-under=70
```

### 3. Create Basic CLAUDE.md (2-3 hours)
Create agent rules with project conventions, test patterns (pytest for Python, doctest for C++), and contribution guidelines.

### 4. Add Trivy Dependency Scanning (1-2 hours)
```yaml
name: Security Scan
on: [pull_request]
jobs:
  trivy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        severity: 'CRITICAL,HIGH'
```

### 5. Upgrade CodeQL Actions (30 minutes)
Update from `github/codeql-action/init@v2` to `@v3` and add C++ language scanning to the matrix.

## Detailed Findings

### CI/CD Pipeline

**Workflows (4 total)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `codeql.yml` | PR | CodeQL SAST for Python (v2 actions, outdated) |
| `pre-commit.yml` | PR | Runs pre-commit hooks on changed files |
| `python-package-genai.yml` | PR | Installs GenAI-Perf, runs pytest with coverage |
| `trigger_ci.yml` | PR (paths-ignore README, .github) | Mirrors repo to GitLab + triggers private CI pipeline |

**Observations**:
- No concurrency control on any workflow (parallel PR runs waste resources)
- No caching (pip, CMake build artifacts)
- Single Python version tested (3.10 only, despite 3.12 being listed in classifiers)
- No scheduled/periodic test runs
- `trigger_ci.yml` runs on self-hosted runners with secrets (GITLAB token, pipeline URL)
- The mirror script handles GitLab-GitHub synchronization for the split CI model

### Test Coverage

**Python (GenAI-Perf)**:
- **Framework**: pytest with pytest-cov, pytest-mock, pytest-timeout
- **Test files**: 65 files across 8 directories
- **Test functions**: 449
- **Integration tests**: 2 (multiturn, telemetry)
- **Coverage generation**: XML + HTML reports via pytest-cov
- **Coverage upload**: None (no codecov/coveralls)
- **Coverage thresholds**: None
- **Test-to-code ratio**: 65 test files / ~600 source files = ~0.11 (low)

**C++ (perf_analyzer core)**:
- **Framework**: doctest (primary), Google Test + Google Mock (for mocking)
- **Test files**: 22 test files + 12 mock files
- **Test assertions**: 1,484+ (CHECK, CHECK_EQ, EXPECT_, ASSERT_)
- **Key tested modules**: command_line_parser (279 assertions), data_loader (249), request_rate_manager (174), inference_profiler (157), perf_utils (117)
- **CI execution**: Only on private GitLab
- **Coverage**: Unknown (not tracked in public CI)

### Code Quality

**Pre-commit Hooks** (Excellent - 10+ hooks):
- `isort` - Python import sorting
- `black` - Python code formatting
- `flake8` - Python linting
- `clang-format` (v18.1.3) - C/C++/CUDA/proto formatting
- `codespell` - Spell checking
- `mypy` (v1.9.0) - Python type checking
- `pre-commit-hooks` - Case conflict, merge conflict, YAML/JSON/TOML validation, trailing whitespace, line endings
- Custom `add-license` hook - Automated copyright headers

**Clang Format**: Google-based style with custom IndentWidth(2), ColumnLimit(80), and brace wrapping rules.

**Ruff**: Configured in genai-perf `pyproject.toml` with line-length=88 (Black compatible) but minimal rule configuration.

**Static Analysis**:
- CodeQL for Python (PR-triggered, but using outdated v2 actions)
- No CodeQL for C++ (despite being the primary compiled language)
- No gosec, Semgrep, or Bandit
- No dependency scanning (Dependabot, Trivy)
- No secret detection (Gitleaks, TruffleHog)

### Container Images

- **No Dockerfile/Containerfile** in the repository
- The perf_analyzer binary is built as part of the larger Triton Inference Server build system
- Image testing, vulnerability scanning, and SBOM generation are entirely external
- No `.dockerignore` file
- The devcontainer configuration (`gitlab-master.nvidia.com:5005/dl/dgx/tritonserver:master-py3-base`) references an internal NVIDIA registry

### Security

- **SECURITY.md**: Present with vulnerability reporting guidance
- **CodeQL**: Enabled for Python with `security-and-quality` queries, but using outdated v2 actions
- **No C++ CodeQL scanning**: The matrix only includes Python despite C++ being a major component
- **No dependency scanning**: No Dependabot, Trivy, or Snyk configuration
- **No secret detection**: No Gitleaks or TruffleHog hooks/workflows
- **No container scanning**: No image exists in the repo to scan
- **DevContainer**: Uses internal NVIDIA image (not public), which limits external contributor setup

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No test type rules
- **Quality**: N/A
- **Gaps**: No CLAUDE.md, no AGENTS.md, no `.claude/` directory, no `.claude/rules/`, no test automation guidance for AI agents
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - Python pytest patterns for GenAI-Perf
  - C++ doctest/gtest patterns for perf_analyzer core
  - Mock creation patterns (12 mock files provide good examples)
  - Integration test patterns
  - Pre-commit compliance requirements

## Recommendations

### Priority 0 (Critical)

1. **Add codecov integration with PR coverage reporting and threshold enforcement**
   - Upload pytest-cov XML to codecov
   - Set minimum threshold (suggest 70% to start)
   - Enable PR annotations for coverage changes

2. **Create GitHub CI workflow for C++ unit tests**
   - Even a subset running on Ubuntu without CUDA would catch many regressions
   - Focus on doctest-based tests that don't require Triton server
   - Use CMake with `TRITON_ENABLE_GPU=OFF` for CPU-only testing

3. **Add container image build and runtime validation**
   - Create a Dockerfile for the perf_analyzer binary
   - Add basic startup/smoke tests
   - Integrate Trivy scanning for the image

### Priority 1 (High Value)

4. **Expand integration test coverage**
   - Add integration tests for more GenAI-Perf workflows (profile, compare, analyze)
   - Test multiple output formats (JSON, CSV, console)
   - Add tests for multi-model benchmarking scenarios

5. **Add dependency vulnerability scanning**
   - Enable Dependabot for Python and C++ dependencies
   - Add Trivy filesystem scanning to CI
   - Review and pin transitive dependencies

6. **Create CLAUDE.md and agent rules**
   - Document test patterns for both Python and C++ components
   - Include pre-commit compliance requirements
   - Add code review guidelines

7. **Upgrade CodeQL to v3 and add C++ scanning**
   - Update all `github/codeql-action/*@v2` to `@v3`
   - Add `cpp` to the language matrix
   - Enable advanced queries for C++ security analysis

### Priority 2 (Nice-to-Have)

8. **Add performance regression testing**
   - Track GenAI-Perf benchmark results over time
   - Alert on significant performance regressions
   - Integrate with CI for automated performance gates

9. **Implement contract tests**
   - Test the interface between GenAI-Perf Python and perf_analyzer C++ binary
   - Validate CLI argument compatibility
   - Test output format contracts

10. **Add workflow concurrency control and caching**
    - Add `concurrency` groups to all workflows
    - Cache pip installations
    - Add matrix for Python 3.10 + 3.12

11. **Set up Dependabot for automated updates**
    - Python dependencies (pyproject.toml)
    - GitHub Actions versions
    - Pre-commit hook versions

## Comparison to Gold Standards

| Dimension | perf_analyzer | odh-dashboard | notebooks | kserve |
|-----------|--------------|---------------|-----------|--------|
| Unit Tests | 7.5 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 3.5 | 9.0 | 8.0 | 9.0 |
| Build Integration | 3.0 | 8.0 | 7.0 | 8.0 |
| Image Testing | 1.0 | 7.0 | 10.0 | 7.0 |
| Coverage Tracking | 5.0 | 9.0 | 6.0 | 9.0 |
| CI/CD Automation | 5.5 | 9.0 | 8.0 | 9.0 |
| Agent Rules | 0.0 | 8.0 | 3.0 | 2.0 |
| **Overall** | **5.9** | **8.7** | **7.5** | **8.1** |

**Key Takeaways**:
- The split CI model (GitHub + private GitLab) is the single biggest quality risk, making the project appear far less tested than it likely is internally
- Pre-commit hooks are a genuine strength - comprehensive and well-configured
- The Python test suite is solid but lacks coverage enforcement
- The C++ test infrastructure exists but is invisible to the open-source community
- No container or image testing of any kind in the public repository

## File Paths Reference

| File | Purpose |
|------|---------|
| `.github/workflows/codeql.yml` | CodeQL SAST scanning (Python only, v2) |
| `.github/workflows/pre-commit.yml` | Pre-commit hook enforcement on PRs |
| `.github/workflows/python-package-genai.yml` | GenAI-Perf pytest with coverage |
| `.github/workflows/trigger_ci.yml` | GitLab mirror + private CI trigger |
| `.pre-commit-config.yaml` | 10+ hooks (isort, black, flake8, mypy, clang-format, codespell) |
| `CMakeLists.txt` | Root CMake build with ExternalProject for Triton client |
| `src/CMakeLists.txt` | C++ build with doctest/gtest integration |
| `src/test_*.cc` | 22 C++ test files using doctest |
| `src/mock_*.h` | 12 C++ mock files using Google Mock |
| `genai-perf/pyproject.toml` | GenAI-Perf package config with ruff/codespell |
| `genai-perf/pytest.ini` | Pytest configuration |
| `genai-perf/tests/` | 65 Python test files (449 test functions) |
| `genai-perf/tests/integration_tests/` | 2 integration test files |
| `.clang-format` | Google-based C++ formatting rules |
| `.devcontainer/devcontainer.json` | DevContainer with internal NVIDIA image |
| `SECURITY.md` | Vulnerability reporting policy |
| `pyproject.toml` | Root package config for perf-analyzer pip package |
