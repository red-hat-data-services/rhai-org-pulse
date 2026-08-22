---
repository: "red-hat-data-services/guardrails-regex-detector"
overall_score: 1.6
scorecard:
  - dimension: "Unit Tests"
    score: 3.0
    status: "Single test module with 1 test; critical detector functions untested"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests exist"
  - dimension: "Build Integration"
    score: 3.0
    status: "Dockerfile has test/lint/format stages but no CI integration"
  - dimension: "Image Testing"
    score: 4.0
    status: "Multi-stage Dockerfile with UBI base but no runtime validation"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling or tracking configured"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "No CI/CD workflows or automation of any kind"
  - dimension: "Static Analysis"
    score: 3.0
    status: "Clippy and rustfmt in Dockerfile stages only; no dependency alerts"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No CI/CD automation"
    impact: "No automated testing, linting, or builds on PRs — quality checks rely entirely on manual effort"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No integration tests for HTTP endpoints"
    impact: "API behavior changes or regressions go undetected; the core /api/v1/text/contents endpoint is untested"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No coverage tracking"
    impact: "No visibility into which code paths are exercised by tests; no enforcement of coverage thresholds"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Critical detector functions untested"
    impact: "email, SSN, and credit-card regex detectors have zero test coverage — PII detection failures would go unnoticed"
    severity: "HIGH"
    effort: "2-4 hours"
quick_wins:
  - title: "Add unit tests for all built-in detectors (email, SSN, credit-card)"
    effort: "2-3 hours"
    impact: "Cover the most critical functionality — PII detection regex patterns — with targeted tests"
  - title: "Add a GitHub Actions CI workflow for PR validation"
    effort: "2-3 hours"
    impact: "Automated cargo test, clippy, and fmt checks on every PR"
  - title: "Enable Dependabot for Cargo dependencies"
    effort: "1 hour"
    impact: "Automated dependency update PRs with security alerts"
  - title: "Add HEALTHCHECK to Dockerfile"
    effort: "30 minutes"
    impact: "Container orchestrators can detect unhealthy instances automatically"
recommendations:
  priority_0:
    - "Create GitHub Actions CI workflow with cargo test, clippy, and fmt on PRs"
    - "Add unit tests for email_address_detector, ssn_detector, and credit_card_detector functions"
    - "Add integration tests for the /api/v1/text/contents HTTP endpoint"
  priority_1:
    - "Add coverage tracking with cargo-tarpaulin or cargo-llvm-cov and codecov integration"
    - "Configure Dependabot for Cargo ecosystem dependency updates"
    - "Add edge-case tests: invalid regex input, empty contents, malformed requests"
  priority_2:
    - "Add CLAUDE.md with test creation rules for the project"
    - "Add multi-architecture build support in Dockerfile"
    - "Add HEALTHCHECK instruction to Dockerfile"
    - "Add pre-commit hooks for clippy and fmt"
---

# Quality Analysis: guardrails-regex-detector

## Executive Summary

- **Overall Score: 1.6/10**
- **Repository**: [red-hat-data-services/guardrails-regex-detector](https://github.com/red-hat-data-services/guardrails-regex-detector)
- **Tier**: Downstream (AI Safety component, RHOAIENG)
- **Language**: Rust (edition 2021)
- **Type**: HTTP microservice (axum-based regex detector for PII)
- **Codebase Size**: 2 source files (~210 lines of Rust)

### Key Strengths
- Multi-stage Dockerfile with dedicated test, lint, and format stages
- Uses UBI9 minimal base image (FIPS-capable)
- Rust toolchain pins clippy and rustfmt components
- Clean, focused codebase with a clear purpose

### Critical Gaps
- **No CI/CD automation at all** — no `.github/workflows/`, no Makefile, no pipeline configuration
- **Minimal test coverage** — 1 test for the generic `regex_match` function; all built-in detectors untested
- **No integration tests** — the core HTTP endpoint `/api/v1/text/contents` is completely untested
- **No coverage tracking** — no visibility into test coverage
- **No dependency management** — no Dependabot or Renovate configured

### Agent Rules Status: Missing
No CLAUDE.md, AGENTS.md, or `.claude/` directory present.

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 3.0/10 | Single test module with 1 test; critical detectors untested |
| Integration/E2E | 20% | 0.0/10 | No integration or E2E tests exist |
| Build Integration | 15% | 3.0/10 | Dockerfile has test/lint/format stages but no CI |
| Image Testing | 10% | 4.0/10 | Multi-stage UBI build but no runtime validation |
| Coverage Tracking | 10% | 0.0/10 | No coverage tooling configured |
| CI/CD Automation | 15% | 0.0/10 | No CI/CD workflows or automation |
| Static Analysis | 10% | 3.0/10 | Clippy/fmt in Dockerfile only; no dependency alerts |
| Agent Rules | 5% | 0.0/10 | No agent rules or test guidance |
| **Overall** | **100%** | **1.6/10** | **Critical gaps across most dimensions** |

## Critical Gaps

### 1. No CI/CD Automation
- **Severity**: HIGH
- **Impact**: No automated testing, linting, or builds on PRs. Quality checks rely entirely on manual effort or Dockerfile build stages being run locally.
- **Effort**: 4-8 hours
- **Details**: The repository has zero CI/CD configuration — no `.github/` directory, no `Makefile`, no `.gitlab-ci.yml`, no `Jenkinsfile`. While the Dockerfile includes test, lint, and format stages, these only run during container builds, not on PR submissions.

### 2. No Integration Tests for HTTP Endpoints
- **Severity**: HIGH
- **Impact**: The core API endpoint `/api/v1/text/contents` is completely untested. API behavior changes, request validation failures, or response format regressions would go undetected.
- **Effort**: 4-6 hours
- **Details**: The HTTP service handles PII detection requests but has no integration tests exercising the full request/response cycle. Axum provides excellent test utilities (`TestClient`) that could be used without requiring a running server.

### 3. No Coverage Tracking
- **Severity**: HIGH
- **Impact**: No visibility into which code paths are exercised by tests. No enforcement of coverage thresholds on PRs.
- **Effort**: 2-4 hours
- **Details**: No coverage tools (cargo-tarpaulin, cargo-llvm-cov) or reporting services (Codecov, Coveralls) are configured.

### 4. Critical Detector Functions Untested
- **Severity**: HIGH
- **Impact**: The three built-in PII detectors (`email_address_detector`, `ssn_detector`, `credit_card_detector`) have zero test coverage. These are the primary value proposition of the service — regex patterns for detecting sensitive data — and failures would go unnoticed.
- **Effort**: 2-4 hours
- **Details**: Only the generic `regex_match()` function has a test. The specific detector functions with their complex regex patterns (SSN: 5+ alternation groups, credit card: 4 major card types) are untested.

## Quick Wins

### 1. Add Unit Tests for Built-in Detectors
- **Effort**: 2-3 hours
- **Impact**: Cover the most critical functionality with targeted tests
- **Implementation**:
```rust
#[test]
fn test_email_detector() {
    let content = "contact me at user@example.com please".to_string();
    let results = email_address_detector(&content).unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].text, "user@example.com");
    assert_eq!(results[0].detection, "EmailAddress");
    assert_eq!(results[0].detection_type, "pii");
}

#[test]
fn test_ssn_detector() {
    let content = "my ssn is 123-45-6789".to_string();
    let results = ssn_detector(&content).unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].text, "123-45-6789");
    assert_eq!(results[0].detection, "SocialSecurity");
}

#[test]
fn test_credit_card_detector() {
    let content = "amex 374245455400126".to_string();
    let results = credit_card_detector(&content).unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].detection, "CreditCard");
}

#[test]
fn test_no_match() {
    let content = "no sensitive data here".to_string();
    let results = email_address_detector(&content).unwrap();
    assert_eq!(results.len(), 0);
}
```

### 2. Add GitHub Actions CI Workflow
- **Effort**: 2-3 hours
- **Impact**: Automated quality gates on every PR
- **Implementation**:
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

### 3. Enable Dependabot
- **Effort**: 1 hour
- **Impact**: Automated dependency updates with security alerts
- **Implementation**:
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "cargo"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

### 4. Add HEALTHCHECK to Dockerfile
- **Effort**: 30 minutes
- **Impact**: Container health detection for orchestrators
- **Implementation**:
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1
```

## Detailed Findings

### Unit Tests

**Score: 3.0/10**

The repository has a single test module in `src/detectors.rs` (lines 139–166) containing one test:

- `test_regex_match()` — tests the generic `regex_match()` helper with a simple numeric pattern

**What's tested:**
- Basic regex matching against a simple pattern (`^[0-9]+$`)

**What's NOT tested:**
- `email_address_detector()` — complex email regex pattern
- `ssn_detector()` — SSN regex with 5+ alternation groups (most complex regex in the codebase)
- `credit_card_detector()` — credit card regex covering 4 major card types
- `handle_text_contents()` — the main request handler
- Edge cases: invalid regex, empty input, multiple matches, overlapping patterns
- Error paths: malformed requests, empty regex list

**Test-to-code ratio**: ~27 lines of test code / ~137 lines of production code = 0.20 (very low)

### Integration/E2E Tests

**Score: 0.0/10**

No integration or E2E tests exist. There are no `tests/`, `e2e/`, or `integration/` directories. The HTTP API endpoint is untested at the integration level.

**Missing coverage:**
- POST `/api/v1/text/contents` with valid payloads
- POST `/api/v1/text/contents` with empty regex list (should return 400)
- POST `/api/v1/text/contents` with invalid JSON
- GET `/health` endpoint
- Multiple content items with multiple regex patterns
- Custom regex alongside built-in detectors

Axum's built-in test utilities (`axum::test::TestClient` or `tower::ServiceExt`) make integration testing straightforward without spinning up a server.

### Build Integration

**Score: 3.0/10**

The Dockerfile demonstrates awareness of build-time validation with dedicated stages:

```dockerfile
FROM regex-detector-builder AS tests
RUN cargo test

FROM regex-detector-builder AS lint
RUN cargo clippy --all-targets --all-features -- -D warnings

FROM regex-detector-builder AS format
RUN cargo fmt --check
```

However, these stages are **not part of the default build** — the release image (`regex-detector-release`) is built from `regex-detector-builder`, not through the test/lint/format stages. These stages would only run if explicitly targeted (`docker build --target tests .`).

**What's present:**
- Multi-stage Dockerfile with test, lint, format stages
- Cargo-based build with explicit `cargo install`

**What's missing:**
- No CI/CD pipeline to run these stages on PRs
- No Makefile with convenience targets
- No Konflux build simulation
- Test/lint/format stages aren't wired into the default build path

### Image Testing

**Score: 4.0/10**

**What's present:**
- Multi-stage build separating builder from runtime
- UBI9 minimal base image (`registry.access.redhat.com/ubi9/ubi-minimal`) — FIPS-capable
- Build args for base image customization
- Minimal runtime image (copies only the binary)

**What's missing:**
- No `HEALTHCHECK` instruction (despite the app having a `/health` endpoint)
- No runtime validation (no testcontainers, no startup check)
- No multi-architecture support (`--platform` / `docker buildx`)
- No `.dockerignore` (only `.gitignore` with `/target`)
- `compat-openssl11` is installed but may not be needed (Rust binary is statically linked unless using OpenSSL features)

### Coverage Tracking

**Score: 0.0/10**

No coverage tooling is configured:
- No `cargo-tarpaulin` or `cargo-llvm-cov` usage
- No `.codecov.yml` or `codecov.yml`
- No coverage thresholds
- No PR coverage reporting
- No CI step to generate coverage reports

### CI/CD Automation

**Score: 0.0/10**

The repository has **no CI/CD configuration whatsoever**:
- No `.github/` directory (no workflows, no Dependabot, no issue templates)
- No `Makefile`
- No `.gitlab-ci.yml`
- No `Jenkinsfile`
- No `Taskfile.yml`

All quality checks (test, lint, format) exist only as Dockerfile stages that must be manually invoked. There is no automated gate on PRs.

### Static Analysis

**Score: 3.0/10**

#### Linting
- `clippy` is pinned in `rust-toolchain.toml` and used in a Dockerfile stage with strict settings (`-D warnings`)
- `rustfmt` is pinned in `rust-toolchain.toml` and checked in a Dockerfile stage
- **However**, neither runs automatically — no CI pipeline triggers them

#### FIPS Compatibility
- No cryptographic imports in the Rust source code (uses `regex` crate only)
- UBI9 base image is FIPS-capable (positive)
- `compat-openssl11` is installed in the container but no crypto operations are performed in the application code
- **No FIPS concerns identified** for this specific service

#### Dependency Alerts
- No `.github/dependabot.yml`
- No `renovate.json` / `.renovaterc`
- Dependencies are pinned in `Cargo.toml` with exact minor versions but no automated update mechanism

### Agent Rules

**Score: 0.0/10**

- **Status**: Missing
- **Coverage**: N/A
- No `CLAUDE.md` or `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` for test creation guidance
- No testing documentation beyond the README
- **Recommendation**: Generate test creation rules with `/test-rules-generator`

## Recommendations

### Priority 0 (Critical)

1. **Create GitHub Actions CI workflow** — Add `.github/workflows/ci.yml` with `cargo test`, `cargo clippy`, and `cargo fmt --check` on pull requests. This is the single highest-impact improvement. (~3 hours)

2. **Add unit tests for all built-in detector functions** — The email, SSN, and credit-card detectors contain complex regex patterns that are completely untested. Include positive matches, negative matches, and edge cases (e.g., SSN with spaces vs dashes, multiple email addresses in one string). (~3 hours)

3. **Add integration tests for the HTTP endpoint** — Test `POST /api/v1/text/contents` with axum test utilities covering valid requests, error responses (empty regex), and the `/health` endpoint. (~4 hours)

### Priority 1 (High Value)

4. **Add coverage tracking** — Configure `cargo-tarpaulin` or `cargo-llvm-cov` in CI with Codecov integration. Set an initial threshold based on current coverage and increase over time. (~3 hours)

5. **Configure Dependabot** — Add `.github/dependabot.yml` for the Cargo ecosystem to receive automated dependency update PRs. (~1 hour)

6. **Add edge-case and error-handling tests** — Test invalid regex patterns, empty content arrays, very large payloads, and Unicode edge cases. (~2 hours)

### Priority 2 (Nice-to-Have)

7. **Add CLAUDE.md with test creation rules** — Document test patterns, naming conventions, and quality expectations for AI-assisted development. (~2 hours)

8. **Add multi-architecture build support** — Use `docker buildx` for multi-arch images (amd64, arm64). (~2 hours)

9. **Add HEALTHCHECK to Dockerfile** — Wire the existing `/health` endpoint to a Docker HEALTHCHECK instruction. (~30 minutes)

10. **Add pre-commit hooks** — Configure `.pre-commit-config.yaml` with clippy and fmt checks for local development. (~1 hour)

## Comparison to Gold Standards

| Dimension | guardrails-regex-detector | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|-----------|:---:|:---:|:---:|:---:|
| Unit Tests | 3/10 | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 0/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 3/10 | 8/10 | 8/10 | 8/10 |
| Image Testing | 4/10 | 7/10 | 9/10 | 7/10 |
| Coverage Tracking | 0/10 | 8/10 | 6/10 | 9/10 |
| CI/CD Automation | 0/10 | 9/10 | 8/10 | 9/10 |
| Static Analysis | 3/10 | 8/10 | 7/10 | 8/10 |
| Agent Rules | 0/10 | 8/10 | 3/10 | 3/10 |
| **Overall** | **1.6** | **8.5** | **7.3** | **8.1** |

The largest gaps compared to gold standards are in CI/CD automation, integration testing, and coverage tracking — all of which are entirely absent.

## File Paths Reference

| File | Purpose |
|------|---------|
| `Cargo.toml` | Rust package configuration with dependencies |
| `rust-toolchain.toml` | Pins Rust 1.84.0 with clippy and rustfmt components |
| `Dockerfile` | Multi-stage build with test/lint/format stages and UBI9 base |
| `src/main.rs` | HTTP server setup (axum router with /health and /api/v1/text/contents) |
| `src/detectors.rs` | Regex detection logic, built-in patterns (email, SSN, credit card), and 1 test |
| `.gitignore` | Ignores /target |
| `README.md` | API documentation with sample request/response |
