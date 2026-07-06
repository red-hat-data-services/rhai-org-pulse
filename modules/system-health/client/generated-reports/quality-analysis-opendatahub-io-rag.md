---
repository: "opendatahub-io/rag"
overall_score: 1.3
scorecard:
  - dimension: "Unit Tests"
    score: 1.0
    status: "Virtually no unit tests; 1 Go integration test requiring live WhatsApp, 0 Python tests across ~4700 LOC"
  - dimension: "Integration/E2E"
    score: 1.0
    status: "No integration or E2E test suites; 1 manual shell script that checks dependencies"
  - dimension: "Build Integration"
    score: 1.0
    status: "No PR-time build validation for any Dockerfile or Kustomize overlay"
  - dimension: "Image Testing"
    score: 1.0
    status: "4 Dockerfiles with no image scanning, runtime validation, or multi-arch support"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling, no codecov integration, no coverage thresholds"
  - dimension: "CI/CD Automation"
    score: 3.0
    status: "Single pre-commit workflow with good linting; no test, build, or deploy workflows"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "Zero automated test execution in CI"
    impact: "Code changes are never validated by automated tests; regressions go undetected"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No Python unit tests for ~4700 lines of application code"
    impact: "Core demo logic (pipelines, MCP server, API server, UI) has zero test coverage"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No container image build validation on PRs"
    impact: "Broken Dockerfiles and Kustomize overlays discovered only after merge or manual deploy"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No security scanning (SAST, container, dependency)"
    impact: "Vulnerabilities in Python/Go dependencies and container images go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Cannot measure or improve test coverage over time"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No Go linting (golangci-lint) for ~3900 lines of Go code"
    impact: "Go code quality issues not caught; only Python linting via ruff"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add Trivy container scanning to pre-commit workflow"
    effort: "1-2 hours"
    impact: "Catch known vulnerabilities in container base images and dependencies"
  - title: "Add Dockerfile build validation workflow"
    effort: "2-3 hours"
    impact: "Verify all 4 Dockerfiles build successfully on every PR"
  - title: "Add golangci-lint for Go code"
    effort: "1-2 hours"
    impact: "Catch Go code quality issues in the whatsapp-bot component"
  - title: "Add pytest for MCP server and voice API"
    effort: "4-6 hours"
    impact: "Cover critical demo code with basic unit tests"
  - title: "Add Kustomize build validation"
    effort: "1-2 hours"
    impact: "Verify kustomize overlays render correctly before merge"
recommendations:
  priority_0:
    - "Add GitHub Actions workflow to run pytest on Python code (MCP server, voice API, pipelines)"
    - "Add Dockerfile build validation workflow for all 4 container images"
    - "Add Trivy or Snyk scanning for container images and Python/Go dependencies"
  priority_1:
    - "Write unit tests for MCP server (database_manager.py, mcp_server.py, logger.py)"
    - "Write unit tests for voice API server (routers, services)"
    - "Add Go test CI workflow and golangci-lint for whatsapp-bot"
    - "Add Kustomize overlay validation (kustomize build) in CI"
    - "Set up codecov with minimum coverage thresholds"
  priority_2:
    - "Create agent rules (.claude/rules/) for test creation patterns"
    - "Add notebook validation (papermill or nbval) for Jupyter notebooks"
    - "Add integration tests that deploy to Kind/Minikube"
    - "Add SBOM generation for container images"
    - "Implement CodeQL or Semgrep for SAST"
---

# Quality Analysis: opendatahub-io/rag

## Executive Summary

- **Overall Score: 1.3/10**
- **Repository Type**: Demo/reference repository — RAG demonstrations, benchmarks, and Kubernetes/OpenShift deployment configurations
- **Primary Languages**: Python (~4,700 LOC), Go (~3,900 LOC), Shell scripts, Jupyter notebooks
- **Total Files**: ~210 files across demos, benchmarks, stack deployment configs, and notebooks

### Key Strengths
- Well-configured pre-commit hooks with ruff linter/formatter, license enforcement, and standard checks
- Proper concurrency control and caching in the pre-commit CI workflow
- Good repository organization with CONTRIBUTING.md, OWNERS, and clear folder structure
- UBI9-based container images following Red Hat/OpenShift best practices (non-root users, group 0 permissions)

### Critical Gaps
- **Zero automated tests in CI** — the only workflow is pre-commit linting
- **No Python tests** for ~4,700 lines of application code across pipelines, MCP server, voice API, and UI
- **No container image validation** — 4 Dockerfiles are never built or scanned in CI
- **No security scanning** — no SAST, no container scanning, no dependency auditing
- **No coverage tracking** — no codecov, no coverage thresholds, no coverage reports

### Agent Rules Status: **Missing**
- No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 1/10 | 1 Go test requiring live WhatsApp; 0 Python tests |
| Integration/E2E | 1/10 | No integration or E2E suites |
| **Build Integration** | **1/10** | **No PR-time build validation** |
| Image Testing | 1/10 | 4 Dockerfiles, no scanning or runtime validation |
| Coverage Tracking | 0/10 | No coverage tooling whatsoever |
| CI/CD Automation | 3/10 | Pre-commit only; no test/build/deploy workflows |
| Agent Rules | 0/10 | No agent rules or test automation guidance |

## Critical Gaps

### 1. Zero Automated Test Execution in CI
- **Impact**: Code changes are never validated by automated tests; regressions go completely undetected
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Details**: The only CI workflow (`.github/workflows/pre-commit.yaml`) runs linting and formatting checks. No workflow exists to run `pytest`, `go test`, or any test suite.

### 2. No Python Unit Tests (~4,700 LOC Untested)
- **Impact**: Core application logic has zero test coverage — MCP server, voice API server, Kubeflow pipelines, evaluation utilities, and UI code
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Files needing tests**:
  - `demos/redbank-demo/mcp-server/redbank-mcp/mcp_server.py` — MCP server logic
  - `demos/redbank-demo/mcp-server/redbank-mcp/database_manager.py` — Database operations
  - `demos/redbank-demo/chat-bot/voice-api-server/app/` — Voice API (routers, services)
  - `demos/kubeflow-pipelines/*/` — Pipeline definitions
  - `notebooks/evaluation/evaluation_utilities.py` — Evaluation helpers
  - `benchmarks/beir-benchmarks/beir_benchmarks.py` — Benchmarking scripts

### 3. No Container Image Build Validation
- **Impact**: Broken Dockerfiles discovered only during manual deployment
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: 4 Dockerfiles exist:
  - `demos/redbank-demo/mcp-server/Dockerfile`
  - `demos/redbank-demo/chat-bot/whatsapp-bot/Dockerfile`
  - `demos/redbank-demo/chat-bot/voice-api-server/Dockerfile`
  - `demos/redbank-demo/chat-bot/ui/Dockerfile`
  - None are built or validated in CI

### 4. No Security Scanning
- **Impact**: Vulnerabilities in base images, Python packages, and Go modules go undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Trivy, Snyk, CodeQL, Semgrep, or dependency scanning. The `detect-private-key` pre-commit hook is the only security check.

### 5. No Coverage Tracking
- **Impact**: Cannot measure, enforce, or improve test coverage
- **Severity**: MEDIUM
- **Effort**: 2-4 hours

### 6. No Go Linting
- **Impact**: ~3,900 lines of Go code (whatsapp-bot) have no static analysis
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: Ruff handles Python linting, but there is no `golangci-lint` configuration or CI step for Go.

## Quick Wins

### 1. Add Trivy Container Scanning (1-2 hours)
Add to PR workflow:
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    scan-type: 'fs'
    scan-ref: '.'
    severity: 'CRITICAL,HIGH'
```

### 2. Add Dockerfile Build Validation (2-3 hours)
Create a workflow that runs `docker build` for each Dockerfile on PR:
```yaml
name: Build Images
on: [pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        context:
          - demos/redbank-demo/mcp-server
          - demos/redbank-demo/chat-bot/voice-api-server
          - demos/redbank-demo/chat-bot/ui
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t test-${{ matrix.context }} ${{ matrix.context }}
```

### 3. Add golangci-lint (1-2 hours)
Create `.golangci.yml` and add to CI:
```yaml
- name: golangci-lint
  uses: golangci/golangci-lint-action@v6
  with:
    working-directory: demos/redbank-demo/chat-bot/whatsapp-bot
```

### 4. Add Basic pytest for MCP Server (4-6 hours)
Install pytest, create `tests/` directories, and write basic tests for `database_manager.py` and `mcp_server.py`.

### 5. Add Kustomize Build Validation (1-2 hours)
```yaml
- name: Validate Kustomize overlays
  run: |
    for dir in stack/base stack/overlays/*/; do
      kustomize build "$dir" > /dev/null
    done
```

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory**: 1 workflow total
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pre-commit.yaml` | PR + push to main | Run pre-commit hooks (ruff, formatting, license, YAML) |

**Strengths**:
- Pinned action SHAs (security best practice)
- Concurrency control with `cancel-in-progress: true`
- pip caching via `cache-dependency-path`
- Verifies no uncommitted changes/new files after pre-commit

**Gaps**:
- No test execution workflow
- No build validation workflow
- No periodic/scheduled workflows
- No deployment validation

### Test Coverage

**Python Tests**: **0 test files** across 25 Python source files (~4,700 LOC)
- No `pytest.ini`, `conftest.py`, or `tests/` directories
- No testing dependencies in any `requirements.txt`
- No test framework configured

**Go Tests**: **1 test file** — `demos/redbank-demo/chat-bot/whatsapp-bot/test_audio_send_test.go`
- This is an integration test requiring a live WhatsApp connection and local database
- Hardcoded recipient phone number — not suitable for CI
- No mocking or test isolation
- No other Go test files for ~3,900 LOC

**Shell Tests**: **1 shell script** — `test_voice_processing.sh`
- Manual dependency checker, not an automated test
- Requires a running server
- Does not assert results

**Test-to-Code Ratio**: Effectively **0:1** — near-zero test coverage

### Code Quality

**Pre-commit Configuration** (`.pre-commit-config.yaml`):
| Hook | Purpose |
|------|---------|
| check-merge-conflict | Prevent merge conflict markers |
| trailing-whitespace | Whitespace cleanup (excludes .py) |
| check-added-large-files | Block files >1MB |
| end-of-file-fixer | Consistent EOF |
| no-commit-to-branch | Prevent direct commits to main |
| check-yaml | YAML syntax validation |
| detect-private-key | Basic secret detection |
| requirements-txt-fixer | Sort requirements |
| mixed-line-ending | LF enforcement |
| check-executables-have-shebangs | Script validation |
| check-json | JSON syntax validation |
| check-shebang-scripts-are-executable | Permission check |
| insert-license | Apache 2.0 license headers |
| ruff | Python linting |
| ruff-format | Python formatting |
| blacken-docs | Format code in docs |

This is a **strong** pre-commit setup — one of the few bright spots.

**Missing**:
- No golangci-lint for Go
- No mypy/pyright for Python type checking
- No shellcheck for shell scripts

### Container Images

**Dockerfiles**: 4 total, all in `demos/redbank-demo/chat-bot/`

| Dockerfile | Base Image | Strengths | Gaps |
|------------|-----------|-----------|------|
| mcp-server | UBI9/python-312 | Simple, clean | No multi-stage, no healthcheck |
| whatsapp-bot | UBI9/go-toolset (multi-stage) | Multi-stage build, non-root user | Uses `registry.redhat.io` (auth required) |
| voice-api-server | UBI9/python-312 | Non-root user, OpenShift-compatible | No healthcheck |
| ui | UBI9/python-312 | Non-root user | `pip install -e .` in container (unusual) |

**Strengths**:
- All use Red Hat UBI9 base images
- Non-root user configurations
- OpenShift-compatible (group 0 permissions)
- Multi-stage build for Go binary

**Gaps**:
- No image scanning (Trivy, Snyk)
- No SBOM generation
- No image signing/attestation
- No healthcheck instructions
- No multi-architecture support
- No runtime validation tests
- No `.dockerignore` in individual demo directories

### Security Practices

| Practice | Status |
|----------|--------|
| Secret detection | Partial — `detect-private-key` pre-commit hook only |
| SAST/CodeQL | Missing |
| Container scanning | Missing |
| Dependency scanning | Missing |
| SBOM generation | Missing |
| Image signing | Missing |
| Gitleaks | Missing |
| Pinned action SHAs | Present |

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No test type rules exist
- **Quality**: N/A
- **Gaps**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory at all
- **Recommendation**: Generate test creation rules with `/test-rules-generator` covering:
  - Python pytest patterns for the various demo components
  - Go testing patterns for the whatsapp-bot
  - Notebook validation patterns
  - Integration test patterns with mock external services

## Recommendations

### Priority 0 (Critical)

1. **Add GitHub Actions test workflow** — Create a workflow to run `pytest` for Python code and `go test` for Go code on every PR
2. **Add Dockerfile build validation** — Verify all 4 Dockerfiles build successfully on every PR
3. **Add container/dependency scanning** — Integrate Trivy for filesystem and image scanning

### Priority 1 (High Value)

4. **Write Python unit tests** — Start with MCP server (`database_manager.py`, `mcp_server.py`) and voice API server (routers, services)
5. **Write Go unit tests** — Add tests for whatsapp-bot handlers, utils, and config
6. **Add golangci-lint** — Configure Go linting for the whatsapp-bot component
7. **Add Kustomize validation** — Verify `stack/base/` and all overlays build correctly in CI
8. **Set up codecov** — Track coverage with minimum thresholds (start at 20%, increase over time)

### Priority 2 (Nice-to-Have)

9. **Create agent rules** — Add `.claude/rules/` with test creation patterns for Python and Go
10. **Add notebook validation** — Use papermill or nbval to validate Jupyter notebooks execute without errors
11. **Add integration tests** — Deploy to Kind/Minikube and run smoke tests
12. **Add SBOM generation** — Use syft or cdxgen for software bill of materials
13. **Implement CodeQL** — Enable GitHub's built-in SAST for Python and Go
14. **Add shellcheck** — Lint the 10 shell scripts in the repository

## Comparison to Gold Standards

| Capability | rag | odh-dashboard | notebooks | kserve |
|------------|-----|---------------|-----------|--------|
| Unit Tests | None | Comprehensive Jest | N/A | Extensive Go tests |
| Integration Tests | None | Contract tests | Image testing | Multi-version |
| E2E Tests | None | Cypress suite | Notebook validation | KServe predictor tests |
| Coverage Tracking | None | Codecov enforced | N/A | Codecov enforced |
| CI Workflows | 1 (pre-commit) | 15+ workflows | 10+ workflows | 20+ workflows |
| Container Scanning | None | Trivy | Trivy | Trivy |
| Image Build CI | None | Multi-mode builds | Multi-arch | Multi-platform |
| Pre-commit | Strong | Present | Present | Present |
| Agent Rules | None | Comprehensive | None | None |
| Kustomize Validation | None | Yes | N/A | Yes |
| SAST | None | CodeQL | None | CodeQL |

## File Paths Reference

### CI/CD
- `.github/workflows/pre-commit.yaml` — Only CI workflow

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks (ruff, license, YAML, etc.)

### Container Images
- `demos/redbank-demo/mcp-server/Dockerfile`
- `demos/redbank-demo/chat-bot/whatsapp-bot/Dockerfile`
- `demos/redbank-demo/chat-bot/voice-api-server/Dockerfile`
- `demos/redbank-demo/chat-bot/ui/Dockerfile`

### Kustomize
- `stack/base/kustomization.yaml`
- `stack/overlays/*/kustomization.yaml`

### Deployment
- `stack/install.sh`
- `demos/redbank-demo/Makefile`

### Key Application Code (untested)
- `demos/redbank-demo/mcp-server/redbank-mcp/` — MCP server (Python)
- `demos/redbank-demo/chat-bot/voice-api-server/app/` — Voice API (Python/FastAPI)
- `demos/redbank-demo/chat-bot/whatsapp-bot/` — WhatsApp bot (Go)
- `demos/redbank-demo/chat-bot/ui/` — Chat UI (Python/Streamlit)
- `demos/kubeflow-pipelines/` — Kubeflow pipeline definitions (Python)
- `notebooks/evaluation/` — Evaluation notebooks and utilities
- `benchmarks/beir-benchmarks/` — Embedding model benchmarks
