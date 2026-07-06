---
repository: "red-hat-data-services/openvino_model_server"
overall_score: 7.4
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Extensive C++ unit tests (149 files, 100K+ LOC) with Google Test, coverage thresholds enforced (76% line, 83% function)"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Comprehensive functional tests, Python client tests, performance tests (latency + throughput), file integrity checks via CI"
  - dimension: "Build Integration"
    score: 7.5
    status: "Dual CI pipelines (Prow + Konflux), image-based integration testing triggered on PR build completion, but no PR-time image build in GitHub Actions"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage Dockerfiles (UBI9 + Ubuntu), runtime validation via file integrity and functional tests against built image, but no container scanning in CI"
  - dimension: "Coverage Tracking"
    score: 7.5
    status: "Bazel coverage with lcov, enforced thresholds (76% lines / 83% functions), genhtml reports, but no codecov/coveralls PR integration"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "3 GitHub Actions workflows (fast-checks, integration, Konflux integration), but limited to style checks on PRs; heavy testing requires external Prow/Konflux builds"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory — zero AI agent guidance"
critical_gaps:
  - title: "No container image vulnerability scanning in CI"
    impact: "CVEs in base images or dependencies not detected until downstream scanning"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No SAST/CodeQL integration for C++ codebase"
    impact: "Memory safety and security bugs in 78K+ lines of C++ not caught by static analysis in CI"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No PR-time codecov/coveralls integration"
    impact: "Coverage regressions not visible on PR reviews; coverage only checked during Docker build with CHECK_COVERAGE=1"
    severity: "MEDIUM"
    effort: "3-4 hours"
  - title: "Integration tests are event-triggered, not PR-triggered"
    impact: "Integration tests only run after external Prow/Konflux builds complete; latency between code push and test feedback is high"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents cannot leverage project-specific test patterns, coding standards, or build conventions"
    severity: "LOW"
    effort: "4-6 hours"
quick_wins:
  - title: "Add Trivy scanning to fast-checks workflow"
    effort: "1-2 hours"
    impact: "Detect known CVEs in Dockerfiles and dependencies on every PR"
  - title: "Add CodeQL analysis workflow for C++"
    effort: "2-3 hours"
    impact: "Catch memory safety, injection, and other security bugs automatically"
  - title: "Create basic CLAUDE.md with build/test instructions"
    effort: "1-2 hours"
    impact: "Enable AI agents to understand repo structure, build system (Bazel), and test patterns"
  - title: "Add codecov integration to coverage workflow"
    effort: "2-3 hours"
    impact: "PR-level coverage diff reporting and enforcement"
recommendations:
  priority_0:
    - "Add container vulnerability scanning (Trivy) to PR workflow to catch CVEs before merge"
    - "Add CodeQL or Semgrep SAST analysis for the C++ codebase"
  priority_1:
    - "Integrate codecov for PR-level coverage reporting and diff coverage enforcement"
    - "Add secret detection (Gitleaks) to prevent credential leaks"
    - "Create comprehensive CLAUDE.md and .claude/rules/ for AI-assisted development"
  priority_2:
    - "Add multi-architecture image builds (ARM64) for broader platform support"
    - "Add Dockerfile best-practice linting (hadolint) to PR checks (currently only in sdl-check)"
    - "Consider adding fuzz testing for gRPC/REST request parsing"
---

# Quality Analysis: OpenVINO Model Server (Red Hat Fork)

## Executive Summary

- **Overall Score: 7.4/10**
- **Repository Type**: C++/Python model serving application with Bazel build system
- **Primary Languages**: C++ (core server), Python (tests, client library, demos)
- **Framework**: OpenVINO inference engine, gRPC/REST serving, MediaPipe integration
- **Key Strengths**: Extensive unit test suite (149 C++ test files, 100K+ test LOC), enforced coverage thresholds, multi-layer security checks (SDL, bandit, checksec, forbidden functions), comprehensive functional/performance test infrastructure
- **Critical Gaps**: No container scanning in CI, no SAST/CodeQL for C++ code, no PR-level coverage reporting, no AI agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Extensive C++ unit tests (149 files, 100K+ LOC) with Google Test, coverage thresholds enforced |
| Integration/E2E | 8.0/10 | Comprehensive functional tests, Python client tests, performance tests via CI |
| **Build Integration** | **7.5/10** | **Dual CI pipelines (Prow + Konflux), image-based integration testing** |
| Image Testing | 7.0/10 | Multi-stage Dockerfiles, runtime validation, but no container scanning |
| Coverage Tracking | 7.5/10 | Bazel coverage + lcov with enforced thresholds, but no PR-level codecov |
| CI/CD Automation | 7.0/10 | 3 GitHub Actions workflows, but integration tests require external build triggers |
| Agent Rules | 0.0/10 | No AI agent guidance whatsoever |

## Critical Gaps

### 1. No Container Image Vulnerability Scanning in CI
- **Impact**: CVEs in UBI9 base images, Python packages, and C++ dependencies not detected until downstream Konflux/product scanning
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Neither the `fast-checks.yml` nor the `integration-tests.yml` workflows include Trivy, Snyk, or Grype scanning. The `Dockerfile.redhat` pulls from `registry.access.redhat.com/ubi9/ubi:9.7` and installs EPEL packages, wget-fetched RPMs, and source-built libraries — all without vulnerability scanning.

### 2. No SAST/CodeQL Integration for C++ Codebase
- **Impact**: Memory safety bugs, buffer overflows, injection vulnerabilities in 78K+ lines of C++ server code not caught by static analysis
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The repository has 491 C++ source files. While cpplint and clang-format are used for style, no semantic static analysis (CodeQL, Semgrep, cppcheck, or Coverity) is integrated into CI. The `ci/Dockerfile.coverity` suggests historical Coverity usage but it's not in the GitHub Actions pipeline.

### 3. No PR-Level Coverage Reporting
- **Impact**: Developers don't see coverage impact of their changes during PR review
- **Severity**: MEDIUM
- **Effort**: 3-4 hours
- **Details**: Coverage is generated via `bazel coverage` with lcov and enforced by `ci/check_coverage.bat` (76% line minimum, 83% function minimum), but this only runs when `CHECK_COVERAGE=1` is passed during Docker build. No codecov/coveralls integration reports coverage diffs on PRs.

### 4. Integration Tests Not Directly PR-Triggered
- **Impact**: Long feedback loop — integration tests only fire after external Prow or Konflux successfully builds and mirrors the image
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Details**: `integration-tests.yml` triggers on `status` events (when Prow completes `ci/prow/pr-image-mirror-stable`) or manual dispatch. `integration-tests-konflux.yml` similarly waits for Konflux build status. While this ensures tests run against the actual built image, it creates a multi-hop delay.

## Quick Wins

### 1. Add Trivy Scanning to fast-checks Workflow (1-2 hours)
```yaml
# Add to .github/workflows/fast-checks.yml
trivy-scan:
  name: Trivy Vulnerability Scan
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        severity: 'CRITICAL,HIGH'
        exit-code: '1'
```

### 2. Add CodeQL Analysis (2-3 hours)
```yaml
# .github/workflows/codeql.yml
name: CodeQL Analysis
on:
  pull_request:
    branches: ['stable*']
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: cpp, python
      - uses: github/codeql-action/analyze@v3
```

### 3. Create Basic CLAUDE.md (1-2 hours)
Provide AI agents with build/test context:
```markdown
# OpenVINO Model Server
## Build: `bazel build --config=mp_on_py_on --//:distro=redhat //src:ovms`
## Unit Tests: `bazel test //src:ovms_test`
## Style: `make style`
## C++ with Google Test, Python functional tests with pytest
```

### 4. Add Codecov Integration (2-3 hours)
Upload lcov reports to codecov for PR-level coverage visibility.

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory** (3 workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `fast-checks.yml` | PR to `stable*` + dispatch | Style checks, SDL security, client lib tests |
| `integration-tests.yml` | Prow status event + dispatch | Pull built image, run file integrity, functional, performance tests |
| `integration-tests-konflux.yml` | Konflux status event + dispatch | Same as above, triggered by Konflux builds |

**Strengths**:
- Well-structured event-driven pipeline: fast checks on PR, integration tests after image build
- Parallel test execution: file integrity, client tests, latency, throughput, and functional tests run concurrently
- Status reporting back to PR commits for each test suite
- Smart PR detection: finds the PR from commit SHA and handles multiple PRs

**Gaps**:
- No concurrency control on workflows (multiple runs for same PR can overlap)
- No caching in GitHub Actions workflows
- Client library tests only run when `client/python/ovmsclient/lib/**` changes (good filtering, but means other Python changes skip these tests)
- No workflow for running unit tests (those run inside Docker build)

### Test Coverage

**Unit Tests (C++)**:
- **149 test files** in `src/test/`
- **~100,859 lines** of test code (vs ~77,917 lines of source code)
- **Test-to-code ratio**: 1.29:1 (excellent)
- **Framework**: Google Test (via Bazel `@com_google_googletest`)
- **Areas covered**: REST/gRPC parsers, model management, custom nodes, ensembles, MediaPipe, LLM endpoints, embeddings, reranking, streaming, serialization, schema validation, configuration, storage backends (Azure, GCS, S3, local), GPU/remote tensors
- **LLM-specific tests**: Output parsers for Llama3, Mistral, Hermes3, Phi4, Qwen3, DevStral, GPT-OSS; assisted decoding; visual language models; tokenization

**Functional Tests (Python)**:
- Located in `tests/functional/` — 4 test files + extensive support infrastructure
- Uses pytest with JSON reporting
- Tests model reshaping, version handling, version policies, LLM JSON output
- Runs against the actual built Docker image

**Performance Tests**:
- Latency tests: `tests/performance/grpc_latency.py`
- Throughput tests: `tests/performance/grpc_throughput.sh`
- Both run against the built Docker image in CI

**Client Library Tests**:
- Python client tests build a test Docker image, launch OVMS container, run tests against it
- Tests only triggered when client library source changes

**Python Binding Tests**:
- `src/python/binding/tests/` — Bazel-managed Python binding tests
- Run as part of unit test suite

**Coverage Tracking**:
- Bazel `coverage` command with `--instrumentation_filter="-src/test"` and `--combined_report=lcov`
- lcov filtering to extract only `src/*` (excluding `src/test/*` and `external/*`)
- genhtml report generation
- **Enforced thresholds**: 76% line coverage, 83% function coverage
- Checked via `ci/check_coverage.bat`
- **Gap**: No automated codecov/coveralls integration for PR-level reporting

### Code Quality

**Style/Formatting**:
- `.clang-format` — LLVM-based with custom rules (4-space indent, 120-char lines)
- `cpplint` — Google C++ style checking with custom filters
- `cppclean` — Dead code detection
- Spell checker for documentation
- All enforced via `make style` target in `fast-checks.yml`

**Security (SDL)**:
- `make sdl-check` target combines: hadolint, bandit, license-headers, forbidden functions check
- **hadolint**: Dockerfile linting via `tests/hadolint.sh`
- **Bandit**: Python security scanner for demos and client code
- **Forbidden functions**: Custom `ci/lib_search.py` scans for dangerous C/C++ functions
- **checksec**: Binary security validation (RELRO, PIE, stack protection)
- **License headers**: Ensures all source files have proper license headers

**Gaps**:
- No SAST (CodeQL, Semgrep, cppcheck) for C++ semantic analysis
- No secret detection (Gitleaks, TruffleHog)
- No dependency scanning (Dependabot, Renovate) configured
- Bandit only scans demos and client, not the main test suite

### Container Images

**Dockerfiles**:
- `Dockerfile.redhat` — Production Red Hat UBI9-based, 4-stage build (base_build → build → capi-build → pkg → release)
- `Dockerfile.konflux` — Identical to redhat but with Konflux-specific workarounds (output base for locating binaries)
- `Dockerfile.ubuntu` — Ubuntu-based alternative

**Build Process**:
- Complex multi-stage build: OpenVINO from source or binary, OpenVINO Tokenizers, GenAI, Azure SDK, OpenCV, Boost, Bazel
- Build-time unit test execution when `RUN_TESTS=1`
- Binary validation: `ovms --version` smoke test in build stage
- C-API benchmark test in capi-build stage

**Security Hardening**:
- SDL compiler flags: `-fpic -O2 -fstack-protector -fno-omit-frame-pointer -D_FORTIFY_SOURCE=1 -fno-strict-overflow -fwrapv -fstack-clash-protection -Werror=format-security`
- Non-root user (`ovms:5000`) in release image
- `ubi-minimal` base for release image
- hadolint comments for acceptable deviations

**Gaps**:
- No Trivy/Grype scanning in CI
- No SBOM generation
- No image signing/attestation (cosign, Sigstore)
- Single architecture only (x86_64) — no ARM64/multi-arch support
- No `.dockerignore` found (may cause larger build context)

### Security Practices

**Strengths**:
- Comprehensive SDL process: style checks, bandit, forbidden functions, hadolint, checksec
- Compiler hardening flags consistently applied across all build stages
- License compliance checking
- Non-root container execution

**Gaps**:
- No SAST/CodeQL for C++ vulnerability detection
- No container image scanning
- No secret detection in CI
- No dependency vulnerability scanning
- No SBOM generation
- `security.md` exists but no bug bounty or security policy workflow

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no CLAUDE.md, AGENTS.md, or `.claude/` directory
- **Quality**: N/A
- **Gaps**: Complete absence of AI agent guidance
- **Impact**: AI agents cannot leverage project-specific patterns:
  - Bazel build system conventions
  - Google Test patterns and fixtures
  - Multi-stage Docker build structure
  - SDL security requirements
  - Performance test patterns
- **Recommendation**: Generate rules with `/test-rules-generator` covering C++ unit tests (Google Test), Python functional tests (pytest), and build conventions (Bazel)

## Recommendations

### Priority 0 (Critical)

1. **Add container vulnerability scanning (Trivy) to PR workflow** — Catch CVEs in base images, installed packages, and dependencies before merge. Add to `fast-checks.yml` for filesystem scanning and to `integration-tests.yml` for image scanning.

2. **Add CodeQL or Semgrep SAST analysis** — 78K+ lines of C++ handling network requests (gRPC, REST), model loading, and memory management need semantic static analysis beyond cpplint style checks.

### Priority 1 (High Value)

3. **Integrate codecov for PR-level coverage reporting** — The infrastructure exists (Bazel coverage + lcov + thresholds), but coverage isn't visible during PR review. Upload lcov output to codecov with PR annotations.

4. **Add secret detection (Gitleaks)** — No secret scanning exists. Repository contains scripts that handle proxies, credentials, and URLs that could leak sensitive data.

5. **Create comprehensive agent rules** — Build CLAUDE.md with build/test instructions and .claude/rules/ for unit test patterns (Google Test), functional test patterns (pytest + Docker), and SDL compliance requirements.

### Priority 2 (Nice-to-Have)

6. **Add multi-architecture image builds** — Currently x86_64 only. ARM64 support would broaden platform compatibility (Apple Silicon dev, ARM Kubernetes nodes).

7. **Move hadolint to PR checks** — Hadolint currently only runs as part of `sdl-check` but not in the `fast-checks.yml` PR workflow. Move it to catch Dockerfile issues earlier.

8. **Add fuzz testing** — The gRPC and REST request parsers handle untrusted input and would benefit from fuzz testing (OSS-Fuzz, libFuzzer). The repo already has `FUZZER_BUILD` build arg support.

## Comparison to Gold Standards

| Dimension | OVMS (This Repo) | odh-dashboard | notebooks | kserve |
|-----------|-------------------|---------------|-----------|--------|
| Unit Tests | 8.5 (149 files, 100K LOC) | 9.0 (Jest, comprehensive) | 6.0 (notebook validation) | 9.0 (Go testing) |
| Integration/E2E | 8.0 (functional + perf) | 9.0 (Cypress E2E) | 7.0 (image testing) | 9.0 (multi-version) |
| Build Integration | 7.5 (Prow + Konflux) | 7.0 (PR builds) | 6.0 (image builds) | 8.0 (matrix testing) |
| Image Testing | 7.0 (runtime validation) | 6.0 (basic builds) | 9.0 (5-layer validation) | 7.0 (image tests) |
| Coverage Tracking | 7.5 (lcov + thresholds) | 8.0 (codecov + enforcement) | 4.0 (no tracking) | 9.0 (codecov) |
| CI/CD Automation | 7.0 (3 workflows) | 9.0 (comprehensive) | 7.0 (matrix builds) | 9.0 (well-organized) |
| Container Scanning | 2.0 (checksec only) | 6.0 (basic) | 8.0 (Trivy + SBOM) | 7.0 (Trivy) |
| Agent Rules | 0.0 (none) | 8.0 (comprehensive) | 2.0 (minimal) | 3.0 (basic) |

## File Paths Reference

### CI/CD
- `.github/workflows/fast-checks.yml` — PR style/security checks
- `.github/workflows/integration-tests.yml` — Prow-triggered integration tests
- `.github/workflows/integration-tests-konflux.yml` — Konflux-triggered integration tests
- `Makefile` — 700-line build/test orchestration (test targets: style, sdl-check, test_functional, test_perf, test_throughput, run_unit_tests, run_lib_files_test)

### Testing
- `src/test/` — 149 C++ unit test files (Google Test)
- `tests/functional/` — Python functional tests (pytest)
- `tests/performance/` — Latency/throughput test scripts
- `tests/python/` — Python client integration tests
- `src/python/binding/tests/` — Python binding tests
- `run_unit_tests.sh` — Unit test runner with coverage support
- `ci/check_coverage.bat` — Coverage threshold enforcement (76% line, 83% function)

### Code Quality
- `.clang-format` — C++ formatting rules
- `ci/style_requirements.txt` — Style check Python dependencies
- `ci/bandit.sh` — Python security scanner
- `ci/lib_search.py` — Forbidden C/C++ function checker
- `ci/cppclean.sh` — Dead code detection

### Container Images
- `Dockerfile.redhat` — Production UBI9 multi-stage build
- `Dockerfile.konflux` — Konflux-adapted build
- `Dockerfile.ubuntu` — Ubuntu variant

### Build System
- `BUILD.bazel` — Root Bazel build file
- `WORKSPACE` — Bazel workspace with external dependencies
- `.bazelrc` — Bazel configuration
- `common_settings.bzl` — Shared Bazel settings
