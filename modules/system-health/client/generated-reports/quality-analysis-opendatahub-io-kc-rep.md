---
repository: "opendatahub-io/kc-rep"
overall_score: 3.9
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No application code or tests - configuration-only repository"
  - dimension: "Integration/E2E"
    score: 2.0
    status: "No pipeline validation tests; replicator workflow has no test coverage"
  - dimension: "Build Integration"
    score: 5.0
    status: "Comprehensive Konflux pipeline definitions but no validation that pipeline YAML is correct"
  - dimension: "Image Testing"
    score: 7.0
    status: "Pipelines include Clair, ClamAV, Snyk, Coverity, SBOM - but only post-push, not validated in this repo"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling - no application code to cover"
  - dimension: "CI/CD Automation"
    score: 4.0
    status: "Single dispatch-only replicator workflow; no PR checks, no linting, no YAML validation"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules"
critical_gaps:
  - title: "No YAML schema validation for Tekton PipelineRun definitions"
    impact: "Invalid pipeline YAML can be replicated to target repos, causing silent build failures"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No PR-triggered CI checks at all"
    impact: "All changes merged without automated validation; broken pipelines discovered only at runtime"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "OKC Replicator workflow only supports 2 folders (data-science-pipelines, odh-model-controller)"
    impact: "25 of 26 component folders cannot use the replicator; workflow is incomplete"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No diff/drift detection between OKC and target repos"
    impact: "No way to detect when target repo Tekton configs diverge from central definitions"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "odh-dashboard directory exists but is empty"
    impact: "Missing Konflux pipeline definition for a critical component"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "codeflare-operator directory name has trailing space"
    impact: "Filesystem path inconsistency; scripts may fail on this directory"
    severity: "MEDIUM"
    effort: "0.5 hours"
quick_wins:
  - title: "Add YAML lint CI check for all .tekton/ files"
    effort: "1-2 hours"
    impact: "Catch YAML syntax errors before merge"
  - title: "Add all 26 component folders to replicator workflow choice list"
    effort: "1 hour"
    impact: "Enable version-bump automation for all components"
  - title: "Fix codeflare-operator directory name (remove trailing space)"
    effort: "15 minutes"
    impact: "Prevent path-related script failures"
  - title: "Add kubeconform or Tekton schema validation"
    effort: "2-3 hours"
    impact: "Validate PipelineRun manifests against Tekton API schema"
recommendations:
  priority_0:
    - "Add PR-triggered CI workflow with YAML lint + Tekton schema validation for all pipeline files"
    - "Update replicator workflow to support all 26 component folders"
    - "Fix the trailing space in 'codeflare-operator ' directory name"
  priority_1:
    - "Add drift detection workflow to compare OKC definitions against target repo .tekton/ directories"
    - "Add Tekton task version consistency checks across all pipelines"
    - "Create CLAUDE.md with contribution guidelines and pipeline authoring patterns"
    - "Add odh-dashboard Tekton pipeline definition"
  priority_2:
    - "Add CODEOWNERS file for pipeline review enforcement"
    - "Add Renovate/Dependabot for Tekton task bundle version updates"
    - "Create documentation for pipeline onboarding process"
    - "Add agent rules for pipeline YAML authoring patterns"
---

# Quality Analysis: kc-rep (ODH Konflux Central)

## Executive Summary

- **Overall Score: 3.9/10**
- **Repository Type**: Configuration-only monorepo (Tekton PipelineRun definitions)
- **Purpose**: Central store for Konflux build pipeline configurations for ~26 OpenDataHub components
- **Primary Language**: YAML (Tekton PipelineRun manifests)
- **Key Strengths**: Comprehensive security scanning tasks in pipelines (9 security tasks per pipeline); consistent pipeline structure across all components; centralized management of Konflux build configs
- **Critical Gaps**: Zero CI checks on this repo itself; replicator workflow only covers 2 of 26 components; no YAML validation; no drift detection
- **Agent Rules Status**: Missing - no CLAUDE.md, no .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No application code or tests - config-only repo |
| Integration/E2E | 2/10 | No pipeline validation tests; replicator untested |
| **Build Integration** | **5/10** | **Comprehensive pipeline defs, but no validation they're correct** |
| Image Testing | 7/10 | Pipelines include 9 security/scan tasks each (Clair, ClamAV, Snyk, Coverity, SBOM) |
| Coverage Tracking | 0/10 | No coverage tooling (no application code) |
| CI/CD Automation | 4/10 | Single dispatch-only workflow; no PR checks |
| Agent Rules | 0/10 | No CLAUDE.md, .claude/ directory, or agent guidance |

## Critical Gaps

### 1. No YAML Schema Validation for Tekton PipelineRun Definitions
- **Impact**: Invalid pipeline YAML can be replicated to target repos, causing silent build failures in Konflux
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: All 30 pipeline files are complex (~580 lines each) with 19 Tekton tasks. A typo in task references, parameter names, or bundle SHA digests would not be caught until the pipeline runs in the target repository.

### 2. No PR-Triggered CI Checks
- **Impact**: All changes merged without automated validation; broken pipelines discovered only at runtime
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The only GitHub Actions workflow (`okc-replicator.yml`) is dispatch-only. There are no PR checks for:
  - YAML syntax validation
  - Tekton schema conformance
  - Bundle digest verification
  - Naming convention enforcement

### 3. OKC Replicator Only Supports 2 of 26 Components
- **Impact**: 24 component folders cannot use the version-bump replicator automation
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The `okc_folder` input in `okc-replicator.yml` only lists `data-science-pipelines` and `odh-model-controller`. The remaining 24 folders must be manually updated. The comment `# Add all valid folder names here` confirms this is known-incomplete.

### 4. No Drift Detection Between Central and Target Repos
- **Impact**: No way to know when target repo `.tekton/` configs diverge from central definitions
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Details**: The central repo stores the "source of truth" for pipeline configs, but there's no automated check that target repos match. Manual drift is inevitable.

### 5. Empty odh-dashboard Directory
- **Impact**: Missing Konflux pipeline definition for odh-dashboard, a critical ODH component
- **Severity**: MEDIUM
- **Effort**: 2-4 hours

### 6. Directory Naming Issue: `codeflare-operator ` (trailing space)
- **Impact**: Scripts iterating over directories may fail on this path
- **Severity**: MEDIUM
- **Effort**: 15 minutes

## Quick Wins

### 1. Add YAML Lint CI Check (1-2 hours)
```yaml
# .github/workflows/pr-checks.yml
name: PR Checks
on: [pull_request]
jobs:
  yaml-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: YAML Lint
        uses: ibiqlik/action-yamllint@v3
        with:
          file_or_dir: '.'
          config_data: |
            extends: default
            rules:
              line-length:
                max: 250
```

### 2. Update Replicator Folder List (1 hour)
Add all 26 component folders to the `okc_folder` choice list in `okc-replicator.yml`.

### 3. Fix Directory Name (15 minutes)
Rename `codeflare-operator ` to `codeflare-operator` (remove trailing space).

### 4. Add Tekton Schema Validation (2-3 hours)
```yaml
  tekton-validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install kubeconform
        run: |
          curl -sL https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-amd64.tar.gz | tar xz
          sudo mv kubeconform /usr/local/bin/
      - name: Validate Tekton PipelineRun schemas
        run: |
          find . -name "*.yaml" -path "*/.tekton/*" | while read f; do
            echo "Validating $f..."
            kubeconform -schema-location default \
              -schema-location 'https://raw.githubusercontent.com/tektoncd/pipeline/main/pkg/apis/pipeline/v1/openapi_generated.go' \
              -strict "$f"
          done
```

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory:**
- **1 workflow**: `okc-replicator.yml` (GitHub Actions)
  - Trigger: `workflow_dispatch` only (manual)
  - Purpose: Copy `.tekton/` files from this repo to a target repo, bump `output-image` version tags, and create a PR
  - Limitations: Only supports 2 of 26 component folders

**Pipeline Configuration Analysis:**
- **30 Tekton PipelineRun files** across 26 component directories
- All pipelines use the `docker-build-oci-ta` pattern (trusted artifacts)
- All trigger on `push` events to `konflux-poc` branch (not PRs)
- Consistent task structure: 19 Tekton tasks per pipeline
- All push to `quay.io/redhat-user-workloads/open-data-hub-tenant/`

**Tekton Tasks Used (per pipeline):**
1. `init` - Initialize build
2. `git-clone-oci-ta` - Clone source via trusted artifacts
3. `prefetch-dependencies-oci-ta` - Prefetch deps with Cachi2
4. `buildah-oci-ta` - Build container image
5. `build-image-index` - Create OCI image index
6. `source-build-oci-ta` - Build source image
7. `deprecated-image-check` - Check for deprecated base images
8. `clair-scan` - Vulnerability scanning
9. `ecosystem-cert-preflight-checks` - Certification checks
10. `sast-snyk-check-oci-ta` - SAST via Snyk
11. `clamav-scan` - Malware scanning
12. `coverity-availability-check` + `sast-coverity-check-oci-ta` - Coverity SAST
13. `sast-shell-check-oci-ta` - Shell script analysis
14. `sast-unicode-check-oci-ta` - Unicode homoglyph detection
15. `apply-tags` - Apply image tags
16. `push-dockerfile-oci-ta` - Push Dockerfile as OCI artifact
17. `rpms-signature-scan` - RPM signature verification
18. `show-sbom` - SBOM generation (finally block)

**Run Retention:**
- All pipelines set `max-keep-runs: "3"`
- Concurrency control: `cancel-in-progress: "false"` (all pipelines)

### Test Coverage

**No tests exist in this repository.** This is a configuration-only repo with no application code, so traditional unit/integration/E2E tests don't apply. However, there should be:
- YAML schema validation tests for pipeline definitions
- Integration tests for the replicator workflow
- Conformance tests ensuring pipeline consistency across components

### Code Quality

- **No linting configuration**: No yamllint, no pre-commit hooks, no static analysis
- **No `.pre-commit-config.yaml`**: No pre-commit checks enforced
- **No CODEOWNERS file**: No review enforcement for pipeline changes
- **No branch protection visible**: Changes may merge without review

### Container Images

This repo doesn't build images itself but **defines the pipelines** that build images for 26+ ODH components. The pipeline definitions are comprehensive:

- **Security scanning**: 9 security-related tasks per pipeline (Clair, ClamAV, Snyk, Coverity, shell-check, unicode-check, deprecated-image-check, RPM signature scan, ecosystem cert checks)
- **SBOM generation**: All pipelines include `show-sbom` in the `finally` block
- **Trusted artifacts**: All pipelines use `oci-ta` (OCI Trusted Artifacts) variants
- **Source images**: Support for source image builds (`build-source-image` parameter)
- **Image index**: All pipelines create an OCI image index

### Security

The pipeline definitions themselves include excellent security practices:
- **Clair vulnerability scanning** - Container vulnerability detection
- **ClamAV malware scanning** - Antivirus checking of built images
- **Snyk SAST** - Static application security testing
- **Coverity SAST** - Enterprise-grade static analysis
- **Shell-check SAST** - Shell script analysis
- **Unicode homoglyph detection** - Detects hidden unicode attacks
- **RPM signature verification** - Validates RPM package signatures
- **Deprecated base image check** - Flags outdated base images
- **Ecosystem certification preflight** - Red Hat certification checks

**However**, the repo itself has no security practices:
- No secret scanning (gitleaks, trufflehog)
- No CodeQL analysis
- No dependency scanning (no dependencies to scan)
- No branch protection enforcement visible

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **`.claude/` directory**: Not present
- **`.claude/rules/`**: Not present
- **Coverage**: No test type rules, no contribution guidelines
- **Quality**: N/A - no rules exist
- **Gaps**: Complete absence of agent guidance
- **Recommendation**: Create CLAUDE.md with:
  - Pipeline authoring patterns
  - Tekton PipelineRun conventions
  - Version bump procedures
  - Security task requirements
  - Image naming conventions

## Recommendations

### Priority 0 (Critical)

1. **Add PR-triggered CI workflow with YAML validation**
   - YAML lint for syntax
   - Tekton schema validation via kubeconform
   - Check that all pipelines include the required security tasks
   - Verify bundle SHA digests are valid

2. **Complete the replicator workflow folder list**
   - Add all 26 component folders to the `okc_folder` choice input
   - Consider generating the list dynamically from directory listing

3. **Fix the `codeflare-operator ` directory name**
   - Remove the trailing space to prevent script failures

### Priority 1 (High Value)

4. **Add drift detection between OKC and target repos**
   - Periodic workflow to compare `.tekton/` files in target repos against central definitions
   - Alert when divergence is detected

5. **Add Tekton task version consistency checks**
   - Ensure all pipelines use the same task bundle versions
   - Flag when different pipelines reference different SHA digests for the same task

6. **Create CLAUDE.md with pipeline authoring guidelines**
   - Document the standard pipeline structure
   - List required security tasks
   - Define naming conventions
   - Provide version bump procedures

7. **Add odh-dashboard pipeline definition**
   - The directory exists but is empty

### Priority 2 (Nice-to-Have)

8. **Add CODEOWNERS file** for pipeline review enforcement

9. **Add Renovate/Dependabot for Tekton task bundle updates**
   - Track upstream Konflux catalog releases
   - Auto-create PRs for task version bumps

10. **Create comprehensive documentation**
    - Pipeline onboarding process for new components
    - Architecture decision records
    - Troubleshooting guide

11. **Add agent rules for pipeline YAML authoring**
    - Generate rules with `/test-rules-generator`
    - Cover pipeline modification patterns
    - Include security task requirements

## Comparison to Gold Standards

| Practice | kc-rep | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|----------|--------|---------------------|-------------------|---------------|
| PR CI Checks | None | Multi-layer (lint, type, unit, e2e) | Image validation pipeline | Comprehensive test suite |
| YAML Validation | None | ESLint + TypeScript strict | N/A | CRD validation |
| Schema Validation | None | Contract tests | N/A | OpenAPI validation |
| Security Scanning | In pipeline defs (not self) | CodeQL + Snyk | Trivy + SBOM | Snyk + SAST |
| Coverage Tracking | None | Codecov enforced | N/A | Codecov enforced |
| Agent Rules | None | Comprehensive | Basic | Basic |
| Pre-commit Hooks | None | Husky + lint-staged | N/A | Pre-commit |
| Drift Detection | None | N/A | N/A | N/A |

**Key Observations:**
- kc-rep is a fundamentally different repo type (config-only vs. application code)
- The gold standard for config repos should be: schema validation, consistency checks, and drift detection
- The pipeline *contents* are gold-standard quality (9 security tasks), but the repo *process* around them is minimal

## File Paths Reference

| File | Purpose |
|------|---------|
| `.github/workflows/okc-replicator.yml` | Dispatch workflow to replicate Tekton files to target repos |
| `*/tekton/*-push.yaml` | Tekton PipelineRun definitions (30 files, 26 components) |
| `README.md` | Minimal 2-line description |
| `odh-dashboard/` | Empty directory (missing pipeline) |
| `codeflare-operator /` | Directory with trailing space in name |
| `data-science-pipelines/.tekton/` | 5 pipeline files (most of any component) |
| `kubeflow/.tekton/` | 2 pipeline files (notebook controllers) |
