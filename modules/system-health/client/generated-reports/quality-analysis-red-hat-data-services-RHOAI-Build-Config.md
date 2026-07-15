---
repository: "red-hat-data-services/RHOAI-Build-Config"
overall_score: 4.2
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No application code or unit tests - config-only repository"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "Catalog validation via Python scripts in workflows but no formal test suites"
  - dimension: "Build Integration"
    score: 7.0
    status: "Robust Tekton + GitHub Actions pipeline with multi-arch builds and FBC image validation"
  - dimension: "Image Testing"
    score: 5.0
    status: "FBC image signature validation on push-to-stage but no PR-time image build testing"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No test coverage tracking - no code to cover"
  - dimension: "CI/CD Automation"
    score: 7.5
    status: "Well-structured 10-workflow pipeline covering bundle processing, FBC generation, staging, and nightly builds"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, .claude/ directory, or agent configuration present"
critical_gaps:
  - title: "No YAML schema validation on PR"
    impact: "Malformed YAML in config, catalog-patch, or bundle-patch can break downstream processors (bundle-processor.py, fbc-processor.py) after merge"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No PR-time build or integration test"
    impact: "No workflows trigger on pull_request except insta-merge bots - human contributors get zero CI feedback before merge"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "Insta-merge workflows bypass review for bot PRs"
    impact: "Bot-authored PRs are auto-merged based on title regex only; a malformed payload that matches the regex pattern passes unchecked"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No Tekton pipeline YAML validation"
    impact: "40 Tekton PipelineRun YAMLs are generated/modified by automation but never validated for schema correctness before commit"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No security scanning (Trivy, CodeQL, Gitleaks)"
    impact: "Dockerfiles reference external registry images without vulnerability scanning; secrets could leak via YAML config"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "Hardcoded credentials pattern in FBC workflow"
    impact: "Docker auth JSON is assembled inline via echo/base64 in process-fbc-fragment.yaml; fragile and potential leak surface"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add yamllint to PR workflow"
    effort: "1-2 hours"
    impact: "Catch YAML syntax errors before merge across all config, catalog-patch, and bundle-patch files"
  - title: "Add Tekton PipelineRun schema validation"
    effort: "2-3 hours"
    impact: "Validate all .tekton/*.yaml files against Tekton v1 PipelineRun schema"
  - title: "Add Gitleaks secret scanning"
    effort: "1 hour"
    impact: "Detect accidentally committed tokens, passwords, or registry credentials"
  - title: "Create CLAUDE.md with repo conventions"
    effort: "1-2 hours"
    impact: "Document repo structure, branching model, and automation conventions for AI-assisted contributions"
  - title: "Pin GitHub Actions by full SHA consistently"
    effort: "1 hour"
    impact: "Two workflows still use tag-based action references (upload-artifact@v4); pinning prevents supply chain attacks"
recommendations:
  priority_0:
    - "Add a PR-triggered workflow that validates YAML syntax (yamllint), Tekton schema, and Dockerfile linting for all changed files"
    - "Add content validation to insta-merge workflows - verify YAML parsability of changed bundle-patch/catalog-patch files before auto-merging"
    - "Add Gitleaks or TruffleHog scanning as a required PR check to prevent credential leaks"
  priority_1:
    - "Add catalog validator as a PR check - run catalog_validator.py on changed catalog files before merge"
    - "Replace inline Docker auth JSON construction with proper podman/skopeo login steps"
    - "Add Trivy scanning for Dockerfile base images to detect CVEs in ose-operator-registry-rhel9"
    - "Create CLAUDE.md documenting the branching model (rhoai-X.Y release branches), workflow conventions, and Tekton pipeline structure"
  priority_2:
    - "Add OPA/Conftest policies to validate Tekton PipelineRun resources against organizational standards"
    - "Implement diff-based catalog validation on PR to prevent catalog.yaml regressions"
    - "Add workflow test harness using act or similar tool for local workflow testing"
    - "Archive or remove .tekton-archive/ directory to reduce repository clutter"
---

# Quality Analysis: RHOAI-Build-Config

## Executive Summary

- **Overall Score: 4.2/10**
- **Repository Type**: Build configuration / release engineering repository (no application code)
- **Primary Purpose**: Manages RHOAI operator bundle processing, FBC (File-Based Catalog) fragment generation, and stage promotion across multiple RHOAI versions (2.13 through 3.5) and OCP versions (4.14 through 4.22)
- **Key Strengths**: Well-structured CI/CD automation with 10 GitHub Actions workflows, 40 Tekton PipelineRun definitions covering multi-architecture builds, FBC image signature validation, PCC (Pre-Computed Catalog) cache management, and automated Slack notifications
- **Critical Gaps**: Zero PR-time validation for human contributors, no YAML schema validation, no security scanning, no agent rules, bot PRs auto-merged with minimal content checking
- **Agent Rules Status**: Missing - No CLAUDE.md, .claude/ directory, or any agent configuration

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No application code or unit tests - config-only repo |
| Integration/E2E | 3/10 | Catalog validation runs in workflows but no formal test suites |
| **Build Integration** | **7/10** | **Robust Tekton + GHA pipeline with multi-arch builds and FBC validation** |
| Image Testing | 5/10 | FBC image signature validation on staging but no PR-time checks |
| Coverage Tracking | 0/10 | No coverage tracking (N/A for config repo) |
| CI/CD Automation | 7.5/10 | 10 well-structured workflows covering full release lifecycle |
| Agent Rules | 0/10 | No agent configuration present |

## Critical Gaps

### 1. No PR-Time Validation for Human Contributors
- **Impact**: The only PR-triggered workflows (`bundle-insta-merge.yaml`, `fbc-insta-merge.yaml`) are restricted to bot senders (`konflux-internal-p02[bot]`, `dchourasia`). Human contributors opening PRs receive zero CI feedback.
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: All substantive workflows (bundle processor, FBC processor, nightly triggers) are push-triggered, meaning validation only happens after merge. A malformed config.yaml or catalog-patch.yaml will break downstream automation.

### 2. Insta-Merge Bypasses Content Validation
- **Impact**: Bot PRs are auto-merged based on a title regex pattern (`^Update.*-$SUFFIX to [0-9a-z]{1,40}$`) and file path filter. The actual YAML content of the changed files is never validated before merge.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The `bundle-insta-merge.yaml` uses `pull_request_target` event (security-sensitive) and the `fbc-insta-merge.yaml` uses `pull_request`. Both merge after checking only: (a) sender login, (b) PR title pattern, (c) files changed count equals 1. No YAML parsing or schema validation occurs.

### 3. No YAML Schema Validation
- **Impact**: The repository is entirely YAML-driven (config.yaml, build-config.yaml, catalog-patch.yaml, bundle-patch.yaml, catalog.yaml, Tekton PipelineRuns). None of these files are validated for schema correctness on PR or push.
- **Severity**: HIGH
- **Effort**: 4-6 hours

### 4. No Security Scanning
- **Impact**: Dockerfiles reference Red Hat registry base images (`registry.redhat.io/openshift4/ose-operator-registry-rhel9:v4.X`) without vulnerability scanning. Secrets are handled inline in workflows.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours

### 5. Fragile Credentials Handling in Workflows
- **Impact**: `process-fbc-fragment.yaml` and `trigger-nightly-fbc-build.yaml` construct Docker auth JSON inline using `echo` and `base64`, writing to `${HOME}/.docker/config.json`. This is fragile and increases the risk of credential exposure in logs.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours

### 6. Missing Tekton Pipeline Validation
- **Impact**: 40 Tekton PipelineRun YAML files in `.tekton/` are generated by automation but never validated against the Tekton API schema. Malformed PipelineRuns fail silently in Konflux.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours

## Quick Wins

### 1. Add yamllint to PR Workflow (1-2 hours)
```yaml
name: PR Validation
on:
  pull_request:
    branches: ['main', 'rhoai-*']
jobs:
  yaml-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install yamllint
        run: pip install yamllint
      - name: Lint YAML files
        run: |
          yamllint -d relaxed config/ catalog/ bundle/ .tekton/
```

### 2. Add Gitleaks Secret Scanning (1 hour)
```yaml
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 3. Pin All GitHub Actions by SHA (1 hour)
- `actions/upload-artifact@v4` in `new-bundle-processor.yaml` should be pinned to full commit SHA like other actions already are
- `rtCamp/action-slack-notify@v2` in `push-to-stage.yaml` should also be pinned

### 4. Create CLAUDE.md (1-2 hours)
Document the repository's branching model, workflow conventions, and file structure so AI agents can contribute safely.

### 5. Add Tekton Schema Validation (2-3 hours)
```yaml
  tekton-validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate Tekton PipelineRuns
        run: |
          pip install check-jsonschema
          for f in .tekton/*.yaml; do
            check-jsonschema --schemafile tekton-pipeline-run-v1.json "$f"
          done
```

## Detailed Findings

### CI/CD Pipeline Analysis

**Workflow Inventory (10 workflows)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `bundle-insta-merge.yaml` | `pull_request_target` (bot only) | Auto-merge bundle nudge PRs from Konflux |
| `fbc-insta-merge.yaml` | `pull_request` (bot only) | Auto-merge FBC nudge PRs |
| `new-bundle-processor.yaml` | `push` + `workflow_dispatch` | Process operator bundle on release branches |
| `process-fbc-fragment.yaml` | `push` + `workflow_dispatch` | Generate FBC fragment catalogs |
| `process-operator-bundle.yaml` | `push` + `workflow_dispatch` | Process operator bundle (legacy parallel) |
| `push-to-stage.yaml` | `workflow_dispatch` only | Promote single release branch to stage |
| `multi-push-to-stage.yaml` | `workflow_dispatch` only | Batch promote multiple release branches to stage |
| `regen-pcc-cache.yaml` | `workflow_dispatch` only | Regenerate Pre-Computed Catalog cache |
| `trigger-nightly-bundle-build.yaml` | `push` + `workflow_dispatch` | Trigger nightly bundle build via Tekton |
| `trigger-nightly-fbc-build.yaml` | `push` + `workflow_dispatch` | Trigger nightly FBC build via Tekton |

**Strengths**:
- Well-organized separation of concerns across workflows
- Consistent use of `quay.io/rhoai/rhoai-task-toolset:latest` container image
- FBC image signature validation in push-to-stage (skopeo inspect + signature tag check)
- Catalog validation step (`catalog_validator.py`) runs before stage promotion
- Retry logic via `Wandalen/wretry.action` in insta-merge workflows (5 attempts)
- Slack notification integration on stage pushes
- Multi-architecture build support (x86_64, ppc64le, s390x, arm64) in Tekton pipelines

**Weaknesses**:
- No PR-triggered CI for human contributors
- No concurrency controls on any workflow
- Duplicate bundle processing logic between `new-bundle-processor.yaml` and `process-operator-bundle.yaml`
- No workflow-level error handling or failure notification (except push-to-stage)
- `yq` is downloaded and installed inline in 6 separate workflows rather than being baked into the toolset image

### Test Coverage

- **Unit Tests**: 0 - No application code exists in this repository
- **Integration Tests**: Indirect only - `catalog_validator.py` is invoked from `RHOAI-Konflux-Automation` repo during push-to-stage and regen-pcc-cache workflows
- **E2E Tests**: None - no end-to-end validation of the full bundle-to-catalog pipeline
- **Coverage Tracking**: N/A - no code to cover
- **Test-to-Code Ratio**: N/A

### Code Quality

- **Linting**: None - no `.golangci.yaml`, `.eslintrc`, `ruff.toml`, or any linter configuration
- **Pre-commit Hooks**: None - no `.pre-commit-config.yaml`
- **Static Analysis**: None - no CodeQL, gosec, or Semgrep
- **YAML Validation**: None - despite the repository being entirely YAML-driven
- **Dockerfile Linting**: None - 90+ Dockerfiles without hadolint or similar

### Container Image Testing

- **Dockerfiles**: 90+ Dockerfiles across `catalog/rhoai-*/v4.*/Dockerfile`, all following a consistent pattern:
  - Base: `registry.redhat.io/openshift4/ose-operator-registry-rhel9:v4.X`
  - Copy catalog, pre-populate serve cache with `opm serve --cache-only`
  - Rich build ARGs for component git URLs and commits (provenance tracking)
  - Proper Red Hat labeling conventions
- **Image Validation**: FBC image signature validation via skopeo in push-to-stage workflow (digest + `.sig` tag verification)
- **Multi-arch Support**: Tekton pipelines build for 4 architectures (x86_64, ppc64le, s390x, arm64)
- **Gaps**: No Trivy/Snyk scanning, no SBOM generation, no PR-time image build testing

### Security

- **Container Scanning**: None
- **Secret Detection**: None
- **Dependency Scanning**: None
- **GitHub Actions Pinning**: Mostly good (actions/checkout pinned to SHA) but `actions/upload-artifact@v4` and `rtCamp/action-slack-notify@v2` still use tag references
- **Sensitive Event Usage**: `bundle-insta-merge.yaml` uses `pull_request_target` which runs in the context of the base branch and has access to secrets - appropriate here since it only processes bot PRs, but no safeguards against a compromised bot account
- **Credential Handling**: Docker auth JSON constructed inline via echo/base64 in 2 workflows

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **Test automation rules**: None
- **Coverage**: No test types have rules (N/A)
- **Quality**: N/A
- **Gaps**: Complete absence of agent configuration. For a config-only repo, agent rules would help document:
  - YAML formatting conventions
  - Branching model (rhoai-X.Y release branches)
  - Tekton PipelineRun template patterns
  - Catalog/bundle patch YAML structure
  - Which files are auto-generated vs. human-edited
- **Recommendation**: Create a CLAUDE.md documenting the repo structure and conventions. Given this is a config repo, agent rules for YAML validation and Tekton pipeline management would be most valuable.

### Build Integration Analysis

**Strengths**:
- Tekton pipelines (40 active + 10 archived) define complete build pipelines for FBC fragments
- Pipelines include multi-arch support, source image builds, and proper tagging
- CEL expressions for pipeline triggering (`event == "push" && target_branch == "main" && "catalog/...".pathChanged()`)
- Pipeline references use git resolver pointing to centralized `konflux-central` repo
- Generous timeouts (8h pipeline, 6h tasks) prevent premature failures

**Weaknesses**:
- No PR-time Tekton pipeline simulation
- No validation that generated Tekton PipelineRun YAMLs are schema-valid
- Duplicate pipeline definitions across version/OCP matrix (could be templatized)
- No dry-run or preview mechanism for catalog changes before push-to-stage

## Recommendations

### Priority 0 (Critical)

1. **Add PR-triggered validation workflow** - Create a workflow that runs on all `pull_request` events (not just bot PRs) to validate:
   - YAML syntax (yamllint)
   - Tekton PipelineRun schema compliance
   - Dockerfile syntax (hadolint)
   - Config.yaml structural validation

2. **Add content validation to insta-merge** - Before auto-merging bot PRs, validate that the changed YAML files parse correctly and contain expected fields

3. **Add secret scanning** - Integrate Gitleaks as a required PR check to prevent accidental credential commits

### Priority 1 (High Value)

4. **Add catalog validation as PR check** - Port `catalog_validator.py` from `RHOAI-Konflux-Automation` as a PR-time check for catalog changes

5. **Replace inline Docker auth construction** - Use proper `podman login` / `skopeo login` or `docker/login-action` instead of manually building JSON

6. **Add Trivy scanning for base images** - Scan `ose-operator-registry-rhel9` base images for CVEs

7. **Create CLAUDE.md** - Document repo conventions for AI-assisted contributions

8. **Consolidate duplicate workflows** - `new-bundle-processor.yaml` and `process-operator-bundle.yaml` share 90% of their logic; consolidate or document which is canonical

### Priority 2 (Nice-to-Have)

9. **Add OPA/Conftest policies** for Tekton pipeline governance

10. **Implement PipelineRun templating** - Use a template engine to generate the 40+ near-identical Tekton PipelineRun YAMLs from a single source

11. **Add workflow testing** - Use `act` or a similar tool for local workflow validation

12. **Clean up .tekton-archive** - Remove or relocate archived pipeline definitions

## Comparison to Gold Standards

| Dimension | RHOAI-Build-Config | odh-dashboard | notebooks | Best Practice |
|-----------|-------------------|---------------|-----------|---------------|
| PR Validation | None for humans | Comprehensive | Multi-layer | Required checks before merge |
| YAML Validation | None | N/A (code repo) | N/A | yamllint + schema validation |
| Security Scanning | None | CodeQL + Trivy | Trivy | Trivy + Gitleaks minimum |
| Coverage Tracking | N/A | Codecov | N/A | Coverage on code repos |
| CI/CD Automation | 7.5/10 (push only) | 9/10 | 8/10 | PR + push + periodic |
| Image Testing | Signature only | N/A | 5-layer | Build + scan + runtime |
| Agent Rules | Missing | Comprehensive | Basic | CLAUDE.md + .claude/rules/ |
| Multi-arch | 4 architectures | N/A | Multiple | All target platforms |

## File Paths Reference

### CI/CD Workflows
- `.github/workflows/bundle-insta-merge.yaml` - Auto-merge bot bundle PRs
- `.github/workflows/fbc-insta-merge.yaml` - Auto-merge bot FBC PRs
- `.github/workflows/new-bundle-processor.yaml` - Bundle processing (primary)
- `.github/workflows/process-fbc-fragment.yaml` - FBC fragment generation
- `.github/workflows/process-operator-bundle.yaml` - Bundle processing (legacy)
- `.github/workflows/push-to-stage.yaml` - Single-branch stage promotion
- `.github/workflows/multi-push-to-stage.yaml` - Multi-branch batch stage promotion
- `.github/workflows/regen-pcc-cache.yaml` - PCC cache regeneration
- `.github/workflows/trigger-nightly-bundle-build.yaml` - Nightly bundle build trigger
- `.github/workflows/trigger-nightly-fbc-build.yaml` - Nightly FBC build trigger

### Build Configuration
- `config/config.yaml` - Global config (supported OCP versions, skip-bundles, etc.)
- `.tekton/*.yaml` - 40 Tekton PipelineRun definitions (per RHOAI version x OCP version)
- `.tekton-archive/*.yaml` - 10 archived Tekton PipelineRun definitions
- `catalog/rhoai-*/v4.*/Dockerfile` - 90+ FBC fragment Dockerfiles

### Catalog Data
- `catalog/rhoai-*/v4.*/rhods-operator/catalog.yaml` - OLM catalog files
- `pcc/catalog-v4.*.yaml` - Pre-Computed Catalog cache per OCP version
- `pcc/shipped_rhoai_versions*.txt` - Shipped version tracking

### Build Triggers
- `builds/force-trigger-*.txt` - Force build trigger files (timestamp-based)
