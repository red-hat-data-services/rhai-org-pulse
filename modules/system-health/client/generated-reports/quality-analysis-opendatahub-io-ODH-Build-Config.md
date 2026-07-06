---
repository: "opendatahub-io/ODH-Build-Config"
overall_score: 3.8
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No unit tests — repo is configuration/manifests only, no application code"
  - dimension: "Integration/E2E"
    score: 4.0
    status: "Enterprise Contract integration tests via Konflux, no functional E2E"
  - dimension: "Build Integration"
    score: 6.0
    status: "Tekton Konflux pipelines for PR and push builds with centralized pipeline refs"
  - dimension: "Image Testing"
    score: 3.0
    status: "OLM scorecard tests for bundle validation; no runtime image testing"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tracking — not applicable for a config-only repo"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "7 GitHub Actions workflows + 4 Tekton pipelines; Mergify auto-merge; scheduled sync"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent guidance"
critical_gaps:
  - title: "No YAML/manifest validation on PRs"
    impact: "Malformed CRDs, CSVs, or catalog entries can merge and break downstream operator installs"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No OLM bundle validation in CI"
    impact: "Bundle validation relies solely on scorecard config but is never executed in any workflow"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No security scanning on container images"
    impact: "Vulnerabilities in base images (ose-operator-registry) not detected before release"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Catalog integrity not validated"
    impact: "FBC catalog.yaml changes can introduce broken channel graphs or missing upgrade edges"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No Kustomize/manifest generation validation"
    impact: "Processed bundle output correctness not verified before commit"
    severity: "MEDIUM"
    effort: "6-8 hours"
quick_wins:
  - title: "Add yamllint and kubeconform validation to PR workflow"
    effort: "2-3 hours"
    impact: "Catch malformed YAML and invalid Kubernetes manifests before merge"
  - title: "Add Trivy scanning to Tekton PR pipeline"
    effort: "1-2 hours"
    impact: "Detect known CVEs in catalog base image before release"
  - title: "Add operator-sdk bundle validate step to CI"
    effort: "2-3 hours"
    impact: "Validate OLM bundle structure, annotations, and CSV correctness automatically"
  - title: "Create CLAUDE.md with contribution and review guidelines"
    effort: "1-2 hours"
    impact: "Enable AI agents to understand repo conventions and review changes correctly"
recommendations:
  priority_0:
    - "Add YAML schema validation (kubeconform) for all CRD and CSV manifests on every PR"
    - "Run operator-sdk bundle validate in CI to catch OLM packaging errors before merge"
    - "Add container image vulnerability scanning (Trivy) to Tekton PR pipelines"
  priority_1:
    - "Add opm validate for FBC catalog integrity checks on catalog changes"
    - "Implement diff-based validation for bundle-patch.yaml and csv-patch.yaml processing"
    - "Add Enterprise Contract checks to ODH (not just RHOAI) pipelines"
    - "Create CLAUDE.md with repo conventions and manifest editing rules"
  priority_2:
    - "Add SBOM generation to bundle and catalog image builds"
    - "Implement catalog upgrade-path testing (can OLM resolve the channel graph?)"
    - "Add Mergify configuration validation (currently two mergify.yml files exist)"
    - "Add image signing/attestation for bundle and catalog images"
---

# Quality Analysis: ODH-Build-Config

## Executive Summary
- **Overall Score: 3.8/10**
- **Repository Type**: Build configuration / OLM operator bundle & catalog management
- **Primary Languages**: YAML (manifests, workflows, Tekton pipelines), Dockerfile, shell scripts
- **Framework**: OLM (Operator Lifecycle Manager) bundle & FBC (File-Based Catalog)
- **Key Strengths**: Well-structured Konflux/Tekton integration, automated bundle sync from opendatahub-operator, Mergify auto-merge for bot-generated PRs
- **Critical Gaps**: No manifest validation, no security scanning, no OLM bundle validation in CI, no agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, no .claude/ directory

This is a **build configuration repository** — it does not contain application code but rather operator bundle manifests, FBC catalog definitions, Tekton pipeline configs, and GitHub Actions workflows that automate the RHOAI/ODH operator build and release process. Quality practices must be evaluated differently than a typical code repository: the focus should be on **manifest validation**, **build pipeline reliability**, **catalog integrity**, and **security scanning** rather than unit tests and code coverage.

## Quality Scorecard
| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No unit tests — N/A for config-only repo |
| Integration/E2E | 4/10 | Enterprise Contract tests for RHOAI; no functional E2E |
| **Build Integration** | **6/10** | **Tekton pipelines for PR + push with centralized pipeline refs** |
| Image Testing | 3/10 | OLM scorecard config exists but never executed in CI |
| Coverage Tracking | 0/10 | Not applicable for config/manifest repository |
| CI/CD Automation | 7/10 | 7 GHA workflows + 4 Tekton pipelines; Mergify; scheduled sync |
| Agent Rules | 0/10 | No agent guidance of any kind |

## Critical Gaps

### 1. No YAML/Manifest Validation on PRs
- **Impact**: Malformed CRDs, CSVs, or catalog entries can merge and break downstream operator installations. A missing field in the CSV or an invalid CRD spec would only be caught at install time.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The repository contains 20+ CRD manifests, a 2,903-line ClusterServiceVersion, and FBC catalog definitions. None are validated against their OpenAPI schemas or Kubernetes resource schemas in any CI workflow.

### 2. No OLM Bundle Validation in CI
- **Impact**: The `bundle/tests/scorecard/config.yaml` defines 6 scorecard tests (basic-check-spec, olm-bundle-validation, olm-crds-have-validation, olm-crds-have-resources, olm-spec-descriptors, olm-status-descriptors) but these are **never executed** in any GitHub Actions workflow or Tekton pipeline. Bundle structural issues are not caught until downstream consumers attempt installation.
- **Severity**: HIGH
- **Effort**: 4-8 hours

### 3. No Security Scanning on Container Images
- **Impact**: The catalog image is built from `registry.redhat.io/openshift4/ose-operator-registry-rhel9:v4.20`. Vulnerabilities in this base image are never scanned. The bundle image uses `FROM scratch` (low risk) but the catalog image carries a full runtime.
- **Severity**: HIGH
- **Effort**: 2-4 hours

### 4. No Catalog Integrity Validation
- **Impact**: FBC `catalog.yaml` changes processed by `process-fbc-fragment.yaml` could introduce broken channel graphs, missing upgrade edges, or duplicate entries. The `opm validate` tool exists for this purpose but is not used.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours

### 5. No Processed Output Validation
- **Impact**: The `process-operator-bundle.yaml` workflow transforms raw bundle files from `to-be-processed/` into the final `bundle/` directory. There is no validation step to verify the processed output matches expected structure, required fields, or has no regressions.
- **Severity**: MEDIUM
- **Effort**: 6-8 hours

## Quick Wins

### 1. Add yamllint + kubeconform to PR Workflow (2-3 hours)
```yaml
# Add to a new .github/workflows/validate-manifests.yaml
name: Validate Manifests
on:
  pull_request:
    paths: ['bundle/**', 'catalog/**', 'to-be-processed/**']
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install tools
        run: |
          pip install yamllint
          curl -sL https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-amd64.tar.gz | tar xz
      - name: Lint YAML
        run: yamllint -d relaxed bundle/ catalog/ config/
      - name: Validate CRDs
        run: ./kubeconform -strict -summary bundle/manifests/
```

### 2. Add Trivy Scanning (1-2 hours)
Add a Trivy scan step to the existing Tekton pipelines or create a new GitHub Actions workflow for catalog image scanning.

### 3. Add operator-sdk bundle validate (2-3 hours)
```yaml
- name: Validate OLM Bundle
  run: |
    curl -sL https://github.com/operator-framework/operator-sdk/releases/latest/download/operator-sdk_linux_amd64 -o operator-sdk
    chmod +x operator-sdk
    ./operator-sdk bundle validate bundle/ --select-optional suite=operatorframework
```

### 4. Create CLAUDE.md (1-2 hours)
```markdown
# ODH-Build-Config

## Purpose
OLM operator bundle and FBC catalog configuration for RHOAI/ODH operator.

## Key Directories
- `bundle/` - Processed OLM bundle manifests (DO NOT edit CRDs directly - they come from opendatahub-operator)
- `to-be-processed/bundle/` - Raw bundle input from opendatahub-operator sync
- `catalog/` - FBC (File-Based Catalog) definitions
- `config/` - Build configuration metadata
- `.tekton/` - Konflux pipeline definitions
```

## Detailed Findings

### CI/CD Pipeline

**GitHub Actions Workflows (7 total)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `bundle-insta-merge.yaml` | PR (paths: bundle-patch.yaml) | Auto-merge bot-generated bundle nudge PRs |
| `bundle-sync.yml` | Schedule (every 2h) + dispatch | Sync bundle from opendatahub-operator stable branch |
| `fbc-insta-merge.yaml` | PR (paths: catalog-patch.yaml) | Auto-merge bot-generated FBC nudge PRs |
| `process-fbc-fragment.yaml` | Push to main (catalog-patch.yaml) | Process FBC fragments into catalog |
| `process-operator-bundle.yaml` | Push to main (bundle paths) | Process raw bundle into final manifests |
| `trigger-nightly-bundle-build.yaml` | Dispatch only (cron commented out) | Trigger nightly bundle builds (non-main branches) |
| `trigger-nightly-fbc-build.yaml` | Dispatch only (cron commented out) | Trigger nightly FBC builds (non-main branches) |

**Tekton Pipelines (4 total)**:

| Pipeline | Event | Purpose |
|----------|-------|---------|
| `odh-operator-bundle-ci-pull-request.yaml` | PR (label/comment triggered) | Build bundle image on PR via Konflux |
| `odh-operator-bundle-ci-push.yaml` | Push to main (bundle changes) | Build and publish bundle image |
| `odh-fbc-fragment-ci-pull-request.yaml` | PR (label/comment triggered) | Build FBC catalog image on PR via Konflux |
| `odh-fbc-fragment-ci-push.yaml` | Push to main (catalog changes) | Build and publish FBC catalog image |

**Strengths**:
- Tekton PR pipelines use `cancel-in-progress: true` for efficient resource usage
- Push pipelines use CEL expressions with path-based filtering to avoid unnecessary builds
- Centralized pipeline definitions via `odh-konflux-central.git` (good DRY practice)
- Slack failure notifications enabled on push pipelines
- PR images have 5-day expiry to manage registry space

**Weaknesses**:
- PR builds are opt-in (label/comment triggered), not automatic — bundle/catalog changes can merge without being built
- No validation steps in any pipeline — build success is the only gate
- Nightly builds are commented out (dead code)
- Two Mergify config files exist (`.mergify.yml` and `mergify.yml`) with slightly different configurations

### Test Coverage

**Unit Tests**: None (score: 0/10)
- This is expected and acceptable for a configuration-only repository
- There is no application code to unit test

**Integration Tests**:
- `integration-tests/integration-test.yaml`: An IntegrationTestScenario for RHOAI Enterprise Contract validation
- `integration-tests/enterprise-contract.yaml`: Full EC pipeline definition with signature verification
- These only apply to RHOAI tenant namespace, not the ODH build pipeline

**OLM Scorecard Tests**:
- `bundle/tests/scorecard/config.yaml` defines 6 tests:
  - `basic-check-spec` (v1.31.0)
  - `olm-bundle-validation` (v1.24.1)
  - `olm-crds-have-validation` (v1.24.1)
  - `olm-crds-have-resources` (v1.24.1)
  - `olm-spec-descriptors` (v1.24.1)
  - `olm-status-descriptors` (v1.24.1)
- **Critical issue**: These tests are configured but never executed in any CI pipeline
- Version mismatch: basic-check-spec uses v1.31.0 while OLM tests use v1.24.1

### Code Quality

**Linting**: None
- No yamllint, no shellcheck, no manifest validation
- YAML files can contain syntax errors that merge silently

**Pre-commit Hooks**: None
- No `.pre-commit-config.yaml`

**Static Analysis**: None
- No CodeQL, no SAST tools
- No Kustomize validation

**Code Ownership**:
- `CODEOWNERS` file assigns 6 reviewers for all files
- `OWNERS` file (Prow format) uses `openshift-ci-robot` only

### Container Images

**Bundle Image** (`bundle/Dockerfile`):
- `FROM scratch` — minimal attack surface (good)
- Extensive build-arg labeling for traceability (git URLs, commits)
- Proper OLM labels for bundle metadata
- Copies manifests, metadata, and scorecard tests

**Catalog Image** (`catalog/v4.20/Dockerfile`):
- Based on `registry.redhat.io/openshift4/ose-operator-registry-rhel9:v4.20`
- Runs `opm serve` with cache pre-population (good for startup performance)
- Proper OLM and Red Hat labels
- **No vulnerability scanning** of the base image

**Multi-arch Support**:
- FBC catalog pipeline explicitly sets `linux/x86_64` only — no multi-arch
- Bundle pipeline doesn't specify platforms (defaults to runner arch)

### Security

**Vulnerability Scanning**: None
- No Trivy, Snyk, or Grype scanning
- No `.trivyignore` file

**Enterprise Contract**:
- Integration test scenario configured for RHOAI tenant
- EC pipeline verifies image signatures with cosign
- Strict mode enabled (`STRICT: true`)
- Ignores Rekor transparency log (`IGNORE_REKOR: true`)
- Only applies to RHOAI builds, not ODH

**Secret Management**:
- GitHub App tokens used for cross-repo operations (good)
- Quay registry credentials stored as GitHub secrets
- No secret detection tooling (Gitleaks, TruffleHog)

**Permissions**:
- Some workflows use overly broad permissions (`security-events: write` on insta-merge workflows that don't need it)
- The `process-*` workflows run in privileged containers

### Agent Rules (Agentic Flow Quality)

**Status**: Missing
- No `CLAUDE.md` or `AGENTS.md`
- No `.claude/` directory
- No `.claude/rules/` for manifest editing guidelines
- No testing documentation

**Gap**: This repo has complex conventions (processed vs raw bundles, patch files, catalog structure) that would greatly benefit from agent rules to prevent incorrect edits.

**Recommendation**: Generate rules covering:
- Which files are auto-generated vs manually edited
- How bundle-patch.yaml and csv-patch.yaml work
- Catalog structure and FBC conventions
- Review checklist for manifest changes

## Recommendations

### Priority 0 (Critical)
1. **Add YAML schema validation (kubeconform) for all CRD and CSV manifests on every PR** — prevents malformed Kubernetes resources from merging
2. **Run `operator-sdk bundle validate` in CI** — catches OLM packaging errors (missing annotations, invalid CSV structure, CRD/CSV mismatches)
3. **Add container image vulnerability scanning (Trivy) to Tekton PR pipelines** — detects known CVEs before release

### Priority 1 (High Value)
1. **Add `opm validate` for FBC catalog integrity** — verifies channel graphs, upgrade paths, and catalog structure
2. **Implement diff-based validation for bundle processing** — verify that `process-operator-bundle` output matches expected structure
3. **Add Enterprise Contract checks to ODH pipelines** (currently RHOAI-only)
4. **Create CLAUDE.md with repo conventions** — enable AI agents to review and contribute correctly
5. **Make Tekton PR builds automatic** (not label-gated) for all bundle/catalog changes

### Priority 2 (Nice-to-Have)
1. **Add SBOM generation** to bundle and catalog image builds
2. **Implement catalog upgrade-path testing** — verify OLM can resolve the channel graph end-to-end
3. **Consolidate Mergify configs** — two files (`.mergify.yml` and `mergify.yml`) with divergent rules
4. **Add image signing/attestation** for bundle and catalog images
5. **Enable multi-arch builds** for FBC catalog image (currently x86_64 only)
6. **Update scorecard test versions** — basic-check-spec is v1.31.0 but OLM tests are v1.24.1
7. **Remove commented-out cron triggers** in nightly build workflows (dead code)

## Comparison to Gold Standards

| Feature | ODH-Build-Config | odh-dashboard | notebooks | kserve |
|---------|-----------------|---------------|-----------|--------|
| Unit Tests | N/A (config repo) | Comprehensive Jest suite | N/A (image repo) | Go test suite |
| Integration Tests | EC only (RHOAI) | Contract tests | Image validation | envtest |
| Manifest Validation | None | Kustomize validation | N/A | kubeconform |
| Security Scanning | None | Trivy in CI | Trivy + Snyk | CodeQL + Trivy |
| Coverage Tracking | N/A | Codecov enforced | N/A | Codecov |
| CI/CD Automation | 7 GHA + 4 Tekton | Comprehensive GHA | Multi-layer GHA | Prow + GHA |
| OLM Validation | Config only, not run | N/A | N/A | N/A |
| Agent Rules | None | Comprehensive .claude/ | None | None |
| Multi-arch | x86_64 only | N/A | Multi-arch | Multi-arch |
| SBOM | None | Generated | Generated | Generated |

## File Paths Reference

### CI/CD
- `.github/workflows/bundle-insta-merge.yaml` — Auto-merge bundle nudge PRs
- `.github/workflows/bundle-sync.yml` — Scheduled bundle sync from opendatahub-operator
- `.github/workflows/fbc-insta-merge.yaml` — Auto-merge FBC nudge PRs
- `.github/workflows/process-fbc-fragment.yaml` — FBC fragment processing
- `.github/workflows/process-operator-bundle.yaml` — Bundle processing
- `.github/workflows/trigger-nightly-bundle-build.yaml` — Nightly bundle builds
- `.github/workflows/trigger-nightly-fbc-build.yaml` — Nightly FBC builds
- `.tekton/odh-operator-bundle-ci-pull-request.yaml` — Konflux PR pipeline
- `.tekton/odh-operator-bundle-ci-push.yaml` — Konflux push pipeline
- `.tekton/odh-fbc-fragment-ci-pull-request.yaml` — FBC PR pipeline
- `.tekton/odh-fbc-fragment-ci-push.yaml` — FBC push pipeline

### Build
- `bundle/Dockerfile` — OLM operator bundle image
- `catalog/v4.20/Dockerfile` — FBC catalog image
- `bundle/bundle_build_args.map` — Bundle build arguments
- `catalog/catalog_build_args.map` — Catalog build arguments

### Configuration
- `config/build-config.yaml` — OCP version + base image config
- `config/trustyai-pig-build-config.yaml` — TrustyAI PNC build config
- `bundle/bundle-patch.yaml` — Bundle transformation patches
- `bundle/csv-patch.yaml` — CSV transformation patches
- `catalog/catalog-patch.yaml` — Catalog transformation patches
- `pcc/catalog-v4.20.yaml` — PCC catalog package/channel definition

### Manifests
- `bundle/manifests/` — 30+ processed CRD and CSV manifests
- `bundle/metadata/annotations.yaml` — Bundle annotations
- `bundle/tests/scorecard/config.yaml` — OLM scorecard test configuration
- `to-be-processed/bundle/` — Raw bundle input from opendatahub-operator

### Merge Automation
- `.mergify.yml` — Mergify rules for stable branch
- `mergify.yml` — Mergify rules for stable + main branches
- `CODEOWNERS` — GitHub code review assignments
- `OWNERS` — Prow/OpenShift CI owners
