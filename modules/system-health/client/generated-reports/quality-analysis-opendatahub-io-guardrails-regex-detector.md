---
repository: "opendatahub-io/guardrails-regex-detector"
overall_score: 1.2
scorecard:
  - dimension: "Unit Tests"
    score: 2.0
    status: "Single test for security-critical PII detection logic; built-in detectors untested"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests; HTTP endpoints untested"
  - dimension: "Build Integration"
    score: 3.0
    status: "Dockerfile has test/lint/format stages but no CI to trigger them on PRs"
  - dimension: "Image Testing"
    score: 2.0
    status: "Multi-stage Dockerfile with UBI9 base but no runtime validation or scanning"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling, no codecov, no thresholds"
  - dimension: "CI/CD Automation"
    score: 1.0
    status: "Zero CI/CD workflows; no PR checks, no periodic jobs"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No .claude directory, no CLAUDE.md, no agent rules"
critical_gaps:
  - title: "No CI/CD pipeline at all"
    impact: "Code merges with zero automated checks — no tests, linting, or security validation on PRs"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Security-critical PII detectors have almost no tests"
    impact: "Email, SSN, credit card regex patterns could silently break with no test coverage catching regressions"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No integration/E2E tests for HTTP API"
    impact: "Endpoint behavior (routing, error handling, response format) is completely untested"
    severity: "HIGH"
    effort: "6-10 hours"
  - title: "No container vulnerability scanning"
    impact: "Vulnerable dependencies or base image CVEs ship undetected to production"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No coverage tracking or enforcement"
    impact: "No visibility into test coverage trends; regressions go unnoticed"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add GitHub Actions CI workflow with cargo test, clippy, and fmt"
    effort: "2-3 hours"
    impact: "Catch test failures, lint violations, and format issues on every PR"
  - title: "Add unit tests for all built-in PII detectors"
    effort: "2-3 hours"
    impact: "Validate email, SSN, and credit card patterns with positive and negative cases"
  - title: "Add Trivy scanning to Dockerfile or CI"
    effort: "1-2 hours"
    impact: "Detect known vulnerabilities in dependencies and base image"
  - title: "Add cargo-tarpaulin for coverage reporting"
    effort: "1-2 hours"
    impact: "Visibility into test coverage with codecov integration"
recommendations:
  priority_0:
    - "Create GitHub Actions CI workflow with cargo test, cargo clippy, and cargo fmt --check on PRs"
    - "Add comprehensive unit tests for all 3 built-in PII detectors (email, SSN, credit card) with edge cases"
    - "Add Trivy container scanning to detect CVEs in dependencies and UBI9 base image"
  priority_1:
    - "Add integration tests for HTTP endpoints using axum::test or reqwest"
    - "Add cargo-tarpaulin coverage tracking with codecov integration and minimum threshold"
    - "Add .dockerignore to exclude unnecessary files from build context"
    - "Create agent rules (.claude/rules/) for test creation patterns"
  priority_2:
    - "Add SBOM generation and image signing/attestation"
    - "Add pre-commit hooks for local development quality checks"
    - "Add fuzz testing for regex patterns to catch ReDoS vulnerabilities"
    - "Add multi-architecture image builds (amd64/arm64)"
---

# Quality Analysis: guardrails-regex-detector

## Executive Summary

- **Overall Score: 1.2/10**
- **Repository Type**: Rust HTTP microservice (Axum framework)
- **Primary Language**: Rust (212 lines across 2 source files)
- **Purpose**: Regex-based PII detection service (emails, SSNs, credit cards) for FMS Guardrails Orchestrator
- **Key Strengths**: Multi-stage Dockerfile with separate test/lint/format stages; clean UBI9 base image; Rust toolchain pinned
- **Critical Gaps**: No CI/CD pipeline, minimal test coverage, no security scanning, no coverage tracking
- **Agent Rules Status**: Missing — no `.claude/` directory or agent rules

This is a **security-critical service** handling PII detection, yet it has almost no quality infrastructure. The codebase is small enough that comprehensive coverage would be quick to add, making the gap especially urgent.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 2/10 | Single test; 3 built-in PII detectors untested |
| Integration/E2E | 0/10 | No HTTP endpoint testing whatsoever |
| **Build Integration** | **3/10** | **Dockerfile stages exist but no CI to run them** |
| Image Testing | 2/10 | Multi-stage build, UBI9 base, no scanning/validation |
| Coverage Tracking | 0/10 | No coverage tool, no codecov, no thresholds |
| CI/CD Automation | 1/10 | Zero GitHub Actions workflows |
| Agent Rules | 0/10 | No agent rules or test guidance |

## Critical Gaps

### 1. No CI/CD Pipeline
- **Severity**: HIGH
- **Impact**: Code merges to `main` with zero automated checks. No tests, no linting, no formatting, no security scans run on pull requests. The only automated quality gates are Dockerfile stages (`cargo test`, `cargo clippy`, `cargo fmt --check`) that only execute during container builds — not on PRs.
- **Effort**: 4-6 hours
- **Evidence**: No `.github/workflows/` directory exists. Repository has zero workflow files.

### 2. Security-Critical PII Detectors Have Almost No Tests
- **Severity**: HIGH
- **Impact**: The service detects emails, SSNs, and credit cards using regex patterns. Only `regex_match()` has a single generic test. The `email_address_detector()`, `ssn_detector()`, and `credit_card_detector()` functions have **zero direct tests**. Edge cases like partial matches, false positives, and malformed input are untested.
- **Effort**: 4-8 hours
- **Evidence**: `src/detectors.rs:139-166` — single `#[cfg(test)]` module with 1 test

### 3. No Integration/E2E Tests for HTTP API
- **Severity**: HIGH
- **Impact**: The `POST /api/v1/text/contents` endpoint has no tests for request parsing, error handling (empty regex list returns 400), response format, or the `/health` endpoint. Routing regressions, deserialization errors, or response format changes would go undetected.
- **Effort**: 6-10 hours
- **Evidence**: `src/main.rs` — no test module, no integration test files

### 4. No Container Vulnerability Scanning
- **Severity**: HIGH
- **Impact**: Dependencies in `Cargo.lock` and the UBI9 base image are never scanned for CVEs. Known vulnerabilities could ship to production undetected. The `compat-openssl11` package installed in the Dockerfile is particularly concerning as OpenSSL has frequent CVEs.
- **Effort**: 2-3 hours
- **Evidence**: No `.trivyignore`, no scanning workflow, no Snyk configuration

### 5. No Coverage Tracking or Enforcement
- **Severity**: MEDIUM
- **Impact**: No visibility into what percentage of code is tested. No minimum coverage thresholds. Test coverage regressions go unnoticed.
- **Effort**: 2-4 hours
- **Evidence**: No `tarpaulin.toml`, no `.codecov.yml`, no coverage generation in any configuration

## Quick Wins

### 1. Add GitHub Actions CI Workflow (2-3 hours)
Immediately establishes a quality gate on PRs.

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]
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

### 2. Add Unit Tests for PII Detectors (2-3 hours)
Test each built-in detector with positive matches, negative matches, and edge cases.

```rust
#[test]
fn test_email_detector_valid() {
    let content = "contact me at user@example.com please".to_string();
    let results = email_address_detector(&content).unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].text, "user@example.com");
    assert_eq!(results[0].detection, "EmailAddress");
}

#[test]
fn test_email_detector_no_match() {
    let content = "no email here".to_string();
    let results = email_address_detector(&content).unwrap();
    assert!(results.is_empty());
}

#[test]
fn test_ssn_detector_dashed() {
    let content = "SSN: 123-45-6789".to_string();
    let results = ssn_detector(&content).unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].detection, "SocialSecurity");
}

#[test]
fn test_credit_card_detector_amex() {
    let content = "card: 374245455400126".to_string();
    let results = credit_card_detector(&content).unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].detection, "CreditCard");
}
```

### 3. Add Trivy Scanning (1-2 hours)
Add vulnerability scanning to the CI workflow.

```yaml
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -t regex-detector:test .
      - name: Run Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'regex-detector:test'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
```

### 4. Add Coverage with cargo-tarpaulin (1-2 hours)

```yaml
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo install cargo-tarpaulin
      - run: cargo tarpaulin --out xml
      - uses: codecov/codecov-action@v4
        with:
          files: cobertura.xml
```

## Detailed Findings

### CI/CD Pipeline

**Status: Non-existent**

- **Workflows**: Zero `.github/workflows/` files
- **PR Checks**: None — no status checks required to merge
- **Periodic Jobs**: None
- **Concurrency Control**: N/A
- **Caching**: N/A

The only quality checks exist as Dockerfile multi-stage targets:
- `tests` stage: `cargo test` (line 24-25)
- `lint` stage: `cargo clippy --all-targets --all-features -- -D warnings` (line 28-29)
- `format` stage: `cargo fmt --check` (line 32-33)

These stages are **disconnected from the release image** — they are independent build targets that would need to be explicitly invoked with `docker build --target tests .`. They are not part of any CI pipeline.

### Test Coverage

**Status: Minimal**

| Metric | Value |
|--------|-------|
| Test files | 0 (tests inline in `detectors.rs`) |
| Test functions | 1 |
| Lines of test code | ~28 |
| Lines of production code | ~138 |
| Test-to-code ratio | 0.20 |
| Built-in detectors tested | 0/3 |
| Endpoints tested | 0/2 |

**Single test**: `test_regex_match` (detectors.rs:145) tests the generic `regex_match()` helper with a simple numeric pattern. It does NOT test:
- `email_address_detector()` — the email regex pattern
- `ssn_detector()` — the SSN regex pattern (most complex regex in the codebase)
- `credit_card_detector()` — the credit card regex pattern
- `handle_text_contents()` — the HTTP handler
- Error cases (invalid regex, empty payload)
- Edge cases (multiple matches, overlapping patterns, unicode input)

### Code Quality

**Status: Partially configured**

- **Rust Toolchain**: Pinned to 1.84.0 with `clippy` and `rustfmt` components (`rust-toolchain.toml`)
- **Clippy**: Available via toolchain but not enforced in any CI — only in Dockerfile lint stage
- **Rustfmt**: Available via toolchain but not enforced in any CI — only in Dockerfile format stage
- **Pre-commit hooks**: None (`.pre-commit-config.yaml` absent)
- **Static Analysis**: None beyond clippy
- **SAST**: No CodeQL, no Semgrep
- **Secret Detection**: No gitleaks, no TruffleHog

**Code Issues Noted**:
- `println!("hi")` at detectors.rs:99 — debug statement left in production code
- Functions take `&String` instead of idiomatic `&str` (detectors.rs:38, 50, 62)
- No error propagation in `handle_text_contents` — regex errors silently produce empty results

### Container Images

**Status: Partially configured**

**Strengths**:
- Multi-stage Dockerfile with builder pattern
- Separate stages for test, lint, format (good intent)
- UBI9 minimal base image (Red Hat ecosystem compliant)
- Pinned Rust version in builder stage

**Weaknesses**:
- No `.dockerignore` — entire repo context sent to Docker daemon
- No vulnerability scanning (Trivy, Snyk)
- No SBOM generation
- No image signing or attestation
- No multi-architecture support (no `--platform` flags)
- `compat-openssl11` package is a legacy compatibility package — should verify necessity
- No health check in Dockerfile (`HEALTHCHECK` instruction missing)
- No non-root user configured (runs as root by default)

### Security

**Status: Non-existent**

| Security Practice | Status |
|-------------------|--------|
| Container scanning (Trivy/Snyk) | Missing |
| SAST/CodeQL | Missing |
| Dependency scanning | Missing |
| Secret detection | Missing |
| SBOM generation | Missing |
| Image signing | Missing |
| Dependency audit (`cargo audit`) | Missing |

This is particularly concerning because:
1. The service handles **PII data** (emails, SSNs, credit cards)
2. It exposes an **HTTP endpoint** accepting arbitrary regex patterns (potential ReDoS vector)
3. The custom regex path (`else` branch in detectors.rs:121-130) passes **user-supplied regex** directly to `Regex::new()` with no validation or timeout

**ReDoS Risk**: User-supplied regex patterns are compiled and executed without any timeout or complexity bounds. A malicious regex like `(a+)+$` could cause catastrophic backtracking and deny service.

### Agent Rules (Agentic Flow Quality)

**Status: Missing**

- No `.claude/` directory
- No `CLAUDE.md` or `AGENTS.md`
- No `.claude/rules/` for test creation guidance
- No `.claude/skills/` for custom skills
- No testing standards documentation

**Recommendation**: Generate agent rules with `/test-rules-generator` to establish patterns for:
- Rust unit test conventions (`#[cfg(test)]` modules)
- Axum integration test patterns
- PII detector test expectations
- Regex validation test patterns

## Recommendations

### Priority 0 (Critical)

1. **Create GitHub Actions CI workflow** — Add `cargo test`, `cargo clippy`, and `cargo fmt --check` as required PR checks. The Dockerfile already has these commands; moving them to CI ensures they run on every PR, not just during image builds.

2. **Add comprehensive unit tests for all PII detectors** — Each built-in detector (email, SSN, credit card) needs tests for valid inputs, invalid inputs, edge cases (multiple matches, partial matches, boundary conditions), and the `handle_text_contents` handler needs at minimum a happy-path test.

3. **Add Trivy container scanning** — Scan both the built image and `Cargo.lock` dependencies for known CVEs. This is a security-critical service handling PII.

4. **Mitigate ReDoS vulnerability** — User-supplied regex patterns (detectors.rs:121-130) are compiled and executed without timeout. Add `regex::RegexBuilder` with `size_limit()` or use the `fancy-regex` crate with backtracking limits.

### Priority 1 (High Value)

5. **Add integration tests for HTTP endpoints** — Use `axum::test` utilities or spawn a test server to validate request/response format, error handling, and routing.

6. **Add cargo-tarpaulin coverage tracking** — Generate coverage reports and integrate with codecov. Set a minimum threshold (suggest 70% for a project this size).

7. **Add `.dockerignore`** — Exclude `.git/`, `target/`, `README.md`, `LICENSE` from build context to speed up builds.

8. **Create agent rules** — Add `.claude/rules/` with Rust testing patterns specific to this project.

9. **Fix security posture** — Run container as non-root user, add `HEALTHCHECK` instruction, audit `compat-openssl11` necessity.

### Priority 2 (Nice-to-Have)

10. **Add fuzz testing** — Use `cargo-fuzz` or `arbitrary` crate to fuzz the regex detection logic with random inputs.

11. **Add SBOM generation** — Generate Software Bill of Materials with `syft` or `cargo-sbom`.

12. **Add pre-commit hooks** — Configure `pre-commit` with `rustfmt` and `clippy` for local development.

13. **Add multi-architecture builds** — Support `linux/amd64` and `linux/arm64` platforms.

14. **Remove debug output** — Remove `println!("hi")` at detectors.rs:99.

## Comparison to Gold Standards

| Practice | guardrails-regex-detector | odh-dashboard | notebooks | kserve |
|----------|--------------------------|---------------|-----------|--------|
| CI/CD Workflows | None | 15+ workflows | 10+ workflows | 20+ workflows |
| Unit Tests | 1 test | 1000+ tests | Extensive | Extensive |
| Integration Tests | None | Contract tests | Image validation | Multi-version |
| E2E Tests | None | Cypress suite | 5-layer validation | Kind-based |
| Coverage Tracking | None | Codecov enforced | Basic | Enforced thresholds |
| Container Scanning | None | Trivy + Snyk | Trivy | Trivy |
| Pre-commit Hooks | None | Configured | Configured | Configured |
| Agent Rules | None | Comprehensive | Basic | None |
| SBOM/Signing | None | Present | Present | Present |

## File Paths Reference

| File | Purpose |
|------|---------|
| `Cargo.toml` | Rust project configuration, dependencies |
| `Cargo.lock` | Pinned dependency versions |
| `rust-toolchain.toml` | Rust 1.84.0 with clippy + rustfmt |
| `Dockerfile` | Multi-stage build with test/lint/format targets |
| `src/main.rs` | HTTP server entry point (Axum router, 46 lines) |
| `src/detectors.rs` | PII detection logic + 1 unit test (166 lines) |
| `.gitignore` | Only excludes `/target` |
