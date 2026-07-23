---
repository: "kserve/rest-proxy"
overall_score: 3.6
scorecard:
  - dimension: "Unit Tests"
    score: 5.0
    status: "Core data transformation logic tested; server startup, TLS, and edge cases untested"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests exist; no testing against a real gRPC backend"
  - dimension: "Build Integration"
    score: 5.0
    status: "PR builds multi-arch Docker images; no Konflux simulation or deployment testing"
  - dimension: "Image Testing"
    score: 5.0
    status: "Multi-stage UBI9 Dockerfile with multi-arch; no runtime validation or HEALTHCHECK"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "Cover profile generated locally but never uploaded, tracked, or enforced"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "PR-triggered build and test workflows with caching; no concurrency control or timeouts"
  - dimension: "Static Analysis"
    score: 6.0
    status: "golangci-lint v2 with pre-commit hooks; no Dependabot or Renovate for dependency alerts"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No integration or E2E tests"
    impact: "REST-to-gRPC translation never tested against a real gRPC backend; protocol mismatches caught only in production"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Test coverage can silently regress; no visibility into what code paths are untested"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No dependency alerting (Dependabot/Renovate)"
    impact: "Vulnerable dependencies require manual monitoring; CVE fixes delayed (repo already has manual go.mod replace for CVE-2024-45338)"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "Missing tests for server startup, TLS configuration, and error handling"
    impact: "Configuration bugs (env var parsing, TLS setup, port binding) not caught before deployment"
    severity: "MEDIUM"
    effort: "8-12 hours"
quick_wins:
  - title: "Enable Dependabot for Go module and Docker base image updates"
    effort: "1-2 hours"
    impact: "Automated security alerts and PRs for vulnerable dependencies; replaces manual go.mod CVE patching"
  - title: "Add Codecov integration to CI"
    effort: "2-4 hours"
    impact: "Visibility into test coverage trends with PR comments and threshold enforcement"
  - title: "Add concurrency control and timeout-minutes to CI workflows"
    effort: "1 hour"
    impact: "Prevents duplicate workflow runs and runaway CI jobs"
  - title: "Create basic CLAUDE.md with test patterns"
    effort: "2-3 hours"
    impact: "Consistent AI-generated test quality for this repo's gRPC-gateway patterns"
recommendations:
  priority_0:
    - "Add integration tests that spin up a mock gRPC server and validate end-to-end REST-to-gRPC translation"
    - "Enable Dependabot for gomod and docker ecosystem dependency alerting"
    - "Integrate Codecov with coverage thresholds to prevent regression"
  priority_1:
    - "Add unit tests for server startup logic (main.go), TLS configuration, and env var parsing"
    - "Add concurrency control, timeout-minutes, and matrix Go version testing to CI workflows"
    - "Create CLAUDE.md or .claude/rules/ with Go test patterns for this codebase"
  priority_2:
    - "Add HEALTHCHECK instruction to runtime Dockerfile stage"
    - "Add container startup validation test in CI"
    - "Update GitHub Actions to latest versions (checkout@v3 -> v4, etc.)"
---

# Quality Analysis: kserve/rest-proxy

## Executive Summary

- **Overall Score: 3.6/10**
- **Repository Type**: Go REST proxy service (REST-to-gRPC gateway for KServe V2 inference protocol)
- **Primary Language**: Go 1.25
- **RHOAI Component**: Model Serving (RHOAIENG)
- **Tier**: Upstream

**Key Strengths**: Core data transformation logic (tensor marshaling/unmarshaling) has reasonable unit test coverage. Multi-arch Docker builds on PRs with UBI9 base images and GHA build caching. golangci-lint v2 with pre-commit hooks enforced in CI.

**Critical Gaps**: Complete absence of integration/E2E tests means the REST-to-gRPC translation is never validated against a real gRPC backend. No coverage tracking, threshold enforcement, or dependency alerting. No agent rules for AI-assisted development.

**Agent Rules Status**: Missing - No CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 5.0/10 | Core tensor logic tested; server/TLS/error paths untested |
| Integration/E2E | 20% | 0.0/10 | No integration or E2E tests |
| Build Integration | 15% | 5.0/10 | PR multi-arch Docker builds; no Konflux simulation |
| Image Testing | 10% | 5.0/10 | Multi-stage UBI9 + multi-arch; no runtime validation |
| Coverage Tracking | 10% | 2.0/10 | Local coverprofile only; no CI integration |
| CI/CD Automation | 15% | 5.0/10 | PR build+test with caching; no concurrency/timeouts |
| Static Analysis | 10% | 6.0/10 | golangci-lint v2 + pre-commit; no Dependabot |
| Agent Rules | 5% | 0.0/10 | Completely absent |

## Critical Gaps

### 1. No Integration or E2E Tests
- **Impact**: The REST proxy's core purpose - translating REST requests to gRPC and gRPC responses back to REST - is never tested end-to-end. Protocol mismatches, connection issues, and TLS problems are only discovered in production.
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: Unit tests validate JSON parsing and protobuf serialization in isolation but never test the actual HTTP-to-gRPC reverse proxy flow. A mock gRPC inference server should be created to validate the full request/response lifecycle.

### 2. No Coverage Tracking or Enforcement
- **Impact**: Test coverage can silently decrease with each PR. The `--coverprofile cover.out` in `make test` generates a file locally but it's never uploaded, analyzed, or used as a quality gate.
- **Severity**: HIGH
- **Effort**: 2-4 hours

### 3. No Dependency Alerting
- **Impact**: The repository already has evidence of manual CVE patching (`go.mod` contains a `replace` directive for CVE-2024-45338). Without Dependabot or Renovate, vulnerable dependencies require manual monitoring and intervention.
- **Severity**: HIGH
- **Effort**: 1-2 hours

### 4. Missing Server Startup and Configuration Tests
- **Impact**: `main.go` contains TLS configuration, environment variable parsing, gRPC connection setup, and port binding logic that is completely untested. Configuration errors are only caught at runtime.
- **Severity**: MEDIUM
- **Effort**: 8-12 hours

## Quick Wins

### 1. Enable Dependabot (1-2 hours)
Create `.github/dependabot.yml` to automatically receive PRs for vulnerable Go modules and Docker base images:
```yaml
version: 2
updates:
  - package-ecosystem: "gomod"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 2. Add Codecov Integration (2-4 hours)
Add to `.github/workflows/test.yml` after the test step:
```yaml
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    file: cover.out
    fail_ci_if_error: true
```
Create `.codecov.yml`:
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

### 3. Add CI Concurrency Control (1 hour)
Add to both `build.yml` and `test.yml`:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```
Add `timeout-minutes: 15` to each job.

### 4. Create Basic Agent Rules (2-3 hours)
Create `CLAUDE.md` or `.claude/rules/` with Go testing patterns specific to this repo's gRPC-gateway architecture.

## Detailed Findings

### Unit Tests

**Test Files Found**:
- `proxy/request_test.go` - 2 test functions covering REST request decoding
  - `TestRESTRequest`: Tests 1D, 2D, 3D, and 4D tensor data parsing with FP32 datatype
  - `TestBytesRESTRequest`: Tests BYTES tensor handling including string arrays, byte arrays, base64, and nested shapes (6 test cases via table-driven pattern)
- `proxy/marshaler_test.go` - 4 test functions covering REST response marshaling
  - `TestRESTResponse`: Tests INT64 tensor response serialization
  - `TestBytesRESTResponse`: Tests BYTES tensor response with base64 encoding
  - `TestBytesRESTResponseRawOutput`: Tests raw output content bytes handling
  - `TestRESTResponseRawOutput`: Tests raw INT64 output content

**Source Files** (4 files, ~550 lines):
- `proxy/request.go` - REST request decoding and gRPC transformation
- `proxy/marshaler.go` - gRPC response to REST JSON marshaling
- `proxy/main.go` - Server entry point, TLS config, env parsing
- `proxy/bytes.go` - BYTES tensor type handling (JSON string/byte parsing)

**Test-to-Code Ratio**: 2 test files / 4 source files = 50%

**Strengths**:
- Core tensor marshaling/unmarshaling thoroughly tested for multiple datatypes and dimensions
- BYTES type edge cases covered (string arrays, byte arrays, base64, nested shapes)
- Uses `google/go-cmp` for clean diff output on failures
- Table-driven tests for BYTES tensor cases

**Gaps**:
- No tests for `main.go` (server startup, TLS config, env var parsing, gRPC connection setup)
- No tests for error paths in `bytes.go` (invalid JSON, malformed base64, shape mismatches)
- No `t.Parallel()` for test parallelization
- No tests for `isBase64Content()`, `splitRawBytes()`, or `elementCount()` in isolation
- No fuzz tests for the JSON parsing logic

### Integration/E2E Tests

**Status**: Completely absent.

No integration test infrastructure exists. The repository does not contain:
- `e2e/`, `integration/`, `test/e2e/`, or `tests/integration/` directories
- Any cluster setup (Kind, Minikube, envtest)
- Any mock gRPC server for end-to-end testing
- Any testcontainers or docker-compose test configuration
- Any multi-version testing

**Gap Analysis**: For a REST-to-gRPC proxy, integration tests are critical. The unit tests validate JSON-to-protobuf translation in isolation, but the actual reverse proxy behavior (HTTP request -> gRPC call -> HTTP response) is never validated. Key untested scenarios:
- Full HTTP request through the proxy to a gRPC backend and back
- Connection handling (timeouts, retries, connection pooling)
- TLS termination and forwarding
- Large payload handling (maxGrpcMessageSizeBytes enforcement)
- Error propagation from gRPC errors to HTTP status codes
- Concurrent request handling

### Build Integration

**PR Build Validation**:
- `build.yml` triggers on PRs to `main` and `release-*` branches
- Builds multi-arch Docker image (amd64, arm64, ppc64le, s390x) using Buildx
- Uses `docker/build-push-action@v4` with `push: false` on PRs (build-only validation)
- GHA cache for Docker layer caching (`cache-from: type=gha`)

**Makefile Build Targets**:
- `make build` - Build runtime container image
- `make build.develop` - Build developer container image
- `make test` - Run Go tests with coverage
- `make all` - generate + build + test

**Missing**:
- No Konflux build simulation
- No operator manifest validation (N/A for this repo type)
- No image startup/smoke test after build
- No deployment testing (Kind/Minikube)

### Image Testing

**Dockerfile Analysis** (`Dockerfile`):
- **Multi-stage build**: 3 stages (develop -> build -> runtime)
  - Stage 1 (`develop`): UBI9/go-toolset with protoc, pre-commit, dev tools
  - Stage 2 (`build`): Cross-compiles Go binary for target platform
  - Stage 3 (`runtime`): UBI9/ubi-micro minimal runtime image
- **Base Images**: `registry.access.redhat.com/ubi9/go-toolset` (build), `registry.access.redhat.com/ubi9/ubi-micro:9.5` (runtime) - FIPS-capable
- **Non-root user**: `USER 2000`
- **Static binary**: `CGO_ENABLED=0`
- **Multi-arch**: linux/amd64, linux/arm64, linux/ppc64le, linux/s390x via `--platform=$BUILDPLATFORM` cross-compilation
- **Build caching**: `--mount=type=cache` for go-build and go/pkg caches
- **Dependency caching**: `go mod download` before source copy
- `.dockerignore`: Present

**Missing**:
- No `HEALTHCHECK` instruction in runtime stage
- No container runtime validation (testcontainers, image startup test)
- No K8s readiness/liveness probe definitions (repo contains no K8s manifests; probes defined in modelmesh-serving)

### Coverage Tracking

**Current State**:
- `make test` runs `go test -coverprofile cover.out` - generates coverage file locally
- CI runs `make test` via `./scripts/develop.sh make test` inside dev container
- Coverage file is generated inside the container but never extracted or uploaded

**Missing**:
- No `.codecov.yml` or `codecov.yml`
- No `codecov/codecov-action` in CI workflows
- No coverage threshold enforcement
- No PR coverage comments or reports
- No coverage badges or trend tracking

### CI/CD Automation

**Workflow Inventory**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build.yml` | PR, push, schedule (Mon/Thu), dispatch | Build multi-arch Docker image |
| `test.yml` | PR | Run lint + unit tests |
| `codeql.yml` | (out of scope) | Code analysis |
| `create-tag-release.yml` | Manual dispatch | Tag creation and release notes |

**Strengths**:
- PR-triggered build and test workflows
- Scheduled builds (biweekly: Monday and Thursday at 08:00 UTC)
- Build caching with GitHub Actions cache
- Separate workflows for build and test (proper separation of concerns)
- Release workflow with automated changelog generation

**Gaps**:
- No `concurrency:` key - duplicate PR workflow runs possible
- No `timeout-minutes:` - workflows can hang indefinitely
- No matrix strategy for Go versions
- Old action versions: `actions/checkout@v3`, `docker/setup-qemu-action@v2`, `docker/build-push-action@v4`
- Test workflow builds dev image but doesn't cache it
- No test result reporting (junit XML, etc.)

### Static Analysis

#### Linting
- **golangci-lint v2**: `.golangci.yaml` with comprehensive configuration
  - Enabled linters: errcheck, govet, ineffassign, staticcheck, unused, goconst
  - Formatters: gofmt, goimports
  - Generated code (`gen/`) excluded from linting
  - Test-specific exclusions for gocyclo, errcheck, dupl, gosec
  - govet with all checks enabled (except fieldalignment)
- **Pre-commit hooks**: `.pre-commit-config.yaml`
  - golangci-lint hook (latest v2.8.0)
  - prettier hook for non-Go files
- **CI enforcement**: `test.yml` runs `./scripts/develop.sh make fmt` (pre-commit on all files)

#### FIPS Compatibility
- **Source code**: Clean - no non-FIPS-compliant crypto imports found (no crypto/md5, crypto/des, crypto/rc4, math/rand)
- **Base images**: UBI9 (FIPS-capable)
- **Build**: CGO_ENABLED=0 (static binary, no BoringCrypto); the proxy itself doesn't perform crypto operations - TLS is handled by standard library
- **Missing**: No FIPS build tags or GOEXPERIMENT=boringcrypto (may not be needed given proxy doesn't do direct crypto)

#### Dependency Alerts
- **Dependabot**: Not configured (no `.github/dependabot.yml`)
- **Renovate**: Not configured (no `renovate.json`, `.renovaterc`)
- **Evidence of manual CVE patching**: `go.mod` contains `replace golang.org/x/net => golang.org/x/net v0.33.0` with comment "Fixes CVE-2024-45338"
- **Risk**: Without automated alerting, the team must manually monitor for new CVEs

### Agent Rules

**Status**: Completely absent.

- No `CLAUDE.md` or `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` with test creation rules
- No `.claude/skills/` with custom skills
- No testing documentation or guidelines

**Impact**: AI-assisted development has no guidance on:
- Go test patterns for gRPC-gateway proxies
- Protobuf test data generation patterns
- Integration test setup for the REST-to-gRPC translation flow
- Error handling conventions

**Recommendation**: Generate agent rules with `/test-rules-generator` skill.

## Recommendations

### Priority 0 (Critical)
1. **Add integration tests with a mock gRPC inference server** - Create a test gRPC server implementing the KServe V2 inference protocol and validate the full REST-to-gRPC proxy flow including request translation, response marshaling, error handling, TLS, and large payloads.
2. **Enable Dependabot** - Add `.github/dependabot.yml` covering gomod, docker, and github-actions ecosystems to replace manual CVE patching.
3. **Integrate Codecov** - Upload coverage from CI, set project target (60%) and patch target (80%), add PR comments.

### Priority 1 (High Value)
1. **Add unit tests for `main.go`** - Test environment variable parsing, TLS configuration, gRPC connection setup, and error handling.
2. **Add CI concurrency control and timeouts** - Add `concurrency:` and `timeout-minutes:` to prevent duplicate runs and hanging jobs.
3. **Create agent rules** - Add `CLAUDE.md` or `.claude/rules/` with Go test patterns specific to this repo's gRPC-gateway architecture.
4. **Update GitHub Actions versions** - Upgrade to latest actions/checkout@v4, docker/setup-qemu-action@v3, etc.

### Priority 2 (Nice-to-Have)
1. **Add HEALTHCHECK to Dockerfile** - Add health check instruction for container orchestration platforms.
2. **Add container startup validation** - Test that the built image starts and responds to health checks.
3. **Add Go version matrix testing** - Test against multiple Go versions for forward compatibility.
4. **Add fuzz tests for JSON parsing** - The tensor data unmarshaling logic handles complex nested JSON; fuzz testing could find edge cases.

## Comparison to Gold Standards

| Practice | rest-proxy | odh-dashboard | notebooks | kserve |
|----------|-----------|---------------|-----------|--------|
| Unit test coverage | Partial (core logic) | Comprehensive | N/A | Comprehensive |
| Integration/E2E tests | None | Multi-layer | Image testing | gRPC + REST E2E |
| Coverage tracking | Local only | Codecov enforced | Codecov | Codecov enforced |
| PR build validation | Multi-arch Docker | Docker + Konflux | Multi-arch + validation | Docker + E2E |
| Dependency alerting | None | Dependabot | Dependabot | Dependabot |
| Pre-commit hooks | golangci-lint + prettier | ESLint + prettier | Various | golangci-lint |
| Agent rules | None | Comprehensive | Basic | None |
| FIPS compliance | Clean (no crypto) | N/A | Image-level | Build tags |
| Multi-arch support | 4 architectures | N/A | Multi-arch | Multi-arch |

## File Paths Reference

### CI/CD
- `.github/workflows/build.yml` - Multi-arch Docker build (PR + push + schedule)
- `.github/workflows/test.yml` - Lint + unit tests (PR)
- `.github/workflows/create-tag-release.yml` - Release management (manual)

### Testing
- `proxy/request_test.go` - REST request decoding tests
- `proxy/marshaler_test.go` - REST response marshaling tests

### Source Code
- `proxy/main.go` - Server entry point, TLS, gRPC connection
- `proxy/request.go` - REST-to-gRPC request transformation
- `proxy/marshaler.go` - gRPC-to-REST response transformation
- `proxy/bytes.go` - BYTES tensor type handling

### Build & Container
- `Dockerfile` - Multi-stage build (develop -> build -> runtime)
- `Makefile` - Build, test, generate targets
- `.dockerignore` - Docker build context exclusions

### Code Quality
- `.golangci.yaml` - golangci-lint v2 configuration
- `.pre-commit-config.yaml` - Pre-commit hooks (golangci-lint, prettier)
- `scripts/fmt.sh` - Lint runner script

### Configuration
- `go.mod` - Go module definition with CVE replace directives
- `grpc_predict_v2.proto` - KServe V2 gRPC protocol definition
