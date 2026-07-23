---
repository: "opendatahub-io/odh-build-metadata"
overall_score: 1.0
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No source code exists — pure data/metadata storage repository"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests; repo is a git-based data store"
  - dimension: "Build Integration"
    score: 0.0
    status: "No build process — manifests are pushed by external CI systems"
  - dimension: "Image Testing"
    score: 0.0
    status: "No container images built from this repository"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No code to cover — no coverage tooling applicable"
  - dimension: "CI/CD Automation"
    score: 2.0
    status: "No GitHub workflows; external CI pushes to early-gate and ci-artifacts branches"
  - dimension: "Static Analysis"
    score: 1.0
    status: "No linting, no Dependabot/Renovate, no pre-commit hooks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No validation of incoming build metadata"
    impact: "Malformed or inconsistent manifests can be pushed without any schema validation, potentially breaking downstream consumers"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No CI/CD workflows on the main branch"
    impact: "No automated checks on pushes or PRs — data integrity relies entirely on the pushing system"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No README or documentation on main branch"
    impact: "New contributors and consumers have no guidance on repo structure, usage, or data format"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No branch protection or PR workflow visible"
    impact: "Direct pushes to main without review increase risk of incorrect metadata"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add a README.md documenting repository purpose, structure, and data format"
    effort: "1-2 hours"
    impact: "Improves discoverability and onboarding for anyone interacting with this repository"
  - title: "Add a CI workflow to validate manifests-config.yaml schema on push"
    effort: "2-4 hours"
    impact: "Catches malformed metadata before it lands in the repository"
  - title: "Enable Dependabot for the early-gate branch if any tooling dependencies exist"
    effort: "1 hour"
    impact: "Minimal but establishes a baseline security posture"
recommendations:
  priority_0:
    - "Add a GitHub Actions workflow to validate manifests-config.yaml files against a JSON schema on every push to main"
    - "Add a README.md explaining the repository purpose, branch strategy (main, early-gate, ci-artifacts), and data format"
  priority_1:
    - "Implement a schema validation script for manifests-config.yaml and kustomize overlays"
    - "Add a periodic staleness check — flag hash directories that haven't been updated in N days"
    - "Create basic agent rules (CLAUDE.md) to guide contributors on data format and structure"
  priority_2:
    - "Add a data integrity checker that validates git.url references are reachable"
    - "Consider adding a lightweight index or search mechanism given 16M+ files"
    - "Document the early-gate and ci-artifacts branch workflows and their consumers"
---

# Quality Analysis: odh-build-metadata

## Executive Summary

- **Overall Score: 1.0/10**
- **Repository Type**: Data/metadata storage (not a software project)
- **Primary Language**: None (YAML manifests only)
- **Jira Component**: Build and Release (RHOAIENG)
- **Tier**: Midstream

**odh-build-metadata** is a git-based data store used for storing ODH operator build metadata. The repository contains a single top-level directory (`components/odh-operator/`) with ~9,705 hash-based subdirectories, each containing operator manifests (kustomize overlays, CRDs, configmaps, etc.). The repository has **16,266,413 files** totaling ~47GB.

This is not a traditional software project — it contains no source code, no tests, no CI/CD workflows, and no build configuration. External CI systems push build metadata into it. The low score reflects the absence of all standard quality dimensions, though many dimensions are structurally inapplicable to this repository type.

- **Key Strengths**: Active repository (pushed today), serves as a centralized metadata store for the ODH operator build pipeline
- **Critical Gaps**: No validation, no CI/CD, no documentation, no agent rules
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 0/10 | 15% | No source code — pure data store |
| Integration/E2E | 0/10 | 20% | No tests of any kind |
| Build Integration | 0/10 | 15% | No build process — external CI pushes data |
| Image Testing | 0/10 | 10% | No container images |
| Coverage Tracking | 0/10 | 10% | No code to cover |
| CI/CD Automation | 2/10 | 15% | External CI exists (early-gate, ci-artifacts branches) but no GitHub workflows |
| Static Analysis | 1/10 | 10% | No linting, dependency alerts, or pre-commit hooks |
| Agent Rules | 0/10 | 5% | No CLAUDE.md, AGENTS.md, or .claude/ |

**Weighted Overall: 1.0/10**

## Critical Gaps

### 1. No Validation of Incoming Build Metadata
- **Impact**: Malformed or inconsistent `manifests-config.yaml` files can be pushed without schema validation, potentially breaking downstream consumers that depend on specific data formats
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Details**: Each hash directory contains a `manifests-config.yaml` with structured data (git URLs, commit hashes, source/dest mappings). No schema enforcement exists.

### 2. No CI/CD Workflows on Main Branch
- **Impact**: No automated checks on pushes or PRs — data integrity relies entirely on the external system doing the pushing
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The `.github/` directory does not exist. No GitHub Actions workflows, no Makefile, no build automation of any kind on the main branch.

### 3. No README or Documentation
- **Impact**: New contributors and downstream consumers have no guidance on repository structure, data format, or usage patterns
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: The main branch has zero documentation files. Only the `early-gate` branch has a one-line README ("Early Gate Infra").

### 4. No Branch Protection or PR Workflow
- **Impact**: Direct pushes to main without review increase risk of incorrect metadata landing
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: The repository appears to accept direct pushes from automated systems. All commits follow the pattern "build-meta for operator image {hash}".

## Quick Wins

### 1. Add a README.md (1-2 hours)
Document the repository purpose, branch strategy, data format, and consumers.

```markdown
# odh-build-metadata

Stores build metadata for ODH operator images.

## Branches
- `main` — Operator manifests indexed by image digest
- `early-gate` — Early gate test summaries per PR
- `ci-artifacts` — Test artifact archives

## Data Format
Each directory under `components/odh-operator/{digest}/` contains:
- `manifests-config.yaml` — Source-to-destination manifest mapping
- `manifests/` — Kustomize overlays, CRDs, and component configs
```

### 2. Add Schema Validation Workflow (2-4 hours)
Create a GitHub Actions workflow that validates `manifests-config.yaml` files:

```yaml
name: Validate Metadata
on:
  push:
    branches: [main]
    paths: ['components/**']

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1
          sparse-checkout: |
            components
      - name: Validate manifests-config.yaml
        run: |
          find components -name 'manifests-config.yaml' -newer .git/FETCH_HEAD | while read f; do
            python3 -c "import yaml; yaml.safe_load(open('$f'))" || exit 1
          done
```

### 3. Add Basic Agent Rules (1-2 hours)
Create a `CLAUDE.md` explaining the repository's unique nature and data format.

## Detailed Findings

### Unit Tests
**Score: 0/10**

Not applicable. This repository contains no source code — it is a pure data store consisting of YAML manifests pushed by external CI systems. There are no functions, no modules, no libraries to test.

**Files analyzed**: None found (no `*_test.go`, `*.spec.ts`, `*_test.py`, or equivalent)

### Integration/E2E Tests
**Score: 0/10**

No integration or E2E tests exist within the repository. The `early-gate` branch stores test summaries from external CI runs (e.g., early gate tests for kserve, data-science-pipelines-operator, opendatahub-operator, trainer), but these are results, not test definitions.

Example early-gate test summary (kserve PR #1720):
```yaml
job_url: "/job/devops/job/early-gate-tests/70/"
correlation_id: "eg-1783959544"
fbc_tag: "odh-pr-1720-kserve"
test_summary:
  Failed: 1
  Passed: 5
  Skipped: 0
  Total: 6
```

The `ci-artifacts` branch stores compressed test artifact archives (`.tar.gz` files) but no test definitions.

### Build Integration
**Score: 0/10**

There is no build process in this repository. No `Makefile`, `Dockerfile`, `Containerfile`, or build scripts exist. The repository serves as a target for external build systems that push operator manifests after building images.

The `manifests-config.yaml` files map source repos to destination paths:
- Source: upstream/midstream repos (kserve, kubeflow, notebooks, etc.)
- Destination: kustomize overlay paths within each hash directory
- Each entry includes `git.url`, `git.commit`, `src`, and `dest`

### Image Testing
**Score: 0/10**

Not applicable. No container images are built from this repository. It stores metadata *about* images built elsewhere.

### Coverage Tracking
**Score: 0/10**

Not applicable. No source code exists to measure coverage against. No `.codecov.yml`, `.coveragerc`, or coverage tooling configuration.

### CI/CD Automation
**Score: 2/10**

No GitHub Actions workflows exist on any branch. The `.github/` directory is entirely absent. However, external CI systems actively interact with this repository:

- **Main branch**: Receives automated pushes with commit messages like "build-meta for operator image {digest}" — pushed as recently as today (2026-07-20)
- **Early-gate branch**: Stores early gate test summaries pushed by Jenkins (`/job/devops/job/early-gate-tests/`)
- **CI-artifacts branch**: Stores test artifact archives from component test runs

The score of 2 reflects that external CI infrastructure exists and actively uses this repository, even though no in-repo CI workflows are defined.

**Missing**:
- No PR-triggered validation workflows
- No concurrency control
- No caching strategies
- No test parallelization
- No push validation

### Static Analysis
**Score: 1/10**

No static analysis tooling of any kind:

#### Linting
- No `.golangci.yaml` or equivalent (no code to lint)
- No YAML linting (e.g., yamllint) despite the repo being 100% YAML

#### FIPS Compatibility
- Not applicable — no source code or crypto usage

#### Dependency Alerts
- No `.github/dependabot.yml` — no dependencies to track
- No `renovate.json` or `.renovaterc`

#### Pre-commit Hooks
- No `.pre-commit-config.yaml`

The score of 1 (rather than 0) acknowledges that while no tooling exists, a YAML linting configuration would be the primary applicable static analysis for this repo type.

### Agent Rules
**Score: 0/10**

- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **Coverage**: No test type rules (N/A for data repo)
- **Quality**: N/A
- **Gaps**: No guidance for AI agents on data format, validation rules, or contribution patterns
- **Recommendation**: Create a basic `CLAUDE.md` explaining the repository's nature as a data store, the branch strategy, and the `manifests-config.yaml` schema

## Recommendations

### Priority 0 (Critical)
1. **Add a GitHub Actions workflow to validate `manifests-config.yaml` files** — Ensure YAML syntax is valid and required fields (`map`, `git.url`, `git.commit`, `src`, `dest`) are present on every push to main
2. **Create a comprehensive README.md** — Document the repository purpose, branch strategy (main/early-gate/ci-artifacts), data format, consumers, and the relationship to the ODH operator build pipeline

### Priority 1 (High Value)
1. **Implement a JSON/YAML schema for `manifests-config.yaml`** — Define a strict schema and validate against it in CI
2. **Add a staleness detection workflow** — Periodically check for hash directories with outdated git.commit references
3. **Create basic agent rules (CLAUDE.md)** — Guide AI agents on the repo's data-only nature, preventing misguided suggestions about adding tests or build configs for non-existent code
4. **Add YAML linting** — Even for a data store, yamllint can catch formatting inconsistencies across 16M+ files

### Priority 2 (Nice-to-Have)
1. **Add a data integrity validator** — Verify that `git.url` references point to valid, accessible repositories and that `git.commit` hashes exist
2. **Create a lightweight index** — Given 16M+ files, a manifest index could accelerate lookups without traversing the entire tree
3. **Document the early-gate and ci-artifacts workflows** — Explain which systems produce and consume data on these branches
4. **Add repository size monitoring** — Track growth rate and implement cleanup policies for old hash directories

## Comparison to Gold Standards

| Dimension | odh-build-metadata | odh-dashboard | notebooks | kserve |
|-----------|-------------------|---------------|-----------|--------|
| Unit Tests | 0/10 (N/A) | 9/10 | 7/10 | 8/10 |
| Integration/E2E | 0/10 (N/A) | 9/10 | 8/10 | 9/10 |
| Build Integration | 0/10 (N/A) | 8/10 | 7/10 | 7/10 |
| Image Testing | 0/10 (N/A) | 6/10 | 9/10 | 6/10 |
| Coverage Tracking | 0/10 (N/A) | 8/10 | 5/10 | 8/10 |
| CI/CD Automation | 2/10 | 9/10 | 8/10 | 9/10 |
| Static Analysis | 1/10 | 7/10 | 6/10 | 7/10 |
| Agent Rules | 0/10 | 7/10 | 3/10 | 2/10 |
| **Overall** | **1.0/10** | **8.0/10** | **7.0/10** | **7.5/10** |

**Note**: This comparison is inherently unfair — odh-build-metadata is a data store, not a software project. Most dimensions are structurally inapplicable. The meaningful comparison points are CI/CD Automation (where validation workflows could apply) and Static Analysis (where YAML linting would be relevant).

## File Paths Reference

### Repository Structure
```
components/
└── odh-operator/
    ├── {image-digest-hash-1}/
    │   ├── manifests-config.yaml
    │   └── manifests/
    │       ├── dashboard/
    │       ├── kserve/
    │       ├── datasciencepipelines/
    │       └── workbenches/
    ├── {image-digest-hash-2}/
    │   └── ...
    └── ... (9,705 hash directories, 16M+ total files)
```

### Branch Strategy
| Branch | Purpose | Pushed By |
|--------|---------|-----------|
| `main` | Operator build manifests | Automated build pipeline |
| `early-gate` | Early gate test summaries | Jenkins (`/job/devops/job/early-gate-tests/`) |
| `ci-artifacts` | Test artifact archives | Component test runners |

### Key Configuration Files
- `components/odh-operator/{hash}/manifests-config.yaml` — Source-to-destination manifest mapping
- `components/odh-operator/{hash}/manifests/` — Kustomize overlays and component configs
- `{component}/{pr-number}/early-gate-test-summary.yaml` (early-gate branch) — Test results
