---
repository: "red-hat-data-services/rest-proxy"
overall_score: 3.9
scorecard:
  - dimension: "Unit Tests"
    score: 5.0
    status: "Decent marshaling tests but missing coverage for main, bytes, and error paths"
  - dimension: "Integration/E2E"
    score: 1.0
    status: "No integration or E2E tests; no gRPC server integration testing"
  - dimension: "Build Integration"
    score: 5.0
    status: "Multi-arch Docker image built on PR but no Konflux simulation"
  - dimension: "Image Testing"
    score: 5.0
    status: "Good multi-stage Dockerfile with UBI base but no runtime validation"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "Generates coverprofile locally but no reporting or threshold enforcement"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "4 workflows with caching and scheduling but outdated actions and no concurrency control"
  - dimension: "Static Analysis"
    score: 5.0
    status: "golangci-lint v2 with pre-commit hooks but no Dependabot and no FIPS build tags"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No integration or E2E tests"
    impact: "REST-to-gRPC proxy behavior untested against real gRPC servers; regressions in protocol translation can ship undetected"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No coverage reporting or enforcement"
    impact: "PRs can reduce coverage with no visibility; coverage regressions go unnoticed"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No Dependabot or Renovate for dependency alerts"
    impact: "Vulnerable dependencies not automatically flagged; go.mod replace blocks already mitigate one CVE manually"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No FIPS build configuration"
    impact: "Binary built with CGO_ENABLED=0 and no boringcrypto; not FIPS-compliant despite using UBI base images"
    severity: "MEDIUM"
    effort: "4-8 hours"
quick_wins:
  - title: "Enable Dependabot for Go module and Docker base image updates"
    effort: "1-2 hours"
    impact: "Automated dependency vulnerability alerts and update PRs"
  - title: "Add Codecov integration to PR workflow"
    effort: "2-3 hours"
    impact: "Coverage visibility on every PR with threshold enforcement"
  - title: "Add concurrency control to CI workflows"
    effort: "30 minutes"
    impact: "Prevent redundant CI runs on rapid PR pushes"
  - title: "Update GitHub Actions to latest versions (checkout@v4, etc.)"
    effort: "1 hour"
    impact: "Security fixes and Node.js 20 compatibility"
  - title: "Create basic CLAUDE.md with test patterns and coding standards"
    effort: "2-3 hours"
    impact: "AI-assisted contributions follow project conventions"
recommendations:
  priority_0:
    - "Add integration tests with a real gRPC inference server (testcontainers or envtest)"
    - "Enable Codecov with coverage thresholds and PR reporting"
    - "Add .github/dependabot.yml for gomod and docker ecosystems"
  priority_1:
    - "Add unit tests for bytes.go, main.go (run(), getIntegerEnv()), and error paths"
    - "Enable FIPS-compliant build with GOEXPERIMENT=boringcrypto or -tags=strictfipsruntime"
    - "Add container health check (HEALTHCHECK) to Dockerfile"
    - "Add concurrency control and update GitHub Actions versions"
  priority_2:
    - "Create CLAUDE.md with test patterns and Go coding standards"
    - "Add t.Parallel() and t.Run() sub-tests for better test isolation"
    - "Add performance/load testing for REST proxy throughput"
---

# Quality Analysis: rest-proxy

## Executive Summary

- **Overall Score: 3.9/10**
- **Repository**: [red-hat-data-services/rest-proxy](https://github.com/red-hat-data-services/rest-proxy)
- **Type**: Go service — REST-to-gRPC proxy for KServe V2 Inference Protocol
- **Tier**: Downstream (RHOAIENG / Model Serving)
- **Primary Language**: Go 1.25
- **Size**: ~800 LOC source, ~445 LOC test (excluding generated code)

### Key Strengths
- Well-structured multi-stage Dockerfile with UBI9 base images and non-root runtime
- Multi-architecture builds (amd64, arm64, ppc64le, s390x) with buildx caching
- Pre-commit hooks with golangci-lint v2 and prettier
- Table-driven tests covering multi-dimensional tensor marshaling

### Critical Gaps
- No integration or E2E tests — proxy behavior against real gRPC servers is untested
- No coverage reporting or enforcement — coverprofile generated but never uploaded
- No Dependabot/Renovate — dependency vulnerabilities managed manually
- No FIPS build configuration despite being a downstream Red Hat component

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 5.0/10 | Decent marshaling tests but missing coverage for main, bytes, error paths |
| Integration/E2E | 20% | 1.0/10 | No integration or E2E tests; no gRPC server integration testing |
| Build Integration | 15% | 5.0/10 | Multi-arch Docker image built on PR but no Konflux simulation |
| Image Testing | 10% | 5.0/10 | Good multi-stage Dockerfile with UBI base but no runtime validation |
| Coverage Tracking | 10% | 3.0/10 | Generates coverprofile locally but no reporting or threshold enforcement |
| CI/CD Automation | 15% | 6.0/10 | 4 workflows with caching and scheduling but outdated actions and no concurrency control |
| Static Analysis | 10% | 5.0/10 | golangci-lint v2 with pre-commit hooks but no Dependabot and no FIPS build tags |
| Agent Rules | 5% | 0.0/10 | No CLAUDE.md, AGENTS.md, or .claude/ directory |
| **Overall** | **100%** | **3.9/10** | |

## Critical Gaps

### 1. No Integration or E2E Tests
- **Severity**: HIGH
- **Impact**: The REST proxy translates between REST JSON and gRPC protobuf for the KServe V2 Inference Protocol. Without integration tests against a real gRPC server, protocol translation bugs, TLS configuration issues, and connection handling problems can ship undetected.
- **Effort**: 8-16 hours
- **Recommendation**: Add integration tests using testcontainers with a mock gRPC inference server that validates the full request/response cycle including TLS, error handling, and multi-model routing.

### 2. No Coverage Reporting or Enforcement
- **Severity**: HIGH
- **Impact**: The `Makefile` generates `cover.out` via `go test -coverprofile`, but it is never uploaded to Codecov or any reporting tool. PRs can decrease coverage with no visibility.
- **Effort**: 2-4 hours
- **Recommendation**: Add `codecov/codecov-action` to the test workflow and create `.codecov.yml` with a minimum threshold (e.g., 60%).

### 3. No Dependency Alert Configuration
- **Severity**: HIGH
- **Impact**: No `.github/dependabot.yml` or Renovate config. The `go.mod` already contains a manual `replace` directive to fix CVE-2024-45338 for `golang.org/x/net`. Without automated alerts, future vulnerabilities require manual discovery.
- **Effort**: 1-2 hours
- **Recommendation**: Add `.github/dependabot.yml` covering `gomod` and `docker` ecosystems.

### 4. No FIPS Build Configuration
- **Severity**: MEDIUM
- **Impact**: Binary is built with `CGO_ENABLED=0` (no cgo) and no `GOEXPERIMENT=boringcrypto` or `-tags=fips`. While UBI9 base images are FIPS-capable and no problematic crypto imports were found, the Go binary itself doesn't use FIPS-validated crypto. The `crypto/tls` usage with configurable `InsecureSkipVerify` adds TLS configuration risk.
- **Effort**: 4-8 hours
- **Recommendation**: Enable `GOEXPERIMENT=boringcrypto` with `CGO_ENABLED=1` in the build stage, or add `-tags=strictfipsruntime` for Go 1.24+ FIPS support.

## Quick Wins

### 1. Enable Dependabot (1-2 hours)
Add `.github/dependabot.yml`:
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

### 2. Add Codecov Integration (2-3 hours)
Add to `.github/workflows/test.yml` after the test step:
```yaml
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: cover.out
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
        target: 70%
```

### 3. Add Concurrency Control (30 minutes)
Add to all PR-triggered workflows:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

### 4. Update GitHub Actions Versions (1 hour)
- `actions/checkout@v3` → `actions/checkout@v4`
- `docker/setup-buildx-action@v2` → `docker/setup-buildx-action@v3`
- `docker/setup-qemu-action@v2` → `docker/setup-qemu-action@v3`
- `docker/login-action@v2` → `docker/login-action@v3`
- `docker/build-push-action@v4` → `docker/build-push-action@v6`
- `github/codeql-action/*@v2` → `github/codeql-action/*@v3`

## Detailed Findings

### Unit Tests

**Test Files**: 2 files (445 lines)
- `proxy/request_test.go` (269 lines) — Tests REST request decoding for 1D, 2D, 3D, 4D tensor shapes and BYTES type with various encoding modes (UTF8 strings, raw byte arrays, base64)
- `proxy/marshaler_test.go` (176 lines) — Tests REST response marshaling including protobuf-to-JSON conversion, BYTES type output, and raw output contents decoding

**Framework**: Go standard `testing` package with `google/go-cmp` for diff comparison and `google.golang.org/protobuf/proto` for protobuf equality checks.

**Test-to-Code Ratio**: 445 test LOC / 800 source LOC = **0.56** (moderate)

**Strengths**:
- Table-driven test data covering multi-dimensional shapes (1D through 4D)
- BYTES tensor tests cover multiple encoding modes (string, raw bytes, base64)
- Tests validate full protobuf message equality, not just individual fields

**Gaps**:
- No tests for `main.go`: `run()`, `getIntegerEnv()`, TLS configuration paths
- No tests for `bytes.go`: `unmarshalBytesJson()`, `unmarshalStringArray()`, `unmarshalNestedNumeric()`, `splitRawBytes()`, `isBase64Content()` — these are only indirectly tested through the request/response tests
- No error path tests (malformed JSON, invalid shapes, unsupported datatypes like FP16)
- No `t.Parallel()` — tests run sequentially
- No `t.Run()` sub-tests — hard to identify which shape/case fails
- `fmt.Println(out)` left in `TestBytesRESTRequest` — debug output in tests

### Integration/E2E Tests

**Status**: Completely absent.

No `e2e/`, `integration/`, or `test/` directories exist. No testcontainers, docker-compose test configurations, or cluster setup (Kind/Minikube/envtest) found.

Given that this is a REST-to-gRPC proxy, integration testing against an actual gRPC inference server is critical for validating:
- End-to-end request/response flow
- TLS termination and pass-through
- gRPC connection management and error propagation
- Large message handling (configurable max message size)
- Multi-model routing via URL paths

### Build Integration

**PR Build Validation**:
- `test.yml`: Builds Docker develop image, runs lint and tests inside container
- `build.yml`: Builds multi-arch runtime image on PR (but does not push)

**Strengths**:
- Docker image is actually built on PR — catches Dockerfile syntax errors and build failures
- Multi-architecture build validation (amd64, arm64, ppc64le, s390x) on every PR
- Build caching with GitHub Actions cache (`type=gha`)

**Gaps**:
- No Konflux build simulation
- No image startup validation (no `docker run` to verify the binary starts)
- No kustomize or manifest validation
- No deployment testing

### Image Testing

**Dockerfile Analysis** (`Dockerfile`):
- **Multi-stage build**: 3 stages (develop → build → runtime) — excellent
- **Base images**: `registry.access.redhat.com/ubi9/go-toolset` (build), `registry.access.redhat.com/ubi9/ubi-micro:9.5` (runtime) — FIPS-capable UBI images
- **Non-root**: `USER 2000` in runtime stage — good security
- **Cross-compilation**: Uses `BUILDPLATFORM` native compiler targeting `TARGETPLATFORM` — efficient multi-arch builds
- **Build cache mounts**: `--mount=type=cache` for go-build and go/pkg — reduces build time

**Gaps**:
- No `HEALTHCHECK` instruction
- No container runtime validation in CI (no `docker run` or testcontainers)
- No K8s manifest with readiness/liveness probes
- No image scanning in PR workflow (out of scope per instructions, but noting no validation occurs)

### Coverage Tracking

**Current State**:
- `Makefile` has `go test -coverprofile cover.out` — generates coverage data
- No `.codecov.yml` or `codecov.yml`
- No `codecov/codecov-action` in any workflow
- No coverage thresholds
- No PR coverage commenting

Coverage is generated locally via `make test` but never uploaded, tracked, or enforced.

### CI/CD Automation

**Workflow Inventory**:

| Workflow | Triggers | Purpose |
|----------|----------|---------|
| `test.yml` | PR (main, release-*) | Build dev image, lint, unit tests |
| `build.yml` | PR, push, schedule (Mon+Thu), dispatch | Multi-arch Docker image build |
| `codeql.yml` | PR (main), push (main), schedule (daily) | Code scanning |
| `create-tag-release.yml` | workflow_dispatch | Tag creation and release notes |

**Strengths**:
- PR-triggered test and build workflows
- Scheduled builds (biweekly) catch dependency drift
- Build caching with `cache-from: type=gha`
- Multi-platform builds with QEMU

**Gaps**:
- No concurrency control on any workflow — redundant runs on rapid PR pushes
- No timeout on test job (`timeout-minutes` not set)
- Outdated action versions (checkout@v3, buildx@v2, etc.)
- No test parallelization (small project, less impactful)
- `build.yml` schedule runs even when no changes — could waste compute

### Static Analysis

#### Linting
- **golangci-lint v2** (`.golangci.yaml`): 6 linters enabled — errcheck, govet, ineffassign, staticcheck, unused, goconst
- **Formatters**: gofmt, goimports configured
- **Exclusions**: Generated code (`gen/`), test-specific linter relaxations (errcheck, gosec)
- **Pre-commit hooks** (`.pre-commit-config.yaml`): golangci-lint + prettier (for non-Go files)

The linting configuration is solid for a small project. The v2 config format is up-to-date.

#### FIPS Compatibility
- **Source code**: No problematic crypto imports (`crypto/md5`, `crypto/des`, `crypto/rc4`, `math/rand`) found
- **`crypto/tls`** usage in `main.go` is standard library — acceptable
- **`InsecureSkipVerify`**: Configurable via `REST_PROXY_SKIP_VERIFY` env var — security concern but intentionally configurable
- **Build**: `CGO_ENABLED=0` with no FIPS build tags — binary uses Go's native (non-FIPS) crypto
- **Base images**: UBI9 — FIPS-capable at OS level, but Go binary doesn't leverage it with CGO disabled
- **No** `GOEXPERIMENT=boringcrypto`, `-tags=fips`, or `-tags=strictfipsruntime`

#### Dependency Alerts
- **No** `.github/dependabot.yml`
- **No** `renovate.json` / `.renovaterc`
- Manual CVE mitigation visible in `go.mod`: `golang.org/x/net => golang.org/x/net v0.33.0` (CVE-2024-45338)

### Agent Rules

**Status**: Completely absent.

- No `CLAUDE.md` or `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` for test creation patterns
- No testing documentation

## Recommendations

### Priority 0 (Critical)

1. **Add integration tests with testcontainers** — Spin up a mock gRPC inference server and validate the full REST-to-gRPC proxy cycle including request transformation, response marshaling, TLS, and error handling.

2. **Enable Codecov with threshold enforcement** — Upload the existing `cover.out` to Codecov, set project target at 60% and patch target at 70% to prevent coverage regressions.

3. **Add Dependabot configuration** — Cover `gomod`, `docker`, and `github-actions` ecosystems. Remove manual `replace` directives in `go.mod` once Dependabot manages updates.

### Priority 1 (High Value)

4. **Expand unit test coverage** — Add tests for `bytes.go` functions (especially `unmarshalBytesJson`, `splitRawBytes`), `main.go` startup logic, and error paths (malformed JSON, FP16 unsupported datatype, invalid shapes).

5. **Enable FIPS-compliant build** — Switch to `CGO_ENABLED=1` with `GOEXPERIMENT=boringcrypto` or use Go 1.24+ `-tags=strictfipsruntime`. This is important for Red Hat downstream compliance.

6. **Add HEALTHCHECK to Dockerfile** — Enable container health monitoring:
   ```dockerfile
   HEALTHCHECK --interval=30s --timeout=3s CMD ["/go/bin/server", "--health"] || exit 1
   ```
   (Requires adding a health endpoint to the proxy.)

7. **Add concurrency control and update actions** — Prevent wasted CI runs and ensure Node.js 20 compatibility.

### Priority 2 (Nice-to-Have)

8. **Create CLAUDE.md** — Document Go testing patterns, marshaling conventions, protobuf code generation workflow, and coding standards. Use `/test-rules-generator` to bootstrap.

9. **Improve test ergonomics** — Add `t.Parallel()` for test isolation, `t.Run()` sub-tests for better failure identification, and remove `fmt.Println` debug output.

10. **Add performance testing** — The proxy handles inference payloads that can be large (configurable up to 16MB default). Load testing for throughput and latency regression would be valuable.

## Comparison to Gold Standards

| Practice | rest-proxy | odh-dashboard | notebooks | kserve |
|----------|-----------|---------------|-----------|--------|
| Unit test ratio | 0.56 | >0.8 | N/A | >0.7 |
| Integration/E2E | None | Cypress + API | Image validation | envtest + E2E |
| Coverage tracking | Local only | Codecov + gates | N/A | Codecov |
| PR build validation | Docker build | Full CI | 5-layer | envtest + build |
| Multi-arch | 4 platforms | N/A | Multi-arch | Multi-arch |
| Pre-commit hooks | Yes | Yes | No | No |
| Dependabot/Renovate | None | Dependabot | Renovate | Dependabot |
| FIPS build | No | N/A | UBI + FIPS | Partial |
| Agent rules | None | Comprehensive | None | Partial |

## File Paths Reference

| Category | File |
|----------|------|
| CI/CD | `.github/workflows/test.yml` |
| CI/CD | `.github/workflows/build.yml` |
| CI/CD | `.github/workflows/codeql.yml` |
| CI/CD | `.github/workflows/create-tag-release.yml` |
| Build | `Makefile` |
| Build | `Dockerfile` |
| Build | `.dockerignore` |
| Source | `proxy/main.go` (140 LOC) |
| Source | `proxy/request.go` (242 LOC) |
| Source | `proxy/marshaler.go` (206 LOC) |
| Source | `proxy/bytes.go` (212 LOC) |
| Tests | `proxy/request_test.go` (269 LOC) |
| Tests | `proxy/marshaler_test.go` (176 LOC) |
| Generated | `gen/grpc_predict_v2.pb.go`, `gen/grpc_predict_v2.pb.gw.go`, `gen/grpc_predict_v2_grpc.pb.go` |
| Static Analysis | `.golangci.yaml` |
| Static Analysis | `.pre-commit-config.yaml` |
| Dependencies | `go.mod`, `go.sum` |
| Proto | `grpc_predict_v2.proto` |
| Scripts | `scripts/fmt.sh`, `scripts/develop.sh` |
