---
repository: "opendatahub-io/community-operators-prod"
overall_score: 2.0
scorecard:
  - dimension: "Unit Tests"
    score: 1.0
    status: "No test files exist — this is a data/manifest catalog, not a code repository"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "External operator-pipelines runs DeployableByOLM and preflight checks, but nothing in-repo"
  - dimension: "Build Integration"
    score: 3.0
    status: "Makefile provides opm validate and catalog rendering, but not wired into PR CI workflows"
  - dimension: "Image Testing"
    score: 1.0
    status: "2,934 bundle Dockerfiles exist but no image build or scan automation"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tracking of any kind"
  - dimension: "CI/CD Automation"
    score: 4.0
    status: "Relies entirely on external operator-pipelines; only 2 trivial internal workflows"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules"
critical_gaps:
  - title: "No in-repo CI/CD for PR validation"
    impact: "All test/validation logic lives in external operator-pipelines repo — contributors cannot see or run checks locally without separate tooling"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No FBC catalog validation in PR workflows"
    impact: "Catalog schema errors, dangling bundles, and broken upgrade graphs are only caught by external pipeline — no fail-fast feedback"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No YAML/manifest linting or schema validation"
    impact: "Malformed CSVs, CRDs, or catalog entries can be submitted without early detection"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No security scanning for bundle images"
    impact: "Operator bundle images referenced in CSVs may contain vulnerabilities with no automated checks"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "No agent rules for contribution quality"
    impact: "AI-assisted contributions have no guardrails for catalog data consistency"
    severity: "LOW"
    effort: "2-4 hours"
quick_wins:
  - title: "Add opm validate workflow for PR-triggered FBC validation"
    effort: "2-4 hours"
    impact: "Catch catalog schema errors before merge — Makefile already has validate-catalogs target"
  - title: "Add YAML linting with yamllint or yq in PR workflow"
    effort: "1-2 hours"
    impact: "Catch malformed YAML manifests early in the PR cycle"
  - title: "Add a CLAUDE.md with contribution and catalog structure guidelines"
    effort: "1-2 hours"
    impact: "Improve AI-assisted contribution quality and consistency"
  - title: "Add CODEOWNERS file for operator-specific review routing"
    effort: "1-2 hours"
    impact: "Ensure operator maintainers are automatically requested for reviews on their operators"
recommendations:
  priority_0:
    - "Implement PR-triggered GitHub Actions workflow running opm validate on affected catalogs"
    - "Add YAML schema validation for CSVs and CRDs using operator-framework tooling"
    - "Wire the existing Makefile validate-catalogs target into a GitHub Actions workflow"
  priority_1:
    - "Add bundle image reference validation (check that referenced images exist and are pullable)"
    - "Implement upgrade graph validation to catch broken replaces/skips chains"
    - "Create CLAUDE.md with catalog structure documentation and contribution guardrails"
  priority_2:
    - "Add Trivy or Grype scanning for bundle image references"
    - "Implement catalog diff reporting on PRs to show what changes in the upgrade graph"
    - "Add automated changelog generation for catalog updates"
---

# Quality Analysis: community-operators-prod

## Executive Summary

- **Overall Score: 2.0/10**
- **Repository Type**: OLM Operator Catalog / FBC (File-Based Catalog) index repository
- **Primary Language**: YAML/JSON manifests (no application code)
- **Key Strengths**: Well-structured catalog hierarchy, external pipeline integration via operator-pipelines, comprehensive PR template with contribution checklist, Makefile-based local catalog tooling
- **Critical Gaps**: No in-repo CI/CD for PR validation, no manifest linting, no catalog schema validation in workflows, no security scanning, no agent rules
- **Agent Rules Status**: Missing

### Important Context

This is a **data/manifest repository**, not a software project. It contains 323 community operator bundles (CSVs, CRDs, metadata) and File-Based Catalog definitions for OCP versions 4.12-4.22. The actual CI/CD testing pipeline is externalized to the [`redhat-openshift-ecosystem/operator-pipelines`](https://github.com/redhat-openshift-ecosystem/operator-pipelines) repository. Scores reflect what is present *within this repository* — the external pipeline provides additional quality gates not captured here.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 1/10 | No test files — data/manifest catalog, not a code repo |
| Integration/E2E | 3/10 | External pipeline runs DeployableByOLM, preflight checks |
| **Build Integration** | **3/10** | **Makefile has opm validate but not wired into PR workflows** |
| Image Testing | 1/10 | 2,934 bundle Dockerfiles, no build/scan automation |
| Coverage Tracking | 0/10 | No coverage tracking |
| CI/CD Automation | 4/10 | 2 trivial workflows; relies entirely on external pipeline |
| Agent Rules | 0/10 | No CLAUDE.md, no .claude/ directory |

## Critical Gaps

1. **No in-repo CI/CD for PR validation**
   - Impact: Contributors cannot see or run validation checks locally without separate tooling; all testing depends on external operator-pipelines
   - Severity: HIGH
   - Effort: 16-24 hours
   - Detail: The `config.yaml` defines tests (DeployableByOLM, check_dangling_bundles, check_operator_name, preflight-trigger) but these run in the external pipeline, not as GitHub Actions in this repository

2. **No FBC catalog validation in PR workflows**
   - Impact: Catalog schema errors, dangling bundles, and broken upgrade graphs are only caught by the external pipeline — no fail-fast feedback for contributors
   - Severity: HIGH
   - Effort: 4-8 hours
   - Detail: The `Makefile` already has a `validate-catalogs` target using `opm validate`, but it's not triggered on PRs. This is the lowest-hanging fruit.

3. **No YAML/manifest linting or schema validation**
   - Impact: Malformed CSVs, CRDs, or catalog entries can be submitted without early detection
   - Severity: HIGH
   - Effort: 4-6 hours
   - Detail: With 6,588 ClusterServiceVersions across 323 operators, schema validation is critical for data integrity

4. **No security scanning for bundle images**
   - Impact: Operator bundle images referenced in CSVs may contain known vulnerabilities
   - Severity: MEDIUM
   - Effort: 8-12 hours

5. **No agent rules for contribution quality**
   - Impact: AI-assisted contributions have no guardrails for catalog data consistency
   - Severity: LOW
   - Effort: 2-4 hours

## Quick Wins

1. **Add `opm validate` workflow for PR-triggered FBC validation** (2-4 hours)
   - Impact: Catch catalog schema errors before merge
   - The Makefile's `validate-catalogs` target already implements this; just needs a workflow wrapper
   - Implementation:
   ```yaml
   name: Validate Catalogs
   on:
     pull_request:
       paths:
         - 'catalogs/**'
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
         - name: Validate affected catalogs
           run: |
             for catalog in catalogs/*/; do
               opm validate "$catalog" || exit 1
             done
   ```

2. **Add YAML linting with `yamllint`** (1-2 hours)
   - Impact: Catch malformed YAML in CSVs, CRDs, and catalog entries
   - Implementation:
   ```yaml
   - name: YAML Lint
     uses: ibiqlik/action-yamllint@v3
     with:
       file_or_dir: operators/ catalogs/
       config_data: |
         extends: default
         rules:
           line-length: disable
           truthy: disable
   ```

3. **Add a CLAUDE.md with contribution guidelines** (1-2 hours)
   - Impact: Improve AI-assisted contribution quality
   - Should cover: catalog structure, operator bundle format, FBC template patterns, ci.yaml configuration

4. **Add CODEOWNERS for operator-specific review routing** (1-2 hours)
   - Impact: Auto-request reviewers from `ci.yaml` maintainer lists

## Detailed Findings

### Repository Structure

```
community-operators-prod/
├── catalogs/          # FBC definitions for OCP v4.12-v4.22 (11 versions)
│   ├── v4.12/         # 13 operators
│   ├── ...
│   └── v4.22/         # 12 operators
├── operators/         # 323 operator bundles
│   ├── 3scale-community-operator/
│   │   ├── ci.yaml    # Per-operator CI config (321 operators have this)
│   │   ├── 0.10.1/    # Version bundles
│   │   │   ├── bundle.Dockerfile
│   │   │   ├── manifests/
│   │   │   │   ├── *.clusterserviceversion.yaml
│   │   │   │   └── *.crd.yaml
│   │   │   └── metadata/annotations.yaml
│   │   └── catalog-templates/  # FBC templates (some operators)
│   └── ...
├── config.yaml        # Pipeline configuration & test definitions
├── mkdocs.yml         # Documentation site config
└── docs/
    └── pull_request_template.md
```

**Key Statistics:**
- 323 operators
- 6,588 ClusterServiceVersion YAML files
- 2,934 bundle Dockerfiles
- 321 operator ci.yaml configurations
- 11 OCP catalog versions (v4.12 through v4.22)
- 74,447 total files

### CI/CD Pipeline

**Internal Workflows (2 total — both trivial):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `stale_issues.yaml` | `cron: 30 1 * * *` | Auto-close stale issues/PRs after 30 days |
| `pr-label-command.yml` | `issue_comment`, `pull_request_review` | Handle PR label commands via reusable workflow |

**External Pipeline (operator-pipelines):**

The `config.yaml` defines tests that run in the external pipeline:
- **DeployableByOLM**: Validates operator can be installed via OLM (ignores `ack-*` operators)
- **check_dangling_bundles**: Detects orphaned bundle references (ignores `assisted-service-operator`)
- **check_operator_name**: Validates operator naming conventions
- **preflight-trigger**: Runs Red Hat preflight certification checks (ignores `ack-*` operators)

**Gap**: None of these tests are visible or runnable from within this repository. Contributors must rely entirely on the external pipeline for feedback.

### Test Coverage

- **Unit Tests**: 0 test files (N/A for data repository)
- **Integration Tests**: Handled by external operator-pipelines (DeployableByOLM)
- **E2E Tests**: None in-repo
- **Coverage Tracking**: None
- **Test-to-Code Ratio**: N/A (no code)

### Code Quality

- **Linting**: No YAML linting, no schema validation
- **Pre-commit Hooks**: None (`.pre-commit-config.yaml` absent)
- **Static Analysis**: None
- **Formatters**: None

The repository lacks even basic YAML validation. For a repository with 6,588+ YAML manifests, this is a significant gap.

### Build Integration

**Makefile Tooling (per-operator):**
- `fbc-onboarding`: Containerized FBC onboarding using operator-pipeline-image
- `catalogs`: Renders FBC catalogs from templates using `opm` and `yq`
- `validate-catalogs`: Runs `opm validate` on generated catalogs
- `clean`: Removes generated catalog artifacts

**Gap**: These Makefile targets are available for local use but are not wired into any GitHub Actions workflow. A contributor could submit a PR with invalid catalogs and not receive feedback until the external pipeline runs.

### Container Images

- **Bundle Dockerfiles**: 2,934 `bundle.Dockerfile` files across operators
- **Image Registry**: `quay.io/community-operator-pipeline-prod/` and `quay.io/openshift-community-operators/`
- **Index Image**: `quay.io/redhat/redhat----community-operator-index`
- **Scanning**: None
- **Multi-arch**: Not tracked in this repository

### Security

- **Container Scanning**: None
- **SAST/CodeQL**: None
- **Dependency Scanning**: None
- **Secret Detection**: None
- **Image Signing**: Not configured in this repository

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No test types have rules
- **Quality**: N/A
- **Gaps**: No CLAUDE.md, no `.claude/` directory, no agent rules of any kind
- **Recommendation**: Generate agent rules covering:
  - Catalog structure and FBC format
  - Operator bundle requirements (CSV, CRD, metadata)
  - `ci.yaml` configuration patterns
  - Catalog template authoring (basic vs. semver)
  - Upgrade graph management (replaces, skips, skipRange)

## Recommendations

### Priority 0 (Critical)

1. **Implement PR-triggered `opm validate` workflow**
   - Wire the existing Makefile `validate-catalogs` target into a GitHub Actions workflow
   - Trigger on changes to `catalogs/` and `operators/` directories
   - This catches broken FBC schemas before merge

2. **Add YAML schema validation for CSVs and CRDs**
   - Use `operator-sdk bundle validate` or custom JSON Schema validation
   - Validate against the OLM bundle format specification
   - Catch structural errors in the 6,588 CSV files

3. **Add dangling bundle detection in PR workflow**
   - The external pipeline already has `check_dangling_bundles` — replicate it locally
   - Detect operator versions referenced in catalogs but missing from `operators/`

### Priority 1 (High Value)

1. **Add bundle image reference validation**
   - Check that `containerImage` references in CSVs point to valid, pullable images
   - Catch broken image references before merge

2. **Implement upgrade graph validation**
   - Validate `replaces`, `skips`, and `skipRange` fields form a valid DAG
   - Detect circular references or broken upgrade chains across catalog versions

3. **Create CLAUDE.md with contribution documentation**
   - Document the catalog structure (FBC format, basic vs. semver templates)
   - Include operator bundle requirements and validation rules
   - Add examples of proper `ci.yaml` configuration

4. **Add CODEOWNERS file**
   - Auto-generate from `ci.yaml` reviewer lists
   - Route PRs to the correct operator maintainers

### Priority 2 (Nice-to-Have)

1. **Add Trivy/Grype scanning for referenced bundle images**
   - Scan operator images referenced in CSVs for known vulnerabilities
   - Report findings on PRs

2. **Implement catalog diff reporting**
   - Show upgrade graph changes in PR comments
   - Visualize what operators are added/removed/modified per OCP version

3. **Add automated changelog generation**
   - Track which operators are updated per release
   - Generate release notes from catalog changes

## Comparison to Gold Standards

| Dimension | community-operators-prod | odh-dashboard | notebooks | kserve |
|-----------|--------------------------|---------------|-----------|--------|
| Unit Tests | 1/10 (N/A - data repo) | 9/10 | 7/10 | 8/10 |
| Integration/E2E | 3/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 3/10 | 7/10 | 8/10 | 7/10 |
| Image Testing | 1/10 | 6/10 | 9/10 | 6/10 |
| Coverage Tracking | 0/10 | 8/10 | 5/10 | 8/10 |
| CI/CD Automation | 4/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 0/10 | 8/10 | 3/10 | 2/10 |
| **Overall** | **2.0/10** | **8.2/10** | **7.0/10** | **7.3/10** |

**Key Difference**: Unlike the gold standards, community-operators-prod is a data/manifest repository, not a software project. Many quality dimensions (unit tests, coverage tracking) are less applicable. However, catalog validation, YAML linting, and upgrade graph verification are directly analogous and remain critical gaps.

## File Paths Reference

| File | Purpose |
|------|---------|
| `config.yaml` | Pipeline configuration, test definitions, maintainer list |
| `.github/workflows/stale_issues.yaml` | Auto-close stale issues (30 days) |
| `.github/workflows/pr-label-command.yml` | PR label handling via reusable workflow |
| `docs/pull_request_template.md` | PR checklist for contributors |
| `mkdocs.yml` | Documentation site configuration |
| `operators/*/ci.yaml` | Per-operator CI config (reviewers, update graph mode, FBC settings) |
| `operators/*/Makefile` | FBC catalog tooling (some operators) |
| `operators/*/*/bundle.Dockerfile` | Bundle image build definitions |
| `operators/*/*/manifests/*.clusterserviceversion.yaml` | Operator CSVs |
| `catalogs/v4.*/*/catalog.yaml` | FBC catalog definitions per OCP version |
