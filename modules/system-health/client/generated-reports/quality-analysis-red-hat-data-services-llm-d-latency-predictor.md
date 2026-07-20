---
repository: "red-hat-data-services/llm-d-latency-predictor"
overall_score: 4.6
scorecard:
  - dimension: "Unit Tests"
    score: 2.0
    status: "No true unit tests; only integration tests that require running servers"
  - dimension: "Integration/E2E"
    score: 5.0
    status: "Solid integration test suite (40 tests) but no automated orchestration or cluster-level E2E"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR container builds for all 3 services, Konflux pipelines with multi-arch, but no kustomize validation"
  - dimension: "Image Testing"
    score: 5.0
    status: "Multi-arch support, hadolint linting, K8s health probes, but no runtime validation or HEALTHCHECK"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage configuration, thresholds, or PR reporting whatsoever"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "Well-organized CI with Prow, signed commits, Tekton pipelines, but no test execution in CI"
  - dimension: "Static Analysis"
    score: 7.0
    status: "Ruff + pre-commit hooks + Dependabot + Renovate, but hashlib.md5 FIPS concern and no type checker"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No unit tests — only integration tests exist"
    impact: "Business logic in prediction/training servers (3,500+ lines) has zero isolated unit test coverage; regressions in ML model training, prediction logic, or data validation go undetected until full integration"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "Zero coverage tracking"
    impact: "No visibility into what code is tested; PRs can merge with zero test coverage and no one is alerted"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Tests never run in CI"
    impact: "The 40 integration tests exist but are never executed in any PR or merge workflow — the test Dockerfile is built but never run"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "hashlib.md5 usage in prediction server (FIPS concern)"
    impact: "prediction/prediction_server.py:118 uses hashlib.md5() which is not FIPS-compliant; will fail in FIPS-enforced environments"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add pytest-cov and codecov integration"
    effort: "2-4 hours"
    impact: "Immediate visibility into test coverage with PR-level reporting and threshold enforcement"
  - title: "Add HEALTHCHECK to Dockerfiles"
    effort: "1 hour"
    impact: "Container orchestrators can detect unhealthy containers without K8s probes"
  - title: "Replace hashlib.md5 with hashlib.sha256"
    effort: "30 minutes"
    impact: "FIPS-compliant hashing; drop-in replacement"
  - title: "Create CLAUDE.md with test creation rules"
    effort: "2-3 hours"
    impact: "AI agents generate consistent, framework-appropriate tests"
recommendations:
  priority_0:
    - "Write unit tests for prediction_server.py and training_server.py business logic (model training, prediction, data validation)"
    - "Add pytest-cov with coverage thresholds and codecov integration"
    - "Execute tests in CI — either run pytest in the PR workflow or orchestrate the test container against ephemeral servers"
  priority_1:
    - "Add mypy or pyright for type checking (the codebase already uses type annotations extensively)"
    - "Replace hashlib.md5 with hashlib.sha256 for FIPS compliance"
    - "Add kustomize build --dry-run validation in PR workflow"
    - "Create comprehensive agent rules (CLAUDE.md, .claude/rules/)"
  priority_2:
    - "Add multi-stage builds to reduce image size"
    - "Add HEALTHCHECK directives to Dockerfiles"
    - "Add pip caching to GitHub Actions workflows"
    - "Add performance regression tests for prediction latency"
---

# Quality Analysis: llm-d-latency-predictor

## Executive Summary

- **Overall Score: 4.6/10**
- **Repository**: [red-hat-data-services/llm-d-latency-predictor](https://github.com/red-hat-data-services/llm-d-latency-predictor)
- **Type**: Python ML service (FastAPI prediction + training servers)
- **Language**: Python 3.11
- **Tier**: Downstream (INFERENG / llm-d)
- **Key Strengths**: Strong CI/CD foundation with Konflux pipelines, comprehensive pre-commit hooks, both Dependabot and Renovate, PR container builds for all services
- **Critical Gaps**: No unit tests, zero coverage tracking, tests never execute in CI, FIPS-noncompliant hashing
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 2.0/10 | 15% | 0.30 | No true unit tests; only integration tests requiring live servers |
| Integration/E2E | 5.0/10 | 20% | 1.00 | 40 integration tests exist but never run in CI |
| Build Integration | 7.0/10 | 15% | 1.05 | PR container builds + Konflux pipelines, no kustomize validation |
| Image Testing | 5.0/10 | 10% | 0.50 | Multi-arch + hadolint, no runtime validation |
| Coverage Tracking | 0.0/10 | 10% | 0.00 | No coverage configuration at all |
| CI/CD Automation | 7.0/10 | 15% | 1.05 | Well-organized workflows, Prow, Tekton, but no test execution |
| Static Analysis | 7.0/10 | 10% | 0.70 | Ruff + Dependabot + Renovate, FIPS concern |
| Agent Rules | 0.0/10 | 5% | 0.00 | No agent rules |
| **Overall** | **4.6/10** | | **4.60** | |

## Critical Gaps

### 1. No Unit Tests — Only Integration Tests Exist
- **Severity**: HIGH
- **Impact**: The prediction server (1,180 lines) and training server (2,311 lines) contain complex ML business logic — model training, prediction pipelines, data validation, model serialization — with zero isolated unit test coverage. The 40 tests in `tests/test_dual_server_client.py` are integration tests that require both servers running and cannot test internal logic paths.
- **Effort**: 16-24 hours
- **Files affected**: `prediction/prediction_server.py`, `training/training_server.py`, `common/types.py`

### 2. Zero Coverage Tracking
- **Severity**: HIGH
- **Impact**: No `.codecov.yml`, no `pytest-cov` usage, no coverage thresholds, no PR coverage gates. PRs merge with unknown coverage levels and no mechanism to detect coverage regressions.
- **Effort**: 2-4 hours

### 3. Tests Never Run in CI
- **Severity**: HIGH
- **Impact**: While 40 integration tests exist and a test Dockerfile is built in CI, the tests are never actually executed. The `ci-pr-checks.yaml` workflow builds the test container image but does not run it. The tests require running prediction and training servers, and no CI orchestration exists to start these services and execute tests against them.
- **Effort**: 8-12 hours

### 4. hashlib.md5 Usage (FIPS Concern)
- **Severity**: MEDIUM
- **Impact**: `prediction/prediction_server.py:118` uses `hashlib.md5()` for hashing. MD5 is not FIPS-140-2 compliant and will fail in FIPS-enforced environments (e.g., OpenShift clusters with FIPS mode enabled).
- **Effort**: 1-2 hours (replace with `hashlib.sha256`)

## Quick Wins

### 1. Add pytest-cov and Codecov Integration (2-4 hours)
- **Impact**: Immediate visibility into test coverage with PR reporting
- **Implementation**:
  ```yaml
  # .codecov.yml
  coverage:
    status:
      project:
        default:
          target: 50%
          threshold: 5%
      patch:
        default:
          target: 70%
  ```
  ```toml
  # In pyproject.toml [tool.pytest.ini_options]
  addopts = "--cov=prediction --cov=training --cov=common --cov-report=xml"
  ```

### 2. Replace hashlib.md5 with hashlib.sha256 (30 minutes)
- **Impact**: FIPS-compliant hashing, drop-in replacement
- **Implementation**: In `prediction/prediction_server.py:118`, change `hashlib.md5()` to `hashlib.sha256()`

### 3. Add HEALTHCHECK to Dockerfiles (1 hour)
- **Impact**: Container health monitoring without K8s-specific probes
- **Implementation**:
  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8001/healthz || exit 1
  ```

### 4. Create CLAUDE.md with Test Creation Rules (2-3 hours)
- **Impact**: AI agents generate consistent, framework-appropriate tests
- **Implementation**: Use `/test-rules-generator` skill to bootstrap agent rules

## Detailed Findings

### Unit Tests

**Score: 2.0/10**

| Metric | Value |
|--------|-------|
| Test files | 1 (`tests/test_dual_server_client.py`) |
| Test functions | 40 |
| Source lines | ~3,554 (prediction + training + common) |
| Test lines | ~2,098 |
| Test-to-code ratio | ~59% (by lines) |
| Framework | pytest + pytest-asyncio |
| Test isolation | None — all tests require running servers |

**Key Finding**: Despite a seemingly healthy test-to-code ratio, all 40 tests are integration tests that connect to live prediction and training servers via HTTP. There are zero unit tests that test internal functions in isolation:

- No tests for model training logic (BayesianRidge, XGBoost, LightGBM)
- No tests for prediction pipeline logic
- No tests for data validation / Pydantic models
- No tests for `QueueGatedModel` or `RandomDropDeque` in `common/types.py`
- No mocking or test doubles used anywhere

The test file header even uses placeholder URLs:
```python
PREDICTION_URL = os.getenv("PREDICTION_SERVER_URL", "http://<PREDICTION_IP>:80")
TRAINING_URL = os.getenv("TRAINING_SERVER_URL", "http://<TRAINING_IP>:8080")
```

### Integration/E2E Tests

**Score: 5.0/10**

The integration test suite (`tests/test_dual_server_client.py`) is comprehensive in scope, covering:

- Health and readiness endpoints for both servers
- Prediction requests (single and batch)
- Training data ingestion and model retraining
- Model parameter configuration
- Model download and lifecycle
- Error handling (invalid inputs, missing models)
- Concurrent prediction requests
- Online learning flow
- Model sync between training and prediction servers

**Strengths**:
- Dedicated test Dockerfile and K8s Job manifest for running tests
- Tests containerized for deployment in cluster environments
- Good scenario coverage (40 test cases)

**Gaps**:
- Tests are never executed in CI (container is built but not run)
- No test orchestration (no docker-compose, no Kind cluster, no service startup)
- No multi-version testing
- No automated E2E pipeline

### Build Integration

**Score: 7.0/10**

**Strengths**:
- PR workflow builds all 3 container images (prediction, training, test) without pushing
- Version bump enforcement for source code changes
- Import validation (checks Python modules are importable)
- Konflux/Tekton pipelines for all 3 services with:
  - Multi-arch builds (x86_64 + arm64)
  - Hermetic builds
  - Dedicated Konflux Dockerfiles using approved base images
  - `cancel-in-progress` for PR deduplication
- Separate Dockerfiles for upstream (`python:3.11-slim`) vs. Konflux (UBI-based)

**Gaps**:
- No `kustomize build` validation in CI
- No `kubectl apply --dry-run` validation
- Deploy manifests reference placeholder images (`placeholder-for-prediction-server-image:latest`)
- No operator integration testing

### Image Testing

**Score: 5.0/10**

**Strengths**:
- 6 Dockerfiles total (3 upstream + 3 Konflux)
- Multi-arch support (amd64 + arm64) in Makefile and CI
- Hadolint linting configured via pre-commit and `.hadolint.yaml`
- Kubernetes liveness/readiness probes defined in deployment manifests
- `.dockerignore` present
- Non-root user in Konflux Dockerfiles (`USER 1001`)

**Gaps**:
- No multi-stage builds (single-stage Dockerfiles)
- No `HEALTHCHECK` in Dockerfiles
- No Testcontainers or container runtime validation in CI
- No image startup testing (container is built but never run in PR)
- Upstream Dockerfiles don't specify a non-root user
- Upstream base image is `python:3.11-slim` (Debian-based, not UBI)

### Coverage Tracking

**Score: 0.0/10**

No coverage infrastructure exists:
- No `.codecov.yml` or `codecov.yml`
- No `.coveragerc`
- No `pytest-cov` in test dependencies
- No `--cov` flags in pytest configuration
- No coverage thresholds or gates
- No PR coverage reporting
- No coverage badge

### CI/CD Automation

**Score: 7.0/10**

**Workflow Inventory**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci-pr-checks.yaml` | `pull_request` | Lint, version check, import check, container build |
| `ci-release.yaml` | `push tags`, `release` | Build/push + Trivy scan |
| `build-image.yaml` | `push main` | Build/push dev images |
| `ci-signed-commits.yaml` | `pull_request_target` | DCO/signed commit verification |
| `prow-github.yaml` | `issue_comment` | Prow slash commands (/lgtm, /approve, etc.) |
| `prow-pr-automerge.yaml` | `schedule (*/5 min)` | Auto-merge approved PRs |
| `prow-pr-remove-lgtm.yaml` | `pull_request` | Remove LGTM on new pushes |
| `stale.yaml` | `schedule (daily)` | Mark stale issues |
| `unstale.yaml` | `issues`, `issue_comment` | Remove stale label |
| `non-main-gatekeeper.yaml` | `pull_request` | Block non-main target branches |
| `copilot-setup-steps.yaml` | `workflow_dispatch` | GitHub Copilot setup |

**Strengths**:
- Docs-only PR detection (skip expensive checks)
- Pre-commit runs in CI
- Prow-based approval workflow
- Signed commit enforcement
- Reusable workflows from `llm-d-infra`

**Gaps**:
- No test execution in any workflow
- No pip caching in GitHub Actions (`actions/cache` not used)
- No test parallelization
- No concurrency groups in GitHub Actions (only in Tekton)

### Static Analysis

**Score: 7.0/10**

**Linting**:
- Ruff configured in `pyproject.toml` with rules: E, W, F, I, UP
- Ruff format for code formatting
- Comment notes the rule set is intentionally minimal ("Stricter rules can be layered in via follow-up PRs")

**Pre-commit Hooks** (comprehensive):
| Hook | Purpose |
|------|---------|
| pre-commit-hooks | trailing whitespace, EOF, YAML/JSON validation, merge conflicts |
| ruff-check | Python linting with auto-fix |
| ruff-format | Python formatting |
| uv pip-compile | Dependency pinning for both main and test requirements |
| shellcheck | Shell script linting |
| hadolint-docker | Dockerfile linting |
| markdownlint | Markdown linting with auto-fix |
| yamllint | YAML linting |

**Dependency Management**:
- Dependabot: pip, GitHub Actions, Docker (weekly schedule)
- Renovate: extends from `red-hat-data-services/konflux-central`
- Both configured — strong coverage

**FIPS Compatibility**:
- `prediction/prediction_server.py:118`: `hashlib.md5()` — **NOT FIPS-compliant**
- Upstream Dockerfiles use `python:3.11-slim` (not FIPS-capable)
- Konflux Dockerfiles use UBI-based images (FIPS-capable)
- No FIPS build tags or boringcrypto configuration

**Gaps**:
- No type checker (mypy/pyright) despite extensive type annotations in the codebase
- FIPS concern with `hashlib.md5` usage
- Ruff rule set intentionally minimal

### Agent Rules

**Score: 0.0/10**

- No `CLAUDE.md` or `AGENTS.md` in the repository root
- No `.claude/` directory
- No `.claude/rules/` for test creation rules
- No `.claude/skills/` for custom skills
- GitHub Copilot setup workflow exists but provides no structured agent guidance
- **Recommendation**: Use `/test-rules-generator` to generate comprehensive test rules

## Recommendations

### Priority 0 (Critical)

1. **Write unit tests for core business logic** (16-24 hours)
   - Test model training functions (BayesianRidge, XGBoost, LightGBM training paths)
   - Test prediction pipeline logic (feature extraction, model selection, prediction)
   - Test Pydantic model validation and serialization
   - Test `QueueGatedModel` and `RandomDropDeque` in `common/types.py`
   - Use pytest fixtures and mocking to isolate from server dependencies

2. **Add coverage tracking with enforcement** (2-4 hours)
   - Add `pytest-cov` to test dependencies
   - Configure `.codecov.yml` with project and patch thresholds
   - Add `codecov/codecov-action` to CI workflow
   - Set initial target at 50% and increase over time

3. **Execute tests in CI** (8-12 hours)
   - Option A: Add a pytest step to `ci-pr-checks.yaml` for unit tests (requires separating unit from integration tests)
   - Option B: Add docker-compose orchestration to start both servers and run integration tests
   - Option C: Use GitHub Actions services to start prediction + training servers for integration tests

### Priority 1 (High Value)

4. **Add mypy or pyright for type checking** (4-6 hours)
   - The codebase already uses type annotations extensively
   - Add `mypy` or `pyright` to pre-commit hooks
   - Catch type errors at PR time

5. **Replace hashlib.md5 with hashlib.sha256** (30 minutes)
   - `prediction/prediction_server.py:118`: change `hashlib.md5()` to `hashlib.sha256()`
   - FIPS-compliant drop-in replacement

6. **Add kustomize build validation in CI** (2-3 hours)
   - Validate deploy manifests with `kustomize build deploy/base/ > /dev/null`
   - Add `kubectl apply --dry-run=client` validation

7. **Create agent rules** (2-3 hours)
   - Generate `CLAUDE.md` with project conventions
   - Create `.claude/rules/` with test creation rules
   - Use `/test-rules-generator` to bootstrap

### Priority 2 (Nice-to-Have)

8. **Add multi-stage builds to Dockerfiles** (2-3 hours)
   - Reduce final image size by separating build and runtime stages

9. **Add HEALTHCHECK to Dockerfiles** (1 hour)
   - Enable container health monitoring at the Docker level

10. **Add pip caching to GitHub Actions** (1 hour)
    - Use `actions/cache` for pip to speed up CI
    ```yaml
    - uses: actions/cache@v4
      with:
        path: ~/.cache/pip
        key: ${{ runner.os }}-pip-${{ hashFiles('requirements.txt') }}
    ```

11. **Add performance regression tests** (8-12 hours)
    - Test prediction latency against benchmarks
    - Detect model accuracy regressions

12. **Expand ruff rule set** (2-3 hours)
    - Enable additional rules: N (naming), B (bugbear), S (bandit/security), RET, SIM, C4, A
    - Already noted in pyproject.toml comments as planned follow-up

## Comparison to Gold Standards

| Dimension | llm-d-latency-predictor | odh-dashboard | notebooks | kserve |
|-----------|-------------------------|---------------|-----------|--------|
| Unit Tests | 2/10 - No unit tests | 9/10 - Comprehensive | 7/10 - Good | 8/10 - Strong |
| Integration/E2E | 5/10 - Tests exist, not in CI | 9/10 - Multi-layer | 8/10 - Multi-arch | 9/10 - Multi-version |
| Build Integration | 7/10 - PR builds + Konflux | 8/10 - Full pipeline | 8/10 - 5-layer | 8/10 - Operator |
| Image Testing | 5/10 - Multi-arch, no runtime | 7/10 - Contract tests | 9/10 - Best practices | 7/10 - Validation |
| Coverage Tracking | 0/10 - Nothing | 8/10 - Enforced | 6/10 - Basic | 8/10 - Thresholds |
| CI/CD Automation | 7/10 - Well-organized | 9/10 - Comprehensive | 8/10 - Matrix | 9/10 - Full |
| Static Analysis | 7/10 - Good linting | 8/10 - Full stack | 7/10 - Good | 8/10 - golangci |
| Agent Rules | 0/10 - Missing | 8/10 - Comprehensive | 3/10 - Basic | 4/10 - Basic |
| **Overall** | **4.6/10** | **8.5/10** | **7.3/10** | **8.0/10** |

## File Paths Reference

### CI/CD
- `.github/workflows/ci-pr-checks.yaml` - PR checks (lint, version, import, container build)
- `.github/workflows/ci-release.yaml` - Release builds with Trivy
- `.github/workflows/build-image.yaml` - Dev image builds on main
- `.tekton/odh-latency-predictor-prediction-pull-request.yaml` - Konflux pipeline (prediction)
- `.tekton/odh-latency-predictor-training-pull-request.yaml` - Konflux pipeline (training)
- `.tekton/odh-latency-predictor-test-pull-request.yaml` - Konflux pipeline (test)

### Source Code
- `prediction/prediction_server.py` - Prediction server (1,180 lines)
- `training/training_server.py` - Training server (2,311 lines)
- `common/types.py` - Shared types and data structures (63 lines)

### Testing
- `tests/test_dual_server_client.py` - Integration tests (40 functions, 2,098 lines)
- `tests/requirements.txt` - Test dependencies (pinned)

### Container
- `prediction/Dockerfile` - Upstream prediction image
- `training/Dockerfile` - Upstream training image
- `tests/Dockerfile` - Upstream test image
- `Dockerfile.konflux.prediction` - Konflux prediction image
- `Dockerfile.konflux.training` - Konflux training image
- `Dockerfile.konflux.test` - Konflux test image

### Configuration
- `pyproject.toml` - Project config with ruff and pytest settings
- `.pre-commit-config.yaml` - Pre-commit hooks (ruff, shellcheck, hadolint, markdownlint, yamllint)
- `.github/dependabot.yml` - Dependabot (pip, actions, docker)
- `.github/renovate.json` - Renovate configuration
- `.hadolint.yaml` - Dockerfile linting config
- `Makefile` - Build targets

### Deployment
- `deploy/base/kustomization.yaml` - Kustomize base
- `deploy/base/prediction/deployment.yaml` - Prediction K8s deployment
- `deploy/base/training/deployment.yaml` - Training K8s deployment
- `deploy/base/test/job.yaml` - Test K8s job
