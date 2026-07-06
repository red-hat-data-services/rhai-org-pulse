---
repository: "opendatahub-io/odh-gitops"
overall_score: 7.2
scorecard:
  - dimension: "Unit Tests"
    score: 6.5
    status: "Helm snapshot tests (27 snapshots across 6 charts) serve as unit-level regression tests; no traditional unit tests (Go/Python) since repo is config-only"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Excellent E2E coverage: Tekton pipelines provision real OCP clusters for Kustomize and Helm validation; GitHub Actions XKS E2E with Kind clusters across 3 cloud providers"
  - dimension: "Build Integration"
    score: 7.5
    status: "Strong PR-time static validation (YAML lint, kustomize build, kube-linter); Tekton cluster-validation runs on real OCP for Kustomize PRs; Helm chart validation with Kind E2E"
  - dimension: "Image Testing"
    score: 2.0
    status: "No container image builds or testing in this repo (config/GitOps only); no Dockerfile or Containerfile present"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "No coverage tracking tools (codecov, coveralls); snapshot test coverage is implicit but not measured or enforced"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "Well-structured CI: 4 GitHub Actions workflows + 3 Tekton PipelineRuns; automated bundle updates with daily schedule; PR summary reporting"
  - dimension: "Agent Rules"
    score: 8.0
    status: "Comprehensive AGENTS.md, CLAUDE.md, and 4 context-specific .rules/ files covering Kustomize and Helm chart patterns; no .claude/ directory but .rules/ is well-structured"
critical_gaps:
  - title: "No security scanning in CI"
    impact: "Kubernetes manifest vulnerabilities and misconfigurations beyond kube-linter checks not detected; no SAST/CodeQL, no secret detection (Gitleaks), no dependency scanning"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Cannot measure what percentage of Helm values/configurations are exercised by snapshot tests; no visibility into untested paths"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "OCP 4.20 cluster validation disabled"
    impact: "No forward-version testing against upcoming OCP releases; potential breakage discovered late"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No pre-commit hooks"
    impact: "Developers may push YAML formatting issues or invalid manifests that fail in CI but could have been caught locally"
    severity: "LOW"
    effort: "1-2 hours"
quick_wins:
  - title: "Add pre-commit hooks for YAML lint and kube-linter"
    effort: "1-2 hours"
    impact: "Catch formatting and best-practice issues locally before push, reducing CI failures"
  - title: "Add Gitleaks secret detection to PR workflow"
    effort: "1-2 hours"
    impact: "Prevent accidental commit of secrets (pull secrets, kubeconfig fragments) in manifest files"
  - title: "Enable OCP 4.20 Tekton validation"
    effort: "1-2 hours"
    impact: "Forward-compatibility testing against next OCP version"
  - title: "Add Kubescape or Polaris security scanning"
    effort: "2-3 hours"
    impact: "Deeper Kubernetes security posture analysis beyond kube-linter's focused checks"
recommendations:
  priority_0:
    - "Add security scanning (Gitleaks, Kubescape/Polaris) to PR workflows to catch secrets and broader Kubernetes security misconfigurations"
    - "Enable OCP 4.20 cluster validation pipeline to ensure forward compatibility"
  priority_1:
    - "Add pre-commit hooks (.pre-commit-config.yaml) with yamllint, kube-linter, and helm lint"
    - "Implement snapshot test coverage measurement to track what values/configurations are exercised"
    - "Add ShellCheck validation for the 18 shell scripts to catch bash issues"
  priority_2:
    - "Add Helm chart schema validation tests (validate values.schema.json against values.yaml)"
    - "Consider adding conftest/OPA policy tests for Kustomize outputs"
    - "Add chart upgrade/rollback testing to verify Helm release lifecycle"
---

# Quality Analysis: odh-gitops

## Executive Summary

- **Overall Score: 7.2/10**
- **Repository Type**: GitOps/Infrastructure configuration repository (Kustomize + Helm charts)
- **Primary Languages**: YAML (268 files), Shell (18 scripts)
- **Frameworks**: Kustomize, Helm, Tekton Pipelines, GitHub Actions
- **Key Strengths**: Excellent E2E testing with real OCP cluster provisioning, comprehensive Helm snapshot tests, strong agent rules documentation, well-organized CI/CD
- **Critical Gaps**: No security scanning, no coverage tracking, no pre-commit hooks
- **Agent Rules Status**: Present and comprehensive (AGENTS.md + 4 .rules/ files)

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.5/10 | Helm snapshot tests (27 snapshots) serve as unit-level regression; no traditional unit tests |
| Integration/E2E | 8.5/10 | Tekton pipelines + Kind E2E across 3 cloud providers on real OCP clusters |
| **Build Integration** | **7.5/10** | **Strong PR-time static validation + cluster-level validation via Tekton** |
| Image Testing | 2.0/10 | Not applicable - config-only repo with no container images |
| Coverage Tracking | 3.0/10 | No coverage measurement or enforcement |
| CI/CD Automation | 8.5/10 | 4 GH Actions workflows + 3 Tekton PipelineRuns; daily automated bundle updates |
| Agent Rules | 8.0/10 | AGENTS.md + CLAUDE.md + 4 .rules/ files with detailed patterns |

## Critical Gaps

### 1. No Security Scanning in CI
- **Impact**: Kubernetes manifests may contain security misconfigurations beyond kube-linter's 7 focused checks (privileged containers, cluster-admin bindings, latest tags, etc.). No secret detection means pull secrets or kubeconfig fragments could be accidentally committed.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The repo has kube-linter with custom CEL checks, but lacks:
  - Gitleaks/TruffleHog for secret detection
  - Kubescape/Polaris for broader K8s security posture analysis
  - CodeQL/SAST (not critical for config repos but good practice)
  - Dependency scanning for Helm chart dependencies

### 2. No Coverage Tracking or Enforcement
- **Impact**: 27 Helm snapshot tests exist, but there's no way to measure which values paths, configurations, and conditional branches are actually exercised. New features could ship without test coverage.
- **Severity**: MEDIUM
- **Effort**: 4-8 hours

### 3. OCP 4.20 Cluster Validation Disabled
- **Impact**: The `.tekton/cluster-validation-ocp-4.20.yaml` exists but its CEL trigger expressions are commented out. No forward-version compatibility testing against OCP 4.20.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours (uncomment and verify pipeline works)

### 4. No Pre-commit Hooks
- **Impact**: Contributors must rely on CI to catch YAML formatting, kustomize build failures, and lint issues. Local development loop is slower.
- **Severity**: LOW
- **Effort**: 1-2 hours

## Quick Wins

### 1. Add Pre-commit Hooks (1-2 hours)
Create `.pre-commit-config.yaml`:
```yaml
repos:
  - repo: https://github.com/adrienverge/yamllint
    rev: v1.37.1
    hooks:
      - id: yamllint
        args: [-c, .yamllint.yaml]
  - repo: https://github.com/gruntwork-io/pre-commit
    rev: v0.1.23
    hooks:
      - id: helmlint
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```

### 2. Add Gitleaks Secret Detection (1-2 hours)
Add to `.github/workflows/testing.yaml`:
```yaml
- name: Gitleaks secret detection
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 3. Enable OCP 4.20 Validation (1-2 hours)
Uncomment the CEL expression in `.tekton/cluster-validation-ocp-4.20.yaml` to enable forward-compatibility testing.

### 4. Add ShellCheck for Scripts (1-2 hours)
Add shell script linting to PR workflow:
```yaml
- name: ShellCheck
  uses: ludeeus/action-shellcheck@master
  with:
    scandir: './scripts'
```

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (4 GitHub Actions + 3 Tekton PipelineRuns)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `testing.yaml` | PR + push to main | YAML lint, kustomize build validation, kube-linter |
| `helm.yaml` | PR (charts/** paths) | Helm lint, chart-testing (ct), snapshot tests, docs freshness |
| `rhai-on-xks-chart-test.yaml` | PR (label-gated) + push | Kind cluster E2E for XKS chart across Azure/CoreWeave/AWS |
| `update-rhai-xks-bundle.yaml` | Daily schedule + dispatch | Automated bundle update from rhods-operator, creates PR |
| `cluster-validation-ocp-4.19.yaml` (Tekton) | PR (Kustomize files) | Provisions ephemeral OCP 4.19 HyperShift cluster, runs apply-and-verify |
| `cluster-validation-ocp-4.20.yaml` (Tekton) | **DISABLED** | Same as above for OCP 4.20 (commented out) |
| `helm-chart-validation-ocp-4.19.yaml` (Tekton) | PR (OCP chart files) | Provisions OCP 4.19, installs via Helm, verifies DSC readiness |

**Strengths**:
- Excellent path-scoped triggers (Kustomize changes trigger cluster validation, Helm changes trigger chart testing)
- Tekton pipelines use Konflux EaaS for real ephemeral OCP cluster provisioning
- Automated daily bundle updates with auto-created PRs including E2E labels
- Good validation summary generation with GitHub step summaries
- Pinned action versions with commit SHAs for security

**Gaps**:
- No concurrency control on PR workflows (testing.yaml and helm.yaml)
- No caching of tools (kustomize, kube-linter, yamllint downloaded every run)
- OCP 4.20 validation disabled

### Test Coverage

**Snapshot Tests (27 total)**:

| Chart | Snapshots | Test Variations |
|-------|-----------|-----------------|
| rhai-on-openshift-chart | 9 | default, skip-crd-check (odh/rhoai), all-components-managed, helm-deps, inference-only, profile-customization, llm-d-wva, rhcl-config |
| rhai-on-xks-chart | 14 | Azure/CoreWeave/AWS variants, pull-secret, gateway-hostname, TLS-disabled, BYO-issuer, namespaced-issuer, allowed-routes, related-images, custom-namespace |
| dependencies (4 charts) | 4 | Default snapshots for cert-manager, gateway-api, lws-operator, sail-operator |

**Testing Approach**:
- Snapshot testing via custom `chart-snapshots.sh` script (generate + compare)
- Helm version redaction in snapshots to avoid false diffs
- Centralized config in `scripts/snapshot-config.yaml`
- Real cluster E2E via Tekton and Kind clusters

**Strengths**:
- Good coverage of Helm chart variations (14 XKS snapshots covering all cloud providers + configuration combos)
- E2E validates real operator installation, CRD creation, DSC readiness
- Dependency verification script checks CSV phase + pod readiness for 12 operators
- Custom kube-linter CEL check for system group bindings

**Gaps**:
- No unit tests for shell scripts (18 scripts, some complex like `verify-dependencies.sh`)
- No negative testing (invalid values, missing required fields)
- No Helm upgrade/rollback testing
- No values.schema.json validation testing

### Code Quality

**Linting & Static Analysis**:
- yamllint with `.yamllint.yaml` (2-space indent, 180-char lines, truthy warnings)
- kube-linter with `.kube-linter.yaml` (7 security checks + custom CEL rule)
- Helm chart-testing (ct) with lint and schema validation
- Helm docs generation check (ensures api-docs.md is up-to-date)

**Strengths**:
- Custom kube-linter configuration focused on security-critical checks
- CEL-based custom check for system group bindings in ClusterRoleBindings
- Chart-testing integration with dedicated lint configuration
- JSON Schema validation for both Helm charts (824 + 407 lines)

**Gaps**:
- No ShellCheck for 18 shell scripts
- No pre-commit hooks
- kube-linter's `validate-lint` target uses `continue-on-error: true` in CI (non-blocking)
- yamllint excludes charts/, .github/, scripts/ directories

### Container Images

**Not Applicable**: This is a GitOps/configuration repository. It does not build or ship container images. It references images in Helm values but does not build them. Score reflects this reality - the dimension is weighted lower for this repo type.

### Security

**Current Practices**:
- Pinned GitHub Action versions using commit SHAs (not tags)
- kube-linter checks: privileged-container, privileged-ports, cluster-admin-role-binding, wildcard-in-rules, unsafe-proc-mount, unsafe-sysctls, latest-tag
- Custom CEL rule blocking system group bindings
- Permissions scoped to `contents: read` where applicable
- PR template requires Jira link and cluster testing confirmation

**Gaps**:
- No secret detection (Gitleaks/TruffleHog)
- No broader Kubernetes security posture scanning (Kubescape/Polaris/Datree)
- No dependency scanning for Helm chart dependencies
- No SBOM generation for configuration artifacts

### Agent Rules (Agentic Flow Quality)

**Status**: Present and comprehensive

**Files**:
- `AGENTS.md` - Detailed repo architecture, build/test commands, conventions, key examples (47 lines)
- `CLAUDE.md` - Points to AGENTS.md (1 line)
- `.rules/kustomize.md` - Path-scoped rules for Kustomize components/dependencies/configurations
- `.rules/helm-ocp-chart.md` - Detailed OCP Helm chart patterns (helpers, templates, profiles, validation)
- `.rules/helm-xks-chart.md` - XKS chart structure, cloud provider patterns, image updates
- `.rules/helm-dep-charts.md` - Dependency chart patterns (bundle extraction, CRDs, snapshots)

**Quality Assessment**:
- Rules are path-scoped with `paths:` frontmatter for context-sensitive activation
- Include specific file examples to follow ("Follow `templates/dependencies/cert-manager/operator.yaml` pattern")
- Validation commands provided for each area
- Key helper functions documented with purpose

**Gaps**:
- No `.claude/` directory structure (uses `.rules/` instead - acceptable)
- No testing-specific rules (e.g., how to write new snapshot test cases)
- No troubleshooting rules for common CI failures
- No rules for Tekton pipeline modifications

## Recommendations

### Priority 0 (Critical)

1. **Add security scanning to PR workflows**
   - Add Gitleaks for secret detection
   - Add Kubescape or Polaris for Kubernetes security posture analysis
   - These complement the existing kube-linter checks which cover only 7 specific patterns

2. **Enable OCP 4.20 cluster validation**
   - Uncomment the CEL trigger in `.tekton/cluster-validation-ocp-4.20.yaml`
   - Ensures forward compatibility as OCP 4.20 GA approaches

### Priority 1 (High Value)

3. **Add pre-commit hooks**
   - Configure `.pre-commit-config.yaml` with yamllint, helm lint, gitleaks
   - Catch issues before push, reducing CI feedback loop

4. **Add ShellCheck validation**
   - 18 shell scripts with no static analysis
   - Several complex scripts (verify-dependencies.sh: 243 lines, chart-snapshots.sh: 312 lines)
   - Add as GitHub Actions step or pre-commit hook

5. **Implement snapshot coverage measurement**
   - Track which values.yaml paths are exercised by snapshot tests
   - Identify uncovered conditional branches in Helm templates
   - Consider `helm template --debug` output analysis

6. **Add caching to GitHub Actions workflows**
   - Cache tools (kustomize, kube-linter, yamllint, yq) across runs
   - Use `actions/cache` with bin/ directory as key

### Priority 2 (Nice-to-Have)

7. **Add concurrency control to PR workflows**
   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: true
   ```

8. **Add negative testing for Helm charts**
   - Test invalid values combinations (e.g., multiple cloud providers enabled)
   - Validate error messages from `validateCloudProvider` helper
   - Test with missing required values

9. **Add Helm upgrade testing**
   - Verify chart can be upgraded from previous version
   - Test rollback scenarios
   - Important for production Helm releases

10. **Add agent rules for testing patterns**
    - Document how to add new snapshot test cases
    - Include Tekton pipeline modification guidance
    - Add troubleshooting guidance for common CI failures

11. **Consider conftest/OPA policy tests**
    - Add policy-as-code tests for kustomize build outputs
    - Enforce organizational policies (naming conventions, label requirements)

## Comparison to Gold Standards

| Dimension | odh-gitops | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | 6.5 (snapshot tests) | 9.0 (Jest + RTL) | 7.0 (pytest) | 9.0 (Go testing) |
| Integration/E2E | 8.5 (real OCP clusters) | 8.5 (Cypress + contract) | 8.0 (multi-image E2E) | 9.0 (envtest + Kind) |
| Build Integration | 7.5 (Tekton + GHA) | 7.0 (webpack + build) | 6.0 (image builds) | 7.0 (make + Go build) |
| Image Testing | 2.0 (N/A - config repo) | 5.0 (basic) | 9.0 (5-layer validation) | 6.0 (basic) |
| Coverage Tracking | 3.0 (none) | 8.0 (codecov + Jest) | 5.0 (partial) | 8.0 (codecov enforced) |
| CI/CD Automation | 8.5 (excellent) | 9.0 (comprehensive) | 7.0 (good) | 8.5 (strong) |
| Agent Rules | 8.0 (detailed .rules/) | 9.0 (gold standard) | 3.0 (minimal) | 4.0 (basic) |
| **Overall** | **7.2** | **8.5** | **7.0** | **8.0** |

**Note**: Image Testing is weighted lower for odh-gitops since it's a configuration repository, not a code repository that builds container images. The effective weighted score accounts for this.

## File Paths Reference

### CI/CD
- `.github/workflows/testing.yaml` - Kustomize validation (YAML lint, kustomize build, kube-linter)
- `.github/workflows/helm.yaml` - Helm chart validation (lint, chart-testing, snapshots, docs)
- `.github/workflows/rhai-on-xks-chart-test.yaml` - XKS chart E2E with Kind (Azure/CoreWeave/AWS)
- `.github/workflows/update-rhai-xks-bundle.yaml` - Daily automated bundle update
- `.tekton/cluster-validation-ocp-4.19.yaml` - Tekton: Kustomize validation on OCP 4.19
- `.tekton/cluster-validation-ocp-4.20.yaml` - Tekton: Kustomize validation on OCP 4.20 (DISABLED)
- `.tekton/helm-chart-validation-ocp-4.19.yaml` - Tekton: Helm chart validation on OCP 4.19
- `.tekton/pipelines/cluster-validation-pipeline.yaml` - Shared Tekton pipeline definition

### Testing
- `scripts/chart-snapshots.sh` - Helm snapshot test runner (generate + compare)
- `scripts/snapshot-config.yaml` - Snapshot test configuration (27 test cases)
- `charts/*/test/snapshots/*.snap.yaml` - Snapshot test files
- `scripts/verify-dependencies.sh` - Operator dependency verification (12 operators)
- `scripts/verify-helm-chart.sh` - Helm chart installation verification

### Code Quality
- `.yamllint.yaml` - YAML lint configuration
- `.kube-linter.yaml` - Kubernetes manifest linting (7 checks + custom CEL)
- `.github/configs/ct.yaml` - Chart-testing configuration
- `.github/configs/lintconf.yaml` - Chart-testing YAML lint rules
- `charts/rhai-on-openshift-chart/values.schema.json` - OCP chart JSON Schema (824 lines)
- `charts/rhai-on-xks-chart/values.schema.json` - XKS chart JSON Schema (407 lines)

### Agent Rules
- `AGENTS.md` - Repository architecture, commands, conventions
- `CLAUDE.md` - Points to AGENTS.md
- `.rules/kustomize.md` - Kustomize patterns (path-scoped: components/dependencies/configurations)
- `.rules/helm-ocp-chart.md` - OCP Helm chart patterns
- `.rules/helm-xks-chart.md` - XKS Helm chart patterns
- `.rules/helm-dep-charts.md` - Dependency chart patterns

### Key Scripts
- `scripts/wait-for-crds.sh` - CRD readiness polling
- `scripts/install-catalog-source.sh` - OLM CatalogSource setup
- `scripts/prepare-authorino-tls.sh` - Authorino TLS configuration
- `scripts/extract-olm-bundle.sh` - OLM bundle extraction utility
