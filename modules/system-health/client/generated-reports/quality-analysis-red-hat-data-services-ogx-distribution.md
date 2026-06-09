---
repository: "red-hat-data-services/llama-stack-distribution"
overall_score: 5.4
scorecard:
  - dimension: "Unit Tests"
    score: 1.0
    status: "No Python unit tests exist; repo has only shell-based smoke/integration test scripts"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Excellent upstream pytest integration tests, multi-provider response tests, and OpenShift showroom E2E"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-time Docker builds with smoke + integration tests, Konflux multi-arch pipelines"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-arch builds (amd64/arm64/ppc64le), runtime smoke tests, but no vulnerability scanning or SBOM"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No code coverage tracking, no codecov/coveralls integration, no coverage thresholds"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "Well-organized workflows with concurrency control, GHA caching, Mergify auto-merge, Slack notifications"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory; no AI agent test automation guidance"
critical_gaps:
  - title: "No unit tests for Python code"
    impact: "485 lines of build.py and 160+ lines of test utility scripts have zero unit test coverage; regressions in Containerfile generation or version parsing go undetected until integration tests or production"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No container vulnerability scanning"
    impact: "CVEs in base images or Python dependencies are not detected before merge; security issues discovered only in Konflux or downstream scans"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No code coverage tracking"
    impact: "Cannot measure or enforce test coverage; no visibility into which code paths are exercised by existing tests"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No SAST/CodeQL integration"
    impact: "Static analysis security vulnerabilities not caught at PR time; relying solely on pre-commit hooks for code quality"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Immediate CVE detection on every PR; blocks merging images with critical vulnerabilities"
  - title: "Add CodeQL/SAST workflow"
    effort: "1-2 hours"
    impact: "Catches security vulnerabilities in Python code at PR time"
  - title: "Create agent rules for test patterns"
    effort: "2-3 hours"
    impact: "Guide AI agents to generate tests following project conventions"
  - title: "Add unit tests for build.py"
    effort: "4-6 hours"
    impact: "Protect Containerfile generation, version parsing, and config stripping logic from regressions"
recommendations:
  priority_0:
    - "Add unit tests for distribution/build.py (version validation, config stripping, Containerfile generation)"
    - "Integrate Trivy or Snyk container scanning into the redhat-distro-container.yml workflow"
  priority_1:
    - "Add CodeQL GitHub Actions workflow for Python SAST"
    - "Add pytest coverage tracking with codecov integration and minimum threshold"
    - "Create CLAUDE.md and .claude/rules/ with test automation guidance"
  priority_2:
    - "Add SBOM generation (syft/cdxgen) to container build pipeline"
    - "Add Gitleaks secret scanning to PR workflow"
    - "Add performance regression tests for inference latency"
---

# Quality Analysis: llama-stack-distribution

## Executive Summary
- **Overall Score: 5.4/10**
- **Repository Type**: Python container distribution (OGX/Llama Stack for Red Hat OpenShift AI)
- **Primary Languages**: Python (build tooling), Bash (test scripts)
- **Key Strengths**: Excellent CI/CD automation with well-organized workflows, strong integration testing against multiple inference providers (vLLM, OpenAI, Vertex AI, Gemini), multi-architecture container builds (amd64/arm64/ppc64le), comprehensive pre-commit hooks, and OpenShift showroom E2E testing
- **Critical Gaps**: Zero unit tests for Python code, no container vulnerability scanning, no code coverage tracking, no SAST integration
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 1/10 | No Python unit tests; only shell-based smoke/integration scripts |
| Integration/E2E | 8/10 | Upstream pytest suite, multi-provider response tests, OpenShift showroom E2E |
| **Build Integration** | **8/10** | **PR-time Docker builds with smoke + integration tests, Konflux pipelines** |
| Image Testing | 7/10 | Multi-arch builds, runtime smoke tests, but no vuln scanning or SBOM |
| Coverage Tracking | 0/10 | No coverage tracking, no codecov, no thresholds |
| CI/CD Automation | 9/10 | Well-organized workflows, concurrency, caching, auto-merge, notifications |
| Agent Rules | 0/10 | No agent rules or AI test automation guidance |

## Critical Gaps

### 1. No Unit Tests for Python Code
- **Impact**: `distribution/build.py` (485 LOC) contains complex logic for version validation, Containerfile generation, config stripping, and dependency resolution — all untested at the unit level. Bugs in version parsing or config generation only surface during integration tests or in production.
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **What to test**: `_validate_version()`, `is_version_tag()`, `is_install_from_source()`, `generate_stripped_config()`, `generate_containerfile()`, `get_ogx_install()`, `generate_install_deps_script()`

### 2. No Container Vulnerability Scanning
- **Impact**: CVEs in the UBI9 base image, Python dependencies (torch, milvus-lite, botocore, etc.), or transitive dependencies are not detected at PR time. Security issues are only caught downstream by Konflux or manual audits.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Recommendation**: Add Trivy scan step to `redhat-distro-container.yml` after the build step

### 3. No Code Coverage Tracking
- **Impact**: No visibility into which code paths are exercised by smoke/integration tests. Cannot enforce minimum coverage or detect coverage regressions on PRs.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours

### 4. No SAST/CodeQL Integration
- **Impact**: Static analysis security vulnerabilities in Python code (injection, path traversal, etc.) are not caught at PR time.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours

## Quick Wins

### 1. Add Trivy Container Scanning (1-2 hours)
Add after the build step in `redhat-distro-container.yml`:
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.IMAGE_NAME }}:${{ github.sha }}
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'
```

### 2. Add CodeQL Workflow (1-2 hours)
Create `.github/workflows/codeql.yml`:
```yaml
name: CodeQL
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: python
      - uses: github/codeql-action/analyze@v3
```

### 3. Add Unit Tests for build.py (4-6 hours)
Create `tests/test_build.py` with pytest:
```python
import pytest
from distribution.build import _validate_version, is_version_tag, is_install_from_source

def test_validate_version_valid():
    assert _validate_version("v1.0.2+rhaiv.0") == "v1.0.2+rhaiv.0"
    assert _validate_version("main") == "main"

def test_validate_version_invalid():
    with pytest.raises(ValueError):
        _validate_version("v1.0; rm -rf /")

def test_is_version_tag():
    assert is_version_tag("v0.5.0") is True
    assert is_version_tag("main") is False
    assert is_version_tag("v1.0.2+rhaiv.0") is True
```

### 4. Create Agent Rules (2-3 hours)
Create `CLAUDE.md` and `.claude/rules/` with test creation patterns for this repository's shell-based smoke tests, upstream integration test conventions, and build.py validation patterns.

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (14 workflows):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `redhat-distro-container.yml` | PR, push, schedule (6am daily), dispatch | Main CI: build, test, publish container |
| `vllm-cpu-container.yml` | PR, push, dispatch | Build/test/publish vLLM CPU images |
| `pre-commit.yml` | PR, push to main | Linting, formatting, build validation |
| `semantic-pr.yml` | PR (target) | Conventional Commits title validation |
| `responses-weekly.yml` | Schedule (Sunday 22:00 UTC), dispatch | Weekly multi-provider response tests |
| `responses-openai.yml` | Reusable workflow, dispatch | OpenAI provider response tests |
| `responses-vertexai.yml` | Reusable workflow, dispatch | Vertex AI provider response tests |
| `responses-vllm-maas.yml` | Reusable workflow, dispatch | vLLM MaaS provider response tests |
| `test-pr-in-showroom.yml` | Schedule (daily 8am), dispatch | OpenShift showroom E2E testing |
| `update-ogx-version.yml` | Repository dispatch | Automated version bumps from upstream |
| `update-wheels.yml` | Repository dispatch | Automated wheel/dependency updates |
| `stale_bot.yml` | Schedule (daily midnight) | Stale issue/PR management |

**Strengths:**
- Concurrency control on all PR workflows with `cancel-in-progress: true`
- GHA build cache for Docker builds (`cache-from: type=gha`)
- Matrix strategy for multi-arch builds (amd64 + arm64)
- Reusable workflows for response tests (DRY principle)
- Composite actions for shared setup (setup-vllm, setup-postgres, setup-server)
- Pinned action versions with SHA hashes (supply chain security)
- Slack notifications on failures
- Mergify auto-merge with check requirements
- Dependabot + Renovate for dependency management
- CODEOWNERS for CI/tests review routing

**Gaps:**
- No SAST/CodeQL workflow
- No container scanning workflow
- No SBOM generation step

### Test Coverage

**Smoke Tests (`tests/smoke.sh`)** — 303 lines, well-structured:
- Container startup with health check (60s timeout)
- Model listing validation for all configured providers
- OpenAI-compatible inference validation
- PostgreSQL table creation verification
- PostgreSQL data population verification
- File processor (pypdf) validation with non-guessable marker
- Multi-provider support (vLLM, Vertex AI, OpenAI, Gemini)
- Graceful degradation when provider credentials unavailable

**Integration Tests (`tests/run_integration_tests.sh`)** — 145 lines:
- Clones upstream ogx pytest suite at matching version
- Runs `tests/integration/inference/` against the distribution's running server
- Multi-model testing across available providers
- Well-documented skip reasons with upstream issue references

**Response Tests (Weekly):**
- Separate workflows per provider (OpenAI, Vertex AI, vLLM MaaS)
- Matrix strategy for multiple models per provider
- JUnit XML output with test reporter integration
- Historical test results published to GitHub Pages
- Custom `junit_to_history.py` for trend tracking

**E2E Tests (Showroom):**
- Full OpenShift deployment: build → push → setup → provision → test → cleanup
- Tests against real RHOAI operator and OpenShift cluster
- Available as daily schedule and manual dispatch

**Missing:**
- **Zero unit tests** for Python code (`build.py`, `junit_stats.py`, `junit_to_history.py`, `gen_distro_docs.py`)
- No `pytest.ini`, `pyproject.toml` test configuration, or `conftest.py`
- No test-to-code ratio (effectively 0 for Python)
- No mock/fixture patterns for Python code

### Code Quality

**Pre-commit Configuration** (`.pre-commit-config.yaml`) — **Excellent**:
- **Ruff**: Python linting + formatting (v0.9.4)
- **Shellcheck**: Shell script linting (v0.11.0.1)
- **Actionlint**: GitHub Actions workflow linting (v1.7.11)
- **Standard hooks**: check-merge-conflict, trailing-whitespace, check-added-large-files (1MB limit), end-of-file-fixer, no-commit-to-branch, check-yaml, detect-private-key, requirements-txt-fixer, mixed-line-ending (LF enforced), check-executables-have-shebangs, check-json, check-shebang-scripts-are-executable, check-symlinks, check-toml
- **Custom hooks**: Distribution Build (`build.py` runs as pre-commit), Distribution Documentation generation
- Enforced in CI via `pre-commit.yml` workflow with diff verification

**PR Process:**
- Semantic PR title enforcement (Conventional Commits)
- PR template with summary and test plan sections
- CODEOWNERS: CI/tests owned by @Artemon-line and @kami619
- Mergify: 2 approvals required (1 for github-deps), CI checks must pass

### Container Images

**Containerfiles:**
1. `distribution/Containerfile` — Auto-generated from `Containerfile.in` by `build.py`. Uses UBI9 Python 3.12 base. Multi-stage dependency installation.
2. `distribution/Containerfile.in` — Template with `{ogx_install_source}` placeholder
3. `Dockerfile.konflux` — Konflux/RHOAI pipeline. Uses AIPCC base image. Includes `fromager-rpm-check.py` for RPM validation and `selftest.py` for container self-testing.
4. `vllm/Containerfile` — Pre-built vLLM CPU image with bundled models

**Multi-arch Support**: amd64, arm64, ppc64le (Konflux only)

**Runtime Validation**: Smoke tests start the container and validate health endpoint, model listing, inference, database tables, and file processing.

**Missing**: No Trivy/Snyk scanning, no SBOM generation, no image signing/attestation

### Security

**Present:**
- Pre-commit `detect-private-key` hook
- Dependabot for GitHub Actions, Python (uv), and Docker dependency updates
- Renovate from konflux-central for Konflux-specific deps
- Pinned GitHub Action versions (SHA hashes) across all workflows
- Input validation in `build.py` (`_validate_version()` with regex)
- Provider credential validation in CI (pre-flight checks for OpenAI, Gemini, Vertex AI, MaaS)
- Fork/Dependabot PR secret isolation
- `Dockerfile.konflux` runs `fromager-rpm-check.py` and `selftest.py`

**Missing:**
- No Trivy/Snyk/Grype container vulnerability scanning
- No CodeQL/Semgrep SAST
- No Gitleaks/TruffleHog secret scanning
- No SBOM generation (syft/cdxgen)
- No image signing (cosign)

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No test type rules exist
- **Quality**: N/A
- **Gaps**: No CLAUDE.md, AGENTS.md, or `.claude/` directory. No guidance for AI agents on how to write smoke tests, integration tests, or validate the build pipeline.
- **Recommendation**: Generate test automation rules with `/test-rules-generator` to capture:
  - Shell-based smoke test patterns (container startup, health check, model validation)
  - Upstream integration test conventions (version matching, skip patterns)
  - Build.py unit test patterns (version validation, config generation)

## Recommendations

### Priority 0 (Critical)
1. **Add unit tests for `distribution/build.py`** — Test version validation, config stripping, Containerfile generation, and dependency resolution. This is the most critical code in the repo and has zero test coverage.
2. **Integrate Trivy container scanning** into the `redhat-distro-container.yml` workflow to catch CVEs in base images and Python dependencies before merge.

### Priority 1 (High Value)
3. **Add CodeQL SAST workflow** for Python code — catches injection, path traversal, and other security issues at PR time.
4. **Add pytest coverage tracking** with codecov integration — even a low threshold (50%) provides visibility.
5. **Create CLAUDE.md and `.claude/rules/`** with test automation guidance for AI agents working on this repo.
6. **Add Gitleaks secret scanning** to complement pre-commit's `detect-private-key` hook.

### Priority 2 (Nice-to-Have)
7. **Add SBOM generation** (syft or cdxgen) to the container build pipeline for supply chain transparency.
8. **Add cosign image signing** for published container images.
9. **Add performance regression tests** — track inference latency and throughput across provider types.
10. **Add contract tests** between the distribution config and upstream ogx API expectations.

## Comparison to Gold Standards

| Practice | llama-stack-distribution | odh-dashboard | notebooks | kserve |
|----------|------------------------|---------------|-----------|--------|
| Unit Tests | None (1/10) | Comprehensive Jest (9/10) | Basic (5/10) | Extensive Go testing (9/10) |
| Integration/E2E | Upstream pytest + showroom (8/10) | Cypress E2E (9/10) | Image validation (7/10) | Multi-version E2E (9/10) |
| Coverage Tracking | None (0/10) | Codecov enforced (9/10) | None (2/10) | Codecov enforced (8/10) |
| Container Scanning | None (0/10) | Trivy (7/10) | Trivy (8/10) | Trivy (8/10) |
| Pre-commit | Excellent (9/10) | Good (7/10) | Basic (4/10) | Good (7/10) |
| CI/CD | Excellent (9/10) | Comprehensive (9/10) | Good (7/10) | Excellent (9/10) |
| Agent Rules | None (0/10) | Comprehensive (9/10) | None (0/10) | None (0/10) |
| Multi-arch | amd64/arm64/ppc64le (9/10) | N/A | Multi-arch (8/10) | Multi-arch (7/10) |

## File Paths Reference

### CI/CD
- `.github/workflows/redhat-distro-container.yml` — Main build/test/publish pipeline
- `.github/workflows/vllm-cpu-container.yml` — vLLM CPU image pipeline
- `.github/workflows/pre-commit.yml` — Pre-commit CI enforcement
- `.github/workflows/semantic-pr.yml` — PR title validation
- `.github/workflows/responses-weekly.yml` — Weekly response test orchestrator
- `.github/workflows/responses-openai.yml` — OpenAI response tests
- `.github/workflows/responses-vertexai.yml` — Vertex AI response tests
- `.github/workflows/responses-vllm-maas.yml` — vLLM MaaS response tests
- `.github/workflows/test-pr-in-showroom.yml` — OpenShift E2E tests
- `.github/workflows/update-ogx-version.yml` — Automated version updates
- `.github/workflows/update-wheels.yml` — Wheel/dependency updates
- `.github/workflows/stale_bot.yml` — Stale issue/PR management
- `.github/mergify.yml` — Auto-merge rules
- `.github/dependabot.yml` — Dependency update configuration
- `.github/CODEOWNERS` — Code ownership
- `.github/PULL_REQUEST_TEMPLATE.md` — PR template

### Testing
- `tests/smoke.sh` — Container smoke tests
- `tests/run_integration_tests.sh` — Upstream integration tests
- `tests/test_utils.sh` — Shared test utilities
- `tests/fixtures/sample.pdf` — Test fixture for file processor
- `tests/README.md` — Testing documentation

### Build & Distribution
- `distribution/build.py` — Build automation (Containerfile + config generation)
- `distribution/build.yaml` — Full build configuration
- `distribution/config.yaml` — Generated runtime configuration
- `distribution/Containerfile` — Generated container image definition
- `distribution/Containerfile.in` — Containerfile template
- `distribution/entrypoint.sh` — Container entrypoint
- `distribution/versions.env` — Version pinning
- `distribution/install-deps.sh` — Generated dependency installation
- `distribution/install-common.sh` — Common installation steps

### Konflux
- `.tekton/odh-ogx-core-pull-request.yaml` — Konflux PR pipeline
- `.tekton/odh-ogx-core-push.yaml` — Konflux push pipeline
- `Dockerfile.konflux` — Konflux-specific Dockerfile
- `konflux/cpu-ubi9.conf` — Konflux base image configuration

### GitHub Actions (Composite)
- `.github/actions/setup-vllm/action.yml` — vLLM container setup
- `.github/actions/setup-postgres/action.yml` — PostgreSQL setup
- `.github/actions/setup-server/action.yml` — OGX server setup

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks configuration
- `renovate.json` — Renovate bot configuration

### Reporting
- `scripts/junit_to_history.py` — JUnit to history conversion
- `scripts/junit_stats.py` — JUnit statistics parser
- `scripts/report-template.html` — Test report HTML template
