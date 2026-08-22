---
repository: "redhat-openshift-ecosystem/community-operators-prod"
overall_score: 1.7
scorecard:
  - dimension: "Unit Tests"
    score: 1.0
    status: "No source code — repo is a YAML metadata catalog, not a code project"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "External pipeline runs DeployableByOLM and preflight checks; no in-repo test code"
  - dimension: "Build Integration"
    score: 2.0
    status: "3,080 bundle.Dockerfiles exist but no PR-time build validation in-repo"
  - dimension: "Image Testing"
    score: 1.0
    status: "Bundle Dockerfiles are FROM scratch metadata-only; no runtime validation"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No code coverage tooling — no source code to measure"
  - dimension: "CI/CD Automation"
    score: 3.0
    status: "Only 2 lightweight GitHub workflows; main CI runs externally via operator-pipelines"
  - dimension: "Static Analysis"
    score: 1.0
    status: "No linting, no YAML schema validation, no dependency alerts, no pre-commit hooks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No in-repo YAML schema validation for operator bundles"
    impact: "Malformed CSVs, CRDs, or catalog entries can only be caught by external pipeline after PR submission, slowing contributor feedback"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No PR-time bundle structure validation workflow"
    impact: "Contributors wait for external pipeline to validate bundle structure, increasing PR cycle time"
    severity: "HIGH"
    effort: "6-10 hours"
  - title: "No Dependabot or Renovate for GitHub Actions pinning"
    impact: "Workflows reference unpinned actions (e.g., actions/stale@v3) that could become outdated or compromised"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No pre-commit hooks for YAML linting or bundle format checks"
    impact: "Contributors submit malformed YAML that is only caught after PR review"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add Dependabot for GitHub Actions version pinning"
    effort: "1 hour"
    impact: "Automated security updates for workflow dependencies"
  - title: "Add a YAML linting pre-commit hook or CI check"
    effort: "2-3 hours"
    impact: "Catch YAML syntax errors before PR submission"
  - title: "Create CLAUDE.md with contribution guidelines for AI-assisted PRs"
    effort: "2-3 hours"
    impact: "Ensure AI agents follow bundle structure conventions when creating operator submissions"
  - title: "Add a basic PR validation workflow for bundle directory structure"
    effort: "4-6 hours"
    impact: "Fast feedback on structural issues without waiting for external pipeline"
recommendations:
  priority_0:
    - "Add in-repo YAML schema validation for ClusterServiceVersion and CRD files in a PR-triggered workflow"
    - "Pin GitHub Actions to SHA digests and enable Dependabot for .github/workflows"
  priority_1:
    - "Add a PR-triggered workflow to validate bundle directory structure (manifests/, metadata/, annotations.yaml)"
    - "Add yamllint or similar YAML schema validation as a pre-commit hook or CI step"
    - "Create CLAUDE.md with operator bundle contribution guidelines"
  priority_2:
    - "Add catalog consistency checks (verify catalog.yaml entries match operator bundles)"
    - "Add a CI workflow to validate ci.yaml reviewer/updateGraph fields"
    - "Consider an in-repo scorecard/preflight dry-run step for faster contributor feedback"
---

# Quality Analysis: community-operators-prod

## Executive Summary

- **Overall Score: 1.7/10**
- **Repository Type**: Operator catalog/registry (YAML metadata, not source code)
- **Primary Language**: YAML (73,098 YAML files across 328 operators)
- **Key Strengths**: Well-organized operator bundle structure; FBC (File-Based Catalog) for OCP 4.12-4.22; external pipeline integration via config.yaml with 4 defined test suites; comprehensive PR template
- **Critical Gaps**: No in-repo CI/CD validation, no YAML schema enforcement, no static analysis, no agent rules
- **Agent Rules Status**: Missing

### Important Context

This repository is a **community operator catalog**, not a source code project. It contains operator bundle manifests (CSVs, CRDs, metadata) submitted by external contributors. The primary CI/CD validation (DeployableByOLM, preflight checks, dangling bundle checks) is handled by the **external operator-pipelines** infrastructure, configured via `config.yaml`. This explains the low scores in code-centric dimensions — many are structurally inapplicable.

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 1/10 | 15% | No source code — repo is a YAML metadata catalog |
| Integration/E2E | 3/10 | 20% | External pipeline runs DeployableByOLM and preflight checks |
| Build Integration | 2/10 | 15% | 3,080 bundle.Dockerfiles exist but no PR-time build validation |
| Image Testing | 1/10 | 10% | Bundle Dockerfiles are FROM scratch metadata-only |
| Coverage Tracking | 0/10 | 10% | No code coverage — no source code to measure |
| CI/CD Automation | 3/10 | 15% | Only 2 lightweight GitHub workflows; main CI external |
| Static Analysis | 1/10 | 10% | No YAML linting, no schema validation, no dependency alerts |
| Agent Rules | 0/10 | 5% | No CLAUDE.md, AGENTS.md, or .claude/ directory |

**Weighted Overall: 1.7/10**

## Critical Gaps

### 1. No In-Repo YAML Schema Validation
- **Impact**: Malformed CSVs, CRDs, or catalog entries can only be caught by the external operator-pipelines after PR submission, creating slow feedback loops for contributors
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Details**: The repo contains 6,790 ClusterServiceVersion YAMLs and 4,197 CRD YAMLs with no in-repo validation. Contributors must wait for the external pipeline to discover structural issues.

### 2. No PR-Time Bundle Structure Validation
- **Impact**: Contributors wait for external pipeline to validate that bundles contain required directories (manifests/, metadata/) and files (annotations.yaml)
- **Severity**: HIGH
- **Effort**: 6-10 hours
- **Details**: A lightweight GitHub Actions workflow could validate directory structure, required labels in bundle.Dockerfile, and annotations.yaml format within seconds of PR creation.

### 3. No Dependency Management for GitHub Actions
- **Impact**: Workflows use unpinned action references (`actions/stale@v3`) that could become outdated or introduce supply chain risk
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: No `.github/dependabot.yml` or Renovate configuration exists for the 2 workflow files.

### 4. No Pre-Commit Hooks
- **Impact**: Basic YAML syntax errors pass through to PR review
- **Severity**: MEDIUM
- **Effort**: 2-4 hours

## Quick Wins

### 1. Add Dependabot for GitHub Actions (1 hour)
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 2. Add YAML Linting CI Check (2-3 hours)
```yaml
# .github/workflows/yaml-lint.yml
name: YAML Lint
on:
  pull_request:
    paths:
      - 'operators/**/*.yaml'
      - 'operators/**/*.yml'
      - 'catalogs/**/*.yaml'
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install yamllint
        run: pip install yamllint
      - name: Lint changed YAML files
        run: |
          git diff --name-only --diff-filter=ACMR origin/main...HEAD \
            | grep -E '\.(yaml|yml)$' \
            | xargs -r yamllint -c .yamllint.yml
```

### 3. Create CLAUDE.md (2-3 hours)
Add a `CLAUDE.md` with operator bundle contribution guidelines so AI agents follow the correct structure when preparing operator submissions.

### 4. Add Bundle Structure Validation Workflow (4-6 hours)
A lightweight workflow to verify that PRs touching `operators/` contain the required bundle structure (manifests/, metadata/, annotations.yaml, bundle.Dockerfile).

## Detailed Findings

### Unit Tests
- **Score**: 1/10
- **Finding**: No test files found (`*_test.go`, `*.spec.ts`, `*_test.py`, etc.)
- **Context**: This is expected — the repository contains only operator bundle manifests (YAML), not executable code. The score of 1 (rather than 0) reflects that `config.yaml` defines structural validation tests (check_operator_name, check_dangling_bundles) that run externally.

### Integration/E2E Tests
- **Score**: 3/10
- **Finding**: The `config.yaml` defines 4 test suites executed by the external operator-pipelines:
  - `DeployableByOLM` — deploys bundles via OLM to verify they install (with ignore rules for ACK operators)
  - `check_dangling_bundles` — validates bundle integrity
  - `check_operator_name` — validates naming conventions
  - `preflight-trigger` — runs Red Hat preflight certification checks
- **Strength**: These are meaningful integration tests, even though they're defined and executed externally
- **Gap**: No test code lives in this repository; contributors cannot run any validation locally

### Build Integration
- **Score**: 2/10
- **Finding**: 3,080 `bundle.Dockerfile` files exist across operator versions, but they are all `FROM scratch` metadata containers (labels + COPY manifests). No actual build logic exists in-repo.
- **Gap**: No PR-time validation that bundle.Dockerfiles are well-formed or that required labels are present. The `allowed_bundle_registries` config constrains where images are published but doesn't validate build-time.

### Image Testing
- **Score**: 1/10
- **Finding**: Bundle images are `FROM scratch` with only LABEL and COPY instructions — they are not runtime containers. There is no container startup testing, health checking, or multi-arch validation.
- **Context**: This is partially expected for OLM bundle images, which are metadata-only containers consumed by OLM indexing.

### Coverage Tracking
- **Score**: 0/10
- **Finding**: No `.codecov.yml`, `coveralls.yml`, `.coveragerc`, or any coverage tooling
- **Context**: No source code exists to measure coverage for. This dimension is structurally inapplicable.

### CI/CD Automation
- **Score**: 3/10
- **Finding**: Only 2 GitHub workflow files:
  1. `pr-label-command.yml` — handles PR labels via issue comments (references external `redhat-openshift-ecosystem/github-workflows`)
  2. `stale_issues.yaml` — scheduled daily cleanup of stale issues/PRs (30 day stale, 7 day close for PRs)
- **Gap**: The main CI/CD pipeline (operator-pipelines) runs entirely outside this repo. No build caching, no test parallelization, no matrix strategies, no concurrency control in-repo.
- **Positive**: The external pipeline integration via `config.yaml` is well-structured with per-operator `ci.yaml` files (326 total) defining update strategies and reviewer lists.

### Static Analysis

#### Linting
- No YAML linting configuration (`.yamllint.yml` or equivalent)
- No schema validation for CSV/CRD/catalog YAML files
- No format enforcement for the 73,098 YAML files

#### FIPS Compatibility
- Not applicable — no compiled binaries or crypto-dependent code

#### Dependency Alerts
- **No Dependabot** (`.github/dependabot.yml` missing)
- **No Renovate** (`renovate.json` / `.renovaterc` missing)
- GitHub Actions are referenced without SHA pinning (`actions/stale@v3`)

#### Pre-commit Hooks
- No `.pre-commit-config.yaml`
- No enforcement of YAML formatting or bundle structure at commit time

### Agent Rules
- **Score**: 0/10
- **Status**: Missing
- No `CLAUDE.md` or `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` for contribution guidelines
- **Impact**: AI agents have no guidance on operator bundle structure, required files, naming conventions, or the ci.yaml format
- **Recommendation**: Create `CLAUDE.md` with operator packaging guidelines and generate rules with `/test-rules-generator` for YAML validation patterns

## Recommendations

### Priority 0 (Critical)
1. **Add in-repo YAML schema validation** — Create a PR-triggered workflow that validates ClusterServiceVersion and CRD YAML files against OLM schemas. This provides fast feedback without waiting for the external pipeline.
2. **Pin GitHub Actions to SHA digests and enable Dependabot** — The current `actions/stale@v3` reference is unpinned and could introduce supply chain risk.

### Priority 1 (High Value)
1. **Add PR-triggered bundle structure validation** — Verify that new operator bundles contain required directories (`manifests/`, `metadata/`) and files (`annotations.yaml`, `bundle.Dockerfile`).
2. **Add yamllint or equivalent** — Even basic YAML syntax validation would catch common contributor errors.
3. **Create CLAUDE.md** — Document operator bundle contribution conventions for AI-assisted submissions (bundle structure, ci.yaml format, naming rules, catalog entry requirements).

### Priority 2 (Nice-to-Have)
1. **Add catalog consistency checks** — Verify that FBC `catalog.yaml` entries reference operator bundles that actually exist in the `operators/` directory.
2. **Add ci.yaml validation** — Ensure per-operator `ci.yaml` files have valid `updateGraph` values and at least one reviewer.
3. **In-repo preflight dry-run** — Allow contributors to run a subset of preflight checks locally before submitting PRs.

## Comparison to Gold Standards

| Dimension | community-operators-prod | odh-dashboard | notebooks | kserve |
|-----------|--------------------------|---------------|-----------|--------|
| Unit Tests | 1/10 | 8/10 | 6/10 | 8/10 |
| Integration/E2E | 3/10 | 9/10 | 7/10 | 9/10 |
| Build Integration | 2/10 | 7/10 | 8/10 | 7/10 |
| Image Testing | 1/10 | 6/10 | 9/10 | 6/10 |
| Coverage Tracking | 0/10 | 8/10 | 5/10 | 8/10 |
| CI/CD Automation | 3/10 | 9/10 | 8/10 | 8/10 |
| Static Analysis | 1/10 | 7/10 | 5/10 | 7/10 |
| Agent Rules | 0/10 | 6/10 | 2/10 | 3/10 |
| **Overall** | **1.7/10** | **7.8/10** | **6.5/10** | **7.3/10** |

**Note**: Direct comparison is limited because community-operators-prod is a metadata catalog, not a source code project. Gold standard repositories contain executable code with inherently richer testing opportunities. The most relevant improvements for this repo center on YAML validation, bundle structure enforcement, and contributor experience tooling.

## File Paths Reference

| File | Purpose |
|------|---------|
| `config.yaml` | External pipeline configuration (test suites, maintainers, registries) |
| `mkdocs.yml` | Documentation site configuration |
| `.github/workflows/pr-label-command.yml` | PR label management via comments |
| `.github/workflows/stale_issues.yaml` | Stale issue/PR cleanup (daily cron) |
| `operators/*/ci.yaml` | Per-operator pipeline settings (326 files) |
| `operators/*/*/bundle.Dockerfile` | OLM bundle Dockerfiles (3,080 files) |
| `operators/*/*/manifests/*.yaml` | Operator manifests — CSVs, CRDs (73K+ files) |
| `catalogs/v4.12-v4.22/*/catalog.yaml` | File-Based Catalog entries for OCP versions |
| `docs/pull_request_template.md` | PR checklist for operator submissions |

## Repository Statistics

| Metric | Value |
|--------|-------|
| Total files | 77,031 |
| Operator directories | 328 |
| Bundle Dockerfiles | 3,080 |
| ClusterServiceVersion files | 6,790 |
| CRD files | 4,197 |
| YAML files (in operators/) | 73,098 |
| Catalog versions | 11 (v4.12 - v4.22) |
| Per-operator ci.yaml files | 326 |
| GitHub workflow files | 2 |
