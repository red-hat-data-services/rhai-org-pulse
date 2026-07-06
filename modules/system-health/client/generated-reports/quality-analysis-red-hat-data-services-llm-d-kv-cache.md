---
repository: "red-hat-data-services/llm-d-kv-cache"
overall_score: 6.4
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Strong Go + Python test suites with testify, testcontainers, and pytest; 87% test-to-source LOC ratio in Go"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "Testcontainers-based E2E for UDS tokenizer, Go integration tests, Kind-based deployment script; some CI triggers disabled"
  - dimension: "Build Integration"
    score: 5.0
    status: "Tekton/Konflux pipeline exists but is label/comment-triggered, not automatic; no PR-time image build validation in GitHub CI"
  - dimension: "Image Testing"
    score: 6.0
    status: "Smoke test stage in Konflux Dockerfile; no runtime validation in PR CI; Trivy only on release"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "No codecov/coveralls integration; no coverage thresholds; no PR coverage reporting"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "Core test workflow active on PRs; lint, examples, and UDS tokenizer CI disabled (target main_2); nightly race detector; good caching"
  - dimension: "Agent Rules"
    score: 1.0
    status: "No CLAUDE.md, .claude/ directory, or agent rules; Copilot setup present but no test guidance"
critical_gaps:
  - title: "No code coverage tracking or enforcement"
    impact: "Cannot measure or enforce test coverage; regressions go undetected; no visibility into untested code paths"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Lint workflow disabled on main branch PRs"
    impact: "Go linting (golangci-lint with 35+ linters), Python linting (ruff), and pre-commit checks do not run on PRs; code quality issues slip through"
    severity: "HIGH"
    effort: "1 hour"
  - title: "No PR-time security scanning (Trivy only on release)"
    impact: "Vulnerabilities in dependencies and container images are not detected until after release; shifts security left too late"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No CodeQL/SAST or secret detection in CI"
    impact: "Static application security testing gaps; potential code-level vulnerabilities and leaked secrets not caught"
    severity: "HIGH"
    effort: "3-4 hours"
  - title: "Several CI workflows disabled (target non-existent main_2 branch)"
    impact: "Lint, examples verification, and UDS tokenizer integration tests do not run; reduces CI safety net"
    severity: "MEDIUM"
    effort: "30 minutes"
quick_wins:
  - title: "Fix disabled CI workflows by changing main_2 to main"
    effort: "30 minutes"
    impact: "Re-enables lint checks, example verification, and UDS tokenizer integration tests on PRs"
  - title: "Add Trivy scanning to PR CI workflow"
    effort: "1-2 hours"
    impact: "Catches container vulnerability issues before merge, not just at release time"
  - title: "Add codecov integration with coverage generation"
    effort: "4-6 hours"
    impact: "Visibility into test coverage with PR-level enforcement and trend tracking"
  - title: "Add CodeQL SAST workflow"
    effort: "2-3 hours"
    impact: "Automated detection of code-level security vulnerabilities in Go and Python"
  - title: "Create basic agent rules for test patterns"
    effort: "3-4 hours"
    impact: "Consistent AI-generated test quality using existing testify/testcontainers/pytest patterns"
recommendations:
  priority_0:
    - "Fix ci-lint.yaml, ci-examples.yaml, and ci-uds-tokenizer.yaml to trigger on 'main' instead of 'main_2'"
    - "Add codecov integration with coverage generation (go test -coverprofile, pytest --cov) and minimum threshold enforcement"
    - "Add Trivy container scanning to PR CI workflow, not just release pipeline"
  priority_1:
    - "Add CodeQL workflow for Go and Python static analysis"
    - "Add secret detection (gitleaks or trufflehog) to PR workflow"
    - "Create .claude/rules/ directory with test creation rules (unit-tests.md, integration-tests.md, e2e-tests.md)"
    - "Add concurrency control to ci-test.yaml to cancel redundant runs"
  priority_2:
    - "Add performance regression benchmarking to CI (benchmark tests already exist but don't run in CI)"
    - "Create contract tests for gRPC API boundaries"
    - "Add SBOM generation to container build process"
    - "Enable markdownlint in pre-commit (currently commented out)"
---

# Quality Analysis: llm-d-kv-cache

## Executive Summary

- **Overall Score: 6.4/10**
- **Repository Type**: Go library/service with Python connectors for LLM KV cache management
- **Languages**: Go (84 files, 10.6K LOC source), Python (61 files, 6.3K LOC source)
- **Key Strengths**: Excellent test-to-code ratio (~87% in Go, ~71% in Python), well-structured test hierarchy (unit/integration/e2e/benchmark/profiling), strong linting config (35+ Go linters, ruff for Python), pre-commit hooks, Testcontainers for E2E, nightly race detector, multi-arch builds, Tekton/Konflux downstream pipeline
- **Critical Gaps**: No coverage tracking/enforcement, lint CI disabled (targets `main_2`), no PR-time security scanning, no SAST/secret detection, no agent rules
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.0/10 | Strong Go + Python test suites with testify, testcontainers, and pytest |
| Integration/E2E | 7.0/10 | Testcontainers-based E2E, Go integration tests, Kind deployment script |
| **Build Integration** | **5.0/10** | **Tekton/Konflux exists but label-triggered; no automatic PR image validation** |
| Image Testing | 6.0/10 | Smoke test stage in Konflux Dockerfile; Trivy only on release |
| Coverage Tracking | 2.0/10 | No codecov, no thresholds, no PR coverage reporting |
| CI/CD Automation | 6.0/10 | Core tests active; lint + 2 other workflows disabled; good caching |
| Agent Rules | 1.0/10 | No test automation guidance for AI agents |

## Critical Gaps

### 1. No Code Coverage Tracking or Enforcement
- **Impact**: Cannot measure or enforce test coverage; regressions go undetected; no visibility into untested code paths
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Despite having excellent test-to-code ratios (87% Go, 71% Python), there is no codecov/coveralls integration, no `go test -coverprofile` in CI, no `pytest --cov` configuration, and no coverage thresholds. This means the team has no data on which code paths are actually tested.

### 2. Lint Workflow Disabled on PRs
- **Impact**: The comprehensive golangci-lint configuration (35+ linters including gosec, gocritic, staticcheck) and ruff Python linting do not run on PRs
- **Severity**: HIGH
- **Effort**: 1 hour (change `main_2` to `main` in ci-lint.yaml)
- **Details**: `ci-lint.yaml` triggers on PRs to `main_2` branch, which appears to not exist. The `.golangci.yml` is well-configured with 35+ linters, gocritic, gosec, and formatters (gofumpt, goimports) — but none of this runs on PRs.

### 3. No PR-Time Security Scanning
- **Impact**: Vulnerabilities in dependencies and container images are only detected at release time, not during development
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: Trivy scanning exists as a reusable action (`.github/actions/trivy-scan/action.yml`) but is only invoked in `ci-release.yaml` (on tag push). No scanning runs during PR review.

### 4. No SAST or Secret Detection
- **Impact**: No automated detection of code-level security vulnerabilities or leaked secrets
- **Severity**: HIGH
- **Effort**: 3-4 hours
- **Details**: No CodeQL configuration, no gosec CI job (though gosec is enabled in golangci-lint — which is disabled), no gitleaks/trufflehog, no Semgrep.

### 5. Multiple CI Workflows Disabled
- **Impact**: Reduces the CI safety net significantly
- **Severity**: MEDIUM
- **Effort**: 30 minutes
- **Details**: Three workflows target the non-existent `main_2` branch:
  - `ci-lint.yaml` — All linting and pre-commit checks
  - `ci-examples.yaml` — Example verification
  - `ci-uds-tokenizer.yaml` — UDS tokenizer integration tests

## Quick Wins

### 1. Fix Disabled CI Workflows (30 minutes)
Change `main_2` to `main` in three workflow files:
- `.github/workflows/ci-lint.yaml`
- `.github/workflows/ci-examples.yaml`
- `.github/workflows/ci-uds-tokenizer.yaml`

This immediately re-enables linting, example verification, and UDS tokenizer integration tests on PRs.

### 2. Add Trivy Scanning to PR Workflow (1-2 hours)
The Trivy action already exists at `.github/actions/trivy-scan/action.yml`. Add a job to `ci-test.yaml` that builds the image and scans it:

```yaml
security-scan:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v6
    - name: Build image
      run: docker build -t llm-d-kv-cache:pr-scan .
    - name: Run Trivy scan
      uses: ./.github/actions/trivy-scan
      with:
        image: llm-d-kv-cache:pr-scan
```

### 3. Add Codecov Integration (4-6 hours)
Add coverage generation to test commands and integrate with Codecov:

```yaml
# In ci-test.yaml unit-test job
- name: Run unit tests with coverage
  run: go test -coverprofile=coverage.out -covermode=atomic ./pkg/...
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: coverage.out
    fail_ci_if_error: true
```

### 4. Add CodeQL Workflow (2-3 hours)
```yaml
name: CodeQL
on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 8 * * 1'
jobs:
  analyze:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        language: [go, python]
    steps:
      - uses: actions/checkout@v6
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

### 5. Create Agent Rules (3-4 hours)
Create `.claude/rules/` with test patterns matching existing framework usage (testify assertions, testcontainers patterns, pytest fixtures).

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory** (31 files in `.github/workflows/`):

| Workflow | Trigger | Status |
|----------|---------|--------|
| `ci-test.yaml` | PR to main/dev | ACTIVE |
| `ci-pvc-evictor.yaml` | PR (pvc_evictor paths) | ACTIVE |
| `ci-signed-commits.yaml` | pull_request_target | ACTIVE |
| `ci-nightly-race.yaml` | Cron (daily 06:00 UTC) | ACTIVE |
| `ci-release.yaml` | Tag push / release | ACTIVE |
| `ci-wheels.yaml` | Tag push / dispatch | ACTIVE |
| `ci-lint.yaml` | PR to **main_2** | DISABLED |
| `ci-examples.yaml` | PR to **main_2** | DISABLED |
| `ci-uds-tokenizer.yaml` | PR to **main_2** | DISABLED |
| `prow-github.yml` | Issue comments | ACTIVE |
| `prow-pr-automerge.yml` | Various | ACTIVE |
| Various housekeeping | Various | ACTIVE |

**Strengths**:
- Good caching strategy (apt dependencies, Go modules, Docker layer caching with GHA)
- Nightly race detector with Go `-race` flag
- Multi-architecture builds (amd64 + arm64) for CUDA wheels and release images
- Tekton/Konflux pipeline for downstream RHOAI builds with hermetic builds
- Signed commit enforcement
- Dependabot + Renovate for dependency updates
- Mergify for automated PR comments on pre-commit failure
- Prow-style labels and commands via reusable workflows

**Weaknesses**:
- No concurrency control on PR workflows (redundant runs not cancelled)
- Three critical workflows disabled by targeting `main_2`
- No coverage generation or reporting in any workflow
- No PR-time security scanning

### Test Coverage

**Go Tests (32 files, 9,170 LOC)**:
- **Framework**: `testify` (assert/require), `testcontainers-go`
- **Unit tests**: Strong coverage in `pkg/kvcache/`, `pkg/kvevents/`, `pkg/tokenization/`, `pkg/telemetry/`
- **Integration tests**: `tests/integration/kv_events_test.go` — Pool + SubscriberManager integration
- **E2E tests**: `tests/e2e/uds_tokenizer/` — Container-based testing with testcontainers
- **Benchmark tests**: 3 benchmark files (`zmq_subscriber_bench_test.go`, `vllm_adapter_bench_test.go`, `index_benchmark_test.go`)
- **Profiling**: `tests/profiling/kv_cache_index/` with dedicated README

**Python Tests (15 files, 4,443 LOC)**:
- **Framework**: `pytest`
- **FS Backend tests**: Unit tests for fs_backend, gds_backend, hma, obj_backend, priority_queue, spec
- **PVC Evictor tests**: Unit tests for activator, crawler, deleter, folder_cleaner
- **Performance tests**: Stress tests and throughput tests
- **UDS Tokenizer**: Integration and renderer tests

**Test-to-Source Ratios**:
- Go: 9,170 test LOC / 10,595 source LOC = **87%** (excellent)
- Python: 4,443 test LOC / 6,273 source LOC = **71%** (good)

**Test Hierarchy**:
```
tests/
├── e2e/uds_tokenizer/       # Container-based E2E
├── integration/              # Component integration
├── profiling/                # Benchmark + profiling
└── kind-vllm-cpu.sh          # Kind cluster deployment test
```

### Code Quality

**Go Linting** (`.golangci.yml` — v2 format):
- 35+ linters enabled (well-curated selection)
- Includes security linters: `gosec`
- Includes style enforcement: `gocritic`, `revive`, `varnamelen`
- Includes correctness: `errcheck`, `staticcheck`, `govet`
- Line length limit: 130
- Formatters: `gofumpt`, `goimports`
- Generated file exclusions (protobuf)
- **Issue**: Not running on PRs due to disabled workflow

**Python Linting** (`ruff.toml`):
- Target Python 3.12
- Select rules: pycodestyle (E), pyflakes (F), pyupgrade (UP), bugbear (B), simplify (SIM), isort (I)
- Docstring code formatting enabled
- Generated file exclusions (protobuf)

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- `ruff-check` with auto-fix and GitHub output format
- `ruff-format` for Python formatting
- `typos` for spell checking
- `clang-format` for C++/CUDA files
- `actionlint` for GitHub Actions validation
- `pip-compile` via uv for requirements pinning
- **Missing**: markdownlint (commented out)

### Container Images

**Dockerfiles** (5 files):
1. `Dockerfile` — Main Go service (multi-stage: golang builder → UBI9 runtime)
2. `services/uds_tokenizer/Dockerfile` — UDS tokenizer Python service
3. `services/uds_tokenizer/Dockerfile.konflux` — Konflux variant with smoke test stage
4. `kv_connectors/llmd_fs_backend/Dockerfile.dev` — FS backend development image
5. `kv_connectors/llmd_fs_backend/Dockerfile.wheel` — CUDA wheel builder

**Strengths**:
- Multi-stage builds for size optimization
- Non-root user (65532:65532) in production images
- UBI base images for compliance
- **Konflux Dockerfile includes smoke test stage** (validates critical imports)
- `.dockerignore` present
- Multi-architecture support (amd64 + arm64)

**Weaknesses**:
- No runtime validation testing (just import smoke test)
- No health check in main Dockerfile
- No SBOM generation
- No image signing/attestation in GitHub CI

### Security

**Current State**:
- Trivy scanning: Present but only on release (`ci-release.yaml`)
- gosec linter: Enabled in golangci-lint but not running (disabled CI)
- Dependabot: Configured for gomod, GitHub Actions, and Docker
- Renovate: Configured via shared config from `red-hat-data-services/konflux-central`
- Signed commits: Enforced via reusable workflow
- Hermetic builds: Enabled in Tekton/Konflux pipeline

**Missing**:
- No CodeQL/SAST in CI
- No secret detection (gitleaks, trufflehog)
- No dependency vulnerability scanning on PRs
- No `.trivyignore` or `.gitleaks.toml` configuration

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No test automation guidance for AI agents
- **Quality**: N/A
- **Gaps**:
  - No `CLAUDE.md` or `AGENTS.md`
  - No `.claude/` directory
  - No `.claude/rules/` for test creation guidance
  - No `.claude/skills/` for custom automation
  - Copilot setup workflow exists but provides no test guidance
- **Recommendation**: Generate missing rules with `/test-rules-generator` covering:
  - Go unit tests (testify patterns, table-driven tests)
  - Go integration tests (testcontainers patterns)
  - Go E2E tests (container-based testing)
  - Python unit tests (pytest patterns, fixtures)
  - Benchmark tests (Go benchmark conventions)

## Recommendations

### Priority 0 (Critical)

1. **Fix disabled CI workflows** — Change `main_2` to `main` in `ci-lint.yaml`, `ci-examples.yaml`, `ci-uds-tokenizer.yaml`. This immediately restores 35+ Go linters, Python linting, pre-commit checks, example verification, and UDS integration tests on PRs.

2. **Add coverage tracking** — Add `go test -coverprofile` and `pytest --cov`, integrate with Codecov, set minimum thresholds (start at current coverage, ratchet up). The excellent test ratio suggests coverage is good but unmeasured.

3. **Add PR-time Trivy scanning** — Reuse the existing `.github/actions/trivy-scan/action.yml` in the PR workflow. Currently vulnerabilities are only caught at release time.

### Priority 1 (High Value)

4. **Add CodeQL SAST workflow** — GitHub's free SAST for Go and Python. Catches security vulnerabilities that unit tests miss.

5. **Add secret detection** — Add gitleaks pre-commit hook and CI workflow. Prevents credential leaks.

6. **Create agent rules** — Build `.claude/rules/` with patterns matching existing test frameworks (testify, testcontainers, pytest). Use `/test-rules-generator` to bootstrap.

7. **Add concurrency control** — Add `concurrency: { group: ${{ github.ref }}, cancel-in-progress: true }` to PR workflows to avoid redundant test runs.

### Priority 2 (Nice-to-Have)

8. **Run benchmarks in CI** — Three benchmark test files exist but don't run in CI. Add periodic benchmark regression tracking.

9. **Contract tests for gRPC** — The gRPC API boundary between Go client and Python server lacks contract tests. The protobuf definitions are generated but not validated in CI.

10. **SBOM generation** — Add SBOM generation to container builds for supply chain transparency.

11. **Enable markdownlint** — Currently commented out in `.pre-commit-config.yaml`. Uncomment and configure.

## Comparison to Gold Standards

| Dimension | llm-d-kv-cache | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|-----------|---------------|----------------------|-------------------|---------------|
| Unit Tests | 8/10 | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 7/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 5/10 | 8/10 | 7/10 | 8/10 |
| Image Testing | 6/10 | 7/10 | 9/10 | 7/10 |
| Coverage Tracking | 2/10 | 9/10 | 5/10 | 9/10 |
| CI/CD Automation | 6/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 1/10 | 9/10 | 3/10 | 2/10 |
| **Overall** | **6.4/10** | **8.8/10** | **7.0/10** | **8.0/10** |

**Key differentiators from gold standards**:
- **odh-dashboard**: Has multi-layer testing, contract tests, comprehensive CI/CD, coverage enforcement, and extensive agent rules
- **notebooks**: Has 5-layer image validation, multi-architecture testing, security scanning at PR time
- **kserve**: Has coverage enforcement, multi-version testing, comprehensive E2E with Kind clusters

## File Paths Reference

### CI/CD
- `.github/workflows/ci-test.yaml` — Main test workflow (unit + E2E)
- `.github/workflows/ci-lint.yaml` — Linting (DISABLED)
- `.github/workflows/ci-nightly-race.yaml` — Nightly race detector
- `.github/workflows/ci-release.yaml` — Release build + Trivy
- `.github/workflows/ci-wheels.yaml` — CUDA wheel builds
- `.github/workflows/ci-pvc-evictor.yaml` — PVC evictor tests
- `.github/actions/trivy-scan/action.yml` — Reusable Trivy action
- `.github/actions/docker-build-and-push/action.yml` — Reusable Docker build
- `.tekton/odh-llm-d-kv-cache-pull-request.yaml` — Konflux/Tekton pipeline

### Testing
- `pkg/kvcache/kvblock/*_test.go` — Core KV block unit tests
- `pkg/kvevents/*_test.go` — KV events unit tests
- `pkg/tokenization/*_test.go` — Tokenization unit tests
- `tests/integration/kv_events_test.go` — Integration tests
- `tests/e2e/uds_tokenizer/` — E2E tests (testcontainers)
- `tests/profiling/` — Benchmark/profiling tests
- `kv_connectors/llmd_fs_backend/tests/` — FS backend Python tests
- `kv_connectors/pvc_evictor/tests/` — PVC evictor Python tests
- `services/uds_tokenizer/tests/` — UDS tokenizer Python tests

### Code Quality
- `.golangci.yml` — Go linting (35+ linters, v2 format)
- `ruff.toml` — Python linting
- `.pre-commit-config.yaml` — Pre-commit hooks (ruff, typos, clang-format, actionlint, pip-compile)
- `_typos.toml` — Typo checker config
- `.clang-format` — C++/CUDA formatting

### Container Images
- `Dockerfile` — Main Go service
- `services/uds_tokenizer/Dockerfile` — UDS tokenizer
- `services/uds_tokenizer/Dockerfile.konflux` — Konflux variant (with smoke test)
- `kv_connectors/llmd_fs_backend/Dockerfile.dev` — FS backend dev
- `kv_connectors/llmd_fs_backend/Dockerfile.wheel` — CUDA wheel builder

### Dependencies
- `.github/dependabot.yml` — Dependabot (gomod, actions, docker)
- `.github/renovate.json` — Renovate (Konflux-central shared config)
- `.github/mergify.yml` — Mergify rules

### Deployment
- `deploy/` — Kustomize deployment manifests
- `vllm-setup-helm/` — Helm chart for vLLM setup
- `tests/kind-vllm-cpu.sh` — Kind cluster deployment script
