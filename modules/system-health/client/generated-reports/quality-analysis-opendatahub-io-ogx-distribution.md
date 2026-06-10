---
repository: "opendatahub-io/ogx-distribution"
overall_score: 7.5
scorecard:
  - dimension: "Unit Tests"
    score: 2.0
    status: "No unit tests — repo is a distribution/packaging project with shell-based smoke tests only"
    weight: 20
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Excellent multi-provider integration tests (vLLM, OpenAI, Vertex AI, Gemini) with upstream pytest suite and weekly Responses API test report"
    weight: 25
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-time container builds on both amd64 and arm64 with full smoke + integration test gate; Konflux pipelines configured"
    weight: 20
  - dimension: "Image Testing"
    score: 9.0
    status: "Multi-arch builds (amd64/arm64), container smoke tests, health checks, PostgreSQL validation, file processor validation, MaaS fallback"
    weight: 20
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "JUnit XML reporting for Responses tests with GitHub Pages trend dashboard, but no code coverage tracking (no Python unit tests to measure)"
    weight: 15
  - dimension: "CI/CD Automation"
    score: 9.5
    status: "12 workflows covering PR, push, nightly, weekly, dispatch; concurrency control; GHA caching; Mergify auto-merge; Dependabot; Slack notifications"
    weight: 20
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory — zero AI agent guidance"
critical_gaps:
  - title: "No unit tests for build tooling"
    impact: "build.py and gen_distro_docs.py (~200+ lines Python) have no tests — regressions in config generation caught only at integration level"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No container vulnerability scanning"
    impact: "No Trivy, Snyk, or CodeQL scanning in any workflow — CVEs in base image or Python dependencies go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No SBOM generation"
    impact: "No Software Bill of Materials for supply chain compliance — required for Red Hat product security standards"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "Contributors using Claude Code, Copilot, or other AI tools have no guidance on project conventions, test patterns, or code quality standards"
    severity: "MEDIUM"
    effort: "3-4 hours"
  - title: "No secret detection in CI"
    impact: "No Gitleaks or TruffleHog scanning — secrets in commits may go undetected (repo handles many API keys)"
    severity: "HIGH"
    effort: "1-2 hours"
quick_wins:
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Catch CVEs in base image and Python dependencies before merge"
  - title: "Add Gitleaks secret detection"
    effort: "1 hour"
    impact: "Prevent accidental secret commits in a repo that handles OpenAI, GCP, and Gemini API keys"
  - title: "Add SBOM generation with Syft"
    effort: "1-2 hours"
    impact: "Supply chain compliance and vulnerability tracking"
  - title: "Create CLAUDE.md with project conventions"
    effort: "2 hours"
    impact: "Guide AI-assisted contributions to follow existing patterns (shell tests, pre-commit, build.py)"
recommendations:
  priority_0:
    - "Add container vulnerability scanning (Trivy) to the redhat-distro-container.yml workflow — scan built image before publish"
    - "Add secret detection (Gitleaks) as a pre-commit hook and CI check — this repo handles numerous provider API keys"
    - "Generate SBOM (Syft/Grype) alongside container publish for supply chain compliance"
  priority_1:
    - "Add unit tests for build/build.py covering config generation, version validation, and dependency resolution"
    - "Create CLAUDE.md and .claude/rules/ with test patterns, commit conventions, and build process guidance"
    - "Add CodeQL or Bandit SAST scanning for the Python build scripts"
  priority_2:
    - "Add container image signing with cosign for published images"
    - "Add smoke test for ARM64 with local vLLM (currently skips integration tests on ARM)"
    - "Consider adding mypy type checking for build scripts"
---

# Quality Analysis: ogx-distribution

## Executive Summary

- **Overall Score: 7.5/10**
- **Repository Type**: Container distribution / packaging project for [OGX](https://github.com/ogx-ai/ogx) (AI orchestrator)
- **Primary Language**: Python (build scripts), Shell (tests), YAML (CI/CD, configuration)
- **Key Strengths**: Exceptional CI/CD automation with 12 workflows, multi-provider integration testing across OpenAI/Vertex AI/vLLM/Gemini, multi-arch container builds with full smoke test gate, weekly Responses API test reporting with GitHub Pages dashboard, Mergify auto-merge, Dependabot for 3 ecosystems
- **Critical Gaps**: No container vulnerability scanning, no secret detection, no SBOM generation, no unit tests for build tooling, no agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 2.0/10 | 20% | No unit tests — distribution repo with shell-based smoke tests only |
| Integration/E2E | 9.0/10 | 25% | Multi-provider integration tests with upstream pytest suite + weekly Responses API reports |
| Build Integration | 8.0/10 | 20% | PR-time container builds on amd64+arm64 with smoke+integration gate; Konflux pipelines |
| Image Testing | 9.0/10 | 20% | Multi-arch builds, health checks, PostgreSQL validation, file processor tests, MaaS fallback |
| Coverage Tracking | 3.0/10 | 15% | JUnit XML + GitHub Pages trend dashboard, but no code coverage measurement |
| CI/CD Automation | 9.5/10 | 20% | 12 workflows, concurrency control, GHA caching, Mergify, Dependabot, Slack notifications |
| Agent Rules | 0.0/10 | — | No AI agent guidance whatsoever |

## Critical Gaps

### 1. No Container Vulnerability Scanning
- **Impact**: CVEs in the base image (`odh-midstream-python-base-3-12`) or Python dependencies (50+ packages in requirements.txt) go completely undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Trivy, Snyk, Grype, or any scanner in any workflow. The main CI pipeline builds and publishes multi-arch images to `quay.io/opendatahub/odh-ogx-core` without any security gate.

### 2. No Secret Detection
- **Impact**: The repository handles API keys for OpenAI, Vertex AI, Gemini, AWS Bedrock, Anthropic, HuggingFace, and more. Accidental commits of secrets have no automated detection.
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: The `.pre-commit-config.yaml` includes `detect-private-key` (catches SSH keys only) but no Gitleaks or TruffleHog for broader secret patterns. No CI-level secret scanning.

### 3. No SBOM Generation
- **Impact**: No Software Bill of Materials for the published container images. Required for Red Hat product security standards and supply chain compliance.
- **Severity**: HIGH
- **Effort**: 2-3 hours

### 4. No Unit Tests for Build Tooling
- **Impact**: `build/build.py` (~200 lines) handles version validation, dependency resolution, config stripping, and requirements generation with zero test coverage. `build/gen_distro_docs.py` also untested. Regressions only caught when integration tests fail.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours

### 5. No Agent Rules
- **Impact**: AI-assisted contributors have no guidance on project conventions, test patterns, or commit standards.
- **Severity**: MEDIUM
- **Effort**: 3-4 hours

## Quick Wins

### 1. Add Trivy Container Scanning (1-2 hours)
Add to `redhat-distro-container.yml` after the build step:
```yaml
- name: Scan image with Trivy
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.IMAGE_NAME }}:${{ github.sha }}
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
```

### 2. Add Gitleaks Secret Detection (1 hour)
Add to `.pre-commit-config.yaml`:
```yaml
- repo: https://github.com/gitleaks/gitleaks
  rev: v8.21.0
  hooks:
    - id: gitleaks
```

### 3. Add SBOM Generation (1-2 hours)
Add to the publish job in `redhat-distro-container.yml`:
```yaml
- name: Generate SBOM
  uses: anchore/sbom-action@v0
  with:
    image: ${{ env.IMAGE_NAME }}:${{ github.sha }}
    artifact-name: sbom-ogx-core
```

### 4. Create CLAUDE.md (2 hours)
Create `CLAUDE.md` in the repo root with project conventions, build process overview, and test execution guidance for AI coding assistants.

## Detailed Findings

### CI/CD Pipeline

**Exceptional automation.** The repository has 12 GitHub Actions workflows covering the full lifecycle:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pre-commit.yml` | PR, push to main | Ruff, ShellCheck, ActionLint, standard hooks, artifact regeneration |
| `redhat-distro-container.yml` | PR, push, nightly (6AM UTC), dispatch | Build, test, publish container images (main pipeline) |
| `semantic-pr.yml` | PR | Conventional Commits title validation |
| `responses-openai.yml` | Called by weekly, dispatch | OpenAI Responses API integration tests |
| `responses-vertexai.yml` | Called by weekly, dispatch | Vertex AI Responses API integration tests |
| `responses-vllm-maas.yml` | Called by weekly, dispatch | vLLM MaaS Responses API integration tests |
| `responses-weekly.yml` | Sunday 22:00 UTC, dispatch | Orchestrator for all Responses tests + GitHub Pages report |
| `update-ogx-version.yml` | repository_dispatch | Auto-bump OGX version from upstream release |
| `vllm-cpu-container.yml` | PR, push, dispatch | Build/publish vLLM CPU container images with pre-baked models |
| `test-pr-in-showroom.yml` | Manual dispatch | Test PR images in OpenShift showroom environment |
| `stale_bot.yml` | Daily midnight | Auto-stale issues/PRs after 60 days |
| `dependabot.yml` | Weekly Saturday | GitHub Actions, Python (uv), Docker ecosystem updates |

**Strengths:**
- Concurrency control with `cancel-in-progress: true` on PR and build workflows
- GHA build caching per architecture (`cache-from: type=gha,scope=build-{arch}`)
- Multi-architecture matrix builds (amd64 + arm64) on native runners
- Provider credential validation before test runs (catches expired API keys)
- MaaS (Model-as-a-Service) fallback when local vLLM isn't practical
- Slack notifications on failures and successful publishes
- Mergify auto-merge with path-based conditional checks
- 5 custom reusable actions (setup-vllm, setup-server, setup-postgres, free-disk-space, notify-slack)
- All action versions pinned to full commit SHAs

**Gaps:**
- No security scanning workflows
- Nightly builds test `main` branch of upstream OGX but no Konflux simulation

### Test Coverage

**Strong integration testing, but no unit tests.** This is a distribution/packaging repo, so the testing strategy is container-centric rather than code-centric.

**Smoke Tests** (`tests/smoke.sh`):
- Container startup with health check (60s timeout)
- Model listing verification (vLLM, OpenAI, Vertex AI, Gemini models)
- OpenAI-compatible inference endpoint validation
- PostgreSQL table creation verification (`ogx_kvstore`, `inference_store`)
- PostgreSQL data population check after inference
- File processor validation (pypdf with marker-based PDF verification)
- Multi-provider support based on available credentials

**Integration Tests** (`tests/run_integration_tests.sh`):
- Runs upstream OGX pytest suite against the distribution container
- Version-locked to the bundled OGX version
- Tests inference endpoints across multiple providers
- Well-documented skip list with rationale per test

**Responses API Tests** (3 provider-specific workflows):
- Weekly cross-provider regression testing (OpenAI, Vertex AI, vLLM MaaS)
- JUnit XML output with `dorny/test-reporter` for GitHub checks
- 90-day artifact retention
- GitHub Pages trend dashboard with history tracking

**Test Utilities:**
- `test_utils.sh` — shared utilities with input validation
- `junit_stats.py` — JUnit XML parser for aggregated statistics
- `junit_to_history.py` — history builder for trend reporting
- `report-template.html` — interactive test report with Chart.js

**Gaps:**
- No unit tests for `build/build.py` or `build/gen_distro_docs.py`
- No coverage measurement at any level
- No contract tests between distribution config and upstream OGX API

### Code Quality

**Good linting and pre-commit setup:**

Pre-commit hooks (`.pre-commit-config.yaml`):
- **Ruff** — Python linting and formatting
- **ShellCheck** — Shell script linting
- **ActionLint** — GitHub Actions workflow linting
- **Standard hooks** — merge conflicts, trailing whitespace, large files, YAML/JSON/TOML validation, executable shebangs, private key detection, mixed line endings, symlinks
- **Custom hooks** — Distribution build (`build/build.py`) and documentation generation (`gen_distro_docs.py`)

**Strengths:**
- Pre-commit runs in CI and verifies no diff/new files after run
- Conventional Commits enforced via semantic-pr workflow
- CODEOWNERS defined for docs, CI, and tests
- PR template with test plan section

**Gaps:**
- No mypy or type checking for Python code
- No CodeQL or Bandit for SAST
- No Gitleaks for broad secret detection (only `detect-private-key`)

### Container Images

**Excellent container build and test practices:**

**Main Containerfile:**
- Based on `quay.io/opendatahub/odh-midstream-python-base-3-12`
- Multi-stage-like approach (constraints → requirements → install script → config)
- Pre-caches tiktoken models at build time
- Clean entrypoint pattern

**vLLM CPU Containerfile:**
- Based on `vllm/vllm-openai-cpu:v0.22.0`
- HuggingFace model download at build time with Docker build secrets
- Model validation at build time (fails fast on missing model args)

**Build Process:**
- Multi-arch builds on native runners (amd64 Ubuntu 24.04, arm64 Ubuntu 24.04 ARM)
- GHA layer caching per architecture
- QEMU-based multi-arch publish via Docker Buildx
- Smart publish gating (only publishes when `distribution/` or `Containerfile` changed)

**Gaps:**
- No vulnerability scanning of built images
- No SBOM generation
- No image signing (cosign)
- No runtime health check defined in Containerfile (`HEALTHCHECK` directive)

### Security

**Weakest dimension.** Despite handling numerous API keys for multiple cloud providers:

- No container vulnerability scanning (Trivy, Snyk, Grype)
- No SAST scanning (CodeQL, Bandit, Semgrep)
- No secret detection beyond SSH key checks
- No SBOM generation
- No image signing or attestation
- No dependency vulnerability scanning beyond Dependabot alerts

**Positive practices:**
- Action versions pinned to full commit SHAs (not tags)
- Docker build secrets for HuggingFace token (not build args)
- Provider credential validation before test runs
- Minimal permissions in workflows (`id-token: write`, `contents: read`)
- Fork/Dependabot PR detection to skip secret-dependent steps

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no CLAUDE.md, AGENTS.md, or `.claude/` directory
- **Quality**: N/A
- **Gaps**: No test automation guidance, no project conventions documentation for AI agents, no commit message patterns, no build process documentation beyond README
- **Recommendation**: Generate rules covering shell test patterns, pre-commit conventions, build script development, and Containerfile modifications using `/test-rules-generator`

## Recommendations

### Priority 0 (Critical)

1. **Add container vulnerability scanning** — Add Trivy scanning to the `redhat-distro-container.yml` workflow after the build step. Scan for CRITICAL and HIGH severity CVEs. Block publish on failures.
2. **Add secret detection** — Add Gitleaks to pre-commit config and CI. The repo handles API keys for OpenAI, GCP, Gemini, AWS Bedrock, Anthropic, HuggingFace, and more.
3. **Generate SBOM** — Add Syft/Anchore SBOM generation alongside container publish. Required for Red Hat product security compliance.

### Priority 1 (High Value)

4. **Add unit tests for build scripts** — Test `build.py` functions: `_validate_version()`, `generate_stripped_config()`, `_load_env()`, `get_dependencies()`. Use pytest with temporary directories.
5. **Create CLAUDE.md and agent rules** — Document project conventions, test patterns (shell smoke tests, upstream pytest suite), commit conventions (Conventional Commits), and build process for AI-assisted development.
6. **Add SAST scanning** — Add CodeQL or Bandit for the Python build scripts. The `build.py` handles subprocess calls, git operations, and file I/O.

### Priority 2 (Nice-to-Have)

7. **Add cosign image signing** for published container images
8. **Add HEALTHCHECK directive** to main Containerfile
9. **Add mypy type checking** for build scripts (already using type hints in some places)
10. **Improve ARM64 test parity** — Integration tests currently skipped on arm64 without MaaS

## Comparison to Gold Standards

| Dimension | ogx-distribution | odh-dashboard (gold) | notebooks (gold) | Gap |
|-----------|-----------------|---------------------|-------------------|-----|
| Unit Tests | 2/10 | 9/10 | 7/10 | No unit tests for build tooling |
| Integration/E2E | 9/10 | 9/10 | 8/10 | On par — excellent multi-provider testing |
| Build Integration | 8/10 | 8/10 | 7/10 | Strong — PR-time builds + Konflux pipelines |
| Image Testing | 9/10 | 7/10 | 10/10 | Exceeds dashboard, close to notebooks |
| Coverage Tracking | 3/10 | 8/10 | 6/10 | No code coverage, only test result tracking |
| CI/CD Automation | 9.5/10 | 9/10 | 8/10 | Exceeds gold standards — 12 workflows, Mergify, Dependabot |
| Security Scanning | 2/10 | 7/10 | 8/10 | Major gap — no scanning at all |
| Agent Rules | 0/10 | 8/10 | 3/10 | No agent guidance |

## File Paths Reference

### CI/CD
- `.github/workflows/redhat-distro-container.yml` — Main build/test/publish pipeline
- `.github/workflows/pre-commit.yml` — Pre-commit CI
- `.github/workflows/responses-weekly.yml` — Weekly Responses API test orchestrator
- `.github/workflows/responses-openai.yml` — OpenAI provider tests
- `.github/workflows/responses-vertexai.yml` — Vertex AI provider tests
- `.github/workflows/responses-vllm-maas.yml` — vLLM MaaS provider tests
- `.github/workflows/vllm-cpu-container.yml` — vLLM CPU image builder
- `.github/workflows/test-pr-in-showroom.yml` — OpenShift showroom testing
- `.github/workflows/update-ogx-version.yml` — Auto version bump
- `.github/workflows/semantic-pr.yml` — PR title validation
- `.github/workflows/stale_bot.yml` — Stale issue/PR cleanup

### Testing
- `tests/smoke.sh` — Container smoke tests
- `tests/run_integration_tests.sh` — Upstream pytest integration tests
- `tests/test_utils.sh` — Shared test utilities
- `tests/fixtures/sample.pdf` — Test fixture for file processor validation

### Build
- `build/build.py` — Distribution package builder
- `build/build.env` — Version configuration
- `build/build.yaml` — Full provider configuration (source of truth)
- `build/gen_distro_docs.py` — Documentation generator

### Container Images
- `Containerfile` — Main distribution container
- `vllm/Containerfile` — vLLM CPU container with pre-baked models

### Configuration
- `distribution/config.yaml` — Auto-generated runtime configuration (stripped from build.yaml)
- `distribution/requirements.txt` — Auto-generated Python dependencies
- `distribution/constraints.txt` — Dependency constraints
- `distribution/entrypoint.sh` — Container entrypoint
- `distribution/install-common.sh` — Common installation script

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks (Ruff, ShellCheck, ActionLint, standard hooks)
- `.github/CODEOWNERS` — Code ownership
- `.github/PULL_REQUEST_TEMPLATE.md` — PR template with test plan
- `.github/mergify.yml` — Mergify auto-merge rules
- `.github/dependabot.yml` — Dependabot configuration (3 ecosystems)

### Reporting
- `.github/scripts/junit_stats.py` — JUnit XML parser
- `.github/scripts/junit_to_history.py` — Test history builder
- `.github/scripts/report-template.html` — Interactive test report template

### Custom Actions
- `.github/actions/setup-vllm/action.yml` — vLLM container setup
- `.github/actions/setup-server/action.yml` — OGX server setup with health check
- `.github/actions/setup-postgres/action.yml` — PostgreSQL container setup
- `.github/actions/free-disk-space/action.yml` — Runner disk cleanup
- `.github/actions/notify-slack/` — Slack notification
