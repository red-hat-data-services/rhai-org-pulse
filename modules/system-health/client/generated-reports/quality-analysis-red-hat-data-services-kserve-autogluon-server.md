---
repository: "red-hat-data-services/kserve-autogluon-server"
overall_score: 5.3
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Strong autogluon-specific unit tests (1:1 test-to-code ratio); upstream Go tests inherited but no golangci-lint config"
  - dimension: "Integration/E2E"
    score: 6.5
    status: "Autogluon E2E tests for tabular and timeseries (v1/v2 protocols); upstream suite inherited but no CI to run them"
  - dimension: "Build Integration"
    score: 4.0
    status: "Konflux PR build via Tekton (hermetic, multi-arch) but no image runtime validation or startup testing"
  - dimension: "Image Testing"
    score: 3.5
    status: "Multi-arch Konflux build (x86_64, ppc64le, s390x, arm64) but no container runtime validation, no Trivy scanning, no SBOM"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "Go coverage.out generated locally but no Codecov/Coveralls integration, no thresholds, no PR reporting"
  - dimension: "CI/CD Automation"
    score: 4.0
    status: "Tekton PR pipeline for image build only; no GitHub Actions workflows, no automated test execution on PRs"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No .claude directory, no CLAUDE.md, no AGENTS.md, no test automation guidance for AI agents"
critical_gaps:
  - title: "No CI-driven test execution on PRs"
    impact: "Unit tests, integration tests, and linting are not automatically validated on pull requests — regressions can merge undetected"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No container image runtime validation"
    impact: "Built images are never tested for startup, health checks, or basic inference — broken images reach production"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No security scanning (Trivy, SAST, dependency scanning)"
    impact: "Vulnerabilities in Python dependencies and base images are not detected before merge"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Coverage can silently decrease without anyone noticing; no visibility into untested code paths"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No golangci-lint configuration"
    impact: "Go linting relies on upstream config but no local enforcement; code quality inconsistencies possible in downstream changes"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add GitHub Actions workflow for autogluon unit tests"
    effort: "2-3 hours"
    impact: "Catch regressions in the autogluon-specific Python code on every PR"
  - title: "Add Trivy container image scanning to Tekton pipeline"
    effort: "1-2 hours"
    impact: "Early detection of CVEs in base image and Python dependency chain"
  - title: "Add pytest-cov reporting to autogluon test suite"
    effort: "1-2 hours"
    impact: "Visibility into test coverage for the autogluon-specific code (already declared as a test dependency)"
  - title: "Create basic .claude/rules/ for test patterns"
    effort: "2-3 hours"
    impact: "Standardize AI-generated test quality for autogluon model code"
  - title: "Add golangci-lint config file"
    effort: "1 hour"
    impact: "Consistent Go code quality enforcement for any downstream Go modifications"
recommendations:
  priority_0:
    - "Add GitHub Actions CI workflow to run autogluon unit tests (pytest) and Go tests (make test) on every PR"
    - "Add container image startup and health check validation to the Tekton PR pipeline"
    - "Integrate Trivy or Grype scanning into the Konflux build pipeline for vulnerability detection"
  priority_1:
    - "Set up Codecov integration with coverage thresholds for both Go and Python code"
    - "Add autogluon-specific E2E tests to a periodic CI job (requires cluster with model artifacts)"
    - "Create agent rules (.claude/rules/) for unit test, integration test, and E2E test patterns"
    - "Add pre-commit hooks for ruff, go vet, and mypy type checking"
  priority_2:
    - "Add SBOM generation to the Konflux pipeline for supply chain transparency"
    - "Add image signing/attestation for built container images"
    - "Implement performance benchmarking for autogluon inference latency"
    - "Add contract tests for the KServe predict API (v1 and v2 protocol conformance)"
---

# Quality Analysis: kserve-autogluon-server

## Executive Summary

- **Overall Score: 5.3/10**
- **Repository Type**: Red Hat downstream fork of KServe with AutoGluon model server component
- **Primary Languages**: Go (operator/controller), Python (autogluon model server)
- **Key Strength**: Solid autogluon-specific unit tests with 1:1 test-to-code ratio (1,357 test lines / 1,318 source lines), E2E tests for both tabular and timeseries models
- **Critical Gap**: No CI-driven test execution on PRs — the only PR automation is Konflux image building via Tekton. Tests, linting, and coverage are not enforced.
- **Agent Rules Status**: Missing — no `.claude/` directory or agent guidance files

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | Strong autogluon Python tests; upstream Go tests inherited |
| Integration/E2E | 6.5/10 | Autogluon E2E tests exist but not CI-automated |
| **Build Integration** | **4.0/10** | **Konflux PR build only — no test execution or image validation** |
| Image Testing | 3.5/10 | Multi-arch build, no runtime validation or scanning |
| Coverage Tracking | 3.0/10 | Local coverage.out, no integration or thresholds |
| CI/CD Automation | 4.0/10 | Tekton image build only, no GitHub Actions |
| Agent Rules | 0.0/10 | No agent rules or test automation guidance |

## Critical Gaps

### 1. No CI-Driven Test Execution on PRs
- **Impact**: Regressions in autogluon server code or Go controller code can merge without any automated test validation
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: The repository has zero GitHub Actions workflows. The only CI automation is a Tekton PipelineRun (`.tekton/odh-kserve-autogluon-on-pull-request.yaml`) that builds the container image on PRs triggered by `/build-konflux-autogluon` comment or `kfbuild-autogluon` label — but runs no tests.
- **Recommendation**: Add a GitHub Actions workflow that runs `cd python/autogluonserver && make test` for Python tests and `make test` for Go tests on every PR

### 2. No Container Image Runtime Validation
- **Impact**: Built images are pushed without verifying they can start, pass health checks, or serve inference requests
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The Tekton pipeline builds multi-arch images (x86_64, ppc64le, s390x, arm64) but never validates that the resulting image actually works
- **Recommendation**: Add a post-build step that starts the container and validates the health endpoint (`/v2/models/*/ready`)

### 3. No Security Scanning
- **Impact**: CVEs in the extensive Python dependency chain (AutoGluon + all its ML dependencies) and Red Hat base image go undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Trivy, Snyk, CodeQL, gosec, Semgrep, or Gitleaks integration found anywhere in the repository
- **Recommendation**: Add Trivy scanning as a Tekton task in the Konflux pipeline, or add a GitHub Actions workflow for dependency scanning

### 4. No Coverage Tracking or Enforcement
- **Impact**: Coverage trends invisible; quality can silently degrade
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: Go tests generate `coverage.out` locally, Python tests have `pytest-cov` as a dependency but it's not used in the Makefile (`pytest -W ignore` without `--cov`). No Codecov/Coveralls integration exists. No `.codecov.yml` found.
- **Recommendation**: Enable `pytest --cov=autogluonserver --cov-report=xml` and integrate with Codecov

### 5. No golangci-lint Configuration
- **Impact**: Go linting runs but with no custom configuration — relies on upstream defaults that may not match Red Hat downstream standards
- **Severity**: MEDIUM
- **Effort**: 1-2 hours

## Quick Wins

### 1. Add GitHub Actions Workflow for Autogluon Unit Tests (2-3 hours)
```yaml
# .github/workflows/autogluon-tests.yml
name: AutoGluon Unit Tests
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: |
          cd python/autogluonserver
          make dev_install
          make test
```

### 2. Add Trivy Container Scanning (1-2 hours)
Add as a Tekton task after the image build step, or add a GitHub Actions workflow:
```yaml
# .github/workflows/security-scan.yml
name: Security Scan
on: [pull_request]
jobs:
  trivy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'CRITICAL,HIGH'
```

### 3. Enable pytest-cov (1-2 hours)
The dependency is already declared in `pyproject.toml`. Update `python/autogluonserver/Makefile`:
```makefile
test: type_check
	pytest --cov=autogluonserver --cov-report=xml --cov-report=term -W ignore
```

### 4. Create Basic Agent Rules (2-3 hours)
Create `.claude/rules/` with test patterns for the autogluon model server:
- `unit-tests.md` — pytest patterns, monkeypatching, DummyPredictor pattern
- `e2e-tests.md` — KServe InferenceService deployment patterns

### 5. Add golangci-lint Config (1 hour)
Copy upstream KServe's `.golangci.yaml` or create a minimal one with Go best-practice linters enabled.

## Detailed Findings

### CI/CD Pipeline

**Current State**: Minimal — one Tekton PipelineRun for Konflux image building only.

| Aspect | Finding |
|--------|---------|
| **GitHub Actions** | None — no `.github/workflows/` directory |
| **Tekton Pipelines** | 1 PipelineRun for PR image build (comment/label triggered) |
| **Build Trigger** | `/build-konflux-autogluon` comment or `kfbuild-autogluon` label |
| **Concurrency** | Tekton `cancel-in-progress: true` |
| **Multi-arch** | x86_64, ppc64le, s390x, arm64 |
| **Hermetic Build** | Yes — `hermetic: true` with pip prefetch |
| **Test on PR** | No — no tests run on any PR trigger |
| **Prow** | Legacy prow_config.yaml present but all workflows commented out |

**Key Issue**: The Tekton pipeline is managed centrally via `konflux-central` — changes require PRs to that repo, not this one. This adds friction to adding test steps.

### Test Coverage

#### Autogluon-Specific Tests (Python)
| Metric | Value |
|--------|-------|
| Source files | 7 modules (1,318 lines) |
| Test files | 7 test modules (1,357 lines) |
| Test-to-code ratio | 1.03:1 (excellent) |
| Testing framework | pytest + pytest-asyncio |
| Type checking | mypy (integrated into `make test`) |
| Coverage tool | pytest-cov declared but not used in CI |

**Test Quality Assessment**: The autogluon tests are well-structured:
- `test_model.py` (287 lines) — Comprehensive tabular model testing with DummyPredictor pattern, v1/v2 protocol coverage, error handling, proba mode
- `test_timeseries_model.py` (433 lines) — TimeSeriesPredictor with metadata handling, forecast validation
- `test_predictor_factory.py` (93 lines) — Factory delegation to tabular/timeseries
- `test_predictor_detect.py` (152 lines) — Model type detection logic
- `test_version_compat.py` (199 lines) — Version compatibility validation
- `test_runtime_paths.py` (118 lines) — Runtime path resolution
- `test_autogluon_model_repository.py` (75 lines) — Model repository management

#### Upstream KServe Tests (Inherited)
| Metric | Value |
|--------|-------|
| Go test files | 162 files across 40+ packages |
| Go source files | 336 files |
| Test-to-code ratio | 0.48:1 (moderate) |
| E2E test files | 85 Python files in `test/e2e/` |
| Testing framework | Go testing + Ginkgo/Gomega, pytest |
| envtest | Yes — Kubernetes envtest for controller testing |

#### E2E Tests
- **Autogluon-specific**: `test_autogluon.py` (121 lines) and `test_autogluon_timeseries.py` (95 lines)
  - Tests v1 and v2 KServe protocols
  - Uses `kserve-autogluonserver` runtime
  - Requires cluster + model artifacts in GCS
- **Upstream E2E**: 85 files covering predictors, transformers, explainers, graph, helm, etc.
- **Not CI-automated**: No workflow triggers E2E tests

### Code Quality

| Tool | Status |
|------|--------|
| **Go linting** | `golangci-lint` in Makefile (no `.golangci.yaml` config file) |
| **Go vet** | Yes — `go vet ./pkg/... ./cmd/...` |
| **Go fmt** | Yes — `go fmt ./pkg/... ./cmd/...` |
| **Python linting** | Ruff (E, F, W, B rules) via `ruff.toml` |
| **Python formatting** | Ruff format (line-length=88) |
| **Python type checking** | mypy (autogluon-specific) |
| **Pre-commit hooks** | None — no `.pre-commit-config.yaml` |
| **Precommit target** | `make precommit` exists (comprehensive: vet, lint, fmt, generate, manifests) |
| **CI enforcement** | None — `make check`/`make precommit` not run in any CI |

### Container Images

| Aspect | Finding |
|--------|---------|
| **Dockerfiles** | 7 total: main Dockerfile, 5 component Dockerfiles, 1 Konflux-specific |
| **Konflux Dockerfile** | `Dockerfile.konflux.autogluon` — multi-stage, Red Hat base image |
| **Base Image** | `registry.redhat.io/rhai/base-image-cpu-rhel9` (hardcoded digest) |
| **Multi-stage** | Yes — builder + prod stages |
| **Multi-arch** | Yes — x86_64, ppc64le, s390x, arm64 via Tekton |
| **License generation** | Yes — `pip-licenses.py` in build |
| **Non-root user** | Yes — `USER 1001` in final stage |
| **Runtime validation** | None — no health check, no smoke test |
| **Trivy/Snyk scanning** | None |
| **SBOM generation** | None |
| **Image signing** | None |

### Security

| Practice | Status |
|----------|--------|
| Hermetic builds | Yes (Konflux) |
| Dependency pinning | Yes (pip with Red Hat index, Go modules) |
| Base image pinning | Yes (SHA256 digest) |
| Container scanning | Not found |
| SAST/CodeQL | Not found |
| Dependency scanning | Not found |
| Secret detection | Not found |
| Pinned GH Actions | Yes — `make verify-pinned-actions` target with `pinact` tool |
| Non-root container | Yes |

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No test type rules exist
- **Quality**: N/A
- **Gaps**: No `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Recommendation**: Generate test automation rules with `/test-rules-generator` covering:
  - Python unit test patterns (pytest, monkeypatching, DummyPredictor)
  - Go unit test patterns (Ginkgo/Gomega, envtest)
  - E2E test patterns (KServe InferenceService, async fixtures)

## Recommendations

### Priority 0 (Critical)

1. **Add CI workflow for test execution on PRs**
   - GitHub Actions workflow running autogluon unit tests (`pytest`) on every PR
   - Go tests (`make test`) for any controller changes
   - Ruff linting and mypy type checking

2. **Add container image runtime validation**
   - After Konflux builds the image, start it and validate health endpoint
   - Verify `python -m autogluonserver` starts without errors

3. **Integrate security scanning**
   - Trivy for container image and filesystem scanning
   - Dependency vulnerability scanning for the extensive Python ML dependency chain

### Priority 1 (High Value)

4. **Set up coverage tracking with Codecov**
   - Enable `pytest-cov` (already a declared dependency)
   - Add Codecov integration with minimum thresholds
   - Report coverage on PRs

5. **Automate E2E tests in periodic CI**
   - The autogluon E2E tests exist but need a cluster environment
   - Set up a periodic job (daily/weekly) to run `test_autogluon.py` and `test_autogluon_timeseries.py`

6. **Create agent rules for test automation**
   - `.claude/rules/unit-tests.md` — Python and Go unit test patterns
   - `.claude/rules/e2e-tests.md` — KServe E2E test patterns

7. **Add pre-commit hooks**
   - `.pre-commit-config.yaml` with ruff, mypy, go vet, golangci-lint

### Priority 2 (Nice-to-Have)

8. **Add SBOM generation** to Konflux pipeline
9. **Add image signing/attestation** for supply chain security
10. **Performance benchmarks** for AutoGluon inference latency (tabular and timeseries)
11. **Contract tests** for KServe predict API v1/v2 protocol conformance
12. **Add golangci-lint config** for downstream Go code quality

## Comparison to Gold Standards

| Dimension | kserve-autogluon-server | odh-dashboard (Gold) | notebooks (Gold) | kserve (Upstream) |
|-----------|----------------------|---------------------|-------------------|------------------|
| Unit Tests | 7.5 — Strong AG-specific | 9.0 — Multi-layer | 7.0 — Image-focused | 8.5 — Comprehensive |
| Integration/E2E | 6.5 — Tests exist, not CI'd | 9.0 — Cypress + API | 8.0 — 5-layer validation | 9.0 — Multi-version |
| Build Integration | 4.0 — Konflux only | 8.5 — PR builds + test | 7.5 — Image validation | 7.0 — GH Actions |
| Image Testing | 3.5 — Multi-arch, no validation | 7.0 — Build + test | 9.0 — 5-layer pipeline | 6.5 — Basic |
| Coverage Tracking | 3.0 — Local only | 9.0 — Codecov enforced | 5.0 — Basic | 8.0 — Codecov |
| CI/CD Automation | 4.0 — Tekton build only | 9.5 — Full pipeline | 8.5 — Automated | 9.0 — GH Actions |
| Agent Rules | 0.0 — None | 8.0 — Comprehensive | 2.0 — Minimal | 3.0 — Basic |

## File Paths Reference

### CI/CD
- `.tekton/odh-kserve-autogluon-on-pull-request.yaml` — Konflux PR build pipeline
- `.tekton/README.md` — Explains Tekton sync from konflux-central
- `prow_config.yaml` — Legacy Prow config (all workflows disabled)

### Testing (Autogluon-specific)
- `python/autogluonserver/tests/` — 7 unit test files (1,357 lines)
- `python/autogluonserver/Makefile` — Test targets (test, type_check)
- `test/e2e/predictor/test_autogluon.py` — E2E tabular tests
- `test/e2e/predictor/test_autogluon_timeseries.py` — E2E timeseries tests
- `test/e2e/pytest.ini` — E2E test markers

### Testing (Upstream/Go)
- `pkg/` — 152 Go test files across 40+ packages
- `Makefile` — `test`, `precommit`, `check` targets
- `coverage.sh` — Go coverage processing script

### Code Quality
- `ruff.toml` — Python linting config (B, E, F, W rules)
- `Makefile.tools.mk` — Tool definitions (golangci-lint, ruff, etc.)
- `Makefile` — `precommit` target (comprehensive quality checks)

### Container Images
- `Dockerfile.konflux.autogluon` — Red Hat Konflux build (multi-stage, RH base image)
- `Dockerfile` — Upstream Go manager build
- `agent.Dockerfile`, `router.Dockerfile`, etc. — Component-specific builds

### Configuration
- `go.mod` — Go dependencies
- `python/autogluonserver/pyproject.toml` — Python package config with test deps
- `kserve-deps.env` — Version-pinned tool dependencies
