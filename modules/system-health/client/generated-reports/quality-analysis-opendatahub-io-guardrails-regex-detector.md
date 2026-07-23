---
repository: "opendatahub-io/guardrails-regex-detector"
overall_score: 2.3
scorecard:
  - dimension: "Unit Tests"
    score: 2.0
    status: "Single unit test for regex matching; no tests for email, SSN, credit card detectors or HTTP handler"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests; no HTTP endpoint testing"
  - dimension: "Build Integration"
    score: 3.0
    status: "Dockerfile multi-stage build includes test/lint/format stages, but no CI/CD workflows trigger them on PRs"
  - dimension: "Image Testing"
    score: 3.0
    status: "Multi-stage Dockerfile with UBI base image, but no runtime validation or health check testing"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling configured; no codecov, tarpaulin, or coverage thresholds"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "No .github/workflows/ directory; no CI/CD automation of any kind"
  - dimension: "Static Analysis"
    score: 3.0
    status: "Clippy and rustfmt configured in Dockerfile and rust-toolchain.toml, but no CI enforcement, no Dependabot, no pre-commit hooks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No CI/CD automation"
    impact: "No automated testing, linting, or build validation runs on pull requests — regressions and broken builds are only caught manually or if a developer remembers to run Dockerfile stages locally"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "Minimal unit test coverage"
    impact: "Only 1 test exists for generic regex matching; built-in detectors (email, SSN, credit card) and the HTTP handler are completely untested, risking silent regressions in PII detection"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No integration/E2E tests"
    impact: "HTTP API behavior including request validation, response format, error handling, and routing is never tested end-to-end"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No coverage tracking"
    impact: "No visibility into what percentage of code is tested; no enforcement of coverage minimums on PRs"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No dependency management automation"
    impact: "No Dependabot or Renovate to alert on vulnerable or outdated Rust crate dependencies"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add GitHub Actions CI workflow with cargo test, clippy, and fmt"
    effort: "2-4 hours"
    impact: "Enforces quality gates on every PR — catches test failures, lint violations, and formatting issues automatically"
  - title: "Add unit tests for built-in detectors (email, SSN, credit card)"
    effort: "2-3 hours"
    impact: "Directly validates the core PII detection logic that the service exists to provide"
  - title: "Enable Dependabot for Cargo dependencies"
    effort: "30 minutes"
    impact: "Automated alerts and PRs for vulnerable or outdated Rust crate dependencies"
  - title: "Add cargo-tarpaulin for coverage reporting"
    effort: "1-2 hours"
    impact: "Visibility into test coverage percentage with CI integration"
recommendations:
  priority_0:
    - "Create a GitHub Actions CI workflow that runs cargo test, cargo clippy, and cargo fmt --check on every PR"
    - "Add unit tests for all built-in regex detectors (email_address_detector, ssn_detector, credit_card_detector) with positive and negative cases"
    - "Add integration tests for the HTTP API using axum::test or reqwest against the running server"
  priority_1:
    - "Configure Dependabot for the cargo ecosystem to get automated dependency update PRs"
    - "Add cargo-tarpaulin coverage reporting to CI with a minimum coverage threshold"
    - "Add HTTP endpoint integration tests covering request validation, error responses, and edge cases"
    - "Add a HEALTHCHECK instruction to the Dockerfile for container orchestration"
  priority_2:
    - "Create CLAUDE.md with test creation rules and project conventions"
    - "Add pre-commit hooks for cargo fmt and cargo clippy"
    - "Add multi-architecture build support (amd64/arm64)"
    - "Add container runtime validation tests (image startup, health endpoint check)"
---

# Quality Analysis: guardrails-regex-detector

## Executive Summary

- **Overall Score: 2.3/10**
- **Repository**: [opendatahub-io/guardrails-regex-detector](https://github.com/opendatahub-io/guardrails-regex-detector)
- **Type**: Rust HTTP microservice (Axum framework)
- **Purpose**: Lightweight regex-based PII detection service for the FMS Guardrails Orchestrator
- **Jira**: RHOAIENG / AI Safety (midstream tier)
- **Size**: ~212 lines of Rust across 2 source files
- **Key Strengths**: Clean Dockerfile with multi-stage build using UBI base image; well-organized code with modular detection
- **Critical Gaps**: No CI/CD workflows, minimal test coverage (1 test), no coverage tracking, no dependency management automation
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 2.0/10 | Single test for regex matching; core detectors untested |
| Integration/E2E | 20% | 0.0/10 | No integration or E2E tests exist |
| Build Integration | 15% | 3.0/10 | Dockerfile has test/lint stages but no CI triggers them |
| Image Testing | 10% | 3.0/10 | Multi-stage build with UBI base, no runtime validation |
| Coverage Tracking | 10% | 0.0/10 | No coverage tooling or thresholds |
| CI/CD Automation | 15% | 0.0/10 | No .github/workflows/ directory at all |
| Static Analysis | 10% | 3.0/10 | Clippy/rustfmt in Dockerfile only, no Dependabot |
| Agent Rules | 5% | 0.0/10 | No CLAUDE.md or .claude/ directory |

**Weighted Overall: 2.3/10** = (2.0×0.15) + (0.0×0.20) + (3.0×0.15) + (3.0×0.10) + (0.0×0.10) + (0.0×0.15) + (3.0×0.10) + (0.0×0.05)

## Critical Gaps

### 1. No CI/CD Automation
- **Severity**: HIGH
- **Impact**: No automated testing, linting, or build validation runs on pull requests. Regressions and broken builds are only caught manually or if a developer remembers to run Dockerfile multi-stage targets locally.
- **Effort**: 4-8 hours
- **Details**: The repository has no `.github/workflows/` directory. There is no CI/CD pipeline of any kind — no GitHub Actions, no GitLab CI, no Jenkinsfile. The Dockerfile contains `cargo test`, `cargo clippy`, and `cargo fmt --check` stages, but these only run during `docker build` if the specific build targets are invoked.

### 2. Minimal Unit Test Coverage
- **Severity**: HIGH
- **Impact**: Only 1 test exists (`test_regex_match`) that validates the generic `regex_match()` function. The three built-in PII detectors (`email_address_detector`, `ssn_detector`, `credit_card_detector`) and the HTTP handler (`handle_text_contents`) are completely untested. This risks silent regressions in the core PII detection functionality that this service exists to provide.
- **Effort**: 4-6 hours
- **Details**: The single test in `src/detectors.rs:144-165` only covers the `regex_match` helper with a simple numeric pattern. No tests exist for:
  - Email regex pattern matching (positive/negative cases)
  - SSN pattern matching (various formats: XXX-XX-XXXX, XXXXXXXXX, etc.)
  - Credit card pattern matching (Visa, MasterCard, Amex, etc.)
  - Edge cases (empty input, invalid regex, overlapping patterns)
  - Built-in regex lookup via the HashMap dispatch

### 3. No Integration/E2E Tests
- **Severity**: HIGH
- **Impact**: The HTTP API behavior — request validation, response format, error handling, routing, and the interaction between `main.rs` router and `detectors.rs` handlers — is never tested end-to-end.
- **Effort**: 4-8 hours
- **Details**: With `axum`'s built-in test utilities or `tower::ServiceExt`, the team could test the full HTTP request/response cycle without starting a server. No such tests exist.

### 4. No Coverage Tracking
- **Severity**: MEDIUM
- **Impact**: No visibility into what percentage of code is tested. No enforcement of coverage minimums.
- **Effort**: 2-4 hours
- **Details**: No `cargo-tarpaulin`, `grcov`, or `llvm-cov` configuration. No `.codecov.yml` or coverage threshold enforcement.

### 5. No Dependency Management Automation
- **Severity**: MEDIUM
- **Impact**: No automated alerts for vulnerable or outdated crate dependencies. The project depends on 8 crates including security-sensitive ones (regex, serde, tokio).
- **Effort**: 1-2 hours
- **Details**: No `.github/dependabot.yml` or Renovate configuration exists.

## Quick Wins

### 1. Add GitHub Actions CI Workflow (2-4 hours)
Create `.github/workflows/ci.yml` to run on PRs:
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

### 2. Add Unit Tests for Built-in Detectors (2-3 hours)
Add test cases for `email_address_detector`, `ssn_detector`, and `credit_card_detector`:
```rust
#[test]
fn test_email_detection() {
    let content = "contact us at test@example.com for info".to_string();
    let results = email_address_detector(&content).unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].text, "test@example.com");
    assert_eq!(results[0].detection, "EmailAddress");
}

#[test]
fn test_ssn_detection() {
    let content = "my ssn is 123-45-6789".to_string();
    let results = ssn_detector(&content).unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].text, "123-45-6789");
}

#[test]
fn test_credit_card_detection() {
    let content = "card number 4111111111111111".to_string();
    let results = credit_card_detector(&content).unwrap();
    assert_eq!(results.len(), 1);
}

#[test]
fn test_no_false_positives() {
    let content = "this is just plain text".to_string();
    assert!(email_address_detector(&content).unwrap().is_empty());
    assert!(ssn_detector(&content).unwrap().is_empty());
    assert!(credit_card_detector(&content).unwrap().is_empty());
}
```

### 3. Enable Dependabot (30 minutes)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "cargo"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

### 4. Add Coverage with cargo-tarpaulin (1-2 hours)
Add a coverage step to CI:
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

### Unit Tests

**Score: 2.0/10**

- **Test files**: Tests are inline in `src/detectors.rs` using `#[cfg(test)]` module
- **Test count**: 1 test function (`test_regex_match`)
- **Framework**: Standard Rust `#[test]` attribute with `assert_eq!`
- **Test-to-code ratio**: 22 lines of test code / 212 total lines = ~10% (but only covers 1 of 5 functions)
- **Coverage estimate**: The single test covers `regex_match()` only. The three built-in detector functions (`email_address_detector`, `ssn_detector`, `credit_card_detector`) and the main handler (`handle_text_contents`) are untested.
- **Test isolation**: Adequate — test is pure function call with no side effects
- **No dev-dependencies**: `Cargo.toml` has no `[dev-dependencies]` section, meaning no test-specific tooling (mockall, proptest, criterion, etc.)

### Integration/E2E Tests

**Score: 0.0/10**

- No `tests/` directory
- No integration test files
- No E2E test infrastructure
- No `axum::test` or `tower::ServiceExt` usage for HTTP handler testing
- No `testcontainers` usage
- No docker-compose test configuration

### Build Integration

**Score: 3.0/10**

The Dockerfile (`Dockerfile`) demonstrates good multi-stage build practices:
- **Base builder stage**: `rust:1.84.0` with rustfmt component
- **Build stage**: `regex-detector-builder` compiles the binary
- **Test stage**: `tests` runs `cargo test` (but only as a Dockerfile target, not in CI)
- **Lint stage**: `lint` runs `cargo clippy --all-targets --all-features -- -D warnings`
- **Format stage**: `format` runs `cargo fmt --check`
- **Release stage**: `regex-detector-release` uses UBI9 minimal base image

However, these stages are only run during `docker build` when explicitly targeted. Without a CI pipeline, they are never automatically triggered on PRs. A developer must manually run `docker build --target tests .` to execute tests.

No Makefile exists to provide convenient build/test targets.

### Image Testing

**Score: 3.0/10**

- **Dockerfile present**: Yes, well-structured multi-stage build
- **Base image**: UBI9 minimal (`registry.access.redhat.com/ubi9/ubi-minimal`) — FIPS-capable base, good for Red Hat compliance
- **Multi-stage build**: Yes, 5 stages (builder, test, lint, format, release)
- **Runtime validation**: None — no container startup test, no health check verification
- **HEALTHCHECK instruction**: Missing from Dockerfile (though the app has a `/health` endpoint)
- **Multi-architecture**: Not configured — no `--platform` flags or `docker buildx` usage
- **`.dockerignore`**: Not present — could result in unnecessarily large build context

### Coverage Tracking

**Score: 0.0/10**

- No `.codecov.yml` or `codecov.yml`
- No `cargo-tarpaulin` or `grcov` configuration
- No `--coverprofile` equivalent in CI
- No coverage thresholds or enforcement
- No PR coverage reporting

### CI/CD Automation

**Score: 0.0/10**

- **No `.github/workflows/` directory** — the repository has zero CI/CD automation
- No GitHub Actions, GitLab CI, Jenkinsfile, or any other CI configuration
- No PR-triggered workflows
- No periodic/scheduled jobs
- No concurrency control
- No caching configuration
- No test parallelization
- The Dockerfile contains test/lint/format stages that could form the basis of a CI pipeline, but no pipeline exists to invoke them

### Static Analysis

**Score: 3.0/10**

#### Linting
- **Clippy**: Configured in `rust-toolchain.toml` as a component and run in the Dockerfile `lint` stage with strict flags (`-D warnings`)
- **Rustfmt**: Configured in `rust-toolchain.toml` and checked in the Dockerfile `format` stage
- **Enforcement**: Only during manual `docker build` — no CI pipeline triggers these checks on PRs

#### FIPS Compatibility
- **Base image**: UBI9 minimal — FIPS-capable, appropriate for Red Hat environments
- **Crypto usage**: No direct cryptographic imports found in source code. The `regex` crate is the primary dependency and doesn't involve crypto operations
- **Build tags**: Not applicable (Rust project, not Go)
- **Assessment**: Low FIPS risk — the service performs regex matching, not cryptographic operations. The `compat-openssl11` package is installed in the release image for runtime compatibility

#### Dependency Alerts
- **Dependabot**: Not configured (no `.github/dependabot.yml`)
- **Renovate**: Not configured
- **Impact**: 8 direct dependencies in `Cargo.toml` including `tokio`, `axum`, `serde`, and `regex` receive no automated vulnerability or update alerts

#### Pre-commit Hooks
- **Not configured** — no `.pre-commit-config.yaml`

### Agent Rules

**Score: 0.0/10**

- No `CLAUDE.md` in repository root
- No `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` directory
- No test creation rules
- No AI agent guidance for test patterns, code conventions, or contribution guidelines

## Recommendations

### Priority 0 (Critical)

1. **Create a GitHub Actions CI workflow** — This is the single most impactful improvement. Without CI, there is no automated quality enforcement. The workflow should run `cargo fmt --check`, `cargo clippy`, and `cargo test` on every PR. Estimated effort: 2-4 hours.

2. **Add unit tests for all built-in regex detectors** — The three PII detection functions (email, SSN, credit card) are the core purpose of this service and have zero test coverage. Each needs positive match tests, negative tests, and edge case coverage. Estimated effort: 2-3 hours.

3. **Add integration tests for the HTTP API** — Test the full request/response cycle using `axum::test` utilities. Cover the `/api/v1/text/contents` endpoint with valid payloads, empty regex lists (400 error), custom regex patterns, and multiple content items. Estimated effort: 4-6 hours.

### Priority 1 (High Value)

4. **Configure Dependabot** for the `cargo` ecosystem to receive automated PRs for dependency updates and vulnerability alerts. Effort: 30 minutes.

5. **Add coverage tracking with cargo-tarpaulin** and integrate with Codecov. Set a minimum coverage threshold (suggest starting at 60% and ramping to 80%). Effort: 1-2 hours.

6. **Add a Makefile** with standard targets (`build`, `test`, `lint`, `fmt`, `docker-build`) to standardize the developer experience and simplify CI configuration. Effort: 1-2 hours.

7. **Add HEALTHCHECK to Dockerfile** — The application already exposes `/health`; the Dockerfile should declare `HEALTHCHECK CMD curl -f http://localhost:8080/health || exit 1` or use a lightweight checker. Effort: 30 minutes.

### Priority 2 (Nice-to-Have)

8. **Create CLAUDE.md** with project conventions, test patterns, and contribution guidelines to enable AI-assisted development. Effort: 1-2 hours.

9. **Add `.dockerignore`** to exclude `.git/`, `target/`, and other unnecessary files from the build context. Effort: 15 minutes.

10. **Add pre-commit hooks** for `cargo fmt` and `cargo clippy` to catch issues before commit. Effort: 1 hour.

11. **Add multi-architecture build support** for amd64 and arm64 using `docker buildx`. Effort: 2-3 hours.

12. **Add container runtime validation** — test that the built image starts, responds on the health endpoint, and processes a sample detection request. Effort: 2-4 hours.

## Comparison to Gold Standards

| Capability | guardrails-regex-detector | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|---|---|---|---|---|
| CI/CD Workflows | None | Comprehensive (PR + periodic) | Multi-layer CI | Extensive CI |
| Unit Tests | 1 test | Thousands (Jest + Cypress) | Hundreds | Comprehensive Go tests |
| Integration/E2E | None | Cypress E2E + contract tests | Image validation suite | E2E with envtest |
| Coverage Tracking | None | Codecov with thresholds | Coverage reporting | Codecov enforcement |
| Build Integration | Dockerfile stages only | PR build validation | 5-layer image validation | PR-time builds |
| Static Analysis | Clippy in Dockerfile | ESLint + Prettier + Stylelint | Linting configured | golangci-lint |
| Dependency Alerts | None | Dependabot configured | Dependabot configured | Dependabot configured |
| Agent Rules | None | Comprehensive CLAUDE.md | Rules present | Rules present |
| FIPS Compliance | UBI base image (good) | N/A | FIPS-aware builds | FIPS-aware |

## File Paths Reference

| File | Purpose |
|---|---|
| `Cargo.toml` | Rust package configuration, 8 dependencies |
| `Cargo.lock` | Locked dependency versions |
| `src/main.rs` | HTTP server setup (46 lines) — Axum router with `/health` and `/api/v1/text/contents` |
| `src/detectors.rs` | Detection logic (166 lines) — built-in regex detectors + custom regex support + 1 unit test |
| `Dockerfile` | Multi-stage build (45 lines) — builder, test, lint, format, release stages |
| `rust-toolchain.toml` | Rust 1.84.0 with clippy + rustfmt components |
| `README.md` | Basic usage documentation with sample request/response |
| `.gitignore` | Excludes `/target` directory |
