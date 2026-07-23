---
repository: "red-hat-data-services/odh-deployer"
overall_score: 1.5
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No test files of any kind exist in the repository"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E test suites; testing is entirely manual per CONTRIBUTING.md"
  - dimension: "Build Integration"
    score: 2.0
    status: "Makefile builds container image with podman but no PR-triggered CI, no dry-run validation"
  - dimension: "Image Testing"
    score: 2.0
    status: "Single-stage Dockerfile with UBI base, non-root user, but no HEALTHCHECK, no runtime validation, no multi-arch"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling — no code to cover (shell script only)"
  - dimension: "CI/CD Automation"
    score: 1.0
    status: "No GitHub Actions workflows; only .aicoe-ci.yaml for Thoth build; OpenShift CI via OWNERS for merge gating"
  - dimension: "Static Analysis"
    score: 1.0
    status: "No linting (shellcheck, yamllint), no Dependabot/Renovate, no pre-commit hooks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "Zero automated tests of any kind"
    impact: "deploy.sh is a 415-line shell script with complex logic (namespace creation, CRD management, secret handling, upgrade migrations) that has no automated test coverage — regressions discovered only on live clusters"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No CI/CD pipeline (GitHub Actions or equivalent)"
    impact: "No PR-time validation — YAML syntax, kustomize builds, Dockerfile builds, and shell script linting are not checked before merge"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No static analysis or linting"
    impact: "Shell script errors, YAML formatting issues, and security anti-patterns not caught automatically"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container image validation"
    impact: "Image build failures and runtime issues not caught until deployment to live clusters"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "No dependency management or alerts"
    impact: "Base image (UBI8) and oc client binary downloaded at build time with no version pinning or vulnerability alerts"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add shellcheck linting via GitHub Actions"
    effort: "2-3 hours"
    impact: "Catches shell script bugs, quoting issues, and security anti-patterns in deploy.sh automatically on every PR"
  - title: "Add yamllint for all YAML manifests"
    effort: "1-2 hours"
    impact: "Validates syntax of 80 YAML files before merge, preventing broken manifests reaching clusters"
  - title: "Add Dockerfile build validation in CI"
    effort: "2-3 hours"
    impact: "Ensures container image builds successfully on every PR, catches broken COPY/ADD paths"
  - title: "Add kustomize build --dry-run validation"
    effort: "2-3 hours"
    impact: "Validates all 15 kustomization.yaml overlays render correctly before merge"
  - title: "Enable Dependabot for Docker base image updates"
    effort: "1 hour"
    impact: "Automated PRs when UBI8 base image has security updates"
recommendations:
  priority_0:
    - "Create GitHub Actions CI pipeline with shellcheck, yamllint, and Dockerfile build validation"
    - "Add BATS (Bash Automated Testing System) unit tests for deploy.sh functions"
    - "Add kustomize build validation for all overlay directories"
  priority_1:
    - "Add container image build and startup validation in PR CI"
    - "Add Dependabot configuration for Docker base image tracking"
    - "Add pre-commit hooks for shell and YAML linting"
    - "Create CLAUDE.md with deployment script conventions and testing guidance"
  priority_2:
    - "Add E2E smoke tests using a Kind cluster to validate deploy.sh against a mock environment"
    - "Add multi-architecture image builds (amd64, arm64)"
    - "Add HEALTHCHECK instruction to Dockerfile"
    - "Pin oc client version in Dockerfile instead of using 'latest'"
---

# Quality Analysis: odh-deployer

## Executive Summary

- **Overall Score: 1.5/10**
- **Repository Type**: Deployment container (Shell + YAML manifests)
- **Primary Language**: Bash (deploy.sh, 415 lines), YAML (80 manifest files)
- **Tier**: Downstream (red-hat-data-services)
- **Jira**: RHOAIENG / AI Core Platform
- **Key Strengths**: UBI-based container image, non-root user, OWNERS-based merge gating, PR template with QE checklist
- **Critical Gaps**: Zero automated tests, no CI/CD pipeline, no static analysis, no coverage tracking, no agent rules
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 0.0/10 | 15% | 0.00 | No test files exist |
| Integration/E2E | 0.0/10 | 20% | 0.00 | Testing is entirely manual |
| Build Integration | 2.0/10 | 15% | 0.30 | Makefile only, no PR-time validation |
| Image Testing | 2.0/10 | 10% | 0.20 | Basic Dockerfile, no runtime validation |
| Coverage Tracking | 0.0/10 | 10% | 0.00 | No coverage tooling |
| CI/CD Automation | 1.0/10 | 15% | 0.15 | Only .aicoe-ci.yaml and OWNERS gating |
| Static Analysis | 1.0/10 | 10% | 0.10 | No linting, no dependency alerts |
| Agent Rules | 0.0/10 | 5% | 0.00 | No agent rules present |
| **Overall** | **1.5/10** | **100%** | **0.75** | |

## Critical Gaps

### 1. Zero Automated Tests of Any Kind
- **Impact**: `deploy.sh` is a 415-line shell script with complex logic including namespace creation, CRD management, secret extraction, upgrade migrations (ClusterRoleBinding cleanup, DSPO deployment label fixes), and environment-specific branching (OSD vs self-managed). None of this is tested automatically.
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Current State**: CONTRIBUTING.md states testing is done manually: "Test the changes locally, by manually running the deploy.sh script from the terminal" and building a RHODS-live image.

### 2. No CI/CD Pipeline
- **Impact**: No GitHub Actions workflows exist. The only CI configuration is `.aicoe-ci.yaml` (Thoth/AICoE CI) for building and pushing the container image. There is no PR-time validation of YAML syntax, shell script correctness, kustomize overlays, or Dockerfile builds.
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Current State**: Merge gating relies solely on OpenShift CI OWNERS-based approval (lgtm + approved labels).

### 3. No Static Analysis or Linting
- **Impact**: The 415-line `deploy.sh` has no shellcheck validation. Common shell scripting issues (unquoted variables, missing error handling patterns, potential injection vectors in `sed -i` commands using secret values) are not caught before merge. The 80 YAML manifests have no yamllint validation.
- **Severity**: HIGH
- **Effort**: 4-6 hours

### 4. No Container Image Validation
- **Impact**: The Dockerfile downloads `oc` binary from `mirror.openshift.com/pub/openshift-v4/clients/oc/latest/linux/oc.tar.gz` at build time with no version pinning. The image has no HEALTHCHECK. No runtime validation confirms the built image can actually execute `deploy.sh`.
- **Severity**: MEDIUM
- **Effort**: 4-8 hours

### 5. No Dependency Management or Alerts
- **Impact**: No Dependabot or Renovate configuration exists. The UBI8 base image and `oc` client are the only external dependencies, but neither is tracked for security updates automatically.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours

## Quick Wins

### 1. Add shellcheck Linting via GitHub Actions (2-3 hours)
Catches shell script bugs, quoting issues, and security anti-patterns in `deploy.sh`.

```yaml
# .github/workflows/lint.yml
name: Lint
on: [pull_request]
jobs:
  shellcheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: ShellCheck
        uses: ludeeus/action-shellcheck@2.0.0
        with:
          scandir: '.'
```

### 2. Add yamllint for All YAML Manifests (1-2 hours)
Validates syntax of 80 YAML files before merge.

```yaml
  yamllint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: yamllint
        uses: ibiqlik/action-yamllint@v3
        with:
          file_or_dir: '.'
          config_data: |
            extends: default
            rules:
              line-length:
                max: 200
              truthy:
                check-keys: false
```

### 3. Add Dockerfile Build Validation in CI (2-3 hours)
Ensures the container image builds successfully on every PR.

```yaml
  docker-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -t odh-deployer:test .
```

### 4. Add kustomize Build Validation (2-3 hours)
Validates all 15 kustomization.yaml overlays render correctly.

```yaml
  kustomize:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install kustomize
        run: curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
      - name: Validate overlays
        run: |
          for dir in $(find . -name kustomization.yaml -exec dirname {} \;); do
            echo "Validating $dir"
            ./kustomize build "$dir" > /dev/null
          done
```

### 5. Enable Dependabot for Docker Base Image (1 hour)

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
```

## Detailed Findings

### Unit Tests

**Score: 0.0/10**

- **Test files found**: 0
- **Test frameworks detected**: None
- **Test-to-code ratio**: 0:1

The repository contains a single shell script (`deploy.sh`, 415 lines) as its main executable code. There are no test files of any kind — no `*_test.sh`, no BATS tests, no shUnit2 tests.

The `deploy.sh` script contains several testable functions:
- `oc::wait::object::availability()` — retry logic for checking K8s object existence
- `oc::dashboard::apply::isvs()` — CRD application and ISV tile deployment
- `oc::object::safe::to::apply()` — safe-apply check preventing overwrite of modified resources

These functions have clear inputs/outputs and could be unit tested with BATS (Bash Automated Testing System) by mocking `oc` commands.

### Integration/E2E Tests

**Score: 0.0/10**

- **E2E directory**: None
- **Integration directory**: None
- **Cluster setup tooling**: None
- **Multi-version testing**: None

Per CONTRIBUTING.md, testing is entirely manual:
1. Run `deploy.sh` manually from the terminal
2. Build a RHODS-live image via `rhods-live-builder`
3. Install RHODS on an OpenShift cluster
4. Verify changes work as expected
5. QE contact acknowledges testing

There is no automated end-to-end validation of the deployment flow.

### Build Integration

**Score: 2.0/10**

- **Makefile**: Present — `make build` runs `podman build`, `make push` pushes to `quay.io/modh/odh-deployer`
- **PR build validation**: None — no CI workflow triggers on PRs
- **Kustomize validation**: None — 15 kustomization.yaml files are not validated
- **.aicoe-ci.yaml**: Thoth/AICoE CI builds the image, but this is not PR-triggered validation

The Makefile provides a basic local build capability, but there is no PR-time build validation or dry-run testing of manifests.

### Image Testing

**Score: 2.0/10**

- **Dockerfile**: Single-stage build from `registry.access.redhat.com/ubi8/ubi-minimal` (FIPS-capable UBI base)
- **Non-root user**: Yes (`USER 1001`)
- **HEALTHCHECK**: None
- **Multi-architecture**: Not configured (no `--platform`, no `docker buildx`)
- **Runtime validation**: None (no Testcontainers, no `docker run` tests)
- **oc client version**: Not pinned — downloads `latest` from `mirror.openshift.com`
- **model-mesh directory**: Referenced in Dockerfile `ADD model-mesh $HOME/model-mesh` but directory does not exist in repo (potential build failure)

Notable issue: The Dockerfile references `ADD model-mesh $HOME/model-mesh` but no `model-mesh/` directory exists in the repository. This would cause a build failure unless the directory is created during the build process or the Dockerfile is outdated.

### Coverage Tracking

**Score: 0.0/10**

- **Codecov/Coveralls**: Not configured
- **Coverage reports**: None
- **Coverage thresholds**: None
- **PR coverage reporting**: None

Given the repository is primarily shell scripts and YAML manifests, traditional code coverage is less applicable. However, if BATS tests were added for `deploy.sh`, coverage tracking via `kcov` or similar would be valuable.

### CI/CD Automation

**Score: 1.0/10**

- **GitHub Actions workflows**: None (no `.github/workflows/` directory)
- **CI configuration**: `.aicoe-ci.yaml` (Thoth/AICoE CI for container builds)
- **Merge gating**: OpenShift CI via `OWNERS` file (prow-based lgtm/approved labels)
- **PR template**: Present with manual QE checklist
- **Concurrency control**: None
- **Caching**: None
- **Test parallelization**: None

The repository relies on:
1. **OWNERS-based merge gating** via OpenShift CI (prow) — requires `lgtm` and `approved` labels
2. **AICoE CI** (`.aicoe-ci.yaml`) for building and pushing the container image
3. **Manual QE approval** via PR template checklist

No automated checks run on PRs.

### Static Analysis

**Score: 1.0/10**

#### Linting
- **shellcheck**: Not configured (no `.shellcheckrc`, not run in CI)
- **yamllint**: Not configured
- **hadolint**: Not configured (Dockerfile linting)

#### FIPS Compatibility
- **Base image**: `registry.access.redhat.com/ubi8/ubi-minimal` — UBI-based, FIPS-capable
- **Crypto usage**: `deploy.sh` uses `openssl rand -hex 32` for secret generation and `openssl dgst` for hashing — standard OpenSSL usage, compatible with FIPS
- **Non-FIPS patterns**: None detected

#### Dependency Alerts
- **Dependabot**: Not configured
- **Renovate**: Not configured

#### Pre-commit Hooks
- **Configuration**: None (no `.pre-commit-config.yaml`)

### Agent Rules

**Score: 0.0/10**

- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **Test creation rules**: None
- **Documentation**: CONTRIBUTING.md describes manual testing process but provides no guidance for AI-assisted development

## Recommendations

### Priority 0 (Critical)

1. **Create GitHub Actions CI pipeline** with shellcheck, yamllint, hadolint, and Dockerfile build validation. This is the single highest-impact improvement — it catches entire classes of bugs before merge.

2. **Add BATS unit tests for deploy.sh functions**. The three main functions (`oc::wait::object::availability`, `oc::dashboard::apply::isvs`, `oc::object::safe::to::apply`) can be tested by mocking `oc` commands. Start with the retry logic and safe-apply checks.

3. **Add kustomize build validation** for all 15 overlay directories. This prevents broken manifests from reaching production clusters.

4. **Fix Dockerfile model-mesh reference**. The `ADD model-mesh $HOME/model-mesh` line references a directory that doesn't exist in the repository.

### Priority 1 (High Value)

5. **Add Dependabot for Docker base image tracking**. Automated PRs when UBI8 base image has security patches.

6. **Pin oc client version** in Dockerfile instead of downloading `latest`. This prevents unexpected breakage from oc CLI changes.

7. **Add pre-commit hooks** (`.pre-commit-config.yaml`) for shellcheck and yamllint to catch issues before commit.

8. **Create CLAUDE.md** with deployment script conventions, YAML manifest patterns, and testing guidance for AI-assisted contributions.

### Priority 2 (Nice-to-Have)

9. **Add E2E smoke tests** using Kind cluster to validate deploy.sh against a mock OpenShift environment (with `oc` mocked or using `kubectl` equivalents).

10. **Add HEALTHCHECK** to Dockerfile for container runtime health monitoring.

11. **Add multi-architecture builds** (amd64, arm64) for broader platform support.

12. **Add `.editorconfig`** for consistent formatting across contributors.

## Comparison to Gold Standards

| Capability | odh-deployer | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|---|---|---|---|---|
| Unit Tests | None | Jest + React Testing Library | pytest suites | Go testing + envtest |
| Integration/E2E | Manual only | Cypress + contract tests | Multi-layer validation | Ginkgo E2E |
| CI/CD | OWNERS gating only | GitHub Actions (10+ workflows) | GitHub Actions + Prow | GitHub Actions + Prow |
| Coverage | None | Codecov with thresholds | Coverage reports | Codecov enforcement |
| Static Analysis | None | ESLint + TypeScript strict | Linting configured | golangci-lint |
| Build Validation | Makefile only | PR-time build + deploy | PR image builds | PR-time builds |
| Image Testing | No validation | Multi-layer testing | 5-layer validation | Runtime tests |
| Agent Rules | None | Comprehensive CLAUDE.md | Agent rules present | Rules configured |
| Dependabot | None | Configured | Configured | Configured |
| FIPS | UBI base (capable) | N/A (frontend) | UBI + FIPS checks | FIPS build tags |

## File Paths Reference

| File | Purpose |
|---|---|
| `deploy.sh` | Main deployment script (415 lines) |
| `Dockerfile` | Container image build (UBI8-minimal base) |
| `Makefile` | Build targets (podman build/push) |
| `.aicoe-ci.yaml` | Thoth/AICoE CI configuration |
| `OWNERS` | OpenShift CI merge gating |
| `OWNERS_ALIASES` | Reviewer/approver groups |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR template with QE checklist |
| `CONTRIBUTING.md` | Contribution guide (manual testing instructions) |
| `kfdefs/` | KfDef YAML manifests (10 files) |
| `odh-dashboard/` | Dashboard app tiles, CRDs, configs (50+ files) |
| `monitoring/` | Prometheus, alerting, segment.io configs |
| `network/` | NetworkPolicy manifests |
| `pod-security-rbac/` | Pod security RoleBindings |
| `consolelink/` | OpenShift ConsoleLink CR |
| `partners/anaconda/` | Anaconda CE partner secret |
