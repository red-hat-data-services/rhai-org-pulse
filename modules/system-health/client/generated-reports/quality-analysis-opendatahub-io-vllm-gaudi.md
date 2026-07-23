---
repository: "opendatahub-io/vllm-gaudi"
overall_score: 5.0
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "271 test files with pytest framework; good test-to-code ratio (0.61); HPU-specific tests limited"
  - dimension: "Integration/E2E"
    score: 6.0
    status: "Jenkins-triggered HPU hardware tests on PR; LM-eval accuracy benchmarks; E2E dirs for spec_decode and core"
  - dimension: "Build Integration"
    score: 4.0
    status: "No PR-time build in GitHub Actions; relies on external Jenkins webhook; no Konflux simulation"
  - dimension: "Image Testing"
    score: 5.0
    status: "Multi-stage UBI Dockerfile; 10 platform-specific Dockerfiles; no HEALTHCHECK or runtime validation"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No codecov, no coverage config, no pytest-cov usage, no coverage gates"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "15 GitHub Actions workflows + Jenkins + Buildkite; no caching or concurrency controls"
  - dimension: "Static Analysis"
    score: 7.0
    status: "Ruff + mypy + yapf + clang-format + codespell + shellcheck; Dependabot configured; no pre-commit hooks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "Zero coverage tracking across the entire repository"
    impact: "No visibility into test coverage; regressions go undetected; no enforcement of quality gates on PRs"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No PR-time build validation in GitHub Actions"
    impact: "Docker image build failures discovered only in external Jenkins; slow feedback loop for contributors"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No container runtime validation or health checks"
    impact: "Image startup failures and runtime issues not caught until deployment"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents lack context about test patterns, coding standards, and HPU-specific requirements"
    severity: "LOW"
    effort: "2-4 hours"
quick_wins:
  - title: "Add codecov integration with PR coverage reporting"
    effort: "2-4 hours"
    impact: "Immediate visibility into test coverage with PR-level enforcement"
  - title: "Add concurrency controls to GitHub Actions workflows"
    effort: "1-2 hours"
    impact: "Prevent redundant workflow runs on rapid PR updates; save CI minutes"
  - title: "Create basic CLAUDE.md with HPU-specific testing guidance"
    effort: "2-3 hours"
    impact: "Improve AI-generated code quality and test consistency"
  - title: "Add pre-commit hooks configuration"
    effort: "1-2 hours"
    impact: "Catch formatting and linting issues locally before CI"
recommendations:
  priority_0:
    - "Add pytest-cov and codecov integration to measure and enforce test coverage thresholds"
    - "Add PR-time Docker build validation for Dockerfile.hpu.ubi in GitHub Actions"
  priority_1:
    - "Add concurrency controls and caching to GitHub Actions workflows"
    - "Add HEALTHCHECK to production Dockerfiles (Dockerfile.hpu.ubi)"
    - "Create comprehensive CLAUDE.md with test patterns and HPU-specific guidance"
  priority_2:
    - "Add pre-commit hooks configuration for local linting enforcement"
    - "Add timeout-minutes to all GitHub Actions jobs"
    - "Increase HPU-specific test coverage beyond LoRA tests"
---

# Quality Analysis: opendatahub-io/vllm-gaudi

## Executive Summary

- **Overall Score: 5.0/10**
- **Repository Type**: ML inference engine (vLLM fork for Intel Gaudi/HPU accelerators)
- **Primary Language**: Python (with C++/CUDA extensions)
- **Framework**: PyTorch, vLLM
- **Jira**: RHOAIENG / Model Runtimes (midstream)

### Key Strengths
- Large test suite inherited from upstream vLLM (271 test files, 61K+ test LOC)
- Strong static analysis with 8 distinct linting/formatting tools enforced in CI
- Multi-CI architecture (GitHub Actions + Jenkins + Buildkite) covering linting, hardware testing, and benchmarks
- Production-ready UBI-based multi-stage Dockerfile for RHOAI deployment
- Dependabot configured with grouped updates for github-actions and pip ecosystems

### Critical Gaps
- **Zero coverage tracking** — no codecov, no pytest-cov, no coverage thresholds
- **No PR-time build validation** in GitHub Actions — Docker builds only via external Jenkins
- **No agent rules** — no CLAUDE.md, AGENTS.md, or .claude/ directory
- No container health checks or runtime validation in Dockerfiles

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 7.0/10 | 15% | 1.05 | 271 test files, pytest, good test-to-code ratio |
| Integration/E2E | 6.0/10 | 20% | 1.20 | Jenkins HPU tests + LM-eval benchmarks + E2E dirs |
| Build Integration | 4.0/10 | 15% | 0.60 | External Jenkins only; no GHA build; no Konflux sim |
| Image Testing | 5.0/10 | 10% | 0.50 | Multi-stage UBI build; no HEALTHCHECK; no multi-arch |
| Coverage Tracking | 0.0/10 | 10% | 0.00 | Complete absence of coverage tracking |
| CI/CD Automation | 6.0/10 | 15% | 0.90 | 15 workflows + Jenkins + Buildkite; no caching |
| Static Analysis | 7.0/10 | 10% | 0.70 | Ruff + mypy + yapf + clang-format + Dependabot |
| Agent Rules | 0.0/10 | 5% | 0.00 | No agent rules present |
| **Overall** | **5.0/10** | **100%** | **4.95** | |

## Critical Gaps

### 1. Zero Coverage Tracking
- **Impact**: No visibility into which code paths are tested; regressions can silently reduce coverage
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No `.codecov.yml`, no `.coveragerc`, no `pytest-cov` in any CI workflow, no coverage thresholds on PRs. This is the single most impactful gap — a project with 271 test files but zero coverage measurement has no way to know if those tests are actually exercising the right code paths.

### 2. No PR-Time Build Validation in GitHub Actions
- **Impact**: Docker image build failures only surface in external Jenkins; contributors get slow/opaque feedback
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: The only PR-triggered build is `cpu-test.yml` which builds from source with a fake HPU — it does not build any Docker image. The `trigger_jenkins.yml` workflow fires a webhook to an external Jenkins instance, but this is opaque to contributors and not visible in the PR checks UI. No Konflux simulation exists.

### 3. No Container Health Checks or Runtime Validation
- **Impact**: Image startup failures and runtime issues not caught until production deployment
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: Despite having 10 Dockerfiles and a production-grade multi-stage UBI build (`Dockerfile.hpu.ubi`), none include `HEALTHCHECK` instructions. The Buildkite `run-hpu-test.sh` script does build and run a smoke test, but this is not in the PR workflow.

### 4. No Agent Rules
- **Impact**: AI coding agents lack context about HPU-specific patterns, test conventions, and project structure
- **Severity**: LOW
- **Effort**: 2-4 hours
- **Details**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory. Given the complexity of HPU-specific code (fake HPU testing, Gaudi-specific imports, hardware configuration), agent rules would significantly improve AI-generated code quality.

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
Add `pytest-cov` to test runs and configure codecov:

```yaml
# .codecov.yml
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

```yaml
# In CI workflow
- name: Run tests with coverage
  run: pytest tests/ --cov=vllm --cov-report=xml -x
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    file: ./coverage.xml
    token: ${{ secrets.CODECOV_TOKEN }}
```

### 2. Add Concurrency Controls (1-2 hours)
Add to all PR-triggered workflows:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

### 3. Create CLAUDE.md (2-3 hours)
Create a `CLAUDE.md` with guidance on:
- HPU-specific test patterns (fake HPU, `VLLM_USE_FAKE_HPU`)
- Test file organization conventions
- How to run tests locally
- Gaudi-specific code patterns and constraints

### 4. Add Pre-commit Hooks (1-2 hours)
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.0
    hooks:
      - id: ruff
        args: [--fix]
  - repo: https://github.com/google/yapf
    rev: v0.32.0
    hooks:
      - id: yapf
```

## Detailed Findings

### Unit Tests

**Score: 7.0/10**

| Metric | Value |
|--------|-------|
| Test files | 271 |
| Source files | 447 |
| Test-to-code file ratio | 0.61 |
| Source LOC | 155,798 |
| Test LOC | 61,517 |
| Test-to-source LOC ratio | 0.39 |
| Framework | pytest |
| Fixtures | 10 conftest.py files |

**Strengths:**
- Large test suite inherited from upstream vLLM with 271 test files
- Well-organized test subdirectories: `async_engine/`, `basic_correctness/`, `core/`, `distributed/`, `entrypoints/`, `kernels/`, `lora/`, `models/`, `samplers/`, `spec_decode/`, `tokenization/`, `worker/`
- Good use of pytest fixtures with 10 `conftest.py` files
- Extensive use of `@pytest.mark.parametrize` for combinatorial testing
- Custom markers: `skip_global_cleanup`, `core_model`, `cpu_model`, `quant_model`, `distributed_2_gpus`, `skip_v1`
- HPU-specific test files for LoRA (6 files): `test_lora_hpu.py`, `test_lora_manager_hpu.py`, `test_multilora_hpu.py`, etc.

**Gaps:**
- HPU-specific tests limited to LoRA module only (6 files)
- No HPU-specific unit tests for core inference, sampling, or scheduling
- Tests are largely inherited from upstream — unclear which are validated on Gaudi hardware
- No test isolation markers for HPU vs CPU vs GPU tests

### Integration/E2E Tests

**Score: 6.0/10**

**Strengths:**
- E2E test directories: `tests/spec_decode/e2e/` (11 files), `tests/core/block/e2e/` (2 files)
- Jenkins triggered on every PR for HPU hardware testing via webhook
- LM-eval accuracy benchmarks with GSM8k against baseline scores
- Multi-hardware testing across Gaudi2 (g2) and Gaudi3 (g3) flavors
- Multi-TP testing (tp1, tp2, tp4) for distributed inference
- FP8 and multi-step scheduling (MSS) variants tested
- Torch compile mode variants tested separately
- CPU smoke test in GitHub Actions using fake HPU emulation
- Buildkite `run-hpu-test.sh` builds Docker image and runs offline inference

**Gaps:**
- Jenkins testing is opaque — triggered via webhook, results not directly visible in GitHub PR checks
- No integration tests in GitHub Actions (only CPU smoke test)
- No multi-version testing (different vLLM versions or PyTorch versions)
- E2E tests focused on spec_decode and core block — limited coverage of entrypoints and API server

### Build Integration

**Score: 4.0/10**

**Strengths:**
- `Dockerfile.hpu.ubi` is a well-structured multi-stage build (5 stages: habana-base → python-install → python-habana-base → build → vllm-openai → vllm-grpc-adapter)
- CPU test (`cpu-test.yml`) builds from source and runs inference on every PR
- Jenkins webhook triggers on PR open/reopen/edit/synchronize
- Buildkite has Docker build + run smoke test (`run-hpu-test.sh`)

**Gaps:**
- No Docker image build in GitHub Actions PR workflow
- Jenkins is an external system — build failures are not transparent in PR checks
- No Konflux build simulation
- No image startup validation in CI
- No kustomize or manifest validation (not a K8s operator, but could validate GRPC adapter config)

### Image Testing

**Score: 5.0/10**

**Strengths:**
- 10 platform-specific Dockerfiles: `Dockerfile.hpu`, `Dockerfile.hpu.ubi`, `Dockerfile.cpu`, `Dockerfile.rocm`, `Dockerfile.tpu`, `Dockerfile.neuron`, `Dockerfile.openvino`, `Dockerfile.xpu`, `Dockerfile.ppc64le`, `Dockerfile`
- `Dockerfile.hpu.ubi` uses Red Hat UBI 9.4 base image (FIPS-capable) with proper multi-stage build
- `.dockerignore` present
- Non-root user configuration in `Dockerfile.hpu.ubi` (UID 2000, GID 0 for OpenShift)
- Proper `ENTRYPOINT` configuration for vLLM API server
- Build cache optimizations with `--mount=type=cache` for pip and ccache
- GRPC adapter stage for TGIS compatibility

**Gaps:**
- No `HEALTHCHECK` in any Dockerfile
- No multi-architecture support (`--platform`, `docker buildx`, manifest lists)
- No Testcontainers or container runtime validation
- No container image scanning in CI (though this is out of scope per instructions)
- Buildkite HPU test runs Docker but only for smoke test, not comprehensive validation

### Coverage Tracking

**Score: 0.0/10**

**Complete absence of coverage tracking:**
- No `.codecov.yml` or `codecov.yml`
- No `.coveragerc`
- No `pytest-cov` usage in any CI workflow
- No `--cov` flags in test commands
- No coverage thresholds or gates
- No PR coverage reporting

This is the most critical gap. With 271 test files and 61K+ test LOC, the project has significant testing investment but zero visibility into coverage effectiveness. Coverage regressions can go completely undetected.

### CI/CD Automation

**Score: 6.0/10**

**Workflow Inventory (15 GitHub Actions workflows):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ruff.yml` | PR (habana_main) | Python linting |
| `yapf.yml` | PR (habana_main) | Python formatting |
| `mypy.yaml` | PR (habana_main) | Type checking (Python 3.9-3.12 matrix) |
| `clang-format.yml` | PR (habana_main) | C++/CUDA formatting |
| `codespell.yml` | PR (main) | Spell checking |
| `shellcheck.yml` | PR (main) | Shell script linting |
| `actionlint.yml` | PR (main) | GitHub Actions linting |
| `cpu-test.yml` | PR (habana_main) | CPU smoke test with fake HPU |
| `trigger_jenkins.yml` | PR | Trigger external Jenkins tests |
| `add_label_automerge.yml` | PR target | Auto-merge labeling |
| `cleanup_pr_body.yml` | PR target | PR description cleanup |
| `publish.yml` | Tag push | Release and wheel building |
| `scorecard.yml` | Schedule/push | OpenSSF Scorecard |
| `stale.yml` | Schedule (daily) | Stale issue/PR management |

**Additional CI Systems:**
- **Jenkins**: Hardware testing on Gaudi2/Gaudi3 with LM-eval benchmarks, triggered per PR
- **Buildkite**: GPU/hardware testing, nightly benchmarks, release pipeline
- **Mergify**: Auto-merge configuration (`.github/mergify.yml`)

**Strengths:**
- Comprehensive linting coverage: Python (ruff, yapf, mypy, codespell, isort), C++ (clang-format), Shell (shellcheck), GitHub Actions (actionlint)
- Multi-CI architecture covers different testing needs
- Stale issue management automation
- OpenSSF Scorecard analysis

**Gaps:**
- No concurrency controls on any workflow
- No caching (pip, dependencies) in any workflow
- No `timeout-minutes` set on any job
- Branch targeting split between `main` and `habana_main` — some workflows only run on `main`, others on `habana_main`
- Jenkins results opaque to GitHub PR checks

### Static Analysis

**Score: 7.0/10**

#### Linting

**Tools Configured:**
| Tool | Config Location | CI Workflow | Scope |
|------|----------------|-------------|-------|
| Ruff | `pyproject.toml` | `ruff.yml` | Python linting (E, F, UP, B, SIM, G rules) |
| mypy | `pyproject.toml` | `mypy.yaml` | Type checking across Python 3.9-3.12 |
| YAPF | `pyproject.toml` | `yapf.yml` | Python formatting (v0.32.0) |
| isort | Via ruff workflow | `ruff.yml` | Import ordering |
| codespell | `pyproject.toml` | `codespell.yml` | Spell checking |
| clang-format | CI-enforced | `clang-format.yml` | C++/CUDA formatting (v18.1.5) |
| shellcheck | CI-enforced | `shellcheck.yml` | Shell script linting |
| actionlint | CI-enforced | `actionlint.yml` | GitHub Actions linting |

The ruff configuration enables useful lint categories: pycodestyle (E), Pyflakes (F), pyupgrade (UP), flake8-bugbear (B), flake8-simplify (SIM), and logging (G). Mypy runs across 4 Python versions in a matrix strategy.

#### FIPS Compatibility

- **No non-FIPS crypto imports detected** in source code
- `hashlib.sha256` usage only (compliant) in `vllm/model_executor/model_loader/weight_utils.py`
- `Dockerfile.hpu.ubi` uses UBI 9.4 base image from `vault.habana.ai` — FIPS-capable
- Standard `Dockerfile.hpu` uses Ubuntu 22.04 — not FIPS-capable
- No FIPS build tags (Python project — not applicable for Go-style build tags)

#### Dependency Alerts

- **Dependabot configured** (`.github/dependabot.yml`)
  - `github-actions` ecosystem: weekly updates
  - `pip` ecosystem: weekly updates with grouped patch/minor updates
  - Appropriate ignores for pinned deep learning dependencies (torch, torchvision, xformers)
  - Reviewers assigned (khluu, simon-mo)
  - Open PR limit of 5

#### Pre-commit Hooks
- **Not configured** — no `.pre-commit-config.yaml`
- All linting enforcement is CI-only (GitHub Actions)
- `format.sh` script exists for local formatting but requires manual execution

### Agent Rules

**Score: 0.0/10**

- **Status**: Missing
- **Coverage**: None
- **Quality**: N/A
- **Gaps**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory exists

Given the complexity of this project (HPU-specific code, fake HPU testing, Gaudi hardware requirements, multi-platform Docker builds), agent rules would significantly improve AI-assisted development quality. Key areas that should be documented:
- How to write HPU-specific tests (using `VLLM_USE_FAKE_HPU=1`)
- Test file naming conventions and directory organization
- Gaudi-specific code patterns (habana imports, HPU memory management)
- Docker build patterns for different platforms
- How to run tests locally without Gaudi hardware

**Recommendation**: Generate missing rules with `/test-rules-generator`

## Recommendations

### Priority 0 (Critical)

1. **Add pytest-cov and codecov integration** to measure and enforce test coverage thresholds
   - Add `pytest-cov` to test dependencies
   - Configure `.codecov.yml` with project and patch targets
   - Add coverage upload step to `cpu-test.yml` workflow
   - Set minimum coverage gate for PRs (start at current baseline)

2. **Add PR-time Docker build validation** for `Dockerfile.hpu.ubi` in GitHub Actions
   - Create workflow that builds `Dockerfile.hpu.ubi` on PRs touching Dockerfiles or build files
   - Use `docker build --target build` for faster validation (skip final stage)
   - Cache Docker layers for faster builds

### Priority 1 (High Value)

3. **Add concurrency controls and caching** to all GitHub Actions workflows
   - Add `concurrency` groups to cancel redundant runs
   - Add pip caching to reduce install time
   - Add `timeout-minutes` to prevent hung jobs

4. **Add HEALTHCHECK to production Dockerfiles**
   - Add `HEALTHCHECK CMD curl -f http://localhost:8000/health || exit 1` to `Dockerfile.hpu.ubi`
   - Ensure readiness probes are documented for Kubernetes deployment

5. **Create comprehensive CLAUDE.md** with:
   - Build and test instructions for HPU and CPU (fake HPU)
   - Test organization guide
   - HPU-specific coding patterns
   - PR checklist including linting requirements

### Priority 2 (Nice-to-Have)

6. **Add pre-commit hooks** for ruff, yapf, and isort
   - Enforce formatting locally before CI
   - Reduce CI-detected formatting failures

7. **Add timeout-minutes to all GitHub Actions jobs**
   - Prevent hung workflows from consuming resources

8. **Increase HPU-specific test coverage**
   - Currently only LoRA module has HPU-specific tests (6 files)
   - Add HPU-specific tests for core inference, sampling, and scheduling paths
   - Expand fake HPU testing beyond the single offline inference example

## Comparison to Gold Standards

| Dimension | vllm-gaudi | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | 7/10 | 9/10 | 7/10 | 8/10 |
| Integration/E2E | 6/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 4/10 | 8/10 | 7/10 | 7/10 |
| Image Testing | 5/10 | 7/10 | 9/10 | 6/10 |
| Coverage Tracking | 0/10 | 8/10 | 6/10 | 8/10 |
| CI/CD Automation | 6/10 | 9/10 | 8/10 | 9/10 |
| Static Analysis | 7/10 | 8/10 | 6/10 | 7/10 |
| Agent Rules | 0/10 | 8/10 | 3/10 | 2/10 |
| **Overall** | **5.0** | **8.5** | **7.0** | **7.5** |

**Key differentiators from gold standards:**
- **vs. odh-dashboard**: Missing coverage enforcement, no contract tests, no agent rules
- **vs. notebooks**: Missing image testing depth (no 5-layer validation), no coverage tracking
- **vs. kserve**: Missing coverage enforcement, no multi-version testing in GHA, weaker build integration

## File Paths Reference

### CI/CD Configuration
- `.github/workflows/ruff.yml` — Python linting (ruff + isort)
- `.github/workflows/yapf.yml` — Python formatting
- `.github/workflows/mypy.yaml` — Type checking (multi-version matrix)
- `.github/workflows/clang-format.yml` — C++/CUDA formatting
- `.github/workflows/codespell.yml` — Spell checking
- `.github/workflows/shellcheck.yml` — Shell script linting
- `.github/workflows/actionlint.yml` — GitHub Actions linting
- `.github/workflows/cpu-test.yml` — CPU smoke test with fake HPU
- `.github/workflows/trigger_jenkins.yml` — Jenkins webhook trigger
- `.github/workflows/publish.yml` — Release and wheel building
- `.github/workflows/scorecard.yml` — OpenSSF Scorecard
- `.github/mergify.yml` — Auto-merge configuration
- `.github/dependabot.yml` — Dependency update configuration

### Testing
- `tests/` — Main test directory (271 test files)
- `tests/conftest.py` — Root test fixtures
- `.jenkins/test_config.yaml` — Jenkins HPU test configuration
- `.jenkins/test_config_t_compile.yaml` — Jenkins torch compile test config
- `.jenkins/lm-eval-harness/` — LM evaluation benchmark tests
- `.buildkite/test-pipeline.yaml` — Buildkite test pipeline
- `.buildkite/run-hpu-test.sh` — HPU Docker build + smoke test
- `examples/offline_inference_fakehpu.py` — Fake HPU inference example

### Container Images
- `Dockerfile.hpu` — Standard HPU image (Ubuntu 22.04)
- `Dockerfile.hpu.ubi` — Production UBI 9.4 image (multi-stage, FIPS-capable)
- `Dockerfile.cpu` — CPU-only image
- `Dockerfile` — Standard CUDA image
- `.dockerignore` — Docker build exclusions

### Static Analysis Configuration
- `pyproject.toml` — Ruff, mypy, pytest, yapf, codespell configuration
- `format.sh` — Local formatting script
- `tools/mypy.sh` — Mypy execution script

### Agent Rules
- None present (recommended to create)
