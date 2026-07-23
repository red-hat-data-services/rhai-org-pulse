---
repository: "red-hat-data-services/openvino_contrib"
overall_score: 3.9
scorecard:
  - dimension: "Unit Tests"
    score: 5.0
    status: "Moderate unit tests for NVIDIA plugin (GTest) and Java API (JUnit), but no tests for openvino_code TypeScript module"
  - dimension: "Integration/E2E"
    score: 4.0
    status: "Functional tests for NVIDIA plugin, Python integration tests for custom_operations and token_merging, but no E2E test infrastructure"
  - dimension: "Build Integration"
    score: 2.0
    status: "No PR-time Docker image build, no Konflux simulation, limited build validation in CI"
  - dimension: "Image Testing"
    score: 1.0
    status: "Single Dockerfile for NVIDIA plugin CI environment only, no runtime image testing or multi-arch support"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tracking whatsoever - no codecov, no coverage flags, no thresholds"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "7 GitHub Actions workflows plus Azure Pipelines and Jenkins, but fragmented across modules with gaps"
  - dimension: "Static Analysis"
    score: 4.0
    status: "ESLint for openvino_code, clang-format for NVIDIA plugin, ruff for Python modules, but no Dependabot/Renovate and no FIPS checks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No coverage tracking across any module"
    impact: "Code quality regressions go undetected; no visibility into test effectiveness"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No PR-time build integration testing"
    impact: "Build failures discovered only post-merge in downstream Konflux builds"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No container image runtime validation"
    impact: "The only Dockerfile is a CI environment image; no production image testing exists"
    severity: "HIGH"
    effort: "6-8 hours"
  - title: "No tests for openvino_code TypeScript extension"
    impact: "VS Code extension has 63 TypeScript files with zero test coverage"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No dependency management automation"
    impact: "Security vulnerabilities in dependencies not detected automatically"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents lack context on testing patterns, frameworks, and quality standards"
    severity: "MEDIUM"
    effort: "3-4 hours"
quick_wins:
  - title: "Enable Dependabot for automated dependency alerts"
    effort: "1-2 hours"
    impact: "Automated security and dependency updates for npm, pip, gradle, and GitHub Actions ecosystems"
  - title: "Add codecov integration for Python modules"
    effort: "2-3 hours"
    impact: "Immediate visibility into test coverage for token_merging and custom_operations"
  - title: "Add timeout-minutes to all GitHub Actions workflows"
    effort: "30 minutes"
    impact: "Prevent hung jobs from consuming CI resources indefinitely"
  - title: "Create basic CLAUDE.md with testing guidance"
    effort: "2-3 hours"
    impact: "AI agents can generate tests consistent with project conventions"
  - title: "Add pre-commit hooks configuration"
    effort: "1-2 hours"
    impact: "Consistent code quality enforcement before push across all modules"
recommendations:
  priority_0:
    - "Add coverage tracking (codecov/coveralls) for all test suites"
    - "Enable Dependabot for npm, pip, gradle, docker, and github-actions ecosystems"
    - "Add PR-time build validation for NVIDIA plugin Docker image"
    - "Add unit tests for openvino_code VS Code extension (63 TS files, 0 tests)"
  priority_1:
    - "Create comprehensive agent rules (.claude/rules/) for each module's test patterns"
    - "Add integration tests that validate cross-module compatibility"
    - "Configure FIPS-compatible base images (replace nvidia/cuda with UBI-based images)"
    - "Add multi-architecture support for container images"
    - "Unify CI across modules (currently fragmented between GH Actions, Azure, Jenkins)"
  priority_2:
    - "Add performance regression tests for CUDA operations"
    - "Add VS Code extension integration tests with vscode-test framework"
    - "Consolidate Python linting configuration across modules"
    - "Add pre-commit hooks for all languages (clang-format, ruff, eslint)"
---

# Quality Analysis: red-hat-data-services/openvino_contrib

## Executive Summary
- **Overall Score: 3.9/10**
- **Jira Project**: RHOAIENG
- **Jira Component**: Model Runtimes
- **Tier**: downstream
- **Repository Type**: Multi-module contrib library (C++/CUDA, Python, TypeScript, Java)
- **Primary Languages**: C++ (549 files), TypeScript (63 files), Python (60 files), Java (31 files)
- **Key Strengths**: NVIDIA plugin has solid unit test suite with GTest; Python modules have functional test coverage; multiple CI systems provide broad trigger coverage
- **Critical Gaps**: Zero coverage tracking, no container image testing, no dependency alerts, no agent rules, VS Code extension entirely untested
- **Agent Rules Status**: Missing

## Quality Scorecard
| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 5/10 | 15% | Moderate unit tests for NVIDIA plugin (41 files) and Java API (8 files), but VS Code extension (63 TS files) has 0 tests |
| Integration/E2E | 4/10 | 20% | Functional tests for NVIDIA plugin (28 files), Python tests for custom ops and token merging, but no structured E2E infrastructure |
| Build Integration | 2/10 | 15% | No PR-time Docker build, no Konflux simulation, Azure Pipeline builds but doesn't validate images |
| Image Testing | 1/10 | 10% | Single Dockerfile is CI environment only (nvidia/cuda base), no production image or runtime validation |
| Coverage Tracking | 0/10 | 10% | No codecov, no coverage flags, no thresholds, no PR coverage reporting |
| CI/CD Automation | 5/10 | 15% | 7 GH Actions workflows + Azure Pipelines + Jenkinsfile, but fragmented with missing concurrency/caching on several workflows |
| Static Analysis | 4/10 | 10% | ESLint, clang-format, ruff configured per-module, but no Dependabot/Renovate and no FIPS checks |
| Agent Rules | 0/10 | 5% | No CLAUDE.md, AGENTS.md, or .claude/ directory |

## Critical Gaps

1. **No coverage tracking across any module**
   - Impact: Code quality regressions go undetected; no visibility into test effectiveness across C++, Python, TypeScript, or Java modules
   - Severity: HIGH
   - Effort: 4-6 hours

2. **No PR-time build integration testing**
   - Impact: Build failures discovered only post-merge in downstream Konflux builds; Azure Pipeline builds in Docker but doesn't validate images
   - Severity: HIGH
   - Effort: 8-12 hours

3. **No container image runtime validation**
   - Impact: The only Dockerfile (`modules/nvidia_plugin/Dockerfile`) is a CI build environment image based on `nvidia/cuda:11.8.0-runtime-ubuntu20.04`, not a production image; no runtime testing exists
   - Severity: HIGH
   - Effort: 6-8 hours

4. **No tests for openvino_code VS Code extension**
   - Impact: 63 TypeScript source files with zero test files (no `.test.ts` or `.spec.ts` files found); only linting runs in CI
   - Severity: HIGH
   - Effort: 16-24 hours

5. **No dependency management automation**
   - Impact: No `.github/dependabot.yml` or `renovate.json`; security vulnerabilities in npm, pip, gradle, and Docker dependencies not detected automatically
   - Severity: MEDIUM
   - Effort: 1-2 hours

6. **No agent rules for AI-assisted development**
   - Impact: AI agents lack context on the multi-module structure, testing frameworks (GTest, JUnit, pytest, ESLint), and quality standards
   - Severity: MEDIUM
   - Effort: 3-4 hours

## Quick Wins

1. **Enable Dependabot for automated dependency alerts**
   - Effort: 1-2 hours
   - Impact: Automated security and dependency updates across all ecosystems
   - Implementation:
   ```yaml
   # .github/dependabot.yml
   version: 2
   updates:
     - package-ecosystem: "npm"
       directory: "/modules/openvino_code"
       schedule:
         interval: "weekly"
     - package-ecosystem: "pip"
       directory: "/modules/custom_operations"
       schedule:
         interval: "weekly"
     - package-ecosystem: "pip"
       directory: "/modules/token_merging"
       schedule:
         interval: "weekly"
     - package-ecosystem: "gradle"
       directory: "/modules/java_api"
       schedule:
         interval: "weekly"
     - package-ecosystem: "github-actions"
       directory: "/"
       schedule:
         interval: "monthly"
   ```

2. **Add codecov integration for Python modules**
   - Effort: 2-3 hours
   - Impact: Immediate visibility into test coverage for token_merging and custom_operations
   - Implementation:
   ```yaml
   # Add to .github/workflows/token_merging.yml
   - name: Run tests with coverage
     run: |
       source venv/bin/activate
       python -m pytest --cov=tomeov --cov-report=xml modules/token_merging/tests/
   - name: Upload coverage
     uses: codecov/codecov-action@v4
     with:
       files: ./coverage.xml
       flags: token_merging
   ```

3. **Add timeout-minutes to all GitHub Actions workflows**
   - Effort: 30 minutes
   - Impact: Prevent hung CI jobs (only `sanitizer_cuda.yml` has timeout configured at 300 min)
   - Implementation: Add `timeout-minutes: 60` to all jobs in `test_cuda.yml`, `history_cuda.yml`, `code_style.yml`, `openvino_code.yml`, `token_merging.yml`

4. **Create basic CLAUDE.md with testing guidance**
   - Effort: 2-3 hours
   - Impact: AI agents can generate tests consistent with project conventions

5. **Add pre-commit hooks configuration**
   - Effort: 1-2 hours
   - Impact: Consistent code quality enforcement before push
   - Implementation:
   ```yaml
   # .pre-commit-config.yaml
   repos:
     - repo: https://github.com/astral-sh/ruff-pre-commit
       rev: v0.1.0
       hooks:
         - id: ruff
           args: [--fix]
     - repo: https://github.com/pre-commit/mirrors-clang-format
       rev: v14.0.0
       hooks:
         - id: clang-format
           files: modules/nvidia_plugin/
   ```

## Detailed Findings

### Unit Tests

**Status: Moderate (5/10)**

The repository is a multi-module collection with varying test maturity across modules:

**NVIDIA Plugin (C++ / GTest) — Good:**
- 41 unit test files in `modules/nvidia_plugin/tests/unit/`
- Uses Google Test (GTest) and Google Mock (GMock) frameworks
- Tests cover memory management, graph operations, transformations, and benchmarks
- Test fixture pattern used consistently (`struct XxxTest : testing::Test`)
- 399 source files in `modules/nvidia_plugin/src/` → test ratio: ~10% (low)

**Java API (JUnit) — Moderate:**
- 8 test files in `modules/java_api/src/test/java/`
- Tests cover Core, CompiledModel, Model, Tensor, PrePostProcessor
- 22 main source files → test ratio: 36% (good)
- Tests run via Gradle in Azure Pipelines CI

**Custom Operations (pytest) — Minimal:**
- 1 main test runner (`tests/run_tests.py`) with parameterized tests for FFT, complex_mul, sparse_conv, calculate_grid
- 3 additional test files for tokenizer testing (including differential fuzzing)
- Good use of `@pytest.mark.parametrize` for combinatorial coverage

**Token Merging (pytest) — Minimal:**
- 1 test file (`tests/test_precommit.py`) with 3 integration-style tests
- Tests StableDiffusion, OpenCLIP, and timm model patching
- Uses `unittest.TestCase` with temporary directories

**OpenVINO Code VS Code Extension — None:**
- 63 TypeScript source files across `src/`, `side-panel-ui/`, `shared/`
- 0 test files (no `.test.ts`, `.spec.ts`, or test directories)
- Only linting configured in CI (ESLint + ruff for Python server)

### Integration/E2E Tests

**Status: Weak (4/10)**

**NVIDIA Plugin Functional Tests:**
- 28 functional test files in `modules/nvidia_plugin/tests/functional/`
- Shared test instances for single layer tests (convolution, transpose, broadcast, etc.)
- Behavioral tests for plugin lifecycle, caching, and inference requests
- Run on dedicated `lohika-ci` hardware runner with CUDA GPU
- Also tested via Azure Pipelines with Docker-based NVIDIA CI environment

**Custom Operations Integration:**
- Tests run against compiled OpenVINO with custom extension library
- Azure Pipeline builds everything end-to-end (CMake → build → test)
- Tokenizer regression tests included (though `continueOnError: true` in Azure CI)

**Token Merging Integration:**
- Tests patch real models (StableDiffusion, OpenCLIP, timm), export to ONNX, and compile with OpenVINO
- Provides genuine integration coverage but limited scope (3 tests)

**Gaps:**
- No dedicated E2E test infrastructure (no `e2e/` or `integration/` directories)
- No multi-version testing (no matrix for different OpenVINO versions)
- No cluster-based testing (no Kind/Minikube/envtest)
- Tokenizer regression tests have `continueOnError: true` — failures don't block CI

### Build Integration

**Status: Very Weak (2/10)**

**Current State:**
- Azure Pipelines builds NVIDIA plugin inside Docker (`nvidia/cuda` image) and runs tests
- Azure Pipelines builds custom_operations with CMake/Ninja and runs tests
- GitHub Actions `test_cuda.yml` builds on dedicated hardware but relies on pre-existing runner state
- No PR-time Docker image build validation
- No Konflux build simulation
- No Kustomize/kubectl validation (not a Kubernetes operator)
- Build configuration relies heavily on CMake with OpenVINO as external dependency

**NVIDIA Plugin Build (test_cuda.yml) — Fragile:**
- Uses pre-configured runner directories (`~/runner/openvino`, `~/runner/openvino_contrib`)
- Not reproducible — depends on runner state
- No Docker image build step in GitHub Actions

**Azure Pipeline Build — Better:**
- Builds from clean checkout with Docker-based isolation
- Installs dependencies, configures CMake, and builds with Ninja
- Runs Java tests and custom operations tests

**Gaps:**
- No PR-time image builds in GitHub Actions workflows
- No production Dockerfile (existing one is CI environment only)
- No Konflux integration or simulation
- `test_cuda.yml` workflow uses mutable runner state, not reproducible builds

### Image Testing

**Status: Critical Gap (1/10)**

**Current State:**
- Only one Dockerfile: `modules/nvidia_plugin/Dockerfile`
- This Dockerfile creates a **CI build environment image** (based on `nvidia/cuda:11.8.0-runtime-ubuntu20.04`), not a production/runtime image
- No `.dockerignore` file
- No `docker-compose.yml`
- No multi-stage builds for production images
- No HEALTHCHECK directives
- No multi-architecture support
- No Testcontainers or runtime validation
- Base image is `nvidia/cuda:11.8.0-runtime-ubuntu20.04` — not FIPS-compatible (not UBI-based)

**Impact:**
As a downstream Red Hat repo (`red-hat-data-services/openvino_contrib`), there are no production container images being built or tested in this repository. Image building likely happens entirely in downstream Konflux pipelines with no validation at the source repo level.

### Coverage Tracking

**Status: Absent (0/10)**

**Current State:**
- No `.codecov.yml` or `codecov.yml` configuration
- No `.coveragerc` file
- No coverage flags in any CI workflow (`--coverprofile`, `pytest-cov`, `--coverage`)
- No coverage thresholds or enforcement
- No PR coverage reporting
- No coverage badges in README

**Impact:**
- No visibility into which code paths are tested
- Coverage regressions go completely undetected
- No ability to enforce coverage standards on PRs
- No data to prioritize testing efforts

### CI/CD Automation

**Status: Moderate (5/10)**

**GitHub Actions Workflows (7):**

| Workflow | Trigger | Modules | Features |
|----------|---------|---------|----------|
| `test_cuda.yml` | push + PR (nvidia_plugin/) | NVIDIA Plugin | Unit + functional tests on GPU runner |
| `sanitizer_cuda.yml` | push + dispatch (nvidia_plugin/) | NVIDIA Plugin | CUDA compute sanitizer tests; `timeout-minutes: 300` |
| `history_cuda.yml` | push + PR (nvidia_plugin/) | NVIDIA Plugin | Rebase verification, autosquash check |
| `openvino_code.yml` | PR (openvino_code/) | VS Code Extension | npm lint, ruff + black check; **has concurrency + caching** |
| `token_merging.yml` | push + PR (token_merging/) | Token Merging | pytest; **has concurrency + strategy matrix** |
| `code_style.yml` | push + PR (java_api/) | Java API | google-java-format check |
| `labeler.yml` | pull_request_target | All | Auto-labeling PRs |

**Azure Pipelines (4 configs in `.ci/azure/`):**
- `linux.yml`: Builds custom_operations, java_api; runs Java tests, custom op tests, tokenizer tests
- `linux_cuda.yml`: Builds NVIDIA plugin in Docker; timeout 60 min
- `mac.yml` and `windows.yml`: Cross-platform CI

**Jenkins:**
- `Jenkinsfile` present but minimal — loads OpenVINO shared library, delegates to `entrypoint()`

**Strengths:**
- Concurrency control on 2 of 7 GH Actions workflows (`openvino_code.yml`, `token_merging.yml`)
- Caching enabled for npm and pip in `openvino_code.yml`
- Path-based triggers prevent unnecessary CI runs
- Multiple CI systems provide comprehensive coverage

**Gaps:**
- 5 of 7 GH Actions workflows lack concurrency control
- Only 1 of 7 workflows has `timeout-minutes` configured
- No caching on most workflows (builds download tools each run)
- `test_cuda.yml` depends on mutable runner state (`~/runner/` directories)
- No test parallelization beyond `token_merging.yml`'s matrix (which only tests Python 3.8)
- Outdated action versions: `actions/checkout@v2` in `token_merging.yml`, `actions/checkout@v3` in several others (v4 is current)
- No automated dependency updates

### Static Analysis

**Status: Weak (4/10)**

#### Linting

**NVIDIA Plugin (C++):**
- `.clang-format` configured (Google style, 120 column limit)
- `utils/check.sh` validates clang-format on diffs against master
- Format check runs as part of `test_cuda.yml` (format step)

**OpenVINO Code (TypeScript):**
- ESLint configured with `airbnb-typescript/base`, `@typescript-eslint/recommended-requiring-type-checking`, and `prettier`
- Strict rules: `no-console`, `restrict-template-expressions`, `import/no-extraneous-dependencies`
- Runs in `openvino_code.yml` workflow via `npm run lint:all`

**Python Modules:**
- `ruff` configured in `pyproject.toml` for custom_operations and openvino_code server
- `black` used for openvino_code server formatting
- `bandit` security scanning configured for tokenizers Python code (via `pyproject.toml`)
- Runs in `openvino_code.yml` (ruff + black) and Azure Pipelines (bandit)

**Java API:**
- `google-java-format` enforced via `code_style.yml` workflow

#### FIPS Compatibility

**Status: Not Evaluated — Low Risk**

- No direct crypto imports found in the codebase (`crypto/md5`, `hashlib.md5`, etc.)
- Repository is a contrib library for ML inference, not a security-sensitive service
- Only Dockerfile uses `nvidia/cuda:11.8.0-runtime-ubuntu20.04` (not UBI-based, not FIPS-compatible)
- No FIPS build tags or BoringCrypto configuration

#### Dependency Alerts

**Status: Not Configured**

- No `.github/dependabot.yml`
- No `renovate.json`, `.renovaterc`, or `.renovaterc.json`
- Manual dependency updates only across npm, pip, gradle, and Docker ecosystems
- Outdated dependencies visible (e.g., Python 3.8 targets, torch 2.0.1, openvino 2023.1.0 pinned)

### Agent Rules

**Status: Absent (0/10)**

**Current State:**
- No `CLAUDE.md` or `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` for test creation guidance
- No custom skills defined

**Impact:**
When AI agents are asked to generate tests for this multi-module codebase, they lack context on:
- Module boundaries and which testing framework each uses (GTest for C++, JUnit for Java, pytest for Python, nothing for TypeScript)
- Build system configuration (CMake for C++, Gradle for Java, pip/setuptools for Python, npm for TypeScript)
- Hardware requirements (NVIDIA GPU needed for CUDA tests)
- Test data management patterns
- Quality gates and standards

**Recommendations:**

1. **Create CLAUDE.md:**
   ```markdown
   # openvino_contrib - Agent Instructions

   ## Repository Structure
   Multi-module contrib library for OpenVINO:
   - `modules/nvidia_plugin/` — NVIDIA GPU plugin (C++/CUDA, CMake, GTest)
   - `modules/java_api/` — Java bindings (Java, Gradle, JUnit)
   - `modules/custom_operations/` — Custom OpenVINO operations (C++/Python, CMake, pytest)
   - `modules/openvino_code/` — VS Code extension (TypeScript, npm, ESLint)
   - `modules/token_merging/` — Token merging for ViT models (Python, pytest)

   ## Testing Conventions
   - C++ tests: GTest/GMock, build with CMake
   - Java tests: JUnit via Gradle
   - Python tests: pytest with parametrize
   - TypeScript tests: None yet (need vscode-test)

   ## CI Systems
   - GitHub Actions: Module-specific workflows
   - Azure Pipelines: Cross-platform builds
   - Jenkins: Shared library integration
   ```

2. **Create test rules per module** — use `/test-rules-generator` to bootstrap

## Recommendations

### Priority 0 (Critical)
- Add coverage tracking (codecov/coveralls) for all test suites — start with Python modules (easiest), then Java, then C++
- Enable Dependabot for npm, pip, gradle, docker, and github-actions ecosystems
- Add PR-time build validation for the NVIDIA plugin Docker image
- Add unit tests for openvino_code VS Code extension (63 TS files, 0 tests)

### Priority 1 (High Value)
- Create comprehensive agent rules (`.claude/rules/`) for each module's test patterns
- Add integration tests that validate cross-module compatibility
- Configure FIPS-compatible base images (replace `nvidia/cuda` with UBI-based images for downstream builds)
- Add multi-architecture support for container images
- Unify CI strategy across modules (currently fragmented between GitHub Actions, Azure Pipelines, and Jenkins)
- Update outdated action versions (`actions/checkout@v2`→`v4`, `actions/setup-python@v2`→`v5`)

### Priority 2 (Nice-to-Have)
- Add performance regression tests for CUDA operations
- Add VS Code extension integration tests with `@vscode/test-electron` framework
- Consolidate Python linting configuration across modules (single `ruff.toml` at root)
- Add pre-commit hooks for all languages (clang-format, ruff, eslint, google-java-format)
- Expand `token_merging.yml` matrix to test multiple Python versions (currently only 3.8)
- Add concurrency control to remaining 5 GitHub Actions workflows

## Comparison to Gold Standards

| Dimension | openvino_contrib | odh-dashboard | notebooks | Gap |
|-----------|-----------------|---------------|-----------|-----|
| Unit Tests | 5/10 | 9/10 | 8/10 | -4 (Add TS tests, improve C++ ratio) |
| Integration/E2E | 4/10 | 10/10 | 7/10 | -6 (Add structured E2E infrastructure) |
| Build Integration | 2/10 | 9/10 | 8/10 | -7 (Add PR-time build validation) |
| Image Testing | 1/10 | 7/10 | 10/10 | -9 (Add production images + runtime tests) |
| Coverage Tracking | 0/10 | 9/10 | 8/10 | -9 (Add codecov from scratch) |
| CI/CD Automation | 5/10 | 9/10 | 8/10 | -4 (Add caching, concurrency, timeouts) |
| Static Analysis | 4/10 | 9/10 | 8/10 | -5 (Add Dependabot, pre-commit) |
| Agent Rules | 0/10 | 8/10 | 6/10 | -8 (Create from scratch) |

**Key Takeaways:**
- **Biggest gaps**: Coverage Tracking (0/10) and Image Testing (1/10) — these are the most impactful areas to address first
- **Second tier gaps**: Build Integration (2/10) and Agent Rules (0/10)
- **Relative strength**: CI/CD Automation (5/10) benefits from having multiple CI systems, but they are fragmented and inconsistently configured
- **Module disparity**: NVIDIA plugin has reasonable test coverage; openvino_code VS Code extension has zero test coverage

## File Paths Reference

### CI/CD
- `.github/workflows/test_cuda.yml` — NVIDIA plugin unit + functional tests (GPU runner)
- `.github/workflows/sanitizer_cuda.yml` — CUDA compute sanitizer (push + dispatch only)
- `.github/workflows/history_cuda.yml` — NVIDIA plugin rebase/squash checks
- `.github/workflows/openvino_code.yml` — VS Code extension lint (ESLint + ruff + black)
- `.github/workflows/token_merging.yml` — Token merging pytest
- `.github/workflows/code_style.yml` — Java API google-java-format
- `.github/workflows/labeler.yml` — PR auto-labeling
- `.ci/azure/linux.yml` — Azure Pipelines: custom ops + Java tests
- `.ci/azure/linux_cuda.yml` — Azure Pipelines: NVIDIA plugin Docker build
- `.ci/azure/mac.yml` — Azure Pipelines: macOS build
- `.ci/azure/windows.yml` — Azure Pipelines: Windows build
- `Jenkinsfile` — Jenkins shared library entry point

### Testing
- `modules/nvidia_plugin/tests/unit/` — 41 C++ unit test files (GTest)
- `modules/nvidia_plugin/tests/functional/` — 28+ C++ functional test files
- `modules/java_api/src/test/java/` — 8 Java test files (JUnit)
- `modules/custom_operations/tests/run_tests.py` — Custom operations pytest
- `modules/custom_operations/user_ie_extensions/tokenizer/python/tests/` — Tokenizer tests
- `modules/token_merging/tests/test_precommit.py` — Token merging integration tests
- `modules/openvino_code/` — **No tests** (63 TS files, 0 test files)

### Static Analysis
- `modules/nvidia_plugin/.clang-format` — C++ format config (Google style)
- `modules/nvidia_plugin/utils/check.sh` — clang-format validation script
- `modules/openvino_code/.eslintrc.js` — TypeScript ESLint config (airbnb-typescript)
- `modules/openvino_code/side-panel-ui/.eslintrc.cjs` — Side panel ESLint config
- `modules/custom_operations/pyproject.toml` — ruff + bandit config for tokenizers
- `modules/openvino_code/server/pyproject.toml` — ruff + black config for server
- `.github/dependabot.yml` — **Missing** (needs creation)
- `.pre-commit-config.yaml` — **Missing** (needs creation)

### Container Images
- `modules/nvidia_plugin/Dockerfile` — CI environment image (nvidia/cuda:11.8.0)

### Coverage
- `.codecov.yml` — **Missing** (needs creation)

### Agent Rules
- `CLAUDE.md` — **Missing** (needs creation)
- `.claude/rules/` — **Missing** (needs creation)
