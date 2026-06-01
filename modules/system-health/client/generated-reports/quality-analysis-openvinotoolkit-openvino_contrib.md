---
repository: "openvinotoolkit/openvino_contrib"
overall_score: 4.8
scorecard:
  - dimension: "Unit Tests"
    score: 5.0
    status: "NVIDIA plugin has 71 C++ unit tests; other modules have minimal/no unit tests. OpenVINO Code (54 TS source files) has zero test files."
  - dimension: "Integration/E2E"
    score: 5.5
    status: "Llama CPP plugin has functional + E2E tests in CI. CUDA tests run on self-hosted runners. Java API integration tests exercise CPU/HETERO devices. No E2E for OpenVINO Code."
  - dimension: "Build Integration"
    score: 3.0
    status: "No PR-time image build validation. Dockerfile exists only for NVIDIA dev environment, not tested in CI. No Konflux or container registry push."
  - dimension: "Image Testing"
    score: 1.5
    status: "Single Dockerfile for NVIDIA dev environment only. No runtime validation, no multi-arch support, no startup testing, no image scanning."
  - dimension: "Coverage Tracking"
    score: 0.5
    status: "No coverage tooling whatsoever — no codecov, no coveralls, no lcov, no coverage thresholds, no PR coverage reporting."
  - dimension: "CI/CD Automation"
    score: 6.5
    status: "13 workflows covering Linux/Windows/macOS builds, CUDA testing, code style checks, labeler, and issue management. Good concurrency control and ccache. But lacks security scanning and coverage."
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory. No AI-assisted development guidance of any kind."
critical_gaps:
  - title: "Zero test coverage tracking or enforcement"
    impact: "No visibility into how much code is tested; regressions can slip in undetected across all modules"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "OpenVINO Code extension has 0 test files for 54 source files"
    impact: "VS Code extension (the most user-facing module) has no automated testing — only lint checks"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No security scanning (SAST, container, dependency)"
    impact: "Vulnerabilities in dependencies or code go undetected; no Trivy, CodeQL, Dependabot, or Snyk"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container image testing or validation"
    impact: "NVIDIA Dockerfile is never built or validated in CI; broken images would not be caught"
    severity: "MEDIUM"
    effort: "6-10 hours"
  - title: "No pre-commit hooks or unified linting"
    impact: "Code quality checks are fragmented — clang-format for NVIDIA, ESLint for OpenVINO Code, ruff for token_merging server; no project-wide enforcement"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add Dependabot for automated dependency updates"
    effort: "30 minutes"
    impact: "Automated PRs for outdated or vulnerable dependencies across all modules"
  - title: "Add CodeQL SAST scanning workflow"
    effort: "1-2 hours"
    impact: "Catch security vulnerabilities in C++, Java, Python, and TypeScript code"
  - title: "Add basic coverage reporting with codecov for Java API tests"
    effort: "2-3 hours"
    impact: "Establish coverage baseline for the most well-tested module; extend to others later"
  - title: "Enable Trivy container scanning for NVIDIA Dockerfile"
    effort: "1-2 hours"
    impact: "Detect vulnerabilities in the NVIDIA CUDA base image and installed packages"
  - title: "Add pre-commit configuration for cross-module consistency"
    effort: "2-3 hours"
    impact: "Unified formatting, trailing whitespace, YAML validation across all modules"
recommendations:
  priority_0:
    - "Implement coverage tracking (codecov/lcov) starting with Java API and NVIDIA plugin unit tests"
    - "Add CodeQL and Dependabot security scanning to catch vulnerabilities in C++/Java/Python/TS code"
    - "Write basic test suite for OpenVINO Code VS Code extension — currently 54 source files with 0 tests"
  priority_1:
    - "Build and validate NVIDIA Dockerfile in CI to catch image build regressions"
    - "Add Trivy container scanning for the NVIDIA plugin Dockerfile"
    - "Create unified pre-commit-config.yaml with hooks for all languages used in the monorepo"
    - "Add integration tests for custom_operations module beyond the single run_tests.py"
  priority_2:
    - "Create .claude/rules/ with test patterns for each module to guide AI-assisted development"
    - "Add performance regression benchmarks for NVIDIA plugin and llama_cpp plugin"
    - "Consider multi-architecture builds for the NVIDIA Dockerfile (ARM64 support)"
    - "Add SBOM generation for released artifacts"
---

# Quality Analysis: openvino_contrib

## Executive Summary

- **Overall Score: 4.8/10**
- **Repository Type**: Monorepo — collection of "extra" OpenVINO modules (plugins, APIs, extensions)
- **Primary Languages**: C++ (263 files), TypeScript/JavaScript (67 files), Python (47 files), Java (33 files)
- **Key Modules**: nvidia_plugin, java_api, openvino_code (VS Code extension), custom_operations, llama_cpp_plugin, token_merging

**Key Strengths:**
- Multi-platform CI/CD (Linux, Windows, macOS) with good build caching (ccache)
- NVIDIA plugin has substantial unit test suite (71 C++ test files)
- Llama CPP plugin has well-structured functional + E2E test separation
- Concurrency control on workflows prevents redundant builds
- CODEOWNERS file ensures module-specific review

**Critical Gaps:**
- **Zero coverage tracking** — no codecov, lcov, or any coverage tool
- **No security scanning** — no CodeQL, Dependabot, Trivy, or secret detection
- **OpenVINO Code has 0 tests** despite being the most user-facing module (54 TS source files)
- **No container image testing** — the only Dockerfile is never built in CI
- **No agent rules** — no AI-assisted development guidance

**Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 5.0/10 | NVIDIA has 71 test files; Java has 8; others have 0-2. OpenVINO Code has none. |
| Integration/E2E | 5.5/10 | Llama CPP has func+E2E. CUDA tests on self-hosted. Java tests on 3 platforms. |
| **Build Integration** | **3.0/10** | **No PR-time image build. No Konflux. Dockerfile untested in CI.** |
| Image Testing | 1.5/10 | One dev Dockerfile, never built in CI. No runtime validation. |
| Coverage Tracking | 0.5/10 | No coverage tooling at all. No thresholds, no reporting. |
| CI/CD Automation | 6.5/10 | 13 workflows, multi-platform, caching, concurrency. Missing security + coverage. |
| Agent Rules | 0.0/10 | No AI development guidance whatsoever. |

## Critical Gaps

### 1. Zero Test Coverage Tracking or Enforcement
- **Impact**: No visibility into how much code is tested; regressions can be merged undetected
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: None of the 7 modules generate coverage data. No codecov.yml, no .coveragerc, no lcov configuration. Java API tests with Gradle could easily add JaCoCo; C++ tests could use gcov/lcov; Python tests could use pytest-cov.

### 2. OpenVINO Code Extension Has Zero Tests
- **Impact**: The VS Code extension — the most user-facing module — ships with no automated test verification
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: 54 TypeScript source files, 0 test files. The CI workflow only runs ESLint + Prettier checks. The `package.json` defines a `test` script (`node ./out/test/runTest.js`) but there are no test files to run. This module includes a side panel UI, state management, and server communication that are completely untested.

### 3. No Security Scanning
- **Impact**: Vulnerabilities in dependencies or source code go undetected
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No CodeQL for SAST analysis. No Dependabot for dependency updates. No Trivy or Snyk for container scanning. No Gitleaks or TruffleHog for secret detection. The SECURITY.md only points to Intel's security reporting page but adds no proactive scanning.

### 4. No Container Image Testing or Validation
- **Impact**: NVIDIA Dockerfile could break without anyone noticing; no image quality assurance
- **Severity**: MEDIUM
- **Effort**: 6-10 hours
- **Details**: The single Dockerfile (`modules/nvidia_plugin/Dockerfile`) is for a CUDA development environment. It is never built in CI, never scanned, never validated. No multi-arch support, no SBOM generation, no image signing.

### 5. No Pre-commit Hooks or Unified Code Quality
- **Impact**: Code style enforcement is fragmented and inconsistent across modules
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: Each module has its own approach — clang-format for NVIDIA plugin, ESLint+Prettier for OpenVINO Code, google-java-format for Java API, ruff+black for token_merging server. No `.pre-commit-config.yaml` unifies these.

## Quick Wins

### 1. Add Dependabot Configuration (~30 minutes)
Add `.github/dependabot.yml` to automatically detect outdated and vulnerable dependencies:
```yaml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "npm"
    directory: "/modules/openvino_code"
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
```

### 2. Add CodeQL SAST Scanning (1-2 hours)
Create `.github/workflows/codeql.yml` to analyze C++, Java, Python, and JavaScript/TypeScript:
```yaml
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
    strategy:
      matrix:
        language: [cpp, java, python, javascript]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

### 3. Add Coverage Reporting for Java API (2-3 hours)
Add JaCoCo to the Gradle build to generate and report coverage:
```groovy
plugins {
    id 'jacoco'
}
jacocoTestReport {
    reports {
        xml.required = true
    }
}
```
Then upload to codecov in the CI workflows.

### 4. Add Trivy Scanning for NVIDIA Dockerfile (1-2 hours)
```yaml
- name: Build NVIDIA image
  run: docker build -t nvidia-plugin modules/nvidia_plugin
- name: Run Trivy scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: nvidia-plugin
    severity: CRITICAL,HIGH
    exit-code: 1
```

### 5. Add Pre-commit Configuration (2-3 hours)
Create `.pre-commit-config.yaml` with hooks for all languages used in the monorepo.

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory** (13 workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `linux.yml` | PR, push, dispatch | Full build + Java/custom-ops tests on Ubuntu 20.04 + NVIDIA plugin build |
| `windows.yml` | PR, push, dispatch, merge_group | Full build + Java/custom-ops tests on Windows 2019 |
| `mac.yml` | PR, push, dispatch | Full build + Java tests on macOS 13 |
| `test_cuda.yml` | PR (nvidia_plugin/*), push | CUDA unit+functional+regression tests on self-hosted GPU runner |
| `sanitizer_cuda.yml` | push (master), dispatch | CUDA compute sanitizer tests (memory safety) |
| `history_cuda.yml` | PR (nvidia_plugin/*), push | Checks NVIDIA PRs are rebased and autosquashed |
| `llama_cpp_plugin_build_and_test.yml` | PR (llama_cpp_plugin/*) | Build + functional + E2E tests |
| `openvino_code.yml` | PR (openvino_code/*) | ESLint + ruff/black linting (NO tests) |
| `token_merging.yml` | PR (token_merging/*), push | pytest-based tests |
| `code_style.yml` | PR (java_api/*), push | google-java-format style check |
| `labeler.yml` | pull_request_target | Auto-label PRs by path |
| `assign_issue.yml` | issue_comment | Assign issues via `.take` command |

**Strengths:**
- Multi-platform coverage (Linux, Windows, macOS)
- Concurrency control (`cancel-in-progress: true`) on most workflows
- ccache configured with proper cache keys and save-on-master-only strategy
- 16-core runners used for heavy C++ builds (ubuntu-20.04-16-cores, windows-2019-16-core)
- Proper `permissions: read-all` on all workflows (least privilege)
- Pinned action versions with SHA hashes for supply chain security
- Overall status jobs aggregate results

**Weaknesses:**
- No security scanning workflows (no CodeQL, no Trivy, no Dependabot)
- No coverage generation or reporting in any workflow
- Self-hosted CUDA runner (`lohika-ci`) has hardcoded paths and no containerization
- Jenkins is still present (legacy) with unclear relationship to GitHub Actions
- `openvino_code.yml` only lints — no tests despite having a test script defined
- No scheduled/periodic test runs (only push/PR-triggered)

### Test Coverage

**Per-Module Analysis:**

| Module | Source Files | Test Files | Test-to-Code Ratio | Framework | CI Coverage |
|--------|-------------|------------|--------------------|-----------|----|
| nvidia_plugin | 453 C++/CUDA | 71 C++ | 0.16 | Google Test | Unit + functional + sanitizer |
| java_api | 21 Java | 8 Java | 0.38 | JUnit (Gradle) | Linux + Windows + macOS |
| openvino_code | 54 TS | 0 | 0.00 | (none) | Lint only |
| custom_operations | 7 C++ | 2 (Python) | 0.29 | pytest | Linux + Windows |
| llama_cpp_plugin | 3 C++ src | 8 C++ test | 2.67 | Google Test | Functional + E2E |
| token_merging | 7 Python | 1 Python | 0.14 | pytest | pytest in CI |
| android_demos | (demo code) | 0 | 0.00 | none | none |

**Observations:**
- **NVIDIA plugin** has the most tests but lowest ratio (0.16) given 453 source files; unit tests cover transformations, memory management, and operation registry
- **Llama CPP plugin** has excellent test structure — separate common/functional/e2e directories with CMake targets
- **OpenVINO Code** is the biggest gap — 54 TypeScript source files with 0 tests; `@vscode/test-electron` is a dev dependency but unused
- **Token merging** has minimal testing (1 test file for 7 source files)
- No module generates coverage reports

### Code Quality

**Linting Tools in Use:**
- **C++ (nvidia_plugin)**: clang-format (v9-12) checked in CI via `check.sh` script; `.clang-format` config present
- **C++ (llama_cpp_plugin)**: `.clang-format` config present but not enforced in CI
- **TypeScript (openvino_code)**: ESLint (airbnb-typescript config) + Prettier; enforced in CI with `--max-warnings 0`
- **Java (java_api)**: google-java-format enforced in CI via GitHub Action
- **Python (openvino_code server)**: ruff + black checked in CI
- **Python (token_merging)**: No linting in CI

**Missing Quality Tools:**
- No pre-commit hooks (`.pre-commit-config.yaml` absent)
- No static analysis beyond linting (no CodeQL, gosec, Semgrep)
- No secret detection (no Gitleaks or TruffleHog)
- No dependency vulnerability scanning
- No type checking enforcement (Python mypy, TypeScript strict mode unclear)

### Container Images

**Current State:**
- Single `Dockerfile` in `modules/nvidia_plugin/` — a development environment image based on `nvidia/cuda:11.8.0-runtime-ubuntu20.04`
- Installs full CUDA toolkit, build tools, development libraries
- Not built or validated in any CI workflow
- No `.dockerignore` file
- No multi-stage build optimization
- No multi-architecture support
- No SBOM generation
- No image signing or attestation

**Assessment:** Container image practices are essentially absent. The Dockerfile serves as documentation for the development environment rather than a production artifact.

### Security

**Current Practices:**
- `SECURITY.md` points to Intel Security Center for vulnerability reporting
- `permissions: read-all` on all workflows (good — least privilege)
- Action versions pinned with SHA hashes (good — prevents supply chain attacks)
- CODEOWNERS file ensures module-specific review

**Missing Practices:**
- No SAST (CodeQL, Semgrep, or similar)
- No dependency scanning (Dependabot absent)
- No container scanning (Trivy, Snyk)
- No secret detection in CI
- No signed commits enforcement
- No branch protection analysis visible

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No test type rules exist
- **Quality**: N/A
- **Gaps**: No CLAUDE.md, no AGENTS.md, no `.claude/` directory, no `.claude/rules/` directory
- **Recommendation**: Generate comprehensive rules using `/test-rules-generator` covering:
  - C++ Google Test patterns for NVIDIA and llama_cpp plugins
  - JUnit/Gradle test patterns for Java API
  - pytest patterns for Python modules
  - VS Code extension testing patterns for OpenVINO Code
  - Integration test patterns for multi-module builds

## Recommendations

### Priority 0 (Critical)

1. **Implement coverage tracking** — Start with Java API (JaCoCo + Gradle is straightforward), then add lcov for C++ modules and pytest-cov for Python modules. Configure codecov to report on PRs.

2. **Add security scanning** — Deploy CodeQL for SAST across C++, Java, Python, and TypeScript. Add Dependabot for automated dependency updates. This is a significant gap for a security-sensitive project (it processes neural network models).

3. **Write tests for OpenVINO Code** — The VS Code extension has 54 source files with zero tests. At minimum, add unit tests for the server-side Python code and the TypeScript state management. The `@vscode/test-electron` dependency is already present but unused.

### Priority 1 (High Value)

4. **Build and validate the NVIDIA Dockerfile in CI** — Add a workflow that builds the Dockerfile and runs Trivy scanning. Even without GPU hardware, validating the image builds correctly catches dependency drift.

5. **Create unified pre-commit configuration** — Aggregate clang-format, ESLint, google-java-format, ruff, and black into a single `.pre-commit-config.yaml` for consistent enforcement across all modules.

6. **Expand custom_operations testing** — Currently only 2 test files (1 pytest runner + 1 requirements file). Add dedicated unit tests for each custom operation.

7. **Add scheduled CI runs** — Currently all tests are only triggered by PRs/pushes. Add weekly/nightly runs to catch flaky tests and dependency drift.

### Priority 2 (Nice-to-Have)

8. **Create agent rules** — Add `.claude/rules/` with test patterns for each module's language and framework. This accelerates AI-assisted contributions.

9. **Add performance benchmarks** — NVIDIA plugin and llama_cpp plugin should have tracked performance regression tests, not just correctness tests.

10. **Modernize self-hosted runner usage** — The `lohika-ci` CUDA runner uses hardcoded paths (`~/runner/`). Consider containerized runners or at least parameterized paths.

11. **Add SBOM generation** — For compliance and supply chain security, generate SBOMs for build artifacts.

12. **Remove or modernize Jenkinsfile** — The legacy Jenkinsfile appears unused alongside GitHub Actions. Clean up or document its purpose.

## Comparison to Gold Standards

| Dimension | openvino_contrib | odh-dashboard | notebooks | kserve |
|-----------|-----------------|---------------|-----------|--------|
| Unit Tests | 5.0 — Fragmented across modules | 9.0 — Comprehensive Jest suite | 6.0 — Moderate | 8.0 — Strong Go tests |
| Integration/E2E | 5.5 — Some modules have E2E | 9.0 — Cypress + contract tests | 8.0 — Multi-layer | 9.0 — envtest + E2E |
| Build Integration | 3.0 — No image validation | 8.0 — Multi-mode builds | 7.0 — Image builds in CI | 7.0 — Operator builds |
| Image Testing | 1.5 — Dockerfile untested | 7.0 — Startup validation | 9.0 — 5-layer validation | 6.0 — Basic |
| Coverage Tracking | 0.5 — None | 9.0 — Codecov enforced | 5.0 — Partial | 8.0 — Enforced thresholds |
| CI/CD Automation | 6.5 — Multi-platform, caching | 9.0 — Comprehensive | 8.0 — Well-automated | 9.0 — Multi-version |
| Agent Rules | 0.0 — None | 8.0 — Comprehensive rules | 2.0 — Minimal | 3.0 — Some |

## File Paths Reference

### CI/CD
- `.github/workflows/linux.yml` — Main Linux build + Java/custom-ops tests
- `.github/workflows/windows.yml` — Windows build + tests
- `.github/workflows/mac.yml` — macOS build + tests
- `.github/workflows/test_cuda.yml` — CUDA unit + functional tests
- `.github/workflows/sanitizer_cuda.yml` — CUDA sanitizer tests
- `.github/workflows/llama_cpp_plugin_build_and_test.yml` — Llama CPP build + tests
- `.github/workflows/openvino_code.yml` — VS Code extension linting
- `.github/workflows/token_merging.yml` — Token merging pytest
- `.github/workflows/code_style.yml` — Java code style
- `Jenkinsfile` — Legacy Jenkins pipeline

### Testing
- `modules/nvidia_plugin/tests/unit/` — 71 C++ unit test files
- `modules/java_api/src/test/java/org/intel/openvino/` — 8 Java test files
- `modules/llama_cpp_plugin/tests/{common,functional,e2e}/` — Well-structured C++ test directories
- `modules/custom_operations/tests/run_tests.py` — Single pytest runner
- `modules/token_merging/tests/test_precommit.py` — Single pytest file

### Code Quality
- `modules/nvidia_plugin/.clang-format` — C++ formatting config
- `modules/llama_cpp_plugin/.clang-format` — C++ formatting config
- `modules/openvino_code/.eslintrc.js` — TypeScript ESLint config
- `modules/nvidia_plugin/utils/check.sh` — clang-format CI check script

### Container Images
- `modules/nvidia_plugin/Dockerfile` — CUDA development environment

### Security
- `SECURITY.md` — Vulnerability reporting info
- `.github/CODEOWNERS` — Module-specific code review ownership

### Build Configuration
- `modules/nvidia_plugin/CMakeLists.txt` — CUDA plugin build
- `modules/llama_cpp_plugin/CMakeLists.txt` — Llama CPP plugin build
- `modules/custom_operations/CMakeLists.txt` — Custom operations build
- `modules/openvino_code/package.json` — VS Code extension build
- `modules/token_merging/setup.py` — Token merging Python package
