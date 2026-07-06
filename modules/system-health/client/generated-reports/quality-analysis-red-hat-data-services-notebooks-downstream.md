---
repository: "red-hat-data-services/notebooks-downstream"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Good pytest + Go test coverage with Allure reporting, but no code coverage measurement"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Excellent multi-layer testing — Testcontainers, Kind/CRI-O deployment, Playwright browser tests"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR builds validate every changed image with Kind deployment tests, no Konflux simulation"
  - dimension: "Image Testing"
    score: 9.0
    status: "Sophisticated Testcontainers tests for base images, workbenches, runtimes, accelerators, FIPS"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "No codecov/coveralls integration, no coverage thresholds or PR reporting"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "Well-organized matrix builds with caching, concurrency control, and smart change detection"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory — zero AI agent guidance"
critical_gaps:
  - title: "No code coverage tracking or enforcement"
    impact: "Cannot measure test coverage trends or enforce minimum coverage on PRs — regressions go undetected"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No AI agent rules for test creation"
    impact: "AI agents have no guidance on test patterns, frameworks, or quality standards for this repo"
    severity: "MEDIUM"
    effort: "3-4 hours"
  - title: "No CodeQL or SAST integration"
    impact: "Static security analysis gaps — only Trivy filesystem/image scanning is present"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No SBOM generation or image signing"
    impact: "Supply chain security gap — no software bill of materials or provenance attestation"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "Trivy image scanning is label-gated on PRs"
    impact: "Image vulnerability scanning only runs on PRs with 'trivy-scan' label — most PRs skip it"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add pytest-cov to generate coverage reports"
    effort: "2-3 hours"
    impact: "Visibility into test coverage gaps across container test suites"
  - title: "Enable Trivy scanning on all PRs (remove label gate)"
    effort: "1 hour"
    impact: "Every PR gets vulnerability scanning instead of opt-in only"
  - title: "Add CodeQL workflow for Python/Go static analysis"
    effort: "2-3 hours"
    impact: "Catch security vulnerabilities and code quality issues in CI tooling code"
  - title: "Generate agent rules with /test-rules-generator"
    effort: "2-3 hours"
    impact: "AI agents can create consistent, high-quality tests following repo patterns"
recommendations:
  priority_0:
    - "Add pytest-cov integration with coverage thresholds to catch test regression"
    - "Remove label gate on Trivy image scanning so all PRs get scanned"
  priority_1:
    - "Add CodeQL/SAST workflow for Python and Go source code"
    - "Add SBOM generation (Syft/Cosign) and image signing for published images"
    - "Create .claude/rules/ with test creation guidelines for container, deployment, and browser tests"
  priority_2:
    - "Add Allure report publishing to GitHub Pages or artifact storage"
    - "Add dependency update automation (Dependabot/Renovate for Go modules and Python deps)"
    - "Consider adding contract tests between notebook images and RHOAI dashboard expectations"
---

# Quality Analysis: notebooks-downstream

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Container image builder for Jupyter/RStudio/Code-Server notebook workbenches and model serving runtimes
- **Primary Languages**: Python (tests, CI tooling), Dockerfiles (35+ images), Go (build tooling), TypeScript (browser tests)
- **Key Strengths**: Exceptional multi-layer container testing with Testcontainers, Kind/CRI-O Kubernetes deployment validation, Playwright browser tests, smart matrix-based CI with change detection
- **Critical Gaps**: No code coverage tracking, no agent rules, label-gated vulnerability scanning, no SAST/CodeQL
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7/10 | Good pytest + Go test coverage with Allure, no coverage measurement |
| Integration/E2E | 9/10 | Excellent multi-layer: Testcontainers, Kind deployment, Playwright |
| **Build Integration** | **8/10** | **PR builds validate every changed image, Kind tests, no Konflux sim** |
| Image Testing | 9/10 | Sophisticated container validation — ELF linking, FIPS, startup, libs |
| Coverage Tracking | 2/10 | No codecov/coveralls, no thresholds, no PR reporting |
| CI/CD Automation | 9/10 | Matrix builds, caching, concurrency control, change detection |
| Agent Rules | 0/10 | No AI agent rules or test automation guidance |

## Critical Gaps

### 1. No Code Coverage Tracking or Enforcement
- **Impact**: Cannot measure test coverage trends or enforce minimum coverage on PRs — regressions go undetected
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Despite having excellent test suites (pytest with Testcontainers, Go tests, Playwright), there is no coverage measurement. No `pytest-cov` in dependencies, no `.codecov.yml`, no coverage thresholds in CI.

### 2. No AI Agent Rules
- **Impact**: AI agents generating tests or code have no guidance on the repo's sophisticated testing patterns
- **Severity**: MEDIUM
- **Effort**: 3-4 hours
- **Details**: No CLAUDE.md, AGENTS.md, or `.claude/` directory exists. This repo has complex Testcontainers patterns, fixture hierarchies, and image-type-specific test selection that agents need to understand.

### 3. No CodeQL or SAST Integration
- **Impact**: Static security analysis gaps in Python/Go CI tooling code
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: Only Trivy filesystem and image scanning is present. No CodeQL, Semgrep, or Bandit for the Python/Go source code that drives the build pipeline.

### 4. No SBOM Generation or Image Signing
- **Impact**: Supply chain security gap — no software bill of materials or provenance attestation for published images
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: Images are built and pushed to GHCR/Quay but lack SBOM generation (Syft) or cosign signatures.

### 5. Trivy Image Scanning is Label-Gated on PRs
- **Impact**: Most PRs skip image vulnerability scanning — only PRs with the `trivy-scan` label trigger it
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: In `build-notebooks-TEMPLATE.yaml`, Trivy image scanning on PRs requires a `trivy-scan` label. Scheduled/push builds scan unconditionally, but PRs are opt-in only.

## Quick Wins

### 1. Add pytest-cov for Coverage Reports (2-3 hours)
- **Impact**: Immediate visibility into test coverage across container test suites
- **Implementation**:
  ```bash
  # Add to pyproject.toml [dependency-groups] dev
  "pytest-cov",
  ```
  ```bash
  # In build template workflow, add --cov flag
  uv run pytest --cov=tests --cov-report=xml --capture=fd tests/containers ...
  ```

### 2. Enable Trivy Scanning on All PRs (1 hour)
- **Impact**: Every PR gets vulnerability scanning, not just labeled ones
- **Implementation**: Remove the `HAS_TRIVY_LABEL` condition in `build-notebooks-TEMPLATE.yaml`, or default to running fs-scan on all PRs and image-scan on labeled ones.

### 3. Add CodeQL Workflow (2-3 hours)
- **Impact**: Catch security vulnerabilities in Python and Go build tooling
- **Implementation**:
  ```yaml
  # .github/workflows/codeql.yaml
  name: CodeQL
  on: [push, pull_request]
  jobs:
    analyze:
      runs-on: ubuntu-latest
      strategy:
        matrix:
          language: [python, go]
      steps:
        - uses: actions/checkout@v4
        - uses: github/codeql-action/init@v3
          with:
            languages: ${{ matrix.language }}
        - uses: github/codeql-action/analyze@v3
  ```

### 4. Generate Agent Rules (2-3 hours)
- **Impact**: AI agents create consistent, high-quality tests following repo patterns
- **Implementation**: Run `/test-rules-generator` on this repo to create `.claude/rules/` with guidance on Testcontainers patterns, fixture usage, image type selection, and Kubernetes deployment test patterns.

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory** (21 workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build-notebooks-pr.yaml` | PR | Build changed images (non-RHEL) with matrix |
| `build-notebooks-pr-rhel.yaml` | PR (target) | Build RHEL images with contributor access control |
| `build-notebooks-push.yaml` | Push/Schedule | Build all images nightly + on push |
| `build-notebooks-TEMPLATE.yaml` | Called | Reusable template: build, test, scan |
| `code-quality.yaml` | Push/PR | Static analysis: yamllint, hadolint, JSON, pytest, pre-commit |
| `security.yaml` | Push/PR | Trivy filesystem scan + SARIF upload |
| `create-release.yaml` | Manual | Release workflow |
| `notebooks-release.yaml` | Manual | Notebook release process |
| `notebook-digest-updater.yaml` | Scheduled | Update image digests |
| `params-env.yaml` | Scheduled | Environment parameter updates |
| `piplock-renewal.yaml` | Scheduled | Pipfile.lock renewal |
| `software-versions.yaml` | Scheduled | Software version tracking |
| `purge-ghcr.yaml` | Scheduled | Clean up old GHCR images |
| `pr-merge-image-delete.yml` | PR merge | Delete PR-specific images |
| `docs.yaml` | - | Documentation |
| `insta-merge.yaml` / `instant-merge.yaml` | - | Fast-track merge |
| `sync-branches-through-pr.yml` | - | Branch synchronization |
| `update-buildconfigs.yaml` | - | BuildConfig updates |
| `update-commit-latest-env.yaml` | - | Commit hash tracking |

**Strengths**:
- Smart change detection: PR builds only build affected images via `gen_gha_matrix_jobs.py`
- Concurrency control: `cancel-in-progress: true` prevents duplicate PR builds
- Reusable template pattern: DRY workflow via `build-notebooks-TEMPLATE.yaml`
- Multi-platform support: amd64, arm64, s390x
- RHEL build security: contributor allowlist on `pull_request_target`
- Build caching: podman cache-from/cache-to with GHCR
- UV dependency caching in CI

**Gaps**:
- No Konflux build simulation on PRs
- No build time tracking or optimization metrics

### Test Coverage

**Test Architecture** — This repo has an exceptionally mature multi-layer test strategy:

**Layer 1: Static Analysis** (code-quality.yaml)
- yamllint on all YAML/YML files
- Hadolint on all Dockerfiles
- JSON validation (yajl-tools)
- Kustomize manifest validation
- Code generation drift detection
- Pre-commit hooks (ruff lint/format, pyright type-checking)

**Layer 2: Python Unit Tests** (code-quality.yaml)
- pytest runs on CI tooling code
- `ci/cached-builds/make_test.py` has 10 unit tests verifying Make command generation
- `tests/test_main.py` for main test infrastructure
- `tests/pytest_tutorial/test_01_intro.py` for team learning

**Layer 3: Go Unit Tests**
- `scripts/buildinputs/buildinputs_test.go` validates Dockerfile parsing across all 35+ Dockerfiles

**Layer 4: Container Tests with Testcontainers** (build template, per-image)
- `tests/containers/base_image_test.py` — ELF binary linking, `oc` command, `skopeo`, pip install, FIPS mode, file permissions
- `tests/containers/workbenches/workbench_image_test.py` — workbench startup with IPv4/IPv6, log checking for errors, OpenShift deployment
- `tests/containers/workbenches/jupyterlab/jupyterlab_test.py` — spinner HTML, PDF export, mongocli binary
- `tests/containers/workbenches/jupyterlab/libraries_test.py` — datascience library imports and validation
- `tests/containers/runtimes/runtime_test.py` — pyzmq import validation
- `tests/containers/workbenches/accelerator_image_test.py` — CUDA/ROCm GPU tests on OpenShift

**Layer 5: Kubernetes Deployment Tests** (build template, via Kind + CRI-O)
- `ci/cached-builds/make_test.py` orchestrates deploy → test → undeploy cycle
- Deploys to real Kubernetes cluster (CRI-O + kubeadm)
- Validates runtime behavior: API endpoints, notebook execution (papermill), RStudio scripts
- Tests all image types: jupyter, codeserver, rstudio, runtimes

**Layer 6: Browser Tests** (Playwright)
- `tests/browser/tests/codeserver.spec.ts` — code-server UI tests
- Uses Testcontainers for browser test infrastructure
- Tests: editor visibility, terminal interaction, file operations

**Test Framework Inventory**:
- Python: pytest, allure-pytest, pytest-subtests, testcontainers, pydantic, pyfakefs
- Go: standard testing package
- TypeScript: Playwright, testcontainers
- Fixtures: Sophisticated pytest fixtures with image-type-aware skipping

**Test File Count**: 21 test files (14 Python, 1 Go, 1 TypeScript, plus support files)

### Code Quality

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- `uv-lock` — lock file consistency
- `ruff` — Python linting with fix mode (extensive rule set: 30+ categories)
- `ruff-format` — Python formatting
- `pyright` — Type checking (selective: `reportMissingImports`, `reportUnboundVariable`, `reportGeneralTypeIssues`)

**Linting Configuration** (excellent):
- `ruff.toml` via `pyproject.toml` — 30+ lint categories enabled (B, C4, COM, E, F, I, ISC, N, PERF, PGH, PIE, PL, UP, etc.)
- `hadolint` for Dockerfiles with custom config
- `yamllint` with strict mode for all YAML/YML files
- JSON validation for notebooks and config files
- Kustomize manifest validation

**Static Analysis**:
- CodeRabbit for automated PR review (`.coderabbit.yaml`)
- No CodeQL/SAST for source code
- No Bandit/Semgrep

### Container Images

**Image Inventory**: 35+ Dockerfiles across multiple dimensions:
- **Workbenches**: jupyter-minimal, jupyter-datascience, jupyter-pytorch, jupyter-tensorflow, jupyter-trustyai, code-server, rstudio
- **Runtimes**: minimal, datascience, pytorch, tensorflow
- **Accelerators**: CUDA, ROCm
- **Python versions**: 3.11, 3.12
- **OS bases**: UBI9, RHEL9, C9S
- **Architectures**: amd64, arm64, s390x

**Build Process**:
- Podman-based builds with multi-architecture support
- Build caching via GHCR container registry
- Sandbox script (`scripts/sandbox.py`) for build isolation
- RHEL subscription injection for entitled builds

**Runtime Testing** (exemplary):
- Testcontainers validates every built image:
  - ELF binary linking (all binaries can find their shared libraries)
  - FIPS mode compatibility
  - File permissions and ownership
  - IDE startup (JupyterLab, RStudio, Code-Server)
  - IPv4 and IPv6 networking
  - Log message quality (blocked keywords check)
  - Library imports (pandas, scipy, torch, tensorflow)
  - PDF export capability

**Security Scanning**:
- Trivy image scanning (label-gated on PRs, automatic on schedule)
- Trivy filesystem scanning (on push/PR)
- SARIF results uploaded to GitHub Security tab
- No SBOM generation
- No image signing/attestation

### Security

| Practice | Status |
|----------|--------|
| Trivy FS scan | Present (push/PR/dispatch) |
| Trivy image scan | Present (label-gated PR, scheduled) |
| SARIF upload | Present (GitHub Security tab) |
| CodeQL/SAST | Missing |
| Dependency scanning | Partial (Trivy FS) |
| Secret detection | Missing (no Gitleaks/TruffleHog) |
| SBOM generation | Missing |
| Image signing | Missing |
| RHEL build access control | Present (contributor allowlist) |

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No rules for any test type
- **Quality**: N/A
- **Gaps**: No CLAUDE.md, AGENTS.md, or `.claude/` directory exists. This repo has complex and exemplary testing patterns (Testcontainers, fixtures with image-type skipping, Kubernetes deployment orchestration) that would greatly benefit from documented agent rules.
- **Recommendation**: Run `/test-rules-generator` to create comprehensive rules covering:
  - Container test patterns (Testcontainers, base image validation)
  - Fixture usage (image type selection, skip logic)
  - Kubernetes deployment test patterns (deploy/test/undeploy)
  - Browser test patterns (Playwright with Testcontainers)
  - Pre-commit hook compliance

## Recommendations

### Priority 0 (Critical)
1. **Add pytest-cov for coverage measurement** — The test suite is excellent but coverage is unmeasured. Add `pytest-cov` to `pyproject.toml`, generate XML reports, and integrate with codecov for PR-level coverage tracking.
2. **Remove label gate on Trivy image scanning** — All PRs should get vulnerability scanning, not just those manually labeled. At minimum, run filesystem-level scanning unconditionally.

### Priority 1 (High Value)
3. **Add CodeQL workflow** — Add SAST for Python and Go code to catch security issues in the CI tooling and test infrastructure.
4. **Add SBOM generation and image signing** — Use Syft for SBOM and cosign for signatures on all published images to meet supply chain security requirements.
5. **Create AI agent rules** — Use `/test-rules-generator` to create `.claude/rules/` with guidance on the repo's unique test patterns. Key areas: Testcontainers usage, fixture hierarchy, image type selection, Kubernetes deployment orchestration.

### Priority 2 (Nice-to-Have)
6. **Add Allure report publishing** — Allure is already integrated (`allure-pytest`) but reports aren't published. Add Allure report generation + GitHub Pages or artifact upload.
7. **Add secret detection** — Add Gitleaks or TruffleHog scanning, especially important given RHEL subscription handling.
8. **Consider contract tests** — Define expected interfaces between notebook images and RHOAI Dashboard/Controller expectations (labels, ports, healthcheck endpoints).
9. **Add Dependabot/Renovate** — Automate dependency updates for Go modules and Python packages.

## Comparison to Gold Standards

| Dimension | notebooks-downstream | odh-dashboard (Gold) | notebooks-upstream (Gold) |
|-----------|---------------------|---------------------|--------------------------|
| Unit Tests | pytest + Go tests, no coverage | Jest + comprehensive mocking, coverage enforced | pytest, no coverage |
| Integration | Testcontainers + Kind/CRI-O | Cypress E2E + API tests | Similar Testcontainers |
| Image Testing | 9/10 — ELF, FIPS, startup, libs | N/A (web app) | 9/10 — 5-layer validation |
| Coverage Tracking | None | Codecov with thresholds | None |
| CI/CD | Matrix builds, smart change detection | Multi-stage, comprehensive | Similar matrix builds |
| Security | Trivy FS + image (partial) | Trivy + CodeQL + Snyk | Trivy FS + image |
| Agent Rules | None | Comprehensive .claude/rules/ | None |
| Static Analysis | ruff + pyright + hadolint + yamllint | ESLint strict + TypeScript strict | Similar |
| Browser Tests | Playwright (code-server) | Cypress (full UI) | None |

## File Paths Reference

### CI/CD Configuration
- `.github/workflows/build-notebooks-pr.yaml` — PR build workflow
- `.github/workflows/build-notebooks-pr-rhel.yaml` — RHEL PR build workflow
- `.github/workflows/build-notebooks-push.yaml` — Push/nightly builds
- `.github/workflows/build-notebooks-TEMPLATE.yaml` — Reusable build template (builds, tests, scans)
- `.github/workflows/code-quality.yaml` — Static analysis and pytest
- `.github/workflows/security.yaml` — Trivy filesystem scanning
- `.tekton/` — Konflux pipeline definitions (30+ files)

### Test Infrastructure
- `tests/containers/base_image_test.py` — Base image validation (ELF, FIPS, permissions)
- `tests/containers/workbenches/workbench_image_test.py` — Workbench startup and network tests
- `tests/containers/workbenches/jupyterlab/jupyterlab_test.py` — JupyterLab-specific tests
- `tests/containers/workbenches/jupyterlab/libraries_test.py` — Library import validation
- `tests/containers/runtimes/runtime_test.py` — Runtime image tests
- `tests/containers/workbenches/accelerator_image_test.py` — CUDA/ROCm GPU tests
- `tests/browser/tests/codeserver.spec.ts` — Playwright browser tests
- `ci/cached-builds/make_test.py` — Kubernetes deployment test orchestrator
- `scripts/buildinputs/buildinputs_test.go` — Go Dockerfile parsing tests

### Code Quality Configuration
- `pyproject.toml` — ruff, pyright, project deps
- `.pre-commit-config.yaml` — Pre-commit hooks (ruff, pyright, uv-lock)
- `pytest.ini` — pytest configuration with markers
- `.coderabbit.yaml` — CodeRabbit PR review config
- `ci/yamllint-config.yaml` — yamllint configuration
- `ci/hadolint-config.yaml` — Hadolint Dockerfile linting

### Image Build
- `jupyter/*/Dockerfile.*` — JupyterLab workbench images
- `runtimes/*/Dockerfile.*` — Model serving runtime images
- `codeserver/*/Dockerfile.*` — Code-Server workbench images
- `rstudio/*/Dockerfile.*` — RStudio workbench images
- `Makefile` — Build/test/deploy orchestration (532 lines)
