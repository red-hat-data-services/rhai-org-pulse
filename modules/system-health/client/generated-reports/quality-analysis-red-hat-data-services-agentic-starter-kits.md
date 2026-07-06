---
repository: "red-hat-data-services/agentic-starter-kits"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "90 test files across all agents with pytest, strong test-to-code ratio (0.64)"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Nightly deployment integration tests on OpenShift, behavioral evals with cluster btests"
  - dimension: "Build Integration"
    score: 5.0
    status: "No PR-time container build or image validation; deployment tests only nightly"
  - dimension: "Image Testing"
    score: 4.0
    status: "Dockerfiles exist per agent but no runtime validation, no Trivy/Snyk scanning"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "No coverage generation, no codecov integration, no coverage thresholds"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "7 workflows with concurrency control, path filtering, JUnit reports, Dependabot"
  - dimension: "Agent Rules"
    score: 8.5
    status: "Comprehensive AGENTS.md and CLAUDE.md with commands, boundaries, and gotchas"
critical_gaps:
  - title: "No code coverage tracking or enforcement"
    impact: "Cannot measure test coverage trends or enforce minimum thresholds on PRs"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container image security scanning"
    impact: "Vulnerabilities in UBI9 base images or Python dependencies go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No PR-time container build validation"
    impact: "Dockerfile breakage discovered only in nightly deployment tests or post-merge"
    severity: "HIGH"
    effort: "6-8 hours"
  - title: "No SAST/CodeQL integration"
    impact: "Static application security vulnerabilities not caught automatically"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "Ruff lint rules are minimal (E, F, I only)"
    impact: "Missing common Python quality checks (bugbear, security, complexity, annotations)"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add Trivy container scanning to code-quality workflow"
    effort: "1-2 hours"
    impact: "Catch CVEs in base images and Python dependencies on every PR"
  - title: "Enable pytest-cov and upload to Codecov"
    effort: "2-3 hours"
    impact: "Immediate visibility into test coverage with PR annotations"
  - title: "Expand ruff lint rules to include B, S, C4, UP, SIM"
    effort: "1-2 hours"
    impact: "Catch more bugs, security issues, and simplification opportunities"
  - title: "Add PR-time Docker build smoke test"
    effort: "3-4 hours"
    impact: "Catch Dockerfile breakage before merge, not in nightly runs"
recommendations:
  priority_0:
    - "Add pytest-cov to test dependencies and generate coverage reports in agent-tests workflow"
    - "Integrate Trivy scanning for all agent Dockerfiles in the code-quality workflow"
    - "Add PR-time container build validation (at minimum docker build --check)"
  priority_1:
    - "Add CodeQL or Semgrep for Python SAST scanning"
    - "Expand ruff rules to include flake8-bugbear (B), bandit (S), comprehensions (C4), pyupgrade (UP)"
    - "Add coverage thresholds and Codecov PR commenting"
  priority_2:
    - "Add multi-architecture container builds (linux/amd64 + linux/arm64)"
    - "Add performance/latency regression tests for agent endpoints"
    - "Add SBOM generation (syft/cyclonedx) to container builds"
    - "Create .claude/rules/ directory with test creation rules per test type"
---

# Quality Analysis: agentic-starter-kits

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Python monorepo — production-ready AI agent starter kits for Red Hat OpenShift
- **Primary Language**: Python 3.12
- **Frameworks**: LangGraph, LlamaIndex, CrewAI, AutoGen, Google ADK, Langflow, A2A
- **Key Strengths**: Excellent test organization across behavioral/unit/integration layers, strong CI/CD with 7 workflows, comprehensive agent rules (AGENTS.md), nightly deployment integration tests on OpenShift, behavioral eval harness with MLflow integration
- **Critical Gaps**: No code coverage tracking, no container security scanning, no PR-time image builds, minimal ruff lint rules
- **Agent Rules Status**: Present and comprehensive (AGENTS.md + CLAUDE.md)

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.0/10 | 90 test files, pytest framework, strong test-to-code ratio (0.64) |
| Integration/E2E | 8.5/10 | Nightly OpenShift deployment tests, behavioral evals, cluster btests |
| **Build Integration** | **5.0/10** | **No PR-time container build or image validation** |
| Image Testing | 4.0/10 | Dockerfiles exist but no runtime validation or scanning |
| Coverage Tracking | 3.0/10 | No coverage generation, no codecov, no thresholds |
| CI/CD Automation | 9.0/10 | 7 workflows, concurrency control, JUnit reports, Dependabot |
| Agent Rules | 8.5/10 | Comprehensive AGENTS.md with commands, boundaries, gotchas |

## Critical Gaps

### 1. No Code Coverage Tracking or Enforcement
- **Impact**: Cannot measure test coverage trends, identify untested code paths, or enforce minimum thresholds on PRs
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Despite 90 test files and an 11K-line test suite, there is no `pytest-cov` configuration, no `.coveragerc`, no `codecov.yml`, and no coverage upload in any workflow. Coverage is invisible.

### 2. No Container Image Security Scanning
- **Impact**: Vulnerabilities in UBI9 base images or Python dependencies shipped to OpenShift go undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Trivy, Snyk, or Grype integration. No `.trivyignore`. Container images are built and deployed without any vulnerability assessment.

### 3. No PR-time Container Build Validation
- **Impact**: Dockerfile breakage is only discovered in nightly `agent-deployment-test` runs or post-merge, delaying feedback by hours to days
- **Severity**: HIGH
- **Effort**: 6-8 hours
- **Details**: The `agent-tests.yml` workflow runs unit tests only. Container builds are validated only in the nightly `agent-deployment-test.yaml` workflow, which deploys to an actual OpenShift cluster.

### 4. No SAST/CodeQL Integration
- **Impact**: Static application security vulnerabilities (injection, insecure deserialization, etc.) not caught automatically
- **Severity**: MEDIUM
- **Effort**: 2-3 hours

### 5. Ruff Lint Rules Are Minimal
- **Impact**: Only `E` (pycodestyle errors), `F` (pyflakes), and `I` (isort) are enabled. Missing common quality checks like flake8-bugbear (B), bandit security checks (S), comprehensions (C4), pyupgrade (UP), and simplification (SIM).
- **Severity**: MEDIUM
- **Effort**: 2-3 hours

## Quick Wins

### 1. Add Trivy Container Scanning (1-2 hours)
Add to `.github/workflows/code-quality.yml`:
```yaml
container-scan:
  runs-on: ubuntu-latest
  strategy:
    matrix:
      agent:
        - agents/langgraph/templates/react_agent
        - agents/crewai/templates/websearch_agent
  steps:
    - uses: actions/checkout@v4
    - name: Build image
      run: docker build -t test-image ${{ matrix.agent }}
    - name: Run Trivy
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: test-image
        severity: CRITICAL,HIGH
        exit-code: 1
```

### 2. Enable pytest-cov and Upload to Codecov (2-3 hours)
Add `pytest-cov` to `[project.optional-dependencies].test` in `pyproject.toml`, then update `agent-tests.yml`:
```yaml
- name: Run tests with coverage
  run: |
    make -C "$agent_dir" test PYTEST_ARGS="--cov --cov-report=xml -v"
- uses: codecov/codecov-action@v4
  with:
    files: test-results/coverage.xml
```

### 3. Expand Ruff Lint Rules (1-2 hours)
Update `ruff.toml`:
```toml
[lint]
select = ["E", "F", "I", "B", "S", "C4", "UP", "SIM", "RUF"]
```

### 4. Add PR-time Docker Build Smoke Test (3-4 hours)
Add a workflow job that runs `docker build` for changed agents on every PR to catch Dockerfile breakage early.

## Detailed Findings

### CI/CD Pipeline

**Strengths:**
- **7 well-organized workflows**: `agent-tests.yml`, `code-quality.yml`, `eval-gating.yml`, `agent-deployment-test.yaml`, `pr-labeler.yml`, `pr-title.yml`, `pre-release.yaml`
- **Concurrency control**: All workflows use `cancel-in-progress: true` with scoped groups
- **Path filtering**: `eval-gating.yml` uses fine-grained path triggers to avoid unnecessary runs
- **Change-aware testing**: `agent-tests.yml` detects which agents changed and only tests those
- **JUnit test reports**: Published via `mikepenz/action-junit-report` for PR annotations
- **Dependabot**: Configured for both GitHub Actions and pip with grouped updates
- **PR hygiene**: Conventional commits enforcement, size labeling, area labeling
- **Timeout guards**: All jobs have explicit `timeout-minutes`

**Gaps:**
- No PR-time container build step
- No caching of Python dependencies in workflows (uv is fast, but caching would help)
- No CodeQL or SAST workflow

### Test Coverage

**Strengths:**
- **90 test files** across the monorepo with **11,060 lines** of test code
- **Test-to-code ratio**: 0.64 (11K test lines / 17K source lines) — strong for a starter kit repo
- **Multi-layer testing strategy**:
  - **Unit tests** (`test_*.py` at agent root): API contract tests, tool tests, packaging config tests, auth middleware tests
  - **Behavioral tests** (`tests/behavioral/`): Response quality, tool usage, cost/latency, reliability, streaming parity, injection resistance, boundary conditions, memory isolation/persistence
  - **Integration tests** (`tests/integration/`): Deployment health checks, auth integration
  - **Cross-agent tests** (`tests/behavioral/adversarial/`): Prompt injection, safety, boundary conditions, API contract compliance
- **Eval harness** (`evals/harness/`): Custom evaluation framework with runners, scorers, MLflow integration, pytest plugin
- **EvalHub adapter** (`evals/evalhub_adapter/`): On-cluster evaluation adapter with its own test suite
- **Well-structured conftest.py**: Shared fixtures with `run_eval`, `score_collector`, `load_golden` helpers
- **Pytest markers**: Rich marker system for selecting test categories and agents

**Gaps:**
- No `pytest-cov` or any coverage generation
- No coverage reporting on PRs
- No coverage thresholds or enforcement
- No mutation testing

### Code Quality

**Strengths:**
- **Ruff**: Linting and formatting enforced in CI and pre-commit hooks (v0.15.11)
- **ty**: Type checking with per-file override configuration for framework quirks
- **Markdownlint**: All markdown files linted with markdownlint-cli2
- **Actionlint**: GitHub Actions workflows validated
- **Pre-commit hooks**: Comprehensive configuration with 8 hook repositories:
  - Conventional commit linting
  - File hygiene (trailing whitespace, EOF, YAML/JSON/TOML validation, merge conflicts, large files, debug statements, private key detection)
  - Ruff (lint + format)
  - Markdownlint
  - Gitleaks (secret scanning)
  - uv-lock (lock file sync for all 12 projects)
  - Actionlint
- **Lockfile validation**: CI verifies all `uv.lock` files are in sync

**Gaps:**
- Ruff rules are minimal (`E`, `F`, `I` only)
- No complexity checking (McCabe, cognitive complexity)
- ty.toml globally ignores `unresolved-import` and `unresolved-attribute` — only CI overrides with `--error unresolved-import`

### Container Images

**Strengths:**
- **14 Dockerfiles/Containerfiles** across agents and infrastructure
- **UBI9 base images**: Red Hat-supported `ubi9/python-312` for production agents
- **Non-root execution**: UID 1001 with GID 0 group permissions for OpenShift arbitrary UID
- **uv for dependency installation**: Fast, reproducible installs via pinned uv image digest
- **Standardized port**: 8080 for OpenShift convention

**Gaps:**
- No multi-stage builds (single-stage with root user switch)
- No container image scanning (Trivy, Snyk, Grype)
- No SBOM generation
- No image signing or attestation
- No `.dockerignore` files found (could lead to bloated images)
- No runtime health validation in image build process
- No multi-architecture support (amd64 only)

### Security

**Strengths:**
- **Gitleaks**: Secret scanning in both pre-commit hooks and CI with pinned SHA256 checksums
- **Dependabot**: Automated dependency updates with grouped PRs
- **Pinned action SHAs**: All GitHub Actions use full commit SHAs, not mutable tags
- **Minimal permissions**: Workflows use least-privilege `permissions:` blocks
- **Private key detection**: Pre-commit hook detects accidentally committed private keys
- **CODEOWNERS**: Configured for maintainer review enforcement
- **`.gitleaksignore`**: False positive allowlisting with commit-level specificity

**Gaps:**
- No SAST (CodeQL, Semgrep, Bandit)
- No container vulnerability scanning
- No dependency vulnerability scanning (Dependabot updates but doesn't scan for CVEs)
- No security-focused ruff rules (bandit `S` rules disabled)

### Agent Rules (Agentic Flow Quality)

**Status**: Present and comprehensive

**AGENTS.md** (project root):
- Complete repository structure documentation
- All make targets documented (`init`, `env`, `run-app`, `test`, `build`, `push`, `deploy`, `dry-run`)
- Code style conventions (Python >=3.12, FastAPI, uv, port conventions)
- Workflow guidance (cd into agent dir, check agent.yaml, run make test)
- Explicit boundaries (don't modify charts, don't modify CI, don't refactor other agents)
- Non-standard agent documentation (langflow, a2a, openclaw)
- Common gotchas (agent.yaml format, port mapping, images dir, Helm secrets)

**CLAUDE.md** (project root):
- Present (references AGENTS.md via `@AGENTS.md` directive)

**Gaps:**
- No `.claude/rules/` directory with test creation rules
- No `.claude/skills/` for custom skills
- Testing documentation exists in `docs/adding-behavioral-tests.md` but is not linked from agent rules
- No explicit test patterns or examples in AGENTS.md for different test types

## Recommendations

### Priority 0 (Critical)

1. **Add code coverage tracking** — Install `pytest-cov`, generate XML reports in `agent-tests.yml`, integrate with Codecov for PR annotations. Set a baseline threshold (e.g., 60%) and increase over time.

2. **Add container security scanning** — Integrate Trivy in the `code-quality.yml` workflow to scan Dockerfiles and built images on every PR. Start with CRITICAL/HIGH severity threshold.

3. **Add PR-time container build validation** — Create a workflow job that builds Docker images for changed agents on every PR, catching Dockerfile breakage before merge.

### Priority 1 (High Value)

4. **Add SAST scanning** — Enable GitHub CodeQL for Python or add Semgrep. This is especially important for an AI agent repo where prompt injection and insecure API handling are real risks.

5. **Expand ruff lint rules** — Add `B` (bugbear), `S` (bandit/security), `C4` (comprehensions), `UP` (pyupgrade), `SIM` (simplification), `RUF` (ruff-specific). Fix or ignore existing violations incrementally.

6. **Add coverage thresholds** — Once coverage baseline is established, enforce minimum coverage on PRs with Codecov's `patch` and `project` targets.

### Priority 2 (Nice-to-Have)

7. **Multi-architecture container builds** — Add `linux/arm64` support using Docker buildx or Podman for broader deployment compatibility.

8. **SBOM generation** — Add Syft or CycloneDX to container builds for supply chain transparency.

9. **Create `.claude/rules/` test creation rules** — Generate rules for unit tests, behavioral tests, integration tests, and API contract tests using the existing patterns. Run `/test-rules-generator` to bootstrap.

10. **Add performance regression tests** — Track agent response latency over time; the behavioral `test_cost_latency.py` tests already exist but could be enhanced with baseline comparison.

## Comparison to Gold Standards

| Dimension | agentic-starter-kits | odh-dashboard | notebooks | kserve |
|-----------|---------------------|---------------|-----------|--------|
| Unit Tests | 8.0 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 8.5 | 9.0 | 8.0 | 9.5 |
| Build Integration | 5.0 | 7.0 | 6.0 | 8.0 |
| Image Testing | 4.0 | 7.0 | 9.0 | 6.0 |
| Coverage Tracking | 3.0 | 9.0 | 5.0 | 9.0 |
| CI/CD Automation | 9.0 | 9.0 | 8.0 | 9.0 |
| Agent Rules | 8.5 | 8.0 | 3.0 | 2.0 |
| **Overall** | **7.6** | **8.5** | **7.0** | **8.2** |

**Notable Differentiators:**
- This repo has the strongest agent rules of any analyzed repository
- Behavioral eval harness with MLflow integration is unique and sophisticated
- Multi-framework coverage (7+ agent frameworks) is impressive for a starter kit repo
- The gap in coverage tracking and container scanning is the most significant area for improvement

## File Paths Reference

### CI/CD Workflows
- `.github/workflows/agent-tests.yml` — Unit tests (PR + push)
- `.github/workflows/code-quality.yml` — Ruff, markdownlint, actionlint, lockfile check, gitleaks, ty
- `.github/workflows/eval-gating.yml` — Behavioral eval gating (deterministic + cluster)
- `.github/workflows/agent-deployment-test.yaml` — Nightly OpenShift deployment tests
- `.github/workflows/pr-labeler.yml` — Automated PR labeling
- `.github/workflows/pr-title.yml` — Conventional commit PR title enforcement
- `.github/workflows/pre-release.yaml` — Release branch and manifest generation

### Code Quality
- `ruff.toml` — Ruff linting and formatting config
- `ty.toml` — Type checking config with per-file overrides
- `.pre-commit-config.yaml` — 8 pre-commit hook repositories
- `.gitleaks.toml` — Gitleaks secret scanning config
- `.markdownlint-cli2.yaml` — Markdown lint config

### Testing
- `pyproject.toml` — Pytest config with markers, test paths, and optional deps
- `tests/behavioral/` — Cross-agent behavioral tests (adversarial, API contract, deterministic)
- `agents/*/templates/*/tests/` — Agent-specific unit, behavioral, and integration tests
- `evals/harness/` — Shared eval engine (runner, scorers, MLflow client, pytest plugin)
- `evals/evalhub_adapter/` — EvalHub on-cluster adapter

### Container Images
- `agents/*/templates/*/Dockerfile` — Per-agent Dockerfiles (UBI9 base)
- `sandboxes/base/Containerfile` — Sandbox base image
- `evals/evalhub_adapter/Containerfile` — EvalHub adapter image

### Agent Rules
- `AGENTS.md` — Comprehensive agent development guide
- `CLAUDE.md` — Claude Code configuration
- `docs/adding-a-new-agent.md` — New agent template guide
- `docs/adding-behavioral-tests.md` — Behavioral test writing guide
