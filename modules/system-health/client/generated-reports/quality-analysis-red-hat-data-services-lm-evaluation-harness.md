---
repository: "red-hat-data-services/lm-evaluation-harness"
overall_score: 4.5
scorecard:
  - dimension: "Unit Tests"
    score: 5.5
    status: "Decent test count (104 test functions across 23 files) but no coverage enforcement, linter job disabled in CI"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "Evaluator integration tests exist but external model tests and task-change tests disabled; no E2E pipeline"
  - dimension: "Build Integration"
    score: 5.0
    status: "Tekton/Konflux pipelines for multi-arch builds with Clair scan and preflight checks; but PR builds are comment/label-triggered, not automatic"
  - dimension: "Image Testing"
    score: 3.5
    status: "Multi-stage Dockerfiles with multi-arch support (x86, ARM, ppc64le, s390x) but no runtime validation or startup tests"
  - dimension: "Coverage Tracking"
    score: 1.5
    status: ".coveragerc exists but coverage is never generated in CI; no codecov, no thresholds, no PR reporting"
  - dimension: "CI/CD Automation"
    score: 4.5
    status: "GitHub Actions for unit tests on PR, PyPI publish on tag, but linter disabled, model tests disabled, no concurrency control"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude directory, no agent rules or test automation guidance"
critical_gaps:
  - title: "Linter job disabled in CI"
    impact: "Code quality regressions go undetected — pre-commit hooks (ruff, codespell) exist but never run in CI"
    severity: "HIGH"
    effort: "1 hour"
  - title: "No coverage tracking in CI"
    impact: "Test coverage can silently degrade; .coveragerc config exists but is unused"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "External model tests disabled"
    impact: "Model integration regressions (vLLM, GGUF, OpenVINO, NeuralMagic, SGLang) go undetected"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No security scanning in GitHub workflows"
    impact: "Vulnerabilities in Python dependencies and source code not detected pre-merge; Clair only runs in Konflux"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container runtime validation"
    impact: "Multi-arch images built but never validated at startup — import errors or missing deps discovered only at deployment"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "Konflux PR builds not automatic"
    impact: "Konflux builds require /build-konflux comment or label — build issues not caught until post-merge"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Re-enable linter job in CI"
    effort: "1 hour"
    impact: "Enforce ruff, codespell, and pre-commit checks on every PR automatically"
  - title: "Add pytest-cov and codecov to unit test workflow"
    effort: "2-3 hours"
    impact: "Track test coverage trends, set minimum thresholds, report on PRs"
  - title: "Add Trivy or Snyk scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Catch dependency vulnerabilities before merge, not just in Konflux post-merge"
  - title: "Add concurrency control to GitHub workflows"
    effort: "30 minutes"
    impact: "Cancel redundant CI runs on force-pushes, saving CI minutes"
  - title: "Create basic CLAUDE.md with test patterns"
    effort: "2-3 hours"
    impact: "Guide AI-assisted test generation to follow existing pytest patterns"
recommendations:
  priority_0:
    - "Re-enable the linter job (remove `if: false`) and fix any pre-commit failures"
    - "Add coverage generation (pytest-cov) and codecov integration to the unit test workflow"
    - "Add dependency vulnerability scanning (Trivy/Snyk/pip-audit) to PR workflow"
  priority_1:
    - "Re-enable or restructure model integration tests with proper GPU/resource conditionals"
    - "Add container startup validation tests (python -c 'import lm_eval') for each architecture"
    - "Make Konflux PR builds automatic (remove comment/label trigger requirement)"
    - "Add mypy type checking to CI (currently disabled and config ignores all errors)"
  priority_2:
    - "Create comprehensive agent rules (.claude/rules/) for test automation patterns"
    - "Add performance regression tests for evaluator throughput"
    - "Add API contract tests for task YAML schema validation"
    - "Set up Dependabot/Renovate for automated dependency updates"
---

# Quality Analysis: lm-evaluation-harness

## Executive Summary

- **Overall Score: 4.5/10**
- **Repository Type**: Python library/framework for language model evaluation (fork of EleutherAI/lm-evaluation-harness, maintained by Red Hat Data Services)
- **Primary Language**: Python 3.11
- **Framework**: pytest, PyTorch, HuggingFace Transformers
- **Key Strengths**: Multi-architecture container builds (x86, ARM, ppc64le, s390x), Tekton/Konflux integration with Clair scanning, well-structured pre-commit config with ruff/codespell
- **Critical Gaps**: Linter disabled in CI, no coverage tracking, no security scanning in GitHub workflows, model integration tests disabled, no agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, no .claude directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 5.5/10 | 104 test functions, 23 test files, but linter disabled, no coverage enforcement |
| Integration/E2E | 3.0/10 | Model tests and task-change tests disabled; no E2E pipeline |
| **Build Integration** | **5.0/10** | **Tekton/Konflux multi-arch builds with Clair scan, but PR builds not automatic** |
| Image Testing | 3.5/10 | Multi-stage Dockerfiles, multi-arch support, but no runtime validation |
| Coverage Tracking | 1.5/10 | .coveragerc exists but unused; no CI coverage generation or reporting |
| CI/CD Automation | 4.5/10 | Unit tests on PR, PyPI publish, but linter disabled, no concurrency |
| Agent Rules | 0.0/10 | No agent rules, no CLAUDE.md, no test automation guidance |

## Critical Gaps

### 1. Linter Job Disabled in CI
- **Impact**: The `unit_tests.yml` workflow has `if: false` on the linter job (line 19). Pre-commit hooks (ruff, codespell, detect-private-key) are configured but never enforced in CI.
- **Severity**: HIGH
- **Effort**: 1 hour
- **Evidence**: `.github/workflows/unit_tests.yml:19` — `if: false  # Disabled`

### 2. No Coverage Tracking in CI
- **Impact**: `.coveragerc` exists with exclusion rules, and `pytest-cov` is in dev dependencies, but coverage is never generated, reported, or enforced in any workflow.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Evidence**: No `--cov` flag in pytest commands, no codecov action in workflows

### 3. External Model Tests Disabled
- **Impact**: The `testmodels` job is disabled (`if: false` at line 74). Tests for vLLM, GGUF, GPTQModel, NeuralMagic, OpenVINO, SGLang, and HF Steered models never run in CI (38 test functions).
- **Severity**: HIGH
- **Effort**: 4-8 hours (need GPU/resource strategy)
- **Evidence**: `.github/workflows/unit_tests.yml:74` — `if: false  # Disabled`

### 4. No Security Scanning in GitHub Workflows
- **Impact**: No Trivy, Snyk, CodeQL, Semgrep, Dependabot, or pip-audit integration. Clair scanning exists but only in the Konflux pipeline (RHOAI tenant), not in the GitHub PR workflow.
- **Severity**: HIGH
- **Effort**: 2-4 hours

### 5. No Container Runtime Validation
- **Impact**: Multi-architecture images are built (x86, ARM, ppc64le, s390x) with complex multi-stage Dockerfiles (5 stages, PyTorch/Arrow from source on non-x86) but never validated post-build. Import errors or missing dependencies on specific architectures would only surface at deployment.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours

### 6. Konflux PR Builds Not Automatic
- **Impact**: The RHOAI Tekton pull-request pipeline (`odh-ta-lmes-job-pull-request.yaml`) triggers only on `/build-konflux` comment or `kfbuild-*` labels, not automatically on PR. Build failures may only be discovered post-merge.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours

## Quick Wins

### 1. Re-enable Linter Job (1 hour)
Remove `if: false` from the `linter` job in `unit_tests.yml`:
```yaml
# Before:
linter:
  if: false  # Disabled
# After:
linter:
  name: Linters
```

### 2. Add Coverage to CI (2-3 hours)
Add coverage generation and reporting to the test step:
```yaml
- name: Test with pytest
  run: python -m pytest --cov=lm_eval --cov-report=xml --showlocals -s -vv -n=auto
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: coverage.xml
    fail_ci_if_error: false
```

### 3. Add Trivy Scanning (1-2 hours)
Add a dependency vulnerability scanning step:
```yaml
- name: Pip audit
  run: |
    pip install pip-audit
    pip-audit --fix --dry-run
```

### 4. Add Concurrency Control (30 minutes)
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 5. Create CLAUDE.md (2-3 hours)
Establish basic agent rules for test patterns, pytest conventions, and model test structure.

## Detailed Findings

### CI/CD Pipeline

**Workflows**: 3 GitHub Actions workflows + 3 Tekton PipelineRuns

| Workflow | Trigger | Status |
|----------|---------|--------|
| `unit_tests.yml` - Linters | PR to main/release-* | **DISABLED** (`if: false`) |
| `unit_tests.yml` - CPU Tests | PR to main/release-* | Active — pytest with xdist parallelism |
| `unit_tests.yml` - External LM Tests | PR to main/release-* | **DISABLED** (`if: false`) |
| `new_tasks.yml` - Changed Tasks | PR to main | **DISABLED** (`if: false`) |
| `publish.yml` | Tag push | Active — PyPI publish |
| `ta-lmes-job-pull-request.yaml` (Tekton/ODH) | PR to stable | Active — multi-arch build |
| `ta-lmes-job-push.yaml` (Tekton/ODH) | Push to stable | Active — multi-arch build |
| `odh-ta-lmes-job-pull-request.yaml` (Tekton/RHOAI) | Comment/label on PR | Active — multi-arch build with Clair |

**Strengths**:
- CPU tests use `pytest-xdist` for parallel execution (`-n=auto`)
- Pip caching configured via `setup-python` action
- PyPI publishing uses trusted publishing (OIDC)
- Tekton pipelines synchronized from `konflux-central` (centralized pipeline management)

**Weaknesses**:
- 3 out of 4 test/lint jobs disabled
- No concurrency control — redundant runs not cancelled
- Single Python version tested (3.11 only, despite `requires-python = ">=3.11,<3.13"`)
- No workflow for running tests on Python 3.12
- Test timeout set to 30 minutes but no timeout on individual tests

### Test Coverage

**Test Files**: 23 test files (14 core + 9 model-specific)
**Test Functions**: 104 total (66 core + 38 model-specific)
**Test Lines**: 2,990 lines of test code
**Source Lines (core)**: ~16,867 lines (excluding task YAML utils)
**Test-to-Code Ratio**: ~0.18 (low — target is 0.5+)

| Test Area | File | Functions | Status |
|-----------|------|-----------|--------|
| Evaluator | `test_evaluator.py` | 2 | Active |
| CLI | `test_cli.py` | 2 | Active |
| Utils | `test_utils.py` | 13 | Active |
| Tasks | `test_tasks.py` | 17 | Active |
| Janitor/Decontamination | `test_janitor.py` | 12 | Active |
| Prompt | `test_prompt.py` | 1 | Active |
| Task Manager | `test_task_manager.py` | 1 | Active |
| Adapter Offline Inference | `test_adapter_offline_inference.py` | 7 | Active |
| EvalHub Error Sanitize | `test_evalhub_error_sanitize.py` | 3 | Active |
| Include Path | `test_include_path.py` | 3 | Active |
| Job Spec Parameters | `test_job_spec_parameters_path.py` | 6 | Active |
| Misc | `test_misc.py` | 1 | Active |
| Requests Caching | `test_requests_caching.py` | 0 (class) | Active |
| HuggingFace models | `test_huggingface.py` | 7 | **DISABLED in CI** |
| vLLM | `test_vllm.py` | 3 | **DISABLED in CI** |
| API models | `test_api.py` | 5 | **DISABLED in CI** |
| GGUF | `test_gguf.py` | 3 | **DISABLED in CI** |
| SGLang | `test_sglang.py` | 6 | **DISABLED in CI** |
| HF Steered | `test_hf_steered.py` | 8 | **DISABLED in CI** |
| OpenVINO | `test_openvino.py` | 2 | **DISABLED in CI** |
| NeuralMagic | `test_neuralmagic.py` | 2 | **DISABLED in CI** |
| GPTQModel | `test_gptqmodel.py` | 1 | **DISABLED in CI** |

**Notable gaps**: No tests for `lm_eval/loggers/`, `lm_eval/filters/`, `lm_eval/caching/`, `lm_eval/api/metrics.py`, or `lm_eval/api/samplers.py`.

### Code Quality

**Configured Tools**:
- **Ruff**: Configured in `pyproject.toml` for linting + import sorting
- **Ruff Format**: Configured in `.pre-commit-config.yaml`
- **Flake8**: `.flake8` config (legacy — ruff should supersede)
- **Codespell**: Spell checking in pre-commit
- **Mypy**: `mypy.ini` exists but ignores ALL errors in all modules (`ignore_errors = True` everywhere)
- **Pre-commit hooks**: Comprehensive set (15+ hooks) including `detect-private-key`

**Issues**:
- Pre-commit linter job is disabled in CI — hooks only enforced locally if developers install them
- Mypy config is set to Python 3.8 (line 2 of `mypy.ini`) but project requires Python >=3.11
- Mypy ignores errors in every module, making it effectively a no-op
- Dual linter configs (flake8 + ruff) — flake8 is redundant

### Container Images

**Dockerfiles**: 2 files
- `Dockerfile.lmes-job`: Standard multi-stage build (5 stages)
- `Dockerfile.konflux.lmes-job`: Konflux-specific variant with RHOAI labels and improved version pinning

**Architecture Support**: x86_64, ARM64, ppc64le, s390x

**Build Stages**:
1. Base builder with common tooling (UBI9/Python 3.11)
2. Apache Arrow build from source (ppc64le, s390x)
3. PyTorch build from source (ppc64le, s390x)
4. OpenBLAS build (ppc64le)
5. Final image assembly

**Strengths**:
- Multi-architecture support with architecture-conditional builds
- UBI9 base images (Red Hat certified)
- Proper license copying
- Non-root user (65532:65532) for runtime
- `.dockerignore` configured
- Konflux variant reads versions from `requirements.txt` dynamically

**Weaknesses**:
- No `HEALTHCHECK` instruction
- No runtime validation (e.g., `RUN python -c "import lm_eval"`)
- Standard Dockerfile hardcodes versions (TORCH_VERSION=2.6.0, PYARROW_VERSION=20.0.0) while Konflux variant reads from requirements.txt
- No image size optimization analysis
- skopeo installed but unclear if used

### Security

**In Tekton/Konflux**:
- Clair scan configured in RHOAI pull-request pipeline with dedicated resources (2 CPU, 10Gi memory)
- Ecosystem cert preflight checks in RHOAI pipeline
- Secret management via git-auth secrets

**Missing from GitHub CI**:
- No CodeQL or Semgrep SAST analysis
- No dependency vulnerability scanning (pip-audit, Safety, Snyk)
- No Dependabot or Renovate for automated dependency updates
- No secret scanning (beyond pre-commit `detect-private-key`)
- No SBOM generation
- No image signing/attestation in GitHub workflows

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: All test types lack agent rules; no patterns, examples, or checklists for AI-assisted test generation
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - Unit test patterns (pytest parametrize, fixtures, mocking)
  - Model integration test patterns
  - Task YAML validation patterns
  - Evaluator test patterns

## Recommendations

### Priority 0 (Critical)

1. **Re-enable linter job in CI** — Remove `if: false` from the linter job. Fix any pre-commit failures that surface. This is the single highest-ROI change (1 hour effort).

2. **Add coverage tracking** — Add `--cov=lm_eval --cov-report=xml` to pytest, integrate codecov, set a baseline threshold (even 30% to start).

3. **Add dependency vulnerability scanning** — Add `pip-audit` or Trivy scanning to the PR workflow to catch CVEs before merge.

### Priority 1 (High Value)

4. **Re-enable model tests with resource conditionals** — Use pytest markers (`@pytest.mark.gpu`, `@pytest.mark.slow`) and separate CI jobs with appropriate runners for GPU-dependent tests.

5. **Add container startup validation** — Add a simple `RUN python -c "import lm_eval; print('OK')"` to Dockerfiles and/or a post-build test step in Tekton.

6. **Make Konflux PR builds automatic** — Change RHOAI Tekton pipeline from comment/label trigger to automatic on PR for earlier feedback.

7. **Fix mypy configuration** — Update `python_version` from 3.8 to 3.11, gradually remove `ignore_errors = True` from modules starting with `lm_eval/api/`.

### Priority 2 (Nice-to-Have)

8. **Create agent rules** (`.claude/rules/`) for unit test patterns, model test patterns, and task YAML validation.

9. **Add Python 3.12 to test matrix** — The project supports 3.11-3.12 but only tests on 3.11.

10. **Set up Dependabot/Renovate** — Automate dependency updates with security alerts.

11. **Add task YAML schema validation tests** — With 6,586 task YAML files, schema validation would catch configuration errors early.

12. **Clean up redundant configs** — Remove `.flake8` (superseded by ruff), update mypy Python version.

## Comparison to Gold Standards

| Dimension | lm-evaluation-harness | odh-dashboard | notebooks | kserve |
|-----------|----------------------|---------------|-----------|--------|
| Unit Tests | 5.5 — Tests exist, low ratio | 9.0 — Comprehensive | 7.0 — Image-focused | 9.0 — High coverage |
| Integration/E2E | 3.0 — Mostly disabled | 9.0 — Contract + E2E | 8.0 — Multi-layer | 9.0 — Multi-version |
| Build Integration | 5.0 — Tekton exists, not auto | 8.0 — Automated | 9.0 — 5-layer | 8.0 — Automated |
| Image Testing | 3.5 — Build only, no validation | 7.0 — Build + deploy | 10.0 — Gold standard | 8.0 — Build + test |
| Coverage Tracking | 1.5 — Config only | 9.0 — Enforced | 6.0 — Partial | 9.0 — Thresholds |
| CI/CD Automation | 4.5 — Mostly disabled | 9.0 — Comprehensive | 8.0 — Well-organized | 9.0 — Full pipeline |
| Agent Rules | 0.0 — None | 8.0 — Comprehensive | 3.0 — Basic | 2.0 — Minimal |

## File Paths Reference

| Category | Path | Notes |
|----------|------|-------|
| CI/CD | `.github/workflows/unit_tests.yml` | Main test workflow (2/4 jobs disabled) |
| CI/CD | `.github/workflows/publish.yml` | PyPI publishing |
| CI/CD | `.github/workflows/new_tasks.yml` | Task change detection (disabled) |
| Tekton | `.tekton/ta-lmes-job-pull-request.yaml` | ODH PR build |
| Tekton | `.tekton/ta-lmes-job-push.yaml` | ODH push build |
| Tekton | `.tekton/odh-ta-lmes-job-pull-request.yaml` | RHOAI PR build with Clair |
| Dockerfile | `Dockerfile.lmes-job` | Standard multi-arch build |
| Dockerfile | `Dockerfile.konflux.lmes-job` | Konflux-specific variant |
| Config | `pyproject.toml` | Project metadata, deps, ruff config |
| Config | `.pre-commit-config.yaml` | 15+ hooks including ruff, codespell |
| Config | `.coveragerc` | Coverage config (unused in CI) |
| Config | `.flake8` | Legacy linter (redundant with ruff) |
| Config | `mypy.ini` | Type checking (all errors ignored) |
| Tests | `tests/` | 14 core test files |
| Tests | `tests/models/` | 9 model integration test files |
| Source | `lm_eval/` | Core library (~16,867 lines) |
| Tasks | `lm_eval/tasks/` | 6,586 task YAML definitions |
