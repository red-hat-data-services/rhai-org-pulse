---
repository: "red-hat-data-services/feast"
overall_score: 7.4
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Extensive Python unit tests (211 files), Go operator tests (50 files), Java tests (15 files) using pytest, Ginkgo, and JUnit"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Comprehensive integration test suites across stores with operator E2E using Kind clusters and envtest"
  - dimension: "Build Integration"
    score: 7.5
    status: "Tekton/Konflux PR pipelines for operator and feature-server, Docker smoke tests on PR, but Konflux triggered by label/comment only"
  - dimension: "Image Testing"
    score: 7.5
    status: "Docker smoke tests validate health endpoint on multi-arch (amd64/arm64), UBI9 base images, multi-stage builds"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "Go coverprofile generated locally; Java Jacoco present; no codecov integration, no PR coverage gates, no Python coverage tracking"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "33 workflows with concurrency control, caching, matrix strategies, nightly CI, PR-triggered and post-merge pipelines"
  - dimension: "Static Analysis"
    score: 7.5
    status: "Ruff linting + formatting, golangci-lint with 19 linters, pre-commit hooks, Renovate configured, FIPS build tags present but md5 usage found"
  - dimension: "Agent Rules"
    score: 9.0
    status: "CLAUDE.md + AGENTS.md, .claude/rules/ with component and skills maintenance rules, 4 detailed skills covering architecture, testing, dev workflow, and user guide"
critical_gaps:
  - title: "No coverage tracking or enforcement for Python SDK"
    impact: "Test regressions can silently reduce coverage without detection; no PR-level coverage gates"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "FIPS non-compliant crypto usage in Python and Go code"
    impact: "hashlib.md5 in bigtable online store and math/rand in Go server could cause FIPS compliance failures"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "Konflux builds are label/comment-gated, not automatic on PRs"
    impact: "Developers must manually trigger Konflux builds; easy to forget, risking post-merge build failures"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No coverage configuration file (.codecov.yml)"
    impact: "Cannot enforce minimum coverage thresholds or track coverage trends across PRs"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add .codecov.yml with coverage thresholds and PR reporting"
    effort: "2-3 hours"
    impact: "Immediate visibility into coverage changes on every PR"
  - title: "Add pytest-cov to Python unit test workflow"
    effort: "1-2 hours"
    impact: "Generate coverage reports for Python SDK on every PR"
  - title: "Replace hashlib.md5 with hashlib.sha256 in bigtable store"
    effort: "1-2 hours"
    impact: "Remove FIPS non-compliant crypto usage from Python SDK"
  - title: "Replace math/rand with crypto/rand in Go server code"
    effort: "2-3 hours"
    impact: "Remove FIPS non-compliant random number generation"
recommendations:
  priority_0:
    - "Add Python coverage tracking (pytest-cov) with --cov flag in unit_tests.yml and integration test workflows"
    - "Configure .codecov.yml with target thresholds (e.g., 70% project minimum) and patch coverage requirements"
    - "Replace hashlib.md5 calls in sdk/python/feast/infra/online_stores/bigtable.py with FIPS-compliant hashlib.sha256"
    - "Replace math/rand imports in go/ directory with crypto/rand for FIPS compliance"
  priority_1:
    - "Make Tekton/Konflux PR builds automatic (remove label/comment gate) for critical paths"
    - "Add Java coverage reporting (Jacoco) to CI with threshold enforcement"
    - "Add coverage gate to operator Go test target (threshold on cover.out)"
    - "Add timeout-minutes to all PR-triggered workflows to prevent runaway jobs"
  priority_2:
    - "Add ruff lint rules section in pyproject.toml for stricter rule enforcement"
    - "Consider adding a .golangci.yml at root level for Go feature server code"
    - "Add contract tests for Python-to-Go feature server API boundary"
    - "Consider adding performance regression tests for online feature retrieval latency"
---

# Quality Analysis: red-hat-data-services/feast

## Executive Summary

- **Overall Score: 7.4/10**
- **Repository Type**: Polyglot feature store library + Kubernetes operator (Python, Go, Java, TypeScript)
- **Tier**: Downstream (RHOAIENG / Feature Store)
- **Key Strengths**: Excellent test breadth across 4 languages, comprehensive CI/CD with 33 workflows, strong agent rules with 4 dedicated skills, Docker smoke tests with multi-arch validation, FIPS build tags in Konflux Dockerfiles, Renovate configured
- **Critical Gaps**: No Python coverage tracking or enforcement, FIPS non-compliant crypto usage in source code (hashlib.md5, math/rand), Konflux builds require manual triggering via labels
- **Agent Rules Status**: Excellent — CLAUDE.md, AGENTS.md, 2 .claude/rules/, 4 comprehensive skills with reference docs

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 8.5/10 | 15% | Extensive: 211 Python, 50 Go, 15 Java, 3 TS test files |
| Integration/E2E | 8.0/10 | 20% | Comprehensive integration suites + operator E2E with Kind |
| Build Integration | 7.5/10 | 15% | Tekton/Konflux PR pipelines + Docker smoke tests |
| Image Testing | 7.5/10 | 10% | Multi-arch smoke tests, UBI9 base, health endpoint validation |
| Coverage Tracking | 4.0/10 | 10% | Go/Java local coverage only; no Python, no PR gates |
| CI/CD Automation | 8.5/10 | 15% | 33 workflows, concurrency control, caching, nightly CI |
| Static Analysis | 7.5/10 | 10% | Ruff + golangci-lint + pre-commit + Renovate; FIPS gaps |
| Agent Rules | 9.0/10 | 5% | CLAUDE.md + AGENTS.md + 2 rules + 4 skills + references |

## Critical Gaps

### 1. No Python Coverage Tracking or Enforcement
- **Impact**: The Python SDK is the primary codebase (~600 source files, 211 test files) but has no coverage measurement in CI. Test regressions can silently reduce coverage without detection.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Neither `pytest-cov` nor `--cov` flags are used in `unit_tests.yml` or any PR workflow. No `.codecov.yml` exists. Go operator generates `cover.out` locally but doesn't report to any service. Java has Jacoco but it's not integrated with PR reporting.

### 2. FIPS Non-Compliant Crypto Usage
- **Impact**: Production code uses FIPS-prohibited cryptographic primitives that will fail FIPS compliance validation.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**:
  - **Python**: `hashlib.md5` used in `sdk/python/feast/infra/online_stores/bigtable.py` (lines 288, 298) for entity key hashing
  - **Go**: `math/rand` imported in `go/internal/feast/onlinestore/dynamodbonlinestore.go`, `go/internal/feast/server/logging/logger.go`, and test files
  - **Positive**: Konflux Dockerfiles correctly use `GOEXPERIMENT=strictfipsruntime` and `-tags strictfipsruntime` for the operator build

### 3. Konflux Builds Not Automatic on PRs
- **Impact**: Developers must manually trigger Konflux builds by adding labels (`kfbuild-all`, `kfbuild-feast-operator`) or comments (`/build-konflux feast-operator`). This creates risk of forgetting to validate Konflux builds before merge.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: Tekton PipelineRun definitions in `.tekton/` use `on-label` and `on-comment` triggers rather than automatic `on-event: [pull_request]` triggers

### 4. No Coverage Configuration File
- **Impact**: Cannot enforce minimum coverage thresholds or track trends
- **Severity**: MEDIUM
- **Effort**: 2-3 hours

## Quick Wins

### 1. Add .codecov.yml with Coverage Thresholds
- **Effort**: 2-3 hours
- **Impact**: Immediate visibility into coverage changes on every PR
- **Implementation**:
```yaml
# .codecov.yml
coverage:
  status:
    project:
      default:
        target: 70%
        threshold: 2%
    patch:
      default:
        target: 80%
comment:
  layout: "reach,diff,flags,files"
  behavior: default
```

### 2. Add pytest-cov to Python Unit Test Workflow
- **Effort**: 1-2 hours
- **Impact**: Generate and upload Python coverage on every PR
- **Implementation**: Add `--cov=feast --cov-report=xml` to pytest invocation in `unit_tests.yml` and add codecov upload step

### 3. Replace hashlib.md5 with hashlib.sha256
- **Effort**: 1-2 hours
- **Impact**: Remove FIPS-prohibited MD5 usage in bigtable online store
- **File**: `sdk/python/feast/infra/online_stores/bigtable.py`

### 4. Replace math/rand with crypto/rand in Go Code
- **Effort**: 2-3 hours
- **Impact**: Remove FIPS-prohibited random number generation
- **Files**: `go/internal/feast/onlinestore/dynamodbonlinestore.go`, `go/internal/feast/server/logging/logger.go`

## Detailed Findings

### Unit Tests

**Score: 8.5/10**

The repository has excellent unit test breadth across all four languages:

| Language | Test Files | Source Files | Test-to-Code Ratio | Framework |
|----------|-----------|-------------|---------------------|-----------|
| Python | 211 | 600 | 0.35 | pytest |
| Go | 50 | 68 | 0.74 | Ginkgo + envtest |
| Java | 15 | 43 | 0.35 | JUnit + Testcontainers |
| TypeScript | 3 | 225 | 0.01 | Jest/Vitest |

**Strengths**:
- Python tests well-organized into `unit/` and `integration/` with clear subdirectories per component
- Go operator tests use `envtest` for realistic Kubernetes API testing
- Multi-Python-version matrix (3.10, 3.11, 3.12) with cross-OS (Ubuntu, macOS) testing
- Well-structured conftest.py with shared fixtures
- Test isolation via mocking (unittest.mock) and pytest fixtures

**Gaps**:
- TypeScript/UI test coverage is minimal (3 test files for 225 source files)
- No explicit test isolation patterns like `t.Parallel()` in Go tests (uses Ginkgo's `Ordered`)

### Integration/E2E Tests

**Score: 8.0/10**

**Strengths**:
- Comprehensive integration test ecosystem with 7+ dedicated PR integration workflows:
  - `pr_integration_tests.yml` — full integration with Redis, cloud stores
  - `pr_local_integration_tests.yml` — containerized store stubs
  - `pr_duckdb_integration_tests.yml` — DuckDB offline store
  - `pr_ray_integration_tests.yml` — Ray compute engine
  - `pr_registration_integration_tests.yml` — feature registration
  - `pr_remote_rbac_integration_tests.yml` — RBAC functionality
  - `registry-rest-api-tests.yml` — REST API with Kind cluster
- Operator E2E tests deploy to Kind clusters with realistic CRD lifecycle
- Integration tests cover multi-store backends (Redis, DynamoDB, Bigtable, PostgreSQL, DuckDB)
- `conftest.py` provides sophisticated test fixtures with data source parametrization
- Nightly CI runs comprehensive cloud integration tests (AWS, GCP)

**Gaps**:
- Most integration tests are label-gated (`ok-to-test`, `approved`, `lgtm`) — appropriate for security but may slow feedback
- No multi-version Kubernetes testing in operator E2E (fixed to v1.30.6)
- Java integration tests (`ServingRedis*RegistryIT`) exist but aren't clearly wired into PR workflows

### Build Integration

**Score: 7.5/10**

**Strengths**:
- Tekton/Konflux PR pipelines for both feast-operator and feature-server components
- Multi-architecture builds: x86_64, arm64, ppc64le via Konflux
- Hermetic builds with prefetch-input for Go modules and pip packages
- Docker smoke tests on PR validate feature-server builds for amd64 and arm64
- Operator `make test` in `operator_pr.yml` runs on every PR unconditionally
- `registry-rest-api-tests.yml` builds operator image, deploys to Kind, runs REST API tests

**Gaps**:
- Konflux Tekton builds are label/comment-gated, not automatic
- No PR-time Kustomize overlay validation in GitHub Actions (only in Konflux pipeline)
- Docker smoke tests only run on path changes to feature server code, not on all PRs

**Key Files**:
- `.tekton/odh-feast-operator-pull-request.yaml` — Konflux operator build
- `.tekton/odh-feature-server-pull-request.yaml` — Konflux feature-server build
- `.github/workflows/docker_smoke_tests.yml` — PR docker smoke tests
- `.github/workflows/operator_pr.yml` — Operator tests on every PR

### Image Testing

**Score: 7.5/10**

**Strengths**:
- Docker smoke tests build and run feature-server image, validate `/health` endpoint
- Multi-arch testing: amd64 and arm64 via QEMU in GitHub Actions
- Konflux builds test x86_64, arm64, and ppc64le
- UBI9 base images for both operator (`ubi9/go-toolset`, `ubi9/ubi-minimal`) and feature-server (`ubi9/python-312`, `ubi9/python-312-minimal`)
- Multi-stage builds in Konflux Dockerfiles for smaller runtime images
- Liveness and readiness probes defined in operator manifests
- Power (ppc64le) architecture-specific handling in feature-server Dockerfile

**Gaps**:
- No `HEALTHCHECK` instruction in Dockerfiles themselves (probes are in K8s manifests only)
- No Testcontainers usage for container-level integration testing
- Docker smoke tests only cover the upstream feature-server Dockerfiles, not the Konflux downstream Dockerfiles

### Coverage Tracking

**Score: 4.0/10**

**Strengths**:
- Go operator: `make test` generates `cover.out` via `go test -coverprofile`
- Go feature server: `make test-go` generates `coverage.out` with HTML report
- Java: `test-java-with-coverage` target uses Jacoco for coverage reports

**Gaps**:
- **No Python coverage tracking at all** — the primary codebase (~600 source files) has zero coverage measurement in CI
- No `.codecov.yml` or `coveralls.yml` configuration
- No `pytest-cov` or `--cov` flag used in any CI workflow
- Go coverage is generated locally but not uploaded or enforced
- No PR coverage comment bots or gates
- No coverage trend tracking across time
- Java Jacoco reports generated but not uploaded or enforced

### CI/CD Automation

**Score: 8.5/10**

**Strengths**:
- 33 workflow files covering unit tests, integration, E2E, linting, Docker, publishing, nightly CI, and release
- Concurrency control on all PR-triggered workflows (cancel-in-progress)
- Caching: uv cache, pixi cache, npm cache, pip cache across workflows
- Matrix strategies for multi-Python-version and multi-OS testing
- Nightly CI runs comprehensive integration tests daily at 08:00 UTC (only if commits in last 24h)
- Separate workflows for different integration test scopes (local, cloud, DuckDB, Ray, RBAC)
- PR title linting via commitlint enforces semantic commit conventions
- Pre-commit hooks run in CI via `pre-commit/action`
- Tekton/Konflux pipelines complement GitHub Actions for downstream builds

**Gaps**:
- Only 4 workflows have explicit `timeout-minutes` — most can run indefinitely
- No explicit test parallelization (no `pytest-xdist -n` in CI, though `pytest-xdist` is a dev dependency)
- Nightly CI concurrency control is commented out due to a known GitHub Actions runner issue

### Static Analysis

**Score: 7.5/10**

#### Linting
- **Python**: Ruff configured in `pyproject.toml` for formatting and linting (line-length 88, target py310). Pre-commit hooks run ruff check + format on commit and lint on push.
- **Go Operator**: `.golangci.yml` with 19 linters enabled: dupl, errcheck, ginkgolinter, goconst, gocyclo, govet, ineffassign, lll, misspell, nakedret, prealloc, revive, staticcheck, unconvert, unparam, unused + formatters (gofmt, goimports)
- **Go Feature Server**: No `.golangci.yml` at root level; uses `gofmt` via Makefile
- **TypeScript/UI**: No ESLint configuration found
- **Java**: No explicit linter configuration found (relies on Maven conventions)

#### Pre-commit Hooks
- `.pre-commit-config.yaml` with:
  - Ruff format + check on commit
  - Ruff lint gate on push
  - Template build validation
  - Secret detection (detect-secrets with baseline)
  - Commitlint for commit message format

#### FIPS Compatibility
- **Build Config** (Positive):
  - Operator Konflux Dockerfile uses `GOEXPERIMENT=strictfipsruntime` and `-tags strictfipsruntime`
  - `CGO_ENABLED=1` properly set for FIPS-compliant builds
  - UBI9 base images (FIPS-capable)
- **Source Code** (Issues):
  - `hashlib.md5` used in `sdk/python/feast/infra/online_stores/bigtable.py` (lines 288, 298)
  - `math/rand` used in `go/internal/feast/onlinestore/dynamodbonlinestore.go` and `go/internal/feast/server/logging/logger.go`
  - No FIPS build tags in Go feature server build (only in operator)

#### Dependency Alerts
- **Renovate**: Configured in `.github/renovate.json` extending `red-hat-data-services/konflux-central` defaults
- **Dependabot**: Not configured (Renovate covers this need)

### Agent Rules

**Score: 9.0/10**

This repository has one of the most comprehensive agent rule configurations observed:

**Files Present**:
- `CLAUDE.md` — references AGENTS.md
- `AGENTS.md` — 120-line entry point with project overview, dev commands, skills table, code style, contributing guidelines
- `.claude/rules/feast-components.md` — component-specific rules with testing, documentation, and skills update checklists
- `.claude/rules/feast-skills-maintenance.md` — meta-rules for keeping skills synchronized with the codebase
- `.cursor/rules/feast-components.mdc` — mirror of Claude rules for Cursor
- `.cursor/rules/feast-skills-maintenance.mdc` — mirror for Cursor

**Skills** (4 comprehensive skills in `skills/` and `.claude/skills/`):
1. `feast-user-guide` — Feast user workflow (features, CLI, RAG)
2. `feast-dev` — contributor workflow (setup, tests, PR process)
3. `feast-architecture` — component internals and data flows
4. `feast-testing` — test patterns, debugging, targeted test execution

**Reference Docs** (3 reference files in `skills/references/`):
- `configuration.md`, `feature-definitions.md`, `retrieval-and-rag.md`

**Strengths**:
- Tool-agnostic skills (compatible with Claude Code, Codex, other agents)
- Cross-IDE rule sync (`.claude/rules/` and `.cursor/rules/` kept in parity)
- Skills cover all major use cases: user guide, development, architecture, testing
- Skills-maintenance meta-rule ensures skills stay up-to-date with code changes
- Reference docs provide quick lookup for common operations

**Gaps**:
- No explicit rules for integration test patterns or E2E test creation
- Skills are all read-only reference material; no interactive skill workflows

## Recommendations

### Priority 0 (Critical)

1. **Add Python coverage tracking**: Add `pytest-cov` with `--cov=feast --cov-report=xml` to `unit_tests.yml` and configure codecov upload. This is the single highest-impact improvement.

2. **Configure .codecov.yml**: Set project coverage target (70%) and patch coverage target (80%) with PR comment reporting.

3. **Fix FIPS-prohibited hashlib.md5**: Replace `hashlib.md5` with `hashlib.sha256` in `sdk/python/feast/infra/online_stores/bigtable.py`. Ensure hash truncation still produces sufficient uniqueness.

4. **Fix FIPS-prohibited math/rand**: Replace `math/rand` imports in Go source files with `crypto/rand` for production code paths. Test files using `math/rand` for data generation are acceptable.

### Priority 1 (High Value)

5. **Auto-trigger Konflux builds on PRs**: Change Tekton annotations from `on-label`/`on-comment` to automatic `on-event: [pull_request]` for critical paths, or at minimum add a required check in branch protection.

6. **Add timeout-minutes to all PR workflows**: Most workflows lack timeouts. Add `timeout-minutes: 30` (or appropriate value) to prevent stuck jobs.

7. **Enable pytest-xdist in CI**: The `pytest-xdist` dependency exists but isn't used in CI. Add `-n auto` flag to parallelize Python tests.

8. **Add Go operator coverage enforcement**: Add coverage threshold check to `infra/feast-operator/Makefile` test target (e.g., `go tool cover -func=cover.out | grep total | awk '{if ($3+0 < 70) exit 1}'`).

### Priority 2 (Nice-to-Have)

9. **Add ruff lint rules**: Configure `[tool.ruff.lint]` section with explicit rule selection (e.g., E, F, I, N, W, UP rules).

10. **Add root-level .golangci.yml for Go feature server**: The Go feature server code under `go/` has no golangci-lint config, unlike the operator.

11. **Add UI test coverage**: The TypeScript UI has 225 source files but only 3 test files. Add tests for key components.

12. **Add contract tests**: Consider adding contract tests for the Python-to-Go feature server API boundary.

## Comparison to Gold Standards

| Dimension | feast | odh-dashboard | notebooks | kserve |
|-----------|-------|---------------|-----------|--------|
| Unit Tests | 8.5 | 9.0 | 7.0 | 8.5 |
| Integration/E2E | 8.0 | 8.5 | 7.5 | 9.0 |
| Build Integration | 7.5 | 8.0 | 8.5 | 7.5 |
| Image Testing | 7.5 | 7.0 | 9.0 | 7.0 |
| Coverage Tracking | 4.0 | 8.5 | 6.0 | 8.5 |
| CI/CD Automation | 8.5 | 9.0 | 8.0 | 8.5 |
| Static Analysis | 7.5 | 8.0 | 7.0 | 7.5 |
| Agent Rules | 9.0 | 8.0 | 3.0 | 4.0 |
| **Overall** | **7.4** | **8.4** | **7.2** | **7.8** |

**Key Differentiators**:
- Feast has the best agent rules of any analyzed repo — 4 skills with reference docs, cross-IDE sync
- Feast's CI/CD is comprehensive with 33 workflows but lacks coverage tracking that kserve and odh-dashboard have
- Image testing is strong with Docker smoke tests but doesn't match notebooks' 5-layer validation approach
- FIPS compliance is partially addressed (build tags yes, source code has prohibited imports)

## File Paths Reference

### CI/CD
- `.github/workflows/unit_tests.yml` — Python & Go & TS unit tests
- `.github/workflows/linter.yml` — Ruff linting + pre-commit
- `.github/workflows/lint_pr.yml` — PR title validation
- `.github/workflows/pr_integration_tests.yml` — Full integration tests
- `.github/workflows/pr_local_integration_tests.yml` — Local integration with containers
- `.github/workflows/pr_duckdb_integration_tests.yml` — DuckDB offline store tests
- `.github/workflows/pr_ray_integration_tests.yml` — Ray compute engine tests
- `.github/workflows/pr_registration_integration_tests.yml` — Feature registration tests
- `.github/workflows/pr_remote_rbac_integration_tests.yml` — RBAC tests
- `.github/workflows/operator_pr.yml` — Operator unit tests
- `.github/workflows/operator-e2e-integration-tests.yml` — Operator E2E with Kind
- `.github/workflows/registry-rest-api-tests.yml` — REST API tests with Kind
- `.github/workflows/docker_smoke_tests.yml` — Docker image smoke tests
- `.github/workflows/smoke_tests.yml` — Basic import smoke tests
- `.github/workflows/nightly-ci.yml` — Nightly comprehensive CI
- `.github/workflows/master_only.yml` — Post-merge integration tests
- `.tekton/odh-feast-operator-pull-request.yaml` — Konflux operator build
- `.tekton/odh-feature-server-pull-request.yaml` — Konflux feature-server build

### Testing
- `sdk/python/tests/unit/` — Python unit tests (~160+ files)
- `sdk/python/tests/integration/` — Python integration tests (16 subdirectories)
- `go/internal/feast/` — Go feature server tests
- `infra/feast-operator/internal/controller/` — Operator controller tests (envtest)
- `infra/feast-operator/test/e2e/` — Operator E2E tests (Kind)
- `infra/feast-operator/test/api/` — API type tests
- `java/serving/src/test/` — Java serving tests

### Static Analysis
- `.pre-commit-config.yaml` — Ruff format/lint, detect-secrets, commitlint
- `pyproject.toml` — Ruff config (format + lint)
- `infra/feast-operator/.golangci.yml` — 19-linter golangci-lint config
- `.github/renovate.json` — Renovate dependency management
- `.commitlintrc.yaml` — Semantic commit format rules

### Container Images
- `Dockerfiles/Dockerfile.feast-operator.konflux` — Operator Konflux Dockerfile (UBI9, FIPS-enabled)
- `Dockerfiles/Dockerfile.feature-server.konflux` — Feature-server Konflux Dockerfile (UBI9, multi-stage)
- `.dockerignore` — Docker build exclusions

### Agent Rules
- `CLAUDE.md` — Agent entry point (references AGENTS.md)
- `AGENTS.md` — Comprehensive agent instructions
- `.claude/rules/feast-components.md` — Component change checklists
- `.claude/rules/feast-skills-maintenance.md` — Skills sync rules
- `.claude/skills/feast-architecture/SKILL.md` — Architecture internals
- `.claude/skills/feast-testing/SKILL.md` — Test patterns
- `.claude/skills/feast-dev/SKILL.md` — Dev workflow
- `.claude/skills/feast-user-guide/SKILL.md` — User guide
- `skills/references/` — Quick reference docs
