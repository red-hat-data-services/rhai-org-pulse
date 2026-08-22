---
repository: "red-hat-data-services/ml-metadata"
overall_score: 3.1
scorecard:
  - dimension: "Unit Tests"
    score: 5.0
    status: "32 test files across C++/Python/Go but none executed in CI"
  - dimension: "Integration/E2E"
    score: 1.0
    status: "No integration or E2E testing infrastructure"
  - dimension: "Build Integration"
    score: 5.0
    status: "PR image builds via GitHub Actions and Tekton/Konflux multi-arch, no test execution"
  - dimension: "Image Testing"
    score: 5.0
    status: "4 Dockerfiles with multi-stage builds and multi-arch support, no runtime validation"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling, no thresholds, no reporting"
  - dimension: "CI/CD Automation"
    score: 4.0
    status: "Basic build automation with concurrency control, no test jobs"
  - dimension: "Static Analysis"
    score: 3.0
    status: "Renovate configured, no linting or pre-commit hooks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules"
critical_gaps:
  - title: "No tests executed in CI"
    impact: "Regressions can be merged without detection — test files exist but are never run by any workflow"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No coverage tracking"
    impact: "No visibility into tested vs untested code paths; coverage cannot regress because it is not measured"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No integration or E2E tests"
    impact: "Database backend interactions (MySQL, PostgreSQL, SQLite) are untested in any automated pipeline"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No linting or static analysis"
    impact: "Code style drift, potential bugs, and non-idiomatic patterns not caught before merge"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "No container runtime validation"
    impact: "Image startup failures (missing libs, wrong entrypoint, permission issues) not caught until deployment"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add a CI workflow that runs Bazel test targets"
    effort: "4-8 hours"
    impact: "Immediately catches regressions in 27 C++ and 4 Python test suites already written"
  - title: "Add clang-tidy or a Bazel-compatible C++ linter"
    effort: "2-4 hours"
    impact: "Catches common C++ bugs and enforces coding standards"
  - title: "Create CLAUDE.md with test patterns and build instructions"
    effort: "2-3 hours"
    impact: "Enable AI-assisted test creation consistent with existing Bazel + Google Test patterns"
  - title: "Add container startup smoke test to PR workflow"
    effort: "2-3 hours"
    impact: "Verify the built gRPC server image starts and responds on port 8080"
recommendations:
  priority_0:
    - "Add a GitHub Actions workflow that runs `bazel test //ml_metadata/...` on PRs to execute existing 32 test files"
    - "Add coverage tracking via Bazel --combined_report=lcov and integrate with Codecov"
  priority_1:
    - "Create integration test workflow that tests against MySQL and PostgreSQL backends using docker-compose or testcontainers"
    - "Add container runtime validation — verify image starts, gRPC port responds, basic health check"
    - "Add clang-tidy, cpplint, or Bazel buildifier for static analysis"
  priority_2:
    - "Create CLAUDE.md and .claude/rules/ with test creation patterns for C++ (Google Test) and Python"
    - "Add pre-commit hooks for formatting and basic checks"
    - "Add FIPS build validation workflow for downstream Red Hat builds"
---

# Quality Analysis: ml-metadata

## Executive Summary

- **Overall Score: 3.1/10**
- **Repository**: `red-hat-data-services/ml-metadata` (downstream fork of `google/ml-metadata`)
- **Tier**: Downstream | **Jira**: RHOAIENG / AI Pipelines
- **Type**: C++/Python gRPC metadata store server (Bazel build system)
- **Primary Languages**: C++ (core), Python (bindings/tests), Go (minimal)

### Key Strengths
- Strong test file coverage: 27 C++ test files for 29 source files (~0.93 ratio)
- Multi-arch Konflux build pipeline (x86_64, arm64, ppc64le)
- Multiple Dockerfiles with multi-stage builds and UBI9 base images
- Renovate configured for dependency updates

### Critical Gaps
- **No tests run in CI** — 32 test files exist but are never executed by any workflow
- **No coverage tracking** — zero visibility into code path coverage
- **No integration/E2E tests** — database backend interactions are untested in automation
- **No static analysis** — no linting, no pre-commit hooks
- **No agent rules** — no AI-assisted development guidance

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 5.0/10 | 15% | 0.75 | 32 test files exist but none run in CI |
| Integration/E2E | 1.0/10 | 20% | 0.20 | No integration or E2E test infrastructure |
| Build Integration | 5.0/10 | 15% | 0.75 | PR image builds work, no test execution |
| Image Testing | 5.0/10 | 10% | 0.50 | Multi-stage + multi-arch, no runtime validation |
| Coverage Tracking | 0.0/10 | 10% | 0.00 | No coverage tooling at all |
| CI/CD Automation | 4.0/10 | 15% | 0.60 | Build-only automation, no test jobs |
| Static Analysis | 3.0/10 | 10% | 0.30 | Only Renovate, no linting |
| Agent Rules | 0.0/10 | 5% | 0.00 | No agent rules present |
| **Overall** | **3.1/10** | **100%** | **3.10** | |

## Critical Gaps

### 1. No Tests Executed in CI
- **Severity**: HIGH
- **Impact**: The repository has 27 C++ test files (`*_test.cc`), 4 Python test files (`*test*.py`), and 1 Go test file — yet no CI workflow runs any of them. Regressions can be merged undetected.
- **Effort**: 8-16 hours
- **Details**: The Bazel BUILD files define ~27 `cc_test` and `py_test` targets. A CI workflow needs to run `bazel test //ml_metadata/...` which would execute all defined test targets.

### 2. No Coverage Tracking
- **Severity**: HIGH
- **Impact**: No coverage data is collected, reported, or enforced. There is no `.codecov.yml`, no `--coverprofile` flags, and no coverage gates.
- **Effort**: 4-8 hours

### 3. No Integration or E2E Tests in Automation
- **Severity**: HIGH
- **Impact**: The metadata store supports MySQL, PostgreSQL, and SQLite backends. Some unit tests reference these databases but there's no automated pipeline testing real database connections.
- **Effort**: 16-24 hours

### 4. No Linting or Static Analysis
- **Severity**: MEDIUM
- **Impact**: No clang-tidy, cpplint, buildifier, or any other linting tool is configured. Code style and potential bugs are only caught during human review.
- **Effort**: 4-8 hours

### 5. No Container Runtime Validation
- **Severity**: MEDIUM
- **Impact**: The PR workflow builds the Docker image but never starts it to verify the gRPC server launches correctly.
- **Effort**: 4-6 hours

## Quick Wins

### 1. Add Bazel Test Workflow (4-8 hours)
The highest-impact improvement. A new GitHub Actions workflow that runs `bazel test //ml_metadata/...` on PRs would immediately activate 32 existing test files.

```yaml
name: Run Tests
on:
  pull_request:
    paths-ignore:
      - '**.md'
      - 'docs/**'
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Bazel
        uses: bazelbuild/setup-bazelisk@v3
      - name: Run Tests
        run: bazel test //ml_metadata/... --test_output=errors
```

### 2. Add C++ Linting (2-4 hours)
Add clang-tidy or buildifier to catch common issues:

```yaml
      - name: Run buildifier
        run: |
          bazel run //:buildifier -- --lint=warn -r ml_metadata/
```

### 3. Create CLAUDE.md (2-3 hours)
Add agent rules documenting test patterns (Google Test for C++, Python unittest), build system (Bazel), and contribution guidelines. Use `/test-rules-generator` to bootstrap.

### 4. Add Container Smoke Test (2-3 hours)
After building the image in the PR workflow, start it and verify gRPC readiness:

```yaml
      - name: Smoke test
        run: |
          docker run -d --name mlmd-test -p 8080:8080 \
            -e METADATA_STORE_SERVER_CONFIG_FILE="" \
            ${IMG}:${TAG}
          sleep 5
          docker logs mlmd-test
          # Verify process is running
          docker exec mlmd-test ps aux | grep metadata_store_server
          docker stop mlmd-test
```

## Detailed Findings

### Unit Tests

**Score: 5.0/10**

The repository has a strong collection of test files that are never executed in CI:

| Language | Test Files | Source Files | Ratio |
|----------|-----------|--------------|-------|
| C++ (.cc) | 27 | 29 | 0.93 |
| Python (.py) | 4 | 17 | 0.24 |
| Go (.go) | 1 | 2 | 0.50 |
| **Total** | **32** | **48** | **0.67** |

**Test targets in Bazel BUILD files:**
- `ml_metadata/metadata_store/BUILD`: 20 test targets
- `ml_metadata/util/BUILD`: 4 test targets
- `ml_metadata/query/BUILD`: 3 test targets

**Key test files:**
- `metadata_store_test.cc` — Core metadata store functionality
- `sqlite_metadata_source_test.cc` — SQLite backend tests
- `mysql_metadata_source_test.cc` — MySQL backend tests
- `postgresql_metadata_source_test.cc` — PostgreSQL backend tests
- `filter_query_builder_test.cc` — Query builder tests
- `metadata_store_test.py` — Python bindings tests
- `metadata_store_test.go` — Go bindings tests

**Gaps:**
- No tests run in any CI workflow
- No test framework configuration outside of Bazel
- No test isolation patterns visible (no `t.Parallel()` or equivalent)

### Integration/E2E Tests

**Score: 1.0/10**

- No `e2e/` or `integration/` directories
- No Kind, Minikube, or envtest usage
- No multi-version testing
- No docker-compose test configuration (existing `docker-compose.yml` is for Python wheel builds only)
- No Testcontainers or similar container-based testing
- The `ml_metadata/proto/testing/` directory contains protobuf testing utilities, not E2E tests

The 1 point is for the fact that some unit tests do exercise real database backends (MySQL, PostgreSQL, SQLite), which provides some integration coverage — but these aren't automated.

### Build Integration

**Score: 5.0/10**

**PR Build Workflow (`.github/workflows/build-pr.yaml`):**
- Triggers on pull_request with path ignoring for non-code files
- Concurrency control with `cancel-in-progress: true`
- Builds Docker image using `Dockerfile.redhat` via composite action
- Uses `build_docker_image.sh` script
- Does NOT push image on PR (good practice)

**Tekton/Konflux Pipeline (`.tekton/odh-mlmd-grpc-server-pull-request.yaml`):**
- PR-triggered via label (`kfbuild-all`, `kfbuild-ml-metadata`) or comment (`/build-konflux`)
- Multi-arch builds: `linux/x86_64`, `linux-mxlarge/arm64`, `linux/ppc64le`
- Uses `Dockerfile.konflux` with pinned image digests
- 4-hour pipeline timeout
- Image expiry of 5 days for PR builds
- References `red-hat-data-services/konflux-central` for pipeline definition

**Gaps:**
- No test execution during builds
- No Kustomize/manifest validation (not directly applicable)
- No Konflux build simulation in GitHub Actions

### Image Testing

**Score: 5.0/10**

**Dockerfiles (4 total):**

| Dockerfile | Base Image | Multi-stage | Non-root |
|-----------|-----------|-------------|----------|
| `Dockerfile` | ubuntu:20.04 | Yes | No |
| `Dockerfile.fedora` | fedora:38 | Yes | No |
| `Dockerfile.redhat` | UBI9 | Yes | Yes (65534) |
| `Dockerfile.konflux` | UBI9 (pinned digest) | Yes | Yes (65534) |

**Strengths:**
- All Dockerfiles use multi-stage builds (builder → minimal runtime)
- Red Hat/Konflux variants use UBI9 base images (FIPS-capable)
- Non-root user (`65534:65534`) in production variants
- Konflux variant uses pinned image digests for reproducibility
- `.dockerignore` present
- Multi-arch support via Konflux (x86_64, arm64, ppc64le)

**Gaps:**
- No `HEALTHCHECK` instruction in any Dockerfile
- No runtime validation tests
- No Testcontainers or equivalent
- No readiness/liveness probe definitions
- Upstream Dockerfiles (ubuntu, fedora) don't use non-root user

### Coverage Tracking

**Score: 0.0/10**

- No `.codecov.yml` or `codecov.yml`
- No `.coveragerc`
- No coverage flags in any workflow or script (`--coverprofile`, `pytest-cov`, `--coverage`)
- No coverage thresholds or gates
- No PR coverage reporting
- Bazel supports coverage via `bazel coverage` with `--combined_report=lcov` but this is not configured

### CI/CD Automation

**Score: 4.0/10**

**Workflow Inventory:**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build-pr.yaml` | `pull_request` | Build Docker image (no push) |
| `build-master.yaml` | `push` to master | Build and push Docker image to Quay |
| Tekton pipeline | PR label/comment | Multi-arch Konflux build |

**Strengths:**
- Concurrency control on both workflows (`cancel-in-progress: true`)
- Path-ignore for non-code changes (docs, markdown, etc.)
- Composite action for reusable build logic
- Tag generation based on commit SHA

**Gaps:**
- No test execution in any workflow
- No caching strategies (Bazel builds from scratch every time)
- No test parallelization
- No periodic/scheduled jobs
- No matrix strategies for multi-version testing
- No timeout limits on GitHub Actions jobs
- Only 2 workflows — very minimal automation

### Static Analysis

**Score: 3.0/10**

**Linting:** None configured
- No `.golangci.yaml` (Go files present)
- No clang-tidy or cpplint configuration (C++ is primary language)
- No buildifier configuration (uses Bazel)
- No Python linting (ruff, flake8, mypy)
- No `.pre-commit-config.yaml`

**FIPS Compatibility:**
- No non-FIPS crypto imports detected in source code (positive)
- No FIPS build tags configured (no `-tags=fips`, no `GOEXPERIMENT=boringcrypto`)
- UBI9 base images in Red Hat/Konflux Dockerfiles are FIPS-capable
- No explicit FIPS validation or testing

**Dependency Management:**
- Renovate configured (`.github/renovate.json`) extending `red-hat-data-services/konflux-central` defaults
- No Dependabot (Renovate serves the same purpose)
- Bazel external dependencies managed via WORKSPACE file with pinned SHA256 hashes

### Agent Rules

**Score: 0.0/10**

- **Status**: Missing
- No `CLAUDE.md` or `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` for test creation rules
- No `.claude/skills/` for custom skills
- No testing documentation in `docs/`

**Recommendation:** Generate agent rules with `/test-rules-generator` to enable AI-assisted test creation consistent with the Bazel + Google Test patterns used in the repository.

## Recommendations

### Priority 0 (Critical)

1. **Add a CI workflow to run Bazel tests on PRs**
   - Create `.github/workflows/test.yaml` that runs `bazel test //ml_metadata/...`
   - This immediately activates 32 existing test files
   - Consider using Bazel remote cache to speed up builds
   - Effort: 8-16 hours (including Bazel setup and potential test fixes)

2. **Add coverage tracking with Codecov**
   - Use `bazel coverage //ml_metadata/... --combined_report=lcov`
   - Upload to Codecov with the codecov-action
   - Set initial thresholds at current coverage level, then ratchet up
   - Effort: 4-8 hours

### Priority 1 (High Value)

3. **Create integration test pipeline for database backends**
   - Use docker-compose or GitHub Actions services to run MySQL and PostgreSQL
   - Run database-specific Bazel test targets against real backends
   - Test all three supported backends: SQLite, MySQL, PostgreSQL
   - Effort: 16-24 hours

4. **Add container runtime validation**
   - After PR image build, start the container and verify gRPC server responds
   - Add `HEALTHCHECK` instruction to Dockerfiles
   - Test with a basic gRPC health check client
   - Effort: 4-6 hours

5. **Add static analysis tooling**
   - Add clang-tidy for C++ code quality
   - Add buildifier for Bazel file formatting
   - Add ruff for Python linting
   - Effort: 4-8 hours

### Priority 2 (Nice-to-Have)

6. **Create CLAUDE.md and agent rules**
   - Document build system (Bazel), test patterns (Google Test, Python unittest)
   - Add rules for test creation in `.claude/rules/`
   - Use `/test-rules-generator` to bootstrap
   - Effort: 2-3 hours

7. **Add pre-commit hooks**
   - buildifier for BUILD files
   - clang-format for C++ files
   - ruff for Python files
   - Effort: 2-4 hours

8. **Add Bazel remote caching**
   - Speed up CI builds significantly
   - Consider using GitHub Actions cache or dedicated Bazel remote cache
   - Effort: 4-8 hours

9. **Add FIPS build validation**
   - Test that builds with FIPS-enabled base images work correctly
   - Verify no non-FIPS crypto libraries are linked
   - Effort: 4-8 hours

## Comparison to Gold Standards

| Dimension | ml-metadata | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|-----------|-------------|---------------------|-------------------|---------------|
| Unit Tests | 5.0 - Files exist, no CI | 9.0 - Jest + Cypress | 7.0 - Multi-layer | 8.0 - Go testing |
| Integration/E2E | 1.0 - None | 9.0 - Cypress E2E | 8.0 - Image validation | 9.0 - envtest + Kind |
| Build Integration | 5.0 - Image builds only | 8.0 - Full validation | 7.0 - Image pipeline | 8.0 - Operator bundle |
| Image Testing | 5.0 - Multi-stage, no runtime | 6.0 - Basic | 9.0 - 5-layer validation | 7.0 - Multi-arch |
| Coverage Tracking | 0.0 - None | 8.0 - Codecov + gates | 5.0 - Basic | 8.0 - Codecov + thresholds |
| CI/CD Automation | 4.0 - Build-only | 9.0 - Comprehensive | 8.0 - Well-organized | 9.0 - Matrix + caching |
| Static Analysis | 3.0 - Renovate only | 8.0 - ESLint + strict TS | 6.0 - Basic linting | 8.0 - golangci-lint |
| Agent Rules | 0.0 - None | 8.0 - Comprehensive | 3.0 - Basic | 5.0 - Partial |
| **Overall** | **3.1** | **8.4** | **7.0** | **8.0** |

## File Paths Reference

### CI/CD
- `.github/workflows/build-pr.yaml` — PR build workflow
- `.github/workflows/build-master.yaml` — Master branch build and push
- `.github/actions/build/action.yaml` — Composite build action
- `.tekton/odh-mlmd-grpc-server-pull-request.yaml` — Konflux PR pipeline

### Container Images
- `ml_metadata/tools/docker_server/Dockerfile` — Upstream (Ubuntu)
- `ml_metadata/tools/docker_server/Dockerfile.fedora` — Fedora variant
- `ml_metadata/tools/docker_server/Dockerfile.redhat` — Red Hat UBI9 variant
- `ml_metadata/tools/docker_server/Dockerfile.konflux` — Konflux UBI9 variant (pinned digests)
- `ml_metadata/tools/docker_server/build_docker_image.sh` — Build script
- `ml_metadata/tools/docker_build/Dockerfile.manylinux2010` — Python wheel build
- `docker-compose.yml` — Python wheel build services
- `.dockerignore` — Docker ignore rules

### Build System
- `WORKSPACE` — Bazel workspace with external dependencies
- `.bazelrc` — Bazel configuration
- `ml_metadata/.bazelversion` — Bazel version
- `setup.py` — Python package setup (uses Bazel internally)
- `pyproject.toml` — Python build system requirements

### Test Files
- `ml_metadata/metadata_store/*_test.cc` — C++ metadata store tests (20 files)
- `ml_metadata/util/*_test.cc` — C++ utility tests (4 files)
- `ml_metadata/query/*_test.cc` — C++ query builder tests (3 files)
- `ml_metadata/metadata_store/*test*.py` — Python binding tests (3 files)
- `ml_metadata/tools/mlmd_resolver/metadata_resolver_test.py` — Python resolver test
- `ml_metadata/metadata_store/metadata_store_test.go` — Go binding test

### Dependency Management
- `.github/renovate.json` — Renovate configuration

### Proto/Testing
- `ml_metadata/proto/testing/` — Protobuf testing utilities
