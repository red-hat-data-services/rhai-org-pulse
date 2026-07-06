---
repository: "red-hat-data-services/misc_tools"
overall_score: 1.2
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No tests of any kind exist in the repository"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests; scripts are untested"
  - dimension: "Build Integration"
    score: 0.0
    status: "No CI/CD workflows, no build validation, no PR checks"
  - dimension: "Image Testing"
    score: 0.0
    status: "No container images built or tested; N/A for this repo type"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling, no codecov, no thresholds"
  - dimension: "CI/CD Automation"
    score: 1.0
    status: "No GitHub Actions, no Makefile, no automation whatsoever"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent guidance"
critical_gaps:
  - title: "Zero test coverage across entire repository"
    impact: "No validation that scripts work correctly; regressions go undetected"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No CI/CD pipeline"
    impact: "No automated checks on PRs; broken code can be merged freely"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No linting or static analysis"
    impact: "Code quality issues (bare except, unused imports, style) not enforced"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No dependency management (requirements.txt/pyproject.toml)"
    impact: "Users must guess which packages to install; version conflicts possible"
    severity: "MEDIUM"
    effort: "1 hour"
  - title: "No root README.md"
    impact: "New contributors have no entry point to understand the project"
    severity: "LOW"
    effort: "1 hour"
quick_wins:
  - title: "Add requirements.txt for Python dependencies"
    effort: "30 minutes"
    impact: "Users can pip install dependencies; reproducible environments"
  - title: "Add a basic GitHub Actions lint workflow"
    effort: "1-2 hours"
    impact: "Catch syntax errors, unused imports, bare excepts on every PR"
  - title: "Add a root README.md"
    effort: "30 minutes"
    impact: "Discoverability and onboarding for new contributors"
  - title: "Add unit tests for find_commit.py and copy_image_build.py"
    effort: "4-6 hours"
    impact: "Validate core logic; prevent regressions from version bumps"
recommendations:
  priority_0:
    - "Add any form of CI — even a single lint job — to prevent merging broken code"
    - "Create requirements.txt listing koji, requests as dependencies"
  priority_1:
    - "Write unit tests for URL construction and argument parsing in both Python scripts"
    - "Add shellcheck linting for the bash scripts (setup.sh, cleanup.sh)"
    - "Add a root README.md explaining the repository purpose and tool inventory"
  priority_2:
    - "Add pre-commit hooks for flake8/ruff and shellcheck"
    - "Create CLAUDE.md or agent rules to guide AI-assisted development"
    - "Consider consolidating the two koji_tools into a single package with shared utilities"
---

# Quality Analysis: misc_tools

## Executive Summary

- **Overall Score: 1.2 / 10**
- **Repository Type**: Utility script collection (Python CLI tools + Bash install scripts)
- **Primary Language**: Python (186 LOC), Bash (56 LOC) — 242 total lines of code
- **Key Strengths**: Apache 2.0 license present; individual READMEs per tool; clear argparse CLI interfaces
- **Critical Gaps**: Zero tests, zero CI/CD, zero linting, no dependency management, no root README
- **Agent Rules Status**: Missing — no CLAUDE.md, no `.claude/` directory

This is a minimal utility repository containing two Koji build-system tools (`find_commit.py`, `copy_image_build.py`) and an OpenShift quick-install script set. The repository has **no quality infrastructure of any kind** — no tests, no CI, no linting, no coverage tracking, and no dependency management. Commits are infrequent version-bump PRs to the catalogsource image tag.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No tests of any kind exist |
| Integration/E2E | 0/10 | No integration or E2E tests |
| **Build Integration** | **0/10** | **No CI/CD workflows, no build validation** |
| Image Testing | 0/10 | N/A — no container images built |
| Coverage Tracking | 0/10 | No coverage tooling |
| CI/CD Automation | 1/10 | No automation; 1 point for having merge-via-PR pattern |
| Agent Rules | 0/10 | No AI agent guidance |

## Critical Gaps

### 1. Zero Test Coverage
- **Impact**: No validation that scripts work correctly; regressions go undetected
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: Neither Python script has any tests. `find_commit.py` makes HTTP calls to Koji and parses JSON — the URL construction and JSON parsing logic is completely untested. `copy_image_build.py` executes `buildah`/`skopeo` subprocesses with no validation. The bash scripts have no tests either.

### 2. No CI/CD Pipeline
- **Impact**: No automated checks on PRs; broken code can be merged freely
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The `.github/workflows/` directory does not exist. There are no GitHub Actions, no Makefile with test targets, no pre-commit hooks, and no other automation. The only quality gate is human code review on PRs.

### 3. No Linting or Static Analysis
- **Impact**: Code quality issues not enforced; existing bugs in code
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: No `.flake8`, `ruff.toml`, `mypy.ini`, or equivalent. The existing code has observable issues:
  - `find_commit.py` line 8: `from requests import Session` — imported but never used
  - `copy_image_build.py` line 12: bare `except:` clause (catches `SystemExit`, `KeyboardInterrupt`)
  - `copy_image_build.py` line 83: references global `args` instead of function parameter
  - No type hints anywhere
  - No shellcheck validation for bash scripts

### 4. No Dependency Management
- **Impact**: Users must guess which packages to install; no reproducible environments
- **Severity**: MEDIUM
- **Effort**: 1 hour
- **Details**: No `requirements.txt`, `setup.py`, `pyproject.toml`, or `Pipfile`. The Python scripts depend on `koji` and `requests` packages but this is not documented anywhere machine-readable.

### 5. No Root README
- **Impact**: New contributors have no entry point to understand the project
- **Severity**: LOW
- **Effort**: 1 hour
- **Details**: There is no root-level README.md. Each subdirectory has its own README, but there's no overview of what the repository contains or how to use it.

## Quick Wins

### 1. Add `requirements.txt` (30 minutes)
```
koji
requests
```

### 2. Add Basic GitHub Actions Lint Workflow (1-2 hours)
```yaml
# .github/workflows/lint.yml
name: Lint
on: [pull_request]
jobs:
  python-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install ruff
      - run: ruff check koji_tools/

  shell-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: shellcheck quick-install/*.sh
```

### 3. Add Root README.md (30 minutes)
A simple overview listing the tools, their purpose, and installation instructions.

### 4. Add Unit Tests for Python Scripts (4-6 hours)
```python
# koji_tools/find_commit/test_find_commit.py
import pytest
from unittest.mock import patch, MagicMock
from find_commit import get_resources_url, display_title

def test_display_title(capsys):
    nvr = {'name': 'foo', 'version': '1.0', 'release': '1.el8'}
    display_title(nvr)
    captured = capsys.readouterr()
    assert 'foo-1.0-1.el8' in captured.out

def test_get_resources_url():
    with patch('find_commit.get_koji_pathinfo') as mock_pi:
        mock_pi.return_value.build.return_value = 'https://example.com/builds/foo'
        url = get_resources_url('brew', {'name': 'foo'})
        assert url.endswith('remote-source.json')
```

## Detailed Findings

### CI/CD Pipeline
- **Workflows**: None. The `.github/workflows/` directory does not exist.
- **PR Checks**: None. Only human review on PRs.
- **Build Automation**: None. No Makefile, no build scripts, no CI configuration.
- **Release Process**: Manual version bumps to `catalogsource.yaml` image tags via PRs.
- **Concurrency Control**: N/A
- **Caching**: N/A

### Test Coverage
- **Unit Tests**: 0 test files. 0 test functions. 0% coverage.
- **Integration Tests**: None.
- **E2E Tests**: None.
- **Test Framework**: None configured.
- **Test-to-Code Ratio**: 0:242 (0%)
- **Coverage Tracking**: No codecov, coveralls, or any coverage tool.
- **Coverage Thresholds**: None.

### Code Quality
- **Linting**: No linter configured. Multiple code issues present:
  - Unused import (`Session` in `find_commit.py`)
  - Bare `except:` clause (`copy_image_build.py:12`)
  - Global variable leak (`args` referenced in `main()` at `copy_image_build.py:83`)
  - Old-style string formatting (`%` operator instead of f-strings)
- **Pre-commit Hooks**: None (`.pre-commit-config.yaml` does not exist)
- **Static Analysis**: No CodeQL, no Semgrep, no security scanning
- **Type Checking**: No mypy, no type hints
- **Shell Scripts**: No shellcheck validation; the scripts use `$()` command substitution correctly but have no error handling (no `set -euo pipefail`)

### Container Images
- **N/A**: This repository does not build container images. It contains tools that *interact with* container image builds in Koji/Brew, but does not produce images itself.

### Security
- **Secret Detection**: None (no gitleaks, no trufflehog)
- **Dependency Scanning**: None (no Dependabot, no Snyk)
- **SAST**: None
- **Hardcoded Credentials**: `fakesecret.yaml` contains a placeholder PagerDuty key (`foo-bar`) — this is intentionally fake but the pattern could mask real secrets in forks.
- **Subprocess Calls**: `copy_image_build.py` uses `subprocess.check_call` with list arguments (safe against injection), which is good practice.

### Agent Rules (Agentic Flow Quality)
- **Status**: Missing
- **CLAUDE.md**: Not present
- **`.claude/` directory**: Not present
- **`.claude/rules/`**: Not present
- **Coverage**: No test type rules of any kind
- **Quality**: N/A
- **Gaps**: Everything — no agent rules exist
- **Recommendation**: Given the small size of this repo, a minimal `CLAUDE.md` with testing guidance would be sufficient. Full `.claude/rules/` setup would be overkill for 242 LOC.

## Recommendations

### Priority 0 (Critical)
1. **Add a basic CI pipeline** — Even a single GitHub Actions workflow running `ruff check` and `shellcheck` would catch obvious errors before merge.
2. **Create `requirements.txt`** — List `koji` and `requests` as dependencies so users can install them reliably.
3. **Fix existing bugs** — The bare `except:` in `copy_image_build.py` and the global `args` reference are actual bugs that could cause silent failures.

### Priority 1 (High Value)
1. **Write unit tests for core logic** — Focus on `get_resources_url()`, `get_source_image()`, `get_tag_list()`, and argument parsing. Mock the Koji session and HTTP calls.
2. **Add shellcheck to bash scripts** — `setup.sh` and `cleanup.sh` lack `set -euo pipefail` and have no error handling for failed `oc` commands.
3. **Add a root README.md** — Describe the tool collection, prerequisites (Koji client config, OpenShift access), and usage.

### Priority 2 (Nice-to-Have)
1. **Add pre-commit hooks** — `ruff`, `shellcheck`, and YAML validation.
2. **Create minimal CLAUDE.md** — Guide AI agents on testing patterns and code style for this repo.
3. **Consider packaging** — The two `koji_tools` share the same Koji session pattern and could be a small pip-installable package with `entry_points`.
4. **Add type hints** — Python type annotations for the function signatures.
5. **Modernize string formatting** — Replace `%` formatting with f-strings throughout.

## Comparison to Gold Standards

| Dimension | misc_tools | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | 0/10 | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 0/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 0/10 | 8/10 | 7/10 | 7/10 |
| Image Testing | N/A | 7/10 | 9/10 | 6/10 |
| Coverage Tracking | 0/10 | 8/10 | 5/10 | 8/10 |
| CI/CD Automation | 1/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 0/10 | 8/10 | 3/10 | 2/10 |
| **Overall** | **1.2/10** | **8.5/10** | **7.0/10** | **7.5/10** |

**Note**: This is a utility script repository, not a product component. The comparison to gold standards is instructive but the expectations should be calibrated to the repo's scope. A small utility repo doesn't need the same infrastructure as a full product, but it should still have basic linting, tests for core logic, and dependency management.

## File Paths Reference

| Purpose | Path | Status |
|---------|------|--------|
| CI/CD Workflows | `.github/workflows/` | **Missing** |
| Python Tests | `*_test.py` / `test_*.py` | **Missing** |
| Coverage Config | `.codecov.yml` | **Missing** |
| Linting Config | `.flake8` / `ruff.toml` | **Missing** |
| Pre-commit Hooks | `.pre-commit-config.yaml` | **Missing** |
| Dependency File | `requirements.txt` | **Missing** |
| Root README | `README.md` | **Missing** |
| Agent Rules | `CLAUDE.md` / `.claude/` | **Missing** |
| Makefile | `Makefile` | **Missing** |
| License | `LICENSE` | Present (Apache 2.0) |
| Tool 1: find_commit | `koji_tools/find_commit/find_commit.py` | 83 LOC |
| Tool 2: copy_image_build | `koji_tools/copy_image_build/copy_image_build.py` | 103 LOC |
| Quick-install setup | `quick-install/setup.sh` | 32 LOC |
| Quick-install cleanup | `quick-install/cleanup.sh` | 24 LOC |
