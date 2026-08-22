---
repository: "opendatahub-io/data-science-pipelines"
overall_score: 7.1
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "587 test files across Go/Python/TypeScript with testify, pytest, and vitest frameworks"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Comprehensive E2E with Kind clusters, Ginkgo, multi-version matrix, and PR-triggered pipelines"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR image builds for 5+ components, Kind deployment, but Tekton/Konflux is push-only"
  - dimension: "Image Testing"
    score: 6.0
    status: "Multi-stage builds with UBI9 base images, but no runtime validation or HEALTHCHECK"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "pytest-cov and vitest coverage installed but no reporting, thresholds, or enforcement"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "52 workflow files with concurrency control, pip caching, matrix strategies, and PR triggers"
  - dimension: "Static Analysis"
    score: 7.0
    status: "golangci-lint v2, comprehensive pre-commit hooks, FIPS enabled, but no Dependabot/Renovate"
  - dimension: "Agent Rules"
    score: 8.0
    status: "Comprehensive 683-line AGENTS.md with testing policy, but no .claude/rules/ test patterns"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Coverage regressions go undetected; no visibility into which code paths lack tests"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No Dependabot or Renovate for dependency alerts"
    impact: "Vulnerable or outdated dependencies may go unnoticed until manual review"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "Tekton/Konflux pipelines only run on push, not on PRs"
    impact: "Konflux build failures discovered only after merge to master"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "No container runtime validation (HEALTHCHECK, startup tests)"
    impact: "Image startup or runtime issues not caught until deployment"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add .codecov.yml with coverage thresholds and PR reporting"
    effort: "2-4 hours"
    impact: "Immediate visibility into coverage trends and regressions on every PR"
  - title: "Enable Dependabot for Go, Python, npm, and Docker ecosystems"
    effort: "1-2 hours"
    impact: "Automated dependency update PRs and vulnerability alerts"
  - title: "Add --coverprofile to Go unit test workflow"
    effort: "1 hour"
    impact: "Go backend coverage tracked alongside existing Python SDK coverage"
  - title: "Create .claude/rules/ with test creation patterns"
    effort: "2-3 hours"
    impact: "Framework-specific test patterns for AI-assisted test generation"
recommendations:
  priority_0:
    - "Implement coverage tracking with codecov integration, thresholds, and PR comments"
    - "Enable Dependabot for gomod, pip, npm, and docker ecosystems"
  priority_1:
    - "Add PR-triggered Tekton pipeline checks to catch Konflux build issues before merge"
    - "Add HEALTHCHECK directives to production Dockerfiles"
    - "Add Go coverage (--coverprofile) to unit test and API server test workflows"
  priority_2:
    - "Create .claude/rules/ with framework-specific test creation rules for Go (Ginkgo/testify), Python (pytest), and TypeScript (vitest)"
    - "Add Go module caching to CI workflows for faster builds"
    - "Consolidate alpine-based utility images to UBI9 for FIPS consistency"
---

# Quality Analysis: data-science-pipelines

## Executive Summary

- **Overall Score: 7.1/10**
- **Repository**: [opendatahub-io/data-science-pipelines](https://github.com/opendatahub-io/data-science-pipelines)
- **Type**: Monorepo (Go backend, Python SDK, TypeScript frontend) - Kubeflow Pipelines midstream fork
- **Tier**: Midstream | **Jira**: RHOAIENG / AI Pipelines
- **Key Strengths**: Exceptional E2E testing infrastructure with Kind clusters, multi-version matrix testing, and 10-node parallel Ginkgo execution. Strong FIPS configuration with `godebug fips140=on` in go.mod. Comprehensive AGENTS.md (683 lines) covering architecture, testing policy, and development workflows. 52 CI/CD workflows with good concurrency and caching.
- **Critical Gaps**: No coverage tracking or enforcement despite tools being installed. No Dependabot/Renovate for dependency alerts. Tekton/Konflux pipelines only trigger on push, not on PRs.
- **Agent Rules Status**: Present - AGENTS.md (683 lines) with CLAUDE.md symlink. No `.claude/rules/` directory.

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 7.0/10 | 15% | 1.05 | 587 test files across Go/Python/TS with testify, pytest, vitest |
| Integration/E2E | 9.0/10 | 20% | 1.80 | Comprehensive E2E with Kind, Ginkgo, multi-version matrix, PR-triggered |
| Build Integration | 7.0/10 | 15% | 1.05 | PR image builds for 5+ components, Kind deployment in E2E |
| Image Testing | 6.0/10 | 10% | 0.60 | 12 multi-stage Dockerfiles, UBI9 base images, no runtime validation |
| Coverage Tracking | 3.0/10 | 10% | 0.30 | pytest-cov/vitest-coverage installed but no reporting or thresholds |
| CI/CD Automation | 8.0/10 | 15% | 1.20 | 52 workflows, concurrency control, pip caching, matrix strategies |
| Static Analysis | 7.0/10 | 10% | 0.70 | golangci-lint v2, comprehensive pre-commit, FIPS enabled, no Dependabot |
| Agent Rules | 8.0/10 | 5% | 0.40 | 683-line AGENTS.md, testing policy, no .claude/rules/ |
| **Overall** | **7.1/10** | **100%** | **7.10** | |

## Critical Gaps

1. **No coverage tracking or enforcement**
   - Impact: Coverage regressions go undetected; no visibility into which code paths lack tests
   - Severity: HIGH
   - Effort: 4-8 hours
   - Details: `pytest-cov` is installed in SDK test workflows and `@vitest/coverage-v8` in frontend, but no `--coverprofile` for Go tests, no `.codecov.yml`, no threshold enforcement, and no PR coverage reporting

2. **No Dependabot or Renovate for dependency alerts**
   - Impact: Vulnerable or outdated dependencies in Go, Python, npm, and Docker may go unnoticed
   - Severity: HIGH
   - Effort: 1-2 hours
   - Details: No `.github/dependabot.yml`, `renovate.json`, or `.renovaterc` found

3. **Tekton/Konflux pipelines only run on push, not on PRs**
   - Impact: Konflux build failures discovered only after merge to master
   - Severity: MEDIUM
   - Effort: 8-12 hours
   - Details: `.tekton/` contains 5 push-only pipeline configs (`on-cel-expression: event == "push"`). PR image builds use GitHub Actions but don't simulate the Konflux build pipeline.

4. **No container runtime validation**
   - Impact: Image startup or runtime issues not caught until deployment
   - Severity: MEDIUM
   - Effort: 4-6 hours
   - Details: No `HEALTHCHECK` in any Dockerfile. No testcontainers or container startup validation. Kind cluster E2E provides implicit validation but only for components deployed to the cluster.

## Quick Wins

1. **Add `.codecov.yml` with coverage thresholds and PR reporting**
   - Effort: 2-4 hours
   - Impact: Immediate visibility into coverage trends and regressions on every PR
   - Implementation:
     ```yaml
     # .codecov.yml
     coverage:
       status:
         project:
           default:
             target: auto
             threshold: 1%
         patch:
           default:
             target: 80%
     comment:
       layout: "reach,diff,flags,files"
       behavior: default
     ```

2. **Enable Dependabot for Go, Python, npm, and Docker ecosystems**
   - Effort: 1-2 hours
   - Impact: Automated dependency update PRs and vulnerability alerts
   - Implementation:
     ```yaml
     # .github/dependabot.yml
     version: 2
     updates:
       - package-ecosystem: "gomod"
         directory: "/"
         schedule:
           interval: "weekly"
       - package-ecosystem: "pip"
         directory: "/sdk/python"
         schedule:
           interval: "weekly"
       - package-ecosystem: "npm"
         directory: "/frontend"
         schedule:
           interval: "weekly"
       - package-ecosystem: "docker"
         directory: "/backend"
         schedule:
           interval: "monthly"
     ```

3. **Add `--coverprofile` to Go unit test workflow**
   - Effort: 1 hour
   - Impact: Go backend coverage tracked alongside existing Python SDK coverage
   - Implementation: Change `go test ./...` to `go test -coverprofile=coverage.out ./...` in `unit-tests.yaml`

4. **Create `.claude/rules/` with test creation patterns**
   - Effort: 2-3 hours
   - Impact: Framework-specific test patterns for AI-assisted test generation
   - Details: Add rules for Go (Ginkgo/Gomega + testify patterns), Python (pytest), and TypeScript (vitest + testing-library)

## Detailed Findings

### Unit Tests

**Score: 7.0/10**

| Language | Source Files | Test Files | Ratio |
|----------|-------------|------------|-------|
| Go | 689 | 171 | 24.8% |
| Python | 1,092 | 254 | 23.3% |
| TypeScript | 452 | 162 | 35.8% |
| **Total** | **2,233** | **587** | **26.3%** |

**Frameworks detected:**
- **Go**: `testing` (stdlib), `testify/assert` (132 imports), `testify/require` (57), `gomega` (25), `ginkgo/v2` (22), `testify/suite` (18)
- **Python**: `pytest` with `pytest-cov`, `pytest-xdist` for parallelization
- **TypeScript**: `vitest` with `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@vitest/coverage-v8`

**PR-triggered test workflows:**
- `unit-tests.yaml` - Go backend unit tests on `backend/**` changes
- `kfp-sdk-unit-tests.yml` - Python SDK unit tests
- `frontend.yml` - Frontend tests
- `api-server-tests.yml` - API server tests (push + PR)
- `compiler-tests.yml` - Pipeline compiler tests

**Strengths**: Good test-to-code ratio across all languages. Multiple testing frameworks well-suited to each language. Frontend ratio (35.8%) is strong.

**Gaps**: Go unit test workflow (`unit-tests.yaml`) uses plain `go test ./...` without coverage profiling. No coverage data collected for Go backend.

### Integration/E2E Tests

**Score: 9.0/10**

**E2E Infrastructure** (flagship: `e2e-test.yml`):
- Kind cluster deployment with KFP operator
- Ginkgo test framework with 10 parallel nodes
- Multi-version Kubernetes testing: v1.31.0 and v1.35.0
- Comprehensive matrix: cache on/off, proxy on/off, storage backends (minio, seaweedfs), pod-to-pod TLS
- Test categories: `E2ECritical`, `E2EEssential`, `E2EParallelNested`, `E2EProxy`, `E2EFailure`
- PR-triggered on backend, API, manifests, and test data changes
- Concurrency control with `cancel-in-progress: true`

**Additional E2E suites:**
- `e2e-test-frontend.yml` - Frontend integration with Selenium/Chromium, multi-K8s version matrix
- `upgrade-test.yml` - Upgrade testing (PR-triggered on relevant paths)
- `kfp-kubernetes-native-migration-tests.yaml` - Migration testing with cert-manager, kustomize deployment
- `integration-tests-v1.yml` - Legacy v1 API integration tests
- `legacy-v2-api-integration-tests.yml` - V2 API integration tests

**Backend integration tests** (`backend/test/integration/`):
- 13 Go test files covering: artifact, experiment, pipeline, pipeline version, run, job, healthz, visualization, webhook APIs
- Database integration tests
- Upgrade scenario testing

**SDK integration tests:**
- `kfp-sdk-client-tests.yml` - SDK client integration
- `kfp-sdk-tests.yml` - Full SDK test suite with 50-minute timeout
- `kfp-kubernetes-library-test.yml` - Kubernetes platform library tests

**Strengths**: One of the most comprehensive E2E setups seen. Multi-version K8s testing, multiple storage backends, proxy/TLS variations, and upgrade testing cover a wide range of real-world scenarios. 10-node parallel execution keeps wall-clock time manageable.

### Build Integration

**Score: 7.0/10**

**PR Build Pipeline:**
1. `build-prs-trigger.yaml` - Fires on `pull_request`, saves PR metadata as artifact
2. `build-prs.yml` - Triggered via `workflow_run`, builds 5+ Docker images per PR:
   - `ds-pipelines-api-server` (backend/Dockerfile)
   - `ds-pipelines-frontend` (frontend/Dockerfile)
   - `ds-pipelines-persistenceagent` (backend/Dockerfile.persistenceagent)
   - `ds-pipelines-scheduledworkflow` (backend/Dockerfile.scheduledworkflow)
   - `ds-pipelines-driver` (backend/Dockerfile.driver)

**E2E Build Validation:**
- E2E workflow calls `image-builds.yml` reusable workflow to build images
- Built images loaded into Kind cluster for full deployment testing
- Kustomize manifests applied with `kubectl apply --dry-run` patterns

**Tekton/Konflux:**
- `.tekton/` directory with 5 PipelineRun configs for Konflux builds
- Currently push-only (`event == "push" && target_branch == "master"`)
- Components: api-server-v2, driver, launcher, persistenceagent-v2, scheduledworkflow-v2

**Build Tools:**
- `Makefile` with targets: `check-diff`, `ginkgo`, backend visualization tests, component YAML tests
- `justfile` with developer convenience commands: `backend-images`, `backend-test`, `kind-standalone`, `kind-dev`

**Strengths**: PR image builds for all main components. Kind cluster integration testing validates full deployment. Clear build pipeline separation between PR and release.

**Gaps**: Tekton/Konflux pipelines are push-only, meaning Konflux-specific build issues (different base images, build args, or security constraints) are not caught until after merge.

### Image Testing

**Score: 6.0/10**

**Dockerfile inventory**: 20+ Dockerfiles across the monorepo

**Multi-stage builds**: 12 Dockerfiles use multi-stage builds, including all main backend components

**Base images**:
| Category | Base Image | FIPS-Capable |
|----------|-----------|--------------|
| Backend (main) | `registry.access.redhat.com/ubi9/go-toolset:1.26.3` (build) + `ubi9/ubi-minimal:9.5` (runtime) | Yes |
| Backend (api-server) | `ubi9/go-toolset` + `ubi9/python-311` + `ubi9/ubi-minimal:9.5` | Yes |
| Backend (legacy) | `golang:1.26.3-alpine` + `alpine:3.21` (viewercontroller, conformance, cacheserver) | No |
| Frontend | `node:${VERSION}-slim` | No |
| Commit checker | `ubi9/go-toolset` + `ubi9/ubi-minimal` | Yes |
| Webhook proxy | `ubi9/nginx-124` | Yes |
| Third-party | Various (minio, envoy, ml-metadata) | N/A |

**Platform support**: `--platform=$BUILDPLATFORM` used in main backend Dockerfiles (scheduledworkflow, persistenceagent, launcher, driver)

**Strengths**: Main production components use UBI9 (FIPS-capable). Multi-stage builds reduce image size. Platform support for cross-compilation.

**Gaps**: No `HEALTHCHECK` directives in any Dockerfile. No container startup validation tests. Some utility images (viewercontroller, conformance, cacheserver) still use alpine base which is not FIPS-capable. No testcontainers or dedicated image validation suite.

### Coverage Tracking

**Score: 3.0/10**

**Coverage tools installed but not tracked:**
- `pytest-cov` installed in: `kfp-sdk-unit-tests.yml`, `kfp-sdk-tests.yml`, `kfp-sdk-client-tests.yml`
- `@vitest/coverage-v8` in frontend `package.json` with `test:ui:coverage` script
- Frontend has `test:ui:coverage:loop` with `--maxWorkers 4` for parallelized coverage

**Missing:**
- No `.codecov.yml` or `codecov.yml` configuration
- No `codecov/codecov-action` in any workflow
- No `--coverprofile` in Go unit test workflow (`go test ./...` without coverage)
- No coverage threshold enforcement
- No PR coverage comments or gates
- No coverage trend tracking

**This is a significant gap** for a monorepo of this size (2,233 source files). Coverage tools are available but the pipeline stops short of collecting, reporting, or enforcing coverage metrics.

### CI/CD Automation

**Score: 8.0/10**

**Workflow inventory**: 52 workflow files in `.github/workflows/`

**PR-triggered workflows**: 37 workflows respond to `pull_request` or `pull_request_target`

**Concurrency control**: 10+ workflows use `concurrency: group/cancel-in-progress: true`

**Caching**: 15+ workflows cache pip dependencies. No Go module caching detected.

**Matrix strategies**: 10+ workflows use matrix strategies for:
- Multiple Python versions
- Multiple Kubernetes versions (v1.31.0, v1.35.0)
- Multiple test categories and configurations
- Multiple storage backends

**Timeouts**: Set on critical workflows (image builds: 30min, SDK tests: 50min, frontend E2E: 60min)

**Additional automation:**
- `stale.yml` for stale issue/PR management
- `add-ci-passed-label.yml` for CI status tracking
- `gh-workflow-approve.yml` for fork workflow approval
- `upstream-sync.yml` for periodic upstream sync (Tuesday 13:03 UTC)
- `go-version-consistency.yml` validates Go version consistency across go.mod and Dockerfiles
- `validate-generated-files.yml` ensures generated protobuf files are up to date

**Strengths**: Extensive automation coverage. Good use of reusable workflows (`workflow_call`). Concurrency control prevents resource waste. Weekly upstream sync keeps the fork current.

**Gaps**: No Go module caching (would speed up Go builds). Some older workflows reference `actions/checkout@v2` or `actions/checkout@v3` instead of `v4`.

### Static Analysis

**Score: 7.0/10**

**Linting configuration:**

*Go (golangci-lint v2):*
- 6 linters enabled: `gocritic`, `govet`, `ineffassign`, `misspell`, `staticcheck`, `unused`
- Formatters: `gofmt`, `goimports`
- Excludes API generated code paths
- 30-minute timeout
- Integrated into pre-commit hooks

*Python:*
- `.pylintrc` (detailed, 13KB)
- `mypy.ini` (minimal)
- `.isort.cfg` with Google profile
- `.style.yapf` formatting
- `flake8` (W605 only - invalid escape sequences)

*Pre-commit hooks* (`.pre-commit-config.yaml`):
- `check-yaml`, `check-json`, `end-of-file-fixer`, `trailing-whitespace`
- `debug-statements`, `check-merge-conflict`, `name-tests-test`, `double-quote-string-fixer`
- `no-commit-to-branch` (blocks direct master commits)
- `flake8` (W605), `pycln`, `isort`, `yapf`, `docformatter`
- `golangci-lint` (run + fmt)
- `actionlint` for GitHub Actions YAML validation

**FIPS Compatibility:**
- `godebug fips140=on` in `go.mod` - **excellent FIPS configuration**
- No non-FIPS crypto imports found (`crypto/md5`, `crypto/des`, `crypto/rc4` all clean)
- `math/rand` only in test utilities (not security-relevant)
- Main backend Dockerfiles use UBI9 base images (FIPS-capable)
- Some utility Dockerfiles still use alpine (not FIPS-capable)

**Dependency Alerts:**
- **No Dependabot configuration** (`.github/dependabot.yml` not found)
- **No Renovate configuration** (`renovate.json`, `.renovaterc` not found)

**Strengths**: Strong pre-commit setup with comprehensive Python and Go hooks. FIPS compliance is well-addressed at both the Go runtime and container image level. `actionlint` validates CI workflow syntax.

**Gaps**: No automated dependency update mechanism. Go linter set is modest (6 linters) compared to comprehensive configurations (20+). Pre-commit workflow (`pre-commit.yml`) is currently disabled (`on: []`).

### Agent Rules

**Score: 8.0/10**

**AGENTS.md** (683 lines, 32KB) - comprehensive guide covering:
- **Testing policy**: Clear expectations for unit tests, test-before-push requirements
- **Commit policy**: DCO sign-off, no AI co-author attribution
- **Code reuse policy**: Explicit guidance against code duplication
- **Architectural boundary policy**: ResourceManager, compiler, ExecutionSpec boundaries
- **Local development**: Complete setup instructions with venv, Make targets
- **Local testing**: Backend Ginkgo suites, SDK tests, frontend tests
- **CI/CD documentation**: Test matrices, cluster setup, code style
- **Troubleshooting**: Common error patterns and fixes
- **Quick reference**: Essential commands and environment variables

**CLAUDE.md** symlinked to AGENTS.md (correct approach)

**Missing:**
- No `.claude/` directory
- No `.claude/rules/` with framework-specific test creation patterns
- No `.claude/skills/` for custom skills
- Testing policy exists but lacks specific patterns/examples for each framework

## Recommendations

### Priority 0 (Critical)

1. **Implement coverage tracking with codecov integration**
   - Add `.codecov.yml` with project and patch targets
   - Add `codecov/codecov-action` to Go unit test, SDK, and frontend workflows
   - Add `--coverprofile=coverage.out` to `unit-tests.yaml`
   - Set minimum patch coverage threshold (e.g., 80%)

2. **Enable Dependabot for automated dependency alerts**
   - Create `.github/dependabot.yml` covering `gomod`, `pip`, `npm`, and `docker` ecosystems
   - Configure weekly schedule for security and dependency updates
   - Consider auto-merge for patch updates

### Priority 1 (High Value)

3. **Add PR-triggered Tekton pipeline validation**
   - Modify `.tekton/` PipelineRun configs to also trigger on PRs (or create PR-specific variants)
   - Catch Konflux-specific build issues before merge

4. **Add HEALTHCHECK directives to production Dockerfiles**
   - Add `HEALTHCHECK` to `backend/Dockerfile`, `backend/Dockerfile.persistenceagent`, etc.
   - Define appropriate health check commands for each service

5. **Add Go coverage profiling to CI**
   - Update `unit-tests.yaml`: `go test -coverprofile=coverage.out ./...`
   - Update `api-server-tests.yml` with coverage flags
   - Upload coverage artifacts to codecov

6. **Migrate alpine-based utility Dockerfiles to UBI9**
   - `backend/Dockerfile.viewercontroller`, `Dockerfile.conformance`, `Dockerfile.cacheserver` use `alpine:3.21`
   - Migrate to `ubi9/ubi-minimal:9.5` for FIPS consistency

### Priority 2 (Nice-to-Have)

7. **Create `.claude/rules/` with framework-specific test patterns**
   - `go-tests.md` - Ginkgo/Gomega patterns, testify conventions, table-driven tests
   - `python-tests.md` - pytest fixtures, parametrize, mock patterns
   - `frontend-tests.md` - vitest + testing-library patterns, component testing
   - Use `/test-rules-generator` to bootstrap these rules

8. **Add Go module caching to CI workflows**
   - Add `actions/setup-go` with `cache: true` or explicit Go module cache
   - Would reduce build times across 10+ Go-related workflows

9. **Enable pre-commit CI workflow**
   - `pre-commit.yml` is currently disabled (`on: []`)
   - Re-enable to enforce pre-commit hooks in CI

10. **Expand golangci-lint configuration**
    - Currently 6 linters enabled; consider adding: `errcheck`, `gosec` (non-SAST mode), `bodyclose`, `noctx`, `exhaustive`

## Comparison to Gold Standards

| Dimension | data-science-pipelines | odh-dashboard (gold) | notebooks (gold) | kserve (gold) |
|-----------|----------------------|---------------------|------------------|---------------|
| Unit Tests | 7.0 - Good ratio, multi-framework | 9.0 - Jest + RTL, high coverage | 7.0 - Good coverage | 8.0 - Go testing + envtest |
| Integration/E2E | 9.0 - Kind + Ginkgo + multi-version | 8.0 - Cypress E2E | 7.0 - Image validation | 9.0 - Multi-version E2E |
| Build Integration | 7.0 - PR builds, Kind deploy | 8.0 - Full build pipeline | 7.0 - Image builds | 7.0 - Operator builds |
| Image Testing | 6.0 - Multi-stage, UBI9, no runtime | 7.0 - Build validation | 9.0 - 5-layer validation | 6.0 - Basic builds |
| Coverage Tracking | 3.0 - Tools installed, no tracking | 9.0 - Codecov + thresholds | 5.0 - Basic coverage | 8.0 - Coverage enforcement |
| CI/CD Automation | 8.0 - 52 workflows, good patterns | 9.0 - Comprehensive automation | 8.0 - Well-organized | 8.0 - Good automation |
| Static Analysis | 7.0 - golangci + pre-commit + FIPS | 8.0 - ESLint + comprehensive | 7.0 - Linting + FIPS | 7.0 - golangci-lint |
| Agent Rules | 8.0 - 683-line AGENTS.md | 9.0 - Comprehensive rules | 3.0 - Minimal | 4.0 - Basic |
| **Overall** | **7.1** | **8.5** | **6.8** | **7.3** |

## File Paths Reference

### CI/CD
- `.github/workflows/` - 52 workflow files
- `.github/workflows/e2e-test.yml` - Main E2E pipeline (Kind + Ginkgo)
- `.github/workflows/build-prs-trigger.yaml` + `build-prs.yml` - PR image build pipeline
- `.github/workflows/unit-tests.yaml` - Go backend unit tests
- `.github/workflows/frontend.yml` - Frontend tests
- `.github/workflows/kfp-sdk-unit-tests.yml` - SDK unit tests
- `.tekton/` - 5 Konflux PipelineRun configs (push-only)

### Testing
- `backend/test/end2end/` - E2E tests (Ginkgo)
- `backend/test/integration/` - API integration tests (Go)
- `backend/test/` - Test utilities, compiler tests
- `sdk/python/test/` - Python SDK tests
- `frontend/src/**/*.test.ts` - Frontend tests (162 files)
- `test/` - E2E infrastructure, scripts, manifests

### Linting & Static Analysis
- `.golangci.yaml` - golangci-lint v2 config (6 linters)
- `.pre-commit-config.yaml` - Comprehensive pre-commit hooks
- `.pylintrc` - Python linting config
- `mypy.ini` - Python type checking
- `.isort.cfg` - Import sorting
- `.style.yapf` - Python formatting

### Container Images
- `backend/Dockerfile` - Main API server (3-stage, UBI9)
- `backend/Dockerfile.driver` - Pipeline driver (UBI9)
- `backend/Dockerfile.launcher` - Pipeline launcher (UBI9)
- `backend/Dockerfile.persistenceagent` - Persistence agent (UBI9)
- `backend/Dockerfile.scheduledworkflow` - Scheduled workflow (UBI9)
- `backend/Dockerfile.cacheserver` - Cache server (alpine - should migrate to UBI9)
- `frontend/Dockerfile` - Frontend (node-slim, 2-stage)

### Agent Rules
- `AGENTS.md` - Comprehensive 683-line guide
- `CLAUDE.md` - Symlink to AGENTS.md

### Build Configuration
- `Makefile` - Root build targets
- `justfile` - Developer convenience commands
- `go.mod` - Go module with `godebug fips140=on`
