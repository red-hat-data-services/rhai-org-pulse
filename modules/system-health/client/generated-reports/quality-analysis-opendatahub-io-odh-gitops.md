---
repository: "opendatahub-io/odh-gitops"
overall_score: 7.2
scorecard:
  - dimension: "Unit Tests"
    score: 6.5
    status: "Helm snapshot tests (20 snapshots) serve as unit-equivalent tests; no traditional unit tests but appropriate for repo type"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Tekton pipelines provision ephemeral OCP clusters for real-cluster Kustomize and Helm validation; E2E for XKS chart on Kind with multi-cloud matrix"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time static validation (YAML lint, kustomize build, kube-linter) and Helm chart-testing; Tekton cluster validation on real OCP; no Konflux build simulation"
  - dimension: "Image Testing"
    score: 2.0
    status: "No container images built by this repo; not directly applicable but no image validation of referenced operator images"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "No coverage tracking or enforcement; snapshot tests cover multiple scenarios but no coverage metrics"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "Well-structured GitHub Actions + Tekton Pipelines as Code; automated bundle updates with daily schedule; multi-OCP-version testing"
  - dimension: "Agent Rules"
    score: 8.0
    status: "AGENTS.md, CLAUDE.md, and .claude/rules/ with symlink to .rules/ providing chart-specific and kustomize rules; PR template with testing checklist"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Cannot measure how much of the Kustomize/Helm template logic is exercised by snapshot tests"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No security scanning of referenced operator images"
    impact: "Vulnerability in a dependency operator image would not be caught before deployment"
    severity: "HIGH"
    effort: "6-8 hours"
  - title: "OCP 4.20 Tekton validation disabled"
    impact: "No automated cluster validation on latest OCP version; potential compatibility issues discovered late"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No pre-commit hooks"
    impact: "YAML lint and kustomize build errors caught only in CI, not locally before commit"
    severity: "LOW"
    effort: "1-2 hours"
quick_wins:
  - title: "Add pre-commit hooks for YAML lint and kustomize build"
    effort: "1-2 hours"
    impact: "Catch validation errors locally before pushing; faster feedback loop for contributors"
  - title: "Enable OCP 4.20 Tekton validation"
    effort: "1-2 hours"
    impact: "Verify compatibility with latest OCP version automatically on PRs"
  - title: "Add Helm template diff on PRs"
    effort: "2-3 hours"
    impact: "Show exactly what Kubernetes resources change in PR comments; aids code review"
  - title: "Add values.schema.json validation step to CI"
    effort: "1-2 hours"
    impact: "Enforce that all Helm values conform to the JSON Schema; catch typos in values files"
recommendations:
  priority_0:
    - "Add Trivy or Grype scanning for referenced operator images to detect vulnerabilities before deployment"
    - "Enable OCP 4.20 cluster validation Tekton pipeline once version is confirmed stable"
  priority_1:
    - "Add pre-commit hooks (.pre-commit-config.yaml) for yamllint, kube-linter, and kustomize build validation"
    - "Add Helm template diff comments on PRs using a GitHub Action (e.g., helm-diff or custom script)"
    - "Add snapshot coverage metrics - track which values.yaml paths are exercised by snapshot test configurations"
  priority_2:
    - "Add Conftest/OPA policy tests for Kustomize and Helm output to enforce organizational policies"
    - "Add chart upgrade testing (helm upgrade from previous version) to catch breaking changes"
    - "Add ShellCheck linting for all scripts/ files in CI"
---

# Quality Analysis: odh-gitops

## Executive Summary
- **Overall Score: 7.2/10**
- **Repository Type**: GitOps infrastructure repository (Kustomize layers + Helm charts for OCP/XKS operator deployment)
- **Primary Languages**: YAML, Bash, Helm templates (Go templating)
- **Key Strengths**: Excellent multi-layer CI with GitHub Actions + Tekton Pipelines as Code; comprehensive Helm snapshot testing (20 snapshots across 6 charts); real-cluster validation on ephemeral OCP clusters; strong agent rules with chart-specific guidance
- **Critical Gaps**: No security scanning of referenced operator images; no coverage tracking; OCP 4.20 validation disabled
- **Agent Rules Status**: Present and well-structured (AGENTS.md, CLAUDE.md, .rules/ with 4 rule files)

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.5/10 | Helm snapshot tests (20 snapshots) serve as unit-equivalent tests for template logic |
| Integration/E2E | 8.5/10 | Tekton pipelines on ephemeral OCP clusters + Kind-based E2E for XKS chart |
| Build Integration | 7.0/10 | PR-time static validation + Tekton cluster validation; no Konflux build simulation |
| Image Testing | 2.0/10 | No container images built; no validation of referenced operator images |
| Coverage Tracking | 3.0/10 | No coverage metrics or enforcement for snapshot/template testing |
| CI/CD Automation | 8.5/10 | Well-structured multi-tool CI pipeline with automated bundle updates |
| Agent Rules | 8.0/10 | Comprehensive AGENTS.md + chart-specific .rules/ files |

## Critical Gaps

### 1. No Security Scanning of Referenced Operator Images
- **Impact**: This repository deploys ~12 operator subscriptions referencing images from various registries (e.g., `registry.redhat.io`, `quay.io`). A vulnerability in any referenced image would not be detected until deployment.
- **Severity**: HIGH
- **Effort**: 6-8 hours
- **Recommendation**: Add a periodic CI job that extracts operator image references from Helm values and Kustomize manifests, then runs Trivy/Grype against them.

### 2. No Coverage Tracking or Enforcement
- **Impact**: While 20 snapshot tests cover multiple Helm value combinations, there's no measurement of which template paths, helper functions, or conditional branches are actually exercised. New template code could ship untested.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Recommendation**: Track which `values.yaml` paths are exercised by snapshot configurations; consider using `helm-unittest` for more targeted template logic testing.

### 3. OCP 4.20 Tekton Validation Disabled
- **Impact**: The `cluster-validation-ocp-4.20.yaml` PipelineRun has its trigger annotations commented out. PRs touching Kustomize manifests are only validated on OCP 4.19, meaning 4.20 compatibility issues could be missed.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours (uncomment once OCP 4.20 support confirmed)

### 4. No Pre-commit Hooks
- **Impact**: Contributors must push to CI to discover YAML lint, kustomize build, or kube-linter failures. Local validation requires manually running `make validate-all`.
- **Severity**: LOW
- **Effort**: 1-2 hours

## Quick Wins

### 1. Add Pre-commit Hooks (1-2 hours)
Create `.pre-commit-config.yaml` with hooks for yamllint, kube-linter, and kustomize build validation. This catches errors locally before pushing.

```yaml
repos:
  - repo: https://github.com/adrienverge/yamllint
    rev: v1.37.1
    hooks:
      - id: yamllint
        args: [-c, .yamllint.yaml]
  - repo: https://github.com/stackrox/kube-linter
    rev: v0.7.6
    hooks:
      - id: kube-linter
        args: [--config, .kube-linter.yaml]
```

### 2. Enable OCP 4.20 Tekton Validation (1-2 hours)
Uncomment the trigger annotations in `.tekton/cluster-validation-ocp-4.20.yaml` to enable automated cluster validation on OCP 4.20.

### 3. Add Helm Template Diff on PRs (2-3 hours)
Add a GitHub Action step that runs `helm template` on the base and head branches, then posts the diff as a PR comment. This makes it immediately visible what Kubernetes resources change.

### 4. Add ShellCheck to CI (1-2 hours)
The repository has 15 shell scripts in `scripts/` and `charts/*/scripts/`. Adding ShellCheck validation catches common bash pitfalls.

## Detailed Findings

### CI/CD Pipeline

**GitHub Actions Workflows (4 workflows)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `testing.yaml` (Validate GitOps Manifests) | PR + push to main | YAML lint, kustomize build, kube-linter |
| `helm.yaml` (Helm Chart Validation) | PR (charts/ paths) | Helm lint, chart-testing (ct), snapshot tests, helm-docs check |
| `rhai-on-xks-chart-test.yaml` (XKS E2E) | PR + push (label-gated) | Kind cluster E2E with multi-cloud matrix (azure, coreweave, aws) |
| `update-rhai-xks-bundle.yaml` | Daily schedule + manual | Automated bundle updates from rhods-operator, creates PR |

**Tekton Pipelines as Code (3 PipelineRuns)**:

| Pipeline | OCP Version | Validation Type | Status |
|----------|-------------|-----------------|--------|
| `cluster-validation-ocp-4.19.yaml` | 4.19 | Kustomize (apply + verify on real cluster) | Active |
| `helm-chart-validation-ocp-4.19.yaml` | 4.19 | Helm (install + verify on real cluster) | Active |
| `cluster-validation-ocp-4.20.yaml` | 4.20 | Kustomize | Disabled (trigger commented out) |

**Strengths**:
- Real-cluster validation using Konflux EaaS (Ephemeral as a Service) provisioning ephemeral HyperShift clusters
- Multi-cloud E2E matrix testing (Azure, CoreWeave, AWS) for XKS chart
- Automated bundle update pipeline with scheduled daily runs
- Path-based workflow filtering (only runs relevant tests for changed files)
- Concurrency control on bundle update workflow
- Pinned action versions with commit SHA references (security best practice)

**Gaps**:
- No caching in GitHub Actions workflows (tools downloaded fresh each run)
- OCP 4.20 validation disabled
- No test result reporting or notifications on failure

### Test Coverage

**Snapshot Testing (Primary Testing Strategy)**:
- 20 snapshot files across 6 charts
- `rhai-on-openshift-chart`: 9 snapshots covering default, skip-crd-check, all-components-managed, install-with-helm-dependencies, inference-only profile, profile-with-customization, enable-llm-d-wva, with-rhcl-config
- `rhai-on-xks-chart`: 7 snapshots covering all 3 cloud providers with/without pull secrets, custom namespace, related images
- `dependencies/*`: 4 snapshots (one per dependency chart)
- Custom snapshot tooling via `scripts/chart-snapshots.sh` with YAML config (`scripts/snapshot-config.yaml`)

**E2E Testing**:
- Kind-based E2E for XKS chart with Helm install + verify cycle
- Tekton-based real-cluster E2E for both Kustomize and Helm paths on OCP 4.19
- Verification scripts (`verify-dependencies.sh`, `verify-helm-chart.sh`) check operator subscription status, CSV phase, and CR readiness

**Gaps**:
- No `helm-unittest` or equivalent for testing individual template logic branches
- No negative tests (invalid values that should fail)
- No upgrade testing (helm upgrade from previous chart version)

### Code Quality

**Linting Configuration**:
- `.yamllint.yaml`: Comprehensive config with 2-space indent, 180-char line length, truthy values allowed
- `.kube-linter.yaml`: Security-focused with 7 built-in checks + 1 custom CEL check for system group bindings
- `.github/configs/ct.yaml`: Chart-testing config with schema validation enabled
- `.github/configs/lintconf.yaml`: Lint configuration for chart-testing

**Makefile**:
- Well-organized with help documentation and section headers
- Tool management with versioned downloads to `bin/`
- 20+ targets covering validation, installation, verification, and cleanup
- Cross-platform support (Linux/macOS with gsed detection)

**Gaps**:
- No ShellCheck for the 15 shell scripts
- No `.pre-commit-config.yaml` for local validation hooks
- No Markdown linting

### Container Images

This is a GitOps/infrastructure repository that does **not** build container images itself. It references operator images through:
- OLM Subscriptions (operator images managed by OLM)
- Helm values (image references in `values.yaml` for XKS chart)
- Automated image updates via `make update-image` from Build-Config repos

**Gap**: No scanning of referenced images for vulnerabilities. The `update-rhai-xks-bundle.yaml` workflow pulls images from rhods-operator but does not validate them.

### Security

**Strengths**:
- Pinned GitHub Action versions using commit SHAs (prevents supply chain attacks)
- `.kube-linter.yaml` includes security checks: privileged container, privileged ports, cluster-admin role binding, wildcard rules, unsafe proc mount, unsafe sysctls, latest tag
- Custom CEL check prevents ClusterRoleBindings targeting system groups
- PR template requires "installed on real cluster" testing verification
- Secrets handled via GitHub Actions secrets (RHAI_PULL_SECRET) with tempfile cleanup

**Gaps**:
- No SAST/CodeQL integration
- No dependency scanning (no `go.mod` or `package.json` to scan, but script dependencies could be audited)
- No Gitleaks or secret detection in CI
- No SBOM generation

### Agent Rules (Agentic Flow Quality)

**Status**: Present and well-structured

**Files**:
- `CLAUDE.md`: Points to `@AGENTS.md` (1 line)
- `AGENTS.md`: Comprehensive guide covering build/test commands, conventions (commit format, YAML indent, Kustomize/Helm patterns), architecture overview, and key file references
- `.claude/rules/` → symlink to `.rules/` containing 4 rule files:
  - `kustomize.md`: Kustomize contribution rules with path scoping
  - `helm-ocp-chart.md`: OCP Helm chart patterns, helper usage, validation commands
  - `helm-xks-chart.md`: XKS chart patterns, cloud provider pattern, image updates
  - `helm-dep-charts.md`: Dependency chart patterns, bundle update process

**Strengths**:
- Path-scoped rules (`paths: [...]` frontmatter) so rules activate only for relevant files
- Actionable guidance with specific file references and validation commands
- Architecture documentation in AGENTS.md with key examples for each pattern
- Contributing guide provides step-by-step instructions for adding dependencies, components, profiles

**Gaps**:
- No rules for test creation (e.g., when to add snapshot tests, how to write snapshot configurations)
- No rules for script development patterns
- CLAUDE.md is minimal (just an include) - could benefit from quick-reference commands

## Recommendations

### Priority 0 (Critical)

1. **Add security scanning for referenced operator images** - Create a CI job that extracts image references from Helm values and Kustomize manifests, then runs Trivy or Grype against them. This catches vulnerabilities before they reach clusters.

2. **Enable OCP 4.20 cluster validation** - Uncomment the Tekton trigger annotations in `.tekton/cluster-validation-ocp-4.20.yaml` to validate Kustomize manifests on the latest OCP version.

### Priority 1 (High Value)

3. **Add pre-commit hooks** - Create `.pre-commit-config.yaml` with yamllint, kube-linter, and kustomize build hooks. Reduces CI feedback loop time from minutes to seconds.

4. **Add Helm template diff on PRs** - Show exactly what Kubernetes resources change in PR comments. Critical for a GitOps repo where template changes have direct cluster impact.

5. **Add snapshot coverage tracking** - Document which `values.yaml` paths are covered by which snapshot configuration. Identify untested template branches.

6. **Add ShellCheck to CI** - Lint all 15 shell scripts in `scripts/` and `charts/*/scripts/` to catch common bash errors.

### Priority 2 (Nice-to-Have)

7. **Add Conftest/OPA policy tests** - Enforce organizational policies (namespace conventions, label requirements, resource limits) on Kustomize and Helm output.

8. **Add chart upgrade testing** - Test `helm upgrade` from the previous chart version to catch breaking changes in values structure.

9. **Add `helm-unittest` for template logic** - Test individual template helpers and conditional branches beyond what snapshot tests cover.

10. **Add Gitleaks secret detection** - Scan commits for accidentally committed secrets or credentials.

## Comparison to Gold Standards

| Dimension | odh-gitops | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | 6.5 - Snapshot tests | 9.0 - Jest/React Testing Lib | 7.0 - Pytest | 8.5 - Go test |
| Integration/E2E | 8.5 - Tekton + Kind | 9.0 - Cypress + contract | 8.0 - Multi-image | 9.0 - E2E suite |
| Build Integration | 7.0 - Kustomize + Helm validation | 8.0 - Webpack + Docker | 7.0 - Image builds | 7.0 - Ko builds |
| Image Testing | 2.0 - N/A (no images) | 7.0 - Image build in CI | 9.0 - 5-layer validation | 6.0 - Basic |
| Coverage Tracking | 3.0 - None | 8.0 - Codecov enforced | 5.0 - Basic | 8.0 - Coveralls |
| CI/CD Automation | 8.5 - Multi-tool pipeline | 9.0 - Comprehensive | 8.0 - Matrix builds | 8.5 - Prow |
| Agent Rules | 8.0 - Path-scoped rules | 9.0 - Multi-layer rules | 3.0 - Basic | 4.0 - Minimal |
| **Overall** | **7.2** | **8.6** | **6.7** | **7.3** |

**Note**: Scoring is adjusted for repository type. `odh-gitops` is a GitOps infrastructure repo, so image testing is weighted lower while CI/CD automation and manifest validation are weighted higher.

## File Paths Reference

### CI/CD
- `.github/workflows/testing.yaml` - GitOps manifest validation (YAML lint, kustomize build, kube-linter)
- `.github/workflows/helm.yaml` - Helm chart validation (lint, chart-testing, snapshot tests, docs check)
- `.github/workflows/rhai-on-xks-chart-test.yaml` - XKS chart E2E tests on Kind (multi-cloud matrix)
- `.github/workflows/update-rhai-xks-bundle.yaml` - Automated daily bundle updates
- `.tekton/cluster-validation-ocp-4.19.yaml` - Kustomize validation on ephemeral OCP 4.19
- `.tekton/helm-chart-validation-ocp-4.19.yaml` - Helm validation on ephemeral OCP 4.19
- `.tekton/cluster-validation-ocp-4.20.yaml` - Kustomize validation on OCP 4.20 (DISABLED)
- `.tekton/pipelines/cluster-validation-pipeline.yaml` - Shared Tekton pipeline definition

### Testing
- `scripts/chart-snapshots.sh` - Helm snapshot test runner
- `scripts/snapshot-config.yaml` - Snapshot test configurations (20 snapshots across 6 charts)
- `charts/*/test/snapshots/*.snap.yaml` - Snapshot files
- `scripts/verify-dependencies.sh` - Operator dependency verification
- `scripts/verify-helm-chart.sh` - Helm chart installation verification

### Code Quality
- `.yamllint.yaml` - YAML lint configuration
- `.kube-linter.yaml` - Kubernetes manifest linting (security-focused)
- `.github/configs/ct.yaml` - Chart-testing configuration
- `.github/configs/lintconf.yaml` - Chart-testing lint rules
- `Makefile` - Build/validate/install automation (20+ targets)

### Agent Rules
- `CLAUDE.md` - Points to AGENTS.md
- `AGENTS.md` - Comprehensive build/test/convention guide
- `.rules/kustomize.md` - Kustomize contribution rules
- `.rules/helm-ocp-chart.md` - OCP Helm chart patterns
- `.rules/helm-xks-chart.md` - XKS chart patterns
- `.rules/helm-dep-charts.md` - Dependency chart patterns
- `.github/pull_request_template.md` - PR checklist with testing requirements
- `CONTRIBUTING.md` - Step-by-step contribution guide
