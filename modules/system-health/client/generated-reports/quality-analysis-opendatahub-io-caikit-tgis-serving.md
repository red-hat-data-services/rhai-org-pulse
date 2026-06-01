---
repository: "opendatahub-io/caikit-tgis-serving"
overall_score: 3.4
scorecard:
  - dimension: "Unit Tests"
    score: 0.5
    status: "No unit tests exist — only a single smoke test script (73 lines)"
  - dimension: "Integration/E2E"
    score: 5.0
    status: "Docker Compose and KServe/Kind E2E smoke tests on PR and weekly schedule"
  - dimension: "Build Integration"
    score: 4.5
    status: "Docker image built and validated on PR via Kind, but no Konflux simulation"
  - dimension: "Image Testing"
    score: 4.0
    status: "Image built and smoke-tested via Compose/KServe, but no vulnerability scanning or SBOM"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling, no codecov integration, no coverage thresholds"
  - dimension: "CI/CD Automation"
    score: 5.5
    status: "5 workflows covering build, test, dependency updates, and PR cleanup — but no linting, no security scanning"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules"
critical_gaps:
  - title: "Zero unit tests"
    impact: "No regression protection for Python code; changes to caikit.yml, Dockerfile, or dependencies have no validation beyond smoke tests"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No code coverage tracking"
    impact: "Impossible to measure or enforce test coverage; regressions go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No security scanning (Trivy, CodeQL, SAST)"
    impact: "Vulnerable dependencies and container images shipped without detection"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No linting or static analysis"
    impact: "Code quality not enforced; Python style inconsistencies and potential bugs not caught"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No pre-commit hooks"
    impact: "No local quality gates before code reaches CI"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents lack project context for test creation and code contribution"
    severity: "LOW"
    effort: "2-3 hours"
quick_wins:
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Automated vulnerability detection for every PR"
  - title: "Add ruff linter configuration"
    effort: "1-2 hours"
    impact: "Fast Python linting and formatting enforcement"
  - title: "Add codecov integration with pytest-cov"
    effort: "2-4 hours"
    impact: "Coverage visibility and threshold enforcement"
  - title: "Add pre-commit hooks for formatting and linting"
    effort: "1-2 hours"
    impact: "Local quality gates prevent CI failures"
recommendations:
  priority_0:
    - "Add unit tests for smoke-test.py and convert.py with pytest framework"
    - "Integrate Trivy container vulnerability scanning in the build-and-test workflow"
    - "Add codecov/coverage tracking with pytest-cov and a minimum threshold"
  priority_1:
    - "Add ruff or flake8 linting to CI pipeline"
    - "Add CodeQL or Semgrep SAST scanning"
    - "Create pre-commit hooks for formatting, linting, and secret detection"
    - "Add multi-architecture image builds (arm64 support)"
  priority_2:
    - "Create agent rules (.claude/rules/) for test patterns"
    - "Add SBOM generation to container builds"
    - "Add image signing/attestation"
    - "Add performance/load testing for inference endpoints"
---

# Quality Analysis: caikit-tgis-serving

## Executive Summary
- **Overall Score: 3.4/10**
- **Repository Type**: Python container image — a thin serving layer wrapping [caikit](https://github.com/caikit/caikit) and [text-generation-inference](https://github.com/IBM/text-generation-inference) for KServe
- **Primary Language**: Python 3.11 (Poetry-managed)
- **Key Strengths**: Good E2E smoke test infrastructure using Docker Compose and KServe/Kind; Dependabot dependency updates configured for pip, Docker, and GitHub Actions
- **Critical Gaps**: Zero unit tests, no coverage tracking, no security scanning, no linting, no agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, no `.claude/` directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0.5/10 | No unit tests — only a single smoke-test script |
| Integration/E2E | 5.0/10 | Docker Compose + KServe/Kind smoke tests on PR |
| Build Integration | 4.5/10 | Image built on PR with Kind validation, no Konflux sim |
| Image Testing | 4.0/10 | Smoke test validates runtime, no vuln scanning or SBOM |
| Coverage Tracking | 0.0/10 | No coverage tooling whatsoever |
| CI/CD Automation | 5.5/10 | 5 workflows, but missing linting and security |
| Agent Rules | 0.0/10 | No agent rules or AI development guidance |

## Critical Gaps

### 1. Zero Unit Tests
- **Impact**: No regression protection for any Python code. The entire test suite is a single 73-line `smoke-test.py` that tests HTTP/gRPC connectivity to a running server.
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Details**: The repository has only 2 Python source files (`smoke-test.py` and `convert.py`), neither has unit test coverage. The `smoke-test.py` itself has testable functions (`wait_until`, `test_grpc`, `test_http`) that are only validated through full E2E execution.

### 2. No Code Coverage Tracking
- **Impact**: Impossible to measure, track, or enforce test coverage. No codecov/coveralls integration, no `.coveragerc`, no coverage thresholds.
- **Severity**: HIGH
- **Effort**: 2-4 hours

### 3. No Security Scanning
- **Impact**: Container images built from `ubi9/ubi-minimal` with Python packages installed via Poetry — no Trivy, Snyk, or other vulnerability scanning. No CodeQL or SAST. No Gitleaks for secret detection.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The Dockerfile installs packages with `pip` and `poetry` without any vulnerability checking. Dependencies include ML frameworks (`caikit`, `caikit-nlp`, `caikit-tgis-backend`) which may pull in large dependency trees.

### 4. No Linting or Static Analysis
- **Impact**: Python code quality not enforced. No `ruff.toml`, `flake8`, `mypy.ini`, `pylint`, or any linter configuration.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours

### 5. No Pre-commit Hooks
- **Impact**: No local quality gates. Developers can push unformatted, unlinted code without any pre-CI check.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours

### 6. No Agent Rules
- **Impact**: AI coding agents have no project-specific context for writing tests, understanding architecture, or following contribution patterns.
- **Severity**: LOW
- **Effort**: 2-3 hours

## Quick Wins

### 1. Add Trivy Container Scanning (1-2 hours)
Add to `build-and-test.yml` after the image build step:
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    input: /tmp/image.tar
    format: 'table'
    exit-code: '1'
    severity: 'CRITICAL,HIGH'
```

### 2. Add Ruff Linting (1-2 hours)
Create `ruff.toml`:
```toml
line-length = 120
target-version = "py311"

[lint]
select = ["E", "F", "I", "W", "UP"]
```
Add to CI:
```yaml
- name: Lint with ruff
  run: pip install ruff && ruff check .
```

### 3. Add Codecov with pytest-cov (2-4 hours)
Add `pytest` and `pytest-cov` to dev dependencies. Create a unit test job:
```yaml
- name: Run tests with coverage
  run: |
    poetry install
    poetry run pytest --cov=. --cov-report=xml
- name: Upload coverage
  uses: codecov/codecov-action@v4
```

### 4. Add Pre-commit Hooks (1-2 hours)
Create `.pre-commit-config.yaml`:
```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.4.0
    hooks:
      - id: ruff
      - id: ruff-format
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory** (5 workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build-and-test.yml` | PR, push to main, weekly, manual | Build image + Compose smoke test + KServe smoke test |
| `kserve-test.yml` | Weekly, manual | Standalone KServe smoke test (PR trigger commented out) |
| `dependabot-autoapprove.yaml` | PR (Dependabot only) | Auto-approve Dependabot PRs |
| `pr-close-image-delete.yaml` | PR closed | Delete PR image from Quay.io |
| `run-update.yml` | Weekly, manual | Update Poetry lockfiles and create PR |

**Strengths**:
- PR-triggered build-and-test workflow validates image builds on every PR
- Two-tier smoke testing (Docker Compose for fast validation, KServe/Kind for realistic deployment)
- Automated dependency updates via Dependabot (pip, Docker, GitHub Actions) and Poetry lockfile refresh
- PR image cleanup to avoid Quay.io accumulation

**Weaknesses**:
- No concurrency control — parallel PRs can waste CI resources
- No caching for Docker layers or Python dependencies
- `kserve-test.yml` has PR trigger commented out — duplicates functionality in `build-and-test.yml`
- No linting, formatting, or security scanning in any workflow
- No test matrix (single Python version, single platform)

### Test Coverage

**Test Files Found**: 1 file (`test/smoke-test.py`, 73 lines)

**Test Infrastructure**:
- `test/compose/` — Docker Compose setup with caikit + tgis containers, smoke test via shell script
- `test/kserve/` — Kind cluster setup with KServe, InferenceService deployment, HTTP inference test
- `demo/kserve/scripts/test/` — Manual test scripts for gRPC/HTTP calls (not automated in CI)

**Unit Tests**: None. Zero `pytest`, `unittest`, or any test framework usage.

**Test-to-Code Ratio**: The repo has ~97 lines of Python source code (smoke-test.py + convert.py) and 73 lines of test code (smoke-test.py itself, which is both source and test). The ratio is misleading because the smoke test is actually an E2E integration test, not a unit test.

**Coverage**: No coverage tool configured. No `.coveragerc`, no `codecov.yml`, no coverage reporting.

### Code Quality

**Linting**: None configured. No `ruff.toml`, `.flake8`, `mypy.ini`, `.pylintrc`, or any linter.

**Formatting**: No formatter configured (no `black`, `ruff format`, or `autopep8`).

**Pre-commit Hooks**: None. No `.pre-commit-config.yaml`.

**Static Analysis**: None. No CodeQL, Semgrep, Bandit, or other SAST tools.

**Type Checking**: No `mypy` or `pyright` configuration.

### Container Images

**Dockerfile Analysis**:
- Multi-stage build: `poetry-builder` (install deps) → `deploy` (minimal runtime)
- Base image: `registry.access.redhat.com/ubi9/ubi-minimal:latest` (good — supported, hardened base)
- Non-root user: Yes (`caikit` user, UID 1001) — good security practice
- Platform: `linux/amd64` only (no multi-arch support)

**Strengths**:
- Multi-stage build reduces final image size
- Non-root user for runtime
- Minimal base image (ubi-minimal)

**Weaknesses**:
- No vulnerability scanning (no Trivy, Snyk, Grype)
- No SBOM generation
- No image signing/attestation
- No health check defined in Dockerfile (though KServe manifests define probes)
- `latest` tag used for base image (not pinned — reproducibility risk)
- No `.hadolint.yaml` for Dockerfile linting

### Security

**Dependency Management**:
- Dependabot configured for pip, Docker, and GitHub Actions (good)
- Poetry lockfile ensures reproducible installs
- Weekly automated Poetry lockfile updates

**Missing Security Practices**:
- No container vulnerability scanning
- No SAST/CodeQL integration
- No secret detection (Gitleaks, TruffleHog)
- No dependency audit (`pip audit`, `safety`)
- No SBOM generation
- No supply chain attestation (SLSA, Sigstore)

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No rules for any test type
- **Quality**: N/A
- **Gaps**: No `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`, no test automation guidance
- **Recommendation**: Generate rules with `/test-rules-generator` covering smoke test patterns, Docker Compose test conventions, KServe deployment test patterns

## Recommendations

### Priority 0 (Critical)
1. **Add unit tests with pytest** — Write tests for `convert.py` and the utility functions in `smoke-test.py`. Add `pytest` and `pytest-cov` to dev dependencies. Target initial coverage of the 2 Python source files.
2. **Integrate Trivy container scanning** — Add Trivy to the `build-and-test.yml` workflow to scan the built image for CRITICAL and HIGH vulnerabilities before PR merge.
3. **Add coverage tracking** — Configure `pytest-cov` and integrate with Codecov to track and enforce minimum coverage thresholds.

### Priority 1 (High Value)
4. **Add Python linting with ruff** — Configure `ruff` for linting and formatting enforcement in CI. Ruff is fast and covers most Python quality checks.
5. **Add CodeQL or Semgrep SAST** — Enable static application security testing to catch Python security anti-patterns.
6. **Create pre-commit hooks** — Add `.pre-commit-config.yaml` with ruff, ruff-format, and gitleaks hooks.
7. **Add multi-architecture image builds** — Support `linux/arm64` alongside `linux/amd64` for broader deployment compatibility.
8. **Pin base image version** — Replace `ubi9/ubi-minimal:latest` with a specific version tag for reproducible builds.

### Priority 2 (Nice-to-Have)
9. **Create agent rules** — Add `.claude/rules/` with guidance for smoke test patterns, KServe deployment testing, and contribution conventions.
10. **Add SBOM generation** — Use `syft` or `cosign` to generate SBOM for container images.
11. **Add image signing** — Sign images with Sigstore/cosign for supply chain security.
12. **Add load/performance testing** — Test inference endpoint performance under load with tools like `locust` or `k6`.
13. **Add Dockerfile linting** — Add `hadolint` to CI for Dockerfile best practice enforcement.

## Comparison to Gold Standards

| Dimension | caikit-tgis-serving | odh-dashboard | notebooks | kserve |
|-----------|-------------------|---------------|-----------|--------|
| Unit Tests | 0.5 — None | 9.0 — Comprehensive Jest | 7.0 — Python/notebook tests | 8.5 — Go test suite |
| Integration/E2E | 5.0 — Smoke tests only | 9.0 — Cypress + contract | 8.0 — Multi-layer validation | 9.0 — envtest + Kind |
| Build Integration | 4.5 — Image + Kind | 7.0 — Multi-mode builds | 8.0 — 5-layer validation | 7.5 — Multi-version |
| Image Testing | 4.0 — Smoke only | 6.0 — Basic builds | 9.0 — Full pipeline | 7.0 — Runtime validation |
| Coverage Tracking | 0.0 — None | 8.0 — Codecov enforced | 5.0 — Basic tracking | 8.5 — Enforced thresholds |
| CI/CD Automation | 5.5 — 5 workflows | 9.0 — Comprehensive | 8.0 — Well-organized | 9.0 — Multi-workflow |
| Agent Rules | 0.0 — None | 8.0 — Comprehensive | 3.0 — Minimal | 2.0 — Basic |
| **Overall** | **3.4** | **8.5** | **7.0** | **7.9** |

## File Paths Reference

| Category | Path | Notes |
|----------|------|-------|
| CI/CD | `.github/workflows/build-and-test.yml` | Main PR workflow |
| CI/CD | `.github/workflows/kserve-test.yml` | Weekly KServe test (PR trigger disabled) |
| CI/CD | `.github/workflows/dependabot-autoapprove.yaml` | Auto-approve Dependabot PRs |
| CI/CD | `.github/workflows/pr-close-image-delete.yaml` | PR image cleanup |
| CI/CD | `.github/workflows/run-update.yml` | Weekly Poetry lockfile refresh |
| Test | `test/smoke-test.py` | Main smoke test (gRPC + HTTP) |
| Test | `test/compose/smoke-test.sh` | Docker Compose test driver |
| Test | `test/compose/docker-compose.yml` | Compose config for testing |
| Test | `test/kserve/caikit-tgis-serving.yaml` | KServe deployment manifests |
| Test | `test/kserve/setup.yaml` | Model setup pod for Kind |
| Build | `Dockerfile` | Multi-stage build |
| Build | `.dockerignore` | Docker build exclusions |
| Config | `pyproject.toml` | Poetry dependencies (Python 3.11) |
| Config | `poetry.lock` | Locked dependencies |
| Config | `caikit.yml` | Caikit runtime configuration |
| Config | `.github/dependabot.yml` | Dependabot config (pip, Docker, Actions) |
| Utils | `utils/convert.py` | Model format converter |
| Demo | `demo/kserve/scripts/test/` | Manual test scripts (not in CI) |
