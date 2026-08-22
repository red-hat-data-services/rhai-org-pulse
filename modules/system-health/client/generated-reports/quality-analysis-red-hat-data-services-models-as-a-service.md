---
repository: "red-hat-data-services/models-as-a-service"
overall_score: 7.3
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "56 Go test files across 2 modules; 60% test-to-code ratio with testify/gomega, race detection, and strong parallelism (299 t.Run/t.Parallel calls)"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "26 pytest E2E tests covering smoke, multi-tenant isolation, auth, rate limiting, network policy, API keys, and CRD resilience against real OpenShift clusters"
  - dimension: "Build Integration"
    score: 7.0
    status: "Kustomize manifest validation, CRD/RBAC codegen verification, operator-chaos breaking change detection, Tekton/Konflux multi-arch PR builds, OpenAPI spec validation"
  - dimension: "Image Testing"
    score: 6.0
    status: "Multi-stage UBI9 Dockerfiles with FIPS build config, multi-arch (x86_64/arm64/ppc64le/s390x), but no container runtime validation or HEALTHCHECK directives"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "Coverage generated via --coverprofile and uploaded as CI artifacts, but no codecov integration, no thresholds, no PR reporting"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "14 workflows with comprehensive PR validation (lint, test, build, OpenAPI, operator-chaos, disconnected-readiness, PR title), concurrency control, Go caching, OpenSSF Scorecard"
  - dimension: "Static Analysis"
    score: 8.0
    status: "golangci-lint v2 with default:all for both modules, Spectral OpenAPI linting, oasdiff breaking change detection, Renovate, govulncheck, strong FIPS build config"
  - dimension: "Agent Rules"
    score: 6.0
    status: "Comprehensive AGENTS.md with repo structure, CRDs, build/test commands, codegen rules, and testing conventions; no .claude/rules/ for test automation guidance"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Coverage regressions go undetected; no visibility into coverage trends across PRs"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container runtime validation"
    impact: "Image startup failures and runtime issues not caught until deployment to staging/production"
    severity: "MEDIUM"
    effort: "6-8 hours"
  - title: "No pre-commit hooks"
    impact: "Developers may push code that fails CI linting checks, creating unnecessary CI round-trips"
    severity: "LOW"
    effort: "2-3 hours"
quick_wins:
  - title: "Add Codecov integration with coverage thresholds"
    effort: "3-4 hours"
    impact: "Automated PR coverage reporting with regression prevention via threshold enforcement"
  - title: "Add pre-commit hooks for golangci-lint and gofmt"
    effort: "1-2 hours"
    impact: "Catch lint issues locally before pushing, reducing CI feedback loop"
  - title: "Create .claude/rules/ with test creation patterns"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality with framework-specific patterns for testify/gomega and pytest"
recommendations:
  priority_0:
    - "Add Codecov integration with .codecov.yml config and coverage threshold enforcement (e.g., 70% patch coverage minimum)"
    - "Add container image startup validation in CI — verify built images can start and respond to health checks"
  priority_1:
    - "Create .claude/rules/ with Go unit test patterns (testify/gomega conventions) and pytest E2E patterns"
    - "Add Dockerfile HEALTHCHECK directives for runtime container health monitoring"
    - "Add pre-commit hooks (.pre-commit-config.yaml) for golangci-lint, gofmt, and yaml validation"
  priority_2:
    - "Consider adding integration tests for the maas-api/maas-controller interaction boundary"
    - "Add load/performance testing for API endpoints to establish baseline metrics"
    - "Enable govulncheck as blocking (currently non-blocking with || true)"
---

# Quality Analysis: models-as-a-service

## Executive Summary

- **Overall Score: 7.3/10**
- **Repository**: [red-hat-data-services/models-as-a-service](https://github.com/red-hat-data-services/models-as-a-service)
- **Type**: Kubernetes controller + HTTP API service (Go monorepo)
- **Tier**: Downstream (Jira: RHOAIENG / Model as a Service)
- **Primary Language**: Go (with Python E2E tests)
- **Framework**: controller-runtime (kubebuilder), Gateway API

**Key Strengths:**
- Exceptionally comprehensive CI/CD pipeline with 14 workflows covering lint, test, build validation, OpenAPI spec validation, operator-chaos breaking change detection, and OpenSSF Scorecard
- Strong unit test coverage with 56 test files (60% test-to-code ratio) using race detection and good test parallelism
- Excellent E2E test suite with 26 pytest tests covering multi-tenant isolation, authentication, rate limiting, and security
- Best-in-class FIPS compliance configuration (GOEXPERIMENT=strictfipsruntime, CGO_ENABLED=1, UBI9 base images)
- Sophisticated operator-chaos integration for CRD schema and knowledge model breaking change detection

**Critical Gaps:**
- No coverage tracking or enforcement — coverage reports are generated but not integrated into PR review
- No container runtime validation — images are built but not tested for startup/health
- No pre-commit hooks for local lint enforcement

**Agent Rules Status**: AGENTS.md present and comprehensive; no .claude/rules/ directory for test-specific guidance

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.0/10 | 15% | 1.20 | 56 Go test files, 60% ratio, testify+gomega, race detection |
| Integration/E2E | 8.0/10 | 20% | 1.60 | 26 pytest E2E tests, multi-tenant, real cluster |
| Build Integration | 7.0/10 | 15% | 1.05 | Kustomize validation, codegen verify, Tekton/Konflux multi-arch |
| Image Testing | 6.0/10 | 10% | 0.60 | Multi-stage UBI9, FIPS-ready, no runtime validation |
| Coverage Tracking | 4.0/10 | 10% | 0.40 | Generated but not tracked or enforced |
| CI/CD Automation | 9.0/10 | 15% | 1.35 | 14 workflows, comprehensive PR gates |
| Static Analysis | 8.0/10 | 10% | 0.80 | golangci-lint v2 all, Spectral, oasdiff, Renovate |
| Agent Rules | 6.0/10 | 5% | 0.30 | Good AGENTS.md, no .claude/rules/ |
| **Overall** | **7.3/10** | | **7.30** | |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Severity**: HIGH
- **Impact**: Coverage regressions go undetected; no visibility into coverage trends across PRs; developers have no feedback on whether their PR improves or degrades coverage
- **Effort**: 4-6 hours
- **Details**: Both `maas-api/Makefile` and `maas-controller/Makefile` generate `coverage.out` and `coverage.html` via `--coverprofile`, and CI uploads these as artifacts. However, there is no `.codecov.yml`, no Codecov/Coveralls action, no coverage thresholds, and no PR comments showing coverage delta. Coverage artifacts are effectively write-only.

### 2. No Container Runtime Validation
- **Severity**: MEDIUM
- **Impact**: Image startup failures, missing runtime dependencies, or misconfigured entrypoints are not caught until deployment to staging/production environments
- **Effort**: 6-8 hours
- **Details**: Dockerfiles are well-constructed (multi-stage, UBI9, non-root user, FIPS build flags), but there are no tests that build an image, start a container, and verify it responds to health checks. The Tekton pipeline builds multi-arch images but does not validate runtime behavior.

### 3. No Pre-commit Hooks
- **Severity**: LOW
- **Impact**: Developers may push code that fails CI lint checks (golangci-lint, gofmt), creating unnecessary CI round-trips and slower feedback
- **Effort**: 2-3 hours
- **Details**: No `.pre-commit-config.yaml` found. Given the comprehensive golangci-lint configuration (v2 with `default: all`), catching issues locally would save significant developer time.

## Quick Wins

### 1. Add Codecov Integration (3-4 hours)
- **Impact**: Automated PR coverage reporting with regression prevention
- **Implementation**: Add `.codecov.yml` and `codecov/codecov-action` to CI workflows

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
        target: 70%
```

```yaml
# Add to maas-api-ci.yml and maas-controller-ci.yml after test step:
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: ${{ env.PROJECT_DIR }}/coverage.out
    flags: ${{ env.PROJECT_DIR }}
    fail_ci_if_error: false
```

### 2. Add Pre-commit Hooks (1-2 hours)
- **Impact**: Catch lint issues locally before pushing

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-merge-conflict
  - repo: https://github.com/golangci/golangci-lint
    rev: v2.6.2
    hooks:
      - id: golangci-lint
        entry: golangci-lint run --fix
        args: [--config, maas-api/.golangci.yml]
        files: ^maas-api/
```

### 3. Create .claude/rules/ with Test Patterns (2-3 hours)
- **Impact**: Improve AI-generated test quality with framework-specific patterns
- **Implementation**: Generate rules using `/test-rules-generator` for both Go test frameworks (testify/gomega) and pytest E2E patterns

## Detailed Findings

### Unit Tests

**Score: 8.0/10**

The repository has strong unit test coverage across both Go modules:

**maas-api (25 test files):**
- Handler tests: `api_keys/handler_test.go`, `handlers/models_test.go`, `subscription/handler_test.go`, `tenant/handler_test.go`, `token/handler_test.go`
- Config tests: `config/config_test.go`, `config/tls_test.go`, `config/cluster_config_test.go`
- Middleware tests: `middleware/request_id_test.go`, `middleware/tenant_logger_test.go`, `tracing/middleware_test.go`
- Metrics tests: `metrics/server_test.go`, `metrics/recorder_test.go`, `metrics/prometheus_test.go`, `metrics/middleware_tenant_test.go`
- Auth tests: `auth/sar_admin_checker_test.go`, `auth/cached_admin_checker_test.go`, `authpolicy/checker_test.go`
- Service tests: `api_keys/service_test.go`, `api_keys/store_test.go`, `api_keys/keygen_test.go`
- Other: `models/discovery_test.go`, `subscription/selector_test.go`, `logger/redaction_test.go`, `cmd/cors_test.go`

**maas-controller (31 test files):**
- Controller tests: `aitenant_controller_test.go`, `maassubscription_controller_test.go`, `maasauthpolicy_controller_test.go`, `maasmodelref_controller_test.go`, `self_deployment_controller_test.go`
- Webhook tests: `aitenant_webhook_test.go`, `aitenant_webhook_gateway_test.go`, `maasauthpolicy_webhook_test.go`, `maassubscription_webhook_test.go`, `tenant_namespace_validator_test.go`
- Provider tests: `providers_test.go`, `providers_llmisvc_test.go`, `providers_external_test.go`
- Reconciler tests: `tenant_reconcile_test.go`, `externalmodel/reconciler_test.go`, `externalmodel/resources_test.go`
- Platform tests: `platform_context_test.go`, `pipeline_test.go`, `patch_test.go`, `params_test.go`, `naming_test.go`
- Other: `multitenancy_test.go`, `cross_namespace_test.go`, `conflict_detection_test.go`, `helpers_test.go`, `rbac_manifest_test.go`

**Test-to-code ratio**: 56 test files / 93 source files = 60.2%

**Frameworks**:
- maas-api: `testing` + `testify` (assert/require)
- maas-controller: `testing` + `testify` (assert/require) + `gomega`
- Both use `runtime.NewScheme()` with fake clients for Kubernetes object testing

**Test quality signals**:
- Race detection enabled (`-race` flag in both Makefiles)
- 299 instances of `t.Run`/`t.Parallel` indicating good subtesting and parallelism
- Coverage profile generation on every test run

**What's missing for a perfect score**:
- No test table conventions documented
- Some test files could benefit from more edge case coverage (e.g., error paths)

### Integration/E2E Tests

**Score: 8.0/10**

Comprehensive E2E test suite with 26 test files using pytest:

**Test categories**:
- **Smoke**: `test_smoke.py` — health checks, model catalog, chat completions, legacy completions
- **Multi-tenant**: `test_multi_tenant_maas_api.py`, `test_multi_tenant_integration.py`, `test_tenant.py`, `test_tenant_discovery.py`, `test_tenant_namespace_discovery.py`
- **Isolation**: `test_tenant_auth_isolation.py`, `test_tenant_discovery_isolation.py`, `test_tenant_subscription_isolation.py`, `test_tenant_rate_limit_isolation.py`
- **Auth/Security**: `test_x_api_key_auth.py`, `test_negative_security.py`, `test_external_oidc.py`, `test_gateway_scoped_authpolicy.py`
- **API functionality**: `test_subscription.py`, `test_subscription_list_endpoints.py`, `test_models_endpoint.py`, `test_api_keys.py`
- **Infrastructure**: `test_networkpolicy.py`, `test_namespace_scoping.py`, `test_crd_watch_resilience.py`, `test_aitenant_lifecycle.py`
- **External**: `test_external_models.py`, `test_config_tenant.py`

**Test infrastructure**:
- `conftest.py`: Well-structured session-scoped fixtures for gateway host, auth tokens, API keys, model catalog, shared tenants
- `multitenancy_helpers.py`: Shared helper module for multi-tenant test setup/teardown
- `test_helper.py`: Shared utility functions (chat, completions helpers)
- Kustomize fixtures in `test/e2e/fixtures/` with multiple overlay configurations (distinct, distinct-2, trlp-test, unconfigured)
- Prow integration via `scripts/prow_run_smoke_test.sh`
- Local development scripts: `run-tests-quick.sh`, `local-test.sh`, `local-deploy.sh`

**Test environment**:
- Tests run against real OpenShift clusters (not mocked)
- TLS verification configurable via `E2E_SKIP_TLS_VERIFY`
- DNS resolution pre-check with graceful skip on infrastructure failure
- Port-forward support with Host header injection

**What's missing for a perfect score**:
- E2E tests are not automated in GitHub Actions (run via Prow/external CI)
- No pytest-cov integration for E2E coverage
- No multi-version/matrix testing for different K8s/OCP versions

### Build Integration

**Score: 7.0/10**

Strong build validation pipeline with multiple layers:

**PR-triggered validation (`build-test.yml`)**:
- Kustomize manifest validation via `scripts/ci/validate-manifests.sh`
- Generated code verification (CRDs, RBAC, deepcopy) with `make verify-codegen`
- Concurrency control (`cancel-in-progress: true`)
- 10-minute timeout

**Operator-chaos validation (`operator-chaos.yml`)**:
- Knowledge model validation and local preflight checks
- Breaking change detection between base branch and PR (knowledge model diff)
- CRD schema diff with breaking change detection
- Upgrade simulation (dry-run)

**Tekton/Konflux pipeline (`.tekton/odh-maas-api-pull-request.yaml`)**:
- Multi-architecture builds: linux/x86_64, linux-arm64, linux/ppc64le, linux/s390x
- Hermetic builds with prefetch (gomod)
- Triggered via labels (`kfbuild-all`, `kfbuild-maas-billing`) or comment (`/build-konflux`)
- Image expiry: 5 days for PR images

**OpenAPI validation (`openapi-validation.yml`)**:
- Spectral linting with custom rules
- Breaking change detection via oasdiff
- Changelog entry verification
- Validation report uploaded as artifact

**What's missing for a higher score**:
- No Docker image build in GitHub Actions PR workflow (relies on Tekton/Konflux)
- No Kind/Minikube deployment testing in CI

### Image Testing

**Score: 6.0/10**

Well-constructed container images with production-ready patterns:

**Dockerfile quality**:
- Multi-stage builds (builder + runtime) for both components
- UBI9 base images (FIPS-capable): `registry.access.redhat.com/ubi9/go-toolset` (builder), `registry.access.redhat.com/ubi9/ubi-minimal` (runtime)
- Non-root user (1001) with OpenShift random UID support
- Proper file permissions (`chgrp -R 0`, `chmod -R g=u`)
- Build args for platform targeting (`BUILDPLATFORM`, `TARGETPLATFORM`, `TARGETOS`, `TARGETARCH`)
- Trimmed binaries (`-trimpath -ldflags="-s -w"`)

**FIPS configuration**:
- `CGO_ENABLED=1` enabled in all Dockerfiles
- `GOEXPERIMENT=strictfipsruntime` configured
- UBI9 base images provide FIPS-validated crypto libraries
- No non-FIPS crypto imports found in source code

**Multi-arch support**:
- Tekton pipeline builds for 4 architectures (x86_64, arm64, ppc64le, s390x)
- `--platform` flags in Dockerfiles

**Konflux-specific images**:
- `Dockerfile.konflux` variants with pinned image digests
- Proper Red Hat labeling (component, name, description, license)

**What's missing for a higher score**:
- No `HEALTHCHECK` directives in Dockerfiles
- No container runtime validation tests (testcontainers or equivalent)
- No image startup verification in CI
- No image vulnerability scanning configuration (handled at org level, but worth noting)

### Coverage Tracking

**Score: 4.0/10**

Coverage generation exists but is effectively unused for tracking:

**What exists**:
- Both Makefiles: `TEST_FLAGS ?= -race -coverprofile=coverage.out`
- Coverage HTML reports generated: `go tool cover -html=coverage.out -o coverage.html`
- CI uploads coverage artifacts (`coverage.out` + `coverage.html`) with 30-day retention

**What's missing**:
- No `.codecov.yml` or `codecov.yml`
- No `codecov/codecov-action` in CI workflows
- No coverage thresholds (project or patch)
- No PR coverage comments or reporting
- No coverage trend tracking
- No coverage gates blocking merge

This is the biggest gap relative to gold standard repositories like kserve which enforce coverage thresholds.

### CI/CD Automation

**Score: 9.0/10**

Exceptionally comprehensive CI/CD pipeline:

**Workflow inventory (14 total)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `maas-api-ci.yml` | PR (maas-api/**) | Lint, govulncheck, test |
| `maas-controller-ci.yml` | PR (maas-controller/**) | Lint, govulncheck, test |
| `build-test.yml` | PR + push(main) | Kustomize validate, codegen verify |
| `openapi-validation.yml` | PR (openapi3.yaml) | Spectral lint, breaking changes, changelog |
| `pr-title-validation.yml` | PR (all) | Conventional commit format |
| `operator-chaos.yml` | PR (api/controller/deployment) | Knowledge/CRD breaking changes |
| `disconnected-readiness.yml` | PR (all) | Disconnected environment readiness |
| `scorecard.yml` | push(main) + weekly | OpenSSF Scorecard |
| `create-release.yml` | workflow_dispatch | Release creation |
| `promote-main-to-stable.yml` | workflow_dispatch | Branch promotion |
| `promote-stable-to-rhoai.yml` | workflow_dispatch | RHOAI promotion |
| `update-docs-latest.yml` | push(main) | Documentation deployment |
| `update-payload-processing.yml` | workflow_dispatch | Payload processing update |
| `docs.yml` | push(main)/PR | Documentation build |

**CI quality signals**:
- Go module caching via `actions/setup-go` with `cache: true`
- Concurrency control with `cancel-in-progress` on build-test workflow
- Timeout enforcement (10 minutes for build-test)
- Artifact uploads with 30-day retention
- Pinned action versions with SHA hashes (supply chain security)
- `govulncheck` running on both modules (currently non-blocking)
- Path-based triggering to avoid unnecessary CI runs

**What's missing for a perfect score**:
- govulncheck is non-blocking (`|| true`) — should be blocking when go-toolset ships >= 1.25.12
- No test parallelization at the CI level (matrix strategy)

### Static Analysis

**Score: 8.0/10**

#### Linting

**golangci-lint v2** configured for both modules with `default: all` — the most comprehensive approach:

- **maas-api**: 21 linters explicitly disabled, rest enabled. Includes `errcheck` with type assertions, `exhaustive` switch checks, `gocritic`, `revive`, import ordering via `gci`, `nolintlint` requiring specificity.
- **maas-controller**: 29 linters explicitly disabled, rest enabled. Similar configuration with slightly higher complexity threshold (`gocyclo: 40` vs `30`) and longer line length limit (`lll: 220` vs `180`).

Both use formatters (`gci`, `gofmt`, `goimports`) with custom import section ordering.

**OpenAPI linting**: Spectral with custom rules requiring operation IDs, descriptions, success responses, and MaaS-specific subscription header documentation hints.

**API compatibility**: oasdiff integrated into CI for detecting breaking API changes between PR and base branch, with ignore files for acknowledged changes.

#### FIPS Compatibility

**Excellent** — No violations found:
- No `crypto/md5`, `crypto/des`, `crypto/rc4`, or `math/rand` imports in source code
- Build configuration: `CGO_ENABLED=1`, `GOEXPERIMENT=strictfipsruntime` in Makefiles and Dockerfiles
- UBI9 base images provide FIPS-validated OpenSSL
- Conditional FIPS toggle via `GO_STRICTFIPS` Makefile variable

#### Dependency Alerts

- **Renovate**: Configured (`.github/renovate.json`) extending `red-hat-data-services/konflux-central` defaults
- **Dependabot**: Not configured (Renovate is used instead — this is fine)
- **govulncheck**: Running in CI for both modules (non-blocking)

### Agent Rules

**Score: 6.0/10**

**CLAUDE.md**: Present, references AGENTS.md via `@AGENTS.md`

**AGENTS.md**: Comprehensive and well-structured, covering:
- Repository structure (2-module layout, key directories)
- CRD types and API group
- Build and test commands for both modules and Kustomize
- Codegen rules (regenerate on API changes)
- Kustomize/deployment conventions
- PR title format (conventional commits)
- PR review process (CodeRabbit integration)
- PR risk analysis rating system (0-5 scale with specific criteria)
- Testing conventions (Go frameworks, pytest E2E, new features require tests)
- Documentation policy (search before writing, no duplication)
- "Things to never do" section

**What's missing**:
- No `.claude/` directory
- No `.claude/rules/` with test-specific patterns (e.g., how to write a Go unit test with testify, how to write a pytest E2E test)
- No test creation guidance beyond "match the style of the package you're editing"
- No quality gate checklists

## Recommendations

### Priority 0 (Critical)

1. **Add Codecov integration with coverage threshold enforcement**
   - Create `.codecov.yml` with project target (auto) and patch target (70%)
   - Add `codecov/codecov-action` to both `maas-api-ci.yml` and `maas-controller-ci.yml`
   - Upload `coverage.out` files with component-specific flags
   - Effort: 3-4 hours

2. **Add container image startup validation in CI**
   - After building images via `make build-image`, run basic startup verification
   - Check that the binary starts, listens on expected port, and responds to health endpoint
   - Can be added to existing Makefile or as a new CI job
   - Effort: 6-8 hours

### Priority 1 (High Value)

3. **Create .claude/rules/ with test creation patterns**
   - Go unit test rules: testify assert/require patterns, fake client setup, table-driven test conventions
   - Go webhook test rules: scheme setup, admission review patterns
   - Pytest E2E test rules: fixture usage, conftest patterns, TLS handling
   - Use `/test-rules-generator` to bootstrap from existing test patterns
   - Effort: 2-3 hours

4. **Add Dockerfile HEALTHCHECK directives**
   - maas-api: `HEALTHCHECK --interval=30s --timeout=3s CMD ["/app/maas-api", "--health-check"] || exit 1`
   - maas-controller: Use K8s readiness/liveness probes (already in deployment manifests)
   - Effort: 1-2 hours

5. **Add pre-commit hooks**
   - Configure `.pre-commit-config.yaml` with golangci-lint, trailing whitespace, YAML validation
   - Document in AGENTS.md for contributor onboarding
   - Effort: 1-2 hours

### Priority 2 (Nice-to-Have)

6. **Enable govulncheck as blocking in CI**
   - Remove `|| true` from govulncheck step when go-toolset >= 1.25.12 ships
   - Currently runs but ignores failures — making it blocking would catch known vulnerability usage
   - Effort: 30 minutes (once go-toolset version ships)

7. **Add integration tests for maas-api/maas-controller interaction boundary**
   - The two modules interact via Kubernetes API objects; test the contract between them
   - Could use envtest or Kind-based integration tests
   - Effort: 2-3 days

8. **Add load/performance testing for API endpoints**
   - Establish baseline latency and throughput metrics for key endpoints
   - Track regressions across releases
   - Effort: 2-3 days

## Comparison to Gold Standards

| Practice | models-as-a-service | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|----------|-------------------|---------------------|-------------------|---------------|
| Unit test ratio | 60% (56/93) | ~50% | ~40% | ~55% |
| E2E tests | 26 pytest tests | Cypress + Playwright | Shell + Python | Go E2E suite |
| Coverage enforcement | None | Codecov thresholds | Codecov | Codecov gates |
| CI workflows | 14 workflows | 15+ workflows | 10+ workflows | 12+ workflows |
| Linting | golangci-lint v2 all | ESLint strict | golangci-lint | golangci-lint |
| FIPS compliance | Excellent | N/A (frontend) | UBI + tags | Partial |
| Agent rules | AGENTS.md | .claude/rules/ | None | None |
| Container testing | Build only | Build + test | 5-layer validation | Build + E2E |
| OpenAPI validation | Spectral + oasdiff | N/A | N/A | N/A |
| Operator chaos | Yes | No | No | No |

**Notable advantages over gold standards**:
- Operator-chaos integration for CRD/knowledge breaking change detection is unique
- OpenAPI spec validation with breaking change detection is best-in-class
- PR risk analysis rating system in AGENTS.md is exemplary
- FIPS compliance configuration is among the strongest in the org

## File Paths Reference

### CI/CD
- `.github/workflows/maas-api-ci.yml` — API lint/test/coverage
- `.github/workflows/maas-controller-ci.yml` — Controller lint/test/coverage
- `.github/workflows/build-test.yml` — Kustomize validation, codegen verify
- `.github/workflows/openapi-validation.yml` — Spectral, oasdiff, changelog
- `.github/workflows/operator-chaos.yml` — Breaking change detection
- `.github/workflows/pr-title-validation.yml` — Conventional commit format
- `.github/workflows/disconnected-readiness.yml` — Disconnected readiness check
- `.github/workflows/scorecard.yml` — OpenSSF Scorecard
- `.tekton/odh-maas-api-pull-request.yaml` — Konflux multi-arch build

### Testing
- `maas-api/internal/*/` — Go unit tests (25 files)
- `maas-controller/pkg/*/` — Go unit tests (31 files)
- `test/e2e/tests/` — Pytest E2E tests (26 files)
- `test/e2e/conftest.py` — Pytest session fixtures
- `test/e2e/requirements.txt` — E2E dependencies

### Build
- `maas-api/Makefile` — API build/test/lint
- `maas-controller/Makefile` — Controller build/test/lint/manifests
- `maas-api/Dockerfile` / `maas-api/Dockerfile.konflux` — API container image
- `maas-controller/Dockerfile` / `maas-controller/Dockerfile.konflux` — Controller container image
- `maas-api/container.mk` / `maas-controller/container.mk` — Container build targets

### Static Analysis
- `maas-api/.golangci.yml` — API linter config (default: all)
- `maas-controller/.golangci.yml` — Controller linter config (default: all)
- `.spectral.yml` — OpenAPI linting rules
- `.github/renovate.json` — Renovate dependency management

### Agent Rules
- `CLAUDE.md` — References AGENTS.md
- `AGENTS.md` — Comprehensive repo guide, CRDs, build/test, conventions

### Deployment
- `deployment/base/` — Kustomize base manifests
- `deployment/components/` — Kustomize components
- `scripts/ci/validate-manifests.sh` — Kustomize validation
- `chaos/knowledge/maas.yaml` — Operator-chaos knowledge model
