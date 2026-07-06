---
repository: "opendatahub-io/agentic-ci"
overall_score: 7.9
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "636 test functions across 28 test files with pytest; excellent test-to-code ratio (~0.91)"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Comprehensive E2E suite for podman, openshell, and multi-harness scenarios; automated in CI"
  - dimension: "Build Integration"
    score: 7.5
    status: "PR-time image builds with shellcheck/ruff lint; no Konflux simulation but images build and E2E test on PR"
  - dimension: "Image Testing"
    score: 7.0
    status: "Image unit tests and E2E validation; no vulnerability scanning or SBOM generation"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "No coverage measurement, no codecov/coveralls, no coverage thresholds"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "Well-organized workflows, concurrency control, Mergify merge queue, multi-Python matrix, auto-merge for bots"
  - dimension: "Agent Rules"
    score: 7.0
    status: "Rich AGENTS.md with architecture docs; Claude skills for debug, release, and E2E; no .claude/rules/"
critical_gaps:
  - title: "No code coverage tracking"
    impact: "Cannot measure test coverage or enforce coverage thresholds; regressions may introduce untested code paths"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container vulnerability scanning"
    impact: "Security vulnerabilities in base images or dependencies not caught before deployment"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No SAST/CodeQL integration"
    impact: "Code-level security vulnerabilities not automatically detected"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No pre-commit hooks"
    impact: "Developers can commit code that fails lint/format checks, wasting CI cycles"
    severity: "LOW"
    effort: "1-2 hours"
quick_wins:
  - title: "Add pytest-cov and codecov integration"
    effort: "2-4 hours"
    impact: "Immediate visibility into test coverage gaps; enables coverage thresholds on PRs"
  - title: "Add Trivy scanning to image build workflow"
    effort: "1-2 hours"
    impact: "Catches known CVEs in container images before deployment"
  - title: "Add pre-commit hooks for ruff lint/format"
    effort: "1 hour"
    impact: "Catches formatting and lint issues before code reaches CI"
  - title: "Add CodeQL or Bandit scanning workflow"
    effort: "2-3 hours"
    impact: "Automated security analysis catches injection and other code-level vulnerabilities"
recommendations:
  priority_0:
    - "Add pytest-cov to tox config and integrate with codecov for PR coverage reporting and thresholds"
    - "Add Trivy container scanning to images.yml and images-pr.yml workflows"
  priority_1:
    - "Add CodeQL or Bandit SAST workflow for Python security analysis"
    - "Create .claude/rules/ directory with test pattern rules for unit tests, E2E tests, and mocking standards"
    - "Add multi-architecture image builds (arm64) for broader deployment support"
  priority_2:
    - "Add pre-commit hooks for ruff lint and format checks"
    - "Add SBOM generation (Syft) to image build pipeline"
    - "Add image signing with Cosign for supply chain security"
---

# Quality Analysis: agentic-ci

**Repository**: [opendatahub-io/agentic-ci](https://github.com/opendatahub-io/agentic-ci)
**Type**: Python CLI tool / CI framework
**Primary Language**: Python 3.10+
**Framework**: CLI tool with pluggable backends (Podman, OpenShell) and harnesses (Claude Code, OpenCode)
**Analysis Date**: 2026-07-06

## Executive Summary

- **Overall Score: 7.9/10**
- **Key Strengths**: Exceptional unit test coverage (636 tests, ~0.91 test-to-code ratio), comprehensive E2E infrastructure testing across multiple backends and harnesses, well-organized CI/CD with Mergify merge queue, rich AGENTS.md documentation, and excellent dependency management via Dependabot + Renovate
- **Critical Gaps**: No code coverage tracking/enforcement, no container vulnerability scanning, no SAST integration
- **Agent Rules Status**: Present (AGENTS.md + 4 Claude skills) but incomplete (no `.claude/rules/` for test patterns)

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | 636 test functions across 28 files; 7,605 test LOC vs 8,378 source LOC |
| Integration/E2E | 8.0/10 | Automated E2E for podman + openshell + multi-harness; credential-gated |
| **Build Integration** | **7.5/10** | **PR-time image builds + lint + E2E; no Konflux simulation** |
| Image Testing | 7.0/10 | Image unit tests + entrypoint tests; no vulnerability scanning |
| Coverage Tracking | 2.0/10 | No coverage measurement, no codecov, no thresholds |
| CI/CD Automation | 9.0/10 | Multi-Python matrix, Mergify merge queue, concurrency control, auto-merge bots |
| Agent Rules | 7.0/10 | Rich AGENTS.md, 4 Claude skills; no .claude/rules/ for test patterns |

## Critical Gaps

### 1. No Code Coverage Tracking
- **Impact**: Cannot measure or enforce test coverage; untested code paths may ship without detection
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Despite having 636 test functions, there is no `pytest-cov` in tox.ini, no `.codecov.yml`, no `--cov` flag anywhere, and no coverage reporting on PRs. The project cannot objectively track whether new code is tested.

### 2. No Container Vulnerability Scanning
- **Impact**: Security vulnerabilities in UBI base images or pip dependencies not detected before images ship
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The `images.yml` workflow builds 6 container images but runs zero vulnerability scans. No Trivy, Snyk, or Grype integration. The Containerfiles use `ubi10/ubi-minimal` with SHA-pinned tools (good), but known CVEs in transitive dependencies go undetected.

### 3. No SAST/Static Security Analysis
- **Impact**: Code-level security vulnerabilities (injection, insecure deserialization, path traversal) not automatically caught
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: No CodeQL, Bandit, or Semgrep integration. The project handles credentials, subprocess execution, network policies, and container orchestration -- all high-risk areas that benefit from automated security analysis.

### 4. No Pre-commit Hooks
- **Impact**: Developers waste CI cycles on lint/format failures that could be caught locally
- **Severity**: LOW
- **Effort**: 1-2 hours
- **Details**: No `.pre-commit-config.yaml`. Ruff lint and format checks only run in CI via tox. A pre-commit hook would catch these instantly.

## Quick Wins

### 1. Add pytest-cov and Codecov Integration (2-4 hours)

**tox.ini change:**
```ini
[testenv]
deps =
    pytest
    pytest-cov
    pyyaml
commands = pytest --cov=agentic_ci --cov-report=xml {posargs:tests/}
```

**CI workflow addition to ci.yml:**
```yaml
      - name: Upload coverage
        if: matrix.tox_env == 'py313'
        uses: codecov/codecov-action@v5
        with:
          files: coverage.xml
```

### 2. Add Trivy Scanning to Image Builds (1-2 hours)

Add a step after each image build in `images.yml`:
```yaml
      - name: Scan image for vulnerabilities
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: '${{ steps.meta.outputs.image }}'
          format: 'sarif'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
```

### 3. Add Pre-commit Hooks (1 hour)

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.15.17
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
```

### 4. Add CodeQL/Bandit Scanning (2-3 hours)

```yaml
# .github/workflows/security.yml
name: Security
on: [push, pull_request]
jobs:
  bandit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install bandit
      - run: bandit -r src/ -c pyproject.toml
```

## Detailed Findings

### CI/CD Pipeline

**Strengths:**
- 5 well-organized workflows: `ci.yml`, `images-pr.yml`, `images.yml`, `publish.yml`, `docs.yml`
- `ci.yml` runs on every push/PR with a 7-entry tox matrix: py310, py311, py312, py313, lint, check-format, typecheck
- `images.yml` has excellent concurrency control (`cancel-in-progress` on non-main branches)
- `images-pr.yml` provides lightweight PR checks (shellcheck + ruff lint + entrypoint tests) with path filtering
- `images.yml` builds all 6 images on PRs with auto-expiring 3-day tags
- E2E tests run after builds complete, pulling the freshly-built `ci-<sha>` images
- `publish.yml` uses PyPI trusted publishing (id-token: write) for secure package releases
- `docs.yml` builds MkDocs with `--strict` flag
- Mergify merge queue with squash merge, differentiated rules for maintainers (1 review) vs others (2 reviews)
- Bot auto-merge for Dependabot and Renovate PRs once CI passes
- Path-aware Mergify rules that only require checks from workflows that actually trigger

**Weaknesses:**
- No coverage reporting in CI
- No security scanning workflows
- No caching of pip dependencies or tox environments
- `ci.yml` lacks path filters (runs all tox envs even for docs-only changes)

### Test Coverage

**Strengths:**
- 636 test functions across 28 test files (for 30 source modules)
- Test-to-code ratio: ~0.91 (7,605 test LOC / 8,378 source LOC) -- excellent
- Near 1:1 test file to source file mapping -- every major module has a dedicated test file
- Tests use pytest with extensive use of `unittest.mock` (20/28 test files use mocking)
- Largest test files: `test_forge_github.py` (68 tests), `test_harness.py` (61 tests), `test_forge_gitlab.py` (50 tests)
- Tests cover all key subsystems: backends, harnesses, stream processing, plugins, forge, gates, skills, Jira, git, GCP, MLflow

**Weaknesses:**
- No coverage measurement -- the 0.91 ratio is LOC-based, not branch/statement coverage
- No coverage enforcement on PRs
- No integration tests that exercise real subprocess/container execution at the unit test level (mocks only)
- E2E tests are bash scripts, not pytest tests -- harder to extend and maintain

### Code Quality

**Strengths:**
- `ruff` for lint and format with config in `pyproject.toml`
- Strict lint rules: `select = ["F", "E", "W", "I", "N"]` (Pyflakes, pycodestyle, isort, pep8-naming)
- Line length: 100 characters
- `mypy` type checking with `allow_redefinition` and `warn_unused_ignores`
- Multi-Python version testing (3.10, 3.11, 3.12, 3.13 in CI, 3.14 in tox)
- Consistent conventions documented in AGENTS.md: top-level imports only, no `# noqa`, all tests in `tests/`

**Weaknesses:**
- No pre-commit hooks
- No Ruff safety rules (S), bandit integration, or security-focused linting
- Limited ruff rule selection (no UP, RUF, PTH, SIM, etc.)

### Container Images

**Strengths:**
- 6 well-structured images: claude-runner, opencode-runner, ci-podman, claude-sandbox, opencode-sandbox, ci-openshell
- Multi-stage base image strategy (shared `Containerfile.base` for runners, `Containerfile.openshell-base` for sandboxes)
- SHA256 verification for all downloaded binaries (uv, shellcheck, gh, glab, claude)
- UBI10 base images from Red Hat registry
- `quay.expires-after=3d` labels on PR images for auto-cleanup
- Version-pinned dependencies managed by Renovate with custom regex managers
- 7-day cooldown on Renovate updates (supply chain protection)
- Entrypoint script with credential setup
- Non-root user (`agent-ci` uid 1000)

**Weaknesses:**
- No vulnerability scanning (Trivy, Snyk, Grype)
- No SBOM generation
- No image signing (Cosign)
- Single architecture only (x86_64) -- no arm64 builds
- No `.dockerignore` / `.containerignore` is present but not reviewed for completeness

### Security

**Strengths:**
- Dependabot for GitHub Actions with 3-day cooldown and security exemption
- Renovate for container dependency versions with 7-day minimum release age
- SHA256 checksum verification for all binary downloads in Containerfiles
- Action versions pinned to SHA hashes (not tags)
- `persist-credentials: false` in all checkout steps
- Gitleaks installed in CI images (but not run as a workflow)
- PR images auto-expire after 3 days
- Fork PR guard on E2E tests (no secrets exposed)
- Non-root container user

**Weaknesses:**
- No SAST workflow (CodeQL, Bandit, Semgrep)
- No container vulnerability scanning workflow
- Gitleaks is installed in CI images but no gitleaks scanning workflow in the repo itself
- No SBOM generation or image attestation
- No secret scanning in CI pipeline

### Agent Rules (Agentic Flow Quality)

**Strengths:**
- Comprehensive `AGENTS.md` with full architecture documentation, module-by-module descriptions, container image build instructions, CLI commands, verification checklist, and debugging guide
- 4 Claude Code skills:
  - `debug-agentic-ci`: Structured debugging with symptom catalog and RCA template
  - `release-agentic-ci`: Automated release flow with cron-based approval waiting
  - `test-e2e-podman`: Detailed E2E test guide for podman backend
  - `test-e2e-openshell`: Detailed E2E test guide for openshell backend
- Skill descriptions are detailed with exact commands, verification steps, and expected outputs
- Debugging skill references a symptoms catalog for pattern matching
- Mergify maintenance notes linked to workflow job names

**Weaknesses:**
- No `.claude/rules/` directory for test creation patterns
- No unit test writing rules (naming conventions, mocking standards, fixture patterns)
- No E2E test writing rules (bash test structure, assertion patterns)
- Skills are primarily operational (debug, release, test-run) rather than development-guiding (write tests, add features)

## Recommendations

### Priority 0 (Critical)

1. **Add pytest-cov and Codecov integration** -- The project has excellent test coverage by file count/LOC, but cannot prove or enforce it. Adding `pytest-cov` to tox and uploading to Codecov with a PR check takes 2-4 hours and immediately adds enforcement.

2. **Add Trivy scanning to image build pipelines** -- 6 container images ship without any vulnerability scanning. Adding Trivy as a step in `images.yml` and `images-pr.yml` takes 1-2 hours and catches known CVEs before deployment.

### Priority 1 (High Value)

3. **Add SAST scanning** -- The codebase handles credentials, subprocess execution, and network policies. Adding Bandit or CodeQL catches injection and insecure patterns automatically.

4. **Create `.claude/rules/` for test patterns** -- The project has strong testing conventions (pytest, unittest.mock, consistent naming) that should be codified as agent rules so AI-generated tests match the project style. Use `/test-rules-generator` to bootstrap.

5. **Add multi-architecture image builds** -- Only x86_64 is currently built. Adding arm64 builds supports broader deployment scenarios (Apple Silicon dev, ARM cloud instances).

### Priority 2 (Nice-to-Have)

6. **Add pre-commit hooks** -- A `.pre-commit-config.yaml` with ruff check + ruff format catches issues before they reach CI.

7. **Add SBOM generation** -- Use Syft to generate SBOM for each container image. Pairs well with Trivy for a complete supply chain security posture.

8. **Add Cosign image signing** -- Sign container images to enable verification at deployment time.

9. **Expand ruff rules** -- Add UP (pyupgrade), SIM (simplify), PTH (pathlib), RUF (ruff-specific) rules for broader code quality enforcement.

10. **Add tox/pip caching to CI** -- Cache `.tox` and pip wheels in the ci.yml workflow to speed up builds.

## Comparison to Gold Standards

| Practice | agentic-ci | odh-dashboard | notebooks | kserve |
|----------|-----------|---------------|-----------|--------|
| Unit test ratio | 0.91 (excellent) | ~0.8 | N/A | ~0.7 |
| Multi-Python testing | py310-py314 | N/A (TS) | N/A | N/A (Go) |
| E2E automation | Automated in CI | Automated | Automated | Automated |
| Coverage tracking | None | Codecov | Limited | Codecov |
| Coverage enforcement | None | PR checks | None | Thresholds |
| Container scanning | None | None | Trivy | None |
| SAST | None | ESLint security | None | gosec |
| Pre-commit hooks | None | Husky | None | Yes |
| Dependency updates | Dependabot + Renovate | Dependabot | None | Dependabot |
| Merge queue | Mergify | Prow | Prow | Prow |
| Agent rules | AGENTS.md + 4 skills | CLAUDE.md + rules | None | None |
| Image signing | None | None | None | Cosign |

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yml` -- Python tests, lint, format, typecheck
- `.github/workflows/images-pr.yml` -- PR-time image lint and tests
- `.github/workflows/images.yml` -- Image builds, E2E tests, push
- `.github/workflows/publish.yml` -- PyPI publishing
- `.github/workflows/docs.yml` -- MkDocs build and deploy
- `.github/dependabot.yml` -- GitHub Actions version updates
- `renovate.json` -- Container dependency version updates
- `.mergify.yml` -- Merge protection rules and merge queue

### Testing
- `tests/test_*.py` -- 28 unit test files (636 test functions)
- `tests/e2e/e2e-claude-runner.sh` -- Claude runner E2E tests
- `tests/e2e/e2e-opencode-runner.sh` -- OpenCode runner E2E tests
- `tests/e2e/e2e-openshell-sandbox.sh` -- OpenShell sandbox E2E tests
- `tests/images/test_entrypoint.sh` -- Entrypoint shell script tests
- `tox.ini` -- Test orchestration

### Code Quality
- `pyproject.toml` -- ruff config, mypy config, project metadata
- `tox.ini` -- lint, format, typecheck envs

### Container Images
- `images/runner/shared/Containerfile.base` -- Runner base image
- `images/runner/shared/Containerfile.openshell-base` -- Sandbox base image
- `images/runner/claude-code/Containerfile` -- Claude runner
- `images/runner/opencode/Containerfile` -- OpenCode runner
- `images/ci/Containerfile.podman` -- CI podman image
- `images/ci/Containerfile.openshell` -- CI OpenShell image

### Agent Rules
- `AGENTS.md` -- Root architecture documentation (also used as CLAUDE.md)
- `.claude/skills/debug-agentic-ci/SKILL.md` -- Debugging skill
- `.claude/skills/release-agentic-ci/SKILL.md` -- Release automation skill
- `.claude/skills/test-e2e-podman/SKILL.md` -- E2E podman test guide
- `.claude/skills/test-e2e-openshell/SKILL.md` -- E2E openshell test guide
