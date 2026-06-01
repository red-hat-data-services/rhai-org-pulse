---
repository: "red-hat-data-services/vllm-gaudi"
overall_score: 5.2
scorecard:
  - dimension: "Unit Tests"
    score: 6.5
    status: "Good pytest-based unit test suite (141 test functions) covering ops, bucketing, KV offload, multimodal, and worker modules, but no coverage measurement or enforcement"
  - dimension: "Integration/E2E"
    score: 6.0
    status: "Comprehensive E2E discoverable test suite with 40+ model load/generate tests and LM-eval accuracy validation via Jenkins, but requires Gaudi hardware and runs externally"
  - dimension: "Build Integration"
    score: 5.0
    status: "Konflux/Tekton PR pipeline builds container images on PR via label/comment trigger, but no PR-time unit test execution or image startup validation"
  - dimension: "Image Testing"
    score: 4.0
    status: "Multi-stage Dockerfiles (Konflux + HPU UBI) with proper layering but no runtime validation, startup testing, or image functional tests in CI"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage configuration, no codecov/coveralls integration, no coverage thresholds or PR reporting"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "Tekton/Konflux for builds, Jenkins for HW tests, Renovate for deps, but no GitHub Actions workflows; PR testing requires manual label/comment triggers"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no AGENTS.md — zero AI agent guidance for test creation or development"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Cannot measure test coverage, no way to detect coverage regressions on PRs, unmeasured quality"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No automated PR-time test execution"
    impact: "Unit tests do not run automatically on PRs; test failures discovered only post-merge or in Jenkins CI"
    severity: "HIGH"
    effort: "6-8 hours"
  - title: "No security scanning in CI"
    impact: "No Trivy, Snyk, CodeQL, or SAST integration; container vulnerabilities and code issues not caught before merge"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container image runtime validation"
    impact: "Image startup failures and runtime issues not caught until deployment on Gaudi hardware"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents (Claude, Copilot) have no guidance for creating tests, following project conventions, or maintaining quality"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add GitHub Actions workflow to run unit tests on PR"
    effort: "3-4 hours"
    impact: "Catch unit test regressions before merge; most unit tests (bucketing, flags, embedding, utils, prefix caching) don't require Gaudi hardware"
  - title: "Add pytest-cov and codecov integration"
    effort: "2-3 hours"
    impact: "Measure and track test coverage, set minimum thresholds, get PR coverage reports"
  - title: "Add Trivy container scanning to Tekton pipeline"
    effort: "2-3 hours"
    impact: "Catch CVEs in container images before they reach production"
  - title: "Create basic CLAUDE.md with testing guidelines"
    effort: "2-3 hours"
    impact: "Guide AI agents to create consistent, quality tests matching project patterns"
  - title: "Add ruff and mypy checks to a GitHub Actions PR workflow"
    effort: "1-2 hours"
    impact: "Enforce code quality on every PR automatically (pre-commit already configured but not enforced in CI)"
recommendations:
  priority_0:
    - "Add a GitHub Actions workflow to run unit tests (non-hardware-dependent) on every PR"
    - "Integrate pytest-cov with codecov for coverage tracking and set a minimum threshold (e.g., 60%)"
    - "Add container security scanning (Trivy or Clair) to the Tekton PR pipeline"
  priority_1:
    - "Create a PR-time linting workflow running ruff, mypy, and shellcheck (already in pre-commit config)"
    - "Add image startup validation test that verifies the vLLM entrypoint responds to health checks"
    - "Create CLAUDE.md and .claude/rules/ with test creation guidelines"
    - "Add SAST scanning (CodeQL or Semgrep) for Python security analysis"
  priority_2:
    - "Split hardware-dependent vs hardware-independent tests with pytest markers for selective CI execution"
    - "Add performance regression tracking for benchmark results across commits"
    - "Create contract tests for the OpenAI-compatible API interface"
    - "Add SBOM generation to the Konflux build pipeline"
---

# Quality Analysis: vllm-gaudi

## Executive Summary

- **Overall Score: 5.2/10**
- **Repository Type**: Python plugin for vLLM inference engine, Intel Gaudi (Habana) hardware accelerator
- **Primary Language**: Python (26,032 LOC in source, ~8,500 LOC in tests)
- **Key Strengths**: Well-structured unit test suite with pytest, comprehensive E2E model validation covering 40+ model configurations, strong pre-commit hook setup, multi-stage Dockerfiles with Konflux integration
- **Critical Gaps**: No coverage tracking, no automated PR-time test execution, no security scanning, no agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, no .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.5/10 | 141 test functions across ops, bucketing, models, KV offload |
| Integration/E2E | 6.0/10 | Extensive Jenkins-based E2E with LM-eval accuracy validation |
| **Build Integration** | **5.0/10** | **Konflux/Tekton builds on PR, but no test execution** |
| Image Testing | 4.0/10 | Multi-stage Dockerfiles but no runtime validation |
| Coverage Tracking | 1.0/10 | No coverage config, no thresholds, no PR reporting |
| CI/CD Automation | 5.0/10 | Tekton + Jenkins + Renovate, but no GitHub Actions for testing |
| Agent Rules | 0.0/10 | No AI agent guidance whatsoever |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: Cannot measure test quality, no regression detection
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No `.codecov.yml`, no `.coveragerc`, no `pytest-cov` in any requirements file. Coverage is completely unmeasured. With 141 test functions across 26,032 LOC of source code, actual coverage percentage is unknown.

### 2. No Automated PR-Time Test Execution
- **Impact**: Test failures discovered only post-merge or in hardware-specific Jenkins CI
- **Severity**: HIGH
- **Effort**: 6-8 hours
- **Details**: The repository has zero GitHub Actions workflows. The only CI is Tekton/Konflux (container builds on label/comment trigger) and Jenkins (hardware-specific tests). Many unit tests (bucketing, flags, embedding, prefix caching, defragmentation) do not require Gaudi hardware and could run on standard CI runners.

### 3. No Security Scanning in CI
- **Impact**: Container vulnerabilities, dependency issues, and code security flaws not detected before merge
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No Trivy, Snyk, CodeQL, Semgrep, Gitleaks, or any SAST/DAST tool configured. The Tekton pipeline runs `clair-scan` and `ecosystem-cert-preflight-checks` but these are post-build and only triggered on label/comment, not automatically on every PR.

### 4. No Container Image Runtime Validation
- **Impact**: Image startup failures not caught until deployment on Gaudi hardware
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Details**: The Dockerfiles define `ENTRYPOINT ["python3", "-m", "vllm.entrypoints.openai.api_server"]` but there is no CI step that validates the image can start, respond to health checks, or serve basic requests. The `docker-compose.yml` includes a healthcheck definition, but it's not used in CI.

### 5. No Agent Rules for AI-Assisted Development
- **Impact**: AI code assistants cannot follow project testing conventions
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: No `CLAUDE.md`, no `.claude/` directory, no `AGENTS.md`. AI agents have no guidance on test patterns, framework usage (pytest with HPU fixtures), naming conventions, or test organization.

## Quick Wins

### 1. Add GitHub Actions Workflow for Unit Tests (3-4 hours)
- Many unit tests are hardware-independent and can run on standard CI
- Tests like `test_bucketing.py`, `test_flags.py`, `test_embedding.py`, `test_prefix_caching.py`, `test_defragmentation.py` use mocks or CPU-only logic
- **Implementation**:
```yaml
# .github/workflows/unit-tests.yml
name: Unit Tests
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install -e ".[test]" pytest pytest-cov
      - run: pytest tests/unit_tests/ -m "not requires_hpu" --cov=vllm_gaudi --cov-report=xml
      - uses: codecov/codecov-action@v4
```

### 2. Add pytest-cov and Codecov Integration (2-3 hours)
- Add `pytest-cov` to test requirements
- Create `.codecov.yml` with minimum coverage thresholds
- Enable PR coverage reporting

### 3. Add Trivy Scanning (2-3 hours)
- The Tekton pipeline already runs Clair scan, but only on label trigger
- Add Trivy as an always-on scan in the Tekton pipeline or as a GitHub Action
- Set severity threshold to block on CRITICAL/HIGH

### 4. Create Basic CLAUDE.md (2-3 hours)
- Document test patterns (pytest with HPU fixtures, monkeypatch for env vars)
- Document naming conventions (`test_hpu_*.py` for HPU-specific tests)
- Reference the conftest.py fixtures (`dist_init`, `default_vllm_config`, `llama32_lora_files`)

### 5. Add Ruff/Mypy CI Checks (1-2 hours)
- Pre-commit config already has ruff, mypy, shellcheck, yapf
- Add a GitHub Actions workflow that runs `pre-commit run --all-files`
- Ensures code quality enforcement on every PR

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory**:
- **Tekton/Konflux** (`.tekton/vllm-gaudi-pull-request.yaml`): Builds container image on PR via label (`kfbuild-all`, `kfbuild-vllm-gaudi`) or comment (`/build-konflux`). Uses `Dockerfile.konflux.gaudi`. Includes cancel-in-progress. Runs Clair scan and ecosystem cert checks.
- **Jenkins** (`.jenkins/test_config.yaml`): Defines smoke_tests and full_test_suite stages. Tests model inference accuracy on Gaudi G2 and G3 hardware with various tensor parallel sizes and quantization configurations. Not triggered from GitHub PRs — separate CI system.
- **Renovate** (`.github/renovate.json`): Configured via shared config from `konflux-central` for dependency updates.
- **No GitHub Actions**: Zero `.github/workflows/*.yml` files.

**Strengths**:
- Konflux build pipeline is well-configured with build-args externalization
- Tekton pipeline synced from central config (`konflux-central`) — good standardization
- Jenkins test suite covers multi-hardware (G2, G3) with various TP sizes and quantization methods

**Gaps**:
- No automated test execution on PRs — builds only, not tests
- No linting or formatting enforcement in CI (only via optional pre-commit)
- No GitHub Actions workflows at all

### Test Coverage

**Unit Tests (28 test files, 141 test functions)**:
- **Framework**: pytest with HPU-specific fixtures
- **Coverage areas**:
  - Operations: FP8 linear, compressed tensors, AWQ, GPTQ, rotary embedding, layer norm, fused MoE, custom op registration (8 test files)
  - Core: bucketing, prefix caching, defragmentation, embedding, flags, utils (6 test files)
  - Multimodal: HPU multimodal processing and inputs (2 test files)
  - KV Offload: CPU offloading, offloading connector (2 test files)
  - LoRA: Multi-LoRA and Llama TP (2 test files)
  - Worker: HPU model runner, input batch (2 test files)
  - Sampler: HPU sampler (1 test file)
- **Test-to-code ratio**: ~0.33 (8,180 test LOC / 26,032 source LOC) — below ideal (0.5-1.0)

**Integration/E2E Tests**:
- **E2E discoverable tests** (`ci_e2e_discoverable_tests.sh`): 40+ test functions covering model loading, generation, quantization (INC, AWQ, GPTQ, FP8), tensor parallelism, speculative decoding, multimodal models, structured outputs, embedding, sleep mode, PD disaggregation
- **Model accuracy tests**: pytest-based tests using LM-eval harness with GSM8K benchmark and score thresholds via YAML model cards
- **Jenkins LM-eval**: Multi-model accuracy testing on G2/G3 hardware with configurable TP sizes and FP8 variants
- **Performance tests** (`ci_perf_tests.sh`): Throughput benchmarking with ShareGPT dataset
- **Calibration tests** (`ci_calibration_smoke_tests.sh`): INC calibration pipeline validation

**CD Tests** (`.cd/tests/`):
- 3 test files for vLLM autocalculation rules (369 LOC)
- Tests for autocalc configuration and max_num_seqs rules

**Coverage Tracking**:
- ❌ No `.codecov.yml` or `.coveragerc`
- ❌ No `pytest-cov` in requirements
- ❌ No coverage thresholds
- ❌ No PR coverage reporting

### Code Quality

**Linting Configuration**:
- **Ruff**: Configured in `pyproject.toml` with E, F, UP, B, SIM, G rule sets. Line length 120. Extension directory excluded.
- **Yapf**: Configured with column_limit=120
- **Mypy**: Configured with pydantic plugin, `ignore_missing_imports=true`, `check_untyped_defs=true`. Currently only checks `vllm_gaudi/*.py`.
- **Codespell**: Configured with ignore words list
- **Isort**: Configured but commented out in pre-commit

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- ✅ yapf (code formatting)
- ✅ ruff (linting + fix) + ruff-format (for buildkite/benchmarks/examples)
- ✅ pymarkdown (markdown linting)
- ✅ actionlint (GitHub Actions linting)
- ✅ shellcheck (shell script linting)
- ✅ png-lint (Excalidraw PNG validation)
- ✅ mypy (type checking, multiple Python versions, manual stage)
- ✅ pip-compile (requirements pinning)
- ✅ signoff-commit (commit signing enforcement)
- ✅ check-filenames (no spaces in filenames)
- **However**: These run only locally or via `manual` stage — not enforced in CI

**Static Analysis**:
- ❌ No CodeQL/Semgrep/gosec
- ❌ No dependency vulnerability scanning
- ❌ No secret detection (Gitleaks/TruffleHog)

### Container Images

**Dockerfiles**:
1. `Dockerfile.konflux.gaudi` — Production RHEL 9.6 UBI image for Konflux builds. 3-stage build (gaudi-base → gaudi-pytorch → vllm-openai). Well-structured with:
   - SPDX license headers
   - RHEL certification labels
   - Non-root user (UID 2000) for OpenShift compatibility
   - Proper license copying
   - Version pinning via build args

2. `Dockerfile.hpu.ubi` — Identical to Konflux Dockerfile (same content)

3. `.cd/Dockerfile.rhel.ubi.vllm` — CD environment Dockerfile
4. `.cd/Dockerfile.ubuntu.pytorch.vllm` — Ubuntu-based dev/test image
5. `.cd/Dockerfile.ubuntu.pytorch.vllm.nixl.latest` — Ubuntu with NIXL support
6. `tests/pytorch_ci_hud_benchmark/Dockerfile.hpu` — Benchmark testing image

**Strengths**:
- Multi-stage builds with clear stage separation
- UBI base images for RHEL compatibility
- Non-root user for security
- Build args for version flexibility
- `pip check` at end of install for dependency validation

**Gaps**:
- ❌ No image startup validation in CI
- ❌ No runtime functional testing
- ❌ No multi-architecture support (x86_64 only)
- ❌ No SBOM generation
- ❌ No image signing/attestation

### Security

- ❌ No dedicated security scanning tools configured
- ❌ No SAST (CodeQL, Semgrep, Bandit)
- ❌ No container scanning (Trivy, Snyk) — Clair only via Tekton on label trigger
- ❌ No dependency scanning (Dependabot, Snyk)
- ❌ No secret detection
- ✅ Renovate configured for dependency updates (partial mitigation)
- ✅ Non-root container user
- ✅ SPDX license headers

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**:
  - No test creation rules for any test type
  - No project-specific development guidelines for AI agents
  - No documentation of the pytest fixture patterns (`dist_init`, `default_vllm_config`)
  - No guidance on hardware-dependent vs hardware-independent test classification
  - No examples of the model card YAML format for E2E tests
- **Recommendation**: Generate missing rules with `/test-rules-generator`

## Recommendations

### Priority 0 (Critical)

1. **Add GitHub Actions PR workflow for unit tests**
   - Separate hardware-dependent from hardware-independent tests using pytest markers
   - Run hardware-independent tests on every PR
   - Estimated effort: 6-8 hours

2. **Implement coverage tracking with codecov**
   - Add `pytest-cov` to test dependencies
   - Create `.codecov.yml` with patch and project thresholds
   - Integrate with PR comments
   - Estimated effort: 4-6 hours

3. **Add container security scanning**
   - Add Trivy scanning to Tekton pipeline (always-on, not just label-triggered)
   - Set severity thresholds (fail on CRITICAL)
   - Estimated effort: 4-6 hours

### Priority 1 (High Value)

4. **Enforce linting in CI**
   - Add GitHub Actions workflow running `pre-commit run --all-files`
   - Ensures ruff, mypy, shellcheck, yapf enforcement on every PR
   - Estimated effort: 2-3 hours

5. **Add image startup validation**
   - Test that built container image starts and health check passes
   - Can use docker-compose with `--wait` and the existing healthcheck definition
   - Estimated effort: 8-12 hours

6. **Create CLAUDE.md and agent rules**
   - Document test patterns, fixtures, naming conventions
   - Add rules for unit test, E2E test, and model card creation
   - Estimated effort: 4-6 hours

7. **Add SAST scanning**
   - Add CodeQL or Bandit for Python security analysis
   - Estimated effort: 3-4 hours

### Priority 2 (Nice-to-Have)

8. **Add pytest markers for hardware requirements**
   - `@pytest.mark.requires_hpu` for Gaudi-dependent tests
   - `@pytest.mark.requires_model` for tests needing model downloads
   - Enables selective CI execution
   - Estimated effort: 4-6 hours

9. **Add performance regression tracking**
   - Track benchmark results from `ci_perf_tests.sh` across commits
   - Alert on throughput regressions > 5%
   - Estimated effort: 8-12 hours

10. **Add contract tests for OpenAI API interface**
    - Validate that the vLLM OpenAI-compatible API matches the expected contract
    - Test with lightweight model on CPU
    - Estimated effort: 6-8 hours

11. **Add SBOM generation to Konflux pipeline**
    - Generate Software Bill of Materials for each container build
    - Estimated effort: 2-3 hours

## Comparison to Gold Standards

| Dimension | vllm-gaudi | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | 6.5 - Good pytest suite | 9.0 - Comprehensive Jest | 7.0 - Image testing | 8.5 - Extensive Go tests |
| Integration/E2E | 6.0 - Jenkins-based | 9.0 - Multi-layer | 8.0 - 5-layer validation | 9.0 - Multi-version |
| Build Integration | 5.0 - Konflux builds only | 8.5 - Full PR validation | 7.0 - Image builds | 8.0 - Operator testing |
| Image Testing | 4.0 - No runtime validation | 7.0 - Basic validation | 9.0 - Gold standard | 7.0 - Deployment tests |
| Coverage Tracking | 1.0 - None | 8.5 - Codecov enforced | 6.0 - Partial | 9.0 - Enforced thresholds |
| CI/CD Automation | 5.0 - Tekton + Jenkins | 9.0 - Full GH Actions | 8.0 - Well automated | 9.0 - Multi-cloud CI |
| Agent Rules | 0.0 - None | 8.0 - Comprehensive | 3.0 - Minimal | 4.0 - Basic |
| **Overall** | **5.2** | **8.7** | **7.1** | **8.1** |

## File Paths Reference

### CI/CD Configuration
- `.tekton/vllm-gaudi-pull-request.yaml` — Konflux PR build pipeline
- `.tekton/README.md` — Tekton sync documentation
- `.konflux/build-args.conf` — Build arguments for Konflux
- `.github/renovate.json` — Dependency update configuration
- `.jenkins/test_config.yaml` — Jenkins test suite configuration

### Testing
- `tests/unit_tests/` — Unit test suite (pytest-based)
- `tests/unit_tests/conftest.py` — Shared fixtures (dist_init, default_vllm_config)
- `tests/full_tests/ci_e2e_discoverable_tests.sh` — Comprehensive E2E test runner
- `tests/full_tests/ci_perf_tests.sh` — Performance benchmark tests
- `tests/calibration_tests/ci_calibration_smoke_tests.sh` — Calibration validation
- `tests/upstream_tests/ci_tests.sh` — Upstream compatibility tests
- `tests/models/language/generation/test_common.py` — LM-eval accuracy tests
- `tests/models/language/generation/*.yaml` — Model card configurations
- `.cd/tests/test_vllm_autocalc*.py` — CD autocalculation tests

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks (ruff, yapf, mypy, shellcheck)
- `pyproject.toml` — Ruff, mypy, yapf, codespell, isort configuration
- `requirements-lint.txt` — Lint dependencies (pre-commit)

### Container Images
- `Dockerfile.konflux.gaudi` — Production RHEL 9.6 UBI image
- `Dockerfile.hpu.ubi` — HPU UBI image
- `.cd/Dockerfile.rhel.ubi.vllm` — CD RHEL image
- `.cd/docker-compose.yml` — Docker Compose for server + benchmark

### Source Code
- `vllm_gaudi/` — Main plugin package (96 Python files, 26,032 LOC)
