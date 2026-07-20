---
repository: "red-hat-data-services/odh-gitops"
overall_score: 6.7
scorecard:
  - dimension: "Unit Tests"
    score: 6.0
    status: "33 Helm snapshot tests across 7 charts; no programmatic unit tests (expected for config repo)"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Kind-based E2E across 3 cloud providers with upgrade tests; Tekton cluster validation on real OCP"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-time YAML/Kustomize/kube-linter validation, Helm chart linting, snapshot tests, and real OCP cluster validation via Tekton"
  - dimension: "Image Testing"
    score: 3.0
    status: "GitOps config repo — no container images built; no validation of referenced operator images"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "No coverage tracking; limited applicability for YAML/config repo but no Helm template branch coverage measurement"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "5 GitHub Actions workflows + 3 Tekton pipelines; matrix testing, concurrency control, scheduled bundle updates, automated PR creation"
  - dimension: "Static Analysis"
    score: 7.0
    status: "yamllint, kube-linter with custom CEL checks, chart-testing; missing Dependabot and pre-commit hooks"
  - dimension: "Agent Rules"
    score: 8.0
    status: "AGENTS.md + 4 path-scoped .rules/ files covering Helm charts and Kustomize patterns"
critical_gaps:
  - title: "No dependency alert automation (Dependabot/Renovate)"
    impact: "Outdated tool versions and Helm chart dependencies not flagged; security vulnerabilities in referenced images may go undetected"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No coverage tracking for Helm template branches"
    impact: "Unknown how much of the Helm template logic is exercised by snapshot tests; untested template branches may produce broken manifests"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "No validation of referenced operator container images"
    impact: "Chart references to non-existent or broken container images are only caught at deployment time, not at PR validation"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "OCP 4.20 Tekton validation disabled"
    impact: "No CI coverage for OCP 4.20 compatibility; regressions on newer OCP versions may go undetected until manual testing"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add .github/dependabot.yml for GitHub Actions version updates"
    effort: "1 hour"
    impact: "Automated PRs for outdated GitHub Actions, keeping CI secure and up-to-date"
  - title: "Add pre-commit hooks for yamllint and kube-linter"
    effort: "1-2 hours"
    impact: "Catch linting issues locally before pushing, reducing CI failures"
  - title: "Enable OCP 4.20 Tekton pipeline"
    effort: "1-2 hours"
    impact: "Extend multi-version OCP validation coverage to next release"
  - title: "Add shellcheck to CI for shell script validation"
    effort: "2-3 hours"
    impact: "Catch shell scripting bugs in 21 scripts (1,664 lines total) before merge"
recommendations:
  priority_0:
    - "Add .github/dependabot.yml covering github-actions ecosystem to keep CI actions up-to-date"
    - "Enable OCP 4.20 Tekton cluster validation pipeline (currently commented out)"
  priority_1:
    - "Add pre-commit hooks (.pre-commit-config.yaml) for yamllint, kube-linter, and shellcheck"
    - "Add CI step to validate referenced container image tags exist in registries"
    - "Add Helm template coverage analysis to measure snapshot test completeness"
  priority_2:
    - "Add AWS cloud provider to upgrade tests (currently only azure and coreweave)"
    - "Add schema validation for values.yaml against values.schema.json in CI"
    - "Consider adding OPA/Gatekeeper policy tests for generated Kubernetes manifests"
---

# Quality Analysis: odh-gitops

## Executive Summary

- **Overall Score: 6.7/10**
- **Repository Type**: GitOps configuration repository (Kustomize overlays + Helm charts)
- **Primary Languages**: YAML, Shell (bash), Helm templates
- **Jira**: RHOAIENG / AI Core Platform (downstream tier)
- **Key Strengths**: Excellent CI/CD automation with 5 GitHub Actions workflows and 3 Tekton pipelines; strong E2E testing on real Kind and OCP clusters across multiple cloud providers; comprehensive agent rules with path-scoped guidance
- **Critical Gaps**: No dependency alert automation (Dependabot/Renovate), no coverage tracking, no validation of referenced container images
- **Agent Rules Status**: Present and comprehensive

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 6.0/10 | 33 Helm snapshot tests; no programmatic tests |
| Integration/E2E | 20% | 8.0/10 | Kind E2E + OCP cluster validation via Tekton |
| Build Integration | 15% | 8.0/10 | PR-time YAML/Kustomize/Helm/kube-linter + real cluster validation |
| Image Testing | 10% | 3.0/10 | No images built; no referenced image validation |
| Coverage Tracking | 10% | 2.0/10 | No coverage measurement of any kind |
| CI/CD Automation | 15% | 9.0/10 | 5 workflows + 3 Tekton pipelines; matrix, concurrency, scheduled updates |
| Static Analysis | 10% | 7.0/10 | yamllint + kube-linter + chart-testing; missing Dependabot/pre-commit |
| Agent Rules | 5% | 8.0/10 | AGENTS.md + 4 path-scoped rules in .rules/ |

## Critical Gaps

### 1. No Dependency Alert Automation
- **Impact**: Tool versions in `Makefile` (kustomize v5.8.0, kube-linter v0.7.6, yamllint 1.37.1, yq v4.49.2) and GitHub Actions versions are not automatically monitored for security updates
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: No `.github/dependabot.yml`, `renovate.json`, or `.renovaterc` found. GitHub Actions are pinned by SHA (good practice), but no automated mechanism to propose version bumps

### 2. No Coverage Tracking
- **Impact**: Unknown what percentage of Helm template conditional branches are exercised by the 33 snapshot tests; untested template paths may produce broken manifests in production
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: No `.codecov.yml` or coverage tooling. For a GitOps repo, "coverage" means template branch coverage — measuring which `{{- if }}` / `{{- range }}` blocks have at least one snapshot testing that path

### 3. No Validation of Referenced Container Images
- **Impact**: Helm charts reference operator container images (via `values.yaml`), but no CI step verifies these image references resolve to valid, pullable images
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: The `update-image` make target fetches image refs from Build-Config, and the daily `update-rhai-xks-bundle.yaml` workflow updates them — but neither verifies the images actually exist in their registries

### 4. OCP 4.20 Cluster Validation Disabled
- **Impact**: Only OCP 4.19 validation is active in Tekton; OCP 4.20 pipeline exists but is commented out, leaving a gap in multi-version compatibility testing
- **Severity**: MEDIUM
- **Effort**: 2-4 hours (uncomment and verify)

## Quick Wins

### 1. Add Dependabot for GitHub Actions (1 hour)
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      actions:
        patterns:
          - "*"
```

### 2. Add Pre-commit Hooks (1-2 hours)
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

### 3. Enable OCP 4.20 Tekton Pipeline (1-2 hours)
Uncomment the `pipelinesascode.tekton.dev/on-cel-expression` and `on-comment` annotations in `.tekton/cluster-validation-ocp-4.20.yaml`

### 4. Add ShellCheck to CI (2-3 hours)
Add a step to the `testing.yaml` workflow:
```yaml
- name: Run ShellCheck
  run: |
    find scripts charts -name '*.sh' -exec shellcheck {} +
```

## Detailed Findings

### Unit Tests

**Score: 6.0/10**

This is a GitOps configuration repository — no traditional source code, so no `*_test.go` or `*.spec.ts` files. Testing is done via Helm snapshot tests.

**Strengths:**
- **33 snapshot test files** across 7 charts (rhai-on-openshift-chart, rhai-on-xks-chart, and 5 dependency charts)
- Well-structured `scripts/snapshot-config.yaml` defining test scenarios with specific `--set` flags
- Covers diverse configurations: default, skip-crd-check, all-components-managed, inference-only, profiles, multi-cloud providers (azure, coreweave, aws), pull secrets, gateway configurations, TLS variants
- Automated via `make chart-test` and enforced in CI (`helm.yaml` workflow)
- Chart version redaction in snapshots prevents false diffs

**Gaps:**
- No programmatic tests (e.g., Helm unittest plugin or `helm-test` hooks)
- No test for invalid inputs / negative cases (what happens with wrong cloud provider, missing required values)
- Snapshot tests only verify output doesn't change — they don't assert correctness of specific fields

**Key Files:**
- `scripts/snapshot-config.yaml` — 33 snapshot definitions
- `scripts/chart-snapshots.sh` — 415-line test runner
- `charts/*/test/snapshots/*.snap.yaml` — snapshot files
- `charts/rhai-on-openshift-chart/test/testValues.yaml` — test values override
- `charts/rhai-on-xks-chart/test/values-e2e.yaml` — E2E test values

### Integration/E2E Tests

**Score: 8.0/10**

**Strengths:**
- **Kind-based E2E** (`.github/workflows/rhai-on-xks-chart-test.yaml`): Runs on PRs touching `charts/rhai-on-xks-chart/`, creates real Kind clusters, installs and verifies Helm charts
- **Multi-cloud matrix**: Tests across azure, coreweave, and aws providers with `fail-fast: false`
- **Upgrade tests**: Verifies upgrade from previous GA version (v3.4.2) to current, covering azure and coreweave
- **Tekton cluster validation on OCP**: Provisions ephemeral HyperShift clusters via EaaS, runs real kustomize apply and helm install/verify on OCP 4.19
- **Helm chart validation pipeline**: Dedicated Tekton pipeline for OCP Helm chart testing with custom OLM catalogs
- **Verification scripts**: `scripts/verify-helm-chart.sh` checks Helm release, DSC CRD/status, component readiness; `scripts/verify-dependencies.sh` (300 lines) verifies operator dependencies
- **Authorization controls**: E2E workflow requires trusted contributor status or `run-xks-e2e` label for external PRs
- **Timeout controls**: 30-minute timeout on E2E steps; 10-minute Helm timeout

**Gaps:**
- AWS not yet included in upgrade tests (TODO in code: "add aws once 3.5 GA is the starting version")
- OCP 4.20 Tekton validation disabled (commented out)
- No E2E for the `rhai-on-openshift-chart` via GitHub Actions (only via Tekton)

**Key Files:**
- `.github/workflows/rhai-on-xks-chart-test.yaml` — Kind E2E (install + upgrade)
- `.tekton/cluster-validation-ocp-4.19.yaml` — Kustomize validation on OCP
- `.tekton/helm-chart-validation-ocp-4.19.yaml` — Helm validation on OCP
- `.tekton/pipelines/cluster-validation-pipeline.yaml` — Reusable Tekton pipeline
- `scripts/verify-helm-chart.sh` — Post-install verification
- `scripts/verify-dependencies.sh` — Dependency operator verification

### Build Integration

**Score: 8.0/10**

**Strengths:**
- **PR-time static validation** (`testing.yaml`): YAML lint, Kustomize build, kube-linter — runs on all PRs
- **Helm chart validation** (`helm.yaml`): Helm lint, chart-testing (ct), snapshot comparison, docs freshness check — runs on charts/ changes
- **Real cluster validation**: Tekton pipelines provision OCP clusters and run `make apply-and-verify-dependencies` or `make helm-install-verify`
- **Kustomize build verification**: Iterates all kustomization.yaml files and ensures each builds successfully
- **Doc generation check**: CI verifies `make helm-docs` output matches committed `api-docs.md` — prevents stale docs
- **Makefile orchestration**: Clean targets for install, verify, upgrade, uninstall with proper dependency chains

**Gaps:**
- No Konflux build simulation for this repo specifically (Tekton pipelines use Konflux infrastructure but don't simulate Konflux builds)
- No `--dry-run=server` validation against a live cluster API in GitHub Actions workflows (only in Tekton)

**Key Files:**
- `.github/workflows/testing.yaml` — Static validation workflow
- `.github/workflows/helm.yaml` — Helm chart validation workflow
- `Makefile` — 348 lines with validate-yaml, validate-kustomize, validate-lint, chart-test targets

### Image Testing

**Score: 3.0/10**

This is a GitOps configuration repository — it does not build container images. No Dockerfiles or Containerfiles exist in the repo.

**What exists:**
- Helm charts reference operator container images via `values.yaml` (e.g., `rhaiOperator.image`, `cloudManager.image`)
- `make update-image` fetches image references from Build-Config repositories
- Daily `update-rhai-xks-bundle.yaml` workflow auto-updates image refs and creates PRs

**Gaps:**
- No validation that referenced container images are pullable or exist in their registries
- No image vulnerability scanning of referenced images
- No image signature or digest verification for referenced images

### Coverage Tracking

**Score: 2.0/10**

No coverage tracking tooling of any kind.

**Context:** Traditional code coverage (`.codecov.yml`, `--coverprofile`) doesn't apply to YAML/Helm templates. However, Helm template "branch coverage" — measuring which conditional paths (`{{- if }}`, `{{- with }}`, `{{- range }}`) are exercised by snapshot tests — is a valid and valuable metric.

**Gaps:**
- No measurement of which Helm template conditionals are covered by the 33 snapshot tests
- No tracking of Kustomize overlay combinations tested
- No PR-level coverage reporting

### CI/CD Automation

**Score: 9.0/10**

**Workflow Inventory:**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `testing.yaml` | PR + push to main | YAML lint, Kustomize build, kube-linter |
| `helm.yaml` | PR (charts/) | Helm lint, chart-testing, snapshots, docs check |
| `rhai-on-xks-chart-test.yaml` | PR + push (xks chart) | Kind E2E across 3 cloud providers + upgrade tests |
| `helm-sync.yml` | Push (release branches) | Sync charts to RHOAI-Build-Config |
| `update-rhai-xks-bundle.yaml` | Daily schedule + manual | Auto-update XKS bundle, create PR |

| Tekton Pipeline | Trigger | Purpose |
|-----------------|---------|---------|
| `cluster-validation-ocp-4.19` | PR (Kustomize changes) | OCP 4.19 cluster validation |
| `cluster-validation-ocp-4.20` | Disabled (planned) | OCP 4.20 cluster validation |
| `helm-chart-validation-ocp-4.19` | PR (OCP chart changes) | Helm install on real OCP |

**Strengths:**
- Concurrency control (`helm-sync.yml` uses `cancel-in-progress: false` to prevent sync races)
- Path-based filtering to avoid unnecessary CI runs
- Matrix strategy for multi-cloud E2E (3 providers)
- Timeout configuration on E2E steps (30 min)
- Automated PR creation for bundle updates with `run-xks-e2e` label
- PR authorization gating for external contributors
- Conflict-safe sync workflow (rsync with delete, staged git add)
- Pinned action versions by SHA hash

**Minor gaps:**
- No explicit caching strategy (tools are downloaded fresh each run)
- No test parallelization within individual workflows (matrix handles parallelism across cloud providers)

### Static Analysis

**Score: 7.0/10**

#### Linting
- **yamllint** (`.yamllint.yaml`): 2-space indent, 180-char line length, K8s-friendly truthy values, applied to non-chart YAML
- **kube-linter** (`.kube-linter.yaml`): Security-focused checks including privileged-container, privileged-ports, cluster-admin-role-binding, wildcard-in-rules, latest-tag; custom CEL-based check for system group bindings
- **chart-testing** (`.github/configs/ct.yaml`): Schema validation, YAML validation, deprecated check, with lintconf
- **Helm lint**: All charts linted via `helm lint` in CI

#### FIPS Compatibility
Not directly applicable — this repo contains YAML configuration, Helm templates, and shell scripts. No Go/Python source code with cryptographic operations. FIPS compliance for the operators being deployed is managed in their respective source repositories.

#### Dependency Alerts
- **No Dependabot** (`.github/dependabot.yml` absent)
- **No Renovate** (`renovate.json` / `.renovaterc` absent)
- GitHub Actions are pinned by SHA (security best practice), but no automated mechanism to propose version bumps
- Tool versions in Makefile (kustomize, kube-linter, yamllint, yq, helm-docs) are manually managed

#### Pre-commit Hooks
- **No `.pre-commit-config.yaml`** — all linting happens in CI only
- 21 shell scripts (1,664 lines) with no ShellCheck validation

### Agent Rules

**Score: 8.0/10**

**Status**: Present and comprehensive

**Files found:**
- `CLAUDE.md` — Points to `AGENTS.md`
- `AGENTS.md` — Comprehensive guide with build/test commands, conventions, architecture, key examples, and pattern references
- `.rules/helm-xks-chart.md` — Path-scoped (`charts/rhai-on-xks-chart/**`): template structure, cloud provider pattern, component CR pattern, key helpers, image update workflow, validation commands
- `.rules/helm-ocp-chart.md` — Path-scoped (`charts/rhai-on-openshift-chart/**`): dependency templates, adding dependencies/components/profiles, key helpers, validation
- `.rules/helm-dep-charts.md` — Path-scoped (`charts/dependencies/**`): chart structure, patterns, updating, validation
- `.rules/kustomize.md` — Path-scoped (`components/**, dependencies/**, configurations/**`): operator component pattern, validation

**Strengths:**
- Path-scoped rules ensure relevant guidance is surfaced when editing specific chart areas
- Actionable patterns with specific file references ("Follow `templates/dependencies/cert-manager/operator.yaml` pattern")
- Clear step-by-step guides for common operations (adding dependencies, components, profiles, providers)
- Build/test commands documented with concrete examples
- Conventional commit format specified

**Gaps:**
- `.claude/rules/` directory exists but is empty — the `.rules/` directory is used instead
- No test-creation-specific rules (e.g., how to add new snapshot tests)
- No troubleshooting guidance for common CI failures

## Recommendations

### Priority 0 (Critical)

1. **Add `.github/dependabot.yml`** for GitHub Actions version monitoring
   - Covers: `github-actions` ecosystem
   - Effort: 1 hour
   - Impact: Automated security updates for CI actions

2. **Enable OCP 4.20 Tekton cluster validation**
   - Uncomment annotations in `.tekton/cluster-validation-ocp-4.20.yaml`
   - Effort: 2-4 hours (including verification)
   - Impact: Multi-version OCP compatibility assurance

### Priority 1 (High Value)

3. **Add pre-commit hooks** for yamllint, kube-linter, and shellcheck
   - Creates `.pre-commit-config.yaml` with local-first validation
   - Effort: 2-3 hours
   - Impact: Faster feedback, fewer CI failures

4. **Add ShellCheck validation to CI**
   - 21 shell scripts across `scripts/` and `charts/*/scripts/`
   - Effort: 2-3 hours
   - Impact: Catch bash scripting bugs in 1,664 lines of shell code

5. **Add referenced image validation**
   - CI step that extracts image refs from `values.yaml` and verifies they exist via `skopeo inspect`
   - Effort: 4-6 hours
   - Impact: Catch broken image references before merge

### Priority 2 (Nice-to-Have)

6. **Add AWS to upgrade tests** (pending 3.5 GA — noted as TODO in code)
7. **Add negative snapshot tests** (invalid provider combinations, missing required values)
8. **Add OPA/Gatekeeper policy tests** for generated manifests
9. **Add CI caching** for tool downloads (`kustomize`, `kube-linter`, `yamllint`, `yq`)
10. **Add snapshot test creation rule** to `.rules/` for guiding new test additions

## Comparison to Gold Standards

| Dimension | odh-gitops | odh-dashboard | notebooks | kserve |
|-----------|-----------|--------------|-----------|--------|
| Unit Tests | 6 — Snapshot tests only | 9 — Jest + React Testing Library | 7 — Pytest suites | 8 — Go testing + envtest |
| Integration/E2E | 8 — Kind + OCP E2E | 9 — Cypress + contract tests | 8 — 5-layer validation | 9 — Multi-version K8s |
| Build Integration | 8 — Kustomize + Helm validation | 8 — PR-time builds | 7 — Image builds | 7 — Operator builds |
| Image Testing | 3 — No images built | 6 — Container builds | 9 — Multi-arch image testing | 5 — Basic image builds |
| Coverage Tracking | 2 — None | 8 — Codecov enforcement | 5 — Basic coverage | 8 — Coverage gates |
| CI/CD Automation | 9 — GHA + Tekton + scheduling | 9 — Comprehensive workflows | 8 — Matrix testing | 8 — Multi-version CI |
| Static Analysis | 7 — yamllint + kube-linter | 8 — ESLint + Dependabot | 6 — Basic linting | 7 — golangci-lint |
| Agent Rules | 8 — Path-scoped rules | 8 — Comprehensive rules | 4 — Basic docs | 3 — Minimal |
| **Overall** | **6.7** | **8.4** | **7.0** | **7.2** |

**Note:** The lower Image Testing and Coverage Tracking scores are largely due to the nature of this repository (GitOps config, not source code). When evaluated against GitOps-specific best practices, this repository performs well above average with its snapshot testing, real-cluster E2E, and Tekton integration.

## File Paths Reference

### CI/CD
- `.github/workflows/testing.yaml` — PR static validation
- `.github/workflows/helm.yaml` — Helm chart validation
- `.github/workflows/rhai-on-xks-chart-test.yaml` — Kind E2E tests
- `.github/workflows/helm-sync.yml` — Chart sync to Build-Config
- `.github/workflows/update-rhai-xks-bundle.yaml` — Scheduled bundle update
- `.tekton/cluster-validation-ocp-4.19.yaml` — OCP 4.19 Kustomize validation
- `.tekton/cluster-validation-ocp-4.20.yaml` — OCP 4.20 (disabled)
- `.tekton/helm-chart-validation-ocp-4.19.yaml` — OCP 4.19 Helm validation
- `.tekton/pipelines/cluster-validation-pipeline.yaml` — Reusable Tekton pipeline

### Testing
- `scripts/snapshot-config.yaml` — Snapshot test definitions
- `scripts/chart-snapshots.sh` — Snapshot test runner
- `charts/*/test/snapshots/*.snap.yaml` — 33 snapshot files
- `charts/rhai-on-openshift-chart/test/testValues.yaml` — OCP test values
- `charts/rhai-on-xks-chart/test/values-e2e.yaml` — XKS E2E values
- `scripts/verify-helm-chart.sh` — Helm install verification
- `scripts/verify-dependencies.sh` — Dependency verification

### Static Analysis
- `.yamllint.yaml` — YAML linting rules
- `.kube-linter.yaml` — Kubernetes manifest linting (with custom CEL checks)
- `.github/configs/ct.yaml` — chart-testing configuration
- `.github/configs/lintconf.yaml` — Lint rules for chart-testing

### Agent Rules
- `AGENTS.md` — Main agent documentation
- `CLAUDE.md` — Points to AGENTS.md
- `.rules/helm-xks-chart.md` — XKS chart rules
- `.rules/helm-ocp-chart.md` — OCP chart rules
- `.rules/helm-dep-charts.md` — Dependency chart rules
- `.rules/kustomize.md` — Kustomize rules

### Charts
- `charts/rhai-on-openshift-chart/` — OCP Helm chart (OLM-based)
- `charts/rhai-on-xks-chart/` — Non-OCP Kubernetes Helm chart
- `charts/dependencies/` — Standalone operator dependency charts
- `charts/rhai-on-openshift-chart/values.schema.json` — Values schema
- `charts/rhai-on-xks-chart/values.schema.json` — Values schema

### Build
- `Makefile` — Build/validation orchestration (348 lines)
- `scripts/` — 11 shell scripts (1,664 lines total)
