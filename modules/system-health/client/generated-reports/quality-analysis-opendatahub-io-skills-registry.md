---
repository: "opendatahub-io/skills-registry"
overall_score: 6.4
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Solid unittest suite covering all scripts with 0.32 test-to-code ratio"
  - dimension: "Integration/E2E"
    score: 5.0
    status: "Pre-commit hooks test local flow; no end-to-end marketplace install tests"
  - dimension: "Build Integration"
    score: 3.0
    status: "No container builds or deployment validation — registry is metadata-only"
  - dimension: "Image Testing"
    score: 0.0
    status: "N/A — no container images built by this repository"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "No coverage measurement, no codecov, no coverage thresholds"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "Well-organized workflows with diff-aware validation, artifact sync checks, and site deployment"
  - dimension: "Agent Rules"
    score: 8.0
    status: "Comprehensive CLAUDE.md with commands, architecture, and key rules; two skills; eval harness"
critical_gaps:
  - title: "No test coverage tracking or enforcement"
    impact: "Cannot detect coverage regressions; new scripts may lack tests entirely"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No integration test for marketplace install round-trip"
    impact: "Schema or sync bugs may pass CI but break Claude Code plugin installation"
    severity: "HIGH"
    effort: "6-8 hours"
  - title: "No security scanning (SAST, dependency, secret detection)"
    impact: "Vulnerable dependencies or leaked secrets could ship undetected"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "Missing linter configuration for Python scripts"
    impact: "Code style inconsistencies and potential bugs go uncaught"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add coverage.py and codecov to validate.yml"
    effort: "2-3 hours"
    impact: "Immediate visibility into test coverage and trend tracking"
  - title: "Add ruff linter to pre-commit and CI"
    effort: "1 hour"
    impact: "Catch Python style issues and potential bugs automatically"
  - title: "Add Dependabot or Renovate for dependency updates"
    effort: "30 minutes"
    impact: "Automated security updates for pyyaml, jsonschema, and mkdocs dependencies"
  - title: "Add GitHub CodeQL or Semgrep scanning"
    effort: "1 hour"
    impact: "Detect injection vulnerabilities in registry validation scripts"
recommendations:
  priority_0:
    - "Add coverage.py tracking with codecov integration and minimum threshold (e.g., 80%)"
    - "Add end-to-end integration test that validates marketplace.json can be consumed by a Claude Code mock"
  priority_1:
    - "Add ruff or flake8 linting to pre-commit hooks and CI workflow"
    - "Add Dependabot for automated dependency updates"
    - "Add security scanning (CodeQL or Semgrep) for Python scripts"
  priority_2:
    - "Add type annotations and mypy checking to scripts/"
    - "Add mutation testing (mutmut) to measure test suite effectiveness"
    - "Create .claude/rules/ directory with test creation guidelines"
---

# Quality Analysis: skills-registry

## Executive Summary

- **Overall Score: 6.4/10**
- **Repository Type**: Python metadata registry / plugin marketplace
- **Primary Language**: Python 3.12 (scripts + tests), YAML/JSON (data)
- **Framework**: Custom registry with JSON Schema validation, MkDocs site generator
- **Key Strengths**: Well-structured CI pipeline with diff-aware validation, strong JSON Schema enforcement, good test coverage of validation logic, comprehensive CLAUDE.md documentation, evaluation harness for diagram feedback
- **Critical Gaps**: No coverage tracking, no security scanning, no Python linting, no integration testing of the actual marketplace consumption path
- **Agent Rules Status**: Present and comprehensive (CLAUDE.md with commands, architecture, key rules)

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | Solid unittest suite covering all 6 scripts with security-focused edge cases |
| Integration/E2E | 5.0/10 | Pre-commit hooks validate local flow; no E2E marketplace install testing |
| **Build Integration** | **3.0/10** | **No container or deployment validation — registry is metadata-only** |
| Image Testing | N/A | No container images built by this repository |
| Coverage Tracking | 2.0/10 | No coverage measurement, no codecov, no thresholds |
| CI/CD Automation | 8.5/10 | 4 workflows, diff-aware validation, artifact sync checks, Pages deployment |
| Agent Rules | 8.0/10 | Comprehensive CLAUDE.md, 2 skills, eval harness for diagram quality |

## Critical Gaps

### 1. No Test Coverage Tracking or Enforcement
- **Impact**: Cannot detect coverage regressions; new scripts (e.g., `discover_skills.py`, `extract_diagram_feedback.py`, `sync_drawio_from_svg.py`, `check_versions.py`) may ship without any tests
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Of the 11 scripts in `scripts/`, only 6 have corresponding test files. `discover_skills.py` (217 lines), `check_versions.py` (130 lines), `sync_drawio_from_svg.py` (128 lines), `extract_diagram_feedback.py` (139 lines), and `sync_marketplace.py` (120 lines) have no dedicated test files.

### 2. No Integration Test for Marketplace Install Round-Trip
- **Impact**: A valid `registry.yaml` could produce a `marketplace.json` that Claude Code cannot parse. Schema validation catches structural issues but not semantic consumption issues.
- **Severity**: HIGH
- **Effort**: 6-8 hours
- **Details**: CI validates that generated files are in sync, but never validates that the generated `marketplace.json` can be successfully consumed by a client. A mock consumer test would close this gap.

### 3. No Security Scanning
- **Impact**: Vulnerable Python dependencies (pyyaml, jsonschema, mkdocs stack) could ship undetected. Scripts that shell out to `git` and process untrusted registry data have injection surface.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: No CodeQL, Semgrep, Dependabot, or Snyk configured. The Unicode safety check is a good start but only covers homoglyph attacks.

### 4. No Python Linter Configuration
- **Impact**: Code style inconsistencies and potential bugs in the 3,189 lines of Python scripts go uncaught
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: No `ruff.toml`, `.flake8`, `pylintrc`, or `mypy.ini` found. Pre-commit hooks only run registry-specific validators, not general Python linting.

## Quick Wins

### 1. Add coverage.py and Codecov Integration (2-3 hours)
- **Impact**: Immediate visibility into coverage gaps and trend tracking
- **Implementation**:
```yaml
# Add to validate.yml after "Run unit tests" step
- name: Run unit tests with coverage
  run: |
    pip install coverage
    python3 -m coverage run -m unittest discover -s tests -p 'test_*.py'
    python3 -m coverage report --fail-under=70
    python3 -m coverage xml

- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    file: coverage.xml
```

### 2. Add Ruff Linter (1 hour)
- **Impact**: Fast Python linting and formatting enforcement
- **Implementation**:
```yaml
# .pre-commit-config.yaml addition
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
      - id: ruff-format
```

### 3. Add Dependabot (30 minutes)
- **Impact**: Automated security updates for all Python dependencies
- **Implementation**:
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: pip
    directory: /
    schedule:
      interval: weekly
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

### 4. Add CodeQL Security Scanning (1 hour)
- **Impact**: Detect injection vulnerabilities in subprocess calls
- **Implementation**:
```yaml
# .github/workflows/codeql.yml
name: CodeQL Analysis
on:
  push:
    branches: [main]
  pull_request:
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: python
      - uses: github/codeql-action/analyze@v3
```

## Detailed Findings

### CI/CD Pipeline

**Strengths**:
- **4 well-organized workflows**: `validate.yml` (PR+push), `diagram-pr.yml` (SVG sync), `deploy-site.yml` (Pages), `unicode-safety.yml` (security)
- **Diff-aware validation**: The `validate.yml` workflow uses `--diff-base` to only enforce contract rules on touched skills, avoiding false positives on existing entries
- **Artifact sync verification**: CI regenerates `marketplace.json`, `catalog.md`, and site content, then fails if they differ — ensures contributors run scripts before pushing
- **Concurrency control**: `deploy-site.yml` uses `concurrency: { group: pages, cancel-in-progress: false }` to prevent race conditions
- **Pinned action SHAs**: All GitHub Actions use full commit SHA references (e.g., `actions/checkout@34e114876b...`) preventing supply-chain attacks
- **Eval data collection**: `diagram-pr.yml` extracts before/after pairs for evaluation datasets — shows commitment to measurable quality

**Gaps**:
- No caching of Python dependencies in `validate.yml` — `pip install` runs fresh each time
- No test parallelization (though with 6 test files, this is minor)
- No status badges in README for CI health
- No Makefile — common commands are documented in CLAUDE.md but not scripted

### Test Coverage

**Strengths**:
- **6 test files** with **1,023 lines** of test code covering **3,189 lines** of script code (0.32 ratio)
- **Security-focused testing**: Tests for path traversal (`../outside/SKILL.md`), symlink attacks, invalid git refs (`-oops`), and command injection prevention
- **Contract validation tests**: Thorough testing of JSON Schema validation rules, metric constraints, and source assertions
- **Bootstrap isolation test**: `test_script_bootstrap.py` verifies scripts prefer repo-root imports over PYTHONPATH poisoning — preventing supply-chain attacks
- **Framework**: Standard `unittest` with `unittest.mock` — no external test dependencies needed

**Gaps**:
- **5 scripts without dedicated tests**:
  - `discover_skills.py` (217 lines) — skill discovery logic untested
  - `check_versions.py` (130 lines) — version polling untested
  - `sync_drawio_from_svg.py` (128 lines) — SVG sync logic untested
  - `extract_diagram_feedback.py` (139 lines) — eval data extraction untested
  - `sync_marketplace.py` (120 lines) — marketplace generation partially tested via sync check but no unit tests
- **No coverage measurement** — impossible to know actual line/branch coverage
- **No mutation testing** — test suite effectiveness unknown
- **No parametrized tests** — many test methods repeat similar patterns that could be consolidated

### Code Quality

**Strengths**:
- **Pre-commit hooks**: Two local hooks (`validate-registry-contracts` and `skill-linter-registry`) run on `registry.yaml` changes
- **JSON Schema validation**: Comprehensive schema (`registry.schema.json`, 458 lines) with pattern constraints, conditional validation (`if/then`), and `additionalProperties: false`
- **Input sanitization in CI**: Base ref validation uses regex `^[A-Za-z0-9._/-]+$` to prevent injection
- **Unicode safety check**: Dedicated workflow to detect hidden unicode characters (homoglyph attacks)

**Gaps**:
- **No Python linter** — no ruff, flake8, pylint, or mypy configured
- **No type annotations** — scripts use dynamic typing throughout
- **No formatter** — no black or ruff-format configured
- **Pre-commit hooks are registry-specific only** — no general Python quality hooks

### Container Images

- **N/A**: This repository does not build container images. It is a pure metadata registry that generates JSON and Markdown files. No Dockerfile, Containerfile, or docker-compose found.

### Security

**Strengths**:
- **Unicode safety check**: Dedicated CI workflow using `dcondrey/unicode-safety-check@v3.0.0`
- **Pinned GitHub Action SHAs**: All actions use full 40-character commit SHAs, preventing tag-based supply chain attacks
- **Input validation in scripts**: Git refs validated against `^[A-Za-z0-9._/-]+$` pattern before use in subprocess calls
- **Path traversal prevention**: Tests explicitly verify that `../` paths and symlinks are rejected
- **Subprocess timeout enforcement**: All subprocess calls include explicit timeouts (30s)

**Gaps**:
- **No CodeQL or Semgrep**: Python code not scanned for injection patterns
- **No Dependabot or Renovate**: Dependencies (`pyyaml==6.0.3`, `jsonschema==4.26.0`, mkdocs stack) not automatically updated
- **No secret scanning**: No Gitleaks or TruffleHog configured
- **No OSSF Scorecard**: Not participating in OpenSSF security best practices

### Agent Rules (Agentic Flow Quality)

**Strengths**:
- **Comprehensive CLAUDE.md** (98 lines): Documents common commands, architecture overview, key rules (strict vs non-strict, marketplace format, agents), adding plugins workflow, and references
- **Two registered skills**: `analyze-plugin` and `generate-site` skills in `skills/` directory
- **Evaluation harness**: `eval/diagram-feedback/eval.yaml` defines layout quality evaluation with validator and judge-based scoring
- **Plugin architecture documentation**: `ARCHITECTURE.md` with ASCII diagrams showing data flow, plugin model, and CI pipeline
- **Contributing guide**: `CONTRIBUTING.md` with detailed instructions for adding plugins, choosing canonical contracts

**Gaps**:
- **No `.claude/rules/` directory**: No test creation rules for AI agents
- **No test pattern documentation**: CLAUDE.md doesn't describe testing conventions or how to write tests for new scripts
- **No `.claude/` directory at all**: Skills live in top-level `skills/` directory; no agent-specific configuration
- **Recommendation**: Generate test rules with `/test-rules-generator` to help AI agents write consistent tests

## Recommendations

### Priority 0 (Critical)

1. **Add coverage.py tracking with codecov integration and minimum threshold (e.g., 70%)**
   - Prevents coverage regressions on new scripts
   - Makes untested scripts visible immediately
   - Effort: 2-3 hours

2. **Write tests for the 5 untested scripts** (`discover_skills.py`, `check_versions.py`, `sync_drawio_from_svg.py`, `extract_diagram_feedback.py`, `sync_marketplace.py`)
   - These scripts total 734 lines with zero test coverage
   - Prioritize `sync_marketplace.py` (generates the file Claude Code actually consumes) and `discover_skills.py` (core discovery logic)
   - Effort: 8-12 hours

### Priority 1 (High Value)

3. **Add ruff linting and formatting to pre-commit and CI**
   - Fast, comprehensive Python linting
   - Effort: 1-2 hours

4. **Add Dependabot for dependency updates**
   - Automate security patches for pyyaml, jsonschema, mkdocs
   - Also cover GitHub Actions version updates
   - Effort: 30 minutes

5. **Add CodeQL or Semgrep security scanning**
   - Detect injection patterns in subprocess calls
   - Effort: 1-2 hours

6. **Create `.claude/rules/` with test creation guidelines**
   - Help AI agents write consistent, security-focused tests matching existing patterns
   - Use `/test-rules-generator` to bootstrap from existing test suite
   - Effort: 2-3 hours

### Priority 2 (Nice-to-Have)

7. **Add type annotations and mypy strict checking**
   - Improve code maintainability and catch type errors
   - Effort: 4-6 hours

8. **Add pip caching to CI workflow**
   - Speed up CI runs by caching pyyaml and jsonschema installs
   - Effort: 30 minutes

9. **Add integration test for marketplace.json consumption**
   - Mock a Claude Code client parsing the generated marketplace.json
   - Verify all required fields, skill discovery paths, and strict/non-strict semantics
   - Effort: 6-8 hours

10. **Add CI status badges to README.md**
    - Quick visibility into build health
    - Effort: 15 minutes

## Comparison to Gold Standards

| Dimension | skills-registry | odh-dashboard | notebooks | kserve |
|-----------|:-:|:-:|:-:|:-:|
| Unit Tests | 7.5 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 5.0 | 9.0 | 8.0 | 9.5 |
| Build Integration | 3.0 | 7.0 | 8.0 | 8.0 |
| Image Testing | N/A | 6.0 | 9.5 | 7.0 |
| Coverage Tracking | 2.0 | 8.0 | 5.0 | 9.0 |
| CI/CD Automation | 8.5 | 9.0 | 8.5 | 9.0 |
| Agent Rules | 8.0 | 8.5 | 3.0 | 2.0 |
| **Overall** | **6.4** | **8.4** | **7.3** | **7.6** |

**Key Takeaway**: skills-registry excels in CI automation and agent documentation but significantly lags in coverage tracking and integration testing. The security-conscious testing approach (path traversal, symlink, injection prevention) is notable and above average.

## File Paths Reference

### CI/CD
- `.github/workflows/validate.yml` — PR/push validation (schema, contracts, sync checks, unit tests)
- `.github/workflows/diagram-pr.yml` — SVG → draw.io sync on PR
- `.github/workflows/deploy-site.yml` — MkDocs site deployment to GitHub Pages
- `.github/workflows/unicode-safety.yml` — Hidden unicode character detection

### Testing
- `tests/test_validate_registry.py` — Schema and contract validation tests (443 lines)
- `tests/test_run_skill_linter.py` — Skill linter wrapper tests (237 lines)
- `tests/test_generate_site.py` — Site generation tests (136 lines)
- `tests/test_registry_contracts.py` — Touch detection and git read tests (115 lines)
- `tests/test_script_bootstrap.py` — PYTHONPATH poisoning resistance tests (51 lines)
- `tests/test_generate_catalog.py` — Catalog rendering tests (41 lines)
- `tests/registry_contract_fixtures.py` — Shared test fixtures (56 lines)

### Scripts (Source Code)
- `scripts/validate_registry.py` — Schema validation + contract checks (481 lines)
- `scripts/generate_site.py` — MkDocs site content generator (995 lines)
- `scripts/run_skill_linter.py` — Skill linter orchestration (449 lines)
- `scripts/generate_catalog.py` — catalog.md generator (286 lines)
- `scripts/registry_contracts.py` — Contract data model + diff detection (243 lines)
- `scripts/discover_skills.py` — Skill discovery from repos (217 lines) ⚠️ No tests
- `scripts/extract_diagram_feedback.py` — Eval data extraction (139 lines) ⚠️ No tests
- `scripts/check_versions.py` — Version polling (130 lines) ⚠️ No tests
- `scripts/sync_drawio_from_svg.py` — SVG to draw.io sync (128 lines) ⚠️ No tests
- `scripts/sync_marketplace.py` — marketplace.json generator (120 lines) ⚠️ No tests

### Quality Configuration
- `.pre-commit-config.yaml` — Local pre-commit hooks (registry-specific only)
- `schema/registry.schema.json` — JSON Schema for registry.yaml (458 lines)
- `config/skill-linter-registry.json` — Skill linter configuration

### Agent Rules & Documentation
- `CLAUDE.md` — Claude Code agent guidance (98 lines)
- `ARCHITECTURE.md` — Architecture documentation with diagrams
- `CONTRIBUTING.md` — Contributor guide with contract guidelines
- `skills/analyze-plugin/SKILL.md` — Plugin analysis skill
- `skills/generate-site/SKILL.md` — Site generation skill
- `eval/diagram-feedback/eval.yaml` — Diagram quality evaluation harness
