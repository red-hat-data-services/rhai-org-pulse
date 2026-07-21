---
repository: "trustyai-explainability/guardrails-regex-detector"
overall_score: 1.8
scorecard:
  - dimension: "Unit Tests"
    score: 3.0
    status: "Single test case covering only the regex_match helper; no tests for 3 built-in detectors or HTTP handler"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests; no API-level testing of HTTP endpoints"
  - dimension: "Build Integration"
    score: 3.0
    status: "Dockerfile has test/lint/format stages but no CI pipeline to run them on PRs"
  - dimension: "Image Testing"
    score: 4.0
    status: "Multi-stage Dockerfile with UBI base image; no runtime validation or HEALTHCHECK"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling configured (no tarpaulin, cargo-llvm-cov, or codecov)"
  - dimension: "CI/CD Automation"
    score: 1.0
    status: "No GitHub Actions workflows; build validation only happens inside Dockerfile stages"
  - dimension: "Static Analysis"
    score: 3.0
    status: "Clippy and rustfmt in Dockerfile but no CI enforcement; no dependency alerts"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No CI/CD pipeline"
    impact: "No automated testing, linting, or build validation on PRs; quality checks only run during Docker image builds"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Minimal unit test coverage"
    impact: "Only 1 test case for a helper function; 3 built-in PII detectors and the HTTP handler are completely untested"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No integration or E2E tests"
    impact: "HTTP API behavior is never validated; regressions in request/response handling go undetected"
    severity: "HIGH"
    effort: "6-10 hours"
  - title: "No coverage tracking"
    impact: "No visibility into what percentage of code is tested; no enforcement of coverage thresholds"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No dependency management automation"
    impact: "Security vulnerabilities in dependencies not detected automatically; manual tracking required"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add GitHub Actions CI workflow for PRs"
    effort: "2-3 hours"
    impact: "Automated test, lint, and format checks on every PR"
  - title: "Add unit tests for built-in detectors (email, SSN, credit card)"
    effort: "2-3 hours"
    impact: "Cover the core detection logic with edge cases and validation"
  - title: "Enable Dependabot for Cargo dependencies"
    effort: "30 minutes"
    impact: "Automated security and dependency updates"
  - title: "Add cargo-tarpaulin for coverage tracking"
    effort: "1-2 hours"
    impact: "Visibility into test coverage with PR reporting"
  - title: "Add HEALTHCHECK to Dockerfile"
    effort: "30 minutes"
    impact: "Container orchestrators can detect unhealthy instances"
recommendations:
  priority_0:
    - "Create GitHub Actions CI workflow with cargo test, clippy, and fmt checks on PRs"
    - "Add unit tests for all 3 built-in detectors (email, SSN, credit card) with positive and negative cases"
    - "Add integration tests for the HTTP API endpoint using axum::test or reqwest"
  priority_1:
    - "Configure cargo-tarpaulin or cargo-llvm-cov for coverage tracking with Codecov integration"
    - "Enable Dependabot for cargo and docker dependency updates"
    - "Add HEALTHCHECK instruction to Dockerfile"
    - "Create CLAUDE.md with Rust testing patterns and project conventions"
  priority_2:
    - "Add multi-architecture image builds (amd64, arm64)"
    - "Add container runtime validation tests (start container, hit /health)"
    - "Add pre-commit hooks for clippy and rustfmt"
    - "Add property-based testing with proptest for regex detection edge cases"
---

# Quality Analysis: trustyai-explainability/guardrails-regex-detector

## Executive Summary
- **Overall Score: 1.8/10**
- **Repository Type**: Rust HTTP service (Axum framework)
- **Primary Language**: Rust
- **Component**: AI Safety (RHOAIENG)
- **Tier**: Upstream
- **Key Strengths**: Multi-stage Dockerfile with UBI base image, Clippy/rustfmt defined in build stages
- **Critical Gaps**: No CI/CD pipeline, minimal unit tests, no integration/E2E tests, no coverage tracking, no agent rules
- **Agent Rules Status**: Missing

## Quality Scorecard
| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 3/10 | 15% | Single test case; built-in detectors untested |
| Integration/E2E | 0/10 | 20% | No integration or E2E tests |
| Build Integration | 3/10 | 15% | Dockerfile stages only; no CI pipeline |
| Image Testing | 4/10 | 10% | Multi-stage UBI build; no runtime validation |
| Coverage Tracking | 0/10 | 10% | No coverage tooling |
| CI/CD Automation | 1/10 | 15% | No GitHub Actions workflows |
| Static Analysis | 3/10 | 10% | Clippy/fmt in Dockerfile; no CI enforcement |
| Agent Rules | 0/10 | 5% | No agent rules |

## Critical Gaps

### 1. No CI/CD Pipeline
- **Impact**: No automated testing, linting, or build validation on PRs. Quality checks only run during Docker image builds, which means contributors can push code that breaks tests without knowing.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The repository has zero GitHub Actions workflows. The only automated checks (cargo test, clippy, fmt) are embedded in Dockerfile stages, but these only run when someone builds the Docker image locally — not on PRs.

### 2. Minimal Unit Test Coverage
- **Impact**: Only 1 test case exists (`test_regex_match` in `detectors.rs`), testing only the generic `regex_match` helper. The 3 built-in PII detectors (`email_address_detector`, `ssn_detector`, `credit_card_detector`) and the HTTP handler (`handle_text_contents`) are completely untested.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**:
  - `email_address_detector` — 0 tests (no validation of email patterns)
  - `ssn_detector` — 0 tests (no validation of SSN formats)
  - `credit_card_detector` — 0 tests (no validation of card number patterns)
  - `handle_text_contents` — 0 tests (no API handler testing)
  - Edge cases: empty input, invalid regex, multiple matches, overlapping patterns — all untested

### 3. No Integration or E2E Tests
- **Impact**: The HTTP API behavior is never validated end-to-end. Regressions in request parsing, response format, error handling, or routing go undetected until production.
- **Severity**: HIGH
- **Effort**: 6-10 hours
- **Details**: No `tests/` directory, no integration test module, no API-level testing. The Axum framework provides excellent testing utilities (`axum::test`) that are not being used.

### 4. No Coverage Tracking
- **Impact**: No visibility into what percentage of code is tested. Cannot enforce coverage thresholds on PRs.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours

### 5. No Dependency Management Automation
- **Impact**: No Dependabot or Renovate configured. Security vulnerabilities in `axum`, `regex`, `serde`, `tokio`, or other dependencies are not detected automatically.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours

## Quick Wins

### 1. Add GitHub Actions CI Workflow (2-3 hours)
```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy, rustfmt
      - uses: Swatinem/rust-cache@v2
      - name: Check formatting
        run: cargo fmt --check
      - name: Lint
        run: cargo clippy --all-targets --all-features -- -D warnings
      - name: Test
        run: cargo test --verbose
```

### 2. Add Unit Tests for Built-in Detectors (2-3 hours)
```rust
// In src/detectors.rs, extend the #[cfg(test)] module:
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_email_detector_valid() {
        let content = "contact me at user@example.com please".to_string();
        let results = email_address_detector(&content).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].text, "user@example.com");
        assert_eq!(results[0].detection, "EmailAddress");
        assert_eq!(results[0].detection_type, "pii");
    }

    #[test]
    fn test_email_detector_no_match() {
        let content = "no email here".to_string();
        let results = email_address_detector(&content).unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_ssn_detector_dashed() {
        let content = "my ssn is 123-45-6789".to_string();
        let results = ssn_detector(&content).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].text, "123-45-6789");
        assert_eq!(results[0].detection, "SocialSecurity");
    }

    #[test]
    fn test_credit_card_detector_amex() {
        let content = "amex 374245455400126".to_string();
        let results = credit_card_detector(&content).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].detection, "CreditCard");
    }

    #[test]
    fn test_credit_card_no_match() {
        let content = "not a card number 123".to_string();
        let results = credit_card_detector(&content).unwrap();
        assert!(results.is_empty());
    }
}
```

### 3. Enable Dependabot (30 minutes)
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "cargo"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"

  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
    labels:
      - "dependencies"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
    labels:
      - "dependencies"
```

### 4. Add Coverage Tracking (1-2 hours)
```yaml
# Add to .github/workflows/ci.yml
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - name: Install tarpaulin
        run: cargo install cargo-tarpaulin
      - name: Generate coverage
        run: cargo tarpaulin --out xml
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: cobertura.xml
          fail_ci_if_error: true
```

### 5. Add HEALTHCHECK to Dockerfile (30 minutes)
```dockerfile
# Add before CMD in Dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1
```

## Detailed Findings

### Unit Tests

**Status: Weak (3/10)**

**What Exists:**
- Single `#[cfg(test)]` module in `src/detectors.rs` with 1 test:
  - `test_regex_match`: Tests the `regex_match` helper with a numbers-only regex pattern
- The test uses `PartialEq` derive on `DetectionResponse` (via `#[cfg_attr(test, derive(PartialEq))]`)

**What's Missing:**
- Tests for `email_address_detector` — the email regex pattern is never validated
- Tests for `ssn_detector` — the SSN regex pattern (which is complex with multiple formats) is never validated
- Tests for `credit_card_detector` — credit card patterns are never validated
- Tests for `handle_text_contents` — the main HTTP handler is never tested
- Edge cases: empty strings, strings with multiple matches, overlapping patterns, Unicode input
- Error paths: invalid regex patterns, empty regex list
- No test for `main.rs` (server startup, port configuration, host parsing)

**Test-to-Code Ratio:**
- Source lines: 212 (46 in main.rs + 166 in detectors.rs)
- Test lines: ~26 (embedded in detectors.rs)
- Test-to-code ratio: ~12% (very low)
- Test files: 0 standalone (tests are inline)

**Frameworks:**
- Rust built-in `#[test]` framework — no additional test dependencies in `Cargo.toml`

### Integration/E2E Tests

**Status: Missing (0/10)**

- No `tests/` directory (Rust convention for integration tests)
- No API-level testing using `axum::test` or `reqwest`
- No test for the complete request/response cycle
- No multi-content input testing
- No error response testing (e.g., empty regex list returns 400)

**What Should Exist:**
```rust
// tests/api_test.rs
use axum::http::StatusCode;
use axum_test::TestServer;

#[tokio::test]
async fn test_health_endpoint() {
    let app = create_app();
    let server = TestServer::new(app).unwrap();
    let response = server.get("/health").await;
    response.assert_status_ok();
    response.assert_text("healthy");
}

#[tokio::test]
async fn test_detect_email() {
    let app = create_app();
    let server = TestServer::new(app).unwrap();
    let response = server.post("/api/v1/text/contents")
        .json(&serde_json::json!({
            "contents": ["email@domain.com"],
            "detector_params": { "regex": ["email"] }
        }))
        .await;
    response.assert_status_ok();
}
```

### Build Integration

**Status: Weak (3/10)**

**What Exists:**
- Dockerfile has multi-stage builds with dedicated stages:
  - `tests` stage: runs `cargo test`
  - `lint` stage: runs `cargo clippy --all-targets --all-features -- -D warnings`
  - `format` stage: runs `cargo fmt --check`
- These stages validate code quality during image builds

**What's Missing:**
- No GitHub Actions workflow to trigger these on PRs
- No PR-time build validation — Dockerfile stages only run when someone explicitly builds the image
- No Konflux build simulation
- No Kustomize/manifest validation (if applicable)
- No `Makefile` or `Taskfile` for standardized build targets

**Critical Gap**: The test/lint/format Dockerfile stages exist but are effectively unused because there's no CI to invoke them. A contributor can push broken code and it won't be caught until someone builds the image.

### Image Testing

**Status: Adequate-Low (4/10)**

**Strengths:**
- Multi-stage Dockerfile separating build from runtime
- UBI minimal base image (`registry.access.redhat.com/ubi9/ubi-minimal`) — FIPS-capable
- Dedicated builder stage with specific Rust version (1.84.0)
- Test, lint, and format stages for validation
- ARG-based base image selection for flexibility

**Gaps:**
- No `HEALTHCHECK` instruction in Dockerfile — container orchestrators can't detect unhealthy instances
- No runtime validation tests (starting container and hitting /health)
- No multi-architecture support (no `--platform`, no `docker buildx`)
- No `.dockerignore` beyond `/target` — build context may include unnecessary files
- No non-root user configuration in release image
- `compat-openssl11` installed but no documentation of why it's needed

### Coverage Tracking

**Status: Missing (0/10)**

- No `cargo-tarpaulin` or `cargo-llvm-cov` configured
- No `.codecov.yml` or `codecov.yml`
- No coverage thresholds defined
- No PR coverage reporting
- No coverage badges

### CI/CD Automation

**Status: Critical Gap (1/10)**

- **Zero GitHub Actions workflows** — no `.github/workflows/` directory
- No CI/CD of any kind (no GitLab CI, no Jenkins, no Tekton)
- No `Makefile` for standard build/test targets
- No `Taskfile.yml`
- The only form of automation is the Dockerfile stages, which require manual invocation
- Score of 1 (rather than 0) because the Dockerfile stages at least define what should be checked

### Static Analysis

**Status: Weak (3/10)**

#### Linting
- `cargo clippy` configured in Dockerfile with strict settings (`-D warnings`)
- `cargo fmt --check` configured in Dockerfile
- `rust-toolchain.toml` specifies `clippy` and `rustfmt` components
- BUT: these only run during Docker builds, not in CI

#### FIPS Compatibility
- **No crypto imports found** — the codebase uses only the `regex` crate, not any cryptographic libraries
- **UBI base image** — FIPS-capable (good)
- **`compat-openssl11` installed** — this is a runtime dependency, suggests OpenSSL usage via linked libraries
- No FIPS build tags needed (no crypto in Rust code)
- Overall FIPS posture: acceptable for the scope of this service

#### Dependency Alerts
- **No `.github/dependabot.yml`** — dependencies not monitored
- **No `renovate.json`** — no alternative dependency management
- `Cargo.lock` is committed (good for reproducibility)
- 8 direct dependencies, all popular crates but unmonitored for CVEs

### Agent Rules

**Status: Missing (0/10)**

- No `CLAUDE.md` or `AGENTS.md` in repository root
- No `.claude/` directory
- No test creation rules
- No project conventions documented for AI agents

**Impact**: AI agents generating code or tests for this repo have no guidance on:
- Rust testing conventions (inline tests vs integration tests)
- The Axum framework patterns used
- PII detection patterns and validation requirements
- Error handling conventions
- Dockerfile build stage patterns

## Recommendations

### Priority 0 (Critical)
1. **Create GitHub Actions CI workflow** — Add `.github/workflows/ci.yml` with cargo test, clippy, and fmt checks triggered on PRs and pushes to main. This is the single highest-impact improvement.
2. **Add unit tests for all 3 built-in detectors** — `email_address_detector`, `ssn_detector`, `credit_card_detector` each need positive/negative/edge case tests. The SSN detector regex is particularly complex and needs thorough validation.
3. **Add integration tests for the HTTP API** — Test the `/api/v1/text/contents` endpoint with valid requests, empty regex lists (400), multiple contents, and mixed built-in/custom regex.

### Priority 1 (High Value)
4. **Configure coverage tracking** — Add `cargo-tarpaulin` with Codecov integration. Set initial threshold at 60% and raise to 80% as tests are added.
5. **Enable Dependabot** — Configure for `cargo`, `docker`, and `github-actions` ecosystems. Takes 30 minutes and provides continuous vulnerability monitoring.
6. **Add HEALTHCHECK to Dockerfile** — Simple `curl -f http://localhost:8080/health || exit 1` instruction.
7. **Create CLAUDE.md** — Document Rust testing patterns, Axum conventions, and the PII detection domain.
8. **Add a Makefile** — Standardize build, test, lint, and format targets for contributor convenience.

### Priority 2 (Nice-to-Have)
9. **Add multi-architecture image builds** — Support amd64 and arm64 via `docker buildx`.
10. **Add container runtime validation** — CI step that builds the image, starts it, hits /health, and validates response.
11. **Add pre-commit hooks** — `cargo clippy` and `cargo fmt` before every commit.
12. **Add property-based testing** — Use `proptest` crate for fuzzing regex detection with random inputs.
13. **Add non-root user to Dockerfile** — Run the release image as a non-root user for security.
14. **Expand .dockerignore** — Exclude `.git/`, `target/`, `README.md`, `LICENSE` from build context.

## Comparison to Gold Standards

| Dimension | guardrails-regex-detector | odh-dashboard | notebooks | Gap |
|-----------|--------------------------|---------------|-----------|-----|
| Unit Tests | 3/10 | 9/10 | 8/10 | -6 (Add tests for all detectors + handler) |
| Integration/E2E | 0/10 | 10/10 | 7/10 | -10 (Create integration test suite) |
| Build Integration | 3/10 | 9/10 | 8/10 | -6 (Add CI pipeline) |
| Image Testing | 4/10 | 7/10 | 10/10 | -6 (Add runtime validation, HEALTHCHECK) |
| Coverage Tracking | 0/10 | 9/10 | 8/10 | -9 (Add tarpaulin + Codecov) |
| CI/CD Automation | 1/10 | 9/10 | 8/10 | -8 (Create GitHub Actions workflows) |
| Static Analysis | 3/10 | 9/10 | 8/10 | -6 (CI enforcement, Dependabot) |
| Agent Rules | 0/10 | 8/10 | 6/10 | -8 (Create CLAUDE.md + rules) |

**Key Takeaways:**
- **Biggest gap**: Integration/E2E (0/10 vs 10/10 in odh-dashboard) and Coverage Tracking (0/10 vs 9/10)
- **Most impactful fix**: Adding a CI workflow would immediately raise CI/CD, Build Integration, and Static Analysis scores
- **Smallest effort, highest impact**: Dependabot (30 min) + CI workflow (2-3 hours) would transform the quality posture
- **Positive**: UBI base image and Dockerfile-embedded checks show quality awareness — it just needs CI to enforce them

## File Paths Reference

### Source Code
- `src/main.rs` — Axum HTTP server setup (46 lines)
- `src/detectors.rs` — PII detection logic with built-in + custom regex (166 lines)

### Build
- `Dockerfile` — Multi-stage build with test/lint/format stages
- `Cargo.toml` — Dependencies and build configuration
- `Cargo.lock` — Locked dependency versions
- `rust-toolchain.toml` — Rust 1.84.0 with clippy and rustfmt

### Missing (Needs Creation)
- `.github/workflows/ci.yml` — CI pipeline
- `.github/dependabot.yml` — Dependency management
- `.codecov.yml` — Coverage configuration
- `.pre-commit-config.yaml` — Pre-commit hooks
- `Makefile` — Build targets
- `CLAUDE.md` — Agent rules
- `tests/` — Integration tests directory
