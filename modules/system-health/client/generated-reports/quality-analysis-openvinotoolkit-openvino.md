---
repository: "openvinotoolkit/openvino"
overall_score: 7.8
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Excellent test coverage with 1700+ test files, GTest (C++) and pytest (Python) frameworks, 40% test-to-code ratio"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Comprehensive multi-layer testing: E2E, layer tests, model hub tests, stress tests, fuzz tests, memory tests, LLM tests"
  - dimension: "Build Integration"
    score: 7.5
    status: "Extensive PR-triggered builds across platforms (Linux/Windows/macOS/Android/WASM/RISC-V) with Docker image CI, Smart CI for selective runs"
  - dimension: "Image Testing"
    score: 7.0
    status: "20+ Dockerfiles for build/test environments across platforms, no runtime validation or HEALTHCHECK patterns"
  - dimension: "Coverage Tracking"
    score: 6.0
    status: "Dedicated coverage workflow with lcov/gcov, but nightly-only — no PR coverage gates or threshold enforcement"
  - dimension: "CI/CD Automation"
    score: 9.5
    status: "70+ workflows, Smart CI component-aware triggers, concurrency control, caching, matrix strategies, merge queue support"
  - dimension: "Static Analysis"
    score: 8.0
    status: "Clang-tidy on PR, flake8+black for Python, clang-format, comprehensive Dependabot config; no pre-commit hooks"
  - dimension: "Agent Rules"
    score: 7.0
    status: "5 Claude skills for debugging, transformation tests, code style, and PyTorch upgrades; no CLAUDE.md root doc or test creation rules"
critical_gaps:
  - title: "No PR-time coverage gates"
    impact: "Coverage regressions can be merged without detection; coverage only measured on nightly runs"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No pre-commit hooks"
    impact: "Code style violations caught only in CI, slowing PR feedback loop"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No container runtime validation"
    impact: "Docker images built in CI but not tested for startup or runtime correctness"
    severity: "MEDIUM"
    effort: "6-8 hours"
  - title: "No UBI-based container images for FIPS environments"
    impact: "All Dockerfiles use Ubuntu/Fedora base images; no FIPS-capable base image option"
    severity: "MEDIUM"
    effort: "8-12 hours"
quick_wins:
  - title: "Add PR coverage reporting with codecov"
    effort: "3-4 hours"
    impact: "Catch coverage regressions on every PR instead of nightly"
  - title: "Add .pre-commit-config.yaml with clang-format and flake8"
    effort: "1-2 hours"
    impact: "Shift-left code style enforcement to developer workstations"
  - title: "Add root CLAUDE.md with project conventions"
    effort: "2-3 hours"
    impact: "Improve AI-assisted development quality and consistency"
  - title: "Add test creation agent rules to .claude/rules/"
    effort: "2-3 hours"
    impact: "Standardize AI-generated unit and integration test patterns"
recommendations:
  priority_0:
    - "Enable PR coverage gates — integrate codecov with threshold enforcement on pull requests"
    - "Add container runtime validation — verify built images start and respond correctly"
  priority_1:
    - "Add .pre-commit-config.yaml for local enforcement of clang-format, flake8, and black"
    - "Create root CLAUDE.md documenting build system, test patterns, and contribution guidelines"
    - "Add .claude/rules/ with test creation rules for GTest (C++) and pytest (Python) patterns"
  priority_2:
    - "Add UBI-based Dockerfile variants for FIPS-compliant environments"
    - "Add HEALTHCHECK instructions to CI Dockerfiles"
    - "Consider contract testing between Python bindings and C++ core"
---

# Quality Analysis: OpenVINO (openvinotoolkit/openvino)

## Executive Summary

- **Overall Score: 7.8/10**
- **Repository Type**: C++/Python ML inference toolkit with multi-platform support
- **Primary Languages**: C++ (7,591 source files), Python (1,544 source files)
- **RHOAI Component**: Model Runtimes (RHOAIENG)
- **Key Strengths**: Massive test suite (1,700+ test files), 70+ CI workflows with Smart CI, comprehensive multi-platform coverage (Linux, Windows, macOS, Android, RISC-V, WebAssembly), strong static analysis with clang-tidy and flake8, excellent Dependabot coverage across 8+ ecosystems
- **Critical Gaps**: No PR coverage gates (coverage runs nightly only), no pre-commit hooks, no container runtime validation, no FIPS-compatible base images
- **Agent Rules Status**: Partial — 5 Claude skills present but no root CLAUDE.md or test creation rules

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 8.5/10 | 15% | 1,700+ test files, GTest + pytest, 40% test-to-code ratio |
| Integration/E2E | 9.0/10 | 20% | Multi-layer: E2E, layer, model hub, stress, fuzz, memory, LLM tests |
| Build Integration | 7.5/10 | 15% | Multi-platform PR builds, Smart CI selective runs, Docker-based CI |
| Image Testing | 7.0/10 | 10% | 20+ Dockerfiles, multi-arch support; no runtime validation |
| Coverage Tracking | 6.0/10 | 10% | lcov/gcov coverage workflow exists but nightly-only, no PR gates |
| CI/CD Automation | 9.5/10 | 15% | 70+ workflows, concurrency, caching, matrix, merge queue |
| Static Analysis | 8.0/10 | 10% | clang-tidy, flake8, black, clang-format, Dependabot; no pre-commit |
| Agent Rules | 7.0/10 | 5% | 5 Claude skills, no root CLAUDE.md or test creation rules |

## Critical Gaps

### 1. No PR-Time Coverage Gates
- **Impact**: Coverage regressions can be merged without detection. The `coverage.yml` workflow runs on `schedule` (nightly) and `workflow_dispatch` only — not on pull requests for enforcement.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The project has a comprehensive coverage workflow using lcov/gcov that runs CPU and GPU coverage lanes, but it only runs nightly. There is no `.codecov.yml` configuration, no coverage thresholds, and no PR coverage reporting.

### 2. No Pre-Commit Hooks
- **Impact**: Code style violations (clang-format, flake8, black) are caught only in CI, adding 10-30 minutes to the feedback loop.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: The project has excellent CI-based style checking (code_style.yml, py_checks.yml, clang_tidy.yml) but no `.pre-commit-config.yaml` to catch issues locally before push.

### 3. No Container Runtime Validation
- **Impact**: Docker images built in CI workflows are not tested for startup correctness, health checks, or basic functionality.
- **Severity**: MEDIUM
- **Effort**: 6-8 hours
- **Details**: The project has 20+ Dockerfiles under `.github/dockerfiles/` for build and test environments, but none include HEALTHCHECK instructions and there's no runtime validation step in CI.

### 4. No FIPS-Compatible Base Images
- **Impact**: All CI Dockerfiles use Ubuntu/Fedora/manylinux base images. No UBI-based variants exist for FIPS-compliant environments.
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Details**: No crypto/FIPS-related patterns found in the codebase (no `crypto/md5`, no `-tags=fips`, no boringcrypto). This is not a code-level issue but a deployment concern for FIPS-regulated environments.

## Quick Wins

### 1. Add PR Coverage Reporting with Codecov (3-4 hours)
- **Impact**: Catch coverage regressions on every PR instead of discovering them in nightly runs
- **Implementation**: Add `.codecov.yml` with coverage thresholds, integrate `codecov/codecov-action` into PR workflows, set minimum coverage delta gates.

### 2. Add .pre-commit-config.yaml (1-2 hours)
- **Impact**: Shift-left code style enforcement to developer workstations
- **Implementation**:
```yaml
repos:
  - repo: https://github.com/pre-commit/mirrors-clang-format
    rev: v18.1.0
    hooks:
      - id: clang-format
        types_or: [c, c++]
  - repo: https://github.com/PyCQA/flake8
    rev: 7.0.0
    hooks:
      - id: flake8
        args: [--config=setup.cfg]
  - repo: https://github.com/psf/black
    rev: 24.4.2
    hooks:
      - id: black
        args: [-l, "160", -S]
```

### 3. Add Root CLAUDE.md (2-3 hours)
- **Impact**: Improve AI-assisted development quality by documenting project conventions
- **Implementation**: Create `CLAUDE.md` at repo root covering build system (CMake), test patterns (GTest, pytest), code style conventions, and contribution guidelines.

### 4. Add Test Creation Agent Rules (2-3 hours)
- **Impact**: Standardize AI-generated test patterns across C++ and Python
- **Implementation**: Create `.claude/rules/unit-tests.md` and `.claude/rules/e2e-tests.md` with framework-specific patterns and examples.

## Detailed Findings

### Unit Tests (8.5/10)

**Strengths:**
- **Massive test suite**: 907 C++ test files and 818 Python test files (1,700+ total)
- **40% test-to-code ratio**: 1,712 test files vs 4,202 source files
- **Dual framework approach**: GTest/GMock for C++ (1,540 files include gtest/gmock headers), pytest for Python
- **Dedicated unit test workflows**: `job_cxx_unit_tests.yml` and `job_python_unit_tests.yml` as reusable workflows
- **Test isolation**: Separate test directories per component (`src/core/tests/`, `src/inference/tests/`, `src/frontends/tests/`)

**Weaknesses:**
- No visible test parallelization directives (`t.Parallel()` equivalent) in C++ tests
- Test configuration spread across multiple `pytest.ini` files without centralized config

**Key Files:**
- `src/core/tests/` — Core runtime unit tests
- `src/inference/tests/` — Inference engine tests
- `src/frontends/tests/` — Frontend framework tests
- `tests/layer_tests/` — Layer-level Python tests

### Integration/E2E Tests (9.0/10)

**Strengths:**
- **Multi-layer test architecture**: 
  - `tests/e2e_tests/` — End-to-end pipeline tests
  - `tests/layer_tests/` — Layer-level tests across frameworks (JAX, ONNX, PyTorch, TensorFlow, TF Lite)
  - `tests/model_hub_tests/` — Model compatibility tests (PyTorch, TensorFlow, JAX hubs)
  - `src/tests/functional/` — C++ functional tests with plugin conformance
- **Specialized test suites**:
  - `tests/stress_tests/` — Stress testing
  - `tests/memory_tests/` — Memory leak/usage testing
  - `tests/time_tests/` — Performance timing tests
  - `tests/fuzz/` — Fuzz testing
  - `tests/llm/` — LLM-specific tests
  - `tests/sanitizers/` — Sanitizer integration (ASan, UBSan, TSan)
- **Multi-framework coverage**: Dedicated layer test suites for PyTorch, TensorFlow, JAX, ONNX, and TF Lite
- **CI-automated**: Dedicated workflows for functional tests (`job_cpu_functional_tests.yml`), layer tests, model hub tests, GPU tests

**Weaknesses:**
- No contract testing between Python bindings and C++ core
- No explicit multi-version Kubernetes/container testing (not applicable to this project type)

**Key Files:**
- `tests/e2e_tests/` — Full pipeline tests with `conftest.py` and YAML-based test rules
- `tests/layer_tests/` — Per-framework layer validation
- `tests/model_hub_tests/` — Hub model compatibility
- `src/tests/functional/plugin/conformance/` — Plugin conformance tests

### Build Integration (7.5/10)

**Strengths:**
- **Extensive multi-platform PR builds**: PRs trigger builds on Ubuntu 22/24/26, Windows (VS2022 Debug/Release), macOS ARM64, Android, RISC-V, WebAssembly, manylinux 2.28
- **Smart CI system**: Component-aware build triggering that skips irrelevant workflows based on changed files (via `.github/actions/smart-ci`)
- **Docker-based CI**: Builds use project-specific Docker images from `.github/dockerfiles/` with Azure Container Registry
- **Reusable workflow architecture**: `job_build_linux.yml` and `job_build_windows.yml` as reusable building blocks
- **Conditional compilation testing**: `linux_conditional_compilation.yml` and `windows_conditional_compilation.yml`

**Weaknesses:**
- No Konflux build simulation (not necessarily applicable for upstream Intel project)
- No operator manifest validation (not a Kubernetes operator)
- Jenkinsfile present but appears minimal — references external library

**Key Files:**
- `.github/workflows/ubuntu_24.yml` — Main Linux PR workflow
- `.github/workflows/windows_vs2022_release.yml` — Windows PR workflow
- `.github/workflows/mac_arm64.yml` — macOS ARM64 workflow
- `.github/workflows/job_build_linux.yml` — Reusable Linux build workflow

### Image Testing (7.0/10)

**Strengths:**
- **20+ Dockerfiles**: Organized under `.github/dockerfiles/ov_build/` and `.github/dockerfiles/ov_test/` covering multiple platforms (Ubuntu 20/22/24/26, Fedora, NVIDIA CUDA, manylinux, WebAssembly, Android, RISC-V)
- **Multi-architecture support**: ARM64 cross-compilation, Android builds, RISC-V builds
- **Build/test separation**: Separate Dockerfiles for build environments (`ov_build/`) and test environments (`ov_test/`)
- **Docker-based CI integration**: Images built and cached in Azure Container Registry with dedicated cleanup workflow

**Weaknesses:**
- No HEALTHCHECK instructions in any Dockerfile
- No runtime validation (container startup testing)
- No multi-stage builds for production images (these are CI environment images, not production images)
- No UBI-based images for FIPS-compliant environments
- Images use Ubuntu base images exclusively (not FIPS-capable without additional configuration)

**Key Files:**
- `.github/dockerfiles/ov_build/ubuntu_24_04_x64/Dockerfile` — Main build environment
- `.github/dockerfiles/ov_test/ubuntu_22_04_x64/Dockerfile` — Main test environment
- `.github/dockerfiles/ov_build/ubuntu_22_04_x64_nvidia/Dockerfile` — NVIDIA CUDA build environment

### Coverage Tracking (6.0/10)

**Strengths:**
- **Dedicated coverage workflow**: `coverage.yml` with comprehensive CPU and GPU coverage lanes
- **Native coverage tooling**: Uses lcov/gcov for C++ coverage measurement
- **GPU coverage**: Separate coverage lanes for iGPU and dGPU workloads
- **Coverage build notes**: Artifacts uploaded for coverage build introspection

**Weaknesses:**
- **Nightly-only**: Coverage runs on schedule (daily at 00:00 UTC) and workflow_dispatch — NOT on pull requests
- **No PR coverage reporting**: No codecov/coveralls integration for PR comments
- **No coverage thresholds**: No minimum coverage enforcement or delta checks
- **No `.codecov.yml`**: No coverage configuration file
- **No Python coverage**: No `pytest-cov` or `--cov` usage detected in CI workflows

**Key Files:**
- `.github/workflows/coverage.yml` — Nightly coverage workflow
- `.github/actions/coverage_toolkit/` — Custom coverage action

### CI/CD Automation (9.5/10)

**Strengths:**
- **70+ workflow files**: Comprehensive coverage of builds, tests, static analysis, code style, documentation
- **Smart CI**: Component-aware triggers that selectively run workflows based on changed files — avoids unnecessary CI runs
- **Concurrency control**: Nearly all workflows use `concurrency:` with `cancel-in-progress: true`
- **Caching strategies**: Build artifact caching across workflows
- **Matrix strategies**: Multi-version testing across Ubuntu versions, Python versions, GPU configurations
- **Merge queue support**: `merge_group` trigger on key workflows
- **Reusable workflow architecture**: `job_*.yml` files as building blocks called by platform-specific workflows
- **Specialized CI features**: 
  - `ci-doctor` agentic workflow for CI health
  - `workflow_rerunner.yml` for automatic retry
  - `cleanup_caches.yml` for cache management
  - `files_size.yml` for binary size tracking
  - `stale_prs_and_issues.yml` for repository hygiene
- **Multi-platform**: Linux (Ubuntu 22/24/26), Windows (VS2022), macOS (ARM64), Android, RISC-V, WebAssembly
- **Jenkins integration**: Jenkinsfile present for alternative CI pipeline

**Weaknesses:**
- No explicit test parallelization (sharding/splitting) beyond matrix strategies
- Some workflows (sanitizers, coverage) are schedule-only, not PR-triggered

**Key Files:**
- `.github/workflows/ubuntu_24.yml` — Primary Linux CI
- `.github/workflows/code_style.yml` — Style checks on PR
- `.github/workflows/clang_tidy.yml` — Static analysis on PR
- `.github/workflows/coverage.yml` — Nightly coverage
- `.github/workflows/ci-doctor.lock.yml` — CI health monitoring

### Static Analysis (8.0/10)

#### Linting
- **C++ (clang-tidy)**: Runs on every PR via `clang_tidy.yml` workflow using Clang-18/Clang-tidy-18
- **C++ (clang-format)**: Multiple `.clang-format` files in `src/`, `docs/`, `samples/`, `tests/` for code formatting
- **Python (flake8 + black)**: `py_checks.yml` runs flake8 and black on Python API and samples on every PR
- **Python (pyright)**: Type checking configured in `pyproject.toml` for Python bindings
- **Code style workflow**: Dedicated `code_style.yml` with Smart CI integration

#### FIPS Compatibility
- **No FIPS concerns detected**: No crypto imports (`crypto/md5`, `crypto/des`, etc.) found in source code
- **No FIPS build configuration**: No `-tags=fips` or `GOEXPERIMENT=boringcrypto` (not applicable — C++/Python project)
- **Base images**: All Ubuntu-based (not UBI) — not FIPS-capable without additional work

#### Dependency Alerts
- **Dependabot**: Comprehensive `.github/dependabot.yml` covering 8+ ecosystems:
  - Root Python dependencies (pip)
  - Python API and frontends (pip)
  - Tests dependencies (pip)
  - Tools dependencies (pip)
  - Python samples (pip, 4 directories)
  - JavaScript API (npm)
  - JavaScript samples (npm)
  - GitHub Actions (github-actions)
  - Docker images (docker)
- Daily schedule with timezone-aware scheduling
- Named assignees per ecosystem
- Grouped updates for npm packages

**Key Files:**
- `.github/workflows/clang_tidy.yml` — C++ static analysis
- `.github/workflows/py_checks.yml` — Python linting
- `.github/workflows/code_style.yml` — General code style
- `.github/dependabot.yml` — Dependency management
- `src/.clang-format` — C++ formatting rules
- `pyproject.toml` — Python tooling config (black, pyright)

### Agent Rules (7.0/10)

**Strengths:**
- **5 Claude skills present** in `.claude/skills/`:
  - `ov-debug` — Comprehensive debugging skill with component-specific guides (CPU, GPU, transformations)
  - `ov-debug-matcher-pass` — Specialized MatcherPass debugging with example diagnosis report
  - `ov-ensure-coding-style` — Code style enforcement (clang-format, clang-tidy, copyright headers)
  - `ov-transformation-tests` — Unit test writing for graph transformations (MatcherPass, ModelPass)
  - `ov-update-pytorch-version` — PyTorch version upgrade workflow
- **Well-structured skills**: Each skill has a clear SKILL.md with trigger conditions, prerequisites, and step-by-step workflows
- **Domain-specific**: Skills are tailored to OpenVINO's unique architecture (transformations, plugins, frontends)

**Weaknesses:**
- **No root CLAUDE.md**: No top-level project documentation for AI agents
- **No AGENTS.md**: No general-purpose agent guidelines
- **No `.claude/rules/` directory**: No test creation rules for general unit/integration tests
- **Limited test coverage in skills**: Only `ov-transformation-tests` covers test creation — no rules for Python tests, E2E tests, or general C++ unit tests
- **No quality gate checklists**: Skills don't include CI validation checklists

**Key Files:**
- `.claude/skills/ov-debug/SKILL.md` — Debug skill
- `.claude/skills/ov-transformation-tests/SKILL.md` — Transformation test skill
- `.claude/skills/ov-ensure-coding-style/SKILL.md` — Code style skill

## Recommendations

### Priority 0 (Critical)

1. **Enable PR coverage gates** — Integrate codecov with the existing lcov/gcov coverage infrastructure. Add `.codecov.yml` with minimum coverage thresholds and PR delta checks. This is the single highest-impact improvement.

2. **Add container runtime validation** — For the CI Docker images, add basic startup tests to verify images are functional before use in downstream CI jobs. This prevents wasted CI time on broken environments.

### Priority 1 (High Value)

3. **Add `.pre-commit-config.yaml`** — Configure pre-commit hooks for clang-format, flake8, black, and copyright checks to catch style issues before push. The project already has all the tooling; this just adds local enforcement.

4. **Create root `CLAUDE.md`** — Document the CMake build system, GTest/pytest patterns, code style conventions, and contribution guidelines for AI-assisted development.

5. **Add `.claude/rules/` with test creation rules** — Create rules for:
   - C++ unit tests (GTest patterns, test naming, fixture usage)
   - Python unit tests (pytest patterns, conftest.py conventions)
   - Layer tests (multi-framework validation patterns)
   - E2E tests (pipeline test patterns)

### Priority 2 (Nice-to-Have)

6. **Add UBI-based Dockerfile variants** — For FIPS-compliant deployment environments, create UBI-based build and test Dockerfiles alongside the existing Ubuntu-based ones.

7. **Add HEALTHCHECK to CI Dockerfiles** — Include health check instructions for CI environment images to detect broken containers faster.

8. **Consider contract testing** — Add contract tests between the Python API bindings (`src/bindings/python/`) and the C++ core (`src/core/`) to catch API compatibility issues.

9. **Enable Python coverage** — Add `pytest-cov` to the Python test workflows and merge results with the C++ coverage reports.

## Comparison to Gold Standards

| Dimension | OpenVINO | odh-dashboard | notebooks | kserve |
|-----------|----------|---------------|-----------|--------|
| Unit Tests | 8.5 — Massive GTest+pytest suite | 9.0 — Jest + React testing library | 6.0 — Limited | 8.0 — Go testing |
| Integration/E2E | 9.0 — Multi-layer (E2E, layer, model hub, fuzz, stress) | 9.0 — Cypress E2E | 7.0 — Image validation | 9.0 — Ginkgo E2E |
| Build Integration | 7.5 — Multi-platform PR builds, Smart CI | 8.0 — Konflux simulation | 7.0 — Image builds | 7.0 — PR builds |
| Image Testing | 7.0 — 20+ Dockerfiles, multi-arch | 7.0 — Container tests | 9.0 — 5-layer validation | 6.0 — Basic |
| Coverage Tracking | 6.0 — lcov/gcov nightly only | 9.0 — Codecov + enforcement | 5.0 — Limited | 8.0 — Codecov |
| CI/CD Automation | 9.5 — 70+ workflows, Smart CI, merge queue | 9.0 — Comprehensive | 7.0 — Good | 8.0 — Good |
| Static Analysis | 8.0 — clang-tidy, flake8, black, Dependabot | 8.0 — ESLint, Dependabot | 6.0 — Basic | 7.0 — golangci-lint |
| Agent Rules | 7.0 — 5 Claude skills, no root CLAUDE.md | 8.0 — Comprehensive rules | 3.0 — None | 2.0 — None |
| **Overall** | **7.8** | **8.5** | **6.3** | **7.0** |

## File Paths Reference

### CI/CD
- `.github/workflows/` — 70+ workflow files
- `.github/workflows/ubuntu_24.yml` — Primary Linux CI
- `.github/workflows/coverage.yml` — Nightly coverage
- `.github/workflows/clang_tidy.yml` — Static analysis
- `.github/workflows/code_style.yml` — Code style checks
- `.github/workflows/py_checks.yml` — Python linting
- `.github/workflows/ci-doctor.lock.yml` — CI health monitoring
- `.github/workflows/job_build_linux.yml` — Reusable Linux build
- `Jenkinsfile` — Jenkins pipeline

### Testing
- `tests/` — Top-level test directory (E2E, layer, model hub, stress, memory, fuzz, LLM, sanitizers)
- `src/core/tests/` — Core runtime unit tests
- `src/inference/tests/` — Inference engine tests
- `src/frontends/tests/` — Frontend tests
- `src/tests/functional/` — Functional/conformance tests

### Code Quality / Static Analysis
- `pyproject.toml` — Python tooling (black, pyright)
- `src/.clang-format` — C++ formatting
- `.github/dependabot.yml` — Dependency management (8+ ecosystems)

### Container Images
- `.github/dockerfiles/ov_build/` — Build environment Dockerfiles
- `.github/dockerfiles/ov_test/` — Test environment Dockerfiles

### Agent Rules
- `.claude/skills/ov-debug/` — Debug skill
- `.claude/skills/ov-debug-matcher-pass/` — MatcherPass debug skill
- `.claude/skills/ov-ensure-coding-style/` — Code style skill
- `.claude/skills/ov-transformation-tests/` — Transformation test skill
- `.claude/skills/ov-update-pytorch-version/` — PyTorch upgrade skill
