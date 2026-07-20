---
repository: "red-hat-data-services/NeMo-Guardrails"
overall_score: 8.0
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "Excellent test suite with 423 test files, pytest-xdist parallelization, VCR cassettes, and deterministic embedding fixtures"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "Strong integration tests with LangChain, server, and provider integrations; no dedicated E2E cluster-based tests"
  - dimension: "Build Integration"
    score: 8.0
    status: "Wheel build + server startup validation on PR; Konflux Dockerfile present; Docker image build and health check testing"
  - dimension: "Image Testing"
    score: 8.0
    status: "Three Dockerfiles with UBI9 base, multi-arch support (ppc64le), HEALTHCHECK directive, runtime server validation"
  - dimension: "Coverage Tracking"
    score: 9.0
    status: "Codecov integration with 85% threshold enforcement on PRs, coverage on develop branch pushes"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "29 workflows covering PR tests, full-tests (multi-OS/Python matrix), latest-deps, Docker, security, regression-proof, release"
  - dimension: "Static Analysis"
    score: 8.0
    status: "Ruff linting + formatting, pre-commit hooks, ty type checker, Dependabot, zizmor GHA security; md5 FIPS concern"
  - dimension: "Agent Rules"
    score: 9.0
    status: "Comprehensive CLAUDE.md and AGENTS.md with detailed repo layout, validation table, review guidance, and contribution rules"
critical_gaps:
  - title: "hashlib.md5 usage in non-FIPS-safe pattern"
    impact: "md5 calls in utils.py and embeddings/cache.py will raise ValueError on FIPS-enforced systems; fallback exists in utils.py but cache.py has no fallback"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "Dependabot covers only github-actions and pre-commit, not pip ecosystem"
    impact: "Python dependency vulnerabilities are not automatically surfaced via PR updates"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No dedicated E2E test infrastructure with real service deployment"
    impact: "Integration behavior between guardrails server and real LLM providers is not tested in CI"
    severity: "LOW"
    effort: "16-24 hours"
quick_wins:
  - title: "Add pip ecosystem to Dependabot configuration"
    effort: "30 minutes"
    impact: "Automated Python dependency vulnerability alerts and update PRs"
  - title: "Replace md5 with sha256 in embeddings/cache.py for FIPS safety"
    effort: "1-2 hours"
    impact: "Eliminate FIPS-mode failures in cache key generation"
  - title: "Add concurrency control to PR test workflows"
    effort: "30 minutes"
    impact: "Cancel redundant in-flight test runs on force-push, saving CI resources"
recommendations:
  priority_0:
    - "Fix FIPS-incompatible hashlib.md5 usage in embeddings/cache.py (no fallback like utils.py has)"
    - "Add pip/uv ecosystem to Dependabot to cover Python dependency vulnerabilities"
  priority_1:
    - "Add concurrency groups to pr-tests.yml and full-tests.yml workflows for CI efficiency"
    - "Add codecov.yml with target/patch thresholds for finer coverage control"
    - "Consider adding timeout-minutes to more workflows to prevent runaway CI jobs"
  priority_2:
    - "Add .claude/rules/ directory with test creation rule files for more granular agent guidance"
    - "Consider adding E2E smoke tests with a deployed server + real config validation"
    - "Add coverage badges to README for visibility"
---

# Quality Analysis: NeMo-Guardrails (red-hat-data-services)

## Executive Summary

- **Overall Score: 8.0/10**
- **Repository Type**: Python library + server (AI guardrails toolkit)
- **Primary Language**: Python (824 .py files)
- **Tier**: Downstream (Jira: RHOAIENG / AI Safety)
- **Key Strengths**: Outstanding test infrastructure (423 test files, 1692 async tests, VCR cassettes, deterministic fixtures), comprehensive CI with 29 workflows covering multi-OS/multi-Python matrix testing, strong coverage enforcement at 85% threshold, excellent agent rules documentation, and sophisticated regression-proof workflow for fix PRs
- **Critical Gaps**: md5 usage without consistent FIPS fallback, Dependabot doesn't cover Python dependencies, no concurrency control on core PR test workflows
- **Agent Rules Status**: Present and comprehensive (CLAUDE.md + AGENTS.md)

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 9.0/10 | 15% | Excellent test suite with 423 test files, pytest-xdist, VCR cassettes |
| Integration/E2E | 7.0/10 | 20% | Strong integration tests but no dedicated E2E cluster infrastructure |
| Build Integration | 8.0/10 | 15% | Wheel build + server startup validation; Konflux Dockerfile present |
| Image Testing | 8.0/10 | 10% | Three Dockerfiles, UBI9, multi-arch (ppc64le), HEALTHCHECK, runtime validation |
| Coverage Tracking | 9.0/10 | 10% | Codecov with 85% threshold enforcement on PRs |
| CI/CD Automation | 9.0/10 | 15% | 29 workflows, multi-OS matrix, regression-proof, latest-deps canary |
| Static Analysis | 8.0/10 | 10% | Ruff + ty + pre-commit + zizmor + Dependabot; md5 FIPS concern |
| Agent Rules | 9.0/10 | 5% | Comprehensive CLAUDE.md and AGENTS.md with validation tables |

## Critical Gaps

### 1. hashlib.md5 usage without consistent FIPS fallback
- **Impact**: On FIPS-enforced systems (common in Red Hat deployments), `hashlib.md5()` raises `ValueError`. `utils.py` has a try/except fallback to sha256, but `embeddings/cache.py` uses md5 directly with no fallback.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Files**: `nemoguardrails/utils.py:407-408`, `nemoguardrails/embeddings/cache.py:71`

### 2. Dependabot missing pip ecosystem coverage
- **Impact**: Python dependency vulnerabilities are not automatically detected. Only `github-actions` and `pre-commit` ecosystems are configured.
- **Severity**: MEDIUM
- **Effort**: 30 minutes to add pip ecosystem to `.github/dependabot.yml`

### 3. No dedicated E2E test infrastructure
- **Impact**: While server startup is validated in CI (wheel test, Docker test), there are no E2E tests that deploy the guardrails server with real configurations and exercise the full request path against mock or real LLM providers in a deployed environment.
- **Severity**: LOW
- **Effort**: 16-24 hours

## Quick Wins

### 1. Add pip ecosystem to Dependabot (30 minutes)
Add to `.github/dependabot.yml`:
```yaml
  - package-ecosystem: pip
    directory: /
    schedule:
      interval: weekly
    groups:
      python-deps:
        patterns:
          - "*"
```

### 2. Fix FIPS-incompatible md5 in cache.py (1-2 hours)
Replace direct `hashlib.md5()` call in `nemoguardrails/embeddings/cache.py` with the same fallback pattern used in `utils.py`, or switch to sha256 by default.

### 3. Add concurrency control to PR test workflows (30 minutes)
Add to `pr-tests.yml` and `full-tests.yml`:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

## Detailed Findings

### Unit Tests (9.0/10)

**Strengths:**
- **423 test files** across well-organized subdirectories: `tests/guardrails/` (35 files), `tests/integrations/` (49 files), `tests/v2_x/` (36 files), `tests/recorded/` (45 files), plus 168 root-level test modules
- **25 benchmark test files** under `benchmark/tests/`
- **Test-to-code ratio**: ~1.05 (423 test files / 401 source files) - excellent
- **pytest-xdist** parallelization with `worksteal` distribution strategy
- **1,692 async test markers** (`pytest.mark.asyncio`) reflecting the heavily async codebase
- **VCR cassettes**: 45 recorded cassettes using pytest-recording for deterministic API replay
- **137 test configuration files** under `tests/test_configs/` for diverse guardrail scenarios
- **Deterministic embedding fixtures**: Custom `DeterministicEmbeddingSearchProvider` avoids real model downloads in tests
- **Well-defined test markers**: `recorded`, `serial`, `slow`, `perf`, `live`, `vcr`, `fake_cassette`, `real_embeddings`
- **Test isolation**: `autouse` fixtures reset context variables (`reasoning_trace_var`, `tool_calls_var`) between tests
- **Environment safety**: `make test` unsets `OPENAI_API_KEY` and `NVIDIA_API_KEY` so unit tests cannot accidentally hit live services

**Minor gaps:**
- No explicit `t.Parallel()` equivalent (pytest-xdist handles parallelism at the runner level, which is fine for Python)

### Integration/E2E Tests (7.0/10)

**Strengths:**
- **Server integration tests** (`tests/server/` - 8 files) testing FastAPI endpoints
- **LangChain integration tests** (`tests/integrations/langchain/` - extensive) covering provider-specific behavior
- **Provider drift canary**: `LANGCHAIN_PROVIDER_DRIFT_CHECK` env var enables detection of LangChain community provider API changes
- **Wheel installation + server startup tests** (`test-and-build-wheel.yml`) validating the packaged artifact works end-to-end
- **Docker runtime validation** (`test-docker.yml`) building the image, starting a container, and verifying health checks
- **Published distribution test** (`test-published-dist.yml`) installing from PyPI nightly and validating server startup
- **Test integration dependency group** in `pyproject.toml` covering `aioresponses`, `streamlit`, `openai`, `fastapi`, etc.

**Gaps:**
- No dedicated `e2e/` or `integration/` test directory with cluster-based (Kind/Minikube) deployment tests
- No contract tests between the guardrails server and downstream consumers
- Integration tests rely on mocks/cassettes rather than real service deployments

### Build Integration (8.0/10)

**Strengths:**
- **PR-triggered tests** (`pr-tests.yml`) run across Python 3.10-3.13 matrix on Ubuntu
- **Full tests** (`full-tests.yml`) add Windows and macOS on review request / push to main/develop
- **Wheel build and test** (`test-and-build-wheel.yml`) builds the distribution, installs it, starts the server, and verifies health
- **Konflux Dockerfile** (`Dockerfile.konflux`) present with multi-stage build, UBI9 base, multi-arch support (ppc64le), cachi2 integration
- **Docker image build and test** (`test-docker.yml`) triggered on Dockerfile/pyproject.toml changes
- **Lock file verification**: `uv lock --check` runs in CI to ensure pyproject.toml and uv.lock are in sync
- **Makefile targets**: `image-build`, `image-local-build`, `image-local-push`, `image-kind` for development workflow

**Gaps:**
- No PR-time Konflux build simulation (only the Dockerfile.konflux exists; no workflow triggers it on PRs)
- No kustomize/operator manifest validation (not applicable - this is a library, not an operator)

### Image Testing (8.0/10)

**Strengths:**
- **Three Dockerfiles** covering different use cases:
  - `Dockerfile` - upstream development image (python:3.12-slim)
  - `Dockerfile.server` - UBI9 multi-stage production build
  - `Dockerfile.konflux` - 8-stage Konflux build with multi-arch support (ppc64le)
- **UBI9 base images** (`registry.access.redhat.com/ubi9/python-312`) for FIPS-capable production builds
- **Multi-stage builds** in both Dockerfile.server and Dockerfile.konflux for reduced image size
- **Multi-architecture support**: Dockerfile.konflux explicitly handles `ppc64le` with custom PyTorch, OpenBLAS, onnxruntime, tiktoken, and hf_xet builds
- **HEALTHCHECK directive** in the upstream Dockerfile with configurable URL
- **Runtime validation**: CI tests build the Docker image, start a container, wait for readiness, verify HTTP 200 from `/v1/rails/configs`, then stop/remove
- **`.dockerignore`** properly configured to exclude .git, caches, build artifacts
- **Security**: Non-root user (USER 1001) in production Dockerfiles, `persist-credentials: false` on checkouts

**Gaps:**
- No multi-arch build in CI (only in Dockerfile.konflux which isn't triggered by CI)
- HEALTHCHECK only in the upstream Dockerfile, not in Dockerfile.server or Dockerfile.konflux

### Coverage Tracking (9.0/10)

**Strengths:**
- **85% coverage threshold** enforced via `--cov-fail-under=85` in the `_test.yml` reusable workflow
- **Codecov integration** with `codecov/codecov-action@v7`, pinned to specific SHA for security
- **Coverage on PRs**: Python 3.11 matrix entry runs with coverage enabled
- **Coverage on develop branch**: `develop-coverage.yml` runs coverage on every push to develop
- **pytest-cov** configured in dependency groups
- **Coverage reporting**: `--cov-report=term` for CI visibility, XML output for Codecov upload
- **`fail_ci_if_error: true`** on Codecov upload ensures coverage data integrity

**Gaps:**
- No `.codecov.yml` for project-level coverage configuration (patch coverage thresholds, flags, ignore patterns)
- No coverage badge in README

### CI/CD Automation (9.0/10)

**Strengths:**
- **29 GitHub Actions workflows** providing comprehensive automation:
  - `pr-tests.yml` / `_test.yml`: Reusable test workflow with multi-Python matrix (3.10-3.13)
  - `full-tests.yml`: Cross-platform testing (Ubuntu, macOS, Windows)
  - `lint.yml`: Pre-commit hooks enforcement on PRs and pushes
  - `pr-fix-regression-proof.yml`: Innovative workflow that proves `fix(...)` PRs have tests that fail without the fix
  - `test-and-build-wheel.yml`: Build + server startup validation (daily + push to main/develop)
  - `test-docker.yml`: Docker image build and runtime validation
  - `test-published-dist.yml`: Daily PyPI distribution install test
  - `latest-deps-tests.yml`: Nightly dependency compatibility canary
  - `uv-latest.yml`: Weekly uv compatibility check
  - `security.yml`: Trivy + Bandit security scans
  - `zizmor.yml`: GitHub Actions security audit
  - `release.yml`: Automated release pipeline
  - `publish-wheel.yml` / `publish-pypi-approval.yml`: Gated PyPI publishing
- **GitLab CI** (`.gitlab-ci.yml`) as alternative CI with multi-Python matrix tests, Docker build, and Docker test stages
- **Mergify** for automated backport: develop -> incubation -> stable
- **CodeRabbit** for AI-assisted code review
- **Custom composite action** (`.github/actions/setup-uv/`) for consistent uv setup across workflows
- **fail-fast: false** on test matrices so all versions report results
- **Concurrency control** on 6 workflows (though not on the main test workflows)

**Gaps:**
- No concurrency groups on `pr-tests.yml` or `full-tests.yml` - redundant runs on force-push
- Limited `timeout-minutes` usage (only on `codeql.yml` and `test-docker.yml`)
- No explicit caching configuration in most workflows (uv's built-in cache via setup-uv is used)

### Static Analysis (8.0/10)

#### Linting
- **Ruff** (v0.14.6 pinned) for linting and formatting with sensible rule selection: `E4`, `E7`, `E9`, `F`, `W291-293`, `I001-002`
- **ruff-format** as code formatter (Black-compatible)
- **ty** (v0.0.56) for type checking on targeted source paths
- **Line length**: 120 characters

#### Pre-commit Hooks
- **`.pre-commit-config.yaml`** with 5 hook repos:
  - `pre-commit-hooks`: check-yaml, end-of-file-fixer, trailing-whitespace
  - `ruff-pre-commit`: ruff linter + formatter
  - `Lucas-C/pre-commit-hooks`: license header insertion
  - `zizmor-pre-commit`: GitHub Actions security linting
  - Local `ty check` hook for type checking
- Enforced in CI via `make pre-commit` in the lint workflow

#### FIPS Compatibility
- **Concern**: `hashlib.md5` used in three locations:
  - `nemoguardrails/utils.py:407-408` - Has try/except fallback to sha256 (acceptable)
  - `nemoguardrails/embeddings/cache.py:71` - Direct md5 with **no fallback** (will fail on FIPS systems)
  - `nemoguardrails/llm/cache/utils.py` - Uses hashlib but needs verification
- **Base images**: Dockerfile.server and Dockerfile.konflux use UBI9 (FIPS-capable)
- **No FIPS build tags** (not applicable for Python)

#### Dependency Alerts
- **Dependabot** configured for `github-actions` and `pre-commit` ecosystems with monthly schedule and grouping
- **Missing**: `pip` ecosystem not covered - Python dependency vulnerabilities won't generate automated PRs
- No Renovate configuration

### Agent Rules (9.0/10)

**Strengths:**
- **CLAUDE.md** (root): Comprehensive repository overview with:
  - Repository layout with key file paths
  - Git remotes documentation (upstream, trustyai-fork, midstream, downstream)
  - Build/install instructions
  - Test running commands
  - CI workflow explanation
  - Key fork changes documentation
- **AGENTS.md** (root): Detailed agent collaboration rules with:
  - Cross-references to `CONTRIBUTING.md` and `AI_POLICY.md`
  - Repository map with testpaths and schemas
  - Validation command table with minimum validation per change type
  - Contribution workflow (issue/PR process, duplicate checking)
  - Review readiness criteria
  - Code change guidance
  - Documentation rules
  - Review mode instructions
- **Nested agent docs**: References to `nemoguardrails/AGENTS.md` for runtime rules and `docs/AGENTS.md` for documentation rules
- **AI_POLICY.md**: Formal AI-assisted contribution policy

**Gaps:**
- No `.claude/rules/` directory with granular test creation rules
- No `.claude/skills/` directory with custom skills
- Agent rules are in markdown files rather than structured rule files

## Recommendations

### Priority 0 (Critical)
1. **Fix FIPS-incompatible md5 in embeddings/cache.py** - The `MD5KeyGenerator` class uses `hashlib.md5` directly without a FIPS fallback. Since the downstream Dockerfiles use UBI9 (FIPS-capable), this will fail on FIPS-enforced OpenShift clusters. Either add the same try/except pattern from `utils.py` or default to SHA256.
2. **Add pip ecosystem to Dependabot** - Python is the primary language with 100+ dependencies. Without pip ecosystem coverage, CVEs in dependencies like `aiohttp`, `httpx`, `pydantic`, `protobuf` won't generate automated alert PRs.

### Priority 1 (High Value)
3. **Add concurrency groups to PR test workflows** - `pr-tests.yml` and `full-tests.yml` lack concurrency control. Pushing multiple commits to a PR branch triggers redundant parallel runs. Add `concurrency: { group: ..., cancel-in-progress: true }`.
4. **Create `.codecov.yml`** with project/patch targets, ignore patterns for test files, and component flags to get more granular coverage insights.
5. **Add `timeout-minutes`** to all test workflows to prevent hung CI jobs from consuming runner quota.

### Priority 2 (Nice-to-Have)
6. **Add `.claude/rules/` directory** with structured test creation rules (unit-tests.md, integration-tests.md) that reference the project's specific patterns (pytest-asyncio, VCR cassettes, deterministic embedding fixtures).
7. **Add E2E smoke tests** that deploy the server container with a real configuration and exercise the `/v1/guardrail/checks` endpoint with representative inputs.
8. **Add coverage badge to README** for visibility of the 85% threshold enforcement.

## Comparison to Gold Standards

| Dimension | NeMo-Guardrails | odh-dashboard | notebooks | kserve |
|-----------|----------------|---------------|-----------|--------|
| Unit Tests | 9.0 - Excellent ratio, VCR cassettes, deterministic fixtures | 9.0 - Multi-layer testing | 7.0 - Image-focused | 8.0 - Operator testing |
| Integration/E2E | 7.0 - Server + provider integration | 9.0 - Contract tests, E2E | 8.0 - Multi-version | 9.0 - Multi-version K8s |
| Build Integration | 8.0 - Wheel + Docker validation | 8.0 - PR builds | 9.0 - 5-layer validation | 8.0 - Operator bundles |
| Image Testing | 8.0 - 3 Dockerfiles, UBI9, multi-arch | 7.0 - Basic | 9.0 - Gold standard | 7.0 - Basic |
| Coverage Tracking | 9.0 - 85% enforced, Codecov | 9.0 - Enforced | 6.0 - Limited | 9.0 - Enforced |
| CI/CD Automation | 9.0 - 29 workflows, regression-proof | 9.0 - Comprehensive | 8.0 - Image-focused | 8.0 - Solid |
| Static Analysis | 8.0 - Ruff + ty + pre-commit + zizmor | 8.0 - ESLint | 6.0 - Basic | 8.0 - golangci-lint |
| Agent Rules | 9.0 - CLAUDE.md + AGENTS.md | 8.0 - Comprehensive | 3.0 - Minimal | 3.0 - None |

## File Paths Reference

### CI/CD
- `.github/workflows/pr-tests.yml` - PR test matrix (Ubuntu, Python 3.10-3.13)
- `.github/workflows/_test.yml` - Reusable test workflow with coverage support
- `.github/workflows/full-tests.yml` - Full cross-platform tests (Windows, macOS)
- `.github/workflows/lint.yml` - Pre-commit enforcement
- `.github/workflows/pr-fix-regression-proof.yml` - Fix PR regression validation
- `.github/workflows/test-and-build-wheel.yml` - Wheel build + server startup
- `.github/workflows/test-docker.yml` - Docker image build + runtime test
- `.github/workflows/test-published-dist.yml` - Daily PyPI install test
- `.github/workflows/latest-deps-tests.yml` - Nightly latest-deps canary
- `.github/workflows/security.yml` - Trivy + Bandit security scan
- `.github/workflows/zizmor.yml` - GitHub Actions security audit
- `.github/workflows/develop-coverage.yml` - Coverage on develop branch
- `.gitlab-ci.yml` - GitLab CI alternative
- `.mergify.yml` - Automated backport (develop -> incubation -> stable)
- `.coderabbit.yaml` - AI code review configuration

### Testing
- `tests/` - Main test directory (423 files)
- `benchmark/tests/` - Benchmark tests (25 files)
- `tests/recorded/` - VCR cassette replay tests
- `tests/test_configs/` - 137 test configuration files
- `tests/conftest.py` - Root conftest with deterministic embedding fixture
- `pytest.ini` - Test configuration with markers

### Code Quality
- `ruff.toml` - Ruff linter/formatter configuration
- `.pre-commit-config.yaml` - 5 hook repos (ruff, ty, zizmor, license, basics)
- `.github/dependabot.yml` - Dependabot for github-actions and pre-commit
- `pyproject.toml` - Project config, dependency groups, tool configs

### Container Images
- `Dockerfile` - Upstream development image (python:3.12-slim)
- `Dockerfile.server` - UBI9 production multi-stage build
- `Dockerfile.konflux` - 8-stage Konflux build with ppc64le support
- `.dockerignore` - Build context exclusions

### Agent Rules
- `CLAUDE.md` - Repository overview and development guide for Claude
- `AGENTS.md` - Detailed agent collaboration rules and validation tables
- `AI_POLICY.md` - AI-assisted contribution policy
- `CONTRIBUTING.md` - Public contribution workflow
