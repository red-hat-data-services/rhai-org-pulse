---
repository: "red-hat-data-services/ogx"
overall_score: 6.5
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Solid unit test suite with pytest, multi-Python-version CI matrix, coverage generation but no enforcement"
  - dimension: "Integration/E2E"
    score: 7.5
    status: "Comprehensive integration tests with Ollama, multi-client-type matrix, auth tests with minikube"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time provider build validation across templates and image types (venv + container), UBI9 testing"
  - dimension: "Image Testing"
    score: 5.0
    status: "Container builds validated via providers-build workflow but no runtime functional tests or scanning"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "pytest-cov generates HTML reports but no codecov/coveralls integration, no thresholds, no PR gating"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "14 workflows with concurrency control, path filtering, multi-version matrix, pre-commit CI, SHA-pinned actions"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules for test automation guidance"
critical_gaps:
  - title: "No coverage enforcement or PR gating"
    impact: "Coverage can silently regress on any PR without anyone noticing; no baseline or threshold tracked"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container security scanning (Trivy, Snyk, CodeQL)"
    impact: "Vulnerabilities in container images and dependencies not detected until production"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No SBOM generation or image signing"
    impact: "No software supply chain attestation, fails compliance requirements for Red Hat downstream"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No agent rules for AI-assisted test creation"
    impact: "AI-generated tests lack consistency, miss project-specific patterns and conventions"
    severity: "MEDIUM"
    effort: "3-5 hours"
  - title: "GPU-based test workflow disabled for PRs"
    impact: "GPU-dependent provider tests only run on manual dispatch, regressions caught late"
    severity: "MEDIUM"
    effort: "8-16 hours"
quick_wins:
  - title: "Add codecov integration to unit-tests workflow"
    effort: "2-3 hours"
    impact: "Immediate visibility into coverage trends and PR-level coverage diffs"
  - title: "Add Trivy container scanning to providers-build workflow"
    effort: "1-2 hours"
    impact: "Early detection of CVEs in built container images"
  - title: "Create basic agent rules for unit test patterns"
    effort: "2-3 hours"
    impact: "Standardize AI-generated test quality across the repository"
  - title: "Add CodeQL or Bandit SAST scanning workflow"
    effort: "1-2 hours"
    impact: "Detect Python security anti-patterns (injection, hardcoded secrets, unsafe deserialization)"
recommendations:
  priority_0:
    - "Integrate codecov with coverage thresholds and PR checks to prevent silent coverage regression"
    - "Add Trivy or Snyk container scanning to CI for all built images"
    - "Add SAST scanning (CodeQL, Bandit, or Semgrep) for Python security analysis"
  priority_1:
    - "Add SBOM generation (Syft) and container image signing (cosign) for supply chain security"
    - "Create comprehensive agent rules (.claude/rules/) for unit, integration, and verification test patterns"
    - "Re-enable GPU-based test workflow for PRs with appropriate gating"
    - "Add coverage threshold enforcement (e.g., 70% minimum, no regression on PRs)"
  priority_2:
    - "Add container runtime functional tests (health endpoint, API response) for built images"
    - "Add performance regression testing for inference endpoints"
    - "Add OpenSSF Scorecard workflow for supply chain security posture"
    - "Add mutation testing (mutmut) to validate test suite effectiveness"
---

# Quality Analysis: red-hat-data-services/ogx

## Executive Summary

- **Overall Score: 6.5/10**
- **Repository Type**: Python library/framework (fork of Meta's llama-stack)
- **Primary Language**: Python (72,740 lines source, 15,958 lines test code)
- **Framework**: FastAPI-based AI inference stack with provider plugin architecture
- **Key Strengths**: Strong CI/CD automation with 14 workflows, comprehensive integration test matrix, multi-Python-version testing, well-configured pre-commit hooks with mypy/ruff
- **Critical Gaps**: No coverage enforcement or reporting integration, zero container security scanning, no SAST, no agent rules
- **Agent Rules Status**: Missing — no `.claude/` directory, no `CLAUDE.md`

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.0/10 | Solid pytest suite (48 files), multi-Python matrix (3.10-3.13), coverage generation |
| Integration/E2E | 7.5/10 | Comprehensive integration tests (46 files), Ollama-based, library+HTTP client modes |
| **Build Integration** | **7.0/10** | **PR-time provider builds across all templates + venv/container, UBI9 base testing** |
| Image Testing | 5.0/10 | Container builds validated but no runtime functional tests or vulnerability scanning |
| Coverage Tracking | 3.0/10 | pytest-cov generates HTML but no codecov, no thresholds, no PR gating |
| CI/CD Automation | 8.0/10 | 14 workflows, concurrency control, path filtering, SHA-pinned actions |
| Agent Rules | 0.0/10 | No agent rules, no CLAUDE.md, no test automation guidance |

## Critical Gaps

### 1. No Coverage Enforcement or PR Gating
- **Impact**: Coverage can silently regress on any PR. The unit-tests workflow generates `--cov` HTML reports and uploads them as artifacts, but there is no codecov/coveralls integration, no coverage threshold, and no PR check that blocks merge on regression.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Current state**: `.coveragerc` exists with appropriate omit patterns. `pytest-cov` is in dev dependencies. But coverage data goes nowhere — it's uploaded as a build artifact and likely never reviewed.

### 2. No Container Security Scanning
- **Impact**: Container images built in CI (via `providers-build.yml`) are never scanned for vulnerabilities. The project builds images for all provider templates across both `venv` and `container` image types, but there is no Trivy, Snyk, or Grype scanning.
- **Severity**: HIGH
- **Effort**: 2-4 hours

### 3. No SAST or Dependency Scanning
- **Impact**: No CodeQL, Bandit, Semgrep, or equivalent SAST tool. While pre-commit hooks include `detect-private-key`, there is no systematic Python security analysis. Dependabot is configured for GitHub Actions and uv, but with `open-pull-requests-limit: 0` for Python deps (security-only updates).
- **Severity**: HIGH
- **Effort**: 2-4 hours

### 4. No SBOM or Supply Chain Attestation
- **Impact**: No SBOM generation (Syft, CycloneDX), no image signing (cosign), no provenance attestation. Critical for Red Hat downstream consumption.
- **Severity**: HIGH
- **Effort**: 4-8 hours

### 5. GPU Test Workflow Disabled for PRs
- **Impact**: The `gha_workflow_llama_stack_tests.yml` workflow is commented out for `pull_request_target`. GPU-dependent tests only run via manual `workflow_dispatch` on self-hosted runners with EFS-mounted model checkpoints. This means GPU-specific regressions are only caught manually.
- **Severity**: MEDIUM
- **Effort**: 8-16 hours (requires infrastructure)

## Quick Wins

### 1. Add Codecov Integration (2-3 hours)
```yaml
# Add to .github/workflows/unit-tests.yml after test step
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    fail_ci_if_error: false
```

### 2. Add Trivy Container Scanning (1-2 hours)
```yaml
# Add to providers-build.yml after container build step
- name: Run Trivy vulnerability scanner
  if: matrix.image-type == 'container'
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'test:latest'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
```

### 3. Add Bandit SAST Scanning (1-2 hours)
```yaml
# New workflow: .github/workflows/security.yml
name: Security Scanning
on: [push, pull_request]
jobs:
  bandit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install bandit
      - run: bandit -r llama_stack/ -f json -o bandit-report.json || true
```

### 4. Create Basic Agent Rules (2-3 hours)
Create `.claude/rules/unit-tests.md` with pytest patterns, fixture conventions, and mock strategies specific to this codebase.

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory** (14 workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `unit-tests.yml` | PR + push (main) | Unit tests across Python 3.10-3.13 |
| `integration-tests.yml` | PR + push (main) | Integration tests with Ollama (8 test types × 2 client types × 3 Python versions) |
| `integration-auth-tests.yml` | PR + push (main) | OAuth2/Kubernetes auth integration tests with minikube |
| `providers-build.yml` | PR + push (main) | Provider template builds (all templates × venv/container) |
| `test-external-providers.yml` | PR + push (main) | External provider plugin testing |
| `pre-commit.yml` | PR + push (main) | Ruff linting, mypy, formatting, codegen validation |
| `semantic-pr.yml` | PR target | Semantic PR title enforcement |
| `install-script-ci.yml` | PR + push + daily cron | Installer script validation (ShellCheck + smoke test) |
| `tests.yml` | workflow_dispatch only | Manual test-as-library with external providers |
| `gha_workflow_llama_stack_tests.yml` | workflow_dispatch only | GPU-based tests on self-hosted runners (PR trigger disabled) |
| `changelog.yml` | release events | Auto-generate changelog |
| `update-readthedocs.yml` | PR + push (main) + tags | Documentation build and ReadTheDocs deployment |
| `stale_bot.yml` | daily cron | Stale issue/PR cleanup |
| `dependabot.yml` | weekly (Saturday) | GitHub Actions and uv dependency updates |

**Strengths**:
- Concurrency control with `cancel-in-progress: true` on most workflows
- Path-based filtering to avoid unnecessary CI runs
- SHA-pinned GitHub Actions (checked by custom pre-commit hook `check-workflows-use-hashes.sh`)
- Reusable composite actions (`setup-runner`, `setup-ollama`)
- Multi-version Python matrix testing (3.10, 3.11, 3.12, 3.13)
- Artifact upload for test results with retention policies
- Dynamic matrix generation for provider builds

**Weaknesses**:
- No coverage reporting or threshold enforcement
- GPU test workflow disabled for PRs
- `tests.yml` is dispatch-only and uses `pip install` instead of `uv` (inconsistent with other workflows)
- No security scanning workflows (Trivy, CodeQL, Bandit)

### Test Coverage

**Unit Tests** (48 Python files in `tests/unit/`):
- Framework: pytest with pytest-asyncio, pytest-cov, pytest-timeout
- Areas covered: server (auth, SSE, resolver, quota, access control), registry, RAG, distribution, models, CLI, providers, files, utils
- Multi-Python-version matrix (3.10-3.13)
- Coverage generated via `--cov=llama_stack` but not reported externally
- Test-to-code ratio: 0.22 (15,958 test lines / 72,740 source lines) — moderate

**Integration Tests** (46 Python files in `tests/integration/`):
- 8 test categories: agents, inference, datasets, inspect, scoring, post_training, providers, tool_runtime
- Matrix across library and HTTP client types
- Ollama as local inference provider (pre-built Docker container with models)
- Auth-specific integration tests with minikube/Kubernetes
- Rich conftest.py with proper test fixtures and teardown

**Verification Tests** (10 Python files in `tests/verifications/`):
- OpenAI API compatibility verification
- Multi-provider testing with JSON report generation
- Custom report generator for cross-provider comparison

**Build Tests** (via `providers-build.yml`):
- All provider templates validated (dynamic matrix)
- Both venv and container image types tested
- UBI9 base image testing for Red Hat compatibility
- Entrypoint validation for container images
- Custom distribution build testing
- Single-provider build testing

### Code Quality

**Pre-commit Hooks** (Excellent — 12+ hooks):
- `ruff` (linting + formatting) with comprehensive rule selection (UP, B, C, E, F, N, W, DTZ, I, RUF, PLC, PLE)
- `mypy` with pydantic plugin (though extensive exclude list)
- `blacken-docs` for code in documentation
- `uv-lock` and `uv-export` for dependency consistency
- `insert-license` for license headers
- Standard pre-commit hooks (merge conflict, trailing whitespace, large files, YAML, JSON, TOML, private keys, etc.)
- Custom hooks: `distro-codegen`, `openapi-codegen`, `check-workflows-use-hashes`
- pre-commit.ci integration for automated fixes

**Static Analysis**:
- mypy configured with strict settings (`warn_return_any`, `pydantic-mypy` plugin)
- Extensive exclusion list suggests gradual adoption (many files excluded)
- Ruff with good rule coverage but some important ignores (C901 complexity)

**Weaknesses**:
- Large mypy exclusion list (~80+ patterns) suggests type safety is incomplete
- No Bandit or security-focused linting
- No custom pylint rules

### Container Images

**Build Process**:
- Two Containerfiles: `tests/Containerfile` (Ollama test image) and `llama_stack/distribution/ui/Containerfile` (UI)
- Dynamic container builds via `llama stack build --image-type container` across all templates
- UBI9 base image support tested (Red Hat compatibility)
- `USE_COPY_NOT_MOUNT` workaround for docker buildx compatibility

**Runtime Testing**:
- Entrypoint validation in `providers-build.yml` (checks correct command)
- UBI9 OS release verification
- No health endpoint testing after container start
- No functional API testing against built containers

**Security Scanning**:
- ❌ No Trivy/Snyk/Grype scanning
- ❌ No SBOM generation
- ❌ No image signing
- ❌ No vulnerability thresholds

### Security Practices

| Practice | Status |
|----------|--------|
| Dependabot | ✅ GitHub Actions (weekly) + uv (security-only) |
| SHA-pinned actions | ✅ All actions use SHA pins, enforced by pre-commit hook |
| Secret detection | ⚠️ `detect-private-key` in pre-commit only |
| SAST | ❌ No CodeQL, Bandit, or Semgrep |
| Container scanning | ❌ No Trivy or Snyk |
| SBOM | ❌ No generation |
| Image signing | ❌ No cosign attestation |
| CODEOWNERS | ✅ Defined with core maintainers |
| Branch protection | ✅ PR required for main branch |
| Permissions | ✅ Explicit permissions in workflows |

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No test type rules exist
- **Quality**: N/A
- **Gaps**: Everything — no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - Unit test patterns (pytest fixtures, async testing, mock strategies)
  - Integration test patterns (Ollama setup, client-type matrix, conftest conventions)
  - Verification test patterns (OpenAI API compat, multi-provider testing)
  - Provider test patterns (build validation, entrypoint checking)

## Recommendations

### Priority 0 (Critical)

1. **Integrate codecov with coverage thresholds** — Coverage data is already generated via `--cov=llama_stack` but goes nowhere. Add codecov upload action, configure `.codecov.yml` with a minimum threshold (start at current baseline), and enable PR checks.

2. **Add container security scanning** — The `providers-build.yml` workflow builds container images for all templates. Add Trivy scanning as a post-build step for `container` image-type matrix entries.

3. **Add SAST scanning** — Add a CodeQL or Bandit workflow. The codebase handles user input via FastAPI routes, API keys, and external provider connections — all high-risk areas.

### Priority 1 (High Value)

4. **Add SBOM and supply chain attestation** — Essential for Red Hat downstream. Use Syft for SBOM generation and cosign for image signing on release builds.

5. **Create comprehensive agent rules** — Given the codebase's complexity (619 source files, multiple test categories, specific patterns), agent rules would significantly improve AI-assisted development quality.

6. **Re-enable GPU test workflow for PRs** — The `gha_workflow_llama_stack_tests.yml` has PR triggers commented out. Consider enabling with appropriate concurrency limits or selective triggering.

7. **Add coverage threshold enforcement** — Once codecov is integrated, set a minimum coverage threshold and block PRs that reduce coverage.

### Priority 2 (Nice-to-Have)

8. **Add container runtime functional tests** — After building container images, start them and validate the health endpoint, basic API responses, and provider initialization.

9. **Add performance regression testing** — For inference endpoints, establish latency baselines and detect regressions.

10. **Add OpenSSF Scorecard** — Track supply chain security posture holistically.

11. **Reduce mypy exclusion list** — The ~80+ excluded patterns suggest significant type safety gaps. Gradually type-check more modules.

## Comparison to Gold Standards

| Dimension | ogx | odh-dashboard | notebooks | kserve |
|-----------|-----|---------------|-----------|--------|
| Unit Tests | 7.0 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 7.5 | 9.0 | 8.0 | 9.0 |
| Build Integration | 7.0 | 8.0 | 9.0 | 7.0 |
| Image Testing | 5.0 | 7.0 | 9.0 | 7.0 |
| Coverage Tracking | 3.0 | 9.0 | 6.0 | 9.0 |
| CI/CD Automation | 8.0 | 9.0 | 8.0 | 9.0 |
| Agent Rules | 0.0 | 8.0 | 3.0 | 2.0 |
| **Overall** | **6.5** | **8.7** | **7.3** | **7.9** |

**Key gaps vs. gold standards**:
- **vs. odh-dashboard**: Missing coverage enforcement, no contract tests, no agent rules
- **vs. notebooks**: Missing image vulnerability scanning, no runtime validation, no multi-arch testing
- **vs. kserve**: Missing coverage thresholds, no SAST, no supply chain attestation

## File Paths Reference

### CI/CD
- `.github/workflows/unit-tests.yml` — Unit test workflow (multi-Python matrix)
- `.github/workflows/integration-tests.yml` — Integration test workflow (Ollama-based)
- `.github/workflows/integration-auth-tests.yml` — Auth integration tests (minikube)
- `.github/workflows/providers-build.yml` — Provider build validation (all templates)
- `.github/workflows/test-external-providers.yml` — External provider testing
- `.github/workflows/pre-commit.yml` — Pre-commit hook CI
- `.github/workflows/semantic-pr.yml` — Semantic PR title enforcement
- `.github/workflows/install-script-ci.yml` — Installer script validation
- `.github/actions/setup-runner/action.yml` — Reusable runner setup action
- `.github/actions/setup-ollama/action.yml` — Reusable Ollama setup action

### Testing
- `tests/unit/` — 48 unit test files
- `tests/integration/` — 46 integration test files
- `tests/verifications/` — 10 verification test files
- `tests/client-sdk/` — 2 client SDK test files
- `tests/Containerfile` — Ollama test image definition
- `scripts/unit-tests.sh` — Unit test runner script

### Code Quality
- `.pre-commit-config.yaml` — 12+ pre-commit hooks (ruff, mypy, codegen)
- `pyproject.toml` — Ruff, mypy, and project configuration
- `.coveragerc` — Coverage omit patterns

### Container Images
- `tests/Containerfile` — Test infrastructure container
- `llama_stack/distribution/ui/Containerfile` — UI container

### Dependencies
- `.github/dependabot.yml` — GitHub Actions + uv dependency updates
- `.github/CODEOWNERS` — Code ownership definitions
