---
repository: "opendatahub-io/aiops-infra"
overall_score: 2.3
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No unit tests exist for any of the 74 scripts (0 test files found)"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E test suites; no test infrastructure (pytest, bats, shunit2)"
  - dimension: "Build Integration"
    score: 1.0
    status: "No Dockerfile/container builds in this repo; no PR-time build validation"
  - dimension: "Image Testing"
    score: 0.0
    status: "No container images built from this repo; no image testing"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tools configured (no codecov, coveralls, or coverage reports)"
  - dimension: "CI/CD Automation"
    score: 4.0
    status: "CI limited to skillsaw linting only; no test execution, no security scanning"
  - dimension: "Agent Rules"
    score: 7.0
    status: "Excellent Claude Code skills with detailed SKILL.md files; no .claude/rules/ for test patterns"
critical_gaps:
  - title: "Zero test coverage across entire codebase"
    impact: "74 scripts (53 bash, 21 Python) totaling ~10,900 lines have no automated tests; regressions undetectable"
    severity: "HIGH"
    effort: "40-60 hours"
  - title: "No testing framework configured"
    impact: "No pytest, bats, shunit2, or any testing infrastructure exists to run tests against"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "CI pipeline runs only linting, no test execution"
    impact: "PRs merge without any script validation; broken logic ships to production"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No security scanning (SAST, dependency scanning, secret detection)"
    impact: "Scripts handle credentials (Jira tokens, GitHub tokens, GitLab tokens) with no automated secret detection"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No input validation testing for YAML schema validation"
    impact: "The validate_yaml_schema.py script is a critical gate but has no tests verifying schema enforcement"
    severity: "MEDIUM"
    effort: "4-8 hours"
quick_wins:
  - title: "Add pytest for Python scripts with basic unit tests"
    effort: "4-6 hours"
    impact: "Cover 21 Python scripts with foundational tests for argument parsing, validation logic, and error handling"
  - title: "Add bats-core for shell script testing"
    effort: "3-4 hours"
    impact: "Enable testing of 53 shell scripts with bash assertion framework"
  - title: "Add Gitleaks scanning to CI workflow"
    effort: "1-2 hours"
    impact: "Detect accidentally committed secrets (repo handles Jira, GitHub, GitLab credentials extensively)"
  - title: "Add ShellCheck linting to CI"
    effort: "1-2 hours"
    impact: "Catch common bash bugs, quoting issues, and unsafe constructs across 53 shell scripts"
  - title: "Add a CI workflow to run pytest on PRs"
    effort: "2-3 hours"
    impact: "Gate PRs on test execution; currently only skillsaw lint runs"
recommendations:
  priority_0:
    - "Establish pytest infrastructure and write unit tests for all 21 Python scripts, starting with validate_yaml_schema.py, update_jira_issue.py, and edit_yaml.py"
    - "Add bats-core and write tests for critical shell scripts (init_pipeline.sh, pipeline_state.sh, check_prerequisites.sh)"
    - "Add a CI workflow that runs pytest and bats on every PR"
  priority_1:
    - "Add Gitleaks or TruffleHog secret detection to CI — repo handles multiple credential types"
    - "Add ShellCheck linting for all shell scripts in CI (currently only skillsaw lint runs)"
    - "Add codecov or coverage reporting for Python scripts"
    - "Create .claude/rules/ directory with test creation patterns for Python and Bash scripts"
  priority_2:
    - "Add integration tests that validate full pipeline state transitions with mock Jira/GitHub/GitLab responses"
    - "Add pre-commit hooks for ShellCheck, ruff, and secret detection"
    - "Create playbook/runbook testing for the orchestrator skill flow"
---

# Quality Analysis: aiops-infra

## Executive Summary

- **Overall Score: 2.3/10**
- **Repository Type**: Infrastructure automation toolkit (Claude Code skills + shell/Python scripts)
- **Primary Languages**: Bash (53 scripts), Python (21 scripts), ~10,900 total lines
- **Purpose**: Automates ODH/RHOAI component onboarding onto the Konflux CI/CD platform via Claude Code skills

### Key Strengths
- **Exceptional skill documentation**: Three well-structured Claude Code skills with comprehensive SKILL.md files covering full orchestration, validation, and Jira integration
- **JSON Schema validation**: Strong `component_onboarding_details.schema.json` with conditional validation rules
- **Idempotent pipeline design**: The orchestrator uses `pipeline_state.json` for resumable, re-entrant execution
- **skillsaw linting**: Uses skillsaw v0.10.1 for SKILL.md quality enforcement in CI

### Critical Gaps
- **Zero automated tests**: No test files exist anywhere in the repository — no pytest, bats, shunit2, or any testing framework
- **CI runs only linting**: The only CI workflow runs `skillsaw` lint; no script validation, no security scanning
- **No security scanning**: Scripts handle sensitive credentials (Jira API tokens, GitHub tokens, GitLab tokens) with no secret detection
- **No coverage tracking**: No codecov, coveralls, or any coverage measurement

### Agent Rules Status: **Partial**
- `.claude/skills/` directory exists with 3 well-documented skills
- No `.claude/rules/` directory for test creation patterns
- No `CLAUDE.md` or `AGENTS.md` root documentation

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No unit tests exist for any of the 74 scripts |
| Integration/E2E | 0/10 | No integration or E2E test suites |
| **Build Integration** | **1/10** | **No container builds in this repo; no PR-time build validation** |
| Image Testing | 0/10 | No container images built from this repo |
| Coverage Tracking | 0/10 | No coverage tools configured |
| CI/CD Automation | 4/10 | CI limited to skillsaw linting only |
| Agent Rules | 7/10 | Excellent skills documentation; no test rules |

## Critical Gaps

### 1. Zero Test Coverage Across Entire Codebase
- **Impact**: 74 scripts totaling ~10,900 lines have no automated tests. Regressions are completely undetectable. Any change to `edit_yaml.py` (580 lines), `run_github_workflow.py` (551 lines), or `update_jira_issue.py` (433 lines) could break the entire onboarding pipeline.
- **Severity**: HIGH
- **Effort**: 40-60 hours for foundational coverage

### 2. No Testing Framework Configured
- **Impact**: No `pytest.ini`, `conftest.py`, `pyproject.toml` with test config, `bats/` directory, or any test runner configuration exists. There is no infrastructure to write or run tests even if someone wanted to.
- **Severity**: HIGH
- **Effort**: 4-6 hours to set up pytest + bats-core

### 3. CI Pipeline Runs Only Linting
- **Impact**: The only CI check is `skillsaw` lint, which validates SKILL.md formatting. No script validation, no Python syntax checks, no shell script linting. PRs merge without any code quality gate beyond skill documentation.
- **Severity**: HIGH
- **Effort**: 8-12 hours for comprehensive CI

### 4. No Security Scanning
- **Impact**: Scripts extensively handle Jira API tokens (`JIRA_API_TOKEN`), GitHub tokens (`GITHUB_TOKEN`), GitLab tokens (`GITLAB_TOKEN`), and OpenShift tokens (`EXT_OC_TOKEN`, `INT_OC_TOKEN`). No Gitleaks, TruffleHog, or CodeQL scanning is configured. No `.gitleaks.toml` or SAST configuration exists.
- **Severity**: HIGH
- **Effort**: 4-6 hours

### 5. No Input Validation Testing
- **Impact**: `validate_yaml_schema.py` is the critical gate for the entire onboarding pipeline, but has zero tests verifying it correctly rejects malformed YAML, missing required fields, or invalid enum values.
- **Severity**: MEDIUM
- **Effort**: 4-8 hours

## Quick Wins

### 1. Add pytest for Python Scripts (4-6 hours)
```yaml
# pyproject.toml addition
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
```
Start with `validate_yaml_schema.py` — test valid YAML passes, missing required fields fail, invalid enum values fail, conditional schema rules work correctly.

### 2. Add bats-core for Shell Scripts (3-4 hours)
```bash
# Install bats
git clone https://github.com/bats-core/bats-core.git
./bats-core/install.sh /usr/local
```
Start with `check_prerequisites.sh`, `pipeline_state.sh`, and `parse_jira_url.sh` — these are pure-logic scripts with clear input/output contracts.

### 3. Add Gitleaks to CI (1-2 hours)
```yaml
# .github/workflows/security.yml
name: Security
on: [push, pull_request]
jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - uses: gitleaks/gitleaks-action@v2
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 4. Add ShellCheck to CI (1-2 hours)
```yaml
# Add to .github/workflows/lint.yml
  shellcheck:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Run ShellCheck
      uses: ludeeus/action-shellcheck@master
      with:
        scandir: './scripts'
        severity: warning
```

### 5. Add pytest CI Workflow (2-3 hours)
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  python-tests:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v5
      with:
        python-version: '3.12'
    - run: pip install pytest pyyaml jsonschema
    - run: pytest tests/ -v
```

## Detailed Findings

### CI/CD Pipeline

**Workflows Found**: 2
1. `lint.yml` — Runs skillsaw linter on push/PR to main
2. `lint-review.yml` — Posts skillsaw review comments on PRs (triggered by lint workflow completion)

**What's Missing**:
- No test execution workflow
- No security scanning workflow
- No Python linting (ruff, flake8, mypy)
- No shell linting (ShellCheck)
- No dependency vulnerability scanning
- No concurrency control (concurrent PR runs not managed)
- No caching strategy

**Positive**: Pinned action SHAs (`actions/checkout@de0fac2...`) prevent supply chain attacks via action version changes.

### Test Coverage

**Test Files Found**: 0
**Test Frameworks Configured**: None
**Test-to-Code Ratio**: 0:10,900
**Coverage Tracking**: None

The repository has **zero test infrastructure**. No `tests/` directory, no `test_*.py` files, no `*_test.sh` files, no `conftest.py`, no `pytest.ini`, no bats test files. This is the most critical gap.

**High-value test targets** (by complexity and blast radius):
1. `edit_yaml.py` (580 lines) — Complex YAML manipulation; errors corrupt onboarding configs
2. `run_github_workflow.py` (551 lines) — GitHub Actions dispatch; failures break the ODH onboarder workflow
3. `update_jira_issue.py` (433 lines) — Jira API mutations; errors corrupt ticket state
4. `run_step_krd.sh` (374 lines) — Konflux release data onboarding; failures block the pipeline
5. `sync_state_from_jira.py` (360 lines) — State reconstruction from Jira labels; errors desync pipeline

### Code Quality

**Linting**:
- skillsaw v0.10.1 for SKILL.md quality (context budget warnings at 7K/10K tokens)
- ShellCheck directives found in 2 scripts (`setup_gitlab_playpen.sh`, `setup_github_playpen.sh`) but not enforced in CI
- No Python linting (ruff, flake8, pylint, mypy)
- No pre-commit hooks (`.pre-commit-config.yaml` absent)

**Code Style**:
- Python scripts use `uv run --script` with inline dependency declarations — good practice
- Shell scripts use `bash -e` patterns but inconsistently
- No type hints enforcement for Python scripts

### Container Images

This repository **does not build container images**. It is a script/skill toolkit that automates component onboarding. Container image testing is not applicable to this repo's purpose, though the scripts _validate_ Dockerfiles in other repos (e.g., `check_dockerfile_digests.py`).

### Security

**Current State**: No security scanning of any kind.

**Risk Areas**:
- Scripts accept and use 5+ credential environment variables (JIRA_API_TOKEN, GITHUB_TOKEN, GITLAB_TOKEN, EXT_OC_TOKEN, INT_OC_TOKEN)
- `GIT_SSL_NO_VERIFY=true` is used for GitLab connections (documented as intentional for internal CA)
- No Gitleaks, TruffleHog, or secret detection configured
- No CodeQL or SAST scanning
- No dependency scanning (Python dependencies managed via inline `uv` specs, not audited)

### Agent Rules (Agentic Flow Quality)

**Status**: Partial — excellent skills, no test rules

**What Exists**:
- `.claude/skills/` directory with 3 well-documented skills:
  - `onboard-konflux-components-for-odh-and-rhoai` — Master orchestrator (648-line SKILL.md)
  - `validate-component-onboarding-jira` — Pre-flight validation
  - `create-component-onboarding-jira` — Interactive Jira creation
- `docs/skills/` with 18 detailed skill documentation pages
- `.skillsaw.yaml` for SKILL.md quality enforcement
- `schemas/component_onboarding_details.schema.json` for YAML validation

**What's Missing**:
- No `.claude/rules/` directory for test creation patterns
- No `CLAUDE.md` or `AGENTS.md` root documentation
- No agent rules for how to write tests for shell scripts or Python scripts
- No coding standards documentation for contributors

**Recommendation**: Generate missing test rules with `/test-rules-generator` to guide AI-assisted test creation.

## Recommendations

### Priority 0 (Critical)

1. **Establish pytest infrastructure and write unit tests for Python scripts**
   - Create `tests/` directory with `conftest.py`
   - Start with `validate_yaml_schema.py` (critical gate), `edit_yaml.py` (highest complexity), `update_jira_issue.py` (highest blast radius)
   - Use `unittest.mock` to mock Jira/GitHub/GitLab API calls
   - Target: 80%+ coverage for Python scripts

2. **Add bats-core and write tests for critical shell scripts**
   - Test `init_pipeline.sh`, `pipeline_state.sh`, `check_prerequisites.sh`, `parse_jira_url.sh`
   - These scripts have clear input/output contracts that are straightforward to test
   - Use bats assertions for exit codes, stdout content, and file creation

3. **Add CI workflow for test execution**
   - Create `.github/workflows/test.yml` that runs pytest + bats on every PR
   - Make tests required for merge

### Priority 1 (High Value)

4. **Add secret detection scanning**
   - Gitleaks or TruffleHog in CI
   - Critical given the volume of credential handling

5. **Add ShellCheck to CI**
   - Enforce shell script quality across 53 scripts
   - Currently only 2 scripts have inline ShellCheck directives

6. **Add codecov/coverage reporting**
   - Track Python test coverage and enforce thresholds
   - Configure coverage reporting on PRs

7. **Create `.claude/rules/` with test creation patterns**
   - Document how to write tests for `uv run --script` Python scripts
   - Document how to test shell scripts with bats-core
   - Include mock patterns for Jira, GitHub, and GitLab APIs

### Priority 2 (Nice-to-Have)

8. **Add integration tests for pipeline state machine**
   - Test full state transitions (pending → pr_raised → merged → done)
   - Use mock Jira/GitHub/GitLab API responses
   - Validate the orchestrator's dependency resolution logic

9. **Add pre-commit hooks**
   - ShellCheck, ruff (Python), gitleaks
   - Enforce quality before commits reach CI

10. **Add Python type checking**
    - Add type hints to Python scripts
    - Run mypy or pyright in CI

## Comparison to Gold Standards

| Dimension | aiops-infra | odh-dashboard | notebooks | kserve |
|-----------|-------------|---------------|-----------|--------|
| Unit Tests | 0/10 | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 0/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 1/10 | 7/10 | 8/10 | 7/10 |
| Image Testing | N/A | 7/10 | 9/10 | 7/10 |
| Coverage Tracking | 0/10 | 8/10 | 6/10 | 9/10 |
| CI/CD Automation | 4/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 7/10 | 8/10 | 3/10 | 2/10 |
| **Overall** | **2.3/10** | **8.1/10** | **7.0/10** | **7.5/10** |

**Notable**: aiops-infra scores well on Agent Rules (7/10) due to its excellent Claude Code skill documentation — the best-structured SKILL.md files in the ODH ecosystem. However, this strength cannot compensate for the complete absence of automated testing.

## File Paths Reference

### CI/CD
- `.github/workflows/lint.yml` — skillsaw lint (push + PR)
- `.github/workflows/lint-review.yml` — skillsaw PR review comments
- `Makefile` — skillsaw and skillsaw-fix targets
- `.skillsaw.yaml` — skillsaw configuration

### Scripts (No Tests)
- `scripts/*.sh` — 53 shell scripts (~8,200 lines)
- `scripts/*.py` — 21 Python scripts (~2,700 lines)

### Agent Skills
- `.claude/skills/onboard-konflux-components-for-odh-and-rhoai/SKILL.md`
- `.claude/skills/validate-component-onboarding-jira/SKILL.md`
- `.claude/skills/create-component-onboarding-jira/SKILL.md`
- `.claude/skills/install.sh` — Skill dependency installer
- `.claude/skills/install-dependencies.sh` — Dependency installation

### Documentation
- `docs/skills/index.md` — Skill pipeline overview
- `docs/skills/*.md` — 18 individual skill docs
- `ADLC/` — Agentic SDLC flow diagrams
- `schemas/component_onboarding_details.schema.json` — YAML validation schema

### Quality Config (Missing)
- No `pytest.ini` / `pyproject.toml` (testing)
- No `.pre-commit-config.yaml` (hooks)
- No `.codecov.yml` (coverage)
- No `.gitleaks.toml` (secrets)
- No `.golangci.yaml` / `ruff.toml` (linting)
- No `CLAUDE.md` / `AGENTS.md` (agent documentation)
- No `.claude/rules/` (test creation patterns)
