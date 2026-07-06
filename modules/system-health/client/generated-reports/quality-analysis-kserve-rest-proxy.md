---
repository: "kserve/rest-proxy"
overall_score: 3.4
scorecard:
  - dimension: "Unit Tests"
    score: 5.0
    status: "Core marshaling logic tested but server/TLS paths have zero coverage"
  - dimension: "Integration/E2E"
    score: 1.0
    status: "No integration or E2E tests exist; proxy behavior untested end-to-end"
  - dimension: "Build Integration"
    score: 4.0
    status: "Multi-arch Docker builds on PR but no Konflux simulation or image startup validation"
  - dimension: "Image Testing"
    score: 3.0
    status: "Multi-stage UBI9 builds with non-root user but no vulnerability scanning or SBOM"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "Coverage profile generated locally but no CI integration, thresholds, or PR reporting"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "Three workflows with CodeQL and pre-commit but uses outdated action versions and no concurrency control"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, .claude/ directory, or test automation guidance of any kind"
critical_gaps:
  - title: "No integration or E2E tests for proxy functionality"
    impact: "gRPC-to-REST translation is never tested end-to-end; regressions in routing, TLS, or error handling go undetected"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No container vulnerability scanning"
    impact: "Known CVEs in base images or dependencies shipped to production without detection"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Test coverage can silently degrade across PRs with no visibility"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Server startup and TLS configuration untested"
    impact: "TLS misconfigurations, port binding failures, or env var parsing bugs not caught before deployment"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No image runtime validation"
    impact: "Built images may fail to start or serve traffic; issues discovered only after deployment"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add Trivy scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Immediate visibility into container image and dependency vulnerabilities"
  - title: "Integrate Codecov for coverage reporting"
    effort: "2-3 hours"
    impact: "PR-level coverage visibility and regression prevention"
  - title: "Update GitHub Actions to latest versions"
    effort: "1 hour"
    impact: "Security fixes, Node 20 runtime, and performance improvements"
  - title: "Add concurrency control to workflows"
    effort: "30 minutes"
    impact: "Cancel superseded runs, reduce CI queue time"
  - title: "Enable gosec linter in golangci-lint"
    effort: "1 hour"
    impact: "Catch common Go security issues (hardcoded credentials, weak crypto, etc.)"
recommendations:
  priority_0:
    - "Add integration tests that spin up the proxy and a mock gRPC server to validate REST-to-gRPC translation end-to-end"
    - "Add Trivy or Snyk container scanning to the PR workflow to block images with critical/high CVEs"
    - "Integrate Codecov with coverage thresholds (suggest 70% minimum) to prevent silent coverage regression"
  priority_1:
    - "Add unit tests for main.go covering server startup, TLS configuration, and environment variable parsing"
    - "Add container image startup validation in CI (build, run, health-check)"
    - "Create CLAUDE.md and .claude/rules/ with test creation guidance for AI-assisted development"
    - "Enable gosec linter and add gitleaks for secret detection"
  priority_2:
    - "Add SBOM generation (syft/trivy) to the build pipeline"
    - "Add image signing with cosign/sigstore"
    - "Add fuzz testing for the custom JSON unmarshaling logic in request.go and bytes.go"
    - "Add performance/load testing for the proxy under high-throughput inference workloads"
---

# Quality Analysis: kserve/rest-proxy

## Executive Summary

- **Overall Score: 3.4/10**
- **Repository Type**: Go gRPC-to-REST proxy (KServe V2 Inference Protocol)
- **Primary Language**: Go 1.25
- **Codebase Size**: ~800 lines of source code (excluding ~2,774 lines of generated protobuf/gRPC code)
- **Key Strengths**: Multi-architecture Docker builds, CodeQL SAST, pre-commit hooks, well-structured multi-stage Dockerfile
- **Critical Gaps**: No integration/E2E tests, no container scanning, no coverage tracking, server startup paths untested
- **Agent Rules Status**: Missing - no CLAUDE.md, .claude/, or test automation guidance

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 5.0/10 | Core marshaling logic tested but server/TLS paths have zero coverage |
| Integration/E2E | 1.0/10 | No integration or E2E tests exist; proxy behavior untested end-to-end |
| **Build Integration** | **4.0/10** | **Multi-arch Docker builds on PR but no Konflux simulation or image startup validation** |
| Image Testing | 3.0/10 | Multi-stage UBI9 builds with non-root user but no vulnerability scanning or SBOM |
| Coverage Tracking | 2.0/10 | Coverage profile generated locally but no CI integration, thresholds, or PR reporting |
| CI/CD Automation | 6.0/10 | Three workflows with CodeQL and pre-commit but uses outdated action versions and no concurrency control |
| Agent Rules | 0.0/10 | No CLAUDE.md, .claude/ directory, or test automation guidance of any kind |

## Critical Gaps

### 1. No Integration or E2E Tests for Proxy Functionality
- **Impact**: The proxy's core purpose — translating REST API calls to gRPC for the V2 Inference Protocol — is never tested end-to-end. Regressions in routing, TLS negotiation, error propagation, or protocol translation go undetected.
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Current State**: Only unit tests exist for `CustomJSONPb.NewDecoder()` and `CustomJSONPb.Marshal()`. The actual HTTP server, gRPC client connection, and full request/response cycle are untested.

### 2. No Container Vulnerability Scanning
- **Impact**: The project builds and pushes Docker images to DockerHub without any vulnerability scanning. Known CVEs in the UBI9 base images or Go dependencies could ship to production.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Current State**: No Trivy, Snyk, or any scanning tool in CI. The `.trivyignore` file does not exist.

### 3. No Coverage Tracking or Enforcement
- **Impact**: Test coverage can silently degrade across PRs. The Makefile generates `cover.out` but it is never uploaded, analyzed, or enforced.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Current State**: `go test -coverprofile cover.out` in Makefile but no Codecov/Coveralls integration, no thresholds, no PR comments.

### 4. Server Startup and TLS Configuration Untested
- **Impact**: The `main.go` file handles TLS configuration, environment variable parsing, gRPC connection setup, and HTTP server startup — none of which has any test coverage. TLS misconfigurations or environment parsing bugs are only caught in production.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Current State**: `main.go` (140 lines) has 0% test coverage.

### 5. No Image Runtime Validation
- **Impact**: Built container images are pushed without verification that they start successfully or can serve traffic.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Current State**: `build.yml` builds and pushes images but never runs them.

## Quick Wins

### 1. Add Trivy Scanning to PR Workflow (1-2 hours)
Immediate vulnerability detection for container images and dependencies.

```yaml
# Add to .github/workflows/build.yml after the build step
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: '${{ env.IMAGE_NAME }}:${{ env.IMAGE_TAG }}'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'

- name: Upload Trivy scan results
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: 'trivy-results.sarif'
```

### 2. Integrate Codecov for Coverage Reporting (2-3 hours)
PR-level coverage visibility and regression prevention.

```yaml
# Add to .github/workflows/test.yml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: cover.out
    fail_ci_if_error: true
```

And create `.codecov.yml`:
```yaml
coverage:
  status:
    project:
      default:
        target: 70%
    patch:
      default:
        target: 80%
```

### 3. Update GitHub Actions to Latest Versions (1 hour)
Current workflows use outdated actions (v2/v3). Update to latest:

| Action | Current | Latest |
|--------|---------|--------|
| `actions/checkout` | v3 | v4 |
| `docker/setup-buildx-action` | v2 | v3 |
| `docker/setup-qemu-action` | v2 | v3 |
| `docker/login-action` | v2 | v3 |
| `docker/build-push-action` | v4 | v6 |
| `github/codeql-action/*` | v2 | v3 |

### 4. Add Concurrency Control to Workflows (30 minutes)
Cancel superseded CI runs to reduce queue time.

```yaml
# Add to each workflow
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 5. Enable gosec Linter (1 hour)
The `gosec` linter is explicitly commented out in `.golangci.yaml`. Enable it for security-focused static analysis:

```yaml
# In .golangci.yaml linters.enable:
- gosec
```

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory:**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | PR (main, release-*) | Build dev image, lint, unit tests |
| `build.yml` | PR, push, schedule (Mon/Wed), dispatch | Multi-arch image build + push |
| `codeql.yml` | PR, push (main), schedule (daily) | Go SAST analysis |

**Strengths:**
- Tests run on PRs before merge
- Multi-arch builds (amd64, arm64, ppc64le, s390x) via QEMU
- GHA build cache enabled (`cache-from: type=gha`)
- CodeQL SAST runs on PRs and on schedule
- Test workflow runs lint and unit tests inside a Docker dev container for reproducibility

**Weaknesses:**
- Outdated action versions (checkout@v3, codeql@v2, etc.) — missing security fixes and Node 20 runtime
- No concurrency control — superseded PRs continue running
- No workflow for dependency updates (no Dependabot/Renovate)
- Tests run inside Docker container but no caching of Docker layers between runs
- No branch protection enforcement visible in repo config
- `paths-ignore: '**.md'` on test/build means docs-only PRs skip CI entirely (acceptable but worth noting)

### Test Coverage

**Test Files:**
- `proxy/request_test.go` (269 lines, 2 test functions)
  - `TestRESTRequest`: Tests REST-to-protobuf request conversion for 1D/2D/3D/4D tensor data
  - `TestBytesRESTRequest`: Tests BYTES datatype handling with multiple encoding modes (strings, byte arrays, base64)
- `proxy/marshaler_test.go` (176 lines, 4 test functions)
  - `TestRESTResponse`: Tests protobuf-to-REST response marshaling
  - `TestBytesRESTResponse`: Tests BYTES response marshaling
  - `TestBytesRESTResponseRawOutput`: Tests raw output bytes handling for BYTES type
  - `TestRESTResponseRawOutput`: Tests raw output bytes for INT64 type

**Test Quality:**
- Tests use `proto.Equal` and `google/go-cmp` for accurate comparison — good practice
- Table-driven tests for BYTES cases (`bytesTensorCases`) — good practice
- Tests cover multiple tensor dimensions (1D-4D) and datatypes (FP32, INT64, BYTES)
- Tests include edge cases: base64 encoding, content_type parameter handling, raw output contents

**Test-to-Code Ratio:** 445 test lines / 798 source lines = **0.56** (below recommended 1.0+ for critical infrastructure)

**Untested Code:**
- `proxy/main.go`: Server startup, TLS configuration, env var parsing, gRPC connection setup — 0% coverage
- `proxy/bytes.go`: `splitRawBytes()` is tested indirectly via marshaler tests but error paths are not explicitly tested
- `proxy/request.go`: `parameterMap.MarshalJSON()` not directly tested; error paths in `targetArray()` (FP16 unsupported, unknown datatype) not tested

### Code Quality

**Linting:**
- `golangci-lint` configured with 10 linters: errcheck, gosimple, govet, ineffassign, staticcheck, typecheck, unused, goconst, gofmt, goimports
- All `govet` analyzers enabled (except `fieldalignment`)
- Shadow checking enabled
- Pre-commit hooks enforce linting and formatting via Docker dev container
- `prettier` configured for non-Go files

**Gaps:**
- `gosec` explicitly disabled — no security-focused lint checks
- `bodyclose`, `noctx`, `goerr113` disabled — miss HTTP response body leaks, context propagation issues, and error wrapping
- `goimports.local-prefixes` set to `github.com/org/project` (placeholder, not updated to `github.com/kserve/rest-proxy`)

### Container Images

**Dockerfile Analysis:**
- **Multi-stage build** (3 stages): develop → build → runtime
- **Base images**: `registry.access.redhat.com/ubi9/go-toolset` (build), `ubi9/ubi-micro:9.5` (runtime)
- **Non-root user**: `USER 2000` in runtime stage
- **CGO_ENABLED=0**: Static binary compilation
- **Cross-compilation**: Uses `BUILDPLATFORM` native compiler for `TARGETPLATFORM` binaries
- **Dependency caching**: `go mod download` before source copy, `--mount=type=cache` for go-build and pip
- **Minimal runtime**: `ubi-micro` base (~30MB), only contains the compiled binary

**Strengths:**
- UBI9 base images (Red Hat supported, enterprise-grade)
- Tiny runtime image footprint
- Pre-commit hooks installed in dev stage for consistent formatting
- Build cache optimization with Docker BuildKit

**Gaps:**
- No vulnerability scanning anywhere in the pipeline
- No SBOM generation
- No image signing or attestation
- No health check endpoint defined (no HEALTHCHECK instruction)
- No image startup validation test
- `ubi-micro:9.5` pins to a specific minor version — good for reproducibility but requires manual updates

### Security

**Implemented:**
- CodeQL SAST on Go code (PR + push + daily schedule)
- SECURITY.md with responsible disclosure process
- Non-root container runtime user
- UBI9 base images (Red Hat security updates)

**Missing:**
- No container vulnerability scanning (Trivy/Snyk/Grype)
- No dependency scanning in CI (Go modules have known CVE databases)
- No secret detection (gitleaks/TruffleHog)
- `gosec` linter disabled in golangci-lint
- No `govulncheck` integration for Go vulnerability database checks
- TLS configuration uses `InsecureSkipVerify` controlled by env var — potential security risk if misconfigured

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: No test creation rules, no coding standards guidance, no skill definitions
- **Recommendation**: Generate rules with `/test-rules-generator` to establish:
  - Unit test patterns (table-driven tests, proto comparison)
  - Integration test patterns (gRPC mock server setup)
  - Coverage requirements
  - Security testing guidelines

## Recommendations

### Priority 0 (Critical)

1. **Add Integration Tests for Proxy Functionality**
   - Spin up a mock gRPC inference service
   - Start the REST proxy against it
   - Send REST inference requests and validate gRPC forwarding
   - Test TLS and non-TLS modes
   - Test error propagation (gRPC errors → REST HTTP status codes)
   - Estimated effort: 16-24 hours

2. **Add Container Vulnerability Scanning**
   - Add Trivy to `build.yml` for image scanning on every PR
   - Configure severity thresholds (block on CRITICAL/HIGH)
   - Upload SARIF results to GitHub Security tab
   - Estimated effort: 2-4 hours

3. **Integrate Coverage Tracking with Enforcement**
   - Add Codecov to `test.yml`
   - Set project coverage target (70% minimum recommended)
   - Set patch coverage target (80% for new code)
   - Upload `cover.out` artifact from CI
   - Estimated effort: 2-4 hours

### Priority 1 (High Value)

4. **Add Unit Tests for main.go**
   - Test `getIntegerEnv()` with various env configurations
   - Test `run()` function initialization (requires refactoring for testability)
   - Test TLS configuration paths
   - Estimated effort: 4-8 hours

5. **Add Image Startup Validation**
   - After building the image in CI, run it briefly
   - Verify the server starts and listens on the expected port
   - Validate the health endpoint responds (or add a health endpoint first)
   - Estimated effort: 4-6 hours

6. **Create Agent Rules**
   - Add `CLAUDE.md` with project overview and contribution guidelines
   - Add `.claude/rules/unit-tests.md` with table-driven test patterns and proto comparison examples
   - Add `.claude/rules/integration-tests.md` with gRPC mock server setup patterns
   - Estimated effort: 2-4 hours

7. **Enable Security Linters**
   - Enable `gosec` in `.golangci.yaml`
   - Add `govulncheck` to CI for Go vulnerability database checks
   - Add `gitleaks` for secret detection
   - Estimated effort: 2-3 hours

### Priority 2 (Nice-to-Have)

8. **Add SBOM Generation**
   - Use `syft` or `trivy` to generate SBOM during image builds
   - Attach SBOM as build attestation
   - Estimated effort: 2-3 hours

9. **Add Image Signing with cosign**
   - Sign published images with Sigstore/cosign
   - Verify signatures in deployment pipelines
   - Estimated effort: 2-4 hours

10. **Add Fuzz Testing for Custom JSON Parsing**
    - The custom JSON unmarshaling in `request.go` and `bytes.go` handles untrusted input
    - Go's built-in fuzzing (`go test -fuzz`) would be ideal for finding edge cases
    - Focus on `UnmarshalJSON`, `unmarshalBytesJson`, `unmarshalStringArray`
    - Estimated effort: 4-8 hours

11. **Add Performance Testing**
    - Benchmark REST-to-gRPC translation throughput
    - Test with large tensor payloads (the proxy handles max 16MB by default)
    - Measure latency overhead of the proxy layer
    - Estimated effort: 8-16 hours

## Comparison to Gold Standards

| Capability | rest-proxy | odh-dashboard | notebooks | kserve (main) |
|------------|-----------|---------------|-----------|---------------|
| Unit Tests | 6 tests, core logic only | Comprehensive, 1000+ tests | N/A (not code) | Extensive, Go + Python |
| Integration Tests | None | Contract tests, API tests | N/A | Controller integration tests |
| E2E Tests | None | Cypress E2E suite | Image validation suite | KServe E2E framework |
| Coverage Tracking | Local only | Codecov with enforcement | N/A | Codecov with enforcement |
| Coverage Threshold | None | Yes (enforced) | N/A | Yes (enforced) |
| Image Scanning | None | Trivy | Multi-layer scanning | Trivy/Snyk |
| Multi-arch Build | Yes (4 platforms) | Yes | Yes | Yes |
| SBOM | None | Yes | Yes | Yes |
| Image Signing | None | Yes (cosign) | N/A | Yes |
| Pre-commit Hooks | Yes (golangci-lint) | Yes (multiple) | N/A | Yes |
| CodeQL/SAST | Yes | Yes | N/A | Yes |
| Agent Rules | None | Comprehensive | N/A | Partial |
| Concurrency Control | None | Yes | Yes | Yes |
| Dependency Updates | None | Renovate/Dependabot | Manual | Dependabot |

## File Paths Reference

### CI/CD
- `.github/workflows/test.yml` — PR test workflow (lint + unit tests)
- `.github/workflows/build.yml` — Multi-arch Docker build and push
- `.github/workflows/codeql.yml` — CodeQL SAST scanning

### Source Code
- `proxy/main.go` — HTTP/gRPC server setup, TLS, env vars (140 lines)
- `proxy/request.go` — REST-to-gRPC request transformation, JSON unmarshaling (241 lines)
- `proxy/marshaler.go` — gRPC-to-REST response transformation, JSON marshaling (207 lines)
- `proxy/bytes.go` — BYTES tensor type handling, base64/raw parsing (211 lines)
- `gen/` — Generated protobuf/gRPC gateway code (2,774 lines, excluded from analysis)

### Tests
- `proxy/request_test.go` — Request transformation tests (269 lines, 2 tests)
- `proxy/marshaler_test.go` — Response marshaling tests (176 lines, 4 tests)

### Build
- `Dockerfile` — Multi-stage build (develop → build → runtime)
- `Makefile` — Build, test, and development targets
- `grpc_predict_v2.proto` — V2 Inference Protocol definition

### Code Quality
- `.golangci.yaml` — 10 linters configured
- `.pre-commit-config.yaml` — golangci-lint + prettier hooks
- `scripts/fmt.sh` — Pre-commit runner with CI-aware error messages
- `scripts/develop.sh` — Docker-based development environment
