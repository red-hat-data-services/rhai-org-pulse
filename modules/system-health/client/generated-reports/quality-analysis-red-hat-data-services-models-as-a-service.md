---
repository: "red-hat-data-services/models-as-a-service"
overall_score: 7.4
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Strong Go unit tests for both API and controller with >1:1 test-to-code ratio"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Comprehensive pytest E2E suite (11 test files, ~9800 LOC) with Prow integration and full cluster deployment"
  - dimension: "Build Integration"
    score: 5.0
    status: "Kustomize manifest validation and codegen verification on PR, but no PR-time Docker image build or Konflux simulation"
  - dimension: "Image Testing"
    score: 4.5
    status: "Multi-stage Dockerfiles with Konflux variants and FIPS support, but no PR-time image build, startup, or runtime validation"
  - dimension: "Coverage Tracking"
    score: 5.0
    status: "Coverage artifacts uploaded per-PR but no codecov/coveralls integration or threshold enforcement"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "Well-organized workflows with path filtering, concurrency control, Go caching, OpenAPI validation, breaking change detection"
  - dimension: "Agent Rules"
    score: 8.0
    status: "Comprehensive AGENTS.md with build/test commands, testing conventions, PR guidelines, risk analysis scale, and codegen rules"
critical_gaps:
  - title: "No PR-time Docker image build validation"
    impact: "Image build failures discovered only post-merge in Konflux; developers get no early feedback on Dockerfile or dependency issues"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No coverage enforcement or threshold"
    impact: "Test coverage can silently regress with no PR gate; coverage.out is uploaded as artifact but never analyzed or reported on PRs"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No pre-commit hooks"
    impact: "Linting and formatting issues caught only in CI, adding friction to the PR review cycle"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No container vulnerability scanning in CI"
    impact: "CVEs in base images or dependencies not detected until downstream Konflux builds or manual audits"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No envtest-based integration tests for controller"
    impact: "Controller reconciliation logic tested only via unit test mocks; real API server interaction gaps could hide bugs"
    severity: "MEDIUM"
    effort: "8-16 hours"
quick_wins:
  - title: "Add Codecov or Coveralls integration to PR workflows"
    effort: "2-3 hours"
    impact: "Automatic PR coverage reporting with threshold enforcement prevents silent regression"
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Early detection of known CVEs in UBI base images and Go dependencies"
  - title: "Add pre-commit hooks (gitleaks, golangci-lint, yamllint)"
    effort: "2-3 hours"
    impact: "Catch lint, secret, and formatting issues before pushing, reducing CI churn"
  - title: "Add PR-time Docker build step to build-test.yml"
    effort: "3-4 hours"
    impact: "Verify Dockerfiles build successfully before merge, catching dependency and copy issues early"
recommendations:
  priority_0:
    - "Add Codecov integration with per-component coverage thresholds (e.g., 60% minimum, fail on regression)"
    - "Add Trivy or Snyk scanning for container images in PR and periodic workflows"
    - "Add PR-time Docker build validation for both maas-api and maas-controller images"
  priority_1:
    - "Add envtest-based integration tests for maas-controller reconciliation loops"
    - "Add pre-commit hooks to catch linting, secrets, and YAML validation locally"
    - "Add CodeQL or Semgrep CI workflow for automated SAST on every PR"
    - "Add contract tests between maas-api and maas-controller to validate CRD schema assumptions"
  priority_2:
    - "Add multi-architecture image build testing (amd64 + arm64)"
    - "Add image startup validation test (container starts and responds to health check)"
    - "Add performance/load tests for maas-api endpoints"
    - "Add .claude/rules/ directory with test-type-specific creation rules for AI-assisted development"
---

# Quality Analysis: models-as-a-service

## Executive Summary

- **Overall Score: 7.4/10**
- **Repository Type**: Kubernetes-native platform (Go controller + Go HTTP API + pytest E2E)
- **Primary Languages**: Go (controller + API), Python (E2E tests), Bash (deploy/CI scripts)
- **Architecture**: Two independent Go modules — `maas-controller` (kubebuilder controller-runtime) and `maas-api` (HTTP service for keys, tokens, subscriptions)

### Key Strengths
- **Excellent test-to-code ratio**: Both Go modules have more test code than production code (API: 9079 vs 7176 LOC; controller: 8507 vs 9329 LOC)
- **Comprehensive E2E suite**: 11 pytest test files covering smoke, API keys, subscriptions, models, tenants, security, OIDC, and namespace scoping — with a fully automated Prow deployment script
- **Strong CI/CD**: Path-filtered workflows, concurrency control, Go build caching, OpenAPI validation with breaking change detection, semantic PR title enforcement
- **Good agent rules**: Detailed AGENTS.md covering repo structure, build commands, codegen rules, PR conventions, and risk analysis guidelines
- **Security foundations**: 64-rule Semgrep config, Gitleaks configuration, Spectral OpenAPI linting

### Critical Gaps
- No PR-time Docker image build validation — build failures only surface in Konflux
- No coverage enforcement — coverage files are generated but never gated
- No container vulnerability scanning in CI
- No envtest-based integration tests for the controller

### Agent Rules Status: **Present and Comprehensive**
- Detailed AGENTS.md with repo structure, build/test commands, codegen rules, testing conventions, PR guidelines, and risk analysis scale
- CLAUDE.md references AGENTS.md (single source)
- No `.claude/rules/` directory with per-test-type rules

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Strong Go unit tests for both API and controller with >1:1 test-to-code ratio |
| Integration/E2E | 8.0/10 | Comprehensive pytest E2E suite with Prow integration and full cluster deployment |
| **Build Integration** | **5.0/10** | **Kustomize + codegen validation on PR, but no Docker build or Konflux simulation** |
| Image Testing | 4.5/10 | Multi-stage Dockerfiles with Konflux variants but no PR-time image build/runtime validation |
| Coverage Tracking | 5.0/10 | Coverage artifacts uploaded but no codecov integration or threshold enforcement |
| CI/CD Automation | 8.5/10 | Well-organized workflows with path filtering, concurrency, caching, OpenAPI validation |
| Agent Rules | 8.0/10 | Comprehensive AGENTS.md, missing per-test-type .claude/rules/ |

## Critical Gaps

### 1. No PR-time Docker Image Build Validation
- **Impact**: Dockerfile syntax errors, missing COPY sources, or dependency issues are discovered only after merge when Konflux attempts to build the production image. Developers get no early feedback.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Both `maas-api/Dockerfile` and `maas-controller/Dockerfile` are multi-stage builds. `Dockerfile.konflux` variants exist with pinned digest references. Neither is built during PR CI.

### 2. No Coverage Enforcement or Threshold
- **Impact**: Test coverage can silently regress. Both `maas-api-ci.yml` and `maas-controller-ci.yml` generate `coverage.out` and upload it as an artifact, but no tool analyzes, reports, or gates on coverage.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Makefiles generate `coverage.out` and `coverage.html` via `go test -coverprofile`. Adding Codecov integration with a minimum threshold would close this gap.

### 3. No Container Vulnerability Scanning
- **Impact**: CVEs in `ubi9/go-toolset` or `ubi9/ubi-minimal` base images, or in Go module dependencies, are not detected in CI. Scanning happens only downstream in Konflux.
- **Severity**: HIGH
- **Effort**: 2-3 hours

### 4. No envtest Integration Tests for Controller
- **Impact**: Controller reconciliation logic (Tenant, MaaSModelRef, MaaSAuthPolicy, MaaSSubscription, ExternalModel) is tested only via unit tests with mocked clients. Subtle bugs in API server interaction, status updates, or finalizer behavior may escape.
- **Severity**: MEDIUM
- **Effort**: 8-16 hours

### 5. No Pre-commit Hooks
- **Impact**: Lint failures, formatting issues, and accidental secrets are caught only in CI (adding 2-5 minutes turnaround). No `.pre-commit-config.yaml` exists despite Gitleaks and golangci-lint being configured.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours

## Quick Wins

### 1. Add Codecov Integration (2-3 hours)
- **Impact**: PR-level coverage reporting and threshold enforcement
- **Implementation**: Add `.codecov.yml` with per-component coverage targets; update CI workflows to upload `coverage.out` to Codecov:
```yaml
# Add to maas-api-ci.yml and maas-controller-ci.yml test job
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v5
  with:
    files: ${{ env.PROJECT_DIR }}/coverage.out
    flags: ${{ env.PROJECT_DIR }}
    fail_ci_if_error: true
```

### 2. Add Trivy Scanning (1-2 hours)
- **Impact**: Early CVE detection for base images and dependencies
- **Implementation**: Add a Trivy scan step or dedicated workflow:
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    scan-type: 'fs'
    scan-ref: '.'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'
```

### 3. Add Pre-commit Hooks (2-3 hours)
- **Impact**: Catch issues before push, reducing CI churn
- **Implementation**: Create `.pre-commit-config.yaml`:
```yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
  - repo: https://github.com/adrienverge/yamllint
    rev: v1.35.1
    hooks:
      - id: yamllint
        args: [--strict]
```

### 4. Add PR-time Docker Build (3-4 hours)
- **Impact**: Catch Dockerfile and build issues before merge
- **Implementation**: Add build steps to existing CI workflows:
```yaml
- name: Build maas-api image
  run: docker build -f maas-api/Dockerfile maas-api/
- name: Build maas-controller image
  run: docker build -f maas-controller/Dockerfile .
```

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory (10 workflows)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build-test.yml` | PR (path-filtered) + push to main | Kustomize manifest validation, codegen verification |
| `maas-api-ci.yml` | PR (maas-api/**) | Go lint + unit tests with coverage |
| `maas-controller-ci.yml` | PR (maas-controller/**) | Go lint + unit tests with coverage |
| `openapi-validation.yml` | PR + push (openapi3.yaml) | Spectral lint, breaking change detection, changelog check |
| `pr-title-validation.yml` | PR (all) | Semantic PR title format enforcement |
| `create-release.yml` | Manual dispatch | Release branch, tag, image build, doc deploy |
| `promote-main-to-stable.yml` | Manual | Promote main to stable branch |
| `promote-stable-to-rhoai.yml` | Manual | Promote stable to rhoai branch |
| `docs.yml` | Push to main (docs/**) | Documentation deployment |
| `update-docs-latest.yml` | Manual | Update docs "latest" alias |

**Strengths**:
- Path-filtered triggers avoid unnecessary CI runs
- Concurrency control with `cancel-in-progress: true` on build-test workflow
- Go module caching (`cache-dependency-path`) in all Go workflows
- Pinned action SHAs (SHA-pinned `actions/checkout`, `actions/setup-go`, etc.)
- OpenAPI breaking change detection with `oasdiff` — excellent API governance
- Semantic PR title validation enforces conventional commits

**Gaps**:
- No PR-time Docker image build
- No periodic security scanning workflow
- No CodeQL or Semgrep workflow in CI (Semgrep config exists but isn't run in GitHub Actions)
- E2E tests not triggered on PR — only via Prow/manual dispatch

### Test Coverage

**Unit Tests (Go)**:

| Component | Test Files | Test LOC | Source LOC | Ratio |
|-----------|-----------|----------|------------|-------|
| maas-api | 14 files | 9,079 | 7,176 | 1.27:1 |
| maas-controller | 13 files | 8,507 | 9,329 | 0.91:1 |
| **Total** | **27 files** | **17,586** | **16,505** | **1.07:1** |

- Framework: Go `testing` + `gomega`/`testify`
- Race detection enabled (`-race` flag)
- Coverage profiling enabled (`-coverprofile=coverage.out`)
- HTML coverage reports generated

**E2E Tests (Python/pytest)**:

| Test File | Focus Area |
|-----------|-----------|
| `test_smoke.py` | Health check, token replacement, model catalog |
| `test_api_keys.py` | API key CRUD, rotation, inference (~1492 LOC) |
| `test_subscription.py` | Subscription lifecycle |
| `test_subscription_list_endpoints.py` | Subscription list APIs |
| `test_models_endpoint.py` | Model catalog endpoints |
| `test_tenant.py` | Tenant management |
| `test_config_tenant.py` | Config-based tenant setup |
| `test_namespace_scoping.py` | Cross-namespace security |
| `test_negative_security.py` | Negative security scenarios |
| `test_external_oidc.py` | External OIDC integration |
| `test_external_models.py` | External model registration |

- **Total**: ~9,807 lines across 13 Python files (including conftest + helper)
- **Infrastructure**: Full Prow deployment script (39KB, ~800 lines) that installs cert-manager, LWS, ODH, KServe, deploys MaaS, creates test fixtures, and runs pytest
- **Customizable**: Supports custom images (`MAAS_API_IMAGE`, `MAAS_CONTROLLER_IMAGE`, `OPERATOR_CATALOG`), TLS toggle, external OIDC

### Code Quality

**Linting**:
- **golangci-lint v2.6.2** — latest version, configured in both modules
- **maas-api**: `default: all` with 21 disabled linters, aggressive checks enabled (errcheck type assertions, exhaustive switch, gocritic, import aliasing)
- **maas-controller**: `default: all` with 28 disabled linters, slightly more relaxed

**Static Analysis**:
- **Semgrep**: 64 rules in unified `semgrep.yaml` covering Go, Python, TypeScript, YAML, and generic secrets detection — but **not run in CI** (no GitHub Actions workflow)
- **Spectral**: OpenAPI linting with custom MaaS-specific rules
- **Gitleaks**: Configured with comprehensive allowlists for test data

**Missing**:
- No `.pre-commit-config.yaml`
- No CodeQL workflow
- Semgrep config exists but is not wired into CI

### Container Images

**Dockerfiles**:

| File | Base | Features |
|------|------|----------|
| `maas-api/Dockerfile` | UBI9 go-toolset → UBI9 minimal | Multi-stage, FIPS (`GOEXPERIMENT=strictfipsruntime`), non-root, multi-arch args |
| `maas-api/Dockerfile.konflux` | UBI9 (pinned SHA digests) | Same as above + Red Hat labels, pinned base images |
| `maas-controller/Dockerfile` | UBI9 go-toolset → UBI9 minimal | Multi-stage, FIPS, embeds deployment manifests + API deploy dirs |
| `maas-controller/Dockerfile.konflux` | UBI9 (pinned SHA digests) | Konflux-specific with Red Hat labels |

**Strengths**:
- Multi-stage builds reduce image size
- Non-root user (UID 1001) with OpenShift-compatible permissions
- FIPS-compliant builds via `GOEXPERIMENT=strictfipsruntime`
- Konflux variants with pinned SHA digests for reproducibility
- Red Hat labeling for RHOAI product compliance

**Gaps**:
- No PR-time image build validation
- No image startup test (e.g., container runs and responds to health check)
- No vulnerability scanning (Trivy/Snyk) in CI
- No multi-architecture build testing (args present but not tested)
- No SBOM generation

### Security

| Tool | Status | Notes |
|------|--------|-------|
| Gitleaks | ✅ Configured | `.gitleaks.toml` with comprehensive allowlists |
| Semgrep | ⚠️ Config only | 64 rules in `semgrep.yaml` but not run in CI |
| Spectral | ✅ Active | OpenAPI validation in CI with custom rules |
| CodeQL | ❌ Missing | No SAST workflow |
| Trivy/Snyk | ❌ Missing | No container scanning |
| SBOM | ❌ Missing | No software bill of materials |
| Secret detection | ✅ Configured | Gitleaks (config only, not in CI as a workflow) |
| FIPS | ✅ Active | `strictfipsruntime` in all Go builds |
| Non-root containers | ✅ Active | UID 1001 in all Dockerfiles |

### Agent Rules (Agentic Flow Quality)

- **Status**: Present and comprehensive
- **CLAUDE.md**: References `AGENTS.md` via `@AGENTS.md`
- **AGENTS.md** (5,616 bytes): Detailed rules covering:
  - Repository structure and two-module architecture
  - CRD types and API group
  - Build/test commands for both modules
  - Codegen rules (when to regenerate CRDs, RBAC, deepcopy)
  - Kustomize deployment patterns
  - PR title format (semantic commits)
  - PR review process (CodeRabbitAI)
  - Risk analysis guidelines with 0-5 scale
  - Testing conventions (Go testing + gomega/testify, pytest E2E)
  - Documentation policy (search before writing, no duplicates)
  - Things to never do (no root go.mod, no guessing image tags, no hand-editing generated files)
- **Gaps**:
  - No `.claude/rules/` directory with per-test-type rules
  - No explicit unit test pattern templates or examples
  - No E2E test creation guidance beyond "pytest under `test/e2e/tests/`"

## Recommendations

### Priority 0 (Critical)

1. **Add Codecov integration with coverage thresholds** — Coverage is already generated; wire it to Codecov with per-component minimums (60-70%) and fail-on-regression. Prevents silent quality erosion. (2-3 hours)

2. **Add container vulnerability scanning to CI** — Add Trivy FS scan to PR workflows and periodic image scan. Base images (UBI9) receive frequent CVEs. (2-3 hours)

3. **Add PR-time Docker image build validation** — Add `docker build` steps to `build-test.yml` or component CI workflows. Catches Dockerfile issues before merge. (4-6 hours)

### Priority 1 (High Value)

4. **Wire Semgrep into CI** — The 64-rule `semgrep.yaml` already exists but isn't run in GitHub Actions. Add a simple workflow to run on PRs. (1-2 hours)

5. **Add envtest integration tests for maas-controller** — Test reconciliation loops against a real API server (via controller-runtime envtest). Catches status update bugs, finalizer issues, and RBAC misconfigurations that unit mocks miss. (8-16 hours)

6. **Add pre-commit hooks** — Wire Gitleaks, golangci-lint fmt, and yamllint into `.pre-commit-config.yaml`. Catches issues before push. (2-3 hours)

7. **Add contract tests between maas-api and maas-controller** — Validate that the CRD schemas the API assumes match what the controller generates. Prevents schema drift. (4-8 hours)

### Priority 2 (Nice-to-Have)

8. **Add `.claude/rules/` with per-test-type rules** — Create unit-test, integration-test, and e2e-test rules with framework-specific patterns and checklists. Use `/test-rules-generator`. (2-3 hours)

9. **Add multi-architecture image build testing** — Dockerfiles have `BUILDPLATFORM`/`TARGETPLATFORM` args but no CI validation for arm64. (3-4 hours)

10. **Add image startup validation** — Build image, start container, verify health endpoint responds. (2-3 hours)

11. **Add performance tests for maas-api** — Load testing for model catalog, subscription, and API key endpoints. (8-12 hours)

12. **Add SBOM generation** — Syft or similar for software bill of materials in release builds. (2-3 hours)

## Comparison to Gold Standards

| Dimension | models-as-a-service | odh-dashboard | notebooks | kserve |
|-----------|-------------------|---------------|-----------|--------|
| Unit test ratio | ✅ 1.07:1 | ✅ >1:1 | ⚠️ Low | ✅ >1:1 |
| E2E automation | ✅ Prow script | ✅ Cypress CI | ✅ 5-layer | ✅ Multi-version |
| Coverage enforcement | ❌ None | ✅ Codecov | ⚠️ Partial | ✅ Enforced |
| PR image build | ❌ None | ✅ Build + deploy | ✅ Full test | ⚠️ Partial |
| Vulnerability scanning | ❌ None | ✅ Trivy | ✅ Trivy | ⚠️ Periodic |
| Pre-commit hooks | ❌ None | ✅ Active | ⚠️ Partial | ✅ Active |
| OpenAPI governance | ✅ Spectral + oasdiff | N/A | N/A | ✅ Active |
| Agent rules | ✅ AGENTS.md | ✅ .claude/rules/ | ⚠️ Basic | ❌ None |
| Semgrep/SAST | ⚠️ Config only | ✅ CI integrated | ⚠️ Partial | ✅ CodeQL |
| Contract tests | ❌ None | ✅ API contracts | N/A | ⚠️ Partial |
| envtest | ❌ None | N/A | N/A | ✅ Active |
| FIPS compliance | ✅ Active | ⚠️ Partial | ⚠️ Partial | ❌ None |

## File Paths Reference

### CI/CD
- `.github/workflows/build-test.yml` — Kustomize validation, codegen verification
- `.github/workflows/maas-api-ci.yml` — API lint + unit tests
- `.github/workflows/maas-controller-ci.yml` — Controller lint + unit tests
- `.github/workflows/openapi-validation.yml` — Spectral lint, breaking changes, changelog
- `.github/workflows/pr-title-validation.yml` — Semantic PR title enforcement
- `.github/workflows/create-release.yml` — Release automation

### Testing
- `maas-api/internal/**/*_test.go` — API unit tests (14 files)
- `maas-controller/pkg/**/*_test.go` — Controller unit tests (13 files)
- `test/e2e/tests/` — E2E test suite (11 test files + conftest + helper)
- `test/e2e/scripts/prow_run_smoke_test.sh` — Full deployment + E2E runner

### Code Quality
- `maas-api/.golangci.yml` — API linter config (default: all, 21 disabled)
- `maas-controller/.golangci.yml` — Controller linter config (default: all, 28 disabled)
- `semgrep.yaml` — 64 security rules (not wired into CI)
- `.spectral.yml` — OpenAPI linting rules
- `.gitleaks.toml` — Secret detection config

### Container Images
- `maas-api/Dockerfile` — API image (multi-stage, FIPS, non-root)
- `maas-api/Dockerfile.konflux` — API Konflux image (pinned digests)
- `maas-controller/Dockerfile` — Controller image (multi-stage, FIPS, embeds manifests)
- `maas-controller/Dockerfile.konflux` — Controller Konflux image

### Agent Rules
- `AGENTS.md` — Comprehensive agent instructions (5.6KB)
- `CLAUDE.md` — References AGENTS.md

### API Specification
- `maas-api/openapi3.yaml` — OpenAPI 3 specification (961 lines)
