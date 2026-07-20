---
repository: "opendatahub-io/odh-gitops"
overall_score: 6.6
scorecard:
  - dimension: "Unit Tests"
    score: 6.0
    status: "Helm snapshot tests cover 30+ configurations across 7 charts, but no shell script testing"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Kind cluster E2E with multi-provider matrix plus Tekton-based OCP cluster validation via EaaS"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-time YAML lint, Kustomize build, kube-linter, Helm lint, chart-testing, and real cluster validation"
  - dimension: "Image Testing"
    score: 5.0
    status: "Not applicable — GitOps/Helm chart repo with no container image builds"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "No coverage tracking; snapshot tests provide change-level coverage but no metrics"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "4 GitHub Actions workflows + 3 Tekton pipelines with path-based triggers and scheduled automation"
  - dimension: "Static Analysis"
    score: 6.0
    status: "yamllint, kube-linter, helm lint, chart-testing configured; missing Dependabot and pre-commit hooks"
  - dimension: "Agent Rules"
    score: 8.0
    status: "Comprehensive AGENTS.md with 4 path-scoped rules covering all chart and Kustomize patterns"
critical_gaps:
  - title: "No Dependabot or Renovate for dependency alerts"
    impact: "Tool version pins (kustomize, kube-linter, yamllint, yq, helm-docs) can become stale with known vulnerabilities"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No shell script testing or linting"
    impact: "11 shell scripts in scripts/ and charts/ handle critical operations (verify-dependencies, verify-helm-chart, chart-snapshots) with no automated tests or shellcheck"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No coverage tracking for snapshot tests"
    impact: "No visibility into which Helm template paths or Kustomize overlays are exercised by existing tests"
    severity: "LOW"
    effort: "4-6 hours"
  - title: "OCP 4.20 Tekton validation disabled"
    impact: "Forward compatibility with next OCP version is not being validated on PRs"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Enable Dependabot for GitHub Actions and Go modules"
    effort: "1-2 hours"
    impact: "Automated security and version updates for CI dependencies and tooling"
  - title: "Add shellcheck to CI validation"
    effort: "2-3 hours"
    impact: "Catch shell script bugs before they reach production verification scripts"
  - title: "Add pre-commit hooks for yamllint and shellcheck"
    effort: "1-2 hours"
    impact: "Shift-left lint failures to developer workstations"
recommendations:
  priority_0:
    - "Enable Dependabot for github-actions and gomod ecosystems"
    - "Add shellcheck validation for all scripts in CI"
  priority_1:
    - "Enable OCP 4.20 Tekton validation pipeline when version is confirmed"
    - "Add negative snapshot tests (invalid values, missing required fields) to catch schema validation gaps"
    - "Add pre-commit hooks (yamllint, shellcheck, helm-docs) via .pre-commit-config.yaml"
  priority_2:
    - "Consider adding bats-core tests for critical shell scripts (verify-dependencies.sh, verify-helm-chart.sh)"
    - "Add Helm schema validation tests for values.schema.json completeness"
    - "Track snapshot coverage metrics (how many value combinations are tested vs total possible)"
---

# Quality Analysis: odh-gitops

## Executive Summary

- **Overall Score: 6.6/10**
- **Repository Type**: GitOps/Helm charts repository (YAML, Shell, Helm templates)
- **Jira Component**: AI Core Platform (RHOAIENG)
- **Tier**: Midstream

**Key Strengths**: Excellent E2E testing with real cluster validation (both Kind and OCP via EaaS), comprehensive Helm snapshot testing across 30+ configurations, well-structured CI with both GitHub Actions and Tekton pipelines, and strong agent rules with path-scoped guidance.

**Critical Gaps**: No dependency alert configuration (Dependabot/Renovate), no shell script testing or linting (shellcheck), and no coverage tracking. Image testing is N/A for this repo type.

**Agent Rules Status**: Present and comprehensive — AGENTS.md with build commands and conventions, plus 4 path-scoped `.rules/` files covering Helm and Kustomize patterns.

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 6.0/10 | 15% | Helm snapshot tests cover 30+ configurations across 7 charts, but no shell script testing |
| Integration/E2E | 8.0/10 | 20% | Kind cluster E2E with multi-provider matrix plus Tekton-based OCP cluster validation via EaaS |
| Build Integration | 8.0/10 | 15% | PR-time YAML lint, Kustomize build, kube-linter, Helm lint, chart-testing, and real cluster validation |
| Image Testing | 5.0/10 | 10% | Not applicable — GitOps/Helm chart repo with no container image builds |
| Coverage Tracking | 2.0/10 | 10% | No coverage tracking; snapshot tests provide change-level coverage but no metrics |
| CI/CD Automation | 8.0/10 | 15% | 4 GitHub Actions workflows + 3 Tekton pipelines with path-based triggers and scheduled automation |
| Static Analysis | 6.0/10 | 10% | yamllint, kube-linter, helm lint, chart-testing configured; missing Dependabot and pre-commit hooks |
| Agent Rules | 8.0/10 | 5% | Comprehensive AGENTS.md with 4 path-scoped rules covering all chart and Kustomize patterns |

## Critical Gaps

1. **No Dependabot or Renovate for dependency alerts**
   - Impact: Tool version pins (kustomize v5.8.0, kube-linter v0.7.6, yamllint 1.37.1, yq v4.49.2, helm-docs v1.14.2) and GitHub Actions (actions/checkout, azure/setup-helm, etc.) can become stale with known CVEs
   - Severity: MEDIUM
   - Effort: 1-2 hours

2. **No shell script testing or linting (shellcheck)**
   - Impact: 11 shell scripts handle critical production operations — `verify-dependencies.sh` (300+ lines), `verify-helm-chart.sh`, `chart-snapshots.sh`, `update-rhoai-version.sh`, etc. — with no automated static analysis or unit tests
   - Severity: MEDIUM
   - Effort: 4-6 hours

3. **No coverage tracking for snapshot tests**
   - Impact: No visibility into which Helm template paths, helper functions, or conditional branches are exercised by existing snapshot configurations
   - Severity: LOW
   - Effort: 4-6 hours

4. **OCP 4.20 Tekton validation pipeline disabled**
   - Impact: Forward compatibility with next OCP version is not being validated on PRs; issues discovered late
   - Severity: MEDIUM
   - Effort: 2-3 hours (enable when OCP 4.20 support is confirmed)

## Quick Wins

1. **Enable Dependabot for GitHub Actions and Go modules** (1-2 hours)
   - Impact: Automated security updates for CI action pins and Go tooling versions
   - Implementation:
   ```yaml
   # .github/dependabot.yml
   version: 2
   updates:
     - package-ecosystem: "github-actions"
       directory: "/"
       schedule:
         interval: "weekly"
     - package-ecosystem: "gomod"
       directory: "/"
       schedule:
         interval: "weekly"
   ```

2. **Add shellcheck to CI validation** (2-3 hours)
   - Impact: Catch shell script bugs (unquoted variables, incorrect error handling) before they reach production
   - Implementation: Add shellcheck step to `testing.yaml` workflow:
   ```yaml
   - name: Run shellcheck
     run: |
       find scripts/ charts/ -name '*.sh' -exec shellcheck {} +
   ```

3. **Add pre-commit hooks** (1-2 hours)
   - Impact: Shift-left lint failures to developer workstations
   - Implementation:
   ```yaml
   # .pre-commit-config.yaml
   repos:
     - repo: https://github.com/adrienverge/yamllint
       rev: v1.37.1
       hooks:
         - id: yamllint
           args: [-c, .yamllint.yaml]
     - repo: https://github.com/koalaman/shellcheck-precommit
       rev: v0.10.0
       hooks:
         - id: shellcheck
   ```

## Detailed Findings

### Unit Tests

**Snapshot Testing System (Strong)**:
- Custom `chart-snapshots.sh` script with `snapshot-config.yaml` for declarative test configuration
- **rhai-on-openshift-chart**: 9 snapshot configurations (default, skip-crd-check-odh, skip-crd-check-rhoai, all-components-managed, install-with-helm-dependencies, inference-only, profile-with-customization, enable-llm-d-wva, with-rhcl-config)
- **rhai-on-xks-chart**: 19 snapshot configurations covering Azure, CoreWeave, AWS, plus TLS, pull secrets, gateway, routes, and MaaS variations
- **5 dependency charts**: Each with default snapshot tests (cert-manager, gateway-api, lws, sail, rhcl)
- Version redaction in snapshots prevents spurious diffs
- Integrated into CI via `make chart-test` in `helm.yaml` workflow

**Gaps**:
- No tests for shell scripts (`scripts/*.sh`) which contain critical verification logic
- No negative test cases (invalid values, missing required fields)
- No parameterized testing of Helm helper functions (shouldInstall, componentDSCConfig, etc.)

### Integration/E2E Tests

**Kind Cluster E2E (Excellent)**:
- `rhai-on-xks-chart-test.yaml` workflow provisions Kind clusters for Helm chart testing
- Matrix strategy across 3 cloud providers: Azure, CoreWeave, AWS
- **Install tests**: Full chart installation with 30-minute timeout, verification via Makefile targets
- **Upgrade tests**: Install previous version (v3.4.2 from registry), upgrade to current PR version, verify — catches breaking upgrade paths
- Authorization controls for external contributors (require `run-xks-e2e` label)
- Failure diagnostics: Dumps custom resource YAML on failure for debugging

**Tekton/Konflux Cluster Validation (Excellent)**:
- Provisions ephemeral OCP clusters via HyperShift AWS (EaaS)
- **OCP 4.19 validation**: Active on PRs, validates kustomize dependencies
- **OCP 4.20 validation**: Defined but disabled pending version confirmation
- **Helm chart validation on OCP 4.19**: Triggered for `charts/rhai-on-openshift-chart/` changes
- Full pipeline: cluster provisioning → kubeconfig retrieval → git clone → make apply-and-verify-dependencies or helm-install-verify
- Supports custom OLM catalog images and channels for operator installation

**Dependency Verification (Strong)**:
- `verify-dependencies.sh`: Checks 11+ operators (cert-manager, kueue, COO, OpenTelemetry, LWS, JobSet, Tempo, KEDA, RHCL, NFD, GPU operator, RHODS/ODH operator)
- Waits for Subscription CSV to reach "Succeeded" phase
- Validates pod readiness with label selectors
- Custom checks per operator (e.g., cert-manager pods, KEDA components, RHCL sub-pods)

### Build Integration

**PR-Time Validation (Strong)**:
- `testing.yaml` runs on every PR:
  1. YAML syntax validation via yamllint
  2. Kustomize build validation for all kustomization.yaml files
  3. Best practices linting via kube-linter on rendered manifests
  4. Summary table in GitHub Actions step summary
- `helm.yaml` runs on PR changes to `charts/`:
  1. `helm lint` for all charts
  2. `ct lint` (chart-testing) with config
  3. Snapshot tests via `make chart-test`
  4. Docs generation check (helm-docs must be current)

**Makefile Targets (Comprehensive)**:
- `validate-all`: Runs yaml, kustomize, and lint validation
- `chart-test`: Snapshot testing for all or specific charts
- `helm-install-verify`: Multi-step Helm install with operator verification
- `helm-upgrade-verify-xks`: Upgrade testing from previous release
- `dry-run`: Client-side dry-run for kustomize builds

### Image Testing

Not applicable to this repository. `odh-gitops` is a GitOps configuration repo containing Kustomize overlays, Helm charts, and deployment scripts — it does not build container images. The score reflects a neutral baseline rather than a deficiency.

### Coverage Tracking

No coverage tracking is configured. This is partially expected given the repo type (YAML/Helm/Shell), but opportunities exist:
- Helm template path coverage (which conditionals are exercised by snapshot tests)
- Kustomize overlay coverage (which patches are tested)
- Shell script code path coverage via bashcov or similar tools

### CI/CD Automation

**GitHub Actions Workflows**:
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `testing.yaml` | PR, push (main), dispatch | YAML lint + Kustomize build + kube-linter |
| `helm.yaml` | PR to charts/, dispatch | Helm lint + chart-testing + snapshots + docs check |
| `rhai-on-xks-chart-test.yaml` | PR/push to xks-chart | Kind cluster E2E with 3-provider matrix + upgrade testing |
| `update-rhai-xks-bundle.yaml` | Daily 6am UTC + dispatch | Auto-update XKS bundle from rhods-operator, create PR |

**Tekton Pipelines (Konflux)**:
| Pipeline | Trigger | Purpose |
|----------|---------|---------|
| `cluster-validation-ocp-4.19` | PR (non-chart, non-docs) | OCP 4.19 kustomize validation on ephemeral cluster |
| `cluster-validation-ocp-4.20` | Disabled | OCP 4.20 validation (pending) |
| `helm-chart-validation-ocp-4.19` | PR to OCP chart | Helm install + verify on real OCP cluster |

**Automation Features**:
- Concurrency control in bundle update workflow (`cancel-in-progress: true`)
- Path-based triggering (avoids unnecessary CI runs for docs-only changes)
- Automated PR creation for bundle updates via `peter-evans/create-pull-request`
- Comment-based triggers for Tekton (`/validate-dependencies`, `/validate-helm-chart`)
- Authorization gates for external contributors on E2E tests

### Static Analysis

#### Linting

**YAML Linting (Good)**:
- `.yamllint.yaml` configured with sensible rules: 2-space indent, 180 char line length, truthy values allowed
- Excludes `bin/`, `.git/`, `docs/`, `scripts/`, `.github/`, `.claude/`, `charts/`
- Integrated into CI via `make validate-yaml`

**Kubernetes Linting (Good)**:
- `.kube-linter.yaml` with explicit control (no auto-defaults):
  - Security checks: privileged-container, privileged-ports, cluster-admin-role-binding, wildcard-in-rules, unsafe-proc-mount, unsafe-sysctls, latest-tag
  - Custom CEL check for system group bindings in ClusterRoleBindings
- Runs on kustomize-rendered output in CI

**Helm Linting (Good)**:
- `helm lint` for all charts
- `ct lint` with chart-testing config (`ct.yaml`)
- Lint configuration (`lintconf.yaml`) with detailed YAML style rules
- Schema validation enabled

#### FIPS Compatibility

Not applicable — this is a GitOps repo with no compiled code. FIPS compliance for deployed operators is handled by the respective operator repos.

#### Dependency Alerts

**Missing**: No `.github/dependabot.yml` or Renovate configuration. The repo pins multiple tool versions in `Makefile` and GitHub Action versions in workflows — these should be automatically updated.

### Agent Rules

**Status**: Present and comprehensive

**CLAUDE.md**: Minimal, defers to `AGENTS.md` via `@AGENTS.md`

**AGENTS.md (Strong)**:
- Build & test command reference
- Commit conventions (conventional format with Jira links)
- YAML coding standards (2 spaces, 180 char max)
- Kustomize and Helm conventions
- Architecture overview with key directories
- Pattern files to reference before writing code

**.claude/rules/ → .rules/ (Excellent)**:
- **4 path-scoped rule files** with `paths:` frontmatter for targeted guidance:
  - `kustomize.md` — Component/overlay patterns, validation commands
  - `helm-ocp-chart.md` — OpenShift chart helpers, dependency/component addition procedures, profile creation
  - `helm-xks-chart.md` — XKS chart cloud provider patterns, CR lifecycle, helper documentation
  - `helm-dep-charts.md` — Dependency chart structure, update procedures, validation
- Rules are actionable with specific file paths, helper function names, and step-by-step procedures
- Framework-specific (Helm, Kustomize, Kubernetes)
- Up-to-date with current repository structure

**Gaps**:
- No test creation rules (how to add new snapshot configurations)
- No CI/pipeline rules (how to add new workflows or Tekton pipelines)

## Recommendations

### Priority 0 (Critical)

1. **Enable Dependabot** — Create `.github/dependabot.yml` covering `github-actions` and `gomod` ecosystems. Pin-based tool versions in `Makefile` (kustomize, kube-linter, yamllint, yq) should be tracked as well.

2. **Add shellcheck to CI** — Add a shellcheck validation step to `testing.yaml` for all `scripts/*.sh` and chart scripts. These scripts handle critical operations (dependency verification, cluster validation, snapshot testing).

### Priority 1 (High Value)

3. **Enable OCP 4.20 Tekton pipeline** when version support is confirmed — uncomment the CEL expression trigger in `.tekton/cluster-validation-ocp-4.20.yaml`.

4. **Add negative snapshot test cases** — Test invalid value combinations (e.g., no cloud provider enabled, multiple cloud providers enabled, missing required fields) to verify `values.schema.json` catches errors.

5. **Add pre-commit hooks** — Configure `.pre-commit-config.yaml` with yamllint and shellcheck hooks to catch issues before commit.

6. **Add test creation rules** — Add `.rules/testing.md` with guidance on adding new snapshot configurations, updating `scripts/snapshot-config.yaml`, and the E2E test pattern.

### Priority 2 (Nice-to-Have)

7. **Add bats-core tests for shell scripts** — Critical scripts like `verify-dependencies.sh` (300+ lines with complex wait loops) would benefit from unit testing of individual functions.

8. **Add Helm schema completeness tests** — Verify that `values.schema.json` covers all keys in `values.yaml` and that required fields are properly enforced.

9. **Track snapshot coverage metrics** — Catalog which Helm helper conditionals and template branches are exercised by current snapshots to identify untested paths.

## Comparison to Gold Standards

| Practice | odh-gitops | odh-dashboard (Gold) | notebooks (Gold) | Industry Best |
|----------|-----------|---------------------|-------------------|---------------|
| Unit/Snapshot Tests | 30+ Helm snapshots | Jest + Cypress | Image layer tests | Framework-specific |
| E2E Testing | Kind + OCP clusters | Cypress + API | Multi-arch runtime | Real cluster validation |
| Build Integration | YAML/Kustomize/Helm lint | TypeScript + Webpack | Multi-layer Docker | PR-time build validation |
| Coverage Tracking | None | Codecov enforced | Image validation | Threshold enforcement |
| CI Workflows | 4 GHA + 3 Tekton | 10+ workflows | 5-layer pipeline | PR + periodic |
| Static Analysis | yamllint + kube-linter | ESLint + TypeScript strict | ruff + mypy | Multi-tool lint |
| Dependency Alerts | None | Dependabot configured | Dependabot configured | Dependabot/Renovate |
| Agent Rules | Excellent (4 scoped rules) | Comprehensive | Moderate | Present + actionable |

**Relative to its repo type (GitOps/Helm)**, odh-gitops performs well. The E2E testing with real OCP clusters via Tekton/EaaS is notably strong. The main gaps (Dependabot, shellcheck, pre-commit hooks) are low-effort, high-impact improvements.

## File Paths Reference

### CI/CD
- `.github/workflows/testing.yaml` — PR validation (YAML lint, Kustomize, kube-linter)
- `.github/workflows/helm.yaml` — Helm chart validation (lint, chart-testing, snapshots)
- `.github/workflows/rhai-on-xks-chart-test.yaml` — XKS chart E2E (Kind + 3 providers)
- `.github/workflows/update-rhai-xks-bundle.yaml` — Automated bundle update
- `.tekton/cluster-validation-ocp-4.19.yaml` — OCP 4.19 cluster validation
- `.tekton/cluster-validation-ocp-4.20.yaml` — OCP 4.20 cluster validation (disabled)
- `.tekton/helm-chart-validation-ocp-4.19.yaml` — Helm chart OCP validation
- `.tekton/pipelines/cluster-validation-pipeline.yaml` — Shared Tekton pipeline definition

### Testing
- `scripts/chart-snapshots.sh` — Snapshot generation and testing engine
- `scripts/snapshot-config.yaml` — Snapshot test configuration (30+ test cases)
- `charts/rhai-on-openshift-chart/test/snapshots/` — OCP chart snapshots (9 files)
- `charts/rhai-on-xks-chart/test/snapshots/` — XKS chart snapshots (19 files)
- `scripts/verify-dependencies.sh` — Operator dependency verification (11+ operators)
- `scripts/verify-helm-chart.sh` — Helm release and DSC verification

### Static Analysis
- `.yamllint.yaml` — YAML lint configuration
- `.kube-linter.yaml` — Kubernetes manifest lint configuration
- `.github/configs/ct.yaml` — Chart-testing configuration
- `.github/configs/lintconf.yaml` — Chart lint rules
- `Makefile` — Build and validation targets

### Agent Rules
- `CLAUDE.md` — Defers to AGENTS.md
- `AGENTS.md` — Build commands, conventions, architecture overview
- `.rules/kustomize.md` — Kustomize patterns (paths: components/, dependencies/, configurations/)
- `.rules/helm-ocp-chart.md` — OpenShift chart patterns (paths: charts/rhai-on-openshift-chart/)
- `.rules/helm-xks-chart.md` — XKS chart patterns (paths: charts/rhai-on-xks-chart/)
- `.rules/helm-dep-charts.md` — Dependency chart patterns (paths: charts/dependencies/)

### Helm Charts
- `charts/rhai-on-openshift-chart/Chart.yaml` — OCP chart (v3.4.0)
- `charts/rhai-on-xks-chart/Chart.yaml` — XKS chart (v3.5.0-ea.2)
- `charts/dependencies/*/Chart.yaml` — 5 dependency charts (cert-manager, gateway-api, lws, rhcl, sail)
