---
repository: "opendatahub-io/rhoai-observability-mcp"
overall_score: 7.4
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "Exceptional 1:1 test-to-code ratio with 112 tests across 19 files covering all modules"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "Kind-based E2E with Prometheus verification; path-filtered, no integration test suite"
  - dimension: "Build Integration"
    score: 6.0
    status: "PR-time container build (build-only, no push); no Konflux simulation or image startup test"
  - dimension: "Image Testing"
    score: 5.0
    status: "Multi-stage Containerfile with UBI9 base; no runtime validation, no vulnerability scanning"
  - dimension: "Coverage Tracking"
    score: 7.0
    status: "Codecov integration with multi-version matrix; no enforcement threshold in CI"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "Well-structured 3-workflow CI with concurrency control, Buildx caching, provenance attestation"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, .claude/ directory, or agent rules present"
critical_gaps:
  - title: "No container vulnerability scanning"
    impact: "CVEs in base images or dependencies go undetected until downstream scanning"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No coverage enforcement threshold in CI"
    impact: "Coverage can regress silently — fail_ci_if_error is false on codecov upload"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No security scanning (SAST/secret detection)"
    impact: "Vulnerabilities and leaked secrets not caught in PR workflow"
    severity: "HIGH"
    effort: "3-4 hours"
  - title: "Documented smoke_test.py does not exist"
    impact: "TESTING.md references a smoke test file that was never committed — misleading documentation"
    severity: "MEDIUM"
    effort: "0.5 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents have no guidance on test patterns, architecture, or quality standards"
    severity: "MEDIUM"
    effort: "3-4 hours"
quick_wins:
  - title: "Add Trivy container scanning to CI"
    effort: "1-2 hours"
    impact: "Catch CVEs in UBI9 base image and Python dependencies before merge"
  - title: "Enforce coverage threshold in pytest (--cov-fail-under=80)"
    effort: "0.5 hours"
    impact: "Prevent coverage regressions on every PR"
  - title: "Add CodeQL or Semgrep SAST workflow"
    effort: "1-2 hours"
    impact: "Automated detection of injection vulnerabilities and insecure patterns"
  - title: "Create the missing smoke_test.py or remove docs reference"
    effort: "0.5 hours"
    impact: "Eliminate documentation/code drift"
  - title: "Add pre-commit hooks for ruff check + format"
    effort: "1 hour"
    impact: "Catch lint/format issues before commit, reducing CI feedback loop"
recommendations:
  priority_0:
    - "Add Trivy or Grype container scanning to PR and push workflows"
    - "Enforce pytest --cov-fail-under=80 in CI (already documented in TESTING.md)"
    - "Add CodeQL or Semgrep security scanning workflow"
  priority_1:
    - "Add image startup/health-check validation in Kind E2E (currently only checks HTTP reachability)"
    - "Create integration test suite for live-backend scenarios (marked with @pytest.mark.integration)"
    - "Add dependency scanning (Dependabot or Renovate)"
    - "Generate SBOM for container images"
  priority_2:
    - "Create CLAUDE.md and .claude/rules/ for AI-assisted development patterns"
    - "Add multi-architecture builds (arm64 alongside amd64)"
    - "Implement the documented smoke_test.py for live cluster validation"
    - "Add Gitleaks secret detection to CI"
---

# Quality Analysis: rhoai-observability-mcp

## Executive Summary

- **Overall Score: 7.4/10**
- **Repository Type**: Python MCP server (Model Context Protocol) for Red Hat OpenShift AI observability
- **Primary Language**: Python 3.11+ with async/await patterns
- **Framework**: FastMCP + httpx + pydantic-settings + kubernetes client
- **Key Strengths**: Exceptional unit test coverage (1:1 test-to-code ratio), well-structured CI/CD with concurrency control and build caching, comprehensive E2E with Kind cluster, build provenance attestation
- **Critical Gaps**: No container vulnerability scanning, no SAST/secret detection, no coverage enforcement threshold, missing documented smoke test
- **Agent Rules Status**: Missing — no CLAUDE.md, .claude/, or agent rules present

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 9.0/10 | Exceptional 1:1 test-to-code ratio with 112 tests across 19 files |
| Integration/E2E | 7.0/10 | Kind-based E2E with Prometheus verification; path-filtered trigger |
| Build Integration | 6.0/10 | PR-time container build (no push); no Konflux simulation |
| Image Testing | 5.0/10 | Multi-stage Containerfile with UBI9; no runtime validation or scanning |
| Coverage Tracking | 7.0/10 | Codecov integration with multi-version matrix; no enforcement threshold |
| CI/CD Automation | 8.5/10 | 3 well-organized workflows with caching and provenance attestation |
| Agent Rules | 0.0/10 | No agent rules, CLAUDE.md, or .claude/ directory |

## Critical Gaps

### 1. No Container Vulnerability Scanning
- **Impact**: CVEs in the UBI9 base image or Python dependencies go undetected until downstream Konflux/Quay scanning
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: Neither Trivy, Grype, Snyk, nor any container scanner is integrated into CI workflows. The `container-build.yml` builds and pushes images without any vulnerability assessment.

### 2. No Coverage Enforcement Threshold in CI
- **Impact**: Coverage can regress silently on any PR — the codecov upload has `fail_ci_if_error: false`
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: The TESTING.md documents `--cov-fail-under=80` but the CI workflow (`ci.yml`) does NOT use this flag. The pytest command runs coverage but only generates reports without enforcing a minimum. Additionally, there is no `.codecov.yml` configuration for PR-level coverage checks or thresholds.

### 3. No Security Scanning (SAST / Secret Detection)
- **Impact**: Injection vulnerabilities, insecure patterns, or accidentally committed secrets are not caught
- **Severity**: HIGH
- **Effort**: 3-4 hours
- **Details**: No CodeQL, Semgrep, Bandit, or similar SAST tool. No Gitleaks or TruffleHog for secret detection. No Dependabot or Renovate for dependency vulnerability alerts.

### 4. Documented Smoke Test Does Not Exist
- **Impact**: TESTING.md documents `tests/smoke_test.py` with 8 test scenarios, but the file was never committed
- **Severity**: MEDIUM
- **Effort**: 0.5 hours
- **Details**: The TESTING.md provides detailed instructions for running a live-cluster smoke test against Prometheus, Alertmanager, Kubernetes API, and InferenceServices. The file does not exist in the repository, creating documentation/code drift.

### 5. No Agent Rules for AI-Assisted Development
- **Impact**: AI coding agents have no guidance on test patterns, architecture decisions, or quality standards for this repo
- **Severity**: MEDIUM
- **Effort**: 3-4 hours

## Quick Wins

### 1. Add Trivy Container Scanning to CI
- **Effort**: 1-2 hours
- **Impact**: Catch CVEs in UBI9 base image and Python dependencies before merge
- **Implementation**:
```yaml
# Add to container-build.yml after build step
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
```

### 2. Enforce Coverage Threshold in pytest
- **Effort**: 0.5 hours
- **Impact**: Prevent coverage regressions on every PR
- **Implementation**: Add `--cov-fail-under=80` to the pytest command in `ci.yml`:
```yaml
run: >
  uv run pytest tests/unit -v --tb=short
  --cov=src/rhoai_obs_mcp
  --cov-report=xml
  --cov-report=term
  --cov-fail-under=80
```

### 3. Add CodeQL Security Scanning
- **Effort**: 1-2 hours
- **Impact**: Automated detection of injection vulnerabilities and insecure patterns
- **Implementation**: Add `.github/workflows/codeql.yml` with Python language analysis

### 4. Fix Smoke Test Documentation Drift
- **Effort**: 0.5 hours
- **Impact**: Eliminate misleading documentation
- **Implementation**: Either create `tests/smoke_test.py` implementing the 8 scenarios documented in TESTING.md, or remove the smoke test section from documentation

### 5. Add Pre-commit Hooks
- **Effort**: 1 hour
- **Impact**: Catch lint/format issues before commit, reducing CI round-trip time
- **Implementation**:
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
      - id: ruff-format
```

## Detailed Findings

### CI/CD Pipeline

**Workflows (3 total):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | push/PR to main | Lint (ruff), typecheck (mypy), unit tests (3 Python versions) |
| `container-build.yml` | push/PR to main, tags | Container build with Buildx, GHCR push, provenance attestation |
| `kind-e2e.yml` | push/PR to main (path-filtered) | Kind cluster E2E: Kustomize validation, deploy, Prometheus scrape verification |

**Strengths:**
- All 3 workflows have concurrency control with `cancel-in-progress: true`
- Multi-version Python testing matrix (3.11, 3.12, 3.13)
- Docker Buildx with GHA caching (`cache-from: type=gha`)
- Build provenance attestation via `actions/attest-build-provenance@v2`
- Container build on PRs validates the image builds (without pushing)
- `ci-status` job aggregates all CI results for clean branch protection
- Kind E2E has a 15-minute timeout and failure debug collection

**Gaps:**
- Kind E2E is path-filtered (`deploy/`, `hack/`, `Makefile`, `Containerfile`) — changes to source code (`src/`) do NOT trigger E2E
- Container build only validates `linux/amd64` — no multi-arch support
- No dependency caching for `uv sync` in CI (each job re-downloads)
- No nightly/periodic scheduled CI runs

### Test Coverage

**Unit Tests: 9.0/10**
- **112 test functions** across **19 test files** organized in `tests/unit/`
- **1,712 lines of test code** vs **1,762 lines of source code** — near-perfect 1:1 ratio
- Every source module has a corresponding test file:
  - All 6 backends tested (`test_backends_*.py`)
  - All 7 tool modules tested (`test_tools_*.py`)
  - Core modules tested (`test_auth.py`, `test_config.py`, `test_server.py`, `test_main.py`)
- Graceful degradation tests: `test_loki_unavailable.py` and `test_tempo_unavailable.py` verify behavior when optional backends are not configured
- Tests use `respx` for HTTP mocking and `AsyncMock` for async patterns
- Tests cover happy paths, error responses, edge cases (empty results, unexpected types), and exception handling
- Well-structured with `setup_method` patterns for test class initialization
- Shared fixtures in `conftest.py` for settings and auth

**Integration/E2E Tests: 7.0/10**
- Kind E2E validates the full deployment pipeline: cluster creation → Helm install → Kustomize deploy → pod readiness → HTTP reachability → Prometheus scrape verification
- Kustomize overlay validation for both OpenShift and Kind environments
- Path-filtered triggers mean source code changes don't trigger E2E
- No dedicated integration test suite using `@pytest.mark.integration` (marker defined but unused)
- Missing documented `smoke_test.py`

### Code Quality

**Linting & Formatting: Strong**
- **Ruff** configured for Python 3.11 target, 100-char line length
- Both `ruff check` and `ruff format --check` enforced in CI
- **Mypy** type checking with `warn_unused_configs = true`
- `ignore_missing_imports = true` is lenient but acceptable for this project size

**Gaps:**
- No `.pre-commit-config.yaml` — linting only runs in CI, not locally
- No Bandit or similar Python security linter
- Mypy `warn_return_any = false` is more permissive than ideal

### Container Images

**Build Process: Good**
- Multi-stage Containerfile with builder/runtime separation
- UBI9 (Red Hat Universal Base Image) as base — enterprise-grade
- Uses `uv sync --frozen --no-dev` for reproducible, minimal installs
- Non-root user (`USER 1001`) for security
- Proper OCI labels
- Buildx with GHA caching

**Runtime Configuration:**
- Environment-based configuration via pydantic-settings
- Resource limits in deployment manifest (128Mi-256Mi memory, 100m-500m CPU)
- Liveness and readiness probes configured (TCP socket on port 8080)

**Gaps:**
- No vulnerability scanning (Trivy, Grype, or Snyk)
- No SBOM generation
- No image signing (only provenance attestation)
- Single architecture (linux/amd64 only)
- No container startup test in CI (E2E checks HTTP but only after full Kind deployment)

### Security

**Current State: Weak**
- No SAST tools (CodeQL, Semgrep, Bandit)
- No secret detection (Gitleaks, TruffleHog)
- No container vulnerability scanning
- No dependency scanning (Dependabot, Renovate)
- No `.trivyignore` or vulnerability exception management

**Positive:**
- Non-root container user
- Build provenance attestation
- Environment-based secrets (no hardcoded credentials)
- Token-based auth with proper `AuthProvider` abstraction
- `.gitignore` excludes `.env` files

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No test automation guidance for AI agents
- **Quality**: N/A
- **Gaps**: No CLAUDE.md, no `.claude/` directory, no `.claude/rules/` for test creation patterns
- **Recommendation**: Generate rules with `/test-rules-generator` covering:
  - Unit test patterns (respx mocking, AsyncMock, conftest fixtures)
  - Backend test patterns (HTTP response mocking)
  - Tool test patterns (register + call pattern)
  - E2E test patterns (Kind deployment validation)

## Recommendations

### Priority 0 (Critical)

1. **Add container vulnerability scanning** — Integrate Trivy or Grype into `container-build.yml` to catch CVEs in UBI9 base image and Python dependencies before merge
2. **Enforce coverage threshold** — Add `--cov-fail-under=80` to pytest in CI (documented but not enforced)
3. **Add CodeQL or Semgrep SAST** — Create a security scanning workflow for Python code analysis

### Priority 1 (High Value)

1. **Remove path filter from Kind E2E or add source paths** — Source code changes (`src/`) should also trigger E2E since they affect server behavior
2. **Add dependency scanning** — Enable Dependabot or Renovate for automated vulnerability alerts on Python dependencies
3. **Create integration test suite** — Implement tests marked with `@pytest.mark.integration` for live-backend scenarios (the marker is already defined)
4. **Add SBOM generation** — Generate Software Bill of Materials for container images using Syft or similar

### Priority 2 (Nice-to-Have)

1. **Create CLAUDE.md and .claude/rules/** — Provide AI agents with test patterns, architecture decisions, and quality standards
2. **Add multi-architecture builds** — Extend container-build.yml to build `linux/arm64` alongside `linux/amd64`
3. **Implement smoke_test.py** — Create the documented but missing live-cluster smoke test
4. **Add pre-commit hooks** — Configure `.pre-commit-config.yaml` with ruff check/format hooks
5. **Add Gitleaks secret detection** — Prevent accidental credential commits
6. **Add uv dependency caching in CI** — Cache `~/.cache/uv` to speed up `uv sync` across workflow runs

## Comparison to Gold Standards

| Practice | rhoai-observability-mcp | odh-dashboard | notebooks | kserve |
|----------|------------------------|---------------|-----------|--------|
| Unit test coverage | Excellent (1:1 ratio) | Strong | Moderate | Strong |
| Integration tests | Marker defined, unused | Contract tests | N/A | Multi-version |
| E2E tests | Kind-based, path-filtered | Cypress + API | Image validation | KinD + envtest |
| Coverage tracking | Codecov (no threshold) | Codecov enforced | N/A | Codecov enforced |
| Coverage enforcement | Not enforced | Enforced | N/A | Enforced |
| Container scanning | None | Trivy | Trivy | Trivy |
| SAST | None | CodeQL | None | CodeQL |
| Secret detection | None | Gitleaks | None | None |
| Multi-arch | amd64 only | amd64 only | Multi-arch | Multi-arch |
| Build attestation | Yes (provenance) | No | No | No |
| Agent rules | None | Comprehensive | None | None |
| Pre-commit hooks | None | Yes | Yes | Yes |
| Dependency scanning | None | Dependabot | Renovate | Dependabot |

## File Paths Reference

| Category | Path | Notes |
|----------|------|-------|
| CI - Lint/Test | `.github/workflows/ci.yml` | ruff, mypy, pytest across 3 Python versions |
| CI - Container | `.github/workflows/container-build.yml` | Buildx build, GHCR push, provenance attestation |
| CI - E2E | `.github/workflows/kind-e2e.yml` | Kind cluster deploy + Prometheus scrape verify |
| Source code | `src/rhoai_obs_mcp/` | 20 Python files, 1,762 lines |
| Unit tests | `tests/unit/` | 19 test files, 1,712 lines, 112 test functions |
| Containerfile | `Containerfile` | Multi-stage, UBI9-based |
| Deploy manifests | `deploy/base/`, `deploy/overlays/` | Kustomize-based for OpenShift and Kind |
| Project config | `pyproject.toml` | Hatchling build, dev deps, ruff/mypy/pytest config |
| Makefile | `Makefile` | Build, deploy, Kind cluster management targets |
| Testing docs | `TESTING.md` | Test structure and patterns (references missing smoke_test.py) |
| Contributing | `CONTRIBUTING.md` | Code standards, project structure |
