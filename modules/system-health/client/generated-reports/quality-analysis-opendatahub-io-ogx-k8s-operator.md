---
repository: "opendatahub-io/ogx-k8s-operator"
overall_score: 7.4
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    weight: 20
    status: "Excellent test-to-code ratio (1.1:1), envtest-based controller tests, CEL validation tests, table-driven patterns"
  - dimension: "Integration/E2E"
    score: 8.0
    weight: 25
    status: "Comprehensive Kind-based E2E suite with creation, deletion, rollout, TLS, and validation tests; automated in CI via workflow_call"
  - dimension: "Build Integration"
    score: 6.5
    weight: 0
    status: "Tekton/Konflux pipelines for PR and push builds on odh branch; no PR-time Konflux simulation on main"
  - dimension: "Image Testing"
    score: 5.0
    weight: 20
    status: "Multi-arch image builds (amd64/arm64), FIPS-aware Dockerfile, but no image runtime validation or startup testing"
  - dimension: "Coverage Tracking"
    score: 6.0
    weight: 15
    status: "limgo coverage tool with per-package thresholds, but thresholds set to 0% — not enforcing minimums"
  - dimension: "CI/CD Automation"
    score: 8.5
    weight: 20
    status: "9 workflows, Mergify auto-merge with required checks, pre-commit enforcement, Dependabot daily updates, Tekton Konflux pipelines"
  - dimension: "Agent Rules"
    score: 0.0
    weight: 0
    status: "No CLAUDE.md, .claude/ directory, or agent rules present"
critical_gaps:
  - title: "Coverage thresholds set to 0%"
    impact: "limgo runs but does not enforce any minimum coverage — regressions go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container image runtime validation"
    impact: "Image startup failures, missing manifests, or FIPS incompatibilities only discovered at deployment time"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No security scanning (SAST, container, dependency)"
    impact: "Vulnerabilities in dependencies or container images not caught before merge"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI-generated code and tests lack project-specific patterns, leading to inconsistent contributions"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "ogx-module has zero tests"
    impact: "New module component has no test coverage at all — regressions have no safety net"
    severity: "HIGH"
    effort: "8-16 hours"
quick_wins:
  - title: "Set meaningful coverage thresholds in .limgo.json"
    effort: "1-2 hours"
    impact: "Enforce minimum coverage (e.g., 60-70%) and prevent regressions"
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Catch CVEs in base images and dependencies before merge"
  - title: "Add CodeQL or gosec SAST scanning"
    effort: "2-3 hours"
    impact: "Static analysis catches security bugs in Go code"
  - title: "Create basic CLAUDE.md with testing patterns"
    effort: "2-3 hours"
    impact: "Standardize AI-generated test quality across contributors"
recommendations:
  priority_0:
    - "Set limgo coverage thresholds to meaningful values (60-70% global) to prevent coverage regression"
    - "Add container image runtime validation — build and start the image in CI, verify /healthz or readiness"
    - "Add security scanning: Trivy for container images, CodeQL/gosec for SAST, Dependabot security alerts"
    - "Add unit and integration tests for ogx-module (currently 0% coverage)"
  priority_1:
    - "Add image startup testing in the E2E workflow — verify the operator pod starts and responds"
    - "Create agent rules (.claude/rules/) for unit test, E2E test, and controller test patterns"
    - "Add codecov.yml or equivalent PR-level coverage reporting with diff thresholds"
    - "Pin GitHub Actions in odh-build-image.yml to SHA hashes (currently uses tag refs)"
  priority_2:
    - "Add SBOM generation for container images"
    - "Add image signing/attestation (cosign/sigstore)"
    - "Add performance/benchmark tests for reconciliation loop"
    - "Add contract tests between operator and ogx-module CRD interfaces"
---

# Quality Analysis: ogx-k8s-operator

## Executive Summary

- **Overall Score: 7.4/10**
- **Repository Type**: Kubernetes Operator (Go, kubebuilder-based)
- **Primary Language**: Go (67 source files, 39 non-test Go files)
- **Framework**: controller-runtime / kubebuilder with OGXServer CRD (v1beta1)
- **Key Strengths**: Excellent test-to-code ratio (1.1:1), comprehensive E2E suite with Kind, strong pre-commit enforcement, well-configured golangci-lint with 30+ linters, Mergify auto-merge with required checks
- **Critical Gaps**: Coverage thresholds at 0% (no enforcement), no security scanning, no container runtime validation, ogx-module has zero tests
- **Agent Rules Status**: Missing — no CLAUDE.md, .claude/ directory, or agent rules present

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 8.5/10 | 20% | Excellent test-to-code ratio (1.1:1), envtest-based controller tests, CEL validation tests |
| Integration/E2E | 8.0/10 | 25% | Comprehensive Kind-based E2E with creation, deletion, rollout, TLS, validation suites |
| Build Integration | 6.5/10 | — | Tekton/Konflux PR+push pipelines on odh branch; main branch relies on GitHub Actions only |
| Image Testing | 5.0/10 | 20% | Multi-arch builds, FIPS-aware Dockerfile, but no runtime validation or startup testing |
| Coverage Tracking | 6.0/10 | 15% | limgo tool integrated but thresholds set to 0% — effectively not enforcing coverage |
| CI/CD Automation | 8.5/10 | 20% | 9 workflows, Mergify, pre-commit, Dependabot, Tekton, concurrency control |
| Agent Rules | 0.0/10 | — | No agent rules, CLAUDE.md, or AI development guidance |

## Critical Gaps

### 1. Coverage Thresholds Set to 0%
- **Impact**: limgo runs in CI and generates a coverage report, but `.limgo.json` has `statements: 0, lines: 0, branches: 0` — any coverage regression passes silently
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **File**: `.limgo.json`

### 2. No Container Image Runtime Validation
- **Impact**: The operator image is built in CI (multi-arch amd64/arm64, FIPS-aware with cross-compilation logic), but never started or tested. Startup failures, missing manifest files, or FIPS library issues are only caught at deployment time
- **Severity**: HIGH
- **Effort**: 4-6 hours

### 3. No Security Scanning
- **Impact**: No SAST (CodeQL, gosec), no container scanning (Trivy, Snyk), no secret detection (Gitleaks). Dependencies are updated via Dependabot but not scanned for known CVEs
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Missing**: `.github/workflows/codeql.yml`, `.trivyignore`, `.gitleaks.toml`

### 4. ogx-module Has Zero Tests
- **Impact**: The `ogx-module/` directory contains a separate Go module with its own Dockerfile, CRD types, and deployment manifests but has no test files whatsoever. This is a new component with zero safety net
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Files**: `ogx-module/pkg/apis/v1alpha1/`, `ogx-module/cmd/`

### 5. No Agent Rules for AI-Assisted Development
- **Impact**: No CLAUDE.md, AGENTS.md, or `.claude/rules/` directory. AI-assisted contributions lack project-specific patterns for test creation, controller patterns, and CRD validation
- **Severity**: MEDIUM
- **Effort**: 4-6 hours

## Quick Wins

### 1. Set Meaningful Coverage Thresholds (1-2 hours)
Update `.limgo.json` to enforce minimum coverage:
```json
{
  "coverage": {
    "global": {
      "statements": 60,
      "lines": 60,
      "branches": 40
    }
  },
  "statistic": {
    "excludes": [
      "test_*",
      "tests/.*",
      "zz_generated.deepcopy.go"
    ]
  }
}
```

### 2. Add Trivy Container Scanning (1-2 hours)
Add a step to the PR workflow:
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'ogx-k8s-operator:latest'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
```

### 3. Add CodeQL SAST Scanning (2-3 hours)
Create `.github/workflows/codeql.yml` with Go analysis.

### 4. Create Basic CLAUDE.md (2-3 hours)
Document testing patterns, controller test setup with envtest, E2E test structure, and coding conventions.

## Detailed Findings

### CI/CD Pipeline

**Workflows (9 total):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pre-commit.yml` | PR + push to main | Pre-commit hooks: linting, manifests, API docs, SHA-pinned actions check |
| `code-coverage.yml` | PR to odh branch | Run tests + limgo coverage report |
| `run-e2e-test.yml` | workflow_call | Kind cluster E2E: build operator, deploy, run tests |
| `build-image.yml` | PR merged to main | Multi-arch (amd64/arm64) image build + manifest |
| `odh-build-image.yml` | Push to odh | Build + push ODH-specific operator image |
| `main-build-image.yml` | Push to main | Placeholder (empty) |
| `release-image.yml` | Tag push (v*) | Multi-arch release image build |
| `generate-release.yml` | Manual dispatch | Full release: E2E, version bump, branch cut, changelog |
| `build-vllm-cpu-image.yml` | Manual dispatch | Placeholder for CPU vLLM image |

**Strengths:**
- Concurrency control on pre-commit workflow (`cancel-in-progress: true`)
- Mergify auto-merge requires 2 approvals, passed pre-commit, E2E, DCO, and tests checks
- Pre-commit hook validates SHA-pinned GitHub Actions references
- Dependabot configured for github-actions (daily), gomod (daily, k8s grouped), docker (weekly)
- E2E tests are reusable via `workflow_call` — used by release workflow

**Weaknesses:**
- `odh-build-image.yml` uses tag-based action references (not SHA-pinned) unlike other workflows
- `main-build-image.yml` and `build-vllm-cpu-image.yml` are placeholders with no actual content
- No tests run on PR to main branch — `code-coverage.yml` only targets `odh` branch
- No concurrency control on build-image workflows

### Test Coverage

**Test-to-Code Ratio**: 9,644 test lines / 8,759 source lines = **1.10:1** (excellent)

**Unit Tests (21 files):**
- Controller tests using envtest (real API server) with testify assertions — `controllers/suite_test.go` sets up shared `envtest.Environment`
- CEL validation tests (`api/v1beta1/ogxserver_cel_test.go` — 1,355 lines) — comprehensive CRD validation rules
- Webhook tests (`api/v1beta1/ogxserver_webhook_test.go` — 645 lines)
- Resource helper and network resource tests
- Deploy/kustomizer plugin tests (`pkg/deploy/` — 5 test files, 1,781 lines total)
- Table-driven test patterns used consistently

**E2E Tests (7 test files + 2 support files):**
- Kind cluster with local registry
- Test suites: validation, creation, deletion, rollout, TLS
- Multi-distribution testing (starter distribution)
- Operator deployment validation
- CRD validation
- Resource lifecycle (create → update → delete → verify cleanup)
- TLS certificate generation and CA bundle validation
- PVC rollout strategy testing (Recreate for RWO)

**Gaps:**
- ogx-module has zero tests
- No integration tests for Kustomize overlay generation
- Coverage thresholds at 0%

### Code Quality

**golangci-lint (`.golangci.yml`)**:
- Version 2 config with `default: all` (all linters enabled by default)
- 22 linters explicitly disabled with reasons documented
- Custom settings: gocyclo (min 30), lll (180), funlen (100/100), errorlint, govet with shadow detection
- Test file exclusions for errcheck, dupl, gosec, funlen
- Strong configuration — among the best seen in ODH repos

**Pre-commit (`.pre-commit-config.yaml`)**:
- 12 standard hooks (merge conflict, trailing whitespace, large files, private keys, YAML, JSON, TOML)
- Custom hooks: `make lint`, `make generate manifests`, `make build-installer`, `make api-docs`
- SHA-pinned GitHub Actions hash checker (`check-workflows-uses-hashes.sh`)
- Custom Go error message checker (`check_go_errors.py`)
- Enforced in CI via `pre-commit.yml` workflow with diff/untracked file verification

**Additional Quality Tools:**
- limgo for coverage tracking (though thresholds are 0%)
- Go vet with extensive checks enabled
- Dependabot for automated dependency updates (3 ecosystems)

### Container Images

**Main Operator Image (`Dockerfile`)**:
- Multi-stage build (builder + UBI9 minimal runtime)
- FIPS compliance: `GOEXPERIMENT=strictfipsruntime`, conditional CGO for native vs cross-compilation
- Multi-arch support: amd64 + arm64 with `BUILDPLATFORM`/`TARGETPLATFORM` awareness
- Uses `registry.access.redhat.com/ubi9/go-toolset` (builder) and `ubi9/ubi-minimal` (runtime)
- Copies manifests into image for operator deployment
- Installs OpenSSL for FIPS
- Runs as non-root (USER 1001)

**ogx-module Image (`ogx-module/Dockerfile`)**:
- Multi-stage build with UBI9 go-toolset and ubi-micro runtime
- CGO_ENABLED=0 (pure Go)
- Non-root (USER 65532:65532)
- Copies manifests for module deployment

**Tekton/Konflux Pipelines (4 PipelineRuns)**:
- PR and push pipelines for both `llama-stack-k8s-operator` and `odh-ogx-k8s-operator`
- Uses centralized `odh-konflux-central` multi-arch container build pipeline
- Targets `odh` branch only

**Gaps:**
- No image startup validation (verify `/manager` starts and responds)
- No vulnerability scanning (Trivy/Snyk)
- No SBOM generation
- No image signing/attestation

### Security

**Present:**
- Dependabot for automated dependency updates (3 ecosystems)
- SHA-pinned GitHub Actions (enforced by pre-commit hook)
- Non-root container runtime
- FIPS-aware builds with strictfipsruntime
- `detect-private-key` pre-commit hook
- `.dockerignore` configured

**Missing:**
- No SAST (CodeQL, gosec, Semgrep)
- No container scanning (Trivy, Snyk, Grype)
- No secret detection beyond pre-commit (no Gitleaks/TruffleHog)
- No dependency vulnerability scanning (only update automation)
- No SBOM generation
- No image signing

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no CLAUDE.md, AGENTS.md, or `.claude/` directory
- **Quality**: N/A
- **Gaps**: All test types lack agent rules; no patterns for controller tests, envtest setup, CEL tests, E2E tests, webhook tests, or kustomize plugin tests
- **Recommendation**: Generate comprehensive rules with `/test-rules-generator` covering:
  - Controller test patterns (envtest, testify, table-driven)
  - CEL validation test patterns
  - Webhook test patterns
  - E2E test patterns (Kind, operator deployment, resource lifecycle)
  - Deploy/kustomize plugin test patterns

## Recommendations

### Priority 0 (Critical)

1. **Set limgo coverage thresholds to meaningful values** (60-70% global) — currently at 0%, preventing any enforcement
2. **Add container image runtime validation** — build and start the image in CI, verify the manager binary runs
3. **Add security scanning**: Trivy for container images, CodeQL/gosec for Go SAST, enable Dependabot security alerts
4. **Add tests for ogx-module** — new component has zero test coverage; needs at least type validation and controller tests

### Priority 1 (High Value)

1. **Add PR-time testing on main branch** — `code-coverage.yml` only targets `odh` branch; main branch PRs only get pre-commit
2. **Create agent rules** (`.claude/rules/`) for all test types: unit, controller (envtest), CEL, webhook, E2E
3. **Add codecov.yml or PR-level coverage diff reporting** — currently coverage is only in step summary, not PR comments
4. **Pin GitHub Actions in `odh-build-image.yml`** to SHA hashes (currently uses tag references, inconsistent with other workflows)
5. **Remove placeholder workflows** (`main-build-image.yml`, `build-vllm-cpu-image.yml`) or implement them

### Priority 2 (Nice-to-Have)

1. Add SBOM generation for container images (syft/cyclonedx)
2. Add image signing with cosign/sigstore
3. Add performance/benchmark tests for reconciliation loop
4. Add contract tests between operator and ogx-module CRD interfaces
5. Add chaos engineering tests for operator resilience

## Comparison to Gold Standards

| Dimension | ogx-k8s-operator | odh-dashboard | notebooks | kserve |
|-----------|-----------------|---------------|-----------|--------|
| Unit Test Ratio | 1.1:1 | 0.8:1 | N/A | 0.6:1 |
| E2E Suite | Kind-based, 7 test files | Cypress + API | Image testing | Kind + real cluster |
| Coverage Enforcement | limgo (0% threshold) | Codecov (enforced) | N/A | Codecov (enforced) |
| Container Scanning | None | Trivy | Trivy | Trivy |
| SAST | None | CodeQL | None | CodeQL |
| Pre-commit | 12 hooks + custom | Yes | Yes | Yes |
| Agent Rules | None | Comprehensive | None | Partial |
| Multi-arch | amd64 + arm64 | amd64 | Multi-arch | amd64 |
| FIPS | Yes (strictfipsruntime) | No | No | No |
| Mergify | Yes (2 approvals) | Yes | No | No |
| Dependabot | 3 ecosystems | Yes | Yes | Yes |

## File Paths Reference

| Category | Files |
|----------|-------|
| CI/CD Workflows | `.github/workflows/*.yml` (9 files) |
| Tekton Pipelines | `.tekton/*.yaml` (4 files) |
| Unit Tests | `controllers/*_test.go`, `api/v1beta1/*_test.go`, `pkg/**/*_test.go` |
| E2E Tests | `tests/e2e/*_test.go` |
| Linting | `.golangci.yml` |
| Pre-commit | `.pre-commit-config.yaml` |
| Coverage | `.limgo.json` |
| Dockerfile | `Dockerfile`, `ogx-module/Dockerfile` |
| Dependency Updates | `.github/dependabot.yml` |
| Auto-merge | `.github/mergify.yml` |
| Hack Scripts | `hack/deploy-quickstart.sh`, `hack/check_go_errors.py`, `hack/check-workflows-uses-hashes.sh` |
| Specs | `specs/constitution.md`, `specs/001-*/`, `specs/002-*/`, `specs/003-*/` |
