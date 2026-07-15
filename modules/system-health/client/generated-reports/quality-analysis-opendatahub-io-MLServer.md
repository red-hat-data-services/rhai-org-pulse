---
repository: "opendatahub-io/MLServer"
overall_score: 7.2
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Extensive pytest suite with 148+ test files across core and 9 runtimes; async-first, parametrized, multi-Python-version matrix"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "gRPC/REST/Kafka/parallel integration tests with Docker; no E2E deployment testing on Kind/Minikube"
  - dimension: "Build Integration"
    score: 6.5
    status: "Konflux PR builds via Tekton + early-gate on-demand; no PR-time runtime validation or image startup testing"
  - dimension: "Image Testing"
    score: 5.5
    status: "Multi-stage UBI9 Dockerfile with BuildKit; Snyk image scanning on push/release; no runtime startup validation or multi-arch PR builds"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "No codecov/coveralls integration; no coverage thresholds; no PR coverage reporting"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "10 GitHub workflows + 4 Tekton pipelines; automated release, sync, requirements regeneration, benchmarks, licenses"
  - dimension: "Agent Rules"
    score: 8.0
    status: "Comprehensive AGENTS.md with branch strategy, gotchas, boundaries, and development conventions; no .claude/rules/ for test patterns"
critical_gaps:
  - title: "No code coverage tracking or enforcement"
    impact: "Cannot measure test coverage trends, identify untested code paths, or enforce minimum coverage on PRs"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container image runtime validation"
    impact: "Image startup failures and import errors not caught until deployment; trusted-runtimes.json validation only at build-time"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Security scanning only runs on SeldonIO fork"
    impact: "Security workflow has 'if: github.repository == SeldonIO/MLServer' guard — skips entirely on opendatahub-io fork"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No pre-commit hooks"
    impact: "Lint/format violations caught only in CI, not locally; developers can push non-conforming code"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "Benchmark and license workflows skip on fork"
    impact: "Performance regressions and license changes not tracked on opendatahub-io fork"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add pytest-cov and codecov integration"
    effort: "4-6 hours"
    impact: "Immediate visibility into coverage gaps; PR-level coverage reporting; enforce minimum thresholds"
  - title: "Enable security scanning on opendatahub-io fork"
    effort: "2-3 hours"
    impact: "Close critical security blind spot — Snyk scans currently skip the production fork entirely"
  - title: "Add pre-commit hooks for black, flake8, mypy"
    effort: "1-2 hours"
    impact: "Shift lint failures left; reduce CI roundtrips for formatting issues"
  - title: "Add image startup smoke test in CI"
    effort: "3-4 hours"
    impact: "Catch import errors, missing dependencies, and trusted-runtimes.json issues before merge"
  - title: "Create .claude/rules/ for test patterns"
    effort: "2-3 hours"
    impact: "Standardize AI-assisted test generation for the async pytest patterns used across the project"
recommendations:
  priority_0:
    - "Add pytest-cov coverage collection and codecov.io integration with minimum threshold enforcement"
    - "Fix security scanning: remove SeldonIO fork guard or add equivalent Snyk/Trivy scanning for opendatahub-io"
    - "Add container runtime smoke test: build image, start mlserver, verify health endpoint responds"
  priority_1:
    - "Add pre-commit hooks (.pre-commit-config.yaml) for black, flake8, mypy"
    - "Add image startup validation in PR workflow (docker run + health check)"
    - "Enable benchmarks on opendatahub-io fork to track performance regressions"
    - "Create .claude/rules/ with test creation patterns for unit, integration, and runtime tests"
  priority_2:
    - "Add E2E deployment testing with Kind/Minikube for KFServing V2 protocol validation"
    - "Add contract tests for gRPC/REST API boundaries"
    - "Add SBOM generation and image signing for supply chain security"
    - "Add multi-architecture build testing in PR workflow"
---

# Quality Analysis: MLServer (opendatahub-io/MLServer)

## Executive Summary

- **Overall Score: 7.2/10**
- **Repository Type:** Python ML inference server (V2 Inference Protocol / KFServing)
- **Primary Language:** Python 3.10-3.12
- **Framework:** FastAPI (REST) + gRPC + Kafka; Poetry monorepo with 9 runtime packages
- **Key Strengths:** Excellent test suite structure with 148+ test files, comprehensive CI/CD automation (10 GitHub workflows + 4 Tekton pipelines), strong AGENTS.md documentation, sophisticated branch sync and release automation
- **Critical Gaps:** No coverage tracking/enforcement, security scanning skips the production fork, no container runtime validation, no pre-commit hooks
- **Agent Rules Status:** Strong AGENTS.md present; no `.claude/rules/` test pattern documentation

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Extensive pytest suite with 148+ test files; async-first, parametrized, multi-Python matrix |
| Integration/E2E | 7.0/10 | gRPC/REST/Kafka/parallel integration tests; no Kind/Minikube deployment testing |
| **Build Integration** | **6.5/10** | **Konflux PR builds + early-gate on-demand; no PR-time runtime or image startup validation** |
| Image Testing | 5.5/10 | Multi-stage UBI9 Dockerfile; Snyk scans on push; no runtime startup validation |
| Coverage Tracking | 3.0/10 | No codecov/coveralls; no thresholds; no PR reporting |
| CI/CD Automation | 8.5/10 | 10 workflows + 4 Tekton pipelines; automated release, sync, requirements, benchmarks |
| Agent Rules | 8.0/10 | Comprehensive AGENTS.md; no .claude/rules/ for test patterns |

## Critical Gaps

### 1. No Code Coverage Tracking or Enforcement
- **Impact:** Cannot measure test coverage trends, identify untested code paths, or enforce minimum coverage on PRs. Regressions in test coverage go undetected.
- **Severity:** HIGH
- **Effort:** 4-6 hours
- **Details:** Despite having 148+ test files, there is no `pytest-cov` integration, no `.codecov.yml`, no `.coveragerc`, and no coverage reporting in any workflow. The tox commands do not include `--cov` flags.

### 2. Security Scanning Only Runs on SeldonIO Fork
- **Impact:** The `security.yml` workflow contains `if: github.repository == 'SeldonIO/MLServer'` on all three jobs (scan-code, static-code-analysis, scan-image). This means **zero security scanning runs on the opendatahub-io fork** — the actual production fork.
- **Severity:** HIGH
- **Effort:** 2-3 hours
- **Details:** All three Snyk jobs (code scan, SAST, image scan) are gated. Similarly, `benchmark.yml` and `licenses.yml` also have this fork guard. The opendatahub-io fork relies on Konflux for build-time security but has no CI-level vulnerability scanning.

### 3. No Container Image Runtime Validation
- **Impact:** Image startup failures, missing Python dependencies, or incorrect `trusted-runtimes.json` configuration not caught until deployment. The Dockerfile generates `trusted-runtimes.json` at build time but this is never tested.
- **Severity:** HIGH
- **Effort:** 4-6 hours
- **Details:** No CI step starts the built container and validates the health endpoint. The `Dockerfile` includes runtime import validation during build but no post-build smoke test.

### 4. No Pre-commit Hooks
- **Impact:** Lint/format violations caught only in CI after push, not locally. Increases CI roundtrip time and PR iteration count.
- **Severity:** MEDIUM
- **Effort:** 1-2 hours
- **Details:** No `.pre-commit-config.yaml` exists. The project uses black, flake8, and mypy but only enforces them in CI via `make lint`.

### 5. Benchmarks and Licenses Skip Production Fork
- **Impact:** Performance regressions in REST/gRPC inference not tracked. License compliance changes in dependencies not detected.
- **Severity:** MEDIUM
- **Effort:** 2-3 hours
- **Details:** `benchmark.yml` (k6 load tests for REST/gRPC) and `licenses.yml` both guard with `if: github.repository == 'SeldonIO/MLServer'`.

## Quick Wins

### 1. Add pytest-cov and Codecov Integration (4-6 hours)
Enable coverage tracking across the entire test suite:

```yaml
# Add to pyproject.toml [tool.pytest.ini_options]
addopts = "--import-mode=importlib --cov=mlserver --cov-report=xml"

# Add .codecov.yml
coverage:
  status:
    project:
      default:
        target: 70%
    patch:
      default:
        target: 80%

# Add to tests.yml after test steps:
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    file: coverage.xml
    flags: unittests
```

### 2. Enable Security Scanning on opendatahub-io Fork (2-3 hours)
Remove or update the fork guard in `security.yml`:

```yaml
# Change from:
if: github.repository == 'SeldonIO/MLServer'
# To:
if: github.repository == 'SeldonIO/MLServer' || github.repository == 'opendatahub-io/MLServer'
```

Or add a standalone Trivy scan that works without secrets:

```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    scan-type: 'fs'
    scan-ref: '.'
    severity: 'HIGH,CRITICAL'
```

### 3. Add Pre-commit Hooks (1-2 hours)
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/psf/black
    rev: 24.8.0
    hooks:
      - id: black
  - repo: https://github.com/PyCQA/flake8
    rev: 7.0.0
    hooks:
      - id: flake8
        args: [--max-line-length=88, --extend-ignore=E203]
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.11.2
    hooks:
      - id: mypy
        additional_dependencies: [pydantic]
```

### 4. Add Image Startup Smoke Test (3-4 hours)
```yaml
# Add to tests.yml or a new workflow
- name: Build test image
  run: docker build . --build-arg RUNTIMES="sklearn" -t mlserver-test:ci
- name: Smoke test image
  run: |
    docker run -d --name mlserver-smoke -p 8080:8080 mlserver-test:ci
    sleep 10
    curl -f http://localhost:8080/v2/health/ready || exit 1
    docker stop mlserver-smoke
```

### 5. Create .claude/rules/ for Test Patterns (2-3 hours)
Generate test creation rules using `/test-rules-generator` to codify the project's async pytest patterns, conftest.py conventions, and trusted-runtimes fixture usage.

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (10 GitHub Workflows):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `tests.yml` | PR + push | Core tests: generate, lint, test-mlserver, test-runtimes, test-all-runtimes |
| `security.yml` | Push + daily cron | Snyk code/SAST/image scan (**skipped on ODH fork**) |
| `requirements.yml` | Every 12h + dispatch | Regenerate pinned requirements in containers |
| `publish.yml` | Release published | Update changelog, create PR to master |
| `release.yml` | Manual dispatch | Full release: draft, build images, scan, push, preflight, PyPI |
| `release-sc.yml` | Manual dispatch | SC variant release |
| `create-and-bump-tag.yml` | Manual dispatch | ODH release tagging and Konflux bump |
| `prow-merge-release-to-staging.yml` | Manual dispatch | Merge release branch to rhoai-staging |
| `benchmark.yml` | Daily cron | k6 REST/gRPC benchmarks (**skipped on ODH fork**) |
| `licenses.yml` | Daily cron | License compliance check (**skipped on ODH fork**) |

**Tekton Pipelines (4):**

| Pipeline | Trigger | Purpose |
|----------|---------|---------|
| `mlserver-pull-request.yaml` | PR to master | Konflux multi-arch container build |
| `mlserver-push.yaml` | Push to master | Konflux build → `odh-stable` tag |
| `early-gate-ci-build.yaml` | `/early-gate` comment | On-demand Konflux build validation |
| `early-gate-ci-test.yaml` | `/early-gate-test` comment | On-demand Konflux test validation |

**Strengths:**
- Multi-Python version matrix (3.10, 3.11, 3.12) with fail-fast disabled
- Conda + venv isolation testing
- Pinned action SHA references (security best practice)
- Concurrency control on sync workflow
- Slack notifications for branch sync results
- Sophisticated branch sync automation with conflict handling, excluded files, version re-stamping, and lock regeneration

**Gaps:**
- No concurrency control on `tests.yml` (multiple PR pushes queue up)
- No caching strategy (Poetry cache, pip cache) — every workflow installs from scratch
- Security, benchmark, and license workflows skip the production fork
- No test results reporting (JUnit XML, GitHub annotations)

### Test Coverage

**Test Structure:**
- **Core tests:** 106 test files in `tests/` across 14 subdirectories (batching, cache, cli, codecs, env, grpc, handlers, kafka, metrics, parallel, repository, rest, tracing, batch_processing)
- **Runtime tests:** 42 test files across 9 runtimes (sklearn, xgboost, lightgbm, onnx, mlflow, huggingface, alibi-explain, alibi-detect, catboost)
- **Total test files:** 148+
- **Source files:** 102 (mlserver/) + 129 (runtimes/) = 231 source files
- **Test-to-source ratio:** ~0.64 (good)

**Test Framework:**
- pytest 7.4.4 with asyncio_mode="auto"
- pytest-xdist for parallel execution (`-n auto`)
- pytest-mock, pytest-cases, pytest-lazy-fixture
- pytest-asyncio for async test support
- Docker SDK for container-based integration tests
- httpx for async FastAPI testing
- kafka-python-ng for Kafka integration tests
- aiohttp-retry for resilient HTTP testing

**Test Sophistication:**
- **Trusted-runtimes security model:** Tests run in PRODUCTION mode by default with a comprehensive allowlist (`TEST_ONLY_EXTRA_IMPLEMENTATIONS`). Fixtures `development_mode` and `empty_allowlist_mode` provide override controls.
- **Spawned process bootstrap:** `sitecustomize.py` injection via PYTHONPATH ensures spawned worker processes (multiprocessing) inherit test configuration — demonstrates deep understanding of Python process isolation.
- **Serial test isolation:** kafka, parallel, grpc, env, cli tests run serially after the parallel bulk to avoid port conflicts.
- **Per-runtime tox configs:** Each runtime has its own `tox.ini` (copied from `tox.runtime.ini` template).

**Gaps:**
- No coverage collection (`--cov` not used anywhere)
- No codecov/coveralls integration
- No coverage thresholds or PR reporting
- `test-all-runtimes` job only runs on push (not PR) — full cross-runtime compatibility not validated before merge
- No E2E deployment tests (Kind/Minikube with V2 protocol validation)

### Code Quality

**Linting Tools:**
- **black** 24.8.0 — code formatter (line length 88)
- **flake8** 7.0.0 — linter (max-line-length 88, ignore E203)
- **mypy** 1.11.2 — type checker with pydantic plugin, `ignore_missing_imports = true`
- Configuration in `pyproject.toml` (black, mypy, pytest) and `setup.cfg` (flake8)

**Code Generation:**
- Protobuf codegen from `proto/*.proto`
- OpenAPI types codegen from `openapi/*.yaml`
- `make generate` + `make lint-no-changes` validates generated code is up-to-date

**Strengths:**
- Three-tool lint pipeline (format + lint + types)
- mypy runs across mlserver, all runtimes, tests, hack, benchmarking, and docs/examples
- Generated code excluded from linting
- CI validates generated code is committed and up-to-date

**Gaps:**
- No `.pre-commit-config.yaml` — linting only enforced in CI
- No ruff (modern, faster alternative to flake8+black)
- No SAST tools on the opendatahub-io fork (CodeQL, Semgrep, gosec)
- No secret detection (Gitleaks, TruffleHog)

### Container Images

**Dockerfiles:**
- `Dockerfile` — Multi-stage UBI9 build with configurable runtimes (RUNTIMES build arg)
- `Dockerfile.cuda` — CUDA variant (exists in repo)
- `Dockerfile.konflux` — Only on `rhoai-staging` branch (not in master)

**Build Process:**
- Multi-stage: `wheel-builder` → final image
- Base: `registry.access.redhat.com/ubi9/ubi-minimal`
- Python 3.12, Poetry 2.1.1
- Wheel-based installation with constraints file
- `trusted-runtimes.json` generated at build time with import path validation
- Non-root user (UID 1000), world-writable workdir for random UID compatibility
- License files copied to `/licenses/`

**Security in Build:**
- Build-time import path validation (`is_valid_runtime_import_path`)
- Trusted-runtimes artifact (`/etc/mlserver/trusted-runtimes.json`) with mode 0o444
- Snyk image scanning in release workflow
- Red Hat preflight container certification in release workflow

**Gaps:**
- No multi-architecture build in PR workflow (Tekton does multi-arch on push)
- No image startup smoke test post-build
- No SBOM generation
- No image signing/attestation (Cosign/Sigstore)
- No Trivy scanning (only Snyk, which requires secrets)

### Security

**Existing Controls:**
- Snyk code scanning (SAST) — **only on SeldonIO fork**
- Snyk image scanning — **only on SeldonIO fork**
- Snyk policy file (`.snyk`) with documented CVE ignores for PySpark bundled JARs
- Dependabot for pip and Docker (weekly updates for root + all runtimes)
- Renovate for Dockerfile base images on `rhoai-staging`
- Pinned GitHub Action SHA references in tests.yml and requirements.yml (not in all workflows)
- Red Hat preflight certification for container images

**Gaps:**
- Security scanning entirely skipped on opendatahub-io fork (production fork)
- No CodeQL analysis
- No secret detection (Gitleaks, TruffleHog)
- Not all GitHub Actions are SHA-pinned (older workflows use `@v4`, `@v5`, `@master` tags)
- No dependency license audit in CI for the ODH fork

### Agent Rules (Agentic Flow Quality)

**Status:** Strong — `AGENTS.md` present at root

**AGENTS.md Coverage:**
- Repository description and purpose
- Python version and package manager constraints
- Generated files policy (read-only, sources listed)
- Development commands with examples
- 8 detailed "Gotchas" covering runtime registration, serial tests, lockfiles, version sync, Dockerfiles, branch-specific Tekton, and early-gate CI
- Boundaries (Always/Ask First/Never) — clear guardrails
- Full branch strategy documentation (ODH + RHDS branches)
- Release process documentation (ODH + RHOAI)
- Code ownership reference

**Quality Assessment:**
- Comprehensive and well-structured
- Actionable with specific commands and examples
- Up-to-date with current branch strategy
- Good security boundaries (CI/Tekton changes require sign-off)

**Gaps:**
- No `.claude/` directory or `.claude/rules/`
- No test-specific rules for AI-assisted test generation
- No documentation of the async pytest patterns, conftest.py conventions, or trusted-runtimes fixture usage for test generation

## Recommendations

### Priority 0 (Critical)

1. **Add pytest-cov coverage collection and codecov.io integration** — This is the single highest-impact quality improvement. The test suite is extensive but there's no way to measure or enforce coverage.

2. **Fix security scanning for opendatahub-io fork** — Remove or update the `if: github.repository == 'SeldonIO/MLServer'` guard. Either update to include `opendatahub-io/MLServer` or add standalone Trivy scanning that doesn't require Snyk secrets.

3. **Add container runtime smoke test** — After building the Docker image in CI, start the container and verify the health endpoint (`/v2/health/ready`) responds. This catches import errors, missing dependencies, and trusted-runtimes configuration issues.

### Priority 1 (High Value)

4. **Add pre-commit hooks** — Create `.pre-commit-config.yaml` with black, flake8, and mypy hooks to catch lint failures before push.

5. **Enable benchmarks on opendatahub-io fork** — The k6 benchmark infrastructure exists but is gated to SeldonIO. Enable it for performance regression tracking.

6. **Add concurrency control and caching to tests.yml** — Add `concurrency: group: ${{ github.ref }}` and Poetry/pip caching to reduce CI cost and queue times.

7. **Create `.claude/rules/` with test pattern documentation** — Document the async pytest conventions, conftest.py trusted-runtimes fixture usage, and per-runtime test isolation patterns to improve AI-assisted test generation.

8. **Pin all GitHub Action references to SHA** — Several workflows (security.yml, release.yml, benchmark.yml, licenses.yml) still use tag-based references (`@v4`, `@master`). Pin to SHA for supply chain security consistency.

### Priority 2 (Nice-to-Have)

9. **Add E2E deployment testing** — Set up Kind/Minikube-based testing to validate the full KFServing V2 protocol with model loading, inference, and health checks.

10. **Add contract tests for gRPC/REST API boundaries** — The OpenAPI spec and protobuf definitions exist; add contract validation tests to ensure the server conforms to the V2 protocol spec.

11. **Add SBOM generation and image signing** — Use Syft for SBOM and Cosign for image signing in the release pipeline.

12. **Add secret detection** — Integrate Gitleaks or TruffleHog to prevent accidental secret commits.

13. **Consider migrating to ruff** — Replace black + flake8 with ruff for faster linting with a single tool.

## Comparison to Gold Standards

| Dimension | MLServer | odh-dashboard | notebooks | kserve |
|-----------|----------|---------------|-----------|--------|
| Unit Tests | 8.5 — 148+ files, async, parametrized | 9.0 — Comprehensive Jest/Cypress | 6.0 — Image-focused | 9.0 — Go testing with envtest |
| Integration/E2E | 7.0 — gRPC/REST/Kafka; no deployment | 9.0 — Multi-layer + contract | 8.0 — 5-layer image validation | 9.5 — Multi-version E2E |
| Build Integration | 6.5 — Konflux PR + early-gate | 8.0 — PR-time full build | 7.0 — Image build matrix | 7.0 — Kind-based |
| Image Testing | 5.5 — Build-time validation only | 7.0 — Testcontainers | 9.0 — 5-layer validation | 6.0 — Basic builds |
| Coverage Tracking | 3.0 — None | 8.0 — Codecov with thresholds | 5.0 — Limited | 9.0 — Enforcement |
| CI/CD Automation | 8.5 — 14 pipelines, advanced sync | 9.0 — Well-organized | 8.0 — Multi-arch matrix | 8.5 — Comprehensive |
| Agent Rules | 8.0 — AGENTS.md with boundaries | 9.0 — Full .claude/rules/ | 3.0 — Minimal | 4.0 — Basic |

## File Paths Reference

### CI/CD
- `.github/workflows/tests.yml` — Main test workflow (PR + push)
- `.github/workflows/security.yml` — Snyk scanning (SeldonIO fork only)
- `.github/workflows/requirements.yml` — Requirements regeneration (every 12h)
- `.github/workflows/release.yml` — Full release pipeline
- `.github/workflows/release-sc.yml` — SC variant release
- `.github/workflows/create-and-bump-tag.yml` — ODH release tagging
- `.github/workflows/prow-merge-release-to-staging.yml` — Branch sync automation
- `.github/workflows/publish.yml` — Changelog update on release publish
- `.github/workflows/benchmark.yml` — k6 performance benchmarks
- `.github/workflows/licenses.yml` — License compliance check
- `.tekton/mlserver-pull-request.yaml` — Konflux PR build
- `.tekton/mlserver-push.yaml` — Konflux push build
- `.tekton/early-gate-ci-build.yaml` — On-demand Konflux build
- `.tekton/early-gate-ci-test.yaml` — On-demand Konflux test

### Testing
- `tests/` — 106 test files across 14 subdirectories
- `runtimes/*/tests/` — 42 test files across 9 runtimes
- `conftest.py` — Root conftest with trusted-runtimes PRODUCTION mode setup
- `tests/conftest.py` — Test-specific conftest
- `tests/fixtures.py` — Shared test model implementations
- `tox.ini` — Root tox configuration (mlserver-{conda,venv}, all-runtimes-{conda,venv})
- `tox.runtime.ini` — Template for runtime tox configs

### Code Quality
- `pyproject.toml` — black, mypy, pytest configuration
- `setup.cfg` — flake8 configuration
- `Makefile` — lint, fmt, test, generate targets

### Container Images
- `Dockerfile` — Multi-stage UBI9 production build
- `Dockerfile.cuda` — CUDA variant
- `.dockerignore` — Docker build exclusions
- `.snyk` — Snyk vulnerability policy

### Dependency Management
- `pyproject.toml` — Poetry dependency definitions
- `poetry.lock` — Locked dependencies
- `.github/dependabot.yml` — Dependabot for pip + Docker
- `.github/renovate.json` — Renovate for Dockerfile base images

### Agent Rules
- `AGENTS.md` — Comprehensive development guide with conventions and boundaries
- `OWNERS` — Code ownership
- `OWNERS_ALIASES` — Ownership aliases
