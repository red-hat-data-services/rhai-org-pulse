---
repository: "red-hat-data-services/notebooks"
overall_score: 8.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Comprehensive pytest suite with 247 test functions, subtests, pyfakefs mocking, Go tests, strict markers, and allure integration"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Multi-layer container integration tests with testcontainers, Playwright browser E2E, runtime smoke tests, manifest validation, and K8s notebook tests"
  - dimension: "Build Integration"
    score: 8.5
    status: "PR-time image builds with smart changed-file matrix, ODH/RHOAI variants, multi-platform support, and Tekton/Konflux pipelines"
  - dimension: "Image Testing"
    score: 9.5
    status: "Gold-standard 5-layer image validation: base image tests, workbench startup, runtime library checks, GPU library loading, and manifest annotation validation via SBOM"
  - dimension: "Coverage Tracking"
    score: 7.5
    status: "Codecov integration with Python and Go flags, carryforward, informational status on PRs, but no hard enforcement thresholds"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "40+ GitHub Actions workflows with concurrency control, path filtering, template reuse, SHA-pinned actions, and Renovate self-hosted for dependency updates"
  - dimension: "Agent Rules"
    score: 9.0
    status: "Comprehensive CLAUDE.md, AGENTS.md, cursor rules, testing docs, and agent skills directory — best-in-class AI agent guidance"
critical_gaps:
  - title: "No hard coverage enforcement threshold"
    impact: "Coverage can silently regress without failing CI; informational-only Codecov checks"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "Container integration tests skip fork PRs"
    impact: "External contributors get no integration test feedback on their PRs"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "Some CI checks not exposed as Makefile targets"
    impact: "yamllint, hadolint, gotestsum, prek run inline in CI — local dev parity gap (tracked as issue #3174)"
    severity: "LOW"
    effort: "4-6 hours"
quick_wins:
  - title: "Add coverage enforcement threshold to Codecov config"
    effort: "1-2 hours"
    impact: "Prevent silent coverage regression by failing PRs that drop below threshold"
  - title: "Expose yamllint and hadolint as Makefile targets"
    effort: "2-3 hours"
    impact: "Local dev parity with CI, faster feedback loop before push"
  - title: "Add agent skills beyond README placeholder"
    effort: "3-4 hours"
    impact: "Enable AI agents to leverage repository-specific automation skills"
recommendations:
  priority_0:
    - "Set Codecov coverage threshold to fail PRs that regress significantly (e.g., target: auto, threshold: 5%)"
    - "Consider enabling container integration tests for fork PRs with reduced scope (read-only, no secrets needed)"
  priority_1:
    - "Extract inline CI checks (yamllint, hadolint, gotestsum, prek) into Makefile targets for local parity"
    - "Add performance regression tests for notebook startup time"
    - "Populate .agents/skills/ with repository-specific automation skills"
  priority_2:
    - "Add contract tests between manifests and ImageStream consumers (odh-dashboard, operator)"
    - "Add chaos/resilience testing for notebook pod recovery scenarios"
    - "Consider adding mutation testing for critical path code"
---

# Quality Analysis: red-hat-data-services/notebooks

## Executive Summary

- **Overall Score: 8.6/10**
- **Repository Type**: Container image build monorepo (Jupyter, Code-Server, and runtime images)
- **Primary Languages**: Python (tests, CI, tooling), Go (buildinputs), TypeScript (browser tests), Bash/Make (build system)
- **Framework**: Multi-stage Dockerfile builds on CentOS 9 Stream (ODH) and RHEL 9.6 EUS (RHOAI)
- **Key Strengths**: Gold-standard image testing, comprehensive security scanning, exceptional agent documentation, smart PR build matrix
- **Critical Gaps**: No hard coverage enforcement, some CI checks not local-reproducible
- **Agent Rules Status**: **Exemplary** — CLAUDE.md, AGENTS.md, cursor rules, agent testing docs, and skills directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Comprehensive pytest suite with 247 test functions, strict markers, allure integration |
| Integration/E2E | 9.0/10 | Multi-layer container tests with testcontainers, Playwright browser E2E, K8s notebook smoke |
| **Build Integration** | **8.5/10** | **PR-time image builds with changed-file matrix, ODH/RHOAI variants, Tekton/Konflux pipelines** |
| Image Testing | 9.5/10 | Gold-standard 5-layer validation: base image, workbench startup, runtime libs, GPU loading, manifest SBOM |
| Coverage Tracking | 7.5/10 | Codecov with Python/Go flags, carryforward, informational-only (no hard threshold) |
| CI/CD Automation | 9.0/10 | 40+ workflows, concurrency control, path filtering, template reuse, SHA-pinned actions |
| Agent Rules | 9.0/10 | Best-in-class: CLAUDE.md, AGENTS.md, cursor rules, testing docs, skills directory |

## Critical Gaps

### 1. No Hard Coverage Enforcement Threshold
- **Impact**: Coverage can silently regress; Codecov checks are informational only (`informational: true`)
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Current config**: `.codecov.yml` sets `informational: true` for both project and patch coverage
- **Fix**: Change to `informational: false` and set `threshold: 5%` to fail PRs with significant regression

### 2. Container Integration Tests Skip Fork PRs
- **Impact**: External contributors get no integration test feedback; fork PRs are explicitly filtered out
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Workaround**: Contributors must push to main repo branch for full CI
- **Note**: This is a security/secrets trade-off, not an oversight

### 3. Some CI Checks Not Exposed as Makefile Targets
- **Impact**: yamllint, hadolint, gotestsum, and prek run inline in CI workflows — developers can't reproduce locally with a single `make` command
- **Severity**: LOW
- **Effort**: 4-6 hours
- **Tracked**: Issue [#3174](https://github.com/opendatahub-io/notebooks/issues/3174)

## Quick Wins

### 1. Add Coverage Enforcement Threshold (1-2 hours)
Change `.codecov.yml` to enforce thresholds:
```yaml
coverage:
  status:
    project:
      default:
        informational: false  # was: true
        target: auto
        threshold: 5%
    patch:
      default:
        informational: false  # was: true
        target: 80%
```

### 2. Expose Inline CI Checks as Makefile Targets (2-3 hours)
Add targets for local reproducibility:
```makefile
.PHONY: lint-yaml lint-docker lint-actions
lint-yaml:
	yamllint .
lint-docker:
	hadolint $(shell find . -name 'Dockerfile*' -not -path './.git/*')
lint-actions:
	pinact run --check --verify
```

### 3. Populate Agent Skills Directory (3-4 hours)
The `.agents/skills/` directory exists but contains only a README. Add repository-specific skills for common tasks (CVE fix workflow, new image creation, dependency updates).

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory (40+ workflows)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build-notebooks-pr.yaml` | PR | Build changed images with smart matrix detection |
| `build-notebooks-pr-rhel.yaml` | PR | RHEL subscription builds (non-fork only) |
| `build-notebooks-pr-aipcc.yaml` | PR | AIPCC variant builds |
| `build-notebooks-push.yaml` | Push/Schedule/Dispatch | Full build on main/stable/rhoai-* |
| `build-notebooks-TEMPLATE.yaml` | Reusable | Template for all image builds |
| `code-quality.yaml` | PR/Push | Pytest, code generation check, coverage upload |
| `test-containers.yaml` | PR/Push | Container integration tests with testcontainers |
| `codeql.yaml` | PR/Push/Schedule | CodeQL SAST for Python and Go |
| `security.yaml` | PR/Push | Trivy filesystem scan |
| `semgrep.yaml` | PR/Push/Schedule | Semgrep with 1873-line custom ruleset |
| `gitleaks.yaml` | PR/Push/Schedule | Secret detection with custom config |
| `params-env.yaml` | PR/Push | Validate image references in manifests |
| `software-versions.yaml` | PR | Validate software version annotations |
| `renovate-self-hosted.yaml` | Schedule | Automated dependency updates |
| `test-trivy-scan-action.yaml` | PR/Push | Self-test for Trivy scanning action |

**Strengths**:
- Concurrency control on all PR workflows with `cancel-in-progress`
- Smart changed-file detection for PR builds (only builds affected images)
- SHA-pinned GitHub Actions with `pinact` enforcement
- Template reuse via `workflow_call` for build jobs
- Multi-platform support (amd64, arm64, ppc64le, s390x)
- Fork detection with helpful guidance annotations

### Test Coverage

**Test Architecture (5 layers)**:

1. **Static/Manifest Tests** (`tests/test_*.py`): Module-level functions with `subtests` for bulk assertions over manifests, configs, and lockfiles
2. **Unit Tests** (`tests/unit/`): Mirror source layout, test scripts and CI tooling with `pyfakefs` for filesystem mocking
3. **Container Integration Tests** (`tests/containers/`): Class-based tests using `testcontainers` and `docker` Python SDK
4. **Browser E2E Tests** (`tests/browser/`): Playwright tests for Code-Server and OpenShift console
5. **K8s Notebook Smoke Tests**: Shell scripts via `papermill` for live workbench validation

**Test Metrics**:
- 48 Python test files, 11 TypeScript test files, 2 Go test files
- 247 test functions, 21 test classes
- ~11,500 lines of test code (Python)
- Strict markers enforced via `pytest.ini`
- allure-pytest integration for issue tracking and step decoration

**Container Test Highlights**:
- `base_image_test.py`: ELF linking validation, Python environment checks
- `workbench_image_test.py`: Entrypoint startup, IPv6 connectivity, log verification
- `runtime_test.py`: Library loading (pyzmq, MLflow, feast), architecture-aware skips
- `accelerator_image_test.py`: GPU library loading tests
- `manifest_validation_test.py`: SBOM-based and pip-list-based version annotation verification
- `params_env_validation_test.py`: Image reference validation

### Code Quality

**Linting and Formatting**:
- **Ruff**: Linting and formatting for Python/Jupyter (v0.15.4)
- **Pyright**: Type checking on Python 3.14 for `ci/` and `tests/`
- **Pre-commit hooks**: 6 hooks including ruff-check, ruff-format, gitleaks, pyright, uv-lock, and standard file checks
- **EditorConfig**: Consistent formatting across editors
- **CodeRabbit**: AI-powered code review configuration

**Static Analysis**:
- **CodeQL**: Python and Go SAST on PRs, pushes, and weekly schedule
- **Semgrep**: 1873-line custom ruleset covering Go, Python, TypeScript, YAML, and generic secrets detection
- **Gitleaks**: Secret detection with custom `.gitleaks.toml` allowing test fixtures
- **Trivy**: Filesystem vulnerability scanning with custom config for non-standard Python requirements files

### Container Images

**Build Process**:
- Multi-stage Dockerfiles: Each image is self-contained, not inheriting from other notebook images
- Platform support: linux/amd64, linux/arm64, linux/ppc64le, linux/s390x
- ODH (CentOS 9 Stream) and RHOAI (RHEL 9.6 EUS) build variants
- Konflux/Tekton pipelines (19 pipeline definitions in `.tekton/`)
- Hermetic build support via `cachi2` and `prefetch-input`

**Image Types**:
- Base images: cpu, cuda (12.9, 13.0), rocm (7.1)
- Jupyter workbenches: minimal, datascience, trustyai, pytorch, tensorflow, pytorch+llmcompressor
- Runtime images: minimal, datascience, pytorch, tensorflow, rocm variants
- Code-Server workbench

**Runtime Testing**:
- Image entrypoint startup validation
- IPv6 connectivity testing
- Functional library testing (pyzmq, MLflow, feast)
- GPU library loading tests (CUDA, ROCm)
- ELF binary linking verification
- Log capture and analysis

**Security Scanning**:
- Trivy with SARIF output uploaded to GitHub Security tab
- Syft SBOM generation (configured to exclude source scan, image scan only)
- Cosign-based SBOM verification for manifest validation
- Weekly Quay vulnerability reports (`sec-scan.yml`)
- Supply-chain hardening: `uv` `exclude-newer` set to 3 days

### Security

**Comprehensive multi-tool approach**:
- **Trivy**: Filesystem scan on PRs + image scan in build pipeline
- **CodeQL**: Python and Go SAST
- **Semgrep**: Custom rules (1873 lines) covering OWASP patterns, secrets, Kubernetes-specific risks
- **Gitleaks**: Pre-commit + CI with smart test fixture exclusions
- **Syft**: SBOM generation for all images
- **Renovate**: Self-hosted dependency update bot
- **pinact**: SHA-pinned GitHub Actions enforcement
- **Supply-chain hardening**: `uv exclude-newer = "3 days"` prevents installing packages published < 3 days ago

### Agent Rules (Agentic Flow Quality)

**Status**: **Exemplary** — best-in-class across OpenDataHub ecosystem

**Coverage**:

| Resource | Purpose | Quality |
|----------|---------|---------|
| `CLAUDE.md` | Claude Code entry point, references cursor rules | Good — terse, links to details |
| `AGENTS.md` | Comprehensive agent guide (77 lines) | Excellent — role-aware, linked docs, boundaries |
| `.cursor/rules/test-conventions.mdc` | Test creation rules (globs-scoped) | Excellent — patterns, markers, frameworks, examples |
| `.cursor/rules/jira-conventions.mdc` | Jira MCP conventions | Good — project-specific customs |
| `docs/agents/testing.md` | Full test catalog for agents | Excellent — types, commands, CI parity, troubleshooting |
| `.github/AGENTS.md` | GitHub Actions agent guide | Linked, domain-specific |
| `tests/browser/AGENTS.md` | Playwright test agent guide | Linked, domain-specific |
| `.coderabbit.yaml` | AI code review configuration | Detailed PR title/scope rules |
| `.agents/skills/` | Agent skills directory | Exists but only has README (placeholder) |

**Gaps**:
- `.agents/skills/` directory has no actual skills yet (just README)
- No `.claude/rules/` directory (uses `.cursor/rules/` instead)

**Recommendation**: The agent documentation is among the best observed. The only improvement would be populating `.agents/skills/` with concrete automation skills and considering `.claude/rules/` for Claude Code-specific patterns.

## Recommendations

### Priority 0 (Critical)

1. **Set Codecov coverage enforcement** — Change `informational: true` to `false` in `.codecov.yml` to prevent silent coverage regression. Set a reasonable threshold (e.g., 5% for project, 80% for patch).

2. **Consider fork PR integration test strategy** — Even a reduced-scope container test (no secrets needed) would help external contributors catch issues early.

### Priority 1 (High Value)

3. **Extract inline CI checks into Makefile targets** — yamllint, hadolint, gotestsum, and prek currently run inline in workflows. Expose as `make lint-yaml`, `make lint-docker`, etc. for local parity (issue #3174).

4. **Populate .agents/skills/ with concrete skills** — Add skills for common workflows: CVE triage, new image creation, dependency updates, lockfile regeneration.

5. **Add notebook startup performance regression tests** — Track image startup time trends to catch performance regressions from dependency changes.

### Priority 2 (Nice-to-Have)

6. **Add contract tests between manifests and downstream consumers** — Validate that ImageStream annotations remain compatible with odh-dashboard and operator expectations.

7. **Add chaos/resilience testing** — Test notebook pod recovery scenarios, OOM handling, and resource exhaustion.

8. **Consider mutation testing** — Apply mutation testing to critical path code (manifest parsing, build matrix generation) to validate test effectiveness.

## Comparison to Gold Standards

| Dimension | notebooks (this repo) | odh-dashboard | kserve | Industry Best |
|-----------|----------------------|---------------|--------|---------------|
| Unit Tests | 8.5 — pytest + Go, subtests, pyfakefs, allure | 9.0 — Jest, comprehensive | 9.0 — Go testing, table-driven | 9.0 |
| Integration/E2E | 9.0 — testcontainers, Playwright, K8s smoke | 9.0 — Cypress, contract tests | 8.5 — envtest, multi-version | 9.0 |
| Build Integration | 8.5 — Smart PR matrix, Konflux/Tekton | 7.0 — Standard PR builds | 8.0 — Multi-platform | 8.5 |
| Image Testing | **9.5** — **Gold standard**, 5-layer validation | 6.0 — Basic builds | 7.0 — Image builds | 8.0 |
| Coverage Tracking | 7.5 — Codecov informational | 8.5 — Codecov enforced | 8.0 — Enforced thresholds | 9.0 |
| CI/CD Automation | 9.0 — 40+ workflows, SHA-pinning, template reuse | 8.5 — Well-organized | 8.5 — Comprehensive | 9.0 |
| Security | 9.5 — Trivy + CodeQL + Semgrep + Gitleaks + Syft + supply-chain hardening | 7.5 — Basic scanning | 8.0 — SAST + scanning | 9.0 |
| Agent Rules | **9.0** — **Best-in-class**, multi-tool, domain-specific docs | 8.0 — Good coverage | 3.0 — Minimal | 7.0 |

**This repository is the gold standard for image testing** in the OpenDataHub ecosystem, with the most comprehensive container validation pipeline observed. Its security posture is also exceptional, with 5+ scanning tools and supply-chain hardening.

## File Paths Reference

### CI/CD
- `.github/workflows/` — 40+ workflow files
- `.github/workflows/build-notebooks-TEMPLATE.yaml` — Reusable build template
- `.github/workflows/code-quality.yaml` — Main code quality pipeline
- `.github/workflows/test-containers.yaml` — Container integration tests
- `.tekton/` — 19 Tekton/Konflux pipeline definitions
- `Makefile` — Build and test targets

### Testing
- `tests/test_*.py` — Static/manifest tests
- `tests/unit/` — Unit tests
- `tests/containers/` — Container integration tests
- `tests/containers/workbenches/` — Workbench image tests
- `tests/containers/runtimes/` — Runtime image tests
- `tests/browser/tests/` — Playwright E2E tests
- `scripts/buildinputs/*_test.go` — Go tests
- `pytest.ini` — Pytest configuration
- `pyproject.toml` — Dependencies and tool config

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks (ruff, gitleaks, pyright, uv-lock)
- `semgrep.yaml` — 1873-line custom Semgrep ruleset
- `.gitleaks.toml` — Gitleaks secret detection config
- `trivy.yaml` — Trivy vulnerability scanning config
- `.syft.yaml` — Syft SBOM generation config
- `.codecov.yml` — Code coverage configuration
- `.coderabbit.yaml` — AI code review configuration

### Agent Rules
- `CLAUDE.md` — Claude Code entry point
- `AGENTS.md` — Comprehensive AI agent guide
- `.cursor/rules/test-conventions.mdc` — Test creation patterns
- `.cursor/rules/jira-conventions.mdc` — Jira conventions
- `docs/agents/testing.md` — Test catalog for agents
- `.agents/skills/` — Agent skills directory (placeholder)

### Container Images
- `base-images/` — Base image Dockerfiles (cpu, cuda, rocm)
- `jupyter/` — Jupyter workbench Dockerfiles
- `runtimes/` — Runtime image Dockerfiles
- `codeserver/` — Code-Server workbench Dockerfile
- `manifests/` — ImageStream manifests and params.env files
