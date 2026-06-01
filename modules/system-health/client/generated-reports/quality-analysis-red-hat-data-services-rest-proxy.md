---
repository: "red-hat-data-services/rest-proxy"
overall_score: 5.1
scorecard:
  - dimension: "Unit Tests"
    score: 6.0
    status: "Decent test coverage for core marshaling/request logic, but no tests for main.go, bytes.go, or error paths"
  - dimension: "Integration/E2E"
    score: 1.0
    status: "No integration or E2E tests; no gRPC server mock testing; no HTTP endpoint tests"
  - dimension: "Build Integration"
    score: 5.0
    status: "PR-time Docker build exists but no Konflux simulation; Konflux push pipeline has extensive security scanning"
  - dimension: "Image Testing"
    score: 3.0
    status: "Multi-arch Docker build on PR but no runtime validation, no startup testing, no image smoke tests"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "Coverage file generated locally (cover.out) but no codecov/coveralls integration, no thresholds, no PR reporting"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "4 GitHub workflows + 2 Tekton pipelines; PR runs lint+test+build; push pipeline has comprehensive security checks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory; zero AI agent guidance"
critical_gaps:
  - title: "No integration or E2E tests"
    impact: "REST-to-gRPC proxy behavior is only tested at the unit level; actual HTTP request handling, TLS configuration, and gRPC connectivity are completely untested"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Coverage is generated locally but never uploaded, tracked, or enforced; regressions go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container runtime validation"
    impact: "Docker images are built on PR but never started or tested; startup failures, missing binaries, or TLS misconfigurations are only caught in production"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "Untested code paths in main.go and bytes.go"
    impact: "TLS setup, environment variable parsing, error handling, and BYTES tensor marshaling have zero test coverage"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents have no guidance on testing patterns, code conventions, or quality gates"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add codecov integration to test workflow"
    effort: "2-3 hours"
    impact: "Immediate visibility into coverage trends and PR-level coverage reporting"
  - title: "Add coverage threshold enforcement"
    effort: "1-2 hours"
    impact: "Prevent coverage regressions by failing PR checks below a minimum threshold"
  - title: "Add container startup smoke test to PR workflow"
    effort: "2-4 hours"
    impact: "Catch image startup failures before merge; verify binary exists and responds to health checks"
  - title: "Create basic agent rules (.claude/rules/)"
    effort: "2-3 hours"
    impact: "Guide AI agents to generate consistent, high-quality tests following project patterns"
  - title: "Update GitHub Actions versions from v2/v3 to v4"
    effort: "1 hour"
    impact: "Use supported action versions; current v2/v3 versions are deprecated"
recommendations:
  priority_0:
    - "Add codecov/coveralls integration with minimum coverage threshold (e.g., 60%) to prevent regressions"
    - "Add integration tests that stand up a mock gRPC server and test the full REST-to-gRPC proxy flow"
    - "Add container startup smoke test in PR workflow to validate the built image actually runs"
  priority_1:
    - "Add unit tests for main.go (TLS config, env var parsing) and bytes.go (edge cases, error paths)"
    - "Add HTTP endpoint tests using httptest.Server to validate the REST API contract"
    - "Create .claude/rules/ with unit-tests.md and integration-tests.md for AI-assisted development"
    - "Update GitHub Actions to latest versions (checkout@v4, setup-buildx-action@v3, etc.)"
  priority_2:
    - "Add Trivy scanning to the GitHub PR workflow (Konflux already has Clair/Snyk but GitHub CI does not)"
    - "Add performance/benchmark tests for tensor marshaling (high-throughput path)"
    - "Add golangci-lint gosec linter for security-focused static analysis in the PR workflow"
    - "Consider adding Dependabot or a Go-specific vulnerability check (govulncheck)"
---

# Quality Analysis: rest-proxy

## Executive Summary

- **Overall Score: 5.1/10**
- **Repository Type**: Go application (gRPC-to-REST reverse proxy for KServe V2 Predict Protocol)
- **Primary Language**: Go 1.23
- **Key Strengths**: Multi-arch container builds, pre-commit hooks with golangci-lint, CodeQL SAST, comprehensive Konflux push pipeline with Clair/Snyk/Coverity scanning, well-structured multi-stage Dockerfile
- **Critical Gaps**: No integration/E2E tests, no coverage tracking/enforcement, no container runtime validation, significant untested code paths
- **Agent Rules Status**: Missing - No CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.0/10 | Decent coverage for core marshaling/request logic; test-to-code ratio 0.56 |
| Integration/E2E | 1.0/10 | No integration or E2E tests whatsoever |
| Build Integration | 5.0/10 | PR-time Docker build exists; Konflux push pipeline is comprehensive |
| Image Testing | 3.0/10 | Multi-arch build on PR but zero runtime validation |
| Coverage Tracking | 2.0/10 | `cover.out` generated locally but never uploaded or enforced |
| CI/CD Automation | 6.0/10 | 4 GitHub workflows + 2 Tekton pipelines; reasonable automation |
| Agent Rules | 0.0/10 | No AI agent guidance exists |

## Critical Gaps

### 1. No Integration or E2E Tests
- **Impact**: The proxy's core function — translating REST to gRPC — is only tested at the serialization level. Actual HTTP request routing, gRPC connection establishment, TLS negotiation, and error response formatting are completely untested.
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Recommendation**: Create integration tests using `httptest.Server` + a mock gRPC server to test the full request lifecycle.

### 2. No Coverage Tracking or Enforcement
- **Impact**: The `Makefile` generates `cover.out` but it is never uploaded to any coverage service. No PR coverage gates exist, so coverage can regress silently.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Recommendation**: Add codecov GitHub Action step to `.github/workflows/test.yml` and configure a minimum threshold.

### 3. No Container Runtime Validation
- **Impact**: The PR build workflow builds Docker images for 4 architectures but never starts them. A broken binary, missing dependency, or misconfigured entrypoint won't be caught until deployment.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Recommendation**: Add a step after `make build` that runs the container and verifies the `/v2/health/ready` endpoint responds.

### 4. Untested Code in main.go and bytes.go
- **Impact**: `main.go` has ~140 lines including TLS configuration, environment variable parsing, and server startup with zero tests. `bytes.go` has 211 lines of complex byte parsing with zero tests.
- **Severity**: MEDIUM
- **Effort**: 8-12 hours

### 5. No Agent Rules
- **Impact**: AI-assisted development has no guidance on test patterns, naming conventions, or quality gates.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours

## Quick Wins

### 1. Add Codecov Integration (2-3 hours)
Add to `.github/workflows/test.yml`:
```yaml
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: cover.out
          fail_ci_if_error: true
```

### 2. Add Coverage Threshold (1-2 hours)
Create `.codecov.yml`:
```yaml
coverage:
  status:
    project:
      default:
        target: 60%
        threshold: 5%
    patch:
      default:
        target: 70%
```

### 3. Add Container Startup Smoke Test (2-4 hours)
Add to `.github/workflows/test.yml`:
```yaml
      - name: Smoke test container
        run: |
          docker run -d --name rest-proxy-test -p 8008:8008 kserve/rest-proxy:latest
          sleep 2
          docker logs rest-proxy-test
          # Verify process started (will fail to connect to gRPC but should start)
          docker inspect rest-proxy-test --format='{{.State.Running}}' | grep true
          docker stop rest-proxy-test
```

### 4. Update GitHub Actions Versions (1 hour)
```yaml
# Current (deprecated)       # Recommended
actions/checkout@v3          -> actions/checkout@v4
docker/setup-buildx-action@v2 -> docker/setup-buildx-action@v3
docker/login-action@v2       -> docker/login-action@v3
docker/build-push-action@v4  -> docker/build-push-action@v6
docker/setup-qemu-action@v2  -> docker/setup-qemu-action@v3
github/codeql-action/*@v2    -> github/codeql-action/*@v3
```

### 5. Create Basic Agent Rules (2-3 hours)
Generate with `/test-rules-generator` to create `.claude/rules/unit-tests.md` and `.claude/rules/integration-tests.md`.

## Detailed Findings

### CI/CD Pipeline

**GitHub Workflows (4 total)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | PR to main/release-* | Build dev image, run lint (pre-commit), run unit tests |
| `build.yml` | PR + push to main/release-*, tags | Multi-arch Docker build (amd64/arm64/ppc64le/s390x), push on merge |
| `codeql.yml` | PR + push to main, daily schedule | CodeQL SAST for Go |
| `create-tag-release.yml` | Manual dispatch | Tag creation, release changelog, bump next ODH tag |

**Strengths**:
- PR workflow runs both lint and tests before merge
- Build workflow uses Docker BuildKit caching (`type=gha`) for efficiency
- Multi-architecture support (4 platforms) for broad compatibility
- Concurrency control not explicitly set but builds are fast enough
- CodeQL runs on schedule + PRs for continuous security scanning

**Weaknesses**:
- No concurrency control on workflows (could have redundant runs)
- GitHub Actions use deprecated versions (v2/v3)
- No Go setup step; relies entirely on Docker dev image for tests (adds build time)
- `test.yml` does not upload coverage artifacts
- No workflow for dependency vulnerability scanning (Go-specific)

**Tekton/Konflux Pipelines (2 total)**:

| Pipeline | Trigger | Purpose |
|----------|---------|---------|
| `odh-mm-rest-proxy-pull-request.yaml` | PR (on-comment `/build-konflux` or label) | Multi-arch Konflux build for RHOAI |
| `odh-mm-rest-proxy-push.yaml` | Push to release branch | Full build + security scanning pipeline |

The push pipeline is comprehensive with:
- Clair scan, SAST Snyk check, ClamAV scan, Coverity check, shell check, unicode check
- RPM signature scan, deprecated base image check, ecosystem cert preflight
- Source image build, SBOM generation (show-sbom)
- Slack failure notifications

### Test Coverage

**Test Files**: 2 files (445 lines total)
- `proxy/request_test.go` (269 lines) — Tests REST request deserialization with 1D/2D/3D/4D tensor data and BYTES type
- `proxy/marshaler_test.go` (176 lines) — Tests REST response marshaling, raw output contents, and bytes response

**Test-to-Code Ratio**: 0.56 (445 test lines / 798 source lines, excluding generated code)

**What's Tested**:
- REST request JSON deserialization into protobuf (`TestRESTRequest`)
- BYTES tensor deserialization with string/binary/base64 formats (`TestBytesRESTRequest`)
- Response marshaling from protobuf to JSON (`TestRESTResponse`)
- BYTES response marshaling (`TestBytesRESTResponse`)
- Raw output contents deserialization (`TestBytesRESTResponseRawOutput`, `TestRESTResponseRawOutput`)

**What's NOT Tested**:
- `main.go`: Server startup, TLS configuration, env var parsing, gRPC connection setup
- `bytes.go`: All BYTES-specific parsing (unmarshalBytesJson, unmarshalStringArray, splitRawBytes, unmarshalNestedNumeric)
- Error paths in request deserialization (unsupported datatypes, malformed JSON)
- Parameter marshaling/unmarshaling edge cases
- The `NewDecoder` function for non-ModelInferRequest types

**Coverage Generation**: `make test` generates `cover.out` via `-coverprofile` flag, but it is never uploaded.

### Code Quality

**Linting**:
- **golangci-lint** configured via `.golangci.yaml` with 10 linters enabled:
  - Defaults: errcheck, gosimple, govet, ineffassign, staticcheck, typecheck, unused
  - Additional: goconst, gofmt, goimports
- Shadow checking enabled in govet
- Test files excluded from gocyclo, errcheck, dupl, gosec
- **Notable omissions**: gosec not enabled (security linting), misspell, stylecheck, unconvert

**Pre-commit Hooks**:
- golangci-lint (v1.60.3) — runs on all Go files except `gen/`
- prettier (v2.4.1) — formats YAML/JSON/Markdown (excludes `.github/`)
- Pre-commit hooks are pre-installed in the develop Docker image for caching

**Static Analysis**:
- CodeQL for Go (daily + PR-triggered)
- No gosec, Semgrep, or other Go-specific SAST in GitHub CI
- Konflux push pipeline has Snyk, Coverity, shell-check, unicode-check

**Code Formatting**:
- `gofmt` and `goimports` enforced via golangci-lint
- Prettier for non-Go files

### Container Images

**Dockerfiles**: 2 Dockerfiles

| File | Purpose | Base Image |
|------|---------|------------|
| `Dockerfile` | Standard build (upstream kserve) | `ubi9/go-toolset:1.23` → `ubi9/ubi-micro:9.5` |
| `Dockerfile.konflux` | Konflux/RHOAI build (FIPS) | `ubi9/go-toolset:1.23` (pinned digest) → `ubi9/ubi-minimal` (pinned digest) |

**Strengths**:
- Multi-stage builds (develop → build → runtime)
- Minimal runtime image (`ubi-micro` / `ubi-minimal`)
- Non-root user (USER 2000)
- Build caching (`--mount=type=cache` for go-build, go/pkg, dnf, pip)
- `Dockerfile.konflux` uses FIPS-compliant build flags (`GOEXPERIMENT=strictfipsruntime`)
- Dependency download cached before source copy
- Multi-arch support via BUILDPLATFORM/TARGETPLATFORM

**Weaknesses**:
- No HEALTHCHECK instruction in either Dockerfile
- No runtime validation (image is built but never tested)
- `Dockerfile` runtime stage uses unpinned tag (`ubi-micro:9.5`); `Dockerfile.konflux` correctly pins by digest
- No image signing or attestation in GitHub CI (Konflux handles this)

### Security

**In GitHub CI**:
- CodeQL SAST (Go) on PRs and daily schedule
- No container scanning (Trivy/Snyk) in GitHub workflows
- No secret detection (gitleaks)
- No dependency vulnerability scanning (govulncheck)

**In Konflux Push Pipeline**:
- Clair vulnerability scan
- SAST Snyk check
- ClamAV malware scan
- Coverity SAST (when available)
- Shell check, Unicode check
- RPM signature scan
- Deprecated base image check
- Ecosystem cert preflight checks

**Dependency Management**:
- Renovate bot configured (extends `konflux-central` default config)
- `go.mod` has CVE fix replacements (e.g., `golang.org/x/net` pinned for CVE-2024-45338)

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No test type rules exist
- **Quality**: N/A
- **Gaps**: No CLAUDE.md, AGENTS.md, or `.claude/` directory. No testing documentation for AI agents.
- **Recommendation**: Generate comprehensive rules with `/test-rules-generator` covering:
  - Unit test patterns (Go testing, table-driven tests, proto message comparison)
  - Integration test patterns (httptest.Server, mock gRPC server)
  - Code conventions (package structure, error handling)

## Recommendations

### Priority 0 (Critical)

1. **Add codecov integration with coverage threshold enforcement** — The `cover.out` file is already generated; adding upload and threshold takes 2-4 hours and prevents silent coverage regression.

2. **Add integration tests for the REST-to-gRPC proxy flow** — Stand up a mock gRPC inference server, configure the proxy to connect, and test actual HTTP requests through the full stack. This validates the core value proposition of the component.

3. **Add container runtime validation in PR workflow** — After `make build`, start the container and verify the process starts correctly. Even a basic "container starts without crashing" test catches binary/dependency issues.

### Priority 1 (High Value)

4. **Add unit tests for main.go** — Test `getIntegerEnv`, TLS configuration branches, and the `run()` function with mocked dependencies. Use table-driven tests for environment variable parsing.

5. **Add unit tests for bytes.go** — The `unmarshalBytesJson`, `unmarshalStringArray`, `splitRawBytes`, and `unmarshalNestedNumeric` functions handle complex parsing logic with zero coverage.

6. **Create agent rules** — Add `.claude/rules/unit-tests.md` and `.claude/rules/integration-tests.md` with Go-specific patterns, table-driven test examples, and proto message comparison guidance.

7. **Update GitHub Actions to latest versions** — All actions are on v2/v3; update to v4 for security fixes and Node.js 20 runtime.

### Priority 2 (Nice-to-Have)

8. **Add Trivy scanning to GitHub PR workflow** — Konflux has vulnerability scanning, but GitHub CI does not. Adding Trivy gives early feedback before Konflux builds.

9. **Enable gosec linter** — Currently disabled in golangci-lint. Enabling it adds security-focused static analysis to the PR workflow.

10. **Add benchmark tests for tensor marshaling** — The marshaling/unmarshaling code is on the hot path; benchmarks can catch performance regressions.

11. **Add govulncheck to CI** — Go-specific vulnerability scanning catches issues that generic scanners miss.

## Comparison to Gold Standards

| Dimension | rest-proxy | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | 6/10 | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 1/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 5/10 | 8/10 | 7/10 | 8/10 |
| Image Testing | 3/10 | 7/10 | 9/10 | 7/10 |
| Coverage Tracking | 2/10 | 8/10 | 5/10 | 9/10 |
| CI/CD Automation | 6/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 0/10 | 8/10 | 3/10 | 4/10 |
| **Overall** | **5.1/10** | **8.5/10** | **7.0/10** | **8.2/10** |

**Key Gaps vs. Gold Standards**:
- **vs. odh-dashboard**: Missing contract tests, coverage enforcement, multi-layer testing, and agent rules
- **vs. notebooks**: Missing image runtime validation and multi-layer testing strategy
- **vs. kserve**: Missing coverage enforcement, multi-version testing, and comprehensive E2E suite

## File Paths Reference

| Category | File | Notes |
|----------|------|-------|
| CI/CD | `.github/workflows/test.yml` | PR lint + test |
| CI/CD | `.github/workflows/build.yml` | Multi-arch Docker build |
| CI/CD | `.github/workflows/codeql.yml` | CodeQL SAST |
| CI/CD | `.github/workflows/create-tag-release.yml` | Release automation |
| Konflux | `.tekton/odh-mm-rest-proxy-pull-request.yaml` | PR Konflux build |
| Konflux | `.tekton/odh-mm-rest-proxy-push.yaml` | Push pipeline with security scanning |
| Build | `Dockerfile` | Standard multi-stage build |
| Build | `Dockerfile.konflux` | FIPS-compliant Konflux build |
| Build | `Makefile` | Build, test, format targets |
| Lint | `.golangci.yaml` | 10 linters enabled |
| Lint | `.pre-commit-config.yaml` | golangci-lint + prettier |
| Source | `proxy/main.go` | Server entry point (140 lines, untested) |
| Source | `proxy/request.go` | REST request deserialization (241 lines) |
| Source | `proxy/marshaler.go` | Response marshaling (206 lines) |
| Source | `proxy/bytes.go` | BYTES tensor handling (211 lines, untested) |
| Tests | `proxy/request_test.go` | Request deserialization tests (269 lines) |
| Tests | `proxy/marshaler_test.go` | Response marshaling tests (176 lines) |
| Proto | `grpc_predict_v2.proto` | KServe V2 predict proto definition |
| Generated | `gen/*.go` | Generated gRPC gateway code (do not edit) |
| Deps | `go.mod` | Go 1.23.6, controller-runtime, grpc-gateway |
| Deps | `.github/renovate.json` | Renovate extends konflux-central config |
