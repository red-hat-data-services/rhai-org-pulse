---
repository: "opendatahub-io/vllm-gaudi"
overall_score: 4.2
scorecard:
  - dimension: "Unit Tests"
    score: 5.5
    status: "Large inherited test suite from upstream vllm (363 files) but none run in CI for Gaudi"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "Jenkins triggered on PRs via webhook but opaque — no visible test definitions or results"
  - dimension: "Build Integration"
    score: 2.5
    status: "No PR-time Docker image build validation; CPU-only smoke test with fake HPU device"
  - dimension: "Image Testing"
    score: 3.0
    status: "Multiple Dockerfiles including UBI-based production image but no runtime validation in CI"
  - dimension: "Coverage Tracking"
    score: 0.5
    status: "No coverage tooling — no codecov, coveralls, or .coveragerc configuration"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "14 workflows for linting and formatting; tests delegated to external Jenkins"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory — zero agent guidance"
critical_gaps:
  - title: "No test execution in GitHub Actions CI"
    impact: "Test suite of 363 files exists but no tests run on PRs in GitHub Actions — all testing delegated to opaque Jenkins"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No code coverage tracking"
    impact: "Cannot measure or enforce coverage levels; regressions in test quality go undetected"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container image validation in CI"
    impact: "Dockerfile.hpu.ubi is the production image for RHOAI but is never built or tested on PRs"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No vulnerability or container scanning"
    impact: "No Trivy, Snyk, or dependency scanning — vulnerabilities in base images or pip packages go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No pre-commit hooks"
    impact: "Developers must manually run format.sh; formatting issues slip into PRs"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "Jenkins testing is a black box"
    impact: "trigger_jenkins.yml fires a webhook with no visibility into what tests run, pass, or fail — no test results posted back to PR"
    severity: "HIGH"
    effort: "8-16 hours"
quick_wins:
  - title: "Add pytest-cov and codecov to CPU test workflow"
    effort: "2-3 hours"
    impact: "Establish baseline coverage metrics and catch coverage regressions"
  - title: "Add Trivy container scanning workflow"
    effort: "1-2 hours"
    impact: "Detect known CVEs in base images and Python dependencies"
  - title: "Add pre-commit-config.yaml with ruff, mypy, yapf hooks"
    effort: "1-2 hours"
    impact: "Catch formatting and type issues locally before push"
  - title: "Add PR-time Dockerfile.hpu.ubi build validation"
    effort: "3-4 hours"
    impact: "Catch build failures in the production UBI image before merge"
  - title: "Create basic CLAUDE.md with test patterns"
    effort: "2-3 hours"
    impact: "Enable AI-assisted test creation following project conventions"
recommendations:
  priority_0:
    - "Expand CPU test workflow to run pytest unit test suite (not just a single example script)"
    - "Add coverage tracking with codecov integration and minimum threshold enforcement"
    - "Add container image build validation for Dockerfile.hpu.ubi on PRs"
    - "Add Trivy or Snyk container and dependency scanning"
  priority_1:
    - "Surface Jenkins test results back into GitHub PR checks (status API or check runs)"
    - "Add pre-commit hooks to enforce formatting standards locally"
    - "Add secret detection (gitleaks) to CI pipeline"
    - "Create agent rules (.claude/rules/) for test creation patterns"
  priority_2:
    - "Add SBOM generation for container images"
    - "Implement multi-architecture image builds (AMD64 + ARM64)"
    - "Add performance regression testing benchmarks to CI"
    - "Add dependency update automation (Dependabot/Renovate)"
---

# Quality Analysis: vllm-gaudi

## Executive Summary

- **Overall Score: 4.2/10**
- **Repository Type**: Python ML inference engine (vLLM fork for Intel Gaudi HPU accelerators)
- **Primary Language**: Python (155,798 lines source, 61,517 lines tests)
- **Default Branch**: `v1.19.0` (not `main` — uses version-based branches)
- **Key Strengths**: Strong linting pipeline (ruff, mypy, yapf, codespell, clang-format, isort, shellcheck, actionlint), inherited comprehensive test suite from upstream vLLM, multi-platform Dockerfiles, OSSF Scorecard integration
- **Critical Gaps**: Tests exist but don't run in GitHub CI, no coverage tracking, no container scanning, no image build validation on PRs, Jenkins testing is opaque
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 5.5/10 | Large inherited suite (363 test files) but only 1 smoke test runs in CI |
| Integration/E2E | 3.0/10 | Jenkins triggered via webhook but fully opaque — no visible test config |
| **Build Integration** | **2.5/10** | **No PR-time image build; CPU smoke test only runs offline_inference example** |
| Image Testing | 3.0/10 | 10 Dockerfiles exist (inc. UBI production) but none validated in CI |
| Coverage Tracking | 0.5/10 | No coverage tooling whatsoever |
| CI/CD Automation | 5.0/10 | 14 workflows (mostly lint/format); test execution delegated externally |
| Agent Rules | 0.0/10 | No agent rules, no .claude/ directory |

## Critical Gaps

### 1. No Test Execution in GitHub Actions CI
- **Impact**: The repository inherits 363 test files from upstream vLLM covering unit tests, speculative decoding, model correctness, tokenization, quantization, LoRA, distributed execution, and more — but **none of these run in GitHub Actions**
- **Severity**: HIGH
- **Current State**: `cpu-test.yml` runs a single example script (`examples/offline_inference_fakehpu.py`) with `VLLM_USE_FAKE_HPU=1`, not the actual test suite
- **Effort**: 16-24 hours to set up a meaningful CPU-based test subset

### 2. Jenkins Testing is a Black Box
- **Impact**: `trigger_jenkins.yml` fires a webhook to an external Jenkins server on every PR, but there's zero visibility into what tests run, their configuration, pass/fail status, or test results
- **Severity**: HIGH
- **Current State**: A single `curl -XPOST` to a webhook URL — no status reporting back to GitHub
- **Effort**: 8-16 hours to integrate Jenkins results back into GitHub

### 3. No Code Coverage Tracking
- **Impact**: No way to measure or enforce test coverage levels; coverage regressions go completely undetected
- **Severity**: HIGH
- **Current State**: No `.coveragerc`, no `codecov.yml`, no coverage generation in any workflow
- **Effort**: 4-6 hours

### 4. No Container Image Validation
- **Impact**: `Dockerfile.hpu.ubi` is the production image for RHOAI deployment with multi-stage build, but it's never built or validated on PRs — build failures discovered only after merge in Konflux
- **Severity**: HIGH
- **Current State**: 10 Dockerfiles exist (HPU, CPU, ROCm, XPU, TPU, Neuron, OpenVINO, PPC64LE, UBI) but none are built in CI
- **Effort**: 8-12 hours

### 5. No Vulnerability or Container Scanning
- **Impact**: No Trivy, Snyk, Grype, or dependency scanning — CVEs in the Habana base image or in the 100+ pip dependencies go undetected
- **Severity**: HIGH
- **Current State**: OSSF Scorecard runs weekly but doesn't scan containers or dependencies
- **Effort**: 2-4 hours

### 6. No Pre-commit Hooks
- **Impact**: `format.sh` script exists requiring manual execution; developers must remember to run yapf, ruff, mypy, codespell, isort, and clang-format before pushing
- **Severity**: MEDIUM
- **Current State**: Linting is enforced in CI but not locally — wastes CI cycles on formatting fixes
- **Effort**: 2-3 hours

## Quick Wins

### 1. Add Trivy Container Scanning (1-2 hours)
```yaml
# .github/workflows/trivy.yml
name: Container Security Scan
on:
  pull_request:
    paths:
      - 'Dockerfile*'
      - 'requirements*.txt'
  schedule:
    - cron: '0 6 * * 1'
jobs:
  trivy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build test image
        run: docker build -f Dockerfile.hpu.ubi -t vllm-gaudi:test .
      - name: Run Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'vllm-gaudi:test'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
```

### 2. Add Coverage to CPU Test Workflow (2-3 hours)
```yaml
# Add to cpu-test.yml
- name: Run unit tests with coverage
  run: |
    pip install pytest-cov
    VLLM_USE_FAKE_HPU=1 pytest tests/test_config.py tests/test_sampling_params.py \
      tests/test_sequence.py tests/test_utils.py tests/test_inputs.py \
      tests/tokenization/ tests/core/ \
      --cov=vllm --cov-report=xml --cov-report=term
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage.xml
```

### 3. Add Pre-commit Configuration (1-2 hours)
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.5
    hooks:
      - id: ruff
        args: [--fix]
  - repo: https://github.com/google/yapf
    rev: v0.32.0
    hooks:
      - id: yapf
  - repo: https://github.com/PyCQA/isort
    rev: 5.13.2
    hooks:
      - id: isort
  - repo: https://github.com/codespell-project/codespell
    rev: v2.3.0
    hooks:
      - id: codespell
```

### 4. PR-time Dockerfile Build Validation (3-4 hours)
```yaml
# .github/workflows/image-build.yml
name: Image Build Validation
on:
  pull_request:
    paths:
      - 'Dockerfile*'
      - 'requirements*.txt'
      - 'setup.py'
      - 'pyproject.toml'
      - 'vllm/**'
jobs:
  build-ubi:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build UBI image
        run: docker build -f Dockerfile.hpu.ubi --target vllm-openai -t test:latest .
```

### 5. Create Basic CLAUDE.md (2-3 hours)
Create agent rules documenting test patterns, the Gaudi/HPU-specific testing approach, and how to use `VLLM_USE_FAKE_HPU=1` for local testing without hardware.

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (14 workflows)**:

| Workflow | Trigger | Purpose | PR-blocking |
|----------|---------|---------|-------------|
| `ruff.yml` | PR to habana_main | Python linting (ruff + isort) | Yes |
| `mypy.yaml` | PR to habana_main | Type checking (Python 3.9-3.12) | Yes |
| `yapf.yml` | PR to habana_main | Code formatting | Yes |
| `codespell.yml` | PR to main | Spelling check | Yes |
| `clang-format.yml` | PR to habana_main | C/C++ formatting | Yes |
| `actionlint.yml` | PR to main | GitHub Actions lint | Yes |
| `shellcheck.yml` | PR to main | Shell script lint | Yes |
| `cpu-test.yml` | PR to habana_main | Single smoke test (fake HPU) | Yes |
| `trigger_jenkins.yml` | PR events | External test trigger | Unknown |
| `scorecard.yml` | Weekly + push | OSSF Scorecard | No |
| `stale.yml` | Daily cron | Issue/PR staleness | No |
| `publish.yml` | Tag push | Release packaging | No |
| `add_label_automerge.yml` | PR auto-merge | Label management | No |
| `cleanup_pr_body.yml` | PR open/edit | Description cleanup | No |

**Strengths**:
- Comprehensive linting across Python (ruff, mypy, yapf, isort, codespell) and C++ (clang-format)
- Path-based filtering reduces unnecessary workflow runs
- mypy runs across 4 Python versions (3.9-3.12)
- OSSF Scorecard for supply-chain security assessment

**Weaknesses**:
- Test execution is almost entirely absent from GitHub CI
- No concurrency control on workflows (parallel runs for same PR)
- No caching of pip dependencies (every run installs from scratch)
- CPU test workflow uses outdated actions (v3 instead of v4)
- Branch inconsistency: some workflows target `main`, others `habana_main`

### Test Coverage

**Test Suite Structure**:
- **363 test files** across 50+ directories
- **61,517 lines** of test code
- **Test-to-code ratio**: 0.39 (39 lines of tests per 100 lines of source)
- **Framework**: pytest with pytest-asyncio, pytest-forked, pytest-rerunfailures, pytest-shard
- **Mocking**: 60 files use `unittest.mock` (MagicMock, patch)

**Test Categories** (inherited from upstream vLLM):
- `tests/models/` — Model correctness (decoder-only, encoder-decoder, embedding, vision-language)
- `tests/samplers/` — Sampling algorithms (beam search, rejection, logprobs)
- `tests/spec_decode/` — Speculative decoding with e2e subdirectory
- `tests/entrypoints/` — API endpoint testing (OpenAI-compatible)
- `tests/tokenization/` — Tokenizer functionality
- `tests/quantization/` — FP8, BitsAndBytes, compressed tensors
- `tests/distributed/` — Multi-GPU/distributed execution
- `tests/kernels/` — Custom kernel testing
- `tests/lora/` — LoRA adapter testing
- `tests/core/` — Core scheduler and block management
- `tests/worker/` — Worker and model runner

**What Actually Runs in CI**: Only `examples/offline_inference_fakehpu.py` via the `cpu-test.yml` workflow — a single example script, not the test suite.

### Code Quality

**Linting (Strong)**:
- **Ruff**: Configured in `pyproject.toml` with E, F, UP, B, SIM, G rules
- **mypy**: Strict type checking (`check_untyped_defs = true`, `follow_imports = "silent"`)
- **yapf**: Python code formatting
- **isort**: Import sorting
- **codespell**: Spelling checks with custom ignore list
- **clang-format**: C/C++ formatting for CUDA/kernel code
- **actionlint**: GitHub Actions workflow linting
- **shellcheck**: Shell script linting

**Weaknesses**:
- No pre-commit hooks — all linting is CI-only
- No SAST/CodeQL beyond OSSF Scorecard
- No secret detection (gitleaks, trufflehog)

### Container Images

**Dockerfile Inventory (10 files)**:

| File | Purpose | Base Image |
|------|---------|------------|
| `Dockerfile.hpu` | Dev/test Gaudi image | `vault.habana.ai/.../pytorch-installer-2.5.1:latest` |
| `Dockerfile.hpu.ubi` | **Production RHOAI image** | `vault.habana.ai/.../rhel9.4/.../pytorch-installer-2.5.1` |
| `Dockerfile` | CUDA/GPU (upstream) | Ubuntu + CUDA |
| `Dockerfile.cpu` | CPU-only | Ubuntu |
| `Dockerfile.rocm` | AMD GPU | ROCm base |
| `Dockerfile.tpu` | Google TPU | TPU base |
| `Dockerfile.neuron` | AWS Inferentia | Neuron base |
| `Dockerfile.openvino` | Intel OpenVINO | Ubuntu |
| `Dockerfile.xpu` | Intel GPU (non-Gaudi) | Ubuntu + IPEX |
| `Dockerfile.ppc64le` | IBM Power | PPC64LE |

**Dockerfile.hpu.ubi (Production Image) Analysis**:
- Multi-stage build (4 stages: habana-base → python-install → build → vllm-openai)
- UBI/RHEL 9.4 base for enterprise compliance
- Build caching with `--mount=type=cache`
- Non-root user (UID 2000, GID 0) for OpenShift compatibility
- Includes grpc-adapter variant with `vllm-tgis-adapter`
- License file copied to `/licenses/`
- `.dockerignore` present and comprehensive

**Weaknesses**:
- No multi-architecture builds
- No image signing or attestation
- No SBOM generation
- No runtime health check (`HEALTHCHECK`) in any Dockerfile
- No container scanning in CI
- None of these images are built on PRs

### Security

**Present**:
- OSSF Scorecard with CodeQL SARIF upload (weekly)
- SECURITY.md with vulnerability reporting instructions
- `.dockerignore` prevents secrets from entering image context
- Pinned action SHAs in most workflows (but not all — `cpu-test.yml` uses `@v3`)

**Missing**:
- No container image scanning (Trivy, Snyk, Grype)
- No dependency scanning (Dependabot, Renovate)
- No secret detection (Gitleaks, TruffleHog)
- No SAST beyond Scorecard
- No image signing or provenance attestation
- Inconsistent action pinning (`cpu-test.yml` uses `@v3` unpinned)

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: Complete absence of AI agent guidance
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - HPU/Gaudi-specific test patterns
  - Using `VLLM_USE_FAKE_HPU=1` for local testing
  - pytest fixture patterns from `conftest.py`
  - Model test markers (`core_model`, `cpu_model`, `quant_model`, `distributed_2_gpus`)
  - Integration test patterns for OpenAI-compatible API

## Recommendations

### Priority 0 (Critical)

1. **Expand CPU test workflow to run actual pytest suite**
   - Run a curated subset of tests that work without HPU hardware using `VLLM_USE_FAKE_HPU=1`
   - Prioritize: `tests/test_config.py`, `tests/test_sampling_params.py`, `tests/tokenization/`, `tests/core/`, `tests/samplers/`
   - Add coverage collection with `pytest-cov`

2. **Add coverage tracking with codecov**
   - Configure `.coveragerc` or `[tool.coverage]` in `pyproject.toml`
   - Set minimum coverage threshold (start at current baseline, increase over time)
   - Add PR coverage reporting via codecov

3. **Add container image build validation on PRs**
   - Build `Dockerfile.hpu.ubi` on every PR that touches source code, Dockerfiles, or requirements
   - Validate the image starts without error (even without HPU hardware, verify Python imports work)

4. **Add vulnerability scanning**
   - Trivy for container images + filesystem scanning
   - Block PRs with CRITICAL or HIGH vulnerabilities
   - Weekly scheduled scans for newly disclosed CVEs

### Priority 1 (High Value)

5. **Surface Jenkins test results into GitHub**
   - Post Jenkins test results back to GitHub using the Checks API or commit status
   - Publish test artifact summaries as PR comments
   - Make Jenkins results a required check for merge

6. **Add pre-commit hooks**
   - Bundle existing lint tools (ruff, yapf, mypy, isort, codespell) into `.pre-commit-config.yaml`
   - Reduces CI failures from formatting issues

7. **Add secret detection**
   - Configure Gitleaks in CI to prevent accidental secret commits
   - Important given the Habana vault credentials and webhook URLs in use

8. **Create agent rules for test automation**
   - Add `.claude/rules/` with test creation guidelines
   - Document Gaudi-specific testing patterns
   - Include fixture usage, marker conventions, and mock patterns

### Priority 2 (Nice-to-Have)

9. **Add SBOM generation for container images**
   - Generate SBOM with Syft during image build
   - Publish alongside release artifacts

10. **Add Dependabot or Renovate**
    - Automate dependency updates for pip packages
    - Monitor for security patches in the 100+ dependencies

11. **Add performance regression benchmarks**
    - Track inference latency and throughput across PRs
    - Use `benchmarks/` directory (already exists) in CI

12. **Pin all GitHub Actions to SHA**
    - `cpu-test.yml` still uses `@v3` (unpinned) — should use commit SHAs

## Comparison to Gold Standards

| Dimension | vllm-gaudi | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | 5.5 — Suite exists, doesn't run | 9 — Comprehensive Jest | 7 — Notebook validation | 8 — Go testing |
| Integration/E2E | 3.0 — Jenkins black box | 9 — Cypress + contract | 8 — Multi-layer | 9 — envtest + Kind |
| Build Integration | 2.5 — No PR image builds | 7 — Module Federation | 8 — Multi-arch | 7 — Operator bundle |
| Image Testing | 3.0 — 10 Dockerfiles, none tested | 7 — Build + smoke | 9 — 5-layer validation | 7 — Image smoke |
| Coverage Tracking | 0.5 — None | 8 — Codecov enforced | 6 — Basic tracking | 8 — Coverage gates |
| CI/CD Automation | 5.0 — Lint-only pipeline | 9 — Comprehensive | 8 — Matrix builds | 9 — Multi-version |
| Agent Rules | 0.0 — None | 8 — Comprehensive rules | 3 — Minimal | 2 — None |

## File Paths Reference

### CI/CD Workflows
- `.github/workflows/ruff.yml` — Python linting
- `.github/workflows/mypy.yaml` — Type checking
- `.github/workflows/yapf.yml` — Formatting
- `.github/workflows/cpu-test.yml` — Smoke test (single example)
- `.github/workflows/trigger_jenkins.yml` — External test trigger
- `.github/workflows/scorecard.yml` — OSSF Scorecard
- `.github/workflows/codespell.yml` — Spelling
- `.github/workflows/clang-format.yml` — C++ formatting
- `.github/workflows/actionlint.yml` — Workflow linting
- `.github/workflows/shellcheck.yml` — Shell linting

### Testing
- `tests/` — 363 Python test files (pytest)
- `tests/conftest.py` — Root test configuration
- `pyproject.toml` — pytest markers and tool config

### Container Images
- `Dockerfile.hpu` — Gaudi development image
- `Dockerfile.hpu.ubi` — **Production RHOAI UBI image** (most critical)
- `Dockerfile` — CUDA reference image

### Code Quality
- `pyproject.toml` — ruff, mypy, codespell, isort, pytest config
- `requirements-lint.txt` — yapf, ruff, codespell, isort, clang-format, mypy
- `requirements-test.txt` — pytest + test dependencies
- `format.sh` — Manual formatting script

### Security
- `SECURITY.md` — Vulnerability reporting
- `OWNERS.txt` — Approvers and reviewers
