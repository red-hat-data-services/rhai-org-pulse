---
repository: "red-hat-data-services/genaidemo25-gitops"
overall_score: 2.1
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No tests of any kind exist in the repository"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E test suites; no cluster-level validation"
  - dimension: "Build Integration"
    score: 1.0
    status: "No CI/CD pipeline; Helm chart has no lint/template validation"
  - dimension: "Image Testing"
    score: 0.0
    status: "No container images built; no image testing applicable"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling; no test code to measure"
  - dimension: "CI/CD Automation"
    score: 1.5
    status: "ArgoCD automated sync configured but no CI pipeline for PRs"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules"
critical_gaps:
  - title: "No CI/CD pipeline for PRs"
    impact: "Broken YAML, invalid Helm templates, and misconfigured Kustomize overlays can be merged without any automated check"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No YAML/Helm/Kustomize validation"
    impact: "Syntax errors and schema violations in Kubernetes manifests are only caught at ArgoCD sync time (in production)"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Hardcoded credentials in README and shell scripts"
    impact: "Default passwords (password123, brno123) are publicly exposed and could be used against demo clusters"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No secret detection or security scanning"
    impact: "Credentials, tokens, or API keys could be committed without any automated guard"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "Shell scripts lack validation and error handling"
    impact: "Scripts that configure cluster auth (OAuth, RBAC) have no dry-run mode and no rollback"
    severity: "MEDIUM"
    effort: "4-8 hours"
quick_wins:
  - title: "Add GitHub Actions workflow for YAML lint + Helm template validation"
    effort: "2-3 hours"
    impact: "Catches syntax errors and invalid template references before merge"
  - title: "Add kustomize build --dry-run validation to PR workflow"
    effort: "1-2 hours"
    impact: "Validates all Kustomize overlays produce valid Kubernetes manifests"
  - title: "Add pre-commit hooks for YAML lint and secret detection"
    effort: "1 hour"
    impact: "Prevents malformed YAML and accidental credential commits locally"
  - title: "Remove hardcoded credentials from README"
    effort: "30 minutes"
    impact: "Eliminates publicly visible default passwords"
  - title: "Add ShellCheck to PR workflow"
    effort: "1 hour"
    impact: "Catches shell script bugs (unquoted variables, missing error handling)"
recommendations:
  priority_0:
    - "Create a GitHub Actions PR workflow with yamllint, helm lint, helm template, and kustomize build validation"
    - "Remove hardcoded credentials from README.md and replace with instructions to generate unique passwords"
    - "Add Gitleaks or TruffleHog secret detection to prevent credential leaks"
  priority_1:
    - "Add ShellCheck linting for all shell scripts"
    - "Add Kubeconform or kubeval schema validation against OpenShift API schemas"
    - "Create a CLAUDE.md with contribution guidelines and manifest creation rules"
    - "Add pre-commit hooks (.pre-commit-config.yaml) for local validation"
  priority_2:
    - "Add Renovate/Dependabot for Helm chart dependency updates"
    - "Create integration test that deploys manifests to a Kind/Minikube cluster"
    - "Add OPA/Gatekeeper policy checks (resource limits, security contexts)"
    - "Document ArgoCD application dependency ordering and sync wave strategy"
---

# Quality Analysis: genaidemo25-gitops

## Executive Summary

- **Overall Score: 2.1/10**
- **Repository Type**: GitOps configuration repository (Kubernetes manifests, Helm charts, Kustomize overlays, ArgoCD applications)
- **Primary Languages**: YAML (679 lines), Shell (389 lines)
- **Size**: 44 files, ~1,400 total lines
- **Key Strengths**: Well-structured ArgoCD application hierarchy, proper use of Kustomize sync waves, clean Helm chart for model deployment
- **Critical Gaps**: Zero CI/CD pipeline, zero tests, hardcoded credentials in documentation, no linting or validation of any kind
- **Agent Rules Status**: Missing — no CLAUDE.md, no .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No tests of any kind exist |
| Integration/E2E | 0/10 | No integration or E2E test suites |
| **Build Integration** | **1/10** | **No CI pipeline; Helm chart has no lint/template validation** |
| Image Testing | 0/10 | No container images built (not directly applicable) |
| Coverage Tracking | 0/10 | No coverage tooling; no test code to measure |
| CI/CD Automation | 1.5/10 | ArgoCD automated sync but no PR-time validation |
| Agent Rules | 0/10 | No CLAUDE.md, no .claude/ directory |

## Critical Gaps

### 1. No CI/CD Pipeline for Pull Requests
- **Impact**: Broken YAML, invalid Helm templates, and misconfigured Kustomize overlays can be merged without any automated check. Errors are only discovered when ArgoCD tries to sync — in production.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **What's missing**:
  - No `.github/workflows/` directory
  - No GitHub Actions, GitLab CI, or Jenkins pipeline
  - No PR checks of any kind (no branch protection implied)

### 2. No YAML/Helm/Kustomize Validation
- **Impact**: Syntax errors and schema violations in 28 YAML files and 2 Helm templates are never validated until they reach ArgoCD sync.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Specifics**:
  - No `yamllint` configuration
  - No `helm lint` or `helm template` validation
  - No `kustomize build` dry-run
  - No Kubeconform/kubeval schema validation

### 3. Hardcoded Credentials in README and Scripts
- **Impact**: Default passwords (`hackathon:brno123`, `test-user:password123`) are publicly visible in README.md. While these are demo credentials, they establish a dangerous pattern and could be used against live demo clusters.
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Files affected**:
  - `README.md` (line 127): `test-user:password123`
  - `README.md` (line 126): `hackathon:brno123`
  - `shared-cluster/user-setup/setup-demo-admin.sh` (line 6): `TEST_PASSWORD:-password123`

### 4. No Secret Detection or Security Scanning
- **Impact**: No automated guard against accidentally committing secrets, tokens, or API keys.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **What's missing**:
  - No Gitleaks or TruffleHog
  - No `.gitleaks.toml` configuration
  - No pre-commit hooks
  - `.gitignore` only covers `values.yaml` — other secret-bearing files could slip through

### 5. Shell Scripts Lack Validation
- **Impact**: 5 shell scripts (~389 lines) configure cluster-critical resources (OAuth, RBAC, cluster-admin grants) with no dry-run mode, no rollback, and potential shellcheck warnings.
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Observations**:
  - `cleanup-lightspeed.sh` is well-structured with functions but could benefit from `shellcheck`
  - `run-litemaas.sh` disables TLS verification (`NODE_TLS_REJECT_UNAUTHORIZED=0`)
  - User setup scripts use `set -e` but have unquoted variables and missing input validation

## Quick Wins

### 1. Add GitHub Actions PR Validation Workflow (2-3 hours)
```yaml
# .github/workflows/validate.yml
name: Validate Manifests
on: [pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: YAML Lint
        uses: ibiqlik/action-yamllint@v3
        with:
          file_or_dir: .
          config_data: |
            extends: default
            rules:
              line-length: {max: 200}
              truthy: disable
      - name: Helm Lint
        run: |
          helm lint shared-cluster/deploy-model \
            -f shared-cluster/deploy-model/gpt-oss-20b.yaml
          helm lint shared-cluster/deploy-model \
            -f shared-cluster/deploy-model/gemma-3-27b.yaml
      - name: Helm Template
        run: |
          helm template test shared-cluster/deploy-model \
            -f shared-cluster/deploy-model/gpt-oss-20b.yaml | kubectl apply --dry-run=client -f -
          helm template test shared-cluster/deploy-model \
            -f shared-cluster/deploy-model/gemma-3-27b.yaml | kubectl apply --dry-run=client -f -
      - name: Kustomize Build
        run: |
          kustomize build shared-cluster/install-rhoai | kubectl apply --dry-run=client -f -
          kustomize build module-lightspeed/install-pipelines | kubectl apply --dry-run=client -f -
          kustomize build module-lightspeed/install-web-terminal | kubectl apply --dry-run=client -f -
      - name: ShellCheck
        uses: ludeeus/action-shellcheck@master
        with:
          scandir: '.'
```

### 2. Add Pre-commit Hooks (1 hour)
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: check-yaml
        args: ['--allow-multiple-documents']
      - id: end-of-file-fixer
      - id: trailing-whitespace
  - repo: https://github.com/adrienverge/yamllint
    rev: v1.33.0
    hooks:
      - id: yamllint
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
  - repo: https://github.com/shellcheck-py/shellcheck-py
    rev: v0.9.0.6
    hooks:
      - id: shellcheck
```

### 3. Remove Hardcoded Credentials from README (30 minutes)
Replace the credentials section with instructions to generate unique passwords per deployment.

### 4. Add Kustomize Build Validation (1-2 hours)
Validate all 3 Kustomize overlays produce valid Kubernetes manifests on every PR.

### 5. Add ShellCheck (1 hour)
Lint all 5 shell scripts to catch unquoted variables, missing error handling, and portability issues.

## Detailed Findings

### CI/CD Pipeline
- **Status**: No CI/CD pipeline exists
- **ArgoCD**: 5 ArgoCD Application/ApplicationSet manifests provide deployment automation with:
  - Automated sync with prune and self-heal (`rhoai-operator`, `module-lightspeed`)
  - Manual sync for LLM model deployment (prune: false, selfHeal: false — appropriate for GPU workloads)
  - Proper use of `CreateNamespace`, `PrunePropagationPolicy`, `PruneLast` sync options
  - `resources-finalizer` for clean deletion
- **Gap**: ArgoCD handles deployment, but nothing validates manifests before they're merged. The entire quality gate is "does ArgoCD sync succeed?"

### Test Coverage
- **Status**: Zero tests
- **Zero test files** of any kind (`*_test.go`, `*.spec.ts`, `*.test.py`, etc.)
- **No test directories** (`test/`, `tests/`, `e2e/`, `integration/`)
- **Appropriate for repo type?** GitOps repos typically don't have unit tests, but they should validate:
  - Helm template rendering
  - Kustomize overlay correctness
  - YAML schema compliance
  - ArgoCD Application spec validity

### Code Quality
- **Linting**: No linting configuration of any kind
- **Pre-commit**: No `.pre-commit-config.yaml`
- **Static Analysis**: No SAST tools
- **Shell scripts**: No ShellCheck
- **Helm**: No `helm lint` validation
- **Positive note**: `.gitignore` correctly excludes `values.yaml` (contains secrets) and common editor files

### Container Images
- **Not directly applicable**: This repo deploys pre-built images, it does not build them
- **Image references**: Uses pinned SHA256 digests for vLLM runtime images (good practice):
  - `quay.io/modh/vllm@sha256:56aa86c6...` (template default)
  - `quay.io/modh/vllm@sha256:b2391f71...` (gemma-3-27b)
- **Positive**: Image digests prevent tag mutation attacks

### Security
- **Hardcoded credentials**: Demo passwords in README.md and shell scripts
- **TLS bypass**: `run-litemaas.sh` sets `NODE_TLS_REJECT_UNAUTHORIZED=0`
- **Cluster-admin grants**: `setup-demo-admin.sh` grants cluster-admin to demo users (appropriate for demo, risky pattern)
- **No secret scanning**: No Gitleaks, TruffleHog, or similar
- **Positive**: `.gitignore` excludes `values.yaml` which could contain real secrets

### Helm Chart Quality
- **Chart structure**: Clean, well-organized Helm chart at `shared-cluster/deploy-model/`
  - `Chart.yaml` with proper metadata (apiVersion: v2, version: 0.2.0)
  - `values.yaml.template` with comprehensive documentation
  - Two model configurations: `gpt-oss-20b.yaml`, `gemma-3-27b.yaml`
- **Templates**: 2 templates (InferenceService, ServingRuntime) with:
  - Proper conditional blocks (`{{- if .Values.connection.name }}`)
  - Correct use of `toYaml`, `nindent`, `quote` functions
  - Proper handling of optional fields (tolerations, extraArgs)
- **Gap**: No `helm lint`, no schema validation, no `_helpers.tpl` for reuse

### Kustomize Overlays
- **3 Kustomize bases**: install-rhoai, install-pipelines, install-web-terminal
- **Sync wave pattern**: install-rhoai uses ordered resource lists (servicemesh → serverless → namespace → RBAC → operator → DSC)
- **Gap**: No `kustomize build` validation in CI

### ArgoCD Application Architecture
- **Well-structured hierarchy**:
  - `shared-cluster/` — cluster-wide operators (RHOAI, ServiceMesh, Serverless)
  - `module-lightspeed/` — module-specific operators (Pipelines, Web Terminal)
  - `shared-cluster/deploy-model/` — Helm-based model deployment
- **Multi-source Application**: `install-llm-models-argocd-app.yaml` uses ArgoCD multi-source to deploy multiple models from the same chart
- **ApplicationSet**: `lightspeed-applicationset.yaml` uses list generator for operator deployment

### Agent Rules (Agentic Flow Quality)
- **Status**: Missing
- **No CLAUDE.md** or AGENTS.md in repository root
- **No .claude/ directory** — no rules, no skills, no custom configuration
- **Impact**: AI agents have no guidance for:
  - YAML manifest conventions
  - Helm template patterns
  - Kustomize overlay structure
  - ArgoCD application configuration
  - Security constraints for demo environments
- **Recommendation**: Generate rules with `/test-rules-generator` covering manifest validation, Helm patterns, and security practices

## Recommendations

### Priority 0 (Critical)
1. **Create a GitHub Actions PR workflow** with yamllint, helm lint, helm template, kustomize build, and ShellCheck validation. This is the single highest-impact improvement — it catches errors before they reach production.
2. **Remove hardcoded credentials from README.md** and replace with a pattern that generates unique passwords per deployment. Move demo credential defaults to a `.env.example` file.
3. **Add Gitleaks secret detection** to prevent accidental credential commits (pre-commit hook + CI workflow).

### Priority 1 (High Value)
4. **Add ShellCheck linting** for all 5 shell scripts. Several scripts configure cluster-critical OAuth and RBAC resources.
5. **Add Kubeconform schema validation** against OpenShift API schemas to catch invalid fields, wrong apiVersions, and deprecated resources.
6. **Create a CLAUDE.md** with contribution guidelines covering manifest conventions, Helm template patterns, and security requirements.
7. **Add pre-commit hooks** for local validation (yamllint, check-yaml, gitleaks, shellcheck).

### Priority 2 (Nice-to-Have)
8. **Add Renovate or Dependabot** for automated Helm chart and action version updates.
9. **Create integration tests** that deploy manifests to a Kind cluster and verify ArgoCD sync succeeds.
10. **Add OPA/Gatekeeper policy checks** to enforce resource limits, security contexts, and namespace isolation.
11. **Document sync wave strategy** and ArgoCD application dependency ordering for the team.
12. **Add Pluto** to detect deprecated Kubernetes API versions before they break on cluster upgrades.

## Comparison to Gold Standards

| Practice | genaidemo25-gitops | odh-dashboard | notebooks | Best Practice |
|----------|-------------------|---------------|-----------|---------------|
| PR CI Pipeline | None | Comprehensive | Multi-layer | Required |
| YAML Linting | None | ESLint for TS | yamllint | Required |
| Helm Validation | None | N/A | N/A | helm lint + template |
| Kustomize Validation | None | N/A | N/A | kustomize build |
| Schema Validation | None | TypeScript strict | N/A | Kubeconform |
| Secret Detection | None | Pre-commit | Pre-commit | Gitleaks |
| Pre-commit Hooks | None | Comprehensive | Yes | Required |
| Coverage Tracking | None | Codecov | N/A | Codecov |
| Security Scanning | None | CodeQL | Trivy | Required |
| Agent Rules | None | Comprehensive | Basic | Recommended |
| ArgoCD Structure | Good | N/A | N/A | Multi-source apps |
| Image Pinning | SHA256 digests | Latest tags | SHA256 | SHA256 digests |

## File Paths Reference

### Repository Structure
- `shared-cluster/` — Cluster-wide resources (RHOAI, models, user setup)
- `module-lightspeed/` — Lightspeed module operators
- `module-receipts/` — Future module (empty)

### Key Configuration Files
- `shared-cluster/deploy-model/Chart.yaml` — Helm chart metadata
- `shared-cluster/deploy-model/templates/` — Helm templates (InferenceService, ServingRuntime)
- `shared-cluster/deploy-model/values.yaml.template` — Template for model values
- `shared-cluster/install-rhoai/kustomization.yaml` — RHOAI operator Kustomize base
- `shared-cluster/install-rhoai-argocd-app.yaml` — ArgoCD app for RHOAI
- `shared-cluster/install-llm-models-argocd-app.yaml` — Multi-source ArgoCD app for models

### Shell Scripts
- `shared-cluster/user-setup/setup-demo-admin.sh` — Creates demo admin with cluster-admin
- `shared-cluster/user-setup/setup-demo-users.sh` — Creates N demo users
- `shared-cluster/user-setup/setup-demo-users-as-cluster-admins.sh` — Grants cluster-admin to users
- `shared-cluster/litemaas/run-litemaas.sh` — Deploys LiteMaaS
- `module-lightspeed/cleanup-lightspeed.sh` — Cleans up Lightspeed module resources
