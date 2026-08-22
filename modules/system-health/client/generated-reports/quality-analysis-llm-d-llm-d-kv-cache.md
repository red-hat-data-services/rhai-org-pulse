---
repository: "llm-d/llm-d-kv-cache"
overall_score: 6.2
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Strong test coverage with testify framework; 34 Go test files for 39 source files (0.87 ratio), plus 15 Python test files"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "Testcontainers-based E2E for UDS tokenizer, integration tests for KV events, Kind cluster script; missing multi-version K8s testing"
  - dimension: "Build Integration"
    score: 5.0
    status: "PR workflow builds UDS tokenizer image for E2E but no Konflux simulation, no kustomize validation in CI"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage Dockerfiles, UBI9 runtime base, multi-arch (amd64/arm64), testcontainers for runtime validation"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tool configured - no codecov, no coverprofile flags, no coverage thresholds or PR reporting"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "24 workflows covering PR validation, nightly race detection, release automation, caching, Mergify integration"
  - dimension: "Static Analysis"
    score: 8.0
    status: "35+ golangci-lint linters, ruff for Python, pre-commit hooks with typos/actionlint, Dependabot for 4 ecosystems"
  - dimension: "Agent Rules"
    score: 1.0
    status: "CLAUDE.md exists but is empty; no .claude/rules/, no AGENTS.md, no test automation guidance"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Code coverage is never measured or reported - regressions in test coverage go completely undetected"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Empty agent rules (CLAUDE.md)"
    impact: "AI-assisted development produces inconsistent code and tests; no framework-specific guidance for contributors"
    severity: "HIGH"
    effort: "3-4 hours"
  - title: "No PR-time Konflux build simulation"
    impact: "Build failures discovered only after merge in Konflux pipeline; main Dockerfile not validated on PRs"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No kustomize/deploy manifest validation in CI"
    impact: "Deployment manifests can break silently; kustomize build errors not caught until deployment time"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add --coverprofile to Go test commands and enable codecov"
    effort: "2-4 hours"
    impact: "Immediate visibility into test coverage with PR-level reporting and threshold enforcement"
  - title: "Populate CLAUDE.md with project conventions and test patterns"
    effort: "2-3 hours"
    impact: "Consistent AI-assisted development with framework-specific test guidance"
  - title: "Add kustomize build --dry-run to PR CI"
    effort: "1-2 hours"
    impact: "Catch deployment manifest errors before they reach production"
  - title: "Add t.Parallel() to independent unit tests"
    effort: "2-3 hours"
    impact: "Faster test execution and detection of race conditions in unit tests"
recommendations:
  priority_0:
    - "Add coverage tracking: --coverprofile in Makefile unit-test target, codecov GitHub Action in ci-test.yaml, .codecov.yml with threshold enforcement"
    - "Populate CLAUDE.md with Go testing conventions, testify patterns, Testcontainers usage, Python test standards"
    - "Add PR-time Docker image build validation for the main Dockerfile (currently only builds on release/tag)"
  priority_1:
    - "Add kustomize build --dry-run validation in CI for deploy/ manifests"
    - "Add multi-version Kubernetes testing matrix (e.g., K8s 1.29, 1.30, 1.31)"
    - "Add concurrency controls to PR-triggered workflows to cancel stale runs"
    - "Create .claude/rules/ with test creation guidance for Go and Python components"
  priority_2:
    - "Add HEALTHCHECK instructions to Dockerfiles for better container orchestration"
    - "Add t.Parallel() to independent Go unit tests for faster CI and race detection"
    - "Consider adding contract tests between the Go KV cache manager and Python connectors"
    - "Add FIPS build tags and boringcrypto support for Go binary in production builds"
---

# Quality Analysis: llm-d/llm-d-kv-cache

## Executive Summary

- **Overall Score: 6.2/10**
- **Repository Type**: Go library/service with Python connectors for KV cache management in the llm-d inference stack
- **Primary Languages**: Go (main service, pkg/), Python (kv_connectors/, services/)
- **Jira**: INFERENG / llm-d component
- **Tier**: Upstream

**Key Strengths**: Excellent test-to-code ratio (0.87), comprehensive CI/CD with 24 workflows including nightly race detection, strong static analysis with 35+ golangci-lint linters and pre-commit hooks, Testcontainers-based E2E testing, multi-architecture image builds, and thorough Dependabot coverage across 4 ecosystems.

**Critical Gaps**: Zero coverage tracking (no codecov, no coverprofile, no thresholds), empty CLAUDE.md with no agent rules, main Dockerfile not built/validated on PRs, and no kustomize manifest validation in CI.

**Agent Rules Status**: Missing - CLAUDE.md exists but is empty, no .claude/rules/ directory

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.0/10 | 15% | 1.20 | Strong test coverage with testify; 0.87 test-to-code ratio |
| Integration/E2E | 7.0/10 | 20% | 1.40 | Testcontainers E2E, integration tests, Kind script; no multi-version |
| Build Integration | 5.0/10 | 15% | 0.75 | PR builds UDS tokenizer image; no Konflux sim or main image build |
| Image Testing | 7.0/10 | 10% | 0.70 | Multi-stage, UBI9 runtime, multi-arch, testcontainers validation |
| Coverage Tracking | 1.0/10 | 10% | 0.10 | No coverage tool, no thresholds, no PR reporting |
| CI/CD Automation | 8.0/10 | 15% | 1.20 | 24 workflows, nightly race, caching, Mergify, release automation |
| Static Analysis | 8.0/10 | 10% | 0.80 | 35+ linters, ruff, pre-commit, Dependabot (4 ecosystems) |
| Agent Rules | 1.0/10 | 5% | 0.05 | Empty CLAUDE.md, no test automation guidance |
| **Overall** | **6.2/10** | **100%** | **6.20** | |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Severity**: HIGH
- **Impact**: Code coverage is never measured, tracked, or reported. Coverage regressions go completely undetected. No visibility into which packages or functions lack test coverage.
- **Current State**: No `.codecov.yml`, no `--coverprofile` in Makefile or CI, no coverage threshold, no PR coverage comments.
- **Effort**: 4-6 hours
- **Recommendation**: Add `--coverprofile=coverage.out` to `unit-test-uds` Makefile target, add codecov/codecov-action to `ci-test.yaml`, create `.codecov.yml` with project/patch thresholds.

### 2. Empty Agent Rules (CLAUDE.md)
- **Severity**: HIGH
- **Impact**: AI-assisted development produces inconsistent code and tests. No guidance on testify patterns, Testcontainers conventions, Python testing standards, or project-specific idioms.
- **Current State**: `CLAUDE.md` exists but is completely empty. No `.claude/rules/` directory. No `AGENTS.md`.
- **Effort**: 3-4 hours
- **Recommendation**: Populate `CLAUDE.md` with project conventions. Create `.claude/rules/` with test creation guidance. Use `/test-rules-generator` to bootstrap rules.

### 3. No PR-Time Main Image Build Validation
- **Severity**: HIGH
- **Impact**: The main `Dockerfile` (Go binary in UBI9 container) is only built on release tags. Dockerfile changes or Go build breaks are not caught on PRs.
- **Current State**: `ci-release.yaml` runs on tags/releases only. `ci-test.yaml` builds only the UDS tokenizer image for E2E, not the main project image.
- **Effort**: 8-12 hours
- **Recommendation**: Add a PR-triggered workflow that builds the main Dockerfile (docker build --target builder at minimum) to catch build failures early.

### 4. No Kustomize/Deploy Manifest Validation
- **Severity**: MEDIUM
- **Impact**: The `deploy/` directory contains kustomize manifests with variable substitution. Broken manifests are not detected until deployment.
- **Current State**: `deploy/kustomization.yaml` references resources and patches, but no CI step validates them.
- **Effort**: 2-4 hours
- **Recommendation**: Add `kustomize build deploy/ | kubectl apply --dry-run=client -f -` step to PR CI.

## Quick Wins

### 1. Add Coverage Tracking (2-4 hours)
Add `--coverprofile` to Go test commands and integrate with codecov:

```yaml
# Add to ci-test.yaml unit-test job
- name: Run unit tests with coverage
  run: make unit-test COVER=1

- name: Upload coverage
  uses: codecov/codecov-action@v5
  with:
    files: coverage.out
    fail_ci_if_error: false
```

```makefile
# Makefile addition
ifdef COVER
COVER_FLAGS := -coverprofile=coverage.out -covermode=atomic
endif

unit-test-uds: check-go download-zmq
	go test -v $(COVER_FLAGS) ./pkg/...
```

```yaml
# .codecov.yml
coverage:
  status:
    project:
      default:
        target: 60%
        threshold: 5%
    patch:
      default:
        target: 70%
```

### 2. Populate CLAUDE.md (2-3 hours)
Add project conventions, testing patterns, and contributor guidance. Key sections:
- Project structure (pkg/ for Go library, kv_connectors/ for Python, services/ for gRPC)
- Go testing: use testify assert/require, table-driven tests, Testcontainers for E2E
- Python testing: pytest, follow existing patterns in kv_connectors/*/tests/
- CI requirements: all PRs must pass ci-test, ci-lint, ci-examples

### 3. Add Kustomize Validation (1-2 hours)
```yaml
# Add to ci-lint.yaml or new workflow
- name: Validate kustomize manifests
  run: |
    export PROJECT_NAME=llm-d-kv-cache
    export NAMESPACE=test
    kustomize build deploy/ | envsubst | kubectl apply --dry-run=client -f - 2>&1
```

### 4. Add t.Parallel() to Unit Tests (2-3 hours)
No test files currently use `t.Parallel()`. Adding it to independent test cases improves CI speed and catches data races:
```go
func TestExample(t *testing.T) {
    t.Parallel()
    // ...
}
```

## Detailed Findings

### Unit Tests

**Score: 8.0/10**

The repository has excellent unit test coverage with a near 1:1 test-to-code ratio:

- **Go Test Files**: 34 files across `pkg/kvcache/`, `pkg/kvevents/`, `pkg/tokenization/`, `pkg/telemetry/`, `pkg/utils/`
- **Go Source Files**: 39 non-test, non-example files
- **Test-to-Code Ratio**: 0.87 (excellent)
- **Python Test Files**: 15 files across `kv_connectors/` and `services/`
- **Framework**: Go standard `testing` + `testify` (assert/require), Python `pytest`
- **Benchmark Tests**: 3 benchmark files (`zmq_subscriber_bench_test.go`, `vllm_adapter_bench_test.go`, `index_benchmark_test.go`)

**Strengths**:
- Nearly every Go source file has a corresponding test file
- Uses testify consistently for assertions
- Benchmark tests for performance-critical paths (ZMQ, vLLM adapter, index)
- Internal test files (`export_test.go`, `*_internal_test.go`) for white-box testing
- Python connectors have their own test suites

**Gaps**:
- No `t.Parallel()` usage in any Go test file
- No test isolation patterns beyond standard Go testing

**Key Test Files**:
- `pkg/kvcache/kvblock_scorer_test.go` - KV block scoring logic
- `pkg/kvcache/indexer_test.go` - Cache indexing
- `pkg/kvevents/zmq_subscriber_test.go` - ZMQ subscriber with bench tests
- `pkg/tokenization/uds_tokenizer_test.go` - UDS tokenizer client
- `kv_connectors/llmd_fs_backend/tests/test_fs_backend.py` - FS backend
- `kv_connectors/pvc_evictor/tests/` - PVC evictor (4 test files)

### Integration/E2E Tests

**Score: 7.0/10**

Solid integration and E2E test infrastructure:

- **Integration Tests**: `tests/integration/kv_events_test.go` - Tests Pool + SubscriberManager integration
- **E2E Tests**: `tests/e2e/uds_tokenizer/` - 3 test files using Testcontainers
  - `uds_e2e_suite_test.go` - Suite setup with Docker container lifecycle
  - `uds_e2e_test.go` - Core tokenizer E2E
  - `uds_e2e_mm_test.go` - Multimodal E2E tests
- **Python Integration**: `services/uds_tokenizer/tests/test_integration.py` - Python-side integration
- **Kind Cluster**: `tests/kind-vllm-cpu.sh` - Full K8s cluster setup with vLLM, MetalLB, Gateway API

**Strengths**:
- Testcontainers for containerized E2E testing (proper container lifecycle management)
- CI runs both unit and E2E tests on PRs (`ci-test.yaml`)
- UDS tokenizer integration tests run on PR when relevant paths change
- Kind cluster script for full-stack testing
- PVC evictor has dedicated CI (`ci-pvc-evictor.yaml`)

**Gaps**:
- No multi-version Kubernetes testing (no matrix for K8s versions)
- Kind cluster script is manual, not integrated into CI
- No Redis/Valkey integration tests in CI (only in-memory via miniredis)
- No contract tests between Go and Python components

### Build Integration

**Score: 5.0/10**

Partial PR-time build validation:

- **PR Builds**: `ci-test.yaml` builds UDS tokenizer Docker image for E2E tests
- **PR Builds**: `ci-examples.yaml` builds UDS tokenizer image and runs examples
- **Release Builds**: `ci-release.yaml` and `ci-release-uds-tokenizer.yaml` build and push on tag/release
- **CUDA Wheels**: `ci-wheels.yaml` builds CUDA wheels on tag push with matrix (amd64/arm64 x cu12/cu130)

**Strengths**:
- UDS tokenizer image built and tested on every PR
- Multi-architecture release builds (linux/amd64, linux/arm64)
- CUDA wheel build matrix with architecture variants
- Docker buildx caching (GHA cache)

**Gaps**:
- Main Dockerfile (`Dockerfile` - Go binary in UBI9) is NOT built on PRs
- No Konflux build simulation
- No kustomize build validation in CI
- No operator manifest validation
- Deployment manifests (`deploy/`) not validated

### Image Testing

**Score: 7.0/10**

Good container image practices with some gaps:

- **Main Dockerfile**: Multi-stage (Go builder on quay.io/projectquay/golang:1.24 -> UBI9 runtime), non-root user (65532)
- **UDS Tokenizer Dockerfile**: Multi-stage (python:3.12-slim builder -> python:3.12-slim runtime), non-root user, `chown` for cache dirs
- **Wheel Dockerfile**: Complex CUDA build with auditwheel repair, multi-arch
- **Dev Dockerfile**: Based on vLLM image with CUDA toolkit overlay
- **PVC Evictor Dockerfile**: Single-stage python:3.12-slim

**Strengths**:
- Multi-stage builds for main and UDS tokenizer images
- UBI9 base for main image (FIPS-capable runtime)
- Non-root user in main and UDS tokenizer images
- Multi-architecture support (amd64/arm64) in CI
- Testcontainers for E2E runtime validation
- `.dockerignore` present and well-configured

**Gaps**:
- No `HEALTHCHECK` instructions in any Dockerfile
- PVC evictor and UDS tokenizer use `python:3.12-slim` (not UBI, not FIPS-capable)
- No readiness/liveness probes in K8s manifests reviewed
- No container startup validation in CI for main image

### Coverage Tracking

**Score: 1.0/10**

No coverage tracking infrastructure exists:

- No `.codecov.yml` or `codecov.yml`
- No `--coverprofile` flag in Makefile `unit-test` targets
- No `pytest-cov` or `--cov` in Python test commands
- No coverage threshold enforcement
- No PR coverage reporting
- No coverage comments on PRs
- No coverage badge in README

This is the most critical gap in the repository's quality practices. With 34 Go test files and 15 Python test files, the investment in tests is significant but completely unmeasured.

### CI/CD Automation

**Score: 8.0/10**

Comprehensive CI/CD with 24 workflow files:

**PR-Triggered Workflows**:
| Workflow | Purpose |
|----------|---------|
| `ci-test.yaml` | Unit tests + E2E tests (builds UDS tokenizer image) |
| `ci-lint.yaml` | Pre-commit hooks + golangci-lint + clang-format |
| `ci-examples.yaml` | Builds UDS tokenizer image and runs examples |
| `ci-uds-tokenizer.yaml` | UDS tokenizer Python integration tests (path-filtered) |
| `ci-pvc-evictor.yaml` | PVC evictor Python tests (path-filtered) |
| `ci-signed-commits.yaml` | Verify signed commits |
| `non-main-gatekeeper.yml` | Enforce PR targeting rules |
| `auto-assign.yaml` | Auto-assign reviewers from OWNERS |
| `size-label.yml` | PR size labeling |
| `prow-pr-remove-lgtm.yml` | Remove LGTM on new pushes |

**Scheduled/Release Workflows**:
| Workflow | Purpose |
|----------|---------|
| `ci-nightly-race.yaml` | Daily race detector run (06:00 UTC) |
| `ci-release.yaml` | Build/push main Docker image on tag |
| `ci-release-uds-tokenizer.yaml` | Build/push UDS tokenizer image on tag |
| `ci-wheels.yaml` | Build CUDA wheels on tag (matrix: arch x cuda) |
| `ci-pages-index.yaml` | PEP 503 PyPI index via GitHub Pages |
| `stale.yaml` | Mark stale issues (daily) |
| `prow-pr-automerge.yml` | Auto-merge approved PRs (every 5 min) |

**Strengths**:
- Nightly race detector (`-race` flag) - excellent for a concurrent Go system
- Docker buildx caching (GHA cache type) for fast image builds
- Path-filtered workflows for Python components (avoids unnecessary CI runs)
- Mergify integration for pre-commit failure guidance
- Reusable workflows from `llm-d/llm-d-infra`
- Re-run action for manual CI retrigger via comments
- Prow-style commands (LGTM, auto-merge) via GitHub Actions

**Gaps**:
- No concurrency controls on PR-triggered test/lint workflows (could stack up)
- No timeout on most PR workflows (only nightly-race has 30min timeout)
- No matrix testing for multiple Go or K8s versions
- No test result caching or incremental testing

### Static Analysis

**Score: 8.0/10**

Excellent static analysis configuration:

**Go Linting (golangci-lint v2.9.0)**:
- 35+ linters enabled including: `govet`, `staticcheck`, `errcheck`, `gosec`, `gocritic`, `revive`, `bodyclose`, `contextcheck`, `errname`, `errorlint`, `ineffassign`, `prealloc`, `tparallel`, `unconvert`, `unparam`
- Formatters: `gofumpt`, `goimports`
- Line length limit: 130
- Strict generated file exclusion
- Per-path exclusions for examples and protobuf

**Python Linting (ruff)**:
- Target: Python 3.12
- Lint rules: pycodestyle, Pyflakes, pyupgrade, flake8-bugbear, flake8-simplify, isort, flake8-logging-format
- Format: docstring-code-format enabled
- Protobuf generated files excluded

**Pre-commit Hooks**:
- ruff-check + ruff-format (Python)
- typos (spell checking)
- clang-format (C++/CUDA)
- actionlint (GitHub Actions validation)
- pip-compile (requirements pinning)

**Dependency Alerts (Dependabot)**:
- `gomod` - Go module updates (weekly, grouped, major versions ignored)
- `github-actions` - Action version updates (weekly)
- `docker` - Base image updates for root and UDS tokenizer (weekly)
- Labeled with `dependencies` and `release-note-none`

**FIPS Compatibility**:
- `math/rand/v2` imported in benchmark test only (not security context) - acceptable
- No FIPS build tags or boringcrypto configuration
- Main Dockerfile uses UBI9 runtime (FIPS-capable)
- Sub-component Dockerfiles use `python:3.12-slim` (not FIPS-capable)
- No explicit FIPS compliance strategy documented

### Agent Rules

**Score: 1.0/10**

Minimal agent rule infrastructure:

- **CLAUDE.md**: Exists at repository root but is **completely empty**
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **.claude/rules/**: Not present
- **copilot-setup-steps.yml**: Present but only installs `gh-aw` extension

**Gaps**:
- No Go testing conventions (testify patterns, table-driven tests, Testcontainers setup)
- No Python testing guidance (pytest patterns, fixture usage)
- No project structure documentation for AI agents
- No build/CI guidance
- No code style beyond linter configuration

**Recommendation**: Use `/test-rules-generator` to generate comprehensive test creation rules. Populate CLAUDE.md with:
- Project architecture (pkg/ layout, kv_connectors/, services/)
- Go test patterns (testify assert/require, internal test packages, benchmark conventions)
- Python test patterns (pytest, test file naming, fixture patterns)
- CI requirements and how to run tests locally

## Recommendations

### Priority 0 (Critical)

1. **Add coverage tracking** - Add `--coverprofile=coverage.out` to Go test targets, integrate codecov/codecov-action, create `.codecov.yml` with 60% project threshold and 70% patch threshold. This is the single highest-ROI improvement.

2. **Populate CLAUDE.md and create agent rules** - Fill the empty CLAUDE.md with project conventions. Create `.claude/rules/` with Go unit test patterns, Python test patterns, and Testcontainers guidance. This directly improves AI-assisted contribution quality.

3. **Add PR-time main Dockerfile build** - Add a CI step that builds the main Dockerfile on PRs to catch Go build failures and Dockerfile issues before merge. Currently only validated on release tags.

### Priority 1 (High Value)

4. **Add kustomize manifest validation** - Add `kustomize build deploy/` dry-run to CI. The deploy/ directory is not validated, meaning broken manifests ship silently.

5. **Add multi-version K8s testing** - The Kind cluster script exists but isn't in CI. Add matrix testing for K8s 1.29/1.30/1.31 to catch version-specific issues.

6. **Add concurrency controls to PR workflows** - `ci-test.yaml` and `ci-lint.yaml` lack concurrency groups. Multiple pushes to the same PR queue redundant CI runs.

7. **Create comprehensive .claude/rules/** - Go unit testing rules, Python testing rules, E2E testing rules with Testcontainers examples.

### Priority 2 (Nice-to-Have)

8. **Add HEALTHCHECK to Dockerfiles** - Main and UDS tokenizer Dockerfiles lack `HEALTHCHECK` instructions for better container orchestration.

9. **Add t.Parallel() to Go unit tests** - No tests currently use `t.Parallel()`. Adding it improves CI speed and catches data races.

10. **Add contract tests** - No contract tests exist between Go KV cache manager and Python connectors (llmd_fs_backend, pvc_evictor). Shared protobuf definitions help but don't cover all integration points.

11. **FIPS build configuration** - Add FIPS build tags and boringcrypto support for the Go binary in production builds. Document FIPS strategy for Python components.

## Comparison to Gold Standards

| Dimension | llm-d-kv-cache | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit Tests | 8.0 - Strong ratio, testify | 9.0 - Comprehensive, Jest | 7.0 - Notebook-focused | 9.0 - Extensive, envtest |
| Integration/E2E | 7.0 - Testcontainers, Kind script | 9.0 - Cypress, contract tests | 8.0 - Multi-image E2E | 9.0 - Multi-version |
| Build Integration | 5.0 - Partial PR builds | 8.0 - Full PR validation | 7.0 - Image matrix | 8.0 - Operator bundle |
| Image Testing | 7.0 - Multi-stage, multi-arch | 7.0 - Multi-stage | 9.0 - 5-layer validation | 7.0 - Multi-stage |
| Coverage Tracking | 1.0 - None | 8.0 - Codecov enforced | 6.0 - Basic tracking | 9.0 - Threshold enforcement |
| CI/CD Automation | 8.0 - 24 workflows, nightly race | 9.0 - Full automation | 8.0 - Matrix builds | 9.0 - Comprehensive |
| Static Analysis | 8.0 - 35+ linters, Dependabot | 8.0 - ESLint, Dependabot | 7.0 - Basic linting | 8.0 - golangci-lint |
| Agent Rules | 1.0 - Empty CLAUDE.md | 8.0 - Comprehensive rules | 3.0 - Minimal | 4.0 - Basic |
| **Overall** | **6.2** | **8.3** | **7.0** | **8.0** |

## File Paths Reference

### CI/CD Workflows
- `.github/workflows/ci-test.yaml` - Unit + E2E tests (PR-triggered)
- `.github/workflows/ci-lint.yaml` - Linting and pre-commit (PR-triggered)
- `.github/workflows/ci-examples.yaml` - Example validation (PR-triggered)
- `.github/workflows/ci-nightly-race.yaml` - Race detector (daily)
- `.github/workflows/ci-release.yaml` - Docker image release
- `.github/workflows/ci-wheels.yaml` - CUDA wheel builds

### Test Files
- `pkg/kvcache/*_test.go` - KV cache unit tests (7 files)
- `pkg/kvevents/*_test.go` - KV events unit tests (5 files)
- `pkg/tokenization/*_test.go` - Tokenization unit tests (2 files)
- `tests/integration/kv_events_test.go` - Integration test
- `tests/e2e/uds_tokenizer/` - E2E tests (3 files)
- `kv_connectors/llmd_fs_backend/tests/` - Python FS backend tests (7 files)
- `kv_connectors/pvc_evictor/tests/` - Python PVC evictor tests (4 files)

### Configuration
- `.golangci.yml` - Go linting (35+ linters)
- `.pre-commit-config.yaml` - Pre-commit hooks
- `ruff.toml` - Python linting
- `.github/dependabot.yml` - Dependency updates (4 ecosystems)
- `Makefile` - Build and test targets

### Container Images
- `Dockerfile` - Main Go binary (UBI9 runtime)
- `services/uds_tokenizer/Dockerfile` - UDS tokenizer (multi-stage, multi-arch)
- `kv_connectors/llmd_fs_backend/Dockerfile.wheel` - CUDA wheel builder
- `kv_connectors/llmd_fs_backend/Dockerfile.dev` - Development image
- `kv_connectors/pvc_evictor/Dockerfile` - PVC evictor

### Agent Rules
- `CLAUDE.md` - Empty (needs population)
