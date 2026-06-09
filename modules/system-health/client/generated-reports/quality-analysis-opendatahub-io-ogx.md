---
repository: "opendatahub-io/llama-stack"
overall_score: 8.2
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "170 unit test files with 36k+ lines, pytest+coverage, network blocking via pytest-socket"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "54 integration test files with record/replay system, multi-provider matrix, auth tests, conformance suites"
  - dimension: "Build Integration"
    score: 7.5
    status: "PR-time venv builds for all distros, container builds on push/schedule, UBI9 and ARM64 validation"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-distro container builds with entrypoint validation, UBI9 + ARM64, but no runtime functional testing"
  - dimension: "Coverage Tracking"
    score: 5.5
    status: "Coverage collection via coverage.py, HTML reports generated, but no codecov/coveralls integration or threshold enforcement"
  - dimension: "CI/CD Automation"
    score: 9.5
    status: "42 workflows, SHA-pinned actions, concurrency control, merge groups, Mergify, dependabot, CI status aggregation"
  - dimension: "Agent Rules"
    score: 7.5
    status: "CLAUDE.md and AGENTS.md present with comprehensive guidelines, but no .claude/rules/ directory for test-specific rules"
critical_gaps:
  - title: "No coverage threshold enforcement or PR coverage reporting"
    impact: "Coverage can silently regress without detection; no visibility into per-PR coverage changes"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container vulnerability scanning (Trivy/Snyk/Grype)"
    impact: "Container images may ship with known CVEs in base images or transitive dependencies"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container runtime functional testing"
    impact: "Image startup or runtime failures not caught until deployment; entrypoint check is structural only"
    severity: "MEDIUM"
    effort: "6-8 hours"
  - title: "No SBOM generation for container images"
    impact: "Cannot audit supply chain for built images; blocks compliance requirements"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add Codecov integration to unit test workflow"
    effort: "2-3 hours"
    impact: "Automatic per-PR coverage deltas, historical tracking, threshold enforcement"
  - title: "Add Trivy container scan step to providers-build workflow"
    effort: "1-2 hours"
    impact: "Catch CVEs in container images before merge"
  - title: "Add coverage fail_under threshold to .coveragerc"
    effort: "30 minutes"
    impact: "Prevent coverage regressions with a minimum enforcement gate"
  - title: "Create .claude/rules/ test automation rules"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality with framework-specific patterns"
recommendations:
  priority_0:
    - "Add Codecov/Coveralls integration with PR reporting and minimum coverage threshold"
    - "Add Trivy or Grype container vulnerability scanning to CI pipeline"
  priority_1:
    - "Add container runtime functional testing (start image, health check, basic API call)"
    - "Add SBOM generation (syft/trivy) for all built container images"
    - "Create .claude/rules/ directory with test automation rules for unit and integration test patterns"
  priority_2:
    - "Add performance/load testing with existing locust benchmark dependency"
    - "Add secret detection scanning (Gitleaks/TruffleHog) as dedicated workflow"
    - "Consider adding mutation testing to validate test effectiveness"
---

# Quality Analysis: opendatahub-io/llama-stack (OGX)

## Executive Summary

- **Overall Score: 8.2/10**
- **Repository Type**: Python API server with pluggable provider architecture (OpenAI-compatible)
- **Primary Language**: Python 3.12+
- **Framework**: FastAPI, Pydantic, pytest
- **Key Strengths**: Exceptionally mature CI/CD with 42 workflows, innovative record/replay integration testing system, comprehensive pre-commit hooks (25+ hooks including security-focused checks), strong agent documentation
- **Critical Gaps**: No coverage enforcement or PR reporting, no container vulnerability scanning, no SBOM generation
- **Agent Rules Status**: Present (CLAUDE.md + AGENTS.md) but no `.claude/rules/` directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | 170 test files, 36k+ lines, pytest + coverage.py, network isolation |
| Integration/E2E | 9.0/10 | 54 test files, record/replay system, multi-provider matrix, auth + conformance suites |
| **Build Integration** | **7.5/10** | **PR-time venv builds, container builds on push, UBI9 + ARM64 validation** |
| Image Testing | 7.0/10 | Multi-distro builds, entrypoint validation, but no runtime functional tests |
| Coverage Tracking | 5.5/10 | Coverage collected locally, no CI integration or threshold enforcement |
| CI/CD Automation | 9.5/10 | 42 workflows, SHA-pinned actions, concurrency, merge groups, Mergify |
| Agent Rules | 7.5/10 | CLAUDE.md + AGENTS.md comprehensive, but no .claude/rules/ for test patterns |

## Critical Gaps

### 1. No Coverage Threshold Enforcement or PR Reporting
- **Impact**: Coverage can silently degrade over time; contributors have no visibility into coverage impact of their changes
- **Severity**: HIGH
- **Current State**: `coverage.py` runs locally via `scripts/unit-tests.sh` and generates HTML, but there is no codecov/coveralls integration, no CI upload step, no `fail_under` threshold
- **Effort**: 4-6 hours
- **Evidence**: Unit test workflow uploads artifacts but doesn't upload coverage to any service; `.coveragerc` has no `fail_under` setting

### 2. No Container Vulnerability Scanning
- **Impact**: Built container images (UBI9, python:3.12-slim based) may contain known CVEs in base image layers or transitive Python dependencies
- **Severity**: HIGH
- **Current State**: CodeQL runs for Python source code and GitHub Actions, but no container image scanning (Trivy, Grype, Snyk) exists
- **Effort**: 2-4 hours
- **Evidence**: Only `codeql.yml` exists for security scanning; no Trivy/Grype/Snyk workflow found; no `.trivyignore` file

### 3. No Container Runtime Functional Testing
- **Impact**: Image startup failures, missing dependencies, or broken entrypoints not caught until deployment
- **Severity**: MEDIUM
- **Current State**: `providers-build.yml` builds container images and validates the entrypoint string structurally, but doesn't actually start the container and test API responses
- **Effort**: 6-8 hours

### 4. No SBOM Generation
- **Impact**: Cannot audit software supply chain for built images; blocks compliance workflows
- **Severity**: MEDIUM
- **Effort**: 2-3 hours

## Quick Wins

### 1. Add Codecov Integration (2-3 hours)
Add coverage upload to the unit test workflow:
```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage.xml
    fail_ci_if_error: true
```

### 2. Add Coverage Threshold (30 minutes)
Add to `.coveragerc`:
```ini
[report]
fail_under = 60
```

### 3. Add Trivy Container Scan (1-2 hours)
Add to `providers-build.yml` after image build:
```yaml
- name: Scan container image
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'ogx:${{ matrix.distro }}-ci'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'
```

### 4. Create Agent Test Rules (2-3 hours)
Create `.claude/rules/unit-tests.md` and `.claude/rules/integration-tests.md` with project-specific test patterns (record/replay system, network-blocking, Pydantic model testing patterns).

## Detailed Findings

### CI/CD Pipeline

**Exceptional maturity** — 42 GitHub Actions workflows covering:

| Category | Workflows | Trigger |
|----------|-----------|---------|
| **PR Quality Gates** | unit-tests, pre-commit, integration-tests (replay), backward-compat, codeql, semantic-pr, ci-status | PR + merge_group |
| **Build Validation** | providers-build (venv+container), build-distributions | PR + push |
| **Integration Testing** | integration-auth-tests, integration-sql-store-tests, integration-vector-io-tests, integration-responses-conversations-auth-tests, file-processors-tests, openresponses-conformance | PR + push |
| **Specialized** | backward-compat, openapi-generator-validation, test-external, test-external-provider-module, ui-unit-tests | PR + push |
| **Release** | prepare-release, post-release, pypi, publish-openapi-sdk, odh-create-release-branch, odh-create-tag | Dispatch/tag |
| **Recording** | record-integration-tests, commit-recordings, commit-constraint-updates | Dispatch/auto |
| **Scheduled** | release-branch-scheduled-ci, stale_bot | Cron |

**Strengths**:
- All GitHub Actions SHA-pinned (enforced by pre-commit hook `check-workflows-use-hashes`)
- Concurrency control on all PR workflows (cancel-in-progress)
- Merge group support for main branch
- CI status aggregator waits for all checks before reporting
- Mergify for auto-conflict detection and dependabot auto-approval
- Path-based filtering to minimize unnecessary CI runs

**Notable**: The project has its own CI matrix generator (`scripts/generate_ci_matrix.py`) that dynamically creates test matrices based on changed files, reducing unnecessary test runs on PRs.

### Test Coverage

**Unit Tests (8.5/10)**:
- 170 test files across 25+ directories covering core, CLI, providers, utils, routing, conversations, RAG, tools, telemetry
- ~36,244 lines of unit test code
- pytest framework with pytest-asyncio (auto mode), pytest-timeout, pytest-cov, pytest-html, pytest-json-report
- **pytest-socket**: Network access blocked by default in unit tests (`--allow-network` marker for exceptions)
- Coverage collected via `coverage.py` with `--source=src/ogx`
- `.coveragerc` excludes tests, providers, templates, CLI scripts, UI
- Multi-Python version testing (3.12 on PRs, 3.12 + 3.13 on push/schedule)

**Integration Tests (9.0/10)**:
- 54 test files with innovative **record/replay system** for deterministic AI API testing
- Recordings stored as JSON files in `tests/integration/*/recordings/` keyed by SHA256 of request bodies
- Multi-provider support: OpenAI (gpt), Azure, Bedrock, Ollama, Vertex AI, Gemini, WatsonX
- Auto-recording workflow triggered on PR changes
- Cleanup script validates no unused recordings
- OpenResponses conformance test suite
- Authentication tests with K8s OAuth2
- SQL store tests with real PostgreSQL (via GitHub Actions services)
- File processor tests
- Vector I/O tests across multiple backends
- TypeScript client tests alongside Python

**Test-to-Code Ratio**: 229 test files / 452 source files = **0.51** (good for a project with integration recordings)

### Code Quality

**Excellent** — comprehensive pre-commit setup with 25+ hooks:

| Tool | Purpose |
|------|---------|
| **Ruff** (v0.12.2) | Linting (UP, B, C, E, F, N, W, S, DTZ, I, RUF, PLC, PLE, D101) + formatting |
| **mypy** (v1.18.2) | Type checking with pydantic plugin, full + manual stages |
| **black** (via blacken-docs) | Code formatting in documentation |
| **markdownlint** (v0.48.0) | Markdown linting with auto-fix |
| **actionlint** (v1.7.11) | GitHub Actions workflow linting |

**Custom Security Hooks** (noteworthy):
- `fips-compliance`: Blocks MD5, SHA1, uuid3, uuid5 usage
- `no-sql-string-interpolation`: Blocks f-string SQL construction (SQL injection prevention)
- `check-log-usage`: Enforces project logger over stdlib logging
- `no-fstring-logging`: Enforces structlog key-value style
- `detect-private-key`: Prevents committing private keys
- `enforce-authorized-sqlstore`: Prevents direct SQL store usage
- `check-api-independence`: Ensures ogx_api doesn't import ogx

**Additional Quality Measures**:
- `check-file-size`: Python file size limits
- `check-init-py`: Missing `__init__.py` detection
- `api-conformance`: Breaking API change detection via oasdiff
- `openai-coverage`: Regression checking for OpenAI API coverage
- `check-workflows-use-hashes`: SHA-pinning enforcement for GH Actions
- License header enforcement
- Conventional commits via semantic-pr check

### Container Images

**Two Containerfiles**:
1. **`containers/Containerfile`** — Main server image
   - Multi-stage build with flexible base image (python:3.12-slim default, UBI9 supported)
   - Multiple install modes: pypi, editable, test-pypi
   - Multi-architecture: amd64 + arm64 (ARM64 tested weekly)
   - OpenTelemetry auto-instrumentation support
   - Tiktoken cache pre-warming for air-gapped deployments
   - Non-root user compatible (`chmod -R g+rw`)

2. **`src/ogx_ui/Containerfile`** — UI image
   - Node 22 Alpine base, non-root user, dumb-init for signal handling

**Build Testing**:
- PR-time: venv builds for all distributions (install via list-deps)
- Push: Full container builds for all distros
- Weekly: ARM64 builds, starter-ubi9-arm64
- Entrypoint validation (structural check)
- UBI9 base image verification
- Config label verification

**Gap**: No runtime functional testing (start container, health check, API call test)

### Security

| Practice | Status | Details |
|----------|--------|---------|
| CodeQL (SAST) | Present | Python + Actions, security-extended queries, PR-triggered |
| Ruff Security Rules | Present | flake8-bandit (S rules) enabled in ruff config |
| FIPS Compliance | Present | Custom pre-commit hook blocking non-FIPS algorithms |
| SQL Injection Prevention | Present | Custom hook + authorized SQL store enforcement |
| Secret Detection | Partial | `detect-private-key` hook only; no Gitleaks/TruffleHog |
| Dependency Scanning | Present | Dependabot (GitHub Actions + uv + npm), constraint-deps for CVE pinning |
| Container Scanning | **Missing** | No Trivy/Grype/Snyk for built images |
| SBOM | **Missing** | No SBOM generation for any artifacts |
| SHA-Pinned Actions | Present | Enforced by pre-commit hook |
| Semantic PR Titles | Present | Conventional commit validation |

**Notable**: The project actively manages CVE constraints in `pyproject.toml` with detailed comments explaining each pinned dependency and its associated CVEs. This is unusually thorough.

### Agent Rules (Agentic Flow Quality)

**Status**: Present but Incomplete

**CLAUDE.md**: Contains design context (users, brand personality, aesthetic direction) — primarily for UI/docs work, not testing guidance.

**AGENTS.md**: Comprehensive — includes:
- Repository layout
- Python & tooling conventions (uv, Python 3.12, type hints, mypy)
- Code style rules (comments, error messages, structured logging)
- Git conventions (signoff, conventional commits, merge-not-rebase)
- Testing guidelines (unit tests, integration tests with record/replay)
- Provider architecture
- Distribution configs
- API changes process
- Common patterns (adding parameters, deprecation)
- Documentation update requirements

**Gaps**:
- No `.claude/` directory with rules
- No `.claude/rules/unit-tests.md` with pytest patterns, network blocking, mock vs. fake guidance
- No `.claude/rules/integration-tests.md` with record/replay patterns, fixture usage
- No `.claude/rules/security-tests.md` with FIPS compliance, SQL injection patterns
- Testing guidance in AGENTS.md is high-level; doesn't include code examples or checklists

## Recommendations

### Priority 0 (Critical)

1. **Add Codecov/Coveralls Integration with PR Reporting**
   - Upload coverage from unit-tests.yml
   - Set minimum coverage threshold (start at current level, ratchet up)
   - Enable PR comments with coverage deltas
   - Effort: 4-6 hours

2. **Add Container Vulnerability Scanning**
   - Add Trivy scan step to `providers-build.yml` after image builds
   - Set severity threshold: fail on CRITICAL/HIGH
   - Add `.trivyignore` for known false positives
   - Effort: 2-4 hours

### Priority 1 (High Value)

3. **Add Container Runtime Functional Testing**
   - Start built image, wait for health check
   - Make basic API call (list models, health endpoint)
   - Validate OTel instrumentation activates with OTEL_* vars
   - Effort: 6-8 hours

4. **Add SBOM Generation**
   - Use `syft` or `trivy` to generate SBOM for built images
   - Attach as build artifact
   - Effort: 2-3 hours

5. **Create .claude/rules/ Test Automation Rules**
   - `unit-tests.md`: pytest patterns, network isolation, mock vs. fake, conftest patterns
   - `integration-tests.md`: record/replay workflow, fixture usage, provider setup
   - `security-tests.md`: FIPS compliance, SQL injection avoidance, authorized stores
   - Effort: 2-3 hours per rule file

### Priority 2 (Nice-to-Have)

6. **Add Performance Testing Workflow**
   - Project already has `locust` as benchmark dependency group
   - Create periodic benchmark workflow with result tracking
   - Effort: 8-12 hours

7. **Add Secret Detection Scanning**
   - Current `detect-private-key` only catches private key formats
   - Add Gitleaks or TruffleHog for API keys, tokens, passwords
   - Effort: 2-3 hours

8. **Consider Mutation Testing**
   - Validate test effectiveness beyond line coverage
   - Tools: mutmut for Python
   - Effort: 8-12 hours

## Comparison to Gold Standards

| Dimension | llama-stack (OGX) | odh-dashboard | notebooks | kserve |
|-----------|-------------------|---------------|-----------|--------|
| Unit Tests | 8.5 - 170 files, pytest-socket | 9.0 - Multi-layer, contract tests | 7.0 - Notebook validation | 9.0 - envtest, webhook tests |
| Integration/E2E | 9.0 - Record/replay, multi-provider | 9.0 - Cypress, contract tests | 8.0 - Notebook execution | 8.5 - Multi-version k8s |
| Build Integration | 7.5 - Venv PR builds, container on push | 8.0 - PR container builds | 7.0 - Image builds | 7.5 - ko builds |
| Image Testing | 7.0 - Entrypoint validation | 7.5 - Basic startup | 9.5 - 5-layer validation | 7.0 - Basic startup |
| Coverage Tracking | 5.5 - Local only | 8.0 - Codecov + threshold | 6.0 - Partial | 9.0 - Codecov enforced |
| CI/CD Automation | 9.5 - 42 workflows, mature | 8.5 - Well-organized | 8.0 - Image pipeline | 8.5 - Multi-version |
| Agent Rules | 7.5 - CLAUDE.md + AGENTS.md | 9.0 - .claude/rules/ | 3.0 - None | 4.0 - Basic |
| **Overall** | **8.2** | **8.7** | **7.2** | **7.9** |

**Key Differentiators**:
- **Record/Replay System**: Unique innovation for AI API testing — eliminates API cost, non-determinism, and provider dependency during development and CI
- **Pre-commit Security Hooks**: Unusually comprehensive (FIPS, SQL injection, API independence, authorized stores)
- **CVE Constraint Management**: Active tracking of dependency CVEs with detailed comments
- **CI Matrix Generation**: Dynamic test matrix based on changed files
- **42 Workflows**: Among the most comprehensive CI setups analyzed

## File Paths Reference

| Category | Path |
|----------|------|
| CI/CD Workflows | `.github/workflows/*.yml` (42 files) |
| Pre-commit Config | `.pre-commit-config.yaml` |
| Python Config | `pyproject.toml` |
| Coverage Config | `.coveragerc` |
| Unit Tests | `tests/unit/` (170 test files) |
| Integration Tests | `tests/integration/` (54 test files) |
| Integration Recordings | `tests/integration/*/recordings/` |
| Main Containerfile | `containers/Containerfile` |
| UI Containerfile | `src/ogx_ui/Containerfile` |
| Agent Rules | `CLAUDE.md`, `AGENTS.md` |
| Unit Test Script | `scripts/unit-tests.sh` |
| Integration Test Script | `scripts/integration-tests.sh` |
| CI Matrix Generator | `scripts/generate_ci_matrix.py` |
| Dependabot | `.github/dependabot.yml` |
| Mergify | `.github/mergify.yml` |
| Security Policy | `SECURITY.md` |
| CodeQL | `.github/workflows/codeql.yml` |
