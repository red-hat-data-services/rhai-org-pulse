---
repository: "opendatahub-io/agent-ops"
overall_score: 2.2
scorecard:
  - dimension: "Unit Tests"
    score: 4.0
    status: "Tests exist for 3 of 5 components; banking-agent, playground, and mcp-server lack unit tests entirely"
  - dimension: "Integration/E2E"
    score: 4.0
    status: "Testcontainers for pgvector DB tests; manual bash script for A2A agent tests; no automated E2E suite"
  - dimension: "Build Integration"
    score: 0.0
    status: "No CI/CD pipeline exists; Dockerfiles are never built or validated in automation"
  - dimension: "Image Testing"
    score: 2.0
    status: "UBI9 base images and some pinned digests; no scanning, no runtime validation, no multi-arch"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No codecov, coveralls, or any coverage reporting; no thresholds enforced"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "No GitHub Actions, GitLab CI, or any CI/CD configuration; all testing is manual"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory; no AI-assisted test guidance"
critical_gaps:
  - title: "No CI/CD pipeline of any kind"
    impact: "All testing, building, and validation is entirely manual; regressions can merge undetected"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Test coverage can silently decrease; no visibility into untested code paths"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container image security scanning"
    impact: "Vulnerable dependencies and base image CVEs go undetected until production"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Banking agent and MCP server have zero unit tests"
    impact: "Core financial operations code (account updates, transactions) has no automated validation"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No linting or static analysis"
    impact: "Code quality issues, type errors, and style inconsistencies accumulate over time"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No pre-commit hooks"
    impact: "Developers can commit code without any local quality checks"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add a basic GitHub Actions CI workflow with pytest"
    effort: "2-4 hours"
    impact: "Automated test execution on every PR; immediate regression detection"
  - title: "Add ruff for linting and formatting"
    effort: "1-2 hours"
    impact: "Catches bugs, enforces style consistency, replaces multiple tools (flake8, isort, black)"
  - title: "Add Trivy scanning to container builds"
    effort: "1-2 hours"
    impact: "Automated CVE detection for all 5 container images"
  - title: "Add pytest-cov and codecov integration"
    effort: "2-3 hours"
    impact: "Visibility into coverage trends; foundation for coverage enforcement"
  - title: "Add pre-commit hooks (ruff, mypy, gitleaks)"
    effort: "1-2 hours"
    impact: "Local quality gate before code reaches the repository"
  - title: "Create CLAUDE.md with test patterns for AI-assisted development"
    effort: "2-3 hours"
    impact: "Consistent AI-generated test quality across all components"
recommendations:
  priority_0:
    - "Create GitHub Actions CI workflow: run pytest across all components on every PR"
    - "Add unit tests for banking-agent (agent_executor.py, agent.py, __main__.py) and mcp-server (mcp_server.py, database_manager.py)"
    - "Add container image vulnerability scanning (Trivy) for all 5 Dockerfiles"
    - "Add coverage tracking with codecov and enforce minimum thresholds (start at 50%)"
  priority_1:
    - "Add ruff linting/formatting and mypy type checking to CI pipeline"
    - "Pin all Dockerfile base image digests (banking-agent, knowledge-agent, mcp-server currently use :latest)"
    - "Create automated E2E test suite that can run in Kind/Minikube without a full OpenShift cluster"
    - "Add pre-commit hooks with ruff, mypy, and gitleaks for local quality enforcement"
    - "Create comprehensive CLAUDE.md and .claude/rules/ for AI-assisted test generation"
  priority_2:
    - "Add SAST scanning (CodeQL or Semgrep) for security analysis"
    - "Add Dockerfile linting with hadolint"
    - "Add multi-architecture builds for container images"
    - "Add Helm chart testing with chart-testing and helm-unittest"
    - "Add API contract testing between agents (A2A protocol validation)"
    - "Add load testing for the orchestrator agent routing"
---

# Quality Analysis: opendatahub-io/agent-ops

## Executive Summary
- Overall Score: 2.2/10
- Key Strengths: Good application-level security design (RLS, JWT, AuthBridge), testcontainers-based DB tests, comprehensive testing documentation (TESTING.md), proper Helm chart security contexts
- Critical Gaps: No CI/CD pipeline whatsoever, no coverage tracking, no security scanning, 2 of 5 components have zero tests, no linting or static analysis
- Agent Rules Status: Missing

## Repository Overview

| Attribute | Value |
|-----------|-------|
| Repository | opendatahub-io/agent-ops |
| Type | Demo / Reference Architecture |
| Primary Language | Python (100%) |
| Framework | LangGraph, LangChain, FastMCP, A2A SDK |
| Source Lines | ~3,029 (application code) |
| Test Lines | ~1,763 (test code) |
| Test-to-Code Ratio | 0.58 (for components that have tests) |
| Components | 5 services (MCP server, banking agent, knowledge agent, orchestrator, playground) |
| Deployment | OpenShift via Helm charts and deploy scripts |

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 4.0/10 | Tests exist for 3 of 5 components; banking-agent, playground, and mcp-server lack unit tests |
| Integration/E2E | 4.0/10 | Testcontainers for pgvector DB tests; manual bash script for agent tests; no automated E2E |
| **Build Integration** | **0.0/10** | **No CI/CD pipeline; Dockerfiles never built or validated in automation** |
| Image Testing | 2.0/10 | UBI9 base images and some pinned digests; no scanning, no runtime validation |
| Coverage Tracking | 0.0/10 | No codecov, coveralls, or any coverage reporting |
| CI/CD Automation | 0.0/10 | No GitHub Actions, GitLab CI, or any CI/CD configuration |
| Agent Rules | 0.0/10 | No CLAUDE.md, AGENTS.md, or .claude/ directory |

## Critical Gaps

1. **No CI/CD pipeline of any kind**
   - Impact: All testing, building, and validation is entirely manual; regressions can merge undetected
   - Severity: HIGH
   - Effort: 8-16 hours
   - Detail: The repository has no `.github/workflows/`, no `.gitlab-ci.yml`, no Jenkinsfile, no Tekton pipelines. Every test run, every build, every validation step must be done manually by developers.

2. **No coverage tracking or enforcement**
   - Impact: Test coverage can silently decrease with no visibility into untested code paths
   - Severity: HIGH
   - Effort: 2-4 hours

3. **No container image security scanning**
   - Impact: Vulnerable dependencies and base image CVEs go undetected until production
   - Severity: HIGH
   - Effort: 2-4 hours

4. **Banking agent and MCP server have zero unit tests**
   - Impact: Core financial operations code (account updates, transactions, RLS enforcement) has no automated validation
   - Severity: HIGH
   - Effort: 8-12 hours
   - Detail: The banking-agent handles write operations (`update_account`, `create_transaction`) and the MCP server enforces Row-Level Security — both are critical security surfaces with no test coverage.

5. **No linting or static analysis**
   - Impact: Code quality issues, type errors, and style inconsistencies accumulate
   - Severity: MEDIUM
   - Effort: 2-4 hours

6. **No pre-commit hooks**
   - Impact: Developers can commit code without any local quality checks
   - Severity: MEDIUM
   - Effort: 1-2 hours

## Quick Wins

1. **Add a basic GitHub Actions CI workflow with pytest**
   - Effort: 2-4 hours
   - Impact: Automated test execution on every PR
   - Implementation:
   ```yaml
   # .github/workflows/ci.yml
   name: CI
   on: [pull_request]
   jobs:
     test:
       runs-on: ubuntu-latest
       strategy:
         matrix:
           component:
             - demos/redbank-demo/knowledge-agent
             - demos/redbank-demo/orchestrator-agent
             - demos/redbank-demo/langchain-pgvector
       steps:
         - uses: actions/checkout@v4
         - uses: astral-sh/setup-uv@v6
         - run: |
             cd ${{ matrix.component }}
             uv pip install --system ".[dev]"
             pytest tests/ -v --tb=short
   ```

2. **Add ruff for linting and formatting**
   - Effort: 1-2 hours
   - Impact: Catches bugs, enforces style consistency
   - Implementation: Add `[tool.ruff]` section to each `pyproject.toml`

3. **Add Trivy scanning to container builds**
   - Effort: 1-2 hours
   - Impact: Automated CVE detection for all 5 container images
   - Implementation:
   ```yaml
   - name: Trivy scan
     uses: aquasecurity/trivy-action@master
     with:
       image-ref: ${{ matrix.image }}
       severity: CRITICAL,HIGH
       exit-code: 1
   ```

4. **Add pytest-cov and codecov integration**
   - Effort: 2-3 hours
   - Impact: Coverage visibility and trend tracking

5. **Add pre-commit hooks (ruff, mypy, gitleaks)**
   - Effort: 1-2 hours
   - Impact: Local quality gate before code reaches the repository

6. **Create CLAUDE.md with test patterns**
   - Effort: 2-3 hours
   - Impact: Consistent AI-generated test quality across all components

## Detailed Findings

### CI/CD Pipeline

**Status: Non-existent**

The repository has absolutely no CI/CD configuration:
- No `.github/workflows/` directory
- No `.gitlab-ci.yml`
- No `Jenkinsfile`
- No Tekton pipelines
- No automated triggers of any kind

The `Makefile` provides local convenience targets (`test-pgvector`, `test-knowledge-agent`) but these are manual-only and require a running OpenShift cluster with port-forwarding.

**What needs to happen:**
- Create a GitHub Actions workflow for PR validation
- Run unit tests for all components in a matrix strategy
- Build Docker images to catch build failures
- Run linting and type checking
- Add integration tests with testcontainers (pgvector tests already use this)

### Test Coverage

**Unit Tests (4.0/10)**

Tests exist for 3 of 5 components:

| Component | Test Files | Test Lines | Source Lines | Ratio | Status |
|-----------|-----------|------------|-------------|-------|--------|
| knowledge-agent | 3 | 250 | 377 | 0.66 | Good coverage of tool filtering, LLM setup, bearer token forwarding |
| orchestrator-agent | 2 | 687 | 1,255 | 0.55 | Tests tools, K8s discovery, A2A client |
| langchain-pgvector | 3 + conftest | 238 | ~400 | 0.60 | Excellent testcontainers usage for RLS, schema, search |
| banking-agent | 0 | 0 | 384 | 0.00 | **No tests at all** |
| mcp-server | 0 | 0 | 738 | 0.00 | **No unit tests** (integration test exists but requires cluster) |
| playground | 0 | 0 | 275 | 0.00 | **No tests at all** |

**Positive test patterns observed:**
- Good use of `pytest-asyncio` for async code
- Clean mock patterns with `unittest.mock.AsyncMock`
- Testcontainers for database integration tests (pgvector)
- Podman compatibility in test fixtures
- Session-scoped fixtures for expensive resources

**Gaps:**
- Banking agent: Zero tests for `agent_executor.py` (the core agent logic), `agent.py` (tool creation, MCP client), and `__main__.py` (server startup)
- MCP server: Zero unit tests for `mcp_server.py` (607 lines — the largest single file, handling all MCP tool implementations and RLS enforcement)
- Playground: No tests for `server.py` (272 lines — HTTP routing, proxy logic)

### Integration Tests (4.0/10)

**Strengths:**
- `langchain-pgvector/tests/conftest.py`: Excellent testcontainers setup — spins up a pgvector container, bootstraps schema from `init.sql`, creates session-scoped fixtures with proper Podman compatibility
- `tests/test_mcp_rls.py`: Comprehensive 476-line integration test covering tool discovery, RLS scoping, admin/user roles, Keycloak token acquisition — but requires a running cluster
- `scripts/test-knowledge-agent.sh`: Manual A2A test script with 6 scenarios covering admin/user access, RLS, and write tool blocking

**Gaps:**
- All integration tests require a running OpenShift cluster
- No Kind/Minikube-based lightweight integration tests
- No contract tests between agents (A2A protocol validation)
- No automated E2E pipeline

### Code Quality

**Status: No tooling configured**

- No linting configuration: no `ruff.toml`, `.flake8`, `.pylintrc`
- No type checking: no `mypy.ini`, no `[tool.mypy]` in pyproject.toml
- No formatters: no `[tool.black]`, no `[tool.ruff.format]`
- No pre-commit hooks: no `.pre-commit-config.yaml`
- No static analysis tools of any kind

**pyproject.toml quality:**
- All 4 components have proper `pyproject.toml` files
- Python version constraints are specified (`>=3.12`)
- Dev dependencies are separated (`[project.optional-dependencies]`) in 2 of 4 components
- pytest configuration exists in 2 of 4 components

### Container Images

**Dockerfiles (2.0/10)**

5 Dockerfiles found, all using Red Hat UBI9 Python 3.12 base image (good practice).

| Component | Base Image | Digest Pinned | Multi-stage | Security Context |
|-----------|-----------|---------------|-------------|------------------|
| orchestrator-agent | ubi9/python-312 | Yes | No | USER 1001, group-writable |
| playground | ubi9/python-312 | Yes | No | USER 1001, group-writable |
| banking-agent | ubi9/python-312 | No (:latest) | No | Default (1001) |
| knowledge-agent | ubi9/python-312 | No (:latest) | No | Default (1001) |
| mcp-server | ubi9/python-312 | No (:latest) | No | Default (1001) |

**Positive practices:**
- UBI9 base images (Red Hat standard, regularly patched)
- Non-root container execution
- `uv` for fast dependency installation
- OpenShift arbitrary UID support in orchestrator/playground

**Gaps:**
- 3 of 5 Dockerfiles use `:latest` tag (not reproducible builds)
- No multi-stage builds (larger final images)
- No SBOM generation
- No image signing/attestation
- No vulnerability scanning
- No runtime validation tests
- No `.dockerignore` for mcp-server, orchestrator-agent, playground

### Security

**Application-Level Security (Strong)**
- Row-Level Security (RLS) in PostgreSQL — excellent data isolation
- JWT-based authentication with Keycloak
- AuthBridge sidecar injection for network-level auth
- Tool allow-listing in knowledge agent (blocks write operations)
- Admin role enforcement in banking agent
- Secrets managed via Kubernetes Secrets and Helm charts
- Proper security contexts in Helm charts (runAsNonRoot, drop ALL capabilities, allowPrivilegeEscalation: false)

**CI/CD Security (Non-existent)**
- No container scanning (Trivy, Snyk)
- No SAST/CodeQL
- No dependency scanning
- No secret detection (Gitleaks, TruffleHog)
- No `.gitleaks.toml` or `.trivyignore`
- No signed commits enforcement

### Agent Rules (Agentic Flow Quality)

**Status: Missing**

- No `CLAUDE.md` in repository root
- No `AGENTS.md`
- No `.claude/` directory
- No `.claude/rules/` for test creation guidance
- No `.claude/skills/` for custom skills

**Impact:** AI-assisted development produces inconsistent test patterns. Without agent rules, every AI session starts from scratch — no knowledge of the project's pytest-asyncio patterns, testcontainers usage, mock conventions, or the A2A SDK testing patterns.

**Recommendation:** Generate rules with `/test-rules-generator` covering:
- Unit test patterns (pytest + asyncio + mock for agents)
- Integration test patterns (testcontainers for pgvector)
- A2A protocol testing conventions
- MCP server tool testing patterns

## Recommendations

### Priority 0 (Critical)

1. **Create GitHub Actions CI workflow** — Run pytest across all components on every PR. Use a matrix strategy for each component directory. This is the single highest-impact improvement.

2. **Add unit tests for banking-agent and mcp-server** — These handle financial operations and security enforcement (RLS). The mcp-server is 607 lines with zero unit tests covering tool dispatch, JWT parsing, and RLS context setting.

3. **Add container image vulnerability scanning** — Trivy integration for all 5 Dockerfiles. Run on PR builds to catch CVEs before merge.

4. **Add coverage tracking with codecov** — Start with visibility (no enforcement), then add thresholds once baseline is established.

### Priority 1 (High Value)

1. **Add ruff linting/formatting and mypy type checking** — Single tool replaces flake8, isort, black. Add `[tool.ruff]` and `[tool.mypy]` to each `pyproject.toml`.

2. **Pin all Dockerfile base image digests** — banking-agent, knowledge-agent, and mcp-server currently use `:latest`, making builds non-reproducible.

3. **Create automated E2E test suite** — Use Kind or Minikube for lightweight cluster tests that don't require a full OpenShift environment. Test agent-to-agent communication and MCP server integration.

4. **Add pre-commit hooks** — ruff, mypy, gitleaks for local quality enforcement before code reaches the repository.

5. **Create comprehensive CLAUDE.md and .claude/rules/** — Document test patterns, conventions, and AI-assisted development guidelines.

### Priority 2 (Nice-to-Have)

1. **Add SAST scanning** — CodeQL or Semgrep for security analysis of Python code.
2. **Add Dockerfile linting** — hadolint for Dockerfile best practices.
3. **Add multi-architecture builds** — Support arm64 in addition to amd64.
4. **Add Helm chart testing** — chart-testing and helm-unittest for Helm chart validation.
5. **Add API contract testing** — Validate A2A protocol compliance between agents.
6. **Add load testing** — Test orchestrator agent routing under concurrent requests.

## Comparison to Gold Standards

| Dimension | agent-ops | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| CI/CD Automation | None | Multi-workflow, matrix | Periodic + PR | Comprehensive |
| Unit Tests | 3/5 components | Comprehensive Jest | N/A | Go testing + coverage |
| Integration Tests | Testcontainers (partial) | Contract tests | 5-layer validation | envtest |
| E2E Tests | Manual bash script | Cypress + Playwright | Image startup tests | Multi-version |
| Coverage Tracking | None | Codecov with enforcement | N/A | Codecov with thresholds |
| Image Testing | None | Build validation | Runtime + vulnerability | Build + scan |
| Security Scanning | None (app-level only) | Dependabot + CodeQL | Trivy + SBOM | Multiple scanners |
| Linting | None | ESLint + Prettier | Linters per language | golangci-lint |
| Agent Rules | None | Comprehensive | N/A | N/A |

## File Paths Reference

### Source Code
- `demos/redbank-demo/banking-agent/src/banking_agent/` — Banking operations agent (384 lines)
- `demos/redbank-demo/knowledge-agent/src/knowledge_agent/` — Knowledge/RAG agent (377 lines)
- `demos/redbank-demo/orchestrator-agent/src/redbank_orchestrator/` — Multi-agent orchestrator (1,255 lines)
- `demos/redbank-demo/mcp-server/redbank-mcp/` — MCP server with RLS (738 lines)
- `demos/redbank-demo/playground/` — Chat UI (275 lines)

### Test Files
- `demos/redbank-demo/knowledge-agent/tests/` — 3 test files (250 lines)
- `demos/redbank-demo/orchestrator-agent/tests/` — 2 test files (687 lines)
- `demos/redbank-demo/langchain-pgvector/tests/` — 3 test files + conftest (238 lines)
- `demos/redbank-demo/tests/test_mcp_rls.py` — Integration test (476 lines, requires cluster)

### Build/Deploy
- `demos/redbank-demo/*/Dockerfile` — 5 Dockerfiles
- `demos/redbank-demo/orchestrator-agent/charts/` — Helm chart
- `demos/redbank-demo/playground/charts/` — Helm chart
- `demos/redbank-demo/Makefile` — Build and deployment targets

### Configuration
- `demos/redbank-demo/*/pyproject.toml` — 4 Python project configs
- `demos/redbank-demo/TESTING.md` — Comprehensive testing documentation
- `demos/redbank-demo/OWNERS` — Code ownership
- `demos/redbank-demo/.env.example` — Environment variable template

### Kubernetes Manifests
- `demos/redbank-demo/postgres-db/` — PostgreSQL deployment + init.sql
- `demos/redbank-demo/*/agentruntime.yaml` — Kagenti AgentRuntime CRs
