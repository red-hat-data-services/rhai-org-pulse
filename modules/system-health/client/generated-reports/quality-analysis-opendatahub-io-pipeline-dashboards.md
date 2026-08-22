---
repository: "opendatahub-io/pipeline-dashboards"
overall_score: 0.7
jira_project: "RHOAIENG"
jira_component: "AI Pipelines"
tier: "midstream"
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No test files found; single Python script has zero test coverage"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests; no test directories present"
  - dimension: "Build Integration"
    score: 0.0
    status: "No CI workflows, no Dockerfile, no build process of any kind"
  - dimension: "Image Testing"
    score: 0.0
    status: "No container images — static HTML site deployed via GitHub Pages"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling configured; no code to measure coverage on"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "No GitHub Actions workflows; manual git push is the only deploy mechanism"
  - dimension: "Static Analysis"
    score: 0.0
    status: "No linting, pre-commit hooks, or dependency alerting configured"
  - dimension: "Agent Rules"
    score: 4.0
    status: "Has .claude/skills/ with a custom pipeline-dashboard skill; no CLAUDE.md, no .claude/rules/"
critical_gaps:
  - title: "No CI/CD automation whatsoever"
    impact: "All changes are committed and pushed manually with no validation gate — broken HTML or Python errors ship to production (GitHub Pages)"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No tests for the data collection script"
    impact: "The 553-line collect_and_generate.py script handles Jira API calls, deduplication logic, and HTML generation with zero test coverage — regressions go undetected"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No HTML validation or linting"
    impact: "Malformed HTML can break the dashboard without any automated check catching it before deploy"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add a GitHub Actions workflow to validate index.html on PR"
    effort: "2-3 hours"
    impact: "Prevents broken HTML from reaching GitHub Pages; catches syntax errors before merge"
  - title: "Add basic pytest tests for deduplication and stage classification logic"
    effort: "4-6 hours"
    impact: "Protects the core business logic in collect_and_generate.py from regressions"
  - title: "Add a CLAUDE.md with project conventions"
    effort: "1 hour"
    impact: "Documents the repo purpose, skill usage, and contribution workflow for AI agents and new contributors"
  - title: "Add ruff linting for the Python script"
    effort: "1-2 hours"
    impact: "Catches common Python errors and enforces consistent code style"
recommendations:
  priority_0:
    - "Create a minimal GitHub Actions workflow (on push/PR to main) that validates the HTML and runs a Python syntax check on the script"
    - "Add unit tests for the deduplication and stage classification logic — this is the core business logic with the highest regression risk"
  priority_1:
    - "Add a ruff or flake8 configuration for the Python script"
    - "Create a CLAUDE.md documenting the repo's purpose, the pipeline-dashboard skill, and how to generate/publish the dashboard"
    - "Add .claude/rules/ with guidelines for modifying the dashboard skill and HTML template"
  priority_2:
    - "Configure Dependabot or Renovate (even though there are few dependencies, it sets the pattern for future growth)"
    - "Add a pre-commit configuration for HTML and Python validation"
    - "Consider adding a scheduled workflow that auto-generates and publishes the dashboard periodically"
---

# Quality Analysis: pipeline-dashboards

## Executive Summary

- **Overall Score: 0.7/10**
- **Repository**: [opendatahub-io/pipeline-dashboards](https://github.com/opendatahub-io/pipeline-dashboards)
- **Jira**: RHOAIENG / AI Pipelines (midstream)
- **Type**: Static HTML dashboard site (GitHub Pages)
- **Primary Languages**: Python (553 LOC), HTML (1 generated file)
- **Key Strengths**: Has a well-structured Claude Code skill with comprehensive references and a working data collection script
- **Critical Gaps**: No CI/CD, no tests, no linting, no build process — the repo has essentially zero quality infrastructure
- **Agent Rules Status**: Partial — has `.claude/skills/` but no `CLAUDE.md`, `AGENTS.md`, or `.claude/rules/`

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 0.0/10 | No test files found |
| Integration/E2E | 20% | 0.0/10 | No integration or E2E tests |
| Build Integration | 15% | 0.0/10 | No CI workflows or build process |
| Image Testing | 10% | 0.0/10 | No container images (static site) |
| Coverage Tracking | 10% | 0.0/10 | No coverage tooling |
| CI/CD Automation | 15% | 0.0/10 | No GitHub Actions workflows |
| Static Analysis | 10% | 0.0/10 | No linting or dependency alerts |
| Agent Rules | 5% | 4.0/10 | Custom skill present, no rules or CLAUDE.md |
| **Overall** | **100%** | **0.7/10** | **Critical quality infrastructure gaps** |

## Critical Gaps

### 1. No CI/CD Automation Whatsoever
- **Impact**: All changes are committed and pushed manually with no validation gate. Broken HTML or Python errors ship directly to the GitHub Pages production site.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The repository has no `.github/workflows/` directory. There are no GitHub Actions, no GitLab CI, no Makefile, no Jenkinsfile — nothing. The "deploy" process is simply `git push origin main`, which triggers GitHub Pages to serve the updated `index.html`.

### 2. No Tests for the Data Collection Script
- **Impact**: The `collect_and_generate.py` script (553 lines) is the core of this project. It handles Jira API authentication, paginated data collection, multi-pipeline deduplication, stage classification, and full HTML generation — all with zero test coverage.
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: The deduplication logic (`deduplicate()` function) and card/section builders contain complex business rules that are currently untested. A single change to label priority ordering could silently produce incorrect metrics on the public dashboard.

### 3. No HTML Validation or Linting
- **Impact**: Malformed HTML can break the dashboard rendering without any automated check.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours

## Quick Wins

### 1. Add a GitHub Actions Workflow for Basic Validation (2-3 hours)
Create `.github/workflows/validate.yml` that runs on PR/push to main:
```yaml
name: Validate
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: python3 -m py_compile .claude/skills/pipeline-dashboard/scripts/collect_and_generate.py
      - run: python3 -c "from html.parser import HTMLParser; HTMLParser().feed(open('index.html').read()); print('HTML valid')"
```

### 2. Add Unit Tests for Core Logic (4-6 hours)
Extract the `deduplicate()` function and card builders into testable modules, then add pytest tests covering:
- Deduplication with overlapping labels
- Stage classification priority ordering
- Success rate / quality rate calculations
- Edge cases (empty pipelines, missing labels)

### 3. Add a CLAUDE.md (1 hour)
Document the repo purpose, how to use the pipeline-dashboard skill, and contribution guidelines.

### 4. Add Ruff Linting (1-2 hours)
```toml
# ruff.toml
line-length = 120
target-version = "py311"
```

## Detailed Findings

### Unit Tests
- **Score: 0.0/10**
- No test files found anywhere in the repository
- No `tests/`, `test/`, or `*_test.py` files
- No `pytest.ini`, `pyproject.toml` test config, or `tox.ini`
- The only Python file (`collect_and_generate.py`, 553 lines) contains testable business logic (deduplication, stage classification, metric calculation) with zero coverage

### Integration/E2E Tests
- **Score: 0.0/10**
- No `e2e/` or `integration/` directories
- No end-to-end testing of the dashboard generation pipeline
- No validation that the generated HTML matches expected structure
- No smoke tests that verify the Jira API integration works

### Build Integration
- **Score: 0.0/10**
- No CI workflows of any kind
- No Dockerfile or Containerfile (not applicable — static HTML site)
- No Makefile or build scripts
- No PR-time validation gates
- The "build" process is the Python script generating HTML, which runs manually

### Image Testing
- **Score: 0.0/10**
- Not applicable — this is a static HTML site served by GitHub Pages
- No container images are built or deployed
- This dimension is structurally N/A for this repository type, but scored as 0 per the framework

### Coverage Tracking
- **Score: 0.0/10**
- No `.codecov.yml` or `coveralls.yml`
- No `pytest-cov` or `--coverprofile` usage
- No coverage thresholds or PR coverage reporting
- No coverage measurement of any kind

### CI/CD Automation
- **Score: 0.0/10**
- No `.github/workflows/` directory
- No CI configuration files (no `.gitlab-ci.yml`, `Jenkinsfile`, or `Taskfile.yml`)
- No automated deployment — relies on GitHub Pages auto-deploy from the `main` branch
- No concurrency control, caching strategies, or test parallelization
- The deployment model is: manual `git push` → GitHub Pages serves updated `index.html`

### Static Analysis

#### Linting
- No Python linter configured (no `ruff.toml`, `.flake8`, `mypy.ini`, or `pyproject.toml` with lint config)
- No HTML linter or formatter
- No pre-commit hooks (`.pre-commit-config.yaml` absent)

#### FIPS Compatibility
- Not applicable — the Python script only uses `base64`, `json`, `html`, `urllib` standard library modules
- No cryptographic operations performed
- No custom crypto imports detected

#### Dependency Alerts
- No `.github/dependabot.yml` configured
- No `renovate.json` or `.renovaterc`
- The script has no external dependencies (pure stdlib), so the risk is lower, but no alerting is in place for future additions

### Agent Rules
- **Score: 4.0/10**
- **`.claude/skills/pipeline-dashboard/`**: Well-structured custom skill with:
  - `SKILL.md` — comprehensive skill documentation (164 lines)
  - `scripts/collect_and_generate.py` — data collection and HTML generation
  - `references/` — 8 reference files covering pipeline definitions, HTML template, discovery sources, and component onboarding
- **Missing**:
  - No `CLAUDE.md` or `AGENTS.md` at root — no project-level guidance for AI agents
  - No `.claude/rules/` directory — no test creation rules, contribution guidelines, or coding standards
  - Skill is well-documented but lacks quality gates and testing guidance

## Recommendations

### Priority 0 (Critical)
1. **Create a minimal GitHub Actions validation workflow** — Even a simple workflow that checks Python syntax and HTML validity would catch the most common errors before they reach production
2. **Add unit tests for the deduplication and stage classification logic** — This is the highest-risk code in the repo, handling complex label-to-stage mapping with priority ordering

### Priority 1 (High Value)
3. **Add ruff or flake8 configuration** for the Python script to catch common errors
4. **Create a `CLAUDE.md`** documenting repo purpose, skill usage, and contribution workflow
5. **Add `.claude/rules/`** with guidelines for modifying the dashboard skill and HTML template

### Priority 2 (Nice-to-Have)
6. **Configure Dependabot** (even with no external deps today, it sets the pattern)
7. **Add pre-commit configuration** for HTML and Python validation
8. **Consider a scheduled workflow** that auto-generates and publishes the dashboard periodically, replacing the manual process

## Comparison to Gold Standards

| Dimension | pipeline-dashboards | odh-dashboard (Gold) | notebooks (Gold) | Gap |
|-----------|:-------------------:|:--------------------:|:-----------------:|:---:|
| Unit Tests | 0/10 | 9/10 | 7/10 | Critical |
| Integration/E2E | 0/10 | 9/10 | 8/10 | Critical |
| Build Integration | 0/10 | 8/10 | 8/10 | Critical |
| Image Testing | 0/10 (N/A) | 7/10 | 9/10 | N/A |
| Coverage Tracking | 0/10 | 8/10 | 6/10 | Critical |
| CI/CD Automation | 0/10 | 9/10 | 8/10 | Critical |
| Static Analysis | 0/10 | 7/10 | 6/10 | Critical |
| Agent Rules | 4/10 | 8/10 | 3/10 | Moderate |
| **Overall** | **0.7/10** | **8.2/10** | **7.0/10** | **Critical** |

**Context**: This is a very small, single-purpose repository (static HTML dashboard) with minimal code. The gold standard comparison is somewhat unfair given the repo's size, but the complete absence of any quality infrastructure — not even a basic CI workflow — represents a clear gap regardless of project scale.

## File Paths Reference

| File | Purpose |
|------|---------|
| `index.html` | Generated HTML dashboard (the "product") |
| `.claude/skills/pipeline-dashboard/SKILL.md` | Claude Code skill documentation |
| `.claude/skills/pipeline-dashboard/scripts/collect_and_generate.py` | Jira data collection + HTML generation (553 LOC) |
| `.claude/skills/pipeline-dashboard/references/*.md` | 8 reference files for pipeline definitions |
