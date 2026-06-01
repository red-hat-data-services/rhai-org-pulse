---
repository: "EleutherAI/lm-evaluation-harness"
overall_score: 5.8
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Solid pytest suite covering core evaluator, metrics, CLI, tasks, caching, and model backends"
  - dimension: "Integration/E2E"
    score: 5.0
    status: "Evaluator integration tests exist but GPU/model backend tests are commented out in CI"
  - dimension: "Build Integration"
    score: 3.0
    status: "No container builds, no image validation, no deployment testing in CI"
  - dimension: "Image Testing"
    score: 1.0
    status: "No Dockerfile, no container image builds, no runtime validation"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "pytest-cov in dev dependencies but no coverage enforcement, no codecov, no thresholds"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "PR-triggered linting + multi-Python unit tests + task change detection, but no GPU testing or coverage reporting"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory — zero AI agent guidance"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "No visibility into test coverage, regressions can silently reduce coverage"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container image or deployment testing"
    impact: "Library packaging issues not caught until PyPI publish; no containerized usage validation"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "GPU/model backend tests disabled in CI"
    impact: "Model backend regressions (vLLM, OpenVINO, GGUF, etc.) not caught until users report"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No security scanning (SAST, dependency, secret detection)"
    impact: "Vulnerabilities in dependencies or code not detected proactively"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents contributing to the repo have no guidance on test patterns, code style, or quality gates"
    severity: "LOW"
    effort: "4-6 hours"
quick_wins:
  - title: "Add codecov integration with coverage reporting"
    effort: "2-4 hours"
    impact: "Immediate visibility into test coverage with PR-level reporting and threshold enforcement"
  - title: "Enable GitHub Dependabot for dependency scanning"
    effort: "30 minutes"
    impact: "Automated security alerts and PRs for vulnerable dependencies"
  - title: "Add CodeQL or Bandit SAST scanning workflow"
    effort: "1-2 hours"
    impact: "Catch security issues in Python code (already using ruff with flake8-bandit rules, but no dedicated SAST)"
  - title: "Add --cov flag to pytest in CI workflow"
    effort: "30 minutes"
    impact: "Generate coverage reports in CI (pytest-cov already a dev dependency)"
recommendations:
  priority_0:
    - "Add coverage tracking: enable pytest --cov in CI, integrate codecov, set minimum threshold (e.g. 60%)"
    - "Re-enable GPU/model backend testing in CI with self-hosted GPU runners or conditional nightly jobs"
    - "Add dependency scanning via Dependabot or pip-audit"
  priority_1:
    - "Add CodeQL or dedicated SAST workflow for security analysis"
    - "Create a Dockerfile for containerized evaluation and test image builds in CI"
    - "Add mypy type checking to CI (currently skipped in pre-commit)"
  priority_2:
    - "Create comprehensive agent rules (.claude/rules/) for test automation guidance"
    - "Add performance regression testing for evaluation throughput"
    - "Add integration tests for new model backends (sglang, litellm) in CI"
---

# Quality Analysis: lm-evaluation-harness

## Executive Summary
- **Overall Score: 5.8/10**
- **Repository Type**: Python library (LLM evaluation framework)
- **Primary Language**: Python (88,480 lines of source, 10,690 lines of tests)
- **Framework**: pytest with xdist parallelization
- **Key Strengths**: Well-organized pre-commit hooks with ruff linting, comprehensive CLI test suite, smart task-change-triggered testing, multi-Python-version CI matrix
- **Critical Gaps**: No coverage tracking/enforcement, GPU tests disabled in CI, no security scanning, no container image support, no agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.0/10 | Solid pytest suite covering core evaluator, metrics, CLI, tasks, caching, and model backends |
| Integration/E2E | 5.0/10 | Evaluator integration tests exist but GPU/model backend tests are commented out in CI |
| Build Integration | 3.0/10 | No container builds, no image validation, no deployment testing in CI |
| Image Testing | 1.0/10 | No Dockerfile, no container image builds, no runtime validation |
| Coverage Tracking | 2.0/10 | pytest-cov in dev dependencies but no coverage enforcement, no codecov, no thresholds |
| CI/CD Automation | 6.0/10 | PR-triggered linting + multi-Python unit tests + task change detection, but no GPU testing or coverage reporting |
| Agent Rules | 0.0/10 | No CLAUDE.md, AGENTS.md, or .claude/ directory — zero AI agent guidance |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: No visibility into test coverage; regressions can silently reduce coverage. Test-to-code ratio is only 12.1% (10,690 test lines vs 88,480 source lines).
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: `pytest-cov` is listed as a dev dependency in `pyproject.toml`, but `--cov` is never used in the CI workflow (`unit_tests.yml`). No `.codecov.yml` or `.coveragerc` exists. No PR coverage gates.

### 2. GPU/Model Backend Tests Disabled in CI
- **Impact**: The `testmodels` job in `unit_tests.yml` (lines 92-124) is entirely commented out. Model backend tests for vLLM, OpenVINO, GGUF, sglang, litellm, and GPTQModel exist in `tests/models/` (12 test files) but only run locally. Two model test files (`test_openvino.py`, `test_hf_steered.py`) are explicitly `--ignore`d in the active test job.
- **Severity**: HIGH
- **Effort**: 16-24 hours (requires GPU runner infrastructure)

### 3. No Security Scanning
- **Impact**: No SAST (CodeQL, Semgrep), no dependency scanning (Dependabot, pip-audit), no secret detection (Gitleaks, TruffleHog). Ruff does enable `flake8-bandit` rules (`S` prefix) which catches some Python security issues, but this is not a substitute for dedicated security tooling.
- **Severity**: HIGH
- **Effort**: 2-4 hours

### 4. No Container/Image Testing
- **Impact**: No Dockerfile exists. For a widely-used library, container support enables reproducible evaluations. No image build validation means packaging issues are only caught at PyPI publish time.
- **Severity**: MEDIUM
- **Effort**: 8-12 hours

### 5. No Agent Rules
- **Impact**: No AI agent guidance for contributors. As the project grows, AI-assisted development has no guardrails for test patterns, code conventions, or quality gates.
- **Severity**: LOW
- **Effort**: 4-6 hours

## Quick Wins

### 1. Add `--cov` to pytest in CI (30 minutes)
```yaml
# In unit_tests.yml, change:
- name: Test with pytest
  run: pytest -x --showlocals -s -vv -n=auto --cov=lm_eval --cov-report=xml --ignore=tests/models/test_openvino.py --ignore=tests/models/test_hf_steered.py
```

### 2. Enable Dependabot (30 minutes)
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

### 3. Add Codecov Integration (2-4 hours)
Add to `unit_tests.yml` after the test step:
```yaml
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage.xml
    fail_ci_if_error: false
```
Create `.codecov.yml`:
```yaml
coverage:
  status:
    project:
      default:
        target: 60%
    patch:
      default:
        target: 70%
```

### 4. Add CodeQL Scanning (1-2 hours)
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
| `unit_tests.yml` | PR + push to main | Linting (pre-commit) + CPU tests (Python 3.10/3.11/3.12) |
| `new_tasks.yml` | PR + push to main | Detects task/API file changes, runs task-specific tests |
| `publish.yml` | Tag push | Build + publish to PyPI and TestPyPI |

**Strengths:**
- Multi-Python version matrix (3.10, 3.11, 3.12) with `fail-fast: true`
- HuggingFace cache caching in CI to speed up tests
- `uv` for fast dependency installation with caching
- Smart task-change detection using `tj-actions/changed-files` — only runs task tests when tasks/API files change
- Artifact upload for test logs even on failure
- Trusted publishing to PyPI (OIDC, no API tokens)
- 30-minute timeout prevents runaway jobs

**Gaps:**
- No concurrency control on PR workflows (duplicate runs possible)
- GPU/model backend test job commented out entirely
- No coverage reporting in CI
- No nightly/periodic test runs
- No matrix for different OS (only Ubuntu)
- mypy is explicitly skipped in pre-commit (`SKIP: "no-commit-to-branch,mypy"`)

### Test Coverage

**Test Structure:**
```
tests/
├── conftest.py              # Shared fixtures (on_ci, task_config, mock_configurable_task)
├── __init__.py
├── test_aggregation_pipeline.py
├── test_cache.py             # Cache key hashing tests
├── test_cli_subcommands.py   # Comprehensive CLI testing (955 lines)
├── test_evaluator.py         # Core evaluation integration tests
├── test_evaluator_utils.py
├── test_fewshot_context.py
├── test_filters.py
├── test_group.py
├── test_janitor.py
├── test_metrics.py           # Metrics calculation tests with regression coverage
├── test_misc.py
├── test_prompt.py
├── test_registry.py
├── test_requests_caching.py
├── test_samplers.py
├── test_task_manager.py
├── test_tasks.py             # Task validation framework
├── test_unitxt_tasks.py
├── test_utils.py             # Utility function tests (713 lines)
├── utils.py                  # Test helpers
├── models/
│   ├── test_api.py
│   ├── test_bos_handling.py
│   ├── test_gguf.py
│   ├── test_gptqmodel.py
│   ├── test_hf_steered.py    # Ignored in CI
│   ├── test_huggingface.py   # Comprehensive HF model tests
│   ├── test_litellm.py
│   ├── test_model_utils.py
│   ├── test_openvino.py      # Ignored in CI
│   ├── test_sglang.py
│   ├── test_vllm.py
│   └── test_vllm_context_length.py
└── scripts/
    └── test_zeno_visualize.py  # Ignored in CI
```

**Statistics:**
- 35 test files, 10,690 total test lines
- 733 source files, 88,480 total source lines
- Test-to-code ratio: ~12.1% (low for a library)
- Testing framework: pytest with pytest-xdist for parallelization
- Fixtures: Shared conftest.py with CI-aware fixtures

**Strengths:**
- CLI tests are exceptionally thorough (955 lines) covering argument parsing, subcommands, configuration precedence, and edge cases
- Regression tests for specific bug fixes (e.g., `test_dict_metric_uses_custom_aggregation` for #3314, `test_custom_yaml_file_relative_path` for #3425)
- Evaluator tests compare `simple_evaluate` vs `evaluate` to verify consistency
- Task test framework dynamically detects new/modified tasks and runs validation
- Good use of parametrize for testing multiple task types
- Cache tests verify filesystem-safe key hashing

**Gaps:**
- Test-to-code ratio is low (12.1%) — many modules have no dedicated tests
- No integration tests running in CI for model backends
- `test_evaluator.py` has a TODO: "more fine grained unit tests" (line 12)
- No tests for decontamination, loggers, or prompts modules
- No property-based testing (hypothesis)
- No benchmark/performance tests

### Code Quality

**Linting (Strong):**
- **Ruff**: Comprehensive configuration in `pyproject.toml` with preview mode enabled
  - Rules: bugbear (B), comprehensions (C419), docstyle (D), pycodestyle (E), pyflakes (F), refurb (FURB), isort (I), type-checking (TC), bandit security (S), simplify (SIM), pyupgrade (UP)
  - Auto-fixable rules configured
  - Per-file ignores for `__init__.py`
  - Google docstring convention
- **Codespell**: Spell checking with ignore list
- **PyMarkdown**: Markdown linting for documentation

**Pre-commit Hooks (Strong):**
- 5 hook repositories configured in `.pre-commit-config.yaml`
- pre-commit/pre-commit-hooks: 13 checks (large files, AST, JSON, YAML, merge conflicts, private keys, trailing whitespace, mixed line endings)
- ruff-pre-commit: Linting + formatting
- codespell: Spell checking
- pymarkdown: Markdown linting
- `detect-private-key` hook for basic secret detection
- Test data excluded from linting (`^tests/testdata/`)

**Gaps:**
- mypy type checking is skipped in CI (`SKIP: "no-commit-to-branch,mypy"`)
- No dedicated static analysis tool beyond ruff
- No complexity checks (e.g., radon, wily)

### Container Images

- **No Dockerfile** or Containerfile exists
- **No docker-compose.yml**
- **No .dockerignore**
- This is a Python library primarily installed via pip/PyPI
- For a tool this widely used, a reference Docker image would benefit reproducibility

### Security

- **No dedicated security scanning workflows**
- **No Dependabot configuration** — no automated dependency update PRs
- **No CodeQL, Semgrep, or Bandit CI integration**
- **No Gitleaks or TruffleHog** for secret detection
- **Partial coverage**: Ruff enables `flake8-bandit` rules (S prefix) which catches some common Python security patterns
- **Partial coverage**: pre-commit `detect-private-key` hook catches committed private keys
- **PyPI trusted publishing** via OIDC — good practice, no API token exposure

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no CLAUDE.md, AGENTS.md, or .claude/ directory
- **Quality**: N/A
- **Gaps**: No test automation guidance, no coding conventions for AI agents, no quality gates
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - Unit test patterns (pytest fixtures, parametrize usage)
  - Task test validation patterns
  - Model backend test patterns
  - Metric test patterns with regression coverage
  - CLI test patterns (argument parsing, subcommand testing)

## Recommendations

### Priority 0 (Critical)

1. **Add coverage tracking and enforcement**
   - Enable `pytest --cov=lm_eval` in CI
   - Integrate codecov with PR reporting
   - Set minimum coverage threshold (start at 60%, increase over time)
   - Effort: 4-6 hours

2. **Re-enable model backend testing**
   - Uncomment or recreate the `testmodels` CI job
   - Use self-hosted GPU runners or conditional nightly jobs
   - At minimum, run CPU-compatible model tests (mock-based)
   - Effort: 16-24 hours

3. **Add dependency scanning**
   - Enable Dependabot for pip and GitHub Actions
   - Consider pip-audit in CI for vulnerability checks
   - Effort: 1-2 hours

### Priority 1 (High Value)

4. **Add CodeQL SAST scanning**
   - Create dedicated workflow for Python security analysis
   - Runs on PR + weekly schedule
   - Effort: 1-2 hours

5. **Enable mypy type checking in CI**
   - Currently skipped in pre-commit; type hints exist in codebase
   - Start with `--ignore-missing-imports` and gradually tighten
   - Effort: 4-8 hours

6. **Add concurrency control to PR workflows**
   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: true
   ```
   - Effort: 15 minutes

### Priority 2 (Nice-to-Have)

7. **Create a reference Dockerfile**
   - Enables containerized evaluation for reproducibility
   - Test image builds in CI
   - Effort: 4-6 hours

8. **Add agent rules for AI-assisted development**
   - Create `.claude/rules/` with test patterns and quality gates
   - Document coding conventions and review expectations
   - Effort: 4-6 hours

9. **Add nightly/periodic CI jobs**
   - Full model backend test suite
   - Performance regression testing
   - Effort: 8-12 hours

10. **Add property-based testing with Hypothesis**
    - Particularly valuable for metrics, tokenization, and data processing
    - Effort: 8-12 hours

## Comparison to Gold Standards

| Feature | lm-evaluation-harness | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|---------|----------------------|---------------------|-------------------|---------------|
| Unit Test Coverage | 12.1% ratio | ~30%+ ratio | ~25% ratio | ~40% ratio |
| Coverage Enforcement | None | Codecov with thresholds | Coverage tracking | Codecov enforced |
| Integration Tests | Limited (CPU only) | Comprehensive E2E | Multi-layer | Multi-version |
| Container Testing | None | Image build + validation | 5-layer validation | Runtime testing |
| Security Scanning | Ruff bandit rules only | CodeQL + Trivy | Trivy | CodeQL + Snyk |
| Pre-commit Hooks | Strong (5 repos, 18+ checks) | Strong | Moderate | Strong |
| Linting | Ruff (comprehensive) | ESLint + Prettier | Various | golangci-lint |
| Agent Rules | None | Comprehensive | Moderate | Moderate |
| Dependency Scanning | None | Dependabot | Dependabot | Dependabot |
| Multi-version Testing | Python 3.10/3.11/3.12 | Node versions | Python versions | K8s + Python versions |

## File Paths Reference

### CI/CD
- `.github/workflows/unit_tests.yml` — Main PR testing (linting + CPU tests)
- `.github/workflows/new_tasks.yml` — Task change detection and validation
- `.github/workflows/publish.yml` — PyPI publishing

### Testing
- `tests/` — All test files (35 Python files)
- `tests/conftest.py` — Shared pytest fixtures
- `tests/models/` — Model backend tests (12 files)
- `tests/testdata/` — Golden test data files

### Code Quality
- `pyproject.toml` — Ruff config, pytest config, dependencies
- `.pre-commit-config.yaml` — Pre-commit hooks (5 repositories)
- `CODEOWNERS` — `@baberabb @0xSMT`

### Source
- `lm_eval/` — Main package (733 Python files, 88,480 lines)
- `lm_eval/api/` — Core API (task, metrics, registry)
- `lm_eval/models/` — Model backends
- `lm_eval/tasks/` — Task definitions (YAML + Python)
- `lm_eval/_cli/` — CLI implementation
- `lm_eval/config/` — Configuration classes
- `scripts/` — Utility scripts
