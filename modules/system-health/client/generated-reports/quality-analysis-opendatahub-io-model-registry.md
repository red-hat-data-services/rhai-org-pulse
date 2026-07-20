---
repository: "opendatahub-io/model-registry"
overall_score: 8.1
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "171 Go + 39 Python + 63 UI test files; stretchr/testify, pytest, Jest/Cypress; 33% Go test-to-code ratio"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Kind-based E2E across Python client, CSI, Catalog; multi-K8s (v1.33/v1.34), multi-DB (MySQL/Postgres), multi-Python (3.10-3.14); Fuzz testing"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-triggered image build + Kind deployment + Python client smoke test; Tekton pipelines for Konflux; Kustomize overlays"
  - dimension: "Image Testing"
    score: 7.0
    status: "8 Dockerfiles with multi-stage builds; UBI9 base images; multi-arch (arm64/amd64); no container runtime validation tests"
  - dimension: "Coverage Tracking"
    score: 7.0
    status: "Codecov integration with fail_ci_if_error for Go and Python; no .codecov.yml threshold enforcement"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "35 workflow files; path-filtered triggers; matrix strategies for K8s/Python/DB; OpenSSF-compliant permissions; limited caching"
  - dimension: "Static Analysis"
    score: 8.0
    status: "golangci-lint v2.12.2, ruff+mypy (Python), ESLint (TS); pre-commit hooks; Dependabot for all ecosystems; UBI9 FIPS-capable base images"
  - dimension: "Agent Rules"
    score: 9.0
    status: "Comprehensive 340+ line AGENTS.md with repo map, commands, testing requirements; .agents/skills/ with custom skills; CLAUDE.md symlink"
critical_gaps:
  - title: "No Codecov threshold enforcement"
    impact: "Coverage can silently decrease without blocking PRs; no regression protection"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No container runtime validation tests"
    impact: "Image startup or runtime issues not caught until deployment to staging/production"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No CI caching strategies"
    impact: "CI runs are slower than necessary; Go module downloads and Docker layer rebuilds on every run"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No custom golangci-lint configuration"
    impact: "Default linter set misses project-specific code quality rules; no strictness beyond defaults"
    severity: "LOW"
    effort: "2-3 hours"
quick_wins:
  - title: "Add .codecov.yml with coverage thresholds"
    effort: "1-2 hours"
    impact: "Prevent coverage regression on PRs with configurable minimum thresholds"
  - title: "Enable Go module caching in CI workflows"
    effort: "1-2 hours"
    impact: "Reduce CI build times by 30-50% for Go builds"
  - title: "Add custom .golangci.yml with stricter linters"
    effort: "2-3 hours"
    impact: "Catch more code quality issues: unused parameters, error wrapping, nil checks"
recommendations:
  priority_0:
    - "Add .codecov.yml with project/patch coverage thresholds (e.g., 70% project, 80% patch)"
    - "Enable Go module and Docker layer caching in all CI workflows"
  priority_1:
    - "Add container runtime validation tests (health checks, startup verification) using Testcontainers"
    - "Add custom .golangci.yml enabling additional linters (errcheck, gocritic, gosimple, staticcheck strict)"
    - "Add concurrency controls to more workflows to prevent redundant runs"
  priority_2:
    - "Add contract tests between Go server and Python client for API compatibility"
    - "Add performance regression testing for core API endpoints"
    - "Add FIPS build tags and boringcrypto experiment for strict FIPS compliance"
---

# Quality Analysis: opendatahub-io/model-registry

## Executive Summary

- **Overall Score: 8.1/10**
- **Repository Type**: Multi-component service (REST API, K8s Controller, CSI, Python Client, React UI + Go BFF, Catalog Service)
- **Primary Languages**: Go, Python, TypeScript/React
- **Module**: `github.com/kubeflow/hub` (Go workspace with multiple `go.mod` files)
- **Jira**: RHOAIENG / AI Hub (midstream tier)

### Key Strengths
- Exceptional E2E testing with multi-version K8s (v1.33/v1.34), multi-database (MySQL/PostgreSQL), and multi-Python version (3.10-3.14) matrix
- Comprehensive CI with 35 workflow files, path-based filtering, and OpenSSF-compliant permissions
- Industry-leading AGENTS.md (340+ lines) with custom `.agents/skills/` directory
- PR-triggered image builds with Kind cluster deployment and smoke testing
- Fuzz testing for API contract validation
- UBI9 base images across all Dockerfiles (FIPS-capable)

### Critical Gaps
- No Codecov threshold enforcement (coverage can regress silently)
- No container runtime validation tests
- No CI caching strategies (Go modules, Docker layers)

### Agent Rules Status: **Excellent** - Comprehensive AGENTS.md with repo map, commands, testing requirements, and custom skills

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.0/10 | 15% | 1.20 | 171 Go + 39 Python + 63 UI test files; strong ratio |
| Integration/E2E | 9.0/10 | 20% | 1.80 | Multi-version K8s/DB/Python; Kind-based E2E; Fuzz testing |
| Build Integration | 8.0/10 | 15% | 1.20 | PR image build + Kind deploy + smoke test; Tekton |
| Image Testing | 7.0/10 | 10% | 0.70 | Multi-stage builds; UBI9; multi-arch; no runtime tests |
| Coverage Tracking | 7.0/10 | 10% | 0.70 | Codecov integration; no threshold enforcement |
| CI/CD Automation | 8.0/10 | 15% | 1.20 | 35 workflows; matrix strategies; path filtering |
| Static Analysis | 8.0/10 | 10% | 0.80 | golangci-lint, ruff, mypy, ESLint; Dependabot; pre-commit |
| Agent Rules | 9.0/10 | 5% | 0.45 | Comprehensive AGENTS.md; custom skills; CLAUDE.md symlink |
| **Overall** | **8.1/10** | **100%** | **8.05** | |

## Critical Gaps

### 1. No Codecov Threshold Enforcement
- **Impact**: Coverage can silently decrease without blocking PRs; no regression protection
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: Codecov is integrated in `build.yml` and `python-tests.yml` with `fail_ci_if_error: true`, but there is no `.codecov.yml` file defining project or patch coverage thresholds. Coverage uploads succeed but no minimum is enforced.

### 2. No Container Runtime Validation Tests
- **Impact**: Image startup or runtime issues not caught until deployment
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: While the PR build workflow deploys to Kind and runs a Python client smoke test, there are no dedicated container runtime validation tests (health check verification, startup probe testing, resource limit validation).

### 3. No CI Caching Strategies
- **Impact**: Slower CI times; Go module downloads and Docker builds repeat on every run
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: None of the 35 workflows use `actions/cache` or equivalent caching for Go modules, Python packages, or Docker layers. The `setup-go` action does have built-in caching but it's not explicitly configured.

### 4. No Custom golangci-lint Configuration
- **Impact**: Default linter set misses project-specific quality rules
- **Severity**: LOW
- **Effort**: 2-3 hours
- **Details**: AGENTS.md documents that "There is no project-level `.golangci.yml` config file -- the default golangci-lint configuration applies." Custom configuration would enable stricter linters.

## Quick Wins

### 1. Add `.codecov.yml` with Coverage Thresholds (1-2 hours)
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

### 2. Enable Go Module Caching in CI (1-2 hours)
The `actions/setup-go` action supports built-in caching. Ensure it's enabled:
```yaml
- name: Setup Go
  uses: actions/setup-go@v6
  with:
    go-version: "1.26.3"
    cache: true
```

### 3. Add Custom `.golangci.yml` (2-3 hours)
```yaml
# .golangci.yml
version: "2"
linters:
  enable:
    - errcheck
    - gocritic
    - gosimple
    - staticcheck
    - unused
    - govet
    - ineffassign
    - typecheck
    - errorlint
    - nilerr
```

## Detailed Findings

### Unit Tests

**Score: 8.0/10**

| Language | Test Files | Source Files | Ratio |
|----------|-----------|-------------|-------|
| Go | 171 | 520 | 32.9% |
| Python | 39 | 210 | 18.6% |
| TypeScript (UI) | 63 | N/A | N/A |
| Go (BFF) | 44 | N/A | N/A |
| Cypress (UI E2E) | 66 | N/A | N/A |

**Frameworks**:
- Go: `stretchr/testify` for assertions, `testcontainers-go` for database integration
- Python: `pytest` via `nox` sessions
- TypeScript: Jest for unit tests, Cypress for E2E
- Controller: `envtest` (kubebuilder test framework) for K8s API testing

**Strengths**:
- High Go test-to-code ratio (33%)
- Testcontainers for MySQL and PostgreSQL integration tests (shared container pattern in `internal/testutils/`)
- Controller tests use `envtest` with CRD installation
- UI has comprehensive unit tests (63 files) plus Cypress E2E (66 files)
- BFF has 44 test files covering handlers, repositories, and validation

**Test Patterns**:
- Go tests colocated with source (`*_test.go` alongside source)
- Python tests in dedicated `tests/` directories
- UI tests use `__tests__/` directories with `.spec.ts`/`.test.tsx` naming

### Integration/E2E Tests

**Score: 9.0/10**

**E2E Infrastructure**:
- Kind cluster creation automated in CI workflows
- Python client E2E: builds image, deploys to Kind with kustomize, runs comprehensive tests
- CSI E2E: builds both model-registry and storage-initializer images, deploys to Kind with Helm
- Catalog E2E: builds catalog image, deploys to Kind, runs Python E2E tests
- Async upload: integration tests with pytest

**Multi-Version Testing Matrix**:
| Dimension | Versions Tested |
|-----------|----------------|
| Kubernetes | v1.33.7, v1.34.3 |
| Python | 3.10, 3.11, 3.12, 3.13, 3.14 |
| Database | MySQL, PostgreSQL |

**Fuzz Testing**:
- Property-based fuzz testing for API contracts (`test-fuzz.yml`)
- Stateful and stateless fuzz tests for model-registry and catalog APIs
- Triggered on main merges and PRs with OpenAPI changes

**Strengths**:
- Broad version matrix catches compatibility issues early
- Fuzz testing is rare and demonstrates high quality bar
- Testcontainers for database-level integration tests
- Full deployment cycle tested (build + deploy + smoke test)

### Build Integration

**Score: 8.0/10**

**PR Build Validation** (`build-image-pr.yml`):
1. Builds Docker image
2. Creates Kind cluster (K8s v1.33.7)
3. Loads image into Kind
4. Deploys model-registry-operator from GitHub
5. Creates test ModelRegistry CR
6. Installs Python client
7. Runs connectivity test against deployed service
8. Full diagnostic output on failure

**Additional PR Build Checks**:
- `build.yml`: Compiles Go, runs unit tests + coverage, uploads to Codecov
- `build-image-ui-pr.yml`: Builds UI container image
- `controller-test.yml`: Controller tests (path-filtered)
- `csi-test.yml`: CSI E2E tests on Kind (path-filtered)
- `check-db-schema-structs.yaml`: Database schema validation
- `check-openapi-spec-pr.yaml`: OpenAPI spec sync check
- `go-mod-tidy-diff-check.yml`: Module file consistency
- `go-generate.yml`: Generated code sync check

**Tekton/Konflux Integration**:
- `.tekton/` directory with 4 pipeline definitions
- `early-gate-ci-build.yaml` and `early-gate-ci-test.yaml` for Konflux early gate
- `odh-model-registry-pull-request.yaml` for PR Konflux builds
- `odh-model-registry-job-async-upload-pull-request.yaml` for async upload PR builds

**Strengths**:
- True end-to-end build validation (image build + K8s deploy + connectivity test)
- Tekton pipelines for Konflux integration
- Multiple autogen checks prevent drift

### Image Testing

**Score: 7.0/10**

**Dockerfiles** (8 total):
| Dockerfile | Base Image | Multi-Stage | Multi-Arch |
|-----------|-----------|------------|-----------|
| `Dockerfile` | UBI9/go-toolset + UBI9/ubi-minimal | Yes (3-stage) | Yes (arm64/amd64) |
| `Dockerfile.odh` | UBI9/go-toolset + UBI9/ubi-minimal | Yes (2-stage) | No (amd64 only) |
| `Dockerfile.testops` | UBI9/python-312 | No | Yes (TARGETARCH) |
| `cmd/controller/Dockerfile.controller` | UBI9/go-toolset + UBI9/ubi-minimal | Yes (2-stage) | Yes |
| `cmd/csi/Dockerfile.csi` | UBI9/go-toolset + UBI9/ubi-minimal | Yes (3-stage) | Yes |
| `clients/ui/Dockerfile` | Parameterized (NODE/GOLANG/DISTROLESS) | Yes (3-stage) | Yes |
| `clients/ui/Dockerfile.standalone` | Parameterized | Yes (4-stage) | Yes |
| `jobs/async-upload/Dockerfile` | UBI9/python-312-minimal + cosign | Yes (2-stage) | No |

**Strengths**:
- All production images use UBI9 base (FIPS-capable)
- Multi-stage builds minimize final image size
- Multi-arch support (linux/arm64, linux/amd64) in most images
- Distroless final stage for core server (minimal attack surface)
- Non-root user (65532:65532) in server images
- Docker layer caching optimization (COPY go.mod first, then go mod download)

**Gaps**:
- No `HEALTHCHECK` instructions in Dockerfiles
- No dedicated container runtime validation tests
- No image scanning integration in PR workflows (Trivy runs separately, out of scope)

### Coverage Tracking

**Score: 7.0/10**

**Coverage Generation**:
- Go: `make test-cover` generates `coverage.txt` and `coverage.html` using `--coverprofile`
- Python: `--cov-report=xml` in nox E2E sessions
- Controller: `KUBEBUILDER_ASSETS` + `--coverprofile cover.out`

**Codecov Integration**:
- `build.yml`: uploads Go `coverage.txt` with `fail_ci_if_error: true`
- `python-tests.yml`: uploads Python `coverage.xml` with `fail_ci_if_error: true`
- Coverage uploaded only for Python 3.12 matrix entry (avoids duplicate uploads)

**Gaps**:
- No `.codecov.yml` configuration file
- No project or patch coverage thresholds
- No coverage gates that block PR merges on regression
- Catalog tests generate coverage but don't upload to Codecov

### CI/CD Automation

**Score: 8.0/10**

**Workflow Inventory** (35 files):

| Category | Workflows | Trigger |
|----------|----------|---------|
| Build/Test | `build.yml`, `controller-test.yml`, `csi-test.yml`, `python-tests.yml`, `async-upload-test.yml`, `test-fuzz.yml` | PR + push |
| Image Build (PR) | `build-image-pr.yml`, `build-image-ui-pr.yml` | PR |
| Image Build (Push) | `build-and-push-image.yml`, `build-and-push-controller-image.yml`, `build-and-push-csi-image.yml`, `build-and-push-ui-images.yml`, `build-and-push-ui-images-standalone.yml`, `build-and-push-testops-image.yml`, `build-and-push-async-upload.yml` | Push to main |
| Code Quality | `go-mod-tidy-diff-check.yml`, `go-generate.yml`, `check-db-schema-structs.yaml`, `check-openapi-spec-pr.yaml`, `check-gitattributes.yaml`, `check-owners.yml` | PR |
| UI | `ui-bff-build.yml`, `ui-frontend-build.yml` | PR + push |
| Release | `python-release.yml`, `sync-branch-stable.yml`, `sync-branch-stable2x.yml` | Various |
| Governance | `first-time-contributor-pr.yml`, `gh-workflow-approve.yml`, `labeler.yml`, `stale.yaml`, `scorecard.yml` | Various |
| Security | `trivy-image-scanning.yaml` | Separate |

**Strengths**:
- Path-based filtering reduces unnecessary CI runs
- Matrix strategies for comprehensive version testing
- OpenSSF ScoreCard compliance (`permissions: read-all`)
- Workflow approval for external contributors (`ok-to-test` label)
- Autogen sync checks prevent code drift
- First-time contributor welcome automation

**Gaps**:
- Limited concurrency controls (only `gh-workflow-approve.yml` uses `concurrency:`)
- No explicit caching strategies in workflows
- No test timeout configurations in most workflows

### Static Analysis

**Score: 8.0/10**

**Linting**:
- **Go**: golangci-lint v2.12.2 (installed in Makefile, used in `make lint` and CI)
- **Python**: ruff (linting + formatting) + mypy (type checking) via nox sessions
- **TypeScript**: ESLint via `npm run test:lint` with `--max-warnings 0` (zero tolerance)
- **Go (BFF)**: golangci-lint via `golangci-lint-action` in CI

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- `pre-commit-hooks`: large files, AST check, case conflict, JSON, merge conflict, symlinks, debug statements, private key detection, EOF fixer, trailing whitespace
- `ruff-pre-commit`: ruff linting + formatting for Python client code

**Dependency Management**:
- Dependabot configured for all 5 ecosystems: gomod, pip, docker, github-actions, npm
- Weekly schedule for all ecosystems
- Group updates for mod-arch packages
- Specific directory targeting for each ecosystem

**FIPS Compatibility**:
- All Dockerfiles use UBI9 base images (FIPS-capable by default)
- No non-FIPS crypto imports found (`crypto/md5`, `crypto/des`, `crypto/rc4`, `math/rand`)
- No explicit FIPS build tags or boringcrypto experiment configured
- `Dockerfile.odh` uses `CGO_ENABLED=1` (required for boringcrypto, but not explicitly configured)

**Gaps**:
- No custom `.golangci.yml` configuration (uses defaults only)
- No explicit FIPS build tags (`-tags=fips` or `GOEXPERIMENT=boringcrypto`)

### Agent Rules

**Score: 9.0/10**

**AGENTS.md** (340+ lines):
- Agent behavior policy with explicit DO/DON'T rules
- Kubeflow AI Policy compliance (commit attribution)
- Complete repository map with directory descriptions
- Full command reference: setup, build, lint, test (all languages), code generation, Docker, UI
- CI checks table mapping workflows to purposes
- Development workflow for AI agents (before/after patterns)
- Auto-generated file warnings
- Commit/PR hygiene rules (DCO, conventional commits)
- Core development principles per language (Go, TypeScript, Python)
- Testing requirements (bug fixes MUST include tests)
- Security checklist
- Database change procedures
- OpenAPI change procedures

**Custom Skills** (`.agents/skills/`):
- `sync-catalog/SKILL.md`
- `init-catalog/SKILL.md` (with panic-ordering, panic-mapping, panic-crud guides)
- `catalog-sample-data/SKILL.md`
- `catalog-add-route/SKILL.md`

**CLAUDE.md**: Symlink to AGENTS.md (ensures both Claude and other AI agents get the same guidance)

**Strengths**:
- One of the most comprehensive AGENTS.md files in the RHOAI ecosystem
- Custom skills for common catalog operations
- Framework-specific testing guidance
- Explicit rules for auto-generated code handling

## Recommendations

### Priority 0 (Critical)

1. **Add `.codecov.yml` with coverage thresholds**
   - Define project target (e.g., 70%) and patch target (e.g., 80%)
   - Enable coverage comments on PRs for visibility
   - Effort: 1-2 hours

2. **Enable CI caching strategies**
   - Add Go module caching via `actions/setup-go` `cache: true`
   - Add npm caching for UI builds
   - Add Poetry caching for Python workflows
   - Effort: 2-4 hours

### Priority 1 (High Value)

3. **Add container runtime validation tests**
   - Use Testcontainers to verify image startup, readiness, and basic functionality
   - Test health endpoints after container startup
   - Effort: 4-6 hours

4. **Add custom `.golangci.yml` configuration**
   - Enable additional linters: `errorlint`, `gocritic`, `nilerr`, `exhaustive`
   - Configure project-specific exclusions
   - Effort: 2-3 hours

5. **Add concurrency controls to all PR workflows**
   - Prevent redundant runs when PRs are updated rapidly
   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: true
   ```
   - Effort: 1-2 hours

### Priority 2 (Nice-to-Have)

6. **Add contract tests between Go server and Python client**
   - Verify API compatibility beyond OpenAPI spec
   - Test error response formats and edge cases
   - Effort: 8-12 hours

7. **Add explicit FIPS build configuration**
   - Add `GOEXPERIMENT=boringcrypto` build variant
   - Add FIPS build tags to Makefile targets
   - Effort: 4-6 hours

8. **Upload catalog E2E coverage to Codecov**
   - Currently catalog E2E generates `--cov-report=xml` but doesn't upload
   - Add Codecov upload step to catalog-test job
   - Effort: 30 minutes

## Comparison to Gold Standards

| Dimension | model-registry | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit Tests | 8 | 9 | 6 | 8 |
| Integration/E2E | 9 | 9 | 7 | 9 |
| Build Integration | 8 | 8 | 7 | 7 |
| Image Testing | 7 | 7 | 9 | 6 |
| Coverage Tracking | 7 | 8 | 5 | 9 |
| CI/CD Automation | 8 | 9 | 8 | 8 |
| Static Analysis | 8 | 8 | 7 | 8 |
| Agent Rules | 9 | 8 | 3 | 5 |
| **Overall** | **8.1** | **8.5** | **6.6** | **7.7** |

**Standout**: model-registry has the best agent rules in the ecosystem, with comprehensive AGENTS.md and custom `.agents/skills/`. Its fuzz testing and multi-version matrix testing are also exceptional. The main gaps vs. odh-dashboard are coverage threshold enforcement and CI caching.

## File Paths Reference

### CI/CD
- `.github/workflows/build.yml` - Build + unit tests + coverage
- `.github/workflows/build-image-pr.yml` - PR image build + Kind deploy
- `.github/workflows/python-tests.yml` - Python lint, E2E, fuzz, coverage
- `.github/workflows/controller-test.yml` - Controller tests
- `.github/workflows/csi-test.yml` - CSI E2E tests
- `.github/workflows/async-upload-test.yml` - Async upload tests
- `.github/workflows/test-fuzz.yml` - Fuzz testing
- `.github/workflows/ui-bff-build.yml` - BFF lint + build
- `.github/workflows/ui-frontend-build.yml` - Frontend test + build
- `.tekton/` - Konflux Tekton pipelines (4 files)

### Testing
- `internal/testutils/` - Shared Go test utilities (Testcontainers)
- `internal/db/service/*_test.go` - Database service tests
- `internal/core/*_test.go` - Core business logic tests
- `clients/python/tests/` - Python client tests
- `clients/python/tests/fuzz_api/` - API fuzz tests
- `catalog/clients/python/tests/` - Catalog client tests
- `clients/ui/frontend/src/__tests__/` - UI unit tests
- `clients/ui/frontend/src/__tests__/cypress/` - Cypress E2E tests
- `clients/ui/bff/internal/` - BFF handler/repository tests
- `test/` - Integration/E2E test scripts
- `cmd/controller/internal/controllers/suite_test.go` - Controller envtest suite
- `pkg/inferenceservice-controller/suite_test.go` - InferenceService controller tests

### Code Quality
- `Makefile` - Build, lint, test, code generation targets
- `.pre-commit-config.yaml` - Pre-commit hooks (15 checks)
- `.github/dependabot.yml` - Dependabot for 5 ecosystems
- `semgrep.yaml` - Semgrep rules (64KB)

### Container Images
- `Dockerfile` - Main server image (UBI9, multi-stage, multi-arch)
- `Dockerfile.odh` - ODH-specific build (CGO_ENABLED=1)
- `Dockerfile.testops` - Test operations image
- `cmd/controller/Dockerfile.controller` - Controller image
- `cmd/csi/Dockerfile.csi` - CSI storage initializer
- `clients/ui/Dockerfile` - UI image (Node + Go BFF)
- `clients/ui/Dockerfile.standalone` - Standalone UI image
- `jobs/async-upload/Dockerfile` - Async upload job

### Agent Rules
- `AGENTS.md` - Comprehensive agent guidance (340+ lines)
- `CLAUDE.md` - Symlink to AGENTS.md
- `.agents/skills/sync-catalog/SKILL.md`
- `.agents/skills/init-catalog/SKILL.md`
- `.agents/skills/catalog-sample-data/SKILL.md`
- `.agents/skills/catalog-add-route/SKILL.md`

### Coverage
- `build.yml` - Codecov upload for Go (`coverage.txt`)
- `python-tests.yml` - Codecov upload for Python (`coverage.xml`)
- `Makefile` - `make test-cover` target
