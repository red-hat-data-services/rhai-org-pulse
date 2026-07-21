---
repository: "autogluon/autogluon"
overall_score: 4.7
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "197 test files across 6 modules with pytest, custom markers, fixtures, and xdist parallelization"
  - dimension: "Integration/E2E"
    score: 5.0
    status: "Smoke tests and regression tests present but no structured integration/E2E test suite"
  - dimension: "Build Integration"
    score: 4.0
    status: "Install validation on PRs but Docker builds are nightly-only, no PR-time image validation"
  - dimension: "Image Testing"
    score: 3.0
    status: "8 Dockerfiles for CPU/GPU training/inference but no runtime validation or multi-arch support"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tooling configured — no pytest-cov, no codecov, no thresholds"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "16 workflows with concurrency control, path filtering, AWS Batch GPU testing, and slash commands"
  - dimension: "Static Analysis"
    score: 6.0
    status: "Ruff linting + formatting, Bandit security scanning, Codespell, but no Dependabot/Renovate"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory — no AI agent guidance"
critical_gaps:
  - title: "No code coverage tracking"
    impact: "Cannot measure test effectiveness, coverage regressions go undetected, no PR-level coverage reporting"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No dependency alert configuration (Dependabot/Renovate)"
    impact: "Vulnerable dependencies remain undetected until manual review; no automated update PRs"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No PR-time Docker image build validation"
    impact: "Docker image build failures discovered only on nightly schedule, not at PR time"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "No structured integration/E2E test suite"
    impact: "Cross-module interactions and end-to-end workflows tested only through smoke tests and regression tests"
    severity: "MEDIUM"
    effort: "16-24 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents generating code have no project-specific guidance on test patterns, coding conventions, or architecture"
    severity: "LOW"
    effort: "2-4 hours"
quick_wins:
  - title: "Add Dependabot configuration for pip ecosystem"
    effort: "1-2 hours"
    impact: "Automated dependency vulnerability alerts and update PRs"
  - title: "Add pytest-cov to test commands and configure codecov"
    effort: "4-6 hours"
    impact: "Visibility into test coverage, PR-level coverage reporting, regression detection"
  - title: "Add CLAUDE.md with test patterns and coding conventions"
    effort: "2-3 hours"
    impact: "Improved AI-generated code quality and test consistency"
  - title: "Extend pyright type checking beyond timeseries module"
    effort: "4-8 hours"
    impact: "Catch type errors at CI time across all modules, not just timeseries"
recommendations:
  priority_0:
    - "Add pytest-cov coverage collection to all test scripts and integrate with Codecov for PR reporting"
    - "Configure .github/dependabot.yml for pip ecosystem to get automated dependency update PRs"
  priority_1:
    - "Add PR-time Docker build smoke test to catch Dockerfile regressions before merge"
    - "Create structured integration tests that validate cross-module interactions (tabular + multimodal, etc.)"
    - "Extend pyright type checking to all modules (currently only timeseries)"
  priority_2:
    - "Add CLAUDE.md with project-specific test patterns, architecture guidance, and coding conventions"
    - "Add multi-architecture Docker image support (ARM64 alongside x86_64)"
    - "Add HEALTHCHECK directives to Dockerfiles for deployment readiness"
---

# Quality Analysis: autogluon/autogluon

## Executive Summary

- **Overall Score: 4.7/10**
- **Repository Type**: Python ML library (monorepo, 6 modules)
- **Version**: 1.5.1
- **Primary Language**: Python
- **Framework**: AutoML framework (PyTorch, scikit-learn, GluonTS)
- **JIRA**: RHOAIENG / AutoML (upstream tier)

**Key Strengths**: Well-organized test suite across all modules with pytest and custom markers; comprehensive CI/CD with 16 workflows, AWS Batch GPU testing, concurrency control, and smart path filtering; good static analysis with Ruff linting, Bandit security scanning, and automated pre-commit updates.

**Critical Gaps**: Zero coverage tracking (no pytest-cov, no codecov, no thresholds); no dependency alert configuration (Dependabot/Renovate absent); Docker builds only run on nightly schedule, not at PR time; no agent rules for AI-assisted development.

**Agent Rules Status**: Missing — No CLAUDE.md, AGENTS.md, or `.claude/` directory.

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 7.0/10 | 15% | 1.05 | 197 test files, pytest + xdist, custom markers |
| Integration/E2E | 5.0/10 | 20% | 1.00 | Smoke/regression tests but no structured suite |
| Build Integration | 4.0/10 | 15% | 0.60 | Install validation only, no PR Docker builds |
| Image Testing | 3.0/10 | 10% | 0.30 | 8 Dockerfiles, no runtime validation |
| Coverage Tracking | 1.0/10 | 10% | 0.10 | No coverage tooling at all |
| CI/CD Automation | 7.0/10 | 15% | 1.05 | 16 workflows, AWS Batch, path filtering |
| Static Analysis | 6.0/10 | 10% | 0.60 | Ruff + Bandit + Codespell, no Dependabot |
| Agent Rules | 0.0/10 | 5% | 0.00 | No agent rules present |
| **Overall** | **4.7/10** | **100%** | **4.70** | |

## Critical Gaps

### 1. No Code Coverage Tracking
- **Impact**: Cannot measure test effectiveness; coverage regressions go undetected; no PR-level coverage reporting to guide reviewers
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: None of the 6 modules collect coverage data. Test scripts use `python -m pytest --junitxml=results.xml --runslow` but never include `--cov`. No `.codecov.yml`, no `pytest-cov` dependency, no coverage thresholds.
- **Evidence**: Searched all workflow files and test scripts — zero matches for `--cov`, `pytest-cov`, `coverage`, or `codecov`.

### 2. No Dependency Alert Configuration
- **Impact**: Vulnerable dependencies remain undetected until manual review; no automated update PRs for security patches
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: No `.github/dependabot.yml`, no `renovate.json`, no `.renovaterc`. The repository has 90+ third-party dependencies (PyTorch, scikit-learn, transformers, etc.) that receive no automated vulnerability monitoring.

### 3. No PR-Time Docker Image Build Validation
- **Impact**: Docker image build failures discovered only on nightly schedule (`build_latest_image.yml` runs at `59 8 * * *`), not at PR review time
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: Docker builds (CPU/GPU training/inference) are scheduled nightly, pushed to AWS ECR. A breaking change to the install script or dependency chain isn't caught until the next nightly build.

### 4. No Structured Integration/E2E Test Suite
- **Impact**: Cross-module interactions and end-to-end workflows tested only incidentally through smoke tests and regression tests
- **Severity**: MEDIUM
- **Effort**: 16-24 hours
- **Details**: While `timeseries/tests/smoketests/` and `tabular/tests/regressiontests/` exist, there is no dedicated `integration/` or `e2e/` directory. Cross-module scenarios (e.g., multimodal + tabular combined prediction) are not systematically validated.

## Quick Wins

### 1. Add Dependabot Configuration (1-2 hours)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 2. Add Coverage Collection to Test Scripts (4-6 hours)
Add `pytest-cov` to test dependencies and update test scripts:
```bash
# In each test script (test_common.sh, test_tabular.sh, etc.):
python -m pytest --junitxml=results.xml --runslow --cov=autogluon --cov-report=xml tests
```
Then configure `.codecov.yml`:
```yaml
coverage:
  status:
    project:
      default:
        target: auto
        threshold: 1%
    patch:
      default:
        target: 80%
```

### 3. Add CLAUDE.md Agent Rules (2-3 hours)
Create a `CLAUDE.md` at the project root documenting:
- Testing patterns (pytest, custom markers, conftest fixtures)
- Module structure and dependencies
- Linting requirements (ruff format, ruff check --select I)
- How to run tests locally per module

### 4. Extend Pyright Type Checking (4-8 hours)
Expand `[tool.pyright]` in `pyproject.toml` to cover all modules, not just timeseries:
```toml
[tool.pyright]
pythonVersion = "3.10"
include = [
    "timeseries/src/",
    "tabular/src/",
    "common/src/",
    "core/src/",
    "features/src/",
    "multimodal/src/",
]
```

## Detailed Findings

### Unit Tests

**Score: 7.0/10**

AutoGluon has a well-structured test suite organized per module:

| Module | Test Files | Test Directory |
|--------|-----------|----------------|
| tabular | 51 | `tabular/tests/unittests/`, `tabular/tests/regressiontests/` |
| multimodal | 38 | `multimodal/tests/unittests/` |
| timeseries | 36 | `timeseries/tests/unittests/`, `timeseries/tests/smoketests/` |
| core | 27 | `core/tests/unittests/` |
| features | 23 | `features/tests/features/` |
| common | 22 | `common/tests/unittests/` |

**Strengths**:
- 197 test files against 682 source files (29% test-to-code ratio)
- pytest framework with well-designed custom markers: `@pytest.mark.slow`, `@pytest.mark.regression`, `@pytest.mark.pyodide`, `@pytest.mark.multi_gpu`
- 11 conftest.py files providing structured fixtures (temp paths, mock resources, dummy hyperparameters)
- pytest-xdist parallelization for timeseries tests (4 processes)
- JUnit XML reporting for all test runs
- Good test isolation via temporary paths and resource mocking

**Gaps**:
- No coverage collection in any test command
- Test-to-code ratio could be higher (30%+ is the target for ML frameworks)
- No contract tests between modules

### Integration/E2E Tests

**Score: 5.0/10**

The repository lacks dedicated integration or E2E directories, but has partial equivalents:

- **Smoke tests** (`timeseries/tests/smoketests/`): `test_all_models.py` validates all timeseries models can train/predict
- **Regression tests** (`tabular/tests/regressiontests/`): `test_tabular_regression.py`, `test_tabular_lite.py` check for performance regressions
- **Platform tests** (`platform_tests-command.yml`): Run nightly and on-demand via slash command, testing across GPU configurations
- **Multi-GPU tests** (`continuous_integration_multigpu.yaml`): Triggered by label `run-multi-gpu` on PRs

**Gaps**:
- No `integration/` or `e2e/` directory
- No cross-module integration tests (e.g., tabular + multimodal combined workflows)
- No K8s/cluster testing (not applicable for library, but relevant for deployment validation)
- Platform tests are scheduled/manual, not PR-gated

### Build Integration

**Score: 4.0/10**

- **Installation testing**: `test_install.sh` validates all packages install correctly and build successfully — runs on every PR
- **Docker builds**: `build_latest_image.yml` builds 4 Docker images (CPU/GPU × training/inference) on a nightly schedule, pushed to AWS ECR
- **CI batch images**: Pre-built Docker images used by AWS Batch for CI execution (`CI/batch/docker/`)

**Gaps**:
- Docker builds are nightly only (`cron: "59 8 * * *"`), not triggered on PRs
- No PR-time validation that Docker images still build after code changes
- No Konflux build simulation (expected for upstream ML library)
- No dry-run or matrix validation of different Python versions in Docker

### Image Testing

**Score: 3.0/10**

8 Dockerfiles present across two categories:

**CI/Docker images** (nightly builds):
- `Dockerfile.cpu-training` — SageMaker PyTorch CPU base
- `Dockerfile.cpu-inference` — SageMaker PyTorch CPU base
- `Dockerfile.gpu-training` — SageMaker PyTorch GPU base
- `Dockerfile.gpu-inference` — SageMaker PyTorch GPU base

**CI Batch images** (CI infrastructure):
- `Dockerfile.cpu` — PyTorch training CPU base for batch jobs
- `Dockerfile.gpu` — PyTorch training GPU base for batch jobs
- `Dockerfile.pyodide` — Pyodide environment for WASM testing

**Gaps**:
- No multi-stage builds (simple FROM → RUN pattern)
- Base images are AWS SageMaker PyTorch images (not UBI, not FIPS-capable)
- No HEALTHCHECK directives
- No runtime validation testing (no testcontainers, no container startup tests)
- No multi-architecture support (x86_64 only)
- No `.dockerignore` file

### Coverage Tracking

**Score: 1.0/10**

No coverage tracking infrastructure exists in the repository:

- No `pytest-cov` in any test command or dependency
- No `.codecov.yml` or `codecov.yml`
- No `.coveragerc` configuration
- No `--cov` flag in any test script
- No coverage thresholds or PR gates
- No coverage reporting integration

This is the most significant quality gap. All test scripts generate JUnit XML reports but skip coverage entirely.

### CI/CD Automation

**Score: 7.0/10**

The repository has a comprehensive CI/CD setup with 16 workflow files:

**PR-Triggered Workflows**:
| Workflow | Purpose |
|----------|---------|
| `continuous_integration.yml` | Main CI: lint + test all modules on AWS Batch |
| `continuous_integration_multigpu.yaml` | Multi-GPU testing (label-gated) |
| `codespell.yml` | Spell checking on PRs |
| `check_hf_model_list.yml` | HuggingFace model list validation |

**Scheduled Workflows**:
| Workflow | Purpose | Schedule |
|----------|---------|----------|
| `benchmark_master.yml` | Performance benchmarking | Daily 2:00 UTC |
| `build_latest_image.yml` | Docker image builds | Daily 8:59 UTC |
| `platform_tests-command.yml` | Cross-platform tests | Daily 7:59 UTC |
| `pythonpublish.yml` | Nightly PyPI pre-release | Daily 8:59 UTC |

**Dispatch Workflows**:
| Workflow | Purpose |
|----------|---------|
| `slash_command_dispatch.yml` | `/benchmark` and `/platform_tests` slash commands |
| `benchmark-command.yml` | Benchmark execution |
| `pypi_release.yml` | Release publishing |

**Strengths**:
- Concurrency control with `cancel-in-progress: true` on PR CI
- Smart path filtering: skips tests when only docs change (`dorny/paths-filter@v2`)
- Module-level test isolation (common, core, features, tabular, multimodal, timeseries)
- AWS Batch for GPU testing (custom infrastructure, not limited to GitHub-hosted runners)
- Automated pre-commit hook updates (weekly via `update-pre-commit.yml`)
- Slash command integration for on-demand benchmarks
- Timeout configuration for platform tests (90 minutes)

**Gaps**:
- No pip caching in CI workflows (each run installs from scratch via AWS Batch)
- No test result aggregation or dashboard
- Multimodal tests require `run-multimodal` label (not auto-triggered on multimodal changes)
- Some workflows use outdated action versions (actions/checkout@v2)

### Static Analysis

**Score: 6.0/10**

**Linting**:
- **Ruff**: Configured in `pyproject.toml` — formatting, isort, line length (119), per-file ignores for `__init__.py`
- **Ruff pre-commit hook**: Auto-updated weekly via `update-pre-commit.yml`
- **Bandit**: Security scanning on `multimodal/src` (low-level findings, `-ll`)
- **Codespell**: Spell checking with custom ignore words
- **Pyright**: Type checking configured for timeseries module only

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- `ruff-format` — Code formatting (black-compatible)
- `ruff` — Import sorting (`--select I`)

**FIPS Compatibility**:
- No FIPS-non-compliant crypto imports found in source code (clean scan)
- Base images are SageMaker PyTorch images (not UBI-based, not FIPS-certified)
- No FIPS build tags or boringcrypto configuration (not applicable for pure Python library)

**Dependency Alerts**:
- No `.github/dependabot.yml`
- No `renovate.json` or `.renovaterc`

**Gaps**:
- No Dependabot/Renovate for automated dependency updates
- Pyright type checking limited to timeseries module only
- No mypy integration
- Bandit only runs on multimodal module, not all modules
- setup.cfg still has flake8 config but flake8 doesn't appear to be actively used in CI

### Agent Rules

**Score: 0.0/10**

No AI agent guidance exists in the repository:

- No `CLAUDE.md` at root
- No `AGENTS.md` at root
- No `.claude/` directory
- No `.claude/rules/` test creation rules
- No `.claude/skills/` custom skills

**Recommendation**: Generate test creation rules using `/test-rules-generator` to document:
- Pytest patterns and custom markers (slow, regression, pyodide, multi_gpu)
- Conftest fixture patterns across modules
- Module-specific test requirements
- Linting requirements (ruff format + isort)

## Recommendations

### Priority 0 (Critical)

1. **Add pytest-cov coverage collection and Codecov integration** — Add `--cov` flags to all test scripts, create `.codecov.yml` with PR coverage reporting and threshold enforcement. This is the single most impactful quality improvement.

2. **Configure Dependabot for pip ecosystem** — Create `.github/dependabot.yml` covering `pip` and `github-actions` ecosystems. The repository has 90+ third-party dependencies receiving no automated vulnerability monitoring.

### Priority 1 (High Value)

3. **Add PR-time Docker build smoke test** — Add a lightweight workflow that builds at least one Docker image (e.g., CPU training) on PRs that modify `CI/docker/`, `full_install*.sh`, or dependency files. Catches Docker build regressions before merge.

4. **Create structured integration tests** — Add `tests/integration/` directories with tests that validate cross-module interactions (e.g., tabular predictor using features from multiple modules, multimodal + timeseries combined pipelines).

5. **Extend Pyright type checking to all modules** — Currently only `timeseries/src/` is checked. Expanding to all 6 modules would catch type errors at CI time.

### Priority 2 (Nice-to-Have)

6. **Add CLAUDE.md with project-specific guidance** — Document test patterns, module structure, linting requirements, and architecture for AI-assisted development.

7. **Add multi-architecture Docker image support** — Build ARM64 alongside x86_64 images for broader deployment compatibility.

8. **Upgrade GitHub Actions to latest versions** — Several workflows use `actions/checkout@v2` (current is v4), `aws-actions/configure-aws-credentials@v1` (current is v4).

9. **Expand Bandit security scanning to all modules** — Currently only `multimodal/src` is scanned; extend to `tabular/`, `core/`, `common/`, `features/`, `timeseries/`.

## Comparison to Gold Standards

| Feature | AutoGluon | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|---------|-----------|---------------------|-------------------|---------------|
| Test-to-code ratio | 29% | 40%+ | 35%+ | 45%+ |
| Coverage tracking | None | Codecov with thresholds | Coverage gates | Coverage enforcement |
| PR coverage reporting | None | Yes (PR comments) | Yes | Yes |
| Integration tests | Smoke/regression only | Multi-layer | 5-layer validation | Multi-version |
| Docker PR builds | Nightly only | PR-triggered | PR-triggered | PR-triggered |
| Multi-arch images | No | Yes | Yes | Yes |
| Dependency alerts | None | Dependabot | Dependabot | Dependabot |
| Agent rules | None | Comprehensive | Present | Present |
| Linting | Ruff + Bandit | ESLint + Prettier | Multiple | golangci-lint |
| Type checking | Pyright (1 module) | TypeScript strict | N/A | Go types |
| Test parallelization | xdist (1 module) | Jest parallel | Parallel | Go parallel |

## File Paths Reference

### CI/CD
- `.github/workflows/continuous_integration.yml` — Main CI pipeline
- `.github/workflows/continuous_integration_multigpu.yaml` — Multi-GPU CI
- `.github/workflows/build_latest_image.yml` — Nightly Docker builds
- `.github/workflows/codespell.yml` — Spell checking
- `.github/workflows/update-pre-commit.yml` — Pre-commit auto-update
- `.github/workflow_scripts/` — Test execution scripts (test_common.sh, test_tabular.sh, etc.)
- `.github/actions/submit-job/` — AWS Batch job submission action

### Testing
- `common/tests/unittests/` — Common module unit tests (22 files)
- `core/tests/unittests/` — Core module unit tests (27 files)
- `features/tests/features/` — Features module tests (23 files)
- `tabular/tests/unittests/` — Tabular unit tests (51 files)
- `tabular/tests/regressiontests/` — Tabular regression tests
- `timeseries/tests/unittests/` — Timeseries unit tests (36 files)
- `timeseries/tests/smoketests/` — Timeseries smoke tests
- `multimodal/tests/unittests/` — Multimodal unit tests (38 files)

### Code Quality
- `pyproject.toml` — Ruff, Codespell, Pyright configuration
- `setup.cfg` — Legacy flake8 configuration
- `.pre-commit-config.yaml` — Ruff format + lint hooks

### Container Images
- `CI/docker/Dockerfile.cpu-training` — SageMaker CPU training image
- `CI/docker/Dockerfile.cpu-inference` — SageMaker CPU inference image
- `CI/docker/Dockerfile.gpu-training` — SageMaker GPU training image
- `CI/docker/Dockerfile.gpu-inference` — SageMaker GPU inference image
- `CI/batch/docker/Dockerfile.cpu` — CI batch CPU image
- `CI/batch/docker/Dockerfile.gpu` — CI batch GPU image
- `CI/batch/docker/Dockerfile.pyodide` — Pyodide WASM testing image
