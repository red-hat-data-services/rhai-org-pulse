---
repository: "opendatahub-io/workload-orchestration"
overall_score: 0.2
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No source code or test files — repo contains only demos and documentation"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No automated test suites — demos are manually replayed, not CI-executed"
  - dimension: "Build Integration"
    score: 1.0
    status: "Makefile has update-readme target; no PR build validation or image builds"
  - dimension: "Image Testing"
    score: 0.0
    status: "No container images built by this repository"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling — no source code to cover"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "No CI/CD workflows — no .github/workflows/ directory exists"
  - dimension: "Static Analysis"
    score: 0.0
    status: "No linting, no shellcheck, no dependency alerts, no pre-commit hooks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No CI/CD pipeline of any kind"
    impact: "No automated validation on PRs — YAML syntax errors, broken links, and script bugs can merge unchecked"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No YAML validation for Kubernetes resources"
    impact: "Demo YAML files referencing invalid API versions or missing required fields won't be caught until a user tries them"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No shellcheck or linting for hack scripts"
    impact: "Shell script bugs in update-readme.sh could silently corrupt READMEs"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No link validation for asciinema URLs"
    impact: "Demo recording links may go stale without detection"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add a GitHub Actions PR workflow with YAML linting (yamllint)"
    effort: "1-2 hours"
    impact: "Catches YAML syntax errors in demo resource files before merge"
  - title: "Add shellcheck to CI for hack/update_readme/update-readme.sh"
    effort: "1 hour"
    impact: "Prevents shell script regressions in the readme update tooling"
  - title: "Add a basic CLAUDE.md with contribution guidelines"
    effort: "1 hour"
    impact: "Enables AI-assisted contributions with repo-specific context"
  - title: "Add .github/dependabot.yml for GitHub Actions version updates"
    effort: "30 minutes"
    impact: "Keeps future CI actions pinned and updated (once CI exists)"
recommendations:
  priority_0:
    - "Create a minimal GitHub Actions workflow that validates YAML files and runs shellcheck on PRs"
    - "Add kubeval or kubeconform to validate Kubernetes resource YAML against API schemas"
  priority_1:
    - "Add a link-checker workflow to detect stale asciinema and external URLs"
    - "Add a pre-commit config with yamllint, shellcheck, and trailing-whitespace checks"
    - "Create CLAUDE.md or AGENTS.md with demo creation guidelines"
  priority_2:
    - "Consider adding automated demo replay testing (asciinema + expect-based validation)"
    - "Add a Makefile target for local YAML validation (make lint)"
---

# Quality Analysis: workload-orchestration

## Executive Summary
- **Overall Score: 0.2/10**
- **Repository Type**: Documentation / Demos (no source code)
- **Primary Content**: Kueue demo recordings (asciinema `.cast` files) and Kubernetes YAML resources
- **Key Strengths**: Well-organized demo structure with automated README generation from YAML sources
- **Critical Gaps**: No CI/CD pipeline, no validation of any kind, no linting, no agent rules
- **Agent Rules Status**: Missing
- **Jira**: RHOAIENG / Workload Orchestration (midstream tier)

> **Context Note**: This repository is a documentation/demos-only repo. It contains no source code (Go, Python, TypeScript, etc.), no container images, and no tests. Many quality dimensions score 0 not due to neglect but because they are structurally inapplicable. However, even docs/demos repos benefit from CI validation — YAML linting, link checking, shellcheck — and those are genuinely missing.

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 0.0/10 | No source code or test files |
| Integration/E2E | 20% | 0.0/10 | Demos are manual, not automated tests |
| Build Integration | 15% | 1.0/10 | Makefile exists but no PR build validation |
| Image Testing | 10% | 0.0/10 | No container images in this repo |
| Coverage Tracking | 10% | 0.0/10 | No coverage tooling |
| CI/CD Automation | 15% | 0.0/10 | No workflows at all |
| Static Analysis | 10% | 0.0/10 | No linting or dependency alerts |
| Agent Rules | 5% | 0.0/10 | No agent configuration files |
| **Overall** | **100%** | **0.2/10** | **Critical gaps across all dimensions** |

## Critical Gaps

### 1. No CI/CD Pipeline of Any Kind
- **Impact**: No automated validation on PRs — YAML syntax errors, broken links, and script bugs can merge unchecked
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The `.github/workflows/` directory does not exist. There is no CI/CD of any kind — no GitHub Actions, no GitLab CI, no Jenkins. PRs are merged with zero automated validation.

### 2. No YAML Validation for Kubernetes Resources
- **Impact**: Demo YAML files referencing invalid API versions, missing required fields, or incorrect indentation won't be caught until a user manually tries them
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: The repository contains 20+ Kubernetes YAML resource files across 3 demo directories. None are validated against K8s API schemas. A typo in an API version (e.g., `v1beta1` → `v1beta2`) would go undetected.

### 3. No Shellcheck or Script Linting
- **Impact**: Shell script bugs in `hack/update_readme/update-readme.sh` could silently corrupt READMEs during `make update-readme`
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: The `update-readme.sh` script uses `awk` inline scripting to replace YAML blocks in README files. It writes to a `temp.md` file and does an `mv` — a crash mid-execution could leave partial files.

### 4. No Link Validation
- **Impact**: Demo recording links (asciinema.org URLs) may go stale without detection
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: READMEs link to hosted asciinema recordings. If recordings are deleted or moved, users hitting those links get 404s with no automated detection.

## Quick Wins

### 1. Add GitHub Actions PR Workflow with YAML Linting (1-2 hours)
Create `.github/workflows/pr-validation.yml`:
```yaml
name: PR Validation
on:
  pull_request:
    branches: [main]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install yamllint
        run: pip install yamllint
      - name: Lint YAML files
        run: yamllint -d relaxed demos/
      - name: Validate K8s manifests
        run: |
          curl -sL https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-amd64.tar.gz | tar xz
          find demos -name '*.yaml' -not -name 'README*' | xargs ./kubeconform -strict -summary
```

### 2. Add Shellcheck to CI (1 hour)
Add to the workflow above:
```yaml
      - name: Shellcheck
        run: shellcheck hack/update_readme/update-readme.sh
```

### 3. Add Basic CLAUDE.md (1 hour)
Create a `CLAUDE.md` with:
- Repository purpose (Kueue demos)
- How to add new demos
- YAML resource conventions
- `make update-readme` usage

### 4. Add Dependabot for GitHub Actions (30 minutes)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

## Detailed Findings

### Unit Tests
- **Score: 0.0/10**
- **Files Found**: None
- **Analysis**: This repository contains no source code (no `.go`, `.py`, `.ts`, or `.js` files). It is a demos/documentation repository. Unit testing is structurally inapplicable.

### Integration/E2E Tests
- **Score: 0.0/10**
- **Files Found**: None
- **Analysis**: The repository contains 3 demo scenarios with asciinema recordings:
  1. `demos/wait-for-pods-ready/` — Kueue Gang Scheduling + WaitForPodsReady
  2. `demos/preemption_fairness/` — GPU preemption across teams
  3. `demos/resourceflavour-taints-and-tolerations/` — ResourceFlavor taints/tolerations
- These are manually-replayed demos, not automated integration tests. They require a live Kubernetes cluster with Kueue installed. No automated E2E framework wraps these demos.
- **Gap**: The demo YAML could be tested via `kubectl apply --dry-run=server` in a Kind cluster with Kueue CRDs installed.

### Build Integration
- **Score: 1.0/10**
- **Files Found**: `Makefile` (1 target: `update-readme`)
- **Analysis**: The Makefile has a single `update-readme` target that invokes `hack/update_readme/update-readme.sh` to sync YAML file contents into README files. This is a useful content-generation tool but is not a build process in the traditional sense. There is no PR-triggered build, no image creation, and no manifest validation.

### Image Testing
- **Score: 0.0/10**
- **Files Found**: None
- **Analysis**: No `Dockerfile`, `Containerfile`, `docker-compose.yml`, or `.dockerignore` exists. This repository does not build or publish container images.

### Coverage Tracking
- **Score: 0.0/10**
- **Files Found**: None
- **Analysis**: No `.codecov.yml`, `codecov.yml`, `.coveragerc`, or any coverage configuration. Without source code or tests, coverage tracking is inapplicable.

### CI/CD Automation
- **Score: 0.0/10**
- **Files Found**: None
- **Analysis**: The `.github/workflows/` directory does not exist. There is zero CI/CD automation:
  - No PR validation workflow
  - No YAML linting
  - No link checking
  - No shellcheck on hack scripts
  - No `make update-readme` verification (checking that READMEs stay in sync with YAML files)
  - No concurrency control, caching, or matrix strategies (nothing to apply them to)

### Static Analysis

#### Linting
- **Score: 0.0/10** (contributing to overall Static Analysis)
- No `.golangci.yaml`, `.eslintrc`, `ruff.toml`, or any linting configuration
- The shell script `hack/update_readme/update-readme.sh` is not checked with `shellcheck`
- No `yamllint` configuration for the 20+ YAML resource files

#### FIPS Compatibility
- Not applicable — no source code, no builds, no crypto imports, no container images

#### Dependency Alerts
- No `.github/dependabot.yml` or `renovate.json`
- Currently no dependencies to manage, but once CI is added, GitHub Actions versions should be tracked

### Agent Rules
- **Score: 0.0/10**
- **Status**: Missing
- **Analysis**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory exists. There are no agent rules, no test creation guidance, and no contribution automation guidelines.
- **Recommendation**: Create a basic `CLAUDE.md` covering:
  - Repository purpose and structure
  - How to create new demo directories
  - YAML resource conventions (Kueue CRDs, namespaces)
  - How to record asciinema demos
  - `make update-readme` workflow

## Recommendations

### Priority 0 (Critical)
1. **Create a GitHub Actions PR validation workflow** that:
   - Runs `yamllint` on all YAML resource files
   - Runs `kubeconform` to validate K8s manifests against API schemas
   - Runs `shellcheck` on `hack/update_readme/update-readme.sh`
   - Verifies `make update-readme` produces no diff (ensures READMEs stay in sync)
2. **Add `kubeconform` or `kubeval` validation** for all Kubernetes YAML files to catch API version drift (e.g., Kueue API changes from `v1beta1` to `v1`)

### Priority 1 (High Value)
1. **Add a link-checker workflow** (e.g., `lychee-action`) to detect stale asciinema URLs and external links
2. **Add a `.pre-commit-config.yaml`** with:
   - `yamllint` for YAML validation
   - `shellcheck` for shell scripts
   - `trailing-whitespace` and `end-of-file-fixer`
3. **Create `CLAUDE.md` or `AGENTS.md`** with demo creation guidelines for AI-assisted contributions

### Priority 2 (Nice-to-Have)
1. **Automated demo testing**: Use a Kind cluster with Kueue CRDs to run `kubectl apply --dry-run=server` against all demo YAML files
2. **Makefile improvements**: Add `make lint` target that runs yamllint + shellcheck locally
3. **Demo template**: Create a template directory structure for new demos with pre-populated YAML and README scaffolding

## Comparison to Gold Standards

| Capability | workload-orchestration | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|------------|----------------------|---------------------|------------------|---------------|
| Unit Tests | None | Comprehensive Jest/Cypress | Image-level testing | Go testing + envtest |
| Integration/E2E | None (manual demos) | Cypress E2E | Multi-layer validation | Multi-version Ginkgo |
| Build Integration | Makefile (readme only) | PR builds, Module Federation | Multi-arch builds | Operator bundle builds |
| Image Testing | N/A | N/A | 5-layer image validation | Runtime validation |
| Coverage Tracking | None | Codecov with thresholds | Coverage reporting | Codecov enforcement |
| CI/CD Automation | None | 15+ workflows | Matrix builds | PR + periodic jobs |
| Static Analysis | None | ESLint + Prettier | shellcheck + yamllint | golangci-lint |
| Agent Rules | None | CLAUDE.md + .claude/rules/ | Partial | Partial |

> **Note**: Direct comparison is limited because `workload-orchestration` is a demos/documentation repository, not a software project. The gold standards are full application/operator repositories.

## File Paths Reference

### Repository Structure
```
workload-orchestration/
├── Makefile                          # update-readme target
├── OWNERS                            # Approvers and reviewers
├── README.md                         # Repository overview
├── demos/
│   ├── preemption_fairness/          # GPU preemption demo
│   │   ├── README.md
│   │   ├── gpu-preemption-demo.cast
│   │   └── resources/               # 12 K8s YAML files
│   ├── resourceflavour-taints-and-tolerations/
│   │   ├── README.md
│   │   ├── resource-flavor-t-and-t.cast
│   │   └── resources/               # 5 K8s YAML files
│   └── wait-for-pods-ready/
│       ├── README.md
│       ├── wait-for-pods-ready-demo.cast
│       └── resources/               # 7 K8s YAML files
├── hack/
│   └── update_readme/
│       ├── update-readme.md
│       ├── update-readme.sh          # YAML-to-README sync script
│       └── update-readme-script-demo.webp
└── LICENSE
```

### Missing Configuration Files
- `.github/workflows/` — No CI/CD
- `.github/dependabot.yml` — No dependency alerts
- `.pre-commit-config.yaml` — No pre-commit hooks
- `.yamllint.yml` — No YAML linting
- `CLAUDE.md` / `AGENTS.md` / `.claude/` — No agent rules
- `Dockerfile` / `Containerfile` — No container images
- `go.mod` / `package.json` / `requirements.txt` — No source code dependencies
