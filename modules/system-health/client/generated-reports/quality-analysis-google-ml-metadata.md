---
repository: "google/ml-metadata"
overall_score: 4.8
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Strong C++ test suite via Bazel with gtest/gmock; Python tests use pytest + absltest"
  - dimension: "Integration/E2E"
    score: 5.0
    status: "Multi-backend database tests (SQLite, MySQL, PostgreSQL) but no E2E deployment testing"
  - dimension: "Build Integration"
    score: 3.0
    status: "Conda-based PR builds for multiple OS/Python versions; no container image validation at PR time"
  - dimension: "Image Testing"
    score: 2.0
    status: "Dockerfiles exist for server and manylinux builds, but no image runtime validation or scanning"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "pytest-cov listed in conda environment but no codecov integration, thresholds, or PR reporting"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "4 GitHub workflows with matrix builds but no concurrency control or test result caching"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory present"
critical_gaps:
  - title: "No code coverage tracking or enforcement"
    impact: "Cannot measure test effectiveness or detect coverage regressions on PRs"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container image security scanning"
    impact: "Vulnerability exposure in published Docker images; base image ubuntu:20.04 is EOL"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No SAST/CodeQL or dependency scanning"
    impact: "Security vulnerabilities in C++/Python code and dependencies go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No image runtime validation"
    impact: "Docker server image startup issues not caught until production deployment"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "Outdated base images (ubuntu:20.04 EOL)"
    impact: "Missing security patches and potential supply chain risks"
    severity: "HIGH"
    effort: "4-8 hours"
quick_wins:
  - title: "Add codecov integration to conda-test workflow"
    effort: "2-3 hours"
    impact: "Instant visibility into Python test coverage with PR reporting"
  - title: "Add Trivy scanning GitHub Action"
    effort: "1-2 hours"
    impact: "Catch known CVEs in Docker images and dependencies before release"
  - title: "Add CodeQL workflow for C++ and Python"
    effort: "1-2 hours"
    impact: "Automated SAST detecting security vulnerabilities and code quality issues"
  - title: "Add workflow concurrency control"
    effort: "30 minutes"
    impact: "Prevent redundant CI runs on rapid pushes, save CI minutes"
recommendations:
  priority_0:
    - "Add codecov/coveralls integration with minimum coverage thresholds and PR gate"
    - "Add container image vulnerability scanning (Trivy) for all Dockerfiles"
    - "Enable GitHub CodeQL for C++ and Python static analysis"
    - "Upgrade base images from ubuntu:20.04 (EOL) to ubuntu:22.04 or 24.04"
  priority_1:
    - "Add Docker server image startup/smoke tests in CI"
    - "Add dependency scanning (Dependabot or Renovate) for Bazel WORKSPACE and pip dependencies"
    - "Add concurrency control to all GitHub workflows"
    - "Create agent rules (.claude/rules/) for test automation guidance"
  priority_2:
    - "Add integration tests that deploy metadata_store_server in a container and run gRPC client tests"
    - "Add multi-architecture Docker image builds (arm64 support)"
    - "Add SBOM generation for published images"
    - "Add performance regression testing for metadata store operations"
---

# Quality Analysis: google/ml-metadata

## Executive Summary

- **Overall Score: 4.8/10**
- **Repository Type**: Python/C++ library with Bazel build system
- **Primary Languages**: C++ (~30k LOC source, ~20.6k LOC tests), Python (~3k LOC source, ~2.4k LOC tests)
- **Framework**: ML metadata store library with gRPC server, SQLite/MySQL/PostgreSQL backends
- **Key Strengths**: Solid C++ unit test suite (27 test files, 20+ Bazel test targets), multi-backend database testing, good pre-commit hooks with Ruff linter, matrix CI builds across OS and Python versions
- **Critical Gaps**: No coverage tracking/enforcement, no security scanning (SAST/containers), no image runtime validation, outdated base images (ubuntu:20.04 EOL), no agent rules
- **Agent Rules Status**: Missing - no CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.0/10 | Strong C++ test suite via Bazel gtest/gmock; Python uses pytest + absltest |
| Integration/E2E | 5.0/10 | Multi-backend DB tests (SQLite, MySQL, PostgreSQL) but no E2E deployment testing |
| **Build Integration** | **3.0/10** | **Conda-based PR builds for multi-OS/Python; no container image validation at PR time** |
| Image Testing | 2.0/10 | Dockerfiles exist but no runtime validation or scanning |
| Coverage Tracking | 2.0/10 | pytest-cov in environment but no codecov, thresholds, or PR reporting |
| CI/CD Automation | 5.0/10 | 4 workflows with matrix builds; no concurrency control or test result caching |
| Agent Rules | 0.0/10 | No CLAUDE.md, AGENTS.md, or .claude/ directory |

## Critical Gaps

### 1. No Code Coverage Tracking or Enforcement
- **Impact**: Cannot measure test effectiveness, detect coverage regressions, or enforce minimums on PRs
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The conda environment includes `pytest-cov` as a dependency, but no coverage is actually collected or reported. No `.codecov.yml`, `.coveragerc`, or coverage upload steps exist in any workflow. For C++ tests via Bazel, no `--instrumentation_filter` or `--coverage_report_generator` flags are configured.

### 2. No Container Image Security Scanning
- **Impact**: Published Docker images (metadata_store_server) may contain known CVEs. Base image `ubuntu:20.04` reached EOL in April 2025.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Three Dockerfiles exist (`tools/docker_server/Dockerfile`, `tools/docker_build/Dockerfile.manylinux2010`, `tools/dev_debug/Dockerfile`) but none have associated Trivy, Snyk, or Grype scanning. No `.trivyignore` file exists.

### 3. No SAST/CodeQL or Dependency Scanning
- **Impact**: Security vulnerabilities in C++ and Python code go undetected. No automated dependency update mechanism.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No CodeQL workflow, no Semgrep, no gosec equivalent for C++. No Dependabot/Renovate configuration for Bazel WORKSPACE HTTP archives or Python dependencies. The WORKSPACE file pins many third-party dependencies by SHA256 but has no automated update mechanism.

### 4. Outdated Base Images
- **Impact**: `ubuntu:20.04` (used in all 3 Dockerfiles) reached EOL April 2025. Missing security patches.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The `manylinux2010` Dockerfile references `gcr.io/tfx-oss-public/manylinux2014-bazel:bazel-6.5.0` which may also have outdated dependencies. The server Dockerfile uses `ubuntu:20.04` in both build and runtime stages.

### 5. No Image Runtime Validation
- **Impact**: Docker server image startup issues not caught until deployment
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: The `metadata_store_server` Docker image is built but never tested for startup validation, health checks, or functional correctness in CI. The `build_docker_image.sh` script only builds the image without running it.

## Quick Wins

### 1. Add Codecov Integration (2-3 hours)
Add coverage collection and upload to the conda-test workflow:
```yaml
    - name: Run tests with coverage
      shell: bash -l {0}
      run: |
        pytest -vv --cov=ml_metadata --cov-report=xml

    - name: Upload coverage
      uses: codecov/codecov-action@v4
      with:
        file: ./coverage.xml
        fail_ci_if_error: true
```

### 2. Add Trivy Scanning (1-2 hours)
```yaml
    - name: Build Docker image
      run: docker build -t mlmd-server -f ml_metadata/tools/docker_server/Dockerfile .

    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: 'mlmd-server'
        format: 'sarif'
        output: 'trivy-results.sarif'
        severity: 'CRITICAL,HIGH'
```

### 3. Add CodeQL Workflow (1-2 hours)
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
    runs-on: ubuntu-latest
    strategy:
      matrix:
        language: ['python', 'cpp']
    steps:
    - uses: actions/checkout@v4
    - uses: github/codeql-action/init@v3
      with:
        languages: ${{ matrix.language }}
    - uses: github/codeql-action/autobuild@v3
    - uses: github/codeql-action/analyze@v3
```

### 4. Add Workflow Concurrency Control (30 minutes)
Add to each workflow:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory** (4 workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `lint.yml` | PR + push to master | Run pre-commit hooks |
| `cd-docs.yml` | PR + push to master + dispatch | Build/deploy MkDocs documentation |
| `conda-build.yml` | PR + push + release + dispatch | Build wheels for Linux/macOS x Python 3.9-3.12 |
| `conda-test.yml` | PR + push + dispatch | Build, install, and run pytest for Linux/macOS x Python 3.9-3.12 |

**Strengths**:
- Matrix builds across 2 OS (Linux, macOS) x 4 Python versions (3.9, 3.10, 3.11, 3.12) = 8 build configurations
- Micromamba environment caching (`cache-environment: true`)
- Reusable build action at `.github/reusable-build/action.yml`
- Automated PyPI upload on release tags
- Wheel auditing (auditwheel on Linux, delocate on macOS)
- `fail-fast: false` ensures all matrix variants complete

**Gaps**:
- No concurrency control on any workflow — rapid pushes cause redundant CI runs
- No workflow status badges in README (only PyPI badge)
- No test result caching or test splitting
- conda-test workflow uses `setup.py bdist_wheel` while conda-build uses `python -m build` (inconsistency)
- No nightly/periodic test jobs
- Reusable build action (`reusable-build/action.yml`) uses Docker-based builds but is not invoked by any current workflow

### Test Coverage

**C++ Tests** (27 test files, ~20,600 LOC):
- Framework: Google Test (gtest) + Google Mock (gmock)
- Test targets: ~20 Bazel `cc_test` and `ml_metadata_cc_test` targets
- Backend-specific tests: SQLite, MySQL, PostgreSQL metadata access object tests
- Test utilities: `test_util.h/cc`, `metadata_store_test_suite.h/cc` (shared test harness)
- Query tests: `filter_query_ast_resolver_test.cc`, `filter_query_builder_test.cc`
- Utility tests: `field_mask_utils_test.cc`, `record_parsing_utils_test.cc`, `struct_utils_test.cc`

**Python Tests** (2 test files, ~2,400 LOC):
- Framework: pytest + absltest + parameterized
- `metadata_store_test.py` (~2,300 LOC): Comprehensive metadata store operations testing
- `mlmd_types_test.py` (~70 LOC): System type validation tests
- Configurable gRPC backend testing via pytest CLI options (conftest.py)

**Test-to-Code Ratio**:
- C++: 20,598 test LOC / 30,015 source LOC = **0.69** (moderate)
- Python: 2,394 test LOC / 3,049 source LOC = **0.79** (good)

**Gaps**:
- C++ tests only run via Bazel (not in GitHub Actions CI — conda-test only runs pytest)
- No coverage measurement for either C++ or Python
- No integration tests that deploy the gRPC server container
- No contract tests for the proto/gRPC API surface

### Code Quality

**Linting** (Good):
- **Ruff**: Comprehensive configuration in `pyproject.toml` with 15+ rule categories enabled (E, W, F, UP, B, SIM, I, N, D, ANN, T10, PT, RET, ARG, FIX, ERA, PD, NPY)
- Per-file ignores for `__init__.py` and `*_test.py` files
- Google docstring convention enforced
- isort configured with black profile

**Pre-commit Hooks** (Good):
- `pre-commit-hooks v4.6.0`: end-of-file-fixer, trailing-whitespace, check-json, check-yaml, check-toml
- `ruff-pre-commit v0.5.6`: Ruff linter with auto-fix
- CI enforcement via `pre-commit/action@v3.0.1` in lint workflow
- Pre-commit.ci integration for autoupdates

**Static Analysis** (Missing):
- No CodeQL/SAST for C++ or Python
- No secret detection (Gitleaks, TruffleHog)
- No type checking (mypy, pyright) despite Python type annotations in some files

### Container Images

**Dockerfiles** (3):

| Dockerfile | Purpose | Base Image |
|------------|---------|------------|
| `tools/docker_server/Dockerfile` | gRPC metadata store server | ubuntu:20.04 (EOL) |
| `tools/docker_build/Dockerfile.manylinux2010` | manylinux wheel building | gcr.io/tfx-oss-public/manylinux2014-bazel:bazel-6.5.0 |
| `tools/dev_debug/Dockerfile` | Development debugging environment | ubuntu:20.04 (EOL) |

**Strengths**:
- Server Dockerfile uses multi-stage build (builder + runtime)
- Minimal runtime image (only metadata_store_server binary + tzdata)
- Docker-compose for multi-Python-version wheel builds

**Gaps**:
- All base images use EOL `ubuntu:20.04` (EOL April 2025)
- No vulnerability scanning
- No SBOM generation
- No image signing/attestation
- No runtime validation tests
- No health check defined in server Dockerfile
- No `.dockerignore` file (copies entire repo context)
- Single architecture only (x86_64, no arm64)
- No container startup test in CI

### Security

**Overall Security Posture**: Weak

| Practice | Status |
|----------|--------|
| SAST/CodeQL | Not configured |
| Dependency scanning | Not configured |
| Secret detection | Not configured |
| Container scanning | Not configured |
| Signed releases | Not verified |
| SECURITY.md | Not present |
| Dependabot/Renovate | Not configured |

**Specific Concerns**:
- Bazel WORKSPACE pins ~15 third-party C++ dependencies by SHA256 hash but has no automated update mechanism
- Python dependencies in `setup.py` use wide version ranges (e.g., `protobuf>=4.21.6,<5`)
- No `SECURITY.md` file for vulnerability disclosure
- Docker images not signed or attested

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No test automation guidance for AI agents
- **Quality**: N/A
- **Gaps**: No `CLAUDE.md`, `AGENTS.md`, `.claude/` directory, or test creation rules exist
- **Recommendation**: Generate rules with `/test-rules-generator` to cover:
  - C++ gtest patterns and Bazel test target creation
  - Python pytest patterns with absltest compatibility
  - Multi-backend database test patterns
  - Proto/gRPC testing patterns

## Recommendations

### Priority 0 (Critical)
1. **Add code coverage tracking** — Integrate codecov with minimum thresholds (70%+ for Python). Add `--cov` to pytest in conda-test workflow. For C++, consider Bazel coverage with `--combined_report=lcov`.
2. **Add container vulnerability scanning** — Add Trivy or Grype scanning for all 3 Dockerfiles, block on CRITICAL/HIGH CVEs.
3. **Enable CodeQL** — Add CodeQL workflow for C++ and Python SAST. GitHub provides this free for public repositories.
4. **Upgrade base images** — Move from `ubuntu:20.04` (EOL) to `ubuntu:22.04` or `24.04` across all Dockerfiles.

### Priority 1 (High Value)
1. **Add Docker server smoke tests** — Build and start the metadata_store_server container in CI, verify gRPC health check responds.
2. **Add dependency management** — Configure Dependabot or Renovate for Python deps and Bazel WORKSPACE HTTP archives.
3. **Add workflow concurrency control** — Prevent redundant CI runs on rapid pushes.
4. **Run C++ tests in CI** — Currently only Python tests run in GitHub Actions. Add a workflow that runs Bazel C++ tests.
5. **Create agent rules** — Add `.claude/rules/` with patterns for C++ gtest, Python pytest, and multi-backend testing.
6. **Add SECURITY.md** — Provide vulnerability disclosure process.

### Priority 2 (Nice-to-Have)
1. **Add E2E integration tests** — Deploy metadata_store_server in a container, run gRPC client tests against it.
2. **Multi-architecture Docker builds** — Add arm64 support for the server image.
3. **Add SBOM generation** — Use Syft or Trivy to generate SBOMs for published images.
4. **Add performance regression testing** — Benchmark metadata store operations (Put/Get artifacts, lineage queries).
5. **Add Python type checking** — Enable mypy or pyright in CI alongside Ruff.
6. **Add Docker health check** — Add `HEALTHCHECK` instruction to server Dockerfile.

## Comparison to Gold Standards

| Practice | ml-metadata | odh-dashboard | notebooks | kserve |
|----------|-------------|---------------|-----------|--------|
| Unit test coverage | Moderate (C++ strong, Python limited) | Comprehensive | Moderate | Strong |
| Integration/E2E tests | Multi-backend DB only | Full E2E suite | Image testing | Multi-version |
| Coverage enforcement | None | Codecov with gates | None | Codecov enforced |
| Container scanning | None | Trivy integrated | Trivy integrated | Trivy + Snyk |
| SAST/CodeQL | None | CodeQL enabled | None | CodeQL enabled |
| Pre-commit hooks | Yes (Ruff) | Yes (comprehensive) | Limited | Yes |
| Image runtime tests | None | Deployment testing | 5-layer validation | Startup tests |
| CI concurrency | None | Configured | Configured | Configured |
| Agent rules | None | Comprehensive | None | Partial |
| Multi-arch images | No | Yes | Yes | Yes |
| Dependency scanning | None | Dependabot | Renovate | Dependabot |

## File Paths Reference

### CI/CD
- `.github/workflows/lint.yml` — Pre-commit lint enforcement
- `.github/workflows/cd-docs.yml` — MkDocs documentation deployment
- `.github/workflows/conda-build.yml` — Multi-OS/Python wheel building
- `.github/workflows/conda-test.yml` — Multi-OS/Python test execution
- `.github/reusable-build/action.yml` — Reusable Docker-based build action

### Build System
- `WORKSPACE` — Bazel workspace with ~15 external C++ dependencies
- `.bazelrc` — Bazel configuration (C++17, platform flags)
- `setup.py` — Python package setup with Bazel build integration
- `pyproject.toml` — pytest config, Ruff linter config, build system requirements
- `ml_metadata/metadata_store/BUILD` — Main Bazel BUILD file (~1046 lines, ~20 test targets)

### Testing
- `ml_metadata/metadata_store/*_test.cc` — 21 C++ test files
- `ml_metadata/query/*_test.cc` — 2 C++ query test files
- `ml_metadata/util/*_test.cc` — 4 C++ utility test files
- `ml_metadata/metadata_store/metadata_store_test.py` — Main Python test suite
- `ml_metadata/metadata_store/mlmd_types_test.py` — System types tests
- `ml_metadata/metadata_store/conftest.py` — pytest fixtures for gRPC backend

### Container Images
- `ml_metadata/tools/docker_server/Dockerfile` — gRPC server image
- `ml_metadata/tools/docker_build/Dockerfile.manylinux2010` — Wheel build image
- `ml_metadata/tools/dev_debug/Dockerfile` — Debug environment
- `docker-compose.yml` — Multi-Python-version wheel builds

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks (pre-commit-hooks + Ruff)
- `pyproject.toml` — Ruff linter configuration (15+ rule categories)
