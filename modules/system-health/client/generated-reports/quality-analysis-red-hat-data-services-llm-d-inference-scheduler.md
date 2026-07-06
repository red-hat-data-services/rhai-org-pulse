---
repository: "red-hat-data-services/llm-d-inference-scheduler"
overall_score: 8.8
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "237 test files, 74K lines of test code (1.24x test-to-code ratio), race detection, Ginkgo/Gomega + testify"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Hermetic integration (envtest), 8-matrix E2E suites in Kind, disruption testing, multi-image orchestration"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR builds images and runs E2E in Kind; Konflux Tekton pipelines exist but no PR-time Konflux simulation"
  - dimension: "Image Testing"
    score: 8.0
    status: "Trivy HIGH/CRITICAL gate, multi-arch (AMD64+ARM64), distroless nonroot base, SARIF upload"
  - dimension: "Coverage Tracking"
    score: 9.0
    status: "Custom regression gate (2% tolerance), baseline per branch, GitHub Step Summary integration"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "21 workflows, path filtering, concurrency control, Go caching, signed commits, Dependabot+Renovate"
  - dimension: "Agent Rules"
    score: 7.0
    status: "Comprehensive AGENTS.md with operating rules, code style, and logging conventions; missing .claude/rules/ for test patterns"
critical_gaps:
  - title: "No PR-time Konflux build simulation"
    impact: "Konflux-specific build issues (UBI base, CGO_ENABLED=1, pinned digests) only discovered post-merge in Tekton pipelines"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "No SBOM generation or image signing"
    impact: "Supply chain compliance gap; no attestation for image provenance"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No explicit coverage threshold"
    impact: "Regression gate catches drops but doesn't enforce a minimum floor (e.g., 60%+)"
    severity: "LOW"
    effort: "1-2 hours"
quick_wins:
  - title: "Add minimum coverage threshold to compare-coverage.sh"
    effort: "1 hour"
    impact: "Prevent slow coverage erosion by enforcing a baseline floor"
  - title: "Add Cosign image signing to release workflow"
    effort: "2-3 hours"
    impact: "Supply chain attestation for all released images"
  - title: "Create .claude/rules/ with test pattern docs"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality and consistency with existing patterns"
  - title: "Add secret detection (gitleaks) to CI"
    effort: "1-2 hours"
    impact: "Catch accidental secret commits before merge"
recommendations:
  priority_0:
    - "Add PR-time validation of Konflux Dockerfiles (build Dockerfile.epp.konflux and Dockerfile.sidecar.konflux on PRs)"
    - "Add Cosign image signing and SBOM generation to the release pipeline"
  priority_1:
    - "Set a minimum coverage threshold (e.g., 60%) in addition to the regression gate"
    - "Create .claude/rules/ directory with test creation patterns (unit, integration, e2e, benchmark)"
    - "Add gitleaks or TruffleHog for secret detection in PRs"
  priority_2:
    - "Add CodeQL or Semgrep SAST scanning for deeper code security analysis"
    - "Implement contract testing for the plugin framework interfaces"
    - "Add load/stress testing for the scheduling and routing hot paths"
---

# Quality Analysis: llm-d-inference-scheduler

## Executive Summary

- **Overall Score: 8.8/10** - This is an exceptionally well-engineered repository
- **Repository Type**: Go service - Kubernetes-native LLM inference request router (Endpoint Picker + disaggregated inference sidecar)
- **Language**: Go 1.25 with controller-runtime, gRPC, envoy ext_proc
- **Key Strengths**: Outstanding test infrastructure (1.24x test-to-code ratio), comprehensive multi-suite E2E with Kind, custom coverage regression gate, strong CI/CD with 21 workflows
- **Critical Gaps**: No PR-time Konflux build simulation, no SBOM/image signing, no secret detection
- **Agent Rules Status**: Present (AGENTS.md) - comprehensive operating rules but missing `.claude/rules/` for test patterns

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 9.0/10 | 237 test files, 74K LOC tests vs 59K LOC source, race detection, coverage profiling |
| Integration/E2E | 9.0/10 | Hermetic envtest integration + 8-matrix E2E suites in Kind clusters |
| **Build Integration** | **7.0/10** | **PR builds + E2E in Kind; Konflux pipelines exist but not simulated on PRs** |
| Image Testing | 8.0/10 | Trivy HIGH/CRITICAL gate, multi-arch, distroless nonroot base |
| Coverage Tracking | 9.0/10 | Custom regression gate with 2% tolerance, per-branch baselines |
| CI/CD Automation | 9.0/10 | 21 workflows, path filtering, concurrency, Go caching, signed commits |
| Agent Rules | 7.0/10 | Comprehensive AGENTS.md; missing test-specific rules in .claude/rules/ |

## Critical Gaps

### 1. No PR-time Konflux Build Simulation
- **Impact**: Konflux-specific Dockerfiles (`Dockerfile.epp.konflux`, `Dockerfile.sidecar.konflux`) use UBI9 base images, pinned digests, and `CGO_ENABLED=1` — differences from the standard Dockerfiles that can cause build failures only discovered post-merge in the Tekton pipeline
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Evidence**: `.tekton/odh-llm-d-router-endpoint-picker-pull-request.yaml` triggers on PR but runs in a separate Konflux tenant namespace. The CI PR workflow (`ci-pr-checks.yaml`) builds `Dockerfile.epp` and `Dockerfile.sidecar` but not the `.konflux` variants
- **Recommendation**: Add a CI job that builds `Dockerfile.epp.konflux` and `Dockerfile.sidecar.konflux` on PRs that modify Go source, Dockerfiles, or dependencies

### 2. No SBOM Generation or Image Signing
- **Impact**: Supply chain compliance gap — no attestation for image provenance, no machine-readable dependency manifest for released images
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Evidence**: `ci-build-images.yaml` runs Trivy scan and pushes images but does not generate SBOMs or sign images. Konflux handles this downstream but the upstream community release pipeline does not
- **Recommendation**: Add Cosign signing and Syft/Trivy SBOM generation to the release workflow

### 3. No Explicit Coverage Floor
- **Impact**: The regression gate catches drops relative to main but does not enforce a minimum threshold. Coverage could theoretically erode slowly if each PR drops slightly less than 2%
- **Severity**: LOW
- **Effort**: 1-2 hours
- **Evidence**: `compare-coverage.sh` supports a `THRESHOLD` parameter (default 0) and `MAX_REGRESSION` (default 2.0). The Makefile invocation does not set a minimum threshold
- **Recommendation**: Set `COVERAGE_THRESHOLD=60` (or appropriate value) in the CI workflow

## Quick Wins

### 1. Add Minimum Coverage Threshold
- **Effort**: 1 hour
- **Impact**: Prevent slow coverage erosion
- **Implementation**: In `ci-pr-checks.yaml`, change the coverage-compare step:
  ```yaml
  run: make coverage-compare BASELINE_DIR=coverage/baseline COVERAGE_THRESHOLD=60
  ```

### 2. Add Cosign Image Signing
- **Effort**: 2-3 hours
- **Impact**: Supply chain attestation for released images
- **Implementation**: Add to `ci-build-images.yaml` after push steps:
  ```yaml
  - name: Sign image with Cosign
    uses: sigstore/cosign-installer@v3
  - run: cosign sign --yes ghcr.io/llm-d/${{ inputs.epp-image-name }}:${{ inputs.tag }}
  ```

### 3. Create .claude/rules/ for Test Patterns
- **Effort**: 2-3 hours
- **Impact**: AI-generated tests will match existing patterns (Ginkgo, testify, envtest)
- **Implementation**: Use `/test-rules-generator` to generate rules from the existing 237 test files

### 4. Add Secret Detection
- **Effort**: 1-2 hours
- **Impact**: Catch accidental credential commits
- **Implementation**: Add gitleaks to `ci-lint.yaml`:
  ```yaml
  - name: Run gitleaks
    uses: gitleaks/gitleaks-action@v2
  ```

## Detailed Findings

### CI/CD Pipeline

**Workflows (21 total)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci-pr-checks.yaml` | PR + push to main | Unit tests, hermetic integration, coverage gate, E2E (8 suites) |
| `ci-lint.yaml` | PR + push | Build, lint (golangci-lint), govulncheck |
| `ci-build-images.yaml` | Reusable | Build + Trivy scan + push EPP/sidecar images |
| `ci-dev.yaml` | Push to main/release | Build and push dev images |
| `ci-release.yaml` | Tag push / release | Build and push release images |
| `ci-dependency-review.yaml` | PR | Dependency review (fail on HIGH) |
| `ci-signed-commits.yaml` | PR | Signed commit enforcement |
| `check-typos.yaml` | PR | Typo detection |
| `md-link-check.yml` | PR | Markdown link validation |
| `pr-kind-label.yaml` | PR | Auto-label PRs by type |
| `pr-size-labeler.yml` | PR | Label PR by size |
| `pr-hold-gate.yml` | PR | Gate merges on hold labels |
| `prow-github.yml` | PR | Prow-style GitHub automation |
| `non-main-gatekeeper.yml` | PR | Branch protection |
| `re-run-action.yml` | Comment | Re-run failed checks |
| `stale.yaml` / `unstale.yaml` | Scheduled | Stale issue management |
| `release-notes-*.yaml` | PR / dispatch | Release notes automation |

**Strengths**:
- Concurrency control on all workflows (`cancel-in-progress: true`)
- Path filtering with `dorny/paths-filter` to skip unnecessary runs
- Go module + build caching (custom cache dirs + `actions/cache@v5`)
- Matrix strategies for E2E (8 parallel suites)
- Builder container pattern (`Dockerfile.builder`) ensures reproducible environments
- Pre-commit hook runs lint + test locally

**E2E Test Matrix** (8 suites across 2 categories):

| Category | Suite | Label Filter |
|----------|-------|-------------|
| GAIE | traffic | `!GAIEMetrics && !GAIELeaderElection` |
| GAIE | metrics | `GAIEMetrics` |
| Router | pd | `!Disruptive && !Extended && !SharedStorage && !Metrics` |
| Router | pd-shared-storage-deprecated | `SharedStorage && DeprecatedPD` |
| Router | pd-shared-storage-disagg | `SharedStorage && Disagg` |
| Router | pd-metrics | `Metrics` |
| Router | extended | `Extended` |
| Router | disruption | `Disruptive` |

### Test Coverage

**Quantitative**:
- **237 test files** vs 380 source files (ratio: 0.62)
- **74,064 lines of test code** vs 59,501 lines of source code (ratio: **1.24x** - tests exceed source!)
- Test packages: `epp` (core) and `sidecar` (proxy)
- Testing frameworks: Ginkgo/Gomega v2 + testify
- Race detection enabled on all test runs (`-race`)
- Coverage output: per-component `.out` profiles

**Test Types**:
- **Unit tests**: 200+ files across `pkg/epp/`, `pkg/sidecar/`, `pkg/common/`, `cmd/`
- **Hermetic integration**: envtest-based (no cluster required), covers K8s reconcilers and data sources
- **Full integration**: Requires live cluster, covers end-to-end EPP behavior
- **E2E**: Kind cluster with real images, 8 matrix suites, disruption testing
- **Benchmarks**: Tokenizer benchmarks, scheduler benchmarks, queue benchmarks
- **Sidecar E2E**: Separate E2E suite for the disaggregated inference sidecar

**Coverage Gate**:
- Custom `compare-coverage.sh` compares current vs baseline (main + release branches)
- Regression tolerance: 2.0% (configurable)
- Reports as GitHub Step Summary with component-level breakdown
- Baselines cached per branch and stored as artifacts for release branches (400-day retention)

### Code Quality

**Linting** (golangci-lint v2 with 22+ linters):
- `importas`, `bodyclose`, `copyloopvar`, `dupword`, `durationcheck`
- `errcheck`, `fatcontext`, `ginkgolinter`, `goconst`, `gocritic`
- `govet`, `ineffassign`, `loggercheck`, `makezero`, `misspell`
- `nakedret`, `nilnil`, `perfsprint`, `prealloc`, `revive`
- `staticcheck`, `unparam`, `unused`, `unconvert`
- Formatters: `goimports`, `gofmt`
- Custom `importas` aliases for internal packages
- `revive` with 15 configured rules

**Additional Quality Tools**:
- `typos` for spellchecking
- `govulncheck` for known vulnerability scanning
- Markdown link checker
- `go mod tidy -diff` for dependency hygiene
- Pre-commit hook: lint + test
- DCO sign-off required

**Dependency Management**:
- Dependabot: weekly, patches only (major/minor manual), grouped by ecosystem
- Renovate: extends Konflux central config
- Dependency review on PRs (`fail-on-severity: high`)

### Container Images

**Dockerfiles**:
| File | Base | Purpose |
|------|------|---------|
| `Dockerfile.epp` | `gcr.io/distroless/static:nonroot` | EPP (Endpoint Picker) - community |
| `Dockerfile.sidecar` | `gcr.io/distroless/static:nonroot` | Disagg sidecar - community |
| `Dockerfile.epp.konflux` | `registry.access.redhat.com/ubi9/ubi-minimal:9.7` (pinned digest) | EPP - RHOAI downstream |
| `Dockerfile.sidecar.konflux` | (likely similar UBI9, not checked) | Sidecar - RHOAI downstream |
| `Dockerfile.builder` | golang:1.25.11 | Builder container for all Make targets |

**Security**:
- Non-root user (`65532:65532`)
- Distroless base for minimal attack surface
- Multi-stage builds (builder + runtime)
- `LDFLAGS="-s -w"` strips debug symbols
- `BASE_IMAGE` overridable for downstream

**Multi-Architecture**:
- AMD64 + ARM64 supported via buildx
- Platform-specific builds in CI

**Scanning**:
- Trivy: HIGH + CRITICAL severity gate (blocks push on failure)
- SARIF results uploaded to GitHub Security tab
- govulncheck for Go vulnerability scanning

### Security Practices

| Practice | Status | Details |
|----------|--------|---------|
| Container scanning | ✅ | Trivy with SARIF upload |
| Vulnerability scanning | ✅ | govulncheck in CI |
| Dependency review | ✅ | `actions/dependency-review-action@v5` |
| Signed commits | ✅ | `1Password/check-signed-commits-action@v1` |
| Non-root containers | ✅ | User 65532:65532 |
| Distroless base | ✅ | `gcr.io/distroless/static:nonroot` |
| SAST/CodeQL | ❌ | Not configured |
| Secret detection | ❌ | No gitleaks/TruffleHog |
| SBOM generation | ❌ | Not in upstream pipeline |
| Image signing | ❌ | No Cosign/Notation |

### Agent Rules (Agentic Flow Quality)

**Status**: Present (AGENTS.md + CLAUDE.md symlink)

**Strengths**:
- Clear authorization model (Allowed / Ask First / Never)
- Detailed code style conventions
- Logging level conventions with named constants
- Git workflow (DCO, imperative subjects, no machine co-author trailers)
- PR minimalism principles
- Explicit rules about verifying behavior before claiming completion

**Gaps**:
- No `.claude/rules/` directory
- No test-specific rules for AI agents (how to write unit tests, what frameworks to use, test patterns)
- No example-based test documentation for the Ginkgo/Gomega patterns used throughout
- Missing: benchmark test guidelines, envtest integration patterns, E2E test structure

**Recommendation**: Generate test creation rules with `/test-rules-generator` covering:
- Unit tests: Ginkgo `Describe/Context/It` structure, testify assertions
- Integration tests: envtest setup, hermetic patterns
- E2E tests: Kind cluster setup, label filtering
- Benchmark tests: `testing.B` patterns, memory profiling

### Tekton/Konflux Pipelines

- `.tekton/` contains PipelineRun definitions for Konflux builds
- EPP and sidecar each have pull-request and push pipeline configs
- Pipelines resolve from `opendatahub-io/odh-konflux-central` for multi-arch container builds
- Output images go to `quay.io/rhoai/`
- Service account-based authentication in `rhoai-tenant` namespace
- `Dockerfile.epp.konflux` uses UBI9 base with pinned SHA digests

## Recommendations

### Priority 0 (Critical)

1. **Add PR-time Konflux Dockerfile validation** - Build `Dockerfile.epp.konflux` and `Dockerfile.sidecar.konflux` on PRs that modify Go source, Dockerfiles, or `go.mod`/`go.sum`. This catches UBI9-specific build issues (CGO_ENABLED=1, pinned digests, different toolchain) before they reach the Tekton pipeline
2. **Add image signing and SBOM generation** - Add Cosign signing and Syft SBOM generation to the release pipeline for supply chain compliance

### Priority 1 (High Value)

3. **Set minimum coverage threshold** - Add `COVERAGE_THRESHOLD=60` (or appropriate value) to the CI coverage gate to prevent slow erosion
4. **Create .claude/rules/ for test patterns** - Document the Ginkgo/Gomega unit test patterns, envtest integration patterns, and E2E Kind cluster patterns used in the 237 existing test files
5. **Add secret detection** - Add gitleaks to the lint workflow to catch accidental credential commits
6. **Add SAST scanning** - CodeQL or Semgrep for deeper static analysis beyond govulncheck

### Priority 2 (Nice-to-Have)

7. **Contract testing for plugin interfaces** - The plugin framework (`pkg/epp/framework/interface/`) defines complex interfaces; contract tests would catch breaking changes
8. **Load/stress testing** - The scheduler and routing hot paths (`pkg/epp/scheduling/`, `pkg/epp/handlers/`) would benefit from systematic load testing
9. **Coverage visualization** - Replace custom coverage comparison with Codecov or Coveralls for richer per-file coverage visualization on PRs
10. **Chaos engineering** - Extend the disruption tests with systematic chaos injection (network partitions, pod failures, resource exhaustion)

## Comparison to Gold Standards

| Practice | llm-d-inference-scheduler | odh-dashboard | notebooks | kserve |
|----------|--------------------------|---------------|-----------|--------|
| Unit test coverage | ✅ 1.24x ratio | ✅ Strong | ⚠️ Limited | ✅ Strong |
| Integration tests | ✅ Hermetic envtest | ✅ Contract tests | N/A | ✅ envtest |
| E2E automation | ✅ 8-suite matrix | ✅ Cypress | ⚠️ Image-focused | ✅ Kind |
| Coverage gate | ✅ Regression gate | ✅ Codecov | ❌ None | ✅ Codecov |
| Container scanning | ✅ Trivy | ⚠️ Limited | ✅ 5-layer | ⚠️ Basic |
| SBOM/signing | ❌ Missing | ❌ Missing | ⚠️ Partial | ❌ Missing |
| Agent rules | ✅ AGENTS.md | ✅ Comprehensive | ❌ None | ❌ None |
| Pre-commit hooks | ✅ lint + test | ✅ Husky | ❌ None | ❌ None |
| Dependency mgmt | ✅ Dependabot+Renovate | ✅ Dependabot | ⚠️ Manual | ✅ Dependabot |
| Secret detection | ❌ Missing | ❌ Missing | ❌ Missing | ❌ Missing |
| Multi-arch | ✅ AMD64+ARM64 | N/A | ✅ Multi-arch | ⚠️ AMD64 |
| Disruption testing | ✅ Present | ❌ None | ❌ None | ⚠️ Basic |

## File Paths Reference

### CI/CD
- `.github/workflows/ci-pr-checks.yaml` - Main PR gate (unit, integration, E2E, coverage)
- `.github/workflows/ci-lint.yaml` - Build + lint + govulncheck
- `.github/workflows/ci-build-images.yaml` - Reusable image build + Trivy scan
- `.github/workflows/ci-dev.yaml` - Dev image build on main push
- `.github/workflows/ci-release.yaml` - Release image build on tag
- `.github/workflows/ci-dependency-review.yaml` - PR dependency review
- `.github/workflows/ci-signed-commits.yaml` - Signed commit enforcement
- `.github/actions/trivy-scan/action.yml` - Custom Trivy scan composite action
- `.github/actions/docker-build-and-push/action.yml` - Custom build composite action

### Testing
- `pkg/epp/**/*_test.go` - EPP unit tests (150+ files)
- `pkg/sidecar/proxy/*_test.go` - Sidecar unit tests (14 files)
- `test/integration/epp/*_test.go` - Hermetic integration tests (12 files)
- `test/e2e/epp/*_test.go` - EPP E2E tests (Kind cluster)
- `test/e2e/*_test.go` - GAIE E2E tests (Kind cluster)
- `test/sidecar/e2e/*_test.go` - Sidecar E2E tests
- `test/profiling/tokenizerbench/*_test.go` - Benchmark tests
- `scripts/compare-coverage.sh` - Coverage regression comparison

### Configuration
- `.golangci.yml` - Linter config (22+ linters)
- `.typos.toml` - Typo checker config
- `Makefile` + `Makefile.*.mk` - Build targets
- `.github/dependabot.yml` - Dependabot config
- `.github/renovate.json` - Renovate config
- `hooks/pre-commit` - Git pre-commit hook

### Container Images
- `Dockerfile.epp` - EPP image (community, distroless)
- `Dockerfile.sidecar` - Sidecar image (community, distroless)
- `Dockerfile.epp.konflux` - EPP image (RHOAI, UBI9)
- `Dockerfile.sidecar.konflux` - Sidecar image (RHOAI, UBI9)
- `Dockerfile.builder` - Builder container

### Tekton/Konflux
- `.tekton/odh-llm-d-router-endpoint-picker-pull-request.yaml` - Konflux PR pipeline
- `.tekton/odh-llm-d-router-endpoint-picker-push.yaml` - Konflux push pipeline
- `.tekton/odh-llm-d-router-disagg-sidecar-pull-request.yaml` - Sidecar PR pipeline
- `.tekton/odh-llm-d-router-disagg-sidecar-push.yaml` - Sidecar push pipeline

### Agent Rules
- `AGENTS.md` - Comprehensive agent operating rules
- `CLAUDE.md` - Symlink to AGENTS.md
- `.gemini/settings.json` - Gemini context config
