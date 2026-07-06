---
repository: "prometheus/blackbox_exporter"
overall_score: 6.2
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Excellent test-to-code ratio (1.4:1) with 85 test functions across all probers"
  - dimension: "Integration/E2E"
    score: 6.0
    status: "Strong integration-style tests with real servers but no dedicated E2E suite or multi-version testing"
  - dimension: "Build Integration"
    score: 5.0
    status: "Promu-based cross-platform builds on PR but no container runtime validation"
  - dimension: "Image Testing"
    score: 4.0
    status: "Multi-arch Docker builds (6 architectures) with two variants but no runtime validation or startup testing"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "No codecov integration, no coverage thresholds, no PR coverage reporting"
  - dimension: "CI/CD Automation"
    score: 7.5
    status: "Well-organized workflows with PR tests, lint, vuln scanning; automated release publishing"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory present"
critical_gaps:
  - title: "No test coverage tracking or enforcement"
    impact: "Cannot measure coverage trends or prevent regressions; no visibility into untested code paths"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container image runtime validation"
    impact: "Image startup failures or misconfigurations only caught in production"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No SAST/CodeQL integration"
    impact: "Static security vulnerabilities may go undetected in PRs"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "Missing ICMP prober tests"
    impact: "ICMP prober (icmp.go) has zero unit tests; network probing bugs could ship undetected"
    severity: "MEDIUM"
    effort: "6-8 hours"
  - title: "No pre-commit hooks"
    impact: "Style/lint issues discovered only in CI, slowing down developer feedback loops"
    severity: "LOW"
    effort: "1-2 hours"
quick_wins:
  - title: "Add codecov integration to CI workflow"
    effort: "2-4 hours"
    impact: "Immediate visibility into coverage trends with PR-level coverage diffs"
  - title: "Add CodeQL workflow for Go SAST"
    effort: "1-2 hours"
    impact: "Automated static security analysis on every PR using GitHub's free CodeQL"
  - title: "Add container startup smoke test in CI"
    effort: "2-3 hours"
    impact: "Catch image build regressions before release"
  - title: "Enable race detector in CI test run"
    effort: "0.5 hours"
    impact: "Race detection already configured in Makefile.common but confirm it runs on PRs"
  - title: "Create CLAUDE.md with test patterns"
    effort: "2-3 hours"
    impact: "Enable AI agents to generate consistent, high-quality tests following project conventions"
recommendations:
  priority_0:
    - "Add codecov/coveralls integration with minimum coverage thresholds to prevent coverage regression"
    - "Add CodeQL or gosec SAST scanning workflow to catch security issues in PRs"
    - "Add container image startup validation in CI (build image, run healthcheck)"
  priority_1:
    - "Write unit tests for ICMP prober (currently 0 tests for icmp.go)"
    - "Add E2E integration tests that exercise the full exporter binary with real probe targets"
    - "Add Trivy container image scanning for vulnerability detection"
  priority_2:
    - "Add pre-commit hooks for gofmt, golangci-lint, yamllint"
    - "Create CLAUDE.md and .claude/rules/ for AI-assisted test generation"
    - "Add SBOM generation and image signing with cosign"
---

# Quality Analysis: prometheus/blackbox_exporter

## Executive Summary
- **Overall Score: 6.2/10**
- **Repository Type**: Go CLI / Prometheus exporter
- **Primary Language**: Go 1.25+ (targeting 1.26)
- **Key Strengths**: Excellent unit test-to-code ratio (1.4:1), well-structured CI/CD with IPv6 testing, multi-arch builds (6 architectures), govulncheck integration
- **Critical Gaps**: No coverage tracking/enforcement, no SAST scanning, no container runtime validation, ICMP prober completely untested
- **Agent Rules Status**: Missing - No CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Excellent ratio (5,918 test LOC vs 4,154 source LOC), 85 test functions across all probers |
| Integration/E2E | 6.0/10 | Tests spin up real DNS/HTTP/TCP/gRPC servers, but no dedicated E2E suite |
| **Build Integration** | **5.0/10** | **Cross-platform promu builds on PR, but no container validation** |
| Image Testing | 4.0/10 | Multi-arch Docker builds (6 archs, 2 variants) but no runtime validation |
| Coverage Tracking | 2.0/10 | No codecov, no thresholds, no PR reporting |
| CI/CD Automation | 7.5/10 | Well-organized workflows, automated release pipeline, golangci-lint, govulncheck |
| Agent Rules | 0.0/10 | No AI-assisted development guidance present |

## Critical Gaps

### 1. No Test Coverage Tracking or Enforcement
- **Impact**: Cannot measure coverage trends, identify untested code, or prevent regressions
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No `.codecov.yml`, no coverage flags in CI test commands, no PR coverage checks. The `Makefile.common` `test` target runs `go test` with race detection but no `-coverprofile` flag. Coverage data is never generated or reported.

### 2. No Container Image Runtime Validation
- **Impact**: Image startup failures or configuration errors only caught when deployed
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Two Dockerfile variants exist (busybox + distroless) with proper OCI labels, but CI never builds or tests the container images on PRs. The `ci.yml` workflow runs `promu build` for cross-compilation but does not validate the Docker image can start and respond to health checks.

### 3. No SAST/CodeQL Integration
- **Impact**: Security vulnerabilities in Go code may go undetected
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: While `govulncheck` scans for known vulnerabilities in dependencies (runs daily + on PRs touching VERSION), there is no static analysis security testing (CodeQL, gosec, or Semgrep) to catch code-level security issues like injection, improper input validation, or TLS misconfigurations.

### 4. Missing ICMP Prober Tests
- **Impact**: The ICMP prober (`prober/icmp.go`) has zero unit tests despite being a core probing module
- **Severity**: MEDIUM
- **Effort**: 6-8 hours
- **Details**: Every other prober has tests (HTTP: 33 tests, TCP: 12, gRPC: 8, DNS: 5, WebSocket: 2, Unix: 2) but `icmp.go` has none. This is likely due to ICMP requiring elevated privileges, but testable patterns exist (mocking raw sockets, testing packet construction logic).

### 5. No Pre-commit Hooks
- **Impact**: Style violations and lint issues discovered only in CI
- **Severity**: LOW
- **Effort**: 1-2 hours
- **Details**: No `.pre-commit-config.yaml` present. Developers must wait for CI to catch formatting, linting, or YAML issues.

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
**Impact**: Immediate visibility into coverage trends with PR-level diffs

Add to `ci.yml`:
```yaml
- name: Run tests with coverage
  run: make test GOTEST_ARGS="-coverprofile=coverage.out -covermode=atomic"
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: coverage.out
    token: ${{ secrets.CODECOV_TOKEN }}
```

### 2. Add CodeQL Workflow (1-2 hours)
**Impact**: Free automated SAST on every PR

```yaml
name: CodeQL
on:
  push:
    branches: [master]
  pull_request:
    branches: [master]
  schedule:
    - cron: '0 6 * * 1'
jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: go
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

### 3. Add Container Startup Smoke Test (2-3 hours)
**Impact**: Catch image build regressions before release

```yaml
- name: Build Docker image
  run: |
    make build
    docker build -t blackbox-test -f Dockerfile .
- name: Smoke test container
  run: |
    docker run -d --name bbe -p 9115:9115 blackbox-test
    sleep 2
    curl -sf http://localhost:9115/metrics || exit 1
    docker rm -f bbe
```

### 4. Create CLAUDE.md with Test Patterns (2-3 hours)
**Impact**: Enable AI agents to follow project testing conventions

## Detailed Findings

### CI/CD Pipeline

**Workflows (5 total):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | PR + push (master, release-*, tags) | Go tests, IPv6 tests, cross-platform builds, release publishing |
| `golangci-lint.yml` | PR + push (Go files changed) | Linting with golangci-lint v2 |
| `govulncheck.yml` | PR (VERSION change) + push + daily cron | Go vulnerability scanning |
| `container_description.yml` | Push (README changes) | Sync README to Docker Hub + Quay.io |
| `stale.yml` | Daily cron | Mark stale PRs after 60 days |

**Strengths:**
- IPv6-specific test job (`test_ipv6`) with Docker network configuration - unusual and thorough
- Parallelized cross-platform builds (4 threads via matrix strategy)
- Pin-by-SHA for all GitHub Actions (supply chain security)
- Minimal permissions (`contents: read`) following least-privilege principle
- Automated release pipeline to Docker Hub, GHCR, and Quay.io
- Dependabot configured for both Go modules and GitHub Actions (monthly)

**Weaknesses:**
- No concurrency control on PR workflows (duplicate runs not cancelled)
- No caching for Go modules or build artifacts
- No test result artifacts or JUnit XML reporting in GitHub Actions (only in CircleCI via gotestsum)
- No branch protection enforcement visible

### Test Coverage

**Test-to-Code Ratio: 1.43:1** (5,918 test LOC / 4,154 source LOC) - Excellent

**Test Distribution by Module:**

| File | Tests | LOC | Key Focus |
|------|-------|-----|-----------|
| `prober/http_test.go` | 33 | 2,096 | HTTP status codes, TLS, compression, redirects, basic auth, OAuth2, HTTP/3 |
| `prober/tcp_test.go` | 12 | 825 | TCP connections, TLS, query-response patterns, timeouts |
| `prober/dns_test.go` | 5 | 657 | DNS resolution, UDP/TCP, recursion, DNSSEC, authorities |
| `prober/grpc_test.go` | 8 | 574 | gRPC health checks, TLS, preferred IP protocol |
| `prober/handler_test.go` | 8 | 397 | Probe handler, timeouts, metrics, multi-target |
| `prober/websocket_test.go` | 2 | 319 | WebSocket connections, query-response |
| `config/config_test.go` | 6 | 307 | Config parsing, validation, invalid configs |
| `prober/utils_test.go` | 2 | 302 | IP protocol choosing, DNS lookup |
| `prober/history_test.go` | 5 | 187 | Probe history ring buffer |
| `config/reload_test.go` | 1 | 109 | Config hot-reload |
| `prober/unix_test.go` | 2 | 76 | Unix socket probing |
| `main_test.go` | 1 | 69 | Main function/flag parsing |

**Testing Patterns:**
- Table-driven tests (Go convention)
- Real server instantiation (`httptest.NewServer`, `dns.Server`, `net.Listen`)
- TLS certificate generation in tests (self-signed certs)
- Prometheus registry isolation per test
- Context-based timeouts
- 24 testdata files for config validation edge cases

**Gap - No ICMP Tests:**
`prober/icmp.go` (one of the core probing modules) has **zero** corresponding tests. Likely due to ICMP requiring raw sockets/elevated privileges, but packet construction and response parsing logic could be unit tested.

### Code Quality

**Linting: golangci-lint v2**
- Configuration in `.golangci.yml` with v2 format
- Enabled linters: `misspell`, `sloglint`, `staticcheck`
- Only 3 linters enabled (conservative but intentional for a shared Prometheus config)
- Runs on PRs via dedicated workflow with path-based triggers (only on Go/config file changes)
- Exclusions for generated code, third-party, and common false positives

**YAML Linting:**
- `.yamllint` config present with sensible defaults
- Runs as part of `make all` target

**Code Style:**
- `gofmt` enforcement in CI via `make style`
- License header checking via `make check_license`
- Unused dependency checking via `make unused` (`go mod tidy` + diff)

**Static Analysis:**
- `staticcheck` via golangci-lint (subset of SAST)
- `govulncheck` for known vulnerability scanning (daily + PR)
- No CodeQL, gosec, or Semgrep

### Container Images

**Two Dockerfile Variants:**

1. **`Dockerfile`** (busybox variant):
   - Base: `quay.io/prometheus/busybox-${OS}-${ARCH}:latest`
   - Simple COPY of pre-built binary + config
   - Full OCI labels (10 labels including source, documentation, license)

2. **`Dockerfile.distroless`** (distroless variant):
   - Base: `gcr.io/distroless/static-debian13:nonroot-${DISTROLESS_ARCH}`
   - Runs as nonroot user (UID 65532)
   - Same OCI labels

**Multi-Architecture Support:**
- 6 architectures: `amd64`, `arm64`, `armv7`, `ppc64le`, `riscv64`, `s390x`
- Docker manifest creation for multi-arch images
- Architecture-specific build args

**Weaknesses:**
- No multi-stage builds (binary pre-built by promu externally)
- No SBOM generation
- No image signing (cosign/sigstore)
- No Trivy/Snyk vulnerability scanning
- No container runtime tests in CI
- `.dockerignore` present but not examined for completeness

### Security

**Strengths:**
- `govulncheck` runs daily + on PRs (known Go vulnerability scanning)
- Dependabot configured for Go modules and GitHub Actions (monthly)
- GitHub Actions pinned by SHA (supply chain security)
- Minimal workflow permissions (`contents: read`)
- SECURITY.md references Prometheus security policy
- DCO sign-off required for contributions

**Weaknesses:**
- No CodeQL or gosec for static application security testing
- No Trivy/Snyk for container image vulnerability scanning
- No Gitleaks or TruffleHog for secret detection
- No SBOM generation
- No image signing or attestation
- No dependency license scanning

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None - no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: Complete absence of AI-assisted development guidance
- **Recommendation**: Generate rules with `/test-rules-generator` covering:
  - Unit test patterns (table-driven tests, real server instantiation)
  - Integration test patterns (TLS cert generation, registry isolation)
  - Config validation test patterns (testdata YAML files)
  - Prober test conventions (context timeouts, promslog.NewNopLogger())

## Recommendations

### Priority 0 (Critical)

1. **Add codecov integration with coverage thresholds**
   - Generate coverage profile in CI (`-coverprofile=coverage.out`)
   - Upload to Codecov with PR commenting
   - Set minimum threshold (suggest 60% given current unknown baseline)
   - Effort: 4-6 hours

2. **Add CodeQL/SAST scanning workflow**
   - GitHub CodeQL is free for public repos
   - Go analysis catches injection, crypto issues, path traversal
   - Schedule weekly + run on PRs
   - Effort: 2-3 hours

3. **Add container image smoke testing in CI**
   - Build Docker image on PR
   - Start container and verify `/metrics` endpoint responds
   - Test both busybox and distroless variants
   - Effort: 4-6 hours

### Priority 1 (High Value)

4. **Write ICMP prober unit tests**
   - Test packet construction/parsing logic without raw sockets
   - Mock network interfaces for integration-level testing
   - This is the only prober without tests
   - Effort: 6-8 hours

5. **Add E2E integration tests**
   - Build and run the full binary
   - Configure real probe targets (HTTP, DNS, TCP)
   - Verify Prometheus metrics output
   - Effort: 8-12 hours

6. **Add Trivy container scanning**
   - Scan both Dockerfile variants
   - Set severity threshold (CRITICAL, HIGH)
   - Fail PR on new critical vulnerabilities
   - Effort: 2-3 hours

### Priority 2 (Nice-to-Have)

7. **Add pre-commit hooks**
   - gofmt, golangci-lint, yamllint, go mod tidy check
   - Effort: 1-2 hours

8. **Create CLAUDE.md and .claude/rules/**
   - Document test patterns and conventions
   - Enable AI-assisted test generation
   - Effort: 2-3 hours

9. **Add SBOM generation and image signing**
   - Use syft for SBOM, cosign for signing
   - Integrate into release pipeline
   - Effort: 4-6 hours

10. **Add concurrency control to PR workflows**
    - Cancel in-progress runs when new commits are pushed
    - Effort: 0.5 hours

## Comparison to Gold Standards

| Dimension | blackbox_exporter | odh-dashboard | notebooks | kserve |
|-----------|:-:|:-:|:-:|:-:|
| Unit Tests | 8.5 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 6.0 | 9.0 | 8.0 | 9.0 |
| Build Integration | 5.0 | 7.0 | 8.0 | 7.0 |
| Image Testing | 4.0 | 6.0 | 9.0 | 7.0 |
| Coverage Tracking | 2.0 | 8.0 | 5.0 | 9.0 |
| CI/CD Automation | 7.5 | 9.0 | 8.0 | 9.0 |
| Agent Rules | 0.0 | 8.0 | 3.0 | 2.0 |
| **Overall** | **6.2** | **8.3** | **7.2** | **8.0** |

**Key Differences from Gold Standards:**
- **vs odh-dashboard**: Missing coverage enforcement, contract tests, comprehensive agent rules
- **vs notebooks**: Missing image runtime validation, multi-layer image testing, security scanning
- **vs kserve**: Missing coverage thresholds, multi-version testing, E2E automation

## File Paths Reference

| Category | Path | Purpose |
|----------|------|---------|
| CI/CD | `.github/workflows/ci.yml` | Main CI pipeline (tests, builds, releases) |
| CI/CD | `.github/workflows/golangci-lint.yml` | Go linting |
| CI/CD | `.github/workflows/govulncheck.yml` | Vulnerability scanning |
| Build | `Makefile` + `Makefile.common` | Build targets (shared Prometheus Makefile) |
| Build | `.promu.yml` | Promu build configuration |
| Quality | `.golangci.yml` | Linter configuration (v2 format) |
| Quality | `.yamllint` | YAML linting rules |
| Container | `Dockerfile` | Busybox-based image |
| Container | `Dockerfile.distroless` | Distroless image (nonroot) |
| Tests | `prober/*_test.go` | Prober unit/integration tests |
| Tests | `config/*_test.go` | Config parsing tests |
| Tests | `config/testdata/*.yml` | Test fixture YAML files (24 files) |
| Security | `.github/dependabot.yml` | Dependency update automation |
| Security | `SECURITY.md` | Security reporting policy |
| Deps | `go.mod` | Go module dependencies |
