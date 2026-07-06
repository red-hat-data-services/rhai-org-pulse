---
repository: "trustyai-explainability/NeMo-Guardrails"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Excellent test-to-code ratio (303:309), comprehensive pytest suite with async support"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "LangChain integration tests and E2E tests present; no live/deployed E2E automation"
  - dimension: "Build Integration"
    score: 5.0
    status: "Docker image tested on PR for Dockerfile changes only; no fork-specific Dockerfile.server PR validation"
  - dimension: "Image Testing"
    score: 6.5
    status: "Docker runtime validation in CI with health checks; UBI9 multi-stage build but no PR-time validation for fork image"
  - dimension: "Coverage Tracking"
    score: 7.5
    status: "Codecov integration with PR reporting; coverage set to informational, no enforcement threshold"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "Well-organized reusable workflows, multi-OS/multi-Python matrix, caching, parallel tests with xdist"
  - dimension: "Agent Rules"
    score: 6.0
    status: "CLAUDE.md present with repo layout and build/test instructions; no .claude/rules/ for test creation guidance"
critical_gaps:
  - title: "Coverage thresholds are informational only"
    impact: "Coverage can regress without blocking PRs; no enforcement of minimum standards"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No PR-time validation for Dockerfile.server (fork image)"
    impact: "UBI9 fork-specific image build failures discovered only post-merge or in downstream builds"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No secret detection tooling"
    impact: "Secrets or API keys could be committed without automated detection"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "Missing test automation agent rules"
    impact: "AI-generated tests lack consistency; no standardized patterns for test creation"
    severity: "MEDIUM"
    effort: "3-4 hours"
quick_wins:
  - title: "Enforce coverage thresholds in Codecov config"
    effort: "1-2 hours"
    impact: "Prevent coverage regression on PRs with hard pass/fail gates"
  - title: "Add Gitleaks pre-commit hook for secret detection"
    effort: "1-2 hours"
    impact: "Prevent accidental secret commits at development time"
  - title: "Add Dockerfile.server build to PR workflow"
    effort: "2-3 hours"
    impact: "Catch fork-specific image build failures before merge"
  - title: "Create .claude/rules/ with test pattern guidance"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality and consistency"
recommendations:
  priority_0:
    - "Enforce coverage thresholds — change Codecov status from informational to required with a minimum threshold (e.g., 70%)"
    - "Add Dockerfile.server build validation to PR workflow to catch fork-specific build issues"
    - "Integrate secret detection (Gitleaks) into pre-commit hooks and CI"
  priority_1:
    - "Create .claude/rules/ directory with test creation patterns (unit, integration, e2e)"
    - "Add SBOM generation and image signing to container build pipeline"
    - "Activate 'live' and 'slow' test markers with dedicated CI jobs for provider integration testing"
  priority_2:
    - "Add multi-architecture container build support (arm64) for Dockerfile.server"
    - "Implement contract tests for the /v1/guardrail/checks API endpoint"
    - "Add performance regression detection to benchmark tests in CI"
---

# Quality Analysis: NeMo-Guardrails (TrustyAI Fork)

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Python library + FastAPI server (LLM guardrails toolkit)
- **Primary Language**: Python (761 .py files)
- **Fork**: `trustyai-explainability/NeMo-Guardrails` (fork of NVIDIA/NeMo-Guardrails)
- **Default Branch**: `develop`

### Key Strengths
1. **Exceptional test-to-code ratio** — 303 test files for 309 source files (~1:1), with 1,445 async test functions
2. **Mature CI/CD** — Reusable workflow pattern, multi-OS/multi-Python matrix (3.10-3.13), pytest-xdist parallelism
3. **Strong security scanning** — Trivy filesystem + dependency scanning, Bandit SAST, SARIF upload to GitHub Security tab
4. **Comprehensive pre-commit hooks** — Ruff linting/formatting, YAML checks, license headers, Pyright type checking

### Critical Gaps
1. Coverage enforcement is informational-only (no blocking thresholds)
2. Fork-specific Dockerfile.server not validated in PR workflows
3. No secret detection tooling (Gitleaks/TruffleHog)
4. No `.claude/rules/` for AI test automation guidance

### Agent Rules Status: **Partial**
- `CLAUDE.md` is present with repo layout, build, and test instructions
- No `.claude/` directory or test creation rules

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Excellent test-to-code ratio (303:309), comprehensive pytest suite with async support |
| Integration/E2E | 7.0/10 | LangChain integration tests and E2E tests present; no live/deployed E2E automation |
| **Build Integration** | **5.0/10** | **Docker image tested on PR for Dockerfile changes only; no fork-specific Dockerfile.server PR validation** |
| Image Testing | 6.5/10 | Docker runtime validation in CI with health checks; UBI9 multi-stage build but no PR-time validation for fork image |
| Coverage Tracking | 7.5/10 | Codecov integration with PR reporting; coverage set to informational, no enforcement threshold |
| CI/CD Automation | 8.5/10 | Well-organized reusable workflows, multi-OS/multi-Python matrix, caching, parallel tests with xdist |
| Agent Rules | 6.0/10 | CLAUDE.md present with repo layout and build/test instructions; no .claude/rules/ for test creation guidance |

## Critical Gaps

### 1. Coverage Thresholds Are Informational Only
- **Impact**: Coverage can regress silently without blocking PRs
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: `.github/codecov.yml` sets both `project` and `patch` status to `informational: true`. This means Codecov reports coverage but never blocks a PR from merging, regardless of how much coverage drops.
- **Fix**: Set `informational: false` and add `target: 70%` (or appropriate baseline) to both project and patch status.

### 2. No PR-Time Validation for Dockerfile.server (Fork Image)
- **Impact**: UBI9 fork-specific image build failures discovered only post-merge or in downstream Konflux builds
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The `test-docker.yml` workflow builds and tests the upstream `Dockerfile` only. The fork's production image (`Dockerfile.server`) — which is a UBI9 multi-stage build with baked-in models, filter scripts, and a custom entrypoint — is never validated in CI. Changes to `pyproject.toml`, `requirements.txt`, or `scripts/` could break the production image silently.
- **Fix**: Add a PR-triggered job that builds `Dockerfile.server` and performs a basic health check.

### 3. No Secret Detection Tooling
- **Impact**: API keys, tokens, or credentials could be committed without automated detection
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: No `.gitleaks.toml`, no TruffleHog, no secret scanning in pre-commit or CI. The repo handles API keys (OpenAI, NVIDIA) in test configuration, increasing the risk.
- **Fix**: Add `gitleaks` to `.pre-commit-config.yaml` and a CI job.

### 4. Missing Test Automation Agent Rules
- **Impact**: AI-generated tests lack consistency; no standardized patterns for different test types
- **Severity**: MEDIUM
- **Effort**: 3-4 hours
- **Details**: The `CLAUDE.md` provides good repo orientation but no `.claude/rules/` directory with test creation patterns. AI agents creating tests won't follow consistent patterns for unit vs. integration vs. server tests.

## Quick Wins

### 1. Enforce Coverage Thresholds (1-2 hours)
Update `.github/codecov.yml`:
```yaml
coverage:
  status:
    project:
      default:
        informational: false
        target: 70%
    patch:
      default:
        informational: false
        target: 80%
```

### 2. Add Gitleaks Pre-commit Hook (1-2 hours)
Add to `.pre-commit-config.yaml`:
```yaml
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.4
    hooks:
      - id: gitleaks
```

### 3. Add Dockerfile.server Build to PR Workflow (2-3 hours)
Add a job to `pr-tests.yml` or create a new workflow:
```yaml
  build-server-image:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: Dockerfile.server
          load: true
          tags: nemo-guardrails-server:test
      - run: |
          docker run -d --name test -p 8000:8000 nemo-guardrails-server:test
          timeout 120 bash -c 'until curl -sf http://localhost:8000/v1/rails/configs; do sleep 2; done'
          docker stop test
```

### 4. Create Agent Rules for Test Patterns (2-3 hours)
Run `/test-rules-generator` on this repository to auto-generate `.claude/rules/` with patterns for:
- Unit tests (pytest, async, mocking patterns)
- Integration tests (LangChain, server API)
- E2E tests (guardrail validation)

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory** (19 workflow files):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pr-tests.yml` | PR (code changes) | Ubuntu-only pytest matrix (3.10-3.13), coverage on 3.11 |
| `pr-tests-skip.yml` | PR (docs/CI changes) | Skip tests for non-code changes |
| `full-tests.yml` | PR review requested, push to main/develop, tags | Windows + macOS matrix (3.10-3.13) |
| `lint.yml` | PR, push to main/develop | Pre-commit hooks (Ruff, Pyright, YAML, license) |
| `security.yml` | PR to develop, push to develop | Trivy + Bandit scans with SARIF upload |
| `test-docker.yml` | Weekly, tags, PR (Dockerfile changes) | Build upstream Dockerfile, runtime health check |
| `test-and-build-wheel.yml` | Push to main/develop, tags, nightly | Build wheel, test distribution |
| `test-published-dist.yml` | Nightly | Install from PyPI, server smoke test |
| `latest-deps-tests.yml` | Nightly | Full matrix with latest dependencies |
| `docs-build.yaml` | PR/push (docs changes) | Fern docs build |
| `docs-links-pr.yaml` | PR (markdown changes) | Documentation link validation |
| `release.yml` | Manual dispatch | Release preparation |
| `create-tag.yml` | PR merge to develop | Auto-tag on release branch merge |
| `publish-*.yml` | Various | PyPI publishing |

**Strengths**:
- Reusable workflow pattern (`_test.yml`) avoids duplication
- Multi-OS matrix (Ubuntu, macOS, Windows) with multi-Python (3.10-3.13)
- Smart path-based filtering — docs-only changes skip tests
- Venv caching with health check
- Poetry lock verification (`poetry check --lock`)
- Nightly dependency compatibility testing
- Nightly published package validation

**Gaps**:
- No concurrency control (`concurrency:` groups) — parallel runs on same PR possible
- No explicit timeout on test jobs (risk of hanging tests consuming runner time)
- `test-docker.yml` only validates upstream `Dockerfile`, not fork `Dockerfile.server`

### Test Coverage

**Test Structure**:
- **303 test files** across 14 subdirectories
- **309 source files** — near 1:1 test-to-code ratio
- **3 conftest.py** files for fixtures
- **1,445 async test functions** (`@pytest.mark.asyncio`)
- **99 parametrized** test functions
- **163 skipped** tests (needs review for stale skips)

**Test Categories**:
| Category | Location | Count | Notes |
|----------|----------|-------|-------|
| Unit | `tests/` (root) | ~200 | Core guardrails, rails, LLM interaction |
| Integration | `tests/integrations/langchain/` | 20+ | LangChain adapter tests |
| Server | `tests/server/` | 5 | API endpoint tests |
| CLI | `tests/cli/` | CLI command tests | |
| Colang | `tests/colang/`, `tests/v2_x/` | Language tests | Colang v1/v2 |
| Eval | `tests/eval/` | Evaluation framework tests | |
| Telemetry | `tests/telemetry/` | OpenTelemetry integration | |
| E2E | `tests/test_*_e2e*.py` | 4 files | Guardrails AI integration |
| Benchmark | `benchmark/tests/` | 9 | Performance/load testing |
| QA | `qa/` | 5 | Live API tests (manual) |

**Test Execution**:
- `pytest-xdist` for parallel execution with `worksteal` distribution
- `UNIT_TEST_ENV` strips API keys to prevent accidental live calls
- Custom markers: `serial`, `slow`, `live`, `real_embeddings`
- asyncio default fixture scope: `function`

**Gaps**:
- `live` marker only used on 2 tests — limited live provider testing
- `serial` and `slow` markers defined but unused (0 tests marked)
- 163 skipped tests may indicate stale/broken tests
- No contract tests for API boundaries

### Code Quality

**Linting & Formatting**:
- **Ruff** (v0.14.6): E4, E7, E9, F, W291-293, I001-002 rules enabled; line-length=120
- **Pyright**: Type checking on core modules (rails, actions, llm, embeddings, cli, kb, logging, tracing, server, guardrails)
- **Pre-commit hooks**: check-yaml, end-of-file-fixer, trailing-whitespace, ruff (lint + format), license headers, pyright

**Strengths**:
- Comprehensive pre-commit pipeline — code can't be committed without passing lint + type check
- Ruff used for both linting and formatting (consistent toolchain)
- Pyright scoped to critical modules (avoids noise from experimental code)
- License header enforcement on all `.py` files

**Gaps**:
- Ruff rule selection is minimal — only basic error detection, no complexity checks (C901), naming conventions (N), or documentation rules
- No `mypy` (Pyright is used instead, which is fine, but has different strictness defaults)
- `.coderabbit.yaml` configured but with `auto_incremental_review: false` — manual trigger only

### Container Images

**Dockerfiles** (4 files):

| File | Base | Purpose |
|------|------|---------|
| `Dockerfile` | `python:3.12-slim` | Upstream development/demo image |
| `Dockerfile.server` | `ubi9/python-312` | **Fork production image** — UBI9, multi-stage, baked models |
| `qa/Dockerfile.qa` | `python:3.10` | QA test image for GitLab CI |
| `.devcontainer/Dockerfile` | Various | Dev container |

**Dockerfile.server (Fork Production Image)**:
- Multi-stage build (build → runtime)
- UBI9 base for RHEL compliance
- Pre-downloads required models (FastEmbed, HuggingFace)
- Guardrail profile filtering (`scripts/filter_guardrails.py`)
- Non-root user (1001)
- Build args: `COMMIT_SHA`, `BUILD_REF`, `GUARDRAILS_PROFILE`
- Proper cache cleanup in build stage

**Runtime Validation**:
- `test-docker.yml` builds upstream `Dockerfile`, starts container, validates `/v1/rails/configs` endpoint
- GitLab CI has `docker-test` stage that runs pytest inside container (tags only)

**Gaps**:
- `Dockerfile.server` has no CI validation at all
- No multi-architecture builds (amd64 only for fork image)
- No vulnerability scanning of built images (Trivy scans source, not built images)
- No SBOM generation
- No image signing/attestation

### Security

**Strengths**:
- **Trivy**: Filesystem + dependency scanning on PRs and pushes to develop
- **Bandit**: Python SAST scanning with SARIF output
- **SARIF integration**: Both tools upload to GitHub Security tab
- **Critical/High blocking**: Trivy `exit-code: 1` on critical/high vulnerabilities
- **GitLab SAST**: Template-based SAST in GitLab CI
- **Dependency pinning**: `poetry.lock` with `poetry check --lock` enforcement
- **CVE awareness**: `protobuf >= 5.29.5` pinned against CVE-2024-7254
- **SECURITY.md**: Proper vulnerability disclosure process (NVIDIA PSIRT)

**Gaps**:
- No secret detection (Gitleaks, TruffleHog)
- No CodeQL workflow
- Bandit excludes `tests/` directory
- No container image scanning (only source scanning)
- No dependency review action for new PRs
- Security workflow only triggers on `develop` branch, not `main`

### Agent Rules (Agentic Flow Quality)

**Status**: Partial

**Present**:
- `CLAUDE.md` at repository root with:
  - Repository layout overview
  - Git remote configuration (upstream, trustyai-fork, midstream, downstream)
  - Build and install instructions
  - Test execution commands
  - CI workflow description
  - Key fork changes summary

**Missing**:
- No `.claude/` directory
- No `.claude/rules/` for test creation patterns
- No test automation guidance (unit test patterns, fixture usage, async test patterns)
- No integration test templates
- No server test guidelines

**Recommendation**: Run `/test-rules-generator` to generate comprehensive test creation rules based on existing patterns.

## Recommendations

### Priority 0 (Critical)

1. **Enforce coverage thresholds** — Change Codecov status from `informational: true` to `informational: false` with `target: 70%` for project and `target: 80%` for patch coverage. This prevents silent coverage regression.

2. **Add Dockerfile.server build validation to PR workflow** — Create a CI job that builds the fork production image and performs a basic health check. Currently, the only Docker CI validates the upstream `Dockerfile`.

3. **Integrate secret detection** — Add Gitleaks to pre-commit hooks and a CI workflow. The repo handles API keys (OpenAI, NVIDIA) and lacks any secret detection.

### Priority 1 (High Value)

4. **Create `.claude/rules/` with test patterns** — Generate rules for unit (pytest + async), integration (LangChain adapter), server (FastAPI test client), and E2E (guardrail validation) test patterns.

5. **Add SBOM generation and image signing** — Integrate Syft/Grype for SBOM and cosign for image signing in the container build pipeline.

6. **Activate live/slow test markers** — The `live` marker is defined but only used on 2 tests. Create a scheduled CI job that runs `@pytest.mark.live` tests against real LLM providers.

7. **Add concurrency control to workflows** — Add `concurrency:` groups to prevent parallel runs on the same PR:
   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: true
   ```

### Priority 2 (Nice-to-Have)

8. **Add multi-architecture container builds** — Support arm64 in addition to amd64 for `Dockerfile.server`.

9. **Implement contract tests for /v1/guardrail/checks** — The fork-specific API endpoint should have contract tests ensuring backward compatibility.

10. **Add performance regression detection** — The `benchmark/` directory has infrastructure; wire it into CI with regression thresholds.

11. **Review 163 skipped tests** — Audit `@pytest.mark.skip` tests for stale/broken tests that should be fixed or removed.

12. **Add CodeQL analysis** — Complement Bandit with GitHub's CodeQL for deeper semantic analysis.

## Comparison to Gold Standards

| Dimension | NeMo-Guardrails | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|-----------|----------------|---------------------|-----------------|--------------|
| Test-to-code ratio | ~1:1 | ~1:1 | Moderate | High |
| Coverage enforcement | Informational | Hard threshold | N/A | Hard threshold |
| Multi-OS testing | Yes (3 OS) | No | N/A | No |
| Multi-version testing | Yes (4 Python) | N/A | N/A | Yes (K8s versions) |
| Container scanning | Trivy (source) | Trivy (images) | Trivy (images) | Trivy |
| Secret detection | None | Gitleaks | N/A | N/A |
| Pre-commit hooks | Yes (Ruff, Pyright) | Yes (ESLint, Prettier) | N/A | Yes |
| Image runtime test | Yes (upstream only) | N/A | Yes (5-layer) | N/A |
| Agent rules | CLAUDE.md only | .claude/rules/ | N/A | N/A |
| SBOM generation | None | Present | Present | N/A |
| Parallel tests | pytest-xdist | Jest workers | N/A | Go parallel |

## File Paths Reference

### CI/CD
- `.github/workflows/pr-tests.yml` — PR test matrix
- `.github/workflows/_test.yml` — Reusable test workflow
- `.github/workflows/full-tests.yml` — Full OS matrix tests
- `.github/workflows/lint.yml` — Pre-commit/linting
- `.github/workflows/security.yml` — Trivy + Bandit
- `.github/workflows/test-docker.yml` — Docker image testing
- `.github/workflows/test-and-build-wheel.yml` — Build + test distribution
- `.github/workflows/test-published-dist.yml` — Published package testing
- `.github/workflows/latest-deps-tests.yml` — Nightly dependency testing
- `.gitlab-ci.yml` — GitLab CI (tests + docker build/test)

### Testing
- `tests/` — Main test directory (303 test files)
- `tests/conftest.py` — Root test fixtures
- `tests/integrations/langchain/` — LangChain integration tests
- `tests/server/` — Server API tests
- `benchmark/tests/` — Benchmark tests
- `qa/` — QA/live API tests

### Code Quality
- `ruff.toml` — Ruff linter/formatter config
- `.pre-commit-config.yaml` — Pre-commit hooks
- `pyproject.toml` — Project config, Pyright settings
- `.coderabbit.yaml` — CodeRabbit AI review config

### Container Images
- `Dockerfile` — Upstream development image
- `Dockerfile.server` — Fork production image (UBI9)
- `qa/Dockerfile.qa` — QA test image
- `.devcontainer/Dockerfile` — Dev container
- `.dockerignore` — Docker build exclusions

### Coverage
- `.github/codecov.yml` — Codecov configuration

### Security
- `.github/workflows/security.yml` — Trivy + Bandit
- `SECURITY.md` — Vulnerability disclosure
- `.gitlab-ci.yml` — GitLab SAST template

### Agent Rules
- `CLAUDE.md` — Repository documentation for AI agents
