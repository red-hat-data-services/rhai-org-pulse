---
repository: "opendatahub-io/openvino"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Extensive C++ (gtest) and Python (pytest) unit test suites with 1,345+ test files"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Multi-framework layer tests (PyTorch, TensorFlow, ONNX, JAX), model hub tests, and e2e pipeline"
  - dimension: "Build Integration"
    score: 7.0
    status: "Smart CI with component-aware builds on PRs; multi-platform Docker builds; no Konflux simulation"
  - dimension: "Image Testing"
    score: 6.0
    status: "Extensive Dockerfiles for build/test but no runtime image validation or startup testing"
  - dimension: "Coverage Tracking"
    score: 4.5
    status: "Coverage workflow exists with Codecov but is workflow_dispatch only — no PR enforcement or thresholds"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "56 workflows, Smart CI component filtering, concurrency control, multi-OS/arch matrix, OpenTelemetry metrics"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory — zero AI-assisted test guidance"
critical_gaps:
  - title: "Coverage tracking is manual-only (workflow_dispatch)"
    impact: "No automated coverage feedback on PRs; regressions in test coverage go undetected"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container image vulnerability scanning"
    impact: "Base image CVEs and dependency vulnerabilities not detected in CI pipeline"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No SBOM generation or image signing"
    impact: "Supply chain transparency missing; no attestation for built artifacts"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No CodeQL or SAST integration for source code"
    impact: "C++/Python security flaws not detected by static analysis in CI"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI-generated code and tests have no project-specific guidance, leading to inconsistent patterns"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "macOS CI runs on schedule only, not PRs"
    impact: "macOS build/test regressions not caught until after merge"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Enable coverage workflow on PRs with threshold enforcement"
    effort: "2-4 hours"
    impact: "Automated coverage regression detection on every PR"
  - title: "Add Trivy scanning to Docker image builds"
    effort: "1-2 hours"
    impact: "Immediate detection of known CVEs in base images and dependencies"
  - title: "Add CodeQL analysis workflow"
    effort: "1-2 hours"
    impact: "Automated detection of C++ and Python security vulnerabilities"
  - title: "Create basic CLAUDE.md with testing conventions"
    effort: "2-3 hours"
    impact: "Consistent AI-generated tests following project patterns"
recommendations:
  priority_0:
    - "Enable code coverage on PR workflows with minimum threshold enforcement via Codecov config"
    - "Add Trivy container scanning for all Dockerfile builds in CI"
    - "Add CodeQL or Semgrep SAST workflow triggered on PRs for C++ and Python"
  priority_1:
    - "Enable macOS ARM64 CI on pull_request triggers (currently schedule-only)"
    - "Add SBOM generation (Syft/CycloneDX) to release builds"
    - "Create .claude/rules/ with test pattern guidelines for C++/Python"
    - "Add image signing with cosign for release artifacts"
  priority_2:
    - "Add pre-commit hooks configuration for local developer checks"
    - "Integrate fuzz testing into periodic CI (currently manual-only)"
    - "Add performance regression benchmarks to CI pipeline"
---

# Quality Analysis: opendatahub-io/openvino

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Deep learning inference optimization toolkit (C++/Python/JS)
- **Primary Languages**: C++ (6,607 files), Python (2,831 files), Headers (3,964 files), JS/TS (74 files)
- **Key Strengths**: Exceptional CI/CD automation with 56 workflows, Smart CI component-aware filtering, multi-platform coverage (Linux, Windows, macOS, Android, RISC-V, WebAssembly), comprehensive test suite across multiple ML frameworks
- **Critical Gaps**: No PR-time coverage enforcement, no container vulnerability scanning, no SAST/CodeQL, no SBOM/signing, no agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Extensive C++ (gtest) and Python (pytest) suites with 1,345+ test files |
| Integration/E2E | 8.0/10 | Multi-framework layer tests, model hub tests, e2e pipeline, conformance tests |
| **Build Integration** | **7.0/10** | **Smart CI with PR builds across platforms; no Konflux simulation** |
| Image Testing | 6.0/10 | 20+ Dockerfiles for build/test environments but no runtime validation |
| Coverage Tracking | 4.5/10 | Codecov integration exists but workflow_dispatch only — no PR enforcement |
| CI/CD Automation | 9.0/10 | 56 workflows, Smart CI, concurrency control, OpenTelemetry metrics |
| Agent Rules | 0.0/10 | No agent rules, no CLAUDE.md, no testing guidance for AI |

## Critical Gaps

### 1. Coverage Tracking is Manual-Only (workflow_dispatch)
- **Impact**: Coverage data is only generated when manually triggered — no automated feedback on PRs
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The `coverage.yml` workflow uses `on: workflow_dispatch` only. No `.codecov.yml` configuration file exists to enforce thresholds. Coverage regressions can be merged silently.
- **Fix**: Change trigger to include `pull_request`, add `.codecov.yml` with project/patch thresholds

### 2. No Container Image Vulnerability Scanning
- **Impact**: 20+ Dockerfiles used for build/test environments have no vulnerability scanning
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Despite having extensive Docker infrastructure (15 build images, 6 test images), no Trivy, Snyk, or Grype scanning is configured. Base images (Ubuntu 20.04, 22.04, 24.04) may contain known CVEs.
- **Fix**: Add Trivy scan step to Docker image build workflows

### 3. No SBOM Generation or Image Signing
- **Impact**: No supply chain transparency for built artifacts; cannot verify artifact provenance
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: No Syft/CycloneDX for SBOM, no cosign/sigstore for signing. For a security-sensitive inference toolkit, this is a significant gap.

### 4. No CodeQL or SAST Integration
- **Impact**: C++ memory safety issues, Python injection flaws, and other security vulnerabilities not detected automatically
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Coverity runs on schedule (daily) and is workflow_dispatch. No CodeQL, gosec, or Semgrep for PR-time static analysis. The `workflows_scans.yml` only scans GitHub Actions workflow files with Semgrep, not source code.

### 5. No Agent Rules for AI-Assisted Development
- **Impact**: AI-generated code follows no project-specific conventions; test generation is inconsistent
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: No `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`. For a large codebase with multiple languages and testing frameworks, agent rules would significantly improve AI-assisted contributions.

### 6. macOS CI on Schedule Only
- **Impact**: macOS ARM64 and x86 regressions not caught until nightly/scheduled runs
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: `mac_arm64.yml` and `mac.yml` run on `schedule` and `workflow_dispatch` only. PR triggers are commented out.

## Quick Wins

### 1. Enable Coverage on PRs with Thresholds (2-4 hours)
Add `.codecov.yml` and modify the coverage workflow trigger:
```yaml
# .codecov.yml
coverage:
  status:
    project:
      default:
        target: auto
        threshold: 1%
    patch:
      default:
        target: 80%
```

### 2. Add Trivy Scanning to Docker Builds (1-2 hours)
Add to Docker image build steps:
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: '${{ steps.build.outputs.image }}'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
```

### 3. Add CodeQL Analysis (1-2 hours)
Create `.github/workflows/codeql.yml`:
```yaml
name: CodeQL
on: [pull_request]
jobs:
  analyze:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        language: ['cpp', 'python', 'javascript']
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

### 4. Create Basic Agent Rules (2-3 hours)
Create `CLAUDE.md` with testing conventions for C++ (gtest patterns), Python (pytest patterns), and JS (mocha/jest patterns).

## Detailed Findings

### CI/CD Pipeline

**Strengths (Score: 9.0/10)**:
- **56 total workflows** covering an impressive range of platforms and configurations
- **Smart CI system**: Custom `smart-ci` action analyzes changed components and skips irrelevant tests, dramatically reducing CI time
- **Concurrency control**: All workflows use `concurrency.cancel-in-progress: true` to avoid duplicate runs
- **Multi-platform matrix**: Linux (Ubuntu 20/22/24), Windows (VS 2019), macOS (x86/ARM64), Android (ARM64/x64), RISC-V, WebAssembly, Debian ARM
- **Reusable workflows**: 15+ `job_*.yml` callable workflows promote consistency
- **PR triggers**: Core workflows (ubuntu_24, ubuntu_22_dpcpp, windows, android, fedora, webassembly) trigger on `pull_request`
- **OpenTelemetry integration**: `send_workflows_to_opentelemetry.yml` exports CI metrics for observability
- **Cache management**: Dedicated `cleanup_caches.yml` workflow for cache lifecycle

**Gaps**:
- macOS workflows run on schedule only (PR triggers commented out)
- Coverage workflow is manual-only
- Coverity is daily/manual — no PR-time SAST
- No Konflux or downstream build simulation

### Test Coverage

**Strengths (Score: 8.5/10 unit, 8.0/10 integration)**:

**Unit Tests**:
- **C++ unit tests**: 588 `*_test.cpp` files using Google Test framework (1,263 files reference gtest)
- **Python unit tests**: 757 `test_*.py` files using pytest (855 files reference pytest)
- **JS unit tests**: 10+ `.test.js` files for Node.js bindings
- **Test-to-code ratio**: Excellent — 3,219 C++ test files vs 3,383 source files (0.95:1)

**Integration/E2E Tests**:
- **Layer tests**: Dedicated suites for PyTorch, TensorFlow, ONNX, JAX framework integration
- **Model hub tests**: Tests against real models from popular model hubs
- **E2E tests**: Full pipeline tests in `tests/e2e_tests/`
- **Conformance tests**: Standard compliance testing
- **Sample tests**: Validation of code samples
- **ONNX Runtime integration**: Cross-project compatibility tests

**Specialized Tests**:
- **Fuzz testing**: LibFuzzer-based fuzz tests in `tests/fuzz/` (manual build required)
- **Stress tests**: Memory stress testing in `tests/stress_tests/`
- **Memory tests**: Leak and usage testing in `tests/memory_tests/`
- **Time tests**: Performance benchmarks in `tests/time_tests/`
- **Sanitizer tests**: AddressSanitizer, ThreadSanitizer builds (schedule-only)
- **GPU tests**: Dedicated GPU functional testing workflow
- **Conditional compilation tests**: Selective build testing

### Code Quality

**Strengths**:
- **clang-format**: Enforced on PRs via `code_style.yml` with reviewdog auto-suggestions
- **ShellCheck**: Shell script linting on PRs with reviewdog
- **Naming convention check**: Custom clang-based naming style enforcement
- **Python linting**: flake8 + mypy + black on Python bindings and samples
- **ESLint**: Configured for JS bindings and samples
- **Dependency review**: GitHub dependency review on PRs with license allowlist and vulnerability checks
- **Commit checks**: PR commit validation via custom script
- **File size monitoring**: Tracks file sizes in repo
- **Spell checking**: cspell.json configured

**Gaps**:
- No `.pre-commit-config.yaml` for local developer hooks
- No ruff or modern Python linting
- Python checks trigger on push, not pull_request (partial gap)
- No `.golangci.yml` (not a Go project, so N/A)

### Container Images

**Strengths (Score: 6.0/10)**:
- **Extensive Docker infrastructure**: 15 build images + 6 test images covering multiple OS/arch combinations
- **Multi-architecture**: x64, ARM64, RISC-V, Android, WebAssembly
- **Organized hierarchy**: Separate `ov_build/` and `ov_test/` image directories
- **Docker-in-Docker**: Dedicated image for Docker build testing (`ubuntu_22_04_x64_docker`)
- **Custom Docker handling action**: `handle_docker` action manages image builds

**Gaps**:
- No Trivy/Snyk/Grype vulnerability scanning on any images
- No SBOM generation
- No image signing/attestation
- No runtime validation (image startup, health checks)
- Images are CI infrastructure, not product deliverables — but still need scanning

### Security

**Strengths**:
- **Coverity**: Static analysis via Coverity Scan (daily schedule + manual dispatch)
- **Dependency review**: License and vulnerability checks on PRs
- **Semgrep for workflows**: GitHub Actions workflow scanning with Semgrep
- **OpenSSF badge**: Best practices badge displayed
- **SECURITY.md**: Vulnerability disclosure process documented
- **Pinned actions**: All GitHub Actions use SHA-pinned versions (e.g., `actions/checkout@11bd71901...`)
- **Permissions**: All workflows use `permissions: read-all` (principle of least privilege)

**Gaps**:
- **No CodeQL**: No source-code SAST for C++/Python/JS
- **No Trivy/container scanning**: Despite 20+ Dockerfiles
- **No secret detection**: No gitleaks or TruffleHog integration
- **No SBOM/signing**: No supply chain security tooling
- **Coverity is not PR-gated**: Runs daily, so issues found post-merge
- **Sanitizers are schedule-only**: ASAN/TSAN don't run on PRs

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No test types have rules
- **Quality**: N/A
- **Gaps**: No CLAUDE.md, no AGENTS.md, no `.claude/` directory. For a large multi-language codebase with complex testing patterns (gtest, pytest, mocha, layer tests, conformance tests), agent rules would provide significant value.
- **Recommendation**: Generate rules with `/test-rules-generator` covering:
  - C++ unit tests (gtest patterns, fixture usage, parameterized tests)
  - Python unit tests (pytest fixtures, conftest patterns, parametrize)
  - JS unit tests (mocha/jest patterns for Node.js bindings)
  - Layer tests (framework-specific test patterns)
  - E2E tests (pipeline validation patterns)

## Recommendations

### Priority 0 (Critical)

1. **Enable code coverage on PR workflows** — Change `coverage.yml` trigger from `workflow_dispatch` to include `pull_request`. Add `.codecov.yml` with project/patch thresholds. This is the single highest-impact change.

2. **Add container vulnerability scanning** — Add Trivy scanning to Docker image builds. Even though these are CI images, they run untrusted PR code.

3. **Add CodeQL SAST** — Create a CodeQL workflow for C++, Python, and JavaScript. This catches memory safety issues, injection flaws, and other vulnerabilities on every PR.

### Priority 1 (High Value)

4. **Enable macOS CI on PRs** — Uncomment the `pull_request` trigger in `mac_arm64.yml` and `mac.yml`. macOS regressions currently go undetected until nightly runs.

5. **Add SBOM generation** — Use Syft or CycloneDX to generate SBOMs for release builds. Important for supply chain compliance.

6. **Create agent rules** — Add `CLAUDE.md` and `.claude/rules/` with testing conventions for all languages and test types in the project.

7. **Add secret detection** — Integrate gitleaks or TruffleHog in PR workflow to prevent accidental credential exposure.

### Priority 2 (Nice-to-Have)

8. **Add pre-commit hooks** — Create `.pre-commit-config.yaml` with clang-format, shellcheck, flake8, mypy checks for local development.

9. **Integrate fuzz testing into CI** — Add periodic fuzz testing runs. Currently fuzz tests exist but require manual building.

10. **Enable sanitizers on PRs** — Move ASAN/TSAN from schedule-only to Smart CI-filtered PR runs for changed components.

11. **Add performance regression tracking** — Time tests exist but no CI integration for tracking regressions over time.

## Comparison to Gold Standards

| Dimension | openvino | odh-dashboard | notebooks | kserve |
|-----------|----------|---------------|-----------|--------|
| Unit Tests | 8.5 (gtest+pytest) | 9.0 (Jest+RTL) | 7.0 | 8.5 (Go) |
| Integration/E2E | 8.0 (multi-framework) | 9.0 (Cypress) | 8.0 (5-layer) | 9.0 |
| Build Integration | 7.0 (Smart CI) | 7.0 | 6.0 | 7.0 |
| Image Testing | 6.0 (no scanning) | 7.0 | 9.0 | 7.0 |
| Coverage Tracking | 4.5 (manual only) | 9.0 (enforced) | 6.0 | 8.5 |
| CI/CD Automation | 9.0 (56 workflows) | 8.5 | 8.0 | 8.5 |
| Agent Rules | 0.0 | 8.0 | 2.0 | 2.0 |

**Notable**: OpenVINO has the most extensive CI/CD automation of any compared repository (56 workflows), but falls behind on coverage enforcement and security scanning — areas where odh-dashboard and kserve excel.

## File Paths Reference

### CI/CD
- `.github/workflows/` — 56 workflow files
- `.github/actions/smart-ci/` — Component-aware CI filtering
- `.github/actions/handle_docker/` — Docker image management
- `.github/dockerfiles/ov_build/` — 15 build environment Dockerfiles
- `.github/dockerfiles/ov_test/` — 6 test environment Dockerfiles
- `Jenkinsfile` — Jenkins pipeline (legacy/parallel)

### Testing
- `tests/` — Top-level test directory
- `tests/e2e_tests/` — End-to-end pipeline tests
- `tests/layer_tests/` — ML framework layer tests
- `tests/model_hub_tests/` — Model hub integration tests
- `tests/fuzz/` — LibFuzzer fuzz tests
- `tests/stress_tests/` — Stress testing
- `tests/memory_tests/` — Memory leak/usage tests
- `tests/time_tests/` — Performance benchmarks
- `tests/sanitizers/` — Sanitizer configurations
- `src/core/tests/` — Core C++ unit tests
- `src/inference/tests/` — Inference engine tests
- `src/frontends/tests/` — Frontend (ONNX/TF/Paddle) tests
- `src/bindings/js/node/tests/` — JavaScript binding tests

### Code Quality
- `.github/workflows/code_style.yml` — clang-format + ShellCheck
- `.github/workflows/py_checks.yml` — Python flake8/mypy/black
- `src/bindings/js/.eslintrc.js` — ESLint for JS bindings
- `tools/mo/.coveragerc` — Python coverage config
- `cspell.json` — Spell checker config
- `.github/dependency_review.yml` — Dependency license/vulnerability policy

### Security
- `.github/workflows/coverity.yml` — Coverity static analysis
- `.github/workflows/workflows_scans.yml` — Semgrep for GHA workflows
- `.github/workflows/dependency_review.yml` — Dependency review
- `SECURITY.md` — Vulnerability disclosure policy
