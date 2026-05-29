---
repository: "red-hat-data-services/mlflow"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "764 Python + 509 JS test files; pytest with splits/parallelization; strong test-to-code ratio"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "Database integration tests with Docker Compose; fs2db E2E; Playwright e2e scaffolding; limited full-stack E2E"
  - dimension: "Build Integration"
    score: 7.5
    status: "Konflux/Tekton PR builds with multi-arch; hermetic builds; no PR-time image runtime validation"
  - dimension: "Image Testing"
    score: 5.0
    status: "Multi-arch Konflux builds; SBOM via Syft; no container runtime validation or startup testing"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "pytest-cov in test deps but no codecov integration, no coverage thresholds, no PR coverage reporting"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "25+ workflows; concurrency control; path-filtering; matrix strategies; daily scheduled runs; benchmarks"
  - dimension: "Agent Rules"
    score: 8.0
    status: "Comprehensive CLAUDE.md; .claude/rules for Python and GitHub Actions; hooks; 7+ skills; settings.json"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Cannot measure test coverage trends; regressions go undetected; no PR-level coverage gates"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container runtime validation"
    impact: "Image startup failures, missing dependencies, or runtime errors not caught until deployment"
    severity: "HIGH"
    effort: "6-8 hours"
  - title: "No security scanning in CI (SAST/container scanning)"
    impact: "Vulnerabilities in dependencies or code not detected before merge; only SBOM generation present"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No E2E test automation for full-stack flows"
    impact: "UI-backend integration regressions discovered only in manual testing or production"
    severity: "MEDIUM"
    effort: "16-24 hours"
quick_wins:
  - title: "Add Codecov integration with coverage thresholds"
    effort: "2-4 hours"
    impact: "Immediate visibility into test coverage; prevents coverage regressions on PRs"
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Catch CVEs in base images and dependencies before merge"
  - title: "Add CodeQL/SAST scanning workflow"
    effort: "1-2 hours"
    impact: "Automated detection of code-level security vulnerabilities"
  - title: "Add container startup test to Konflux PR pipeline"
    effort: "2-3 hours"
    impact: "Verify built image starts and responds on health endpoint"
recommendations:
  priority_0:
    - "Implement Codecov integration with coverage thresholds and PR reporting"
    - "Add Trivy or Snyk scanning for container images in PR workflows"
    - "Add CodeQL/SAST workflow for Python and JavaScript code"
  priority_1:
    - "Add container runtime validation (startup test, health check) in PR pipeline"
    - "Automate Playwright E2E tests in CI (currently scaffolded but not running)"
    - "Add agent rules for test creation patterns (unit-tests.md, integration-tests.md)"
  priority_2:
    - "Add contract tests for REST API endpoints"
    - "Implement dependency scanning (Dependabot/Renovate for non-Konflux deps)"
    - "Add performance regression detection beyond gateway benchmarks"
---

# Quality Analysis: red-hat-data-services/mlflow

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Python ML platform (experiment tracking, model registry, tracing, GenAI evaluation)
- **Primary Languages**: Python (1,090 source files), TypeScript/JavaScript (UI), Java (client SDK)
- **Version**: 3.12.0 (forked from mlflow/mlflow with RHOAI customizations)

**Key Strengths**: Exceptionally well-organized CI/CD with 25+ GitHub Actions workflows, comprehensive test matrix covering 764 Python test files and 509 JS test files, database integration tests against PostgreSQL/MySQL/MSSQL, multi-arch Konflux/Tekton builds, strong pre-commit hook pipeline with 20+ hooks, and mature agent rules with CLAUDE.md, hooks, skills, and coding rules.

**Critical Gaps**: No coverage tracking or enforcement (pytest-cov is a dependency but unused in CI), no security scanning (no Trivy/Snyk/CodeQL), and no container runtime validation despite Konflux multi-arch builds.

**Agent Rules Status**: Strong — comprehensive CLAUDE.md, `.claude/rules/` with Python and GitHub Actions guidelines, hooks for linting/PR validation/uv enforcement, and 7+ custom skills for PR review workflow.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | 764 Python + 509 JS test files; pytest with splits; strong coverage |
| Integration/E2E | 7.0/10 | DB integration tests; fs2db E2E; Playwright scaffolded but not in CI |
| Build Integration | 7.5/10 | Konflux/Tekton PR + push builds; hermetic; multi-arch; no runtime validation |
| Image Testing | 5.0/10 | Multi-arch builds; SBOM via Syft; no startup/runtime testing |
| Coverage Tracking | 2.0/10 | pytest-cov in deps but no CI integration; no thresholds; no reporting |
| CI/CD Automation | 9.0/10 | 25+ workflows; concurrency; matrix; scheduled; benchmarks |
| Agent Rules | 8.0/10 | CLAUDE.md + rules + hooks + skills; missing test-creation rules |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: Cannot measure test coverage trends; regressions go undetected; no PR-level coverage gates
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: `pytest-cov` is listed in `requirements/test-requirements.txt` but no workflow uses `--cov` flags. No `.codecov.yml`, no `coveragerc`, no coverage upload step in any workflow. This means there is zero visibility into which code paths are tested.
- **Recommendation**: Add `--cov=mlflow --cov-report=xml` to pytest runs in `master.yml`, upload to Codecov, and set a minimum coverage threshold (e.g., 70% with no-decrease policy).

### 2. No Container Runtime Validation
- **Impact**: Image startup failures, missing dependencies, or runtime errors not caught until deployment
- **Severity**: HIGH
- **Effort**: 6-8 hours
- **Details**: The `Dockerfile.konflux` builds a multi-stage image with UI and Python components, but no CI step validates that the resulting image starts correctly, responds on port 5000, or passes a health check. The Tekton PR pipeline only builds and pushes — it doesn't test.
- **Recommendation**: Add a post-build step that runs the image and verifies `curl http://localhost:5000/health` returns 200.

### 3. No Security Scanning in CI
- **Impact**: Vulnerabilities in dependencies or code not detected before merge
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The only security-related workflow is `close-security-issues.yml` which just auto-closes issues. There is no Trivy, Snyk, CodeQL, Semgrep, or any other SAST/DAST/SCA tool configured. The `.syft.yaml` provides SBOM generation but no vulnerability scanning.
- **Recommendation**: Add a Trivy scan workflow for container images and a CodeQL workflow for Python/JavaScript source code.

### 4. No Full-Stack E2E Test Automation
- **Impact**: UI-backend integration regressions discovered only in manual testing
- **Severity**: MEDIUM
- **Effort**: 16-24 hours
- **Details**: Playwright E2E infrastructure exists at `mlflow/server/js/e2e/` with config, pages, and test files, but no CI workflow runs these tests. The JS workflow runs unit tests and build but skips E2E. A `test_e2e.py` exists for webhooks but covers only one feature.
- **Recommendation**: Create a workflow that spins up the MLflow server and runs Playwright tests against it.

## Quick Wins

### 1. Add Codecov Integration
- **Effort**: 2-4 hours
- **Impact**: Immediate coverage visibility and regression prevention
- **Implementation**:
```yaml
# Add to master.yml python job after "Run tests"
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    files: coverage.xml
    fail_ci_if_error: false
```

### 2. Add Trivy Container Scanning
- **Effort**: 1-2 hours
- **Impact**: CVE detection in base images and dependencies
- **Implementation**:
```yaml
# New workflow: .github/workflows/security-scan.yml
name: Security Scan
on: [pull_request]
jobs:
  trivy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -f Dockerfile.konflux -t mlflow:scan .
      - name: Run Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'mlflow:scan'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
```

### 3. Add CodeQL Scanning
- **Effort**: 1-2 hours
- **Impact**: Automated SAST for Python and JavaScript
- **Implementation**:
```yaml
# New workflow: .github/workflows/codeql.yml
name: CodeQL
on:
  pull_request:
  schedule:
    - cron: '0 6 * * 1'
jobs:
  analyze:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        language: [python, javascript]
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
      - uses: github/codeql-action/analyze@v3
```

### 4. Add Container Startup Test
- **Effort**: 2-3 hours
- **Impact**: Verify built image is functional before merge
- **Implementation**: Add to Tekton PR pipeline or as a post-build step in `build-and-push-dev-image.yml`.

## Detailed Findings

### CI/CD Pipeline

**Strengths (Score: 9.0/10)**:
- **25+ workflows** covering testing, linting, building, documentation, benchmarks, and automation
- **Concurrency control** on all workflows with `cancel-in-progress: true`
- **Path filtering** to avoid unnecessary runs (docs, JS, clint changes excluded from Python tests)
- **Matrix strategies** for test parallelization (Python tests split into 4 groups, models into 3, pyfunc into 4)
- **Cross-platform testing**: Windows test suite in addition to Linux
- **Scheduled daily runs**: Slow tests, examples, gateway benchmarks at different times
- **Performance benchmarks**: Gateway benchmark workflow with latency thresholds (P50/P99)
- **Draft PR skipping**: All workflows skip draft PRs (unless from Copilot bot)
- **Custom actions**: Reusable composite actions (`.github/actions/`) for setup-python, setup-node, etc.

**Notable Workflows**:
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `master.yml` | PR + push | Core test suite (skinny, python, database, flavors, models, evaluate, genai, pyfunc, windows) |
| `lint.yml` | PR + push + merge_group | Pre-commit hooks + custom lints on ubuntu + macOS |
| `js.yml` | PR + push (JS paths) | JS lint, prettier, i18n, type-check, tests, build |
| `tracing.yml` | PR + push | Tracing SDK tests |
| `examples.yml` | PR + daily | Example notebook/script validation |
| `slow-tests.yml` | Daily + dispatch | Docker and long-running tests |
| `gateway-benchmark.yml` | Daily | Performance regression detection for AI Gateway |
| `build-and-push-dev-image.yml` | PR + push | Docker dev image build and push to Quay |
| `fs2db.yml` | PR + push | FileStore-to-DB migration E2E tests across versions |
| `ui-preview.yml` | Push + PR (labeled) | Deploy UI preview for PR review |

**Gaps**:
- No coverage upload in any workflow
- No security scanning workflows
- No E2E workflow for Playwright tests
- No test result artifact upload for failure debugging

### Test Coverage

**Strengths (Score: 8.5/10 for unit tests)**:
- **764 Python test files** across 70+ test directories organized by feature area
- **509 JavaScript/TypeScript test files** for the UI layer
- **Test-to-code ratio**: 698 test files : 1,090 source files = 0.64 (strong)
- **35 conftest.py files** providing shared fixtures and test infrastructure
- **Test splitting**: pytest-split for parallel execution across matrix groups
- **Database integration tests**: Docker Compose-based tests against PostgreSQL, MySQL, MSSQL
- **Migration testing**: Automated database migration validation
- **Multi-version testing**: fs2db tests against MLflow 2.x and 3.x
- **Comprehensive conftest**: Root conftest.py with fixtures for telemetry, tracing, workspace context

**Test Directory Coverage**:
| Area | Test Files | Notable |
|------|-----------|---------|
| genai | 107 | Largest test suite; scorers, evaluators |
| store | 68 | SQLAlchemy store, model registry, workspace |
| utils | 45 | Comprehensive utility testing |
| tracing | 42 | OpenTelemetry, export, display |
| gateway | 42 | AI Gateway providers, routing |
| tracking | 39 | Experiment tracking core |
| entities | 39 | Data model tests |
| server | 30 | API server, auth, handlers |
| pyfunc | 29 | Python function model serving |

**Weaknesses**:
- No coverage measurement or reporting in CI
- Limited integration test suite (only async_logging integration test)
- Playwright E2E tests exist but aren't run in CI
- No contract tests for REST API boundaries

### Code Quality

**Strengths (Score: 9.0/10)**:
- **20+ pre-commit hooks** including:
  - `ruff` (linting + formatting, line-length 100, Python 3.10 target)
  - `mypy` (strict mode for dev/ and .claude/ files)
  - `prettier` (JS/TS/MD/JSON/YAML)
  - `clint` (custom MLflow-specific linter)
  - `typos` (spell checker)
  - `buf` (protobuf formatter)
  - `taplo` (TOML formatter)
  - `conftest` (OPA policy validation for workflows)
  - `action-pins` (GitHub Actions version pinning checker)
  - `regal` (Rego linter for OPA policies)
  - `unresolved-import` (ty-based import checker)
  - Custom hooks: normalize-chars, mlflow-typo, check-mlflow-ui, pyproject, check-init-py, js-fmt
- **Pre-commit enforcement**: Lint workflow runs `pre-commit run --all-files` on PRs
- **Function signature checking**: `dev/check_function_signatures.py` validates API stability
- **Whitespace-only PR detection**: Prevents meaningless PRs
- **DCO sign-off enforcement**: `must-have-signoff` hook
- **GitHub Actions pin verification**: All actions pinned to commit SHAs (e.g., `actions/checkout@de0fac2e...`)
- **OPA policy for workflows**: `.github/policy.rego` with conftest validation

### Container Images

**Strengths**:
- **Konflux/Tekton integration**: Both PR and push pipelines defined in `.tekton/`
- **Multi-arch builds**: amd64, arm64, ppc64le, s390x
- **Hermetic builds**: `hermetic: true` with prefetch for pip, yarn, RPMs
- **Multi-stage Dockerfile**: Separate UI builder, Python builder, and minimal runtime stages
- **UBI9 base images**: `ubi9/nodejs-24`, `ubi9/python-312`, `ubi-minimal:9.7` with SHA pinning
- **SBOM generation**: `.syft.yaml` configured for Python and JavaScript catalogers
- **Source image builds**: `build-source-image: true` in Tekton PR pipeline
- **Dev image workflow**: Separate `build-and-push-dev-image.yml` builds `docker/Dockerfile.full.dev`

**Weaknesses**:
- **No runtime validation**: No step tests that the built image starts and responds
- **No vulnerability scanning**: No Trivy/Snyk/Grype in any pipeline
- **No image signing**: No cosign/sigstore attestation
- **PR build limited**: Tekton PR pipeline triggers only on `/build-konflux mlflow` comment or label, not automatically
- **No .trivyignore**: No suppression file for known/accepted CVEs

### Security

**Score: 3.0/10** (Weakest dimension)

**Present**:
- SBOM generation via Syft
- Security issues auto-close workflow
- `SECURITY.md` with vulnerability reporting process
- DCO sign-off enforcement
- GitHub Actions pinned to commit SHAs
- OPA policy validation for workflow files
- Secret detection via `.gitignore` patterns

**Missing**:
- No SAST (CodeQL, Semgrep, gosec)
- No container scanning (Trivy, Snyk, Grype)
- No dependency scanning (Dependabot, Renovate alerts)
- No secret detection tool (Gitleaks, TruffleHog)
- No image signing or provenance attestation
- No DAST or fuzzing

### Agent Rules (Agentic Flow Quality)

**Score: 8.0/10**

**Present**:
- **CLAUDE.md** (7,152 bytes): Comprehensive with development setup, testing commands, code quality guidelines, git workflow, pre-commit instructions
- **`.claude/rules/python.md`**: Detailed Python style guide covering docstrings, type hints, try-catch scope, dataclasses, pathlib, pattern matching — goes beyond ruff/clint enforcement
- **`.claude/rules/github-actions.md`**: Guidelines for runner selection (ubuntu-slim) and preferring gh CLI over actions/github-script
- **`.claude/hooks/`**: Three hooks — `enforce-uv.sh` (ensure uv usage), `lint.py` (auto-lint on changes), `validate_pr_body.py` (PR description validation)
- **`.claude/skills/`**: 7+ skills (pr-review, resolve, analyze-ci, fetch-diff, fetch-unresolved-comments, add-review-comment, copilot)
- **`.claude/settings.json`**: Configured agent settings

**Missing**:
- No test creation rules (e.g., `unit-tests.md`, `integration-tests.md`, `e2e-tests.md`)
- No rule for coverage expectations
- No rule for security testing patterns
- Python rule focuses on style, not test patterns (fixtures, mocking, assertions)

**Recommendation**: Generate test automation rules using `/test-rules-generator` to cover:
- Unit test patterns (pytest fixtures, parametrize, mocking strategies)
- Database integration test patterns (Docker Compose, test isolation)
- API test patterns (REST endpoint testing)
- JS/TS test patterns (Jest configuration, component testing)

## Recommendations

### Priority 0 (Critical)
1. **Implement Codecov integration** — Add `--cov` to pytest runs, upload coverage reports, set minimum thresholds. This is the single highest-impact improvement since coverage data drives all other quality decisions.
2. **Add Trivy or Snyk scanning** — Scan the Konflux-built container image for vulnerabilities in every PR pipeline. At minimum, fail on CRITICAL severity CVEs.
3. **Add CodeQL/SAST workflow** — Enable GitHub's CodeQL for Python and JavaScript. Zero configuration cost with GitHub's free tier.

### Priority 1 (High Value)
4. **Add container runtime validation** — After Konflux build, start the image and verify health endpoint responds. Consider adding to the Tekton PR pipeline as a post-build task.
5. **Automate Playwright E2E tests** — The infrastructure exists at `mlflow/server/js/e2e/`. Create a workflow that starts the MLflow server and runs these tests on UI-related PRs.
6. **Create test automation agent rules** — Add `.claude/rules/unit-tests.md`, `integration-tests.md` with project-specific patterns (conftest fixtures, database test patterns, workspace-aware testing).

### Priority 2 (Nice-to-Have)
7. **Add contract tests for REST API** — The MLflow server exposes many API endpoints; contract tests would catch breaking changes between client SDKs and server.
8. **Enable Dependabot/Renovate** — Automated dependency update PRs for non-Konflux dependencies (dev, test, lint dependencies).
9. **Add performance regression testing** — Extend the gateway benchmark pattern to cover core tracking operations (experiment creation, run logging, model registry).
10. **Add secret detection** — Configure Gitleaks or TruffleHog as a pre-commit hook and CI workflow.

## Comparison to Gold Standards

| Dimension | mlflow | odh-dashboard | notebooks | kserve |
|-----------|--------|---------------|-----------|--------|
| Unit Tests | 8.5 | 9.0 | 7.0 | 8.0 |
| Integration/E2E | 7.0 | 9.0 | 7.0 | 9.0 |
| Build Integration | 7.5 | 8.0 | 8.0 | 7.0 |
| Image Testing | 5.0 | 7.0 | 9.0 | 6.0 |
| Coverage Tracking | 2.0 | 8.0 | 5.0 | 8.0 |
| CI/CD Automation | 9.0 | 9.0 | 8.0 | 8.0 |
| Agent Rules | 8.0 | 9.0 | 3.0 | 4.0 |
| **Overall** | **7.6** | **8.7** | **7.0** | **7.4** |

**Relative Strengths**: MLflow has the most comprehensive CI/CD automation of any analyzed repository, with exceptional workflow organization, parallelization, and pre-commit pipeline. The agent rules setup is among the best seen, with hooks, skills, and detailed coding guidelines.

**Key Gap vs. Gold Standards**: Coverage tracking is the biggest differentiator — odh-dashboard and kserve enforce coverage thresholds, while mlflow has zero coverage visibility despite having extensive tests.

## File Paths Reference

### CI/CD Configuration
- `.github/workflows/master.yml` — Main test suite (8 jobs: skinny, python, database, flavors, models, evaluate, genai, pyfunc, windows)
- `.github/workflows/lint.yml` — Pre-commit linting on ubuntu + macOS
- `.github/workflows/js.yml` — JavaScript tests, lint, type-check, build
- `.github/workflows/tracing.yml` — Tracing SDK tests
- `.github/workflows/examples.yml` — Example validation (PR + daily)
- `.github/workflows/slow-tests.yml` — Docker/slow tests (daily + dispatch)
- `.github/workflows/gateway-benchmark.yml` — Performance benchmarks (daily)
- `.github/workflows/build-and-push-dev-image.yml` — Dev image build
- `.github/workflows/fs2db.yml` — FileStore-to-DB migration E2E
- `.github/workflows/ui-preview.yml` — UI preview deployment

### Konflux/Tekton
- `.tekton/mlflow-pull-request.yaml` — Konflux PR pipeline (multi-arch, hermetic)
- `.tekton/mlflow-push.yaml` — Konflux push pipeline (master → quay.io/opendatahub/mlflow:odh-stable)
- `Dockerfile.konflux` — Production container build (3-stage: UI, Python, runtime)

### Testing
- `tests/` — 764 Python test files across 70+ directories
- `tests/conftest.py` — Root test fixtures
- `tests/db/` — Database integration tests with Docker Compose
- `tests/integration/` — Async logging integration test
- `mlflow/server/js/e2e/` — Playwright E2E tests (not in CI)

### Code Quality
- `.pre-commit-config.yaml` — 20+ hooks (ruff, mypy, prettier, clint, typos, buf, taplo, conftest, etc.)
- `pyproject.toml` — Ruff config (line-length 100, Python 3.10), mypy (strict), pytest config

### Agent Rules
- `CLAUDE.md` — Development guide for Claude Code
- `.claude/rules/python.md` — Python coding conventions
- `.claude/rules/github-actions.md` — GitHub Actions best practices
- `.claude/hooks/enforce-uv.sh` — Enforce uv usage
- `.claude/hooks/lint.py` — Auto-lint on changes
- `.claude/hooks/validate_pr_body.py` — PR body validation
- `.claude/skills/` — 7+ skills for PR review workflow

### Container/Security
- `Dockerfile.konflux` — Production multi-stage build
- `docker/Dockerfile.full.dev` — Development image
- `.syft.yaml` — SBOM cataloger configuration
- `SECURITY.md` — Vulnerability reporting process
