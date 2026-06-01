---
repository: "opendatahub-io/ml-metadata"
overall_score: 2.8
scorecard:
  - dimension: "Unit Tests"
    score: 6.0
    status: "Strong C++ unit tests via Google Test (27 test files, 20K lines), but tests only run via Bazel locally — not in CI"
  - dimension: "Integration/E2E"
    score: 1.0
    status: "No integration or E2E tests in CI; multi-DB test files exist (MySQL, PostgreSQL, SQLite) but are not exercised automatically"
  - dimension: "Build Integration"
    score: 2.0
    status: "PR workflow only builds Docker image — no test execution, no manifest validation, no Konflux simulation"
  - dimension: "Image Testing"
    score: 2.0
    status: "Docker image built on PR but no runtime validation, startup testing, or functional smoke tests"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage generation, no codecov/coveralls integration, no coverage thresholds or PR reporting"
  - dimension: "CI/CD Automation"
    score: 3.0
    status: "Minimal CI — only Docker image build on PR and push; no test execution, linting, or security scanning in workflows"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory — zero AI agent guidance for test creation"
critical_gaps:
  - title: "No tests execute in CI — zero automated quality gates"
    impact: "Regressions, bugs, and breaking changes merge without any automated verification; all quality relies on manual review"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No coverage tracking or enforcement"
    impact: "No visibility into which code paths are tested; coverage can silently regress to zero with no detection"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No security scanning (Trivy, CodeQL, SAST, dependency scanning)"
    impact: "Vulnerabilities in C++ dependencies, container base images, and Python packages go undetected until production"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No linting or static analysis in CI"
    impact: "Code quality standards are not enforced; inconsistencies and potential bugs slip through review"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No container image runtime validation"
    impact: "gRPC server startup failures, configuration errors, and port binding issues not caught until deployment"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "Extremely low development activity — 1 commit since 2024"
    impact: "Repository appears to be in maintenance-only mode; stale dependencies and unpatched vulnerabilities accumulate"
    severity: "HIGH"
    effort: "N/A"
quick_wins:
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Immediate visibility into CVEs in base images and dependencies"
  - title: "Add container startup smoke test to PR workflow"
    effort: "2-3 hours"
    impact: "Verify the gRPC server actually starts and responds to health checks before merge"
  - title: "Add CodeQL or Semgrep scanning workflow"
    effort: "1-2 hours"
    impact: "Catch C++ memory safety issues, injection vulnerabilities, and common bug patterns"
  - title: "Create basic CLAUDE.md with test guidance"
    effort: "1-2 hours"
    impact: "Enable AI agents to generate tests following project conventions (Google Test, absltest, proto-based fixtures)"
recommendations:
  priority_0:
    - "Add Bazel test execution to PR workflow — at minimum run SQLite-backed unit tests that don't require external databases"
    - "Integrate Trivy scanning for container images built on PR"
    - "Add coverage generation via Bazel --combined_report=lcov and upload to Codecov"
  priority_1:
    - "Add gRPC health check validation after image build in PR workflow"
    - "Add CodeQL or Semgrep SAST scanning for C++ and Python code"
    - "Create .claude/rules/ with unit test patterns for Google Test, Python absltest, and Go testing"
    - "Add pre-commit hooks for formatting and basic static analysis"
  priority_2:
    - "Add multi-database integration test workflow (MySQL, PostgreSQL) on periodic schedule"
    - "Add dependency update automation (Dependabot/Renovate) for Bazel deps and Python packages"
    - "Add SBOM generation and image signing in Tekton pipelines"
    - "Consider migrating from Bazel 5 to a newer version for improved build performance and security"
---

# Quality Analysis: ml-metadata (opendatahub-io/ml-metadata)

## Executive Summary

- **Overall Score: 2.8/10**
- **Repository Type**: C++/Python/Go library + gRPC server (Google ML Metadata fork)
- **Build System**: Bazel 5.3.0
- **Primary Languages**: C++ (27 source, 37 headers), Python (21 files), Go (1 file), Protobuf (5 files, 3.7K lines)
- **Key Strengths**: Comprehensive C++ unit test suite (27 test files, ~20K lines of test code); multi-database test coverage for SQLite, MySQL, and PostgreSQL; well-structured Bazel build; Tekton/Konflux integration for multi-arch builds
- **Critical Gaps**: **No tests run in CI at all** — the PR and push workflows only build the Docker image. No coverage tracking, no security scanning, no linting, no static analysis. The repository has had only 1 commit since January 2024.
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.0/10 | Strong test suite exists but never runs in CI |
| Integration/E2E | 1.0/10 | Multi-DB test files exist but are not automated |
| **Build Integration** | **2.0/10** | **PR builds Docker image only — no tests, no validation** |
| Image Testing | 2.0/10 | Image built but no runtime validation |
| Coverage Tracking | 0.0/10 | No coverage generation or reporting |
| CI/CD Automation | 3.0/10 | Minimal — image build only on PR and push |
| Agent Rules | 0.0/10 | No AI agent guidance exists |

## Critical Gaps

### 1. No Tests Execute in CI (Severity: HIGH)
- **Impact**: The repository has 27 C++ test files (~20K lines), 4 Python test files, and 1 Go test file — none of which run in any CI workflow. Regressions merge undetected.
- **Current State**: `.github/workflows/build-pr.yaml` only runs `build_docker_image.sh`. No `bazel test` step exists.
- **Effort**: 16-24 hours (Bazel test execution in GitHub Actions requires significant runner resources for C++ compilation)

### 2. No Coverage Tracking (Severity: HIGH)
- **Impact**: Zero visibility into test coverage. No baselines, no trend tracking, no PR blocking on coverage regression.
- **Current State**: No `.codecov.yml`, no `--combined_report=lcov` in Bazel config, no coverage upload step in any workflow.
- **Effort**: 4-8 hours

### 3. No Security Scanning (Severity: HIGH)
- **Impact**: The Dockerfile.redhat uses `registry.access.redhat.com/ubi9/ubi:latest` — vulnerabilities in base images, Bazel-fetched C++ dependencies (gRPC, protobuf, zetasql, boringssl), and Python packages go completely unscanned.
- **Current State**: No Trivy, Snyk, CodeQL, or any SAST/DAST tool configured.
- **Effort**: 4-6 hours

### 4. No Container Runtime Validation (Severity: HIGH)
- **Impact**: The gRPC server binary (`metadata_store_server`) is built and packaged but never tested for startup, port binding, or basic gRPC health check.
- **Effort**: 4-8 hours

### 5. Extremely Low Activity (Severity: HIGH)
- **Impact**: Only 1 commit since January 2024 (by a single contributor). Stale dependencies accumulate — Bazel 5.3.0 is outdated, gRPC 1.46.3 is from 2022, protobuf 3.21.12 is EOL.
- **Risk**: Known CVEs in pinned dependency versions likely remain unpatched.

## Quick Wins

### 1. Add Trivy Container Scanning (1-2 hours)
Add to `.github/workflows/build-pr.yaml` after the image build step:
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: quay.io/${{ env.QUAY_ORG }}/${{ env.MLMD_IMAGE_REPO }}:${{ steps.tags.outputs.tag }}
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
- name: Upload Trivy SARIF
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: 'trivy-results.sarif'
```

### 2. Add Container Startup Smoke Test (2-3 hours)
```yaml
- name: Smoke test gRPC server
  run: |
    docker run -d --name mlmd-test -p 8080:8080 \
      -e METADATA_STORE_SERVER_CONFIG_FILE="" \
      quay.io/${{ env.QUAY_ORG }}/${{ env.MLMD_IMAGE_REPO }}:${{ steps.tags.outputs.tag }}
    sleep 5
    # Verify container is still running (didn't crash on startup)
    docker ps | grep mlmd-test
    # Verify gRPC port is listening
    docker exec mlmd-test sh -c "ls /bin/metadata_store_server"
    docker stop mlmd-test
```

### 3. Add CodeQL Scanning (1-2 hours)
Create `.github/workflows/codeql.yml`:
```yaml
name: CodeQL Analysis
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
    permissions:
      security-events: write
    strategy:
      matrix:
        language: [python]
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

### 4. Create Basic CLAUDE.md (1-2 hours)
Provide AI agents with test patterns for the three test languages used:
- C++ tests: Google Test with `gtest/gtest.h`, `gmock/gmock.h`, SQLite in-memory backends
- Python tests: `absl.testing.absltest` with protobuf-based fixtures
- Go tests: standard `testing` package with `go-cmp` and proto comparison

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory:**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build-pr.yaml` | Pull Request | Build Docker image (no push) |
| `build-master.yaml` | Push to master | Build + push Docker image to Quay |

**Tekton Pipelines:**

| Pipeline | Trigger | Purpose |
|----------|---------|---------|
| `odh-mlmd-grpc-server-pull-request.yaml` | PR to master | Konflux multi-arch container build |
| `odh-mlmd-grpc-server-push.yaml` | Push to master | Konflux multi-arch container build (stable tag) |

**Assessment:**
- **Concurrency control**: Present (`cancel-in-progress: true`) - good
- **Path ignore**: Configured to skip docs/license changes - good
- **Caching**: None — Bazel builds run from scratch every time
- **Test execution**: None in any workflow
- **Linting**: None
- **Security scanning**: None
- **Artifact publishing**: Docker images pushed to `quay.io/opendatahub/mlmd-grpc-server` on master push

The Tekton pipelines reference `odh-konflux-central` for multi-arch builds with substantial resources (16 CPU, 32GB memory), suggesting the build is compute-intensive. There's an 8-hour timeout, which is extremely long and may indicate build reliability issues.

### Test Coverage

**C++ Tests (Google Test framework):**
- 27 test files, ~20,600 lines of test code
- Test-to-source ratio: ~0.94:1 (excellent for the C++ code)
- Coverage areas: metadata store CRUD, metadata access objects, query executors, SQL backends (SQLite, MySQL, PostgreSQL), field mask utilities, record parsing, struct utilities, simple types, query builder/resolver
- Uses `gtest`, `gmock`, in-memory SQLite for fast unit tests
- Has parameterized tests and test fixtures

**Python Tests (absltest framework):**
- 4 test files: `metadata_store_test.py`, `mlmd_types_test.py`, `types_test.py`, `metadata_resolver_test.py`
- ~3,200 lines of Python test code
- Tests metadata store operations, type system, and metadata resolution
- Uses `absl.testing.absltest` and `parameterized`

**Go Tests:**
- 1 test file: `metadata_store_test.go` (1,559 lines)
- Tests Go SWIG bindings against a fake database backend
- Uses `go-cmp` and `protocmp` for proto comparison

**Key Finding**: The test suite is comprehensive for a library of this size. The C++ tests thoroughly exercise all database backends and query configurations. However, **none of these tests run in CI** — they only run locally via `bazel test`.

### Code Quality

- **Linting**: No linting configuration found (no `.clang-format`, `.clang-tidy`, `ruff.toml`, `.flake8`, `.golangci.yaml`)
- **Pre-commit hooks**: None (no `.pre-commit-config.yaml`)
- **Static analysis**: None configured
- **Code formatting**: No automated formatting enforcement
- **Bazel config**: `.bazelrc` exists with C++17 settings and platform-specific configurations

### Container Images

**Dockerfiles Found:**

| File | Base Image | Purpose |
|------|-----------|---------|
| `Dockerfile.redhat` | `ubi9/ubi:latest` → `ubi9/ubi-minimal:latest` | Production gRPC server (used in CI) |
| `Dockerfile` | `ubuntu:20.04` | Upstream/community gRPC server |
| `Dockerfile.fedora` | `fedora:38` | Fedora variant |
| `Dockerfile.manylinux2010` | `gcr.io/tfx-oss-public/manylinux2014-bazel` | Python wheel building |
| `Dockerfile` (dev_debug) | `ubuntu:20.04` | Development debugging |

**Assessment:**
- Multi-stage builds: Used correctly — build in UBI9, runtime in UBI9-minimal (good)
- Non-root user: `USER 65534:65534` in Dockerfile.redhat (good)
- Base image pinning: Uses `latest` tag — no digest pinning (risky)
- Multi-architecture: Tekton pipeline uses `multi-arch-container-build.yaml` (good)
- SBOM generation: None
- Image signing/attestation: None
- Vulnerability scanning: None
- Runtime testing: None
- Health check endpoint: Not configured in Dockerfile

### Security

- **Container scanning**: None
- **SAST**: None
- **Dependency scanning**: None — Bazel WORKSPACE pins specific commits but no automated vulnerability checking
- **Secret detection**: None
- **Stale dependencies**: gRPC 1.46.3 (June 2022), protobuf 3.21.12 (Dec 2022), ZetaSQL from 2022, SQLite 3.39.2 (2022) — all are 3+ years old with known CVEs likely present
- **Base image**: UBI9 latest (rolling) for production Dockerfile — should be pinned by digest

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **Coverage**: Zero test types have rules
- **Quality**: N/A
- **Gaps**: Complete absence — no guidance for unit tests, integration tests, E2E tests, or any test patterns
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - C++ Google Test patterns with SQLite in-memory backends
  - Python absltest patterns with protobuf fixtures
  - Go testing patterns with fake database backends
  - Bazel BUILD file patterns for test targets

## Recommendations

### Priority 0 (Critical)

1. **Add Bazel test execution to PR workflow**
   - At minimum, run SQLite-backed unit tests that don't require external databases
   - Use Bazel remote caching to reduce build times
   - Consider running a subset of fast tests on PR and full suite on periodic schedule

2. **Add container vulnerability scanning**
   - Trivy scanning on built images in PR workflow
   - Block merge on CRITICAL/HIGH severity findings
   - Upload results as SARIF to GitHub Security tab

3. **Add coverage generation and tracking**
   - Use `bazel coverage --combined_report=lcov` for C++ coverage
   - Upload to Codecov with PR commenting enabled
   - Set initial threshold at current coverage level

### Priority 1 (High Value)

4. **Add gRPC server startup validation**
   - Build image, start container, verify health via gRPC reflection or custom health check
   - Test with SQLite backend (no external DB needed)
   - Verify clean shutdown

5. **Add SAST scanning (CodeQL or Semgrep)**
   - Python analysis is lightweight and easy to add
   - C++ CodeQL analysis is more resource-intensive but valuable given the manual memory management

6. **Create agent rules (.claude/rules/)**
   - Unit test rules for all three languages
   - Test fixture patterns for each database backend
   - Bazel BUILD target patterns for `cc_test`, `py_test`, `go_test`

7. **Pin container base images by digest**
   - Replace `ubi9/ubi:latest` with digest-pinned versions
   - Use Renovate/Dependabot for automated base image updates

### Priority 2 (Nice-to-Have)

8. **Add multi-database integration tests**
   - Run MySQL and PostgreSQL-backed tests on a periodic schedule
   - Use Docker Compose or service containers in GitHub Actions

9. **Add dependency update automation**
   - Configure Dependabot or Renovate for Python packages
   - Consider Bazel dependency update tooling for WORKSPACE deps

10. **Modernize build toolchain**
    - Upgrade from Bazel 5.3.0 to Bazel 7.x
    - Update gRPC, protobuf, and other pinned dependencies
    - Address the commented-out ZetaSQL version switching hack

11. **Add SBOM generation**
    - Generate SBOMs during Tekton/Konflux builds
    - Integrate with Red Hat supply chain security tooling

## Comparison to Gold Standards

| Dimension | ml-metadata | odh-dashboard | notebooks | kserve |
|-----------|-------------|---------------|-----------|--------|
| Unit Tests | 6/10 (exist, not in CI) | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 1/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 2/10 | 8/10 | 7/10 | 8/10 |
| Image Testing | 2/10 | 7/10 | 9/10 | 7/10 |
| Coverage Tracking | 0/10 | 8/10 | 5/10 | 9/10 |
| CI/CD Automation | 3/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 0/10 | 8/10 | 3/10 | 2/10 |
| **Overall** | **2.8/10** | **8.5/10** | **7.0/10** | **8.0/10** |

**Key Takeaway**: ml-metadata is an extreme outlier among ODH repositories. It has a reasonable test suite that was inherited from the upstream Google project, but the ODH fork has made no investment in CI automation. The gap between "tests exist" and "tests run in CI" represents the single largest quality risk.

## File Paths Reference

### CI/CD
- `.github/workflows/build-pr.yaml` — PR image build workflow
- `.github/workflows/build-master.yaml` — Master push + image publish workflow
- `.github/actions/build/action.yaml` — Composite action for Docker build
- `.tekton/odh-mlmd-grpc-server-pull-request.yaml` — Konflux PR pipeline
- `.tekton/odh-mlmd-grpc-server-push.yaml` — Konflux push pipeline

### Build
- `WORKSPACE` — Bazel workspace with all external dependencies
- `.bazelrc` — Bazel configuration (C++17, platform settings)
- `ml_metadata/ml_metadata.bzl` — Custom Bazel macros
- `ml_metadata/tools/docker_server/build_docker_image.sh` — Docker build script
- `ml_metadata/tools/docker_server/Dockerfile.redhat` — Production Dockerfile (UBI9)

### Testing
- `ml_metadata/metadata_store/*_test.cc` — 27 C++ test files (Google Test)
- `ml_metadata/metadata_store/metadata_store_test.py` — Python metadata store tests
- `ml_metadata/metadata_store/mlmd_types_test.py` — Python types tests
- `ml_metadata/metadata_store/metadata_store_test.go` — Go bindings tests
- `ml_metadata/query/*_test.cc` — Query builder/resolver tests
- `ml_metadata/util/*_test.cc` — Utility function tests

### Container Images
- `ml_metadata/tools/docker_server/Dockerfile.redhat` — Production (UBI9)
- `ml_metadata/tools/docker_server/Dockerfile` — Community (Ubuntu)
- `ml_metadata/tools/docker_server/Dockerfile.fedora` — Fedora variant
- `ml_metadata/tools/docker_build/Dockerfile.manylinux2010` — Python wheel builder

### Protobuf
- `ml_metadata/proto/metadata_store.proto` — Core metadata store definitions
- `ml_metadata/proto/metadata_store_service.proto` — gRPC service definitions
- `ml_metadata/proto/metadata_source.proto` — Database source definitions
