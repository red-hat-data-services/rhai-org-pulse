---
repository: "red-hat-data-services/openvino"
overall_score: 6.5
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Extensive C++ (GTest) and Python (pytest) unit tests across all components"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Conformance tests, model hub tests, ONNX Runtime integration, multi-framework layer tests"
  - dimension: "Build Integration"
    score: 3.0
    status: "No Red Hat downstream build validation; pure upstream mirror with no Konflux/RHEL-specific CI"
  - dimension: "Image Testing"
    score: 2.0
    status: "No container image builds or runtime validation in CI; no Dockerfiles in repo"
  - dimension: "Coverage Tracking"
    score: 5.0
    status: "Coverage workflow exists (lcov + Codecov) but is manual dispatch-only; no PR enforcement"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "37 workflows with Smart CI, multi-platform builds, concurrency control, sccache caching"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, .claude/ directory, or agent rules present"
critical_gaps:
  - title: "No downstream/Red Hat-specific CI or testing"
    impact: "This is a bare mirror fork with zero Red Hat customization — no RHEL builds, no Konflux integration, no downstream test validation"
    severity: "HIGH"
    effort: "40-80 hours"
  - title: "No container image builds or Dockerfiles"
    impact: "No container-based delivery or testing; runtime validation impossible in CI"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "Coverage tracking is manual-only (workflow_dispatch)"
    impact: "No coverage enforcement on PRs; coverage regressions go undetected"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No security scanning (no Trivy, Snyk, CodeQL, SAST)"
    impact: "Container and source-level vulnerabilities not detected in CI"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No pre-commit hooks"
    impact: "Code style issues only caught in CI, not locally"
    severity: "LOW"
    effort: "2-3 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents have no guidance for test patterns, code conventions, or quality standards"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Enable coverage workflow on PRs with threshold enforcement"
    effort: "4-6 hours"
    impact: "Prevent coverage regressions; make existing lcov+Codecov setup enforceable"
  - title: "Add CodeQL or Coverity to PR workflow (Coverity already runs nightly)"
    effort: "2-4 hours"
    impact: "Catch security issues at PR time instead of post-merge"
  - title: "Create basic agent rules for test patterns"
    effort: "3-4 hours"
    impact: "Enable AI-assisted test generation aligned with project conventions"
  - title: "Add pre-commit hooks using existing linters (clang-format, flake8, ShellCheck)"
    effort: "2-3 hours"
    impact: "Shift-left code quality checks from CI to developer machines"
recommendations:
  priority_0:
    - "Define downstream strategy: If this fork is meant for Red Hat consumption, add RHEL-specific builds, Konflux pipelines, and container image workflows"
    - "Add container image definitions (Dockerfiles) and integrate image build + runtime validation into CI"
    - "Enable security scanning (Trivy for containers, CodeQL for source) on PRs"
  priority_1:
    - "Move coverage workflow from manual dispatch to PR-triggered with threshold enforcement"
    - "Add Konflux build simulation to catch downstream build failures before merge"
    - "Create comprehensive agent rules (.claude/rules/) covering C++, Python, and JS test patterns"
  priority_2:
    - "Add pre-commit hooks leveraging existing linters"
    - "Consider adding contract tests between frontend/plugin interfaces"
    - "Add performance regression detection using existing time_tests/memory_tests infrastructure in CI"
---

# Quality Analysis: red-hat-data-services/openvino

## Executive Summary

- **Overall Score: 6.5/10**
- **Repository Type**: C++/Python/JS inference engine (fork/mirror of openvinotoolkit/openvino)
- **Primary Languages**: C++ (5,823 .cpp files), Python (2,693 .py files), JavaScript/TypeScript
- **Build System**: CMake with Ninja, pip wheels, npm packages
- **Fork Status**: **Bare mirror** — single `master` branch, no Red Hat-specific modifications, no downstream CI
- **Agent Rules Status**: Missing — no CLAUDE.md, no .claude/ directory

### Key Strengths
- Massively comprehensive upstream CI with 37 GitHub Actions workflows
- Excellent multi-platform coverage (Linux, Windows, macOS, ARM64, RISC-V, Android, WebAssembly)
- Smart CI system that skips irrelevant tests based on changed components
- Extensive test infrastructure: unit, functional, conformance, model hub, stress, fuzz, time, and memory tests
- Coverity static analysis running nightly
- OpenTelemetry workflow observability integration

### Critical Gaps
- **No downstream value-add**: This is a bare upstream mirror with zero Red Hat customization
- **No container images**: No Dockerfiles, no image testing, no vulnerability scanning
- **No coverage enforcement**: Coverage workflow exists but is manual dispatch-only
- **No SAST on PRs**: Coverity runs nightly (not on PRs); no CodeQL integration
- **No agent rules**: No AI development guidance

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Extensive GTest (C++) and pytest (Python) coverage across all components |
| Integration/E2E | 8.0/10 | Conformance, model hub, ONNX Runtime, multi-framework layer tests |
| **Build Integration** | **3.0/10** | **No downstream build validation; pure upstream mirror** |
| Image Testing | 2.0/10 | No container images or runtime validation |
| Coverage Tracking | 5.0/10 | lcov + Codecov exists but manual-only; no PR enforcement |
| CI/CD Automation | 8.5/10 | 37 workflows, Smart CI, multi-platform, sccache, concurrency control |
| Agent Rules | 0.0/10 | No CLAUDE.md, no .claude/ directory, no rules |

## Critical Gaps

### 1. No Downstream/Red Hat-Specific CI or Testing
- **Impact**: This fork provides no value over upstream — no RHEL builds, no Konflux integration, no downstream validation
- **Severity**: HIGH
- **Effort**: 40-80 hours
- **Details**: The repository is a single-branch mirror of `openvinotoolkit/openvino` with no Red Hat modifications. All CI runs against the upstream `openvinotoolkit` org. This raises the question of whether this fork needs its own quality practices or should simply track upstream.

### 2. No Container Image Builds or Dockerfiles
- **Impact**: No container-based delivery; runtime validation impossible
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: Unlike many Red Hat Data Services repositories, this fork has zero container definitions. There are no Dockerfiles, Containerfiles, or image build workflows.

### 3. Coverage Tracking is Manual-Only
- **Impact**: Coverage regressions go undetected on PRs
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: The `coverage.yml` workflow exists with lcov and Codecov integration, but it's triggered only via `workflow_dispatch`. No coverage thresholds are enforced. The `.coveragerc` in `tools/mo/` covers only the Model Optimizer Python code.

### 4. No Security Scanning on PRs
- **Impact**: Vulnerabilities not caught until nightly Coverity or manual review
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: Coverity runs daily on a schedule but not on PRs. No Trivy, Snyk, or CodeQL integration exists. Dependency review runs on PRs (good), but source-level SAST is missing from the PR workflow.

### 5. No Pre-commit Hooks
- **Impact**: Code style issues only caught in CI
- **Severity**: LOW
- **Effort**: 2-3 hours
- **Details**: Clang-format, ShellCheck, flake8, mypy, and ESLint all run in CI but there's no `.pre-commit-config.yaml` to catch issues locally before push.

### 6. No Agent Rules
- **Impact**: AI-assisted development has no guardrails or guidance
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: No CLAUDE.md, AGENTS.md, or `.claude/` directory. Given the complexity of the codebase (C++/Python/JS, CMake build system, multiple test frameworks), agent rules would significantly improve AI contribution quality.

## Quick Wins

### 1. Enable Coverage Workflow on PRs (4-6 hours)
- Change `coverage.yml` trigger from `workflow_dispatch` to include `pull_request`
- Add codecov threshold to `.codecov.yml` config
- Leverage existing lcov + Codecov infrastructure

### 2. Add CodeQL to PR Workflow (2-4 hours)
- Coverity already runs nightly — add CodeQL for PR-time SAST
- Template available from GitHub's starter workflows
- Cover C++ and Python analysis

### 3. Create Basic Agent Rules (3-4 hours)
- Add `.claude/rules/` with test patterns for GTest, pytest, and JS testing
- Document CMake build conventions
- Reference existing code style checks

### 4. Add Pre-commit Hooks (2-3 hours)
- Wrap existing CI linters (clang-format-9, flake8, ShellCheck) in `.pre-commit-config.yaml`
- Immediate developer feedback loop

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (37 workflows)**:

| Category | Workflows | Trigger |
|----------|-----------|---------|
| **Multi-platform builds** | linux.yml, windows.yml, mac.yml, mac_arm64.yml, fedora.yml, linux_arm64.yml, linux_riscv.yml, android_arm64.yml, webassembly.yml | PR + push + schedule |
| **Test jobs (reusable)** | job_cxx_unit_tests.yml, job_python_unit_tests.yml, job_cpu_functional_tests.yml, job_samples_tests.yml, job_onnx_models_tests.yml, job_pytorch_models_tests.yml, job_tensorflow_hub_models_tests.yml, job_openvino_js.yml, job_onnx_runtime.yml, job_debian_packages.yml | Called by platform workflows |
| **Code quality** | code_style.yml (clang-format, ShellCheck, NamingConvention), py_checks.yml (flake8, mypy), check_pr_commits.yml | PR |
| **Security** | coverity.yml (nightly), dependency_review.yml (PR) | Schedule + PR |
| **Coverage** | coverage.yml | Manual dispatch only |
| **Special** | linux_conditional_compilation.yml, windows_conditional_compilation.yml, code_snippets.yml, files_size.yml | PR + push |
| **Observability** | send_workflows_to_opentelemetry.yml | workflow_run |
| **Maintenance** | stale_prs_and_issues.yml, cleanup_pip_cache.yml, labeler.yml, assign_issue.yml, build_doc.yml | Various |

**Smart CI**: Custom GitHub Action (`.github/actions/smart-ci/`) analyzes PR changes against a component map (`.github/components.yml`) and skips irrelevant test jobs. This is an excellent practice for a large monorepo.

**Concurrency Control**: All major workflows use `concurrency` groups with `cancel-in-progress: true` — prevents CI queue buildup.

**Build Caching**: sccache with Azure Blob Storage for C++ compilation; pip cache for Python; ccache in coverage workflow.

**Jenkins**: A Jenkinsfile exists, suggesting dual CI (GitHub Actions + Jenkins), though the Jenkinsfile is minimal and delegates to a shared library.

### Test Coverage

**C++ Tests (GTest)**:
- ~658 test-related .cpp files in `src/` and `tests/`
- Major test suites per component:
  - `src/plugins/intel_cpu/tests/`: 643 files
  - `src/plugins/intel_gpu/tests/`: 540 files
  - `src/core/tests/`: 507 files
  - `src/frontends/onnx/tests/`: 925 files
  - `src/plugins/template/tests/`: 228 files
  - `src/common/transformations/tests/`: 203 files
  - `src/common/low_precision_transformations/tests/`: 107 files

**Python Tests (pytest)**:
- 611 Python test files in `tests/` directory
- Layer tests cover TensorFlow, TF Lite, PyTorch, ONNX, JAX, Paddle
- Model hub tests for TensorFlow Hub, PyTorch, ONNX models
- 19 conftest.py files showing well-structured pytest fixtures

**Specialized Tests**:
- **Conformance tests**: Op and API conformance against reference implementations
- **Stress tests**: Memory leak detection and memory check tests
- **Time tests**: Performance timing benchmarks
- **Memory tests**: Memory consumption tracking
- **Fuzz tests**: Fuzzing infrastructure with libFuzzer support
- **Sample tests**: Smoke tests for code samples

**Test-to-Code Ratio**: ~1,269 test files : ~5,823 C++ source files = ~0.22 (moderate; typical for a mature C++ project)

### Code Quality

**Linting (in CI, not local)**:
- **C++**: clang-format-9 with reviewdog PR suggestions
- **Shell**: ShellCheck with reviewdog integration
- **Python**: flake8, mypy, Black (for formatting diffs)
- **JavaScript**: ESLint with TypeScript plugin
- **Naming**: Custom NamingConventionCheck using Clang AST analysis
- **Spelling**: cspell.json configuration

**No Pre-commit Hooks**: Despite having 5+ linters in CI, no `.pre-commit-config.yaml` exists.

**Dependency Management**: Dependabot configured for pip, github-actions, and Python samples — good coverage.

### Container Images

**Status**: No container image infrastructure.

- No Dockerfiles or Containerfiles in the repository
- No container build workflows
- No vulnerability scanning (Trivy, Snyk)
- No multi-architecture image builds
- No SBOM generation or image signing
- CI uses pre-built containers from `openvinogithubactions.azurecr.io` for build environments, but does not produce containers

### Security

**Strengths**:
- Coverity static analysis runs nightly with artifact upload
- Dependency review on every PR (fail-on-severity: low, license allowlist)
- Dependabot daily updates for Python and GitHub Actions dependencies
- SECURITY.md with Intel vulnerability reporting process

**Gaps**:
- No CodeQL or Semgrep on PRs
- No Trivy/container scanning
- No secret detection (Gitleaks, TruffleHog)
- Coverity only runs nightly, not on PRs

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no CLAUDE.md, AGENTS.md, or `.claude/` directory
- **Quality**: N/A
- **Gaps**: No test automation guidance, no coding standards documentation for agents, no skill definitions
- **Recommendation**: Generate rules with /test-rules-generator covering GTest patterns, pytest conventions, CMake build patterns, and multi-language guidelines

## Recommendations

### Priority 0 (Critical)

1. **Define the purpose of this fork**: This is a bare mirror with no downstream modifications. Either:
   - Add Red Hat-specific CI, RHEL builds, and Konflux integration to justify the fork
   - Or document it as a tracking mirror and point quality efforts upstream
2. **Add container image definitions and CI**: If this fork delivers container images for RHOAI, create Dockerfiles and image build/test workflows
3. **Enable security scanning on PRs**: Add CodeQL for C++/Python SAST; add Trivy if containers are introduced

### Priority 1 (High Value)

4. **Activate coverage enforcement**: Change coverage.yml from `workflow_dispatch` to `pull_request`, add `.codecov.yml` with thresholds
5. **Add Konflux build simulation**: If Red Hat ships this as a product component, validate builds in the fork's CI
6. **Create agent rules**: Add `.claude/rules/` with guidelines for the three languages and test frameworks

### Priority 2 (Nice-to-Have)

7. **Add pre-commit hooks**: Wrap existing CI linters for local developer feedback
8. **Add performance regression CI**: Leverage existing time_tests and memory_tests in automated nightly runs
9. **Add contract tests**: Define interface contracts between frontends and plugins

## Comparison to Gold Standards

| Dimension | openvino | odh-dashboard | notebooks | kserve |
|-----------|----------|---------------|-----------|--------|
| Unit Tests | 8.5 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 8.0 | 9.0 | 8.0 | 9.5 |
| Build Integration | 3.0 | 8.0 | 7.0 | 7.0 |
| Image Testing | 2.0 | 7.0 | 9.0 | 8.0 |
| Coverage Tracking | 5.0 | 9.0 | 6.0 | 9.0 |
| CI/CD Automation | 8.5 | 9.0 | 8.0 | 9.0 |
| Agent Rules | 0.0 | 8.0 | 3.0 | 2.0 |
| **Overall** | **6.5** | **8.7** | **7.3** | **8.2** |

**Key Takeaway**: The upstream OpenVINO project has excellent testing and CI practices (the unit test and CI scores reflect this). However, as a Red Hat downstream fork, this repo adds zero value — no downstream-specific builds, containers, security scanning, or coverage enforcement. The overall score reflects this gap between strong upstream practices and absent downstream integration.

## File Paths Reference

### CI/CD (37 workflows)
- `.github/workflows/linux.yml` — Main Linux build + test orchestrator
- `.github/workflows/windows.yml` — Windows build + tests
- `.github/workflows/fedora.yml` — Fedora/RHEL build
- `.github/workflows/code_style.yml` — clang-format, ShellCheck, naming
- `.github/workflows/py_checks.yml` — flake8, mypy, Black
- `.github/workflows/coverage.yml` — lcov + Codecov (manual dispatch)
- `.github/workflows/coverity.yml` — Nightly Coverity scan
- `.github/workflows/dependency_review.yml` — PR dependency check
- `.github/workflows/send_workflows_to_opentelemetry.yml` — CI observability
- `.github/actions/smart-ci/` — Smart CI component-based test selection

### Testing
- `src/core/tests/` — Core engine unit tests (507 files)
- `src/plugins/intel_cpu/tests/` — CPU plugin tests (643 files)
- `src/plugins/intel_gpu/tests/` — GPU plugin tests (540 files)
- `src/frontends/onnx/tests/` — ONNX frontend tests (925 files)
- `tests/layer_tests/` — Multi-framework layer tests (Python)
- `tests/model_hub_tests/` — Model hub integration tests
- `tests/stress_tests/` — Memory leak/check tests
- `tests/time_tests/` — Performance timing tests
- `tests/fuzz/` — Fuzzing infrastructure

### Code Quality
- `.github/workflows/code_style.yml` — Clang-format, ShellCheck, NamingConvention
- `src/bindings/js/.eslintrc.js` — ESLint config for JS bindings
- `src/bindings/python/requirements_test.txt` — Python test dependencies
- `cspell.json` — Spell check configuration

### Coverage
- `.github/workflows/coverage.yml` — Coverage workflow
- `cmake/coverage.cmake` — CMake coverage targets (per-component extraction)
- `tools/mo/.coveragerc` — Python coverage config (Model Optimizer only)

### Security
- `.github/workflows/coverity.yml` — Nightly Coverity static analysis
- `.github/dependency_review.yml` — License allowlist + vulnerability check
- `.github/dependabot.yml` — Daily dependency updates
- `SECURITY.md` — Intel vulnerability reporting policy
