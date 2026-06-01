---
repository: "red-hat-data-services/openvino_model_server"
overall_score: 6.8
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "129 C++ unit test files with Google Test framework, Bazel coverage support, ~76-88% coverage thresholds"
  - dimension: "Integration/E2E"
    score: 7.5
    status: "Comprehensive functional test suite with Docker-based testing, Konflux integration test workflow, performance benchmarks"
  - dimension: "Build Integration"
    score: 7.0
    status: "Konflux-triggered integration tests on PR images, file integrity validation, but no PR-time build simulation"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage Dockerfiles (RedHat/Ubuntu), file integrity tests, checksec binary hardening validation, SDL library whitelisting"
  - dimension: "Coverage Tracking"
    score: 6.0
    status: "Bazel coverage generation with lcov, hardcoded thresholds (76.8% lines, 87.6% functions), but no codecov/coveralls PR integration"
  - dimension: "CI/CD Automation"
    score: 6.5
    status: "GitHub Actions for integration tests + Jenkins for builds, security checks on PRs, but split CI systems add complexity"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory — zero AI agent guidance"
critical_gaps:
  - title: "No PR-time unit test execution in GitHub Actions"
    impact: "Unit test regressions not caught until Jenkins CI runs, delaying developer feedback"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No codecov/coveralls integration for PR coverage reporting"
    impact: "Coverage regressions go unnoticed, no PR-level coverage diff visibility"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container vulnerability scanning (Trivy/Snyk)"
    impact: "CVEs in base images or dependencies not detected until downstream consumers scan"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No SAST/CodeQL integration in GitHub workflows"
    impact: "Security vulnerabilities in C++ and Python code not caught by automated analysis"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No pre-commit hooks configuration"
    impact: "Style and lint violations caught only after PR submission, increasing review churn"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "Split CI between Jenkins and GitHub Actions"
    impact: "Fragmented test reporting, complex troubleshooting, inconsistent feedback loops"
    severity: "MEDIUM"
    effort: "20-40 hours"
quick_wins:
  - title: "Add Trivy container scanning to security-checks workflow"
    effort: "1-2 hours"
    impact: "Automated CVE detection for all Dockerfile builds before merge"
  - title: "Add CodeQL analysis workflow for C++ and Python"
    effort: "2-3 hours"
    impact: "Catch security vulnerabilities and code quality issues automatically"
  - title: "Add .pre-commit-config.yaml with clang-format, cpplint, bandit"
    effort: "1-2 hours"
    impact: "Shift style enforcement left, reduce review churn"
  - title: "Create basic CLAUDE.md with testing patterns and agent rules"
    effort: "2-3 hours"
    impact: "Enable AI-assisted development with consistent test patterns"
  - title: "Add codecov integration to coverage workflow"
    effort: "2-4 hours"
    impact: "PR-level coverage reporting and regression detection"
recommendations:
  priority_0:
    - "Add container vulnerability scanning (Trivy) to PR and periodic workflows"
    - "Add CodeQL/SAST analysis for C++ and Python code"
    - "Integrate codecov for PR-level coverage tracking and enforcement"
  priority_1:
    - "Add PR-time unit test execution in GitHub Actions (at least smoke test subset)"
    - "Create .pre-commit-config.yaml with clang-format, cpplint, hadolint, bandit"
    - "Create CLAUDE.md and .claude/rules/ for AI agent test generation guidance"
    - "Add secret detection scanning (gitleaks or trufflehog)"
  priority_2:
    - "Consolidate CI/CD to single platform (GitHub Actions preferred)"
    - "Add multi-architecture image build validation (ARM64)"
    - "Add SBOM generation for release images"
    - "Implement dependency update automation (Dependabot/Renovate)"
---

# Quality Analysis: OpenVINO Model Server (Red Hat Fork)

## Executive Summary
- **Overall Score: 6.8/10**
- **Repository Type**: C++ inference server with Python functional tests, Bazel build system
- **Primary Languages**: C++ (core server), Python (functional/performance tests), Shell (CI scripts)
- **Key Strengths**: Extensive C++ unit test suite (129 test files), comprehensive functional testing via Docker, Konflux-triggered integration tests, SDL security checks with library whitelisting, binary hardening validation (checksec), coverage thresholds enforced
- **Critical Gaps**: No container vulnerability scanning, no SAST/CodeQL, no PR-level coverage reporting, no pre-commit hooks, no AI agent rules, split CI between Jenkins and GitHub Actions
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard
| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.0/10 | 129 C++ unit test files with Google Test, Bazel coverage with lcov |
| Integration/E2E | 7.5/10 | Docker-based functional tests, Konflux integration workflow, perf benchmarks |
| Build Integration | 7.0/10 | Konflux-triggered post-build tests, file integrity validation |
| Image Testing | 7.0/10 | Multi-distro Dockerfiles, checksec hardening, SDL library whitelisting |
| Coverage Tracking | 6.0/10 | Bazel lcov coverage with thresholds but no PR-level codecov integration |
| CI/CD Automation | 6.5/10 | GHA + Jenkins hybrid, security/style checks on PRs, but fragmented |
| Agent Rules | 0.0/10 | No AI agent guidance whatsoever |

## Critical Gaps

### 1. No Container Vulnerability Scanning
- **Impact**: CVEs in base images (UBI 9, Ubuntu 22/24) and C++ dependencies not detected until downstream consumers scan images
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: No Trivy, Snyk, or Grype integration in any workflow. The SDL checks validate library whitelists and binary hardening but do not scan for known CVEs.

### 2. No SAST/CodeQL Integration
- **Impact**: Security vulnerabilities in ~570 C++ source files and ~170 Python files not caught by automated static analysis
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: While Bandit scans `demos/` and `client/` Python code, there is no CodeQL, Semgrep, or similar SAST tool covering the core C++ server code. Klocwork is used in Jenkins but requires proprietary tooling and is not visible in GitHub workflow.

### 3. No PR-Level Coverage Reporting
- **Impact**: Coverage regressions go unnoticed; developers lack feedback on whether their PR changes decrease coverage
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Coverage generation exists via Bazel's `--instrumentation_filter` with `lcov` and `genhtml`, with thresholds of 76.8% lines / 87.6% functions. However, no codecov/coveralls integration posts coverage diffs to PRs. Coverage is only checked inside the build image, not reported externally.

### 4. No PR-Time Unit Test Execution in GitHub Actions
- **Impact**: Unit test regressions only caught by Jenkins CI, not in the faster GitHub Actions feedback loop
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Unit tests require the Bazel build environment inside a Docker container, making GHA execution complex. Currently only style checks, SDL checks, and Konflux-triggered integration tests run in GHA.

### 5. No Pre-Commit Hooks
- **Impact**: Style violations (clang-format, cpplint, hadolint) caught only after PR submission
- **Severity**: MEDIUM
- **Effort**: 1-2 hours

### 6. Split CI Between Jenkins and GitHub Actions
- **Impact**: Fragmented test reporting, complex debugging, inconsistent developer experience
- **Severity**: MEDIUM
- **Effort**: 20-40 hours (long-term migration)
- **Details**: Jenkins handles full build + unit tests + Windows testing. GitHub Actions handles style/security checks and Konflux-triggered integration tests. The Groovy pipeline scripts (`ci/*.groovy`) are complex and tightly coupled to Jenkins infrastructure.

## Quick Wins

### 1. Add Trivy Scanning (1-2 hours)
```yaml
# Add to .github/workflows/security-checks.yml
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
  schedule:
    - cron: '0 6 * * 1'
jobs:
  analyze:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        language: ['cpp', 'python']
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
      - uses: github/codeql-action/analyze@v3
```

### 3. Add Pre-Commit Hooks (1-2 hours)
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
        types_or: [c++, c]
  - repo: https://github.com/PyCQA/bandit
    rev: 1.7.7
    hooks:
      - id: bandit
        args: ['-r', 'client/python', 'demos']
  - repo: https://github.com/hadolint/hadolint
    rev: v2.12.0
    hooks:
      - id: hadolint
```

### 4. Add Codecov Integration (2-4 hours)
Requires generating coverage in GitHub Actions or exporting from Jenkins:
```yaml
# .codecov.yml
coverage:
  status:
    project:
      default:
        target: 76%
    patch:
      default:
        target: 70%
```

## Detailed Findings

### CI/CD Pipeline

**GitHub Actions Workflows (5 total):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `integration-tests-konflux.yml` | `check_run` (Konflux) / `workflow_dispatch` | Integration tests on Konflux-built images: file integrity, Python clients, latency, throughput, functional tests |
| `prow-merge-stable-to-rhoai.yml` | `workflow_dispatch` | Auto-merge stable branch to rhoai branch |
| `security-checks.yml` | PR to `stable*` | SDL checks: hadolint, bandit, license headers |
| `security-checks-comment.yml` | `workflow_run` | Posts SDL check results as PR comments |
| `style-checks.yml` | PR to `stable*` | clang-format, cpplint, cppclean, spell check |

**Jenkins Pipelines (ci/*.groovy):**
- `build_test_OnCommit.groovy`: Full build + unit tests + Windows build (complex 4-hour timeout)
- `buildOnDevelop.groovy` / `buildOnMain.groovy`: Branch-specific builds
- `loadWin.groovy`: Windows build/test orchestration

**Strengths:**
- Konflux integration testing is well-designed — triggers on successful Konflux builds, runs 5 parallel test suites
- Test status is reported back to PR via commit statuses
- Image artifact is shared between test jobs via upload/download artifact pattern

**Weaknesses:**
- No concurrency control on workflows (multiple PR builds can conflict)
- No caching in workflows (each run downloads/builds from scratch)
- Split between Jenkins and GHA creates operational complexity
- No Dependabot/Renovate for dependency updates

### Test Coverage

**C++ Unit Tests (src/test/):**
- **129 test files** using Google Test framework
- Coverage areas: REST/gRPC API parsing, model management, ensemble pipelines, MediaPipe integration, LLM handlers (chat templates, output parsers, text streaming, VLM), custom nodes, configuration, metrics, serialization/deserialization
- Tests run inside the build Docker container via `run_unit_tests.sh`
- Strong coverage of LLM-related functionality (12+ LLM-specific test files)

**Python Functional Tests (tests/functional/):**
- **11 test files** covering: single model inference, multi-model serving, batching, reshaping, model versioning, S3 storage, ONNX models, mapping, LLM JSON, model updates
- Docker-based test infrastructure using the `docker` Python library
- Good fixture architecture with reusable server setup patterns
- gRPC and REST API testing

**Python Performance Tests (tests/performance/):**
- Latency benchmarks (`grpc_latency.py`)
- Throughput benchmarks (`grpc_throughput.sh`)
- Automated in Konflux integration tests

**Python Client Tests (tests/python/):**
- Multi-Python-version testing (3.9-3.13)
- Uses `invoke` task runner
- Tests client library against running server

**Test-to-Code Ratio:**
- C++: 129 test files / 439 source files = 0.29 (adequate)
- Python: 55 test files / 118 source files = 0.47 (strong)
- Combined ratio indicates reasonable coverage

**Coverage Thresholds:**
- Lines: 76.8% minimum (Ubuntu) / 75.6% (RHEL)
- Functions: 87.6% minimum (Ubuntu) / 73.0% (RHEL)
- Enforced via `ci/check_coverage.bat` script after lcov generation

### Code Quality

**Style Enforcement:**
- `.clang-format` — LLVM-based C++ formatting configuration
- cpplint — Google C++ style checker with custom filters (line length 120, disabled include order checks)
- cppclean — dead code / unnecessary includes detection
- Spell checker with custom whitelist (`spelling-whitelist.txt`)
- `make style` target runs all checks

**Static Analysis:**
- Bandit — Python security linter for `demos/` and `client/` directories (not server code)
- Klocwork — commercial static analysis via Jenkins (proprietary, not in GHA)
- Hadolint — Dockerfile linting with specific rule suppressions
- No open-source SAST (CodeQL, Semgrep, gosec equivalent for C++)

**Security Practices:**
- SDL (Security Development Lifecycle) checks automated in CI
- Library whitelisting — validates exact set of dynamic libraries, packages, and files in release images
- `checksec` — validates binary hardening (RELRO, stack canary, NX, PIE, RPATH, Fortify)
- Hadolint Dockerfile scanning
- License header enforcement
- No secret detection tools (gitleaks, trufflehog)
- No container image vulnerability scanning

### Container Images

**Dockerfiles:**
- `Dockerfile.redhat` — UBI 9-based, multi-stage build (~580 lines)
- `Dockerfile.ubuntu` — Ubuntu 22.04/24.04, multi-stage build (~600 lines)
- Additional Dockerfiles: custom nodes, nginx mTLS, Python demos, CI, Coverity
- Well-structured multi-stage builds separating build dependencies from runtime

**Image Validation:**
- File integrity tests validate exact library and file contents of release images
- Library whitelist checks per OS variant (Ubuntu 20/22/24, RHEL, GPU, nginx variants)
- Package whitelist checks per OS variant
- checksec binary hardening validation
- Python multi-version client testing

**Gaps:**
- No Trivy/Snyk vulnerability scanning
- No SBOM generation
- No image signing/attestation (cosign/sigstore)
- No multi-architecture builds (x86_64 only, no ARM64)
- No container startup validation in CI (image health checks)

### Agent Rules (Agentic Flow Quality)
- **Status**: Missing
- **Coverage**: None — no `.claude/`, `CLAUDE.md`, or `AGENTS.md`
- **Quality**: N/A
- **Gaps**: 
  - No test creation guidance for C++ (Google Test patterns)
  - No functional test patterns for Docker-based testing
  - No Bazel build guidance for agents
  - No code review checklists
- **Recommendation**: Generate rules with `/test-rules-generator` covering:
  - C++ unit test patterns with Google Test
  - Python functional test patterns with Docker
  - Bazel build conventions
  - SDL/security check requirements

## Recommendations

### Priority 0 (Critical)
1. **Add container vulnerability scanning** — Trivy in `security-checks.yml` for filesystem scanning, and periodic image scanning for published images
2. **Add SAST/CodeQL** — C++ and Python static analysis in GitHub Actions
3. **Integrate codecov** — PR-level coverage reporting with minimum thresholds matching existing 76.8%/87.6%

### Priority 1 (High Value)
4. **Add pre-commit hooks** — `.pre-commit-config.yaml` with clang-format, cpplint, hadolint, bandit, spelling
5. **Create AI agent rules** — `CLAUDE.md` and `.claude/rules/` for test patterns, build conventions, review checklists
6. **Add secret detection** — gitleaks or trufflehog in CI
7. **Add PR-time smoke tests** — Subset of fast unit tests in GitHub Actions (even if full suite stays in Jenkins)

### Priority 2 (Nice-to-Have)
8. **Consolidate CI to GitHub Actions** — Migrate Jenkins pipelines to GHA (major effort, long-term)
9. **Add multi-architecture builds** — ARM64 support for growing edge deployment use cases
10. **Add SBOM generation** — syft/cyclonedx for release images
11. **Add Dependabot/Renovate** — Automated dependency update PRs
12. **Add image signing** — cosign/sigstore for supply chain security

## Comparison to Gold Standards

| Dimension | OVMS (This Repo) | odh-dashboard | notebooks | kserve |
|-----------|-------------------|---------------|-----------|--------|
| Unit Tests | 8.0 — 129 C++ test files, Google Test | 9.0 — Jest, comprehensive | 6.0 — Notebook-focused | 9.0 — Go testing, table-driven |
| Integration/E2E | 7.5 — Docker functional tests | 9.5 — Cypress, contract tests | 7.0 — Image validation | 9.0 — E2E multi-version |
| Build Integration | 7.0 — Konflux-triggered | 8.0 — PR build validation | 7.0 — Image builds | 8.0 — PR integration |
| Image Testing | 7.0 — File integrity, checksec, SDL | 6.0 — Basic builds | 9.0 — 5-layer validation | 7.0 — Image builds |
| Coverage Tracking | 6.0 — lcov with thresholds, no PR reporting | 8.0 — codecov enforced | 5.0 — Limited | 9.0 — codecov strict |
| CI/CD Automation | 6.5 — GHA + Jenkins hybrid | 9.0 — Unified GHA | 8.0 — Organized GHA | 9.0 — Well-structured |
| Agent Rules | 0.0 — None | 8.0 — Comprehensive rules | 2.0 — Basic | 3.0 — Minimal |
| **Overall** | **6.8** | **8.5** | **6.5** | **8.0** |

## File Paths Reference

### CI/CD
- `.github/workflows/integration-tests-konflux.yml` — Konflux integration test workflow
- `.github/workflows/security-checks.yml` — SDL security checks
- `.github/workflows/security-checks-comment.yml` — PR comment posting
- `.github/workflows/style-checks.yml` — Style enforcement
- `.github/workflows/prow-merge-stable-to-rhoai.yml` — Branch merge automation
- `ci/build_test_OnCommit.groovy` — Jenkins build + test pipeline
- `ci/bandit.sh` — Bandit security scan script
- `ci/cppclean.sh` — Dead code detection script
- `ci/check_coverage.bat` — Coverage threshold enforcement

### Testing
- `src/test/` — 129 C++ unit test files (Google Test)
- `tests/functional/` — Python functional tests (pytest)
- `tests/performance/` — Latency and throughput benchmarks
- `tests/python/` — Multi-version Python client tests
- `tests/sdl/whitelists.py` — SDL library whitelist definitions
- `tests/file_lists/` — File integrity test data
- `run_unit_tests.sh` — Unit test runner script

### Build
- `Dockerfile.redhat` — RHEL/UBI 9 multi-stage build
- `Dockerfile.ubuntu` — Ubuntu multi-stage build
- `Makefile` — Primary build/test orchestration (28KB)
- `BUILD.bazel` — Bazel build configuration
- `.bazelrc` — Bazel build options
- `WORKSPACE` — Bazel workspace/dependency definitions

### Code Quality
- `.clang-format` — C++ formatting configuration
- `ci/style_requirements.txt` — Style check Python dependencies
- `spelling-whitelist.txt` — Custom spell check whitelist
