---
repository: "red-hat-data-services/llm-d-routing-sidecar"
overall_score: 5.4
scorecard:
  - dimension: "Unit Tests"
    score: 6.0
    status: "Ginkgo/Gomega tests cover proxy routing and SSRF allowlist; connector_lmcache and errors.go untested"
  - dimension: "Integration/E2E"
    score: 4.0
    status: "E2E scaffold exists with Kind config but only validates pod-is-Running; no request-level E2E"
  - dimension: "Build Integration"
    score: 3.0
    status: "No PR-time Docker build; Konflux build is comment-triggered, not automatic; CGO_ENABLED mismatch between Dockerfiles"
  - dimension: "Image Testing"
    score: 2.0
    status: "No image startup or runtime validation; Trivy scan runs only on release, not on PRs"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tool integration; no coverage reports generated or enforced"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "PR workflow runs lint + unit tests; lacks concurrency control, caching strategy, and E2E automation"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, .claude/ directory, or agent rules of any kind"
critical_gaps:
  - title: "No code coverage tracking or enforcement"
    impact: "Impossible to know which code paths are tested; regressions go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Trivy security scanning only on release, not PRs"
    impact: "Vulnerabilities introduced in PRs are not caught until after merge and release"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No PR-time Docker image build validation"
    impact: "Dockerfile changes (incl. CGO_ENABLED=0 vs =1 mismatch) discovered only post-merge in Konflux"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "LMCache connector has zero test coverage"
    impact: "88 lines of production proxy logic with no tests; regressions are silent"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "E2E tests are non-functional (only check pod Running status)"
    impact: "No end-to-end validation of request routing, prefill/decode flow, or TLS behavior"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "CGO_ENABLED mismatch between Dockerfile (=0) and Dockerfile.konflux (=1)"
    impact: "Potential runtime binary incompatibility between dev and production builds"
    severity: "HIGH"
    effort: "1 hour"
quick_wins:
  - title: "Add Codecov/Coveralls integration with coverage threshold"
    effort: "2-4 hours"
    impact: "Immediately surface untested code paths; enforce coverage baseline on PRs"
  - title: "Move Trivy scan from release workflow to PR workflow"
    effort: "1-2 hours"
    impact: "Catch vulnerabilities before merge; already have the trivy-scan action"
  - title: "Add Docker build step to PR workflow"
    effort: "1-2 hours"
    impact: "Catch Dockerfile build failures on PRs instead of post-merge in Konflux"
  - title: "Add concurrency control to PR workflow"
    effort: "30 minutes"
    impact: "Prevent redundant CI runs on rapid pushes; save CI minutes"
  - title: "Fix CGO_ENABLED mismatch between Dockerfiles"
    effort: "30 minutes"
    impact: "Eliminate a class of production-only runtime failures"
  - title: "Add tests for connector_lmcache.go"
    effort: "3-4 hours"
    impact: "Cover 88 lines of currently untested proxy routing logic"
recommendations:
  priority_0:
    - "Add coverage tracking (Codecov) with minimum threshold enforcement (e.g., 60%)"
    - "Move Trivy scanning to PR workflow to catch vulnerabilities pre-merge"
    - "Fix CGO_ENABLED=0 vs CGO_ENABLED=1 mismatch between Dockerfile and Dockerfile.konflux"
    - "Add PR-time Docker build validation step"
  priority_1:
    - "Write unit tests for connector_lmcache.go (currently 0% coverage on 88 LoC)"
    - "Expand E2E tests beyond pod-Running check to validate actual request routing"
    - "Add SSRF protection integration tests with real InferencePool resources"
    - "Add concurrency control and caching optimization to PR workflow"
  priority_2:
    - "Create .claude/ agent rules for test patterns and standards"
    - "Add CodeQL/SAST workflow for static security analysis"
    - "Add error response testing for edge cases (malformed JSON, connection failures)"
    - "Add TLS certificate rotation and mTLS integration tests"
---

# Quality Analysis: llm-d-routing-sidecar

## Executive Summary

- **Overall Score: 5.4/10**
- **Repository Type**: Go reverse proxy sidecar for LLM prefill/decode disaggregation
- **Primary Language**: Go 1.24 with Ginkgo/Gomega test framework
- **Key Strengths**: Good unit test patterns for core proxy routing; solid golangci-lint config with 20+ linters; pre-commit hooks in place; multi-arch Konflux build pipeline; SSRF protection with allowlist feature
- **Critical Gaps**: No coverage tracking at all; Trivy only on releases; no PR-time Docker build; LMCache connector entirely untested; E2E tests are essentially stubs; CGO_ENABLED mismatch between Dockerfiles
- **Agent Rules Status**: Missing — no CLAUDE.md, .claude/ directory, or AI agent guidance

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.0/10 | Ginkgo/Gomega tests cover proxy routing (NIXL v1/v2) and SSRF allowlist; connector_lmcache untested |
| Integration/E2E | 4.0/10 | E2E scaffold with Kind config exists but only validates pod-is-Running status |
| **Build Integration** | **3.0/10** | **No PR-time Docker build; Konflux is comment-triggered; CGO_ENABLED mismatch** |
| Image Testing | 2.0/10 | No image startup or runtime validation; Trivy only on release |
| Coverage Tracking | 1.0/10 | No coverage tool, no reports, no enforcement |
| CI/CD Automation | 6.0/10 | PR workflow runs lint + tests; no concurrency control or E2E automation |
| Agent Rules | 0.0/10 | No agent rules or test automation guidance |

## Critical Gaps

### 1. No Code Coverage Tracking or Enforcement
- **Impact**: Cannot determine which code paths are tested; no way to detect coverage regressions
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No `.codecov.yml`, no Coveralls integration, `go test` does not generate coverage profiles. The `make test` target runs `ginkgo -v ./internal/...` without `-coverprofile`.

### 2. Trivy Security Scanning Only on Release
- **Impact**: Vulnerabilities introduced in PR dependencies are not caught until after merge and release tagging
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: The `trivy-scan` composite action already exists at `.github/actions/trivy-scan/`, but it's only referenced in `ci-release.yaml`. Simply adding it to `ci-pr-checks.yaml` after the build step would close this gap.

### 3. No PR-Time Docker Image Build Validation
- **Impact**: Dockerfile syntax errors, dependency issues, and build-arg mismatches are only caught post-merge in Konflux
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The PR workflow (`ci-pr-checks.yaml`) only runs lint and Go tests. There is no step that validates `docker build` succeeds. The Konflux pipeline (`.tekton/odh-llm-d-routing-sidecar-pull-request.yaml`) is triggered by `/build-konflux` comment, not automatically.

### 4. CGO_ENABLED Mismatch Between Dockerfiles
- **Impact**: `Dockerfile` builds with `CGO_ENABLED=0` (static binary, no C deps), while `Dockerfile.konflux` builds with `CGO_ENABLED=1` (dynamic linking, requires C libraries at runtime). This can cause production-only binary incompatibility.
- **Severity**: HIGH
- **Effort**: 1 hour
- **Details**: The `Dockerfile.konflux` also uses a different base image (`ubi9/ubi:latest` vs `ubi9/ubi-micro:latest`) and adds `-mod=mod`, so these differences are intentional but undocumented. The CGO_ENABLED difference is likely a bug.

### 5. LMCache Connector Has Zero Test Coverage
- **Impact**: 88 lines of production proxy routing logic for the LMCache P/D protocol have no tests; any regression is silent
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: `connector_lmcache.go` implements the LMCache protocol but has no corresponding test file. Both `connector_nixl.go` (tested via `proxy_test.go`) and `connector_nixlv2.go` (tested via `connector_nixlv2_test.go`) have coverage, but LMCache does not.

### 6. E2E Tests Are Non-Functional
- **Impact**: No validation of actual request routing, prefill/decode flow, TLS termination, or SSRF protection in a real cluster
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: `test/e2e/e2e_test.go` only checks that the Qwen pod reaches `Running` status. It does not send any HTTP requests through the sidecar proxy. The test infrastructure (Kind config, Kustomize overlays, mock server configs) exists but is not exercised.

## Quick Wins

### 1. Add Codecov Integration with Coverage Threshold
- **Effort**: 2-4 hours
- **Impact**: Immediately reveals untested code paths and blocks PRs that drop coverage
- **Implementation**:
  ```yaml
  # In ci-pr-checks.yaml, replace the test step:
  - name: Run go test with coverage
    run: |
      go install github.com/onsi/ginkgo/v2/ginkgo@latest
      ginkgo -v --coverprofile=coverage.out ./internal/...
  
  - name: Upload coverage to Codecov
    uses: codecov/codecov-action@v4
    with:
      files: coverage.out
      token: ${{ secrets.CODECOV_TOKEN }}
  ```

### 2. Move Trivy Scan to PR Workflow
- **Effort**: 1-2 hours
- **Impact**: Catches security vulnerabilities before merge
- **Implementation**: Add after a Docker build step in `ci-pr-checks.yaml`:
  ```yaml
  - name: Build test image
    run: docker build -t test-image:pr .
  
  - name: Run Trivy scan
    uses: ./.github/actions/trivy-scan
    with:
      image: test-image:pr
  ```

### 3. Add Docker Build Step to PR Workflow
- **Effort**: 1-2 hours
- **Impact**: Catches Dockerfile issues before merge
- **Implementation**:
  ```yaml
  - name: Build Docker image (validation only)
    run: docker build -t validation:test .
  ```

### 4. Add Concurrency Control to PR Workflow
- **Effort**: 30 minutes
- **Impact**: Prevents redundant CI runs when pushing rapid updates to a PR
- **Implementation**:
  ```yaml
  concurrency:
    group: ${{ github.workflow }}-${{ github.event.pull_request.number }}
    cancel-in-progress: true
  ```

### 5. Fix CGO_ENABLED Mismatch
- **Effort**: 30 minutes
- **Impact**: Eliminates production-only binary failures
- **Implementation**: Align `Dockerfile.konflux` to use `CGO_ENABLED=0` (or document why `CGO_ENABLED=1` is intentional for Konflux builds).

## Detailed Findings

### CI/CD Pipeline

**Workflows Found**: 2
- `ci-pr-checks.yaml` — PR-triggered: lint (golangci-lint v2.1.6) + unit tests + markdown link checking
- `ci-release.yaml` — Tag/release-triggered: Docker build, push to GHCR, Trivy scan

**Strengths**:
- Go module cache via `actions/setup-go@v5` with `cache-dependency-path`
- Custom composite actions for reusable build/test/scan steps
- Markdown link checker for documentation quality
- Multi-arch Docker builds (amd64 + arm64) on release

**Gaps**:
- No concurrency control on PR workflow — redundant runs on rapid pushes
- No E2E test automation in any workflow
- No Docker build validation on PRs
- No Trivy on PRs (only release)
- No CodeQL or SAST workflow
- Konflux pipeline is comment-triggered (`/build-konflux`), not automatic

### Test Coverage

**Test Framework**: Ginkgo v2 + Gomega (BDD-style)

**Unit Tests** (4 test files, 545 test LoC):
- `proxy_test.go` (257 lines) — Tests reverse proxy routing for NIXL V1 connector: request forwarding without prefill header (10 table-driven entries covering 5 paths × secure/insecure), and prefill+decode flow with proper header assertions
- `connector_nixlv2_test.go` (196 lines) — Tests NIXL V2 connector: kv_transfer_params field structure, backward compatibility, and decode forwarding
- `allowlist_test.go` (92 lines) — Tests SSRF allowlist validation: enabled/disabled states, host:port parsing, IPv6, and negative cases
- `proxy_suite_test.go` (28 lines) — Ginkgo bootstrap

**E2E Tests** (1 test file, 90 lines):
- `e2e_test.go` — Only validates pod reaches Running status; no HTTP request testing
- Kind configuration exists at `test/e2e/kind-config.yaml`
- Kustomize overlays for Kind and llm-d deployment exist

**Test Helpers**:
- `test/mock/chat_completions_handler.go` (148 lines) — Mock prefill/decode HTTP handlers
- `test/mock/generic_handler.go` (42 lines) — Generic request capture handler
- `test/utils/utils.go` (57 lines) — Command execution helper

**Test-to-Code Ratio**: 694 test LoC / 1817 source LoC = **0.38** (below 0.5 target)

**Untested Source Files**:
- `connector_lmcache.go` (88 lines) — Entire LMCache protocol untested
- `errors.go` (78 lines) — Error response helpers untested
- `chat_completions.go` (58 lines) — Chat completions handler untested
- `status_response_writer.go` (47 lines) — Buffered response writer untested
- `tls.go` (72 lines) — TLS certificate generation/loading untested
- `allowlist.go` (386 lines) — Kubernetes watcher logic untested (only the validator is tested)

### Code Quality

**Linting**: Strong configuration
- `.golangci.yml` (v2 format) with 20+ linters enabled
- Includes: `errcheck`, `govet`, `revive`, `ineffassign`, `unused`, `ginkgolinter`, `misspell`, `perfsprint`, `goconst`, `nakedret`, `prealloc`, `unparam`
- Formatters: `goimports`, `gofmt`
- 5-minute timeout, parallel runners allowed

**Pre-commit Hooks**: Present
- `.pre-commit-config.yaml` with:
  - `trailing-whitespace`, `end-of-file-fixer`, `check-yaml` (pre-commit-hooks v5.0.0)
  - `go-fmt`, `golangci-lint` (pre-commit-golang v0.5.1)

**Static Analysis**: Missing
- No CodeQL workflow
- No gosec or Semgrep
- No secret detection (Gitleaks/TruffleHog)

### Container Images

**Dockerfiles**: 2
- `Dockerfile` — Multi-stage, UBI9 go-toolset:1.24 builder → ubi9-micro runtime, CGO_ENABLED=0, non-root user (65532)
- `Dockerfile.konflux` — Similar but CGO_ENABLED=1, ubi9/ubi:latest runtime (larger), `-mod=mod` flag, RHEL labels

**Build Pipeline**:
- Makefile supports docker/podman/buildah with multi-arch capability
- Release workflow uses buildx for linux/amd64,linux/arm64
- Konflux pipeline builds linux/x86_64 + linux-m2xlarge/arm64

**Security Scanning**:
- Trivy scan on release images (HIGH, CRITICAL severity)
- No SBOM generation
- No image signing/attestation
- No vulnerability threshold enforcement (scan is informational only)

**Gaps**:
- No image startup validation (health check, readiness)
- No runtime testing (functional request through containerized sidecar)
- No `.dockerignore` to exclude test/docs from image
- Trivy version pinned to old v0.44.1

### Security

**SSRF Protection**: Implemented (feature-flagged)
- `AllowlistValidator` watches InferencePool resources and maintains pod IP allowlist
- Tests cover enabled/disabled states and host:port parsing
- Proper 403 Forbidden on unauthorized targets

**Gaps**:
- No CodeQL/SAST workflow
- No dependency scanning (e.g., `govulncheck`)
- No secret detection
- TLS implementation (`tls.go`) untested
- Certificate generation for development uses InsecureSkipVerify patterns

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No rules for any test type
- **Quality**: N/A
- **Gaps**: No CLAUDE.md, no `.claude/` directory, no AGENTS.md, no test automation guidance
- **Recommendation**: Generate rules with `/test-rules-generator` covering:
  - Unit test patterns (Ginkgo DescribeTable, BeforeEach setup, DeferCleanup)
  - Mock server patterns (ChatCompletionHandler, GenericHandler)
  - E2E patterns (Kind cluster setup, kubectl validation)
  - Test naming conventions and file organization

## Recommendations

### Priority 0 (Critical)

1. **Add coverage tracking with Codecov** — Generate coverage profiles in CI, upload to Codecov, set a minimum threshold (suggest 60% initial, increase to 75% over time)
2. **Move Trivy scanning to PR workflow** — The action already exists; reference it in `ci-pr-checks.yaml` after a Docker build step
3. **Fix CGO_ENABLED mismatch** — Align Dockerfile.konflux with Dockerfile (CGO_ENABLED=0) or document the intentional difference
4. **Add PR-time Docker build** — Validate both `Dockerfile` and `Dockerfile.konflux` build successfully on PRs

### Priority 1 (High Value)

5. **Write tests for connector_lmcache.go** — Follow the existing pattern in `connector_nixlv2_test.go`; cover max_tokens mutation, prefiller forwarding, and error paths
6. **Expand E2E tests** — Send actual HTTP requests through the sidecar; validate prefill/decode routing, SSRF protection, and TLS termination
7. **Add SSRF protection integration tests** — Test with real InferencePool resources and pod watcher in envtest or Kind
8. **Add concurrency control** — Prevent redundant CI runs with `cancel-in-progress`
9. **Add govulncheck** — Scan Go dependencies for known vulnerabilities

### Priority 2 (Nice-to-Have)

10. **Create agent rules** — `.claude/rules/` with unit test, integration test, and E2E test patterns
11. **Add CodeQL workflow** — Static analysis for Go security issues
12. **Add error response tests** — Cover `errors.go` helper functions
13. **Add TLS tests** — Certificate generation, rotation, mTLS scenarios
14. **Add .dockerignore** — Exclude test/, docs/, hack/ from image builds
15. **Update Trivy** — Pin to a recent version instead of v0.44.1

## Comparison to Gold Standards

| Practice | llm-d-routing-sidecar | odh-dashboard | notebooks | kserve |
|---|---|---|---|---|
| Unit test coverage | Partial (core proxy only) | Comprehensive | N/A | Comprehensive |
| Integration/E2E | Stub only | Multi-layer | Image-level | Multi-version |
| Coverage tracking | None | Codecov enforced | N/A | Codecov enforced |
| PR Docker build | None | Yes | Yes | Yes |
| Security scanning | Release-only Trivy | PR + release | Image scanning | PR + release |
| Pre-commit hooks | Yes | Yes | Limited | Yes |
| Linter config | Strong (20+ linters) | Strong | N/A | Strong |
| Agent rules | None | Comprehensive | None | None |
| SSRF protection | Yes (feature-flagged) | N/A | N/A | N/A |
| Multi-arch builds | Yes (amd64+arm64) | Yes | Yes | Yes |
| SBOM/attestation | None | Yes | Yes | Yes |

## File Paths Reference

| Category | Path | Notes |
|---|---|---|
| CI - PR | `.github/workflows/ci-pr-checks.yaml` | Lint + test on PRs |
| CI - Release | `.github/workflows/ci-release.yaml` | Docker build + Trivy on tags |
| Tekton/Konflux | `.tekton/odh-llm-d-routing-sidecar-pull-request.yaml` | Comment-triggered PR build |
| Linter | `.golangci.yml` | 20+ linters, v2 format |
| Pre-commit | `.pre-commit-config.yaml` | go-fmt, golangci-lint |
| Dockerfile | `Dockerfile` | CGO_ENABLED=0, ubi-micro |
| Dockerfile.konflux | `Dockerfile.konflux` | CGO_ENABLED=1, ubi |
| Unit tests | `internal/proxy/*_test.go` | 4 test files, 545 LoC |
| E2E tests | `test/e2e/e2e_test.go` | Pod-Running check only |
| E2E config | `test/config/` | Kind, Kustomize overlays |
| Mock servers | `test/mock/` | ChatCompletionHandler |
| Main | `cmd/llm-d-routing-sidecar/main.go` | CLI entrypoint |
| Core source | `internal/proxy/proxy.go` | 315 LoC, reverse proxy |
| SSRF | `internal/proxy/allowlist.go` | 386 LoC, pod watcher |
| Makefile | `Makefile` | Build, test, image targets |
