---
repository: "red-hat-data-services/ogx-k8s-operator"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Excellent coverage with envtest integration, table-driven tests, 1:1 test-to-source ratio"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Automated E2E on Kind with real operator deployment, creation/deletion/TLS/validation suites"
  - dimension: "Build Integration"
    score: 6.0
    status: "Konflux pipelines present but PR-time build is comment/label-triggered, not automatic"
  - dimension: "Image Testing"
    score: 5.5
    status: "Multi-arch image builds with FIPS support, but no container runtime validation tests"
  - dimension: "Coverage Tracking"
    score: 6.5
    status: "limgo coverage reporting on PRs but thresholds set to 0% (not enforced)"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "Well-organized workflows, Mergify auto-merge, pre-commit in CI, SHA-pinned actions"
  - dimension: "Agent Rules"
    score: 7.0
    status: "Comprehensive CLAUDE.md with architecture, commands, and conventions; no .claude/rules/ directory"
critical_gaps:
  - title: "No security scanning in CI (Trivy, CodeQL, gosec, SAST)"
    impact: "Vulnerabilities in dependencies or code not detected until downstream Konflux/ACS scans"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Coverage thresholds set to 0% — no enforcement"
    impact: "Test coverage can silently regress without any signal on PRs"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "Konflux PR builds are opt-in (comment/label), not automatic"
    impact: "Konflux-specific build failures (hermetic builds, multi-arch) may not be caught before merge"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No container runtime validation tests"
    impact: "Image startup failures, missing manifests, or broken entrypoints not caught until deployment"
    severity: "MEDIUM"
    effort: "6-8 hours"
quick_wins:
  - title: "Set real coverage thresholds in .limgo.json"
    effort: "1-2 hours"
    impact: "Prevent coverage regression by enforcing minimum thresholds per package"
  - title: "Add Trivy container scanning to PR workflow"
    effort: "2-3 hours"
    impact: "Catch critical/high CVEs in base images and dependencies before merge"
  - title: "Add gosec static analysis to pre-commit or CI"
    effort: "1-2 hours"
    impact: "Detect common Go security issues (SQL injection, hardcoded credentials, etc.)"
  - title: "Create .claude/rules/ directory with test creation rules"
    effort: "2-3 hours"
    impact: "Improve AI-assisted test generation consistency and quality"
recommendations:
  priority_0:
    - "Implement security scanning (Trivy for containers, gosec or CodeQL for SAST) on every PR"
    - "Set meaningful coverage thresholds in .limgo.json (currently all 0%)"
  priority_1:
    - "Enable automatic Konflux PR builds instead of comment/label-triggered"
    - "Add container runtime validation (image startup, entrypoint, manifest presence)"
    - "Create .claude/rules/ with unit-tests.md and e2e-tests.md for AI-assisted development"
  priority_2:
    - "Add SBOM generation and image signing for release images"
    - "Implement webhook mutation/validation fuzz testing"
    - "Add Gitleaks for secret detection in pre-commit"
---

# Quality Analysis: ogx-k8s-operator

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Kubernetes Operator (Go, operator-sdk/controller-runtime)
- **Primary Language**: Go 1.25
- **CRD**: `OGXServer` (group `ogx.io`, version `v1beta1`)

**Key Strengths**:
- Outstanding test-to-code ratio (~1:1 by line count, 32 test files covering 48 source files)
- Fully automated E2E tests on Kind clusters with real operator deployment on every PR
- Comprehensive envtest integration tests for controller reconciliation
- Excellent pre-commit hook chain (linting, manifest generation, SHA-pinning enforcement)
- Mature CLAUDE.md with architecture docs, code conventions, and development guidance
- Mergify auto-merge with required check gates (pre-commit, e2e, code coverage, DCO)

**Critical Gaps**:
- Zero security scanning in CI — no Trivy, CodeQL, gosec, or SAST
- Coverage thresholds set to 0% (limgo runs but doesn't enforce)
- No container runtime validation tests
- Konflux PR builds are opt-in via comment/label

**Agent Rules Status**: Partial — CLAUDE.md present with thorough documentation, but no `.claude/rules/` directory for structured test creation guidance.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Excellent coverage with envtest, table-driven tests, 1:1 ratio |
| Integration/E2E | 8.0/10 | Automated E2E on Kind, creation/deletion/TLS/validation suites |
| **Build Integration** | **6.0/10** | **Konflux pipelines present but opt-in on PRs** |
| Image Testing | 5.5/10 | Multi-arch + FIPS builds, no runtime validation |
| Coverage Tracking | 6.5/10 | limgo reporting present, thresholds at 0% |
| CI/CD Automation | 8.5/10 | Well-organized, Mergify, SHA-pinned actions |
| Agent Rules | 7.0/10 | Strong CLAUDE.md, no .claude/rules/ directory |

## Critical Gaps

### 1. No Security Scanning in CI
- **Impact**: Vulnerabilities in Go dependencies, container base images, and application code are not detected until downstream Konflux/ACS scans — far too late in the development lifecycle
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No Trivy, Snyk, CodeQL, gosec, Semgrep, or any SAST tool configured in `.github/workflows/`. The pre-commit hook chain catches error formatting and SHA-pinning but not security issues. The Konflux pipeline (`.tekton/`) handles build but security scanning is handled centrally in `konflux-central`, not at the PR level.
- **Implementation**:
  ```yaml
  # Add to .github/workflows/security.yml
  name: Security Scan
  on: [pull_request]
  jobs:
    trivy:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: aquasecurity/trivy-action@master
          with:
            scan-type: 'fs'
            severity: 'CRITICAL,HIGH'
            exit-code: '1'
    gosec:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: securego/gosec@master
          with:
            args: ./...
  ```

### 2. Coverage Thresholds at 0% (No Enforcement)
- **Impact**: Test coverage can silently regress without any PR signal. limgo runs and generates a report, but with `"statements": 0, "lines": 0, "branches": 0` in `.limgo.json`, it will never fail.
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: The code-coverage workflow runs `limgo` with the config in `.limgo.json`, which sets all thresholds to 0. This means coverage is reported but never enforced. There's no `--fail-under` flag or minimum threshold.
- **Implementation**: Update `.limgo.json` with meaningful thresholds:
  ```json
  {
    "coverage": {
      "global": {
        "statements": 60,
        "lines": 60,
        "branches": 40
      }
    }
  }
  ```

### 3. Konflux PR Builds Are Opt-In
- **Impact**: Konflux-specific build failures (hermetic Go module fetching, multi-arch cross-compilation, Red Hat UBI base image pinning) may not be caught until after merge
- **Severity**: MEDIUM
- **Effort**: 2-4 hours (coordination with konflux-central team)
- **Details**: The `.tekton/odh-ogx-k8s-operator-pull-request.yaml` is triggered by `on-comment: "^/build-konflux"` and `on-label: "[kfbuild-all, kfbuild-odh-ogx-k8s-operator]"` — not automatically on every PR. The `Dockerfile.konflux` differs from `Dockerfile` (no FIPS, different base image pinning, no openssl install), so divergence can go undetected.

### 4. No Container Runtime Validation Tests
- **Impact**: Image startup failures, missing manifest files, or broken entrypoints not caught until actual deployment
- **Severity**: MEDIUM
- **Effort**: 6-8 hours
- **Details**: The E2E workflow builds the image and deploys it to Kind, which implicitly validates the image works. However, there are no dedicated container runtime tests that validate:
  - Image starts successfully with expected entrypoint
  - Required files exist (`/manager`, `/manifests/`)
  - Health/readiness probe endpoints respond
  - Image size is within expected bounds

## Quick Wins

### 1. Set Real Coverage Thresholds in .limgo.json
- **Effort**: 1-2 hours
- **Impact**: Prevent silent coverage regression
- **Implementation**: Set `"statements": 60, "lines": 60` based on current coverage levels. Add per-package overrides for critical packages like `controllers/` and `pkg/deploy/`.

### 2. Add Trivy Container Scanning to PR Workflow
- **Effort**: 2-3 hours
- **Impact**: Early detection of critical/high CVEs in UBI9 base images and Go dependencies
- **Implementation**: Add `aquasecurity/trivy-action` step to the pre-commit or a dedicated security workflow.

### 3. Add gosec to Pre-commit or CI
- **Effort**: 1-2 hours
- **Impact**: Detect common Go security issues before code review
- **Implementation**: Add gosec to `.pre-commit-config.yaml` as a local hook alongside the existing linter hook.

### 4. Create .claude/rules/ Test Rules
- **Effort**: 2-3 hours
- **Impact**: Standardize AI-assisted test generation with project-specific patterns (envtest setup, table-driven tests, require assertions)
- **Implementation**: Use `/test-rules-generator` to bootstrap rules from existing test patterns.

## Detailed Findings

### CI/CD Pipeline

**Workflows** (9 total in `.github/workflows/`):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pre-commit.yml` | PR + push to main | Runs full pre-commit hook chain (lint, manifests, API docs, SHA-pinning) |
| `code-coverage.yml` | PR to `odh` branch | Runs tests + limgo coverage report |
| `run-e2e-test.yml` | PR to `main` + callable | Full E2E: Kind cluster → build → deploy → test |
| `build-image.yml` | PR merged to `main` | Multi-arch image build (amd64/arm64) → Quay |
| `main-build-image.yml` | Push to `main` | Latest image build with SHA tagging |
| `odh-build-image.yml` | Push to `odh` | ODH-specific image build |
| `release-image.yml` | Tag push (`v*`) | Release image with version tagging |
| `generate-release.yml` | Tag push | Full release automation (manifests, OLM bundle, release notes) |
| `build-vllm-cpu-image.yml` | Manual dispatch | Specialized vLLM CPU image build |

**Strengths**:
- Pre-commit workflow verifies no uncommitted changes/files after hooks run
- Concurrency control on pre-commit (`cancel-in-progress: true`)
- E2E workflow exposes outputs for `workflow_call` composition
- All GitHub Actions SHA-pinned (enforced by pre-commit hook `check-workflows-uses-hashes.sh`)
- Multi-arch build matrix (amd64 + arm64 runners)
- Comprehensive log artifact collection on E2E failure

**Gaps**:
- Coverage workflow targets `odh` branch only — not `main`
- No concurrency control on E2E workflow
- No caching of Go modules in CI (relies on setup-go default caching)
- Build-vllm-cpu workflow is placeholder (empty content reference)

### Test Coverage

**Test Infrastructure**:
- **32 test files** covering 48 source files
- **12,598 test lines** vs **12,526 source lines** (1.01:1 ratio — excellent)
- Framework: Go testing + `testify/require` + `testify/assert`
- Integration: `controller-runtime/envtest` with kubebuilder assets v1.31.0

**Unit Test Breakdown**:

| Package | Test Files | Lines | Key Coverage |
|---------|-----------|-------|-------------|
| `controllers/` | 8 | 3,769 | Reconciler, configmap, network, legacy adoption, CA bundle |
| `api/v1beta1/` | 4 | 2,504 | CEL validation, webhook, types |
| `pkg/deploy/` | 3 | 1,362 | Kustomize rendering, deploy, suite |
| `pkg/deploy/plugins/` | 5 | 888 | All transformer plugins |
| `pkg/config/` | 2 | 2,122 | Config generation, OCI fetcher |
| `pkg/compare/` | 1 | 131 | Resource comparison |
| `pkg/cluster/` | 1 | 30 | Cluster info |
| `cmd/configgen/` | 1 | 159 | Config generation CLI |

**E2E Test Breakdown**:

| Test Suite | Lines | Coverage |
|-----------|-------|----------|
| `creation_test.go` | 521 | Resource creation, rollout, readiness |
| `tls_test.go` | 533 | TLS certificate handling |
| `rollout_test.go` | 303 | Deployment rollout behavior |
| `validation_test.go` | 55 | CRD validation rules |
| `deletion_test.go` | 57 | Resource cleanup |

**Strengths**:
- Envtest provides real K8s API server for controller tests
- Table-driven test pattern consistently used
- CEL validation rules tested separately from Go webhook validation
- E2E uses real operator image built and deployed to Kind
- Builder pattern for test fixtures (`NewDistributionBuilder().WithX().Build()`)

**Gaps**:
- `pkg/cluster/cluster_test.go` has only 30 lines — minimal coverage
- No fuzz testing for webhook validation or config parsing
- No benchmark tests for manifest rendering performance

### Code Quality

**Linting** (golangci-lint v2):
- Configuration: `default: all` with 17 specific disables
- Excellent: Enables nearly all available linters
- Notable enabled linters: `errorlint`, `govet` (with shadow detection), `gocritic`, `revive`, `exhaustive`, `mnd`
- Custom settings: `gocyclo` min-complexity 30, `funlen` max 100 lines, `lll` max 180 chars
- Test file relaxations: `errcheck`, `dupl`, `gosec`, `funlen` disabled in `*_test.go`

**Pre-commit Hooks** (12 hooks):
1. `check-merge-conflict`
2. `trailing-whitespace`
3. `check-added-large-files` (max 1MB)
4. `end-of-file-fixer`
5. `no-commit-to-branch`
6. `check-yaml`
7. `detect-private-key`
8. `mixed-line-ending` (enforce LF)
9. `check-executables-have-shebangs`
10. `check-json`, `check-shebang-scripts-are-executable`, `check-symlinks`, `check-toml`
11. Local: `make lint`, `make generate manifests`, `make build-installer`, `make api-docs`
12. Custom: `check_go_errors.py` (enforces "failed to" error format), `check-workflows-uses-hashes.sh`

**Strengths**:
- One of the most comprehensive pre-commit configurations seen
- Custom error message formatting enforcement
- SHA-pinning enforcement for all GitHub Actions
- Generated manifest/API doc freshness verification

### Container Images

**Dockerfiles**:
- `Dockerfile` — Multi-stage build with FIPS compliance (UBI9 base, `strictfipsruntime`, OpenSSL for native builds)
- `Dockerfile.konflux` — Simplified Konflux build with pinned image SHAs, Red Hat labeling, no FIPS OpenSSL

**Strengths**:
- Multi-stage builds (builder + minimal runtime)
- FIPS compliance with native vs. cross-compilation awareness
- `BUILDPLATFORM`-aware cross-compilation (avoids QEMU for Go builds)
- Multi-arch support (amd64 + arm64, Konflux also ppc64le)
- Non-root user (`USER 1001`)
- `.dockerignore` present

**Gaps**:
- No Trivy/vulnerability scanning of built images
- No SBOM generation
- No image signing (cosign/Sigstore)
- No image size validation
- `Dockerfile` and `Dockerfile.konflux` divergence (different base image pinning, FIPS settings) — could cause "works in CI, fails in Konflux" issues

### Security

**Current State**: Minimal security tooling at the repository level.

| Security Practice | Status |
|-------------------|--------|
| Container scanning (Trivy/Snyk) | Not configured |
| SAST (CodeQL/gosec/Semgrep) | Not configured |
| Dependency scanning | Dependabot + Renovate (automated updates, not vulnerability blocking) |
| Secret detection | `detect-private-key` pre-commit hook only |
| Image signing | Not configured |
| SBOM generation | Not configured |
| SHA-pinned actions | Enforced (custom script) |
| FIPS compliance | Configured in Dockerfile |

**Dependabot** covers:
- `github-actions` — daily
- `gomod` — daily (K8s deps grouped)
- `docker` — weekly

**Renovate** extends from `konflux-central` default config for Konflux-managed dependencies.

**Strengths**:
- SHA-pinning enforcement is excellent supply chain protection
- Private key detection in pre-commit
- Dual dependency update tools (Dependabot + Renovate) for coverage

**Gaps**:
- No vulnerability blocking — Dependabot creates PRs but doesn't gate merges on CVE severity
- No gosec or CodeQL for static code analysis
- No Gitleaks for comprehensive secret scanning
- Security scanning deferred entirely to downstream Konflux pipelines

### Agent Rules (Agentic Flow Quality)

**Status**: Partial — Strong CLAUDE.md, no structured rules directory

**CLAUDE.md** (6,397 bytes): Comprehensive document covering:
- Project overview and architecture
- Build & development commands (with examples)
- Reconciliation pipeline walkthrough
- Key package descriptions
- Distribution resolution flow
- Resource ownership patterns
- ConfigMap cache design
- Code conventions (error formats, import ordering, test patterns)
- Pre-commit hook documentation

**Specs Directory** (`specs/`): 
- `constitution.md` — Project-wide principles, patterns, and standards
- Three numbered specs with full research/plan/tasks structure (001, 002, 003)
- Demonstrates mature engineering process

**Gaps**:
- No `.claude/` directory
- No `.claude/rules/` with structured test creation rules
- No AGENTS.md for multi-agent coordination
- No `.claude/skills/` for custom AI-assisted workflows
- CLAUDE.md has test patterns ("table-driven with descriptive names", "use `require.Eventually` for async") but not structured as actionable rules with examples

## Recommendations

### Priority 0 (Critical)

1. **Implement security scanning on every PR** — Add Trivy filesystem scan and gosec as CI jobs. These catch the two highest-impact vulnerability classes: known CVEs in dependencies and common Go security mistakes. Estimated effort: 4-6 hours.

2. **Set meaningful coverage thresholds** — Update `.limgo.json` from 0% to actual minimums (suggest 60% statements, 60% lines as starting point). Add per-package overrides for critical packages. Estimated effort: 2-3 hours.

### Priority 1 (High Value)

3. **Enable automatic Konflux PR builds** — Coordinate with konflux-central team to change `.tekton/` triggers from comment/label-based to automatic on PR. This closes the gap between Dockerfile and Dockerfile.konflux divergence. Estimated effort: 2-4 hours.

4. **Add container runtime validation** — Create a CI step that builds the image, starts it, and validates: entrypoint works, `/manifests/` directory exists, healthz endpoint responds. Can be added to existing E2E workflow. Estimated effort: 6-8 hours.

5. **Create .claude/rules/ for test automation** — Generate structured rules from existing test patterns using `/test-rules-generator`. Cover: unit tests (envtest setup, table-driven), E2E tests (Kind setup, fixture builders), webhook tests (CEL + Go validation). Estimated effort: 2-3 hours.

### Priority 2 (Nice-to-Have)

6. **Add SBOM generation and image signing** — Integrate cosign/Sigstore for release images. Konflux may already handle this downstream, but having it at the repo level provides defense in depth.

7. **Add fuzz testing for config parsing** — The `pkg/config/` package handles complex YAML/JSON config merging that would benefit from Go's native fuzzing support.

8. **Extend coverage workflow to `main` branch** — Currently `code-coverage.yml` only triggers on PRs to `odh` branch. PRs to `main` get E2E but no coverage reporting.

9. **Add concurrency control to E2E workflow** — Prevent redundant Kind cluster creation when multiple commits are pushed quickly.

10. **Add Gitleaks for comprehensive secret scanning** — The current `detect-private-key` hook only catches SSH private keys. Gitleaks would cover API tokens, passwords, connection strings, etc.

## Comparison to Gold Standards

| Dimension | ogx-k8s-operator | odh-dashboard | notebooks | kserve |
|-----------|-----------------|---------------|-----------|--------|
| Unit Test Ratio | 1:1 (excellent) | Good | Moderate | Good |
| Integration Tests | envtest | envtest + testcontainers | Makefile-based | envtest |
| E2E Automation | Kind on PR | Cypress + Kind | Multi-layered | Kind + GKE |
| Coverage Enforcement | 0% (not enforced) | Codecov with thresholds | Minimal | Codecov enforced |
| Security Scanning | None in CI | Trivy + CodeQL | Minimal | Trivy + gosec |
| Multi-arch | amd64 + arm64 | N/A (frontend) | Multi-arch | Multi-arch |
| Agent Rules | CLAUDE.md (strong) | CLAUDE.md + .claude/rules/ | None | None |
| Pre-commit | 12 hooks (excellent) | ESLint/Prettier | Minimal | golangci-lint |
| Mergify | Configured | Configured | Not present | Not present |
| SHA-pinned Actions | Enforced | Partial | Partial | Partial |

## File Paths Reference

| Category | Path |
|----------|------|
| CI Workflows | `.github/workflows/*.yml` (9 workflows) |
| Tekton/Konflux | `.tekton/*.yaml` (3 pipelines) |
| Lint Config | `.golangci.yml` |
| Pre-commit | `.pre-commit-config.yaml` |
| Coverage Config | `.limgo.json` |
| Dockerfiles | `Dockerfile`, `Dockerfile.konflux` |
| Makefile | `Makefile` |
| Agent Rules | `CLAUDE.md` |
| Project Specs | `specs/constitution.md`, `specs/001-*/`, `specs/002-*/`, `specs/003-*/` |
| Controller Tests | `controllers/*_test.go` (8 files) |
| API Tests | `api/v1beta1/*_test.go` (4 files) |
| E2E Tests | `tests/e2e/*_test.go` (7 files) |
| Package Tests | `pkg/**/*_test.go` (10 files) |
| Dependency Config | `.github/dependabot.yml`, `.github/renovate.json` |
| Merge Automation | `.github/mergify.yml` |
| Code Owners | `.github/CODEOWNERS` |
