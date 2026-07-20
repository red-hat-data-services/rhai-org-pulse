---
repository: "opendatahub-io/llm-d-latency-predictor"
overall_score: 4.8
scorecard:
  - dimension: "Unit Tests"
    score: 2.0
    status: "No unit tests; sole test file is an integration test requiring running servers"
  - dimension: "Integration/E2E"
    score: 6.0
    status: "Comprehensive dual-server integration test with QPS load testing and Kubernetes Job manifest"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time container builds for all 3 services, Konflux/Tekton pipelines, import validation"
  - dimension: "Image Testing"
    score: 5.0
    status: "6 Dockerfiles (upstream + Konflux/UBI), health probes in K8s manifests, but no multi-stage or runtime validation"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling, no codecov, no coverage thresholds, no PR reporting"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "11 workflows with smart path filtering, matrix builds, Prow integration, but no concurrency control or caching"
  - dimension: "Static Analysis"
    score: 7.0
    status: "Strong pre-commit (ruff, shellcheck, hadolint, yamllint, markdownlint), Dependabot for 3 ecosystems, but FIPS concern with hashlib.md5"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "Zero unit test coverage"
    impact: "Individual functions, model logic, data validation, and error handling paths are untested in isolation — regressions can only be caught by the slow integration test"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No code coverage tracking"
    impact: "No visibility into which code paths are tested; impossible to enforce coverage gates or track regression"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "FIPS-incompatible hashlib.md5 usage in prediction server"
    impact: "prediction_server.py:118 uses hashlib.md5() which is not FIPS-compliant; will fail in FIPS-enforced environments"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "Upstream Dockerfiles use Debian base images (not FIPS-capable)"
    impact: "prediction/Dockerfile and training/Dockerfile use python:3.11-slim (Debian) which cannot run in FIPS mode without significant rework"
    severity: "MEDIUM"
    effort: "4-8 hours"
quick_wins:
  - title: "Add pytest-cov and codecov integration"
    effort: "2-4 hours"
    impact: "Immediate coverage visibility, PR coverage reporting, and threshold enforcement"
  - title: "Replace hashlib.md5() with hashlib.sha256()"
    effort: "30 minutes"
    impact: "FIPS compliance for model hash computation in prediction server"
  - title: "Add concurrency control to PR workflow"
    effort: "30 minutes"
    impact: "Cancel stale CI runs on new pushes, save CI resources"
  - title: "Create basic CLAUDE.md with test patterns"
    effort: "2-3 hours"
    impact: "Guide AI-assisted development to follow project conventions and testing patterns"
recommendations:
  priority_0:
    - "Add unit tests for prediction_server.py and training_server.py — isolate model logic, data validation, and API endpoint handlers with mocked dependencies"
    - "Integrate pytest-cov with codecov for PR coverage reporting and enforce a minimum threshold (start at 40%, ramp to 70%)"
    - "Replace hashlib.md5() with hashlib.sha256() in prediction_server.py to achieve FIPS compliance"
  priority_1:
    - "Add concurrency control to ci-pr-checks.yaml to cancel superseded runs"
    - "Add pip caching to CI workflows to reduce build times"
    - "Create CLAUDE.md with project structure, testing patterns, and contribution guidelines"
    - "Add kustomize build validation (dry-run) to PR checks"
  priority_2:
    - "Add multi-stage Docker builds to reduce final image size"
    - "Add image startup validation in CI (docker run + health check)"
    - "Consider contract tests between training and prediction server APIs"
    - "Add performance regression tests for prediction latency"
---

# Quality Analysis: llm-d-latency-predictor

**Repository**: [opendatahub-io/llm-d-latency-predictor](https://github.com/opendatahub-io/llm-d-latency-predictor)
**Jira**: INFERENG / llm-d
**Tier**: midstream
**Analysis Date**: 2026-07-20

## Executive Summary

- **Overall Score: 4.8/10**
- **Repository Type**: Python ML microservice (FastAPI-based prediction + training servers)
- **Primary Language**: Python 3.11+
- **Framework**: FastAPI, scikit-learn, XGBoost, LightGBM, River

**Key Strengths**: Strong pre-commit configuration with 8 hooks covering Python, Shell, Docker, YAML, and Markdown linting. Comprehensive Dependabot coverage for pip, GitHub Actions, and Docker. PR workflow validates container builds for all 3 service images. Konflux/Tekton pipelines are fully configured for the midstream build system. The integration test suite exercises the full dual-server workflow including load testing.

**Critical Gaps**: Zero unit tests — the sole test file is an integration test requiring running servers. No code coverage tracking at all. A FIPS-incompatible `hashlib.md5()` call exists in the prediction server. No agent rules for AI-assisted development.

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 2.0/10 | No unit tests; sole test file is an integration test requiring running servers |
| Integration/E2E | 20% | 6.0/10 | Comprehensive dual-server integration test with QPS load testing |
| Build Integration | 15% | 7.0/10 | PR-time container builds for all 3 services, Konflux/Tekton pipelines |
| Image Testing | 10% | 5.0/10 | 6 Dockerfiles with health probes, but no multi-stage or runtime validation |
| Coverage Tracking | 10% | 0.0/10 | No coverage tooling, no codecov, no thresholds |
| CI/CD Automation | 15% | 7.0/10 | 11 workflows with smart path filtering and matrix builds |
| Static Analysis | 10% | 7.0/10 | Strong pre-commit suite, Dependabot for 3 ecosystems, FIPS concern |
| Agent Rules | 5% | 0.0/10 | No CLAUDE.md, AGENTS.md, or .claude/ directory |
| **Overall** | **100%** | **4.8/10** | |

## Critical Gaps

### 1. Zero Unit Test Coverage
- **Severity**: HIGH
- **Impact**: Individual functions (model training logic, data validation, prediction math, scaler handling, model sync) are completely untested in isolation. Regressions can only be caught by the slow integration test that requires deployed servers.
- **Effort**: 16-24 hours
- **Details**: The repository has 7 Python source files (`prediction/prediction_server.py`, `training/training_server.py`, `common/types.py`, plus `__init__.py` files) but only 1 test file (`tests/test_dual_server_client.py`) which is a full integration test requiring both servers to be running. Functions like `ModelSyncer._download_model()`, `_predict_latency()`, the training loop, and data validation in Pydantic models are all untested.

### 2. No Code Coverage Tracking
- **Severity**: HIGH
- **Impact**: No visibility into what percentage of code is exercised by tests. No way to enforce coverage gates on PRs. No historical tracking of coverage trends.
- **Effort**: 2-4 hours
- **Details**: No `.codecov.yml`, no `.coveragerc`, no `pytest-cov` in test dependencies, no coverage flags in CI. The `pyproject.toml` `[project.optional-dependencies.test]` includes `pytest` and `pytest-asyncio` but no coverage tools.

### 3. FIPS-Incompatible Crypto Usage
- **Severity**: HIGH
- **Impact**: `prediction/prediction_server.py:118` uses `hashlib.md5()` for model hash computation. MD5 is prohibited under FIPS 140-2/140-3. This will cause runtime failures in FIPS-enforced environments (RHEL/UBI with FIPS mode enabled).
- **Effort**: 1-2 hours
- **Details**: The `hashlib.md5()` call is used in `ModelSyncer` to compute hashes for downloaded model files (checking if models have changed). This is a non-security use case (integrity checking, not cryptographic authentication) but still fails under FIPS enforcement. Replace with `hashlib.sha256()`.

### 4. Upstream Dockerfiles Not FIPS-Capable
- **Severity**: MEDIUM
- **Impact**: `prediction/Dockerfile` and `training/Dockerfile` use `python:3.11-slim` (Debian-based), which cannot run with FIPS enforcement without significant rework. The Konflux variants correctly use UBI-based images.
- **Effort**: 4-8 hours

## Quick Wins

### 1. Add pytest-cov and Codecov Integration (2-4 hours)
Add `pytest-cov` to test dependencies and configure codecov:

```toml
# pyproject.toml - add to [project.optional-dependencies.test]
test = [
    "httpx",
    "pytest",
    "pytest-asyncio",
    "pytest-cov",
    "scipy",
]

# Add coverage config
[tool.coverage.run]
source = ["prediction", "training", "common"]

[tool.coverage.report]
fail_under = 40
```

Create `.codecov.yml`:
```yaml
coverage:
  status:
    project:
      default:
        target: 40%
    patch:
      default:
        target: 60%
```

### 2. Replace hashlib.md5() with hashlib.sha256() (30 minutes)
In `prediction/prediction_server.py`:
```python
# Before (line 118):
h = hashlib.md5()
# After:
h = hashlib.sha256()
```

### 3. Add Concurrency Control to PR Workflow (30 minutes)
Add to `ci-pr-checks.yaml`:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number }}
  cancel-in-progress: true
```

### 4. Create Basic CLAUDE.md (2-3 hours)
Create a `CLAUDE.md` with project structure documentation, test patterns, and coding conventions to guide AI-assisted development.

## Detailed Findings

### Unit Tests

**Score: 2.0/10**

| Metric | Value |
|--------|-------|
| Test files | 1 (integration only) |
| Source files | 7 |
| Test-to-code ratio | 0.14 |
| Testing framework | pytest + pytest-asyncio |
| Test isolation | None (requires running servers) |
| Mocking | None |

The sole test file `tests/test_dual_server_client.py` is entirely an integration test — it connects to running prediction and training server instances via HTTP. There are **zero unit tests** that:
- Test model training logic with mocked data
- Test prediction calculation functions in isolation
- Test Pydantic model validation (common/types.py)
- Test `ModelSyncer` download/hash logic
- Test error handling paths (missing models, invalid data, server unavailability)
- Test the FastAPI endpoint handlers with httpx TestClient

The test file itself is well-structured with clear test functions covering health checks, training data submission, model training, predictions, batched predictions, concurrent requests, and load testing. But it cannot run without deployed servers.

**Key test functions in test_dual_server_client.py**:
- `test_prediction_server_healthz` / `test_training_server_healthz` — basic health checks
- `test_training_submit_data` — submit training samples
- `test_trigger_training` — trigger model retraining
- `test_prediction_latency` — predict TTFT/TPOT
- `test_batched_prediction` — batched predictions
- `test_concurrent_predictions` — concurrent request handling
- Various edge case tests (empty data, invalid data, etc.)

### Integration/E2E Tests

**Score: 6.0/10**

| Metric | Value |
|--------|-------|
| Integration test files | 1 |
| Test container | Yes (tests/Dockerfile) |
| K8s test Job manifest | Yes (deploy/base/test/) |
| Multi-version testing | No |
| Test scenarios | ~15 test functions |
| Load testing | Yes (target 1000 QPS) |

**Strengths**:
- Comprehensive dual-server integration test covering the full training → prediction workflow
- Separate test Dockerfile builds a dedicated test container
- Kubernetes Job manifest (`deploy/base/test/job.yaml`) for in-cluster testing
- Load testing with configurable target QPS
- Tests exercise health endpoints, data submission, model training, predictions, batched requests, concurrent requests, and edge cases

**Weaknesses**:
- Only one integration test file — no separation of concerns
- Tests require pre-deployed servers (not self-contained)
- No multi-version testing (e.g., different Python versions, different model types)
- No contract tests between training and prediction server APIs
- Test Job resource requests are very high (50Gi memory request, 100Gi limit) — likely needs tuning

### Build Integration

**Score: 7.0/10**

| Metric | Value |
|--------|-------|
| PR container build | Yes (3 services) |
| Konflux pipelines | Yes (6 Tekton PipelineRuns) |
| Import validation | Yes |
| Kustomize validation | No |
| Manifest dry-run | No |

**Strengths**:
- `ci-pr-checks.yaml` builds all 3 service containers (prediction, training, test) on PRs using `docker buildx build` — catches Dockerfile issues before merge
- Smart path filtering skips expensive checks for docs-only PRs
- Import validation check verifies the Python package structure is importable
- VERSION bump enforcement for source code changes
- Full Tekton/Konflux pipeline configuration for midstream builds (`.tekton/` directory with 6 pipeline definitions)
- Separate Konflux Dockerfiles use UBI base images with pinned SHA digests

**Weaknesses**:
- No `kustomize build` validation in CI
- No `kubectl apply --dry-run` for manifest validation
- No operator deployment testing
- PR container builds only test `linux/amd64` (Makefile supports multi-arch but CI doesn't use it)

### Image Testing

**Score: 5.0/10**

| Metric | Value |
|--------|-------|
| Dockerfiles | 6 (3 upstream + 3 Konflux) |
| Multi-stage builds | No |
| Base images | python:3.11-slim (upstream), UBI (Konflux) |
| Multi-arch support | Makefile only (linux/amd64,linux/arm64) |
| Health probes | Yes (liveness + readiness in K8s manifests) |
| Runtime validation | No |
| .dockerignore | Yes |
| Hadolint linting | Yes |

**Strengths**:
- Separate Dockerfiles for each service (prediction, training, test)
- Separate Konflux Dockerfiles with UBI base images and pinned SHA digests
- Kubernetes manifests define liveness and readiness probes (HTTP health checks)
- Hadolint configured in pre-commit for Dockerfile linting
- `.dockerignore` present to reduce build context
- Non-root user configuration in Konflux Dockerfiles (USER 1001)

**Weaknesses**:
- No multi-stage builds — all Dockerfiles are single-stage, resulting in larger images with build tools included
- Upstream Dockerfiles use `python:3.11-slim` (Debian) which is not FIPS-capable
- Multi-arch only supported in Makefile, not exercised in CI
- No Testcontainers or similar runtime validation
- No image startup testing in CI (builds but never runs the container)
- No HEALTHCHECK instruction in Dockerfiles themselves (only in K8s manifests)

### Coverage Tracking

**Score: 0.0/10**

| Metric | Value |
|--------|-------|
| Coverage tool | None |
| Codecov/Coveralls | Not configured |
| Coverage thresholds | None |
| PR coverage reporting | None |
| Coverage in CI | None |

No code coverage infrastructure exists. The `pyproject.toml` test dependencies include `pytest` and `pytest-asyncio` but no coverage tools (`pytest-cov`). No `.codecov.yml`, `.coveragerc`, or coverage configuration exists anywhere in the repository.

### CI/CD Automation

**Score: 7.0/10**

| Metric | Value |
|--------|-------|
| Total workflows | 11 |
| PR-triggered | 4 (ci-pr-checks, signed-commits, non-main-gatekeeper, prow-remove-lgtm) |
| Push-triggered | 2 (build-image, ci-release) |
| Scheduled | 2 (prow-automerge every 5min, stale daily) |
| Event-triggered | 3 (prow-github, unstale, copilot-setup) |
| Tekton pipelines | 6 |
| Concurrency control | No |
| Caching | No |
| Matrix strategy | Yes (3 services) |
| Path filtering | Yes |

**Workflow inventory**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci-pr-checks.yaml` | PR | Lint, version check, import check, container builds |
| `ci-signed-commits.yaml` | PR | DCO/signed commit enforcement |
| `non-main-gatekeeper.yaml` | PR | Prevent non-main target branches |
| `prow-pr-remove-lgtm.yaml` | PR | Remove LGTM label on new pushes |
| `build-image.yaml` | Push (main) | Build and push dev images to GHCR |
| `ci-release.yaml` | Tag/Release | Build, push, and scan release images |
| `prow-pr-automerge.yaml` | Schedule (5min) | Auto-merge approved PRs |
| `stale.yaml` | Schedule (daily) | Mark stale issues |
| `prow-github.yaml` | Issue comment | Prow-style commands (/lgtm, /approve) |
| `unstale.yaml` | Issue reopen/comment | Remove stale label |
| `copilot-setup-steps.yaml` | Manual | GitHub Copilot workspace setup |

**Strengths**:
- Smart path filtering skips expensive checks for docs-only PRs
- Matrix strategy builds all 3 service containers in parallel
- Reusable workflows from `llm-d/llm-d-infra` reduce duplication
- Prow integration for Kubernetes-style PR workflow (LGTM, approve, automerge)
- Release workflow includes Trivy security scanning

**Weaknesses**:
- No `concurrency:` key on PR workflows — multiple runs queue up
- No pip/dependency caching in any workflow
- No test parallelization
- No timeout limits on jobs (missing `timeout-minutes:`)

### Static Analysis

**Score: 7.0/10**

| Metric | Value |
|--------|-------|
| Python linter | Ruff (E, W, F, I, UP rules) |
| Formatter | Ruff format |
| Pre-commit hooks | 8 repos, 12+ hooks |
| Shell linting | ShellCheck |
| Dockerfile linting | Hadolint |
| Markdown linting | markdownlint-cli |
| YAML linting | yamllint |
| Typo checking | typos (_typos.toml) |
| Dependabot | Yes (pip, actions, docker) |
| FIPS issues | hashlib.md5() in prediction_server.py |

**Linting configuration**:
- **Ruff** (`pyproject.toml`): Configured with `line-length = 120`, `target-version = "py311"`, rules: E (pycodestyle errors), W (warnings), F (pyflakes), I (isort), UP (pyupgrade). Notable: does not yet enable stricter rules (N, B, S, RET, SIM, C4, A) — noted as a follow-up in comments
- **Pre-commit** (`.pre-commit-config.yaml`): Comprehensive setup with trailing-whitespace, end-of-file-fixer, check-yaml, check-json, check-added-large-files (1MB limit), check-merge-conflict, mixed-line-ending, check-case-conflict, ruff-check + ruff-format, uv pip-compile (requirements pinning), shellcheck, hadolint-docker, markdownlint, yamllint

**FIPS compatibility**:
- `prediction/prediction_server.py:118`: `h = hashlib.md5()` — **NOT FIPS-compliant**. Used for model file hash computation in `ModelSyncer`. Should be replaced with `hashlib.sha256()`.
- No FIPS build tags or `GOEXPERIMENT=boringcrypto` (not applicable for Python)
- Konflux Dockerfiles use UBI base images (FIPS-capable) — good
- Upstream Dockerfiles use `python:3.11-slim` (Debian) — not FIPS-capable

**Dependency alerts**:
- `.github/dependabot.yml` covers 3 ecosystems: pip, github-actions, docker
- Weekly schedule for all ecosystems
- Ignores major version updates for pip packages
- Labels PRs with `dependencies` and `release-note-none`

### Agent Rules

**Score: 0.0/10**

| Metric | Value |
|--------|-------|
| CLAUDE.md | Not present |
| AGENTS.md | Not present |
| .claude/ directory | Not present |
| .claude/rules/ | Not present |
| Test creation rules | None |
| Copilot setup | Present (.github/workflows/copilot-setup-steps.yaml) |

No AI agent rules exist in the repository. There is a GitHub Copilot workspace setup workflow but no Claude Code agent rules, test creation guidelines, or AI development guidance.

## Recommendations

### Priority 0 (Critical)

1. **Add unit tests for core modules** (16-24 hours)
   - Create `tests/test_prediction_server.py`: Test `PredictSettings`, `ModelSyncer._download_model()`, `_predict_latency()`, prediction endpoint handlers using `httpx.AsyncClient` with FastAPI's TestClient
   - Create `tests/test_training_server.py`: Test training data ingestion, model retraining logic, model persistence, scaler fitting
   - Create `tests/test_types.py`: Test Pydantic model validation in `common/types.py` (ModelType, ObjectiveType, QueueGatedModel)
   - Use mocking (`unittest.mock`) to isolate from external dependencies (HTTP calls, filesystem, model libraries)

2. **Integrate coverage tracking** (2-4 hours)
   - Add `pytest-cov` to `[project.optional-dependencies.test]`
   - Configure coverage in `pyproject.toml` with source directories and minimum threshold
   - Create `.codecov.yml` with project and patch targets
   - Add `--cov --cov-report=xml` to CI test command
   - Add codecov upload step to CI workflow

3. **Fix FIPS compliance** (1-2 hours)
   - Replace `hashlib.md5()` with `hashlib.sha256()` in `prediction/prediction_server.py`
   - Audit for any other non-FIPS crypto usage

### Priority 1 (High Value)

4. **Add concurrency control and caching to CI** (1-2 hours)
   - Add `concurrency:` group to `ci-pr-checks.yaml`
   - Add pip caching with `actions/cache` or `setup-python`'s built-in caching
   - Add `timeout-minutes:` to all jobs

5. **Create CLAUDE.md and agent rules** (2-3 hours)
   - Document project structure (prediction server, training server, common types)
   - Document testing patterns and conventions
   - Create `.claude/rules/` with test creation rules
   - Use `/test-rules-generator` to bootstrap rules from existing test patterns

6. **Add kustomize validation to PR checks** (2-3 hours)
   - Add a CI step that runs `kustomize build deploy/base/` to validate manifests
   - Consider `kubectl apply --dry-run=client` for schema validation

### Priority 2 (Nice-to-Have)

7. **Add multi-stage Docker builds** (4-6 hours)
   - Refactor Dockerfiles to use multi-stage builds with a builder stage and slim runtime stage
   - Reduce final image size by excluding build tools

8. **Add image startup validation** (4-6 hours)
   - After building containers in CI, run them with health check verification
   - Use `docker run` with timeout and `/healthz` endpoint check

9. **Add contract tests** (8-12 hours)
   - Define and test the API contract between training and prediction servers
   - Ensure training model format matches prediction server expectations

10. **Add performance regression testing** (8-12 hours)
    - Track prediction latency benchmarks over time
    - Alert on significant performance degradation

## Comparison to Gold Standards

| Dimension | llm-d-latency-predictor | odh-dashboard | notebooks | kserve |
|-----------|------------------------|---------------|-----------|--------|
| Unit Tests | 2/10 — No unit tests | 9/10 — Extensive Jest/Cypress | 7/10 — Good coverage | 8/10 — Go testing |
| Integration/E2E | 6/10 — Single integration file | 9/10 — Multi-layer Cypress | 8/10 — Multi-layer validation | 9/10 — Comprehensive E2E |
| Build Integration | 7/10 — PR container builds | 8/10 — Multi-mode builds | 8/10 — Image pipelines | 8/10 — Operator deploy |
| Image Testing | 5/10 — No runtime validation | 7/10 — Container testing | 9/10 — 5-layer validation | 7/10 — envtest |
| Coverage Tracking | 0/10 — None | 8/10 — Codecov enforced | 6/10 — Basic coverage | 8/10 — Threshold gates |
| CI/CD Automation | 7/10 — Good workflow suite | 9/10 — Comprehensive | 8/10 — Well-organized | 9/10 — Matrix/multi-ver |
| Static Analysis | 7/10 — Strong pre-commit | 8/10 — ESLint + Prettier | 7/10 — Basic linting | 8/10 — golangci-lint |
| Agent Rules | 0/10 — None | 8/10 — Comprehensive rules | 3/10 — Basic | 4/10 — Basic |
| **Overall** | **4.8/10** | **8.5/10** | **7.3/10** | **8.0/10** |

## File Paths Reference

### CI/CD
- `.github/workflows/ci-pr-checks.yaml` — PR validation (lint, version, imports, container builds)
- `.github/workflows/build-image.yaml` — Push-triggered image builds
- `.github/workflows/ci-release.yaml` — Release image builds with Trivy scan
- `.github/workflows/ci-signed-commits.yaml` — DCO enforcement
- `.github/workflows/non-main-gatekeeper.yaml` — Branch protection
- `.github/workflows/prow-*.yaml` — Prow integration (commands, automerge, LGTM)
- `.github/actions/docker-build-and-push/action.yml` — Reusable Docker build action
- `.tekton/odh-latency-predictor-*-pull-request.yaml` — Konflux PR pipelines
- `.tekton/odh-latency-predictor-*-push.yaml` — Konflux push pipelines

### Testing
- `tests/test_dual_server_client.py` — Integration test suite (sole test file)
- `tests/Dockerfile` — Test container
- `tests/requirements.txt` — Test dependencies (auto-generated by uv)
- `deploy/base/test/job.yaml` — Kubernetes Job for in-cluster testing

### Source Code
- `prediction/prediction_server.py` — FastAPI prediction server (TTFT/TPOT)
- `training/training_server.py` — FastAPI training server (online ML training)
- `common/types.py` — Shared Pydantic models and types

### Configuration
- `pyproject.toml` — Project config, dependencies, ruff config, pytest config
- `.pre-commit-config.yaml` — 8 pre-commit hook repos, 12+ hooks
- `.github/dependabot.yml` — Dependabot for pip, actions, docker
- `.hadolint.yaml` — Dockerfile linter config
- `.yamllint.yml` — YAML linter config
- `.markdownlint.yaml` — Markdown linter config
- `_typos.toml` — Typo checker config

### Container Images
- `prediction/Dockerfile` — Upstream prediction server (python:3.11-slim)
- `training/Dockerfile` — Upstream training server (python:3.11-slim)
- `tests/Dockerfile` — Upstream test container (python:3.11-slim)
- `Dockerfile.konflux.prediction` — Konflux prediction server (UBI-based)
- `Dockerfile.konflux.training` — Konflux training server (UBI-based)
- `Dockerfile.konflux.test` — Konflux test container (UBI-based)
- `.dockerignore` — Build context exclusions

### Deployment
- `deploy/base/kustomization.yaml` — Root kustomization
- `deploy/base/prediction/` — Prediction server K8s manifests (Deployment, Service, ConfigMap)
- `deploy/base/training/` — Training server K8s manifests (Deployment, Service, ConfigMap, PVC, StorageClass)
- `deploy/base/test/` — Test Job manifest
