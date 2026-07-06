---
repository: "opendatahub-io/agents"
overall_score: 2.8
scorecard:
  - dimension: "Unit Tests"
    score: 4.0
    status: "Tests exist only for rfe-dedup plugin (12 test files, ~2900 LOC); remaining ~9000 LOC of Python and Go untested"
  - dimension: "Integration/E2E"
    score: 1.0
    status: "No integration or E2E test suites; langchain tests are manual validation scripts, not automated tests"
  - dimension: "Build Integration"
    score: 0.0
    status: "No CI/CD pipelines exist; no PR checks, no automated builds, no Konflux integration"
  - dimension: "Image Testing"
    score: 0.0
    status: "No container images built; no Dockerfiles; single docker-compose.yml for one example only"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling; no codecov, coveralls, or any coverage measurement"
  - dimension: "CI/CD Automation"
    score: 0.5
    status: "Only Dependabot for dependency updates; no workflows, no linting, no test automation"
  - dimension: "Agent Rules"
    score: 6.0
    status: "CLAUDE.md and AGENTS.md present with good context; plugin system with skills; no .claude/rules/ for test patterns"
critical_gaps:
  - title: "No CI/CD pipelines at all"
    impact: "Code merges with zero automated validation; broken code can land undetected"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No automated test execution"
    impact: "Existing unit tests (rfe-dedup) are never run in CI; regressions go unnoticed"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Most code has zero test coverage"
    impact: "Examples, tools, and benchmarking code (~9000 LOC) have no tests at all"
    severity: "HIGH"
    effort: "20-40 hours"
  - title: "No linting or code quality enforcement"
    impact: "No static analysis catches bugs, style violations, or type errors before merge"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No security scanning"
    impact: "Dependency vulnerabilities and secrets in code are never detected"
    severity: "HIGH"
    effort: "2-3 hours"
quick_wins:
  - title: "Add GitHub Actions workflow to run rfe-dedup pytest suite on PRs"
    effort: "1-2 hours"
    impact: "Immediately validates the most tested component on every PR"
  - title: "Add ruff linting for Python code"
    effort: "1 hour"
    impact: "Catch common bugs and enforce consistent style across all Python code"
  - title: "Add Dependabot alerts + Trivy scanning workflow"
    effort: "1-2 hours"
    impact: "Automated vulnerability detection for Python and Go dependencies"
  - title: "Add pre-commit hooks for formatting and linting"
    effort: "1-2 hours"
    impact: "Developers get immediate feedback before committing"
  - title: "Add Go vet/staticcheck for Go examples"
    effort: "1 hour"
    impact: "Catch common Go issues in the 5 Go example files"
recommendations:
  priority_0:
    - "Create a basic GitHub Actions CI workflow that runs pytest for agent-plugins/tests on every PR"
    - "Add ruff or flake8 linting to the CI workflow for all Python files"
    - "Enable GitHub Dependabot security alerts"
  priority_1:
    - "Add unit tests for benchmarking/significance-testing scripts (bootstrap.py, bfcl_loader.py)"
    - "Add integration tests for MCP tester tool"
    - "Add coverage tracking with codecov or coveralls, starting with rfe-dedup"
    - "Create .claude/rules/ with test creation guidelines for the pytest patterns used"
  priority_2:
    - "Add Go CI workflow for linting and building Go examples"
    - "Create pre-commit-config.yaml with ruff, mypy, and go-vet hooks"
    - "Add notebook validation (nbval or papermill) to verify Jupyter notebooks execute"
    - "Add CODEOWNERS file for review requirements"
---

# Quality Analysis: opendatahub-io/agents

## Executive Summary

- **Overall Score: 2.8/10**
- **Repository Type**: Experimental sandbox / examples collection for agentic AI reasoning
- **Primary Languages**: Python 3.13+ (~11,700 LOC), Go 1.22-1.25 (~350 LOC)
- **Key Strengths**: Good documentation (CLAUDE.md, AGENTS.md, ADRs), well-structured rfe-dedup plugin with comprehensive unit tests, clear architectural decisions
- **Critical Gaps**: Zero CI/CD pipelines, no linting, no security scanning, no coverage tracking, majority of code untested
- **Agent Rules Status**: Partially present (CLAUDE.md/AGENTS.md at root, plugin system), but no `.claude/rules/` directory for test patterns

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 4.0/10 | Tests exist only for rfe-dedup plugin; rest of codebase untested |
| Integration/E2E | 1.0/10 | No integration or E2E test suites; manual validation scripts only |
| **Build Integration** | **0.0/10** | **No CI/CD pipelines; no PR checks whatsoever** |
| Image Testing | 0.0/10 | No container images; no Dockerfiles |
| Coverage Tracking | 0.0/10 | No coverage tools configured |
| CI/CD Automation | 0.5/10 | Dependabot only; no workflows |
| Agent Rules | 6.0/10 | CLAUDE.md/AGENTS.md with good context; plugin system; no test rules |

## Critical Gaps

### 1. No CI/CD Pipelines
- **Impact**: Code merges with zero automated validation. There is no `.github/workflows/` directory at all. The only automation is Dependabot for dependency version bumps.
- **Severity**: HIGH
- **Effort**: 4-8 hours to set up comprehensive CI
- **Evidence**: `find .github/workflows` returns nothing; only CI-related config is Dependabot

### 2. No Automated Test Execution
- **Impact**: The rfe-dedup plugin has 12 well-written pytest test files (~2,885 LOC) covering 11 scripts, but these tests are never run in CI. Regressions can be introduced silently.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Evidence**: No GitHub Actions, no Makefile test targets, no CI configuration of any kind

### 3. Most Code Lacks Tests
- **Impact**: ~9,000 lines of Python code outside the rfe-dedup tests directory have no test coverage. This includes the benchmarking tools (significance testing, bootstrap), all examples (langchain, CrewAI, kubernetes-mcp, etc.), and the MCP tester utility.
- **Severity**: HIGH
- **Effort**: 20-40 hours for meaningful coverage
- **Test-to-Code Ratio**: Overall ~25% (2,885 test LOC / 11,676 total Python LOC), but concentrated entirely in one plugin

### 4. No Linting or Code Quality Enforcement
- **Impact**: No ruff, flake8, mypy, pylint, golangci-lint, or any static analysis tool is configured. No `pyproject.toml` at the repo root with tool configuration.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Evidence**: No `.pre-commit-config.yaml`, no root-level `pyproject.toml` with `[tool.ruff]`, no `.golangci.yaml`

### 5. No Security Scanning
- **Impact**: No dependency vulnerability scanning (beyond Dependabot version bumps), no SAST, no secret detection. Multiple files handle API keys and tokens.
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Evidence**: No CodeQL, Trivy, Snyk, Gitleaks, or similar tools configured

## Quick Wins

### 1. Add GitHub Actions CI for pytest (1-2 hours)
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
      - run: |
          cd agent-plugins
          uv pip install pytest numpy sentence-transformers faiss-cpu
          pytest tests/ -v
```

### 2. Add ruff linting (1 hour)
Create a root `pyproject.toml` with ruff configuration and add to CI:
```toml
[tool.ruff]
target-version = "py312"
line-length = 120

[tool.ruff.lint]
select = ["E", "F", "W", "I", "UP", "B", "SIM"]
```

### 3. Add Trivy scanning (1-2 hours)
```yaml
# .github/workflows/security.yml
name: Security
on: [push, pull_request]
jobs:
  trivy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
```

### 4. Add pre-commit hooks (1-2 hours)
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.9.0
    hooks:
      - id: ruff
      - id: ruff-format
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.22.1
    hooks:
      - id: gitleaks
```

### 5. Add Go vet for Go examples (1 hour)
```yaml
  go-lint:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        dir: [examples/github-mcp, examples/kubernetes-mcp, examples/slack-mcp, examples/servicenow-mcp, examples/gsuite-mcp]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.24'
      - run: cd ${{ matrix.dir }} && go vet ./...
```

## Detailed Findings

### CI/CD Pipeline

**Status: Non-existent**

- **No `.github/workflows/` directory** at all
- No Makefile with test/lint targets
- No GitLab CI, Jenkins, CircleCI, or other CI configuration
- Dependabot is configured (evidenced by merge commit for `dependabot/pip/migration/legacy-agents/urllib3-2.7.0`) but only for dependency version bumps, not security alerts
- No branch protection rules evident
- No CODEOWNERS file

### Test Coverage

**Status: Partial - concentrated in one component**

#### rfe-dedup Plugin Tests (Strong)
- **12 test files** in `agent-plugins/tests/rfe-dedup/`
- **~2,885 lines** of test code covering 11 scripts (~2,017 lines)
- **Test-to-code ratio**: 1.43:1 (excellent for this component)
- **Framework**: pytest with fixtures, monkeypatching, and tmp_path
- **Pattern**: Well-structured class-based tests (e.g., `TestBuildText`, `TestLuceneEscape`)
- **Mocking strategy**: Heavy ML dependency mocking (faiss, sentence_transformers) with FakeIndex for FAISS inner-product search
- **Shared fixtures**: `conftest.py` with `SAMPLE_RFE_A`, `SAMPLE_RFE_B`, and `patch_embedding_pipeline`

#### Langchain/LangGraph Tests (Manual validation only)
- `test_langchain_mcp.py` - Manual MCP connectivity test (requires running K8s MCP server)
- `test_langchain_guardrails.py` - Manual guardrails test (requires running LLM)
- These are **manual validation scripts**, not automated tests; they require live infrastructure

#### Benchmarking Tests (None)
- `significance_test.py` is a CLI tool, not a test file
- `bootstrap.py` and `bfcl_loader.py` have no corresponding tests

#### MCP Tester (None)
- `test-mcp-server.py` is a diagnostic tool, not a test
- No tests for the tool itself

#### Notebooks (No validation)
- 20 Jupyter notebooks with no nbval or papermill validation
- Notebooks include training/evaluation workflows that could silently break

### Code Quality

**Status: No tools configured**

- **Linting**: None. No ruff, flake8, pylint, mypy, or eslint configured
- **Formatting**: No black, ruff-format, or prettier configured
- **Static Analysis**: No CodeQL, Semgrep, or gosec
- **Pre-commit Hooks**: No `.pre-commit-config.yaml`
- **Type Checking**: No mypy.ini or pyright configuration
- **Go Quality**: No golangci-lint, go vet in CI, or staticcheck

### Container Images

**Status: Not applicable**

- This is an examples/tools repository, not a deployable service
- No Dockerfiles or Containerfiles exist
- Single `docker-compose.yml` in `examples/mcp-project-reporting/` for running an example
- No container image building, testing, or scanning

### Security

**Status: Minimal**

- **Dependency scanning**: Dependabot appears configured for version bumps only
- **SAST**: None (no CodeQL, Semgrep)
- **Secret detection**: None (no Gitleaks, TruffleHog)
- **Concern**: Multiple files handle API keys (OPENAI_API_KEY, GITHUB_TOKEN, SLACK_MCP_TOKEN, etc.) with `os.getenv()`. While `.env` is in `.gitignore`, there's no automated secret detection to catch accidental commits.
- **Concern**: Some files have hardcoded patterns like `"not applicable"` for API keys as defaults, which is acceptable but could mask configuration issues

### Agent Rules (Agentic Flow Quality)

**Status: Partially Present**

#### What's Present:
- **CLAUDE.md**: Comprehensive 4,500+ word document covering:
  - Tech stack and conventions
  - Setup patterns for vLLM, Llama Stack, OpenAI, Ollama
  - Agent plugin development workflow
  - ADR references
- **AGENTS.md**: Focused on agent plugin lifecycle:
  - Plugin development instructions
  - Reload/verification workflow
  - Marketplace/plugin.json conventions
- **Plugin System**: `agent-plugins/rfe-dedup/` with:
  - Well-structured skill definition (SKILL.md)
  - Plugin marketplace JSON
  - Custom agent types (eval-pair, report-group)

#### What's Missing:
- **No `.claude/rules/` directory** for test creation guidelines
- **No test pattern documentation** for how to write tests matching the pytest patterns used
- **No `.claude/` directory** at all in the repository root
- **No test automation guidance** for contributors
- **No quality gates** defined in agent rules

#### Recommendation:
Run `/test-rules-generator` to create `.claude/rules/` with:
- `unit-tests.md` - pytest patterns matching the rfe-dedup style
- `integration-tests.md` - MCP server integration testing patterns
- `e2e-tests.md` - End-to-end validation patterns

## Recommendations

### Priority 0 (Critical)

1. **Create a GitHub Actions CI workflow** that runs the existing pytest suite on every PR. This is the single highest-ROI change — tests exist but never run automatically.

2. **Add Python linting (ruff)** to catch common bugs and enforce consistent style. The repository has ~11,700 lines of Python with zero static analysis.

3. **Enable GitHub Dependabot security alerts** (not just version bumps) to catch known vulnerabilities in dependencies.

### Priority 1 (High Value)

4. **Add unit tests for benchmarking tools** — `bootstrap.py`, `bfcl_loader.py`, and `significance_test.py` are important data analysis tools that should have tests.

5. **Add coverage tracking** with codecov or coveralls, starting with the rfe-dedup plugin. Set a baseline and enforce non-regression.

6. **Create `.claude/rules/` test guidelines** to help contributors write consistent, high-quality tests following the patterns established in rfe-dedup.

7. **Add type checking** with mypy or pyright for at least the rfe-dedup scripts and benchmarking tools.

### Priority 2 (Nice-to-Have)

8. **Add Go CI workflow** for `go vet` and `go build` on the 5 Go example directories.

9. **Create `pre-commit-config.yaml`** with ruff, ruff-format, and gitleaks hooks.

10. **Add notebook validation** using nbval or papermill to verify the 20 Jupyter notebooks can execute without errors.

11. **Add a CODEOWNERS file** to require reviews from appropriate team members for different areas (examples, plugins, benchmarking).

12. **Consider adding a root Makefile** with common targets (test, lint, format, clean) to standardize the developer workflow.

## Comparison to Gold Standards

| Dimension | agents | odh-dashboard | notebooks | kserve |
|-----------|--------|---------------|-----------|--------|
| CI Workflows | 0 | 15+ | 10+ | 20+ |
| Unit Tests | Partial (1 plugin) | Comprehensive | Comprehensive | Comprehensive |
| Integration Tests | None | Contract + API | Image validation | Multi-version |
| E2E Tests | None | Cypress + Playwright | 5-layer validation | KServe predict |
| Coverage Tracking | None | Codecov enforced | Per-notebook | Codecov enforced |
| Linting | None | ESLint + Prettier | shellcheck + hadolint | golangci-lint |
| Security Scanning | None | Trivy + CodeQL | Trivy | Trivy + CodeQL |
| Pre-commit Hooks | None | Yes | Yes | Yes |
| Agent Rules | CLAUDE.md + AGENTS.md | Full .claude/rules/ | None | None |

**Context**: The `agents` repository is an experimental sandbox, not a production service. This explains much of the gap, but as the rfe-dedup plugin demonstrates, high-quality testing is possible even in experimental code. The gold standards above are production repositories with dedicated CI/CD teams.

## File Paths Reference

### Key Configuration Files
| File | Purpose |
|------|---------|
| `CLAUDE.md` | Agent rules and repository context |
| `AGENTS.md` | Plugin development workflow |
| `CONTRIBUTING.md` | Contributor guidelines |
| `.gitignore` | Standard Python + Go ignores |
| `adr/minimal-sdk.md` | Key architectural decision (Option 8) |
| `mcp-discovery-configmap/schema.json` | MCP server discovery schema |

### Test Files
| File/Directory | Purpose |
|----------------|---------|
| `agent-plugins/tests/rfe-dedup/` | 12 pytest files for rfe-dedup plugin |
| `agent-plugins/tests/rfe-dedup/conftest.py` | Shared fixtures and ML mocks |
| `examples/langchain-langgraph/test_langchain_*.py` | Manual validation scripts |
| `tools/mcp-tester/test-mcp-server.py` | MCP server diagnostic tool |

### Source Code (Untested)
| Directory | LOC | Purpose |
|-----------|-----|---------|
| `examples/` | ~5,000 | MCP agent examples (Python + Go) |
| `benchmarking/` | ~1,000 | Statistical significance testing |
| `tools/` | ~300 | MCP tester, vLLM setup, Llama Stack |
| `validation-vllm/` | Notebooks | vLLM validation notebooks |
| `migration/` | Notebook | Legacy agent migration |
