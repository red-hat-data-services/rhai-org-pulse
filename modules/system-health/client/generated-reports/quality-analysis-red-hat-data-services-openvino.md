---
repository: "red-hat-data-services/openvino"
overall_score: 6.4
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "1,600+ test files with GoogleTest (C++) and pytest (Python), strong test-to-code ratio (~0.5)"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Comprehensive layer tests, model hub tests, ONNX runtime integration, fuzz testing"
  - dimension: "Build Integration"
    score: 5.0
    status: "Multi-platform PR builds but no container/Konflux simulation"
  - dimension: "Image Testing"
    score: 2.0
    status: "No Dockerfiles, no container image testing, no vulnerability scanning"
  - dimension: "Coverage Tracking"
    score: 5.0
    status: "CMake coverage infrastructure with Codecov but manual-dispatch only"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "37 workflows, Smart CI, multi-platform, sccache, OpenTelemetry observability"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no test automation guidance for AI agents"
critical_gaps:
  - title: "No container image testing or Dockerfiles"
    impact: "Red Hat downstream packaging relies on container images — no validation at source"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No security scanning (CodeQL, Trivy, Snyk, Gitleaks)"
    impact: "Vulnerabilities in dependencies and source code not detected until downstream"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "Coverage workflow is manual-dispatch only"
    impact: "Coverage regressions not caught on PRs; no enforcement thresholds"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No pre-commit hooks"
    impact: "Code quality issues caught only in CI, not locally"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "macOS PR testing disabled"
    impact: "macOS platform regressions not caught until nightly schedule"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add CodeQL SAST workflow for C++ and Python"
    effort: "2-3 hours"
    impact: "Automated security vulnerability detection on every PR"
  - title: "Enable Codecov PR comments by adding .codecov.yml"
    effort: "1-2 hours"
    impact: "Immediate visibility into coverage changes per PR"
  - title: "Add .pre-commit-config.yaml with clang-format, flake8, shellcheck"
    effort: "2-3 hours"
    impact: "Shift-left code quality checks to developer machines"
  - title: "Create CLAUDE.md with test patterns and conventions"
    effort: "2-3 hours"
    impact: "Improve AI-assisted test generation quality and consistency"
recommendations:
  priority_0:
    - "Add CodeQL/SAST workflow to detect security vulnerabilities on PRs"
    - "Move coverage from manual-dispatch to PR-triggered with enforcement thresholds"
    - "Add Trivy or Snyk dependency scanning to PR workflow"
  priority_1:
    - "Add Gitleaks secret detection to prevent credential leaks"
    - "Re-enable macOS PR testing to catch platform regressions early"
    - "Add .codecov.yml with PR coverage comments and delta thresholds"
    - "Create .pre-commit-config.yaml to enforce quality locally"
  priority_2:
    - "Add CLAUDE.md with test patterns for AI-assisted development"
    - "Add Dockerfile for reproducible local development"
    - "Add SBOM generation for supply chain security"
    - "Consider adding Coverity results as PR gate (not just nightly)"
---

# Quality Analysis: red-hat-data-services/openvino

## Executive Summary

- **Overall Score: 6.4/10**
- **Repository Type**: Deep learning inference framework (C++/Python)
- **Primary Languages**: C++ (~5,800 source files, ~3,600 headers), Python (~2,700 files)
- **Build System**: CMake with Ninja Multi-Config
- **Framework**: OpenVINO inference toolkit (Red Hat fork of openvinotoolkit/openvino)

### Key Strengths
- **Exceptional test coverage**: 1,600+ test files across unit, integration, functional, model hub, fuzz, stress, and memory testing
- **Sophisticated CI/CD**: 37 GitHub Actions workflows with Smart CI for selective testing, multi-platform builds (Linux, Windows, Android, WebAssembly, RISC-V), sccache caching, and OpenTelemetry observability
- **Strong code quality tooling**: clang-format, ShellCheck, naming convention checks, flake8, mypy, ESLint, Coverity static analysis, dependency review

### Critical Gaps
- **No container image testing**: Zero Dockerfiles in the repository; no image builds, scanning, or runtime validation
- **No security scanning on PRs**: No CodeQL, Trivy, Snyk, or Gitleaks; Coverity runs nightly only
- **Coverage not enforced on PRs**: Coverage workflow is manual-dispatch only with no thresholds
- **No AI agent rules**: No CLAUDE.md, .claude/ directory, or test automation guidance

### Agent Rules Status: **Missing**

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8/10 | 1,600+ test files, GoogleTest + pytest, ~0.5 test-to-code ratio |
| Integration/E2E | 8/10 | Layer tests, model hub tests, ONNX RT integration, fuzz testing |
| **Build Integration** | **5/10** | **Multi-platform PR builds but no container/Konflux simulation** |
| **Image Testing** | **2/10** | **No Dockerfiles, no container scanning, no SBOM** |
| Coverage Tracking | 5/10 | CMake lcov infrastructure + Codecov but manual-only |
| CI/CD Automation | 8/10 | 37 workflows, Smart CI, multi-platform, sccache, OTel |
| **Agent Rules** | **0/10** | **No .claude/ directory, no CLAUDE.md, no test rules** |

## Critical Gaps

### 1. No Container Image Testing or Dockerfiles
- **Impact**: Red Hat downstream packaging relies on container images; no validation at source level
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: The repository contains zero Dockerfiles or Containerfiles. While OpenVINO is primarily a native C++ library, Red Hat Data Services likely packages it in containers. Without source-level container testing, image build failures and runtime issues are only discovered downstream.

### 2. No Security Scanning on PRs
- **Impact**: Security vulnerabilities in C++ source and Python dependencies not caught until downstream or nightly Coverity
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: 
  - No CodeQL/SAST workflow for C++ or Python
  - No Trivy or Snyk dependency/container scanning
  - No Gitleaks secret detection
  - Coverity runs on a daily schedule, not gated on PRs
  - Dependency review exists but only checks license compliance, not CVEs

### 3. Coverage Workflow is Manual-Dispatch Only
- **Impact**: Coverage regressions go unnoticed on PRs; no enforcement of minimum thresholds
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The `coverage.yml` workflow runs only on `workflow_dispatch`. While the CMake infrastructure supports lcov-based coverage and Codecov upload, this never runs automatically on PRs. There are no `.codecov.yml` configuration, no coverage thresholds, and no PR comments showing coverage deltas.

### 4. No Pre-commit Hooks
- **Impact**: Code quality issues (formatting, linting) caught only in CI, adding feedback latency
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: No `.pre-commit-config.yaml` exists. Developers must wait for CI to catch clang-format, flake8, or ShellCheck violations instead of getting immediate local feedback.

### 5. macOS PR Testing Disabled
- **Impact**: macOS-specific regressions not caught until nightly schedule
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: Both `mac.yml` and `mac_arm64.yml` have `pull_request` and `push` triggers commented out. macOS builds run only on schedule (nightly/workdays). Platform-specific issues can go undetected for 24+ hours.

## Quick Wins

### 1. Add CodeQL SAST Workflow (2-3 hours)
- **Impact**: Automated security vulnerability detection on every PR
- **Implementation**:
```yaml
# .github/workflows/codeql.yml
name: "CodeQL"
on:
  push:
    branches: [master]
  pull_request:
    branches: [master]
  schedule:
    - cron: '0 6 * * 1'

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    strategy:
      matrix:
        language: ['cpp', 'python']
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: 'true'
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
      - if: matrix.language == 'cpp'
        run: |
          bash install_build_dependencies.sh
          cmake -B build -DENABLE_TESTS=OFF
          cmake --build build --parallel $(nproc)
      - uses: github/codeql-action/analyze@v3
```

### 2. Enable Codecov PR Comments (1-2 hours)
- **Impact**: Immediate visibility into coverage changes per PR
- **Implementation**:
```yaml
# .codecov.yml
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
  require_changes: true
```

### 3. Add Pre-commit Configuration (2-3 hours)
- **Impact**: Shift-left code quality checks to developer machines
- **Implementation**:
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-merge-conflict
  - repo: https://github.com/pre-commit/mirrors-clang-format
    rev: v14.0.0
    hooks:
      - id: clang-format
        types_or: [c, c++]
  - repo: https://github.com/pycqa/flake8
    rev: 7.0.0
    hooks:
      - id: flake8
  - repo: https://github.com/koalaman/shellcheck-precommit
    rev: v0.9.0
    hooks:
      - id: shellcheck
```

### 4. Create Basic CLAUDE.md (2-3 hours)
- **Impact**: Improve AI-assisted test generation quality and consistency
- **Implementation**: Document GoogleTest patterns, pytest conventions, CMake test targets, and test file naming conventions.

## Detailed Findings

### CI/CD Pipeline

**37 GitHub Actions workflows** organized into:

| Category | Workflows | Trigger |
|----------|-----------|---------|
| **Platform builds** | `linux.yml`, `windows.yml`, `fedora.yml`, `android_arm64.yml`, `linux_arm64.yml`, `webassembly.yml`, `linux_riscv.yml` | PR + push |
| **Platform builds (scheduled)** | `mac.yml`, `mac_arm64.yml` | Schedule only |
| **Conditional compilation** | `linux_conditional_compilation.yml`, `windows_conditional_compilation.yml` | PR + push |
| **Test jobs (reusable)** | `job_cxx_unit_tests.yml`, `job_python_unit_tests.yml`, `job_cpu_functional_tests.yml`, `job_samples_tests.yml`, `job_onnx_models_tests.yml`, `job_pytorch_models_tests.yml`, `job_tensorflow_hub_models_tests.yml`, `job_onnx_runtime.yml`, `job_openvino_js.yml` | workflow_call |
| **Code quality** | `code_style.yml`, `py_checks.yml`, `check_pr_commits.yml`, `code_snippets.yml`, `files_size.yml` | PR |
| **Security** | `dependency_review.yml`, `coverity.yml` | PR / schedule |
| **Coverage** | `coverage.yml` | Manual dispatch |
| **Misc** | `labeler.yml`, `stale_prs_and_issues.yml`, `cleanup_pip_cache.yml`, `assign_issue.yml`, `build_doc.yml`, `send_workflows_to_opentelemetry.yml` | Various |

**Notable CI Features**:
- **Smart CI**: Custom GitHub Action (`smart-ci`) that analyzes PR changes to determine affected components and skip unnecessary builds. Reduces CI time by running only relevant test suites.
- **Merge group support**: Most platform workflows support GitHub merge queues
- **Concurrency control**: All workflows use `concurrency` with `cancel-in-progress: true`
- **Build caching**: sccache with Azure blob storage, ccache for coverage builds
- **OpenTelemetry**: Workflow metrics exported to Honeycomb for CI observability
- **Self-hosted runners**: Uses `aks-linux-16-cores-32gb` runners for heavy builds

### Test Coverage

**Test File Counts**:
- C++ test files: 2,919
- Python test files: 1,034
- Total: ~1,600+ unique test files (some overlap in counting methods)

**Test-to-Code Ratios**:
- C++ tests : C++ source = 2,919 : 5,711 = **0.51**
- Python tests : Python source = 1,034 : 1,748 = **0.59**

**Test Categories**:

| Category | Location | Framework | Description |
|----------|----------|-----------|-------------|
| C++ Unit Tests | `src/*/tests/` | GoogleTest | Core, plugins, frontends |
| Python Unit Tests | `src/bindings/python/tests/` | pytest | Python API bindings |
| CPU Functional Tests | via workflow | GoogleTest | Plugin functional tests |
| Layer Tests | `tests/layer_tests/` | pytest | TF, PyTorch, ONNX, JAX, TF Lite, Paddle |
| Model Hub Tests | `tests/model_hub_tests/` | pytest | TorchVision, Timm, HuggingFace, GFPGAN |
| ONNX Model Tests | via workflow | GoogleTest | ONNX model zoo validation |
| Sample Smoke Tests | `tests/samples_tests/` | pytest | Sample app validation |
| Fuzz Testing | `tests/fuzz/` | libFuzzer | 4 fuzzers (model loading, ONNX, Paddle) |
| Memory Tests | `tests/memory_tests/` | Custom | Memory leak detection |
| Stress Tests | `tests/stress_tests/` | Custom | Load testing |
| Time Tests | `tests/time_tests/` | Custom | Performance benchmarking |
| Conditional Compilation | `tests/conditional_compilation/` | pytest | Build configuration tests |

### Code Quality

| Tool | Scope | Enforcement |
|------|-------|-------------|
| clang-format-9 | C/C++ formatting | PR (with reviewdog suggestions) |
| ShellCheck | Shell scripts | PR (with reviewdog) |
| Naming Convention Check (NCC) | C++ naming | PR |
| flake8 | Python style | PR |
| black | Python formatting | PR (diff generation) |
| mypy | Python type checking | PR |
| ESLint | JavaScript bindings | Config present |
| Coverity | C++ static analysis | Daily schedule |
| Dependency Review | License/CVE | PR |
| cspell | Spelling | Config present |
| PR Commit Check | Commit message format | PR |

### Container Images

**Status: No container infrastructure**
- Zero Dockerfiles or Containerfiles in the repository
- No container build workflows
- No image scanning or vulnerability detection
- No SBOM generation
- No multi-architecture image builds

This is the most significant gap from a Red Hat perspective. While OpenVINO is primarily a native C++ library distributed as packages, Red Hat downstream packaging likely involves container images.

### Security

| Practice | Status | Details |
|----------|--------|---------|
| CodeQL/SAST | Missing | No automated source code analysis on PRs |
| Coverity | Present (nightly) | Daily scheduled scans, not PR-gated |
| Dependency Review | Present (PR) | License and vulnerability checks |
| Trivy/Snyk | Missing | No container or dependency scanning |
| Gitleaks | Missing | No secret detection |
| SBOM | Missing | No software bill of materials |
| SECURITY.md | Present | Security policy documented |
| Image Signing | Missing | No image attestation |

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No test type rules exist
- **Quality**: N/A
- **Gaps**: 
  - No `CLAUDE.md` or `AGENTS.md` in repository root
  - No `.claude/` directory
  - No `.claude/rules/` for test creation patterns
  - No `.claude/skills/` for custom automation
- **Recommendation**: Generate rules with `/test-rules-generator` covering:
  - GoogleTest C++ unit test patterns
  - pytest Python test conventions
  - Layer test creation patterns
  - CMake test target conventions
  - Model hub test templates

## Recommendations

### Priority 0 (Critical)

1. **Add CodeQL SAST to PR workflow** — Detect security vulnerabilities in C++ and Python code on every PR. Critical for a library that processes untrusted model files.

2. **Move coverage to PR-triggered with enforcement** — Change `coverage.yml` from `workflow_dispatch` to `pull_request` trigger, add `.codecov.yml` with thresholds (e.g., 80% patch coverage).

3. **Add dependency scanning with Trivy** — Scan Python dependencies and build inputs for known CVEs on every PR. Quick to add alongside existing dependency review.

### Priority 1 (High Value)

4. **Add Gitleaks secret detection** — Prevent accidental credential commits (API tokens, Azure connection strings are referenced in workflows).

5. **Re-enable macOS PR testing** — Uncomment `pull_request` triggers in `mac.yml` and `mac_arm64.yml` to catch platform regressions before merge.

6. **Add .codecov.yml for PR coverage reporting** — Configure coverage delta thresholds and PR comments for coverage visibility.

7. **Add .pre-commit-config.yaml** — Bundle clang-format, flake8, ShellCheck, and basic file checks for local developer feedback.

### Priority 2 (Nice-to-Have)

8. **Create CLAUDE.md with test patterns** — Document test conventions for AI-assisted development (GoogleTest patterns, pytest fixtures, CMake targets).

9. **Add Dockerfile for reproducible development** — Containerize the build environment for consistent contributor experience.

10. **Add SBOM generation** — Generate software bill of materials for supply chain security compliance.

11. **Gate Coverity on PRs** — Consider running a lightweight Coverity scan on PRs instead of nightly-only.

12. **Add image signing/attestation** — If container images are built downstream, add signing for supply chain integrity.

## Comparison to Gold Standards

| Dimension | openvino | odh-dashboard | notebooks | kserve |
|-----------|----------|---------------|-----------|--------|
| Unit Tests | 8/10 | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 8/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 5/10 | 8/10 | 7/10 | 8/10 |
| Image Testing | 2/10 | 7/10 | 10/10 | 7/10 |
| Coverage Tracking | 5/10 | 9/10 | 5/10 | 9/10 |
| CI/CD Automation | 8/10 | 9/10 | 8/10 | 8/10 |
| Security Scanning | 4/10 | 7/10 | 6/10 | 8/10 |
| Agent Rules | 0/10 | 8/10 | 3/10 | 2/10 |
| **Overall** | **6.4** | **8.5** | **7.0** | **8.0** |

### Key Differences from Gold Standards

- **vs. odh-dashboard**: Missing coverage enforcement, no contract tests, no agent rules, no container testing
- **vs. notebooks**: Missing container image testing (notebooks excels with 5-layer validation), no vulnerability scanning
- **vs. kserve**: Missing coverage enforcement thresholds, no CodeQL, no container scanning

## File Paths Reference

### CI/CD
- `.github/workflows/linux.yml` — Primary Linux CI (PR + schedule)
- `.github/workflows/windows.yml` — Windows CI (PR + push)
- `.github/workflows/code_style.yml` — clang-format, ShellCheck, NCC
- `.github/workflows/py_checks.yml` — Python flake8, mypy, black
- `.github/workflows/coverage.yml` — Coverage generation (manual only)
- `.github/workflows/coverity.yml` — Coverity static analysis (daily)
- `.github/workflows/dependency_review.yml` — Dependency scanning (PR)
- `.github/actions/smart-ci/` — Smart CI component detection

### Testing
- `tests/` — Top-level test directory
- `tests/layer_tests/` — Layer tests for all frontends
- `tests/model_hub_tests/` — Model hub integration tests
- `tests/fuzz/` — Fuzz testing (4 fuzzers)
- `tests/stress_tests/` — Stress/load tests
- `tests/memory_tests/` — Memory leak tests
- `tests/samples_tests/` — Sample smoke tests
- `src/core/tests/` — Core C++ unit tests
- `src/plugins/*/tests/` — Plugin-specific tests

### Code Quality
- `src/.clang-format` — C++ formatting config
- `src/bindings/python/setup.cfg` — Python flake8/mypy config
- `src/bindings/js/.eslintrc.js` — JavaScript ESLint config
- `cspell.json` — Spelling configuration

### Coverage
- `cmake/coverage.cmake` — Coverage build configuration
- `cmake/developer_package/coverage/` — Coverage CMake modules
- `tools/mo/.coveragerc` — Python coverage config (Model Optimizer)

### Build
- `CMakeLists.txt` — Root CMake configuration
- `Jenkinsfile` — Jenkins pipeline (legacy)
- `conanfile.txt` / `vcpkg.json` — Package managers
- `install_build_dependencies.sh` — Build dependency installer

### Security
- `SECURITY.md` — Security policy
- `.github/dependency_review.yml` — Dependency review config
