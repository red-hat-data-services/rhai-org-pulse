---
repository: "red-hat-data-services/NeMo-Guardrails"
overall_score: 7.2
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "271 test files with extensive pytest coverage across Python 3.10-3.13, good test-to-code ratio (1:1), strong async test support"
  - dimension: "Integration/E2E"
    score: 5.5
    status: "Limited integration tests (2 files), QA smoke tests exist but run manually, no automated E2E pipeline, Docker runtime tests present"
  - dimension: "Build Integration"
    score: 7.0
    status: "Konflux/Tekton pipelines for multi-arch builds (x86_64, arm64, ppc64le), PR builds triggered via label/comment, no PR-time Konflux simulation in GitHub CI"
  - dimension: "Image Testing"
    score: 7.5
    status: "Docker build + health check + API validation in CI, multi-stage UBI9 builds, ppc64le support, but limited runtime functional testing"
  - dimension: "Coverage Tracking"
    score: 5.0
    status: "Codecov integration exists but set to informational-only (no enforcement), coverage runs on Python 3.11 only"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "17 GitHub workflows, multi-OS matrix (Ubuntu/macOS/Windows), reusable workflow pattern, Poetry caching, daily latest-deps nightly, GitLab CI backup"
  - dimension: "Agent Rules"
    score: 6.0
    status: "CLAUDE.md present with repo layout and build/test instructions, no .claude/rules/ directory, no test creation guidelines for AI agents"
critical_gaps:
  - title: "Coverage enforcement is informational-only"
    impact: "Coverage can silently regress on PRs without anyone noticing; no minimum threshold enforced"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No automated E2E integration testing"
    impact: "QA tests exist (qa/ directory with 5 test scenarios) but run manually; no CI job executes them against a running server with real LLM mocking"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "Security scans limited to develop branch only"
    impact: "Trivy and Bandit scans only run on PRs targeting develop; PRs to main or feature branches skip security scanning entirely"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No PR-time Konflux build simulation"
    impact: "Konflux builds use Dockerfile.konflux with multi-arch support (ppc64le) and cachi2 prefetch; failures only discovered post-merge when Tekton pipeline runs"
    severity: "MEDIUM"
    effort: "8-12 hours"
quick_wins:
  - title: "Enable coverage enforcement thresholds in codecov.yml"
    effort: "1-2 hours"
    impact: "Prevents silent coverage regression on PRs by enforcing minimum project and patch coverage"
  - title: "Extend security scans to all PR target branches"
    effort: "30 minutes"
    impact: "Ensures Trivy and Bandit run on every PR regardless of target branch"
  - title: "Add .claude/rules/ with test creation guidelines"
    effort: "2-3 hours"
    impact: "Improves AI-generated test quality and consistency with existing patterns"
  - title: "Add pytest markers for test categorization"
    effort: "2-4 hours"
    impact: "Enables selective test execution (unit vs integration vs slow) and faster PR feedback"
recommendations:
  priority_0:
    - "Enable coverage enforcement: set project threshold to current baseline and patch threshold to 80%+ in codecov.yml"
    - "Extend Trivy + Bandit security scanning to all branches, not just develop"
  priority_1:
    - "Automate QA smoke tests: run qa/test_*.py suite against Docker container in CI with mock LLM server"
    - "Add Dockerfile.konflux build validation in PR workflow to catch multi-arch build issues before merge"
    - "Create .claude/rules/ directory with unit-test, integration-test, and API-test guidelines"
  priority_2:
    - "Add performance regression testing using benchmark/locust suite in CI"
    - "Implement contract testing for the /v1/guardrail/checks fork-specific API endpoint"
    - "Add secret detection tooling (Gitleaks or TruffleHog) alongside existing Trivy/Bandit scans"
---

# Quality Analysis: NeMo-Guardrails (Red Hat Downstream Fork)

## Executive Summary

- **Overall Score: 7.2/10**
- **Repository Type**: Python library + FastAPI server for LLM guardrails
- **Primary Language**: Python (649 .py files, 270 source + 271 test files)
- **Build System**: Poetry (1.8.2), tox, multi-stage Docker (UBI9)
- **Key Strengths**: Excellent unit test coverage with 1:1 test-to-code ratio, multi-OS/multi-Python CI matrix, sophisticated multi-arch container builds (x86_64, arm64, ppc64le), reusable GitHub Actions workflows, Trivy + Bandit security scanning
- **Critical Gaps**: Coverage enforcement is informational-only, no automated E2E testing in CI, security scans limited to develop branch
- **Agent Rules Status**: Partial — CLAUDE.md present with good repo overview but no `.claude/rules/` for test creation guidance

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | 271 test files, pytest + pytest-asyncio, 1:1 ratio, multi-Python matrix |
| Integration/E2E | 5.5/10 | 2 integration test files, QA smoke tests manual-only, Docker health checks |
| Build Integration | 7.0/10 | Konflux/Tekton multi-arch PR builds via label, no GitHub CI simulation |
| Image Testing | 7.5/10 | Docker build + startup + health check in CI, multi-stage UBI9, ppc64le |
| Coverage Tracking | 5.0/10 | Codecov integration but informational-only, no enforcement thresholds |
| CI/CD Automation | 8.5/10 | 17 workflows, multi-OS matrix, reusable patterns, Poetry caching, nightly |
| Agent Rules | 6.0/10 | CLAUDE.md present, no .claude/rules/ or test creation guidance |

## Critical Gaps

### 1. Coverage Enforcement is Informational-Only
- **Impact**: Coverage can silently regress without PR blocking
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: `.github/codecov.yml` sets both `project` and `patch` status to `informational: true`. This means Codecov reports coverage but never blocks a PR for regressions. No minimum coverage threshold is configured.
- **Fix**: Set `informational: false` and add `target: auto` with `threshold: 1%` to both project and patch sections.

### 2. No Automated E2E/Integration Testing
- **Impact**: QA scenarios validated manually; regressions in guardrail behavior not caught until manual testing
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Details**: The `qa/` directory contains 5 latency scenarios and test scripts (`test_execution_rails.py`, `test_grounding_rail.py`, `test_jailbreak_check.py`, `test_moderation_rail.py`, `test_topical_rail.py`) but these are not executed by any CI workflow. The `test-docker.yml` workflow does basic health checks (HTTP 200 on `/v1/rails/configs`) but doesn't test guardrail execution flows.
- **Fix**: Create a CI workflow that starts the Docker container with mock LLM, runs QA test suite against it, and reports results on PRs.

### 3. Security Scans Limited to `develop` Branch
- **Impact**: PRs targeting `main` or other branches skip Trivy and Bandit scanning
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: `security.yml` triggers only on `pull_request: branches: [develop]` and `push: branches: [develop]`. The downstream fork uses `main` as its default branch, meaning PRs to `main` are unscanned.
- **Fix**: Change trigger to `pull_request:` (all branches) or at minimum add `main` to the branch list.

### 4. No PR-Time Konflux Build Simulation
- **Impact**: Multi-arch build failures discovered post-merge
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Details**: Tekton pipelines (`.tekton/`) build `Dockerfile.konflux` with ppc64le support and cachi2 prefetch, but only trigger via `/build-konflux` comment or `kfbuild-*` label. The standard PR workflow doesn't validate the Konflux Dockerfile.

## Quick Wins

### 1. Enable Coverage Enforcement (1-2 hours)
Update `.github/codecov.yml`:
```yaml
coverage:
  status:
    project:
      default:
        target: auto
        threshold: 1%
        informational: false
    patch:
      default:
        target: 80%
        informational: false
```

### 2. Extend Security Scans to All Branches (30 minutes)
Update `security.yml` triggers:
```yaml
on:
  pull_request:
  push:
    branches:
      - main
      - develop
```

### 3. Add Test Markers for Categorization (2-4 hours)
Add markers to `pytest.ini` and tag tests:
```ini
[pytest]
markers =
    unit: Unit tests (no external dependencies)
    integration: Integration tests (requires services)
    slow: Tests that take >10 seconds
```

### 4. Create Agent Rules for Test Patterns (2-3 hours)
Generate `.claude/rules/unit-tests.md` and `.claude/rules/api-tests.md` to guide AI-assisted test creation with existing patterns.

## Detailed Findings

### CI/CD Pipeline

**Strengths:**
- **17 GitHub Actions workflows** covering tests, linting, security, Docker, release, and docs
- **Reusable workflow pattern** (`_test.yml`) eliminates duplication across PR tests, full tests, and latest-deps tests
- **Multi-Python matrix**: Python 3.10, 3.11, 3.12, 3.13 on every PR
- **Multi-OS testing**: Ubuntu (PRs), Windows + macOS (on review request / push to main)
- **Poetry dependency caching** with health checks (`timeout 10s poetry run pip --version`)
- **Poetry lock verification** (`poetry check --lock`) prevents lock drift
- **Daily nightly tests** with latest dependencies (`latest-deps-tests.yml`)
- **Smart test skipping**: `pr-tests-skip.yml` skips tests for markdown/GitHub-only changes
- **GitLab CI backup**: `.gitlab-ci.yml` provides dual-CI capability (Python 3.10-3.13)
- **CodeRabbit AI review** configured with custom pre-merge checks for test results on major changes
- **Tekton/Konflux**: Multi-arch container builds (x86_64, arm64, ppc64le) with 4-hour timeout

**Gaps:**
- No concurrency control on PR workflows (could waste CI minutes on rapid pushes)
- Security scans limited to `develop` branch
- No integration test job in CI
- Tekton PR builds require manual trigger (`/build-konflux` comment or label)

### Test Coverage

**Strengths:**
- **271 test files** across 12+ directories covering: core rails, Colang v1/v2, CLI, server, guardrails, tracing, eval, integrations, runnable rails, and v2.x features
- **Test-to-code ratio**: ~1:1 (271 test files / 270 source files) — excellent
- **Async test support**: 98 files use `@pytest.mark.asyncio` with `pytest-asyncio`
- **Mocking patterns**: 75 files use mocking (unittest.mock), including custom `FakeLLM` for LLM provider mocking
- **Benchmark tests**: 9 test files in `benchmark/tests/` for Locust load testing and mock server validation
- **QA smoke tests**: 5 scenario test files in `qa/` covering execution rails, grounding, jailbreak, moderation, and topical rails
- **Fork-specific tests**: `test_guardrail_checks_api.py` tests the custom `/v1/guardrail/checks` endpoint
- **Test configuration data**: Rich `tests/test_configs/` directory with Colang configuration scenarios
- **Profiling support**: `pytest-profiling` enabled for performance analysis (`make test_profile`)

**Gaps:**
- Coverage collected only on Python 3.11, not aggregated across versions
- No coverage threshold enforcement
- `qa/` tests not automated in CI
- Limited integration test coverage (only 2 files in `tests/integrations/`)
- Few test markers/categories — most tests run in a single undifferentiated suite
- No contract tests for API boundaries

### Code Quality

**Strengths:**
- **Ruff** (v0.14.6) for linting and formatting with extensive rule configuration
- **Pre-commit hooks**: 4 repos configured — pre-commit-hooks (YAML, trailing whitespace, EOF), ruff (lint + format), license header insertion, Pyright type checking
- **Pyright type checking** across 12 source directories (rails, actions, LLM, embeddings, CLI, KB, logging, tracing, server, benchmark, guardrails)
- **CodeRabbit AI review** for automated PR review with custom pre-merge checks
- **License compliance**: Automated license header insertion via pre-commit

**Gaps:**
- Ruff rule set is narrow (E4, E7, E9, F, W291-293, I001-002) — excludes many useful rules (UP, B, SIM, C4, etc.)
- F821 (undefined names) and F841 (unused variables) explicitly ignored
- No mypy configuration despite being a Python project
- No complexity checking (McCabe C901 disabled)

### Container Images

**Strengths:**
- **3 Dockerfiles**: `Dockerfile` (basic), `Dockerfile.server` (UBI9 multi-stage), `Dockerfile.konflux` (production 8-stage multi-arch)
- **Dockerfile.konflux**: Sophisticated multi-arch build with ppc64le support including custom OpenBLAS, PyTorch, tiktoken, onnxruntime, and hf-xet builds from source
- **UBI9 base images** (`registry.access.redhat.com/ubi9/python-312`) for Red Hat compliance
- **Multi-stage builds** in both server and Konflux Dockerfiles minimize final image size
- **Model pre-download**: `scripts/pre_download_required_models.py` bakes required models into the image
- **Guardrail profiles**: `scripts/filter_guardrails.py` supports open/closed source guardrail filtering
- **Security**: Non-root runtime (USER 1001), cache cleanup, compiler removal in final stage
- **CI validation**: `test-docker.yml` builds image, starts container, health checks, and API validation

**Gaps:**
- No vulnerability scanning of built images (Trivy scans filesystem, not container image)
- No SBOM generation
- No image signing or attestation
- `test-docker.yml` only validates basic `Dockerfile`, not `Dockerfile.server` or `Dockerfile.konflux`
- Runtime testing is minimal (HTTP 200 check only, no guardrail execution validation)

### Security

**Strengths:**
- **Trivy scanning**: Filesystem + dependency scanning with SARIF output uploaded to GitHub Security tab
- **Bandit SAST**: Python-specific security analysis with SARIF results
- **Severity gating**: Critical + High vulnerabilities fail the build (`exit-code: "1"`)
- **Pre-commit license enforcement**: Ensures all files have proper licensing
- **Protobuf pinning**: Explicit version pin for CVE-2024-7254 mitigation
- **GitLab SAST**: Additional SAST scanning via GitLab CI template
- **SECURITY.md**: Security policy documented

**Gaps:**
- Security scans only on `develop` branch (not `main` or feature branches)
- No dependency review action for PR dependency changes
- No secret detection tooling (Gitleaks, TruffleHog)
- No container image scanning (only filesystem scan)
- No SBOM generation or signing

### Agent Rules (Agentic Flow Quality)

**Strengths:**
- **CLAUDE.md present**: Contains repository layout, git remotes, build instructions, test commands, CI description, and key fork changes
- **Good fork documentation**: Clearly documents upstream vs. downstream differences
- **CodeRabbit configuration**: `.coderabbit.yaml` with custom pre-merge checks

**Gaps:**
- **No `.claude/rules/` directory**: No test creation guidelines for AI agents
- **No test pattern documentation**: No guidance on how to write tests matching existing patterns (FakeLLM usage, async test patterns, conftest fixtures)
- **No `.claude/skills/`**: No custom skills for automated test generation or quality checks
- **CLAUDE.md lacks test writing guidance**: Describes how to run tests but not how to write them
- **Missing test categories**: No documentation of what constitutes unit vs. integration vs. QA tests

## Recommendations

### Priority 0 (Critical)

1. **Enable coverage enforcement** — Change `informational: true` to `false` in `.github/codecov.yml`, set project threshold to auto (current baseline) and patch threshold to 80%
2. **Extend security scans to all branches** — Update `security.yml` triggers to run on all PRs, not just `develop`

### Priority 1 (High Value)

3. **Automate QA smoke tests in CI** — Create a workflow that builds the Docker image, starts it with mock LLM, and runs `qa/test_*.py` against the running server
4. **Validate Dockerfile.konflux in PR CI** — Add a build-only step that validates `Dockerfile.konflux` (at least for x86_64) to catch build issues before Tekton pipeline runs
5. **Create `.claude/rules/` directory** — Generate rules for unit tests (FakeLLM patterns, async test patterns), API tests (TestClient patterns), and integration tests
6. **Add concurrency control to PR workflows** — Add `concurrency: group: ${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress: true`

### Priority 2 (Nice-to-Have)

7. **Expand Ruff rule set** — Enable UP (pyupgrade), B (bugbear), SIM (simplify), C4 (comprehensions), and remove F821/F841 ignores
8. **Add performance regression CI** — Run benchmark suite with Locust in CI and track latency trends
9. **Implement contract tests** — Test the `/v1/guardrail/checks` endpoint contract to prevent breaking changes between fork and upstream
10. **Add secret detection** — Integrate Gitleaks or TruffleHog into the security workflow
11. **Add container image scanning** — Scan the built Docker image with Trivy (not just filesystem)
12. **Add SBOM generation** — Generate SBOM during Konflux builds with Syft or Trivy

## Comparison to Gold Standards

| Feature | NeMo-Guardrails | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|---------|----------------|---------------------|-------------------|---------------|
| Unit Tests | 271 files, 1:1 ratio | Extensive Jest + Cypress | Per-image tests | Go testing + envtest |
| Integration/E2E | Manual QA tests | Automated E2E with Cypress | Multi-layer validation | Multi-version E2E |
| Coverage Enforcement | Informational only | Enforced thresholds | N/A | codecov enforced |
| Multi-OS Testing | Ubuntu + Windows + macOS | Ubuntu only | Multi-arch images | Linux only |
| Security Scanning | Trivy + Bandit (develop only) | Multiple scanners | Image scanning | SAST + dependency |
| Container Testing | Health check only | Full deployment | 5-layer validation | Kind cluster |
| Agent Rules | CLAUDE.md only | Comprehensive rules | N/A | N/A |
| Pre-commit | Ruff + Pyright + license | ESLint + Prettier | N/A | golangci-lint |
| CI Sophistication | 17 workflows + GitLab + Tekton | ~10 workflows | Makefile-based | Prow + GitHub Actions |

## File Paths Reference

### CI/CD
- `.github/workflows/pr-tests.yml` — PR test matrix (Ubuntu, Python 3.10-3.13)
- `.github/workflows/full-tests.yml` — Full test matrix (Windows + macOS, on review)
- `.github/workflows/_test.yml` — Reusable test workflow
- `.github/workflows/lint.yml` — Pre-commit hooks (Ruff, Pyright, license)
- `.github/workflows/security.yml` — Trivy + Bandit scans
- `.github/workflows/test-docker.yml` — Docker build + health check
- `.github/workflows/latest-deps-tests.yml` — Nightly latest-deps tests
- `.gitlab-ci.yml` — GitLab CI backup pipeline
- `.tekton/` — Konflux/Tekton multi-arch build pipelines

### Testing
- `tests/` — 271 test files across 12+ subdirectories
- `tests/conftest.py` — Global fixtures (reasoning trace reset, prompt_toolkit mock)
- `tests/test_configs/` — Colang configuration test data
- `tests/integrations/langchain/` — LangChain middleware integration tests
- `tests/server/` — FastAPI server tests
- `qa/` — Manual QA smoke tests (execution, grounding, jailbreak, moderation, topical)
- `benchmark/tests/` — Benchmark infrastructure tests

### Code Quality
- `ruff.toml` — Ruff linter/formatter configuration
- `.pre-commit-config.yaml` — Pre-commit hooks (Ruff, Pyright, license)
- `pyproject.toml` — Poetry config, Pyright includes, pytest options
- `.coderabbit.yaml` — AI code review configuration

### Container Images
- `Dockerfile` — Basic development image
- `Dockerfile.server` — UBI9 multi-stage server image
- `Dockerfile.konflux` — Production 8-stage multi-arch image (x86_64, arm64, ppc64le)
- `.dockerignore` — Docker build exclusions

### Coverage & Security
- `.github/codecov.yml` — Codecov configuration (informational-only)
- `SECURITY.md` — Security policy

### Agent Rules
- `CLAUDE.md` — Repository overview, build/test instructions, fork documentation
- `.coderabbit.yaml` — AI review configuration with pre-merge checks
