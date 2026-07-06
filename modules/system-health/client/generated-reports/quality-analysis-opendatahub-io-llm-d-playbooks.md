---
repository: "opendatahub-io/llm-d-playbooks"
overall_score: 1.8
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No unit tests exist anywhere in the repository"
  - dimension: "Integration/E2E"
    score: 1.0
    status: "Validation steps described in docs but no automated test scripts exist"
  - dimension: "Build Integration"
    score: 0.0
    status: "No CI/CD pipelines, no build automation, no PR validation"
  - dimension: "Image Testing"
    score: 0.0
    status: "No container images built or tested by this repository"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling configured"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "No .github/workflows/, no Makefile, no CI configuration of any kind"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "Zero CI/CD pipeline — no automated quality gates"
    impact: "Any contributor can merge broken YAML manifests, invalid Kustomize overlays, or non-functional scripts without any automated check"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No linting or validation for Kubernetes manifests"
    impact: "Invalid YAML, missing required fields, or schema violations in Kustomize/K8s manifests go undetected until cluster apply time"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No tests for Python benchmark generators"
    impact: "Regressions in kv-cache-prompt-generator.py, prefix-cache-generator.py, or heterogeneous-workload-generator.py are only caught manually"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "Shell scripts contain hardcoded URLs and credentials"
    impact: "bench-all.sh contains a hardcoded AWS ELB URL; scripts lack input validation and error handling"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No secret scanning or dependency vulnerability checks"
    impact: "Hardcoded endpoints or leaked credentials in scripts go undetected"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add GitHub Actions workflow for YAML/Kustomize validation"
    effort: "2-3 hours"
    impact: "Catches invalid manifests before merge; validates all 38 YAML files on every PR"
  - title: "Add markdownlint for documentation quality"
    effort: "1 hour"
    impact: "Ensures consistent formatting across 18 markdown files that form the entire user-facing content"
  - title: "Add pytest for the 3 Python generators (678 lines of code)"
    effort: "4-6 hours"
    impact: "Validates prompt generation logic, word count assertions, and CSV output format"
  - title: "Add shellcheck for the 4 shell scripts"
    effort: "1 hour"
    impact: "Catches quoting issues, undefined variables, and portability problems in bench-all.sh and generate-all.sh"
  - title: "Add pre-commit hooks for YAML + markdown + Python"
    effort: "1-2 hours"
    impact: "Enforces basic quality locally before push"
recommendations:
  priority_0:
    - "Create a minimal GitHub Actions CI pipeline with YAML lint, Kustomize build validation, and Python syntax checks"
    - "Add kubeconform or kubeval to validate all Kubernetes manifests against their CRD schemas"
    - "Remove hardcoded AWS ELB URL from bench-all.sh and parameterize all external endpoints"
  priority_1:
    - "Write pytest test suite for the 3 Python generators covering edge cases (zero replicas, cache overflow, etc.)"
    - "Add Kustomize build CI step that runs `kustomize build` on all overlay directories to catch reference errors"
    - "Create CLAUDE.md or AGENTS.md with contribution guidelines and test expectations"
  priority_2:
    - "Add link checker for markdown documentation to catch broken internal/external links"
    - "Add Grafana dashboard JSON schema validation"
    - "Add CODEOWNERS file to enforce review requirements"
---

# Quality Analysis: llm-d-playbooks

## Executive Summary
- **Overall Score: 1.8/10**
- **Repository Type**: Documentation/playbook repository with Kubernetes manifests and Python benchmarking tools
- **Primary Content**: 18 markdown docs, 38 YAML/Kustomize manifests, 3 Python generators (678 LoC), 4 shell scripts (85 LoC)
- **Key Strengths**: Excellent documentation quality and structure; well-organized 8-step deployment playbook; comprehensive benchmarking guide with real performance data
- **Critical Gaps**: Zero CI/CD automation; no tests of any kind; no linting; no security scanning; no agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No unit tests exist anywhere in the repository |
| Integration/E2E | 1/10 | Validation steps described in documentation but no automated test scripts |
| **Build Integration** | **0/10** | **No CI/CD pipelines, no build automation, no PR validation** |
| Image Testing | 0/10 | No container images built or tested by this repository |
| Coverage Tracking | 0/10 | No coverage tooling configured |
| CI/CD Automation | 0/10 | No .github/workflows/, no Makefile, no CI configuration |
| Agent Rules | 0/10 | No CLAUDE.md, AGENTS.md, or .claude/ directory |

## Critical Gaps

### 1. Zero CI/CD Pipeline — No Automated Quality Gates
- **Impact**: Any contributor can merge broken YAML manifests, invalid Kustomize overlays, or non-functional scripts without any automated check
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The repository has no `.github/workflows/` directory, no `Makefile`, no `.gitlab-ci.yml`, and no CI configuration of any kind. The 38 YAML manifests and 3 Python scripts receive zero automated validation.

### 2. No Linting or Validation for Kubernetes Manifests
- **Impact**: Invalid YAML, missing required fields, or schema violations in Kustomize/K8s manifests go undetected until someone runs `oc apply` or `kubectl apply` on a live cluster
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The repository contains 38 YAML files across `08-benchmarking/intelligent-inference-scheduler/` including complex resources like `LLMInferenceService`, `InferenceService`, `ServingRuntime`, `Gateway`, and `HardwareProfile` CRDs. None are validated against schemas.

### 3. No Tests for Python Benchmark Generators
- **Impact**: Regressions in the 3 Python scripts (678 total lines) are only caught through manual execution
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: `kv-cache-prompt-generator.py`, `prefix-cache-generator.py`, and `heterogeneous-workload-generator.py` contain critical benchmarking logic (KV cache capacity math, prompt interleaving, word-to-token conversion). The scripts have inline assertions but no test suite.

### 4. Shell Scripts Contain Hardcoded URLs
- **Impact**: `heterogeneous/bench-all.sh` contains a hardcoded AWS ELB URL (`a970653680479411ea2687bb74860cd4-328874611.us-east-2.elb.amazonaws.com`); `prefix/bench-all.sh` uses placeholder `<gateway-hostname>` (inconsistent patterns)
- **Severity**: MEDIUM
- **Effort**: 2-4 hours

### 5. No Secret Scanning or Dependency Vulnerability Checks
- **Impact**: The hardcoded AWS ELB URL and any future credentials go undetected; `requirements.txt` pins `guidellm==0.3.1` but no tooling checks for known CVEs
- **Severity**: MEDIUM
- **Effort**: 1-2 hours

## Quick Wins

### 1. Add GitHub Actions Workflow for YAML/Kustomize Validation (2-3 hours)
- **Impact**: Catches invalid manifests before merge
- **Implementation**:
```yaml
# .github/workflows/validate.yml
name: Validate
on: [pull_request]
jobs:
  yaml-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: YAML Lint
        uses: ibiqlik/action-yamllint@v3
        with:
          file_or_dir: '.'
          config_data: |
            extends: default
            rules:
              line-length: {max: 200}
              truthy: disable
  kustomize:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install kustomize
        run: |
          curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
          sudo mv kustomize /usr/local/bin/
      - name: Validate Kustomize builds
        run: |
          find . -name kustomization.yaml -execdir sh -c 'echo "Building $(pwd)..." && kustomize build . > /dev/null' \;
```

### 2. Add Markdownlint (1 hour)
- **Impact**: Ensures consistent formatting across 18 markdown files
- **Implementation**: Add `markdownlint-cli2` to the CI workflow

### 3. Add Pytest for Python Generators (4-6 hours)
- **Impact**: Validates prompt generation logic, word count assertions, CSV output
- **Implementation**: Create `test_generators.py` covering edge cases like zero replicas, cache overflow, minimum word counts

### 4. Add Shellcheck (1 hour)
- **Impact**: Catches quoting issues, undefined variables in `bench-all.sh` and `generate-all.sh`
- **Implementation**: Add `shellcheck` step to CI

### 5. Add Pre-commit Hooks (1-2 hours)
- **Impact**: Enforces quality locally before push
- **Implementation**:
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: check-yaml
      - id: end-of-file-fixer
      - id: trailing-whitespace
  - repo: https://github.com/koalaman/shellcheck-precommit
    rev: v0.10.0
    hooks:
      - id: shellcheck
  - repo: https://github.com/psf/black
    rev: 24.4.2
    hooks:
      - id: black
```

## Detailed Findings

### CI/CD Pipeline
- **Status**: Non-existent
- **Workflows**: None — no `.github/workflows/`, no `Makefile`, no `.gitlab-ci.yml`
- **PR Validation**: None
- **Build Automation**: None
- **Observation**: This is a documentation-heavy repository, but it contains 38 Kubernetes manifests and 678 lines of Python that would benefit significantly from automated validation.

### Test Coverage
- **Unit Tests**: 0 test files found. The Python generators have inline `assert` statements but no test framework.
- **Integration Tests**: The playbook documents validation steps (CRD checks, operator health, RDMA connectivity/bandwidth/latency, functional and performance tests) but these are manual procedures to be run on a live cluster — not automated test scripts.
- **E2E Tests**: None. The benchmarking workflow (Steps 3-7 of the playbook at `08-benchmarking/`) is entirely manual.
- **Coverage Tracking**: None — no `.codecov.yml`, no `coverage` in any configuration.
- **Test-to-Code Ratio**: 0:678 (Python), 0:85 (Shell), 0:38 (YAML files)

### Code Quality
- **Linting**: No linting tools configured (no `.golangci.yaml`, `.eslintrc`, `ruff.toml`, `.flake8`, `mypy.ini`)
- **Pre-commit Hooks**: No `.pre-commit-config.yaml`
- **Static Analysis**: None (no CodeQL, gosec, Semgrep)
- **Code Style**: Python scripts use consistent formatting but no enforced style (no `black`, `ruff`, or `isort`)
- **Type Hints**: Python scripts lack type annotations beyond the one function signature in `kv-cache-prompt-generator.py`

### Container Images
- **Status**: Not applicable — this repository does not build container images
- **Observation**: The Kubernetes manifests reference external images (`registry.access.redhat.com/ubi9/ubi:latest`, vLLM runtime, KServe) but the repo itself builds nothing

### Security
- **Secret Scanning**: None (no `.gitleaks.toml`, no Gitleaks/TruffleHog integration)
- **Dependency Scanning**: None — `requirements.txt` pins `guidellm==0.3.1` but no Dependabot or Snyk configured
- **Hardcoded Credentials**: `heterogeneous/bench-all.sh` contains a hardcoded AWS ELB URL that appears to be a real endpoint
- **SAST**: None

### Agent Rules (Agentic Flow Quality)
- **Status**: Missing
- **Coverage**: No test type rules exist
- **Quality**: N/A
- **Gaps**: No `CLAUDE.md`, no `AGENTS.md`, no `.claude/` directory, no `.claude/rules/`, no `.claude/skills/`
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - YAML manifest validation patterns
  - Python generator test patterns
  - Kustomize overlay testing
  - Shell script testing guidelines

### Repository Structure Quality
- **Strengths**:
  - Well-organized numbered directory structure (01-08) following deployment order
  - Each step has clear README.md with purpose, prerequisites, and next steps
  - Excellent benchmarking documentation with real performance comparisons (vLLM vs LLM-D)
  - Kustomize overlays properly structured with base/overlay pattern
  - Good use of kustomization.yaml for environment-specific configuration
- **Weaknesses**:
  - Validation directories (`03-control-plane-readiness/validation/`, `05-rdma-network-validation/validation/`, `07-llm-deployment-validation/validation/`) reference subdirectories that don't exist in the repository (e.g., `crds-present/`, `operators-healthy/`, `connectivity/`, `bandwidth/`, `functional/`, `performance/`)
  - This means the validation steps are documentation-only — the actual scripts/tools are either not yet written or live elsewhere
  - `.gitignore` only excludes `.DS_Store` and `prompts.csv`

## Recommendations

### Priority 0 (Critical)
1. **Create a minimal GitHub Actions CI pipeline** with YAML lint, Kustomize build validation, Python syntax checks, and shellcheck — this is the single highest-value improvement for the repository
2. **Add kubeconform or kubeval** to validate all Kubernetes manifests against CRD schemas (especially `LLMInferenceService`, `InferenceService`, `ServingRuntime`, `Gateway` resources)
3. **Remove hardcoded AWS ELB URL** from `heterogeneous/bench-all.sh` and parameterize all external endpoints consistently (as `prefix/bench-all.sh` does with `<gateway-hostname>` placeholder)

### Priority 1 (High Value)
1. **Write pytest test suite** for the 3 Python generators covering:
   - Edge cases: zero replicas, cache overflow, prompt size exceeding cache
   - Output format validation: CSV headers, column count, row count
   - Math validation: 80% fill calculation, unique-per-replica math
   - Word count assertions: verify generated prompts match target lengths
2. **Add Kustomize build CI step** that runs `kustomize build` on all 10 overlay directories to catch broken patch references
3. **Create CLAUDE.md** with contribution guidelines, test expectations, and development workflow
4. **Implement the missing validation scripts** referenced in steps 03, 05, and 07 (currently only documented in README but no actual scripts exist)

### Priority 2 (Nice-to-Have)
1. **Add link checker** for markdown docs (many external links to platform documentation that could rot)
2. **Add Grafana dashboard JSON schema validation** for the 846-line dashboard ConfigMap
3. **Add CODEOWNERS** file to enforce review requirements
4. **Add Dependabot** for `requirements.txt` dependency updates
5. **Add Python type hints** and `mypy` checking for the generators

## Comparison to Gold Standards

| Dimension | llm-d-playbooks | odh-dashboard | notebooks | kserve |
|-----------|----------------|---------------|-----------|--------|
| CI/CD | None | Comprehensive multi-workflow | Multi-stage validation | Extensive GH Actions |
| Unit Tests | None | Jest + React Testing Library | Pytest suites | Go testing + envtest |
| Integration/E2E | Manual docs only | Cypress E2E + contract tests | 5-layer image validation | KServe E2E framework |
| Coverage | None | Codecov with enforcement | Coverage tracking | Codecov with thresholds |
| YAML Validation | None | Kustomize in CI | Manifest validation | CRD validation in CI |
| Security Scanning | None | Snyk + Gitleaks | Trivy scanning | CodeQL + Snyk |
| Agent Rules | None | Comprehensive .claude/rules/ | Basic rules | N/A |
| Pre-commit | None | ESLint + Prettier hooks | Python hooks | golangci-lint hooks |

## File Paths Reference

### Repository Structure
- `README.md` — Top-level overview and deployment step index
- `01-cluster-bring-up/` through `08-benchmarking/` — Ordered deployment playbook steps
- `shared/` — Common resources (currently only README)

### Key Configuration Files
- `08-benchmarking/intelligent-inference-scheduler/llm-d/base/llm-infra.yaml` — LLMInferenceService CRD with scheduler config
- `08-benchmarking/intelligent-inference-scheduler/vllm/base/serving-runtime.yaml` — vLLM ServingRuntime
- `08-benchmarking/intelligent-inference-scheduler/monitoring/openshift-dashboard.yaml` — Grafana dashboard (846 lines)
- `08-benchmarking/intelligent-inference-scheduler/guidellm/base/guidellm-job.yaml` — GuideLLM benchmark Job

### Python Generators
- `08-benchmarking/intelligent-inference-scheduler/test-data-generator/prefix/kv-cache-prompt-generator.py` (207 lines)
- `08-benchmarking/intelligent-inference-scheduler/test-data-generator/prefix/prefix-cache-generator.py` (261 lines)
- `08-benchmarking/intelligent-inference-scheduler/test-data-generator/heterogeneous/heterogeneous-workload-generator.py` (210 lines)

### Shell Scripts
- `08-benchmarking/intelligent-inference-scheduler/test-data-generator/prefix/bench-all.sh` (36 lines)
- `08-benchmarking/intelligent-inference-scheduler/test-data-generator/prefix/generate-all.sh` (8 lines)
- `08-benchmarking/intelligent-inference-scheduler/test-data-generator/heterogeneous/bench-all.sh` (35 lines)
- `08-benchmarking/intelligent-inference-scheduler/test-data-generator/heterogeneous/generate-all.sh` (6 lines)

### Dependencies
- `08-benchmarking/intelligent-inference-scheduler/test-data-generator/requirements.txt` — `pandas`, `guidellm==0.3.1`
