---
repository: "red-hat-data-services/rest-proxy"
overall_score: 3.6
scorecard:
  - dimension: "Unit Tests"
    score: 6.0
    status: "Decent test-to-code ratio (0.56) for core marshaling logic, but no coverage enforcement"
  - dimension: "Integration/E2E"
    score: 1.0
    status: "No integration or E2E tests — critical gap for a REST-to-gRPC proxy"
  - dimension: "Build Integration"
    score: 5.0
    status: "PR builds Docker image and Konflux pipeline runs, but no runtime validation"
  - dimension: "Image Testing"
    score: 3.0
    status: "Multi-stage multi-arch build with UBI9, but no runtime testing or vulnerability scanning"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "Coverage file generated but never consumed — no codecov, no thresholds, no PR reporting"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "Four workflows covering test/build/release/security, but outdated actions and no concurrency control"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no test automation guidance"
critical_gaps:
  - title: "No integration or E2E tests for REST-to-gRPC proxy behavior"
    impact: "Protocol translation bugs, TLS configuration errors, and gRPC connectivity issues are undetectable before deployment"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No container image runtime validation"
    impact: "Image startup failures, missing binaries, or configuration errors discovered only in production"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Coverage can silently regress with no visibility — coverprofile generated but never analyzed"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No vulnerability scanning (Trivy/Snyk)"
    impact: "Container and dependency vulnerabilities undetected until downstream scanning"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "main.go completely untested"
    impact: "Server startup, TLS negotiation, env var parsing, and error handling paths have zero test coverage"
    severity: "MEDIUM"
    effort: "8-12 hours"
quick_wins:
  - title: "Add codecov integration to PR workflow"
    effort: "2-3 hours"
    impact: "Immediate visibility into coverage trends and regressions on every PR"
  - title: "Add Trivy container scanning to build workflow"
    effort: "1-2 hours"
    impact: "Early detection of CVEs in base images and Go dependencies"
  - title: "Add concurrency control to test.yml workflow"
    effort: "30 minutes"
    impact: "Cancel outdated PR runs, save CI resources"
  - title: "Update GitHub Actions to latest versions (v3 → v4)"
    effort: "1 hour"
    impact: "Security fixes and Node.js 20 runtime (v3 uses deprecated Node.js 16)"
  - title: "Add image startup smoke test to PR pipeline"
    effort: "2-3 hours"
    impact: "Catch binary packaging, permission, and entrypoint errors before merge"
recommendations:
  priority_0:
    - "Add integration tests that start the proxy against a mock gRPC server and verify end-to-end REST-to-gRPC translation"
    - "Implement codecov integration with minimum coverage threshold (start at current level, ratchet up)"
    - "Add container image startup validation in the PR workflow"
  priority_1:
    - "Add unit tests for main.go (env var parsing, TLS config, server setup)"
    - "Add Trivy scanning to PR and push workflows"
    - "Create .claude/rules/ with test automation guidance for AI agents"
    - "Add gitleaks secret detection to CI pipeline"
  priority_2:
    - "Add fuzz testing for JSON tensor unmarshaling (high-risk parsing code)"
    - "Add performance benchmarks for marshaling/unmarshaling hot paths"
    - "Add contract tests for KServe V2 protocol compliance"
---

# Quality Analysis: rest-proxy

## Executive Summary

- **Overall Score: 3.6/10**
- **Repository Type**: Go service — REST-to-gRPC reverse proxy for KServe V2 inference protocol
- **Primary Language**: Go 1.23
- **Size**: ~800 lines of source code (excluding generated protobuf stubs), 4 source files
- **Key Strengths**: Solid unit tests for core marshaling logic, multi-arch Docker builds, CodeQL SAST, pre-commit hooks
- **Critical Gaps**: Zero integration/E2E tests for a networking proxy, no coverage tracking, no image runtime validation, no vulnerability scanning
- **Agent Rules Status**: Missing — no CLAUDE.md, no `.claude/` directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6/10 | Decent test-to-code ratio (0.56) for core marshaling, but no coverage enforcement |
| Integration/E2E | **1/10** | **No integration or E2E tests — critical gap for a REST-to-gRPC proxy** |
| Build Integration | 5/10 | PR builds Docker image + Konflux, but no runtime validation |
| Image Testing | 3/10 | Multi-stage multi-arch build, no runtime testing or scanning |
| Coverage Tracking | **2/10** | **coverprofile generated but never consumed** |
| CI/CD Automation | 6/10 | 4 workflows (test/build/codeql/release), outdated actions |
| Agent Rules | **0/10** | **No AI agent guidance whatsoever** |

## Critical Gaps

### 1. No Integration or E2E Tests
- **Severity**: HIGH
- **Impact**: The entire purpose of this project is to translate REST requests into gRPC calls. Without integration tests that verify this end-to-end flow (REST client → proxy → gRPC server), there is no assurance the proxy actually works in a real networking scenario.
- **What's missing**:
  - No tests starting the HTTP server and sending real HTTP requests
  - No tests connecting to a gRPC backend (mock or real)
  - No TLS handshake testing
  - No error path testing (gRPC unavailable, malformed requests, timeouts)
- **Effort**: 16-24 hours
- **Example**: Use `net/http/httptest` for the REST side and a test gRPC server for the backend

### 2. No Container Image Runtime Validation
- **Severity**: HIGH
- **Impact**: The Docker image is built on PRs but never started or validated. Binary packaging errors, missing libraries, or permission issues would only surface in deployment.
- **What's missing**:
  - No `docker run` smoke test in CI
  - No healthcheck or readiness probe validation
  - No startup time verification
- **Effort**: 4-6 hours

### 3. No Coverage Tracking or Enforcement
- **Severity**: HIGH
- **Impact**: The Makefile generates `cover.out` but nothing reads it. Coverage can silently drop to zero without any alert.
- **What's missing**:
  - No codecov/coveralls integration
  - No coverage thresholds
  - No PR coverage diff reporting
- **Effort**: 2-4 hours

### 4. No Vulnerability Scanning
- **Severity**: MEDIUM
- **Impact**: No Trivy, Snyk, or govulncheck scanning. CVEs in Go dependencies or base images go undetected.
- **Effort**: 2-3 hours

### 5. main.go Has Zero Test Coverage
- **Severity**: MEDIUM
- **Impact**: The `main.go` file (140 lines) contains server startup logic, TLS configuration, environment variable parsing, and gRPC connection setup — all completely untested. The `getIntegerEnv` function, for example, calls `os.Exit(1)` on parse errors but is never tested.
- **Effort**: 8-12 hours

## Quick Wins

### 1. Add Codecov Integration (2-3 hours)
```yaml
# Add to .github/workflows/test.yml
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: cover.out
    fail_ci_if_error: true
```

### 2. Add Trivy Scanning (1-2 hours)
```yaml
# New step in build.yml after image build
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: '${{ env.IMAGE_NAME }}:${{ env.IMAGE_TAG }}'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
```

### 3. Add Concurrency Control to test.yml (30 minutes)
```yaml
# Add to test.yml at the top level
concurrency:
  group: test-${{ github.head_ref }}
  cancel-in-progress: true
```

### 4. Update GitHub Actions to v4 (1 hour)
All workflows use `actions/checkout@v3` and `docker/*-action@v2`. These should be updated to v4/v3 respectively (v3 uses deprecated Node.js 16 runtime).

### 5. Image Startup Smoke Test (2-3 hours)
```yaml
# Add to test.yml or build.yml
- name: Smoke test image
  run: |
    docker build -t rest-proxy-test:latest --target runtime .
    docker run --rm -d --name rest-proxy-smoke rest-proxy-test:latest
    sleep 2
    docker logs rest-proxy-smoke
    docker stop rest-proxy-smoke
```

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory (4 total)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | PR (main, release-*) | Build dev image, lint, unit tests |
| `build.yml` | PR + push (main, release-*) | Multi-arch Docker build, push on merge |
| `codeql.yml` | PR + push + daily cron | CodeQL SAST for Go |
| `create-tag-release.yml` | manual dispatch | Create tags, generate changelog, bump version |

**Strengths**:
- Multi-arch builds (amd64, arm64, ppc64le, s390x) in both GitHub Actions and Konflux
- GHA build caching (`cache-from: type=gha`)
- CodeQL scheduled daily + on PRs
- Renovate for dependency updates (extends central config)
- Tekton/Konflux pipeline for hermetic builds with FIPS compliance

**Weaknesses**:
- No concurrency control on `test.yml` — parallel runs for same PR waste resources
- All actions on v3 (deprecated Node.js 16 runtime)
- No Go setup step — relies entirely on Docker build for Go toolchain
- `test.yml` and `build.yml` both build Docker images redundantly on PRs
- No test result reporting (JUnit XML, etc.)
- `.md` files excluded via `paths-ignore` — changes to README don't trigger CI even if they include code snippets

### Test Coverage

**Unit Tests (2 files, 445 lines)**:
- `request_test.go` (269 lines): Tests REST→protobuf request transformation for 1D/2D/3D/4D tensor data and BYTES type with multiple encoding formats (string, byte array, base64)
- `marshaler_test.go` (176 lines): Tests protobuf→REST response marshaling including raw output content handling

**What's Tested Well**:
- Core JSON→protobuf request transformation for all tensor dimensions
- BYTES type with various input formats (strings, byte arrays, base64)
- Response marshaling with parameter types (string, int64, bool, nil)
- Raw output content deserialization
- Both `Contents` and `RawOutputContents` response paths

**What's Not Tested**:
- `main.go` — server startup, TLS configuration, env var parsing, gRPC dial
- `bytes.go` — `unmarshalBytesJson` edge cases (only tested indirectly through request tests), `splitRawBytes` error paths, `isBase64Content` edge cases, `unmarshalNestedNumeric` error paths
- Error paths in `request.go` — malformed JSON, unsupported datatypes, FP16 error
- HTTP request/response round-trip through the actual mux
- Concurrent request handling
- Large payload handling (max message size enforcement)

**Test-to-Code Ratio**: 445/798 = **0.56** (test lines / source lines, excluding generated code)

### Code Quality

**golangci-lint Configuration** (`.golangci.yaml`):
- 10 linters enabled: errcheck, gosimple, govet, ineffassign, staticcheck, typecheck, unused, goconst, gofmt, goimports
- Shadow variable checking enabled
- Generated code directories skipped
- Test files excluded from some linters
- **Missing linters**: gosec (security), gocritic (style/perf), gocyclo (complexity), misspell, dupl, bodyclose, noctx

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- golangci-lint v1.60.3 (reasonably current)
- prettier for non-Go files
- Generated code excluded
- Hooks installed during Docker build for CI consistency

**Static Analysis**:
- CodeQL for Go (daily + on PR) — good
- No gosec standalone scanning
- No Semgrep rules

### Container Images

**Dockerfiles (2)**:
1. `Dockerfile` (community/upstream):
   - 3-stage build: develop → build → runtime
   - UBI9 base: `ubi9/go-toolset` (build) → `ubi9/ubi-micro` (runtime, minimal footprint)
   - Cross-compilation with BUILDPLATFORM/TARGETPLATFORM
   - Go module and build caching
   - Pre-commit hooks baked into dev image
   - Non-root user (2000) in runtime

2. `Dockerfile.konflux` (Red Hat/production):
   - 2-stage build: build → runtime
   - Pinned base image digests (reproducible builds)
   - FIPS-compliant build: `GOEXPERIMENT=strictfipsruntime -tags strictfipsruntime`
   - `CGO_ENABLED=1` for FIPS
   - UBI9 minimal (slightly larger than micro but with more utilities)
   - Red Hat labels (component, maintainer, license)
   - Non-root user (2000)

**Strengths**:
- UBI9 base images (certified, maintained, RHEL-compatible)
- Multi-arch support (4 architectures)
- FIPS compliance in Konflux build
- Non-root runtime user
- Minimal runtime image

**Weaknesses**:
- No HEALTHCHECK instruction in either Dockerfile
- No vulnerability scanning of built images
- No SBOM generation
- No image signing or attestation
- No runtime validation in CI

### Security

**Strengths**:
- CodeQL SAST (daily + PR, Go language)
- CVE mitigation in `go.mod` (`golang.org/x/net` pinned for CVE-2024-45338)
- Non-root container user
- FIPS compliance in Konflux builds
- Renovate for automated dependency updates

**Weaknesses**:
- No container image scanning (Trivy/Snyk/Grype)
- No secret detection (gitleaks, truffleHog)
- No dependency vulnerability scanning (govulncheck)
- `InsecureSkipVerify` in TLS config is configurable via env var (potential security risk)
- gosec linter explicitly disabled in golangci config

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: Everything — no test creation rules, no coding standards, no architecture guidance
- **Recommendation**: Generate rules with `/test-rules-generator` to provide AI agents with:
  - Unit test patterns (Go table-driven tests, protobuf assertions)
  - Integration test patterns (httptest, gRPC test server)
  - Marshaling/unmarshaling test patterns
  - Error handling test patterns

## Recommendations

### Priority 0 (Critical)

1. **Add integration tests with a mock gRPC server** — This is the single highest-impact improvement. The proxy's core function is protocol translation, and that entire flow is untested beyond unit-level marshaling.

2. **Implement codecov integration** — Coverage is already generated (`cover.out`) but never consumed. Adding codecov with a minimum threshold is a 2-hour task that immediately adds coverage visibility and regression prevention.

3. **Add container image startup validation** — A simple `docker run` smoke test in the PR workflow catches binary packaging, permission, and entrypoint errors before merge.

### Priority 1 (High Value)

4. **Add unit tests for `main.go`** — Refactor the `run()` function to accept configuration so it can be tested without starting an actual HTTP server. Test env var parsing, TLS configuration, and error handling.

5. **Add Trivy scanning to CI** — Catches CVEs in Go dependencies and base images before they reach downstream consumers.

6. **Create `.claude/rules/` with test automation guidance** — Enable AI agents to generate consistent, high-quality tests following the project's existing patterns (table-driven tests, protobuf assertions, `go-cmp`).

7. **Add gitleaks secret detection** — Simple pre-commit hook or CI step to prevent accidental credential exposure.

### Priority 2 (Nice-to-Have)

8. **Add Go fuzz testing for JSON parsing** — The `bytes.go` file contains manual JSON/string parsing that would benefit from fuzzing. Go's built-in fuzzing (`go test -fuzz`) can find edge cases in `unmarshalBytesJson`, `unmarshalStringArray`, and `unmarshalNestedNumeric`.

9. **Add benchmarks for marshaling hot paths** — The proxy sits in the inference request path. Adding `Benchmark*` tests for `CustomJSONPb.NewDecoder` and `CustomJSONPb.Marshal` provides performance regression detection.

10. **Add KServe V2 protocol compliance tests** — Verify that the proxy correctly handles all tensor types and edge cases defined in the KServe V2 specification.

## Comparison to Gold Standards

| Dimension | rest-proxy | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | 6/10 | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 1/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 5/10 | 8/10 | 9/10 | 8/10 |
| Image Testing | 3/10 | 7/10 | 10/10 | 7/10 |
| Coverage Tracking | 2/10 | 9/10 | 6/10 | 9/10 |
| CI/CD Automation | 6/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 0/10 | 8/10 | 3/10 | 2/10 |
| **Overall** | **3.6/10** | **8.7/10** | **7.5/10** | **8.0/10** |

### Key Takeaways vs Gold Standards

- **vs odh-dashboard**: Missing multi-layer testing (unit → integration → E2E → contract), coverage enforcement, and agent rules
- **vs notebooks**: Missing image validation pipeline (5-layer: build → startup → functional → security → multi-arch)
- **vs kserve**: Missing coverage enforcement, multi-version testing, and comprehensive operator test patterns

## File Paths Reference

| Category | Path | Notes |
|----------|------|-------|
| CI - Test | `.github/workflows/test.yml` | PR-triggered: dev image build, lint, unit tests |
| CI - Build | `.github/workflows/build.yml` | PR+push: multi-arch Docker build |
| CI - Security | `.github/workflows/codeql.yml` | CodeQL SAST, daily + PR |
| CI - Release | `.github/workflows/create-tag-release.yml` | Manual dispatch release workflow |
| Tekton | `.tekton/odh-mm-rest-proxy-pull-request.yaml` | Konflux PR pipeline, multi-arch |
| Dockerfile | `Dockerfile` | Community build, 3-stage, multi-arch |
| Dockerfile | `Dockerfile.konflux` | Production build, FIPS, pinned digests |
| Makefile | `Makefile` | Build targets: generate, build, test, fmt |
| Lint Config | `.golangci.yaml` | 10 linters, shadow check, 5min timeout |
| Pre-commit | `.pre-commit-config.yaml` | golangci-lint + prettier |
| Renovate | `.github/renovate.json` | Extends central konflux config |
| Tests | `proxy/request_test.go` | REST→protobuf request tests (269 lines) |
| Tests | `proxy/marshaler_test.go` | Protobuf→REST response tests (176 lines) |
| Source | `proxy/main.go` | Server startup, TLS, env config (140 lines) |
| Source | `proxy/request.go` | Request transformation logic (241 lines) |
| Source | `proxy/marshaler.go` | Response marshaling logic (206 lines) |
| Source | `proxy/bytes.go` | BYTES tensor handling (211 lines) |
| Generated | `gen/` | Protobuf/gRPC gateway stubs (2774 lines) |
