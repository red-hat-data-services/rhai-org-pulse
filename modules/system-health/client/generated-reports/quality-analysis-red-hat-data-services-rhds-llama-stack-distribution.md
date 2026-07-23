---
repository: "red-hat-data-services/rhds-llama-stack-distribution"
overall_score: 6.1
scorecard:
  - dimension: "Unit Tests"
    score: 2.0
    status: "No unit tests — all Python source code (build.py, gen_distro_docs.py) lacks test coverage"
  - dimension: "Integration/E2E"
    score: 7.5
    status: "Strong smoke + integration test suite with vLLM, Vertex AI, OpenAI, and PostgreSQL validation"
  - dimension: "Build Integration"
    score: 8.5
    status: "Excellent PR-time container build with AMD64/ARM64 verification, smoke tests, and Konflux Tekton pipelines"
  - dimension: "Image Testing"
    score: 8.0
    status: "Good container image validation — startup, health checks, multi-provider inference, and PostgreSQL integration"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tracking — no codecov, no coveragerc, no coverage thresholds"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "Well-structured CI with concurrency control, GHA caching, scheduled nightly builds, Mergify auto-merge, and Slack notifications"
  - dimension: "Static Analysis"
    score: 8.0
    status: "Comprehensive pre-commit hooks (ruff, shellcheck, actionlint) with Dependabot and Renovate configured"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules"
critical_gaps:
  - title: "No unit tests for Python source code"
    impact: "Build script logic (build.py, gen_distro_docs.py) untested — regressions in Containerfile generation caught only at container build time"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No code coverage tracking"
    impact: "No visibility into test coverage trends; no coverage gates prevent quality regression"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI code generation lacks project-specific guidance for test patterns, build conventions, and contribution standards"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add unit tests for build.py"
    effort: "4-6 hours"
    impact: "Cover critical Containerfile generation logic, version parsing, and dependency categorization without external services"
  - title: "Add pytest-cov and codecov integration"
    effort: "2-4 hours"
    impact: "Automated coverage reporting on PRs with threshold enforcement"
  - title: "Create CLAUDE.md with test and contribution guidelines"
    effort: "1-2 hours"
    impact: "Improve AI-generated code quality and consistency with project conventions"
  - title: "Pin pre-commit hook versions to SHA for supply chain safety"
    effort: "1 hour"
    impact: "Prevent supply chain attacks via compromised pre-commit hook tags"
recommendations:
  priority_0:
    - "Add unit tests for distribution/build.py covering version parsing, dependency categorization, Containerfile generation, and edge cases"
    - "Add pytest-cov integration with a minimum coverage threshold (e.g., 60%) and codecov PR reporting"
  priority_1:
    - "Create CLAUDE.md with project-specific test patterns, build conventions, and contribution guidelines"
    - "Add unit tests for scripts/gen_distro_docs.py"
    - "Add a test for entrypoint.sh behavior (OTEL wrapping, config resolution)"
  priority_2:
    - "Add multi-provider matrix testing in CI (currently sequential per model)"
    - "Add container image size tracking/alerting to catch unexpected bloat"
    - "Consider adding a Containerfile lint step (hadolint) to pre-commit"
---

# Quality Analysis: rhds-llama-stack-distribution

## Executive Summary
- **Overall Score: 6.1/10**
- **Repository Type**: Container distribution (Python, Shell, YAML)
- **Primary Language**: Python (build tooling), Shell (tests, entrypoint)
- **Jira**: RHOAIENG / OGX Core (downstream)
- **Key Strengths**: Excellent CI/CD automation with PR-time container builds, comprehensive smoke and integration testing against live services (vLLM, PostgreSQL, Vertex AI, OpenAI), strong static analysis via pre-commit hooks, and Konflux Tekton integration
- **Critical Gaps**: No unit tests for Python source code, no code coverage tracking, no agent rules
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 2.0/10 | 15% | 0.30 | No unit tests — build.py and gen_distro_docs.py untested |
| Integration/E2E | 7.5/10 | 20% | 1.50 | Strong smoke + integration suite with multi-provider validation |
| Build Integration | 8.5/10 | 15% | 1.28 | PR-time container build (AMD64+ARM64), Konflux Tekton pipelines |
| Image Testing | 8.0/10 | 10% | 0.80 | Container startup, health checks, inference, PostgreSQL validation |
| Coverage Tracking | 0.0/10 | 10% | 0.00 | No coverage tracking of any kind |
| CI/CD Automation | 8.5/10 | 15% | 1.28 | Concurrency, caching, scheduled nightly, Mergify, Slack notifications |
| Static Analysis | 8.0/10 | 10% | 0.80 | Ruff, shellcheck, actionlint, Dependabot, Renovate |
| Agent Rules | 0.0/10 | 5% | 0.00 | No CLAUDE.md, no .claude/ directory |
| **Overall** | **6.1/10** | **100%** | **5.96** | |

## Critical Gaps

### 1. No Unit Tests for Python Source Code
- **Impact**: `distribution/build.py` (346 lines) contains complex logic for version parsing, dependency categorization, and Containerfile generation — all untested. Regressions are only caught when the full container build runs (minutes vs. seconds).
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Key functions needing tests**: `is_version_tag()`, `is_install_from_source()`, `get_llama_stack_install()`, `get_dependencies()`, `generate_containerfile()`

### 2. No Code Coverage Tracking
- **Impact**: No visibility into what percentage of code is exercised by tests. No coverage gates prevent quality regression.
- **Severity**: HIGH
- **Effort**: 2-4 hours

### 3. No Agent Rules
- **Impact**: AI-assisted development has no project-specific guidance — no test patterns, no build conventions, no contribution standards.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours

## Quick Wins

### 1. Add Unit Tests for `build.py` (4-6 hours)
The build script has several pure functions ideal for unit testing:
```python
# test_build.py
def test_is_version_tag():
    assert is_version_tag("v0.5.0") == True
    assert is_version_tag("v0.5.0+rhai0") == True
    assert is_version_tag("main") == False
    assert is_version_tag("release-0.5.x") == False

def test_is_install_from_source():
    assert is_install_from_source("v0.5.0+rhai0") == True
    assert is_install_from_source("v0.5.0") == False
    assert is_install_from_source("main") == True
```

### 2. Add Coverage Tracking (2-4 hours)
```yaml
# .codecov.yml
coverage:
  status:
    project:
      default:
        target: 60%
    patch:
      default:
        target: 80%
```

### 3. Create CLAUDE.md (1-2 hours)
Add project-specific guidance for AI-assisted development covering:
- Containerfile is auto-generated (never edit directly)
- Test patterns (smoke tests are bash, integration uses upstream pytest suite)
- Build conventions (pre-commit generates Containerfile)

### 4. Pin Pre-commit Hooks to SHA (1 hour)
Current hooks use version tags. Pinning to commit SHAs prevents supply chain attacks:
```yaml
# Before:
- repo: https://github.com/pre-commit/pre-commit-hooks
  rev: v5.0.0
# After:
- repo: https://github.com/pre-commit/pre-commit-hooks
  rev: cef0300fd0fc4d2a87a85fa2093c6b283ea36f4b  # v5.0.0
```

## Detailed Findings

### Unit Tests
**Score: 2.0/10**

The repository has **zero unit test files**. No `test_*.py`, `*_test.py`, `conftest.py`, `pytest.ini`, or `pyproject.toml` with test configuration exists.

**Source code that needs unit tests:**
- `distribution/build.py` (346 lines) — Complex logic for:
  - Version string parsing (`is_version_tag`, `is_install_from_source`)
  - Dependency categorization (standard, torch, no-deps, no-cache)
  - Package name transformation (pymilvus extras, namespace packages)
  - Containerfile template rendering
- `scripts/gen_distro_docs.py` (279 lines) — Documentation generation from config.yaml

The score is 2.0 rather than 0.0 because the shell-based smoke tests (`tests/smoke.sh`) do validate some end-to-end behavior, providing indirect coverage of the build output.

### Integration/E2E Tests
**Score: 7.5/10**

The repository has a solid integration test strategy:

**Smoke Tests** (`tests/smoke.sh`, 232 lines):
- Starts the LLama Stack container with full environment configuration
- Health check polling (60-second timeout)
- Model listing verification for vLLM, Vertex AI, OpenAI, and embedding models
- OpenAI-compatible inference validation (chat completions with expected response content)
- PostgreSQL table creation verification (`llamastack_kvstore`, `inference_store`)
- PostgreSQL data population verification (inference records stored)
- Graceful degradation for fork PRs (cloud credentials not available)
- Failure tracking with aggregate reporting

**Integration Tests** (`tests/run_integration_tests.sh`, 129 lines):
- Clones upstream `llama-stack` repo at the matching version tag
- Runs upstream `pytest` integration test suite against the built image
- Tests inference API against multiple providers (vLLM, Vertex AI, OpenAI)
- Dynamic version/repo extraction from the Containerfile
- Explicit skip list for known-unstable tests (with TODO tracking)

**Strengths:**
- Multi-provider testing (vLLM, Vertex AI, OpenAI) with graceful skipping when credentials unavailable
- PostgreSQL integration testing (not just inference)
- CI runs on every PR and push, plus nightly scheduled runs against upstream `main`
- Reusable composite actions for vLLM and PostgreSQL setup

**Gaps:**
- No safety/eval provider testing in CI
- No vector store (Milvus, Qdrant, pgvector) integration testing
- No MCP tool runtime testing
- No multi-version testing (only tests against the pinned llama-stack version)

### Build Integration
**Score: 8.5/10**

This is a strong area for the repository:

**PR-Time Build Validation:**
- PR workflow builds the container image for AMD64 (loaded for testing)
- ARM64 build verification (build-only, no load — correct for cross-arch runners)
- Docker Buildx with GHA cache (`cache-from: type=gha`, `cache-to: type=gha,mode=max`)
- QEMU setup for multi-arch builds
- Path-filtered triggers (only builds when `distribution/`, `tests/`, or workflow files change)

**Konflux Integration:**
- Tekton PipelineRun definitions for both pull-request and push events
- References central `odh-konflux-central` multi-arch build pipeline
- CEL expressions for path-based triggering
- Separate `Dockerfile.konflux` for downstream Konflux builds with:
  - ARG-based base image selection from `konflux/cpu-ubi9.conf`
  - Wheel release installation from GitLab artifact registry
  - RPM dependency checking and self-testing
  - Label metadata for Red Hat container catalog

**Publishing:**
- Multi-arch image push (`linux/amd64,linux/arm64`) to Quay.io
- Smart tagging: `latest` on main, `rhoai-v*-latest` on release branches
- Change detection: only publishes when `distribution/` files actually changed
- `workflow_dispatch` for building from arbitrary llama-stack commits

**Containerfile Generation:**
- Template-based (`Containerfile.in`) with auto-generation via `build.py`
- Mergify rule warns when `Containerfile.in` changes to check Konflux Dockerfile sync
- Pre-commit hook ensures Containerfile is always regenerated

**Gap:**
- No automated sync verification between `Containerfile` and `Dockerfile.konflux` (Mergify only warns)

### Image Testing
**Score: 8.0/10**

**Container Analysis:**
- Base image: `registry.access.redhat.com/ubi9/python-312` (UBI 9, FIPS-capable)
- Pinned by SHA digest for reproducibility
- Uses `uv` for fast dependency installation
- OpenTelemetry instrumentation built-in
- Separate Konflux Dockerfile with RHEL AI base image and wheel release installation

**Runtime Validation (via smoke tests):**
- Container startup with health check polling
- OpenAI-compatible inference API testing
- PostgreSQL backend connectivity and data persistence
- Multi-provider model registration verification
- Embedding model download during build (`hf download ibm-granite/granite-embedding-125m-english`)

**Multi-Architecture:**
- AMD64 built and tested, ARM64 build-verified
- Multi-arch manifest published to Quay.io (`linux/amd64,linux/arm64`)

**Gaps:**
- No `HEALTHCHECK` instruction in the Containerfile (relies on external health probing)
- No container image size tracking
- No hadolint or container best-practice linting
- No readiness/liveness probe definitions (though this is a library, not a K8s deployment)

### Coverage Tracking
**Score: 0.0/10**

**No coverage tracking exists:**
- No `.codecov.yml` or `codecov.yml`
- No `.coveragerc` or `pyproject.toml` coverage configuration
- No `pytest-cov` usage in CI
- No coverage thresholds or PR coverage reporting
- No coverage badges

This is a significant gap given that the repository has testable Python code.

### CI/CD Automation
**Score: 8.5/10**

**Workflow Inventory:**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `redhat-distro-container.yml` | PR, push, schedule, dispatch | Build, test, publish container images |
| `pre-commit.yml` | PR, push | Run pre-commit hooks (ruff, shellcheck, etc.) |
| `semantic-pr.yml` | PR target | Enforce semantic PR title conventions |
| `stale_bot.yml` | Schedule (daily) | Auto-close stale issues/PRs (60 day stale, 30 day close) |

**Strengths:**
- **Concurrency control**: All workflows use `concurrency` groups with `cancel-in-progress: true`
- **Caching**: Docker layer caching via GHA cache, Python pip caching in pre-commit workflow
- **Scheduled builds**: Nightly at 6 AM UTC against upstream `main` — catches upstream breakage early
- **Workflow dispatch**: Custom builds from arbitrary llama-stack commits
- **Mergify**: Auto-merge with smart path-based condition checking (only requires build-test-push when relevant paths change)
- **Slack notifications**: Build success/failure notifications on push/dispatch (not on PRs)
- **Log artifact uploads**: Always uploads CI logs with 7-day retention
- **Semantic PR titles**: Enforced via `action-semantic-pull-request`
- **Pinned action versions**: All GitHub Actions pinned to commit SHAs (excellent supply chain practice)

**Gaps:**
- No test parallelization (models tested sequentially)
- No timeout specified on the main build job
- No matrix strategy for testing across multiple llama-stack versions

### Static Analysis
**Score: 8.0/10**

#### Linting
Comprehensive pre-commit configuration (`.pre-commit-config.yaml`):

| Tool | Purpose |
|------|---------|
| `ruff` | Python linting + formatting (with `--fix`) |
| `ruff-format` | Python code formatting |
| `shellcheck` | Shell script linting |
| `actionlint` | GitHub Actions workflow validation |
| `check-merge-conflict` | Detect merge conflict markers |
| `trailing-whitespace` | Remove trailing whitespace (excludes .py, handled by ruff) |
| `check-added-large-files` | Prevent files > 1000KB |
| `end-of-file-fixer` | Ensure files end with newline |
| `no-commit-to-branch` | Prevent direct commits to protected branches |
| `check-yaml` | YAML syntax validation |
| `detect-private-key` | Detect committed private keys |
| `requirements-txt-fixer` | Sort requirements files |
| `mixed-line-ending` | Enforce LF line endings |
| `check-executables-have-shebangs` | Verify shebangs on executable files |
| `check-json` | JSON syntax validation |
| `check-shebang-scripts-are-executable` | Ensure shebang scripts are executable |
| `check-symlinks` | Validate symlinks |
| `check-toml` | TOML syntax validation |

Custom hooks:
- `pkg-gen`: Auto-generates Containerfile via `build.py`
- `doc-gen`: Auto-generates distribution docs via `gen_distro_docs.py`

CI enforcement: Pre-commit runs in CI with `pre-commit/action@v3.0.1`, plus verification that no files changed after pre-commit runs.

#### FIPS Compatibility
- **Base image**: UBI 9 (`registry.access.redhat.com/ubi9/python-312`) — FIPS-capable
- **No non-FIPS crypto usage detected** in source code
- **No explicit FIPS build tags** — but this is a Python distribution image, not a Go binary
- **Konflux Dockerfile** uses AIPCC base image with wheel releases

#### Dependency Alerts
- **Dependabot**: Configured for `github-actions` (weekly, Saturday) and `uv` (security-only with `open-pull-requests-limit: 0`)
- **Renovate**: Configured with shared config from `red-hat-data-services/konflux-central`
- **Mergify auto-merge**: Dependency update PRs auto-merge with single approval

**Gaps:**
- No `mypy` or type checking for Python code
- Pre-commit hooks pinned to version tags, not SHA (supply chain risk)
- No hadolint for Dockerfile linting

### Agent Rules
**Score: 0.0/10**

- **No `CLAUDE.md`** in repository root
- **No `AGENTS.md`** in repository root
- **No `.claude/` directory** (no rules, no skills)
- **No testing documentation** specifying patterns or conventions

This is a gap that's easy to address. The repository has clear conventions that should be documented:
- Containerfile is auto-generated (never edit manually)
- Pre-commit must pass before submitting PRs
- Smoke tests are bash-based, integration tests use upstream pytest
- Semantic PR titles required
- Python code must pass ruff linting and formatting

## Recommendations

### Priority 0 (Critical)

1. **Add unit tests for `distribution/build.py`**
   - Test `is_version_tag()`, `is_install_from_source()`, `get_llama_stack_install()` with various version formats
   - Test dependency categorization in `get_dependencies()` (mock `subprocess.run`)
   - Test `generate_containerfile()` template rendering
   - Test package name transformations (pymilvus extras, namespace package conversion)
   - Effort: 4-6 hours

2. **Add pytest-cov and codecov integration**
   - Add `pytest` and `pytest-cov` to dev dependencies
   - Configure `.codecov.yml` with 60% project target, 80% patch target
   - Add codecov upload step to pre-commit or a new test workflow
   - Effort: 2-4 hours

### Priority 1 (High Value)

3. **Create CLAUDE.md with project conventions**
   - Document that `distribution/Containerfile` is auto-generated
   - Document test strategy (smoke = bash, integration = upstream pytest)
   - Document build process (pre-commit generates Containerfile)
   - Include contribution guidelines (semantic PRs, ruff formatting)
   - Effort: 1-2 hours (or use `/test-rules-generator`)

4. **Add unit tests for `scripts/gen_distro_docs.py`**
   - Test documentation generation from config.yaml
   - Effort: 2-3 hours

5. **Add entrypoint.sh behavior tests**
   - Test OTEL wrapping when `OTEL_SERVICE_NAME` is set
   - Test config resolution (`RUN_CONFIG_PATH`, `DISTRO_NAME`, default)
   - Effort: 1-2 hours

### Priority 2 (Nice-to-Have)

6. **Add hadolint for Dockerfile/Containerfile linting**
   - Add as pre-commit hook for both `Containerfile.in` and `Dockerfile.konflux`
   - Effort: 1-2 hours

7. **Add container image size tracking**
   - Log image size in CI, alert on unexpected growth
   - Effort: 2-3 hours

8. **Pin pre-commit hooks to commit SHAs**
   - Convert version tags to SHAs for all hooks
   - Effort: 1 hour

9. **Add Containerfile/Dockerfile.konflux sync validation**
   - Automated check beyond Mergify comment — verify key structural alignment
   - Effort: 3-4 hours

## Comparison to Gold Standards

| Dimension | rhds-llama-stack-distribution | odh-dashboard (Gold) | notebooks (Gold) | Gap |
|-----------|------------------------------|---------------------|------------------|-----|
| Unit Tests | 2.0 — No unit tests | 8.5 — Jest + Cypress | 7.0 — pytest | Need unit tests for build.py |
| Integration/E2E | 7.5 — Multi-provider smoke + integration | 9.0 — Multi-layer E2E | 8.0 — Image validation | Good; expand to more providers |
| Build Integration | 8.5 — PR build + Konflux | 8.0 — PR builds | 7.0 — Makefile targets | Strong; add sync validation |
| Image Testing | 8.0 — Startup + inference + DB | 6.0 — Basic builds | 9.0 — 5-layer validation | Good; add HEALTHCHECK |
| Coverage Tracking | 0.0 — None | 8.0 — Codecov enforced | 6.0 — Coverage reports | Critical gap |
| CI/CD Automation | 8.5 — Excellent | 9.0 — Comprehensive | 8.0 — Well-organized | Minor gaps (timeout, parallelization) |
| Static Analysis | 8.0 — Ruff + shellcheck + actionlint | 8.5 — ESLint + Prettier | 7.0 — Basic linting | Good; add type checking |
| Agent Rules | 0.0 — None | 7.0 — CLAUDE.md present | 3.0 — Minimal | Need CLAUDE.md |

## File Paths Reference

### CI/CD
- `.github/workflows/redhat-distro-container.yml` — Main build/test/publish workflow
- `.github/workflows/pre-commit.yml` — Pre-commit hook enforcement
- `.github/workflows/semantic-pr.yml` — Semantic PR title validation
- `.github/workflows/stale_bot.yml` — Stale issue/PR management
- `.github/mergify.yml` — Auto-merge rules
- `.tekton/odh-llama-stack-core-pull-request.yaml` — Konflux PR build
- `.tekton/odh-llama-stack-core-push.yaml` — Konflux push build

### Container Images
- `distribution/Containerfile` — Auto-generated container build (DO NOT EDIT)
- `distribution/Containerfile.in` — Template for Containerfile generation
- `Dockerfile.konflux` — Downstream Konflux/AIPCC container build
- `konflux/cpu-ubi9.conf` — Konflux build configuration

### Testing
- `tests/smoke.sh` — Container smoke tests (startup, inference, PostgreSQL)
- `tests/run_integration_tests.sh` — Upstream integration test runner
- `tests/test_utils.sh` — Shared test utilities

### Source Code
- `distribution/build.py` — Containerfile generator (346 lines)
- `distribution/config.yaml` — Llama Stack distribution configuration
- `distribution/entrypoint.sh` — Container entrypoint script
- `scripts/gen_distro_docs.py` — Documentation generator

### Static Analysis
- `.pre-commit-config.yaml` — Pre-commit hook configuration
- `.github/dependabot.yml` — Dependabot configuration
- `renovate.json` — Renovate configuration

### Composite Actions
- `.github/actions/setup-vllm/action.yml` — vLLM container setup
- `.github/actions/setup-postgres/action.yml` — PostgreSQL container setup
- `.github/actions/notify-slack/notify.sh` — Slack notification script
