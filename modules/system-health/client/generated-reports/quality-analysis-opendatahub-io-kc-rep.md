---
repository: "opendatahub-io/kc-rep"
overall_score: 2.1
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No source code or test files — pure build-configuration repository"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests; no validation that Tekton pipelines render or execute correctly"
  - dimension: "Build Integration"
    score: 5.0
    status: "Tekton PipelineRun definitions for 26 components with consistent structure; no PR-time YAML validation or dry-run"
  - dimension: "Image Testing"
    score: 0.0
    status: "N/A — repo stores pipeline configs, not Dockerfiles or images"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No code to cover; no pipeline-config validation coverage"
  - dimension: "CI/CD Automation"
    score: 3.0
    status: "Single manual-dispatch workflow (okc-replicator); no PR-triggered validation, linting, or drift detection"
  - dimension: "Static Analysis"
    score: 1.0
    status: "No YAML linting, schema validation, Dependabot, or pre-commit hooks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No PR-time validation of Tekton YAML"
    impact: "Malformed or inconsistent pipeline definitions can be merged without detection, breaking Konflux builds downstream"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No automated drift detection between kc-rep and target repos"
    impact: "Tekton files in target repos can diverge from the central definitions without any alert"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No schema validation for PipelineRun resources"
    impact: "Invalid Tekton API fields, missing required params, or wrong task bundle SHAs are only caught at runtime in Konflux"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "okc-replicator workflow is manual-only"
    impact: "Version propagation depends entirely on human action; risk of missed or delayed updates across 26 components"
    severity: "MEDIUM"
    effort: "4-8 hours"
quick_wins:
  - title: "Add a PR-triggered YAML lint workflow using yamllint"
    effort: "1-2 hours"
    impact: "Catches syntax errors, indentation issues, and line-length violations before merge"
  - title: "Add Tekton schema validation with tektoncd/catlin or kubectl --dry-run"
    effort: "2-4 hours"
    impact: "Validates PipelineRun structure against the Tekton API schema"
  - title: "Enable Dependabot for GitHub Actions"
    effort: "1 hour"
    impact: "Keeps actions/checkout, getsentry/action-github-app-token, and other Actions up to date"
  - title: "Add a CLAUDE.md with contribution guidelines for pipeline definitions"
    effort: "1-2 hours"
    impact: "Guides AI agents and contributors on naming conventions, required fields, and testing expectations"
recommendations:
  priority_0:
    - "Add PR-triggered YAML validation workflow — yamllint + Tekton schema check on every PR"
    - "Implement consistency checks ensuring all 30 pipeline files follow the same task ordering, bundle versions, and parameter sets"
    - "Add automated drift detection comparing kc-rep definitions against .tekton/ in each target repo"
  priority_1:
    - "Convert okc-replicator to support scheduled runs or webhook-triggered execution for automated version propagation"
    - "Add a task-bundle version inventory and alerting when Konflux catalog bundles are outdated"
    - "Create CLAUDE.md/agent rules documenting pipeline structure conventions and validation requirements"
  priority_2:
    - "Add a cross-component dependency graph showing which target repos consume which pipeline definitions"
    - "Implement a changelog or release-notes generator for pipeline version bumps"
    - "Add CODEOWNERS file to enforce review for critical component pipelines"
---

# Quality Analysis: kc-rep (Konflux Central Repository)

## Executive Summary
- **Overall Score: 2.1/10**
- **Repository Type**: Build configuration / Infrastructure-as-Code (Tekton pipeline definitions)
- **Primary Language**: YAML (Tekton PipelineRun manifests)
- **Component**: Build and Release (RHOAIENG)
- **Tier**: Midstream

**kc-rep** is a centralized repository storing Konflux (Tekton) pipeline definitions for 26 OpenDataHub components across 30 PipelineRun YAML files (~18,060 lines). It serves as the single source of truth for build pipeline configurations that get replicated to target repositories via a manual GitHub Actions workflow.

Despite its critical role in the build infrastructure, the repository has virtually no quality safeguards: no YAML validation, no schema checking, no automated tests, no drift detection, and no PR-triggered CI. A single malformed pipeline definition merged here can break Konflux builds across multiple downstream components.

- **Key Strengths**: Consistent pipeline structure across all 30 files; standardized security scan integration (Clair, Snyk, Coverity, ClamAV); trusted artifact pattern; source image generation for 29/30 pipelines
- **Critical Gaps**: No PR validation, no schema checking, no automated drift detection, no agent rules
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 0.0/10 | 15% | No source code — N/A for a config repo |
| Integration/E2E | 0.0/10 | 20% | No pipeline validation or rendering tests |
| Build Integration | 5.0/10 | 15% | 30 well-structured Tekton PipelineRuns; no PR-time validation |
| Image Testing | 0.0/10 | 10% | N/A — stores pipeline configs, not images |
| Coverage Tracking | 0.0/10 | 10% | No coverage tooling |
| CI/CD Automation | 3.0/10 | 15% | Single manual-dispatch workflow; no PR CI |
| Static Analysis | 1.0/10 | 10% | No YAML lint, no schema validation, no Dependabot |
| Agent Rules | 0.0/10 | 5% | No CLAUDE.md, AGENTS.md, or .claude/ directory |
| **Overall** | **2.1/10** | | |

## Critical Gaps

### 1. No PR-time Validation of Tekton YAML
- **Severity**: HIGH
- **Impact**: Syntax errors, missing parameters, or invalid task references in PipelineRun definitions are only discovered when Konflux attempts to execute the pipeline in a target repo — potentially days after the change was merged
- **Effort**: 4-6 hours
- **Recommendation**: Add a GitHub Actions workflow triggered on PRs that runs `yamllint` and validates against the Tekton PipelineRun schema

### 2. No Drift Detection Between kc-rep and Target Repos
- **Severity**: HIGH
- **Impact**: The 26 target repositories may have locally-modified `.tekton/` files that diverge from the central definitions. Without periodic comparison, kc-rep's role as "single source of truth" erodes silently
- **Effort**: 8-12 hours
- **Recommendation**: Add a scheduled workflow that clones target repos and diffs their `.tekton/` against the corresponding kc-rep folder

### 3. No Schema Validation for PipelineRun Resources
- **Severity**: HIGH
- **Impact**: Invalid Tekton API usage (wrong `apiVersion`, malformed `params`, incorrect task bundle references) passes without detection. The 30 pipeline files reference ~15 different Tekton catalog task bundles with pinned SHA digests — a typo in any SHA silently breaks the pipeline
- **Effort**: 4-6 hours
- **Recommendation**: Use `tkn bundle list` or `kubectl apply --dry-run=server` to validate pipeline structure

### 4. Manual-Only Replication Workflow
- **Severity**: MEDIUM
- **Impact**: The `okc-replicator` workflow requires manual dispatch with 4 inputs (repository, branch, version, folder). Version propagation across 26 components depends entirely on human action, creating risk of missed or inconsistent updates
- **Effort**: 4-8 hours
- **Recommendation**: Add a matrix-based scheduled or tag-triggered mode to propagate versions automatically

## Quick Wins

### 1. Add YAML Lint Workflow (1-2 hours)
Add a PR-triggered GitHub Actions workflow:
```yaml
name: Lint Tekton YAML
on: [pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install yamllint
      - run: yamllint -c .yamllint.yml $(find . -name '*.yaml' -path '*/.tekton/*')
```

### 2. Enable Dependabot for GitHub Actions (1 hour)
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 3. Add Consistency Checker (2-4 hours)
A simple script comparing all 30 pipeline files for:
- Matching task bundle versions (SHAs should be identical across all pipelines)
- Consistent parameter sets
- Uniform security scan inclusion

### 4. Add CLAUDE.md (1-2 hours)
Document pipeline structure conventions, naming patterns, and required fields for AI agents and contributors.

## Detailed Findings

### Unit Tests
**Score: 0.0/10**

This repository contains no source code — it is purely YAML configuration for Tekton pipelines. There are no test files (`*_test.*`, `*.spec.*`) of any kind. While a score of 0 is technically correct, this dimension has limited applicability to a pure-config repository.

**Mitigation**: For config repos, "unit tests" can be interpreted as schema validation tests. See recommendations below.

### Integration/E2E Tests
**Score: 0.0/10**

No tests verify that:
- Pipeline YAML renders correctly into valid Tekton PipelineRun resources
- Task bundle SHA references resolve to existing images in quay.io
- The `okc-replicator` workflow correctly copies and transforms pipeline files
- Version tag substitution (`sed` replacement) produces valid output

### Build Integration
**Score: 5.0/10**

**Strengths:**
- **Consistent structure**: All 30 PipelineRun files follow an identical pattern: init → clone-repository → prefetch-dependencies → build-container → build-image-index → security scans → apply-tags → push-dockerfile
- **Security scans integrated**: Every pipeline includes clair-scan, sast-snyk-check, sast-coverity-check, clamav-scan, sast-shell-check, sast-unicode-check, ecosystem-cert-preflight-checks, rpms-signature-scan
- **Trusted artifacts**: All pipelines use the OCI trusted artifact pattern (`oci-ta` task variants)
- **Source images**: 29/30 pipelines generate source images for compliance

**Weaknesses:**
- All pipelines trigger only on `push` events to `konflux-poc` branch — no PR-triggered builds
- `cancel-in-progress` set to `false` on all pipelines, which could lead to resource contention
- No dry-run or validation of pipeline definitions before they are distributed

**Component Coverage (26 components, 30 pipelines):**

| Component | Pipeline Files |
|-----------|---------------|
| data-science-pipelines | 5 (api-server, driver, launcher, persistenceagent, scheduledworkflow) |
| kubeflow | 2 (notebook-controller, kf-notebook-controller) |
| kserve-* | 3 (agent, controller, router) |
| All others | 1 each |

### Image Testing
**Score: 0.0/10**

Not applicable — this repository does not contain Dockerfiles or build container images. It stores pipeline configurations that reference Dockerfiles in the target repositories.

### Coverage Tracking
**Score: 0.0/10**

No code coverage tooling. For a config repo, equivalent metrics would be:
- What percentage of pipeline files are validated by schema checks? (0%)
- What percentage of task bundle SHAs are verified as reachable? (0%)
- What percentage of target repos have been verified against kc-rep? (0%)

### CI/CD Automation
**Score: 3.0/10**

**Workflow Inventory:**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `okc-replicator.yml` | `workflow_dispatch` (manual) | Replicates Tekton files to target repos with version tag updates |

**Analysis:**
- Single workflow, manual-only dispatch
- No PR-triggered validation or linting
- No scheduled drift detection
- No automated version propagation
- The workflow uses `getsentry/action-github-app-token@v2` for cross-repo access — but the version is not pinned to a SHA
- Only 2 of 26 components are listed in the `okc_folder` choice options (data-science-pipelines, odh-model-controller) — the dropdown is incomplete
- `max-keep-runs: "3"` set on all pipeline definitions for Konflux retention

**Missing CI capabilities:**
- No `yamllint` or YAML validation
- No Tekton schema validation
- No consistency checking across pipeline files
- No task bundle version pinning verification
- No automated PR creation for version bumps

### Static Analysis
**Score: 1.0/10**

| Check | Status |
|-------|--------|
| YAML linting (yamllint) | Not configured |
| Tekton schema validation | Not configured |
| Pre-commit hooks | Not configured |
| Dependabot | Not configured |
| Renovate | Not configured |
| FIPS checks | N/A (config repo) |

The only "static" content is 30 structurally-similar PipelineRun YAML files. Without any validation, typos in ~18,000 lines of YAML across 30 files go undetected.

### Agent Rules
**Score: 0.0/10**

| File/Directory | Present? |
|----------------|----------|
| `CLAUDE.md` | No |
| `AGENTS.md` | No |
| `.claude/` directory | No |
| `.claude/rules/` | No |
| `.claude/skills/` | No |

**Impact**: Without agent rules, AI-assisted contributions to pipeline definitions have no guardrails for naming conventions, required fields, task ordering, or security scan inclusion.

## Recommendations

### Priority 0 (Critical)

1. **Add PR-triggered YAML validation workflow**
   - yamllint for syntax + style
   - Tekton schema validation (e.g., `tkn bundle list` or custom schema check)
   - Consistency checker ensuring all pipelines use the same task bundle versions
   - Effort: 4-6 hours

2. **Implement automated drift detection**
   - Scheduled workflow comparing kc-rep definitions against `.tekton/` in each target repo
   - Alert or auto-create issues when drift is detected
   - Effort: 8-12 hours

3. **Fix incomplete okc-replicator dropdown**
   - Currently only lists 2 of 26 components in the `okc_folder` choice
   - All 26 component folders should be listed as options
   - Effort: 1 hour

### Priority 1 (High Value)

4. **Add task bundle version management**
   - Centralized tracking of Konflux catalog task bundle SHAs
   - Automated PR creation when new bundle versions are available
   - Consistency enforcement (all 30 pipelines should use the same bundle version)
   - Effort: 8-12 hours

5. **Create CLAUDE.md and agent rules**
   - Document pipeline structure conventions
   - Define naming patterns (component names, pipeline names, namespace)
   - List required fields and security scan tasks
   - Effort: 2-3 hours

6. **Enable Dependabot for GitHub Actions**
   - Keep `actions/checkout`, `getsentry/action-github-app-token` up to date
   - Pin action versions to SHA digests
   - Effort: 1 hour

### Priority 2 (Nice-to-Have)

7. **Add CODEOWNERS file**
   - Require review from Build & Release team for pipeline changes
   - Component-specific owners for their pipeline definitions
   - Effort: 1-2 hours

8. **Generate component dependency graph**
   - Visual map of which target repos consume which pipeline definitions
   - Track which repos have been updated to the latest version
   - Effort: 4-6 hours

9. **Add automated changelog generation**
   - Track pipeline version bumps and task bundle updates
   - Generate release notes when versions are propagated
   - Effort: 4-6 hours

## Comparison to Gold Standards

| Capability | kc-rep | odh-dashboard | notebooks | kserve |
|------------|--------|---------------|-----------|--------|
| PR validation | None | Comprehensive CI | Multi-layer | Full CI suite |
| Schema validation | None | TypeScript strict | N/A | Go vet + lint |
| Config lint | None | ESLint + Prettier | yamllint | golangci-lint |
| Drift detection | None | N/A | N/A | N/A |
| Automated replication | Manual dispatch | N/A | N/A | N/A |
| Dependabot/Renovate | None | Configured | Configured | Configured |
| Agent rules | None | Comprehensive | Basic | None |
| Consistency checks | None | Contract tests | Image matrix | Multi-version |

## File Paths Reference

| Category | Path | Description |
|----------|------|-------------|
| CI Workflow | `.github/workflows/okc-replicator.yml` | Manual-dispatch Tekton file replicator |
| README | `README.md` | Minimal 2-line description |
| Tekton Pipelines | `{component}/.tekton/*-push.yaml` | 30 PipelineRun definitions across 26 component directories |

### Component Directory Listing

```
caikit-nlp/          kserve-agent/         modelmesh/              odh-model-controller/
codeflare-operator/  kserve-controller/    modelmesh-runtime-adapter/  odh-model-registry-operator/
data-science-pipelines/  kserve-router/    modelmesh-serving/      rest-proxy/
data-science-pipelines-operator/  kubeflow/  ml-metadata/          ta-lmes-driver/
fms-guardrails-hf-detector/  kuberay/      odh-dashboard/          training-operator/
fms-guardrails-orchestrator/  kueue/       odh-feast-operator/     trustyai-vllm-orchestrator-gateway/
fms-guardrails-regex-detector/             odh-feature-server/
```
