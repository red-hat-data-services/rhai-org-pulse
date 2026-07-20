---
repository: "red-hat-data-services/kuberay"
overall_score: 7.3
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "104 test files with envtest-based controller testing, dedicated unit test files, and Go testing + Gomega matchers"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "31 E2E test files across 6 suites, Kind cluster setup, chaos testing via operator-chaos, upgrade testing"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time Docker builds and Kind deployments, Konflux Tekton pipelines, codegen/API docs verification, but no GHA-level Konflux simulation"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage builds with UBI9 base images, multi-arch (amd64/arm64/ppc64le), E2E deploys to Kind, but no explicit container health checks"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "coverprofile generated in Makefile targets but no codecov integration, no thresholds, no PR reporting"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "16 workflow files with concurrency control, draft PR filtering, Tekton pipelines, pre-commit enforcement in CI"
  - dimension: "Static Analysis"
    score: 9.0
    status: "22+ golangci-lint linters, comprehensive pre-commit hooks, Dependabot + Renovate, FIPS strictfipsruntime in all production Dockerfiles"
  - dimension: "Agent Rules"
    score: 7.0
    status: "Comprehensive CLAUDE.md with real code pattern references and build commands, but no .claude/rules/ for test creation"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Coverage regressions go undetected; no PR-level feedback on test coverage changes"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No PR-time Konflux build simulation in GitHub Actions"
    impact: "Konflux-specific build failures (hermetic builds, prefetch) discovered only after merge in Konflux Tekton"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "No container runtime validation tests"
    impact: "Image startup or runtime issues not caught until deployment to actual clusters"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add Codecov integration with PR reporting"
    effort: "2-4 hours"
    impact: "Immediate visibility into coverage regressions on every PR"
  - title: "Add .claude/rules/ test creation rules"
    effort: "2-3 hours"
    impact: "Improved AI-generated test quality matching existing envtest and E2E patterns"
  - title: "Add coverage thresholds to Makefile test targets"
    effort: "1-2 hours"
    impact: "Prevent coverage drops below a minimum baseline"
recommendations:
  priority_0:
    - "Integrate Codecov or Coveralls for PR-level coverage reporting and threshold enforcement"
    - "Add coverage gates to CI workflows that fail PRs below a minimum threshold"
  priority_1:
    - "Add PR-time Konflux build simulation using Dockerfile.konflux in GitHub Actions"
    - "Create .claude/rules/ with test patterns for unit tests (envtest), E2E tests (Kind + Gomega), and webhook tests"
    - "Add container health check validation in E2E tests"
  priority_2:
    - "Add timeout-minutes to all CI jobs for predictable failure behavior"
    - "Consider adding contract tests for the API server REST endpoints"
    - "Add performance regression testing for operator reconciliation loops"
---

# Quality Analysis: red-hat-data-services/kuberay

**Analysis Date**: 2026-07-20
**Repository**: https://github.com/red-hat-data-services/kuberay
**Tier**: Downstream (RHOAIENG / KubeRay component)
**Upstream**: ray-project/kuberay
**Type**: Kubernetes Operator (Go, Kubebuilder)
**Primary Language**: Go 1.24
**Default Branch**: dev

## Executive Summary

- **Overall Score: 7.3/10**
- **Key Strengths**: Comprehensive test suite (104 test files across unit, integration, and E2E), excellent static analysis with 22+ linters, FIPS-compliant builds across all production Dockerfiles, chaos testing via operator-chaos, and a well-written CLAUDE.md with real code pattern references
- **Critical Gaps**: No coverage tracking/enforcement (coverprofile generated but not reported), no Codecov integration, no PR-time Konflux simulation in GitHub Actions
- **Agent Rules Status**: Present (CLAUDE.md is comprehensive), but missing `.claude/rules/` for dedicated test creation guidance

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 8/10 | 15% | 104 test files, envtest controller testing, dedicated *_unit_test.go files |
| Integration/E2E | 8/10 | 20% | 31 E2E files across 6 suites, Kind cluster, chaos testing, upgrade testing |
| Build Integration | 7/10 | 15% | PR-time Docker builds, Konflux Tekton pipelines, codegen verification |
| Image Testing | 7/10 | 10% | Multi-stage UBI9 builds, multi-arch, E2E deploys to Kind |
| Coverage Tracking | 3/10 | 10% | coverprofile in Makefile only — no reporting, thresholds, or enforcement |
| CI/CD Automation | 8/10 | 15% | 16 workflows, concurrency control, Tekton, pre-commit in CI |
| Static Analysis | 9/10 | 10% | 22+ linters, FIPS strictfipsruntime, Dependabot + Renovate |
| Agent Rules | 7/10 | 5% | Comprehensive CLAUDE.md, missing .claude/rules/ |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Severity**: HIGH
- **Impact**: Coverage regressions go undetected. New code can be merged without any test coverage feedback. No historical coverage trend data.
- **Current State**: `--coverprofile cover.out` is present in `ray-operator/Makefile`, `apiserver/Makefile`, and `apiserversdk/Makefile`, but the coverage file is generated locally only. No `.codecov.yml`, no codecov-action in CI, no coverage comments on PRs, no threshold enforcement.
- **Effort**: 4-6 hours
- **Fix**: Add `.codecov.yml` with threshold configuration, add `codecov/codecov-action` step to `test-job.yaml` after the test steps.

### 2. No PR-Time Konflux Build Simulation
- **Severity**: MEDIUM
- **Impact**: Konflux-specific build issues (hermetic builds, gomod prefetch, platform-specific failures) are only discovered when the Tekton pipeline runs post-merge or via `/build-konflux` comment trigger.
- **Current State**: The repo has `Dockerfile.konflux` and Tekton pipelines in `.tekton/`, but the Tekton PR pipeline is triggered only by label (`kfbuild-kuberay`) or comment (`/build-konflux`), not automatically on every PR.
- **Effort**: 8-12 hours
- **Fix**: Add a lightweight GHA job that does `docker build -f ray-operator/Dockerfile.konflux ray-operator/` on PRs to catch basic build failures early.

### 3. No Container Runtime Validation
- **Severity**: MEDIUM
- **Impact**: Image startup issues, missing runtime dependencies, or misconfigured entrypoints are not caught until the image is deployed to a real cluster.
- **Current State**: E2E tests deploy the operator image to Kind and verify it runs, which provides indirect validation. But there are no explicit container health check tests or Testcontainers-based validation.
- **Effort**: 4-6 hours

## Quick Wins

### 1. Add Codecov Integration with PR Reporting
- **Effort**: 2-4 hours
- **Impact**: Immediate visibility into coverage changes on every PR
- **Implementation**:
  ```yaml
  # Add to .github/workflows/test-job.yaml after test steps
  - name: Upload coverage to Codecov
    uses: codecov/codecov-action@v4
    with:
      files: ray-operator/cover.out
      flags: operator
      token: ${{ secrets.CODECOV_TOKEN }}
  ```
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
  ```

### 2. Add .claude/rules/ Test Creation Rules
- **Effort**: 2-3 hours
- **Impact**: Improved AI-generated test quality matching existing envtest and E2E patterns
- **Implementation**: Create `.claude/rules/unit-tests.md` with envtest patterns from `suite_test.go`, and `.claude/rules/e2e-tests.md` with Kind + Gomega patterns from `test/e2e/`. Can use `/test-rules-generator` to bootstrap.

### 3. Add Coverage Thresholds to Makefile
- **Effort**: 1-2 hours
- **Impact**: Prevent coverage drops below baseline
- **Implementation**: Add `go tool cover -func=cover.out | grep total | awk '{print $3}'` check after test target

## Detailed Findings

### Unit Tests

**Score: 8/10**

**Strengths:**
- **104 total test files** with a healthy test-to-source ratio (~47%)
- **Dedicated unit test files** for all major controllers: `raycluster_controller_unit_test.go`, `rayjob_controller_unit_test.go`, `rayservice_controller_unit_test.go`, `networkpolicy_controller_unit_test.go`, `authentication_controller_unit_test.go`
- **envtest-based integration tests** for controllers (`suite_test.go`) and webhooks (`webhook_suite_test.go`) using real Kubernetes API server
- **Go testing + Gomega matchers** throughout, providing clear assertion patterns
- **Multiple modules tested**: ray-operator, apiserver, apiserversdk, kubectl-plugin
- **Coverage generation**: `--coverprofile cover.out` in Makefile test targets
- Test isolation with `t.Parallel()` in some tests (6 instances)
- Race detection enabled in apiserver and kubectl-plugin tests (`-race` flag)

**Gaps:**
- Coverage files are generated but not reported or enforced
- `t.Parallel()` usage is limited (6 instances across 104 test files)
- No table-driven test pattern enforcement

**Key Files:**
- `ray-operator/controllers/ray/suite_test.go` - envtest setup for controllers
- `ray-operator/pkg/webhooks/v1/webhook_suite_test.go` - envtest setup for webhooks
- `ray-operator/Makefile:68` - Test target with coverprofile

### Integration/E2E Tests

**Score: 8/10**

**Strengths:**
- **31 E2E test files** organized across 6 distinct test suites:
  - `ray-operator/test/e2e/` (9 files) - Core RayJob and RayCluster E2E
  - `ray-operator/test/e2eautoscaler/` (2 files) - Autoscaler E2E
  - `ray-operator/test/e2erayservice/` (4 files) - RayService lifecycle E2E
  - `ray-operator/test/e2eupgrade/` (1 file) - Operator upgrade E2E
  - `kubectl-plugin/test/e2e/` (5 files) - kubectl plugin E2E
  - `apiserver/test/e2e/` (10 files) - API server E2E
- **Kind cluster setup** with custom action (`.github/workflows/actions/kind/`)
- **PR-triggered E2E** via `e2e-tests.yaml` running a subset of tests on every PR
- **Post-merge E2E dispatch** to bigger runners via `e2e-dispatch-to-bigger-runner.yml`
- **Chaos testing** via `operator-chaos.yml` - PR-triggered on relevant path changes (controllers, CRDs, cmd)
- **Operator upgrade testing** via `e2eupgrade` suite
- **Helm chart testing** via `helm.yaml` with chart-testing and kubeconform validation
- **Sample YAML validation** tests ensuring example CRs are valid
- **Pre-built test image** via `build-test-image.yaml` with resource adjustment

**Gaps:**
- E2E upgrade dispatch is currently disabled (commented out push trigger)
- No multi-K8s-version matrix testing in GHA
- Post-merge E2E runs on external repository (project-codeflare/kuberay-post-merge-tests)

**Key Files:**
- `.github/workflows/e2e-tests.yaml` - PR-triggered E2E
- `.github/workflows/operator-chaos.yml` - Chaos testing on PRs
- `ray-operator/test/e2e/rayjob_test.go` - Core RayJob E2E patterns
- `ray-operator/test/support/` - E2E test helpers

### Build Integration

**Score: 7/10**

**Strengths:**
- **PR-time Docker image builds** in `test-job.yaml` for operator, apiserver, and security proxy
- **E2E workflow builds and deploys** operator image to Kind cluster
- **Codegen verification** via `consistency-check.yaml`:
  - `verify-codegen.sh` checks generated client code consistency
  - `verify-generated-files.sh` validates generated files
  - API docs verification against types.go
- **Helm chart validation** with kubeconform, chart-testing, and helm-docs
- **Konflux Tekton pipelines** in `.tekton/`:
  - `odh-kuberay-operator-controller-pull-request.yaml` - PR pipeline (label/comment triggered)
  - `odh-kuberay-operator-controller-release-push.yaml` - Release pipeline
  - Hermetic builds with gomod prefetch
  - Multi-arch: x86_64, arm64, ppc64le
- **Multi-stage Docker builds** in all Dockerfiles
- **Kustomize overlay validation** via deploy targets

**Gaps:**
- Konflux PR pipeline requires manual trigger (label `kfbuild-kuberay` or comment `/build-konflux`)
- No automated Konflux simulation in GitHub Actions workflows
- Build caching could be improved (no explicit Docker layer caching in GHA)

**Key Files:**
- `.github/workflows/test-job.yaml` - Builds operator, apiserver, security proxy images
- `.github/workflows/consistency-check.yaml` - Codegen verification
- `.tekton/odh-kuberay-operator-controller-pull-request.yaml` - Konflux PR pipeline
- `ray-operator/Dockerfile.konflux` - Konflux-specific Dockerfile

### Image Testing

**Score: 7/10**

**Strengths:**
- **10 Dockerfiles** covering operator, apiserver, tests, experimental, proto
- **Multi-stage builds** in all production Dockerfiles
- **FIPS-capable base images**:
  - `Dockerfile.rhoai`: `registry.redhat.io/ubi9/go-toolset` builder → `registry.access.redhat.com/ubi9/ubi` runtime
  - `Dockerfile.konflux`: `registry.access.redhat.com/ubi9/go-toolset` builder → `ubi9/ubi-minimal` runtime
  - `Dockerfile` (upstream): `golang:1.24.0-bullseye` builder → `distroless/base-debian12` runtime
- **Multi-arch support**: amd64 + arm64 in GHA (Dockerfile.buildx), amd64 + arm64 + ppc64le in Tekton
- **E2E deploys built image** to Kind cluster, providing indirect runtime validation
- **Dedicated test image** (`ray-operator/images/tests/Dockerfile`)

**Gaps:**
- No explicit `HEALTHCHECK` directives in Dockerfiles
- No Testcontainers-based runtime validation
- No container startup time benchmarking
- `.dockerignore` not present (may include unnecessary files in build context)

**Key Files:**
- `ray-operator/Dockerfile.rhoai` - RHOAI production Dockerfile
- `ray-operator/Dockerfile.konflux` - Konflux Dockerfile with UBI9-minimal
- `ray-operator/Dockerfile.buildx` - Multi-arch buildx Dockerfile
- `ray-operator/images/tests/Dockerfile` - E2E test image

### Coverage Tracking

**Score: 3/10**

**Strengths:**
- `--coverprofile cover.out` in ray-operator Makefile test target
- `-coverprofile ray-kube-api-server-coverage.out` in apiserver Makefile
- `-coverprofile cover.out` in apiserversdk Makefile
- Coverage files are generated during local `make test` runs

**Gaps:**
- **No `.codecov.yml`** or codecov integration
- **No coverage reporting in CI** - coverage files are generated but never uploaded
- **No coverage thresholds** enforced anywhere
- **No PR coverage comments** or diff coverage checks
- **No historical coverage tracking** or trend analysis
- Coverage is effectively invisible - generated locally and discarded

**Key Files:**
- `ray-operator/Makefile:68` - `go test $(WHAT) -coverprofile cover.out`
- `apiserver/Makefile:107` - `go test ./pkg/... -coverprofile ray-kube-api-server-coverage.out`

### CI/CD Automation

**Score: 8/10**

**Strengths:**
- **16 workflow files** providing comprehensive CI/CD:
  - `test-job.yaml` - Build + unit tests (PR + push)
  - `e2e-tests.yaml` - E2E tests with Kind (PR + push)
  - `consistency-check.yaml` - Codegen verification (PR + push)
  - `operator-chaos.yml` - Chaos testing (PR, path-filtered)
  - `helm.yaml` - Helm chart linting (push + PR on master/release)
  - `build-test-image.yaml` - Test image build (push to dev)
  - `block-prs-to-stable.yaml` - Branch protection
  - `fast-forward-stable.yaml` - Automated stable branch updates
  - `image-release.yaml`, `kubectl-plugin-release.yaml`, `odh-release.yml` - Release automation
  - `site.yaml` - Docs deployment
  - `e2e-dispatch-to-bigger-runner.yml`, `e2e-upgrade-dispatch-to-bigger-runner.yml` - Post-merge dispatch
- **Concurrency control**: `cancel-in-progress: true` on E2E and Helm workflows
- **Draft PR filtering**: Jobs skip draft PRs
- **Pre-commit enforcement in CI** via `pre-commit/action@v3.0.1`
- **Tekton pipelines** for Konflux integration
- **Go caching** via `actions/setup-go` with `cache-dependency-path`
- **Artifact upload** for built images and failure logs

**Gaps:**
- Missing `timeout-minutes` on several jobs (e.g., test-job build jobs)
- No test parallelization strategy in CI beyond `-parallel 4` for apiserver
- Helm workflow triggers target `master`/`release-*` but downstream branch is `dev`
- Some action versions are outdated (`actions/checkout@v2` in several places)

**Key Files:**
- `.github/workflows/test-job.yaml` - Main CI workflow
- `.github/workflows/e2e-tests.yaml` - E2E with Kind
- `.github/workflows/operator-chaos.yml` - Chaos testing

### Static Analysis

**Score: 9/10**

#### Linting
- **golangci-lint** with 22+ linters enabled:
  - Security: `gosec`
  - Style: `gofmt`, `gofumpt`, `goimports`, `gci`, `revive`
  - Correctness: `errcheck`, `errorlint`, `staticcheck`, `typecheck`, `govet` (with `fieldalignment`)
  - Code quality: `ineffassign`, `unconvert`, `unparam`, `unused`, `wastedassign`
  - Test quality: `testifylint`, `ginkgolinter` (with `forbid-focus-container`)
  - Misc: `asciicheck`, `misspell`, `nilerr`, `noctx`, `nolintlint` (with `require-explanation`), `predeclared`, `makezero`
- `disable-all: true` with explicit enable list - no accidental linter defaults
- Custom `revive` rules with 20+ checks configured
- Import ordering enforced via `gci` with kuberay-specific prefix

#### Pre-commit Hooks
Comprehensive `.pre-commit-config.yaml` with 14+ hooks:
- File quality: trailing-whitespace, end-of-file-fixer, mixed-line-ending, check-added-large-files
- Validation: check-yaml, check-json, pretty-format-json
- Security: detect-private-key, gitleaks
- Go: golangci-lint (via custom script), shellcheck
- Kubernetes: CRD schema generation + kubeconform validation, helm chart validation
- Docs: markdownlint-fix, helm-docs, yamlfmt for sample configs

#### FIPS Compatibility
- **Build tags**: `-tags strictfipsruntime` in ALL production Dockerfiles (Dockerfile, Dockerfile.rhoai, Dockerfile.konflux)
- **CGO_ENABLED=1** in all production builds (required for FIPS)
- **GOEXPERIMENT=strictfipsruntime** in Dockerfile.konflux
- **UBI9 base images** in RHOAI and Konflux Dockerfiles (FIPS-capable)
- CI also compiles with `-tags strictfipsruntime` for multi-arch release builds
- Minor: `math/rand/v2` in test file (acceptable), `math/rand` in kubectl-plugin test support (low risk, test only)

#### Dependency Alerts
- **Dependabot**: Configured for `gomod` across 5 directories (experimental, ray-operator, apiserver, kubectl-plugin, proto), weekly schedule, with dependency grouping (kubernetes, google-golang, github, all-dependencies)
- **Renovate**: Also configured, extending from `red-hat-data-services/konflux-central` defaults

**Key Files:**
- `.golangci.yml` - 22+ linters with detailed configuration
- `.pre-commit-config.yaml` - 14+ hooks including CRD validation
- `.github/dependabot.yml` - Multi-directory gomod coverage
- `.github/renovate.json` - Konflux-central extension

### Agent Rules

**Score: 7/10**

**Strengths:**
- **Comprehensive CLAUDE.md** (~7KB) with:
  - Repository structure with directory-purpose mapping table
  - Build and test commands for all modules
  - Single-file lint/format commands
  - Coding conventions (Go style, import ordering, error handling)
  - Enabled linter list
  - Testing framework documentation (Go testing + Ginkgo, envtest)
  - Pre-commit hook documentation
  - Kubernetes API patterns (CRDs, controllers, status, finalizers, webhooks)
  - **Real pattern references** with specific file paths:
    - Adding a CRD field → `AuthenticationReady` in types.go
    - Controller reconciler → `RayClusterReconciler.Reconcile`
    - E2E test → `TestRayJob` with `test := With(t)` pattern
    - Midstream carry patch → `CARRY:` prefix convention
    - Webhook/Kustomize changes with specific file paths
- **.cursor/hooks.json** present for Cursor IDE integration

**Gaps:**
- **No `.claude/rules/` directory** with dedicated test creation rules
- **No `AGENTS.md`** file
- Missing specific guidance for:
  - When to use `_unit_test.go` vs integration test patterns
  - envtest setup boilerplate
  - E2E test helpers from `test/support/`
  - Chaos test knowledge file format
- CLAUDE.md could benefit from test creation checklists

**Key Files:**
- `CLAUDE.md` - Main agent rules file
- `.cursor/hooks.json` - Cursor IDE hooks

## Recommendations

### Priority 0 (Critical)

1. **Integrate Codecov for PR-level coverage reporting and threshold enforcement**
   - Add `.codecov.yml` with project and patch coverage targets
   - Add `codecov/codecov-action@v4` to `test-job.yaml` after each `make test` step
   - Upload coverage from ray-operator, apiserver, and apiserversdk
   - Set initial thresholds based on current coverage baseline
   - Effort: 4-6 hours

2. **Add coverage gates to CI that fail PRs below minimum threshold**
   - Add `go tool cover -func=cover.out` parsing to Makefile
   - Configure Codecov to require minimum patch coverage (e.g., 80%)
   - Block merge on coverage regression
   - Effort: 2-3 hours

### Priority 1 (High Value)

3. **Add PR-time Konflux build simulation in GitHub Actions**
   - Add a lightweight job to `test-job.yaml` that runs `docker build -f ray-operator/Dockerfile.konflux ray-operator/`
   - This catches UBI9 build issues, missing dependencies, and FIPS tag problems before merge
   - Effort: 4-6 hours

4. **Create .claude/rules/ with test patterns**
   - `unit-tests.md`: envtest setup patterns, `*_unit_test.go` naming, Gomega assertions
   - `e2e-tests.md`: Kind cluster patterns, `test := With(t)`, `test.NewTestNamespace()`, Eventually/Gomega
   - `webhook-tests.md`: Webhook suite setup with envtest
   - Use `/test-rules-generator` to bootstrap from existing patterns
   - Effort: 2-3 hours

5. **Add container health check validation in E2E tests**
   - Verify operator container starts and becomes ready within expected timeframe
   - Add explicit readiness/liveness probe testing
   - Effort: 4-6 hours

### Priority 2 (Nice-to-Have)

6. **Add timeout-minutes to all CI jobs**
   - Several jobs in `test-job.yaml` lack explicit timeouts
   - Prevents hung jobs from consuming runner time
   - Effort: 1 hour

7. **Update action versions in workflows**
   - Several workflows use `actions/checkout@v2` (current is v4)
   - Some use `actions/setup-go@v3` (current is v5)
   - Effort: 2-3 hours

8. **Add contract tests for API server REST endpoints**
   - The apiserver provides REST APIs that could benefit from contract testing
   - Effort: 8-12 hours

9. **Add performance regression testing for operator reconciliation**
   - The `benchmark/` directory exists but is not integrated into CI
   - Effort: 8-12 hours

## Comparison to Gold Standards

| Dimension | kuberay | odh-dashboard | notebooks | kserve |
|-----------|---------|---------------|-----------|--------|
| Unit Tests | 8/10 | 9/10 | 6/10 | 8/10 |
| Integration/E2E | 8/10 | 9/10 | 7/10 | 9/10 |
| Build Integration | 7/10 | 8/10 | 7/10 | 7/10 |
| Image Testing | 7/10 | 7/10 | 9/10 | 6/10 |
| Coverage Tracking | 3/10 | 8/10 | 5/10 | 8/10 |
| CI/CD Automation | 8/10 | 9/10 | 8/10 | 8/10 |
| Static Analysis | 9/10 | 8/10 | 7/10 | 7/10 |
| Agent Rules | 7/10 | 8/10 | 4/10 | 5/10 |
| **Overall** | **7.3** | **8.5** | **6.8** | **7.5** |

**Notable Strengths vs Gold Standards:**
- Static analysis (9/10) exceeds most gold standards — 22+ linters, comprehensive pre-commit, dual dependency management (Dependabot + Renovate), full FIPS compliance
- Chaos testing via operator-chaos is unique and adds significant value
- CLAUDE.md quality is among the best in the ecosystem with real pattern references

**Key Gaps vs Gold Standards:**
- Coverage tracking (3/10) is the weakest dimension — odh-dashboard and kserve both have Codecov integration with enforcement
- Missing contract tests that odh-dashboard uses for API boundaries

## File Paths Reference

### CI/CD Workflows
- `.github/workflows/test-job.yaml` - Main build + unit test workflow
- `.github/workflows/e2e-tests.yaml` - E2E tests with Kind cluster
- `.github/workflows/consistency-check.yaml` - Codegen verification
- `.github/workflows/operator-chaos.yml` - Chaos testing on PRs
- `.github/workflows/helm.yaml` - Helm chart linting and testing
- `.github/workflows/build-test-image.yaml` - Test image build
- `.github/workflows/block-prs-to-stable.yaml` - Branch protection
- `.github/workflows/fast-forward-stable.yaml` - Stable branch management
- `.github/workflows/image-release.yaml` - Image release
- `.github/workflows/odh-release.yml` - ODH release
- `.tekton/odh-kuberay-operator-controller-pull-request.yaml` - Konflux PR pipeline
- `.tekton/odh-kuberay-operator-controller-release-push.yaml` - Konflux release pipeline

### Testing
- `ray-operator/controllers/ray/suite_test.go` - Controller envtest setup
- `ray-operator/pkg/webhooks/v1/webhook_suite_test.go` - Webhook envtest setup
- `ray-operator/test/e2e/` - Core E2E tests
- `ray-operator/test/e2eautoscaler/` - Autoscaler E2E
- `ray-operator/test/e2erayservice/` - RayService E2E
- `ray-operator/test/e2eupgrade/` - Upgrade E2E
- `ray-operator/test/support/` - E2E helpers
- `kubectl-plugin/test/e2e/` - kubectl plugin E2E
- `apiserver/test/e2e/` - API server E2E

### Configuration
- `.golangci.yml` - 22+ linters
- `.pre-commit-config.yaml` - 14+ hooks
- `.github/dependabot.yml` - Dependency updates (gomod, 5 directories)
- `.github/renovate.json` - Renovate config
- `CLAUDE.md` - Agent rules
- `ray-operator/Makefile` - Build/test targets
- `Makefile` - Root Makefile (test image builds)

### Container Images
- `ray-operator/Dockerfile` - Upstream operator image
- `ray-operator/Dockerfile.rhoai` - RHOAI production image (UBI9)
- `ray-operator/Dockerfile.konflux` - Konflux build image (UBI9-minimal)
- `ray-operator/Dockerfile.buildx` - Multi-arch buildx image
- `ray-operator/images/tests/Dockerfile` - E2E test image

### Chaos Testing
- `.github/workflows/operator-chaos.yml` - Chaos testing workflow
- `chaos/knowledge/kuberay.yaml` - Chaos testing knowledge base
