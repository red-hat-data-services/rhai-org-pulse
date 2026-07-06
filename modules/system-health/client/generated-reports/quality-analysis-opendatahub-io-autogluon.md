---
repository: "opendatahub-io/autogluon"
overall_score: 6.4
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Good coverage across all 7 modules with pytest; 206 test files, ~40K lines of tests"
  - dimension: "Integration/E2E"
    score: 6.0
    status: "Regression and smoke test tiers exist but limited to tabular/timeseries; no cross-module integration tests"
  - dimension: "Build Integration"
    score: 3.0
    status: "No PR-time container image build validation; images built on schedule only"
  - dimension: "Image Testing"
    score: 3.5
    status: "8 Dockerfiles for CI/inference but no runtime validation or startup testing"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tool integration (no codecov, coveralls, or .coveragerc); no thresholds"
  - dimension: "CI/CD Automation"
    score: 7.5
    status: "Comprehensive AWS Batch-based CI with per-module tests, concurrency control, and path filtering"
  - dimension: "Agent Rules"
    score: 7.0
    status: "AGENTS.md present with build/test/lint commands and architecture docs; no .claude/rules/ for test patterns"
critical_gaps:
  - title: "No test coverage tracking or enforcement"
    impact: "Impossible to measure test quality, detect coverage regressions, or enforce minimum thresholds"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No PR-time container image build validation"
    impact: "Image build failures discovered only in scheduled nightly builds, not at PR time"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No container vulnerability scanning"
    impact: "Security vulnerabilities in base images and dependencies go undetected until production"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No cross-module integration tests"
    impact: "Dependency chain breakages (common -> core -> tabular) not caught until full install"
    severity: "MEDIUM"
    effort: "8-16 hours"
  - title: "Bandit only runs on multimodal module"
    impact: "Security analysis misses 6 of 7 sub-packages"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add pytest-cov and codecov integration"
    effort: "4-6 hours"
    impact: "Immediate visibility into test coverage across all modules with PR-level reporting"
  - title: "Extend bandit scanning to all modules"
    effort: "1 hour"
    impact: "Security analysis covers entire codebase instead of just multimodal"
  - title: "Add Trivy container scanning workflow"
    effort: "2-3 hours"
    impact: "Automated vulnerability detection for all 8 Dockerfiles"
  - title: "Add pyright/mypy type checking for more modules"
    effort: "4-8 hours"
    impact: "Catch type errors at CI time; currently only timeseries mentions pyright"
  - title: "Create .claude/rules/ with test creation guidelines"
    effort: "2-3 hours"
    impact: "Standardize AI-generated test quality with module-specific patterns"
recommendations:
  priority_0:
    - "Implement pytest-cov with codecov integration and enforce minimum coverage thresholds per module"
    - "Add Trivy or Snyk container scanning for all Dockerfiles in CI"
    - "Extend bandit security scanning to all 7 sub-packages, not just multimodal"
  priority_1:
    - "Add PR-time container image build validation (at least a docker build test)"
    - "Implement cross-module integration tests for the dependency chain"
    - "Add type checking (pyright or mypy) across all modules, not just timeseries"
    - "Create .claude/rules/ directory with test creation guidelines for unit, regression, and smoke tests"
  priority_2:
    - "Add dependency scanning (Dependabot or Renovate) for Python dependencies"
    - "Implement performance regression benchmarks in PR CI (not just scheduled)"
    - "Add secret detection (gitleaks) to PR workflow"
    - "Consider adding contract tests between sub-package boundaries"
---

# Quality Analysis: opendatahub-io/autogluon

## Executive Summary

- **Overall Score: 6.4/10**
- **Repository Type**: Python ML library monorepo (AutoML)
- **Version**: 1.5.1
- **Primary Language**: Python (992 .py files)
- **Framework**: PyTorch-based AutoML with 7 sub-packages

### Key Strengths
- Well-structured monorepo with clear module boundaries (common, core, features, tabular, multimodal, timeseries, eda)
- Comprehensive CI via AWS Batch with per-module test jobs, GPU support, and concurrency control
- Good test organization with unit/regression/smoke test tiers and pytest markers (slow, regression, multi_gpu)
- AGENTS.md provides excellent developer onboarding with build, test, lint commands and architecture docs
- CodeQL and CodeGuru security scanning present
- Pre-commit hooks with ruff for formatting and import sorting

### Critical Gaps
- **No test coverage tracking** - No codecov, coveralls, or .coveragerc. Impossible to measure or enforce coverage.
- **No container image validation at PR time** - Images only built on schedule; breakages discovered post-merge.
- **No container vulnerability scanning** - No Trivy, Snyk, or equivalent for any of the 8 Dockerfiles.
- **Partial security scanning** - Bandit only covers multimodal/src, leaving 6 modules unscanned.

### Agent Rules Status
- **Present**: AGENTS.md with comprehensive build/test/lint instructions
- **Missing**: `.claude/rules/` directory with test creation patterns

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 7.5/10 | 20% | Good coverage across all 7 modules; 206 test files, ~40K LOC tests vs ~144K LOC source |
| Integration/E2E | 6.0/10 | 25% | Regression tests (tabular) and smoke tests (timeseries); no cross-module integration |
| Build Integration | 3.0/10 | — | No PR-time image builds; scheduled-only image build workflow |
| Image Testing | 3.5/10 | 20% | 8 Dockerfiles exist but no runtime validation, startup testing, or SBOM |
| Coverage Tracking | 1.0/10 | 15% | No coverage tools configured anywhere |
| CI/CD Automation | 7.5/10 | 20% | AWS Batch CI with path filtering, concurrency, docs build pipeline |
| Agent Rules | 7.0/10 | — | AGENTS.md strong; no .claude/rules/ test patterns |

**Weighted Overall: 6.4/10** (excluding unweighted dimensions)

## Critical Gaps

### 1. No Test Coverage Tracking or Enforcement
- **Severity**: HIGH
- **Impact**: Cannot measure test quality, detect coverage regressions on PRs, or enforce minimum thresholds. New code may ship entirely untested.
- **Effort**: 4-6 hours
- **Details**: No `.coveragerc`, no `codecov.yml`, no `--cov` flags in any test scripts. The `pytest` runs in CI generate JUnit XML (`--junitxml=results.xml`) but not coverage data.

### 2. No PR-time Container Image Build Validation
- **Severity**: HIGH
- **Impact**: The `build_latest_image.yml` workflow only runs on schedule (`cron: "59 8 * * *"`) or manual dispatch. Dockerfile changes in PRs are never validated until the nightly build.
- **Effort**: 8-12 hours
- **Details**: 8 Dockerfiles exist across `CI/docker/` and `CI/batch/docker/` but none are built as part of PR CI.

### 3. No Container Vulnerability Scanning
- **Severity**: HIGH
- **Impact**: Base images (AWS DLC PyTorch images) and installed dependencies are never scanned for CVEs. No Trivy, Snyk, or equivalent configured.
- **Effort**: 2-4 hours
- **Details**: No `.trivyignore`, no Snyk config, no container scanning workflows.

### 4. Incomplete Security Scanning
- **Severity**: MEDIUM
- **Impact**: Bandit only runs on `multimodal/src` in the lint check script. The other 6 modules (common, core, features, tabular, timeseries, eda) are not scanned.
- **Effort**: 1-2 hours
- **Details**: In `.github/workflow_scripts/lint_check.sh`: `bandit -r multimodal/src -ll`

### 5. No Cross-Module Integration Tests
- **Severity**: MEDIUM
- **Impact**: The dependency chain (common -> core -> features -> tabular/multimodal/timeseries) is tested in isolation per module. A breaking change in `common` might only be caught when `tabular` CI also runs, not via a dedicated integration test.
- **Effort**: 8-16 hours

## Quick Wins

### 1. Add pytest-cov and Codecov Integration (4-6 hours)
Add `--cov` flag to test scripts and integrate codecov:
```yaml
# In each test script, add:
python -m pytest --junitxml=results.xml --cov=autogluon --cov-report=xml --runslow tests

# Add .codecov.yml:
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

### 2. Extend Bandit to All Modules (1 hour)
Update `.github/workflow_scripts/lint_check.sh`:
```bash
# Current: only multimodal
bandit -r multimodal/src -ll

# Updated: all modules
for module in common core features tabular multimodal timeseries eda; do
    bandit -r "$module/src" -ll
done
```

### 3. Add Trivy Container Scanning (2-3 hours)
```yaml
# .github/workflows/trivy-scan.yml
name: Container Security Scan
on:
  pull_request:
    paths:
      - 'CI/docker/**'
      - 'CI/batch/docker/**'
  schedule:
    - cron: '0 6 * * 1'
jobs:
  scan:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        dockerfile:
          - CI/docker/Dockerfile.cpu-training
          - CI/docker/Dockerfile.gpu-training
    steps:
      - uses: actions/checkout@v4
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: ${{ matrix.dockerfile }}
          severity: 'CRITICAL,HIGH'
```

### 4. Add Type Checking to More Modules (4-8 hours)
AGENTS.md mentions pyright for timeseries only. Extend to all modules:
```bash
# pyproject.toml addition
[tool.pyright]
include = ["common/src", "core/src", "features/src", "tabular/src", "multimodal/src", "timeseries/src"]
reportMissingImports = true
pythonVersion = "3.10"
```

### 5. Create .claude/rules/ Test Guidelines (2-3 hours)
```markdown
# .claude/rules/unit-tests.md
- Use pytest as the framework
- Place tests in <module>/tests/unittests/
- Use @pytest.mark.slow for tests >5 seconds
- Train on tiny data subsamples with minimal iterations
- Use conftest.py fixtures for shared setup
- Follow existing patterns in each module's test directory
```

## Detailed Findings

### CI/CD Pipeline

**Workflows** (14 total):
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `continuous_integration.yml` | push, pull_request_target | Main CI: lint + per-module tests on AWS Batch |
| `continuous_integration_multigpu.yaml` | PR (labeled) | Multi-GPU multimodal tests |
| `codeql.yml` | push, PR, weekly | CodeQL SAST scanning |
| `codespell.yml` | push, PR to master | Spell checking |
| `codeguru-reviewer.yml` | push to master | AWS CodeGuru code review |
| `benchmark-command.yml` | workflow_dispatch (slash command) | PR benchmarking |
| `benchmark_master.yml` | daily schedule, dispatch | Master branch benchmarks |
| `build_latest_image.yml` | daily schedule, dispatch | Build Docker images to ECR |
| `platform_tests-command.yml` | daily schedule, dispatch | Cross-platform tests |
| `pypi_release.yml` | release created | Publish to PyPI |
| `pythonpublish.yml` | daily schedule, dispatch | Nightly PyPI publish |
| `pythonpublish_testpypi.yml` | dispatch | Test PyPI publish |
| `slash_command_dispatch.yml` | issue_comment | Dispatch slash commands |
| `update-pre-commit.yml` | weekly, dispatch | Auto-update pre-commit hooks |

**Strengths**:
- Concurrency control with `cancel-in-progress: true` on PR CI
- Path filtering (skips CI for docs-only changes)
- Per-module parallelization (common, core, features, tabular, multimodal, timeseries tested in parallel)
- GPU and multi-GPU test tiers
- Docs build pipeline dependent on all tests passing
- Slash command support for benchmarking

**Weaknesses**:
- Tests run on AWS Batch (not standard GitHub runners) making reproduction harder
- No caching strategy visible in CI (each run installs from scratch)
- EDA tests are commented out in CI
- No PR-time image build validation

### Test Coverage

**Test Structure (per module)**:

| Module | Test Files | Source Files | Test Tiers |
|--------|-----------|-------------|------------|
| common | 20 | 42 | unittests |
| core | 26 | 69 | unittests |
| features | 21 | 43 | features (flat) |
| eda | 20 | 23 | unittests |
| tabular | 49 | 134 | unittests, regressiontests |
| multimodal | 36 | 128 | unittests |
| timeseries | 34 | 71 | unittests, smoketests |

**Total**: 206 test files / 510 source files (~0.40 test-to-source ratio)
**Lines**: ~40K test LOC / ~144K source LOC (~0.28 test-to-source line ratio)

**Testing Framework**: pytest with:
- Custom markers: `@pytest.mark.slow`, `@pytest.mark.regression`, `@pytest.mark.pyodide`, `@pytest.mark.multi_gpu`
- conftest.py with `--runslow`, `--runregression`, `--runpyodide`, `--run-multi-gpu` options
- JUnit XML output (`--junitxml=results.xml`)
- Parallel execution via pytest-xdist (timeseries: `--numprocesses 4`)
- Resource mocking fixtures for CPU/GPU counts

**Strengths**:
- Every module has a dedicated test directory
- Tiered test approach (fast unit tests by default, slow tests opt-in via `--runslow`)
- Regression test suite for tabular predictions
- Smoke tests for all timeseries models
- Style check tests (`test_check_style.py`) in each module

**Weaknesses**:
- No coverage measurement or reporting anywhere
- EDA tests commented out in CI
- No contract tests between module boundaries
- No test data management strategy visible

### Code Quality

**Linting**:
- **Ruff**: Configured in `pyproject.toml` with line-length=119, targeting Python 3.10+
- Ignores: E501 (line length), E731 (lambda), E722 (bare except)
- isort integration via ruff for import ordering
- Applied to all modules: multimodal, timeseries, common, core, features, tabular

**Pre-commit Hooks**:
- `.pre-commit-config.yaml` present with ruff-format and ruff-lint
- Auto-update workflow runs weekly (`update-pre-commit.yml`)
- Hooks run `--diff` mode (check only, not auto-fix)

**Static Analysis**:
- **Bandit**: Runs on multimodal/src only (partial coverage)
- **CodeQL**: Runs on all pushes, PRs, and weekly schedule
- **CodeGuru**: Runs on pushes to master (AWS-specific)
- **Codespell**: Spell checking on pushes and PRs to master

**Type Checking**:
- **pyright**: Mentioned in AGENTS.md for timeseries only
- No mypy configuration
- No strict type checking enforced across modules

### Container Images

**Dockerfiles** (8 total):
| File | Purpose | Base Image |
|------|---------|------------|
| `CI/docker/Dockerfile.cpu-inference` | SageMaker CPU inference | AWS PyTorch 2.5.1 CPU |
| `CI/docker/Dockerfile.cpu-training` | SageMaker CPU training | AWS PyTorch 2.5.1 CPU |
| `CI/docker/Dockerfile.gpu-inference` | SageMaker GPU inference | AWS PyTorch 2.5.1 GPU CUDA 12.4 |
| `CI/docker/Dockerfile.gpu-training` | SageMaker GPU training | AWS PyTorch 2.5.1 GPU CUDA 12.4 |
| `CI/batch/docker/Dockerfile.cpu` | CI batch CPU | AWS PyTorch 2.8.0 CPU |
| `CI/batch/docker/Dockerfile.gpu` | CI batch GPU | AWS PyTorch 2.8.0 GPU CUDA 12.9 |
| `CI/batch/docker/Dockerfile.pyodide` | Pyodide/WASM testing | pyodide/pyodide-env |
| `CI/hf_mirror/Dockerfile` | HuggingFace model mirror | (not examined) |

**Strengths**:
- Multi-variant images (CPU/GPU, training/inference)
- AWS DLC (Deep Learning Container) base images
- Separate CI batch images from deployment images

**Weaknesses**:
- No runtime validation or startup testing
- No multi-architecture support (amd64 only)
- No SBOM generation
- No image signing/attestation
- No vulnerability scanning
- Images build from `git clone` of main repo (not from PR context)
- Outdated `actions/checkout@v2` references

### Security

**Present**:
- CodeQL SAST on push/PR/weekly schedule
- CodeGuru Reviewer on master pushes
- Bandit for Python security (multimodal only)
- Codespell for typo detection
- Permissions scoped per workflow (least privilege principle)

**Missing**:
- No container image vulnerability scanning (Trivy, Snyk)
- No dependency scanning (Dependabot, Renovate)
- No secret detection (gitleaks, TruffleHog)
- No SBOM generation
- No supply chain security (Sigstore, SLSA)
- Bandit coverage incomplete (only 1 of 7 modules)

### Agent Rules (Agentic Flow Quality)

**Status**: Partially Present
- **CLAUDE.md**: Exists but only contains `@AGENTS.md` (redirect)
- **AGENTS.md**: Comprehensive with:
  - Build and install instructions per module
  - Test execution commands (per module, single file)
  - Lint commands (check and auto-fix)
  - Architecture overview with dependency graph
  - Test structure documentation (unit/smoke/regression tiers)
  - Key conventions (lazy imports, NumPy docstrings, small tests)
  - PR conventions

**Coverage**: Build, test, and lint workflows documented. No specific test creation rules.
**Quality**: AGENTS.md is well-structured, actionable, and up-to-date.
**Gaps**:
- No `.claude/rules/` directory with test creation patterns
- No test template or example rules
- No module-specific testing guidelines (e.g., how to test a new tabular model vs. a new timeseries model)
- **Recommendation**: Generate missing rules with `/test-rules-generator`

## Recommendations

### Priority 0 (Critical)

1. **Implement test coverage tracking** - Add `pytest-cov` to test scripts, create `.coveragerc` per module, integrate Codecov with PR reporting. Enforce minimum thresholds (e.g., 60% project, 80% patch).
2. **Add container vulnerability scanning** - Add Trivy or Snyk workflow scanning all 8 Dockerfiles, at minimum on schedule and on Dockerfile changes.
3. **Extend bandit to all modules** - Single-line change in `lint_check.sh` to scan all `*/src` directories, not just multimodal.

### Priority 1 (High Value)

4. **Add PR-time Docker build validation** - At minimum, run `docker build` for all Dockerfiles on PRs that modify them. Validates Dockerfile syntax and dependency resolution before merge.
5. **Add cross-module integration tests** - Test the full dependency chain installation and basic imports across module boundaries.
6. **Expand type checking** - Configure pyright or mypy for all modules in CI, not just timeseries.
7. **Create `.claude/rules/` test patterns** - Add rules for unit test creation, regression test patterns, and module-specific testing guidelines.
8. **Add dependency scanning** - Enable Dependabot or Renovate for automated dependency update PRs.

### Priority 2 (Nice-to-Have)

9. **Add secret detection** - Integrate gitleaks into PR workflow.
10. **PR-time benchmarks** - Run lightweight benchmarks on PRs (currently scheduled/dispatch only).
11. **Re-enable EDA tests** - The EDA module tests are commented out in CI; re-enable or remove the dead code.
12. **Update GitHub Actions versions** - Many workflows use `actions/checkout@v2` (deprecated); upgrade to `v4`.
13. **Add SBOM generation** - Generate Software Bill of Materials for container images.
14. **Consider contract tests** - Define and test the API contracts between sub-packages.

## Comparison to Gold Standards

| Practice | autogluon | odh-dashboard | notebooks | kserve |
|----------|-----------|---------------|-----------|--------|
| Unit test framework | pytest | Jest/Vitest | pytest | Go testing |
| Coverage tracking | None | Codecov | Partial | Codecov |
| Coverage enforcement | None | PR thresholds | None | Min thresholds |
| Integration tests | Partial (regression) | Contract tests | Image validation | E2E suite |
| E2E tests | Smoke tests (TS) | Cypress | Notebook execution | Multi-version |
| Container scanning | None | Trivy | Trivy | Trivy |
| SAST | CodeQL + Bandit (partial) | CodeQL | Limited | CodeQL + gosec |
| Pre-commit hooks | Ruff | Husky | Pre-commit | Pre-commit |
| Agent rules | AGENTS.md | .claude/rules/ | None | None |
| Concurrency control | Yes | Yes | Yes | Yes |
| Multi-GPU testing | Yes (labeled) | N/A | N/A | N/A |
| Benchmark suite | Yes (slash cmd) | Performance tests | None | Load tests |

## File Paths Reference

### CI/CD
- `.github/workflows/continuous_integration.yml` - Main CI pipeline
- `.github/workflows/continuous_integration_multigpu.yaml` - Multi-GPU CI
- `.github/workflows/codeql.yml` - CodeQL SAST
- `.github/workflows/codeguru-reviewer.yml` - AWS CodeGuru
- `.github/workflows/build_latest_image.yml` - Nightly image builds
- `.github/actions/submit-job/action.yml` - AWS Batch job submission
- `.github/workflow_scripts/lint_check.sh` - Lint and bandit script
- `.github/workflow_scripts/test_*.sh` - Per-module test scripts

### Testing
- `{module}/tests/unittests/` - Unit tests (all modules)
- `tabular/tests/regressiontests/` - Tabular regression tests
- `timeseries/tests/smoketests/` - Timeseries smoke tests
- `{module}/tests/conftest.py` - Pytest configuration per module
- `{module}/tests/test_check_style.py` - Style check per module

### Code Quality
- `pyproject.toml` - Ruff configuration
- `.pre-commit-config.yaml` - Pre-commit hooks (ruff-format, ruff-lint)
- `setup.cfg` - Flake8 configuration (legacy)

### Container Images
- `CI/docker/Dockerfile.*` - SageMaker deployment images (4 variants)
- `CI/batch/docker/Dockerfile.*` - CI batch images (3 variants)
- `CI/hf_mirror/Dockerfile` - HuggingFace mirror

### Agent Rules
- `CLAUDE.md` - Redirects to AGENTS.md
- `AGENTS.md` - Comprehensive developer guide
