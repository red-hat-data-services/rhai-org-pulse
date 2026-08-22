---
repository: "opendatahub-io/models-as-a-service"
overall_score: 7.5
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Excellent test-to-code ratio (57 test files / 94 source files); 30k test LOC vs 23k source LOC; uses testify + gomega with t.Parallel()"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Comprehensive pytest E2E suite with 26 test files covering multi-tenancy, auth, security, subscriptions; Prow-integrated smoke tests"
  - dimension: "Build Integration"
    score: 7.5
    status: "Kustomize manifest validation, CRD codegen verification, operator-chaos breaking change detection on PRs; no PR-time Docker image build"
  - dimension: "Image Testing"
    score: 6.0
    status: "Multi-stage UBI9 builds with FIPS support and multi-arch; Konflux Tekton pipelines for PR builds; no runtime image validation"
  - dimension: "Coverage Tracking"
    score: 5.0
    status: "Coverage reports generated (coverprofile) and uploaded as artifacts; no Codecov/Coveralls integration; no threshold enforcement"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "15 workflows with path-filtered PR triggers, concurrency control, Go caching, Tekton/Konflux pipelines, OpenSSF Scorecard"
  - dimension: "Static Analysis"
    score: 7.5
    status: "golangci-lint v2 with 'all' linters enabled, Spectral OpenAPI linting, govulncheck, gitleaks; no Dependabot/Renovate; no pre-commit hooks"
  - dimension: "Agent Rules"
    score: 7.0
    status: "Comprehensive AGENTS.md with build commands, testing conventions, codegen rules, PR guidelines; CLAUDE.md stub; no .claude/rules/ directory"
critical_gaps:
  - title: "No coverage threshold enforcement or PR coverage reporting"
    impact: "Coverage can silently regress without any gate; no visibility into coverage trends across PRs"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No Dependabot or Renovate for dependency alerts"
    impact: "Dependency vulnerabilities and updates must be tracked manually; govulncheck runs non-blocking (|| true)"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No container image runtime validation in CI"
    impact: "Image startup failures, missing binaries, or permission issues not caught until deployment"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "E2E tests require live OpenShift cluster — no lightweight CI E2E path"
    impact: "E2E tests cannot run in PR CI; defects in API/controller interaction found only in Prow or manual testing"
    severity: "MEDIUM"
    effort: "16-24 hours"
quick_wins:
  - title: "Enable Dependabot for Go modules and GitHub Actions"
    effort: "1-2 hours"
    impact: "Automated dependency update PRs and security alerts for both Go modules and Actions versions"
  - title: "Add Codecov integration with coverage thresholds"
    effort: "3-4 hours"
    impact: "Enforce minimum coverage on PRs, get coverage trend visibility, prevent regressions"
  - title: "Make govulncheck blocking in CI"
    effort: "30 minutes"
    impact: "Catch known vulnerabilities before merge instead of informational-only reporting"
  - title: "Add pre-commit hooks for linting and formatting"
    effort: "1-2 hours"
    impact: "Catch lint/format issues locally before push, reduce CI feedback loop"
  - title: "Create .claude/rules/ directory with test creation rules"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality and consistency for both Go and Python E2E tests"
recommendations:
  priority_0:
    - "Add Codecov integration with .codecov.yml, set project-level coverage thresholds (e.g., 70%), and enforce PR coverage delta checks"
    - "Enable Dependabot for gomod, github-actions, and docker ecosystems"
    - "Remove '|| true' from govulncheck CI steps to make vulnerability checks blocking"
  priority_1:
    - "Add container image smoke tests in CI (build image, verify startup, check binary exists)"
    - "Explore envtest-based integration tests for controller reconciliation to supplement E2E"
    - "Create .claude/rules/ with unit-tests.md and e2e-tests.md for AI agent test generation"
    - "Add pre-commit hooks (.pre-commit-config.yaml) with golangci-lint, gofmt, and yaml-lint"
  priority_2:
    - "Add contract tests for the OpenAPI spec against actual handler responses"
    - "Set up periodic load/performance tests for the maas-api endpoints"
    - "Add image health check validation (verify HEALTHCHECK or K8s probes in manifests)"
---

# Quality Analysis: models-as-a-service

**Repository**: [opendatahub-io/models-as-a-service](https://github.com/opendatahub-io/models-as-a-service)
**Jira**: RHOAIENG / Model as a Service (midstream)
**Analysis Date**: 2026-07-20
**Analyzed Commit**: HEAD of main branch (shallow clone)

## Executive Summary

- **Overall Score: 7.5/10** (Weighted Average)
- **Key Strengths**: Exceptional unit test coverage with a test-to-code ratio exceeding 1:1 by line count, comprehensive E2E test suite covering multi-tenancy and security scenarios, strong CI/CD automation with 15 workflows and Tekton/Konflux pipelines, excellent FIPS compliance posture, and innovative operator-chaos integration for breaking change detection.
- **Critical Gaps**: No coverage threshold enforcement or PR reporting integration (Codecov/Coveralls), no Dependabot/Renovate for dependency management, govulncheck runs non-blocking, and no container image runtime validation in CI.
- **Agent Rules Status**: Present (AGENTS.md is comprehensive); CLAUDE.md is a stub referencing AGENTS.md; no `.claude/rules/` directory for test-specific rules.

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 8.5/10 | Excellent test-to-code ratio; testify + gomega; t.Parallel() used |
| Integration/E2E | 20% | 8.0/10 | 26 pytest E2E test files; multi-tenant, auth, security coverage; Prow smoke integration |
| Build Integration | 15% | 7.5/10 | Kustomize validation, CRD codegen verify, operator-chaos; no PR Docker build |
| Image Testing | 10% | 6.0/10 | Multi-stage UBI9 + FIPS; Tekton PR builds; no runtime validation |
| Coverage Tracking | 10% | 5.0/10 | coverprofile generated; artifacts uploaded; no Codecov; no thresholds |
| CI/CD Automation | 15% | 8.5/10 | 15 workflows; path-filtered triggers; concurrency; Go caching; Tekton |
| Static Analysis | 10% | 7.5/10 | golangci-lint (all linters); Spectral; govulncheck; gitleaks; no Dependabot |
| Agent Rules | 5% | 7.0/10 | Comprehensive AGENTS.md; CLAUDE.md stub; no .claude/rules/ |

**Weighted Score**: (8.5×0.15) + (8.0×0.20) + (7.5×0.15) + (6.0×0.10) + (5.0×0.10) + (8.5×0.15) + (7.5×0.10) + (7.0×0.05) = **7.5/10**

## Critical Gaps

### 1. No Coverage Threshold Enforcement or PR Reporting
- **Impact**: Coverage can silently regress; no visibility into coverage changes on PRs
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Both `maas-api` and `maas-controller` Makefiles generate `coverage.out` with `--coverprofile` and upload as CI artifacts, but there is no Codecov/Coveralls integration, no `.codecov.yml`, and no minimum coverage gate. Coverage reports are only viewable by downloading build artifacts.

### 2. No Dependabot or Renovate Configuration
- **Impact**: Dependency vulnerabilities and updates require manual tracking; stale dependencies accumulate
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: No `.github/dependabot.yml` or `renovate.json` found. The repo uses govulncheck but it runs with `|| true` (non-blocking). No automated PR generation for Go module updates, GitHub Actions version bumps, or Docker base image updates.

### 3. No Container Image Runtime Validation
- **Impact**: Image startup failures, missing binaries, or permission issues not caught until deployment
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: Dockerfiles use multi-stage builds with UBI9 base images, but no CI step validates that the built image actually starts, responds on the health endpoint, or has correct file permissions. Tekton/Konflux builds the image but doesn't run it.

### 4. E2E Tests Require Live OpenShift Cluster
- **Impact**: E2E tests cannot run in standard PR CI; integration defects found late
- **Severity**: MEDIUM
- **Effort**: 16-24 hours
- **Details**: The 26-file pytest E2E suite requires a live OpenShift cluster with deployed MaaS infrastructure (Gateway API, Authorino, KServe). There's no lightweight envtest-based or Kind-based integration path for PR CI. This is partially mitigated by the strong unit test coverage and Prow smoke path.

## Quick Wins

### 1. Enable Dependabot (1-2 hours)
Add `.github/dependabot.yml` covering all ecosystems:
```yaml
version: 2
updates:
  - package-ecosystem: "gomod"
    directories:
      - "/maas-api"
      - "/maas-controller"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "docker"
    directories:
      - "/maas-api"
      - "/maas-controller"
    schedule:
      interval: "monthly"
  - package-ecosystem: "pip"
    directory: "/test/e2e"
    schedule:
      interval: "monthly"
```

### 2. Add Codecov Integration (3-4 hours)
Create `.codecov.yml` with thresholds and update CI workflows:
```yaml
coverage:
  status:
    project:
      default:
        target: 65%
        threshold: 2%
    patch:
      default:
        target: 70%
comment:
  layout: "diff, files"
  behavior: default
```
Add codecov upload step to `maas-api-ci.yml` and `maas-controller-ci.yml` after the test step.

### 3. Make govulncheck Blocking (30 minutes)
Remove `|| true` from govulncheck steps in both CI workflows:
```yaml
- name: Run govulncheck
  run: go run golang.org/x/vuln/cmd/govulncheck@v1.6.0 ./...
```

### 4. Add Pre-commit Hooks (1-2 hours)
Create `.pre-commit-config.yaml`:
```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-merge-conflict
  - repo: https://github.com/golangci/golangci-lint
    rev: v2.2.2
    hooks:
      - id: golangci-lint
        args: [--config=maas-api/.golangci.yml]
```

### 5. Create Agent Test Rules (2-3 hours)
Create `.claude/rules/` with `unit-tests.md` and `e2e-tests.md` covering Go testing patterns (testify, gomega, table-driven tests) and pytest E2E patterns (conftest fixtures, multitenancy helpers).

## Detailed Findings

### Unit Tests (8.5/10)

**Strengths**:
- **Exceptional test-to-code ratio**: 57 test files to 94 source files (0.61 ratio by file count); 30,791 test LOC vs 23,102 source LOC (1.33 ratio by line count — tests are more extensive than the code they test)
- **Both components well-covered**: maas-api has 25 test files covering handlers, middleware, auth, config, metrics, tokens, and subscriptions; maas-controller has 32 test files covering all controllers, webhooks, reconcilers, and platform logic
- **Testing framework consistency**: Uses `testify` (1,373 assertion calls) and `gomega` (635 calls) — both are appropriate for their respective contexts (testify for API service tests, gomega for controller-runtime patterns)
- **Test isolation**: 49 uses of `t.Parallel()` / `t.Helper()` across the test suite
- **Race detection**: Both Makefiles use `-race` flag by default in `TEST_FLAGS`
- **Test fixtures**: Dedicated `maas-api/test/fixtures/` with server setup helpers and LLM model mocks

**Gaps**:
- No envtest usage for controller tests (tests use mocks rather than a real API server)
- No table-driven test pattern enforcement (some tests could benefit from parameterized cases)

**Key Test Files**:
- `maas-api/internal/handlers/models_test.go` — Model endpoint handler tests
- `maas-controller/pkg/controller/maas/aitenant_controller_test.go` — Core tenant controller tests
- `maas-controller/pkg/webhook/aitenant_webhook_test.go` — Admission webhook validation tests
- `maas-controller/pkg/controller/maas/multitenancy_test.go` — Multi-tenancy scenario tests

### Integration/E2E Tests (8.0/10)

**Strengths**:
- **Comprehensive E2E suite**: 26 pytest test files under `test/e2e/tests/` covering:
  - Tenant lifecycle, discovery, and isolation (`test_aitenant_lifecycle.py`, `test_tenant_discovery.py`, `test_tenant_discovery_isolation.py`)
  - Authentication and authorization (`test_x_api_key_auth.py`, `test_tenant_auth_isolation.py`, `test_external_oidc.py`)
  - Security negative testing (`test_negative_security.py`, `test_networkpolicy.py`)
  - Multi-tenant isolation (`test_multi_tenant_integration.py`, `test_multi_tenant_maas_api.py`)
  - Subscriptions and rate limiting (`test_subscription.py`, `test_tenant_rate_limit_isolation.py`)
  - Model inference (`test_tenant_model_inference.py`, `test_models_endpoint.py`)
  - CRD resilience (`test_crd_watch_resilience.py`)
- **Well-structured fixtures**: `conftest.py` provides session-scoped fixtures for gateway connectivity, token management, model catalog, API key creation, and shared tenant infrastructure
- **Multi-tenant test helpers**: `multitenancy_helpers.py` provides reusable functions for tenant bootstrapping, cleanup, and wait conditions
- **Prow integration**: `test/e2e/scripts/prow_run_smoke_test.sh` provides production-grade smoke testing via Prow CI
- **Quick run scripts**: `run-tests-quick.sh` and `smoke.sh` enable fast local E2E testing
- **HTML reporting**: pytest-html and JUnit XML output for test results

**Gaps**:
- Tests require a live OpenShift cluster with full MaaS infrastructure — not feasible in standard PR CI
- No Kind/Minikube-based lightweight E2E path for PR validation
- No multi-version testing (testing against multiple K8s/OCP versions)

### Build Integration (7.5/10)

**Strengths**:
- **Kustomize manifest validation**: `build-test.yml` runs `./scripts/ci/validate-manifests.sh` on PRs affecting deployment or controller paths
- **CRD codegen verification**: `verify-codegen` job ensures generated CRDs, RBAC, and deepcopy files are in sync — CI rejects PRs with stale generated code
- **Operator-chaos integration** (innovative): `operator-chaos.yml` workflow runs on PRs affecting controller code:
  - Validates the chaos knowledge model
  - Runs local preflight checks
  - Diffs knowledge model for breaking changes
  - Diffs CRD schemas for breaking changes
  - Simulates upgrade scenarios
- **OpenAPI breaking change detection**: `openapi-validation.yml` uses oasdiff to detect breaking API changes on PRs, with ignore files for acknowledged changes
- **Tekton/Konflux PR builds**: `.tekton/odh-maas-api-pull-request.yaml` and `.tekton/odh-maas-controller-pull-request.yaml` trigger Konflux builds on PRs (smart path filtering excludes docs-only changes)
- **Semantic PR title enforcement**: `pr-title-validation.yml` ensures conventional commit format

**Gaps**:
- No PR-time Docker image build in GitHub Actions workflows (only Tekton/Konflux, which is external)
- No `kubectl apply --dry-run` or Kind cluster deployment validation in CI
- No cross-component build validation (maas-api and maas-controller built independently)

### Image Testing (6.0/10)

**Strengths**:
- **Multi-stage builds**: Both Dockerfiles use two-stage builds (builder + runtime), reducing image size
- **UBI9 base images**: Uses `registry.access.redhat.com/ubi9/go-toolset` for build and `ubi9/ubi-minimal` for runtime — FIPS-capable
- **FIPS compliance**: `GOEXPERIMENT=strictfipsruntime` and `CGO_ENABLED=1` set in Dockerfiles
- **Multi-architecture support**: `--platform=$BUILDPLATFORM/$TARGETPLATFORM` with `TARGETOS`/`TARGETARCH` build args
- **Konflux-specific Dockerfiles**: `Dockerfile.konflux` variants with pinned image digests (SHA256) for reproducible builds
- **OpenShift compatibility**: Non-root user (1001), group permissions (`chgrp -R 0`), and `chmod -R g=u` for random UID support
- **Container build targets**: `container.mk` provides `build-image`, `build-image-konflux`, and `push-image` targets
- **Security labels**: Konflux Dockerfiles include Red Hat component labels for tracking

**Gaps**:
- No image startup validation in CI (built but never run)
- No HEALTHCHECK instruction in Dockerfiles
- No container health check tests (Testcontainers or similar)
- No `.dockerignore` for maas-controller (maas-api has one)

### Coverage Tracking (5.0/10)

**Strengths**:
- **Coverage generation**: Both Makefiles use `--coverprofile=coverage.out` and generate HTML reports via `go tool cover`
- **CI artifact upload**: Both CI workflows upload `coverage.out` and `coverage.html` as build artifacts with 30-day retention

**Gaps**:
- **No Codecov/Coveralls integration**: Coverage data is buried in CI artifacts — no PR comments, no dashboard, no trend tracking
- **No coverage thresholds**: No minimum coverage gates; coverage can regress to any level without failing CI
- **No PR coverage delta checks**: No way to see what coverage impact a specific PR has
- **No `.codecov.yml`**: No coverage configuration file of any kind
- **No aggregate coverage**: maas-api and maas-controller coverage tracked independently with no combined view

### CI/CD Automation (8.5/10)

**Strengths**:
- **15 workflow files** covering diverse quality gates:
  - `maas-api-ci.yml` — lint + govulncheck + test for API (PR-triggered, path-filtered)
  - `maas-controller-ci.yml` — lint + govulncheck + test for controller (PR-triggered, path-filtered)
  - `build-test.yml` — Kustomize validation + codegen verify (PR + push-to-main)
  - `openapi-validation.yml` — Spectral linting + breaking change detection (PR)
  - `operator-chaos.yml` — Knowledge model validation + CRD diff + upgrade simulation (PR)
  - `pr-title-validation.yml` — Semantic PR title enforcement
  - `disconnected-readiness.yml` — Disconnected/air-gapped readiness check
  - `scorecard.yml` — OpenSSF Scorecard (weekly + push-to-main)
  - `docs.yml` — MkDocs documentation build
  - `create-release.yml` — Release automation (manual dispatch)
  - `promote-main-to-stable.yml` — Weekly promotion (scheduled)
  - `promote-stable-to-rhoai.yml` — RHOAI promotion (manual dispatch)
  - `update-docs-latest.yml`, `update-payload-processing.yml` — Automation helpers
- **Smart path filtering**: Workflows only trigger on relevant file changes (e.g., `maas-api/**` for API CI)
- **Concurrency control**: `build-test.yml` and `docs.yml` use concurrency groups with `cancel-in-progress: true`
- **Go caching**: All Go workflows use `actions/setup-go` with `cache: true` and `cache-dependency-path`
- **Tekton/Konflux pipelines**: 8 Tekton PipelineRun definitions for PR builds, push-to-main, and push-to-stable for both components
- **Timeout configuration**: Multiple jobs set `timeout-minutes` for predictable CI behavior
- **OpenSSF Scorecard**: Weekly automated security posture assessment with SARIF upload
- **Disconnected readiness**: Automated check for air-gapped deployment compatibility

**Gaps**:
- No test parallelization or matrix strategy in CI workflows
- E2E tests not integrated into PR CI (require external Prow infrastructure)
- No scheduled test runs beyond scorecard (no nightly/periodic test suites)

### Static Analysis (7.5/10)

**Strengths**:
- **golangci-lint v2 with aggressive configuration**: Both modules use `default: all` (enable all linters) with explicit disable list — this is best-in-class
  - maas-api: 21 linters disabled, rest enabled; `check-type-assertions`, `require-specific` nolint, `gocyclo` min-complexity 30
  - maas-controller: 27 linters disabled, rest enabled; `gocyclo` min-complexity 40
- **Formatters enabled**: `gci`, `gofmt`, `goimports` with import ordering rules
- **Spectral OpenAPI linting**: `.spectral.yml` extends `spectral:oas` with strict rules for operation IDs, descriptions, and schema validation
- **govulncheck**: Runs in both CI workflows to detect known Go vulnerabilities (currently non-blocking)
- **gitleaks**: `.gitleaks.toml` with comprehensive allowlist for test fixtures, mocks, and sample configs
- **OpenSSF Scorecard**: Automated security posture assessment

#### FIPS Compatibility
- **FIPS-COMPLIANT**: No `crypto/md5`, `crypto/des`, `crypto/rc4`, or `math/rand` imports detected in source code
- **Build configuration**: `GOEXPERIMENT=strictfipsruntime` in Dockerfiles and Makefile with `GO_STRICTFIPS=true` option
- **CGO_ENABLED=1**: Set as default for FIPS-compatible builds
- **UBI9 base images**: FIPS-capable Red Hat Universal Base Images used throughout

#### Dependency Alerts
- **MISSING**: No `.github/dependabot.yml` or `renovate.json` — dependency updates are not automated
- **Partial mitigation**: govulncheck catches known vulnerabilities, but only for Go modules and only in CI

**Gaps**:
- No Dependabot or Renovate configuration
- govulncheck is non-blocking (`|| true`)
- No pre-commit hooks (`.pre-commit-config.yaml`)
- No mypy/ruff for Python E2E test code

### Agent Rules (7.0/10)

**Strengths**:
- **Comprehensive AGENTS.md** (alwaysApply: true) with:
  - Repository structure table mapping directories to purposes
  - CRD documentation (API group, types, source location)
  - Build and test commands for both maas-api and maas-controller
  - Codegen rules (when to regenerate, CI enforcement)
  - Kustomize/deployment conventions with links to key files
  - PR title format requirements with allowed types
  - PR description requirements including risk analysis with 0-5 scale
  - Testing conventions (Go testing + gomega/testify, pytest E2E)
  - Documentation policy (search before writing, no duplicates)
  - Explicit "Things to never do" list
- **CLAUDE.md present**: Contains `@AGENTS.md` reference (defers to AGENTS.md)

**Gaps**:
- No `.claude/` directory or `.claude/rules/` for test-specific rules
- No unit test creation rules (e.g., patterns for table-driven tests, mock setup, assertion patterns)
- No E2E test creation rules (e.g., fixture usage, multitenancy_helpers patterns, conftest conventions)
- No `.claude/skills/` for custom skills
- AGENTS.md doesn't include example test patterns or test quality checklists

## Recommendations

### Priority 0 (Critical)

1. **Add Codecov integration with coverage thresholds** — Create `.codecov.yml` with 65% project target and 70% patch target. Add `codecov/codecov-action` to both CI workflows after the test upload step. This provides immediate visibility into coverage trends and prevents regression.

2. **Enable Dependabot for all ecosystems** — Add `.github/dependabot.yml` covering `gomod` (both modules), `github-actions`, `docker`, and `pip` (E2E tests). This automates security patches and dependency freshness across the entire repo.

3. **Make govulncheck blocking** — Remove `|| true` from govulncheck steps in `maas-api-ci.yml` and `maas-controller-ci.yml`. Known vulnerabilities should block merge, not just report.

### Priority 1 (High Value)

4. **Add container image smoke tests** — Add a CI job that builds the Docker image and runs it with a health check (e.g., `docker run -d <image> && curl localhost:8080/health`). This catches runtime issues like missing binaries or permission problems.

5. **Add envtest-based controller integration tests** — Use `controller-runtime/pkg/envtest` to test controller reconciliation against a real API server in CI. This bridges the gap between unit mocks and full E2E cluster tests.

6. **Create `.claude/rules/` with test creation rules** — Write `unit-tests.md` covering Go testing patterns (testify assertions, gomega matchers, table-driven tests, mock setup with `maas-api/test/fixtures/`) and `e2e-tests.md` covering pytest patterns (conftest fixtures, multitenancy_helpers, TLS_VERIFY handling).

7. **Add pre-commit hooks** — Create `.pre-commit-config.yaml` with golangci-lint, gofmt, yaml-lint, and end-of-file-fixer hooks to catch issues before push.

### Priority 2 (Nice-to-Have)

8. **Add contract tests for OpenAPI spec** — Verify that actual handler responses match the OpenAPI spec (`maas-api/openapi3.yaml`). This complements the existing Spectral linting with runtime validation.

9. **Add `.dockerignore` for maas-controller** — The maas-api has one but the controller does not. This reduces build context size and prevents accidental inclusion of test data.

10. **Add Python linting for E2E tests** — Add ruff or flake8 configuration for the `test/e2e/` Python code to maintain consistent style.

11. **Explore periodic CI test suites** — Add scheduled (nightly or weekly) test runs beyond the OpenSSF Scorecard, such as dependency audit or extended test suites.

## Comparison to Gold Standards

| Practice | models-as-a-service | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|----------|-------------------|---------------------|-----------------|--------------|
| Test-to-code ratio | 1.33 (LOC) | ~0.8 | ~0.5 | ~0.7 |
| E2E automation | Prow-integrated pytest | Cypress + GitHub CI | Automated notebook validation | Ginkgo E2E |
| Coverage enforcement | No (artifacts only) | Yes (Codecov) | Partial | Yes (threshold) |
| Dependency alerts | None | Dependabot | Dependabot | Dependabot |
| Pre-commit hooks | None | Yes | Yes | Yes |
| FIPS compliance | Excellent (strictfipsruntime, UBI9, no bad imports) | Partial | Yes (UBI, build tags) | Partial |
| OpenAPI validation | Yes (Spectral + oasdiff breaking changes) | N/A | N/A | N/A |
| Agent rules | AGENTS.md (comprehensive) | CLAUDE.md + rules | Partial | Partial |
| Operator chaos testing | Yes (innovative) | N/A | N/A | N/A |
| Image multi-arch | Yes (BUILDPLATFORM/TARGETPLATFORM) | Partial | Yes | Yes |
| Konflux integration | Yes (Tekton pipelines) | Yes | Yes | Yes |

## File Paths Reference

### CI/CD
- `.github/workflows/maas-api-ci.yml` — API lint + vuln + test
- `.github/workflows/maas-controller-ci.yml` — Controller lint + vuln + test
- `.github/workflows/build-test.yml` — Kustomize validation + codegen verify
- `.github/workflows/openapi-validation.yml` — Spectral + oasdiff
- `.github/workflows/operator-chaos.yml` — CRD diff + upgrade simulation
- `.github/workflows/pr-title-validation.yml` — Semantic PR titles
- `.github/workflows/scorecard.yml` — OpenSSF Scorecard
- `.tekton/*.yaml` — Konflux Tekton pipelines (8 files)

### Testing
- `maas-api/internal/**/*_test.go` — API unit tests (25 files)
- `maas-controller/pkg/**/*_test.go` — Controller unit tests (32 files)
- `test/e2e/tests/*.py` — E2E pytest suite (26 files)
- `test/e2e/tests/conftest.py` — E2E fixtures and setup
- `test/e2e/smoke.sh` — Prow smoke test runner
- `maas-api/test/fixtures/` — Go test fixtures

### Static Analysis
- `maas-api/.golangci.yml` — API linter config (all linters, 21 disabled)
- `maas-controller/.golangci.yml` — Controller linter config (all linters, 27 disabled)
- `.spectral.yml` — OpenAPI linting rules
- `.gitleaks.toml` — Secret detection config
- `semgrep.yaml` — Semgrep rules

### Container Images
- `maas-api/Dockerfile` — API image (multi-stage, UBI9, FIPS)
- `maas-api/Dockerfile.konflux` — API Konflux image (pinned digests)
- `maas-controller/Dockerfile` — Controller image (multi-stage, UBI9, FIPS)
- `maas-controller/Dockerfile.konflux` — Controller Konflux image (pinned digests)
- `maas-api/container.mk` — API image build targets
- `maas-controller/container.mk` — Controller image build targets

### Build
- `maas-api/Makefile` — API build, lint, test targets
- `maas-controller/Makefile` — Controller build, generate, manifests, lint, test targets
- `maas-api/tools.mk` — Shared tool version management
- `maas-controller/tools.mk` — Shared tool version management

### Agent Rules
- `AGENTS.md` — Comprehensive agent rules (alwaysApply)
- `CLAUDE.md` — Stub referencing AGENTS.md
- `chaos/knowledge/maas.yaml` — Operator chaos knowledge model

### Deployment
- `deployment/base/` — Kustomize base manifests
- `deployment/overlays/` — Environment-specific overlays (odh, openshift, xks)
- `deployment/components/` — Reusable Kustomize components
- `scripts/ci/validate-manifests.sh` — CI manifest validation
