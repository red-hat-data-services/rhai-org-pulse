---
repository: "red-hat-data-services/insta-merge"
overall_score: 0.6
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No tests of any kind exist"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or end-to-end tests"
  - dimension: "Build Integration"
    score: 0.0
    status: "No CI/CD workflows; no PR-time validation"
  - dimension: "Image Testing"
    score: 1.0
    status: "Dockerfile exists but is untested; unpinned base image tag"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling or reporting"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "No GitHub Actions workflows in the repository itself"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, .claude/ directory, or agent rules"
critical_gaps:
  - title: "Zero test coverage"
    impact: "Any change to entrypoint.sh can silently break merge/rebase logic for all consumers"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No CI/CD pipeline"
    impact: "No automated checks on PRs — broken code can be merged without detection"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Security: GitHub token exposed via set -x and git config"
    impact: "Token is echoed to GitHub Actions logs and stored in git config on disk"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "Multiple bugs in entrypoint.sh"
    impact: "Typos and undefined variables cause silent failures in downstream branch fallback and HTTPS URL construction"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "Unpinned base image tag"
    impact: "Builds are not reproducible; a bad upstream push to :latest breaks all consumers"
    severity: "MEDIUM"
    effort: "0.5 hours"
quick_wins:
  - title: "Fix known bugs in entrypoint.sh"
    effort: "1-2 hours"
    impact: "Correct typo on line 43 (DOWNSTREAM_BREANCH), undefined var on line 47 (UPSTREAM_REPO_PATH), and missing error handling"
  - title: "Add set -euo pipefail and mask token from logs"
    effort: "1 hour"
    impact: "Prevent silent failures and stop leaking GitHub token to CI logs"
  - title: "Add a basic CI workflow with ShellCheck"
    effort: "1-2 hours"
    impact: "Catch shell scripting errors automatically on every PR"
  - title: "Pin Dockerfile base image to a digest"
    effort: "0.5 hours"
    impact: "Reproducible builds; protect against supply-chain attacks via :latest tag"
  - title: "Add BATS tests for entrypoint.sh"
    effort: "4-6 hours"
    impact: "Regression protection for the core merge/rebase logic"
recommendations:
  priority_0:
    - "Fix the three known bugs in entrypoint.sh (typo, undefined variable, missing $ prefix)"
    - "Stop leaking GitHub token: remove set -x or mask sensitive vars, remove git config user.password"
    - "Add a minimal CI workflow that runs ShellCheck and BATS tests on PRs"
  priority_1:
    - "Write BATS unit tests covering: successful merge, conflict resolution, PR merge path, error cases"
    - "Pin Dockerfile base image to a specific digest for reproducible builds"
    - "Add Trivy or Grype scanning for the Docker image"
  priority_2:
    - "Add integration tests that exercise the action in a real GitHub Actions environment"
    - "Add Dependabot for gh CLI version updates in Dockerfile"
    - "Create CLAUDE.md and agent rules for test creation guidance"
---

# Quality Analysis: insta-merge

## Executive Summary

- **Overall Score: 0.6/10**
- **Repository Type**: GitHub Action (Docker-based, Bash entrypoint)
- **Primary Language**: Bash (~110 lines)
- **Purpose**: Merges upstream repo changes into downstream forks with conflict resolution
- **Key Strengths**: Simple, single-purpose tool; clear README documentation
- **Critical Gaps**: Zero tests, zero CI/CD, active security vulnerabilities (token leakage), multiple bugs in core script
- **Agent Rules Status**: Missing

This repository has virtually no quality infrastructure. It is a small GitHub Action with a single bash entrypoint script, but even for its size, it lacks basic safeguards: there are no tests, no CI pipeline, no linting, and the shell script contains at least three bugs and a security issue that leaks the GitHub token to CI logs.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No tests of any kind |
| Integration/E2E | 0/10 | No integration or end-to-end tests |
| **Build Integration** | **0/10** | **No CI/CD workflows; no PR-time validation** |
| Image Testing | 1/10 | Dockerfile exists but is untested |
| Coverage Tracking | 0/10 | No coverage tooling or reporting |
| CI/CD Automation | 0/10 | No GitHub Actions workflows |
| Agent Rules | 0/10 | No agent rules or testing guidance |

## Critical Gaps

### 1. Zero Test Coverage
- **Impact**: Any change to `entrypoint.sh` can silently break merge/rebase logic for all downstream consumers
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The repository has no test files whatsoever. The core business logic in `entrypoint.sh` handles git operations (clone, fetch, merge, push, conflict resolution) with no automated verification. For a GitHub Action used across the `red-hat-data-services` organization, this is a critical risk.

### 2. No CI/CD Pipeline
- **Impact**: No automated checks on PRs; broken code can be merged undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The `.github/workflows/` directory does not exist. There is no PR validation, no linting, no build verification, and no release automation. Ironically, this is a GitHub Actions tool with no GitHub Actions of its own.

### 3. Security: GitHub Token Exposure
- **Impact**: Token is echoed to GitHub Actions logs via `set -x` and stored in git config on disk
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**:
  - `entrypoint.sh:3` — `set -x` causes every command (including those with `$GITHUB_TOKEN`) to be echoed to stdout, which appears in GitHub Actions logs
  - `entrypoint.sh:67` — `git config --local user.password ${GITHUB_TOKEN}` stores the token in the `.git/config` file
  - `entrypoint.sh:56,60` — Token is embedded in the git remote URL, which is visible via `git remote -v` output on line 72

### 4. Multiple Bugs in entrypoint.sh
- **Impact**: Silent failures in several code paths
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Bugs found**:
  - **Line 43**: `DOWNSTREAM_BREANCH=UPSTREAM_BRANCH` — Typo in variable name (`BREANCH` instead of `BRANCH`) and missing `$` prefix (assigns the literal string `"UPSTREAM_BRANCH"` instead of the variable's value). Should be `DOWNSTREAM_BRANCH=$UPSTREAM_BRANCH`.
  - **Line 47**: `UPSTREAM_REPO="https://github.com/${UPSTREAM_REPO_PATH}.git"` — Uses `$UPSTREAM_REPO_PATH` which is never defined anywhere in the script. Should likely reference `$UPSTREAM_REPO`.
  - **Line 100**: `if [[ $MERGE_RESULT == "" ]]` — Empty `MERGE_RESULT` is treated as failure, but `git merge` can return empty output in some edge cases.

### 5. Unpinned Base Image
- **Impact**: Non-reproducible builds; supply-chain risk
- **Severity**: MEDIUM
- **Effort**: 0.5 hours
- **Details**: `Dockerfile:1` uses `quay.io/rhoai-konflux/alpine:latest`. The `:latest` tag means every build can produce a different image. A compromised or broken upstream push breaks all consumers silently.

## Quick Wins

### 1. Fix Known Bugs (1-2 hours)
Fix the three bugs in `entrypoint.sh`:
```bash
# Line 43: Fix typo and missing $
DOWNSTREAM_BRANCH=$UPSTREAM_BRANCH

# Line 47: Use correct variable name
UPSTREAM_REPO="https://github.com/${UPSTREAM_REPO}.git"
```

### 2. Harden Shell Script (1 hour)
```bash
#!/usr/bin/env bash
set -euo pipefail

# Mask token from logs instead of set -x
# Use selective debugging:
log() { echo "::group::$1"; }
```
Remove `git config --local user.password` (the token is already in the remote URL).

### 3. Add ShellCheck CI Workflow (1-2 hours)
```yaml
# .github/workflows/ci.yml
name: CI
on: [pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: ShellCheck
        uses: ludeeus/action-shellcheck@master
        with:
          scandir: '.'
```

### 4. Pin Base Image (0.5 hours)
```dockerfile
FROM quay.io/rhoai-konflux/alpine@sha256:<pin-to-specific-digest>
```

### 5. Add BATS Tests (4-6 hours)
```bash
# test/entrypoint.bats
@test "exits 1 when UPSTREAM_REPO is missing" {
  run ./entrypoint.sh "" "main" "" "token"
  [ "$status" -eq 1 ]
  [[ "$output" == *"Missing"* ]]
}
```

## Detailed Findings

### CI/CD Pipeline

**Status: Non-existent**

The repository has no `.github/workflows/` directory. There is no automation of any kind:
- No PR checks
- No lint validation
- No build verification
- No release process
- No scheduled testing

The only file referencing GitHub Actions is `action.yml`, which defines this repository *as* a GitHub Action for others to consume.

**Files analyzed**: Root directory listing (no workflows found)

### Test Coverage

**Status: Zero**

- **Test files found**: 0
- **Test frameworks**: None
- **Test-to-code ratio**: 0:1
- **Coverage generation**: None
- **Coverage reporting**: None

The entire business logic (~110 lines of bash) is untested. Key logic paths that need testing:
1. PR merge via `gh pr merge` (line 18)
2. Upstream branch detection via GitHub API (lines 33-37)
3. Downstream branch fallback logic (lines 40-44)
4. Conflict resolution via `.gitattributes` merge strategy (lines 88-94)
5. Merge result handling and push (lines 96-108)

### Code Quality

**Status: No tooling**

- **Linting**: No ShellCheck configuration or CI integration
- **Pre-commit hooks**: None (`.pre-commit-config.yaml` absent)
- **Static analysis**: None
- **Code style**: Inconsistent quoting, mixed use of `[[ ]]` and pattern matching

**Shell script issues identified by manual review**:
- Missing `set -e` / `set -o pipefail` — failures in git commands do not abort the script
- Unquoted variables in multiple places (e.g., `git clone $DOWNSTREAM_REPO work` on line 59)
- No input validation for required parameters
- Hardcoded `gh` CLI version (`v2.58.0`) in Dockerfile with no update mechanism

### Container Images

**Status: Minimal**

- **Dockerfile**: Single-stage, Alpine-based
- **Base image**: `quay.io/rhoai-konflux/alpine:latest` (unpinned)
- **Multi-arch**: Not supported (downloads `linux_386` binary explicitly)
- **Security scanning**: None (no Trivy, Snyk, or Grype)
- **SBOM**: Not generated
- **Image signing**: Not configured
- **Runtime testing**: None
- **Size optimization**: Moderate (Alpine base, but leaves wget/tar artifacts and /ghcli directory)

**Dockerfile concerns**:
- Line 10: Downloads `gh` CLI for `linux_386` architecture only — will fail on ARM64 runners
- Line 10: Hardcoded version `v2.58.0` with no Dependabot or Renovate config
- Line 12: Leftover `/ghcli` directory not cleaned up (wastes image space)

### Security

**Status: Critical issues**

| Check | Status |
|-------|--------|
| Secret detection (Gitleaks) | Not configured |
| SAST/CodeQL | Not configured |
| Container scanning | Not configured |
| Dependency scanning | Not configured |
| Token handling | **INSECURE** — leaked via `set -x` and git config |
| Input validation | Missing |
| Supply chain | Unpinned base image, unpinned gh CLI download over HTTPS |

**Specific security concerns**:
1. `set -x` on line 3 echoes every command including token-bearing URLs to logs
2. `git config --local user.password ${GITHUB_TOKEN}` on line 67 stores token in `.git/config`
3. Token embedded in remote URLs visible in `git remote -v` output
4. No checksum verification for the `gh` CLI binary downloaded in Dockerfile
5. `wget` over HTTPS without certificate pinning for `gh` CLI download

### Agent Rules (Agentic Flow Quality)

**Status: Missing**

- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **`.claude/` directory**: Not present
- **`.claude/rules/`**: Not present
- **Test creation rules**: None
- **Recommendation**: Generate rules with `/test-rules-generator` to establish BATS testing patterns

## Recommendations

### Priority 0 (Critical)

1. **Fix the three bugs in `entrypoint.sh`** — The typo on line 43, undefined variable on line 47, and missing `$` prefix cause silent failures in fallback code paths.

2. **Fix token leakage** — Remove `set -x` (or replace with selective logging that masks secrets), remove `git config --local user.password`, and use `::add-mask::` to mask the token in GitHub Actions logs.

3. **Add a minimal CI workflow** — At minimum, run ShellCheck on PRs. This would have caught the bugs listed above.

### Priority 1 (High Value)

4. **Write BATS tests for entrypoint.sh** — Cover the five key code paths: PR merge, upstream detection, downstream fallback, conflict resolution, and merge+push. Use mocks for git and `gh` commands.

5. **Pin Dockerfile dependencies** — Pin the base image to a digest and verify the `gh` CLI checksum after download.

6. **Add container image scanning** — Integrate Trivy or Grype to scan the built Docker image for vulnerabilities.

### Priority 2 (Nice-to-Have)

7. **Add integration tests** — Test the action in a real GitHub Actions environment with a test repository pair.

8. **Set up Dependabot/Renovate** — Automate updates for the `gh` CLI version and base image.

9. **Add agent rules** — Create `.claude/rules/` with BATS test patterns and shell scripting standards.

10. **Support multi-architecture** — Download the correct `gh` CLI binary for the runner architecture instead of hardcoding `linux_386`.

## Comparison to Gold Standards

| Dimension | insta-merge | odh-dashboard | notebooks | kserve |
|-----------|-------------|---------------|-----------|--------|
| Unit Tests | 0/10 | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 0/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 0/10 | 8/10 | 7/10 | 8/10 |
| Image Testing | 1/10 | 7/10 | 9/10 | 7/10 |
| Coverage Tracking | 0/10 | 8/10 | 5/10 | 9/10 |
| CI/CD Automation | 0/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 0/10 | 8/10 | 3/10 | 2/10 |
| **Overall** | **0.6/10** | **8.5/10** | **7.0/10** | **8.0/10** |

## File Paths Reference

| File | Purpose | Issues |
|------|---------|--------|
| `action.yml` | GitHub Action definition | Clean, well-structured |
| `Dockerfile` | Container build | Unpinned base, hardcoded arch, no cleanup |
| `entrypoint.sh` | Core merge logic | 3 bugs, token leakage, no error handling |
| `README.md` | Documentation | Adequate, references original upstream |
| `.gitignore` | Git ignore rules | Minimal (only `*~`) |
