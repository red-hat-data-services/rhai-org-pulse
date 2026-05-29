---
repository: "redhat-openshift-ecosystem/community-operators-prod"
overall_score: 4.6
scorecard:
  - dimension: "Unit Tests"
    score: 1.0
    status: "No unit tests — data-only repo with no application code to test"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "External Tekton pipeline runs DeployableByOLM + preflight checks on every PR"
  - dimension: "Build Integration"
    score: 6.0
    status: "External pipeline validates bundle builds and catalog generation; no in-repo CI simulation"
  - dimension: "Image Testing"
    score: 5.0
    status: "Bundle Dockerfiles present per operator; runtime validation via external pipeline only"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tooling — not applicable for a data-only repository"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "Minimal in-repo CI (2 workflows); heavy reliance on external Tekton-based operator pipeline"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory — zero agentic guidance"
critical_gaps:
  - title: "No in-repo CI/CD for PR validation"
    impact: "All testing is delegated to external Tekton pipelines; contributors cannot reproduce checks locally"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No schema validation in-repo workflows"
    impact: "Bundle YAML/CSV validation only happens in external pipeline; malformed PRs waste pipeline resources"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No security scanning of contributed operator images"
    impact: "Operator bundle images referenced in CSVs are not scanned for vulnerabilities in this repo"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "Zero agent rules for contribution guidance"
    impact: "AI-assisted contributions have no guardrails; higher risk of malformed submissions"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add GitHub Actions workflow for bundle schema validation"
    effort: "2-4 hours"
    impact: "Catch malformed bundles before hitting external pipeline, saving compute and review time"
  - title: "Add CLAUDE.md with contribution rules and validation checks"
    effort: "2-3 hours"
    impact: "Guide AI-assisted operator submissions with proper structure and validation"
  - title: "Add CODEOWNERS for critical paths"
    effort: "1-2 hours"
    impact: "Ensure config.yaml and catalog changes get appropriate review"
  - title: "Add catalog consistency check workflow"
    effort: "3-4 hours"
    impact: "Validate FBC catalog.yaml files reference valid operator bundles"
recommendations:
  priority_0:
    - "Add in-repo GitHub Actions for operator-sdk bundle validate on PRs to catch errors before external pipeline"
    - "Add schema validation for ci.yaml, config.yaml, and release-config.yaml files in PR workflow"
    - "Implement image registry allowlist validation as a fast PR check"
  priority_1:
    - "Add CLAUDE.md and .claude/rules/ with operator submission guidelines for AI-assisted contributions"
    - "Create a local testing script that contributors can run before submitting PRs"
    - "Add CODEOWNERS to protect config.yaml, catalogs/, and .github/ directories"
  priority_2:
    - "Consider adding Trivy scanning for container images referenced in CSVs"
    - "Add a periodic workflow to detect stale or orphaned operator bundles"
    - "Implement catalog integrity checks across OCP versions"
---

# Quality Analysis: community-operators-prod

## Executive Summary

- **Overall Score: 4.6/10**
- **Repository Type**: Data repository (operator bundle registry), not an application codebase
- **Primary Language**: YAML/JSON (operator manifests, CSVs, CRDs)
- **Scale**: 314 operators, 71,883+ files, catalogs for OCP v4.12 through v4.22
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

**Key Strengths:**
- Robust external Tekton-based operator pipeline with 20+ static checks and runtime validation
- Well-structured operator bundle format with standardized directory layout
- File-Based Catalog (FBC) support for modern OCP versions (v4.12+)
- Comprehensive PR template with contribution checklist

**Critical Gaps:**
- Minimal in-repo CI/CD — only 2 GitHub Actions workflows (stale issues + PR labels)
- No local validation tooling — contributors must wait for external pipeline to find errors
- No security scanning of referenced operator container images
- No agent rules or AI contribution guidance

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 1/10 | No unit tests — data-only repo with no application code |
| Integration/E2E | 7/10 | External Tekton pipeline: DeployableByOLM + preflight checks on every PR |
| Build Integration | 6/10 | External pipeline validates bundles; no in-repo CI simulation |
| Image Testing | 5/10 | Bundle Dockerfiles per operator; runtime validation external only |
| Coverage Tracking | 1/10 | Not applicable for data-only repository |
| CI/CD Automation | 5/10 | 2 minimal workflows in-repo; external pipeline does heavy lifting |
| Agent Rules | 0/10 | No CLAUDE.md, AGENTS.md, or .claude/ directory |

## Critical Gaps

### 1. No In-Repo CI/CD for PR Validation
- **Impact**: All testing delegated to external Tekton pipelines; contributors cannot reproduce checks locally and must wait for pipeline results
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: The repository contains only 2 GitHub Actions workflows:
  - `stale_issues.yaml` — closes stale issues/PRs on a daily cron
  - `pr-label-command.yml` — handles PR label commands from comments
  - Neither workflow performs any validation of operator bundle content

### 2. No Schema Validation in PR Workflows
- **Impact**: Malformed operator bundles (invalid CSVs, missing required fields, incorrect versions) are only caught by the external pipeline, wasting compute resources and elongating feedback cycles
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The external pipeline runs `operator-sdk bundle validate` with both `operatorhub` and `operatorframework` suites, plus 20+ custom static checks. None of these can be reproduced locally or via in-repo CI.

### 3. No Security Scanning of Operator Images
- **Impact**: Operator CSVs reference container images (e.g., `quay.io/...`) that are not scanned for vulnerabilities as part of the contribution process
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: While the preflight tool performs some validation, there is no Trivy/Snyk scanning of the actual operator container images referenced in the bundles.

### 4. Zero Agent Rules
- **Impact**: AI-assisted operator submissions have no guardrails, structure guidance, or validation checks; higher risk of malformed submissions
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: No `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`. Given the highly structured nature of operator bundles, agent rules could significantly reduce invalid submissions.

## Quick Wins

### 1. Add GitHub Actions Workflow for Bundle Schema Validation (2-4 hours)
- **Impact**: Catch malformed bundles before hitting external pipeline
- **Implementation**: Add a lightweight workflow that runs `operator-sdk bundle validate` on changed operator directories

```yaml
# .github/workflows/bundle-validate.yml
name: Bundle Validation
on:
  pull_request:
    paths: ['operators/**']
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Detect changed operators
        id: changes
        run: |
          CHANGED=$(git diff --name-only ${{ github.event.pull_request.base.sha }} HEAD | grep '^operators/' | cut -d'/' -f1-3 | sort -u)
          echo "operators=$CHANGED" >> $GITHUB_OUTPUT
      - name: Install operator-sdk
        run: |
          curl -sLO https://github.com/operator-framework/operator-sdk/releases/latest/download/operator-sdk_linux_amd64
          chmod +x operator-sdk_linux_amd64 && sudo mv operator-sdk_linux_amd64 /usr/local/bin/operator-sdk
      - name: Validate bundles
        run: |
          for dir in ${{ steps.changes.outputs.operators }}; do
            echo "Validating $dir..."
            operator-sdk bundle validate "$dir" --select-optional name=operatorhub
          done
```

### 2. Add CLAUDE.md with Contribution Rules (2-3 hours)
- **Impact**: Guide AI-assisted operator submissions with proper validation
- **Implementation**: Create a root `CLAUDE.md` covering:
  - Operator bundle structure requirements
  - Required CSV fields and validation
  - One operator per PR rule
  - Squash commit requirement
  - Version naming conventions

### 3. Add CODEOWNERS (1-2 hours)
- **Impact**: Ensure config.yaml and catalog changes get appropriate review
- **Implementation**:
```
# .github/CODEOWNERS
config.yaml @redhat-openshift-ecosystem/community-operators-maintainers
catalogs/ @redhat-openshift-ecosystem/community-operators-maintainers
.github/ @redhat-openshift-ecosystem/community-operators-maintainers
```

### 4. Add Catalog Consistency Check (3-4 hours)
- **Impact**: Validate FBC catalog.yaml files reference valid operator bundles
- **Implementation**: A script that checks `catalogs/` entries against `operators/` directory

## Detailed Findings

### CI/CD Pipeline

**In-Repo Workflows (2 total):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `stale_issues.yaml` | Daily cron (01:30 UTC) | Closes stale issues (30d) and PRs (30d stale + 7d close) |
| `pr-label-command.yml` | Issue comment / PR review | Handles label commands via reusable workflow |

**External Pipeline (Tekton-based):**
The real CI/CD is handled by the [operator-pipelines](https://github.com/redhat-openshift-ecosystem/operator-pipelines) project:

- **20+ static checks** including CSV validation, upgrade graph verification, API version constraints, catalog checks
- **Dynamic checks** via [openshift-preflight](https://github.com/redhat-openshift-ecosystem/openshift-preflight) testing bundle deployability on live OCP clusters
- **DeployableByOLM** test — confirms operator installs successfully via OLM
- **Preflight trigger** — additional certification checks
- Pipeline results posted back to the PR as comments

**Gap**: The external pipeline is comprehensive but opaque to contributors — there is no way to run these checks locally before submitting a PR.

### Test Coverage

This is a **data-only repository** containing operator bundle manifests (CSVs, CRDs, metadata). There is no application code, and therefore:

- **No unit tests** — no source code to test
- **No integration tests** in-repo — handled by external pipeline
- **No test framework** — not applicable
- **No coverage tracking** — not applicable

The `config.yaml` defines tests that the external pipeline executes:
- `DeployableByOLM` — runtime deployment test
- `check_dangling_bundles` — validates upgrade graph integrity
- `check_operator_name` — name consistency validation
- `preflight-trigger` — certification checks

Each test has an `ignore_operators` list for known exceptions (e.g., `ack-*` operators skip DeployableByOLM and preflight).

### Code Quality

- **No linting configuration** — no `.golangci.yaml`, `.eslintrc`, `ruff.toml` (not applicable — no source code)
- **No pre-commit hooks** — no `.pre-commit-config.yaml`
- **No static analysis** — no CodeQL, gosec, or similar (YAML content validated externally)
- **mkdocs.yml** present for documentation site generation with Material theme

### Container Images

**Bundle Dockerfiles**: Each operator version includes a `bundle.Dockerfile` (e.g., `operators/3scale-community-operator/0.10.1/bundle.Dockerfile`). These are standardized OLM bundle images.

**No runtime validation in-repo**: Container images referenced in CSVs (the actual operator images) are validated only by the external pipeline's preflight checks.

**No vulnerability scanning**: No Trivy, Snyk, or Grype integration for either bundle images or referenced operator images.

**FBC Catalogs**: File-Based Catalogs in `catalogs/v4.12` through `catalogs/v4.22` with per-operator `catalog.yaml` files for modern catalog format.

### Security

- **No secret detection** — no `.gitleaks.toml` or TruffleHog configuration
- **No SAST** — no CodeQL workflows
- **No dependency scanning** — no Dependabot or Renovate configuration
- **No image scanning** — no Trivy/Snyk integration
- **Allowed registries** enforced in `config.yaml`: `quay.io/community-operator-pipeline-prod/` and `quay.io/openshift-community-operators/`

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: Zero — no CLAUDE.md, AGENTS.md, or .claude/ directory exists
- **Quality**: N/A
- **Gaps**: 
  - No guidance for AI-assisted operator bundle creation
  - No validation rules for CSV structure
  - No examples of well-formed operator submissions
  - No rules for FBC catalog modifications
- **Recommendation**: Generate rules with `/test-rules-generator` covering:
  - Operator bundle structure and required fields
  - CSV validation checklist
  - Catalog entry requirements
  - Common submission mistakes to avoid

## Recommendations

### Priority 0 (Critical)

1. **Add in-repo GitHub Actions for bundle validation** — Run `operator-sdk bundle validate` with both `operatorhub` and `operatorframework` suites on PR-modified operator directories. This catches 60-70% of submission errors before the external pipeline runs.

2. **Add schema validation workflow** — Validate `ci.yaml`, `config.yaml`, and `release-config.yaml` files against their JSON schemas as a fast PR check. The external pipeline already does this (`check_schema_bundle_release_config`, `check_schema_operator_ci_config`), but running it in-repo gives faster feedback.

3. **Add image registry allowlist validation** — Check that bundle images and CSV-referenced images use allowed registries (`quay.io/community-operator-pipeline-prod/`, `quay.io/openshift-community-operators/`). Currently only enforced externally via `check_bundle_images_in_fbc`.

### Priority 1 (High Value)

4. **Create CLAUDE.md and .claude/rules/** — Given the highly structured nature of operator bundles, agent rules would significantly improve AI-assisted contributions by providing:
   - Bundle structure requirements
   - CSV field validation rules
   - FBC catalog modification guidelines
   - Common mistakes to avoid

5. **Create local testing script** — A `make validate` or `scripts/validate.sh` that contributors can run before submitting PRs, wrapping `operator-sdk bundle validate` and basic checks.

6. **Add CODEOWNERS** — Protect critical paths (`config.yaml`, `catalogs/`, `.github/`) with required reviews from maintainers.

### Priority 2 (Nice-to-Have)

7. **Add Trivy scanning** — Scan container images referenced in CSVs for known vulnerabilities. This is especially important for community-contributed operators that may reference images with outdated base layers.

8. **Add periodic orphan detection** — Workflow to detect operator bundles that are no longer referenced in any catalog version or upgrade path.

9. **Add catalog integrity checks** — Verify that all `catalogs/v4.XX/` entries reference operators that exist in the `operators/` directory and that upgrade graphs are consistent across catalog versions.

10. **Add Dependabot/Renovate** — Track actions version updates in GitHub workflows (e.g., `actions/stale@v3` is outdated — current is v9).

## Comparison to Gold Standards

| Dimension | community-operators-prod | odh-dashboard | notebooks | kserve |
|-----------|-------------------------|---------------|-----------|--------|
| Unit Tests | 1/10 (N/A — data repo) | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 7/10 (external pipeline) | 9/10 | 8/10 | 9/10 |
| Build Integration | 6/10 (external only) | 8/10 | 9/10 | 7/10 |
| Image Testing | 5/10 (bundle Dockerfiles) | 7/10 | 10/10 | 7/10 |
| Coverage Tracking | 1/10 (N/A) | 8/10 | 6/10 | 9/10 |
| CI/CD Automation | 5/10 (2 workflows) | 9/10 | 8/10 | 9/10 |
| Agent Rules | 0/10 (none) | 8/10 | 3/10 | 2/10 |
| **Overall** | **4.6/10** | **8.5/10** | **7.5/10** | **7.8/10** |

**Note**: This repository is fundamentally different from the gold standards — it is a data registry, not an application codebase. Scores for unit tests and coverage tracking reflect this inherent limitation. The meaningful gaps are in CI/CD automation (in-repo validation), security scanning, and agent rules.

## File Paths Reference

| File | Purpose |
|------|---------|
| `.github/workflows/stale_issues.yaml` | Stale issue/PR management |
| `.github/workflows/pr-label-command.yml` | PR label command handling |
| `config.yaml` | Pipeline configuration — maintainers, tests, allowed registries |
| `docs/pull_request_template.md` | PR contribution checklist |
| `mkdocs.yml` | Documentation site configuration |
| `operators/*/` | Operator bundle manifests (314 operators) |
| `catalogs/v4.XX/` | File-Based Catalogs for OCP versions 4.12-4.22 |
| `README.md` | Repository overview and contribution links |
