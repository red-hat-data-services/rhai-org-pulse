---
repository: "opendatahub-io/ml-metadata"
overall_score: 3.8
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Solid C++ unit test suite with Google Test; Python tests with absltest; good test-to-code ratio"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "Database-specific tests exist (MySQL, PostgreSQL, SQLite) but no automated E2E or cluster-based testing"
  - dimension: "Build Integration"
    score: 5.0
    status: "PR-triggered Docker image build exists; Konflux multi-arch pipeline configured; no test execution in PR CI"
  - dimension: "Image Testing"
    score: 3.0
    status: "Multi-stage UBI9 Dockerfile; multi-arch via Konflux; no runtime validation, no HEALTHCHECK, no container testing"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tracking whatsoever — no codecov, no coverage flags, no PR coverage reporting"
  - dimension: "CI/CD Automation"
    score: 3.0
    status: "Only 2 workflows (PR build + master push); no test execution in CI; no caching; concurrency control present"
  - dimension: "Static Analysis"
    score: 1.0
    status: "No linting config, no pre-commit hooks, no dependency alerts; UBI9 base images are FIPS-capable"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no AGENTS.md, no .claude/ directory — zero AI agent guidance"
critical_gaps:
  - title: "No test execution in CI pipelines"
    impact: "Neither unit tests nor integration tests run on PRs — regressions merge undetected"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "Zero coverage tracking"
    impact: "No visibility into what code is tested; coverage can degrade silently"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No static analysis or linting"
    impact: "Code quality issues, style inconsistencies, and potential bugs not caught before merge"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No dependency alert configuration"
    impact: "Vulnerable dependencies remain unpatched; no automated update PRs"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No container runtime validation"
    impact: "Image startup failures and misconfigurations not caught until deployment"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add Dependabot configuration for pip and Docker ecosystems"
    effort: "1-2 hours"
    impact: "Automated dependency update PRs and vulnerability alerts"
  - title: "Add a CI workflow to run Bazel tests on PRs"
    effort: "4-6 hours"
    impact: "Catch regressions before merge — 27 C++ and 4 Python test suites already exist"
  - title: "Add .pre-commit-config.yaml with clang-format and Python linters"
    effort: "2-3 hours"
    impact: "Enforce consistent code style across C++ and Python code"
  - title: "Create basic CLAUDE.md with test and build guidance"
    effort: "1-2 hours"
    impact: "Improve AI-generated contribution quality and consistency"
recommendations:
  priority_0:
    - "Add a PR workflow that runs `bazel test //ml_metadata/...` to execute the existing 31 test targets"
    - "Configure Codecov or equivalent coverage tracking with Bazel `--combined_report=lcov`"
    - "Add clang-tidy and Python linter (ruff or pylint) to CI"
  priority_1:
    - "Add Dependabot configuration covering pip, Docker, and GitHub Actions ecosystems"
    - "Add container runtime validation — at minimum verify the gRPC server starts and responds to health checks"
    - "Add HEALTHCHECK to Dockerfile.redhat for runtime health monitoring"
  priority_2:
    - "Create comprehensive CLAUDE.md and .claude/rules/ for test creation patterns"
    - "Add pre-commit hooks for code formatting and linting"
    - "Add integration tests that validate the MLMD gRPC server against SQLite and PostgreSQL backends"
---

# Quality Analysis: opendatahub-io/ml-metadata

## Executive Summary

- **Overall Score: 3.8/10** (Weighted)
- **Repository Type**: C++/Python library with gRPC server (upstream fork from Google)
- **Tier**: Midstream | **Jira Component**: AI Pipelines | **Jira Project**: RHOAIENG
- **Primary Languages**: C++ (core), Python (bindings/tests)
- **Build System**: Bazel 5.x
- **Key Strengths**: Good unit test suite inherited from upstream (Google Test + absltest), multi-stage UBI9 Dockerfile, Konflux multi-arch pipeline
- **Critical Gaps**: No tests run in CI, zero coverage tracking, no linting, no dependency alerts, no agent rules
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 7.0/10 | Solid C++ unit test suite (27 test files); Python tests with absltest (4 files); ~0.69 test-to-code ratio |
| Integration/E2E | 20% | 3.0/10 | Database-specific tests (MySQL, PostgreSQL, SQLite) but no automated E2E or cluster testing |
| Build Integration | 15% | 5.0/10 | PR Docker build + Konflux multi-arch; no test execution in CI |
| Image Testing | 10% | 3.0/10 | Multi-stage UBI9 build; no runtime validation, no HEALTHCHECK |
| Coverage Tracking | 10% | 0.0/10 | No coverage configuration, no coverage flags, no PR reporting |
| CI/CD Automation | 15% | 3.0/10 | Only 2 workflows; no test jobs; concurrency control present |
| Static Analysis | 10% | 1.0/10 | No linting, no pre-commit, no Dependabot; UBI9 base is FIPS-capable |
| Agent Rules | 5% | 0.0/10 | No CLAUDE.md, AGENTS.md, or .claude/ directory |

**Overall: 3.8/10** = (7.0×0.15) + (3.0×0.20) + (5.0×0.15) + (3.0×0.10) + (0.0×0.10) + (3.0×0.15) + (1.0×0.10) + (0.0×0.05)

## Critical Gaps

### 1. No Test Execution in CI Pipelines
- **Impact**: The repository has 27 C++ test files (~20,600 lines) and 4 Python test files (~4,133 lines), but **none of them run in any CI pipeline**. The two GitHub Actions workflows only build Docker images — no `bazel test` step exists.
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Details**: PR workflow (`build-pr.yaml`) only builds the Docker image. No Bazel test execution, no Python test execution. Regressions can merge without detection.

### 2. Zero Coverage Tracking
- **Impact**: No visibility into what percentage of code is tested. Coverage can degrade without anyone knowing.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: No `.codecov.yml`, no `--coverprofile` or `pytest-cov` in any workflow, no coverage PR comments. Bazel supports `--combined_report=lcov` which could feed into Codecov.

### 3. No Static Analysis or Linting
- **Impact**: Code quality issues, inconsistent style, and potential bugs are not caught before merge.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No `.clang-format`, `.clang-tidy`, `ruff.toml`, `.pylintrc`, or any other linting configuration. No pre-commit hooks. The C++ codebase would benefit significantly from clang-tidy and the Python code from ruff.

### 4. No Dependency Alert Configuration
- **Impact**: Vulnerable dependencies remain unpatched with no automated update mechanism.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: No `.github/dependabot.yml`, no `renovate.json`. The repo uses Bazel dependencies (WORKSPACE file) and Python packages — both ecosystems should have alerts configured.

### 5. No Container Runtime Validation
- **Impact**: Image startup failures and misconfigurations are not caught until deployment.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: The Dockerfile.redhat builds the `metadata_store_server` binary but there's no validation that the server starts, binds to the port, or responds to gRPC health checks.

## Quick Wins

### 1. Add Dependabot Configuration (1-2 hours)
Create `.github/dependabot.yml` to cover pip, Docker, and GitHub Actions ecosystems:
```yaml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "docker"
    directory: "/ml_metadata/tools/docker_server"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 2. Add CI Test Execution Workflow (4-6 hours)
Add a workflow that runs existing Bazel tests on PRs. The 31 test targets already exist:
```yaml
name: Tests
on:
  pull_request:
    branches: [master]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Bazel
        uses: bazel-contrib/setup-bazel@0.14.0
        with:
          bazelisk-cache: true
      - name: Run Tests
        run: bazel test //ml_metadata/... --test_output=errors
```

### 3. Add Pre-commit Hooks (2-3 hours)
Create `.pre-commit-config.yaml` with clang-format for C++ and ruff for Python:
```yaml
repos:
  - repo: https://github.com/pre-commit/mirrors-clang-format
    rev: v18.1.8
    hooks:
      - id: clang-format
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.5.0
    hooks:
      - id: ruff
      - id: ruff-format
```

### 4. Create Basic CLAUDE.md (1-2 hours)
Add a `CLAUDE.md` with build, test, and contribution guidance for AI agents working on the repository.

## Detailed Findings

### Unit Tests

**Score: 7.0/10**

The repository has a solid unit test suite inherited from the upstream Google ml-metadata project:

- **C++ Tests**: 27 test files with ~20,600 lines of test code
  - Framework: Google Test (`gtest`) + Google Mock (`gmock`)
  - Tests cover: metadata store, metadata access objects, query builders, utilities
  - Database-specific test suites: SQLite, MySQL, PostgreSQL
  - Test utilities and fixtures: `test_util.h`, `metadata_store_test_suite.h`, `metadata_source_test_suite.h`
  - Good patterns: parameterized tests, test suites, mock protos in `proto/testing/`
- **Python Tests**: 4 test files with ~4,133 lines
  - Framework: `absl.testing.absltest` + `absl.testing.parameterized`
  - Tests cover: metadata store API, MLMD types, type helpers, metadata resolver
- **Test-to-Code Ratio**: 24,733 test lines / 35,477 source lines = **0.70** (good)
- **Gap**: Tests are not executed in any CI pipeline

**Files examined:**
- `ml_metadata/metadata_store/*_test.cc` (27 files)
- `ml_metadata/metadata_store/*_test.py` (3 files)
- `ml_metadata/tools/mlmd_resolver/metadata_resolver_test.py` (1 file)
- `ml_metadata/query/*_test.cc` (2 files)
- `ml_metadata/util/*_test.cc` (4 files)

### Integration/E2E Tests

**Score: 3.0/10**

- **Database Integration Tests**: Tests exist for SQLite, MySQL, and PostgreSQL backends, but these are structured as unit tests (not separate integration suites)
- **No E2E Tests**: No end-to-end tests that exercise the gRPC server
- **No Cluster Testing**: No Kind/Minikube/envtest-based testing
- **No Multi-version Testing**: No matrix strategy testing different database versions
- **Docker Compose**: Exists for manylinux wheel builds, not for integration testing

**Files examined:**
- `ml_metadata/metadata_store/mysql_metadata_source_test.cc`
- `ml_metadata/metadata_store/postgresql_metadata_source_test.cc`
- `ml_metadata/metadata_store/sqlite_metadata_source_test.cc`
- `docker-compose.yml` (build-only, not testing)

### Build Integration

**Score: 5.0/10**

- **PR Build**: `build-pr.yaml` workflow builds the Docker image on PRs using `Dockerfile.redhat` — good for catching build failures
- **Master Push**: `build-master.yaml` pushes tagged images to Quay.io
- **Konflux Integration**: Tekton pipeline definitions in `.tekton/` directory reference `odh-konflux-central` multi-arch build pipeline
- **Build Action**: Reusable composite action in `.github/actions/build/`
- **Gap**: No test execution in PR workflow — only image build
- **Gap**: No kustomize/manifest validation
- **Gap**: No build mode testing (e.g., RHOAI vs ODH)

**Files examined:**
- `.github/workflows/build-pr.yaml`
- `.github/workflows/build-master.yaml`
- `.github/actions/build/action.yaml`
- `.tekton/odh-mlmd-grpc-server-pull-request.yaml`
- `.tekton/odh-mlmd-grpc-server-push.yaml`

### Image Testing

**Score: 3.0/10**

- **Multi-stage Build**: Dockerfile.redhat uses UBI9 builder + UBI9-minimal runtime (good practice)
- **Base Images**: `registry.access.redhat.com/ubi9/ubi:latest` (builder) and `ubi9/ubi-minimal:latest` (runtime) — FIPS-capable
- **Non-root User**: Runtime runs as `USER 65534:65534` (good security practice)
- **Multi-arch**: Konflux pipeline references `multi-arch-container-build.yaml`
- **Gap**: No `HEALTHCHECK` instruction in any Dockerfile
- **Gap**: No runtime validation (no Testcontainers, no `docker run` tests)
- **Gap**: No container startup testing in CI
- **Gap**: `.dockerignore` only excludes `.git` — should exclude more

**Files examined:**
- `ml_metadata/tools/docker_server/Dockerfile.redhat`
- `ml_metadata/tools/docker_server/Dockerfile`
- `ml_metadata/tools/docker_server/Dockerfile.fedora`
- `.dockerignore`

### Coverage Tracking

**Score: 0.0/10**

- **No coverage configuration** of any kind
- No `.codecov.yml` or `codecov.yml`
- No `--coverprofile`, `pytest-cov`, or `--coverage` flags in any CI file
- No coverage PR comments or threshold enforcement
- No coverage gates

Bazel supports coverage via `bazel coverage` and `--combined_report=lcov`, which could be integrated with Codecov.

### CI/CD Automation

**Score: 3.0/10**

- **Workflow Count**: 2 workflows (minimal)
  - `build-pr.yaml` — PR-triggered Docker build
  - `build-master.yaml` — Push-triggered image build and publish
- **Concurrency Control**: Both workflows have `concurrency:` with `cancel-in-progress: true` (good)
- **Path Filtering**: PR workflow excludes irrelevant files (LICENSE, .md, docs/) from triggers (good)
- **Gap**: No test execution workflow
- **Gap**: No caching strategy (Bazel cache would significantly speed up builds)
- **Gap**: No matrix testing (multiple Python versions, database backends)
- **Gap**: No scheduled/periodic workflows
- **Gap**: No timeout configuration in GitHub Actions (Tekton has 8h timeout)

**Tekton/Konflux**:
- PR and push pipelines defined in `.tekton/`
- Uses centralized pipeline from `odh-konflux-central`
- High resource requests (8 CPU, 16Gi memory) for builds
- `cancel-in-progress: false` in Tekton (different from GitHub Actions)

### Static Analysis

**Score: 1.0/10**

#### Linting
- **No C++ linting**: No `.clang-format`, `.clang-tidy`, or any C++ linting configuration
- **No Python linting**: No `ruff.toml`, `.flake8`, `.pylintrc`, or `mypy.ini`
- **No pre-commit hooks**: No `.pre-commit-config.yaml`
- The only nod to code quality is `pyproject.toml` which only contains build configuration

#### FIPS Compatibility
- **Base Images**: UBI9 (FIPS-capable) — good
- **No problematic crypto imports**: No `crypto/md5`, `crypto/des`, `crypto/rc4` found in source
- **No FIPS build tags**: No explicit FIPS build configuration, but the C++ build uses system OpenSSL from UBI9 which supports FIPS mode
- **Assessment**: Neutral — no red flags, but no explicit FIPS configuration either

#### Dependency Alerts
- **No Dependabot**: No `.github/dependabot.yml`
- **No Renovate**: No `renovate.json` or `.renovaterc`
- Dependencies are managed via Bazel WORKSPACE file and `setup.py` / `pyproject.toml`

### Agent Rules

**Score: 0.0/10**

- **No `CLAUDE.md`** in repository root
- **No `AGENTS.md`** in repository root
- **No `.claude/` directory**
- **No `.claude/rules/`** directory
- **No test creation rules** for AI agents
- **No documentation** on testing patterns or contribution guidelines beyond basic `CONTRIBUTING.md`

**Recommendation**: Generate agent rules using `/test-rules-generator` to create:
- Unit test patterns for Google Test (C++) and absltest (Python)
- Build instructions with Bazel
- Test naming conventions and file placement rules

## Recommendations

### Priority 0 (Critical)
1. **Add CI test execution**: Create a GitHub Actions workflow that runs `bazel test //ml_metadata/...` on PRs. The test suite already exists (31 targets) — it just needs a CI trigger.
2. **Configure coverage tracking**: Use `bazel coverage` with `--combined_report=lcov` and integrate with Codecov. Set a baseline coverage threshold.
3. **Add static analysis**: Configure clang-tidy for C++ and ruff for Python. Add these as CI checks.

### Priority 1 (High Value)
4. **Add Dependabot**: Configure `.github/dependabot.yml` for pip, Docker, and GitHub Actions ecosystems.
5. **Add container runtime validation**: After the Docker build step in PR CI, run the image and verify the gRPC server starts and responds.
6. **Add HEALTHCHECK to Dockerfile.redhat**: `HEALTHCHECK --interval=30s CMD grpc_health_probe -addr=:8080 || exit 1`

### Priority 2 (Nice-to-Have)
7. **Create CLAUDE.md and .claude/rules/**: Add agent guidance for test patterns, build system, and contribution workflow.
8. **Add pre-commit hooks**: Configure clang-format and ruff for local development.
9. **Add E2E integration tests**: Test the gRPC server end-to-end with SQLite and PostgreSQL backends in CI.
10. **Add Bazel caching**: Configure remote or local Bazel cache in CI to speed up builds.

## Comparison to Gold Standards

| Practice | ml-metadata | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|----------|------------|---------------------|-------------------|---------------|
| Unit test framework | Google Test + absltest | Jest + Cypress | pytest | Go testing |
| Test-to-code ratio | 0.70 | ~0.80 | ~0.60 | ~0.50 |
| Tests in CI | None | Full suite on PR | Full suite on PR | Full suite on PR |
| Coverage tracking | None | Codecov with thresholds | Basic | Codecov enforced |
| E2E tests | None | Cypress + Playwright | Image validation | Multi-version K8s |
| Static analysis | None | ESLint strict | pylint/ruff | golangci-lint |
| Pre-commit hooks | None | Configured | Configured | Configured |
| Dependency alerts | None | Dependabot | Dependabot | Dependabot |
| FIPS compliance | UBI9 base (capable) | N/A | UBI-based | UBI-based |
| Agent rules | None | Comprehensive | Basic | Basic |
| PR build validation | Docker build only | Full build + test | Full build + test | Full build + test |
| Multi-arch | Via Konflux | Via Konflux | Multiple arches | Multiple arches |

## File Paths Reference

### CI/CD
- `.github/workflows/build-pr.yaml` — PR-triggered Docker build
- `.github/workflows/build-master.yaml` — Master push image build
- `.github/actions/build/action.yaml` — Reusable build action
- `.tekton/odh-mlmd-grpc-server-pull-request.yaml` — Konflux PR pipeline
- `.tekton/odh-mlmd-grpc-server-push.yaml` — Konflux push pipeline

### Build
- `ml_metadata/tools/docker_server/Dockerfile.redhat` — Production Dockerfile (UBI9)
- `ml_metadata/tools/docker_server/Dockerfile` — Upstream Dockerfile (Ubuntu)
- `ml_metadata/tools/docker_server/build_docker_image.sh` — Build helper script
- `.bazelrc` — Bazel build configuration
- `WORKSPACE` — Bazel workspace / dependency definitions
- `pyproject.toml` — Python build configuration
- `setup.py` — Python package setup

### Testing
- `ml_metadata/metadata_store/*_test.cc` — C++ unit tests (27 files)
- `ml_metadata/metadata_store/*_test.py` — Python unit tests (3 files)
- `ml_metadata/tools/mlmd_resolver/metadata_resolver_test.py` — Resolver tests
- `ml_metadata/metadata_store/test_util.h` — Test utilities
- `ml_metadata/proto/testing/mock.proto` — Mock proto definitions
- `test_constraints.txt` — Test dependency constraints

### Configuration
- `.dockerignore` — Docker build exclusions
- `.gitignore` — Git exclusions
- `docker-compose.yml` — Manylinux build environments
