---
repository: "autogluon/autogluon"
overall_score: 6.5
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Solid pytest suite across all 6 modules with 191 test files, fixtures, and slow-test markers"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "AWS Batch-based integration pipeline with multi-GPU and cross-platform nightly tests"
  - dimension: "Build Integration"
    score: 5.0
    status: "Docker images built nightly but no PR-time build validation or image testing"
  - dimension: "Image Testing"
    score: 4.0
    status: "4 Dockerfiles for training/inference (CPU/GPU) but no runtime validation or scanning in CI"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "No coverage measurement, no codecov/coveralls integration, no coverage thresholds"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "Comprehensive CI with concurrency control, path filters, multi-platform nightly testing, and benchmarks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent test automation guidance"
critical_gaps:
  - title: "No test coverage tracking or enforcement"
    impact: "No visibility into what code is tested; regressions in coverage go undetected"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No container image runtime validation"
    impact: "Nightly Docker builds may produce broken images that are only caught at deployment time"
    severity: "HIGH"
    effort: "6-10 hours"
  - title: "No PR-time Docker build validation"
    impact: "Build failures in Dockerfiles are only caught after merge during nightly builds"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No dependency vulnerability scanning in CI"
    impact: "Security vulnerabilities in dependencies go undetected until manual audit"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "CodeQL using outdated v2 actions"
    impact: "Potential compatibility issues and missing newer security checks"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add pytest-cov and codecov integration"
    effort: "4-6 hours"
    impact: "Immediate visibility into test coverage across all 6 modules with PR reporting"
  - title: "Add Dependabot alerts to CI (documented in SECURITY.md but not configured in workflows)"
    effort: "1-2 hours"
    impact: "Automated dependency vulnerability detection on every PR"
  - title: "Upgrade CodeQL to v4 actions"
    effort: "30 minutes"
    impact: "Access to latest security analysis rules and Python-specific checks"
  - title: "Add Trivy or Snyk scanning to Docker build workflow"
    effort: "2-3 hours"
    impact: "Catch CVEs in base images before pushing to ECR"
  - title: "Create basic CLAUDE.md with testing guidelines"
    effort: "2-3 hours"
    impact: "Enable AI-assisted test generation following project conventions"
recommendations:
  priority_0:
    - "Implement pytest-cov coverage tracking with codecov.io integration and minimum threshold enforcement (e.g., 60%)"
    - "Add container vulnerability scanning (Trivy/Snyk) to nightly Docker build workflow"
    - "Add PR-time Docker build validation to catch Dockerfile issues before merge"
  priority_1:
    - "Add integration tests that validate Docker image startup and basic prediction workflows"
    - "Upgrade all GitHub Actions to current versions (checkout@v4, codeql@v4, etc.)"
    - "Add type checking enforcement (mypy or pyright) to CI - pyright config exists but is not enforced"
    - "Create comprehensive agent rules (.claude/rules/) for test automation patterns"
  priority_2:
    - "Add secret detection (Gitleaks/TruffleHog) to CI pipeline"
    - "Implement property-based testing for data transformation modules"
    - "Add SBOM generation and image signing for Docker artifacts"
    - "Add pre-commit enforcement in CI (currently only ruff format --diff, not blocking)"
---

# Quality Analysis: AutoGluon

## Executive Summary

- **Overall Score: 6.5/10**
- **Repository Type**: Python ML library (monorepo with 6 packages)
- **Primary Language**: Python (3.10-3.13)
- **Framework**: AutoML (tabular, timeseries, multimodal prediction)
- **Developed by**: AWS AI

### Key Strengths
- Well-organized monorepo with 6 distinct packages (common, core, features, tabular, multimodal, timeseries)
- Comprehensive CI pipeline running tests on AWS Batch with GPU support
- Excellent cross-platform nightly testing (macOS, Windows, Ubuntu x Python 3.10-3.13)
- Automated benchmarking infrastructure against standard ML datasets
- CodeQL and CodeGuru security scanning (though using outdated action versions)
- Pre-commit hooks with automated weekly updates via PR

### Critical Gaps
- **Zero test coverage tracking** - no pytest-cov, no codecov, no coverage thresholds
- **No container image validation** - Docker images built nightly but never tested
- **No PR-time build validation** - Dockerfile changes only validated post-merge
- **No dependency vulnerability scanning in CI** (SECURITY.md mentions Dependabot and Snyk but these are not configured in workflows)
- **No agent rules** - no CLAUDE.md, no .claude/ directory

### Agent Rules Status: Missing

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | Solid pytest suite: 191 test files across 6 modules |
| Integration/E2E | 7.0/10 | AWS Batch CI with multi-GPU, cross-platform nightly |
| **Build Integration** | **5.0/10** | **Docker builds are nightly-only, no PR-time validation** |
| Image Testing | 4.0/10 | 4 Dockerfiles exist but no runtime validation |
| Coverage Tracking | 2.0/10 | No coverage measurement at all |
| CI/CD Automation | 8.0/10 | Comprehensive workflows with smart path filtering |
| Agent Rules | 0.0/10 | No agent rules or test automation guidance |

## Critical Gaps

### 1. No Test Coverage Tracking
- **Impact**: No visibility into what percentage of code is tested; coverage regressions go completely undetected
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: No `pytest-cov`, no `.coveragerc`, no codecov/coveralls integration, no coverage thresholds. The `grep` for coverage-related configuration returned zero results across all config files. For a library of this size (486 source files across 6 modules), this is a significant blindspot.
- **Implementation**: Add `--cov` flags to pytest invocations in `test_*.sh` scripts, configure `.coveragerc` for multi-package support, integrate with codecov.io

### 2. No Container Image Runtime Validation
- **Impact**: Nightly Docker images pushed to ECR without any validation that they actually work
- **Severity**: HIGH
- **Effort**: 6-10 hours
- **Details**: Four Dockerfiles exist (`Dockerfile.cpu-training`, `Dockerfile.cpu-inference`, `Dockerfile.gpu-training`, `Dockerfile.gpu-inference`) and are built nightly via `build_latest_image.yml`. However, after building and pushing to ECR, there is zero validation - no startup test, no smoke test, no import verification.

### 3. No PR-Time Docker Build Validation
- **Impact**: Changes to Dockerfiles or dependencies that break container builds are only discovered after merge during nightly builds
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: The `build_latest_image.yml` workflow runs only on schedule (`cron: "59 8 * * *"`) and workflow_dispatch. PR changes that affect Dockerfiles are not validated until the next nightly run.

### 4. No Dependency Vulnerability Scanning in CI
- **Impact**: Security vulnerabilities in third-party dependencies (PyTorch, transformers, etc.) go undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: `SECURITY.md` states the project uses Dependabot and Snyk, but there are no corresponding workflow files in `.github/workflows/`. CodeQL and CodeGuru are configured but focus on source code analysis, not dependency scanning. For an ML library with heavy dependencies (PyTorch, transformers, scikit-learn, etc.), dependency scanning is critical.

### 5. Outdated GitHub Actions Versions
- **Impact**: Missing newer security analysis capabilities and potential deprecation warnings
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: Multiple workflows use outdated action versions:
  - `actions/checkout@v2` (current: v4)
  - `github/codeql-action/*@v2` (current: v4)
  - `aws-actions/configure-aws-credentials@v1` (current: v4)

## Quick Wins

### 1. Add pytest-cov and Codecov Integration (4-6 hours)
Add coverage tracking to all test scripts:
```bash
# In each test_*.sh script, add --cov flag:
python -m pytest --junitxml=results.xml --cov=autogluon --cov-report=xml --runslow tests
```

Add `.codecov.yml`:
```yaml
coverage:
  status:
    project:
      default:
        target: 60%
        threshold: 2%
    patch:
      default:
        target: 70%
```

### 2. Add Trivy Scanning to Docker Build Workflow (2-3 hours)
```yaml
- name: Scan image with Trivy
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: autogluon-nightly-training:cpu-latest
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
- name: Upload Trivy scan results
  uses: github/codeql-action/upload-sarif@v4
  with:
    sarif_file: 'trivy-results.sarif'
```

### 3. Upgrade CodeQL to v4 (30 minutes)
```yaml
# Replace:
- uses: github/codeql-action/init@v2
- uses: github/codeql-action/autobuild@v2
- uses: github/codeql-action/analyze@v2
# With:
- uses: github/codeql-action/init@v4
- uses: github/codeql-action/autobuild@v4
- uses: github/codeql-action/analyze@v4
```

### 4. Create Basic CLAUDE.md (2-3 hours)
Create `CLAUDE.md` with testing conventions, pytest patterns, conftest usage, and module-specific testing instructions to enable consistent AI-assisted test generation.

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory** (17 workflow files):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `continuous_integration.yml` | push, PR | Main CI - lint + tests per module on AWS Batch |
| `continuous_integration_multigpu.yaml` | PR (labeled) | Multi-GPU multimodal tests |
| `platform_tests-command.yml` | schedule (daily), dispatch | Cross-platform (macOS/Win/Ubuntu x Py3.10-3.13) |
| `benchmark_master.yml` | schedule (daily), dispatch | AMLB benchmarks for tabular/timeseries/multimodal |
| `benchmark-command.yml` | dispatch | PR-triggered benchmark runs |
| `codeql.yml` | push, PR, schedule (weekly) | CodeQL SAST scanning |
| `codeguru-reviewer.yml` | push (master), dispatch | AWS CodeGuru code review |
| `codespell.yml` | push, PR (master) | Spelling checks |
| `check_hf_model_list.yml` | PR (labeled) | Verify HuggingFace model list updates |
| `build_latest_image.yml` | schedule (daily), dispatch | Build 4 Docker images to ECR |
| `slash_command_dispatch.yml` | issue_comment | `/platform_tests` and `/benchmark` slash commands |
| `update-pre-commit.yml` | schedule (weekly) | Auto-update ruff pre-commit hooks |
| `pypi_release.yml` | dispatch | PyPI release publishing |
| `pythonpublish.yml` | dispatch | Python package publishing |
| `pythonpublish_testpypi.yml` | dispatch | TestPyPI publishing |

**Strengths**:
- Concurrency control with `cancel-in-progress: true` on main CI
- Smart path filtering (skip tests for docs-only changes, skip timeseries for tabular-only changes)
- AWS Batch execution for GPU-intensive tests (not limited to GitHub runners)
- Slash command support for on-demand platform tests and benchmarks
- Tutorial documentation builds gated on test success

**Weaknesses**:
- No caching strategy visible (no pip cache, no conda cache in CI)
- Tests run on AWS Batch which obscures execution time and logs from PR view
- Multimodal tests require manual `run-multimodal` label (can be missed)
- No test result summary or coverage annotation on PRs

### Test Coverage

**Test Framework**: pytest (with conftest.py fixtures, markers, and `--runslow` support)

**Test Distribution**:

| Module | Test Files | Source Files | Ratio |
|--------|-----------|-------------|-------|
| common | 24 | 41 | 0.59 |
| core | 42 | 69 | 0.61 |
| features | 29 | 43 | 0.67 |
| tabular | 67 | 134 | 0.50 |
| multimodal | 45 | 128 | 0.35 |
| timeseries | 50 | 71 | 0.70 |
| **Total** | **257** | **486** | **0.53** |

**Testing Patterns**:
- Well-structured `unittests/` subdirectories within each module
- Shared fixtures via `conftest.py` (11 conftest files across modules)
- Custom markers (`@pytest.mark.slow`, `@pytest.mark.gpu`)
- JUnit XML reporting (`--junitxml=results.xml`)
- HuggingFace model dependency pre-caching in timeseries conftest

**Gaps**:
- No coverage measurement (`--cov` flag absent from all test scripts)
- No codecov/coveralls integration
- No coverage threshold enforcement
- No mutation testing
- Multimodal has lowest test-to-source ratio (0.35)

### Code Quality

**Linting**:
- **Ruff**: Configured in `pyproject.toml` with `line-length = 119`, `target-version = "py310"`
  - Import sorting (`isort`) enabled
  - Per-file ignores for `__init__.py` (F401)
  - Selective lint rules (E501, E731, E722 ignored)
- **Bandit**: Security linter run on multimodal source (`bandit -r multimodal/src -ll`)
- **Codespell**: Spelling checker configured with skip patterns
- **Flake8**: Configured in `setup.cfg` with `max-line-length = 160`

**Pre-commit Hooks**:
- `.pre-commit-config.yaml` with ruff-format and ruff-lint (import sorting only)
- Limited scope: only checks format diffs (`--diff`), not blocking
- Automated weekly updates via `update-pre-commit.yml`

**Type Checking**:
- **Pyright**: Configured in `pyproject.toml` but only for `timeseries/src/`
- **No mypy**: Not configured despite being referenced in common conftest
- Not enforced in CI

**Static Analysis**:
- CodeQL: Weekly scheduled scan + push/PR triggers (but using v2 actions)
- CodeGuru: AWS CodeGuru Reviewer on master pushes
- Bandit: Security linting for multimodal module only

### Container Images

**Dockerfiles** (4 in `CI/docker/`):
- `Dockerfile.cpu-training` - Based on PyTorch training image (2.5.1-cpu-py311)
- `Dockerfile.cpu-inference` - Based on PyTorch inference image (2.5.1-cpu-py311)
- `Dockerfile.gpu-training` - Based on PyTorch training image (2.5.1-gpu-py311-cu124)
- `Dockerfile.gpu-inference` - Based on PyTorch inference image (2.5.1-gpu-py311-cu124)

**Build Process**:
- Built nightly via `build_latest_image.yml` (schedule + workflow_dispatch)
- Pushed to AWS ECR (`369469875935.dkr.ecr.us-east-1.amazonaws.com`)
- Uses SageMaker-maintained PyTorch base images
- Includes `full_install_image.sh` for AutoGluon installation

**Gaps**:
- No image runtime validation (no startup test, no smoke test)
- No vulnerability scanning (Trivy/Snyk) despite SECURITY.md mentioning Snyk
- No multi-architecture support
- No SBOM generation
- No image signing or attestation
- No PR-time build testing
- Hardcoded `setuptools<82` cap (workaround for mmcv issue)

### Security

**Configured**:
- CodeQL SAST scanning (weekly + push/PR) - but outdated v2 actions
- AWS CodeGuru Reviewer on master
- Bandit security linter (multimodal only)
- `SECURITY.md` with vulnerability reporting process
- Dependabot mentioned in SECURITY.md (likely configured at GitHub level, not in workflows)

**Missing**:
- No container vulnerability scanning (Trivy/Snyk) in CI
- No secret detection (Gitleaks/TruffleHog)
- No dependency audit workflow
- No SBOM generation
- Bandit only covers multimodal module, not entire codebase

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No test type rules exist
- **Quality**: N/A
- **Gaps**:
  - No `CLAUDE.md` or `AGENTS.md` in repository root
  - No `.claude/` directory
  - No `.claude/rules/` for test creation rules
  - No `.claude/skills/` for custom skills
  - No testing documentation beyond inline conftest comments
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering pytest patterns, conftest conventions, GPU test markers, module-specific test patterns, and the AWS Batch execution model

## Recommendations

### Priority 0 (Critical)

1. **Implement test coverage tracking with codecov.io** - Add `pytest-cov` to all test scripts, configure `.coveragerc` for multi-package monorepo, integrate with codecov.io for PR reporting, set minimum coverage threshold (start at 60%)

2. **Add container vulnerability scanning** - Integrate Trivy or Snyk scanning into the nightly Docker build workflow to catch CVEs in base images and dependencies before pushing to ECR

3. **Add PR-time Docker build validation** - Add a CI job that builds Docker images on PRs that modify `CI/docker/`, `full_install.sh`, or dependency files, catching build failures before merge

### Priority 1 (High Value)

4. **Upgrade all GitHub Actions to current versions** - Update `actions/checkout` to v4, `codeql-action` to v4, `aws-actions/configure-aws-credentials` to v4 for security and feature improvements

5. **Add Docker image runtime validation** - After nightly builds, run basic smoke tests (import autogluon, predict on sample data) to validate training and inference images actually work

6. **Enforce type checking in CI** - Expand pyright configuration from timeseries-only to all modules, or add mypy enforcement with a gradual rollout

7. **Create comprehensive agent rules** - Add `CLAUDE.md` with testing guidelines, `.claude/rules/` with module-specific test patterns, and document the AWS Batch CI model for agent-generated tests

8. **Extend Bandit to all modules** - Currently only scans `multimodal/src`; expand to cover all 6 module source directories

### Priority 2 (Nice-to-Have)

9. **Add secret detection** - Integrate Gitleaks or TruffleHog to catch accidentally committed secrets or API keys

10. **Implement pre-commit enforcement in CI** - Current pre-commit hooks only run `--diff` mode; add a CI check that fails on format violations

11. **Add SBOM generation and image signing** - Generate SBOMs for Docker artifacts and implement cosign/Sigstore image signing

12. **Add property-based testing** - For data transformation modules (features, common), add hypothesis-based property tests to catch edge cases in data processing

## Comparison to Gold Standards

| Dimension | AutoGluon | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | 7.5 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 7.0 | 9.0 | 8.0 | 9.0 |
| Build Integration | 5.0 | 8.0 | 7.0 | 8.0 |
| Image Testing | 4.0 | 7.0 | 9.0 | 7.0 |
| Coverage Tracking | 2.0 | 9.0 | 6.0 | 9.0 |
| CI/CD Automation | 8.0 | 9.0 | 8.0 | 9.0 |
| Agent Rules | 0.0 | 8.0 | 3.0 | 2.0 |
| **Overall** | **6.5** | **8.7** | **7.2** | **8.1** |

AutoGluon's strengths (cross-platform testing, GPU CI, benchmarking) are offset by critical gaps in coverage tracking, container validation, and security scanning. The lack of any coverage measurement is the most impactful gap for a library of this size.

## File Paths Reference

### CI/CD
- `.github/workflows/continuous_integration.yml` - Main CI pipeline
- `.github/workflows/continuous_integration_multigpu.yaml` - Multi-GPU tests
- `.github/workflows/platform_tests-command.yml` - Cross-platform nightly tests
- `.github/workflows/benchmark_master.yml` - Nightly benchmarks
- `.github/workflows/codeql.yml` - CodeQL SAST
- `.github/workflows/codeguru-reviewer.yml` - AWS CodeGuru
- `.github/workflows/build_latest_image.yml` - Docker nightly builds
- `.github/workflows/slash_command_dispatch.yml` - Slash command support
- `.github/workflows/update-pre-commit.yml` - Pre-commit auto-update
- `.github/workflow_scripts/lint_check.sh` - Lint orchestrator (ruff + bandit)

### Testing
- `{module}/tests/` - Test directories for each module
- `{module}/tests/conftest.py` - Pytest fixtures and configuration
- `.github/workflow_scripts/test_*.sh` - Test execution scripts

### Code Quality
- `pyproject.toml` - Ruff, codespell, pyright configuration
- `setup.cfg` - Flake8 configuration
- `.pre-commit-config.yaml` - Pre-commit hooks (ruff)

### Container Images
- `CI/docker/Dockerfile.cpu-training` - CPU training image
- `CI/docker/Dockerfile.cpu-inference` - CPU inference image
- `CI/docker/Dockerfile.gpu-training` - GPU training image
- `CI/docker/Dockerfile.gpu-inference` - GPU inference image

### Security
- `SECURITY.md` - Security policy and reporting
- `.github/workflows/codeql.yml` - CodeQL scanning
- `.github/workflows/codeguru-reviewer.yml` - CodeGuru analysis
