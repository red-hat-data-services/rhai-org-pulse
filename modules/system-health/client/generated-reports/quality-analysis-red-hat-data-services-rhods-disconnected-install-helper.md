---
repository: "red-hat-data-services/rhods-disconnected-install-helper"
overall_score: 1.0
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No test files exist — zero unit tests for 1,272 lines of Bash"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or end-to-end tests; script output is never validated"
  - dimension: "Build Integration"
    score: 1.0
    status: "No PR-triggered builds; only scheduled cron and manual dispatch"
  - dimension: "Image Testing"
    score: 1.0
    status: "Containerfile exists but no image build CI, no runtime validation, no scanning"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling, no thresholds, no reporting"
  - dimension: "CI/CD Automation"
    score: 3.0
    status: "Daily cron and manual dispatch workflows; no PR checks, no concurrency control"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules"
critical_gaps:
  - title: "Zero automated tests for critical infrastructure scripts"
    impact: "Any change to the 1,272 lines of Bash can silently break disconnected image list generation; broken output means customers cannot install RHOAI in air-gapped environments"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No PR-triggered CI checks"
    impact: "Contributors can merge syntax errors, broken logic, or regressions without any gating; issues only surface when the nightly cron runs or a customer reports failures"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "Massive code duplication between y-stream and z-stream scripts"
    impact: "rhoai-dih.sh (624 lines) and rhoai-z-dih.sh (546 lines) share ~80% identical code; bugs fixed in one are easily missed in the other, creating inconsistent behavior"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No shellcheck or linting on shell scripts"
    impact: "Unquoted variables, missing error handling (no set -e), and style inconsistencies go undetected; increases risk of runtime failures in production"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Container image has no security scanning or build CI"
    impact: "Containerfile installs tools from the internet without checksum verification; uses pinned but outdated yq v4.9.6; no vulnerability scanning"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "GitHub Actions workflow injection risk"
    impact: "Workflow uses ${{ github.event.inputs.branch_name }} directly in shell run steps without sanitization — potential command injection vector"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add ShellCheck linting to a PR workflow"
    effort: "1-2 hours"
    impact: "Catches unquoted variables, missing error handling, syntax issues before merge"
  - title: "Add set -o errexit (set -e) to all scripts"
    effort: "1 hour"
    impact: "Prevents silent failures from cascading through the script"
  - title: "Pin GitHub Actions to SHA instead of branch tags"
    effort: "30 minutes"
    impact: "Prevents supply chain attacks via mutable action tags"
  - title: "Sanitize workflow inputs via intermediate env var"
    effort: "30 minutes"
    impact: "Eliminates GitHub Actions expression injection risk"
  - title: "Upgrade actions/checkout from v3 to v4"
    effort: "15 minutes"
    impact: "Node.js 16 deprecation fix; security and performance improvements"
recommendations:
  priority_0:
    - "Add a PR-triggered workflow with ShellCheck linting and basic script smoke tests"
    - "Introduce BATS (Bash Automated Testing System) for unit testing shell functions"
    - "Refactor shared code into a single library sourced by both y-stream and z-stream scripts"
    - "Fix GitHub Actions expression injection by using intermediate environment variables"
  priority_1:
    - "Add image build CI that validates the Containerfile builds successfully on PRs"
    - "Add Trivy scanning for the container image"
    - "Create integration tests that run the script against a known version and validate output format"
    - "Add concurrency control to prevent parallel workflow runs from conflicting"
  priority_2:
    - "Create CLAUDE.md and agent rules for consistent test patterns"
    - "Add multi-architecture container image support"
    - "Add SBOM generation for the container image"
    - "Implement output validation tests that compare generated markdown against expected format"
---

# Quality Analysis: rhods-disconnected-install-helper

## Executive Summary
- **Overall Score: 1.0/10**
- **Repository Type**: Shell script utility (Bash)
- **Primary Language**: Bash (1,272 lines across 4 scripts)
- **Purpose**: Generates container image lists for disconnected/air-gapped RHOAI installations
- **Key Strengths**: Input validation on version format, GitHub rate limit checking, daily automated runs
- **Critical Gaps**: Zero tests, no PR checks, no linting, massive code duplication, no security scanning
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No test files exist — zero tests for 1,272 lines of Bash |
| Integration/E2E | 0/10 | No integration or end-to-end tests; output never validated |
| **Build Integration** | **1/10** | **No PR-triggered builds; only cron and manual dispatch** |
| Image Testing | 1/10 | Containerfile exists but untested, unscanned, no build CI |
| Coverage Tracking | 0/10 | No coverage tooling of any kind |
| CI/CD Automation | 3/10 | Daily cron + manual dispatch; no PR gating, no concurrency |
| Agent Rules | 0/10 | No CLAUDE.md, no `.claude/` directory, no rules |

## Critical Gaps

### 1. Zero Automated Tests for Critical Infrastructure Scripts
- **Impact**: Any change to the scripts can silently break image list generation. Broken output means customers cannot install RHOAI in disconnected environments.
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: The repository has 4 shell scripts totaling 1,272 lines with zero test files. Functions like `find_images()`, `verify_image_exists()`, `is_rhods_version_greater_or_equal_to()`, and `image_set_configuration()` contain complex logic that is completely untested.

### 2. No PR-Triggered CI Checks
- **Impact**: Contributors can merge syntax errors, broken logic, or regressions. Issues only surface when the nightly cron runs or a customer reports failures.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: Both workflows (y-stream and z-stream) are triggered only by `schedule`, `workflow_dispatch`, or `repository_dispatch`. There is no `pull_request` trigger, meaning PRs are merged without any automated validation.

### 3. Massive Code Duplication (~80%)
- **Impact**: `rhoai-dih.sh` (624 lines) and `rhoai-z-dih.sh` (546 lines) contain nearly identical functions: `set_defaults()`, `verify_image_exists()`, `clone_all_repos()`, `image_set_configuration()`, `parse_args()`, etc. Bugs fixed in one are easily missed in the other.
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: The z-stream variant lacks some features present in the y-stream version (e.g., `excluded_repos_from_rhoai_2_24`, `is_rhoai_34_or_greater()`, `filter_legacy_workbench_images_34()`). This divergence itself is a source of bugs — for instance, `rhoai-z-dih.sh` has a typo "ditected" instead of "detected" at line 200 that was already fixed in the y-stream version.

### 4. No Shell Linting or Static Analysis
- **Impact**: Unquoted variables, missing `set -e`, inconsistent error handling patterns, and dead/commented code go undetected.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Scripts use `set -o nounset` and `set -o pipefail` but NOT `set -o errexit`, meaning command failures are silently ignored. Multiple instances of unquoted variables (e.g., `echo $latest_rhods_version`, `git checkout $notebooks_branch`). Large blocks of commented-out code throughout both main scripts.

### 5. GitHub Actions Expression Injection Risk
- **Impact**: The y-stream workflow uses `${{ github.event.inputs.branch_name }}` directly in a `run:` step shell command. While the input is validated in a prior step, the validation step itself is vulnerable since it also uses the raw expression.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: In `.github/workflows/rhods-disconnected-install-helper.yml`, the `Validate branch name format` step writes `${{ github.event.inputs.branch_name }}` directly into the shell. Best practice is to pass it via an environment variable: `env: BRANCH: ${{ github.event.inputs.branch_name }}`.

### 6. Container Image Quality Issues
- **Impact**: Containerfile downloads tools from the internet without checksum verification, pins yq to an outdated version (v4.9.6, current is v4.44+), and has no security scanning.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: 
  - Uses `ubi8/ubi-minimal:latest` (mutable tag, not pinned)
  - Downloads `oc` CLI without SHA verification
  - yq v4.9.6 is over 3 years old
  - Only copies `rhods-disconnected-helper.sh` — missing z-stream script, `releases.yaml`, and helper scripts
  - No multi-architecture support
  - No Trivy/Snyk scanning in CI

## Quick Wins

### 1. Add ShellCheck Linting to a PR Workflow (1-2 hours)
```yaml
# .github/workflows/pr-checks.yml
name: PR Checks
on: [pull_request]
jobs:
  shellcheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run ShellCheck
        uses: ludeeus/action-shellcheck@2.0.0
        with:
          scandir: '.'
          severity: warning
```

### 2. Add `set -o errexit` to All Scripts (1 hour)
Add `set -o errexit` (or `set -e`) alongside the existing `set -o nounset` and `set -o pipefail` in both `rhoai-dih.sh` and `rhoai-z-dih.sh`. This prevents silent command failures.

### 3. Pin GitHub Actions to SHA (30 minutes)
```yaml
# Before (vulnerable to tag mutation):
- uses: actions/checkout@v3
- uses: actions-js/push@master

# After (supply chain safe):
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # v4.1.1
- uses: actions-js/push@5a7cbd780d82c0c937b5977586e641b2fd94acc5  # v1.5
```

### 4. Sanitize Workflow Inputs (30 minutes)
```yaml
- name: Validate branch name format
  env:
    RHOAI_BRANCH: ${{ github.event.inputs.branch_name }}
  run: |
    if [[ -n "$RHOAI_BRANCH" && ! "$RHOAI_BRANCH" =~ ^rhoai-[0-9]+\.[0-9]+(-ea\.[0-9]+)?$ ]]; then
      echo "Invalid format!"
      exit 1
    fi
```

### 5. Upgrade actions/checkout to v4 (15 minutes)
Replace `actions/checkout@v3` with `actions/checkout@v4` in both workflow files. Node.js 16 (used by v3) is deprecated.

## Detailed Findings

### CI/CD Pipeline

**Workflows Identified:**
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `rhods-disconnected-install-helper.yml` | `schedule` (daily), `workflow_dispatch`, `repository_dispatch` | Run y-stream image list generation |
| `rhods-disconnected-install-helper-z-stream.yml` | `workflow_dispatch` only | Run z-stream image list generation |

**Issues:**
- No `pull_request` trigger on either workflow — PRs merge without checks
- No concurrency control — parallel runs could conflict on git push
- No caching strategy
- Using `actions-js/push@master` (third-party community action pinned to mutable `master` branch)
- Both workflows commit directly to `main` — no branch protection or review gate
- Y-stream workflow pulls before pushing but z-stream does not — race condition risk

### Test Coverage

**Test Files Found**: 0
**Test Frameworks**: None configured
**Test-to-Code Ratio**: 0:1,272

**Functions That Urgently Need Tests:**

| Function | File | Lines | Risk |
|----------|------|-------|------|
| `is_rhods_version_greater_or_equal_to()` | Both | ~12 | Version comparison logic, affects all conditional paths |
| `find_images()` | Both | ~70 | Core image discovery logic, varies by version |
| `validate_rhoai_branch()` | `rhoai-disconnected-helper.sh` | ~5 | Input validation, security boundary |
| `image_set_configuration()` | Both | ~60 | Output generation, customer-facing |
| `is_repo_excluded()` | Both | ~12 | Repository filtering, differs between scripts |
| `parse_args()` | Both | ~50 | Argument parsing, many options |

### Code Quality

**Shell Script Analysis:**
- `set -o nounset`: Present (good)
- `set -o pipefail`: Present (good)
- `set -o errexit`: **MISSING** (critical gap)
- ShellCheck: Not configured
- shfmt: Not configured
- Pre-commit hooks: None

**Code Duplication:**
The two main library files (`rhoai-dih.sh` and `rhoai-z-dih.sh`) share approximately 80% identical code. Key differences:
- Y-stream has `excluded_repos_from_rhoai_2_24` array — z-stream does not
- Y-stream has `is_rhoai_34_or_greater()` and `get_base_branch()` — z-stream does not
- Y-stream has separate `filter_legacy_workbench_images_33()` and `filter_legacy_workbench_images_34()` — z-stream only has `filter_legacy_workbench_images()`
- Z-stream still references `must_gather_image` in `image_set_configuration()` but y-stream has removed this

**Dead Code:**
- Large blocks of commented-out code in both scripts (e.g., lines 166-178 in `rhoai-dih.sh`)
- Commented-out `update_must_gather()` calls
- Unused `find_quay_images()` and `count_number_images()` functions in both files

### Container Images

**Containerfile Analysis:**
- Base image: `registry.access.redhat.com/ubi8/ubi-minimal:latest` (mutable tag)
- Installs: bash, jq, gzip, skopeo, wget, git, findutils, oc CLI, yq
- Issues:
  - `oc` downloaded without checksum verification
  - yq pinned to v4.9.6 (released 2021, current is v4.44+)
  - Only copies `rhods-disconnected-helper.sh` — missing `rhoai-dih.sh` (sourced dependency), `releases.yaml`, z-stream scripts
  - The container image would fail at runtime because `source rhoai-dih.sh` cannot find the file
  - No `.dockerignore` excluding `.git/`, markdown files, etc. (`.dockerignore` is not present)
  - No health check
  - No multi-architecture support
  - No SBOM generation

### Security

- **SAST/CodeQL**: Not configured
- **Secret Detection**: Not configured
- **Dependency Scanning**: Not applicable (shell scripts)
- **Container Scanning**: Not configured
- **GitHub Actions Hardening**: Actions not pinned to SHA; uses mutable tags
- **Expression Injection**: `${{ github.event.inputs.* }}` used directly in `run:` steps
- **Branch Protection**: Unknown (cannot verify from repo clone)

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No test types have rules
- **Quality**: N/A
- **Gaps**: No `CLAUDE.md`, no `.claude/` directory, no agent rules of any kind
- **Recommendation**: Generate rules with `/test-rules-generator` after establishing initial test infrastructure

## Recommendations

### Priority 0 (Critical)

1. **Create a PR-triggered CI workflow with ShellCheck**
   - Add `.github/workflows/pr-checks.yml` with `on: [pull_request]`
   - Include ShellCheck linting, basic syntax validation
   - Block merges without passing checks via branch protection rules

2. **Introduce BATS testing framework**
   - [BATS](https://github.com/bats-core/bats-core) is the standard for Bash testing
   - Start with `is_rhods_version_greater_or_equal_to()` — pure function, easy to test
   - Add tests for `validate_rhoai_branch()` and `parse_args()`
   - Example:
   ```bash
   # test/version_comparison.bats
   setup() {
     source rhoai-dih.sh
   }
   
   @test "version 2.25 >= 2.4 returns true" {
     rhods_version="rhoai-2.25"
     run is_rhods_version_greater_or_equal_to rhods-2.4
     [ "$status" -eq 0 ]
   }
   
   @test "version 2.3 >= 2.4 returns false" {
     rhods_version="rhoai-2.3"
     run is_rhods_version_greater_or_equal_to rhods-2.4
     [ "$status" -eq 1 ]
   }
   ```

3. **Refactor shared code into a single library**
   - Extract common functions into `lib/common.sh`
   - Have both y-stream and z-stream scripts source from the same library
   - Eliminates the ~80% code duplication and divergence bugs

4. **Fix GitHub Actions expression injection**
   - Pass all `${{ github.event.inputs.* }}` via `env:` blocks, never directly in `run:` shell

### Priority 1 (High Value)

5. **Add container image build CI**
   - Build the Containerfile on PRs to catch build failures
   - Add Trivy scanning for vulnerability detection
   - Fix the broken COPY (missing sourced scripts)

6. **Add output format validation tests**
   - Create golden-file tests that compare script output against expected markdown format
   - Ensures the ImageSetConfiguration template remains valid YAML

7. **Add concurrency control to workflows**
   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: false
   ```

8. **Clean up dead code**
   - Remove commented-out blocks
   - Remove unused functions (`find_quay_images`, `count_number_images`)

### Priority 2 (Nice-to-Have)

9. **Create CLAUDE.md and agent rules**
   - Document testing patterns, script structure, and contribution guidelines
   - Add rules for shell script best practices

10. **Pin container base image and tool versions**
    - Use digest-pinned base image instead of `:latest`
    - Update yq to current version with SHA verification
    - Add checksum verification for oc CLI download

11. **Add multi-architecture container support**
    - Build for `linux/amd64` and `linux/arm64`

12. **Add SBOM generation**
    - Use Syft or similar tool in the container build pipeline

## Comparison to Gold Standards

| Dimension | This Repo | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | None | Jest + React Testing Library | pytest per image | Go testing + envtest |
| Integration/E2E | None | Cypress E2E suite | Multi-layer validation | KServe E2E framework |
| Build Integration | No PR builds | PR-time build checks | PR image builds | PR operator testing |
| Image Testing | Untested Containerfile | N/A | 5-layer image validation | Multi-version testing |
| Coverage Tracking | None | Codecov with thresholds | Per-image coverage | Codecov enforcement |
| CI/CD | Cron + manual only | Comprehensive PR + merge CI | Automated matrix testing | Multi-version CI matrix |
| Agent Rules | None | Comprehensive .claude/rules/ | Basic rules | N/A |
| Linting | None | ESLint + Prettier | Ruff + mypy | golangci-lint |
| Security Scanning | None | Snyk + CodeQL | Trivy + SAST | CodeQL + gosec |

## File Paths Reference

| Category | Path | Notes |
|----------|------|-------|
| Y-stream workflow | `.github/workflows/rhods-disconnected-install-helper.yml` | Daily cron + manual |
| Z-stream workflow | `.github/workflows/rhods-disconnected-install-helper-z-stream.yml` | Manual only |
| Main entry (y-stream) | `rhoai-disconnected-helper.sh` | 55 lines, sources rhoai-dih.sh |
| Main library (y-stream) | `rhoai-dih.sh` | 624 lines, core logic |
| Main entry (z-stream) | `rhoai-disconnected-helper-z-stream.sh` | 47 lines, sources rhoai-z-dih.sh |
| Main library (z-stream) | `rhoai-z-dih.sh` | 546 lines, duplicated core logic |
| Container build | `Containerfile` | UBI8 minimal, broken COPY |
| Release config | `releases.yaml` | Lists active release versions |
| Git ignore | `.gitignore` | Excludes .vscode, .idea, .odh-manifests |
| Output files | `rhoai-*.md` | Generated image lists per version |
