---
repository: "pytorch/pytorch"
overall_score: 8.9
scorecard:
  - dimension: "Unit Tests"
    score: 9.5
    status: "Massive test suite with 1,700+ Python test files, 460+ test methods in test_torch.py alone, property-based testing with Hypothesis, parametrized tests across 321 files"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Comprehensive distributed testing (320 files), multi-GPU/multi-node tests, inductor tests (192 files), export tests, cross-platform CI across Linux/macOS/Windows/ROCm/XPU"
  - dimension: "Build Integration"
    score: 8.5
    status: "PR-triggered builds across multiple platforms, Docker CI images content-hashed for rebuild, LLM-powered target determination for test selection"
  - dimension: "Image Testing"
    score: 7.5
    status: "Extensive CI Docker images (40+ variants), content-hash-based rebuild triggers, but no explicit container runtime validation or SBOM generation"
  - dimension: "Coverage Tracking"
    score: 6.0
    status: "Coverage infrastructure exists (.coveragerc with JIT plugin) but no codecov enforcement, no PR coverage gates, no coverage trend tracking"
  - dimension: "CI/CD Automation"
    score: 9.5
    status: "143 GitHub Actions workflows, concurrency control, test sharding, target determination via LLM, retryBot, extensive platform matrix"
  - dimension: "Agent Rules"
    score: 9.0
    status: "Comprehensive CLAUDE.md and AGENTS.md, 15 custom Claude skills, dedicated PR review skill, issue triage automation, but no .claude/rules/ directory for test patterns"
critical_gaps:
  - title: "No coverage enforcement or PR coverage gates"
    impact: "Test coverage regressions can be merged without detection; no minimum threshold enforced"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No container vulnerability scanning (Trivy/Snyk)"
    impact: "40+ CI Docker images not scanned for CVEs; supply chain risk for the most widely-used ML framework"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "OSSF Scorecard workflow disabled (if: false)"
    impact: "Supply chain security scoring not running; no visibility into security posture trends"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No SAST/CodeQL integration for Python/C++ code"
    impact: "Static security analysis not automated; relies on manual review for security-sensitive code"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No .claude/rules/ directory for test creation patterns"
    impact: "AI-generated tests may not follow PyTorch conventions consistently despite excellent CLAUDE.md guidance"
    severity: "LOW"
    effort: "2-4 hours"
quick_wins:
  - title: "Re-enable OSSF Scorecard workflow"
    effort: "30 minutes"
    impact: "Restore supply chain security visibility and badge; simply change 'if: false' to 'if: github.repository == pytorch/pytorch'"
  - title: "Add Codecov integration to PR workflow"
    effort: "4-6 hours"
    impact: "Enable coverage tracking and PR-level coverage diff reporting"
  - title: "Add Trivy scanning to Docker build workflow"
    effort: "2-4 hours"
    impact: "Catch CVEs in CI Docker images before they reach CI runners"
  - title: "Create .claude/rules/ for test patterns"
    effort: "2-3 hours"
    impact: "Codify PyTorch test conventions (TestCase, run_tests, device-generic tests) for AI agents"
recommendations:
  priority_0:
    - "Add Codecov/Coveralls integration with PR-level coverage reporting and minimum thresholds"
    - "Enable container vulnerability scanning (Trivy) for all 40+ CI Docker image builds"
    - "Re-enable the OSSF Scorecard workflow for supply chain security monitoring"
  priority_1:
    - "Add CodeQL or Semgrep SAST scanning for Python and C++ code paths"
    - "Implement secret detection (Gitleaks) in the lint workflow"
    - "Create .claude/rules/ directory with test creation rules (unit-tests.md, distributed-tests.md, inductor-tests.md)"
    - "Add SBOM generation for release Docker images and wheel artifacts"
  priority_2:
    - "Add dependency scanning for supply chain risk in third_party/ and pip dependencies"
    - "Implement container image signing with Sigstore/cosign for release images"
    - "Add pre-commit hooks configuration (.pre-commit-config.yaml) as an alternative to lintrunner for external contributors"
---

# Quality Analysis: PyTorch (pytorch/pytorch)

## Executive Summary

- **Overall Score: 8.9/10**
- **Repository Type**: ML Framework Library (Python/C++/CUDA)
- **Primary Languages**: Python (2,340 files), C++/CUDA (1,934+ files)
- **Key Strengths**: World-class test infrastructure with 1,700+ test files, 143 CI workflows, LLM-powered test target determination, comprehensive multi-platform coverage (Linux/macOS/Windows, CUDA/ROCm/XPU/MPS), and outstanding AI agent integration with 15 custom Claude skills
- **Critical Gaps**: Missing coverage enforcement gates, no container vulnerability scanning, disabled OSSF Scorecard, no SAST automation
- **Agent Rules Status**: Excellent CLAUDE.md/AGENTS.md documentation; 15 skills present; no `.claude/rules/` test pattern directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 9.5/10 | Massive suite: 1,700+ Python test files, Hypothesis property-based testing, device-generic test patterns |
| Integration/E2E | 9.0/10 | 320 distributed test files, multi-GPU/multi-node, cross-platform CI matrix |
| **Build Integration** | **8.5/10** | **PR builds across platforms, Docker content-hash rebuild, LLM target determination** |
| Image Testing | 7.5/10 | 40+ CI Docker variants, content-hash triggers, but no runtime validation or SBOM |
| Coverage Tracking | 6.0/10 | .coveragerc exists with JIT plugin, but no enforcement, gates, or trend tracking |
| CI/CD Automation | 9.5/10 | 143 workflows, concurrency control, test sharding, retryBot, schedule-driven nightly |
| Agent Rules | 9.0/10 | Comprehensive CLAUDE.md, 15 custom skills, PR review automation, but no .claude/rules/ |

## Critical Gaps

### 1. No Coverage Enforcement or PR Coverage Gates
- **Impact**: Test coverage regressions can be merged without detection; no minimum threshold enforced
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: While `.coveragerc` exists with a JIT coverage plugin, there is no Codecov/Coveralls integration, no PR-level coverage reporting, and no minimum coverage thresholds. For the world's most widely-used ML framework, this is a significant gap.

### 2. No Container Vulnerability Scanning
- **Impact**: 40+ CI Docker images are not scanned for CVEs before being used by thousands of CI jobs daily
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The `docker-builds.yml` workflow builds dozens of image variants (CUDA, ROCm, XPU, multiple Python/GCC versions) but no Trivy, Snyk, or Grype scanning step exists. Given PyTorch's supply chain significance, this is critical.

### 3. OSSF Scorecard Workflow Disabled
- **Impact**: Supply chain security scoring not running; no visibility into security posture trends
- **Severity**: MEDIUM
- **Effort**: 1-2 hours (literally change `if: false` to `if: github.repository == 'pytorch/pytorch'`)
- **Details**: The `scorecards.yml` workflow exists but has `if: false` on the job, effectively disabling it. This was likely intentional but leaves a gap in supply chain security visibility.

### 4. No SAST/CodeQL for Python/C++ Code
- **Impact**: No automated static security analysis; security-sensitive code (serialization, network protocols, JIT compilation) relies entirely on manual review
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: No CodeQL, Semgrep, or Bandit integration found in any workflow. For a project with JIT compilation, deserialization of untrusted models, and network-facing distributed training components, this is notable.

### 5. No `.claude/rules/` Test Pattern Directory
- **Impact**: While CLAUDE.md has excellent testing guidance, structured rules for AI test generation are missing
- **Severity**: LOW
- **Effort**: 2-4 hours
- **Details**: The project has outstanding CLAUDE.md guidance (TestCase import, run_tests, parametrize, device-generic tests) but these aren't codified as `.claude/rules/` files that could enforce patterns systematically.

## Quick Wins

### 1. Re-enable OSSF Scorecard (30 minutes)
Change `if: false` to `if: github.repository == 'pytorch/pytorch'` in `.github/workflows/scorecards.yml`.

### 2. Add Codecov Integration (4-6 hours)
```yaml
# Add to test workflow steps
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage.xml
    fail_ci_if_error: false
```

### 3. Add Trivy to Docker Build (2-4 hours)
```yaml
# Add after docker build step
- name: Scan image
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.IMAGE }}
    severity: CRITICAL,HIGH
    exit-code: 1
```

### 4. Create `.claude/rules/` Test Patterns (2-3 hours)
Extract existing CLAUDE.md test guidance into structured rules files for consistent AI-generated tests.

## Detailed Findings

### CI/CD Pipeline

**Rating: 9.5/10 - Industry-Leading**

PyTorch's CI/CD infrastructure is one of the most sophisticated in open source:

- **143 GitHub Actions workflows** covering builds, tests, linting, Docker images, binary releases, and performance benchmarks
- **PR Workflow (`pull.yml`)**: Triggers on every PR with:
  - Multi-shard test execution (5 shards for default config)
  - Distributed test shards (3 shards)
  - Docs test, JIT legacy, backwards compatibility, NumPy 2.x compatibility
  - Multiple Python versions (3.10-3.14+)
- **Trunk Workflow (`trunk.yml`)**: Post-merge with additional coverage:
  - CUDA builds (13.0), ROCm builds, XPU builds
  - Debug, ASAN, TSAN, UBSAN builds
  - Scheduled nightly runs
- **LLM-Powered Target Determination**: Uses ML models (`llm_td_retrieval.yml`) to intelligently select which tests to run based on code changes — cutting-edge for CI optimization
- **Concurrency Control**: All workflows use `concurrency` groups with `cancel-in-progress: true`
- **Docker Image Management**: Content-hash-based Docker image rebuilds; 40+ image variants
- **RetryBot**: Automatic retry of flaky CI jobs
- **Platform Matrix**: Linux (x86, ARM64, s390x), macOS (ARM64), Windows (x64, ARM64)

### Test Coverage

**Rating: 9.5/10 (Unit) + 9.0/10 (Integration/E2E)**

- **1,727 Python test files** in `test/` directory
- **185 top-level test files** including massive files like `test_torch.py` (11,181 lines, 460 test methods) and `test_nn.py` (16,422 lines)
- **442 C++ test files** and **31 CUDA test files**
- **Specialized test directories**:
  - `test/distributed/` — 320 files for distributed training (FSDP, DTensor, RPC, elastic, pipelining)
  - `test/inductor/` — 192 files for the TorchInductor compiler
  - `test/export/` — 36 files for export functionality
  - `test/functorch/` — Function transforms testing
  - `test/onnx/` — ONNX export tests
  - `test/quantization/` — Quantization tests
  - `test/jit/` — JIT compiler tests
- **Testing Patterns**:
  - Custom `TestCase` class (`torch.testing._internal.common_utils`)
  - `@parametrize` decorator for multi-input tests
  - `instantiate_device_type_tests` for device-generic testing (CPU/CUDA/MPS/XPU)
  - Hypothesis property-based testing (20 files)
  - 321 files using parametrized tests
- **Test-to-Code Ratio**: ~0.74 test files per source file (1,727 test / 2,340 source Python files) — strong ratio for a project of this complexity

### Code Quality Tools

**Rating: 9.0/10 - Comprehensive Linting Infrastructure**

- **LintRunner**: Custom lint orchestration tool (`.lintrunner.toml`) with **58 distinct linters**:
  - `FLAKE8` — Python style
  - `RUFF` — Fast Python linting
  - `CLANGFORMAT` — C++ formatting
  - `CLANGTIDY` — C++ static analysis
  - `PYREFLY` — Meta's Python type checker
  - `SHELLCHECK` — Shell script analysis
  - `ACTIONLINT` — GitHub Actions validation
  - `CMAKE` — CMake linting
  - `CODESPELL` — Spell checking
  - Domain-specific: `RAWCUDA`, `RAWTHROW`, `INCLUDE`, `PYBIND11_*`, `ATEN_CPU_GPU_AGNOSTIC`
- **Type Checking**:
  - `mypy.ini` with strict settings (`disallow_untyped_defs`, `check_untyped_defs`)
  - `mypy-strict.ini` for codegen files (full `strict = True`)
  - `pyrefly.toml` — Meta's Pyrefly type checker (migration in progress)
- **Ruff Configuration**: Comprehensive rule selection in `pyproject.toml` with 40+ rule categories (B, C4, E, F, FURB, LOG, NPY, PERF, PIE, PLC, PLE, PLR, PLW, PYI, RUF, SIM, TC, TID, UP, W)
- **No `.pre-commit-config.yaml`**: Relies on `lintrunner` and CI enforcement instead

### Container Images

**Rating: 7.5/10 - Extensive but Lacking Security Scanning**

- **Docker Infrastructure**:
  - Root `Dockerfile` for development environment (multi-stage build)
  - `.ci/docker/` directory with specialized CI images
  - `.devcontainer/Dockerfile` for VS Code dev containers
  - Content-hash-based rebuild detection
- **40+ CI Image Variants** built in `docker-builds.yml`:
  - CUDA versions (13.0, 13.2+)
  - ROCm variants (MI200, MI300, MI350, Navi31)
  - XPU (Intel GPU) support
  - Python 3.10-3.14 (including free-threaded 3.14t)
  - GCC/Clang compilers
  - Inductor benchmark images
  - AlmaLinux and Ubuntu variants
  - ARM64 (aarch64) and s390x cross-builds
- **Gaps**:
  - No Trivy/Snyk/Grype vulnerability scanning
  - No SBOM generation
  - No image signing (cosign/Sigstore)
  - No runtime validation tests for CI images

### Security

**Rating: 6.5/10 - Policy Present, Automation Lacking**

- **Strengths**:
  - Comprehensive `SECURITY.md` with vulnerability reporting guidelines
  - Detailed security guidance for untrusted models, TorchScript, distributed features
  - CI/CD security principles documented
  - Permission model: `permissions: read-all` default in workflows
  - GitHub security advisories enabled
- **Gaps**:
  - OSSF Scorecard workflow disabled (`if: false`)
  - No CodeQL/Semgrep SAST scanning
  - No Gitleaks/TruffleHog secret detection
  - No Bandit/Safety for Python dependency scanning
  - No container image scanning
  - No SBOM generation for releases

### Agent Rules (Agentic Flow Quality)

**Rating: 9.0/10 - Outstanding AI Integration**

PyTorch has one of the most mature AI agent integrations in open source:

- **CLAUDE.md** (292 lines): Comprehensive developer guidance covering:
  - Build instructions (`pip install -e . -v --no-build-isolation`)
  - Testing patterns (TestCase, run_tests, parametrize, device-generic tests)
  - Linting workflow (lintrunner integration)
  - Git workflow (ghstack support)
  - Coding style guidelines
  - Domain-specific guidance (CUDA bindings, Dynamo config, PTX instructions)
- **AGENTS.md**: Mirrors CLAUDE.md for other AI agents
- **15 Custom Claude Skills** in `.claude/skills/`:
  - `pr-review` — PyTorch-specific PR review with checklist and BC guidelines
  - `fix-issue` — Issue fix workflow with torch compile manual
  - `triaging-issues` — Issue triage with labels and PT2 rubric
  - `distributed-triage` — Distributed module issue triage
  - `pt2-bug-basher` — PyTorch 2.0 bug hunting
  - `metal-kernel` — Metal GPU kernel development
  - `docstring` — Documentation generation
  - `document-public-apis` — API documentation
  - `pyrefly-type-coverage` — Type coverage tracking
  - `skill-writer` — Meta-skill for creating new skills
  - `aoti-debug` — AOTInductor debugging
  - `add-uint-support` — Unsigned int support
  - `at-dispatch-v2` — Dispatch macro migration
  - `ci-metrics` — CI metrics analysis
  - `scrub-issue` — Issue cleanup
- **Claude Code Workflow** (`.github/workflows/claude-code.yml`): Automated AI agent for issue comments and PR reviews
- **Claude Triage Workflows**: Automated issue triage using Claude (`claude-issue-triage.yml`, `claude-distributed-triage.yml`)
- **Gap**: No `.claude/rules/` directory for structured test creation patterns

### Performance Testing

**Rating: 8.0/10 - Extensive Benchmark Infrastructure**

- **Dedicated Benchmark Directory** (`benchmarks/`) with 20+ benchmark suites:
  - `inductor_backends` — Compiler backend benchmarks
  - `distributed` — Distributed training benchmarks
  - `dynamo` — TorchDynamo benchmarks
  - `fastrnns` — RNN performance
  - `instruction_counts` — Op-level instruction counting
  - `operator_benchmark` — Operator micro-benchmarks
  - `profiler_benchmark` — Profiler overhead
  - `diffusion` — Diffusion model benchmarks
  - `gpt_fast` — LLM inference benchmarks
- **CI Performance Workflows**:
  - `inductor-perf-test-nightly-*.yml` — Nightly perf tests across x86, H100, B200, ROCm, XPU, macOS, aarch64
  - `inductor-micro-benchmark*.yml` — Micro-benchmark tracking
  - `attention_op_microbenchmark.yml` — Attention operator benchmarks
- **Performance Comparison**: `inductor-perf-compare.yml` for A/B perf comparison

## Recommendations

### Priority 0 (Critical)

1. **Add Codecov/Coveralls integration with PR coverage gates**
   - Configure `.codecov.yml` with minimum coverage thresholds
   - Add coverage upload steps to PR and trunk workflows
   - Enable PR-level coverage diff reporting

2. **Enable container vulnerability scanning for CI Docker images**
   - Add Trivy scanning to `docker-builds.yml`
   - Set severity thresholds (fail on CRITICAL)
   - Generate scan reports as artifacts

3. **Re-enable OSSF Scorecard workflow**
   - Change `if: false` to `if: github.repository == 'pytorch/pytorch'` in `scorecards.yml`
   - Enable badge publishing for supply chain visibility

### Priority 1 (High Value)

4. **Add SAST scanning (CodeQL or Semgrep)**
   - Enable CodeQL for Python and C++ code paths
   - Focus on serialization, network protocols, and JIT compilation code
   - Run on PRs touching security-sensitive files

5. **Implement secret detection**
   - Add Gitleaks to the lint workflow
   - Configure allowlist for known test tokens/fixtures

6. **Create `.claude/rules/` test pattern rules**
   - Extract CLAUDE.md test guidance into structured rules:
     - `unit-tests.md` — TestCase, run_tests, assertEqual patterns
     - `device-generic-tests.md` — instantiate_device_type_tests patterns
     - `distributed-tests.md` — Multi-process test patterns
     - `inductor-tests.md` — Compiler test patterns

7. **Add SBOM generation for release artifacts**
   - Generate SBOMs for wheel packages and Docker images
   - Use Syft or CycloneDX

### Priority 2 (Nice-to-Have)

8. **Add dependency scanning**
   - Scan `requirements.txt` and `third_party/` for known vulnerabilities
   - Enable Dependabot for automated dependency updates

9. **Container image signing**
   - Implement Sigstore/cosign signing for release Docker images
   - Add attestation for binary wheels

10. **Pre-commit hooks configuration**
    - Create `.pre-commit-config.yaml` as an alternative to lintrunner for external contributors
    - Could reduce friction for new contributors

## Comparison to Gold Standards

| Practice | PyTorch | odh-dashboard | notebooks | kserve | Industry Best |
|----------|---------|---------------|-----------|--------|---------------|
| Unit Tests | 9.5 | 8.5 | 7.0 | 8.0 | 10.0 |
| Integration/E2E | 9.0 | 9.0 | 7.5 | 9.0 | 10.0 |
| Coverage Enforcement | 6.0 | 8.0 | 5.0 | 8.5 | 10.0 |
| Container Scanning | 5.0 | 7.0 | 8.0 | 7.0 | 10.0 |
| CI/CD Sophistication | 9.5 | 8.5 | 7.0 | 8.0 | 10.0 |
| Linting Breadth | 9.5 | 8.0 | 6.0 | 7.5 | 10.0 |
| Agent Rules | 9.0 | 8.5 | 3.0 | 2.0 | 10.0 |
| Performance Testing | 8.0 | 5.0 | 3.0 | 6.0 | 10.0 |
| Security Automation | 6.0 | 7.0 | 7.5 | 7.0 | 10.0 |

**Key Observations**:
- PyTorch leads in test breadth, CI sophistication, linting depth, and AI agent integration
- Main gap vs. gold standards is security automation (scanning, SAST, SBOM) and coverage enforcement
- The LLM-powered target determination system is genuinely innovative — no other project analyzed uses ML for test selection
- Agent integration (15 skills, automated triage, PR review) is the most mature seen

## File Paths Reference

### CI/CD
- `.github/workflows/pull.yml` — PR workflow (143 total workflows)
- `.github/workflows/trunk.yml` — Post-merge trunk workflow
- `.github/workflows/lint.yml` — Lint orchestration
- `.github/workflows/docker-builds.yml` — CI Docker image builds
- `.github/workflows/scorecards.yml` — OSSF Scorecard (DISABLED)
- `.github/workflows/claude-code.yml` — AI agent workflow
- `.github/workflows/target_determination.yml` — Test selection
- `.github/workflows/llm_td_retrieval.yml` — LLM-powered target determination

### Testing
- `test/` — 1,727 Python test files
- `test/distributed/` — 320 distributed training test files
- `test/inductor/` — 192 compiler test files
- `test/export/` — 36 export test files
- `test/cpp/` — C++ tests
- `benchmarks/` — 20+ benchmark suites
- `pytest.ini` — PyTest configuration
- `.coveragerc` — Coverage configuration (JIT plugin)

### Code Quality
- `.lintrunner.toml` — 58 linters configured
- `pyproject.toml` — Ruff configuration (40+ rule categories)
- `.flake8` — Flake8 configuration
- `mypy.ini` — MyPy configuration (strict-ish)
- `mypy-strict.ini` — Strict MyPy for codegen
- `pyrefly.toml` — Pyrefly type checker

### Container Images
- `Dockerfile` — Development environment
- `.ci/docker/` — CI Docker image definitions (40+ variants)
- `.devcontainer/Dockerfile` — VS Code dev container

### Agent Rules
- `CLAUDE.md` — AI agent instructions (292 lines)
- `AGENTS.md` — Multi-agent instructions
- `.claude/skills/` — 15 custom Claude skills
- `.github/workflows/claude-code.yml` — Automated AI workflow

### Security
- `SECURITY.md` — Security policy and reporting
- `.github/workflows/scorecards.yml` — OSSF Scorecard (disabled)
