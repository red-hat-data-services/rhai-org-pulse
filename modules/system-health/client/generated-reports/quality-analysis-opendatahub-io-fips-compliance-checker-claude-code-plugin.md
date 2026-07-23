---
repository: "opendatahub-io/fips-compliance-checker-claude-code-plugin"
overall_score: 2.0
scorecard:
  - dimension: "Unit Tests"
    score: 4.0
    status: "Basic bash integration test with 10 test cases but no per-component unit tests"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "Single integration test script with compliant/violating fixtures, not automated"
  - dimension: "Build Integration"
    score: 1.0
    status: "No CI/CD build validation, no Makefile, no build automation"
  - dimension: "Image Testing"
    score: 2.0
    status: "Uses containerized Bandit but no image testing for plugin itself"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tracking or configuration of any kind"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "No CI/CD workflows exist — zero automation"
  - dimension: "Static Analysis"
    score: 1.0
    status: "No linting (shellcheck/shfmt), no Dependabot, no pre-commit hooks"
  - dimension: "Agent Rules"
    score: 7.0
    status: "Comprehensive CLAUDE.md, detailed agent definition and slash command"
critical_gaps:
  - title: "No CI/CD automation — tests never run automatically"
    impact: "Regressions can be introduced silently; no PR-time quality gates"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No coverage tracking for bash or Python scanning logic"
    impact: "No visibility into which code paths are exercised by tests"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No static analysis for shell scripts"
    impact: "Shell script bugs (unquoted variables, incorrect flags, portability issues) go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No Dependabot or Renovate for container image updates"
    impact: "Bandit container image (ghcr.io/pycqa/bandit/bandit:latest) could silently break or gain CVEs"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add a GitHub Actions workflow with shellcheck + test execution"
    effort: "2-4 hours"
    impact: "Catch regressions on every PR, enforce shell script quality"
  - title: "Add .pre-commit-config.yaml with shellcheck and shfmt"
    effort: "1-2 hours"
    impact: "Consistent formatting and bug detection for all 5 bash scripts"
  - title: "Enable Dependabot for Docker ecosystem"
    effort: "30 minutes"
    impact: "Automated PRs when Bandit container image updates"
  - title: "Add ShellSpec or BATS for per-function unit testing"
    effort: "4-6 hours"
    impact: "Test individual library functions (context-analyzer, check-dependencies) in isolation"
recommendations:
  priority_0:
    - "Create GitHub Actions CI workflow to run tests on every PR"
    - "Add shellcheck linting for all bash scripts (~1,564 lines of shell)"
    - "Add Dependabot configuration for container image updates"
  priority_1:
    - "Add unit tests for individual library scripts using BATS or ShellSpec"
    - "Add bash coverage tracking with bashcov or kcov"
    - "Create pre-commit hooks for shell script quality"
  priority_2:
    - "Add Dockerfile for the plugin scanner itself for reproducible execution"
    - "Add multi-arch testing for container runtime compatibility"
    - "Create .claude/rules/ directory with test creation guidelines"
---

# Quality Analysis: fips-compliance-checker-claude-code-plugin

## Executive Summary

- **Overall Score: 2.0/10**
- **Repository Type**: Claude Code plugin (bash-based FIPS compliance scanner)
- **Primary Language**: Bash (~1,564 lines across 5 scripts), with Python test fixtures
- **Jira**: RHOAIENG / AI Core Platform Security (midstream)
- **Key Strengths**: Well-structured Claude Code plugin with comprehensive agent definition, thorough FIPS scanning patterns, and good test fixture design
- **Critical Gaps**: Zero CI/CD automation, no static analysis, no coverage tracking — the repository relies entirely on manual test execution
- **Agent Rules Status**: Present and well-structured (CLAUDE.md, agent/command definitions)

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 4.0/10 | 15% | 0.60 | Basic integration test with 10 cases, no per-component unit tests |
| Integration/E2E | 3.0/10 | 20% | 0.60 | Single test script with fixtures, not automated in CI |
| Build Integration | 1.0/10 | 15% | 0.15 | No CI/CD build validation, no Makefile |
| Image Testing | 2.0/10 | 10% | 0.20 | Uses containerized Bandit, no plugin image testing |
| Coverage Tracking | 0.0/10 | 10% | 0.00 | Completely absent |
| CI/CD Automation | 0.0/10 | 15% | 0.00 | No workflows exist |
| Static Analysis | 1.0/10 | 10% | 0.10 | No shellcheck, no linting, no dependency alerts |
| Agent Rules | 7.0/10 | 5% | 0.35 | Good CLAUDE.md with agent definition and development guidelines |
| **Overall** | **2.0/10** | **100%** | **2.00** | |

## Critical Gaps

### 1. No CI/CD Automation — Tests Never Run Automatically
- **Impact**: Regressions can be introduced silently; contributors have no feedback on PR quality
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The repository has zero CI/CD configuration — no `.github/workflows/`, no `.gitlab-ci.yml`, no `Makefile` test targets. The existing integration test (`tests/test-python-scanner.sh`) must be run manually. The README documents example CI configurations (GitHub Actions, GitLab CI) but none are actually implemented for this repository itself.

### 2. No Coverage Tracking
- **Impact**: No visibility into which code paths are exercised by the 10 existing tests
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: No `.codecov.yml`, no coverage tooling. For bash scripts, tools like `kcov` or `bashcov` can provide coverage. The scanner has 1,564 lines of bash across 5 scripts — significant enough to benefit from coverage metrics.

### 3. No Static Analysis for Shell Scripts
- **Impact**: Shell script bugs — unquoted variables, incorrect flags, portability issues, and common bash pitfalls — go undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: None of the 5 bash scripts (`scan-python-fips.sh`, `check-dependencies.sh`, `analyze-source.sh`, `check-patterns.sh`, `context-analyzer.sh`) are validated by shellcheck or shfmt. No `.pre-commit-config.yaml` exists. No Dependabot/Renovate to track the Bandit container image.

### 4. No Per-Component Unit Tests
- **Impact**: Individual library functions (context analyzer, dependency checker, pattern matcher) are only tested indirectly through the integration test
- **Severity**: MEDIUM
- **Effort**: 6-10 hours
- **Details**: The `context-analyzer.sh` exports 9 functions (`is_test_file`, `is_example_file`, `calculate_production_likelihood`, etc.) that are tested only indirectly. A function-level regression in any of these could go undetected.

## Quick Wins

### 1. Add GitHub Actions CI Workflow (2-4 hours)
Create `.github/workflows/ci.yml` to run tests and shellcheck on every PR:

```yaml
name: CI
on: [push, pull_request]
jobs:
  shellcheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run shellcheck
        uses: ludeeus/action-shellcheck@master
        with:
          scandir: './scripts'
          additional_files: 'tests/test-python-scanner.sh'

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: sudo apt-get install -y jq
      - name: Run integration tests
        run: ./tests/test-python-scanner.sh
```

### 2. Add Pre-commit Hooks (1-2 hours)
Create `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/koalaman/shellcheck-precommit
    rev: v0.10.0
    hooks:
      - id: shellcheck
        args: ['-x']
  - repo: https://github.com/scop/pre-commit-shfmt
    rev: v3.8.0-1
    hooks:
      - id: shfmt
```

### 3. Enable Dependabot (30 minutes)
Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "docker"
    directory: "/scripts/python"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 4. Add ShellSpec or BATS Unit Tests (4-6 hours)
Add per-function tests for the context analyzer:

```bash
# tests/unit/test-context-analyzer.bats
@test "is_test_file detects tests/ directory" {
  source scripts/python/lib/context-analyzer.sh
  run is_test_file "tests/test_crypto.py"
  [ "$status" -eq 0 ]
}

@test "is_test_file rejects src/ directory" {
  source scripts/python/lib/context-analyzer.sh
  run is_test_file "src/auth.py"
  [ "$status" -eq 1 ]
}
```

## Detailed Findings

### Unit Tests

**Score: 4.0/10**

**What exists:**
- `tests/test-python-scanner.sh` — 273-line bash integration test with 10 test cases:
  1. Scanner script exists and is executable
  2. Violating project scan detects violations
  3. Detects pycryptodome in dependencies
  4. Detects MD5 usage in source code
  5. Context metadata is present in findings
  6. Test code is marked as non-production
  7. `usedforsecurity=False` detected as lower severity
  8. Compliant project has minimal/no violations
  9. Scanner outputs valid JSON
  10. Scanner returns correct exit codes
- Test fixtures: two well-structured Python projects (`violating_project/` and `compliant_project/`) with realistic code samples

**What's missing:**
- No unit tests for individual library scripts:
  - `context-analyzer.sh` (238 lines, 9 exported functions) — untested in isolation
  - `check-dependencies.sh` (198 lines) — untested in isolation
  - `check-patterns.sh` (366 lines) — untested in isolation
  - `analyze-source.sh` (400 lines) — untested in isolation
- No test framework (raw bash assertions, not BATS/ShellSpec)
- Test-to-code ratio: 1 test file vs 5 source scripts
- No edge case testing (malformed input, empty projects, very large codebases)

### Integration/E2E Tests

**Score: 3.0/10**

**What exists:**
- The test script runs the full scanner pipeline end-to-end
- Tests both positive detection (violations found) and negative cases (compliant project passes)
- Validates JSON output structure and exit codes
- Tests false-positive detection (`usedforsecurity=False`)

**What's missing:**
- Tests are not automated (no CI execution)
- No multi-version testing (different bash versions, different jq versions)
- No container runtime testing (both podman and docker paths)
- No testing of the `--exclude`, `--config`, or `--text` options
- No testing of edge cases (missing jq, missing container runtime, permission errors)
- No testing of the Bandit integration layer (Layer 2) with real Bandit output
- No performance/scale testing

### Build Integration

**Score: 1.0/10**

**What exists:**
- The scanner scripts are self-contained and don't require a build step
- README documents example CI/CD integration patterns

**What's missing:**
- No `Makefile` with test/lint targets
- No CI/CD workflow to validate the plugin works
- No PR-time validation
- No automated release process
- No plugin packaging or distribution automation

### Image Testing

**Score: 2.0/10**

**What exists:**
- The scanner uses `ghcr.io/pycqa/bandit/bandit:latest` container image
- Container runtime detection supports both podman and docker
- SELinux-compatible volume mounting (`:Z` flag)

**What's missing:**
- No Dockerfile for the plugin scanner itself
- No image startup validation
- No multi-arch testing
- No pinned version of the Bandit container image (uses `:latest`)
- No health checks or container validation

### Coverage Tracking

**Score: 0.0/10**

Completely absent. No coverage tooling, no coverage configuration, no coverage reporting.

**Recommended tools:**
- `kcov` for bash script coverage
- `bashcov` for SimpleCov-based bash coverage
- Codecov or Coveralls integration for reporting

### CI/CD Automation

**Score: 0.0/10**

No CI/CD exists. The repository has:
- No `.github/workflows/` directory
- No `.gitlab-ci.yml`
- No `Makefile`
- No `Taskfile.yml`
- No `Jenkinsfile`

The README includes example CI configurations (GitHub Actions and GitLab CI) for projects that USE the scanner, but the scanner repository itself has zero automation.

### Static Analysis

**Score: 1.0/10**

#### Linting
- No shellcheck configuration — the primary codebase is ~1,564 lines of bash across 5 scripts
- No shfmt for consistent formatting
- No yamllint for the YAML pattern files

#### FIPS Compatibility
- Not applicable for this repository (the tool IS the FIPS scanner)
- The plugin uses bash scripts; no cryptographic operations in the tool itself

#### Dependency Alerts
- No `.github/dependabot.yml` — the Bandit container image (`ghcr.io/pycqa/bandit/bandit:latest`) is unpinned
- No Renovate configuration
- No automated alerts for security vulnerabilities in the external container image dependency

### Agent Rules

**Score: 7.0/10**

**What exists:**
- `CLAUDE.md` (158 lines) — comprehensive plugin documentation including:
  - Repository structure overview
  - Agent and command component descriptions
  - Development guidelines for modifying the agent
  - Instructions for adding scanning capabilities
  - Test execution instructions
  - Agent prompt format specification
- `agents/fips-compliance-checker.md` (474 lines) — detailed agent definition with:
  - Clear invocation triggers with user/assistant dialogue examples
  - 5-phase scanning process (Dependency, Source Code, Configuration, Integration, Report)
  - Comprehensive output format with JSON schema
  - Quality assurance checklist
  - Suppression handling via CLAUDE.md
- `commands/fips-scan.md` — slash command definition
- `.claude-plugin/plugin.json` — plugin metadata

**What's missing:**
- No `.claude/rules/` directory with test creation rules
- No `.claude/skills/` for custom skills
- No `AGENTS.md` (but `CLAUDE.md` covers this)
- Agent rules don't include guidance for contributing tests to the scanner itself

## Recommendations

### Priority 0 (Critical)

1. **Create GitHub Actions CI workflow** — Run `shellcheck` and `tests/test-python-scanner.sh` on every PR. This is the single highest-impact improvement.

2. **Add shellcheck linting for all bash scripts** — The 5 scripts total ~1,564 lines. Shellcheck catches common bugs (unquoted variables, `set -e` pitfalls, portability issues).

3. **Pin the Bandit container image version** — Replace `ghcr.io/pycqa/bandit/bandit:latest` with a pinned version tag. Add Dependabot to manage updates.

### Priority 1 (High Value)

4. **Add per-component unit tests using BATS** — The `context-analyzer.sh` has 9 exported functions that are tested only indirectly. BATS tests would catch regressions in file-type detection, production likelihood scoring, and context JSON generation.

5. **Add bash coverage tracking with kcov** — Integrate kcov into CI to measure which code paths the tests exercise. Set minimum coverage thresholds.

6. **Create `.pre-commit-config.yaml`** — Add shellcheck and shfmt hooks for consistent quality on every commit.

### Priority 2 (Nice-to-Have)

7. **Create a Dockerfile for reproducible scanner execution** — Package the scanner with all dependencies (jq, bash 4+) for consistent execution across environments.

8. **Add testing for the `--exclude` and `--config` CLI options** — These code paths are currently untested.

9. **Add `.claude/rules/` with test creation guidelines** — Provide specific rules for contributors writing tests for new scanning capabilities.

## Comparison to Gold Standards

| Feature | fips-compliance-checker | odh-dashboard | notebooks | kserve |
|---------|------------------------|---------------|-----------|--------|
| CI/CD Workflows | None | Comprehensive | Comprehensive | Comprehensive |
| Unit Tests | 1 integration test | Extensive (Jest/Cypress) | Layer-based | Go testing + envtest |
| Coverage Tracking | None | Codecov with enforcement | Present | Codecov enforcement |
| Static Analysis | None | ESLint + TypeScript strict | ShellCheck | golangci-lint |
| Pre-commit Hooks | None | Present | Present | Present |
| Dependency Alerts | None | Dependabot | Dependabot | Dependabot |
| Agent Rules | CLAUDE.md + agent def | CLAUDE.md + rules | CLAUDE.md | CLAUDE.md |

## File Paths Reference

| Category | Files |
|----------|-------|
| Plugin Config | `.claude-plugin/plugin.json` |
| Agent Definition | `agents/fips-compliance-checker.md` |
| Slash Command | `commands/fips-scan.md` |
| Main Scanner | `scripts/python/scan-python-fips.sh` |
| Scanner Libraries | `scripts/python/lib/check-dependencies.sh`, `scripts/python/lib/analyze-source.sh`, `scripts/python/lib/check-patterns.sh`, `scripts/python/lib/context-analyzer.sh` |
| Pattern Data | `scripts/python/patterns/prohibited-packages.txt`, `scripts/python/patterns/prohibited-imports.txt`, `scripts/python/patterns/approved-algorithms.json` |
| Integration Tests | `tests/test-python-scanner.sh` |
| Test Fixtures | `tests/fixtures/python/violating_project/`, `tests/fixtures/python/compliant_project/` |
| Config Example | `scripts/python/.fips-compliance.yaml.example` |
| Documentation | `README.md`, `CLAUDE.md`, `scripts/python/README.md` |
