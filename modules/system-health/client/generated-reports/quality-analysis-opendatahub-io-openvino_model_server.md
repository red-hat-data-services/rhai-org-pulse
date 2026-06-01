---
repository: "opendatahub-io/openvino_model_server"
overall_score: 5.9
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Extensive C++ unit tests (98 files, 75K LOC) using GTest with Bazel, strong test-to-code ratio"
  - dimension: "Integration/E2E"
    score: 6.5
    status: "Functional tests via pytest with Docker-based model server, Konflux-triggered integration workflow"
  - dimension: "Build Integration"
    score: 6.0
    status: "Konflux-triggered integration tests post-build, but no PR-time build validation"
  - dimension: "Image Testing"
    score: 5.5
    status: "File integrity tests and runtime functional tests, but no vulnerability scanning in CI"
  - dimension: "Coverage Tracking"
    score: 5.0
    status: "Bazel coverage support with thresholds (76.8% lines, 87.6% functions) but no PR-time enforcement or codecov integration"
  - dimension: "CI/CD Automation"
    score: 5.5
    status: "Jenkins primary CI with GitHub Actions for Konflux integration; PR checks limited to style and SDL"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, .claude/ directory, or agent rules present"
critical_gaps:
  - title: "No PR-time unit test or build validation in GitHub Actions"
    impact: "Unit tests and builds only run in Jenkins, not visible in GitHub PR checks"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No container vulnerability scanning (Trivy/Snyk) in CI"
    impact: "Security vulnerabilities in container images not detected until production"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No codecov/coveralls integration for PR coverage reporting"
    impact: "Coverage regressions not caught during PR review"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No pre-commit hooks configuration"
    impact: "Style and security checks not enforced locally before push"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No SAST/CodeQL integration"
    impact: "Static analysis security vulnerabilities not systematically detected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents lack guidance on test patterns, coding standards, and project conventions"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Detect CVEs in base images and dependencies before merge"
  - title: "Add CodeQL/SAST workflow for C++ analysis"
    effort: "2-3 hours"
    impact: "Catch memory safety, buffer overflow, and injection vulnerabilities"
  - title: "Add .pre-commit-config.yaml with existing checks"
    effort: "1-2 hours"
    impact: "Enforce style, spelling, and security checks before commits"
  - title: "Create basic CLAUDE.md with test patterns"
    effort: "2-3 hours"
    impact: "Guide AI agents on project conventions and test requirements"
recommendations:
  priority_0:
    - "Add PR-time unit test execution via GitHub Actions (even a subset) to provide visibility in PR checks"
    - "Integrate Trivy scanning for Dockerfile.redhat and Dockerfile.ubuntu in PR workflow"
    - "Add CodeQL analysis workflow for C++ source code"
  priority_1:
    - "Integrate codecov with coverage thresholds for PR enforcement"
    - "Add pre-commit hooks configuration (.pre-commit-config.yaml)"
    - "Create comprehensive agent rules (.claude/rules/) for test automation"
    - "Add dependency scanning (Dependabot/Renovate) for Python test dependencies"
  priority_2:
    - "Add multi-architecture container builds (ARM64 support)"
    - "Add SBOM generation for container images"
    - "Implement chaos/resilience testing for model serving under load"
    - "Add contract tests for gRPC/REST API interfaces"
---

# Quality Analysis: openvino_model_server

## Executive Summary

- **Overall Score: 5.9/10**
- **Repository Type**: C++ model serving application (OpenVINO inference engine)
- **Primary Language**: C++ with Bazel build system, Python functional tests
- **Build System**: Bazel (C++ core), Docker multi-stage (release images), Jenkins (primary CI), GitHub Actions (Konflux integration)

**Key Strengths**:
- Extensive C++ unit test suite (98 test files, ~75K lines of test code) with GTest framework
- Strong test-to-code ratio (~1.7:1 test-to-source lines)
- Coverage threshold enforcement (76.8% lines, 87.6% functions)
- Comprehensive functional test suite (13 Python test files) with Docker-based model server testing
- SDL security checks (hadolint, bandit, checksec, forbidden functions)
- Performance testing (latency and throughput benchmarks)
- Konflux integration workflow with automated image testing

**Critical Gaps**:
- No PR-time unit test execution in GitHub Actions (relies entirely on Jenkins)
- No container vulnerability scanning (Trivy/Snyk) in CI
- No SAST/CodeQL integration for C++ code analysis
- No codecov/coveralls PR coverage reporting
- No pre-commit hooks
- No agent rules or AI development guidance

**Agent Rules Status**: Missing — no CLAUDE.md, .claude/ directory, or test automation guidance

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | Extensive GTest suite (98 files, 75K LOC), but not run in GitHub PR checks |
| Integration/E2E | 6.5/10 | Functional pytest suite + Konflux-triggered integration, performance tests |
| Build Integration | 6.0/10 | Konflux post-build integration tests; no PR-time build validation in GH Actions |
| Image Testing | 5.5/10 | File integrity & runtime testing, but no vulnerability scanning |
| Coverage Tracking | 5.0/10 | Bazel coverage with thresholds, but no PR-time enforcement or reporting |
| CI/CD Automation | 5.5/10 | Jenkins primary CI, GH Actions for Konflux/SDL/style only |
| Agent Rules | 0.0/10 | No agent rules, CLAUDE.md, or AI development guidance |

## Critical Gaps

### 1. No PR-Time Unit Test Execution in GitHub Actions
- **Impact**: Unit tests only run in Jenkins (ci/build_test_OnCommit.groovy), not visible in GitHub PR checks
- **Severity**: HIGH
- **Current State**: GitHub Actions only runs style checks and SDL checks on PRs; unit tests require Jenkins
- **Effort**: 8-16 hours (complex due to Bazel build requirements)
- **Why It Matters**: Contributors cannot see test results directly in GitHub PRs; relies on external CI

### 2. No Container Vulnerability Scanning
- **Impact**: CVEs in base images (UBI 9.6, Ubuntu 22.04) and dependencies not detected in CI
- **Severity**: HIGH
- **Current State**: hadolint checks Dockerfile syntax but no runtime vulnerability scanning
- **Effort**: 2-4 hours

### 3. No SAST/CodeQL Integration
- **Impact**: Memory safety issues, buffer overflows, and injection vulnerabilities in C++ code not systematically detected
- **Severity**: HIGH
- **Current State**: Bandit scans Python demos, cpplint checks style, but no deep static analysis for C++
- **Effort**: 2-4 hours

### 4. No PR Coverage Reporting
- **Impact**: Coverage regressions not visible during code review
- **Severity**: HIGH
- **Current State**: Coverage threshold (76.8% lines) exists in check_coverage.bat but not integrated with any PR reporting tool
- **Effort**: 4-8 hours

### 5. No Pre-Commit Hooks
- **Impact**: Style and security checks not enforced locally
- **Severity**: MEDIUM
- **Effort**: 2-3 hours

### 6. No Agent Rules
- **Impact**: AI agents have no guidance on project conventions, test patterns, or coding standards
- **Severity**: MEDIUM
- **Effort**: 4-6 hours

## Quick Wins

### 1. Add Trivy Container Scanning (1-2 hours)
Add to `.github/workflows/security-checks.yml`:
```yaml
  trivy-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'HIGH,CRITICAL'
```

### 2. Add CodeQL for C++ (2-3 hours)
Create `.github/workflows/codeql.yml` with C++ analysis.

### 3. Add Pre-Commit Hooks (1-2 hours)
Create `.pre-commit-config.yaml` wrapping existing cpplint, clang-format, bandit, and codespell checks.

### 4. Create Basic Agent Rules (2-3 hours)
Generate `.claude/rules/` with unit test patterns for GTest, functional test patterns for pytest, and Bazel build conventions.

## Detailed Findings

### CI/CD Pipeline

**GitHub Actions Workflows (5 workflows):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `style-checks.yml` | PR to stable* | cpplint, clang-format, cppclean, codespell |
| `security-checks.yml` | PR to stable* | hadolint, bandit, license-headers, forbidden functions |
| `security-checks-comment.yml` | workflow_run | Posts SDL check results as PR comments |
| `integration-tests-konflux.yml` | check_run (Konflux), manual | Post-build integration tests (file integrity, Python clients, latency, throughput, functional) |
| `prow-merge-stable-to-rhoai.yml` | manual | Syncs stable branch to rhoai branch |

**Jenkins Pipelines (5 Groovy scripts):**
- `build_test_OnCommit.groovy` — Primary CI: builds Docker images, runs unit tests, style checks (triggered by smart diff detection)
- `buildOnMain.groovy` — Rebuilds ubuntu/redhat images on main branch
- `buildOnDevelop.groovy` — Development branch builds
- `build_test_OnCommitWin.groovy` — Windows build pipeline
- `loadWin.groovy` — Windows load testing

**Key Observations**:
- Jenkins is the primary CI system but not visible in GitHub PR checks
- GitHub Actions only handles style/SDL checks and Konflux-triggered integration
- Smart diff detection in Jenkins determines which tests to run based on changed files
- No caching strategy in GitHub Actions workflows
- No concurrency control in workflows

### Test Coverage

**Unit Tests (C++, GTest, Bazel):**
- 98 dedicated test files in `src/test/`
- 124 total C++ files in test directory (including utilities)
- ~75,290 lines of test code vs ~43,334 lines of source code
- **Test-to-code ratio: 1.74:1** (excellent)
- Tests cover: REST parsing, tensor operations, serialization, model management, embeddings, reranking, LLM, mediapipe, custom nodes, ensemble pipelines, CAPI, stress tests, and more
- Bazel-based test execution with `bazel test //src:ovms_test`

**Functional Tests (Python, pytest):**
- 13 test files in `tests/functional/`
- ~5,794 lines of test code
- Tests cover: single model serving, multi-model, batching, reshaping, model version policy, S3/GCS backends, LLM JSON, mapping, updates
- Docker-based test execution (starts model server container, runs tests against it)
- Uses pytest with JSON reporting

**Client Library Tests (Python):**
- Tests in `client/python/ovmsclient/lib/tests/`
- Covers gRPC and HTTP clients (requests, responses, tensors, serving client)
- Has a dedicated pytest.ini configuration

**Performance Tests:**
- Latency benchmarks (gRPC inference with resnet50-binary)
- Throughput benchmarks (parallel gRPC streams)
- Both run as Konflux integration tests

**Coverage:**
- Bazel coverage support via `bazel coverage --instrumentation_filter` with lcov
- Threshold enforcement: 76.8% line coverage (Ubuntu), 75.6% (RHEL); 87.6% function coverage (Ubuntu), 73.0% (RHEL)
- HTML report generation via genhtml
- No PR-time coverage reporting (codecov/coveralls)

### Code Quality

**Style Checks:**
- cpplint with custom filters (120 char line length, specific rule exclusions)
- clang-format with comprehensive `.clang-format` configuration (LLVM-based, 4-space indent)
- cppclean for unused includes and dead code
- codespell for spelling with whitelist

**Python Security:**
- Bandit scans on `demos/` and `client/python/` directories
- No ruff/flake8/mypy for Python type checking or linting

**Docker Security:**
- hadolint on Dockerfiles with specific rule ignores
- Proxy detection in release Dockerfiles
- checksec on compiled binaries (verifying RELRO, PIE, NX, etc.)
- Forbidden functions detection

**Missing:**
- No pre-commit hooks configuration
- No CodeQL/Semgrep for C++ static analysis
- No Gitleaks/TruffleHog for secret detection
- No dependency scanning (Dependabot/Renovate)

### Container Images

**Dockerfiles:**
- `Dockerfile.redhat` (430 lines) — UBI 9.6 base, multi-stage build (base_build → build → pkg → release)
- `Dockerfile.ubuntu` (458 lines) — Ubuntu 22.04/24.04 base, same multi-stage pattern
- Both use hadolint annotations for known exceptions

**Build Features:**
- Multi-stage builds with proper separation (build → package → release)
- Non-root user (ovms, UID 5000) in release images
- GPU and NPU support via build args
- OpenVINO binary distribution packaging
- SHA256 checksum verification for packages

**Runtime Testing:**
- File integrity tests (`tests/file_lists/test_release_files.sh`)
- Python client tests against running container
- Functional tests against Docker-deployed server
- Latency and throughput performance tests

**Missing:**
- No Trivy/Snyk vulnerability scanning
- No SBOM generation
- No multi-architecture builds (x86_64 only)
- No image signing/attestation

### Security

**Existing Practices:**
- SDL (Security Development Lifecycle) checks as a workflow
- Bandit for Python security scanning
- hadolint for Dockerfile best practices
- checksec for binary hardening verification (RELRO, PIE, NX)
- Forbidden functions detection in source code
- License header enforcement
- Non-root container execution
- hadolint ignore annotations with specific justifications

**Missing:**
- No container image vulnerability scanning (Trivy/Snyk)
- No SAST/CodeQL for C++ code
- No secret detection (Gitleaks)
- No dependency vulnerability scanning
- No SBOM generation
- Security check failures are non-blocking (continue-on-error for PRs)

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/`, `CLAUDE.md`, or `AGENTS.md`
- **Quality**: N/A
- **Gaps**: Complete absence of agent rules
- **Recommendation**: Generate comprehensive rules with `/test-rules-generator` covering:
  - GTest unit test patterns for C++ model server code
  - Bazel build conventions and test targets
  - pytest functional test patterns for Docker-based testing
  - SDL/security check requirements for PRs

## Recommendations

### Priority 0 (Critical)

1. **Add PR-time build/test visibility in GitHub Actions**
   - Even a lightweight smoke test or unit test subset would improve PR review confidence
   - Consider a containerized Bazel test step for key test suites
   - Alternatively, integrate Jenkins results back into GitHub status checks

2. **Integrate Trivy container scanning in CI**
   - Scan both Dockerfile.redhat and Dockerfile.ubuntu base images
   - Set severity thresholds (HIGH, CRITICAL)
   - Block PRs on critical CVEs

3. **Add CodeQL/SAST for C++ source analysis**
   - Enable CodeQL C++ analysis workflow
   - Focus on memory safety, buffer overflows, and injection

### Priority 1 (High Value)

4. **Integrate codecov with PR coverage reporting**
   - Upload Bazel coverage reports to codecov
   - Set coverage thresholds matching existing minimums (76.8% lines)
   - Require coverage reports in PR checks

5. **Add pre-commit hooks (.pre-commit-config.yaml)**
   - Wrap existing cpplint, clang-format, codespell, and bandit checks
   - Add trailing whitespace and merge conflict detection

6. **Create comprehensive agent rules**
   - `.claude/rules/unit-tests.md` — GTest patterns, Bazel targets
   - `.claude/rules/functional-tests.md` — pytest with Docker model server
   - `.claude/rules/build.md` — Bazel build conventions
   - `.claude/rules/security.md` — SDL check requirements

7. **Add Dependabot/Renovate for dependency management**
   - Track Python test dependencies (tests/requirements.txt)
   - Track ci/style_requirements.txt

### Priority 2 (Nice-to-Have)

8. **Add multi-architecture container builds (ARM64)**
   - OpenVINO has ARM support; extend Dockerfile for cross-platform

9. **Add SBOM generation**
   - Generate CycloneDX or SPDX SBOMs during image build
   - Integrate with release process

10. **Add contract tests for gRPC/REST API**
    - Define API contracts for TensorFlow Serving compatible interface
    - Ensure backward compatibility across versions

11. **Implement chaos/resilience testing**
    - Test model server behavior under resource constraints
    - Validate graceful degradation and recovery

## Comparison to Gold Standards

| Dimension | OVMS | odh-dashboard | notebooks | kserve |
|-----------|------|---------------|-----------|--------|
| Unit Tests | 7.5 (GTest, 98 files) | 9.0 (Jest, comprehensive) | 6.0 | 8.0 (Go testing) |
| Integration/E2E | 6.5 (pytest + Konflux) | 9.0 (Cypress + contract) | 7.0 | 9.0 (multi-version) |
| Build Integration | 6.0 (Konflux post-build) | 7.0 (Konflux sim) | 5.0 | 6.0 |
| Image Testing | 5.5 (file integrity + runtime) | 7.0 | 9.0 (5-layer) | 6.0 |
| Coverage | 5.0 (threshold, no PR reporting) | 8.0 (codecov) | 5.0 | 8.0 (codecov) |
| CI/CD | 5.5 (Jenkins + GH Actions split) | 9.0 (comprehensive GH Actions) | 7.0 | 8.0 |
| Agent Rules | 0.0 | 8.0 (comprehensive) | 2.0 | 2.0 |
| **Overall** | **5.9** | **8.1** | **6.0** | **7.0** |

## File Paths Reference

### CI/CD
- `.github/workflows/style-checks.yml` — Style checks (cpplint, clang-format)
- `.github/workflows/security-checks.yml` — SDL security checks
- `.github/workflows/security-checks-comment.yml` — PR comment for SDL results
- `.github/workflows/integration-tests-konflux.yml` — Konflux-triggered integration tests
- `.github/workflows/prow-merge-stable-to-rhoai.yml` — Branch sync automation
- `ci/build_test_OnCommit.groovy` — Primary Jenkins CI pipeline
- `ci/buildOnMain.groovy` — Main branch Jenkins pipeline
- `ci/build_test_OnCommitWin.groovy` — Windows Jenkins pipeline

### Testing
- `src/test/*.cpp` — C++ unit tests (98 files, GTest)
- `tests/functional/` — Python functional tests (13 files, pytest)
- `tests/performance/` — Performance benchmarks (latency, throughput)
- `tests/python/` — Python client integration tests
- `client/python/ovmsclient/lib/tests/` — Client library tests
- `tests/file_lists/` — File integrity tests
- `run_unit_tests.sh` — Unit test runner script

### Code Quality
- `.clang-format` — C++ formatting rules
- `ci/bandit.sh` — Python security scanning
- `ci/cppclean.sh` — Dead code detection
- `ci/lib_search.py` — License headers and forbidden functions
- `ci/style_requirements.txt` — Style check Python dependencies
- `tests/hadolint.sh` — Dockerfile linting

### Build
- `Dockerfile.redhat` — Red Hat UBI 9 container build (430 lines)
- `Dockerfile.ubuntu` — Ubuntu container build (458 lines)
- `Makefile` — Build and test orchestration
- `MakefileCapi` — CAPI-specific build
- `.bazelrc` — Bazel configuration
- `BUILD.bazel` — Root Bazel build file
- `common_settings.bzl` — Shared Bazel settings

### Coverage
- `ci/check_coverage.bat` — Coverage threshold verification (76.8% lines, 87.6% functions)
- Coverage generated via `bazel coverage --instrumentation_filter` with lcov

### Security
- `tests/hadolint.sh` — Dockerfile security linting
- `ci/bandit.sh` — Python SAST scanning
- `security.md` — Security reporting guidelines
- `.github/pull_request_template.md` — PR checklist includes security best practices
