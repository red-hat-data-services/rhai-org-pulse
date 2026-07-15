---
repository: "opendatahub-io/llm-d-inference-scheduler"
overall_score: 8.4
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "238 test files, 1.27:1 test-to-code ratio with Ginkgo/Gomega + testify"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Multi-suite E2E (GAIE + Router) with Kind clusters, hermetic integration via envtest"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR builds Docker images and runs E2E; Konflux pipelines present but no PR-time Konflux simulation"
  - dimension: "Image Testing"
    score: 8.0
    status: "Multi-stage builds, Trivy scanning gates push, distroless base images, multi-arch support"
  - dimension: "Coverage Tracking"
    score: 9.5
    status: "Custom coverage comparison with regression gating, baseline caching, release branch tracking"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "19 workflows with concurrency control, path-filtering, caching, and automated release notes"
  - dimension: "Agent Rules"
    score: 8.0
    status: "Comprehensive AGENTS.md with coding standards, PR guidelines, and testing requirements"
critical_gaps:
  - title: "No PR-time Konflux build simulation"
    impact: "Konflux build failures (UBI base image, CGO_ENABLED=1) discovered only post-merge"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "No pre-commit hooks"
    impact: "Developers may push code that fails lint/format checks, wasting CI cycles"
    severity: "LOW"
    effort: "1-2 hours"
  - title: "No SAST/CodeQL integration"
    impact: "Static security analysis only via govulncheck; no code-level vulnerability scanning"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No codecov/coveralls PR reporting"
    impact: "Coverage data exists but lacks PR-level visualization and threshold enforcement via third-party tools"
    severity: "LOW"
    effort: "2-3 hours"
quick_wins:
  - title: "Add CodeQL analysis workflow"
    effort: "2-3 hours"
    impact: "Automated static security analysis on every PR and push"
  - title: "Add pre-commit hooks (.pre-commit-config.yaml)"
    effort: "1-2 hours"
    impact: "Catch formatting, linting, and typo issues before CI runs"
  - title: "Add .claude/rules/ for test creation patterns"
    effort: "2-3 hours"
    impact: "Standardize AI-generated test quality with Ginkgo/Gomega patterns"
  - title: "Add Konflux Dockerfile build validation to PR workflow"
    effort: "4-6 hours"
    impact: "Catch Konflux-specific build failures before merge"
recommendations:
  priority_0:
    - "Add CodeQL or gosec SAST scanning to PR workflow for code-level vulnerability detection"
    - "Add PR-time Konflux Dockerfile validation (build Dockerfile.konflux.* in CI)"
  priority_1:
    - "Add .claude/rules/ directory with Ginkgo/Gomega test creation patterns"
    - "Add pre-commit hooks for format, lint, and typo checks"
    - "Integrate codecov for PR-level coverage visualization and threshold enforcement"
  priority_2:
    - "Add secret detection (gitleaks) to PR workflow"
    - "Add SBOM generation for container images"
    - "Add performance regression testing benchmarks to CI"
---

# Quality Analysis: llm-d-inference-scheduler

## Executive Summary
- **Overall Score: 8.4/10**
- **Repository Type**: Go-based LLM inference routing service (Endpoint Picker + Disaggregated Inference Sidecar)
- **Primary Language**: Go 1.25
- **Frameworks**: Ginkgo/Gomega, testify, envtest, Kind
- **Key Strengths**: Exceptional test-to-code ratio (1.27:1), sophisticated multi-suite E2E testing, custom coverage regression gating, comprehensive agent rules
- **Critical Gaps**: No SAST/CodeQL, no Konflux PR simulation, no pre-commit hooks
- **Agent Rules Status**: Present (AGENTS.md) — comprehensive coding standards and PR guidelines, but no `.claude/rules/` for test patterns

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 9.0/10 | 238 test files, 1.27:1 test-to-code ratio, Ginkgo/Gomega + testify |
| Integration/E2E | 9.0/10 | Multi-suite E2E (GAIE + Router), hermetic integration via envtest |
| **Build Integration** | **7.0/10** | **PR builds images for E2E; Konflux pipelines exist but no PR-time simulation** |
| Image Testing | 8.0/10 | Trivy scanning gates image push, distroless bases, multi-arch |
| Coverage Tracking | 9.5/10 | Custom coverage comparison, regression gating, release branch baselines |
| CI/CD Automation | 9.0/10 | 19 workflows, concurrency control, path-filtering, Go caching |
| Agent Rules | 8.0/10 | AGENTS.md with coding standards; missing `.claude/rules/` for test patterns |

## Critical Gaps

### 1. No SAST/CodeQL Integration
- **Impact**: Code-level vulnerabilities not detected beyond `govulncheck` (which only checks known CVEs in dependencies)
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: The repository runs `govulncheck` in the lint workflow, which checks for known vulnerabilities in Go dependencies. However, there is no CodeQL, gosec, or Semgrep integration for detecting code-level security issues (injection, race conditions, unsafe operations).

### 2. No PR-time Konflux Build Simulation
- **Impact**: Konflux-specific Dockerfiles (`Dockerfile.konflux.epp`, `Dockerfile.konflux.sidecar`) use UBI9 base images and `CGO_ENABLED=1`, which differ from the distroless-based standard Dockerfiles. Build failures in these files are only discovered post-merge when Tekton pipelines run.
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Details**: Six Tekton PipelineRun configs exist in `.tekton/` for PR, push, and tag events. The Konflux Dockerfiles use `registry.access.redhat.com/ubi9/go-toolset` and `ubi9/ubi-minimal` — different build chain from the CI-tested `Dockerfile.epp` (which uses `golang:1.25.11` and `distroless/static`).

### 3. No Pre-commit Hooks
- **Impact**: Developers may push code that fails formatting, linting, or typo checks
- **Severity**: LOW
- **Effort**: 1-2 hours
- **Details**: No `.pre-commit-config.yaml` exists. While `make presubmit` covers format/lint/vulncheck, there's no local hook to catch issues before push.

### 4. No Codecov/Coveralls PR Reporting
- **Impact**: Coverage data is generated but not visualized on PRs via third-party tools
- **Severity**: LOW
- **Effort**: 2-3 hours
- **Details**: The repository has a sophisticated custom coverage comparison system (`scripts/compare-coverage.sh`) that writes markdown summaries to GitHub Step Summary. However, there's no codecov.yml or coveralls integration for inline PR annotations and coverage badges.

## Quick Wins

### 1. Add CodeQL Analysis Workflow
- **Effort**: 2-3 hours
- **Impact**: Automated static security analysis catching code-level vulnerabilities
- **Implementation**:
```yaml
# .github/workflows/codeql.yml
name: CodeQL
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v7
      - uses: github/codeql-action/init@v4
        with:
          languages: go
      - uses: github/codeql-action/autobuild@v4
      - uses: github/codeql-action/analyze@v4
```

### 2. Add Pre-commit Hooks
- **Effort**: 1-2 hours
- **Impact**: Catch formatting, linting, and typo issues before CI runs
- **Implementation**:
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/golangci/golangci-lint
    rev: v2.8.0
    hooks:
      - id: golangci-lint
  - repo: https://github.com/crate-ci/typos
    rev: v1.47.2
    hooks:
      - id: typos
```

### 3. Add `.claude/rules/` for Test Creation Patterns
- **Effort**: 2-3 hours
- **Impact**: Standardize AI-generated tests with project-specific Ginkgo/Gomega patterns
- **Details**: The AGENTS.md covers general coding standards but lacks specific test creation rules. Use `/test-rules-generator` to generate rules matching existing patterns.

### 4. Add Konflux Dockerfile Validation to PR Workflow
- **Effort**: 4-6 hours
- **Impact**: Catch Konflux-specific build failures before merge
- **Implementation**: Add a step to `ci-pr-checks.yaml` that builds `Dockerfile.konflux.epp` and `Dockerfile.konflux.sidecar` (without push) to verify they compile successfully.

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (19 workflows)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci-pr-checks.yaml` | PR, push(main) | Unit tests, hermetic integration, coverage, E2E |
| `ci-lint.yaml` | PR, push(main) | Go build, golangci-lint, govulncheck |
| `ci-build-images.yaml` | workflow_call | Build + Trivy scan + push images |
| `ci-dev.yaml` | push(main) | Dev image build |
| `ci-release.yaml` | tag push | Release image build |
| `ci-dependency-review.yaml` | PR | Dependency vulnerability review |
| `ci-signed-commits.yaml` | PR | DCO sign-off enforcement |
| `check-typos.yaml` | PR, push | Typo checking with crate-ci/typos |
| `md-link-check.yml` | PR, push | Markdown link validation with lychee |
| `pr-hold-gate.yml` | PR | Block merge when hold label present |
| `pr-kind-label.yaml` | PR | Auto-apply kind labels from PR body |
| `pr-size-labeler.yml` | PR | Auto-label PR size |
| `prow-github.yml` | issue_comment | Prow-style /assign, /kind, /priority commands |
| `non-main-gatekeeper.yml` | PR | Auto-hold non-main PRs |
| `release-notes-assemble.yaml` | tag | Assemble release notes |
| `release-notes-update.yaml` | PR merge | Update release notes fragments |
| `re-run-action.yml` | issue_comment | Re-run PR tests via comment |
| `stale.yaml` | cron | Mark stale issues/PRs |
| `unstale.yaml` | issue/PR activity | Remove stale labels |

**Strengths**:
- Excellent concurrency control on all PR workflows (`cancel-in-progress: true`)
- Smart path-filtering (via `dorny/paths-filter`) to skip unnecessary runs
- Go module and build cache via `actions/cache` for faster builds
- Comprehensive release automation with automated release notes
- Prow-compatible label commands for community workflow

**Areas for Improvement**:
- No CodeQL/SAST workflow
- No secret detection (gitleaks)

### Test Coverage

**Test File Distribution**:
- **Total test files**: 238
- **Package-level unit tests**: 206 (in `pkg/`)
- **E2E test files**: 13 (in `test/e2e/` and `test/e2e/epp/`)
- **Integration test files**: 14 (in `test/integration/` and `test/integration/epp/`)
- **Sidecar E2E**: 2 (in `test/sidecar/e2e/`)
- **Profiling/Benchmark**: 1 (in `test/profiling/tokenizerbench/`)

**Test-to-Code Ratio**: 75,366 test LOC / 59,489 source LOC = **1.27:1** (excellent)

**Test Frameworks**:
- **Ginkgo/Gomega v2**: Primary BDD framework for E2E and integration tests
- **testify**: Assertion library for unit tests
- **envtest**: Controller-runtime's envtest for hermetic integration tests (no real cluster needed)
- **Kind**: Creates ephemeral Kubernetes clusters for E2E tests

**Mocking Strategy**:
- Custom mocks in `pkg/epp/datalayer/mocks/`, `pkg/epp/flowcontrol/contracts/mocks/`
- Generated client-go fakes in `client-go/clientset/versioned/fake/`
- Data source mocks for metrics extraction testing
- Mock server for sidecar E2E tests (`test/sidecar/mock/`)

**E2E Test Suites** (run in matrix on PR):
1. **GAIE E2E** (2 parallelized suites):
   - Traffic suite (core routing scenarios)
   - Metrics suite (GAIEMetrics label)
2. **Router E2E** (6 parallelized suites):
   - P-D routing (prefill-decode)
   - P-D shared storage (deprecated + disagg)
   - P-D metrics
   - Extended (with vLLM render image)
   - Disruption testing

### Code Quality

**Linting** (`.golangci.yml` v2):
- **23 linters enabled**: importas, bodyclose, copyloopvar, dupword, errcheck, fatcontext, ginkgolinter, goconst, gocritic, govet, ineffassign, loggercheck, makezero, misspell, nakedret, nilnil, perfsprint, prealloc, revive, staticcheck, unparam, unused, unconvert
- **Formatters**: goimports, gofmt
- **Revive rules**: 16 rules configured (blank-imports, context-as-argument, error-return, etc.)
- **Custom import aliases**: Enforced for key internal packages

**Vulnerability Scanning**:
- `govulncheck` runs in lint workflow on every PR
- Dependency review action (`actions/dependency-review-action@v5`) fails on HIGH severity

**Typo Checking**: `crate-ci/typos` with custom configuration (`.typos.toml`)

**Markdown Link Checking**: `lychee` with custom configuration (`.lychee.toml`)

**Pre-commit Hooks**: ❌ Not present

### Container Images

**Dockerfiles** (5 total):
1. `Dockerfile.epp` — EPP binary (distroless/static base, CGO_ENABLED=0)
2. `Dockerfile.sidecar` — Disagg sidecar binary
3. `Dockerfile.konflux.epp` — Konflux/RHOAI EPP (UBI9 base, CGO_ENABLED=1)
4. `Dockerfile.konflux.sidecar` — Konflux/RHOAI sidecar
5. `Dockerfile.builder` — Builder image with all dev tools

**Build Quality**:
- Multi-stage builds with proper layer caching
- Distroless base images for minimal attack surface (standard builds)
- UBI9 base images for Konflux/RHOAI compliance
- Multi-architecture support (AMD64 + ARM64) via buildx
- Non-root user (65532:65532)
- Version metadata injection via LDFLAGS
- Build pre-compilation layer for cache optimization

**Security Scanning**:
- ✅ Trivy scanning (`aquasecurity/trivy-action@v0.36.0`) gates image push
- ✅ SARIF upload to GitHub Security tab
- ✅ HIGH/CRITICAL severity threshold (configurable)
- ❌ No SBOM generation
- ❌ No image signing/attestation

**Tekton/Konflux Pipelines** (6 PipelineRuns in `.tekton/`):
- PR, push, and tag pipelines for both EPP and sidecar components
- References central pipeline from `opendatahub-io/odh-konflux-central`
- Multi-arch container builds

### Security

| Practice | Status | Details |
|----------|--------|---------|
| Trivy scanning | ✅ | Gates image push, SARIF upload |
| Dependency review | ✅ | Fails on HIGH severity |
| govulncheck | ✅ | Runs on every PR |
| Signed commits | ✅ | DCO enforcement via 1Password action |
| CodeQL/SAST | ❌ | Not configured |
| Secret detection | ❌ | No gitleaks/TruffleHog |
| SBOM generation | ❌ | Not configured |
| Image signing | ❌ | Not configured |

### Agent Rules (Agentic Flow Quality)

- **Status**: Present — `AGENTS.md` (symlinked as `CLAUDE.md`) + `.gemini/settings.json`
- **Coverage**: Comprehensive coding standards, PR guidelines, Git workflow, logging conventions
- **Quality**: Excellent — specific, actionable rules with examples (logging levels, import aliases, testing requirements)
- **Strengths**:
  - Clear "Allowed / Ask first / Never" permission model for agent actions
  - Explicit requirement to run `make presubmit` before claiming completion
  - Code style guidelines with concrete examples
  - PR minimalism and scope guidelines
  - Plugin model documentation references
- **Gaps**:
  - No `.claude/rules/` directory for test-type-specific creation patterns
  - No Ginkgo/Gomega test templates or examples for agents
  - `.gemini/` directory exists but only contains settings.json
- **Recommendation**: Generate missing rules with `/test-rules-generator` to add Ginkgo/Gomega and envtest patterns

### Coverage Tracking

**Outstanding Implementation**:
- Custom `scripts/compare-coverage.sh` compares PR coverage against main branch baseline
- Coverage profiles generated per component: `epp.out`, `sidecar.out`, `integration-hermetic.out`
- Regression gating with configurable threshold (default 2.0 percentage points max regression)
- Coverage baselines cached and compared for main branch AND release branches
- Markdown summary written to GitHub Step Summary
- Release branch coverage artifacts retained for 400 days

**Coverage Workflow**:
1. Restore main branch coverage baseline from cache
2. Run unit tests with `-coverprofile`
3. Run hermetic integration tests with `-coverprofile`
4. Compare coverage against main baseline
5. Find and compare against latest release branch baseline
6. Gate PR merge on coverage regression

## Recommendations

### Priority 0 (Critical)

1. **Add CodeQL or gosec SAST scanning** — `govulncheck` only covers known dependency CVEs. Code-level security issues (race conditions, injection patterns, unsafe operations) need static analysis. Add a CodeQL workflow triggered on PR and push to main.

2. **Add PR-time Konflux Dockerfile validation** — Build `Dockerfile.konflux.epp` and `Dockerfile.konflux.sidecar` in the PR workflow (without push) to catch UBI9-specific build failures before merge. The different base images and CGO settings between standard and Konflux Dockerfiles are a known source of post-merge failures.

### Priority 1 (High Value)

3. **Add `.claude/rules/` test creation patterns** — Create rules for unit tests (testify patterns), integration tests (envtest setup), E2E tests (Ginkgo/Gomega with Kind), and sidecar tests. Use `/test-rules-generator` to bootstrap from existing test patterns.

4. **Add pre-commit hooks** — Configure `.pre-commit-config.yaml` with golangci-lint, typos, and goimports to catch issues before CI. The `make presubmit` target exists but requires manual invocation.

5. **Integrate codecov for PR visualization** — The custom coverage comparison script is excellent for regression gating, but codecov provides inline PR annotations, file-level coverage overlays, and trend tracking that complement the existing system.

### Priority 2 (Nice-to-Have)

6. **Add secret detection (gitleaks)** — Prevent accidental secret commits with a gitleaks scan in the PR workflow.

7. **Add SBOM generation** — Generate Software Bill of Materials for container images during the build process using Syft or Trivy.

8. **Add performance regression benchmarks to CI** — The `test/profiling/tokenizerbench/` benchmark exists but isn't run in CI. Add periodic benchmark runs with result comparison.

## Comparison to Gold Standards

| Dimension | llm-d-inference-scheduler | odh-dashboard | notebooks | kserve |
|-----------|--------------------------|---------------|-----------|--------|
| Unit Tests | ★★★★★ (238 files, 1.27:1) | ★★★★★ (Jest + React Testing Library) | ★★★☆☆ | ★★★★☆ |
| Integration/E2E | ★★★★★ (8 matrix suites) | ★★★★★ (Cypress + contract) | ★★★☆☆ | ★★★★★ |
| Build Integration | ★★★★☆ (PR images, no Konflux sim) | ★★★★★ (module federation validation) | ★★★★☆ | ★★★★☆ |
| Image Testing | ★★★★☆ (Trivy, multi-arch) | ★★★☆☆ | ★★★★★ (5-layer validation) | ★★★★☆ |
| Coverage | ★★★★★ (custom regression gating) | ★★★★★ (codecov + enforcement) | ★★★☆☆ | ★★★★★ (enforcement) |
| CI/CD | ★★★★★ (19 workflows, path-filter) | ★★★★★ | ★★★★☆ | ★★★★★ |
| Agent Rules | ★★★★☆ (AGENTS.md, no rules/) | ★★★★★ (full .claude/rules/) | ★★☆☆☆ | ★★☆☆☆ |
| Security | ★★★★☆ (Trivy, govulncheck, dep review) | ★★★★☆ | ★★★★☆ | ★★★★★ (CodeQL + Trivy) |

## File Paths Reference

### CI/CD
- `.github/workflows/ci-pr-checks.yaml` — Main test workflow (unit, integration, E2E)
- `.github/workflows/ci-lint.yaml` — Lint, build, govulncheck
- `.github/workflows/ci-build-images.yaml` — Image build + Trivy scan
- `.github/workflows/ci-dependency-review.yaml` — Dependency vulnerability check
- `.github/actions/trivy-scan/action.yml` — Reusable Trivy scan action
- `.tekton/` — Konflux Tekton pipeline configurations

### Testing
- `test/e2e/` — GAIE E2E test suite
- `test/e2e/epp/` — EPP-specific E2E tests
- `test/integration/` — Integration test suite
- `test/integration/epp/` — EPP hermetic integration tests (envtest)
- `test/sidecar/e2e/` — Sidecar E2E tests
- `test/profiling/tokenizerbench/` — Tokenizer benchmarks
- `test/scripts/` — E2E test runner scripts
- `test/utils/` — Shared test utilities

### Code Quality
- `.golangci.yml` — 23 linters + 16 revive rules
- `.typos.toml` — Typo checker config
- `.lychee.toml` — Markdown link checker config
- `Makefile` + `Makefile.*.mk` — Build, test, and CI targets

### Container Images
- `Dockerfile.epp` — Standard EPP image (distroless)
- `Dockerfile.sidecar` — Standard sidecar image
- `Dockerfile.konflux.epp` — Konflux/RHOAI EPP image (UBI9)
- `Dockerfile.konflux.sidecar` — Konflux/RHOAI sidecar image
- `Dockerfile.builder` — Builder image with dev tools

### Agent Rules
- `AGENTS.md` — Comprehensive agent operating rules
- `CLAUDE.md` — Symlink to AGENTS.md
- `.gemini/settings.json` — Gemini agent configuration

### Coverage
- `scripts/compare-coverage.sh` — Coverage comparison and regression gating
