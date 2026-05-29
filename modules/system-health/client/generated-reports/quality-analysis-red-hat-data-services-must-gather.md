---
repository: "red-hat-data-services/must-gather"
overall_score: 2.7
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No test files exist anywhere in the repository"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests; scripts are untested"
  - dimension: "Build Integration"
    score: 5.0
    status: "Konflux PR pipeline builds multi-arch images; no runtime validation"
  - dimension: "Image Testing"
    score: 2.0
    status: "Multi-arch image build via Konflux but zero runtime or functional testing"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling of any kind"
  - dimension: "CI/CD Automation"
    score: 4.0
    status: "Bash linting on PR via Super-Linter; Konflux build on label/comment; no test automation"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, .claude/ directory, or agent rules"
critical_gaps:
  - title: "Zero test coverage — no unit, integration, or E2E tests"
    impact: "Shell script regressions (wrong namespace, missing resource, broken xKS detection) are only discovered in production must-gather runs"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No image runtime validation"
    impact: "Container builds may succeed but fail at runtime (missing binaries, wrong entrypoint, permission errors) — discovered only during support escalations"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No shellcheck enforcement beyond Super-Linter defaults"
    impact: "Scripts use shellcheck disable directives liberally; no strict mode (set -euo pipefail) in any script"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No security scanning (Trivy, Snyk, CodeQL, secret detection)"
    impact: "Vulnerabilities in base images and downloaded binaries (kubectl, helm) not detected before release"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI-generated contributions lack guidance on testing patterns, script structure, and collection conventions"
    severity: "LOW"
    effort: "2-3 hours"
quick_wins:
  - title: "Add BATS (Bash Automated Testing System) unit tests for common.sh utility functions"
    effort: "4-6 hours"
    impact: "Cover critical path functions (detect_k8s_distro, get_operator_ns, rhoai_version, run_mustgather) that are exercised in every must-gather run"
  - title: "Add Trivy container scanning to Konflux pipeline or GitHub workflow"
    effort: "1-2 hours"
    impact: "Catch CVEs in base images and downloaded binaries before release"
  - title: "Enable set -euo pipefail across all scripts"
    effort: "2-4 hours"
    impact: "Fail fast on errors instead of silently continuing with partial data collection"
  - title: "Add Dockerfile smoke test (container starts and gather.sh --help runs)"
    effort: "2-3 hours"
    impact: "Catch image build issues (missing binaries, wrong permissions) before merge"
recommendations:
  priority_0:
    - "Introduce BATS test framework with unit tests for all utility functions in common.sh and xks_util.sh"
    - "Add container image smoke test: build image, run it, verify entrypoint and key binaries exist"
    - "Add Trivy or Grype vulnerability scanning to CI pipeline"
  priority_1:
    - "Add integration tests using mock kubectl/oc commands to validate gather script behavior"
    - "Enable strict shell mode (set -euo pipefail) in all scripts with proper error handling"
    - "Upgrade Super-Linter from v5 to v7 and enable additional validators (VALIDATE_DOCKERFILE, VALIDATE_YAML)"
  priority_2:
    - "Create .claude/rules/ with shell script development and testing guidelines"
    - "Add ShellSpec or shUnit2 as alternative/complementary shell testing frameworks"
    - "Implement end-to-end test with Kind cluster validating actual resource collection"
---

# Quality Analysis: must-gather (red-hat-data-services)

## Executive Summary

- **Overall Score: 2.7/10**
- **Repository Type**: Shell-script-based OpenShift must-gather tool for Red Hat OpenShift AI (RHOAI)
- **Primary Language**: Bash (~1,060 lines across 24 shell scripts)
- **Key Strengths**: Good linting foundation with Super-Linter, multi-arch Konflux builds, well-structured modular scripts
- **Critical Gaps**: Zero test coverage of any kind, no image runtime validation, no security scanning, no strict error handling
- **Agent Rules Status**: Missing — no CLAUDE.md, .claude/ directory, or agent rules

This repository is a must-gather diagnostic collection tool that runs inside OpenShift/Kubernetes clusters to collect logs, resources, and configuration for RHOAI support cases. Despite its critical role in production debugging, it has **no automated tests whatsoever** — a significant quality gap for a tool that must work reliably across multiple Kubernetes distributions (OCP, AKS, EKS, CKS).

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No test files exist anywhere in the repository |
| Integration/E2E | 0/10 | No integration or E2E tests; scripts are untested |
| Build Integration | 5/10 | Konflux PR pipeline builds multi-arch images; no runtime validation |
| Image Testing | 2/10 | Multi-arch build via Konflux but zero runtime/functional testing |
| Coverage Tracking | 0/10 | No coverage tooling of any kind |
| CI/CD Automation | 4/10 | Bash linting on PR via Super-Linter; Konflux build on label/comment |
| Agent Rules | 0/10 | No CLAUDE.md, .claude/ directory, or agent rules |

## Critical Gaps

### 1. Zero Test Coverage — No Unit, Integration, or E2E Tests
- **Impact**: Shell script regressions (wrong namespace, missing resource, broken xKS distribution detection) are only discovered during live must-gather runs on customer clusters
- **Severity**: HIGH
- **Effort**: 16-24 hours for initial BATS framework + core function tests
- **Details**: The repository contains 24 shell scripts totaling ~1,060 lines with complex logic for Kubernetes distribution detection, namespace discovery, parallel resource collection, and Helm release extraction — all completely untested

### 2. No Image Runtime Validation
- **Impact**: Container builds succeed but could fail at runtime — missing binaries (`kubectl`, `helm`), wrong entrypoint, permission errors — discovered only during customer support escalations
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The Containerfile downloads `kubectl` and `helm` at build time via `curl`. Neither binary is verified (no checksum validation) and no test confirms they actually work inside the built image

### 3. No Security Scanning
- **Impact**: Vulnerabilities in base images (`origin-must-gather:4.21.0`, `ose-must-gather-rhel9`) and downloaded binaries (`kubectl`, `helm`) are not detected before release
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Trivy, Snyk, CodeQL, Grype, or any other scanning tool is configured. The Containerfile uses `curl` to download binaries without checksum verification

### 4. No Strict Shell Error Handling
- **Impact**: Scripts can silently fail and produce incomplete data collections without alerting the user
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: No script uses `set -euo pipefail`. Error handling is inconsistent — some commands use `|| echo "Error..."` while others have no error handling. shellcheck disable directives are used liberally (`SC2154, SC1091, SC2086, SC2155, SC2034, SC2001, SC2068, SC2153`)

### 5. No Agent Rules for AI-Assisted Development
- **Impact**: AI-generated contributions lack guidance on testing patterns, script structure, namespace conventions, and collection patterns
- **Severity**: LOW
- **Effort**: 2-3 hours

## Quick Wins

### 1. Add BATS Unit Tests for Utility Functions (4-6 hours)
- **Impact**: Cover critical functions that run on every must-gather invocation
- **Target Functions**: `detect_k8s_distro`, `get_operator_ns`, `rhoai_version`, `run_mustgather`, `uniq_list`, `get_log_collection_args`, `auto_discover_resources`, `kubectl_inspect`
- **Implementation**:
```bash
# Install BATS
# test/detect_k8s_distro.bats
#!/usr/bin/env bats

setup() {
  source collection-scripts/llm-d/xks_util.sh
}

@test "detect_k8s_distro returns ocp when infrastructures.config.openshift.io exists" {
  # Mock oc/kubectl to simulate OCP
  function oc() {
    if [[ "$*" == *"infrastructures.config.openshift.io"* ]]; then return 0; fi
    return 1
  }
  export -f oc
  run detect_k8s_distro
  [ "$output" = "ocp" ]
}

@test "detect_k8s_distro returns eks for AWS provider with EKS version" {
  # Mock kubectl for EKS detection
  function kubectl() {
    case "$*" in
      *"infrastructures.config.openshift.io"*) return 1 ;;
      *"kernelVersion"*) echo "5.10.0-aws" ;;
      *"providerID"*) echo "aws://us-east-1/i-123" ;;
      *"version -o json"*) echo '{"serverVersion":{"gitVersion":"v1.28.0-eks-1234"}}' ;;
    esac
  }
  export -f kubectl
  run detect_k8s_distro
  [ "$output" = "eks" ]
}
```

### 2. Add Trivy Container Scanning (1-2 hours)
- **Impact**: Catch CVEs in base images and downloaded binaries
- **Implementation**: Add to `.github/workflows/`:
```yaml
name: Security Scan
on:
  pull_request:
    branches: [main, 'rhoai-*']
jobs:
  trivy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -f Containerfile -t must-gather:test .
      - name: Trivy scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'must-gather:test'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
```

### 3. Enable Strict Shell Mode (2-4 hours)
- **Impact**: Fail fast on errors instead of silently continuing with partial data
- **Implementation**: Add to each script header:
```bash
#!/bin/bash
set -euo pipefail
```
- Note: Requires audit of all `|| echo "Error..."` patterns and ensuring proper error trapping

### 4. Add Image Smoke Test (2-3 hours)
- **Impact**: Validate built image has correct entrypoint and required binaries
- **Implementation**:
```yaml
# Add to GitHub Actions or Konflux pipeline
- name: Smoke test image
  run: |
    docker build -f Containerfile -t must-gather:test .
    docker run --rm must-gather:test which gather.sh kubectl helm oc
    docker run --rm must-gather:test kubectl version --client
    docker run --rm must-gather:test helm version --short
```

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory:**
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `linter.yml` | PR to main/master/rhoai-* | Bash linting via Super-Linter v5 |
| `.tekton/odh-must-gather-pull-request.yaml` | PR (label/comment triggered) | Konflux multi-arch image build |

**Strengths:**
- Super-Linter validates bash scripts (`VALIDATE_BASH`, `VALIDATE_BASH_EXEC`) scoped to `collection-scripts/`
- Konflux pipeline builds multi-arch images (x86_64, ppc64le, s390x, arm64)
- Konflux pipeline uses hermetic builds for reproducibility
- Pipeline cancel-in-progress for PR builds
- Renovate configured for dependency updates via konflux-central

**Weaknesses:**
- Super-Linter v5 is outdated (v7 is current) — missing newer linting capabilities
- No test step in any pipeline — build succeeds without any validation
- Konflux pipeline is comment/label-triggered (`/build-konflux`, `kfbuild-all`), not automatic on every PR
- No Dockerfile/Containerfile linting (hadolint)
- No YAML validation for Tekton/Kubernetes manifests
- No concurrency control on the GitHub Actions workflow
- No caching strategy

### Test Coverage

**Unit Tests**: None. Zero test files exist in the repository.

**Integration Tests**: None. No mock-based or real-cluster testing.

**E2E Tests**: None. No Kind/Minikube test infrastructure.

**Coverage Tracking**: None. No codecov, coveralls, or any coverage tooling.

**Test-to-Code Ratio**: 0:1,060 (0% — all production code, no test code)

**Key Risk**: The core logic in `xks_util.sh` (179 lines) handles Kubernetes distribution detection across OCP, CKS, AKS, and EKS — a complex multi-path decision tree that is entirely untested. A regression here means wrong or failed data collection for an entire platform.

### Code Quality

**Linting:**
- Super-Linter v5 with `VALIDATE_BASH` and `VALIDATE_BASH_EXEC` enabled
- Scoped to `collection-scripts/` directory only
- Multiple `shellcheck disable` directives across scripts (SC2154, SC1091, SC2086, SC2155, SC2034, SC2001, SC2068, SC2153) — suppressing warnings about unquoted variables, unused variables, and missing sources

**Pre-commit Hooks**: None configured

**Static Analysis**: None beyond Super-Linter's bash validation

**Error Handling Patterns**:
- No `set -euo pipefail` in any script
- Inconsistent error handling: some commands use `|| echo "Error..."`, others have none
- Background jobs tracked with PID arrays but failed jobs are only reported, not causing script failure
- `xks_util.sh:kubectl_inspect` silently succeeds even when namespace doesn't exist (returns 1 but caller ignores)

### Container Images

**Build Process:**
- Two Containerfiles: `Containerfile` (upstream/development) and `Dockerfile.konflux` (downstream/production)
- `Containerfile` uses `quay.io/openshift/origin-must-gather:4.21.0` base, downloads kubectl and helm via curl
- `Dockerfile.konflux` uses `registry.redhat.io/openshift4/ose-must-gather-rhel9:v4.20` base, copies kubectl from builder stage
- Multi-stage build in Konflux variant (builder stage for kubectl)
- Git LFS tracked `bin/helm` binary in Konflux variant
- Multi-arch support: x86_64, ppc64le, s390x, arm64

**Vulnerabilities:**
- `Containerfile` downloads kubectl and helm via `curl` without checksum verification
- No image scanning in any pipeline
- No SBOM generation
- No image signing/attestation (beyond what Konflux provides natively)

**Runtime Validation**: None — no test confirms the built image works correctly

### Security

- No Trivy/Snyk/Grype vulnerability scanning
- No CodeQL/SAST analysis
- No secret detection (Gitleaks, TruffleHog)
- No dependency scanning
- `curl` downloads without checksum verification in `Containerfile`
- Cluster-admin RBAC required (necessary for must-gather but worth documenting threat model)

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: No guidance for AI agents on:
  - Shell script patterns and conventions used in this repo
  - How to add new component gather scripts
  - Namespace conventions and resource collection patterns
  - Testing expectations (currently none, but should have BATS)
  - xKS vs OCP behavioral differences
- **Recommendation**: Generate rules with `/test-rules-generator` covering bash testing patterns, gather script templates, and contribution guidelines

## Recommendations

### Priority 0 (Critical)

1. **Introduce BATS test framework** with unit tests for all utility functions in `common.sh` and `xks_util.sh`. Focus on `detect_k8s_distro`, `get_operator_ns`, `rhoai_version`, `get_log_collection_args`, `auto_discover_resources`, and `kubectl_inspect`.

2. **Add container image smoke test** — build image, verify entrypoint exists, confirm `kubectl`, `helm`, `oc`, and `gather.sh` are present and executable, run `kubectl version --client`.

3. **Add Trivy or Grype vulnerability scanning** to either the GitHub Actions workflow or Konflux pipeline to catch CVEs in base images and downloaded binaries.

### Priority 1 (High Value)

4. **Add integration tests with mocked kubectl/oc** — use BATS with mocked CLI tools to validate gather script behavior (correct namespaces inspected, correct resources collected, proper error handling on missing namespaces).

5. **Enable strict shell mode** (`set -euo pipefail`) across all scripts with proper error trapping (`trap`). Audit all `|| echo` patterns and replace with structured error handling.

6. **Upgrade Super-Linter** from v5 to v7 and enable additional validators (`VALIDATE_DOCKERFILE_HADOLINT`, `VALIDATE_YAML`, `VALIDATE_SHELL_SHFMT`).

7. **Add checksum verification** for kubectl and helm downloads in `Containerfile`.

### Priority 2 (Nice-to-Have)

8. **Create `.claude/rules/`** with shell script development and testing guidelines, gather script templates, and xKS-specific conventions.

9. **Add ShellSpec as a complementary shell testing framework** for more complex behavior-driven tests.

10. **Implement E2E test with Kind cluster** — deploy a minimal RHOAI-like setup, run must-gather, verify expected output structure and files.

11. **Add SBOM generation** to the image build pipeline.

12. **Add pre-commit hooks** for shellcheck and shfmt.

## Comparison to Gold Standards

| Dimension | must-gather | odh-dashboard | notebooks | Gold Standard |
|-----------|-------------|---------------|-----------|---------------|
| Unit Tests | None (0/10) | Jest + Go tests (8/10) | Python tests (7/10) | Comprehensive per-function tests |
| Integration/E2E | None (0/10) | Cypress E2E (9/10) | Image validation (8/10) | Multi-version cluster testing |
| Build Integration | Konflux multi-arch (5/10) | PR builds + deploys (8/10) | 5-layer validation (9/10) | PR-time full build validation |
| Image Testing | Build only (2/10) | Runtime checks (7/10) | Startup + functional (9/10) | Build + startup + functional + security |
| Coverage Tracking | None (0/10) | Codecov (8/10) | Coverage reports (7/10) | Enforced thresholds |
| CI/CD | Linter + Konflux (4/10) | Multi-workflow (9/10) | Comprehensive (8/10) | Automated test + build + scan |
| Agent Rules | None (0/10) | Comprehensive (8/10) | Basic (5/10) | Full test automation guidance |

## File Paths Reference

| File | Purpose |
|------|---------|
| `.github/workflows/linter.yml` | Super-Linter v5 bash validation on PRs |
| `.tekton/odh-must-gather-pull-request.yaml` | Konflux multi-arch PR build pipeline |
| `Containerfile` | Upstream/development container image |
| `Dockerfile.konflux` | Downstream/production container image |
| `Makefile` | Build and push targets |
| `collection-scripts/gather.sh` | Main entrypoint (237 lines) |
| `collection-scripts/common.sh` | Shared utilities (140 lines) |
| `collection-scripts/llm-d/xks_util.sh` | xKS distribution detection + kubectl-based inspection (179 lines) |
| `collection-scripts/llm-d/gather_llmd.sh` | LLM-D/RHAII resource collection (97 lines) |
| `.github/renovate.json` | Automated dependency updates via konflux-central |
