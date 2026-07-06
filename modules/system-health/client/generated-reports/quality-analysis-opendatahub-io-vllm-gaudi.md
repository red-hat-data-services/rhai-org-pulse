---
repository: "opendatahub-io/vllm-gaudi"
overall_score: 5.4
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Large pytest suite (363 files, 61K LOC) with comprehensive model/kernel/engine coverage"
  - dimension: "Integration/E2E"
    score: 6.5
    status: "Buildkite pipeline with multi-GPU/multi-node tests, but HPU-specific E2E is minimal"
  - dimension: "Build Integration"
    score: 3.0
    status: "No PR-time Docker build validation; Jenkins triggered via webhook with no visibility"
  - dimension: "Image Testing"
    score: 4.0
    status: "10 Dockerfiles including UBI variant, but no runtime validation or startup testing in CI"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tool integration — no codecov, no --cov flags, no thresholds"
  - dimension: "CI/CD Automation"
    score: 6.5
    status: "GitHub Actions for linting + Buildkite for GPU tests + Jenkins for HPU, but fragmented"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules or test automation guidance"
critical_gaps:
  - title: "No test coverage tracking or enforcement"
    impact: "Impossible to measure test quality or prevent coverage regressions across 155K LOC"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No PR-time container image validation"
    impact: "Dockerfile.hpu and Dockerfile.hpu.ubi build failures discovered only post-merge"
    severity: "HIGH"
    effort: "6-8 hours"
  - title: "No security scanning (Trivy, Snyk, SAST)"
    impact: "Vulnerabilities in base images and dependencies undetected until production"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No secret detection in CI"
    impact: "Secrets or API keys could be committed without automated detection"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "Jenkins tests are opaque — no visibility into what runs"
    impact: "PR reviewers cannot see HPU test results; failures require manual investigation"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "No agent rules for AI-assisted test creation"
    impact: "AI agents cannot generate consistent, framework-aligned tests"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Detect critical CVEs in Gaudi base images before merge"
  - title: "Add Gitleaks secret detection to PR workflow"
    effort: "1 hour"
    impact: "Prevent accidental credential commits in HPU config files"
  - title: "Add pytest-cov with Codecov integration"
    effort: "3-4 hours"
    impact: "Establish baseline coverage metrics and prevent regressions"
  - title: "Add pre-commit hooks configuration"
    effort: "1-2 hours"
    impact: "Catch lint/format issues before they reach CI"
  - title: "Create basic .claude/rules/ for test patterns"
    effort: "2-3 hours"
    impact: "Enable AI agents to generate consistent HPU-aware tests"
recommendations:
  priority_0:
    - "Integrate pytest-cov into CI and establish coverage thresholds for the vllm/ package"
    - "Add Trivy scanning for Dockerfile.hpu and Dockerfile.hpu.ubi base images"
    - "Add Gitleaks or TruffleHog secret detection to PR workflows"
    - "Add PR-time Docker build validation for HPU Dockerfiles"
  priority_1:
    - "Surface Jenkins HPU test results back to GitHub PR checks"
    - "Add Dockerfile.hpu.ubi runtime startup validation (container smoke test)"
    - "Create agent rules (.claude/rules/) for unit, integration, and E2E test patterns"
    - "Add pre-commit hooks with ruff, mypy, and codespell"
  priority_2:
    - "Add SBOM generation for HPU container images"
    - "Implement performance regression testing for inference benchmarks"
    - "Add contract tests for OpenAI API compatibility endpoints"
    - "Consolidate CI across GitHub Actions, Buildkite, and Jenkins"
---

# Quality Analysis: vllm-gaudi

## Executive Summary

- **Overall Score: 5.4/10**
- **Repository Type**: Python ML inference engine (vLLM fork for Intel Gaudi/HPU)
- **Primary Language**: Python (155K LOC source, 61K LOC tests)
- **Framework**: PyTorch + Habana Labs HPU runtime
- **Key Strengths**: Comprehensive test suite inherited from upstream vLLM, strong linting pipeline (ruff, mypy, yapf, clang-format, codespell, shellcheck, actionlint), well-structured Buildkite multi-GPU test pipeline
- **Critical Gaps**: Zero coverage tracking, no container security scanning, no PR-time image build validation, opaque Jenkins HPU tests, no agent rules
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.0/10 | Large pytest suite with 363 test files covering models, kernels, engine, distributed |
| Integration/E2E | 6.5/10 | Buildkite has multi-GPU/node tests; HPU-specific E2E is limited to single smoke test |
| **Build Integration** | **3.0/10** | **No PR-time Docker build; Jenkins webhook is fire-and-forget with no status reporting** |
| Image Testing | 4.0/10 | 10 Dockerfiles (including UBI) but no runtime validation or startup testing |
| Coverage Tracking | 1.0/10 | No codecov, no --cov flags, no coverage thresholds — complete blind spot |
| CI/CD Automation | 6.5/10 | 14 GHA workflows for lint + Buildkite for GPU + Jenkins for HPU, but fragmented |
| Agent Rules | 0.0/10 | No CLAUDE.md, no .claude/ directory, no test automation guidance |

## Critical Gaps

### 1. No Test Coverage Tracking or Enforcement
- **Impact**: With 155K lines of source code and 363 test files, there is no way to know what percentage of code is tested. Coverage regressions go undetected.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No `.codecov.yml`, no `--cov` flags in any CI configuration, no coverage reports generated anywhere. The `requirements-test.txt` doesn't include `pytest-cov`.

### 2. No PR-Time Container Image Validation
- **Impact**: The repository maintains 10 Dockerfiles including the production `Dockerfile.hpu.ubi` (124 lines, multi-stage build), but none are built or validated during PR checks. Build failures are only discovered post-merge or in external systems.
- **Severity**: HIGH
- **Effort**: 6-8 hours
- **Details**: `Dockerfile.hpu.ubi` is a sophisticated multi-stage UBI-based build with vLLM wheel compilation, Habana runtime integration, and gRPC adapter — any of these stages can fail silently.

### 3. No Security Scanning
- **Impact**: Base images (`vault.habana.ai/gaudi-docker/...`) and Python dependencies are not scanned for vulnerabilities. The only security-related workflow is OSSF Scorecard (supply chain, not vulnerability scanning).
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Trivy, Snyk, Grype, CodeQL, or any SAST tool. No `.trivyignore`, no vulnerability thresholds.

### 4. No Secret Detection
- **Impact**: No automated detection of accidentally committed secrets, API keys, or credentials.
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: No Gitleaks, TruffleHog, or any secret scanning tool configured.

### 5. Opaque Jenkins HPU Test Pipeline
- **Impact**: The `trigger_jenkins.yml` workflow fires a webhook on every PR event but provides no status feedback to GitHub. Reviewers cannot see HPU test results without accessing Jenkins directly.
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Details**: The Jenkins integration is a single `curl -XPOST` with no status checks, no result reporting, and no failure notifications.

### 6. No Agent Rules for AI-Assisted Development
- **Impact**: AI coding assistants cannot generate tests that follow project conventions (pytest markers, HPU-specific fixtures, fake HPU setup).
- **Severity**: MEDIUM
- **Effort**: 2-4 hours

## Quick Wins

### 1. Add Trivy Container Scanning (1-2 hours)
```yaml
# .github/workflows/trivy.yml
name: Container Security Scan
on:
  pull_request:
    paths:
      - 'Dockerfile*'
      - 'requirements-*.txt'
jobs:
  trivy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build HPU image
        run: docker build -f Dockerfile.hpu -t vllm-hpu:test .
      - name: Run Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'vllm-hpu:test'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
```

### 2. Add Gitleaks Secret Detection (1 hour)
```yaml
# .github/workflows/gitleaks.yml
name: Secret Detection
on: [pull_request]
jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
```

### 3. Add Coverage Tracking (3-4 hours)
```yaml
# Add to cpu-test.yml or create dedicated workflow
- name: Run tests with coverage
  run: |
    pip install pytest-cov
    VLLM_SKIP_WARMUP=true VLLM_USE_FAKE_HPU=1 \
      pytest tests/core tests/engine --cov=vllm --cov-report=xml
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    file: coverage.xml
    fail_ci_if_error: false
```

### 4. Add Pre-commit Hooks (1-2 hours)
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.5
    hooks:
      - id: ruff
        args: [--fix]
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.11.1
    hooks:
      - id: mypy
        additional_dependencies: [types-PyYAML, types-requests]
  - repo: https://github.com/codespell-project/codespell
    rev: v2.3.0
    hooks:
      - id: codespell
```

### 5. Create Basic Agent Rules (2-3 hours)
Create `.claude/rules/unit-tests.md` and `.claude/rules/e2e-tests.md` with project-specific patterns like pytest markers (`@pytest.mark.core_model`, `@pytest.mark.distributed_2_gpus`), HPU fake device setup (`VLLM_USE_FAKE_HPU=1`), and fixture patterns from `conftest.py`.

## Detailed Findings

### CI/CD Pipeline

**GitHub Actions (14 workflows)**:
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ruff.yml` | PR to habana_main | Python linting with ruff |
| `mypy.yaml` | PR to habana_main | Type checking (Python 3.9-3.12 matrix) |
| `yapf.yml` | PR to habana_main | Python formatting |
| `clang-format.yml` | PR to habana_main | C/C++ formatting |
| `codespell.yml` | PR to main | Spelling checks |
| `shellcheck.yml` | PR to main | Shell script linting |
| `actionlint.yml` | PR to main | GitHub Actions workflow linting |
| `cpu-test.yml` | PR to habana_main | CPU smoke test with fake HPU |
| `trigger_jenkins.yml` | PR events | Fire-and-forget Jenkins webhook |
| `scorecard.yml` | Weekly + push | OSSF Scorecard supply chain security |
| `publish.yml` | Tag push | Release creation + wheel build |
| `stale.yml` | Daily cron | Stale issue/PR management |
| `add_label_automerge.yml` | PR auto-merge | Label management |
| `cleanup_pr_body.yml` | PR opened/edited | PR description cleanup |

**Key observations**:
- Branch naming inconsistency: Some workflows target `main`, others target `habana_main`
- The `cpu-test.yml` is the **only** test that runs in GitHub Actions — it uses `VLLM_USE_FAKE_HPU=1` for a basic smoke test
- Real GPU/HPU tests are delegated to Buildkite (CUDA/GPU) and Jenkins (HPU)
- No concurrency controls on any workflow
- No caching strategies (pip, Docker layers)
- No artifact retention policies for test results

**Buildkite Pipeline** (inherited from upstream vLLM):
- Comprehensive GPU test pipeline with 30+ test steps
- Multi-GPU testing (2 and 4 GPUs)
- Multi-node distributed testing
- Test sharding for large suites (LoRA 4-way, Kernels 4-way)
- Nightly extended test runs for non-core models
- LM evaluation harness integration
- Source file dependency tracking for selective test execution

**Jenkins** (HPU-specific):
- Triggered on every PR via webhook
- No visibility into test execution or results from GitHub
- Completely opaque to PR reviewers

### Test Coverage

**Test Framework**: pytest 8.3.3 with extensive plugin ecosystem
- `pytest-asyncio` for async tests
- `pytest-forked` for process isolation
- `pytest-rerunfailures` for flaky test handling
- `pytest-shard` for test parallelization
- `buildkite-test-collector` for test analytics

**Test Distribution** (363 test files, 61K LOC):
| Area | Files | Description |
|------|-------|-------------|
| models | 60 | Model correctness (decoder-only, encoder-decoder, vision-language, embedding) |
| entrypoints | 43 | OpenAI API, LLM interface, offline mode |
| kernels | 35 | CUDA kernel tests |
| lora | 31 | LoRA adapter tests |
| spec_decode | 23 | Speculative decoding (including E2E) |
| core | 19 | Scheduler, block manager, prefix caching |
| engine | 13 | LLM engine and output processor |
| distributed | 13 | Multi-GPU, multi-node, pipeline parallel |
| samplers | 11 | Sampling parameter tests |
| quantization | 10 | Quantization layer tests |
| compile | 10 | PyTorch compilation tests |

**Test-to-Code Ratio**: 0.72 (363 test files / 504 source files), 0.39 by LOC (61K / 155K)

**Pytest Markers** (custom):
- `core_model` — core model tests run on every PR
- `cpu_model` — CPU-only tests
- `quant_model` — quantization tests
- `distributed_2_gpus` — 2-GPU distributed tests
- `skip_v1` — skip on v1 engine
- `skip_global_cleanup` — skip cleanup

**Mocking**: 64 test files use `unittest.mock` (Mock, MagicMock, patch, monkeypatch)

**Conftest Architecture**: 10 conftest.py files providing shared fixtures for model loading, tokenizer setup, image/video assets, and distributed environment initialization

**HPU-Specific Testing**:
- Only 1 smoke test via `cpu-test.yml` using `VLLM_USE_FAKE_HPU=1`
- `run-hpu-test.sh` builds Docker image and runs single offline inference example
- No dedicated HPU unit test suite
- No HPU-specific pytest markers or conftest fixtures

### Code Quality

**Linting** (Strong - 6 tools):
1. **ruff** (v0.6.5) — Python linting with pycodestyle, pyflakes, pyupgrade, flake8-bugbear, flake8-simplify rules
2. **mypy** (v1.11.1) — Type checking across Python 3.9-3.12 matrix; `ignore_missing_imports=true` (lenient)
3. **yapf** (v0.32.0) — Python formatting
4. **clang-format** (v18.1.5) — C/C++ formatting for CUDA kernels
5. **codespell** (v2.3.0) — Spelling checks on Python/Markdown/RST
6. **isort** — Import sorting (configured but not in CI as standalone workflow)

**Additional CI Quality**:
- **shellcheck** — Shell script linting
- **actionlint** — GitHub Actions workflow linting
- Both are good practices not commonly seen

**Missing**:
- No `.pre-commit-config.yaml` — linting only enforced in CI, not locally
- No `.editorconfig` for cross-editor consistency
- mypy `ignore_missing_imports=true` is too lenient for production code

### Container Images

**Dockerfiles** (10 total):
| File | Base | Purpose |
|------|------|---------|
| `Dockerfile` | NVIDIA CUDA | Default CUDA build |
| `Dockerfile.cpu` | Ubuntu | CPU-only build |
| `Dockerfile.hpu` | Habana PyTorch | Gaudi/HPU development build |
| `Dockerfile.hpu.ubi` | Habana RHEL9.4 UBI | **Production HPU build** (multi-stage, 124 lines) |
| `Dockerfile.rocm` | ROCm | AMD GPU build |
| `Dockerfile.tpu` | - | Google TPU build |
| `Dockerfile.neuron` | - | AWS Neuron build |
| `Dockerfile.openvino` | - | Intel OpenVINO build |
| `Dockerfile.ppc64le` | - | PowerPC build |
| `Dockerfile.xpu` | - | Intel XPU build |

**Dockerfile.hpu.ubi** (Production — Key Observations):
- Multi-stage build: `habana-base` → `python-install` → `python-habana-base` → `build` → `vllm-openai` → `vllm-grpc-adapter`
- Uses Docker build cache mounts (`--mount=type=cache`)
- Non-root user setup (UID 2000) for OpenShift compatibility
- Includes gRPC adapter variant for TGIS compatibility
- License copying and template management
- **No HEALTHCHECK instruction**
- **Not built or tested in any PR workflow**

### Security

**Present**:
- OSSF Scorecard (supply chain analysis, weekly + on push)
- `SECURITY.md` with vulnerability reporting instructions
- Pinned GitHub Actions versions with SHA hashes (good practice)
- Non-root container user in UBI Dockerfile

**Missing**:
- No container vulnerability scanning (Trivy, Snyk, Grype)
- No SAST/CodeQL integration
- No dependency scanning (Dependabot, Renovate)
- No secret detection (Gitleaks, TruffleHog)
- No SBOM generation
- No image signing or attestation
- No `.trivyignore` or vulnerability exception management

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: All test type rules are missing. The repository has complex test patterns (HPU fake device setup, pytest markers, multi-GPU fixtures, model correctness validation) that would benefit greatly from codified agent rules.
- **Recommendation**: Generate rules with `/test-rules-generator` covering:
  - Unit tests with `VLLM_USE_FAKE_HPU=1` pattern
  - Model correctness tests with core_model/quant_model markers
  - Distributed tests with GPU count markers
  - Entrypoint tests for OpenAI API compatibility

## Recommendations

### Priority 0 (Critical)

1. **Add pytest-cov with Codecov integration**
   - Install `pytest-cov` in test requirements
   - Add `--cov=vllm --cov-report=xml` to CPU test workflow
   - Configure Codecov with coverage thresholds (start at 40%, increase over time)
   - Add PR coverage reporting

2. **Add Trivy container scanning**
   - Scan `Dockerfile.hpu` and `Dockerfile.hpu.ubi` on PRs that modify Dockerfiles or requirements
   - Set severity threshold to CRITICAL+HIGH
   - Configure `.trivyignore` for known acceptable risks

3. **Add secret detection**
   - Add Gitleaks to PR workflow
   - Configure exceptions for false positives

4. **Add PR-time Docker build validation for HPU**
   - Build `Dockerfile.hpu` in CI on PRs touching HPU-related files
   - Validate the build completes without errors
   - Run basic import/startup test inside the container

### Priority 1 (High Value)

5. **Surface Jenkins HPU test results in GitHub**
   - Use GitHub Checks API to report Jenkins results back to PRs
   - Or replace Jenkins webhook with GitHub Actions self-hosted runners with HPU access

6. **Add container runtime validation**
   - Use `VLLM_USE_FAKE_HPU=1` to test container startup
   - Validate entrypoint works correctly
   - Check that all required packages are installed

7. **Create agent rules for test automation**
   - `.claude/rules/unit-tests.md` — pytest patterns, HPU fixtures, model test conventions
   - `.claude/rules/e2e-tests.md` — distributed test patterns, multi-GPU setup
   - `CLAUDE.md` — project overview, build instructions, test execution commands

8. **Add pre-commit hooks**
   - Mirror CI lint checks (ruff, mypy, codespell) for local development
   - Add trailing whitespace and end-of-file fixers

### Priority 2 (Nice-to-Have)

9. **Add SBOM generation for HPU images**
   - Use Syft to generate SBOM during image build
   - Attach SBOM to release artifacts

10. **Add performance regression testing**
    - Benchmark inference throughput/latency on HPU
    - Track metrics over time to detect regressions

11. **Add contract tests for OpenAI API**
    - Validate OpenAI-compatible API responses match specification
    - Test error handling and edge cases

12. **Consolidate CI infrastructure**
    - Reduce fragmentation across GitHub Actions, Buildkite, and Jenkins
    - Consider GitHub Actions self-hosted runners for HPU testing

## Comparison to Gold Standards

| Dimension | vllm-gaudi | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | 7.0 - Large pytest suite | 9.0 - Multi-layer Jest | 7.0 - Notebook validation | 8.5 - Go testing |
| Integration/E2E | 6.5 - Buildkite multi-GPU | 9.0 - Cypress + contract | 8.0 - Multi-layer image | 9.0 - envtest + Kind |
| Build Integration | 3.0 - No PR builds | 8.0 - PR builds all variants | 7.0 - Image build matrix | 7.5 - Makefile targets |
| Image Testing | 4.0 - No validation | 7.0 - BFF + frontend | 9.0 - 5-layer validation | 6.5 - Basic build |
| Coverage | 1.0 - None | 8.5 - Codecov enforced | 4.0 - Minimal | 8.0 - Go coverage |
| CI/CD | 6.5 - Fragmented 3-system | 9.0 - Unified GHA | 7.5 - Matrix builds | 8.5 - Well-organized |
| Agent Rules | 0.0 - None | 8.0 - Comprehensive | 3.0 - Basic | 2.0 - Minimal |
| **Overall** | **5.4** | **8.5** | **6.5** | **7.5** |

## File Paths Reference

### CI/CD Configuration
- `.github/workflows/ruff.yml` — Python linting
- `.github/workflows/mypy.yaml` — Type checking
- `.github/workflows/yapf.yml` — Python formatting
- `.github/workflows/clang-format.yml` — C++ formatting
- `.github/workflows/codespell.yml` — Spell checking
- `.github/workflows/cpu-test.yml` — CPU smoke test (only automated test in GHA)
- `.github/workflows/trigger_jenkins.yml` — HPU test trigger
- `.github/workflows/scorecard.yml` — OSSF supply chain security
- `.buildkite/test-pipeline.yaml` — GPU test pipeline (30+ steps)
- `.buildkite/run-hpu-test.sh` — HPU Docker build + smoke test

### Test Files
- `tests/conftest.py` — Root conftest with model/tokenizer fixtures
- `tests/models/` — 60 model correctness test files
- `tests/entrypoints/` — 43 API endpoint test files
- `tests/kernels/` — 35 CUDA kernel test files
- `tests/distributed/` — 13 multi-GPU/node test files
- `tests/spec_decode/e2e/` — Speculative decoding E2E tests

### Container Images
- `Dockerfile.hpu` — Gaudi development image
- `Dockerfile.hpu.ubi` — Production UBI image (multi-stage, 124 lines)

### Build Configuration
- `pyproject.toml` — ruff, mypy, isort, codespell, pytest configuration
- `setup.py` — Package build configuration
- `requirements-hpu.txt` — Gaudi-specific dependencies
- `requirements-test.txt` — Test dependencies (pip-compiled)
- `requirements-lint.txt` — Lint tool dependencies
