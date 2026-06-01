---
repository: "trustyai-explainability/guardrails-regex-detector"
overall_score: 1.0
scorecard:
  - dimension: "Unit Tests"
    score: 2.0
    status: "Only 1 test function covering basic regex matching; no tests for built-in detectors, HTTP handlers, or error paths"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests; no HTTP-level API testing"
  - dimension: "Build Integration"
    score: 2.0
    status: "Dockerfile has test/lint/format stages but no CI pipeline invokes them"
  - dimension: "Image Testing"
    score: 3.0
    status: "Multi-stage Dockerfile with UBI9 base; no vulnerability scanning, SBOM, or runtime validation"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage generation, no codecov integration, no thresholds"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "No GitHub Actions workflows, no CI/CD of any kind"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no test automation guidance"
critical_gaps:
  - title: "No CI/CD pipeline exists"
    impact: "Nothing runs automatically on PRs — no tests, no linting, no builds. All quality checks are manual."
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "Near-zero test coverage"
    impact: "Only 1 test covers basic regex matching. Built-in detectors (email, SSN, credit card), the HTTP handler, error paths, and edge cases are completely untested."
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No integration or API-level tests"
    impact: "The HTTP API contract is untested. Breaking changes to request/response format will not be caught before deployment."
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No security scanning"
    impact: "89 transitive dependencies with no vulnerability scanning. Container image has no Trivy/Snyk checks."
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No coverage tracking"
    impact: "Impossible to measure test quality or enforce minimum coverage thresholds."
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add GitHub Actions workflow with cargo test + clippy + fmt"
    effort: "2-3 hours"
    impact: "Establishes baseline CI — every PR gets tested, linted, and format-checked automatically"
  - title: "Add unit tests for built-in detectors (email, SSN, credit card)"
    effort: "2-4 hours"
    impact: "Immediately raises coverage for the core business logic with minimal effort"
  - title: "Add cargo-audit for dependency vulnerability scanning"
    effort: "1-2 hours"
    impact: "Catches known CVEs in 89 transitive dependencies"
  - title: "Add Trivy container scanning to Dockerfile or CI"
    effort: "1-2 hours"
    impact: "Catches vulnerabilities in the UBI9 base image and installed packages"
recommendations:
  priority_0:
    - "Create a GitHub Actions CI workflow with cargo test, clippy, fmt, and cargo-audit on every PR"
    - "Write unit tests for all three built-in detectors (email, SSN, credit card) including edge cases and false positives"
    - "Add HTTP-level integration tests using axum's built-in test utilities (no need for external frameworks)"
  priority_1:
    - "Add cargo-tarpaulin or llvm-cov for coverage generation with codecov integration"
    - "Add Trivy scanning to CI for both dependency and container image vulnerabilities"
    - "Add API contract tests validating request/response schema compatibility with FMS Guardrails Orchestrator"
    - "Create CLAUDE.md with test creation rules and coding standards"
  priority_2:
    - "Add multi-architecture image builds (amd64/arm64)"
    - "Add SBOM generation (syft or cargo-sbom)"
    - "Add property-based testing with proptest for regex edge cases"
    - "Add benchmarks for regex matching performance"
---

# Quality Analysis: guardrails-regex-detector

## Executive Summary
- **Overall Score: 1.0/10**
- **Key Strengths**: Multi-stage Dockerfile with test/lint/format stages; clean Rust project structure; UBI9 minimal base image
- **Critical Gaps**: No CI/CD pipeline, near-zero test coverage (1 test), no security scanning, no coverage tracking
- **Agent Rules Status**: Missing — no CLAUDE.md, no `.claude/` directory

This repository is a small but production-relevant Rust microservice that serves as a regex-based PII detector for the FMS Guardrails Orchestrator. Despite its small size (212 lines of Rust), it has almost no quality infrastructure. The Dockerfile contains test, lint, and format stages that demonstrate awareness of quality practices, but these are not connected to any CI/CD pipeline and thus provide no automated protection.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 2/10 | 1 test function; no tests for built-in detectors or HTTP handler |
| Integration/E2E | 0/10 | No integration or E2E tests of any kind |
| **Build Integration** | **2/10** | **Dockerfile stages exist but no CI pipeline invokes them** |
| Image Testing | 3/10 | Multi-stage Dockerfile with UBI9 base; no scanning or runtime validation |
| Coverage Tracking | 0/10 | No coverage generation or enforcement |
| CI/CD Automation | 0/10 | No GitHub Actions or any CI/CD system |
| Agent Rules | 0/10 | No CLAUDE.md, no `.claude/` directory |

## Critical Gaps

### 1. No CI/CD Pipeline (Severity: HIGH)
- **Impact**: Nothing runs automatically on pull requests. Tests, linting, formatting, and builds are all manual.
- **Current State**: Zero GitHub Actions workflows. The most recent commit references "update-gha" but no workflows exist in the repository.
- **Effort**: 4-8 hours to establish a complete CI pipeline
- **Risk**: Any contributor can merge broken code, security vulnerabilities, or formatting inconsistencies without detection.

### 2. Near-Zero Test Coverage (Severity: HIGH)
- **Impact**: The core business logic — PII detection for email addresses, SSNs, and credit cards — is untested. Only a basic regex matching helper has a single test.
- **Current State**: 1 test function (`test_regex_match`) in `src/detectors.rs` that tests a simple numeric regex. The actual detectors that ship to production (email, SSN, credit card) have zero test coverage.
- **Effort**: 8-16 hours to achieve reasonable coverage
- **Risk**: Regex patterns for PII detection are notoriously fragile. Without tests, false positives and false negatives will go undetected.

### 3. No Integration/API Tests (Severity: HIGH)
- **Impact**: The HTTP API contract (`POST /api/v1/text/contents`) is untested. The request/response JSON schema has no validation tests.
- **Current State**: Zero HTTP-level tests. The axum handler `handle_text_contents` is never tested.
- **Effort**: 8-12 hours
- **Risk**: Breaking changes to the API contract will not be caught before deployment to environments where the FMS Guardrails Orchestrator depends on this service.

### 4. No Security Scanning (Severity: HIGH)
- **Impact**: 89 transitive Rust dependencies (from `Cargo.lock`) have no vulnerability scanning. The container image has no Trivy/Snyk checks.
- **Current State**: No `cargo-audit`, no Trivy, no Snyk, no CodeQL, no SAST of any kind.
- **Effort**: 2-4 hours
- **Risk**: Known CVEs in dependencies or base images will not be detected.

### 5. No Coverage Tracking (Severity: MEDIUM)
- **Impact**: Impossible to measure test quality, track coverage trends, or enforce minimum thresholds.
- **Current State**: No `cargo-tarpaulin`, no `llvm-cov`, no codecov/coveralls integration.
- **Effort**: 2-4 hours

## Quick Wins

### 1. Add GitHub Actions CI Workflow (2-3 hours)
Create `.github/workflows/ci.yml` with basic quality gates:

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

### 2. Add Unit Tests for Built-in Detectors (2-4 hours)
The three built-in detectors (`email_address_detector`, `ssn_detector`, `credit_card_detector`) need tests for:
- Valid inputs that should match
- Invalid inputs that should NOT match (false positive prevention)
- Edge cases (partial matches, multiple matches per input)
- Boundary conditions

Example test for `email_address_detector`:
```rust
#[test]
fn test_email_detector_valid() {
    let result = email_address_detector(&"contact user@example.com now".to_string()).unwrap();
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].text, "user@example.com");
    assert_eq!(result[0].detection, "EmailAddress");
    assert_eq!(result[0].detection_type, "pii");
}

#[test]
fn test_email_detector_no_match() {
    let result = email_address_detector(&"no email here".to_string()).unwrap();
    assert!(result.is_empty());
}
```

### 3. Add cargo-audit for Dependency Scanning (1-2 hours)
Add to CI workflow:
```yaml
      - run: cargo install cargo-audit
      - run: cargo audit
```

### 4. Add Trivy Container Scanning (1-2 hours)
Add to CI workflow:
```yaml
  container-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -t regex-detector:test .
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: regex-detector:test
          severity: CRITICAL,HIGH
```

## Detailed Findings

### CI/CD Pipeline
- **Workflows**: None. Zero CI/CD configuration files exist.
- **PR Triggers**: N/A — no workflows
- **Concurrency Control**: N/A
- **Caching**: N/A
- **Build Automation**: The Dockerfile has multi-stage targets for tests (`cargo test`), linting (`cargo clippy`), and formatting (`cargo fmt --check`), but these are only executed during Docker image builds, not as part of any CI pipeline.

### Test Coverage
- **Test Files**: Tests are inline in `src/detectors.rs` under `#[cfg(test)] mod tests`
- **Test Count**: 1 test function (`test_regex_match`)
- **What's Tested**: Basic regex matching with a simple numeric pattern
- **What's NOT Tested**:
  - `email_address_detector()` — email regex validation
  - `ssn_detector()` — SSN regex validation (complex pattern with multiple formats)
  - `credit_card_detector()` — credit card regex validation
  - `handle_text_contents()` — HTTP handler logic
  - Error paths: empty regex list, invalid regex patterns
  - Multiple content items with multiple regex patterns
  - Built-in vs. custom regex routing logic
- **Test-to-Code Ratio**: ~25 lines of test code / 212 total lines ≈ 12% (very low, and the test covers trivial functionality)
- **Coverage Generation**: None

### Code Quality
- **Linting**: Clippy is configured in `rust-toolchain.toml` (component) and used in the Dockerfile lint stage, but NOT enforced via CI.
- **Formatting**: `rustfmt` is configured in `rust-toolchain.toml` and checked in the Dockerfile format stage, but NOT enforced via CI.
- **Pre-commit Hooks**: None (no `.pre-commit-config.yaml`)
- **Static Analysis**: None (no CodeQL, gosec equivalent, or Semgrep)
- **Dependency Scanning**: None (no `cargo-audit`)
- **Secret Detection**: None (no gitleaks, no TruffleHog)

### Container Images
- **Dockerfile Quality**: Good multi-stage build pattern with separate builder, test, lint, format, and release stages.
- **Base Image**: `registry.access.redhat.com/ubi9/ubi-minimal` (appropriate for Red Hat ecosystem)
- **Build Stages**:
  - `rust-builder`: Base Rust builder with toolchain
  - `regex-detector-builder`: Compiles the binary
  - `tests`: Runs `cargo test` (good practice, but not used in CI)
  - `lint`: Runs `cargo clippy` (good practice, but not used in CI)
  - `format`: Runs `cargo fmt --check` (good practice, but not used in CI)
  - `regex-detector-release`: Final minimal image
- **Security**: `compat-openssl11` installed — potential concern with OpenSSL 1.1 (EOL)
- **Multi-arch**: Not supported (single architecture only)
- **SBOM**: Not generated
- **Image Signing**: Not implemented
- **Runtime Validation**: None — no health check tests, no startup validation

### Security
- **Container Scanning**: None
- **SAST**: None
- **Dependency Scanning**: None — 89 transitive dependencies unchecked
- **Secret Detection**: None
- **Notable Concern**: The `compat-openssl11` package in the Dockerfile installs OpenSSL 1.1, which reached end-of-life in September 2023. This should be reviewed for security implications.

### Agent Rules (Agentic Flow Quality)
- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **`.claude/` directory**: Not present
- **Test creation rules**: None
- **Coverage**: No test types have rules
- **Quality**: N/A
- **Gaps**: Everything — no guidance for AI agents on testing patterns, coding standards, or project conventions
- **Recommendation**: Generate test creation rules with `/test-rules-generator` to establish AI-assisted testing standards

## Recommendations

### Priority 0 (Critical)
1. **Create a GitHub Actions CI workflow** with `cargo test`, `cargo clippy`, `cargo fmt --check`, and `cargo audit` running on every PR and push to main. This is the single most impactful improvement.
2. **Write unit tests for all three built-in detectors** (email, SSN, credit card) including valid matches, non-matches, edge cases, and multiple-match scenarios. These are the core business logic of the service.
3. **Add HTTP-level integration tests** using axum's built-in `TestClient` or `tower::ServiceExt` to test the `/api/v1/text/contents` endpoint and `/health` endpoint.

### Priority 1 (High Value)
4. **Add cargo-tarpaulin or llvm-cov** for coverage generation with codecov integration and a minimum threshold (suggest starting at 60%, raising to 80% as tests are added).
5. **Add Trivy scanning** to CI for both dependency and container image vulnerabilities.
6. **Add `cargo-audit`** for Rust dependency vulnerability scanning.
7. **Add API contract tests** validating request/response schema compatibility with the FMS Guardrails Orchestrator (the primary consumer of this service).
8. **Create CLAUDE.md** with test creation rules and coding standards for the project.

### Priority 2 (Nice-to-Have)
9. **Add multi-architecture image builds** (amd64/arm64) for broader deployment support.
10. **Add SBOM generation** using `syft` or `cargo-sbom`.
11. **Add property-based testing** with `proptest` crate for comprehensive regex edge case testing (especially important for PII detection accuracy).
12. **Add benchmarks** for regex matching performance using `criterion`.
13. **Review `compat-openssl11`** dependency — OpenSSL 1.1 is EOL and may introduce security risk.

## Comparison to Gold Standards

| Capability | guardrails-regex-detector | odh-dashboard | notebooks | kserve |
|-----------|:---:|:---:|:---:|:---:|
| CI/CD Workflows | None | Comprehensive | Multi-workflow | Extensive |
| Unit Tests | 1 test | Thousands | Hundreds | Extensive |
| Integration Tests | None | Contract tests | Image tests | Multi-version |
| E2E Tests | None | Cypress suite | Deployment tests | KServe e2e |
| Coverage Tracking | None | Codecov enforced | Coverage reports | Coverage gates |
| Container Scanning | None | Trivy + SBOM | Trivy scans | Trivy + Snyk |
| Pre-commit Hooks | None | Comprehensive | Present | Present |
| Agent Rules | None | Comprehensive | Basic | N/A |
| Linting (in CI) | None | ESLint enforced | Linting in CI | golangci-lint |
| Security Scanning | None | CodeQL + Snyk | Trivy + audit | CodeQL + audit |

## File Paths Reference

| File | Purpose |
|------|---------|
| `Cargo.toml` | Project manifest with dependencies |
| `Cargo.lock` | Locked dependency versions (89 transitive deps) |
| `src/main.rs` | HTTP server setup (axum router, /health, /api/v1/text/contents) |
| `src/detectors.rs` | Core detection logic: email, SSN, credit card detectors + custom regex |
| `Dockerfile` | Multi-stage build with test/lint/format/release stages |
| `rust-toolchain.toml` | Rust 1.84.0 with clippy + rustfmt components |
| `.gitignore` | Ignores `/target` only |
| `README.md` | Basic usage documentation with sample request/response |
