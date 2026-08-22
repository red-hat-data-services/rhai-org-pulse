---
repository: "llm-d/llm-d-latency-predictor"
overall_score: 5.1
scorecard:
  - dimension: "Unit Tests"
    score: 3.0
    status: "No isolated unit tests; all tests are integration/E2E requiring running servers"
  - dimension: "Integration/E2E"
    score: 6.0
    status: "Comprehensive E2E test suite (30+ tests) but requires deployed cluster; no local test infrastructure"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time container build for all 3 services; missing kustomize validation and Konflux simulation"
  - dimension: "Image Testing"
    score: 5.0
    status: "Multi-arch support; uses python:3.11-slim instead of UBI; no multi-stage builds or runtime validation"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling, thresholds, or PR reporting configured"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "10 workflows with good breadth; missing pip caching and concurrency control"
  - dimension: "Static Analysis"
    score: 8.0
    status: "Excellent pre-commit setup (ruff, shellcheck, hadolint, yamllint, markdownlint); Dependabot covers all ecosystems"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No unit tests — all tests require deployed servers"
    impact: "Cannot validate business logic (model training, prediction, feature engineering) without a full cluster deployment; bugs in core ML logic go undetected until E2E"
    severity: "HIGH"
    effort: "12-16 hours"
  - title: "No coverage tracking or enforcement"
    impact: "No visibility into which code paths are tested; no coverage gates to prevent regression"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Non-UBI base images (python:3.11-slim)"
    impact: "Not FIPS-compatible out of the box; incompatible with OpenShift restricted environments that require UBI"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No agent rules for test creation"
    impact: "AI-generated tests will not follow project conventions or test patterns"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add pytest-cov and codecov integration"
    effort: "2-4 hours"
    impact: "Immediate visibility into coverage; PR-level coverage reporting"
  - title: "Add pip caching to CI workflow"
    effort: "1 hour"
    impact: "Significant CI speedup — requirements.txt is 158KB with hashes"
  - title: "Create CLAUDE.md with test patterns"
    effort: "2-3 hours"
    impact: "Guide AI agents to write consistent, framework-appropriate tests"
  - title: "Add concurrency control to PR workflow"
    effort: "30 minutes"
    impact: "Prevent redundant CI runs on rapid push sequences"
recommendations:
  priority_0:
    - "Add unit tests for LatencyPredictor class (train, predict, feature engineering) with mocked models"
    - "Add unit tests for LightweightPredictor, ModelSyncer, and common/types.py"
    - "Integrate pytest-cov with codecov and enforce minimum coverage threshold (e.g., 60%)"
    - "Switch Dockerfile base images from python:3.11-slim to UBI 9 Python 3.11 for FIPS compatibility"
  priority_1:
    - "Add local E2E test infrastructure (docker-compose or Kind) so tests can run without a pre-deployed cluster"
    - "Add multi-stage Dockerfiles to reduce final image size and attack surface"
    - "Add kustomize build --dry-run validation in PR CI"
    - "Add mypy or pyright type checking to the pre-commit and CI pipeline"
  priority_2:
    - "Create comprehensive agent rules (.claude/rules/) for unit, integration, and E2E test patterns"
    - "Add HEALTHCHECK instructions to Dockerfiles"
    - "Add performance regression tests for prediction latency"
    - "Add container startup validation in CI (docker run + healthcheck)"
---

# Quality Analysis: llm-d-latency-predictor

## Executive Summary

- **Overall Score: 5.1/10**
- **Repository Type**: Python ML service (dual-server latency prediction for LLM inference)
- **Primary Language**: Python 3.11
- **Frameworks**: FastAPI, scikit-learn, XGBoost, LightGBM
- **Jira**: INFERENG / llm-d (upstream tier)

**Key Strengths**: Excellent static analysis and pre-commit hygiene (ruff, shellcheck, hadolint, yamllint, markdownlint); comprehensive Dependabot configuration covering pip, GitHub Actions, and Docker ecosystems; PR-time container build validation for all 3 services; thorough E2E test scenarios covering prediction, training, model sync, bulk operations, and quantile regression.

**Critical Gaps**: No isolated unit tests — all 30+ tests require deployed training and prediction servers; zero coverage tracking or enforcement; non-UBI base images (python:3.11-slim) incompatible with FIPS requirements; no AI agent rules for test creation guidance.

**Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or `.claude/` directory present.

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 3.0/10 | 15% | 0.45 | No isolated unit tests; all tests are integration/E2E |
| Integration/E2E | 6.0/10 | 20% | 1.20 | 30+ E2E tests but require deployed cluster |
| Build Integration | 7.0/10 | 15% | 1.05 | PR-time container build; missing kustomize validation |
| Image Testing | 5.0/10 | 10% | 0.50 | Multi-arch; non-UBI base; no runtime validation |
| Coverage Tracking | 0.0/10 | 10% | 0.00 | Completely absent |
| CI/CD Automation | 7.0/10 | 15% | 1.05 | 10 workflows; missing caching and concurrency |
| Static Analysis | 8.0/10 | 10% | 0.80 | Excellent pre-commit; Dependabot; missing type checking |
| Agent Rules | 0.0/10 | 5% | 0.00 | No agent rules or guidance |
| **Overall** | **5.1/10** | **100%** | **5.05** | |

## Critical Gaps

### 1. No Unit Tests — All Tests Require Running Servers
- **Impact**: Cannot validate core business logic (model training, prediction, feature engineering, bucket routing, ensemble gating) without a fully deployed cluster. Bugs in `LatencyPredictor.train()`, `_prepare_features_with_interaction()`, `QueueGatedModel`, or `ModelSyncer` go undetected until E2E.
- **Severity**: HIGH
- **Effort**: 12-16 hours
- **Evidence**: The sole test file `tests/test_dual_server_client.py` connects to `PREDICTION_URL` and `TRAINING_URL` via HTTP requests. All 30+ test functions (`test_prediction_server_healthz`, `test_add_training_data_to_training_server`, `test_prediction_via_prediction_server`, etc.) are full-stack integration tests.
- **Files**: `tests/test_dual_server_client.py` (2098 LOC), `training/training_server.py` (2312 LOC), `prediction/prediction_server.py` (1181 LOC), `common/types.py` (78 LOC)

### 2. No Coverage Tracking or Enforcement
- **Impact**: No visibility into which code paths are tested; no coverage gates to prevent regression. Given that all tests are E2E and run against deployed servers, even coverage from those tests isn't captured.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Evidence**: No `.codecov.yml`, no `pytest-cov` in `pyproject.toml` test dependencies, no `--coverage` flags in Makefile or CI workflows.

### 3. Non-UBI Base Images
- **Impact**: `python:3.11-slim` (Debian-based) is not FIPS-compatible and incompatible with OpenShift restricted environments requiring UBI-based images.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Evidence**: All three Dockerfiles (`prediction/Dockerfile`, `training/Dockerfile`, `tests/Dockerfile`) use `FROM python:3.11-slim`.
- **Note**: `hashlib.md5` is used in `prediction/prediction_server.py` for file checksums (not security-sensitive), but the non-UBI base image is the primary FIPS concern.

### 4. No Agent Rules for Test Creation
- **Impact**: AI agents (Claude Code, GitHub Copilot) have no guidance on test conventions, frameworks, or patterns specific to this project.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Evidence**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory. The `copilot-setup-steps.yaml` workflow exists but provides no test creation guidance.

## Quick Wins

### 1. Add pytest-cov and Codecov Integration (2-4 hours)
Add `pytest-cov` to test dependencies and configure codecov:

```yaml
# .codecov.yml
coverage:
  status:
    project:
      default:
        target: 60%
    patch:
      default:
        target: 80%
```

```toml
# pyproject.toml - add to [project.optional-dependencies]
test = [
    "httpx",
    "pytest",
    "pytest-asyncio",
    "pytest-cov",
    "scipy",
]
```

### 2. Add pip Caching to CI Workflow (1 hour)
```yaml
# In ci-pr-checks.yaml, after setup-python:
- name: Cache pip packages
  uses: actions/cache@v4
  with:
    path: ~/.cache/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('requirements.txt') }}
    restore-keys: |
      ${{ runner.os }}-pip-
```

### 3. Create CLAUDE.md with Test Patterns (2-3 hours)
Create a `CLAUDE.md` in the repository root with:
- Test framework conventions (pytest)
- Test file naming patterns
- Mocking patterns for `LatencyPredictor` and `LightweightPredictor`
- Feature engineering test requirements

### 4. Add Concurrency Control to PR Workflow (30 minutes)
```yaml
# In ci-pr-checks.yaml, add at top level:
concurrency:
  group: ci-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

## Detailed Findings

### Unit Tests

**Score: 3.0/10**

The repository has 1 test file (`tests/test_dual_server_client.py`) with 2098 lines containing 30+ test functions. However, these are **all integration/E2E tests** that require running training and prediction servers:

```python
PREDICTION_URL = os.getenv("PREDICTION_SERVER_URL", "http://<PREDICTION_IP>:80")
TRAINING_URL = os.getenv("TRAINING_SERVER_URL", "http://<TRAINING_IP>:8080")
```

**What's missing:**
- Unit tests for `LatencyPredictor` class (train, predict, add_training_sample, flush)
- Unit tests for feature engineering (`_prepare_features_with_interaction`, bucket routing)
- Unit tests for `QueueGatedModel` ensemble logic
- Unit tests for `LightweightPredictor` (predict, predict_batch, predict_batch_fast)
- Unit tests for `ModelSyncer` (sync_models, _download_model_if_newer)
- Unit tests for `common/types.py` (RandomDropDeque behavior)
- Unit tests for Pydantic model validation

**Test-to-code ratio**: 1 test file : 6 source files (2098 test LOC : 3557 source LOC = 0.59 ratio — respectable LOC ratio but misleading since tests don't cover unit-level logic).

### Integration/E2E Tests

**Score: 6.0/10**

The E2E test suite is thorough in terms of **scenario coverage**:
- Health and readiness checks for both servers
- Server configuration validation
- Single and bulk predictions (strict and lenient modes)
- Training data submission with various payloads
- Model sync between training and prediction servers
- Quantile regression accuracy validation (with coverage calibration)
- Mean objective learning verification
- Token-in-flight (TIF) feature support
- Pod type (prefill/decode) handling
- Backward compatibility testing
- Noqueue/queued ensemble routing
- Flush API with selective data clearing
- Error handling (invalid inputs, validation errors)
- Model consistency between servers

**Gaps:**
- Tests require a pre-deployed cluster with training and prediction servers running
- No local test infrastructure (docker-compose, Kind, or envtest)
- No multi-version testing (single Python/server version)
- No test for concurrent access or load behavior
- Tests containerized (`tests/Dockerfile`) but no CI workflow runs them

### Build Integration

**Score: 7.0/10**

**Strengths:**
- PR-time container build for all 3 services (`ci-pr-checks.yaml` → `container-build` job)
- Import check validates Python module structure
- Version bump enforcement on source changes
- Custom GitHub Action (`.github/actions/docker-build-and-push/`) for standardized builds
- Multi-platform support: `linux/amd64,linux/arm64`
- Kustomize deployment manifests in `deploy/base/` with proper structure (training, prediction, test overlays)
- Release workflow with tag-based versioning and prerelease support

**Gaps:**
- No `kustomize build` validation in CI (manifests could be invalid)
- No Konflux simulation or PR-time operator integration testing
- No `kubectl apply --dry-run` validation
- `build-deploy.sh` references GCP with placeholder values — unclear if used

### Image Testing

**Score: 5.0/10**

**Strengths:**
- 3 separate Dockerfiles for each service (training, prediction, test)
- Multi-arch builds via `docker buildx --platform linux/amd64,linux/arm64`
- `.dockerignore` configured to exclude non-essential files
- `.hadolint.yaml` configured for Dockerfile linting
- K8s deployment manifests include liveness/readiness probes

**Gaps:**
- Base image: `python:3.11-slim` (Debian) — not UBI-based, not FIPS-compatible
- No multi-stage builds — final images include pip and build tools
- No `HEALTHCHECK` instruction in Dockerfiles (relies solely on K8s probes)
- No Testcontainers or runtime image validation in CI
- No container startup testing (`docker run` + healthcheck)
- No image size optimization

### Coverage Tracking

**Score: 0.0/10**

Coverage tracking is completely absent:
- No `.codecov.yml` or `coveralls.yml`
- No `pytest-cov` in test dependencies
- No `--coverage` flags in Makefile `test` target
- No coverage thresholds or gates
- No PR coverage reporting
- Even the E2E tests (which run against deployed servers) wouldn't capture code coverage without special instrumentation

### CI/CD Automation

**Score: 7.0/10**

**Workflow Inventory (10 workflows):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci-pr-checks.yaml` | PR to main | Lint, import check, version check, container build |
| `build-image.yaml` | Push to main | Build and push dev images to ghcr.io |
| `ci-release.yaml` | Tag push / release | Build, push, and Trivy scan release images |
| `ci-signed-commits.yaml` | PR target | Enforce signed commits |
| `non-main-gatekeeper.yaml` | PR | Branch protection validation |
| `prow-github.yaml` | Issue comment | Prow slash commands (/lgtm, /approve) |
| `prow-pr-automerge.yaml` | Cron (*/5 * * * *) | Auto-merge approved PRs |
| `prow-pr-remove-lgtm.yaml` | PR | Remove LGTM on new commits |
| `stale.yaml` | Daily cron | Mark stale issues |
| `unstale.yaml` | Issue reopen/comment | Unstale reopened issues |

**Strengths:**
- Smart path filtering (skip expensive checks for docs-only PRs)
- Matrix strategy for multi-service container builds
- Reusable workflows from `llm-d/llm-d-infra` for shared patterns
- Prow-style automation for code review workflow

**Gaps:**
- No `concurrency:` control — rapid pushes trigger redundant CI runs
- No pip caching — `requirements.txt` is 158KB with hashes, installed from scratch each run
- No test execution in CI (only lint + import check + container build)
- No test parallelization or sharding

### Static Analysis

**Score: 8.0/10**

#### Linting

Excellent pre-commit configuration (`.pre-commit-config.yaml`) with 7 hook repos:

| Tool | Purpose | Config |
|------|---------|--------|
| **ruff** | Python linting + formatting | `pyproject.toml` (E, W, F, I, UP rules) |
| **shellcheck** | Shell script linting | `--severity=warning` |
| **hadolint** | Dockerfile linting | `.hadolint.yaml` (error threshold) |
| **markdownlint** | Markdown linting | `.markdownlint.yaml` |
| **yamllint** | YAML linting | `.yamllint.yml` |
| **uv pip-compile** | Dependency lock validation | Hash-based requirements |
| **pre-commit-hooks** | File hygiene | Trailing whitespace, EOF, YAML/JSON checks, merge conflicts |

Additionally: `_typos.toml` configured for spell checking.

**Gaps:**
- No type checker (mypy, pyright) — significant for a codebase with complex ML data structures
- Ruff rules are minimal (E, W, F, I, UP) — could benefit from B (bugbear), S (security), N (naming)
- No bandit or safety checks for security-sensitive patterns

#### FIPS Compatibility

- **Base images**: `python:3.11-slim` (Debian) — NOT UBI-based, not FIPS-compatible
- **Crypto usage**: `hashlib.md5` in `prediction/prediction_server.py` for file checksums (non-security-sensitive)
- **No FIPS build tags** or BoringCrypto configuration
- **Risk**: Moderate — the service runs in Kubernetes and may need FIPS-compliant base images for regulated environments

#### Dependency Alerts

**Excellent** — `.github/dependabot.yml` covers all three relevant ecosystems:
- `pip` (Python dependencies) — weekly, excludes major updates
- `github-actions` (CI dependencies) — weekly
- `docker` (base image updates) — weekly

### Agent Rules

**Score: 0.0/10**

- **Status**: Missing
- **Coverage**: None — no CLAUDE.md, AGENTS.md, or `.claude/` directory
- **Quality**: N/A
- **Gaps**: No test creation rules, no framework-specific examples, no quality gate checklists
- **Note**: `copilot-setup-steps.yaml` exists for GitHub Copilot but provides no rules or conventions
- **Recommendation**: Generate agent rules with `/test-rules-generator` to establish:
  - Unit test patterns for `LatencyPredictor` and `LightweightPredictor`
  - Mocking patterns for ML models (XGBoost, LightGBM, BayesianRidge)
  - FastAPI endpoint testing patterns with TestClient
  - Feature engineering validation patterns

## Recommendations

### Priority 0 (Critical)

1. **Add unit tests for core ML logic** — Create `tests/test_training_server.py` and `tests/test_prediction_server.py` with:
   - `LatencyPredictor.train()` with mocked XGBoost/LightGBM models
   - `_prepare_features_with_interaction()` feature engineering validation
   - `QueueGatedModel` ensemble routing
   - Bucket routing (`_get_queue_bucket`, `_get_cache_bucket`, `_get_prefix_bucket`)
   - Pydantic model validation (valid/invalid inputs)
   - FastAPI endpoint tests using `httpx.AsyncClient` / `TestClient`

2. **Add unit tests for prediction server** — Create `tests/test_prediction_server.py` with:
   - `LightweightPredictor.predict()` and `predict_batch()` with mocked models
   - `ModelSyncer._download_model_if_newer()` with mocked HTTP responses
   - Feature preparation and ensemble routing
   - Checksum-based reload skipping

3. **Integrate pytest-cov with codecov** — Add coverage measurement and PR reporting with enforcement thresholds.

4. **Switch to UBI base images** — Replace `python:3.11-slim` with `registry.access.redhat.com/ubi9/python-311` for FIPS compatibility.

### Priority 1 (High Value)

5. **Add local E2E test infrastructure** — Create a `docker-compose.test.yml` that spins up training and prediction servers locally, enabling the existing E2E tests to run without a pre-deployed cluster.

6. **Add multi-stage Dockerfiles** — Separate build and runtime stages to reduce final image size and attack surface.

7. **Add kustomize build validation in CI** — Add `kustomize build deploy/base/ > /dev/null` step to PR checks.

8. **Add mypy type checking** — The codebase uses complex data structures (`pd.DataFrame`, `np.ndarray`, model types) that benefit from static type checking.

### Priority 2 (Nice-to-Have)

9. **Create agent rules** — Add CLAUDE.md and `.claude/rules/` with test creation guidance for unit, integration, and E2E patterns.

10. **Add HEALTHCHECK to Dockerfiles** — `HEALTHCHECK CMD curl -f http://localhost:8001/healthz || exit 1` for container-level health monitoring.

11. **Add prediction latency benchmarks** — Test that `predict_batch_fast()` meets performance requirements under load.

12. **Add container startup validation** — In CI, `docker run` each image and validate health endpoint responds.

## Comparison to Gold Standards

| Dimension | llm-d-latency-predictor | odh-dashboard | notebooks | kserve |
|-----------|------------------------|---------------|-----------|--------|
| Unit Tests | 3/10 — E2E only | 9/10 — Multi-layer | 7/10 — Framework tests | 8/10 — Extensive |
| Integration/E2E | 6/10 — Cluster-required | 9/10 — Cypress + API | 8/10 — Image validation | 9/10 — Multi-version |
| Build Integration | 7/10 — PR build, no kustomize | 8/10 — Full validation | 7/10 — Image pipelines | 8/10 — Operator testing |
| Image Testing | 5/10 — Multi-arch, non-UBI | 7/10 — Multi-stage | 9/10 — 5-layer validation | 7/10 — envtest |
| Coverage Tracking | 0/10 — Absent | 8/10 — Enforced | 6/10 — Present | 9/10 — Enforced |
| CI/CD Automation | 7/10 — Good breadth | 9/10 — Comprehensive | 8/10 — Image pipeline | 9/10 — Matrix testing |
| Static Analysis | 8/10 — Excellent pre-commit | 8/10 — ESLint strict | 6/10 — Basic | 8/10 — golangci-lint |
| Agent Rules | 0/10 — Absent | 8/10 — Comprehensive | 3/10 — Minimal | 4/10 — Basic |

## File Paths Reference

### CI/CD
- `.github/workflows/ci-pr-checks.yaml` — PR validation (lint, build, version check)
- `.github/workflows/build-image.yaml` — Dev image build on main merge
- `.github/workflows/ci-release.yaml` — Release image build + Trivy scan
- `.github/actions/docker-build-and-push/action.yml` — Reusable build action
- `Makefile` — Development targets (lint, test, fmt, image-build)

### Testing
- `tests/test_dual_server_client.py` — E2E test suite (2098 LOC)
- `tests/requirements.txt` — Locked test dependencies
- `tests/Dockerfile` — Test runner container
- `pyproject.toml` — Test config (`[tool.pytest.ini_options]`)

### Source Code
- `training/training_server.py` — Training server (2312 LOC)
- `prediction/prediction_server.py` — Prediction server (1181 LOC)
- `common/types.py` — Shared types (78 LOC)

### Code Quality / Static Analysis
- `pyproject.toml` — Ruff config (`[tool.ruff]`)
- `.pre-commit-config.yaml` — 7 hook repos (ruff, shellcheck, hadolint, etc.)
- `.hadolint.yaml` — Dockerfile lint config
- `.markdownlint.yaml` — Markdown lint config
- `.yamllint.yml` — YAML lint config
- `_typos.toml` — Spell check config
- `.github/dependabot.yml` — Dependency alerts (pip, actions, docker)
- `hooks/pre-commit` — Git hook (lint + test)

### Container Images
- `prediction/Dockerfile` — Prediction server image
- `training/Dockerfile` — Training server image
- `tests/Dockerfile` — Test runner image
- `.dockerignore` — Build context exclusions

### Deployment
- `deploy/base/kustomization.yaml` — Root kustomization
- `deploy/base/prediction/deployment.yaml` — Prediction K8s deployment
- `deploy/base/prediction/service.yaml` — Prediction K8s service
- `deploy/base/training/deployment.yaml` — Training K8s deployment
- `deploy/base/training/service.yaml` — Training K8s service
