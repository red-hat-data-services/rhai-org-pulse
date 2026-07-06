---
repository: "red-hat-data-services/rhoai-disconnected-install-helper"
overall_score: 0.8
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No test files exist anywhere in the repository"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or end-to-end tests of any kind"
  - dimension: "Build Integration"
    score: 1.0
    status: "Containerfile exists but is never built or validated in CI"
  - dimension: "Image Testing"
    score: 1.0
    status: "Containerfile present but no image build, scanning, or runtime testing"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling, no codecov, no thresholds"
  - dimension: "CI/CD Automation"
    score: 3.0
    status: "Daily scheduled run and manual dispatch, but zero PR-time validation"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent guidance"
critical_gaps:
  - title: "Zero test coverage across all dimensions"
    impact: "Script regressions ship silently — broken image lists go undetected until customers fail to install in disconnected environments"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No PR-triggered CI workflows"
    impact: "Code changes merge without any automated validation — syntax errors, logic bugs, and regressions are only caught in production"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "Massive code duplication between rhoai-dih.sh and rhoai-z-dih.sh"
    impact: "Bug fixes must be applied in two places; divergence between y-stream and z-stream logic creates subtle inconsistencies"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No container image build or security scanning"
    impact: "Containerfile ships with outdated base image (UBI8) and pinned yq v4.9.6; vulnerabilities go undetected"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No shellcheck or linting"
    impact: "Shell scripting anti-patterns and bugs (quoting issues, unhandled failures) accumulate unchecked"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "Potential command injection in GitHub Actions workflow"
    impact: "User-supplied branch_name input is used in shell commands without proper sanitization in workflow steps"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add ShellCheck linting to a PR workflow"
    effort: "1-2 hours"
    impact: "Catches quoting bugs, undefined variables, and shell anti-patterns on every PR"
  - title: "Add a basic PR-triggered CI workflow with syntax validation"
    effort: "2-3 hours"
    impact: "Prevents broken scripts from merging — bash -n syntax check + shellcheck"
  - title: "Pin GitHub Actions to SHA instead of branch/tag"
    effort: "30 minutes"
    impact: "Prevents supply chain attacks via mutable action references (actions/checkout@v3, actions-js/push@master)"
  - title: "Update Containerfile to UBI9 and latest yq"
    effort: "1 hour"
    impact: "Removes known vulnerabilities from outdated base image and tools"
  - title: "Consolidate duplicate code between rhoai-dih.sh and rhoai-z-dih.sh"
    effort: "4-6 hours"
    impact: "Eliminates ~90% code duplication, reduces maintenance burden, prevents drift between y-stream and z-stream"
recommendations:
  priority_0:
    - "Add PR-triggered CI workflow with shellcheck linting and bash syntax validation"
    - "Write unit tests for core functions (version comparison, image filtering, input validation) using bats-core"
    - "Fix potential command injection in workflow by using environment variables instead of inline expressions"
  priority_1:
    - "Consolidate rhoai-dih.sh and rhoai-z-dih.sh into a shared library to eliminate ~500 lines of duplication"
    - "Add container image build and Trivy scanning to CI"
    - "Add integration tests that verify generated markdown output against expected format"
    - "Update Containerfile base image from UBI8 to UBI9 and pin yq to latest version"
  priority_2:
    - "Add pre-commit hooks with shellcheck and YAML validation"
    - "Create CLAUDE.md and agent rules for test automation guidance"
    - "Add codecov integration once tests exist"
    - "Implement release workflow with semantic versioning"
---

# Quality Analysis: rhoai-disconnected-install-helper

## Executive Summary

- **Overall Score: 0.8/10**
- **Repository Type**: Shell-script automation tooling
- **Primary Language**: Bash (~1,272 lines across 4 scripts)
- **Purpose**: Generates container image lists for RHOAI disconnected (air-gapped) installations using oc-mirror

### Key Strengths
- Functional daily automation via GitHub Actions scheduled workflow
- Input validation for version format (rhoai-x.y / rhoai-x.y.z patterns)
- Image verification via skopeo digest comparison
- Clean README with usage instructions for both GitHub Actions and local execution

### Critical Gaps
- **Zero tests** across all dimensions — no unit, integration, or E2E tests
- **No PR validation** — changes merge without any automated checks
- **~90% code duplication** between y-stream and z-stream helper scripts
- **No security scanning** — outdated container base image, no Trivy/Snyk
- **No linting** — no shellcheck, no pre-commit hooks
- **Agent Rules Status**: Missing — no CLAUDE.md, no .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No test files exist anywhere in the repository |
| Integration/E2E | 0/10 | No integration or end-to-end tests of any kind |
| **Build Integration** | **1/10** | **Containerfile exists but is never built or validated in CI** |
| Image Testing | 1/10 | Containerfile present but no image build, scanning, or runtime testing |
| Coverage Tracking | 0/10 | No coverage tooling, no codecov, no thresholds |
| CI/CD Automation | 3/10 | Daily scheduled run and manual dispatch, but zero PR-time validation |
| Agent Rules | 0/10 | No CLAUDE.md, no .claude/ directory, no agent guidance |

## Critical Gaps

### 1. Zero Test Coverage (Severity: HIGH)
- **Impact**: Script regressions ship silently. A broken `find_images` function or incorrect version comparison could produce corrupted image lists, causing customer disconnected installations to fail.
- **Effort**: 16-24 hours to establish testing foundation
- **Details**: No `*_test.sh`, no bats files, no test framework of any kind. 1,272 lines of shell code with zero verification.

### 2. No PR-Triggered CI Workflows (Severity: HIGH)
- **Impact**: Code changes merge directly to main without any automated checks. Syntax errors, broken regex patterns, and logic bugs in version comparison are only discovered when the daily scheduled run fails — or worse, when customers report broken image lists.
- **Effort**: 4-8 hours
- **Details**: Both existing workflows are either scheduled (daily cron) or manual (workflow_dispatch). Neither triggers on pull_request events.

### 3. Massive Code Duplication (Severity: HIGH)
- **Impact**: `rhoai-dih.sh` (624 lines) and `rhoai-z-dih.sh` (546 lines) share approximately 90% identical code. Bug fixes applied to one file are frequently missed in the other, leading to behavioral divergence between y-stream and z-stream processing.
- **Effort**: 8-12 hours
- **Evidence**: Functions duplicated verbatim: `set_defaults`, `verify_image_exists`, `image_tag_to_digest`, `find_images`, `clone_repo`, `clone_all_repos`, `cleanup`, `parse_args`, and more. The z-stream variant has a typo ("ditected" at line 199 of `rhoai-z-dih.sh`) that was already fixed in the y-stream variant.

### 4. No Container Image Build or Security Scanning (Severity: HIGH)
- **Impact**: The Containerfile uses `ubi8/ubi-minimal:latest` (UBI8, not UBI9) and pins yq to v4.9.6 (released 2021). Known vulnerabilities in base image and dependencies go undetected.
- **Effort**: 4-6 hours
- **Details**: No Trivy, Snyk, or any scanning tool configured. No image build step in any CI workflow. No SBOM generation.

### 5. No ShellCheck or Linting (Severity: MEDIUM)
- **Impact**: Shell scripting anti-patterns accumulate: unquoted variables, missing `set -e`, commented-out blocks spanning 10+ lines, inconsistent error handling.
- **Effort**: 2-4 hours

### 6. Potential Command Injection in Workflows (Severity: MEDIUM)
- **Impact**: The workflow uses `${{ github.event.inputs.branch_name }}` directly in shell commands. While the regex validation catches most cases, the expansion happens before the validation step.
- **Effort**: 1-2 hours to fix by using environment variables exclusively.

## Quick Wins

### 1. Add ShellCheck to PR Workflow (1-2 hours)
```yaml
name: PR Validation
on: [pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Run ShellCheck
      uses: ludeeus/action-shellcheck@2.0.0
      with:
        scandir: '.'
        severity: warning
```

### 2. Pin GitHub Actions to SHA (30 minutes)
Replace mutable tags with commit SHAs:
```yaml
# Before (vulnerable to tag hijacking)
- uses: actions/checkout@v3
- uses: actions-js/push@master

# After (pinned to specific commits)
- uses: actions/checkout@<full-sha>  # v4
- uses: actions-js/push@<full-sha>
```

### 3. Update Containerfile (1 hour)
```dockerfile
# Before
FROM registry.access.redhat.com/ubi8/ubi-minimal:latest
RUN wget https://github.com/mikefarah/yq/releases/download/v4.9.6/yq_linux_amd64

# After
FROM registry.access.redhat.com/ubi9/ubi-minimal:latest
RUN wget https://github.com/mikefarah/yq/releases/download/v4.44.3/yq_linux_amd64
```

### 4. Add Basic Unit Tests with bats-core (4-6 hours)
```bash
# test/version_comparison.bats
#!/usr/bin/env bats

setup() {
  source rhoai-dih.sh
}

@test "is_rhods_version_greater_or_equal_to returns true for equal version" {
  rhods_version="rhoai-3.4"
  run is_rhods_version_greater_or_equal_to rhoai-3.4
  [ "$status" -eq 0 ]
}

@test "is_rhods_version_greater_or_equal_to returns false for lower version" {
  rhods_version="rhoai-2.8"
  run is_rhods_version_greater_or_equal_to rhoai-3.0
  [ "$status" -eq 1 ]
}

@test "validate_rhoai_branch accepts valid format" {
  run validate_rhoai_branch "rhoai-3.4"
  [ "$status" -eq 0 ]
}

@test "validate_rhoai_branch accepts EA format" {
  run validate_rhoai_branch "rhoai-3.4-ea.1"
  [ "$status" -eq 0 ]
}

@test "validate_rhoai_branch rejects invalid format" {
  run validate_rhoai_branch "invalid-version"
  [ "$status" -eq 1 ]
}
```

## Detailed Findings

### CI/CD Pipeline

**Workflows Found**: 2

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `rhods-disconnected-install-helper.yml` | Scheduled (daily noon UTC) + manual dispatch + repository_dispatch | Runs y-stream helper, auto-commits results |
| `rhods-disconnected-install-helper-z-stream.yml` | Manual dispatch only | Runs z-stream helper, auto-commits results |

**Issues**:
- No PR-triggered workflows at all
- Uses `actions/checkout@v3` (outdated — v4 is current)
- Uses `actions-js/push@master` (pinned to mutable branch, supply chain risk)
- No concurrency controls (parallel runs could conflict on auto-commits)
- No caching
- Y-stream workflow has input validation; z-stream workflow does not validate version format in the workflow step (relies on script-level validation)

### Test Coverage

| Test Type | Files | Framework | Coverage |
|-----------|-------|-----------|----------|
| Unit Tests | 0 | None | 0% |
| Integration Tests | 0 | None | 0% |
| E2E Tests | 0 | None | 0% |
| Smoke Tests | 0 | None | 0% |

**Test-to-Code Ratio**: 0:1272 (zero test lines to 1,272 lines of shell code)

### Code Quality

**Linting**: None configured
- No `.shellcheckrc`
- No `.editorconfig`
- No pre-commit hooks

**Code Issues Found**:
1. **Massive duplication**: `rhoai-dih.sh` and `rhoai-z-dih.sh` are ~90% identical
2. **Dead/commented-out code**: Multiple blocks of 5-15 lines commented out in both files
3. **Missing `set -e`**: Scripts use `set -o nounset` and `set -o pipefail` but not `set -o errexit`
4. **Inconsistent error handling**: Some functions use `exit 1`, others use `return 1`, some errors are commented out (`#exit 1`)
5. **Typo**: `rhoai-z-dih.sh:199` — "ditected" instead of "detected"
6. **Global state**: Heavy reliance on global variables (`rhods_version`, `repository_folder`, etc.) with no encapsulation
7. **No quoting in several places**: e.g., `echo $latest_rhods_version`, `notebooks_branch` used unquoted

### Container Images

**Containerfile Analysis**:
- Base: `registry.access.redhat.com/ubi8/ubi-minimal:latest` (outdated — UBI9 is current)
- Installs: bash, jq, gzip, skopeo, wget, git, findutils
- Installs OC CLI from `latest` (not pinned — non-reproducible builds)
- Pins yq to v4.9.6 (from 2021; current is v4.44+)
- No multi-stage build
- No `.dockerignore` (copies only specific file but not relevant)
- No health check
- No non-root user

**Image CI**: None — Containerfile is never built in any workflow.

### Security

| Security Practice | Status |
|-------------------|--------|
| Container scanning (Trivy/Snyk) | Not configured |
| SAST/CodeQL | Not configured |
| Dependency scanning | Not configured |
| Secret detection (Gitleaks) | Not configured |
| SBOM generation | Not configured |
| Image signing | Not configured |
| GitHub Actions pinned to SHA | No (uses mutable tags) |
| Input sanitization | Partial (regex validation exists but injection possible) |

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: N/A — no rules exist
- **Quality**: N/A
- **Gaps**: No CLAUDE.md, no .claude/ directory, no test creation rules, no documentation for AI-assisted development
- **Recommendation**: Generate rules with `/test-rules-generator` after establishing a basic test framework

## Recommendations

### Priority 0 (Critical)

1. **Add PR-triggered CI workflow** with shellcheck linting and bash syntax validation (`bash -n`)
2. **Write unit tests** for core functions using [bats-core](https://github.com/bats-core/bats-core):
   - Version comparison functions (`is_rhods_version_greater_or_equal_to`, `is_rhoai_34_or_greater`)
   - Input validation (`validate_rhoai_branch`, version format checks)
   - Image filtering functions (`filter_legacy_workbench_images_33`, `filter_legacy_workbench_images_34`)
   - Repository exclusion logic (`is_repo_excluded`)
3. **Fix command injection risk** in workflow by using environment variables:
   ```yaml
   - name: Validate branch
     env:
       BRANCH_NAME: ${{ github.event.inputs.branch_name }}
     run: |
       if [[ -n "$BRANCH_NAME" && ! "$BRANCH_NAME" =~ ^rhoai-[0-9]+\.[0-9]+(-ea\.[0-9]+)?$ ]]; then
         echo "Invalid format"; exit 1
       fi
   ```

### Priority 1 (High Value)

4. **Consolidate duplicate code** — extract shared functions into a single `lib/common.sh` sourced by both y-stream and z-stream scripts
5. **Add container image build and Trivy scanning** to CI
6. **Add integration tests** that run the script with `--skip-image-verification` against a known version and validate generated markdown output format
7. **Update Containerfile** — UBI8 → UBI9, pin yq to latest, pin OC CLI version
8. **Pin GitHub Actions to commit SHAs** instead of mutable tags

### Priority 2 (Nice-to-Have)

9. **Add pre-commit hooks** with shellcheck and YAML validation
10. **Create CLAUDE.md** and agent rules for development guidance
11. **Add codecov integration** once bats-core tests are established
12. **Implement release workflow** with semantic versioning and changelog generation
13. **Add `.editorconfig`** for consistent formatting across contributors
14. **Clean up dead code** — remove all commented-out blocks

## Comparison to Gold Standards

| Dimension | This Repo | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | None | Comprehensive Jest suite | Python tests | Go testing + coverage |
| Integration/E2E | None | Cypress E2E, contract tests | Image validation suite | Multi-version E2E |
| Build Integration | No CI builds | Multi-mode PR builds | 5-layer image validation | Konflux integration |
| Image Testing | Containerfile only | N/A | Gold standard (5 layers) | Image startup tests |
| Coverage Tracking | None | Codecov with enforcement | Coverage generation | Coverage gates |
| CI/CD Automation | Scheduled + manual only | PR + periodic + release | Comprehensive matrix | Full lifecycle |
| Agent Rules | None | Comprehensive .claude/rules/ | Partial | Partial |
| Code Quality | No linting | ESLint + Prettier | Linting configured | golangci-lint |

## File Paths Reference

| File | Purpose |
|------|---------|
| `rhoai-disconnected-helper.sh` | Main y-stream entry point (55 lines) |
| `rhoai-dih.sh` | Y-stream shared library (624 lines) |
| `rhoai-disconnected-helper-z-stream.sh` | Z-stream entry point (47 lines) |
| `rhoai-z-dih.sh` | Z-stream shared library (546 lines) |
| `releases.yaml` | Active release versions config |
| `Containerfile` | Container image definition |
| `.github/workflows/rhods-disconnected-install-helper.yml` | Daily + manual workflow |
| `.github/workflows/rhods-disconnected-install-helper-z-stream.yml` | Z-stream manual workflow |
| `rhoai-*.md` | Generated image list files (~72 files) |
