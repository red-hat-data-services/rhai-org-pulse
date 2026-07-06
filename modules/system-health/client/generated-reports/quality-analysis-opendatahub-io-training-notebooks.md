---
repository: "opendatahub-io/training-notebooks"
overall_score: 7.9
scorecard:
  - dimension: "Unit Tests"
    score: 6.5
    status: "Solid pytest+pyfakefs unit tests for build scripts; limited unit tests for CI tooling"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Excellent multi-layer container testing with Testcontainers, Kubernetes, and Playwright"
  - dimension: "Build Integration"
    score: 8.5
    status: "PR builds every changed image with intelligent matrix generation and caching"
  - dimension: "Image Testing"
    score: 9.0
    status: "5-layer image validation: build, Testcontainers, Kubernetes deploy, Trivy scan, FIPS check-payload"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "No codecov/coveralls integration, no coverage thresholds or PR reporting"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "21 workflows covering builds, security, releases, and validation with excellent concurrency control"
  - dimension: "Agent Rules"
    score: 1.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules for test creation"
critical_gaps:
  - title: "No code coverage tracking or enforcement"
    impact: "Cannot measure test coverage trends, no enforcement of coverage thresholds on PRs"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No agent rules for AI-assisted test creation"
    impact: "AI agents cannot follow project-specific test patterns when generating tests"
    severity: "MEDIUM"
    effort: "3-4 hours"
  - title: "No CUDA/ROCm container runtime tests in PR pipeline"
    impact: "GPU-specific test failures only caught post-merge or in manual testing"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "No SBOM generation"
    impact: "Cannot track software bill of materials for supply chain security compliance"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add pytest-cov and codecov integration"
    effort: "2-3 hours"
    impact: "Enable coverage tracking, PR reporting, and threshold enforcement for Python tests"
  - title: "Create CLAUDE.md with test creation rules"
    effort: "2-3 hours"
    impact: "Standardize AI-generated test patterns using existing Testcontainers/pytest conventions"
  - title: "Add SBOM generation to build pipeline"
    effort: "1-2 hours"
    impact: "Supply chain security compliance with Syft/Trivy SBOM output"
  - title: "Add Allure report publishing to CI"
    effort: "1-2 hours"
    impact: "allure-pytest is already a dependency; publishing reports gives visual test analytics"
recommendations:
  priority_0:
    - "Add pytest-cov to pyproject.toml and integrate codecov for coverage tracking and PR reporting"
    - "Add coverage threshold enforcement (e.g. 60% minimum, no decrease on PRs)"
  priority_1:
    - "Create .claude/rules/ with test creation rules covering Testcontainers, Kubernetes, and Playwright patterns"
    - "Add SBOM generation (Syft or Trivy) to the build template workflow"
    - "Publish Allure test reports as CI artifacts for better test visibility"
  priority_2:
    - "Add Gitleaks or TruffleHog for secret detection in PRs"
    - "Add image signing/attestation with cosign for supply chain integrity"
    - "Expand Playwright browser tests beyond code-server to JupyterLab workbenches"
---

# Quality Analysis: training-notebooks

## Executive Summary

- **Overall Score: 7.9/10**
- **Repository Type**: Container image monorepo (Jupyter notebooks, workbenches, runtimes)
- **Primary Languages**: Python, Go (build helper), TypeScript (browser tests)
- **Frameworks**: pytest + Testcontainers, Playwright, Kubernetes (kubeadm), Tekton/Konflux

The `training-notebooks` repository is the **gold standard for container image testing** in the OpenDataHub ecosystem. It implements a sophisticated 5-layer validation pipeline: image build, Testcontainers runtime tests, Kubernetes deployment verification, Trivy vulnerability scanning, and FIPS compliance checking via `check-payload`. The PR workflow intelligently builds only changed images using a Go-based dependency analyzer and Python matrix generator.

**Key Strengths**:
- Exceptional image testing with Testcontainers and real Kubernetes clusters in CI
- Smart incremental builds — only changed images are built on PRs
- Multi-architecture support (amd64, arm64, s390x, ppc64le)
- Strong security posture with Trivy scanning and FIPS compliance checks
- Comprehensive pre-commit hooks with Ruff, Pyright, and uv-lock

**Critical Gaps**:
- Zero code coverage tracking — no codecov, no coverage thresholds, no PR reporting
- No agent rules for AI-assisted development (no CLAUDE.md, no .claude/ directory)
- No SBOM generation for supply chain security
- GPU (CUDA/ROCm) tests require hardware and cannot run in standard CI

**Agent Rules Status**: Missing — no CLAUDE.md, no .claude/ directory, no test creation rules

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.5/10 | Solid pytest+pyfakefs unit tests for build scripts; limited coverage of CI tooling |
| Integration/E2E | 9.0/10 | Excellent multi-layer container testing with Testcontainers, Kubernetes, and Playwright |
| **Build Integration** | **8.5/10** | **PR builds every changed image with intelligent matrix generation and caching** |
| Image Testing | 9.0/10 | 5-layer image validation: build, Testcontainers, K8s deploy, Trivy, FIPS check-payload |
| Coverage Tracking | 3.0/10 | No codecov/coveralls, no thresholds, no PR reporting |
| CI/CD Automation | 9.0/10 | 21 workflows with concurrency control, caching, and matrix builds |
| Agent Rules | 1.0/10 | No CLAUDE.md, no .claude/ directory, no test creation guidance |

## Critical Gaps

### 1. No Code Coverage Tracking or Enforcement
- **Impact**: Cannot measure test coverage trends, detect regressions, or enforce minimum coverage on PRs
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Despite having `pytest` as the test runner and 47 test functions across ~3,800 lines of test code, there is no `pytest-cov` configuration, no `.codecov.yml`, no `coveragerc`, and no coverage reporting in any workflow. The `code-quality.yaml` workflow runs `uv run pytest` without any coverage flags.

### 2. No Agent Rules for AI-Assisted Test Creation
- **Impact**: AI agents (Claude, Copilot) cannot follow project-specific testing patterns, leading to inconsistent or incorrect test generation
- **Severity**: MEDIUM
- **Effort**: 3-4 hours
- **Details**: No `CLAUDE.md`, no `.claude/` directory, no `AGENTS.md`. The repository has highly specific test patterns (Testcontainers with podman, Kubernetes TestFrame, fixture-based image parametrization) that an AI agent would need guidance to replicate correctly.

### 3. No CUDA/ROCm Tests in Standard CI
- **Impact**: GPU-specific issues (driver compatibility, CUDA toolkit mismatches) only caught in manual testing or specialized hardware environments
- **Severity**: MEDIUM
- **Effort**: 8-12 hours (requires GPU runners)
- **Details**: Tests marked `@pytest.mark.cuda` and `@pytest.mark.rocm` are skipped in PR CI. The `accelerator_image_test.py` tests require OpenShift clusters with GPU nodes. This is a known limitation but means GPU regressions are discovered late.

### 4. No SBOM Generation
- **Impact**: Cannot track software bill of materials for supply chain security compliance
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: Trivy scanning is configured for vulnerability detection, but no SBOM generation (Syft, Trivy SBOM mode) exists. For a project producing ~30+ container images, supply chain transparency is essential.

## Quick Wins

### 1. Add pytest-cov and Codecov Integration (2-3 hours)
- **Impact**: Enable coverage tracking, PR comments, and threshold enforcement
- **Implementation**:
  - Add `pytest-cov` to `[dependency-groups] dev` in `pyproject.toml`
  - Add `--cov=ci --cov=scripts --cov=tests --cov-report=xml` to `pytest.ini` addopts
  - Add `.codecov.yml` with target coverage thresholds
  - Add codecov upload step to `code-quality.yaml` workflow

### 2. Create CLAUDE.md with Test Creation Rules (2-3 hours)
- **Impact**: Standardize AI-generated test patterns for Testcontainers, Kubernetes, and Playwright
- **Implementation**: Use `/test-rules-generator` to analyze existing test patterns and generate `.claude/rules/` files covering container tests, workbench tests, and CI script tests.

### 3. Add SBOM Generation to Build Pipeline (1-2 hours)
- **Impact**: Supply chain security compliance
- **Implementation**: Add Syft or use Trivy's SBOM mode in the build template workflow, uploading results as artifacts.

### 4. Publish Allure Reports (1-2 hours)
- **Impact**: `allure-pytest` is already listed as a dependency in `pyproject.toml` — reports just need to be collected and published
- **Implementation**: Add `--alluredir=allure-results` to pytest, upload as artifact, optionally publish to GitHub Pages.

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory** (21 workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build-notebooks-pr.yaml` | PR | Build changed images (ODH) with matrix |
| `build-notebooks-pr-rhel.yaml` | PR (target) | Build RHEL images (contributor-gated) |
| `build-notebooks-push.yaml` | Push/Schedule/Dispatch | Build all images, push to GHCR |
| `build-notebooks-TEMPLATE.yaml` | Reusable | Core build+test pipeline (see below) |
| `code-quality.yaml` | Push/PR | Pytest, pre-commit, YAML lint, JSON validation |
| `security.yaml` | Push/PR | Trivy filesystem scan → GitHub Security tab |
| `sec-scan.yml` | Schedule/Dispatch | Periodic image vulnerability reports |
| `params-env.yaml` | Push/PR | Validate image SHAs in manifests |
| `software-versions.yaml` | Push/PR | Validate SW versions in ImageStream manifests |
| `notebooks-release.yaml` | Dispatch | Create releases with tag |
| `notebooks-digest-updater.yaml` | Dispatch | Update image digests in params.env |
| `create-release.yaml` | Dispatch | Release automation |
| `docs.yaml` | Push/PR | Documentation validation |
| `piplock-renewal.yaml` | Scheduled | Refresh Pipfile.lock files |
| `purge-ghcr.yaml` | Scheduled | Clean up old GHCR images |
| `pr-merge-image-delete.yml` | PR merge | Delete PR-specific images |
| `insta-merge.yaml` | PR | Auto-merge qualified PRs |
| `sync-branches-through-pr.yml` | Dispatch | Sync branches via PR |
| `update-buildconfigs.yaml` | Dispatch | Update BuildConfigs |
| `update-commit-latest-env.yaml` | Dispatch | Update commit env |
| `auto-add-issue-to-project.yml` | Issues | Auto-add issues to project board |

**Concurrency Control**: Excellent — PR build uses `group: build-notebooks-pr-{PR_NUMBER}` with `cancel-in-progress: true`.

**Caching**: 
- UV package cache with `astral-sh/setup-uv` and dependency glob
- Go build cache for `buildinputs` helper
- Linuxbrew cache for Podman installation
- Docker build cache via `--cache-from` / `--cache-to` GHCR registry

**Build Template Pipeline** — The core `build-notebooks-TEMPLATE.yaml` is exceptional:
1. **Image Build**: Podman with multi-arch (QEMU for s390x/ppc64le, native arm64)
2. **Testcontainers Tests**: `uv run pytest tests/containers` against the built image
3. **Kubernetes Tests**: Full kubeadm cluster with cri-o, local-path provisioner, kustomize deploy
4. **Trivy Scan**: Image or filesystem vulnerability scan (label-triggered on PRs, always on schedule)
5. **FIPS Compliance**: `openshift/check-payload` scan for FIPS compliance
6. **Playwright Tests**: Browser tests for code-server images
7. **OpenShift Tests**: Container tests with OpenShift markers

### Test Coverage

**Test Framework**: pytest with extensive fixtures and markers

**Test Files** (47 test functions across ~3,800 lines):

| Category | Files | Functions | Description |
|----------|-------|-----------|-------------|
| Container base | `base_image_test.py` | 11 | UBI base image validation (labels, packages, user) |
| Workbench | `workbench_image_test.py` | 3 | IDE server startup and health checks |
| JupyterLab | `jupyterlab_test.py` + datascience + trustyai | 7 | Spinner, API, notebook execution, libraries |
| Accelerator | `accelerator_image_test.py` | 2 | CUDA/ROCm GPU validation |
| Runtime | `runtime_test.py` | 1 | Runtime image requirements |
| RStudio | `rstudio_test.py` | 3 | RStudio server validation |
| Libraries | `libraries_test.py` | 1 | Library compatibility |
| Build scripts | `sandbox_tests.py` | 5+ | Filesystem sandboxing for builds |
| Tutorial | `test_01_intro.py` | 14 | Test infrastructure examples |
| Main | `test_main.py` | 1 | Smoke test |

**Test Notebooks**: 13 `test_notebook.ipynb` files for Jupyter image validation (executed via Papermill in Kubernetes)

**Browser Tests**: 3 Playwright specs for code-server (editor visible, welcome screen, terminal command execution)

**Test Infrastructure** — Sophisticated and well-designed:
- `conftest.py` with image fixtures, marker-based skip logic, and Testcontainers lifecycle
- `kubernetes_utils.py` (550 lines) — Kubernetes test frame with kubectl, pod management, service access
- `docker_utils.py` (310 lines) — Docker/Podman socket detection, image operations
- `pydantic_schemas/` — Typed schemas for podman inspect output
- `WorkbenchContainer` class extending `GenericContainer` with IDE-specific wait strategies

**Markers**:
- `@pytest.mark.openshift` — requires OpenShift cluster
- `@pytest.mark.cuda` — requires CUDA GPU
- `@pytest.mark.rocm` — requires ROCm GPU

**allure-pytest**: Listed as a dependency and used in test decorators (`@allure.issue`, `@allure.description`) but no evidence of report publishing in CI.

### Code Quality

**Linting**: Excellent configuration
- **Ruff**: Comprehensive rule set (24+ categories enabled including B, C4, COM, E, F, I, N, PERF, PL, RUF, UP) with preview mode enabled
- **Pyright**: Type checking configured with `reportMissingImports: error`, `reportUnboundVariable: error`
- **yamllint**: Strict mode for all YAML files (excluding Tekton)
- **JSON validation**: YAML-embedded JSON strings validated

**Pre-commit Hooks**: Well-configured
- `uv-lock` — ensures lockfile is up to date
- `ruff` — lint with auto-fix
- `ruff-format` — code formatting
- `pyright` — type checking

**Code Review**: CodeRabbit AI review configured (`.coderabbit.yaml`) for `main` and `2024b` branches.

**Editor Config**: `.editorconfig` present for consistent formatting.

### Container Images

**Build Process**: Gold standard
- **30+ Dockerfiles** across jupyter/, runtimes/, codeserver/, rstudio/
- Multi-stage builds (base → specialized)
- Multi-Python version (3.11, 3.12)
- Multi-platform (amd64, arm64, s390x)
- UBI9 base images (Red Hat Universal Base Image)
- Podman with rootful socket for cri-o sharing

**Runtime Testing**: Comprehensive
- Testcontainers-based runtime validation for every built image
- Kubernetes deployment testing with kubeadm + cri-o
- Papermill notebook execution tests
- IDE server health checks (JupyterLab, RStudio, code-server)
- Command validation (curl, python3, oc, code-server, rserver)

**Security Scanning**: Strong
- **Trivy**: Filesystem scan on every PR/push, image scan available (label-gated on PRs)
- **FIPS compliance**: `openshift/check-payload` for FIPS validation
- **Renovate**: Automated dependency updates (`.github/renovate.json`)
- **No SBOM generation**: Missing Syft/Trivy SBOM output
- **No image signing**: No cosign attestation

### Security

| Practice | Status | Details |
|----------|--------|---------|
| Trivy FS scan | Active | Every PR/push, SARIF upload to Security tab |
| Trivy image scan | Conditional | Label-triggered on PRs, always on schedule |
| FIPS compliance | Active | `check-payload` scan on every build |
| Dependency scanning | Active | Renovate for automated dependency updates |
| Secret detection | Missing | No Gitleaks/TruffleHog |
| SBOM generation | Missing | No Syft or Trivy SBOM |
| Image signing | Missing | No cosign attestation |
| RHEL subscription | Controlled | Contributor-gated `pull_request_target` with allowlist |

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **Coverage**: No test types have AI rules
- **Quality**: N/A
- **Gaps**: All test types need rules — Testcontainers patterns, Kubernetes test frame usage, fixture conventions, marker patterns, Playwright specs
- **Recommendation**: Generate rules with `/test-rules-generator` covering:
  - Container image tests (Testcontainers, podman socket, fixture parametrization)
  - Kubernetes deployment tests (TestFrame, kubeadm, kustomize)
  - Browser tests (Playwright, code-server models)
  - Build script tests (pyfakefs, sandbox patterns)

### Tekton/Konflux Integration

- **25,467 lines** of Tekton pipeline YAML in `.tekton/`
- Covers pull-request and push pipelines for every image variant
- Multi-arch pipeline (`multiarch-pull-request-pipeline.yaml`)
- Runtime images: minimal, datascience, pytorch (CUDA/ROCm), tensorflow (CUDA/ROCm)
- Workbench images: code-server, jupyter (all variants)
- Python versions: 3.11, 3.12

## Recommendations

### Priority 0 (Critical)

1. **Add pytest-cov and Codecov integration** — Add `pytest-cov` to dev dependencies, configure coverage for `ci/`, `scripts/`, `tests/` directories, upload to Codecov with PR comments and threshold enforcement.

2. **Add coverage threshold enforcement** — Set a baseline (e.g., 60%) and enforce no decrease on PRs. The `tests/` directory has good structure but no way to track coverage trends.

### Priority 1 (High Value)

3. **Create .claude/rules/ with test creation rules** — Document the Testcontainers pattern (parametrized images, fixtures, markers), Kubernetes TestFrame pattern, and Playwright spec patterns so AI agents generate consistent tests.

4. **Add SBOM generation** — Integrate Syft or Trivy SBOM mode into the build template, uploading results as CI artifacts for supply chain compliance.

5. **Publish Allure test reports** — `allure-pytest` is already a dependency with annotations in tests. Add `--alluredir` to pytest, upload as artifacts, and optionally deploy to GitHub Pages.

### Priority 2 (Nice-to-Have)

6. **Add secret detection** — Integrate Gitleaks or TruffleHog into PR workflow. While `git-crypt` is used for RHEL subscription secrets, there's no scanning for accidentally committed secrets.

7. **Add image signing with cosign** — For supply chain integrity on pushed images.

8. **Expand Playwright browser tests** — Currently only cover code-server. JupyterLab and RStudio workbenches could benefit from browser-level validation.

9. **Add Go test runner for buildinputs** — The `scripts/buildinputs/buildinputs_test.go` Go test exists but isn't visibly run in CI workflows.

## Comparison to Gold Standards

| Dimension | training-notebooks | odh-dashboard | notebooks (gold) | kserve |
|-----------|--------------------|---------------|-------------------|--------|
| Unit Tests | 6.5 — pytest+pyfakefs | 9.0 — Jest + comprehensive | 8.0 — multi-layer | 8.0 — Go testing |
| Integration/E2E | 9.0 — Testcontainers+K8s | 9.0 — Cypress E2E | 8.0 — image validation | 9.0 — envtest+Kind |
| Build Integration | 8.5 — Smart matrix builds | 8.0 — Multi-mode | 9.0 — 5-layer pipeline | 7.0 — Standard |
| Image Testing | 9.0 — 5-layer validation | 6.0 — Basic | 9.0 — Gold standard | 7.0 — Basic |
| Coverage Tracking | 3.0 — None | 8.0 — Codecov | 6.0 — Partial | 8.0 — Codecov+threshold |
| CI/CD Automation | 9.0 — 21 workflows | 9.0 — Comprehensive | 9.0 — Mature | 9.0 — Prow+GHA |
| Agent Rules | 1.0 — None | 8.0 — Comprehensive | 3.0 — Minimal | 2.0 — Basic |

**Notable**: This repository IS the "notebooks" gold standard referenced in the skill documentation. It excels at image testing and CI/CD automation but falls behind on coverage tracking and agent rules compared to odh-dashboard.

## File Paths Reference

### CI/CD
- `.github/workflows/` — 21 GitHub Actions workflows
- `.github/workflows/build-notebooks-TEMPLATE.yaml` — Core build+test pipeline
- `.tekton/` — 50+ Tekton/Konflux pipeline definitions
- `Makefile` — Image build targets and deployment
- `ci/` — CI helper scripts, cached-builds, security scan tools

### Testing
- `tests/containers/` — Testcontainers-based image tests
- `tests/containers/conftest.py` — Test fixtures and image parametrization
- `tests/containers/kubernetes_utils.py` — Kubernetes test framework
- `tests/browser/tests/` — Playwright browser specs
- `scripts/sandbox_tests.py` — Build sandbox unit tests
- `jupyter/*/test/test_notebook.ipynb` — 13 Papermill test notebooks

### Code Quality
- `pyproject.toml` — Ruff, Pyright, project config
- `.pre-commit-config.yaml` — Ruff, Pyright, uv-lock hooks
- `.coderabbit.yaml` — AI code review config
- `.editorconfig` — Editor formatting

### Container Images
- `jupyter/` — JupyterLab workbench Dockerfiles
- `runtimes/` — Runtime image Dockerfiles
- `codeserver/` — VS Code Server Dockerfiles
- `rstudio/` — RStudio Server Dockerfiles
- `.dockerignore` — Build context exclusions

### Security
- `.github/workflows/security.yaml` — Trivy FS scan
- `.github/workflows/sec-scan.yml` — Periodic vulnerability reports
- `scripts/check-payload/` — FIPS compliance checker
- `.github/renovate.json` — Automated dependency updates

### Manifests
- `manifests/base/` — Kustomize base manifests, params.env
- `manifests/overlays/` — Kustomize overlays
