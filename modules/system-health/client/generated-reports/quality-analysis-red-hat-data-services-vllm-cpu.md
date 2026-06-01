---
repository: "red-hat-data-services/vllm-cpu"
overall_score: 5.6
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Extensive pytest suite (852 test files, 255K LoC) covering kernels, models, APIs, distributed, and v1 engine"
  - dimension: "Integration/E2E"
    score: 6.0
    status: "13 dedicated e2e tests under v1/e2e; correctness, entrypoint, and model tests serve as integration coverage"
  - dimension: "Build Integration"
    score: 3.0
    status: "Konflux builds on comment-trigger only (/build-konflux); no automatic PR-time build validation; skip-checks=true"
  - dimension: "Image Testing"
    score: 3.5
    status: "Multiple Dockerfiles (UBI, Konflux, multi-arch) but no image startup/runtime validation in CI"
  - dimension: "Coverage Tracking"
    score: 5.0
    status: "Codecov config and .coveragerc present but no coverage thresholds or PR enforcement gates"
  - dimension: "CI/CD Automation"
    score: 3.5
    status: "Only 1 GitHub Actions workflow (PR bot); tests rely on upstream vllm-project CI; Tekton/Konflux for builds only"
  - dimension: "Agent Rules"
    score: 7.0
    status: "AGENTS.md with contribution policy, dev workflow, lint/test instructions; CLAUDE.md references it; no .claude/rules/"
critical_gaps:
  - title: "No automated test execution in CI for this fork"
    impact: "Tests exist but are never run automatically on PRs — regressions can merge undetected"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No PR-time container image build validation"
    impact: "Dockerfile.cpu.ubi and Dockerfile.konflux.cpu are only validated via manual /build-konflux comment trigger with skip-checks=true"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No coverage enforcement or thresholds"
    impact: "Coverage data collected but no gates prevent coverage regression on PRs"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No security scanning in CI (no Trivy, Snyk, CodeQL, or SAST)"
    impact: "Vulnerabilities in dependencies and images not detected until production"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No image runtime validation or startup testing"
    impact: "Broken images ship without detection — no smoke test on built containers"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Missing .claude/rules/ for test automation guidance"
    impact: "AI-assisted contributions lack structured test creation patterns specific to this repo"
    severity: "LOW"
    effort: "2-3 hours"
quick_wins:
  - title: "Add Clair/Trivy vulnerability scanning to Tekton PR pipeline"
    effort: "2-3 hours"
    impact: "The clair-scan task is already in the Tekton spec but skip-checks=true disables it — flip to false"
  - title: "Add codecov coverage thresholds to codecov.yml"
    effort: "1-2 hours"
    impact: "Enforce minimum coverage on PRs to prevent regression"
  - title: "Add a lightweight GitHub Actions workflow to run unit tests on PRs"
    effort: "4-6 hours"
    impact: "Catch test regressions before merge without waiting for upstream CI"
  - title: "Enable Konflux PR builds automatically instead of on-comment"
    effort: "1-2 hours"
    impact: "Every PR validated against Konflux build pipeline by default"
recommendations:
  priority_0:
    - "Create a GitHub Actions CI workflow that runs pytest on PR for CPU-only tests (tests marked @cpu_test or @cpu_model)"
    - "Remove skip-checks=true from Tekton PR pipeline to enable Clair vulnerability scanning"
    - "Add container image startup smoke test after Konflux build (entrypoint health check)"
  priority_1:
    - "Add codecov thresholds (e.g., patch coverage >= 70%) and PR status check enforcement"
    - "Switch Konflux PR pipeline from on-comment to on-PR-open trigger for automatic build validation"
    - "Add CodeQL or Semgrep SAST workflow for static security analysis"
    - "Create .claude/rules/ with test patterns for unit tests, integration tests, and model tests"
  priority_2:
    - "Add image runtime functional tests using container test frameworks (e.g., test API endpoint responds)"
    - "Add multi-architecture build matrix testing in CI (s390x, ppc64le currently build but aren't tested)"
    - "Add performance regression benchmarks for CPU inference latency"
---

# Quality Analysis: vllm-cpu (red-hat-data-services/vllm-cpu)

## Executive Summary

- **Overall Score: 5.6/10**
- **Repository Type**: Python ML inference engine (CPU-optimized fork of vllm-project/vllm)
- **Primary Language**: Python (555K LoC source), C/C++/CUDA (csrc/)
- **Key Strengths**: Massive test suite inherited from upstream (852 test files, 255K LoC), comprehensive pre-commit hooks (18 hooks including ruff, mypy, clang-format, shellcheck, typos), well-structured AGENTS.md with contribution policy
- **Critical Gaps**: No automated test execution in CI for this fork, no security scanning, no image runtime validation, Konflux builds gated behind manual comment trigger with checks disabled
- **Agent Rules Status**: Present (AGENTS.md + CLAUDE.md) but incomplete — no `.claude/rules/` directory for structured test automation guidance

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | Extensive pytest suite (852 test files) — inherited from upstream but no CI execution in fork |
| Integration/E2E | 6.0/10 | 13 e2e tests, correctness tests, entrypoint tests — but no automated CI trigger |
| **Build Integration** | **3.0/10** | **Konflux on-comment only; skip-checks=true; no PR-time build validation** |
| Image Testing | 3.5/10 | 8+ Dockerfiles (UBI, Konflux, multi-arch) but zero runtime validation |
| Coverage Tracking | 5.0/10 | Codecov config + .coveragerc present, but no thresholds or enforcement |
| CI/CD Automation | 3.5/10 | Only 1 GH Actions workflow (PR description bot); tests not run in CI |
| Agent Rules | 7.0/10 | Strong AGENTS.md with policy/workflow/lint guidance; no .claude/rules/ |

## Critical Gaps

### 1. No Automated Test Execution in Fork CI
- **Impact**: 852 test files exist but are never run automatically on PRs to this fork — regressions merge undetected
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Details**: The only GitHub Actions workflow (`new_pr_bot.yml`) is a PR description cleaner and welcome commenter. There is no workflow that runs `pytest`. The upstream vllm-project has extensive CI, but this downstream fork (`red-hat-data-services/vllm-cpu`) does not replicate it. Tests depend on external CI infrastructure that is not configured here.

### 2. Konflux PR Builds Are Manual and Checks Disabled
- **Impact**: The Tekton PR pipeline (`.tekton/vllm-cpu-pull-request.yaml`) is triggered only by `/build-konflux` comment, and sets `skip-checks: true`, disabling Clair scanning and preflight checks
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The pipeline configuration includes `ecosystem-cert-preflight-checks` and `clair-scan` task resource specs, showing intent to run them, but `skip-checks: true` bypasses them entirely. The push pipeline also builds without checks.

### 3. No Security Scanning
- **Impact**: No Trivy, Snyk, CodeQL, or any SAST tool configured; vulnerabilities not detected before production
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No `.gitleaks.toml`, no `.trivyignore`, no CodeQL workflow. The SECURITY.md provides a vulnerability reporting process (inherited from upstream), but no proactive scanning is configured in this fork's CI.

### 4. No Container Image Runtime Validation
- **Impact**: Dockerfile.cpu.ubi and Dockerfile.konflux.cpu build images but nobody tests that they start or serve correctly
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Both Dockerfiles set `ENTRYPOINT ["python3", "-m", "vllm.entrypoints.openai.api_server"]` but no CI job validates that the container actually starts, responds to health checks, or serves inference requests.

### 5. No Coverage Enforcement
- **Impact**: Coverage data infrastructure exists (codecov.yml, .coveragerc) but no quality gates
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: `codecov.yml` has `require_ci_to_pass: false` and no coverage thresholds. `.coveragerc` has good exclusion patterns but no `fail_under` setting. Coverage data is collected but never enforced.

## Quick Wins

### 1. Enable Clair Scanning in Tekton PR Pipeline (1-2 hours)
- The `clair-scan` task already has resource allocations defined in the PR pipeline
- Simply change `skip-checks: "true"` to `skip-checks: "false"` in `.tekton/vllm-cpu-pull-request.yaml`
```yaml
# Before
- name: skip-checks
  value: true
# After
- name: skip-checks
  value: false
```

### 2. Add Coverage Thresholds (1-2 hours)
Add enforcement to `codecov.yml`:
```yaml
coverage:
  status:
    project:
      default:
        target: auto
        threshold: 1%
    patch:
      default:
        target: 70%
```

### 3. Add Lightweight CPU Test Workflow (4-6 hours)
Create `.github/workflows/tests.yml` to run CPU-marked tests on PRs:
```yaml
name: CPU Tests
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: uv venv --python 3.12
      - run: VLLM_USE_PRECOMPILED=1 uv pip install -e . --torch-backend=cpu
      - run: uv pip install -r requirements/test.in
      - run: .venv/bin/python -m pytest tests/ -m "cpu_test" -v --timeout=300
```

### 4. Switch Konflux PR Pipeline to Auto-Trigger (1-2 hours)
Change from comment-trigger to automatic PR trigger:
```yaml
# Before
pipelinesascode.tekton.dev/on-comment: "^/(build-konflux|build-konflux-internal)"
# After  
pipelinesascode.tekton.dev/on-event: "[pull_request]"
pipelinesascode.tekton.dev/on-target-branch: "[main]"
```

## Detailed Findings

### CI/CD Pipeline

**GitHub Actions (1 workflow)**:
- `new_pr_bot.yml` — PR description cleaner and first-time contributor welcome bot
- No test, lint, build, or security workflows

**Tekton/Konflux Pipelines (2 pipelines)**:
- `vllm-cpu-pull-request.yaml` — Multi-arch build (s390x, ppc64le) triggered by `/build-konflux` comment
  - Uses `Dockerfile.konflux.cpu`
  - `skip-checks: true` — disables all quality gates
  - `hermetic: false` — allows network access during build
  - 8-hour timeout
- `odh-vllm-cpu-v3-5-ea-1-push.yaml` — Push pipeline for rhoai-3.5-ea.1 branch
  - Builds source images
  - Multi-arch (s390x, ppc64le)
  - Uses operator nudging

**Key CI/CD Gaps**:
- No workflow runs tests on PRs
- No workflow runs linters on PRs (despite comprehensive pre-commit setup)
- No workflow builds Docker images on PRs (besides manual Konflux trigger)
- No workflow runs security scans

### Test Coverage

**Test Infrastructure**:
- **Framework**: pytest with extensive configuration in `pyproject.toml`
- **Test files**: 852 Python test files
- **Test LoC**: ~255,000 lines
- **Test-to-code ratio**: 0.46 (255K test / 555K source) — good
- **Conftest files**: 27 conftest.py files providing fixtures at various levels
- **Test markers**: `slow_test`, `cpu_model`, `cpu_test`, `distributed`, `split`, `optional`

**Test Categories**:
| Category | Files | Description |
|----------|-------|-------------|
| v1/ | 150 | New engine architecture tests (workers, samplers, spec decode, etc.) |
| kernels/ | 147 | GPU/CPU kernel correctness tests |
| entrypoints/ | 133 | API server, CLI, OpenAI compat tests |
| models/ | 122 | Model loading and inference correctness |
| v1/e2e/ | 13 | End-to-end tests (cascade attention, sliding window, etc.) |
| distributed/ | 10+ | Multi-GPU/node tests |
| basic_correctness/ | 4 | Core correctness validation |

**Test Dependencies** (`requirements/test.in`):
- pytest, pytest-asyncio, pytest-forked, pytest-rerunfailures, pytest-shard, pytest-timeout, pytest-cov
- Ray for distributed testing
- Model-specific deps (transformers, torch, torchaudio, torchvision)
- lm-eval for model evaluation benchmarks

**Coverage Configuration**:
- `.coveragerc` properly configured with source paths, omit patterns, and exclusion lines
- `codecov.yml` has path mapping fixes but no thresholds
- `pytest-cov` is in test dependencies
- No `fail_under` enforcement

### Code Quality

**Pre-commit Hooks (18 hooks)** — Excellent:
| Hook | Purpose |
|------|---------|
| ruff-check | Python linting (pycodestyle, Pyflakes, pyupgrade, bugbear, isort) |
| ruff-format | Python formatting |
| typos | Spell checking |
| isort | Import sorting |
| clang-format | C/C++/CUDA formatting |
| markdownlint-cli2 | Markdown linting |
| actionlint | GitHub Actions YAML validation |
| mypy (3.10-3.13) | Static type checking for multiple Python versions |
| shellcheck | Shell script linting |
| pip-compile | Dependency lockfile management |
| signoff-commit | DCO sign-off enforcement |
| check-spdx-header | License header enforcement |
| check-root-lazy-imports | Import pattern enforcement |
| check-filenames | No spaces in filenames |
| check-forbidden-imports | Restricted import enforcement |
| check-torch-cuda | Prevent torch.cuda API usage (CPU fork) |
| validate-config | Configuration validation |
| validate-docker-versions | Docker version consistency |

**Ruff Configuration** (pyproject.toml):
- 7 rule categories enabled (E, F, UP, B, ISC, SIM, I, G)
- Docstring code formatting enabled
- Third-party code excluded

**Mypy Configuration**:
- Multi-version checking (3.10, 3.11, 3.12, 3.13)
- Pydantic plugin enabled
- `check_untyped_defs = true`
- Local runs for lowest Python version, CI for all versions

### Container Images

**Dockerfiles (8 variants)**:

| File | Purpose | Base |
|------|---------|------|
| Dockerfile.cpu.ubi | CPU build with UBI base | ubi9/ubi-minimal |
| Dockerfile.konflux.cpu | Konflux CPU build (s390x/ppc64le) | ubi9/ubi-minimal |
| Dockerfile.ubi | CUDA build | ubi9/ubi-minimal |
| Dockerfile.rocm.ubi | ROCm/AMD GPU build | ubi9/ubi-minimal |
| Dockerfile.hpu.ubi | Habana HPU build | ubi9/ubi-minimal |
| Dockerfile.tpu.ubi | TPU build | ubi9/ubi-minimal |
| Dockerfile.s390x.ubi | s390x build | ubi9/ubi-minimal |
| Dockerfile.ppc64le.ubi | ppc64le build | ubi9/ubi-minimal |

**Image Build Practices**:
- Multi-stage builds (builder + runtime)
- UBI minimal base images (Red Hat compliance)
- Non-root user (UID 2000, GID 0 for OpenShift)
- UV for dependency management with caching
- Multi-architecture support (amd64, s390x, ppc64le)
- Tiktoken tokenizer pre-download for disconnected environments
- Docker Bake for build orchestration

**Image Gaps**:
- No runtime validation (no health check endpoint tested)
- No image startup test
- No vulnerability scanning on built images (Clair disabled)
- No SBOM generation configured
- No image signing/attestation

### Security

**Present**:
- SECURITY.md with vulnerability reporting process and threat model
- Pre-commit hooks for code quality (indirect security benefits)
- Non-root container users
- DCO sign-off enforcement

**Missing**:
- No SAST (CodeQL, Semgrep, gosec)
- No dependency scanning (Dependabot, Snyk, pip-audit)
- No container scanning (Trivy, Clair — disabled)
- No secret detection (Gitleaks, TruffleHog)
- No SBOM generation
- No image signing

### Agent Rules (Agentic Flow Quality)

**Status**: Present but incomplete

**AGENTS.md** (strong):
- Contribution policy (duplicate-work checks, no busywork PRs, accountability)
- Fail-closed behavior for AI agents
- Development workflow (uv, pre-commit, testing commands)
- Commit attribution guidelines
- Domain-specific guide references

**CLAUDE.md**: References AGENTS.md via `@AGENTS.md` directive

**Gaps**:
- No `.claude/` directory or `.claude/rules/`
- No structured test creation rules for different test types
- No test pattern documentation (how to write kernel tests, model tests, e2e tests)
- Agent guidelines focus on contribution policy, not technical test patterns
- No quality checklists for AI-generated tests

## Recommendations

### Priority 0 (Critical)

1. **Create GitHub Actions CI workflow for CPU tests**
   - Run `pytest -m "cpu_test or cpu_model"` on every PR
   - Include pre-commit hooks (`pre-commit run --all-files`)
   - Run on `ubuntu-latest` with Python 3.12
   - Estimated effort: 8-16 hours (including test environment setup)

2. **Enable Clair scanning in Tekton PR pipeline**
   - Change `skip-checks: "true"` to `"false"` in `.tekton/vllm-cpu-pull-request.yaml`
   - This enables both `ecosystem-cert-preflight-checks` and `clair-scan`
   - Estimated effort: 1-2 hours

3. **Add container startup smoke test to Konflux pipeline**
   - After image build, run container with `--help` or health check endpoint
   - Validate that `python -m vllm.entrypoints.openai.api_server --help` exits cleanly
   - Estimated effort: 4-6 hours

### Priority 1 (High Value)

4. **Add codecov coverage thresholds and PR enforcement**
   - Configure patch coverage minimum (e.g., 70%)
   - Add project coverage target (auto with 1% threshold)
   - Require codecov status check to pass before merge
   - Estimated effort: 2-4 hours

5. **Switch Konflux PR pipeline to automatic trigger**
   - Remove `on-comment` trigger, add `on-event: pull_request`
   - Ensures every PR gets a Konflux build validation
   - Estimated effort: 1-2 hours

6. **Add SAST workflow (CodeQL or Semgrep)**
   - Python and C/C++ analysis
   - Run on PRs and weekly schedule
   - Estimated effort: 2-4 hours

7. **Generate .claude/rules/ for test automation**
   - Create rules for unit tests, kernel tests, model tests, e2e tests
   - Include patterns, examples, and quality checklists
   - Use `/test-rules-generator` skill
   - Estimated effort: 2-3 hours

### Priority 2 (Nice-to-Have)

8. **Add image runtime functional tests**
   - Spin up container, send health check and simple inference request
   - Use testcontainers-python or similar framework
   - Estimated effort: 8-12 hours

9. **Add dependency scanning**
   - Configure Dependabot or pip-audit for Python dependencies
   - Monitor requirements/*.txt and pyproject.toml
   - Estimated effort: 2-3 hours

10. **Add performance regression benchmarks**
    - Track CPU inference latency for reference models
    - Compare against baseline on each PR
    - Estimated effort: 16-24 hours

## Comparison to Gold Standards

| Dimension | vllm-cpu | odh-dashboard | notebooks | kserve |
|-----------|----------|---------------|-----------|--------|
| Unit Tests | 7.5 (extensive suite, no CI run) | 9.0 (Jest + CI) | 7.0 | 8.5 |
| Integration/E2E | 6.0 (13 e2e, no CI) | 9.0 (Cypress + CI) | 7.0 | 9.0 |
| Build Integration | 3.0 (manual Konflux) | 7.0 | 8.0 | 7.5 |
| Image Testing | 3.5 (no runtime tests) | 6.0 | 9.0 (5-layer) | 7.0 |
| Coverage Tracking | 5.0 (config, no enforcement) | 8.0 (enforced) | 5.0 | 9.0 |
| CI/CD Automation | 3.5 (1 bot workflow) | 9.0 | 8.0 | 9.0 |
| Agent Rules | 7.0 (AGENTS.md, no rules/) | 8.0 | 3.0 | 3.0 |
| **Overall** | **5.6** | **8.0** | **6.7** | **7.6** |

**Key Takeaway**: vllm-cpu has strong upstream test assets and excellent code quality tooling (pre-commit), but the fork lacks CI automation to actually *run* those assets. The biggest lift-for-impact improvement is adding a GitHub Actions workflow to execute CPU tests on PRs.

## File Paths Reference

### CI/CD
- `.github/workflows/new_pr_bot.yml` — PR description bot (only GH Actions workflow)
- `.tekton/vllm-cpu-pull-request.yaml` — Konflux PR build pipeline
- `.tekton/odh-vllm-cpu-v3-5-ea-1-push.yaml` — Konflux push pipeline
- `docker-bake.hcl` — Docker Bake build orchestration

### Testing
- `tests/` — 852 test files, 255K LoC
- `tests/v1/e2e/` — 13 end-to-end tests
- `tests/kernels/` — 147 kernel tests
- `tests/models/` — 122 model tests
- `tests/entrypoints/` — 133 API/CLI tests
- `tests/conftest.py` — Root test fixtures
- `requirements/test.in` — Test dependencies
- `pyproject.toml` — pytest markers and configuration

### Code Quality
- `.pre-commit-config.yaml` — 18 hooks (ruff, mypy, clang-format, shellcheck, etc.)
- `pyproject.toml` — Ruff lint/format config, mypy config
- `.clang-format` — C/C++ formatting (Google style)
- `.shellcheckrc` — Shell script linting config
- `.markdownlint.yaml` — Markdown linting config
- `.yapfignore` — YAPF ignore patterns
- `tools/pre_commit/` — 12 custom pre-commit scripts

### Container Images
- `Dockerfile.cpu.ubi` — CPU build for UBI
- `Dockerfile.konflux.cpu` — Konflux CPU build (multi-arch)
- `Dockerfile.ubi` — CUDA build
- `Dockerfile.rocm.ubi`, `Dockerfile.hpu.ubi`, `Dockerfile.tpu.ubi` — Accelerator builds
- `Dockerfile.s390x.ubi`, `Dockerfile.ppc64le.ubi` — Architecture-specific builds
- `docker/` — Upstream Docker configs (9 files)

### Coverage
- `codecov.yml` — Codecov configuration (no thresholds)
- `.coveragerc` — Coverage.py configuration

### Security
- `SECURITY.md` — Vulnerability reporting policy

### Agent Rules
- `AGENTS.md` — AI agent contribution policy and dev workflow
- `CLAUDE.md` — References AGENTS.md
