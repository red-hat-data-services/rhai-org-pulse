---
repository: "openvinotoolkit/openvino.genai"
overall_score: 7.2
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Strong C++ unit tests with GTest; comprehensive Python pytest suite with markers; ~87 test files against ~404 source files"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Extensive sample-level E2E tests across LLM, Whisper, VLM, Image Gen, RAG, Video Gen; Smart CI selectively runs relevant suites"
  - dimension: "Build Integration"
    score: 7.0
    status: "Multi-platform PR builds (Linux, macOS, Windows, Manylinux); CMake + wheel builds; sample compilation validated; no Konflux simulation"
  - dimension: "Image Testing"
    score: 3.0
    status: "No Dockerfiles in repo; no container image builds or runtime validation; relies on external pre-built Docker images"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "No codecov/coveralls integration; no coverage thresholds; no PR coverage reporting; no coverage generation in CI"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "11 workflows with Smart CI, concurrency control, sccache/ccache, multi-Python matrix, Dependabot, proper OSSF permissions"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, .claude/ directory, or AI agent guidance; no test creation rules for automated agents"
critical_gaps:
  - title: "No code coverage tracking or enforcement"
    impact: "Cannot measure test completeness; regressions in coverage go undetected; no visibility into untested code paths"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No container image testing"
    impact: "No Dockerfiles in repo means no reproducible build environment; runtime validation depends entirely on pre-built external images"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No AI agent rules or test automation guidance"
    impact: "AI-assisted development cannot leverage project-specific testing patterns; inconsistent AI-generated tests"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No SAST/CodeQL integration"
    impact: "Missing automated security analysis for C++ code vulnerabilities; Coverity only runs daily/manual, not on every PR"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add codecov integration with coverage generation"
    effort: "4-6 hours"
    impact: "Immediate visibility into test coverage; PR-level coverage delta reporting; coverage threshold enforcement"
  - title: "Add CodeQL workflow for C++ and Python"
    effort: "2-3 hours"
    impact: "Free automated SAST on every PR; catches security issues earlier than daily Coverity scans"
  - title: "Create CLAUDE.md with test creation rules"
    effort: "2-3 hours"
    impact: "Guide AI agents to produce consistent, high-quality tests following project conventions"
  - title: "Add Dockerfile for development/CI reproducibility"
    effort: "4-6 hours"
    impact: "Reproducible builds outside of OpenVINO's private Azure container registry"
recommendations:
  priority_0:
    - "Implement code coverage tracking with codecov/coveralls and enforce minimum thresholds on PRs"
    - "Add CodeQL or similar SAST tool running on every PR for C++ and Python code"
  priority_1:
    - "Create comprehensive CLAUDE.md and .claude/rules/ for AI-assisted test generation"
    - "Add public Dockerfiles for local development and CI reproducibility"
    - "Add C++ code coverage via gcov/llvm-cov integrated with the CMake build"
  priority_2:
    - "Add performance regression testing for inference latency benchmarks"
    - "Add contract tests between Python/C++/JS API boundaries"
    - "Consider adding fuzz testing for parser and tokenizer components"
---

# Quality Analysis: openvino.genai

## Executive Summary

- **Overall Score: 7.2/10**
- **Repository Type**: C++/Python/JS multi-language GenAI inference library
- **Primary Languages**: C++ (core), Python (bindings + tests), JavaScript/Node.js (bindings)
- **Build System**: CMake with py-build-cmake for Python wheels

**Key Strengths**: Excellent multi-platform CI with Smart CI optimization, comprehensive test suites spanning multiple GenAI domains (LLM, VLM, Whisper, Image Generation, Video Generation, RAG), strong security posture with Trivy, Bandit, Coverity, dependency review, and Dependabot.

**Critical Gaps**: Zero code coverage tracking/enforcement, no container images or Dockerfiles in the repository, no AI agent rules, and Coverity (the main SAST tool) runs only on schedule rather than every PR.

**Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory exists.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | Strong C++ GTest suite + extensive Python pytest; ~87 test files for ~404 source files |
| Integration/E2E | 8.0/10 | Comprehensive E2E coverage across 8+ GenAI domains with Smart CI |
| Build Integration | 7.0/10 | Multi-platform CMake builds with wheel generation; no Konflux simulation |
| Image Testing | 3.0/10 | No Dockerfiles; relies on external pre-built Azure container images |
| Coverage Tracking | 2.0/10 | No coverage generation, no codecov, no thresholds |
| CI/CD Automation | 8.5/10 | 11 workflows, Smart CI, sccache, concurrency control, Dependabot |
| Agent Rules | 0.0/10 | No AI agent guidance whatsoever |

## Critical Gaps

### 1. No Code Coverage Tracking or Enforcement
- **Impact**: Cannot measure test completeness; regressions go undetected
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: Neither Python (pytest-cov) nor C++ (gcov/llvm-cov) coverage is generated. No codecov.yml, .coveragerc, or coverage CI steps exist. PRs merge with no coverage visibility.

### 2. No Container Image Testing
- **Impact**: No reproducible build environment available to contributors; runtime validation depends on private Azure-hosted images
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Details**: Zero Dockerfiles or Containerfiles exist in the repository. All CI jobs use pre-built images from `openvinogithubactions.azurecr.io` which are not publicly accessible. No image build, scan, or runtime validation occurs.

### 3. No AI Agent Rules
- **Impact**: AI-assisted development produces inconsistent tests; no project-specific conventions for automated agents
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: No CLAUDE.md, AGENTS.md, or .claude/ directory. No rules for unit test patterns, E2E test conventions, or testing framework usage.

### 4. Coverity Not Running on Every PR
- **Impact**: Static analysis findings are delayed; security issues may be merged before detection
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: Coverity workflow runs on `schedule` (daily) and `workflow_dispatch`, only processing PR changes to the workflow file itself. Adding CodeQL would provide free, per-PR SAST.

## Quick Wins

### 1. Add Codecov Integration (4-6 hours)
- **Impact**: Immediate coverage visibility and PR delta reporting
- **Implementation**:
  - Add `pytest-cov` to Python test runs: `python -m pytest --cov=openvino_genai --cov-report=xml`
  - Add `gcov` flags to CMake C++ builds: `-DCMAKE_CXX_FLAGS="--coverage"`
  - Add codecov upload step after test jobs
  - Create `.codecov.yml` with minimum coverage thresholds

### 2. Add CodeQL Workflow (2-3 hours)
- **Impact**: Free automated SAST on every PR for C++ and Python
- **Implementation**: Add `.github/workflows/codeql.yml` targeting C++ and Python languages

### 3. Create CLAUDE.md and Agent Rules (2-3 hours)
- **Impact**: Guide AI agents to produce consistent, high-quality tests
- **Implementation**: Create CLAUDE.md with project conventions, `.claude/rules/` with test creation rules for each test type (unit, integration, E2E, sample tests)

### 4. Add Public Dockerfile (4-6 hours)
- **Impact**: Enable local reproducible builds without access to private Azure registry
- **Implementation**: Create a multi-stage Dockerfile that builds openvino.genai from source with all dependencies

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory** (11 total):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `linux.yml` (1038 lines) | PR, merge_group, push | Full Linux build + test matrix |
| `windows.yml` (1019 lines) | PR, merge_group, push | Full Windows build + test matrix |
| `mac.yml` (775 lines) | PR, merge_group, push | Full macOS build + test matrix |
| `manylinux_2_28.yml` (678 lines) | PR, merge_group, push | Manylinux wheel builds + tests |
| `sdl.yml` (72 lines) | PR, push | Security: flake8, Bandit, Trivy, dependency review |
| `lint.yml` (41 lines) | PR, push | Pre-commit linting on changed files |
| `coverity.yml` (187 lines) | schedule (daily), dispatch | Coverity static analysis |
| `cleanup_caches.yml` | schedule (weekdays), dispatch | HuggingFace cache cleanup |
| `deploy_gh_pages.yml` | push to master | Documentation deployment |
| `labeler.yml` | pull_request_target | Auto-labeling PRs |
| `assign_issue.yml` | issue_comment | Issue assignment via `.take` |

**Strengths**:
- **Smart CI**: Uses `openvinotoolkit/openvino/.github/actions/smart-ci` to detect affected components and skip irrelevant test suites — excellent for a large repo
- **Concurrency Control**: All major workflows use `concurrency` with `cancel-in-progress: true`
- **Build Caching**: sccache for Linux, ccache for macOS/Windows with proper cache size limits (30GB sccache, 500Mi ccache)
- **Multi-Python Support**: Builds wheels for Python 3.10, 3.11, 3.12, 3.13
- **OSSF Scorecard Compliance**: All workflows use `permissions: read-all` with minimal escalation
- **Pinned Actions**: Most actions use commit SHAs rather than mutable tags

**Weaknesses**:
- No code coverage generation in any test step
- No merge queue enforcement beyond `merge_group` trigger
- Coverity runs only on schedule, not on PRs

### Test Coverage

**Python Tests** (74 test files):
- **Framework**: pytest with pytest markers (real_models, nightly, samples, llm, whisper, vlm, agent, rag, speech_generation, video_generation)
- **Default Scope**: `addopts = -m "not real_models and not nightly"` — excludes heavy tests by default
- **Test Categories**:
  - LLM pipeline tests (static, dynamic)
  - VLM pipeline tests (multiple models including MiniCPM-o-2_6)
  - Whisper pipeline tests (static, dynamic)
  - Image generation tests
  - Video generation tests
  - Continuous batching tests (including EAGLE3 speculative decoding)
  - Structured output tests
  - Tokenizer tests
  - RAG tests
  - KV cache eviction tests (split into 2 parts for parallelism)
  - GGUF reader tests
  - Sampling tests
  - Text streamer tests
  - Generation config tests
- **Sample Tests** (31 files): Test C++, Python, and JS samples end-to-end by running compiled binaries
- **Who-What-Benchmark Tests** (5 files): CLI tests for the benchmark tool

**C++ Tests** (18 test files):
- **Framework**: Google Test (GTest)
- **Components Tested**: block_allocator, block_hash_store, block_manager, cache_eviction, cache_manager, helper, kvcrush, logger, logit_filtering, parser, sampler, scheduler, sparse_attention, speculative_decoding, add_second_input_pass, cdpruner_dpp, json_container
- **Executed via**: `tests_continuous_batching` binary in CI

**JavaScript Tests** (9 test files):
- **Framework**: Node.js test runner (based on file naming `*.test.js`)
- **Components Tested**: bindings, chatHistory, module, parsers, structuredOutput, textEmbeddingsPipeline, textRerankPipeline, tokenizer, vlmPipeline
- **Lint**: npm run lint in CI

**Test-to-Code Ratio**: ~87 test files / ~404 source files = **0.22** (adequate for a C++ library with Python/JS bindings)

### Code Quality Tools

| Tool | Status | Configuration |
|------|--------|---------------|
| **Pre-commit** | Active | `.pre-commit-config.yaml` — trailing-whitespace, end-of-file-fixer, merge conflict check, private key detection, large file check, YAML/TOML validation, Python AST check |
| **Ruff** (Python formatter) | Active | Via `darker` pre-commit hook with ruff formatting; configured in `pyproject.toml` (line-length=120, target py310) |
| **Clang-format** (C++) | Active | `.clang-format` present in root |
| **Flake8** (Python linter) | Active | Runs in SDL workflow for WWB and LLM bench tools |
| **Bandit** (Python SAST) | Active | Comprehensive config in `bandit.yml` with IPAS-required checkers |
| **ESLint** (JS) | Active | `npm run lint` in Node.js test job |
| **Coverity** (C++ SAST) | Partial | Daily schedule + manual dispatch; not per-PR |
| **CodeQL** | Missing | Not configured |
| **golangci-lint** | N/A | No Go code |

### Container Images

- **Status**: No Dockerfiles/Containerfiles in the repository
- **CI Images**: All CI jobs use pre-built images from `openvinogithubactions.azurecr.io`:
  - `ov_build/ubuntu_22_04_x64:{docker_tag}` for builds
  - `ov_test/ubuntu_22_04_x64:{docker_tag}` for tests
  - `library/python:3.12-slim` for artifact packaging
- **Docker tag**: Pulled from the main OpenVINO repo (`openvino/.github/dockerfiles/docker_tag`)
- **No image scanning of built artifacts**: Trivy scans the filesystem, not built images
- **No multi-arch image builds**: Only x86_64 Linux containers; macOS/Windows use bare runners

### Security Practices

| Practice | Status | Details |
|----------|--------|---------|
| **Trivy (filesystem scan)** | Active | Runs on every PR in `sdl.yml` |
| **Bandit (Python SAST)** | Active | Comprehensive IPAS-required checkers |
| **Coverity (C++ SAST)** | Partial | Daily schedule only, not per-PR |
| **CodeQL** | Missing | Not configured |
| **Dependency Review** | Active | Runs on PRs with license allowlist and vulnerability check |
| **Dependabot** | Active | Daily updates for GitHub Actions, npm, and pip |
| **Secret Detection** | Active | `detect-private-key` in pre-commit hooks |
| **OSSF Permissions** | Active | `permissions: read-all` on all workflows |
| **Action Pinning** | Strong | Most actions pinned to commit SHAs |
| **SBOM Generation** | Missing | No SBOM generation |
| **Image Signing** | Missing | N/A (no images built) |

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **Coverage**: No test types have rules
- **Quality**: N/A
- **Gaps**: Complete absence of AI agent guidance
- **Recommendation**: Generate comprehensive rules with `/test-rules-generator` covering:
  - C++ GTest unit test patterns
  - Python pytest conventions with markers
  - JS test patterns
  - Sample test creation guidelines
  - Integration test patterns for GenAI pipelines

## Recommendations

### Priority 0 (Critical)

1. **Implement code coverage tracking** — Add pytest-cov for Python and gcov/llvm-cov for C++ to generate coverage reports. Integrate with codecov for PR-level reporting and enforce minimum thresholds (e.g., 60% for new code).

2. **Add CodeQL workflow** — Configure `.github/workflows/codeql.yml` for C++ and Python to get free, per-PR SAST analysis. This complements the daily Coverity scans with immediate feedback.

### Priority 1 (High Value)

3. **Create AI agent rules** — Add CLAUDE.md and `.claude/rules/` with comprehensive test creation rules for all three languages (C++, Python, JS). Include framework-specific patterns, marker conventions, and fixture usage.

4. **Add public Dockerfiles** — Create Dockerfiles for build and test environments so contributors can reproduce CI locally without access to the private Azure container registry.

5. **Enable C++ coverage with gcov** — Add `CMAKE_CXX_FLAGS="--coverage"` option and post-process with lcov/gcov to generate C++ coverage reports alongside Python coverage.

### Priority 2 (Nice-to-Have)

6. **Add performance regression testing** — Create benchmarks for inference latency using the existing `llm_bench` tool and track regressions over time.

7. **Add contract tests for API boundaries** — Test Python-C++ binding contracts and JS-C++ binding contracts to catch API drift between language interfaces.

8. **Add fuzz testing** — The parser, tokenizer, and GGUF reader components would benefit from fuzz testing (e.g., libFuzzer for C++, Hypothesis for Python).

9. **Add SBOM generation** — Generate Software Bill of Materials for releases to improve supply chain security visibility.

## Comparison to Gold Standards

| Dimension | openvino.genai | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit Tests | 7.5 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 8.0 | 9.0 | 8.0 | 9.0 |
| Build Integration | 7.0 | 8.0 | 7.0 | 8.0 |
| Image Testing | 3.0 | 7.0 | 9.0 | 7.0 |
| Coverage Tracking | 2.0 | 9.0 | 5.0 | 9.0 |
| CI/CD Automation | 8.5 | 9.0 | 8.0 | 9.0 |
| Agent Rules | 0.0 | 8.0 | 3.0 | 2.0 |
| **Overall** | **7.2** | **8.7** | **7.2** | **8.1** |

**Key Takeaways vs Gold Standards**:
- **Coverage tracking is the biggest gap** — odh-dashboard and kserve both enforce coverage thresholds; openvino.genai has zero coverage visibility
- **CI/CD is near-gold-standard** — Smart CI, sccache, multi-platform, OSSF compliance are all excellent
- **Test breadth is strong** — The diversity of test suites (LLM, VLM, Whisper, Image Gen, Video Gen, RAG) exceeds most comparable projects
- **Agent rules are completely absent** — This is increasingly important as AI-assisted development grows

## File Paths Reference

### CI/CD Configuration
- `.github/workflows/linux.yml` — Main Linux CI (1038 lines)
- `.github/workflows/windows.yml` — Windows CI (1019 lines)
- `.github/workflows/mac.yml` — macOS CI (775 lines)
- `.github/workflows/manylinux_2_28.yml` — Manylinux CI (678 lines)
- `.github/workflows/sdl.yml` — Security/SDL checks
- `.github/workflows/lint.yml` — Pre-commit linting
- `.github/workflows/coverity.yml` — Coverity SAST (daily)
- `.github/dependency_review.yml` — Dependency license/vuln config
- `.github/dependabot.yml` — Automated dependency updates
- `.github/components.yml` — Smart CI component definitions
- `Jenkinsfile` — Jenkins integration (delegates to shared library)

### Test Infrastructure
- `tests/python_tests/` — Python test suite (74 files)
- `tests/python_tests/pytest.ini` — Pytest configuration with markers
- `tests/python_tests/requirements.txt` — Test dependencies
- `tests/python_tests/samples/` — Sample E2E tests (31 files)
- `tests/cpp/` — C++ GTest suite (18 files)
- `src/js/tests/` — JavaScript test suite (9 files)
- `tools/who_what_benchmark/tests/` — WWB CLI tests (5 files)

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks (trailing-whitespace, ruff, private key detection)
- `pyproject.toml` — Ruff config, build config
- `.clang-format` — C++ formatting rules
- `bandit.yml` — Python security analysis configuration

### Source Code
- `src/cpp/` — C++ core library (173 .cpp/.c files)
- `src/python/` — Python bindings (1 file)
- `src/js/` — JavaScript/Node.js bindings (24 .js/.ts files)
- `src/c/` — C API bindings
- `samples/` — Usage samples (C++, Python, JS)
- `tools/` — CLI tools (llm_bench, who_what_benchmark, continuous_batching)
