---
repository: "opendatahub-io/llm-d-batch-gateway-operator"
overall_score: 6.7
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Comprehensive envtest-based controller tests with 9 test files covering Helm rendering, secret sync, metrics, and reconciliation"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Strong E2E suite with 7 matrix profiles (sync/async/gate variants) running on Kind clusters via CI"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-time kustomize overlay verification, CRD validation, generated code checks, and Tekton/Konflux pipelines"
  - dimension: "Image Testing"
    score: 6.0
    status: "Multi-stage multi-arch builds with chart validation in Dockerfile.konflux, but no runtime image validation tests"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "No coverage tooling configured - no codecov, no coverprofile, no thresholds, no PR reporting"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "Well-organized 5-workflow setup with matrix integration tests, but missing concurrency control on PRs"
  - dimension: "Static Analysis"
    score: 7.0
    status: "Strong golangci-lint v2 with 23 linters and FIPS build support, but no Dependabot/Renovate or pre-commit hooks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory - no AI agent guidance for test creation"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Cannot measure test coverage trends, no PR gates prevent coverage regression, untested code paths invisible"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No AI agent rules for test creation"
    impact: "AI-generated tests lack project-specific patterns, Helm value testing conventions, envtest setup guidance"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No dependency update automation"
    impact: "Go module and container base image vulnerabilities not automatically surfaced via PRs"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add --coverprofile to CI and integrate Codecov"
    effort: "2-4 hours"
    impact: "Immediate visibility into test coverage, PR coverage diffs, and threshold enforcement"
  - title: "Enable Dependabot for gomod and docker ecosystems"
    effort: "1 hour"
    impact: "Automated dependency update PRs with security alerts"
  - title: "Add concurrency control to PR workflows"
    effort: "30 minutes"
    impact: "Cancel stale CI runs on force-pushes, reducing CI queue congestion"
  - title: "Generate agent rules with /test-rules-generator"
    effort: "1-2 hours"
    impact: "AI agents produce tests matching project conventions (envtest, table-driven, Helm value assertions)"
recommendations:
  priority_0:
    - "Add Go coverage profiling (--coverprofile) to make test and integrate with Codecov for PR-level coverage reporting and threshold enforcement"
    - "Enable Dependabot for gomod and docker ecosystems to automate dependency security updates"
  priority_1:
    - "Create CLAUDE.md and .claude/rules/ with test creation guidance covering envtest patterns, Helm value testing, and E2E test conventions"
    - "Add concurrency control to ci.yml and ci-integration-tests.yml to cancel outdated PR runs"
    - "Add pre-commit hooks for go fmt, go vet, and golangci-lint to catch issues before push"
  priority_2:
    - "Add multi-K8s-version testing to the integration test matrix (e.g., 1.30, 1.31, 1.33)"
    - "Add container health checks (HEALTHCHECK) to Dockerfiles for local development validation"
    - "Consider adding runtime image validation tests using Testcontainers to verify image startup"
---

# Quality Analysis: llm-d-batch-gateway-operator

**Repository**: [opendatahub-io/llm-d-batch-gateway-operator](https://github.com/opendatahub-io/llm-d-batch-gateway-operator)
**Type**: Kubernetes Operator (Go, controller-runtime)
**Jira**: INFERENG / llm-d (midstream tier)
**Analysis Date**: 2026-07-20

## Executive Summary

- **Overall Score: 6.7/10**
- **Key Strengths**: Comprehensive unit tests with envtest, outstanding E2E test matrix covering 7 sync/async profiles, strong build integration with kustomize verification and Konflux/Tekton pipelines, robust golangci-lint configuration with 23 linters
- **Critical Gaps**: Zero coverage tracking infrastructure, no AI agent rules, no dependency update automation
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 8.0/10 | Comprehensive envtest-based controller tests |
| Integration/E2E | 20% | 8.0/10 | 7-profile matrix with Kind clusters |
| Build Integration | 15% | 8.0/10 | Kustomize verification + Konflux/Tekton pipelines |
| Image Testing | 10% | 6.0/10 | Multi-stage multi-arch, no runtime validation |
| Coverage Tracking | 10% | 2.0/10 | No coverage tooling at all |
| CI/CD Automation | 15% | 8.0/10 | Well-organized, missing concurrency control |
| Static Analysis | 10% | 7.0/10 | Strong linting, no Dependabot or pre-commit |
| Agent Rules | 5% | 0.0/10 | No agent rules present |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: Cannot measure test coverage trends; no PR gates prevent coverage regression; untested code paths are invisible to reviewers
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No `.codecov.yml`, no `--coverprofile` in `make test`, no coverage thresholds, no PR coverage comments. The `make test` target runs `go test -v ./... -count=1` without any coverage flags.

### 2. No AI Agent Rules for Test Creation
- **Impact**: AI-generated tests lack project-specific patterns for envtest setup, Helm value testing, secret sync testing, and E2E conventions
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory. The project has well-established test patterns (table-driven tests, envtest with `TestMain`, Helm value assertion helpers) that should be documented for AI agents.

### 3. No Dependency Update Automation
- **Impact**: Go module and container base image vulnerabilities are not automatically surfaced via PRs
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: No `.github/dependabot.yml` or Renovate configuration. Both `go.mod` dependencies and Dockerfile base image pinning (`@sha256:...`) need automated update monitoring.

## Quick Wins

### 1. Add Coverage Profiling and Codecov Integration (2-4 hours)
- Add `--coverprofile=coverage.out` to the test command in `Makefile` and CI
- Add Codecov GitHub Action to the CI workflow
- Create `.codecov.yml` with initial thresholds

**Implementation**:
```makefile
# In Makefile, update the test target:
.PHONY: test
test: generate manifests setup-envtest fetch-batch-gateway fetch-llm-d-async
	KUBEBUILDER_ASSETS="$$($(ENVTEST) use $(ENVTEST_K8S_VERSION) --bin-dir $(LOCALBIN) -p path)" \
	go test -v -coverprofile=coverage.out ./... -count=1
```

```yaml
# Add to .github/workflows/ci.yml after the Test step:
      - name: Upload coverage
        if: always()
        uses: codecov/codecov-action@v4
        with:
          file: coverage.out
          flags: unittests
```

### 2. Enable Dependabot (1 hour)
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: gomod
    directory: "/"
    schedule:
      interval: weekly
  - package-ecosystem: docker
    directory: "/"
    schedule:
      interval: weekly
  - package-ecosystem: github-actions
    directory: "/"
    schedule:
      interval: weekly
```

### 3. Add Concurrency Control (30 minutes)
```yaml
# Add to ci.yml and ci-integration-tests.yml:
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

### 4. Generate Agent Rules (1-2 hours)
Run `/test-rules-generator` on this repository to create `.claude/rules/` with test patterns for:
- envtest controller testing with `TestMain` setup
- Helm value conversion test patterns
- E2E test structure with Kind cluster
- Table-driven test conventions

## Detailed Findings

### Unit Tests

**Score: 8.0/10**

The repository has excellent unit test coverage for a Kubernetes operator of this size.

**Test Files** (9 in `internal/`, 2 in `test/e2e/`):
| File | Lines | What It Tests |
|------|-------|---------------|
| `internal/controller/helm_test.go` | 1,152 | Helm value generation for batch-gateway chart (image splitting, resources, tolerations, monitoring, OTEL, Grafana, PrometheusRule, etc.) |
| `internal/controller/llmbatchgateway_controller_test.go` | 1,188 | Full reconciliation loop via envtest (create, update, delete, status conditions, component status, ownerReferences) |
| `internal/controller/secret_sync_test.go` | 410 | Cross-namespace secret resolution with ReferenceGrants, secret copying, immutability enforcement |
| `internal/controller/helm_async_test.go` | 332 | Async Helm value generation (TLS, transforms, model server monitor, OTEL, Grafana, image pull secrets) |
| `internal/controller/statuspatch_test.go` | 208 | JSON merge patch construction and conflict detection |
| `internal/monitoring/monitoring_test.go` | 114 | Operator metrics Service, ServiceMonitor, and PrometheusRule creation |
| `internal/controller/suite_test.go` | 112 | envtest environment setup with CRD loading and Gateway API scheme registration |
| `internal/controller/metrics_test.go` | 101 | Reconcile error counter increment verification |
| `internal/controller/secret_watch_filter_test.go` | 98 | Secret watch predicate filtering (Create/Update/Delete/Generic events) |

**Strengths**:
- Uses `envtest` properly via `TestMain` for controller and secret sync tests
- Table-driven tests throughout (`TestSplitImage`, `TestReferenceGrantPermits`, `TestSecretWatchFilter`)
- Tests cover both happy paths and error conditions (stale resourceVersion conflicts, missing secrets, wrong ReferenceGrants, immutable secretRef changes)
- Helper functions like `testImages()`, `testSecretName()`, `newTestGateway()` provide clean test setup
- Test-to-source ratio: ~4,708 test lines / ~6,896 source lines (excluding generated deepcopy) = 0.68

**Gaps**:
- No `t.Parallel()` usage (not critical for envtest-based tests, but table-driven subtests could benefit)
- `internal/utils/utils.go` (44 lines) has no dedicated tests (trivial utility functions)

### Integration/E2E Tests

**Score: 8.0/10**

Outstanding E2E test infrastructure with comprehensive multi-profile matrix testing.

**CI Integration Test Matrix** (7 profiles):
| Profile | Dispatch Mode | Gate Type | What It Validates |
|---------|--------------|-----------|-------------------|
| `sync` | Sync | None | Standard synchronous batch processing |
| `sync-fs` | Sync | None | Sync with filesystem storage instead of S3 |
| `async` | Async | None | Async dispatch via llm-d-async |
| `async-gate-redis` | Async | Redis | Redis-based dispatch gate budget |
| `async-gate-prometheus-query` | Async | PromQL | Prometheus query-based gate |
| `async-gate-prometheus-budget` | Async | Prometheus | Cascaded Prometheus metric gate |
| `async-gate-endpoint-scrape` | Async | Endpoint scrape | Direct model server metrics scrape |

**E2E Test Scenarios** (`test/e2e/e2e_test.go`):
- `StatusConditions`: Verifies Ready, APIServerAvailable, ProcessorAvailable conditions
- `OperandPodsReady`: Checks apiserver, processor, gc pods reach Ready state
- `ServiceReachability`: Port-forwards to apiserver service, validates HTTP endpoints
- `ReadyFalseConformance`: Scales to 0, verifies Ready=False, restores and verifies recovery
- `CRDeletionCleanup`: Creates temp CR, validates ownerReferences, deletes and verifies cleanup
- `OrphanCleanup`: Toggles Grafana, verifies orphaned ConfigMaps are cleaned up
- `SpecUpdate`: Tests replica count changes propagate to deployments
- `ProcessorReplicasUpdate`: Processor-specific replica scaling
- `ConfigChangeRollout`: Config changes trigger ConfigMap updates and pod rollouts
- `ResourcesUpdate`: CPU/memory resource changes propagate correctly
- `ProcessorConcurrencyUpdate`: AIMD concurrency settings propagate (7 sub-cases)

**Integration Infrastructure**:
- `hack/dev-deploy.sh`: Full Kind cluster setup with Gateway API CRDs, Prometheus Operator CRDs, vLLM simulator, Redis, Prometheus, and operator deployment
- `hack/test-e2e-batch-gateway.sh`: Upstream batch-gateway e2e test runner with async dispatch verification via metrics
- `hack/setup-prereqs.sh`: Prerequisite setup (PostgreSQL, MinIO/filesystem, Redis)

**Gaps**:
- No multi-K8s-version testing (only uses `ENVTEST_K8S_VERSION=1.33.0`)
- E2E tests use `kubectl` exec calls rather than Go client-go (acceptable for operator E2E)

### Build Integration

**Score: 8.0/10**

Strong build integration with multiple validation layers on PRs.

**PR-Time Validation**:
1. **`ci.yml`** (PR-triggered): Runs lint, verifies generated code is up-to-date (`make generate manifests; git diff --exit-code`), builds binary, runs unit tests
2. **`verify-kustomize.yml`** (PR-triggered): Verifies all kustomize overlays build successfully via `make verify-manifests`
3. **`ci-integration-tests.yml`** (PR-triggered): Builds Docker image, deploys to Kind, validates CRD schemas via `kubectl apply --dry-run=server`, runs E2E tests
4. **Tekton PR pipeline** (`.tekton/odh-batch-gateway-operator-pull-request.yaml`): Konflux multi-arch container build on PRs using `Dockerfile.konflux`

**Kustomize Overlays**:
- `config/overlays/odh/` - ODH deployment configuration
- `config/overlays/rhoai/` - RHOAI deployment configuration
- Both validated on every PR via `make verify-manifests`

**Code Generation Verification**:
- `make generate manifests` followed by `git diff --exit-code` ensures CRD bases and generated code are committed

**Strengths**:
- Full Konflux/Tekton pipeline simulation on PRs
- CRD schema validation against sample CRs
- Kustomize overlay build verification for both ODH and RHOAI targets
- Generated code drift detection

### Image Testing

**Score: 6.0/10**

Good container build practices but limited runtime validation.

**Dockerfiles**:
| File | Base (Builder) | Base (Runtime) | Features |
|------|---------------|----------------|----------|
| `Dockerfile` | `quay.io/projectquay/golang:1.25` | `gcr.io/distroless/static:nonroot` | Multi-stage, multi-arch (amd64/arm64) |
| `Dockerfile.konflux` | `registry.access.redhat.com/ubi9/go-toolset:1.25.8@sha256:...` | `registry.access.redhat.com/ubi9/ubi-minimal:9.7@sha256:...` | Multi-stage, FIPS, SHA-pinned, chart validation |

**Strengths**:
- Multi-stage builds in both Dockerfiles (minimizes runtime image size)
- Multi-architecture support (linux/amd64, linux/arm64) in `ci-image.yml`
- SHA-pinned base images in `Dockerfile.konflux` for reproducibility
- Chart validation in `Dockerfile.konflux` (`test -f /charts/batch-gateway/Chart.yaml`)
- GHA build caching (`cache-from: type=gha`, `cache-to: type=gha,mode=max`)
- Non-root user execution (`USER 65532:65532` / `USER 1001:1001`)
- Proper `.dockerignore` configuration

**Gaps**:
- No `HEALTHCHECK` instruction in either Dockerfile
- No Testcontainers or runtime image validation tests
- No image scanning integration in CI (though this is out-of-scope per skill guidelines)
- Upstream `Dockerfile` uses non-UBI base (`gcr.io/distroless/static`) - fine for upstream but worth noting

### Coverage Tracking

**Score: 2.0/10**

No coverage tracking infrastructure exists.

**Missing**:
- No `--coverprofile` flag in `make test` or CI
- No `.codecov.yml` or `codecov.yml`
- No coverage threshold enforcement
- No PR coverage comments or diffs
- No `pytest-cov`, `--coverage`, or equivalent tooling

**Impact**: Development team cannot:
- Track coverage trends over time
- Prevent coverage regression on PRs
- Identify untested code paths
- Set coverage gates for critical packages

**Score Justification**: Scored 2 (not 0) because the project has good test coverage by inspection, even though it's not measured or enforced. The tests exist; only the measurement infrastructure is missing.

### CI/CD Automation

**Score: 8.0/10**

Well-organized workflow structure with appropriate triggers and matrix testing.

**Workflow Inventory**:
| Workflow | Trigger | Purpose | Timeout |
|----------|---------|---------|---------|
| `ci.yml` | PR + push(main) | Lint, verify generated code, build, test | 10 min |
| `ci-integration-tests.yml` | PR + push(main) + dispatch | 7-profile E2E matrix on Kind | 30 min |
| `ci-image.yml` | push(main) + tags | Multi-arch image build and push to GHCR | - |
| `verify-kustomize.yml` | PR + push(main) | Verify kustomize overlays build | - |
| `refresh-prefetched-charts.yml` | push(main) + dispatch | Auto-update prefetched Helm charts | - |

**Tekton Pipelines**:
| Pipeline | Trigger | Purpose |
|----------|---------|---------|
| `odh-batch-gateway-operator-pull-request.yaml` | PR to main | Konflux multi-arch container build |
| `odh-batch-gateway-operator-push.yaml` | Push to main | Konflux production image build |

**Strengths**:
- Smart path filtering on PR workflows (only runs when relevant files change)
- Matrix strategy with `fail-fast: false` (all profiles run even if one fails)
- Timeout-minutes set on all jobs
- `workflow_dispatch` on integration tests for manual triggering
- Pinned action versions with SHA hashes for supply chain security
- Permissions scoped appropriately (`contents: read`, `packages: write`)

**Gaps**:
- No `concurrency:` group on PR workflows (stale runs continue wasting resources)
- No explicit Go module caching (relies on `actions/setup-go` default caching)
- No parallelization of lint and test jobs within `ci.yml` (run sequentially as separate jobs)

### Static Analysis

**Score: 7.0/10**

#### Linting

Strong golangci-lint v2 configuration with 23 linters enabled:

**Enabled Linters**: bodyclose, copyloopvar, dupword, durationcheck, errcheck, fatcontext, goconst, gocritic, govet, ineffassign, makezero, misspell, nakedret, nilnil, perfsprint, prealloc, revive, staticcheck, unparam, unused, unconvert

**Formatters**: goimports, gofmt

**Revive Rules** (18 rules): blank-imports, context-as-argument, context-keys-type, dot-imports, error-return, error-strings, error-naming, errorf, if-return, increment-decrement, indent-error-flow, package-comments, range, receiver-naming, time-naming, unexported-return, var-declaration, var-naming

**Configuration Highlights**:
- 5-minute timeout
- Parallel runners enabled
- No max-issues limits (all violations reported)
- Comment and std-error-handling exclusion presets

#### FIPS Compatibility

**Status**: Properly configured for downstream builds

- No FIPS-incompatible crypto imports detected (no `crypto/md5`, `crypto/des`, `crypto/rc4`, `math/rand`)
- `Dockerfile.konflux` uses `GOEXPERIMENT=strictfipsruntime` with `CGO_ENABLED=1`
- UBI9 base images for downstream (FIPS-capable)
- Upstream `Dockerfile` uses distroless (not FIPS-capable, expected for upstream)

#### Dependency Alerts

**Status**: Not configured

- No `.github/dependabot.yml`
- No `renovate.json`, `.renovaterc`, or `.renovaterc.json`
- SHA-pinned GitHub Actions provide some supply chain protection but don't auto-update

#### Pre-commit Hooks

**Status**: Not configured

- No `.pre-commit-config.yaml`
- Linting only runs in CI, not locally before commits

### Agent Rules

**Score: 0.0/10**

No AI agent configuration present in the repository.

**Missing**:
- No `CLAUDE.md` in repository root
- No `AGENTS.md`
- No `.claude/` directory
- No `.claude/rules/` with test creation guidance
- No `.claude/skills/` with custom skills

**Recommended Rules** (should cover):
1. **Unit test patterns**: envtest setup via `TestMain`, table-driven tests, `newTestGateway()` helper usage
2. **Helm value testing**: `specToHelmValues`/`specToAsyncHelmValues` assertion patterns, `testImages()` helper
3. **Secret sync testing**: ReferenceGrant construction, cross-namespace test scenarios
4. **E2E test patterns**: Kind cluster expectations, `kubectl` helpers, polling with deadlines
5. **Code style**: No BDD frameworks, standard `testing.T`, structured subtests

## Recommendations

### Priority 0 (Critical)

1. **Add Go coverage profiling and Codecov integration**
   - Add `--coverprofile=coverage.out` to `make test`
   - Add `codecov/codecov-action` to CI workflow
   - Create `.codecov.yml` with project/patch thresholds (start at 50%, ratchet up)
   - Effort: 4-6 hours

2. **Enable Dependabot for dependency updates**
   - Create `.github/dependabot.yml` covering `gomod`, `docker`, and `github-actions` ecosystems
   - Effort: 1 hour

### Priority 1 (High Value)

3. **Create AI agent rules for test automation**
   - Run `/test-rules-generator` to bootstrap `.claude/rules/`
   - Add `CLAUDE.md` with project-specific testing conventions
   - Cover envtest patterns, Helm value testing, E2E structure
   - Effort: 2-3 hours

4. **Add concurrency control to PR workflows**
   - Add `concurrency:` group with `cancel-in-progress: true` to `ci.yml` and `ci-integration-tests.yml`
   - Effort: 30 minutes

5. **Add pre-commit hooks**
   - Create `.pre-commit-config.yaml` with `go fmt`, `go vet`, `golangci-lint`
   - Effort: 1-2 hours

### Priority 2 (Nice-to-Have)

6. **Add multi-K8s-version testing**
   - Extend integration test matrix to include K8s 1.30, 1.31, 1.33
   - Validates backward compatibility for operator CRDs and RBAC
   - Effort: 2-3 hours

7. **Add container runtime validation**
   - Add Testcontainers-based tests or post-build image smoke tests
   - Validate manager binary starts and healthz endpoints respond
   - Effort: 4-6 hours

8. **Add HEALTHCHECK to Dockerfiles**
   - Add `HEALTHCHECK CMD ["/manager", "--healthz"]` or equivalent
   - Useful for local development with Docker Compose
   - Effort: 30 minutes

## Comparison to Gold Standards

| Capability | llm-d-batch-gateway-operator | odh-dashboard (Gold) | kserve (Gold) | notebooks (Gold) |
|-----------|------------------------------|---------------------|---------------|-----------------|
| Unit Tests | envtest + table-driven (8/10) | Jest + RTL (9/10) | Go envtest (9/10) | Python pytest (7/10) |
| E2E Tests | 7-profile Kind matrix (8/10) | Cypress + contract (9/10) | Multi-version (9/10) | Image validation (8/10) |
| Coverage | None (2/10) | Codecov enforced (9/10) | Codecov enforced (8/10) | Basic (5/10) |
| CI/CD | 5 workflows + Tekton (8/10) | Comprehensive (9/10) | Multi-workflow (8/10) | Image pipeline (7/10) |
| Static Analysis | 23 linters + FIPS (7/10) | ESLint strict (8/10) | golangci-lint (8/10) | ruff + mypy (7/10) |
| Agent Rules | None (0/10) | Comprehensive (9/10) | Basic (4/10) | None (1/10) |
| Build Integration | Kustomize + Konflux (8/10) | Module Fed (8/10) | Operator (8/10) | Image layers (7/10) |

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yml` - Lint, build, unit tests
- `.github/workflows/ci-integration-tests.yml` - 7-profile E2E matrix
- `.github/workflows/ci-image.yml` - Multi-arch image build and push
- `.github/workflows/verify-kustomize.yml` - Kustomize overlay verification
- `.github/workflows/refresh-prefetched-charts.yml` - Auto-update prefetched charts
- `.tekton/odh-batch-gateway-operator-pull-request.yaml` - Konflux PR build
- `.tekton/odh-batch-gateway-operator-push.yaml` - Konflux push build
- `Makefile` - Build, test, deploy targets

### Testing
- `internal/controller/suite_test.go` - envtest setup
- `internal/controller/llmbatchgateway_controller_test.go` - Controller reconcile tests
- `internal/controller/helm_test.go` - Helm value generation tests
- `internal/controller/helm_async_test.go` - Async Helm value tests
- `internal/controller/secret_sync_test.go` - Secret sync/ReferenceGrant tests
- `internal/controller/secret_watch_filter_test.go` - Watch predicate tests
- `internal/controller/statuspatch_test.go` - Status patch tests
- `internal/controller/metrics_test.go` - Metrics counter tests
- `internal/monitoring/monitoring_test.go` - Monitoring controller tests
- `test/e2e/e2e_test.go` - E2E test scenarios
- `test/e2e/helpers_test.go` - E2E kubectl helpers
- `hack/test-e2e-batch-gateway.sh` - Batch-gateway E2E runner
- `hack/dev-deploy.sh` - Kind dev environment setup
- `hack/setup-prereqs.sh` - Prerequisite installation

### Build & Container
- `Dockerfile` - Upstream container build
- `Dockerfile.konflux` - Downstream FIPS-capable build with UBI base
- `.dockerignore` - Docker build context exclusions
- `config/overlays/odh/kustomization.yaml` - ODH overlay
- `config/overlays/rhoai/kustomization.yaml` - RHOAI overlay

### Static Analysis
- `.golangci.yml` - golangci-lint v2 configuration (23 linters)

### Source Code (Key Files)
- `cmd/main.go` - Operator entrypoint
- `api/v1alpha1/llmbatchgateway_types.go` - CRD type definitions
- `internal/controller/llmbatchgateway_controller.go` - Main reconciler
- `internal/controller/helm.go` - Helm chart renderer
- `internal/controller/helm_batch.go` - Batch Helm values
- `internal/controller/helm_async.go` - Async Helm values
- `internal/controller/secret_sync.go` - Cross-namespace secret management
- `internal/monitoring/controller.go` - Monitoring resource reconciler
