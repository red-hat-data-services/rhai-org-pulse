---
repository: "opendatahub-io/lm-evaluation-harness"
overall_score: 5.1
scorecard:
  - dimension: "Unit Tests"
    score: 6.5
    status: "Good test coverage for core modules (evaluator, metrics, CLI, models) but low test-to-code ratio for a 23K+ LOC codebase"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "No E2E tests, no integration test suite, no container-level testing; incubation branch has ODH adapter tests but no end-to-end pipeline validation"
  - dimension: "Build Integration"
    score: 3.5
    status: "No PR-time Dockerfile validation on main; Konflux pipeline exists on incubation but only runs on push, no PR-time build simulation"
  - dimension: "Image Testing"
    score: 2.5
    status: "No image startup validation, no runtime testing, no vulnerability scanning; 234-line multi-arch Dockerfile with no build tests"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "No codecov integration, no coverage thresholds, no PR coverage reporting; .coveragerc exists on incubation but is not wired into CI"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "Decent PR workflow with linting + multi-Python tests and caching; but linter disabled on incubation, no concurrency control, commented-out model tests"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules or test automation guidance"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Cannot detect coverage regressions; test blind spots grow silently over time"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container image testing or scanning"
    impact: "234-line multi-arch Dockerfile ships without startup validation or vulnerability scanning; issues found only in production"
    severity: "HIGH"
    effort: "6-10 hours"
  - title: "No E2E or integration test pipeline"
    impact: "EvalHub adapter (main.py) has no pipeline-level testing; evaluator + model + task interactions untested end-to-end"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "Linter disabled on incubation branch"
    impact: "Code quality enforcement bypassed on the primary productization branch; code style drift between upstream and ODH fork"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "Main and incubation branches significantly diverged"
    impact: "Main tracks upstream (EleutherAI) with modern tooling (uv, ruff); incubation uses older tooling (pip, flake8) with separate dependencies; merge conflicts and drift are inevitable"
    severity: "MEDIUM"
    effort: "8-16 hours"
quick_wins:
  - title: "Add codecov integration to CI"
    effort: "2-4 hours"
    impact: "Visibility into test coverage with PR annotations and trend tracking"
  - title: "Re-enable linter job on incubation branch"
    effort: "1-2 hours"
    impact: "Restore code quality enforcement on the primary productization branch"
  - title: "Add Trivy scanning to Konflux pipeline"
    effort: "2-3 hours"
    impact: "Detect vulnerabilities in the multi-arch container image before release"
  - title: "Add concurrency control to workflows"
    effort: "30 minutes"
    impact: "Cancel stale PR runs to save CI resources"
  - title: "Create basic CLAUDE.md with test patterns"
    effort: "2-3 hours"
    impact: "Enable AI-assisted test generation following project conventions"
recommendations:
  priority_0:
    - "Add pytest-cov to CI and integrate codecov with minimum coverage threshold (60% initially)"
    - "Add container image vulnerability scanning (Trivy) to Konflux pipeline and optionally to GitHub Actions"
    - "Re-enable the linter job on the incubation branch CI workflow"
  priority_1:
    - "Create E2E test for the EvalHub adapter (main.py) that validates the full evaluation pipeline"
    - "Add Dockerfile build validation to PR workflow to catch build breaks before merge"
    - "Add image startup/smoke test that verifies the container runs and can import lm_eval"
    - "Harmonize tooling between main and incubation branches (adopt ruff + uv on incubation)"
  priority_2:
    - "Create CLAUDE.md and .claude/rules/ with test automation guidance"
    - "Add SBOM generation to container build pipeline"
    - "Add CodeQL or Semgrep SAST scanning"
    - "Enable mypy type checking in CI (currently ignored everywhere)"
---

# Quality Analysis: lm-evaluation-harness (opendatahub-io fork)

## Executive Summary

- **Overall Score: 5.1/10**
- **Repository Type**: Python library / CLI tool — LLM evaluation framework (fork of EleutherAI/lm-evaluation-harness)
- **Primary Language**: Python (775 .py files, ~24K+ LOC source, ~10K LOC tests)
- **Key Strengths**: Solid upstream test suite with 29 test files, multi-Python version CI matrix, comprehensive pre-commit hooks with ruff, codespell, and pymarkdown; ODH-specific tests for error sanitization and security (path traversal, secret redaction)
- **Critical Gaps**: Zero coverage tracking, no container image testing or scanning, no E2E pipeline tests, linter disabled on incubation branch, significant tooling divergence between main and incubation
- **Agent Rules Status**: Missing — no CLAUDE.md, .claude/ directory, or agent rules

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.5/10 | Good test files for core modules; test-to-code ratio ~0.42 (29 test files / 72 core source files) |
| Integration/E2E | 3.0/10 | No E2E tests; incubation has 3 ODH adapter tests but no pipeline-level validation |
| **Build Integration** | **3.5/10** | **No PR-time Dockerfile build; Konflux pipeline only triggers on push to incubation** |
| Image Testing | 2.5/10 | No startup validation, no runtime tests, no vulnerability scanning for 234-line multi-arch Dockerfile |
| Coverage Tracking | 2.0/10 | No codecov, no thresholds, no PR reporting; .coveragerc exists on incubation but unused in CI |
| CI/CD Automation | 6.0/10 | Multi-Python matrix, uv caching, pre-commit in CI; but linter disabled on incubation, no concurrency |
| Agent Rules | 0.0/10 | No CLAUDE.md, no .claude/ directory, no test automation guidance |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: Cannot detect coverage regressions; blind spots grow silently
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: `pytest-cov` is listed as a dev dependency but never invoked in CI. The `incubation` branch has a `.coveragerc` with exclusion rules but it is not wired into any workflow. No codecov.yml or coveralls integration exists on either branch.

### 2. No Container Image Testing or Scanning
- **Impact**: 234-line multi-arch Dockerfile (`Dockerfile.lmes-job`) ships without startup validation, runtime testing, or vulnerability scanning
- **Severity**: HIGH
- **Effort**: 6-10 hours
- **Details**: The Dockerfile supports x86_64, s390x, and ppc64le with complex multi-stage builds (5 stages: builder, arrow-builder, openblas-builder, torch-builder, final). No test verifies the image starts, imports lm_eval, or passes security scanning. No Trivy, Snyk, or Grype integration exists.

### 3. No E2E or Integration Test Pipeline
- **Impact**: The EvalHub adapter (`main.py` on incubation) has ~500+ lines of custom integration logic with no end-to-end test covering the full flow
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: Unit tests exist for isolated functions (offline inference detection, error sanitization, job spec path validation) but no test exercises the complete pipeline: read job spec → configure lm_eval → run evaluation → report results. The `testmodels` CI job is commented out on main and disabled (`if: false`) on incubation.

### 4. Linter Disabled on Incubation Branch
- **Impact**: Code quality enforcement bypassed on the primary productization branch
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: The incubation branch CI workflow has `if: false` on the linter job. The pre-commit config on incubation still uses flake8 while main uses ruff. This means code committed to incubation bypasses style checks entirely.

### 5. Main and Incubation Branch Divergence
- **Impact**: Merge conflicts, tooling inconsistencies, and maintenance burden
- **Severity**: MEDIUM
- **Effort**: 8-16 hours (ongoing)
- **Details**: 
  - **Main branch**: Modern tooling (uv, ruff, setuptools>=64), Python 3.10+, multi-Python CI matrix (3.10, 3.11, 3.12)
  - **Incubation branch**: Legacy tooling (pip, flake8, mypy, poetry.lock, setuptools==70.0.0), pinned Python 3.11 only, additional files (main.py, metrics/, patches/)
  - Mergify auto-backports from incubation → stable but upstream sync (`pull.yml`) goes EleutherAI:main → main

## Quick Wins

### 1. Add Codecov Integration to CI (2-4 hours)
- Add `--cov=lm_eval --cov-report=xml` to pytest invocation
- Upload coverage report as artifact
- Add codecov GitHub App and `.codecov.yml` with threshold

### 2. Re-enable Linter on Incubation (1-2 hours)
- Remove `if: false` from the linter job in incubation's `unit_tests.yml`
- Upgrade pre-commit hooks to match main branch (ruff instead of flake8)

### 3. Add Trivy Scanning (2-3 hours)
- Add Trivy task to Konflux pipeline
- Or add `trivy image` step to a GitHub Actions workflow

### 4. Add Concurrency Control (30 minutes)
- Add `concurrency` block to workflows to cancel stale PR runs:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 5. Create Basic CLAUDE.md (2-3 hours)
- Document test patterns, pytest fixtures, and project conventions
- Add `.claude/rules/unit-tests.md` with guidance for AI-assisted test generation

## Detailed Findings

### CI/CD Pipeline

**Main Branch (3 workflows):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `unit_tests.yml` | PR + push to main | Linting (pre-commit/ruff) + CPU tests (Python 3.10, 3.11, 3.12) |
| `new_tasks.yml` | PR + push to main | Detects task file changes, runs task-specific tests |
| `publish.yml` | Tag push | Builds and publishes to PyPI + TestPyPI |

**Incubation Branch (4 workflows):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `unit_tests.yml` | PR + push to incubation/stable | CPU tests (Python 3.11 only), **linter disabled** |
| `new_tasks.yml` | PR + push | Task change detection |
| `publish.yml` | Tag push | PyPI publish |
| `sync-branch-stable.yaml` | Push to incubation | Auto-creates PR to sync incubation → stable |

**Strengths:**
- Modern uv + caching on main branch
- HuggingFace cache layer (`actions/cache@v5`) reduces model download time
- Artifact upload preserves test logs even on failure
- Mergify auto-backport for branch synchronization

**Weaknesses:**
- No concurrency control on any workflow
- Linter disabled on incubation (the productization branch)
- `testmodels` job commented out/disabled on both branches
- No PR-time Dockerfile build validation
- Single Python version on incubation vs. 3 on main

### Test Coverage

**Test Files (main branch): 29 test files, ~10,312 LOC**

| Category | Files | LOC | Key Tests |
|----------|-------|-----|-----------|
| Core evaluator | 2 | ~330 | `test_evaluator.py`, `test_evaluator_utils.py` |
| CLI | 1 | ~953 | `test_cli_subcommands.py` (comprehensive) |
| Metrics | 1 | ~223 | `test_metrics.py` |
| Utils | 1 | ~713 | `test_utils.py` |
| Prompt/fewshot | 2 | ~1,029 | `test_prompt.py`, `test_fewshot_context.py` |
| Task management | 3 | ~505 | `test_tasks.py`, `test_task_manager.py`, `test_registry.py` |
| Models | 11 | ~2,500+ | HF, vLLM, GGUF, SGLang, OpenVINO, API, etc. |
| Samplers/misc | 4 | ~700+ | `test_samplers.py`, `test_misc.py`, `test_janitor.py`, etc. |

**Test-to-code ratio**: ~0.44 (10,312 test LOC / 23,445 core source LOC)

**Additional tests on incubation branch (not on main):**
- `test_adapter_offline_inference.py` — HF offline auto-detection
- `test_evalhub_error_sanitize.py` — Secret redaction in error messages
- `test_job_spec_parameters_path.py` — Path traversal protection (CWE-22)

**Strengths:**
- Comprehensive model backend testing (11 model test files)
- Good fixture usage via `conftest.py` with `mock_configurable_task`, `fewshot_config`, `task_config`
- Parametrized tests for evaluator
- pytest-xdist for parallel test execution
- ODH-specific security tests (error sanitization, path validation)

**Weaknesses:**
- No coverage measurement in CI
- No coverage thresholds or enforcement
- Many source modules have no corresponding test file (filters, loggers, caching, decontamination, config)
- `testmodels` integration job disabled on both branches

### Code Quality

**Main Branch:**
- **Ruff**: Comprehensive configuration in `pyproject.toml` with ~15 rule categories (bugbear, isort, bandit, docstyle, pyupgrade, simplify, etc.)
- **Pre-commit**: 5 repos configured:
  - `pre-commit-hooks` (14 hooks: large files, AST, JSON, YAML, merge conflict, private key detection, etc.)
  - `ruff-pre-commit` (lint + format)
  - `codespell` (spell checking, excludes JSON/YAML/tasks)
  - `pymarkdown` (markdown linting)
- **CI enforcement**: Pre-commit runs on changed files only (efficient)

**Incubation Branch:**
- **Flake8**: Basic config (`.flake8`) — much less comprehensive than ruff
- **Mypy**: Config exists (`mypy.ini`) but `ignore_errors = True` everywhere — effectively disabled
- **Pre-commit**: Linter CI job has `if: false` — not enforced

**Gaps:**
- No SAST scanning (CodeQL, Semgrep, gosec)
- No dependency scanning (Dependabot alerts may be enabled but no automated workflow)
- No secret detection in CI (detect-private-key is in pre-commit but only for committed keys)

### Container Images

**Dockerfile.lmes-job (incubation branch only, 234 lines):**

- **Multi-stage build**: 5 stages (builder, arrow-builder, openblas-builder, torch-builder, final)
- **Multi-architecture**: x86_64, s390x, ppc64le support with arch-conditional builds
- **Base image**: `registry.access.redhat.com/ubi9/python-311:latest` (good — UBI base)
- **Security**: Runs as non-root user (USER 65532:65532), copies license
- **Dependencies**: Pinned via `requirements.txt`, `pip install --no-deps`

**Gaps:**
- No image startup validation test
- No Trivy/Grype/Snyk vulnerability scanning
- No SBOM generation
- No image signing or attestation
- Build only tested on push to incubation, not on PRs

### Security

**Strengths:**
- Path traversal protection in `main.py` (`_JOB_SPEC_ALLOWED_ROOT` enforcement, CWE-22)
- Error message sanitization to prevent secret leakage (tokens, passwords, API keys redacted)
- Pre-commit `detect-private-key` hook
- UBI9 base image (Red Hat supported, security patches)
- Non-root container execution (USER 65532:65532)

**Gaps:**
- No SAST/CodeQL scanning
- No container image vulnerability scanning
- No dependency vulnerability scanning workflow
- No secret scanning in CI (only pre-commit hook)
- Mypy type checking disabled everywhere on incubation

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/` directory, `CLAUDE.md`, or `AGENTS.md`
- **Quality**: N/A
- **Gaps**: No test automation guidance for AI agents; no coding patterns, test conventions, or quality gates documented for agentic workflows
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator`

## Recommendations

### Priority 0 (Critical)

1. **Add pytest-cov to CI and integrate codecov** — `pytest-cov` is already a dev dependency; wire it into the CI workflow with `--cov=lm_eval --cov-report=xml` and add codecov integration with a minimum threshold (60% initially, increase over time)

2. **Add container image vulnerability scanning** — Integrate Trivy into the Konflux pipeline or add a GitHub Actions workflow that builds and scans the Dockerfile on PRs to incubation

3. **Re-enable the linter job on incubation** — Remove `if: false` from the linter job and upgrade to ruff to match main branch; this prevents code style drift between upstream and ODH fork

### Priority 1 (High Value)

4. **Create E2E test for the EvalHub adapter** — Test the complete pipeline: job spec → lm_eval configuration → evaluation run → result reporting; use a small model (pythia-14m) and simple task for CI

5. **Add Dockerfile build validation to PRs** — Add a workflow step that builds `Dockerfile.lmes-job` on PRs to incubation to catch build failures before merge

6. **Add container startup smoke test** — After building the image, verify it starts, can import `lm_eval`, and responds to basic commands

7. **Harmonize tooling between branches** — Adopt ruff + uv on incubation to reduce maintenance burden and enable consistent code quality enforcement

### Priority 2 (Nice-to-Have)

8. **Create CLAUDE.md and agent rules** — Document test patterns, fixtures, and conventions for AI-assisted development

9. **Add SBOM generation** — Use `syft` or Konflux built-in SBOM generation for supply chain transparency

10. **Add CodeQL or Semgrep** — Automated SAST scanning to catch security vulnerabilities in Python code

11. **Enable mypy type checking** — Gradually remove `ignore_errors = True` from `mypy.ini` and enforce type checking on new code

## Comparison to Gold Standards

| Dimension | lm-evaluation-harness | odh-dashboard | notebooks | kserve |
|-----------|----------------------|---------------|-----------|--------|
| Unit Tests | 6.5 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 3.0 | 9.0 | 6.0 | 8.5 |
| Build Integration | 3.5 | 7.0 | 8.0 | 7.0 |
| Image Testing | 2.5 | 6.0 | 9.0 | 7.0 |
| Coverage Tracking | 2.0 | 8.0 | 5.0 | 9.0 |
| CI/CD Automation | 6.0 | 9.0 | 8.0 | 8.5 |
| Agent Rules | 0.0 | 8.0 | 3.0 | 2.0 |
| **Overall** | **5.1** | **8.5** | **7.0** | **8.0** |

## Key Architectural Notes

This is a **fork** of [EleutherAI/lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) with ODH/RHOAI-specific customizations:

- **`main` branch**: Tracks upstream via `pull.yml` (auto-sync from `EleutherAI:main`), minimal ODH additions
- **`incubation` branch**: Primary productization branch with `main.py` (EvalHub adapter), `Dockerfile.lmes-job`, Konflux pipeline, `metrics/` directory, `patches/`
- **`stable` branch**: Auto-synced from incubation via Mergify backport and `sync-branch-stable.yaml`
- **Branch flow**: `EleutherAI:main` → `main` → manual merge → `incubation` → auto-sync → `stable`

The incubation branch contains significant ODH-specific code not present on main:
- `main.py` (~500+ LOC): EvalHub adapter with job spec parsing, offline inference, error sanitization
- `Dockerfile.lmes-job` (234 lines): Multi-arch container image
- `metrics/`: Custom metric implementations
- `.tekton/`: Konflux pipeline for container builds
- ODH-specific tests: `test_adapter_offline_inference.py`, `test_evalhub_error_sanitize.py`, `test_job_spec_parameters_path.py`

## File Paths Reference

### CI/CD
- `.github/workflows/unit_tests.yml` — Main test workflow
- `.github/workflows/new_tasks.yml` — Task change detection
- `.github/workflows/publish.yml` — PyPI publishing
- `.github/pull.yml` — Upstream sync config
- `.mergify.yml` — Backport rules (incubation → stable)

### Testing
- `tests/` — 29 test files, ~10K LOC
- `tests/conftest.py` — Shared fixtures
- `tests/models/` — 11 model backend test files
- `tests/testdata/` — Golden test data files
- `tests/testconfigs/` — Test configuration YAMLs

### Code Quality
- `pyproject.toml` — Ruff config (main), pytest config
- `.pre-commit-config.yaml` — Pre-commit hooks
- `.flake8` — Flake8 config (incubation only)
- `mypy.ini` — Mypy config (incubation only, all errors ignored)
- `.coveragerc` — Coverage config (incubation only, not wired to CI)

### Container Images
- `Dockerfile.lmes-job` — Multi-arch container (incubation only)
- `.dockerignore` — Docker ignore rules (incubation only)
- `.tekton/ta-lmes-job-release-push.yaml` — Konflux pipeline (incubation only)

### Project
- `OWNERS` — ODH reviewers/approvers
- `CODEOWNERS` — Upstream code owners
- `lm_eval/` — Source package (72 core Python files, ~23K LOC)
- `main.py` — EvalHub adapter (incubation only)
