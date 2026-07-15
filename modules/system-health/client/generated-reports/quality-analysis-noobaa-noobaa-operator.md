---
repository: "noobaa/noobaa-operator"
overall_score: 5.6
scorecard:
  - dimension: "Unit Tests"
    score: 5.5
    status: "50 test files across 21 packages using Ginkgo/Gomega + stdlib, but test-to-code ratio is low (8.9K vs 49K lines) and no coverage tracking"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "Strong KMS integration tests on Kind/Minikube clusters, admission webhook tests, upgrade tests, but COSI tests disabled and no formal E2E suite"
  - dimension: "Build Integration"
    score: 4.0
    status: "PR builds image and runs unit tests but no Konflux simulation, no image startup validation, no manifest generation testing"
  - dimension: "Image Testing"
    score: 3.0
    status: "Dockerfile builds image but no runtime validation, no security scanning, no multi-arch support, no SBOM generation"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage generation, no codecov/coveralls integration, no coverage thresholds or PR reporting"
  - dimension: "CI/CD Automation"
    score: 7.5
    status: "24 workflows with 16 PR-triggered, good concurrency control and caching, nightly upgrade tests, but excessive workflow sprawl"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules for test automation guidance"
critical_gaps:
  - title: "No code coverage tracking or enforcement"
    impact: "Cannot measure test effectiveness, regressions go undetected, no visibility into coverage trends"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container security scanning"
    impact: "Vulnerabilities in base images and dependencies are never detected pre-merge"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No image runtime validation"
    impact: "Broken images discovered only at deployment time, not during PR review"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No SBOM generation or image signing"
    impact: "Cannot verify supply chain integrity; non-compliant with SLSA/Sigstore best practices"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "COSI integration tests disabled"
    impact: "COSI feature regressions are completely undetectable"
    severity: "MEDIUM"
    effort: "8-16 hours"
  - title: "No AI agent rules for test automation"
    impact: "AI-assisted development produces inconsistent, low-quality tests"
    severity: "LOW"
    effort: "2-3 hours"
quick_wins:
  - title: "Add Trivy scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Catch CVEs in base images and Go dependencies before merge"
  - title: "Add codecov integration with coverage generation"
    effort: "3-4 hours"
    impact: "Visibility into test coverage, PR-level coverage reporting, trend tracking"
  - title: "Add go test -coverprofile to make test-go target"
    effort: "30 minutes"
    impact: "Generate coverage data for every test run"
  - title: "Consolidate duplicate KMS test workflows"
    effort: "2-3 hours"
    impact: "Reduce CI maintenance burden from 7 near-identical workflows to 1 matrix job"
  - title: "Create basic CLAUDE.md with test patterns"
    effort: "1-2 hours"
    impact: "Guide AI-generated tests to follow existing Ginkgo/Gomega patterns"
recommendations:
  priority_0:
    - "Add code coverage tracking (go test -coverprofile) and integrate with Codecov"
    - "Add Trivy container scanning to the PR workflow"
    - "Add image startup validation test (docker run + healthcheck) to PR workflow"
  priority_1:
    - "Consolidate 7 KMS test workflows into a single matrix workflow"
    - "Re-enable COSI integration tests or document why disabled"
    - "Add multi-architecture image builds (arm64 support)"
    - "Add SBOM generation with Syft and image signing with Cosign"
  priority_2:
    - "Create CLAUDE.md and .claude/rules/ for test automation guidance"
    - "Add CodeQL or gosec for static security analysis"
    - "Remove legacy Travis CI configuration (.travis.yml, .travis/ directory)"
    - "Add Gitleaks for secret detection in PRs"
---

# Quality Analysis: noobaa-operator

## Executive Summary

- **Overall Score: 5.6/10**
- **Repository Type**: Kubernetes Operator (Go)
- **Primary Language**: Go (175 files, 57,965 total lines)
- **Test Framework**: Ginkgo v2 + Gomega (with some stdlib `testing`)
- **Key Strengths**: Extensive KMS integration testing on real clusters, good CI/CD automation with 16 PR-triggered workflows, concurrency control, Go module caching, pre-commit lint hooks
- **Critical Gaps**: Zero code coverage tracking, no container security scanning, no image runtime validation, no SBOM/signing, COSI tests disabled
- **Agent Rules Status**: Missing - No CLAUDE.md, no `.claude/` directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 5.5/10 | 50 test files, low test-to-code ratio (18%), no coverage tracking |
| Integration/E2E | 7.0/10 | Strong KMS tests on Kind/Minikube, admission webhooks, upgrade tests |
| **Build Integration** | **4.0/10** | **PR builds image but no Konflux simulation or startup validation** |
| Image Testing | 3.0/10 | Basic Dockerfile, no runtime validation, no scanning, no multi-arch |
| Coverage Tracking | 1.0/10 | No coverage generation, no codecov, no thresholds |
| CI/CD Automation | 7.5/10 | 24 workflows, 16 PR-triggered, good caching, but excessive sprawl |
| Agent Rules | 0.0/10 | No agent rules, no CLAUDE.md, no test automation guidance |

## Critical Gaps

### 1. No Code Coverage Tracking or Enforcement
- **Impact**: Cannot measure test effectiveness; regressions go undetected; no visibility into coverage trends across PRs
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The `make test-go` target runs `go test ./pkg/... ./cmd/... ./version/...` without `-coverprofile`. No `.codecov.yml` exists. No PR comments show coverage deltas.
- **Fix**: Add `-coverprofile=coverage.out` to the test command and integrate with Codecov GitHub App

### 2. No Container Security Scanning
- **Impact**: Vulnerabilities in `ubi9/ubi-minimal` base image and Go dependencies are never detected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Trivy, Snyk, Grype, or any container scanning tool is configured in any workflow. No `.trivyignore` exists.
- **Fix**: Add a Trivy scan step to the PR workflow after image build

### 3. No Image Runtime Validation
- **Impact**: Broken operator images are only discovered at deployment time
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The `testing.yml` workflow builds the image but does not validate it starts correctly. The admission test workflow does load and run the image in Minikube, providing partial coverage.

### 4. No SBOM Generation or Image Signing
- **Impact**: Supply chain integrity cannot be verified; non-compliant with SLSA best practices
- **Severity**: MEDIUM
- **Effort**: 4-6 hours

### 5. COSI Integration Tests Disabled
- **Impact**: COSI feature regressions are completely undetectable
- **Severity**: MEDIUM
- **Effort**: 8-16 hours
- **Details**: `run_cosi_test.yaml` has `on: []` with a TODO comment: "SHOULD BE RETURNED ONCE COSI IS BACK"

### 6. Legacy Travis CI Configuration
- **Impact**: Confusion about which CI system is authoritative; `.travis/` scripts are still used by GitHub Actions workflows
- **Severity**: LOW
- **Details**: `.travis.yml` references Go 1.16.x (very outdated) but `.travis/` helper scripts are actively used by GHA workflows (kind cluster setup, Vault install, etc.)

## Quick Wins

### 1. Add Coverage Generation (30 minutes)
```makefile
test-go: gen cli
	$(TIME) go test -coverprofile=coverage.out ./pkg/... ./cmd/... ./version/...
	@echo "Coverage report: coverage.out"
	@echo "done test-go"
```

### 2. Add Codecov Integration (2-3 hours)
```yaml
# Add to operator-tests.yml after "Run Tests"
- name: Upload Coverage
  uses: codecov/codecov-action@v4
  with:
    files: coverage.out
    flags: unittests
    fail_ci_if_error: false
```

### 3. Add Trivy Scanning (1-2 hours)
```yaml
# New workflow or add to operator-tests.yml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'noobaa/noobaa-operator:${{ env.VERSION }}'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
```

### 4. Consolidate KMS Workflows into Matrix (2-3 hours)
Replace 7 near-identical `run_kms_*.yml` workflows with a single matrix job:
```yaml
strategy:
  matrix:
    kms-type: [dev, tls-sa, tls-token, azure-vault, ibm-kp, kmip, rotate]
```

### 5. Create Basic Agent Rules (1-2 hours)
Create `CLAUDE.md` with existing test patterns (Ginkgo suites, table-driven tests, Kind/Minikube setup).

## Detailed Findings

### CI/CD Pipeline

**Strengths:**
- 24 total workflows, 16 triggered on push/pull_request
- All workflows use concurrency groups with `cancel-in-progress: true`
- Consistent Go module caching via `actions/setup-go@v5` with `cache: true`
- Nightly upgrade tests via `schedule` trigger
- Workflow composition: `upgrade-tests-workflow.yaml` is reusable via `workflow_call`
- 90-minute timeout on all jobs (consistent)

**Weaknesses:**
- **Workflow sprawl**: 7 KMS test workflows that are nearly identical (same setup, different Vault config)
- **No workflow organization**: Flat structure with no job reuse across KMS tests
- **Legacy Travis CI**: `.travis.yml` still present (Go 1.16.x), but `.travis/` scripts are actively used by GHA
- **No status checks enforcement**: No required checks configuration visible
- **OLM tests disabled**: `operator-olm-tests.yml` is `workflow_dispatch` only with TODO comment
- **`testing.yml` is misleading**: Named "Testing flows" but actually just validates core image tag update, not real testing

**Workflow Inventory:**

| Workflow | Trigger | Type |
|----------|---------|------|
| operator-tests.yml | push/PR | Unit tests |
| cli-tests.yml | push/PR | CLI integration |
| core-config-map-tests.yml | push/PR | Config tests |
| golangci-lint.yml | push/PR | Lint |
| run_admission_test.yml | push/PR | Integration (Minikube) |
| run_cnpg_deployment_test.yml | push/PR | Integration (Minikube) |
| run_kms_dev_test.yml | push/PR | KMS Integration (Kind) |
| run_kms_azure_vault_test.yml | push/PR | KMS Integration (Kind) |
| run_kms_ibm_kp_test.yml | push/PR | KMS Integration (Kind) |
| run_kms_kmip_test.yml | push/PR | KMS Integration (Kind) |
| run_kms_rotate_test.yml | push/PR | KMS Integration (Kind) |
| run_kms_tls_sa_test.yml | push/PR | KMS Integration (Kind) |
| run_kms_tls_token_test.yml | push/PR | KMS Integration (Kind) |
| testing.yml | push/PR | Image tag validation |
| nightly-upgrade-tests.yaml | schedule | Upgrade tests |
| run_cosi_test.yaml | DISABLED | COSI integration |
| operator-olm-tests.yml | dispatch | OLM tests |
| run_hac_test.yml | dispatch | HA tests |
| manual-upgrade-tests.yaml | dispatch | Manual upgrade |
| manual-build.yml | dispatch | Manual build |
| build-cnpg.yml | dispatch | CNPG build |
| releaser.yaml | dispatch | Release |
| update-noobaa-core-tag.yml | schedule | Core tag update |
| upgrade-tests-workflow.yaml | workflow_call | Reusable upgrade |

### Test Coverage

**Unit Tests (5.5/10):**
- 50 test files across 21 test packages
- 8,914 lines of test code vs 49,051 lines of production Go code
- **Test-to-code ratio: 18.2%** (below industry standard of 30-50%)
- Mix of Ginkgo/Gomega BDD-style and stdlib table-driven tests
- 16 Ginkgo test suites with proper suite setup files
- Good test isolation in package-level directories

**Integration Tests (7.0/10):**
- **KMS Integration**: 7 separate KMS provider tests (Vault dev, TLS-SA, TLS-token, Azure Vault, IBM KP, KMIP, key rotation) all running on Kind clusters with real infrastructure
- **Admission Webhook Tests**: Full Minikube deployment with operator install, admission controller setup, and webhook validation testing
- **CNPG Deployment Test**: Full Minikube deployment with NooBaa + CloudNative PostgreSQL
- **Upgrade Tests**: Nightly version upgrade tests with data persistence validation (S3 object put/get across upgrade)
- **CLI Tests**: Shell-based CLI flow testing via `test_cli_flow.sh`

**Gaps:**
- No formal E2E test directory structure
- COSI tests disabled (`on: []`)
- OLM tests disabled (dispatch-only with TODO)
- HAC tests dispatch-only
- No envtest usage for controller testing (all integration tests require full cluster)
- No contract testing between operator and noobaa-core

### Code Quality

**Linting (6.0/10):**
- golangci-lint v2.5.0 configured with `.golangci.yml`
- Runs on push/PR via dedicated workflow
- **Pre-commit hook**: Git hooks configured via `.githooks/` directory, running lint on staged Go files only
- Exclusions: Generated files (`zz_generated.go`, `pkg/apis/noobaa/v1alpha1`, `pkg/bundle`)
- Suppression: `ST1005` (capitalized error strings) allowed
- **Weakness**: Minimal linter configuration - relies mostly on defaults, does not enable additional linters like `errcheck`, `ineffassign`, `govet`

**Code Review:**
- CodeRabbit AI review configured (`.coderabbit.yaml`) with "chill" profile
- PR template exists but is minimal (167 bytes)
- No CODEOWNERS file detected

**Static Analysis:**
- No CodeQL, gosec, Semgrep, or any SAST tool
- No dependency scanning (Dependabot, Renovate)
- No secret detection (Gitleaks, TruffleHog)

### Container Images

**Build Process (4.0/10):**
- Single-stage Dockerfile based on `ubi9/ubi-minimal`
- Pre-compiled binary copied into image (built externally via Makefile)
- Dev Dockerfile with Delve debugger support
- Bundle Dockerfile for OLM
- KMIP test has its own Dockerfile (`pkg/util/kms/test/kmip/pykmip/Dockerfile`)

**Weaknesses:**
- No multi-architecture support (only `GOOS=linux GOARCH=amd64`)
- No container security scanning (Trivy, Snyk, Grype)
- No SBOM generation (Syft)
- No image signing (Cosign)
- No image startup validation in CI
- No `.trivyignore` for CVE management
- `tar` installed via `microdnf` without version pinning

### Security

**Overall Security Posture: Weak (2.0/10)**

| Practice | Status |
|----------|--------|
| Container scanning (Trivy/Snyk) | Not configured |
| SAST (CodeQL/gosec) | Not configured |
| Dependency scanning | Not configured |
| Secret detection (Gitleaks) | Not configured |
| SBOM generation | Not configured |
| Image signing | Not configured |
| Vulnerability thresholds | Not configured |
| Supply chain security (SLSA) | Not configured |

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **`.claude/` directory**: Not present
- **`.claude/rules/`**: Not present
- **Coverage**: No test type rules exist
- **Quality**: N/A
- **Gaps**: All test types lack AI agent guidance
- **Recommendation**: Generate rules with `/test-rules-generator` covering:
  - Ginkgo/Gomega unit test patterns
  - Table-driven stdlib test patterns
  - Kind/Minikube integration test setup
  - KMS test infrastructure patterns
  - CLI shell test patterns

## Recommendations

### Priority 0 (Critical)

1. **Add code coverage tracking** - Add `-coverprofile=coverage.out` to `make test-go`, integrate Codecov, set minimum threshold at current baseline
2. **Add Trivy container scanning** - Scan built images in PR workflow, fail on CRITICAL/HIGH CVEs
3. **Add image startup validation** - After building the operator image, run `docker run --rm <image> version` to verify the binary works

### Priority 1 (High Value)

4. **Consolidate KMS workflows** - Replace 7 nearly-identical `run_kms_*.yml` with one matrix workflow; reduces maintenance from 7 files to 1
5. **Re-enable COSI integration tests** - Or document explicitly why disabled with tracking issue
6. **Add multi-architecture builds** - Support `arm64` in addition to `amd64`
7. **Add SBOM generation** - Use Syft to generate SBOMs during release builds
8. **Add CodeQL or gosec** - Static security analysis for Go code
9. **Add Dependabot or Renovate** - Automated dependency updates

### Priority 2 (Nice-to-Have)

10. **Create CLAUDE.md** - Document test patterns (Ginkgo suites, table-driven tests, Kind setup) for AI-assisted development
11. **Remove legacy Travis CI** - Move `.travis/` scripts to `scripts/` and delete `.travis.yml`
12. **Add Gitleaks** - Prevent secrets from being committed
13. **Add envtest** - Enable faster controller tests without full cluster (currently all integration tests need Kind/Minikube)
14. **Add CODEOWNERS** - Enforce review requirements for critical paths
15. **Improve PR template** - Add checklist for test coverage, security review, documentation

## Comparison to Gold Standards

| Dimension | noobaa-operator | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|-----------|-----------------|---------------------|-------------------|---------------|
| Unit Test Coverage | 18% ratio, no tracking | >70% with enforcement | N/A (images) | >80% with codecov |
| Integration Tests | Strong KMS suite on Kind | Contract + API tests | N/A | Multi-version K8s |
| E2E Tests | Partial (admission, upgrade) | Cypress + Playwright | N/A | Full E2E suite |
| Coverage Tracking | None | Codecov with thresholds | N/A | Codecov + enforcement |
| Container Scanning | None | Trivy + SBOM | 5-layer validation | Trivy + Snyk |
| CI/CD Organization | 24 workflows (sprawl) | Organized matrix jobs | Well-structured | Clean matrix jobs |
| Agent Rules | None | Comprehensive rules | N/A | Some rules |
| Pre-commit Hooks | golangci-lint | Lint + format + type | N/A | Multiple hooks |
| Multi-arch | amd64 only | Multi-arch builds | Multi-arch | Multi-arch |
| Secret Detection | None | Gitleaks | N/A | Multiple tools |

## File Paths Reference

### CI/CD
- `.github/workflows/` - 24 workflow files
- `Makefile` - Build and test targets
- `.travis.yml` - Legacy Travis CI (still present)
- `.travis/` - Helper scripts (actively used by GHA)

### Testing
- `pkg/*/` - Package-level unit tests (`*_test.go`)
- `test/upgrade/` - Upgrade test suite
- `test/cli/` - CLI flow tests (shell scripts)
- `pkg/admission/test/` - Admission webhook tests (unit + integration)
- `pkg/util/kms/test/` - KMS integration tests (7 providers)

### Code Quality
- `.golangci.yml` - Minimal linter config
- `.githooks/` - Pre-commit lint hooks
- `.coderabbit.yaml` - AI code review config

### Container Images
- `build/Dockerfile` - Production image (ubi9-minimal)
- `build/DockerfileDev` - Dev image with Delve
- `build/bundle/Dockerfile` - OLM bundle image
- `.dockerignore` - Docker build exclusions

### Configuration
- `go.mod` - Go 1.26.3, Ginkgo v2, Gomega
- `pull_request_template.md` - PR template
- `deploy/` - Kubernetes manifests and CRDs
