---
repository: "opendatahub-io/guardrails-regex-detector"
overall_score: 2.8
scorecard:
  - dimension: "Unit Tests"
    score: 2.0
    status: "Only 1 test for core regex_match function; no tests for built-in detectors, handler, or error paths"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests; no HTTP endpoint testing"
  - dimension: "Build Integration"
    score: 1.0
    status: "No CI/CD workflows; Dockerfile runs tests/lint/fmt in build stages but no PR-time validation"
  - dimension: "Image Testing"
    score: 3.0
    status: "Multi-stage Dockerfile with test/lint/format stages, but no runtime validation or scanning"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tracking, no codecov/coveralls, no coverage thresholds"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "No GitHub Actions, no CI/CD workflows of any kind"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude directory, no agent rules or test guidance"
critical_gaps:
  - title: "No CI/CD pipeline"
    impact: "No automated quality gates on PRs; tests, lint, and formatting only run if someone manually builds the Docker image"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Minimal test coverage (1 test for 212 LOC)"
    impact: "Built-in detectors (email, SSN, credit card), the HTTP handler, error paths, and edge cases are completely untested"
    severity: "HIGH"
    effort: "6-8 hours"
  - title: "No integration/E2E tests for HTTP API"
    impact: "API contract, request validation, error responses, and multi-content handling are never verified"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No security scanning"
    impact: "Dependency vulnerabilities and container image CVEs go undetected"
    severity: "HIGH"
    effort: "2-3 hours"
quick_wins:
  - title: "Add GitHub Actions workflow with cargo test, clippy, and fmt"
    effort: "2-3 hours"
    impact: "Automated quality gates on every PR; catches regressions before merge"
  - title: "Add unit tests for built-in detectors (email, SSN, credit card)"
    effort: "2-3 hours"
    impact: "Validates regex patterns that are the core product functionality"
  - title: "Add cargo-tarpaulin for coverage tracking"
    effort: "1-2 hours"
    impact: "Visibility into test coverage; enables coverage thresholds"
  - title: "Add Trivy container scanning"
    effort: "1 hour"
    impact: "Detect known vulnerabilities in base image and dependencies"
recommendations:
  priority_0:
    - "Create GitHub Actions CI workflow with cargo test, clippy, fmt check on PRs"
    - "Add unit tests for all 3 built-in detectors and the handle_text_contents handler"
    - "Add integration tests that start the HTTP server and test the API endpoint"
  priority_1:
    - "Add cargo-tarpaulin coverage tracking with codecov integration"
    - "Add Trivy or Snyk container scanning to CI pipeline"
    - "Add CODEOWNERS file for review enforcement"
    - "Create CLAUDE.md with test patterns and contribution guidelines"
  priority_2:
    - "Add property-based testing (proptest) for regex detectors"
    - "Add benchmarks for regex performance"
    - "Add OpenAPI/Swagger spec for the API contract"
    - "Add pre-commit hooks for local development"
---

# Quality Analysis: guardrails-regex-detector

## Executive Summary
- **Overall Score: 2.8/10**
- **Repository Type**: Rust HTTP microservice (Axum framework)
- **Size**: ~212 lines of Rust across 2 source files
- **Purpose**: Regex-based PII detection service for FMS Guardrails Orchestrator
- **Key Strengths**: Well-structured multi-stage Dockerfile; clean Rust code; pinned toolchain
- **Critical Gaps**: No CI/CD pipeline, minimal tests (1 test), no coverage, no security scanning
- **Agent Rules Status**: Missing — no CLAUDE.md, no .claude directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 2/10 | Only 1 test for `regex_match`; no tests for built-in detectors or handler |
| Integration/E2E | 0/10 | No integration or E2E tests whatsoever |
| **Build Integration** | **1/10** | **No CI/CD; Dockerfile has test stages but no automated PR validation** |
| Image Testing | 3/10 | Multi-stage Dockerfile runs tests/lint/fmt during build; no runtime validation |
| Coverage Tracking | 0/10 | No coverage generation, tracking, or enforcement |
| CI/CD Automation | 0/10 | No GitHub Actions, no CI/CD configuration at all |
| Agent Rules | 0/10 | No agent rules, no test guidance, no CLAUDE.md |

## Critical Gaps

### 1. No CI/CD Pipeline
- **Impact**: There are zero GitHub Actions workflows. Tests, linting, and formatting only run if someone manually triggers a Docker build. PRs can be merged with broken code, failing tests, or formatting violations.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Current state**: The Dockerfile contains `cargo test`, `cargo clippy`, and `cargo fmt --check` stages, but these only execute during Docker image builds — they are not wired into any CI/CD system.

### 2. Minimal Unit Test Coverage
- **Impact**: The entire codebase has exactly 1 unit test (`test_regex_match`) that tests the generic `regex_match` function with a simple numeric regex. None of the built-in detectors (email, SSN, credit card) have dedicated tests. The HTTP handler `handle_text_contents` is completely untested. Edge cases like empty input, invalid regex, overlapping matches, and malformed JSON are not covered.
- **Severity**: HIGH
- **Effort**: 6-8 hours
- **Test-to-code ratio**: ~27 test lines / 138 production lines = 0.20 (target: >1.0)

### 3. No Integration or E2E Tests
- **Impact**: The HTTP API contract (`POST /api/v1/text/contents`) is never tested end-to-end. Request validation (empty regex returns 400), response format (nested array structure `[[...]]`), multi-content processing, and error handling paths are all unverified.
- **Severity**: HIGH
- **Effort**: 4-6 hours

### 4. No Security Scanning
- **Impact**: No dependency vulnerability scanning (cargo-audit), no container image scanning (Trivy/Snyk), no SAST tools, no secret detection. The project uses `ubi9/ubi-minimal:latest` as base image without pinning — vulnerable base images could ship to production undetected.
- **Severity**: HIGH
- **Effort**: 2-3 hours

### 5. No Coverage Tracking
- **Impact**: No visibility into what code is tested. No coverage thresholds to prevent regression. No PR coverage reporting. With only 1 test, actual coverage is estimated at <10%.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours

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
  check:
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

### 2. Add Unit Tests for Built-in Detectors (2-3 hours)
Add tests for `email_address_detector`, `ssn_detector`, and `credit_card_detector` with:
- Valid match cases (various formats)
- Non-match cases (partial matches, wrong formats)
- Edge cases (empty strings, multiple matches in one input)

### 3. Add cargo-tarpaulin Coverage (1-2 hours)
```yaml
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo install cargo-tarpaulin
      - run: cargo tarpaulin --out xml
      - uses: codecov/codecov-action@v4
```

### 4. Add Trivy Container Scanning (1 hour)
```yaml
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t regex-detector .
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: regex-detector
          severity: CRITICAL,HIGH
```

## Detailed Findings

### CI/CD Pipeline
- **Workflows**: None. The `.github/` directory does not exist.
- **PR validation**: None. PRs have no automated checks.
- **Build automation**: Only via Dockerfile multi-stage builds.
- **Caching**: N/A — no CI to cache.
- **Concurrency control**: N/A.

### Test Coverage
- **Framework**: Rust's built-in `#[cfg(test)]` module in `detectors.rs`
- **Test count**: 1 test (`test_regex_match`)
- **What's tested**: Generic `regex_match()` function with a simple numeric pattern
- **What's NOT tested**:
  - `email_address_detector()` — email regex never validated
  - `ssn_detector()` — SSN regex never validated
  - `credit_card_detector()` — credit card regex never validated
  - `handle_text_contents()` — HTTP handler never tested
  - Error paths (empty regex, invalid regex, malformed JSON)
  - Multi-content processing (multiple items in `contents` array)
  - Custom regex handling path
  - Response format validation (nested array `[[...]]`)

### Code Quality
- **Linting**: Clippy is configured in `rust-toolchain.toml` and run in Dockerfile `lint` stage, but not in CI.
- **Formatting**: rustfmt configured in `rust-toolchain.toml` and checked in Dockerfile `format` stage, but not in CI.
- **Pre-commit hooks**: None.
- **Static analysis**: None beyond Clippy in Docker build.
- **Code style**: Clean, idiomatic Rust. Good use of pattern matching and error handling with `Result` types.

### Container Images
- **Dockerfile**: Well-structured multi-stage build with separate builder, test, lint, format, and release stages.
- **Base image**: `ubi9/ubi-minimal:latest` — good choice for Red Hat compatibility, but `latest` tag is unpinned.
- **Multi-architecture**: Not configured.
- **Runtime validation**: None — image startup and health endpoint not tested.
- **Security scanning**: None — no Trivy, Snyk, or cargo-audit.
- **SBOM generation**: None.
- **Image signing**: None.
- **Notable**: The Dockerfile installs `compat-openssl11` which may not be needed and could introduce vulnerabilities.

### Security
- **SAST**: None (no CodeQL, Semgrep, or gosec equivalent)
- **Dependency scanning**: None (no cargo-audit or Dependabot)
- **Secret detection**: None (no Gitleaks or TruffleHog)
- **Container scanning**: None
- **Input validation**: Minimal — checks for empty regex but no regex complexity limits (potential ReDoS vector)
- **Potential ReDoS concern**: Custom regex patterns are accepted from user input and compiled without complexity limits. A malicious regex could cause CPU exhaustion.

### Agent Rules (Agentic Flow Quality)
- **Status**: Missing
- **CLAUDE.md**: Not present
- **`.claude/` directory**: Not present
- **`.claude/rules/`**: Not present
- **Test guidance**: None
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` including:
  - Unit test patterns for Rust `#[cfg(test)]` modules
  - Integration test patterns using `axum::test` or `reqwest`
  - Regex detector test templates
  - API contract test guidance

## Recommendations

### Priority 0 (Critical)
1. **Create GitHub Actions CI workflow** — Add `.github/workflows/ci.yml` with `cargo test`, `cargo clippy`, and `cargo fmt --check` on every PR. This is the single highest-impact improvement.
2. **Add unit tests for all built-in detectors** — Each of the 3 detectors (email, SSN, credit card) needs at minimum: valid match, no match, edge case, and multi-match tests.
3. **Add HTTP handler integration tests** — Use `axum::test` helpers or start the server in tests to validate the API contract, error responses, and multi-content processing.

### Priority 1 (High Value)
4. **Add cargo-tarpaulin coverage tracking** — Generate coverage reports and integrate with Codecov. Set a minimum coverage threshold (e.g., 60% initially, increasing over time).
5. **Add container security scanning** — Trivy or Snyk for image CVE scanning, cargo-audit for Rust dependency vulnerabilities.
6. **Pin base image tag** — Replace `ubi9/ubi-minimal:latest` with a specific digest or version tag for reproducible builds.
7. **Add Dependabot or Renovate** — Automated dependency update PRs for Cargo dependencies.
8. **Create CLAUDE.md** — Document test patterns, contribution guidelines, and quality standards for AI-assisted development.

### Priority 2 (Nice-to-Have)
9. **Add ReDoS protection** — Limit regex complexity or use `regex` crate's built-in time limits for user-supplied patterns.
10. **Add property-based testing** — Use `proptest` crate to fuzz regex detectors with random inputs.
11. **Add API documentation** — OpenAPI/Swagger spec for the `/api/v1/text/contents` endpoint.
12. **Add benchmarks** — `criterion` benchmarks for regex compilation and matching performance.
13. **Add pre-commit hooks** — Local `cargo fmt` and `cargo clippy` before commit.
14. **Multi-architecture builds** — Add `--platform linux/amd64,linux/arm64` support.

## Comparison to Gold Standards

| Dimension | guardrails-regex-detector | odh-dashboard | notebooks | kserve |
|-----------|--------------------------|---------------|-----------|--------|
| Unit Tests | 1 test (2/10) | Comprehensive Jest suite (9/10) | N/A | Extensive Go tests (9/10) |
| Integration/E2E | None (0/10) | Cypress E2E + API tests (9/10) | Notebook validation (8/10) | Multi-version E2E (9/10) |
| Build Integration | No CI (1/10) | PR-time builds + overlays (8/10) | Image pipeline (8/10) | Konflux integration (7/10) |
| Image Testing | Dockerfile stages only (3/10) | Dev/prod image validation (8/10) | 5-layer validation (9/10) | Multi-image testing (8/10) |
| Coverage | None (0/10) | Codecov enforced (8/10) | N/A | Codecov with thresholds (9/10) |
| CI/CD | None (0/10) | Multi-workflow CI/CD (9/10) | Periodic + PR workflows (8/10) | Comprehensive CI (9/10) |
| Agent Rules | None (0/10) | Comprehensive rules (8/10) | Basic rules (4/10) | None (0/10) |
| **Overall** | **2.8/10** | **8.5/10** | **7.5/10** | **8.0/10** |

## File Paths Reference

| File | Purpose |
|------|---------|
| `Cargo.toml` | Rust project configuration, dependencies |
| `Cargo.lock` | Pinned dependency versions |
| `src/main.rs` | HTTP server setup (Axum router, health endpoint) |
| `src/detectors.rs` | Core regex detection logic, built-in detectors, HTTP handler, tests |
| `Dockerfile` | Multi-stage build (builder → tests → lint → format → release) |
| `rust-toolchain.toml` | Pinned Rust toolchain (1.84.0) with clippy + rustfmt |
| `README.md` | API documentation with sample request/response |
| `.gitignore` | Ignores `/target` directory |

## Summary

The `guardrails-regex-detector` is a small but functional Rust microservice that serves as a PII detection component for the FMS Guardrails ecosystem. While the code itself is clean and well-structured, the project has **critical quality infrastructure gaps**:

- **No CI/CD at all** — the most impactful gap
- **Near-zero test coverage** — only 1 test for ~212 LOC
- **No security scanning** — particularly concerning for a security-focused tool
- **No agent rules** — missing guidance for AI-assisted development

The Dockerfile's multi-stage build with test/lint/format stages shows intent to maintain quality, but without CI automation these checks only run during manual Docker builds. The top priority should be establishing a GitHub Actions CI pipeline, followed by comprehensive test coverage for the regex detectors that are the core value proposition of this service.
