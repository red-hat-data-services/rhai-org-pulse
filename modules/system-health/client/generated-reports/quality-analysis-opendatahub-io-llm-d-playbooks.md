---
repository: "opendatahub-io/llm-d-playbooks"
overall_score: 1.1
scorecard:
  - dimension: "Unit Tests"
    score: 1.0
    status: "No unit tests; no YAML schema validation or kustomize build tests"
  - dimension: "Integration/E2E"
    score: 2.0
    status: "Manual smoke-test.yaml and benchmark scripts exist but nothing is automated"
  - dimension: "Build Integration"
    score: 2.0
    status: "Well-structured kustomize overlays (36 files) but no CI validation"
  - dimension: "Image Testing"
    score: 1.0
    status: "No images built; referenced container images are not validated"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tracking — no code to instrument"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "Zero CI/CD — no GitHub Actions, no GitLab CI, no Jenkinsfile"
  - dimension: "Static Analysis"
    score: 1.0
    status: "No yamllint, no shellcheck, no Dependabot/Renovate, no pre-commit hooks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No CI/CD automation at all"
    impact: "Kustomize manifests, shell scripts, and Python generators are never validated on PRs — broken YAML or invalid K8s resources merge silently"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No automated manifest validation"
    impact: "36 kustomization.yaml files with base/overlay patterns are never built or validated in CI — kustomize build failures are only discovered at deploy time"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No linting for shell scripts or YAML"
    impact: "423-line discover-gpu-nic-topology.sh and 116-line debug-nics.sh have no shellcheck validation; YAML manifests have no schema validation"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No dependency management automation"
    impact: "requirements.txt pins guidellm==0.3.1 but no Dependabot/Renovate to flag outdated or vulnerable dependencies"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add GitHub Actions workflow for kustomize build validation"
    effort: "2-3 hours"
    impact: "Validates all 36 kustomize overlays build successfully on every PR, catching broken manifests before merge"
  - title: "Add yamllint and shellcheck CI checks"
    effort: "2-3 hours"
    impact: "Catches YAML syntax errors and shell script bugs automatically; prevents broken manifests and scripts from merging"
  - title: "Enable Dependabot for pip ecosystem"
    effort: "30 minutes"
    impact: "Automated alerts for outdated/vulnerable Python dependencies (pandas, guidellm)"
  - title: "Add CLAUDE.md with playbook contribution guidelines"
    effort: "1-2 hours"
    impact: "Guides AI agents to follow kustomize patterns, naming conventions, and manifest structure when contributing"
recommendations:
  priority_0:
    - "Create a PR-triggered GitHub Actions workflow that runs `kustomize build` on every overlay to validate manifest correctness"
    - "Add yamllint configuration and CI step to validate all YAML files against Kubernetes schemas"
    - "Add shellcheck CI step for all .sh scripts (discover-gpu-nic-topology.sh, debug-nics.sh, bench-all.sh, generate-all.sh)"
  priority_1:
    - "Add kubeval or kubeconform validation to verify generated manifests against Kubernetes API schemas"
    - "Add a smoke-test CI job that validates kustomize overlays produce valid LLMInferenceService, Gateway, and HardwareProfile resources"
    - "Enable Dependabot for pip and GitHub Actions ecosystems"
    - "Add pre-commit hooks (.pre-commit-config.yaml) for yamllint, shellcheck, and trailing whitespace"
  priority_2:
    - "Create CLAUDE.md with kustomize patterns, overlay naming conventions, and contribution guidelines"
    - "Add Python linting (ruff) for the test-data-generator scripts"
    - "Add unit tests for Python data generators (prefix-cache-generator.py, kv-cache-prompt-generator.py, heterogeneous-workload-generator.py)"
    - "Consider adding a CI job that does a dry-run deployment to a Kind cluster to validate full deployment flow"
---

# Quality Analysis: llm-d-playbooks

## Executive Summary

- **Overall Score: 1.1/10**
- **Repository Type**: Documentation/Playbook repository (Kubernetes deployment guides)
- **Primary Languages**: YAML (Kubernetes manifests), Shell (Bash), Python (data generators)
- **Jira**: INFERENG / llm-d (midstream tier)
- **Key Strengths**: Well-organized kustomize structure with base/overlay patterns; comprehensive benchmarking documentation; practical smoke-test definitions
- **Critical Gaps**: Zero CI/CD automation; no manifest validation; no linting; no agent rules
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 1/10 | 15% | 0.15 | No unit tests; no YAML validation tests |
| Integration/E2E | 2/10 | 20% | 0.40 | Manual smoke-test and benchmarks only |
| Build Integration | 2/10 | 15% | 0.30 | Good kustomize structure, no CI validation |
| Image Testing | 1/10 | 10% | 0.10 | No images built; no image validation |
| Coverage Tracking | 0/10 | 10% | 0.00 | No coverage tracking |
| CI/CD Automation | 0/10 | 15% | 0.00 | Zero CI/CD automation |
| Static Analysis | 1/10 | 10% | 0.10 | No linting, no dependency alerts |
| Agent Rules | 0/10 | 5% | 0.00 | No agent rules present |
| **Overall** | **1.1/10** | **100%** | **1.05** | |

## Critical Gaps

### 1. No CI/CD Automation at All
- **Impact**: Every PR merges without any automated validation. Broken YAML, invalid kustomize overlays, shell script syntax errors, and Python bugs are only discovered when someone manually tries to deploy.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Evidence**: No `.github/workflows/` directory. No `.gitlab-ci.yml`, `Jenkinsfile`, or `Taskfile.yml`.

### 2. No Automated Manifest Validation
- **Impact**: The repository contains 36 `kustomization.yaml` files with complex base/overlay patterns across 5 deployment scenarios. None are validated in CI. A typo in a kustomize patch or an invalid resource reference will only be caught during manual deployment on a live cluster.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Key Files**: `03-accelerator-operator-config/bare-metal-a100-ib/*/kustomization.yaml`, `05-deploy-and-benchmark/*/kustomization.yaml`

### 3. No Shell Script or YAML Linting
- **Impact**: The 423-line `discover-gpu-nic-topology.sh` is a complex script that probes sysfs on cluster worker nodes. Without shellcheck validation, subtle bugs (unquoted variables, incorrect conditionals, portability issues) can go undetected.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Key Files**: `03-accelerator-operator-config/common/00-discover-gpus-nics/discover-gpu-nic-topology.sh`, `debug-nics.sh`, `bench-all.sh`, `generate-all.sh`

### 4. No Dependency Management Automation
- **Impact**: `requirements.txt` pins `guidellm==0.3.1` and `pandas`. No Dependabot or Renovate configuration means outdated or vulnerable dependencies go unnoticed.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours

## Quick Wins

### 1. Add GitHub Actions Workflow for Kustomize Build Validation (2-3 hours)

Create `.github/workflows/validate.yml`:

```yaml
name: Validate Manifests
on:
  pull_request:
    branches: [main]

jobs:
  kustomize-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install kustomize
        run: |
          curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
          sudo mv kustomize /usr/local/bin/
      - name: Validate all kustomize overlays
        run: |
          find . -name kustomization.yaml -exec dirname {} \; | while read dir; do
            echo "Building $dir..."
            kustomize build "$dir" > /dev/null
          done
```

### 2. Add yamllint and shellcheck CI Checks (2-3 hours)

```yaml
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: yamllint
        run: |
          pip install yamllint
          yamllint -c .yamllint.yml .
      - name: shellcheck
        run: |
          sudo apt-get install -y shellcheck
          find . -name "*.sh" -exec shellcheck {} +
```

### 3. Enable Dependabot (30 minutes)

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/05-deploy-and-benchmark/intelligent-inference-scheduler/test-data-generator"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 4. Add CLAUDE.md with Contribution Guidelines (1-2 hours)

Create a `CLAUDE.md` documenting kustomize patterns, overlay naming conventions, and expected manifest structure to guide AI-assisted contributions.

## Detailed Findings

### Unit Tests

**Score: 1/10**

No test files of any kind were found in the repository:
- No `*_test.go`, `*_test.py`, `*.spec.ts`, or `*.test.js` files
- No `pytest.ini`, `go.mod`, or test framework configuration
- No YAML schema validation tests

For a playbook repository, relevant unit tests would include:
- **Kustomize build tests**: Verify every overlay builds without errors
- **YAML schema validation**: Verify manifests conform to Kubernetes API schemas
- **Python script tests**: Unit tests for the data generator scripts (3 Python files, ~678 lines total)

**Key Files Missing Tests**:
- `test-data-generator/prefix/prefix-cache-generator.py` (261 lines)
- `test-data-generator/prefix/kv-cache-prompt-generator.py` (207 lines)
- `test-data-generator/heterogeneous/heterogeneous-workload-generator.py` (210 lines)

### Integration/E2E Tests

**Score: 2/10**

The repository includes manual validation mechanisms but no automated integration tests:

**What exists:**
- `05-deploy-and-benchmark/intelligent-inference-scheduler/smoke-test.yaml` — A Kubernetes Job that curls the model endpoint to verify it responds. This is a manual step, not CI-automated.
- Benchmark scripts (`bench-all.sh`) that exercise the deployed system via GuideLLM
- Detailed README instructions for manual A/B comparison testing (vLLM vs LLM-D)

**What's missing:**
- No automated E2E test suite
- No CI-driven Kind/Minikube cluster testing
- No `kustomize build --dry-run` validation in CI
- No automated smoke test execution

### Build Integration

**Score: 2/10**

The repository demonstrates good kustomize organizational practices but lacks CI validation:

**Strengths:**
- 36 `kustomization.yaml` files organized in clean base/overlay patterns
- Multiple deployment scenarios: intelligent-inference-scheduler, pd-disaggregation
- Multiple model overlays: Qwen, Granite
- Separate base and overlay directories per component (vllm, llm-d, guidellm, monitoring)
- Proper use of kustomize patches and config generation

**Gaps:**
- No PR-triggered build validation
- No `kustomize build` CI step
- No Makefile or build targets
- No manifest dry-run validation (`kubectl apply --dry-run=server`)

**Key Directories:**
```
05-deploy-and-benchmark/intelligent-inference-scheduler/
├── llm-d/base/         (LLMInferenceService, Gateway, namespace, profile)
├── llm-d/granite/      (Granite model overlay)
├── llm-d/qwen/         (Qwen model overlay)
├── vllm/base/          (InferenceService, ServingRuntime, PodMonitor)
├── vllm/granite/       (Granite model overlay)
├── vllm/qwen/          (Qwen model overlay)
├── guidellm/base/      (GuideLLM benchmark job)
├── guidellm/overlays/  (Target-specific overlays)
└── monitoring/         (Prometheus + Grafana stack)
```

### Image Testing

**Score: 1/10**

This repository does not build container images. It references images from external repositories:
- `registry.access.redhat.com/ubi9/ubi:latest` (used in debug/loader pods)
- vLLM and LLM-D images (referenced by KServe ServingRuntime/LLMInferenceService)

No validation of referenced image availability, compatibility, or security posture.

### Coverage Tracking

**Score: 0/10**

No coverage tracking infrastructure:
- No `.codecov.yml` or `coveralls.yml`
- No `--coverprofile` or `pytest-cov` usage
- No coverage thresholds or PR reporting

This is expected for a playbook repository with no compiled source code, but the Python data generators (678 lines) could benefit from coverage tracking.

### CI/CD Automation

**Score: 0/10**

**Zero CI/CD infrastructure:**
- No `.github/workflows/` directory
- No `.gitlab-ci.yml`
- No `Jenkinsfile`
- No `Taskfile.yml`
- No `Makefile`
- No automated PR checks of any kind

This is the most critical gap. Every PR merges without any automated validation. The repository has 36 kustomize files, 4 shell scripts (539 lines), and 3 Python scripts (678 lines) — all merging without any automated checks.

### Static Analysis

#### Linting
- **No YAML linting**: No `.yamllint.yml` configuration. 50+ YAML files go unchecked.
- **No shell linting**: No shellcheck configuration. 4 shell scripts (539 lines) go unchecked.
- **No Python linting**: No `ruff.toml`, `.flake8`, or `mypy.ini`. 3 Python scripts (678 lines) go unchecked.

#### FIPS Compatibility
- **Not applicable**: Repository contains deployment manifests, not compiled binaries. FIPS compliance depends on the referenced container images (vLLM, LLM-D scheduler) which are built in other repositories.
- The manifests reference `registry.access.redhat.com/ubi9/ubi` (UBI-based, FIPS-capable) for utility pods.

#### Dependency Alerts
- **No Dependabot**: No `.github/dependabot.yml`
- **No Renovate**: No `renovate.json` or `.renovaterc`
- `requirements.txt` exists with `pandas` and `guidellm==0.3.1` but no automated update mechanism

#### Pre-commit Hooks
- **No pre-commit**: No `.pre-commit-config.yaml`

### Agent Rules

**Score: 0/10**

- **No `CLAUDE.md`** in root
- **No `AGENTS.md`** in root
- **No `.claude/` directory**
- **No `.claude/rules/` directory**
- **No test creation rules**
- **No contribution guidelines for AI agents**

For a playbook repository, agent rules should document:
- Kustomize base/overlay conventions
- YAML manifest naming patterns
- How to add new deployment scenarios
- How to add new model overlays
- Shell script standards (error handling, oc CLI patterns)

## Recommendations

### Priority 0 (Critical)

1. **Create a PR-triggered GitHub Actions workflow** that runs `kustomize build` on every overlay directory to validate manifest correctness. This is the single highest-impact change — it prevents broken YAML from merging.

2. **Add yamllint configuration** with a CI step to lint all YAML files. Use `relaxed` preset with key ordering disabled (Kubernetes manifests have conventional ordering).

3. **Add shellcheck CI** for the 4 shell scripts, especially the complex `discover-gpu-nic-topology.sh` (423 lines) that runs privileged commands on cluster nodes.

### Priority 1 (High Value)

4. **Add kubeconform validation** to verify generated manifests against Kubernetes and KServe CRD schemas. This catches invalid field names, wrong API versions, and missing required fields.

5. **Add a smoke-test CI job** that validates kustomize overlays produce valid `LLMInferenceService`, `Gateway`, and `HardwareProfile` resources with the expected structure.

6. **Enable Dependabot** for pip and GitHub Actions ecosystems to get automated dependency update PRs.

7. **Add pre-commit hooks** (`.pre-commit-config.yaml`) for yamllint, shellcheck, trailing whitespace, and end-of-file newlines.

### Priority 2 (Nice-to-Have)

8. **Create `CLAUDE.md`** with kustomize patterns, overlay naming conventions, and contribution guidelines for AI-assisted development.

9. **Add Python linting (ruff)** for the test-data-generator scripts.

10. **Add unit tests for Python data generators** — verify word count calculations, CSV output format, and prompt generation logic.

11. **Consider a Kind-based CI job** that deploys kustomize manifests to a local cluster (without GPU resources) to validate the deployment workflow end-to-end.

## Comparison to Gold Standards

| Dimension | llm-d-playbooks | odh-dashboard | notebooks | kserve |
|-----------|----------------|---------------|-----------|--------|
| Unit Tests | 1/10 | 9/10 | 7/10 | 8/10 |
| Integration/E2E | 2/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 2/10 | 8/10 | 8/10 | 7/10 |
| Image Testing | 1/10 | 6/10 | 9/10 | 6/10 |
| Coverage Tracking | 0/10 | 8/10 | 5/10 | 8/10 |
| CI/CD Automation | 0/10 | 9/10 | 8/10 | 9/10 |
| Static Analysis | 1/10 | 7/10 | 6/10 | 7/10 |
| Agent Rules | 0/10 | 7/10 | 3/10 | 2/10 |
| **Overall** | **1.1/10** | **8.2/10** | **7.1/10** | **7.5/10** |

The llm-d-playbooks repository is in its early stages and lacks all standard quality infrastructure. As a playbook/documentation repository, some dimensions (Image Testing, Coverage Tracking) are inherently less applicable. However, the repository still requires CI/CD automation, manifest validation, and linting to ensure the deployment guides remain correct and reliable.

## File Paths Reference

### Repository Structure
```
llm-d-playbooks/
├── README.md                              # Main documentation
├── LICENSE                                # Apache 2.0
├── .gitignore                             # Minimal (2 entries)
├── 01-cluster-install/README.md           # Cluster installation guide
├── 02-llm-d-dependencies/README.md        # Dependency installation guide
├── 03-accelerator-operator-config/        # GPU/RDMA operator configuration
│   ├── common/                            # Shared operator subscriptions
│   │   ├── 00-discover-gpus-nics/         # GPU/NIC discovery scripts (539 LOC)
│   │   ├── 01-operator-subscriptions/     # NFD, GPU, Network operator YAML
│   │   ├── 02-nfd-operands/               # NodeFeatureDiscovery/Rule
│   │   ├── 20-gpu-readiness/              # MOFED/network operator readiness
│   │   └── 21-gpu-operands/               # ClusterPolicy, ConfigMap
│   └── bare-metal-a100-ib/               # Case study: A100 + InfiniBand
├── 04-validate-cluster-ready/README.md    # Cluster validation guide
└── 05-deploy-and-benchmark/              # Deployment and benchmarking
    ├── intelligent-inference-scheduler/   # A/B benchmark: vLLM vs LLM-D
    │   ├── llm-d/                        # LLMInferenceService manifests
    │   ├── vllm/                         # KServe InferenceService manifests
    │   ├── guidellm/                     # GuideLLM benchmark jobs
    │   ├── monitoring/                   # Prometheus + Grafana stack
    │   ├── test-data-generator/          # Python prompt generators (678 LOC)
    │   └── smoke-test.yaml              # Manual smoke test Job
    └── pd-disaggregation/               # PD disaggregation scenario
```

### Key Configuration Files
- **Kustomize overlays**: 36 `kustomization.yaml` files across all deployment scenarios
- **Shell scripts**: `discover-gpu-nic-topology.sh` (423 LOC), `debug-nics.sh` (116 LOC)
- **Python generators**: `prefix-cache-generator.py`, `kv-cache-prompt-generator.py`, `heterogeneous-workload-generator.py`
- **Dependencies**: `test-data-generator/requirements.txt` (pandas, guidellm==0.3.1)
- **K8s Resources**: LLMInferenceService, Gateway, HardwareProfile, InferenceService, ServingRuntime, ClusterPolicy

### Missing Files (Expected)
- `.github/workflows/*.yml` — No CI/CD workflows
- `.github/dependabot.yml` — No dependency automation
- `.pre-commit-config.yaml` — No pre-commit hooks
- `.yamllint.yml` — No YAML linting config
- `Makefile` — No build targets
- `CLAUDE.md` / `.claude/` — No agent rules
