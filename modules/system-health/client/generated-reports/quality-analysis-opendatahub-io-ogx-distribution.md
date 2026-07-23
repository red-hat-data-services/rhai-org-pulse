---
repository: "opendatahub-io/ogx-distribution"
overall_score: 7.0
scorecard:
  - dimension: "Unit Tests"
    score: 4.0
    status: "Shell-based unit tests for secrets/labels, but build scripts (964 LOC Python) have zero unit test coverage"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Exceptional multi-provider, multi-arch integration + E2E with real OpenShift cluster testing"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-time multi-arch image build + smoke/integration tests + Tekton Konflux pipelines"
  - dimension: "Image Testing"
    score: 7.0
    status: "UBI base, multi-arch (amd64/arm64), health check validation, separate vLLM image pipeline"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "No coverage tooling — no codecov, no pytest-cov, no thresholds"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "18+ workflows with concurrency control, caching, matrix builds, nightly/weekly schedules, Mergify, Slack"
  - dimension: "Static Analysis"
    score: 8.0
    status: "Comprehensive pre-commit (Ruff, ShellCheck, Actionlint) + Dependabot for 3 ecosystems"
  - dimension: "Agent Rules"
    score: 7.0
    status: "Thorough CLAUDE.md covering architecture, commands, CI/CD — missing test creation rules"
critical_gaps:
  - title: "No code coverage tracking"
    impact: "Cannot measure or enforce test coverage on Python build scripts; regressions go undetected"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Build scripts lack unit tests"
    impact: "964 lines of Python (gen_config.py, gen_containerfile.py, gen_lockfile.py, verify_secrets.py) have zero pytest unit tests — logic errors only surface at container build time"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No HEALTHCHECK instruction in Containerfile"
    impact: "Container orchestrators cannot auto-detect unhealthy containers; relies on external probes only"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add pytest-cov to functional test runs"
    effort: "2-3 hours"
    impact: "Immediate visibility into which Python code paths are exercised by existing tests"
  - title: "Add HEALTHCHECK to Containerfile.in"
    effort: "1 hour"
    impact: "Container-level health monitoring via /v1/health endpoint"
  - title: "Create .claude/rules/ with test creation guidance"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality for smoke and integration test patterns"
recommendations:
  priority_0:
    - "Add pytest unit tests for build scripts (gen_config.py, gen_containerfile.py, verify_secrets.py, common.py)"
    - "Integrate pytest-cov into CI and set a baseline coverage threshold for Python code"
  priority_1:
    - "Add HEALTHCHECK instruction to Containerfile.in for container-native health detection"
    - "Create .claude/rules/ directory with test patterns for shell smoke tests and Python build scripts"
    - "Enable Tekton early-gate-testing in Konflux pipelines (currently disabled)"
  priority_2:
    - "Add contract tests between build scripts and generated artifacts (e.g., verify config.yaml schema)"
    - "Consider adding type hints and mypy to Python build scripts for static type checking"
---

# Quality Analysis: ogx-distribution

## Executive Summary

- **Overall Score: 7.0/10**
- **Repository**: [opendatahub-io/ogx-distribution](https://github.com/opendatahub-io/ogx-distribution)
- **Type**: Container distribution / build + CI project (Python, Bash)
- **Jira**: RHOAIENG / OGX Core (midstream)
- **Key Strengths**: Exceptional integration/E2E testing across multiple providers and architectures, outstanding CI/CD automation with 18+ workflows, comprehensive pre-commit linting pipeline, and a thorough CLAUDE.md
- **Critical Gaps**: Zero unit test coverage for Python build scripts, no code coverage tracking
- **Agent Rules Status**: Present (CLAUDE.md) — comprehensive architecture docs but no test creation rules

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 4.0/10 | 15% | 0.60 | Shell unit tests for secrets/labels; build scripts untested |
| Integration/E2E | 9.0/10 | 20% | 1.80 | Multi-provider, multi-arch, real OpenShift cluster testing |
| Build Integration | 8.0/10 | 15% | 1.20 | PR-time multi-arch build + test + Tekton Konflux pipelines |
| Image Testing | 7.0/10 | 10% | 0.70 | UBI base, multi-arch, health validation; no HEALTHCHECK |
| Coverage Tracking | 2.0/10 | 10% | 0.20 | No coverage tooling at all |
| CI/CD Automation | 9.0/10 | 15% | 1.35 | 18+ workflows, concurrency, caching, nightly/weekly, Mergify |
| Static Analysis | 8.0/10 | 10% | 0.80 | Ruff + ShellCheck + Actionlint + Dependabot (3 ecosystems) |
| Agent Rules | 7.0/10 | 5% | 0.35 | Thorough CLAUDE.md; no .claude/rules/ for test patterns |
| **Overall** | **7.0/10** | | **7.00** | |

## Critical Gaps

### 1. Build Scripts Lack Unit Tests
- **Impact**: 964 lines of Python code (`build/gen_config.py`, `build/gen_containerfile.py`, `build/gen_lockfile.py`, `build/verify_secrets.py`, `build/common.py`, `build/gen_distro_docs.py`) have zero pytest unit tests. Logic errors only surface at container build time or during pre-commit runs.
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: These scripts handle critical operations — stripping providers, generating Containerfiles, compiling lock files, verifying secret consistency. A malformed `config.yaml` or `Containerfile` could break production deployments.

### 2. No Code Coverage Tracking
- **Impact**: Cannot measure which code paths are exercised by existing tests. No baseline for tracking coverage improvements. Regressions in test coverage go completely undetected.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No `.codecov.yml`, no `pytest-cov` usage, no coverage thresholds. While the codebase is relatively small, the build scripts contain complex logic that deserves coverage visibility.

### 3. No HEALTHCHECK in Containerfile
- **Impact**: Container orchestrators (Docker, Podman, Kubernetes without explicit probes) cannot auto-detect unhealthy containers. The application has a `/v1/health` endpoint, but it's only checked by external test scripts.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours

## Quick Wins

### 1. Add pytest-cov to Functional Test Runs (2-3 hours)
The functional test suite already uses pytest. Adding `pytest-cov` provides immediate coverage visibility.

```toml
# tests/functional/pyproject.toml — add to dependencies
[project.optional-dependencies]
dev = ["pytest-cov>=6.0"]
```

```bash
# In CI, add --cov flag
uv run pytest --cov=scripts --cov-report=xml tests/
```

### 2. Add HEALTHCHECK to Containerfile.in (1 hour)
```dockerfile
# Add before ENTRYPOINT in Containerfile.in
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://localhost:8321/v1/health || exit 1
```

### 3. Create Test Creation Rules (2-3 hours)
Generate `.claude/rules/` with patterns for writing smoke tests and build script tests using `/test-rules-generator`.

## Detailed Findings

### Unit Tests

**Score: 4.0/10**

The repo has shell-based unit tests but no pytest unit tests for Python code:

**Present:**
- `tests/test_file_secrets.sh` — 8 test cases for `resolve_file_secret()` function, covering happy paths, error cases, mutual exclusion, special characters, and edge cases. Well-structured with `pass`/`fail` helpers.
- `tests/verify-config-label.sh` — Validates OCI config labels on built images match `distribution/config.yaml`.
- `tests/check_secret_scrub_list.sh` — Verifies CI log scrub list matches secrets in smoke.sh.
- `build/verify_secrets.py` — Pre-commit hook verifying `_FILE` secret support (runs as a hook, not a test suite).

**Missing:**
- Zero pytest unit tests for any Python build script
- `build/gen_config.py` (91 LOC) — parses `build.yaml`, strips providers, generates `config.yaml`
- `build/gen_containerfile.py` (78 LOC) — generates `Containerfile` from template with base64-encoded config
- `build/gen_lockfile.py` (336 LOC) — creates virtualenvs, runs dependency discovery, compiles lock files
- `build/gen_distro_docs.py` (324 LOC) — generates provider documentation tables
- `build/common.py` (34 LOC) — shared `BuildConfig` class

**Test-to-code ratio**: 16 test files (shell+Python) / 13 source files — reasonable by file count, but the critical Python build logic has 0% unit test coverage.

**Files examined**: `tests/test_file_secrets.sh`, `tests/verify-config-label.sh`, `tests/check_secret_scrub_list.sh`, `build/*.py`

### Integration/E2E Tests

**Score: 9.0/10**

This is a standout dimension. The repo has an exceptionally well-designed multi-layer testing strategy:

**Layer 1 — Smoke Tests (`tests/smoke.sh`)**
- Container startup with health check polling (60s timeout)
- Model listing verification for all configured providers
- OpenAI-compatible chat completions inference
- Anthropic-compatible Messages API (`/v1/messages`) shape validation
- PostgreSQL table creation verification (`ogx_kvstore`, `inference_store`)
- PostgreSQL data population check
- File processor validation (inline::pypdf with embedded marker verification)
- RAG file ingestion pipeline (upload → vector store → index with status polling)
- Provider-conditional testing: vLLM, Vertex AI, OpenAI, Gemini, Anthropic all tested when credentials are available

**Layer 2 — Integration Tests (`tests/run_integration_tests.sh`)**
- Clones upstream OGX repo at the matching version tag
- Runs upstream `tests/integration/inference/` pytest suite against the running container
- Tests against multiple providers in sequence
- Well-documented skip reasons for each excluded test with upstream issue references

**Layer 3 — Functional Tests (`tests/functional/`)**
- Bruno API contract tests for CRUD operations
- Jupyter notebook integration tests executed via pytest
- JUnit XML output for CI reporting
- Reusable across deployment targets (local podman, Konflux ITS, RHOAI cluster)

**Layer 4 — Real Cluster Testing (`test-pr-in-showroom.yml`)**
- Deploys to a real OpenShift cluster
- Builds image, pushes to OpenShift internal registry
- Runs full showroom setup/provision/test/cleanup cycle
- PR author trust verification before building

**Layer 5 — Weekly Provider Regression (`responses-weekly.yml`)**
- Tests Responses API across OpenAI, Vertex AI, vLLM MaaS, and Bedrock
- JUnit results published to GitHub Pages with historical trends
- Matrix-based model testing per provider

**Layer 6 — Messages API Testing (`messages-vllm.yml`, `messages-openai.yml`)**
- Claude Agent SDK 3-turn session tests
- Both native passthrough (vLLM) and translation (OpenAI) paths

**Multi-architecture**: Both amd64 and arm64 run smoke + integration tests. With MaaS, both architectures run the full suite; without MaaS, arm64 runs smoke only.

**Files examined**: `tests/smoke.sh`, `tests/run_integration_tests.sh`, `tests/functional/`, `.github/workflows/redhat-distro-container.yml`, `test-pr-in-showroom.yml`, `responses-weekly.yml`, `messages-*.yml`

### Build Integration

**Score: 8.0/10**

**PR-time Build Validation:**
- `redhat-distro-container.yml` builds the container image on every PR (triggered by path filters on `build/`, `Containerfile`, `distribution/`, `tests/`)
- Multi-arch builds: both amd64 and arm64 via matrix strategy
- Built image is immediately tested with smoke + integration tests
- OCI label verification on built images (`verify-config-label.sh`)

**Pre-commit Build Pipeline:**
- `gen_config.py` regenerates `distribution/config.yaml` from `build/build.yaml`
- `gen_containerfile.py` regenerates `Containerfile` from `Containerfile.in` with embedded base64 config
- `verify_secrets.py` validates `_FILE` secret env var consistency
- `gen_distro_docs.py` regenerates `distribution/README.md`
- `pre-commit.yml` CI workflow ensures no uncommitted changes remain after hooks run

**Konflux/Tekton Integration:**
- `.tekton/odh-ogx-core-pull-request.yaml` — PR pipeline for Konflux builds
- `.tekton/odh-ogx-core-push.yaml` — Push pipeline for Konflux builds
- Both reference shared pipeline from `odh-konflux-central`
- Mergify rule reminds about Konflux Dockerfile sync when Containerfile changes

**Gap**: Tekton has `enable-early-gate-testing: "false"` — early gate testing is disabled in Konflux pipelines.

**Files examined**: `.github/workflows/redhat-distro-container.yml`, `.github/workflows/pre-commit.yml`, `.tekton/*.yaml`, `.pre-commit-config.yaml`, `.github/mergify.yml`

### Image Testing

**Score: 7.0/10**

**Base Image:**
- Main image uses `quay.io/opendatahub/odh-midstream-python-base-3-12:latest` — UBI-based, FIPS-capable
- vLLM test image uses `vllm/vllm-openai-cpu:v0.25.0` — non-UBI base (acceptable for CI-only image)

**Multi-arch Support:**
- Full multi-arch builds: `linux/amd64` and `linux/arm64`
- Publish step creates multi-platform manifest via `docker/build-push-action`
- Separate runners for each architecture (ubuntu-24.04 and ubuntu-24.04-arm)

**Container Runtime Validation:**
- Health check endpoint polling (60s timeout via curl)
- Model listing and inference validation after startup
- PostgreSQL connectivity verification
- File processor and RAG pipeline validation

**Build Optimization:**
- GHA build cache (`cache-from: type=gha`, `cache-to: type=gha,mode=max`)
- `--verify-hashes` on pip sync for supply chain integrity
- Mount cache for artifact downloads

**Separate vLLM CPU Container Pipeline:**
- `vllm-cpu-container.yml` builds, tests, and publishes pre-built vLLM CPU images
- Models are pre-loaded into the image to avoid download during CI
- Multi-arch build with digest-based publishing and manifest assembly

**Gaps:**
- No `HEALTHCHECK` instruction in Containerfile
- No Testcontainers usage (uses docker directly, which is fine for this use case)

**Files examined**: `Containerfile`, `Containerfile.in`, `vllm/Containerfile`, `.github/workflows/vllm-cpu-container.yml`, `.github/workflows/redhat-distro-container.yml`

### Coverage Tracking

**Score: 2.0/10**

No coverage tracking is implemented:

- No `.codecov.yml` or `codecov.yml`
- No `pytest-cov` or `--coverprofile` usage in any CI workflow
- No coverage thresholds or enforcement
- No PR coverage reporting

The functional test suite produces JUnit XML reports (via Bruno and pytest), which is good for test result tracking, but code coverage is entirely absent.

The score is not 0 because the codebase is primarily shell scripts and configuration (where traditional coverage tools are less applicable), and the Python code is relatively small. However, the build scripts contain enough logic to warrant coverage tracking.

**Files examined**: All workflow files, `tests/functional/pyproject.toml`, `.github/workflows/`

### CI/CD Automation

**Score: 9.0/10**

Outstanding CI/CD setup with 18+ workflow files:

**Workflow Inventory:**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `redhat-distro-container.yml` | PR, push, schedule (6AM daily), dispatch | Main build + test + publish pipeline |
| `pre-commit.yml` | PR, push to main | Linting + artifact regeneration |
| `semantic-pr.yml` | PR events | Conventional Commits title enforcement |
| `test-pr-in-showroom.yml` | Schedule (daily 8AM), dispatch | Real OpenShift cluster testing |
| `responses-weekly.yml` | Schedule (Sunday 22:00), dispatch | Multi-provider Responses API regression |
| `responses-openai.yml` | workflow_call | OpenAI Responses API tests |
| `responses-vertexai.yml` | workflow_call | Vertex AI Responses API tests |
| `responses-vllm-maas.yml` | workflow_call | vLLM MaaS Responses API tests |
| `responses-bedrock.yml` | workflow_call | AWS Bedrock Responses API tests |
| `messages-weekly.yml` | Schedule (Sunday 23:00), dispatch | Weekly Messages API regression |
| `messages-openai.yml` | workflow_call, dispatch | OpenAI Messages API + Agent SDK |
| `messages-vllm.yml` | workflow_call, dispatch | vLLM native Messages passthrough |
| `vllm-cpu-container.yml` | PR, push, dispatch | vLLM CPU image build + test + publish |
| `update-lockfiles.yml` | — | Lock file management |
| `create-or-update-release-branch.yml` | — | Release branch management |
| `stale_bot.yml` | Schedule (daily midnight) | Issue/PR staleness management |

**Best Practices:**
- **Concurrency control**: All workflows use `concurrency:` with `cancel-in-progress: true`
- **Caching**: GHA build cache for Docker layers, uv cache for Python
- **Matrix strategy**: Multi-arch builds (amd64/arm64)
- **Reusable actions**: 6 composite actions (`free-disk-space`, `notify-slack`, `regenerate-artifacts`, `setup-postgres`, `setup-server`, `setup-vllm`)
- **Artifact management**: Log uploads with 7-day retention + secret scrubbing (CWE-532 aware)
- **Slack notifications**: On failure and successful publish
- **Mergify**: Smart auto-merge with dependency update fast-track (1 approval), standard PRs (2 approvals), conflict detection, and conditional build checks
- **Timeout management**: Explicit `timeout-minutes` on jobs
- **Pin SHA versions**: All GitHub Actions pinned to commit SHAs with version comments
- **Credential validation**: Pre-flight checks for all provider API keys before testing

**Files examined**: All 18 workflow files in `.github/workflows/`, `.github/actions/`, `.github/mergify.yml`

### Static Analysis

**Score: 8.0/10**

**Linting Configuration (via `.pre-commit-config.yaml`):**

| Tool | Target | Version |
|------|--------|---------|
| Ruff (lint + format) | Python files | v0.9.4 |
| ShellCheck | Shell scripts | v0.11.0.1 |
| Actionlint | GitHub Actions workflows | v1.7.11 |
| pre-commit-hooks | General (YAML, JSON, TOML, merge conflicts, large files, executables, private keys, line endings) | v5.0.0 |

**Custom Pre-commit Hooks:**
- `gen-config` — Regenerates config.yaml (always runs)
- `gen-containerfile` — Regenerates Containerfile (always runs)
- `verify-secrets` — Validates _FILE secret consistency (always runs)
- `doc-gen` — Regenerates distribution docs (conditional on build.yaml/build.env/config.yaml changes)
- `check-secret-scrub` — Validates CI log scrub list matches smoke.sh secrets

**Dependency Alerts (`.github/dependabot.yml`):**
- `github-actions` ecosystem — weekly Saturday
- `uv` (Python) ecosystem — weekly Saturday, security-only updates (open-pull-requests-limit: 0)
- `docker` ecosystem for `vllm/` — weekly Saturday
- Labels and conventional commit prefixes configured

**FIPS Compatibility:**
- Main image: UBI-based (`quay.io/opendatahub/odh-midstream-python-base-3-12:latest`) — FIPS-capable
- vLLM image: Non-UBI (`vllm/vllm-openai-cpu:v0.25.0`) — acceptable for CI-only image
- No explicit FIPS build tags or `GOEXPERIMENT=boringcrypto` (not applicable — Python project)
- No non-FIPS crypto imports detected in source code

**Files examined**: `.pre-commit-config.yaml`, `.github/dependabot.yml`, `Containerfile.in`, `vllm/Containerfile`

### Agent Rules

**Score: 7.0/10**

**Present — `CLAUDE.md` (root):**
- **Project overview**: Clear description of OGX distribution purpose and container image
- **Common commands**: Build, run, test commands with explanations
- **Architecture**: Detailed build pipeline documentation covering all 4 pre-commit hooks
- **Auto-generated files**: Clear listing of files that should not be edited manually
- **Key files**: `build/build.yaml`, `build/build.env`, `Containerfile.in`, `distribution/entrypoint.sh`, `distribution/constraints.txt`
- **Provider activation pattern**: Explains `${env.SOME_VAR:+provider-name}` conditional syntax
- **Version management**: `OGX_VERSION` in `build/build.env`, `BuildConfig` in `common.py`
- **CI/CD overview**: Main workflow, Tekton, weekly testing pipelines
- **PR title format**: Conventional Commits enforcement
- **Important notes**: Python 3.12, `uv`, OGX fork distinction

**Missing:**
- No `.claude/` directory
- No `.claude/rules/` with test creation rules
- No AGENTS.md
- No test pattern documentation for AI agents (how to write smoke tests, what assertions to include, which env vars are required)

**Recommendation**: Generate test creation rules with `/test-rules-generator` to capture the existing test patterns (shell smoke tests with `test_*` functions, pytest functional tests, Bruno API contract tests).

**Files examined**: `CLAUDE.md`, directory listing for `.claude/`

## Recommendations

### Priority 0 (Critical)

1. **Add pytest unit tests for Python build scripts**
   - Target: `build/gen_config.py`, `build/gen_containerfile.py`, `build/verify_secrets.py`, `build/common.py`
   - These scripts generate critical deployment artifacts; a bug in `gen_config.py` could silently break provider configuration
   - Effort: 8-12 hours
   - Example test:
     ```python
     # tests/test_gen_config.py
     def test_stripped_providers_excluded():
         """Verify dependency-only providers are stripped from output config."""
         config = generate_config(build_yaml_path)
         for provider in STRIPPED_PROVIDER_TYPES:
             assert provider not in config["providers"]
     ```

2. **Integrate coverage tracking**
   - Add `pytest-cov` to functional test dependencies
   - Configure `.codecov.yml` or GitHub Actions coverage reporting
   - Set a baseline threshold (e.g., 60% for Python code)
   - Effort: 4-6 hours

### Priority 1 (High Value)

3. **Add HEALTHCHECK to Containerfile.in**
   - The `/v1/health` endpoint already exists; wire it into the container spec
   - Effort: 1 hour

4. **Create `.claude/rules/` with test patterns**
   - Document smoke test conventions (function naming, env var requirements, failure tracking pattern)
   - Document pytest functional test patterns (notebook execution, Bruno contract tests)
   - Use `/test-rules-generator` to bootstrap
   - Effort: 2-3 hours

5. **Enable early-gate-testing in Tekton pipelines**
   - Currently `enable-early-gate-testing: "false"` in both PR and push pipelines
   - Evaluate whether this can be enabled for faster feedback
   - Effort: 2-4 hours

### Priority 2 (Nice-to-Have)

6. **Add schema validation for generated artifacts**
   - Validate `config.yaml` against OGX config schema after generation
   - Validate `Containerfile` structure (e.g., required labels, entrypoint)
   - Effort: 4-6 hours

7. **Add type hints and mypy to build scripts**
   - Build scripts are pure Python with no type annotations
   - Adding mypy would catch type-related bugs at lint time
   - Effort: 4-6 hours

## Comparison to Gold Standards

| Practice | ogx-distribution | odh-dashboard | notebooks | kserve |
|----------|-----------------|---------------|-----------|--------|
| Multi-layer testing | Smoke + Integration + Functional + Cluster | Unit + Integration + E2E + Contract | Unit + Image + E2E | Unit + Integration + E2E |
| Coverage tracking | None | Codecov with thresholds | Partial | Codecov with enforcement |
| PR build validation | Multi-arch build + smoke + integration | Build + unit + integration | Image build + validation | Build + unit + E2E |
| Multi-arch support | amd64 + arm64 | N/A (web app) | amd64 + arm64 + s390x | amd64 |
| Multi-provider testing | vLLM, OpenAI, Vertex, Gemini, Anthropic, Bedrock | N/A | N/A | N/A |
| Pre-commit hooks | Ruff + ShellCheck + Actionlint + custom | ESLint + Prettier | Various | golangci-lint |
| Dependabot | github-actions + uv + docker | github-actions + npm | github-actions + pip | github-actions + gomod |
| Agent rules (CLAUDE.md) | Comprehensive | Comprehensive | Basic | None |
| Test creation rules | Missing | Present | Missing | Missing |
| Nightly testing | Daily 6AM build + test | N/A | Periodic | Weekly |
| Weekly regression | Provider-specific Responses + Messages API tests | N/A | N/A | N/A |
| Real cluster testing | OpenShift showroom deployment | N/A | N/A | Kind-based |

## File Paths Reference

### CI/CD
- `.github/workflows/redhat-distro-container.yml` — Main build/test/publish pipeline
- `.github/workflows/pre-commit.yml` — Linting and artifact validation
- `.github/workflows/test-pr-in-showroom.yml` — OpenShift cluster testing
- `.github/workflows/responses-weekly.yml` — Weekly multi-provider regression
- `.github/workflows/messages-vllm.yml` — Native Messages API testing
- `.github/workflows/messages-openai.yml` — OpenAI Messages API testing
- `.github/workflows/vllm-cpu-container.yml` — vLLM CI image build
- `.github/workflows/semantic-pr.yml` — PR title enforcement
- `.github/mergify.yml` — Auto-merge rules
- `.tekton/odh-ogx-core-pull-request.yaml` — Konflux PR pipeline
- `.tekton/odh-ogx-core-push.yaml` — Konflux push pipeline

### Testing
- `tests/smoke.sh` — Container smoke tests (health, inference, Messages, PostgreSQL, file processor, RAG)
- `tests/run_integration_tests.sh` — Upstream OGX pytest integration suite
- `tests/test_file_secrets.sh` — Unit tests for _FILE secret resolution
- `tests/verify-config-label.sh` — OCI label verification
- `tests/messages_agent_sdk.py` — Claude Agent SDK 3-turn session
- `tests/functional/` — Bruno API contracts + Jupyter notebook tests
- `tests/README.md` — Comprehensive testing documentation

### Build Configuration
- `build/build.yaml` — Source of truth for provider definitions
- `build/build.env` — OGX version configuration
- `build/gen_config.py` — Generates distribution/config.yaml
- `build/gen_containerfile.py` — Generates Containerfile from template
- `build/gen_lockfile.py` — Generates pinned lock files
- `build/verify_secrets.py` — Validates secret env var consistency
- `build/common.py` — Shared BuildConfig class
- `Containerfile.in` — Container build template (hand-edited)
- `Containerfile` — Auto-generated (do not edit)

### Container Images
- `Containerfile.in` — Main distribution container template (UBI-based)
- `vllm/Containerfile` — vLLM CPU test image

### Static Analysis
- `.pre-commit-config.yaml` — Ruff, ShellCheck, Actionlint, custom hooks
- `.github/dependabot.yml` — github-actions, uv, docker ecosystems

### Agent Rules
- `CLAUDE.md` — Comprehensive project documentation for AI agents
