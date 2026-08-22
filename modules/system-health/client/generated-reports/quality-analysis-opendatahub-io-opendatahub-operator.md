---
repository: "opendatahub-io/opendatahub-operator"
overall_score: 7.8
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Strong unit test coverage with 260 test files, Ginkgo/Gomega framework, envtest integration, and parallel execution"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Comprehensive E2E suite with 49 test files, KinD cluster testing, multi-provider matrix (azure/coreweave/aws), and gateway integration tests"
  - dimension: "Build Integration"
    score: 7.5
    status: "PR-triggered image builds, operator/bundle/catalog builds, KinD-based deployment testing, and kustomize manifest validation"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage Dockerfiles with UBI base images, multi-arch support, FIPS-compliant builds, but no runtime container validation tests"
  - dimension: "Coverage Tracking"
    score: 6.5
    status: "Codecov integration with upload on unit tests, coverprofile generation, but informational-only thresholds (no enforcement)"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "29 workflows, extensive PR triggers, automated sync branches, release automation, kube-linter SARIF integration"
  - dimension: "Static Analysis"
    score: 8.5
    status: "golangci-lint v2 with most linters enabled, kube-linter with comprehensive security checks, Dependabot for 3 ecosystems, FIPS build tags"
  - dimension: "Agent Rules"
    score: 9.0
    status: "Comprehensive CLAUDE.md/AGENTS.md, 6 context-aware rules in .rules/, diagnostic skill, testing patterns documented"
critical_gaps:
  - title: "Coverage thresholds are informational-only"
    impact: "Coverage can regress silently on any PR since codecov is set to informational mode — no PR will be blocked by coverage drops"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container runtime validation tests"
    impact: "Image startup failures or missing binaries not caught until deployment — the Dockerfile is tested only by successful build, not by running the resulting container"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "No multi-version Kubernetes testing"
    impact: "Operator may break on older or newer K8s versions since E2E tests only run against one KinD cluster version"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "Limited concurrency control in CI"
    impact: "Only 1 of 29 workflows uses concurrency groups — parallel runs on rapid PR updates waste resources and can produce race conditions on shared image tags"
    severity: "LOW"
    effort: "2-4 hours"
quick_wins:
  - title: "Enforce coverage thresholds in codecov.yml"
    effort: "1-2 hours"
    impact: "Prevent silent coverage regression by switching project/patch status from informational to enforced with minimum thresholds"
  - title: "Add concurrency groups to PR-triggered workflows"
    effort: "1-2 hours"
    impact: "Cancel superseded runs on rapid PR updates, saving CI resources and preventing image tag conflicts"
  - title: "Add container startup smoke test to E2E"
    effort: "2-4 hours"
    impact: "Verify the built operator image starts and responds to health checks before running full E2E suite"
recommendations:
  priority_0:
    - "Enforce coverage thresholds: change codecov.yml informational:true to target:auto with a floor (e.g. 50%) to prevent regression"
    - "Add container runtime validation: after building the operator image in CI, run it with a basic health check before loading into KinD"
  priority_1:
    - "Add multi-version K8s testing: use a matrix strategy to test against 2-3 KinD K8s versions (e.g. 1.28, 1.29, 1.30)"
    - "Add concurrency groups to all PR-triggered workflows to cancel superseded runs"
    - "Add pre-commit hooks (.pre-commit-config.yaml) for local linting and formatting before push"
  priority_2:
    - "Add integration test coverage reporting to codecov (gateway integration tests already generate coverprofile but don't upload)"
    - "Add Renovate alongside Dependabot for more sophisticated dependency management (auto-merge patches, grouping)"
    - "Add Prometheus alerting rule unit tests to PR triggers (currently only runs on template file changes)"
---

# Quality Analysis: opendatahub-operator

## Executive Summary

- **Overall Score: 7.8/10**
- **Repository Type**: Kubernetes Operator (Go)
- **Primary Language**: Go 1.26
- **Frameworks**: Ginkgo/Gomega (testing), controller-runtime (operator), envtest (integration)
- **Jira**: RHOAIENG / AI Core Platform (midstream tier)

The opendatahub-operator demonstrates **strong quality practices** across most dimensions. It stands out with an exceptionally well-structured agent rules setup (AGENTS.md, .rules/, diagnostic skill) and comprehensive CI/CD automation (29 workflows covering linting, unit tests, E2E, image builds, release automation, and manifest validation). The main gaps are around coverage enforcement (informational-only thresholds) and the absence of container runtime validation tests.

### Key Strengths
- **260 test files** with a 0.61 test-to-source ratio (260 test / 426 source files)
- **Comprehensive E2E suite** testing 16+ operator components with KinD clusters and multi-cloud provider matrix
- **FIPS-compliant builds** using `-tags strictfipsruntime`, CGO_ENABLED=1, and UBI9 base images
- **Best-in-class agent rules** with context-aware `.rules/` files scoped by path patterns
- **Extensive CI/CD** with 29 workflows, automated branch syncing, and kube-linter SARIF integration

### Critical Gaps
1. Coverage thresholds are informational-only (no PR blocking)
2. No container runtime validation (image startup not tested)
3. No multi-version K8s testing matrix

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.0/10 | 15% | 1.20 | Strong test coverage with Ginkgo, envtest, parallel execution |
| Integration/E2E | 8.5/10 | 20% | 1.70 | Comprehensive E2E with KinD, multi-provider, gateway integration |
| Build Integration | 7.5/10 | 15% | 1.13 | PR image builds, bundle/catalog, KinD deployment, kustomize validation |
| Image Testing | 7.0/10 | 10% | 0.70 | Multi-stage UBI builds, multi-arch, FIPS tags, no runtime validation |
| Coverage Tracking | 6.5/10 | 10% | 0.65 | Codecov with upload, coverprofile in Makefile, but informational-only |
| CI/CD Automation | 8.5/10 | 15% | 1.28 | 29 workflows, PR/push/schedule triggers, release automation |
| Static Analysis | 8.5/10 | 10% | 0.85 | golangci-lint v2 all-linters, kube-linter, Dependabot (3 ecosystems) |
| Agent Rules | 9.0/10 | 5% | 0.45 | AGENTS.md, 6 path-scoped rules, diagnostic skill, testing patterns |
| **Overall** | **7.8/10** | **100%** | **7.96** | |

## Critical Gaps

### 1. Coverage Thresholds Are Informational-Only
- **Impact**: Coverage can regress silently — codecov.yml sets `informational: true` for both project and patch status, meaning no PR will ever be blocked by coverage drops
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **File**: `codecov.yml`
- **Fix**: Change to enforced thresholds:
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

### 2. No Container Runtime Validation
- **Impact**: Image startup failures, missing binaries, or broken entrypoints not caught until deployment
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Fix**: Add a CI step after image build that runs `docker run --rm $IMG /manager --help` or a startup health check

### 3. No Multi-Version Kubernetes Testing
- **Impact**: Operator may break on older/newer K8s versions; currently tests against one KinD version only
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Fix**: Add matrix strategy to KinD E2E workflow with multiple K8s versions

### 4. Limited Concurrency Control
- **Impact**: Only `ci-build-push-catalog-latest.yaml` uses concurrency groups; 28 other workflows can run duplicate instances
- **Severity**: LOW
- **Effort**: 2-4 hours

## Quick Wins

### 1. Enforce Coverage Thresholds (1-2 hours)
Update `codecov.yml` to enforce minimum coverage targets. The infrastructure is already in place (codecov-action uploads results); just change `informational: true` to actual targets.

### 2. Add Concurrency Groups (1-2 hours)
Add `concurrency:` blocks to PR-triggered workflows:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.sha }}
  cancel-in-progress: true
```

### 3. Container Startup Smoke Test (2-4 hours)
Add to the image build step in `ci-build-push-images-on-pr.yaml`:
```yaml
- name: Verify operator starts
  run: |
    podman run --rm --entrypoint /manager $IMG --help
```

## Detailed Findings

### Unit Tests (8.0/10)

**Test Infrastructure**:
- **260 total test files** across `internal/` (92), `pkg/` (87), `tests/e2e/` (49), `cmd/` (24), and other locations
- **Test-to-code ratio**: 0.61 (260 test files / 426 source files) — strong coverage
- **Framework**: Ginkgo v2 + Gomega (BDD-style) with stretchr/testify for assertions
- **envtest usage**: 10+ test suites use envtest for real API server testing (controllers, webhooks, resources)

**Test Execution**:
- Ginkgo runner with `--procs=8` for parallel execution
- `--randomize-all --randomize-suites` for test isolation verification
- `--fail-fast` for quick feedback
- Coverage profile generated with `--coverprofile=cover.out`

**Test Isolation**:
- 49 files use `t.Parallel()` for concurrent test execution
- Separate test utilities in `tests/envtestutil/` and `pkg/utils/test/`
- `fakeclient.New()` for lightweight unit tests, `envt.New()` for integration tests

**Prometheus Unit Tests**:
- Dedicated workflow (`test-prometheus-unit.yaml`) validates alerting rules
- Triggered by changes to prometheusrules templates

**Strengths**: High test count, parallel execution, envtest integration, good test utilities
**Gaps**: No mutation testing, no test timing reports

### Integration/E2E Tests (8.5/10)

**E2E Suite**:
- **49 E2E test files** in `tests/e2e/` covering 16+ components (dashboard, kserve, ray, trustyai, model registry, etc.)
- Component-specific tests: `kserve_test.go`, `dashboard_test.go`, `modelregistry_test.go`, etc.
- Infrastructure tests: `creation_test.go`, `deletion_test.go`, `cleanup_test.go`, `resilience_test.go`
- Upgrade testing: `v2tov3upgrade_test.go`

**Cluster Testing**:
- KinD cluster-based E2E via `test-kind-odh-e2e.yaml` workflow
- Full operator deployment into KinD (build → load → deploy → test)
- Cloud Manager E2E tests with **matrix strategy** across 3 providers: azure, coreweave, aws
- Gateway integration tests using envtest (`test-gateway-integration.yaml`)

**Advanced Features**:
- Custom test retry mechanism (`cmd/test-retry`) for flaky test handling
- E2E test image built and pushed for external test runners (`ci-build-push-e2e-tests.yaml`)
- Test group management (`testgroup_test.go`, `test_tag_test.go`)
- Circuit breaker testing (`circuit_breaker_test.go`)
- DAG ordering validation (`dag_ordering_test.go`)

**Integration Tests**:
- Cloud Manager E2E: Deploys full stack (cloud manager → CR → ODH operator) in KinD, tests across 3 cloud providers
- Gateway integration: envtest-based with coverage reporting
- Integration test label-gated (`run-integration-tests` label required)

**Strengths**: Broad component coverage, multi-provider matrix, retry mechanism, upgrade testing
**Gaps**: Single K8s version, no multi-OCP version testing

### Build Integration (7.5/10)

**PR-Time Builds**:
- `ci-build-push-images-on-pr.yaml`: Builds operator image, bundle image, and catalog image on every PR
- Uses podman for image building
- Version tagging derived from latest release + PR number
- Images pushed to Quay.io for integration test consumption

**Manifest Validation**:
- `validate-related-images.yaml`: Validates RELATED_IMAGE references against build configs
- `test-required-files-updated.yaml`: Ensures generated files are included in PRs
- `test-e2e-requirement-check.yaml`: Checks if E2E test updates are needed when config/bundle changes

**Operator-Specific**:
- `make bundle-build`, `make catalog-build` targets for OLM artifacts
- Kustomize-based manifest generation (`make prepare`)
- Separate Dockerfiles for ODH and RHOAI variants
- KinD deployment testing validates operator starts and CRs are reconciled

**Strengths**: Full image build pipeline on PRs, manifest validation, RHOAI/ODH dual-mode
**Gaps**: No Konflux simulation in PR, no dry-run manifest apply

### Image Testing (7.0/10)

**Dockerfile Quality**:
- **3-stage multi-stage build**: manifests → builder → runtime
- **Base images**: All UBI9-based (FIPS-capable)
  - Build: `registry.access.redhat.com/ubi9/go-toolset`
  - Manifests: `registry.access.redhat.com/ubi9/toolbox`
  - Runtime: `registry.access.redhat.com/ubi9/ubi-minimal`
- **Multi-arch support**: `BUILDPLATFORM` and `TARGETPLATFORM` ARGs with `TARGETARCH`
- **Security**: Runs as non-root (USER 1001), stripped binaries (`-ldflags="-s -w"`)

**FIPS Compliance**:
- Build tags: `-tags strictfipsruntime` on all Go binary builds
- `CGO_ENABLED=1` (required for FIPS-certified crypto)
- No non-FIPS crypto imports found (`crypto/md5`, `crypto/des`, `crypto/rc4` all clean)
- UBI9 base images (FIPS-certified runtime)

**Variants**:
- `Dockerfiles/Dockerfile` — ODH community build
- `Dockerfiles/rhoai.Dockerfile` — RHOAI downstream build with `-tags strictfipsruntime,rhoai`
- `Dockerfiles/e2e-tests/e2e-tests.Dockerfile` — E2E test binary container

**Gaps**:
- No container startup validation test (healthcheck/readiness probe test)
- No Testcontainers usage
- No `.dockerignore` found
- No HEALTHCHECK instruction in Dockerfiles

### Coverage Tracking (6.5/10)

**Configuration**:
- `codecov.yml` present with project and patch status — but both set to `informational: true`
- This means coverage metrics are reported but **never block PRs**

**Coverage Generation**:
- Unit tests: `--coverprofile=cover.out` via Ginkgo in Makefile
- Gateway integration: `--coverprofile=coverage.out` in CI workflow
- Upload: `codecov/codecov-action@v5.5.1` in unit test workflow
- `pkg/clusterhealth` also runs with `-cover` flag

**What's Missing**:
- Coverage thresholds not enforced (informational only)
- Gateway integration coverage not uploaded to Codecov
- No per-package coverage minimum
- No coverage trend reporting or badge in README

### CI/CD Automation (8.5/10)

**Workflow Inventory** (29 workflows):

| Category | Workflows | Trigger |
|----------|-----------|---------|
| Testing | test-unit, test-unit-cli, test-prometheus-unit | PR + push |
| Integration | test-integration, test-gateway-integration | PR (label-gated) |
| E2E | test-kind-odh-e2e, test-cloudmanager-e2e | PR (path-filtered) |
| Linting | test-linter | PR + push |
| Validation | test-required-files-updated, test-e2e-requirement-check, validate-related-images | PR |
| Image Build | ci-build-push-images-on-pr, ci-build-push-e2e-tests-on-pr | PR |
| Main Build | ci-build-push-catalog-latest, ci-build-push-e2e-tests | push to main |
| Release | release-community, release-staging, release-process-fbc-fragment | workflow_dispatch |
| Sync | sync-main-to-stable, sync-stable-to-rhoai, bundle-sync | schedule + dispatch |
| Maintenance | update-manifest-shas, update-rhoai-branch | schedule + dispatch |
| PR Comments | pr-comment, pr-comment-test-trigger, pr-comment-on-e2e-check | workflow_run |
| Utility | get-merge-commit | workflow_call |

**PR Quality Gates**:
- Unit tests (automatic on PR)
- Linting with golangci-lint and kube-linter (automatic)
- RELATED_IMAGE validation (automatic)
- Generated file check (automatic)
- Integration tests (label-gated)
- E2E tests (path-filtered, trust-verified)

**Automation Features**:
- Automated branch sync: main → stable (every 2 hours), stable → rhoai (every 2 hours, offset)
- Daily manifest SHA updates
- PR comment bot for test results
- Trust verification for external contributors (label-based authorization)
- Prior-run dedup (skip E2E if same commit already passed)

**Strengths**: Comprehensive coverage, automated sync, smart deduplication
**Gaps**: Only 1/29 workflows uses concurrency groups, no caching in test workflows

### Static Analysis (8.5/10)

**golangci-lint** (`.golangci.yml`):
- **Version 2** configuration with `default: all` (starts with all linters enabled)
- Explicitly disables ~20 noisy linters (cyclop, funlen, wsl, etc.)
- Custom import aliases enforced (`importas` linter)
- Import ordering enforced (`gci` formatter with custom sections)
- Line length limit: 180 characters
- Cyclomatic complexity threshold: 30
- Test duplication excluded from `dupl` linter
- Dot-imports allowed only for Ginkgo/Gomega

**kube-linter** (`.kube-linter.yaml`):
- 30+ checks enabled across 7 categories:
  - Container Security (privileged, escalation, run-as-non-root, host namespace)
  - RBAC & Access Control (CIS Benchmark 5.1.x checks)
  - Secret Management (env var secrets)
  - Service Account Security
  - Network Security (privileged ports, SSH, exposed services)
  - Reliability (liveness/readiness probes, resource limits)
  - Image Security (latest tag prevention)
- Custom CEL check for system group bindings
- SARIF output integrated with GitHub Security tab

**Dependabot** (`.github/dependabot.yml`):
- **3 ecosystems covered**: gomod, github-actions, docker
- Weekly schedule for all ecosystems
- GitHub Actions grouped into single PR
- Labels applied for GitHub Actions updates

**FIPS Compatibility**:
- No non-FIPS crypto imports found in source code
- `-tags strictfipsruntime` in all Dockerfile build commands
- `CGO_ENABLED=1` default (required for FIPS)
- UBI9 base images (FIPS-certified)

**Missing**:
- No `.pre-commit-config.yaml` for local pre-commit hooks
- No Renovate configuration (Dependabot only)

### Agent Rules (9.0/10)

**Documentation**:
- `CLAUDE.md` delegates to `AGENTS.md` (standard pattern)
- `AGENTS.md` provides comprehensive operator context:
  - Build & test commands
  - Quality gates (mandatory)
  - Code conventions (error wrapping, commit format, platform builds)
  - Critical rules (GC ordering, management states)
  - File location patterns for all code areas
  - Documentation index

**Context-Aware Rules** (`.rules/` directory — 6 files):
- `testing.md` — Testing patterns (fakeclient vs envtest, table-driven tests, E2E oracle independence). Scoped to `**/*_test.go, tests/**/*.go`
- `component-controller.md` — Component controller patterns (reconciler builder, action signatures). Scoped to `internal/controller/components/**/*.go`
- `service-controller.md` — Service controller patterns (similar to components but with handler interface). Scoped to `internal/controller/services/**/*.go`
- `cloudmanager-controller.md` — Cloud manager patterns (dynamic ownership, per-provider controllers). Scoped to `**/cloudmanager/**/*.go`
- `api-types.md` — API type conventions
- `review-instructions.md` — Meta-guidance for AI code reviewers (anti-patterns, priority order)

**Skills**:
- `diagnose` skill — Cluster diagnostics using MCP server with structured 4-step methodology

**Strengths**: Path-scoped rules (context-aware), testing patterns documented, AI reviewer anti-patterns, diagnostic skill
**Gaps**: No rules for CI/CD workflow modifications, no rules for Dockerfile changes

## Recommendations

### Priority 0 (Critical)

1. **Enforce coverage thresholds**: Update `codecov.yml` to use `target: auto` with `threshold: 2%` for project and `target: 80%` for patch. This is the single highest-ROI improvement — 1-2 hours for permanent regression prevention.

2. **Add container runtime validation**: After building the operator image in CI, verify it starts successfully. Add a step to the PR build workflow that runs the image with `--help` or a health check endpoint.

### Priority 1 (High Value)

3. **Multi-version K8s testing**: Add a matrix strategy to KinD E2E workflows testing against 2-3 Kubernetes versions. This catches compatibility issues before they reach production.

4. **Add concurrency groups**: Add `concurrency:` blocks to all PR-triggered workflows. Template:
   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.sha }}
     cancel-in-progress: true
   ```

5. **Pre-commit hooks**: Add `.pre-commit-config.yaml` to enforce formatting and linting locally before push. Reduces CI feedback loop time.

### Priority 2 (Nice-to-Have)

6. **Upload gateway integration coverage**: The `test-gateway-integration.yaml` workflow already generates `coverage.out` but doesn't upload to Codecov.

7. **Add `.dockerignore`**: Prevent unnecessary files from entering build context (tests, docs, .git, etc.).

8. **Add Prometheus alerting rule tests to broader triggers**: Currently only triggered by template file changes, not by changes to the monitoring controller code.

## Comparison to Gold Standards

| Dimension | opendatahub-operator | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|-----------|---------------------|---------------------|-------------------|---------------|
| Unit Tests | 8.0 — 260 files, Ginkgo, envtest | 9.0 — Jest, extensive mocking | 6.0 — Python pytest | 8.0 — Go testing, envtest |
| Integration/E2E | 8.5 — KinD, multi-provider | 9.0 — Cypress, contract tests | 7.0 — JupyterHub integration | 9.0 — Multi-version K8s |
| Build Integration | 7.5 — PR builds, OLM artifacts | 8.0 — Module federation | 7.0 — Image pipeline | 7.5 — CRD validation |
| Image Testing | 7.0 — Multi-stage, UBI, FIPS | 6.0 — Basic nginx | 9.0 — 5-layer validation | 7.0 — Multi-stage |
| Coverage Tracking | 6.5 — Codecov (informational) | 8.0 — Enforced thresholds | 5.0 — No codecov | 8.5 — Enforced gates |
| CI/CD Automation | 8.5 — 29 workflows, sync | 8.5 — Comprehensive | 7.0 — Basic CI | 8.0 — Prow + GHA |
| Static Analysis | 8.5 — golangci-lint v2, kube-linter | 8.0 — ESLint, TypeScript strict | 6.0 — Basic linting | 7.5 — golangci-lint |
| Agent Rules | 9.0 — Path-scoped rules, diagnostic skill | 8.0 — CLAUDE.md, rules | 2.0 — None | 3.0 — Basic CLAUDE.md |
| **Overall** | **7.8** | **8.1** | **6.1** | **7.3** |

## File Paths Reference

### CI/CD Workflows
- `.github/workflows/test-unit.yaml` — Unit tests with codecov upload
- `.github/workflows/test-unit-cli.yaml` — CLI unit tests
- `.github/workflows/test-linter.yaml` — golangci-lint + kube-linter
- `.github/workflows/test-gateway-integration.yaml` — Gateway envtest integration
- `.github/workflows/test-kind-odh-e2e.yaml` — KinD E2E tests
- `.github/workflows/test-cloudmanager-e2e.yaml` — Cloud Manager multi-provider E2E
- `.github/workflows/test-integration.yaml` — Integration tests (label-gated)
- `.github/workflows/ci-build-push-images-on-pr.yaml` — PR image builds
- `.github/workflows/validate-related-images.yaml` — RELATED_IMAGE validation

### Testing
- `tests/e2e/` — 49 E2E test files
- `internal/` — 92 unit/integration test files
- `pkg/` — 87 unit test files
- `cmd/` — 24 test files
- `tests/envtestutil/` — envtest utilities
- `tests/prometheus_unit_tests/` — Prometheus rule tests

### Configuration
- `.golangci.yml` — golangci-lint v2 configuration
- `.kube-linter.yaml` — kube-linter security checks
- `codecov.yml` — Coverage configuration (informational mode)
- `.github/dependabot.yml` — Dependabot (gomod, github-actions, docker)
- `Makefile` — Build, test, lint, deploy targets

### Container Images
- `Dockerfiles/Dockerfile` — ODH operator image (multi-stage, UBI9, FIPS)
- `Dockerfiles/rhoai.Dockerfile` — RHOAI operator image
- `Dockerfiles/e2e-tests/e2e-tests.Dockerfile` — E2E test binary image

### Agent Rules
- `CLAUDE.md` — Delegates to AGENTS.md
- `AGENTS.md` — Comprehensive operator documentation
- `.rules/testing.md` — Testing patterns (fakeclient/envtest/E2E)
- `.rules/component-controller.md` — Component controller patterns
- `.rules/service-controller.md` — Service controller patterns
- `.rules/cloudmanager-controller.md` — Cloud manager patterns
- `.rules/api-types.md` — API type conventions
- `.rules/review-instructions.md` — AI reviewer meta-guidance
- `.claude/skills/diagnose/SKILL.md` — Cluster diagnostic skill
