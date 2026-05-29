---
repository: "red-hat-data-services/ml-metadata"
overall_score: 3.3
scorecard:
  - dimension: "Unit Tests"
    score: 6.0
    status: "Extensive C++ unit test suite using GoogleTest via Bazel, but tests are not executed in CI"
  - dimension: "Integration/E2E"
    score: 2.0
    status: "Manual-only MySQL/PostgreSQL integration tests, no automated E2E testing"
  - dimension: "Build Integration"
    score: 3.0
    status: "PR workflow builds Docker image but no runtime validation, no Konflux simulation in GHA"
  - dimension: "Image Testing"
    score: 2.0
    status: "Image build only, no startup validation, no vulnerability scanning, no SBOM"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage generation, no codecov integration, no enforcement"
  - dimension: "CI/CD Automation"
    score: 4.0
    status: "Minimal workflows (PR build + master push), no test execution, no linting in CI"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules or test guidance"
critical_gaps:
  - title: "No tests execute in CI — PR or push"
    impact: "Regressions can merge freely; the extensive C++ test suite provides zero protection in practice"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No coverage tracking or enforcement"
    impact: "No visibility into test coverage trends; no gate to prevent coverage regression"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No security scanning (SAST, container, dependency)"
    impact: "Vulnerabilities in Bazel dependencies or container base images go undetected"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container image runtime validation"
    impact: "Image builds may produce non-functional containers; startup failures discovered only in deployment"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No linting or static analysis in CI"
    impact: "Code quality issues are not caught before merge"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents have no guidance on testing standards, patterns, or quality gates"
    severity: "LOW"
    effort: "2-3 hours"
quick_wins:
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Immediate detection of known vulnerabilities in base images and dependencies"
  - title: "Add image startup validation after PR build"
    effort: "2-3 hours"
    impact: "Catches non-functional images before merge"
  - title: "Add basic linting step (clang-tidy or cppcheck)"
    effort: "2-4 hours"
    impact: "Catches common C++ code quality issues automatically"
  - title: "Create CLAUDE.md with testing guidance"
    effort: "1-2 hours"
    impact: "Enables AI agents to follow project testing conventions"
recommendations:
  priority_0:
    - "Add Bazel test execution to PR workflow — run sqlite-backed unit tests that don't require external databases"
    - "Add container vulnerability scanning (Trivy) to PR and push workflows"
    - "Add image startup smoke test after Docker build in PR workflow"
  priority_1:
    - "Integrate codecov or similar coverage tracking with Bazel test coverage"
    - "Add CodeQL or gosec/cppcheck for static analysis"
    - "Create automated integration test workflow with Docker Compose for MySQL/PostgreSQL backends"
  priority_2:
    - "Create agent rules (.claude/rules/) for test patterns and quality standards"
    - "Add SBOM generation and image signing to push workflow"
    - "Add multi-architecture build support beyond amd64"
---

# Quality Analysis: ml-metadata (opendatahub-io/ml-metadata)

## Executive Summary

- **Overall Score: 3.3/10**
- **Repository Type**: C++/Python library — ML Metadata gRPC server (Google upstream fork)
- **Primary Languages**: C++ (core), Python (bindings/tests), Go (minimal bindings)
- **Build System**: Bazel (source build), Docker (container packaging)
- **Key Strengths**: Extensive C++ unit test suite with GoogleTest; multi-database backend testing (SQLite, MySQL, PostgreSQL); well-structured Bazel build; Tekton/Konflux pipeline integration for Konflux builds
- **Critical Gaps**: Tests do not run in CI; zero coverage tracking; no security scanning; no linting; no agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, no .claude/ directory

This is a **forked upstream Google project** (google/ml-metadata) with minimal Red Hat/ODH-specific CI/CD additions. The repository has only 1 commit visible in the shallow clone and a single branch (`master`). The CI/CD setup is extremely minimal — only two GitHub Actions workflows that build a Docker image but run no tests.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.0/10 | Extensive C++ test suite exists but never runs in CI |
| Integration/E2E | 2.0/10 | Manual-only MySQL/PostgreSQL tests, no automated E2E |
| **Build Integration** | **3.0/10** | **PR builds Docker image only, no runtime validation** |
| Image Testing | 2.0/10 | Image build-only, no scanning, no startup validation |
| Coverage Tracking | 0.0/10 | No coverage generation, no reporting, no enforcement |
| CI/CD Automation | 4.0/10 | Minimal 2-workflow setup (build PR + push master) |
| Agent Rules | 0.0/10 | No agent rules, no AI test guidance |

## Critical Gaps

### 1. No Tests Execute in CI (Severity: HIGH)

**Impact**: The repository has **27 C++ test files** (~18,793 lines), **4 Python test files** (~4,133 lines), and **1 Go test file**, but **none of them run in any CI workflow**. Both GitHub Actions workflows (`build-pr.yaml`, `build-master.yaml`) only build the Docker image. The extensive test suite provides zero regression protection.

**Details**:
- `build-pr.yaml`: Triggered on PR, runs `build_docker_image.sh` only
- `build-master.yaml`: Triggered on push to master, builds and pushes to Quay.io
- Bazel test targets exist in BUILD files but are never invoked
- SQLite-backed tests (`ml_metadata_cc_test` macro) could run without external services
- MySQL/PostgreSQL tests are tagged `manual` and `local` — require external servers

**Effort**: 16-24 hours (need Bazel setup in CI, cache optimization, test selection)

### 2. No Coverage Tracking (Severity: HIGH)

**Impact**: No visibility into what the tests actually cover. No codecov, coveralls, or any coverage tool integration. No coverage thresholds or enforcement. Coverage regression is invisible.

**Effort**: 4-8 hours (Bazel has `--combined_report=lcov` support)

### 3. No Security Scanning (Severity: HIGH)

**Impact**: No Trivy, Snyk, or any container scanning. No CodeQL or SAST tools. No dependency scanning. No secret detection. The Dockerfile uses `registry.access.redhat.com/ubi9/ubi:latest` and `ubi9/ubi-minimal:latest` — known good bases, but no scanning validates runtime dependencies.

**Effort**: 4-6 hours

### 4. No Container Runtime Validation (Severity: HIGH)

**Impact**: The PR workflow builds the image but never starts it. A broken `ENTRYPOINT`, missing library, or runtime error would not be caught until deployment.

**Effort**: 4-6 hours

### 5. No Linting or Static Analysis (Severity: MEDIUM)

**Impact**: No `.golangci.yaml`, no `clang-tidy`, no `cppcheck`, no Python linters configured. No pre-commit hooks (`.pre-commit-config.yaml` is absent). Code quality depends entirely on code review.

**Effort**: 2-4 hours

### 6. No Agent Rules (Severity: LOW)

**Impact**: No `CLAUDE.md`, no `.claude/` directory, no `.claude/rules/` for test creation. AI agents have no guidance on testing standards.

**Effort**: 2-3 hours

## Quick Wins

### 1. Add Trivy Scanning to PR Workflow (1-2 hours)

Add a step after the Docker build in `build-pr.yaml`:

```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'quay.io/${{ env.QUAY_ORG }}/${{ env.MLMD_IMAGE_REPO }}:${{ steps.tags.outputs.tag }}'
    format: 'table'
    exit-code: '1'
    severity: 'CRITICAL,HIGH'
```

### 2. Add Image Startup Smoke Test (2-3 hours)

After building the image, verify it starts correctly:

```yaml
- name: Smoke test container
  run: |
    docker run -d --name mlmd-test \
      -e GRPC_PORT=8080 \
      -e METADATA_STORE_SERVER_CONFIG_FILE="" \
      quay.io/${{ env.QUAY_ORG }}/${{ env.MLMD_IMAGE_REPO }}:${{ steps.tags.outputs.tag }}
    sleep 5
    docker logs mlmd-test
    # Verify container is running (not crashed)
    docker inspect mlmd-test --format='{{.State.Running}}' | grep true
    docker stop mlmd-test
```

### 3. Create CLAUDE.md (1-2 hours)

Add basic AI agent guidance with test patterns and build instructions.

### 4. Add Clang-Tidy to PR Workflow (2-4 hours)

Enable static analysis with minimal configuration.

## Detailed Findings

### CI/CD Pipeline

**Workflows Found**: 2 GitHub Actions workflows + 1 composite action + 2 Tekton pipelines

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build-pr.yaml` | PR (paths-ignore docs) | Build Docker image only |
| `build-master.yaml` | Push to master | Build + push to Quay.io |
| `build/action.yaml` | Composite action | Shared build logic |
| Tekton PR | PipelinesAsCode (PR to master) | Konflux multi-arch build |
| Tekton Push | PipelinesAsCode (push to master) | Konflux multi-arch build |

**Positive**:
- Concurrency control: Both GHA workflows use `cancel-in-progress: true`
- Path-ignore: PR workflow skips builds for docs-only changes
- Shared build action: Composite action avoids duplication
- Tekton/Konflux: Multi-arch container build pipeline with centralized pipeline reference (`odh-konflux-central`)
- Resource allocation: Tekton tasks request 8 CPU / 16GB RAM for builds

**Negative**:
- No test execution in any workflow
- No linting step
- No security scanning step
- No coverage reporting
- No caching for Bazel builds (could save significant time)
- Only 2 workflows total — no periodic, nightly, or scheduled jobs
- Tekton cancel-in-progress is `false` — concurrent PR builds accumulate

### Test Coverage

**C++ Tests (GoogleTest via Bazel)**:
- 27 test source files (`*_test.cc`)
- ~18,793 lines of test code
- Test suite headers for reuse (`*_test_suite.h`)
- Well-structured test hierarchy: metadata_source → metadata_access_object → metadata_store
- Database-specific tests: SQLite (automated), MySQL (manual), PostgreSQL (manual)

**Python Tests**:
- 4 test files: `metadata_store_test.py`, `mlmd_types_test.py`, `types_test.py`, `metadata_resolver_test.py`
- ~4,133 lines of Python test code
- Tests likely exercise the Python bindings over the C++ library

**Go Tests**:
- 1 test file: `metadata_store_test.go`
- Tests the Go bindings

**Test-to-Code Ratio**:
- C++ tests: 18,793 lines / 22,012 source lines = **0.85** (good ratio)
- Python tests: 4,133 lines / 5,373 source lines = **0.77** (good ratio)
- Overall: **0.84** — healthy test volume, but tests are never executed in CI

**Coverage**: None. No `--coverage` flags, no codecov integration, no coverage files generated.

### Code Quality

- **Linting**: None configured. No `.clang-tidy`, no `clang-format`, no Python linters
- **Pre-commit hooks**: None (no `.pre-commit-config.yaml`)
- **Static analysis**: None (no CodeQL, no gosec, no cppcheck)
- **Code formatting**: No automated formatting enforcement
- **Build system**: Bazel with well-defined BUILD files and custom macros (`ml_metadata_cc_test`)

### Container Images

**Dockerfiles Found**: 5 total
- `Dockerfile` (upstream, Ubuntu 20.04 builder)
- `Dockerfile.redhat` (Red Hat, UBI9 builder — **production Dockerfile**)
- `Dockerfile.fedora` (Fedora-based)
- `Dockerfile.manylinux2010` (Python wheel builds)
- `Dockerfile` (dev_debug)

**Dockerfile.redhat Analysis**:
- Multi-stage build: UBI9 builder → UBI9-minimal runtime
- Installs Bazel 5 from COPR repo for building
- Patches ZetaSQL for UBI9 compatibility
- Runs as non-root user (65534:65534) — good security practice
- Minimal runtime image with only `tzdata`
- No HEALTHCHECK instruction
- No vulnerability scanning
- No SBOM generation

**docker-compose.yml**: Used for building Python wheels for different Python versions (3.9, 3.10, 3.11)

### Security

- **Container scanning**: None
- **SAST/CodeQL**: None
- **Dependency scanning**: None (Bazel deps pinned by SHA256 in WORKSPACE — good)
- **Secret detection**: None
- **Image signing**: None
- **SBOM**: None

**Positive**: Bazel dependencies are pinned by SHA256 hash in `WORKSPACE`, providing supply chain integrity for the build. Container runs as non-root.

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No rules for any test type
- **Quality**: N/A
- **Gaps**: No CLAUDE.md, no .claude/ directory, no agent rules whatsoever
- **Recommendation**: Generate rules with `/test-rules-generator` covering:
  - C++ GoogleTest patterns for metadata store tests
  - Bazel test target creation
  - Python test patterns for bindings
  - Docker image validation tests

## Recommendations

### Priority 0 (Critical)

1. **Run SQLite-backed unit tests in PR workflow**
   - Add Bazel setup and test execution step
   - Start with `sqlite_*_test` targets that don't need external databases
   - Cache Bazel build artifacts between runs

2. **Add container vulnerability scanning**
   - Add Trivy or Snyk to PR and push workflows
   - Set severity thresholds (fail on CRITICAL/HIGH)

3. **Add image startup smoke test**
   - Start the built image after PR build
   - Verify the gRPC server starts and listens on the configured port

### Priority 1 (High Value)

4. **Add coverage tracking with Bazel**
   - Use `bazel coverage` with `--combined_report=lcov`
   - Integrate with codecov for PR reporting
   - Set initial threshold based on current coverage

5. **Add static analysis**
   - CodeQL for C++ vulnerability scanning
   - Clang-tidy for code quality
   - Python linting (ruff or flake8)

6. **Automate MySQL/PostgreSQL integration tests**
   - Use docker-compose in CI to spawn database containers
   - Run the manual-tagged tests against real databases
   - Schedule as periodic (nightly) job if too slow for PRs

### Priority 2 (Nice-to-Have)

7. **Create agent rules**
   - Add `.claude/rules/` with test creation guidance
   - Document GoogleTest patterns specific to this codebase
   - Include Bazel BUILD file conventions

8. **Add SBOM generation and image signing**
   - Add Cosign signing to push workflow
   - Generate SBOM with Syft or similar tool

9. **Add multi-architecture builds to GHA**
   - Currently only Tekton/Konflux does multi-arch
   - Add buildx for cross-platform validation in GHA

10. **Add Bazel build caching**
    - Cache `~/.cache/bazel` between CI runs
    - Could reduce 8h Tekton timeout significantly

## Comparison to Gold Standards

| Dimension | ml-metadata | odh-dashboard | notebooks | kserve |
|-----------|:-----------:|:-------------:|:---------:|:------:|
| Unit Tests in CI | ❌ | ✅ | ✅ | ✅ |
| Integration Tests | Manual only | ✅ Automated | ✅ | ✅ |
| E2E Tests | ❌ | ✅ Cypress | ✅ | ✅ |
| Coverage Tracking | ❌ | ✅ Codecov | Partial | ✅ |
| Container Scanning | ❌ | ✅ Trivy | ✅ | ✅ |
| Image Smoke Tests | ❌ | ✅ | ✅ 5-layer | ✅ |
| SAST/CodeQL | ❌ | ✅ | Partial | ✅ |
| Pre-commit Hooks | ❌ | ✅ | Partial | ✅ |
| Agent Rules | ❌ | ✅ Comprehensive | ❌ | ❌ |
| Concurrency Control | ✅ | ✅ | ✅ | ✅ |
| Multi-arch Builds | ✅ (Tekton) | ✅ | ✅ | ✅ |
| Non-root Container | ✅ | ✅ | ✅ | ✅ |
| Pinned Dependencies | ✅ (Bazel SHA) | ✅ | ✅ | ✅ |

## File Paths Reference

### CI/CD
- `.github/workflows/build-pr.yaml` — PR container build
- `.github/workflows/build-master.yaml` — Master push and Quay.io publish
- `.github/actions/build/action.yaml` — Shared build composite action
- `.tekton/odh-mlmd-grpc-server-pull-request.yaml` — Konflux PR pipeline
- `.tekton/odh-mlmd-grpc-server-push.yaml` — Konflux push pipeline

### Build
- `WORKSPACE` — Bazel dependency definitions (all SHA-pinned)
- `.bazelrc` — Bazel build configuration
- `ml_metadata/ml_metadata.bzl` — Custom Bazel macros
- `ml_metadata/metadata_store/BUILD` — Main BUILD file with test targets
- `setup.py` — Python package setup

### Container
- `ml_metadata/tools/docker_server/Dockerfile.redhat` — Production Dockerfile (UBI9)
- `ml_metadata/tools/docker_server/Dockerfile` — Upstream Dockerfile (Ubuntu)
- `ml_metadata/tools/docker_server/Dockerfile.fedora` — Fedora Dockerfile
- `ml_metadata/tools/docker_server/build_docker_image.sh` — Build script
- `docker-compose.yml` — Python wheel build environments
- `.dockerignore` — Docker ignore (only excludes .git)

### Tests
- `ml_metadata/metadata_store/*_test.cc` — 27 C++ test files
- `ml_metadata/metadata_store/*_test.py` — Python binding tests
- `ml_metadata/metadata_store/metadata_store_test.go` — Go binding test
- `ml_metadata/tools/mlmd_resolver/metadata_resolver_test.py` — Resolver test
- `ml_metadata/util/*_test.cc` — Utility test files
- `ml_metadata/query/*_test.cc` — Query module tests

### Proto
- `ml_metadata/proto/metadata_store.proto` — Core protobuf definitions
- `ml_metadata/proto/metadata_store_service.proto` — gRPC service definition
- `ml_metadata/proto/metadata_source.proto` — Metadata source protocol
- `ml_metadata/proto/testing/mock.proto` — Test mock protobuf
