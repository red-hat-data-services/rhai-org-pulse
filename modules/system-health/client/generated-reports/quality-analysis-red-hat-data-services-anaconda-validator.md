---
repository: "red-hat-data-services/anaconda-validator"
overall_score: 0.8
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No tests of any kind exist in the repository"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests; script untested against live or mock clusters"
  - dimension: "Build Integration"
    score: 1.0
    status: "Dockerfile exists but no PR-time build validation or CI pipeline"
  - dimension: "Image Testing"
    score: 0.0
    status: "No image runtime validation, no vulnerability scanning, no SBOM"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling of any kind"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "No CI/CD workflows; no GitHub Actions, no Makefile, no automation"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules or skills"
critical_gaps:
  - title: "Zero test coverage — no tests of any kind"
    impact: "Script logic (curl parsing, configmap patching, imagestream labeling) is completely unvalidated; regressions ship silently"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No CI/CD pipeline"
    impact: "No automated checks on PRs or pushes; broken changes merge without any gate"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container image scanning or validation"
    impact: "Base image vulnerabilities (UBI8) and runtime issues go undetected; no SBOM for supply chain compliance"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "Stale and unmaintained (last commit Sep 2021)"
    impact: "UBI8 base image likely has unpatched CVEs; oc client downloaded from 'latest' is unpinned and untested"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Shell script has no error handling (set -e / set -o pipefail missing)"
    impact: "Silent failures in curl, oc commands, or variable expansion can leave cluster state inconsistent"
    severity: "MEDIUM"
    effort: "1 hour"
quick_wins:
  - title: "Add a basic GitHub Actions CI workflow with ShellCheck"
    effort: "1-2 hours"
    impact: "Catch shell scripting errors, enforce best practices, gate PRs"
  - title: "Add set -euo pipefail to validate.sh"
    effort: "30 minutes"
    impact: "Prevent silent failures from broken commands or missing variables"
  - title: "Add Trivy container scan to Dockerfile build"
    effort: "1-2 hours"
    impact: "Surface known CVEs in UBI8 base image and oc client"
  - title: "Pin the oc client version instead of using 'latest'"
    effort: "30 minutes"
    impact: "Reproducible builds; avoid surprise breakage from oc API changes"
recommendations:
  priority_0:
    - "Add shell script unit tests using BATS (Bash Automated Testing System) for validate.sh functions"
    - "Create a GitHub Actions CI pipeline with ShellCheck linting and BATS test execution"
    - "Add Trivy or Grype container vulnerability scanning"
  priority_1:
    - "Add integration tests that mock oc and curl commands to validate all code paths"
    - "Update base image to UBI9 and pin oc client version"
    - "Add Hadolint for Dockerfile linting"
  priority_2:
    - "Create agent rules (.claude/rules/) for shell script test patterns"
    - "Add SBOM generation with Syft"
    - "Evaluate whether this repo is still actively needed or should be archived"
---

# Quality Analysis: anaconda-validator

## Executive Summary

- **Overall Score: 0.8/10**
- **Repository Type**: Shell script utility (Anaconda CE license validator for OpenShift)
- **Primary Language**: Shell/Bash
- **Size**: 3 files (validate.sh, Dockerfile, imagestream.yaml)
- **Activity**: 10 total commits, last activity September 2021 (~5 years dormant)
- **Key Strengths**: Simple, focused purpose; functional Dockerfile
- **Critical Gaps**: Zero tests, zero CI/CD, zero security scanning, zero quality tooling
- **Agent Rules Status**: Missing — no CLAUDE.md, no .claude/ directory

This is a minimal utility repository with effectively no quality infrastructure. It consists of a single shell script that validates Anaconda Commercial Edition license keys by curling the Anaconda repository API, then enables or disables an OpenShift ImageStream and ConfigMap based on the response. The repository has been dormant since September 2021 and likely needs a decision on whether to maintain or archive.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No tests of any kind exist |
| Integration/E2E | 0/10 | No integration or E2E tests |
| **Build Integration** | **1/10** | **Dockerfile exists but no CI build validation** |
| Image Testing | 0/10 | No runtime validation or scanning |
| Coverage Tracking | 0/10 | No coverage tooling |
| CI/CD Automation | 0/10 | No workflows, no Makefile, no automation |
| Agent Rules | 0/10 | No agent rules or documentation |

**Overall: 0.8/10** (weighted average)

## Critical Gaps

### 1. Zero Test Coverage — No Tests of Any Kind
- **Impact**: The script's core logic — curl response code parsing, `oc` configmap patching, imagestream labeling, secret reading — is completely unvalidated. Any regression ships silently.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The `validate.sh` script has 7 functions and a main flow with 3 code paths (success on HTTP 200, failure on HTTP 403, unknown otherwise). None are tested. Edge cases like missing secrets, unreachable API, or `oc` command failures are not covered.

### 2. No CI/CD Pipeline
- **Impact**: No automated checks gate PRs or pushes. Broken changes merge unchecked. No linting, no testing, no build validation.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No `.github/workflows/` directory exists. No Makefile. No Jenkins, GitLab CI, or Tekton configuration. The only way to validate changes is manual testing against a live cluster.

### 3. No Container Image Scanning or Validation
- **Impact**: The Dockerfile uses `registry.access.redhat.com/ubi8` as a base image (now ~3 years out of support cycle) and downloads `oc` client from an unpinned `latest` URL. No vulnerability scanning, no SBOM, no image signing.
- **Severity**: HIGH
- **Effort**: 2-3 hours

### 4. Stale/Dormant Repository (Last Commit Sep 2021)
- **Impact**: UBI8 base image likely has accumulated CVEs. The unpinned `oc` client download could break at any time if Red Hat changes the mirror URL or binary format. Anaconda's API endpoints may have changed.
- **Severity**: HIGH
- **Effort**: 4-6 hours (to modernize) or 1 hour (to archive)

### 5. Shell Script Lacks Defensive Coding
- **Impact**: `validate.sh` does not use `set -euo pipefail`. Failed commands (e.g., `oc patch`, `curl`) can silently continue, leaving cluster state inconsistent (e.g., configmap says valid but imagestream says invalid).
- **Severity**: MEDIUM
- **Effort**: 1 hour

## Quick Wins

### 1. Add ShellCheck Linting via GitHub Actions (1-2 hours)
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
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

### 2. Add Defensive Shell Options (30 minutes)
```bash
#!/bin/sh
set -euo pipefail
```
Add to the top of `validate.sh` to catch failures in `oc` and `curl` commands.

### 3. Add Trivy Container Scan (1-2 hours)
```yaml
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -t anaconda-validator:test .
      - name: Trivy scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: anaconda-validator:test
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
```

### 4. Pin oc Client Version (30 minutes)
```dockerfile
# Instead of unpinned 'latest':
RUN curl https://mirror.openshift.com/pub/openshift-v4/clients/ocp/4.14.10/openshift-client-linux.tar.gz \
    | tar -zxv -C /bin
```

## Detailed Findings

### CI/CD Pipeline
- **Workflows**: None. No `.github/workflows/`, no Makefile, no CI configuration of any kind.
- **Build Process**: Manual only. Dockerfile exists but is never automatically built or tested.
- **Automation Score**: 0/10 — This is the baseline for "no automation at all."

### Test Coverage

#### Unit Tests
- **Test Files**: 0
- **Framework**: None
- **Test-to-Code Ratio**: 0:1
- **Coverage**: 0%
- **Analysis**: The `validate.sh` script has 7 shell functions that could be unit-tested with BATS (Bash Automated Testing System). Key functions to test:
  - `get_variable()` — reads from secret mount
  - `verify_image_exists()` — checks and creates ImageStream
  - `write_imagestream_value()` — labels ImageStream
  - `verify_configmap_exists()` — checks and creates ConfigMap
  - `write_configmap_value()` — patches ConfigMap
  - `success()` / `failure()` — orchestration functions
  - Main curl logic — response code parsing

#### Integration Tests
- **Test Suites**: None
- **Analysis**: No tests validate the script against mock or real OpenShift clusters. The script interacts with `oc` CLI commands (get, apply, create, label, patch) that could be tested with mock binaries.

#### E2E Tests
- **Test Suites**: None
- **Analysis**: No end-to-end validation exists. The script's full flow (read secret → curl Anaconda API → update OpenShift resources) is never tested as a unit.

### Code Quality

#### Linting
- **ShellCheck**: Not configured
- **Hadolint**: Not configured
- **Analysis**: `validate.sh` would benefit from ShellCheck. Notable issues:
  - No `set -e` or `set -o pipefail`
  - Unquoted variable in `write_configmap_value` function (line 29: `${1}`)
  - `function` keyword is not POSIX-compliant (uses `#!/bin/sh` shebang)
  - `curl` in Dockerfile runs without `--fail` flag

#### Pre-commit Hooks
- **Status**: Not configured
- **Analysis**: No `.pre-commit-config.yaml` exists.

#### Static Analysis
- **SAST**: None
- **Secret Detection**: None (though the script reads secrets from mounted volumes, the approach is reasonable)

### Container Images

#### Dockerfile Analysis
- **Base Image**: `registry.access.redhat.com/ubi8` — UBI8 is aging; UBI9 is recommended
- **Multi-stage Build**: No — single stage (acceptable for this simple image)
- **Security**: Downloads `oc` client over HTTPS but doesn't verify checksums
- **Pinning**: `oc` client uses unpinned `latest` — build reproducibility issue
- **Size Optimization**: Minimal — could remove tar.gz after extraction
- **Platform Support**: Not specified — single architecture only

#### Runtime Validation
- **Image Startup Tests**: None
- **Functional Tests**: None
- **Deployment Tests**: None

#### Security Scanning
- **Trivy/Grype**: Not integrated
- **SBOM**: None
- **Image Signing**: None
- **Vulnerability Thresholds**: None

### Security Practices
- **Container Scanning**: None
- **SAST/CodeQL**: None
- **Dependency Scanning**: N/A (no package manager dependencies)
- **Secret Detection**: None
- **Analysis**: The script reads an Anaconda CE key from a mounted Kubernetes secret (`/etc/secret-volume/`), which is the correct pattern. However, the curl command includes the key in the URL path, which could appear in logs.

### Agent Rules (Agentic Flow Quality)
- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **Test automation rules**: None
- **Coverage**: No test types have rules
- **Quality**: N/A
- **Gaps**: Everything — no agent rules exist at all
- **Recommendation**: Given the repository's small size and dormant state, agent rules are low priority unless the repo is being revived

## Recommendations

### Priority 0 (Critical)
1. **Decision: Maintain or Archive** — The repository has been dormant for ~5 years. If Anaconda CE validation is still needed, modernize it. If not, archive the repo to prevent confusion.
2. **Add basic CI with ShellCheck** — If maintaining, add a GitHub Actions workflow with ShellCheck to catch scripting errors.
3. **Add `set -euo pipefail`** — Prevent silent failures that could leave cluster state inconsistent.
4. **Add Trivy container scanning** — Surface CVEs in the UBI8 base image and oc client.

### Priority 1 (High Value)
1. **Add BATS unit tests** — Test each shell function with mocked `oc` and `curl` commands.
2. **Update base image to UBI9** — UBI8 is aging and accumulating unpatched vulnerabilities.
3. **Pin oc client version** — Ensure reproducible builds.
4. **Add Hadolint** — Lint the Dockerfile for best practices.
5. **Quote all variables** — Fix potential word-splitting issues in shell script.

### Priority 2 (Nice-to-Have)
1. **Add SBOM generation** — For supply chain compliance.
2. **Create agent rules** — If the repo will see active development.
3. **Add integration tests with mock oc** — Validate all oc command interactions.
4. **Consider rewriting in Go or Python** — For better testability and error handling if scope expands.

## Comparison to Gold Standards

| Dimension | anaconda-validator | odh-dashboard | notebooks | kserve |
|-----------|-------------------|---------------|-----------|--------|
| Unit Tests | 0/10 | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 0/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 1/10 | 8/10 | 9/10 | 7/10 |
| Image Testing | 0/10 | 7/10 | 9/10 | 6/10 |
| Coverage Tracking | 0/10 | 8/10 | 5/10 | 8/10 |
| CI/CD Automation | 0/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 0/10 | 8/10 | 3/10 | 2/10 |
| **Overall** | **0.8/10** | **8.5/10** | **7.5/10** | **7.5/10** |

## File Paths Reference

| File | Purpose |
|------|---------|
| `validate.sh` | Main validation script (67 lines) |
| `Dockerfile` | Container image definition (10 lines) |
| `imagestream.yaml` | OpenShift ImageStream manifest (25 lines) |
