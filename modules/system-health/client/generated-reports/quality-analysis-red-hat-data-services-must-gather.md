---
repository: "red-hat-data-services/must-gather"
overall_score: 1.0
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No tests of any kind exist in the repository"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests; no cluster-based validation"
  - dimension: "Build Integration"
    score: 5.0
    status: "Konflux multi-arch PR builds exist but are label/comment-triggered only"
  - dimension: "Image Testing"
    score: 2.0
    status: "Image is built but no runtime validation, no vulnerability scanning"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tracking, no coverage tools, no metrics"
  - dimension: "CI/CD Automation"
    score: 3.0
    status: "Super-linter for bash on PRs; Konflux build is manual-trigger only"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude directory, no agent rules"
critical_gaps:
  - title: "Zero test coverage across the entire repository"
    impact: "Shell script regressions in collection logic go undetected until a customer runs must-gather on a broken cluster"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No runtime validation of built container image"
    impact: "Image could ship with missing binaries (kubectl, helm), broken entrypoint, or incompatible base image — only discovered by customers"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No security scanning in CI pipeline"
    impact: "Vulnerabilities in base image or installed binaries (kubectl, helm) are not detected before release"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No strict mode (set -euo pipefail) in shell scripts"
    impact: "Silent failures in collection scripts can produce incomplete must-gather bundles without any error indication"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "Konflux PR build is not auto-triggered"
    impact: "Build failures are only caught when someone manually adds a label or comment; easy to skip and merge broken builds"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add shellcheck CI step with strict validation"
    effort: "1-2 hours"
    impact: "Catch common bash pitfalls (unquoted variables, missing error handling) before merge"
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Detect CVEs in base image and installed binaries (kubectl, helm) on every PR"
  - title: "Add container startup smoke test"
    effort: "2-4 hours"
    impact: "Verify image builds correctly, entrypoint works, and required binaries (oc, kubectl, helm) are present"
  - title: "Enable set -euo pipefail across all collection scripts"
    effort: "4-6 hours"
    impact: "Fail fast on errors instead of silently producing incomplete must-gather bundles"
  - title: "Auto-trigger Konflux PR builds on every pull request"
    effort: "1 hour"
    impact: "Ensure every PR is validated against production build pipeline"
recommendations:
  priority_0:
    - "Add BATS (Bash Automated Testing System) unit tests for common.sh utility functions and each gather_*.sh script"
    - "Add container image smoke test — verify entrypoint, required binaries (oc, kubectl, helm), and basic gather --help functionality"
    - "Add Trivy vulnerability scanning to the GitHub Actions PR workflow"
  priority_1:
    - "Add integration tests using Kind/Minikube to validate must-gather against a cluster with mock RHOAI CRDs"
    - "Enable strict mode (set -euo pipefail) in all shell scripts with proper error handling"
    - "Auto-trigger Konflux PR builds on every pull request instead of label/comment only"
  priority_2:
    - "Create agent rules (.claude/rules/) for shell script development and testing patterns"
    - "Add SBOM generation and image signing to the Konflux pipeline"
    - "Add performance benchmarking for collection time on large clusters"
---

# Quality Analysis: must-gather

## Executive Summary

- **Overall Score: 1.0/10**
- **Repository Type**: Diagnostic data collection tool (shell scripts)
- **Primary Language**: Bash (27 shell scripts, ~1,007 lines)
- **Framework**: OpenShift must-gather pattern
- **Agent Rules Status**: Missing — no CLAUDE.md, no `.claude/` directory

The `red-hat-data-services/must-gather` repository is a diagnostic tool used by customers and support engineers to collect RHOAI cluster state. Despite being a **critical support tool** that ships as a container image to customers, it has **zero tests**, **no security scanning**, and **minimal CI automation**. The only quality gate is a bash linter on PRs. Regressions in collection scripts are only discovered when customers run must-gather on production clusters and get incomplete results.

### Key Strengths
- shellcheck directives present in most scripts (manual inline annotations)
- Super-linter validates bash syntax on PRs
- Konflux pipeline supports multi-architecture builds (x86_64, ppc64le, s390x, arm64)
- Parallel execution of collection scripts for performance
- Renovate configured for automated dependency updates
- Good README documentation with usage examples

### Critical Gaps
- **Zero tests** — no unit, integration, or E2E tests of any kind
- **No container image validation** — image could ship with broken entrypoint or missing binaries
- **No security scanning** — no Trivy, Snyk, or CVE detection
- **No strict bash mode** — silent failures produce incomplete must-gather bundles
- **Manual-only Konflux trigger** — PR builds require label/comment to trigger

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No tests of any kind exist |
| Integration/E2E | 0/10 | No integration or E2E tests; no cluster-based validation |
| **Build Integration** | **5/10** | **Konflux multi-arch PR builds exist but are label/comment-triggered** |
| Image Testing | 2/10 | Image is built but no runtime validation or vuln scanning |
| Coverage Tracking | 0/10 | No coverage tracking, tools, or metrics |
| CI/CD Automation | 3/10 | Super-linter for bash; Konflux build is manual-trigger only |
| Agent Rules | 0/10 | No CLAUDE.md, no .claude directory, no agent rules |

## Critical Gaps

### 1. Zero Test Coverage
- **Impact**: Shell script regressions in collection logic go undetected until a customer runs must-gather on a broken cluster and gets incomplete or missing data
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: The repository contains 27 shell scripts with ~1,007 lines of bash code. None of them have any automated tests. Functions like `rhoai_version()`, `get_operator_ns()`, `uniq_list()`, `detect_k8s_distro()`, `auto_discover_resources()`, and `kubectl_inspect()` are all untested. Changes to these functions are validated only by manual execution on a live cluster.

### 2. No Runtime Validation of Container Image
- **Impact**: Image could ship with missing binaries (kubectl, helm), broken entrypoint, or incompatible base image — only discovered by customers running `oc adm must-gather`
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The Containerfile installs kubectl and helm via `curl` from external URLs. If these URLs change, versions are incompatible, or the download fails silently, the image ships broken. No smoke test validates that the built image contains working binaries.

### 3. No Security Scanning
- **Impact**: Vulnerabilities in the base image (`quay.io/openshift/origin-must-gather:4.21.0`) or installed binaries (kubectl, helm) are never detected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Trivy, Snyk, CodeQL, or any other security scanning tool is configured. The image pulls binaries from the internet (`dl.k8s.io`, `get.helm.sh`) without checksum verification in the upstream Containerfile.

### 4. No Strict Mode in Shell Scripts
- **Impact**: Silent failures in collection scripts produce incomplete must-gather bundles without error indication to the user
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: None of the 27 shell scripts use `set -euo pipefail`. While individual commands use `|| echo "Error..."` for error handling, this is inconsistent and many commands have no error handling at all. An unset variable or failed command could silently skip resource collection.

### 5. Konflux PR Build Not Auto-Triggered
- **Impact**: Build failures are only caught when someone manually adds a label (`kfbuild-must-gather`) or comments `/build-konflux`; easy to skip and merge broken builds
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: The Tekton PipelineRun in `.tekton/odh-must-gather-pull-request.yaml` is configured with `on-comment` and `on-label` triggers only, not `on-event: [pull_request]` for auto-trigger. Contributors can merge PRs without ever running the production build pipeline.

## Quick Wins

### 1. Add Dedicated Shellcheck CI Step (1-2 hours)
The super-linter runs shellcheck but with broad configuration. A dedicated shellcheck step with strict settings provides better signal.

```yaml
# .github/workflows/shellcheck.yml
name: ShellCheck
on:
  pull_request:
    branches: [main, master, 'rhoai-*']
jobs:
  shellcheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run ShellCheck
        uses: ludeeus/action-shellcheck@2.0.0
        with:
          scandir: './collection-scripts'
          severity: warning
          check_together: 'yes'
```

### 2. Add Trivy Container Scanning (1-2 hours)
```yaml
# Add to .github/workflows/security.yml
name: Security Scan
on:
  pull_request:
    branches: [main, master, 'rhoai-*']
jobs:
  trivy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -f Containerfile -t must-gather:test .
      - name: Run Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'must-gather:test'
          format: 'table'
          exit-code: '1'
          severity: 'CRITICAL,HIGH'
```

### 3. Add Container Startup Smoke Test (2-4 hours)
```yaml
# Add to .github/workflows/smoke-test.yml
name: Image Smoke Test
on:
  pull_request:
    branches: [main, master, 'rhoai-*']
jobs:
  smoke-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -f Containerfile -t must-gather:test .
      - name: Verify binaries exist
        run: |
          docker run --rm --entrypoint /bin/bash must-gather:test -c "
            set -e
            echo 'Checking required binaries...'
            which oc && oc version --client 2>/dev/null || echo 'oc not in PATH'
            which kubectl && kubectl version --client 2>/dev/null
            which helm && helm version 2>/dev/null
            echo 'Checking gather script...'
            test -x /usr/bin/gather
            test -x /usr/bin/gather_original
            ls /usr/bin/gather_*.sh /usr/bin/common.sh
            echo 'All checks passed!'
          "
```

### 4. Enable Strict Mode (4-6 hours)
Add `set -euo pipefail` to all scripts, replacing ad-hoc error handling with proper traps:

```bash
#!/bin/bash
set -euo pipefail

# Add at top of gather.sh and common.sh
trap 'echo "ERROR: Command failed at line $LINENO: $BASH_COMMAND" >&2' ERR
```

### 5. Auto-Trigger Konflux on PRs (1 hour)
Update `.tekton/odh-must-gather-pull-request.yaml` to remove the label/comment requirement:
```yaml
# Change from:
pipelinesascode.tekton.dev/on-comment: "^/build-konflux"
pipelinesascode.tekton.dev/on-label: "[kfbuild-all, kfbuild-must-gather]"
# To auto-trigger:
pipelinesascode.tekton.dev/on-event: "[pull_request]"
```

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory**:
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `.github/workflows/linter.yml` | PR to main/master/rhoai-* | Super-linter bash validation |
| `.tekton/odh-must-gather-pull-request.yaml` | Label/comment on PR | Konflux multi-arch image build |

**Analysis**:
- Only **1 GitHub Actions workflow** exists — a bash linter using `github/super-linter@v5.0.0`
- Super-linter validates `BASH` and `BASH_EXEC` for files matching `.*collection-scripts/.*`
- Konflux/Tekton pipeline builds multi-arch images (x86_64, ppc64le, s390x, arm64) but only on manual trigger
- **No test execution** in any workflow
- **No caching** configured (not needed given minimal CI)
- **No concurrency control** in GitHub Actions (Konflux has `cancel-in-progress: true`)
- Renovate configured for automated dependency updates via `.github/renovate.json`

### Test Coverage

**There are zero tests in this repository.**

- No `*_test.sh`, `*.bats`, `*_test.go`, `*_test.py`, or any test files
- No `test/` or `tests/` directories
- No testing framework (BATS, shunit2, etc.)
- No test targets in `Makefile`
- Test-to-code ratio: **0:1007** (0%)

**Functions that critically need tests**:
| Function | File | Risk |
|----------|------|------|
| `detect_k8s_distro()` | `xks_util.sh` | Multi-platform detection logic with 6 branches |
| `kubectl_inspect()` | `xks_util.sh` | Complex resource collection with parallel log gathering |
| `rhoai_version()` | `common.sh` | Version detection with 3 fallback strategies |
| `get_operator_ns()` | `common.sh` | Operator namespace discovery with error handling |
| `get_log_collection_args()` | `common.sh` | Time-based log filtering argument parsing |
| `run_mustgather()` | `common.sh` | Core collection orchestration |
| `auto_discover_resources()` | `xks_util.sh` | Dynamic resource discovery and collection |
| `collect_helm_releases()` | `common.sh` | Helm release data extraction |

### Code Quality

**Linting**:
- Super-linter runs on PRs with `VALIDATE_BASH=true` and `VALIDATE_BASH_EXEC=true`
- Most scripts include `shellcheck disable` directives for known exceptions (SC2154, SC1091, SC2086, etc.)
- Some shellcheck disables are overly broad (SC2086 — word splitting) and mask real bugs

**Static Analysis**:
- No dedicated shellcheck step beyond super-linter
- No SAST tools (CodeQL, Semgrep, gosec)
- No secret detection (Gitleaks, TruffleHog)

**Pre-commit Hooks**: None

**Code Patterns**:
- Consistent script structure with `source common.sh` pattern
- Parallel execution using background processes with PID tracking
- Error handling is inconsistent — some commands use `|| echo "Error"`, many have none
- **No `set -euo pipefail`** in any script — silent failures are possible
- Variable quoting is inconsistent (shellcheck SC2086 disabled in many files)

### Container Images

**Build Process**:
- Two Dockerfiles: `Containerfile` (upstream/dev) and `Dockerfile.konflux` (downstream/production)
- Base image: `quay.io/openshift/origin-must-gather:4.21.0` (upstream) / `registry.redhat.io/openshift4/ose-must-gather-rhel9:v4.20` (downstream)
- Multi-stage build in `Dockerfile.konflux` only (copies kubectl from builder)
- External binary downloads: kubectl from `dl.k8s.io`, helm from `get.helm.sh` (upstream only)
- Helm binary tracked via Git LFS in `bin/helm` for downstream

**Runtime Testing**: None
- No entrypoint validation
- No binary presence checks
- No startup testing

**Security Scanning**: None
- No Trivy, Snyk, or Grype
- No SBOM generation
- No image signing/attestation
- No checksum verification for downloaded binaries in upstream Containerfile

**Multi-Architecture Support**: Yes
- Konflux builds for x86_64, ppc64le, s390x, arm64
- Upstream Containerfile only downloads amd64 kubectl/helm — **broken for non-amd64 architectures**

### Security

| Practice | Status |
|----------|--------|
| Container scanning | Not configured |
| SAST/CodeQL | Not configured |
| Dependency scanning | Renovate only (no vulnerability alerts) |
| Secret detection | Not configured |
| SBOM generation | Not configured |
| Image signing | Not configured |
| Binary checksum verification | Missing in upstream Containerfile |

**Security Concern**: The upstream `Containerfile` downloads kubectl and helm binaries via `curl` without verifying checksums. A supply chain attack on `dl.k8s.io` or `get.helm.sh` could inject malicious binaries into the must-gather image.

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No test type rules exist
- **Quality**: N/A
- **Gaps**: Everything — no CLAUDE.md, no `.claude/` directory, no `.claude/rules/`, no agent skills
- **Recommendation**: Generate rules with `/test-rules-generator` for:
  - Shell script testing patterns (BATS)
  - Collection script development guidelines
  - Containerfile best practices
  - CI workflow templates

## Recommendations

### Priority 0 (Critical)

1. **Add BATS unit tests for utility functions** (16-24 hours)
   - Install [BATS](https://github.com/bats-core/bats-core) testing framework
   - Test `detect_k8s_distro()` with mocked kubectl output for each platform
   - Test `rhoai_version()` with mocked oc output for each fallback path
   - Test `get_operator_ns()` for single, multiple, and missing subscriptions
   - Test `get_log_collection_args()` for various MUST_GATHER_SINCE combinations
   - Test `uniq_list()` for deduplication

2. **Add container image smoke test** (4-8 hours)
   - Verify image builds successfully
   - Verify entrypoint (`/usr/bin/gather`) exists and is executable
   - Verify required binaries (oc/kubectl, helm) are present and functional
   - Verify collection scripts are properly installed in `/usr/bin/`

3. **Add Trivy vulnerability scanning** (2-4 hours)
   - Scan built container image on every PR
   - Block merge on CRITICAL/HIGH vulnerabilities
   - Generate SBOM for supply chain visibility

### Priority 1 (High Value)

4. **Add integration tests with mock CRDs** (12-16 hours)
   - Use Kind cluster with RHOAI CRD definitions installed
   - Create mock resources (InferenceService, DSC, DSCI, etc.)
   - Run must-gather against the cluster
   - Validate output directory structure and content

5. **Enable strict bash mode** (4-6 hours)
   - Add `set -euo pipefail` to all scripts
   - Add error trap handlers for debugging
   - Fix all issues surfaced by strict mode (unbound variables, pipefail)

6. **Auto-trigger Konflux PR builds** (1-2 hours)
   - Change Tekton pipeline trigger from label/comment to auto on PR
   - Ensure every PR validates against the production build pipeline

7. **Add binary checksum verification** (2-3 hours)
   - Verify SHA256 checksums for kubectl and helm downloads in Containerfile
   - Pin specific versions with checksums

### Priority 2 (Nice-to-Have)

8. **Create agent rules** (4-6 hours)
   - Add `.claude/rules/` with bash scripting standards
   - Include BATS test patterns and examples
   - Document collection script structure and conventions

9. **Add SBOM generation and image signing** (4-6 hours)
   - Generate SBOM during Konflux build
   - Sign images with cosign

10. **Fix multi-architecture support in upstream Containerfile** (2-3 hours)
    - Use architecture-aware kubectl/helm downloads
    - Test on each target architecture

11. **Add performance benchmarking** (8-12 hours)
    - Measure collection time on different cluster sizes
    - Track performance regressions across releases

## Comparison to Gold Standards

| Dimension | must-gather | odh-dashboard | notebooks | kserve |
|-----------|------------|---------------|-----------|--------|
| Unit Tests | None | Jest + React Testing Library | Python unit tests | Go test + envtest |
| Integration/E2E | None | Cypress E2E | Robot Framework | KServe E2E suite |
| Build Integration | Konflux (manual) | PR-time builds | Multi-image validation | Multi-version builds |
| Image Testing | Build only | Startup + functional | 5-layer validation | Image pull + serve |
| Coverage Tracking | None | Codecov + thresholds | Coverage reports | Codecov enforcement |
| CI/CD Automation | Linter only | Full PR/periodic suite | Multi-workflow | Comprehensive CI |
| Security Scanning | None | Snyk/Trivy | Trivy scanning | CodeQL + Trivy |
| Agent Rules | None | Comprehensive | Partial | None |
| **Overall** | **1.0/10** | **8.5/10** | **7.5/10** | **8.0/10** |

## File Paths Reference

| File | Purpose |
|------|---------|
| `.github/workflows/linter.yml` | Super-linter bash validation |
| `.tekton/odh-must-gather-pull-request.yaml` | Konflux multi-arch build pipeline |
| `Containerfile` | Upstream/dev container build |
| `Dockerfile.konflux` | Downstream/production container build |
| `Makefile` | Build and push targets |
| `collection-scripts/common.sh` | Shared utility functions |
| `collection-scripts/gather.sh` | Main entrypoint script |
| `collection-scripts/llm-d/xks_util.sh` | Non-OpenShift platform utilities |
| `collection-scripts/gather_*.sh` | Component-specific collection scripts |
| `.github/renovate.json` | Automated dependency updates |
