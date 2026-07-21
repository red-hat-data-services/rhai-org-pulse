---
repository: "trustyai-explainability/NeMo-Guardrails"
overall_score: 7.5
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "Exceptional test suite with 437+ test files, 1.3:1 test-to-code ratio, deterministic mocking, and parallel execution"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "Good integration coverage with recorded VCR tests and server testing, but no dedicated E2E suite"
  - dimension: "Build Integration"
    score: 5.0
    status: "Wheel build and server startup validation on push/tags; Docker build on PR only for Dockerfile changes; no Konflux simulation"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage UBI9 production image with health checks and CI-based server validation; root Dockerfile has HEALTHCHECK"
  - dimension: "Coverage Tracking"
    score: 8.0
    status: "Codecov integration with 85% threshold enforcement on PRs; coverage on develop pushes"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "29 workflows with multi-OS/multi-Python matrix, nightly latest-deps, dual CI (GitHub+GitLab), caching, and parallelization"
  - dimension: "Static Analysis"
    score: 7.0
    status: "Ruff linting/formatting, ty type checker, pre-commit hooks, zizmor security; Dependabot for actions but missing pip ecosystem"
  - dimension: "Agent Rules"
    score: 9.0
    status: "Comprehensive multi-level AGENTS.md files, CLAUDE.md, 2 agent skills, validation tables, framework-specific guidance"
critical_gaps:
  - title: "hashlib.md5 usage in production code"
    impact: "Non-FIPS-compliant cryptographic hash used in utils.py and embeddings/cache.py — blocks FIPS certification"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No PR-time Docker image build for most PRs"
    impact: "Docker image build failures only caught on push to main/develop or when Dockerfile itself changes"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "Dependabot missing pip/PyPI ecosystem coverage"
    impact: "Python dependency vulnerabilities not automatically surfaced via Dependabot PRs"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "Non-UBI base images in secondary Dockerfiles"
    impact: "Jailbreak detection, fact-checking, and QA Dockerfiles use python:3.x-slim — not FIPS-capable"
    severity: "MEDIUM"
    effort: "4-8 hours"
quick_wins:
  - title: "Add pip ecosystem to Dependabot configuration"
    effort: "30 minutes"
    impact: "Automated dependency vulnerability alerts and update PRs for Python packages"
  - title: "Add .codecov.yml with PR comment and patch coverage settings"
    effort: "1 hour"
    impact: "Better PR-level coverage visibility and patch coverage enforcement"
  - title: "Add HEALTHCHECK to Dockerfile.server"
    effort: "30 minutes"
    impact: "Container orchestrators can detect unhealthy server instances automatically"
recommendations:
  priority_0:
    - "Replace hashlib.md5 with hashlib.sha256 in nemoguardrails/utils.py and nemoguardrails/embeddings/cache.py for FIPS compliance"
    - "Add Dependabot pip ecosystem entry to .github/dependabot.yml for automated Python dependency vulnerability tracking"
  priority_1:
    - "Enable PR-time Docker image build for all PRs (not just Dockerfile changes) to catch build regressions early"
    - "Migrate secondary Dockerfiles (jailbreak detection, fact-checking, QA) to UBI base images for FIPS compatibility"
    - "Add .codecov.yml with patch coverage thresholds and PR comment configuration"
  priority_2:
    - "Add HEALTHCHECK instruction to Dockerfile.server for container orchestrator health monitoring"
    - "Consider adding Dependabot for Docker base image updates"
    - "Add dedicated E2E test suite for server deployment scenarios"
---

# Quality Analysis: NeMo-Guardrails (trustyai-explainability fork)

## Executive Summary

- **Overall Score: 7.5/10**
- **Repository**: [trustyai-explainability/NeMo-Guardrails](https://github.com/trustyai-explainability/NeMo-Guardrails)
- **Type**: Python library/toolkit for programmable LLM guardrails
- **Primary Language**: Python (828 source files)
- **Framework**: FastAPI server, Colang DSL, pytest
- **Jira**: RHOAIENG / AI Safety (upstream tier)

**Key Strengths**: Exceptional unit test suite with 437+ test files and 85% coverage threshold enforcement. Outstanding CI/CD with 29 workflows, multi-OS/multi-Python matrix testing, nightly dependency verification, and dual CI systems (GitHub Actions + GitLab CI). Comprehensive agent rules with multi-level AGENTS.md files and dedicated agent skills.

**Critical Gaps**: hashlib.md5 usage in production code blocks FIPS compliance. Dependabot not configured for Python dependency ecosystem. Docker image builds not triggered on most PRs.

**Agent Rules Status**: Present and comprehensive — CLAUDE.md, root AGENTS.md, nemoguardrails/AGENTS.md, docs/AGENTS.md, plus 2 agent skills.

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 9.0/10 | 15% | 1.35 | Exceptional test suite with deterministic mocking and parallel execution |
| Integration/E2E | 7.0/10 | 20% | 1.40 | Good recorded tests and server testing; no dedicated E2E suite |
| Build Integration | 5.0/10 | 15% | 0.75 | Wheel build solid; Docker on PR only for Dockerfile changes |
| Image Testing | 7.0/10 | 10% | 0.70 | Multi-stage UBI9 with health checks; CI server validation |
| Coverage Tracking | 8.0/10 | 10% | 0.80 | Codecov with 85% threshold; missing .codecov.yml |
| CI/CD Automation | 9.0/10 | 15% | 1.35 | 29 workflows, multi-OS, nightly tests, dual CI, caching |
| Static Analysis | 7.0/10 | 10% | 0.70 | Ruff + ty + pre-commit; missing pip Dependabot |
| Agent Rules | 9.0/10 | 5% | 0.45 | Multi-level AGENTS.md, CLAUDE.md, 2 agent skills |
| **Overall** | **7.5/10** | **100%** | **7.50** | |

## Critical Gaps

### 1. hashlib.md5 Usage in Production Code
- **Impact**: Non-FIPS-compliant cryptographic hash used in `nemoguardrails/utils.py:407-408` and `nemoguardrails/embeddings/cache.py:71` — blocks FIPS certification for deployments requiring FIPS 140-2/140-3 compliance
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: `utils.py` probes for MD5 availability and falls back to SHA256 (has a test for this in `tests/test_utils.py:150`), but `embeddings/cache.py:71` directly calls `hashlib.md5()` without FIPS fallback
- **Fix**: Replace `hashlib.md5` with `hashlib.sha256` in both locations; the cache key does not need cryptographic security, just content addressing

### 2. No PR-Time Docker Image Build for Most PRs
- **Impact**: Docker image build failures are only caught when pushing to main/develop, on tags, or when Dockerfile/pyproject.toml/uv.lock files change on PR
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: `test-docker.yml` only triggers on PRs when paths include `Dockerfile`, `pyproject.toml`, `uv.lock`, or the workflow itself. Code changes that break the Docker build context (e.g., new module imports, missing files) are not caught until post-merge
- **Fix**: Add the Docker build step to the main PR test workflow, or broaden the path filter

### 3. Dependabot Missing pip/PyPI Ecosystem
- **Impact**: Python dependency vulnerabilities are not automatically surfaced as Dependabot PRs; team must manually track CVEs in 30+ direct dependencies
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: `.github/dependabot.yml` only covers `github-actions` and `pre-commit` ecosystems; the `pip` ecosystem is absent
- **Fix**: Add `package-ecosystem: pip` entry targeting pyproject.toml

### 4. Non-UBI Base Images in Secondary Dockerfiles
- **Impact**: Jailbreak detection (`nemoguardrails/library/jailbreak_detection/Dockerfile`), fact-checking (`nemoguardrails/library/factchecking/align_score/Dockerfile`), QA, and dev container Dockerfiles all use `python:3.x-slim` or similar non-UBI bases — not FIPS-capable
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: Root Dockerfile uses `python:3.12-slim`; Dockerfile.server correctly uses `registry.access.redhat.com/ubi9/python-312:latest`

## Quick Wins

### 1. Add pip Ecosystem to Dependabot (30 minutes)
Add the following to `.github/dependabot.yml`:
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

### 2. Add .codecov.yml Configuration (1 hour)
```yaml
coverage:
  status:
    project:
      default:
        target: 85%
    patch:
      default:
        target: 80%
comment:
  layout: "reach,diff,flags,files"
  behavior: default
  require_changes: true
```

### 3. Add HEALTHCHECK to Dockerfile.server (30 minutes)
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request, sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/v1/health').status == 200 else 1)"
```

## Detailed Findings

### Unit Tests

**Score: 9.0/10**

NeMo-Guardrails has an exceptional unit test suite that stands out as a gold standard for Python libraries.

**Test Infrastructure**:
- **437+ test files** in `tests/` directory with 9 additional benchmark tests
- **333 source Python files** → test-to-code ratio of ~1.3:1 (excellent)
- **pytest** framework with `pytest-xdist` for parallel execution using worksteal distribution
- **3,526 async test functions** covering async/await patterns thoroughly

**Test Isolation**:
- `UNIT_TEST_ENV` unsets `OPENAI_API_KEY`, `NVIDIA_API_KEY`, and live test env vars — unit tests cannot reach live services
- `DeterministicEmbeddingSearchProvider` replaces real embedding models in tests
- Session-scoped `autouse` fixtures reset context variables between tests
- Conditional collection ignoring for optional dependencies (e.g., langchain)

**Test Organization**:
- Well-structured directories: `colang/`, `rails/`, `guardrails/`, `llm/`, `server/`, `cli/`, `tracing/`, `telemetry/`, `eval/`, `evaluate/`, `integrations/`, `recorded/`, `v2_x/`
- Custom pytest markers: `recorded`, `serial`, `slow`, `perf`, `live`, `vcr`, `fake_cassette`, `real_embeddings`
- Benchmark tests separated in `benchmark/tests/`

**Key Files**: `tests/conftest.py`, `pytest.ini`, `Makefile` (test targets)

### Integration/E2E Tests

**Score: 7.0/10**

**Integration Tests**:
- `tests/integrations/` — 49 test files covering LangChain integration
- `tests/server/` — 8 test files covering API endpoints, health checks, OpenAI integration, guardrail checks, state management, threads
- `tests/recorded/` — 45 test files using VCR cassette-based replay for deterministic API interaction testing

**Recorded Test System** (notable practice):
- Cassette recording with sanitization of API keys, secrets, and volatile fields
- Replay mode with network blocking for fully offline deterministic tests
- Snapshot assertions with inline snapshot support
- Makefile targets: `record-cassettes`, `rewrite-cassettes`, `replay-cassettes`, `snapshot-cassettes`

**Server Deployment Testing**:
- `test-and-build-wheel.yml` — builds wheel, installs it, starts server, verifies health endpoint (`/v1/rails/configs`)
- `test-docker.yml` — builds Docker image, starts container, health check, API verification

**Gaps**:
- No dedicated `e2e/` directory
- No multi-environment testing (but less applicable for a Python library vs. Kubernetes operator)
- No contract testing between server and client

### Build Integration

**Score: 5.0/10**

**PR-time Validation**:
- `pr-tests.yml` — runs pytest across 4 Python versions (3.10-3.13) on Ubuntu
- `full-tests.yml` — extends to Windows + macOS on review request/ready for review
- `lint.yml` — pre-commit hooks on PRs and pushes
- `test-docker.yml` — Docker build only when Dockerfile/pyproject.toml/uv.lock change on PR
- `uv lock --check` — verifies lockfile is in sync with pyproject.toml

**Wheel Build**:
- `test-and-build-wheel.yml` — builds wheel, tests installation across 4 Python versions, starts server and validates health
- Only runs on push to main/develop, tags, and nightly schedule — **not on PRs**

**Makefile Targets**:
- `image-build` — Docker buildx build with platform support
- `image-local-build` / `image-local-push` — local image build and push
- `image-kind` — load image into Kind cluster

**Gaps**:
- Wheel build not triggered on PRs — breaking changes to packaging can merge undetected
- Docker build on PRs only for narrow path filter
- No Konflux build simulation

### Image Testing

**Score: 7.0/10**

**Dockerfiles**:
- `Dockerfile` (root) — single-stage, `python:3.12-slim`, with HEALTHCHECK, uv-based install, model pre-download
- `Dockerfile.server` — multi-stage UBI9 build (`registry.access.redhat.com/ubi9/python-312`), non-root user (1001), model pre-download, build-time cleanup, **no HEALTHCHECK**
- `qa/Dockerfile.qa` — single-stage, `python:3.10`, full dev dependencies for test execution
- Additional specialized Dockerfiles for jailbreak detection (GPU and CPU) and fact-checking

**CI Image Testing**:
- `test-docker.yml` — builds with Docker buildx, GHA caching, starts container, health check, API verification
- `test-and-build-wheel.yml` — validates wheel installation and server startup

**Best Practices**:
- `.dockerignore` present and well-configured
- Multi-stage build in Dockerfile.server (build dependencies removed in runtime stage)
- UBI9 base image for production (FIPS-capable)
- BuildKit cache mounts for uv cache
- Non-root user in Dockerfile.server
- HEALTHCHECK in root Dockerfile

**Multi-Architecture**:
- Makefile supports `--platform` flag via `PLATFORMS` variable (defaults to `linux/amd64`)
- Docker buildx configured in both Makefile and CI

**Gaps**:
- Dockerfile.server missing HEALTHCHECK instruction
- Root Dockerfile uses `python:3.12-slim` (not FIPS-capable)
- No Testcontainers usage for runtime validation
- Secondary Dockerfiles use non-UBI base images

### Coverage Tracking

**Score: 8.0/10**

**Configuration**:
- Codecov integration via `codecov/codecov-action@v7` with pinned SHA
- Coverage runs on Python 3.11 for PRs and develop pushes
- `--cov=nemoguardrails --cov-report=xml:coverage.xml` via Makefile
- **85% coverage threshold enforcement** (`--cov-fail-under=85`) — CI fails if coverage drops below

**CI Integration**:
- PR tests: coverage on Python 3.11 matrix entry
- Develop branch: dedicated `develop-coverage.yml` workflow
- GitLab CI: coverage regex extraction (`/(?i)total.*? (100(?:\.0+)?\%|[1-9]?\d(?:\.\d+)?\%)$/`)
- Coverage upload to Codecov with `fail_ci_if_error: true`

**Gaps**:
- No `.codecov.yml` configuration file — using Codecov defaults
- No patch coverage enforcement (only project-level threshold)
- No coverage badge or PR comment configuration

### CI/CD Automation

**Score: 9.0/10**

**Workflow Inventory** (29 workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pr-tests.yml` | PR (code changes) | Test across 4 Python versions on Ubuntu |
| `pr-tests-skip.yml` | PR (docs/.github only) | Skip tests for non-code changes |
| `full-tests.yml` | review_requested, push main/develop | Windows + macOS matrix |
| `latest-deps-tests.yml` | Daily schedule | 3 OS x 4 Python with `--upgrade` |
| `lint.yml` | PR, push main/develop | Pre-commit hooks |
| `test-docker.yml` | PR (Dockerfile changes), weekly, tags | Docker build + health check |
| `test-and-build-wheel.yml` | Push main/develop, tags, nightly | Wheel build + server startup |
| `test-published-dist.yml` | On-demand | Test published wheel |
| `_test.yml` | Reusable | Shared test job template |
| `develop-coverage.yml` | Push develop | Coverage with Codecov upload |
| `security.yml` | PR/push to develop | Trivy + Bandit scans |
| `zizmor.yml` | PR/push to develop, weekly | GitHub Actions security audit |
| `codeql.yml` | Schedule/dispatch | CodeQL analysis |
| `create-tag.yml` | Dispatch | Tag creation |
| `release.yml` | Tag push | Release automation |
| `publish-pypi-approval.yml` | Release | PyPI publish with approval |
| `publish-wheel.yml` | Dispatch | Manual wheel publish |
| `docs-build.yaml` | PR/push | Documentation build |
| `pr-merge-guidance.yml` | PR events | Merge guidance comments |
| `pr-fix-regression-proof.yml` | PR events | Regression proof enforcement |
| `pr-size-label.yml` | PR events | Size labeling |
| `review-response-reminder.yml` | PR events | Review reminders |
| `close-contribution-workflow-violation.yml` | PR events | Contribution policy enforcement |
| `stale.yml` | Schedule | Stale issue management |
| `triage-label.yml` | Issues | Issue triage labeling |
| `uv-latest.yml` | Schedule | UV version testing |

**Strengths**:
- Reusable workflow pattern (`_test.yml`) reduces duplication
- Concurrency control on 7 workflows
- uv caching via `setup-uv` action with per-Python-version cache suffixes
- Docker buildx caching via GHA cache
- pytest-xdist parallel execution with worksteal distribution
- Multi-OS testing: Ubuntu (PR), Windows + macOS (full tests)
- Multi-Python: 3.10, 3.11, 3.12, 3.13
- Nightly latest-deps testing across all OS/Python combinations
- Dual CI: GitHub Actions + GitLab CI
- Greptile configured for automated PR reviews

### Static Analysis

**Score: 7.0/10**

**Linting**:
- **Ruff** (`ruff.toml`) — linter + formatter with pyflakes, pycodestyle, and import sorting rules
- Line length: 120, indent: 4 spaces
- Selected rules: E4, E7, E9, F, W291, W292, W293, I001, I002
- Ignored: F821 (undefined names), F841 (unused variables)

**Type Checking**:
- **ty** (Astral's type checker) — configured as pre-commit hook, runs on all files

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- `check-yaml` — YAML syntax validation
- `end-of-file-fixer` — trailing newline enforcement
- `trailing-whitespace` — whitespace cleanup
- `ruff` — linting with auto-fix
- `ruff-format` — code formatting
- `insert-license` — Apache 2.0 license header insertion
- `zizmor` — GitHub Actions security scanning
- `ty` — type checking

**Dependency Alerts**:
- **Dependabot** configured for `github-actions` and `pre-commit` ecosystems (monthly, with grouping)
- **Missing**: `pip` ecosystem — Python dependency vulnerabilities not tracked

**FIPS Compatibility**:
- `hashlib.md5` used in:
  - `nemoguardrails/utils.py:407-408` — probes MD5 availability (has SHA256 fallback)
  - `nemoguardrails/embeddings/cache.py:71` — direct MD5 call for content hashing (**no fallback**)
  - Test in `tests/test_utils.py:150` verifies MD5 failure path
- Base images:
  - `Dockerfile.server` — UBI9 (FIPS-capable)
  - `Dockerfile` (root) — `python:3.12-slim` (not FIPS-capable)
  - Other Dockerfiles — `python:3.x-slim`, `pytorch` (not FIPS-capable)

### Agent Rules

**Score: 9.0/10**

This repository has exemplary agent rules — one of the best configurations seen across analyzed repositories.

**Root-Level**:
- **`CLAUDE.md`** — comprehensive overview with repo layout, git remotes, build/install instructions, test commands, CI overview, and key fork changes
- **`AGENTS.md`** — detailed agent guidance with quick rules, repository map, setup, validation commands with context-appropriate depth tables, contribution workflow, review readiness, code change rules, documentation guidance, and review mode

**Subdirectory-Level**:
- **`nemoguardrails/AGENTS.md`** — runtime and API-specific rules covering architecture map, public API preservation, sync/async alignment, provider abstraction, error handling conventions, and logging standards
- **`docs/AGENTS.md`** — documentation-specific rules with writing standards, Fern component usage, agentic documentation guidance, product naming, and validation commands

**Agent Skills** (`.agents/skills/`):
- `guardrails-developer-guide` — routes product-usage questions to canonical docs with MCP support, retrieval order, and intent routing
- `guardrails-developer-create-guardrails` — guides developers through creating guardrails configurations with decision tables, starting patterns, and iterative workflow

**Quality Assessment**:
- Rules are highly actionable with validation command tables
- Framework-specific: pytest, ruff, uv, make targets, Fern docs
- Multi-level hierarchy: root rules + package-specific + docs-specific
- Test-aware: explicit guidance on test isolation, live service prevention, and coverage
- Contribution workflow integrated with AI policy (`AI_POLICY.md`)

**Minor Gap**: No `.claude/rules/` directory for granular rule files, though the multi-level AGENTS.md pattern achieves similar coverage

## Recommendations

### Priority 0 (Critical)

1. **Replace hashlib.md5 with hashlib.sha256** in `nemoguardrails/utils.py` and `nemoguardrails/embeddings/cache.py` for FIPS compliance. The cache key only needs content addressing, not cryptographic security — SHA256 is a direct drop-in replacement.

2. **Add pip ecosystem to Dependabot** by adding a `package-ecosystem: pip` entry to `.github/dependabot.yml`. This ensures Python dependency vulnerabilities are automatically surfaced as PRs.

### Priority 1 (High Value)

3. **Enable PR-time Docker image build** for all PRs (not just Dockerfile changes) to catch build context regressions before merge. Can use Docker build caching to minimize CI time.

4. **Migrate secondary Dockerfiles to UBI base images** — `nemoguardrails/library/jailbreak_detection/Dockerfile`, `nemoguardrails/library/factchecking/align_score/Dockerfile`, and `qa/Dockerfile.qa` should use UBI9 base images for FIPS compatibility.

5. **Add `.codecov.yml`** with patch coverage thresholds and PR comment configuration to improve per-PR coverage visibility beyond the 85% project threshold.

### Priority 2 (Nice-to-Have)

6. **Add HEALTHCHECK instruction to Dockerfile.server** — the root Dockerfile has it but the production-oriented server Dockerfile does not.

7. **Consider Docker ecosystem in Dependabot** for automated base image update tracking.

8. **Add dedicated E2E test suite** for server deployment scenarios including multi-config deployment, concurrent request handling, and graceful shutdown behavior.

## Comparison to Gold Standards

| Dimension | NeMo-Guardrails | odh-dashboard | notebooks | kserve |
|-----------|----------------|---------------|-----------|--------|
| Unit Tests | 9/10 — 437+ files, 1.3:1 ratio | 9/10 — Multi-layer | N/A | 8/10 |
| Integration/E2E | 7/10 — Recorded + server | 9/10 — Contract tests | 7/10 | 9/10 — Multi-version |
| Build Integration | 5/10 — Wheel + limited PR Docker | 7/10 — PR builds | 6/10 | 7/10 |
| Image Testing | 7/10 — UBI9 multi-stage | 6/10 | 9/10 — 5-layer | 7/10 |
| Coverage Tracking | 8/10 — 85% threshold | 8/10 — Enforcement | 5/10 | 8/10 — Enforcement |
| CI/CD Automation | 9/10 — 29 workflows, dual CI | 9/10 — Comprehensive | 7/10 | 8/10 |
| Static Analysis | 7/10 — Ruff + ty + pre-commit | 8/10 | 6/10 | 7/10 |
| Agent Rules | 9/10 — Multi-level, skills | 8/10 — Comprehensive | 3/10 | 2/10 |
| **Overall** | **7.5** | **8.0** | **6.2** | **7.0** |

## File Paths Reference

### CI/CD
- `.github/workflows/pr-tests.yml` — PR test matrix
- `.github/workflows/_test.yml` — reusable test workflow
- `.github/workflows/lint.yml` — pre-commit hooks
- `.github/workflows/full-tests.yml` — multi-OS matrix
- `.github/workflows/test-docker.yml` — Docker image build/test
- `.github/workflows/test-and-build-wheel.yml` — wheel build/test
- `.github/workflows/develop-coverage.yml` — coverage on develop
- `.github/workflows/latest-deps-tests.yml` — nightly latest deps
- `.github/workflows/security.yml` — Trivy + Bandit
- `.github/workflows/zizmor.yml` — GH Actions security
- `.gitlab-ci.yml` — GitLab CI pipeline

### Testing
- `tests/` — main test directory (437+ files)
- `tests/conftest.py` — root test fixtures and isolation
- `tests/integrations/` — LangChain integration tests
- `tests/server/` — server API tests
- `tests/recorded/` — VCR cassette-based replay tests
- `benchmark/tests/` — benchmark tests
- `pytest.ini` — pytest configuration

### Static Analysis
- `ruff.toml` — Ruff linter/formatter config
- `.pre-commit-config.yaml` — pre-commit hooks
- `.github/dependabot.yml` — Dependabot config

### Container Images
- `Dockerfile` — root image (python:3.12-slim)
- `Dockerfile.server` — production UBI9 multi-stage image
- `qa/Dockerfile.qa` — QA image
- `.dockerignore` — Docker build exclusions

### Coverage
- `Makefile` (`test-coverage` target) — coverage generation
- `.github/workflows/_test.yml` — Codecov upload

### Agent Rules
- `CLAUDE.md` — Claude Code overview
- `AGENTS.md` — root agent rules
- `nemoguardrails/AGENTS.md` — package-specific agent rules
- `docs/AGENTS.md` — documentation agent rules
- `.agents/skills/` — agent skills (2 skills)
- `greptile.json` — Greptile PR review config
