---
repository: "opendatahub-io/dsp-dev-tools"
overall_score: 1.0
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No test files of any kind exist in the repository"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests; scripts interact with live clusters without validation"
  - dimension: "Build Integration"
    score: 1.0
    status: "Two Dockerfiles exist but no CI build process or validation"
  - dimension: "Image Testing"
    score: 1.0
    status: "Dockerfiles present but no runtime validation, scanning, or multi-arch support"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling or tracking of any kind"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "No CI/CD pipeline — no GitHub Actions, Makefile, Jenkinsfile, or GitLab CI"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No CI/CD pipeline at all"
    impact: "Changes merge without any automated validation — broken scripts, invalid manifests, and syntax errors go undetected"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "Zero test coverage"
    impact: "Shell scripts that manipulate OpenShift cluster state have no tests; errors only found at runtime by developers"
    severity: "HIGH"
    effort: "12-20 hours"
  - title: "No YAML/manifest validation"
    impact: "Kustomize overlays and Kubernetes manifests are never validated; broken manifests waste developer time"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Committed __pycache__ and binary artifacts"
    impact: "Repository hygiene issues; .pyc files and compiled artifacts tracked in git"
    severity: "MEDIUM"
    effort: "0.5 hours"
  - title: "No container image scanning"
    impact: "Toolbox and ngrok-curl Dockerfiles install packages from the internet without vulnerability scanning"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "Hardcoded image references with no pinning strategy"
    impact: "Manifests reference specific image tags (e.g., quay.io/hukhan/...) that may break or become unavailable"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add a GitHub Actions workflow for YAML/manifest linting"
    effort: "1-2 hours"
    impact: "Catch invalid YAML and Kubernetes manifests before merge — use yamllint + kustomize build validation"
  - title: "Add ShellCheck linting for shell scripts"
    effort: "1-2 hours"
    impact: "Catch common shell scripting errors (unquoted variables, missing error handling) across 13 .sh files"
  - title: "Update .gitignore to exclude __pycache__ and .pyc files"
    effort: "0.5 hours"
    impact: "Clean up repository hygiene; remove tracked compiled Python files"
  - title: "Add a comprehensive README with usage instructions"
    effort: "2-3 hours"
    impact: "Root README is just the title — developers have no onboarding guide for the tooling collection"
  - title: "Add pre-commit hooks for YAML and shell validation"
    effort: "1-2 hours"
    impact: "Shift-left validation catches errors before they reach the repository"
recommendations:
  priority_0:
    - "Implement a basic GitHub Actions CI pipeline with YAML linting, ShellCheck, and kustomize build validation"
    - "Add manifest validation for all kustomize overlays to catch broken references and invalid resources"
  priority_1:
    - "Add integration tests for dev-setup scripts using a test cluster or mocked oc/kubectl"
    - "Add Dockerfile linting (hadolint) and basic image build validation"
    - "Pin all image references in manifests and Dockerfiles to specific digests or tags"
  priority_2:
    - "Create agent rules (.claude/rules/) for consistent script and manifest creation"
    - "Add Trivy scanning for the toolbox and ngrok-curl Dockerfiles"
    - "Add documentation validation (markdownlint) and link checking"
---

# Quality Analysis: dsp-dev-tools

## Executive Summary
- **Overall Score: 1.0/10**
- **Repository Type**: Developer tooling & utilities (shell scripts, Kubernetes manifests, example pipelines)
- **Primary Languages**: YAML (102 files), Python (14 files), Shell (13 files)
- **Key Strengths**: Well-organized kustomize overlays with base/overlay pattern; `.gitignore` excludes sensitive credentials; shell scripts use `set -e` error handling
- **Critical Gaps**: No CI/CD, no tests, no linting, no image scanning, minimal documentation
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No test files of any kind |
| Integration/E2E | 0/10 | No integration or E2E tests |
| **Build Integration** | **1/10** | **Dockerfiles exist but no CI build** |
| Image Testing | 1/10 | No runtime validation or scanning |
| Coverage Tracking | 0/10 | No coverage tooling |
| CI/CD Automation | 0/10 | No CI/CD pipeline at all |
| Agent Rules | 0/10 | No agent rules or test automation guidance |

## Critical Gaps

### 1. No CI/CD Pipeline
- **Impact**: Changes merge without any automated validation. Broken scripts, invalid YAML manifests, and syntax errors go undetected until developers try to use the tools
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: No `.github/workflows/`, no `Makefile`, no `Jenkinsfile`, no `.gitlab-ci.yml`. This is the most fundamental gap — every other quality dimension depends on having CI

### 2. Zero Test Coverage
- **Impact**: Shell scripts in `dev-setup/` and `external-connection-setup/` interact directly with OpenShift clusters (manipulating secrets, creating routes, copying SA tokens). Errors are only discovered at runtime
- **Severity**: HIGH  
- **Effort**: 12-20 hours
- **Details**: No `*_test.go`, `*_test.py`, `*.spec.ts`, or `test_*.py` files exist. Not a single test in the entire repository

### 3. No YAML/Manifest Validation
- **Impact**: The repository contains ~102 YAML files (Kubernetes manifests, kustomize overlays, deployment configs). None are validated in CI
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Kustomize overlays reference base resources and patches. A broken reference or invalid patch would silently produce incorrect manifests

### 4. Committed __pycache__ Files
- **Impact**: Binary `.pyc` files are tracked in git under `example-pipelines/fraud-detection/__pycache__/`
- **Severity**: MEDIUM
- **Effort**: 0.5 hours
- **Details**: `.gitignore` excludes `credentials.json` and output directories but misses `__pycache__/`, `*.pyc`, and other common Python artifacts

### 5. No Container Image Scanning
- **Impact**: `toolbox/Dockerfile` installs packages via `dnf`, `pip`, and downloads binaries from the internet. `external-connection-setup/tools/ngrok-curl/Dockerfile` installs curl via apt
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: No Trivy, Snyk, or any vulnerability scanning. No SBOM generation. No image signing

### 6. Hardcoded Image References
- **Impact**: Multiple manifests reference specific image tags like `quay.io/hukhan/kfp-launcher:pr-10625-ui-3` and `quay.io/argoproj/argoexec:v3.4.16` that may become unavailable
- **Severity**: MEDIUM
- **Effort**: 2-4 hours

## Quick Wins

### 1. Add YAML + ShellCheck Linting (1-2 hours)
Create `.github/workflows/lint.yml`:
```yaml
name: Lint
on: [pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: YAML Lint
        uses: ibiqlik/action-yamllint@v3
        with:
          file_or_dir: .
          config_data: |
            extends: relaxed
            rules:
              line-length: disable
      - name: ShellCheck
        uses: ludeeus/action-shellcheck@master
        with:
          scandir: '.'
```

### 2. Add Kustomize Build Validation (1-2 hours)
```yaml
      - name: Validate Kustomize Overlays
        run: |
          for dir in $(find . -name kustomization.yaml -exec dirname {} \;); do
            echo "Validating $dir..."
            kustomize build "$dir" > /dev/null || exit 1
          done
```

### 3. Clean Up .gitignore (0.5 hours)
Add to `.gitignore`:
```
__pycache__/
*.pyc
*.pyo
*.egg-info/
```

### 4. Add Pre-commit Hooks (1-2 hours)
Create `.pre-commit-config.yaml`:
```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: check-yaml
      - id: end-of-file-fixer
      - id: trailing-whitespace
      - id: check-merge-conflict
  - repo: https://github.com/koalaman/shellcheck-precommit
    rev: v0.9.0
    hooks:
      - id: shellcheck
  - repo: https://github.com/adrienverge/yamllint
    rev: v1.33.0
    hooks:
      - id: yamllint
```

### 5. Write a Proper README (2-3 hours)
The root `README.md` contains only `# dsp-dev-tools` — one line. It should describe:
- What the repository contains
- How to use each tool/directory
- Prerequisites (oc, yq, kustomize, etc.)
- Quick start guide

## Detailed Findings

### CI/CD Pipeline
**Status: Non-existent**

There is no CI/CD configuration in any form:
- No `.github/workflows/` directory
- No `Makefile` with test/lint targets
- No `Jenkinsfile`
- No `.gitlab-ci.yml`

This means:
- PRs merge without validation
- Broken manifests are not caught
- Shell script errors go undetected
- No automated quality gates

### Test Coverage
**Status: Zero tests**

Files analyzed:
- 13 shell scripts (`.sh`) — none tested
- 14 Python files (`.py`) — none tested
- 102 YAML manifests — none validated
- 0 test files found across the entire repository

The shell scripts in `dev-setup/` are particularly risky — they run `oc` commands to create routes, copy certificates, and manipulate service account tokens. A bug in these scripts could:
- Overwrite production secrets
- Deploy incorrect manifests
- Leave cluster state inconsistent

### Code Quality
**Status: No tooling**

- No linting configuration (no `.golangci.yaml`, `.eslintrc`, `ruff.toml`, `.flake8`)
- No pre-commit hooks
- No static analysis (no CodeQL, gosec, Semgrep)
- No code formatters configured
- No EditorConfig

**Positive note**: Shell scripts do use `set -eE -o functrace` with error traps in the main scripts, which is a good practice for catching errors at runtime.

### Container Images
**Status: Minimal**

Two Dockerfiles exist:

1. **`toolbox/Dockerfile`** — Fedora-based dev toolbox
   - Installs: `yq`, `oc`, `kustomize`, `mc` (MinIO client), `huggingface-cli`
   - Downloads binaries from GitHub releases — no checksum verification
   - No multi-stage build
   - No health check
   - Runs as root

2. **`external-connection-setup/tools/ngrok-curl/Dockerfile`** — ngrok with curl
   - Based on `ngrok/ngrok:3.6.0-debian`
   - Runs `apt update && apt upgrade` — good practice but no pinning
   - Switches to `ngrok` user — good practice

Neither Dockerfile has:
- Vulnerability scanning
- Build automation
- Multi-architecture support
- SBOM generation
- Image signing

### Security
**Status: Minimal**

**Positive**:
- `.gitignore` excludes `credentials.json`, `details.json`, and `token.pickle`
- External connection setup generates secrets dynamically rather than hardcoding them

**Gaps**:
- No secret detection (Gitleaks, TruffleHog)
- No vulnerability scanning
- No SAST tooling
- Shell scripts handle sensitive data (tokens, passwords) — `dev-setup/main.sh` reads secrets from OpenShift and writes them to local files
- The `tester/role.yaml` grants wildcard permissions (`* * *`) which is overly permissive

### Agent Rules (Agentic Flow Quality)
**Status: Missing**

- No `CLAUDE.md` or `AGENTS.md` in root
- No `.claude/` directory
- No `.claude/rules/` for test creation rules
- No `.claude/skills/` for custom skills
- No testing documentation

**Recommendation**: Generate missing rules with `/test-rules-generator`. For this repository, rules should cover:
- Shell script creation patterns
- Kubernetes manifest validation
- Kustomize overlay structure
- Example pipeline development

## Recommendations

### Priority 0 (Critical)
1. **Implement a basic GitHub Actions CI pipeline** with:
   - YAML linting (`yamllint`)
   - Shell script linting (`shellcheck`)
   - Kustomize build validation
   - Estimated effort: 4-8 hours

2. **Add manifest validation for all kustomize overlays** to catch:
   - Broken resource references
   - Invalid patches
   - Missing bases
   - Estimated effort: 2-4 hours

### Priority 1 (High Value)
1. **Add integration tests for dev-setup scripts** — at minimum, validate argument handling and template generation without requiring a live cluster
2. **Add Dockerfile linting (hadolint)** and basic image build validation
3. **Pin all image references** in manifests and Dockerfiles to specific digests or semantic version tags
4. **Add pre-commit hooks** for local validation before commits
5. **Clean up repository hygiene** — remove committed `__pycache__/`, update `.gitignore`

### Priority 2 (Nice-to-Have)
1. **Create agent rules** (`.claude/rules/`) for consistent script and manifest creation
2. **Add Trivy scanning** for the toolbox and ngrok-curl Dockerfiles
3. **Add documentation validation** (markdownlint) and link checking
4. **Write comprehensive README** with usage guides for each tool directory
5. **Add binary checksum verification** in `toolbox/Dockerfile` for downloaded tools

## Comparison to Gold Standards

| Dimension | dsp-dev-tools | odh-dashboard | notebooks | kserve |
|-----------|:---:|:---:|:---:|:---:|
| CI/CD Pipeline | None | Comprehensive | Multi-layer | Extensive |
| Unit Tests | None | Jest + Cypress | Shell-based | Go testing |
| Integration Tests | None | Contract tests | Image validation | envtest |
| E2E Tests | None | Full E2E suite | 5-layer validation | Multi-version |
| Coverage Tracking | None | Codecov | Custom | Codecov |
| Image Scanning | None | Trivy | Trivy | Trivy |
| Pre-commit Hooks | None | ESLint + Prettier | ShellCheck | golangci-lint |
| Agent Rules | None | Comprehensive | Basic | None |
| Documentation | Minimal | Extensive | Good | Extensive |

**Gap Summary**: `dsp-dev-tools` lacks every quality practice that the gold standard repositories implement. As a developer tooling repository, it has lower stakes than production services, but the shell scripts directly manipulate cluster state which makes testing valuable.

## File Paths Reference

### Repository Structure
```
dsp-dev-tools/
├── cloudbeaver/           # CloudBeaver deployment (kustomize)
├── datasets/              # Sample data (iris.csv)
├── dev-setup/             # Local dev environment setup scripts
│   ├── main.sh            # Main setup script (oc interactions)
│   ├── post-config-run.sh # Post-config script (copies certs)
│   ├── converter.py       # Artifact converter
│   ├── driver-launcher-debug/ # Debug utilities
│   ├── manifests/         # Minio route
│   └── templates/         # Port-forward and config templates
├── example-pipelines/     # Example KFP pipelines
│   └── fraud-detection/   # Fraud detection ML pipeline
├── external-connection-setup/ # External DB/MinIO connection tools
│   ├── devenv.sh          # Deploy/cleanup external connections
│   ├── manifests/         # MariaDB and MinIO manifests
│   └── tools/             # ngrok-curl Dockerfile
├── manifests/             # Kubernetes deployment manifests
│   ├── deploy-argo-server/ # Argo Workflows UI
│   └── deploy-kfp/        # Kubeflow Pipelines on OpenShift
├── meeting-calendar/      # Meeting facilitator calendar script
├── toolbox/               # Dev toolbox container
├── .gitignore
├── LICENSE
└── README.md              # "# dsp-dev-tools" (1 line)
```

### Key Files Analyzed
- `toolbox/Dockerfile` — Fedora-based dev toolbox with yq, oc, kustomize, mc
- `external-connection-setup/tools/ngrok-curl/Dockerfile` — ngrok + curl
- `dev-setup/main.sh` — Main dev setup script (96 lines, interacts with oc)
- `dev-setup/post-config-run.sh` — Post-config script (copies SA tokens)
- `external-connection-setup/devenv.sh` — External connection deploy/cleanup
- `manifests/deploy-kfp/openshift/` — KFP deployment with auth/base overlays
- `cloudbeaver/` — CloudBeaver deployment with kustomize overlays
- `example-pipelines/fraud-detection/` — KFP fraud detection example (7 Python files)
