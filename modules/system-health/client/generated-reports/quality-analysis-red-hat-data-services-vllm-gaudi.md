---
repository: "red-hat-data-services/vllm-gaudi"
overall_score: 4.8
scorecard:
  - dimension: "Unit Tests"
    score: 5.5
    status: "28 test files with 141 test functions covering ops, bucketing, embedding, worker, and sampler; decent HPU-specific coverage but no pytest markers, parametrization is limited, and coverage tracking is absent"
  - dimension: "Integration/E2E"
    score: 5.0
    status: "Jenkins-driven E2E with lm-eval-harness correctness checks across multiple models and TP configurations; full_tests cover model loading and generation; requires Gaudi hardware so not runnable in PR CI"
  - dimension: "Build Integration"
    score: 3.5
    status: "Konflux builds triggered by label/comment only, not automatic on PR; no PR-time image validation or startup testing; Tekton pipeline is build-only with no test stage"
  - dimension: "Image Testing"
    score: 3.0
    status: "6 Dockerfiles across Konflux, UBI, Ubuntu, and benchmark variants; multi-stage builds with proper UBI base; no image startup validation, no runtime smoke tests, no multi-arch support"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tooling whatsoever — no .coveragerc, no codecov.yml, no pytest-cov configuration, no coverage thresholds or PR reporting"
  - dimension: "CI/CD Automation"
    score: 4.0
    status: "Jenkins for correctness/benchmark testing on Gaudi hardware; Tekton/Konflux for container builds; no GitHub Actions workflows; Renovate for dependency updates; no automated PR-triggered test suite"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no AGENTS.md, no .claude/ directory — zero AI agent guidance for test creation or development standards"
critical_gaps:
  - title: "No test coverage tracking or enforcement"
    impact: "Impossible to measure test quality, detect coverage regressions, or enforce minimum thresholds"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No automated PR-triggered test suite"
    impact: "Unit tests never run automatically on PRs — regressions can merge undetected"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No container image runtime validation"
    impact: "Image startup failures, import errors, and entrypoint issues not caught until deployment"
    severity: "HIGH"
    effort: "6-8 hours"
  - title: "No security scanning (Trivy, Snyk, CodeQL, Bandit)"
    impact: "Vulnerabilities in dependencies and code not detected before merge or release"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Konflux builds are opt-in via label/comment, not automatic"
    impact: "Build failures discovered late; inconsistent validation across PRs"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add GitHub Actions workflow to run pytest unit tests on PRs"
    effort: "2-4 hours"
    impact: "Catch unit-level regressions before merge; unit tests don't require Gaudi hardware"
  - title: "Add pytest-cov and codecov integration"
    effort: "2-3 hours"
    impact: "Establish coverage baseline and trend tracking with PR comments"
  - title: "Add Trivy container scanning to Tekton pipeline"
    effort: "1-2 hours"
    impact: "Detect known CVEs in container images before they reach production"
  - title: "Create CLAUDE.md with test creation guidelines"
    effort: "2-3 hours"
    impact: "Enable consistent AI-assisted test development following project conventions"
  - title: "Add Bandit security scanning to pre-commit hooks"
    effort: "1 hour"
    impact: "Catch common Python security issues (SQL injection, shell injection, hardcoded secrets)"
recommendations:
  priority_0:
    - "Add a GitHub Actions workflow that runs `pytest tests/unit_tests/ -v` on every PR — these tests don't require Gaudi hardware"
    - "Integrate pytest-cov and codecov.io to establish a coverage baseline and enforce a minimum threshold (start at 30%, grow to 60%)"
    - "Add Trivy or Clair vulnerability scanning for all Dockerfiles in the CI pipeline"
  priority_1:
    - "Make Konflux PR builds automatic (remove label/comment gate) so every PR validates the container build"
    - "Add container image startup validation — build image, run `python -c 'import vllm_gaudi'` and verify entrypoint responds to health check"
    - "Create comprehensive agent rules (.claude/rules/) for unit test patterns, HPU-specific testing, and model test conventions"
    - "Add Bandit and/or Semgrep to the pre-commit config for Python SAST"
  priority_2:
    - "Add multi-architecture (amd64/arm64) build support for broader compatibility"
    - "Implement benchmark regression testing — compare throughput/latency against baseline on each release"
    - "Add contract tests for the vLLM plugin API boundary (vllm_gaudi ↔ vllm core)"
    - "Create integration test fixtures that mock Gaudi hardware for CI environments without HPU access"
---

# Quality Analysis: vllm-gaudi

## Executive Summary

- **Overall Score: 4.8/10**
- **Repository Type**: Python plugin package (vLLM hardware plugin for Intel Gaudi/Habana HPU)
- **Primary Language**: Python 3.10-3.12
- **Key Strengths**: Solid pre-commit hook setup (yapf, ruff, mypy, shellcheck), reasonable unit test structure for HPU-specific operations, comprehensive Jenkins-based correctness testing with lm-eval-harness across multiple model configurations
- **Critical Gaps**: Zero coverage tracking, no automated PR-triggered test execution, no security scanning, no container runtime validation, no AI agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 5.5/10 | 28 test files, 141 test functions — decent HPU ops coverage but no coverage tracking |
| Integration/E2E | 5.0/10 | Jenkins lm-eval-harness tests + E2E model loading scripts; hardware-dependent |
| **Build Integration** | **3.5/10** | **Konflux build opt-in only (label/comment); no PR-time image validation** |
| Image Testing | 3.0/10 | 6 Dockerfiles, multi-stage builds, but no runtime validation or multi-arch |
| Coverage Tracking | 1.0/10 | No coverage tooling at all — no pytest-cov, no codecov, no thresholds |
| CI/CD Automation | 4.0/10 | Jenkins + Tekton/Konflux but no GitHub Actions; no PR-triggered tests |
| Agent Rules | 0.0/10 | No CLAUDE.md, no .claude/ directory, no test creation guidance |

## Critical Gaps

### 1. No Test Coverage Tracking or Enforcement
- **Impact**: Cannot measure test quality, detect coverage regressions, or enforce standards
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No `.coveragerc`, no `codecov.yml`, no `pytest-cov` in dependencies. The 141 test functions exist but their actual code coverage is unknown. Without tracking, there's no way to prevent coverage from degrading as the codebase grows (26K+ lines of source code).

### 2. No Automated PR-Triggered Test Suite
- **Impact**: Unit test regressions can merge undetected into main
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: No `.github/workflows/` directory exists. The unit tests under `tests/unit_tests/` (bucketing, ops, embedding, prefix caching, etc.) don't require Gaudi hardware and could run on standard CI runners, but there's no workflow to trigger them. Jenkins tests require Gaudi hardware and run separately.

### 3. No Container Image Runtime Validation
- **Impact**: Image startup failures, import errors, missing dependencies not caught until deployment
- **Severity**: HIGH
- **Effort**: 6-8 hours
- **Details**: Six Dockerfiles exist (`Dockerfile.konflux.gaudi`, `Dockerfile.hpu.ubi`, three `.cd/` variants, one benchmark) but none are tested for runtime correctness in CI. The Tekton pipeline only builds the image — it doesn't verify the entrypoint works.

### 4. No Security Scanning
- **Impact**: Vulnerabilities in Python dependencies and container images go undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Trivy, Snyk, CodeQL, Bandit, Semgrep, or Gitleaks configuration. The Tekton pipeline includes `clair-scan` and `ecosystem-cert-preflight-checks` tasks, but these run only on opt-in Konflux builds, not on every PR.

### 5. Konflux Builds Are Opt-In
- **Impact**: Not all PRs get container build validation; build failures discovered late
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: The Tekton pipeline (`.tekton/vllm-gaudi-pull-request.yaml`) triggers on comment `/build-konflux` or labels `kfbuild-all`/`kfbuild-vllm-gaudi`, not automatically on every PR.

## Quick Wins

### 1. Add GitHub Actions Workflow for Unit Tests (2-4 hours)
```yaml
# .github/workflows/unit-tests.yml
name: Unit Tests
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.10", "3.11", "3.12"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
      - run: pip install -e ".[test]" || pip install -e .
      - run: pip install pytest pytest-cov
      - run: pytest tests/unit_tests/ -v --cov=vllm_gaudi --cov-report=xml
      - uses: codecov/codecov-action@v4
```

### 2. Add pytest-cov and Codecov Integration (2-3 hours)
- Add `pytest-cov` to test dependencies
- Create `.codecov.yml` with minimum coverage thresholds
- Add coverage badge to README.md

### 3. Add Trivy Container Scanning (1-2 hours)
- Add a Trivy scan step to the Tekton pipeline
- Or create a GitHub Actions workflow to scan Dockerfiles on PR

### 4. Create CLAUDE.md with Test Guidelines (2-3 hours)
- Document testing conventions (pytest, conftest patterns, HPU fixtures)
- Define test naming standards
- Specify which tests require hardware vs. CPU-only

### 5. Add Bandit to Pre-Commit (1 hour)
```yaml
# Add to .pre-commit-config.yaml
- repo: https://github.com/PyCQA/bandit
  rev: 1.7.9
  hooks:
  - id: bandit
    args: ["-r", "vllm_gaudi/", "-c", "pyproject.toml"]
```

## Detailed Findings

### CI/CD Pipeline

**Jenkins (Hardware-Dependent Testing)**
- `.jenkins/test_config.yaml` defines a 2-stage pipeline:
  - **smoke_tests**: GSM8K evaluation on Gaudi2 (G2) and Gaudi3 (G3) with TP=1 and TP=2
  - **full_test_suite**: Extended model testing including FP8, APC, medium/large/huge models, vision models, and compressed tensors
- `.jenkins/lm-eval-harness/` contains correctness tests that compare vLLM-Gaudi inference accuracy against baselines using the `lm-eval` framework
- `.jenkins/vision/` covers multimodal model testing (Llama 4 Scout)
- `.jenkins/benchmark/` has throughput benchmarking scripts

**Tekton/Konflux (Container Builds)**
- `.tekton/vllm-gaudi-pull-request.yaml` — Konflux pipeline for building the container image
  - Triggered by label (`kfbuild-all`, `kfbuild-vllm-gaudi`) or comment (`/build-konflux`)
  - Uses `Dockerfile.konflux.gaudi` and `multi-arch-container-build.yaml` pipeline
  - Includes `clair-scan` and `ecosystem-cert-preflight-checks`
  - Platform: `linux/x86_64` only
  - Cancel-in-progress enabled

**What's Missing**
- No GitHub Actions workflows at all
- No PR-triggered unit test execution
- No automated linting check in CI (pre-commit hooks exist but aren't enforced in CI)
- No dependency vulnerability scanning workflow

### Test Coverage

**Unit Tests** (`tests/unit_tests/`)
- **28 test files with 141 test functions** across:
  - `ops/`: HPU-specific operations (rotary embedding, layernorm, GPTQ, fused MoE, FP8, AWQ, compressed tensors, custom op registration) — 9 test files
  - `worker/`: HPU model runner, input batch management — 2 test files
  - `sampler/`: HPU sampler — 1 test file
  - `multimodal/`: Multimodal processing and inputs — 2 test files
  - `lora/`: LoRA with multi-LoRA and tensor parallel — 2 test files
  - `kv_offload/`: CPU offloading and offloading connector — 2 test files
  - Root: bucketing, prefix caching, flags, embedding, defragmentation, utils — 6 test files
- Framework: pytest with `conftest.py` providing fixtures (distributed init, LoRA files, default VllmConfig)
- 5,277 lines of unit test code vs. 26,032 lines of source → **test-to-code ratio: 0.20**

**Integration/E2E Tests**
- `tests/full_tests/ci_e2e_discoverable_tests.sh`: Comprehensive E2E script testing model loading and generation for Gemma3, Llama4, DeepSeek, Granite, Qwen3, Mistral, with multimodal, TP, spec decode, pooling, sleep mode, structured outputs, and LoRA
- `tests/full_tests/ci_perf_tests.sh`: Throughput benchmarking with ShareGPT dataset
- `tests/upstream_tests/ci_tests.sh`: Basic upstream compatibility test
- `tests/models/`: Model initialization, registration, and language/multimodal generation tests
- `examples/nixl/`: NIXL accuracy and edge case tests

**CD Tests** (`.cd/tests/`)
- 3 test files for vLLM autocalc rules (automatic resource calculation)

**What's Missing**
- No coverage tracking or reporting
- No pytest markers for test categorization (hardware-required vs. CPU-only)
- No test timeouts configured
- No parallel test execution setup

### Code Quality

**Strong Points**
- **Pre-commit hooks** (`.pre-commit-config.yaml`):
  - `yapf` (v0.43.0) for code formatting
  - `ruff` (v0.11.7) for linting with fix mode — enforces pycodestyle (E), pyflakes (F), pyupgrade (UP), bugbear (B), simplify (SIM), logging (G)
  - `pymarkdown` for markdown linting
  - `actionlint` for GitHub Action validation
  - `shellcheck` for shell script linting
  - `mypy` (v1.11.1) for type checking — configured for Python 3.10, 3.11, 3.12 with pydantic plugin
  - Custom hooks: sign-off commit, filename space check, pip-compile for requirements
- **pyproject.toml** properly configured with ruff rules, mypy settings, codespell, and isort
- **Renovate** configured for automated dependency updates via Konflux central

**What's Missing**
- Pre-commit hooks only run locally; no CI enforcement (no `pre-commit run --all-files` in a workflow)
- No SAST tools (Bandit, Semgrep)
- No secret detection (Gitleaks, TruffleHog)

### Container Images

**Dockerfiles**
1. `Dockerfile.konflux.gaudi` — Production RHEL 9.6 UBI-based image, 3-stage build (gaudi-base → gaudi-pytorch → vllm-openai), OpenShift-compatible (non-root user UID 2000), RHEL certification labels
2. `Dockerfile.hpu.ubi` — Nearly identical to Konflux variant
3. `.cd/Dockerfile.ubuntu.pytorch.vllm` — Ubuntu-based development image
4. `.cd/Dockerfile.ubuntu.pytorch.vllm.nixl.latest` — Ubuntu with NIXL support
5. `.cd/Dockerfile.rhel.ubi.vllm` — Alternative RHEL build
6. `tests/pytorch_ci_hud_benchmark/Dockerfile.hpu` — Benchmark-specific image

**Strengths**
- Multi-stage builds reducing final image size
- Proper RHEL UBI base images for enterprise deployments
- OpenShift compatibility with non-root user
- Version pinning for Synapse, PyTorch, and vLLM commits
- `pip check` at end of install to verify dependency consistency
- License copying for compliance

**What's Missing**
- No image startup validation in CI
- No health check verification (`HEALTHCHECK` directive or API ping)
- No multi-architecture builds (x86_64 only)
- No SBOM generation
- No image signing/attestation

### Security

**Current State**
- Tekton pipeline includes `clair-scan` and `ecosystem-cert-preflight-checks` — but only for opt-in Konflux builds
- No proactive security scanning in the main CI flow

**Missing**
- No CodeQL or Semgrep for SAST
- No Bandit for Python-specific security analysis
- No Trivy for container vulnerability scanning on every PR
- No Gitleaks or TruffleHog for secret detection
- No dependency vulnerability scanning (pip-audit, safety)
- No SBOM generation for supply chain security

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no CLAUDE.md, no AGENTS.md, no `.claude/` directory
- **Quality**: N/A
- **Gaps**:
  - No test creation rules for unit tests, E2E tests, or model tests
  - No coding standards documentation for AI agents
  - No guidance on HPU-specific testing patterns
  - No documentation of pytest fixture conventions
- **Recommendation**: Generate missing rules with `/test-rules-generator` to create `.claude/rules/` covering:
  - Unit test patterns for HPU ops (monkeypatch, conftest fixtures)
  - Model test conventions (model cards, generation scripts)
  - E2E test structure (Jenkins integration, shell scripts)
  - CD test patterns (autocalc rules testing)

## Recommendations

### Priority 0 (Critical)

1. **Add GitHub Actions workflow for PR-triggered unit tests** — The `tests/unit_tests/` suite doesn't require Gaudi hardware and should run on every PR with `pytest` on standard runners (ubuntu-latest). This is the single highest-impact improvement.

2. **Integrate pytest-cov and codecov** — Establish a coverage baseline. Current test-to-code ratio is 0.20 (8K test lines / 26K source lines) but actual line/branch coverage is unknown. Start with a 30% threshold and incrementally raise it.

3. **Add container vulnerability scanning** — Either integrate Trivy into the Tekton pipeline for all PRs (not just opt-in Konflux builds) or add a GitHub Actions workflow with `aquasecurity/trivy-action`.

### Priority 1 (High Value)

4. **Make Konflux builds automatic on PRs** — Change Tekton trigger from label/comment-based to `on-event: [pull_request]` automatic execution to catch container build failures on every PR.

5. **Add container image startup validation** — After building the image, run a smoke test: `docker run --rm <image> python3 -c "import vllm_gaudi; print('OK')"` and optionally test the OpenAI API entrypoint responds to `/health`.

6. **Create agent rules for AI-assisted development** — Generate `.claude/rules/` with test creation guidelines covering unit test patterns (pytest + conftest), model test conventions, and HPU-specific testing guidance.

7. **Add Bandit/Semgrep to pre-commit for Python SAST** — Quick addition to the already-comprehensive pre-commit configuration.

### Priority 2 (Nice-to-Have)

8. **Add multi-architecture build support** — Currently x86_64 only; consider adding arm64 for broader compatibility.

9. **Implement benchmark regression testing** — Compare throughput/latency against baseline on each release using the existing `ci_perf_tests.sh` infrastructure.

10. **Add contract tests for vLLM plugin interface** — Test the boundary between `vllm_gaudi` and upstream `vllm` to catch breaking changes when upgrading the `VLLM_STABLE_COMMIT`.

11. **Create mock HPU fixtures for CI** — Enable unit tests that currently require Gaudi hardware to run on standard CI runners with mocked HPU behavior.

## Comparison to Gold Standards

| Capability | vllm-gaudi | odh-dashboard | notebooks | kserve |
|---|---|---|---|---|
| PR-triggered tests | None | Full (unit+e2e) | Full | Full |
| Coverage tracking | None | Codecov enforced | Present | Coveralls enforced |
| Coverage threshold | None | 80%+ | N/A | Yes |
| Container scanning | Clair (opt-in) | Trivy + Snyk | Trivy | Trivy |
| Image runtime tests | None | Cypress E2E | 5-layer validation | Deployment tests |
| Pre-commit hooks | Comprehensive | Comprehensive | Moderate | Basic |
| Agent rules | None | Comprehensive | Basic | None |
| Multi-arch builds | No | Yes | Yes | Yes |
| Security scanning | None | CodeQL + Snyk | Trivy | CodeQL |
| SBOM generation | None | Yes | Yes | Yes |

## File Paths Reference

### CI/CD
- `.tekton/vllm-gaudi-pull-request.yaml` — Konflux build pipeline
- `.jenkins/test_config.yaml` — Jenkins test stages configuration
- `.jenkins/lm-eval-harness/run-tests.sh` — LM eval correctness test runner
- `.jenkins/vision/run-tests.sh` — Vision model test runner
- `.jenkins/benchmark/run-benchmark.sh` — Benchmark runner
- `.konflux/build-args.conf` — Konflux build arguments
- `.github/renovate.json` — Renovate dependency update config

### Testing
- `tests/unit_tests/` — 28 unit test files (pytest)
- `tests/full_tests/ci_e2e_discoverable_tests.sh` — E2E test runner
- `tests/full_tests/ci_perf_tests.sh` — Performance benchmark runner
- `tests/upstream_tests/ci_tests.sh` — Upstream compatibility tests
- `tests/models/` — Model-specific tests
- `.cd/tests/` — CD/autocalc tests
- `examples/nixl/` — NIXL accuracy/edge case tests

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks (yapf, ruff, mypy, shellcheck, actionlint)
- `pyproject.toml` — Ruff lint config, mypy config, codespell, isort
- `requirements-lint.txt` — Lint dependencies (pre-commit)
- `format.sh` — Redirects to pre-commit

### Container Images
- `Dockerfile.konflux.gaudi` — Production RHEL 9.6 UBI image (3-stage)
- `Dockerfile.hpu.ubi` — RHEL UBI variant
- `.cd/Dockerfile.ubuntu.pytorch.vllm` — Ubuntu development image
- `.cd/Dockerfile.ubuntu.pytorch.vllm.nixl.latest` — Ubuntu with NIXL
- `.cd/Dockerfile.rhel.ubi.vllm` — Alternative RHEL build
- `tests/pytorch_ci_hud_benchmark/Dockerfile.hpu` — Benchmark image

### Source Code
- `vllm_gaudi/` — Main plugin package (96 files, ~26K lines)
- `calibration/` — FP8 calibration tools
- `tools/` — Developer utilities (mypy, shellcheck, profiler)
- `examples/` — Usage examples including NIXL
