---
repository: "opendatahub-io/odh-model-controller"
overall_score: 6.7
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Strong test suite with 67 test files, Ginkgo/Gomega + testify, envtest for controllers"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "3 E2E suites with Kind, PR-triggered xKS and AuthPolicy E2E, but main E2E is manual-only"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time Docker builds for both images, Kustomize validation, but no Konflux simulation on PR"
  - dimension: "Image Testing"
    score: 6.0
    status: "Multi-stage UBI9 builds, 4-arch support on push, FIPS for server binary, no runtime validation"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "coverprofile generated locally but no CI reporting, no thresholds, no codecov integration"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "9 PR-triggered workflows with concurrency control, Docker caching, but no matrix or Go caching"
  - dimension: "Static Analysis"
    score: 7.0
    status: "golangci-lint v2 with 18 linters, pre-commit hooks, FIPS tags for server, missing Dependabot"
  - dimension: "Agent Rules"
    score: 8.0
    status: "Excellent AGENTS.md with testing patterns, project structure, and constraints"
critical_gaps:
  - title: "No coverage tracking or enforcement in CI"
    impact: "Coverage regressions go undetected; no PR-level feedback on test gaps"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Main controller E2E workflow is manual-only (workflow_dispatch)"
    impact: "Controller E2E regressions not caught automatically on PRs"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No Dependabot or Renovate for dependency alerts"
    impact: "Vulnerable dependencies may go unpatched; manual dependency tracking required"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No container runtime validation or startup testing"
    impact: "Image startup failures not caught until deployment"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "Main Containerfile lacks FIPS build configuration"
    impact: "Controller binary may not be FIPS-compliant in regulated environments"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add Codecov integration with coverage thresholds"
    effort: "2-4 hours"
    impact: "Automated coverage reporting on PRs with regression detection"
  - title: "Enable Dependabot for Go modules and Docker base images"
    effort: "1-2 hours"
    impact: "Automated dependency update PRs and vulnerability alerts"
  - title: "Add FIPS build tags to main Containerfile"
    effort: "1-2 hours"
    impact: "Consistent FIPS compliance across both binaries"
  - title: "Add Go module cache to test and lint workflows"
    effort: "1 hour"
    impact: "Faster CI runs by caching Go module downloads"
recommendations:
  priority_0:
    - "Add Codecov integration with .codecov.yml and coverage thresholds to enforce minimum coverage on PRs"
    - "Enable the main controller E2E workflow (test-e2e.yml) on pull_request trigger, not just workflow_dispatch"
    - "Add FIPS build configuration (GOEXPERIMENT=strictfipsruntime, -tags strictfipsruntime) to main Containerfile"
  priority_1:
    - "Configure Dependabot for gomod and docker ecosystems"
    - "Add multi-version K8s testing via matrix strategy in E2E workflows"
    - "Add container runtime validation (image startup smoke test) in PR build workflow"
    - "Add Go module caching to test.yml and lint.yml workflows"
  priority_2:
    - "Add .claude/rules/ with specific test pattern rules for unit, envtest, and E2E tests"
    - "Add Testcontainers for container image runtime validation"
    - "Add HEALTHCHECK instruction to Containerfiles for container orchestrator health awareness"
---

# Quality Analysis: odh-model-controller

## Executive Summary

- **Overall Score: 6.7/10**
- **Repository**: [opendatahub-io/odh-model-controller](https://github.com/opendatahub-io/odh-model-controller)
- **Type**: Kubernetes Operator (Go, controller-runtime)
- **Jira**: RHOAIENG / Serving Orchestration (midstream)
- **Key Strengths**: Comprehensive unit/envtest suite (67 test files, 648 Describe blocks), strong linting with 18 linters, excellent AGENTS.md documentation, FIPS compliance for server binary, multi-arch builds, PR-time Docker builds and Kustomize validation
- **Critical Gaps**: No coverage tracking in CI, main E2E workflow is manual-only, no Dependabot/Renovate, main controller binary lacks FIPS build tags
- **Agent Rules Status**: Present (CLAUDE.md + comprehensive AGENTS.md)

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.0/10 | 15% | 1.20 | Strong test coverage with Ginkgo/Gomega + testify |
| Integration/E2E | 7.0/10 | 20% | 1.40 | 3 E2E suites, Kind-based, but main E2E is manual |
| Build Integration | 7.0/10 | 15% | 1.05 | PR Docker builds, manifest validation, no Konflux sim |
| Image Testing | 6.0/10 | 10% | 0.60 | Multi-arch UBI9, FIPS server, no runtime validation |
| Coverage Tracking | 3.0/10 | 10% | 0.30 | Local coverprofile only, no CI tracking |
| CI/CD Automation | 7.0/10 | 15% | 1.05 | 9 PR workflows, concurrency control, no matrix |
| Static Analysis | 7.0/10 | 10% | 0.70 | 18 linters, pre-commit, missing Dependabot |
| Agent Rules | 8.0/10 | 5% | 0.40 | Excellent AGENTS.md with testing guidance |
| **Overall** | **6.7/10** | **100%** | **6.70** | |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement in CI
- **Impact**: Coverage regressions go undetected; no PR-level feedback on test gaps
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: `make test` generates `cover.out` with `--coverprofile` and `--coverpkg=./...`, but no `.codecov.yml` exists, no `codecov/codecov-action` in workflows, and no coverage thresholds are enforced. Coverage data is generated but never uploaded or reported.

### 2. Main Controller E2E Workflow is Manual-Only
- **Impact**: Controller E2E regressions not caught automatically on PRs
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: `test-e2e.yml` has `on: workflow_dispatch` only (push/pull_request are commented out). While `e2e-test-odh-xks-kind.yml` (xKS smoke tests) and `test-authpolicy-e2e.yml` run on PRs, the main controller E2E suite (Model Registry sync, metrics, routes) requires manual triggering.

### 3. No Dependabot or Renovate Configuration
- **Impact**: Vulnerable dependencies may go unpatched; manual dependency tracking required
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: No `.github/dependabot.yml`, `renovate.json`, `.renovaterc`, or `.renovaterc.json` found. Go module and Docker base image updates must be tracked manually.

### 4. No Container Runtime Validation
- **Impact**: Image startup failures not caught until deployment
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: PR build workflow builds both images (`push: false`) but does not verify they start correctly. No Testcontainers, `docker run` smoke tests, or health check validation exists.

### 5. Main Containerfile Lacks FIPS Build Configuration
- **Impact**: Controller binary may not be FIPS-compliant in regulated environments
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: `Containerfile.server` correctly uses `GOEXPERIMENT=strictfipsruntime` and `-tags strictfipsruntime`, but `Containerfile` (the main controller) uses `CGO_ENABLED=0` with no FIPS tags. This creates an inconsistency between the two binaries.

## Quick Wins

### 1. Add Codecov Integration with Coverage Thresholds
- **Effort**: 2-4 hours
- **Impact**: Automated coverage reporting on PRs with regression detection
- **Implementation**:
  ```yaml
  # .codecov.yml
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
  Add `codecov/codecov-action@v4` step to `test.yml` after `make test`:
  ```yaml
  - name: Upload coverage
    uses: codecov/codecov-action@v4
    with:
      files: cover.out
      fail_ci_if_error: false
    env:
      CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}
  ```

### 2. Enable Dependabot for Go Modules and Docker
- **Effort**: 1-2 hours
- **Impact**: Automated dependency update PRs and vulnerability alerts
- **Implementation**:
  ```yaml
  # .github/dependabot.yml
  version: 2
  updates:
    - package-ecosystem: "gomod"
      directory: "/"
      schedule:
        interval: "weekly"
      open-pull-requests-limit: 10
    - package-ecosystem: "docker"
      directory: "/"
      schedule:
        interval: "weekly"
    - package-ecosystem: "github-actions"
      directory: "/"
      schedule:
        interval: "weekly"
  ```

### 3. Add FIPS Build Tags to Main Containerfile
- **Effort**: 1-2 hours
- **Impact**: Consistent FIPS compliance across both binaries
- **Implementation**: In `Containerfile`, change:
  ```dockerfile
  RUN CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64} go build -a -o manager cmd/main.go
  ```
  to:
  ```dockerfile
  RUN CGO_ENABLED=1 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64} \
      GOEXPERIMENT=strictfipsruntime \
      go build -tags strictfipsruntime -a -o manager cmd/main.go
  ```

### 4. Add Go Module Cache to CI Workflows
- **Effort**: 1 hour
- **Impact**: Faster CI runs by caching Go module downloads
- **Implementation**: The `actions/setup-go@v5` action already caches by default when `go-version-file` is set. Verify it's active; if not, add explicit caching.

## Detailed Findings

### Unit Tests

**Score: 8.0/10**

| Metric | Value |
|--------|-------|
| Test files | 67 |
| Source files (non-test) | 120 |
| Test-to-code ratio | 0.56 |
| Describe/Context/It blocks | 648 |
| BeforeEach/AfterEach usages | 119 |
| Suite test files | 10+ |

**Frameworks**: Ginkgo v2 + Gomega (primary), testify assert/require (secondary for pure-logic tests)

**Testing Styles** (documented in AGENTS.md):
1. **Standard Go tests** (`func Test...` + testify) for pure logic: comparators, utilities, cert helpers, resource builders, gateway filtering
2. **Ginkgo + envtest** for controllers/webhooks that need a real API server: reconcile loops, watches, webhook admission

**Strengths**:
- Well-organized with `suite_test.go` in each package
- envtest properly configured with CRD loading, webhook install options, and scheme setup
- Custom testing framework in `internal/controller/testing/` with `Config`, `Client`, `Cleaner`, `WithCRDs`, `WithScheme` builders
- Custom Gomega matchers in `test/matchers/`
- Test CRDs for optional APIs (EnvoyFilter, AuthPolicy, Gateway API) in `test/crds/`
- LLM controller has dedicated `fixture/` package with fluent builders

**Gaps**:
- No coverage threshold enforcement
- Some test files are quite large (inferenceservice_controller_test.go)

### Integration/E2E Tests

**Score: 7.0/10**

**E2E Suites**:
| Suite | Location | Trigger | Infrastructure |
|-------|----------|---------|----------------|
| xKS Smoke Tests | `test/scripts/kind/` | PR (path-filtered) | Kind cluster |
| AuthPolicy E2E | `internal/controller/test/e2e/` | PR (path-filtered, incubating only) | Kind + Istio + Kuadrant + MetalLB |
| Controller E2E | `test/e2e/` | Manual (workflow_dispatch) | Kind cluster |
| Server E2E | `server/test/e2e/` | Manual (requires deployed server) | Live cluster |

**Strengths**:
- xKS smoke tests run automatically on PRs with path filtering
- AuthPolicy E2E is comprehensive: installs MetalLB, cert-manager, Gateway API CRDs, Istio, Kuadrant, creates Gateway, deploys AuthPolicy, runs Go tests
- Model Registry E2E tests verify controller + external service integration
- Good log collection on failure in E2E workflows
- Build tags (`//go:build e2e`) properly separate E2E from unit tests

**Gaps**:
- Main controller E2E (`test-e2e.yml`) is workflow_dispatch only
- No multi-version Kubernetes testing (single version only)
- Server E2E requires manual `oc login` and deployed server
- KServe OCP E2E target exists but no CI workflow

### Build Integration

**Score: 7.0/10**

**PR-Time Validation**:
| Check | Status | Details |
|-------|--------|---------|
| Docker image build | Yes | Both `Containerfile` and `Containerfile.server` built on PR (`push: false`) |
| Kustomize manifest validation | Yes | `validate-manifests.yml` runs `hack/validate-manifests.sh` on all overlays |
| Go module tidy check | Yes | `go mod tidy` + `git diff --exit-code` in `test.yml` |
| Image tag verification | Yes | `verify-odh-model-controller-img-tag.yaml` validates `params.env` on PR |
| Konflux simulation | No | Tekton pipeline only triggers on push to incubating or `/build-konflux` comment |
| CRD install validation | No | Not validated on PR (only in manual E2E) |

**Strengths**:
- Docker Buildx with GHA caching (`cache-from: type=gha`, `cache-to: type=gha,mode=max`)
- Both images validated buildable on every PR
- Kustomize build validation across all overlays catches manifest errors
- Image tag consistency verification prevents config drift

**Gaps**:
- No PR-time Konflux build simulation
- Tekton pipeline runs only on push or manual comment trigger

### Image Testing

**Score: 6.0/10**

| Aspect | Status | Details |
|--------|--------|---------|
| Multi-stage builds | Yes | Builder + minimal runtime in both Containerfiles |
| Base images | UBI9 | `registry.access.redhat.com/ubi9/go-toolset:1.25` (builder), `ubi9/ubi-minimal` (runtime) |
| Multi-arch | Yes (push) | `linux/amd64,linux/arm64,linux/ppc64le,linux/s390x` on push; `linux/amd64` on PR |
| FIPS (server) | Yes | `GOEXPERIMENT=strictfipsruntime`, `-tags strictfipsruntime` in Containerfile.server |
| FIPS (controller) | No | `CGO_ENABLED=0`, no FIPS tags in main Containerfile |
| Non-root user | Yes | `USER 65532:65532` (controller), `USER 1000:1000` (server) |
| HEALTHCHECK | No | Not in Containerfiles |
| Runtime validation | No | No startup testing, Testcontainers, or `docker run` smoke tests |
| .dockerignore | Yes | Excludes tests, .git, .github, Makefile, docs |

**Strengths**:
- Pin digest on base images for reproducible builds
- UBI9 base images are FIPS-capable
- Proper non-root user configuration
- Four-architecture support for production builds
- Health probes defined in K8s manifests (runtime templates, server deployment)

**Gaps**:
- Controller binary not built with FIPS tags
- No container runtime validation in CI
- No HEALTHCHECK instruction

### Coverage Tracking

**Score: 3.0/10**

| Aspect | Status |
|--------|--------|
| Coverage generation | Yes (`--coverprofile cover.out --coverpkg=./...`) |
| .codecov.yml | No |
| CI upload | No |
| PR reporting | No |
| Threshold enforcement | No |
| Coverage gates | No |

The `make test` target generates `cover.out` with full package coverage (`-coverpkg=./...`), but this data is never uploaded, reported, or used for gating. This is the most impactful quick win available.

### CI/CD Automation

**Score: 7.0/10**

**Workflow Inventory**:
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | push, PR | Unit + envtest tests |
| `lint.yml` | push, PR | golangci-lint |
| `build.yaml` | push, PR | Docker image builds |
| `validate-manifests.yml` | push, PR | Kustomize manifest validation |
| `e2e-test-odh-xks-kind.yml` | PR (path-filtered) | xKS smoke tests on Kind |
| `test-authpolicy-e2e.yml` | PR (incubating, path-filtered) | AuthPolicy E2E with Kind + Istio |
| `verify-odh-model-controller-img-tag.yaml` | PR | Image tag consistency check |
| `disconnected-readiness.yml` | PR | Disconnected readiness scoring |
| `unicode-safety.yml` | PR | Hidden unicode character detection |
| `test-e2e.yml` | workflow_dispatch | Main controller E2E (manual) |
| `odh-release.yaml` | workflow_dispatch | Release automation |
| `component-metadata-version-update.yml` | workflow_dispatch | Component version updates |
| `runtime-version-update.yml` | workflow_dispatch | Runtime version updates |
| `prow-merge-incubating-with-main.yaml` | workflow_dispatch | Branch sync |

**Strengths**:
- 9 workflows run automatically on PRs
- Concurrency control on E2E and validation workflows with `cancel-in-progress: true`
- Timeouts set on E2E workflows (20-30 min)
- Docker buildx caching (GHA)
- Path-based filtering on E2E workflows (avoids unnecessary runs)
- Comprehensive log collection on E2E failures

**Gaps**:
- No matrix strategy for multi-version K8s testing
- No Go module caching in test/lint workflows (relies on setup-go default)
- No test parallelization configuration in CI
- Main E2E workflow not automated

### Static Analysis

**Score: 7.0/10**

**Linting** (golangci-lint v2, `.golangci.yml`):
18 linters enabled: `copyloopvar`, `dupl`, `errcheck`, `ginkgolinter`, `goconst`, `gocyclo`, `govet`, `ineffassign`, `lll`, `misspell`, `nakedret`, `prealloc`, `revive`, `staticcheck`, `unconvert`, `unparam`, `unused`

Formatters: `gofmt`, `goimports`

Notable: `ginkgolinter` enabled (ensures Ginkgo best practices)

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- `golangci-lint` (v2.11.3)
- `prettier` (v2.4.1)

**FIPS Compatibility**:
| Check | Status |
|-------|--------|
| Non-FIPS crypto imports | Clean (no `crypto/md5`, `crypto/des`, `crypto/rc4`) |
| Server binary FIPS tags | Yes (`GOEXPERIMENT=strictfipsruntime`, `-tags strictfipsruntime`) |
| Controller binary FIPS tags | No (`CGO_ENABLED=0`, no FIPS experiment) |
| UBI9 base images | Yes (FIPS-capable) |

**Dependency Alerts**:
| Tool | Status |
|------|--------|
| Dependabot | Not configured |
| Renovate | Not configured |

**Additional Security**:
- Unicode safety check workflow (detects hidden unicode characters in PRs)
- Disconnected readiness scoring on PRs

### Agent Rules

**Score: 8.0/10**

| Aspect | Status | Details |
|--------|--------|---------|
| CLAUDE.md | Present | Points to AGENTS.md |
| AGENTS.md | Excellent | Comprehensive project documentation |
| .claude/rules/ | Absent | No specific test pattern rules |
| .claude/skills/ | Absent | No custom skills |
| architecture.md | Present | Detailed architecture documentation |

**AGENTS.md Coverage**:
- Project structure with every directory explained
- Build/test/run commands with exact `make` targets
- Two testing styles documented (standard Go tests vs Ginkgo+envtest)
- Framework-specific examples for each test style
- Key patterns: envtest builder, `Eventually`/`Consistently`, `Cleaner`, custom matchers
- Constraints: generated files, external CRDs, Makefile authority, KServe dependency, RawDeployment only
- PR requirements and gotchas
- E2E test commands for all suites

**Gaps**:
- No `.claude/rules/` directory with specific test creation rules
- CLAUDE.md is minimal (just points to AGENTS.md)
- No custom skills for test generation or analysis

## Recommendations

### Priority 0 (Critical)

1. **Add Codecov integration with coverage thresholds** - Install `.codecov.yml` with project/patch targets and add `codecov/codecov-action@v4` to `test.yml`. This is the highest-ROI improvement (2-4 hours, immediate feedback).

2. **Enable main controller E2E on PRs** - Uncomment `push`/`pull_request` triggers in `test-e2e.yml` or create a new PR-triggered workflow that runs the controller E2E suite on Kind. Consider path-filtering to avoid running on docs-only changes.

3. **Add FIPS build configuration to main Containerfile** - Match `Containerfile.server`'s FIPS configuration (`GOEXPERIMENT=strictfipsruntime`, `-tags strictfipsruntime`, `CGO_ENABLED=1`) in the main `Containerfile` for consistent FIPS compliance.

### Priority 1 (High Value)

4. **Configure Dependabot** - Add `.github/dependabot.yml` covering `gomod`, `docker`, and `github-actions` ecosystems with weekly schedule.

5. **Add multi-version K8s testing** - Add matrix strategy to E2E workflows testing against multiple K8s/KinD node image versions (e.g., 1.30, 1.31, 1.32).

6. **Add container runtime validation** - After building images in PR workflow, add a step that runs the container and validates it starts (e.g., `docker run --rm -d` + health check + `docker stop`).

7. **Add Go module caching** - Verify `actions/setup-go@v5` cache is active in `test.yml` and `lint.yml`, or add explicit `actions/cache` for `~/go/pkg/mod`.

### Priority 2 (Nice-to-Have)

8. **Create .claude/rules/ for test patterns** - Add specific rules for unit test patterns (testify style), envtest patterns (Ginkgo + testing.Configure builder), and E2E patterns (build tags, Kind setup).

9. **Add Testcontainers for image validation** - Use Testcontainers in Go to validate both container images start and respond to health checks.

10. **Add HEALTHCHECK to Containerfiles** - Add `HEALTHCHECK` instructions for container orchestrator awareness, complementing existing K8s probes.

## Comparison to Gold Standards

| Dimension | odh-model-controller | odh-dashboard (gold) | notebooks (gold) | kserve (gold) |
|-----------|---------------------|---------------------|-------------------|---------------|
| Unit Tests | 8/10 | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 7/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 7/10 | 8/10 | 7/10 | 8/10 |
| Image Testing | 6/10 | 7/10 | 9/10 | 7/10 |
| Coverage Tracking | 3/10 | 8/10 | 6/10 | 9/10 |
| CI/CD Automation | 7/10 | 9/10 | 8/10 | 9/10 |
| Static Analysis | 7/10 | 8/10 | 7/10 | 8/10 |
| Agent Rules | 8/10 | 9/10 | 5/10 | 6/10 |
| **Overall** | **6.7** | **8.5** | **7.2** | **8.2** |

**Key gaps vs gold standards**:
- **vs odh-dashboard**: Missing coverage enforcement, contract tests, and automated E2E on all PRs
- **vs notebooks**: Missing image runtime validation and multi-layer image testing
- **vs kserve**: Missing coverage enforcement and multi-version K8s testing matrix

## File Paths Reference

### CI/CD
- `.github/workflows/test.yml` - Unit + envtest tests
- `.github/workflows/lint.yml` - golangci-lint
- `.github/workflows/build.yaml` - Docker image builds
- `.github/workflows/validate-manifests.yml` - Kustomize validation
- `.github/workflows/e2e-test-odh-xks-kind.yml` - xKS E2E smoke tests
- `.github/workflows/test-authpolicy-e2e.yml` - AuthPolicy E2E
- `.github/workflows/test-e2e.yml` - Main controller E2E (manual)
- `.github/workflows/unicode-safety.yml` - Unicode safety check
- `.github/workflows/disconnected-readiness.yml` - Disconnected readiness
- `.tekton/odh-model-controller-push.yaml` - Konflux/Tekton pipeline

### Testing
- `internal/controller/serving/*_test.go` - Controller tests (Ginkgo + envtest)
- `internal/controller/nim/*_test.go` - NIM controller tests
- `internal/webhook/serving/v1beta1/*_test.go` - Webhook tests
- `internal/controller/testing/` - Shared envtest framework
- `test/e2e/` - Controller E2E suite
- `server/test/e2e/` - Server E2E suite
- `internal/controller/test/e2e/` - AuthPolicy E2E suite
- `test/crds/` - Test CRDs for optional APIs
- `test/matchers/` - Custom Gomega matchers

### Container Images
- `Containerfile` - Main controller image (UBI9, multi-arch)
- `Containerfile.server` - model-serving-api image (UBI9, FIPS-enabled)
- `.dockerignore` - Build context exclusions

### Static Analysis
- `.golangci.yml` - golangci-lint v2 configuration (18 linters)
- `.pre-commit-config.yaml` - Pre-commit hooks (golangci-lint + prettier)

### Agent Rules
- `CLAUDE.md` - Points to AGENTS.md
- `AGENTS.md` - Comprehensive project documentation
- `architecture.md` - Detailed architecture documentation

### Build
- `Makefile` - Build, test, lint, deploy targets
- `hack/validate-manifests.sh` - Kustomize validation script
- `config/` - Kustomize overlays (17 kustomization.yaml files)
