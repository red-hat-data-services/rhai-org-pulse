---
repository: "opendatahub-io/dsp-dev-tools"
overall_score: 1.2
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No test files found anywhere in the repository"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E test infrastructure"
  - dimension: "Build Integration"
    score: 1.0
    status: "Two Dockerfiles present but no CI build validation"
  - dimension: "Image Testing"
    score: 0.5
    status: "Dockerfiles exist but no image testing, scanning, or validation"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling or tracking configured"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "No CI/CD pipeline (no GitHub Actions, GitLab CI, or Jenkins)"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No CI/CD pipeline of any kind"
    impact: "Changes are merged without any automated validation — no linting, no tests, no build checks"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "Zero test coverage across all dimensions"
    impact: "Shell scripts and Python utilities are untested; broken scripts discovered only during manual use"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No security scanning on container images"
    impact: "Dockerfiles install packages via curl without verification; no vulnerability scanning"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No code quality tooling"
    impact: "No linting (shellcheck, pylint/ruff), no formatting, no static analysis"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "Single contributor, minimal git history"
    impact: "Bus factor of 1; only 1 commit on main branch suggests squash-and-force-push workflow or limited collaboration"
    severity: "MEDIUM"
    effort: "N/A (organizational)"
quick_wins:
  - title: "Add ShellCheck linting via GitHub Actions"
    effort: "1-2 hours"
    impact: "Catches common shell scripting errors in 13 .sh files automatically on PRs"
  - title: "Add Trivy scanning for Dockerfiles"
    effort: "1-2 hours"
    impact: "Detects vulnerabilities in base images (fedora-toolbox:40, ngrok:3.6.0-debian)"
  - title: "Add basic YAML validation workflow"
    effort: "1-2 hours"
    impact: "Validates 102 YAML/Kustomize files that form the core of this repo"
  - title: "Add a CLAUDE.md with project context"
    effort: "1 hour"
    impact: "Enables AI-assisted development with proper context about the dev tooling purpose"
recommendations:
  priority_0:
    - "Create a basic GitHub Actions CI workflow with ShellCheck, yamllint, and Dockerfile linting (hadolint)"
    - "Add Trivy or Snyk scanning for the two Dockerfiles to catch base image vulnerabilities"
  priority_1:
    - "Add integration tests for the dev-setup/main.sh script (at minimum, input validation and template generation)"
    - "Add kustomize build validation for all overlay directories to catch manifest errors before deployment"
    - "Pin curl-downloaded binaries in Dockerfiles to SHA256 checksums for supply chain security"
  priority_2:
    - "Create CLAUDE.md and agent rules for contributing patterns"
    - "Add pre-commit hooks for shell and YAML linting"
    - "Consider adding Python type checking (mypy/ruff) for the 14 Python files"
---

# Quality Analysis: dsp-dev-tools

## Executive Summary

- **Overall Score: 1.2/10**
- **Repository Type**: Developer tooling / utilities collection (shell scripts, Kubernetes manifests, Python pipeline examples)
- **Primary Languages**: YAML (102 files), Python (14 files), Shell (13 files)
- **Key Strengths**: Clear per-directory README documentation; practical developer-facing tooling for DSP/DSPO local development
- **Critical Gaps**: No CI/CD pipeline, zero test coverage, no code quality tooling, no security scanning, no agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

This repository is a collection of developer utilities for the Data Science Pipelines (DSP) ecosystem. It provides local development setup scripts, external connection configuration, Kubernetes manifests, and example pipelines. The repo has **no automated quality practices** — no CI/CD, no tests, no linting, and no security scanning. With only 1 contributor and 1 commit on the main branch, this appears to be a low-activity internal tooling repo.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No test files found anywhere in the repository |
| Integration/E2E | 0/10 | No integration or E2E test infrastructure |
| **Build Integration** | **1/10** | **Two Dockerfiles present but no CI build validation** |
| Image Testing | 0.5/10 | Dockerfiles exist but no image testing, scanning, or validation |
| Coverage Tracking | 0/10 | No coverage tooling or tracking configured |
| CI/CD Automation | 0/10 | No CI/CD pipeline (no GitHub Actions, GitLab CI, or Jenkins) |
| Agent Rules | 0/10 | No CLAUDE.md, AGENTS.md, or .claude/ directory |

## Critical Gaps

### 1. No CI/CD Pipeline
- **Impact**: Changes are merged without any automated validation — no linting, no tests, no build checks
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: No `.github/workflows/`, no `.gitlab-ci.yml`, no `Jenkinsfile`, no `Makefile` with test targets. PRs (if any are used) get zero automated feedback.

### 2. Zero Test Coverage
- **Impact**: Shell scripts and Python utilities are untested; broken scripts discovered only during manual use
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Details**: No `*_test.*`, `*.spec.*`, `*.test.*`, or `test_*` files exist. No test directories, no test frameworks configured. The `dev-setup/main.sh` script (153 lines) manipulates cluster credentials and configuration without any validation tests.

### 3. No Security Scanning
- **Impact**: Dockerfiles install packages via curl without checksum verification; no vulnerability scanning on base images
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**:
  - `toolbox/Dockerfile` downloads yq, oc, kustomize, and mc via curl without SHA verification
  - `external-connection-setup/tools/ngrok-curl/Dockerfile` based on `ngrok/ngrok:3.6.0-debian`
  - No Trivy, Snyk, or CodeQL configured
  - No `.gitleaks.toml` or secret detection despite scripts handling credentials/tokens

### 4. No Code Quality Tooling
- **Impact**: No automated detection of common scripting errors, YAML syntax issues, or Python bugs
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: No ShellCheck, hadolint, yamllint, pylint/ruff, mypy, or any linting configuration. No `.pre-commit-config.yaml`. No formatters.

### 5. Single Contributor, Minimal History
- **Impact**: Bus factor of 1; project knowledge concentrated in one person
- **Severity**: MEDIUM
- **Effort**: N/A (organizational)
- **Details**: Only 1 contributor (Humair Khan). Only 1 commit on main branch (suggests squash-and-force-push workflow or initial dump). Last commit was April 2025.

## Quick Wins

### 1. Add ShellCheck Linting via GitHub Actions (1-2 hours)
Catches common shell scripting errors in 13 `.sh` files automatically on PRs.

```yaml
# .github/workflows/lint.yml
name: Lint
on: [pull_request]
jobs:
  shellcheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ludeeus/action-shellcheck@master
        with:
          scandir: '.'
```

### 2. Add Trivy Scanning for Dockerfiles (1-2 hours)
Detects vulnerabilities in base images.

```yaml
# .github/workflows/security.yml
name: Security Scan
on: [pull_request]
jobs:
  trivy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'config'
          scan-ref: '.'
```

### 3. Add YAML Validation (1-2 hours)
Validates the 102 YAML/Kustomize files that form the core of this repo.

```yaml
  yamllint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ibiqlik/action-yamllint@v3
```

### 4. Add CLAUDE.md (1 hour)
Enables AI-assisted development with proper project context.

## Detailed Findings

### CI/CD Pipeline

**Status**: Non-existent

No CI/CD configuration found:
- ❌ No `.github/workflows/` directory
- ❌ No `.gitlab-ci.yml`
- ❌ No `Jenkinsfile`
- ❌ No `Makefile` with automation targets
- ❌ No build or test scripts in CI context

### Test Coverage

**Status**: Zero coverage

| Test Type | Files Found | Framework | Status |
|-----------|-------------|-----------|--------|
| Unit Tests | 0 | None | ❌ Not present |
| Integration Tests | 0 | None | ❌ Not present |
| E2E Tests | 0 | None | ❌ Not present |
| Contract Tests | 0 | None | ❌ Not present |

Key untested components:
- `dev-setup/main.sh` (153 lines) — Sets up local DSP dev environment, manipulates credentials
- `external-connection-setup/devenv.sh` (300+ lines) — Deploys MariaDB/Minio, handles TLS, ngrok tunneling
- `dev-setup/converter.py` — Environment variable conversion utility
- 14 Python files in `example-pipelines/fraud-detection/` — Pipeline components

### Code Quality

**Status**: No tooling configured

- ❌ No ShellCheck configuration
- ❌ No hadolint for Dockerfiles
- ❌ No yamllint for YAML files
- ❌ No Python linting (ruff, pylint, flake8)
- ❌ No `.pre-commit-config.yaml`
- ❌ No `.editorconfig`
- ❌ No code formatting enforcement

### Container Images

**Status**: Minimal — two Dockerfiles, no validation

| File | Base Image | Purpose | Issues |
|------|-----------|---------|--------|
| `toolbox/Dockerfile` | `fedora-toolbox:40` | Dev toolbox with oc, yq, kustomize, mc | Downloads binaries via curl without SHA verification |
| `external-connection-setup/tools/ngrok-curl/Dockerfile` | `ngrok/ngrok:3.6.0-debian` | ngrok with curl | Minimal, but no scanning |

Security concerns:
- Binaries downloaded via curl without checksum verification in `toolbox/Dockerfile`
- No multi-stage builds
- No `.dockerignore` in subdirectories
- No image scanning configured
- No SBOM generation
- No image signing

### Security

**Status**: No security practices

- ❌ No SAST/CodeQL
- ❌ No dependency scanning
- ❌ No secret detection (despite scripts handling OC tokens, DB passwords, and Minio credentials)
- ❌ No Trivy/Snyk integration
- ❌ No `.gitleaks.toml`
- ⚠️ `.gitignore` excludes `credentials.json`, `details.json`, `token.pickle` — indicates awareness of secrets but no automated enforcement
- ⚠️ Scripts manipulate `accesskey`, `secretkey`, `dbpsw` variables without secret management patterns

### Agent Rules (Agentic Flow Quality)

**Status**: Missing

- ❌ No `CLAUDE.md` or `AGENTS.md` in repository root
- ❌ No `.claude/` directory
- ❌ No `.claude/rules/` test creation rules
- ❌ No `.claude/skills/` custom skills
- ❌ No testing documentation in `docs/`
- **Recommendation**: Generate rules with `/test-rules-generator` once basic testing is established

### Repository Structure

```
dsp-dev-tools/
├── cloudbeaver/          # Kustomize manifests for CloudBeaver deployment
├── datasets/             # Sample data (iris.csv)
├── dev-setup/            # Local DSP dev environment setup (main.sh, converter.py)
├── example-pipelines/    # Fraud detection pipeline example (Python/KFP)
├── external-connection-setup/  # External MariaDB/Minio dev setup (devenv.sh)
├── manifests/            # Argo Server + KFP OpenShift deployment manifests
├── meeting-calendar/     # Google Calendar script (Python)
├── toolbox/              # Developer toolbox container (Dockerfile)
├── .gitignore
├── LICENSE
└── README.md
```

**File Distribution**: 102 YAML, 14 Python, 13 Shell, 9 Markdown, 2 Dockerfiles

## Recommendations

### Priority 0 (Critical)

1. **Create a basic GitHub Actions CI workflow** with ShellCheck, yamllint, and hadolint
   - Covers the 3 primary file types: shell scripts, YAML manifests, Dockerfiles
   - Effort: 4-6 hours
   - Immediate value: catches broken scripts and invalid manifests before merge

2. **Add Trivy container scanning** for the two Dockerfiles
   - `toolbox/Dockerfile` downloads unsigned binaries from the internet
   - Effort: 2-3 hours
   - Critical for supply chain security

3. **Pin binary downloads to SHA256 checksums** in `toolbox/Dockerfile`
   - Currently downloads yq, oc, kustomize, mc via curl without verification
   - Effort: 1-2 hours

### Priority 1 (High Value)

4. **Add kustomize build validation** for all overlay directories
   - 102 YAML files with kustomize overlays should be validated with `kustomize build`
   - Effort: 2-4 hours

5. **Add basic tests for dev-setup/main.sh**
   - Input validation tests (wrong number of args, missing directories)
   - Template generation verification
   - Effort: 4-8 hours

6. **Add secret detection** with gitleaks
   - Scripts handle OC tokens, DB passwords, Minio keys
   - Effort: 1-2 hours

### Priority 2 (Nice-to-Have)

7. **Create CLAUDE.md** with project context and contribution guidelines
   - Effort: 1-2 hours

8. **Add Python linting** (ruff) for the 14 Python files
   - Effort: 1-2 hours

9. **Add pre-commit hooks** for automated local checks
   - Effort: 1-2 hours

10. **Consider consolidating** the meeting-calendar utility elsewhere
    - It appears unrelated to DSP development tooling
    - Effort: 1 hour

## Comparison to Gold Standards

| Practice | odh-dashboard | notebooks | dsp-dev-tools | Gap |
|----------|:---:|:---:|:---:|-----|
| CI/CD Pipeline | ✅ Multi-workflow | ✅ Comprehensive | ❌ None | Total |
| Unit Tests | ✅ Jest + coverage | ✅ Python tests | ❌ None | Total |
| Integration Tests | ✅ Cypress + API | ✅ Image validation | ❌ None | Total |
| E2E Tests | ✅ Automated | ✅ Multi-arch | ❌ None | Total |
| Coverage Tracking | ✅ Codecov enforced | ✅ Coverage reports | ❌ None | Total |
| Container Scanning | ✅ Trivy + Snyk | ✅ Multi-layer | ❌ None | Total |
| Linting | ✅ ESLint + strict | ✅ Configured | ❌ None | Total |
| Pre-commit Hooks | ✅ Configured | ✅ Configured | ❌ None | Total |
| Agent Rules | ✅ Comprehensive | ⚠️ Partial | ❌ None | Total |
| Secret Detection | ✅ Gitleaks | ✅ Configured | ❌ None | Total |

**Note**: dsp-dev-tools is a fundamentally different type of repository (developer utilities/scripts) compared to the gold standards (full applications/operators). The gap analysis should be interpreted in context — not every practice needs the same depth, but *some* automation is essential even for tooling repos.

## File Paths Reference

| Category | Path | Description |
|----------|------|-------------|
| Container | `toolbox/Dockerfile` | Developer toolbox image |
| Container | `external-connection-setup/tools/ngrok-curl/Dockerfile` | ngrok + curl image |
| Shell | `dev-setup/main.sh` | Main dev environment setup script (153 lines) |
| Shell | `external-connection-setup/devenv.sh` | External connection setup (~300 lines) |
| Python | `dev-setup/converter.py` | Environment variable converter |
| Python | `example-pipelines/fraud-detection/*.py` | KFP pipeline components (8 files) |
| Manifests | `cloudbeaver/` | CloudBeaver Kustomize overlays |
| Manifests | `manifests/deploy-kfp/` | KFP OpenShift deployment manifests |
| Manifests | `manifests/deploy-argo-server/` | Argo Server deployment manifests |
| Manifests | `external-connection-setup/manifests/` | MariaDB/Minio deployment manifests |
| Data | `datasets/iris.csv` | Sample dataset |
| Misc | `meeting-calendar/script.py` | Google Calendar utility |
