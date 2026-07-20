---
repository: "red-hat-data-services/openvino_model_server"
overall_score: 6.4
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "130+ gtest C++ test files with solid test-to-code ratio and Bazel integration"
  - dimension: "Integration/E2E"
    score: 6.0
    status: "Python functional tests via pytest/Docker, but limited scenario breadth"
  - dimension: "Build Integration"
    score: 7.0
    status: "Konflux Dockerfile and Jenkins PR builds with multi-stage Docker pipeline"
  - dimension: "Image Testing"
    score: 5.0
    status: "Multi-stage UBI9 Dockerfiles but no runtime validation or health checks"
  - dimension: "Coverage Tracking"
    score: 6.0
    status: "Bazel coverage with lcov and threshold enforcement, but no PR-level reporting"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "Jenkins CI with parallel stages, smart diff detection, and SDL checks"
  - dimension: "Static Analysis"
    score: 6.0
    status: "cpplint, clang-format, hadolint, bandit — but no Dependabot or pre-commit hooks"
  - dimension: "Agent Rules"
    score: 4.0
    status: "Copilot instructions present; no CLAUDE.md or .claude/ rules"
critical_gaps:
  - title: "No PR-level coverage reporting"
    impact: "Coverage regressions can slip through unnoticed; reviewers lack visibility into coverage delta on each PR"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container runtime validation or HEALTHCHECK"
    impact: "Image startup and runtime failures not caught until deployment; no readiness signal for orchestrators"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No dependency alert configuration (Dependabot/Renovate)"
    impact: "Vulnerable or outdated dependencies remain undetected without manual review"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "Limited functional test scenario coverage"
    impact: "Only 4 functional test modules cover a complex model serving platform; edge cases and failure modes may be untested"
    severity: "MEDIUM"
    effort: "20-40 hours"
quick_wins:
  - title: "Add .github/dependabot.yml for pip and Docker ecosystems"
    effort: "1-2 hours"
    impact: "Automated dependency vulnerability alerts and update PRs"
  - title: "Add HEALTHCHECK to Dockerfile.redhat and Dockerfile.konflux"
    effort: "1-2 hours"
    impact: "Container orchestrators can detect unhealthy server instances automatically"
  - title: "Create CLAUDE.md with test creation rules from copilot-instructions.md"
    effort: "2-3 hours"
    impact: "AI-assisted development follows consistent patterns for test creation"
  - title: "Add .pre-commit-config.yaml for cpplint and clang-format"
    effort: "2-3 hours"
    impact: "Catch style issues before commit, reducing CI feedback cycles"
recommendations:
  priority_0:
    - "Integrate codecov or similar tool for PR-level coverage reporting and delta tracking"
    - "Add Dependabot configuration covering pip, Docker, and Bazel ecosystems"
    - "Add HEALTHCHECK directive to production Dockerfiles"
  priority_1:
    - "Expand functional test suite to cover more model serving scenarios (gRPC/REST, LLM serving, mediapipe, embeddings)"
    - "Create CLAUDE.md and .claude/rules/ for test automation guidance"
    - "Add .pre-commit-config.yaml to enforce style checks locally"
  priority_2:
    - "Add multi-architecture build support (ARM64) for broader deployment targets"
    - "Consider migrating Jenkins CI to GitHub Actions for better PR integration and community visibility"
    - "Add container image startup validation tests using testcontainers or equivalent"
---

# Quality Analysis: openvino_model_server

**Repository**: [red-hat-data-services/openvino_model_server](https://github.com/red-hat-data-services/openvino_model_server)
**Tier**: Downstream
**Jira**: RHOAIENG / Model Runtimes
**Primary Language**: C++ (Bazel build system), Python (tests and bindings)
**Type**: AI Model Serving Platform (OpenVINO-based inference server)
**Analysis Date**: 2026-07-20

## Executive Summary

- **Overall Score: 6.4/10**
- **Key Strengths**: Extensive C++ unit test suite (130+ gtest files), well-structured multi-stage Docker builds with Konflux support, comprehensive Jenkins CI with parallel stages and smart diff detection, strong static analysis pipeline (cpplint, clang-format, hadolint, bandit)
- **Critical Gaps**: No PR-level coverage reporting despite having local coverage infrastructure, no container HEALTHCHECK or runtime validation, no dependency alert configuration, limited functional test scenario breadth
- **Agent Rules Status**: Partial — `.github/copilot-instructions.md` present with detailed project context, but no `CLAUDE.md` or `.claude/rules/`

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.0/10 | 15% | 1.20 | 130+ gtest C++ test files with solid test-to-code ratio |
| Integration/E2E | 6.0/10 | 20% | 1.20 | Python functional tests via pytest/Docker, limited scenario breadth |
| Build Integration | 7.0/10 | 15% | 1.05 | Konflux Dockerfile + Jenkins PR builds with multi-stage pipeline |
| Image Testing | 5.0/10 | 10% | 0.50 | Multi-stage UBI9 Dockerfiles, no runtime validation or HEALTHCHECK |
| Coverage Tracking | 6.0/10 | 10% | 0.60 | Bazel coverage with lcov and threshold enforcement, no PR reporting |
| CI/CD Automation | 7.0/10 | 15% | 1.05 | Jenkins CI with parallel stages, smart diff detection, SDL checks |
| Static Analysis | 6.0/10 | 10% | 0.60 | cpplint, clang-format, hadolint, bandit — missing Dependabot/pre-commit |
| Agent Rules | 4.0/10 | 5% | 0.20 | Copilot instructions present; no CLAUDE.md or .claude/ rules |
| **Overall** | **6.4/10** | **100%** | **6.40** | |

## Critical Gaps

### 1. No PR-Level Coverage Reporting
- **Impact**: Coverage regressions can merge unnoticed; reviewers have no visibility into whether a PR improves or degrades coverage
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The repo has solid local coverage infrastructure — `bazel coverage` with lcov, genhtml report generation, and threshold enforcement (76% lines, 83% functions via `ci/check_coverage.bat`). However, this runs only when `CHECK_COVERAGE=1` is set during Docker builds and results never appear on PRs. No codecov/coveralls integration exists.

### 2. No Container Runtime Validation or HEALTHCHECK
- **Impact**: Image startup failures and runtime issues not caught until deployment; Kubernetes/OpenShift cannot auto-detect unhealthy pods
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The Dockerfiles use well-structured multi-stage builds (base_build → build → capi-build → pkg → release) but the release stage has no `HEALTHCHECK` directive. No testcontainers or image startup validation exists in CI.

### 3. No Dependency Alert Configuration
- **Impact**: Vulnerable or outdated third-party dependencies remain undetected without manual review
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: No `.github/dependabot.yml`, `renovate.json`, or equivalent. The project has 25+ third-party dependencies in `third_party/` managed through Bazel, plus Python test dependencies in `tests/requirements.txt`. Neither ecosystem has automated update monitoring.

### 4. Limited Functional Test Scenario Coverage
- **Impact**: A complex model serving platform with gRPC, REST, LLM, mediapipe, embeddings, and reranking capabilities has only 4 functional test modules
- **Severity**: MEDIUM
- **Effort**: 20-40 hours
- **Details**: `tests/functional/` contains only `test_model_versions_handling.py`, `test_model_version_policy.py`, `test_reshaping.py`, and `test_llm_json.py`. Many server capabilities (embeddings, reranking, mediapipe graphs, image generation, C API, multi-model pipelines) lack functional test coverage.

## Quick Wins

### 1. Add `.github/dependabot.yml` (1-2 hours)
```yaml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/tests"
    schedule:
      interval: "weekly"
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 2. Add HEALTHCHECK to Production Dockerfiles (1-2 hours)
```dockerfile
# In Dockerfile.redhat and Dockerfile.konflux release stage
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8081/v2/health/ready || exit 1
```

### 3. Create CLAUDE.md from Copilot Instructions (2-3 hours)
The existing `.github/copilot-instructions.md` contains excellent project context. Adapt it into a `CLAUDE.md` with additional test creation rules and framework-specific patterns for `gtest` unit tests and `pytest` functional tests.

### 4. Add `.pre-commit-config.yaml` (2-3 hours)
```yaml
repos:
  - repo: https://github.com/pre-commit/mirrors-clang-format
    rev: v14.0.0
    hooks:
      - id: clang-format
        types_or: [c++]
  - repo: https://github.com/cpplint/cpplint
    rev: 1.6.1
    hooks:
      - id: cpplint
  - repo: https://github.com/hadolint/hadolint
    rev: v2.12.0
    hooks:
      - id: hadolint-docker
```

## Detailed Findings

### Unit Tests

**Score: 8.0/10**

The project has a strong C++ unit testing foundation:

- **130+ test files** in `src/test/` using Google Test (gtest)
- **548 non-test source files** — giving a test-to-code file ratio of ~24%
- **Bazel integration**: Tests build and run via `bazel test //src:ovms_test`
- **Test infrastructure**: `test_utils.hpp`, `light_test_utils.hpp`, `c_api_test_utils.hpp` provide reusable test utilities
- **Specialized test areas**: LLM tests (`src/test/llm/`), mediapipe tests (`src/test/mediapipe/`), Python binding tests (`src/test/python/`), embeddings tests (`src/test/embeddings/`)
- **Test models**: Dedicated test model directories (`dummy/`, `passthrough/`, `summator/`) for reproducible testing
- **Python binding tests**: Separate Bazel target `//src/python/binding:test_python_binding`
- **Test runner script**: `run_unit_tests.sh` handles test execution with proper error handling and log compression

**What's working well**:
- Comprehensive coverage of server components (gRPC, REST, C API, config, deserialization, ensemble, custom nodes)
- Test filter support (`--test_filter`) for targeted test execution
- GPU test support via `RUN_GPU_TESTS=1` flag

**Gaps**:
- No `t.Parallel()` equivalent visible (Bazel provides some test isolation by default)
- Test data management relies on model export scripts that can be slow

### Integration/E2E Tests

**Score: 6.0/10**

- **Python functional tests** in `tests/functional/` using pytest framework
- **46 Python files** in the functional test directory, but only **4 test modules** with actual test classes:
  - `test_model_versions_handling.py` — Model version management
  - `test_model_version_policy.py` — Version policy configuration
  - `test_reshaping.py` — Dynamic shape handling
  - `test_llm_json.py` — LLM JSON endpoint testing
- **Test infrastructure**: Object model pattern (`tests/functional/object_model/`), server wrapper, gRPC/REST utilities
- **Docker-based**: Tests run against containerized OVMS instances
- **Priority markers**: `@pytest.mark.priority_low` for test prioritization
- **Target device filtering**: Tests can be skipped based on device (CPU, GPU, NPU)

**Additional test suites**:
- **Accuracy tests** (`tests/accuracy/`): Model accuracy validation scripts
- **Performance tests** (`tests/performance/`): gRPC latency and throughput benchmarks
- **SDL tests** (`tests/sdl/`): Security development lifecycle checks
- **Windows tests** (`tests/python/`): Windows service installation tests

**Gaps**:
- No cluster-based testing (Kind, Minikube, envtest)
- Limited functional test coverage relative to the number of features
- No multi-version testing matrix
- No contract testing between gRPC/REST APIs

### Build Integration

**Score: 7.0/10**

- **Konflux support**: Dedicated `Dockerfile.konflux` with `.konflux/build-args.conf` providing build parameters (base images, Bazel flags, source branches)
- **Multi-stage Docker builds**: 5 stages (base_build, build, capi-build, pkg, release) for optimized image layers
- **Jenkins PR builds**: `build_test_OnCommit.groovy` pipeline runs on PRs with:
  - Smart diff detection — only builds when relevant files change (src, third_party, Dockerfiles, etc.)
  - Parallel build stages for Linux and Windows
  - Unit test execution post-build
- **Makefile orchestration**: `make docker_build` handles full build pipeline (builder image → package → release images)
- **In-Docker testing**: Tests can run during image build via `RUN_TESTS=1` build arg
- **Multiple OS targets**: Ubuntu and Red Hat (UBI9) builds with `BASE_OS` flag

**Gaps**:
- No dry-run manifest validation (`kubectl apply --dry-run`)
- No Kustomize overlay verification (K8s deployment files in `extras/openshift_AI/` and `extras/kserve/` but no build-time validation)

### Image Testing

**Score: 5.0/10**

- **Multiple Dockerfiles**: `Dockerfile.ubuntu`, `Dockerfile.redhat`, `Dockerfile.konflux`
- **Multi-stage builds**: 5 well-defined stages separating build, packaging, and release concerns
- **UBI9 base images**: `registry.access.redhat.com/ubi9/ubi:9.7` for build, `ubi9/ubi-minimal:9.7` for release — FIPS-capable
- **GPU support**: Conditional GPU driver installation and GPU release images
- **`.dockerignore` present**: Proper build context filtering
- **Hadolint**: Dockerfile linting via `make hadolint`

**Gaps**:
- **No HEALTHCHECK directive** in any Dockerfile
- **No testcontainers** or container startup validation
- **No multi-architecture support** (x86_64 only, no ARM64/buildx)
- **No container image scanning** in CI (out of scope per instructions, but no runtime validation either)

### Coverage Tracking

**Score: 6.0/10**

- **Bazel coverage**: `bazel coverage --instrumentation_filter="-src/test" --combined_report=lcov` generates lcov reports
- **HTML reports**: `genhtml` produces browsable HTML coverage reports
- **Threshold enforcement**: `ci/check_coverage.bat` enforces:
  - Minimum lines coverage: **76.0%**
  - Minimum function coverage: **83.0%**
- **Makefile integration**: `make get_coverage` and `make check_coverage` targets
- **Filtered coverage**: lcov filters out test files and external dependencies to report only OVMS source coverage

**Gaps**:
- **No codecov/coveralls integration** — coverage stays inside the Docker build container
- **No PR coverage comments** — reviewers cannot see coverage delta per PR
- **Coverage not automated in CI** — requires manual `CHECK_COVERAGE=1` flag; default is `CHECK_COVERAGE=0`
- **No `.codecov.yml`** configuration

### CI/CD Automation

**Score: 7.0/10**

- **Jenkins CI** with multiple pipeline definitions:
  - `build_test_OnCommit.groovy` — PR pipeline (4-hour timeout)
  - `buildOnMain.groovy` — Main branch builds
  - `buildOnDevelop.groovy` — Develop branch builds
- **Smart diff detection**: Only triggers builds when relevant files change (src, Dockerfiles, Makefile, Bazel configs)
- **Parallel stages**:
  - Style + SDL checks run in parallel
  - Linux + Windows builds run in parallel
  - Unit tests + internal tests + Windows tests run in parallel
- **SDL pipeline**: Dedicated security checks:
  - cpplint (C++ style)
  - clang-format (formatting)
  - hadolint (Dockerfile linting)
  - bandit (Python security)
  - License header verification
  - Forbidden functions detection
  - Spell checking
- **Client test detection**: Separate pipeline logic for client library changes

**Gaps**:
- **Jenkins-only**: No GitHub Actions workflows; limits PR integration features (status checks, comments)
- **No explicit caching strategies** in Jenkinsfiles (relies on Bazel's built-in caching)
- **No test parallelization** within the test suite itself (single `bazel test` invocation)
- **No concurrency control** visible in Jenkinsfiles (beyond Jenkins agent label constraints)

### Static Analysis

**Score: 6.0/10**

**Linting**:
- **cpplint**: C++ style checking integrated in `make style`
- **clang-format**: Code formatting with `.clang-format` config file, enforced via `make clang-format-check`
- **cppclean**: Detects unused code and includes
- **Hadolint**: Dockerfile linting via `tests/hadolint.sh`
- **Bandit**: Python security analysis via `ci/bandit.sh`
- **Spell checking**: Integrated in `make style` with `spelling-whitelist.txt`

**FIPS Compatibility**:
- **UBI9 base images**: FIPS-capable (`registry.access.redhat.com/ubi9/ubi`)
- **BoringSSL**: Included in `third_party/boringssl/` with Bazel integration
- **No non-FIPS crypto imports detected**: grep for `crypto/md5`, `crypto/des`, `crypto/rc4`, `hashlib.md5` returned no results
- **Assessment**: Good FIPS posture with UBI9 + BoringSSL

**Dependency Alerts**:
- **No `.github/dependabot.yml`**
- **No `renovate.json` or `.renovaterc`**
- **25+ third-party Bazel dependencies** in `third_party/` without automated update tracking
- **Python test dependencies** in `tests/requirements.txt` without automated updates

**Gaps**:
- No `.pre-commit-config.yaml` for local enforcement
- No Dependabot or Renovate for automated dependency updates

### Agent Rules

**Score: 4.0/10**

- **`.github/copilot-instructions.md`**: Present and comprehensive — covers project overview, repository structure, code style, build system (Bazel), testing setup, and detailed code review guidelines (13 review rules covering C++ Core Guidelines, performance, formatting, and safety)
- **No `CLAUDE.md`**: Missing Claude Code-specific rules
- **No `.claude/` directory**: No `.claude/rules/` or `.claude/skills/`
- **No `AGENTS.md`**: Missing general agent instructions

**What's good**:
- Copilot instructions include detailed C++ review checklist
- Build system documentation is thorough (Bazel targets, Makefile, Docker stages)
- Testing section explains test setup, running, and structure

**Gaps**:
- No test creation rules for unit tests (gtest patterns, fixture setup, mock patterns)
- No test creation rules for functional tests (pytest patterns, server fixtures, gRPC/REST test utilities)
- No framework-specific examples for AI agents
- No quality gate checklists for PR reviews

## Recommendations

### Priority 0 (Critical)

1. **Integrate codecov for PR-level coverage reporting** (4-6 hours)
   - Add `.codecov.yml` with threshold configuration matching current 76%/83% gates
   - Generate coverage report in Jenkins and upload via codecov CLI
   - Enable PR comments showing coverage delta

2. **Add Dependabot configuration** (1-2 hours)
   - Create `.github/dependabot.yml` covering pip and Docker ecosystems
   - Consider Renovate for broader Bazel dependency support

3. **Add HEALTHCHECK to production Dockerfiles** (1-2 hours)
   - Use the existing REST API health endpoint for container health checks
   - Apply to `Dockerfile.redhat` and `Dockerfile.konflux` release stages

### Priority 1 (High Value)

4. **Expand functional test suite** (20-40 hours)
   - Add functional tests for embeddings, reranking, mediapipe, image generation, and C API
   - Target coverage of all REST/gRPC API endpoints
   - Add failure scenario tests (malformed requests, model loading errors, resource exhaustion)

5. **Create CLAUDE.md and .claude/rules/ for test automation** (2-4 hours)
   - Adapt `.github/copilot-instructions.md` content for Claude Code
   - Add gtest unit test creation rules with examples
   - Add pytest functional test patterns with server fixture usage

6. **Add .pre-commit-config.yaml** (2-3 hours)
   - Include cpplint, clang-format, hadolint, and bandit hooks
   - Reduces CI feedback cycle by catching issues locally

### Priority 2 (Nice-to-Have)

7. **Add multi-architecture build support** (8-16 hours)
   - Add ARM64 support via Docker buildx
   - Useful for broader deployment targets including edge devices

8. **Consider GitHub Actions migration or supplement** (16-40 hours)
   - Add GitHub Actions workflows for PR status checks and coverage comments
   - Keep Jenkins for heavy builds if needed, but use GHA for lightweight checks

9. **Add container image startup validation** (4-8 hours)
   - Test that the release image starts correctly and responds to health checks
   - Can use a simple shell script or testcontainers framework

## Comparison to Gold Standards

| Capability | OVMS (This Repo) | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|---|---|---|---|---|
| Unit test framework | gtest (130+ files) | Jest + RTL | pytest | Go testing |
| Test-to-code ratio | ~24% | ~40%+ | Moderate | High |
| Functional/E2E tests | pytest (4 modules) | Cypress + contract | Multi-layer | Multi-version |
| Coverage tracking | lcov + thresholds | Codecov + PR gates | Basic | Codecov + PR |
| PR coverage reporting | None | Yes (Codecov) | Limited | Yes (Codecov) |
| CI system | Jenkins | GitHub Actions | GitHub Actions | GitHub Actions |
| HEALTHCHECK | None | N/A (web app) | Present | Present |
| Dependabot/Renovate | None | Dependabot | Dependabot | Dependabot |
| Pre-commit hooks | None | Yes | Yes | Yes |
| Agent rules | Copilot only | CLAUDE.md + rules | Basic | Basic |
| Multi-arch | None | N/A | Yes (5-layer) | Yes |
| Konflux support | Yes | Yes | Yes | Yes |
| FIPS posture | Good (UBI9 + BoringSSL) | Good | Good | Good |

## File Paths Reference

### CI/CD
- `ci/build_test_OnCommit.groovy` — PR Jenkins pipeline
- `ci/buildOnMain.groovy` — Main branch builds
- `ci/buildOnDevelop.groovy` — Develop branch builds
- `ci/check_coverage.bat` — Coverage threshold enforcement
- `ci/bandit.sh` — Python security analysis
- `Makefile` — Build and test orchestration

### Testing
- `src/test/` — C++ unit tests (gtest, 130+ files)
- `tests/functional/` — Python functional tests (pytest)
- `tests/accuracy/` — Model accuracy validation
- `tests/performance/` — Performance benchmarks
- `tests/sdl/` — SDL security checks
- `tests/requirements.txt` — Python test dependencies
- `run_unit_tests.sh` — Unit test runner with coverage support

### Container Images
- `Dockerfile.redhat` — Red Hat UBI9 production build
- `Dockerfile.konflux` — Konflux build configuration
- `Dockerfile.ubuntu` — Ubuntu development build
- `.dockerignore` — Build context filtering
- `.konflux/build-args.conf` — Konflux build parameters

### Static Analysis
- `.clang-format` — C++ formatting configuration
- `ci/bandit.sh` — Python security analysis
- `tests/hadolint.sh` — Dockerfile linting
- `spelling-whitelist.txt` — Spell check whitelist

### Agent Rules
- `.github/copilot-instructions.md` — Copilot development instructions

### Build System
- `BUILD.bazel` — Root Bazel build file
- `.bazelrc` — Bazel configuration
- `WORKSPACE` — Bazel workspace definition
- `common_settings.bzl` — Shared Bazel settings
- `third_party/` — 25+ third-party Bazel dependencies
