---
repository: "kubeflow/hub"
overall_score: 7.4
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Strong Go test suite (171 files) with testify; TS/Python coverage growing; no t.Parallel() usage"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Excellent E2E with Kind clusters, multi-K8s-version matrix, multi-DB (MySQL/Postgres), fuzz testing"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-time image builds with Kind deployment and Python client validation; kustomize overlay testing"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage UBI-based builds, multi-arch support, Kind deployment validation; limited runtime health checks"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "Makefile has coverprofile targets but no codecov integration, no PR reporting, no threshold enforcement"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "33 workflows, well-organized PR triggers with path filtering, matrix strategies; limited concurrency control"
  - dimension: "Static Analysis"
    score: 7.5
    status: "golangci-lint v2, ruff+mypy for Python, ESLint for TS, pre-commit hooks, Dependabot across all ecosystems"
  - dimension: "Agent Rules"
    score: 9.0
    status: "Comprehensive AGENTS.md (392 lines), CLAUDE.md symlink, custom skills for catalog workflows"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Coverage regressions go undetected; no visibility into test coverage trends across PRs"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No Go test parallelization (t.Parallel)"
    impact: "Test suite runs serially, slower feedback; missing race condition detection"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "No concurrency control on most PR workflows"
    impact: "Multiple CI runs for rapid PR updates waste resources; potential for stale results"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add Codecov integration with PR reporting"
    effort: "3-4 hours"
    impact: "Immediate visibility into coverage trends, regressions caught at PR time"
  - title: "Add concurrency groups to PR-triggered workflows"
    effort: "1-2 hours"
    impact: "Cancel stale CI runs on new pushes, save compute resources"
  - title: "Add timeout-minutes to all workflows"
    effort: "1 hour"
    impact: "Prevent hung jobs from consuming resources indefinitely"
recommendations:
  priority_0:
    - "Implement Codecov integration with coverage thresholds and PR commenting for all three languages"
    - "Add coverprofile flags to Go test CI steps and cov-report to Python test steps"
  priority_1:
    - "Enable t.Parallel() in Go unit tests and run with -race flag for concurrency safety"
    - "Add concurrency control groups to all PR-triggered workflows"
    - "Add container health checks (HEALTHCHECK) to all Dockerfiles, not just async-upload"
  priority_2:
    - "Add golangci-lint config file (.golangci.yml) at repo root for consistent linting across all Go modules"
    - "Add timeout-minutes to all workflow jobs"
    - "Consider adding Cypress/Playwright E2E tests for the UI frontend"
---

# Quality Analysis: kubeflow/hub

## Executive Summary

- **Overall Score: 7.4/10**
- **Repository Type**: Polyglot application (Go server + Python client + TypeScript UI)
- **Jira**: RHOAIENG / AI Hub (upstream tier)
- **Key Strengths**: Exceptional E2E testing infrastructure with multi-version K8s/multi-DB matrix, comprehensive PR-time image build validation with Kind deployment, excellent agent rules (AGENTS.md + custom skills), strong static analysis coverage across all three languages
- **Critical Gaps**: No coverage tracking or enforcement (no Codecov, no thresholds, no PR reporting), no Go test parallelization
- **Agent Rules Status**: Present and comprehensive — 392-line AGENTS.md with custom catalog skills

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 7.5/10 | 15% | Strong Go test suite (171 files, testify), 63 TS tests, 39 Python tests; no t.Parallel() |
| Integration/E2E | 9.0/10 | 20% | Multi-K8s-version, multi-DB Kind cluster E2E with fuzz testing |
| Build Integration | 8.0/10 | 15% | PR image builds → Kind deploy → Python client validation |
| Image Testing | 7.0/10 | 10% | Multi-stage UBI builds, multi-arch; limited health checks |
| Coverage Tracking | 3.0/10 | 10% | Makefile targets exist but no CI integration or enforcement |
| CI/CD Automation | 8.0/10 | 15% | 33 workflows, path-filtered triggers, matrix strategies |
| Static Analysis | 7.5/10 | 10% | golangci-lint, ruff, mypy, ESLint, pre-commit, Dependabot |
| Agent Rules | 9.0/10 | 5% | AGENTS.md (392 lines), CLAUDE.md symlink, 5 custom skills |

**Weighted Score: 7.4/10**

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Severity**: HIGH
- **Impact**: Coverage regressions go undetected; no visibility into test coverage trends across PRs. Developers have no feedback on whether their changes are adequately tested.
- **Effort**: 4-6 hours
- **Details**: The Makefile has `test-cover` and `controller/test` targets that generate `coverprofile` output, but this data is never uploaded to a coverage service. No `.codecov.yml`, no codecov GitHub Action, no coverage threshold enforcement. Python E2E tests generate `--cov-report=xml` but it's not uploaded either.

### 2. No Go Test Parallelization
- **Severity**: MEDIUM
- **Impact**: 171 Go test files run serially, leading to slower CI feedback. Missing `t.Parallel()` also means the `-race` detector is less effective at finding concurrency bugs.
- **Effort**: 8-12 hours
- **Details**: Zero uses of `t.Parallel()` across all 171 Go test files. Given that this is a server application with concurrent request handling, race condition testing is important.

### 3. Limited Concurrency Control in CI
- **Severity**: MEDIUM
- **Impact**: Rapid PR updates trigger multiple full CI runs that waste compute and can produce stale results.
- **Effort**: 2-3 hours
- **Details**: Only 1 of 33 workflows (`gh-workflow-approve.yml`) uses `concurrency:` groups with `cancel-in-progress`. All PR-triggered workflows should cancel superseded runs.

## Quick Wins

### 1. Add Codecov Integration (3-4 hours)
- **Impact**: Immediate visibility into coverage trends and regression detection
- **Implementation**:
  ```yaml
  # Add to build.yml after test step
  - name: Upload coverage
    uses: codecov/codecov-action@v4
    with:
      files: coverage.txt
      flags: go-unit
      token: ${{ secrets.CODECOV_TOKEN }}
  ```
  Also add `.codecov.yml` with minimum threshold:
  ```yaml
  coverage:
    status:
      project:
        default:
          target: auto
          threshold: 2%
      patch:
        default:
          target: 80%
  ```

### 2. Add Concurrency Groups to PR Workflows (1-2 hours)
- **Impact**: Cancel stale CI runs, save compute resources
- **Implementation**: Add to all PR-triggered workflows:
  ```yaml
  concurrency:
    group: ${{ github.workflow }}-${{ github.head_ref || github.ref }}
    cancel-in-progress: true
  ```

### 3. Add timeout-minutes to All Workflows (1 hour)
- **Impact**: Prevent hung jobs from consuming resources indefinitely
- **Implementation**: Add `timeout-minutes: 30` (or appropriate value) to all job definitions.

## Detailed Findings

### Unit Tests

**Score: 7.5/10**

**Go (Primary Language)**:
- **171 test files** against 520 source files — test-to-code file ratio of ~33%
- Uses `testify` framework (116 files import it) via `github.com/stretchr/testify`
- Strong coverage of core business logic: `internal/core/` has tests for all entity types (registered_model, model_version, artifact, experiment, etc.)
- Database service layer (`internal/db/service/`) thoroughly tested with sqlmock
- Converter layer (`internal/converter/`) has dedicated test files
- Server middleware tested (`validation_test.go`, `router_test.go`)
- **Gap**: Zero `t.Parallel()` usage — all tests run serially
- **Gap**: No `-race` flag usage detected in CI

**TypeScript (UI Frontend)**:
- **63 test files** against 404 source files — ratio of ~16%
- Uses Jest framework (`jest.config.js`)
- Good coverage of hooks, API services, shared components, and utility functions
- Tests cover contexts (ModelCatalog, McpCatalog, AgentsCatalog)
- Component tests include `.spec.tsx` files for React components

**Python (Client Libraries)**:
- **39 test files** covering Python client, async-upload job, CSV exporter, and catalog client
- Uses pytest (via nox sessions)
- Client tests cover core functionality, connections, token handling, packaging, experiments
- Async-upload has dedicated unit + integration tests
- **Strength**: Regression tests exist (`regression_test.py`)

**Key Files**:
- `internal/core/*_test.go` — Core business logic tests
- `internal/db/service/*_test.go` — Database layer tests
- `clients/ui/frontend/src/**/__tests__/` — UI component tests
- `clients/python/tests/` — Python client tests

### Integration/E2E Tests

**Score: 9.0/10**

This is a standout dimension. The repository has exceptional E2E testing infrastructure:

**Python Client E2E** (`python-tests.yml`):
- Multi-K8s-version matrix: `v1.33.7`, `v1.34.3`
- Multi-database matrix: MySQL (`db`) and PostgreSQL (`postgres`)
- Multi-Python-version: 3.10, 3.11, 3.12, 3.13, 3.14
- Full Kind cluster deployment with image build → load → deploy → port-forward → test
- Minio deployment for object storage testing
- OCI registry deployment for container registry testing
- **Fuzz testing**: Runs on main merges and PRs with OpenAPI changes

**CSI E2E** (`csi-test.yml`):
- Builds both server and CSI images
- Deploys to Kind with kustomize
- Runs full E2E test script (`test/csi/e2e_test.sh`)
- Uses Helm for infrastructure setup

**Async-Upload E2E** (`async-upload-test.yml`):
- Unit tests, integration tests, and full E2E tests
- Separate jobs for different test scopes

**Catalog E2E** (in `python-tests.yml`):
- Dedicated catalog E2E job
- Builds catalog image → loads into Kind → deploys → tests
- Coverage report generation with `--cov-report=xml`

**Controller Tests** (`controller-test.yml`):
- Uses `envtest` for Kubernetes API testing
- Tests CRD installation and controller logic

**Key Patterns**:
- `helm/kind-action` for cluster provisioning
- `kustomize` overlays for environment-specific deployment
- Port-forwarding for service access in tests
- Image build → Kind load → deploy → validate pipeline

### Build Integration

**Score: 8.0/10**

**PR-Time Build Validation** (`build-image-pr.yml`):
- Builds Docker image on every PR
- Starts a Kind cluster (`kindest/node:v1.33.7`)
- Loads the image into Kind
- Deploys using `scripts/deploy_on_kind.sh` with kustomize
- Validates with Python client connection test
- Comprehensive path-filtered triggers

**UI PR Build** (`build-image-ui-pr.yml`):
- Builds UI container image on PRs touching `clients/ui/`
- Validates both frontend and BFF build success

**Build Workflow** (`build.yml`):
- Runs `make clean build/prepare` for Go compilation
- Verifies no uncommitted file changes (autogen check)

**UI Workflows**:
- `ui-frontend-build.yml`: Runs npm tests + build on PRs
- `ui-bff-build.yml`: Runs Go lint + build + OpenAPI spec generation

**Schema Validation**:
- `check-db-schema-structs.yaml`: Validates MySQL and PostgreSQL schema struct generation
- `check-openapi-spec-pr.yaml`: Validates OpenAPI spec on PRs
- `check-gitattributes.yaml`: Validates .gitattributes file
- `go-mod-tidy-diff-check.yml`: Ensures go.mod/go.sum are tidy

**Multi-Image Builds** (push/tag only):
- Server, controller, CSI, UI, UI-standalone, async-upload — 6 separate image build workflows
- All use multi-arch: `linux/arm64,linux/amd64`
- GHA cache for Docker layers (`cache-from: type=gha`)

**Key Strength**: The PR build pipeline goes beyond just building — it deploys to Kind and validates with a client connection test, catching integration issues before merge.

### Image Testing

**Score: 7.0/10**

**Dockerfiles** (7 total):
- `Dockerfile` — Main server (multi-stage, UBI9, multi-arch)
- `Dockerfile.odh` — ODH variant (UBI9, single-arch amd64)
- `cmd/controller/Dockerfile.controller` — Controller (multi-stage, UBI9, multi-arch)
- `cmd/csi/Dockerfile.csi` — CSI storage initializer (multi-stage, UBI9, multi-arch)
- `clients/ui/Dockerfile` — UI + BFF (3-stage: Node → Go → distroless)
- `clients/ui/Dockerfile.standalone` — UI standalone
- `jobs/async-upload/Dockerfile` — Async upload job (UBI9 Python)

**Strengths**:
- All Go images use UBI9 base images (FIPS-capable)
- Multi-stage builds for all Go images
- Multi-architecture support (`BUILDPLATFORM`/`TARGETPLATFORM` args) for main images
- Non-root user (`65532:65532`) in all images
- Layer caching optimization (copy go.mod first, then source)
- `.dockerignore` present

**Gaps**:
- Only `jobs/async-upload/Dockerfile` has a `HEALTHCHECK` instruction
- UI Dockerfile uses `node:22` and `gcr.io/distroless/static:nonroot` — not UBI-based
- No container runtime validation tests (Testcontainers or equivalent)
- No image scanning integration in PR workflows

### Coverage Tracking

**Score: 3.0/10**

**What Exists**:
- Makefile target `test-cover` generates `coverprofile=coverage.txt` and HTML report
- Controller tests generate `coverprofile cover.out`
- Python E2E tests generate `--cov-report=xml`

**What's Missing**:
- No `.codecov.yml` or coverage service configuration
- No `codecov/codecov-action` in any workflow
- No coverage thresholds or minimum requirements
- No PR coverage comments or status checks
- Coverage data is generated but never uploaded or tracked
- No coverage gates preventing regressions

This is the weakest dimension and represents a significant gap for a project of this size and maturity.

### CI/CD Automation

**Score: 8.0/10**

**Workflow Inventory** (33 workflows):

| Trigger | Workflows |
|---------|-----------|
| PR-triggered | build.yml, build-image-pr.yml, build-image-ui-pr.yml, python-tests.yml, controller-test.yml, csi-test.yml, async-upload-test.yml, ui-frontend-build.yml, ui-bff-build.yml, check-db-schema-structs.yaml, check-gitattributes.yaml, check-openapi-spec-pr.yaml, go-mod-tidy-diff-check.yml, check-owners.yml, labeler.yml, first-time-contributor-pr.yml, gh-workflow-approve.yml |
| Push/Tag only | build-and-push-image.yml, build-and-push-controller-image.yml, build-and-push-csi-image.yml, build-and-push-ui-images.yml, build-and-push-ui-images-standalone.yml, build-and-push-async-upload.yml, python-release.yml |
| Scheduled | go-generate.yml (weekly), stale.yaml (daily), scorecard.yml (weekly) |
| Manual only | test-fuzz.yml (workflow_dispatch) |

**Strengths**:
- Comprehensive PR validation: build, test, lint, schema checks
- Smart path filtering: workflows trigger only for relevant file changes
- Matrix strategies: Python versions, K8s versions, database engines
- Image build caching: GHA cache (`cache-from: type=gha, cache-to: type=gha,mode=max`)
- Go module caching in some workflows
- Pinned action versions with SHA hashes (security best practice)
- OpenSSF Scorecard integration

**Gaps**:
- Only 1 workflow uses `concurrency:` groups (should be on all PR workflows)
- No `timeout-minutes` on any job
- No test parallelization/sharding for large test suites
- Fuzz testing is manual-only (workflow_dispatch) rather than automated on main

### Static Analysis

**Score: 7.5/10**

#### Linting

**Go**:
- golangci-lint v2.12.2 used in Makefile (`make lint`) and UI BFF workflow
- `golangci/golangci-lint-action@v9` in `ui-bff-build.yml`
- BFF has its own `.golangci.yaml` config
- **Gap**: No `.golangci.yml` at repo root; Makefile runs lint without a config file

**Python**:
- `ruff` (v0.5.2+) with extensive rule set: pyflakes, pycodestyle, isort, bandit, comprehensions, return, simplify
- `mypy` (v1.7+) for type checking
- Both integrated via nox sessions in `python-tests.yml`

**TypeScript**:
- ESLint with `@typescript-eslint/parser`
- Plugins: react-hooks, import, no-only-tests, no-relative-import-paths, prettier
- Extends: jsx-a11y, react, @typescript-eslint recommended

#### FIPS Compatibility

- **No FIPS concerns detected**: No imports of `crypto/md5`, `crypto/des`, `crypto/rc4`, or `math/rand` in Go code
- **UBI9 base images**: All Go Dockerfiles use `registry.access.redhat.com/ubi9/go-toolset` and `ubi9/ubi-minimal` (FIPS-capable)
- **No FIPS build tags**: No `-tags=fips` or `GOEXPERIMENT=boringcrypto` — not configured for strict FIPS mode but no violations either
- **UI exception**: `clients/ui/Dockerfile` uses `node:22` and `gcr.io/distroless/static:nonroot` (not UBI)

#### Pre-commit Hooks

`.pre-commit-config.yaml` configured with:
- Standard pre-commit hooks: check-json, check-merge-conflict, detect-private-key, end-of-file-fixer, trailing-whitespace
- `ruff` (linting + formatting) for Python code
- Check for large files, case conflicts, debug statements

#### Dependency Alerts

Dependabot configured (`.github/dependabot.yml`) covering **all ecosystems**:
- `gomod`: `/` and `/clients/ui/bff/`
- `pip`: `/clients/python/` and `/jobs/async-upload`
- `docker`: `/`
- `github-actions`: `/`
- `npm`: `/clients/ui/frontend/`
- Weekly schedule for all
- Groups configured for mod-arch dependencies

### Agent Rules

**Score: 9.0/10**

**Excellent agent rule infrastructure**:

**AGENTS.md** (392 lines):
- Comprehensive agent behavior policy (dos and don'ts)
- Detailed repository map with directory descriptions
- Agent context awareness guidelines (import patterns, logging style, module boundaries)
- Development workflow commands (build, test, lint targets)
- Go module workspace documentation
- Deprecation policy for breaking changes
- UI development workflow documented separately
- Kubeflow AI Policy compliance (commit attribution)

**CLAUDE.md**: Symlinked to AGENTS.md — ensures both Claude Code and other agents use the same rules.

**Custom Skills** (5 skills in `.agents/skills/`):
- `catalog-add-route` — Add endpoints to catalog plugin OpenAPI specs
- `catalog-sample-data` — Generate sample YAML data for catalog plugins
- `create-agent-catalog-source` — Scaffold agent catalog from repository
- `init-catalog` — Scaffold new catalog plugin with working implementations
- `sync-catalog` — Sync generated code after OpenAPI spec changes

**Gap**: No explicit test creation rules (e.g., unit-test.md, e2e-test.md) in agent rules. The AGENTS.md covers "run tests" but doesn't document test patterns or conventions for AI-generated tests.

## Recommendations

### Priority 0 (Critical)

1. **Implement Codecov integration with coverage thresholds**
   - Add `codecov/codecov-action` to `build.yml`, `python-tests.yml`, and `controller-test.yml`
   - Create `.codecov.yml` with project and patch coverage targets
   - Upload Go coverprofile, Python cov-report, and frontend coverage data
   - Effort: 4-6 hours

2. **Add coverage generation to Go CI test steps**
   - Change `make test` to `make test-cover` in `build.yml`
   - Ensure `controller/test` uploads `cover.out`
   - Add `--coverprofile` to all Go test invocations in CI
   - Effort: 2-3 hours

### Priority 1 (High Value)

3. **Enable t.Parallel() in Go unit tests**
   - Add `t.Parallel()` to all unit test functions
   - Enable `-race` flag in CI test runs
   - Improves test speed and catches concurrency bugs
   - Effort: 8-12 hours

4. **Add concurrency control to all PR workflows**
   - Add `concurrency: { group: ..., cancel-in-progress: true }` to all PR-triggered workflows
   - Saves compute resources by canceling stale runs
   - Effort: 2-3 hours

5. **Add HEALTHCHECK to all Dockerfiles**
   - Currently only `jobs/async-upload/Dockerfile` has HEALTHCHECK
   - Add appropriate health check endpoints to server, controller, CSI, and UI images
   - Effort: 3-4 hours

6. **Add test creation agent rules**
   - Create `.agents/skills/` or rules for Go unit test patterns, Python test conventions, and TS component test patterns
   - Document test isolation, assertion patterns, and fixture usage
   - Can be generated via `/test-rules-generator`
   - Effort: 2-3 hours

### Priority 2 (Nice-to-Have)

7. **Create root .golangci.yml config file**
   - Standardize linting rules across all Go modules (root, BFF, controller, CSI)
   - Currently only BFF has its own config
   - Effort: 2-3 hours

8. **Add timeout-minutes to all workflow jobs**
   - Prevent hung jobs from consuming resources indefinitely
   - Suggested: 30 min for tests, 15 min for builds, 10 min for lint
   - Effort: 1 hour

9. **Add Cypress/Playwright E2E for UI frontend**
   - Currently no browser-level E2E tests for the React UI
   - Would catch integration issues between frontend and BFF
   - Effort: 16-24 hours

10. **Consider UBI base images for UI Dockerfile**
    - `clients/ui/Dockerfile` uses `node:22` and `distroless` — not FIPS-capable
    - Consider `registry.access.redhat.com/ubi9/nodejs-22` for consistency
    - Effort: 2-3 hours

## Comparison to Gold Standards

| Dimension | kubeflow/hub | odh-dashboard | notebooks | kserve |
|-----------|-------------|---------------|-----------|--------|
| Unit Tests | 7.5 — 171 Go, 63 TS, 39 Py; no t.Parallel | 9 — Multi-layer, contract tests | 6 — Image-focused | 8 — Comprehensive Go |
| Integration/E2E | 9.0 — Multi-K8s, multi-DB, fuzz | 8 — Cypress E2E | 7 — Multi-arch validation | 9 — Multi-version |
| Build Integration | 8.0 — PR build → Kind → validate | 8 — Comprehensive PR checks | 7 — Image build matrix | 7 — PR builds |
| Image Testing | 7.0 — UBI, multi-arch, Kind deploy | 7 — Standard | 9 — 5-layer validation | 7 — Standard |
| Coverage Tracking | 3.0 — Makefile only, no CI | 8 — Codecov enforced | 5 — Basic | 8 — Codecov with gates |
| CI/CD Automation | 8.0 — 33 workflows, matrix | 9 — Comprehensive | 8 — Well-organized | 8 — Matrix strategies |
| Static Analysis | 7.5 — Multi-lang lint, Dependabot | 8 — ESLint, pre-commit | 6 — Basic | 7 — golangci-lint |
| Agent Rules | 9.0 — AGENTS.md + 5 skills | 7 — CLAUDE.md | 3 — Minimal | 4 — Basic |

## File Paths Reference

### CI/CD Workflows
- `.github/workflows/build.yml` — Go build (PR + main)
- `.github/workflows/build-image-pr.yml` — PR image build + Kind deploy
- `.github/workflows/python-tests.yml` — Python lint, test, E2E, fuzz, catalog E2E
- `.github/workflows/controller-test.yml` — Controller envtest
- `.github/workflows/csi-test.yml` — CSI E2E with Kind
- `.github/workflows/async-upload-test.yml` — Async upload tests
- `.github/workflows/ui-frontend-build.yml` — TS test + build
- `.github/workflows/ui-bff-build.yml` — Go BFF lint + build

### Test Infrastructure
- `internal/core/*_test.go` — Core business logic unit tests
- `internal/db/service/*_test.go` — Database service layer tests
- `clients/python/tests/` — Python client unit tests
- `clients/ui/frontend/src/**/__tests__/` — TypeScript component tests
- `test/csi/e2e_test.sh` — CSI E2E test script
- `test/python/test_mr_conn.py` — Python connection test
- `jobs/async-upload/tests/` — Async upload unit + integration tests

### Build Configuration
- `Dockerfile` — Main server image
- `Dockerfile.odh` — ODH variant
- `cmd/controller/Dockerfile.controller` — Controller image
- `cmd/csi/Dockerfile.csi` — CSI image
- `clients/ui/Dockerfile` — UI + BFF image
- `Makefile` — Build, test, lint targets

### Static Analysis
- `clients/ui/bff/.golangci.yaml` — Go BFF lint config
- `clients/ui/frontend/.eslintrc.cjs` — TypeScript lint config
- `clients/python/pyproject.toml` — Python ruff/mypy config
- `.pre-commit-config.yaml` — Pre-commit hooks
- `.github/dependabot.yml` — Dependency management

### Agent Rules
- `AGENTS.md` — Comprehensive agent guidelines (392 lines)
- `CLAUDE.md` → symlink to AGENTS.md
- `.agents/skills/` — 5 custom catalog workflow skills
