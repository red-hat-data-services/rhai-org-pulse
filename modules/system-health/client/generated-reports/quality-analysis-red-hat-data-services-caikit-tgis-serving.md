---
repository: "red-hat-data-services/caikit-tgis-serving"
overall_score: 4.5
scorecard:
  - dimension: "Unit Tests"
    score: 1.0
    status: "No unit tests exist; only 2 Python source files with zero test coverage tooling"
  - dimension: "Integration/E2E"
    score: 6.0
    status: "Docker Compose and KServe smoke tests on PRs; covers HTTP and gRPC inference but limited scenarios"
  - dimension: "Build Integration"
    score: 5.0
    status: "PR builds Docker image and runs smoke tests; Konflux builds triggered by label/comment, not automatic"
  - dimension: "Image Testing"
    score: 5.0
    status: "Image built and smoke-tested on PR; no vulnerability scanning, no SBOM, no multi-arch PR validation"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling, no codecov/coveralls, no coverage thresholds or reporting"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "PR workflow builds and tests; Dependabot configured; but KServe test workflow disabled on PRs, no concurrency control"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules or AI-assisted testing guidance"
critical_gaps:
  - title: "No unit tests at all"
    impact: "Zero test coverage for application logic; regressions undetectable without full E2E run"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No coverage tracking or enforcement"
    impact: "No visibility into what code is tested; impossible to set quality gates"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No security scanning in CI"
    impact: "Container vulnerabilities and dependency issues not caught before merge"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "KServe integration test disabled on PRs"
    impact: "KServe deployment regressions only caught weekly or on manual dispatch"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No linting or static analysis"
    impact: "Code quality issues not caught automatically; inconsistent code style"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Immediate visibility into container image vulnerabilities"
  - title: "Add ruff/flake8 linting for Python code"
    effort: "1-2 hours"
    impact: "Automated code quality checks on every PR"
  - title: "Re-enable KServe smoke test on PRs"
    effort: "30 minutes"
    impact: "Catch KServe deployment regressions before merge"
  - title: "Add concurrency control to PR workflow"
    effort: "30 minutes"
    impact: "Avoid wasted CI resources on superseded PRs"
recommendations:
  priority_0:
    - "Add unit tests for caikit runtime configuration and health probe logic"
    - "Add container vulnerability scanning (Trivy) to PR and push workflows"
    - "Implement coverage tracking with codecov or coveralls"
  priority_1:
    - "Re-enable KServe smoke test as PR-triggered workflow"
    - "Add ruff linting and pre-commit hooks"
    - "Add SBOM generation to container image builds"
    - "Create agent rules (.claude/rules/) for test automation guidance"
  priority_2:
    - "Add multi-model smoke tests (beyond flan-t5-small)"
    - "Add performance/latency regression tests for inference endpoints"
    - "Add gRPC endpoint testing in KServe smoke test (currently TODO)"
    - "Implement Dockerfile best-practice linting (hadolint)"
---

# Quality Analysis: caikit-tgis-serving

## Executive Summary

- **Overall Score: 4.5/10**
- **Repository Type**: Python container image / KServe serving runtime
- **Primary Language**: Python 3.11 (Poetry-managed)
- **Framework**: Caikit runtime with TGIS backend, deployed via KServe

**Key Strengths:**
- Well-structured PR CI workflow that builds the Docker image and runs smoke tests (both Docker Compose and KServe)
- Dependabot configured for pip, Docker, and GitHub Actions dependency updates
- Multi-stage Dockerfile with non-root user and proper security hardening
- Konflux/Tekton pipeline integration for production builds (multi-arch: x86_64 + arm64)

**Critical Gaps:**
- Zero unit tests — the repository contains only 2 Python source files and no test framework configuration
- No code coverage tracking or enforcement of any kind
- No security scanning (Trivy, Snyk, CodeQL) in CI pipelines
- No linting, static analysis, or pre-commit hooks
- No agent rules or AI-assisted development guidance

**Agent Rules Status: Missing** — No CLAUDE.md, no `.claude/` directory, no test automation rules

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 1/10 | No unit tests exist; only smoke-test.py for E2E |
| Integration/E2E | 6/10 | Docker Compose + KServe smoke tests on PRs |
| Build Integration | 5/10 | PR builds image; Konflux label-triggered only |
| Image Testing | 5/10 | Image built and smoke-tested; no vuln scanning |
| Coverage Tracking | 0/10 | No coverage tooling whatsoever |
| CI/CD Automation | 5/10 | PR workflow exists but KServe test disabled on PRs |
| Agent Rules | 0/10 | No agent rules or AI development guidance |

## Critical Gaps

### 1. No Unit Tests (Severity: HIGH)
- **Impact**: The repository has zero unit tests. The only test file (`test/smoke-test.py`) is an E2E smoke test that requires running containers. There are no tests for configuration parsing, health probe logic, or any application behavior in isolation.
- **Effort**: 16-24 hours to establish a testing framework (pytest) and write initial unit tests
- **Current state**: `pyproject.toml` has no test dependencies (no pytest, no coverage tools)

### 2. No Coverage Tracking (Severity: HIGH)
- **Impact**: Without any coverage measurement, there is no visibility into what code paths are exercised. Quality gates cannot be enforced, and regressions in test adequacy are invisible.
- **Effort**: 2-4 hours to add pytest-cov and codecov integration
- **Current state**: No `.coveragerc`, no `codecov.yml`, no coverage-related configuration anywhere

### 3. No Security Scanning (Severity: HIGH)
- **Impact**: Container images built from this repo are not scanned for known CVEs. Dependency vulnerabilities are not detected. No SAST or secret detection is configured.
- **Effort**: 2-4 hours to add Trivy scanning step to the build-and-test workflow
- **Current state**: No Trivy, Snyk, CodeQL, gitleaks, or any security tool configured

### 4. KServe Integration Test Disabled on PRs (Severity: MEDIUM)
- **Impact**: The `kserve-test.yml` workflow has its `push` and `pull_request` triggers commented out. It only runs on a weekly schedule or manual dispatch. This means KServe deployment regressions are not caught until the weekly run.
- **Effort**: 1-2 hours to re-enable and validate
- **Current state**: Lines 9-14 of `kserve-test.yml` show commented-out PR triggers

### 5. No Linting or Static Analysis (Severity: MEDIUM)
- **Impact**: No automated code quality enforcement. No ruff, flake8, mypy, or any linter configured. No pre-commit hooks.
- **Effort**: 2-4 hours for initial setup
- **Current state**: No linting configuration files found

## Quick Wins

### 1. Add Trivy Container Scanning (1-2 hours)
Add a Trivy scanning step after the image build in `build-and-test.yml`:

```yaml
- name: Scan image with Trivy
  uses: aquasecurity/trivy-action@master
  with:
    input: /tmp/image.tar
    format: 'table'
    exit-code: '1'
    severity: 'CRITICAL,HIGH'
```

### 2. Add Ruff Linting (1-2 hours)
Add ruff configuration to `pyproject.toml` and a lint step to the PR workflow:

```toml
[tool.ruff]
target-version = "py311"
line-length = 120

[tool.ruff.lint]
select = ["E", "F", "W", "I", "N", "UP", "S", "B"]
```

```yaml
- name: Lint with ruff
  run: |
    pip install ruff
    ruff check .
```

### 3. Re-enable KServe Smoke Test on PRs (30 minutes)
Uncomment the PR triggers in `kserve-test.yml`:

```yaml
on:
  schedule:
    - cron: "20 4 * * 1"
  workflow_dispatch:
  push:
    branches: [main]
    paths:
      - "!docs"
      - "!demo"
  pull_request:
```

### 4. Add Concurrency Control (30 minutes)
Add concurrency group to `build-and-test.yml` to cancel superseded runs:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory:**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build-and-test.yml` | PR, push to main, weekly cron, manual | Build image + run smoke tests |
| `kserve-test.yml` | Weekly cron, manual only | KServe integration test (PR trigger disabled) |
| `run-update.yml` | Weekly cron, manual | Update poetry lockfiles and create PR |
| `pr-close-image-delete.yaml` | PR close | Clean up PR-specific quay images |
| `dependabot-autoapprove.yaml` | PR (dependabot) | Auto-approve dependabot PRs |

**PR Build Pipeline (`build-and-test.yml`) Details:**
- Builds Docker image using `docker/build-push-action@v5`
- Exports image as OCI tar artifact for downstream jobs
- Runs 2 parallel test jobs after build:
  - **Compose Smoke Test**: Docker Compose with TGIS sidecar, runs `smoke-test.py` (HTTP + gRPC)
  - **KServe Smoke Test**: Sets up Kind cluster with KServe, deploys ServingRuntime/InferenceService, runs HTTP inference test
- Good: Uses artifact passing between jobs
- Missing: No concurrency control, no caching, no test matrix

**Tekton/Konflux Pipeline:**
- `.tekton/caikit-tgis-serving-pull-request.yaml` defines a Konflux PipelineRun
- Triggered by label (`kfbuild-caikit-tgis-serving`) or comment (`/build-konflux`), not automatic on all PRs
- Multi-arch builds: `linux/x86_64` and `linux-m2xlarge/arm64`
- Pipeline defined in external `konflux-central` repository
- Images expire after 5 days for PR builds

### Test Coverage

**Test Files:**
- `test/smoke-test.py` — Python smoke test using `caikit-nlp-client` (HTTP + gRPC inference)
- `test/compose/smoke-test.sh` — Shell script orchestrating Docker Compose smoke test
- `test/compose/docker-compose.yml` — Compose config for local smoke testing
- `test/kserve/setup.yaml` — K8s manifests for model PVC setup
- `test/kserve/caikit-tgis-serving.yaml` — K8s manifests for KServe deployment

**Test-to-Code Ratio:** Very low. 2 Python files total (1 utility `convert.py`, 1 test `smoke-test.py`). The repository is primarily a container image packaging project, not a large application codebase.

**What's Tested:**
- HTTP inference endpoint (flan-t5-small model)
- gRPC inference endpoint (Docker Compose only)
- Container startup and readiness
- KServe InferenceService deployment and readiness

**What's NOT Tested:**
- Configuration validation (`caikit.yml` parsing)
- Model loading edge cases
- Error handling (bad model, missing model, invalid requests)
- Health probe responses (readiness, liveness)
- Multiple model formats or model sizes
- gRPC in KServe context (marked as TODO in smoke-test.py line 69)
- Resource limits and OOM behavior

### Code Quality

**Linting**: None configured
- No `.flake8`, `ruff.toml`, `mypy.ini`, or any linter configuration
- No type checking (no mypy or pyright)

**Pre-commit Hooks**: None configured
- No `.pre-commit-config.yaml`

**Static Analysis**: None configured
- No CodeQL, Semgrep, gosec, or bandit
- No SAST integration of any kind

**Dependency Management:**
- Poetry used for Python dependency management (good)
- `poetry.lock` committed (good)
- Dependabot configured for pip, Docker base images, and GitHub Actions (good)
- Weekly automated PR for poetry lock updates (good)
- Dependabot auto-approve configured (risk: auto-approving dependency changes without review)

### Container Images

**Dockerfiles:**
- `Dockerfile` — Standard multi-stage build (poetry-builder → deploy)
- `Dockerfile.konflux` — Identical to Dockerfile with additional Red Hat labels

**Good Practices:**
- Multi-stage build (reduces image size)
- UBI9 minimal base image (Red Hat supported)
- Non-root user (caikit, UID 1001)
- `gid 0` group membership (OpenShift compatibility)
- Volume mount for configuration
- `.dockerignore` present

**Missing:**
- No `HEALTHCHECK` instruction in Dockerfile
- No vulnerability scanning
- No SBOM generation
- No image signing/attestation
- Multi-arch validation only in Konflux pipeline, not in GitHub Actions PR workflow
- Both Dockerfiles are nearly identical — potential for drift

### Security

**Current State: Minimal**
- No container vulnerability scanning (Trivy, Snyk, Grype)
- No SAST/DAST tools
- No secret detection (gitleaks, trufflehog)
- No dependency vulnerability scanning beyond Dependabot
- No security policy (`SECURITY.md`)
- Dependabot auto-approve could merge vulnerable updates without human review

**Positive:**
- Non-root container user
- UBI9 base image (Red Hat maintained, patched)
- Poetry lockfile ensures reproducible builds

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: Complete absence of agent rules. No test creation guidance, no coding standards for AI agents, no quality gates documented for AI-assisted contributions.
- **Recommendation**: Generate comprehensive agent rules using `/test-rules-generator` to cover smoke test patterns, container image testing, KServe deployment testing, and Python coding standards.

## Recommendations

### Priority 0 (Critical)

1. **Add pytest and unit test infrastructure**
   - Add pytest, pytest-cov to `pyproject.toml` dev dependencies
   - Create unit tests for configuration parsing and model loading logic
   - Set up coverage reporting with minimum threshold (e.g., 80%)

2. **Add container vulnerability scanning**
   - Integrate Trivy or Grype into `build-and-test.yml`
   - Scan the built image tar artifact before smoke tests
   - Block merges on CRITICAL/HIGH vulnerabilities

3. **Implement coverage tracking**
   - Add `.codecov.yml` with coverage thresholds
   - Add coverage upload step to CI workflow
   - Require coverage reports on PRs

### Priority 1 (High Value)

4. **Re-enable KServe smoke test on PRs**
   - Uncomment PR triggers in `kserve-test.yml`
   - Consider running as part of `build-and-test.yml` to share the built image artifact

5. **Add Python linting**
   - Configure ruff for linting and formatting
   - Add `.pre-commit-config.yaml` with ruff, trailing whitespace, YAML checks
   - Add lint step to PR workflow

6. **Add SBOM generation**
   - Use Syft or Trivy to generate SBOM alongside container builds
   - Include in Konflux pipeline outputs

7. **Create agent rules**
   - Add `.claude/rules/` with test patterns, coding standards
   - Document smoke test conventions and KServe deployment test patterns

### Priority 2 (Nice-to-Have)

8. **Expand smoke test coverage**
   - Test error cases (invalid model, malformed request)
   - Test multiple model formats
   - Add gRPC testing in KServe context (complete the TODO)
   - Add latency/timeout assertions

9. **Add Dockerfile linting**
   - Integrate hadolint for Dockerfile best-practice checks
   - Prevent drift between `Dockerfile` and `Dockerfile.konflux`

10. **Add performance regression testing**
    - Baseline inference latency for flan-t5-small
    - Alert on significant latency regressions

## Comparison to Gold Standards

| Dimension | caikit-tgis-serving | odh-dashboard | notebooks | kserve |
|-----------|:-------------------:|:-------------:|:---------:|:------:|
| Unit Tests | 1/10 | 9/10 | 6/10 | 8/10 |
| Integration/E2E | 6/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 5/10 | 8/10 | 7/10 | 8/10 |
| Image Testing | 5/10 | 7/10 | 9/10 | 7/10 |
| Coverage Tracking | 0/10 | 9/10 | 5/10 | 8/10 |
| CI/CD Automation | 5/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 0/10 | 8/10 | 3/10 | 2/10 |
| **Overall** | **4.5/10** | **8.7/10** | **7.0/10** | **7.8/10** |

**Key gaps vs. gold standards:**
- odh-dashboard: Multi-layer testing with unit/integration/E2E, contract tests, comprehensive CI/CD, coverage enforcement, extensive agent rules
- notebooks: 5-layer image validation, multi-arch testing, security scanning
- kserve: Coverage enforcement, multi-version testing, comprehensive operator testing

## File Paths Reference

| File | Purpose |
|------|---------|
| `.github/workflows/build-and-test.yml` | Main PR CI: build image + smoke tests |
| `.github/workflows/kserve-test.yml` | KServe integration test (weekly only) |
| `.github/workflows/run-update.yml` | Weekly poetry lock updates |
| `.github/workflows/pr-close-image-delete.yaml` | PR image cleanup |
| `.github/workflows/dependabot-autoapprove.yaml` | Auto-approve dependabot PRs |
| `.github/dependabot.yml` | Dependabot config (pip, docker, github-actions) |
| `.tekton/caikit-tgis-serving-pull-request.yaml` | Konflux/Tekton PR pipeline |
| `Dockerfile` | Multi-stage container build |
| `Dockerfile.konflux` | Konflux-specific Dockerfile with Red Hat labels |
| `Makefile` | Build helpers (image build, shell) |
| `pyproject.toml` | Python project config (Poetry) |
| `caikit.yml` | Caikit runtime configuration |
| `test/smoke-test.py` | HTTP + gRPC inference smoke test |
| `test/compose/smoke-test.sh` | Docker Compose smoke test orchestrator |
| `test/compose/docker-compose.yml` | Local test environment definition |
| `test/kserve/setup.yaml` | Model PVC setup for KServe tests |
| `test/kserve/caikit-tgis-serving.yaml` | ServingRuntime + InferenceService manifests |
