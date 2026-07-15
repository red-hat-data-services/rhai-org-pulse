---
repository: "red-hat-data-services/ml-metadata"
overall_score: 3.4
scorecard:
  - dimension: "Unit Tests"
    score: 6.0
    status: "Extensive C++ unit tests via Bazel/GoogleTest and Python tests, but not executed in CI"
  - dimension: "Integration/E2E"
    score: 2.0
    status: "No integration or E2E tests in CI; multi-DB test files exist but no automated execution"
  - dimension: "Build Integration"
    score: 3.0
    status: "PR workflow builds Docker image only; no test execution, no Konflux simulation at PR time"
  - dimension: "Image Testing"
    score: 2.0
    status: "Multi-stage Docker build exists but no runtime validation, startup testing, or health checks"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tracking, no codecov/coveralls, no coverage thresholds or PR reporting"
  - dimension: "CI/CD Automation"
    score: 4.0
    status: "Minimal CI: image build only on PR and master push; no test execution, linting, or security scanning"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules or test automation guidance"
critical_gaps:
  - title: "No tests executed in CI"
    impact: "Code regressions can merge undetected; the 35 existing test files are never validated in PRs"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No coverage tracking whatsoever"
    impact: "No visibility into test coverage; coverage can degrade silently over time"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No security scanning (Trivy, CodeQL, SAST)"
    impact: "Vulnerabilities in C++ code, Python deps, and container images go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No linting or static analysis in CI"
    impact: "Code quality issues, style inconsistencies, and potential bugs not caught before merge"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No container runtime validation"
    impact: "Image startup failures, misconfigured entrypoints, or missing dependencies caught only in production"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI-generated code lacks repo-specific patterns and test standards guidance"
    severity: "LOW"
    effort: "2-4 hours"
quick_wins:
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Immediate detection of CVEs in base images and dependencies"
  - title: "Add bazel test step to PR workflow"
    effort: "2-4 hours"
    impact: "Activate the 35 existing test files that currently never run in CI"
  - title: "Add Renovate/Dependabot for Go/Python dependency updates"
    effort: "1 hour"
    impact: "Renovate already configured for Konflux; extend to cover Go and Python deps"
  - title: "Add basic CLAUDE.md with test creation guidance"
    effort: "1-2 hours"
    impact: "Improve AI-assisted development quality with repo-specific patterns"
recommendations:
  priority_0:
    - "Execute bazel test targets in PR CI workflow to validate C++ and Go tests before merge"
    - "Add Python test execution (pytest or bazel py_test) in PR CI workflow"
    - "Integrate coverage reporting (gcov/lcov for C++, coverage.py for Python) with minimum thresholds"
    - "Add container security scanning (Trivy) to PR and master workflows"
  priority_1:
    - "Add gRPC server smoke test after image build (start container, verify gRPC health endpoint)"
    - "Set up static analysis: clang-tidy for C++, pylint/ruff for Python"
    - "Add CodeQL or similar SAST for C++ vulnerability detection"
    - "Create comprehensive agent rules (.claude/rules/) for test automation"
  priority_2:
    - "Add multi-database integration testing (MySQL, PostgreSQL, SQLite) in CI"
    - "Implement pre-commit hooks for formatting and linting"
    - "Add SBOM generation for container images"
    - "Add performance regression testing for metadata store operations"
---

# Quality Analysis: ml-metadata (red-hat-data-services)

## Executive Summary

- **Overall Score: 3.4/10**
- **Repository Type**: ML infrastructure library / gRPC metadata store server (C++, Python, Go bindings)
- **Build System**: Bazel 5.x
- **Key Strengths**: Extensive upstream unit test suite (35 test files, ~25,000 lines of test code across C++/Python/Go); multi-stage Docker builds with Red Hat UBI9 base; multi-architecture Konflux pipeline (x86_64, ARM64, ppc64le); well-structured Bazel build system with GoogleTest framework
- **Critical Gaps**: No tests run in CI at all; no coverage tracking; no security scanning; no linting; no container runtime validation
- **Agent Rules Status**: Missing - No CLAUDE.md, no .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.0/10 | Extensive test files exist but are never executed in CI |
| Integration/E2E | 2.0/10 | Multi-DB test files exist but no automated execution |
| **Build Integration** | **3.0/10** | **PR builds Docker image only; no test execution or Konflux sim** |
| Image Testing | 2.0/10 | Multi-stage builds exist but no runtime validation |
| Coverage Tracking | 0.0/10 | No coverage tracking of any kind |
| CI/CD Automation | 4.0/10 | Minimal: image build on PR/push only |
| Agent Rules | 0.0/10 | No agent rules or test automation guidance |

## Critical Gaps

### 1. No Tests Executed in CI
- **Impact**: Code regressions can merge undetected. The repository contains 35 test files with ~25,000 lines of test code (C++, Python, Go) that are never validated during PRs.
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Details**: The PR workflow (`build-pr.yaml`) only builds a Docker image. There is no `bazel test` step, no `pytest` execution, no Go test runner. All 26+ Bazel `cc_test` targets, 3+ `py_test` targets, and Go tests sit idle.

### 2. No Coverage Tracking
- **Impact**: No visibility into whether new code is tested. Coverage can degrade silently.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No `.codecov.yml`, no coverage generation flags in `.bazelrc`, no coverage CI step, no PR coverage reporting. Bazel supports `--collect_code_coverage` and `--combined_report=lcov` natively.

### 3. No Security Scanning
- **Impact**: Vulnerabilities in C++ code, third-party Bazel dependencies, Python packages, and container images go completely undetected.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Trivy, Snyk, CodeQL, gosec, Semgrep, or any SAST/DAST tool configured. The Dockerfiles pull from `registry.access.redhat.com/ubi9` which has its own CVE surface. No `.trivyignore` or `.gitleaks.toml`.

### 4. No Linting or Static Analysis
- **Impact**: Code quality issues, undefined behavior in C++, Python anti-patterns, and style inconsistencies not caught before merge.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: No `.golangci.yaml`, no `.eslintrc`, no `ruff.toml`, no `clang-tidy`, no `.pre-commit-config.yaml`. The only code quality signal is whether the Docker image builds successfully.

### 5. No Container Runtime Validation
- **Impact**: Image startup failures, gRPC server crashes, or configuration issues only discovered at deployment time.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: The PR workflow builds the image but never runs it. No health check, no gRPC endpoint verification, no container startup test. The `metadata_store_server` binary could fail at runtime and the CI would pass.

## Quick Wins

### 1. Add Trivy Container Scanning to PR Workflow
- **Effort**: 1-2 hours
- **Impact**: Immediate CVE detection in UBI9 base images and installed packages
- **Implementation**:
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'quay.io/${{ env.QUAY_ORG }}/${{ env.MLMD_IMAGE_REPO }}:${{ steps.tags.outputs.tag }}'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
```

### 2. Add Bazel Test Step to PR Workflow
- **Effort**: 2-4 hours (Bazel install + test step)
- **Impact**: Activate 35 existing test files covering metadata store, query engine, utilities
- **Implementation**:
```yaml
- name: Run Bazel tests
  run: |
    bazel test --test_output=errors \
      //ml_metadata/metadata_store:... \
      //ml_metadata/util:... \
      //ml_metadata/query:...
```

### 3. Extend Renovate for Python/Go Dependencies
- **Effort**: 1 hour
- **Impact**: Automated dependency updates beyond Konflux configs
- **Details**: `renovate.json` already exists and extends `konflux-central` defaults. Add Python (`pyproject.toml`, `test_constraints.txt`) and Go (`go.mod`) managers.

### 4. Add Basic CLAUDE.md
- **Effort**: 1-2 hours
- **Impact**: Guide AI-assisted development with repo-specific Bazel patterns, test frameworks, and code conventions

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory:**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build-pr.yaml` | Pull Request | Build Docker image (no push, no tests) |
| `build-master.yaml` | Push to master | Build + push Docker image to Quay.io |

**What's Missing:**
- No test execution workflow
- No lint/format check workflow
- No security scanning workflow
- No coverage reporting workflow
- No release/tag workflow
- No periodic test execution

**Positive:**
- Concurrency control configured (`cancel-in-progress: true`)
- Reusable composite action (`.github/actions/build/action.yaml`)
- Path-based triggering to skip unnecessary builds

**Konflux/Tekton:**
- Well-configured multi-arch pipeline (`x86_64`, `ARM64`, `ppc64le`)
- Managed centrally via `konflux-central` repository
- Source image build enabled
- PR and label-triggered builds
- 4-hour timeout for complex Bazel builds

### Test Coverage

**Test File Inventory:**

| Category | Files | Lines | Framework |
|----------|-------|-------|-----------|
| C++ unit tests | 27 | ~19,700 | GoogleTest (gtest) |
| Python tests | 4 | ~4,100 | Python unittest (via Bazel) |
| Go tests | 1 | ~1,560 | Go testing + protocmp |
| C++ test headers | 3 | ~1,500 | GoogleTest fixtures |
| **Total** | **35** | **~26,860** | |

**Test-to-Code Ratio**: C++ test files (27) vs source files (31) = 0.87 ratio (good for C++)

**Test Coverage by Module:**

| Module | Test Files | Status |
|--------|-----------|--------|
| `metadata_store/` | 24 CC, 3 PY, 1 GO | Core logic well-covered with tests |
| `util/` | 4 CC | Utility functions have dedicated tests |
| `query/` | 2 CC | Query builder and AST resolver tested |
| `tools/mlmd_resolver/` | 1 PY | Resolver utility tested |
| `proto/` | 0 | No proto-level tests (acceptable for generated code) |
| `simple_types/` | 0 | No tests for simple types module |

**Database-Specific Tests:**
- SQLite tests: `sqlite_metadata_source_test.cc`, `sqlite_query_config_executor_test.cc`, `sqlite_metadata_access_object_test.cc`, `sqlite_rdbms_metadata_access_object_test.cc`
- MySQL tests: `mysql_metadata_source_test.cc`, `mysql_query_config_executor_test.cc`, `mysql_metadata_access_object_test.cc`
- PostgreSQL tests: `postgresql_metadata_source_test.cc`, `postgresql_query_executor_test.cc`, `postgresql_metadata_access_object_test.cc`

**Key Gap**: Despite this extensive test suite, **none of these tests run in any CI workflow**.

### Code Quality

**Linting & Static Analysis**: None configured
- No clang-tidy for C++
- No pylint/ruff/flake8 for Python
- No golangci-lint for Go
- No pre-commit hooks

**Build Configuration**:
- `.bazelrc` enforces C++17 standard
- Proto3 optional fields enabled
- Bazel version pinned via `.bazelversion`
- Build reproducibility via Bazel hermetic builds

**Code Organization**:
- Clean separation: `metadata_store/`, `proto/`, `query/`, `util/`, `tools/`
- Proper Bazel BUILD files in each package
- Test files co-located with source (good practice)

### Container Images

**Dockerfiles:**

| Dockerfile | Base Image | Purpose |
|------------|-----------|---------|
| `Dockerfile` | Ubuntu 20.04 | Upstream default |
| `Dockerfile.redhat` | UBI9 | Red Hat downstream build |
| `Dockerfile.konflux` | UBI9 (pinned SHA) | Konflux pipeline build |
| `Dockerfile.fedora` | Fedora 38 | Fedora variant |
| `Dockerfile.manylinux2010` | manylinux2010 | Python wheel builds |
| `Dockerfile` (dev_debug) | (unknown) | Development debugging |

**Security Observations:**
- `Dockerfile.konflux` pins base images by SHA digest (good practice)
- `Dockerfile.redhat` uses unpinned `ubi9/ubi:latest` tag (risk: non-reproducible builds)
- Final stage runs as non-root user (`USER 65534:65534`) (good practice)
- Multi-stage build reduces attack surface (good practice)
- No Trivy/Snyk scanning in any workflow
- No SBOM generation
- No image signing/attestation

**Build Architecture:**
- Bazel build of C++ `metadata_store_server` binary
- MariaDB connector library copied to final image
- gRPC server exposed on port 8080
- Multi-arch support via Konflux (x86_64, ARM64, ppc64le)

**Runtime Testing**: None
- No container startup validation
- No gRPC health check
- No integration test with database backends

### Security

**Current State**: No security tooling whatsoever

| Security Practice | Status |
|-------------------|--------|
| Container scanning (Trivy/Snyk) | Not configured |
| SAST (CodeQL/Semgrep) | Not configured |
| Dependency scanning | Not configured |
| Secret detection (Gitleaks) | Not configured |
| Image signing | Not configured |
| SBOM generation | Not configured |
| Non-root container user | Configured (65534) |
| Pinned base images | Konflux only |

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No agent rules exist
- **Quality**: N/A
- **Gaps**: No `CLAUDE.md`, no `.claude/` directory, no `AGENTS.md`, no test creation rules, no development guidelines for AI assistants
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - Bazel-based C++ test patterns (GoogleTest)
  - Python test patterns
  - Go test patterns with protocmp
  - gRPC server testing guidance
  - Multi-database test fixture usage

## Recommendations

### Priority 0 (Critical)

1. **Execute existing tests in CI** (8-16 hours)
   - Add Bazel installation step to PR workflow
   - Run `bazel test //ml_metadata/...` for C++ and Go tests
   - Run Python tests via Bazel py_test targets
   - Start with SQLite-based tests (no external DB needed)

2. **Add container security scanning** (2-4 hours)
   - Add Trivy scanning to PR and master workflows
   - Set severity threshold (CRITICAL, HIGH)
   - Upload SARIF results to GitHub Security tab

3. **Implement coverage tracking** (4-6 hours)
   - Add `--collect_code_coverage` flag to Bazel test step
   - Generate LCOV reports
   - Integrate with Codecov
   - Set minimum coverage threshold (60% to start)

### Priority 1 (High Value)

4. **Add container runtime validation** (4-6 hours)
   - Start built image as container in CI
   - Verify gRPC port responds
   - Run basic gRPC health check
   - Test with SQLite backend (no external DB needed)

5. **Set up static analysis** (4-8 hours)
   - Add clang-tidy for C++ code
   - Add ruff/pylint for Python
   - Add golangci-lint for Go
   - Consider CodeQL for security-focused analysis

6. **Create agent rules** (2-4 hours)
   - Add `CLAUDE.md` with repository overview and development patterns
   - Create `.claude/rules/` with test creation guidelines
   - Document Bazel build patterns and test frameworks

### Priority 2 (Nice-to-Have)

7. **Multi-database integration testing** (8-16 hours)
   - Add docker-compose service for MySQL/PostgreSQL
   - Run database-specific test suites against real databases
   - Test migration paths between database versions

8. **Add pre-commit hooks** (2-3 hours)
   - Format checking (clang-format, black, goimports)
   - Import sorting
   - Trailing whitespace

9. **SBOM generation** (2-3 hours)
   - Generate SBOM for container images via Syft
   - Attach to image as attestation
   - Integrate with Konflux supply chain security

10. **Performance regression testing** (8-16 hours)
    - Benchmark metadata store operations
    - Track gRPC latency over time
    - Alert on performance degradation

## Comparison to Gold Standards

| Practice | ml-metadata | odh-dashboard | notebooks | kserve |
|----------|-------------|---------------|-----------|--------|
| CI test execution | None | Comprehensive (unit, integration, E2E) | Multi-layer | Full suite |
| Coverage tracking | None | Codecov with enforcement | Basic | Codecov with thresholds |
| Security scanning | None | Trivy + CodeQL | Trivy | Trivy + CodeQL |
| Container testing | Build only | Build + startup + functional | 5-layer validation | Build + deploy + test |
| Linting | None | ESLint + Prettier | Varied | golangci-lint |
| Pre-commit hooks | None | Husky + lint-staged | Basic | golangci-lint |
| Agent rules | None | Comprehensive (.claude/rules/) | None | None |
| Multi-arch builds | Konflux (3 arch) | Single arch | Multi-arch | Multi-arch |
| Dependency mgmt | Renovate (Konflux only) | Dependabot | Renovate | Dependabot |

## File Paths Reference

### CI/CD
- `.github/workflows/build-pr.yaml` - PR image build workflow
- `.github/workflows/build-master.yaml` - Master branch image build + push
- `.github/actions/build/action.yaml` - Reusable Docker build action
- `.tekton/odh-mlmd-grpc-server-pull-request.yaml` - Konflux multi-arch pipeline
- `.github/renovate.json` - Renovate dependency management config

### Build System
- `WORKSPACE` - Bazel workspace with external dependencies
- `.bazelrc` - Bazel build configuration
- `ml_metadata/ml_metadata.bzl` - Custom Bazel macros (cc_test, go_test, go_library)
- `ml_metadata/metadata_store/BUILD` - Main package BUILD with 19+ test targets
- `ml_metadata/util/BUILD` - Utility package with 4 test targets
- `ml_metadata/query/BUILD` - Query package with 3 test targets

### Container Images
- `ml_metadata/tools/docker_server/Dockerfile.redhat` - Red Hat UBI9 build
- `ml_metadata/tools/docker_server/Dockerfile.konflux` - Konflux build (pinned SHAs)
- `ml_metadata/tools/docker_server/Dockerfile` - Upstream Ubuntu build
- `ml_metadata/tools/docker_server/Dockerfile.fedora` - Fedora build
- `ml_metadata/tools/docker_server/build_docker_image.sh` - Build script

### Test Files (Selected)
- `ml_metadata/metadata_store/metadata_store_test.cc` - Core C++ tests
- `ml_metadata/metadata_store/metadata_store_test.py` - Python API tests (2,631 lines)
- `ml_metadata/metadata_store/metadata_store_test.go` - Go binding tests (1,559 lines)
- `ml_metadata/query/filter_query_builder_test.cc` - Query builder tests
- `ml_metadata/util/record_parsing_utils_test.cc` - Record parsing tests

### Configuration
- `pyproject.toml` - Python build system config
- `setup.py` - Python package setup
- `docker-compose.yml` - Multi-version Python wheel builds
- `test_constraints.txt` - Test environment constraints
