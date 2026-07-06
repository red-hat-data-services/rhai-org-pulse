---
repository: "opendatahub-io/openvino.genai"
overall_score: 7.1
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Solid C++ gtest and Python pytest suites with good coverage of core components"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Comprehensive model pipeline tests across LLM, VLM, Whisper, image/video generation"
  - dimension: "Build Integration"
    score: 7.0
    status: "Cross-platform PR builds (Linux/Windows/macOS/Manylinux) with Smart CI"
  - dimension: "Image Testing"
    score: 3.0
    status: "No container image builds, runtime validation, or image scanning"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No code coverage collection, reporting, or enforcement whatsoever"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "Mature multi-platform CI with smart skip logic, sccache, concurrency control"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, .claude/ directory, or agent rules present"
critical_gaps:
  - title: "Zero code coverage tracking"
    impact: "No visibility into what code is tested; regressions can silently go untested"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No container image testing or scanning"
    impact: "Library is consumed as pip package but no Dockerfile/image validation pipeline exists"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "No agent rules for AI-assisted test creation"
    impact: "AI agents cannot generate tests that follow project patterns and conventions"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No SAST/CodeQL integration on PRs"
    impact: "Static analysis runs only via scheduled Coverity, not on every PR"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add codecov/coverage integration to CI"
    effort: "4-6 hours"
    impact: "Immediate visibility into test coverage gaps; PR coverage reporting"
  - title: "Add CodeQL GitHub Actions workflow"
    effort: "1-2 hours"
    impact: "Free SAST scanning on every PR for C++ and Python"
  - title: "Create CLAUDE.md and basic agent rules"
    effort: "2-3 hours"
    impact: "Enable AI agents to write tests matching project conventions"
  - title: "Enable ruff linting in pre-commit (not just formatting)"
    effort: "1 hour"
    impact: "Catch Python code quality issues beyond formatting"
recommendations:
  priority_0:
    - "Add code coverage collection (gcov/lcov for C++, pytest-cov for Python) and integrate with Codecov"
    - "Add CodeQL or similar SAST to run on every PR, not just scheduled Coverity scans"
  priority_1:
    - "Create container image Dockerfiles for the library and add image testing to CI"
    - "Add CLAUDE.md and .claude/rules/ with test automation guidance for all test types"
    - "Enable ruff linting rules (not just formatting) in pre-commit and CI"
  priority_2:
    - "Add performance regression testing for inference pipelines"
    - "Create contract tests between Python bindings and C++ core"
    - "Add fuzz testing for parsers and input handling"
---

# Quality Analysis: openvino.genai

## Executive Summary

- **Overall Score: 7.1/10**
- **Repository Type**: C++/Python GenAI library with Node.js bindings
- **Primary Languages**: C++ (378 source files), Python (173 files), JavaScript/TypeScript (20+ files)
- **Framework**: CMake-based C++ library with Python (pybind11) and Node.js bindings
- **License**: Apache-2.0

**Key Strengths**: Mature multi-platform CI/CD with Smart CI for selective testing, comprehensive pytest test suites covering LLM/VLM/Whisper/image generation/video generation pipelines, solid C++ gtest infrastructure, strong security practices with Bandit/Trivy/Coverity/dependency review, well-organized pre-commit hooks, and cross-platform testing on Linux/Windows/macOS.

**Critical Gaps**: Zero code coverage tracking or enforcement, no container image testing, no agent rules for AI-assisted development, no per-PR SAST (only scheduled Coverity), and limited Python linting (only formatting via ruff/darker, no ruff lint rules).

**Agent Rules Status**: Missing - No CLAUDE.md, .claude/ directory, or agent rules present.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | Solid C++ gtest and Python pytest suites |
| Integration/E2E | 8.0/10 | Comprehensive model pipeline tests with Smart CI |
| **Build Integration** | **7.0/10** | **Cross-platform PR builds but no Konflux/container simulation** |
| Image Testing | 3.0/10 | No container images, no runtime validation |
| Coverage Tracking | 1.0/10 | No coverage collection, reporting, or enforcement |
| CI/CD Automation | 8.5/10 | Mature multi-platform CI with smart skip logic |
| Agent Rules | 0.0/10 | No agent rules or AI development guidance |

## Critical Gaps

### 1. Zero Code Coverage Tracking
- **Impact**: No visibility into what percentage of C++ or Python code is tested. Regressions can silently go untested. No way to enforce coverage thresholds on PRs.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: No `gcov`, `lcov`, `pytest-cov`, `codecov.yml`, or `.coveragerc` files found. Neither GitHub Actions workflows nor the Jenkinsfile collect coverage data. This is a significant gap for a library with 378 C++ source files and 173 Python files.

### 2. No Container Image Testing or Scanning
- **Impact**: While the library is primarily consumed as a pip package, there are no Dockerfiles, container builds, or image-level testing. If downstream consumers create images (and they likely do via RHOAI), there is no upstream validation.
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Details**: No Dockerfile, Containerfile, or docker-compose files found in the repository. No image build, push, or scan steps in CI.

### 3. No Agent Rules for AI-Assisted Development
- **Impact**: AI coding agents cannot generate tests or code that follows project patterns and conventions. No guidance for test structure, naming, fixture usage, or marker conventions.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: No `CLAUDE.md`, `AGENTS.md`, `.claude/` directory, or `.claude/rules/` directory. The project has well-defined test patterns (pytest markers, conftest.py fixtures, model caching) that would benefit from being codified in agent rules.

### 4. No Per-PR Static Analysis (SAST)
- **Impact**: Coverity runs on a daily schedule and only on `master`, not on PRs. C++ and Python vulnerabilities may be merged before being caught by the nightly scan.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: Coverity workflow runs on `schedule: cron '0 0 * * *'` and `workflow_dispatch`, plus PR changes to the coverity workflow file itself. No CodeQL or similar tool runs on every PR.

## Quick Wins

### 1. Add Code Coverage to CI (4-6 hours)
- **Impact**: Immediate visibility into test coverage; PR coverage reporting
- **Implementation**:
  - For Python: add `pytest-cov` to test requirements, add `--cov` flags to pytest commands
  - For C++: enable `gcov` via CMake, use `lcov` to generate reports
  - Add Codecov GitHub App and `.codecov.yml` with threshold configuration
  - Upload coverage reports in the existing test jobs

### 2. Add CodeQL to PRs (1-2 hours)
- **Impact**: Free, always-on SAST for C++ and Python on every PR
- **Implementation**:
  ```yaml
  # .github/workflows/codeql.yml
  name: CodeQL
  on: [push, pull_request]
  jobs:
    analyze:
      runs-on: ubuntu-latest
      strategy:
        matrix:
          language: [cpp, python]
      steps:
        - uses: actions/checkout@v4
        - uses: github/codeql-action/init@v3
          with:
            languages: ${{ matrix.language }}
        - uses: github/codeql-action/autobuild@v3
        - uses: github/codeql-action/analyze@v3
  ```

### 3. Create CLAUDE.md and Agent Rules (2-3 hours)
- **Impact**: Enable AI agents to write tests matching project conventions
- **Implementation**: Create `CLAUDE.md` with build/test instructions, `.claude/rules/` with:
  - `unit-tests.md` (gtest patterns for C++, pytest patterns for Python)
  - `e2e-tests.md` (model pipeline testing patterns, fixture usage)
  - `markers.md` (pytest marker conventions: `real_models`, `nightly`, `samples`, etc.)

### 4. Enable Ruff Linting Rules (1 hour)
- **Impact**: Catch Python code quality issues beyond formatting
- **Implementation**: Currently `pyproject.toml` only configures `[tool.ruff.format]`. Add `[tool.ruff.lint]` with `select = ["E", "F", "W", "I"]` at minimum. Pre-commit currently uses `darker` with `--formatter=ruff` but no linting.

## Detailed Findings

### CI/CD Pipeline

**Workflows (13 total, ~3,950 lines of YAML)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `linux.yml` (1,038 lines) | PR, push, merge_group | Full Linux build + test pipeline |
| `windows.yml` (1,019 lines) | PR, push, merge_group | Full Windows build + test pipeline |
| `mac.yml` (775 lines) | PR, push, merge_group | Full macOS build + test pipeline |
| `manylinux_2_28.yml` (678 lines) | PR, push, merge_group | Manylinux compatibility build + tests |
| `coverity.yml` (187 lines) | Schedule (daily), dispatch | Coverity static analysis scan |
| `sdl.yml` (72 lines) | PR, push | Security: Bandit, Trivy, flake8, dependency review |
| `lint.yml` (40 lines) | PR, push | Pre-commit linting on changed files |
| `deploy_gh_pages.yml` (61 lines) | push (master), dispatch | Documentation site deployment |
| `cleanup_caches.yml` (34 lines) | Schedule (weekdays) | OV cache cleanup |
| `assign_issue.yml` (25 lines) | Issue comment | Issue assignment bot |
| `labeler.yml` (21 lines) | PR target | Auto-labeling PRs |

**Strengths**:
- **Smart CI**: Uses OpenVINO's `smart-ci` action to detect affected components and skip irrelevant test suites. This is a sophisticated CI optimization.
- **Concurrency Control**: All major workflows use `concurrency` groups with `cancel-in-progress: true` to prevent redundant runs.
- **Build Caching**: `sccache` (Linux) and `ccache` (macOS/Windows) with generous cache sizes (30G sccache, 500Mi ccache).
- **Cross-Platform**: Full build and test on Linux (Ubuntu 22.04), Windows (VS 2022), macOS 14, and Manylinux 2_28.
- **Artifact Management**: Well-organized artifact upload/download patterns between build and test jobs.
- **Merge Group Support**: All major workflows support merge queue (`merge_group` trigger).

**Gaps**:
- No code coverage collection in any workflow
- No per-PR static analysis (Coverity is schedule-only)
- Docs-only skip logic may be too aggressive (skips on `*.md` changes)

### Test Coverage

**Python Tests (51 test files, ~9,146 lines)**:
- Framework: `pytest 9.0.2` with custom markers and conftest.py
- Test categories via pytest markers:
  - `llm`, `whisper`, `vlm`, `rag`, `agent` - Model type tests
  - `dreamlike_anime_1_0`, `LCM_Dreamshaper_v7_int8_ov` - Image gen tests
  - `speech_generation`, `video_generation` - Media gen tests
  - `samples` - Sample code tests
  - `real_models` - Tests requiring real model downloads (excluded by default)
  - `nightly` - Long-running tests (excluded by default)
- Test-to-code ratio: ~51 test files / 173 Python source files = 0.29
- Fixtures: Session-scoped model caching, automatic GC after each module
- Good parametrization usage with `@pytest.mark.parametrize`

**C++ Tests (18 test files, ~6,521 lines)**:
- Framework: Google Test (gtest/gmock) via FetchContent
- Tests focus on continuous batching internals: block allocator, block manager, cache eviction, scheduler, sampler, logit filtering, parser, KV crush, sparse attention, speculative decoding
- Test binary: `tests_continuous_batching`
- Integrated into CI via gtests step in Linux workflow

**Node.js Tests (8 test files)**:
- Tests for bindings, module, tokenizer, parsers, chat history, structured output, text embeddings, VLM pipeline
- Runs in dedicated `genai_nodejs_tests` CI job

**Sample Tests (20+ test files)**:
- Tests that validate sample applications work correctly
- Cover LLM, Whisper, image generation, VLM, video, speech, RAG, benchmarking samples
- Run with `samples` marker

**Strengths**:
- Wide scenario coverage: LLM, VLM, Whisper, image generation, video generation, RAG, structured output, speculative decoding
- Well-organized pytest markers for selective test execution
- Model caching to avoid re-downloading in CI
- Memory-conscious testing (GC after each module, runner size tuning)

**Gaps**:
- No coverage measurement for any language
- No integration tests for Python↔C++ binding boundary behavior
- Some test timeouts are very high (360 minutes for GGUF tests, 180 for cache eviction)
- `real_models` and `nightly` markers exclude tests by default with no periodic run

### Code Quality

**Linting & Formatting**:
- **Pre-commit** (`.pre-commit-config.yaml`):
  - `pre-commit-hooks`: trailing whitespace, EOF fixer, merge conflict check, private key detection, YAML/TOML/AST checks, large file check (1MB)
  - `darker` with `ruff` formatter: incremental Python formatting on changed lines
  - Excludes `.pyi` files
- **C++**: `.clang-format` (Google style, 120 column limit, 4-space indent)
- **Python**: `ruff` configured in `pyproject.toml` for formatting only (no lint rules configured)
- **Flake8**: Used in SDL workflow via `setup.cfg` for `who_what_benchmark` and `llm_bench` tools
- **ESLint**: `eslint.config.cjs` present for Node.js bindings

**Static Analysis**:
- **Coverity**: Daily scheduled scan on Linux (build + analysis), comprehensive C++ static analysis
- **Bandit**: Python security linter run in SDL workflow with extensive configuration (`bandit.yml`)
- **Trivy**: Filesystem vulnerability scan in SDL workflow
- **Dependency Review**: License and vulnerability checks on PR dependencies

**Gaps**:
- Ruff lint rules not enabled (only formatting)
- No clang-tidy for C++ static analysis (`.clang-tidy` not present)
- Coverity not run on PRs (only scheduled/dispatch)
- No CodeQL integration

### Container Images

**Status**: No container images in this repository.

- No `Dockerfile`, `Containerfile`, or `docker-compose.yml` found
- No image build or push steps in CI
- No image scanning or runtime validation
- The library is consumed as pip/npm packages, not container images
- Docker images used in CI are from `openvinogithubactions.azurecr.io` (build/test infra, not product images)

**Note**: While this is a library (not a deployable service), downstream consumers like RHOAI may containerize it. Providing a reference Dockerfile and testing it would add value.

### Security

**Strengths**:
- **Bandit**: Comprehensive Python security scanning with IPAS-required checkers, custom configuration, thirdparty exclusions
- **Trivy**: Filesystem vulnerability scanning on every PR and push
- **Dependency Review**: License allowlist (`MIT`, `Apache-2.0`, `BSD-*`, etc.) and vulnerability check for runtime and development dependencies. Fail-on-severity set to `low`.
- **Coverity**: Industry-leading C++ static analysis (schedule-only)
- **SECURITY.md**: Directs vulnerability reports to Intel Security Center
- **Permissions**: `permissions: read-all` on all workflows (OSSF Scorecard compliance)
- **Pre-commit**: `detect-private-key` hook enabled
- **Pinned Actions**: Most GitHub Actions are pinned to commit SHAs

**Gaps**:
- No CodeQL for C++ on PRs
- Coverity not triggered on PRs (only detects issues post-merge)
- No SBOM generation
- No image signing/attestation (no images to sign)
- No secret scanning tool (Gitleaks/TruffleHog) beyond pre-commit private key detection

### Agent Rules (Agentic Flow Quality)

**Status**: Missing

- No `CLAUDE.md` or `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` with test creation rules
- No `.claude/skills/` with custom skills
- No test documentation beyond the pytest README

**Coverage**: None - no agent rules for any test type

**Quality**: N/A

**Gaps**:
- Missing unit test rules (gtest patterns for C++, pytest patterns for Python)
- Missing integration test rules (model pipeline testing patterns)
- Missing sample test rules (sample validation patterns)
- Missing marker/fixture conventions documentation
- Missing build/test instructions for agents

**Recommendation**: Generate comprehensive agent rules using `/test-rules-generator`. Key patterns to document:
- pytest marker system (`real_models`, `nightly`, `samples`, `llm`, etc.)
- Model caching strategy (OV_CACHE, HF_HOME, conftest.py fixtures)
- C++ gtest patterns for continuous batching internals
- Node.js test patterns with model download and binding validation

## Recommendations

### Priority 0 (Critical)

1. **Add code coverage collection and reporting**
   - Add `pytest-cov` for Python tests, `gcov/lcov` for C++ tests
   - Integrate with Codecov or Coveralls
   - Set minimum coverage thresholds (start at current level, ratchet up)
   - Add coverage comments to PRs

2. **Add CodeQL or equivalent SAST to PR workflow**
   - Enable for C++ and Python languages
   - Complement existing Coverity (which only runs nightly)
   - Catch security issues before merge, not after

### Priority 1 (High Value)

3. **Create comprehensive agent rules**
   - Add `CLAUDE.md` with build, test, and contribution instructions
   - Create `.claude/rules/` with per-test-type rules
   - Document pytest marker conventions and fixture patterns
   - Include C++ gtest patterns and CMake test integration

4. **Enable ruff linting rules**
   - Add `[tool.ruff.lint]` section to `pyproject.toml`
   - Enable at minimum: `E` (pycodestyle errors), `F` (pyflakes), `I` (import sorting)
   - Consider: `UP` (pyupgrade), `B` (bugbear), `SIM` (simplifications)

5. **Add clang-tidy for C++ static analysis**
   - Create `.clang-tidy` configuration
   - Add to pre-commit or CI workflow
   - Focus on modernization and safety checks

### Priority 2 (Nice-to-Have)

6. **Add performance regression testing**
   - Track inference latency for key pipelines (LLM, Whisper, image gen)
   - Alert on significant performance regressions in PRs
   - Use existing `llm_bench` tool infrastructure

7. **Create contract tests for bindings**
   - Test Python↔C++ binding boundary behavior
   - Test Node.js↔C++ binding boundary behavior
   - Ensure API compatibility across language boundaries

8. **Add fuzz testing for parsers and input handling**
   - The codebase has parsers (grammar, structured output) that handle user input
   - `AFL++` or `libFuzzer` for C++ parsers
   - `hypothesis` for Python input handling

9. **Add reference Dockerfile**
   - Even as a library, a reference container would help downstream consumers
   - Test with multi-architecture builds (x86_64, ARM64)

## Comparison to Gold Standards

| Dimension | openvino.genai | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit Tests | 7.5 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 8.0 | 9.0 | 8.0 | 9.0 |
| Build Integration | 7.0 | 8.0 | 7.0 | 8.0 |
| Image Testing | 3.0 | 7.0 | 9.0 | 8.0 |
| Coverage Tracking | 1.0 | 8.0 | 5.0 | 9.0 |
| CI/CD Automation | 8.5 | 9.0 | 8.0 | 8.5 |
| Agent Rules | 0.0 | 7.0 | 2.0 | 1.0 |
| **Overall** | **7.1** | **8.5** | **7.0** | **8.2** |

**Key Differentiators**:
- openvino.genai excels at cross-platform CI (Linux/Win/Mac/Manylinux) — stronger than most comparables
- Smart CI component detection is sophisticated and rare in the ecosystem
- Security tooling (Bandit+Trivy+Coverity+dependency review) is above average
- The critical gap is coverage tracking — nearly all comparable repos have this
- Agent rules gap is common across the ecosystem but easy to close

## File Paths Reference

### CI/CD
- `.github/workflows/linux.yml` — Main Linux CI pipeline (1,038 lines)
- `.github/workflows/windows.yml` — Windows CI pipeline (1,019 lines)
- `.github/workflows/mac.yml` — macOS CI pipeline (775 lines)
- `.github/workflows/manylinux_2_28.yml` — Manylinux CI pipeline (678 lines)
- `.github/workflows/coverity.yml` — Coverity static analysis (187 lines)
- `.github/workflows/sdl.yml` — Security/SDL tests (72 lines)
- `.github/workflows/lint.yml` — Pre-commit linting (40 lines)
- `Jenkinsfile` — Jenkins pipeline (shared library)

### Testing
- `tests/python_tests/` — Python test suite (51 test files, 9,146 lines)
- `tests/python_tests/pytest.ini` — Pytest configuration with markers
- `tests/python_tests/conftest.py` — Session fixtures, model caching
- `tests/cpp/` — C++ gtest suite (18 files, 6,521 lines)
- `tests/cpp/CMakeLists.txt` — gtest build configuration
- `src/js/tests/` — Node.js binding tests (8 files)
- `tools/who_what_benchmark/tests/` — WWB tool tests (5 files)

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks configuration
- `.clang-format` — C++ formatting rules (Google-based)
- `pyproject.toml` — Python project config, ruff formatter config
- `bandit.yml` — Bandit security linter configuration
- `.github/dependency_review.yml` — Dependency license/vulnerability policy
- `src/js/eslint.config.cjs` — JavaScript ESLint configuration

### Build
- `CMakeLists.txt` — Root CMake configuration
- `cmake/features.cmake` — Feature toggles (ENABLE_TESTS, etc.)
- `requirements-build.txt` — Python build requirements
