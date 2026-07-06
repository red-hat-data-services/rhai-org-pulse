---
repository: "opendatahub-io/kserve-raw-migration"
overall_score: 1.4
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No tests of any kind exist in the repository"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests; script requires live OpenShift cluster to validate"
  - dimension: "Build Integration"
    score: 0.0
    status: "No CI/CD workflows, no build validation, no PR checks"
  - dimension: "Image Testing"
    score: 0.0
    status: "No container images built or tested; repository is a bash script tool"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling of any kind"
  - dimension: "CI/CD Automation"
    score: 1.0
    status: "No workflows exist; OWNERS file provides basic review governance"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No .claude directory, no CLAUDE.md, no agent rules"
critical_gaps:
  - title: "Zero CI/CD pipeline"
    impact: "No automated checks on PRs — broken scripts can be merged without any validation"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No tests at all"
    impact: "Bash script has ~1060 lines of complex logic with no test coverage; regressions go undetected"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No linting or static analysis"
    impact: "Shell script bugs (quoting issues, unset variables, command injection) are not caught"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No security scanning"
    impact: "Script handles RBAC, secrets, and service account tokens with no security review automation"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No agent rules or test automation guidance"
    impact: "AI-assisted contributions have no guardrails or standards to follow"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add ShellCheck linting via GitHub Actions"
    effort: "1-2 hours"
    impact: "Catches common bash pitfalls (unquoted variables, missing error handling, syntax issues)"
  - title: "Add BATS (Bash Automated Testing System) unit tests"
    effort: "4-6 hours"
    impact: "Test argument parsing, helper functions, and transformation logic in isolation"
  - title: "Add basic PR workflow with ShellCheck + BATS"
    effort: "2-3 hours"
    impact: "Prevents broken scripts from being merged; establishes quality baseline"
  - title: "Add pre-commit hooks for shell formatting"
    effort: "1 hour"
    impact: "Consistent script formatting with shfmt; catches issues before commit"
recommendations:
  priority_0:
    - "Create GitHub Actions CI workflow with ShellCheck static analysis on every PR"
    - "Add BATS unit tests for argument parsing, helper functions, and YAML transformations"
    - "Add shellcheck directives or fix all existing warnings in convert.sh"
  priority_1:
    - "Add integration tests using mock oc/yq/jq commands for end-to-end workflow validation"
    - "Add Gitleaks or TruffleHog secret scanning to prevent accidental credential commits"
    - "Create CLAUDE.md with testing standards and contribution guidelines"
  priority_2:
    - "Add BATS integration tests with stubbed OpenShift API responses"
    - "Add script versioning and release workflow"
    - "Create agent rules for test creation patterns (.claude/rules/)"
---

# Quality Analysis: kserve-raw-migration

## Executive Summary

- **Overall Score: 1.4/10**
- **Repository Type**: Bash utility script (single-file tool)
- **Primary Language**: Bash/Shell
- **Purpose**: Converts KServe InferenceServices from serverless (Knative) to raw (Kubernetes native) deployment mode on OpenShift AI
- **JIRA Ticket**: RHOAIENG-33168

### Key Strengths
- Well-documented README with architecture diagrams, usage examples, and troubleshooting
- Comprehensive error handling within the script itself (prerequisite checks, permission validation, rollback)
- OWNERS file provides basic governance with approvers and reviewers defined
- Clean argument parsing with help/version flags
- Structured file preservation with user-interactive prompts

### Critical Gaps
- **Zero CI/CD**: No GitHub Actions workflows, no automated checks on PRs
- **Zero Tests**: No unit, integration, or E2E tests for a ~1060-line bash script
- **No Linting**: No ShellCheck, no shfmt, no static analysis
- **No Security Scanning**: Script handles RBAC, secrets, and tokens with no automated security checks
- **No Agent Rules**: No `.claude/` directory or AI-assisted development guidance

### Agent Rules Status: **Missing**

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No tests of any kind exist |
| Integration/E2E | 0/10 | No integration or E2E tests |
| **Build Integration** | **0/10** | **No CI/CD, no build validation** |
| Image Testing | 0/10 | N/A — no container images built |
| Coverage Tracking | 0/10 | No coverage tooling |
| CI/CD Automation | 1/10 | OWNERS file only; no workflows |
| Agent Rules | 0/10 | No .claude directory or CLAUDE.md |

## Critical Gaps

### 1. Zero CI/CD Pipeline
- **Impact**: Any change can be merged without automated validation — broken scripts, syntax errors, and regressions go undetected
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The repository has no `.github/workflows/` directory. No checks run on pull requests. The only governance is the OWNERS file requiring approver review, but reviewers have no automated tooling to assist them.

### 2. No Tests for ~1060 Lines of Complex Bash
- **Impact**: The script performs critical operations (YAML transformations, RBAC manipulation, secret creation) with zero test coverage. Regressions in any of these operations go undetected until production use.
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: The script contains:
  - Complex argument parsing (~60 lines)
  - YAML transformation logic using yq (~100 lines)
  - Resource discovery via ownerReferences (~70 lines)
  - Authentication resource processing (~200 lines)
  - Error handling and validation (~100 lines)
  - None of these are tested.

### 3. No Static Analysis or Linting
- **Impact**: Common bash pitfalls (unquoted variables, missing error handling, command injection vectors) are not caught
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No ShellCheck integration. The script uses `set -x` for debugging but does not use `set -euo pipefail` at the top level. Several patterns could benefit from ShellCheck warnings (e.g., unquoted `$NAMESPACE` in some places, `echo -e` portability).

### 4. No Security Scanning
- **Impact**: Script handles RBAC roles, service account tokens, and Kubernetes secrets — security vulnerabilities in the transformation logic could lead to privilege escalation or credential exposure
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Gitleaks, TruffleHog, or CodeQL integration. The `sample_curl.sh` file contains a hardcoded endpoint URL and references a token variable, but no scanning prevents accidental secret commits.

### 5. No Agent Rules
- **Impact**: AI-assisted contributions have no guidelines for testing standards, code patterns, or quality expectations
- **Severity**: MEDIUM
- **Effort**: 2-3 hours

## Quick Wins

### 1. Add ShellCheck Linting via GitHub Actions (1-2 hours)
- **Impact**: Catches common bash pitfalls automatically on every PR
- **Implementation**:
```yaml
# .github/workflows/lint.yml
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

### 2. Add BATS Unit Tests (4-6 hours)
- **Impact**: Test argument parsing, helper functions, and transformation logic in isolation
- **Implementation**:
```bash
# test/convert_test.bats
#!/usr/bin/env bats

setup() {
  source convert.sh --source-only 2>/dev/null || true
}

@test "parse_arguments sets INFERENCE_SERVICE with -i flag" {
  parse_arguments -i my-model
  [ "$INFERENCE_SERVICE" = "my-model" ]
}

@test "parse_arguments sets NAMESPACE with -n flag" {
  parse_arguments -n my-ns -i my-model
  [ "$NAMESPACE" = "my-ns" ]
}

@test "show_help exits with 0" {
  run parse_arguments --help
  [ "$status" -eq 0 ]
}
```

### 3. Add Basic PR Workflow (2-3 hours)
- **Impact**: Establishes quality baseline; prevents broken scripts from merge
```yaml
# .github/workflows/ci.yml
name: CI
on: [pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ludeeus/action-shellcheck@master
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install BATS
        run: |
          sudo apt-get update
          sudo apt-get install -y bats
      - name: Run tests
        run: bats test/
```

### 4. Add Pre-commit Hooks (1 hour)
- **Impact**: Consistent formatting and lint checks before every commit
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/shellcheck-py/shellcheck-py
    rev: v0.9.0.6
    hooks:
      - id: shellcheck
  - repo: https://github.com/scop/pre-commit-shfmt
    rev: v3.7.0-4
    hooks:
      - id: shfmt
```

## Detailed Findings

### CI/CD Pipeline
- **Workflows**: None. No `.github/workflows/` directory exists.
- **PR Checks**: None. PRs are reviewed manually with no automated validation.
- **Build Process**: N/A — no container images or compiled artifacts.
- **Concurrency Control**: N/A.
- **Caching**: N/A.
- **Governance**: OWNERS file defines 13 approvers and 12 reviewers, providing basic review governance through Prow/Tide.

### Test Coverage
- **Unit Tests**: None. Zero test files in the repository.
- **Integration Tests**: None. The script can only be tested against a live OpenShift cluster.
- **E2E Tests**: None. No automated end-to-end validation.
- **Test-to-Code Ratio**: 0:1 (0 test files / 2 source files)
- **Coverage Tracking**: None. No codecov, coveralls, or any coverage tooling.
- **Frameworks**: None in use. BATS (Bash Automated Testing System) would be the appropriate framework.

### Code Quality
- **Linting**: No ShellCheck or shfmt configuration.
- **Pre-commit Hooks**: None. No `.pre-commit-config.yaml`.
- **Static Analysis**: None. No SAST tools configured.
- **Code Style**: The script is well-structured with functions, colored output, and consistent patterns — but this is not enforced by any tooling.
- **Error Handling**: The script has comprehensive internal error handling:
  - Prerequisite checks (oc, yq, jq availability)
  - Authentication validation (oc login check)
  - Permission validation (RBAC can-i checks)
  - Resource existence validation
  - Interactive namespace confirmation
  - Trap-based cleanup on ERR

### Container Images
- N/A — This repository does not build container images. It is a bash utility that operates on an existing OpenShift cluster.

### Security
- **Container Scanning**: N/A (no images)
- **SAST/CodeQL**: Not configured
- **Dependency Scanning**: N/A (bash script with no dependency manager)
- **Secret Detection**: Not configured. `sample_curl.sh` references `$TOKEN` variable. No Gitleaks or TruffleHog to prevent accidental credential commits.
- **Notable**: The script handles sensitive operations (creating ServiceAccounts, Roles, RoleBindings, Secrets) — the transformation logic should be audited for correctness to prevent privilege escalation or credential leakage.

### Agent Rules (Agentic Flow Quality)
- **Status**: Missing
- **Coverage**: No test type rules exist
- **Quality**: N/A
- **Gaps**: 
  - No `CLAUDE.md` in repository root
  - No `.claude/` directory
  - No `.claude/rules/` for test creation rules
  - No testing documentation beyond README troubleshooting section
- **Recommendation**: Generate test rules with `/test-rules-generator` covering BATS patterns, ShellCheck directives, and mock-based integration testing

### Build Integration
- **PR Build Validation**: None — no PR workflows exist
- **Integration Testing**: None — no cluster-based testing
- **Manifest Generation**: N/A — script generates YAML at runtime, not build time
- **Cross-Component Build**: N/A — single-script repository

## Recommendations

### Priority 0 (Critical)
1. **Create GitHub Actions CI workflow** with ShellCheck static analysis running on every PR. This is the single highest-impact improvement — it catches bugs with zero ongoing effort.
2. **Add BATS unit tests** for argument parsing, helper functions (logging, namespace detection), and YAML transformation logic. Focus on testing `parse_arguments`, `get_current_namespace`, `check_prerequisites`, and the yq transformation commands.
3. **Run ShellCheck on convert.sh** and fix or suppress all warnings. Add `#!/bin/bash` shellcheck directives where needed.

### Priority 1 (High Value)
4. **Add integration tests using mock commands**. Create stub scripts for `oc`, `yq`, and `jq` that return canned responses, then test the full conversion workflow end-to-end without requiring a live cluster.
5. **Add Gitleaks secret scanning** to the PR workflow to prevent accidental credential commits (important given the script handles tokens and secrets).
6. **Create CLAUDE.md** with contribution guidelines, testing standards (BATS, ShellCheck), and instructions for running tests locally.

### Priority 2 (Nice-to-Have)
7. **Add BATS integration tests** with stubbed OpenShift API responses to validate the full conversion pipeline.
8. **Add script versioning** — the script has `SCRIPT_VERSION="1.0.0"` but no release workflow or changelog.
9. **Create agent rules** (`.claude/rules/`) for bash test patterns, ShellCheck best practices, and BATS conventions.
10. **Add `set -euo pipefail`** at the top of the script for stricter error handling.

## Comparison to Gold Standards

| Dimension | kserve-raw-migration | odh-dashboard | notebooks | kserve |
|-----------|---------------------|---------------|-----------|--------|
| Unit Tests | 0/10 | 9/10 | 7/10 | 8/10 |
| Integration/E2E | 0/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 0/10 | 8/10 | 7/10 | 7/10 |
| Image Testing | N/A | 7/10 | 9/10 | 7/10 |
| Coverage Tracking | 0/10 | 8/10 | 6/10 | 8/10 |
| CI/CD Automation | 1/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 0/10 | 8/10 | 3/10 | 2/10 |
| **Overall** | **1.4/10** | **8.3/10** | **6.9/10** | **7.1/10** |

### Key Gaps vs. Gold Standards
- **odh-dashboard**: Has multi-layer testing (unit, integration, E2E, contract), comprehensive CI/CD with 10+ workflows, codecov enforcement, and detailed agent rules. kserve-raw-migration has none of these.
- **notebooks**: Has 5-layer image validation, multi-architecture support, and security scanning. While image testing is N/A for this repo, the CI/CD patterns are transferable.
- **kserve**: Has coverage enforcement, multi-version testing, and envtest-based integration tests. The testing patterns for yq/oc commands could be adapted using BATS.

## File Paths Reference

| File | Purpose |
|------|---------|
| `convert.sh` | Main conversion script (~1060 lines) |
| `sample_curl.sh` | Sample curl command for testing converted models |
| `README.md` | Comprehensive documentation |
| `OWNERS` | Review governance (13 approvers, 12 reviewers) |
| `LICENSE` | Apache License 2.0 |

### Missing Configuration Files
- `.github/workflows/*.yml` — No CI/CD workflows
- `*_test.*` — No test files
- `.golangci.yaml` / `.eslintrc` — N/A (bash project)
- `.pre-commit-config.yaml` — No pre-commit hooks
- `.codecov.yml` — No coverage configuration
- `.gitleaks.toml` — No secret detection
- `.trivyignore` — No vulnerability scanning
- `Dockerfile` / `Containerfile` — No container images
- `CLAUDE.md` / `.claude/` — No agent rules
