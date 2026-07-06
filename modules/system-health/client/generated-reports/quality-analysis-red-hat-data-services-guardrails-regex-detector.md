---
repository: "red-hat-data-services/guardrails-regex-detector"
overall_score: 2.1
scorecard:
  - dimension: "Unit Tests"
    score: 2.0
    status: "Single test case covering only the generic regex_match function; no tests for built-in detectors (email, SSN, credit-card), handler, or edge cases"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests; no HTTP endpoint testing; no contract tests with orchestrator"
  - dimension: "Build Integration"
    score: 3.0
    status: "Dockerfile includes test/lint/format stages but no CI workflow triggers them on PRs"
  - dimension: "Image Testing"
    score: 2.0
    status: "Multi-stage Dockerfile with UBI9 base but no runtime validation, no vulnerability scanning, no multi-arch support"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling (tarpaulin/llvm-cov), no codecov integration, no coverage thresholds"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "No .github/workflows directory; no CI/CD pipeline of any kind"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules or test automation guidance"
critical_gaps:
  - title: "No CI/CD pipeline at all"
    impact: "No automated testing, linting, or security scanning on any PR or push; all quality gates are manual"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "Minimal test coverage (1 test for 212 lines)"
    impact: "Built-in regex detectors (email, SSN, credit-card) are completely untested; edge cases like malformed input, empty payloads, invalid regex patterns not validated"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No integration/E2E tests for HTTP API"
    impact: "Endpoint behavior, error responses, and orchestrator contract compliance are unverified"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No container security scanning"
    impact: "Vulnerabilities in dependencies or base image not detected before deployment"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Impossible to measure or enforce quality improvements over time"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add GitHub Actions CI workflow with cargo test, clippy, and fmt"
    effort: "2-3 hours"
    impact: "Enables automated quality gates on every PR; catches regressions immediately"
  - title: "Add unit tests for all built-in detectors (email, SSN, credit-card)"
    effort: "2-4 hours"
    impact: "Covers the core business logic that is currently completely untested"
  - title: "Add Trivy container scanning to Dockerfile or CI"
    effort: "1-2 hours"
    impact: "Detects known vulnerabilities in dependencies and base image"
  - title: "Add cargo-tarpaulin for coverage measurement"
    effort: "1-2 hours"
    impact: "Establishes baseline coverage metrics and enables tracking improvements"
recommendations:
  priority_0:
    - "Create a GitHub Actions CI workflow that runs cargo test, cargo clippy, and cargo fmt --check on every PR"
    - "Add comprehensive unit tests for email_address_detector, ssn_detector, and credit_card_detector with valid/invalid/edge-case inputs"
    - "Add HTTP endpoint integration tests using axum::test or tower::ServiceExt"
  priority_1:
    - "Add Trivy or Snyk container scanning in CI"
    - "Add cargo-tarpaulin or llvm-cov for coverage tracking with codecov integration"
    - "Add contract tests validating the API matches orchestrator expectations"
    - "Add pre-commit hooks for fmt and clippy"
  priority_2:
    - "Create .claude/rules/ with test automation guidance for AI agents"
    - "Add multi-architecture image builds (amd64, arm64)"
    - "Add SBOM generation to container build"
    - "Add load/performance tests for the regex matching endpoint"
    - "Add dependabot or renovate for automated dependency updates"
---

# Quality Analysis: guardrails-regex-detector

## Executive Summary

- **Overall Score: 2.1/10**
- **Repository Type**: Rust HTTP microservice (regex-based PII detection)
- **Primary Language**: Rust (212 lines across 2 source files)
- **Framework**: Axum web framework with Tokio async runtime
- **Key Strengths**: Clean Dockerfile with multi-stage build including test/lint/format stages; Rust toolchain pinning
- **Critical Gaps**: No CI/CD pipeline, minimal test coverage (1 test), no security scanning, no coverage tracking, no agent rules
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 2/10 | Single test case; no tests for built-in detectors or handler |
| Integration/E2E | 0/10 | No integration or endpoint tests exist |
| **Build Integration** | **3/10** | **Dockerfile has test/lint/format stages but no CI triggers them** |
| Image Testing | 2/10 | Multi-stage build with UBI9 but no runtime validation or scanning |
| Coverage Tracking | 0/10 | No coverage tooling or integration |
| CI/CD Automation | 0/10 | No GitHub Actions, no CI/CD of any kind |
| Agent Rules | 0/10 | No CLAUDE.md, no .claude/ directory, no rules |

## Critical Gaps

### 1. No CI/CD Pipeline
- **Impact**: Every quality gate is manual — tests, linting, formatting, and security checks must be run locally by developers. Nothing prevents broken code from being merged.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The repository has zero files in `.github/workflows/`. The Dockerfile contains `tests`, `lint`, and `format` stages, but these are only executed during container builds, not on PRs or pushes. There is no automated feedback loop.

### 2. Minimal Test Coverage (1 test for 212 lines)
- **Impact**: The three core business logic functions — `email_address_detector`, `ssn_detector`, and `credit_card_detector` — have zero test coverage. The single existing test (`test_regex_match`) only validates the generic `regex_match` helper with a trivial numeric pattern. Edge cases like malformed input, empty strings, partial matches, and boundary conditions are completely untested.
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: `src/detectors.rs:139-166` contains the only test module. The `#[cfg(test)]` block has one test that checks a simple numeric regex. None of the registered patterns (SSN, email, credit-card) are validated against known-good or known-bad inputs.

### 3. No Integration/E2E Tests for HTTP API
- **Impact**: The `handle_text_contents` endpoint behavior is unverified — error handling (empty regex returns 400), response format (nested array structure), multi-content processing, and the interaction between built-in and custom regex are never tested.
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Details**: The API contract with FMS Guardrails Orchestrator is defined only by documentation in the README, not by tests. Any change to response format could silently break the integration.

### 4. No Container Security Scanning
- **Impact**: The Dockerfile uses `registry.access.redhat.com/ubi9/ubi-minimal` and `rust:1.84.0` base images plus installs `compat-openssl11` via microdnf. No scanning validates these layers for known CVEs.
- **Severity**: HIGH
- **Effort**: 2-4 hours

### 5. No Coverage Tracking
- **Impact**: No way to measure current coverage, track improvements, or enforce coverage thresholds. The team has no visibility into which code paths are exercised by tests.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours

## Quick Wins

### 1. Add GitHub Actions CI Workflow (2-3 hours)
Create `.github/workflows/ci.yml`:
```yaml
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

### 2. Add Unit Tests for Built-in Detectors (2-4 hours)
Add tests for each detector in `src/detectors.rs`:
```rust
#[test]
fn test_email_detector_valid() {
    let results = email_address_detector(&"contact user@example.com today".to_string()).unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].text, "user@example.com");
    assert_eq!(results[0].detection, "EmailAddress");
    assert_eq!(results[0].detection_type, "pii");
}

#[test]
fn test_ssn_detector_valid() {
    let results = ssn_detector(&"SSN is 123-45-6789".to_string()).unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].text, "123-45-6789");
}

#[test]
fn test_credit_card_amex() {
    let results = credit_card_detector(&"card 374245455400126".to_string()).unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].detection, "CreditCard");
}

#[test]
fn test_email_detector_no_match() {
    let results = email_address_detector(&"no email here".to_string()).unwrap();
    assert!(results.is_empty());
}
```

### 3. Add Trivy Scanning (1-2 hours)
Add to CI workflow:
```yaml
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -t regex-detector:test --target regex-detector-release .
      - name: Trivy scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: regex-detector:test
          severity: CRITICAL,HIGH
          exit-code: 1
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
- **Workflows**: None. Zero files in `.github/workflows/`.
- **Test Automation**: None. Tests only run if a developer manually executes `cargo test` or builds the Docker image (which includes a `tests` stage).
- **Build Process**: The Dockerfile is well-structured with multi-stage builds (builder → tests → lint → format → release), but these stages are not targeted by any CI. The `tests`, `lint`, and `format` stages are defined but not automatically triggered.
- **Concurrency**: N/A
- **Caching**: N/A

### Test Coverage
- **Unit Tests**: 1 test in `src/detectors.rs:145-165`. Tests the generic `regex_match` function with a numeric pattern. Test-to-code ratio: ~27 test lines / 138 non-test production lines = 0.20 (very low).
- **Built-in Detectors Untested**: `email_address_detector` (line 38), `ssn_detector` (line 50), `credit_card_detector` (line 62) all have zero test coverage.
- **Handler Untested**: `handle_text_contents` (line 96) — the main API endpoint — has no tests.
- **Integration Tests**: None.
- **E2E Tests**: None.
- **Coverage Tracking**: No tarpaulin, llvm-cov, codecov, or any coverage tooling.

### Code Quality
- **Linting**: `cargo clippy` is configured in the Dockerfile lint stage and `clippy` is included in `rust-toolchain.toml` components. However, no CI runs it automatically.
- **Formatting**: `cargo fmt --check` is in the Dockerfile format stage and `rustfmt` is in `rust-toolchain.toml`. Not automated.
- **Pre-commit Hooks**: None (`.pre-commit-config.yaml` does not exist).
- **Static Analysis**: No CodeQL, no SAST tools.
- **Dependency Scanning**: No dependabot, no renovate, no audit.
- **Note**: There is a debug `println!("hi")` on line 99 of `detectors.rs` that appears to be leftover debugging code.

### Container Images
- **Dockerfile**: Well-structured multi-stage build:
  - Stage 1: `rust-builder` — base Rust 1.84.0 image with rustfmt
  - Stage 2: `regex-detector-builder` — copies source and builds
  - Stage 3: `tests` — runs `cargo test`
  - Stage 4: `lint` — runs `cargo clippy`
  - Stage 5: `format` — runs `cargo fmt --check`
  - Stage 6: `regex-detector-release` — UBI9 minimal release image
- **Base Image**: `registry.access.redhat.com/ubi9/ubi-minimal` (good — RHEL-based, enterprise-ready)
- **Runtime Validation**: None. No health check test, no startup validation.
- **Security Scanning**: None. No Trivy, Snyk, or any scanner.
- **Multi-arch**: Not configured. Only builds for the builder's native architecture.
- **SBOM**: None.
- **Image Signing**: None.

### Security
- **Container Scanning**: None
- **SAST/CodeQL**: None
- **Dependency Scanning**: No `cargo audit` in CI
- **Secret Detection**: None (no gitleaks, trufflehog)
- **Concern**: The service handles PII data (SSNs, emails, credit cards). Security practices should be especially rigorous for this type of service.

### Agent Rules (Agentic Flow Quality)
- **Status**: Missing
- **CLAUDE.md**: Not present
- **.claude/ directory**: Not present
- **.claude/rules/**: Not present
- **Coverage**: No test type rules exist
- **Quality**: N/A
- **Gaps**: Everything — no agent rules for unit tests, integration tests, API contract tests, or Rust testing patterns
- **Recommendation**: Generate comprehensive rules with `/test-rules-generator` covering Rust testing patterns, axum endpoint testing, and PII detection validation

## Recommendations

### Priority 0 (Critical)

1. **Create GitHub Actions CI workflow** — Run `cargo test`, `cargo clippy --all-targets -- -D warnings`, and `cargo fmt --check` on every PR. This is the single most impactful improvement. (4-8 hours including setup and validation)

2. **Add comprehensive unit tests for all built-in detectors** — Each of the three detectors (email, SSN, credit-card) needs tests with:
   - Valid inputs that should match
   - Invalid inputs that should not match
   - Edge cases (partial matches, multiple matches in one string, empty input)
   - Known false positive/negative patterns
   (8-12 hours)

3. **Add HTTP endpoint integration tests** — Use `axum::test` helpers or `tower::ServiceExt` to test `handle_text_contents` with:
   - Valid request with built-in patterns
   - Valid request with custom regex
   - Empty regex list (should return 400)
   - Invalid JSON payload
   - Mixed built-in and custom patterns
   (4-8 hours)

### Priority 1 (High Value)

4. **Add container security scanning** — Integrate Trivy or Snyk in CI to scan the built image for CVEs. This is especially important given the service handles PII. (2-4 hours)

5. **Add coverage tracking** — Integrate `cargo-tarpaulin` with codecov to track and enforce coverage thresholds. Set an initial baseline and incrementally raise the bar. (2-4 hours)

6. **Add contract tests for orchestrator integration** — The API response format (nested array `[[...]]`) must match what FMS Guardrails Orchestrator expects. These tests should validate the exact schema. (4-8 hours)

7. **Add pre-commit hooks** — Create `.pre-commit-config.yaml` with rustfmt and clippy hooks to catch issues before commit. (1-2 hours)

### Priority 2 (Nice-to-Have)

8. **Create agent rules (`.claude/rules/`)** — Add Rust-specific test patterns, axum endpoint testing guidance, and PII detection validation rules for AI-assisted development.

9. **Add multi-architecture builds** — Support amd64 and arm64 via Docker buildx.

10. **Add SBOM generation** — Use Syft or similar tool in the container build pipeline.

11. **Add `cargo audit`** — Run dependency vulnerability auditing in CI.

12. **Remove debug code** — `println!("hi")` on line 99 of `src/detectors.rs` appears to be leftover debugging.

13. **Add dependabot/renovate** — Automate Cargo dependency updates.

## Comparison to Gold Standards

| Dimension | guardrails-regex-detector | odh-dashboard (Gold) | notebooks (Gold) | Gap |
|-----------|--------------------------|---------------------|------------------|-----|
| Unit Tests | 1 test, no detector coverage | Comprehensive Jest suite, 80%+ coverage | N/A (image-focused) | Massive |
| Integration/E2E | None | Cypress E2E, contract tests | Multi-layer validation | Massive |
| Build Integration | Dockerfile stages only | PR-time builds with validation | Konflux integration | Large |
| Image Testing | No validation | Full runtime testing | 5-layer validation pipeline | Massive |
| Coverage Tracking | None | Codecov with enforcement | Coverage in CI | Massive |
| CI/CD | None | Multi-workflow, concurrency control | Automated periodic + PR | Massive |
| Agent Rules | None | Comprehensive .claude/rules/ | N/A | Massive |
| Security | None | CodeQL, dependency scanning | Trivy, SBOM | Massive |

## File Paths Reference

| File | Purpose |
|------|---------|
| `src/main.rs` | HTTP server setup (axum router, health endpoint) |
| `src/detectors.rs` | PII detection logic, built-in patterns, request handler, single test |
| `Cargo.toml` | Rust dependencies and binary definition |
| `Cargo.lock` | Locked dependency versions |
| `Dockerfile` | Multi-stage build (builder, test, lint, format, release) |
| `rust-toolchain.toml` | Rust 1.84.0 with rustfmt and clippy components |
| `README.md` | API usage documentation with sample request/response |
| `.gitignore` | Ignores `/target` directory |
