---
repository: "opendatahub-io/training-operator"
overall_score: 7.2
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Good Go unit tests with envtest across 4 K8s versions; Python SDK unit tests present but limited"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Comprehensive E2E suite with Kind clusters, multi-version K8s matrix, gang scheduler testing, and LLM fine-tuning E2E"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time image builds on ODH workflow; Konflux/Tekton pipelines configured; kustomize overlays validated in deploy scripts"
  - dimension: "Image Testing"
    score: 6.0
    status: "Multi-stage Dockerfiles with UBI9 FIPS variant and multi-arch support; no runtime validation or container health test"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "coverprofile generated in Makefile but no codecov integration, no thresholds, no PR reporting"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "21 workflows with good concurrency control, matrix strategies, gated branch sync; missing caching"
  - dimension: "Static Analysis"
    score: 7.5
    status: "golangci-lint, flake8, pre-commit enforced in CI, semgrep rules, gitleaks; no Dependabot/Renovate"
  - dimension: "Agent Rules"
    score: 9.0
    status: "Comprehensive AGENTS.md and CLAUDE.md with repo layout, commands, behavior rules, branch strategy"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Coverage regressions go undetected; no visibility into test coverage trends across PRs"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No Dependabot or Renovate for dependency alerts"
    impact: "Stale dependencies with known CVEs may go unnoticed; manual dependency update burden"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No container image runtime validation"
    impact: "Image startup failures or runtime issues not caught until deployment to cluster"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "Limited Go test isolation patterns"
    impact: "Tests may interfere with each other; no t.Parallel() usage detected across 46 test files"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add Codecov integration with PR reporting"
    effort: "2-4 hours"
    impact: "Immediate visibility into coverage trends; can enforce coverage thresholds on PRs"
  - title: "Enable Dependabot for Go modules, pip, and Docker"
    effort: "1-2 hours"
    impact: "Automated dependency update PRs with CVE alerts"
  - title: "Add Go test caching in CI workflows"
    effort: "1-2 hours"
    impact: "Faster CI runs by caching Go module downloads and build artifacts"
  - title: "Add .claude/rules/ directory with test creation rules"
    effort: "2-3 hours"
    impact: "More granular agent rules for specific test patterns beyond what AGENTS.md provides"
recommendations:
  priority_0:
    - "Integrate Codecov with .codecov.yml and coverage thresholds (e.g., 60% minimum, no regression on diff)"
    - "Add .github/dependabot.yml covering gomod, pip, docker, and github-actions ecosystems"
  priority_1:
    - "Add container image runtime validation (startup test, health check verification) in PR workflow"
    - "Introduce t.Parallel() across Go unit tests for faster execution and better isolation"
    - "Add Go module caching to unittests.yaml and test-go.yaml workflows"
  priority_2:
    - "Create .claude/rules/ directory with framework-specific test patterns (envtest, ginkgo, pytest)"
    - "Add contract tests between Python SDK and Go controller API"
    - "Consider adding webhook testing coverage for all 6 job types"
---

# Quality Analysis: opendatahub-io/training-operator

**Repository**: [opendatahub-io/training-operator](https://github.com/opendatahub-io/training-operator)
**Jira**: RHOAIENG / Training Kubeflow (midstream)
**Analysis Date**: 2026-07-20
**Primary Languages**: Go (controller/operator), Python (SDK, E2E tests)
**Type**: Kubernetes Operator (Kubeflow Training Operator v1)

## Executive Summary

- **Overall Score: 7.2/10**
- **Key Strengths**: Comprehensive E2E testing with multi-version K8s matrices and gang scheduler coverage; excellent AGENTS.md documentation; FIPS-compliant RHOAI build variant; Konflux/Tekton pipelines configured; strong branch gating strategy (dev → stable → rhoai)
- **Critical Gaps**: No coverage tracking/enforcement despite `--coverprofile` in Makefile; no Dependabot or Renovate; no container runtime validation testing
- **Agent Rules Status**: Present — both AGENTS.md and CLAUDE.md with comprehensive content

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 7.5/10 | Good Go envtest coverage; Python SDK unit test exists but limited |
| Integration/E2E | 20% | 8.5/10 | Comprehensive Kind-based E2E with multi-K8s version and gang scheduler matrix |
| Build Integration | 15% | 7.0/10 | ODH PR builds image; Konflux pipelines present; kustomize overlays for RHOAI |
| Image Testing | 10% | 6.0/10 | Multi-stage builds, UBI9 FIPS variant, multi-arch; no runtime validation |
| Coverage Tracking | 10% | 3.0/10 | coverprofile in Makefile only; no codecov, no thresholds, no PR reporting |
| CI/CD Automation | 15% | 8.0/10 | 21 workflows, good concurrency control, matrix strategies; missing caching |
| Static Analysis | 10% | 7.5/10 | golangci-lint, flake8, pre-commit, semgrep, gitleaks; no dependency alerts |
| Agent Rules | 5% | 9.0/10 | Excellent AGENTS.md with layout, commands, behavior rules, branch strategy |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: Coverage regressions go undetected; no visibility into which packages have adequate test coverage
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Detail**: The `Makefile` generates `cover.out` via `--coverprofile` but it is never uploaded, analyzed, or enforced. No `.codecov.yml`, no `coveralls`, no coverage threshold. PRs can reduce coverage without any signal.

### 2. No Dependabot or Renovate Configuration
- **Impact**: Go modules, Python dependencies, and Docker base images may become stale with known CVEs; all updates are manual
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Detail**: No `.github/dependabot.yml` or `renovate.json` found. The repository has Go modules (`go.mod`), Python SDK (`sdk/python/`), Docker base images (UBI9, distroless, golang), and GitHub Actions — all should have automated dependency update PRs.

### 3. No Container Image Runtime Validation
- **Impact**: Operator image startup failures or missing runtime dependencies not caught until cluster deployment
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Detail**: While the ODH workflow builds and inspects image metadata (`buildah inspect`), there is no test that actually runs the container to verify it starts, responds to health checks, or loads CRDs correctly. The E2E tests do deploy to Kind, but that's a different workflow path.

### 4. Limited Go Test Isolation
- **Impact**: Potential test interdependencies; slower test execution without parallel test runs
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Detail**: Zero uses of `t.Parallel()` found across 46 Go test files (11,728 lines). Tests use envtest with ginkgo/gomega in controllers but don't leverage Go's parallel test infrastructure.

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
Add `.codecov.yml` and upload coverage from the `unittests.yaml` workflow:
```yaml
# .codecov.yml
coverage:
  status:
    project:
      default:
        target: 60%
    patch:
      default:
        target: 70%
```
Add to `unittests.yaml` after `make test`:
```yaml
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: cover.out
    flags: unittests
```

### 2. Enable Dependabot (1-2 hours)
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
  - package-ecosystem: "docker"
    directory: "/build/images/training-operator"
    schedule:
      interval: "monthly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 3. Add Go Module Caching (1-2 hours)
Add caching to `unittests.yaml` and `test-go.yaml`:
```yaml
- name: Setup Go
  uses: actions/setup-go@v5
  with:
    go-version-file: go.mod
    cache: true
```

### 4. Add .claude/rules/ Test Patterns (2-3 hours)
Create framework-specific test rules for envtest, ginkgo, and pytest patterns beyond the general AGENTS.md guidance.

## Detailed Findings

### Unit Tests (7.5/10)

**Go Unit Tests (46 files, 11,728 LOC)**:
- Uses `envtest` with controller-runtime for realistic K8s API testing
- Tests against 4 Kubernetes versions via matrix: 1.28.3, 1.29.3, 1.30.0, 1.31.0
- Controller tests use ginkgo/gomega framework with suite setup (`suite_test.go` files)
- Coverage includes: controllers (6 job types), webhooks (5 types), APIs, utilities, cert management
- Test-to-code ratio: ~46 test files to ~191 source files (24%) — adequate for operator pattern
- Generates coverage profile via `--coverprofile cover.out` in Makefile
- Uses `testify/assert` in utility tests, ginkgo/gomega in controller tests

**Python Unit Tests (1 file)**:
- `sdk/python/kubeflow/training/api/training_client_test.py` — tests the Python SDK client
- Uses `pytest` with `unittest.mock` for mocking Kubernetes client calls
- Tested across Python 3.10, 3.11 in CI matrix

**Gaps**:
- No `t.Parallel()` usage for Go test isolation
- Python SDK has only 1 unit test file for the entire client library
- No test for `kubeflow/trainer/` or `kubeflow/storage_initializer/` Python components

### Integration/E2E Tests (8.5/10)

**Integration Tests** (`integration-tests.yaml`):
- PR-triggered with concurrency control
- 9-entry matrix covering 3 K8s versions (v1.28.7, v1.29.2, v1.30.6) × 3 gang schedulers (none, scheduler-plugins, volcano)
- Randomized Python version assignment per combination
- Uses Kind cluster via `helm/kind-action` for realistic deployment
- Builds and deploys training operator, then runs pytest E2E suite
- Tests all 6 job types: PyTorchJob, TFJob, XGBoostJob, MPIJob, PaddleJob, JAXJob
- Failure collection for volcano scheduler logs

**E2E Tests** (`e2e-test-train-api.yaml`):
- Tests the `train()` API for LLM fine-tuning workflows
- Builds trainer and storage-initializer images
- Tests across Python 3.9, 3.10, 3.11 on K8s v1.31.4
- Tests HuggingFace integration for model fine-tuning

**Notebook E2E** (`test-example-notebooks.yaml`):
- Tests example Jupyter notebooks end-to-end
- 3 K8s versions × 3 Python versions matrix (9 combinations)
- 30-minute timeout per run

**Shared Test Infrastructure**:
- `.github/workflows/setup-e2e-test/` composite action for consistent Kind cluster setup
- `.github/workflows/free-up-disk-space/` to handle GitHub runner disk constraints
- `scripts/gha/` directory with build and setup scripts

### Build Integration (7.0/10)

**PR-Time Builds**:
- `odh-build-and-publish-operator-image.yaml`: Builds operator image on PRs to `dev` branch
  - Uses `-tags strictfipsruntime` and `CGO_ENABLED=1` for FIPS compliance
  - Builds for linux/amd64 and linux/arm64
  - Uses `buildah` for multi-arch manifest builds
  - Inspects image metadata and manifest after build
- `publish-core-images.yaml`: Builds on push/PR for upstream images (amd64, arm64, ppc64le)
- Integration tests build and deploy the operator to Kind cluster (`kustomize build | kubectl apply`)

**Konflux/Tekton**:
- `.tekton/odh-training-operator-pull-request.yaml` — Tekton PipelineRun for PR builds targeting `stable` branch
- `.tekton/odh-training-operator-push.yaml` — Tekton PipelineRun for push builds
- Uses `Dockerfile.rhoai` (UBI9, FIPS-compliant) for Konflux builds

**Kustomize Overlays**:
- `manifests/base/` — CRDs, RBAC, webhook, deployment with health probes
- `manifests/overlays/standalone` and `manifests/overlays/kubeflow`
- `manifests/rhoai/` — RHOAI-specific overlay with configmap generation, metrics, cert patches

**Gaps**:
- No explicit Konflux build simulation in PR workflow (Tekton only runs on `stable` branch PRs)
- No `kustomize build --dry-run` validation step in PR workflows

### Image Testing (6.0/10)

**Dockerfiles**:
- `Dockerfile` — Standard multi-stage: golang:1.25 builder → distroless runtime (upstream)
- `Dockerfile.rhoai` — UBI9-based with FIPS: `ubi9/go-toolset:1.26` builder → `ubi9/ubi:latest` runtime, `CGO_ENABLED=1`, `-tags strictfipsruntime`
- `Dockerfile.multiarch` — UBI9-minimal runtime for pre-compiled multi-arch binaries

**Multi-Architecture**:
- Builds for `linux/amd64,linux/arm64,linux/ppc64le` (core images)
- ODH workflow builds `linux/amd64,linux/arm64`
- Uses `buildah` for manifest lists

**Base Images**:
- Upstream: `gcr.io/distroless/static:latest` (minimal, secure)
- RHOAI: `registry.access.redhat.com/ubi9/ubi:latest` (FIPS-capable)
- Non-root user: `USER 65532:65532` in both RHOAI and multiarch Dockerfiles

**Health Probes**:
- `manifests/base/deployment.yaml` includes `livenessProbe` and `readinessProbe` on `/healthz`

**Gaps**:
- No container startup test (verify image starts and health endpoint responds)
- No `.dockerignore` for main operator image (only `examples/pytorch/elastic/imagenet/` has one)
- No Testcontainers or equivalent runtime validation
- Standard Dockerfile uses root user (no `USER` directive)

### Coverage Tracking (3.0/10)

**Current State**:
- `Makefile` includes `--coverprofile cover.out` in the `test` target
- No `.codecov.yml`, `codecov.yml`, or `.coveragerc`
- No `codecov/codecov-action` in any workflow
- No coverage threshold enforcement
- No PR coverage reporting
- Coverage file generated but never uploaded or analyzed

**Impact**: This is the weakest dimension. Coverage data exists locally but provides zero visibility to the team.

### CI/CD Automation (8.0/10)

**Workflow Inventory** (21 workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `unittests.yaml` | push, PR | Go unit tests with envtest (4 K8s versions) |
| `test-go.yaml` | push, PR | Go module/codegen verification |
| `test-python.yaml` | push, PR | Python SDK unit tests (2 Python versions) |
| `integration-tests.yaml` | PR | Full integration with Kind, 9-matrix combos |
| `e2e-test-train-api.yaml` | PR | Train API E2E with LLM fine-tuning |
| `test-example-notebooks.yaml` | PR | Notebook E2E (9 matrix combos) |
| `pre-commit.yaml` | PR, push to main | Pre-commit hook enforcement |
| `govulncheck.yaml` | PR (path-filtered) | Go vulnerability scanning |
| `odh-build-and-publish-operator-image.yaml` | push to dev, PR to dev | ODH operator image build |
| `publish-core-images.yaml` | push, PR | Core image builds (3 architectures) |
| `publish-example-images.yaml` | push, PR | Example training job images |
| `publish-conformance-images.yaml` | push, PR | Conformance test images |
| `disconnected-readiness.yml` | PR to dev | Disconnected environment readiness check |
| `stale.yaml` | schedule (every 5h) | Stale issue/PR management |
| `sync-dev-to-stable.yml` | schedule (every 4h) | Gated sync dev → stable |
| `sync-stable-to-rhoai.yml` | schedule (every 4h) | Gated sync stable → rhoai |
| `approve-lake-gate.yml` | issue_comment | Fast-forward merge for lake-gate PRs |
| `approve-ocean-gate.yml` | issue_comment | Fast-forward merge for ocean-gate PRs |
| `odh-release.yaml` | dispatch, tag push | Release automation |
| `odh-kfto-sdk-notebooks-sync.yaml` | dispatch | SDK/notebook dependency sync |
| `trigger-rerun-test.yaml` | issue_comment | Re-run PR tests on comment |

**Strengths**:
- Concurrency control on 3 key PR workflows (`cancel-in-progress: true`)
- Matrix strategies for multi-version testing (K8s, Python, gang schedulers)
- Reusable workflow for image builds (`build-and-publish-images.yaml`)
- Shared composite action for E2E setup
- Gated branch promotion (dev → stable → rhoai) with manual approval

**Gaps**:
- No Go module caching in test workflows (missing `cache: true` in `setup-go`)
- No timeout-minutes on most workflows (only `test-example-notebooks.yaml` has 30min)
- No test result artifact upload for debugging failures
- `trigger-rerun-test.yaml` uses `ubuntu-20.04` (outdated runner)

### Static Analysis (7.5/10)

**Linting**:
- `.golangci.yaml` (v2 format) — enables: `unused`, `errcheck`, `govet`, `ineffassign`
  - Only 4 linters enabled (could enable more: `staticcheck`, `gosimple`, `gocritic`, `misspell`)
  - Parallel runners allowed
- `.flake8` — `max-line-length = 100`, extends `W503`
- Pre-commit hooks: `check-yaml`, `check-json`, `end-of-file-fixer`, `trailing-whitespace`, `isort`, `black`, `flake8`

**Pre-commit Enforcement**:
- `.pre-commit-config.yaml` present with comprehensive hooks for both Go and Python
- `pre-commit.yaml` workflow enforces hooks on PRs and pushes to main
- Extensive exclusion list for generated files

**Security Scanning**:
- `semgrep.yaml` — Unified template v3.0.0 covering Go, Python, TypeScript, YAML, and generic secrets
- `.gitleaks.toml` — Gitleaks configuration synced from security-config with test fixture allowlists
- `govulncheck.yaml` — Go vulnerability scanning on PRs (path-filtered to relevant Go code)

**FIPS Compatibility**:
- No non-FIPS crypto imports detected (`crypto/md5`, `crypto/des`, `crypto/rc4` clean)
- RHOAI Dockerfile uses `CGO_ENABLED=1` + `-tags strictfipsruntime` (FIPS compliant)
- UBI9 base images (FIPS-capable runtime)
- ODH build workflow explicitly builds with `strictfipsruntime` tag

**Dependency Alerts**:
- **Missing**: No `.github/dependabot.yml` or `renovate.json`
- Ecosystems needing coverage: gomod, pip, docker, github-actions

### Agent Rules (9.0/10)

**AGENTS.md / CLAUDE.md** (identical content, both present):
- Comprehensive repository documentation including:
  - Repository context (based on kubeflow/trainer v1.9.0, v1 API)
  - Branch strategy with gated sync (dev → stable → rhoai) and merge rules
  - Complete repository layout with directory descriptions
  - Environment and tooling details
  - Build, test, lint, and code generation commands with examples
  - Targeted lint commands for specific files/packages
  - Agent behavior rules (atomic changes, generated code restrictions, import patterns)
  - Commit/PR conventions

**Strengths**:
- Actionable commands with specific flags and paths
- Clear warnings about protected areas (`.tekton/`, sync workflows, `odh_utils/`)
- Code generation workflow documented (`make generate` after API changes)
- Security scanning awareness (semgrep, gitleaks)

**Gaps**:
- No `.claude/rules/` directory with granular test-specific rules
- No `.claude/skills/` directory for custom automation
- Test patterns not explicitly documented (e.g., envtest suite setup, ginkgo patterns)
- No examples of good test patterns for contributors to follow

## Recommendations

### Priority 0 (Critical)

1. **Integrate Codecov with coverage thresholds** — Add `.codecov.yml`, upload `cover.out` from `unittests.yaml`, set project target (60%) and patch target (70%). This is the single highest-ROI improvement.

2. **Add Dependabot configuration** — Create `.github/dependabot.yml` covering `gomod`, `pip`, `docker`, and `github-actions` ecosystems. Weekly for code, monthly for Docker base images.

### Priority 1 (High Value)

3. **Add container runtime validation** — After image build in ODH workflow, add a step that runs the container and verifies it starts and the `/healthz` endpoint responds.

4. **Enable Go test caching** — Add `cache: true` to all `actions/setup-go@v5` steps in test workflows.

5. **Expand golangci-lint configuration** — Enable additional linters: `staticcheck`, `gosimple`, `gocritic`, `misspell`, `nolintlint`. The current 4 linters miss many useful checks.

6. **Add workflow timeouts** — Set `timeout-minutes` on all PR-triggered workflows to prevent runaway jobs.

### Priority 2 (Nice-to-Have)

7. **Create .claude/rules/ directory** — Add test-specific rules for envtest patterns, ginkgo suite setup, and pytest E2E conventions.

8. **Add t.Parallel() to Go tests** — Enable parallel test execution in unit tests for faster CI.

9. **Add test result artifact uploads** — Upload test logs and coverage reports as workflow artifacts for easier debugging.

10. **Add contract tests** — Test API contracts between Python SDK client and Go controller to catch breaking changes.

## Comparison to Gold Standards

| Practice | training-operator | odh-dashboard (gold) | notebooks (gold) | kserve (gold) |
|----------|-------------------|----------------------|-------------------|---------------|
| Unit Test Framework | envtest + ginkgo/gomega | Jest + React Testing Library | pytest | envtest + ginkgo |
| Test-to-Code Ratio | 24% (46/191 files) | ~40%+ | Varies | ~35% |
| E2E Test Coverage | 6 job types + LLM fine-tune | Cypress + Playwright | 5-layer validation | Multi-version |
| Coverage Tracking | None (profile only) | Codecov enforced | Codecov | Codecov enforced |
| Coverage Threshold | None | Yes (project + patch) | Yes | Yes |
| CI Matrix Testing | K8s × Python × scheduler | Browser × viewport | Image × arch | K8s × runtime |
| Concurrency Control | 3 workflows | All PR workflows | Yes | Yes |
| Dependency Alerts | None | Dependabot | Dependabot | Dependabot |
| FIPS Build | strictfipsruntime + UBI9 | N/A | UBI-based | N/A |
| Agent Rules | AGENTS.md (comprehensive) | .claude/rules/ | None | None |
| Pre-commit | Yes, CI-enforced | Yes | Partial | Yes |
| Konflux/Tekton | Yes (stable branch) | Yes | Yes | N/A |

## File Paths Reference

### CI/CD
- `.github/workflows/unittests.yaml` — Go unit tests with envtest
- `.github/workflows/integration-tests.yaml` — Full integration test suite
- `.github/workflows/e2e-test-train-api.yaml` — Train API E2E
- `.github/workflows/test-python.yaml` — Python SDK tests
- `.github/workflows/test-go.yaml` — Go module verification
- `.github/workflows/odh-build-and-publish-operator-image.yaml` — ODH image build
- `.github/workflows/pre-commit.yaml` — Pre-commit enforcement
- `.github/workflows/govulncheck.yaml` — Go vulnerability scanning
- `.github/workflows/setup-e2e-test/action.yml` — Shared E2E setup
- `.tekton/odh-training-operator-pull-request.yaml` — Konflux PR pipeline
- `.tekton/odh-training-operator-push.yaml` — Konflux push pipeline

### Testing
- `pkg/controller.v1/*/` — Controller tests (6 job types)
- `pkg/webhooks/*/` — Webhook validation tests (5 types)
- `pkg/apis/kubeflow.org/v1/*_test.go` — API type tests
- `sdk/python/kubeflow/training/api/training_client_test.py` — Python SDK unit test
- `sdk/python/test/e2e/` — Python E2E tests (6 job types)
- `sdk/python/test/e2e-fine-tune-llm/` — LLM fine-tuning E2E

### Code Quality
- `.golangci.yaml` — Go linter configuration (v2, 4 linters)
- `.pre-commit-config.yaml` — Pre-commit hooks (yaml, json, whitespace, isort, black, flake8)
- `.flake8` — Python linting config
- `semgrep.yaml` — Security scanning rules (unified v3.0.0)
- `.gitleaks.toml` — Secret detection config

### Container Images
- `build/images/training-operator/Dockerfile` — Standard multi-stage (distroless)
- `build/images/training-operator/Dockerfile.rhoai` — UBI9 FIPS-compliant
- `build/images/training-operator/Dockerfile.multiarch` — Multi-arch runtime
- `manifests/base/deployment.yaml` — Deployment with health probes

### Agent Rules
- `AGENTS.md` — Comprehensive agent documentation
- `CLAUDE.md` — Identical to AGENTS.md
- `Makefile` — Build, test, lint, deploy targets
