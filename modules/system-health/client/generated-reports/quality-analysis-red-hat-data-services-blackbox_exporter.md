---
repository: "red-hat-data-services/blackbox_exporter"
overall_score: 4.3
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Good test coverage for probers (HTTP, DNS, TCP, gRPC) with 58 test functions; missing tests for ICMP, TLS, and prober.go"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "CircleCI IPv6 integration test only; no E2E suite, no deployment testing, no multi-version testing"
  - dimension: "Build Integration"
    score: 2.0
    status: "No PR-time image build validation; no Konflux simulation; no startup testing"
  - dimension: "Image Testing"
    score: 2.0
    status: "Basic Dockerfile present but no runtime validation, no vulnerability scanning, no SBOM"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage generation, no codecov/coveralls, no coverage thresholds or PR reporting"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "CircleCI + GitHub Actions golangci-lint; outdated Go versions; no concurrency control; limited caching"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no test automation guidance for AI agents"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Cannot measure test coverage, regressions go undetected, no coverage gates on PRs"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container image security scanning"
    impact: "Vulnerabilities in base images and dependencies not detected until production"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No PR-time build integration testing"
    impact: "Build failures discovered only after merge; no image validation on PRs"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "Missing test coverage for ICMP prober (376 lines untested)"
    impact: "ICMP probing is a core function with zero test coverage"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Outdated Go version and CI tooling"
    impact: "Go 1.18/1.19 is end-of-life; outdated golangci-lint v1.45.2; security vulnerabilities in old dependencies"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No E2E or deployment testing"
    impact: "No validation that the exporter works correctly in a real environment"
    severity: "MEDIUM"
    effort: "8-16 hours"
quick_wins:
  - title: "Add Trivy scanning to CI workflow"
    effort: "1-2 hours"
    impact: "Immediate vulnerability detection for container images and dependencies"
  - title: "Add codecov integration with coverage reporting"
    effort: "2-4 hours"
    impact: "Track test coverage, set thresholds, get PR coverage reports"
  - title: "Update Go version to 1.22+ and golangci-lint to latest"
    effort: "2-3 hours"
    impact: "Security fixes, better linting, modern Go features"
  - title: "Add basic agent rules for test creation patterns"
    effort: "2-3 hours"
    impact: "Enable consistent AI-assisted test generation"
  - title: "Enable additional golangci-lint linters beyond staticcheck"
    effort: "1-2 hours"
    impact: "Catch more code quality issues early"
recommendations:
  priority_0:
    - "Add coverage tracking (codecov) with minimum threshold enforcement on PRs"
    - "Integrate Trivy container scanning into CI pipeline"
    - "Update Go version to 1.22+ and all CI tooling versions"
    - "Add unit tests for ICMP prober (376 lines with zero test coverage)"
  priority_1:
    - "Add PR-time Docker image build and startup validation"
    - "Create E2E test suite that deploys and probes real targets"
    - "Enable comprehensive golangci-lint configuration (errcheck, govet, ineffassign, etc.)"
    - "Add CodeQL or gosec SAST scanning"
  priority_2:
    - "Create agent rules (.claude/rules/) for test creation patterns"
    - "Add SBOM generation and image signing"
    - "Implement multi-architecture CI testing"
    - "Add performance/benchmark regression testing"
---

# Quality Analysis: blackbox_exporter

## Executive Summary

- **Overall Score: 4.3/10**
- **Repository**: [red-hat-data-services/blackbox_exporter](https://github.com/red-hat-data-services/blackbox_exporter) (fork of prometheus/blackbox_exporter v0.23.0)
- **Type**: Go CLI / Prometheus exporter
- **Language**: Go 1.18 (end-of-life)
- **Key Strengths**: Solid unit test coverage for core probers (HTTP, DNS, TCP, gRPC), well-structured test data, CircleCI pipeline with IPv6 testing
- **Critical Gaps**: No coverage tracking, no security scanning, outdated tooling, missing ICMP tests, no E2E/deployment testing, no agent rules
- **Agent Rules Status**: Missing

This is a Red Hat Data Services fork of the upstream Prometheus blackbox_exporter. It appears to be a relatively thin fork with only 1 commit visible. The project has inherited Prometheus's testing infrastructure but lacks Red Hat-specific quality enhancements like security scanning, coverage enforcement, and modern CI practices.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.0/10 | Good coverage for HTTP/DNS/TCP/gRPC probers; ICMP untested |
| Integration/E2E | 3.0/10 | Only CircleCI IPv6 integration test; no E2E suite |
| **Build Integration** | **2.0/10** | **No PR-time image build; no Konflux simulation** |
| Image Testing | 2.0/10 | Basic Dockerfile; no runtime validation or scanning |
| Coverage Tracking | 1.0/10 | No coverage generation, reporting, or enforcement |
| CI/CD Automation | 5.0/10 | CircleCI + GH Actions; outdated versions; limited scope |
| Agent Rules | 0.0/10 | No agent rules or test automation guidance |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: Cannot measure or track test coverage; regressions go undetected; no coverage gates on PRs
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No `coverprofile` flags in Makefile, no codecov/coveralls integration, no `.codecov.yml`, no coverage reporting in CI
- **Recommendation**: Add `-coverprofile=coverage.out -covermode=atomic` to test commands and integrate codecov

### 2. No Container Image Security Scanning
- **Impact**: Vulnerabilities in base images (`quay.io/prometheus/busybox-*`) and Go dependencies not detected
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: No Trivy, Snyk, or any vulnerability scanner configured. No SBOM generation. No image signing.
- **Recommendation**: Add Trivy scanning as a GitHub Actions workflow

### 3. No PR-Time Build Integration Testing
- **Impact**: Build failures only discovered after merge; no image validation during PR review
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The GitHub Actions workflow only runs golangci-lint. No image build, no binary build validation on PRs. CircleCI builds on all branches but doesn't test the container image.
- **Recommendation**: Add Docker build + startup test to PR workflow

### 4. Missing ICMP Prober Tests (376 Lines Untested)
- **Impact**: ICMP probing is a core function with zero test coverage
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: `prober/icmp.go` (376 lines) has no corresponding `icmp_test.go`. Similarly, `prober/tls.go` (85 lines) and `prober/prober.go` (48 lines) lack tests.
- **Recommendation**: Create `icmp_test.go` with at least basic probe validation tests

### 5. Outdated Go Version and CI Tooling
- **Impact**: Go 1.18/1.19 is end-of-life with known security vulnerabilities; outdated linting tools miss modern issues
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**:
  - `go.mod`: Go 1.18
  - `.promu.yml`: Go 1.19
  - `golangci-lint.yml`: uses `actions/checkout@v3` (v4 available), `actions/setup-go@v2` (v5 available), golangci-lint v1.45.2 (v1.61+ available)
  - CircleCI: `cimg/go:1.19`
- **Recommendation**: Update to Go 1.22+ and latest action versions

### 6. No E2E or Deployment Testing
- **Impact**: No validation that the exporter works correctly in a Kubernetes/container environment
- **Severity**: MEDIUM
- **Effort**: 8-16 hours
- **Details**: No E2E tests that deploy the exporter and verify it can probe targets. IPv6 test in CircleCI is the closest to integration testing.

## Quick Wins

### 1. Add Trivy Scanning to CI (1-2 hours)
```yaml
# .github/workflows/trivy.yml
name: Trivy Security Scan
on:
  pull_request:
  push:
    branches: [main, master]
jobs:
  trivy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'HIGH,CRITICAL'
          exit-code: '1'
```

### 2. Add Codecov Integration (2-4 hours)
```yaml
# Add to CircleCI config.yml test job:
- run: make test GOTEST_FLAGS="-coverprofile=coverage.out -covermode=atomic"
- run: bash <(curl -s https://codecov.io/bash)
```

### 3. Update Go and Tooling Versions (2-3 hours)
- Update `go.mod` to `go 1.22`
- Update `.promu.yml` to Go 1.22
- Update CircleCI to `cimg/go:1.22`
- Update GitHub Actions to `actions/checkout@v4`, `actions/setup-go@v5`, golangci-lint latest

### 4. Enable More Linters (1-2 hours)
```yaml
# .golangci.yml - expand from staticcheck-only
linters:
  enable:
    - staticcheck
    - errcheck
    - govet
    - ineffassign
    - unused
    - gosec
    - bodyclose
    - gocritic
```

### 5. Add Agent Rules (2-3 hours)
- Create `.claude/rules/unit-tests.md` with Go testing patterns
- Create `.claude/rules/integration-tests.md` with prober testing guidance

## Detailed Findings

### CI/CD Pipeline

**CircleCI (Primary CI)**
- **Workflows**: `test`, `test-ipv6`, `build`, `publish_master`, `publish_release`
- **Strengths**:
  - Separate IPv6 testing using machine executor (addresses a real constraint - ICMP needs raw sockets)
  - Build gating on test success before publish
  - Tag-based release publishing
- **Weaknesses**:
  - Outdated Go version (1.19)
  - No coverage generation
  - No caching configured
  - No concurrency control
  - `make` runs full build including all checks, but doesn't generate coverage

**GitHub Actions (Secondary - Lint Only)**
- **Workflows**: `golangci-lint.yml` only
- **Strengths**:
  - Path-filtered triggers (only runs when Go files change)
  - Runs on both push and PR
- **Weaknesses**:
  - Outdated versions: actions/checkout@v3, actions/setup-go@v2, golangci-lint v1.45.2
  - Only runs staticcheck (one linter)
  - No other GitHub Actions workflows (no security scanning, no image build)

**Dependabot**
- Configured for monthly `gomod` updates
- No Dependabot security alerts configuration

### Test Coverage

**Unit Tests (9 test files, 3,990 lines of test code)**

| Test File | Lines | Test Funcs | Source File | Source Lines |
|-----------|-------|------------|-------------|--------------|
| `prober/http_test.go` | 1,407 | 25 | `prober/http.go` | 667 |
| `prober/tcp_test.go` | 685 | 9 | `prober/tcp.go` | 203 |
| `prober/dns_test.go` | 657 | 5 | `prober/dns.go` | 317 |
| `prober/grpc_test.go` | 416 | 6 | `prober/grpc.go` | 225 |
| `prober/utils_test.go` | 254 | - | `prober/utils.go` | 144 |
| `config/config_test.go` | 216 | 4 | `config/config.go` | 512 |
| `prober/handler_test.go` | 205 | 5 | `prober/handler.go` | 231 |
| `prober/history_test.go` | 81 | - | `prober/history.go` | 98 |
| `main_test.go` | 69 | 1 | `main.go` | 300 |

**Test-to-Code Ratio**: 3,990 test lines / 3,206 source lines = **1.24:1** (good ratio)

**Testing Patterns**:
- Standard `testing` package (no testify/require)
- Table-driven tests with `t.Run()` subtests
- `httptest.NewServer` for HTTP testing
- TLS certificate generation for security tests
- Comprehensive test data files in `config/testdata/` (16 files)

**Untested Source Files**:
- `prober/icmp.go` (376 lines) - **No test file at all** - significant gap for a core prober
- `prober/tls.go` (85 lines) - No dedicated tests (some TLS testing happens in http_test.go)
- `prober/prober.go` (48 lines) - No dedicated tests (type definitions)

### Code Quality

**Linting**:
- `.golangci.yml`: Only `staticcheck` enabled with `disable-all: true`
- golangci-lint workflow uses outdated v1.45.2
- No errcheck, govet, ineffassign, gosec, or other standard linters

**YAML Linting**:
- `.yamllint` configured with reasonable rules
- References workflows that don't exist in this fork (codeql-analysis.yml, funcbench.yml, etc.)

**Code Formatting**:
- `gofmt` check in Makefile.common (`common-style` target)
- License header checking (`common-check_license` target)
- `go mod tidy` unused dependency checking (`common-unused` target)

**Pre-commit Hooks**: None configured

### Container Images

**Dockerfile Analysis**:
- Single-stage copy-based Dockerfile (binary pre-built by promu)
- Multi-architecture support via ARGs: `amd64`, `armv7`, `arm64`, `ppc64le`
- Base image: `quay.io/prometheus/busybox-${OS}-${ARCH}:latest` (minimal base - good)
- No health check defined
- No non-root user configuration
- `.dockerignore` present but minimal

**Container Testing**: None
- No image startup validation
- No container runtime testing
- No vulnerability scanning
- No SBOM generation
- No image signing/attestation

### Security

**Current State**: Minimal
- No SAST tools (CodeQL, gosec, Semgrep)
- No container scanning (Trivy, Snyk, Grype)
- No secret detection (Gitleaks, TruffleHog)
- No dependency vulnerability scanning beyond Dependabot monthly updates
- No security policy beyond `SECURITY.md` (inherited from Prometheus)

**Dependabot**: Monthly gomod updates only - no security alert configuration

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None - no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: All test types lack agent rules
- **Recommendation**: Generate rules with `/test-rules-generator` covering:
  - Go unit test patterns (table-driven, httptest, TLS)
  - Integration test patterns (IPv6, network probing)
  - Configuration validation test patterns

## Recommendations

### Priority 0 (Critical)

1. **Add coverage tracking with codecov** - No visibility into test coverage; cannot set gates or track regressions
2. **Integrate Trivy container/filesystem scanning** - No security scanning of any kind
3. **Update Go to 1.22+ and all CI tool versions** - Running end-of-life Go with known CVEs
4. **Add ICMP prober unit tests** - 376 lines of core functionality with zero test coverage

### Priority 1 (High Value)

1. **Add PR-time Docker image build and startup test** - Validate images before merge
2. **Create E2E test suite** - Deploy exporter and verify probing against real targets
3. **Expand golangci-lint configuration** - Enable errcheck, govet, gosec, bodyclose, etc.
4. **Add CodeQL or gosec for SAST** - Static application security testing
5. **Consolidate CI to GitHub Actions** - Running both CircleCI and GitHub Actions is fragmented

### Priority 2 (Nice-to-Have)

1. **Create agent rules** (`.claude/rules/`) for consistent AI-assisted development
2. **Add SBOM generation** with Syft or similar tool
3. **Add image signing** with cosign/sigstore
4. **Add benchmark regression testing** - Prometheus exporter performance matters
5. **Add pre-commit hooks** for local development quality gates
6. **Migrate from kingpin to cobra** for CLI argument parsing (kingpin is deprecated)

## Comparison to Gold Standards

| Dimension | blackbox_exporter | odh-dashboard | notebooks | kserve |
|-----------|:-:|:-:|:-:|:-:|
| Unit Tests | 7 | 9 | 7 | 9 |
| Integration/E2E | 3 | 9 | 8 | 9 |
| Build Integration | 2 | 8 | 7 | 7 |
| Image Testing | 2 | 7 | 9 | 6 |
| Coverage Tracking | 1 | 8 | 5 | 9 |
| CI/CD Automation | 5 | 9 | 8 | 9 |
| Agent Rules | 0 | 8 | 3 | 2 |
| **Overall** | **4.3** | **8.5** | **7.2** | **7.8** |

**Key Gaps vs Gold Standards**:
- No coverage tracking (odh-dashboard and kserve both have codecov with enforcement)
- No security scanning (all gold standards have at least one scanner)
- No E2E testing (odh-dashboard has Cypress, kserve has full deployment tests)
- No agent rules (odh-dashboard has comprehensive `.claude/rules/`)
- Outdated tooling (gold standards use current Go and CI action versions)

## File Paths Reference

| Category | Path | Notes |
|----------|------|-------|
| CI - CircleCI | `.circleci/config.yml` | Primary CI with test, build, publish |
| CI - GitHub Actions | `.github/workflows/golangci-lint.yml` | Lint only |
| Linting | `.golangci.yml` | staticcheck only |
| Dockerfile | `Dockerfile` | Multi-arch, single-stage copy |
| Docker ignore | `.dockerignore` | Minimal |
| Build tool | `.promu.yml` | Prometheus build tool |
| Makefile | `Makefile`, `Makefile.common` | Prometheus standard make targets |
| Dependabot | `.github/dependabot.yml` | Monthly gomod updates |
| YAML lint | `.yamllint` | YAML validation rules |
| Test data | `config/testdata/` | 16 YAML test fixtures |
| Go module | `go.mod` | Go 1.18 |
| Version | `VERSION` | 0.23.0 |
