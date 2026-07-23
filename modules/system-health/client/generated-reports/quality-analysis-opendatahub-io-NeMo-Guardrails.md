---
repository: "opendatahub-io/NeMo-Guardrails"
overall_score: 8.2
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "Excellent test suite with 414 test files, 1.94:1 test-to-source line ratio, pytest-xdist parallelization"
  - dimension: "Integration/E2E"
    score: 7.5
    status: "LangChain integration tests and recorded cassette replay tests; no cluster-based E2E"
  - dimension: "Build Integration"
    score: 8.5
    status: "PR-time Docker image builds, Tekton/Konflux pipelines for multi-arch, wheel build + install validation"
  - dimension: "Image Testing"
    score: 8.0
    status: "Multi-stage UBI9 builds, HEALTHCHECK, runtime server validation in CI, multi-arch via Tekton"
  - dimension: "Coverage Tracking"
    score: 9.0
    status: "Codecov with 85% fail-under threshold, patch target 90%, PR reporting, XML coverage output"
  - dimension: "CI/CD Automation"
    score: 9.5
    status: "29 workflows, multi-OS/Python matrix, concurrency control, caching, scheduled latest-deps, regression-proof"
  - dimension: "Static Analysis"
    score: 8.0
    status: "Ruff linting/formatting, pre-commit with 6 hooks including ty type checker, Dependabot for GH actions/pre-commit, zizmor workflow security"
  - dimension: "Agent Rules"
    score: 9.0
    status: "Comprehensive CLAUDE.md and AGENTS.md with architecture maps, subtree rules, .agents/skills/, AI_POLICY.md"
critical_gaps:
  - title: "hashlib.md5 usage in production code (non-FIPS-compliant)"
    impact: "Will fail in FIPS-enforced environments (RHEL FIPS mode, OpenShift FIPS clusters)"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Dependabot only covers GitHub Actions and pre-commit, not pip ecosystem"
    impact: "Python dependency vulnerabilities not automatically surfaced as PRs"
    severity: "MEDIUM"
    effort: "1 hour"
  - title: "No .claude/rules/ directory for test-specific agent rules"
    impact: "AI agents lack granular test creation guidance for different test types"
    severity: "LOW"
    effort: "2-3 hours"
quick_wins:
  - title: "Add pip ecosystem to Dependabot configuration"
    effort: "30 minutes"
    impact: "Automated Python dependency update PRs with vulnerability alerts"
  - title: "Replace hashlib.md5 with hashlib.sha256 in utils.py and embeddings/cache.py"
    effort: "1-2 hours"
    impact: "FIPS compliance for cryptographic hashing operations"
  - title: "Create .claude/rules/ with test creation patterns"
    effort: "2-3 hours"
    impact: "Consistent AI-generated tests following project patterns (recorded cassettes, conftest fixtures)"
recommendations:
  priority_0:
    - "Replace hashlib.md5 with FIPS-compliant hash (sha256) in nemoguardrails/utils.py and nemoguardrails/embeddings/cache.py"
    - "Add pip/uv ecosystem to Dependabot configuration for Python dependency alerts"
  priority_1:
    - "Create .claude/rules/ directory with test creation rules covering unit, integration, and recorded test patterns"
    - "Add upstream Dockerfile (python:3.12-slim) runtime validation similar to Dockerfile.server test-docker workflow"
  priority_2:
    - "Consider adding mypy or pyright type checking in CI (ty covers subset of source only)"
    - "Add contract tests for the server API endpoints (/v1/guardrail/checks, /v1/rails/configs)"
---

# Quality Analysis: NeMo-Guardrails (opendatahub-io)

## Executive Summary

- **Overall Score: 8.2/10** — This is one of the strongest repositories in the opendatahub-io organization
- **Repository Type**: Python library/server — LLM guardrails toolkit (NVIDIA NeMo Guardrails fork with Red Hat/TrustyAI customizations)
- **Tier**: Midstream (opendatahub-io/NeMo-Guardrails)
- **Jira**: RHOAIENG / AI Safety
- **Primary Language**: Python (828 .py files)
- **Key Strengths**: Exceptional CI/CD automation (29 workflows), strong test suite (414 test files, 1.94:1 test-to-source ratio), comprehensive agent rules, Codecov with 85% threshold enforcement
- **Critical Gaps**: hashlib.md5 usage in FIPS-sensitive paths, Dependabot missing pip ecosystem coverage
- **Agent Rules Status**: Present and comprehensive — CLAUDE.md, AGENTS.md (root + subtree), .agents/skills/, AI_POLICY.md

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 9.0/10 | 15% | 1.35 | Excellent test suite with 414 test files, pytest-xdist parallelization |
| Integration/E2E | 7.5/10 | 20% | 1.50 | LangChain integration tests, recorded cassette replay; no cluster-based E2E |
| Build Integration | 8.5/10 | 15% | 1.28 | PR-time Docker builds, Tekton/Konflux multi-arch, wheel build+test |
| Image Testing | 8.0/10 | 10% | 0.80 | Multi-stage UBI9, HEALTHCHECK, runtime server validation in CI |
| Coverage Tracking | 9.0/10 | 10% | 0.90 | Codecov with 85% fail-under, 90% patch target, PR reporting |
| CI/CD Automation | 9.5/10 | 15% | 1.43 | 29 workflows, multi-OS/Python matrix, regression-proof, caching |
| Static Analysis | 8.0/10 | 10% | 0.80 | Ruff + ty + pre-commit + zizmor; Dependabot partial |
| Agent Rules | 9.0/10 | 5% | 0.45 | CLAUDE.md, AGENTS.md (root+subtree), .agents/skills/, AI_POLICY.md |
| **Overall** | **8.2/10** | **100%** | **8.51** | |

## Critical Gaps

### 1. hashlib.md5 usage in production code (FIPS non-compliant)
- **Files**: `nemoguardrails/utils.py:407-408`, `nemoguardrails/embeddings/cache.py:68-71`
- **Impact**: Will fail in FIPS-enforced environments (RHEL FIPS mode, OpenShift FIPS clusters). MD5 is not an approved FIPS algorithm.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Fix**: Replace `hashlib.md5` with `hashlib.sha256` (or use `hashlib.md5(b"", usedforsecurity=False)` if Python 3.9+ and the hash is not security-relevant)

### 2. Dependabot missing pip ecosystem coverage
- **File**: `.github/dependabot.yml`
- **Impact**: Python dependency vulnerabilities not automatically surfaced. Currently only covers `github-actions` and `pre-commit` ecosystems.
- **Severity**: MEDIUM
- **Effort**: 1 hour
- **Fix**: Add `package-ecosystem: pip` entry targeting `pyproject.toml`/`uv.lock`

### 3. No .claude/rules/ directory for granular test creation guidance
- **Impact**: AI agents lack specific test creation rules (unit test patterns, recorded cassette patterns, conftest fixture usage)
- **Severity**: LOW
- **Effort**: 2-3 hours

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
**Impact**: Automated Python dependency update PRs with vulnerability alerts.

### 2. Replace hashlib.md5 for FIPS compliance (1-2 hours)
In `nemoguardrails/utils.py` and `nemoguardrails/embeddings/cache.py`, replace `hashlib.md5` with `hashlib.sha256` (or add `usedforsecurity=False` if the hash is only used for cache keying/deduplication).
**Impact**: FIPS compliance for all cryptographic hashing.

### 3. Create .claude/rules/ with test patterns (2-3 hours)
Create rules for unit tests (pytest patterns, mock LLM fixtures), recorded tests (VCR cassette patterns), and integration tests (LangChain adapter patterns).
**Impact**: Consistent AI-generated tests matching project conventions. Use `/test-rules-generator` to bootstrap.

## Detailed Findings

### Unit Tests

**Score: 9.0/10**

- **414 test files** across `tests/` and `benchmark/tests/` directories
- **119,623 lines of test code** vs 61,695 lines of source code — **1.94:1 test-to-source line ratio** (excellent)
- **Framework**: pytest with pytest-xdist for parallel execution, pytest-recording for VCR cassettes, pytest-cov for coverage, pytest-httpx for HTTP mocking, inline-snapshot for snapshot testing
- **Test isolation**: `UNIT_TEST_ENV` in Makefile explicitly unsets `OPENAI_API_KEY` and `NVIDIA_API_KEY` to prevent live service calls
- **Test markers**: `recorded`, `serial`, `slow`, `perf`, `live`, `vcr`, `fake_cassette`, `real_embeddings`
- **Parallelization**: `pytest-xdist` with `worksteal` distribution strategy, configurable workers
- **Configuration**: Well-structured `pytest.ini` with test paths, markers, and async configuration

**Strengths**:
- Exceptional test-to-code ratio (nearly 2:1 by line count)
- Strong test isolation preventing accidental live API calls
- Multiple test categories with clear marker separation
- Parallel execution with worksteal strategy for optimal balancing

**Minor gaps**:
- Test-to-code file ratio is 1.78:1 (414 test vs 233 source) — strong but room for corner case coverage

### Integration/E2E Tests

**Score: 7.5/10**

- **Integration tests**: `tests/integrations/langchain/` — 20+ test files covering LangChain adapter, tool calling, streaming, middleware
- **Recorded tests**: `tests/recorded/` — VCR cassette-based deterministic replay tests for OpenAI, guardrail rails, streaming
- **Server tests**: `tests/server/` directory with API endpoint tests
- **QA tests**: `qa/` directory with end-to-end guardrail validation tests (topical, jailbreak, moderation, grounding, execution)
- **No cluster-based E2E**: No Kind/Minikube/envtest deployment testing (not applicable — this is a Python library, not a K8s operator)

**Strengths**:
- Comprehensive integration test coverage for LangChain framework
- Recorded cassette tests provide deterministic replay without live API calls
- QA directory with realistic guardrail scenario testing
- Test-docker workflow validates container startup and health

**Gaps**:
- No multi-version Python integration tests in a containerized environment (tests run on bare matrix)
- Server API contract tests could be more formal (OpenAPI schema validation)

### Build Integration

**Score: 8.5/10**

- **PR-time Docker builds**: `test-docker.yml` builds and tests the Docker image on PRs (when Dockerfile/pyproject.toml/uv.lock change)
- **Tekton/Konflux pipelines**: `.tekton/` directory with PR, push, and release pipeline configs building `Dockerfile.server` on multi-arch (x86_64 + arm64)
- **Wheel build + test**: `test-and-build-wheel.yml` builds the wheel, then installs and validates server startup across Python 3.10-3.13
- **Lock file validation**: `uv lock --check` in CI ensures lock file is in sync
- **Makefile targets**: `image-build`, `image-local-build`, `image-kind` for local development
- **GitLab CI**: Full pipeline with test, build, and docker-test stages (legacy/parallel CI)

**Strengths**:
- Tekton/Konflux integration with multi-arch builds on PR
- Wheel distribution testing validates installability across Python versions
- Server startup validation in both Docker and wheel install paths
- Comprehensive Makefile with all build variations

**Gaps**:
- `test-docker.yml` only tests the upstream `Dockerfile`, not `Dockerfile.server` (the fork-specific UBI9 build)
- No kustomize/manifest validation (not applicable for this repo type)

### Image Testing

**Score: 8.0/10**

- **Dockerfile (upstream)**: Single-stage, `python:3.12-slim` base, uv sync, BuildKit cache mounts, HEALTHCHECK with HTTP health endpoint
- **Dockerfile.server (fork)**: Multi-stage UBI9 build (`registry.access.redhat.com/ubi9/python-312`), model pre-download, guardrail profile filtering, non-root user (1001), comprehensive env vars
- **Dockerfile.qa**: Development image with all extras for testing
- **Multi-arch**: Tekton pipeline builds for `linux/x86_64` and `linux-m2xlarge/arm64`
- **Health check**: HEALTHCHECK directive in upstream Dockerfile, `/v1/health` endpoint
- **Runtime validation**: test-docker workflow starts container, waits for readiness, checks HTTP response
- **.dockerignore**: Comprehensive exclusion list

**Strengths**:
- UBI9 base images for FIPS-capable environment (Dockerfile.server)
- Multi-stage builds separating build deps from runtime
- Non-root user in production image
- Model pre-download during build for faster startup
- BuildKit cache mounts for efficient layer caching

**Gaps**:
- Upstream Dockerfile uses `python:3.12-slim` (not UBI9) — different base than production
- No Testcontainers or programmatic container testing framework
- HEALTHCHECK only in upstream Dockerfile, not in Dockerfile.server

### Coverage Tracking

**Score: 9.0/10**

- **Codecov integration**: `.github/codecov.yml` with project and patch coverage configuration
- **Coverage threshold**: `--cov-fail-under=85` enforced in CI (PR tests on Python 3.11)
- **Patch coverage target**: 90% for new code (informational, not blocking)
- **Coverage reporting**: XML output (`coverage.xml`), uploaded to Codecov with `codecov-action`
- **PR coverage**: Coverage change threshold 0.25%, comment layout with diff, flags, files
- **Develop branch**: Dedicated `develop-coverage.yml` workflow for post-merge coverage tracking
- **Make target**: `make test-coverage` with configurable args

**Strengths**:
- 85% minimum coverage threshold enforced as a gate
- 90% patch coverage target for new code
- Dual coverage tracks: PR-time and post-merge (develop branch)
- Detailed PR comment configuration for visibility

**Gaps**:
- Coverage config is at `.github/codecov.yml` (non-standard location, typically root `.codecov.yml`)
- No coverage badge in README (minor)

### CI/CD Automation

**Score: 9.5/10**

- **29 workflow files** in `.github/workflows/`
- **PR-triggered**: pr-tests (multi-Python matrix), lint, pr-fix-regression-proof, pr-size-label, pr-merge-guidance, test-docker (conditional), zizmor
- **Push-triggered**: full-tests (Windows + macOS), develop-coverage, test-and-build-wheel
- **Scheduled**: latest-deps-tests (daily, 3 OS x 4 Python versions), test-docker (weekly), zizmor (weekly), stale issue management
- **Concurrency control**: `pr-fix-regression-proof` uses concurrency groups with cancel-in-progress
- **Caching**: GHA cache for Docker builds (`type=gha`), uv cache via custom setup-uv action, GitLab CI pip/uv caching
- **Matrix testing**: 4 Python versions (3.10-3.13), 3 OS (Ubuntu PR, Windows + macOS on push)
- **Regression proof**: Innovative `pr-fix-regression-proof.yml` that validates fix PRs by running tests with and without the fix
- **Branch management**: Mergify for automated backport (develop → incubation → stable)
- **Tekton**: Konflux pipelines for multi-arch container builds on PR and push
- **GitLab CI**: Parallel CI pipeline with test, build, docker-test stages

**Strengths**:
- Exceptional workflow count and coverage
- Innovative regression proof workflow for fix PRs
- Multi-platform testing (Ubuntu, macOS, Windows)
- Scheduled latest-deps testing catches compatibility issues proactively
- Mergify for automated branch synchronization
- Both GitHub Actions and GitLab CI pipelines

**Minor gaps**:
- No explicit timeout-minutes on some workflows
- Some workflows lack concurrency groups

### Static Analysis

**Score: 8.0/10**

#### Linting
- **Ruff**: Comprehensive `ruff.toml` with lint rules (E4, E7, E9, F, W291-W293, I001-I002), formatting (Black-compatible), line-length 120
- **ty type checker**: Run via pre-commit, covers subset of source (`nemoguardrails/rails/`, `actions/`, `llm/`, `embeddings/`, etc.)
- **Pre-commit hooks** (6 hooks):
  1. `check-yaml` — YAML validation
  2. `end-of-file-fixer` — Trailing newline
  3. `trailing-whitespace` — Whitespace cleanup
  4. `ruff` (lint + fix) — Python linting
  5. `ruff-format` — Python formatting
  6. `insert-license` — Apache 2.0 license headers
  7. `zizmor` — GitHub Actions security scanning
  8. `ty` — Type checking (local hook)

#### FIPS Compatibility
- **Issue**: `hashlib.md5` used in `nemoguardrails/utils.py:407-408` and `nemoguardrails/embeddings/cache.py:68-71`
- **Positive**: `Dockerfile.server` uses UBI9 base images (FIPS-capable)
- **No FIPS build tags** (not applicable for Python)

#### Dependency Alerts
- **Dependabot**: Configured for `github-actions` and `pre-commit` ecosystems with monthly schedule and grouping
- **Gap**: Missing `pip` ecosystem coverage for Python dependency alerts
- **No Renovate**: Not configured (Dependabot is the chosen tool)

#### Workflow Security
- **Zizmor**: GitHub Actions security scanner in CI and pre-commit
- **Pin policy**: Hash-pinning for third-party actions, ref-pinning for official actions
- **CodeRabbit**: AI code review configured with chill profile

### Agent Rules

**Score: 9.0/10**

- **CLAUDE.md** (root): Comprehensive overview with repository layout, git remotes, build/install instructions, test commands, CI description, key fork changes
- **AGENTS.md** (root): Quick rules for contribution workflow, setup instructions, validation command reference, repository map
- **nemoguardrails/AGENTS.md**: Subtree rules for runtime, public-API, and provider-integration code changes — architecture map, code change guidelines, testing requirements
- **nemoguardrails/CLAUDE.md**: Mirrors AGENTS.md content for Claude Code compatibility
- **.agents/skills/**: Two custom skills — `guardrails-developer-guide` and `guardrails-developer-create-guardrails`
- **AI_POLICY.md**: Formal AI-assisted contribution policy
- **CONTRIBUTING.md**: Detailed public contribution workflow
- **.coderabbit.yaml**: AI code review configuration

**Strengths**:
- Multi-layer agent rules (root + subtree) with clear scope
- Architecture maps help AI agents navigate the codebase
- Custom agent skills for domain-specific tasks
- Formal AI policy document
- Clear rules about not submitting PRs via automation

**Gaps**:
- No `.claude/rules/` directory with specific test creation patterns (unit, integration, recorded)
- .claude/ directory exists but is empty — no rules files

## Recommendations

### Priority 0 (Critical)

1. **Replace hashlib.md5 with FIPS-compliant hash**
   - Files: `nemoguardrails/utils.py:407-408`, `nemoguardrails/embeddings/cache.py:68-71`
   - Action: Replace `hashlib.md5` with `hashlib.sha256` or add `usedforsecurity=False` parameter
   - Effort: 2-4 hours
   - Impact: Required for FIPS-enforced deployment environments

2. **Add pip ecosystem to Dependabot**
   - File: `.github/dependabot.yml`
   - Action: Add `package-ecosystem: pip` entry
   - Effort: 30 minutes
   - Impact: Automated Python dependency vulnerability alerts

### Priority 1 (High Value)

3. **Create .claude/rules/ with test creation patterns**
   - Action: Add rules for unit tests (pytest patterns, mock fixtures), recorded tests (VCR cassette patterns), integration tests (LangChain adapter patterns)
   - Effort: 2-3 hours
   - Impact: Consistent AI-generated tests matching project conventions
   - Tool: Use `/test-rules-generator` skill to bootstrap

4. **Add HEALTHCHECK to Dockerfile.server**
   - The upstream Dockerfile has a HEALTHCHECK but the fork-specific Dockerfile.server (used in production) does not
   - Effort: 30 minutes
   - Impact: Container orchestrator can detect unhealthy instances

5. **Add runtime validation for Dockerfile.server in GitHub Actions**
   - Currently `test-docker.yml` only tests the upstream `Dockerfile`, not `Dockerfile.server`
   - Effort: 2-4 hours
   - Impact: Catch fork-specific build issues before merge

### Priority 2 (Nice-to-Have)

6. **Expand ty type checking coverage or add mypy**
   - Currently ty only covers a subset of the source
   - Effort: 4-8 hours
   - Impact: Catch type errors earlier in more modules

7. **Add API contract tests with OpenAPI schema validation**
   - Validate server endpoints against formal API schemas
   - Effort: 4-6 hours
   - Impact: Prevent API regressions in server endpoints

8. **Add coverage badge to README**
   - Effort: 15 minutes
   - Impact: Visibility into project health at a glance

## Comparison to Gold Standards

| Practice | NeMo-Guardrails | odh-dashboard | notebooks | kserve |
|----------|----------------|---------------|-----------|--------|
| Unit test ratio | 1.94:1 (lines) | ~1:1 | N/A | ~0.8:1 |
| Coverage threshold | 85% (enforced) | Variable | N/A | 80% |
| PR coverage gate | Yes (85% fail-under) | Yes | N/A | Yes |
| Multi-version testing | 4 Python versions | N/A | Multi-image | Multi-K8s |
| Multi-OS testing | 3 OS (Ubuntu, macOS, Windows) | Linux only | Linux only | Linux only |
| Agent rules | CLAUDE.md + AGENTS.md + skills | CLAUDE.md + rules | None | None |
| Konflux/Tekton | Yes (multi-arch) | Yes | Yes | No |
| FIPS compliance | Partial (md5 usage) | N/A | Image-level | Build tags |
| Dependabot | Partial (GH Actions only) | Yes (full) | N/A | Yes (full) |
| Pre-commit | 8 hooks | Yes | N/A | Yes |
| Container health | HEALTHCHECK (partial) | N/A | Yes | Yes |
| Regression proof | Yes (innovative) | No | No | No |

## File Paths Reference

### CI/CD
- `.github/workflows/pr-tests.yml` — PR test matrix (4 Python versions)
- `.github/workflows/_test.yml` — Reusable test workflow
- `.github/workflows/lint.yml` — Pre-commit lint check
- `.github/workflows/full-tests.yml` — Windows + macOS tests
- `.github/workflows/test-docker.yml` — Docker image build + runtime test
- `.github/workflows/test-and-build-wheel.yml` — Wheel build + install validation
- `.github/workflows/develop-coverage.yml` — Post-merge coverage tracking
- `.github/workflows/latest-deps-tests.yml` — Daily latest-deps compatibility
- `.github/workflows/pr-fix-regression-proof.yml` — Fix PR regression proof
- `.github/workflows/zizmor.yml` — GH Actions security scanning
- `.gitlab-ci.yml` — GitLab CI pipeline
- `.tekton/` — Konflux/Tekton pipeline configs

### Testing
- `tests/` — Main test directory (364+ test files)
- `tests/integrations/langchain/` — LangChain integration tests
- `tests/recorded/` — VCR cassette-based deterministic replay tests
- `tests/server/` — Server API tests
- `benchmark/tests/` — Benchmark tests
- `qa/` — QA end-to-end guardrail tests
- `pytest.ini` — Pytest configuration
- `conftest.py` — 5 conftest files across test directories

### Code Quality
- `ruff.toml` — Ruff linter/formatter config
- `.pre-commit-config.yaml` — 8 pre-commit hooks
- `.github/codecov.yml` — Codecov coverage config
- `.github/dependabot.yml` — Dependabot (GH Actions + pre-commit)
- `.github/zizmor.yml` — Zizmor action security config
- `.coderabbit.yaml` — CodeRabbit AI review config
- `.mergify.yml` — Mergify auto-backport config

### Container Images
- `Dockerfile` — Upstream image (python:3.12-slim)
- `Dockerfile.server` — Fork-specific UBI9 multi-stage build
- `qa/Dockerfile.qa` — QA/development image
- `.dockerignore` — Docker build exclusions

### Agent Rules
- `CLAUDE.md` — Root-level Claude Code instructions
- `AGENTS.md` — Root-level agent contribution rules
- `nemoguardrails/AGENTS.md` — Subtree agent rules (runtime/API)
- `nemoguardrails/CLAUDE.md` — Subtree Claude Code instructions
- `.agents/skills/` — Custom agent skills (2 skills)
- `AI_POLICY.md` — AI-assisted contribution policy
- `CONTRIBUTING.md` — Public contribution workflow
