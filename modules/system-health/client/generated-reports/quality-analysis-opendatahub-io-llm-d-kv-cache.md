---
repository: "opendatahub-io/llm-d-kv-cache"
overall_score: 7.4
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Extensive Go unit tests (~7,400 lines) with good coverage of core packages; Python tests for connectors and evictor"
  - dimension: "Integration/E2E"
    score: 7.5
    status: "Testcontainers-based E2E for UDS tokenizer, integration test for KV events; profiling benchmarks present"
  - dimension: "Build Integration"
    score: 6.5
    status: "Tekton/Konflux pipelines for downstream builds; no PR-time Konflux simulation but Docker image built in CI"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-arch image builds, Trivy scanning on release, multi-stage Dockerfiles, but no PR-time image startup validation"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "No codecov/coveralls integration, no coverage thresholds, no PR coverage reporting"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "Well-organized 20+ workflows with caching, path-filtered triggers, Mergify, Dependabot, nightly race detection"
  - dimension: "Agent Rules"
    score: 1.0
    status: "No CLAUDE.md, .claude/ directory, or agent rules for test creation guidance"
critical_gaps:
  - title: "No code coverage tracking or enforcement"
    impact: "Cannot measure test coverage trends, regressions go undetected, no coverage gates on PRs"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No SAST/CodeQL or static security analysis on PRs"
    impact: "Security vulnerabilities only caught by Trivy on release images, not during code review"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No PR-time container image startup validation"
    impact: "Image build issues or runtime failures only discovered after merge"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents generate inconsistent tests without framework-specific patterns"
    severity: "MEDIUM"
    effort: "3-4 hours"
  - title: "Trivy scanning only runs on release, not on PRs"
    impact: "Vulnerabilities introduced in PRs not caught until release pipeline"
    severity: "HIGH"
    effort: "1-2 hours"
quick_wins:
  - title: "Add codecov integration to ci-test.yaml"
    effort: "2-3 hours"
    impact: "Immediate visibility into test coverage trends and PR-level coverage reporting"
  - title: "Add Trivy scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Catch container vulnerabilities before merge, not just at release time"
  - title: "Add CodeQL/gosec workflow for PR-time SAST"
    effort: "2-3 hours"
    impact: "Early detection of security vulnerabilities in Go and Python code"
  - title: "Create basic .claude/rules/ for test patterns"
    effort: "2-3 hours"
    impact: "Consistent AI-generated tests following project conventions"
  - title: "Add Go coverage flag to unit-test Makefile target"
    effort: "30 minutes"
    impact: "Generate coverage reports that can be uploaded to codecov"
recommendations:
  priority_0:
    - "Implement code coverage tracking with codecov — add -coverprofile to go test and upload in CI"
    - "Add Trivy container scanning to PR workflows, not just release pipelines"
    - "Add CodeQL or gosec SAST workflow triggered on pull requests"
  priority_1:
    - "Add PR-time image build validation with basic startup/healthcheck test"
    - "Create comprehensive .claude/rules/ for unit, integration, and E2E test patterns"
    - "Add concurrency controls to PR-triggered workflows to prevent resource contention"
  priority_2:
    - "Add performance regression testing with benchmark comparison in CI"
    - "Implement contract tests for gRPC API boundaries (tokenizer, indexer protos)"
    - "Add SBOM generation to container image builds"
---

# Quality Analysis: llm-d-kv-cache

## Executive Summary

- **Overall Score: 7.4/10**
- **Repository Type**: Go + Python library/service — KV cache management for LLM inference (llm-d ecosystem)
- **Primary Languages**: Go (core logic, events, tokenization), Python (filesystem backend, PVC evictor, UDS tokenizer service)
- **Key Strengths**: Excellent CI/CD organization with 20+ workflows, comprehensive linting (35+ golangci-lint rules + ruff), strong unit test coverage (~7,400 lines Go tests), nightly race detection, well-structured E2E with Testcontainers, multi-arch builds, Tekton/Konflux pipelines
- **Critical Gaps**: No code coverage tracking/enforcement, no PR-time security scanning (SAST/CodeQL), Trivy only on release, no agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, no .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Extensive Go test suite (~7,400 lines) across all core packages; Python tests for connectors |
| Integration/E2E | 7.5/10 | Testcontainers E2E for UDS tokenizer, integration tests, benchmark/profiling tests |
| **Build Integration** | **6.5/10** | **Tekton/Konflux for downstream builds; Docker image built in E2E CI but no Konflux simulation** |
| Image Testing | 7.0/10 | Multi-arch builds (amd64/arm64), Trivy scanning, multi-stage Dockerfiles, Konflux Dockerfile |
| Coverage Tracking | 3.0/10 | No codecov/coveralls, no coverage thresholds, no PR coverage gates |
| CI/CD Automation | 8.5/10 | 20+ workflows, path filtering, caching, Dependabot, Mergify, nightly race detection |
| Agent Rules | 1.0/10 | No CLAUDE.md, .claude/, or agent test rules |

## Critical Gaps

### 1. No Code Coverage Tracking or Enforcement
- **Impact**: Cannot measure test coverage trends; coverage regressions go undetected; no PR-level coverage gates
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The `go test` commands in CI and Makefile do not generate coverage profiles (`-coverprofile`). No codecov.yml, .coveragerc, or coverage upload steps exist. Python tests also lack coverage measurement.
- **Fix**:
  ```yaml
  # Add to ci-test.yaml unit-test job
  - name: Run unit tests with coverage
    run: go test -v -coverprofile=coverage.out ./pkg/...
  - name: Upload coverage
    uses: codecov/codecov-action@v4
    with:
      files: ./coverage.out
  ```

### 2. No PR-Time SAST/Security Scanning
- **Impact**: Security vulnerabilities in code only caught by Trivy on release images; no CodeQL, gosec, or Semgrep on PRs
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The golangci-lint config enables `gosec` linter, which catches some issues. But there's no dedicated SAST workflow (CodeQL, Semgrep) or secret detection (Gitleaks) running on PRs. Trivy only scans release images.

### 3. Trivy Scanning Only on Release
- **Impact**: Container vulnerabilities introduced in PRs are not detected until the release pipeline runs
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: Trivy is called via `.github/actions/trivy-scan` but only in `ci-release.yaml`, `ci-release-uds-tokenizer.yaml`, and `ci-dev-uds-tokenizer.yaml` (push to main). The PR workflow builds an image but never scans it.

### 4. No PR-Time Container Startup Validation
- **Impact**: Image build issues or runtime startup failures discovered only after merge
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: The E2E workflow builds the UDS tokenizer image and runs E2E tests against it — this is good. However, the main Go application image is never built or validated in PR CI. Only the `Dockerfile` is validated at release time.

### 5. No Agent Rules for AI-Assisted Development
- **Impact**: AI coding agents generate inconsistent tests without framework-specific guidance
- **Severity**: MEDIUM
- **Effort**: 3-4 hours
- **Details**: No `.claude/` directory, `CLAUDE.md`, or `AGENTS.md` exists. The repo has clear testing patterns (testify, Ginkgo for E2E, pytest for Python) that should be documented as agent rules.

## Quick Wins

### 1. Add Coverage to Go Tests (30 minutes)
```makefile
# In Makefile, update unit-test-uds target
unit-test-uds: check-go download-zmq
	@go test -v -coverprofile=coverage.out ./pkg/...
```

### 2. Add Trivy to PR Workflow (1-2 hours)
```yaml
# Add to ci-test.yaml e2e-test job after building image
- name: Run Trivy scan on PR image
  uses: ./.github/actions/trivy-scan
  with:
    image: llm-d-uds-tokenizer:e2e-test
```

### 3. Add CodeQL Workflow (2-3 hours)
```yaml
name: CodeQL Analysis
on:
  pull_request:
    branches: [main, dev]
jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v6
      - uses: github/codeql-action/init@v3
        with:
          languages: go, python
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

### 4. Create Basic Agent Rules (2-3 hours)
Create `.claude/rules/unit-tests.md` with Go testing patterns (testify assertions, table-driven tests, `_test` package convention) and pytest patterns for Python components.

## Detailed Findings

### CI/CD Pipeline

**Strengths:**
- **20+ workflows** covering lint, test, E2E, release, nightly race detection, examples verification, dependency updates
- **Path-filtered triggers** — PVC evictor and UDS tokenizer workflows only run when their directories change
- **Smart caching** — apt archives cached, Go module cache via `actions/setup-go`, Docker layer cache via GHA
- **Nightly race detection** (`ci-nightly-race.yaml`) — runs `go test -race` daily to catch data races
- **Dependabot** configured for Go modules, GitHub Actions, Docker base images across multiple directories
- **Mergify** auto-comments pre-commit fix instructions when pre-commit checks fail
- **Signed commit enforcement** via reusable workflow from `llm-d/llm-d-infra`
- **Multi-arch release builds** — supports `linux/amd64` and `linux/arm64`
- **CUDA wheel builds** — matrix strategy for amd64/arm64 × cu12/cu130 variants
- **PyPI Pages index** — automated PEP 503 simple index for wheel distribution

**Gaps:**
- No concurrency controls on most PR workflows (only `ci-pages-index.yaml` has `cancel-in-progress`)
- No workflow for building/validating the main Go application Docker image on PRs
- No Gitleaks or secret detection workflow
- No SBOM generation

### Test Coverage

**Go Unit Tests (8.5/10):**
- **32 test files** with ~7,400 lines across core packages
- Thorough coverage of `pkg/kvcache/kvblock/` (3,129 lines — index, token processor, valkey, redis, in-memory, cost-aware memory)
- Strong event system testing in `pkg/kvevents/` (1,353 lines — pool, subscriber manager, ZMQ subscriber)
- Engine adapter tests for vLLM and SGLang (1,251 lines)
- Telemetry, tokenization, and utility tests present
- Uses `testify` (assert/require) consistently
- Test-to-code ratio: 0.67 (32 test files / 48 source files for Go) — good

**Python Unit Tests (7.0/10):**
- **15 test files** across three components:
  - `kv_connectors/llmd_fs_backend/tests/` — filesystem backend, GDS backend, HMA, object backend, priority queue, spec tests
  - `kv_connectors/pvc_evictor/tests/` — activator, crawler, deleter, folder cleaner
  - `services/uds_tokenizer/tests/` — integration and renderer tests
- Uses `pytest` with conftest fixtures
- Performance/stress tests included (`test_stress.py`, `test_throughput.py`)
- CPU-safe test separation for environments without GPU

**Integration Tests (7.5/10):**
- `tests/integration/kv_events_test.go` — tests Pool + SubscriberManager integration
- UDS tokenizer integration tests (`test_integration.py`) with server startup
- Example verification script (`hack/verify-examples.sh`) runs in CI

**E2E Tests (7.5/10):**
- `tests/e2e/uds_tokenizer/` — Ginkgo suite testing tokenization, special tokens, chat templates, multimodal rendering
- Uses **Testcontainers** for Docker-based E2E — builds and runs actual service container
- Tests run on PRs against both `main` and `dev` branches

**Benchmark/Profiling Tests (7.0/10):**
- `tests/profiling/kv_cache_index/index_benchmark_test.go` — index performance profiling with miniredis
- `pkg/kvevents/zmq_subscriber_bench_test.go` — ZMQ throughput benchmarks
- `pkg/kvevents/engineadapter/vllm_adapter_bench_test.go` — vLLM adapter benchmarks
- Not run in CI or tracked for regressions

### Code Quality

**Go Linting (9.0/10) — Excellent:**
- golangci-lint v2.9.0 with **35+ enabled linters** including:
  - Security: `gosec`
  - Code quality: `gocritic`, `staticcheck`, `revive`, `errcheck`, `errorlint`
  - Style: `gofumpt`, `goimports`, `varnamelen`, `nakedret`, `whitespace`
  - Testing: `ginkgolinter`, `testpackage`, `thelper`, `tparallel`
  - Performance: `prealloc`, `bodyclose`, `noctx`
- Strict configuration: `check-type-assertions: true`, `check-blank: true`
- Line length limit: 130 characters
- Generated code properly excluded (`.pb.go`, `_grpc.pb.go`)

**Python Linting (8.0/10) — Strong:**
- `ruff` with 7 rule categories (pycodestyle, pyflakes, pyupgrade, bugbear, simplify, isort, logging-format)
- Target: Python 3.12, line length: 120
- Code formatting via `ruff format`
- Generated protobuf files excluded

**Pre-commit Hooks (8.5/10):**
- `ruff-check` and `ruff-format` for Python
- `typos` for spell checking
- `clang-format` for C++/CUDA files
- `actionlint` for GitHub Actions validation
- `pip-compile` for dependency pinning
- Runs in both local (`pre-commit`) and CI (`manual`) stages
- Mergify auto-comments fix instructions on failure

**Other Quality Tools:**
- `_typos.toml` — configurable typo checker
- `.licenserc.yaml` — Apache 2.0 license header enforcement via skywalking-eyes
- `.clang-format` — C/C++/CUDA formatting
- `.git-blame-ignore-revs` — clean git blame history

### Container Images

**Build Process (7.5/10):**
- **Main Go image**: Multi-stage (builder → UBI9 runtime), non-root user (65532), ZMQ runtime dependency
- **UDS tokenizer image**: Multi-stage (builder → python:3.12-slim runtime), non-root user, health check port
- **Konflux Dockerfile**: UBI9-based variant for Red Hat builds with RHEL labels
- **FS backend dev image**: Separate Dockerfile for development
- **CUDA wheel builder**: Dockerfile.wheel for building GPU-accelerated Python wheels

**Multi-architecture (8.0/10):**
- Release builds target `linux/amd64,linux/arm64`
- CUDA wheels built for both `amd64` and `arm64`

**Security Scanning (5.0/10):**
- Trivy scanning on release images — HIGH/CRITICAL severity
- No PR-time scanning
- No SBOM generation
- No image signing/attestation

### Security

**Current State (5.5/10):**
- `gosec` enabled via golangci-lint (catches common Go security issues)
- Signed commit enforcement via reusable workflow
- Trivy on release images
- Dependabot for dependency updates
- Non-root container users

**Missing:**
- No CodeQL or dedicated SAST workflow
- No Gitleaks/TruffleHog secret detection
- No dependency vulnerability scanning (beyond Dependabot alerts)
- No SBOM generation
- No container image signing

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: All test types lack agent rules
- **Recommendation**: Generate rules with `/test-rules-generator` covering:
  - Go unit tests (testify, table-driven, `_test` package)
  - Go integration tests (context management, cleanup)
  - Go E2E tests (Ginkgo suites, Testcontainers)
  - Python pytest patterns (conftest, fixtures, CPU-safe tests)
  - Benchmark test patterns

## Recommendations

### Priority 0 (Critical)
1. **Implement code coverage tracking** — Add `-coverprofile` to `go test`, configure codecov, enforce minimum thresholds
2. **Add Trivy scanning to PR workflows** — Move vulnerability detection left; scan the images already built in E2E CI
3. **Add CodeQL/SAST workflow** — Enable CodeQL for Go and Python on pull requests

### Priority 1 (High Value)
4. **Add PR-time main image build validation** — Build the Go application Dockerfile in PR CI and run a basic startup test
5. **Create agent rules** — Document test patterns in `.claude/rules/` for Go (testify, Ginkgo) and Python (pytest)
6. **Add concurrency controls** — Add `concurrency: group: ${{ github.workflow }}-${{ github.ref }}` to PR workflows
7. **Add Python coverage** — Use `pytest --cov` for Python test suites

### Priority 2 (Nice-to-Have)
8. **Benchmark regression tracking** — Run benchmarks in CI and compare against baseline
9. **Contract tests for gRPC APIs** — Test tokenizer and indexer proto boundaries
10. **SBOM generation** — Add Syft or similar to release pipeline
11. **Image signing** — Add cosign or Sigstore attestation
12. **Gitleaks secret detection** — Add pre-commit hook and CI workflow

## Comparison to Gold Standards

| Practice | llm-d-kv-cache | odh-dashboard | notebooks | kserve |
|----------|---------------|---------------|-----------|--------|
| Unit test coverage | Strong (7,400+ lines Go) | Extensive (Jest) | Moderate | Strong |
| Integration/E2E | Good (Testcontainers) | Excellent (Cypress) | Good | Excellent |
| Coverage tracking | **None** | Codecov enforced | Basic | Codecov |
| Linting depth | Excellent (35+ linters) | Good (ESLint) | Basic | Good |
| Pre-commit hooks | Good (5 hooks) | Good | None | Basic |
| Container scanning | Release-only Trivy | PR + Release | Layered | PR |
| SAST/CodeQL | **None** | CodeQL | None | CodeQL |
| Multi-arch builds | Yes (amd64/arm64) | N/A | Yes | Yes |
| Nightly testing | Race detection | None | Nightly image tests | None |
| Agent rules | **None** | Comprehensive | None | None |
| Benchmark testing | Present (not in CI) | None | None | None |
| Dependency management | Dependabot + Mergify | Dependabot | Dependabot | Dependabot |

## File Paths Reference

### CI/CD Workflows
- `.github/workflows/ci-test.yaml` — Unit + E2E tests on PRs
- `.github/workflows/ci-lint.yaml` — Go + Python linting on PRs
- `.github/workflows/ci-examples.yaml` — Example verification on PRs
- `.github/workflows/ci-nightly-race.yaml` — Nightly race detector
- `.github/workflows/ci-pvc-evictor.yaml` — PVC evictor tests (path-filtered)
- `.github/workflows/ci-uds-tokenizer.yaml` — UDS tokenizer integration tests (path-filtered)
- `.github/workflows/ci-release.yaml` — Release image build + Trivy
- `.github/workflows/ci-release-uds-tokenizer.yaml` — UDS tokenizer release
- `.github/workflows/ci-dev-uds-tokenizer.yaml` — Dev image for main pushes
- `.github/workflows/ci-wheels.yaml` — CUDA wheel builds on tags
- `.github/workflows/ci-pages-index.yaml` — PyPI index publication
- `.github/workflows/ci-signed-commits.yaml` — Signed commit enforcement

### Test Files
- `pkg/kvcache/kvblock/*_test.go` — Core KV block index tests (3,129 lines)
- `pkg/kvcache/*_test.go` — KV cache scorer/indexer tests
- `pkg/kvevents/*_test.go` — Event system tests
- `pkg/kvevents/engineadapter/*_test.go` — vLLM/SGLang adapter tests
- `pkg/tokenization/*_test.go` — Tokenization tests
- `tests/e2e/uds_tokenizer/` — Ginkgo E2E suite
- `tests/integration/kv_events_test.go` — Integration test
- `tests/profiling/kv_cache_index/` — Benchmark/profiling
- `kv_connectors/llmd_fs_backend/tests/` — Python backend tests
- `kv_connectors/pvc_evictor/tests/` — Python evictor tests

### Quality Configuration
- `.golangci.yml` — 35+ linters enabled
- `ruff.toml` — Python linting (7 rule categories)
- `.pre-commit-config.yaml` — 5 pre-commit hooks
- `_typos.toml` — Typo checker config
- `.licenserc.yaml` — License header enforcement

### Container/Build
- `Dockerfile` — Main Go application (multi-stage, UBI9)
- `services/uds_tokenizer/Dockerfile` — UDS tokenizer (multi-stage, python:3.12-slim)
- `services/uds_tokenizer/Dockerfile.konflux` — Red Hat/Konflux variant (UBI9)
- `kv_connectors/llmd_fs_backend/Dockerfile.wheel` — CUDA wheel builder
- `.tekton/odh-llm-d-kv-cache-pull-request.yaml` — Tekton PR pipeline
- `.tekton/odh-llm-d-kv-cache-push.yaml` — Tekton push pipeline
