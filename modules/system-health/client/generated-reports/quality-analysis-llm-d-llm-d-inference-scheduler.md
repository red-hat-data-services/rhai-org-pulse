---
repository: "llm-d/llm-d-inference-scheduler"
overall_score: 8.4
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "1,083 test functions across 236 files; race detection and coverage profiling enabled"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Hermetic envtest integration + Kind-based E2E with 6 parallel matrix suites"
  - dimension: "Build Integration"
    score: 7.5
    status: "PR builds Docker images for E2E; no Konflux simulation but strong Kind deployment testing"
  - dimension: "Image Testing"
    score: 8.0
    status: "Multi-stage distroless builds with Trivy gating on release; images validated via E2E"
  - dimension: "Coverage Tracking"
    score: 9.0
    status: "Per-component coverage with baseline comparison against main and release branches; regression gate enforced"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "19 workflows with concurrency control, path filtering, Go caching, and matrix E2E"
  - dimension: "Agent Rules"
    score: 7.0
    status: "Comprehensive AGENTS.md with operating rules, code style, and PR guidelines; no .claude/rules/ directory"
critical_gaps:
  - title: "No PR-time Trivy/security scanning"
    impact: "Container vulnerabilities only caught at release time, not during PR review"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No CodeQL or SAST integration"
    impact: "Static security analysis not running; relying only on govulncheck for Go vulnerabilities"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No .claude/rules/ for test pattern guidance"
    impact: "AI agents lack structured test creation rules for unit, integration, and E2E patterns"
    severity: "LOW"
    effort: "3-4 hours"
quick_wins:
  - title: "Add Trivy scanning to PR workflow"
    effort: "2-3 hours"
    impact: "Shift-left vulnerability detection from release to PR time"
  - title: "Add CodeQL workflow for Go static analysis"
    effort: "1-2 hours"
    impact: "Catch security vulnerabilities and code quality issues via GitHub Security tab"
  - title: "Generate .claude/rules/ for test patterns"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality with structured patterns from existing tests"
  - title: "Add coverage threshold enforcement"
    effort: "1-2 hours"
    impact: "Prevent PRs from merging when total coverage drops below a minimum"
recommendations:
  priority_0:
    - "Add Trivy container scanning to the ci-pr-checks.yaml workflow to catch vulnerabilities before merge"
    - "Add CodeQL or Semgrep SAST workflow for Go static security analysis"
  priority_1:
    - "Generate .claude/rules/ test creation rules using /test-rules-generator for all test types"
    - "Add explicit minimum coverage threshold (e.g., 70%) to the coverage-compare gate"
    - "Add SBOM generation (Syft/cosign) to the release image build pipeline"
  priority_2:
    - "Add pre-commit-config.yaml for standardized local pre-commit hooks across contributors"
    - "Add performance regression benchmarks to PR CI for latency-sensitive routing paths"
    - "Consider Gitleaks or TruffleHog for secret detection in CI"
---

# Quality Analysis: llm-d-inference-scheduler

## Executive Summary

- **Overall Score: 8.4/10**
- **Repository Type**: Go Kubernetes service (LLM inference router with EPP and disaggregation sidecar)
- **Primary Language**: Go 1.25.11
- **Framework**: Kubernetes controller-runtime, Gateway API inference extension

**Key Strengths**:
- Excellent test coverage infrastructure with 1,083 test functions and automated coverage regression detection
- Sophisticated E2E testing with Kind clusters, 6 parallel matrix suites, and image build validation on PRs
- Well-organized CI/CD with 19 workflows, smart path filtering, Go caching, and concurrency control
- Strong agent documentation (AGENTS.md) with clear operating rules, code style, and PR guidelines
- Trivy vulnerability scanning with SARIF upload to GitHub Security tab (on release builds)

**Critical Gaps**:
- No PR-time container vulnerability scanning (Trivy only runs on release builds)
- No CodeQL/SAST integration for static security analysis
- No `.claude/rules/` directory for structured test creation guidance

**Agent Rules Status**: Present (AGENTS.md) — comprehensive operating rules but no structured `.claude/rules/` for test patterns

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | 1,083 test functions across 236 files with race detection |
| Integration/E2E | 9.0/10 | Hermetic envtest + Kind E2E with 6 parallel matrix suites |
| **Build Integration** | **7.5/10** | **PR builds Docker images for E2E; no Konflux simulation** |
| Image Testing | 8.0/10 | Multi-stage distroless builds; Trivy on release; E2E validates images |
| Coverage Tracking | 9.0/10 | Per-component baselines with main + release branch comparison |
| CI/CD Automation | 9.0/10 | 19 workflows, path filtering, caching, matrix strategies |
| Agent Rules | 7.0/10 | Strong AGENTS.md; no .claude/rules/ for test patterns |

## Critical Gaps

### 1. No PR-Time Container Security Scanning
- **Impact**: Vulnerabilities in dependencies or base images are only detected at release time, not during code review
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The `trivy-scan` composite action exists and is well-configured (HIGH+CRITICAL severity, SARIF upload), but it only runs in `ci-build-images.yaml` which is called by `ci-release.yaml` and `ci-dev.yaml` (push to main). PRs build images for E2E but skip Trivy scanning.
- **Fix**: Add a Trivy scan step after the `e2e-image-common` build step in `ci-pr-checks.yaml`

### 2. No CodeQL or SAST Integration
- **Impact**: No static application security testing beyond `govulncheck` (which only checks known Go vulnerabilities)
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: The project runs `govulncheck` in the lint workflow, which is good for known Go CVEs. However, there is no CodeQL, Semgrep, or gosec for broader SAST coverage (injection, auth issues, data flow problems).

### 3. No Structured Agent Test Rules
- **Impact**: AI coding agents lack explicit patterns for writing tests in this codebase
- **Severity**: LOW
- **Effort**: 3-4 hours
- **Details**: AGENTS.md provides excellent general operating rules but doesn't have structured `.claude/rules/` files for unit test patterns, integration test setup, E2E test conventions, or mocking strategies.

## Quick Wins

### 1. Add Trivy Scanning to PR Workflow (2-3 hours)
Add the existing `trivy-scan` action to the PR image build step:
```yaml
- name: Run Trivy scan on EPP image
  uses: ./.github/actions/trivy-scan
  with:
    tarball: ${{ runner.temp }}/llm-d-router-endpoint-picker.tar
```

### 2. Add CodeQL Workflow (1-2 hours)
Create `.github/workflows/codeql.yml`:
```yaml
name: CodeQL Analysis
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'
permissions:
  security-events: write
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: github/codeql-action/init@v4
        with:
          languages: go
      - uses: github/codeql-action/autobuild@v4
      - uses: github/codeql-action/analyze@v4
```

### 3. Generate Agent Test Rules (2-3 hours)
Run `/test-rules-generator` on this repo to create `.claude/rules/` with patterns for:
- Unit tests (Go table-driven tests, mocking patterns)
- Integration tests (envtest setup, hermetic test conventions)
- E2E tests (Kind cluster setup, Ginkgo label filters)

### 4. Add Coverage Threshold (1-2 hours)
The `compare-coverage.sh` script accepts a threshold argument but it defaults to `0`. Set a minimum:
```makefile
COVERAGE_THRESHOLD ?= 65
```

## Detailed Findings

### CI/CD Pipeline

**Workflows (19 total)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci-pr-checks.yaml` | PR + push to main | Unit tests, hermetic integration, coverage comparison, E2E (6 suites) |
| `ci-lint.yaml` | PR + push to main | golangci-lint, go mod tidy, govulncheck |
| `ci-build-images.yaml` | Reusable (called) | Build EPP + sidecar images, Trivy scan, push, Helm charts |
| `ci-dev.yaml` | Push to main | Dev image builds via ci-build-images |
| `ci-release.yaml` | Tag push / release | Release image builds + artifact upload |
| `ci-dependency-review.yaml` | PR | Dependency vulnerability review (fail-on-severity: high) |
| `ci-signed-commits.yaml` | PR | Enforce GPG/SSH signed commits |
| `check-typos.yaml` | PR + push | Typo detection via crate-ci/typos |
| `md-link-check.yml` | PR + push | Markdown link validation |
| `pr-hold-gate.yml` | PR | Hold label gating |
| `pr-kind-label.yaml` | PR | Kind label enforcement |
| `pr-size-labeler.yml` | PR | PR size labeling |
| `prow-github.yml` | PR | Prow integration |
| `non-main-gatekeeper.yml` | Push | Branch protection gating |
| `stale.yaml` / `unstale.yaml` | Schedule | Stale issue/PR management |
| `release-notes-*.yaml` | PR / schedule | Automated release notes |
| `re-run-action.yml` | Manual | Re-run failed checks |

**Strengths**:
- Smart path filtering with `dorny/paths-filter` to skip unnecessary builds
- Concurrency control on all PR workflows (`cancel-in-progress: true`)
- Go module + build cache across all jobs
- Matrix E2E strategy with 6 suites (pd, shared-storage, metrics, extended, disruption)
- Separate image build jobs with artifact upload for E2E consumption
- Timeout limits on all long-running jobs

**Gaps**:
- No scheduled/nightly comprehensive test runs beyond what runs on push to main
- No Konflux build simulation in PR

### Test Coverage

**Test Infrastructure**:
- **236 test files** with **1,083 test functions**
- **Test-to-code ratio**: 236 test files / 381 source files = **0.62** (strong)
- **Frameworks**: Standard Go `testing`, Ginkgo/Gomega for E2E and integration
- **Race detection**: Enabled (`-race` flag) in unit and integration tests
- **Coverage mode**: Atomic (`-covermode=atomic`)

**Test Layers**:
1. **Unit Tests** (`make test-unit`): Per-component coverage (epp + sidecar), 181+ test files in `pkg/epp/`
2. **Hermetic Integration** (`make test-integration-hermetic`): envtest-based, no cluster required
3. **Full Integration** (`make test-integration`): Requires running cluster
4. **E2E Tests** (`make test-e2e`): Kind cluster with real images, 6 parallel suites with Ginkgo label filters
5. **Benchmarks** (`make bench-tokenizer`): Performance profiling for tokenizer/scorer

**Coverage Tracking**:
- Per-component `.out` profiles (epp.out, sidecar.out, integration-hermetic.out)
- Baseline comparison against main branch via `compare-coverage.sh`
- Release branch baseline comparison (downloads from artifacts)
- Coverage regression gate in PR (fails PR if regression detected)
- HTML coverage reports via `make coverage-report`
- Max regression tolerance configurable (default 2.0 percentage points)

### Code Quality

**Linting (golangci-lint v2)**:
- 22 linters enabled (bodyclose, copyloopvar, dupword, errcheck, gocritic, govet, ineffassign, misspell, nakedret, nilnil, perfsprint, prealloc, revive, staticcheck, unparam, unused, and more)
- Import alias enforcement via `importas`
- Detailed `revive` rules (15 rules configured)
- Formatters: goimports + gofmt
- No issue limits (`max-issues-per-linter: 0`, `max-same-issues: 0`)

**Additional Quality Tools**:
- `typos` (crate-ci) — spell checking in both CI and builder container
- `govulncheck` — Go vulnerability checker
- `go mod tidy -diff` — Module tidiness check
- Custom pre-commit git hook (runs `make lint` + `make test`)
- Dependency review action (fail on HIGH severity)
- Dependabot for Go, GitHub Actions, and Docker dependencies (patch-only for Go/Docker)

**Gaps**:
- No `.pre-commit-config.yaml` (has a custom git hook but not the standard pre-commit framework)
- No Gitleaks/TruffleHog for secret detection

### Container Images

**Dockerfiles**:
- `Dockerfile.epp` — Multi-stage build, distroless base (`gcr.io/distroless/static:nonroot`), non-root user (65532)
- `Dockerfile.sidecar` — Same pattern, distroless base, non-root user
- `Dockerfile.builder` — Full toolchain (Go, golangci-lint, kubectl, kustomize, Kind, typos, envtest, govulncheck)

**Best Practices**:
- Multi-stage builds with dependency caching layer
- Distroless base images for minimal CVE surface
- Non-root user execution
- Platform-aware builds (`BUILDPLATFORM`, `TARGETOS`, `TARGETARCH`)
- Build argument for base image override (e.g., UBI for RHOAI builds)
- Pre-compilation cache optimization (build without version flags first)
- `.dockerignore` configured

**Security Scanning**:
- Trivy scan with `HIGH,CRITICAL` severity gate on release builds
- SARIF upload to GitHub Security tab
- No PR-time scanning (gap)
- No SBOM generation
- No image signing/attestation

### Security Practices

| Practice | Status | Details |
|----------|--------|---------|
| Trivy container scanning | Partial | Release builds only, not PRs |
| govulncheck | Active | Runs in CI lint workflow |
| Dependency review | Active | `actions/dependency-review-action` with fail-on-severity: high |
| Dependabot | Active | Go, Actions, Docker dependencies monitored weekly |
| Signed commits | Enforced | `1Password/check-signed-commits-action` on all PRs |
| CodeQL/SAST | Missing | No static application security testing |
| Secret detection | Missing | No Gitleaks/TruffleHog |
| SBOM generation | Missing | No Syft/cosign integration |
| Image signing | Missing | No cosign/Sigstore attestation |

### Agent Rules (Agentic Flow Quality)

**Status**: Present — AGENTS.md (same content as CLAUDE.md)

**Coverage**:
- Operating rules (allowed / ask first / never)
- Working in the codebase (interpretation, success criteria, analogous patterns)
- Pull request guidelines (minimalism, issue tracking, presubmit)
- Code style (standard Go, terse comments, no temporal framing)
- Logging conventions (go-logr levels with named constants)
- Git workflow (DCO sign-off, commit message format, no hook bypass)

**Quality Assessment**:
- **Comprehensive**: Covers agent permissions, coding standards, PR process, and git workflow
- **Actionable**: Clear rules with examples (logging patterns, commit format)
- **Well-structured**: Organized sections with allowed/forbidden boundaries
- **Opinionated**: Strong stance on minimalism, no speculative changes

**Gaps**:
- No `.claude/rules/` directory with structured test pattern rules
- No test creation rules for unit, integration, or E2E tests
- No mocking strategy documentation for agents
- Gemini configuration exists (`.gemini/settings.json`) but no equivalent Claude rules directory

**Recommendation**: Run `/test-rules-generator` to create `.claude/rules/` with:
- `unit-tests.md` — Go table-driven test patterns, race detection requirements
- `integration-tests.md` — envtest setup, hermetic test conventions
- `e2e-tests.md` — Kind cluster E2E with Ginkgo label filters
- `mocking.md` — Mock patterns used in the codebase

## Recommendations

### Priority 0 (Critical)

1. **Add PR-time Trivy scanning** — The composite action already exists; wire it into `ci-pr-checks.yaml` after image builds to shift-left vulnerability detection
2. **Add CodeQL or SAST workflow** — Go SAST catches security issues that govulncheck doesn't (data flow, injection, auth patterns)

### Priority 1 (High Value)

1. **Generate `.claude/rules/` test creation rules** — Use `/test-rules-generator` to create structured guidance for AI agents writing tests
2. **Set explicit coverage threshold** — Change `COVERAGE_THRESHOLD` from 0 to a meaningful minimum (65-70%)
3. **Add SBOM generation to release pipeline** — Use Syft or cosign to generate SBOMs for container images

### Priority 2 (Nice-to-Have)

1. **Adopt `.pre-commit-config.yaml`** — Standardize local hooks across all contributors (currently using custom git hook)
2. **Add performance regression benchmarks to PR CI** — The tokenizer benchmark exists but only runs manually
3. **Add secret detection** — Gitleaks or TruffleHog in CI to prevent credential leaks
4. **Add image signing** — cosign/Sigstore for release image attestation

## Comparison to Gold Standards

| Dimension | llm-d-inference-scheduler | odh-dashboard | notebooks | kserve |
|-----------|--------------------------|---------------|-----------|--------|
| Unit Tests | 8.5 — 1,083 functions, race detection | 9.0 — Multi-layer, contract tests | 7.0 — Notebook-focused | 9.0 — Extensive operator tests |
| Integration/E2E | 9.0 — Hermetic envtest + Kind E2E | 9.0 — Cypress + contract | 8.0 — Image validation | 9.0 — Multi-version testing |
| Build Integration | 7.5 — PR image builds for E2E | 8.0 — PR build validation | 9.0 — 5-layer validation | 7.0 — Standard builds |
| Image Testing | 8.0 — Distroless, Trivy on release | 7.0 — Basic builds | 9.5 — Gold standard | 7.0 — Basic builds |
| Coverage Tracking | 9.0 — Baseline comparison + gate | 9.0 — Codecov enforcement | 6.0 — Limited | 9.0 — Codecov enforcement |
| CI/CD Automation | 9.0 — 19 workflows, smart filtering | 9.0 — Comprehensive | 8.0 — Good coverage | 8.5 — Well-organized |
| Agent Rules | 7.0 — Strong AGENTS.md, no rules/ | 8.5 — Full .claude/rules/ | 5.0 — Minimal | 3.0 — No agent rules |

## File Paths Reference

### CI/CD
- `.github/workflows/ci-pr-checks.yaml` — Main PR test workflow
- `.github/workflows/ci-lint.yaml` — Linting + govulncheck
- `.github/workflows/ci-build-images.yaml` — Image build + Trivy (reusable)
- `.github/workflows/ci-dev.yaml` — Dev image builds on push to main
- `.github/workflows/ci-release.yaml` — Release image builds + artifacts
- `.github/workflows/ci-dependency-review.yaml` — Dependency review
- `.github/workflows/ci-signed-commits.yaml` — Signed commit enforcement
- `.github/actions/trivy-scan/action.yml` — Trivy composite action
- `.github/actions/docker-build-and-push/action.yml` — Docker build composite action
- `.github/actions/e2e-runner-setup/action.yml` — E2E runner setup
- `.github/dependabot.yml` — Dependency update configuration

### Testing
- `pkg/epp/**/*_test.go` — 181 EPP unit test files
- `pkg/sidecar/**/*_test.go` — 17 sidecar unit test files
- `pkg/common/**/*_test.go` — 10 common package test files
- `test/integration/` — Hermetic + full integration tests (14 files)
- `test/e2e/` — End-to-end test suite (7 files, Kind-based)
- `test/sidecar/e2e/` — Sidecar E2E tests
- `test/profiling/tokenizerbench/` — Performance benchmarks
- `scripts/compare-coverage.sh` — Coverage comparison script

### Code Quality
- `.golangci.yml` — 22 linters, import aliases, revive rules
- `.typos.toml` — Spell checking configuration
- `hooks/pre-commit` — Git pre-commit hook (lint + test)

### Container Images
- `Dockerfile.epp` — EPP multi-stage distroless build
- `Dockerfile.sidecar` — Sidecar multi-stage distroless build
- `Dockerfile.builder` — Full builder toolchain image
- `.dockerignore` — Docker build exclusions

### Agent Rules
- `AGENTS.md` — Agent operating rules and code style
- `CLAUDE.md` — Claude-specific instructions (same content as AGENTS.md)
- `.gemini/settings.json` — Gemini configuration
