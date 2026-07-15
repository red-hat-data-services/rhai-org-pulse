---
repository: "opendatahub-io/mlflow"
overall_score: 7.9
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "722 Python test files + 530 JS/TS test files with pytest and Jest; well-organized per-module test suites"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Operator integration tests with Kind cluster, Playwright E2E for UI, database integration tests across PostgreSQL/MySQL/MSSQL"
  - dimension: "Build Integration"
    score: 8.0
    status: "Konflux PR builds with multi-arch, E2E waits for Konflux image, operator integration builds and deploys on PR"
  - dimension: "Image Testing"
    score: 7.0
    status: "Konflux multi-arch builds (amd64/arm64/ppc64le/s390x), UBI9 base, hermetic builds; limited runtime validation outside E2E"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "JS CI has --coverage flag but no enforcement; no Python coverage tracking, no codecov/coveralls integration"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "49 workflows with concurrency control, path filtering, matrix strategies, test splitting; excellent automation"
  - dimension: "Agent Rules"
    score: 7.5
    status: "CLAUDE.md + 2 agent rules (python.md, github-actions.md) + 8 skills; rules are high quality but lack test-specific guidance"
critical_gaps:
  - title: "No Python test coverage tracking or enforcement"
    impact: "Cannot identify undertested code paths; coverage regressions go unnoticed"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No security vulnerability scanning (Trivy/Snyk/CodeQL) in CI"
    impact: "Dependency and code vulnerabilities not detected pre-merge"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No coverage enforcement thresholds for JS or Python"
    impact: "Test coverage can decrease without any CI gate catching it"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "Missing agent rules for test creation patterns"
    impact: "AI-generated tests may not follow project conventions for pytest fixtures, mocking, parametrization"
    severity: "MEDIUM"
    effort: "3-4 hours"
quick_wins:
  - title: "Add codecov/coveralls integration for Python tests"
    effort: "4-6 hours"
    impact: "Visibility into test coverage trends and PR-level coverage changes"
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Early detection of CVEs in container images and dependencies"
  - title: "Add CodeQL or Semgrep SAST scanning"
    effort: "2-3 hours"
    impact: "Automated detection of security anti-patterns in Python code"
  - title: "Create agent rules for test patterns (unit-tests.md)"
    effort: "2-3 hours"
    impact: "Consistent AI-generated tests following project conventions"
recommendations:
  priority_0:
    - "Implement Python test coverage tracking with codecov integration and PR reporting"
    - "Add container security scanning (Trivy) to the Konflux and/or GitHub Actions pipeline"
  priority_1:
    - "Add CodeQL or Semgrep SAST workflow for Python code analysis"
    - "Create comprehensive agent rules for test creation (.claude/rules/unit-tests.md, integration-tests.md)"
    - "Add coverage enforcement thresholds (e.g., 60% minimum, no decrease on PR)"
  priority_2:
    - "Add dependency scanning workflow (Dependabot or Renovate)"
    - "Add performance regression testing for model serving endpoints"
    - "Create agent rules for E2E test patterns with Playwright"
---

# Quality Analysis: opendatahub-io/mlflow

## Executive Summary

- **Overall Score: 7.9/10**
- **Repository Type**: Python ML platform (fork of upstream mlflow/mlflow with RHOAI customizations)
- **Primary Languages**: Python (2,478 files), TypeScript/JavaScript (3,192 files)
- **Frameworks**: pytest, Jest, Playwright, Kubernetes operator integration
- **Key Strengths**: Exceptionally mature CI/CD pipeline with 49 workflows, comprehensive test matrix (Python splits, database backends, ML flavors, Windows, GenAI), Konflux multi-arch builds, Playwright E2E, operator integration tests with Kind, excellent pre-commit hooks (20+ checks), well-structured agent rules
- **Critical Gaps**: No Python test coverage tracking, no security scanning (Trivy/CodeQL), no coverage enforcement
- **Agent Rules Status**: Present and high quality — CLAUDE.md + 2 rules + 8 skills, but missing test-specific creation rules

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | 722 Python + 530 JS test files; pytest with splits, Jest with workers |
| Integration/E2E | 8.5/10 | Operator integration (Kind), Playwright E2E, database tests (PG/MySQL/MSSQL) |
| **Build Integration** | **8.0/10** | **Konflux PR builds, E2E waits for Konflux image, operator integration builds on PR** |
| Image Testing | 7.0/10 | Multi-arch Konflux builds (4 architectures), UBI9 base, hermetic; limited standalone runtime validation |
| Coverage Tracking | 3.0/10 | JS has `--coverage` in CI script but no enforcement; no Python coverage at all |
| CI/CD Automation | 9.0/10 | 49 workflows, concurrency control, path filtering, matrix strategies, test splitting |
| Agent Rules | 7.5/10 | CLAUDE.md + python.md + github-actions.md rules + 8 custom skills |

## Critical Gaps

### 1. No Python Test Coverage Tracking or Enforcement
- **Impact**: With 2,478 Python source files and 722 test files, there is no way to identify undertested modules or catch coverage regressions
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No `.coveragerc`, no `codecov.yml`, no `--cov` flags in pytest configuration. The `test:ci` JS script has `--coverage` but it's unclear if results are tracked anywhere
- **Recommendation**: Add `pytest-cov` to test requirements, configure `.coveragerc`, integrate with Codecov for PR reporting

### 2. No Security Vulnerability Scanning in CI
- **Impact**: Container images and Python dependencies are not scanned for known CVEs before merge
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Trivy, Snyk, CodeQL, Semgrep, or Grype workflows found. The Syft SBOM generation (.syft.yaml) exists for Konflux supply chain attestation, but no active vulnerability scanning
- **Recommendation**: Add Trivy scanning for container images and `pip audit` for Python dependencies

### 3. No Coverage Enforcement Thresholds
- **Impact**: Test coverage can decrease on any PR without CI catching it
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: Even where coverage is collected (JS CI), no minimum thresholds or diff-coverage checks exist
- **Recommendation**: Configure codecov.yml with `project` and `patch` targets

### 4. Missing Test Creation Agent Rules
- **Impact**: AI-generated tests may not follow project-specific pytest conventions (fixtures, parametrize, mock patterns)
- **Severity**: MEDIUM
- **Effort**: 3-4 hours
- **Details**: The existing `python.md` rule covers code style excellently but doesn't cover test creation patterns for different test types (unit, integration, E2E)
- **Recommendation**: Create `.claude/rules/unit-tests.md` and `.claude/rules/e2e-tests.md` with project-specific patterns

## Quick Wins

### 1. Add Trivy Container Scanning (~1-2 hours)
- **Impact**: Detect CVEs in UBI9 base image and Python dependencies
- **Implementation**:
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

### 2. Add Python Coverage Reporting (~4-6 hours)
- **Impact**: Visibility into which modules need more tests
- **Implementation**: Add `pytest-cov` and `coverage` to `requirements/test-requirements.txt`, update pytest invocations with `--cov=mlflow --cov-report=xml`

### 3. Create Agent Test Rules (~2-3 hours)
- **Impact**: AI-generated tests follow project patterns
- **Implementation**: Create `.claude/rules/unit-tests.md` documenting pytest patterns, fixture usage, parametrize conventions from existing `python.md` rule's test section

### 4. Add CodeQL SAST (~2-3 hours)
- **Impact**: Catch injection, XSS, and other security issues in Python code
- **Implementation**: Use GitHub's built-in CodeQL action with Python language configuration

## Detailed Findings

### CI/CD Pipeline (Score: 9.0/10)

**Strengths:**
- **49 GitHub Actions workflows** covering linting, testing, building, and deployment
- **Concurrency control** on all workflows: `cancel-in-progress: true` with properly scoped groups
- **Path filtering**: Test workflows ignore docs/markdown changes; JS workflow only triggers on `mlflow/server/js/**`
- **Test splitting**: Python tests split across 4 matrix groups with `pytest-split`; models split across 3 groups
- **Multi-platform**: Windows tests run alongside Linux
- **Draft PR skipping**: All jobs check `pull_request.draft == false` (with Copilot bot exception)
- **Operator integration**: Full Kind cluster deployment and testing on every PR
- **E2E pipeline**: Waits for Konflux PR image build, then runs Playwright tests against the real container
- **Tekton/Konflux**: Full PipelineRun configs for both PR and push with hermetic builds and prefetch

**Workflow Inventory (key workflows):**
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `master.yml` | PR + push | Core Python tests (skinny, python, database, flavors, models, evaluate, genai, pyfunc, windows) |
| `lint.yml` | PR + push | Pre-commit hooks, ruff, mypy, clint, custom linters on Linux + macOS |
| `js.yml` | PR + push (JS paths) | ESLint, prettier, type-check, Jest tests, build verification |
| `e2e.yml` | After JS workflow | Playwright E2E using Konflux-built container image |
| `tracing.yml` | PR + push | Tracing SDK unit tests in isolation |
| `operator-integration-tests.yml` | PR + push | Kind cluster, operator + MLflow deployment, integration tests |
| `fs2db.yml` | PR + push | Filesystem-to-database migration E2E tests |
| `examples.yml` | PR + schedule | ML example notebooks validation |
| `build-wheel.yml` | push | Python wheel build verification |
| `protobuf-cross-test.yml` | PR + push | Proto compatibility testing |

**Minor Gaps:**
- No workflow for dependency vulnerability scanning
- No SAST/CodeQL workflow

### Test Coverage (Score: 8.5/10 Unit, 8.5/10 Integration/E2E)

**Unit Tests:**
- **722 Python test files** in `tests/` across 80+ subdirectories covering every major module
- **530 JS/TS test files** for the UI layer
- **pytest** with strict markers, timeout=1200s, deprecation warning enforcement
- **Jest** for React components with `--maxWorkers=2` for memory management
- **Test organization**: Module-mirror structure (tests/tracing/, tests/models/, tests/gateway/, etc.)
- **ML flavor coverage**: Dedicated test suites for 30+ ML frameworks (sklearn, pytorch, tensorflow, transformers, langchain, etc.)

**Integration Tests:**
- **Database tests**: Multi-backend testing across PostgreSQL, MySQL, MSSQL using docker-compose
- **Database migration checks**: Verifies schema migrations work across all supported backends
- **Operator integration**: Full Kubernetes deployment testing with Kind cluster
  - Builds MLflow runtime image, operator image, and test image
  - Matrix testing across K8s versions, artifact backends, backend stores, registry stores
  - TLS and workspace support testing
- **fs2db**: Filesystem-to-database migration E2E validation

**E2E Tests:**
- **Playwright-based**: 3 spec files covering experiment lifecycle, GenAI observability, prompt versioning
- **Real container testing**: E2E tests run against Konflux-built image, not dev server
- **Full stack**: docker-compose stack with MLflow server, PostgreSQL, workspace support
- **Page Object Model**: Well-structured with pages/, fixtures/, utils/ directories
- **Artifact upload**: Test reports and results uploaded on failure

**Gaps:**
- No Python coverage reporting or tracking
- JS coverage collected in `test:ci` but not reported/enforced
- E2E spec count is modest (3 specs) relative to UI complexity

### Code Quality (Score: 9.0/10)

**Outstanding pre-commit setup with 25+ hooks:**
- `ruff`: Python linting with 100-char line length, extensive rule selection, preview mode
- `ruff format`: Code formatting with docstring support
- `mypy`: Type checking on dev/ and skills/
- `clint`: Custom MLflow-specific linter
- `ty`: Import resolution checking (detects broken `mlflow.*` imports)
- `prettier`: JS/JSON/YAML formatting
- `taplo`: TOML formatting
- `typos`: Spell checking
- `buf`: Protobuf formatting
- `conftest`/`check-actions`: OPA Rego policy enforcement on GitHub Actions workflows
- `regal`: Rego linting
- `check-component-ids`: React component ID registry validation
- Multiple custom validators (mlflow-typo, check-init-py, forbid-gif, no-yaml, no-spaces)
- `uv-lock`: Lock file consistency
- `must-have-signoff`: DCO enforcement (prepare-commit-msg stage)

**Lint CI:**
- Runs on both Linux and macOS
- Function signature checking
- Whitespace-only change detection
- uv.lock change warnings
- Unused media detection

**Excellent ruff configuration** with 30+ enabled rules and file-specific overrides.

### Container Images (Score: 7.0/10)

**Strengths:**
- **Konflux multi-arch builds**: amd64, arm64, ppc64le, s390x
- **Hermetic builds**: All dependencies prefetched and locked
- **UBI9 base images**: Production-grade Red Hat base
- **Multi-stage Dockerfile**: 3-stage build (UI builder → Python builder → runtime)
- **SBOM generation**: Syft configuration for supply chain attestation
- **Security hardening**: Non-root user (1001), PYTHONDONTWRITEBYTECODE, telemetry disabled
- **Tekton PipelineRuns**: Both PR and push pipelines with proper tagging (odh-pr-{sha}, odh-stable)

**Gaps:**
- No Trivy/Grype vulnerability scanning
- No image signing/attestation beyond SBOM
- No standalone container runtime validation (smoke test) — relies on E2E pipeline
- Multiple Dockerfiles (7+) in the repo; testing coverage varies

### Security (Score: 4.0/10)

**Present:**
- Syft SBOM generation for Konflux
- DCO sign-off enforcement
- Hermetic Konflux builds
- Security vulnerability issue template with auto-close + redirect to private reporting
- Non-root container user
- `.dockerignore` present
- `persist-credentials: false` on all checkout actions

**Missing:**
- ❌ No Trivy/Snyk/Grype container scanning
- ❌ No CodeQL/Semgrep SAST scanning
- ❌ No Gitleaks/TruffleHog secret detection
- ❌ No dependency scanning (pip-audit, safety)
- ❌ No image signing (cosign)
- ❌ No Dependabot/Renovate for dependency updates

### Agent Rules (Score: 7.5/10)

**Present and high-quality:**
- **CLAUDE.md** (7.1 KB): Comprehensive development guide with dev server setup, testing commands, code quality commands, git workflow, pre-commit hooks, debugging tips
- **.claude/rules/python.md** (8 KB): Excellent Python style guide covering 12 patterns (Literal types, try-catch scope, dataclasses, pathlib, pattern matching, mock best practices, parametrize, decorator metadata)
- **.claude/rules/github-actions.md** (2.4 KB): Workflow guidelines (ubuntu-slim, gh CLI preference, sparse-checkout, pipefail)
- **.claude/settings.json**: Configured settings
- **.claude/hooks/**: Custom hooks
- **.claude/skills/** (8 skills): add-review-comment, analyze-ci, copilot, fetch-diff, fetch-unresolved-comments, pr-review, rebase-mlflow, resolve

**Gaps:**
- No dedicated test creation rules (unit-tests.md, integration-tests.md, e2e-tests.md)
- No operator test pattern rules
- `python.md` covers mock and parametrize patterns but not full test creation workflows
- No Playwright E2E test conventions documented
- No rules for database test patterns or ML flavor test patterns

## Recommendations

### Priority 0 (Critical)

1. **Implement Python test coverage tracking with Codecov**
   - Add `pytest-cov` to test requirements
   - Configure `--cov=mlflow --cov-report=xml` in CI pytest invocations
   - Create `.codecov.yml` with project and patch targets
   - Add Codecov upload step to `master.yml` workflow
   - Effort: 4-6 hours

2. **Add container security scanning**
   - Add Trivy filesystem scan in PR workflow
   - Add `pip audit` step to lint or test workflow
   - Consider Trivy image scan on Konflux-built images
   - Effort: 2-4 hours

### Priority 1 (High Value)

3. **Add SAST scanning (CodeQL or Semgrep)**
   - Enable CodeQL for Python language analysis
   - Schedule weekly scans + PR triggers
   - Effort: 2-3 hours

4. **Create comprehensive test agent rules**
   - `.claude/rules/unit-tests.md`: pytest fixtures, parametrize patterns, mock conventions, test file naming
   - `.claude/rules/e2e-tests.md`: Playwright page objects, test data fixtures, assertion patterns
   - Effort: 3-4 hours

5. **Enforce coverage thresholds**
   - Set minimum project coverage (e.g., 60%)
   - Require no coverage decrease on PRs (patch coverage > 70%)
   - Effort: 2-3 hours

### Priority 2 (Nice-to-Have)

6. **Add dependency update automation** (Dependabot or Renovate)
7. **Add performance regression testing** for model serving and tracing endpoints
8. **Add secret detection** (Gitleaks in pre-commit or CI)
9. **Expand E2E test coverage** (currently 3 specs for a large UI)
10. **Add image signing** with cosign for Konflux-built images

## Comparison to Gold Standards

| Dimension | mlflow (this) | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit Tests | ★★★★☆ (1252 files) | ★★★★★ | ★★★☆☆ | ★★★★★ |
| Integration/E2E | ★★★★☆ (Kind + Playwright) | ★★★★★ | ★★★★☆ | ★★★★★ |
| Build Integration | ★★★★☆ (Konflux + E2E) | ★★★★☆ | ★★★★☆ | ★★★☆☆ |
| Image Testing | ★★★☆☆ (multi-arch, no scan) | ★★★★☆ | ★★★★★ | ★★★☆☆ |
| Coverage | ★★☆☆☆ (no tracking) | ★★★★★ | ★★★☆☆ | ★★★★★ |
| CI/CD | ★★★★★ (49 workflows) | ★★★★★ | ★★★★☆ | ★★★★☆ |
| Security | ★★☆☆☆ (SBOM only) | ★★★★☆ | ★★★★☆ | ★★★☆☆ |
| Agent Rules | ★★★★☆ (high quality) | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ |
| **Overall** | **7.9/10** | **9.0/10** | **7.0/10** | **8.0/10** |

## File Paths Reference

### CI/CD
- `.github/workflows/master.yml` — Core Python test suite (9 jobs)
- `.github/workflows/lint.yml` — Pre-commit hooks and linting
- `.github/workflows/js.yml` — JS linting, type-check, Jest tests, build
- `.github/workflows/e2e.yml` — Playwright E2E with Konflux image
- `.github/workflows/operator-integration-tests.yml` — Kind cluster integration tests
- `.github/workflows/tracing.yml` — Tracing SDK isolated tests
- `.github/workflows/fs2db.yml` — Filesystem-to-database migration tests
- `.github/workflows/examples.yml` — ML example validation
- `.tekton/mlflow-pull-request.yaml` — Konflux PR pipeline
- `.tekton/mlflow-push.yaml` — Konflux push pipeline

### Testing
- `tests/` — 80+ subdirectories, 722 Python test files
- `mlflow/server/js/src/**/*.test.{ts,tsx}` — 530 JS/TS test files
- `mlflow/server/js/e2e/` — Playwright E2E tests (3 specs)
- `tests/db/` — Database integration tests with docker-compose

### Code Quality
- `pyproject.toml` — Ruff, pytest, mypy configuration
- `.pre-commit-config.yaml` — 25+ pre-commit hooks
- `.github/policy.rego` — OPA policy for workflow validation

### Container Images
- `Dockerfile.konflux` — Production Konflux build (multi-stage, UBI9)
- `docker/Dockerfile` — Development image
- `.syft.yaml` — SBOM generation configuration
- `.dockerignore` — Build context exclusions

### Agent Rules
- `CLAUDE.md` — Development guide and commands
- `.claude/rules/python.md` — Python style guide (8 KB)
- `.claude/rules/github-actions.md` — Workflow guidelines (2.4 KB)
- `.claude/skills/` — 8 custom skills (pr-review, rebase-mlflow, copilot, etc.)
- `.claude/settings.json` — Claude Code settings
