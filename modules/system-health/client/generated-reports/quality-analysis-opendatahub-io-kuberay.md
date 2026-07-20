---
repository: "opendatahub-io/kuberay"
overall_score: 7.7
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Strong test suite with 104 test files (0.47 test-to-code ratio), Ginkgo/envtest for controllers"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Excellent E2E coverage across 4 test suites, Kind cluster testing, operator chaos validation"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-time Docker builds, Konflux/Tekton pipelines, CRD/RBAC/Helm consistency checks"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage builds, UBI9 base images, multi-arch support, but no container runtime validation"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "coverprofile generated locally but no CI tracking, thresholds, or PR reporting"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "14 workflows with good PR gates, concurrency control, Tekton pipelines for Konflux"
  - dimension: "Static Analysis"
    score: 9.0
    status: "22+ golangci-lint linters, comprehensive pre-commit hooks, FIPS compliance, Dependabot + Renovate"
  - dimension: "Agent Rules"
    score: 7.0
    status: "Comprehensive CLAUDE.md with patterns, but no .claude/rules/ for test-specific guidance"
critical_gaps:
  - title: "No coverage tracking or enforcement in CI"
    impact: "Test coverage regressions go undetected; no visibility into coverage trends across PRs"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container runtime validation tests"
    impact: "Image startup failures and runtime errors not caught until deployment to clusters"
    severity: "MEDIUM"
    effort: "6-8 hours"
  - title: "No Go module caching in CI workflows"
    impact: "Slower CI builds due to repeated dependency downloads on every run"
    severity: "LOW"
    effort: "1-2 hours"
quick_wins:
  - title: "Add Codecov integration for coverage tracking"
    effort: "3-4 hours"
    impact: "Automated coverage reporting on PRs with threshold enforcement"
  - title: "Add Go module caching to CI workflows"
    effort: "1-2 hours"
    impact: "Faster CI builds by caching go mod download results"
  - title: "Add .claude/rules/ for test creation patterns"
    effort: "2-3 hours"
    impact: "AI-generated tests follow consistent patterns for unit, e2e, and controller tests"
recommendations:
  priority_0:
    - "Add Codecov integration with coverage thresholds to catch coverage regressions on PRs"
    - "Upload coverage reports from CI test jobs for visibility into coverage trends"
  priority_1:
    - "Add container startup validation tests for operator image"
    - "Add Go module caching (actions/cache) to test-job.yaml and e2e-tests.yaml workflows"
    - "Create .claude/rules/ with test creation guidance for unit, e2e, and controller tests"
  priority_2:
    - "Add coverage threshold enforcement (e.g. 70% minimum for new code)"
    - "Add E2E test for multi-version Kubernetes/OpenShift compatibility"
    - "Consider adding contract tests for API boundaries"
---

# Quality Analysis: opendatahub-io/kuberay

## Executive Summary

- **Overall Score: 7.7/10**
- **Repository Type**: Kubernetes operator (Go, Kubebuilder framework)
- **Primary Language**: Go 1.24
- **Components**: ray-operator, apiserver, apiserversdk, kubectl-plugin, dashboard, helm-chart
- **Jira**: RHOAIENG / KubeRay (midstream tier)

**Key Strengths**: Excellent E2E test coverage with 4 dedicated test suites, comprehensive static analysis with 22+ linters and pre-commit hooks, strong FIPS compliance with `strictfipsruntime` build tags and UBI9 base images, and a well-documented CLAUDE.md with pattern references.

**Critical Gaps**: Coverage tracking is the most significant gap — `coverprofile` is generated locally but never uploaded, tracked, or enforced in CI. No PR coverage gates exist to catch regressions.

**Agent Rules Status**: CLAUDE.md is comprehensive with build commands, coding conventions, and pattern references. No `.claude/rules/` directory for granular test-type guidance.

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8/10 | 15% | 1.20 | Strong test suite, Ginkgo/envtest for controllers |
| Integration/E2E | 9/10 | 20% | 1.80 | Excellent multi-suite E2E, operator chaos, Kind |
| Build Integration | 8/10 | 15% | 1.20 | PR-time Docker builds, Konflux/Tekton, consistency checks |
| Image Testing | 7/10 | 10% | 0.70 | Multi-stage builds, multi-arch, UBI9, no runtime validation |
| Coverage Tracking | 3/10 | 10% | 0.30 | coverprofile generated but not tracked or enforced |
| CI/CD Automation | 8/10 | 15% | 1.20 | 14 workflows, good PR gates, Tekton pipelines |
| Static Analysis | 9/10 | 10% | 0.90 | 22+ linters, FIPS compliance, Dependabot + Renovate |
| Agent Rules | 7/10 | 5% | 0.35 | Comprehensive CLAUDE.md, no .claude/rules/ |
| **Overall** | **7.7/10** | | **7.65** | |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement in CI
- **Severity**: HIGH
- **Impact**: Test coverage regressions go undetected. No visibility into coverage trends. New code can reduce overall coverage without any signal.
- **Evidence**: `--coverprofile cover.out` appears in `ray-operator/Makefile:68`, `apiserversdk/Makefile:34`, and `apiserver/Makefile:107`, but no `.codecov.yml`, no `codecov/codecov-action`, and no coverage upload step in any workflow.
- **Effort**: 4-6 hours

### 2. No Container Runtime Validation Tests
- **Severity**: MEDIUM
- **Impact**: Image startup failures, missing binaries, or incorrect entrypoints not caught until deployment. The operator image is built and loaded into Kind but never validated for startup behavior independently.
- **Evidence**: No Testcontainers usage. No `docker run` or `podman run` validation steps in CI. E2E tests deploy to Kind but don't isolate image-level failures.
- **Effort**: 6-8 hours

### 3. No Go Module Caching in CI
- **Severity**: LOW
- **Impact**: Every CI run downloads Go dependencies from scratch, adding 1-3 minutes to each job.
- **Evidence**: `test-job.yaml` and `e2e-tests.yaml` use `actions/setup-go@v3` without `cache: true` or explicit `actions/cache` for `~/go/pkg/mod`.
- **Effort**: 1-2 hours

## Quick Wins

### 1. Add Codecov Integration (3-4 hours)
Add `.codecov.yml` and upload coverage from CI:

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

Add to `test-job.yaml` after the test step:
```yaml
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: ./ray-operator/cover.out
    flags: ray-operator
    token: ${{ secrets.CODECOV_TOKEN }}
```

### 2. Add Go Module Caching (1-2 hours)
Update `actions/setup-go` to v5 with caching enabled:

```yaml
- name: Set up Go
  uses: actions/setup-go@v5
  with:
    go-version: v1.24
    cache: true
```

### 3. Add `.claude/rules/` for Test Patterns (2-3 hours)
Create test creation rules based on existing patterns:

```
.claude/rules/
  unit-tests.md          # Go testing patterns, table-driven tests
  controller-tests.md    # Ginkgo/Gomega patterns with envtest
  e2e-tests.md          # Kind cluster setup, test.With(t) pattern
```

## Detailed Findings

### Unit Tests

**Score: 8/10**

Strong test coverage with a healthy test-to-code ratio:

| Metric | Value |
|--------|-------|
| Go test files | 104 |
| Go source files | 220 |
| Test-to-code ratio | 0.47 |
| Python test files | 8 |
| Unit test files (*_unit_test.go) | 6 |

**Test Distribution by Area:**
- Controller tests (ray-operator/controllers/ray/): 15 files — covers RayCluster, RayJob, RayService controllers plus utilities, metrics, batchscheduler
- Utils/helpers: 7 files across controllers/ray/utils and controllers/ray/common
- Webhooks: 2 files (ray-operator/pkg/webhooks/v1/)
- API server: 5 files (apiserver/pkg/*)
- kubectl-plugin: 11 files across pkg/cmd/* and pkg/util/*
- Batchscheduler: 3 files (volcano, yunikorn, scheduler-plugins)

**Frameworks Used:**
- Go standard testing (everywhere)
- Ginkgo/Gomega (controller tests, webhook suite tests)
- envtest (controller integration tests — `suite_test.go`, `raycluster_controller_test.go`)
- Python unittest (clients/python-client)

**Strengths:**
- Comprehensive controller test coverage with both unit (`*_unit_test.go`) and integration (`*_test.go` with envtest) patterns
- Ginkgo linter enforced via golangci-lint (`ginkgolinter`)
- `t.Parallel()` used in some tests, `-race` flag in CI
- Good webhook validation testing

**Gaps:**
- No explicit test coverage targets or minimum thresholds
- Some areas (experimental/, scripts/) have minimal test coverage

### Integration/E2E Tests

**Score: 9/10**

Excellent E2E test coverage with multiple dedicated test suites:

| Suite | Files | Scope |
|-------|-------|-------|
| ray-operator/test/e2e/ | 8 | RayJob, RayCluster core scenarios |
| ray-operator/test/e2eautoscaler/ | 2 | Autoscaler behavior |
| ray-operator/test/e2erayservice/ | 4 | RayService lifecycle, HA, upgrades |
| ray-operator/test/e2eupgrade/ | 1 | Operator upgrade testing |
| ray-operator/test/sampleyaml/ | 3 | Sample YAML validation |
| apiserver/test/e2e/ | 10 | API server integration |
| kubectl-plugin/test/e2e/ | 5 | CLI integration |

**E2E Infrastructure:**
- Kind cluster for local testing (`e2e-tests.yaml`, `helm.yaml`)
- Operator deployed via `make deploy` with image loaded into Kind
- Resource requirements dynamically adjusted for CI via Go AST manipulation (`scripts/update-resources.go`)
- Dedicated test image build pipeline (`build-test-image.yaml`)
- Test timeout configuration via environment variables (`KUBERAY_TEST_TIMEOUT_SHORT/MEDIUM/LONG`)
- Post-merge dispatch to bigger runners (`e2e-dispatch-to-bigger-runner.yml`)

**Operator Chaos Testing (PR-triggered):**
- Knowledge model validation and diffing
- CRD schema diff with breaking change detection
- Upgrade simulation (dry-run)
- Uses `opendatahub-io/operator-chaos` tool

**Consistency Checks (PR-triggered):**
- Codegen verification (`hack/verify-codegen.sh`)
- CRD/RBAC manifest consistency
- Helm chart CRD sync validation
- API docs consistency
- RBAC configuration validation with pytest

**Helm Chart Testing:**
- Helm unittest plugin for chart unit tests
- chart-testing (ct) lint and install
- Matrix strategy across 3 charts (kuberay-operator, kuberay-apiserver, ray-cluster)
- Image build + Kind deployment for integration testing

**Strengths:**
- PR-triggered E2E tests with a subset of scenarios for fast feedback
- Full E2E suite runs post-merge on larger runners
- Operator chaos testing catches CRD breaking changes on PRs
- Comprehensive Helm chart validation pipeline

**Gaps:**
- No multi-version Kubernetes testing matrix in E2E (single K8s version)
- E2E runs with `-parallel 1` (no parallelization)

### Build Integration

**Score: 8/10**

Strong build integration with multiple validation layers:

**PR-Time Builds (`test-job.yaml`):**
- Builds apiserver, operator, security-proxy Docker images
- Runs unit tests with race detector
- Builds kubectl-plugin binary
- Python client tests with Kind cluster
- Multi-arch build (amd64 + arm64) with `-tags strictfipsruntime` on merge

**Konflux/Tekton Integration:**
- `.tekton/odh-kuberay-operator-controller-pull-request.yaml` — PR build using `odh-konflux-central` pipeline
- `.tekton/odh-kuberay-operator-controller-push.yaml` — Push build to stable branch
- `.tekton/odh-kuberay-operator-controller-release-push.yaml` — Release pipeline (22KB, comprehensive)
- Uses `Dockerfile.rhoai` (UBI9 base) for Konflux builds

**Consistency Validation:**
- CRD manifest consistency (types.go ↔ CRD YAML)
- RBAC consistency (kubebuilder markers ↔ RBAC YAML)
- Helm chart CRD sync (operator CRDs ↔ Helm chart CRDs)
- API docs consistency
- Codegen verification

**Strengths:**
- Multiple Dockerfile variants for different environments (upstream, RHOAI, Konflux)
- Tekton pipelines wired to `odh-konflux-central` for consistent Konflux builds
- Comprehensive consistency checks prevent drift between generated artifacts
- Operator chaos validates CRD schema changes for breaking changes

**Gaps:**
- No explicit Konflux build simulation in GitHub CI (build validation is separate)
- No `kubectl apply --dry-run` or kustomize build validation in CI

### Image Testing

**Score: 7/10**

Good Dockerfile practices with room for runtime validation:

**Dockerfiles:**
| File | Base Image | Multi-Stage | FIPS |
|------|-----------|-------------|------|
| ray-operator/Dockerfile | golang:1.24 → distroless | Yes | strictfipsruntime |
| ray-operator/Dockerfile.rhoai | ubi9/go-toolset → ubi9/ubi | Yes | strictfipsruntime |
| ray-operator/Dockerfile.konflux | ubi9/go-toolset → ubi9/ubi-minimal | Yes | strictfipsruntime + GOEXPERIMENT |
| apiserver/Dockerfile | golang → distroless | Yes | No |
| experimental/Dockerfile | golang → distroless | Yes | No |
| dashboard/Dockerfile | Present | — | — |

**Multi-Architecture:**
- amd64 and arm64 via `Dockerfile.buildx` and `docker/build-push-action@v5`
- Cross-compilation in CI with `aarch64-linux-gnu-gcc`

**Health Checks:**
- readinessProbe and livenessProbe defined in Helm chart templates and operator deployment manifests
- No `HEALTHCHECK` instruction in Dockerfiles (Kubernetes probes used instead — appropriate for operator)

**Strengths:**
- All production Dockerfiles use multi-stage builds
- UBI9 base images for RHOAI/Konflux (FIPS-capable)
- Non-root user (65532:65532) in all images
- .dockerignore for efficient builds

**Gaps:**
- No Testcontainers or container runtime validation tests
- No image startup smoke tests in CI
- No image scanning or size validation

### Coverage Tracking

**Score: 3/10**

Coverage is generated but not tracked or enforced:

**What Exists:**
- `--coverprofile cover.out` in `ray-operator/Makefile`, `apiserversdk/Makefile`, `apiserver/Makefile`
- Local coverage generation works via `make test`

**What's Missing:**
- No `.codecov.yml` or `codecov.yml`
- No `codecov/codecov-action` in any workflow
- No coverage upload steps in CI
- No coverage thresholds or gates
- No PR coverage reporting
- No coverage trend tracking

**Impact:**
Coverage regressions can enter the codebase undetected. New features or refactors can reduce coverage without any signal in PR reviews.

### CI/CD Automation

**Score: 8/10**

Comprehensive workflow suite with 14 files:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| test-job.yaml | PR + push | Build, lint, unit tests, Docker images |
| e2e-tests.yaml | PR + push | E2E tests with Kind cluster |
| consistency-check.yaml | PR + push | Codegen, CRD, RBAC, Helm consistency |
| operator-chaos.yml | PR (path-filtered) | CRD diff, knowledge model, upgrade sim |
| helm.yaml | PR + push (master/release) | Helm lint, unittest, chart-testing |
| block-prs-to-stable.yaml | PR target | Block direct PRs to stable branch |
| build-test-image.yaml | push (dev) + dispatch | Build and push E2E test image |
| e2e-dispatch-to-bigger-runner.yml | push (dev) + dispatch | Dispatch E2E to larger runner |
| e2e-upgrade-dispatch-to-bigger-runner.yml | dispatch only | Dispatch upgrade tests |
| fast-forward-stable.yaml | push (dev) + dispatch | Fast-forward stable from dev |
| image-release.yaml | dispatch | Release image builds |
| kubectl-plugin-release.yaml | dispatch | kubectl plugin release via GoReleaser |
| odh-release.yml | dispatch + tag push | ODH release artifacts |
| site.yaml | push (master) | Deploy docs with mkdocs |

**Concurrency Control:**
- `e2e-tests.yaml`: group by head_ref + workflow, cancel-in-progress
- `block-prs-to-stable.yaml`: group by PR number, cancel-in-progress
- `helm.yaml`: group by workflow + ref + actor, cancel-in-progress

**Tekton Pipelines:**
- 3 Tekton PipelineRun definitions for Konflux builds
- PR pipeline with `/run-kuberay-e2e` comment trigger
- Push pipeline on stable branch
- Release pipeline with comprehensive build and sign steps

**Strengths:**
- Good separation between PR and post-merge testing
- Path-filtered operator chaos checks (only runs when relevant files change)
- Tekton pipelines integrated with Konflux central
- Draft PR filtering (`github.event.pull_request.draft == false`)

**Gaps:**
- No explicit Go module caching (`actions/setup-go@v3` without cache)
- No test parallelization strategy (E2E runs `-parallel 1`)
- Some workflow files use older action versions (actions/checkout@v2)

### Static Analysis

**Score: 9/10**

Excellent static analysis with comprehensive tooling:

**golangci-lint (22+ linters):**
asciicheck, errcheck, errorlint, gci, ginkgolinter, gofmt, gofumpt, goimports, gosec, gosimple, govet (with fieldalignment), ineffassign, makezero, misspell, nilerr, noctx, nolintlint (require-explanation + require-specific), predeclared, revive (17 rules), staticcheck, typecheck, unconvert, unparam, unused, wastedassign, testifylint

**Pre-commit Hooks (14 hooks):**
- Code quality: trailing-whitespace, end-of-file-fixer, mixed-line-ending, check-merge-conflict, check-case-conflict
- Data validation: check-yaml, check-json, pretty-format-json
- Security: detect-private-key, gitleaks
- Go: golangci-lint (via custom script), gofumpt
- Shell: shellcheck
- Kubernetes: CRD schema validation (kubeconform), Helm chart validation
- Docs: markdownlint, yamlfmt, helm-docs

**FIPS Compliance:**
- `-tags strictfipsruntime` in all production Dockerfiles
- `GOEXPERIMENT=strictfipsruntime` in Konflux Dockerfile
- `CGO_ENABLED=1` for BoringCrypto linking
- UBI9 base images (FIPS-capable) for RHOAI/Konflux builds
- `math/rand` usage only in test files (acceptable)
- No `crypto/md5`, `crypto/des`, `crypto/rc4` in production code (only test files)

**Dependency Alerts:**
- **Dependabot**: Configured for gomod across 5 sub-projects (experimental, ray-operator, apiserver, kubectl-plugin, proto) with weekly schedule and dependency grouping (kubernetes, google-golang, github, all)
- **Renovate**: Configured extending `red-hat-data-services/konflux-central` default config

**Strengths:**
- Exceptionally thorough linter configuration with nolintlint requiring explanations
- Pre-commit hooks cover Go, YAML, JSON, Markdown, Shell, Kubernetes manifests, and secrets
- Both Dependabot and Renovate configured for comprehensive dependency management
- FIPS compliance baked into build pipeline

### Agent Rules

**Score: 7/10**

Well-documented CLAUDE.md with actionable patterns:

**CLAUDE.md Contents:**
- Repository structure with directory-to-purpose mapping
- "Where to Make Changes" lookup table
- Build and test commands (unit, e2e, autoscaler, upgrade, sampleyaml)
- Single-file commands (lint, format, pre-commit)
- Coding conventions (Go style, import order, error handling)
- Linting rules with enabled linter list
- Testing guidance (framework, coverage, location, mocking, e2e)
- Pre-commit hook documentation
- Kubernetes API patterns (CRDs, controllers, status, finalizers, RBAC, webhooks)
- Pattern references with real examples:
  - Adding a new CRD field
  - Adding/modifying controller reconcilers
  - Adding E2E tests
  - Midstream carry patches
  - Kustomize overlay/webhook changes

**Other Agent Tooling:**
- `.cursor/hooks.json` with `format-go.sh` and `block-dangerous.sh` hooks

**Gaps:**
- No `.claude/` directory or `.claude/rules/` for granular, test-type-specific guidance
- No `AGENTS.md`
- CLAUDE.md testing section could specify coverage expectations and test isolation requirements
- No specific rules for controller test patterns (envtest setup, Ginkgo conventions)

## Recommendations

### Priority 0 (Critical)

1. **Add Codecov integration for coverage tracking and enforcement**
   - Create `.codecov.yml` with project and patch coverage targets
   - Add coverage upload steps to `test-job.yaml` for ray-operator, apiserver, and apiserversdk
   - Set initial thresholds conservatively (e.g. 60% project, 70% patch) and increase over time
   - Estimated effort: 4-6 hours

2. **Upload coverage reports from all test jobs**
   - Add `codecov/codecov-action@v4` after each `make test` step
   - Use flags to separate coverage by component (ray-operator, apiserver, apiserversdk)
   - Enable PR comments for coverage diff visibility
   - Estimated effort: 2-3 hours

### Priority 1 (High Value)

3. **Add Go module caching to CI workflows**
   - Update `actions/setup-go` to v5 with `cache: true` in test-job.yaml, e2e-tests.yaml, consistency-check.yaml
   - Expected 1-3 minute improvement per job
   - Estimated effort: 1-2 hours

4. **Add container startup validation tests**
   - Build operator image and validate it starts correctly (`docker run --rm <image> --help` or similar)
   - Verify the binary is in the expected location and runs as non-root
   - Estimated effort: 3-4 hours

5. **Create `.claude/rules/` directory with test creation patterns**
   - `unit-tests.md`: Table-driven tests, error case coverage, test naming conventions
   - `controller-tests.md`: envtest setup, Ginkgo patterns, suite_test.go conventions
   - `e2e-tests.md`: `test.With(t)` pattern, `test.NewTestNamespace()`, Eventually + Gomega assertions
   - Use `/test-rules-generator` to bootstrap from existing patterns
   - Estimated effort: 2-3 hours

### Priority 2 (Nice-to-Have)

6. **Add multi-version Kubernetes testing matrix to E2E**
   - Test against 2-3 Kubernetes versions (e.g. 1.28, 1.29, 1.30) using Kind
   - Estimated effort: 4-6 hours

7. **Update CI action versions**
   - Several workflows use `actions/checkout@v2` and `actions/setup-go@v3` (current: v5)
   - Update for security patches and new features (caching, Node.js 20)
   - Estimated effort: 2-3 hours

8. **Add E2E test parallelization**
   - Currently running with `-parallel 1`; investigate parallelizing independent test suites
   - Could reduce E2E time by 30-50%
   - Estimated effort: 4-6 hours

## Comparison to Gold Standards

| Dimension | kuberay | odh-dashboard | notebooks | kserve |
|-----------|---------|---------------|-----------|--------|
| Unit Tests | 8 | 9 | 6 | 8 |
| Integration/E2E | 9 | 9 | 7 | 9 |
| Build Integration | 8 | 8 | 9 | 7 |
| Image Testing | 7 | 6 | 9 | 6 |
| Coverage Tracking | 3 | 8 | 5 | 8 |
| CI/CD Automation | 8 | 9 | 8 | 8 |
| Static Analysis | 9 | 8 | 7 | 7 |
| Agent Rules | 7 | 8 | 4 | 3 |
| **Overall** | **7.7** | **8.4** | **7.1** | **7.2** |

**vs. odh-dashboard**: kuberay has stronger static analysis (22+ linters vs typical 10-15) and better E2E infrastructure (operator chaos, Helm testing), but significantly lags in coverage tracking.

**vs. notebooks**: kuberay has stronger testing and CI/CD but lacks the image testing depth (5-layer validation) that notebooks provides.

**vs. kserve**: kuberay has comparable unit/E2E testing and stronger static analysis. Both lack agent rules. kuberay's operator chaos testing is a differentiator.

## File Paths Reference

### CI/CD
- `.github/workflows/test-job.yaml` — Build, lint, unit tests
- `.github/workflows/e2e-tests.yaml` — E2E tests with Kind
- `.github/workflows/consistency-check.yaml` — Codegen/CRD/RBAC/Helm consistency
- `.github/workflows/operator-chaos.yml` — CRD diff and upgrade simulation
- `.github/workflows/helm.yaml` — Helm chart lint, test, install
- `.tekton/odh-kuberay-operator-controller-pull-request.yaml` — Konflux PR build
- `.tekton/odh-kuberay-operator-controller-push.yaml` — Konflux push build

### Testing
- `ray-operator/test/e2e/` — Core E2E tests (RayJob, RayCluster)
- `ray-operator/test/e2eautoscaler/` — Autoscaler E2E tests
- `ray-operator/test/e2erayservice/` — RayService E2E tests
- `ray-operator/test/e2eupgrade/` — Upgrade E2E tests
- `ray-operator/controllers/ray/*_test.go` — Controller unit/integration tests
- `apiserver/test/e2e/` — API server E2E tests
- `kubectl-plugin/test/e2e/` — kubectl plugin E2E tests

### Static Analysis
- `.golangci.yml` — 22+ enabled linters
- `.pre-commit-config.yaml` — 14 hooks (Go, YAML, JSON, security, K8s)
- `.github/dependabot.yml` — Gomod dependency alerts (5 sub-projects)
- `.github/renovate.json` — Renovate extending Konflux central config

### Container Images
- `ray-operator/Dockerfile` — Upstream operator image (distroless)
- `ray-operator/Dockerfile.rhoai` — RHOAI operator image (UBI9)
- `ray-operator/Dockerfile.konflux` — Konflux build (UBI9 minimal)
- `ray-operator/Dockerfile.buildx` — Multi-arch build

### Agent Rules
- `CLAUDE.md` — Comprehensive agent documentation
- `.cursor/hooks.json` — Cursor IDE hooks
