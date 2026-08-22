---
repository: "opendatahub-io/rest-proxy"
overall_score: 3.9
scorecard:
  - dimension: "Unit Tests"
    score: 5.0
    status: "Core marshaling logic tested, but missing coverage for main.go, bytes.go, and error paths"
  - dimension: "Integration/E2E"
    score: 1.0
    status: "No integration or E2E tests — no gRPC server testing, no cluster-based validation"
  - dimension: "Build Integration"
    score: 6.0
    status: "PR builds Docker image with multi-arch support, but no Konflux simulation or runtime validation"
  - dimension: "Image Testing"
    score: 5.0
    status: "Good multi-stage Dockerfile with UBI base, but no runtime testing or health checks"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "Cover profile generated locally but not reported, tracked, or enforced"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "Test and build workflows on PRs, but missing concurrency control, timeouts, and modern actions"
  - dimension: "Static Analysis"
    score: 6.0
    status: "golangci-lint v2 with pre-commit hooks, but no Dependabot/Renovate for dependency alerts"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory — zero AI agent guidance"
critical_gaps:
  - title: "No integration or E2E tests"
    impact: "gRPC-to-REST proxy translation is never validated end-to-end; regressions in protocol handling go undetected until production"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Coverage profile is generated but never uploaded or gated — PRs can silently reduce coverage"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No dependency alert configuration"
    impact: "Vulnerable dependencies (e.g., grpc, protobuf) are not flagged automatically — relies on manual monitoring"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "Missing FIPS build tags"
    impact: "While UBI base images are used and no non-FIPS crypto imports were found, no FIPS build tags are present for formal compliance"
    severity: "MEDIUM"
    effort: "4-8 hours"
quick_wins:
  - title: "Add Dependabot configuration for Go modules and Docker"
    effort: "1-2 hours"
    impact: "Automated dependency update PRs with security alert integration"
  - title: "Add Codecov integration to test workflow"
    effort: "2-3 hours"
    impact: "PR coverage reporting and threshold enforcement"
  - title: "Add concurrency control and timeouts to CI workflows"
    effort: "1-2 hours"
    impact: "Prevent stale PR runs and reduce CI resource waste"
  - title: "Create basic CLAUDE.md with test patterns"
    effort: "2-3 hours"
    impact: "AI agents can generate consistent, framework-appropriate tests"
recommendations:
  priority_0:
    - "Add gRPC integration tests with a real gRPC server to validate end-to-end proxy behavior"
    - "Add Codecov integration with coverage threshold enforcement (e.g., 70% minimum)"
    - "Configure Dependabot for gomod and docker ecosystems"
  priority_1:
    - "Add container image startup and health check validation tests"
    - "Add FIPS build tags and boringcrypto configuration for formal compliance"
    - "Add unit tests for bytes.go parsing logic and main.go error handling"
    - "Create CLAUDE.md with Go testing patterns and project-specific guidance"
  priority_2:
    - "Add concurrency control to all CI workflows"
    - "Update GitHub Actions to latest versions (checkout@v4, etc.)"
    - "Add HEALTHCHECK instruction to Dockerfile"
    - "Implement test parallelization with t.Parallel() and subtests"
---

# Quality Analysis: rest-proxy

## Executive Summary
- **Overall Score: 3.9/10**
- **Repository Type**: Go gRPC-to-REST proxy for KServe model inference (V2 protocol)
- **Primary Language**: Go 1.25
- **RHOAI Component**: Model Serving (RHOAIENG)
- **Tier**: Midstream (opendatahub-io)
- **Key Strengths**: Good Dockerfile practices (multi-stage, UBI9 base, multi-arch), solid linting with pre-commit hooks, core marshaling logic is well-tested
- **Critical Gaps**: No integration/E2E tests, no coverage enforcement, no dependency alerts, no agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard
| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 5.0/10 | Core marshaling tested; missing bytes.go, main.go, error paths |
| Integration/E2E | 20% | 1.0/10 | No integration or E2E tests whatsoever |
| Build Integration | 15% | 6.0/10 | PR Docker builds with multi-arch; no Konflux simulation |
| Image Testing | 10% | 5.0/10 | Multi-stage UBI9 Dockerfile; no runtime validation |
| Coverage Tracking | 10% | 2.0/10 | Cover profile generated but not reported or enforced |
| CI/CD Automation | 15% | 5.0/10 | Test + build on PRs; missing concurrency, timeouts |
| Static Analysis | 10% | 6.0/10 | golangci-lint v2 + pre-commit; no Dependabot/Renovate |
| Agent Rules | 5% | 0.0/10 | Completely absent |

## Critical Gaps

### 1. No Integration or E2E Tests
- **Severity**: HIGH
- **Impact**: The proxy translates REST requests to gRPC and gRPC responses to REST — this protocol translation is never tested end-to-end against a real gRPC server. Regressions in connection handling, TLS configuration, or error propagation are undetectable until production.
- **Effort**: 16-24 hours
- **Current state**: Only unit tests exist for marshaling/unmarshaling logic. No tests validate the HTTP server, gRPC client connection, TLS setup, or full request/response lifecycle.

### 2. No Coverage Tracking or Enforcement
- **Severity**: HIGH
- **Impact**: The Makefile generates a `cover.out` profile (`go test -coverprofile`), but this is never uploaded to Codecov or any coverage service. PRs can silently reduce coverage without any gate or notification.
- **Effort**: 2-4 hours

### 3. No Dependency Alert Configuration
- **Severity**: HIGH
- **Impact**: No `.github/dependabot.yml` or Renovate config exists. Dependencies like `grpc v1.56.3`, `protobuf v1.35.1`, and `controller-runtime v0.14.1` are not automatically monitored for vulnerabilities. The repo already uses a `replace` directive to fix CVE-2024-45338 in `golang.org/x/net`, indicating manual dependency management is the current approach.
- **Effort**: 1-2 hours

### 4. Missing FIPS Build Configuration
- **Severity**: MEDIUM
- **Impact**: While UBI9 base images are used (FIPS-capable) and no non-FIPS crypto imports were detected in source code, there are no FIPS build tags (`-tags=fips`, `GOEXPERIMENT=boringcrypto`). The `crypto/tls` usage in `main.go` relies on Go's standard TLS library, not BoringCrypto.
- **Effort**: 4-8 hours

## Quick Wins

### 1. Add Dependabot Configuration (1-2 hours)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "gomod"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
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
Update `.github/workflows/test.yml` to upload coverage:
```yaml
      - name: Run unit test
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
        target: 70%
    patch:
      default:
        target: 80%
```

### 3. Add Concurrency Control (1-2 hours)
Add to each workflow:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 4. Create Basic Agent Rules (2-3 hours)
Create a `CLAUDE.md` file with Go testing patterns, project context, and test creation guidelines. Use `/test-rules-generator` to bootstrap this.

## Detailed Findings

### Unit Tests
- **Test files**: 2 (`proxy/request_test.go`, `proxy/marshaler_test.go`)
- **Source files**: 4 (excluding `gen/`) — `main.go`, `request.go`, `marshaler.go`, `bytes.go`
- **Test-to-code ratio**: ~36% by lines (445 test lines / 1245 source lines)
- **Framework**: Go `testing` package with `google/go-cmp` and `proto.Equal`
- **Coverage areas**:
  - `request_test.go`: Tests REST-to-protobuf request decoding for 1D-4D tensor data and BYTES tensor types (strings, base64, numeric arrays). 6 BYTES test cases with various shapes and content types.
  - `marshaler_test.go`: Tests protobuf-to-REST response marshaling including INT64, BYTES, raw output contents, and base64 encoding.
- **Gaps**:
  - No tests for `main.go` (HTTP server setup, TLS config, environment variable parsing, `getIntegerEnv`)
  - No tests for `bytes.go` (raw byte parsing, string array unmarshaling, escape handling, `splitRawBytes`, `isBase64Content`, `unmarshalNestedNumeric`)
  - No error path testing (invalid datatypes, malformed JSON, FP16 unsupported type)
  - No test isolation — tests don't use `t.Parallel()` or `t.Run()` subtests
  - No table-driven tests with `t.Run()` for named sub-cases

### Integration/E2E Tests
- **Status**: Completely absent
- No `e2e/`, `integration/`, or `test/` directories
- No gRPC server mock or test server for end-to-end proxy validation
- No container-based testing (testcontainers, docker-compose)
- No cluster testing (Kind, Minikube, envtest)
- No multi-version testing

### Build Integration
- **PR builds**: `build.yml` triggers on PRs to `main` and `release-*` branches; builds Docker image but does not push (`push: false` for PRs)
- **Multi-arch**: Supports 4 architectures — `linux/amd64`, `linux/arm64`, `linux/ppc64le`, `linux/s390x`
- **Caching**: Uses GitHub Actions cache for Docker BuildKit (`cache-from: type=gha`, `cache-to: type=gha,mode=max`)
- **Test workflow**: Builds a dev container image and runs lint + tests inside it, ensuring consistent build environment
- **Gaps**:
  - No Konflux build simulation
  - No image startup validation post-build
  - No Kustomize/manifest validation (less relevant for this project type)

### Image Testing
- **Dockerfile quality**: Well-structured 3-stage multi-stage build (develop → build → runtime)
  - **Stage 1 (develop)**: UBI9 go-toolset with protoc, pre-commit, Node.js for development
  - **Stage 2 (build)**: Cross-compilation with `BUILDPLATFORM`/`TARGETPLATFORM` ARGs, layer caching for go build
  - **Stage 3 (runtime)**: Minimal `ubi9/ubi-micro:9.5` with only the compiled binary
- **Base images**: Uses UBI9 (FIPS-capable Red Hat Universal Base Images) throughout
- **Security**: Runs as non-root user (`USER 2000` in runtime stage), `CGO_ENABLED=0` for static binary
- **Gaps**:
  - No `HEALTHCHECK` instruction
  - No readiness/liveness probe definitions
  - No container runtime testing (image startup, port binding, gRPC connectivity)
  - No image scanning integration (out of scope per instructions, but noted)

### Coverage Tracking
- **Current state**: Makefile target `make test` runs `go test -coverprofile cover.out`
- **Reporting**: None — `cover.out` is generated but not uploaded to any service
- **Thresholds**: None — no coverage minimum or gate
- **PR integration**: None — no coverage comments or status checks on PRs

### CI/CD Automation
- **Workflow inventory**:
  | Workflow | Trigger | Purpose |
  |----------|---------|---------|
  | `test.yml` | PR (main, release-*) | Build dev image, lint, unit tests |
  | `build.yml` | PR, push, schedule (Mon/Wed), dispatch | Build multi-arch Docker image |
  | `codeql.yml` | PR, push, schedule (daily) | CodeQL security scanning (out of scope) |
  | `create-tag-release.yml` | dispatch | Create tag and release with changelog |
- **Strengths**: Tests and builds run on PRs; scheduled builds for regression detection; release automation
- **Gaps**:
  - No `concurrency:` control — stale PR runs continue wasting resources
  - No `timeout-minutes:` on test/build workflows (only CodeQL has timeout)
  - Using outdated action versions (`actions/checkout@v3`, `docker/setup-buildx-action@v2`)
  - No test parallelization or matrix strategy
  - No caching for Go modules in test workflow (though tests run inside Docker)

### Static Analysis

#### Linting
- **golangci-lint v2**: Well-configured with 6 linters enabled (errcheck, govet, ineffassign, staticcheck, unused, goconst)
- **Formatters**: gofmt and goimports configured
- **Exclusions**: Sensible exclusions for test files (gocyclo, errcheck, dupl, gosec) and generated code (`gen/`)
- **Pre-commit**: `.pre-commit-config.yaml` with golangci-lint (v2.8.0) and prettier
- **Development workflow**: Pre-commit hooks installed in Docker dev container; `make fmt` runs linting
- **Gap**: Could enable additional linters (gosec for security, gocyclo for complexity, dupl for duplication detection)

#### FIPS Compatibility
- **Source code**: No non-FIPS crypto imports detected (`crypto/md5`, `crypto/des`, `crypto/rc4`, `math/rand` absent)
- **`crypto/tls`**: Used in `main.go` for TLS configuration — relies on Go's standard TLS, not BoringCrypto
- **Base images**: UBI9 (FIPS-capable) — good
- **Build tags**: No FIPS build tags (`-tags=fips`, `GOEXPERIMENT=boringcrypto`) present
- **Assessment**: Clean source code but lacks formal FIPS build configuration

#### Dependency Alerts
- **Dependabot**: Not configured — no `.github/dependabot.yml`
- **Renovate**: Not configured — no `renovate.json` or `.renovaterc`
- **Manual**: Using `replace` directives in `go.mod` to pin CVE fixes (e.g., `golang.org/x/net` for CVE-2024-45338)
- **Risk**: Dependencies are manually managed; new vulnerabilities require human discovery

### Agent Rules
- **Status**: Missing
- No `CLAUDE.md` or `AGENTS.md` in repository root
- No `.claude/` directory or rules files
- No `.claude/rules/` for test creation guidance
- No `.claude/skills/` for custom skills
- **Impact**: AI agents generating tests or code have no project-specific context about testing patterns, gRPC/protobuf conventions, or quality standards

## Recommendations

### Priority 0 (Critical)
1. **Add gRPC integration tests** — Create a test gRPC server that implements the KServe V2 inference protocol. Test the full proxy lifecycle: REST request → gRPC call → gRPC response → REST response. Validate TLS, error handling, and timeout behavior.
2. **Add Codecov integration with threshold enforcement** — Upload `cover.out` to Codecov in the test workflow. Set project target at 70% and patch target at 80% to prevent coverage regression.
3. **Configure Dependabot** — Add `.github/dependabot.yml` covering `gomod`, `docker`, and `github-actions` ecosystems for automated vulnerability detection and update PRs.

### Priority 1 (High Value)
4. **Add unit tests for `bytes.go`** — The byte parsing logic (raw bytes splitting, string array unmarshaling, escape character handling, base64 decoding) is complex and currently untested. Add tests for edge cases: empty arrays, malformed JSON, invalid base64, mismatched shapes.
5. **Add unit tests for `main.go`** — Test `getIntegerEnv()`, TLS configuration paths, and error handling for missing environment variables.
6. **Add FIPS build configuration** — Add `GOEXPERIMENT=boringcrypto` or `-tags=fips` build flags. Validate that the runtime binary uses BoringCrypto for TLS operations.
7. **Create CLAUDE.md with test patterns** — Document Go testing conventions, protobuf test helpers, and project-specific patterns. Use `/test-rules-generator` to bootstrap.

### Priority 2 (Nice-to-Have)
8. **Add concurrency control** to all CI workflows to cancel stale runs and reduce resource usage.
9. **Update GitHub Actions** to latest versions (`actions/checkout@v4`, `docker/setup-buildx-action@v3`, `docker/build-push-action@v5`).
10. **Add `HEALTHCHECK`** instruction to the runtime stage of the Dockerfile.
11. **Implement `t.Parallel()` and `t.Run()` subtests** for better test isolation and named test cases.
12. **Add container image startup test** — Validate the binary starts and binds to the expected port inside the container.

## Comparison to Gold Standards

| Dimension | rest-proxy | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | 5/10 | 8/10 | 6/10 | 8/10 |
| Integration/E2E | 1/10 | 9/10 | 7/10 | 9/10 |
| Build Integration | 6/10 | 7/10 | 8/10 | 7/10 |
| Image Testing | 5/10 | 6/10 | 9/10 | 6/10 |
| Coverage Tracking | 2/10 | 8/10 | 5/10 | 8/10 |
| CI/CD Automation | 5/10 | 9/10 | 8/10 | 8/10 |
| Static Analysis | 6/10 | 7/10 | 6/10 | 7/10 |
| Agent Rules | 0/10 | 7/10 | 3/10 | 4/10 |
| **Overall** | **3.9/10** | **7.9/10** | **6.8/10** | **7.4/10** |

### Key Differentiators
- **vs. odh-dashboard**: Missing contract tests, coverage enforcement, comprehensive CI, and agent rules
- **vs. notebooks**: Missing image validation layers, multi-arch testing (though multi-arch build exists)
- **vs. kserve**: Despite being a KServe sub-project, rest-proxy lacks the parent project's coverage enforcement, E2E testing, and webhook validation

## File Paths Reference

### CI/CD
- `.github/workflows/test.yml` — PR test workflow (lint + unit tests)
- `.github/workflows/build.yml` — Docker image build workflow (multi-arch)
- `.github/workflows/codeql.yml` — CodeQL security analysis
- `.github/workflows/create-tag-release.yml` — Release automation
- `Makefile` — Build targets (test, build, fmt, develop)

### Source Code
- `proxy/main.go` — HTTP/gRPC server setup, TLS config
- `proxy/request.go` — REST-to-protobuf request transformation
- `proxy/marshaler.go` — Protobuf-to-REST response transformation
- `proxy/bytes.go` — BYTES tensor data handling
- `gen/` — Generated gRPC gateway stubs (excluded from analysis)

### Testing
- `proxy/request_test.go` — Request decoding tests (1D-4D tensors, BYTES)
- `proxy/marshaler_test.go` — Response marshaling tests

### Container
- `Dockerfile` — 3-stage multi-stage build (develop, build, runtime)
- `.dockerignore` — Build context exclusions

### Code Quality
- `.golangci.yaml` — Linter configuration (v2)
- `.pre-commit-config.yaml` — Pre-commit hooks (golangci-lint, prettier)
- `scripts/fmt.sh` — Lint runner script
- `scripts/develop.sh` — Dev container runner script

### Dependencies
- `go.mod` — Go module dependencies (Go 1.25)
- `go.sum` — Dependency checksums
