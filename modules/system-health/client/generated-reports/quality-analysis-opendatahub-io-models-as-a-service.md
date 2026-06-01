---
repository: "opendatahub-io/models-as-a-service"
overall_score: 7.0
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Excellent test-to-code ratio (1.14:1) with race detection and coverage generation"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Comprehensive pytest E2E suite with Prow CI, multi-user testing, and group testing"
  - dimension: "Build Integration"
    score: 7.0
    status: "Konflux PR builds + Kustomize validation + codegen verification, but no image startup tests"
  - dimension: "Image Testing"
    score: 5.0
    status: "Multi-stage UBI9 Dockerfiles with FIPS, but no scanning or runtime validation"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "Coverage generated and uploaded as artifacts, but no enforcement or threshold tracking"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "18 pipelines (11 GHA + 7 Tekton), OpenAPI validation, promotion workflows, path-filtered triggers"
  - dimension: "Agent Rules"
    score: 5.0
    status: "Good AGENTS.md with build/test conventions but no structured .claude/rules/ for test patterns"
critical_gaps:
  - title: "No coverage enforcement or threshold tracking"
    impact: "Coverage can silently regress with no PR-level feedback or minimum thresholds"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container image security scanning"
    impact: "Vulnerabilities in dependencies and base images not caught before deployment"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No pre-commit hooks"
    impact: "Lint and format issues caught only in CI, slowing feedback loop"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No image runtime validation tests"
    impact: "Container startup failures or missing files not caught until deployment"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add codecov integration with PR comments and thresholds"
    effort: "2-4 hours"
    impact: "Automatic coverage tracking, PR-level feedback, regression prevention"
  - title: "Add Trivy scanning to GitHub Actions PR workflow"
    effort: "1-2 hours"
    impact: "Early detection of CVEs in dependencies and base images"
  - title: "Add pre-commit hooks with golangci-lint and gitleaks"
    effort: "1-2 hours"
    impact: "Faster developer feedback, catch lint/secret issues before push"
  - title: "Create .claude/rules/ test automation guidance"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality and consistency across contributors"
recommendations:
  priority_0:
    - "Add codecov/coveralls integration with minimum coverage thresholds and PR comments"
    - "Add Trivy container scanning to PR and push workflows for both maas-api and maas-controller images"
  priority_1:
    - "Add container startup validation tests (health endpoint check after image build)"
    - "Create structured .claude/rules/ with unit-test, integration-test, and e2e-test patterns"
    - "Add CodeQL or Semgrep CI workflow for automated SAST on PRs"
  priority_2:
    - "Add pre-commit hooks (.pre-commit-config.yaml) for golangci-lint, gitleaks, and YAML validation"
    - "Add API contract tests between maas-api and maas-controller"
    - "Add performance regression testing for API endpoints"
---

# Quality Analysis: models-as-a-service

## Executive Summary

- **Overall Score: 7.0/10**
- **Repository Type**: Go monorepo (Kubernetes controller + HTTP API service)
- **Primary Languages**: Go (maas-api, maas-controller), Python (E2E tests)
- **Framework**: Kubernetes controller-runtime, kubebuilder, Gateway API

### Key Strengths
- **Outstanding test-to-code ratio**: 17,586 lines of Go test code vs 15,482 lines of source code (1.14:1 ratio)
- **Comprehensive E2E test suite**: 12 pytest modules (~9,600 lines) covering subscriptions, API keys, models, security, namespace scoping, tenant lifecycle, and external OIDC
- **Sophisticated CI/CD**: 18 pipelines (11 GitHub Actions + 7 Tekton) with path-filtered triggers, concurrency control, OpenAPI breaking change detection, and automated promotion workflows (main -> stable -> rhoai)
- **Strong security tooling**: Gitleaks, Semgrep (62KB of rules covering Go/Python/YAML/generic), Spectral OpenAPI linting, input validation in CI scripts
- **FIPS compliance**: `strictfipsruntime` GOEXPERIMENT in all builds

### Critical Gaps
- No coverage enforcement or threshold tracking (coverage is generated but not reported on PRs)
- No container image security scanning (Trivy/Snyk/Grype)
- No image runtime validation after build
- No pre-commit hooks

### Agent Rules Status: **Partial**
- AGENTS.md present with good conventions but no `.claude/rules/` directory for structured test automation guidance

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8/10 | Excellent test-to-code ratio (1.14:1) with race detection and coverage generation |
| Integration/E2E | 8/10 | Comprehensive pytest E2E suite with Prow CI, multi-user testing, and group testing |
| **Build Integration** | **7/10** | **Konflux PR builds + Kustomize/codegen verification, but no image startup tests** |
| Image Testing | 5/10 | Multi-stage UBI9 Dockerfiles with FIPS, but no scanning or runtime validation |
| Coverage Tracking | 4/10 | Coverage generated and uploaded as artifacts, but no enforcement or threshold tracking |
| CI/CD Automation | 9/10 | 18 pipelines, OpenAPI validation, promotion workflows, path-filtered triggers |
| Agent Rules | 5/10 | Good AGENTS.md but no structured .claude/rules/ for test patterns |

## Critical Gaps

### 1. No Coverage Enforcement or Threshold Tracking
- **Impact**: Coverage can silently regress without any PR-level feedback or minimum thresholds
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Both `maas-api` and `maas-controller` generate `coverage.out` and `coverage.html` via `go test -coverprofile`, and these are uploaded as 30-day artifacts. However, there is no codecov/coveralls integration, no PR comments showing coverage delta, and no minimum threshold enforcement.

### 2. No Container Image Security Scanning
- **Impact**: Vulnerabilities in Go dependencies, Python packages, and UBI9 base images are not detected before deployment
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Despite strong static analysis (Semgrep, Gitleaks, golangci-lint with `default: all`), there is no container scanning step. No Trivy, Snyk, or Grype integration in GitHub Actions or Tekton pipelines. The Konflux pipeline may include some scanning via its central pipeline, but the GitHub Actions CI path has no image scanning.

### 3. No Pre-commit Hooks
- **Impact**: Lint failures, formatting issues, and accidental secrets are caught only in CI, adding 2-5 minutes of feedback latency
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: No `.pre-commit-config.yaml` exists. The golangci-lint v2 config is well-tuned (`default: all` with ~20 selective disables), but runs only in CI.

### 4. No Image Runtime Validation
- **Impact**: Container startup failures, missing embedded files, or broken entrypoints not caught until deployment
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: The maas-controller Dockerfile embeds deployment manifests from multiple directories (`maas-api/deploy`, `deployment/base/maas-api`, `deployment/components`, etc.). If a COPY path breaks, it would only be caught at deployment time.

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
Add codecov to both CI workflows. The coverage files are already generated.

```yaml
# Add to maas-api-ci.yml and maas-controller-ci.yml after test step:
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: ${{ env.PROJECT_DIR }}/coverage.out
    flags: ${{ env.PROJECT_DIR }}
    fail_ci_if_error: false
    token: ${{ secrets.CODECOV_TOKEN }}
```

Create `.codecov.yml`:
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
comment:
  layout: "reach,diff,flags,components"
  behavior: default
flags:
  maas-api:
    paths:
      - maas-api/
  maas-controller:
    paths:
      - maas-controller/
```

### 2. Add Trivy Scanning (1-2 hours)
Add Trivy to the build-test workflow or create a new security scanning workflow.

```yaml
# .github/workflows/security-scan.yml
name: Security Scan
on:
  pull_request:
    paths:
      - 'maas-api/**'
      - 'maas-controller/**'
  push:
    branches: [main]

jobs:
  trivy-scan:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        component: [maas-api, maas-controller]
    steps:
      - uses: actions/checkout@v5
      - name: Build image
        run: |
          docker build -t ${{ matrix.component }}:scan \
            -f ${{ matrix.component }}/Dockerfile \
            ${{ matrix.component == 'maas-controller' && '.' || 'maas-api' }}
      - name: Run Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: '${{ matrix.component }}:scan'
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'
```

### 3. Add Pre-commit Hooks (1-2 hours)
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
  - repo: https://github.com/zricethezav/gitleaks
    rev: v8.18.1
    hooks:
      - id: gitleaks
```

### 4. Create .claude/rules/ Test Guidance (2-3 hours)
Generate structured test rules for unit tests, integration tests, and E2E tests using `/test-rules-generator`.

## Detailed Findings

### CI/CD Pipeline

**GitHub Actions Workflows (11):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `maas-api-ci.yml` | PR (maas-api/**) | Lint + test for maas-api |
| `maas-controller-ci.yml` | PR (maas-controller/**) | Lint + test for maas-controller |
| `build-test.yml` | PR + push (controller/deployment paths) | Kustomize validation + codegen verification |
| `openapi-validation.yml` | PR + push (openapi3.yaml) | Spectral linting + oasdiff breaking changes + changelog check |
| `pr-title-validation.yml` | PR | Semantic PR title enforcement |
| `docs.yml` | PR + push (docs/**) | Link validation + MkDocs build/deploy |
| `create-release.yml` | workflow_dispatch | Full release: branch, tag, image, docs |
| `promote-main-to-stable.yml` | Weekly + dispatch | Automated main -> stable promotion PR |
| `promote-stable-to-rhoai.yml` | workflow_dispatch | Stable -> rhoai promotion PR |
| `update-docs-latest.yml` | push (tags) | Update docs latest alias |

**Tekton Pipelines (7):**

| Pipeline | Trigger | Purpose |
|----------|---------|---------|
| `odh-maas-api-pull-request.yaml` | PR (non-docs) | Konflux image build for maas-api |
| `odh-maas-controller-pull-request.yaml` | PR (non-docs) | Konflux image build for maas-controller |
| `odh-maas-api-push.yaml` | push main | Build + push maas-api:latest |
| `odh-maas-controller-push.yaml` | push main | Build + push maas-controller:latest |
| `odh-maas-api-push-stable.yaml` | push stable | Build + push maas-api:odh-stable |
| `odh-maas-controller-push-stable.yaml` | push stable | Build + push maas-controller:odh-stable |
| `maas-group-test.yaml` | /group-test comment | Group testing both components together |

**Strengths:**
- Path-filtered triggers avoid unnecessary CI runs
- Concurrency control with `cancel-in-progress: true`
- Go module caching via `actions/setup-go` with `cache: true`
- Pin SHA hashes on critical actions (checkout, setup-go, golangci-lint-action)
- Automated promotion pipeline: main -> stable (weekly) -> rhoai (manual)
- Group testing validates both components integrate correctly
- Smart CEL expressions on Tekton pipelines skip doc-only changes

**Gaps:**
- No security scanning workflow (Trivy/Snyk/CodeQL)
- No dependency update automation (Dependabot/Renovate)
- No parallel test execution across components

### Test Coverage

#### Unit Tests
- **maas-api**: 44 source files, 19 test files | 7,176 source LOC, 9,079 test LOC (1.27:1 ratio)
- **maas-controller**: 31 source files, 15 test files | 8,306 source LOC, 8,507 test LOC (1.02:1 ratio)
- **Combined**: 75 source files, 34 test files | 15,482 source LOC, 17,586 test LOC (1.14:1 ratio)
- **Framework**: Go `testing` with `gomega` and `testify` assertion libraries
- **Race detection**: Enabled via `-race` flag by default
- **Coverage**: Generated via `-coverprofile=coverage.out` with HTML report

Key test areas covered:
- maas-api: config, TLS, auth (SAR admin checker, cached admin checker), API keys (handler, service, store, keygen), metrics, middleware, handlers, subscription, models discovery, CORS, logger redaction
- maas-controller: controller reconcilers (subscription, model ref, auth policy, tenant, self-deployment, conflict detection, cross-namespace), providers (LLMISVC, external), platform params, external model resources

#### E2E Tests
- **12 pytest modules** totaling ~9,600 lines of test code
- **CI-automated** via Prow (`prow_run_smoke_test.sh` - 40K lines covering full deploy + test)
- **Comprehensive coverage**: subscriptions, API keys, models endpoint, negative security, namespace scoping, external models, tenant lifecycle, config/tenant, external OIDC

| Test Module | Lines | CI Default | Focus |
|-------------|-------|------------|-------|
| `test_subscription.py` | 2,512 | Yes | Subscription + inference flows |
| `test_models_endpoint.py` | 2,302 | Yes | /v1/models endpoint |
| `test_api_keys.py` | 1,492 | Yes | /v1/api-keys CRUD |
| `test_helper.py` | 1,012 | N/A | Shared test utilities |
| `test_namespace_scoping.py` | 480 | Yes | Namespace wiring |
| `test_negative_security.py` | 431 | Yes | Security negative paths |
| `test_subscription_list_endpoints.py` | 380 | Explicit | Subscription list endpoints |
| `test_external_models.py` | 328 | Yes | External model references |
| `test_external_oidc.py` | 213 | Explicit | External OIDC integration |
| `test_tenant.py` | 197 | Yes | Tenant CR lifecycle |
| `test_config_tenant.py` | 181 | Yes | Config/default anchor, owner refs |
| `test_smoke.py` | 98 | Smoke | Basic health checks |

**Strengths:**
- Multi-user testing (admin + regular user) with API key minting
- Automatic cluster setup/teardown including ODH, KServe, cert-manager, LWS
- Supports custom images for pipeline-built image validation
- JUnit XML + HTML + Log output formats
- Graceful skip for partial clusters (CRD absence detection)

**Gaps:**
- Some modules (`test_external_oidc.py`, `test_subscription_list_endpoints.py`) not in default CI path
- No pytest-cov integration for Python E2E test coverage tracking
- No parallel test execution

### Code Quality

#### Linting
- **golangci-lint v2.6.2** with `default: all` (most aggressive configuration possible)
- **maas-api**: ~15 disabled linters, 180 char line limit, import ordering via gci
- **maas-controller**: ~20 disabled linters, 220 char line limit, import ordering via gci
- Both use `errcheck` with type assertion checking, `gocritic`, `gocyclo`, `revive`
- Automated formatter integration: `gci`, `gofmt`, `goimports`

#### Static Analysis
- **Semgrep**: 62KB unified config covering Go (Kubernetes operators), Python, TypeScript, YAML, and generic secret detection
- **Spectral**: OpenAPI linting with custom MaaS subscription header rule
- **oasdiff**: Breaking change detection for OpenAPI spec on PRs

#### Secret Detection
- **Gitleaks**: Configured with test file exclusions, synced from central `security-config`
- **Semgrep**: Generic secret detection patterns across all file types

#### Gaps
- No CodeQL/SAST in GitHub Actions
- No pre-commit hooks
- Semgrep rules exist but no CI workflow runs them on PRs

### Container Images

#### Build Process
- **4 Dockerfiles**: 2 dev (`Dockerfile`) + 2 Konflux (`Dockerfile.konflux`) for maas-api and maas-controller
- **Multi-stage builds**: UBI9 go-toolset builder -> UBI9 minimal runtime
- **FIPS compliance**: `GOEXPERIMENT=strictfipsruntime` in all builds
- **Non-root**: User 1001 with OpenShift-compatible group permissions
- **Konflux images**: Pinned base image SHA digests for reproducibility
- **Red Hat labels**: Component, name, description, maintainer, license for RHOAI builds

#### Multi-architecture
- Supported via `BUILDPLATFORM`/`TARGETPLATFORM` ARGs
- Konflux `multi-arch-container-build.yaml` pipeline for production builds

#### Controller Image Specifics
- Embeds deployment manifests: `maas-api/deploy`, `deployment/base/maas-api`, `deployment/components`, `deployment/base/payload-processing`
- Build context is repository root (not just maas-controller/)

#### Gaps
- No Trivy/Snyk scanning in GitHub Actions
- No container runtime validation tests
- No SBOM generation
- No image signing or attestation in GitHub Actions (may be handled by Konflux)

### Security

**Strengths:**
- Gitleaks secret detection (centrally managed config)
- Semgrep comprehensive rules (CWE-798, CWE-89, CWE-79, CWE-22, etc.)
- OpenAPI spec validation with breaking change detection
- Input validation in CI scripts (base ref injection prevention)
- FIPS-compliant builds
- Non-root containers with OpenShift UID compatibility
- UBI9 minimal base images (Red Hat-maintained, lower CVE surface)

**Gaps:**
- No container image scanning (Trivy/Snyk/Grype)
- No CodeQL integration
- No DAST (Dynamic Application Security Testing)
- No dependency scanning workflow (Dependabot/Renovate)
- Semgrep config exists but no CI workflow to run it

### Agent Rules (Agentic Flow Quality)

**Status**: Partial
- **CLAUDE.md**: Exists but just references AGENTS.md (`@AGENTS.md`)
- **AGENTS.md**: Comprehensive (5.6KB) with:
  - Repository structure documentation
  - CRD type inventory
  - Build and test commands for both components
  - Codegen rules and enforcement
  - Kustomize deployment details
  - PR title format requirements
  - PR review process (CodeRabbit integration)
  - Risk analysis guidelines with rating scale
  - Testing conventions (Go testing + gomega/testify, pytest E2E)
  - Documentation policy (no duplication)
  - Anti-patterns ("Things to never do")

**Gaps:**
- No `.claude/` directory structure
- No `.claude/rules/` with structured test automation guidance
- No rule files for specific test types (unit-tests.md, e2e-tests.md)
- No test pattern examples or checklists
- No framework-specific testing guidance (envtest, controller-runtime testing patterns)
- **Recommendation**: Generate missing rules with `/test-rules-generator`

## Recommendations

### Priority 0 (Critical)

1. **Add codecov/coveralls integration** with PR comments and minimum thresholds
   - Coverage files already generated; needs ~30 lines of workflow YAML + `.codecov.yml`
   - Prevents silent coverage regression
   - Effort: 2-4 hours

2. **Add Trivy container scanning** to PR and push workflows
   - Both maas-api and maas-controller images should be scanned
   - Use `aquasecurity/trivy-action` with SARIF output
   - Effort: 2-4 hours

### Priority 1 (High Value)

3. **Add container startup validation** after image build
   - Run `docker run --rm maas-api:test ./maas-api --help` or health check
   - Validate embedded manifest files in controller image
   - Effort: 4-6 hours

4. **Create structured .claude/rules/** for test automation
   - Unit test patterns for Go (envtest, controller-runtime, gomega matchers)
   - E2E test patterns for pytest (conftest, helper utilities, OpenShift testing)
   - Integration test guidance
   - Effort: 2-3 hours

5. **Add Semgrep CI workflow** to run existing rules on PRs
   - Rules already exist (`semgrep.yaml`), just need a workflow to trigger them
   - Effort: 1-2 hours

### Priority 2 (Nice-to-Have)

6. **Add pre-commit hooks** for golangci-lint, gitleaks, YAML validation
   - Faster developer feedback loop
   - Effort: 1-2 hours

7. **Add API contract tests** between maas-api and maas-controller
   - Validate CRD schema compatibility
   - Test API response contracts
   - Effort: 8-12 hours

8. **Add Dependabot/Renovate** for automated dependency updates
   - Go modules and GitHub Actions versions
   - Effort: 1-2 hours

9. **Add performance regression tests** for API endpoints
   - Baseline latency for key endpoints (/v1/models, /v1/api-keys, /v1/subscriptions)
   - Effort: 8-12 hours

## Comparison to Gold Standards

| Dimension | models-as-a-service | odh-dashboard | notebooks | kserve |
|-----------|-------------------|---------------|-----------|--------|
| Unit Tests | 8/10 (1.14:1 ratio) | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 8/10 (comprehensive pytest) | 9/10 (Cypress + contract) | 8/10 | 9/10 |
| Build Integration | 7/10 (Konflux + validation) | 8/10 | 7/10 | 8/10 |
| Image Testing | 5/10 (no scanning) | 7/10 | 9/10 (5-layer) | 6/10 |
| Coverage Tracking | 4/10 (no enforcement) | 8/10 (codecov) | 5/10 | 8/10 (thresholds) |
| CI/CD Automation | 9/10 (18 pipelines) | 9/10 | 8/10 | 9/10 |
| Agent Rules | 5/10 (AGENTS.md only) | 8/10 (full rules) | 3/10 | 4/10 |
| **Overall** | **7.0** | **8.3** | **7.0** | **7.7** |

### Key Differentiators
- **Stronger than most**: Test-to-code ratio (1.14:1 is exceptional), OpenAPI breaking change detection, promotion pipeline automation
- **Weaker than gold standards**: Coverage enforcement, image scanning, agent rules structure

## File Paths Reference

### CI/CD
- `.github/workflows/maas-api-ci.yml` - API lint + test
- `.github/workflows/maas-controller-ci.yml` - Controller lint + test
- `.github/workflows/build-test.yml` - Kustomize + codegen verification
- `.github/workflows/openapi-validation.yml` - OpenAPI Spectral + oasdiff
- `.github/workflows/pr-title-validation.yml` - Semantic PR title
- `.github/workflows/promote-main-to-stable.yml` - Weekly promotion
- `.github/workflows/promote-stable-to-rhoai.yml` - RHOAI promotion
- `.github/workflows/create-release.yml` - Full release automation
- `.tekton/odh-maas-api-pull-request.yaml` - Konflux API PR build
- `.tekton/odh-maas-controller-pull-request.yaml` - Konflux controller PR build
- `.tekton/maas-group-test.yaml` - Group testing pipeline

### Testing
- `maas-api/cmd/cors_test.go`, `maas-api/internal/**/*_test.go` - API unit tests (19 files)
- `maas-controller/pkg/**/*_test.go` - Controller unit tests (15 files)
- `test/e2e/tests/` - E2E pytest modules (12 files)
- `test/e2e/smoke.sh` - Smoke test entry point
- `test/e2e/scripts/prow_run_smoke_test.sh` - Full CI E2E script

### Code Quality
- `maas-api/.golangci.yml` - API linter config (default: all)
- `maas-controller/.golangci.yml` - Controller linter config (default: all)
- `.gitleaks.toml` - Secret detection (synced from security-config)
- `semgrep.yaml` - Comprehensive security rules (62KB)
- `.spectral.yml` - OpenAPI linting rules

### Container Images
- `maas-api/Dockerfile` - API dev build
- `maas-api/Dockerfile.konflux` - API production build (pinned SHAs)
- `maas-controller/Dockerfile` - Controller dev build
- `maas-controller/Dockerfile.konflux` - Controller production build (pinned SHAs)

### Agent Rules
- `CLAUDE.md` - Points to AGENTS.md
- `AGENTS.md` - Main agent conventions document
