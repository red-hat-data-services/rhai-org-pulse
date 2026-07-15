---
repository: "opendatahub-io/rhoai-mcp"
overall_score: 7.4
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "874 test functions across 68 test files with pytest + asyncio support"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "Integration tests present, LLM-based evals with DeepEval, but no live cluster E2E in CI"
  - dimension: "Build Integration"
    score: 6.5
    status: "Tekton/Konflux pipelines for PR and push, but no PR-time unit test execution in Konflux"
  - dimension: "Image Testing"
    score: 6.0
    status: "Multi-arch container build with attestation, but no runtime validation or startup testing in CI"
  - dimension: "Coverage Tracking"
    score: 5.5
    status: "Coverage generated with pytest-cov but no codecov integration, no enforcement thresholds"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "Well-organized GitHub Actions with concurrency control, caching, matrix testing, and eval pipeline"
  - dimension: "Agent Rules"
    score: 7.0
    status: "Strong CLAUDE.md with scaffold-plugin command, but no .claude/rules/ for test patterns"
critical_gaps:
  - title: "No coverage enforcement or threshold gating"
    impact: "Coverage can silently decrease without detection; no PR blocking on coverage regression"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container runtime validation in CI"
    impact: "Image startup failures or broken entrypoints not caught until deployment"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No security scanning (Trivy/CodeQL) in GitHub Actions"
    impact: "Vulnerabilities in dependencies or source code not detected before merge"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No codecov/coveralls integration"
    impact: "PR authors cannot see coverage impact of their changes; no historical coverage tracking"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No pre-commit hooks"
    impact: "Developers may push code that fails lint/format checks, wasting CI cycles"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add codecov integration to CI workflow"
    effort: "2-3 hours"
    impact: "PR-level coverage reporting, historical tracking, and regression detection"
  - title: "Add Trivy container scanning to container-build workflow"
    effort: "1-2 hours"
    impact: "Catch known vulnerabilities in base images and dependencies before merge"
  - title: "Add pre-commit hooks for ruff and mypy"
    effort: "1-2 hours"
    impact: "Catch lint/format/type issues locally before pushing"
  - title: "Add container startup test in CI"
    effort: "1-2 hours"
    impact: "Verify image starts and health endpoint responds before publishing"
  - title: "Generate .claude/rules/ for test patterns"
    effort: "2-3 hours"
    impact: "Improve AI-assisted test generation quality and consistency"
recommendations:
  priority_0:
    - "Add codecov integration with coverage threshold enforcement (e.g., 70% minimum, no regression allowed)"
    - "Add container vulnerability scanning (Trivy or Snyk) to the container-build workflow"
    - "Add CodeQL or Semgrep SAST scanning as a PR check"
  priority_1:
    - "Add container runtime validation step (build, start, health check) in CI"
    - "Create .claude/rules/ directory with test creation guidance for unit, integration, and eval tests"
    - "Add pre-commit-config.yaml with ruff, mypy, and secrets detection hooks"
  priority_2:
    - "Add SBOM generation to container build pipeline"
    - "Add dependency review action for PR dependency changes"
    - "Add performance/load testing for MCP server endpoints"
---

# Quality Analysis: rhoai-mcp

## Executive Summary

- **Overall Score: 7.4/10**
- **Repository Type**: MCP Server (Model Context Protocol) for Red Hat OpenShift AI
- **Primary Language**: Python 3.10+ (114 source files, 23,725 lines)
- **Framework**: FastMCP + Kubernetes Python client + Pydantic + pluggy
- **Key Strengths**: Excellent test coverage (874 test functions), sophisticated eval framework with DeepEval/LLM-as-judge, well-organized CI with matrix testing, strong CLAUDE.md documentation, Tekton/Konflux integration
- **Critical Gaps**: No coverage enforcement, no security scanning in GitHub Actions, no container runtime validation
- **Agent Rules Status**: CLAUDE.md present with comprehensive guidance; `.claude/commands/scaffold-plugin.md` provides excellent plugin scaffolding; no `.claude/rules/` directory for test patterns

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | 874 test functions across 68 files, pytest + asyncio, good mocking patterns |
| Integration/E2E | 7.0/10 | Integration tests + LLM evals with DeepEval, but no live cluster E2E in CI |
| **Build Integration** | **6.5/10** | **Tekton/Konflux PR + push pipelines, but no test execution in Konflux** |
| Image Testing | 6.0/10 | Multi-arch builds with attestation, but no runtime validation in CI |
| Coverage Tracking | 5.5/10 | pytest-cov generates XML, but no codecov, no thresholds, no enforcement |
| CI/CD Automation | 8.5/10 | Concurrency control, uv caching, Python 3.10/3.11/3.12 matrix, eval pipeline |
| Agent Rules | 7.0/10 | Strong CLAUDE.md + scaffold-plugin command, but no .claude/rules/ |

## Critical Gaps

### 1. No Coverage Enforcement or Threshold Gating
- **Impact**: Coverage can silently decrease without detection; PRs can merge regardless of coverage regression
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: While `pytest-cov` generates coverage XML and the CI uploads it as an artifact, there is no codecov/coveralls integration, no minimum coverage threshold, and no PR comment showing coverage delta. The `[tool.coverage.report]` section in `pyproject.toml` defines exclusion lines but no `fail_under` setting.

### 2. No Container Runtime Validation in CI
- **Impact**: Image startup failures, broken entrypoints, or misconfigured health checks not caught until deployment
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The `container-build.yml` workflow builds and pushes images but never starts the container to verify it launches and the health endpoint responds. The Makefile has a `test-build` target (`podman run --rm $(FULL_IMAGE) --version`) that could serve as a model.

### 3. No Security Scanning in GitHub Actions
- **Impact**: Vulnerabilities in Python dependencies or source code not detected before merge
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: While a `.snyk` policy file exists (suggesting Snyk may be configured externally), there are no Trivy, CodeQL, Semgrep, or Gitleaks workflows in `.github/workflows/`. The Tekton/Konflux pipeline may include scanning via the centralized `multi-arch-container-build.yaml`, but this happens post-merge only for PRs.

### 4. No Codecov/Coveralls Integration
- **Impact**: PR authors cannot see coverage impact; no historical coverage trending
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: Coverage XML is generated and uploaded as a GitHub artifact but never sent to a coverage service. No PR comments or status checks showing coverage delta.

### 5. No Pre-commit Hooks
- **Impact**: Developers may push code that fails lint/format/type checks
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: No `.pre-commit-config.yaml` file. All quality checks happen in CI only, which means wasted CI cycles on trivially fixable issues.

## Quick Wins

### 1. Add Codecov Integration (2-3 hours)
Add codecov upload step to the CI workflow:
```yaml
- name: Upload coverage to Codecov
  if: matrix.python-version == '3.12'
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage.xml
    fail_ci_if_error: true
    token: ${{ secrets.CODECOV_TOKEN }}
```

### 2. Add Trivy Container Scanning (1-2 hours)
Add to `container-build.yml` after the build step:
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
```

### 3. Add Pre-commit Hooks (1-2 hours)
Create `.pre-commit-config.yaml`:
```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.4.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.10.0
    hooks:
      - id: mypy
        additional_dependencies: [pydantic]
```

### 4. Add Container Startup Test in CI (1-2 hours)
Add to `container-build.yml`:
```yaml
- name: Test container startup
  run: |
    docker run -d --name test-mcp -p 8000:8000 \
      -e RHOAI_MCP_TRANSPORT=sse \
      ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} --transport sse
    sleep 5
    curl -sf http://localhost:8000/health || exit 1
    docker stop test-mcp
```

### 5. Generate .claude/rules/ for Test Patterns (2-3 hours)
Use `/test-rules-generator` to create rules covering:
- Unit test patterns (mock K8s client, domain structure)
- Integration test patterns (plugin discovery, health checks)
- Eval test patterns (DeepEval metrics, mock cluster)

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory:**
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | push/PR to main | Lint (ruff), typecheck (mypy), tests (pytest matrix) |
| `container-build.yml` | CI success on main, tags, manual | Multi-arch build, push to GHCR, attestation |
| `eval.yml` | Manual dispatch, PR comment (`@run_evals`) | LLM-based MCP evaluation with DeepEval |

**Strengths:**
- Concurrency control with `cancel-in-progress: true` prevents duplicate runs
- `uv` caching via `astral-sh/setup-uv@v6` for fast dependency resolution
- Python version matrix (3.10, 3.11, 3.12) ensures broad compatibility
- CI status gate job ensures all checks pass before proceeding
- Eval workflow supports multiple LLM providers (Google Vertex, OpenAI, Anthropic, vLLM, Azure)
- Eval results posted as PR comments with trend analysis

**Gaps:**
- No codecov upload step despite generating coverage XML
- No dependency review or license scanning
- Container build doesn't validate the image runs correctly
- No SAST/security scanning workflow

**Tekton/Konflux:**
- Pull request pipeline: builds image to `quay.io/opendatahub/odh-rhoai-mcp:odh-pr`
- Push pipeline: builds image to `quay.io/opendatahub/odh-rhoai-mcp:odh-stable`
- Both use centralized `odh-konflux-central` pipeline (multi-arch-container-build)
- No test execution in Tekton pipelines (tests only run in GitHub Actions)

### Test Coverage

**Metrics:**
| Metric | Value |
|--------|-------|
| Source files | 114 (.py) |
| Source lines | 23,725 |
| Test files | 97 (68 unit + 29 support) |
| Test lines | 17,585 |
| Test functions | 874 |
| Test-to-code ratio | 0.74:1 (lines), 0.85:1 (files) |
| Eval scenarios | 5 (with DeepEval LLM-as-judge) |

**Test Organization:**
- `tests/` — Unit and integration tests (excluded from evals)
  - `tests/auth/` — 11 test files covering OIDC, RBAC, token review, impersonation, middleware
  - `tests/training/` — Training domain (client, models, CRDs, tools)
  - `tests/domains/` — Per-domain tests (model_registry, prompts, projects, pipelines, inference, connections, storage, notebooks)
  - `tests/composites/` — Composite module tests (planner, training, meta, cluster)
  - `tests/integration/` — Plugin discovery, tool registration, permissions, health checks, CRD definitions
  - `tests/utils/` — Utility tests (cache, response, workflow_token)
- `evals/` — LLM evaluation framework
  - 5 eval scenarios (cluster exploration, model deployment, tool discovery, training workflow, troubleshooting)
  - Mock K8s cluster for deterministic evaluation
  - DeepEval metrics with LLM-as-judge scoring
  - Reporting/trending infrastructure for historical comparison

**Testing Framework:** pytest with `asyncio_mode = "auto"`, `pytest-asyncio`, `pytest-cov`

**Strengths:**
- Excellent test-to-code ratio for a project this size
- Well-organized test hierarchy mirrors source layout
- Strong fixture usage with conftest.py per test directory
- Mock K8s client pattern is consistent and well-implemented
- LLM evaluation framework is sophisticated with multi-provider support
- Eval reporting includes trend analysis and comparison features

**Gaps:**
- No coverage thresholds or enforcement
- No contract tests between domain and composite layers
- Integration tests don't exercise the full MCP protocol flow
- No performance or load testing for the server

### Code Quality

**Linting & Formatting:**
- **Ruff**: Configured in `pyproject.toml` with comprehensive rule set (E, W, F, I, B, C4, UP, ARG, SIM)
- Per-file ignores for mock_client.py (ARG002, SIM102)
- Line length: 100 characters
- isort integration via ruff

**Type Checking:**
- **mypy** with `disallow_untyped_defs = true` (strict mode)
- Pydantic plugin enabled
- Python 3.10 target version

**Static Analysis:**
- `.snyk` policy file present (Snyk may be configured externally)
- No CodeQL, Semgrep, or SAST workflows in `.github/`
- No Gitleaks or secret detection

**Pre-commit Hooks:**
- **Not configured** — no `.pre-commit-config.yaml`

### Container Images

**Containerfile Analysis:**
- Multi-stage build (builder + runtime)
- Red Hat UBI 9 / Python 3.12 base images (enterprise-grade)
- `uv` for dependency installation (fast, reproducible)
- Non-root execution (UID 1001)
- Health check endpoint configured
- OCI labels for metadata
- Multi-arch support (linux/amd64, linux/arm64) via QEMU + buildx
- Installs CLI tools: git, helm (pinned + checksum verified), oc (pinned)
- Build attestation with `actions/attest-build-provenance`

**Strengths:**
- Production-quality Containerfile with security best practices
- Multi-stage build minimizes image size
- UBI base images for enterprise compliance
- Pinned tool versions with checksum verification (helm)
- Build provenance attestation

**Gaps:**
- No Trivy/Grype scanning of built images in CI
- No SBOM generation
- No container startup validation in CI
- `oc` CLI version pinned to `stable-4.18` (not a specific hash)

### Security

**Strengths:**
- Snyk policy file present (`.snyk`)
- Non-root container execution
- UBI base images (Red Hat security patches)
- Helm installed with SHA256 checksum verification
- Build attestation for supply chain integrity
- Auth system with OIDC, RBAC, token review, and impersonation
- Safety configuration (read-only mode, dangerous operations flag)

**Gaps:**
- No Trivy/CodeQL/Semgrep workflows in GitHub Actions
- No Gitleaks or secret detection in CI
- No dependency review action for PRs
- `.snyk` excludes tests and evals entirely — no scanning of test dependencies

### Agent Rules (Agentic Flow Quality)

**Status: Present but Incomplete**

**CLAUDE.md** (7,643 lines — comprehensive):
- Complete project overview with architecture
- Build/dev/test commands
- Domain vs composite plugin structure
- Plugin hooks documentation
- Configuration reference
- Development principles (TDD, simplicity, idiomatic Python)
- Code style guidelines

**.claude/commands/scaffold-plugin.md**:
- Excellent plugin scaffolding command
- Complete templates for domain and composite plugins
- Test file templates included
- Registry integration guidance
- Post-generation verification steps

**Gaps:**
- No `.claude/rules/` directory for test automation patterns
- No rules for unit test patterns (mock K8s client, conftest structure)
- No rules for integration test patterns (plugin discovery, health checks)
- No rules for eval test patterns (DeepEval, mock cluster)
- Missing guidance on coverage requirements and testing standards

## Recommendations

### Priority 0 (Critical)
1. **Add codecov integration with coverage threshold enforcement** — Configure `fail_under: 70` in `pyproject.toml` and add codecov upload to CI. This prevents silent coverage regression.
2. **Add container vulnerability scanning** — Add Trivy or Snyk scanning to `container-build.yml`. The existing `.snyk` file suggests Snyk is available; integrate it directly into CI.
3. **Add CodeQL or Semgrep SAST scanning** — Create a dedicated security scanning workflow triggered on PRs. Python SAST catches common issues like SQL injection, command injection, and insecure deserialization.

### Priority 1 (High Value)
4. **Add container runtime validation** — After building the image, start it and verify the health endpoint responds. Use the existing `test-build` Makefile target as a model.
5. **Create .claude/rules/ directory** — Generate rules for unit, integration, and eval test patterns using `/test-rules-generator`. The project has consistent patterns that can be codified.
6. **Add pre-commit hooks** — Create `.pre-commit-config.yaml` with ruff and mypy. This catches issues locally and reduces CI cycle waste.

### Priority 2 (Nice-to-Have)
7. **Add SBOM generation** — Use `syft` or `cosign` to generate SBOMs for container images. Important for supply chain compliance.
8. **Add dependency review action** — Use `actions/dependency-review-action` to catch known-vulnerable dependency updates in PRs.
9. **Add performance testing** — The MCP server handles Kubernetes API calls; load testing would catch performance regressions in the tool execution path.
10. **Add contract tests** — Define and test the interface between domain modules and composite modules to prevent breaking changes across module boundaries.

## Comparison to Gold Standards

| Dimension | rhoai-mcp | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | 8.5 - 874 functions | 9.0 - Multi-layer | 7.0 - Image focused | 8.5 - Strong coverage |
| Integration/E2E | 7.0 - LLM evals | 9.0 - Contract tests | 8.0 - 5-layer validation | 9.0 - Multi-version |
| Build Integration | 6.5 - Konflux present | 7.0 - PR builds | 6.0 - Periodic | 7.5 - PR builds |
| Image Testing | 6.0 - Multi-arch | 7.0 - Build + startup | 9.0 - Gold standard | 7.0 - Runtime |
| Coverage | 5.5 - Generated only | 8.0 - Enforced | 6.0 - Basic | 9.0 - Codecov + thresholds |
| CI/CD | 8.5 - Matrix + evals | 9.0 - Comprehensive | 8.0 - Multi-stage | 8.5 - Well-organized |
| Agent Rules | 7.0 - CLAUDE.md + scaffold | 9.0 - Full rules | 3.0 - None | 2.0 - None |
| **Overall** | **7.4** | **8.4** | **6.7** | **7.6** |

**Notable**: rhoai-mcp's LLM-based evaluation framework with DeepEval is unique among the compared repositories and represents a sophisticated quality practice for MCP/AI projects.

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yml` — Lint, typecheck, test (matrix)
- `.github/workflows/container-build.yml` — Multi-arch container build + push
- `.github/workflows/eval.yml` — MCP evaluation with DeepEval
- `.tekton/odh-rhoai-mcp-pull-request.yaml` — Konflux PR pipeline
- `.tekton/odh-rhoai-mcp-push.yaml` — Konflux push pipeline
- `Makefile` — Development, testing, container, and eval targets

### Testing
- `tests/` — 68 test files, 874 test functions
- `tests/integration/` — Plugin and tool integration tests
- `tests/auth/` — Authentication and authorization tests
- `tests/domains/` — Domain-specific unit tests
- `tests/composites/` — Composite module tests
- `evals/` — LLM evaluation framework (DeepEval)
- `evals/scenarios/` — 5 eval scenarios

### Code Quality
- `pyproject.toml` — Ruff, mypy, pytest, coverage configuration
- `.snyk` — Snyk vulnerability policy

### Container
- `Containerfile` — Multi-stage UBI 9 build
- `docker-compose.eval.yml` — Eval stack (MCP + Llama Stack + LCS)
- `.dockerignore` / `.containerignore` — Build context exclusions

### Agent Rules
- `CLAUDE.md` — Comprehensive project documentation for Claude Code
- `.claude/commands/scaffold-plugin.md` — Plugin scaffolding command
