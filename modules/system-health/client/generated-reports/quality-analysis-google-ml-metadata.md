---
repository: "google/ml-metadata"
overall_score: 5.4
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Extensive C++ unit tests (317 test cases) with multi-backend parameterized suites; Python tests adequate (85 test methods)"
  - dimension: "Integration/E2E"
    score: 5.0
    status: "Multi-backend integration tests (SQLite, MySQL, PostgreSQL) via parameterized suites; no E2E tests for gRPC server or deployment scenarios"
  - dimension: "Build Integration"
    score: 4.0
    status: "Conda build and test workflows on PRs across 2 OS × 4 Python versions; no Docker image validation or Konflux-style PR-time build simulation"
  - dimension: "Image Testing"
    score: 2.0
    status: "Dockerfiles exist for server and dev debug but no CI-driven image builds, no runtime validation, no vulnerability scanning"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "pytest-cov installed in conda env but never invoked; no coverage reports, thresholds, or codecov/coveralls integration"
  - dimension: "CI/CD Automation"
    score: 6.5
    status: "4 GitHub Actions workflows with matrix builds, caching, and pre-commit; but Bazel tests not in CI, no concurrency control, no required status checks visible"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules or test automation guidance"
critical_gaps:
  - title: "Bazel C++ tests not running in CI"
    impact: "Core library's 317 C++ unit tests are only runnable via local Bazel builds; regressions can go undetected in PRs"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No coverage tracking or enforcement"
    impact: "pytest-cov dependency exists but is never used; no coverage data collected, reported, or enforced"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container image CI or security scanning"
    impact: "Server Dockerfile is never built or tested in CI; no Trivy/Snyk scanning, no SBOM generation"
    severity: "HIGH"
    effort: "6-8 hours"
  - title: "No E2E or gRPC server integration tests"
    impact: "gRPC metadata store server has no automated deployment or smoke testing; issues found only in production"
    severity: "HIGH"
    effort: "12-20 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI coding agents have no guidance for test creation, code standards, or repository conventions"
    severity: "MEDIUM"
    effort: "3-4 hours"
quick_wins:
  - title: "Enable pytest-cov in conda-test workflow"
    effort: "1-2 hours"
    impact: "Immediate visibility into Python test coverage; pytest-cov is already a dependency"
  - title: "Add codecov integration"
    effort: "2-3 hours"
    impact: "PR-level coverage reporting and enforcement with minimal setup"
  - title: "Add Trivy scanning workflow for Dockerfile"
    effort: "1-2 hours"
    impact: "Automated vulnerability scanning for container images"
  - title: "Add concurrency control to PR workflows"
    effort: "30 minutes"
    impact: "Cancel redundant CI runs on force-pushes, saving CI resources"
  - title: "Generate CLAUDE.md with test rules"
    effort: "2-3 hours"
    impact: "Enable AI agents to write tests matching existing patterns and conventions"
recommendations:
  priority_0:
    - "Add Bazel C++ test execution to CI (GitHub Actions with bazel test //...)"
    - "Enable pytest --cov in conda-test workflow and add codecov reporting"
    - "Add container image build and Trivy scanning to CI pipeline"
  priority_1:
    - "Create E2E tests for gRPC metadata store server (docker-compose based)"
    - "Add CLAUDE.md with test creation rules covering C++, Python, and Go patterns"
    - "Add concurrency control to all PR workflows"
  priority_2:
    - "Add SBOM generation for container images"
    - "Implement CodeQL or SAST analysis workflow"
    - "Add multi-architecture Docker image builds (linux/amd64, linux/arm64)"
---

# Quality Analysis: ML Metadata (google/ml-metadata)

## Executive Summary

- **Overall Score: 5.4/10**
- **Repository Type**: ML infrastructure library (metadata store for ML workflows)
- **Primary Languages**: C++ (core), Python (bindings/tests), Go (bindings), Protobuf
- **Build System**: Bazel (C++), setuptools + Conda (Python packaging)
- **Key Strengths**: Extensive C++ unit test suite with multi-database parameterized testing, good pre-commit hook setup with Ruff linting, solid multi-platform conda build/test matrix
- **Critical Gaps**: Core C++ tests not running in CI, zero coverage tracking, no container image CI, no E2E testing, no agent rules
- **Agent Rules Status**: Missing - no CLAUDE.md, no .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | 317 C++ test cases + 85 Python test methods; thorough parameterized suites |
| Integration/E2E | 5.0/10 | Multi-backend integration tests exist but no E2E server testing |
| **Build Integration** | **4.0/10** | **Conda build matrix on PRs; no Docker or Konflux simulation** |
| Image Testing | 2.0/10 | Dockerfiles exist but never built/tested in CI |
| Coverage Tracking | 2.0/10 | pytest-cov dependency exists but never invoked |
| CI/CD Automation | 6.5/10 | 4 workflows with matrix builds; Bazel tests missing from CI |
| Agent Rules | 0.0/10 | No agent rules or test automation guidance |

## Critical Gaps

### 1. Bazel C++ Tests Not Running in CI
- **Impact**: The repository's most comprehensive test suite (27 C++ test files, 317 test cases, ~20,600 lines of test code) across SQLite, MySQL, and PostgreSQL backends only runs via local `bazel test` invocation. CI workflows only test the Python wheel via pytest.
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Detail**: The `conda-test.yml` workflow builds the wheel and runs `pytest -vv`, but this only exercises 2 Python test files (85 test methods). The C++ tests that validate the core metadata store, query execution, access objects, and utilities are never executed in CI.

### 2. No Coverage Tracking or Enforcement
- **Impact**: Despite `pytest-cov` being listed in `ci/environment.yml` and `ci/environment-macos.yml`, the conda-test workflow runs `pytest -vv` without any `--cov` flag. No coverage reports are generated, no codecov/coveralls integration exists, and no coverage thresholds are enforced.
- **Severity**: HIGH
- **Effort**: 4-6 hours

### 3. No Container Image CI or Security Scanning
- **Impact**: The repository has two Dockerfiles (`ml_metadata/tools/docker_server/Dockerfile` for the gRPC server and `ml_metadata/tools/dev_debug/Dockerfile` for debugging), but neither is built in CI. No vulnerability scanning (Trivy, Snyk), no SBOM generation, no image signing.
- **Severity**: HIGH
- **Effort**: 6-8 hours

### 4. No E2E or gRPC Server Tests
- **Impact**: The metadata store server is a gRPC service, but there are no automated tests that spin up the server, connect a client, and validate end-to-end behavior. Python tests support `--use_grpc_backend` but this requires manual server setup; it's not automated in CI.
- **Severity**: HIGH
- **Effort**: 12-20 hours

### 5. No Agent Rules
- **Impact**: No CLAUDE.md, no .claude/ directory, no rules for AI agents creating tests or contributing code. This means AI-assisted development has no guidance on test patterns, naming conventions, or quality standards.
- **Severity**: MEDIUM
- **Effort**: 3-4 hours

## Quick Wins

### 1. Enable pytest-cov in conda-test workflow (1-2 hours)
**Impact**: Immediate visibility into Python test coverage

```yaml
# In .github/workflows/conda-test.yml, change:
    - name: Run tests
      shell: bash -l {0}
      run: |
        rm -rf bazel-*
        pytest -vv --cov=ml_metadata --cov-report=xml:coverage.xml

    - name: Upload coverage
      uses: codecov/codecov-action@v4
      with:
        files: coverage.xml
        token: ${{ secrets.CODECOV_TOKEN }}
```

### 2. Add Trivy Scanning Workflow (1-2 hours)
**Impact**: Automated vulnerability scanning for container images

```yaml
# .github/workflows/trivy-scan.yml
name: Trivy Security Scan
on:
  pull_request:
  push:
    branches: [master]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Build server image
      run: docker build -t mlmd-server -f ml_metadata/tools/docker_server/Dockerfile .
    - name: Run Trivy
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: 'mlmd-server'
        format: 'sarif'
        output: 'trivy-results.sarif'
    - name: Upload results
      uses: github/codeql-action/upload-sarif@v3
      with:
        sarif_file: 'trivy-results.sarif'
```

### 3. Add Concurrency Control (30 minutes)
**Impact**: Cancel redundant CI runs on force-pushes

```yaml
# Add to each workflow file:
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

### 4. Generate Agent Rules (2-3 hours)
**Impact**: Enable AI agents to follow established patterns

Use `/test-rules-generator` to create `.claude/rules/` with patterns for:
- C++ unit tests (gtest/gmock patterns, `TEST_F`, `INSTANTIATE_TEST_SUITE_P`)
- Python tests (pytest fixtures, `absltest.TestCase`, parameterized)
- Bazel BUILD file test targets (`ml_metadata_cc_test`, `py_test`)

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory** (4 total):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `lint.yml` | PR + push to master | pre-commit hooks (Ruff, YAML/JSON/TOML checks) |
| `cd-docs.yml` | PR + push to master + manual | MkDocs build/deploy to GitHub Pages |
| `conda-build.yml` | PR + push + release + manual | Build Python wheels (2 OS × 4 Python versions) |
| `conda-test.yml` | PR + push + manual | Build, install, and test wheels (2 OS × 4 Python versions) |

**Strengths**:
- Matrix testing across Ubuntu + macOS and Python 3.10-3.13
- Micromamba environment caching for faster builds
- Separate build and test workflows
- Automatic PyPI upload on release tags
- pre-commit.ci integration for automatic fixes

**Weaknesses**:
- No concurrency control on any workflow
- Bazel C++ tests completely absent from CI
- No required status checks visible in repository configuration
- `conda-test.yml` uses deprecated `setup.py bdist_wheel` instead of `python -m build`
- Reusable build action (`reusable-build/action.yml`) uses Docker Compose manylinux approach but this isn't integrated into the main build workflow

### Test Coverage

**C++ Tests (Core Library)**:
- **27 test files**, ~20,600 lines of test code
- **317 individual test cases** (TEST, TEST_F, TEST_P macros)
- **Frameworks**: Google Test (gtest) + Google Mock (gmock)
- **Multi-backend**: Parameterized test suites run against SQLite, MySQL, and PostgreSQL
- **Key test file**: `metadata_access_object_test.cc` has 179 test cases alone
- **Test infrastructure**: Custom test utilities (`test_util.h`), test suites (`metadata_store_test_suite.h`)
- **Test-to-source ratio**: 20,598 lines test / 50,405 lines source = **0.41** (adequate for C++)

**Python Tests (Bindings)**:
- **2 test files**, ~2,394 lines of test code
- **85 test methods** in `metadata_store_test.py`
- **Frameworks**: pytest + absltest + parameterized
- **gRPC support**: Tests can target a live gRPC server via `--use_grpc_backend` flag
- **Test-to-source ratio**: 2,394 lines test / 4,939 lines source = **0.48** (good)

**Go Tests (Bindings)**:
- **1 test file**: `metadata_store_test.go`
- Minimal Go bindings testing

**Missing**:
- No E2E tests for the gRPC server deployment
- No contract tests between proto definitions and implementations
- No performance/benchmark tests in CI
- No fuzz testing

### Code Quality

**Linting** (Strong):
- **Ruff**: Comprehensive configuration in `pyproject.toml` with 15 rule categories enabled (E, W, F, UP, B, SIM, I, N, D, ANN, T10, PT, RET, ARG, FIX, ERA, PD, NPY)
- **pre-commit**: 6 hooks configured (end-of-file-fixer, trailing-whitespace, check-json, check-yaml, check-toml, ruff)
- **CI enforcement**: pre-commit runs on PRs via `pre-commit/action@v3.0.1`
- **pre-commit.ci**: Monthly auto-updates with auto-fix commits

**Missing**:
- No C++ linting (clang-tidy, cpplint) in CI
- No static analysis (CodeQL, Semgrep, gosec)
- No secret detection (Gitleaks, TruffleHog)
- No dependency scanning

### Container Images

**Dockerfiles** (2 files):
1. `ml_metadata/tools/docker_server/Dockerfile` - Multi-stage build for gRPC metadata store server
   - Builder: Ubuntu 20.04 + Bazel 7.7.0 + C++ toolchain
   - Runtime: Minimal Ubuntu 20.04 with just the server binary
   - Proper multi-stage build reducing final image size
2. `ml_metadata/tools/dev_debug/Dockerfile` - Development/debug environment (Bazel 6.1.0)

**docker-compose.yml**: Defines manylinux Python wheel build services for Python 3.9-3.11

**Strengths**:
- Multi-stage Docker build for production server image
- Minimal runtime image with only necessary binaries

**Weaknesses**:
- No CI-driven image builds
- No runtime validation (image startup testing)
- No vulnerability scanning
- No SBOM generation
- No image signing or attestation
- No multi-architecture support (x86_64 only)
- Base image Ubuntu 20.04 is approaching EOL
- Dev debug Dockerfile uses outdated Bazel 6.1.0 vs server's 7.7.0

### Security

**Current Security Posture**: Minimal

- No vulnerability scanning (Trivy, Snyk, Grype)
- No SAST/CodeQL integration
- No dependency scanning (Dependabot, Renovate)
- No secret detection
- No SBOM generation
- No image signing
- CLA requirement via Google's CLA bot
- Apache 2.0 license

### Agent Rules (Agentic Flow Quality)

**Status**: Missing
- No `CLAUDE.md` or `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` for test creation guidance
- No `.claude/skills/` for custom workflows

**Coverage**: None - no test types have rules

**Quality**: N/A

**Gaps**:
- No C++ unit test creation rules (gtest/gmock patterns, parameterized suites)
- No Python test creation rules (pytest fixtures, absltest integration)
- No Bazel BUILD file rules for test targets
- No code review standards or conventions documented for AI agents
- No proto schema testing rules

**Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
- C++ test patterns: `TEST_F`, `INSTANTIATE_TEST_SUITE_P`, gmock matchers
- Python test patterns: pytest fixtures, parameterized tests, gRPC backend testing
- Bazel BUILD rules: `ml_metadata_cc_test`, `py_test`, `ml_metadata_go_test`
- Proto testing conventions

## Recommendations

### Priority 0 (Critical)

1. **Add Bazel C++ test execution to CI** - The most impactful single improvement. Create a workflow that runs `bazel test //ml_metadata/...` to exercise the 317 C++ test cases that are currently only runnable locally.

2. **Enable coverage tracking** - Change `pytest -vv` to `pytest -vv --cov=ml_metadata --cov-report=xml` and add codecov integration. The `pytest-cov` dependency is already in the conda environments.

3. **Add container image scanning** - Create a Trivy-based workflow that builds the server Docker image and scans for vulnerabilities on every PR.

### Priority 1 (High Value)

4. **Create gRPC E2E test workflow** - Use docker-compose to start the metadata store server, then run Python tests with `--use_grpc_backend` flag against the live server.

5. **Add agent rules** - Create `.claude/rules/` with test creation patterns for C++, Python, Go, and Bazel BUILD files.

6. **Add concurrency control** - Add `concurrency` blocks to all 4 workflow files to cancel redundant runs.

7. **Add CodeQL or SAST analysis** - Enable GitHub's CodeQL for C++ and Python static analysis.

### Priority 2 (Nice-to-Have)

8. **Add SBOM generation** - Generate SBOMs for container images using syft or trivy.

9. **Upgrade base images** - Move Dockerfiles from Ubuntu 20.04 (approaching EOL) to 22.04 or 24.04.

10. **Add multi-architecture builds** - Support linux/arm64 alongside linux/amd64 for the server image.

11. **Add Dependabot or Renovate** - Automated dependency update management.

12. **Add C++ linting** - Integrate clang-tidy or cpplint into CI for C++ code quality.

## Comparison to Gold Standards

| Dimension | ml-metadata | odh-dashboard | notebooks | kserve |
|-----------|-------------|---------------|-----------|--------|
| Unit Tests | 7.5 - Extensive C++ suites | 9.0 - Jest + React Testing Library | 7.0 - Notebook validation | 9.0 - Go testing + envtest |
| Integration/E2E | 5.0 - Multi-DB but no E2E | 9.0 - Cypress + contract tests | 8.0 - 5-layer validation | 9.0 - Multi-version E2E |
| Build Integration | 4.0 - Conda only | 8.0 - Module Federation validation | 7.0 - Image build matrix | 7.0 - Operator manifests |
| Image Testing | 2.0 - Dockerfiles unused in CI | 7.0 - Container validation | 9.0 - Gold standard | 8.0 - Runtime validation |
| Coverage Tracking | 2.0 - Dependency exists, unused | 9.0 - Codecov enforcement | 6.0 - Basic coverage | 9.0 - Threshold enforcement |
| CI/CD Automation | 6.5 - Matrix builds, pre-commit | 9.0 - Comprehensive workflows | 8.0 - Multi-platform CI | 9.0 - Release automation |
| Agent Rules | 0.0 - None | 9.0 - Comprehensive rules | 3.0 - Basic docs | 5.0 - Some guidelines |

## File Paths Reference

### CI/CD
- `.github/workflows/lint.yml` - pre-commit CI
- `.github/workflows/cd-docs.yml` - MkDocs deployment
- `.github/workflows/conda-build.yml` - Python wheel builds
- `.github/workflows/conda-test.yml` - Python tests
- `.github/reusable-build/action.yml` - Reusable build action

### Testing
- `ml_metadata/metadata_store/*_test.cc` - 24 C++ test files
- `ml_metadata/util/*_test.cc` - 3 C++ utility test files
- `ml_metadata/query/*_test.cc` - 2 C++ query test files
- `ml_metadata/metadata_store/metadata_store_test.py` - Main Python test file
- `ml_metadata/metadata_store/mlmd_types_test.py` - Types test file
- `ml_metadata/metadata_store/metadata_store_test.go` - Go test file

### Build System
- `WORKSPACE` - Bazel workspace configuration
- `.bazelversion` - Bazel 7.7.0
- `.bazelrc` - Bazel build flags (C++17, proto options)
- `ml_metadata/metadata_store/BUILD` - Main BUILD file with 20+ test targets
- `setup.py` - Python packaging with custom Bazel build integration
- `pyproject.toml` - Build requirements and tool configuration

### Code Quality
- `.pre-commit-config.yaml` - 6 pre-commit hooks (end-of-file, trailing-ws, json, yaml, toml, ruff)
- `pyproject.toml` - Ruff configuration with 15 rule categories

### Container Images
- `ml_metadata/tools/docker_server/Dockerfile` - Production gRPC server (multi-stage)
- `ml_metadata/tools/dev_debug/Dockerfile` - Development environment
- `docker-compose.yml` - Manylinux wheel build services

### Documentation
- `mkdocs.yml` - MkDocs Material configuration
- `docs/` - Documentation source
- `CONTRIBUTING.md` - Contribution guidelines with pre-commit instructions
- `RELEASE.md` - Release process
