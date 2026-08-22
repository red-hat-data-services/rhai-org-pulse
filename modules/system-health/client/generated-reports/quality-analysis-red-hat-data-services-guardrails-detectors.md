---
repository: "red-hat-data-services/guardrails-detectors"
overall_score: 5.5
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Good test suite with 16 test files, strong test-to-code ratio (1.4:1 lines), pytest with parametrized tests"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "Limited to FastAPI TestClient integration tests; no E2E, cluster, or multi-version testing"
  - dimension: "Build Integration"
    score: 7.0
    status: "Konflux PR builds configured via Tekton for HF and built-in detectors; multi-arch support; no LLM Judge Konflux pipeline"
  - dimension: "Image Testing"
    score: 5.0
    status: "Multiple Dockerfiles with UBI9 base images and multi-arch support; no runtime validation or health checks"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "pytest-cov runs in CI with term-missing output; no codecov integration, no thresholds, no PR reporting"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "3 test workflows + security scan; path-filtered PR triggers; pip caching via shared action; no concurrency control"
  - dimension: "Static Analysis"
    score: 3.5
    status: "Pre-commit referenced in shared action but no .pre-commit-config.yaml in repo; no linter config; no Dependabot/Renovate"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory present"
critical_gaps:
  - title: "No coverage threshold enforcement or PR coverage reporting"
    impact: "Coverage can silently regress without anyone noticing; no gate prevents low-coverage merges"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No integration or E2E testing against real services"
    impact: "Detector behavior with actual HuggingFace models and vLLM endpoints is only validated by basic import checks, not functional tests"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No linting configuration (ruff, flake8, mypy) defined in repo"
    impact: "Code style and type safety are not enforced; pre-commit hook references in CI will silently skip when no config exists"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No dependency update automation (Dependabot/Renovate)"
    impact: "Vulnerable or outdated dependencies must be discovered and updated manually"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "Missing .pre-commit-config.yaml despite CI references"
    impact: "The shared test-setup action tries to run pre-commit but skips silently when config is absent"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No Konflux build pipeline for LLM Judge detector"
    impact: "LLM Judge container builds are not validated on PR; build issues discovered post-merge"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add .codecov.yml with coverage thresholds and PR commenting"
    effort: "2-3 hours"
    impact: "Automated coverage tracking with regression prevention on every PR"
  - title: "Enable Dependabot for pip ecosystem"
    effort: "1 hour"
    impact: "Automated dependency vulnerability alerts and update PRs"
  - title: "Add ruff configuration to pyproject.toml"
    effort: "2 hours"
    impact: "Fast, comprehensive Python linting with auto-fix capability"
  - title: "Create .pre-commit-config.yaml with ruff and basic hooks"
    effort: "1-2 hours"
    impact: "Enforce linting and formatting before code reaches CI"
  - title: "Add concurrency control to GitHub Actions workflows"
    effort: "30 minutes"
    impact: "Prevent redundant CI runs on rapid PR updates"
  - title: "Create basic CLAUDE.md with test patterns and project context"
    effort: "2-3 hours"
    impact: "Improve AI-assisted development consistency and test quality"
recommendations:
  priority_0:
    - "Add codecov integration with minimum coverage thresholds (e.g., 70%) to prevent silent regression"
    - "Create .pre-commit-config.yaml with ruff linter and add ruff config to pyproject.toml for static analysis enforcement"
    - "Enable Dependabot for pip dependency monitoring (.github/dependabot.yml)"
  priority_1:
    - "Add a Tekton/Konflux PR pipeline for the LLM Judge detector image"
    - "Implement integration tests that validate detector startup, health endpoints, and basic inference with dummy models inside containers"
    - "Add concurrency control (concurrency: group/cancel-in-progress) to all GitHub Actions workflows"
    - "Add .dockerignore to reduce build context size and prevent leaking test data into images"
  priority_2:
    - "Create CLAUDE.md and .claude/rules/ for AI-assisted test and code generation guidance"
    - "Add container health checks (HEALTHCHECK instruction) to Dockerfiles"
    - "Consider adding mypy for type checking (type hints already present in LLM Judge tests)"
    - "Add performance regression testing CI for detector inference latency"
---

# Quality Analysis: guardrails-detectors

## Executive Summary

- **Overall Score: 5.5/10**
- **Repository**: `red-hat-data-services/guardrails-detectors` (downstream, AI Safety / RHOAIENG)
- **Type**: Python library/microservice - collection of AI guardrail detectors (built-in regex/file-type, HuggingFace model-based, LLM Judge)
- **Primary Language**: Python 3.11+
- **Framework**: FastAPI + pytest
- **Key Strengths**: Good unit test coverage with parametrized tests across all 3 detector types; well-structured Konflux multi-arch build pipelines; UBI9 base images for FIPS-capable builds; reusable GitHub Actions composite action for test setup
- **Critical Gaps**: No coverage threshold enforcement or PR reporting; no linting configuration despite pre-commit CI references; no Dependabot/Renovate; no E2E or container runtime testing; no agent rules
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 7.5/10 | 15% | 1.13 | Good test suite with 16 test files, strong test-to-code ratio |
| Integration/E2E | 3.0/10 | 20% | 0.60 | Limited to FastAPI TestClient; no real E2E or multi-version testing |
| Build Integration | 7.0/10 | 15% | 1.05 | Konflux PR builds for 2 of 3 detectors; multi-arch (x86, arm64, ppc64le, s390x) |
| Image Testing | 5.0/10 | 10% | 0.50 | Multiple Dockerfiles with UBI9; no runtime validation or health checks |
| Coverage Tracking | 4.0/10 | 10% | 0.40 | pytest-cov in CI but no codecov, no thresholds, no PR reporting |
| CI/CD Automation | 6.0/10 | 15% | 0.90 | Path-filtered workflows with caching; no concurrency control |
| Static Analysis | 3.5/10 | 10% | 0.35 | Pre-commit referenced but missing config; no linter; no dependency alerts |
| Agent Rules | 0.0/10 | 5% | 0.00 | No CLAUDE.md, AGENTS.md, or .claude/ directory |
| **Overall** | **5.5/10** | **100%** | **4.93** | |

## Critical Gaps

### 1. No Coverage Threshold Enforcement or PR Reporting
- **Severity**: HIGH
- **Impact**: Coverage can silently regress without anyone noticing. No gate prevents low-coverage code from merging. Current `pytest-cov` output goes to terminal only.
- **Effort**: 4-6 hours
- **Current State**: All 3 test workflows run `pytest --cov=detectors.{component} --cov-report=term-missing` but results are not persisted, uploaded, or enforced.

### 2. No Integration or E2E Testing Against Real Services
- **Severity**: HIGH
- **Impact**: Detectors are only tested with mocked dependencies. The HuggingFace detector is validated with dummy models via `TestClient`, but there are no tests that deploy a container image and verify end-to-end behavior with real model loading.
- **Effort**: 16-24 hours
- **Current State**: `test_client_integration.py` uses FastAPI's `TestClient` (in-process), and `test_llm_judge_detector.py` uses extensive mocking of `vllm_judge.Judge`. No container-based or cluster-based testing.

### 3. No Linting Configuration in Repository
- **Severity**: MEDIUM
- **Impact**: Code style and type safety are not enforced. The shared `test-setup` action references pre-commit but the check is `continue-on-error: true` and no `.pre-commit-config.yaml` exists.
- **Effort**: 2-4 hours
- **Current State**: No ruff, flake8, mypy, pylint, or any linting tool configured. `pyproject.toml` has no `[tool.ruff]`, `[tool.mypy]`, or similar sections.

### 4. No Dependency Update Automation
- **Severity**: MEDIUM
- **Impact**: Vulnerable or outdated dependencies (FastAPI, torch, transformers, etc.) must be discovered and updated manually. This is especially critical given pinned versions throughout `pyproject.toml`.
- **Effort**: 1-2 hours
- **Current State**: No `.github/dependabot.yml`, `renovate.json`, or equivalent configuration.

### 5. Missing Konflux Pipeline for LLM Judge Detector
- **Severity**: MEDIUM
- **Impact**: HF and built-in detectors have Tekton PR pipelines in `.tekton/`, but LLM Judge detector (`Dockerfile.judge`) has no corresponding Konflux build validation.
- **Effort**: 4-6 hours

## Quick Wins

### 1. Add Codecov Integration (2-3 hours)
```yaml
# .codecov.yml
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
Add `codecov/codecov-action@v4` step to each test workflow after pytest runs.

### 2. Enable Dependabot (1 hour)
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/detectors"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 3. Add Ruff Configuration (2 hours)
Add to `detectors/pyproject.toml`:
```toml
[tool.ruff]
target-version = "py311"
line-length = 120

[tool.ruff.lint]
select = ["E", "F", "W", "I", "N", "UP", "B", "A", "SIM"]
```

### 4. Create .pre-commit-config.yaml (1-2 hours)
```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.0
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

### 5. Add Concurrency Control (30 minutes)
Add to each workflow file:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 6. Create Basic CLAUDE.md (2-3 hours)
Use `/test-rules-generator` skill to bootstrap agent rules based on existing test patterns.

## Detailed Findings

### Unit Tests

**Score: 7.5/10**

**Strengths:**
- 16 test files covering all 3 detector components (built-in: 4, HuggingFace: 10, LLM Judge: 2)
- Strong test-to-code ratio: 3,041 lines of test code vs 2,131 lines of source code (1.4:1)
- Excellent use of `pytest.mark.parametrize` for combinatorial testing (regex patterns, credit card formats, file types)
- Good test isolation with fixtures and mock patterns
- Proper use of `unittest.mock.AsyncMock` for async detector testing
- Dummy models (`tests/dummy_models/bert/`, `tests/dummy_models/gpt2/`) for deterministic HuggingFace testing
- Approximately 161 test functions total (53 built-in + 81 HuggingFace + 27 LLM Judge)

**Areas for Improvement:**
- No explicit `pytest.ini` or `[tool.pytest.ini_options]` in `pyproject.toml` (config lives in `tox.ini`)
- Test organization by method name (`test_method_process_token_classification.py`) rather than feature/behavior
- Performance tests (`test_performance.py`) exist but limited to concurrency simulation with mocks
- `conftest.py` uses `print()` for path setup diagnostics (should use logging)

**Key Files:**
- `tests/detectors/builtIn/test_regex.py` - 16 parametrized tests covering email, IP, SSN, phone, credit card patterns
- `tests/detectors/builtIn/test_filetype.py` - 24 tests for file type detection (HTML, JSON, XML, YAML, Markdown, CSV)
- `tests/detectors/huggingface/test_method_process_token_classification.py` - 33 tests for token classification processing
- `tests/detectors/llm_judge/test_llm_judge_detector.py` - 24 tests covering content and generation analysis

### Integration/E2E Tests

**Score: 3.0/10**

**What Exists:**
- `tests/detectors/huggingface/test_client_integration.py` - FastAPI `TestClient` integration tests (4 tests) that validate lifespan, request handling, multiple requests, and cleanup
- HF workflow has a "Test model loading capabilities" step that imports and initializes the detector
- LLM Judge workflow verifies `vllm-judge` import and detector initialization

**What's Missing:**
- No `e2e/` or `integration/` directories
- No container-based integration tests (no `docker run`, `testcontainers`, or `docker-compose`)
- No cluster testing (no Kind, Minikube, or envtest)
- No multi-version testing (single Python 3.11 matrix)
- No tests that validate detectors against actual external LLM services
- No API contract tests between detectors and the FMS Guardrails Orchestrator

### Build Integration

**Score: 7.0/10**

**Strengths:**
- Tekton/Konflux PR pipelines for 2 of 3 detectors:
  - `odh-guardrails-detector-huggingface-runtime-pull-request.yaml` - multi-arch (x86_64, arm64, ppc64le, s390x)
  - `odh-built-in-detector-pull-request.yaml` - multi-arch (same 4 platforms)
- Hermetic builds (`hermetic: true`) for supply chain security
- Prefetch-input configuration for dependency caching
- Cancel-in-progress enabled (`pipelinesascode.tekton.dev/cancel-in-progress: "true"`)
- Label-based and comment-based build triggers (`/build-konflux guardrails-detector-hf-runtime`)
- `.konflux/base-images.conf` for centralized base image version management
- Makefile with `uv pip compile` for reproducible, hashed requirements

**Gaps:**
- No Tekton pipeline for LLM Judge detector (`Dockerfile.judge`)
- No PR-time unit test execution in Tekton pipelines (tests run only in GitHub Actions)
- No dry-run or manifest validation steps

### Image Testing

**Score: 5.0/10**

**Strengths:**
- 5 Dockerfiles covering 3 detector types and 2 build modes (dev/Konflux)
- UBI9 base images (`registry.access.redhat.com/ubi9/python-312:latest`) for FIPS capability
- Multi-stage builds in all Dockerfiles
- Multi-architecture support in Konflux builds (x86_64, arm64, ppc64le, s390x)
- Non-root user (`USER 1001`) in most Dockerfiles
- Separate CUDA and CPU base images for HF Konflux builds

**Gaps:**
- No `.dockerignore` file - build context includes tests, docs, and git history
- No `HEALTHCHECK` instruction in any Dockerfile
- No container runtime validation tests (no `docker run` + health check in CI)
- No image startup testing beyond basic Python import in CI
- `Dockerfile.hf` and `Dockerfile.builtIn` use `latest` tag (non-deterministic)
- `Dockerfile.builtIn` runs as root (no explicit `USER` directive after `FROM builder`)

### Coverage Tracking

**Score: 4.0/10**

**What Exists:**
- All 3 test workflows use `pytest-cov`:
  - `--cov=detectors.built_in` / `--cov=detectors.huggingface` / `--cov=detectors.llm_judge`
  - `--cov-report=term-missing` for terminal output
- `tox.ini` configures `--cov=detectors --cov-report=term-missing`
- `coverage==7.6.1` and `pytest-cov>=4.0` in dev dependencies

**What's Missing:**
- No `.codecov.yml` or `codecov.yml`
- No `codecov/codecov-action` in any workflow
- No coverage threshold enforcement (`--cov-fail-under`)
- No coverage report upload or PR commenting
- No XML/JSON/HTML coverage report generation for persistence
- Coverage reports are terminal-only, lost after CI run completes

### CI/CD Automation

**Score: 6.0/10**

**Strengths:**
- 4 GitHub Actions workflows:
  - `test-builtin-detectors.yaml` - PR + push on main/incubation/stable
  - `test-huggingface-runtime.yaml` - PR + push with timeout controls
  - `test-llm-judge.yaml` - PR + push with timeout controls
  - `security-scan.yaml` - PR + push + weekly schedule + manual dispatch
- Smart path filtering to avoid unnecessary CI runs
- Reusable composite action (`.github/actions/test-setup/action.yaml`) with pip caching
- Timeout controls on expensive steps (`timeout-minutes: 20` for HF, `15` for LLM Judge)
- Matrix strategy (Python 3.11) ready for multi-version expansion

**Gaps:**
- No `concurrency:` block in any workflow - rapid PR updates trigger redundant runs
- No test parallelization or sharding
- Only single Python version in matrix (3.11)
- No separate workflow for PR vs. push (combined in each)
- `continue-on-error: true` on pre-commit step masks linting failures
- Security scan uses `exit-code: '0'` which never fails the build on findings

### Static Analysis

**Score: 3.5/10**

#### Linting
- **No linting configuration found**: No ruff, flake8, pylint, mypy, or any Python linter configured
- `pyproject.toml` has no `[tool.ruff]`, `[tool.mypy]`, `[tool.flake8]`, or similar sections
- The shared `test-setup` action checks for `.pre-commit-config.yaml` and runs pre-commit if found, but the file does not exist in the repo
- `pre-commit==3.8.0` is listed in dev dependencies but unusable without config

#### FIPS Compatibility
- **Good**: All Dockerfiles use UBI9 base images (`registry.access.redhat.com/ubi9/python-312:latest`)
- **Good**: Konflux builds use `quay.io/aipcc/base-images/` which are FIPS-capable
- **Good**: No non-FIPS crypto imports found (no `hashlib.md5`, `crypto/md5`, etc.)
- **Note**: No explicit FIPS build tags, but Python on UBI9 uses system OpenSSL which is FIPS-validated

#### Dependency Alerts
- **Missing**: No `.github/dependabot.yml`
- **Missing**: No `renovate.json` or `.renovaterc`
- **Risk**: Pinned dependency versions (`torch==2.11.0`, `transformers==4.57.3`, `fastapi==0.136.3`) need manual monitoring for security updates

### Agent Rules

**Score: 0.0/10**

- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **Coverage**: No test type rules, no framework-specific examples, no quality gate checklists
- **Recommendation**: Generate rules with `/test-rules-generator` covering:
  - pytest patterns for each detector type
  - Mock patterns for vllm_judge, HuggingFace transformers
  - FastAPI TestClient usage for API testing
  - Parametrized test patterns for regex/file-type detectors

## Recommendations

### Priority 0 (Critical)

1. **Add codecov integration with coverage thresholds** - Configure `.codecov.yml` with project target of 70% and patch target of 80%. Add `codecov/codecov-action@v4` to all test workflows. Add `--cov-fail-under=70` to pytest commands.

2. **Create .pre-commit-config.yaml and add ruff configuration** - Add `[tool.ruff]` to `pyproject.toml` with appropriate rule selection. Create `.pre-commit-config.yaml` with ruff hooks. Remove `continue-on-error: true` from pre-commit step in test-setup action.

3. **Enable Dependabot for pip and GitHub Actions ecosystems** - Create `.github/dependabot.yml` covering the `detectors/` directory for pip and root for GitHub Actions.

### Priority 1 (High Value)

4. **Add Konflux pipeline for LLM Judge detector** - Create `.tekton/odh-llm-judge-detector-pull-request.yaml` mirroring the existing HF and built-in detector pipelines.

5. **Implement container-based integration tests** - Add tests that build and run detector containers with `docker-compose` or `testcontainers`, validate health endpoints, and test basic inference with dummy models.

6. **Add concurrency control to all workflows** - Add `concurrency: { group: "${{ github.workflow }}-${{ github.ref }}", cancel-in-progress: true }` to prevent redundant CI runs.

7. **Add .dockerignore file** - Exclude `tests/`, `docs/`, `.github/`, `.tekton/`, `.git/`, `tox.ini` from build context.

### Priority 2 (Nice-to-Have)

8. **Create CLAUDE.md and .claude/rules/** - Document test patterns, project structure, and detector-specific testing guidance for AI-assisted development.

9. **Add HEALTHCHECK to Dockerfiles** - Add `HEALTHCHECK CMD curl -f http://localhost:8000/health || exit 1` (or equivalent health endpoint).

10. **Add mypy type checking** - Type hints already exist in LLM Judge tests; formalize with mypy configuration in `pyproject.toml`.

11. **Expand Python version matrix** - Test against Python 3.12 in addition to 3.11 to validate compatibility with Dockerfile base images (UBI9 python-312).

12. **Add API contract tests** - Validate detector request/response schemas against the FMS Guardrails Orchestrator specification.

## Comparison to Gold Standards

| Dimension | guardrails-detectors | odh-dashboard | notebooks | kserve |
|-----------|---------------------|---------------|-----------|--------|
| Unit Tests | 7.5 - Good ratio, parametrized | 9.0 - Jest + Cypress | 7.0 - Notebook validation | 8.5 - Go testing + table-driven |
| Integration/E2E | 3.0 - TestClient only | 9.0 - Multi-layer + contract | 8.0 - Multi-image E2E | 9.0 - envtest + Kind |
| Build Integration | 7.0 - Konflux for 2/3 detectors | 8.0 - PR builds + federation | 8.5 - Multi-arch + validation | 7.5 - PR image builds |
| Image Testing | 5.0 - UBI9 but no runtime tests | 7.0 - Container validation | 9.0 - 5-layer validation | 6.0 - Basic image testing |
| Coverage Tracking | 4.0 - pytest-cov, no enforcement | 8.5 - Codecov with gates | 6.0 - Basic coverage | 8.0 - Codecov enforcement |
| CI/CD Automation | 6.0 - Path-filtered, cached | 9.0 - Full automation | 8.0 - Comprehensive CI | 8.5 - Matrix + caching |
| Static Analysis | 3.5 - No linter config | 8.0 - ESLint + Prettier | 6.5 - Basic linting | 8.0 - golangci-lint |
| Agent Rules | 0.0 - None | 8.0 - Comprehensive | 3.0 - Basic | 2.0 - Minimal |
| **Overall** | **5.5** | **8.5** | **7.0** | **7.5** |

## File Paths Reference

### CI/CD Configuration
- `.github/workflows/test-builtin-detectors.yaml` - Built-in detector unit tests
- `.github/workflows/test-huggingface-runtime.yaml` - HuggingFace detector tests
- `.github/workflows/test-llm-judge.yaml` - LLM Judge detector tests
- `.github/workflows/security-scan.yaml` - Trivy security scanning
- `.github/actions/test-setup/action.yaml` - Reusable composite action

### Tekton/Konflux
- `.tekton/odh-guardrails-detector-huggingface-runtime-pull-request.yaml`
- `.tekton/odh-built-in-detector-pull-request.yaml`
- `.konflux/base-images.conf`

### Container Images
- `detectors/Dockerfile.hf` - HuggingFace detector (dev)
- `detectors/Dockerfile.builtIn` - Built-in detector (dev)
- `detectors/Dockerfile.judge` - LLM Judge detector (dev)
- `detectors/Dockerfile.konflux.hf` - HuggingFace detector (Konflux multi-arch)
- `detectors/Dockerfile.konflux.builtIn` - Built-in detector (Konflux)

### Source Code
- `detectors/pyproject.toml` - Project configuration and dependencies
- `detectors/Makefile` - Requirements compilation with uv
- `detectors/common/` - Shared detector framework (scheme, app, instrumentation)
- `detectors/built_in/` - Regex, file-type, and custom detectors
- `detectors/huggingface/` - HuggingFace model-based detector
- `detectors/llm_judge/` - vLLM Judge-based detector

### Tests
- `tests/conftest.py` - Shared fixtures (path setup, Prometheus dir)
- `tests/detectors/builtIn/` - 4 test files (53 tests)
- `tests/detectors/huggingface/` - 10 test files (81 tests)
- `tests/detectors/llm_judge/` - 2 test files (27 tests)
- `tests/dummy_models/` - Dummy BERT and GPT2 models for testing
- `tox.ini` - Test runner configuration
