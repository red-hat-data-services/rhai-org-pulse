---
repository: "kubeflow/pipelines"
overall_score: 7.3
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Good test coverage across Go/Python/TypeScript with Ginkgo, pytest, and Vitest"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Exceptional multi-version, multi-config E2E testing with Kind cluster matrices"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR image builds with Kind deployment; no Konflux simulation; kustomize validation present"
  - dimension: "Image Testing"
    score: 5.0
    status: "20+ Dockerfiles with multi-stage builds and multi-arch; no runtime validation or health checks"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "Coverage tooling installed (pytest-cov, vitest coverage) but no enforcement, thresholds, or PR reporting"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "42 workflows with concurrency control, matrix strategies, caching, and test sharding"
  - dimension: "Static Analysis"
    score: 7.0
    status: "golangci-lint v2, pre-commit hooks, Dependabot; missing FIPS checks and broader linter coverage"
  - dimension: "Agent Rules"
    score: 9.0
    status: "Comprehensive 44KB AGENTS.md with architecture, testing policy, and development guides"
critical_gaps:
  - title: "No coverage enforcement or PR reporting"
    impact: "Coverage can silently regress without anyone noticing; no threshold gates on merges"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container runtime validation"
    impact: "Image startup failures, missing dependencies, or health check issues not caught until deployment"
    severity: "HIGH"
    effort: "6-8 hours"
  - title: "No FIPS build configuration"
    impact: "Binaries not compiled with FIPS-compliant crypto; alpine base images not FIPS-capable"
    severity: "MEDIUM"
    effort: "12-16 hours"
  - title: "No PR-time Konflux build simulation"
    impact: "Build failures discovered only after merge in production build system"
    severity: "MEDIUM"
    effort: "8-12 hours"
quick_wins:
  - title: "Add Codecov integration with threshold enforcement"
    effort: "3-4 hours"
    impact: "Automated coverage tracking, PR comments with coverage diff, regression prevention"
  - title: "Add HEALTHCHECK to Dockerfiles"
    effort: "2-3 hours"
    impact: "Container orchestrators can detect unhealthy containers and restart them automatically"
  - title: "Enable Dependabot for npm and pip ecosystems"
    effort: "1 hour"
    impact: "Automated dependency updates for frontend and SDK packages beyond just Go modules"
  - title: "Add structured .claude/rules/ directory"
    effort: "2-3 hours"
    impact: "More granular, file-pattern-triggered agent rules for specific test types"
recommendations:
  priority_0:
    - "Implement Codecov integration with coverage thresholds and PR reporting to prevent silent coverage regression"
    - "Add container health checks (HEALTHCHECK in Dockerfiles) and runtime validation tests"
    - "Migrate more Dockerfiles to UBI base images for FIPS compliance readiness"
  priority_1:
    - "Expand Dependabot to cover npm and pip ecosystems"
    - "Add coverage threshold enforcement (e.g., 70% minimum, no decrease on PRs)"
    - "Create .claude/rules/ directory with file-pattern-specific test rules"
    - "Add Konflux build simulation to PR workflows"
  priority_2:
    - "Enable additional golangci-lint linters (errcheck, gosimple, exhaustive)"
    - "Add FIPS build tags and boringcrypto support for Go binaries"
    - "Add contract tests for API boundaries between backend and SDK"
    - "Implement performance regression testing for pipeline execution times"
---

# Quality Analysis: kubeflow/pipelines

## Executive Summary

- **Overall Score: 7.3/10**
- **Repository Type**: Polyglot monorepo (Go backend, Python SDK, TypeScript/React frontend)
- **JIRA**: RHOAIENG / AI Pipelines (upstream tier)
- **Key Strengths**: Exceptional E2E test infrastructure with multi-version K8s matrices, comprehensive CI/CD automation (42 workflows), and thorough agent documentation (44KB AGENTS.md)
- **Critical Gaps**: No coverage enforcement or PR reporting, no container runtime validation, no FIPS build configuration
- **Agent Rules Status**: Present and comprehensive (AGENTS.md + CLAUDE.md symlink), but no .claude/rules/ directory

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 7/10 | 15% | 1.05 | Good coverage with Ginkgo, pytest, Vitest |
| Integration/E2E | 9/10 | 20% | 1.80 | Exceptional multi-version Kind-based E2E |
| Build Integration | 7/10 | 15% | 1.05 | PR image builds + kustomize validation |
| Image Testing | 5/10 | 10% | 0.50 | Multi-stage/multi-arch but no runtime validation |
| Coverage Tracking | 4/10 | 10% | 0.40 | Tools present but no enforcement |
| CI/CD Automation | 9/10 | 15% | 1.35 | 42 workflows, matrix strategies, sharding |
| Static Analysis | 7/10 | 10% | 0.70 | golangci-lint + pre-commit; Dependabot (gomod only) |
| Agent Rules | 9/10 | 5% | 0.45 | 44KB AGENTS.md with testing/architecture policies |
| **Overall** | **7.3/10** | **100%** | **7.30** | |

## Critical Gaps

### 1. No Coverage Enforcement or PR Reporting
- **Impact**: Coverage can silently regress on any merge without detection
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: pytest-cov is installed in SDK unit tests and Vitest coverage scripts exist in frontend, but there is no `.codecov.yml`, no coverage threshold enforcement, and no PR coverage comments. Backend Go tests have no coverage generation at all.

### 2. No Container Runtime Validation
- **Impact**: Image startup failures, missing runtime dependencies, or misconfigured entrypoints not caught until deployment
- **Severity**: HIGH
- **Effort**: 6-8 hours
- **Details**: 20+ Dockerfiles exist with no HEALTHCHECK instructions. No Testcontainers usage. Runtime validation relies entirely on E2E tests deploying to Kind, which validates the overall system but not individual container health.

### 3. No FIPS Build Configuration
- **Impact**: Go binaries not compiled with FIPS-compliant cryptography; alpine/debian base images are not FIPS-capable
- **Severity**: MEDIUM
- **Effort**: 12-16 hours
- **Details**: No `-tags=fips`, no `GOEXPERIMENT=boringcrypto`, no CGO_ENABLED=1 with BoringSSL. Base images are mixed: alpine, debian, golang-alpine, python-slim, with only one UBI image (registry.access.redhat.com/ubi9/nginx-124). `math/rand` usage found in test utilities only (acceptable). `hashlib.md5` found in google-cloud components (not core).

### 4. No PR-Time Konflux Build Simulation
- **Impact**: Build failures in production build system discovered only after merge
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Details**: PR workflows build Docker images and deploy to Kind for testing, but do not simulate the Konflux build pipeline. Production build issues (e.g., missing FIPS dependencies, UBI-specific constraints) can slip through.

## Quick Wins

### 1. Add Codecov Integration (3-4 hours)
- **Impact**: Automated coverage tracking with PR comments showing coverage deltas
- **Implementation**:
  ```yaml
  # .codecov.yml
  coverage:
    status:
      project:
        default:
          target: 60%
          threshold: 2%
      patch:
        default:
          target: 70%
  ```
  Add `codecov/codecov-action@v4` step to `kfp-sdk-unit-tests.yml`, `presubmit-backend.yml`, and `frontend.yml` workflows.

### 2. Add HEALTHCHECK to Dockerfiles (2-3 hours)
- **Impact**: Kubernetes and Docker can detect unhealthy containers automatically
- **Implementation**: Add appropriate health checks to key Dockerfiles:
  ```dockerfile
  # backend/Dockerfile
  HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8888/apis/v2beta1/healthz || exit 1
  ```

### 3. Enable Dependabot for npm and pip (1 hour)
- **Impact**: Automated dependency updates for frontend and SDK beyond just Go modules
- **Implementation**: Add to `.github/dependabot.yml`:
  ```yaml
  - package-ecosystem: npm
    directory: "/frontend"
    schedule:
      interval: weekly
  - package-ecosystem: pip
    directory: "/sdk/python"
    schedule:
      interval: weekly
  ```

### 4. Add .claude/rules/ Directory (2-3 hours)
- **Impact**: File-pattern-triggered agent rules for targeted test guidance
- **Implementation**: Create `.claude/rules/` with rules like `go-tests.md`, `python-sdk-tests.md`, `frontend-tests.md` that trigger based on file globs and provide framework-specific testing patterns.

## Detailed Findings

### Unit Tests

**Score: 7/10**

| Language | Test Files | Source Files | Ratio |
|----------|-----------|--------------|-------|
| Go | 181 | 688 | 26.3% |
| Python | 220 | 1,035 | 21.3% |
| TypeScript/JS | 169 | 447 | 37.8% |

**Frameworks Detected:**
- **Go**: Ginkgo v2 (BDD-style) + standard `testing` package
- **Python**: pytest with pytest-xdist for parallel execution, pytest-cov for coverage
- **Frontend**: Vitest with @testing-library/react, Playwright for browser tests

**Strengths:**
- Multiple test frameworks appropriate for each language
- Parallel test execution (Ginkgo parallel nodes, pytest-xdist `auto` workers)
- Frontend uses modern Vitest (v4.1.8) with React Testing Library
- Good test file organization (test files co-located and in dedicated test directories)
- Python SDK tests matrix across Python 3.9 and 3.13

**Gaps:**
- Go test-to-code ratio (26%) is moderate; some packages may lack tests
- No `t.Parallel()` analysis in Go tests beyond Ginkgo
- Coverage not enforced for any language

### Integration/E2E Tests

**Score: 9/10**

**Test Infrastructure:**
- `backend/test/end2end/` - Pipeline E2E tests and MLflow integration
- `backend/test/v2/api/` - V2 API server integration tests
- `backend/test/integration/` - V1 API integration tests
- `backend/test/compiler/` - Workflow compiler tests
- `test/frontend-integration-test/` - Frontend E2E with WebdriverIO
- `test/server-integration-test/` - Server integration with K8s

**Multi-Version Testing Matrix:**
- Kubernetes versions: v1.33.12, v1.36.1
- Argo Workflows versions: v3.7.14, v4.0.5
- Cache enabled/disabled variants
- Proxy enabled/disabled variants
- Pod-to-pod TLS enabled/disabled variants
- Multi-user vs single-user modes
- Pipeline store: database vs kubernetes

**Cluster Setup:**
- Kind clusters with custom create-cluster action
- Kind node image caching for faster CI
- Automated KFP deployment via deploy action
- Test sharding (E2ECriticalShardA, E2ECriticalShardB) for parallelism

**Strengths:**
- One of the most comprehensive E2E matrices in the Kubeflow ecosystem
- Tests cover critical paths: pipeline creation, execution, caching, proxy, TLS
- Frontend E2E tests run against real Kind cluster
- Ginkgo parallel nodes (5-10 per suite) for test speed
- MLflow integration E2E tests

**Gaps:**
- Some E2E tests only test a single K8s version (e.g., upgrade-test)
- No chaos engineering or failure injection testing

### Build Integration

**Score: 7/10**

**PR Build Validation:**
- `image-builds.yml` (reusable workflow): Builds all backend Docker images on PR
- Images built and loaded into Kind cluster for E2E testing
- Runtime base image caching via GitHub artifacts
- `kubeflow-pipelines-manifests.yml`: Kustomize manifest validation on PR
- `build-tools-images.yml`: API and visualization tool images
- `check-diff` Makefile target: Verifies generated files are up-to-date

**Build Pipeline:**
- Multi-stage Docker builds (builder pattern)
- BuildKit enabled (`DOCKER_BUILDKIT=1`)
- Buildx with retry logic for multi-arch builds
- Container registry with Kind for local testing

**Strengths:**
- Images built on every relevant PR via path-based triggers
- Kustomize manifest presubmit validation
- Generated file drift detection
- Build caching via GitHub artifacts

**Gaps:**
- No Konflux build simulation
- No operator bundle validation (not an operator, but manifest validation could be deeper)
- `build-and-push.yml` uses buildx for multi-arch but only on master pushes, not PRs

### Image Testing

**Score: 5/10**

**Dockerfiles Found (20+):**
- `backend/Dockerfile` - Main API server
- `backend/Dockerfile.driver` - Pipeline driver
- `backend/Dockerfile.launcher` - Pipeline launcher
- `backend/Dockerfile.persistenceagent` - Persistence agent
- `backend/Dockerfile.scheduledworkflow` - Scheduled workflow controller
- `backend/Dockerfile.cacheserver` - Cache server
- `backend/Dockerfile.visualization` - Visualization server
- `backend/Dockerfile.viewercontroller` - Viewer controller
- `frontend/Dockerfile` - Frontend React app
- `proxy/Dockerfile` - Inverting proxy
- Plus tool/test images

**Base Images:**
- `golang:1.26.x-alpine` (builders)
- `golang:1.26.x-bookworm` (builders)
- `alpine:3.21` (runtime)
- `debian:stable-slim` (runtime)
- `python:3.11-slim` (SDK tools)
- `registry.access.redhat.com/ubi9/nginx-124` (frontend)
- Various vendor images (minio, envoy, selenium)

**Multi-Architecture:**
- Buildx with `--platform` in build-and-push workflow
- Setup-buildx-with-retry script for reliability
- Manifest list creation in create-manifest workflow

**Strengths:**
- Multi-stage builds used consistently
- Multi-arch support via buildx
- One UBI9 base image already in use (frontend)
- Minimal runtime images (alpine, slim variants)

**Gaps:**
- No HEALTHCHECK in any Dockerfile
- No Testcontainers or container runtime tests
- No image scanning integration in PR workflows (out of scope per skill rules)
- Mixed base images (alpine/debian not FIPS-capable)
- No container startup validation tests

### Coverage Tracking

**Score: 4/10**

**Coverage Tools Present:**
- `pytest-cov` installed in SDK unit tests workflow
- `vitest --coverage` scripts in frontend package.json
- `@vitest/coverage-v8` dev dependency in frontend
- Frontend has `coverage:baseline` and `coverage:compare` scripts

**Missing:**
- No `.codecov.yml` or `codecov.yml`
- No coverage threshold enforcement in CI
- No PR coverage reporting (no codecov-action, no coverage comment bots)
- No `--coverprofile` usage in Go backend tests
- Frontend coverage scripts exist but are not called in CI workflows
- No `--cov-fail-under` or equivalent threshold

**Assessment:**
Coverage tooling is partially installed but completely unenforced. Coverage generation exists as opt-in local commands but is not integrated into the CI pipeline. This means coverage can regress silently on any merge.

### CI/CD Automation

**Score: 9/10**

**Workflow Inventory (42 workflows):**

| Category | Workflows | Trigger |
|----------|----------|---------|
| Backend Tests | presubmit-backend, api-server-tests, compiler-tests | PR + push |
| SDK Tests | kfp-sdk-tests, kfp-sdk-unit-tests, kfp-sdk-client-tests | PR + push |
| E2E Tests | e2e-test, e2e-test-frontend | PR + push |
| Integration | integration-tests-v1, legacy-v2-api-integration-tests | PR + push |
| Frontend | frontend | PR + push |
| Build | image-builds, image-builds-master, image-builds-release, build-and-push | Various |
| Quality | pre-commit, ci-checks, ci-health-report | PR + push |
| SDK Quality | sdk-yapf, sdk-isort, sdk-docformatter | PR + push |
| Manifests | kubeflow-pipelines-manifests | PR + push |
| K8s Platform | kfp-kubernetes-library-test, kfp-kubernetes-native-migration-tests | PR + push |
| Webhooks | kfp-webhooks | PR + push |
| Other | stale, docs-freshness, readthedocs-builds, ai_analyzer | Various |

**Automation Patterns:**
- **Concurrency control**: 29/42 workflows use `cancel-in-progress: true`
- **Path-based triggers**: All PR workflows use `paths:` filters for efficiency
- **Matrix strategies**: 10+ workflows use matrix strategies
- **Test sharding**: E2E tests sharded across runners (ShardA/ShardB)
- **Caching**: pip cache via composite actions, Kind node image caching, GitHub artifact caching
- **Timeout enforcement**: 7+ workflows set `timeout-minutes`
- **Reusable workflows**: `image-builds.yml` called by multiple workflows
- **CI health monitoring**: `ci-health-report.yml` for CI system observability
- **AI analyzer**: `ai_analyzer.yml` for automated code analysis

**Strengths:**
- Comprehensive PR-triggered test coverage
- Efficient path-based filtering avoids unnecessary CI runs
- Test parallelization at multiple levels (Ginkgo nodes, matrix, sharding)
- Reusable workflow pattern reduces duplication
- CI health monitoring for system reliability

**Gaps:**
- 13/42 workflows lack concurrency control (some are intentional, e.g., release workflows)
- Only 1 workflow explicitly uses `cache:` action (though composite actions handle caching)

### Static Analysis

**Score: 7/10**

#### Linting

**Go - golangci-lint v2.10:**
- Enabled linters: gocritic, govet, ineffassign, misspell, staticcheck, unused
- Formatters: gofmt, goimports
- 30-minute timeout
- Exclusions: api generated files
- Run via pre-commit hook and dedicated CI workflow

**Python:**
- flake8 (W605 only - invalid escape sequences)
- isort (Google profile)
- yapf (Google-style formatting)
- pycln (unused import removal)
- docformatter
- pylintrc (detailed configuration, but not run in CI)
- mypy (basic: `ignore_missing_imports = true`)

**Frontend:**
- No ESLint configuration found (frontend relies on TypeScript strict mode)

**Pre-commit Hooks:**
- `.pre-commit-config.yaml` with comprehensive hooks
- check-yaml, check-json, end-of-file-fixer, trailing-whitespace
- debug-statements, check-merge-conflict
- no-commit-to-branch (master protection)
- actionlint for GitHub Actions validation
- golangci-lint with --fix

#### FIPS Compatibility

| Check | Status |
|-------|--------|
| FIPS build tags (`-tags=fips`) | Not present |
| `GOEXPERIMENT=boringcrypto` | Not present |
| `CGO_ENABLED=1` with BoringSSL | Not present |
| `crypto/md5` imports | Not found in core code |
| `math/rand` in security context | Test utilities only (acceptable) |
| `hashlib.md5` (Python) | google-cloud components only (not core) |
| UBI base images | 1 of 20+ Dockerfiles (frontend only) |
| Alpine/Debian base images | Majority of Dockerfiles |

**FIPS Assessment**: No FIPS build infrastructure. Most Dockerfiles use alpine or debian base images that are not FIPS-capable out of the box. Crypto usage in core code is clean, but binaries are not compiled with FIPS-compliant crypto libraries.

#### Dependency Alerts

- **Dependabot**: Configured for `gomod` ecosystem across 5 directories
  - Grouped updates: `golang.org/x/*` together, minor/patch batched
  - Weekly schedule, 10 PR limit
  - Commit prefix: `chore(deps)`
- **Renovate**: Not configured
- **npm/pip**: Not covered by Dependabot

### Agent Rules

**Score: 9/10**

**Files Present:**
- `AGENTS.md` (44KB) - Comprehensive agent guide
- `CLAUDE.md` - Symlink to AGENTS.md
- No `.claude/` directory or `.claude/rules/`

**AGENTS.md Coverage:**

| Section | Content |
|---------|---------|
| Architecture | Baseline architecture, end-to-end flow, package naming |
| Development | Local setup, cluster deployment (standalone + dev modes) |
| Testing | Backend Ginkgo suites, SDK tests, frontend tests, local execution |
| Build | Protobuf regeneration, generated files policy |
| CI/CD | Workflow overview, testing matrix documentation |
| Frontend | Prerequisites, setup, development workflows |
| Policies | Code reuse, architectural boundaries, testing, commits |

**Strengths:**
- One of the most thorough AGENTS.md files in the ecosystem
- Includes testing policy with clear guidelines for agents
- Architecture documentation with end-to-end flow
- Local development and testing instructions
- Generated file policy prevents accidental edits
- Maintenance instructions for keeping the guide current

**Gaps:**
- No `.claude/rules/` directory for file-pattern-triggered rules
- No `.claude/skills/` for custom analysis skills
- All rules in a single large file rather than modular per-concern rules
- Could benefit from separate rule files for Go tests, Python tests, frontend tests

## Recommendations

### Priority 0 (Critical)

1. **Implement Codecov with threshold enforcement**
   - Add `.codecov.yml` with project/patch targets
   - Add `codecov/codecov-action@v4` to backend, SDK, and frontend test workflows
   - Set minimum coverage threshold (start at 60%, increase over time)
   - Enable PR coverage comments for visibility

2. **Add container runtime validation**
   - Add HEALTHCHECK instructions to all production Dockerfiles
   - Consider adding container startup validation in CI (e.g., `docker run --health-cmd`)
   - Add readiness/liveness probe definitions in Kubernetes manifests where missing

3. **Migrate base images to UBI for FIPS readiness**
   - Replace `alpine` and `debian` base images with `registry.access.redhat.com/ubi9/ubi-minimal` for downstream FIPS compliance
   - Document base image selection policy in AGENTS.md

### Priority 1 (High Value)

4. **Expand Dependabot to npm and pip ecosystems**
   - Add npm ecosystem for `/frontend` directory
   - Add pip ecosystem for `/sdk/python` directory
   - Apply same grouping and scheduling patterns as gomod

5. **Add FIPS build infrastructure**
   - Add `GOEXPERIMENT=boringcrypto` and `CGO_ENABLED=1` build variants
   - Create FIPS-specific Dockerfile variants or build args
   - Add CI job to verify FIPS-compliant builds

6. **Create .claude/rules/ directory**
   - `go-tests.md` - Ginkgo patterns, table-driven tests, test isolation
   - `python-sdk-tests.md` - pytest patterns, fixtures, parametrize
   - `frontend-tests.md` - Vitest + Testing Library patterns, component testing
   - `e2e-tests.md` - Kind cluster setup, Ginkgo E2E patterns

7. **Add Konflux build simulation to PR workflows**
   - Simulate production build constraints in PR checks
   - Validate UBI base image compatibility
   - Test FIPS-compliant binary compilation

### Priority 2 (Nice-to-Have)

8. **Enable additional golangci-lint linters**
   - Add `errcheck`, `gosimple`, `exhaustive` for more comprehensive static analysis
   - Currently only 6 linters enabled out of 50+ available

9. **Add contract tests for API boundaries**
   - Test proto/gRPC contract between SDK and API server
   - Validate REST API swagger spec against implementation
   - Add backward compatibility checks for API changes

10. **Implement performance regression testing**
    - Track pipeline compilation time
    - Monitor API server response latency
    - Benchmark pipeline execution overhead

11. **Integrate frontend coverage into CI**
    - The `coverage:baseline` and `coverage:compare` scripts exist but are not run in CI
    - Add coverage step to `frontend.yml` workflow

## Comparison to Gold Standards

| Dimension | kubeflow/pipelines | odh-dashboard | notebooks | kserve |
|-----------|-------------------|---------------|-----------|--------|
| Unit Tests | 7 - Good multi-lang coverage | 9 - Comprehensive with contracts | 6 - Basic | 8 - Strong Go tests |
| Integration/E2E | 9 - Multi-version matrices | 8 - Multi-layer testing | 7 - Image validation | 9 - Multi-version |
| Build Integration | 7 - PR builds + kustomize | 8 - Full build pipeline | 7 - Image builds | 7 - Operator bundle |
| Image Testing | 5 - Multi-arch, no runtime | 7 - Container validation | 9 - 5-layer validation | 6 - Basic builds |
| Coverage Tracking | 4 - Tools but no enforcement | 8 - Codecov with thresholds | 5 - Basic | 8 - Enforced |
| CI/CD Automation | 9 - 42 workflows, sharding | 9 - Comprehensive | 7 - Adequate | 8 - Good automation |
| Static Analysis | 7 - golangci + pre-commit | 8 - ESLint + strict TS | 6 - Basic | 7 - golangci |
| Agent Rules | 9 - 44KB AGENTS.md | 9 - Rules + skills | 3 - Minimal | 5 - Basic CLAUDE.md |
| **Overall** | **7.3** | **8.5** | **6.5** | **7.5** |

**Key Differentiators:**
- kubeflow/pipelines has the most comprehensive E2E test matrix in the ecosystem
- CI/CD automation is among the best with 42 workflows and extensive test sharding
- AGENTS.md is exceptionally detailed compared to most projects
- Coverage tracking is the weakest dimension - needs enforcement infrastructure
- Image testing needs runtime validation to match notebooks' 5-layer approach

## File Paths Reference

### CI/CD Workflows
- `.github/workflows/api-server-tests.yml` - API server integration tests
- `.github/workflows/e2e-test.yml` - End-to-end pipeline tests
- `.github/workflows/e2e-test-frontend.yml` - Frontend E2E tests
- `.github/workflows/frontend.yml` - Frontend unit tests
- `.github/workflows/presubmit-backend.yml` - Backend Go tests
- `.github/workflows/kfp-sdk-tests.yml` - SDK integration tests
- `.github/workflows/kfp-sdk-unit-tests.yml` - SDK unit tests
- `.github/workflows/image-builds.yml` - Reusable image build workflow
- `.github/workflows/pre-commit.yml` - Pre-commit checks
- `.github/workflows/kubeflow-pipelines-manifests.yml` - Kustomize validation

### Test Files
- `backend/test/end2end/` - E2E tests (Ginkgo)
- `backend/test/v2/api/` - V2 API tests (Ginkgo)
- `backend/test/integration/` - V1 integration tests
- `backend/test/compiler/` - Compiler tests (Ginkgo)
- `sdk/python/test/` - Python SDK tests (pytest)
- `frontend/src/` - Frontend tests (Vitest, co-located)
- `test/frontend-integration-test/` - Frontend E2E (WebdriverIO)
- `test/server-integration-test/` - Server integration

### Configuration
- `.golangci.yaml` - Go linter configuration
- `.pre-commit-config.yaml` - Pre-commit hooks
- `pytest.ini` - pytest configuration
- `mypy.ini` - mypy type checking
- `.pylintrc` - pylint configuration
- `.github/dependabot.yml` - Dependabot (gomod)
- `Makefile` - Build targets
- `justfile` - Developer convenience commands

### Container Images
- `backend/Dockerfile` - API server
- `backend/Dockerfile.driver` - Pipeline driver
- `backend/Dockerfile.launcher` - Pipeline launcher
- `backend/Dockerfile.persistenceagent` - Persistence agent
- `backend/Dockerfile.cacheserver` - Cache server
- `frontend/Dockerfile` - Frontend (UBI9 nginx)
- `proxy/Dockerfile` - Inverting proxy

### Agent Rules
- `AGENTS.md` - Comprehensive agent guide (44KB)
- `CLAUDE.md` - Symlink to AGENTS.md
