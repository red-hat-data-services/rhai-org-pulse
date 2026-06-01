---
repository: "red-hat-data-services/guardrails-regex-detector"
overall_score: 1.4
scorecard:
  - dimension: "Unit Tests"
    score: 2.0
    status: "Single test covering only regex_match helper; no tests for detectors or HTTP handler"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests exist; no HTTP endpoint testing"
  - dimension: "Build Integration"
    score: 1.5
    status: "Dockerfile multi-stage has test/lint/format stages but no CI triggers them on PRs"
  - dimension: "Image Testing"
    score: 3.0
    status: "Multi-stage Dockerfile with test/lint/format stages and UBI base image; no runtime validation or scanning"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage generation, no codecov, no thresholds"
  - dimension: "CI/CD Automation"
    score: 0.5
    status: "No CI/CD workflows; no GitHub Actions, GitLab CI, or Jenkinsfile"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No CI/CD pipeline exists"
    impact: "No automated testing, linting, or building on PRs or merges — all quality gates rely on manual Docker builds"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "Near-zero test coverage"
    impact: "Only 1 unit test exists for a helper function; builtin detectors (email, SSN, credit card) and HTTP handler are completely untested"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No integration or E2E tests"
    impact: "API endpoint behavior, request validation, error handling, and multi-detector interactions are never tested"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No security scanning"
    impact: "No vulnerability scanning, dependency auditing (cargo audit), SAST, or secret detection"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No coverage tracking"
    impact: "Cannot measure or enforce test coverage; regressions in coverage go unnoticed"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add GitHub Actions CI workflow with cargo test, clippy, and fmt"
    effort: "2-3 hours"
    impact: "Automated quality gates on every PR — prevents untested or unformatted code from merging"
  - title: "Add unit tests for email, SSN, and credit card detectors"
    effort: "2-3 hours"
    impact: "Cover the three builtin PII detectors with positive, negative, and edge-case tests"
  - title: "Add cargo-audit to dependency scanning"
    effort: "1 hour"
    impact: "Detect known vulnerabilities in Rust dependencies automatically"
  - title: "Add Trivy scanning to Dockerfile or CI"
    effort: "1-2 hours"
    impact: "Detect container image vulnerabilities before deployment"
recommendations:
  priority_0:
    - "Create a GitHub Actions CI workflow that runs cargo test, cargo clippy, and cargo fmt --check on every PR"
    - "Add comprehensive unit tests for all three builtin detectors (email, SSN, credit card) with positive matches, negative matches, and edge cases"
    - "Add integration tests for the HTTP handler (handle_text_contents) covering valid requests, empty regex, invalid regex, and error responses"
  priority_1:
    - "Add cargo-tarpaulin or llvm-cov for coverage generation and integrate with codecov"
    - "Add cargo-audit for dependency vulnerability scanning in CI"
    - "Add Trivy container scanning step to CI or Dockerfile"
    - "Add endpoint-level integration tests using axum::test or similar HTTP test framework"
  priority_2:
    - "Create CLAUDE.md and .claude/rules/ with test automation guidance for AI agents"
    - "Add pre-commit hooks for fmt and clippy checks"
    - "Add SBOM generation for the container image"
    - "Add multi-architecture container builds (amd64/arm64)"
    - "Add performance/load testing for the regex detection endpoint"
---

# Quality Analysis: guardrails-regex-detector

## Executive Summary

- **Overall Score: 1.4/10**
- **Repository Type**: Rust HTTP microservice (Axum web framework)
- **Purpose**: Regex-based PII detection service for [FMS Guardrails Orchestrator](https://github.com/foundation-model-stack/fms-guardrails-orchestrator)
- **Size**: 212 lines of code across 2 source files, very small codebase
- **Key Strengths**: Multi-stage Dockerfile with test/lint/format stages; UBI base image; Clippy + rustfmt configured
- **Critical Gaps**: No CI/CD pipeline, near-zero test coverage (1 test), no integration/E2E tests, no security scanning, no coverage tracking
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

This repository is in an **early-stage / prototype** quality posture. While the multi-stage Dockerfile shows quality awareness (separate test, lint, format stages), the complete absence of CI/CD means these stages only run during manual Docker builds. The codebase has only 1 unit test covering a helper function, with all three builtin PII detectors and the HTTP handler completely untested.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 2.0/10 | Single test for `regex_match` helper; email/SSN/credit card detectors untested |
| Integration/E2E | 0.0/10 | No integration or endpoint tests exist |
| **Build Integration** | **1.5/10** | **Dockerfile has test/lint/format stages but no CI triggers them on PRs** |
| Image Testing | 3.0/10 | Multi-stage Dockerfile with UBI base; no runtime validation or scanning |
| Coverage Tracking | 0.0/10 | No coverage generation, reporting, or enforcement |
| CI/CD Automation | 0.5/10 | No CI/CD workflows of any kind |
| Agent Rules | 0.0/10 | No agent rules or test automation guidance |

## Critical Gaps

### 1. No CI/CD Pipeline Exists
- **Impact**: No automated testing, linting, or building on PRs or merges
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: There is no `.github/workflows/` directory, no `.gitlab-ci.yml`, no `Jenkinsfile`, and no `Makefile`. The only automation is embedded in Dockerfile multi-stage build targets (`tests`, `lint`, `format`), which must be explicitly targeted during Docker builds. PRs can be merged with zero quality gates.

### 2. Near-Zero Test Coverage
- **Impact**: Regressions in PII detection logic will go unnoticed
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: The entire test suite consists of a single test (`test_regex_match` at `detectors.rs:145`) that verifies `regex_match` with a simple numeric pattern. None of the three builtin detectors are tested:
  - `email_address_detector` — untested
  - `ssn_detector` — untested (complex regex with multiple SSN formats)
  - `credit_card_detector` — untested (Visa, Mastercard, Amex, etc.)
- Test-to-code ratio: ~25 lines test / ~140 lines code = 0.18 (very low)

### 3. No Integration or E2E Tests
- **Impact**: API contract, request validation, and multi-detector behavior are never verified
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Details**: The HTTP handler `handle_text_contents` is untested. No tests verify:
  - Valid request/response format (API contract)
  - Empty regex parameter rejection (400 error path)
  - Custom regex handling alongside builtin detectors
  - Multiple content strings with multiple regex patterns
  - Invalid regex graceful handling
  - Health endpoint (`/health`)

### 4. No Security Scanning
- **Impact**: Vulnerable dependencies or container image issues go undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No vulnerability scanning of any kind:
  - No `cargo audit` for Rust dependency vulnerabilities
  - No Trivy/Snyk for container image scanning
  - No CodeQL or SAST
  - No secret detection (Gitleaks, TruffleHog)
  - No SBOM generation

### 5. No Coverage Tracking
- **Impact**: Cannot measure or enforce minimum test coverage
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: No coverage tool (cargo-tarpaulin, llvm-cov), no codecov/coveralls integration, no coverage thresholds or PR reporting.

## Quick Wins

### 1. Add GitHub Actions CI Workflow (2-3 hours)
Create `.github/workflows/ci.yml` with cargo test, clippy, and fmt checks:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy, rustfmt
      - uses: Swatinem/rust-cache@v2
      - run: cargo fmt --check
      - run: cargo clippy --all-targets --all-features -- -D warnings
      - run: cargo test
```

### 2. Add Unit Tests for Builtin Detectors (2-3 hours)
Add tests for each detector function with positive, negative, and edge cases:

```rust
#[test]
fn test_email_detector_valid() {
    let result = email_address_detector(&"contact user@example.com now".to_string()).unwrap();
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].text, "user@example.com");
    assert_eq!(result[0].detection, "EmailAddress");
}

#[test]
fn test_email_detector_no_match() {
    let result = email_address_detector(&"no email here".to_string()).unwrap();
    assert!(result.is_empty());
}

#[test]
fn test_ssn_detector_dashed_format() {
    let result = ssn_detector(&"SSN is 123-45-6789".to_string()).unwrap();
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].detection, "SocialSecurity");
}

#[test]
fn test_credit_card_detector_visa() {
    let result = credit_card_detector(&"card 4111111111111111".to_string()).unwrap();
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].detection, "CreditCard");
}
```

### 3. Add cargo-audit (1 hour)
```yaml
# Add to CI workflow
- name: Security audit
  run: |
    cargo install cargo-audit
    cargo audit
```

### 4. Add Trivy Scanning (1-2 hours)
```yaml
# Add to CI workflow after Docker build
- name: Trivy scan
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'regex-detector:${{ github.sha }}'
    severity: 'CRITICAL,HIGH'
```

## Detailed Findings

### CI/CD Pipeline
- **Workflows**: None — no `.github/workflows/`, `.gitlab-ci.yml`, or `Jenkinsfile`
- **Automation**: Zero — the only quality checks are Dockerfile multi-stage targets
- **Dockerfile stages** (the only automation that exists):
  - `tests` stage: runs `cargo test`
  - `lint` stage: runs `cargo clippy --all-targets --all-features -- -D warnings`
  - `format` stage: runs `cargo fmt --check`
  - These stages are **not connected to any CI** and must be explicitly built
- **Build caching**: None
- **Concurrency control**: N/A (no CI)

### Test Coverage

#### Unit Tests
- **Framework**: Rust built-in `#[cfg(test)]` module
- **Test count**: 1 test (`test_regex_match`)
- **What's tested**: The `regex_match` helper function with a simple numeric regex
- **What's NOT tested**:
  - `email_address_detector` function
  - `ssn_detector` function (has complex regex with 5+ format variations)
  - `credit_card_detector` function (handles Visa, MC, Amex, Discover)
  - `handle_text_contents` HTTP handler
  - Error paths (empty regex, invalid regex)
  - Edge cases (empty content, overlapping matches, Unicode)
  - The `main()` function / server startup

#### Integration Tests
- **Status**: None exist
- **Missing**: HTTP endpoint tests, multi-detector interaction tests, payload validation tests

#### E2E Tests
- **Status**: None exist
- **Missing**: Full request/response cycle testing, deployment validation

### Code Quality

#### Linting
- **Clippy**: Configured in `rust-toolchain.toml` (components = ["clippy"]) and run in Dockerfile `lint` stage
- **rustfmt**: Configured in `rust-toolchain.toml` (components = ["rustfmt"]) and run in Dockerfile `format` stage
- **Enforcement**: Only during Docker build, not on PRs

#### Static Analysis
- **SAST**: None (no CodeQL, Semgrep, or equivalent)
- **Dependency scanning**: None (no `cargo audit`)
- **Secret detection**: None

#### Pre-commit Hooks
- **Status**: None (no `.pre-commit-config.yaml`)

### Container Images

#### Build Process
- **Dockerfile**: Multi-stage build (5 stages)
  1. `rust-builder` — Rust 1.84.0 base with rustfmt
  2. `regex-detector-builder` — Copies source and builds binary
  3. `tests` — Runs `cargo test`
  4. `lint` — Runs `cargo clippy`
  5. `format` — Runs `cargo fmt --check`
  6. `regex-detector-release` — UBI9 minimal release image
- **Base image**: `registry.access.redhat.com/ubi9/ubi-minimal` (good — Red Hat certified)
- **Multi-arch**: Not configured (single architecture only)

#### Runtime Testing
- No image startup validation
- No functional testing (no Testcontainers equivalent)
- No health check verification after container start
- Note: The `/health` endpoint exists in code but is never tested

#### Security Scanning
- No Trivy/Snyk/Grype scanning
- No SBOM generation
- No image signing/attestation
- No `.trivyignore` or vulnerability suppression config

### Security Practices
- **Container scanning**: None
- **SAST**: None
- **Dependency scanning**: None (no `cargo audit`)
- **Secret detection**: None
- **Positive**: UBI9 minimal base image reduces attack surface
- **Concern**: `compat-openssl11` installed in release image — compatibility package may carry known CVEs

### Agent Rules (Agentic Flow Quality)
- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **Test automation guidance**: None
- **Recommendation**: Create `.claude/rules/` with Rust test patterns, detector testing templates, and HTTP handler test guidance. Use `/test-rules-generator` skill to bootstrap.

## Recommendations

### Priority 0 (Critical)
1. **Create GitHub Actions CI workflow** — Add `cargo test`, `cargo clippy`, and `cargo fmt --check` running on every PR and push to main. This is the single highest-impact improvement.
2. **Add comprehensive unit tests for all builtin detectors** — Each detector (email, SSN, credit card) needs positive-match, negative-match, multi-match, and edge-case tests. The SSN detector's complex regex (5+ format variants) is particularly risky without tests.
3. **Add HTTP handler integration tests** — Use `axum::test` helpers or construct test requests to verify `handle_text_contents` end-to-end, including error responses.

### Priority 1 (High Value)
4. **Add coverage tracking** — Use `cargo-tarpaulin` or `llvm-cov` in CI with codecov integration. Set a minimum threshold (e.g., 70%) and enforce on PRs.
5. **Add `cargo audit` for dependency scanning** — Detect known CVEs in Rust crate dependencies.
6. **Add Trivy container scanning** — Scan the release image for vulnerabilities. The `compat-openssl11` package deserves particular scrutiny.
7. **Add endpoint integration tests** — Test the full request/response cycle including JSON serialization, status codes, and error messages.

### Priority 2 (Nice-to-Have)
8. **Create CLAUDE.md and `.claude/rules/`** — Add test automation guidance for AI agents contributing to this repo.
9. **Add pre-commit hooks** — Run `cargo fmt` and `cargo clippy` locally before commits.
10. **Add SBOM generation** — Generate Software Bill of Materials during container builds.
11. **Add multi-architecture builds** — Support both amd64 and arm64 container images.
12. **Add performance testing** — Benchmark regex detection throughput for large text payloads.
13. **Investigate `compat-openssl11`** — Evaluate whether this legacy compatibility package is truly needed or if the app can use the standard OpenSSL 3.x.

## Comparison to Gold Standards

| Dimension | guardrails-regex-detector | odh-dashboard | notebooks | kserve |
|-----------|--------------------------|---------------|-----------|--------|
| Unit Tests | 1 test (2/10) | Comprehensive Jest suite (9/10) | Python test suites (7/10) | Go testing with table-driven tests (8/10) |
| Integration/E2E | None (0/10) | Cypress E2E + contract tests (9/10) | Image validation pipeline (8/10) | Multi-version E2E suite (9/10) |
| Build Integration | Dockerfile only (1.5/10) | PR-time build + Konflux (8/10) | Multi-image build pipeline (7/10) | PR build validation (8/10) |
| Coverage | None (0/10) | Codecov with enforcement (9/10) | Basic coverage (5/10) | Codecov integration (8/10) |
| CI/CD | None (0.5/10) | Multi-workflow with caching (9/10) | Periodic + PR workflows (8/10) | Prow + GitHub Actions (9/10) |
| Security | None (1/10) | Snyk + SAST (7/10) | Image scanning (6/10) | CodeQL + Trivy (8/10) |
| Agent Rules | None (0/10) | Comprehensive .claude/rules/ (9/10) | None (0/10) | None (0/10) |

## File Paths Reference

| File | Purpose |
|------|---------|
| `src/main.rs` | HTTP server setup (Axum router, health endpoint, port config) |
| `src/detectors.rs` | PII detector logic (email, SSN, credit card) + HTTP handler + 1 unit test |
| `Cargo.toml` | Rust dependencies (axum 0.7.9, regex, serde, tokio, tower-http, tracing) |
| `Cargo.lock` | Locked dependency versions |
| `Dockerfile` | Multi-stage build with test/lint/format/release stages |
| `rust-toolchain.toml` | Rust 1.84.0 with clippy + rustfmt components |
| `.gitignore` | Ignores `/target` directory only |
| `README.md` | Basic usage documentation with sample curl commands |
