---
repository: "openvinotoolkit/openvino.genai"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "92 test files across Python/C++/JS with pytest, Google Test, and Jest; strong model coverage but no code coverage tracking"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Extensive model pipeline tests covering LLM, VLM, ASR, TTS, image/video generation across multiple transformer versions"
  - dimension: "Build Integration"
    score: 7.0
    status: "Multi-platform PR builds (Linux/Mac/Windows) with Smart CI and sccache; no container image build or Konflux simulation"
  - dimension: "Image Testing"
    score: 2.0
    status: "No Dockerfile, no container image builds, no image runtime validation"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No codecov, coveralls, or any coverage measurement; no coverage thresholds"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "Excellent CI with Smart CI component-based filtering, concurrency control, sccache, cross-platform PR testing, automated rerunner"
  - dimension: "Agent Rules"
    score: 1.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules for test creation"
critical_gaps:
  - title: "No code coverage tracking or enforcement"
    impact: "Cannot measure test effectiveness or prevent coverage regression; untested code paths unknown"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No container image testing pipeline"
    impact: "Downstream consumers building container images get no upstream validation; runtime issues discovered late"
    severity: "MEDIUM"
    effort: "8-16 hours"
  - title: "No CodeQL or SAST integration on PRs"
    impact: "C++ security vulnerabilities and code quality issues not caught by static analysis"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No agent rules for AI-assisted test creation"
    impact: "AI-generated tests lack project-specific patterns, leading to inconsistent test quality"
    severity: "LOW"
    effort: "4-6 hours"
quick_wins:
  - title: "Add CodeQL analysis workflow for C++ and Python"
    effort: "2-3 hours"
    impact: "Automated security vulnerability detection on every PR for C++ (primary language) and Python"
  - title: "Add gcov/llvm-cov coverage collection and Codecov upload"
    effort: "4-6 hours"
    impact: "Visibility into test coverage with PR-level coverage reporting"
  - title: "Add Gitleaks secret detection to pre-commit"
    effort: "1 hour"
    impact: "Prevent accidental secret leaks in commits"
  - title: "Create CLAUDE.md with test creation guidelines"
    effort: "2-3 hours"
    impact: "Enable AI agents to generate project-consistent tests"
recommendations:
  priority_0:
    - "Integrate code coverage measurement (gcov for C++, coverage.py for Python) and upload to Codecov with PR comments"
    - "Add CodeQL workflow for C++ and Python SAST analysis on every PR"
  priority_1:
    - "Add Gitleaks or TruffleHog secret scanning to pre-commit hooks"
    - "Create agent rules (.claude/rules/) for test creation patterns across C++, Python, and JS"
    - "Add SBOM generation for release artifacts"
  priority_2:
    - "Add container image build and validation workflow for downstream consumers"
    - "Add performance regression benchmarking in CI"
    - "Implement fuzz testing for parser and tokenizer components"
---

# Quality Analysis: openvino.genai

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: C++/Python library with Node.js bindings for Generative AI model pipelines on OpenVINO
- **Primary Languages**: C++ (106K LOC), Python (22K test LOC), JavaScript/TypeScript (Node.js bindings)
- **Key Strengths**: Exceptional CI/CD automation with Smart CI, comprehensive multi-model test matrix, cross-platform PR testing (Linux/Mac/Windows), Coverity static analysis, strong security hygiene (Bandit, Trivy, dependency review)
- **Critical Gaps**: No code coverage tracking, no CodeQL/SAST on PRs, no container image testing, no agent rules
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | 92 test files across Python/C++/JS with pytest, Google Test, Jest |
| Integration/E2E | 8.5/10 | Extensive pipeline tests covering 30+ model architectures |
| Build Integration | 7.0/10 | Multi-platform CMake builds with Smart CI, sccache; no container builds |
| Image Testing | 2.0/10 | No Dockerfiles, no container image pipeline |
| Coverage Tracking | 1.0/10 | No coverage measurement or enforcement |
| CI/CD Automation | 9.0/10 | Excellent: Smart CI, concurrency, caching, cross-platform, auto-rerun |
| Agent Rules | 1.0/10 | No CLAUDE.md, no .claude/ directory |

## Critical Gaps

### 1. No Code Coverage Tracking or Enforcement
- **Impact**: Cannot measure test effectiveness, cannot prevent coverage regression, untested code paths are unknown
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: Despite having 92 test files and 33K lines of test code, there is no coverage measurement (gcov, coverage.py, c8) or reporting (Codecov, Coveralls). This means the team cannot quantify how much of the 106K LOC C++ codebase is actually tested.

### 2. No CodeQL or SAST Integration on PRs
- **Impact**: C++ security vulnerabilities and code quality issues not caught by automated static analysis on PRs
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: While Coverity runs daily (not on PRs) and Bandit covers Python, there is no CodeQL or equivalent SAST tool analyzing the primary C++ codebase on every PR. For a library handling model data parsing (GGUF, tokenizers), this is a significant gap.

### 3. No Container Image Testing Pipeline
- **Impact**: No Dockerfiles exist in the repo; downstream consumers building container images get no upstream validation
- **Severity**: MEDIUM
- **Effort**: 8-16 hours
- **Details**: The repository has no Dockerfiles, Containerfiles, or container build/test workflows. For a library increasingly used in containerized ML inference deployments, providing reference container images with runtime validation would be valuable.

### 4. No Agent Rules for AI-Assisted Test Creation
- **Impact**: AI-generated tests lack project-specific patterns, leading to inconsistent test quality
- **Severity**: LOW
- **Effort**: 4-6 hours
- **Details**: No CLAUDE.md, AGENTS.md, or .claude/ directory exists. Test patterns (pytest markers, conftest usage, model caching strategies) are implicit rather than documented for AI agents.

## Quick Wins

### 1. Add CodeQL Analysis Workflow (2-3 hours)
- **Impact**: Automated security vulnerability detection for C++ and Python on every PR
- **Implementation**: Add `.github/workflows/codeql.yml` with C++ and Python language analysis

### 2. Add Coverage Collection and Codecov Upload (4-6 hours)
- **Impact**: PR-level coverage reporting, coverage trend tracking
- **Implementation**: Add `--coverage` flags to CMake builds, configure coverage.py for Python tests, add Codecov GitHub Action

### 3. Add Gitleaks Secret Detection (1 hour)
- **Impact**: Prevent accidental credential/token leaks in commits
- **Implementation**: Add `gitleaks` to `.pre-commit-config.yaml`

### 4. Create CLAUDE.md Test Guidelines (2-3 hours)
- **Impact**: Enable consistent AI-generated test patterns
- **Implementation**: Document pytest marker conventions, conftest patterns, model caching strategy

## Detailed Findings

### CI/CD Pipeline

**Strengths (Score: 9.0/10)**:
- **Smart CI**: Uses `openvinotoolkit/openvino/.github/actions/smart-ci` to detect affected components and skip irrelevant test jobs. This is a sophisticated component-based CI optimization that many projects lack.
- **Cross-Platform Testing**: Full PR testing on Linux (Ubuntu 22.04), macOS 14, Windows (VS 2022), and Manylinux 2_28.
- **Build Caching**: Excellent use of `sccache` (Linux) and `ccache` (Mac/Windows) with Azure blob storage backend for cross-run caching.
- **Concurrency Control**: All workflows have `cancel-in-progress: true` concurrency groups.
- **Automated Workflow Rerunner**: A dedicated `workflow_rerunner.yml` automatically reruns failed workflows with known transient errors, reducing CI flakiness.
- **CI Doctor**: GitHub Copilot-powered CI failure analysis (`ci-doctor.lock.yml`) for automated root cause analysis.
- **Multi-Python Testing**: Builds and tests across Python 3.10, 3.11, 3.12, and 3.13.
- **Dependabot**: Comprehensive dependency update automation for GitHub Actions, npm, and pip.

**Workflows Inventory**:
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `linux.yml` | PR, push, merge_group | Full Linux build + ~30 test matrix jobs |
| `mac.yml` | PR, push, merge_group | macOS build + tests |
| `windows.yml` | PR, push, merge_group | Windows build + tests |
| `manylinux_2_28.yml` | PR, push, merge_group | Portable Linux builds |
| `lint.yml` | PR, push | Pre-commit hooks on changed files |
| `sdl.yml` | PR, push | Security: flake8, Bandit, Trivy, dependency review |
| `coverity.yml` | Daily schedule | Coverity static analysis |
| `workflow_rerunner.yml` | On workflow failure | Auto-rerun known transient failures |
| `ci-doctor.lock.yml` | On workflow failure | AI-powered failure analysis |
| `cleanup_caches.yml` | Weekday schedule | HuggingFace cache cleanup |
| `deploy_gh_pages.yml` | Push to master | Documentation deployment |
| `stale.yml` | Weekly | Stale PR management |

### Test Coverage

**Strengths (Score: 7.5/10 Unit, 8.5/10 Integration/E2E)**:
- **92 test files** across three languages:
  - 69 Python test files (21K LOC) using pytest
  - 7 C++ test files (12K LOC) using Google Test
  - 16 JavaScript test files using Jest
- **Comprehensive Model Coverage**: Tests cover 30+ model architectures including:
  - LLM pipelines (Llama, Qwen, Gemma, etc.)
  - VLM pipelines (MiniCPM, Qwen-VL, Gemma4, etc.)
  - ASR (Whisper, Qwen3-ASR)
  - TTS (Kokoro)
  - Image generation (Stable Diffusion, FLUX)
  - Video generation
  - RAG components
- **Multi-Version Transformer Testing**: Dedicated test jobs for different `transformers` library versions (4.48, 4.51, 4.55, 4.57, 5.2, 5.5, 5.8, 5.10)
- **Test Markers**: Well-organized pytest markers for categorizing tests (llm, vlm, whisper, nightly, real_models, etc.)
- **Smart Test Filtering**: Tests only run when their associated component is changed (via Smart CI)
- **Sample Tests**: Dedicated sample tests validating C++, Python, and JavaScript sample code execution

**Gaps**:
- No coverage measurement (gcov, coverage.py)
- No coverage reporting (Codecov, Coveralls)
- No coverage thresholds or enforcement
- No contract tests between C++/Python bindings
- No fuzz testing for parser/tokenizer components

### Code Quality

**Strengths**:
- **Pre-commit Hooks**: Comprehensive `.pre-commit-config.yaml` with:
  - Trailing whitespace, end-of-file fixer, merge conflict detection
  - Private key detection
  - YAML, JSON, TOML validation
  - Large file prevention (1MB limit)
  - Python formatting with `darker` + `ruff`
- **C++ Formatting**: `.clang-format` configuration based on Google style
- **Python Formatting**: `ruff` configured in `pyproject.toml` (line-length=120)
- **Python Linting**: `flake8` for SDL checks on Python tools
- **Bandit Security Scanning**: Comprehensive bandit configuration with IPAS-required security checks

**Gaps**:
- No `clang-tidy` for C++ static analysis
- No ESLint configuration visible for JavaScript (though `npm run lint` exists in JS test workflow)
- No `mypy` or Python type checking

### Container Images

**Score: 2.0/10**
- No Dockerfiles or Containerfiles in the repository
- No container image build workflows
- No image scanning or SBOM generation
- This is understandable for a library (vs. an application), but reference container images would benefit downstream users

### Security Practices

**Strengths**:
- **Trivy Scanning**: Filesystem vulnerability scanning on every PR via `sdl.yml`
- **Bandit**: Python security analysis with comprehensive IPAS-required checker configuration
- **Dependency Review**: PR-level dependency review with license checking (`fail-on-severity: low`)
- **Coverity**: Daily static analysis scans (commercial-grade SAST for C++)
- **Dependabot**: Automated dependency updates for GitHub Actions, npm, and pip
- **Private Key Detection**: Pre-commit hook for `detect-private-key`
- **OSSF Scorecard Compliance**: Follows `permissions: read-all` pattern for all workflows
- **SECURITY.md**: Security policy documented

**Gaps**:
- No CodeQL integration (the most common GitHub-native SAST tool)
- Coverity runs daily/on-schedule, not on every PR
- No Gitleaks or TruffleHog for comprehensive secret scanning
- No SBOM generation for releases
- No image signing or attestation

### Agent Rules (Agentic Flow Quality)

**Score: 1.0/10**
- **Status**: Missing
- **Coverage**: No agent rules exist
- **Details**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory. The repo has a `copilot-setup-steps.yml` for GitHub Copilot integration, but no test creation guidance for AI agents.
- **Recommendation**: Generate test rules with `/test-rules-generator` covering:
  - C++ Google Test patterns
  - Python pytest patterns (markers, conftest, model caching)
  - JavaScript Jest patterns for bindings tests
  - Model download and caching strategies

## Recommendations

### Priority 0 (Critical)

1. **Add code coverage measurement and reporting**
   - Add `gcov`/`llvm-cov` for C++ coverage collection
   - Add `coverage.py` for Python test coverage
   - Integrate Codecov with PR comments and coverage gates
   - Effort: 4-8 hours

2. **Add CodeQL workflow for C++ and Python SAST**
   - Create `.github/workflows/codeql.yml` for automated security analysis on PRs
   - Focus on C++ as the primary language with 106K LOC
   - Effort: 2-4 hours

### Priority 1 (High Value)

3. **Add Gitleaks secret scanning**
   - Add to `.pre-commit-config.yaml` and as a CI workflow
   - Effort: 1-2 hours

4. **Create agent rules for test creation**
   - Add `CLAUDE.md` with testing guidelines
   - Create `.claude/rules/` with patterns for C++, Python, and JS tests
   - Document model caching strategies and pytest marker conventions
   - Effort: 4-6 hours

5. **Add SBOM generation for release artifacts**
   - Generate CycloneDX or SPDX SBOM for Python wheels and npm packages
   - Effort: 2-4 hours

### Priority 2 (Nice-to-Have)

6. **Add reference Dockerfile with runtime validation**
   - Create reference container images for GenAI inference
   - Add smoke tests for container startup
   - Effort: 8-16 hours

7. **Add performance regression benchmarking**
   - Track inference latency and throughput across PRs
   - Alert on significant regressions
   - Effort: 8-16 hours

8. **Add fuzz testing for parsers**
   - GGUF reader, tokenizer, and model config parsers
   - Use libFuzzer or AFL for C++ components
   - Effort: 8-16 hours

9. **Add clang-tidy to CI**
   - Enable C++ static analysis checks beyond clang-format
   - Effort: 4-6 hours

## Comparison to Gold Standards

| Dimension | openvino.genai | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit Tests | 7.5 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 8.5 | 9.0 | 8.0 | 9.5 |
| Build Integration | 7.0 | 8.5 | 8.0 | 8.0 |
| Image Testing | 2.0 | 8.0 | 9.5 | 7.0 |
| Coverage Tracking | 1.0 | 9.0 | 5.0 | 9.0 |
| CI/CD Automation | 9.0 | 9.0 | 8.0 | 9.0 |
| Agent Rules | 1.0 | 9.0 | 3.0 | 2.0 |

**Key Takeaways**:
- CI/CD automation is on par with gold standards due to Smart CI, cross-platform testing, and automated rerunner
- Test breadth is excellent (30+ model architectures, multi-version transformer testing)
- The biggest gap vs. gold standards is **coverage tracking** - the project has extensive tests but no way to measure their effectiveness
- Image testing is low because this is a library, not an application; however, reference images would add value
- Agent rules are a universal gap across most repositories

## File Paths Reference

### CI/CD
- `.github/workflows/linux.yml` - Primary Linux CI (build + 30+ test jobs)
- `.github/workflows/mac.yml` - macOS CI
- `.github/workflows/windows.yml` - Windows CI
- `.github/workflows/manylinux_2_28.yml` - Portable Linux builds
- `.github/workflows/lint.yml` - Pre-commit linting
- `.github/workflows/sdl.yml` - Security testing (flake8, Bandit, Trivy, dependency review)
- `.github/workflows/coverity.yml` - Daily Coverity static analysis
- `.github/workflows/workflow_rerunner.yml` - Auto-rerun transient failures
- `.github/workflows/ci-doctor.lock.yml` - AI-powered CI failure analysis
- `.github/components.yml` - Smart CI component definitions
- `.github/dependabot.yml` - Dependency update automation

### Testing
- `tests/python_tests/` - Python test suite (69 files, 21K LOC)
- `tests/cpp/` - C++ test suite (7 files, 12K LOC)
- `src/js/tests/` - JavaScript binding tests (16 files)
- `tests/python_tests/pytest.ini` - pytest configuration with markers
- `tests/python_tests/conftest.py` - Test fixtures
- `tools/who_what_benchmark/tests/` - WWB tool tests

### Code Quality
- `.pre-commit-config.yaml` - Pre-commit hooks (whitespace, secrets, formatting)
- `.clang-format` - C++ formatting (Google-based)
- `pyproject.toml` - Ruff Python formatter config
- `bandit.yml` - Python security scanning config

### Security
- `.github/dependency_review.yml` - License and vulnerability review config
- `.github/dependabot.yml` - Automated dependency updates
- `SECURITY.md` - Security policy
- `bandit.yml` - Bandit security scanner config

### Build
- `CMakeLists.txt` - Top-level CMake build
- `pyproject.toml` - Python package build config (py-build-cmake)
- `.github/actions/build_app/action.yml` - Reusable build action
- `.github/actions/install_openvino/action.yml` - OpenVINO installation action
