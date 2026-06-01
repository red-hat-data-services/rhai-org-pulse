---
repository: "opendatahub-io/community-operators-prod"
overall_score: 2.8
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No unit tests exist - this is a YAML manifest catalog, not application code"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "OLM Scorecard tests bundled per-operator version; no repo-level integration tests"
  - dimension: "Build Integration"
    score: 2.0
    status: "Makefile-based FBC catalog generation/validation for 33 of 311 operators; no PR-time CI"
  - dimension: "Image Testing"
    score: 1.0
    status: "No container image testing; some operators include Dockerfiles but no validation"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tracking of any kind"
  - dimension: "CI/CD Automation"
    score: 4.0
    status: "Only 2 GitHub Actions workflows: stale issue cleanup and PR label commands; all real CI delegated to external operator-pipelines"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No in-repo CI/CD pipeline for PR validation"
    impact: "All validation is delegated to external operator-pipelines infrastructure; contributors get no immediate feedback from GitHub Actions on their PRs"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No automated manifest validation on PRs"
    impact: "Invalid operator bundles, broken CSVs, or malformed CRDs can be submitted without local checks"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "Only 36 of 311 operators use FBC (File-Based Catalog) format"
    impact: "275 operators still use legacy catalog format without Makefile-based validation tooling"
    severity: "MEDIUM"
    effort: "40+ hours (requires operator maintainer cooperation)"
  - title: "No catalog consistency validation"
    impact: "Cross-version catalog integrity (upgrade paths, channel correctness) is not automatically verified"
    severity: "HIGH"
    effort: "12-16 hours"
  - title: "No agent rules for AI-assisted contributions"
    impact: "AI agents have no guidance for creating valid operator bundles, catalog templates, or CI configurations"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "Stale issue workflow uses deprecated actions/stale@v3"
    impact: "Potential security vulnerabilities and eventual workflow failures when GitHub removes v3 support"
    severity: "LOW"
    effort: "1 hour"
quick_wins:
  - title: "Add opm validate workflow for PR-submitted bundles"
    effort: "4-6 hours"
    impact: "Catch malformed operator bundles before merge; immediate feedback for contributors"
  - title: "Upgrade actions/stale from v3 to v9"
    effort: "30 minutes"
    impact: "Fix deprecated action, improve security posture"
  - title: "Add CLAUDE.md with operator bundle contribution guidelines"
    effort: "2-3 hours"
    impact: "Enable AI agents to correctly create and validate operator submissions"
  - title: "Add CSV schema validation workflow"
    effort: "3-4 hours"
    impact: "Validate ClusterServiceVersion YAML structure on every PR"
  - title: "Add CODEOWNERS file"
    effort: "1 hour"
    impact: "Automate review assignments based on operator directory ownership"
recommendations:
  priority_0:
    - "Implement a GitHub Actions workflow that runs opm validate on changed operator bundles in every PR"
    - "Add CSV and CRD schema validation as a PR check to catch structural issues before external pipeline"
    - "Add catalog consistency checks (upgrade path validation, channel integrity) as PR-time validation"
  priority_1:
    - "Create comprehensive CLAUDE.md/AGENTS.md with operator bundle structure guidelines"
    - "Migrate remaining 275 operators to FBC format with Makefile-based validation"
    - "Add a CI workflow that validates catalog-template rendering for FBC-enabled operators"
  priority_2:
    - "Add bundle size and content policy checks (e.g., maximum icon size, required fields)"
    - "Implement dependency scanning for operator images referenced in CSVs"
    - "Add a workflow to detect duplicate or conflicting operator package names across bundles"
---

# Quality Analysis: community-operators-prod (opendatahub-io fork)

## Executive Summary
- **Overall Score: 2.8/10**
- **Repository Type**: Community operator catalog (fork of redhat-openshift-ecosystem/community-operators-prod)
- **Key Strengths**: Standardized operator bundle structure, OLM scorecard test configs per version, FBC migration in progress (36 operators), PR template with comprehensive checklist
- **Critical Gaps**: No in-repo CI/CD for PR validation, no automated manifest validation, no coverage tracking, no agent rules
- **Agent Rules Status**: Missing

### Important Context

This is **not a typical application repository**. It is a **community operator catalog** containing 311 operator bundles (67,641 YAML files, 3.1GB) that are published to the OpenShift Community Operator Index. The repository is a fork of `redhat-openshift-ecosystem/community-operators-prod` maintained by the Open Data Hub team.

The quality assessment must be interpreted in this context:
- There is no application code to unit test
- CI/CD is intentionally delegated to the upstream `operator-pipelines` infrastructure
- The primary "code" is YAML manifests (CSVs, CRDs, catalog templates)
- Quality gates are enforced externally by the operator pipeline

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No unit tests - this is a YAML manifest catalog, not application code |
| Integration/E2E | 3/10 | OLM Scorecard tests bundled per-operator version; no repo-level integration tests |
| **Build Integration** | **2/10** | **Makefile-based FBC catalog generation/validation for 33/311 operators; no PR-time CI** |
| Image Testing | 1/10 | No container image testing; some operators include Dockerfiles but no validation |
| Coverage Tracking | 0/10 | No coverage tracking of any kind |
| CI/CD Automation | 4/10 | Only 2 GitHub Actions workflows (stale issues + PR labels); real CI delegated externally |
| Agent Rules | 0/10 | No CLAUDE.md, AGENTS.md, or .claude/ directory |

## Critical Gaps

### 1. No In-Repo CI/CD Pipeline for PR Validation
- **Impact**: Contributors submitting operator bundles receive no automated feedback from GitHub Actions. All validation happens in the external operator-pipelines infrastructure, creating a slow feedback loop.
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: The repository has only 2 GitHub Actions workflows:
  - `pr-label-command.yml` - Handles PR label commands via comments
  - `stale_issues.yaml` - Auto-closes stale issues/PRs after 30 days
  - Neither workflow validates operator bundle content

### 2. No Automated Manifest Validation on PRs
- **Impact**: Invalid operator bundles, broken CSVs, malformed CRDs, or incorrect metadata can be submitted without local validation. Issues are only caught downstream in the operator pipeline.
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **What to validate**:
  - CSV structure and required fields
  - CRD schema validity
  - Annotation correctness
  - Bundle directory structure
  - Icon format and size

### 3. Low FBC Adoption (36/311 operators)
- **Impact**: 275 operators still use legacy catalog format without Makefile-based validation tooling. FBC (File-Based Catalog) is the modern format that enables local rendering and validation.
- **Severity**: MEDIUM
- **Effort**: 40+ hours (requires operator maintainer cooperation)
- **Current state**: Only 36 operators have `fbc.enabled: true` in their `ci.yaml`

### 4. No Catalog Consistency Validation
- **Impact**: Cross-version catalog integrity (upgrade paths, channel correctness, replaces/skips chains) is not automatically verified. Broken upgrade graphs can prevent users from upgrading operators.
- **Severity**: HIGH
- **Effort**: 12-16 hours

### 5. No Agent Rules for AI-Assisted Contributions
- **Impact**: AI agents have no guidance for creating valid operator bundles, catalog templates, or CI configurations. This leads to structurally incorrect submissions.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours

### 6. Deprecated GitHub Actions
- **Impact**: `stale_issues.yaml` uses `actions/stale@v3` which is deprecated. Current version is v9.
- **Severity**: LOW
- **Effort**: 1 hour

## Quick Wins

### 1. Add `opm validate` Workflow for PR-Submitted Bundles (4-6 hours)
Catch malformed operator bundles before merge:
```yaml
name: Validate Operator Bundles
on:
  pull_request:
    paths:
      - 'operators/**'
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install opm
        run: |
          curl -sLO https://github.com/operator-framework/operator-registry/releases/download/v1.46.0/linux-amd64-opm
          chmod +x linux-amd64-opm
          sudo mv linux-amd64-opm /usr/local/bin/opm
      - name: Validate changed bundles
        run: |
          CHANGED_OPERATORS=$(git diff --name-only ${{ github.event.pull_request.base.sha }} HEAD | grep '^operators/' | cut -d'/' -f2 | sort -u)
          for op in $CHANGED_OPERATORS; do
            echo "Validating operator: $op"
            opm validate operators/$op || exit 1
          done
```

### 2. Upgrade actions/stale to v9 (30 minutes)
```yaml
# Change from:
- uses: actions/stale@v3
# To:
- uses: actions/stale@v9
```

### 3. Add CLAUDE.md with Contribution Guidelines (2-3 hours)
Create guidelines for AI agents to correctly structure operator bundles.

### 4. Add CSV Schema Validation Workflow (3-4 hours)
Validate ClusterServiceVersion YAML structure on every PR.

### 5. Add CODEOWNERS File (1 hour)
Map operators to reviewers based on `ci.yaml` reviewers lists.

## Detailed Findings

### CI/CD Pipeline

**Current State**: Minimal in-repo CI/CD. Only 2 lightweight workflows exist:

1. **PR Label Command** (`pr-label-command.yml`):
   - Triggers on: `issue_comment`, `pull_request_review`
   - Delegates to: `redhat-openshift-ecosystem/github-workflows/.github/workflows/label-command.yml@main`
   - Purpose: Handles label commands via PR comments

2. **Stale Issues** (`stale_issues.yaml`):
   - Triggers on: Daily cron schedule (`30 1 * * *`)
   - Uses: `actions/stale@v3` (DEPRECATED)
   - Purpose: Auto-closes stale issues (60 days) and PRs (37 days)

**External CI**: All real validation is handled by the `redhat-openshift-ecosystem/operator-pipelines` infrastructure, which includes:
- `DeployableByOLM` test
- `check_dangling_bundles` test
- `check_operator_name` test
- `preflight-trigger` test

These tests are configured in the root `config.yaml` with ignore patterns for certain operators (e.g., `^ack-.*`).

### Test Coverage

**OLM Scorecard Tests**: 4,148 scorecard config files exist across operator versions:
- `basic-check-spec` - Basic operator spec validation
- `olm-bundle-validation` - OLM bundle format validation
- `olm-crds-have-validation` - CRD validation schema checks
- `olm-crds-have-resources` - CRD resource declaration checks
- `olm-spec-descriptors` - Spec descriptor completeness
- `olm-status-descriptors` - Status descriptor completeness

These are run by the external operator pipeline, not by in-repo CI.

**No repo-level tests**: There are no test files (`*_test.go`, `*.spec.ts`, `*.test.py`, etc.) in the repository.

### Code Quality

- **No linting configuration**: No `.golangci.yaml`, `.eslintrc`, `ruff.toml`, or similar
- **No pre-commit hooks**: No `.pre-commit-config.yaml`
- **No static analysis**: No CodeQL, gosec, or Semgrep configuration
- **No security scanning**: No Trivy, Snyk, or Gitleaks configuration
- **No coverage tracking**: No codecov, coveralls, or similar integration

This is expected for a YAML-only catalog repository, but YAML linting (e.g., yamllint) would be valuable.

### Build Integration

**Makefile-based FBC Tooling**: 33 operators include Makefiles for:
- `fbc-onboarding` - Onboard an operator to FBC format using pipeline images
- `catalogs` - Render catalogs from templates using `opm` and `yq`
- `validate-catalogs` - Validate rendered catalogs with `opm validate`
- `clean` - Clean generated catalog files

This tooling is local-only; it is not integrated into any GitHub Actions workflow.

**Catalog Structure**: 11 catalog versions exist (v4.12 through v4.22), containing rendered catalog entries for operators that target specific OCP versions.

### Container Images

- Some operators include Dockerfiles within their version directories (e.g., `volume-expander-operator`), but these are part of the operator bundle content, not build artifacts of this repository.
- No image build, scanning, or validation is performed in this repository.

### Security

- No dependency scanning
- No secret detection
- No vulnerability scanning
- The `actions/stale@v3` usage is a minor security concern (deprecated actions may have unpatched vulnerabilities)

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None - no `.claude/`, `CLAUDE.md`, or `AGENTS.md`
- **Quality**: N/A
- **Gaps**: Everything - no guidance for AI agents on:
  - Operator bundle structure requirements
  - CSV required fields and format
  - CRD naming conventions
  - Catalog template creation
  - FBC migration process
  - ci.yaml configuration
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - Bundle validation rules
  - CSV structure guidelines
  - Catalog template patterns
  - FBC migration procedures

## Recommendations

### Priority 0 (Critical)

1. **Implement PR-time bundle validation workflow**
   - Run `opm validate` on changed operator bundles
   - Validate CSV structure and required fields
   - Check annotation correctness
   - Verify bundle directory structure

2. **Add catalog consistency checks**
   - Validate upgrade paths (replaces/skips chains)
   - Check channel integrity across versions
   - Verify OCP version compatibility annotations

3. **Upgrade deprecated GitHub Actions**
   - Update `actions/stale@v3` to `actions/stale@v9`

### Priority 1 (High Value)

4. **Create CLAUDE.md/AGENTS.md with operator contribution guidelines**
   - Bundle structure requirements
   - CSV required fields and format
   - CRD naming conventions
   - ci.yaml configuration guide

5. **Add YAML linting workflow**
   - Validate YAML syntax on all changed files
   - Check for common issues (duplicate keys, invalid references)

6. **Accelerate FBC migration**
   - Create migration documentation
   - Add tooling to assist legacy operators in migrating to FBC

### Priority 2 (Nice-to-Have)

7. **Add bundle policy checks**
   - Maximum icon size enforcement
   - Required field completeness
   - Description length and quality

8. **Implement CODEOWNERS based on ci.yaml reviewers**
   - 286 of 308 operators have reviewers configured
   - Auto-generate CODEOWNERS from ci.yaml data

9. **Add duplicate/conflict detection**
   - Detect duplicate operator package names
   - Validate cross-operator dependency compatibility

## Comparison to Gold Standards

| Dimension | community-operators-prod | odh-dashboard | notebooks | kserve |
|-----------|:---:|:---:|:---:|:---:|
| Unit Tests | 0/10 | 9/10 | 6/10 | 9/10 |
| Integration/E2E | 3/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 2/10 | 7/10 | 8/10 | 7/10 |
| Image Testing | 1/10 | 6/10 | 9/10 | 7/10 |
| Coverage Tracking | 0/10 | 8/10 | 5/10 | 8/10 |
| CI/CD Automation | 4/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 0/10 | 8/10 | 3/10 | 2/10 |

**Note**: Direct comparison is limited because this is a YAML manifest catalog, not application code. The gold standard repos are actual application/operator codebases.

## File Paths Reference

| File | Purpose |
|------|---------|
| `config.yaml` | Root configuration: organization, maintainers, test config, allowed registries |
| `.github/workflows/pr-label-command.yml` | PR label command handler |
| `.github/workflows/stale_issues.yaml` | Stale issue/PR auto-close (DEPRECATED v3) |
| `operators/*/ci.yaml` | Per-operator CI config (reviewers, FBC settings) |
| `operators/*/Makefile` | FBC catalog generation/validation (33 operators) |
| `operators/*/catalog-templates/*.yaml` | FBC catalog templates |
| `operators/*/*/tests/scorecard/config.yaml` | OLM scorecard test configs (4,148 files) |
| `operators/*/*/manifests/*.yaml` | Operator bundle manifests (CSVs, CRDs) |
| `operators/*/*/metadata/annotations.yaml` | Bundle metadata annotations |
| `catalogs/v4.*/` | Rendered catalogs for OCP versions 4.12-4.22 |
| `docs/pull_request_template.md` | PR submission checklist |
| `mkdocs.yml` | Documentation site configuration |
