---
repository: "feast-dev/feast"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Strong multi-language test suite with pytest, Go testing, and matrix CI across Python 3.10-3.12 and multi-OS"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Extensive integration test suite covering 15+ backends with operator E2E on Kind cluster"
  - dimension: "Build Integration"
    score: 7.0
    status: "Docker smoke tests on PR with multi-arch builds; no Konflux simulation but strong build validation"
  - dimension: "Image Testing"
    score: 7.5
    status: "Multi-arch Docker smoke tests with health endpoint validation; UBI base images for operator and feature server"
  - dimension: "Coverage Tracking"
    score: 7.0
    status: "Codecov integration with Python and Go flags; informational mode only, no enforced coverage gates"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "30 workflows with concurrency control, label-gated integration tests, nightly CI, and uv/pixi caching"
  - dimension: "Static Analysis"
    score: 7.0
    status: "Ruff + mypy + pre-commit hooks enforced; ESLint for UI; missing Dependabot/Renovate; FIPS gaps in Go code"
  - dimension: "Agent Rules"
    score: 9.5
    status: "Exceptional agent rules: CLAUDE.md, AGENTS.md, .claude/rules/, 4 comprehensive skills with testing, dev, architecture, and user guide"
critical_gaps:
  - title: "No Dependabot or Renovate for automated dependency updates"
    impact: "Dependencies may drift silently; security patches not automatically surfaced as PRs"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "Coverage tracking is informational-only (no enforced gates)"
    impact: "Coverage can decrease without blocking merges; no minimum thresholds enforced"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "math/rand used in Go production code (non-crypto PRNG)"
    impact: "math/rand is not cryptographically secure and not FIPS-compliant; used in DynamoDB online store and logging"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "hashlib.md5 used in Python Bigtable online store"
    impact: "MD5 is not FIPS-compliant; used for entity key hashing in Bigtable store"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "Go feature server Dockerfile uses debian-based golang image (not UBI)"
    impact: "Inconsistent with operator/Python server which use UBI9; not FIPS-capable by default"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Enable Dependabot for automated dependency alerts"
    effort: "1-2 hours"
    impact: "Automated security and dependency update PRs for pip, gomod, npm, and docker ecosystems"
  - title: "Enforce coverage thresholds in Codecov config"
    effort: "1-2 hours"
    impact: "Prevent coverage regressions by changing informational: true to informational: false"
  - title: "Replace math/rand with crypto/rand in Go production code"
    effort: "2-3 hours"
    impact: "FIPS compliance for Go feature server; eliminates non-secure PRNG in production paths"
  - title: "Switch Go feature server Dockerfile to UBI base image"
    effort: "2-4 hours"
    impact: "Consistent FIPS-capable base image across all components"
recommendations:
  priority_0:
    - "Add .github/dependabot.yml covering gomod, pip, npm, docker, and github-actions ecosystems"
    - "Enforce Codecov coverage gates by setting informational: false and threshold enforcement"
  priority_1:
    - "Replace math/rand with crypto/rand in Go production code (dynamodbonlinestore.go, logger.go)"
    - "Replace hashlib.md5 with hashlib.sha256 in Bigtable online store"
    - "Standardize Go feature server Dockerfile on UBI9 base image"
    - "Add FIPS build tags (//go:build boringcrypto) for Go components"
  priority_2:
    - "Add contract tests for gRPC API boundaries between feature server and SDK"
    - "Add Renovate as alternative to Dependabot for more flexible dependency management"
    - "Consider adding performance regression tests in CI for feature retrieval latency"
---

# Quality Analysis: feast-dev/feast

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Python/Go feature store library with Kubernetes operator
- **Primary Languages**: Python (primary), Go, Java, TypeScript
- **RHOAI Component**: Feature Store (RHOAIENG)
- **Key Strengths**: Exceptional CI/CD automation with 30 workflows, comprehensive multi-backend integration testing, outstanding agent rules with dedicated testing/dev/architecture skills, and multi-arch Docker builds with smoke testing
- **Critical Gaps**: No Dependabot/Renovate for dependency management, coverage tracking is informational-only without enforcement, FIPS-incompatible crypto usage in Go and Python code, and inconsistent base images across Dockerfiles
- **Agent Rules Status**: **Exceptional** - CLAUDE.md, AGENTS.md, .claude/rules/, and 4 comprehensive skills

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.0/10 | 15% | 1.20 | Strong multi-language test suite with pytest, Go testing, and matrix CI |
| Integration/E2E | 8.5/10 | 20% | 1.70 | Extensive integration suite covering 15+ backends with operator E2E on Kind |
| Build Integration | 7.0/10 | 15% | 1.05 | Docker smoke tests on PR with multi-arch; no Konflux simulation |
| Image Testing | 7.5/10 | 10% | 0.75 | Multi-arch smoke tests with /health validation; UBI base for operator/Python |
| Coverage Tracking | 7.0/10 | 10% | 0.70 | Codecov with flags for Python/Go; informational-only, no enforced gates |
| CI/CD Automation | 8.5/10 | 15% | 1.28 | 30 workflows with concurrency, label-gating, nightly CI, caching |
| Static Analysis | 7.0/10 | 10% | 0.70 | Ruff + mypy + ESLint + pre-commit; missing Dependabot; FIPS gaps |
| Agent Rules | 9.5/10 | 5% | 0.48 | Exceptional: CLAUDE.md, AGENTS.md, rules/, 4 comprehensive skills |
| **Overall** | **7.6/10** | **100%** | **7.86** | |

## Critical Gaps

### 1. No Dependabot or Renovate for Dependency Management
- **Impact**: Dependencies may drift silently; security patches not automatically surfaced as PRs
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: No `.github/dependabot.yml` or `renovate.json` found. The repository has dependencies across 5 ecosystems (pip, gomod, npm, docker, github-actions) that should be monitored.

### 2. Coverage Tracking is Informational-Only
- **Impact**: Coverage can decrease without blocking merges; no minimum thresholds enforced
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: `.codecov.yaml` has `informational: true` for both project and patch coverage. Target is set to `auto` for project and `70%` for patch, but neither blocks PRs. The coverage range is `50...70` suggesting moderate coverage levels.

### 3. FIPS-Incompatible Crypto in Go Code
- **Impact**: `math/rand` is not cryptographically secure and not FIPS-compliant; used in DynamoDB online store and logging
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: `math/rand` used in `dynamodbonlinestore.go`, `logger.go`, and test files. No FIPS build tags (`//go:build boringcrypto`) or `GOEXPERIMENT=boringcrypto` found.

### 4. hashlib.md5 in Python Bigtable Store
- **Impact**: MD5 is not FIPS-compliant; used for entity key hashing in Bigtable online store
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: `hashlib.md5` used in `sdk/python/feast/infra/online_stores/bigtable.py` for generating entity key hashes and project hashes.

### 5. Inconsistent Dockerfile Base Images
- **Impact**: Go feature server uses debian-based `golang:1.25` while operator and Python server use UBI9
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: The operator uses `registry.access.redhat.com/ubi9/go-toolset:1.25` and Python server uses `ubi9/python-312-minimal`. The Go feature server uses `golang:1.25` (debian-based), which is not FIPS-capable.

## Quick Wins

### 1. Enable Dependabot
- **Effort**: 1-2 hours
- **Impact**: Automated security and dependency update PRs
- **Implementation**:
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "gomod"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "npm"
    directory: "/ui"
    schedule:
      interval: "weekly"
  - package-ecosystem: "docker"
    directory: "/infra/feast-operator"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 2. Enforce Codecov Coverage Gates
- **Effort**: 1-2 hours
- **Impact**: Prevent coverage regressions on PRs
- **Implementation**: In `.codecov.yaml`, change `informational: true` to `informational: false` for both `project` and `patch` sections.

### 3. Replace math/rand in Go Production Code
- **Effort**: 2-3 hours
- **Impact**: FIPS compliance improvement
- **Implementation**: Replace `math/rand` with `crypto/rand` in `dynamodbonlinestore.go` and `logger.go`. Test files can keep `math/rand`.

## Detailed Findings

### Unit Tests

**Score: 8.0/10**

| Metric | Value |
|--------|-------|
| Python test files | 229 |
| Go test files | 48 |
| Java test files | 5 |
| JS/TS test files | 3 |
| Python source files | 627 |
| Go source files | 65 |
| Test-to-code ratio (Python) | 0.37 |
| Test-to-code ratio (Go) | 0.74 |

**Strengths**:
- Multi-language test suite covering Python (pytest), Go (testing), Java, and TypeScript
- Matrix testing across Python 3.10, 3.11, 3.12 on Ubuntu and macOS
- `pytest-xdist` for parallel test execution (`-n 8`)
- `pytest-cov` for coverage generation
- `pytest-benchmark` for performance benchmarking
- Well-organized test directory structure: `unit/infra/online_store/`, `unit/infra/offline_stores/`, `unit/infra/registry/`
- Dedicated Makefile targets: `test-python-unit`, `test-python-unit-fast`, `test-python-changed`, `test-python-smoke`
- Go tests run with coverage profiling (`-coverprofile`, `-covermode=atomic`)

**Gaps**:
- Test-to-code ratio for Python (0.37) is below the 0.5 gold standard
- Some Go tests skipped in CI (`-skip "TestGetOnlineFeatures|TestSqliteOnlineRead"`)

### Integration/E2E Tests

**Score: 8.5/10**

**Strengths**:
- **Extensive integration test coverage** with 64 integration test files across 17 directories
- **15+ backend integrations tested**: Redis, DynamoDB, Bigtable, Snowflake, BigQuery, Postgres, MySQL, Cassandra, Elasticsearch, MongoDB, Milvus, SingleStore, DuckDB, Spark, Trino, Athena, MSSQL, Hazelcast
- **8 dedicated PR-triggered integration workflows**: local, cloud, DuckDB, Ray, registration, RBAC, dbt, REST API
- **Operator E2E tests** using Kind cluster with real Kubernetes deployment
- **Label-gated execution** (`ok-to-test`, `approved`, `lgtm`) to prevent unnecessary CI runs
- **Container services** in CI: Redis with health checks for integration tests
- **Cloud provider integration**: GCP, AWS credentials configured for realistic testing
- **Nightly CI** (`nightly-ci.yml`) for comprehensive testing beyond PR scope
- **REST API tests** with Kind cluster deployment for registry API validation

**Gaps**:
- Integration tests require label approval, meaning they don't run automatically on every PR
- No multi-version Kubernetes testing in operator E2E (only `v1.30.6`)

### Build Integration

**Score: 7.0/10**

**Strengths**:
- **Docker smoke tests on PRs** (`docker_smoke_tests.yml`) — builds and validates feature server images
- **Multi-arch build support**: amd64 and arm64 via Docker Buildx and QEMU
- **Health endpoint validation**: Smoke tests verify `/health` endpoint becomes ready
- **Multiple image targets**: feature-server, feature-transformation-server, feast-operator, go-feature-server
- **Operator PR tests** (`operator_pr.yml`) — runs operator unit tests and checks for uncommitted diffs
- **Comprehensive Makefile targets** for all Docker builds with platform support

**Gaps**:
- No Konflux build simulation in PR workflows
- Docker smoke tests only trigger on specific path changes (not all PRs)
- No operator manifest dry-run validation (`kubectl apply --dry-run`)
- No kustomize build verification in PR workflows

### Image Testing

**Score: 7.5/10**

**Strengths**:
- **Multi-arch Docker smoke tests** for amd64 and arm64
- **Health endpoint validation**: Waits up to 120s for `/health` to become ready
- **UBI9 base images** for operator (`ubi9/go-toolset`, `ubi9/ubi-minimal`) and Python feature server (`ubi9/python-312-minimal`)
- **Multi-stage builds** in operator Dockerfile (builder + runtime)
- **Non-root user** in operator Dockerfile (`USER 65532:65532`)
- **18 Dockerfiles** across the repository for different components
- **.dockerignore** present at root

**Gaps**:
- Go feature server uses `golang:1.25` (debian-based) instead of UBI — inconsistent with other images
- No container health checks (`HEALTHCHECK`) in Dockerfiles (only validated in CI smoke tests)
- No Testcontainers usage for runtime validation
- Java Dockerfiles don't use UBI base images

### Coverage Tracking

**Score: 7.0/10**

**Strengths**:
- **Codecov integration** with `.codecov.yaml` configuration
- **Separate coverage flags**: `python-unit` and `go-feature-server`
- **Coverage generated in CI**: `coverage.xml` for Python, `coverage.out` for Go
- **pyproject.toml coverage config**: Branch coverage enabled, source paths configured, test exclusions
- **Carryforward flags** enabled for incremental coverage tracking
- **PR comments** with layout including reach, diff, flags, files
- **Patch target of 70%** (though informational)

**Gaps**:
- `informational: true` means coverage failures don't block PRs
- No enforced minimum coverage thresholds
- Coverage range set to `50...70` suggesting current coverage is moderate
- `fail_ci_if_error: false` in CI workflow means Codecov upload failures are silently ignored
- No coverage gates for integration tests (only unit tests upload coverage)

### CI/CD Automation

**Score: 8.5/10**

**Strengths**:
- **30 workflow files** covering unit tests, integration, smoke, linting, publishing, security, and releases
- **Concurrency control** on nearly all workflows with `cancel-in-progress: true`
- **Label-gated integration tests** prevent unnecessary expensive CI runs
- **Caching strategies**: uv cache, pip cache, MyPy cache, Hadoop tarball cache, pixi cache
- **Test parallelization**: pytest-xdist with `-n 8` and `-n auto --dist loadgroup`
- **Nightly CI** for comprehensive testing (`nightly-ci.yml` at 08:00 UTC)
- **Nightly SDK releases** for automated pre-release distribution
- **Path-based triggering**: Workflows scoped to relevant directories (e.g., `infra/**` for operator E2E)
- **Multi-OS testing**: Ubuntu and macOS in unit test matrix
- **Security workflow**: Weekly scheduled CodeQL analysis for Python and JavaScript
- **Website PR build** verification before merge

**Gaps**:
- Some workflows use `pull_request_target` which requires careful security review
- No timeout-minutes on all jobs (some have it, some don't)
- `nightly-ci.yml` uses deprecated `set-output` format

### Static Analysis

**Score: 7.0/10**

#### Linting
- **Ruff** for Python linting and formatting (line-length 88, target py310)
- **MyPy** for type checking with caching in CI
- **ESLint** for React UI (`react-app` + `react-app/jest` extends)
- **Pre-commit hooks** with 5 hooks:
  - `format-files`: Ruff check + format on commit
  - `lint-files`: Ruff check + format check on commit
  - `template`: Build templates when template files change
  - `lint-push`: Pre-push lint gate
  - `detect-secrets`: Yelp detect-secrets with baseline
  - `commitlint`: Conventional commit message enforcement
- **Makefile targets**: `lint-python`, `format-python`, `precommit-check`

#### FIPS Compatibility
- **Go**: `math/rand` used in production code (`dynamodbonlinestore.go`, `logger.go`) — not FIPS-compliant
- **Python**: `hashlib.md5` used in Bigtable online store — not FIPS-compliant
- **No FIPS build tags**: No `//go:build fips` or `GOEXPERIMENT=boringcrypto` found
- **Base images**: Operator and Python server use UBI9 (FIPS-capable); Go feature server uses debian-based image (not FIPS-capable)

#### Dependency Alerts
- **No Dependabot configuration** (`.github/dependabot.yml` not found)
- **No Renovate configuration** (`renovate.json` not found)
- Dependencies span 5 ecosystems (pip, gomod, npm, docker, github-actions) without automated update monitoring

### Agent Rules

**Score: 9.5/10**

**Status**: **Exceptional** — One of the best agent rule setups across the analyzed repositories.

**What's Present**:
- **`CLAUDE.md`**: Points to AGENTS.md (redirects to comprehensive documentation)
- **`AGENTS.md`** (4.7KB): Comprehensive entry point with:
  - Project overview and architecture description
  - Development commands for setup, quality, testing, protobuf compilation, and Go development
  - Key technologies and supported backends
  - Agent Skills table with 4 skills and their use cases
  - Code style guidelines (type hints, conventional commits, DCO, ruff/gofmt)
  - Documentation and blog post conventions
  - Contributing workflow
- **`.claude/rules/`** directory with 2 rule files:
  - `feast-components.md`: Path-scoped rule for online stores, offline stores, registry, Go, and operator. Includes testing requirements, SQL registry binary column guidelines, proto compilation reminders, cross-SDK update checks, and documentation location table
  - `feast-skills-maintenance.md`: Path-scoped rule for skills/ and rules/ files. Requires verification against source code before editing skills
- **`skills/`** directory with 4 comprehensive skills:
  - `feast-user-guide`: Working with Feast as a user
  - `feast-dev`: Contributor workflow, setup, tests, Docker, PR process
  - `feast-architecture`: Component internals, data flows, adding backends
  - `feast-testing`: Writing tests, running targeted tests, debugging
- **`skills/references/`**: 3 reference documents (retrieval-and-rag, feature-definitions, configuration)

**Quality Assessment**:
- Rules are **comprehensive**: Cover all test types, component patterns, documentation locations
- Rules are **up-to-date**: Reference current tools (uv, ruff, pixi) and frameworks
- Rules are **actionable**: Specific patterns, examples, file paths, and checklists
- Rules are **framework-specific**: Jest for UI, pytest for Python, Go testing for operator
- Rules include **path-scoping**: Auto-trigger based on which files are being edited
- Rules are **cross-tool compatible**: Work with Claude Code, OpenAI Codex, and other agent tools

**Minor Gap**: No dedicated test creation rule templates (e.g., `unit-test-template.md`), though the `feast-testing` skill largely covers this.

## Recommendations

### Priority 0 (Critical)

1. **Add `.github/dependabot.yml`** covering pip, gomod, npm, docker, and github-actions ecosystems. This is a 1-2 hour task with immediate security benefits.
2. **Enforce Codecov coverage gates** by setting `informational: false` and establishing minimum thresholds for project (e.g., 60%) and patch (70%) coverage.

### Priority 1 (High Value)

3. **Replace `math/rand` with `crypto/rand`** in Go production code (`dynamodbonlinestore.go`, `logger.go`) for FIPS compliance.
4. **Replace `hashlib.md5` with `hashlib.sha256`** in `bigtable.py` for FIPS compliance.
5. **Standardize Go feature server Dockerfile** on UBI9 base image (`registry.access.redhat.com/ubi9/go-toolset`) to match operator and Python server.
6. **Add FIPS build tags** (`//go:build boringcrypto`) and `GOEXPERIMENT=boringcrypto` to Go build configuration.
7. **Add multi-version Kubernetes testing** to operator E2E tests (currently only tests v1.30.6).

### Priority 2 (Nice-to-Have)

8. **Add HEALTHCHECK instructions** to Dockerfiles for container orchestration health monitoring.
9. **Add contract tests** for gRPC API boundaries between feature server and Python SDK.
10. **Add performance regression tests** in CI for feature retrieval latency benchmarking.
11. **Improve Python test-to-code ratio** from 0.37 toward the 0.5 gold standard.
12. **Add Testcontainers** for runtime validation of container images in integration tests.

## Comparison to Gold Standards

| Dimension | feast-dev/feast | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|-----------|----------------|---------------------|-------------------|---------------|
| Unit Tests | 8.0 - Multi-language, matrix CI | 9.0 - Comprehensive frontend/backend | 7.0 - Image-focused | 8.5 - envtest, webhook tests |
| Integration/E2E | 8.5 - 15+ backends, Kind E2E | 9.0 - Multi-layer, contract tests | 8.0 - Multi-version | 9.0 - Multi-version K8s |
| Build Integration | 7.0 - Docker smoke on PR | 8.0 - PR build validation | 7.0 - Image builds | 7.5 - Operator bundle |
| Image Testing | 7.5 - Multi-arch smoke | 7.0 - Basic builds | 9.0 - 5-layer validation | 7.0 - Basic builds |
| Coverage Tracking | 7.0 - Codecov informational | 8.0 - Enforced thresholds | 6.0 - Basic | 8.5 - Enforced gates |
| CI/CD Automation | 8.5 - 30 workflows, caching | 9.0 - Comprehensive, optimized | 8.0 - Well-organized | 8.5 - Matrix testing |
| Static Analysis | 7.0 - Ruff+mypy, no Dependabot | 8.0 - Full stack linting | 7.0 - Basic linting | 8.0 - golangci-lint, Dependabot |
| Agent Rules | 9.5 - Exceptional skills/rules | 8.0 - Comprehensive rules | 3.0 - Minimal | 4.0 - Basic |
| **Overall** | **7.6** | **8.3** | **7.0** | **7.6** |

**Key Differentiator**: Feast has the strongest agent rules of any repository analyzed, with 4 dedicated skills, path-scoped rules, and cross-tool compatibility. Its CI/CD automation with 30 workflows and integration test breadth covering 15+ backends is also exceptional.

## File Paths Reference

### CI/CD Workflows
- `.github/workflows/unit_tests.yml` - Unit tests (Python matrix + Go + UI)
- `.github/workflows/pr_integration_tests.yml` - Cloud integration tests (GCP, AWS)
- `.github/workflows/pr_local_integration_tests.yml` - Local integration tests
- `.github/workflows/pr_duckdb_integration_tests.yml` - DuckDB offline store tests
- `.github/workflows/pr_ray_integration_tests.yml` - Ray integration tests
- `.github/workflows/pr_registration_integration_tests.yml` - Registration tests
- `.github/workflows/pr_remote_rbac_integration_tests.yml` - RBAC tests
- `.github/workflows/operator-e2e-integration-tests.yml` - Operator E2E on Kind
- `.github/workflows/operator_pr.yml` - Operator unit tests
- `.github/workflows/linter.yml` - Python linting + mypy
- `.github/workflows/smoke_tests.yml` - Import smoke tests
- `.github/workflows/docker_smoke_tests.yml` - Docker multi-arch smoke tests
- `.github/workflows/nightly-ci.yml` - Nightly comprehensive tests
- `.github/workflows/security.yml` - CodeQL + dependency security scan
- `.github/workflows/registry-rest-api-tests.yml` - REST API tests on Kind
- `.github/workflows/dbt-integration-tests.yml` - dbt integration tests

### Test Configuration
- `pyproject.toml` - pytest, ruff, mypy, coverage configuration
- `.codecov.yaml` - Codecov configuration with flags
- `.pre-commit-config.yaml` - Pre-commit hooks (ruff, detect-secrets, commitlint)

### Container Images
- `infra/feast-operator/Dockerfile` - Operator (UBI9 multi-stage)
- `sdk/python/feast/infra/feature_servers/multicloud/Dockerfile` - Python feature server (UBI9)
- `go/infra/docker/feature-server/Dockerfile` - Go feature server (debian-based)

### Agent Rules
- `CLAUDE.md` - Redirects to AGENTS.md
- `AGENTS.md` - Comprehensive agent instructions
- `.claude/rules/feast-components.md` - Component-level rules
- `.claude/rules/feast-skills-maintenance.md` - Skills maintenance rules
- `skills/feast-testing/SKILL.md` - Testing skill
- `skills/feast-dev/SKILL.md` - Development skill
- `skills/feast-architecture/SKILL.md` - Architecture skill
- `skills/feast-user-guide/SKILL.md` - User guide skill

### Static Analysis
- `ui/.eslintrc.js` - ESLint for React UI
- `.pre-commit-config.yaml` - Pre-commit hooks
