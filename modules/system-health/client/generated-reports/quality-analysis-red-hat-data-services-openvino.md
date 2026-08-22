---
repository: "red-hat-data-services/openvino"
overall_score: 6.9
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Exceptional test volume with GTest (C++) and pytest (Python); strong test-to-code ratio (~1:1)"
  - dimension: "Integration/E2E"
    score: 7.5
    status: "Comprehensive model hub, layer, functional, and stress tests; no explicit e2e/ directory but excellent multi-framework coverage"
  - dimension: "Build Integration"
    score: 5.0
    status: "PR builds on Linux/Windows but no Konflux simulation, no image build/validation at PR time"
  - dimension: "Image Testing"
    score: 2.0
    status: "No Dockerfiles, no container image builds, no runtime validation; CI uses pre-built containers"
  - dimension: "Coverage Tracking"
    score: 5.0
    status: "Codecov action present but coverage workflow is manual dispatch only; no threshold enforcement on PRs"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "37 workflows with Smart CI, concurrency control, sccache, cross-platform PR triggers, parallel test execution"
  - dimension: "Static Analysis"
    score: 7.5
    status: "Clang-format, ShellCheck, naming convention checks, flake8/mypy, Dependabot, Coverity; missing pre-commit hooks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory; no AI agent test guidance"
critical_gaps:
  - title: "No container image build or testing"
    impact: "As a downstream fork for RHOAI Model Runtimes, container images are central to delivery — no Dockerfile exists in the repo and no image validation occurs"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "Coverage workflow is manual dispatch only"
    impact: "Code coverage is never enforced on PRs; regressions in coverage are invisible until manually triggered"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No coverage threshold enforcement"
    impact: "Even when coverage runs, there are no minimum thresholds — coverage can decline without blocking merges"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No AI agent rules for test creation"
    impact: "AI-assisted test generation has no framework-specific guidance, producing inconsistent or low-quality tests"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add coverage threshold to codecov config"
    effort: "2-3 hours"
    impact: "Prevent coverage regressions on PRs by adding .codecov.yml with patch and project thresholds"
  - title: "Enable coverage on PR triggers"
    effort: "4-6 hours"
    impact: "Move coverage from manual-only to PR-triggered, catching coverage drops before merge"
  - title: "Create CLAUDE.md with test creation rules"
    effort: "3-4 hours"
    impact: "Enable AI agents to generate tests following GTest/pytest patterns already established in the repo"
  - title: "Add .pre-commit-config.yaml"
    effort: "1-2 hours"
    impact: "Enforce clang-format, flake8, and ShellCheck locally before push, catching style issues earlier"
recommendations:
  priority_0:
    - "Add Dockerfile(s) and container image build/test pipeline for RHOAI downstream delivery"
    - "Move coverage workflow from manual dispatch to PR-triggered with threshold enforcement"
  priority_1:
    - "Create .codecov.yml with project and patch coverage minimums"
    - "Add .pre-commit-config.yaml integrating clang-format, flake8, mypy, and ShellCheck"
    - "Create comprehensive CLAUDE.md with GTest and pytest test creation guidelines"
  priority_2:
    - "Add macOS PR-triggered builds (currently scheduled only)"
    - "Implement FIPS compatibility checks for downstream RHOAI builds"
    - "Add container health check and readiness probe validation"
---

# Quality Analysis: red-hat-data-services/openvino

**Repository**: [red-hat-data-services/openvino](https://github.com/red-hat-data-services/openvino)
**Tier**: Downstream | **Jira Component**: Model Runtimes | **Jira Project**: RHOAIENG
**Primary Languages**: C++ (5,830 files), Python (2,693 files)
**Default Branch**: master
**Analysis Date**: 2026-07-20

## Executive Summary

**Overall Score: 6.9/10**

OpenVINO is a large, mature deep learning inference toolkit with strong unit testing practices and sophisticated CI/CD automation. The test-to-code ratio is approximately 1:1, with 2,925 C++ test files and 1,325 Python test files covering core inference, plugins, frontends, and bindings. CI/CD is impressive with 37 workflows, Smart CI for selective testing, and cross-platform builds (Linux, Windows, Android ARM64, RISC-V, WebAssembly).

However, as a downstream fork for RHOAI Model Runtimes, it has critical gaps: **no Dockerfiles or container image testing** exist in the repository, coverage is manual-dispatch only with no threshold enforcement, and there are no AI agent rules for test generation.

**Key Strengths**:
- Exceptional test volume: ~4,250 test files across C++ and Python
- Sophisticated Smart CI with component-aware selective testing
- Cross-platform CI: Linux, Windows, Android ARM64, Linux ARM64, RISC-V, WebAssembly
- Strong static analysis: clang-format, ShellCheck, naming convention checks, flake8/mypy
- Comprehensive Dependabot covering pip, github-actions ecosystems
- Coverity static analysis (daily schedule)
- Fuzz testing infrastructure

**Critical Gaps**:
- No container images or Dockerfiles in the repository
- Coverage is manual-dispatch only with no PR enforcement
- No AI agent rules (CLAUDE.md, .claude/)
- No pre-commit hooks

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.5/10 | 15% | 1.28 | Exceptional GTest + pytest coverage |
| Integration/E2E | 7.5/10 | 20% | 1.50 | Strong model hub, layer, functional, stress tests |
| Build Integration | 5.0/10 | 15% | 0.75 | PR builds exist but no Konflux/image validation |
| Image Testing | 2.0/10 | 10% | 0.20 | No Dockerfiles, no image builds or runtime testing |
| Coverage Tracking | 5.0/10 | 10% | 0.50 | Codecov exists but manual-only, no thresholds |
| CI/CD Automation | 9.0/10 | 15% | 1.35 | 37 workflows, Smart CI, concurrency, caching |
| Static Analysis | 7.5/10 | 10% | 0.75 | Clang-format, ShellCheck, flake8/mypy, Dependabot |
| Agent Rules | 0.0/10 | 5% | 0.00 | No CLAUDE.md or .claude/ directory |
| **Overall** | **6.9/10** | **100%** | **6.33** | |

## Critical Gaps

### 1. No Container Image Build or Testing (HIGH)
- **Impact**: As the RHOAI Model Runtimes downstream fork, container images are the primary delivery artifact. The repository contains no Dockerfiles, no Containerfiles, no `.dockerignore`, and no container build/test steps in CI.
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: CI workflows use pre-built Azure-hosted container images (`openvinogithubactions.azurecr.io/dockerhub/ubuntu:*`) as build environments, but OpenVINO itself is never packaged into a container image within this repository. Image builds, runtime validation, health checks, and multi-arch support are all absent.

### 2. Coverage Workflow Is Manual Dispatch Only (HIGH)
- **Impact**: The `coverage.yml` workflow triggers only on `workflow_dispatch`. Coverage data is collected using lcov/gcov and uploaded to Codecov, but this never runs automatically on PRs or merges. Coverage regressions are invisible.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The coverage workflow exists and is well-configured (lcov, gcov, Codecov upload), but the trigger `on: workflow_dispatch` means coverage is only collected when manually requested. No `.codecov.yml` configuration file exists to set thresholds.

### 3. No Coverage Threshold Enforcement (MEDIUM)
- **Impact**: Even when coverage runs, there are no minimum thresholds configured. Coverage can decline indefinitely without blocking merges.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours

### 4. No AI Agent Rules (MEDIUM)
- **Impact**: AI-assisted test generation has no project-specific guidance. With 1,189 GTest includes and 544 pytest-using files, the repo has well-established patterns that should be documented for agents.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours

## Quick Wins

### 1. Add .codecov.yml with Threshold Enforcement (2-3 hours)
Create a `.codecov.yml` configuration file:
```yaml
coverage:
  status:
    project:
      default:
        target: auto
        threshold: 1%
    patch:
      default:
        target: 80%
comment:
  layout: "reach, diff, flags, files"
  behavior: default
```

### 2. Enable Coverage on PR Triggers (4-6 hours)
Modify `coverage.yml` to add `pull_request` and `push` triggers alongside `workflow_dispatch`. Consider a lighter coverage build for PRs to manage CI time.

### 3. Create CLAUDE.md with Test Guidelines (3-4 hours)
Add `CLAUDE.md` at repository root with GTest and pytest patterns:
- C++ tests: GTest framework, naming conventions (`*_test.cpp`), test fixture patterns
- Python tests: pytest framework, conftest patterns, layer test structure
- Test parallelization: `run_parallel.py` usage for functional tests

### 4. Add .pre-commit-config.yaml (1-2 hours)
```yaml
repos:
  - repo: https://github.com/pre-commit/mirrors-clang-format
    rev: v9.0.0
    hooks:
      - id: clang-format
        files: \.(cpp|hpp|h|cc)$
  - repo: https://github.com/PyCQA/flake8
    rev: 6.0.0
    hooks:
      - id: flake8
  - repo: https://github.com/koalaman/shellcheck-precommit
    rev: v0.9.0
    hooks:
      - id: shellcheck
```

## Detailed Findings

### Unit Tests (8.5/10)

**Strengths**:
- **Volume**: 2,925 C++ test files, 1,325 Python test files
- **Test-to-code ratio**: ~1:1 for C++ (2,925 test vs 2,906 source), ~0.75:1 for Python (1,325 test vs 1,752 source)
- **GTest framework**: 1,189 files include GTest/GMock headers — well-established C++ testing patterns
- **pytest framework**: 544 files use pytest, 12 use unittest — consistent Python testing
- **Test isolation**: Separate test directories per component (`src/plugins/intel_cpu/tests/`, `src/core/tests/`, `src/frontends/tensorflow/tests/`, etc.)
- **Dedicated test workflows**: `job_cxx_unit_tests.yml`, `job_python_unit_tests.yml` as reusable workflow calls

**Areas for Improvement**:
- No explicit test coverage percentage tracked per component
- Test documentation could benefit from agent-readable rules

**Key Files**:
- `src/core/tests/` — Core inference engine unit tests
- `src/plugins/intel_cpu/tests/` — CPU plugin tests
- `src/bindings/python/tests/` — Python binding tests
- `tests/layer_tests/` — Multi-framework layer tests (PyTorch, TF, ONNX, JAX, TFLite)

### Integration/E2E Tests (7.5/10)

**Strengths**:
- **Model hub tests**: `tests/model_hub_tests/` with TF Hub, PyTorch, ONNX, and performance tests
- **Layer tests**: Comprehensive multi-framework coverage (PyTorch, TensorFlow, TensorFlow Lite, ONNX, JAX)
- **Functional tests**: `job_cpu_functional_tests.yml` with parallel execution via `run_parallel.py`
- **Stress tests**: `tests/stress_tests/` with memory leak detection, memcheck, and pipeline stress tests
- **Fuzz tests**: `tests/fuzz/` with dedicated fuzzing infrastructure
- **Sample tests**: `tests/samples_tests/` validating all code samples work correctly
- **ONNX Runtime integration**: `job_onnx_runtime.yml` tests ONNX RT compatibility

**Areas for Improvement**:
- No explicit `e2e/` or `integration/` directories — integration tests are distributed across specialized directories
- No multi-version Kubernetes/OpenShift testing (less relevant for this upstream toolkit)
- No Testcontainers or container-based integration testing

**Key Files**:
- `tests/model_hub_tests/` — Model compatibility tests
- `tests/layer_tests/` — Multi-framework layer tests with `conftest.py` and `pytest.ini`
- `tests/stress_tests/` — Memory and pipeline stress tests
- `tests/fuzz/` — Fuzz testing infrastructure
- `.github/workflows/job_cpu_functional_tests.yml` — Parallel functional tests

### Build Integration (5.0/10)

**Strengths**:
- **PR-triggered builds**: `linux.yml`, `windows.yml`, `fedora.yml`, `android_arm64.yml`, `linux_arm64.yml`, `linux_riscv.yml`, `webassembly.yml` all trigger on PRs
- **Smart CI**: Custom `.github/actions/smart-ci/` action with component-aware selective building — skips unnecessary builds when only docs change
- **Cross-platform**: Builds validated on Linux (Ubuntu 20.04), Windows (VS 2019), Fedora, Android ARM64, Linux ARM64, RISC-V, WebAssembly
- **Build caching**: sccache with Azure Blob Storage, ccache for coverage builds
- **Ninja generator**: Fast parallel builds with `CMAKE_GENERATOR: 'Ninja Multi-Config'`

**Areas for Improvement**:
- **No Konflux build simulation**: No downstream Konflux pipeline testing
- **No container image builds**: The build produces libraries and Python wheels, not container images
- **No operator manifest validation**: N/A for this project type, but relevant for RHOAI integration
- **macOS builds are scheduled-only**: `mac.yml` has `pull_request` trigger commented out

**Key Files**:
- `.github/workflows/linux.yml` — Main Linux build (26KB, most comprehensive)
- `.github/workflows/windows.yml` — Windows build (41KB)
- `.github/actions/smart-ci/` — Component-aware CI optimization
- `CMakeLists.txt` — Root build configuration

### Image Testing (2.0/10)

**Strengths**:
- CI workflows use containerized build environments (`openvinogithubactions.azurecr.io/dockerhub/ubuntu:*`) showing container familiarity
- Cross-platform build support demonstrates awareness of platform-specific concerns

**Areas for Improvement**:
- **No Dockerfiles**: The repository contains zero Dockerfiles or Containerfiles
- **No .dockerignore**: No container build optimization
- **No docker-compose files**: No container orchestration for testing
- **No image build in CI**: No container images are built as part of CI/CD
- **No runtime validation**: No Testcontainers, no image startup testing
- **No multi-arch image builds**: No `docker buildx` or `--platform` usage
- **No health checks**: No HEALTHCHECK instructions or K8s probe definitions

This is the most significant gap for a downstream RHOAI Model Runtimes component.

### Coverage Tracking (5.0/10)

**Strengths**:
- **Coverage workflow exists**: `coverage.yml` is well-configured with lcov/gcov for C++ and Codecov upload
- **ENABLE_COVERAGE CMake flag**: Coverage instrumentation is built into the CMake build system
- **Codecov action**: Uses `codecov/codecov-action@v4` for upload

**Areas for Improvement**:
- **Manual dispatch only**: `on: workflow_dispatch` — coverage never runs automatically
- **No .codecov.yml**: No configuration file for thresholds, flags, or comment behavior
- **No threshold enforcement**: No `fail_ci_if_error: true` in Codecov action
- **No PR coverage reporting**: PRs don't receive coverage comments or status checks
- **No Python coverage**: Coverage workflow focuses on C++ (lcov/gcov); Python coverage (pytest-cov) is not collected

### CI/CD Automation (9.0/10)

**Strengths**:
- **37 workflows**: Comprehensive CI covering builds, tests, code style, documentation, and more
- **Smart CI**: Custom action for component-aware selective testing — reduces CI time by skipping irrelevant jobs
- **Concurrency control**: 20 workflows use `concurrency:` with `cancel-in-progress: true`
- **Build caching**: sccache (Azure Blob), ccache, pip cache across 22 workflows
- **Timeout management**: 20 workflows specify `timeout-minutes`
- **Cross-platform**: Linux, Windows, macOS, Android ARM64, Linux ARM64, RISC-V, WebAssembly
- **Reusable workflows**: `job_*` workflows use `workflow_call` for modular test execution
- **Parallel test execution**: `run_parallel.py` for functional tests
- **OpenTelemetry**: `send_workflows_to_opentelemetry.yml` for CI observability
- **PR commit checks**: `check_pr_commits.yml` validates commit format
- **File size checks**: `files_size.yml` prevents large file additions
- **Stale management**: `stale_prs_and_issues.yml` for housekeeping
- **Labeler**: Automatic PR labeling based on changed files
- **Dependency review**: `dependency_review.yml` on PRs for supply chain awareness

**Areas for Improvement**:
- macOS builds are scheduled-only (PR trigger commented out)
- No explicit test matrix for multiple Python versions in most workflows
- Matrix strategy used in only 3 workflows

### Static Analysis (7.5/10)

**Strengths**:
- **Clang-format**: `.clang-format` configured (Google-based style, IndentWidth 4, ColumnLimit 120), enforced in `code_style.yml` PR check with reviewdog suggestions
- **ShellCheck**: Enforced in `code_style.yml` with `reviewdog/action-shellcheck`
- **Naming convention check**: Custom NCC tool with clang-14, enforced on PRs
- **Flake8**: Enforced for Python API, samples, tests, and wheel code in `py_checks.yml`
- **Mypy**: Type checking for Python API in `py_checks.yml`
- **Dependabot**: Comprehensive configuration covering pip (5 directories), github-actions — daily schedule with assignees
- **Coverity**: Daily scheduled static analysis (`coverity.yml`)
- **Dependency review**: `dependency_review.yml` runs on PRs
- **CSpell**: Spell checking configuration (`cspell.json`)

**Areas for Improvement**:
- **No pre-commit hooks**: `.pre-commit-config.yaml` is absent — checks only run in CI, not locally
- **No FIPS compatibility checks**: No FIPS build tags, no boringcrypto, no UBI base images (no containers at all)
- **No Renovate**: Only Dependabot (adequate, but Renovate offers more flexibility)

**Key Files**:
- `src/.clang-format` — C++ code style configuration
- `.github/workflows/code_style.yml` — PR code style enforcement
- `.github/workflows/py_checks.yml` — Python linting (flake8 + mypy)
- `.github/dependabot.yml` — Dependency update configuration
- `.github/workflows/coverity.yml` — Coverity static analysis
- `cspell.json` — Spell checking

### Agent Rules (0.0/10)

**Status**: Missing

- **No CLAUDE.md**: No root-level agent instructions
- **No AGENTS.md**: No agent configuration
- **No .claude/ directory**: No rules, skills, or agent configuration
- **No test creation guidance**: Despite having 4,250+ test files with well-established patterns (GTest, pytest, layer tests), none of this is documented for AI agents

**Recommendation**: Generate comprehensive agent rules using `/test-rules-generator` covering:
- GTest unit test patterns for C++ components
- pytest patterns for Python bindings and layer tests
- conftest.py fixture patterns
- Parallel test execution conventions
- Multi-framework layer test structure

## Recommendations

### Priority 0 (Critical)

1. **Add Dockerfiles and container image pipeline for RHOAI delivery**
   - Create Dockerfiles for OpenVINO runtime images using UBI base images
   - Add image build step to PR workflows
   - Implement container startup validation
   - Add multi-arch support (x86_64, ARM64)
   - Effort: 16-24 hours

2. **Move coverage from manual to PR-triggered with thresholds**
   - Change `coverage.yml` trigger from `workflow_dispatch` to include `pull_request`
   - Create `.codecov.yml` with project/patch thresholds
   - Add `fail_ci_if_error: true` to Codecov action
   - Consider a lighter coverage build for PRs (subset of tests)
   - Effort: 4-8 hours

### Priority 1 (High Value)

3. **Create .codecov.yml with coverage thresholds**
   - Set project target to `auto` with 1% threshold
   - Set patch target to 80%
   - Configure comment layout for PRs
   - Effort: 2-3 hours

4. **Add pre-commit hooks**
   - Configure clang-format, flake8, mypy, ShellCheck as pre-commit hooks
   - Catch style issues before CI, reducing feedback time
   - Effort: 1-2 hours

5. **Create CLAUDE.md with test creation rules**
   - Document GTest patterns for C++ unit tests
   - Document pytest patterns for Python tests
   - Include layer test structure for multi-framework tests
   - Add conftest.py fixture patterns
   - Effort: 3-4 hours

### Priority 2 (Nice-to-Have)

6. **Enable macOS PR-triggered builds**
   - Uncomment `pull_request` trigger in `mac.yml`
   - Currently scheduled-only, meaning macOS build breaks aren't caught until after merge
   - Effort: 1-2 hours

7. **Add Python coverage collection**
   - Add pytest-cov to Python test workflows
   - Upload Python coverage alongside C++ coverage
   - Effort: 4-6 hours

8. **Implement FIPS compatibility for downstream**
   - Add FIPS build tags for Go components (if any)
   - Use UBI base images in Dockerfiles
   - Add FIPS compatibility CI checks
   - Effort: 8-16 hours

## Comparison to Gold Standards

| Capability | openvino | odh-dashboard | notebooks | kserve |
|-----------|----------|---------------|-----------|--------|
| Unit Tests | GTest + pytest (1:1 ratio) | Jest + React Testing Library | pytest | Go testing + envtest |
| Integration/E2E | Model hub + layer + stress + fuzz | Cypress E2E + contract tests | Image validation | Ginkgo E2E |
| Build Integration | PR builds (Linux/Windows) | PR Docker builds | PR image builds | PR operator builds |
| Image Testing | None | Docker build + test | 5-layer validation | Image build + deploy |
| Coverage Tracking | Codecov (manual only) | Codecov with thresholds | Limited | Codecov enforced |
| CI/CD Automation | 37 workflows, Smart CI | Comprehensive | Multi-arch CI | Matrix testing |
| Static Analysis | Clang-format, flake8, mypy, Coverity | ESLint, Prettier | Basic linting | golangci-lint |
| Agent Rules | None | Comprehensive CLAUDE.md | Basic | Limited |
| Pre-commit Hooks | None | Yes | Limited | Yes |
| Dependency Alerts | Dependabot (pip, actions) | Dependabot | Limited | Dependabot |

## File Paths Reference

### CI/CD
- `.github/workflows/linux.yml` — Main Linux build workflow (PR + schedule)
- `.github/workflows/windows.yml` — Windows build workflow (PR)
- `.github/workflows/coverage.yml` — Coverage workflow (manual dispatch)
- `.github/workflows/code_style.yml` — Code style enforcement (PR)
- `.github/workflows/py_checks.yml` — Python linting (PR)
- `.github/workflows/coverity.yml` — Coverity static analysis (daily)
- `.github/workflows/dependency_review.yml` — Dependency review (PR)
- `.github/actions/smart-ci/` — Smart CI action for selective testing

### Testing
- `src/core/tests/` — Core inference engine unit tests
- `src/plugins/intel_cpu/tests/` — CPU plugin tests
- `src/bindings/python/tests/` — Python binding tests
- `tests/layer_tests/` — Multi-framework layer tests
- `tests/model_hub_tests/` — Model compatibility tests
- `tests/stress_tests/` — Stress and memory tests
- `tests/fuzz/` — Fuzz testing

### Static Analysis
- `src/.clang-format` — C++ formatting rules
- `.github/dependabot.yml` — Dependabot configuration
- `cspell.json` — Spell checking

### Build
- `CMakeLists.txt` — Root CMake configuration
- `Jenkinsfile` — Jenkins pipeline (legacy)
- `install_build_dependencies.sh` — Build dependency installer
