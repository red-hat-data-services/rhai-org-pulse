---
repository: "red-hat-data-services/setup-rhoai"
overall_score: 1.4
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No tests of any kind exist in the repository"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests; scripts are never validated automatically"
  - dimension: "Build Integration"
    score: 1.0
    status: "Manual Dockerfile build only; no PR-time build validation"
  - dimension: "Image Testing"
    score: 1.0
    status: "Dockerfile exists but no image testing, scanning, or runtime validation"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling of any kind"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "No CI/CD workflows (no .github/workflows/, no Makefile test targets)"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules"
critical_gaps:
  - title: "Zero CI/CD pipeline"
    impact: "Every change merges with zero automated validation; broken scripts reach users undetected"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "Zero test coverage"
    impact: "The 890-line uninstall script and all other scripts have no tests; regressions are invisible"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No ShellCheck / linting"
    impact: "Bash anti-patterns (unquoted variables, command injection risks) go undetected"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No container image scanning"
    impact: "The upgrader Dockerfile uses Fedora 38 (EOL) and an ancient OCP 4.6 client; vulnerabilities unchecked"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Hardcoded secrets path and no secret detection"
    impact: "~/.ssh/.brew_token path is hardcoded; no Gitleaks/TruffleHog to catch accidental secret commits"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "Single squashed commit, no branch protection"
    impact: "No pull-request review process enforced; entire repo history is a single commit"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add ShellCheck linting via GitHub Actions"
    effort: "1-2 hours"
    impact: "Catches quoting bugs, undefined variables, and Bash anti-patterns on every PR"
  - title: "Add Trivy scan for the upgrader Dockerfile"
    effort: "1-2 hours"
    impact: "Flags the EOL Fedora 38 base image and known CVEs automatically"
  - title: "Add BATS unit tests for the uninstall script functions"
    effort: "4-6 hours"
    impact: "The 890-line uninstall-rhoai.sh has 20+ functions that can be unit-tested in isolation"
  - title: "Upgrade Dockerfile base image and OCP client version"
    effort: "1 hour"
    impact: "Fedora 38 is EOL, OCP 4.6 client is 4+ years old; upgrading removes known vulnerabilities"
  - title: "Add .editorconfig and basic CLAUDE.md"
    effort: "1 hour"
    impact: "Establishes consistent formatting and gives AI agents context for contributions"
recommendations:
  priority_0:
    - "Create a minimal GitHub Actions CI pipeline with ShellCheck and YAML lint on every PR"
    - "Add BATS (Bash Automated Testing System) tests for critical functions in uninstall-rhoai.sh"
    - "Upgrade the upgrader Dockerfile from Fedora 38 to a supported base and use a current OCP client"
  priority_1:
    - "Add Trivy container scanning for the upgrader image"
    - "Add Gitleaks pre-commit hook and CI step for secret detection"
    - "Create agent rules (.claude/rules/) for shell script testing patterns"
    - "Introduce branch protection requiring PR reviews and CI pass before merge"
  priority_2:
    - "Add integration tests that validate scripts against a mock cluster (Kind + fake oc)"
    - "Add SBOM generation for the upgrader container image"
    - "Create a Makefile with standard targets (lint, test, build, push)"
---

# Quality Analysis: setup-rhoai

## Executive Summary

- **Overall Score: 1.4/10**
- **Repository Type**: Shell script utility for installing, upgrading, and uninstalling Red Hat OpenShift AI (RHOAI)
- **Primary Language**: Bash (~993 lines across 12 shell scripts)
- **Contributors**: 1 (single squashed commit)
- **Key Strengths**: Comprehensive uninstall coverage (890-line script handling 13+ dependent operators); good security context in K8s manifests (non-root, dropped capabilities, seccomp)
- **Critical Gaps**: Zero CI/CD, zero tests, zero linting, zero security scanning, zero coverage tracking, zero agent rules
- **Agent Rules Status**: Missing

This is an operational utility repository with **no quality infrastructure whatsoever**. Every dimension scores at or near zero. The scripts perform destructive cluster operations (deleting CRDs, namespaces, operators) with no automated validation that they work correctly.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No tests of any kind |
| Integration/E2E | 0/10 | No automated validation against clusters |
| **Build Integration** | **1/10** | **Manual Dockerfile build only; no PR-time validation** |
| Image Testing | 1/10 | Dockerfile exists but no scanning or runtime tests |
| Coverage Tracking | 0/10 | No coverage tooling |
| CI/CD Automation | 0/10 | No CI/CD workflows at all |
| Agent Rules | 0/10 | No CLAUDE.md, no .claude/ directory |

## Critical Gaps

### 1. Zero CI/CD Pipeline
- **Impact**: Every change merges with zero automated validation. Broken scripts reach users undetected.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: No `.github/workflows/` directory exists. No Makefile with test targets. No GitLab CI. No Jenkins. The only way to validate changes is manual testing on a live cluster.

### 2. Zero Test Coverage
- **Impact**: The 890-line `uninstall-rhoai.sh` script and all helper scripts have no tests. Regressions are invisible.
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Details**: No `*_test*` files, no test directories, no test framework of any kind. The uninstall script has 20+ well-defined functions (`delete_finalizers`, `delete_webhooks`, `delete_resources`, `cleanup_authorino`, etc.) that are highly testable with BATS and mocked `oc` commands.

### 3. No ShellCheck / Linting
- **Impact**: Bash anti-patterns go undetected. Several scripts have unquoted variables and potential injection risks.
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Specific Issues Found**:
  - `remove_finalizer.sh:4` — `${NAMESPACE}` is unquoted in `oc get namespace` and in `curl` URL, enabling command injection if namespace contains special characters
  - `add_brew_pull_secret.sh:26` — Token from `~/.ssh/.brew_token` injected directly into sed replacement without sanitization
  - `uninstall-rhoai.sh:155` — `xargs -I {} oc patch "$1" {}` passes unquoted values through xargs
  - Multiple scripts lack `set -euo pipefail` (only `uninstall-rhoai.sh` has it)

### 4. Outdated and Insecure Dockerfile
- **Impact**: The upgrader container uses Fedora 38 (EOL since May 2024) and downloads OCP 4.6 client (released Oct 2020, long EOL). Known CVEs are unpatched.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: `upgrader/Dockerfile` line 1 uses `FROM fedora:38`. Line 2 downloads `stable-4.6` OCP client from Red Hat mirror. No multi-stage build, no vulnerability scanning, no SBOM.

### 5. No Secret Detection
- **Impact**: The script `add_brew_pull_secret.sh` reads from `~/.ssh/.brew_token`. If anyone accidentally commits a token, there's no Gitleaks or TruffleHog to catch it.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours

### 6. No Branch Protection / Review Process
- **Impact**: The entire repository history is a single squashed commit by one contributor. No evidence of PR-based review workflow.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours

## Quick Wins

### 1. Add ShellCheck to GitHub Actions (1-2 hours)
```yaml
# .github/workflows/lint.yml
name: Lint
on: [push, pull_request]
jobs:
  shellcheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: ShellCheck
        uses: ludeeus/action-shellcheck@2.0.0
        with:
          scandir: '.'
          severity: warning
```

### 2. Add Trivy Scanning (1-2 hours)
```yaml
# .github/workflows/security.yml
name: Security
on: [push, pull_request]
jobs:
  trivy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build upgrader image
        run: docker build -t setup-rhoai-upgrader:test upgrader/
      - name: Trivy scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'setup-rhoai-upgrader:test'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
```

### 3. Add BATS Tests for Uninstall Functions (4-6 hours)
```bash
# test/uninstall_test.bats
#!/usr/bin/env bats

setup() {
  # Mock oc command
  oc() {
    echo "mock: $@" >> "$BATS_TMPDIR/oc_calls.log"
  }
  export -f oc
  source scripts/uninstall-rhoai.sh --source-only 2>/dev/null || true
}

@test "delete_finalizers calls oc get with correct resource" {
  delete_finalizers "notebooks.kubeflow.org"
  grep -q "mock: get notebooks.kubeflow.org" "$BATS_TMPDIR/oc_calls.log"
}

@test "cleanup_authorino deletes correct OLM resources" {
  cleanup_authorino
  grep -q "authorino-operator" "$BATS_TMPDIR/oc_calls.log"
}
```

### 4. Upgrade Dockerfile (1 hour)
```dockerfile
FROM fedora:41
RUN mkdir tools && curl https://mirror.openshift.com/pub/openshift-v4/clients/ocp/stable-4.17/openshift-client-linux.tar.gz -o tools/openshift-client-linux.tar.gz && \
    tar -xvf tools/openshift-client-linux.tar.gz -C tools/ && chmod +x tools/oc && mv tools/oc /usr/bin && \
    rm -rf tools
COPY src /nightlies
WORKDIR /nightlies
RUN oc version --client
ENTRYPOINT ["/nightlies/upgrade.sh"]
```

## Detailed Findings

### CI/CD Pipeline
- **Workflows**: None. No `.github/workflows/`, no Makefile, no Jenkinsfile, no `.gitlab-ci.yml`.
- **Test Automation**: None. No automated tests run on PRs or on schedule.
- **Build Process**: Manual only. `upgrader/build.sh` runs `podman build` and `podman push` locally. No automated image builds.
- **Concurrency/Caching**: N/A — no CI exists.

### Test Coverage
- **Unit Tests**: 0 test files. 0% coverage. No testing framework.
- **Integration Tests**: None. Scripts interact with live OpenShift clusters but have no mock/stub infrastructure.
- **E2E Tests**: None. No cluster provisioning (Kind/Minikube) for validation.
- **Coverage Tracking**: No codecov, coveralls, or any coverage tooling.
- **Test-to-Code Ratio**: 0:993 (0 test lines to 993 code lines).

### Code Quality
- **Linting**: No ShellCheck configuration. No `.shellcheckrc`. Several Bash anti-patterns present.
- **Pre-commit Hooks**: None. No `.pre-commit-config.yaml`.
- **Static Analysis**: None. No SAST tools configured.
- **Code Style**: Inconsistent. Some scripts use `#!/bin/bash`, others `#!/bin/sh`. Only `uninstall-rhoai.sh` uses `set -euo pipefail`.
- **Positive**: The uninstall script is well-structured with named functions and clear separation of concerns. Comments explain the "why" in several places.

### Container Images
- **Dockerfile**: Single `upgrader/Dockerfile` using `FROM fedora:38` (EOL).
- **OCP Client**: Downloads `stable-4.6` (released Oct 2020, 5+ years EOL).
- **Multi-stage Build**: No — single stage with build artifacts left in place.
- **Runtime Testing**: No image startup validation, no functional tests.
- **Security Scanning**: No Trivy, Snyk, or any scanner configured.
- **SBOM**: None generated.
- **Image Signing**: None.
- **Positive**: K8s pod manifests use good security contexts (`runAsNonRoot: true`, `drop: ["ALL"]`, `seccompProfile: RuntimeDefault`).

### Security Practices
- **Container Scanning**: None.
- **SAST/CodeQL**: None.
- **Dependency Scanning**: N/A (no package managers).
- **Secret Detection**: None. Hardcoded path `~/.ssh/.brew_token` in `add_brew_pull_secret.sh`.
- **Concerns**:
  - `remove_finalizer.sh` writes to a predictable `/tmp.json` path (TOCTOU race, temp file collision)
  - `upgrade.sh` downloads content from S3 (`rhods-devops.s3.amazonaws.com`) without checksum verification
  - `add_brew_pull_secret.sh` injects token content directly into a sed replacement pattern

### Agent Rules (Agentic Flow Quality)
- **Status**: Missing
- **Coverage**: No test type rules whatsoever
- **Quality**: N/A
- **Gaps**: No CLAUDE.md, no `.claude/` directory, no `.claude/rules/`, no testing documentation
- **Recommendation**: Generate rules with `/test-rules-generator` covering BATS test patterns for shell scripts

## Recommendations

### Priority 0 (Critical)
1. **Create a minimal GitHub Actions CI pipeline** with ShellCheck linting and YAML validation on every PR. This is the single highest-ROI improvement — 1-2 hours to catch quoting bugs and syntax errors that could break live clusters.
2. **Add BATS tests for `uninstall-rhoai.sh`** — the 890-line script with 20+ functions is the core of the repo and is entirely untested. Mock `oc` commands and validate function behavior.
3. **Upgrade the Dockerfile** — Fedora 38 is EOL, OCP 4.6 client is 5+ years old. Update to Fedora 41+ and OCP 4.17+.

### Priority 1 (High Value)
4. **Add Trivy container scanning** for the upgrader image in CI.
5. **Add Gitleaks** pre-commit hook and CI step for secret detection.
6. **Create agent rules** (`.claude/rules/`) with shell script testing patterns and BATS conventions.
7. **Enable branch protection** requiring PR reviews and CI pass before merge.
8. **Add `set -euo pipefail`** to all scripts (currently only `uninstall-rhoai.sh` has it).

### Priority 2 (Nice-to-Have)
9. **Add integration tests** using Kind and a mock `oc` wrapper to validate install/uninstall flows.
10. **Add SBOM generation** for the upgrader container image.
11. **Create a Makefile** with standard targets (`lint`, `test`, `build`, `push`) to standardize local development.
12. **Add `.editorconfig`** and consistent shebang lines across all scripts.
13. **Fix `remove_finalizer.sh`** to use `mktemp` instead of hardcoded `tmp.json` path.

## Comparison to Gold Standards

| Dimension | setup-rhoai | odh-dashboard | notebooks | kserve |
|-----------|-------------|---------------|-----------|--------|
| CI/CD Pipeline | None | Comprehensive (10+ workflows) | Multi-layer CI | PR + periodic |
| Unit Tests | None | Jest + extensive coverage | Python pytest | Go testing |
| Integration/E2E | None | Cypress E2E + contract tests | Testcontainers + multi-arch | envtest + Kind |
| Image Testing | None | Build validation in CI | 5-layer validation | Runtime validation |
| Coverage Tracking | None | Codecov with thresholds | Coverage reporting | Codecov enforcement |
| Security Scanning | None | CodeQL + dependency scanning | Trivy + SBOM | Trivy + Snyk |
| Agent Rules | None | Comprehensive .claude/ rules | Partial rules | Partial rules |
| **Overall** | **1.4/10** | **9.0/10** | **8.5/10** | **8.0/10** |

## File Paths Reference

| File | Purpose |
|------|---------|
| `setup_rhoai.sh` | Main install script (6 lines) |
| `upgrade-rhods.sh` | Fetch latest image and update catalog source |
| `scripts/uninstall-rhoai.sh` | Comprehensive uninstall script (890 lines, 20+ functions) |
| `scripts/add_brew_pull_secret.sh` | Add brew registry pull secret |
| `scripts/remove_finalizer.sh` | Remove namespace finalizers |
| `scripts/uninstall_v2.sh` | Simplified uninstall (9 lines) |
| `upgrader/Dockerfile` | Container for automated nightly upgrades |
| `upgrader/src/upgrade.sh` | Upgrade entrypoint (fetches latest image, applies catalog) |
| `upgrader/k8s/upgrader-cron.yaml` | CronJob for daily automated upgrades |
| `config/catalogsource.yaml` | RHOAI CatalogSource definition |
| `config/subscription.yaml` | RHOAI operator Subscription |
| `config/imagepolicy.yaml` | ImageContentSourcePolicy for brew registry |
