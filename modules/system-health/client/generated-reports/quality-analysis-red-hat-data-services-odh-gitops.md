---
repository: "red-hat-data-services/odh-gitops"
overall_score: 6.9
scorecard:
  - dimension: "Unit Tests"
    score: 5.0
    status: "Helm snapshot tests cover chart rendering; no traditional unit tests (expected for GitOps repo)"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Tekton pipelines provision real OCP clusters for Kustomize and Helm validation; Kind-based E2E for XKS chart with multi-cloud matrix"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-triggered Kustomize validation and Helm linting; Tekton cluster validation on PRs; no Konflux image builds (infra repo)"
  - dimension: "Image Testing"
    score: 2.0
    status: "No container images built or tested (repo deploys third-party operators via OLM/Helm)"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "No coverage tooling — snapshot tests provide implicit coverage but no metrics tracked"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "Strong multi-layer CI: GitHub Actions (lint, snapshot, chart-testing), Tekton (real cluster), automated sync and bundle updates"
  - dimension: "Agent Rules"
    score: 7.0
    status: "CLAUDE.md and AGENTS.md present with clear conventions; .rules/ has 4 context-specific rules; .claude/rules/ is a symlink but no additional test rules"
critical_gaps:
  - title: "No security scanning (Trivy, Snyk, CodeQL, Gitleaks)"
    impact: "Vulnerabilities in Helm templates, hardcoded secrets, or insecure RBAC patterns may go undetected"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No coverage tracking or metrics"
    impact: "Cannot measure test coverage trends or enforce minimum thresholds for snapshot tests"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No pre-commit hooks"
    impact: "Developers may push YAML lint errors or broken Kustomize builds that could be caught locally"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "OCP 4.20 Tekton validation disabled"
    impact: "No CI coverage for upcoming OCP version; regressions could ship undetected"
    severity: "MEDIUM"
    effort: "1-2 hours (enable when ready)"
quick_wins:
  - title: "Add pre-commit hooks for YAML lint and kustomize build"
    effort: "2-3 hours"
    impact: "Catch formatting and build errors locally before pushing"
  - title: "Add Gitleaks secret scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Prevent accidental secret commits in manifests"
  - title: "Add kube-score or Polaris policy check to CI"
    effort: "2-4 hours"
    impact: "Enforce security best practices in generated manifests beyond kube-linter"
  - title: "Create .claude/rules/ test automation rules for snapshot and E2E patterns"
    effort: "2-3 hours"
    impact: "Guide AI agents to generate correct snapshot test configs and Tekton pipeline definitions"
recommendations:
  priority_0:
    - "Add Gitleaks or TruffleHog secret scanning to the PR workflow to prevent credential leaks"
    - "Enable OCP 4.20 Tekton validation pipeline when platform support is confirmed"
  priority_1:
    - "Add pre-commit hooks (.pre-commit-config.yaml) for yamllint, kustomize build, and helm lint"
    - "Create agent rules for snapshot test patterns and Helm chart contribution guidelines"
    - "Add RBAC audit checks to CI (verify no excessive ClusterRoleBindings beyond what kube-linter catches)"
  priority_2:
    - "Track snapshot test coverage metrics (e.g., count of value permutations tested vs. total)"
    - "Add Helm schema validation workflow (validate values.schema.json completeness)"
    - "Consider OPA/Gatekeeper policy tests for generated manifests"
---

# Quality Analysis: odh-gitops

## Executive Summary

- **Overall Score: 6.9/10**
- **Repository Type**: GitOps infrastructure repository (Kustomize + Helm charts for OCP/RHOAI operator deployment)
- **Primary Languages**: YAML, Shell scripts, Helm templates (Go templating)
- **Key Strengths**: Excellent real-cluster validation via Tekton pipelines, comprehensive Helm snapshot testing with 20 snapshot files across 6 charts, strong GitHub Actions CI for linting and chart testing, well-documented contribution guide
- **Critical Gaps**: No security scanning (Gitleaks, Trivy, SAST), no pre-commit hooks, no coverage tracking
- **Agent Rules Status**: Present and functional — CLAUDE.md, AGENTS.md with conventions, .rules/ directory with 4 contextual rules for different chart/Kustomize areas

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 5.0/10 | Helm snapshot tests serve as unit tests; 20 snapshot files covering multiple value permutations |
| Integration/E2E | 8.0/10 | Tekton pipelines provision ephemeral OCP clusters (4.19); Kind-based E2E for XKS with Azure/CoreWeave/AWS matrix |
| Build Integration | 7.0/10 | PR-triggered Kustomize/Helm validation; Tekton real-cluster validation; no image builds (infra repo) |
| Image Testing | 2.0/10 | N/A — repo does not build container images; deploys third-party operators |
| Coverage Tracking | 3.0/10 | No coverage tooling or metrics; snapshot tests provide implicit coverage only |
| CI/CD Automation | 8.5/10 | 5 GitHub workflows + 3 Tekton PipelineRuns; automated helm sync and bundle updates |
| Agent Rules | 7.0/10 | CLAUDE.md + AGENTS.md + 4 .rules files with path-scoped guidance |

## Critical Gaps

### 1. No Security Scanning
- **Impact**: Vulnerabilities in Helm templates, hardcoded secrets, insecure RBAC patterns, or dependency issues may go undetected
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: No Gitleaks, TruffleHog, CodeQL, Trivy, or any SAST/secret scanning integration. The kube-linter config does check for some security patterns (privileged-container, cluster-admin-role-binding, wildcard-in-rules, etc.) but misses secrets in YAML files and supply-chain vulnerabilities.

### 2. No Coverage Tracking
- **Impact**: Cannot measure or enforce test coverage quality; no visibility into which value permutations are tested
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: The 20 snapshot tests cover multiple chart configurations but there's no metric tracking the percentage of values.yaml keys exercised or kustomization paths validated.

### 3. No Pre-commit Hooks
- **Impact**: YAML lint errors, broken Kustomize builds, and formatting issues reach CI instead of being caught locally
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: The Makefile has `validate-yaml`, `validate-kustomize`, and `validate-lint` targets but no `.pre-commit-config.yaml` to run them automatically before commits.

### 4. OCP 4.20 Tekton Validation Disabled
- **Impact**: No CI coverage for the upcoming OCP version; regressions could ship undetected
- **Severity**: MEDIUM
- **Effort**: 1-2 hours (enable when ready)
- **Details**: `.tekton/cluster-validation-ocp-4.20.yaml` exists but all trigger annotations are commented out. Only OCP 4.19 validation is active.

## Quick Wins

### 1. Add Pre-commit Hooks (2-3 hours)
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
    rev: v8.18.4
    hooks:
      - id: gitleaks
```

### 2. Add Gitleaks Secret Scanning to PR Workflow (1-2 hours)
Add to `.github/workflows/testing.yaml`:
```yaml
      - name: Run Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 3. Add kube-score Policy Check (2-4 hours)
Complement kube-linter with kube-score for broader Kubernetes best-practice enforcement on rendered manifests.

### 4. Create Agent Test Rules (2-3 hours)
Add `.claude/rules/snapshot-tests.md` and `.claude/rules/tekton-pipelines.md` with patterns for generating correct snapshot configurations and pipeline definitions.

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (5 workflows + 3 Tekton PipelineRuns)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `testing.yaml` | PR + push to main | YAML lint, Kustomize build validation, kube-linter |
| `helm.yaml` | PR (charts/**) | Helm lint, chart-testing (ct), snapshot tests, docs check |
| `rhai-on-xks-chart-test.yaml` | PR (labeled) + push | Kind cluster E2E with Azure/CoreWeave/AWS matrix |
| `helm-sync.yml` | push to rhoai-* branches | Sync charts to RHOAI-Build-Config repo |
| `update-rhai-xks-bundle.yaml` | Daily cron + dispatch | Auto-update XKS bundle from rhods-operator |
| `cluster-validation-ocp-4.19` (Tekton) | PR (non-chart/script files) | Real OCP 4.19 cluster validation via EaaS |
| `cluster-validation-ocp-4.20` (Tekton) | Disabled | Prepared for OCP 4.20 validation |
| `helm-chart-validation-ocp-4.19` (Tekton) | PR (charts/rhai-on-openshift-chart/**) | Real OCP 4.19 Helm install + verify |

**Strengths**:
- Multi-layer validation: static (YAML lint) → structural (Kustomize build, Helm lint) → snapshot (chart-testing) → real cluster (Tekton EaaS)
- Concurrency control on helm-sync (`cancel-in-progress: false` to prevent commit races)
- Path-based filtering to avoid unnecessary CI runs
- Automated daily bundle updates with auto-PR creation and E2E label
- Pinned GitHub Action versions with commit SHAs

**Weaknesses**:
- No caching strategy in GitHub Actions workflows (tools re-downloaded each run)
- No CI test time tracking or performance monitoring
- OCP 4.20 validation disabled

### Test Coverage

**Snapshot Tests (20 files across 6 charts)**:

| Chart | Snapshots | Permutations Tested |
|-------|-----------|-------------------|
| rhai-on-openshift-chart | 9 | default, skip-crd-check (ODH/RHOAI), all-components-managed, helm-deps, inference-only, profile-with-customization, llm-d-wva, rhcl-config |
| rhai-on-xks-chart | 7 | azure-with-related-images, custom-namespace, coreweave, azure/coreweave/aws-with-pull-secret, aws |
| cert-manager-operator | 1 | default |
| gateway-api | 1 | default |
| lws-operator | 1 | default |
| sail-operator | 1 | default |

**E2E Tests**:
- XKS chart: Kind cluster deployment with 3-cloud-provider matrix (Azure, CoreWeave, AWS)
- OCP chart: Tekton-based ephemeral OCP cluster with full Helm install + DSC verification
- Kustomize: Tekton-based real OCP cluster with dependency application and verification

**No traditional unit tests** — appropriate for a GitOps/infrastructure repo where snapshot tests serve that purpose.

### Code Quality

**Linting**:
- **yamllint**: Configured via `.yamllint.yaml` with sensible defaults (2-space indent, 180 char lines, truthy allowed)
- **kube-linter**: Configured via `.kube-linter.yaml` with 7 security-focused built-in checks + 1 custom CEL check for system group bindings
- **chart-testing (ct)**: Configured via `.github/configs/ct.yaml` and `.github/configs/lintconf.yaml`
- **helm lint**: Run on all charts in CI
- **helm-docs**: Auto-generated API docs with freshness check in CI

**Missing**:
- No pre-commit hooks
- No static analysis (CodeQL, gosec for shell scripts)
- No dependency scanning

### Container Images

**N/A** — This repository does not build container images. It deploys third-party operators via OLM subscriptions and Helm charts. The image testing dimension is less relevant for this repo type, but the absence of image scanning on referenced images (in values.yaml, subscriptions) is a minor gap.

### Security

**Existing Security Practices**:
- kube-linter checks for privileged containers, cluster-admin role bindings, wildcard RBAC rules, unsafe proc mounts, unsafe sysctls, latest tag usage
- Custom CEL-based check for system group bindings in ClusterRoleBindings
- Pinned GitHub Action versions with commit SHAs (not just tags)
- `permissions: contents: read` on workflows (principle of least privilege)
- Secrets handled via GitHub Secrets (RHAI_PULL_SECRET, app tokens)

**Missing Security Practices**:
- No secret scanning (Gitleaks, TruffleHog)
- No SAST/CodeQL for shell scripts
- No dependency scanning on Helm chart dependencies
- No image digest pinning enforcement for referenced operator images
- No SBOM generation

### Agent Rules (Agentic Flow Quality)

**Status**: Present and functional

**Files**:
- `CLAUDE.md` (root): Concise project overview, build/test commands, conventions, architecture guide, key file references — delegates to AGENTS.md
- `AGENTS.md` (root): Comprehensive 4-file ruleset reference covering all repo areas
- `.rules/helm-dep-charts.md`: Path-scoped rules for `charts/dependencies/**` — chart structure, patterns, update process, validation commands
- `.rules/helm-ocp-chart.md`: Path-scoped rules for `charts/rhai-on-openshift-chart/**` — dependency templates, component patterns, helpers, profile creation, validation
- `.rules/helm-xks-chart.md`: Path-scoped rules for `charts/rhai-on-xks-chart/**` — chart structure, cloud provider patterns, helpers, image updates
- `.rules/kustomize.md`: Path-scoped rules for `components/**`, `dependencies/**`, `configurations/**` — operator addition pattern, conventions
- `.claude/rules/` → symlink to `../../.rules/` (same content)

**Coverage Assessment**:
| Area | Rule Exists | Quality |
|------|------------|---------|
| Helm dependency charts | Yes | Strong — structure, patterns, validation |
| Helm OCP chart | Yes | Strong — detailed helper reference, step-by-step |
| Helm XKS chart | Yes | Good — covers cloud providers, structure |
| Kustomize | Yes | Minimal — brief 4-line guide |
| Snapshot testing | No | Missing — no guidance on adding snapshot configs |
| Tekton pipelines | No | Missing — no guidance on pipeline modifications |
| CI workflows | No | Missing — no guidance on workflow changes |

**Gaps**:
- Kustomize rule is too terse (4 lines) compared to the detailed Helm rules
- No rules for snapshot test configuration patterns
- No rules for Tekton pipeline definition patterns
- No rules for CI workflow modifications
- No test-specific agent rules (how to write snapshot tests, what to validate)

## Recommendations

### Priority 0 (Critical)

1. **Add secret scanning** — Integrate Gitleaks into the PR workflow to prevent accidental credential commits in YAML manifests and values files. Effort: 1-2 hours.

2. **Enable OCP 4.20 Tekton validation** — Uncomment the trigger annotations in `.tekton/cluster-validation-ocp-4.20.yaml` when platform support is confirmed. Effort: <1 hour.

### Priority 1 (High Value)

3. **Add pre-commit hooks** — Create `.pre-commit-config.yaml` with yamllint, helm lint, and kustomize build checks. This catches issues before they reach CI. Effort: 2-3 hours.

4. **Expand Kustomize agent rules** — The current 4-line rule is insufficient. Add detailed patterns for operator component creation, dependency overlay structure, and configuration CR patterns similar to the comprehensive Helm rules. Effort: 2-3 hours.

5. **Add snapshot test agent rules** — Create `.rules/snapshot-testing.md` with guidance on adding new snapshot configs to `scripts/snapshot-config.yaml`, when to add new permutations, and how to structure test values. Effort: 1-2 hours.

6. **Add GitHub Actions caching** — Cache Go tools (kustomize, yq, kube-linter) and Python tools (yamllint) in CI workflows to reduce execution time. Effort: 2-3 hours.

### Priority 2 (Nice-to-Have)

7. **Add RBAC policy audit** — Beyond kube-linter, add OPA/Conftest policies to verify generated RBAC manifests follow least-privilege principles. Effort: 4-6 hours.

8. **Add Helm schema completeness check** — Validate that `values.schema.json` covers all keys defined in `values.yaml`. Effort: 3-4 hours.

9. **Track snapshot coverage metrics** — Create a simple script to count the percentage of values.yaml keys exercised by snapshot test permutations. Effort: 3-4 hours.

10. **Add image digest pinning enforcement** — Validate that operator images referenced in values.yaml and subscriptions use digest references rather than tags. Effort: 2-3 hours.

## Comparison to Gold Standards

| Practice | odh-gitops | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|----------|-----------|---------------------|-------------------|---------------|
| Unit/Snapshot Tests | 20 snapshot files, 6 charts | Comprehensive Jest + Cypress | N/A (image testing) | Go testing with coverage |
| Integration/E2E | Tekton real-cluster + Kind E2E | Multi-layer CI with contract tests | 5-layer image validation | Multi-version E2E |
| Coverage Tracking | None | Codecov integration | N/A | Codecov with enforcement |
| Security Scanning | kube-linter only | Trivy + CodeQL | Image scanning | CodeQL + dependency scanning |
| Pre-commit Hooks | None | Configured | N/A | Configured |
| Agent Rules | 4 rules (path-scoped) | Comprehensive test rules | N/A | N/A |
| CI Workflows | 5 GH Actions + 3 Tekton | 15+ workflows | Periodic builds | Multi-version CI |
| Linting | yamllint + kube-linter + helm lint + ct | ESLint + Prettier | yamllint | golangci-lint |

**Notes**: The odh-gitops repo's quality profile is appropriate for a GitOps/infrastructure repository. Traditional metrics like unit test coverage and image testing are less relevant. The repo excels at what matters most for GitOps: manifest validation, real-cluster integration testing, and Helm snapshot testing. The main gaps are in security scanning and developer tooling (pre-commit hooks).

## File Paths Reference

### CI/CD
- `.github/workflows/testing.yaml` — YAML lint, Kustomize build, kube-linter
- `.github/workflows/helm.yaml` — Helm lint, chart-testing, snapshot tests
- `.github/workflows/rhai-on-xks-chart-test.yaml` — XKS Kind E2E
- `.github/workflows/helm-sync.yml` — Chart sync to RHOAI-Build-Config
- `.github/workflows/update-rhai-xks-bundle.yaml` — Daily bundle update
- `.tekton/cluster-validation-ocp-4.19.yaml` — Tekton PR validation (active)
- `.tekton/cluster-validation-ocp-4.20.yaml` — Tekton PR validation (disabled)
- `.tekton/helm-chart-validation-ocp-4.19.yaml` — Tekton Helm validation
- `.tekton/pipelines/cluster-validation-pipeline.yaml` — Shared pipeline definition

### Testing
- `scripts/snapshot-config.yaml` — Snapshot test configuration (20 permutations)
- `scripts/chart-snapshots.sh` — Snapshot generation/testing script
- `scripts/verify-helm-chart.sh` — Helm install verification
- `scripts/verify-dependencies.sh` — Kustomize dependency verification
- `charts/*/test/snapshots/*.snap.yaml` — Snapshot test files

### Code Quality
- `.yamllint.yaml` — YAML linting configuration
- `.kube-linter.yaml` — Kubernetes manifest linting (7 checks + 1 custom)
- `.github/configs/ct.yaml` — Chart-testing configuration
- `.github/configs/lintconf.yaml` — Chart lint rules

### Agent Rules
- `CLAUDE.md` — Root project conventions and build commands
- `AGENTS.md` — Delegates to CLAUDE.md
- `.rules/helm-dep-charts.md` — Dependency chart patterns
- `.rules/helm-ocp-chart.md` — OCP chart patterns and helpers
- `.rules/helm-xks-chart.md` — XKS chart patterns
- `.rules/kustomize.md` — Kustomize conventions (minimal)
- `.claude/rules/` → symlink to `../../.rules/`

### Key Configuration
- `Makefile` — Build, validation, and deployment targets
- `kustomization.yaml` — Root kustomization
- `CONTRIBUTING.md` — Comprehensive contribution guide
- `.github/pull_request_template.md` — PR template with testing checklist
