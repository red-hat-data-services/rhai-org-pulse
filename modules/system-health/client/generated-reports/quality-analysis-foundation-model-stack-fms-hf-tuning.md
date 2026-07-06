---
repository: "foundation-model-stack/fms-hf-tuning"
overall_score: 5.9
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Strong unit test suite with pytest, good test-to-code ratio (1.09:1 by lines), covers core modules"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "No integration or E2E test infrastructure; GPU-dependent tests exist but no automated E2E pipeline"
  - dimension: "Build Integration"
    score: 3.5
    status: "No PR-time image build; /build comment-triggered only; no Konflux simulation"
  - dimension: "Image Testing"
    score: 4.0
    status: "Basic sanity check on main-branch image (accelerate binary); no runtime validation on PR"
  - dimension: "Coverage Tracking"
    score: 5.0
    status: "Coverage tox env exists with coverage.py and badge generation, but no codecov integration or PR enforcement"
  - dimension: "CI/CD Automation"
    score: 6.5
    status: "Multi-Python matrix testing, format/lint on PR, but no caching, no concurrency control, no E2E"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules or AI-assisted test guidance"
critical_gaps:
  - title: "No PR-time container image build or validation"
    impact: "Image build failures discovered only after merge on main branch; broken images can ship to Quay"
    severity: "HIGH"
    effort: "6-8 hours"
  - title: "No integration or E2E test automation"
    impact: "Training workflows, multi-GPU scenarios, and acceleration framework integration untested in CI"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No security scanning (Trivy, CodeQL, Snyk, or Gitleaks)"
    impact: "Vulnerabilities in dependencies and container images go undetected; no SBOM generation"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No coverage enforcement or PR reporting"
    impact: "Coverage regressions go unnoticed; no minimum threshold enforced"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No concurrency control on CI workflows"
    impact: "Multiple CI runs for same PR waste resources and can produce conflicting results"
    severity: "MEDIUM"
    effort: "1 hour"
  - title: "Outdated pre-commit hook versions"
    impact: "Black 22.3.0 and isort 5.11.5 are significantly behind current releases; potential formatting inconsistencies"
    severity: "LOW"
    effort: "1 hour"
quick_wins:
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Immediate vulnerability detection in base images and dependencies"
  - title: "Add codecov integration with PR comments"
    effort: "2-3 hours"
    impact: "Coverage visibility on every PR; enforce minimum thresholds"
  - title: "Add concurrency control to all workflows"
    effort: "30 minutes"
    impact: "Cancel stale runs, reduce CI costs and queue times"
  - title: "Add CodeQL or Semgrep SAST scanning"
    effort: "1-2 hours"
    impact: "Catch security issues in Python source code before merge"
  - title: "Update pre-commit hook versions"
    effort: "30 minutes"
    impact: "Modern formatting rules, better compatibility"
  - title: "Add dependency caching to CI workflows"
    effort: "1 hour"
    impact: "Faster CI runs by caching pip downloads"
recommendations:
  priority_0:
    - "Add PR-time Docker image build workflow to catch build failures before merge"
    - "Integrate Trivy scanning for container images and CodeQL for Python source"
    - "Add codecov integration with minimum coverage threshold (e.g., 70%) and PR gating"
  priority_1:
    - "Create integration test suite for training workflows (single-GPU mock or CPU-based)"
    - "Add E2E smoke tests that validate actual fine-tuning runs on small models"
    - "Create agent rules (.claude/rules/) for unit test, integration test, and mock patterns"
    - "Add SBOM generation to container image builds"
  priority_2:
    - "Add multi-architecture image builds (amd64/arm64)"
    - "Implement performance regression testing for training throughput"
    - "Add Gitleaks secret detection to PR workflow"
    - "Create contract tests for the acceleration framework plugin interface"
---

# Quality Analysis: fms-hf-tuning

## Executive Summary

- **Overall Score: 5.9/10**
- **Repository Type**: Python library for fine-tuning LLMs using Hugging Face Transformers
- **Primary Language**: Python (105 .py files)
- **Framework**: Hugging Face Transformers + TRL + Accelerate + PEFT
- **Key Strengths**: Good unit test suite with 1.09:1 test-to-code line ratio, multi-Python-version CI matrix, pylint + black + isort formatting enforcement, well-structured architecture decision records
- **Critical Gaps**: No PR-time image builds, no security scanning whatsoever, no integration/E2E tests in CI, no coverage enforcement, no agent rules
- **Agent Rules Status**: Missing -- no CLAUDE.md, no .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | Strong pytest suite, 9,854 test lines covering core modules |
| Integration/E2E | 3.0/10 | No integration/E2E infrastructure; GPU tests exist but not automated |
| **Build Integration** | **3.5/10** | **No PR-time image build; /build is comment-triggered only** |
| Image Testing | 4.0/10 | Basic sanity check (accelerate binary) on main-branch push only |
| Coverage Tracking | 5.0/10 | coverage.py + badge generation exists but no codecov or PR enforcement |
| CI/CD Automation | 6.5/10 | Multi-Python matrix, format/lint on PR, but no caching/concurrency |
| Agent Rules | 0.0/10 | No agent rules, no CLAUDE.md, no .claude/ directory |

## Critical Gaps

### 1. No PR-time Container Image Build or Validation
- **Impact**: Image build failures are only discovered after merge to main or release branches. The `/build` command exists but is comment-triggered (manual), not automatic.
- **Severity**: HIGH
- **Effort**: 6-8 hours
- **Details**: The `image.yaml` workflow runs on push to `main` only. The `release-image.yaml` runs on push/PR to `release`. No automatic image build on PRs to `main`.

### 2. No Integration or E2E Test Automation
- **Impact**: The actual fine-tuning workflow (loading model, preprocessing data, training, saving checkpoints) is never tested end-to-end in CI. GPU-dependent tests (`tox -e accel`, `tox -e gpu`) exist but are not wired into any CI workflow.
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: While the unit tests mock many components, there's no lightweight integration test that runs an actual training loop on a tiny model to verify the full pipeline works.

### 3. No Security Scanning
- **Impact**: No vulnerability detection in dependencies, container images, or source code. No SBOM generation.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Trivy, Snyk, CodeQL, Semgrep, or Gitleaks configuration found. The container images are built from `ubi9` and `nvcr.io/nvidia/pytorch` bases without any scanning.

### 4. No Coverage Enforcement or PR Reporting
- **Impact**: Coverage regressions can merge without anyone noticing. The `coverage.yaml` workflow runs `tox -e coverage` but doesn't upload to codecov or enforce thresholds.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: The tox coverage env generates XML and badge but the data isn't used for PR gating. No `.codecov.yml` configuration exists.

### 5. No Concurrency Control on CI Workflows
- **Impact**: Rapid pushes to a PR branch trigger multiple overlapping CI runs, wasting resources.
- **Severity**: MEDIUM
- **Effort**: 1 hour

### 6. Outdated Pre-commit Hooks
- **Impact**: Black 22.3.0 (March 2022) and isort 5.11.5 are significantly behind current releases.
- **Severity**: LOW
- **Effort**: 1 hour

## Quick Wins

### 1. Add Trivy Scanning to PR Workflow (1-2 hours)
```yaml
# Add to .github/workflows/security.yaml
name: Security Scan
on:
  pull_request:
    branches: [main, release]
  push:
    branches: [main]

jobs:
  trivy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
```

### 2. Add Codecov Integration (2-3 hours)
```yaml
# Add to coverage.yaml after tox -e coverage
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    file: coverage.xml
    fail_ci_if_error: true
    token: ${{ secrets.CODECOV_TOKEN }}
```

### 3. Add Concurrency Control (30 minutes)
```yaml
# Add to all PR-triggered workflows
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

### 4. Add pip Caching to CI (1 hour)
```yaml
- uses: actions/setup-python@v5
  with:
    python-version: ${{ matrix.python-version.setup }}
    cache: 'pip'
```

### 5. Update Pre-commit Hooks (30 minutes)
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/psf/black
    rev: 24.10.0  # was 22.3.0
    hooks:
      - id: black
  - repo: https://github.com/PyCQA/isort
    rev: 5.13.2  # was 5.11.5
    hooks:
      - id: isort
```

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory** (10 workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yaml` | push/PR to main, release | Unit tests (Python 3.9-3.12 matrix) |
| `coverage.yaml` | push/PR to main | Coverage report generation |
| `format.yml` | push/PR to main, release | Black formatting + pylint linting |
| `image.yaml` | push to main | Build and push NVCR dev image to Quay |
| `release-image.yaml` | push/PR to release | Build UBI9 prod image |
| `staging-image.yaml` | tags/releases | Build and push staging NVCR image |
| `build-and-publish.yaml` | release published | Build wheel and publish to PyPI |
| `pr-command.yaml` | issue_comment | `/build` and `/merge` slash commands |
| `labelpr.yaml` | PR opened/edited | Auto-label PRs by conventional commit type |
| (free-up-disk-space) | composite action | Cleanup GH runner disk space |

**Strengths**:
- Multi-Python version matrix (3.9, 3.10, 3.11, 3.12)
- Conventional commit enforcement via PR labeling
- `/build` command for on-demand image builds
- Separate UBI9 (prod) and NVCR (dev) image tracks

**Weaknesses**:
- No concurrency control on any workflow
- No pip/dependency caching
- No E2E or integration test workflows
- Test workflow doesn't install optional dependencies (mlflow, clearml, scanner-dev)
- Image builds not triggered on PRs to main

### Test Coverage

**Test Structure**:
- **37 Python test files** across 7 subdirectories
- **9,854 lines of test code** vs **8,997 lines of source code** (1.09:1 ratio)
- **Framework**: pytest with fixtures, mocking (`unittest.mock.patch`)
- **Largest test file**: `test_sft_trainer.py` (2,835 lines) -- the core trainer test

**Test Categories**:
| Category | Files | Lines | Coverage Area |
|----------|-------|-------|---------------|
| Core SFT Trainer | 1 | 2,835 | Main training entry point |
| Data Processing | 2 | 2,640 | Data handlers, preprocessing |
| Acceleration | 2 | 1,040 | Framework, dataclasses |
| Trainer Controller | 1 | 596 | Controller logic |
| Build/Launch | 2 | 625 | Launch script, utils |
| Trackers | 6 | 834 | MLflow, AIM, ClearML, file logging |
| Utils | 7 | 1,284 | Config, tokenizer, evaluator, merge |

**Coverage Tracking**:
- `tox -e coverage` runs `coverage.py` with source targeting `tuning,build`
- Omits `_version.py` and `launch_training.py`
- Generates XML and badge via `genbadge[coverage]`
- No codecov/coveralls integration
- No minimum threshold enforcement

**Gap**: GPU-dependent tests (`tox -e accel`, `tox -e gpu`) are defined but never run in CI. These require `CUDA_VISIBLE_DEVICES=0` and `flash-attn` which aren't available on GH Actions runners.

### Code Quality

**Linting & Formatting**:
- **pylint**: Extensive `.pylintrc` config (300+ lines), `fail-under=10` (strict)
- **black**: Code formatter via pre-commit (version 22.3.0 -- outdated)
- **isort**: Import sorting with `profile=black` compatibility
- **Pre-commit hooks**: `black` + `isort` (minimal but functional)

**Static Analysis**:
- pylint runs in CI (`tox -e lint`)
- No SAST tools (CodeQL, Semgrep, gosec)
- No secret detection (Gitleaks, TruffleHog)
- No dependency vulnerability scanning

**Architecture Decision Records**:
- 4 ADRs documenting key design decisions:
  - Trainer Controller Framework
  - Acceleration Framework
  - Generic Tracker Framework
  - Data Preprocessor
- ADR template provided for contributors

### Container Images

**Two Dockerfile Variants**:

1. **`build/Dockerfile`** (UBI9-based, production):
   - Multi-stage build (base -> cuda-base -> cuda-devel -> python-installations -> release)
   - UBI9 base image with CUDA 12.1
   - Conditional optional extras (AIM, MLflow, ClearML, FMS Acceleration)
   - Build cache mounts for pip
   - Non-root user (`tuning`, UID 1000)
   - Proper CVE mitigation (strips Python packages from release-base)

2. **`build/nvcr.Dockerfile`** (NVIDIA PyTorch-based, dev):
   - Multi-stage build (builder -> runtime)
   - Based on `nvcr.io/nvidia/pytorch:25.02-py3`
   - Cleanup of bloat from NVCR base (CUDA static libs, samples, docs)
   - Conditional optional extras

**Image Testing**:
- `image.yaml`: Builds NVCR image on push to main, runs basic sanity check (`which accelerate`)
- `release-image.yaml`: Builds UBI9 image on push/PR to release branch
- `/build` command: Manual trigger to build PR image

**Weaknesses**:
- No Trivy/Snyk scanning of built images
- Sanity check only verifies binary presence, not functional correctness
- No multi-architecture support (x86_64 only)
- No SBOM generation
- No image signing or attestation
- PR to main doesn't build any image automatically

### Security

**Current State**: No security tooling configured.

| Tool | Status |
|------|--------|
| Trivy/Snyk | Not configured |
| CodeQL/Semgrep | Not configured |
| Gitleaks/TruffleHog | Not configured |
| Dependabot | Not configured |
| SBOM generation | Not configured |
| Image signing | Not configured |

**Risk**: This is an ML training library that ships container images to Quay.io. Without security scanning, vulnerabilities in the CUDA stack, Python dependencies, or base images go undetected.

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **Coverage**: No test types have agent rules
- **Quality**: N/A
- **Gaps**: All test type rules are missing -- unit tests, integration tests, mock patterns, data preprocessing tests, tracker tests, acceleration framework tests
- **Recommendation**: Generate comprehensive agent rules using `/test-rules-generator` to establish patterns for:
  - Unit test creation with pytest fixtures
  - Mocking HuggingFace Transformers components
  - Testing data preprocessing pipelines
  - Testing tracker integrations (MLflow, AIM, ClearML)
  - Testing the acceleration framework plugin system
  - Testing the trainer controller framework

## Recommendations

### Priority 0 (Critical)

1. **Add PR-time Docker image build workflow**
   - Build both UBI9 and NVCR images on PRs to main
   - Include basic runtime validation (import test, version check)
   - Fail the PR if the image doesn't build

2. **Integrate security scanning**
   - Trivy for container image and filesystem scanning
   - CodeQL for Python SAST
   - Gitleaks for secret detection in commits

3. **Add codecov integration with minimum threshold**
   - Upload coverage XML to codecov
   - Set minimum threshold (e.g., 70%)
   - Require coverage comments on PRs

### Priority 1 (High Value)

4. **Create CPU-based integration test suite**
   - Small model (TinyLlama-style) end-to-end training test
   - Validate data loading -> preprocessing -> training -> checkpoint save
   - Test multiple training configurations (LoRA, QLoRA paths without GPU)

5. **Add E2E smoke tests**
   - Full fine-tuning run on tiny model with CPU/mock GPU
   - Validate output model can be loaded and generates text
   - Test accelerate launch script end-to-end

6. **Create agent rules for test automation**
   - `.claude/rules/unit-tests.md` -- pytest patterns, fixture usage, mocking
   - `.claude/rules/data-tests.md` -- data preprocessing test patterns
   - `.claude/rules/tracker-tests.md` -- tracker integration test patterns

7. **Add SBOM generation to image builds**
   - Use Syft or Trivy to generate SBOMs
   - Attach to container image as attestation

### Priority 2 (Nice-to-Have)

8. **Add multi-architecture image builds** (amd64/arm64)
9. **Implement training throughput regression tests**
10. **Add Gitleaks to PR workflow for secret detection**
11. **Create contract tests for the acceleration framework plugin interface**
12. **Add Dependabot for automated dependency updates**

## Comparison to Gold Standards

| Dimension | fms-hf-tuning | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit Tests | 7.5 -- Good pytest suite | 9.0 -- Multi-layer | 7.0 -- Image-focused | 8.5 -- Comprehensive |
| Integration/E2E | 3.0 -- None in CI | 9.0 -- Cypress E2E | 8.0 -- Image validation | 9.0 -- Multi-version |
| Build Integration | 3.5 -- Manual only | 8.0 -- PR builds | 9.0 -- Matrix builds | 7.0 -- Manifest validation |
| Image Testing | 4.0 -- Binary check only | 7.0 -- Startup tests | 9.0 -- 5-layer validation | 6.0 -- Basic |
| Coverage Tracking | 5.0 -- Exists, not enforced | 8.5 -- Codecov + gates | 6.0 -- Basic | 8.0 -- Enforced |
| CI/CD Automation | 6.5 -- Multi-Python, no cache | 9.0 -- Full pipeline | 8.0 -- Matrix + caching | 9.0 -- Comprehensive |
| Agent Rules | 0.0 -- None | 8.0 -- Comprehensive | 3.0 -- Basic | 2.0 -- Minimal |

## File Paths Reference

### CI/CD Configuration
- `.github/workflows/test.yaml` -- Unit test matrix (Python 3.9-3.12)
- `.github/workflows/coverage.yaml` -- Coverage generation
- `.github/workflows/format.yml` -- Black + pylint
- `.github/workflows/image.yaml` -- NVCR dev image build (main only)
- `.github/workflows/release-image.yaml` -- UBI9 prod image (release branch)
- `.github/workflows/staging-image.yaml` -- Staging NVCR image (tags/releases)
- `.github/workflows/build-and-publish.yaml` -- PyPI publishing
- `.github/workflows/pr-command.yaml` -- /build and /merge commands
- `.github/workflows/labelpr.yaml` -- PR auto-labeling
- `.github/actions/free-up-disk-space/action.yml` -- Disk cleanup composite action

### Testing
- `tests/test_sft_trainer.py` -- Core trainer tests (2,835 lines)
- `tests/data/` -- Data preprocessing and handler tests
- `tests/acceleration/` -- Acceleration framework tests
- `tests/trainercontroller/` -- Trainer controller tests
- `tests/trackers/` -- Tracker integration tests (MLflow, AIM, ClearML, file logging)
- `tests/utils/` -- Utility function tests
- `tests/build/` -- Build script tests

### Code Quality
- `.pylintrc` -- Pylint configuration (strict, fail-under=10)
- `.pre-commit-config.yaml` -- Black + isort hooks
- `.isort.cfg` -- Import sorting configuration
- `tox.ini` -- Test environments (py, fmt, lint, coverage, accel, gpu, build, twinecheck)
- `pytest.ini` -- Pytest configuration

### Container Images
- `build/Dockerfile` -- UBI9 production image (multi-stage, CUDA 12.1)
- `build/nvcr.Dockerfile` -- NVIDIA PyTorch dev image
- `build/accelerate_launch.py` -- Container entrypoint script
- `build/utils.py` -- Build utilities

### Project Documentation
- `README.md` -- Project overview
- `CONTRIBUTING.md` -- Detailed contribution guide
- `CODEOWNERS` -- Repository ownership
- `architecture_records/` -- 4 ADRs for key design decisions
- `pyproject.toml` -- Package metadata and dependencies
