---
repository: "redhat-openshift-ecosystem/community-operators-prod"
overall_score: 4.8
scorecard:
  - dimension: "Unit Tests"
    score: 1.0
    status: "No unit tests — this is a data/catalog repository, not a software project"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "External Tekton pipeline runs DeployableByOLM, preflight-trigger, dangling bundle checks"
  - dimension: "Build Integration"
    score: 6.0
    status: "External pipeline validates bundle builds, index image construction, and FBC catalog generation"
  - dimension: "Image Testing"
    score: 5.0
    status: "Bundle images built from scratch Dockerfiles; preflight checks run but no runtime validation"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No code coverage — N/A for a data repository; no operator manifest coverage metrics"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "External Tekton pipeline (operator-hosted-pipeline) handles PR validation and release; only 2 GitHub Actions workflows (stale issues, label commands)"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, .claude/ directory, or any AI agent guidance"
critical_gaps:
  - title: "No in-repo CI/CD — entire validation depends on external pipeline"
    impact: "Contributors cannot run validation locally; pipeline failures are opaque; no way to reproduce issues without access to the external Tekton infrastructure"
    severity: "HIGH"
    effort: "40+ hours"
  - title: "No manifest schema validation in-repo"
    impact: "Malformed CSVs, CRDs, or FBC catalog entries are only caught by external pipeline, not locally or in PR checks"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No FBC catalog consistency checks"
    impact: "Catalog entries across 11 OCP versions (v4.12-v4.22) can drift; no automated cross-version validation"
    severity: "MEDIUM"
    effort: "12-16 hours"
  - title: "No security scanning of contributed operator bundles"
    impact: "Operator images referenced in CSVs are not scanned for vulnerabilities at PR time"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No agent rules for AI-assisted contributions"
    impact: "AI agents contributing operators have no guidance on bundle structure, required fields, or validation steps"
    severity: "LOW"
    effort: "4-6 hours"
quick_wins:
  - title: "Add YAML schema validation GitHub Action for CSVs and annotations"
    effort: "2-4 hours"
    impact: "Catch malformed manifests before external pipeline runs, faster feedback for contributors"
  - title: "Add CODEOWNERS file for operator directories"
    effort: "1-2 hours"
    impact: "Automated review routing; each operator's ci.yaml already lists reviewers but CODEOWNERS enables GitHub-native enforcement"
  - title: "Add basic CLAUDE.md with contribution guidelines for AI agents"
    effort: "2-3 hours"
    impact: "Enable AI-assisted operator submissions with correct bundle structure"
  - title: "Add a pre-commit hook or GitHub Action to validate FBC catalog YAML syntax"
    effort: "2-3 hours"
    impact: "Prevent merge of syntactically invalid catalog.yaml files"
  - title: "Add opm validate as a PR check"
    effort: "3-4 hours"
    impact: "Run OLM's own validation tool on bundle content before external pipeline"
recommendations:
  priority_0:
    - "Implement in-repo operator-sdk bundle validate as a GitHub Action to catch bundle structure issues before external pipeline"
    - "Add FBC (File-Based Catalog) validation using opm validate for catalog.yaml changes"
    - "Add image reference validation to verify that CSV-referenced images exist and are pullable"
  priority_1:
    - "Add cross-version catalog consistency checks (ensure replaces chains are valid across OCP versions)"
    - "Implement Trivy/Grype scanning of referenced operator images at PR time"
    - "Create CLAUDE.md and .claude/rules/ for AI-assisted operator submissions"
  priority_2:
    - "Add mkdocs CI to validate documentation builds on PR"
    - "Add metrics/dashboards for pipeline pass/fail rates per operator"
    - "Implement a local validation script contributors can run before submitting PRs"
---

# Quality Analysis: community-operators-prod

## Executive Summary
- **Overall Score: 4.8/10**
- **Repository Type**: Operator catalog / data repository (not a software project)
- **Primary Content**: 323 operator bundles, 6,647 CSVs, 59,057 manifest files, FBC catalogs for OCP v4.12-v4.22
- **Size**: 3.3 GB, 75,247 files
- **Key Strengths**: Mature external Tekton pipeline (operator-hosted-pipeline) with DeployableByOLM testing, preflight checks, and automated release; well-structured operator bundle format with per-operator ci.yaml configuration
- **Critical Gaps**: Zero in-repo CI/CD validation, no local validation tooling, no manifest schema enforcement, no security scanning, no agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard
| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 1/10 | No unit tests (N/A for data repo) |
| Integration/E2E | 7/10 | External pipeline: DeployableByOLM, preflight, dangling bundle checks |
| **Build Integration** | **6/10** | **External pipeline builds bundle images and index images; no in-repo build validation** |
| Image Testing | 5/10 | Bundle images use FROM scratch; preflight checks run but no runtime validation |
| Coverage Tracking | 1/10 | No coverage metrics for manifest completeness or validation |
| CI/CD Automation | 6/10 | Robust external pipeline but only 2 GitHub Actions (stale issues, label commands) |
| Agent Rules | 0/10 | No AI agent guidance whatsoever |

## Critical Gaps

### 1. No In-Repo CI/CD Validation
- **Impact**: Contributors cannot validate bundles locally or see what checks will run. Pipeline failures are discovered only after external pipeline runs (which require Tekton infrastructure access).
- **Severity**: HIGH
- **Effort**: 40+ hours (to replicate key pipeline checks as GitHub Actions)
- **Detail**: The repository relies entirely on the [operator-pipelines](https://github.com/redhat-openshift-ecosystem/operator-pipelines) external Tekton pipeline. GitHub Actions are limited to stale issue cleanup and PR label commands. The config.yaml defines 4 test suites (DeployableByOLM, check_dangling_bundles, check_operator_name, preflight-trigger) but none run within GitHub Actions.

### 2. No Manifest Schema Validation
- **Impact**: Malformed ClusterServiceVersions, CRDs, annotations.yaml, or FBC catalog entries are only caught by the external pipeline, not at PR submission time or locally.
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Detail**: With 6,647 CSVs and 59,057 manifest files, even basic YAML syntax validation would catch issues early. Tools like `operator-sdk bundle validate` and `opm validate` could run as GitHub Actions.

### 3. No FBC Catalog Consistency Checks
- **Impact**: The repository maintains FBC catalogs for 11 OCP versions (v4.12-v4.22) with varying numbers of operators per version. There is no automated check that replaces chains are valid, that channels are consistent, or that images referenced in catalog.yaml entries actually exist.
- **Severity**: MEDIUM
- **Effort**: 12-16 hours

### 4. No Security Scanning of Operator Images
- **Impact**: CSVs reference container images (e.g., `quay.io/community-operator-pipeline-prod/*`), but there is no vulnerability scanning of these images at PR time.
- **Severity**: HIGH
- **Effort**: 8-12 hours

### 5. No CODEOWNERS or Branch Protection Visibility
- **Impact**: Per-operator reviewers are defined in ci.yaml files (321 of 323 operators have ci.yaml), but this is consumed only by the external pipeline. GitHub's native CODEOWNERS mechanism is not used.
- **Severity**: LOW
- **Effort**: 1-2 hours (auto-generate from ci.yaml files)

## Quick Wins

### 1. Add YAML Schema Validation GitHub Action (2-4 hours)
- **Impact**: Catch malformed CSVs and annotations before external pipeline runs
- **Implementation**:
```yaml
name: Validate Operator Bundles
on: [pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install operator-sdk
        run: |
          curl -LO https://github.com/operator-framework/operator-sdk/releases/latest/download/operator-sdk_linux_amd64
          chmod +x operator-sdk_linux_amd64 && sudo mv operator-sdk_linux_amd64 /usr/local/bin/operator-sdk
      - name: Validate changed bundles
        run: |
          CHANGED_DIRS=$(git diff --name-only ${{ github.event.pull_request.base.sha }} HEAD | grep "^operators/" | cut -d/ -f1-3 | sort -u)
          for dir in $CHANGED_DIRS; do
            if [ -d "$dir/manifests" ]; then
              echo "Validating $dir..."
              operator-sdk bundle validate "$dir" --select-optional suite=operatorframework
            fi
          done
```

### 2. Add CODEOWNERS from ci.yaml (1-2 hours)
- **Impact**: Enable GitHub-native review routing
- **Implementation**: Script to parse `operators/*/ci.yaml` and generate `.github/CODEOWNERS`

### 3. Add CLAUDE.md for AI Contributions (2-3 hours)
- **Impact**: Guide AI agents on bundle structure, required fields, and validation
- **Implementation**: Document the operator bundle structure, required CSV fields, ci.yaml format, and FBC catalog format

### 4. Add FBC Catalog YAML Lint (2-3 hours)
- **Impact**: Prevent merge of syntactically invalid catalog.yaml files
- **Implementation**: `yamllint` or `opm validate` on changed catalog files

### 5. Add opm validate Check (3-4 hours)
- **Impact**: Run OLM's own validation before external pipeline
- **Implementation**: Install `opm` and run `opm validate catalogs/<version>/` on changed catalog directories

## Detailed Findings

### CI/CD Pipeline

**GitHub Actions Workflows (2 total)**:
1. **stale_issues.yaml** — Scheduled daily cron to close stale issues (30 days stale, 30 days to close) and PRs (30 days stale, 7 days to close). Uses `actions/stale@v3` (outdated, v9 is current).
2. **pr-label-command.yml** — Delegates to `redhat-openshift-ecosystem/github-workflows/.github/workflows/label-command.yml@main` for handling PR label commands via comments.

**External Pipeline (Tekton-based)**:
- The `operator-hosted-pipeline` runs on every PR and applies labels:
  - `operator-hosted-pipeline/passed` or `operator-hosted-pipeline/failed`
  - `operator-release-pipeline/passed` or `operator-release-pipeline/failed`
  - `validation-failed` on failures
  - `approved` when all checks pass
- Tests defined in `config.yaml`:
  - **DeployableByOLM** — Deploys operator on a live cluster (excludes ACK operators, community-windows-machine-config-operator)
  - **check_dangling_bundles** — Validates bundle references (excludes assisted-service-operator)
  - **check_operator_name** — Validates operator naming conventions (excludes ibm-block-csi-operator-community, postgresql)
  - **preflight-trigger** — Runs Red Hat preflight checks (excludes ACK operators)

**Observations**:
- The external pipeline is robust and well-tested (all recent merged PRs show passed labels)
- However, contributors have no way to run these checks locally
- Pipeline failure debugging requires external system access
- The stale bot uses an outdated action version (v3 vs v9)

### Test Coverage

**In-Repo Tests**: None. This is a data repository with no application code to test.

**External Pipeline Tests**: 4 test suites configured in `config.yaml` with per-operator ignore lists.

**Operator Scorecard Tests**: Some operators include `tests/scorecard/config.yaml` with OLM scorecard tests (basic-check-spec, olm-bundle-validation, olm-crds-have-validation, olm-crds-have-resources, olm-spec-descriptors, olm-status-descriptors). These are run by the external pipeline, not by GitHub Actions.

**Test-to-Code Ratio**: N/A (data repository)

### Code Quality

- **Linting**: None in-repo. No `.golangci.yaml`, `.eslintrc`, `ruff.toml`, or any linting configuration.
- **Pre-commit Hooks**: None. No `.pre-commit-config.yaml`.
- **Static Analysis**: None in-repo. No CodeQL, gosec, or Semgrep configuration.
- **YAML Validation**: No yamllint or schema validation for the 59,057+ manifest files.
- **Formatters**: None.

### Container Images

**Bundle Dockerfiles**: 2,975 bundle Dockerfiles across operator versions, all following the same pattern:
```dockerfile
FROM scratch
LABEL operators.operatorframework.io.bundle.mediatype.v1=registry+v1
LABEL operators.operatorframework.io.bundle.manifests.v1=manifests/
# ... more labels
COPY manifests /manifests/
COPY metadata /metadata/
```

**Regular Dockerfiles**: 459 Dockerfiles (mostly for older operators like volume-expander-operator that include build Dockerfiles).

**Observations**:
- All bundle Dockerfiles use `FROM scratch` (minimal attack surface)
- No multi-architecture build support in bundle Dockerfiles (not needed for metadata-only images)
- No image signing or SBOM generation in-repo (may be handled by external pipeline)
- Referenced operator images in CSVs are not validated for existence or scanned

### Security

- **Container Scanning**: None in-repo. No Trivy, Snyk, or Grype configuration.
- **SAST/CodeQL**: None. No `.github/workflows/codeql.yml`.
- **Dependency Scanning**: N/A (no application dependencies).
- **Secret Detection**: None. No `.gitleaks.toml` or TruffleHog configuration.
- **Image Reference Validation**: No automated check that images referenced in CSVs are pullable or free of known vulnerabilities.
- **Allowed Registries**: Config enforces `quay.io/community-operator-pipeline-prod/` and `quay.io/openshift-community-operators/` as allowed bundle registries.

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no CLAUDE.md, AGENTS.md, `.claude/` directory, or any AI agent guidance
- **Quality**: N/A
- **Gaps**:
  - No guidance on operator bundle structure for AI agents
  - No rules for CSV required fields validation
  - No rules for FBC catalog format
  - No contribution workflow documentation for AI tools
- **Recommendation**: Generate basic agent rules with `/test-rules-generator` covering:
  - Operator bundle structure (manifests/, metadata/, tests/scorecard/)
  - Required CSV fields and annotations
  - ci.yaml configuration format
  - FBC catalog.yaml format and replaces chains
  - PR submission guidelines (one operator per PR, squashed commits)

## Recommendations

### Priority 0 (Critical)

1. **Implement in-repo bundle validation GitHub Action** — Run `operator-sdk bundle validate` on changed operator bundles at PR time. This gives contributors immediate feedback without waiting for the external pipeline.

2. **Add FBC catalog validation using `opm validate`** — Run OLM's catalog validation tool on changed `catalogs/` directories to catch invalid catalog entries before the external pipeline.

3. **Add image reference validation** — Verify that container images referenced in CSVs exist and are pullable from allowed registries.

### Priority 1 (High Value)

4. **Add cross-version catalog consistency checks** — Verify that replaces chains are valid across all 11 OCP versions, channels are consistent, and no dangling references exist.

5. **Implement Trivy scanning of referenced operator images** — Scan images referenced in new/changed CSVs for known vulnerabilities.

6. **Create CLAUDE.md and .claude/rules/** — Add AI agent guidance for operator submissions, including bundle structure, required fields, and validation steps.

7. **Generate CODEOWNERS from ci.yaml** — Auto-generate a CODEOWNERS file from per-operator ci.yaml reviewer lists for GitHub-native review routing.

### Priority 2 (Nice-to-Have)

8. **Add yamllint configuration** — Enforce consistent YAML formatting across the 59,057+ manifest files.

9. **Add mkdocs CI** — Validate documentation builds on PRs that touch docs/ or mkdocs.yml.

10. **Add local validation script** — Create a `validate.sh` that contributors can run locally before submitting PRs, wrapping `operator-sdk bundle validate` and `opm validate`.

11. **Update stale bot action** — Upgrade from `actions/stale@v3` to `actions/stale@v9` for latest features and security fixes.

12. **Add pipeline pass/fail metrics** — Dashboard tracking validation pass rates by operator, identifying consistently problematic operators.

## Comparison to Gold Standards

| Feature | community-operators-prod | odh-dashboard | notebooks | kserve |
|---------|------------------------|---------------|-----------|--------|
| In-Repo CI/CD | 2 GitHub Actions (admin only) | Comprehensive GHA | Full CI/CD | Full CI/CD |
| External Pipeline | Tekton (robust) | N/A | N/A | N/A |
| Unit Tests | None (data repo) | Jest + Cypress | Python tests | Go tests |
| Integration Tests | DeployableByOLM (external) | Contract tests | Image validation | envtest |
| Schema Validation | None in-repo | TypeScript strict | N/A | CRD validation |
| Security Scanning | None | Trivy, CodeQL | Trivy | CodeQL |
| Coverage Tracking | None | Codecov | N/A | Codecov |
| Agent Rules | None | .claude/rules/ | N/A | N/A |
| Pre-commit Hooks | None | ESLint, Prettier | N/A | golangci-lint |
| Local Validation | None | `npm test` | `make test` | `make test` |

**Note**: Direct comparison is limited because community-operators-prod is a data/catalog repository, not a software project. The gold standards are application repositories with source code. The most relevant comparison dimensions are CI/CD automation, schema validation, and security scanning.

## Repository Statistics

| Metric | Value |
|--------|-------|
| Total Files | 75,247 |
| Repository Size | 3.3 GB |
| Operator Directories | 323 |
| Operator Versions (CSVs) | 6,647 |
| Manifest Files | 59,057 |
| Bundle Dockerfiles | 2,975 |
| Regular Dockerfiles | 459 |
| FBC Catalog Versions | 11 (v4.12 - v4.22) |
| FBC Catalog YAML Files | 266 |
| ci.yaml Config Files | 321 |
| Scorecard Test Configs | Present in some operators |
| GitHub Actions Workflows | 2 |
| External Pipeline Tests | 4 (DeployableByOLM, check_dangling_bundles, check_operator_name, preflight-trigger) |

## File Paths Reference

| File | Purpose |
|------|---------|
| `config.yaml` | Repository-level configuration: maintainers, test suites, allowed registries, index image settings |
| `.github/workflows/stale_issues.yaml` | Stale issue/PR cleanup (daily cron) |
| `.github/workflows/pr-label-command.yml` | PR label command handler |
| `operators/*/ci.yaml` | Per-operator CI config: update graph mode, reviewers |
| `operators/*/VERSION/manifests/*.yaml` | Operator manifests (CSVs, CRDs, RBAC, services) |
| `operators/*/VERSION/metadata/annotations.yaml` | Bundle metadata annotations |
| `operators/*/VERSION/bundle.Dockerfile` | Bundle image Dockerfiles |
| `operators/*/VERSION/tests/scorecard/config.yaml` | OLM scorecard test configuration |
| `catalogs/vX.YY/OPERATOR/catalog.yaml` | FBC (File-Based Catalog) entries per OCP version |
| `mkdocs.yml` | Documentation site configuration |
| `docs/pull_request_template.md` | PR template with contribution checklist |
