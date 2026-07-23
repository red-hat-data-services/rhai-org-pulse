---
repository: "opendatahub-io/ODH-Build-Config"
overall_score: 3.1
scorecard:
  - dimension: "Unit Tests"
    score: 1.0
    status: "No test files; config repo lacks YAML validation or schema tests"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "Enterprise Contract integration test only; no functional validation of generated bundles/catalogs"
  - dimension: "Build Integration"
    score: 7.0
    status: "Strong Konflux/Tekton PR and push builds for bundle and FBC fragment; CEL-based smart triggering"
  - dimension: "Image Testing"
    score: 3.0
    status: "Two Dockerfiles (bundle FROM scratch, catalog FROM ose-operator-registry); no runtime validation or multi-arch for bundle"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling; no YAML validation metrics"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "7 GHA workflows plus 4 Tekton pipelines; Mergify auto-merge; but no concurrency control, no caching, nightly triggers commented out"
  - dimension: "Static Analysis"
    score: 1.0
    status: "No YAML linting, no schema validation, no Dependabot/Renovate, no pre-commit hooks; FIPS explicitly skipped in FBC builds"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules"
critical_gaps:
  - title: "No YAML schema validation or content tests"
    impact: "Malformed CRDs, incorrect image references, or broken patch files are not caught until Konflux build or runtime"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "FIPS checks explicitly skipped in FBC catalog builds"
    impact: "FBC fragment builds skip FIPS validation (skip-fips: true), potentially producing non-compliant catalog images"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No dependency update automation (Dependabot/Renovate)"
    impact: "GitHub Actions pinned to old versions (e.g., actions/checkout@v4 unpinned, getsentry/action-github-app-token@v2); no automated base image updates"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No concurrency control in GitHub Actions workflows"
    impact: "Multiple bundle-sync or process runs can execute simultaneously, causing race conditions on commit/push steps"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No functional validation of generated bundle/catalog content"
    impact: "Processed bundles and catalogs are committed and pushed without verifying OLM validity, CRD schema correctness, or related image resolvability"
    severity: "HIGH"
    effort: "12-16 hours"
quick_wins:
  - title: "Add Dependabot for GitHub Actions version updates"
    effort: "1 hour"
    impact: "Automated PRs for GHA action version bumps; improved security posture"
  - title: "Add concurrency blocks to GitHub Actions workflows"
    effort: "1-2 hours"
    impact: "Prevent race conditions from parallel workflow runs on the same branch"
  - title: "Add YAML linting with yamllint in CI"
    effort: "2-3 hours"
    impact: "Catch YAML syntax errors in manifests, patches, and configs before merge"
  - title: "Enable FIPS checks on FBC catalog builds"
    effort: "1-2 hours"
    impact: "Remove skip-fips: true from Tekton pipeline configs to enforce FIPS compliance"
  - title: "Create basic CLAUDE.md with contribution guidelines"
    effort: "1-2 hours"
    impact: "Guide AI agents on repo structure, naming conventions, and patch file format"
recommendations:
  priority_0:
    - "Add YAML schema validation tests for CRD manifests, CSV patches, and build-config.yaml"
    - "Remove skip-fips: true and skip-checks: true from FBC Tekton pipeline configurations"
    - "Add functional validation that generated bundles pass opm validate before commit"
  priority_1:
    - "Enable Dependabot for github-actions ecosystem with weekly schedule"
    - "Add concurrency control to all GitHub Actions workflows to prevent race conditions"
    - "Add yamllint CI step for all YAML/YML files with appropriate configuration"
    - "Create pre-commit hooks for YAML validation and trailing whitespace"
  priority_2:
    - "Add agent rules (.claude/rules/) documenting patch file format and build-config structure"
    - "Add bundle-to-catalog end-to-end validation workflow on PRs"
    - "Implement multi-arch build validation for operator bundle images"
---

# Quality Analysis: ODH-Build-Config

## Executive Summary

- **Overall Score: 3.1/10**
- **Repository Type**: Build configuration / release engineering
- **Primary Content**: YAML (operator bundle manifests, Tekton pipelines, GitHub Actions workflows, Konflux integration)
- **Jira Component**: Build and Release (RHOAIENG)
- **Tier**: Midstream

**Key Strengths**: Strong Konflux/Tekton build pipeline integration with PR and push builds for both operator bundle and FBC catalog fragment. Mergify-based auto-merge for bot-generated PRs. Scheduled bundle sync from opendatahub-operator source.

**Critical Gaps**: No validation tests for generated YAML content. FIPS checks explicitly disabled. No dependency update automation. No YAML linting or schema validation. No agent rules for AI-assisted contributions.

**Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 1.0/10 | 15% | 0.15 | No test files; config repo lacks YAML validation or schema tests |
| Integration/E2E | 3.0/10 | 20% | 0.60 | Enterprise Contract integration test only; no functional validation |
| Build Integration | 7.0/10 | 15% | 1.05 | Strong Konflux/Tekton PR and push builds with CEL-based triggering |
| Image Testing | 3.0/10 | 10% | 0.30 | Minimal Dockerfiles; no runtime validation or multi-arch for bundle |
| Coverage Tracking | 0.0/10 | 10% | 0.00 | No coverage tooling or validation metrics |
| CI/CD Automation | 6.0/10 | 15% | 0.90 | 7 workflows + 4 Tekton pipelines; lacks concurrency control and caching |
| Static Analysis | 1.0/10 | 10% | 0.10 | No YAML linting, no Dependabot, FIPS skipped |
| Agent Rules | 0.0/10 | 5% | 0.00 | No CLAUDE.md, no .claude/ directory |
| **Overall** | **3.1/10** | **100%** | **3.10** | |

## Critical Gaps

### 1. No YAML Schema Validation or Content Tests
- **Severity**: HIGH
- **Impact**: Malformed CRDs, incorrect image references, or broken patch files are not caught until Konflux build or runtime. The `bundle-patch.yaml` contains 90+ related image entries that are not validated for correct format, digest integrity, or schema compliance.
- **Effort**: 8-12 hours
- **Files affected**: `bundle/bundle-patch.yaml`, `bundle/csv-patch.yaml`, `bundle/manifests/*.yaml`, `config/build-config.yaml`

### 2. FIPS Checks Explicitly Skipped in FBC Catalog Builds
- **Severity**: HIGH
- **Impact**: Both FBC Tekton pipelines (PR and push) set `skip-fips: true` and `skip-checks: true`, bypassing FIPS compliance validation for catalog images that ship to production.
- **Effort**: 2-4 hours
- **Files affected**: `.tekton/odh-fbc-fragment-ci-pull-request.yaml:45-46`, `.tekton/odh-fbc-fragment-ci-push.yaml:42-43`

### 3. No Functional Validation of Generated Bundle/Catalog Content
- **Severity**: HIGH
- **Impact**: The `process-operator-bundle` and `process-fbc-fragment` workflows generate and commit processed YAML files without any validation step. Invalid OLM bundles or catalogs would only be caught downstream in Konflux.
- **Effort**: 12-16 hours
- **Relevant workflows**: `.github/workflows/process-operator-bundle.yaml`, `.github/workflows/process-fbc-fragment.yaml`

### 4. No Dependency Update Automation
- **Severity**: MEDIUM
- **Impact**: GitHub Actions are pinned to versions without automated update PRs. For example, `actions/checkout@v4` is used alongside `actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd` with inconsistent pinning strategies. No Dependabot or Renovate configuration exists.
- **Effort**: 1-2 hours

### 5. No Concurrency Control in GitHub Actions Workflows
- **Severity**: MEDIUM
- **Impact**: The `bundle-sync.yml` runs every 2 hours, and `process-operator-bundle.yaml` triggers on push. Without concurrency blocks, overlapping runs can produce conflicting commits. Tekton pipelines have `cancel-in-progress` for PRs but not for push builds.
- **Effort**: 1-2 hours

## Quick Wins

### 1. Add Dependabot for GitHub Actions (1 hour)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    commit-message:
      prefix: "ci"
```

### 2. Add Concurrency Blocks to Workflows (1-2 hours)
Add to each workflow:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false
```

### 3. Add YAML Linting with yamllint (2-3 hours)
Add a PR-triggered workflow with `yamllint` checking all YAML files for syntax correctness and consistent formatting.

### 4. Enable FIPS Checks on FBC Builds (1-2 hours)
Remove or set to `false`:
```yaml
  - name: skip-checks
    value: false
  - name: skip-fips
    value: false
```

### 5. Create Basic CLAUDE.md (1-2 hours)
Document repo structure, patch file formats, and contribution patterns for AI-assisted development.

## Detailed Findings

### Unit Tests

**Score: 1.0/10**

This repository contains **zero test files**. No `*_test.go`, `*.spec.ts`, `*.test.py`, or any other test files exist. The repo contains only YAML configuration files, Dockerfiles, and text schedule triggers.

While this is a configuration repository rather than an application, there are substantial opportunities for validation:
- **YAML schema validation**: CRD manifests should be validated against their OpenAPI schemas
- **Patch file validation**: `bundle-patch.yaml` contains 90+ image references that should be validated for format and digest integrity
- **Build-config validation**: `config/build-config.yaml` structure should be validated
- **Bundle completeness checks**: Verify all required CRDs, RBAC, and CSV fields are present

The nightly FBC workflow (`trigger-nightly-fbc-build.yaml`) does include a `catalog_validator.py` call, but this is an external tool from `RHOAI-Konflux-Automation` and runs only in the nightly context, not on PRs.

### Integration/E2E Tests

**Score: 3.0/10**

**Present**:
- Enterprise Contract integration test (`integration-tests/integration-test.yaml` and `integration-tests/enterprise-contract.yaml`) for verifying container image compliance with RHOAI Enterprise Contract policies
- The Enterprise Contract test uses the `verify-enterprise-contract` Tekton task from `redhat-appstudio/build-definitions`

**Missing**:
- No OLM bundle validation (e.g., `operator-sdk bundle validate`)
- No catalog rendering validation (e.g., `opm validate`)
- No end-to-end test that installs the generated bundle in a cluster
- No multi-version testing of bundle compatibility across OCP versions
- The Enterprise Contract test is scoped to a specific RHOAI tenant and version (v2.17), suggesting it may be stale or not covering ODH main builds

### Build Integration

**Score: 7.0/10**

**Strengths**:
- **Konflux/Tekton pipelines**: 4 well-structured PipelineRun definitions covering both bundle and FBC fragment builds
- **PR builds**: Both bundle (`odh-operator-bundle-ci-pull-request.yaml`) and FBC (`odh-fbc-fragment-ci-pull-request.yaml`) have PR-triggered builds with label and comment triggers (`/build-konflux bundle`, `/build-konflux catalog`)
- **Push builds**: CEL expressions for smart triggering that exclude workflow-only or patch-only changes
- **Build nudges**: `build.appstudio.openshift.io/build-nudge-files` configured for catalog updates
- **Image expiration**: PR images expire after 5 days
- **Slack notifications**: Push builds notify on failure
- **Pipeline references**: Centralized pipeline definitions from `odh-konflux-central` repo

**Weaknesses**:
- FBC builds have `skip-checks: true` and `skip-fips: true`
- No dry-run validation step before commit in GHA workflows
- Bundle PR builds are triggered by label/comment only, not automatically on PR creation
- No Kustomize or manifest validation steps

### Image Testing

**Score: 3.0/10**

**Bundle Dockerfile** (`bundle/Dockerfile`):
- Uses `FROM scratch` (appropriate for OLM bundle images)
- Copies manifests, metadata, and scorecard test config
- Includes extensive build arg labels for traceability
- No multi-stage build (N/A for scratch-based bundles)
- No multi-arch support specified in bundle Tekton pipeline

**FBC Catalog Dockerfile** (`catalog/v4.20/Dockerfile`):
- Uses `FROM registry.redhat.io/openshift4/ose-operator-registry-rhel9:v4.20` (RHEL-based, FIPS-capable)
- Includes `opm serve --cache-only` cache pre-population (good practice)
- Proper entrypoint configuration
- Build is x86_64 only (`linux/x86_64` in Tekton params)

**Missing**:
- No container startup validation tests
- No image scanning integration (out of scope per instructions, but no runtime validation either)
- No multi-arch build for bundle images
- No Testcontainers or similar runtime testing
- No `.dockerignore` files

### Coverage Tracking

**Score: 0.0/10**

No coverage configuration exists:
- No `.codecov.yml` or `codecov.yml`
- No coverage thresholds
- No PR coverage reporting

While traditional code coverage is not applicable to a YAML config repo, there are no metrics tracking the breadth of validation applied to the generated artifacts.

### CI/CD Automation

**Score: 6.0/10**

**Workflow Inventory** (7 GitHub Actions + 4 Tekton pipelines):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `bundle-sync.yml` | Schedule (every 2h) + dispatch | Syncs bundle from opendatahub-operator |
| `process-operator-bundle.yaml` | Push (paths) + dispatch | Processes bundle with patches |
| `process-fbc-fragment.yaml` | Push (paths) + dispatch | Processes FBC catalog |
| `bundle-insta-merge.yaml` | PR (opened/reopened/edited) | Auto-merge Konflux bundle nudges |
| `fbc-insta-merge.yaml` | PR (opened/reopened/edited) | Auto-merge Konflux FBC nudges |
| `trigger-nightly-bundle-build.yaml` | Dispatch only | Nightly bundle processing |
| `trigger-nightly-fbc-build.yaml` | Dispatch only | Nightly FBC processing with PCC cache validation |

**Strengths**:
- Mergify configuration with queue rules, auto-rebase, and stale PR closing
- Auto-merge for bot PRs (Konflux, DevOps app)
- Retry logic in insta-merge workflows (5 attempts with `wretry.action`)
- Nightly FBC workflow includes catalog validation step (`catalog_validator.py`)
- PCC (Pre-Compiled Catalog) cache management for performance

**Weaknesses**:
- No `concurrency:` blocks in any GHA workflow
- No `timeout-minutes:` set on any job
- No caching strategies (`actions/cache` not used)
- Nightly push triggers are commented out (dispatch-only)
- Mixed action version pinning: some SHA-pinned (`actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd`), some tag-pinned (`actions/checkout@v4`)
- `bundle-insta-merge.yaml` uses `pull_request_target` (security-sensitive trigger) while `fbc-insta-merge.yaml` uses `pull_request` — inconsistent
- No test parallelization
- Duplicate `mergify.yml` file at root level (both `mergify.yml` and `.mergify.yml`)

### Static Analysis

**Score: 1.0/10**

#### Linting
No YAML linting configured. No `yamllint`, no schema validation, no format checking.

#### FIPS Compatibility
- FBC Tekton pipelines explicitly set `skip-fips: true`, bypassing FIPS validation
- The FBC catalog base image (`ose-operator-registry-rhel9`) is FIPS-capable, but the skip flag negates this
- Bundle image uses `FROM scratch` which has no FIPS implications
- The `csv-patch.yaml` declares `features.operators.openshift.io/fips-compliant: "true"` but this is not validated

#### Dependency Alerts
- **No Dependabot configuration** (`.github/dependabot.yml` does not exist)
- **No Renovate configuration** (no `renovate.json`, `.renovaterc`, or `.renovaterc.json`)
- GitHub Actions versions are not automatically updated
- External tool dependencies (yq, opm) are pinned to specific versions in workflows but not automatically updated

#### Pre-commit Hooks
No `.pre-commit-config.yaml` exists.

### Agent Rules

**Score: 0.0/10**

- **No `CLAUDE.md`** at repository root
- **No `AGENTS.md`** at repository root
- **No `.claude/` directory**
- **No `.claude/rules/` directory**
- **No `.claude/skills/` directory**

This repository would benefit significantly from agent rules documenting:
- Patch file format and structure (`bundle-patch.yaml`, `csv-patch.yaml`)
- Build-config.yaml schema and supported-ocp-versions structure
- Tekton PipelineRun naming conventions
- Related image naming conventions (e.g., `RELATED_IMAGE_ODH_*`)
- Workflow trigger relationships and processing pipeline flow

## Recommendations

### Priority 0 (Critical)

1. **Add YAML schema validation for CRD manifests and CSV patches**
   - Use `kubeconform` or `kubeval` to validate CRD manifests against K8s schemas
   - Validate CSV structure against OLM bundle format requirements
   - Add as a PR-triggered GHA workflow

2. **Remove `skip-fips: true` and `skip-checks: true` from FBC Tekton pipelines**
   - Files: `.tekton/odh-fbc-fragment-ci-pull-request.yaml`, `.tekton/odh-fbc-fragment-ci-push.yaml`
   - These flags bypass critical compliance checks that should be enforced

3. **Add `opm validate` step for generated catalogs**
   - After `process-fbc-fragment.yaml` generates catalog content, validate with `opm validate` before commit
   - Catches malformed FBC content before it reaches Konflux

### Priority 1 (High Value)

4. **Enable Dependabot for GitHub Actions ecosystem**
   - Create `.github/dependabot.yml` with weekly schedule
   - Standardize action version pinning strategy (prefer SHA pins)

5. **Add concurrency control to all workflows**
   - Prevent race conditions from parallel runs
   - Use `cancel-in-progress: false` for push workflows, `true` for PR workflows

6. **Add `yamllint` CI validation**
   - Create a lightweight PR-triggered workflow
   - Configure to validate all `.yaml` and `.yml` files

7. **Standardize `pull_request` vs `pull_request_target` triggers**
   - `bundle-insta-merge.yaml` uses `pull_request_target` (security-sensitive)
   - `fbc-insta-merge.yaml` uses `pull_request`
   - Evaluate whether `pull_request_target` is actually required

8. **Add `timeout-minutes` to all workflow jobs**
   - Prevent runaway builds from consuming resources

### Priority 2 (Nice-to-Have)

9. **Create agent rules for AI-assisted contributions**
   - Document patch file formats, naming conventions, and build pipeline flow
   - Use `/test-rules-generator` to bootstrap rules

10. **Remove duplicate `mergify.yml`**
    - Both `mergify.yml` and `.mergify.yml` exist at root
    - Keep only `.mergify.yml` (the standard location)

11. **Add bundle validation with `operator-sdk bundle validate`**
    - Validates OLM bundle format, CSV completeness, and CRD consistency

12. **Add multi-arch build support for operator bundle**
    - Currently only x86_64 for FBC; bundle has no platform specified
    - The CSV labels declare support for amd64, ppc64le, s390x, arm64

## Comparison to Gold Standards

| Dimension | ODH-Build-Config | odh-dashboard | notebooks | kserve |
|-----------|-----------------|---------------|-----------|--------|
| Unit Tests | 1/10 | 8/10 | 6/10 | 8/10 |
| Integration/E2E | 3/10 | 9/10 | 7/10 | 9/10 |
| Build Integration | 7/10 | 7/10 | 8/10 | 7/10 |
| Image Testing | 3/10 | 6/10 | 9/10 | 5/10 |
| Coverage Tracking | 0/10 | 8/10 | 5/10 | 8/10 |
| CI/CD Automation | 6/10 | 9/10 | 8/10 | 8/10 |
| Static Analysis | 1/10 | 7/10 | 5/10 | 7/10 |
| Agent Rules | 0/10 | 7/10 | 2/10 | 2/10 |
| **Overall** | **3.1/10** | **7.8/10** | **6.6/10** | **7.1/10** |

**Key Gaps vs Gold Standards**:
- **odh-dashboard**: Multi-layer testing including contract tests, comprehensive agent rules, coverage enforcement — ODH-Build-Config has none of these
- **notebooks**: 5-layer image validation pipeline — ODH-Build-Config does no runtime image validation
- **kserve**: Coverage thresholds enforced, multi-version E2E testing — ODH-Build-Config has no coverage tracking and no multi-version testing

**Context**: ODH-Build-Config is a build/release configuration repository, not an application repository. Some dimensions (unit tests, coverage tracking) are inherently less applicable. However, even for config repos, YAML validation, schema testing, and generated artifact verification represent significant untapped quality improvements.

## File Paths Reference

### CI/CD Workflows
- `.github/workflows/bundle-sync.yml` — Scheduled bundle sync from opendatahub-operator
- `.github/workflows/process-operator-bundle.yaml` — Bundle processing pipeline
- `.github/workflows/process-fbc-fragment.yaml` — FBC fragment processing pipeline
- `.github/workflows/bundle-insta-merge.yaml` — Auto-merge for bundle nudges
- `.github/workflows/fbc-insta-merge.yaml` — Auto-merge for FBC nudges
- `.github/workflows/trigger-nightly-bundle-build.yaml` — Nightly bundle builds
- `.github/workflows/trigger-nightly-fbc-build.yaml` — Nightly FBC builds

### Tekton Pipelines
- `.tekton/odh-operator-bundle-ci-pull-request.yaml` — Bundle PR build
- `.tekton/odh-operator-bundle-ci-push.yaml` — Bundle push build
- `.tekton/odh-fbc-fragment-ci-pull-request.yaml` — FBC PR build
- `.tekton/odh-fbc-fragment-ci-push.yaml` — FBC push build

### Build Configuration
- `config/build-config.yaml` — OCP version and base image configuration
- `config/trustyai-pig-build-config.yaml` — TrustyAI PIG build configuration
- `bundle/bundle-patch.yaml` — Related image patches (90+ entries)
- `bundle/csv-patch.yaml` — CSV metadata patches
- `bundle/additional-images-patch.yaml` — Additional image patches
- `catalog/catalog-patch.yaml` — Catalog patches

### Dockerfiles
- `bundle/Dockerfile` — Operator bundle image (FROM scratch)
- `catalog/v4.20/Dockerfile` — FBC catalog image (FROM ose-operator-registry)

### Integration Tests
- `integration-tests/integration-test.yaml` — Enterprise Contract integration test scenario
- `integration-tests/enterprise-contract.yaml` — Enterprise Contract pipeline definition

### Merge Automation
- `.mergify.yml` — Mergify queue and auto-merge rules
- `CODEOWNERS` — Code review ownership
- `OWNERS` — Prow/CI ownership
