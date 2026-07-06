---
repository: "opendatahub-io/ml-metadata"
overall_score: 3.4
scorecard:
  - dimension: "Unit Tests"
    score: 6.0
    status: "Extensive upstream C++ unit tests via Bazel (27 test files, 20K+ LOC), but none run in CI"
  - dimension: "Integration/E2E"
    score: 2.0
    status: "No integration or E2E tests in CI; multi-DB tests (MySQL/PostgreSQL) exist but are manual-only"
  - dimension: "Build Integration"
    score: 3.0
    status: "PR workflow builds Docker image only; no test execution, no Konflux simulation, no runtime validation"
  - dimension: "Image Testing"
    score: 2.0
    status: "No image startup validation, no runtime testing, no health check verification"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage generation, no codecov/coveralls, no thresholds, no PR reporting"
  - dimension: "CI/CD Automation"
    score: 4.0
    status: "Minimal CI — image build on PR, image push on merge; no test execution, no linting, no security scanning"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules or test guidance"
critical_gaps:
  - title: "No tests run in CI/CD pipeline"
    impact: "Code changes are merged without any automated test validation — regressions can ship undetected"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No coverage tracking or enforcement"
    impact: "No visibility into which code is tested; coverage can silently decrease over time"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No security scanning (Trivy, CodeQL, SAST)"
    impact: "Vulnerabilities in C++ code, Python dependencies, and container image go undetected"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No linting or static analysis in CI"
    impact: "Code quality issues, style inconsistencies, and potential bugs not caught before merge"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No container image runtime validation"
    impact: "Image may fail at startup in production; gRPC server health not verified"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No PR-time Konflux build simulation"
    impact: "Tekton/Konflux build issues discovered only post-merge in RHOAI pipeline"
    severity: "MEDIUM"
    effort: "8-12 hours"
quick_wins:
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Detect CVEs in UBI base image and installed packages before merge"
  - title: "Add Python unit test execution to CI"
    effort: "2-4 hours"
    impact: "Run the 4 Python test files (types_test, mlmd_types_test, metadata_store_test, metadata_resolver_test) on every PR"
  - title: "Add basic image startup validation"
    effort: "2-3 hours"
    impact: "Verify the gRPC server starts and responds to health checks after build"
  - title: "Create basic CLAUDE.md with project overview"
    effort: "1-2 hours"
    impact: "Enable AI-assisted development with project context and conventions"
  - title: "Add pre-commit hooks for Python linting"
    effort: "1-2 hours"
    impact: "Catch formatting and import issues before code reaches CI"
recommendations:
  priority_0:
    - "Add test execution to the PR workflow — at minimum, run Python unit tests and validate the built image starts"
    - "Integrate Trivy or Grype scanning into the container build workflow for vulnerability detection"
    - "Add codecov integration and establish baseline coverage thresholds"
  priority_1:
    - "Add a Bazel test workflow (even for SQLite-backed tests that don't require external DBs)"
    - "Create comprehensive agent rules for test automation (.claude/rules/)"
    - "Add CodeQL or Semgrep for static analysis of C++ and Python code"
  priority_2:
    - "Add gRPC integration tests that validate the metadata_store_server binary against SQLite"
    - "Implement PR-time Konflux build simulation to catch build issues earlier"
    - "Add multi-architecture image build validation (amd64/arm64)"
---

# Quality Analysis: ml-metadata (opendatahub-io fork)

## Executive Summary

- **Overall Score: 3.4/10**
- **Repository Type**: Library + gRPC Server (C++/Python/Go, Bazel build system)
- **Primary Purpose**: ML Metadata (MLMD) store — records and retrieves metadata for ML workflows. The opendatahub-io fork adds a Red Hat UBI-based container image for the gRPC server.
- **Key Strengths**: Comprehensive upstream unit test suite (27 C++ test files, ~20K LOC), well-structured Bazel build, multi-database support (SQLite, MySQL, PostgreSQL), Tekton/Konflux pipeline for RHOAI integration
- **Critical Gaps**: No tests run in CI, no coverage tracking, no security scanning, no linting, no image validation, no agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, no .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.0/10 | Extensive upstream C++ tests exist but none execute in CI |
| Integration/E2E | 2.0/10 | MySQL/PostgreSQL tests exist but are manual-only |
| **Build Integration** | **3.0/10** | **PR builds Docker image only — no tests, no validation** |
| Image Testing | 2.0/10 | No startup validation, no health checks, no runtime testing |
| Coverage Tracking | 0.0/10 | No coverage generation or reporting anywhere |
| CI/CD Automation | 4.0/10 | Minimal — image build on PR, push on merge, nothing else |
| Agent Rules | 0.0/10 | No agent rules, no test guidance, no CLAUDE.md |

## Critical Gaps

### 1. No Tests Run in CI/CD Pipeline
- **Impact**: Code changes merge without any automated test validation. Regressions in the metadata store, query executor, or gRPC server can ship undetected.
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: The repository has an extensive test suite inherited from Google's upstream ml-metadata:
  - 27 C++ test files (~20,600 lines of test code)
  - 4 Python test files (~4,133 lines)
  - 1 Go test file (~1,559 lines)
  - But **none of these run in any CI workflow**
- **Root Cause**: The CI workflows (`build-pr.yaml`, `build-master.yaml`) only build the Docker image. There is no test execution step.

### 2. No Coverage Tracking or Enforcement
- **Impact**: No visibility into which code paths are tested. Coverage can silently decrease as new code is added.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: No `.codecov.yml`, no `coveralls` integration, no coverage reports generated during builds. The Bazel build system supports `bazel coverage` but it is not configured or used.

### 3. No Security Scanning
- **Impact**: Vulnerabilities in C++ code, Python dependencies, and the UBI container image go undetected until downstream scanning catches them.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**:
  - No Trivy, Snyk, or Grype scanning of the container image
  - No CodeQL or Semgrep for static analysis
  - No dependency scanning (despite using `numpy`, `protobuf`, and many C++ libraries)
  - No `.gitleaks.toml` or secret detection
  - No `.trivyignore` for managing known vulnerabilities
  - The Tekton/Konflux pipeline may include some scanning, but it runs post-merge only

### 4. No Linting or Static Analysis in CI
- **Impact**: Code quality issues, undefined behavior in C++, Python style violations not caught before merge.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**:
  - No `.golangci.yaml` for Go code
  - No `.flake8`, `ruff.toml`, or `mypy.ini` for Python
  - No clang-tidy or cppcheck for C++
  - No `.pre-commit-config.yaml`
  - No ESLint (no JS/TS code)

### 5. No Container Image Runtime Validation
- **Impact**: Built image may fail to start, gRPC server may crash at runtime, health endpoint may be non-functional.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The PR workflow builds the image but never runs it. No validation that:
  - The `metadata_store_server` binary starts successfully
  - The gRPC port (8080) is listening
  - The server responds to health checks
  - SQLite-backed configuration works in the container

### 6. No PR-time Konflux Build Simulation
- **Impact**: Tekton/Konflux build issues discovered only after merge in the RHOAI pipeline.
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Details**: The `.tekton/` directory defines Konflux PipelineRuns, but there is no simulation of this build process in the GitHub Actions PR workflow.

## Quick Wins

### 1. Add Trivy Container Scanning to PR Workflow (1-2 hours)
**Impact**: Detect CVEs in UBI base image and installed packages before merge.

```yaml
# Add to .github/workflows/build-pr.yaml after Build Image step
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'quay.io/${{ env.QUAY_ORG }}/${{ env.MLMD_IMAGE_REPO }}:${{ steps.tags.outputs.tag }}'
    format: 'table'
    exit-code: '1'
    severity: 'CRITICAL,HIGH'
```

### 2. Add Python Unit Test Execution to CI (2-4 hours)
**Impact**: Run the existing 4 Python test files on every PR.

```yaml
# New job in build-pr.yaml
test-python:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v5
      with:
        python-version: '3.11'
    - name: Install dependencies
      run: pip install ml-metadata absl-py
    - name: Run Python tests
      run: |
        python -m pytest ml_metadata/metadata_store/types_test.py
        python -m pytest ml_metadata/metadata_store/mlmd_types_test.py
```

### 3. Add Basic Image Startup Validation (2-3 hours)
**Impact**: Verify the gRPC server starts and responds after build.

```yaml
- name: Validate image startup
  run: |
    docker run -d --name mlmd-test \
      -e GRPC_PORT=8080 \
      -e METADATA_STORE_SERVER_CONFIG_FILE="" \
      -p 8080:8080 \
      quay.io/${{ env.QUAY_ORG }}/${{ env.MLMD_IMAGE_REPO }}:${{ steps.tags.outputs.tag }}
    sleep 5
    docker logs mlmd-test
    # Verify container is still running (didn't crash)
    docker inspect --format='{{.State.Running}}' mlmd-test | grep true
    docker stop mlmd-test
```

### 4. Create Basic CLAUDE.md (1-2 hours)
**Impact**: Enable AI-assisted development with project context.

### 5. Add Pre-commit Hooks (1-2 hours)
**Impact**: Catch formatting and import issues before code reaches CI.

## Detailed Findings

### CI/CD Pipeline

**Workflows Found**: 2 GitHub Actions + 2 Tekton PipelineRuns

| Workflow | Trigger | Purpose | Tests Run? |
|----------|---------|---------|------------|
| `build-pr.yaml` | PR (paths-ignore docs) | Build Docker image | No |
| `build-master.yaml` | Push to master | Build + push to Quay | No |
| `odh-mlmd-grpc-server-pull-request.yaml` | Tekton PR (master) | Konflux multi-arch build | No |
| `odh-mlmd-grpc-server-push.yaml` | Tekton push (master) | Konflux stable build | No |

**Positives**:
- Concurrency control on PR builds (`cancel-in-progress: true`)
- Paths-ignore for docs/licenses
- Composite action for build reuse (`.github/actions/build/`)
- Tekton pipelines use centralized `odh-konflux-central` pipeline definitions
- Resource-conscious Tekton builds (8 CPU / 16Gi request)

**Gaps**:
- No test execution in any workflow
- No linting step
- No security scanning
- No cache optimization (Bazel cache not persisted)
- Master workflow lacks branch protection context
- No status checks required for merge

### Test Coverage

**Test Inventory**:

| Language | Test Files | Test LOC | Production LOC | Ratio |
|----------|-----------|----------|----------------|-------|
| C++ | 27 | 20,600 | 30,104 | 0.68 |
| Python | 4 | 4,133 | 5,189 | 0.80 |
| Go | 1 | 1,559 | 1,512 | 1.03 |
| **Total** | **32** | **26,292** | **36,805** | **0.71** |

**Test Types Present**:
- Unit tests for metadata access objects (SQLite, MySQL, PostgreSQL backends)
- Unit tests for query executors and config executors
- Unit tests for utility functions (struct_utils, field_mask, record_parsing)
- Integration tests for metadata resolver
- Go wrapper tests
- Test suite infrastructure (`metadata_store_test_suite.cc` — 7,646 LOC)

**Test Types Missing**:
- E2E tests for gRPC server
- Container runtime tests
- Performance/load tests
- Contract tests for proto compatibility
- Fuzz tests for query builder

**Test Frameworks**:
- C++: Google Test (gtest/gmock)
- Python: absl.testing (absltest, parameterized)
- Go: standard testing package

### Code Quality

**Linting**: None configured
- No `.golangci.yaml`
- No `.flake8`, `ruff.toml`, `mypy.ini`
- No clang-tidy configuration
- No `.pre-commit-config.yaml`

**Static Analysis**: None
- No CodeQL workflow
- No Semgrep rules
- No gosec or bandit

**Build System**: Bazel 5.x
- Well-structured BUILD files with explicit dependency declarations
- Custom macros for cross-platform testing (`ml_metadata_cc_test`)
- Separate build configurations for macOS/arm64

### Container Images

**Dockerfiles Found**: 4

| Dockerfile | Purpose | Base Image |
|------------|---------|------------|
| `Dockerfile.redhat` | RHOAI production image | `ubi9/ubi` (builder) + `ubi9/ubi-minimal` (runtime) |
| `Dockerfile` | Upstream development | `ubuntu:20.04` |
| `Dockerfile.fedora` | Alternative build | Fedora-based |
| `Dockerfile.manylinux2010` | Python wheel builds | manylinux |

**Positives (Dockerfile.redhat)**:
- Multi-stage build (builder → minimal runtime)
- UBI9 base images (Red Hat compliant)
- Non-root user (`65534:65534`)
- Minimal runtime image
- Explicit `tzdata` fix for known issue

**Gaps**:
- No HEALTHCHECK instruction
- No SBOM generation
- No image signing/attestation
- No vulnerability scanning during build
- No multi-architecture build in GitHub Actions (Tekton handles this)
- `ENTRYPOINT` uses shell form instead of exec form (PID 1 issue)

### Security

**Current State**: No security practices implemented in CI/CD

| Practice | Status |
|----------|--------|
| Container scanning (Trivy/Snyk) | Missing |
| SAST/CodeQL | Missing |
| Dependency scanning | Missing |
| Secret detection (Gitleaks) | Missing |
| Image signing | Missing |
| SBOM generation | Missing |
| Non-root container | Present (user 65534) |
| Minimal base image | Present (ubi-minimal) |

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: No test automation guidance, no coding standards documentation for AI agents, no project-specific rules
- **Recommendation**: Generate test creation rules with `/test-rules-generator` covering:
  - C++ unit test patterns (gtest/gmock with Bazel)
  - Python test patterns (absltest)
  - Go test patterns
  - Integration test patterns for multi-database backends

## Recommendations

### Priority 0 (Critical)

1. **Add test execution to CI** — At minimum, add a Python test job to `build-pr.yaml`. For C++ tests, consider running SQLite-backed Bazel tests (no external DB required):
   ```bash
   bazel test //ml_metadata/metadata_store:metadata_store_cc_test \
     //ml_metadata/metadata_store:metadata_source_test \
     //ml_metadata/util:...
   ```

2. **Integrate container image scanning** — Add Trivy to the PR workflow to catch CVEs in UBI base image and installed packages before merge.

3. **Add coverage tracking** — Set up Bazel coverage generation and integrate with Codecov. Establish baseline thresholds before enforcing.

### Priority 1 (High Value)

4. **Add static analysis** — CodeQL for C++ and Python, or Semgrep for custom rules. Even basic clang-tidy would catch undefined behavior in C++.

5. **Create agent rules** — Add `.claude/rules/` with test patterns for each language. This enables AI-assisted test creation that matches existing patterns.

6. **Add image runtime validation** — Verify the gRPC server starts, listens on the expected port, and responds to basic requests.

7. **Add pre-commit hooks** — Python formatting (black/ruff), import sorting (isort), and basic C++ formatting (clang-format).

### Priority 2 (Nice-to-Have)

8. **Add gRPC E2E tests** — Test the server binary with real gRPC calls against SQLite backend.

9. **Add PR-time Konflux simulation** — Simulate the Tekton build in GitHub Actions to catch build issues earlier.

10. **Add multi-architecture build validation** — Validate arm64 build in GitHub Actions, not just Tekton.

11. **Add performance regression tests** — Track query latency for common metadata store operations.

## Comparison to Gold Standards

| Dimension | ml-metadata | odh-dashboard | notebooks | kserve |
|-----------|-------------|---------------|-----------|--------|
| Unit Tests | 6/10 (exist, not in CI) | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 2/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 3/10 | 7/10 | 8/10 | 8/10 |
| Image Testing | 2/10 | 7/10 | 9/10 | 7/10 |
| Coverage Tracking | 0/10 | 8/10 | 5/10 | 8/10 |
| CI/CD Automation | 4/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 0/10 | 8/10 | 3/10 | 2/10 |
| **Overall** | **3.4/10** | **8.3/10** | **7.1/10** | **7.8/10** |

## Key Observations

### Fork-Specific Context
This is a fork of Google's `google/ml-metadata`. The opendatahub-io fork primarily adds:
- `Dockerfile.redhat` for RHOAI-compatible container builds
- `.tekton/` Konflux pipeline configurations
- GitHub Actions workflows for image building

The fork inherits a rich test suite from upstream but has not integrated test execution into its CI/CD pipeline. This is a common pattern in "build-only" forks but represents a significant quality risk.

### Build System Complexity
The project uses Bazel, which adds complexity to CI integration:
- Bazel builds are slow and resource-intensive (the Tekton pipeline allocates 16 CPU / 32Gi)
- Caching is critical but not set up in GitHub Actions
- Some tests require external databases (MySQL, PostgreSQL)
- SQLite-backed tests can run without external dependencies and should be the starting point

### Low Fork Activity
The repository has only 24 commits on the fork, with the most recent being a zip fix merge. This suggests the fork is primarily a build/packaging vehicle rather than an active development fork. Quality investments should focus on ensuring the build output (container image) is reliable rather than upstream code quality.

## File Paths Reference

### CI/CD
- `.github/workflows/build-pr.yaml` — PR image build
- `.github/workflows/build-master.yaml` — Master push + image push
- `.github/actions/build/action.yaml` — Composite build action
- `.tekton/odh-mlmd-grpc-server-pull-request.yaml` — Konflux PR pipeline
- `.tekton/odh-mlmd-grpc-server-push.yaml` — Konflux push pipeline

### Testing
- `ml_metadata/metadata_store/*_test.cc` — C++ unit tests (27 files)
- `ml_metadata/metadata_store/*_test.py` — Python unit tests (3 files)
- `ml_metadata/metadata_store/*_test.go` — Go tests (1 file)
- `ml_metadata/tools/mlmd_resolver/metadata_resolver_test.py` — Resolver integration test
- `ml_metadata/util/*_test.cc` — Utility tests (4 files)
- `ml_metadata/query/*_test.cc` — Query tests (2 files)

### Container Images
- `ml_metadata/tools/docker_server/Dockerfile.redhat` — RHOAI production image
- `ml_metadata/tools/docker_server/Dockerfile` — Upstream dev image
- `ml_metadata/tools/docker_server/build_docker_image.sh` — Build script
- `docker-compose.yml` — Multi-Python-version wheel builds
- `.dockerignore`

### Build System
- `WORKSPACE` — Bazel workspace with external dependencies
- `.bazelrc` — Bazel configuration (C++17)
- `ml_metadata/metadata_store/BUILD` — Main Bazel BUILD file
- `setup.py` — Python package setup
- `pyproject.toml` — Python build requirements

### Proto Definitions
- `ml_metadata/proto/metadata_store.proto` — Core metadata types (1,312 LOC)
- `ml_metadata/proto/metadata_store_service.proto` — gRPC service (1,547 LOC)
- `ml_metadata/proto/metadata_source.proto` — Database source types (759 LOC)
