---
repository: "red-hat-data-services/llama-stack-k8s-operator"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Strong envtest-based unit tests with 80% test-to-code ratio; controller, API, and pkg layers well-covered"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Comprehensive E2E suite with Kind cluster, creation/deletion/rollout/TLS/validation tests, automated on PRs"
  - dimension: "Build Integration"
    score: 7.0
    status: "Konflux Tekton pipelines present; multi-arch CI builds; but no PR-time Konflux simulation in GitHub Actions"
  - dimension: "Image Testing"
    score: 6.0
    status: "Multi-stage Dockerfile with FIPS support; no Trivy/Snyk scanning; no image startup validation in CI"
  - dimension: "Coverage Tracking"
    score: 7.5
    status: "limgo coverage enforcement on PRs with per-package thresholds; no codecov integration or trend tracking"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "Well-organized workflows, Mergify auto-merge, concurrency control, multi-arch builds, automated release pipeline"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory; no AI-assisted test generation guidance"
critical_gaps:
  - title: "No container image security scanning"
    impact: "Vulnerabilities in base images or dependencies go undetected until production"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI tools generate inconsistent test patterns; no guardrails for test quality"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No image startup/runtime validation in CI"
    impact: "Container startup failures not caught until deployment"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "Coverage thresholds at 0% in limgo config"
    impact: "Coverage enforcement tool present but not actually enforcing any minimum threshold"
    severity: "HIGH"
    effort: "1-2 hours"
quick_wins:
  - title: "Add Trivy scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Catch container image vulnerabilities before merge"
  - title: "Set meaningful coverage thresholds in .limgo.json"
    effort: "30 minutes"
    impact: "Enforce the existing test coverage levels and prevent regression"
  - title: "Create CLAUDE.md with basic testing guidelines"
    effort: "2-3 hours"
    impact: "Consistent AI-generated tests following project patterns (envtest, testify)"
  - title: "Add CodeQL or gosec scanning workflow"
    effort: "1-2 hours"
    impact: "Static analysis catches security issues in Go code"
recommendations:
  priority_0:
    - "Add Trivy or Snyk container scanning to PR and merge workflows"
    - "Set real coverage thresholds in .limgo.json (currently at 0% for all)"
    - "Add SAST scanning (CodeQL or gosec) for Go security vulnerabilities"
  priority_1:
    - "Create CLAUDE.md and .claude/rules/ for AI-assisted test development"
    - "Add image startup validation to E2E workflow (verify container boots and responds)"
    - "Add Konflux build simulation to GitHub Actions PR checks"
    - "Integrate codecov or similar for coverage trend tracking and PR annotations"
  priority_2:
    - "Add performance/load testing for operator reconciliation under scale"
    - "Add chaos engineering tests (pod disruption, node failures)"
    - "Add contract tests for CRD API versioning (v1alpha1 to v1beta1 migration)"
---

# Quality Analysis: llama-stack-k8s-operator

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Kubernetes Operator (Go, kubebuilder-based)
- **Primary Language**: Go 1.25
- **Framework**: controller-runtime v0.22.4, kubebuilder

**Key Strengths**: Excellent test infrastructure with envtest-based controller tests, comprehensive E2E suite running on Kind clusters in CI, well-organized CI/CD with multi-arch builds, strong pre-commit enforcement including lint + manifest generation + SHA-pinned actions, and a mature release pipeline with E2E gating.

**Critical Gaps**: No container image security scanning (Trivy/Snyk), coverage thresholds set to 0% (tool present but not enforcing), no SAST/CodeQL, no agent rules for AI-assisted development.

**Agent Rules Status**: Missing - No CLAUDE.md, AGENTS.md, or .claude/ directory.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Strong envtest-based tests, 80% test-to-code LOC ratio |
| Integration/E2E | 8.0/10 | Comprehensive Kind-based E2E with creation/deletion/TLS/rollout |
| Build Integration | 7.0/10 | Konflux Tekton pipelines; no PR-time simulation in GHA |
| Image Testing | 6.0/10 | Multi-stage + FIPS; no scanning or startup validation |
| Coverage Tracking | 7.5/10 | limgo present with per-package config; thresholds at 0% |
| CI/CD Automation | 8.5/10 | Mature workflows, Mergify, concurrency, multi-arch, release pipeline |
| Agent Rules | 0.0/10 | No agent configuration whatsoever |

## Critical Gaps

### 1. No Container Image Security Scanning
- **Impact**: Vulnerabilities in UBI9 base images or Go dependencies go undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Neither the GitHub Actions workflows nor the Tekton pipelines include Trivy, Snyk, or any vulnerability scanner. The Dockerfile uses `registry.access.redhat.com/ubi9/ubi-minimal` and `ubi9/go-toolset` but there's no validation these are free of CVEs.

### 2. Coverage Thresholds Not Enforced
- **Impact**: The coverage infrastructure exists but doesn't prevent coverage regression
- **Severity**: HIGH
- **Effort**: 30 minutes
- **Details**: `.limgo.json` sets `statements: 0, lines: 0, branches: 0` globally. The `code-coverage.yml` workflow runs limgo but the 0% thresholds mean it never fails. Current test-to-code ratio (~84% by LOC) suggests healthy coverage — these thresholds should capture it.

### 3. No SAST / Static Security Analysis
- **Impact**: Security bugs in Go code (SQL injection, path traversal, etc.) not caught
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: golangci-lint includes `gosec` via the `default: all` config, which is good. But there's no dedicated CodeQL or Semgrep workflow for deeper security analysis.

### 4. No Agent Rules
- **Impact**: AI-assisted development produces inconsistent test patterns
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: No CLAUDE.md, AGENTS.md, or `.claude/` directory. AI tools won't know to use envtest for controller tests, testify/require for assertions, or the project's specific patterns.

## Quick Wins

### 1. Add Trivy Scanning to PR Workflow (1-2 hours)
```yaml
# Add to .github/workflows/code-coverage.yml or create security-scan.yml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    scan-type: 'fs'
    scan-ref: '.'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'
```

### 2. Set Meaningful Coverage Thresholds (30 minutes)
Update `.limgo.json`:
```json
{
  "coverage": {
    "global": {
      "statements": 60,
      "lines": 60,
      "branches": 40
    }
  }
}
```

### 3. Create CLAUDE.md (2-3 hours)
Add basic testing guidelines covering:
- Use envtest for controller tests (`suite_test.go` pattern)
- Use `testify/require` for assertions, `testify/assert` for non-fatal checks
- Use `stretchr/testify` (already a dependency)
- Follow the existing `TestMain` + `envtest.Environment` pattern
- E2E tests go in `tests/e2e/`, use real Kind cluster

### 4. Add CodeQL Scanning (1-2 hours)
```yaml
name: CodeQL
on: [push, pull_request]
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: go
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory** (10 files):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pre-commit.yml` | PR + push to main | Lint, manifests, API docs, SHA-pin check |
| `code-coverage.yml` | PR to odh | Unit tests + limgo coverage |
| `run-e2e-test.yml` | PR to main + callable | Full E2E on Kind cluster |
| `build-image.yml` | PR merged to main | Multi-arch image build (ogx-ai) |
| `main-build-image.yml` | PR merged to main | Multi-arch image build (opendatahub) |
| `odh-build-image.yml` | Push to odh | Single-arch ODH image build |
| `release-image.yml` | Manual dispatch | Release image build |
| `generate-release.yml` | Manual dispatch | Full release pipeline with E2E gating |
| `build-vllm-cpu-image.yml` | Manual dispatch | Placeholder |

**Strengths**:
- Concurrency control on pre-commit (`cancel-in-progress: true`)
- All actions SHA-pinned (enforced by custom pre-commit hook `check-workflows-uses-hashes.sh`)
- Multi-arch builds (amd64 + arm64) with native cross-compilation
- Release pipeline gates on E2E tests before proceeding
- Mergify auto-merge requires 2 approvals + all checks green

**Gaps**:
- `code-coverage.yml` only triggers on PRs to `odh` branch, not `main`
- No security scanning workflow
- E2E tests run on `ubuntu-latest` (no OpenShift-specific testing)

### Test Coverage

**Test Files**: 28 test files across 3 layers
**Source Files**: 35 Go files (11,543 LOC)
**Test LOC**: 9,644 LOC (84% test-to-code ratio)

| Layer | Test Files | LOC | Key Patterns |
|-------|-----------|-----|--------------|
| Controllers | 7 | 3,284 | envtest, testify, reconciliation tests |
| API (v1beta1) | 4 | 2,427 | CEL validation, webhook tests, type tests |
| Pkg | 7 | 2,465 | Kustomize, deploy, comparison, plugins |
| E2E | 10 | 1,468 | Kind cluster, creation/deletion/TLS/rollout |

**Test Infrastructure**:
- **envtest**: Full kubebuilder envtest setup for controller tests with CRD loading
- **CEL validation tests**: Dedicated test suite for CustomResourceDefinition CEL rules
- **Webhook tests**: Validation webhook testing with comprehensive edge cases
- **E2E**: Kind cluster with cert-manager, operator deployment, Ollama backend

**Strengths**:
- Excellent test layering (unit → envtest → E2E)
- CEL validation tests for CRD field-level constraints
- TLS certificate handling E2E tests
- Rollout strategy tests (RWO PVC deadlock prevention)
- Test support utilities (`testing_support_test.go`, `test_utils.go`)

### Code Quality

**golangci-lint**: Comprehensive configuration (v2) with `default: all` + selective disabling
- Enables ~40+ linters including `gosec`, `errorlint`, `govet` with shadow detection
- Custom settings for `gocyclo` (30), `lll` (180), `funlen` (100)
- Test file exclusions for `errcheck`, `dupl`, `gosec`, `funlen`
- `recvcheck` exclusions for controller-gen generated methods

**Pre-commit Hooks** (8 hooks):
1. Standard hooks (merge conflict, trailing whitespace, YAML, JSON, private key detection)
2. `make lint` (golangci-lint)
3. `make generate manifests` (controller-gen)
4. `make build-installer` (kustomize overlays)
5. `make api-docs` (CRD reference docs)
6. Custom Go error message checker (`check_go_errors.py` - enforces `"failed to"` prefix)
7. GitHub Actions SHA-pin checker

**Strengths**:
- Extremely thorough pre-commit setup
- Custom linting tools (error message consistency, action SHA pinning)
- Manifest/installer regeneration enforced pre-commit
- Mixed-line-ending enforcement (LF only)

### Container Images

**Dockerfiles**: 2 files

1. **Dockerfile** (development/CI):
   - Multi-stage build with UBI9 go-toolset
   - FIPS compliance (`GOEXPERIMENT=strictfipsruntime`)
   - Smart cross-compilation detection (CGO_ENABLED=1 for native, 0 for cross)
   - OpenSSL tag for native builds
   - Non-root user (1001)

2. **Dockerfile.konflux** (production/RHOAI):
   - Pinned base images with SHA digests
   - Red Hat container labels
   - Simpler build (no cross-compilation detection)
   - Non-root user (1001)

**Strengths**:
- FIPS compliance built-in
- SHA-pinned base images in Konflux Dockerfile
- Proper `.dockerignore` file
- Manifest copying for operator bundles

**Gaps**:
- No Trivy/Snyk scanning
- No SBOM generation
- No image signing/attestation
- No startup validation in CI

### Security

**Present**:
- `gosec` linter enabled via golangci-lint
- Private key detection in pre-commit
- SHA-pinned GitHub Actions (enforced)
- Non-root container user
- FIPS compliance
- `detect-private-key` pre-commit hook

**Missing**:
- No dedicated SAST workflow (CodeQL, Semgrep)
- No container vulnerability scanning (Trivy, Snyk)
- No dependency vulnerability scanning (separate from Dependabot)
- No secret scanning workflow (Gitleaks, TruffleHog)
- No SBOM generation

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None
- **Quality**: N/A
- **Gaps**: No CLAUDE.md, AGENTS.md, or `.claude/` directory exists. AI tools have no project-specific guidance for:
  - Unit test patterns (envtest setup, testify usage)
  - E2E test structure (Kind cluster, test options, test utils)
  - CRD/webhook testing conventions
  - Error message formatting (`"failed to"` prefix)
  - Pre-commit hook requirements
- **Recommendation**: Generate rules with `/test-rules-generator` covering envtest, E2E, webhook, and CEL test patterns

### Dependency Management

- **Dependabot**: Configured for GitHub Actions (daily), Go modules (daily with k8s grouping), Docker (weekly)
- **Renovate**: Configured with `konflux-central` preset for Konflux Tekton pipelines
- **Go modules**: Well-maintained with modern versions (k8s.io v0.34.3, controller-runtime v0.22.4)

### Tekton/Konflux Integration

- 7 Tekton PipelineRun configurations for both upstream (opendatahub) and downstream (rhoai)
- Separate pull-request and push pipelines
- Label-triggered Konflux builds (`kfbuild-all`, component-specific labels)
- Comment-triggered builds (`/build-konflux`)
- 8-hour pipeline timeout for PR builds

## Recommendations

### Priority 0 (Critical)

1. **Add container image vulnerability scanning** - Add Trivy scanning to PR workflow and post-merge builds. Both Dockerfile and Dockerfile.konflux should be scanned.
2. **Set real coverage thresholds** - Update `.limgo.json` from 0% to meaningful thresholds based on current coverage levels. The tool is already integrated; just needs real values.
3. **Add SAST scanning** - While gosec runs via golangci-lint, add CodeQL for deeper analysis including data-flow analysis.

### Priority 1 (High Value)

4. **Create agent rules** (`CLAUDE.md` + `.claude/rules/`) - Document testing patterns so AI tools generate consistent code:
   - envtest controller test patterns
   - testify assertion conventions
   - E2E test structure and utilities
   - Error message formatting rules
5. **Add image startup validation** - In the E2E workflow, after building the operator image, verify it starts and responds to health checks before deploying.
6. **Enable coverage on main branch** - `code-coverage.yml` only triggers on PRs to `odh`, not `main`. This means the main development branch has no coverage enforcement.
7. **Add codecov integration** - For PR-level coverage diff tracking and trend analysis over time.

### Priority 2 (Nice-to-Have)

8. **Add performance testing** - Measure reconciliation latency under load (many CRs, rapid updates).
9. **Add chaos testing** - Pod disruption budgets, node failures, operator pod restarts during reconciliation.
10. **Add contract tests** - For API versioning between v1alpha1 and v1beta1 to ensure upgrade paths work.
11. **Add SBOM generation** - Generate Software Bill of Materials during image builds for supply chain security.

## Comparison to Gold Standards

| Dimension | llama-stack-k8s-operator | odh-dashboard | notebooks | kserve |
|-----------|------------------------|---------------|-----------|--------|
| Unit Tests | 8.5 - envtest, 84% ratio | 9.0 - Jest, 90%+ | 7.0 - pytest | 9.0 - envtest, 85%+ |
| Integration/E2E | 8.0 - Kind, automated | 9.0 - Cypress, multi-layer | 8.0 - multi-image | 9.5 - multi-version |
| Build Integration | 7.0 - Konflux Tekton | 8.0 - Module Fed validation | 7.0 - multi-arch | 8.0 - Konflux |
| Image Testing | 6.0 - no scanning | 7.0 - basic scanning | 9.0 - 5-layer validation | 7.0 - Trivy |
| Coverage Tracking | 7.5 - limgo (0% thresh) | 9.0 - codecov enforced | 6.0 - basic | 9.0 - enforced 80% |
| CI/CD Automation | 8.5 - mature pipeline | 9.0 - comprehensive | 8.0 - multi-image | 9.0 - matrix |
| Agent Rules | 0.0 - none | 8.0 - comprehensive | 2.0 - minimal | 3.0 - basic |

## File Paths Reference

| Category | File Path |
|----------|-----------|
| CI Workflows | `.github/workflows/` (10 files) |
| Tekton Pipelines | `.tekton/` (7 files) |
| Golangci Config | `.golangci.yml` |
| Pre-commit | `.pre-commit-config.yaml` |
| Coverage Config | `.limgo.json` |
| Dockerfile (dev) | `Dockerfile` |
| Dockerfile (prod) | `Dockerfile.konflux` |
| Controller Tests | `controllers/*_test.go` (7 files) |
| API Tests | `api/v1beta1/*_test.go` (4 files) |
| Pkg Tests | `pkg/**/*_test.go` (7 files) |
| E2E Tests | `tests/e2e/` (10 files) |
| Makefile | `Makefile` (test, lint, build targets) |
| Mergify | `.github/mergify.yml` |
| Dependabot | `.github/dependabot.yml` |
| Renovate | `.github/renovate.json` |
| Custom Hooks | `hack/check_go_errors.py`, `hack/check-workflows-uses-hashes.sh` |
