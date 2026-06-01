---
repository: "kserve/rest-proxy"
overall_score: 3.4
scorecard:
  - dimension: "Unit Tests"
    score: 5.0
    status: "Core marshaling logic tested but main.go untested, no edge case or error path coverage"
  - dimension: "Integration/E2E"
    score: 1.0
    status: "No integration or E2E tests exist; no gRPC server testing"
  - dimension: "Build Integration"
    score: 3.0
    status: "PR builds Docker image but no runtime validation or Konflux simulation"
  - dimension: "Image Testing"
    score: 4.0
    status: "Good multi-arch multi-stage Dockerfile but no scanning, SBOM, or signing"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "Coverage profile generated locally but never uploaded or enforced"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "Three workflows with CodeQL SAST but outdated action versions, no concurrency control"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, .claude/ directory, or any AI agent rules present"
critical_gaps:
  - title: "No integration or E2E tests"
    impact: "gRPC-to-REST translation correctness is only verified at the unit marshaling level; server startup, TLS, routing, and end-to-end request flows are completely untested"
    severity: "HIGH"
    effort: "12-16 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Coverage regressions go undetected; PRs can merge with reduced test coverage"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container vulnerability scanning"
    impact: "Security vulnerabilities in base images and dependencies are not detected before deployment"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "main.go is completely untested"
    impact: "Server startup logic, TLS configuration, environment variable parsing, and error handling are all untested"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No dependency update automation"
    impact: "Stale dependencies accumulate known CVEs; manual CVE tracking (e.g., go.mod replace for CVE-2024-45338) does not scale"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add Codecov integration to test workflow"
    effort: "2-3 hours"
    impact: "PR-level coverage reporting and regression detection with minimal code change"
  - title: "Add Trivy container scanning to build workflow"
    effort: "1-2 hours"
    impact: "Automated CVE detection in base images and Go binaries before deployment"
  - title: "Enable Dependabot for Go modules"
    effort: "30 minutes"
    impact: "Automated dependency update PRs with security advisory awareness"
  - title: "Update GitHub Actions to latest versions"
    effort: "1 hour"
    impact: "Security fixes and Node.js 20 compatibility (current v2/v3 actions use deprecated Node.js 16)"
recommendations:
  priority_0:
    - "Add integration tests that spin up the REST proxy against a mock gRPC server and verify end-to-end request/response translation"
    - "Add Codecov integration to upload coverage from PR test runs and set a minimum threshold (e.g., 70%)"
    - "Add Trivy container scanning to the build workflow for vulnerability detection"
  priority_1:
    - "Write unit tests for main.go covering TLS configuration, environment variable parsing, and error paths"
    - "Enable Dependabot or Renovate for automated Go dependency updates"
    - "Add concurrency controls to workflows to cancel superseded PR builds"
    - "Update all GitHub Actions to v4 (checkout, buildx, build-push-action, codeql-action)"
  priority_2:
    - "Create .claude/rules/ with test creation guidelines for AI-assisted development"
    - "Add gosec linter to golangci-lint configuration for Go security analysis"
    - "Add image signing with cosign and SBOM generation"
    - "Add secret detection with gitleaks pre-commit hook"
---

# Quality Analysis: kserve/rest-proxy

## Executive Summary

- **Overall Score: 3.4/10**
- **Repository Type**: Go REST-to-gRPC proxy for KServe V2 inference protocol
- **Primary Language**: Go 1.25
- **Size**: Small (~800 LOC hand-written, ~2800 LOC generated protobuf stubs)
- **Key Strengths**: Well-structured multi-stage multi-arch Dockerfile, pre-commit hooks with golangci-lint, CodeQL SAST scanning, focused unit tests on core marshaling logic
- **Critical Gaps**: No integration/E2E tests, no coverage enforcement, no container scanning, no dependency automation, main.go untested
- **Agent Rules Status**: Missing - no CLAUDE.md, .claude/ directory, or any AI agent guidance

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 5.0/10 | Core marshaling tested; main.go, error paths untested |
| Integration/E2E | 1.0/10 | No integration or E2E tests exist |
| **Build Integration** | **3.0/10** | **PR builds image but no runtime validation** |
| Image Testing | 4.0/10 | Multi-arch build, UBI base, but no scanning |
| Coverage Tracking | 2.0/10 | Profile generated but not uploaded or enforced |
| CI/CD Automation | 5.0/10 | Three workflows but outdated actions, no concurrency |
| Agent Rules | 0.0/10 | No agent rules or test guidance present |

## Critical Gaps

### 1. No Integration or E2E Tests
- **Impact**: The entire REST-to-gRPC proxy chain is only tested at the unit level for marshaling. Server startup, TLS configuration, gRPC endpoint registration, HTTP routing, and full request-response cycles are completely untested.
- **Severity**: HIGH
- **Effort**: 12-16 hours
- **What's missing**: Tests that start the proxy, connect to a mock gRPC backend, send REST requests, and verify correct gRPC forwarding and response translation.

### 2. No Coverage Tracking or Enforcement
- **Impact**: The Makefile generates `cover.out` via `go test -coverprofile`, but this file is never uploaded to Codecov or any similar service. PRs can merge with coverage regressions undetected.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Current state**: `make test` runs `go test -coverprofile cover.out` but the CI test workflow does not upload or report coverage.

### 3. No Container Vulnerability Scanning
- **Impact**: The runtime image (`ubi9/ubi-micro:9.5`) and compiled Go binary are never scanned for CVEs. Vulnerable base image packages or Go dependencies could reach production.
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Note**: The project manually patches CVEs in go.mod (e.g., CVE-2024-45338 golang.org/x/net replace directive), but this is reactive and does not scale.

### 4. main.go Completely Untested
- **Impact**: Server startup, TLS configuration (`InsecureSkipVerify` logic), environment variable parsing (`getIntegerEnv`), gRPC dial options, and error handling are all untested.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Risk**: The TLS configuration includes `InsecureSkipVerify` logic that could be misconfigured silently.

### 5. No Dependency Update Automation
- **Impact**: Go module dependencies are only updated manually. The project already has a manual CVE fix (`golang.org/x/net` replace), indicating reactive rather than proactive dependency management.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours

## Quick Wins

### 1. Add Codecov Integration (2-3 hours)
Upload the already-generated `cover.out` from the test workflow:

```yaml
# Add to .github/workflows/test.yml after "Run unit test" step
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: cover.out
    flags: unittests
    token: ${{ secrets.CODECOV_TOKEN }}
```

### 2. Add Trivy Scanning (1-2 hours)
Add container image scanning to the build workflow:

```yaml
- name: Scan image with Trivy
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.IMAGE_NAME }}:${{ env.IMAGE_TAG }}
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'

- name: Upload Trivy scan results
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: 'trivy-results.sarif'
```

### 3. Enable Dependabot (30 minutes)
Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "gomod"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 4. Update GitHub Actions to v4 (1 hour)
All actions use v2/v3 which rely on deprecated Node.js 16:
- `actions/checkout@v3` → `actions/checkout@v4`
- `docker/setup-qemu-action@v2` → `docker/setup-qemu-action@v3`
- `docker/setup-buildx-action@v2` → `docker/setup-buildx-action@v3`
- `docker/build-push-action@v4` → `docker/build-push-action@v6`
- `docker/login-action@v2` → `docker/login-action@v3`
- `github/codeql-action/*@v2` → `github/codeql-action/*@v3`

## Detailed Findings

### CI/CD Pipeline

**Workflows (3 total):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | PR to main/release-* | Lint (pre-commit) + unit tests in Docker |
| `build.yml` | PR, push, schedule (Mon/Wed), dispatch | Multi-arch Docker build + push |
| `codeql.yml` | Push to main, PR to main, daily schedule | CodeQL SAST for Go |

**Strengths:**
- Scheduled builds ensure periodic validation (Mon/Wed midnight Pacific)
- CodeQL runs on both PRs and pushes + daily schedule
- Test workflow runs inside a Docker "develop" container for reproducibility
- Build uses Docker Buildx with GHA cache (`cache-from: type=gha`)

**Weaknesses:**
- No concurrency control on any workflow (superseded PR builds run to completion)
- All actions use outdated versions (v2/v3, Node.js 16 deprecated)
- No workflow for dependency updates
- Test workflow does not upload coverage artifacts
- No manual dispatch on test workflow
- `paths-ignore: "**.md"` could miss test changes in markdown-documented test scenarios

### Test Coverage

**Test Files:**
| File | Tests | Lines | What It Tests |
|------|-------|-------|---------------|
| `marshaler_test.go` | 4 | 176 | Response marshaling: JSON serialization of protobuf responses, raw output contents, BYTES type with base64 |
| `request_test.go` | 2 | 269 | Request unmarshaling: 1D-4D tensor data, BYTES tensor with various encodings (strings, numeric, base64) |

**Test-to-Code Ratio:**
- Hand-written source: 798 LOC (bytes.go: 211, marshaler.go: 206, request.go: 241, main.go: 140)
- Test code: 445 LOC
- Ratio: 0.56 (acceptable for marshaling-focused tests)

**What's Tested:**
- REST response serialization (protobuf → JSON)
- REST request deserialization (JSON → protobuf)
- Multi-dimensional tensor data flattening (1D through 4D)
- BYTES type handling (strings, numeric arrays, base64 encoding)
- Raw output contents parsing
- Parameter marshaling (string, int64, bool, nil)

**What's NOT Tested:**
- `main.go`: Server startup, TLS config, env var parsing, gRPC dial
- `bytes.go`: Error paths in `splitRawBytes`, `unmarshalNestedNumeric` malformed inputs
- `request.go`: Error paths in `targetArray` (FP16 unsupported), `UnmarshalJSON` failures
- `marshaler.go`: Error paths in `transformResponse`, `elementCount` edge cases
- No benchmarks for performance-critical marshaling code
- No fuzz tests for input validation (JSON parsing)

**Coverage Generation:**
- Makefile `test` target generates `cover.out` via `go test -coverprofile`
- File is never uploaded to Codecov or reported in CI
- No coverage threshold enforcement

### Code Quality

**Linting (golangci-lint):**
- 10 linters enabled: errcheck, gosimple, govet, ineffassign, staticcheck, typecheck, unused, goconst, gofmt, goimports
- Shadow checking enabled in govet
- 5-minute timeout configured
- Test files excluded from gocyclo, errcheck, dupl, gosec
- **Not enabled**: gosec (security), misspell, bodyclose, noctx, gocritic, gocyclo

**Pre-commit Hooks:**
- golangci-lint (excluding gen/ directory)
- prettier (excluding .github/ directory)
- Hooks are cached in Docker develop image for CI reproducibility

**Static Analysis:**
- CodeQL for Go (comprehensive SAST)
- No gosec (Go security linter)
- No semgrep or custom rules

### Container Images

**Dockerfile Quality:**
- **3-stage build**: develop → build → runtime (excellent practice)
- **Multi-arch**: linux/amd64, arm64, ppc64le, s390x via QEMU + Buildx
- **Cross-compilation**: Uses `BUILDPLATFORM` native compiler targeting `TARGETPLATFORM`
- **Minimal runtime**: `ubi9/ubi-micro:9.5` (distroless-equivalent for RHEL)
- **Non-root**: `USER 2000` in runtime stage
- **Layer caching**: go.mod/go.sum copied separately for dependency caching
- **CGO disabled**: `CGO_ENABLED=0` for static binary

**What's Missing:**
- No vulnerability scanning (Trivy, Snyk, Grype)
- No SBOM generation (syft, cyclonedx)
- No image signing (cosign, sigstore)
- No image startup validation test
- No health check endpoint for container readiness testing
- `as runtime` should be `AS runtime` (cosmetic, Docker is case-insensitive)

### Security

**Present:**
- CodeQL SAST scanning (Go, daily + PR)
- Non-root container user
- UBI 9 base images (RHEL-based, security maintained)
- Manual CVE patching in go.mod (`golang.org/x/net` for CVE-2024-45338)
- `CGO_ENABLED=0` eliminates C library attack surface

**Missing:**
- No container image scanning (Trivy/Snyk)
- No dependency scanning automation (Dependabot/Renovate)
- No secret detection (gitleaks/TruffleHog)
- gosec linter disabled in golangci-lint
- No SECURITY.md content analyzed (present but not reviewed here)
- TLS `InsecureSkipVerify` in main.go is configurable but untested

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No test type rules exist
- **Quality**: N/A
- **Gaps**: No CLAUDE.md, no .claude/ directory, no AGENTS.md, no test creation guidance for any test type
- **Recommendation**: Generate comprehensive rules with `/test-rules-generator` covering:
  - Unit test patterns for marshaling/unmarshaling
  - Integration test patterns for gRPC proxy testing
  - Error path testing guidelines
  - Benchmark test creation rules

## Recommendations

### Priority 0 (Critical)

1. **Add integration tests with a mock gRPC server**
   - Use `google.golang.org/grpc/test/bufconn` for in-process gRPC testing
   - Test full REST request → gRPC forward → REST response cycle
   - Cover TLS and non-TLS configurations
   - Effort: 12-16 hours

2. **Add Codecov integration with coverage enforcement**
   - Upload `cover.out` from test workflow
   - Set minimum coverage threshold (start at current coverage, ratchet up)
   - Add PR status check for coverage delta
   - Effort: 2-4 hours

3. **Add Trivy container scanning**
   - Scan the runtime image in the build workflow
   - Upload SARIF results to GitHub Security tab
   - Block on CRITICAL/HIGH vulnerabilities
   - Effort: 2-3 hours

### Priority 1 (High Value)

4. **Write tests for main.go**
   - Test `getIntegerEnv` with valid, invalid, and missing env vars
   - Test `run()` with mock gRPC endpoint
   - Test TLS configuration logic including `InsecureSkipVerify`
   - Effort: 4-6 hours

5. **Enable Dependabot for Go modules and GitHub Actions**
   - Automated weekly dependency update PRs
   - Security advisory awareness
   - Effort: 30 minutes

6. **Add concurrency controls to workflows**
   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: true
   ```
   - Effort: 30 minutes

7. **Update all GitHub Actions to latest versions**
   - v2/v3 → v4 for all actions
   - Required for Node.js 20 compatibility
   - Effort: 1 hour

### Priority 2 (Nice-to-Have)

8. **Create AI agent rules (`.claude/rules/`)**
   - Unit test creation patterns
   - Integration test guidelines
   - Code review checklists
   - Effort: 2-3 hours

9. **Enable gosec in golangci-lint**
   - Currently explicitly disabled; adds Go security analysis
   - Complements CodeQL with Go-specific checks
   - Effort: 1 hour

10. **Add fuzz tests for JSON parsing**
    - `bytes.go` and `request.go` parse untrusted JSON input
    - Go 1.18+ native fuzzing support
    - Effort: 4-6 hours

11. **Add image signing and SBOM**
    - cosign for image signing
    - syft for SBOM generation
    - Effort: 4-6 hours

12. **Add benchmarks for marshaling performance**
    - Critical path code for inference requests
    - Track performance regressions
    - Effort: 2-3 hours

## Comparison to Gold Standards

| Practice | rest-proxy | odh-dashboard | notebooks | kserve |
|----------|-----------|---------------|-----------|--------|
| Unit Tests | Partial (marshaling only) | Comprehensive | N/A | Comprehensive |
| Integration Tests | None | Contract tests | N/A | Multi-version |
| E2E Tests | None | Cypress + Playwright | N/A | Kind-based |
| Coverage Tracking | Generated, not uploaded | Codecov enforced | N/A | Codecov enforced |
| Container Scanning | None | Trivy | Trivy | Trivy |
| Multi-arch | 4 architectures | Limited | 2 architectures | 2 architectures |
| Pre-commit | golangci-lint + prettier | ESLint + prettier | N/A | Yes |
| SAST | CodeQL | CodeQL | N/A | CodeQL |
| Dependency Updates | Manual | Dependabot | Dependabot | Dependabot |
| Agent Rules | None | Comprehensive | None | Partial |
| Image SBOM | None | Yes | Yes | Partial |
| Concurrency Control | None | Yes | Yes | Yes |

## File Paths Reference

### CI/CD
- `.github/workflows/build.yml` - Multi-arch Docker build
- `.github/workflows/test.yml` - Lint + unit tests
- `.github/workflows/codeql.yml` - CodeQL SAST scanning
- `Makefile` - Build/test/format targets

### Source Code
- `proxy/main.go` - Server entry point, TLS config, gRPC registration
- `proxy/marshaler.go` - Custom JSON marshaler for protobuf responses
- `proxy/request.go` - Custom JSON decoder for REST inference requests
- `proxy/bytes.go` - BYTES tensor type marshaling/unmarshaling
- `gen/` - Generated gRPC/protobuf/gateway stubs (3 files, ~2800 LOC)

### Tests
- `proxy/marshaler_test.go` - Response marshaling tests (4 test functions)
- `proxy/request_test.go` - Request unmarshaling tests (2 test functions)

### Container
- `Dockerfile` - 3-stage multi-arch build (develop → build → runtime)
- `.dockerignore` - Build context exclusions

### Code Quality
- `.golangci.yaml` - Linter configuration (10 linters enabled)
- `.pre-commit-config.yaml` - Pre-commit hooks (golangci-lint, prettier)
- `scripts/fmt.sh` - Format/lint runner script
- `scripts/develop.sh` - Docker develop environment runner

### Dependencies
- `go.mod` - Go module definition (Go 1.25, KServe/gRPC/protobuf deps)
- `go.sum` - Dependency checksums
