---
repository: "opendatahub-io/rest-proxy"
overall_score: 4.6
scorecard:
  - dimension: "Unit Tests"
    score: 6.0
    status: "Decent unit tests for marshaling/request parsing, but no tests for main server logic, TLS, or bytes utilities"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests - no gRPC server testing, no HTTP endpoint testing, no container deployment testing"
  - dimension: "Build Integration"
    score: 3.0
    status: "PR builds Docker image but no runtime validation, no Konflux simulation, no image startup testing"
  - dimension: "Image Testing"
    score: 3.0
    status: "Multi-arch builds with caching, but no runtime validation, no vulnerability scanning, no SBOM"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "Coverage file generated locally (cover.out) but no codecov integration, no thresholds, no PR reporting"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "Four workflows covering test, build, CodeQL, and release - but outdated action versions and no concurrency control"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules of any kind"
critical_gaps:
  - title: "No integration or E2E tests"
    impact: "gRPC proxy behavior, HTTP routing, TLS termination, and error handling are completely untested end-to-end"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No container vulnerability scanning"
    impact: "CVEs in base images or dependencies go undetected until downstream consumers scan"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Test coverage can silently degrade with no visibility; current coverage unknown"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No image runtime validation"
    impact: "Container startup failures or port binding issues not caught until deployment"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Outdated GitHub Action versions"
    impact: "Using deprecated v2/v3 actions; potential security vulnerabilities and missing features"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No concurrency control on CI workflows"
    impact: "Multiple PR updates trigger redundant workflow runs, wasting CI resources"
    severity: "MEDIUM"
    effort: "30 minutes"
quick_wins:
  - title: "Add concurrency control to all workflows"
    effort: "30 minutes"
    impact: "Cancel redundant workflow runs on PR updates, saving CI time"
  - title: "Upgrade GitHub Actions to latest versions"
    effort: "1-2 hours"
    impact: "Fix deprecation warnings, gain security fixes, and use latest features (checkout@v4, setup-buildx@v3, etc.)"
  - title: "Add Trivy scanning to build workflow"
    effort: "1-2 hours"
    impact: "Catch CVEs in base images and dependencies before merge"
  - title: "Add codecov integration"
    effort: "2-3 hours"
    impact: "Visibility into test coverage with PR-level reporting and threshold enforcement"
  - title: "Create basic agent rules for test patterns"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality and consistency for contributors using AI tools"
recommendations:
  priority_0:
    - "Add integration tests that start the proxy, connect to a mock gRPC server, and send HTTP requests to validate end-to-end behavior"
    - "Add container vulnerability scanning (Trivy) to the build workflow"
    - "Integrate codecov with coverage thresholds and PR reporting"
  priority_1:
    - "Add image runtime validation - test that the built container starts, listens on the expected port, and responds to health checks"
    - "Upgrade all GitHub Action versions to latest (v4 for checkout, v3 for buildx/QEMU, v3 for CodeQL)"
    - "Add unit tests for main.go server setup logic (TLS configuration, port handling, error paths)"
    - "Add unit tests for bytes.go utility functions (unmarshalBytesJson, splitRawBytes, isBase64Content)"
  priority_2:
    - "Create agent rules (.claude/rules/) for Go unit test and integration test patterns"
    - "Add concurrency control to all CI workflows"
    - "Add dependency scanning (Dependabot or Renovate) for automated dependency updates"
    - "Add SBOM generation for container images"
    - "Add pre-commit check to CI to ensure consistency"
---

# Quality Analysis: opendatahub-io/rest-proxy

## Executive Summary

- **Overall Score: 4.6/10**
- **Repository Type**: Go gRPC-to-REST reverse proxy for KServe V2 inference protocol
- **Primary Language**: Go 1.25
- **Key Strengths**: Multi-architecture container builds with GHA caching, CodeQL SAST analysis, pre-commit hooks with golangci-lint, clean multi-stage Dockerfile, good test-to-code ratio for covered files
- **Critical Gaps**: Zero integration/E2E tests, no container vulnerability scanning, no coverage tracking, no image runtime validation, no agent rules
- **Agent Rules Status**: Missing - no CLAUDE.md, no .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.0/10 | Decent marshaling/request tests, but main.go and bytes.go untested |
| Integration/E2E | **0.0/10** | **No integration or E2E tests of any kind** |
| **Build Integration** | **3.0/10** | **PR builds image but no runtime validation or Konflux simulation** |
| Image Testing | 3.0/10 | Multi-arch builds, no scanning, no startup validation |
| Coverage Tracking | 2.0/10 | cover.out generated locally only, no integration |
| CI/CD Automation | 6.0/10 | Four workflows, but outdated actions and no concurrency control |
| Agent Rules | **0.0/10** | **Completely absent** |

## Critical Gaps

### 1. No Integration or E2E Tests
- **Impact**: The proxy's core function (translating REST to gRPC) is untested end-to-end. HTTP routing, gRPC connection handling, TLS termination, error responses, and multi-tenant behavior are all untested.
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Current State**: Only unit tests exist for marshaler and request parsing. `main.go` (the server entry point) has zero test coverage. No tests validate that the proxy actually starts, accepts HTTP, and forwards to gRPC.

### 2. No Container Vulnerability Scanning
- **Impact**: The Dockerfile uses `registry.access.redhat.com/ubi9/ubi-micro:9.5` as a runtime base and `ubi9/go-toolset` for builds. CVEs in these images or in Go dependencies are not scanned automatically.
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Current State**: No Trivy, Snyk, or other scanner in any workflow. The `SECURITY.md` mentions image scanning as a practice, but it's not implemented in this repo's CI.

### 3. No Coverage Tracking or Enforcement
- **Impact**: Test coverage is invisible. The `make test` target generates `cover.out` but nothing consumes it. No PR-level reporting, no thresholds, no historical tracking.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Current State**: `go test -coverprofile cover.out` runs locally, but the CI workflow doesn't upload or report coverage.

### 4. No Image Runtime Validation
- **Impact**: A built container image that fails at startup (wrong binary path, missing permissions, port conflicts) won't be caught until it's deployed downstream.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Current State**: Build workflow creates multi-arch images but never runs them. No startup test, no health check validation.

### 5. Outdated GitHub Action Versions
- **Impact**: Using `actions/checkout@v3`, `docker/setup-buildx-action@v2`, `github/codeql-action/init@v2` - all deprecated. Missing security fixes and feature improvements.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Current State**: All workflows use v2/v3 actions; latest are v4/v3 respectively.

### 6. No Concurrency Control
- **Impact**: Multiple pushes to a PR trigger redundant workflow runs that run to completion, wasting CI resources.
- **Severity**: MEDIUM
- **Effort**: 30 minutes

## Quick Wins

### 1. Add Concurrency Control (30 minutes)
Add to each workflow:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

### 2. Upgrade GitHub Actions (1-2 hours)
| Current | Upgrade To |
|---------|-----------|
| `actions/checkout@v3` | `actions/checkout@v4` |
| `docker/setup-buildx-action@v2` | `docker/setup-buildx-action@v3` |
| `docker/setup-qemu-action@v2` | `docker/setup-qemu-action@v3` |
| `docker/build-push-action@v4` | `docker/build-push-action@v6` |
| `docker/login-action@v2` | `docker/login-action@v3` |
| `github/codeql-action/*@v2` | `github/codeql-action/*@v3` |

### 3. Add Trivy Scanning (1-2 hours)
Add a step to the build workflow after image build:
```yaml
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

### 4. Add Codecov Integration (2-3 hours)
Modify test workflow to upload coverage:
```yaml
- name: Run unit test
  run: ./scripts/develop.sh make test

- name: Copy coverage from container
  run: docker cp $(docker ps -lq):/opt/app/cover.out ./cover.out

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: ./cover.out
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

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory:**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | PR to main/release branches | Build dev image, run lint + unit tests |
| `build.yml` | PR, push, schedule (Mon/Thu), dispatch | Multi-arch Docker image build and push |
| `codeql.yml` | PR, push to main, daily schedule | CodeQL SAST for Go |
| `create-tag-release.yml` | Manual dispatch | Tag creation and release changelog |

**Strengths:**
- Tests run on PRs with path-ignore for markdown files
- Multi-architecture build support (amd64, arm64, ppc64le, s390x)
- Docker BuildKit caching via GHA cache backend
- Scheduled builds for freshness (twice weekly)
- CodeQL with daily schedule for proactive security scanning

**Weaknesses:**
- No concurrency control on any workflow
- All actions are 1-2 major versions behind
- Test workflow builds a dev container to run tests (slower than native Go test)
- No workflow for dependency updates
- Build workflow does not validate the built image works

### Test Coverage

**Test Files:**
- `proxy/request_test.go` (269 lines) - Tests REST request parsing for 1D/2D/3D/4D tensors and BYTES type
- `proxy/marshaler_test.go` (177 lines) - Tests REST response marshaling, bytes response, and raw output

**Test-to-Code Ratio:** 445 test lines / 800 source lines = **0.56** (good for the covered files)

**Untested Code:**
- `proxy/main.go` (140 lines) - Server startup, TLS configuration, gRPC connection setup, port handling - **0% tested**
- `proxy/bytes.go` (213 lines) - BYTES tensor marshaling, base64 handling, raw bytes splitting - **0% tested directly** (some coverage via request_test.go)
- Error paths in request.go and marshaler.go

**Testing Framework:** Standard Go `testing` package with `google/go-cmp` for diff comparison and `google.golang.org/protobuf/proto` for protobuf equality.

### Code Quality

**Linting:**
- golangci-lint v2 configured with 6 linters: errcheck, govet, ineffassign, staticcheck, unused, goconst
- Formatters: gofmt and goimports enabled
- Test files excluded from gocyclo, errcheck, dupl, gosec
- Generated code (gen/) properly excluded

**Pre-commit Hooks:**
- golangci-lint hook for Go linting
- prettier for YAML/JSON formatting
- Pre-commit installed in the developer Docker container
- CI runs pre-commit via `make fmt`

**Static Analysis:**
- CodeQL configured for Go (daily + on PRs)
- No additional tools (gosec standalone, Semgrep, etc.)
- No dependency scanning (Dependabot/Renovate)
- No secret detection (Gitleaks/TruffleHog)

### Container Images

**Dockerfile Analysis:**
- Well-structured 3-stage build: develop -> build -> runtime
- Multi-platform cross-compilation with BUILDPLATFORM/TARGETPLATFORM
- Minimal runtime image (`ubi9/ubi-micro:9.5`)
- Non-root user (USER 2000) for security
- Go module caching with `--mount=type=cache`
- CGO_ENABLED=0 for static binary

**Strengths:**
- Excellent multi-arch support (4 architectures)
- Minimal attack surface with ubi-micro runtime
- Build caching for both Go and Docker layers
- Developer container with all tools pre-installed

**Weaknesses:**
- No vulnerability scanning in CI
- No SBOM generation
- No image signing/attestation
- No startup validation after build
- No health check defined in Dockerfile (HEALTHCHECK instruction)

### Security

**Implemented:**
- CodeQL SAST (Go) - daily + PR
- Non-root container user
- CVE fix via go.mod replace (CVE-2024-45338 for golang.org/x/net)
- SECURITY.md with vulnerability reporting process

**Missing:**
- Container image vulnerability scanning (Trivy/Snyk)
- Dependency scanning (Dependabot/Renovate)
- Secret detection (Gitleaks/TruffleHog)
- SBOM generation
- Image signing

### Agent Rules (Agentic Flow Quality)

- **Status**: Completely Missing
- **Coverage**: N/A - no rules exist
- **Quality**: N/A
- **Gaps**: No CLAUDE.md, no .claude/ directory, no test creation rules, no coding standards for AI agents
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - Go unit test patterns (table-driven tests, test helpers)
  - Integration test setup (mock gRPC servers)
  - Dockerfile best practices
  - Pre-commit compliance

## Recommendations

### Priority 0 (Critical)

1. **Add integration tests for the proxy's core functionality**
   - Start a mock gRPC inference server
   - Start the REST proxy connected to the mock
   - Send HTTP requests and validate the full request/response cycle
   - Test TLS termination, error handling, and edge cases
   - Framework: Go `net/http/httptest` + gRPC test server

2. **Add container vulnerability scanning**
   - Integrate Trivy in the build workflow
   - Upload SARIF results to GitHub Security tab
   - Set severity threshold (CRITICAL, HIGH)

3. **Implement coverage tracking**
   - Add codecov integration to test workflow
   - Set project target (60%) and patch target (80%)
   - Add coverage badge to README

### Priority 1 (High Value)

4. **Add image runtime validation**
   - After building, run the container and verify:
     - Process starts without error
     - HTTP port is listening
     - Health check endpoint responds (add one if missing)

5. **Upgrade GitHub Action versions**
   - Move all actions to their latest major versions
   - Verify workflow behavior after upgrade

6. **Add unit tests for untested code**
   - `main.go`: Test `getIntegerEnv`, TLS config paths, gRPC options
   - `bytes.go`: Test `unmarshalBytesJson`, `splitRawBytes`, `isBase64Content` directly

7. **Add Dockerfile HEALTHCHECK**
   - Add `HEALTHCHECK CMD wget --spider http://localhost:8008/ || exit 1`
   - Enables container orchestrators to detect unhealthy instances

### Priority 2 (Nice-to-Have)

8. **Create agent rules** for test automation guidance
9. **Add concurrency control** to all CI workflows
10. **Add dependency management** (Dependabot or Renovate)
11. **Add SBOM generation** for container images
12. **Add secret detection** (Gitleaks) to PR workflow
13. **Add a Makefile target for coverage reporting** (`make coverage`)
14. **Consider Testcontainers** for integration testing the Docker image

## Comparison to Gold Standards

| Dimension | rest-proxy | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | 6/10 - Partial | 9/10 - Comprehensive | 7/10 | 9/10 |
| Integration/E2E | **0/10** - None | 9/10 - Multi-layer | 8/10 | 9/10 |
| Build Integration | 3/10 - Build only | 8/10 - Full validation | 7/10 | 8/10 |
| Image Testing | 3/10 - Build only | 7/10 - Multi-layer | 9/10 - 5-layer | 7/10 |
| Coverage Tracking | 2/10 - Local only | 8/10 - Enforced | 6/10 | 9/10 - Enforced |
| CI/CD | 6/10 - Basic | 9/10 - Comprehensive | 8/10 | 9/10 |
| Agent Rules | **0/10** - None | 8/10 - Comprehensive | 3/10 | 2/10 |
| Security | 4/10 - CodeQL only | 8/10 - Multi-tool | 7/10 | 8/10 |

## File Paths Reference

| File | Purpose |
|------|---------|
| `.github/workflows/test.yml` | PR test workflow (lint + unit tests) |
| `.github/workflows/build.yml` | Multi-arch Docker build and push |
| `.github/workflows/codeql.yml` | CodeQL SAST analysis |
| `.github/workflows/create-tag-release.yml` | Manual release workflow |
| `Makefile` | Build targets (build, test, fmt, develop) |
| `Dockerfile` | 3-stage multi-arch container build |
| `.golangci.yaml` | Linter configuration (6 linters) |
| `.pre-commit-config.yaml` | Pre-commit hooks (golangci-lint + prettier) |
| `proxy/request_test.go` | Request parsing unit tests |
| `proxy/marshaler_test.go` | Response marshaling unit tests |
| `proxy/main.go` | Server entry point (untested) |
| `proxy/bytes.go` | BYTES tensor handling (partially untested) |
| `proxy/request.go` | REST request parsing |
| `proxy/marshaler.go` | REST response marshaling |
| `go.mod` | Go module dependencies (Go 1.25) |
| `OWNERS` | Approvers and reviewers list |
