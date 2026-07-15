---
repository: "opendatahub-io/rhai-wiki"
overall_score: 4.5
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Strong pytest suite with 296 test functions, good test-to-code ratio (0.69)"
  - dimension: "Integration/E2E"
    score: 5.0
    status: "Integration and contract tests present but no E2E or live-environment testing"
  - dimension: "Build Integration"
    score: 0.0
    status: "No CI/CD pipeline exists — zero PR-time build validation"
  - dimension: "Image Testing"
    score: 0.0
    status: "No container images, Dockerfiles, or image build process"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage generation, no codecov integration, no thresholds"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "No GitHub Actions workflows, no CI/CD configuration of any kind"
  - dimension: "Agent Rules"
    score: 7.0
    status: "22 Claude Code skills present but no .claude/rules/ for test patterns or coding standards"
critical_gaps:
  - title: "No CI/CD pipeline at all"
    impact: "No automated testing, linting, or validation on PRs — quality is entirely developer-dependent"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No test coverage tracking"
    impact: "Unknown which code paths are exercised; regressions can ship silently"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No linting or static analysis"
    impact: "Code style inconsistencies and potential bugs go undetected"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No security scanning"
    impact: "Dependency vulnerabilities and secret leaks not detected"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No pre-commit hooks"
    impact: "Formatting and lint errors caught only at review time"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add a GitHub Actions CI workflow with pytest + mypy"
    effort: "2-4 hours"
    impact: "Immediate automated quality gate on every PR"
  - title: "Add pytest-cov and codecov integration"
    effort: "1-2 hours"
    impact: "Visibility into coverage gaps, PR-level coverage reporting"
  - title: "Add ruff for linting and formatting"
    effort: "1-2 hours"
    impact: "Fast, comprehensive Python linting with zero-config defaults"
  - title: "Add pre-commit hooks (ruff, mypy, trailing whitespace)"
    effort: "1-2 hours"
    impact: "Shift quality checks left — catch issues before commit"
  - title: "Create .claude/rules/ for unit test patterns"
    effort: "2-3 hours"
    impact: "Consistent AI-generated tests matching existing project patterns"
recommendations:
  priority_0:
    - "Create a GitHub Actions CI workflow that runs pytest and mypy --strict on every PR"
    - "Add pytest-cov to the dev dependencies and integrate with codecov or coveralls"
    - "Add ruff for linting and formatting enforcement"
  priority_1:
    - "Add pre-commit hooks for ruff, mypy, and basic file hygiene"
    - "Add Dependabot or Renovate for dependency security updates"
    - "Create .claude/rules/ with unit-tests.md and integration-tests.md based on existing patterns"
    - "Add a conftest.py with shared fixtures to reduce test boilerplate"
  priority_2:
    - "Add GitHub branch protection rules requiring CI pass before merge"
    - "Add a Makefile or justfile with standard targets (test, lint, typecheck, format)"
    - "Consider adding property-based testing (hypothesis) for data model validation"
    - "Add documentation generation (Sphinx/MkDocs) for the Python API"
---

# Quality Analysis: rhai-wiki

## Executive Summary

- **Overall Score: 4.5/10**
- **Repository Type**: Python CLI + knowledge pipeline (stdlib-only runtime, pytest + mypy dev)
- **Primary Language**: Python 3.14 (cutting-edge)
- **Framework**: Custom pipeline with Claude Code skill orchestration

**Key Strengths**:
- Excellent test discipline with 296 test functions across unit, integration, and contract layers
- Strong test-to-code ratio (4,639 test LOC / 6,678 source LOC = 0.69)
- Contract tests verify adapter interface compliance across all 10 adapter types
- Strict mypy type checking enabled
- Rich Claude Code skills ecosystem (22 skills) for pipeline orchestration

**Critical Gaps**:
- **Zero CI/CD infrastructure** — no GitHub Actions workflows, no automated quality gates
- **No coverage tracking** — no pytest-cov, no codecov, no coverage thresholds
- **No linting configuration** — no ruff, flake8, pylint, or any code quality tooling
- **No security scanning** — no dependency scanning, no secret detection
- **No pre-commit hooks** — quality checks are entirely manual

**Agent Rules Status**: Partially present — 22 skills exist but no `.claude/rules/` directory for coding standards or test creation guidelines.

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 7.5/10 | 20% | Strong pytest suite: 9 unit test files, 296 test functions, 583 assertions |
| Integration/E2E | 5.0/10 | 25% | Integration + contract tests exist, but no E2E or live-environment validation |
| Build Integration | 0.0/10 | — | No CI/CD pipeline — zero PR-time build validation |
| Image Testing | 0.0/10 | 20% | No container images or Dockerfiles (not applicable for this project type) |
| Coverage Tracking | 1.0/10 | 15% | mypy strict enabled but no code coverage generation or enforcement |
| CI/CD Automation | 0.0/10 | 20% | No GitHub Actions, no CI configuration of any kind |
| Agent Rules | 7.0/10 | — | 22 Claude Code skills, but no .claude/rules/ for test patterns |

## Critical Gaps

### 1. No CI/CD Pipeline (Severity: HIGH)
- **Impact**: No automated testing, linting, type checking, or validation runs on PRs. All quality assurance is manual.
- **Effort**: 4-8 hours
- **Details**: The repository has no `.github/workflows/` directory, no `.gitlab-ci.yml`, no `Makefile`, and no `Jenkinsfile`. The existing test suite (296 tests) runs only when a developer manually executes `uv run pytest`.
- **Risk**: Regressions can be merged without detection. The strong local test suite provides zero value without automated execution.

### 2. No Test Coverage Tracking (Severity: HIGH)
- **Impact**: Unknown which source files and code paths are exercised by the test suite. Coverage could be 20% or 90% — there's no way to know.
- **Effort**: 2-4 hours
- **Details**: `pyproject.toml` lists only `pytest` and `mypy` as dev dependencies. No `pytest-cov` plugin, no `.coveragerc`, no codecov integration.

### 3. No Linting or Static Analysis (Severity: HIGH)
- **Impact**: Code style inconsistencies, unused imports, potential bugs, and anti-patterns go undetected.
- **Effort**: 2-3 hours
- **Details**: No `ruff.toml`, `.flake8`, `.pylintrc`, or any linting configuration exists. The only static analysis is `mypy --strict`, which covers type safety but not code quality.

### 4. No Security Scanning (Severity: MEDIUM)
- **Impact**: Dependency vulnerabilities and potential secret leaks in source snapshots not detected.
- **Effort**: 2-3 hours
- **Details**: No Dependabot, no Snyk, no CodeQL, no gitleaks. The project handles external data from Jira, Confluence, GitHub, and Google services — elevated attack surface.

### 5. No Pre-commit Hooks (Severity: MEDIUM)
- **Impact**: Formatting and lint errors caught only during manual review.
- **Effort**: 1-2 hours
- **Details**: No `.pre-commit-config.yaml`. Combined with the absence of CI, there are no automated quality checks at any stage.

## Quick Wins

### 1. Add GitHub Actions CI Workflow (2-4 hours)
Create `.github/workflows/ci.yml` to run on PRs:
```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
        with:
          version: "latest"
      - run: uv sync
      - run: uv run mypy --strict src/
      - run: uv run pytest --tb=short -q
```

### 2. Add Coverage Tracking (1-2 hours)
Add `pytest-cov` to dev dependencies and update test command:
```toml
# pyproject.toml
[dependency-groups]
dev = ["pytest", "mypy", "pytest-cov"]

[tool.pytest.ini_options]
addopts = "--cov=src --cov-report=term-missing --cov-fail-under=70"
```

### 3. Add Ruff for Linting (1-2 hours)
Add `ruff` to dev dependencies and create configuration:
```toml
# pyproject.toml additions
[dependency-groups]
dev = ["pytest", "mypy", "pytest-cov", "ruff"]

[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP", "B", "SIM", "TCH"]
```

### 4. Add Pre-commit Hooks (1-2 hours)
Create `.pre-commit-config.yaml`:
```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
      - id: ruff-format
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.13.0
    hooks:
      - id: mypy
        additional_dependencies: []
        args: [--strict]
```

### 5. Create Agent Test Rules (2-3 hours)
Create `.claude/rules/unit-tests.md` codifying the project's existing patterns:
- Use `pytest` classes (e.g., `class TestModelName:`)
- Use `tmp_path` fixture for file system tests
- Mock external CLI tools via `unittest.mock.patch`
- Use parametrized fixtures for contract tests
- Include type annotations on all test functions

## Detailed Findings

### CI/CD Pipeline

**Status: Non-existent**

| Aspect | Finding |
|--------|---------|
| GitHub Actions | No `.github/workflows/` directory |
| GitLab CI | No `.gitlab-ci.yml` |
| Makefile | Not present |
| Jenkins | Not present |
| Branch protection | Unknown (no CI to gate on) |

The repository relies entirely on manual developer discipline. Given the project is internal/private within the `opendatahub-io` organization, this means there is no enforced quality gate before code reaches the main branch.

### Test Coverage

**Status: Strong local tests, no automation**

| Metric | Value |
|--------|-------|
| Total test files | 12 |
| Unit test files | 9 |
| Integration test files | 2 |
| Contract test files | 1 |
| Total test functions | 296 |
| Total assertions | 583 |
| Test LOC | 4,639 |
| Source LOC | 6,678 |
| Test-to-code ratio | 0.69 |

**Test Organization**:
```
tests/
├── unit/          (9 files, ~4,225 LOC)
│   ├── test_adapters.py       640 LOC - All 10 adapter types
│   ├── test_pipeline.py     1,366 LOC - Ingestion, extraction, synthesis
│   ├── test_models.py         714 LOC - Data model validation
│   ├── test_schema.py         502 LOC - Schema loading and validation
│   ├── test_catalog_extract.py 349 LOC - Entity extraction
│   ├── test_catalog_synthesize.py 224 LOC - Catalog synthesis
│   ├── test_catalog_store.py  213 LOC - JSON store operations
│   ├── test_catalog_aliases.py 127 LOC - Alias resolution
│   └── test_query_standalone.py 90 LOC - Catalog query
├── integration/   (2 files, ~273 LOC)
│   ├── test_contradiction.py  121 LOC - E2E contradiction flow
│   └── test_add_source.py     152 LOC - Source add + ingest flow
└── contract/      (1 file, ~141 LOC)
    └── test_adapter_contract.py 141 LOC - Interface compliance
```

**Strengths**:
- Clean three-layer test architecture (unit/integration/contract)
- Contract tests use parametrized fixtures to verify all 10 adapter types implement the `SourceAdapter` ABC correctly
- Integration tests exercise multi-step pipeline flows with realistic data
- Tests use `tmp_path` fixture for file system isolation
- Consistent helper functions to reduce test boilerplate
- 583 explicit assertions across 296 test functions (~2 assertions per test)

**Weaknesses**:
- No `conftest.py` — shared helpers duplicated across test files (e.g., `_make_claim`, `_config`)
- No coverage measurement — impossible to identify untested code paths
- No pytest markers — tests cannot be selectively run by category (e.g., `@pytest.mark.slow`)
- Missing tests for: `src/cli/main.py` (484 LOC), `src/wiki/generator.py` (957 LOC), `src/wiki/index.py` (413 LOC)
- `src/wiki/` module (1,740 LOC total) appears largely untested directly

### Code Quality

**Status: Minimal**

| Tool | Status |
|------|--------|
| mypy | ✅ Enabled with `strict = true` |
| ruff/flake8/pylint | ❌ Not configured |
| Pre-commit hooks | ❌ Not configured |
| Import sorting | ❌ Not configured |
| Code formatting | ❌ Not configured (no black, ruff format) |

**Positive**: `mypy --strict` catches type errors, enforces type annotations on all public functions, and is documented in `CLAUDE.md` as part of the development workflow.

**Gap**: Type checking alone doesn't catch code quality issues like unused variables, unnecessary complexity, missing docstrings, or anti-patterns.

### Container Images

**Status: Not applicable**

This is a Python CLI/pipeline tool with no containerized deployment. No Dockerfiles, Containerfiles, or container-related configuration exists. This is appropriate for the project's nature — it runs locally via `uv run` or through Claude Code skills.

Score adjusted: N/A (excluded from weighted average).

### Security

**Status: No security measures**

| Aspect | Status |
|--------|--------|
| Dependency scanning | ❌ No Dependabot/Renovate |
| Secret detection | ❌ No gitleaks/TruffleHog |
| SAST | ❌ No CodeQL/Semgrep |
| Supply chain | ❌ No lockfile pinning enforcement |
| Input validation | ⚠️ Schema validation exists for config, limited for external data |

**Risk Context**: The project ingests data from external systems (GitHub API, Jira API, Google Sheets, Confluence, Google Drive). While CLI tools handle authentication, the pipeline processes and stores external content with limited sanitization.

**Positive**: `uv.lock` exists for reproducible dependency resolution, and the project has zero runtime dependencies (stdlib only), which dramatically reduces supply chain risk.

### Agent Rules (Agentic Flow Quality)

**Status: Partially present — skills but no rules**

| Aspect | Status |
|--------|--------|
| `.claude/` directory | ✅ Present |
| `.claude/skills/` | ✅ 22 skills covering pipeline, catalog, and git operations |
| `.claude/rules/` | ❌ Not present |
| `CLAUDE.md` | ✅ Present with tool runner instructions |
| Test creation rules | ❌ Missing |
| Coding standards | ❌ Missing |

**Skills Inventory** (22 total):
- **Pipeline skills** (7): wiki-cycle, wiki-ingest, wiki-extract, wiki-contradict, wiki-synthesize, wiki-commit, wiki-add-source
- **Catalog skill** (1): software-catalog-query
- **Speckit skills** (14): speckit-analyze, speckit-checklist, speckit-clarify, speckit-constitution, speckit-git-*, speckit-implement, speckit-plan, speckit-specify, speckit-tasks, speckit-taskstoissues

**Gap**: No `.claude/rules/` directory means AI agents have no guidance on:
- How to write unit tests matching the project's pytest class-based pattern
- How to structure integration tests with `tmp_path` isolation
- How to write contract tests for new adapters
- Coding standards (naming, error handling, logging patterns)

**Recommendation**: Run `/test-rules-generator` to generate rules based on existing test patterns.

## Recommendations

### Priority 0 (Critical — This Week)

1. **Create GitHub Actions CI workflow** — Run `pytest` and `mypy --strict` on every PR. This is the single highest-impact improvement; the existing 296 tests provide zero value without automated execution.

2. **Add coverage tracking** — Add `pytest-cov` and configure a baseline coverage threshold (start with 60%, raise to 80%). Integrate with codecov for PR-level reporting.

3. **Add ruff for linting** — Zero-config Python linter that catches code quality issues, enforces import sorting, and auto-formats. Runs in <1 second on this codebase.

### Priority 1 (High Value — This Sprint)

4. **Add pre-commit hooks** — Enforce ruff, mypy, and file hygiene before commits reach the repository.

5. **Configure Dependabot** — Enable dependency security alerts and automated update PRs for `pyproject.toml`.

6. **Create `.claude/rules/`** — Generate test creation rules from existing patterns. Include `unit-tests.md`, `integration-tests.md`, and `contract-tests.md`.

7. **Add conftest.py** — Extract shared test helpers (`_make_claim`, `_config`, `_snapshot`) into `tests/conftest.py` to reduce duplication.

8. **Add pytest markers** — Tag tests with `@pytest.mark.unit`, `@pytest.mark.integration`, `@pytest.mark.contract` for selective execution.

### Priority 2 (Nice-to-Have — Next Quarter)

9. **Add branch protection rules** — Require CI pass and at least one review before merge.

10. **Add a Makefile** — Standard targets (`make test`, `make lint`, `make typecheck`, `make format`) for developer convenience.

11. **Improve test coverage for wiki module** — `src/wiki/generator.py` (957 LOC) and `src/wiki/index.py` (413 LOC) appear largely untested.

12. **Add property-based testing** — Use `hypothesis` for data model validation (e.g., testing Claim serialization round-trips).

13. **Add documentation generation** — Use Sphinx or MkDocs for API documentation given the clean module structure.

## Comparison to Gold Standards

| Dimension | rhai-wiki | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| CI/CD Pipeline | ❌ None | ✅ Multi-workflow | ✅ Complex matrix | ✅ Comprehensive |
| Unit Tests | ✅ 296 tests | ✅ Extensive Jest | ✅ Python tests | ✅ Go testing |
| Integration Tests | ⚠️ 2 files | ✅ Cypress E2E | ✅ Image validation | ✅ envtest |
| Contract Tests | ✅ Adapter contracts | ✅ API contracts | N/A | ✅ CRD validation |
| Coverage Tracking | ❌ None | ✅ Codecov enforced | ⚠️ Limited | ✅ Codecov enforced |
| Linting | ⚠️ mypy only | ✅ ESLint + Prettier | ✅ Ruff | ✅ golangci-lint |
| Pre-commit | ❌ None | ✅ Configured | ✅ Configured | ✅ Configured |
| Security Scanning | ❌ None | ✅ Trivy + CodeQL | ✅ Trivy | ✅ CodeQL + gosec |
| Agent Rules | ⚠️ Skills only | ✅ Rules + skills | ⚠️ Limited | ❌ None |
| Image Testing | N/A | ✅ Multi-layer | ✅ 5-layer validation | ✅ Multi-arch |

## File Paths Reference

| File | Purpose |
|------|---------|
| `pyproject.toml` | Project config — strict mypy, pytest + mypy dev deps |
| `CLAUDE.md` | Developer instructions for uv tool runner |
| `ingestion-config.json` | Source definitions for the pipeline |
| `schema/canonical-weights.json` | Source priority weighting policy |
| `src/adapters/base.py` | SourceAdapter ABC — contract root |
| `tests/contract/test_adapter_contract.py` | Adapter interface compliance |
| `tests/unit/test_pipeline.py` | Largest test file (1,366 LOC) |
| `.claude/skills/` | 22 Claude Code skills for pipeline ops |
| `.python-version` | Python 3.14 |
| `uv.lock` | Dependency lockfile |

## Summary

rhai-wiki has a **surprisingly mature test suite** for an internal knowledge pipeline — 296 test functions, three test layers (unit/integration/contract), and strict mypy. However, this quality foundation is **completely undermined by the absence of any CI/CD infrastructure**. The tests exist but never run automatically. Adding a basic GitHub Actions workflow that executes the existing test suite would immediately move the overall score from 4.5 to ~6.5. Combined with coverage tracking and ruff linting (total effort: ~6-8 hours), the score would reach ~7.5.

The project's zero-dependency runtime (stdlib only) is a security strength, and the 22 Claude Code skills demonstrate investment in developer tooling. The main gaps are all infrastructure — CI/CD, coverage, linting, and security scanning — rather than test quality.
