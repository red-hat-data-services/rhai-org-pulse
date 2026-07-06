---
repository: "opendatahub-io/rhaii-on-xks"
overall_score: 7.1
scorecard:
  - dimension: "Unit Tests"
    score: 3.0
    status: "No unit tests — repo is infrastructure-as-code (Helm charts + shell scripts), no application code to unit-test"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Excellent KinD-based E2E with mock vLLM, per-chart conformance tests, RHCL integration tests"
  - dimension: "Build Integration"
    score: 6.5
    status: "Helm lint + template validation on PR; no Konflux simulation; security checks verify image digests and registries"
  - dimension: "Image Testing"
    score: 6.0
    status: "Mock vLLM image built and tested in E2E; validation Containerfile present; no Trivy/Snyk scanning"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "No coverage tooling — no codecov, no test-to-code ratio tracking"
  - dimension: "CI/CD Automation"
    score: 7.5
    status: "4 workflows (E2E mock, RHCL CI, link-check, docs); label-gated E2E; well-structured Makefile; shellcheck in lint target"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No .claude/ directory, no CLAUDE.md, no AGENTS.md — zero AI agent guidance"
critical_gaps:
  - title: "No container vulnerability scanning"
    impact: "Security vulnerabilities in base images or dependencies go undetected until production"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No SAST/CodeQL integration"
    impact: "Static analysis gaps in Python validation scripts and shell scripts"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Cannot measure test effectiveness or enforce minimum coverage thresholds"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "E2E tests are label-gated (manual trigger)"
    impact: "E2E tests can be skipped on PRs — regressions may merge without validation"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No agent rules for test creation"
    impact: "AI-assisted contributions lack guidance for test patterns and quality standards"
    severity: "LOW"
    effort: "3-4 hours"
quick_wins:
  - title: "Add Trivy container scanning to RHCL CI workflow"
    effort: "1-2 hours"
    impact: "Catch CVEs in base images and dependencies before merge"
  - title: "Add shellcheck to PR workflow"
    effort: "1 hour"
    impact: "Currently only in local make lint — adding to CI prevents shell script bugs"
  - title: "Add yamllint to PR workflow"
    effort: "1 hour"
    impact: "Catch YAML formatting issues in Helm values files automatically"
  - title: "Pin all GitHub Actions by SHA in link-check and docs workflows"
    effort: "30 minutes"
    impact: "link-check.yaml and docs.yml use @v5 tags instead of SHA pins — supply chain risk"
  - title: "Create basic CLAUDE.md with test contribution guidelines"
    effort: "2 hours"
    impact: "Guide AI-assisted PRs toward correct testing patterns"
recommendations:
  priority_0:
    - "Add container vulnerability scanning (Trivy) to CI — at minimum on the validation Containerfile and mock-vllm Dockerfile"
    - "Add CodeQL or Semgrep for SAST analysis on Python scripts and shell scripts"
    - "Pin all GitHub Action references by SHA (link-check.yaml and docs.yml currently use unpinned @v5 tags)"
  priority_1:
    - "Promote shellcheck + yamllint from local-only make lint to a CI workflow that runs on PRs"
    - "Add pre-commit hooks (.pre-commit-config.yaml) for shellcheck, yamllint, and helm lint"
    - "Create comprehensive agent rules (.claude/rules/) for conformance test and chart test patterns"
    - "Add Gitleaks or TruffleHog for secret detection in CI"
  priority_2:
    - "Add chart unit tests using helm-unittest for value permutations"
    - "Add coverage tracking for Python preflight validation scripts (pytest + codecov)"
    - "Consider making E2E tests auto-trigger on chart changes (not just label-gated)"
    - "Add SBOM generation for the validation container image"
---

# Quality Analysis: rhaii-on-xks

## Executive Summary
- **Overall Score: 7.1/10**
- **Repository Type**: Infrastructure-as-Code — Helm charts for deploying Red Hat AI Inference Stack on Kubernetes (AKS, CoreWeave, OpenShift)
- **Primary Languages**: Shell (bash), Python, YAML/Helm templates
- **Key Strengths**: Excellent E2E testing with KinD + mock vLLM, comprehensive conformance test framework, strong RHCL CI with security checks, well-organized Makefile
- **Critical Gaps**: No container vulnerability scanning, no SAST integration, no coverage tracking, unpinned GitHub Actions in some workflows
- **Agent Rules Status**: Missing — no `.claude/` directory or `CLAUDE.md`

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 3.0/10 | No unit tests — repo is infrastructure (Helm charts + scripts), not application code |
| Integration/E2E | 8.5/10 | KinD-based E2E with mock vLLM, per-chart conformance tests, RHCL integration tests |
| Build Integration | 6.5/10 | Helm lint + template validation on PR; no Konflux sim; RHCL security checks are strong |
| Image Testing | 6.0/10 | Mock vLLM image built and tested in E2E; validation Containerfile; no vuln scanning |
| Coverage Tracking | 2.0/10 | No coverage tooling of any kind |
| CI/CD Automation | 7.5/10 | 4 workflows, label-gated E2E, structured Makefile, shellcheck in lint target |
| Agent Rules | 0.0/10 | No .claude/ directory, no CLAUDE.md, no AGENTS.md |

## Critical Gaps

### 1. No Container Vulnerability Scanning
- **Impact**: CVEs in UBI base images, Python packages, or mock-vllm dependencies go undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Neither Trivy, Snyk, nor any scanning tool is integrated. The `validation/Containerfile` uses `ubi9/ubi-minimal:9.5` and installs packages via microdnf — these should be scanned. The `test/mock-vllm/Dockerfile` is also unscanned.

### 2. No SAST/CodeQL Integration
- **Impact**: Static analysis gaps in `validation/llmd_xks_preflight.py` (584 lines), conformance scripts (2000+ lines of bash), and utility scripts
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: Python and shell scripts have no static analysis beyond local `make lint` (which runs shellcheck/flake8 only if installed locally).

### 3. No Coverage Tracking
- **Impact**: No visibility into test effectiveness; no enforcement thresholds
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: No codecov, coveralls, or any coverage reporting. The Python preflight script could have pytest coverage; shell scripts could have bash coverage tooling.

### 4. E2E Tests Are Label-Gated
- **Impact**: E2E tests require a maintainer to manually add the `run-e2e-test` label — regressions can merge without E2E validation
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: The `e2e-mock-test.yml` uses `pull_request_target` with label gating. While this is a reasonable security pattern (the test deploys infrastructure with secrets), it means E2E tests can be forgotten or skipped.

### 5. Unpinned GitHub Actions in Some Workflows
- **Impact**: Supply chain attack vector — unpinned actions could be hijacked
- **Severity**: MEDIUM
- **Effort**: 30 minutes
- **Details**: `link-check.yaml` uses `actions/checkout@v5` and `lycheeverse/lychee-action@v2` (tag-based, not SHA-pinned). `docs.yml` uses `actions/checkout@v5`, `actions/setup-python@v5`, etc. In contrast, `e2e-mock-test.yml` and `rhcl-ci.yaml` correctly pin all actions by SHA.

## Quick Wins

### 1. Add Trivy Scanning to RHCL CI (1-2 hours)
```yaml
  trivy-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - uses: aquasecurity/trivy-action@0.28.0
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'HIGH,CRITICAL'
```

### 2. Add shellcheck + yamllint to CI (1 hour)
Create a `lint.yaml` workflow that runs on PRs:
```yaml
name: Lint
on:
  pull_request:
    paths: ['**/*.sh', '**/*.yaml', '**/*.yml']
jobs:
  shellcheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: shellcheck -x scripts/*.sh test/*.sh charts/*/test/*.sh
  yamllint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install yamllint && yamllint -d '{extends: relaxed, rules: {line-length: {max: 200}}}' values.yaml charts/*/values.yaml
```

### 3. Pin GitHub Actions by SHA (30 minutes)
Replace tag-based action references in `link-check.yaml` and `docs.yml` with SHA-pinned versions matching the pattern already used in `e2e-mock-test.yml` and `rhcl-ci.yaml`.

### 4. Create Basic CLAUDE.md (2 hours)
Add test contribution guidelines so AI-assisted PRs follow the established patterns (conformance tests, chart tests, mock-based E2E).

## Detailed Findings

### CI/CD Pipeline

**Workflows (4 total):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `e2e-mock-test.yml` | PR label `run-e2e-test` | Full KinD E2E: build mock, deploy all, run conformance |
| `rhcl-ci.yaml` | PR on `charts/rhcl/**` | Helm lint, template (K8s + OCP), security checks |
| `link-check.yaml` | PR on `**/*.md` | Lychee broken link detection |
| `docs.yml` | Push to main | Build and deploy docs to GitHub Pages |

**Strengths:**
- E2E workflow is comprehensive: KinD cluster → deploy all operators → mock model → conformance tests → cleanup on failure with debug info collection
- RHCL CI has excellent security checks: verifies no hardcoded secrets, all images from `registry.redhat.io`, digest pinning, CRDs in `crds/` directory, security contexts
- E2E uses `pull_request_target` with label gating — secure pattern for workflows needing secrets
- E2E removes the label on new pushes, forcing re-review before re-running
- Action SHA pinning in `e2e-mock-test.yml` and `rhcl-ci.yaml` (but not in `link-check.yaml` and `docs.yml`)

**Gaps:**
- No dedicated lint CI workflow (shellcheck/yamllint only run locally via `make lint`)
- No chart testing workflow for cert-manager, sail-operator, or lws-operator charts
- No Dependabot or Renovate for dependency updates
- `link-check.yaml` and `docs.yml` use tag-based action pinning (@v5) instead of SHA

### Test Coverage

**Test Framework: Shell-based conformance + Python preflight**

The test infrastructure is well-designed for an infrastructure-as-code repo:

1. **E2E Mock Tests** (`test/mock-vllm/`, `test/deploy-model.sh`)
   - Custom mock vLLM server (Python, 114 lines) implementing OpenAI-compatible API
   - Supports HTTPS with KServe mTLS behavior
   - Deploy script creates LLMInferenceService with mock image, waits for ready, tests inference
   - Runs in KinD cluster with full operator stack

2. **Conformance Tests** (`test/conformance/verify-llm-d-deployment.sh`)
   - 2,125 lines of comprehensive deployment validation
   - 11 deployment profiles (7 upstream + 4 KServe) with profile-specific validations
   - Auto-detection: cloud platform (AKS, EKS, GKE, OpenShift, CoreWeave), inference service, model
   - Validates: cluster connectivity, operator health, pod status, InferencePool, HTTPRoute, Gateway, inference readiness, monitoring stack
   - Supports both upstream Helm-based and KServe CRD-based deployments

3. **RHCL Integration Tests** (`test/conformance/verify-rhcl-deployment.sh`)
   - Full integration test: deploys Gateway + HTTPRoute + AuthPolicy + RateLimitPolicy
   - Tests: unauthenticated rejection (401/403), authenticated success (200), rate limiting (429)
   - In-cluster curl pod for testing through Istio gateway
   - Validates operator-created resources (AuthConfig, WasmPlugin)

4. **RHCL DNS Tests** (`test/conformance/verify-rhcl-dns.sh`)
   - DNS operator validation without cloud credentials

5. **Per-Chart Tests:**
   - cert-manager: self-signed certificate test, CA test
   - sail-operator: operator readiness, CRD, injection tests
   - lws-operator: ring topology test, network test

6. **Preflight Validation** (`validation/llmd_xks_preflight.py`)
   - 584-line Python script for pre-deployment cluster validation
   - Tests: cloud provider detection, GPU availability, instance types, operator CRDs, deployment readiness
   - Supports: Azure AKS, CoreWeave
   - Containerized: runs via Containerfile with configargparse + kubernetes client

**Test-to-Code Ratio:**
- ~4,415 lines of test/validation scripts
- ~2,500 lines of Helm templates/values/helmfile
- ~500 lines of operational scripts
- Ratio: ~1.5:1 (tests:code) — excellent for an infrastructure repo

### Code Quality

**Linting:**
- `make lint` target runs: `helm lint` (all charts), `yamllint` (values files), `shellcheck` (scripts)
- `validation/Makefile` has `flake8` and `autopep8` targets for Python
- No CI enforcement — lint is local-only
- `.lychee.toml` configures link checking with sensible exclusions

**Pre-commit Hooks:**
- None — no `.pre-commit-config.yaml`

**Static Analysis:**
- No SAST (CodeQL, gosec, Semgrep)
- No dependency scanning (Dependabot, Renovate)
- No secret detection (Gitleaks, TruffleHog)

### Container Images

**Images Built:**
1. `validation/Containerfile` — UBI9-minimal based preflight checker
   - Non-root user (UID 1001)
   - Minimal packages (python3 + kubernetes client)
   - No vulnerability scanning

2. `test/mock-vllm/Dockerfile` — Mock vLLM server for E2E testing
   - No vulnerability scanning
   - Built and loaded into KinD during E2E

**Strengths:**
- RHCL CI validates all chart images use `registry.redhat.io` and SHA256 digest pinning
- RHCL CI checks security contexts (readOnlyRootFilesystem)

**Gaps:**
- No Trivy/Snyk scanning on any images
- No SBOM generation
- No multi-architecture validation
- No image signing/attestation

### Security

**Strengths:**
- RHCL CI workflow has excellent security checks:
  - No hardcoded secrets in values.yaml
  - All images from trusted registries (registry.redhat.io)
  - Image digest pinning enforcement
  - Security context validation
- E2E workflow uses `pull_request_target` with label gating (prevents untrusted code from accessing secrets)
- E2E removes label on new pushes (forces re-review)
- `permissions: {}` default in E2E workflow (least privilege)
- Validation container runs as non-root user

**Gaps:**
- No container vulnerability scanning
- No SAST integration
- No secret detection in CI
- No dependency scanning
- Some workflows use unpinned GitHub Actions

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: No guidance for AI-assisted test creation, chart development, or conformance test patterns
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - Conformance test patterns (profile-based validation)
  - Chart test patterns (helm lint, template, functional tests)
  - Mock vLLM test patterns
  - Python preflight test patterns

## Recommendations

### Priority 0 (Critical)
1. **Add container vulnerability scanning** — Integrate Trivy into CI for both the validation Containerfile and mock-vllm Dockerfile. Even a filesystem scan catches dependency CVEs.
2. **Add SAST integration** — CodeQL for Python scripts, or Semgrep for broader shell + Python coverage.
3. **Pin all GitHub Actions by SHA** — `link-check.yaml` and `docs.yml` currently use `@v5` tags. Follow the pattern already established in `e2e-mock-test.yml`.

### Priority 1 (High Value)
1. **Promote lint checks to CI** — Create a dedicated lint workflow running shellcheck, yamllint, and helm lint on PRs.
2. **Add pre-commit hooks** — `.pre-commit-config.yaml` with shellcheck, yamllint, helm-lint hooks.
3. **Add secret detection** — Gitleaks or TruffleHog in CI to catch accidentally committed credentials.
4. **Create agent rules** — `.claude/rules/` with conformance-test, chart-test, and mock-test patterns.

### Priority 2 (Nice-to-Have)
1. **Add helm-unittest** — Chart unit tests for value permutations (e.g., verify template output with different `platform.type` values).
2. **Add coverage tracking** — pytest for Python preflight scripts with codecov integration.
3. **Auto-trigger E2E on chart changes** — Consider running a subset of E2E tests automatically when `charts/` or `test/` files change, rather than requiring manual label.
4. **Add SBOM generation** — For the validation container image, generate SBOM during build.
5. **Add Dependabot/Renovate** — Automated dependency updates for GitHub Actions and Python packages.

## Comparison to Gold Standards

| Dimension | rhaii-on-xks | odh-dashboard | notebooks | kserve |
|-----------|-------------|---------------|-----------|--------|
| Unit Tests | 3/10 (N/A for infra) | 9/10 | 6/10 | 9/10 |
| Integration/E2E | 8.5/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 6.5/10 | 8/10 | 7/10 | 8/10 |
| Image Testing | 6/10 | 7/10 | 9/10 | 7/10 |
| Coverage Tracking | 2/10 | 9/10 | 5/10 | 9/10 |
| CI/CD Automation | 7.5/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 0/10 | 8/10 | 3/10 | 2/10 |
| **Overall** | **7.1** | **8.6** | **7.0** | **8.1** |

**Note**: The low unit test score is expected for an infrastructure-as-code repo — the test architecture appropriately focuses on integration and conformance testing. The 8.5/10 E2E score reflects a genuinely strong testing strategy for this repo type.

## File Paths Reference

### CI/CD
- `.github/workflows/e2e-mock-test.yml` — Full E2E with KinD + mock vLLM
- `.github/workflows/rhcl-ci.yaml` — RHCL chart linting + security checks
- `.github/workflows/link-check.yaml` — Markdown link validation
- `.github/workflows/docs.yml` — GitHub Pages deployment
- `Makefile` — Deploy, undeploy, test, lint targets

### Testing
- `test/conformance/verify-llm-d-deployment.sh` — 2,125-line conformance test framework
- `test/conformance/verify-rhcl-deployment.sh` — RHCL integration test
- `test/conformance/verify-rhcl-dns.sh` — RHCL DNS operator test
- `test/deploy-model.sh` — Mock model deployment for E2E
- `test/mock-vllm/server.py` — OpenAI-compatible mock server
- `test/mock-vllm/Dockerfile` — Mock server container
- `charts/cert-manager-operator/test/` — cert-manager tests (self-signed, CA)
- `charts/sail-operator/test/` — Sail operator tests (operator, CRD, injection)
- `charts/lws-operator/test/` — LWS tests (ring, network)

### Validation
- `validation/llmd_xks_preflight.py` — Pre-deployment cluster validation (584 lines)
- `validation/Containerfile` — UBI9-minimal container for preflight
- `validation/Makefile` — Build, run, lint targets for validation

### Charts
- `charts/cert-manager-operator/` — cert-manager operator (v1.0.2)
- `charts/sail-operator/` — Istio/Sail operator (v1.0.0)
- `charts/lws-operator/` — LeaderWorkerSet operator (v1.0.0)
- `charts/rhcl/` — Red Hat Connectivity Link (v1.2.0)
- `charts/maas/` — Models as a Service (v0.1.0)

### Configuration
- `helmfile.yaml.gotmpl` — Helmfile orchestrating all chart deployments
- `values.yaml` — Default values for helmfile
- `.lychee.toml` — Link checker configuration
- `OWNERS` — Kubernetes-style code owners
