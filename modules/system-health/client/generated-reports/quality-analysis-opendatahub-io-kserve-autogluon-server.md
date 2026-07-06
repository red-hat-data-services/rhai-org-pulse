---
repository: "opendatahub-io/kserve-autogluon-server"
overall_score: 6.8
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Excellent autogluon-specific tests (1370 LOC vs 1383 LOC source); comprehensive Go+Python unit suites across 340 test files; multi-Python-version matrix (3.10-3.12)"
  - dimension: "Integration/E2E"
    score: 7.5
    status: "Solid E2E framework with 67 test files; Minikube-based infra; ModelCache and quick-install e2e workflows on PRs; no autogluon-specific E2E tests"
  - dimension: "Build Integration"
    score: 6.0
    status: "PR-time Docker build+push for autogluon image with multi-arch (amd64/arm64); SBOM generation; no Konflux simulation or image runtime validation"
  - dimension: "Image Testing"
    score: 4.5
    status: "Docker build verified on PR but no startup/runtime validation; no vulnerability scanning in CI; SBOM enabled on push only"
  - dimension: "Coverage Tracking"
    score: 5.0
    status: "Go coverage file generated with 80% threshold (.testcoverage.yml); pytest --cov used; no coverage upload/reporting service (no Codecov/Coveralls); no PR coverage gating"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "11 workflows with proper concurrency control; path-based filtering; caching throughout; auto-assign reviewers; stalebot; merge queue support"
  - dimension: "Agent Rules"
    score: 7.0
    status: "CLAUDE.md and AGENTS.md present with build/test/lint commands and architecture overview; no .claude/rules/ directory for test automation guidance"
critical_gaps:
  - title: "No security scanning in CI (no Trivy, CodeQL, or Snyk)"
    impact: "Vulnerabilities in AutoGluon's large dependency tree (PyTorch, LightGBM, XGBoost) go undetected until production"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No coverage reporting service integration"
    impact: "Coverage trends invisible; regressions undetected across PRs; 80% Go threshold exists but no enforcement on PRs, no Python thresholds"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No container runtime validation tests"
    impact: "Image builds succeed but startup failures (missing deps, wrong entrypoint, broken PYTHONPATH) only caught at deployment"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No autogluon-specific E2E tests"
    impact: "End-to-end prediction flow (model load → inference → response) never tested against a live KServe deployment"
    severity: "MEDIUM"
    effort: "12-20 hours"
quick_wins:
  - title: "Add Trivy container scanning to autogluon Docker publish workflow"
    effort: "1-2 hours"
    impact: "Immediate visibility into CVEs in the autogluon image's 500+ Python dependencies"
  - title: "Add Codecov upload to python-test.yml and Go test workflow"
    effort: "2-3 hours"
    impact: "PR-level coverage reporting, trend tracking, and regression prevention"
  - title: "Add container startup smoke test to Docker publish workflow"
    effort: "2-3 hours"
    impact: "Catch broken images before merge by running 'docker run --rm IMAGE python -m autogluonserver --help'"
  - title: "Create .claude/rules/ directory with test pattern guidance"
    effort: "2-3 hours"
    impact: "Standardize AI-generated tests to match existing pytest patterns and monkeypatch style"
recommendations:
  priority_0:
    - "Add Trivy/Grype container scanning to autogluonserver-docker-publish.yml to detect CVEs in the massive ML dependency tree"
    - "Integrate Codecov with coverage upload for both Go and Python test workflows"
  priority_1:
    - "Add container runtime smoke test — build image, verify it starts, check /v2/health/ready endpoint"
    - "Create autogluon-specific E2E test that deploys an InferenceService with autogluonserver and runs prediction"
    - "Add CodeQL/SAST scanning workflow for Go and Python code"
  priority_2:
    - "Create .claude/rules/ with test creation guidance for unit, integration, and E2E tests"
    - "Add mypy type checking to CI for autogluonserver (Makefile target exists but not in CI)"
    - "Add performance regression testing for autogluon prediction latency"
---

# Quality Analysis: kserve-autogluon-server

## Executive Summary

- **Overall Score: 6.8/10**
- **Repository Type**: Fork of upstream KServe with added AutoGluon model server for Red Hat OpenShift AI
- **Primary Languages**: Go (controllers, webhooks, agent) + Python (SDK, model servers including autogluonserver)
- **Key Strengths**: Excellent autogluonserver unit test coverage (nearly 1:1 test-to-source ratio), comprehensive CI/CD with 11 workflows, strong linting (48+ Go linters, Ruff for Python), multi-arch Docker builds with SBOM, good CLAUDE.md documentation
- **Critical Gaps**: No security scanning, no coverage reporting service, no container runtime validation, no autogluon-specific E2E tests
- **Agent Rules Status**: Present (CLAUDE.md + AGENTS.md) but incomplete — no `.claude/rules/` for test automation guidance

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Excellent autogluon tests; 163 Go + 177 Python test files; multi-version matrix |
| Integration/E2E | 7.5/10 | 67 E2E test files; Minikube infra; no autogluon-specific E2E |
| Build Integration | 6.0/10 | Multi-arch Docker builds on PR; SBOM on push; no Konflux simulation |
| **Image Testing** | **4.5/10** | **Build-only validation; no runtime tests; no vuln scanning** |
| **Coverage Tracking** | **5.0/10** | **Coverage generated but not uploaded/reported; Go threshold exists, Python has none** |
| CI/CD Automation | 8.0/10 | Well-organized workflows; concurrency control; caching; merge queue |
| Agent Rules | 7.0/10 | CLAUDE.md with commands + architecture; no .claude/rules/ |

## Critical Gaps

### 1. No Security Scanning in CI
- **Impact**: AutoGluon pulls in PyTorch, LightGBM, XGBoost, FastAI — hundreds of transitive dependencies with potential CVEs go undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Current State**: No Trivy, no CodeQL, no Snyk, no Semgrep, no Gitleaks in any workflow
- **What the gold standard does**: odh-dashboard runs Trivy on every PR; notebooks has 5-layer image validation

### 2. No Coverage Reporting Service
- **Impact**: PR reviewers have no visibility into coverage impact; regressions go unnoticed
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Current State**: `pytest --cov` runs and `coverage.out` generated for Go, but neither is uploaded to Codecov/Coveralls
- **Note**: Go has `.testcoverage.yml` with 80% threshold, but it's only applied locally — not enforced in CI on PRs

### 3. No Container Runtime Validation
- **Impact**: A broken entrypoint, missing `libgomp1`, or wrong `PYTHONPATH` would pass CI and only fail at deployment
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Current State**: `autogluonserver-docker-publish.yml` builds the image and verifies it compiles but never runs it

### 4. No AutoGluon-Specific E2E Tests
- **Impact**: The full prediction pipeline (model upload → InferenceService creation → prediction request → response validation) is never tested end-to-end
- **Severity**: MEDIUM
- **Effort**: 12-20 hours
- **Current State**: Upstream KServe E2E tests cover sklearn, xgboost, custom models, but not autogluon

## Quick Wins

### 1. Add Trivy Scanning to Docker Publish Workflow (1-2 hours)
Add after the build step in `autogluonserver-docker-publish.yml`:
```yaml
- name: Scan image for vulnerabilities
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: '${{ env.IMAGE_ID }}:${{ env.VERSION }}'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
```

### 2. Add Codecov Integration (2-3 hours)
Add to `python-test.yml` after test steps:
```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: /tmp/junit_unit_*.xml
    flags: python
    token: ${{ secrets.CODECOV_TOKEN }}
```

### 3. Add Container Startup Smoke Test (2-3 hours)
Add to `autogluonserver-docker-publish.yml` after build:
```yaml
- name: Smoke test autogluonserver image
  run: |
    docker run --rm -d --name ag-test $IMAGE_ID:test
    sleep 5
    docker exec ag-test python -c "from autogluonserver import AutoGluonTabularModel; print('import OK')"
    docker stop ag-test
```

### 4. Create Agent Test Rules (2-3 hours)
Create `.claude/rules/unit-tests.md` documenting:
- pytest framework with monkeypatch for mocking
- DummyPredictor pattern from existing tests
- InferRequest construction helpers
- Coverage expectations

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory** (11 total):
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `python-test.yml` | PR (python/**), push, merge_group | Unit tests for all Python servers (337 lines) |
| `autogluonserver-docker-publish.yml` | PR (python/**), push, tags | Docker build + publish for autogluon image |
| `e2e-test-modelcache.yaml` | PR (pkg/controller/**), merge_group | E2E tests for ModelCache/LocalModel/LLMISvc |
| `e2e-test-quick-install.yaml` | PR (hack/**, charts/**, config/**) | Installation validation (Kustomize + Helm) |
| `precommit-check.yml` | PR, merge_group | Runs `make check` (fmt, vet, lint, generate) |
| `go-license-check.yml` | PR (non-python), push | Validates Go dependency licenses |
| `auto-assign-reviewers.yml` | PR | Assigns reviewers automatically |
| `stalebot.yml` | schedule | Marks stale issues/PRs |
| `stalebot-reset.yml` | issue_comment | Resets stale label on activity |
| `rerun.yml` | issue_comment | Re-runs CI on `/rerun` comment |

**Strengths**:
- Concurrency control on all workflows (`cancel-in-progress: true`)
- Path-based filtering to avoid unnecessary runs
- Aggressive dependency caching (per-server venv caching)
- Merge queue support (`merge_group` triggers)
- SHA-pinned GitHub Actions (security best practice)
- Smart change detection for Helm vs Kustomize test matrix

**Gaps**:
- No security scanning workflow
- No coverage upload step
- E2E tests only for Go controller components, not Python model servers

### Test Coverage

**Go Tests** (163 files):
- Framework: Go `testing` + envtest (controller-runtime)
- CRD/webhook tests use envtest with real API server
- Controller tests comprehensive (v1alpha1, v1beta1, v1alpha2)
- Coverage threshold: 80% overall (via `.testcoverage.yml`)
- Excludes generated code from coverage

**Python Tests** (177 files):
- Framework: pytest with pytest-cov, pytest-asyncio
- Multi-version testing: Python 3.10, 3.11, 3.12
- Numpy 1.x compatibility tests (separate test matrix)
- Per-server test suites: kserve, storage, sklearn, xgb, autogluon, pmml, lgb, paddle, huggingface

**AutoGluon-Specific Tests** (7 test files, 1370 LOC):
- `test_model.py` (287 LOC) — tabular model predict v1/v2, error handling, type detection
- `test_timeseries_model.py` (433 LOC) — timeseries predictor, date handling, seasonal periods
- `test_version_compat.py` (199 LOC) — version constraint matching
- `test_predictor_detect.py` (152 LOC) — model type detection (tabular vs timeseries)
- `test_runtime_paths.py` (118 LOC) — path resolution and environment variables
- `test_predictor_factory.py` (93 LOC) — factory pattern tests
- `test_autogluon_model_repository.py` (75 LOC) — model repository loading

**Test-to-Code Ratio**: Autogluon = 1370:1383 (0.99:1) — excellent; Go = 163 test files / 223 source files (0.73:1)

### Code Quality

**Go Linting** (`.golangci.yml`):
- **48+ linters enabled** including gosec (security), gocritic, staticcheck, errorlint
- Formatters: gofmt, gofumpt, goimports
- Custom import alias enforcement
- Exclusions for generated code and test-only rules
- golangci-lint v2 config format

**Python Linting** (`ruff.toml`):
- Ruff for both linting and formatting
- Rules: B (bugbear), E (pycodestyle), F (pyflakes), W (warnings)
- Line length: 88
- Pre-commit hook configured for auto-format + lint

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- helm-docs for chart README generation
- SHA-pinned GitHub Actions verification
- ruff-format + ruff lint
- `make check` in CI enforces pre-commit ran

**Type Checking**:
- mypy configured for autogluonserver (`make type_check` in Makefile)
- Not run in CI (only local use)

### Container Images

**Main Dockerfile** (Go controller):
- Multi-stage build (deps → builder + license → distroless)
- `gcr.io/distroless/static:nonroot` base (minimal attack surface)
- go-licenses for third-party compliance
- Build caching with `--mount=type=cache`

**AutoGluon Dockerfile** (`python/autogluon.Dockerfile`):
- Multi-stage: builder → prod
- `python:3.12-slim-bookworm` base
- Non-root user (UID 1000)
- Runtime deps installed (libgomp1 for OpenMP)
- Third-party license generation
- Custom PyPI index for RHOAI-patched AutoGluon packages

**Agent Dockerfile** (`agent.Dockerfile`):
- Same pattern as controller — multi-stage, distroless, non-root

**Docker Publish Workflow**:
- Multi-arch: `linux/amd64, linux/arm64/v8`
- SBOM generation enabled (`sbom: true`)
- No image signing (cosign)
- No vulnerability scanning
- No runtime validation

### Security

| Practice | Status |
|----------|--------|
| Container scanning (Trivy/Snyk) | Not present |
| SAST (CodeQL/Semgrep) | Not present |
| Dependency scanning | Not present |
| Secret detection (Gitleaks) | Not present |
| License checking | Go: yes (go-licenses); Python: pip-licenses in Dockerfile |
| SHA-pinned Actions | Yes (enforced via pre-commit hook) |
| Non-root containers | Yes |
| Distroless base images | Yes (Go binaries) |
| SBOM generation | Yes (Docker push) |
| gosec linter | Yes (enabled in golangci-lint) |

### Agent Rules (Agentic Flow Quality)

- **Status**: Present but incomplete
- **CLAUDE.md**: Comprehensive — build/test/lint commands, architecture routing table, CI conventions, platform notes
- **AGENTS.md**: Points to CLAUDE.md via `@AGENTS.md`
- **`.claude/` directory**: Not present
- **`.claude/rules/`**: Not present
- **Coverage**: No test creation rules, no test pattern guidance, no quality gate checklists
- **Quality**: CLAUDE.md is well-structured and actionable for running tests, but doesn't guide AI agents on *writing* tests
- **Recommendation**: Generate test rules with `/test-rules-generator` to standardize AI-generated test patterns

## Recommendations

### Priority 0 (Critical)

1. **Add container vulnerability scanning** — Trivy in `autogluonserver-docker-publish.yml` and a new dedicated security workflow for CodeQL (Go + Python). AutoGluon's deep ML dependency tree is the highest-risk surface.

2. **Integrate Codecov/Coveralls** — Upload Go `coverage.out` and Python pytest-cov results. Add PR checks with minimum coverage thresholds. The infrastructure exists (Go threshold configured, pytest-cov runs) but results go nowhere.

### Priority 1 (High Value)

3. **Add container runtime smoke test** — After Docker build in CI, verify the autogluonserver image starts and responds to health check. Prevents broken image deployments.

4. **Create autogluon-specific E2E test** — Deploy an InferenceService with autogluonserver on Minikube, send a prediction request, validate the response. Follow the pattern in `test/e2e/` for other servers.

5. **Add SAST scanning** — GitHub CodeQL analysis for both Go and Python code. Complements gosec (already in linting) with deeper analysis.

### Priority 2 (Nice-to-Have)

6. **Create `.claude/rules/`** — Document test patterns (DummyPredictor mocking, InferRequest helpers, monkeypatch conventions) to standardize AI-generated tests.

7. **Enable mypy in CI** — The Makefile target exists; add it to `python-test.yml` for type safety enforcement.

8. **Add image signing** — Use cosign to sign published images, complementing the existing SBOM generation.

## Comparison to Gold Standards

| Practice | kserve-autogluon-server | odh-dashboard | notebooks | kserve upstream |
|----------|----------------------|---------------|-----------|-----------------|
| Unit test coverage | Strong (1:1 ratio for autogluon) | Strong | Moderate | Strong |
| E2E automation | Partial (no autogluon E2E) | Comprehensive | Comprehensive | Comprehensive |
| Coverage enforcement | Go threshold only (80%) | PR gating | Moderate | PR gating |
| Coverage reporting | None | Codecov | Moderate | Codecov |
| Container scanning | None | Trivy on PR | 5-layer validation | Limited |
| SAST/CodeQL | None | Present | Present | Present |
| Pre-commit hooks | Yes (3 hooks) | Yes | Yes | Yes |
| Multi-arch builds | Yes (amd64+arm64) | N/A | Yes | Yes |
| SBOM | Yes (push only) | Yes | Yes | Yes |
| Agent rules | CLAUDE.md (good) | Comprehensive rules | Basic | Moderate |
| Image runtime testing | None | Yes | Yes (5 layers) | Moderate |
| Secret detection | None (SHA-pinned Actions only) | Gitleaks | Moderate | Limited |

## File Paths Reference

| Category | Path |
|----------|------|
| CI Workflows | `.github/workflows/` (11 files) |
| Go Test Coverage Config | `.github/.testcoverage.yml` |
| Go Lint Config | `.golangci.yml` (48+ linters) |
| Python Lint Config | `ruff.toml` |
| Pre-commit Config | `.pre-commit-config.yaml` |
| AutoGluon Source | `python/autogluonserver/autogluonserver/` (10 files, 1383 LOC) |
| AutoGluon Tests | `python/autogluonserver/tests/` (7 files, 1370 LOC) |
| AutoGluon Dockerfile | `python/autogluon.Dockerfile` |
| AutoGluon pyproject.toml | `python/autogluonserver/pyproject.toml` |
| Go Controller Dockerfile | `Dockerfile` (distroless) |
| Agent Dockerfile | `agent.Dockerfile` (distroless) |
| E2E Tests | `test/e2e/` (67 test files) |
| Agent Rules | `CLAUDE.md`, `AGENTS.md` |
| Go Tests | `pkg/**/*_test.go` (163 files) |
| Python Tests | `python/**/*test*.py` (177 files) |
| Makefile | `Makefile` (build, test, lint targets) |
