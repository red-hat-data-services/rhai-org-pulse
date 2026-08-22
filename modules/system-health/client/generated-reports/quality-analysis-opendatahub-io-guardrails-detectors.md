---
repository: "opendatahub-io/guardrails-detectors"
overall_score: 4.0
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Good test-to-code ratio with 16 test files covering all 3 detector components using pytest"
  - dimension: "Integration/E2E"
    score: 4.0
    status: "FastAPI TestClient integration tests exist but no E2E, no cluster testing, no multi-version"
  - dimension: "Build Integration"
    score: 2.0
    status: "No PR-time Docker builds, no Konflux simulation, no Makefile, no deployment validation"
  - dimension: "Image Testing"
    score: 3.0
    status: "3 Dockerfiles with multi-stage UBI9 builds but no runtime validation or HEALTHCHECK"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "pytest-cov generates reports in CI but no thresholds, no codecov integration, no PR gates"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "3 PR-triggered test workflows with path filtering and caching but no concurrency control"
  - dimension: "Static Analysis"
    score: 2.0
    status: "No linting config, no pre-commit hooks, no Dependabot/Renovate, clean FIPS posture"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory — zero AI agent guidance"
critical_gaps:
  - title: "No PR-time Docker image build validation"
    impact: "Dockerfile syntax errors and dependency issues discovered only after merge in Konflux"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No linting or static analysis configuration"
    impact: "Code style inconsistencies and potential bugs not caught before merge"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No coverage thresholds or PR reporting"
    impact: "Coverage can silently regress with no enforcement or visibility on PRs"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No Dependabot or Renovate for dependency management"
    impact: "Vulnerable or outdated dependencies not automatically flagged"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No concurrency control in CI workflows"
    impact: "Redundant CI runs on rapid pushes waste resources"
    severity: "MEDIUM"
    effort: "1 hour"
quick_wins:
  - title: "Add ruff linter configuration"
    effort: "1-2 hours"
    impact: "Catch style issues, unused imports, and common Python bugs automatically"
  - title: "Enable Dependabot for pip ecosystem"
    effort: "30 minutes"
    impact: "Automated security alerts and dependency update PRs"
  - title: "Add concurrency control to test workflows"
    effort: "30 minutes"
    impact: "Cancel redundant CI runs on rapid pushes, save compute"
  - title: "Create .pre-commit-config.yaml"
    effort: "1 hour"
    impact: "Enforce code quality checks before commits — CI already checks for it"
  - title: "Add codecov integration with thresholds"
    effort: "2 hours"
    impact: "Prevent coverage regression with PR-level enforcement"
recommendations:
  priority_0:
    - "Add PR-time Docker image build validation for all 3 Dockerfiles to catch build issues before merge"
    - "Configure ruff or flake8 linting with CI enforcement to catch code quality issues"
    - "Add coverage thresholds (e.g., 70% minimum) and codecov PR reporting"
  priority_1:
    - "Add Dependabot configuration for pip, docker, and github-actions ecosystems"
    - "Create .pre-commit-config.yaml with ruff, trailing whitespace, and YAML checks"
    - "Add container runtime validation tests using testcontainers or direct docker run"
    - "Add E2E tests that build and run containers, hitting actual HTTP endpoints"
  priority_2:
    - "Create CLAUDE.md with test creation rules and coding standards"
    - "Add HEALTHCHECK directives to all Dockerfiles"
    - "Add multi-architecture build support (amd64/arm64)"
    - "Add concurrency control to all CI workflows"
    - "Add mypy type checking for Python source"
---

# Quality Analysis: guardrails-detectors

**Repository**: [opendatahub-io/guardrails-detectors](https://github.com/opendatahub-io/guardrails-detectors)
**Jira**: RHOAIENG / AI Safety (midstream tier)
**Language**: Python 3.11+ | **Framework**: FastAPI + pytest
**Type**: Microservice collection — detector algorithms for FMS Guardrails Orchestrator
**Analysis Date**: 2026-07-20

## Executive Summary

- **Overall Score: 4.0/10**
- **Key Strengths**: Solid unit test coverage with 16 test files across all 3 detector components (builtIn, huggingface, llm_judge). Good test-to-code ratio (1.49:1 by lines). UBI9 base images with multi-stage Docker builds. Effective path-filtered CI with pip caching.
- **Critical Gaps**: No static analysis or linting. No PR-time Docker build validation. No coverage enforcement. No dependency management automation. No agent rules.
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory.

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 7.0/10 | Good test-to-code ratio with pytest, fixtures, parametrize |
| Integration/E2E | 20% | 4.0/10 | FastAPI TestClient only — no real E2E or cluster testing |
| Build Integration | 15% | 2.0/10 | No PR-time Docker builds, no Konflux simulation |
| Image Testing | 10% | 3.0/10 | Multi-stage UBI9 builds but no runtime validation |
| Coverage Tracking | 10% | 4.0/10 | pytest-cov in CI but no thresholds or PR reporting |
| CI/CD Automation | 15% | 6.0/10 | Path-filtered test workflows with caching, no concurrency control |
| Static Analysis | 10% | 2.0/10 | No linting, no pre-commit hooks, no Dependabot |
| Agent Rules | 5% | 0.0/10 | No agent rules or AI guidance |
| **Overall** | **100%** | **4.0/10** | **Significant gaps across build, analysis, and tooling** |

## Critical Gaps

### 1. No PR-Time Docker Image Build Validation
- **Severity**: HIGH
- **Impact**: The repo has 3 Dockerfiles (`Dockerfile.hf`, `Dockerfile.judge`, `Dockerfile.builtIn`) but none are built or validated in PR workflows. Dockerfile syntax errors, broken dependency installs, or missing files are only discovered after merge when Konflux builds fail.
- **Effort**: 4-8 hours
- **Recommendation**: Add a CI job that runs `docker build` (or `podman build`) for each Dockerfile on every PR.

### 2. No Linting or Static Analysis
- **Severity**: HIGH
- **Impact**: No ruff, flake8, mypy, or any Python linter is configured. The CI composite action (`test-setup/action.yaml`) checks for `.pre-commit-config.yaml` but the file doesn't exist, so linting silently passes. Code style inconsistencies and potential bugs go undetected.
- **Effort**: 2-4 hours
- **Recommendation**: Add `ruff.toml` configuration and a pre-commit config. The CI infrastructure already supports pre-commit — just add the config file.

### 3. No Coverage Thresholds or PR Reporting
- **Severity**: HIGH
- **Impact**: Coverage is generated via `pytest-cov` in all 3 test workflows (`--cov --cov-report=term-missing`) but there are no minimum thresholds and no PR comments. Coverage can regress silently.
- **Effort**: 2-4 hours
- **Recommendation**: Add `--cov-fail-under=70` to pytest commands and integrate codecov-action for PR reporting.

### 4. No Dependency Management Automation
- **Severity**: MEDIUM
- **Impact**: No `.github/dependabot.yml` or Renovate config. Vulnerable or outdated dependencies in `pyproject.toml` are not automatically flagged.
- **Effort**: 1-2 hours

### 5. No Concurrency Control in CI Workflows
- **Severity**: MEDIUM
- **Impact**: Rapid pushes to a PR branch trigger duplicate CI runs. No `concurrency:` blocks to cancel superseded runs.
- **Effort**: 30 minutes

## Quick Wins

### 1. Enable Dependabot (30 minutes)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/detectors"
    schedule:
      interval: "weekly"
  - package-ecosystem: "docker"
    directory: "/detectors"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 2. Add Concurrency Control (30 minutes)
Add to each test workflow:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

### 3. Create .pre-commit-config.yaml (1 hour)
```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
```

### 4. Add Coverage Thresholds (1 hour)
Add `--cov-fail-under=70` to each pytest command in CI workflows and add a `.coveragerc`:
```ini
[run]
source = detectors
omit = tests/*

[report]
fail_under = 70
show_missing = true
```

### 5. Add ruff Configuration (1 hour)
Create `ruff.toml`:
```toml
target-version = "py311"
line-length = 120

[lint]
select = ["E", "F", "W", "I", "UP", "B", "SIM"]
ignore = ["E501"]
```

## Detailed Findings

### Unit Tests

**Score: 7.0/10**

| Metric | Value |
|--------|-------|
| Test files | 16 |
| Source files | 13 |
| Test-to-code ratio (files) | 1.23:1 |
| Test lines | 3,087 |
| Source lines | 2,071 |
| Test-to-code ratio (lines) | 1.49:1 |
| Framework | pytest 8.3.2 |
| Coverage tool | pytest-cov |

**Strengths**:
- Tests well-organized by component: `tests/detectors/builtIn/` (4 files), `tests/detectors/huggingface/` (10 files), `tests/detectors/llm_judge/` (2 files)
- Good use of `@pytest.mark.parametrize` for data-driven tests (e.g., regex pattern matching)
- Shared conftest.py with autouse fixtures for path setup and Prometheus directory management
- HF detector tests use dummy models checked into the repo for reproducible tests
- Method-level test granularity (e.g., `test_method_get_probabilities.py`, `test_method_parse_output.py`)
- FastAPI TestClient used for HTTP endpoint testing
- Mock-based testing for external dependencies (vllm_judge)

**Gaps**:
- No test isolation markers (`pytest.mark.slow`, `pytest.mark.integration`)
- No parallel test execution configured

### Integration/E2E Tests

**Score: 4.0/10**

**What exists**:
- `test_client_integration.py` — FastAPI TestClient tests for HF detector lifespan, including startup, request handling, state leakage, and cleanup
- `test_performance.py` — Concurrency and batch processing tests for LLM Judge detector
- All integration tests use in-process TestClient, not actual HTTP calls

**What's missing**:
- No `e2e/` or `integration/` directory
- No container-level E2E tests (build image → start container → send request → verify response)
- No multi-version testing (e.g., testing with different Python versions or dependency versions)
- No cluster setup (Kind/Minikube) for Kubernetes deployment validation
- No tests for the KServe deployment manifests in `detectors/huggingface/deploy/`

### Build Integration

**Score: 2.0/10**

**What exists**:
- 3 Dockerfiles: `Dockerfile.hf`, `Dockerfile.judge`, `Dockerfile.builtIn`
- All use multi-stage builds with UBI9 base
- Build commands documented in README

**What's missing**:
- No PR-triggered Docker builds in any workflow
- No Makefile with build/test targets
- No Konflux build simulation
- No `docker build --dry-run` or equivalent validation
- No image startup testing
- No Kustomize overlay validation (despite KServe deploy manifests existing)
- No `kubectl apply --dry-run` for deployment manifests

### Image Testing

**Score: 3.0/10**

**What exists**:
- Multi-stage Docker builds for all 3 detector types
- UBI9 base images (`registry.access.redhat.com/ubi9/python-312:latest`) — FIPS-capable
- Appropriate EXPOSE directives
- USER 1001 (non-root) in HF Dockerfile

**What's missing**:
- No HEALTHCHECK directives in any Dockerfile
- No container runtime validation tests
- No testcontainers usage
- No `.dockerignore` file
- No multi-architecture support (no `--platform`, no `docker buildx`)
- No image size optimization beyond multi-stage builds
- `Dockerfile.judge` and `Dockerfile.builtIn` don't set a non-root USER

### Coverage Tracking

**Score: 4.0/10**

**What exists**:
- `pytest-cov>=4.0` in dev dependencies
- All 3 CI workflows run pytest with `--cov=detectors.<component>` and `--cov-report=term-missing`
- tox.ini configured with `--cov=detectors --cov-report=term-missing`
- `coverage==7.6.1` pinned in dev dependencies

**What's missing**:
- No `.codecov.yml` or `codecov.yml`
- No coverage thresholds (`--cov-fail-under` not used)
- No PR coverage reporting (no codecov-action or coverage comment bot)
- No `.coveragerc` configuration
- No coverage gates in CI — tests pass regardless of coverage level

### CI/CD Automation

**Score: 6.0/10**

**Workflow Inventory** (6 workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test-builtin-detectors.yaml` | PR + push (path-filtered) | Built-in detector unit tests |
| `test-huggingface-runtime.yaml` | PR + push (path-filtered) | HF runtime unit tests + model loading |
| `test-llm-judge.yaml` | PR + push (path-filtered) | LLM Judge unit tests + init verification |
| `security-scan.yaml` | PR + push + schedule + dispatch | Trivy vulnerability scanning |
| `sync-branch-incubation.yaml` | push to main | Sync main → incubation |
| `sync-branch-stable.yaml` | push to incubation | Sync incubation → stable |

**Strengths**:
- Path-filtered triggers avoid unnecessary CI runs
- Shared composite action (`.github/actions/test-setup/`) for DRY setup
- Pip caching via `actions/cache@v4` with hash-based keys
- Timeout-minutes set on long-running jobs (HF: 20min, LLM Judge: 15min)
- Mergify for automated branch sync (`main → incubation → stable`)
- Weekly scheduled security scans

**Gaps**:
- No `concurrency:` blocks — duplicate runs on rapid pushes
- No test parallelization (no matrix splitting, no pytest-xdist)
- Single Python version in matrix (only 3.11) — no multi-version testing
- No required status checks configuration visible

### Static Analysis

**Score: 2.0/10**

#### Linting
- **No linting configuration**: No ruff.toml, .flake8, mypy.ini, or any Python linter config
- The CI composite action checks for `.pre-commit-config.yaml` and runs pre-commit if found, but the file doesn't exist — linting silently skips with `continue-on-error: true`
- No type annotations enforcement despite Python 3.11+ target

#### FIPS Compatibility
- **Clean posture**: No FIPS-problematic crypto imports found (`hashlib.md5`, `Crypto.Cipher.*`, etc.)
- **UBI9 base images**: All Dockerfiles use `registry.access.redhat.com/ubi9/python-312:latest` (FIPS-capable)
- No Go code, so FIPS build tags not applicable
- Overall: FIPS-ready from a base image perspective

#### Dependency Alerts
- **No Dependabot**: No `.github/dependabot.yml` file
- **No Renovate**: No `renovate.json`, `.renovaterc`, or `.renovaterc.json`
- Dependencies are pinned in `pyproject.toml` (e.g., `fastapi==0.136.3`, `torch==2.11.0`) but updates are manual-only

### Agent Rules

**Score: 0.0/10**

- No `CLAUDE.md` or `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` test creation rules
- No `.claude/skills/` custom skills
- No test automation guidance for AI agents

**Recommendation**: Generate test creation rules using `/test-rules-generator` to provide AI agents with framework-specific testing patterns for pytest, FastAPI TestClient, and mock patterns used in this repo.

## Recommendations

### Priority 0 (Critical)

1. **Add PR-time Docker build validation** — Add a workflow that builds all 3 Dockerfiles on PRs to catch build failures before merge. This is the most impactful gap.
2. **Configure Python linting** — Add ruff configuration and enforce in CI. The infrastructure (composite action with pre-commit support) is already there; only the config file is missing.
3. **Add coverage thresholds** — Add `--cov-fail-under=70` to pytest commands and integrate codecov for PR reporting.

### Priority 1 (High Value)

4. **Add Dependabot** — Enable for pip, docker, and github-actions ecosystems.
5. **Create .pre-commit-config.yaml** — Add ruff, trailing-whitespace, check-yaml, and check-added-large-files hooks.
6. **Add container E2E tests** — Build container images and run basic health checks (HTTP GET on health endpoint) in CI.
7. **Add concurrency control** — Add `concurrency:` blocks to all test workflows.

### Priority 2 (Nice-to-Have)

8. **Create CLAUDE.md** — Document test patterns, coding standards, and quality expectations for AI agents.
9. **Add HEALTHCHECK** — Add HEALTHCHECK directives to all 3 Dockerfiles.
10. **Add multi-arch support** — Enable `docker buildx` for amd64/arm64 builds.
11. **Add mypy** — Enable type checking for Python source.
12. **Add .dockerignore** — Exclude test files, docs, and .git from Docker build context.

## Comparison to Gold Standards

| Practice | guardrails-detectors | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|----------|---------------------|---------------------|------------------|---------------|
| Unit test ratio | 1.49:1 (lines) | >1.5:1 | N/A | >1.5:1 |
| Integration/E2E | TestClient only | Multi-layer + contract | 5-layer validation | envtest + E2E |
| Coverage enforcement | None | Codecov with thresholds | Threshold gates | Codecov + gates |
| PR Docker builds | None | Image build + test | Multi-image pipeline | Image validation |
| Linting | None | ESLint + strict TS | Linting + format | golangci-lint |
| Pre-commit | None | Enforced | Enforced | Enforced |
| Dependency alerts | None | Dependabot | Dependabot | Dependabot |
| FIPS readiness | UBI9 base (good) | UBI base | UBI + FIPS tags | UBI + boringcrypto |
| Agent rules | None | Comprehensive | Present | Present |
| CI concurrency | None | Controlled | Controlled | Controlled |

## File Paths Reference

### CI/CD
- `.github/workflows/test-builtin-detectors.yaml` — Built-in detector tests
- `.github/workflows/test-huggingface-runtime.yaml` — HF runtime tests
- `.github/workflows/test-llm-judge.yaml` — LLM Judge tests
- `.github/workflows/security-scan.yaml` — Trivy security scanning
- `.github/workflows/sync-branch-incubation.yaml` — Branch sync main→incubation
- `.github/workflows/sync-branch-stable.yaml` — Branch sync incubation→stable
- `.github/actions/test-setup/action.yaml` — Shared CI setup composite action

### Source Code
- `detectors/pyproject.toml` — Project dependencies and config
- `detectors/built_in/` — Built-in detector source (regex, file type, custom)
- `detectors/huggingface/` — HuggingFace detector source
- `detectors/llm_judge/` — LLM Judge detector source
- `detectors/common/` — Shared code (app base, scheme, instrumentation)

### Tests
- `tests/conftest.py` — Shared fixtures
- `tests/detectors/builtIn/` — 4 test files for built-in detectors
- `tests/detectors/huggingface/` — 10 test files for HF detector
- `tests/detectors/llm_judge/` — 2 test files for LLM Judge
- `tests/dummy_models/` — Test model fixtures (BERT, GPT2)

### Container Images
- `detectors/Dockerfile.hf` — HuggingFace detector image (UBI9)
- `detectors/Dockerfile.judge` — LLM Judge detector image (UBI9)
- `detectors/Dockerfile.builtIn` — Built-in detector image (UBI9)
- `detectors/huggingface/deploy/` — KServe deployment manifests

### Configuration (Missing)
- `.codecov.yml` — NOT PRESENT
- `.pre-commit-config.yaml` — NOT PRESENT
- `.github/dependabot.yml` — NOT PRESENT
- `ruff.toml` / `.flake8` / `mypy.ini` — NOT PRESENT
- `CLAUDE.md` / `AGENTS.md` — NOT PRESENT
- `.dockerignore` — NOT PRESENT
- `Makefile` — NOT PRESENT
