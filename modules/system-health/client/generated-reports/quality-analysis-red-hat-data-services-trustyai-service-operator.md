---
repository: "red-hat-data-services/trustyai-service-operator"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Excellent test-to-code ratio (~1:1) with Ginkgo+envtest across all 6 controllers"
  - dimension: "Integration/E2E"
    score: 7.5
    status: "Kind-based smoke tests on PRs with CRD deployment, plus operator-chaos upgrade validation"
  - dimension: "Build Integration"
    score: 6.0
    status: "PR builds Docker image and deploys to Kind, but no Konflux simulation or multi-mode build testing"
  - dimension: "Image Testing"
    score: 5.0
    status: "6 Dockerfiles with multi-stage builds and Konflux variants, but no runtime validation or startup testing"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "cover.out generated locally but no Codecov/Coveralls integration or PR enforcement"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "8 well-organized workflows with tiered naming, security scanning, policy checks, and chaos testing"
  - dimension: "Agent Rules"
    score: 7.0
    status: "Comprehensive CLAUDE.md with architecture, build, test, and deployment docs; no .claude/rules/ directory"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Coverage regressions go unnoticed; no PR gating on coverage thresholds"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container image runtime validation"
    impact: "Image startup failures and runtime issues not caught until deployment to staging/production"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No PR-time Konflux build simulation"
    impact: "Konflux-specific build failures (FIPS mode, pinned digests) discovered only post-merge"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "Missing Go linter configuration"
    impact: "Only go fmt and go vet run; no golangci-lint with extended checks (errcheck, staticcheck, etc.)"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add Codecov integration to controller-tests workflow"
    effort: "2-3 hours"
    impact: "PR coverage reporting and threshold enforcement; immediate visibility into coverage trends"
  - title: "Add golangci-lint configuration"
    effort: "1-2 hours"
    impact: "Catch common Go bugs (unchecked errors, shadowed variables, inefficient code) at PR time"
  - title: "Add container startup validation to smoke test"
    effort: "2-3 hours"
    impact: "Verify all 6 Dockerfile images can start and respond to health checks"
  - title: "Create .claude/rules/ for test patterns"
    effort: "2-3 hours"
    impact: "Standardize AI-generated tests to match existing Ginkgo+envtest patterns"
recommendations:
  priority_0:
    - "Add Codecov/Coveralls integration with coverage threshold enforcement (e.g., 60% minimum)"
    - "Add golangci-lint with a comprehensive linter set to CI pipeline"
  priority_1:
    - "Add container runtime validation — test that all 6 images start and respond to health/ready probes"
    - "Add PR-time Konflux build simulation for the operator and driver images"
    - "Create .claude/rules/ directory with Ginkgo+envtest test creation patterns"
  priority_2:
    - "Add pre-commit hooks for go fmt, go vet, and YAML lint"
    - "Add multi-architecture build validation (arm64) to PR workflow"
    - "Add SBOM generation and image signing for release images"
---

# Quality Analysis: trustyai-service-operator

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Multi-service Kubernetes operator (Go, kubebuilder)
- **Primary Language**: Go 1.23
- **Framework**: controller-runtime v0.22.5, kubebuilder
- **Services Managed**: 6 (TAS, LMES, EvalHub, GORCH, NemoGuardrails, JobMgr)

**Key Strengths:**
- Exceptional test-to-code ratio (~1:1 with 21K test lines vs 21K source lines)
- Sophisticated CI pipeline with tiered workflows (Tier 1: fast checks, Tier 2: deployment tests)
- Shift-left upgrade validation via operator-chaos (CRD schema diff, knowledge model validation)
- OPA/Conftest policy enforcement across all 9 kustomize overlays
- Dual security scanning (Gosec SAST + Trivy filesystem scan) on every PR
- Comprehensive CLAUDE.md with full architecture documentation

**Critical Gaps:**
- No coverage tracking or enforcement (cover.out generated but not uploaded/reported)
- No container image runtime validation for any of the 6 Dockerfiles
- No golangci-lint — only basic `go fmt` and `go vet`
- No `.claude/rules/` directory for test automation patterns

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Excellent Ginkgo+envtest coverage across all 6 controllers |
| Integration/E2E | 7.5/10 | Kind-based smoke tests + operator-chaos upgrade validation |
| **Build Integration** | **6.0/10** | **PR builds and deploys to Kind, but no Konflux simulation** |
| Image Testing | 5.0/10 | 6 multi-stage Dockerfiles but no runtime validation |
| Coverage Tracking | 3.0/10 | cover.out generated locally, no CI integration |
| CI/CD Automation | 8.5/10 | 8 well-organized tiered workflows with security scanning |
| Agent Rules | 7.0/10 | Comprehensive CLAUDE.md but no .claude/rules/ |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: Coverage regressions are invisible; contributors cannot see coverage impact of their PRs
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The `make test` target generates `cover.out` but it is never uploaded to Codecov/Coveralls. No coverage thresholds are enforced. No PR comments showing coverage changes.
- **Fix**: Add Codecov GitHub Action step to `controller-tests.yaml`:
  ```yaml
  - name: Upload coverage to Codecov
    uses: codecov/codecov-action@v4
    with:
      file: cover.out
      fail_ci_if_error: false
  ```

### 2. No Container Image Runtime Validation
- **Impact**: Startup failures, missing dependencies, or broken entrypoints in any of the 6 Dockerfiles not caught until deployment
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The smoke test builds and deploys the main operator image but does not validate the driver, LMES job, or orchestrator images. No health check validation beyond deployment readiness.

### 3. No Konflux Build Simulation at PR Time
- **Impact**: Konflux-specific build differences (FIPS mode with `CGO_ENABLED=1 GOEXPERIMENT=strictfipsruntime`, pinned base image digests) can cause post-merge build failures
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Details**: `Dockerfile` uses `CGO_ENABLED=0` while `Dockerfile.konflux` uses `CGO_ENABLED=1` with FIPS runtime. These different build modes are not tested in CI.

### 4. Missing Go Linter Configuration
- **Impact**: Common Go bugs (unchecked errors, variable shadowing, inefficient patterns) not caught at PR time
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: Only `go fmt` and `go vet` are used. No `.golangci.yaml` configuration. No golangci-lint in CI.

## Quick Wins

### 1. Add Codecov Integration (2-3 hours)
- **Impact**: Immediate coverage visibility and trend tracking
- **Implementation**: Add `codecov/codecov-action@v4` to `controller-tests.yaml`, create `.codecov.yml` with threshold config

### 2. Add golangci-lint (1-2 hours)
- **Impact**: Catch errcheck, staticcheck, gosimple, ineffassign, and other common issues
- **Implementation**: Create `.golangci.yaml` with recommended linters, add `golangci/golangci-lint-action` to a new workflow

### 3. Add Container Startup Validation (2-3 hours)
- **Impact**: Verify all images can start and respond to probes
- **Implementation**: Extend smoke test to build and start each Dockerfile variant in the Kind cluster

### 4. Create .claude/rules/ Test Patterns (2-3 hours)
- **Impact**: Standardize AI-generated tests to match existing Ginkgo+envtest conventions
- **Implementation**: Use `/test-rules-generator` to create rules from existing test patterns

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (8 workflows):**

| Workflow | Trigger | Tier | Purpose |
|----------|---------|------|---------|
| `controller-tests.yaml` | push, PR | Tier 1 | `make test` (Ginkgo+envtest) |
| `lint-yaml.yaml` | push, PR | Tier 1 | YAML linting on `config/**/*.yaml` |
| `conftest.yaml` | push, PR | Tier 1 | OPA policy checks across all overlays |
| `gosec.yaml` | PR | Tier 1 | Gosec SAST scan with SARIF upload |
| `security-scan.yaml` | PR, push | Tier 1 | Trivy filesystem scan (blocks on CRITICAL/HIGH) |
| `smoke.yaml` | PR | Tier 2 | Build image, deploy to Kind, run smoke tests |
| `operator-chaos.yml` | PR (path-filtered) | Tier 2 | CRD schema diff, knowledge model validation |
| `instant-merge.yaml` | PR opened | Auto | Auto-merge Konflux bot PRs for specific images |

**Strengths:**
- Well-organized tiered naming (Tier 1 = fast checks, Tier 2 = deployment)
- Path-filtered operator-chaos workflow avoids unnecessary runs
- Dual security scanning approach (SAST + dependency scan)
- Conftest validates all 9 kustomize overlays systematically
- Instant-merge for Konflux bot PRs reduces maintenance burden

**Gaps:**
- No concurrency control (`concurrency` group) on any workflow
- No dependency caching in workflows (Go module cache)
- No Go linting workflow (golangci-lint)
- Smoke test uses Kind v1.24.17 — significantly behind current (1.29+)
- No test result reporting (JUnit XML, test summaries)

### Test Coverage

**Test Infrastructure:**
- **Framework**: Ginkgo v2 + Gomega + controller-runtime envtest
- **Test files**: 45 `*_test.go` files
- **Test lines**: ~21,071 lines
- **Source lines**: ~21,490 lines
- **Test-to-code ratio**: 0.98:1 (excellent)
- **envtest suites**: 8 suite files bootstrapping K8s API server
- **Ginkgo test files**: 37 using Describe/Context/It patterns

**Coverage by Controller:**

| Controller | Test Files | Lines | Key Areas Tested |
|-----------|-----------|-------|-----------------|
| TAS | 9 | ~4,000 | Storage, routes, deployments, RBAC, monitoring |
| EvalHub | 18 | ~8,500 | MCP, deployments, configmaps, reconciliation, jobs |
| LMES | 4 | ~3,500 | Controller, validation, DSC config, driver |
| GORCH | 4 | ~2,200 | Controller, deployment, config generation |
| NemoGuardrails | 3 | ~800 | Controller, MCP gateway |
| Images | 2 | ~300 | Image resolver |

**Strengths:**
- Near 1:1 test-to-code ratio is exceptional for an operator
- All 6 controllers have dedicated test suites
- envtest provides realistic K8s API testing
- Tests cover both reconciliation logic and helper functions

**Gaps:**
- No coverage measurement or reporting in CI
- No coverage thresholds or enforcement
- No integration tests beyond smoke test
- No multi-version testing (single K8s version: 1.29.0)

### Code Quality

**Current Tools:**
- `go fmt` — code formatting
- `go vet` — static analysis (basic)
- `yamllint` — YAML linting with custom `.yamllint.yaml`
- `conftest/OPA` — policy-as-code for Kubernetes manifests
- `gosec` — Go security analysis (SARIF + GitHub Security tab)
- `dependabot` — weekly Go module updates

**Missing Tools:**
- No `.golangci.yaml` — no golangci-lint with extended linters
- No `.pre-commit-config.yaml` — no pre-commit hooks
- No CodeQL — only Gosec for SAST
- No gitleaks/TruffleHog — no secret detection

**OPA Policies (Standout Feature):**
The `policy/` directory contains custom Rego policies with unit tests:
- `rbac.rego` — closed allowlist of ClusterRoleBindings
- `clusterrole.rego` — inspects ClusterRole contents, blocks wildcards and privilege escalation
- `selector.rego` — validates label selectors
- All policies have corresponding `*_test.rego` files
- CI renders all 9 kustomize overlays and checks each against policies

### Container Images

**Dockerfile Inventory (7 files):**

| Dockerfile | Purpose | Base Image | Build Mode |
|-----------|---------|-----------|-----------|
| `Dockerfile` | Main operator | UBI9 Go 1.26 → UBI8 minimal | CGO_ENABLED=0 |
| `Dockerfile.konflux` | Konflux operator | UBI9 Go 1.26 (pinned digest) → UBI9 minimal (pinned) | CGO_ENABLED=1, FIPS |
| `Dockerfile.driver` | LMES driver | UBI9 Go 1.26 → UBI9 minimal | CGO_ENABLED=1, FIPS |
| `Dockerfile.konflux.driver` | Konflux driver | (Konflux variant) | CGO_ENABLED=1, FIPS |
| `Dockerfile.lmes-job` | LMES job runner | UBI9 Python 3.11 (pinned) | Python-based |
| `Dockerfile.orchestrator` | Guardrails orchestrator | Rust 1.87 → UBI9 minimal | Rust build w/ tests+lint |
| `tests/Dockerfile` | Test container | — | Test infrastructure |

**Strengths:**
- Multi-stage builds for all Go images
- Non-root execution (65532:65532)
- Konflux-specific variants with pinned digests and FIPS compliance
- Orchestrator Dockerfile includes test and lint stages
- Red Hat UBI base images throughout

**Gaps:**
- No runtime validation for any image
- No health check validation in CI
- No multi-architecture builds tested in CI (only in `make docker-buildx`)
- No SBOM generation
- No image signing/attestation
- No vulnerability scanning of built images (Trivy scans source only, not container)

### Security

**Current Security Practices:**
- Gosec SAST scanning on every PR (SARIF → GitHub Security tab)
- Trivy filesystem scanning (blocks on CRITICAL/HIGH vulnerabilities)
- OPA policies preventing RBAC privilege escalation
- Non-root container execution
- Dependabot for automated dependency updates
- FIPS compliance in Konflux builds

**Missing Security Practices:**
- No container image scanning (only filesystem scanning)
- No secret detection (gitleaks, TruffleHog)
- No CodeQL analysis
- No SBOM generation
- No image signing/provenance attestation

### Agent Rules (Agentic Flow Quality)

**Status**: CLAUDE.md present, no `.claude/` directory

**CLAUDE.md Quality**: Excellent (9/10)
- Comprehensive architecture documentation
- Build, test, and deployment instructions
- Service registration patterns documented
- Key dependencies listed with versions
- Reconciliation patterns explained
- CI/CD workflows described
- Code generation instructions included

**Gaps:**
- No `.claude/rules/` directory with test creation patterns
- No `AGENTS.md` for multi-agent workflows
- No test pattern examples for AI-assisted development
- No custom skills for operator-specific tasks

**Recommendation**: Generate test rules using `/test-rules-generator` to codify:
- Ginkgo+envtest suite setup patterns
- Controller test patterns (reconciliation, status updates, owner references)
- OPA policy test patterns
- Smoke test patterns for new CRDs

### Shift-Left Upgrade Validation (Standout Feature)

The operator-chaos integration is a standout practice:
- **Knowledge model** (`chaos/knowledge/trustyai.yaml`): Declarative description of operator's control plane topology
- **CRD schema diffing**: Detects breaking API changes at PR time
- **Upgrade simulation**: Dry-run upgrade path validation
- **Path filtering**: Only triggers when relevant files change

This is ahead of most operators in the ecosystem and prevents a class of upgrade failures that typically only surface in staging.

## Recommendations

### Priority 0 (Critical)

1. **Add Codecov integration with coverage thresholds**
   - Upload `cover.out` from controller-tests workflow
   - Set minimum threshold (60%) and PR diff threshold (5%)
   - Add `.codecov.yml` configuration
   - Effort: 2-3 hours

2. **Add golangci-lint to CI**
   - Create `.golangci.yaml` with: errcheck, staticcheck, gosimple, govet, ineffassign, unused, misspell
   - Add `golangci/golangci-lint-action` workflow
   - Effort: 2-3 hours

### Priority 1 (High Value)

3. **Add container runtime validation**
   - Build each Dockerfile variant in CI
   - Validate startup and health check response
   - Test FIPS build mode (Konflux variant)
   - Effort: 4-6 hours

4. **Add PR-time Konflux build simulation**
   - Build `Dockerfile.konflux` in CI to catch FIPS/digest issues early
   - Compare build artifacts between standard and Konflux builds
   - Effort: 8-12 hours

5. **Create .claude/rules/ for test patterns**
   - Codify Ginkgo+envtest patterns from existing tests
   - Include suite setup, reconciliation testing, and status update patterns
   - Effort: 2-3 hours

6. **Add concurrency control to workflows**
   - Add `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }` to all workflows
   - Prevents duplicate runs on rapid pushes
   - Effort: 30 minutes

### Priority 2 (Nice-to-Have)

7. **Add pre-commit hooks**
   - Configure `.pre-commit-config.yaml` with go fmt, go vet, yamllint, gitleaks
   - Effort: 1-2 hours

8. **Add Go module caching to workflows**
   - Add `actions/cache` for `~/go/pkg/mod` and `~/.cache/go-build`
   - Reduce CI run time
   - Effort: 30 minutes

9. **Upgrade Kind version in smoke tests**
   - Current: v1.24.17 (EOL)
   - Recommended: v1.29+ (matching envtest version)
   - Effort: 30 minutes

10. **Add SBOM generation and image signing**
    - Generate SBOM during container builds
    - Sign images with cosign/sigstore
    - Effort: 4-6 hours

11. **Add container image scanning**
    - Scan built images with Trivy (not just filesystem)
    - Effort: 1-2 hours

12. **Add multi-version K8s testing**
    - Test against K8s 1.28, 1.29, 1.30 in envtest
    - Effort: 2-3 hours

## Comparison to Gold Standards

| Dimension | trustyai-operator | odh-dashboard | notebooks | kserve |
|-----------|------------------|---------------|-----------|--------|
| Unit Tests | 8.5 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 7.5 | 9.0 | 8.0 | 9.0 |
| Build Integration | 6.0 | 7.0 | 8.0 | 7.0 |
| Image Testing | 5.0 | 7.0 | 9.0 | 6.0 |
| Coverage Tracking | 3.0 | 9.0 | 5.0 | 9.0 |
| CI/CD Automation | 8.5 | 9.0 | 8.0 | 9.0 |
| Agent Rules | 7.0 | 9.0 | 3.0 | 3.0 |
| **OPA Policies** | **9.0** | **N/A** | **N/A** | **N/A** |
| **Chaos Testing** | **8.5** | **N/A** | **N/A** | **N/A** |
| **Overall** | **7.6** | **8.5** | **7.0** | **7.5** |

**Notable differentiators**: The trustyai-service-operator leads the ecosystem in OPA policy enforcement and shift-left chaos testing. These practices are not found in any of the gold standard repositories and represent genuine innovation in operator quality assurance.

## File Paths Reference

### CI/CD
- `.github/workflows/controller-tests.yaml` — unit tests
- `.github/workflows/smoke.yaml` — smoke test (Kind deployment)
- `.github/workflows/conftest.yaml` — OPA policy checks
- `.github/workflows/gosec.yaml` — Gosec SAST
- `.github/workflows/security-scan.yaml` — Trivy scanning
- `.github/workflows/operator-chaos.yml` — upgrade validation
- `.github/workflows/lint-yaml.yaml` — YAML lint
- `.github/workflows/instant-merge.yaml` — auto-merge Konflux PRs

### Testing
- `controllers/*/suite_test.go` — envtest suite setup (8 files)
- `controllers/*/*_test.go` — controller unit tests (37 Ginkgo files)
- `tests/smoke/test_smoke.sh` — smoke test script
- `tests/crds/` — external CRDs for testing

### Policies
- `policy/rbac.rego` — ClusterRoleBinding allowlist
- `policy/clusterrole.rego` — ClusterRole content validation
- `policy/selector.rego` — label selector validation
- `policy/*_test.rego` — OPA unit tests

### Container Images
- `Dockerfile` — main operator (CGO=0)
- `Dockerfile.konflux` — Konflux operator (FIPS)
- `Dockerfile.driver` — LMES driver
- `Dockerfile.konflux.driver` — Konflux driver
- `Dockerfile.lmes-job` — LMES Python job
- `Dockerfile.orchestrator` — Guardrails orchestrator (Rust)

### Configuration
- `CLAUDE.md` — agent documentation
- `.yamllint.yaml` — YAML lint config
- `.github/dependabot.yml` — dependency updates
- `chaos/knowledge/trustyai.yaml` — operator-chaos knowledge model
- `Makefile` — build and test targets
