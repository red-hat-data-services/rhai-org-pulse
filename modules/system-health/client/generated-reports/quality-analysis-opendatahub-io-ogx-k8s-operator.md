---
repository: "opendatahub-io/llama-stack-k8s-operator"
overall_score: 7.0
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Excellent test-to-code ratio (1.12:1) with envtest integration, table-driven tests, and builder patterns"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Comprehensive E2E suite on Kind cluster with lifecycle, TLS, rollout, and validation testing"
  - dimension: "Build Integration"
    score: 7.0
    status: "Image built and deployed in E2E CI, multi-arch builds post-merge, but no PR-time Konflux simulation"
  - dimension: "Image Testing"
    score: 5.0
    status: "Multi-arch Dockerfile with FIPS compliance, but no vulnerability scanning, SBOM, or image signing"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "limgo configured but thresholds set to 0, only runs on odh branch, no codecov/coveralls integration"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "Well-organized workflows with SHA-pinned actions, Mergify, Dependabot, Konflux/Tekton, and release automation"
  - dimension: "Agent Rules"
    score: 1.0
    status: "No CLAUDE.md, .claude directory, or AI agent guidance for test creation"
critical_gaps:
  - title: "No container vulnerability scanning"
    impact: "Security vulnerabilities in base images and dependencies not detected before deployment"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Coverage thresholds set to 0 and only tracked on odh branch"
    impact: "No enforcement of test coverage, allowing untested code to merge on main branch"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No SAST/CodeQL integration"
    impact: "Static security vulnerabilities in Go code not caught in CI"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No agent rules for AI-assisted test creation"
    impact: "AI-generated tests lack project-specific patterns and quality standards"
    severity: "MEDIUM"
    effort: "3-4 hours"
quick_wins:
  - title: "Add Trivy scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Immediate detection of known CVEs in container images and Go dependencies"
  - title: "Enable coverage tracking on main branch with non-zero thresholds"
    effort: "2-3 hours"
    impact: "Prevent test coverage regression on every PR to main"
  - title: "Add CodeQL workflow for Go security analysis"
    effort: "1-2 hours"
    impact: "Automated detection of SQL injection, command injection, and other CWE patterns"
  - title: "Create basic CLAUDE.md with test creation guidelines"
    effort: "2-3 hours"
    impact: "Consistent AI-generated test quality following project patterns"
recommendations:
  priority_0:
    - "Add Trivy container scanning to PR and post-merge workflows"
    - "Enable coverage tracking on main branch with meaningful thresholds (e.g., 60% minimum)"
    - "Add CodeQL/SAST workflow for Go security analysis"
  priority_1:
    - "Add PR-time image build step to catch Dockerfile issues before merge"
    - "Create CLAUDE.md with project testing patterns and standards"
    - "Add codecov integration with PR comments for coverage visibility"
    - "Add SBOM generation to container builds"
  priority_2:
    - "Add contract tests for CRD API versioning between v1alpha1 and v1beta1"
    - "Add image signing/attestation with cosign"
    - "Add Gitleaks scanning for secret detection in CI"
    - "Multi-distribution E2E testing (currently only tests 'starter' distribution)"
---

# Quality Analysis: llama-stack-k8s-operator

## Executive Summary

- **Overall Score: 7.0/10**
- **Repository Type**: Kubernetes Operator (Go, kubebuilder/operator-sdk)
- **Primary Language**: Go 1.25
- **Key Strengths**: Excellent test-to-code ratio, comprehensive E2E suite with Kind, strong pre-commit hooks with SHA-pinned action enforcement, well-structured release automation, FIPS-compliant multi-arch builds
- **Critical Gaps**: No container vulnerability scanning, no SAST/CodeQL, coverage thresholds at 0, no agent rules
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.0/10 | Excellent test-to-code ratio (1.12:1) with envtest, table-driven tests, builder patterns |
| Integration/E2E | 8.5/10 | Comprehensive E2E on Kind: lifecycle, TLS, rollout, validation testing |
| **Build Integration** | **7.0/10** | **Image built in E2E CI, multi-arch post-merge, no PR-time Konflux simulation** |
| Image Testing | 5.0/10 | Multi-arch + FIPS compliance, but no vuln scanning, SBOM, or signing |
| Coverage Tracking | 4.0/10 | limgo configured at 0 thresholds, only on odh branch |
| CI/CD Automation | 8.5/10 | SHA-pinned actions, Mergify, Dependabot, Konflux/Tekton, release automation |
| Agent Rules | 1.0/10 | No CLAUDE.md, .claude directory, or AI agent guidance |

## Critical Gaps

### 1. No Container Vulnerability Scanning
- **Impact**: Security vulnerabilities in UBI9 base images and Go dependencies not detected before production
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Trivy, Snyk, or Grype scanning in any workflow. The Dockerfile uses `registry.access.redhat.com/ubi9/ubi-minimal:latest` (mutable tag) and `ubi9/go-toolset` without vulnerability verification.

### 2. Coverage Thresholds at Zero / Only on odh Branch
- **Impact**: No enforcement of test coverage on main branch, allowing untested code paths to merge
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: `.limgo.json` sets `statements: 0, lines: 0, branches: 0`. The `code-coverage.yml` workflow only triggers on PRs to the `odh` branch, not `main`. No codecov or coveralls integration.

### 3. No SAST/CodeQL Integration
- **Impact**: Static security vulnerabilities (injection, unsafe operations, race conditions) not caught in CI
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: No CodeQL, gosec, or Semgrep workflows. While golangci-lint includes `gosec` linter (via `default: all` with selective disables), it's explicitly disabled for test files via exclusion rules.

### 4. No Agent Rules for AI-Assisted Development
- **Impact**: AI-generated tests and code lack project-specific patterns, conventions, and quality gates
- **Severity**: MEDIUM
- **Effort**: 3-4 hours
- **Details**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory. The `specs/constitution.md` contains excellent project principles but is not structured for AI agent consumption.

## Quick Wins

### 1. Add Trivy Scanning to PR Workflow (1-2 hours)
**Impact**: Immediate detection of known CVEs in container images and Go dependencies

```yaml
# Add to .github/workflows/pre-commit.yml or create new workflow
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@0.30.0
  with:
    scan-type: 'fs'
    scan-ref: '.'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
```

### 2. Enable Coverage on Main Branch with Thresholds (2-3 hours)
**Impact**: Prevent test coverage regression on every PR

Update `.limgo.json`:
```json
{
  "coverage": {
    "global": {
      "statements": 50,
      "lines": 50,
      "branches": 30
    }
  }
}
```

Update `code-coverage.yml` to trigger on `main` branch PRs:
```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [ main, odh ]
```

### 3. Add CodeQL Workflow (1-2 hours)
**Impact**: Automated CWE detection for Go code

```yaml
name: CodeQL Analysis
on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'
jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: go
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

### 4. Create Basic CLAUDE.md (2-3 hours)
**Impact**: Consistent AI-generated test quality following project patterns

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (9 workflows):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pre-commit.yml` | PR + push to main | Linting, manifest generation, format checks, SHA-pin enforcement |
| `run-e2e-test.yml` | PR to main + callable | Full E2E suite on Kind cluster |
| `code-coverage.yml` | PR to odh | Test coverage with limgo |
| `build-image.yml` | Merged PR to main | Multi-arch image build (ogx-ai) |
| `main-build-image.yml` | Merged PR to main | Multi-arch ODH image build |
| `odh-build-image.yml` | Push to odh | ODH image build |
| `release-image.yml` | Manual dispatch | Release image build |
| `generate-release.yml` | Manual dispatch | Full release automation (E2E + build + tag + GitHub release) |
| `build-vllm-cpu-image.yml` | Manual dispatch | Placeholder workflow |

**Strengths:**
- SHA-pinned GitHub Actions enforced by pre-commit hook (`check-workflows-uses-hashes.sh`)
- Concurrency control on pre-commit workflow (`cancel-in-progress: true`)
- Mergify auto-merge with strict requirements (2 approvals, pre-commit pass, E2E pass, tests pass)
- Dependabot configured for GitHub Actions (daily), Go modules (daily, with k8s grouping), and Docker (weekly)
- Release automation is sophisticated: validates versions, creates release branch, runs E2E, builds multi-arch, creates GitHub release
- Tekton/Konflux integration for ODH production builds (4 pipeline configs)
- Go caching via `setup-go` with `go-version-file: go.mod`

**Gaps:**
- No caching of Go modules beyond what `setup-go` provides
- `build-vllm-cpu-image.yml` is a placeholder with no actual functionality
- Image builds only happen post-merge (no PR-time build validation outside E2E)
- Code coverage workflow only targets `odh` branch, not `main`
- Some action version inconsistency across workflows (e.g., `setup-go` uses different SHAs in different workflows)

### Test Coverage

**Unit Tests (21 files, ~7606 lines):**
- Framework: Go `testing` + `testify/require` + `testify/assert`
- Integration via `controller-runtime/envtest` for real API server testing
- Pattern: Table-driven tests with `[]struct{name, ...}` extensively used
- Builder pattern (`OGXServerBuilder`) for consistent test fixture creation
- Test packages: `controllers_test` (external), `controllers` (internal), `deploy`, `plugins`, `compare`, `cluster`, `v1beta1`
- CEL validation tests (`ogxserver_cel_test.go` - 1355 lines) testing CRD-level validation rules
- Webhook tests (`ogxserver_webhook_test.go` - 645 lines) for admission webhook validation
- Strong test isolation with per-test namespaces

**E2E Tests (7 files, ~2038 lines):**
- Framework: Go `testing` + `testify` on Kind cluster
- Test suites: Validation, Creation, Deletion, Rollout, TLS
- Full lifecycle: CRD validation -> deployment creation -> PVC configuration -> rollout handling -> TLS certificate management -> cleanup
- Test utilities with proper timeouts and retry logic (`wait.PollUntilContextTimeout`)
- Configurable test options (`TestOptions` struct for skip flags)
- CI setup: Kind cluster with cert-manager, local registry, operator deployment

**Test-to-Code Ratio:**
- Test lines: 9,644
- Source lines: 8,582
- Ratio: **1.12:1** (excellent, above gold standard threshold of 0.8:1)

**Gaps:**
- Only "starter" distribution tested in E2E (not ollama, vllm, etc.)
- No contract tests between API versions (v1alpha1 -> v1beta1)
- No fuzz testing
- No benchmark tests
- No test for the `hack/deploy-quickstart.sh` script

### Code Quality

**Linting:**
- golangci-lint v2.8.0 with `default: all` configuration (starts with all linters, selectively disables ~18)
- Minimum complexity: 30 (gocyclo), line length: 180, function length: 100 lines/statements
- Import ordering enforced (gci)
- Shadow variable detection enabled (govet)
- Error handling: errcheck (with type assertion checks), errorlint
- Test file exclusions: errcheck, dupl, gosec, funlen, staticcheck, prealloc

**Pre-commit Hooks (18 total):**
- Standard: merge-conflict, trailing-whitespace, large-files, end-of-file-fixer, no-commit-to-branch, check-yaml, detect-private-key, mixed-line-ending, executables-have-shebangs, check-json, shebang-scripts, check-symlinks, check-toml
- Custom: `make lint`, `make generate manifests`, `make build-installer`, `make api-docs`, Go error message conventions, SHA-pinned actions check

**Code Organization:**
- Clear separation: `api/`, `controllers/`, `pkg/`, `config/`, `tests/`
- Well-documented specs (`specs/constitution.md` with 11 critical rules)
- Kustomize overlays for different deployment targets (cert-manager, openshift, odh, rhoai)
- Builder pattern for test fixtures
- Exported test helper (`NewTestReconciler`) for cross-package testing

### Container Images

**Dockerfile Analysis:**
- Multi-stage build: Go builder -> UBI9 minimal runtime
- Multi-architecture support: amd64/arm64 with native cross-compilation (no QEMU for Go builds)
- FIPS compliance: `GOEXPERIMENT=strictfipsruntime`, CGO_ENABLED=1 for native builds, openssl tag
- Go module caching: COPY go.mod/go.sum before source for layer caching
- Non-root execution: `USER 1001`
- OpenSSL installed in runtime image for FIPS

**Build Process:**
- Makefile targets: `image-build`, `image-push`, `image-buildx` (multi-arch), `image-build-push-single`
- Supports both Docker and Podman (`CONTAINER_TOOL ?= podman`)
- CI uses matrix strategy for native per-arch builds on matching runners (amd64 on ubuntu-24.04, arm64 on ubuntu-24.04-arm)

**Gaps:**
- No Trivy/Snyk/Grype scanning
- No SBOM generation (Syft, etc.)
- No image signing (cosign/Notary)
- Base image uses `latest` tag (mutable): `ubi9/ubi-minimal:latest`
- No `.trivyignore` or vulnerability allowlist
- No container startup validation test (separate from E2E)

### Security

**Present:**
- SHA-pinned GitHub Actions (enforced by CI)
- `detect-private-key` pre-commit hook
- FIPS-compliant container builds
- Non-root container execution
- Dependabot for dependency updates
- RBAC properly scoped in operator manifests
- Webhook TLS with cert-manager

**Missing:**
- No CodeQL/SAST scanning
- No Gitleaks/TruffleHog secret detection
- No container vulnerability scanning
- No dependency vulnerability scanning (beyond Dependabot version bumps)
- No security scanning in Tekton/Konflux pipelines (delegated to central pipeline)
- No signed commits enforcement

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None - no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Existing Documentation**: `specs/constitution.md` has excellent project principles and patterns that could be adapted:
  - Reconciliation patterns (idempotent, separate from status)
  - Error wrapping conventions
  - Kubebuilder validation rules
  - Status conditions patterns
  - Testing patterns (envtest, table-driven)
- **Gaps**:
  - No test type rules (unit, integration, E2E)
  - No testing framework guidance
  - No builder pattern documentation for test fixtures
  - No envtest setup guidance
- **Recommendation**: Generate rules with `/test-rules-generator`, adapting existing constitution.md patterns

## Recommendations

### Priority 0 (Critical)

1. **Add container vulnerability scanning** - Add Trivy or Grype scanning to PR workflow. This is the most impactful security gap. Estimated effort: 2-4 hours.

2. **Enable coverage enforcement on main branch** - Move `code-coverage.yml` to trigger on main branch PRs and set non-zero thresholds in `.limgo.json`. Estimated effort: 2-3 hours.

3. **Add CodeQL/SAST workflow** - GitHub's CodeQL is free for public repos and catches common Go security patterns. Estimated effort: 1-2 hours.

### Priority 1 (High Value)

4. **Add PR-time image build validation** - Build the Docker image on PRs (without push) to catch Dockerfile issues before merge. The E2E workflow already does this, but a lightweight build-only step would give faster feedback. Estimated effort: 2-3 hours.

5. **Create CLAUDE.md and agent rules** - Document testing patterns (envtest setup, builder pattern, table-driven tests, CEL validation testing) for AI agents. Leverage the excellent `specs/constitution.md`. Estimated effort: 3-4 hours.

6. **Add codecov/coveralls integration** - Get coverage visibility with PR comments and trend tracking. Estimated effort: 2-3 hours.

7. **Add SBOM generation** - Add Syft to container builds for software bill of materials. Estimated effort: 2-3 hours.

### Priority 2 (Nice-to-Have)

8. **Multi-distribution E2E testing** - Currently only tests "starter" distribution. Add ollama and vllm distributions. Estimated effort: 4-6 hours.

9. **Add cosign image signing** - Sign container images for supply chain integrity. Estimated effort: 3-4 hours.

10. **Add Gitleaks CI scanning** - Detect accidentally committed secrets. Estimated effort: 1-2 hours.

11. **API version contract tests** - Test migration paths between v1alpha1 and v1beta1. Estimated effort: 4-6 hours.

12. **Pin UBI base image to digest** - Replace `ubi9/ubi-minimal:latest` with a digest-pinned reference. Estimated effort: 30 minutes.

## Comparison to Gold Standards

| Dimension | llama-stack-k8s-operator | odh-dashboard | notebooks | kserve |
|-----------|------------------------|---------------|-----------|--------|
| Unit Tests | 8.0 - Excellent ratio | 9.0 - Multi-layer | 7.0 - Image-focused | 9.0 - Coverage enforced |
| Integration/E2E | 8.5 - Kind + lifecycle | 9.5 - Contract tests | 8.0 - 5-layer validation | 9.0 - Multi-version |
| Build Integration | 7.0 - E2E only | 8.0 - PR build | 7.0 - Matrix builds | 8.0 - Multi-platform |
| Image Testing | 5.0 - No scanning | 7.0 - Trivy | 9.0 - 5-layer | 7.0 - Scanning |
| Coverage Tracking | 4.0 - limgo at 0 | 9.0 - Enforced | 6.0 - Basic | 9.0 - Threshold |
| CI/CD Automation | 8.5 - SHA-pinned | 9.0 - Full pipeline | 8.0 - Matrix | 9.0 - Multi-env |
| Agent Rules | 1.0 - None | 8.0 - Comprehensive | 3.0 - Basic | 2.0 - Minimal |

**Notable Strengths vs. Gold Standards:**
- Test-to-code ratio (1.12:1) exceeds most gold standards
- SHA-pinned action enforcement is a best practice many repos lack
- E2E test sophistication (TLS, rollout, lifecycle) is comprehensive
- Release automation workflow is more mature than many peers
- FIPS-compliant multi-arch builds demonstrate production readiness
- Excellent `specs/constitution.md` with actionable project principles

**Key Gaps vs. Gold Standards:**
- Container scanning and SBOM (notebooks has 5-layer validation)
- Coverage enforcement (kserve and odh-dashboard enforce thresholds)
- Agent rules for AI-assisted development (odh-dashboard leads)

## File Paths Reference

### CI/CD
- `.github/workflows/pre-commit.yml` - Pre-commit and linting
- `.github/workflows/run-e2e-test.yml` - E2E test suite
- `.github/workflows/code-coverage.yml` - Coverage tracking (odh branch only)
- `.github/workflows/build-image.yml` - Post-merge multi-arch build
- `.github/workflows/main-build-image.yml` - ODH multi-arch build
- `.github/workflows/generate-release.yml` - Release automation
- `.github/mergify.yml` - Auto-merge configuration
- `.github/dependabot.yml` - Dependency updates
- `.tekton/*.yaml` - Konflux/Tekton pipeline definitions (4 files)

### Testing
- `controllers/suite_test.go` - Controller envtest setup
- `controllers/ogxserver_controller_test.go` - Main controller tests (1166 lines)
- `controllers/testing_support_test.go` - Test builders and utilities (523 lines)
- `controllers/legacy_adoption_test.go` - Legacy adoption tests (975 lines)
- `api/v1beta1/ogxserver_cel_test.go` - CEL validation tests (1355 lines)
- `api/v1beta1/ogxserver_webhook_test.go` - Webhook tests (645 lines)
- `pkg/deploy/kustomizer_test.go` - Kustomizer tests (1127 lines)
- `tests/e2e/e2e_test.go` - E2E test entry point
- `tests/e2e/test_utils.go` - E2E test utilities (537 lines)

### Code Quality
- `.golangci.yml` - Comprehensive linter config (default: all)
- `.pre-commit-config.yaml` - 18 hooks (12 standard + 6 custom)
- `hack/check_go_errors.py` - Go error message convention checker
- `hack/check-workflows-uses-hashes.sh` - SHA-pinned action enforcer
- `.limgo.json` - Coverage thresholds (currently at 0)

### Container
- `Dockerfile` - Multi-stage, multi-arch, FIPS-compliant
- `config/overlays/` - Kustomize overlays (cert-manager, openshift, odh, rhoai)

### Project Standards
- `specs/constitution.md` - Project principles and patterns
- `CONTRIBUTING.md` - Contribution guidelines
- `config/component_metadata.yaml` - Component version tracking
