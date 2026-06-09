---
repository: "red-hat-data-services/llama-stack"
overall_score: 6.0
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "48 test files with pytest, multi-Python (3.10-3.13), coverage generation but no enforcement"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "Comprehensive matrix testing (8 types x 2 clients x 3 Python versions) with Ollama backend"
  - dimension: "Build Integration"
    score: 6.0
    status: "All templates built on PR (venv + container), UBI9 testing, but no Konflux simulation"
  - dimension: "Image Testing"
    score: 4.0
    status: "Container builds validated but minimal runtime testing, no vulnerability scanning"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "Coverage reports generated locally but no codecov/coveralls, no thresholds, no PR gating"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "12 well-organized workflows, SHA-pinned actions, concurrency control, path-filtered triggers"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no AI agent test automation guidance"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Coverage can silently regress across PRs with no visibility or gating"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No security scanning in CI (Trivy, CodeQL, SAST)"
    impact: "Vulnerabilities in dependencies and code not detected until production"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No container runtime validation"
    impact: "Image startup failures and runtime issues not caught until deployment"
    severity: "HIGH"
    effort: "6-8 hours"
  - title: "No Konflux/RHTAP build integration"
    impact: "Production build failures discovered only post-merge in downstream builds"
    severity: "MEDIUM"
    effort: "12-16 hours"
quick_wins:
  - title: "Add Codecov integration to unit test workflow"
    effort: "2-3 hours"
    impact: "Instant PR-level coverage visibility and regression detection"
  - title: "Add Trivy container scanning to providers-build workflow"
    effort: "1-2 hours"
    impact: "Early detection of CVEs in container images"
  - title: "Add CodeQL/SAST workflow"
    effort: "2-3 hours"
    impact: "Automated security vulnerability detection in Python code"
  - title: "Create CLAUDE.md with basic test patterns"
    effort: "2-3 hours"
    impact: "Consistent AI-generated test quality for contributors using agent tools"
recommendations:
  priority_0:
    - "Add Codecov/Coveralls integration with PR reporting and minimum coverage thresholds"
    - "Add Trivy vulnerability scanning for container images in CI"
    - "Add CodeQL or Semgrep SAST scanning workflow"
  priority_1:
    - "Add container runtime validation (health check, endpoint smoke test) in providers-build"
    - "Reduce mypy exclusion list to improve type safety coverage"
    - "Add Gitleaks secret detection to pre-commit and CI"
    - "Create CLAUDE.md and .claude/rules/ for AI-assisted test automation"
  priority_2:
    - "Add Konflux/RHTAP build simulation for downstream compatibility"
    - "Enable GPU test workflow on PR (currently workflow_dispatch only)"
    - "Add multi-architecture container build testing (arm64)"
    - "Add performance regression testing for inference endpoints"
---

# Quality Analysis: red-hat-data-services/llama-stack

## Executive Summary

- **Overall Score: 6.0/10**
- **Repository Type**: Python AI framework (Llama Stack distribution/server)
- **Primary Language**: Python (74,945 LOC across 627 source files)
- **Test Lines**: 14,240 across 81 test files (19% test-to-code ratio)
- **Key Strengths**: Well-structured CI with 12 workflows, comprehensive integration test matrix, solid pre-commit hooks with Ruff + mypy, SHA-pinned GitHub Actions
- **Critical Gaps**: No coverage tracking/enforcement, no security scanning, no container vulnerability scanning, no agent rules
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.0/10 | 48 test files, pytest + asyncio, multi-Python, no coverage enforcement |
| Integration/E2E | 7.0/10 | Matrix testing with Ollama, auth tests with K8s, external providers |
| **Build Integration** | **6.0/10** | **Template builds on PR, UBI9 testing, no Konflux simulation** |
| Image Testing | 4.0/10 | Container builds validated, entrypoint inspection, no runtime tests |
| Coverage Tracking | 3.0/10 | `--cov` flag used but reports not uploaded, no thresholds |
| CI/CD Automation | 8.0/10 | 12 workflows, concurrency control, SHA-pinned, path filtering |
| Agent Rules | 0.0/10 | No CLAUDE.md, no .claude/ directory, no test guidance |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: Coverage can silently regress across PRs with no visibility or gating
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The unit test workflow generates coverage with `--cov=llama_stack` and HTML reports, but these are only uploaded as artifacts — no Codecov/Coveralls integration, no PR comments, no minimum thresholds. The `.coveragerc` exists but only defines `omit` patterns (providers, templates, tests). There is no mechanism to prevent coverage regressions.

### 2. No Security Scanning in CI
- **Impact**: Vulnerabilities in dependencies and Python code not detected until production
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: Despite being an AI framework handling model inference and user data, there is zero SAST/DAST tooling:
  - No CodeQL or Semgrep for Python code analysis
  - No Trivy/Snyk for container image scanning
  - No Gitleaks/TruffleHog for secret detection (only `detect-private-key` pre-commit hook)
  - Dependabot configured but Python PRs capped at 0 (security-only mode)
  - No SBOM generation or image signing

### 3. No Container Runtime Validation
- **Impact**: Image startup failures and runtime issues not caught until deployment
- **Severity**: HIGH
- **Effort**: 6-8 hours
- **Details**: The `providers-build` workflow builds container images for all templates and inspects entrypoints, but never actually starts the containers to verify they can serve requests. For a project whose primary distribution mechanism is container images, this is a significant gap.

### 4. No Konflux/RHTAP Build Integration
- **Impact**: Production build failures discovered only post-merge in downstream builds
- **Severity**: MEDIUM
- **Effort**: 12-16 hours
- **Details**: As a Red Hat Data Services fork, this repo will likely be built by Konflux/RHTAP downstream. There is no `.tekton/` directory or any Konflux configuration. Build compatibility issues (different base images, build contexts, dependency resolution) will only surface post-merge.

## Quick Wins

### 1. Add Codecov Integration (2-3 hours)
- **Impact**: Instant PR-level coverage visibility and regression detection
- **Implementation**: Add to `unit-tests.yml`:
```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    files: ./coverage.xml
    fail_ci_if_error: false
```
- Modify coverage command to also generate XML: `--cov-report=xml:coverage.xml`

### 2. Add Trivy Container Scanning (1-2 hours)
- **Impact**: Early detection of CVEs in container images
- **Implementation**: Add step to `providers-build.yml` after container build:
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'test:latest'
    format: 'sarif'
    severity: 'CRITICAL,HIGH'
```

### 3. Add CodeQL Workflow (2-3 hours)
- **Impact**: Automated security vulnerability detection in Python code
- **Implementation**: Create `.github/workflows/codeql.yml` using GitHub's default Python template

### 4. Create Basic Agent Rules (2-3 hours)
- **Impact**: Consistent AI-generated test quality for contributors using Claude Code or similar tools
- **Implementation**: Create `CLAUDE.md` with project conventions and `.claude/rules/` for test patterns

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (12 workflows):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `unit-tests.yml` | PR + push | Unit tests across Python 3.10-3.13 |
| `integration-tests.yml` | PR + push | Integration tests (8 types × 2 clients × 3 Python) |
| `integration-auth-tests.yml` | PR + push | OAuth2 auth tests with Kubernetes |
| `test-external-providers.yml` | PR + push | External provider integration |
| `providers-build.yml` | PR + push | All template builds (venv + container) |
| `pre-commit.yml` | PR + push | Pre-commit hooks validation |
| `semantic-pr.yml` | PR | Conventional commit title check |
| `install-script-ci.yml` | PR + push + daily | Installer script validation |
| `changelog.yml` | Release | Auto-generate changelog |
| `update-readthedocs.yml` | PR + push | Documentation updates |
| `stale_bot.yml` | Daily cron | Close stale issues/PRs |
| `gha_workflow_llama_stack_tests.yml` | Dispatch only | GPU-based tests (disabled for PR) |

**Strengths:**
- All PR workflows use concurrency control with `cancel-in-progress: true`
- All GitHub Actions are SHA-pinned (verified by custom pre-commit hook `check-workflows-use-hashes.sh`)
- Custom composite action for runner setup (`.github/actions/setup-runner/`)
- Path-filtered triggers reduce unnecessary CI runs
- Multi-Python version matrix testing (3.10, 3.11, 3.12, 3.13)
- Dependabot configured for both GitHub Actions and Python dependencies

**Gaps:**
- GPU tests are dispatch-only (commented out PR triggers with TODO)
- `tests.yml` workflow is manual-only and requires API keys
- No caching of Python packages beyond uv's built-in behavior
- No test result reporting to PR (no JUnit comments, no coverage summary)

### Test Coverage

**Three-Tier Testing Strategy:**

| Layer | Files | Lines | Description |
|-------|-------|-------|-------------|
| Unit | 48 | 8,520 | Server, providers, models, distribution, registry |
| Integration | 46 | 4,979 | End-to-end with Ollama backend, matrix across types |
| Verification | 10 | 2,117 | OpenAI API compatibility verification |
| **Total** | **81** | **14,240** | **19% test-to-code ratio** |

**Unit Tests:**
- Framework: pytest with `pytest-asyncio`, `pytest-cov`, `pytest-html`
- Coverage areas: server auth, SSE, quotas, registry ACL, RAG, vector IO (Faiss, SQLite-vec, Qdrant), inference providers (vLLM, NVIDIA, Ollama), distribution routing, CLI
- Well-structured fixtures via `conftest.py` at multiple levels
- Async test support with `asyncio-mode=auto`

**Integration Tests:**
- 8 test type categories: agents, inference, datasets, inspect, scoring, post_training, providers, tool_runtime
- Dual client testing: `library` (in-process) and `http` (server mode)
- Ollama setup via custom action (`.github/actions/setup-ollama/`)
- Server health check before test execution
- Known test exclusions: `builtin_tool`, `safety_with_image`, `code_interpreter`, `test_rag`

**Verification Tests:**
- OpenAI API compatibility layer testing
- Fixture-driven test cases with parametrization
- Chat completion and responses testing

**Missing:**
- No contract tests between API layers
- No performance/load testing
- No chaos/resilience testing
- Some integration test categories excluded from CI

### Code Quality

**Pre-commit Hooks (Excellent - 15+ hooks):**
- `check-merge-conflict`, `trailing-whitespace`, `check-added-large-files` (1MB limit)
- `end-of-file-fixer`, `no-commit-to-branch`, `check-yaml`, `detect-private-key`
- `requirements-txt-fixer`, `mixed-line-ending`, `check-executables-have-shebangs`
- `check-json`, `check-shebang-scripts-are-executable`, `check-symlinks`, `check-toml`
- `insert-license` (license header enforcement on `.py` and `.sh`)
- `ruff` (lint with `--fix`) + `ruff-format` (formatting)
- `blacken-docs` (format code in documentation)
- `uv-lock` + `uv-export` (dependency lock file management)
- `mypy` (type checking with pydantic plugin)
- Custom: `distro-codegen`, `openapi-codegen`, `check-workflows-use-hashes`
- pre-commit.ci integration for auto-fix and auto-update

**Ruff Configuration (Strong):**
- Line length: 120
- Rules enabled: UP (pyupgrade), B/B9 (bugbear), C (comprehensions), E (pycodestyle), F (pyflakes), N (naming), W (warnings), DTZ (datetime), I (isort), RUF (Ruff-specific), PLC/PLE (pylint)
- Per-file ignores for test files

**mypy Configuration (Moderate):**
- Enabled with pydantic plugin
- `warn_return_any = true`
- Significant exclusion list (~20+ files/directories excluded)
- `follow_imports = "silent"` to avoid transitive issues

**CODEOWNERS:**
- Defined with 8 default reviewers for all files

### Container Images

**Containerfiles Found:**
1. `tests/Containerfile` - CI-only Ollama image with pre-pulled models (for testing)
2. `llama_stack/distribution/ui/Containerfile` - Streamlit UI app

**Build Validation:**
- All templates built in CI with both `venv` and `container` image types
- Custom distribution builds tested (including UBI9 base)
- Container entrypoint inspection validates expected command
- UBI9 base image OS validation

**Gaps:**
- No multi-architecture builds (only amd64 for test Containerfile)
- No vulnerability scanning on built images
- No container startup/health check tests (only entrypoint string match)
- No SBOM generation
- No image signing or attestation

### Security

**Present:**
- SHA-pinned GitHub Actions (enforced by pre-commit hook)
- `detect-private-key` pre-commit hook
- Dependabot for GitHub Actions (weekly) and Python (security-only)
- `SECURITY.md` with responsible disclosure via Meta's bounty program
- CODEOWNERS for mandatory review

**Missing:**
- No CodeQL or any SAST tool
- No Trivy/Snyk/Grype container scanning
- No Semgrep rules
- No Gitleaks/TruffleHog for secret scanning
- No SBOM (Software Bill of Materials) generation
- No image signing/attestation (cosign/sigstore)
- No dependency license scanning

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None - no test type rules exist
- **Quality**: N/A
- **Gaps**:
  - No `CLAUDE.md` at repository root
  - No `.claude/` directory
  - No `AGENTS.md`
  - No test automation guidance for AI agents
  - No rules for unit test patterns (pytest conventions, fixture usage)
  - No rules for integration test patterns (Ollama setup, client types)
  - No rules for provider test patterns
- **Recommendation**: Generate missing rules with `/test-rules-generator` to establish:
  - Unit test conventions (pytest, asyncio, fixture patterns)
  - Integration test structure (test types, client modes, Ollama setup)
  - Provider testing patterns (mock vs real backend)
  - Coverage requirements and quality gates

## Recommendations

### Priority 0 (Critical)

1. **Add Codecov/Coveralls integration with PR reporting**
   - Upload coverage XML from unit test workflow
   - Set minimum coverage threshold (start at current level, e.g., 60%)
   - Enable PR comments with coverage diff
   - Effort: 4-6 hours

2. **Add container vulnerability scanning**
   - Integrate Trivy into `providers-build.yml`
   - Scan all built container images
   - Set severity threshold (CRITICAL, HIGH)
   - Upload SARIF results to GitHub Security tab
   - Effort: 2-4 hours

3. **Add CodeQL/SAST scanning**
   - Create `.github/workflows/codeql.yml`
   - Configure for Python language
   - Run on PR and push to main
   - Effort: 2-3 hours

### Priority 1 (High Value)

4. **Add container runtime validation**
   - After building container images, start them and verify health endpoint
   - Test basic inference endpoint responds
   - Add timeout-based health check
   - Effort: 6-8 hours

5. **Reduce mypy exclusion list**
   - Systematically fix type errors in excluded files
   - Remove entries from exclusion list as fixed
   - Effort: 8-16 hours (incremental)

6. **Add Gitleaks secret detection**
   - Add to pre-commit hooks and CI
   - Create `.gitleaks.toml` with repo-specific allowlists
   - Effort: 2-3 hours

7. **Create comprehensive agent rules**
   - `CLAUDE.md` with project conventions
   - `.claude/rules/unit-tests.md` for pytest patterns
   - `.claude/rules/integration-tests.md` for integration test structure
   - `.claude/rules/provider-tests.md` for provider testing patterns
   - Effort: 4-6 hours (or use `/test-rules-generator`)

### Priority 2 (Nice-to-Have)

8. **Add Konflux/RHTAP build simulation**
   - Create `.tekton/` configuration for downstream builds
   - Add PR-time build simulation workflow
   - Effort: 12-16 hours

9. **Enable GPU tests on PR**
   - Re-enable the currently commented-out PR trigger in `gha_workflow_llama_stack_tests.yml`
   - Ensure GPU runner availability
   - Effort: 4-8 hours (infrastructure dependent)

10. **Add multi-architecture container build testing**
    - Test arm64 builds alongside amd64
    - Add buildx multi-platform support
    - Effort: 4-6 hours

11. **Add performance regression testing**
    - Benchmark inference latency/throughput
    - Track across PRs for regression detection
    - Effort: 8-12 hours

## Comparison to Gold Standards

| Dimension | llama-stack | odh-dashboard | notebooks | kserve |
|-----------|------------|---------------|-----------|--------|
| Unit Tests | 7/10 | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 7/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 6/10 | 8/10 | 7/10 | 8/10 |
| Image Testing | 4/10 | 7/10 | 9/10 | 7/10 |
| Coverage Tracking | 3/10 | 9/10 | 6/10 | 8/10 |
| CI/CD Automation | 8/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 0/10 | 8/10 | 3/10 | 2/10 |
| Security Scanning | 3/10 | 7/10 | 6/10 | 8/10 |
| **Overall** | **6.0** | **8.5** | **7.0** | **8.0** |

**Key Differentiators vs. Gold Standards:**
- **odh-dashboard**: Has contract testing, comprehensive coverage enforcement, multi-layer CI, agent rules
- **notebooks**: Has 5-layer image validation, multi-architecture support, security scanning
- **kserve**: Has coverage thresholds, multi-version testing, CRD validation

## File Paths Reference

### CI/CD
- `.github/workflows/unit-tests.yml` - Unit test pipeline
- `.github/workflows/integration-tests.yml` - Integration test pipeline
- `.github/workflows/integration-auth-tests.yml` - Auth integration tests
- `.github/workflows/providers-build.yml` - Template build validation
- `.github/workflows/test-external-providers.yml` - External provider tests
- `.github/workflows/pre-commit.yml` - Pre-commit hook validation
- `.github/workflows/semantic-pr.yml` - PR title validation
- `.github/actions/setup-runner/action.yml` - Custom runner setup action
- `.github/actions/setup-ollama/action.yml` - Ollama setup action
- `.github/dependabot.yml` - Dependency update configuration
- `.github/CODEOWNERS` - Code ownership definitions

### Testing
- `tests/unit/` - Unit tests (48 files, 8,520 lines)
- `tests/integration/` - Integration tests (46 files, 4,979 lines)
- `tests/verifications/` - API verification tests (10 files, 2,117 lines)
- `tests/external-provider/` - External provider test fixtures
- `tests/common/` - Shared test utilities
- `tests/client-sdk/` - Client SDK tests
- `tests/Containerfile` - CI container for Ollama
- `scripts/unit-tests.sh` - Unit test runner script

### Code Quality
- `.pre-commit-config.yaml` - 15+ pre-commit hooks
- `pyproject.toml` - Ruff, mypy, pydantic-mypy configuration
- `.coveragerc` - Coverage omit patterns

### Container Images
- `tests/Containerfile` - Ollama CI image
- `llama_stack/distribution/ui/Containerfile` - Streamlit UI

### Security
- `SECURITY.md` - Security disclosure policy
- `.github/dependabot.yml` - Dependency updates
