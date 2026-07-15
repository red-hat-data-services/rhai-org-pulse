---
repository: "red-hat-data-services/RDRhelper"
overall_score: 0.4
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No test files exist anywhere in the repository"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests; test/ directory only has manual shell scripts"
  - dimension: "Build Integration"
    score: 1.0
    status: "GoReleaser for multi-platform binaries but no PR-time build validation"
  - dimension: "Image Testing"
    score: 1.0
    status: "N/A - CLI binary distribution via GoReleaser, no container images produced"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling, thresholds, or reporting configured"
  - dimension: "CI/CD Automation"
    score: 1.0
    status: "No GitHub Actions workflows; GoReleaser releases to GitLab only"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, .claude/ directory, or test automation guidance"
critical_gaps:
  - title: "Zero automated tests"
    impact: "Any change risks silent regressions in cluster operations (failover, install, verify) with no safety net"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No CI/CD pipeline"
    impact: "Code changes are not validated before merge; broken builds and regressions go undetected"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "Severely outdated dependencies"
    impact: "Go 1.16 and Kubernetes client-go 0.20.5 are years behind; known CVEs likely present"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No security scanning"
    impact: "Vulnerable dependencies and potential code-level security issues are invisible"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Project appears unmaintained"
    impact: "Last commit was January 2022 (4+ years ago); locked to ODF 4.7 which is EOL"
    severity: "HIGH"
    effort: "N/A - organizational decision required"
quick_wins:
  - title: "Add a basic GitHub Actions CI workflow"
    effort: "2-3 hours"
    impact: "Validates builds on every PR, catches compilation errors before merge"
  - title: "Add go vet and staticcheck to CI"
    effort: "1-2 hours"
    impact: "Catches common Go bugs (unused variables, incorrect format strings, interface issues)"
  - title: "Run govulncheck for dependency CVE scanning"
    effort: "1 hour"
    impact: "Identifies known vulnerabilities in the dependency tree"
  - title: "Add unit tests for pure helper functions"
    effort: "3-4 hours"
    impact: "Covers stringInSlice, getRBDInfoFromPV, validateS3info, PVInSlice - no cluster needed"
recommendations:
  priority_0:
    - "Decide whether this project is still maintained; if not, archive it and document the successor tool"
    - "If maintained: add unit tests for all non-cluster-dependent functions (helpers, config parsing, validation)"
    - "Create a basic GitHub Actions workflow for build + vet + lint on PRs"
  priority_1:
    - "Upgrade Go version from 1.16 to latest stable and update all Kubernetes dependencies"
    - "Add integration tests using envtest or fake client for Kubernetes API interactions"
    - "Add govulncheck and golangci-lint to CI pipeline"
  priority_2:
    - "Add agent rules (.claude/rules/) for test creation guidance"
    - "Add pre-commit hooks for formatting and linting"
    - "Consider containerizing the tool for easier distribution"
---

# Quality Analysis: RDRhelper

## Executive Summary

- **Overall Score: 0.4/10**
- **Repository**: [red-hat-data-services/RDRhelper](https://github.com/red-hat-data-services/RDRhelper)
- **Type**: Go TUI (Terminal UI) application for Regional Disaster Recovery on OpenShift
- **Language**: Go 1.16
- **Size**: ~2,568 lines of Go code across 8 source files
- **Last Commit**: January 13, 2022 (4+ years ago)
- **Key Strengths**: Cross-platform binary releases via GoReleaser; CODEOWNERS file exists
- **Critical Gaps**: Zero tests, zero CI/CD, severely outdated dependencies, appears unmaintained
- **Agent Rules Status**: Missing - no CLAUDE.md, .claude/ directory, or test guidance

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No test files exist anywhere in the repository |
| Integration/E2E | 0/10 | No integration or E2E tests; `test/` has only manual shell scripts |
| **Build Integration** | **1/10** | **GoReleaser for multi-platform binaries but no PR-time build validation** |
| Image Testing | 1/10 | N/A - CLI binary via GoReleaser, no container images |
| Coverage Tracking | 0/10 | No coverage tooling, thresholds, or reporting |
| CI/CD Automation | 1/10 | No GitHub Actions; GoReleaser releases to GitLab only |
| Agent Rules | 0/10 | No AI agent test guidance |

## Critical Gaps

### 1. Zero Automated Tests
- **Impact**: Any change risks silent regressions in cluster operations (failover, install, verify) with no safety net
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: The repository contains zero `*_test.go` files. The `test/` directory only contains `apply.sh` and `delete.sh` shell scripts for manual PVC creation/deletion using `oc` CLI and `j2` templates - these are manual cluster helpers, not automated tests. None of the 8 Go source files (~2,568 lines) have any test coverage. Functions like `validateKubeConfig`, `getRBDInfoFromPV`, `validateS3info`, `stringInSlice`, and `PVInSlice` are easily unit-testable without cluster access.

### 2. No CI/CD Pipeline
- **Impact**: Code changes are not validated before merge; broken builds and regressions go undetected
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The `.github/` directory contains only a `CODEOWNERS` file. No GitHub Actions workflows exist. There is no Makefile. The only build tooling is `.goreleaser.yml` which builds cross-platform binaries and releases to GitLab (gitlab.consulting.redhat.com), not GitHub. The `modd.conf` provides hot-reload during development (`go run *.go`) but there is no automated build validation.

### 3. Severely Outdated Dependencies
- **Impact**: Go 1.16 and Kubernetes client-go 0.20.5 are years behind; known CVEs likely present
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Details**: The `go.mod` specifies Go 1.16 (released February 2021). Dependencies are pinned to Kubernetes 0.20.5 (2021 era). The module path references `gitlab.consulting.redhat.com/cblum/RDRhelper`, indicating it was originally a GitLab project. The code explicitly states it's for ODF 4.7: the `checkInstallRequirements` function enforces `ocsVersion.Major == 4 && ocsVersion.Minor == 7`.

### 4. No Security Scanning
- **Impact**: Vulnerable dependencies and potential code-level security issues are invisible
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Trivy, Snyk, CodeQL, gosec, govulncheck, or any security scanning tool is configured. No `.gitleaks.toml` or secret detection. The application handles Kubernetes credentials, S3 access keys, and cluster secrets - making security scanning particularly important. S3 credentials are stored in a user config file at `~/.config/RDRhelper.conf`.

### 5. Project Appears Unmaintained
- **Impact**: Last commit was January 2022; locked to ODF 4.7 which is end-of-life
- **Severity**: HIGH
- **Effort**: N/A - organizational decision required
- **Details**: The most recent commit message ("RDRhelper is for ODF 4.7, not for anything newer") explicitly states the tool is version-locked. ODF 4.7 is well past end-of-life. There have been no commits in over 4 years. This suggests the project has been superseded by newer DR solutions.

## Quick Wins

### 1. Add a Basic GitHub Actions CI Workflow
- **Effort**: 2-3 hours
- **Impact**: Validates builds on every PR, catches compilation errors before merge
- **Implementation**:
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version-file: go.mod
      - run: go build ./...
      - run: go vet ./...
```

### 2. Add go vet and staticcheck
- **Effort**: 1-2 hours
- **Impact**: Catches common Go bugs (unused variables, incorrect format strings, interface issues)
- **Details**: Several code patterns in the repository would benefit from static analysis, such as format string mismatches in `errors.Wrapf` calls.

### 3. Run govulncheck
- **Effort**: 1 hour
- **Impact**: Identifies known vulnerabilities in the dependency tree
- **Implementation**: `go install golang.org/x/vuln/cmd/govulncheck@latest && govulncheck ./...`

### 4. Add Unit Tests for Pure Helper Functions
- **Effort**: 3-4 hours
- **Impact**: Covers the easily testable functions without requiring cluster access
- **Candidates**:
  - `stringInSlice` / `stringInSliceBool` (helperFuncs.go)
  - `getRBDInfoFromPV` (change.go)
  - `validateS3info` (install.go)
  - `PVInSlice` / `RemovePVFromSlice` (pvcView.go)

## Detailed Findings

### CI/CD Pipeline

**Score: 1/10**

- **Workflows**: None. `.github/` contains only `CODEOWNERS` (assigns `@mulbc @mid998` as default reviewers)
- **Build tooling**: `.goreleaser.yml` configured for cross-platform builds (linux/windows/darwin × amd64/arm64) as standalone binaries
- **Release target**: GitLab at `gitlab.consulting.redhat.com` (not GitHub)
- **Dev workflow**: `modd.conf` runs `go run *.go` on file changes for hot-reload
- **Missing**: PR validation, automated testing, linting, security scanning

### Test Coverage

**Score: 0/10**

- **Unit tests**: Zero `*_test.go` files
- **Integration tests**: None
- **E2E tests**: None
- **Test helpers**: `test/` directory contains only `apply.sh` and `delete.sh` - shell scripts that use `oc apply` and `oc delete` with j2 templates to create/delete 20 PVCs in parallel. These are manual cluster-level helpers, not automated tests.
- **Test-to-code ratio**: 0:2568 (0%)
- **Coverage tracking**: None

### Code Quality

**Score: 1/10**

- **Linting**: No `.golangci.yaml` or any linter configuration
- **Formatting**: No `gofmt` / `goimports` enforcement
- **Pre-commit hooks**: No `.pre-commit-config.yaml`
- **Static analysis**: No SAST tools
- **Code patterns observed**:
  - Error handling is generally present but inconsistent (some errors are silently ignored)
  - Global mutable state (`var pages`, `var app`, `var mainMenu`, etc.)
  - Some commented-out code blocks (`changeRBDStorageClasstoRetain`)
  - Tight coupling between UI and business logic
  - Busy-wait loops without backoff (e.g., `enableOMAPGenerator` loops indefinitely)

### Container Images

**Score: 1/10 (largely N/A)**

- **No Dockerfile**: Tool is distributed as a standalone Go binary via GoReleaser
- **No container builds**: Binary releases only
- **Cross-platform**: GoReleaser builds for linux/windows/darwin on amd64/arm64
- **Format**: Standalone binaries (not archives/tarballs)
- **Note**: For a CLI tool, binary distribution is acceptable, but container packaging could improve distribution

### Security

**Score: 0/10**

- **Vulnerability scanning**: None
- **SAST/CodeQL**: Not configured
- **Dependency scanning**: None
- **Secret detection**: None
- **Concerns**:
  - Handles Kubernetes kubeconfigs and cluster credentials
  - Stores S3 access keys in `~/.config/RDRhelper.conf` (YAML format)
  - Executes arbitrary commands in cluster pods via `remotecommand` (`executeInPod`)
  - Old dependencies likely contain known CVEs
  - `go.sum` integrity is the only dependency verification

### Agent Rules (Agentic Flow Quality)

**Score: 0/10**

- **Status**: Missing
- **Coverage**: No test type rules
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **Testing documentation**: Not present
- **Recommendation**: If project becomes active, generate rules with /test-rules-generator

## Recommendations

### Priority 0 (Critical)

1. **Decide project fate**: Determine whether RDRhelper is still needed or has been replaced by newer DR solutions (e.g., ODF DR, RHACM DR). If superseded, archive the repository with a clear notice pointing to the successor.
2. **If maintained**: Add unit tests for all non-cluster-dependent functions (helpers, config parsing, validation logic). Target: at least 30% coverage of utility functions.
3. **Create a basic CI pipeline**: GitHub Actions workflow for `go build`, `go vet`, and `go test` on every PR.

### Priority 1 (High Value)

1. **Upgrade Go and dependencies**: Move from Go 1.16 to latest stable; update Kubernetes client libraries from 0.20.5 to current.
2. **Add integration tests**: Use `k8s.io/client-go/kubernetes/fake` or envtest for Kubernetes API interactions without requiring a live cluster.
3. **Add golangci-lint and govulncheck**: Catch code quality issues and dependency vulnerabilities.
4. **Separate UI from business logic**: Extract cluster operations into testable packages, decoupled from the tview UI layer.

### Priority 2 (Nice-to-Have)

1. **Add agent rules** (`.claude/rules/`) for test creation guidance
2. **Add pre-commit hooks** for `gofmt`, `go vet`, and linting
3. **Consider containerizing** the tool for easier distribution
4. **Add Makefile** with standard targets: `build`, `test`, `lint`, `clean`

## Comparison to Gold Standards

| Dimension | RDRhelper | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | 0/10 | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 0/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 1/10 | 8/10 | 7/10 | 8/10 |
| Image Testing | 1/10 | 7/10 | 9/10 | 7/10 |
| Coverage Tracking | 0/10 | 8/10 | 6/10 | 9/10 |
| CI/CD Automation | 1/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 0/10 | 8/10 | 3/10 | 2/10 |
| **Overall** | **0.4/10** | **8.5/10** | **7.0/10** | **8.0/10** |

## File Paths Reference

| File | Purpose |
|------|---------|
| `.github/CODEOWNERS` | Code review ownership |
| `.goreleaser.yml` | Cross-platform binary release configuration |
| `.gitignore` | Git ignore rules |
| `go.mod` / `go.sum` | Go module definition and checksums |
| `modd.conf` | Development hot-reload configuration |
| `main.go` | Application entry point and main menu |
| `config.go` | Kubeconfig management and validation |
| `install.go` | ODF/OADP installation logic |
| `verify.go` | Installation verification checks |
| `failover.go` | Failover/failback operations |
| `change.go` | PV operations (promote, demote, mirror) and pod execution |
| `pvcView.go` | PVC table view and mirroring management |
| `helperFuncs.go` | Utility functions (modals, alerts, string helpers) |
| `test/apply.sh` | Manual PVC creation helper (not an automated test) |
| `test/delete.sh` | Manual PVC deletion helper (not an automated test) |
| `test/pvc.yaml.j2` | PVC Jinja2 template for test helpers |
