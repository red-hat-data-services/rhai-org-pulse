---
repository: "openvinotoolkit/openvino_contrib"
overall_score: 4.6
scorecard:
  - dimension: "Unit Tests"
    score: 5.0
    status: "Moderate unit tests across modules (C++/Go/Python/Java) but inconsistent coverage per module"
  - dimension: "Integration/E2E"
    score: 4.0
    status: "Some E2E tests for plugins (llama_cpp, ollama) but no systematic integration testing framework"
  - dimension: "Build Integration"
    score: 3.0
    status: "No PR-time container build validation; CUDA/NVIDIA builds rely on self-hosted runners"
  - dimension: "Image Testing"
    score: 2.0
    status: "Dockerfiles present but no image runtime validation, startup testing, or scanning"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tooling — no codecov, lcov, gcov integration, no thresholds or PR reporting"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "Multi-platform CI (Linux/Windows/macOS) with ccache and concurrency control, but gaps in module coverage"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, .claude/ directory, or AI agent rules exist"
critical_gaps:
  - title: "No code coverage tracking or enforcement"
    impact: "Cannot measure test adequacy; regressions in coverage go undetected"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No container image security scanning"
    impact: "Vulnerabilities in base images and dependencies go undetected until production"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No pre-commit hooks or unified linting"
    impact: "Code style inconsistencies across polyglot modules; issues caught late in CI"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No dependency management (Dependabot/Renovate)"
    impact: "Vulnerable or outdated dependencies accumulate silently"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "Several modules lack any automated tests in CI"
    impact: "Modules like genai_optimizations, openvino_training_kit, openvino_bevfusion, android_demos have no CI test workflows"
    severity: "HIGH"
    effort: "8-16 hours"
quick_wins:
  - title: "Add Dependabot configuration for GitHub Actions and Go/Python deps"
    effort: "1-2 hours"
    impact: "Automated dependency update PRs catch vulnerabilities early"
  - title: "Add Trivy container scanning to Dockerfile-containing modules"
    effort: "2-3 hours"
    impact: "Detect critical CVEs in nvidia_plugin and ollama_openvino images before merge"
  - title: "Add codecov/lcov for C++ modules and pytest-cov for Python modules"
    effort: "4-6 hours"
    impact: "Visibility into test coverage with PR reporting"
  - title: "Add .pre-commit-config.yaml with clang-format, black/ruff, and gofmt"
    effort: "3-4 hours"
    impact: "Catch formatting and style issues before they reach CI"
recommendations:
  priority_0:
    - "Add code coverage tracking (lcov for C++, pytest-cov for Python, go cover for Go) with codecov integration and PR-level reporting"
    - "Add Trivy or Snyk scanning for container images in nvidia_plugin and ollama_openvino"
    - "Enable Dependabot for all dependency ecosystems (GitHub Actions, pip, Go modules)"
  priority_1:
    - "Create CI workflows for untested modules (genai_optimizations, openvino_training_kit, openvino_bevfusion, 3d, android_demos)"
    - "Add container image runtime validation tests for Dockerfiles"
    - "Implement unified pre-commit hooks across the monorepo"
    - "Add SAST tooling (CodeQL or Semgrep) for C++, Go, Python, and Java code"
  priority_2:
    - "Create comprehensive CLAUDE.md and .claude/rules/ for AI-assisted test generation"
    - "Add performance regression testing for inference plugins"
    - "Implement contract tests between plugin interfaces and OpenVINO core"
    - "Add multi-architecture container build validation (ARM64)"
---

# Quality Analysis: openvino_contrib

## Executive Summary

- **Overall Score: 4.6/10**
- **Repository Type**: Monorepo of OpenVINO extension modules (plugins, APIs, tools)
- **Primary Languages**: C++ (271 files), Go (174 files), Python (131 files), TypeScript/JS (29 files), Java (25 files)
- **Key Strengths**: Multi-platform CI (Linux/Windows/macOS), good concurrency control, ccache optimization, path-scoped workflows for plugins
- **Critical Gaps**: Zero coverage tracking, no container security scanning, no pre-commit hooks, no dependency management, multiple modules have no CI at all
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 5/10 | Moderate tests across modules but inconsistent per module |
| Integration/E2E | 4/10 | Some E2E for plugins but no systematic framework |
| **Build Integration** | **3/10** | **No PR-time container build validation** |
| Image Testing | 2/10 | Dockerfiles present but no runtime validation or scanning |
| Coverage Tracking | 1/10 | Zero coverage tooling of any kind |
| CI/CD Automation | 6/10 | Multi-platform CI with caching but module coverage gaps |
| Agent Rules | 0/10 | No AI agent rules exist |

## Critical Gaps

### 1. No Code Coverage Tracking or Enforcement
- **Impact**: Cannot measure test adequacy; regressions in coverage go completely undetected. No codecov, lcov, gcov, pytest-cov, or go cover integration exists anywhere in the repository.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: None of the 13 workflow files reference coverage in any form. The repository has 116+ test files but no way to measure what percentage of the codebase they exercise.

### 2. No Container Image Security Scanning
- **Impact**: The repository has 3 Dockerfiles (ollama_openvino Dockerfile, ollama_openvino Dockerfile_genai_ubuntu24, nvidia_plugin Dockerfile) but none are scanned for vulnerabilities. Base images like `nvidia/cuda:11.8.0-*` and `rocm/dev-centos-7` are known to carry CVEs.
- **Severity**: HIGH
- **Effort**: 2-4 hours

### 3. Multiple Modules Have No CI Workflows
- **Impact**: The following modules have no dedicated CI testing:
  - `genai_optimizations` — Python module with setup.py but no workflow
  - `openvino_training_kit` — Python module with 18 test files but no CI workflow
  - `openvino_bevfusion` — no workflow
  - `android_demos` — no workflow
  - `3d` — no workflow (has test.py and test-e2eOV.py but they don't run in CI)
  - `openvino-langchain` — TypeScript module with 4 test files but no CI workflow
- **Severity**: HIGH
- **Effort**: 8-16 hours

### 4. No Dependency Management
- **Impact**: No Dependabot or Renovate configuration exists. Dependencies across Go modules, Python packages, npm packages, and GitHub Actions are not automatically updated.
- **Severity**: HIGH
- **Effort**: 1-2 hours

### 5. No Pre-commit Hooks
- **Impact**: No `.pre-commit-config.yaml` found. Code style is only enforced for the Java module via the `code_style.yml` workflow. C++, Python, Go, and TypeScript have no style enforcement.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours

## Quick Wins

### 1. Add Dependabot Configuration (1-2 hours)
- **Impact**: Automated dependency update PRs for all ecosystems
- **Implementation**:
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "pip"
    directory: "/modules/token_merging"
    schedule:
      interval: "weekly"
  - package-ecosystem: "gomod"
    directory: "/modules/ollama_openvino"
    schedule:
      interval: "weekly"
```

### 2. Add Trivy Container Scanning (2-3 hours)
- **Impact**: Detect critical CVEs in container images
- **Implementation**:
```yaml
# Add to existing workflows or create .github/workflows/container-scan.yml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
```

### 3. Add Coverage Tracking (4-6 hours)
- **Impact**: Visibility into test adequacy
- For Python modules: add `pytest-cov` and upload to codecov
- For C++ modules: add `lcov` post-build step
- For Go modules: use `go test -coverprofile`

### 4. Add Pre-commit Hooks (3-4 hours)
- **Impact**: Catch formatting issues before CI
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
  - repo: https://github.com/pre-commit/mirrors-clang-format
    rev: v17.0.6
    hooks:
      - id: clang-format
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.3.0
    hooks:
      - id: ruff
      - id: ruff-format
```

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (13 workflows)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `linux.yml` | PR, push to master | Full build & test (Ubuntu 22.04) + NVIDIA plugin build |
| `windows.yml` | PR, push, merge_group | Full build & test (Windows/VS 2019) |
| `mac.yml` | PR, push to master | Full build & test (macOS) |
| `test_cuda.yml` | Push/PR to nvidia_plugin paths | CUDA plugin build on self-hosted runner |
| `sanitizer_cuda.yml` | Push to master (nvidia_plugin paths) | CUDA compute sanitizer (self-hosted) |
| `history_cuda.yml` | Push/PR to nvidia_plugin paths | History/changelog checks |
| `llama_cpp_plugin_build_and_test.yml` | PR to llama_cpp paths | Build + functional + E2E tests |
| `ollama_openvino_build_and_test.yml` | PR to ollama paths | Build + model inference test |
| `token_merging.yml` | Push/PR to token_merging paths | Python pytest |
| `code_style.yml` | Push/PR to java_api paths | Java style check (google-java-format) |
| `copyright.yml` | PR, push to master | License header check (skywalking-eyes) |
| `labeler.yml` | pull_request_target | Auto-labeling PRs |
| `assign_issue.yml` | issue_comment | Issue assignment automation |

**Strengths**:
- Multi-platform coverage (Linux, Windows, macOS) for core modules
- Concurrency control with `cancel-in-progress: true` on main workflows
- ccache integration for build acceleration (2GB cache)
- Path-scoped triggers for plugin-specific workflows (efficient CI resource usage)
- Pinned action versions with SHA hashes (supply-chain security)
- `permissions: read-all` default with granular overrides
- Separate test data repository (`openvinotoolkit/testdata`) with LFS

**Weaknesses**:
- No coverage reporting in any workflow
- No security scanning (Trivy, CodeQL, Snyk)
- Self-hosted runners for CUDA (`lohika-ci`) with hardcoded paths — fragile
- Multiple modules completely untested in CI
- No caching for Python pip installs on Linux workflow
- Legacy Jenkinsfile still present (appears unused)
- `ollama_openvino_build_and_test.yml` has a typo in path trigger (missing `.yml` extension)

### Test Coverage

**Test File Distribution**:
| Language | Test Files | Source Files | Ratio |
|----------|-----------|--------------|-------|
| Go | 54 | 174 | 0.31 |
| Python | 32 | 131 | 0.24 |
| C++ | 22 | 271 | 0.08 |
| Java | 8 | 25 | 0.32 |

**Module-by-Module Test Status**:

| Module | Tests | CI Workflow | Framework |
|--------|-------|------------|-----------|
| `nvidia_plugin` | 25+ C++ unit/functional | `test_cuda.yml` (self-hosted) | GTest |
| `ollama_openvino` | 54 Go test files | `ollama_openvino_build_and_test.yml` | Go testing |
| `llama_cpp_plugin` | 11 C++ functional/E2E | `llama_cpp_plugin_build_and_test.yml` | GTest |
| `java_api` | 8 Java test files | `linux.yml`, `windows.yml`, `mac.yml` | Gradle/JUnit |
| `custom_operations` | Python pytest | `linux.yml`, `windows.yml` | pytest |
| `token_merging` | Python pytest | `token_merging.yml` | pytest |
| `openvino_training_kit` | 18 Python test files | **NONE** | pytest (unused) |
| `openvino-langchain` | 4 TS test files | **NONE** | Jest/Vitest (unused) |
| `genai_optimizations` | **None found** | **NONE** | N/A |
| `openvino_bevfusion` | **None found** | **NONE** | N/A |
| `android_demos` | **None found** | **NONE** | N/A |
| `3d` | 2 Python test files | **NONE** | manual scripts |

**Critical Observation**: The `openvino_training_kit` module has 18 test files across PyTorch, TensorFlow, and scikit-learn frameworks but NONE of them run in CI. Similarly, `openvino-langchain` has 4 TypeScript test files with no CI workflow.

### Code Quality

**Linting/Formatting**:
- Java: `google-java-format` via `code_style.yml` workflow
- C++: No clang-format or clang-tidy configuration found
- Python: No ruff, flake8, mypy, pylint, or black configuration found
- Go: No explicit golangci-lint configuration (Go's built-in formatting may be used in ollama_openvino)
- TypeScript: `.eslintrc.json` exists only in `ollama_openvino/macapp/`
- **No unified pre-commit hooks**

**Static Analysis**:
- No CodeQL, Semgrep, or gosec integration
- No secret detection (gitleaks, trufflehog)
- License header checking via Apache SkyWalking Eyes (good)

**Contributing Guidelines**:
- `CONTRIBUTING.md` exists but is minimal — 4 sentences on PR requirements
- No testing guidelines beyond "make sure you can build the module and pass all functional tests"
- No code review checklist

### Container Images

**Dockerfiles Found**:
1. `modules/ollama_openvino/Dockerfile` — Complex multi-stage build targeting CPU/CUDA 11/CUDA 12/ROCm/JetPack; multi-arch (amd64/arm64)
2. `modules/ollama_openvino/Dockerfile_genai_ubuntu24` — GenAI-focused variant
3. `modules/nvidia_plugin/Dockerfile` — CUDA 11.8 development environment

**Strengths**:
- Multi-stage builds in ollama_openvino Dockerfile (good practice)
- Multi-architecture support (amd64/arm64) with JetPack variants
- Build cache usage with `--mount=type=cache`

**Weaknesses**:
- No container image scanning (Trivy, Snyk, Grype)
- No SBOM generation
- No image signing or attestation
- No startup/runtime validation tests
- No `.dockerignore` for ollama_openvino or nvidia_plugin (only 3d/pointPillars has one)
- nvidia_plugin Dockerfile installs from URLs without checksum verification

### Security

**Present**:
- `SECURITY.md` files in root, ollama_openvino, and nvidia_plugin
- License header enforcement via CI
- Pinned GitHub Action versions with SHA hashes (supply-chain hardening)
- `permissions: read-all` default across workflows

**Missing**:
- No SAST (CodeQL, Semgrep, gosec)
- No dependency scanning (Dependabot, Renovate, Snyk)
- No secret detection (gitleaks, trufflehog)
- No container scanning (Trivy, Grype)
- No SBOM generation
- No signed releases or image attestation

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: Complete absence of AI agent rules for test generation, code review, or development workflows
- **Recommendation**: Generate comprehensive rules with `/test-rules-generator` covering C++ (GTest), Python (pytest), Go (testing), Java (JUnit/Gradle), and TypeScript (Jest) patterns

## Recommendations

### Priority 0 (Critical)

1. **Add code coverage tracking** — Integrate lcov for C++ modules, pytest-cov for Python, `go test -coverprofile` for Go, and JaCoCo for Java. Set up codecov.io with PR-level coverage reporting and enforce minimum thresholds (start at 30%, ramp up).

2. **Add container image vulnerability scanning** — Add Trivy scanning as a workflow step for all Dockerfile-containing modules. Block merge on CRITICAL severity findings.

3. **Enable Dependabot** — Create `.github/dependabot.yml` covering github-actions, pip, gomod, and npm ecosystems with weekly update schedules.

4. **Create CI workflows for untested modules** — Prioritize `openvino_training_kit` (18 existing test files!) and `openvino-langchain` (4 existing test files) since tests already exist but just aren't running.

### Priority 1 (High Value)

5. **Add SAST with CodeQL** — Enable CodeQL for C++, Python, Go, and Java analysis on PR and push events. This catches security vulnerabilities and code quality issues across all primary languages.

6. **Implement unified pre-commit hooks** — Create `.pre-commit-config.yaml` with clang-format for C++, ruff for Python, gofmt for Go, and google-java-format for Java. Enforce via CI as a fast-fail first step.

7. **Add container image runtime validation** — For ollama_openvino, add a CI step that builds the image and verifies it starts successfully (basic health check). For nvidia_plugin, verify the development image builds correctly.

8. **Fix ollama_openvino workflow trigger** — The path filter in `ollama_openvino_build_and_test.yml` references `.github/workflows/ollama_openvino_build_and_test` (missing `.yml` extension), so workflow changes won't trigger the pipeline.

### Priority 2 (Nice-to-Have)

9. **Create comprehensive CLAUDE.md and agent rules** — Define test creation patterns for each language/framework used in the repo. Include module-specific testing guidelines.

10. **Add performance regression testing** — For inference plugins (nvidia_plugin, llama_cpp_plugin), add benchmark tracking to detect performance regressions.

11. **Implement contract tests** — Verify plugin interfaces match OpenVINO core API expectations across version updates.

12. **Clean up legacy Jenkinsfile** — The root `Jenkinsfile` references a shared library pipeline but appears to be superseded by GitHub Actions. Remove if unused.

13. **Add `.dockerignore` files** — Missing from ollama_openvino and nvidia_plugin, leading to unnecessarily large build contexts.

## Comparison to Gold Standards

| Practice | openvino_contrib | odh-dashboard | notebooks | kserve |
|----------|-----------------|---------------|-----------|--------|
| Multi-platform CI | Linux/Win/Mac | Linux | Linux | Linux |
| Coverage tracking | None | Codecov | Partial | Codecov |
| Coverage enforcement | None | PR gates | Partial | Thresholds |
| Container scanning | None | Trivy | Trivy | Trivy |
| Pre-commit hooks | None | Comprehensive | Basic | Yes |
| SAST/CodeQL | None | CodeQL | N/A | CodeQL |
| Dependency management | None | Dependabot | Dependabot | Dependabot |
| E2E testing | Partial (2 plugins) | Cypress + API | Image validation | KServe predictor |
| Agent rules | None | Comprehensive | None | Partial |
| Secret detection | None | Gitleaks | None | None |
| Build caching | ccache (good) | npm cache | pip cache | Go cache |
| Concurrency control | Yes | Yes | Yes | Yes |

## File Paths Reference

### CI/CD
- `.github/workflows/linux.yml` — Main Linux build & test
- `.github/workflows/windows.yml` — Main Windows build & test
- `.github/workflows/mac.yml` — Main macOS build & test
- `.github/workflows/test_cuda.yml` — NVIDIA CUDA tests
- `.github/workflows/llama_cpp_plugin_build_and_test.yml` — llama.cpp plugin CI
- `.github/workflows/ollama_openvino_build_and_test.yml` — Ollama OpenVINO CI
- `.github/workflows/token_merging.yml` — Token merging Python tests
- `.github/workflows/code_style.yml` — Java code style
- `.github/workflows/copyright.yml` — License header enforcement
- `Jenkinsfile` — Legacy CI (possibly unused)

### Testing
- `modules/nvidia_plugin/tests/unit/` — CUDA unit tests (GTest)
- `modules/nvidia_plugin/tests/functional/` — CUDA functional tests
- `modules/llama_cpp_plugin/tests/` — llama.cpp functional + E2E tests
- `modules/ollama_openvino/` — Extensive Go tests throughout
- `modules/java_api/src/test/` — Java API tests
- `modules/custom_operations/tests/` — Custom ops Python tests
- `modules/token_merging/tests/` — Token merging Python tests
- `modules/openvino_training_kit/tests/` — Training kit tests (NOT IN CI)
- `modules/openvino-langchain/src/tests/` — LangChain tests (NOT IN CI)

### Container Images
- `modules/ollama_openvino/Dockerfile` — Multi-stage, multi-arch ollama build
- `modules/ollama_openvino/Dockerfile_genai_ubuntu24` — GenAI variant
- `modules/nvidia_plugin/Dockerfile` — CUDA development environment

### Configuration
- `.licenserc.yaml` — License header configuration
- `.github/labeler.yml` — PR auto-labeling rules
- `CONTRIBUTING.md` — Contribution guidelines (minimal)
- `SECURITY.md` — Security policy
