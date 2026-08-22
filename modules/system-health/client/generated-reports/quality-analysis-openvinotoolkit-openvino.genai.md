---
repository: "openvinotoolkit/openvino.genai"
overall_score: 6.5
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Solid Python/C++/JS test suites with pytest, GTest, and Jest; good coverage of model pipelines"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "Cross-platform CI with Linux/Mac/Windows matrix; sample tests exercise full inference pipelines"
  - dimension: "Build Integration"
    score: 6.0
    status: "CMake builds validated on PR; no container image or Konflux simulation"
  - dimension: "Image Testing"
    score: 2.0
    status: "No Dockerfiles, no container images built or tested"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tooling configured; no thresholds or reporting"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "Excellent multi-platform CI with Smart CI, sccache, matrix strategies, and concurrency control"
  - dimension: "Static Analysis"
    score: 8.0
    status: "Strong: pre-commit hooks, ruff, flake8, bandit, clang-format, ESLint, Dependabot, Coverity, dependency review"
  - dimension: "Agent Rules"
    score: 7.0
    status: "Copilot instructions, 2 agents, 6 skills; no CLAUDE.md or test-creation-specific rules"
critical_gaps:
  - title: "No code coverage tracking or enforcement"
    impact: "Coverage regressions go undetected; no visibility into untested code paths"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No container image builds or testing"
    impact: "Library is consumed as wheels/packages but no containerized validation exists for deployment scenarios"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "No test-creation agent rules"
    impact: "AI agents generating tests lack guidance on framework conventions and quality gates"
    severity: "MEDIUM"
    effort: "3-4 hours"
  - title: "MD5 usage in benchmarking tools"
    impact: "Non-FIPS-compliant hash function used for image/audio fingerprinting in llm_bench tool"
    severity: "LOW"
    effort: "1-2 hours"
quick_wins:
  - title: "Add pytest-cov and coverage reporting to CI"
    effort: "2-4 hours"
    impact: "Immediate visibility into test coverage with PR comments and trend tracking"
  - title: "Create CLAUDE.md with test-creation rules"
    effort: "2-3 hours"
    impact: "Consistent AI-generated tests matching project conventions (pytest markers, GTest patterns)"
  - title: "Replace hashlib.md5 with hashlib.sha256 in llm_bench"
    effort: "30 minutes"
    impact: "FIPS compliance for benchmarking tool fingerprints"
  - title: "Add coverage badge to README"
    effort: "30 minutes"
    impact: "Public visibility into project quality metrics"
recommendations:
  priority_0:
    - "Add pytest-cov coverage collection and Codecov integration with threshold enforcement"
    - "Add gcov/lcov coverage for C++ tests and integrate into CI reporting"
  priority_1:
    - "Create CLAUDE.md with comprehensive test-creation rules for pytest, GTest, and Jest"
    - "Add container image builds for deployment validation scenarios"
    - "Replace MD5 usage with SHA-256 in benchmarking tools for FIPS compliance"
    - "Add coverage thresholds to block PRs that reduce coverage"
  priority_2:
    - "Add performance regression benchmarks in CI with historical tracking"
    - "Create Dockerfile for reproducible development environment"
    - "Add test-creation-specific agent rules in .claude/rules/"
---

# Quality Analysis: openvinotoolkit/openvino.genai

## Executive Summary
- Overall Score: 6.5/10
- Key Strengths: Exceptional CI/CD automation with Smart CI, multi-platform testing (Linux/macOS/Windows), comprehensive static analysis (Coverity, Bandit, pre-commit, clang-format), well-configured Dependabot, and emerging AI agent infrastructure (Copilot instructions, skills, agents)
- Critical Gaps: Zero code coverage tracking, no container image testing, missing test-creation agent rules
- Agent Rules Status: Partial (Copilot instructions present, no CLAUDE.md, no test-specific rules)

## Quality Scorecard
| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 7/10 | 15% | Solid Python/C++/JS test suites with pytest, GTest, and Jest |
| Integration/E2E | 7/10 | 20% | Cross-platform CI with sample-level integration tests |
| Build Integration | 6/10 | 15% | CMake builds validated on PR; no container or Konflux simulation |
| Image Testing | 2/10 | 10% | No Dockerfiles or container images built or tested |
| Coverage Tracking | 1/10 | 10% | No coverage tooling configured |
| CI/CD Automation | 9/10 | 15% | Excellent multi-platform CI with Smart CI and sccache |
| Static Analysis | 8/10 | 10% | Strong: pre-commit, ruff, flake8, bandit, Coverity, Dependabot |
| Agent Rules | 7/10 | 5% | Copilot instructions + 2 agents + 6 skills; no CLAUDE.md |

## Critical Gaps

1. **No code coverage tracking or enforcement**
   - Impact: Coverage regressions go undetected; no visibility into untested code paths across Python, C++, or JS
   - Severity: HIGH
   - Effort: 4-8 hours
   - Details: No `.codecov.yml`, no `pytest-cov`, no `gcov`/`lcov`, no coverage thresholds anywhere in CI

2. **No container image builds or testing**
   - Impact: No Dockerfiles exist; containerized deployment scenarios are untested
   - Severity: MEDIUM
   - Effort: 8-12 hours
   - Details: The library is distributed as Python wheels and npm packages, but many downstream consumers (e.g., openvino_model_server) deploy in containers. No image validation exists.

3. **No test-creation agent rules**
   - Impact: AI agents generating tests lack guidance on pytest markers, GTest patterns, conftest fixtures, and quality gates
   - Severity: MEDIUM
   - Effort: 3-4 hours
   - Details: Copilot instructions cover code review and coding style but not test creation patterns

4. **MD5 usage in benchmarking tools**
   - Impact: `hashlib.md5` used in `tools/llm_bench/` for image/audio fingerprinting is not FIPS-compliant
   - Severity: LOW
   - Effort: 1-2 hours
   - Details: 5 instances in `tools/llm_bench/task/` using `hashlib.md5(..., usedforsecurity=False)` — the `usedforsecurity=False` flag is present (Python 3.9+ FIPS-mode workaround) but replacing with SHA-256 is cleaner

## Quick Wins

1. **Add pytest-cov and coverage reporting to CI**
   - Effort: 2-4 hours
   - Impact: Immediate visibility into test coverage with PR comments
   - Implementation:
   ```yaml
   # In .github/workflows/linux.yml test steps:
   - name: Run tests with coverage
     run: python -m pytest -v --cov=openvino_genai --cov-report=xml tests/python_tests/
   - name: Upload coverage
     uses: codecov/codecov-action@v5
     with:
       files: coverage.xml
       fail_ci_if_error: false
   ```

2. **Create CLAUDE.md with test-creation rules**
   - Effort: 2-3 hours
   - Impact: Consistent AI-generated tests matching project conventions
   - Implementation: See Agent Rules section below

3. **Replace hashlib.md5 with hashlib.sha256 in llm_bench**
   - Effort: 30 minutes
   - Impact: FIPS compliance for benchmarking fingerprints
   - Implementation:
   ```python
   # Before:
   hashlib.md5(data.tobytes(), usedforsecurity=False).hexdigest()
   # After:
   hashlib.sha256(data.tobytes()).hexdigest()
   ```

4. **Add coverage badge to README**
   - Effort: 30 minutes
   - Impact: Public quality signal once Codecov is configured

## Detailed Findings

### Unit Tests (7/10)

**Repository Type:** C++/Python/JavaScript library for generative AI inference with OpenVINO

**Test File Inventory:**
- Python test files: 75 (in `tests/python_tests/` and `tools/who_what_benchmark/tests/`)
- C++ test files: 31 (in `tests/cpp/`, using Google Test framework)
- JavaScript test files: 16 (in `src/js/tests/`, using Jest-style `.test.js`)
- Total test files: 122

**Source File Inventory:**
- Python source files: 169
- C++ source files: 309 (`.cpp`)
- C++ header files: 285 (`.hpp`/`.h`)
- JavaScript/TypeScript files: 52

**Test-to-Source Ratios:**
- Python: 75/169 = 44% (Good)
- C++: 31/594 = 5% (Low — but C++ tests are integration-heavy and test deep runtime behavior)
- JavaScript: 16/52 = 31% (Adequate)

**Frameworks:**
- Python: pytest with custom markers (`real_models`, `nightly`, `llm`, `vlm`, `whisper`, etc.)
- C++: Google Test + Google Mock via FetchContent
- JavaScript: Jest/Node test runner (`npm test`)

**Strengths:**
- Well-organized pytest configuration with `pytest.ini` defining 15+ custom markers
- Conftest fixtures handle model caching, directory setup/teardown, and test parameterization
- C++ tests cover critical internal components: block allocator, cache manager, scheduler, sampler, logit filtering, speculative decoding
- Python tests cover full pipeline scenarios: LLM, VLM, Whisper, image generation, video generation, RAG, structured output, continuous batching
- Sample tests in `tests/python_tests/samples/` validate all code samples work correctly
- Tool tests in `tools/who_what_benchmark/tests/` cover CLI scenarios

**Gaps:**
- No `t.Parallel()` equivalent for C++ tests (sequential execution)
- Python test-to-source ratio is good but not tracked via coverage tools
- No test helpers/utilities package for common setup patterns

### Integration/E2E Tests (7/10)

**Strengths:**
- **Multi-platform testing**: Full CI runs on Linux (Ubuntu 22.04), macOS 14, Windows (VS 2022), and Manylinux 2.28
- **Multi-Python-version testing**: Matrix across Python 3.10, 3.11, 3.12, 3.13
- **Multi-Node.js-version testing**: Matrix across Node.js 22, 24, 26
- **Smart CI**: Intelligent component detection skips unaffected test suites based on changed files
- **Sample integration tests**: All code samples (`samples/python/`, `samples/cpp/`, `samples/js/`) have corresponding test wrappers ensuring they work end-to-end
- **Build matrix for C++**: Both Release and Debug builds tested via CMake matrix strategy
- **Comprehensive model pipeline testing**: Tests exercise real model inference pipelines (LLM, VLM, Whisper, image gen, etc.)

**Test Isolation:**
- Tests use a session-scoped fixture for cache directory management
- Atomic download manager prevents race conditions in parallel model downloads
- Cache cleanup is configurable via `CLEANUP_CACHE` environment variable

**Gaps:**
- No explicit E2E directory — integration tests are mixed with unit tests in `tests/python_tests/`
- No contract tests for API boundaries between C++, Python bindings, and JS bindings
- No chaos or resilience testing
- No performance regression benchmarks in CI

### Build Integration (6/10)

**Strengths:**
- CMake builds are validated on every PR across multiple platforms
- Build matrix covers Release and Debug configurations
- sccache (build cache) configured with 30GB Azure-backed cache for fast rebuilds
- Both CMake-based builds and Python wheel builds are validated
- Wheel builds tested separately with `pip install` verification
- Node.js bindings build and package validated
- Smart CI skips irrelevant builds based on changed components

**Build Validation Steps:**
- `cmake --build` with `--parallel $(nproc)`
- `pip install` of built wheels
- `npm pack` and `npm install` for Node.js bindings
- Sample compilation against installed libraries

**Gaps:**
- No container image builds (no Dockerfile exists)
- No Konflux build simulation
- No operator/deployment manifest validation (not applicable — this is a library, not an operator)
- No cross-component build validation beyond the CMake project

### Image Testing (2/10)

**Current State:**
- No `Dockerfile` or `Containerfile` in the repository
- No container image builds in CI
- No container runtime validation
- No multi-architecture image builds

**Context:**
This is a C++/Python library, not a deployable service. Container images are built by downstream consumers (e.g., `openvinotoolkit/model_server`). However, having a development/CI Dockerfile would improve reproducibility.

**Recommendations:**
1. Create a development Dockerfile for reproducible build environment
2. Consider adding a test Dockerfile that validates the wheel installation in a clean container

### Coverage Tracking (1/10)

**Current State:**
- No `.codecov.yml` or `codecov.yml`
- No `pytest-cov` usage in any CI workflow
- No `gcov`/`lcov` for C++ coverage
- No `--coverage` flag for JavaScript tests
- No coverage thresholds anywhere
- No coverage reporting on PRs
- No coverage badges

**Impact:**
- Cannot identify untested code paths
- Coverage regressions are invisible
- No quality gate on test adequacy

**Recommendations:**

1. **Add Python coverage collection:**
   ```yaml
   # .codecov.yml
   coverage:
     status:
       project:
         default:
           target: 60%
           threshold: 2%
       patch:
         default:
           target: 50%
   ```

2. **Add pytest-cov to test runs:**
   ```bash
   python -m pytest -v --cov=openvino_genai --cov-report=xml tests/python_tests/
   ```

3. **Add C++ coverage (gcov/lcov):**
   ```cmake
   # Add coverage build type
   set(CMAKE_CXX_FLAGS_COVERAGE "-g -O0 --coverage -fprofile-arcs -ftest-coverage")
   ```

4. **Add Codecov upload step:**
   ```yaml
   - name: Upload coverage
     uses: codecov/codecov-action@v5
     with:
       files: coverage.xml,coverage.info
       fail_ci_if_error: false
       flags: unittests
   ```

### CI/CD Automation (9/10)

**Status: Excellent**

**Workflow Inventory (18 workflows):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `linux.yml` (1263 lines) | PR, push, merge_group | Full Linux CI: build + test |
| `windows.yml` (1240 lines) | PR, push | Full Windows CI: build + test |
| `mac.yml` (853 lines) | PR, push | Full macOS CI: build + test |
| `manylinux_2_28.yml` (852 lines) | PR, push | Manylinux wheel builds + tests |
| `lint.yml` | PR, push | Pre-commit lint on changed files |
| `sdl.yml` | PR, push | Security: flake8, bandit, Trivy, dependency review |
| `coverity.yml` | Daily schedule, dispatch | Coverity static analysis scan |
| `ci-doctor.lock.yml` | Dispatch, activation | AI-powered CI failure investigation |
| `workflow_rerunner.yml` | PR | Auto-rerun workflows with known transient errors |
| `labeler.yml` | PR | Auto-label PRs based on changed files |
| `assign_issue.yml` | Issue comment | Self-assign issues via comment |
| `stale.yml` | Weekly schedule | Mark and close stale PRs |
| `cleanup_caches.yml` | Weekday schedule | Clean up CI caches |
| `deploy_gh_pages.yml` | Push to master | Deploy documentation site |
| `copilot-setup-steps.yml` | Push, dispatch | Set up Copilot coding agent environment |

**Strengths:**
- **Smart CI**: Detects affected components from PR changes and skips irrelevant test suites — avoids running full 1263-line workflow for documentation-only changes
- **sccache**: Azure-backed 30GB build cache dramatically reduces C++ compile times
- **Concurrency control**: All major workflows use `concurrency` groups with `cancel-in-progress: true`
- **Timeout enforcement**: All jobs have `timeout-minutes` configured (45 timeout occurrences across 4 major workflows)
- **Matrix strategies**: 18 matrix configurations across workflows covering multiple Python versions, build types, Node.js versions, and model test groups
- **Workflow rerunner**: Automatically retries CI runs that fail due to known transient errors
- **CI failure doctor**: AI-powered agent that investigates CI failures (Agentic Workflows integration)
- **Jenkinsfile**: Also maintains a Jenkins pipeline for internal CI

**Gaps:**
- No workflow status badges in README
- No explicit test parallelization at the pytest level (relies on separate matrix jobs)

### Static Analysis (8/10)

#### Linting

**Strengths:**
- **Pre-commit hooks** (`.pre-commit-config.yaml`):
  - `pre-commit-hooks`: trailing whitespace, end-of-file-fixer, merge conflict check, case conflict, symlink check, private key detection, mixed line endings, AST check, YAML/JSON/TOML validation, large file check (1MB limit)
  - `darker` (v3.0.0): Incremental Python formatter using ruff
- **clang-format**: Google-based style with project customizations for C++ code
- **ruff**: Configured in `pyproject.toml` (line-length: 120, target: py310)
- **flake8**: Used in SDL workflow for `who_what_benchmark` and `llm_bench` tools
- **ESLint**: Configured for both documentation site (TypeScript + React + Docusaurus) and Node.js bindings
- **bandit**: Security linting for Python code with comprehensive checker list (B301-B413)
- **Lint workflow**: Runs pre-commit on changed files for every PR

**Linter Coverage:**
| Language | Linter | Enforced in CI |
|----------|--------|----------------|
| Python | ruff (formatter), flake8 (linting), bandit (security) | Yes |
| C++ | clang-format | Yes (via pre-commit) |
| JavaScript/TypeScript | ESLint | Yes (via pre-commit) |
| YAML/JSON/TOML | pre-commit validators | Yes |

#### FIPS Compatibility

**Status: Minor Issues (Low Risk)**

**Source Code Scan:**
- 5 instances of `hashlib.md5` found in `tools/llm_bench/task/`:
  - `image_generation.py:109` and `:175`
  - `text_to_speech_generation.py:93` and `:198`
  - `super_resolution_generation.py:44`
- All uses include `usedforsecurity=False` flag (Python 3.9+ FIPS workaround)
- Used for benchmark result fingerprinting, not cryptographic security

**Build Configuration:**
- No FIPS build tags (not applicable — this is not a Go project)
- No FIPS-specific build modes
- No FIPS-certified base images (no containers built)

**Assessment:** MD5 usage is low-risk given the `usedforsecurity=False` flag and non-security context, but replacing with SHA-256 is a trivial improvement for FIPS compliance.

#### Dependency Alerts

**Status: Excellent**

**Dependabot** (`.github/dependabot.yml`):
- `github-actions`: Daily updates, grouped
- `npm` (site + install_wheel): Daily updates, grouped
- `npm` (src/js + samples/js): Daily updates, lockfile-only strategy, grouped
- `pip` (root + 4 subdirectories): Daily updates, grouped, with well-documented ignore list for incompatible packages

**Dependency Review** (`.github/dependency_review.yml`):
- Configured with `fail-on-severity: "low"`
- License allowlist: BSD-2/3, MIT, Apache-2.0, ISC, etc.
- Vulnerability and license checks enabled on PRs
- Uses `actions/dependency-review-action@v5`

**Assessment:** Best-in-class dependency management with daily Dependabot updates across all ecosystems (pip, npm, github-actions) and strict PR-time dependency review.

### Agent Rules (7/10)

**Current State:**

| Asset | Status |
|-------|--------|
| `CLAUDE.md` | Missing |
| `AGENTS.md` | Missing |
| `.claude/` directory | Missing |
| `.github/copilot-instructions.md` | Present (comprehensive) |
| `.github/agents/` | 2 agents: model-analysis, model-enabler |
| `.github/skills/` | 6 skills: llm-bench-fail-analyzer, model-checker, open-pr, update-docs, vlm-model-enabler, wwb-fail-analyzer |

**What's Good:**
- **Copilot instructions** are comprehensive: 19 coding guidelines covering C++ best practices, performance, formatting, testing expectations, and PR review protocol
- **Model-analysis agent** performs structured, factual model analysis with a detailed multi-step procedure
- **Model-enabler agent** guides VLM model enablement with architecture-specific knowledge
- **6 custom skills** for common workflows: benchmark failure analysis, model validation, PR creation, docs updates, VLM enablement, and who-what-benchmark analysis
- Testing is mentioned in copilot instructions: "Extend sample and functional tests with `tiny-random` model when a new model architecture is added" and "Ensure new samples have corresponding tests"

**Gaps:**
- No `CLAUDE.md` — Claude Code agents have no project-specific guidance
- No test-creation-specific rules (e.g., pytest markers to use, conftest fixtures available, GTest patterns)
- No `.claude/rules/` directory for structured test automation guidance
- Copilot instructions focus on code review and coding style, not test generation patterns

**Recommendations:**

1. **Create `CLAUDE.md` with project-specific guidance:**
   ```markdown
   # CLAUDE.md - OpenVINO GenAI

   ## Project Structure
   - `src/cpp/`: Core C++ library (ov::genai namespace)
   - `src/python/`: Python pybind11 bindings
   - `src/js/`: Node.js N-API bindings
   - `tests/python_tests/`: Python tests (pytest)
   - `tests/cpp/`: C++ tests (Google Test)
   - `src/js/tests/`: JavaScript tests

   ## Testing Conventions

   ### Python Tests
   - Use pytest with markers defined in `tests/python_tests/pytest.ini`
   - Available markers: real_models, nightly, llm, vlm, whisper, agent, rag, etc.
   - Default: tests NOT marked `real_models` or `nightly` run by default
   - Use conftest fixtures from `tests/python_tests/conftest.py` for model caching
   - Use `tiny-random` models for new architecture tests

   ### C++ Tests
   - Use Google Test (GTest) + Google Mock
   - Place tests in `tests/cpp/`
   - Use `OPENVINO_ASSERT` for runtime checks, not `if + throw`

   ### JavaScript Tests
   - Use `.test.js` pattern in `src/js/tests/`
   - Run via `npm test`

   ## Quality Gates
   - All PRs must pass: lint, SDL tests, platform CI (Linux/Mac/Windows)
   - Pre-commit hooks enforced via CI
   - Follow C++ Core Guidelines (see .github/copilot-instructions.md)
   ```

2. **Generate test rules with /test-rules-generator:**
   ```bash
   /test-rules-generator https://github.com/openvinotoolkit/openvino.genai
   ```

## Recommendations

### Priority 0 (Critical)
- **Add pytest-cov coverage collection and Codecov integration** with minimum 60% project target and 50% patch target
- **Add gcov/lcov coverage for C++ tests** and integrate into CI reporting alongside Python coverage

### Priority 1 (High Value)
- **Create CLAUDE.md** with comprehensive project structure, testing conventions, and quality gates
- **Add test-creation agent rules** in `.claude/rules/` covering pytest markers, GTest patterns, and JS test conventions
- **Replace MD5 usage with SHA-256** in `tools/llm_bench/task/` for FIPS compliance
- **Add coverage thresholds** to block PRs that reduce coverage below project minimum

### Priority 2 (Nice-to-Have)
- Add performance regression benchmarks in CI with historical tracking
- Create a development Dockerfile for reproducible build environments
- Add contract tests for API boundaries between C++, Python, and JS bindings
- Add workflow status badges to README

## Comparison to Gold Standards

| Dimension | openvino.genai | odh-dashboard | notebooks | Gap |
|-----------|---------------|---------------|-----------|-----|
| Unit Tests | 7/10 | 9/10 | 8/10 | -2 (Add coverage tracking, test utilities) |
| Integration/E2E | 7/10 | 10/10 | 7/10 | -3 (Add contract tests, explicit E2E directory) |
| Build Integration | 6/10 | 9/10 | 8/10 | -3 (No container builds — library, not operator) |
| Image Testing | 2/10 | 7/10 | 10/10 | -8 (No containers — not core to library distribution) |
| Coverage Tracking | 1/10 | 9/10 | 8/10 | -8 (Critical: no coverage tooling at all) |
| CI/CD Automation | 9/10 | 9/10 | 8/10 | 0 (Excellent — Smart CI is best-in-class) |
| Static Analysis | 8/10 | 9/10 | 8/10 | -1 (Very strong; minor FIPS gap) |
| Agent Rules | 7/10 | 8/10 | 6/10 | -1 (Good Copilot/agent setup; missing CLAUDE.md) |

**Key Takeaways:**
- **Biggest gap**: Coverage Tracking (1/10) — zero coverage tooling is the most impactful improvement area
- **Biggest strength**: CI/CD Automation (9/10) — Smart CI, sccache, multi-platform matrix, workflow rerunner, and AI-powered CI failure doctor are best-in-class
- **Context matters**: Image Testing score (2/10) reflects library nature — this is not a deployable service. The gap is less critical than for operator/server projects.
- **Agent rules are ahead of most repos**: Copilot instructions + 2 agents + 6 skills is strong infrastructure; adding CLAUDE.md and test-specific rules would complete the picture

## File Paths Reference

### CI/CD
- `.github/workflows/linux.yml` - Main Linux CI (1263 lines)
- `.github/workflows/windows.yml` - Windows CI (1240 lines)
- `.github/workflows/mac.yml` - macOS CI (853 lines)
- `.github/workflows/manylinux_2_28.yml` - Manylinux wheel builds (852 lines)
- `.github/workflows/lint.yml` - Pre-commit lint workflow
- `.github/workflows/sdl.yml` - Security testing (flake8, bandit, Trivy, dependency review)
- `.github/workflows/coverity.yml` - Coverity static analysis (daily)
- `.github/workflows/ci-doctor.lock.yml` - AI CI failure investigation
- `.github/workflows/workflow_rerunner.yml` - Auto-retry for transient failures
- `Jenkinsfile` - Internal Jenkins pipeline

### Testing
- `tests/python_tests/` - Python test suite (75 files)
- `tests/python_tests/pytest.ini` - pytest configuration with 15+ custom markers
- `tests/python_tests/conftest.py` - Session fixtures for model caching
- `tests/cpp/` - C++ GTest suite (31 files)
- `tests/cpp/CMakeLists.txt` - GTest + GMock via FetchContent
- `src/js/tests/` - JavaScript test suite (16 files)
- `tools/who_what_benchmark/tests/` - Tool-specific tests

### Static Analysis
- `.pre-commit-config.yaml` - Pre-commit hooks (pre-commit-hooks, darker/ruff)
- `.clang-format` - C++ formatting rules (Google-based)
- `pyproject.toml` - ruff configuration
- `bandit.yml` - Python security linting configuration
- `.github/dependabot.yml` - Dependency update automation (pip, npm, github-actions)
- `.github/dependency_review.yml` - PR dependency review (license + vulnerability)
- `site/eslint.config.mjs` - Documentation site ESLint
- `src/js/eslint.config.cjs` - Node.js bindings ESLint

### Agent Rules
- `.github/copilot-instructions.md` - Comprehensive coding and review guidelines
- `.github/agents/model-analysis.agent.md` - Model analysis agent
- `.github/agents/model-enabler.agent.md` - VLM model enablement agent
- `.github/skills/` - 6 custom skills for common workflows

### Coverage
- No coverage configuration files found (needs creation)
