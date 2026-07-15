---
repository: "red-hat-data-services/rhoai-upgrade-helpers"
overall_score: 2.4
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No test files exist; zero automated testing"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E test infrastructure"
  - dimension: "Build Integration"
    score: 0.0
    status: "No CI/CD workflows, no PR validation, no build pipeline"
  - dimension: "Image Testing"
    score: 0.0
    status: "No container images built; not applicable to this repo"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling or enforcement"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "No GitHub Actions workflows, no CI of any kind"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent guidance"
  - dimension: "Script Quality"
    score: 6.5
    status: "Good defensive scripting practices: set -euo pipefail, dry-run, help, input validation"
  - dimension: "Documentation"
    score: 7.0
    status: "Each component has a README; scripts have inline help and usage examples"
  - dimension: "Code Organization"
    score: 6.0
    status: "Clean per-component directory layout; consistent patterns across scripts"
critical_gaps:
  - title: "Zero automated testing"
    impact: "Scripts that modify live OpenShift clusters (delete resources, patch CRs, migrate data) have no tests. A single bug can destroy customer workloads during upgrade."
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No CI/CD pipeline"
    impact: "PRs are merged without any automated validation. No shellcheck, no linting, no syntax checking. Regressions can be introduced silently."
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No ShellCheck linting"
    impact: "19 shell scripts totaling ~9,500 lines have no static analysis. Common shell pitfalls (word splitting, quoting, uninitialized variables) go undetected."
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Repository is deprecated with no successor"
    impact: "Marked deprecated in README but scripts are still being actively committed to (57 PRs merged). Users may run outdated/broken scripts on production clusters."
    severity: "MEDIUM"
    effort: "N/A - organizational decision"
  - title: "No security scanning"
    impact: "Scripts execute kubectl/oc commands with cluster-admin privileges. No secret detection, no dependency scanning for Python scripts."
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add ShellCheck CI workflow"
    effort: "1-2 hours"
    impact: "Catch common shell scripting bugs across all 19 scripts automatically on every PR"
  - title: "Add Python linting (ruff) CI workflow"
    effort: "1 hour"
    impact: "Lint the 2 Python scripts for common errors and style issues"
  - title: "Add BATS unit tests for critical functions"
    effort: "4-8 hours"
    impact: "Test parsing, validation, and transformation logic in isolation without a live cluster"
  - title: "Add CODEOWNERS file"
    effort: "30 minutes"
    impact: "Ensure appropriate reviewers for each component area"
  - title: "Add pre-commit hooks"
    effort: "1 hour"
    impact: "Catch formatting and linting issues before code reaches PR"
recommendations:
  priority_0:
    - "Add a GitHub Actions CI workflow with ShellCheck for all .sh files and ruff/mypy for .py files"
    - "Add BATS-based unit tests for the most critical scripts (workbench migration, model-serving migration, ray cluster migration)"
    - "Add a basic PR template requiring manual test evidence since scripts target live clusters"
  priority_1:
    - "Add dry-run integration tests using mock kubectl/oc commands (bats-mock or shunit2)"
    - "Add Python unit tests for ray_cluster_migration.py using pytest with mocked kubernetes client"
    - "Create CLAUDE.md and .claude/rules/ for consistent script development and testing patterns"
  priority_2:
    - "Add version pinning and checksum verification for external tool dependencies (jq, oc, kubectl)"
    - "Consolidate common shell functions (logging, color output, argument parsing) into a shared library"
    - "Add end-to-end smoke tests using Kind/Minikube with mock CRDs"
---

# Quality Analysis: rhoai-upgrade-helpers

## Executive Summary

- **Overall Score: 2.4/10**
- **Repository Status: DEPRECATED** (per README warning, but still receiving active contributions)
- **Type**: Collection of shell/Python upgrade helper scripts for RHOAI migrations
- **Languages**: Bash (19 scripts, ~9,500 lines), Python (2 scripts, ~3,200 lines)
- **Contributors**: 20+ contributors, 111 commits, 57+ merged PRs
- **Key Strengths**: Good defensive scripting practices, dry-run support, comprehensive documentation
- **Critical Gaps**: Zero automated tests, zero CI/CD, zero linting, zero security scanning
- **Agent Rules Status**: Missing - no CLAUDE.md, no .claude/ directory

The repository contains operationally critical scripts that directly modify live OpenShift clusters during RHOAI upgrades. Despite the high-risk nature of these operations (deleting resources, patching CRs, migrating data), there is **no automated testing or CI/CD of any kind**. The individual scripts show good engineering practices (error handling, dry-run modes, input validation), but the repository-level quality infrastructure is completely absent.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No test files exist |
| Integration/E2E | 0/10 | No integration test infrastructure |
| **Build Integration** | **0/10** | **No CI/CD workflows at all** |
| Image Testing | N/A | No container images (script-only repo) |
| Coverage Tracking | 0/10 | No coverage tooling |
| CI/CD Automation | 0/10 | No GitHub Actions, no CI of any kind |
| Agent Rules | 0/10 | No CLAUDE.md or .claude/ directory |
| Script Quality | 6.5/10 | Good defensive practices in individual scripts |
| Documentation | 7/10 | Per-component READMEs, inline help |
| Code Organization | 6/10 | Clean directory layout by component |

## Critical Gaps

### 1. Zero Automated Testing (Severity: HIGH)
- **Impact**: Scripts that delete InferenceServices, patch workbench CRs, migrate RayClusters, and backup/restore TrustyAI data have zero automated tests. A single bug in these scripts can destroy customer workloads during upgrade.
- **Evidence**: `find . -name "*_test.*" -o -name "*.spec.*" -o -name "*.test.*" -o -name "test_*"` returns zero results.
- **Effort**: 16-24 hours to add comprehensive BATS tests for shell scripts and pytest tests for Python scripts.

### 2. No CI/CD Pipeline (Severity: HIGH)
- **Impact**: PRs are merged without any automated validation. No shellcheck, no linting, no syntax checking. The `.github/workflows/` directory does not exist.
- **Evidence**: `ls .github/workflows/` returns "No .github/workflows directory".
- **Effort**: 4-8 hours for a comprehensive CI workflow.

### 3. No Static Analysis / Linting (Severity: HIGH)
- **Impact**: 19 shell scripts (~9,500 lines) have no ShellCheck analysis. 2 Python scripts (~3,200 lines) have no ruff/flake8/mypy analysis. Common shell pitfalls go undetected.
- **Evidence**: No `.shellcheckrc`, no `ruff.toml`, no `.flake8`, no linting configuration files.
- **Effort**: 2-4 hours to add ShellCheck + ruff.

### 4. Deprecated But Actively Used (Severity: MEDIUM)
- **Impact**: README contains a deprecation warning, but the repo has 111 commits and 57+ merged PRs. Users may not see the warning and run potentially outdated scripts.
- **Evidence**: README.md starts with `> [!WARNING] > This repository is deprecated`.
- **Effort**: Organizational decision needed on lifecycle.

### 5. No Security Scanning (Severity: MEDIUM)
- **Impact**: Scripts execute with cluster-admin privileges. Python dependencies (`kubernetes>=28.1.0`, `PyYAML>=6.0`) have no automated vulnerability scanning. No secret detection.
- **Evidence**: No `.gitleaks.toml`, no Trivy config, no CodeQL workflow.
- **Effort**: 2-4 hours.

## Quick Wins

### 1. Add ShellCheck CI Workflow (1-2 hours)
Add a GitHub Actions workflow that runs ShellCheck on all `.sh` files:

```yaml
name: Lint
on: [pull_request]
jobs:
  shellcheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: ShellCheck
        uses: ludeeus/action-shellcheck@master
        with:
          scandir: '.'
          severity: warning
```

### 2. Add Python Linting (1 hour)
Add ruff to the CI workflow for the 2 Python scripts:

```yaml
  python-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/ruff-action@v3
```

### 3. Add BATS Unit Tests for Critical Functions (4-8 hours)
The `workbench-2.x-to-3.x-upgrade.sh` (1,526 lines) and `modelmesh-to-raw.sh` (2,240 lines) contain pure functions that can be tested in isolation with BATS:

```bash
# test/workbench-upgrade.bats
@test "parse_arguments rejects missing --namespace" {
  run ./workbenches/workbench-2.x-to-3.x-upgrade.sh patch
  [ "$status" -ne 0 ]
  [[ "$output" == *"namespace"* ]]
}
```

### 4. Add CODEOWNERS File (30 minutes)
```
# Component owners
/trustyai/     @christinaexyou @RobGeada
/ray/          @red-hat-data-services/codeflare
/model-serving/ @red-hat-data-services/model-serving
/workbenches/  @red-hat-data-services/workbenches
/ai_pipelines/ @red-hat-data-services/pipelines
```

### 5. Add Pre-commit Hooks (1 hour)
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/koalaman/shellcheck-precommit
    rev: v0.10.0
    hooks:
      - id: shellcheck
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
```

## Detailed Findings

### CI/CD Pipeline

**Status: Non-existent**

- No `.github/workflows/` directory
- No `.gitlab-ci.yml`
- No `Jenkinsfile`
- No `Makefile`
- No build automation of any kind
- PRs are reviewed manually with zero automated checks

### Test Coverage

**Status: Zero test coverage**

- No test files found anywhere in the repository
- No testing framework configured
- No test directories (`test/`, `tests/`, `e2e/`)
- No coverage generation or tracking
- No `pytest.ini`, `setup.cfg`, or test configuration

### Code Quality

**Status: Mixed - good script practices, no tooling**

**Strengths (per-script level):**
- 14 of 19 scripts use `set -euo pipefail` or `set -o pipefail; set -u` for defensive error handling
- 7 scripts support `--dry-run` mode (trustyai, model-serving, workbenches)
- 15 scripts include `usage()` or `--help` documentation
- 4 scripts validate argument inputs before execution
- Consistent color-coded output across scripts
- The Python `ray_cluster_migration.py` (2,838 lines) is well-structured with type hints, proper error handling, and comprehensive docstrings

**Weaknesses (repo level):**
- No ShellCheck configuration or enforcement
- No Python linting (ruff, flake8, mypy)
- No pre-commit hooks
- No code formatting standards
- No `.editorconfig`

### Container Images

**Status: Not Applicable**

This repository does not build container images. It is a collection of scripts meant to be run directly by operators/SREs.

### Security

**Status: No security practices**

- No secret detection (Gitleaks, TruffleHog)
- No dependency scanning for Python packages
- No SAST tools
- No CodeQL integration
- Scripts run with cluster-admin privileges but have no privilege validation
- Python `requirements.txt` uses minimum version pins (`>=`) rather than exact pins

### Agent Rules (Agentic Flow Quality)

**Status: Missing**

- No `CLAUDE.md` or `AGENTS.md` in root
- No `.claude/` directory
- No `.claude/rules/` for test creation guidance
- No `.claude/skills/` for custom skills
- No testing documentation beyond per-script inline comments
- **Recommendation**: Generate rules with `/test-rules-generator` to establish patterns for:
  - Shell script testing with BATS
  - Python testing with pytest
  - Mock kubectl/oc patterns for offline testing
  - Dry-run validation patterns

### Documentation

**Status: Good**

- Root README with deprecation notice
- Per-component READMEs (`workbenches/README.md`, `trustyai/README.md`, `model-serving/before-upgrade/README.md`, etc.)
- Inline script documentation with usage examples
- `ray/PERMISSIONS.md` documenting required RBAC
- `ray/RAY_CLUSTER_MIGRATION_README.md` with step-by-step migration guide
- Python docstrings with comprehensive usage examples

### Code Organization

**Status: Adequate**

```
rhoai-upgrade-helpers/
  ai_pipelines/          # DSPA pre/post-upgrade checks, role updates
  dashboard/             # Dashboard redirect generator
  kubeflow-trainer/      # Trainer verification
  llamastack/            # LlamaStack backup
  model-serving/         # Serverless-to-raw migration, ModelMesh migration
    before-upgrade/      # Pre-upgrade scripts
    after-upgrade/       # Post-upgrade scripts
    modelruntimes-check/ # Serving runtime validation
  ray/                   # RayCluster migration tool (Python)
  trustyai/              # TrustyAI backup/restore, GPU deadlock fix
  workbenches/           # Workbench 2.x to 3.x migration
```

Each component has its own directory with related scripts and a README. The layout is intuitive and follows the RHOAI component structure.

## Recommendations

### Priority 0 (Critical)

1. **Add GitHub Actions CI with ShellCheck + ruff** - Every PR should at minimum pass static analysis. This is the single highest-ROI investment for this repository.

2. **Add BATS unit tests for the 3 highest-risk scripts**:
   - `workbenches/workbench-2.x-to-3.x-upgrade.sh` (1,526 lines) - patches and restarts workbenches
   - `model-serving/before-upgrade/modelmesh-to-raw.sh` (2,240 lines) - deletes and recreates InferenceServices
   - `model-serving/before-upgrade/serverless-to-raw.sh` (1,651 lines) - converts deployment modes

3. **Add pytest tests for `ray/ray_cluster_migration.py`** - This 2,838-line Python script handles RayCluster migration with backup/restore. It has proper structure for testing but zero tests. Use `unittest.mock` to mock the Kubernetes client.

### Priority 1 (High Value)

4. **Add dry-run integration tests** - Scripts that support `--dry-run` can be tested by verifying their output and generated files without a live cluster.

5. **Create CLAUDE.md and agent rules** - Establish patterns for how AI agents should write and test scripts in this repo.

6. **Add PR template** - Require manual test evidence (screenshot or log output) since many scripts can only be fully tested against a live cluster.

7. **Pin Python dependencies** - Change `>=` to `==` in `ray_cluster_migration_requirements.txt` to prevent supply-chain attacks.

### Priority 2 (Nice-to-Have)

8. **Extract shared shell library** - Common patterns (logging, color output, argument parsing, oc/kubectl detection) are duplicated across scripts. Extract to a `lib/common.sh`.

9. **Add end-to-end smoke tests with Kind** - Create mock CRDs and test script behavior against a disposable Kind cluster.

10. **Add CODEOWNERS and branch protection** - Require component-specific reviewers for each directory.

## Comparison to Gold Standards

| Practice | odh-dashboard | notebooks | rhoai-upgrade-helpers |
|----------|--------------|-----------|----------------------|
| CI/CD Workflows | Comprehensive (lint, test, build, deploy) | Multi-layer (build, test, scan) | **None** |
| Unit Tests | Jest + React Testing Library | Python pytest | **None** |
| Integration Tests | Cypress E2E | Notebook execution tests | **None** |
| Coverage Tracking | Codecov with enforcement | Per-image coverage | **None** |
| Linting | ESLint + Prettier | Ruff + MyPy | **None** |
| Security Scanning | Snyk, CodeQL | Trivy, Snyk | **None** |
| Pre-commit Hooks | Husky + lint-staged | pre-commit framework | **None** |
| Agent Rules | Comprehensive .claude/rules/ | Basic CLAUDE.md | **None** |
| Documentation | Extensive | Per-image READMEs | Good per-component READMEs |
| Dry-run Support | N/A | N/A | **7/19 scripts** (strength) |
| Error Handling | Try/catch, error boundaries | Exception handling | **set -euo pipefail** (strength) |

## File Paths Reference

### Key Files Analyzed
| File | Lines | Purpose |
|------|-------|---------|
| `workbenches/workbench-2.x-to-3.x-upgrade.sh` | 1,526 | Workbench OAuth to kube-rbac-proxy migration |
| `model-serving/before-upgrade/modelmesh-to-raw.sh` | 2,240 | ModelMesh to raw deployment conversion |
| `model-serving/before-upgrade/serverless-to-raw.sh` | 1,651 | Serverless to raw deployment conversion |
| `ray/ray_cluster_migration.py` | 2,838 | RayCluster migration tool |
| `trustyai/backup-data.sh` | 647 | TrustyAI data backup |
| `trustyai/restore-data.sh` | 550 | TrustyAI data restore |
| `ai_pipelines/check_before_upgrade.sh` | 223 | DSPA pre-upgrade validation |
| `dashboard/generate-dashboard-redirect.py` | 344 | Dashboard redirect YAML generator |

### Missing Files (Expected)
- `.github/workflows/*.yml` - No CI/CD
- `test/` or `tests/` - No test directory
- `.shellcheckrc` - No ShellCheck config
- `Makefile` - No build automation
- `.pre-commit-config.yaml` - No pre-commit hooks
- `CLAUDE.md` - No agent guidance
- `CODEOWNERS` - No ownership
- `LICENSE` - No license file
