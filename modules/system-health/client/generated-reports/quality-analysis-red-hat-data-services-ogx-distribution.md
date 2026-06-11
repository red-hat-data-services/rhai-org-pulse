---
repository: "red-hat-data-services/ogx-distribution"
overall_score: 6.7
scorecard:
  - dimension: "Unit Tests"
    score: 1.0
    status: "No unit tests — repo is a distribution/packaging project with no library code to unit-test"
    weight: 0.10
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Strong multi-provider integration tests (vLLM, OpenAI, Vertex AI, Gemini) plus Showroom E2E on real OpenShift"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR builds image and runs smoke + integration tests; Konflux PR builds available on-demand via label/comment"
  - dimension: "Image Testing"
    score: 8.0
    status: "Multi-arch builds (amd64/arm64), smoke tests validate health/inference/DB/file-processor, vLLM image tested separately"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tooling — shell/config-based project with no code coverage mechanism"
    weight: 0.05
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "14 workflows, reusable composite actions, concurrency control, GHA caching, Mergify auto-merge, Dependabot/Renovate, Slack notifications"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules or test automation guidance"
critical_gaps:
  - title: "No security scanning (Trivy, Snyk, CodeQL, SAST)"
    impact: "Container images and dependencies are not scanned for vulnerabilities before merge or publish"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No SBOM generation or image signing"
    impact: "Supply chain security requirements (SLSA, FedRAMP) not met; no provenance attestation"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "No guardrails for AI-generated contributions; no test patterns, coding standards, or review checklists"
    severity: "MEDIUM"
    effort: "3-4 hours"
  - title: "Smoke/integration tests are bash-only with no JUnit output"
    impact: "Smoke test results not machine-parseable; no trend tracking, no PR-level test reporting for core tests"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "Containerfile.in / Dockerfile.konflux drift risk"
    impact: "Two separate Containerfiles for upstream and Konflux can diverge silently; Mergify warns but doesn't enforce"
    severity: "MEDIUM"
    effort: "6-10 hours"
quick_wins:
  - title: "Add Trivy container scanning to PR workflow"
    effort: "2-3 hours"
    impact: "Catch CVEs in base images and pip dependencies before merge"
  - title: "Generate SBOM with Syft in publish step"
    effort: "1-2 hours"
    impact: "Meet supply chain compliance requirements with minimal CI change"
  - title: "Add JUnit XML output to smoke.sh via bash-based tap-to-junit or simple wrapper"
    effort: "3-4 hours"
    impact: "Enable test trend tracking and PR annotations for smoke tests"
  - title: "Create basic CLAUDE.md with contribution and testing guidelines"
    effort: "1-2 hours"
    impact: "Guide AI-assisted contributions toward project standards"
recommendations:
  priority_0:
    - "Add container vulnerability scanning (Trivy or Grype) to the PR build-test job"
    - "Add SBOM generation and cosign image signing to the publish job"
    - "Add secret detection (Gitleaks) to pre-commit and CI"
  priority_1:
    - "Convert smoke.sh to produce JUnit XML output for PR test reporting"
    - "Add Containerfile drift detection CI check comparing Containerfile.in vs Dockerfile.konflux"
    - "Create CLAUDE.md / .claude/rules/ with testing and contribution guidelines"
    - "Add weekly Trivy scheduled scan for published images"
  priority_2:
    - "Add load/performance testing for the OGX server endpoint"
    - "Add contract tests for the OpenAI-compatible API surface"
    - "Consider adding shellcheck to CI as a separate linting step (currently in pre-commit only)"
---

# Quality Analysis: ogx-distribution

## Executive Summary

- **Overall Score: 6.7/10**
- **Repository Type**: Distribution/packaging project — builds, tests, and publishes the OGX (OpenAI-compatible GenAI eXchange) container image for Red Hat AI
- **Primary Languages**: Shell (tests, build scripts), Python (build tooling, reporting), YAML (CI/CD, config)
- **Key Strengths**: Excellent CI/CD automation with 14 workflows, strong multi-provider integration testing (vLLM, OpenAI, Vertex AI, Gemini), multi-arch container builds, robust smoke testing, Mergify auto-merge, and comprehensive test reporting via GitHub Pages
- **Critical Gaps**: No security scanning (Trivy/Snyk/CodeQL), no SBOM generation or image signing, no agent rules, smoke tests lack structured output (JUnit)
- **Agent Rules Status**: Missing — no CLAUDE.md, no .claude/ directory

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 1.0/10 | 10% | No unit tests — distribution project, no library code to test |
| Integration/E2E | 8.5/10 | 25% | Multi-provider integration tests + Showroom E2E on OpenShift |
| Build Integration | 7.0/10 | 15% | PR builds image + smoke/integration; Konflux on-demand |
| Image Testing | 8.0/10 | 20% | Multi-arch, smoke health/inference/DB/file-processor validation |
| Coverage Tracking | 1.0/10 | 5% | No coverage tooling (shell/config project) |
| CI/CD Automation | 9.0/10 | 20% | 14 workflows, reusable actions, Mergify, Dependabot, Renovate |
| Agent Rules | 0.0/10 | 5% | No agent rules or AI contribution guidelines |

## Critical Gaps

### 1. No Security Scanning
- **Impact**: Container images published to quay.io are not scanned for CVEs. Pip dependencies (ogx, ogx-api, ogx-client, torch, etc.) could contain known vulnerabilities that go undetected.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No Trivy, Snyk, Grype, CodeQL, or any SAST tool is configured. Neither the GitHub workflows nor the Tekton pipelines include vulnerability scanning. The `.pre-commit-config.yaml` includes `detect-private-key` (basic secret detection) but no dependency or container scanning.

### 2. No SBOM Generation or Image Signing
- **Impact**: Published images lack provenance attestation. Supply chain security requirements (SLSA Level 2+, FedRAMP) cannot be met.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The publish jobs push multi-arch images to quay.io but do not generate SBOMs (Syft) or sign images (cosign). The Konflux pipeline may handle this downstream, but the upstream GitHub CI does not.

### 3. No Agent Rules
- **Impact**: AI-assisted contributions (Claude Code, Copilot, etc.) have no guardrails — no coding standards, no test patterns, no review checklists.
- **Severity**: MEDIUM
- **Effort**: 3-4 hours
- **Details**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory exists. Contributors using AI tools receive no guidance on testing expectations, shell scripting standards, or Containerfile conventions.

### 4. Smoke Tests Lack Structured Output
- **Impact**: The core `smoke.sh` (303 lines) produces human-readable output but no machine-parseable results (JUnit XML). This prevents PR-level test annotations, trend tracking, and failure aggregation.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: The integration tests (`run_integration_tests.sh`) use upstream pytest with `--junit-xml`, but the smoke tests (model listing, inference, PostgreSQL validation, file processor) are pure bash with no structured output. The weekly response tests do produce JUnit via pytest and publish reports via `dorny/test-reporter`.

### 5. Containerfile Drift Risk
- **Impact**: `distribution/Containerfile` (upstream) and `Dockerfile.konflux` (downstream) can diverge. Mergify posts a comment warning when `Containerfile.in` changes, but there's no automated check.
- **Severity**: MEDIUM
- **Effort**: 6-10 hours

## Quick Wins

### 1. Add Trivy Container Scanning (2-3 hours)
Add Trivy scanning to the `build-test` job after the image build step:
```yaml
- name: Scan image with Trivy
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: '${{ env.IMAGE_NAME }}:${{ github.sha }}'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
```

### 2. Generate SBOM with Syft (1-2 hours)
Add SBOM generation to the publish job:
```yaml
- name: Generate SBOM
  uses: anchore/sbom-action@v0
  with:
    image: '${{ env.IMAGE_NAME }}:${{ github.sha }}'
    format: spdx-json
    output-file: sbom.spdx.json
```

### 3. Add JUnit Output to Smoke Tests (3-4 hours)
Wrap `smoke.sh` test results in JUnit XML format for PR reporting. Minimal approach: emit a JUnit XML file at the end of the script using the `failed_checks` array that already tracks failures.

### 4. Create CLAUDE.md (1-2 hours)
Create a basic `CLAUDE.md` covering:
- Testing expectations (smoke tests must pass, integration tests for inference changes)
- Shell scripting standards (shellcheck compliance, `set -euo pipefail`)
- Containerfile conventions (auto-generated from `build.py`, don't edit directly)

## Detailed Findings

### CI/CD Pipeline

**Workflows (14 total)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `redhat-distro-container.yml` | PR, push, schedule (daily 6AM), dispatch | Build, smoke test, integration test, publish OGX image |
| `vllm-cpu-container.yml` | PR, push, dispatch | Build and test vLLM CPU container image |
| `pre-commit.yml` | PR, push | Run pre-commit hooks (ruff, shellcheck, actionlint, etc.) |
| `semantic-pr.yml` | PR | Enforce semantic PR title conventions |
| `test-pr-in-showroom.yml` | Schedule (daily 8AM), dispatch | E2E test on real OpenShift via Showroom |
| `responses-weekly.yml` | Schedule (Sunday 10PM), dispatch | Weekly multi-provider response test suite |
| `responses-openai.yml` | Callable, dispatch | OpenAI provider response tests |
| `responses-vertexai.yml` | Callable, dispatch | Vertex AI provider response tests |
| `responses-vllm-maas.yml` | Callable, dispatch | vLLM MaaS provider response tests |
| `update-ogx-version.yml` | Repository dispatch | Auto-update OGX version with PR creation |
| `update-wheels.yml` | Dispatch | Update Python wheels |
| `stale_bot.yml` | Schedule | Mark stale issues/PRs |

**Strengths**:
- Concurrency control on all workflows (`cancel-in-progress: true`)
- GHA build caching (`type=gha,mode=max`) for Docker builds
- Reusable composite actions for vLLM, PostgreSQL, and server setup
- Multi-arch matrix builds (amd64 + arm64)
- Credential validation before test execution (OpenAI, Gemini, Vertex AI, MaaS)
- Graceful degradation for fork/Dependabot PRs (secrets unavailable)
- Slack notifications on failure/success
- Mergify auto-merge with proper conditions (2 approvals, checks passed)
- Dependabot for GitHub Actions + Docker + uv dependencies
- Renovate for Konflux-specific dependency updates
- Semantic PR title enforcement

**Gaps**:
- No security scanning in any workflow
- No SBOM or image signing
- Smoke tests don't produce structured output

### Test Coverage

**Smoke Tests** (`tests/smoke.sh` — 303 lines):
- Container startup and health check (60s timeout with retry)
- Model listing validation (all configured providers)
- OpenAI-compatible inference validation ("What color is grass?" → expects "green")
- PostgreSQL table creation verification (ogx_kvstore, inference_store)
- PostgreSQL data population check (inference_store row count)
- File processor validation (pypdf with known marker text)
- Dynamic provider inclusion based on available credentials
- Comprehensive failure tracking with `failed_checks` array

**Integration Tests** (`tests/run_integration_tests.sh` — 153 lines):
- Clones upstream ogx repo at the pinned version
- Runs upstream pytest suite against the built distribution image
- Tests inference endpoints across multiple providers (vLLM, OpenAI, Vertex AI, Gemini)
- JUnit XML output for reporting
- Well-documented test skip list with rationale for each skip

**Response Tests** (weekly, via reusable workflows):
- Multi-provider matrix testing (OpenAI, Vertex AI, vLLM MaaS)
- Uses upstream ogx test suite pinned to specific commit
- JUnit XML output with `dorny/test-reporter` for GitHub annotations
- 90-day artifact retention
- Historical trend reports published to GitHub Pages

**E2E / Showroom Tests** (`test-pr-in-showroom.yml`):
- Builds image and pushes to OpenShift internal registry
- Deploys on real OpenShift cluster with operator
- Runs provisioning and test scripts
- Debug capture of OpenShift state on failure

**Gaps**:
- No unit tests (understandable for a distribution project)
- No contract tests for the OpenAI-compatible API surface
- No load/performance tests
- Smoke tests are pure bash with no structured output

### Code Quality

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- `ruff` (Python linter + formatter) — fix mode enabled
- `shellcheck` (shell script linter)
- `actionlint` (GitHub Actions linter)
- `check-merge-conflict`, `trailing-whitespace`, `check-yaml`, `detect-private-key`
- `check-added-large-files` (1MB limit)
- `no-commit-to-branch` (prevents direct commits to main)
- `check-executables-have-shebangs`, `mixed-line-ending` (LF enforced)
- Custom hooks: `pkg-gen` (distribution build), `doc-gen` (documentation)

**Strengths**:
- Comprehensive pre-commit configuration covering Python, shell, YAML, and GitHub Actions
- Ruff in fix mode ensures consistent Python formatting
- Actionlint catches workflow configuration errors early
- Custom hooks for build artifact regeneration

**Gaps**:
- No SAST tools (CodeQL, gosec, Semgrep)
- No dependency vulnerability scanning (pip-audit, safety)
- No secret scanning beyond basic `detect-private-key`

### Container Images

**Distribution Image** (`distribution/Containerfile`):
- Auto-generated from `build.py` (don't edit directly)
- Base image: `registry.access.redhat.com/ubi9/python-312` (pinned by digest)
- Multi-stage: dependency installation, ogx packages, common setup, config
- Entrypoint script for runtime configuration

**Konflux Image** (`Dockerfile.konflux`):
- Separate Containerfile for Konflux builds
- Uses `BASE_IMAGE` ARG (injected by pipeline)
- Multi-arch: amd64, arm64, ppc64le
- Self-test: `fromager-rpm-check.py` + `selftest.py` (built into base image)
- Proper labeling (component, description, license)

**vLLM CPU Image** (`vllm/Containerfile`):
- Separate image for vLLM inference/embedding with pre-loaded models
- Tested in CI with inference and embedding validation

**Strengths**:
- Multi-arch support (amd64, arm64, ppc64le for Konflux)
- Pinned base image by digest
- Self-test in Konflux image (RPM check, selftest)
- Pre-loaded embedding model for offline operation

**Gaps**:
- No Trivy/Grype scanning
- No SBOM generation
- No cosign image signing
- Containerfile drift risk between upstream and Konflux

### Security

**Present**:
- `detect-private-key` in pre-commit hooks
- Fork/Dependabot PR credential isolation
- Credential validation before test execution
- Pinned GitHub Action SHAs (SHA-pinned, not tag-pinned)
- CODEOWNERS for CI and test files
- Semantic PR title enforcement
- Dependabot for dependency updates

**Missing**:
- Container vulnerability scanning (Trivy, Snyk, Grype)
- SAST (CodeQL, Semgrep)
- Dependency scanning (pip-audit, safety)
- Secret scanning (Gitleaks, TruffleHog)
- SBOM generation (Syft)
- Image signing (cosign)
- SLSA provenance attestation

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no test type rules, no coding standards, no review checklists
- **Quality**: N/A
- **Gaps**: No `CLAUDE.md`, `AGENTS.md`, `.claude/` directory, or `.claude/rules/`
- **Recommendation**: Generate missing rules with `/test-rules-generator` covering:
  - Shell script testing standards (shellcheck, `set -euo pipefail`)
  - Containerfile conventions (auto-generated, don't edit directly)
  - Integration test patterns (upstream pytest, provider credential handling)
  - Smoke test patterns (health check, inference validation, DB checks)

## Recommendations

### Priority 0 (Critical)
1. **Add container vulnerability scanning** — Add Trivy or Grype to the PR `build-test` job. Scan both the OGX distribution image and the vLLM CPU image. Fail on CRITICAL/HIGH CVEs.
2. **Add SBOM generation and image signing** — Add Syft SBOM generation and cosign signing to the publish steps. This is required for SLSA compliance and FedRAMP.
3. **Add secret detection** — Add Gitleaks to pre-commit and CI. The current `detect-private-key` only catches SSH keys, not API tokens, passwords, or other credentials.

### Priority 1 (High Value)
4. **Convert smoke tests to produce JUnit XML** — Add a simple JUnit XML emitter to `smoke.sh` using the existing `failed_checks` array. This enables PR annotations and trend tracking.
5. **Add Containerfile drift detection** — Create a CI check that validates `Dockerfile.konflux` and `distribution/Containerfile` share the same package versions and configuration steps.
6. **Create CLAUDE.md and .claude/rules/** — Document testing expectations, shell scripting standards, Containerfile conventions, and contribution guidelines for AI-assisted development.
7. **Add weekly Trivy scan for published images** — Schedule a weekly scan of the `latest` image on quay.io to catch newly discovered CVEs.

### Priority 2 (Nice-to-Have)
8. **Add load/performance testing** — Test the OGX server under concurrent request load to establish baseline performance and detect regressions.
9. **Add API contract tests** — The OGX server implements an OpenAI-compatible API. Add contract tests to verify spec compliance beyond the current inference-only checks.
10. **Add pip-audit for Python dependency scanning** — Scan Python dependencies for known vulnerabilities as part of the build process.

## Comparison to Gold Standards

| Dimension | ogx-distribution | odh-dashboard | notebooks | kserve |
|-----------|-----------------|---------------|-----------|--------|
| Unit Tests | None (distribution project) | Comprehensive Jest suite | N/A (images) | Go test with coverage |
| Integration Tests | Strong multi-provider | Contract + integration | N/A | Multi-version |
| E2E Tests | Showroom on OpenShift | Cypress + ODS | Jupyter validation | KServe E2E |
| Image Testing | Smoke + health check | N/A | 5-layer validation | N/A |
| Coverage Tracking | None | Codecov enforcement | N/A | Codecov enforcement |
| Security Scanning | None | Snyk + CodeQL | Trivy | Trivy + CodeQL |
| CI/CD Automation | Excellent (14 workflows) | Strong | Strong | Strong |
| Pre-commit | Ruff + shellcheck + actionlint | ESLint + Prettier | N/A | golangci-lint |
| Agent Rules | None | Comprehensive | None | None |
| Test Reporting | JUnit (integration only) | Jest + coverage | Logs | Go test output |
| Dependency Mgmt | Dependabot + Renovate | Dependabot | Dependabot | Dependabot |

## File Paths Reference

### CI/CD
- `.github/workflows/redhat-distro-container.yml` — Main build/test/publish workflow
- `.github/workflows/vllm-cpu-container.yml` — vLLM image build/test
- `.github/workflows/pre-commit.yml` — Pre-commit CI
- `.github/workflows/semantic-pr.yml` — PR title enforcement
- `.github/workflows/test-pr-in-showroom.yml` — E2E on OpenShift
- `.github/workflows/responses-weekly.yml` — Weekly multi-provider tests
- `.github/workflows/responses-openai.yml` — OpenAI response tests
- `.github/workflows/responses-vertexai.yml` — Vertex AI response tests
- `.github/workflows/responses-vllm-maas.yml` — vLLM MaaS response tests
- `.github/workflows/update-ogx-version.yml` — Version update automation
- `.github/actions/setup-vllm/action.yml` — vLLM composite action
- `.github/actions/setup-server/action.yml` — Server composite action
- `.github/actions/setup-postgres/action.yml` — PostgreSQL composite action
- `.tekton/odh-ogx-core-pull-request.yaml` — Konflux PR pipeline
- `.tekton/odh-ogx-core-push.yaml` — Konflux push pipeline

### Testing
- `tests/smoke.sh` — Container smoke tests (303 lines)
- `tests/run_integration_tests.sh` — Integration tests (153 lines)
- `tests/test_utils.sh` — Common test utilities (10 lines)
- `tests/fixtures/sample.pdf` — Test fixture for file processor

### Container Images
- `distribution/Containerfile` — Auto-generated upstream Containerfile
- `distribution/Containerfile.in` — Template for Containerfile generation
- `Dockerfile.konflux` — Konflux downstream Containerfile
- `vllm/Containerfile` — vLLM CPU image
- `distribution/build.py` — Containerfile generator (485 lines)
- `distribution/config.yaml` — OGX server configuration
- `distribution/entrypoint.sh` — Container entrypoint
- `distribution/versions.env` — Version pinning

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks configuration
- `.github/mergify.yml` — Mergify auto-merge rules
- `.github/dependabot.yml` — Dependabot configuration
- `renovate.json` — Renovate configuration
- `.github/CODEOWNERS` — Code ownership
- `.github/PULL_REQUEST_TEMPLATE.md` — PR template

### Reporting
- `scripts/junit_to_history.py` — JUnit XML to history.json converter
- `scripts/junit_stats.py` — JUnit statistics
- `scripts/report-template.html` — Test report HTML template
- `scripts/gen_distro_docs.py` — Distribution documentation generator
