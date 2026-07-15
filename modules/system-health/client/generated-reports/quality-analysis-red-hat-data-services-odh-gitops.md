---
repository: "red-hat-data-services/odh-gitops"
overall_score: 7.2
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Helm snapshot testing (27 snapshots) covers chart rendering; no traditional unit tests (config repo, not application code)"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Tekton pipelines provision real OCP clusters for validation; Kind-based E2E for XKS chart with multi-cloud matrix"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-time Kustomize build + kube-linter + Helm lint + chart-testing; Tekton cluster validation on PRs"
  - dimension: "Image Testing"
    score: 2.0
    status: "No container images built by this repo; no image scanning or runtime validation (not directly applicable)"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "No coverage metrics, no snapshot completeness tracking, no manifest diff analysis"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "Well-structured GitHub Actions + Tekton pipelines with concurrency control, automated bundle syncing, and PR-target gating"
  - dimension: "Agent Rules"
    score: 7.5
    status: "CLAUDE.md + AGENTS.md present; 4 path-scoped rules in .rules/ covering Helm and Kustomize patterns"
critical_gaps:
  - title: "No security scanning of generated Kubernetes manifests"
    impact: "RBAC escalation, privileged containers, or secret exposure in manifests not caught until cluster admission"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No OCP 4.20 cluster validation active"
    impact: "API deprecations or behavioral changes in next OCP release not caught pre-merge"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No coverage or completeness metrics for snapshot tests"
    impact: "New value combinations or chart features can ship without snapshot coverage, silent regressions"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "Missing Helm schema validation in CI"
    impact: "Invalid values.yaml combinations not caught until helm install fails on a real cluster"
    severity: "MEDIUM"
    effort: "3-4 hours"
quick_wins:
  - title: "Enable OCP 4.20 cluster validation pipeline"
    effort: "1-2 hours"
    impact: "Forward-compatibility testing for next OCP release (pipeline already exists, just commented out)"
  - title: "Add Kubescape or Checkov scanning to PR workflow"
    effort: "2-3 hours"
    impact: "Catch security misconfigurations in generated manifests before merge"
  - title: "Add helm template --validate against target API versions"
    effort: "1-2 hours"
    impact: "Catch deprecated API usage in chart templates automatically"
  - title: "Add agent rules for test creation patterns (snapshot tests, verification scripts)"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality for Helm chart and Kustomize changes"
recommendations:
  priority_0:
    - "Add security scanning (Kubescape/Checkov/Polaris) for rendered Kustomize and Helm manifests in PR workflow"
    - "Enable OCP 4.20 cluster validation pipeline (already scaffolded in .tekton/cluster-validation-ocp-4.20.yaml)"
  priority_1:
    - "Add snapshot completeness tracking — ensure every values.yaml key has at least one snapshot exercising it"
    - "Add helm template --validate to catch deprecated APIs before merge"
    - "Add test rules for AI agents covering snapshot test patterns, verification script patterns, and kustomization patterns"
  priority_2:
    - "Add automated RBAC diff analysis on PRs to flag privilege escalation"
    - "Add Helm values.schema.json validation tests for invalid value combinations"
    - "Consider adding a pre-commit hook for yamllint and kustomize build"
---

# Quality Analysis: odh-gitops

## Executive Summary

- **Overall Score: 7.2/10**
- **Repository Type**: GitOps configuration repository (Kustomize + Helm charts for OpenDataHub/RHOAI operator deployment on OpenShift and vanilla Kubernetes)
- **Primary Languages**: YAML (262 files), Shell (18 scripts), Helm templates (149 files)
- **Key Strengths**: Excellent E2E validation with real cluster provisioning via Tekton, comprehensive Helm snapshot testing (27 snapshots), well-structured multi-layer CI with GitHub Actions + Tekton, good agent rules coverage
- **Critical Gaps**: No security scanning of rendered manifests, OCP 4.20 validation disabled, no coverage/completeness metrics
- **Agent Rules Status**: Present and well-structured — AGENTS.md, CLAUDE.md, and 4 path-scoped rules in `.rules/`

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests (Snapshot Tests) | 7.0/10 | 27 Helm snapshots across 3 chart families; good scenario coverage |
| Integration/E2E | 8.5/10 | Tekton provisions real OCP clusters; Kind E2E for XKS with 3-cloud matrix |
| **Build Integration** | **8.0/10** | **PR-time kustomize build + kube-linter + Helm lint + chart-testing** |
| Image Testing | 2.0/10 | Not applicable — repo does not build container images |
| Coverage Tracking | 3.0/10 | No metrics for snapshot completeness or manifest diff coverage |
| CI/CD Automation | 8.5/10 | 5 GitHub Actions workflows + 3 Tekton pipelines with concurrency control |
| Agent Rules | 7.5/10 | AGENTS.md + 4 path-scoped rules; missing test creation guidance |

## Critical Gaps

### 1. No Security Scanning of Rendered Manifests
- **Impact**: RBAC escalation, privileged containers, or exposed secrets in generated manifests are only caught at cluster admission time or during manual review
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Detail**: kube-linter covers 7 security checks + 1 custom check, but lacks comprehensive policy scanning. Tools like Kubescape, Checkov, or Polaris would catch CIS benchmark violations, network policy gaps, and supply chain risks in rendered output
- **Recommendation**: Add a `security-scan` job to the `testing.yaml` workflow that runs `kustomize build | kubescape scan -` and `helm template | kubescape scan -`

### 2. OCP 4.20 Cluster Validation Disabled
- **Impact**: API deprecations or behavioral changes in the next OCP release are not caught until someone manually tests or the version reaches GA
- **Severity**: HIGH
- **Effort**: 2-3 hours (pipeline already exists, just commented out in `.tekton/cluster-validation-ocp-4.20.yaml`)
- **Detail**: The OCP 4.19 validation pipeline is active and working. The 4.20 pipeline is fully scaffolded but has its CEL expression and on-comment annotations commented out with "Disabled until OCP 4.20 support is confirmed"

### 3. No Snapshot Completeness Tracking
- **Impact**: New values.yaml keys or chart features can be added without corresponding snapshot tests, allowing silent regressions
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Detail**: The snapshot testing system is well-designed (data-driven via `scripts/snapshot-config.yaml`), but there's no tooling to verify that every top-level values.yaml key is exercised by at least one snapshot scenario

### 4. Missing Helm Schema Validation Tests
- **Impact**: Invalid values.yaml combinations (e.g., two cloud providers enabled simultaneously in XKS chart) are only caught by `validateCloudProvider` helper at install time, not in CI
- **Severity**: MEDIUM
- **Effort**: 3-4 hours
- **Detail**: `values.schema.json` exists for the OCP chart but is not systematically tested with intentionally invalid inputs to verify schema enforcement

## Quick Wins

### 1. Enable OCP 4.20 Cluster Validation (1-2 hours)
Uncomment the CEL expression and on-comment annotations in `.tekton/cluster-validation-ocp-4.20.yaml`. The pipeline infrastructure is already in place.

### 2. Add Kubescape/Checkov Security Scanning (2-3 hours)
Add to `.github/workflows/testing.yaml`:
```yaml
- name: Security scan rendered manifests
  run: |
    curl -s https://raw.githubusercontent.com/kubescape/kubescape/master/install.sh | bash
    make kustomize
    $(KUSTOMIZE) build . | kubescape scan framework nsa -
```

### 3. Add `helm template --validate` to CI (1-2 hours)
Add API version validation to the `helm.yaml` workflow to catch deprecated API usage:
```yaml
- name: Validate API versions
  run: |
    for chart in $(find charts -name Chart.yaml -exec dirname {} \;); do
      helm template "$chart" --api-versions "apps/v1" --validate 2>&1 || true
    done
```

### 4. Add Agent Rules for Test Creation (2-3 hours)
Create `.rules/testing.md` with patterns for:
- How to add snapshot test scenarios (update `scripts/snapshot-config.yaml`)
- How to update verification scripts (`scripts/verify-dependencies.sh`)
- How to add E2E test values (`charts/*/test/`)

## Detailed Findings

### CI/CD Pipeline Analysis

**Workflow Inventory** (5 GitHub Actions + 3 Tekton pipelines):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `testing.yaml` | PR + push to main | YAML lint, kustomize build, kube-linter |
| `helm.yaml` | PR (charts/** changed) | Helm lint, chart-testing, snapshot tests, docs check |
| `rhai-on-xks-chart-test.yaml` | PR (labeled) + push | Kind E2E with 3-cloud matrix (azure, coreweave, aws) |
| `helm-sync.yml` | Push to release branches | Sync charts to RHOAI-Build-Config repo |
| `update-rhai-xks-bundle.yaml` | Daily schedule + dispatch | Auto-update XKS chart from rhods-operator |
| Tekton: `cluster-validation-ocp-4.19` | PR (non-chart files) | Real OCP 4.19 cluster provisioning + kustomize apply + verify |
| Tekton: `cluster-validation-ocp-4.20` | DISABLED | Same as above for OCP 4.20 |
| Tekton: `helm-chart-validation-ocp-4.19` | PR (OCP chart changes) | Real OCP 4.19 cluster + helm install + verify |

**Strengths**:
- Excellent separation of concerns: GitHub Actions for lightweight static validation, Tekton for cluster-level integration
- Concurrency control on helm-sync (`cancel-in-progress: false` to avoid race conditions)
- PR-target workflow for XKS E2E with label gating (`run-xks-e2e`)
- Tekton uses EaaS (Environment as a Service) for ephemeral OCP clusters
- Automated daily bundle updates with PR creation

**Gaps**:
- No caching in GitHub Actions workflows (tools re-downloaded every run)
- OCP 4.20 pipeline disabled
- No scheduled/nightly full validation run across all charts

### Test Coverage Analysis

**Snapshot Tests (Primary Testing Mechanism)**:
- **27 snapshot test files** across 3 chart families
- OCP chart: 9 snapshots (default, skip-crd-check variants, all-components-managed, inference-only, profile-with-customization, llm-d-wva, rhcl-config)
- XKS chart: 14 snapshots (azure/coreweave/aws variants with pull-secret, allowed-routes, gateway-hostname, BYO issuer, custom-namespace)
- Dependency charts: 4 snapshots (cert-manager, gateway-api, lws-operator, sail-operator — default only)
- Driven by `scripts/snapshot-config.yaml` — declarative, easy to extend

**E2E Tests**:
- XKS chart: Kind cluster deployment with `make helm-install-verify-xks` across 3 cloud provider matrices
- OCP chart: Tekton pipeline provisions real OCP 4.19 cluster, installs helm chart, verifies DSC components
- Kustomize: Tekton pipeline applies all dependencies and runs `verify-dependencies.sh`

**Verification Scripts** (operational tests, not unit tests):
- `verify-dependencies.sh`: Checks all 13 operator subscriptions reach "Succeeded" phase with custom per-operator checks
- `verify-helm-chart.sh`: Validates helm release exists, DSC reaches "Ready" phase
- `wait-for-crds.sh`: Waits for 7 required CRDs with timeout

**Gaps**:
- No negative test cases (intentionally invalid values to verify schema rejection)
- No test for cross-dependency conflicts (e.g., enabling operators that conflict)
- Dependency chart snapshots only test default values (no variant coverage)

### Code Quality Tools

**Linting** (Good coverage for a config repo):
- `yamllint` v1.37.1 with custom config (180-char line length, truthy values allowed)
- `kube-linter` v0.7.6 with 7 built-in security checks + 1 custom CEL check (no-system-group-binding)
- Helm chart-testing (`ct lint`) with custom lint config
- `helm lint` for each chart

**Static Analysis**:
- Kustomize build validation (`make validate-kustomize`) ensures all 35 kustomization.yaml files render
- Helm `values.schema.json` provides structural validation
- Helm docs generation check ensures `api-docs.md` stays in sync

**Missing**:
- No pre-commit hooks (`.pre-commit-config.yaml` absent)
- No Trivy/Snyk/Kubescape for security policy scanning
- No CodeQL or SAST (not directly applicable — no application code)

### Container Image Testing

**Not Applicable**: This repository does not build container images. It configures operator deployments that reference images built elsewhere. However:
- Image references are managed through `values.yaml` and `make update-image`
- The `update-rhai-xks-bundle.yaml` workflow fetches image references from Build-Config repo
- No validation that referenced images actually exist or are accessible

### Security Practices

**Current**:
- kube-linter checks for privileged containers, privileged ports, cluster-admin bindings, wildcard RBAC, unsafe proc mount, unsafe sysctls, latest tag
- Custom CEL check prevents system group bindings in ClusterRoleBindings
- GitHub Actions use pinned action versions with commit SHAs (good practice)
- Tekton uses validated RHOAI_PULL_SECRET handling with temp files and cleanup

**Missing**:
- No comprehensive policy scanning (CIS, NSA, MITRE benchmarks)
- No RBAC diff analysis on PRs
- No secret detection (gitleaks, trufflehog)
- No dependency scanning (though minimal — mostly YAML with shell scripts)

### Agent Rules Assessment

**Status**: Present and well-structured

| File | Purpose | Quality |
|------|---------|---------|
| `CLAUDE.md` | Points to `AGENTS.md` | Minimal but functional |
| `AGENTS.md` | Build/test commands, conventions, architecture | Good — covers all key patterns |
| `.rules/helm-ocp-chart.md` | OCP chart patterns (path-scoped) | Excellent — helpers, validation, step-by-step |
| `.rules/helm-xks-chart.md` | XKS chart patterns (path-scoped) | Good — cloud provider patterns, image updates |
| `.rules/helm-dep-charts.md` | Dependency chart patterns (path-scoped) | Good — bundle extraction, snapshot testing |
| `.rules/kustomize.md` | Kustomize conventions (path-scoped) | Adequate but brief |

**Strengths**:
- Path-scoped rules using `paths:` frontmatter — rules activate only when editing relevant files
- AGENTS.md provides quick-reference build/test commands
- Helm rules include concrete examples of helpers, patterns, and validation steps

**Gaps**:
- No test creation rules (how to add snapshots, write verification scripts)
- Kustomize rule is very brief (4 lines) — could expand with patch patterns, namespace conventions
- No rule for Tekton pipeline modifications
- No rule for scripts/ directory conventions

## Recommendations

### Priority 0 (Critical)

1. **Add security scanning for rendered manifests** — Kubescape or Checkov scanning in the `testing.yaml` PR workflow. Catches RBAC escalation, privileged containers, and CIS benchmark violations before merge.

2. **Enable OCP 4.20 cluster validation** — Uncomment the CEL expression in `.tekton/cluster-validation-ocp-4.20.yaml`. Infrastructure is ready; just needs activation when OCP 4.20 is available for testing.

### Priority 1 (High Value)

3. **Add snapshot completeness tracking** — Script that compares all top-level values.yaml keys against snapshot configurations to identify untested value paths.

4. **Add `helm template --validate`** — Catch deprecated Kubernetes API usage in chart templates automatically during CI.

5. **Expand agent rules with test creation patterns** — Create `.rules/testing.md` covering: how to add snapshot scenarios, verification script patterns, and E2E test values.

6. **Add negative test cases for Helm schema** — Test that `values.schema.json` correctly rejects invalid configurations (e.g., two cloud providers enabled simultaneously).

### Priority 2 (Nice-to-Have)

7. **Add pre-commit hooks** — yamllint + kustomize build for local validation before push.

8. **Add RBAC diff analysis** — Automated comparison of RBAC rules in rendered manifests between base branch and PR.

9. **Add caching to GitHub Actions** — Cache kustomize, kube-linter, yamllint binaries to speed up CI runs.

10. **Expand dependency chart snapshot coverage** — Add variant snapshots for dependency charts (different namespace configurations, imagePullSecrets).

## Comparison to Gold Standards

| Dimension | odh-gitops | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Snapshot/Unit Tests | 27 snapshots, data-driven | Jest + RTL, high coverage | Multi-layer image tests | Go unit tests + coverage |
| E2E Testing | Real OCP clusters via Tekton | Cypress E2E suite | 5-layer validation | Multi-version E2E |
| Coverage Tracking | None | Codecov with enforcement | Per-image tracking | Codecov enforcement |
| Security Scanning | kube-linter (limited) | Snyk + CodeQL | Trivy scanning | Trivy + CodeQL |
| CI/CD Maturity | GitHub Actions + Tekton | GitHub Actions | GitHub Actions | GitHub Actions + Prow |
| Agent Rules | 4 path-scoped rules | Comprehensive rules | N/A | N/A |
| Build Integration | Kustomize + Helm validate | Docker build + test | Multi-arch builds | Go build + image test |

**Key Takeaway**: For a GitOps configuration repository, odh-gitops has **above-average** CI/CD practices. The Tekton-based real-cluster validation is particularly strong. The main gaps are in security scanning and coverage tracking — areas where application-focused repos like odh-dashboard and kserve have invested more.

## File Paths Reference

### CI/CD
- `.github/workflows/testing.yaml` — PR validation (YAML lint, kustomize, kube-linter)
- `.github/workflows/helm.yaml` — Helm chart validation (lint, chart-testing, snapshots)
- `.github/workflows/rhai-on-xks-chart-test.yaml` — XKS Kind E2E
- `.github/workflows/helm-sync.yml` — Release branch chart sync
- `.github/workflows/update-rhai-xks-bundle.yaml` — Daily bundle update
- `.tekton/cluster-validation-ocp-4.19.yaml` — OCP 4.19 cluster validation
- `.tekton/cluster-validation-ocp-4.20.yaml` — OCP 4.20 (disabled)
- `.tekton/helm-chart-validation-ocp-4.19.yaml` — OCP helm install validation
- `.tekton/pipelines/cluster-validation-pipeline.yaml` — Shared Tekton pipeline

### Testing
- `scripts/snapshot-config.yaml` — Snapshot test definitions
- `scripts/chart-snapshots.sh` — Snapshot test runner
- `charts/*/test/snapshots/*.snap.yaml` — 27 snapshot files
- `scripts/verify-dependencies.sh` — Operator verification
- `scripts/verify-helm-chart.sh` — Helm chart verification

### Quality Tools
- `.yamllint.yaml` — YAML lint configuration
- `.kube-linter.yaml` — Kubernetes manifest linting (7 checks + 1 custom)
- `.github/configs/ct.yaml` — Chart-testing configuration
- `.github/configs/lintconf.yaml` — Chart-testing lint rules
- `Makefile` — All validation targets

### Agent Rules
- `CLAUDE.md` — Root agent config (delegates to AGENTS.md)
- `AGENTS.md` — Build commands, conventions, architecture
- `.rules/helm-ocp-chart.md` — OCP chart patterns
- `.rules/helm-xks-chart.md` — XKS chart patterns
- `.rules/helm-dep-charts.md` — Dependency chart patterns
- `.rules/kustomize.md` — Kustomize conventions
