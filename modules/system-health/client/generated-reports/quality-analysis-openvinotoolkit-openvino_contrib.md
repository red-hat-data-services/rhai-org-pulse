---
repository: "openvinotoolkit/openvino_contrib"
overall_score: 5.1
scorecard:
  - dimension: "Unit Tests"
    score: 6.0
    status: "Solid unit tests across C++, Go, Java, and Python modules; ~103 test files across 1120+ source files"
  - dimension: "Integration/E2E"
    score: 5.0
    status: "E2E tests for llama_cpp and ollama_openvino; integration suite in ollama_openvino Go module; no cluster-based testing"
  - dimension: "Build Integration"
    score: 6.0
    status: "Multi-platform CI builds (Linux, macOS, Windows) with CMake; NVIDIA plugin build validation; no Konflux simulation"
  - dimension: "Image Testing"
    score: 4.0
    status: "Multiple Dockerfiles present but no runtime validation, no health checks, no multi-arch build in CI"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tooling configured — no codecov, no coverprofile, no pytest-cov, no thresholds"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "13 workflows with PR triggers, concurrency control, ccache; path-filtered builds; artifact uploads"
  - dimension: "Static Analysis"
    score: 4.0
    status: "ESLint for langchain module, Java code style check, license header enforcement; no linting for C++/Python/Go, no dependency alerts, no pre-commit hooks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory; no AI agent test guidance"
critical_gaps:
  - title: "No code coverage tracking or enforcement"
    impact: "Cannot measure test effectiveness; regressions in coverage go undetected"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No dependency update automation (Dependabot/Renovate)"
    impact: "Vulnerable or outdated dependencies may persist undetected across all modules"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "FIPS-incompatible crypto usage in ollama_openvino"
    impact: "Multiple Go files import crypto/sha256 via math/rand pattern; no FIPS build tags in CI"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No linting for C++, Python, or Go code"
    impact: "Code quality inconsistencies across the largest codebases in the repo"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "No container runtime validation in CI"
    impact: "Built images are never tested for startup or functional correctness"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Enable Dependabot for Go, pip, npm, and Docker ecosystems"
    effort: "1-2 hours"
    impact: "Automated dependency update PRs with security alerts across all modules"
  - title: "Add codecov integration to linux.yml workflow"
    effort: "2-4 hours"
    impact: "Visibility into test coverage trends; PR coverage reporting"
  - title: "Create CLAUDE.md with basic test patterns and repo conventions"
    effort: "2-3 hours"
    impact: "Enable AI agents to generate quality-consistent tests and contributions"
  - title: "Add pre-commit hooks for license headers and basic linting"
    effort: "2-3 hours"
    impact: "Catch style and license issues before CI, reducing review friction"
recommendations:
  priority_0:
    - "Add code coverage collection (pytest-cov, go test -coverprofile, JaCoCo) and integrate with Codecov"
    - "Configure Dependabot for all package ecosystems (gomod, pip, npm, docker)"
    - "Audit and remediate FIPS-incompatible crypto usage in ollama_openvino module"
  priority_1:
    - "Add golangci-lint for Go modules (ollama_openvino)"
    - "Add ruff or flake8 linting for Python modules (custom_operations, training_kit, token_merging)"
    - "Add container runtime validation tests for Dockerfiles"
    - "Create CLAUDE.md with test patterns and contribution guidelines for AI agents"
  priority_2:
    - "Add pre-commit hooks across the repository"
    - "Add HEALTHCHECK instructions to Dockerfiles"
    - "Add multi-architecture CI builds for container images"
    - "Consolidate test reporting with unified JUnit XML output"
---

# Quality Analysis: openvino_contrib

## Executive Summary

- **Overall Score: 5.1/10**
- **Repository Type**: Multi-module contrib library (C++, Python, Go, Java, TypeScript)
- **Primary Languages**: C++ (NVIDIA/custom ops), Go (ollama_openvino), Python (training kit, token merging), Java (Java API), TypeScript (langchain integration)
- **RHOAI Component**: Model Runtimes (RHOAIENG)
- **Tier**: Upstream

**Key Strengths**: Comprehensive multi-platform CI (Linux, macOS, Windows) with concurrency control and ccache; good test coverage across diverse language modules; E2E test infrastructure for llama_cpp and ollama_openvino plugins.

**Critical Gaps**: Zero coverage tracking across all modules; no dependency update automation; no linting for the majority of code (C++, Python, Go); FIPS-incompatible crypto patterns in the ollama_openvino module; no AI agent rules.

**Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory.

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 6.0/10 | 15% | Solid unit tests across C++, Go, Java, and Python modules |
| Integration/E2E | 5.0/10 | 20% | E2E tests for llama_cpp and ollama; integration suite in Go module |
| Build Integration | 6.0/10 | 15% | Multi-platform CI builds with CMake; no Konflux simulation |
| Image Testing | 4.0/10 | 10% | Dockerfiles present but no runtime validation or health checks |
| Coverage Tracking | 1.0/10 | 10% | No coverage tooling — no codecov, no thresholds, no PR reporting |
| CI/CD Automation | 7.0/10 | 15% | 13 workflows, path filtering, concurrency, ccache caching |
| Static Analysis | 4.0/10 | 10% | ESLint for langchain only; no C++/Python/Go linting; no dep alerts |
| Agent Rules | 0.0/10 | 5% | No agent rules or AI test guidance |

**Weighted Overall: 5.1/10**

## Critical Gaps

### 1. No Code Coverage Tracking or Enforcement
- **Impact**: Cannot measure test effectiveness; coverage regressions go undetected across all modules
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: No `.codecov.yml`, no `--coverprofile` in Go tests, no `pytest-cov` in Python workflows, no JaCoCo for Java. Tests run but coverage is never collected or reported.

### 2. No Dependency Update Automation
- **Impact**: Vulnerable or outdated dependencies may persist across Go, Python, npm, and Docker ecosystems
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: No `.github/dependabot.yml` or `renovate.json` configuration. The repository has dependencies across gomod, pip, npm, and Docker base images — all unmonitored.

### 3. FIPS-Incompatible Crypto Usage
- **Impact**: The ollama_openvino Go module uses `crypto/sha256` and potentially `math/rand` in security contexts; no FIPS build tags in CI
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Details**: 9 files in ollama_openvino reference crypto packages. The `CGO_ENABLED=1` is set in Dockerfiles but without FIPS-specific configuration. No `GOEXPERIMENT=boringcrypto` or `-tags=fips` in CI builds.

### 4. No Linting for Major Codebases
- **Impact**: Code quality inconsistencies in C++ (NVIDIA plugin), Python (training kit), and Go (ollama_openvino)
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: Only the openvino-langchain TypeScript module has ESLint and the Java API has a code style workflow. The largest codebases (C++, Go, Python) have no automated linting.

### 5. No Container Runtime Validation
- **Impact**: Built container images are never tested for startup correctness or functional behavior in CI
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: Three Dockerfiles exist (nvidia_plugin, ollama_openvino x2) but none are built or tested in CI. The ollama workflow tests a binary build, not the containerized version.

## Quick Wins

### 1. Enable Dependabot (1-2 hours)
Add `.github/dependabot.yml` covering all ecosystems:
```yaml
version: 2
updates:
  - package-ecosystem: "gomod"
    directory: "/modules/ollama_openvino"
    schedule:
      interval: "weekly"
  - package-ecosystem: "pip"
    directory: "/modules/custom_operations"
    schedule:
      interval: "weekly"
  - package-ecosystem: "npm"
    directory: "/modules/openvino-langchain"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "docker"
    directory: "/modules/nvidia_plugin"
    schedule:
      interval: "weekly"
  - package-ecosystem: "docker"
    directory: "/modules/ollama_openvino"
    schedule:
      interval: "weekly"
```

### 2. Add Codecov Integration (2-4 hours)
Add coverage collection to the linux.yml workflow:
- Python: `python3 -m pytest --cov --cov-report=xml` for custom_operations tests
- Go: `go test -coverprofile=coverage.out` for ollama_openvino
- Java: Add JaCoCo plugin to Gradle build
- Upload with `codecov/codecov-action`

### 3. Create CLAUDE.md (2-3 hours)
Add basic agent rules covering:
- Repository structure and module boundaries
- Test patterns per language (pytest, Go testing, JUnit, Jest)
- Build system conventions (CMake with OPENVINO_EXTRA_MODULES)
- PR workflow expectations

### 4. Add Pre-commit Hooks (2-3 hours)
Create `.pre-commit-config.yaml` with:
- License header check (already in CI via skywalking-eyes)
- Python formatting (black/ruff)
- Go formatting (gofmt)
- YAML/JSON validation

## Detailed Findings

### Unit Tests

**Score: 6.0/10**

The repository has ~103 test files across ~1120 source files (ratio ~1:11). Tests span multiple languages and frameworks:

- **C++ (NVIDIA plugin)**: 14 unit test files in `modules/nvidia_plugin/tests/unit/` covering memory management, CUDA graph operations, and transformations. Uses Google Test framework.
- **Go (ollama_openvino)**: ~40 `_test.go` files covering API clients, server routes, model processing, format utilities, template rendering, parsers, and more. Strong unit test coverage for this module.
- **Java (Java API)**: 8 test files in `modules/java_api/src/test/` covering Core, Model, Tensor, CompiledModel, and PrePostProcessor APIs. Uses JUnit with Gradle.
- **Python (training kit)**: ~20 test files covering PyTorch, sklearn, and TensorFlow training integrations with classification, regression, segmentation, and detection tests.
- **Python (token_merging)**: 1 precommit test file.
- **Python (custom_operations)**: 1 `run_tests.py` test runner.
- **TypeScript (langchain)**: 4 test files covering LLM, chat models, embeddings, and tool integration.

**Strengths**: Good variety of test types across languages; ollama_openvino has particularly strong Go unit test coverage.

**Gaps**: No test isolation patterns (`t.Parallel()` in Go tests not verified); test-to-code ratio is moderate; some modules (3d, android_demos, bevfusion, genai_optimizations) have zero tests.

### Integration/E2E Tests

**Score: 5.0/10**

- **llama_cpp_plugin**: Has dedicated E2E tests (`tests/e2e/`) and functional tests (`tests/functional/`) that are built and run in CI. Tests cover model conversion, inference, and plugin registration.
- **ollama_openvino**: Has an `integration/` directory with 8 test files covering basic operations, concurrency, context handling, embedding, LLM inference, image processing, and queue management. The CI workflow performs an end-to-end test (build, create model, run inference).
- **NVIDIA plugin**: Has `tests/functional/` with shared test instances covering single layer tests (logical, transpose). The `test_cuda.yml` workflow runs on dedicated hardware.
- **custom_operations**: Tests run via pytest in CI across Linux, Windows, and macOS.

**Strengths**: The llama_cpp and ollama modules have genuine E2E testing including model loading and inference.

**Gaps**: No Kubernetes cluster testing (Kind, Minikube, envtest); no multi-version testing; no contract testing between modules; no integration tests for Java API beyond Gradle test suite; some E2E tests use sleep-based synchronization rather than proper readiness checks.

### Build Integration

**Score: 6.0/10**

- **Multi-platform CI**: Linux (Ubuntu 22.04), macOS, and Windows builds all run on PRs with full build-and-test cycles.
- **CMake-based builds**: The core build uses CMake with the `OPENVINO_EXTRA_MODULES` mechanism to build contrib modules alongside OpenVINO.
- **NVIDIA plugin**: Separate build job dependent on the main build, using CUDA container images.
- **Module-specific builds**: llama_cpp and ollama_openvino have dedicated PR-triggered build workflows with path filtering.
- **Artifact management**: Build artifacts are uploaded between jobs (OpenVINO package for NVIDIA plugin build).
- **ccache**: Used across all platform builds for compilation caching.

**Strengths**: Cross-platform build validation; path-filtered module-specific builds; build artifact sharing between jobs.

**Gaps**: No Konflux build simulation; no Docker image building in CI; no operator manifest validation (not applicable); no kustomize overlay testing; no build-time security scanning.

### Image Testing

**Score: 4.0/10**

Three Dockerfiles exist:
- `modules/nvidia_plugin/Dockerfile` — CUDA 11.8 development environment (not a runtime image)
- `modules/ollama_openvino/Dockerfile` — Multi-stage, multi-architecture Ollama build (ROCm, CUDA, CPU, JetPack variants)
- `modules/ollama_openvino/Dockerfile_genai_ubuntu24` — Ubuntu 24.04 GenAI build

**Analysis**:
- The ollama Dockerfile is sophisticated with multi-stage builds (`FROM base AS cpu`, `FROM base AS cuda-11`, etc.) and multi-architecture support via `TARGETARCH`.
- Uses `--platform` flags for architecture-specific builds.
- Base images are mixed: CentOS 7/Rocky 8 (ROCm), Ubuntu 22.04/24.04, nvidia/cuda. No UBI-based images for FIPS compliance.
- No `HEALTHCHECK` instructions in any Dockerfile.
- No Docker images are built or tested in CI workflows.
- The nvidia plugin Dockerfile is a development environment, not a production runtime image.

**Gaps**: No CI image builds; no runtime validation; no HEALTHCHECK; no UBI base images; no multi-arch CI builds.

### Coverage Tracking

**Score: 1.0/10**

**No coverage tooling is configured anywhere in the repository.**

- No `.codecov.yml` or `codecov.yml`
- No `--coverprofile` flag in Go test commands
- No `pytest-cov` or `--coverage` in Python test invocations
- No `coverageThreshold` in any configuration
- No JaCoCo or coverage plugin in Gradle builds
- No coverage reporting in any CI workflow
- No coverage gates or enforcement

This is the most critical gap — tests exist but their effectiveness cannot be measured or tracked.

### CI/CD Automation

**Score: 7.0/10**

**Workflow Inventory** (13 workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `linux.yml` | PR, push, dispatch | Full Linux build + Java/custom ops tests |
| `windows.yml` | PR, push, merge_group, dispatch | Full Windows build + tests |
| `mac.yml` | PR, push, dispatch | Full macOS build + tests |
| `test_cuda.yml` | PR (nvidia paths), push | NVIDIA plugin build + test on dedicated GPU hardware |
| `llama_cpp_plugin_build_and_test.yml` | PR (llama_cpp paths) | llama_cpp plugin build, functional, and E2E tests |
| `ollama_openvino_build_and_test.yml` | PR (ollama paths) | Ollama build + model inference test |
| `token_merging.yml` | PR, push (token_merging paths) | Token merging pytest suite |
| `history_cuda.yml` | PR, push (nvidia paths) | CUDA plugin history tracking |
| `sanitizer_cuda.yml` | push (nvidia paths), dispatch | CUDA compute sanitizer (post-merge only) |
| `code_style.yml` | PR, push (java paths) | Java code style check |
| `copyright.yml` | PR, push, dispatch | License header enforcement |
| `labeler.yml` | PR | Automated PR labeling |
| `assign_issue.yml` | Issue comment | Issue self-assignment |

**Strengths**:
- Concurrency control on 4 workflows (linux, windows, mac, token_merging) with cancel-in-progress
- ccache for build acceleration on all platform builds
- Path-based filtering for module-specific workflows (reduces unnecessary CI runs)
- Timeout limits on all build jobs (150 min for platform builds, 300 min for sanitizer)
- Permissions set to `read-all` with minimal escalation
- Overall status check jobs aggregate build results
- Build artifact sharing between dependent jobs

**Gaps**:
- No caching beyond ccache (pip cache only on Windows)
- No test parallelization or matrix strategies (except single Python version matrix in token_merging)
- No scheduled/periodic test runs
- sanitizer_cuda runs only post-merge, not on PRs
- Jenkinsfile exists but appears to be a stub/legacy

### Static Analysis

**Score: 4.0/10**

#### Linting
- **TypeScript (openvino-langchain)**: ESLint configured via `eslint.config.ts` with comprehensive rules (semi, indent, quotes, spacing, no-var, prefer-destructuring). Good quality config.
- **Java**: Code style workflow uses `googlejavaformat-action` for PR/push on java_api paths. Enforces consistent formatting.
- **C++**: No clang-tidy, cppcheck, or other C++ linting configured despite significant C++ codebase (NVIDIA plugin, custom operations, llama_cpp).
- **Python**: No ruff, flake8, mypy, or pylint despite multiple Python modules (training_kit, token_merging, custom_operations, 3d modules).
- **Go**: No golangci-lint despite substantial Go codebase (ollama_openvino).

#### FIPS Compatibility
- 9 files in ollama_openvino reference crypto packages — primarily `crypto/sha256` for content hashing
- `CGO_ENABLED=1` is set in Dockerfiles and CI but without FIPS-specific build tags
- No `GOEXPERIMENT=boringcrypto` or `-tags=fips` in any CI configuration
- Base images are Ubuntu/CentOS/Rocky — not UBI (not FIPS-ready)
- No FIPS provider configuration for OpenSSL

#### Dependency Alerts
- **No Dependabot configuration** — `.github/dependabot.yml` does not exist
- **No Renovate configuration** — no `renovate.json`, `.renovaterc`, or `.renovaterc.json`
- Dependencies across 5+ ecosystems (gomod, pip, npm, Gradle, Docker) are entirely unmonitored
- GitHub Actions versions are pinned by SHA (good practice) but not automatically updated

### Agent Rules

**Score: 0.0/10**

- **Status**: Missing
- **No CLAUDE.md or AGENTS.md** in root directory
- **No `.claude/` directory** — no rules, no skills
- **No test creation guidance** for AI agents
- **No contributing guidelines** beyond `CONTRIBUTING.md` (which covers human contribution, not AI tooling)

**Recommendation**: Generate rules covering:
- Module boundaries and build system conventions
- Test patterns per language (Go testing, pytest, JUnit, Google Test, Jest)
- CMake build configuration with `OPENVINO_EXTRA_MODULES`
- Path-filtered CI expectations
- CUDA/GPU-specific test requirements

## Recommendations

### Priority 0 (Critical)

1. **Add code coverage collection and reporting**
   - Go: `go test -coverprofile=coverage.out ./...` in ollama_openvino
   - Python: `pytest --cov --cov-report=xml` for custom_operations, training_kit, token_merging
   - Java: Add JaCoCo Gradle plugin for Java API
   - Integrate with Codecov via `codecov/codecov-action` in linux.yml

2. **Configure Dependabot for all package ecosystems**
   - gomod, pip, npm, gradle, docker, github-actions
   - Enable auto-merge for patch updates

3. **Audit FIPS crypto usage in ollama_openvino**
   - Identify all crypto/sha256 and related imports
   - Determine if FIPS-compliant alternatives are needed
   - Add FIPS build tags to CI if required for RHOAI distribution

### Priority 1 (High Value)

4. **Add linting for major codebases**
   - Go: golangci-lint with standard config for ollama_openvino
   - Python: ruff for training_kit, custom_operations, token_merging
   - C++: clang-tidy for nvidia_plugin and custom_operations

5. **Add container runtime validation**
   - Build Docker images in CI (at least for ollama_openvino)
   - Add basic startup tests (container starts, listens on expected port)
   - Add HEALTHCHECK to Dockerfiles

6. **Create CLAUDE.md with comprehensive agent rules**
   - Module structure and ownership
   - Test patterns per language
   - Build system conventions
   - Use `/test-rules-generator` to generate framework-specific rules

### Priority 2 (Nice-to-Have)

7. **Add pre-commit hooks**
   - License headers, formatting, YAML validation
   - Reduce CI round-trip time for style issues

8. **Add multi-architecture CI image builds**
   - The ollama Dockerfile supports multi-arch but CI doesn't build images

9. **Add scheduled periodic test runs**
   - Catch flaky tests and upstream dependency breakage

10. **Consolidate test reporting**
    - Standardize on JUnit XML output across all languages
    - Add test result reporting with dorny/test-reporter or similar

## Comparison to Gold Standards

| Dimension | openvino_contrib | odh-dashboard | notebooks | kserve |
|-----------|-----------------|---------------|-----------|--------|
| Unit Tests | 6.0 | 9.0 | 7.0 | 8.0 |
| Integration/E2E | 5.0 | 9.0 | 8.0 | 9.0 |
| Build Integration | 6.0 | 8.0 | 9.0 | 7.0 |
| Image Testing | 4.0 | 7.0 | 9.0 | 6.0 |
| Coverage Tracking | 1.0 | 8.0 | 6.0 | 8.0 |
| CI/CD Automation | 7.0 | 9.0 | 8.0 | 9.0 |
| Static Analysis | 4.0 | 8.0 | 6.0 | 7.0 |
| Agent Rules | 0.0 | 8.0 | 3.0 | 2.0 |
| **Overall** | **5.1** | **8.5** | **7.3** | **7.5** |

**Key Differentiators**:
- openvino_contrib is a multi-language contrib monorepo which adds complexity
- Gold standards have consistent linting, coverage, and dependency management
- The complete absence of coverage tracking and dependency alerts is the largest gap
- CI/CD automation is the strongest dimension relative to gold standards

## File Paths Reference

### CI/CD Workflows
- `.github/workflows/linux.yml` — Main Linux CI (351 lines)
- `.github/workflows/windows.yml` — Windows CI (213 lines)
- `.github/workflows/mac.yml` — macOS CI (172 lines)
- `.github/workflows/test_cuda.yml` — NVIDIA GPU tests
- `.github/workflows/llama_cpp_plugin_build_and_test.yml` — llama_cpp CI
- `.github/workflows/ollama_openvino_build_and_test.yml` — Ollama CI
- `.github/workflows/token_merging.yml` — Token merging tests
- `.github/workflows/code_style.yml` — Java code style
- `.github/workflows/copyright.yml` — License headers

### Test Directories
- `modules/nvidia_plugin/tests/unit/` — NVIDIA unit tests (C++)
- `modules/nvidia_plugin/tests/functional/` — NVIDIA functional tests (C++)
- `modules/llama_cpp_plugin/tests/e2e/` — llama_cpp E2E tests
- `modules/llama_cpp_plugin/tests/functional/` — llama_cpp functional tests
- `modules/ollama_openvino/integration/` — Ollama integration tests (Go)
- `modules/ollama_openvino/*/` — Unit test files throughout (Go)
- `modules/java_api/src/test/` — Java API tests
- `modules/custom_operations/tests/` — Custom ops tests (Python)
- `modules/openvino_training_kit/tests/` — Training kit tests (Python)
- `modules/openvino-langchain/src/tests/` — Langchain tests (TypeScript)
- `modules/token_merging/tests/` — Token merging tests (Python)

### Container Images
- `modules/nvidia_plugin/Dockerfile` — CUDA dev environment
- `modules/ollama_openvino/Dockerfile` — Multi-arch Ollama build
- `modules/ollama_openvino/Dockerfile_genai_ubuntu24` — GenAI Ubuntu build
- `modules/3d/pointPillars/devops/Dockerfile` — PointPillars environment

### Static Analysis
- `modules/openvino-langchain/eslint.config.ts` — ESLint for TypeScript
- `.licenserc.yaml` — Apache license header config
- `Jenkinsfile` — Legacy Jenkins pipeline (stub)
