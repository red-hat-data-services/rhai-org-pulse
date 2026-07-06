---
repository: "opendatahub-io/lm-evaluation-harness"
overall_score: 4.5
scorecard:
  - dimension: "Unit Tests"
    score: 6.0
    status: "29 test files with 1197 assertions covering core evaluator, tasks, metrics, and models; good parametrization but no coverage enforcement"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "No dedicated integration or E2E test suites; evaluator tests serve as coarse integration checks but lack model backend and pipeline-level validation"
  - dimension: "Build Integration"
    score: 1.0
    status: "No container builds, no Konflux/Tekton, no PR-time image validation; purely a Python library CI"
  - dimension: "Image Testing"
    score: 0.0
    status: "No Dockerfiles, no container images, no image testing of any kind"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "pytest-cov listed as dev dependency but never invoked in CI; no codecov, no thresholds, no PR reporting"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "3 workflows covering linting, CPU unit tests, and PyPI publish; multi-Python matrix but no concurrency control, no E2E, and external model tests commented out"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No .claude/ directory, no CLAUDE.md, no agent rules or test automation guidance"
critical_gaps:
  - title: "No code coverage tracking or enforcement"
    impact: "Cannot measure test coverage trends; regressions in coverage go undetected; no PR-level feedback on untested code"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container image build or testing"
    impact: "ODH downstream relies on container images but this repo has zero Dockerfiles — image build failures discovered only at downstream integration"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No security scanning (SAST, dependency, container)"
    impact: "Vulnerabilities in 50+ dependencies (PyTorch, transformers, datasets) go undetected until downstream scans catch them"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "External model tests commented out in CI"
    impact: "Model backend integrations (API, vLLM, GGUF) not validated on PRs — regressions only caught by manual testing"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No integration or E2E test infrastructure"
    impact: "Full evaluation pipeline (model load → task select → inference → scoring → output) never tested end-to-end in CI"
    severity: "MEDIUM"
    effort: "12-20 hours"
  - title: "No Konflux/Tekton pipeline for ODH builds"
    impact: "As an ODH component, missing Konflux integration means build/test gaps between upstream CI and downstream product builds"
    severity: "MEDIUM"
    effort: "8-16 hours"
quick_wins:
  - title: "Enable pytest-cov in CI and add codecov integration"
    effort: "2-3 hours"
    impact: "Immediate visibility into test coverage with PR-level reporting and trend tracking"
  - title: "Add Dependabot for dependency scanning"
    effort: "30 minutes"
    impact: "Automated alerts for vulnerable dependencies across 50+ packages"
  - title: "Add concurrency control to PR workflows"
    effort: "15 minutes"
    impact: "Cancel redundant workflow runs on force-pushes, saving CI minutes"
  - title: "Un-comment and fix external model tests"
    effort: "2-4 hours"
    impact: "Restore model backend validation in CI; catch API/vLLM/HF integration regressions"
  - title: "Add CodeQL or Bandit security scanning workflow"
    effort: "1-2 hours"
    impact: "Detect Python security issues (SQL injection via sqlite, unsafe deserialization, etc.)"
recommendations:
  priority_0:
    - "Enable pytest-cov in CI with --cov=lm_eval --cov-report=xml and integrate codecov with a minimum threshold (e.g., 60%)"
    - "Add security scanning: CodeQL for SAST, Dependabot for dependency vulnerabilities, Bandit via ruff's S rules (already partially configured)"
    - "Un-comment external model tests (testmodels job) and fix to run with CPU-only backends"
  priority_1:
    - "Create a Dockerfile for the evaluation harness and add PR-time image build validation"
    - "Add integration tests that exercise full evaluation pipelines (model→task→score) with mock/dummy models"
    - "Add Konflux/Tekton pipeline configuration for ODH downstream builds"
    - "Create .claude/rules/ with test creation guidelines for unit, integration, and model backend tests"
  priority_2:
    - "Add mypy type checking (only 20.5% of functions have return type annotations)"
    - "Add performance regression testing for evaluation throughput"
    - "Add multi-architecture support testing for downstream container builds"
    - "Add pre-merge contract tests for task YAML schema validation"
---

# Quality Analysis: opendatahub-io/lm-evaluation-harness

## Executive Summary

- **Overall Score: 4.5/10**
- **Repository Type**: Python library — LLM evaluation framework (fork of EleutherAI/lm-evaluation-harness)
- **Primary Language**: Python (775 files, ~97K lines)
- **Framework**: Standalone CLI/library with HuggingFace, vLLM, OpenAI, and other model backends
- **Agent Rules Status**: Missing — no `.claude/` directory, no `CLAUDE.md`

**Key Strengths:**
- Solid pre-commit configuration with ruff linting, codespell, pymarkdown, and security rules (flake8-bandit)
- Multi-Python version testing matrix (3.10, 3.11, 3.12) in CI
- Good test parametrization and meaningful assertion coverage (1,197 assertions across 29 test files)
- Smart task-change detection workflow that runs targeted tests when task YAMLs are modified
- Well-structured conftest.py with reusable fixtures

**Critical Gaps:**
- Zero code coverage tracking despite pytest-cov being listed as a dependency
- No container images, Dockerfiles, or image testing
- No security scanning (no CodeQL, no Trivy, no Dependabot)
- External model integration tests are commented out in CI
- No integration or E2E test suites
- No agent rules or AI-assisted development guidance

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.0/10 | 29 test files, 1,197 assertions, good parametrization but gaps in model backend coverage |
| Integration/E2E | 3.0/10 | No dedicated suites; evaluator tests serve as coarse integration checks only |
| **Build Integration** | **1.0/10** | **No container builds, no Konflux/Tekton, purely library CI** |
| Image Testing | 0.0/10 | No Dockerfiles, no container images exist in this repo |
| Coverage Tracking | 2.0/10 | pytest-cov in deps but never invoked; no codecov, no thresholds |
| CI/CD Automation | 5.0/10 | 3 workflows with multi-Python matrix, but model tests commented out, no concurrency control |
| Agent Rules | 0.0/10 | No .claude/ directory, no CLAUDE.md, no test automation guidance |

## Critical Gaps

### 1. No Code Coverage Tracking or Enforcement
- **Impact**: Cannot measure test coverage trends; regressions go undetected; no PR-level feedback
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Evidence**: `pytest-cov` is listed in `pyproject.toml` dev dependencies but the CI pytest command (`pytest -x --showlocals -s -vv -n=auto`) never uses `--cov`. No `.codecov.yml`, no `.coveragerc`, no coverage config in `pyproject.toml`.
- **Fix**: Add `--cov=lm_eval --cov-report=xml` to pytest command, add codecov GitHub Action step, create `.codecov.yml` with thresholds.

### 2. No Container Image Build or Testing
- **Impact**: ODH downstream relies on container images but this repo has zero Dockerfiles
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Evidence**: `find . -name "Dockerfile*" -o -name "Containerfile*"` returns empty. No `.tekton/` directory. No image build workflows.
- **Note**: As an OpenDataHub component, this creates a gap between upstream CI and downstream product builds.

### 3. No Security Scanning
- **Impact**: 50+ dependencies (PyTorch, transformers, datasets, aiohttp) go unscanned for vulnerabilities
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Evidence**: `grep -r "trivy\|snyk\|codeql\|gitleaks\|semgrep\|bandit\|safety" .github/` returns nothing. No Dependabot config. No security workflow.
- **Partial mitigation**: Ruff is configured with `S` (flake8-bandit) rules, which provides some static security analysis, but this only covers Python source code, not dependencies.

### 4. External Model Tests Commented Out
- **Impact**: Model backend integrations (API models, vLLM, GGUF, OpenVINO) not validated in CI
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Evidence**: The entire `testmodels` job in `.github/workflows/unit_tests.yml` (lines 92-124) is commented out. Additionally, `test_vllm.py` has `pytestmark = pytest.mark.skip(reason="requires vLLM, not available in CI")` and several tests use `pytest.mark.skip(reason="requires CUDA")`.
- **Impact scope**: Model backends are the core value of this library. Without CI validation, regressions in model integration code go undetected.

### 5. No Integration or E2E Test Infrastructure
- **Impact**: Full evaluation pipeline never tested end-to-end in CI
- **Severity**: MEDIUM
- **Effort**: 12-20 hours
- **Evidence**: No `integration/`, `e2e/`, or `functional/` test directories. The `test_evaluator.py` runs `simple_evaluate()` with a tiny model but this is a narrow parametric test, not a comprehensive pipeline test.

### 6. No Konflux/Tekton Pipeline
- **Impact**: Missing ODH build integration
- **Severity**: MEDIUM
- **Effort**: 8-16 hours
- **Evidence**: No `.tekton/` directory. Only `main` branch exists (no `incubation` or `stable` branches in the shallow clone, though `.mergify.yml` references `incubation→stable` backport rules).

## Quick Wins

### 1. Enable pytest-cov in CI (2-3 hours)
Add coverage tracking to the existing CI workflow:

```yaml
# In .github/workflows/unit_tests.yml, modify the pytest command:
- name: Test with pytest
  run: pytest -x --showlocals -s -vv -n=auto --cov=lm_eval --cov-report=xml --ignore=tests/models/test_openvino.py --ignore=tests/models/test_hf_steered.py --ignore=tests/scripts/test_zeno_visualize.py

- name: Upload coverage
  if: matrix.python-version == '3.12'
  uses: codecov/codecov-action@v5
  with:
    files: ./coverage.xml
    fail_ci_if_error: false
```

### 2. Add Dependabot (30 minutes)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 3. Add Concurrency Control (15 minutes)
Add to each workflow:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

### 4. Add CodeQL Security Scanning (1-2 hours)
Create `.github/workflows/codeql.yml`:
```yaml
name: CodeQL
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'
jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v6
      - uses: github/codeql-action/init@v3
        with:
          languages: python
      - uses: github/codeql-action/analyze@v3
```

## Detailed Findings

### CI/CD Pipeline

**Workflows (3 total):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `unit_tests.yml` | PR to `main`, push to `main` | Linting (pre-commit/ruff) + CPU unit tests across Python 3.10/3.11/3.12 |
| `new_tasks.yml` | PR to `main`/`release-*`, push to `main` | Targeted tests when task YAMLs or API code changes |
| `publish.yml` | Tag push | Build and publish to PyPI/TestPyPI |

**Strengths:**
- Multi-Python version matrix (3.10, 3.11, 3.12)
- HuggingFace cache (`~/.cache/huggingface`) is cached across runs
- Uses `uv` for fast dependency installation with cache enabled
- Smart change detection (`tj-actions/changed-files`) for task-specific tests
- Pre-commit runs with `--from-ref`/`--to-ref` for incremental linting
- Artifact upload on test failure for debugging

**Weaknesses:**
- No concurrency control (redundant runs on force-push)
- External model test job (`testmodels`) is entirely commented out
- No E2E test job
- No coverage reporting step
- No security scanning job
- No image build job
- 120-minute timeout on `new_tasks.yml` is excessive for most changes

### Test Coverage

**Test inventory (29 test files, ~10,312 lines):**

| Category | Files | Key Tests |
|----------|-------|-----------|
| Core evaluator | 3 | `test_evaluator.py`, `test_evaluator_utils.py`, `test_aggregation_pipeline.py` |
| Task system | 5 | `test_tasks.py`, `test_task_manager.py`, `test_group.py`, `test_registry.py`, `test_unitxt_tasks.py` |
| Metrics/Utils | 4 | `test_metrics.py`, `test_utils.py`, `test_misc.py`, `test_samplers.py` |
| Model backends | 11 | `test_huggingface.py`, `test_vllm.py`, `test_api.py`, `test_sglang.py`, etc. |
| Other | 6 | `test_cli_subcommands.py`, `test_fewshot_context.py`, `test_prompt.py`, etc. |

**Test-to-source ratio:** 29 test files / 72 source files = 0.40 (40% coverage by file count)
**Assertion density:** 1,197 assertions across ~10K test lines = ~0.12 assertions/line

**Coverage gaps:**
- Model backend tests are largely skipped in CI (vLLM, CUDA-dependent, OpenVINO, steered models)
- No tests for `lm_eval/config/` module
- No tests for `lm_eval/loggers/` module
- No tests for `lm_eval/decontamination/` module
- No tests for `lm_eval/caching/` module (only `test_requests_caching.py` for a specific feature)

### Code Quality

**Ruff Configuration (Strong):**
- Uses `preview = true` for latest rules
- Extensive rule selection: bugbear (B), pydocstyle (D), pycodestyle (E), pyflakes (F), refurb (FURB), isort (I), type-checking (TC), flake8-bandit (S), simplify (SIM), pyupgrade (UP)
- Google-style docstring convention enforced
- Import sorting with known first-party packages
- Autofix enabled for many rule categories

**Pre-commit Configuration (Good):**
- 4 hook repos configured: pre-commit-hooks (13 hooks), ruff (lint + format), codespell, pymarkdown
- Private key detection enabled
- YAML and JSON validation
- Markdown linting with pymarkdown
- Test data excluded from linting

**Type Annotations (Weak):**
- Only 759/3,692 functions have return type annotations (20.5%)
- No mypy configuration or CI enforcement
- No `py.typed` marker file

### Container Images

**Status: Not Applicable / Critical Gap**

This repository contains no Dockerfiles, Containerfiles, or container build configuration. As a fork maintained under the OpenDataHub organization, container images are likely built downstream (possibly in a separate repo or by Konflux). This creates a significant gap:
- No way to validate container builds on PRs
- Build failures discovered only at downstream integration
- No image startup validation or runtime testing

### Security

**Status: Minimal**

- **SAST**: Ruff's `S` (flake8-bandit) rules provide basic static security analysis for Python code. No CodeQL, no Semgrep.
- **Dependency scanning**: None. No Dependabot, no Snyk, no `pip-audit`.
- **Container scanning**: N/A (no containers).
- **Secret detection**: `detect-private-key` pre-commit hook provides minimal coverage. No Gitleaks or TruffleHog.
- **Supply chain**: No SBOM generation, no image signing, no provenance attestation.

**Risk areas**: The project has 50+ dependencies including PyTorch, transformers, datasets, and aiohttp — all high-value targets. The `eval()` usage for metric computation is a known risk surface.

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: Everything — no test creation guidelines, no coding standards for agents, no test patterns documented for AI-assisted development
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - Unit test patterns for model backends (mock vs. real model)
  - Task YAML validation test patterns
  - Evaluator integration test patterns
  - Fixture and conftest usage guidelines

## Recommendations

### Priority 0 (Critical)

1. **Enable pytest-cov in CI with codecov integration** — pytest-cov is already a dev dependency; adding `--cov=lm_eval --cov-report=xml` to the test command and a codecov upload step gives immediate coverage visibility. Set an initial threshold at 50% and ratchet up.

2. **Add security scanning** — Create a CodeQL workflow for Python SAST. Add Dependabot for dependency vulnerability alerts. These are zero-code-change improvements that protect against known CVEs in the large dependency tree.

3. **Restore external model tests** — Un-comment the `testmodels` job in `unit_tests.yml`. Modify to use CPU-only backends with small models. Model backend integration is the core value of this library and must be validated in CI.

### Priority 1 (High Value)

4. **Create Dockerfile and PR-time image build** — Add a Dockerfile that packages the evaluation harness for ODH deployment. Add a CI step that builds the image on PRs to catch build regressions.

5. **Add integration test suite** — Create `tests/integration/` with tests that exercise full evaluation pipelines using dummy/mock models. Validate model→task→inference→scoring→output flow.

6. **Add Konflux/Tekton pipeline** — As an ODH component, add `.tekton/` configuration for downstream product builds. Align with ODH build practices.

7. **Create agent rules** — Generate `.claude/rules/` with test creation guidelines covering unit, integration, and model backend test patterns. Include examples from existing test files.

### Priority 2 (Nice-to-Have)

8. **Add mypy type checking** — Only 20.5% of functions have return type annotations. Add `mypy` to CI (start with `--ignore-missing-imports`) and gradually increase strictness.

9. **Add performance regression testing** — Benchmark evaluation throughput for key task/model combinations and flag regressions.

10. **Add contract tests for task YAML schema** — Validate that all task YAML files conform to the expected schema before merge.

11. **Add Dependabot for GitHub Actions** — Keep action versions current (several are already on latest but automated updates prevent drift).

## Comparison to Gold Standards

| Capability | lm-evaluation-harness | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|------------|----------------------|---------------------|-------------------|---------------|
| Unit test coverage | 40% file ratio, no enforcement | 80%+ with enforcement | Comprehensive | 80%+ enforced |
| Integration tests | None | Contract + integration | Multi-layer | Envtest + integration |
| E2E tests | None | Cypress + API tests | Runtime validation | KServe predict |
| Coverage tracking | Dep exists, not used | Codecov with thresholds | Per-notebook | Codecov enforced |
| Image testing | No images | Multi-stage builds | 5-layer validation | Build + test |
| Security scanning | Ruff bandit rules only | CodeQL + Trivy + Snyk | Trivy + signing | CodeQL + Trivy |
| CI/CD maturity | 3 workflows, basic | 10+ workflows, comprehensive | Periodic + PR | Full matrix |
| Agent rules | None | Comprehensive .claude/rules/ | N/A | N/A |
| Pre-commit | Strong (ruff + codespell) | Strong | Good | Good |
| Concurrency control | None | Yes | Yes | Yes |

## File Paths Reference

| File | Purpose |
|------|---------|
| `.github/workflows/unit_tests.yml` | Main CI: linting + CPU tests |
| `.github/workflows/new_tasks.yml` | Task change detection + targeted tests |
| `.github/workflows/publish.yml` | PyPI publication on tags |
| `.pre-commit-config.yaml` | Pre-commit hooks (ruff, codespell, pymarkdown) |
| `pyproject.toml` | Project config, dependencies, ruff/pytest config |
| `.mergify.yml` | Auto-backport incubation→stable |
| `OWNERS` | ODH maintainer list |
| `CODEOWNERS` | GitHub code owners |
| `tests/conftest.py` | Shared test fixtures |
| `tests/test_evaluator.py` | Core evaluator integration tests |
| `tests/test_tasks.py` | Task loading and validation tests |
| `tests/models/` | Model backend test files (many skipped in CI) |
