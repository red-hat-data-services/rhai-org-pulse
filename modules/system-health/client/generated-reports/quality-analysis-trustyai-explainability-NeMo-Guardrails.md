---
repository: "trustyai-explainability/NeMo-Guardrails"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "285 test files (~78K lines) with pytest+pytest-asyncio; 1.5:1 test-to-code ratio"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "QA integration suite and Docker runtime tests; no Kind/Minikube cluster testing"
  - dimension: "Build Integration"
    score: 6.5
    status: "Docker build+runtime test on PRs; wheel build+server smoke across 4 Python versions"
  - dimension: "Image Testing"
    score: 7.0
    status: "Two Dockerfiles tested; runtime health check; no multi-arch or SBOM generation"
  - dimension: "Coverage Tracking"
    score: 7.5
    status: "Codecov integration on Python 3.11; no enforcement thresholds or PR coverage gates"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "17 workflows covering PR tests, full matrix (3 OS x 4 Python), nightly latest-deps, release automation"
  - dimension: "Agent Rules"
    score: 7.0
    status: "CLAUDE.md present with build/test/architecture guidance; no .claude/rules/ for test patterns"
critical_gaps:
  - title: "No coverage enforcement thresholds"
    impact: "Coverage can silently regress without any CI gate; no minimum coverage requirement"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No multi-architecture image builds"
    impact: "Only amd64 images tested; arm64 (Apple Silicon, Graviton) not validated"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "Dockerfile.server not tested in CI"
    impact: "Production UBI9 image (used in RHOAI) not validated on PRs; build issues discovered post-merge"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No SBOM generation or image signing"
    impact: "Supply chain security gaps; no software bill of materials for compliance"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No secret detection in CI"
    impact: "Leaked credentials or API keys may go undetected in commits"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add coverage enforcement threshold to Codecov"
    effort: "1-2 hours"
    impact: "Prevent silent coverage regression with a minimum gate (e.g., 70%)"
  - title: "Add Gitleaks secret detection to PR workflow"
    effort: "1-2 hours"
    impact: "Catch leaked credentials before they reach the repository"
  - title: "Add Dockerfile.server build test to PR workflow"
    effort: "2-3 hours"
    impact: "Validate the production UBI9 image builds correctly on every PR"
  - title: "Create .claude/rules/ test pattern guides"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality and consistency for contributors"
recommendations:
  priority_0:
    - "Add coverage enforcement threshold (e.g., 70% minimum) via .codecov.yml"
    - "Add Dockerfile.server CI build validation on PRs touching server code or dependencies"
  priority_1:
    - "Add Gitleaks or TruffleHog secret detection to PR workflow"
    - "Add multi-architecture (arm64) image build testing"
    - "Generate SBOM with Syft and sign images with cosign"
    - "Create .claude/rules/ for unit test and integration test patterns"
  priority_2:
    - "Add Dockerfile.server runtime smoke test (health check, guardrail endpoint)"
    - "Add contract tests for the /v1/guardrail/checks fork-specific API"
    - "Add performance regression testing for guardrail evaluation latency"
    - "Consider adding concurrency control to PR test workflows"
---

# Quality Analysis: NeMo-Guardrails (TrustyAI Fork)

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Python library + FastAPI server for LLM guardrails
- **Primary Language**: Python (3.10-3.13)
- **Framework**: FastAPI, LangChain, Colang DSL
- **Fork Context**: TrustyAI fork of NVIDIA/NeMo-Guardrails with Red Hat customizations

**Key Strengths**: Exceptional test suite (285 test files, 78K lines), mature CI/CD with 17 workflows spanning 3 OS x 4 Python versions, strong security scanning (Trivy + Bandit), well-documented CLAUDE.md, and automated release pipeline with changelog generation.

**Critical Gaps**: No coverage enforcement thresholds, production Dockerfile.server not tested in CI, no multi-arch builds, no secret detection, no SBOM generation.

**Agent Rules Status**: CLAUDE.md present with good build/test/architecture documentation; no `.claude/rules/` directory for structured test automation patterns.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | 285 test files (~78K lines) with pytest+pytest-asyncio; 1.5:1 test-to-code ratio |
| Integration/E2E | 7.0/10 | QA integration suite and Docker runtime tests; no K8s cluster testing |
| **Build Integration** | **6.5/10** | **Docker build+runtime on PRs; Dockerfile.server NOT tested in CI** |
| Image Testing | 7.0/10 | Two Dockerfiles tested; runtime health check; no multi-arch/SBOM |
| Coverage Tracking | 7.5/10 | Codecov integration on Python 3.11; no enforcement thresholds |
| CI/CD Automation | 9.0/10 | 17 workflows, full matrix testing, nightly deps, release automation |
| Agent Rules | 7.0/10 | CLAUDE.md present with guidance; no .claude/rules/ for test patterns |

## Critical Gaps

### 1. No Coverage Enforcement Thresholds
- **Impact**: Coverage can silently regress; contributors can merge code that reduces overall coverage without any CI gate
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Evidence**: Codecov uploads coverage XML but no `.codecov.yml` exists to enforce minimum thresholds
- **Fix**: Create `.codecov.yml` with `target: 70%` and `threshold: 2%` for patch coverage

### 2. Dockerfile.server Not Tested in CI
- **Impact**: The production UBI9 multi-stage image used in RHOAI deployments is never validated on PRs; build failures are only discovered post-merge or in downstream (Konflux)
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Evidence**: `test-docker.yml` only tests `Dockerfile` (upstream NVIDIA image); `Dockerfile.server` (the fork-specific UBI9 production image) has no CI testing
- **Fix**: Add a workflow job to build Dockerfile.server on PRs touching `Dockerfile.server`, `requirements.txt`, `pyproject.toml`, or `scripts/`

### 3. No Multi-Architecture Image Builds
- **Impact**: Only amd64 images tested; arm64 (Apple Silicon, AWS Graviton) not validated despite growing usage
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Evidence**: `Makefile` supports `PLATFORMS` variable but CI only runs on `ubuntu-latest` (amd64)

### 4. No SBOM Generation or Image Signing
- **Impact**: Supply chain security gaps; no software bill of materials for compliance and vulnerability tracking
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Evidence**: Neither Syft/SBOM generation nor cosign image signing is configured

### 5. No Secret Detection in CI
- **Impact**: Leaked credentials, API keys, or tokens may go undetected in commits
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Evidence**: No Gitleaks, TruffleHog, or similar secret scanning configured

## Quick Wins

### 1. Add Coverage Enforcement (1-2 hours)
Create `.codecov.yml`:
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
```

### 2. Add Gitleaks Secret Detection (1-2 hours)
Add to PR workflow:
```yaml
- name: Run Gitleaks
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 3. Add Dockerfile.server Build Test (2-3 hours)
Add a job to `test-docker.yml` or create a new workflow:
```yaml
test-server-image:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v6
    - name: Build Dockerfile.server
      run: docker build -f Dockerfile.server -t nemo-server-test .
    - name: Start and health check
      run: |
        docker run -d --name test -p 8000:8000 nemo-server-test
        sleep 10
        curl -f http://localhost:8000/v1/rails/configs
```

### 4. Create `.claude/rules/` Test Patterns (2-3 hours)
Add structured test automation rules for AI-assisted development — unit test patterns, mock strategies, async test patterns, and fixture conventions.

## Detailed Findings

### CI/CD Pipeline

**Strengths (Score: 9.0/10)**:

The CI/CD pipeline is exceptionally well-organized with 17 workflows covering the full development lifecycle:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pr-tests.yml` | PR (code changes) | Matrix: Ubuntu x Python 3.10-3.13, coverage on 3.11 |
| `pr-tests-skip.yml` | PR (docs/CI only) | Fast skip for non-code changes |
| `full-tests.yml` | Push to main/develop, review requested | Matrix: Windows + macOS x Python 3.10-3.13 |
| `latest-deps-tests.yml` | Nightly (10 PM UTC) | All 3 OS x 4 Python with `poetry update` |
| `lint.yml` | PR, push | Pre-commit hooks (ruff, pyright, license headers) |
| `security.yml` | PR to develop, push | Trivy (filesystem + deps) + Bandit SAST |
| `test-docker.yml` | PR (Dockerfile changes), weekly, tags | Docker build + runtime health check |
| `test-and-build-wheel.yml` | Push, nightly | Build wheel + install + server smoke (4 Python) |
| `docs-build.yaml` | PR (docs changes), push | Sphinx docs with redirect validation |
| `release.yml` | Manual dispatch | Automated release PR with changelog (git-cliff) |
| `create-tag.yml` | Release PR merge | Auto-tag creation |
| `publish-pypi-approval.yml` | After build+test | PyPI publish with environment approval |

**Key features**:
- Reusable workflow (`_test.yml`) for DRY test matrix
- Poetry virtualenv caching with health checks
- `poetry check --lock` ensures lock file integrity
- Multi-OS testing (Ubuntu, macOS, Windows)
- Nightly latest-deps testing catches upstream breakage
- Automated release pipeline (git-cliff changelog, auto-tag, PyPI publish)
- Concurrency control on docs builds (`cancel-in-progress: true`)

**Gaps**:
- No concurrency control on PR test workflows (parallel runs on rapid pushes)
- `test-docker.yml` only tests upstream `Dockerfile`, not fork-specific `Dockerfile.server`
- Wheel smoke test does basic health check but no guardrail endpoint validation

### Test Coverage

**Strengths (Score: 8.5/10 Unit, 7.0/10 Integration)**:

| Metric | Value |
|--------|-------|
| Test files | 285 Python test files |
| Test lines | ~78,226 lines |
| Source files | 270 Python source files |
| Source lines | ~51,938 lines |
| Test-to-code ratio | **1.5:1** (excellent) |
| Test framework | pytest + pytest-asyncio |
| Coverage tool | pytest-cov → Codecov |

**Test organization**:
- `tests/` (root): 157 test files covering core guardrail functionality
- `tests/v2_x/`: 32 test files for Colang v2.x language features
- `tests/tracing/`: 11 test files for OpenTelemetry span formatting and tracing
- `tests/test_configs/`: 63 config directories for integration-style tests
- `qa/`: 5 integration test files for specific guardrail types (jailbreak, moderation, topical, grounding, execution)
- `benchmark/tests/`: 9 test files for load testing infrastructure (Locust, aiperf)
- `docs/colang-2/examples/`: Documentation examples also run as tests

**Testing patterns**:
- Async testing with `pytest-asyncio` (core engine is async)
- Extensive configuration-driven tests via `test_configs/` directories
- Mock LLM responses for deterministic testing
- Profile-based test debugging (`pytest-profiling`)
- Cross-Python-version validation (3.10-3.13)

**Gaps**:
- No coverage thresholds enforced
- No separate integration test marker/category
- QA tests (`qa/`) require external LLM access, not run in standard CI
- No contract tests for fork-specific `/v1/guardrail/checks` API

### Code Quality

**Strengths (Score: 8.5/10)**:

| Tool | Configuration | Status |
|------|--------------|--------|
| Ruff (linter) | `ruff.toml` — E4, E7, E9, F, W291-293, I001-002; line-length 120 | Active |
| Ruff (formatter) | Double quotes, spaces, auto line endings | Active |
| Pyright | Type checking on core modules (rails, actions, llm, embeddings, etc.) | Active |
| Pre-commit | 4 repos: pre-commit-hooks, ruff, license-header, pyright | Active |
| License headers | Auto-inserted on `.py` files via pre-commit | Active |

**Pre-commit hooks**:
1. `check-yaml` — YAML syntax validation
2. `end-of-file-fixer` — consistent EOF
3. `trailing-whitespace` — clean whitespace
4. `ruff --fix` — auto-fix lint issues
5. `ruff-format` — code formatting
6. `insert-license` — Apache 2.0 header on Python files
7. `pyright` — static type checking

**Quality tools enforced in CI** (via `lint.yml`):
- All pre-commit hooks run on every PR and push to main/develop
- Poetry lock file validation (`poetry check --lock`)

**Gaps**:
- Ruff ignores `F821` (undefined names) and `F841` (unused variables) — these could catch real bugs
- No McCabe complexity checks (`C901`)
- Pyright only covers select directories, not the full codebase

### Container Images

**Strengths (Score: 7.0/10)**:

**Two Dockerfiles**:

1. **`Dockerfile`** (upstream NVIDIA) — `python:3.12-slim` based
   - Single-stage build with Poetry
   - Installs all extras including dev dependencies
   - Pre-downloads embedding model (`all-MiniLM-L6-v2`)
   - Validates with `nemoguardrails --help`
   - **CI tested**: Build + runtime health check in `test-docker.yml`

2. **`Dockerfile.server`** (fork-specific) — `registry.access.redhat.com/ubi9/python-312` based
   - Multi-stage build (build → runtime)
   - UBI9 base for RHOAI compliance
   - Pre-downloads models based on guardrails profile
   - Includes guardrail filtering (`filter_guardrails.py`)
   - Non-root user (1001)
   - Cache cleanup for smaller image size
   - **NOT CI tested** — major gap

**CI Docker testing** (`test-docker.yml`):
- Builds upstream `Dockerfile`
- Starts container and waits for readiness
- Health check: `GET /v1/rails/configs` → 200
- Triggers on: PR changes to Dockerfile/deps, weekly schedule, tags

**Gaps**:
- `Dockerfile.server` (production image) not tested in CI
- No multi-architecture builds in CI (only amd64)
- No image vulnerability scanning of built images (Trivy scans source, not built images)
- No SBOM generation (Syft)
- No image signing (cosign)
- No `.trivyignore` for managing known acceptable vulnerabilities

### Security

**Strengths (Score: 8.0/10)**:

| Tool | Scope | CI Integration | Exit Code |
|------|-------|---------------|-----------|
| Trivy (filesystem) | Source code scanning | `security.yml` on PR/push to develop | Non-blocking (exit 0) |
| Trivy (dependencies) | Vulnerability scanning | `security.yml` on PR/push to develop | Non-blocking (exit 0) |
| Trivy (critical check) | CRITICAL+HIGH severity | `security.yml` on PR/push to develop | **Blocking (exit 1)** |
| Bandit | Python SAST | `security.yml` on PR/push to develop | Blocking |
| SARIF upload | GitHub Security tab | On PRs to develop | Yes |
| Greptile | AI code review | `greptile.json` configured | On PR updates |

**Security features**:
- Trivy blocks PRs with CRITICAL/HIGH vulnerabilities
- Bandit catches common Python security issues
- SARIF results uploaded to GitHub Security tab for tracking
- Pinned protobuf version for CVE-2024-7254 mitigation
- `.dockerignore` prevents sensitive file leakage into images
- Non-root container user in `Dockerfile.server`

**Gaps**:
- No secret detection (Gitleaks/TruffleHog)
- No CodeQL/Semgrep for deeper SAST analysis
- No dependency review action on PRs (GitHub dependency review)
- Trivy filesystem and dependency scans are non-blocking (only the critical check blocks)
- No image scanning of built Docker images

### Agent Rules (Agentic Flow Quality)

**Status**: Partially present (Score: 7.0/10)

**CLAUDE.md** (present, well-structured):
- Overview of repository layout and architecture
- Git remotes documentation (upstream, midstream, downstream)
- Build and install instructions (`poetry install --all-extras`)
- Server startup commands
- Test running commands (`pytest tests/`)
- CI workflow description
- Key fork changes documented

**What's missing**:
- No `.claude/rules/` directory for structured test patterns
- No unit test creation rules (pytest patterns, async test conventions)
- No integration test guidelines
- No mock strategy documentation for AI agents
- No fixture conventions guide
- No test naming conventions
- No coverage requirements for new code

**Recommendation**: Generate structured rules with `/test-rules-generator` covering:
- Unit test patterns with pytest-asyncio
- Mock LLM response patterns
- Configuration-driven test setup
- Coverage expectations for new code
- Test file naming and organization conventions

## Recommendations

### Priority 0 (Critical)

1. **Add coverage enforcement thresholds** — Create `.codecov.yml` with project target (70%) and patch target (80%) to prevent silent coverage regression. The infrastructure is already in place (pytest-cov + Codecov upload); only the enforcement gate is missing.

2. **Add Dockerfile.server build validation to CI** — The production UBI9 image used in RHOAI deployments is never tested in CI. Add a build + health check job triggered on PRs touching `Dockerfile.server`, `requirements.txt`, `pyproject.toml`, or `scripts/`.

### Priority 1 (High Value)

3. **Add secret detection** — Integrate Gitleaks or TruffleHog into the PR workflow to catch leaked credentials before they reach the repository. This is a 1-2 hour effort with high security ROI.

4. **Add multi-architecture image builds** — The Makefile already supports `PLATFORMS` but CI only runs on amd64. Add arm64 build+test to support Apple Silicon and AWS Graviton deployments.

5. **Generate SBOM and sign images** — Add Syft for SBOM generation and cosign for image signing to meet supply chain security requirements.

6. **Create `.claude/rules/` for test patterns** — Add structured rules for unit test creation, async test patterns, mock strategies, and fixture conventions to improve AI-assisted development quality.

### Priority 2 (Nice-to-Have)

7. **Add Dockerfile.server runtime smoke test** — Beyond just building, validate the production image starts and responds to guardrail check endpoints.

8. **Add contract tests for fork-specific API** — The `/v1/guardrail/checks` endpoint is a fork-specific addition that should have contract tests to prevent regressions when rebasing from upstream.

9. **Add performance regression testing** — The `benchmark/` directory has Locust and aiperf infrastructure; integrate it into CI to catch latency regressions.

10. **Add concurrency control to PR workflows** — Add `concurrency` group with `cancel-in-progress: true` to PR test workflows to avoid wasted CI resources on rapid pushes.

11. **Enable Ruff F821/F841 checks** — Currently ignored, but `F821` (undefined names) and `F841` (unused variables) can catch real bugs.

## Comparison to Gold Standards

| Dimension | NeMo-Guardrails | odh-dashboard | notebooks | kserve |
|-----------|-----------------|---------------|-----------|--------|
| Unit Tests | 8.5 (285 files, 1.5:1 ratio) | 9.0 (Jest + React Testing Library) | 7.0 (notebook validation) | 9.0 (envtest + Go testing) |
| Integration/E2E | 7.0 (QA suite, Docker tests) | 9.5 (Cypress + contract tests) | 8.5 (5-layer image validation) | 9.0 (multi-version KServe tests) |
| Build Integration | 6.5 (Docker build in CI) | 8.0 (Module Federation) | 7.0 (Multi-arch builds) | 8.5 (Operator integration) |
| Image Testing | 7.0 (Build + health check) | 7.0 (Dev container) | 9.5 (5-layer validation) | 7.5 (Image + deployment) |
| Coverage Tracking | 7.5 (Codecov, no threshold) | 9.0 (Codecov + enforcement) | 6.0 (Limited tracking) | 9.0 (Codecov + 80% threshold) |
| CI/CD Automation | 9.0 (17 workflows, 3 OS) | 9.0 (Well-organized) | 8.0 (Matrix builds) | 9.5 (Comprehensive) |
| Security | 8.0 (Trivy + Bandit) | 7.5 (Snyk) | 7.0 (Image scanning) | 8.0 (CodeQL + Trivy) |
| Agent Rules | 7.0 (CLAUDE.md present) | 9.0 (Comprehensive rules) | 5.0 (Basic) | 4.0 (Minimal) |
| **Overall** | **7.6** | **8.5** | **7.5** | **8.0** |

## File Paths Reference

### CI/CD
- `.github/workflows/pr-tests.yml` — PR test matrix (Ubuntu x 4 Python)
- `.github/workflows/_test.yml` — Reusable test workflow
- `.github/workflows/full-tests.yml` — Full matrix (Windows + macOS)
- `.github/workflows/latest-deps-tests.yml` — Nightly latest deps
- `.github/workflows/lint.yml` — Pre-commit hooks
- `.github/workflows/security.yml` — Trivy + Bandit
- `.github/workflows/test-docker.yml` — Docker build + smoke
- `.github/workflows/test-and-build-wheel.yml` — Wheel build + install test
- `.github/workflows/release.yml` — Automated release PR
- `.github/workflows/create-tag.yml` — Auto-tag on release merge
- `.github/workflows/publish-pypi-approval.yml` — PyPI publish

### Testing
- `tests/` — 285 test files (157 root, 32 v2_x, 11 tracing)
- `tests/test_configs/` — 63 configuration-driven test directories
- `qa/` — Integration tests (jailbreak, moderation, grounding, etc.)
- `benchmark/tests/` — 9 load testing infrastructure tests
- `pytest.ini` / `pyproject.toml [tool.pytest]` — Test configuration
- `tox.ini` — Multi-Python test automation

### Code Quality
- `ruff.toml` — Linter + formatter configuration
- `.pre-commit-config.yaml` — Pre-commit hooks (ruff, pyright, license)
- `pyproject.toml [tool.pyright]` — Type checking configuration

### Container Images
- `Dockerfile` — Upstream NVIDIA image (python:3.12-slim)
- `Dockerfile.server` — Fork-specific UBI9 production image
- `.dockerignore` — Build context exclusions
- `Makefile` — Image build targets (buildx, kind-load)

### Security
- `.github/workflows/security.yml` — Trivy + Bandit scanning
- `greptile.json` — AI code review configuration

### Agent Rules
- `CLAUDE.md` — Repository overview, build/test/architecture guidance

### Dependencies
- `pyproject.toml` — Poetry dependencies and extras
- `poetry.lock` — Locked dependency versions
- `requirements.txt` — Pinned deps via `uv pip compile`
