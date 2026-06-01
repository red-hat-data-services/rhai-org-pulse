---
repository: "opendatahub-io/NeMo-Guardrails"
overall_score: 7.2
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Excellent test-to-source ratio (1.31:1) with 256 test files covering 195 source modules; pytest + pytest-asyncio framework"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "Integration tests exist for langchain, server, tracing, and content safety but no dedicated E2E test infrastructure or cluster-based testing"
  - dimension: "Build Integration"
    score: 6.0
    status: "Tekton/Konflux pipelines build multi-arch images on PR; Docker test workflow validates container startup; but no PR-time Konflux simulation in GitHub CI"
  - dimension: "Image Testing"
    score: 7.0
    status: "Docker test workflow builds image, starts container, and validates HTTP health; but only tests upstream Dockerfile, not Dockerfile.server (the production UBI9 image)"
  - dimension: "Coverage Tracking"
    score: 6.5
    status: "Codecov integration on Python 3.11 PR runs; but no coverage thresholds enforced, no .codecov.yml config, no minimum coverage gates"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "18 workflows covering PRs, full matrix (3 OS x 4 Python versions), scheduled latest-deps tests, Docker tests, security scans, release automation"
  - dimension: "Agent Rules"
    score: 5.0
    status: "CLAUDE.md exists with solid repo overview and fork-specific context but no .claude/ directory, no test creation rules, no agentic test patterns"
critical_gaps:
  - title: "No coverage enforcement or thresholds"
    impact: "Coverage can silently regress without anyone noticing; no minimum bar for new PRs"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Docker test workflow tests wrong Dockerfile"
    impact: "Production image (Dockerfile.server with UBI9 base) is never validated in GitHub CI; only the dev Dockerfile is tested"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Security scans only run on develop branch"
    impact: "PRs to non-develop branches (including main) skip Trivy and Bandit scans entirely"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No agent test rules for AI-assisted development"
    impact: "AI-generated tests lack consistency, miss patterns specific to NeMo Guardrails (Colang configs, mock LLM providers, async rails testing)"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add .codecov.yml with coverage thresholds"
    effort: "1-2 hours"
    impact: "Prevent coverage regression; enforce minimum coverage on new PRs"
  - title: "Extend security.yml to run on all PR branches"
    effort: "30 minutes"
    impact: "Catch vulnerabilities before merge regardless of target branch"
  - title: "Add Dockerfile.server to docker test workflow"
    effort: "2-3 hours"
    impact: "Validate the actual production image builds and starts correctly on every PR"
  - title: "Add gitleaks for secret detection"
    effort: "1 hour"
    impact: "Prevent accidental credential leaks in commits"
recommendations:
  priority_0:
    - "Add .codecov.yml with project and patch coverage thresholds (e.g., 70% project, 80% patch)"
    - "Extend Docker test workflow to also build and validate Dockerfile.server (UBI9 production image)"
    - "Widen security.yml triggers to cover all branches, not just develop"
  priority_1:
    - "Create .claude/rules/ with test automation patterns for unit tests, integration tests, and Colang-based tests"
    - "Add gitleaks secret scanning to PR workflow"
    - "Add integration test suite that tests the server API endpoints with real guardrail configs"
  priority_2:
    - "Add performance regression testing via the existing benchmark infrastructure"
    - "Add SBOM generation and image signing to Tekton pipelines"
    - "Add contract tests for the /v1/guardrail/checks fork-specific endpoint"
---

# Quality Analysis: NeMo-Guardrails (opendatahub-io fork)

## Executive Summary
- **Overall Score: 7.2/10**
- **Repository Type**: Python library/server — LLM guardrails toolkit (NVIDIA NeMo Guardrails fork for TrustyAI/ODH)
- **Primary Language**: Python (649 files, ~52K source LOC, ~78K test LOC)
- **Framework**: FastAPI server, LangChain integration, Colang DSL
- **Key Strengths**: Excellent test coverage ratio, comprehensive multi-platform CI matrix, strong security scanning (Trivy + Bandit), well-structured Tekton/Konflux integration for multi-arch builds
- **Critical Gaps**: No coverage enforcement, production Dockerfile not tested in CI, security scans limited to develop branch
- **Agent Rules Status**: Partial — CLAUDE.md exists with good repo context but no `.claude/` directory or test creation rules

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Excellent ratio (1.31:1), pytest + pytest-asyncio, 256 test files |
| Integration/E2E | 7.0/10 | Integration tests present but no dedicated E2E infra |
| Build Integration | 6.0/10 | Tekton multi-arch builds on PR; no GitHub CI Konflux simulation |
| Image Testing | 7.0/10 | Docker startup validation exists but tests wrong Dockerfile |
| Coverage Tracking | 6.5/10 | Codecov uploads on Py3.11 but no thresholds or gates |
| CI/CD Automation | 8.5/10 | 18 workflows, 3-OS x 4-Python matrix, scheduled tests |
| Agent Rules | 5.0/10 | CLAUDE.md present; no .claude/rules/ or test patterns |

**Weighted Overall: 7.2/10**

## Critical Gaps

### 1. No Coverage Enforcement or Thresholds
- **Impact**: Coverage can silently regress. New PRs could reduce coverage without any warning or failure.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Coverage is collected via `pytest-cov` on Python 3.11 and uploaded to Codecov, but there is no `.codecov.yml` configuration file. No minimum project or patch coverage thresholds are set. The Codecov check will never fail a PR.

### 2. Docker Test Workflow Tests Wrong Dockerfile
- **Impact**: The production image (`Dockerfile.server` using UBI9 base with multi-stage build, baked models, and guardrail filtering) is never validated in GitHub CI. Only the development `Dockerfile` (using `python:3.12-slim` with Poetry) is tested.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: `test-docker.yml` builds and smoke-tests only `Dockerfile` (the dev/upstream image). The actual image shipped via Konflux is built from `Dockerfile.server`. A breakage in `Dockerfile.server` would only be caught by Tekton builds, not in the GitHub CI pipeline.

### 3. Security Scans Limited to Develop Branch
- **Impact**: PRs targeting `main` or other branches skip all Trivy and Bandit scans. Vulnerabilities could be merged without detection.
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: `security.yml` triggers only on `pull_request` to `develop` and `push` to `develop`. PRs to `main` (the default release branch) are not covered.

### 4. No Agent Test Creation Rules
- **Impact**: AI-assisted development (Claude Code, Copilot) produces inconsistent tests that may miss NeMo Guardrails-specific patterns like Colang config setup, mock LLM providers, async rail chain testing, and event-based API testing.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: `CLAUDE.md` provides good repository context but no `.claude/` directory exists. No rules for test creation patterns, no examples of good test structure, no guidance on mock strategies for LLM providers.

## Quick Wins

### 1. Add `.codecov.yml` with Coverage Thresholds
- **Effort**: 1-2 hours
- **Impact**: Prevent coverage regression on every PR
- **Implementation**:
```yaml
coverage:
  status:
    project:
      default:
        target: 70%
        threshold: 2%
    patch:
      default:
        target: 80%
  comment:
    layout: "reach,diff,flags"
```

### 2. Extend Security Workflow to All Branches
- **Effort**: 30 minutes
- **Impact**: Catch vulnerabilities on PRs to any branch
- **Implementation**: Change `security.yml` triggers:
```yaml
on:
  pull_request:  # Remove branch filter
  push:
    branches:
      - develop
      - main
```

### 3. Add Dockerfile.server to Docker Test Workflow
- **Effort**: 2-3 hours
- **Impact**: Validate the production image on every relevant PR
- **Implementation**: Add a second job to `test-docker.yml` that builds `Dockerfile.server` and validates startup.

### 4. Add Gitleaks Secret Scanning
- **Effort**: 1 hour
- **Impact**: Prevent accidental credential leaks
- **Implementation**:
```yaml
- name: Run Gitleaks
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Detailed Findings

### CI/CD Pipeline

**Strengths:**
- **18 well-organized workflows** covering the full development lifecycle
- **Reusable test workflow** (`_test.yml`) called by multiple consumer workflows — excellent DRY pattern
- **Multi-platform matrix**: Ubuntu (PR), Windows + macOS (on review request), across Python 3.10-3.13
- **Scheduled nightly tests** with latest dependencies (`latest-deps-tests.yml`) — catches upstream breakage early
- **Docker image testing** with startup validation and health checks
- **Release automation** with tag creation, changelog generation, and PyPI publishing
- **Poetry lock validation** (`poetry check --lock`) on every test run
- **Dependency caching** via `actions/cache@v4` with architecture-aware cache keys
- **Concurrency control** on docs workflows

**Weaknesses:**
- No concurrency control on PR test workflows (can waste runners on force-pushes)
- `pr-tests-skip.yml` uses path filtering that could conflict with `pr-tests.yml` (both trigger on PRs)
- No workflow timeout limits set

**Workflow Inventory:**
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pr-tests.yml` | PR (code changes) | Ubuntu matrix, 4 Python versions, coverage on 3.11 |
| `full-tests.yml` | PR review request, push to main/develop, tags | Windows + macOS matrix |
| `latest-deps-tests.yml` | Nightly schedule | All OS x all Python with `poetry update` |
| `lint.yml` | PR, push to main/develop | Ruff + Pyright via Poetry |
| `security.yml` | PR/push to develop only | Trivy + Bandit scans |
| `test-docker.yml` | PR (Dockerfile changes), weekly, tags | Docker build + health check |
| `test-and-build-wheel.yml` | Push to main/develop, tags, nightly | Build + test wheel distribution |
| `test-published-dist.yml` | Nightly | Install from PyPI and validate server startup |
| `docs-build.yaml` | PR/push on docs changes | Sphinx documentation build |
| `release.yml` | Manual dispatch | Version bump + release PR |
| `create-tag.yml` | PR merged to develop | Auto-create version tag |
| `publish-pypi-approval.yml` | After build workflow | Publish to PyPI with approval |

### Test Coverage

**Strengths:**
- **Excellent test-to-source ratio**: 256 test files / 195 source modules = 1.31:1
- **Test LOC exceeds source LOC**: ~78K test LOC vs ~52K source LOC (1.5:1 ratio)
- **Well-organized test structure**: Tests organized by module (cli, colang, guardrails, server, tracing, v2_x, etc.)
- **271 test files** covering diverse areas: actions, guardrails, streaming, tool calling, jailbreak detection, content safety
- **Async test support**: `pytest-asyncio` configured with function-scoped event loops
- **Profiling support**: `pytest-profiling` available for performance analysis
- **Benchmark tests**: Separate benchmark test suite for performance validation

**Weaknesses:**
- No explicit integration/E2E test directory — tests are mixed with unit tests
- No test markers for categorization (unit vs integration vs e2e vs slow)
- `testpaths` includes `docs/colang-2/examples` but this directory doesn't exist
- Some test files have typos in names (`teset_with_custome_embedding_search_provider.py`)
- No test data management strategy visible (fixtures vs inline data)

**Test Categories Found:**
- Unit tests: Actions, guardrails, config, parser, CLI, embeddings, caching
- Integration tests: LangChain middleware, server API, tracing/OpenTelemetry, content safety
- E2E-like tests: Guardrails AI e2e, LLM params e2e, tool calling passthrough
- Benchmark tests: Server perf, Locust load testing, AI perf metrics

### Code Quality

**Strengths:**
- **Ruff** configured as linter AND formatter (replacing Black + isort + Flake8)
- **Pyright** type checking on core modules (rails, actions, llm, embeddings, etc.)
- **Pre-commit hooks** with: YAML check, EOF fixer, trailing whitespace, Ruff lint+format, license headers, Pyright
- **Line length**: 120 chars (reasonable for modern displays)
- **License enforcement**: Automated SPDX license header insertion via pre-commit
- **CodeRabbit** AI code review configured with custom pre-merge checks
- **Greptile** AI review also configured

**Weaknesses:**
- Ruff `ignore = ["F821", "F841"]` suppresses undefined-name and unused-variable errors — these should ideally be fixed
- No McCabe complexity checks enabled
- Pyright excludes `trtllm` provider — partial type coverage
- No pylint or additional static analysis beyond Ruff

### Container Images

**Strengths:**
- **Multiple Dockerfiles** for different use cases (dev, server, QA, jailbreak detection, fact-checking)
- **Dockerfile.server** uses UBI9 multi-stage build — production-grade:
  - Multi-stage (build → runtime) reduces image size
  - Non-root user (1001) for security
  - Pre-downloaded models for faster startup
  - Guardrail profile filtering (`filter_guardrails.py`)
  - Architecture-aware compilation flags
- **Multi-arch support**: x86_64 + arm64 via Tekton/Konflux
- **Docker test workflow** validates image startup and HTTP health
- **.dockerignore** configured to exclude unnecessary files

**Weaknesses:**
- `Dockerfile` (dev) uses `python:3.12-slim` without pinned digest — non-reproducible
- `Dockerfile.server` has hardcoded `PYYAML_VERSION=6.0.3` — needs manual updates
- No Trivy/Snyk scanning of built images (filesystem scan only)
- No SBOM generation
- No image signing/attestation
- Dev Dockerfile runs as root

### Security

**Strengths:**
- **Trivy** filesystem + dependency scanning with SARIF upload to GitHub Security tab
- **Bandit** SAST scanning for Python security issues
- **GitLab SAST** template included in `.gitlab-ci.yml`
- **SECURITY.md** with responsible disclosure policy
- Critical/High severity thresholds on Trivy (exit-code: 1)
- SARIF results archived as artifacts for 30 days

**Weaknesses:**
- Security scans only trigger on `develop` branch — PRs to `main` are uncovered
- No secret detection (no gitleaks, TruffleHog, or similar)
- No container image scanning (only filesystem/dependency scanning)
- No CodeQL/Semgrep configured
- No dependency review action for PR dependency changes
- Bandit excludes `tests/` directory entirely

### Agent Rules (Agentic Flow Quality)

**Status**: Partial

**What Exists:**
- `CLAUDE.md` in repository root with:
  - Clear repository layout and directory structure
  - Git remotes documentation (upstream, trustyai-fork, midstream, downstream)
  - Build and install instructions
  - Test running commands
  - CI workflow documentation
  - Key fork changes enumerated

**What's Missing:**
- No `.claude/` directory
- No `.claude/rules/` with test creation patterns
- No test automation guidance for AI agents
- No Colang test pattern documentation
- No mock LLM provider setup instructions for tests
- No AGENTS.md
- No guidance on async test patterns (`pytest-asyncio` specifics)
- No event-based API test patterns

**Recommendation**: Generate comprehensive agent rules using `/test-rules-generator` covering:
1. Unit test patterns with mock LLM providers
2. Integration test patterns for server API endpoints
3. Colang-specific test patterns (v1 and v2_x)
4. Async action test patterns
5. Guardrail config test fixtures

### Tekton/Konflux Integration

**Strengths:**
- **3 Tekton PipelineRuns** configured:
  - PR validation (builds on PRs to `develop`)
  - Push builds (on push to `develop` — CI tag)
  - Release builds (on push to `develop` — release tag)
- **Multi-arch builds**: x86_64 + arm64 (linux-m2xlarge for ARM)
- Uses centralized pipeline from `odh-konflux-central` repository
- Separate service accounts for CI vs release builds
- `Dockerfile.server` used as the build target (correct production image)

**Weaknesses:**
- No Tekton-based test tasks (build only, no test execution)
- No integration test tasks in the pipeline
- PR builds don't run test suite inside the container
- No SBOM or vulnerability scan tasks in Tekton pipeline

## Recommendations

### Priority 0 (Critical)

1. **Add `.codecov.yml` with coverage thresholds** — Prevent silent coverage regression. Set project target (70%) and patch target (80%) with fail-on-regression.

2. **Test `Dockerfile.server` in GitHub CI** — The production image (UBI9 multi-stage) must be validated on PRs that touch `Dockerfile.server`, `pyproject.toml`, `requirements.txt`, or `scripts/`.

3. **Extend security scans to all branches** — Remove the `develop`-only branch filter from `security.yml` to catch vulnerabilities on all PRs.

### Priority 1 (High Value)

4. **Create `.claude/rules/` for test automation** — Document test patterns specific to NeMo Guardrails: mock LLM providers, Colang config fixtures, async action testing, event-based API patterns.

5. **Add gitleaks secret detection** — Prevent credential leaks. Low effort, high value.

6. **Add test markers** — Use `@pytest.mark.integration`, `@pytest.mark.e2e`, `@pytest.mark.slow` to categorize tests. Enable selective test runs in CI.

7. **Add concurrency control to PR workflows** — Cancel in-progress runs on force-push to save CI resources.

### Priority 2 (Nice-to-Have)

8. **Add Tekton test tasks** — Run a subset of tests inside the built container image as part of the Konflux pipeline.

9. **Add container image scanning** — Scan the built Docker image (not just filesystem) with Trivy or Grype.

10. **Add SBOM generation** — Generate SBOM during image builds for supply chain transparency.

11. **Add dependency review action** — Use `actions/dependency-review-action` to flag vulnerable dependencies in PR diff.

12. **Fix test directory inconsistencies** — Remove non-existent `docs/colang-2/examples` from `testpaths`, fix typo in `teset_with_custome_embedding_search_provider.py`.

## Comparison to Gold Standards

| Dimension | NeMo-Guardrails | odh-dashboard | notebooks | kserve |
|-----------|----------------|---------------|-----------|--------|
| Unit Test Coverage | 8.5 - Excellent ratio | 9.0 - Multi-layer | 7.0 - Image-focused | 8.5 - Strong |
| Integration/E2E | 7.0 - Present but unstructured | 9.0 - Contract + E2E | 6.0 - Notebook validation | 9.0 - Multi-version |
| Build Integration | 6.0 - Tekton builds only | 8.0 - Konflux simulation | 7.0 - Image pipeline | 7.0 - Operator testing |
| Image Testing | 7.0 - Health check only | 8.0 - Full validation | 9.0 - 5-layer validation | 7.0 - Deployment tests |
| Coverage Tracking | 6.5 - No enforcement | 9.0 - Thresholds + gates | 5.0 - Manual | 8.0 - Enforced |
| CI/CD | 8.5 - Comprehensive matrix | 9.0 - Full pipeline | 8.0 - Image pipeline | 8.5 - Multi-version |
| Agent Rules | 5.0 - CLAUDE.md only | 8.0 - Full rules | 3.0 - None | 4.0 - Minimal |
| Security | 7.0 - Trivy + Bandit | 7.0 - Snyk | 6.0 - Basic | 7.5 - CodeQL |

## File Paths Reference

### CI/CD
- `.github/workflows/pr-tests.yml` — PR test workflow
- `.github/workflows/_test.yml` — Reusable test workflow
- `.github/workflows/full-tests.yml` — Full matrix tests (Windows/macOS)
- `.github/workflows/lint.yml` — Linting workflow
- `.github/workflows/security.yml` — Trivy + Bandit scans
- `.github/workflows/test-docker.yml` — Docker image testing
- `.github/workflows/test-and-build-wheel.yml` — Wheel build + test
- `.github/workflows/test-published-dist.yml` — PyPI install validation
- `.github/workflows/latest-deps-tests.yml` — Nightly latest-deps test
- `.gitlab-ci.yml` — GitLab CI (NVIDIA internal)

### Tekton/Konflux
- `.tekton/odh-trustyai-nemo-guardrails-server-pull-request.yaml` — PR build
- `.tekton/odh-trustyai-nemo-guardrails-server-push.yaml` — Push build (CI)
- `.tekton/odh-trustyai-nemo-guardrails-server-release-push.yaml` — Release build

### Testing
- `tests/` — Main test directory (256 test files)
- `tests/conftest.py` — Global test fixtures
- `benchmark/tests/` — Performance benchmark tests
- `pytest.ini` — Pytest configuration
- `tox.ini` — Multi-Python version testing

### Code Quality
- `ruff.toml` — Ruff linter + formatter config
- `.pre-commit-config.yaml` — Pre-commit hooks (Ruff, Pyright, license)
- `.coderabbit.yaml` — CodeRabbit AI review config
- `greptile.json` — Greptile AI review config

### Container Images
- `Dockerfile` — Development image (python:3.12-slim)
- `Dockerfile.server` — Production image (UBI9 multi-stage)
- `qa/Dockerfile.qa` — QA/testing image
- `.dockerignore` — Docker build exclusions

### Agent Rules
- `CLAUDE.md` — Repository context for Claude Code
- `CONTRIBUTING.md` — Contributor guidelines

### Security
- `SECURITY.md` — Security disclosure policy
