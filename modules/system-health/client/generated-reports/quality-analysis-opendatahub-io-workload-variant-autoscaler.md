---
repository: "opendatahub-io/workload-variant-autoscaler"
overall_score: 8.1
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "Excellent test-to-code ratio (0.83) with 142 test files. Ginkgo/Gomega + testify frameworks. envtest used for controller tests."
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Comprehensive E2E suite with Kind cluster setup, OpenShift GPU E2E, smoke and full test tiers, and multi-controller tests."
  - dimension: "Build Integration"
    score: 8.5
    status: "PR builds Docker image, kustomize overlay validation for kubernetes/openshift, Konflux Tekton pipelines configured."
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage Dockerfiles, distroless base, multi-arch builds, but no dedicated container runtime validation tests."
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "coverprofile generated in Makefile but no codecov integration, no coverage thresholds, no PR coverage reporting."
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "Well-organized workflows with concurrency control, Go caching, path filtering, Prow integration, and signed commit checks."
  - dimension: "Static Analysis"
    score: 9.0
    status: "23 golangci-lint linters, pre-commit hooks (shellcheck, hadolint, markdownlint, yamllint), Dependabot for gomod/actions/docker."
  - dimension: "Agent Rules"
    score: 8.0
    status: "CLAUDE.md + AGENTS.md with Go style, E2E patterns, and naming conventions. Custom agents and PR review skill present."
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Coverage regressions can merge undetected; no PR-level coverage feedback for reviewers"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container runtime validation tests"
    impact: "Image startup failures not caught until deployment to staging/production"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "math/rand used in test utility (FIPS minor)"
    impact: "Non-crypto use in test code only; low risk but worth noting for FIPS audit trail"
    severity: "LOW"
    effort: "1 hour"
quick_wins:
  - title: "Add codecov integration for PR coverage reporting"
    effort: "2-4 hours"
    impact: "Automated coverage tracking, threshold enforcement, and PR coverage comments"
  - title: "Add container startup smoke test to CI"
    effort: "2-3 hours"
    impact: "Catch image build/startup regressions before merge"
  - title: "Add .claude/rules/ for test-specific agent guidance"
    effort: "2-3 hours"
    impact: "Improve AI-generated test consistency with framework-specific patterns (Ginkgo, envtest)"
recommendations:
  priority_0:
    - "Add codecov.yml and integrate codecov/codecov-action into CI to track and enforce coverage thresholds"
    - "Add coverage gates (e.g., 70% minimum, no decrease on PR) to prevent coverage regression"
  priority_1:
    - "Add container runtime validation test (build image, docker run health check) to PR workflow"
    - "Create .claude/rules/ directory with unit-test.md and e2e-test.md rules for Ginkgo/Gomega patterns"
    - "Add FIPS build tag verification to PR checks (ensure Konflux Dockerfile patterns are tested)"
  priority_2:
    - "Add benchmark regression testing to nightly CI to catch performance regressions"
    - "Consider adding contract tests for the Prometheus metrics API surface"
---

# Quality Analysis: workload-variant-autoscaler

## Executive Summary

- **Overall Score: 8.1/10**
- **Repository**: `opendatahub-io/workload-variant-autoscaler` (midstream, INFERENG/llm-d)
- **Type**: Kubernetes controller (Go), GPU-aware autoscaler for LLM inference workloads
- **Language**: Go 1.25, using controller-runtime, Ginkgo/Gomega, KEDA, Gateway API Inference Extension
- **Key Strengths**: Exceptional test coverage ratio, comprehensive E2E infrastructure (Kind + OpenShift GPU), strong CI/CD with concurrency control and path filtering, solid static analysis with 23 linters
- **Critical Gaps**: No coverage tracking/enforcement (codecov absent), no container runtime validation tests
- **Agent Rules Status**: Present and well-structured (CLAUDE.md + AGENTS.md + custom agents + skills)

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 9.0/10 | Excellent test-to-code ratio (0.83), envtest for controllers, Ginkgo/Gomega + testify |
| Integration/E2E | 20% | 9.0/10 | Kind + OpenShift GPU E2E, smoke/full tiers, multi-controller tests, KEDA integration |
| Build Integration | 15% | 8.5/10 | PR Docker builds, kustomize overlays validated, Konflux Tekton pipelines |
| Image Testing | 10% | 7.0/10 | Multi-stage Dockerfiles, distroless + UBI bases, multi-arch, no runtime validation |
| Coverage Tracking | 10% | 4.0/10 | coverprofile generated but no codecov, no thresholds, no PR reporting |
| CI/CD Automation | 15% | 9.0/10 | Concurrency control, Go caching, path filtering, Prow integration, signed commits |
| Static Analysis | 10% | 9.0/10 | 23 golangci-lint linters, pre-commit hooks, Dependabot (gomod+actions+docker) |
| Agent Rules | 5% | 8.0/10 | CLAUDE.md + AGENTS.md, custom agents (go-reviewer, test-analyzer, security-auditor), PR review skill |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: Coverage regressions can merge undetected; reviewers have no PR-level coverage feedback
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The Makefile generates `cover.out` via `go test -coverprofile`, but there is no `.codecov.yml`, no `codecov/codecov-action` in CI workflows, and no coverage threshold enforcement. Coverage data is generated but never uploaded, reported, or gated.
- **Fix**: Add `.codecov.yml` with a target threshold (e.g., 70%), add `codecov/codecov-action` step to `ci-pr-checks.yaml`, configure patch and project coverage targets.

### 2. No Container Runtime Validation Tests
- **Impact**: Image startup failures (missing binaries, wrong entrypoint, permission issues) not caught until deployment
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: The E2E suite deploys the built image into Kind/OpenShift clusters (which implicitly validates startup), but there is no dedicated lightweight container smoke test in the PR workflow that validates the image starts and responds to health checks. The E2E tests are heavy (60-90 min timeout) and may be skipped for docs-only PRs.
- **Fix**: Add a simple `docker run --rm <image> --help` or health probe check step to `ci-pr-checks.yaml` after the Docker build step.

### 3. math/rand in Test Utility (Minor FIPS Note)
- **Impact**: Non-crypto use in test code only (`test/utils/e2eutils.go:27`); low risk but worth noting for FIPS compliance audit trail
- **Severity**: LOW
- **Effort**: 1 hour
- **Details**: `math/rand` is imported in E2E test utilities. This is acceptable for test code but should be documented in FIPS compliance audits. The Konflux Dockerfile correctly uses `GOEXPERIMENT=strictfipsruntime` and UBI9 base image.

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
Add `.codecov.yml` and integrate into CI:

```yaml
# .codecov.yml
codecov:
  require_ci_to_pass: yes
coverage:
  precision: 2
  round: down
  range: "60...90"
  status:
    project:
      default:
        target: 70%
        threshold: 2%
    patch:
      default:
        target: 60%
```

Add to `ci-pr-checks.yaml` after `make test`:
```yaml
      - name: Upload coverage
        uses: codecov/codecov-action@v5
        with:
          files: cover.out
          fail_ci_if_error: false
```

### 2. Add Container Startup Smoke Test (2-3 hours)
Add a lightweight step to the PR workflow:
```yaml
      - name: Verify image starts
        run: |
          docker run --rm --entrypoint="" ${IMG} /manager --help || \
            echo "Warning: image startup check inconclusive"
```

### 3. Add .claude/rules/ for Test Guidance (2-3 hours)
Create framework-specific test rules:
- `.claude/rules/unit-tests.md` — Ginkgo/Gomega patterns, envtest setup, table-driven tests
- `.claude/rules/e2e-tests.md` — Label patterns (smoke/full/flaky), Eventually/Consistently usage, resource cleanup

## Detailed Findings

### Unit Tests (9.0/10)

**Strengths:**
- **Exceptional test-to-code ratio**: 142 test files to 172 source files (0.83 ratio), among the best in the opendatahub-io ecosystem
- **Framework**: Ginkgo/Gomega v2 (primary) with `testify` as secondary assertion library
- **envtest integration**: Controller tests use `setup-envtest` with real Kubernetes API server (see `internal/actuator/suite_test.go`, `internal/controller/suite_test.go`)
- **Well-organized packages**: Tests co-located with source in `internal/` and `pkg/` packages
- **Broad coverage areas**: Analyzers (saturation, throughput, queueing model), engines (saturation, scale-from-zero), pipeline, collector, metrics, config, utils, solver, core types
- **Test isolation**: Suite test files (`suite_test.go`) properly configure Ginkgo test runners per package

**Areas for improvement:**
- No explicit coverage thresholds in CI
- No test helper documentation (test patterns guide)

**Key test files:**
- `internal/engines/saturation/` — 15 test files covering engine events, scaling, thresholds, optimization, role grouping
- `internal/engines/pipeline/` — 8 test files covering optimizer, enforcer, limiter, type inventory
- `internal/controller/` — 6 test files covering ConfigMap reconciler, InferencePool reconciler, indexers, RBAC
- `pkg/solver/` — 3 test files for optimization algorithms
- `pkg/core/` — 6 test files for core domain types

### Integration/E2E Tests (9.0/10)

**Strengths:**
- **Dual environment support**: Kind cluster (with GPU emulation) and OpenShift (with real GPUs)
- **Tiered test strategy**: smoke (quick validation), full (comprehensive), multi-controller (dual namespace-scoped)
- **Label-based filtering**: `ginkgo.label-filter` for `smoke`, `full`, `multi-controller`, `flaky` categories
- **Infrastructure automation**: `deploy/install.sh` and `deploy/install-epp.sh` fully automate cluster setup
- **Fork PR safety**: OpenShift E2E uses `/ok-to-test` gating for fork PRs with secrets protection
- **GPU awareness**: E2E on OpenShift verifies GPU availability, reports status to PR, collects cluster diagnostics on failure
- **Failure diagnostics**: `ReportAfterEach` dumps controller logs and scaler state on test failure
- **Resource cleanup**: Comprehensive cleanup of test HPAs, ScaledObjects, Deployments, LeaderWorkerSets, Services, ServiceMonitors

**E2E test files (12 test files):**
- `test/e2e/smoke_keda_test.go` — KEDA smoke validation
- `test/e2e/saturation_v2_test.go` — Saturation v2 analyzer E2E
- `test/e2e/scale_from_zero_test.go` — Scale-from-zero E2E
- `test/e2e/multi_controller_test.go` — Multi-controller namespace isolation
- `test/e2e/throughput_analyzer_test.go` — Throughput analyzer E2E
- `test/e2e/pod_scraping_test.go` — Pod metrics scraping
- `test/e2e/operational_dashboard_test.go` — Operational metrics dashboard
- `test/e2e/limiter_test.go` — Scaling limiter E2E
- `test/e2e/annotation_discovery_test.go` — Annotation-based variant discovery
- `test/e2e/sglang_backend_test.go` — SGLang backend support
- `test/e2e/saturation_analyzer_path_test.go` — Saturation analyzer paths

**CI integration:**
- `ci-pr-checks.yaml`: Automatic smoke + full E2E on Kind for every PR (with code changes)
- `ci-e2e-openshift.yaml`: OpenShift GPU E2E with self-hosted runners, /ok-to-test gating

### Build Integration (8.5/10)

**Strengths:**
- **PR Docker builds**: `ci-pr-checks.yaml` builds Docker image as part of E2E setup (`deploy/ci-pr-checks/build-wva-image-local.sh`)
- **Kustomize overlay validation**: Dedicated `kustomize-build` job validates 3 overlays (cluster-scoped/kubernetes, namespace-scoped/openshift, namespace-scoped/kubernetes)
- **Konflux integration**: `.tekton/` directory with PR and push Tekton PipelineRun definitions for Konflux builds
- **Multi-arch support**: Release workflow builds `linux/amd64,linux/arm64` via `docker buildx`
- **Dual Dockerfile**: `Dockerfile` (upstream, distroless) and `Dockerfile.konflux` (downstream, UBI9 with FIPS)

**Areas for improvement:**
- No PR-time Konflux build simulation (Tekton pipeline runs in separate system)
- No explicit CRD validation step (though kustomize build catches most manifest issues)

**Key files:**
- `Dockerfile` — Multi-stage build, `quay.io/projectquay/golang:1.25` builder, `gcr.io/distroless/static:nonroot` runtime
- `Dockerfile.konflux` — UBI9 go-toolset builder with `GOEXPERIMENT=strictfipsruntime`, `ubi9/ubi-minimal` runtime
- `.tekton/odh-workload-variant-autoscaler-controller-pull-request.yaml` — Konflux PR pipeline
- `.tekton/odh-workload-variant-autoscaler-controller-push.yaml` — Konflux push pipeline

### Image Testing (7.0/10)

**Strengths:**
- **Multi-stage builds**: Both Dockerfiles use builder/runtime separation, minimizing image size
- **Security-conscious base images**: Distroless (upstream) and UBI9-minimal (Konflux), both running as non-root (USER 65532:65532)
- **Multi-architecture**: Release builds target `linux/amd64,linux/arm64` via `docker buildx`
- **FIPS-compliant build**: Konflux Dockerfile uses `GOEXPERIMENT=strictfipsruntime` and `CGO_ENABLED=1` with UBI9 base
- **Pinned image digests**: Both Dockerfiles pin base images by SHA256 digest for reproducibility
- **OCI labels**: Proper `org.opencontainers.image.*` annotations and Red Hat component labels

**Areas for improvement:**
- No dedicated container runtime validation test (image startup check)
- No HEALTHCHECK instruction in Dockerfiles (though Kubernetes probes would be in manifests)
- No testcontainers or equivalent runtime validation in CI

### Coverage Tracking (4.0/10)

**Strengths:**
- `make test` generates `cover.out` via `go test -coverprofile`

**Gaps:**
- No `.codecov.yml` or `codecov.yml` configuration
- No `codecov/codecov-action` in any CI workflow
- No coverage threshold enforcement
- No PR coverage reporting (no coverage bot comments)
- Coverage file generated but never uploaded or analyzed
- No coverage gates preventing regression

### CI/CD Automation (9.0/10)

**Strengths:**
- **Concurrency control**: All workflows use `concurrency` groups with `cancel-in-progress: true`
- **Go module caching**: `actions/setup-go` with `cache-dependency-path: ./go.sum`
- **Path filtering**: Smart skip for docs-only PRs using `dorny/paths-filter`
- **Prow integration**: `prow-github.yml`, `prow-pr-automerge.yml`, `prow-pr-remove-lgtm.yml` for Prow-style workflow
- **Signed commits**: Reusable workflow from `llm-d/llm-d-infra` for DCO compliance
- **Stale issue management**: `stale.yaml` and `unstale.yaml` for issue lifecycle
- **PR labeling**: Automatic label assignment via `labeler.yaml`
- **Disconnected readiness**: `disconnected-readiness.yml` for air-gapped deployment validation
- **Timeout enforcement**: E2E jobs have explicit `timeout-minutes: 60/90`
- **Artifact management**: Cluster diagnostics uploaded with 7-day retention

**Workflow inventory (17 workflows):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci-pr-checks.yaml` | PR, dispatch | Lint, test, kustomize build, E2E smoke + full |
| `ci-e2e-openshift.yaml` | PR, comment, dispatch | OpenShift GPU E2E with self-hosted runners |
| `ci-main-image.yaml` | Push to main | Build and push :main Docker image (multi-arch) |
| `ci-release.yaml` | Tag push, release | Build and push release Docker image (multi-arch) |
| `ci-signed-commits.yaml` | PR | DCO signed commit verification |
| `prow-github.yml` | PR | Prow GitHub integration |
| `prow-pr-automerge.yml` | PR | Prow auto-merge support |
| `prow-pr-remove-lgtm.yml` | PR | Remove LGTM on new pushes |
| `labeler.yaml` | PR | Automatic PR labeling |
| `stale.yaml` | Schedule | Mark stale issues |
| `unstale.yaml` | Issue comment | Remove stale labels |
| `assign-docs-pr.yml` | PR | Assign docs PRs to reviewers |
| `non-main-gatekeeper.yml` | PR | Gate non-main branch PRs |
| `disconnected-readiness.yml` | PR | Air-gapped deployment validation |
| `copilot-setup-steps.yml` | Push | GitHub Copilot workspace setup |

### Static Analysis (9.0/10)

#### Linting
- **golangci-lint v2.8.0** with **23 linters enabled**: copyloopvar, dupword, durationcheck, errcheck, fatcontext, ginkgolinter, goconst, gocritic, govet, ineffassign, loggercheck, makezero, misspell, nakedret, perfsprint, prealloc, revive, staticcheck, unconvert, unparam, unused
- **Formatters**: gofmt, goimports
- **Parallel runners enabled**: `allow-parallel-runners: true`
- **Exclusions**: Generated code, common false positives, deprecated API warnings

#### Pre-commit Hooks
- **Comprehensive `.pre-commit-config.yaml`** with:
  - File hygiene: trailing-whitespace, end-of-file-fixer, check-yaml, check-json, check-merge-conflict, mixed-line-ending, check-case-conflict, check-added-large-files (1MB)
  - Shell linting: shellcheck with severity=warning
  - Dockerfile linting: hadolint with failure-threshold=error
  - Markdown linting: markdownlint with auto-fix
  - YAML linting: yamllint with 250-char line limit
  - Typo checking: `_typos.toml` configuration present

#### FIPS Compatibility
- **Konflux Dockerfile**: Correctly uses `GOEXPERIMENT=strictfipsruntime` with `CGO_ENABLED=1` and UBI9 base image
- **Upstream Dockerfile**: Uses `CGO_ENABLED=0` (no FIPS) with distroless base — appropriate for non-FIPS upstream builds
- **Minor note**: `math/rand` imported in `test/utils/e2eutils.go` — non-crypto use in test code only, acceptable

#### Dependency Alerts
- **Dependabot configured** (`.github/dependabot.yml`) covering three ecosystems:
  - `gomod` — weekly, grouped by Kubernetes and general dependencies, ignoring major version bumps
  - `github-actions` — weekly
  - `docker` — weekly for base image updates
- **Smart grouping**: Kubernetes dependencies (`k8s.io/*`, `sigs.k8s.io/*`) grouped together
- **Safety**: Major version updates ignored by default to prevent breaking changes

### Agent Rules (8.0/10)

**Present files:**
- `CLAUDE.md` — Points to `AGENTS.md` for instructions
- `AGENTS.md` — Comprehensive Go code style guide covering naming, formatting, error handling, logging, documentation, concurrency, project structure, license headers, kustomize naming conventions, E2E testing patterns, deprecation notes
- `.claude/agents/go-reviewer.md` — Custom Go code review agent
- `.claude/agents/go-reuse-checker.md` — Code reuse analysis agent
- `.claude/agents/security-auditor.md` — Security audit agent
- `.claude/agents/test-analyzer.md` — Test analysis agent
- `.claude/skills/pr-review/SKILL.md` — PR review skill with idempotent comment posting
- `.github/agents/` — GitHub Copilot agents for agentic workflows (create, debug, shared)

**Strengths:**
- Well-structured AGENTS.md with Go-specific conventions
- Custom agents covering key quality dimensions (review, security, testing, reuse)
- PR review skill with automated comment management
- E2E testing guidance (make targets, simulator usage, image registry policy)
- Kustomize file naming convention documented

**Areas for improvement:**
- No `.claude/rules/` directory with per-topic rule files
- Missing framework-specific test creation rules (Ginkgo patterns, envtest setup, table-driven test templates)
- No unit test creation guidelines beyond general Go conventions

## Recommendations

### Priority 0 (Critical)

1. **Add codecov integration**: Create `.codecov.yml`, add `codecov/codecov-action` to `ci-pr-checks.yaml`, set project target at 70% with patch target at 60%. This is the single most impactful improvement — it makes coverage visible and enforceable.

2. **Add coverage gates**: Configure codecov to fail PR checks if coverage drops below threshold, preventing silent coverage regression on merge.

### Priority 1 (High Value)

3. **Add container runtime validation**: Add a lightweight `docker run` smoke test to `ci-pr-checks.yaml` after the build step to catch image startup failures before E2E tests run.

4. **Create .claude/rules/ directory**: Add `unit-tests.md` and `e2e-tests.md` with Ginkgo/Gomega patterns, envtest configuration templates, label conventions (smoke/full/flaky), Eventually/Consistently best practices.

5. **Add FIPS build verification to PR checks**: Add a CI step that builds with `GOEXPERIMENT=strictfipsruntime` on PRs to catch FIPS-incompatible code changes before they reach Konflux.

### Priority 2 (Nice-to-Have)

6. **Add benchmark regression testing**: Wire the existing benchmark infrastructure (`make benchmark-*`) into nightly CI to detect performance regressions in the autoscaling algorithms.

7. **Add contract tests for Prometheus metrics API**: The WVA exposes custom Prometheus metrics (`wva_desired_replicas`, etc.) consumed by KEDA. Contract tests would ensure metric names/labels don't change unexpectedly.

## Comparison to Gold Standards

| Dimension | workload-variant-autoscaler | odh-dashboard | kserve | notebooks |
|-----------|---------------------------|---------------|--------|-----------|
| Unit Tests | 9.0 — 0.83 ratio, envtest | 8.0 — Jest/Cypress | 8.0 — Go testing | 6.0 — Python |
| Integration/E2E | 9.0 — Kind + OpenShift GPU | 9.0 — Multi-layer | 8.0 — Multi-version | 7.0 — Image tests |
| Build Integration | 8.5 — PR builds + kustomize | 8.0 — Webpack/MF | 7.0 — Basic builds | 6.0 — Image builds |
| Image Testing | 7.0 — Multi-arch, no runtime | 6.0 — Basic | 6.0 — Basic | 9.0 — 5-layer |
| Coverage Tracking | 4.0 — No codecov | 7.0 — Codecov | 8.0 — Enforced | 5.0 — Partial |
| CI/CD Automation | 9.0 — Concurrency, caching | 9.0 — Comprehensive | 8.0 — Good | 7.0 — Basic |
| Static Analysis | 9.0 — 23 linters + hooks | 8.0 — ESLint + Prettier | 7.0 — golangci-lint | 6.0 — Basic |
| Agent Rules | 8.0 — AGENTS.md + skills | 7.0 — CLAUDE.md | 3.0 — None | 2.0 — None |
| **Overall** | **8.1** | **7.8** | **7.0** | **6.0** |

## File Paths Reference

### CI/CD
- `.github/workflows/ci-pr-checks.yaml` — Primary PR checks (lint, test, kustomize, E2E)
- `.github/workflows/ci-e2e-openshift.yaml` — OpenShift GPU E2E
- `.github/workflows/ci-main-image.yaml` — Main branch image build
- `.github/workflows/ci-release.yaml` — Release image build
- `.tekton/odh-workload-variant-autoscaler-controller-pull-request.yaml` — Konflux PR pipeline
- `.tekton/odh-workload-variant-autoscaler-controller-push.yaml` — Konflux push pipeline

### Testing
- `test/e2e/` — 12 E2E test files with Kind and OpenShift support
- `test/utils/` — Shared test utilities (e2eutils.go, logging.go, debug_helpers.go)
- `internal/*/suite_test.go` — Ginkgo suite bootstraps with envtest
- `pkg/*/` — Domain model unit tests (solver, core, analyzer, config)
- `Makefile` — `test`, `test-e2e-smoke`, `test-e2e-full`, `test-e2e-multi-controller` targets

### Code Quality
- `.golangci.yml` — 23 linters, parallel runners, exclusions
- `.pre-commit-config.yaml` — shellcheck, hadolint, markdownlint, yamllint
- `.github/dependabot.yml` — gomod, actions, docker ecosystems
- `_typos.toml` — Typo checking configuration

### Container Images
- `Dockerfile` — Upstream: golang builder + distroless runtime
- `Dockerfile.konflux` — Downstream: UBI9 go-toolset + FIPS + ubi-minimal runtime
- `.dockerignore` — Build context exclusions

### Agent Rules
- `CLAUDE.md` — Entry point, references AGENTS.md
- `AGENTS.md` — Go code style, naming, E2E testing, kustomize conventions
- `.claude/agents/` — Custom agents (go-reviewer, test-analyzer, security-auditor, go-reuse-checker)
- `.claude/skills/pr-review/SKILL.md` — PR review skill
- `.github/agents/` — GitHub Copilot agentic workflows
