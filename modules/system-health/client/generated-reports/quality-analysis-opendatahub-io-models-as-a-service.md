---
repository: "opendatahub-io/models-as-a-service"
overall_score: 7.4
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Excellent test-to-code ratio (1.29:1), 50 test files with race detection and coverage profiling"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "22 pytest E2E tests covering multi-tenant isolation, security, OIDC, and full deployment validation"
  - dimension: "Build Integration"
    score: 8.0
    status: "Tekton/Konflux PR builds, Kustomize validation, CRD codegen verification, operator chaos testing"
  - dimension: "Image Testing"
    score: 5.5
    status: "Multi-stage UBI9 builds with FIPS compliance, but no vulnerability scanning or runtime validation"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "Coverage profiling and HTML reports generated but no codecov integration or thresholds"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "14 GitHub Actions + 9 Tekton pipelines with path-scoped triggers, chaos testing, API breaking change detection"
  - dimension: "Agent Rules"
    score: 7.0
    status: "Comprehensive AGENTS.md with repo structure, commands, and conventions; missing .claude/rules/"
critical_gaps:
  - title: "No container vulnerability scanning in CI"
    impact: "CVEs in base images or dependencies not caught until production scanning"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No coverage thresholds or codecov integration"
    impact: "Test coverage can regress silently without enforcement; no PR-level coverage feedback"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Security scanners configured but not wired into CI"
    impact: "Semgrep rules and Gitleaks config exist but never run in PR/push workflows"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No SBOM generation or image signing"
    impact: "Supply chain security gap; cannot verify image provenance or contents"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add Trivy scanning to PR workflows"
    effort: "1-2 hours"
    impact: "Catch container vulnerabilities before merge"
  - title: "Wire Semgrep into CI"
    effort: "1 hour"
    impact: "Activate existing security rules that are already written and maintained"
  - title: "Add codecov integration with threshold"
    effort: "2-3 hours"
    impact: "Prevent coverage regression and provide PR-level coverage feedback"
  - title: "Add Gitleaks CI workflow"
    effort: "1 hour"
    impact: "Activate existing secret detection config in CI pipeline"
  - title: "Create .claude/rules/ for test patterns"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality with framework-specific patterns"
recommendations:
  priority_0:
    - "Add Trivy or Snyk container scanning to PR workflows for both maas-api and maas-controller images"
    - "Wire existing Semgrep rules and Gitleaks config into GitHub Actions CI workflows"
    - "Add codecov integration with minimum coverage threshold (e.g., 70%) and PR reporting"
  priority_1:
    - "Add SBOM generation (syft/cyclonedx) and image signing (cosign) to Tekton push pipelines"
    - "Create .claude/rules/ with unit-tests.md, e2e-tests.md, and controller-tests.md for AI-assisted test creation"
    - "Add pre-commit hooks for golangci-lint, gitleaks, and semgrep"
  priority_2:
    - "Add local Kind/Minikube E2E tests in GitHub Actions for faster PR feedback"
    - "Add performance/load testing for the maas-api inference proxy endpoints"
    - "Add contract tests between maas-api and maas-controller components"
---

# Quality Analysis: models-as-a-service

## Executive Summary

- **Overall Score: 7.4/10**
- **Repository Type**: Kubernetes operator + HTTP API service (Go monorepo)
- **Primary Language**: Go 1.25 with Python E2E tests
- **Framework**: controller-runtime, Gateway API, Kustomize

**Key Strengths:**
- Exceptional test-to-code ratio (1.29:1) with 26K+ lines of Go tests and 13K+ lines of E2E tests
- Sophisticated CI/CD with 14 GitHub Actions workflows + 9 Tekton pipelines
- Industry-leading operator chaos testing with CRD schema diffing and knowledge model validation
- Comprehensive OpenAPI validation with breaking change detection (oasdiff)
- Multi-branch promotion pipeline (main → stable → rhoai) with conflict detection

**Critical Gaps:**
- Security scanners (Semgrep, Gitleaks) are configured but never run in CI
- No container vulnerability scanning (Trivy/Snyk) in any workflow
- No coverage thresholds or codecov integration despite generating coverage reports
- No SBOM generation or image signing

**Agent Rules Status:** Present and useful (AGENTS.md), but incomplete (no `.claude/rules/` for test patterns)

---

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Excellent ratio, race detection, coverage profiling |
| Integration/E2E | 8.5/10 | 22 comprehensive pytest E2E tests with full deployment |
| **Build Integration** | **8.0/10** | **Tekton PR builds, Kustomize validation, chaos testing** |
| Image Testing | 5.5/10 | UBI9 multi-stage + FIPS, no scanning or runtime validation |
| Coverage Tracking | 4.0/10 | Reports generated but no integration or enforcement |
| CI/CD Automation | 9.0/10 | Exceptional workflow coverage with operator chaos |
| Agent Rules | 7.0/10 | Comprehensive AGENTS.md, missing test-specific rules |

---

## Critical Gaps

### 1. No Container Vulnerability Scanning
- **Impact**: CVEs in UBI9 base images or Go dependencies not caught until production scanning
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Neither GitHub Actions nor Tekton pipelines run Trivy, Snyk, or any vulnerability scanner. The Konflux Dockerfiles use pinned digests (good), but new vulnerabilities in those digests go undetected.
- **Implementation**:
  ```yaml
  # Add to maas-api-ci.yml and maas-controller-ci.yml
  vulnerability-scan:
    runs-on: ubuntu-latest
    needs: [test]
    steps:
      - uses: actions/checkout@v5
      - name: Build image for scanning
        run: docker build -t scan-target:latest -f maas-api/Dockerfile maas-api/
      - name: Run Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'scan-target:latest'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
  ```

### 2. No Coverage Thresholds or Integration
- **Impact**: Test coverage can regress silently; no PR-level feedback on coverage changes
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Both modules generate `coverage.out` and `coverage.html`, uploaded as artifacts with 30-day retention. But there's no codecov/coveralls integration, no minimum threshold enforcement, and no PR comments showing coverage delta.

### 3. Security Scanners Configured but Not in CI
- **Impact**: Semgrep rules (`semgrep.yaml` — 60+ rules covering Go, Python, YAML, secrets) and Gitleaks config (`.gitleaks.toml`) exist but are never executed in any workflow
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: The repository has invested in creating comprehensive Semgrep security rules and a well-tuned Gitleaks config with proper test exclusions, but neither runs in CI. This is purely unrealized value.

### 4. No SBOM Generation or Image Signing
- **Impact**: Supply chain security gap; cannot verify image provenance or enumerate components
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: Images are built and pushed via Tekton but lack SBOM generation (syft/cyclonedx) and cosign signing. For a Red Hat product pipeline (rhoai branch), this is a notable gap.

---

## Quick Wins

### 1. Wire Semgrep into CI (1 hour)
The `semgrep.yaml` file already exists with comprehensive rules. Just add a workflow:
```yaml
name: Semgrep
on: [pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: returntocorp/semgrep-action@v1
        with:
          config: semgrep.yaml
```

### 2. Add Gitleaks CI Workflow (1 hour)
The `.gitleaks.toml` config already exists with proper test exclusions:
```yaml
name: Gitleaks
on: [pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
```

### 3. Add Codecov Integration (2-3 hours)
```yaml
# Add after test step in maas-api-ci.yml and maas-controller-ci.yml
- name: Upload to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: ${{ env.PROJECT_DIR }}/coverage.out
    flags: ${{ env.PROJECT_DIR }}
    fail_ci_if_error: true
```
Add `.codecov.yml`:
```yaml
coverage:
  status:
    project:
      default:
        target: 70%
    patch:
      default:
        target: 80%
```

### 4. Add Trivy Scanning (1-2 hours)
See implementation in Critical Gaps section above.

### 5. Create Agent Test Rules (2-3 hours)
Generate framework-specific test rules using `/test-rules-generator` for:
- Go unit tests (testing + gomega/testify patterns)
- Kubernetes controller tests (envtest/fake client patterns)
- Python E2E tests (pytest patterns with conftest)

---

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (14 GitHub Actions + 9 Tekton):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `maas-api-ci.yml` | PR (maas-api/) | Lint + test for API |
| `maas-controller-ci.yml` | PR (maas-controller/) | Lint + test for controller |
| `build-test.yml` | PR + push | Kustomize validation + codegen verify |
| `openapi-validation.yml` | PR + push | Spectral lint + oasdiff breaking changes |
| `pr-title-validation.yml` | PR | Semantic PR title enforcement |
| `operator-chaos.yml` | PR (controller paths) | Knowledge model + CRD schema diffing |
| `promote-main-to-stable.yml` | Weekly cron | Automated promotion PR |
| `promote-stable-to-rhoai.yml` | Manual dispatch | RHOAI promotion PR |
| `create-release.yml` | Manual | Release workflow |
| `docs.yml` | PR/push | Documentation build |
| `update-docs-latest.yml` | Push | Docs update |
| `update-payload-processing.yml` | Push | Payload processing update |

**Tekton Pipelines (Konflux):**
- PR pipelines for both maas-api and maas-controller (image build)
- Push pipelines for main and stable branches
- Group testing pipeline (`/group-test` comment trigger)
- Early-gate CI build + test (`/early-gate-test` comment trigger)

**Strengths:**
- Path-scoped triggers avoid unnecessary workflow runs
- Concurrency control on build jobs with cancel-in-progress
- Go module caching via actions/setup-go
- Pinned action SHAs for supply chain security
- Operator chaos testing is exceptional and unique — validates knowledge models, runs preflight checks, detects breaking CRD schema changes, and simulates upgrades
- OpenAPI breaking change detection with oasdiff err/warn ignore files
- Multi-branch promotion pipeline with merge conflict detection

**Gaps:**
- No security scanning workflows (despite having configs)
- No container image scanning in any workflow

### Test Coverage

**Go Unit Tests:**
- 50 test files across both modules
- 26,081 lines of test code vs 20,269 lines of source code (1.29:1 ratio — excellent)
- 85 non-test Go source files
- Race detection enabled (`-race` flag)
- Coverage profiling with HTML report generation

**maas-api test coverage areas:**
- API key management (store, service, keygen, handler)
- Auth (SAR admin checker, cached admin checker)
- Auth policy checker
- Config (TLS, cluster config, general config)
- Handlers (models)
- Logger (redaction)
- Metrics (server, recorder, prometheus)
- Middleware (request ID)
- Subscription (selector, handler)
- Token handler
- Models (discovery)
- CORS handling

**maas-controller test coverage areas:**
- All webhook validators (tenant namespace, subscription, auth policy, aitenant, gateway)
- Model naming (external model)
- All major controllers (tenant, self-deployment, providers, subscription, modelref, authpolicy)
- Cross-namespace operations
- Conflict detection
- Multitenancy
- Reconciler (external model)
- Platform context, patching, params, naming

**Controller tests extensively use:**
- `fake.NewClientBuilder` for Kubernetes API mocking
- `envtest` patterns with scheme registration
- Gomega matchers for assertions

**Python E2E Tests (22 files, 13,310 lines):**
- Smoke tests
- API key authentication
- Subscription management and listing
- Models endpoint validation
- Tenant lifecycle (create, config, namespace discovery)
- Multi-tenant isolation (auth, rate limits, subscriptions)
- Namespace scoping
- Negative security tests
- External OIDC integration
- External models
- Gateway-scoped auth policies
- AITenant lifecycle

**E2E Infrastructure:**
- Prow smoke test script with comprehensive deployment
- Environment-variable-driven configuration
- Supports custom images, OIDC, TLS, and namespace configuration
- Full operator + platform deployment automation

### Code Quality

**Linting:**
- golangci-lint v2 with `default: all` — both modules enable ALL linters by default with selective disabling
- maas-api: 21 disabled linters, 180 char line length, import ordering via gci
- maas-controller: 32 disabled linters, 220 char line length, comprehensive exclusion rules
- Both use `errcheck.check-type-assertions: true`, `nolintlint.require-specific: true`
- Formatter integration: gci, gofmt, goimports

**API Quality:**
- OpenAPI Spectral linting with custom rules
- oasdiff breaking change detection with ignore files
- API changelog verification

**PR Quality:**
- Semantic PR title enforcement (conventional commits)
- Operator chaos validation on controller changes

**Missing:**
- No pre-commit hooks (`.pre-commit-config.yaml` absent)
- Semgrep rules not in CI
- No CodeQL/SAST integration

### Container Images

**Build Process:**
- 4 Dockerfiles: regular + Konflux variants for both components
- Multi-stage builds: UBI9 go-toolset builder → UBI9 minimal runtime
- FIPS compliance: `GOEXPERIMENT=strictfipsruntime`
- Non-root user (1001) with OpenShift group permissions
- Build args for cross-compilation (`BUILDPLATFORM`/`TARGETPLATFORM`)
- Konflux Dockerfiles use pinned base image digests (good practice)
- Controller image embeds deployment manifests (maas-api/deploy, deployment components)

**Missing:**
- No vulnerability scanning (Trivy, Snyk, Grype)
- No SBOM generation
- No image signing or attestation
- No runtime startup validation in CI
- No multi-architecture manifest list (QEMU/buildx)

### Security

**Present:**
- `.gitleaks.toml` — comprehensive secret detection config with test exclusions
- `semgrep.yaml` — unified rules covering Go, Python, TypeScript, YAML, and generic patterns
- `.gitleaksignore` — for known false positives
- Input validation in CI scripts (base ref sanitization against injection)
- FIPS-compliant builds
- Pinned action SHAs in GitHub workflows
- Pinned base image digests in Konflux Dockerfiles
- Non-root containers
- `persist-credentials: false` in checkout actions

**Missing:**
- Neither Gitleaks nor Semgrep run in CI
- No CodeQL/GitHub Advanced Security
- No dependency scanning (Dependabot, Renovate, Snyk)
- No container vulnerability scanning
- No SBOM or image provenance

### Agent Rules (Agentic Flow Quality)

**Status**: Present (AGENTS.md) but incomplete
**Coverage**: Repository structure, build commands, PR process, testing conventions, documentation policy
**Quality**: AGENTS.md is comprehensive and actionable — one of the better agent instruction files in the ODH ecosystem

**AGENTS.md covers:**
- Repository structure table (controller, api, deployment, docs, e2e, scripts)
- CRD types and API group
- Build/test commands for both modules + Kustomize validation
- Codegen rules (when to regenerate, CI enforcement)
- Kustomize deployment details
- PR title format and review process (coderabbitai)
- Risk analysis template with severity scale
- Testing conventions (Go testing + gomega/testify, pytest E2E)
- Documentation policy (search-before-write, one source of truth)
- Explicit "things to never do" section

**CLAUDE.md**: Minimal — just references AGENTS.md

**Gaps:**
- No `.claude/` directory
- No `.claude/rules/` for test creation patterns
- No framework-specific test rules (Go unit test patterns, envtest patterns, pytest E2E patterns)
- No custom skills or workflows

---

## Recommendations

### Priority 0 (Critical)

1. **Wire existing security scanners into CI** — Semgrep and Gitleaks configs exist and are maintained; add GitHub Actions workflows to run them on PRs. Immediate value with minimal effort.

2. **Add container vulnerability scanning** — Add Trivy scanning to both PR workflows. Build images in CI and scan before merge.

3. **Add codecov integration with thresholds** — Connect existing coverage.out generation to codecov. Set project target at 70% and patch target at 80% to prevent regression.

### Priority 1 (High Value)

4. **Add SBOM generation and image signing** — Integrate syft for SBOM and cosign for signing into Tekton push pipelines. Critical for Red Hat product supply chain requirements.

5. **Create `.claude/rules/` test patterns** — Generate framework-specific rules using `/test-rules-generator`:
   - `unit-tests.md` — Go testing patterns with gomega/testify
   - `controller-tests.md` — envtest and fake client patterns
   - `e2e-tests.md` — pytest patterns with conftest fixtures

6. **Add pre-commit hooks** — Create `.pre-commit-config.yaml` with golangci-lint, gitleaks, and commit message validation to catch issues before push.

### Priority 2 (Nice-to-Have)

7. **Add local E2E tests in GitHub Actions** — Set up Kind cluster in a PR workflow for faster feedback than waiting for Tekton/Prow execution.

8. **Add performance/load testing** — Test maas-api inference proxy endpoints under load to establish baselines and detect regressions.

9. **Add contract tests** — Test the API boundary between maas-api and maas-controller components to catch integration issues early.

10. **Add CodeQL/GitHub Advanced Security** — Complement Semgrep with CodeQL for deeper semantic analysis and dependency vulnerability alerts.

---

## Comparison to Gold Standards

| Dimension | models-as-a-service | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|-----------|--------------------|--------------------|-----------------|--------------|
| Unit Tests | 8.5 — 1.29:1 ratio | 9.0 — Multi-layer | 7.0 — Script-based | 9.0 — Comprehensive |
| Integration/E2E | 8.5 — 22 pytest tests | 9.5 — Cypress + contract | 6.0 — Manual | 9.0 — Multi-version |
| Build Integration | 8.0 — Tekton + chaos | 8.0 — Konflux | 7.0 — Basic | 7.0 — Basic |
| Image Testing | 5.5 — FIPS, no scanning | 7.0 — Basic scanning | 9.0 — 5-layer validation | 6.0 — Basic |
| Coverage Tracking | 4.0 — Reports only | 8.0 — Codecov enforced | 5.0 — Basic | 9.0 — Enforced |
| CI/CD Automation | 9.0 — Chaos + oasdiff | 9.0 — Comprehensive | 8.0 — Matrix builds | 8.0 — Multi-version |
| Security | 5.0 — Configs, not in CI | 7.0 — CodeQL + scanning | 6.0 — Basic scanning | 7.0 — SAST |
| Agent Rules | 7.0 — Good AGENTS.md | 8.0 — Rules + skills | 3.0 — Minimal | 4.0 — Basic |

**Notable Differentiators for models-as-a-service:**
- Operator chaos testing is unique and industry-leading among ODH repos
- OpenAPI breaking change detection with oasdiff is best-in-class
- Multi-branch promotion pipeline (main → stable → rhoai) is well-designed
- Knowledge model validation and CRD schema diffing are exceptional

---

## File Paths Reference

### CI/CD
- `.github/workflows/maas-api-ci.yml` — API lint + test
- `.github/workflows/maas-controller-ci.yml` — Controller lint + test
- `.github/workflows/build-test.yml` — Kustomize + codegen validation
- `.github/workflows/openapi-validation.yml` — Spectral + oasdiff
- `.github/workflows/operator-chaos.yml` — Chaos testing
- `.github/workflows/pr-title-validation.yml` — Semantic PR titles
- `.github/workflows/promote-main-to-stable.yml` — Weekly promotion
- `.github/workflows/promote-stable-to-rhoai.yml` — RHOAI promotion
- `.tekton/` — 9 Tekton pipeline definitions

### Testing
- `maas-api/internal/*/` — 19 Go unit test files
- `maas-controller/pkg/*/` — 30 Go unit test files (envtest patterns)
- `test/e2e/tests/` — 22 Python E2E test files
- `test/e2e/scripts/prow_run_smoke_test.sh` — Full deployment + E2E

### Code Quality
- `maas-api/.golangci.yml` — API linter config (all linters enabled)
- `maas-controller/.golangci.yml` — Controller linter config
- `.spectral.yml` — OpenAPI linting rules
- `semgrep.yaml` — Security rules (not in CI)
- `.gitleaks.toml` — Secret detection config (not in CI)

### Container Images
- `maas-api/Dockerfile` — API image (UBI9 + FIPS)
- `maas-api/Dockerfile.konflux` — API Konflux image (pinned digests)
- `maas-controller/Dockerfile` — Controller image
- `maas-controller/Dockerfile.konflux` — Controller Konflux image

### Agent Rules
- `AGENTS.md` — Comprehensive agent instructions
- `CLAUDE.md` — Minimal (references AGENTS.md)

### Deployment
- `deployment/` — Kustomize manifests (base, overlays, components)
- `scripts/ci/validate-manifests.sh` — Kustomize validation script
- `chaos/knowledge/maas.yaml` — Operator chaos knowledge model
