---
repository: "red-hat-data-services/ilab-on-ocp"
overall_score: 3.1
scorecard:
  - dimension: "Unit Tests"
    score: 0.5
    status: "No unit tests for 3,258 lines of Python pipeline code"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "Single Go-based E2E test exists but requires live cluster with GPUs and is env-gated"
  - dimension: "Build Integration"
    score: 4.0
    status: "Konflux PR build via Tekton; no PR-time GitHub workflow build validation"
  - dimension: "Image Testing"
    score: 2.0
    status: "Dockerfiles present but no runtime validation, startup testing, or image scanning"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling, no codecov integration, no coverage thresholds"
  - dimension: "CI/CD Automation"
    score: 4.5
    status: "Pre-commit linting on PRs and main-branch image build; no test execution in CI"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules or test automation guidance"
critical_gaps:
  - title: "Zero unit tests for Python pipeline code"
    impact: "3,258 lines of KFP pipeline logic, SDG components, training components, and eval code have no unit test coverage — regressions are invisible until pipeline execution on a live cluster"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No coverage tracking or enforcement"
    impact: "No visibility into what code is tested; no ability to enforce coverage thresholds on PRs"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container image security scanning"
    impact: "Images built from UBI base with pip-installed dependencies have no vulnerability scanning in CI or Konflux"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No PR-time test execution"
    impact: "PRs are merged with only linting checks; no automated tests validate code correctness before merge"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "E2E test is not automated in CI"
    impact: "E2E test exists but requires manual setup with a live RHOAI cluster and GPU nodes; never runs in CI"
    severity: "MEDIUM"
    effort: "40+ hours (infrastructure)"
quick_wins:
  - title: "Add unit tests for pipeline.py utility functions"
    effort: "4-6 hours"
    impact: "Cover the most critical pipeline compilation logic and parameter validation"
  - title: "Add Trivy scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Catch known vulnerabilities in base images and pip dependencies before merge"
  - title: "Add codecov integration"
    effort: "2-3 hours"
    impact: "Establish baseline coverage visibility and enable PR coverage gates"
  - title: "Add pytest configuration to pyproject.toml"
    effort: "1 hour"
    impact: "Enable pytest discovery and establish test infrastructure foundation"
  - title: "Create basic agent rules for test patterns"
    effort: "2-3 hours"
    impact: "Enable AI-assisted test generation following project conventions"
recommendations:
  priority_0:
    - "Add unit tests for all Python modules — pipeline.py, sdg/components.py, training/components.py, utils/components.py, eval/*.py"
    - "Add codecov or coveralls integration with PR coverage reporting and minimum threshold enforcement"
    - "Add container image vulnerability scanning (Trivy) to PR and main-branch workflows"
    - "Add PR-time pytest execution in GitHub Actions workflow"
  priority_1:
    - "Add type checking with mypy or pyright and enforce in CI"
    - "Create comprehensive agent rules (.claude/rules/) for test creation patterns"
    - "Add pipeline compilation validation test (compile pipeline and verify output YAML structure)"
    - "Add Dockerfile build validation in PR workflow (build image without push)"
  priority_2:
    - "Add integration tests using KFP test infrastructure (mock pipeline server)"
    - "Add SAST tooling (CodeQL, Semgrep, or Bandit) for Python security analysis"
    - "Add secret detection (Gitleaks) to pre-commit hooks"
    - "Add SBOM generation for container images"
---

# Quality Analysis: ilab-on-ocp

## Executive Summary

- **Overall Score: 3.1/10**
- **Repository Type**: Python KFP (Kubeflow Pipelines) pipeline for InstructLab on Red Hat OpenShift AI
- **Primary Language**: Python (3,258 lines) with Go E2E tests (230 lines)
- **Key Strengths**: Pre-commit hooks with ruff linting, Konflux build integration, Renovate dependency management, well-documented README
- **Critical Gaps**: Zero unit tests for all Python code, no coverage tracking, no security scanning, no PR-time test execution
- **Agent Rules Status**: Missing — no CLAUDE.md, no .claude/ directory

This repository contains the InstructLab distributed training pipeline for RHOAI, including SDG (Synthetic Data Generation), training, evaluation, and model output components. Despite being a critical production pipeline handling LLM fine-tuning workflows, it has virtually no automated test coverage.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0.5/10 | No unit tests for 3,258 lines of Python pipeline code |
| Integration/E2E | 3.0/10 | Single Go E2E test exists but requires live cluster, env-gated |
| **Build Integration** | **4.0/10** | **Konflux PR build via Tekton PipelineRun; no GitHub Actions build** |
| Image Testing | 2.0/10 | Dockerfiles present but no runtime validation or scanning |
| Coverage Tracking | 0.0/10 | No coverage tooling of any kind |
| CI/CD Automation | 4.5/10 | Pre-commit linting + main-branch image build; no test execution |
| Agent Rules | 0.0/10 | No agent rules or test automation guidance |

## Critical Gaps

### 1. Zero Unit Tests for Python Pipeline Code
- **Impact**: The entire pipeline codebase (3,258 lines across 13 Python files) has zero unit tests. This includes complex KFP component definitions in `sdg/components.py` (494 lines), `training/components.py` (392 lines), `utils/components.py` (681 lines), and evaluation logic in `eval/final.py` (555 lines) and `eval/mt_bench.py` (259 lines).
- **Severity**: HIGH
- **Effort**: 16-24 hours for initial coverage
- **Risk**: Regressions in pipeline parameter handling, component wiring, PVC management, or evaluation logic are only discoverable at runtime on a live RHOAI cluster with GPU nodes — potentially hours into execution.

### 2. No Coverage Tracking or Enforcement
- **Impact**: No `pytest` configuration in `pyproject.toml`, no `.coveragerc`, no `codecov.yml`, no coverage gates on PRs. There is zero visibility into what code is tested.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Risk**: Even if tests are added, there's no mechanism to prevent coverage regression.

### 3. No Container Image Security Scanning
- **Impact**: Two Dockerfiles (`Dockerfile` using UBI8, `Dockerfile.konflux` using UBI9) install packages via `pip install --no-cache-dir -r requirements.txt` (1,067 lines of pinned dependencies with hashes) and `dnf install skopeo`. No Trivy, Snyk, or other vulnerability scanning exists.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Risk**: Known CVEs in Python dependencies or base images ship to production undetected.

### 4. No PR-Time Test Execution
- **Impact**: The only PR workflow (`pre_commit.yaml`) runs pre-commit hooks (ruff lint/format, yamllint, trailing whitespace) and validates that `pipeline.yaml` is up-to-date. No tests of any kind execute on PRs.
- **Severity**: HIGH
- **Effort**: 8-12 hours (including writing initial tests)
- **Risk**: Code changes are merged based solely on linting — logical correctness is never validated before merge.

### 5. E2E Test Not Automated in CI
- **Impact**: A Go-based E2E test (`tests/pipeline/e2e/ilab_rhoai_pipeline_runs_test.go`) exists that triggers a pipeline run via the KFP REST API and waits for completion. However, it requires `ENABLE_ILAB_PIPELINE_TEST=true`, `PIPELINE_SERVER_URL`, `BEARER_TOKEN`, and `PIPELINE_DISPLAY_NAME` environment variables, and a live RHOAI cluster with GPUs. It never runs in CI.
- **Severity**: MEDIUM
- **Effort**: 40+ hours (infrastructure setup for automated E2E environment)

## Quick Wins

### 1. Add pytest Configuration and Initial Unit Tests (4-6 hours)
Add pytest to `pyproject.toml` and write tests for `pipeline.py` compilation:
```toml
[dependency-groups]
lint = [...]
test = [
    "pytest>=8.0",
    "pytest-cov>=5.0",
]
```

```python
# tests/test_pipeline_compilation.py
from kfp import compiler
from pipeline import ilab_pipeline, import_base_model_pipeline

def test_ilab_pipeline_compiles():
    """Verify pipeline compiles without errors."""
    compiler.Compiler().compile(ilab_pipeline, "/tmp/test_pipeline.yaml")

def test_importer_pipeline_compiles():
    """Verify importer pipeline compiles without errors."""
    compiler.Compiler().compile(import_base_model_pipeline, "/tmp/test_importer.yaml")
```

### 2. Add Trivy Scanning to PR Workflow (1-2 hours)
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@0.28.0
  with:
    scan-type: 'fs'
    scan-ref: '.'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'
```

### 3. Add Codecov Integration (2-3 hours)
```yaml
- name: Run tests with coverage
  run: uv run pytest --cov=. --cov-report=xml
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    file: coverage.xml
```

### 4. Add Dockerfile Build Validation in PR (1-2 hours)
```yaml
- name: Build Docker image (no push)
  run: podman build -t test-image -f Dockerfile .
```

### 5. Create Basic Agent Rules (2-3 hours)
Generate `.claude/rules/` with test patterns using `/test-rules-generator`.

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory:**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pre_commit.yaml` | push to main, PRs to main | Ruff lint/format, yamllint, pipeline.yaml freshness, requirements.txt validation |
| `build-main.yml` | push to main | Build and push container image to quay.io/opendatahub |
| `renovate.json` | Scheduled | Dependency updates for Dockerfiles, Tekton, RPMs |

**Strengths:**
- Pre-commit workflow has good caching (`~/.cache/pre-commit` with hash key)
- Pipeline YAML freshness check ensures `make pipeline` was run before merge
- Requirements.txt validation catches dependency drift from pyproject.toml
- Concurrency control on build workflow (`cancel-in-progress: true`)

**Weaknesses:**
- No test execution in any workflow
- No PR-time Docker build validation
- No security scanning
- Build workflow uses `actions/checkout@v3` (outdated, should be v4)
- No artifact upload or build caching beyond pre-commit cache

### Tekton/Konflux Integration

The `.tekton/` directory contains a Konflux PipelineRun for PR builds:
- Triggered by `/build-konflux` comment or `kfbuild-all`/`kfbuild-ilab-on-ocp` labels
- Builds multi-arch images (x86_64, arm64, ppc64le)
- Uses hermetic builds with RPM and pip prefetch
- Builds source images
- Images expire after 5 days for PR builds
- Managed centrally via `konflux-central` repository

This is a solid build integration setup, but it only validates that the image builds — no runtime or functional testing.

### Test Coverage

**Python Tests: NONE**
- 0 test files for 13 Python source files
- No pytest configuration in pyproject.toml
- No test dependency group
- No conftest.py
- Critical untested areas:
  - `pipeline.py` (628 lines) — pipeline compilation, parameter validation, DAG wiring
  - `sdg/components.py` (494 lines) — SDG component definitions
  - `training/components.py` (392 lines) — PyTorch training job configuration
  - `utils/components.py` (681 lines) — utility components, model upload, PVC operations
  - `eval/final.py` (555 lines) — final evaluation logic
  - `eval/mt_bench.py` (259 lines) — MT-Bench evaluation

**Go E2E Test:**
- 1 test file: `tests/pipeline/e2e/ilab_rhoai_pipeline_runs_test.go` (75 lines)
- Uses `testify/require` for assertions
- Tests pipeline run via KFP REST API with 2h10m timeout
- Env-gated: requires `ENABLE_ILAB_PIPELINE_TEST=true`
- Requires live cluster credentials (PIPELINE_SERVER_URL, BEARER_TOKEN)
- Pipeline parameters loaded from `tests/pipeline/e2e/resources/pipeline_params.yaml`
- Utility code in `tests/pipeline/e2e/util/rest.go` (155 lines) for HTTP operations

**Test-to-Code Ratio**: ~0.07 (230 Go test lines / 3,258 Python lines — and they test different things)

### Code Quality

**Pre-commit Hooks (`.pre-commit-config.yaml`):**
- `pre-commit-hooks` v4.6.0: trailing-whitespace, end-of-file-fixer, check-yaml, check-merge-conflict, detect-private-key
- `ruff-pre-commit` v0.6.8: linting with import sorting (`--fix --select I`), format checking
- `yamllint` v1.35.1: strict YAML validation

**Strengths:**
- Good baseline linting with ruff (modern, fast Python linter)
- YAML validation catches manifest issues
- Private key detection is a good security baseline
- Import sorting enforcement

**Weaknesses:**
- No type checking (mypy/pyright) — Python code uses `# type: ignore` on pipeline.py line 1
- No ruff configuration in pyproject.toml — using minimal defaults
- Ruff only does import sorting (`--select I`) and format checking — not enabling broader lint rules
- No Bandit or security-focused linting
- No docstring enforcement

### Container Images

**Dockerfile (community/upstream):**
- Base: `registry.access.redhat.com/ubi8/python-312:1`
- Installs: skopeo via dnf, Python deps via pip
- Sets proper permissions (`chgrp -R 0`, `chmod -R g=u`)
- Runs as non-root (`USER default`)
- No multi-stage build
- No HEALTHCHECK

**Dockerfile.konflux (production):**
- Base: `registry.access.redhat.com/ubi9/python-312:1` (pinned by digest)
- Identical build steps to Dockerfile
- Adds `com.redhat.component` label for product tracking
- Multi-arch build support (x86_64, arm64, ppc64le) via Tekton

**Weaknesses:**
- No vulnerability scanning (Trivy, Snyk, Grype)
- No runtime validation (image startup test)
- No HEALTHCHECK instruction
- No SBOM generation
- No image signing/attestation
- Inconsistent base images between Dockerfiles (UBI8 vs UBI9)
- No multi-stage build optimization

### Security Practices

| Practice | Status |
|----------|--------|
| Container scanning (Trivy/Snyk) | Missing |
| SAST (CodeQL/Semgrep/Bandit) | Missing |
| Dependency scanning | Partial (Renovate updates, but no vulnerability alerts) |
| Secret detection | Partial (detect-private-key in pre-commit, no Gitleaks) |
| SBOM generation | Missing |
| Image signing | Missing |
| Supply chain attestation | Missing |

**Positive:**
- `detect-private-key` pre-commit hook
- Renovate bot for dependency updates with automerge
- Requirements pinned with hashes (`--generate-hashes`)
- Hermetic Konflux builds with prefetch

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **`.claude/` directory**: Not present
- **Coverage**: No test type rules of any kind
- **Quality**: N/A
- **Gaps**: Everything — no unit test rules, no E2E test rules, no pipeline test patterns, no component testing guidance
- **Recommendation**: Generate comprehensive rules with `/test-rules-generator` covering Python KFP component testing, pipeline compilation testing, and Go E2E test patterns

## Recommendations

### Priority 0 (Critical)

1. **Add unit tests for all Python modules** — Start with pipeline compilation tests, then component-level tests for each module. Use pytest with KFP compiler to validate pipeline DAG structure.

2. **Add codecov integration with PR coverage gates** — Set up `.codecov.yml` with a minimum coverage threshold (start at 20%, gradually increase). Add `pytest-cov` and upload coverage in PR workflow.

3. **Add container vulnerability scanning** — Add Trivy filesystem scan in PR workflow and image scan in build workflow. Set `exit-code: 1` for CRITICAL/HIGH severity.

4. **Add PR-time test execution** — Add a `test` job to `pre_commit.yaml` that runs `uv run pytest` with coverage reporting.

### Priority 1 (High Value)

5. **Add type checking with mypy** — The codebase uses type hints already (`Optional[str]`, `Optional[list]`). Remove `# type: ignore` from pipeline.py and fix type issues.

6. **Create agent rules for test patterns** — Define `.claude/rules/` with patterns for KFP component testing, pipeline parameter validation, and Go E2E test writing.

7. **Add pipeline compilation validation in CI** — Ensure `make pipeline` produces deterministic output and the pipeline YAML is valid KFP IR.

8. **Add Dockerfile build validation on PRs** — Build both Dockerfiles in CI without pushing to catch build breakage before merge.

### Priority 2 (Nice-to-Have)

9. **Add integration tests with mock KFP server** — Use KFP's test infrastructure to validate component interactions without a live cluster.

10. **Add SAST tooling** — Bandit for Python security analysis, run in CI.

11. **Add Gitleaks to pre-commit** — Complement `detect-private-key` with comprehensive secret scanning.

12. **Add SBOM generation** — Syft or similar for container image transparency.

13. **Standardize Dockerfiles** — Both should use UBI9 base. Consider multi-stage builds for smaller images.

## Comparison to Gold Standards

| Dimension | ilab-on-ocp | odh-dashboard | notebooks | kserve |
|-----------|-------------|---------------|-----------|--------|
| Unit Tests | 0.5/10 | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 3.0/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 4.0/10 | 7/10 | 8/10 | 7/10 |
| Image Testing | 2.0/10 | 6/10 | 9/10 | 7/10 |
| Coverage Tracking | 0.0/10 | 8/10 | 6/10 | 9/10 |
| CI/CD Automation | 4.5/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 0.0/10 | 8/10 | 3/10 | 2/10 |
| **Overall** | **3.1/10** | **8.5/10** | **7.5/10** | **8.0/10** |

The most significant gap compared to gold standards is the complete absence of unit tests and coverage tracking. Even the simplest gold-standard repository has comprehensive unit test suites and coverage enforcement.

## File Paths Reference

### CI/CD
- `.github/workflows/build-main.yml` — Main branch image build and push
- `.github/workflows/pre_commit.yaml` — PR linting and validation
- `.github/workflows/renovate.json` — Renovate dependency management config
- `.tekton/odh-ml-pipelines-runtime-generic-pull-request.yaml` — Konflux PR build
- `Makefile` — Pipeline compilation target

### Source Code
- `pipeline.py` — Main KFP pipeline definition (628 lines)
- `sdg/components.py` — SDG component definitions (494 lines)
- `training/components.py` — Training component definitions (392 lines)
- `utils/components.py` — Utility components (681 lines)
- `eval/final.py` — Final evaluation logic (555 lines)
- `eval/mt_bench.py` — MT-Bench evaluation (259 lines)
- `utils/consts.py` — Constants (21 lines)
- `utils/kfp_client.py` — KFP client helper (56 lines)

### Tests
- `tests/pipeline/e2e/ilab_rhoai_pipeline_runs_test.go` — Go E2E test
- `tests/pipeline/e2e/util/rest.go` — E2E test HTTP utilities
- `tests/pipeline/e2e/resources/pipeline_params.yaml` — E2E test parameters

### Container
- `Dockerfile` — Community image (UBI8/Python 3.12)
- `Dockerfile.konflux` — Production image (UBI9/Python 3.12, pinned digest)
- `.dockerignore` — Build context exclusions

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks (ruff, yamllint)
- `.yamllint.yaml` — YAML lint configuration
- `pyproject.toml` — Project config (no test or ruff settings)
- `renovate.json` — Root Renovate config (extends konflux-central)

### Documentation
- `README.md` — Comprehensive setup and usage guide
- `CONTRIBUTING.md` — Developer setup and contribution guide
- `docs/base_model.md` — Base model configuration
- `docs/disconnected_setup.md` — Disconnected environment setup
- `docs/troubleshooting.md` — Troubleshooting guide
