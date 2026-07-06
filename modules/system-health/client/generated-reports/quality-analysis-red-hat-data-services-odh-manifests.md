---
repository: "red-hat-data-services/odh-manifests"
overall_score: 2.0
scorecard:
  - dimension: "Unit Tests"
    score: 1.0
    status: "No YAML validation, kustomize build checks, or schema validation for manifests"
  - dimension: "Integration/E2E"
    score: 4.0
    status: "15 bash smoke tests via OpenShift CI (Prow), but basic coverage only"
  - dimension: "Build Integration"
    score: 1.0
    status: "No PR-time kustomize build validation, no manifest linting"
  - dimension: "Image Testing"
    score: 2.0
    status: "Dockerfiles exist but no image scanning, runtime validation, or multi-arch"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tracking of any kind"
  - dimension: "CI/CD Automation"
    score: 2.0
    status: "No in-repo CI/CD workflows; relies entirely on external OpenShift CI (Prow)"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, .claude/ directory, or agent rules"
critical_gaps:
  - title: "No in-repo CI/CD pipelines"
    impact: "PRs merge without any automated validation; manifest errors caught only at deployment time"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No kustomize build validation"
    impact: "Broken kustomize overlays can merge and break downstream consumers (opendatahub-operator)"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No YAML schema validation (kubeconform/kubeval)"
    impact: "Invalid Kubernetes manifests can merge without detection"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No security scanning on container images or manifests"
    impact: "Vulnerable base images and insecure RBAC configurations ship without detection"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No manifest linting (yamllint, kube-linter)"
    impact: "YAML formatting issues, deprecated API versions, and anti-patterns go uncaught"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No coverage or test tracking"
    impact: "No visibility into which components have test coverage vs. which are untested"
    severity: "MEDIUM"
    effort: "4-8 hours"
quick_wins:
  - title: "Add kustomize build validation GitHub Action"
    effort: "2-3 hours"
    impact: "Catch broken overlays before merge; iterate all 144 kustomization.yaml files"
  - title: "Add kubeconform validation to PR workflow"
    effort: "2-3 hours"
    impact: "Validate all manifests against Kubernetes/OpenShift API schemas"
  - title: "Add yamllint configuration and CI check"
    effort: "1-2 hours"
    impact: "Enforce consistent YAML formatting across 641 YAML files"
  - title: "Add kube-linter for best practice checks"
    effort: "1-2 hours"
    impact: "Detect security misconfigurations, missing resource limits, and anti-patterns"
  - title: "Add Trivy scanning for Dockerfiles"
    effort: "1-2 hours"
    impact: "Detect vulnerabilities in base images used by manifests"
recommendations:
  priority_0:
    - "Add GitHub Actions workflow for PR validation with kustomize build, kubeconform, and yamllint"
    - "Implement kustomize build validation for all 144 kustomization.yaml files to prevent broken overlays"
    - "Add kubeconform or kubeval schema validation for all Kubernetes manifests"
    - "Add security scanning (Trivy, kube-linter) for container images and RBAC configurations"
  priority_1:
    - "Add kube-linter to enforce Kubernetes best practices (resource limits, security contexts)"
    - "Implement CODEOWNERS file to complement existing OWNERS files for GitHub-native review enforcement"
    - "Create component-level kustomize build tests to validate each component independently"
    - "Add deprecated API version detection to catch resources that need migration"
  priority_2:
    - "Create agent rules (.claude/rules/) for manifest authoring and testing patterns"
    - "Add architecture decision records for new component onboarding standards"
    - "Implement automated changelog generation from PR labels"
    - "Add pre-commit hooks for local developer validation"
---

# Quality Analysis: red-hat-data-services/odh-manifests

## Executive Summary
- Overall Score: 2.0/10
- Key Strengths: Well-organized Kustomize structure with 144 overlays across 20+ components; OWNERS files for per-component review; existing smoke test suite; ADR documentation
- Critical Gaps: No in-repo CI/CD; no manifest validation; no security scanning; no coverage tracking; no agent rules
- Agent Rules Status: Missing

This repository is a **Kustomize manifests collection** for Open Data Hub components. It contains 756 files (641 YAML manifests) organized across 20+ components including JupyterHub, KServe, ModelMesh, ODH Dashboard, and more. The quality posture is significantly below gold standard expectations for a repository that serves as the deployment foundation for the entire ODH platform.

## Quality Scorecard
| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 1.0/10 | No YAML validation, kustomize build checks, or schema validation |
| Integration/E2E | 4.0/10 | 15 bash smoke tests via OpenShift CI (Prow), basic coverage only |
| **Build Integration** | **1.0/10** | **No PR-time kustomize build validation or manifest linting** |
| Image Testing | 2.0/10 | Dockerfiles exist but no scanning, validation, or multi-arch |
| Coverage Tracking | 0.0/10 | No coverage tracking of any kind |
| CI/CD Automation | 2.0/10 | No in-repo CI/CD; relies entirely on external OpenShift CI (Prow) |
| Agent Rules | 0.0/10 | No CLAUDE.md, .claude/ directory, or agent rules |

## Critical Gaps

1. **No in-repo CI/CD pipelines**
   - Impact: PRs merge without any automated validation within the repository; manifest errors are only caught when downstream consumers (opendatahub-operator) attempt deployment
   - Severity: HIGH
   - Effort: 8-12 hours
   - Detail: The `.github/workflows/` directory does not exist. All CI relies on external OpenShift CI (Prow) configured in the `openshift/release` repository. This means PRs have no immediate feedback on manifest validity.

2. **No kustomize build validation**
   - Impact: Broken kustomize overlays can merge and break all downstream consumers. With 144 kustomization.yaml files, the risk of regression is high.
   - Severity: HIGH
   - Effort: 4-6 hours
   - Detail: No step validates that `kustomize build` succeeds for any of the 144 overlays. A typo in a resource reference or a missing patch file would only be caught at deployment time.

3. **No YAML schema validation (kubeconform/kubeval)**
   - Impact: Invalid Kubernetes manifests (wrong API version, missing required fields, wrong types) can merge without detection
   - Severity: HIGH
   - Effort: 4-6 hours
   - Detail: 641 YAML files are never validated against Kubernetes API schemas. This is especially risky for CRD manifests and operator resources.

4. **No security scanning**
   - Impact: Vulnerable base images, insecure RBAC configurations, and overprivileged service accounts ship without detection
   - Severity: HIGH
   - Effort: 4-6 hours
   - Detail: No Trivy, Snyk, kube-linter, or any other security tool is integrated. The Dockerfiles reference `registry.access.redhat.com/ubi8/ubi-minimal:latest` and `quay.io/centos/centos:stream8` without any vulnerability assessment.

5. **No manifest linting (yamllint, kube-linter)**
   - Impact: YAML formatting inconsistencies, deprecated API versions, and Kubernetes anti-patterns go undetected
   - Severity: MEDIUM
   - Effort: 2-4 hours

6. **No coverage or test tracking**
   - Impact: No visibility into which of the 20+ components have test coverage vs. which are completely untested
   - Severity: MEDIUM
   - Effort: 4-8 hours

## Quick Wins

1. **Add kustomize build validation GitHub Action**
   - Effort: 2-3 hours
   - Impact: Catches broken overlays before merge across all 144 kustomization.yaml files
   - Implementation:
   ```yaml
   # .github/workflows/validate.yml
   name: Validate Manifests
   on: [pull_request]
   jobs:
     kustomize-build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - name: Install kustomize
           run: |
             curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
             sudo mv kustomize /usr/local/bin/
         - name: Validate all kustomize builds
           run: |
             find . -name kustomization.yaml -exec dirname {} \; | while read dir; do
               echo "Building $dir..."
               kustomize build "$dir" > /dev/null || exit 1
             done
   ```

2. **Add kubeconform validation**
   - Effort: 2-3 hours
   - Impact: Validates all manifests against Kubernetes API schemas
   - Implementation:
   ```yaml
   - name: Validate with kubeconform
     run: |
       wget https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-amd64.tar.gz
       tar xzf kubeconform-linux-amd64.tar.gz
       find . -name kustomization.yaml -exec dirname {} \; | while read dir; do
         kustomize build "$dir" | ./kubeconform -strict -ignore-missing-schemas
       done
   ```

3. **Add yamllint configuration**
   - Effort: 1-2 hours
   - Impact: Enforce consistent YAML formatting across 641 files
   - Implementation:
   ```yaml
   # .yamllint.yml
   extends: default
   rules:
     line-length:
       max: 200
     truthy:
       check-keys: false
     document-start: disable
   ```

4. **Add kube-linter for best practices**
   - Effort: 1-2 hours
   - Impact: Detect missing resource limits, security context issues, and anti-patterns
   - Implementation:
   ```yaml
   - name: Run kube-linter
     uses: stackrox/kube-linter-action@v1
     with:
       directory: .
   ```

5. **Add Trivy scanning for Dockerfiles**
   - Effort: 1-2 hours
   - Impact: Detect vulnerabilities in base images
   - Implementation:
   ```yaml
   - name: Run Trivy
     uses: aquasecurity/trivy-action@master
     with:
       scan-type: 'config'
       scan-ref: '.'
   ```

## Detailed Findings

### CI/CD Pipeline

**Status**: Critically deficient - no in-repo CI/CD

The repository has **zero GitHub Actions workflows**. The `.github/` directory contains only issue templates and a PR template. All testing relies on external OpenShift CI (Prow) configured in the `openshift/release` repository.

**What exists**:
- `.aicoe-ci.yaml`: Configures aicoe-ci (Thoth) for image builds to `quay.io/modh/odh-manifests`
- `.thoth.yaml`: Thoth bot configuration for version management
- PR template with manual checklist (squash commits, JIRA links, testing instructions)
- External Prow configuration (in `openshift/release` repo) that spins up AWS clusters for testing

**What's missing**:
- No GitHub Actions workflows for PR validation
- No pre-merge kustomize build validation
- No YAML linting
- No schema validation
- No security scanning
- No automated checks visible to PR authors in the repo itself

### Test Coverage

**Status**: Basic smoke tests only

**Test Framework**: Custom bash test framework based on OpenShift's `hack/lib` utilities (peak framework)

**Test Inventory** (15 shell scripts, 594 total lines):
| Test File | Lines | What it Tests |
|-----------|-------|---------------|
| `radanalytics.sh` | 81 | Spark operator deployment and job |
| `airflow.sh` | 64 | Airflow cluster/base deployment |
| `jupyterhub.sh` | 48 | JupyterHub pods, traefik proxy, ODS-CI robot tests |
| `jupyterhub_load.sh` | 45 | JupyterHub load testing |
| `openshift-pipelines.sh` | 45 | Tekton pipeline execution |
| `trino.sh` | 42 | Trino coordinator and workers |
| `kafka.sh` | 37 | Kafka/Strimzi cluster |
| `dashboard.sh` | 36 | Dashboard deployment and UI health |
| `grafana.sh` | 36 | Grafana operator and dashboards |
| `odhargo.sh` | 35 | Argo Workflows hello-world |
| `prometheus.sh` | 31 | Prometheus operator |
| `seldon.sh` | 28 | Seldon deployment and model serving |
| `hue.sh` | 22 | Hue deployment |
| `superset.sh` | 22 | Superset deployment |
| `thriftserver.sh` | 22 | Thrift Server deployment |

**Gaps**:
- No tests for: KServe, ModelMesh, data-science-pipelines-operator, trustyai-service-operator, odh-notebook-controller, codeflare-stack, odh-model-controller
- Tests only check pod status and basic endpoint availability
- No manifest validity testing
- No kustomize overlay testing
- Tests require a full OpenShift cluster (no local validation possible)
- Robot Framework tests (ODS-CI) for JupyterHub UI are the most sophisticated

### Code Quality

**Status**: Minimal

- **Linting**: None. No yamllint, no YAML schema validation, no kube-linter
- **Pre-commit hooks**: None (`.pre-commit-config.yaml` does not exist)
- **Static analysis**: None (no CodeQL, gosec, or similar)
- **OWNERS files**: 7 OWNERS files providing per-component review assignment (root + 6 components)
- **PR template**: Manual checklist for squashed commits, JIRA links, upstream tagging, and build announcements
- **ADR**: Architecture Decision Records exist in `docs/adr/` (release policy documented)

### Container Images

**Status**: Minimal

**Root Dockerfile** (`Dockerfile`):
- UBI8 minimal base image
- Simply tars manifests into `/opt/odh-manifests.tar.gz`
- Used for distributing manifests as a container

**Test Dockerfile** (`tests/Dockerfile`):
- CentOS Stream 8 base
- Installs Chrome/ChromeDriver for UI testing (Robot Framework)
- Installs Go, Python, oc CLI
- Clones test frameworks (peak, ods-ci)
- No multi-stage build optimization

**Gaps**:
- No vulnerability scanning on either image
- No multi-architecture support
- No SBOM generation
- No image signing/attestation
- Test image uses a very old ChromeDriver version (97)
- CentOS Stream 8 is approaching EOL

### Security

**Status**: No security practices

- No container image scanning (Trivy, Snyk, Grype)
- No SAST/CodeQL integration
- No dependency scanning
- No secret detection (Gitleaks, TruffleHog)
- No kube-linter for security best practices in manifests
- No RBAC validation for service accounts
- RBAC configurations exist in multiple components but are never validated
- `.dockerignore` excludes tests, docs, and CI files from image builds (good)

### Agent Rules (Agentic Flow Quality)

**Status**: Missing

- No `CLAUDE.md` or `AGENTS.md` in root
- No `.claude/` directory
- No `.claude/rules/` for test creation rules
- No `.claude/skills/` for custom skills
- No testing documentation beyond `tests/TESTING.md` (which describes the external Prow setup)

**Recommendation**: Generate manifest validation and testing rules with `/test-rules-generator` to guide AI agents in:
- Writing kustomize overlay tests
- Validating YAML schema compliance
- Creating smoke test scripts for new components
- Ensuring RBAC configurations follow least-privilege patterns

## Recommendations

### Priority 0 (Critical)

- **Add GitHub Actions workflow for PR validation**: Create `.github/workflows/validate.yml` with kustomize build, kubeconform, and yamllint checks. This is the single highest-impact improvement — PRs currently merge with zero automated validation.
- **Implement kustomize build validation**: Iterate all 144 `kustomization.yaml` files and verify `kustomize build` succeeds. This prevents broken overlays from reaching downstream consumers.
- **Add kubeconform schema validation**: Validate all rendered manifests against Kubernetes API schemas. Use `--ignore-missing-schemas` for CRDs and custom resources.
- **Add security scanning**: Integrate Trivy for Dockerfile scanning and kube-linter for manifest security best practices (resource limits, security contexts, network policies).

### Priority 1 (High Value)

- **Add kube-linter**: Enforce Kubernetes best practices across all manifests — missing resource limits, missing security contexts, writable root filesystems, etc.
- **Create component-level kustomize build tests**: Each component directory should have its overlays validated independently, with clear error messages identifying which component failed.
- **Add deprecated API version detection**: Use `pluto` or similar tool to detect deprecated/removed Kubernetes API versions before they break on newer cluster versions.
- **Implement CODEOWNERS**: Complement existing OWNERS files with GitHub's native CODEOWNERS for automatic review assignment.

### Priority 2 (Nice-to-Have)

- **Create agent rules** (`.claude/rules/`): Document manifest authoring patterns, kustomize overlay conventions, and testing expectations for AI agents.
- **Add pre-commit hooks**: Local validation with yamllint, kustomize build, and kubeconform before developers push.
- **Implement automated changelog**: Replace manual CHANGELOG.md with automated generation from PR labels.
- **Update test infrastructure**: Modernize the bash-based test framework (CentOS Stream 8 EOL, ChromeDriver v97 ancient). Consider migrating to a more maintainable test framework.
- **Add component coverage dashboard**: Track which of the 20+ components have smoke tests and which are untested.

## Comparison to Gold Standards

| Dimension | odh-manifests | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|-----------|---------------|----------------------|-------------------|---------------|
| In-repo CI/CD | None | Comprehensive GH Actions | Multi-layer CI | Extensive CI |
| Manifest Validation | None | Kustomize + schema | N/A | CRD validation |
| Unit Tests | None | Jest + Go testing | Pytest | Go test + coverage |
| Integration/E2E | 15 bash scripts (external) | Cypress + Robot | Image build + deploy | Multi-version E2E |
| Coverage Tracking | None | Codecov enforced | N/A | Codecov enforced |
| Security Scanning | None | Trivy + CodeQL | Trivy | Trivy + SAST |
| Pre-commit Hooks | None | ESLint + Prettier | N/A | golangci-lint |
| Agent Rules | None | Comprehensive | Partial | None |
| Image Testing | None | Build + startup | 5-layer validation | Build + deploy |
| YAML Linting | None | ESLint (JSON/YAML) | N/A | yamllint |

## File Paths Reference

### Repository Structure
- `Dockerfile` - Manifest distribution image
- `Makefile` - Release automation only
- `version.py` - Version tracking (v1.1.0)
- `OWNERS` - Root reviewers/approvers
- `.aicoe-ci.yaml` - Thoth CI configuration
- `.github/PULL_REQUEST_TEMPLATE.md` - PR checklist

### Component Directories (20+)
- `odh-dashboard/` - Dashboard manifests (base + overlays)
- `kserve/` - KServe manifests (base + hack)
- `model-mesh/` - ModelMesh controller manifests
- `data-science-pipelines-operator/` - DSPO manifests
- `trustyai-service-operator/` - TrustyAI manifests
- `odh-notebook-controller/` - Notebook controller manifests
- `codeflare-stack/` - CodeFlare manifests
- `jupyterhub/` - JupyterHub manifests
- `kafka/` - Kafka/Strimzi manifests
- `grafana/` - Grafana manifests
- `prometheus/` - Prometheus manifests

### Test Infrastructure
- `tests/basictests/*.sh` - 15 component smoke tests
- `tests/scripts/installandtest.sh` - Test runner
- `tests/scripts/install.sh` - ODH installation
- `tests/Dockerfile` - Test container image
- `tests/Makefile` - Test build/run/clean
- `tests/TESTING.md` - Testing documentation
- `tests/resources/` - Test fixtures and configs

### Documentation
- `README.md` - Project overview
- `RELEASE.md` - Release process
- `CHANGELOG.md` - Version history
- `docs/adr/` - Architecture Decision Records
