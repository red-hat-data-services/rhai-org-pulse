---
repository: "opendatahub-io/rest-proxy"
overall_score: 3.4
scorecard:
  - dimension: "Unit Tests"
    score: 5.0
    status: "Tests cover core marshaling logic but only 2 of 4 source files tested; no coverage for bytes.go or main.go"
  - dimension: "Integration/E2E"
    score: 1.0
    status: "No integration or E2E tests; core gRPC-to-REST proxy function untested end-to-end"
  - dimension: "Build Integration"
    score: 4.0
    status: "PR builds dev Docker image and runs tests inside it; no Konflux simulation or runtime validation"
  - dimension: "Image Testing"
    score: 3.0
    status: "Multi-arch builds with UBI9 base; no vulnerability scanning, SBOM, or runtime validation"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "Coverage profile generated locally via Makefile but not uploaded or tracked; no thresholds"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "4 workflows covering test/build/security/release with GHA caching; outdated action versions"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules for test creation"
critical_gaps:
  - title: "No integration or E2E tests for the gRPC-to-REST proxy"
    impact: "Core proxy functionality (HTTP-to-gRPC translation, TLS, error handling) is completely untested in a realistic environment"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No container vulnerability scanning"
    impact: "Security vulnerabilities in base images and dependencies go undetected until production"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Test coverage can silently regress; no visibility into untested code paths"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No tests for main.go (server startup, TLS, env var parsing)"
    impact: "Configuration errors, TLS misconfigurations, and startup failures not caught until deployment"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "Outdated GitHub Action versions (v2/v3)"
    impact: "Missing security patches and features; Node.js 16 deprecation warnings"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add Trivy scanning to PR and push workflows"
    effort: "1-2 hours"
    impact: "Early detection of CVEs in base images and dependencies"
  - title: "Integrate codecov for coverage tracking"
    effort: "2-3 hours"
    impact: "Visibility into test coverage with PR comments and enforcement thresholds"
  - title: "Update GitHub Action versions to latest (v4)"
    effort: "1 hour"
    impact: "Fix Node.js deprecation warnings and get latest security patches"
  - title: "Add concurrency control to CI workflows"
    effort: "30 minutes"
    impact: "Cancel stale PR runs to save CI resources"
  - title: "Add Dependabot or Renovate for dependency updates"
    effort: "1 hour"
    impact: "Automated PRs for dependency security updates"
recommendations:
  priority_0:
    - "Add integration tests that start the REST proxy against a mock gRPC server and validate end-to-end request/response flow"
    - "Add container vulnerability scanning (Trivy) to PR and push workflows"
    - "Integrate codecov with coverage thresholds to prevent regression"
  priority_1:
    - "Add unit tests for main.go (env var parsing, TLS configuration, server startup)"
    - "Add unit tests for bytes.go (splitRawBytes, unmarshalBytesJson edge cases)"
    - "Create agent rules for test creation patterns (.claude/rules/)"
    - "Update all GitHub Action versions to v4"
  priority_2:
    - "Add SBOM generation for container images"
    - "Add image signing/attestation (cosign)"
    - "Add performance/load testing for proxy throughput"
    - "Add Dependabot configuration for automated dependency updates"
---

# Quality Analysis: rest-proxy

## Executive Summary

- **Overall Score: 3.4/10**
- **Repository Type**: Go gRPC-to-REST reverse proxy for KServe inference protocol
- **Primary Language**: Go (800 lines hand-written source, 2,774 lines generated protobuf code)
- **Key Strengths**: Well-structured multi-stage Dockerfile, multi-arch builds (4 platforms), CodeQL SAST scanning, pre-commit hooks with golangci-lint
- **Critical Gaps**: No integration/E2E tests, no container scanning, no coverage tracking, 2 of 4 source files untested
- **Agent Rules Status**: Missing - No CLAUDE.md, no .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 5/10 | Core marshaling logic tested; bytes.go and main.go untested |
| Integration/E2E | **1/10** | **No integration or E2E tests at all** |
| **Build Integration** | **4/10** | **PR builds dev image; no Konflux simulation** |
| Image Testing | 3/10 | Multi-arch builds; no runtime validation or scanning |
| Coverage Tracking | 2/10 | Cover profile generated but not tracked or enforced |
| CI/CD Automation | 6/10 | 4 workflows with caching; outdated action versions |
| Agent Rules | 0/10 | No agent rules exist |

## Critical Gaps

### 1. No Integration or E2E Tests
- **Impact**: The proxy's core function (translating REST HTTP requests to gRPC protobuf) is never tested end-to-end. TLS handling, server startup, graceful shutdown, and error responses are completely untested.
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **What's Missing**: A test that starts the proxy, sends HTTP requests, and validates gRPC forwarding with a mock backend server.

### 2. No Container Vulnerability Scanning
- **Impact**: The runtime image (`ubi9/ubi-micro:9.5`) and Go dependencies are never scanned for CVEs. The team relies on manual `go.mod replace` directives (e.g., CVE-2024-45338 fix) rather than automated scanning.
- **Severity**: HIGH
- **Effort**: 2-4 hours

### 3. No Coverage Tracking or Enforcement
- **Impact**: The Makefile generates `cover.out` but it's never uploaded to codecov or any tracking service. Coverage can regress silently.
- **Severity**: HIGH
- **Effort**: 2-4 hours

### 4. Untested Source Files
- **Impact**: `proxy/main.go` (server startup, TLS config, env var parsing) and `proxy/bytes.go` (raw bytes splitting, BYTES tensor handling) have zero test coverage. These contain security-sensitive code (TLS config with `InsecureSkipVerify`).
- **Severity**: HIGH
- **Effort**: 8-12 hours

### 5. Outdated GitHub Action Versions
- **Impact**: Using `actions/checkout@v3`, `docker/setup-buildx-action@v2`, `docker/build-push-action@v4`, `github/codeql-action/init@v2`. These are 1-2 major versions behind, missing security patches and triggering Node.js 16 deprecation warnings.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours

## Quick Wins

### 1. Add Trivy Scanning (1-2 hours)
Add container image scanning to the build workflow:
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@0.28.0
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

### 2. Integrate Codecov (2-3 hours)
Upload the existing coverage profile to codecov:
```yaml
- name: Run tests with coverage
  run: ./scripts/develop.sh make test

- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: cover.out
    fail_ci_if_error: true
```

Add `.codecov.yml`:
```yaml
coverage:
  status:
    project:
      default:
        target: 60%
    patch:
      default:
        target: 80%
```

### 3. Update Action Versions (1 hour)
Update all workflow files to use latest action versions:
- `actions/checkout@v3` -> `actions/checkout@v4`
- `docker/setup-buildx-action@v2` -> `docker/setup-buildx-action@v3`
- `docker/build-push-action@v4` -> `docker/build-push-action@v6`
- `docker/login-action@v2` -> `docker/login-action@v3`
- `docker/setup-qemu-action@v2` -> `docker/setup-qemu-action@v3`
- `github/codeql-action/*@v2` -> `github/codeql-action/*@v3`

### 4. Add Concurrency Control (30 minutes)
Add to both `test.yml` and `build.yml`:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref || github.ref }}
  cancel-in-progress: true
```

### 5. Add Dependabot (1 hour)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: gomod
    directory: /
    schedule:
      interval: weekly
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
  - package-ecosystem: docker
    directory: /
    schedule:
      interval: weekly
```

## Detailed Findings

### CI/CD Pipeline

**Workflows (4 total):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | PR to main/release branches | Build dev image, lint, unit tests |
| `build.yml` | PR, push, schedule, dispatch | Multi-arch Docker build and push |
| `codeql.yml` | PR, push to main, daily schedule | CodeQL SAST analysis for Go |
| `create-tag-release.yml` | Manual dispatch | Tag creation and changelog generation |

**Strengths:**
- Tests run inside Docker dev container ensuring consistent environment
- Multi-architecture builds (amd64, arm64, ppc64le, s390x) with QEMU
- GHA build cache (`cache-from: type=gha`, `cache-to: type=gha,mode=max`)
- CodeQL scanning on PRs with daily scheduled scans
- Clean separation of test and build workflows

**Weaknesses:**
- No concurrency control (stale PR runs waste resources)
- Outdated action versions (v2/v3 instead of v4)
- No test result reporting (JUnit XML, etc.)
- No artifact upload for coverage reports
- Build workflow has no image startup validation

### Test Coverage

**Test Files (2 files, 445 lines):**

| File | Lines | Tests | What's Covered |
|------|-------|-------|----------------|
| `proxy/request_test.go` | 269 | 2 test functions | REST request decoding (1D-4D tensors, BYTES type) |
| `proxy/marshaler_test.go` | 176 | 4 test functions | REST response marshaling, raw output, BYTES encoding |

**Untested Files:**

| File | Lines | What's Missing |
|------|-------|----------------|
| `proxy/main.go` | 140 | Server startup, TLS config, env var parsing, gRPC registration |
| `proxy/bytes.go` | 212 | `unmarshalBytesJson`, `unmarshalStringArray`, `splitRawBytes`, `isBase64Content` edge cases |

**Test Quality:**
- Good use of table-driven tests for BYTES tensor cases
- Tests validate protobuf serialization round-trips
- Uses `google.golang.org/protobuf/proto.Equal` for proto message comparison
- Uses `github.com/google/go-cmp` for diff reporting
- Tests run via `go test -coverprofile cover.out`

**Test-to-Code Ratio**: 445 test lines / 800 source lines = **0.56** (only counting hand-written code)

**Missing Test Categories:**
- No integration tests (HTTP handler testing)
- No E2E tests (proxy with mock gRPC backend)
- No TLS/mTLS tests
- No error path tests (malformed requests, gRPC failures)
- No benchmark tests for proxy throughput
- No fuzz tests for JSON parsing

### Code Quality

**Linting (golangci-lint v2):**
- 6 linters enabled: errcheck, govet, ineffassign, staticcheck, unused, goconst
- Formatters: gofmt, goimports
- Test exclusions: gocyclo, errcheck, dupl, gosec excluded from test files
- Generated code (`gen/`) properly excluded
- Configuration is well-structured and uses v2 format

**Pre-commit Hooks:**
- golangci-lint runs on all non-generated files
- Prettier runs on non-GitHub workflow files
- CI runs pre-commit inside Docker dev container

**Static Analysis:**
- CodeQL for Go (security-focused SAST)
- No gosec enabled in golangci-lint
- No additional SAST tools

**Missing:**
- No secret detection (gitleaks, trufflehog)
- gosec linter not enabled (excluded from test files but not enabled at all)

### Container Images

**Dockerfile Analysis:**
- **3-stage build**: develop (tooling) -> build (compile) -> runtime (minimal)
- **Base images**: `registry.access.redhat.com/ubi9/go-toolset:$GOLANG_VERSION` (build), `registry.access.redhat.com/ubi9/ubi-micro:9.5` (runtime)
- **Multi-arch**: linux/amd64, linux/arm64, linux/ppc64le, linux/s390x via QEMU
- **Non-root user**: Runtime image uses `USER 2000`
- **Minimal runtime**: ubi-micro with only the compiled binary
- **Build optimization**: Go module download cached, CGO disabled, build cache mounts

**Strengths:**
- Excellent multi-stage build with minimal runtime image
- Proper cross-compilation using `BUILDPLATFORM`/`TARGETPLATFORM`
- Build cache mounts for Go build and pkg caches
- Non-root user in runtime image
- UBI9 (Red Hat Universal Base Image) for compliance

**Weaknesses:**
- No vulnerability scanning (Trivy, Snyk, Grype)
- No SBOM generation
- No image signing (cosign)
- No runtime validation (healthcheck, smoke test)
- No `.dockerignore` optimization (file exists but not reviewed for completeness)
- Hardcoded Go version in Dockerfile rather than CI matrix

### Security

**Present:**
- CodeQL SAST scanning (Go) on PRs and daily schedule
- CVE mitigation via `go.mod replace` directives (CVE-2024-45338 patched)
- Non-root container runtime user
- UBI9 base images (FIPS-validated crypto, Red Hat security updates)

**Missing:**
- No container vulnerability scanning (Trivy, Snyk, Grype)
- No dependency scanning automation (Dependabot, Renovate)
- No secret detection (gitleaks, trufflehog)
- No SBOM generation or attestation
- No image signing (cosign/sigstore)
- gosec not enabled in golangci-lint despite being referenced in exclusion rules
- TLS configuration in `main.go` uses `InsecureSkipVerify` option (configurable, but no test validates secure default)

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None - no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: No test automation guidance for AI agents. No patterns documented for:
  - Unit test creation for Go protobuf/gRPC proxies
  - Integration test patterns with mock gRPC servers
  - Test data generation for tensor payloads
  - Coverage requirements and enforcement
- **Recommendation**: Generate test creation rules with `/test-rules-generator` to establish patterns for unit tests, integration tests, and protobuf test data

## Recommendations

### Priority 0 (Critical)

1. **Add integration tests for the REST proxy** (16-24 hours)
   - Create a test that starts the HTTP server with a mock gRPC backend
   - Validate REST-to-gRPC translation for all tensor types
   - Test TLS configuration, error handling, and edge cases
   - Test env var configuration (ports, max message size, TLS options)

2. **Add container vulnerability scanning** (2-4 hours)
   - Integrate Trivy into the build workflow
   - Upload SARIF results to GitHub Security tab
   - Set severity thresholds (fail on CRITICAL)

3. **Integrate codecov for coverage tracking** (2-4 hours)
   - Upload existing `cover.out` to codecov
   - Set project target (60%) and patch target (80%)
   - Add PR coverage comments

### Priority 1 (High Value)

4. **Add unit tests for main.go and bytes.go** (8-12 hours)
   - Test `getIntegerEnv` with valid/invalid/missing env vars
   - Test TLS configuration logic
   - Test `splitRawBytes` with edge cases
   - Test `unmarshalBytesJson` with malformed input
   - Test `isBase64Content` parameter parsing

5. **Update GitHub Action versions** (1-2 hours)
   - Update all actions to latest major versions
   - Fix Node.js 16 deprecation warnings

6. **Create agent rules** (2-3 hours)
   - Add `.claude/rules/unit-tests.md` with Go testing patterns
   - Add `.claude/rules/integration-tests.md` with gRPC proxy test patterns
   - Document test data generation for tensor payloads

7. **Add concurrency control and Dependabot** (1-2 hours)
   - Cancel stale CI runs on updated PRs
   - Automated dependency update PRs

### Priority 2 (Nice-to-Have)

8. **Add SBOM generation** (2-4 hours)
   - Generate SPDX/CycloneDX SBOM during image build
   - Attach to release artifacts

9. **Add benchmark tests** (4-8 hours)
   - Benchmark JSON-to-protobuf marshaling throughput
   - Track regression across releases

10. **Add fuzz testing** (4-8 hours)
    - Fuzz `UnmarshalJSON` for `InputTensor`
    - Fuzz `unmarshalBytesJson` for edge cases
    - Go native fuzzing support (`testing.F`)

11. **Enable gosec linter** (1-2 hours)
    - Already referenced in golangci-lint exclusion rules
    - Enable for non-test files to catch security issues

## Comparison to Gold Standards

| Dimension | rest-proxy | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | 5/10 | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 1/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 4/10 | 8/10 | 7/10 | 8/10 |
| Image Testing | 3/10 | 7/10 | 9/10 | 7/10 |
| Coverage Tracking | 2/10 | 8/10 | 5/10 | 9/10 |
| CI/CD Automation | 6/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 0/10 | 8/10 | 3/10 | 4/10 |
| **Overall** | **3.4/10** | **8.5/10** | **7.0/10** | **8.2/10** |

### Key Gaps vs Gold Standards

- **odh-dashboard**: Has multi-layer testing (unit, integration, contract, E2E), codecov enforcement, comprehensive CI/CD with concurrency control, and detailed agent rules
- **notebooks**: 5-layer image validation, multi-arch testing with runtime smoke tests, Trivy scanning
- **kserve**: Coverage enforcement (codecov thresholds), multi-version K8s testing, comprehensive operator E2E tests

## File Paths Reference

| Category | File | Purpose |
|----------|------|---------|
| CI/CD | `.github/workflows/test.yml` | PR test workflow (lint + unit tests) |
| CI/CD | `.github/workflows/build.yml` | Multi-arch Docker build and push |
| CI/CD | `.github/workflows/codeql.yml` | CodeQL SAST scanning |
| CI/CD | `.github/workflows/create-tag-release.yml` | Manual tag and release |
| Source | `proxy/main.go` | HTTP server, gRPC registration, TLS config |
| Source | `proxy/request.go` | REST request JSON-to-protobuf decoding |
| Source | `proxy/marshaler.go` | REST response protobuf-to-JSON encoding |
| Source | `proxy/bytes.go` | BYTES tensor data handling |
| Tests | `proxy/request_test.go` | Request decoding tests (1D-4D, BYTES) |
| Tests | `proxy/marshaler_test.go` | Response marshaling tests |
| Generated | `gen/grpc_predict_v2*.go` | Generated protobuf/gRPC gateway code |
| Config | `.golangci.yaml` | Linter configuration (6 linters + formatters) |
| Config | `.pre-commit-config.yaml` | Pre-commit hooks (golangci-lint, prettier) |
| Build | `Dockerfile` | 3-stage multi-arch build |
| Build | `Makefile` | Build, test, format targets |
| Build | `go.mod` | Go module with CVE-2024-45338 fix |
| Proto | `grpc_predict_v2.proto` | KServe gRPC inference protocol definition |
