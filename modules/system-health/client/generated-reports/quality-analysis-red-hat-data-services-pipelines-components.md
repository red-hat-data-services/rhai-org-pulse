---
repository: "red-hat-data-services/pipelines-components"
overall_score: 7.2
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "79 test files, 19k test lines, strong test-to-code ratio with pytest and KFP LocalRunner"
  - dimension: "Integration/E2E"
    score: 6.5
    status: "RHOAI integration tests exist for AutoML/AutoRAG but no automated E2E in CI; cluster-dependent tests skipped by default"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time container builds with validation; Konflux builds via Tekton PipelineRuns on push/PR; missing PR-time Konflux simulation"
  - dimension: "Image Testing"
    score: 5.5
    status: "Images built and saved as artifacts on PR but no runtime validation or startup testing"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "pytest-cov in test deps and Makefile target but no CI integration, no codecov, no coverage enforcement"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "17 workflows with concurrency control, path-based triggers, multi-Python matrix, automated CI-passed labeling"
  - dimension: "Agent Rules"
    score: 7.5
    status: "Comprehensive AGENTS.md with 3-mode guidance, validation tables, and scaffolding commands; no .claude/rules/ directory"
critical_gaps:
  - title: "No coverage tracking or enforcement in CI"
    impact: "Test coverage may silently regress with no visibility into coverage trends; no PR-level coverage reporting"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No security scanning (SAST, container, dependency)"
    impact: "Vulnerabilities in Python dependencies or container images not detected before merge or deployment"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No container runtime validation on PR"
    impact: "Built images may fail at startup or have missing dependencies not caught until deployment"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "Integration tests not automated in CI"
    impact: "RHOAI cluster integration tests only run manually; regressions may go undetected between releases"
    severity: "MEDIUM"
    effort: "12-16 hours"
quick_wins:
  - title: "Add Codecov integration to scripts-tests and component-pipeline-tests workflows"
    effort: "2-4 hours"
    impact: "Immediate visibility into test coverage trends and per-PR coverage diff reporting"
  - title: "Add Trivy container scanning to container-build workflow"
    effort: "1-2 hours"
    impact: "Catch CVEs in base images and dependencies before merge"
  - title: "Add pip-audit or safety check to CI"
    effort: "1-2 hours"
    impact: "Detect known vulnerabilities in Python dependencies on every PR"
  - title: "Add container startup smoke test after PR image build"
    effort: "2-3 hours"
    impact: "Validate built images can start and respond before merge"
recommendations:
  priority_0:
    - "Integrate Codecov with coverage thresholds and PR-level delta reporting"
    - "Add container security scanning (Trivy) to the container-build workflow"
    - "Add Python dependency vulnerability scanning (pip-audit or safety)"
  priority_1:
    - "Add container runtime validation (startup check, import verification) to container-build workflow"
    - "Create periodic CI job for RHOAI integration tests against a test cluster"
    - "Add .claude/rules/ with test-type-specific guidance (unit, integration, component tests)"
  priority_2:
    - "Add CodeQL or Semgrep for static analysis"
    - "Add secret detection (gitleaks) to CI"
    - "Implement SBOM generation for published container images"
---

# Quality Analysis: pipelines-components

## Executive Summary

- **Overall Score: 7.2/10**
- **Repository Type**: Python library/monorepo — Kubeflow Pipelines components and pipelines catalog
- **Primary Language**: Python (100%)
- **Framework**: KFP (Kubeflow Pipelines) SDK v2, pytest, uv package manager
- **Key Strengths**: Excellent CI/CD automation with 17 well-organized workflows, strong unit testing culture (79 test files, ~19k test lines vs ~25k code lines), comprehensive AGENTS.md, robust pre-commit hooks, and PR-time container builds with validation
- **Critical Gaps**: No coverage tracking/enforcement, no security scanning (SAST/container/dependency), no automated integration tests in CI
- **Agent Rules Status**: AGENTS.md present and comprehensive; no `.claude/rules/` directory for test-type-specific guidance

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | 79 test files, ~19k test lines, pytest + KFP LocalRunner |
| Integration/E2E | 6.5/10 | RHOAI integration tests exist but manual; no automated E2E in CI |
| Build Integration | 7.0/10 | PR container builds + Konflux Tekton pipelines; no PR-time Konflux simulation |
| Image Testing | 5.5/10 | Images built and saved as artifacts on PR; no runtime validation |
| Coverage Tracking | 3.0/10 | pytest-cov available but not integrated in CI; no codecov; no enforcement |
| CI/CD Automation | 9.0/10 | 17 workflows, concurrency control, path triggers, multi-Python matrix |
| Agent Rules | 7.5/10 | Excellent AGENTS.md; missing `.claude/rules/` for test patterns |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement in CI
- **Impact**: Test coverage may silently regress. No visibility into per-PR coverage deltas or overall trends.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: `pytest-cov` is listed in `[project.optional-dependencies.test]` and the Makefile has a `test-coverage` target, but neither `scripts-tests.yml` nor `component-pipeline-tests.yml` generate or upload coverage data. No `.codecov.yml` or `coveralls` configuration exists.

### 2. No Security Scanning
- **Impact**: Vulnerabilities in Python dependencies (e.g., `kfp`, `torch`, `autogluon`) or container base images not detected pre-merge.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: No Trivy, Snyk, CodeQL, Semgrep, pip-audit, safety, or gitleaks integration found in any workflow. Container images use `registry.redhat.io/ubi9/python-311` and `python-312` base images which should be scanned for CVEs.

### 3. No Container Runtime Validation
- **Impact**: Built container images are saved as artifacts on PR but never tested for startup, import correctness, or functional behavior.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: The `container-build.yml` workflow builds and saves images via `docker save` but the `validate-components` job only validates component compilation and base image tags — it doesn't load and run the image to verify startup.

### 4. Integration Tests Not Automated in CI
- **Impact**: RHOAI cluster integration tests (AutoML, AutoRAG) only run manually with local `.env` configuration. Regressions between components go undetected.
- **Severity**: MEDIUM
- **Effort**: 12-16 hours
- **Details**: Integration tests in `pipelines/training/automl/*/tests/test_pipeline_integration.py` are marked with `@pytest.mark.integration` and require RHOAI cluster access. No periodic CI job exists to run these against a test environment.

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
- **Impact**: Immediate visibility into coverage trends and per-PR deltas
- **Implementation**: Add `--cov` flags to pytest runs in `scripts-tests.yml` and `component-pipeline-tests.yml`, upload coverage via `codecov/codecov-action`, create `.codecov.yml` with minimum thresholds.

### 2. Add Trivy Container Scanning (1-2 hours)
- **Impact**: Catch CVEs in UBI9 base images and installed dependencies
- **Implementation**: Add a `trivy` step after image build in `container-build.yml`:
```yaml
- name: Scan image with Trivy
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.IMAGE_PREFIX }}-${{ matrix.name }}:${{ github.sha }}
    format: 'sarif'
    exit-code: '1'
    severity: 'CRITICAL,HIGH'
```

### 3. Add pip-audit for Dependency Scanning (1-2 hours)
- **Impact**: Detect known vulnerabilities in Python package dependencies
- **Implementation**: Add a step to an existing workflow or create a new one:
```yaml
- name: Audit Python dependencies
  run: |
    uv pip install pip-audit
    uv run pip-audit
```

### 4. Add Container Startup Smoke Test (2-3 hours)
- **Impact**: Validate images can start and run basic commands before merge
- **Implementation**: After loading PR image artifacts in `validate-components`, add:
```yaml
- name: Smoke test container startup
  run: |
    IMAGE_TAG="${{ env.IMAGE_PREFIX }}-${{ matrix.name }}:${GITHUB_SHA}"
    docker run --rm "$IMAGE_TAG" python -c "import kfp; print('OK')"
```

## Detailed Findings

### CI/CD Pipeline

**Strengths (Score: 9.0/10)**:
- **17 well-organized workflows** covering linting, testing, building, validation, and labeling
- **Path-based triggering** on almost every workflow — avoids unnecessary CI runs
- **Concurrency control** with `cancel-in-progress: true` on workflows that benefit from it
- **Multi-Python version matrix** (3.11 and 3.13) for scripts tests and base image validation
- **Reusable composite action** (`setup-python-ci`) for consistent Python/uv environment setup
- **Automated CI-passed labeling** via a multi-workflow artifact-passing system
- **`ok-to-test` label gating** with trusted author auto-approval for fork PRs
- **Tekton/Konflux integration** via `.tekton/` directory with PR and push PipelineRuns for 3 image variants (pipelines-components, automl, autorag)
- **Change detection** via custom `detect-changed-assets` action — only runs tests for changed components

**Workflow Inventory**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci-checks.yml` | `pull_request_target` | Aggregate CI status check, uploads PR context |
| `component-pipeline-tests.yml` | PR + push (components/pipelines paths) | Targeted pytest for changed components |
| `scripts-tests.yml` | PR + push (scripts paths) | Scripts unit tests (Python 3.11 + 3.13) |
| `container-build.yml` | PR + push (container paths) | Build container images, validate on PR |
| `container-build-matrix-check.yml` | PR (Containerfile/Dockerfile changes) | Validate build matrix consistency |
| `python-lint.yml` | PR + push (*.py) | Ruff format + lint on changed files |
| `yaml-lint.yml` | PR + push (*.yml, *.yaml) | yamllint on changed files |
| `markdown-lint.yml` | PR + push (*.md) | markdownlint on changed files |
| `compile-and-deps.yml` | PR (components/pipelines) | KFP compilation check |
| `validate-metadata-schema.yml` | PR (components/pipelines) | Metadata YAML schema validation |
| `base-image-check.yml` | PR + push | Validate base image references |
| `readme-check.yml` | PR (components/pipelines) | README sync validation |
| `build-packages.yml` | PR + push | Build Python wheel, validate contents + imports |
| `package-entries-check.yml` | PR + push | Validate pyproject.toml package entries |
| `sync-requirements.yml` | PR (pyproject.toml/uv.lock) | Verify requirements.txt is in sync |
| `gh-workflow-approve.yml` | `pull_request_target` (labeled/sync) | Auto-approve workflows for trusted authors |
| `add-ci-passed-label.yml` | `workflow_run` (CI Check) | Add/reset `ci-passed` label |

**Gaps**:
- No coverage reporting in any test workflow
- No security scanning workflows
- No periodic/scheduled workflows for integration tests

### Test Coverage

**Strengths (Score: 8.5/10 for unit tests)**:
- **79 test files** across scripts, components, and pipelines
- **~19,126 test lines** vs ~25,536 code lines — excellent 0.75:1 test-to-code ratio
- **Multi-level testing**: unit tests (`test_component_unit.py`), local runner tests (`test_component_local.py`), and integration tests (`test_pipeline_integration.py`)
- **KFP LocalRunner integration** via `conftest.py` fixtures — tests can compile and dry-run KFP pipelines locally
- **Well-structured test discovery**: each component/pipeline has its own `tests/` directory
- **Smart test targeting**: `component-pipeline-tests.yml` only runs pytest on changed component/pipeline directories

**Test Infrastructure**:
- **Framework**: pytest with `pytest-cov`, `pytest-timeout`
- **Fixtures**: Comprehensive `conftest.py` files at root and per-component level
- **Markers**: `@pytest.mark.integration` for cluster-dependent tests, `gh_api` for GitHub API tests
- **Test data**: Dedicated `test_data/` directory with sample components and pipelines

**Coverage Gap Details**:
- `pytest-cov` is in dependencies but `test-coverage` Makefile target is local-only
- No CI workflows invoke `--cov` flags
- No coverage upload or threshold enforcement

### Code Quality

**Strengths**:
- **Ruff** for both linting and formatting with comprehensive rule selection (`E`, `W`, `F`, `I`, `D` — pycodestyle, pyflakes, isort, pydocstyle)
- **Google docstring convention** enforced via `pydocstyle`
- **Line length**: 120 characters
- **10 pre-commit hooks** covering:
  - `uv lock --check` (lockfile sync)
  - `sync requirements` (requirements.txt generation)
  - `ruff format` and `ruff check --fix`
  - `yamllint`
  - `import-guard` (custom import restrictions for components/pipelines)
  - `validate-readme` (README sync check)
  - `markdownlint`
  - `validate-metadata` (metadata.yaml schema)
  - `validate-base-images`

**Notable**: The import guard is a custom tool that prevents components/pipelines from importing disallowed packages, enforcing isolation between catalog entries.

### Container Images

**Strengths**:
- **Multi-architecture support**: `linux/amd64,linux/arm64` for pushed images
- **Buildx + QEMU**: Modern Docker build infrastructure
- **GHA cache**: `cache-from: type=gha` / `cache-to: type=gha,mode=max`
- **PR image artifacts**: Images saved and uploaded as artifacts for PR validation
- **Konflux/Tekton integration**: 9 PipelineRun definitions for 3 image variants (automl, autorag, pipelines-components) across push, PR, and comment triggers
- **Base image pinning**: UBI9 images pinned by SHA digest
- **Non-root execution**: `USER 1001` in all Dockerfiles

**Gaps**:
- No vulnerability scanning of built images
- No runtime validation (startup test, health check)
- No SBOM generation
- No image signing or attestation

### Security

**Score: 2.0/10** (not scored in overall due to weighting)

- **No SAST tools** (CodeQL, Semgrep, gosec) configured
- **No dependency scanning** (pip-audit, safety, Dependabot alerts)
- **No container scanning** (Trivy, Snyk, Grype)
- **No secret detection** (gitleaks, TruffleHog)
- **Positive**: Base images are pinned by digest, non-root containers, `ok-to-test` gating for fork PRs, action SHAs pinned

### Agent Rules (Agentic Flow Quality)

**Status**: Present (AGENTS.md) — no `.claude/rules/` directory
**Score: 7.5/10**

**Strengths**:
- **Comprehensive AGENTS.md** with 3 distinct modes (contributing, end user, maintaining)
- **Sources of truth section** listing canonical references and keeping docs aligned
- **Validation table** mapping each check to its config file and CI workflow
- **Scaffolding guidance**: `make component`, `make pipeline`, `make tests` commands
- **Testing references**: Links to CONTRIBUTING.md testing guide and workflow files

**Gaps**:
- No `.claude/rules/` directory with test-type-specific rules
- No structured guidance for unit test patterns (mock strategies, fixture patterns)
- No integration test writing guidance (cluster setup, env var configuration)
- No component test template or checklist
- AGENTS.md doesn't include test code examples or patterns

## Recommendations

### Priority 0 (Critical)

1. **Integrate Codecov with coverage thresholds**
   - Add `--cov` to pytest runs in `scripts-tests.yml` and `component-pipeline-tests.yml`
   - Upload via `codecov/codecov-action`
   - Create `.codecov.yml` with project coverage threshold (suggest: 60% to start)
   - Enable PR-level coverage delta reporting

2. **Add container security scanning**
   - Add Trivy to `container-build.yml` after image build
   - Set `exit-code: 1` for CRITICAL/HIGH severity
   - Upload SARIF results for GitHub Security tab integration

3. **Add Python dependency vulnerability scanning**
   - Add `pip-audit` step to `build-packages.yml` or create dedicated workflow
   - Run on PR to catch new vulnerable dependencies before merge

### Priority 1 (High Value)

4. **Add container runtime validation**
   - After building PR images in `container-build.yml`, add startup smoke test
   - Verify Python imports, KFP components compile, entry point runs

5. **Create periodic integration test CI job**
   - Weekly or on-demand workflow dispatching RHOAI integration tests
   - Requires test cluster credentials via GitHub secrets
   - Run `pytest -m integration` against configured environment

6. **Add `.claude/rules/` test guidance**
   - Create rules for unit tests, integration tests, and component tests
   - Include pytest patterns, fixture usage, KFP LocalRunner examples
   - Reference the existing `make tests` scaffolding

### Priority 2 (Nice-to-Have)

7. **Add CodeQL or Semgrep for Python static analysis**
8. **Add gitleaks for secret detection in CI**
9. **Generate SBOMs for published container images** (Syft or Trivy SBOM)
10. **Add Dependabot or Renovate for automated dependency updates**

## Comparison to Gold Standards

| Capability | pipelines-components | odh-dashboard | notebooks | kserve |
|------------|---------------------|---------------|-----------|--------|
| Unit Tests | 79 files, pytest + KFP | Jest + Cypress | Shell scripts | Go testing |
| Integration/E2E | Manual RHOAI tests | Cypress E2E automated | Image boot tests | envtest + E2E |
| Coverage Tracking | Not integrated | Codecov enforced | Not integrated | Codecov enforced |
| Coverage Enforcement | None | PR-level thresholds | None | Minimum 80% |
| Container Scanning | None | Trivy + Snyk | Trivy | Trivy |
| Dependency Scanning | None | npm audit | pip-audit | go mod audit |
| Secret Detection | None | Gitleaks | None | Gitleaks |
| SAST | None | CodeQL | None | CodeQL + gosec |
| Pre-commit Hooks | 10 hooks (excellent) | Limited | None | golangci-lint |
| CI Workflows | 17 (excellent) | 15+ | 10+ | 20+ |
| Agent Rules | AGENTS.md (good) | CLAUDE.md + rules | None | None |
| Build Integration | PR builds + Konflux | PR builds | PR builds | PR builds |
| Image Runtime Test | None | Startup test | 5-layer validation | Deployment test |

## File Paths Reference

### CI/CD
- `.github/workflows/` — 17 workflow files
- `.github/actions/setup-python-ci/action.yml` — Reusable Python/uv setup
- `.github/actions/detect-changed-assets/action.yml` — Change detection
- `.tekton/` — 9 Konflux PipelineRun definitions

### Testing
- `conftest.py` — Root-level pytest configuration with KFP LocalRunner
- `scripts/*/tests/` — Script unit tests (12+ test modules)
- `components/*/tests/` — Component unit tests
- `pipelines/*/tests/` — Pipeline unit and integration tests
- `test_data/` — Test fixtures (sample components and pipelines)

### Code Quality
- `pyproject.toml` — Ruff config, pytest config, dependencies
- `.pre-commit-config.yaml` — 10 hooks
- `.markdownlint.json` — Markdown lint config
- `.yamllint.yml` — YAML lint config
- `.github/scripts/check_imports/` — Custom import guard

### Container Images
- `Dockerfile` — Main pipelines-components image (UBI9/Python 3.11)
- `Dockerfile.konflux.pipelines-components` — Konflux build variant (UBI9/Python 3.12)
- `Dockerfile.konflux.automl` — AutoML Konflux image
- `Dockerfile.konflux.autorag` — AutoRAG Konflux image
- `components/*/Containerfile` — Per-component container builds
- `pipelines/*/Containerfile` — Per-pipeline container builds

### Agent Rules
- `AGENTS.md` — Comprehensive AI agent context guide
