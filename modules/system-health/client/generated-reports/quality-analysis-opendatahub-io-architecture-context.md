---
repository: "opendatahub-io/architecture-context"
overall_score: 1.7
scorecard:
  - dimension: "Unit Tests"
    score: 1.0
    status: "1 conditional Python test, 0 Go tests across 5330 LoC"
  - dimension: "Integration/E2E"
    score: 1.0
    status: "No integration tests; smoke test only validates binary startup"
  - dimension: "Build Integration"
    score: 4.0
    status: "CI builds Go binary with smoke test; no container builds or Konflux simulation"
  - dimension: "Image Testing"
    score: 1.0
    status: "N/A — repo produces Go binaries, not container images"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage generation, no codecov, no thresholds"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "5 lint jobs + build + smoke + release automation, but no test job"
  - dimension: "Agent Rules"
    score: 5.0
    status: "10 Claude skills for architecture generation, but no test rules or CLAUDE.md"
critical_gaps:
  - title: "Zero Go test coverage across 5,330 lines of code"
    impact: "Regressions in markdown parser, loader, overlay logic, and 14 CLI commands go undetected"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "Only 1 Python test (conditional) for 9,163 lines of library code"
    impact: "All pipeline phases, lint scripts, manifest parsing, and component discovery are untested"
    severity: "HIGH"
    effort: "20-30 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Cannot measure or enforce test quality; regressions accumulate silently"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "CI has no test execution step"
    impact: "The existing test_strace_agent.py never runs in CI; go test ./... runs but has 0 tests"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No SAST, dependency scanning, or vulnerability scanning"
    impact: "Security vulnerabilities in Python/Go dependencies or source code go undetected"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add pytest execution to CI workflow"
    effort: "1 hour"
    impact: "Ensures existing and future Python tests run on every PR"
  - title: "Add Go unit tests for internal/markdown/parser.go (394 LoC)"
    effort: "4-6 hours"
    impact: "The markdown parser is the core data pipeline; testing it prevents architecture doc corruption"
  - title: "Add codecov integration with baseline threshold"
    effort: "2 hours"
    impact: "Establishes coverage tracking and prevents regression"
  - title: "Pin all GitHub Actions to commit SHAs"
    effort: "1 hour"
    impact: "Prevents supply-chain attacks from compromised action versions"
  - title: "Add dependabot or renovate for dependency updates"
    effort: "1 hour"
    impact: "Automated security patch application for Go and Python dependencies"
recommendations:
  priority_0:
    - "Add Go unit tests for internal/markdown/parser.go, internal/loader/, and internal/overlay/ — these are the data processing core"
    - "Add Python unit tests for lib/manifest_parser.py, lib/component_discovery.py, and lib/build_info.py — these drive component discovery"
    - "Add pytest execution step to CI workflow to run existing and future tests"
    - "Add codecov integration with a 50% initial threshold, ratcheting upward"
  priority_1:
    - "Add integration tests for the lint scripts (lint_overlays.py, lint_platforms.py, lint_architecture_docs.py) with known-good and known-bad fixtures"
    - "Add CodeQL or gosec scanning for Go code security analysis"
    - "Add Python dependency scanning (pip-audit or safety)"
    - "Create CLAUDE.md with project-level development guidelines and testing standards"
  priority_2:
    - "Add pre-commit hooks for ruff + golangci-lint to catch issues before push"
    - "Add test rules to .claude/rules/ for consistent AI-generated test patterns"
    - "Add end-to-end pipeline tests that validate collect-architectures output format"
    - "Add Trivy scanning for Go binary dependencies"
---

# Quality Analysis: architecture-context

## Executive Summary

- **Overall Score: 1.7/10**
- **Repository Type**: Documentation/automation pipeline (Python CLI + Go CLI)
- **Languages**: Python (~9,163 LoC), Go (~5,330 LoC)
- **Key Strengths**: Comprehensive CI linting (5 lint jobs), multi-arch release automation, rich Claude skills library (10 skills), well-structured overlay validation
- **Critical Gaps**: Near-zero test coverage (1 conditional Python test, 0 Go tests), no coverage tracking, no security scanning, CI never runs tests
- **Agent Rules Status**: Partial — 10 `.claude/skills/` for architecture generation, but no CLAUDE.md, no `.claude/rules/` for testing patterns

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 1/10 | 1 conditional Python test, 0 Go tests across 5,330 LoC |
| Integration/E2E | 1/10 | No integration tests; smoke test only validates binary startup |
| **Build Integration** | **4/10** | **CI builds Go binary with smoke test; no container builds** |
| Image Testing | 1/10 | N/A — repo produces Go binaries, not container images |
| Coverage Tracking | 0/10 | No coverage generation, no codecov, no thresholds |
| CI/CD Automation | 5/10 | 5 lint jobs + build + smoke + release, but no test job |
| Agent Rules | 5/10 | 10 Claude skills present, but no CLAUDE.md or test rules |

## Critical Gaps

### 1. Zero Go Test Coverage (HIGH)
- **Impact**: The Go CLI (`arch-query`) has 5,330 lines across 32 files including a markdown parser (394 LoC), loader (351 LoC), overlay processor, JSON parser (286 LoC), and 14 cobra commands — all completely untested
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: The Makefile has a `test` target (`go test ./...`) but there are literally 0 `*_test.go` files in the entire `src/arch-query/` directory. The smoke test in CI only validates that the binary starts and produces output for a few commands — it doesn't verify correctness

### 2. Near-Zero Python Test Coverage (HIGH)
- **Impact**: 9,163 lines of Python library code across `lib/` (11 modules + 11 phase modules) and `scripts/` (8 scripts) have only 1 test file (`test_strace_agent.py`, 110 lines)
- **Severity**: HIGH
- **Effort**: 20-30 hours
- **Details**: The single test requires both `ANTHROPIC_API_KEY` and `strace` to be installed — it will be skipped in most CI environments. The `test_version_regex.py` in `scripts/` is a standalone script (not pytest), never runs in CI, and only tests one regex pattern. Critical modules like `manifest_parser.py` (353 LoC), `component_discovery.py` (276 LoC), `fetch.py` (705 LoC), and `webhook_analyzer.py` (1,430 LoC) have zero tests

### 3. CI Never Executes Tests (HIGH)
- **Impact**: The CI workflow (`ci.yml`) has no pytest or `go test` step. The `build` job runs `make build-embedded` and `make smoke-embedded`, but `smoke` is not a test — it's a manual verification that commands produce output
- **Severity**: HIGH
- **Effort**: 1-2 hours to add pytest step; Go tests need to exist first

### 4. No Coverage Tracking (HIGH)
- **Impact**: Cannot measure, enforce, or trend test coverage. No codecov.yml, no `.coveragerc`, no coverage flags in pytest or go test
- **Severity**: HIGH
- **Effort**: 2-4 hours

### 5. No Security Scanning (MEDIUM)
- **Impact**: No SAST (CodeQL/gosec), no dependency scanning (pip-audit/govulncheck), no secret detection (gitleaks). The unicode-safety check is the only security-related CI job
- **Severity**: MEDIUM
- **Effort**: 2-4 hours

## Quick Wins

### 1. Add pytest Execution to CI (1 hour)
- **Impact**: Ensures existing and future Python tests actually run
- **Implementation**: Add a new job to `ci.yml`:
```yaml
  test-python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v6
      - name: Run tests
        run: uv run pytest tests/ -v --tb=short
```

### 2. Add Go Unit Tests for Markdown Parser (4-6 hours)
- **Impact**: The `internal/markdown/parser.go` (394 LoC) is the core data pipeline that extracts structured data from architecture docs. Testing it prevents architecture corruption
- **Files**: `src/arch-query/internal/markdown/parser_test.go`

### 3. Add Codecov Integration (2 hours)
- **Impact**: Establishes coverage tracking with PR reporting
- **Implementation**: Add `.codecov.yml` and update CI to generate coverage reports

### 4. Pin All GitHub Actions to SHAs (1 hour)
- **Impact**: Some actions are pinned (`actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5`), others use tags (`actions/checkout@v4`). Pinning all prevents supply-chain attacks
- **Files**: `.github/workflows/ci.yml`, `.github/workflows/release.yml`

### 5. Add Dependabot or Renovate (1 hour)
- **Impact**: Automated dependency updates for Go modules and Python packages
- **Implementation**: Add `.github/dependabot.yml`

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory:**
| Workflow | Trigger | Jobs | Purpose |
|----------|---------|------|---------|
| `ci.yml` | push to main, PRs | 7 jobs | Linting (5 types) + build + smoke |
| `release.yml` | tag push `v*` | 2 jobs | Multi-arch binary build + GitHub release |
| `unicode-safety.yml` | PRs | 1 job | Detects hidden unicode characters |

**Strengths:**
- 5 independent lint jobs covering Python (ruff), Go (golangci-lint), overlays, platforms, and architecture docs
- Custom lint scripts validate domain-specific formats (overlay frontmatter, platform schema, architecture sections)
- Multi-arch release pipeline (linux/darwin × amd64/arm64) with automated GitHub releases
- Build-embedded step ensures Go binary with embedded data compiles and runs

**Weaknesses:**
- No test execution in CI — pytest is configured in `pyproject.toml` but never invoked
- No concurrency control on workflows (concurrent PR pushes run duplicate CI)
- No caching for Go modules or Python/uv dependencies
- Inconsistent action pinning — some pinned to SHA, some to version tag
- No status checks required (no branch protection evidence)

### Test Coverage

**Python Tests:**
| File | Lines | Framework | Runs in CI | Notes |
|------|-------|-----------|------------|-------|
| `tests/test_strace_agent.py` | 110 | pytest + pytest-asyncio | No | Requires API key + strace; skips otherwise |
| `scripts/test_version_regex.py` | 63 | Standalone script | No | Tests 1 regex pattern; not pytest-compatible |

**Go Tests:** None. Zero `*_test.go` files.

**Test-to-Code Ratio:**
- Python: 173 test lines / 9,163 source lines = **0.019** (1.9%)
- Go: 0 test lines / 5,330 source lines = **0.000** (0%)
- Combined: 173 / 14,493 = **0.012** (1.2%)

**Untested Critical Modules:**
| Module | Lines | Risk |
|--------|-------|------|
| `lib/webhook_analyzer.py` | 1,430 | Complex webhook chain analysis |
| `lib/fetch.py` | 705 | GitHub API interaction, repository cloning |
| `lib/cli.py` | 610 | CLI argument parsing, phase orchestration |
| `lib/phases/discover.py` | 599 | Component discovery logic |
| `src/arch-query/cmd/deps.go` | 586 | Dependency resolution |
| `src/arch-query/cmd/diff.go` | 561 | Version diff logic |
| `scripts/collect_architectures.py` | 517 | Architecture file collection |
| `src/arch-query/internal/markdown/parser.go` | 394 | Core markdown parsing |
| `lib/manifest_parser.py` | 353 | Operator manifest parsing |
| `scripts/lint_platforms.py` | 352 | Platform schema validation |

### Code Quality

**Python (ruff):**
- Configured in `pyproject.toml` with rules: E (errors), F (pyflakes), W (warnings), I (isort)
- Target version: Python 3.13
- Excludes `.claude/` directory
- Runs in CI via `make lint-python`
- **Gap**: Missing rules like UP (pyupgrade), B (bugbear), S (bandit/security), PT (pytest-style)

**Go (golangci-lint):**
- Configured in `.golangci.yml` with 4 linters: errcheck, govet, staticcheck, unused
- Go version: 1.25
- Runs in CI via `make lint-go`
- **Gap**: Missing linters like gosec, gocritic, gocyclo, misspell, exhaustive

**Pre-commit Hooks:** None. No `.pre-commit-config.yaml`.

**Static Analysis:** None beyond linting. No CodeQL, no gosec standalone, no Semgrep.

### Container Images

Not applicable — this repository does not produce container images. It builds standalone Go binaries for CLI distribution. The release pipeline produces platform-specific binaries uploaded to GitHub Releases.

### Security

**Present:**
- Unicode safety check on PRs (prevents trojan source attacks)
- `.env` in `.gitignore` (prevents credential leakage)
- `persist-credentials: false` on one checkout step

**Missing:**
- No SAST (CodeQL, gosec, Semgrep)
- No dependency scanning (govulncheck, pip-audit, safety)
- No secret detection (gitleaks, truffleHog)
- No SBOM generation
- No Trivy/Snyk scanning
- Inconsistent `persist-credentials: false` across workflows

### Agent Rules (Agentic Flow Quality)

**Status**: Partial
**Directory**: `.claude/skills/` exists with 10 skills

| Skill | Purpose |
|-------|---------|
| `repo-to-architecture-summary` | Phase 3: Generate component architecture from source |
| `aggregate-platform-architecture` | Phase 5: Aggregate component docs into platform doc |
| `generate-architecture-diagrams` | Phase 6: Create architecture diagrams |
| `generate-component-diagrams` | Phase 6: Create component-level diagrams |
| `generate-platform-diagrams` | Phase 6: Create platform-level diagrams |
| `discover-components` | Component discovery with validation scripts |
| `collect-component-architectures` | Phase 4: File collection |
| `analyze-platform-components` | Platform analysis |
| `analyze-running-cluster` | Live cluster analysis |
| `update-aipcc-base-images-overlay` | Overlay management |

**Strengths:**
- Rich skill library with reference documents (architecture templates, analysis patterns per language)
- Validation scripts in skills (`validate_architecture.py`, `validate_component_map.py`, `validate_platform.py`)
- `AGENT_USAGE.md` provides clear navigation guide for AI agents consuming the data
- Skills include language-specific references (Go, Python, Rust, frontend/BFF)

**Gaps:**
- No `CLAUDE.md` — missing project-level development guidelines
- No `.claude/rules/` directory — no test creation guidance for agents
- Skills focus entirely on architecture generation; no skills for testing, code review, or quality enforcement
- No `AGENTS.md`

## Recommendations

### Priority 0 (Critical)

1. **Add Go unit tests for core packages** — Start with `internal/markdown/parser.go` (394 LoC), `internal/loader/` (351 LoC), and `internal/overlay/overlay.go` (100 LoC). These are pure data processing with no external dependencies, making them easy to test. Target: 60% coverage for these packages.

2. **Add Python unit tests for pipeline core** — Start with `lib/manifest_parser.py`, `lib/component_discovery.py`, and `lib/build_info.py`. Use pytest fixtures with sample data from the `architecture/` directory. Target: 50% coverage for `lib/`.

3. **Add test execution to CI** — Add `uv run pytest tests/ -v` and ensure `go test ./...` runs (it's already in the Makefile but not in CI). The existing `build` job's smoke test is not a substitute.

4. **Add codecov integration** — Generate coverage with `go test -coverprofile=coverage.out ./...` and `pytest --cov=lib --cov-report=xml`. Set initial threshold at 30% and ratchet upward.

### Priority 1 (High Value)

5. **Add integration tests for lint scripts** — Create fixture directories with known-good and known-bad overlay/platform/architecture files. Verify `lint_overlays.py`, `lint_platforms.py`, and `lint_architecture_docs.py` catch errors correctly.

6. **Add security scanning** — Enable CodeQL for Go and Python in CI. Add `govulncheck` for Go dependency vulnerabilities. Add `pip-audit` for Python.

7. **Create CLAUDE.md** — Document project development guidelines, testing standards, and contribution workflow for AI agents and human developers.

8. **Pin all GitHub Actions to commit SHAs** — Standardize on SHA pinning across all workflows to prevent supply-chain attacks.

### Priority 2 (Nice-to-Have)

9. **Add pre-commit hooks** — Configure `.pre-commit-config.yaml` with ruff, golangci-lint, and gitleaks for local development.

10. **Expand ruff and golangci-lint rules** — Add bandit (security), bugbear, and pyupgrade to ruff. Add gosec, gocritic, and misspell to golangci-lint.

11. **Add .claude/rules/ for test patterns** — Create rules guiding AI agents on how to write tests for this project's specific patterns (Python async agents, Go CLI commands, lint script validation).

12. **Add CI concurrency control and caching** — Add `concurrency` groups to prevent duplicate CI runs. Cache Go modules and uv dependencies for faster builds.

## Comparison to Gold Standards

| Dimension | architecture-context | odh-dashboard | notebooks | kserve |
|-----------|---------------------|---------------|-----------|--------|
| Unit Tests | 1/10 (0 Go, 1 conditional Py) | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 1/10 (smoke only) | 9/10 | 8/10 | 9/10 |
| Build Integration | 4/10 (binary build+smoke) | 8/10 | 7/10 | 8/10 |
| Coverage Tracking | 0/10 | 9/10 | 6/10 | 9/10 |
| CI/CD Automation | 5/10 (strong linting, no tests) | 9/10 | 8/10 | 9/10 |
| Agent Rules | 5/10 (skills only) | 8/10 | 4/10 | 3/10 |
| Security Scanning | 1/10 (unicode only) | 7/10 | 6/10 | 7/10 |

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yml` — Main CI: 5 lint jobs + build + smoke
- `.github/workflows/release.yml` — Multi-arch Go binary release
- `.github/workflows/unicode-safety.yml` — Unicode trojan source detection

### Source Code
- `lib/*.py` — Python pipeline library (11 modules)
- `lib/phases/*.py` — Pipeline phase implementations (11 modules)
- `scripts/*.py` — Utility scripts (8 files)
- `src/arch-query/` — Go CLI (32 files, 5,330 LoC)

### Testing
- `tests/test_strace_agent.py` — Single Python test (conditional)
- `scripts/test_version_regex.py` — Standalone regex test script

### Configuration
- `pyproject.toml` — Python project config (ruff, pytest)
- `.golangci.yml` — Go linter config (4 linters)
- `Makefile` — Build/test/lint targets
- `platforms.yaml` — Platform version definitions

### Agent Rules
- `.claude/skills/` — 10 Claude skills for architecture generation
- `AGENT_USAGE.md` — Agent navigation guide
