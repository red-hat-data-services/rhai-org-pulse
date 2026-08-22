---
repository: "google/ml-metadata"
overall_score: 4.5
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Strong C++ test suite (~418 cases), moderate Python coverage (87 test functions), minimal Go"
  - dimension: "Integration/E2E"
    score: 4.0
    status: "Database-backend integration tests exist but no dedicated E2E suite or cluster testing"
  - dimension: "Build Integration"
    score: 5.0
    status: "PR builds wheels across OS/Python matrix, but no image validation or Konflux simulation"
  - dimension: "Image Testing"
    score: 3.0
    status: "Multi-stage Dockerfile exists but no runtime validation, healthchecks, or multi-arch"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "pytest-cov in dependencies but not wired into CI; no coverage gates or reporting"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "4 workflows with matrix testing; missing concurrency control, timeouts, parallelization"
  - dimension: "Static Analysis"
    score: 6.0
    status: "Comprehensive Ruff config with pre-commit CI; no Dependabot/Renovate or FIPS checks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory present"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Regressions in test coverage go undetected; no visibility into coverage trends"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No dedicated E2E or integration test suite"
    impact: "Cross-component interactions (gRPC server + clients) not validated in CI"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No container image runtime validation"
    impact: "Server image startup issues not caught until deployment; ubuntu:20.04 is EOL"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No dependency alert configuration"
    impact: "Vulnerable dependencies not automatically flagged; manual monitoring required"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No concurrency control or timeout in CI"
    impact: "Redundant CI runs waste resources; stuck builds can block pipelines indefinitely"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Enable Dependabot for automated dependency alerts"
    effort: "1-2 hours"
    impact: "Automated security and dependency updates with PR generation for pip, Bazel deps"
  - title: "Add concurrency control and timeouts to CI workflows"
    effort: "1-2 hours"
    impact: "Prevent duplicate runs and stuck builds; save CI minutes"
  - title: "Wire pytest-cov into CI and add Codecov integration"
    effort: "2-4 hours"
    impact: "Visibility into Python test coverage with PR-level reporting and threshold enforcement"
  - title: "Add HEALTHCHECK to server Dockerfile"
    effort: "1 hour"
    impact: "Container orchestrators can detect unhealthy instances and restart them"
recommendations:
  priority_0:
    - "Wire pytest-cov into CI test workflow and integrate Codecov for coverage reporting and gate enforcement"
    - "Add Dependabot configuration covering pip and docker ecosystems"
    - "Upgrade server Dockerfile base image from EOL ubuntu:20.04 to ubuntu:24.04 or UBI for FIPS compatibility"
  priority_1:
    - "Create a dedicated integration test workflow that builds the server image, starts it, and runs gRPC client tests against it"
    - "Add concurrency control and timeout-minutes to all GitHub Actions workflows"
    - "Add container HEALTHCHECK and runtime validation tests"
    - "Create agent rules (CLAUDE.md / .claude/rules/) for test automation guidance"
  priority_2:
    - "Add multi-architecture support for server Docker image (amd64/arm64)"
    - "Add Go test coverage and expand Go binding tests beyond single test file"
    - "Add C++ coverage reporting via Bazel's coverage support"
---

# Quality Analysis: google/ml-metadata

## Executive Summary

- **Overall Score: 4.5/10**
- **Repository Type**: Library (ML metadata store with gRPC server)
- **Primary Languages**: C++ (core), Python (bindings/API), Go (bindings)
- **Build System**: Bazel (C++ core), setuptools (Python wheel)
- **RHOAI Component**: AI Pipelines (RHOAIENG)
- **Tier**: Upstream

### Key Strengths
- Extensive C++ unit test suite with ~418 test cases covering multiple database backends (SQLite, MySQL, PostgreSQL)
- Comprehensive Python linting with Ruff (17+ rule categories) and pre-commit CI integration
- Cross-platform CI builds (Linux + macOS) across 4 Python versions (3.10-3.13)
- Well-structured pytest configuration with fixtures and gRPC backend support via conftest.py

### Critical Gaps
- No coverage tracking or enforcement despite pytest-cov being available in the environment
- No dedicated E2E/integration test suite in CI
- No container runtime validation or image health checks
- No dependency alert configuration (Dependabot/Renovate)
- No agent rules for AI-assisted development

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 7.0/10 | 15% | 1.05 | Strong C++ suite, moderate Python |
| Integration/E2E | 4.0/10 | 20% | 0.80 | DB tests exist, no dedicated E2E |
| Build Integration | 5.0/10 | 15% | 0.75 | PR wheel builds, no image validation |
| Image Testing | 3.0/10 | 10% | 0.30 | Basic Dockerfiles, no runtime tests |
| Coverage Tracking | 2.0/10 | 10% | 0.20 | pytest-cov available but unused |
| CI/CD Automation | 5.0/10 | 15% | 0.75 | Matrix testing, missing controls |
| Static Analysis | 6.0/10 | 10% | 0.60 | Good Ruff config, no dep alerts |
| Agent Rules | 0.0/10 | 5% | 0.00 | None present |
| **Overall** | **4.5/10** | **100%** | **4.45** | |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: Regressions in test coverage go completely undetected; no historical trend data
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The Conda environments include `pytest-cov` as a dependency, but the `conda-test.yml` workflow runs `pytest -vv` without coverage flags. No `.codecov.yml` exists. No coverage thresholds or PR reporting is configured.
- **Evidence**: `ci/environment.yml` lists `pytest-cov`, but `.github/workflows/conda-test.yml` only runs `pytest -vv`

### 2. No Dedicated E2E/Integration Test Suite
- **Impact**: Cross-component interactions between the gRPC metadata store server and Python/Go clients are not systematically validated in CI
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: While `conftest.py` supports `--use_grpc_backend` for testing against a live gRPC server, this is not exercised in CI. The C++ tests cover database backends individually, but there is no end-to-end pipeline testing the full server deployment.

### 3. No Container Image Runtime Validation
- **Impact**: Server image startup failures not caught until deployment; EOL base image creates security exposure
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: The server Dockerfile (`ml_metadata/tools/docker_server/Dockerfile`) uses `ubuntu:20.04` which reached end of standard support in April 2025. No HEALTHCHECK instruction is present. No CI workflow builds or tests the server image.

### 4. No Dependency Alert Configuration
- **Impact**: Vulnerable transitive dependencies not automatically flagged
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: Neither `.github/dependabot.yml` nor Renovate configuration exists. The project has pinned Bazel dependencies with SHA256 hashes (good for reproducibility) but no automated alerting when upstream patches land.

### 5. No CI Concurrency Control or Timeouts
- **Impact**: Multiple pushes to the same PR trigger duplicate Bazel builds that waste CI resources
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: No `concurrency:` blocks or `timeout-minutes:` in any workflow. Bazel builds are expensive (C++ compilation), so duplicate runs are costly.

## Quick Wins

### 1. Enable Dependabot (1-2 hours)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "docker"
    directory: "/ml_metadata/tools/docker_server"
    schedule:
      interval: "monthly"
```

### 2. Add Concurrency Control and Timeouts (1-2 hours)
Add to each workflow:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    timeout-minutes: 60
```

### 3. Wire pytest-cov into CI (2-4 hours)
Update `conda-test.yml` test step:
```yaml
- name: Run tests
  run: |
    rm -rf bazel-*
    pytest -vv --cov=ml_metadata --cov-report=xml --cov-report=term
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: coverage.xml
    fail_ci_if_error: false
```

### 4. Add HEALTHCHECK to Server Dockerfile (1 hour)
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD grpc_health_probe -addr=:${GRPC_PORT} || exit 1
```

## Detailed Findings

### Unit Tests

**Score: 7.0/10**

The project has a solid C++ test foundation:

| Language | Test Files | Test Cases | Source Files | Test Ratio |
|----------|-----------|------------|--------------|------------|
| C++ | 27 | ~418 | 31 | 0.87 |
| Python | 2 | ~87 | 14 | 0.14 |
| Go | 1 | unknown | 3 | 0.33 |
| **Total** | **30** | **~505+** | **48** | **0.63** |

**C++ Tests (Strong)**:
- Uses Google Test framework (TEST, TEST_F, TEST_P macros)
- Covers multiple database backends: SQLite, MySQL, PostgreSQL
- `metadata_access_object_test.cc` alone has 179 test cases
- Per-backend test files (e.g., `mysql_metadata_source_test.cc`, `sqlite_metadata_source_test.cc`)
- Utility tests for query builders, parsers, and field masks

**Python Tests (Moderate)**:
- `metadata_store_test.py`: 2328 lines, 85 test functions using pytest + absltest
- `mlmd_types_test.py`: 66 lines, 2 test functions
- Uses pytest fixtures (`conftest.py`) with gRPC backend parameterization
- Some tests marked `xfail` (known failures pending fixes)

**Go Tests (Minimal)**:
- Only 1 test file: `metadata_store_test.go`

### Integration/E2E Tests

**Score: 4.0/10**

- **No dedicated E2E or integration directory** (`e2e/`, `integration/`, `test/`)
- **Database backend tests serve as partial integration tests**: C++ tests cover SQLite, MySQL, and PostgreSQL backends with dedicated test source files and initializers
- **gRPC integration capability exists but is unused in CI**: `conftest.py` supports `--use_grpc_backend`, `--grpc_host`, `--grpc_port` flags, allowing Python tests to run against a live gRPC server, but no CI workflow exercises this path
- **docker-compose.yml is for build only**: Defines manylinux build containers for different Python versions, not for integration testing
- **No Kubernetes/cluster testing**: Not directly applicable as this is a library, but the gRPC server component could benefit from deployment testing

### Build Integration

**Score: 5.0/10**

- **PR wheel builds**: `conda-build.yml` runs on PRs and builds Python wheels
- **Cross-platform matrix**: Ubuntu + macOS, Python 3.10-3.13 (8 build configurations)
- **Bazel-based C++ build**: Complex native build with bazelisk version management
- **Wheel repair**: `auditwheel` (Linux) for manylinux compliance
- **Artifact upload**: Built wheels uploaded as GitHub Actions artifacts
- **PyPI publishing**: Automated on release tags
- **Missing**: No Konflux build simulation, no Docker image builds in CI, no operator manifests (not applicable)

### Image Testing

**Score: 3.0/10**

**Dockerfiles present**:
1. `ml_metadata/tools/docker_server/Dockerfile` - Server image with multi-stage build
2. `ml_metadata/tools/docker_build/Dockerfile.manylinux2010` - Build environment
3. `ml_metadata/tools/dev_debug/Dockerfile` - Dev debugging

**Issues**:
- **EOL base image**: `ubuntu:20.04` (standard support ended April 2025)
- **Not UBI-based**: Uses `ubuntu:20.04`, not FIPS-capable without additional work
- **No HEALTHCHECK**: Server Dockerfile has no health check instruction
- **No multi-architecture**: No `--platform` flags, no `docker buildx`
- **No CI image builds**: Dockerfiles exist but no workflow builds or tests them
- **No Testcontainers or runtime validation**: No automated container startup testing

### Coverage Tracking

**Score: 2.0/10**

- **pytest-cov in dependencies**: Both `ci/environment.yml` and `ci/environment-macos.yml` list `pytest-cov`
- **Not used in CI**: `conda-test.yml` runs `pytest -vv` without any coverage flags
- **No .codecov.yml**: No Codecov configuration file
- **No coverage thresholds**: No minimum coverage enforcement
- **No PR coverage comments**: No coverage change reporting on PRs
- **No C++ or Go coverage**: Bazel supports coverage via `bazel coverage` but it's not configured
- The gap between having `pytest-cov` installed and not using it suggests coverage was planned but never fully implemented

### CI/CD Automation

**Score: 5.0/10**

**Workflow Inventory**:
| Workflow | Triggers | Purpose |
|----------|----------|---------|
| `lint.yml` | PR, push to master | pre-commit checks (ruff, formatting) |
| `conda-build.yml` | PR, push, release, dispatch | Build Python wheels (2 OS x 4 Python) |
| `conda-test.yml` | PR, push, dispatch | Run pytest (2 OS x 4 Python) |
| `cd-docs.yml` | PR, push, dispatch | Build/deploy MkDocs documentation |

**Strengths**:
- All workflows trigger on PRs (shift-left testing)
- Matrix strategy with `fail-fast: false` (ensures all platform/version combos run)
- Environment caching with Micromamba (`cache-environment: true`)
- pip caching for docs workflow
- Separate build and test workflows (good separation of concerns)

**Gaps**:
- No `concurrency:` control on any workflow
- No `timeout-minutes:` on any job
- No test parallelization or sharding
- No periodic/scheduled workflows (e.g., nightly builds)
- Bazel not cached between runs (expensive C++ recompilation on every PR update)

### Static Analysis

**Score: 6.0/10**

#### Linting
**Strong Python linting with Ruff** (configured in `pyproject.toml`):
- 17+ rule categories enabled: pycodestyle (E/W), Pyflakes (F), pyupgrade (UP), flake8-bugbear (B), flake8-simplify (SIM), isort (I), pep8-naming (N), pydocstyle (D), annotations (ANN), debugger (T10), flake8-pytest (PT), flake8-return (RET), flake8-unused-args (ARG), flake8-fixme (FIX), flake8-eradicate (ERA), pandas-vet (PD), numpy (NPY)
- Per-file ignores for `__init__.py` and `*_test.py`
- Google docstring convention
- Line length: 88

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- `pre-commit.ci` enabled with monthly auto-updates
- Hooks: end-of-file-fixer, trailing-whitespace, check-json, check-yaml, check-toml, ruff with `--fix`
- CI enforcement via `lint.yml` workflow

**No C++ linting**: No clang-tidy, cpplint, or similar configured

#### FIPS Compatibility
- No non-FIPS crypto imports found in source code (no `crypto/md5`, `crypto/des`, etc.)
- No FIPS build tags configured
- **Concern**: Server Dockerfile uses `ubuntu:20.04` (not UBI-based, not FIPS-capable by default)
- BoringSSL referenced in WORKSPACE as a Bazel dependency (used via gRPC)

#### Dependency Alerts
- **No Dependabot configuration** (`.github/dependabot.yml` missing)
- **No Renovate configuration** (no `renovate.json`, `.renovaterc`)
- Bazel dependencies pinned with SHA256 hashes (good for reproducibility but no auto-update mechanism)

### Agent Rules

**Score: 0.0/10**

- **Status**: Missing
- **Coverage**: None - no `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory
- **Quality**: N/A
- **Gaps**: Complete absence of agent rules for test creation, code review, or development guidance
- **Recommendation**: Generate test creation rules with `/test-rules-generator` covering:
  - C++ Google Test patterns for database backend tests
  - Python pytest patterns with fixtures and gRPC backend parameterization
  - Go test patterns for binding tests
  - Bazel BUILD file test target patterns

## Recommendations

### Priority 0 (Critical)

1. **Wire pytest-cov into CI and integrate Codecov** - The dependency is already installed; just add `--cov` flags and the Codecov action. Set a baseline coverage threshold (e.g., 70%) and enforce on PRs.

2. **Add Dependabot configuration** - Create `.github/dependabot.yml` covering `pip`, `github-actions`, and `docker` ecosystems. This is a <1 hour task with immediate security benefits.

3. **Upgrade server Dockerfile base image** - `ubuntu:20.04` is EOL. Upgrade to `ubuntu:24.04` or switch to UBI 9 for FIPS compatibility (`registry.access.redhat.com/ubi9/ubi-minimal`).

### Priority 1 (High Value)

4. **Create integration test workflow** - Build the server Docker image in CI, start it, and run Python tests with `--use_grpc_backend` flag against the live server. The test infrastructure already supports this via `conftest.py`.

5. **Add concurrency control and timeouts** - Add `concurrency:` groups and `timeout-minutes:` to all workflows. Prevents duplicate Bazel builds and stuck pipelines.

6. **Add container HEALTHCHECK and runtime validation** - Add `grpc_health_probe` to the server Dockerfile and create a basic smoke test that verifies the image starts and responds to health checks.

7. **Create agent rules** - Add `CLAUDE.md` with project overview and `.claude/rules/` with test creation patterns for C++ (Google Test), Python (pytest), and Go.

### Priority 2 (Nice-to-Have)

8. **Add multi-architecture Docker support** - Build server image for amd64 and arm64 using `docker buildx`.

9. **Expand Go test coverage** - Only 1 Go test file exists for 3 Go source files. Add tests for Go bindings.

10. **Add Bazel remote caching or local disk caching in CI** - Bazel C++ builds are expensive; caching would significantly reduce CI time.

11. **Add C++ coverage via `bazel coverage`** - Extend coverage tracking to the C++ core, which is the majority of the codebase.

## Comparison to Gold Standards

| Dimension | ml-metadata | odh-dashboard | notebooks | kserve |
|-----------|-------------|---------------|-----------|--------|
| Unit Tests | 7.0 | 9.0 | 7.0 | 8.0 |
| Integration/E2E | 4.0 | 9.0 | 8.0 | 9.0 |
| Build Integration | 5.0 | 8.0 | 9.0 | 7.0 |
| Image Testing | 3.0 | 6.0 | 9.0 | 6.0 |
| Coverage Tracking | 2.0 | 8.0 | 6.0 | 8.0 |
| CI/CD Automation | 5.0 | 9.0 | 8.0 | 8.0 |
| Static Analysis | 6.0 | 7.0 | 6.0 | 7.0 |
| Agent Rules | 0.0 | 8.0 | 2.0 | 2.0 |
| **Overall** | **4.5** | **8.3** | **7.2** | **7.2** |

**Key Differentiators**:
- ml-metadata's Ruff configuration is actually more comprehensive than many gold standards
- The C++ test suite is thorough for the core metadata store logic
- Major gaps are in CI automation (coverage, image testing, integration) and container practices
- As an upstream Google project, it follows Google's internal practices (Bazel, Google Test) which diverge from the Kubernetes/OpenShift ecosystem norms

## File Paths Reference

### CI/CD
- `.github/workflows/lint.yml` - Pre-commit linting workflow
- `.github/workflows/conda-build.yml` - Python wheel build workflow
- `.github/workflows/conda-test.yml` - Python test workflow
- `.github/workflows/cd-docs.yml` - Documentation deployment
- `ci/environment.yml` - Linux Conda environment
- `ci/environment-macos.yml` - macOS Conda environment

### Build
- `WORKSPACE` - Bazel workspace with external dependencies
- `BUILD` - Root Bazel build file
- `setup.py` - Python package setup with Bazel integration
- `pyproject.toml` - Python project config (pytest, ruff, build-system)

### Testing
- `ml_metadata/metadata_store/*_test.cc` - C++ unit tests (27 files)
- `ml_metadata/metadata_store/metadata_store_test.py` - Python store tests (2328 lines)
- `ml_metadata/metadata_store/mlmd_types_test.py` - Python types tests
- `ml_metadata/metadata_store/metadata_store_test.go` - Go binding tests
- `ml_metadata/metadata_store/conftest.py` - pytest configuration with gRPC support
- `ml_metadata/query/*_test.cc` - Query builder/resolver tests
- `ml_metadata/util/*_test.cc` - Utility tests

### Container Images
- `ml_metadata/tools/docker_server/Dockerfile` - gRPC metadata store server
- `ml_metadata/tools/docker_build/Dockerfile.manylinux2010` - Build environment
- `ml_metadata/tools/dev_debug/Dockerfile` - Development debugging
- `docker-compose.yml` - Multi-Python-version build orchestration

### Static Analysis
- `pyproject.toml` - Ruff linter configuration (extensive ruleset)
- `.pre-commit-config.yaml` - Pre-commit hooks (ruff, formatting checks)

### Coverage
- `ci/environment.yml` - Lists `pytest-cov` dependency (not wired into CI)
