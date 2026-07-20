---
repository: "red-hat-data-services/must-gather"
overall_score: 2.2
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No unit tests exist for any of the ~1,000 lines of shell scripts"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E test suites; scripts are untested against mock or real clusters"
  - dimension: "Build Integration"
    score: 7.0
    status: "Konflux PR pipeline with multi-arch builds (x86_64, ppc64le, s390x, arm64) and hermetic mode"
  - dimension: "Image Testing"
    score: 3.0
    status: "Dockerfiles present with multi-arch support but no runtime validation or health checks"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling configured; no thresholds or PR reporting"
  - dimension: "CI/CD Automation"
    score: 3.0
    status: "Basic Super-Linter for bash on PRs; Tekton Konflux builds; no test automation"
  - dimension: "Static Analysis"
    score: 4.0
    status: "Super-Linter bash validation and inline ShellCheck directives; Renovate configured; no pre-commit hooks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory present"
critical_gaps:
  - title: "Zero test coverage across all ~1,000 lines of shell scripts"
    impact: "Regressions in collection scripts go undetected until customer support incidents; broken must-gather output delays troubleshooting"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No integration testing against mock clusters"
    impact: "Component gather scripts may silently fail or collect incomplete data without detection"
    severity: "HIGH"
    effort: "24-40 hours"
  - title: "No image runtime validation"
    impact: "Container startup failures or missing binaries (kubectl, helm, oc) not caught until deployment"
    severity: "MEDIUM"
    effort: "4-8 hours"
quick_wins:
  - title: "Add BATS unit tests for common.sh utility functions"
    effort: "4-6 hours"
    impact: "Cover core functions like uniq_list, rhoai_version, get_log_collection_args, detect_k8s_distro with deterministic tests"
  - title: "Add ShellCheck pre-commit hook"
    effort: "1-2 hours"
    impact: "Enforce shell script quality before commits, complementing existing CI linting"
  - title: "Add container smoke test to CI"
    effort: "2-4 hours"
    impact: "Verify built image starts, entrypoint exists, and required binaries (kubectl, helm) are present"
  - title: "Create CLAUDE.md with contribution guidelines"
    effort: "1-2 hours"
    impact: "Guide AI-assisted development and ensure consistent script patterns"
recommendations:
  priority_0:
    - "Introduce BATS (Bash Automated Testing System) for unit testing utility functions in common.sh and xks_util.sh"
    - "Add container smoke tests that verify image startup, entrypoint, and binary availability"
    - "Create integration tests using mocked kubectl/oc commands to validate gather script logic"
  priority_1:
    - "Add .pre-commit-config.yaml with shellcheck and shfmt hooks"
    - "Add BATS tests for each gather_*.sh component script using stubbed kubectl responses"
    - "Implement coverage tracking with kcov or bashcov for shell script coverage"
  priority_2:
    - "Create CLAUDE.md and .claude/rules/ for shell script development guidelines"
    - "Add Dependabot configuration alongside existing Renovate for broader ecosystem coverage"
    - "Add E2E tests using Kind cluster to validate full must-gather collection flow"
---

# Quality Analysis: red-hat-data-services/must-gather

## Executive Summary

- **Overall Score: 2.2/10**
- **Repository Type**: Shell-script based diagnostic tool (must-gather) for Red Hat OpenShift AI
- **Primary Language**: Bash (~1,007 lines across 22 shell scripts)
- **Tier**: Downstream (Jira: RHOAIENG / AI Core Platform)
- **Key Strengths**: Solid Konflux build integration with multi-arch support; functional bash linting via Super-Linter; Renovate configured for dependency management
- **Critical Gaps**: Zero test coverage of any kind; no integration testing against mock clusters; no runtime image validation
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 0/10 | 15% | 0.00 | No unit tests for any shell scripts |
| Integration/E2E | 0/10 | 20% | 0.00 | No integration or E2E test suites |
| Build Integration | 7/10 | 15% | 1.05 | Konflux PR pipeline with multi-arch hermetic builds |
| Image Testing | 3/10 | 10% | 0.30 | Dockerfiles present, no runtime validation |
| Coverage Tracking | 0/10 | 10% | 0.00 | No coverage tooling configured |
| CI/CD Automation | 3/10 | 15% | 0.45 | Basic linting + Konflux builds only |
| Static Analysis | 4/10 | 10% | 0.40 | Super-Linter bash + ShellCheck directives + Renovate |
| Agent Rules | 0/10 | 5% | 0.00 | No agent rules present |
| **Overall** | **2.2/10** | **100%** | **2.20** | |

## Critical Gaps

### 1. Zero Test Coverage Across ~1,000 Lines of Shell Scripts
- **Impact**: Regressions in collection scripts go undetected until customer support incidents. A broken must-gather delays troubleshooting for customers and support engineers.
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: The repository contains 22 shell scripts with no test files of any kind. Functions like `detect_k8s_distro`, `rhoai_version`, `get_log_collection_args`, `uniq_list`, and `auto_discover_resources` are critical logic that should be tested.

### 2. No Integration Testing Against Mock Clusters
- **Impact**: Component gather scripts (17 component-specific scripts) may silently fail or collect incomplete data. Changes to resource names, API versions, or namespace logic are not validated before merge.
- **Severity**: HIGH
- **Effort**: 24-40 hours
- **Details**: Each `gather_*.sh` script constructs resource lists and namespace queries. These should be tested with stubbed `kubectl`/`oc` responses to verify correct resource collection.

### 3. No Container Image Runtime Validation
- **Impact**: Container startup failures, missing binaries (kubectl, helm, oc), or incorrect entrypoints not caught until the image is used in production.
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: Both `Containerfile` and `Dockerfile.konflux` install external binaries (kubectl, helm) and copy scripts. No CI step verifies the built image actually starts and has the required tools available.

## Quick Wins

### 1. Add BATS Unit Tests for common.sh Utility Functions (4-6 hours)
- **Impact**: Cover core functions with deterministic tests
- **Implementation**: Install [BATS](https://github.com/bats-core/bats-core) and create `test/` directory

```bash
# test/common_test.bats
#!/usr/bin/env bats

setup() {
  source collection-scripts/common.sh
}

@test "uniq_list removes duplicates" {
  result=$(uniq_list "ns1 ns2 ns1 ns3 ns2")
  [ "$result" = "ns1
ns2
ns3" ]
}

@test "get_log_collection_args sets since flag" {
  export MUST_GATHER_SINCE="3h"
  get_log_collection_args
  [ "$log_collection_args" = "--since=3h" ]
}

@test "get_log_collection_args sets since-time flag" {
  unset MUST_GATHER_SINCE
  export MUST_GATHER_SINCE_TIME="2024-05-02T14:01:23Z"
  get_log_collection_args
  [ "$log_collection_args" = "--since-time=2024-05-02T14:01:23Z" ]
}
```

### 2. Add ShellCheck Pre-commit Hook (1-2 hours)
- **Impact**: Enforce shell script quality before commits

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/shellcheck-py/shellcheck-py
    rev: v0.10.0.1
    hooks:
      - id: shellcheck
        args: ['--severity=warning']
        files: '\.sh$'
  - repo: https://github.com/scop/pre-commit-shfmt
    rev: v3.8.0-1
    hooks:
      - id: shfmt
        args: ['-i', '4', '-ci']
```

### 3. Add Container Smoke Test to CI (2-4 hours)
- **Impact**: Verify built image starts and required binaries are present

```yaml
# Add to .github/workflows/linter.yml or new workflow
  smoke-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -f Containerfile -t must-gather:test .
      - name: Verify entrypoint exists
        run: docker run --rm --entrypoint /bin/bash must-gather:test -c "test -x /usr/bin/gather"
      - name: Verify kubectl is installed
        run: docker run --rm --entrypoint /bin/bash must-gather:test -c "kubectl version --client"
      - name: Verify helm is installed
        run: docker run --rm --entrypoint /bin/bash must-gather:test -c "helm version"
      - name: Verify collection scripts are present
        run: docker run --rm --entrypoint /bin/bash must-gather:test -c "ls /usr/bin/gather_*.sh | wc -l"
```

### 4. Create CLAUDE.md with Contribution Guidelines (1-2 hours)
- **Impact**: Guide AI-assisted development

```markdown
# must-gather

## Overview
Shell-script based must-gather tool for Red Hat OpenShift AI diagnostics.

## Development
- All collection scripts are in `collection-scripts/`
- Use `shellcheck` for linting before committing
- Follow existing patterns when adding new component gather scripts
- Always source `common.sh` for shared functions
- Add new components to the case statement in `gather.sh`

## Testing
- Run `bats test/` to execute unit tests
- Use `make build-must-gather` to build the container locally
```

## Detailed Findings

### Unit Tests
- **Score: 0/10**
- **Test Files Found**: 0
- **Test-to-Code Ratio**: 0:1
- **Framework**: None
- **Details**: No test files exist anywhere in the repository. The ~1,007 lines of shell scripts across 22 files have zero automated test coverage. Key functions that would benefit from unit testing include:
  - `detect_k8s_distro()` in `xks_util.sh` (179 lines) - critical platform detection logic
  - `uniq_list()`, `rhoai_version()`, `get_log_collection_args()` in `common.sh` (140 lines)
  - `auto_discover_resources()`, `kubectl_inspect()` in `xks_util.sh`
- **Recommended Framework**: [BATS (Bash Automated Testing System)](https://github.com/bats-core/bats-core)

### Integration/E2E Tests
- **Score: 0/10**
- **Integration Test Directories**: None (`e2e/`, `integration/`, `test/` all absent)
- **Cluster Setup**: None (no Kind, Minikube, or envtest)
- **Multi-version Testing**: None
- **Details**: The must-gather tool interacts with Kubernetes clusters via `oc`/`kubectl` commands. Integration tests could use stubbed command responses to validate:
  - Correct resource lists for each component gather script
  - Namespace discovery logic across 17+ component scripts
  - Parallel job execution in `gather.sh` (the main script runs 15 component scripts in parallel)
  - Error handling when components are missing
  - xKS platform detection (OCP, AKS, EKS, CKS)

### Build Integration
- **Score: 7/10**
- **Strengths**:
  - Tekton/Konflux pipeline (`.tekton/odh-must-gather-pull-request.yaml`) configured for PR builds
  - Multi-architecture support: `linux/x86_64`, `linux/ppc64le`, `linux/s390x`, `linux-m2xlarge/arm64`
  - Hermetic builds enabled (`hermetic: true`)
  - Build image index enabled for multi-arch manifests
  - PR images expire after 5 days (`image-expires-after: 5d`)
  - Cancel-in-progress for concurrent PR builds
  - Uses `Dockerfile.konflux` (multi-stage with pinned digests)
- **Gaps**:
  - Konflux build is triggered on labels/comments only, not on every PR push
  - No build validation tests (no smoke test after build)
  - No manifest validation (kustomize, CRD)
- **Files Analyzed**: `.tekton/odh-must-gather-pull-request.yaml`, `Makefile`, `Containerfile`, `Dockerfile.konflux`

### Image Testing
- **Score: 3/10**
- **Containerfile Analysis**:
  - Base: `quay.io/openshift/origin-must-gather:4.21.0` (OpenShift base)
  - Installs kubectl (`v1.34.7`) and helm (`v4.1.4`) via curl
  - No multi-stage build (single FROM)
  - No HEALTHCHECK directive
  - No `.dockerignore` file
- **Dockerfile.konflux Analysis**:
  - Multi-stage build: copies kubectl from `ose-cli-rhel9` builder stage
  - Base: `registry.redhat.io/openshift4/ose-must-gather-rhel9:v4.20` (UBI-based, FIPS-capable)
  - Pinned by SHA digest for reproducibility
  - Proper Red Hat labels present
  - Copies helm binary from build context (tracked via Git LFS)
- **Gaps**:
  - No runtime validation (testcontainers, docker run tests)
  - No image startup testing
  - No health checks or readiness probes
  - No `.dockerignore` to exclude `.git/` and other unnecessary files

### Coverage Tracking
- **Score: 0/10**
- **Coverage Configuration**: None
- **Coverage Reporting**: None
- **Details**: No `.codecov.yml`, `codecov.yml`, `.coveragerc`, or any coverage configuration exists. For shell scripts, [kcov](https://github.com/SimonKagworkeright/kcov) or [bashcov](https://github.com/infertux/bashcov) could provide line-level coverage tracking.

### CI/CD Automation
- **Score: 3/10**
- **Workflow Inventory**:
  | Workflow | Trigger | Purpose |
  |----------|---------|---------|
  | `linter.yml` | PR to main/master/rhoai-* | Super-Linter for bash validation |
  | Tekton PR pipeline | PR labels/comments | Konflux multi-arch image build |
- **Strengths**:
  - Super-Linter validates both BASH syntax and BASH_EXEC on collection-scripts directory
  - Tekton pipeline has cancel-in-progress for concurrent builds
  - Focused linting scope (only `collection-scripts/`)
- **Gaps**:
  - No test automation (no tests to run)
  - No concurrency control in GitHub Actions workflow
  - No caching strategies
  - No timeout configuration
  - No matrix/parallelization strategies
  - Only one GitHub Actions workflow

### Static Analysis
- **Score: 4/10**
- **Linting**:
  - Super-Linter v5.0.0 configured for `VALIDATE_BASH` and `VALIDATE_BASH_EXEC`
  - Scoped to `collection-scripts/` directory via `FILTER_REGEX_INCLUDE`
  - Inline ShellCheck directives present in scripts (e.g., `# shellcheck disable=SC2154,SC1091,SC2086,SC2155`)
- **FIPS Compatibility**: N/A - Shell scripts only; no compiled code or crypto imports. Base images in `Dockerfile.konflux` are UBI-based (FIPS-capable).
- **Dependency Alerts**:
  - Renovate configured (`.github/renovate.json`) extending from `red-hat-data-services/konflux-central` defaults
  - No Dependabot configuration
- **Pre-commit Hooks**: None (no `.pre-commit-config.yaml`)
- **Gaps**:
  - Super-Linter v5.0.0 is outdated (v7+ available)
  - No pre-commit hooks for local development
  - No `shfmt` for consistent formatting
  - ShellCheck disable directives used extensively without documentation of why

### Agent Rules
- **Score: 0/10**
- **Status**: Missing
- **Details**: No `CLAUDE.md`, `AGENTS.md`, `.claude/` directory, or any agent rules present. For a shell-script repository, agent rules would help guide:
  - Shell script patterns and conventions
  - How to add new component gather scripts
  - Testing requirements for new scripts
  - ShellCheck compliance expectations

## Recommendations

### Priority 0 (Critical)

1. **Introduce BATS unit tests for core utility functions** (16-24 hours)
   - Install BATS as a dev dependency
   - Create `test/` directory with test files for `common.sh` and `xks_util.sh`
   - Test: `uniq_list`, `rhoai_version`, `get_log_collection_args`, `detect_k8s_distro`
   - Add BATS test execution to CI workflow

2. **Add container smoke tests** (4-8 hours)
   - Verify image builds successfully
   - Verify entrypoint (`/usr/bin/gather`) is executable
   - Verify required binaries (kubectl, helm, oc) are present and executable
   - Verify all collection scripts are copied correctly

3. **Create integration tests with stubbed kubectl/oc** (24-40 hours)
   - Create mock `kubectl`/`oc` scripts that return predetermined output
   - Test each `gather_*.sh` script independently
   - Verify correct resource lists, namespace discovery, and error handling
   - Test parallel execution logic in main `gather.sh`

### Priority 1 (High Value)

4. **Add pre-commit hooks** (1-2 hours)
   - Configure `.pre-commit-config.yaml` with shellcheck and shfmt
   - Enforce consistent formatting and catch issues before commit

5. **Add BATS tests for component gather scripts** (16-24 hours)
   - Test each of the 17 component gather scripts
   - Verify resource arrays are correct
   - Verify namespace discovery works for each component

6. **Implement shell script coverage tracking** (4-6 hours)
   - Configure kcov or bashcov for coverage measurement
   - Add coverage thresholds and PR reporting
   - Track coverage trend over time

### Priority 2 (Nice-to-Have)

7. **Create CLAUDE.md and agent rules** (2-3 hours)
   - Document shell script conventions and patterns
   - Add rules for new component script creation
   - Include testing requirements

8. **Add E2E tests with Kind cluster** (40+ hours)
   - Set up Kind cluster with mock CRDs
   - Run full must-gather collection
   - Validate output directory structure and content
   - Test component-specific collection modes

9. **Upgrade Super-Linter to v7+** (1-2 hours)
   - Current v5.0.0 is significantly outdated
   - Newer versions have better bash analysis capabilities

## Comparison to Gold Standards

| Dimension | must-gather | odh-dashboard | notebooks | kserve |
|-----------|-------------|---------------|-----------|--------|
| Unit Tests | 0/10 | 9/10 | 7/10 | 8/10 |
| Integration/E2E | 0/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 7/10 | 8/10 | 9/10 | 7/10 |
| Image Testing | 3/10 | 7/10 | 9/10 | 6/10 |
| Coverage Tracking | 0/10 | 8/10 | 6/10 | 8/10 |
| CI/CD Automation | 3/10 | 9/10 | 8/10 | 9/10 |
| Static Analysis | 4/10 | 8/10 | 7/10 | 7/10 |
| Agent Rules | 0/10 | 8/10 | 5/10 | 3/10 |
| **Overall** | **2.2** | **8.4** | **7.6** | **7.4** |

**Key Gaps vs Gold Standards**:
- **vs odh-dashboard**: Missing all testing layers, no coverage enforcement, no comprehensive CI/CD
- **vs notebooks**: Missing image testing validation, no multi-layer test strategy
- **vs kserve**: Missing unit and integration tests, no coverage tracking

## File Paths Reference

| File | Purpose |
|------|---------|
| `.github/workflows/linter.yml` | Super-Linter bash validation on PRs |
| `.github/renovate.json` | Renovate dependency management config |
| `.tekton/odh-must-gather-pull-request.yaml` | Konflux PR build pipeline (multi-arch) |
| `Containerfile` | Upstream container build (origin-must-gather base) |
| `Dockerfile.konflux` | Downstream container build (UBI-based, pinned digests) |
| `Makefile` | Build and push targets |
| `collection-scripts/gather.sh` | Main entrypoint (250 lines) |
| `collection-scripts/common.sh` | Shared utility functions (140 lines) |
| `collection-scripts/llm-d/xks_util.sh` | Kubernetes distro detection and kubectl-based inspection (179 lines) |
| `collection-scripts/llm-d/gather_llmd.sh` | LLM-D specific resource collection (97 lines) |
| `collection-scripts/gather_serving.sh` | KServe resource collection |
| `collection-scripts/gather_*.sh` | Component-specific gather scripts (15 scripts) |
