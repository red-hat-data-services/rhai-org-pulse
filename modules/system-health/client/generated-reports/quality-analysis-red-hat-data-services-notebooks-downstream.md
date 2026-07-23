---
repository: "red-hat-data-services/notebooks-downstream"
overall_score: 7.2
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Good pytest + testcontainers suite; container-focused tests appropriate for repo type"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Excellent K8s cluster testing, Playwright browser tests, FIPS compliance checks on every build"
  - dimension: "Build Integration"
    score: 9.0
    status: "PR-time image builds with smart change detection, Konflux pipelines, kustomize validation"
  - dimension: "Image Testing"
    score: 9.0
    status: "Outstanding multi-layer validation: testcontainers, K8s deployment, check-payload FIPS, Trivy, Hadolint"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No code coverage tracking — no codecov, no pytest-cov, no coverage thresholds"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "16 GHA workflows + 35 Tekton pipelines, matrix builds, concurrency control, caching, daily builds"
  - dimension: "Static Analysis"
    score: 8.0
    status: "Comprehensive Ruff + Pyright + Hadolint + yamllint; Renovate covers Tekton/Dockerfile but not pip"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory present"
critical_gaps:
  - title: "No code coverage tracking"
    impact: "Cannot measure or enforce test coverage — regressions in test quality go undetected"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No AI agent rules for test creation"
    impact: "AI-generated tests lack project-specific patterns and standards"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "Renovate does not cover Python/pip dependencies"
    impact: "Python dependency updates are manual — security vulnerabilities and stale libraries may accumulate"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add pytest-cov and codecov integration"
    effort: "2-4 hours"
    impact: "Visibility into test coverage with PR reporting and threshold enforcement"
  - title: "Extend Renovate to cover pip/pyproject.toml"
    effort: "30 minutes"
    impact: "Automated Python dependency updates alongside existing Tekton/Dockerfile coverage"
  - title: "Create CLAUDE.md with test creation rules"
    effort: "2-3 hours"
    impact: "Consistent AI-generated tests following project patterns (testcontainers, pytest markers)"
recommendations:
  priority_0:
    - "Add pytest-cov to CI and configure codecov with coverage thresholds to catch test quality regressions"
    - "Extend Renovate configuration to include pip ecosystem for automated Python dependency updates"
  priority_1:
    - "Create CLAUDE.md and .claude/rules/ with test creation guidance for testcontainers, Playwright, and pytest marker patterns"
    - "Add multi-version Kubernetes testing (test against K8s 1.31 and 1.33 to match OCP versions)"
  priority_2:
    - "Add test coverage for ROCm-specific code paths in container tests"
    - "Consider adding contract tests between image manifests and operator expectations"
---

# Quality Analysis: notebooks-downstream

## Executive Summary

- **Overall Score: 7.2/10**
- **Repository Type**: Container image build repository (Jupyter notebooks, workbench images, model serving runtimes)
- **Primary Languages**: Python, Dockerfiles, Shell, TypeScript (Playwright), Go (helper tools)
- **Tier**: Downstream (red-hat-data-services)
- **Jira**: RHAIENG / Notebooks

### Key Strengths
- **Exceptional build integration**: PR-time image builds with smart change detection (only builds affected images), Konflux/Tekton pipelines for production, kustomize manifest validation
- **Multi-layer image testing**: Testcontainers, real Kubernetes deployment (kubeadm + cri-o), FIPS compliance scanning (check-payload), Trivy vulnerability scanning, Hadolint Dockerfile linting
- **Comprehensive static analysis**: Ruff (30+ rule categories), Pyright type checking, yamllint, JSON validation, pre-commit hooks
- **Mature CI/CD**: 16 GitHub Actions workflows + 35 Tekton pipelines, matrix builds across platforms (amd64, arm64, s390x), concurrency control, build caching

### Critical Gaps
- **No code coverage tracking** — biggest quality gap
- **No AI agent rules** — no CLAUDE.md or test creation guidance
- **Incomplete Renovate coverage** — only covers Tekton/Dockerfile, not pip/Python

### Agent Rules Status: **Missing**

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 7.0/10 | 15% | 1.05 | Good pytest + testcontainers suite |
| Integration/E2E | 8.0/10 | 20% | 1.60 | K8s cluster testing, Playwright, FIPS checks |
| Build Integration | 9.0/10 | 15% | 1.35 | PR image builds, Konflux, kustomize validation |
| Image Testing | 9.0/10 | 10% | 0.90 | Multi-layer: testcontainers, K8s deploy, FIPS, Trivy |
| Coverage Tracking | 1.0/10 | 10% | 0.10 | No coverage tracking at all |
| CI/CD Automation | 9.0/10 | 15% | 1.35 | 16 GHA + 35 Tekton, matrix, caching, daily builds |
| Static Analysis | 8.0/10 | 10% | 0.80 | Ruff + Pyright + Hadolint + yamllint |
| Agent Rules | 0.0/10 | 5% | 0.00 | No agent rules present |
| **Overall** | **7.2/10** | **100%** | **7.15** | |

## Critical Gaps

### 1. No Code Coverage Tracking
- **Severity**: HIGH
- **Impact**: Cannot measure, track, or enforce code coverage — regressions in test quality go completely undetected. The 27 Python test files and 5 TypeScript test files run without any coverage measurement.
- **Effort**: 4-6 hours
- **Details**: No `.codecov.yml`, no `pytest-cov` in dependencies, no `--cov` flag in CI, no coverage thresholds. The `pyproject.toml` dev dependencies include `pytest` but not `pytest-cov`.

### 2. No AI Agent Rules
- **Severity**: MEDIUM
- **Impact**: AI tools generating tests or code changes lack project-specific guidance on testcontainers patterns, pytest markers (`openshift`, `cuda`, `rocm`), and Dockerfile conventions.
- **Effort**: 2-4 hours
- **Details**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory. This repo has strong testing conventions (testcontainers, Playwright, specific pytest markers) that would benefit from explicit documentation for AI agents.

### 3. Renovate Limited to Tekton/Dockerfile Only
- **Severity**: MEDIUM
- **Impact**: Python dependencies in Pipfile.lock files across 16+ image directories and in pyproject.toml/uv.lock are not automatically updated. Security vulnerabilities in Python packages go undetected until manual review.
- **Effort**: 1-2 hours
- **Details**: `.github/renovate.json` has `"enabledManagers": ["tekton", "dockerfile"]` — intentionally excludes pip/pyproject/pipenv managers. The repo has extensive Pipfile.lock files across all image directories.

## Quick Wins

### 1. Add pytest-cov and Codecov Integration (2-4 hours)
- **Impact**: Immediate coverage visibility for all Python tests
- **Implementation**:
  1. Add `pytest-cov` to `[dependency-groups] dev` in `pyproject.toml`
  2. Add `--cov=ci --cov=tests --cov-report=xml` to pytest.ini `addopts`
  3. Add `.codecov.yml` with thresholds
  4. Add `codecov/codecov-action@v4` step after pytest runs in `code-quality.yaml`

### 2. Extend Renovate for Python (30 minutes)
- **Impact**: Automated Python dependency updates for test infrastructure
- **Implementation**: Add `"pip_requirements"` or `"pep621"` to `enabledManagers` in `.github/renovate.json`, scoped to `pyproject.toml` and `uv.lock`

### 3. Create CLAUDE.md with Test Patterns (2-3 hours)
- **Impact**: Consistent AI-generated tests following established project patterns
- **Implementation**: Document testcontainers patterns, pytest marker usage, Dockerfile conventions, and the Makefile build chain

## Detailed Findings

### Unit Tests

**Score: 7.0/10**

The repository has a well-structured test suite organized under `tests/`:

**Python Tests (27 files)**:
- `tests/containers/base_image_test.py` — Base image validation
- `tests/containers/workbenches/jupyterlab/jupyterlab_test.py` — JupyterLab workbench tests
- `tests/containers/workbenches/jupyterlab/jupyterlab_datascience_test.py` — Datascience-specific tests
- `tests/containers/workbenches/jupyterlab/jupyterlab_trustyai_test.py` — TrustyAI-specific tests
- `tests/containers/workbenches/jupyterlab/libraries_test.py` — Library validation
- `tests/containers/workbenches/rstudio/rstudio_test.py` — RStudio tests
- `tests/containers/workbenches/workbench_image_test.py` — Generic workbench tests
- `tests/containers/workbenches/accelerator_image_test.py` — GPU/accelerator tests
- `tests/containers/runtimes/runtime_test.py` — Runtime image tests
- `tests/test_main.py` — Main entry tests

**TypeScript Tests (5 files)**:
- `tests/browser/tests/codeserver.spec.ts` — Playwright browser tests for code-server
- Supporting models and utilities for testcontainers integration

**Test Infrastructure**:
- **Framework**: pytest with `pytest-subtests`, `allure-pytest`, `pyfakefs`
- **Container testing**: `testcontainers` library (Python and TypeScript)
- **Markers**: `openshift`, `cuda`, `rocm` for conditional test execution
- **Configuration**: Strict markers, JUnit logging, file logging to `logs/pytest-logs.txt`

**Strengths**: Well-organized test hierarchy, good use of testcontainers, pytest markers for different environments
**Gap**: No coverage tracking, limited purely "unit" tests (most are container-level)

### Integration/E2E Tests

**Score: 8.0/10**

The `build-notebooks-TEMPLATE.yaml` workflow implements a comprehensive integration test pipeline:

**Kubernetes Integration (on every PR)**:
1. Builds image with podman
2. Installs cri-o + kubeadm to create a real K8s cluster
3. Deploys the built image into the cluster via kustomize
4. Runs Makefile-based validation tests (`make test-*`, `make validate-runtime-image`, etc.)
5. Runs testcontainers tests against the built image
6. Runs OpenShift-specific container tests

**Playwright Browser Tests (for code-server images)**:
- Full browser testing using `@playwright/test` v1.53.1
- Runs inside a Playwright Docker container
- Testcontainers integration for spinning up the code-server image
- Artifact upload for test reports

**FIPS Compliance Testing**:
- `check-payload` scan runs on every built image
- Mounts image filesystem and scans for non-FIPS-compliant binaries
- Installed via `go tool github.com/openshift/check-payload`

**Multi-platform Testing**:
- Supports `linux/amd64`, `linux/arm64`, `linux/s390x`
- QEMU user-static emulation for non-native architectures

**Strengths**: Real K8s cluster testing on every PR, browser testing, FIPS compliance
**Gap**: Single Kubernetes version (v1.33) — no multi-version matrix testing

### Build Integration

**Score: 9.0/10**

**PR Build Pipeline**:
- `build-notebooks-pr.yaml` triggers on PR with smart change detection
- `gen_gha_matrix_jobs.py` analyzes changed files and generates a build matrix for only affected images
- Uses the reusable `build-notebooks-TEMPLATE.yaml` workflow
- Concurrency control: `cancel-in-progress: true` per PR number
- RHEL subscription builds via `pull_request_target` with contributor allowlist

**Konflux/Tekton Pipelines (35 definitions)**:
- One pipeline per image variant (e.g., `odh-workbench-jupyter-minimal-cpu-py312-ubi9-pull-request.yaml`)
- Path-based triggers using PipelinesAsCode CEL expressions
- Auto-generated by `scripts/generate_pull_request_pipelineruns.py`
- References `multiarch-pull-request-pipeline` for shared pipeline logic
- 3-hour pipeline timeout, image expiry after 5 days

**Manifest Validation**:
- `ci/kustomize.sh` validates all kustomization.yaml files build successfully
- Code-quality workflow verifies generated code is up-to-date
- YAML validation with yamllint, JSON validation with json_verify

**Build Tooling**:
- Makefile with 20+ image targets (cpu, cuda, rocm variants)
- `scripts/sandbox.py` for build isolation
- Go-based `bin/buildinputs` for Dockerfile dependency analysis
- Smart Pipfile.lock renewal automation

**Strengths**: Outstanding build integration — builds every affected image on PR, validates manifests, has both GHA and Konflux pipelines
**Gap**: Minor — no explicit `make build` dry-run validation step separate from actual image builds

### Image Testing

**Score: 9.0/10**

**30+ Dockerfiles** organized by workbench type and Python version:
- Jupyter: minimal, datascience, pytorch, tensorflow, trustyai, rocm variants
- Runtimes: minimal, datascience, pytorch, tensorflow, rocm variants
- Code Server: ubi9-python-3.11/3.12
- RStudio: c9s-python-3.11, rhel9-python-3.11

**Dockerfile Quality**:
- Multi-stage builds (`FROM ... AS base`, `FROM base AS jupyter-minimal`)
- UBI9 base images (`registry.access.redhat.com/ubi9/python-312:latest`) — FIPS-capable
- Non-root user (`USER 1001`)
- Proper labeling (k8s display-name, description, source-location)
- `.dockerignore` configured

**Runtime Validation**:
- Testcontainers-based Python tests verify container startup and functionality
- Makefile targets (`validate-runtime-image`, `validate-codeserver-image`, `validate-rstudio-image`)
- Command availability checks (`curl`, `python3`, `oc`, `code-server`, etc.)
- Notebook execution testing with papermill
- R script execution testing for RStudio images

**Security Scanning**:
- Hadolint for Dockerfile best practices (custom config at `ci/hadolint-config.yaml`)
- Trivy vulnerability scanning (on labeled PRs and scheduled runs)
- check-payload FIPS compliance scanning on every image

**Strengths**: Near-gold-standard image testing pipeline with multi-layer validation
**Gap**: No HEALTHCHECK instructions in Dockerfiles, no explicit health/readiness probe testing

### Coverage Tracking

**Score: 1.0/10**

**No coverage tracking is configured at all**:
- No `.codecov.yml` or `codecov.yml`
- No `.coveragerc`
- `pytest.ini` addopts: `--strict-markers --capture=no --tb=short` (no `--cov`)
- `pyproject.toml` dependencies include `pytest` but not `pytest-cov`
- No `coverage` tool in any workflow
- No coverage threshold enforcement
- No PR coverage reporting

This is the largest quality gap in an otherwise excellent repository.

### CI/CD Automation

**Score: 9.0/10**

**16 GitHub Actions Workflows**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build-notebooks-pr.yaml` | `pull_request` | Build affected notebook images |
| `build-notebooks-pr-rhel.yaml` | `pull_request_target` | Build RHEL images (restricted) |
| `build-notebooks-push.yaml` | `push`, `schedule`, `dispatch` | Build all images post-merge |
| `build-notebooks-TEMPLATE.yaml` | `workflow_call` | Reusable build template |
| `code-quality.yaml` | `push`, `pull_request`, `dispatch` | pytest, pre-commit, yamllint, hadolint, kustomize |
| `security.yaml` | `push`, `pull_request`, `dispatch` | Trivy FS scan |
| `params-env.yaml` | `push`, `pull_request` | Validate image references |
| `notebooks-release.yaml` | `workflow_dispatch` | Release management |
| `software-versions.yaml` | — | Software version tracking |
| `piplock-renewal.yaml` | — | Pipfile.lock renewal |
| `notebooks-digest-updater.yaml` | — | Digest update automation |
| `purge-ghcr.yaml` | — | Container registry cleanup |
| Others | Various | Sync, merge, docs |

**Performance Optimizations**:
- Smart change detection: `gen_gha_matrix_jobs.py` only builds affected images
- Build caching: `--cache-from/--cache-to` with GHCR registry
- Linuxbrew caching for podman installation
- uv caching for Python dependencies
- Concurrency control: `cancel-in-progress: true` per PR

**35 Tekton/Konflux Pipelines**:
- Auto-generated per image variant
- Path-based triggers via PipelinesAsCode CEL expressions
- Production build validation separate from GHA

**Strengths**: Mature, well-optimized CI with both GHA and Konflux, daily scheduled builds, smart change detection
**Gap**: Minimal — could benefit from workflow run time monitoring/alerting

### Static Analysis

**Score: 8.0/10**

#### Linting
- **Ruff**: Comprehensive configuration in `pyproject.toml` with 30+ rule categories (B, C4, COM, E, W, F, FA, FLY, G, I, INP, INT, ISC, N, PERF, PGH, PIE, PL, PYI, Q, RET, RUF, T10, TCH, TID, UP, YTT, S102)
- **Pyright**: Type checking with `typeCheckingMode = "off"` but key checks enabled (`reportMissingImports`, `reportUnboundVariable`, `reportGeneralTypeIssues`)
- **Hadolint**: Dockerfile linting with custom config (`ci/hadolint-config.yaml`)
- **yamllint**: Strict YAML validation across all non-Tekton YAML files
- **json_verify**: JSON syntax validation for `.json`, `Pipfile.lock`, and `.ipynb` files

#### Pre-commit Hooks
`.pre-commit-config.yaml` includes:
- `uv-lock` — Lock file verification
- `ruff` — Linting with auto-fix
- `ruff-format` — Code formatting
- `pyright` — Type checking

All hooks scoped to `ci/.*|tests/.*` directories.

#### FIPS Compatibility
- **check-payload**: FIPS binary compliance scanning on every built image
- **UBI9 base images**: All Dockerfiles use `registry.access.redhat.com/ubi9/python-312:latest` (FIPS-capable)
- No FIPS build tags needed (Python, not Go)

#### Dependency Alerts
- **Renovate**: Configured via `.github/renovate.json`
  - Covers: `tekton` and `dockerfile` managers
  - Konflux reference updates grouped and auto-scheduled
  - **Gap**: Does NOT cover `pip`, `pyproject`, or `pipenv` — Python dependencies are manually managed
- **No Dependabot** configuration

**Strengths**: Excellent multi-tool static analysis, FIPS compliance on images, pre-commit enforcement
**Gap**: Renovate doesn't cover Python ecosystem; dependency management partially manual

### Agent Rules

**Score: 0.0/10**

- **No `CLAUDE.md`** in repository root
- **No `AGENTS.md`** in repository root
- **No `.claude/` directory**
- **No `.claude/rules/`** for test creation guidance
- **No `.claude/skills/`** for custom skills

This is a missed opportunity given the strong testing patterns in this repository. The conventions around testcontainers, pytest markers (`openshift`, `cuda`, `rocm`), Dockerfile structure, and the Makefile build chain would benefit greatly from explicit AI agent guidance.

**Recommendation**: Use `/test-rules-generator` to generate initial rules, then customize for the unique image-building and testing patterns.

## Recommendations

### Priority 0 (Critical)

1. **Add pytest-cov and codecov integration**
   - Add `pytest-cov` to dev dependencies in `pyproject.toml`
   - Configure `--cov=ci --cov=tests --cov-report=xml` in `pytest.ini`
   - Add `.codecov.yml` with minimum coverage thresholds (e.g., 60%)
   - Add `codecov/codecov-action@v4` step after pytest in `code-quality.yaml`
   - This fills the largest quality gap in the repository

2. **Extend Renovate for Python dependencies**
   - Add `"pep621"` or `"pip_requirements"` to `enabledManagers` in `.github/renovate.json`
   - Scope to `pyproject.toml` / `uv.lock` at minimum
   - Consider separate Renovate config for Pipfile.lock files across image directories

### Priority 1 (High Value)

3. **Create agent rules for test patterns**
   - Add `CLAUDE.md` documenting:
     - Testcontainers usage patterns (Python and TypeScript)
     - pytest marker conventions (`openshift`, `cuda`, `rocm`)
     - Dockerfile conventions (multi-stage, UBI9 base, non-root user)
     - Makefile build chain and target naming
   - Add `.claude/rules/test-creation.md` for test automation guidance

4. **Add multi-version Kubernetes testing**
   - Currently tests against K8s v1.33 only
   - Add matrix testing against K8s 1.31 and 1.33 to match OCP 4.16 and 4.18

### Priority 2 (Nice-to-Have)

5. **Add coverage for ROCm-specific code paths**
   - ROCm tests are skipped in most CI runs (no ROCm hardware)
   - Consider ROCm emulation or mock-based testing for ROCm-specific Dockerfiles

6. **Contract tests for manifest compatibility**
   - Add tests verifying kustomize manifests match the operator's expected format
   - Prevent drift between image manifests and OpenShift AI operator expectations

7. **Performance regression testing**
   - Track image build times across PRs
   - Alert on image size regressions

## Comparison to Gold Standards

| Practice | notebooks-downstream | odh-dashboard | notebooks (upstream) | kserve |
|----------|---------------------|---------------|---------------------|--------|
| Unit Tests | Testcontainers + pytest | Jest + RTL | pytest + notebook validation | Go testing + envtest |
| Integration/E2E | K8s cluster + Playwright | Cypress E2E | Multi-layer image testing | Ginkgo E2E |
| Build Integration | GHA + Konflux + Tekton | GHA + Konflux | GHA matrix builds | GHA + Prow |
| Image Testing | Multi-layer validation | N/A | 5-layer validation | N/A |
| Coverage Tracking | **None** | Codecov enforced | **Partial** | Codecov enforced |
| CI/CD | 16 workflows + 35 Tekton | Comprehensive | Comprehensive | Comprehensive |
| Static Analysis | Ruff + Pyright + Hadolint | ESLint + TypeScript | Ruff + Hadolint | golangci-lint |
| Agent Rules | **None** | Comprehensive | **None** | **None** |

## File Paths Reference

### CI/CD Configuration
- `.github/workflows/build-notebooks-pr.yaml` — PR image build workflow
- `.github/workflows/build-notebooks-TEMPLATE.yaml` — Reusable build template (340+ lines)
- `.github/workflows/code-quality.yaml` — Static analysis and testing
- `.github/workflows/build-notebooks-push.yaml` — Post-merge and scheduled builds
- `.github/workflows/security.yaml` — Trivy filesystem scan
- `.github/renovate.json` — Renovate dependency management
- `.tekton/` — 35 Konflux/Tekton pipeline definitions

### Testing
- `tests/containers/` — Testcontainers-based image tests (Python)
- `tests/browser/` — Playwright browser tests (TypeScript)
- `tests/conftest.py` — pytest shared configuration
- `pytest.ini` — pytest configuration
- `pyproject.toml` — Python project and tool configuration

### Build
- `Makefile` — 530+ lines with image build targets
- `jupyter/*/Dockerfile.*` — Jupyter notebook Dockerfiles
- `runtimes/*/Dockerfile.*` — Runtime image Dockerfiles
- `codeserver/*/Dockerfile.*` — Code Server Dockerfiles
- `rstudio/*/Dockerfile.*` — RStudio Dockerfiles

### Static Analysis
- `pyproject.toml` — Ruff and Pyright configuration
- `.pre-commit-config.yaml` — Pre-commit hooks (ruff, pyright, uv-lock)
- `ci/hadolint-config.yaml` — Hadolint Dockerfile linting rules
- `ci/yamllint-config.yaml` — yamllint YAML validation rules

### Manifests
- `manifests/base/kustomization.yaml` — Base kustomize configuration
- `manifests/base/*.yaml` — ImageStream and BuildConfig definitions
- `*/kustomize/base/kustomization.yaml` — Per-image kustomize overlays
