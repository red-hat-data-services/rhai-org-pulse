---
repository: "trustyai-explainability/fms-guardrails-orchestrator"
overall_score: 5.3
scorecard:
  - dimension: "Unit Tests"
    score: 6.0
    status: "28 unit tests across 14 modules; moderate coverage of core components"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "12 comprehensive integration test files (~20K lines) with mock-based testing via mocktail"
  - dimension: "Build Integration"
    score: 5.0
    status: "Basic cargo build/test in CI; tests run during Docker build; no PR-time image validation"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-arch Dockerfiles (amd64/ppc64le/s390x), UBI9 base, non-root, hardening scripts"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tooling, thresholds, or reporting configured"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "Single workflow with build/lint/test; missing concurrency control, timeouts, and matrix"
  - dimension: "Static Analysis"
    score: 6.0
    status: "Pre-commit hooks (fmt/clippy), RUSTFLAGS=-Dwarnings; no dependency alerts"
  - dimension: "Agent Rules"
    score: 1.0
    status: "No CLAUDE.md, .claude/ directory, or agent rules present"
critical_gaps:
  - title: "No code coverage tracking or enforcement"
    impact: "No visibility into test coverage; regressions in coverage go undetected"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No PR-time container image build validation"
    impact: "Dockerfile build failures discovered only in downstream Konflux builds"
    severity: "HIGH"
    effort: "6-8 hours"
  - title: "Missing CI concurrency control and timeouts"
    impact: "Stale CI runs consume resources; hung jobs block the pipeline indefinitely"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No dependency update automation (Dependabot/Renovate)"
    impact: "Vulnerable dependencies not detected automatically; manual update burden"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents lack context on Rust testing patterns, project conventions, and quality gates"
    severity: "LOW"
    effort: "3-4 hours"
quick_wins:
  - title: "Add concurrency control and timeout to CI workflow"
    effort: "30 minutes"
    impact: "Prevent resource waste from stale/hung CI runs"
  - title: "Enable Dependabot for cargo and GitHub Actions dependencies"
    effort: "1-2 hours"
    impact: "Automated security and dependency update PRs"
  - title: "Add cargo-llvm-cov for coverage tracking"
    effort: "2-4 hours"
    impact: "Visibility into test coverage with PR reporting"
  - title: "Add PR-time Docker build step to CI"
    effort: "2-3 hours"
    impact: "Catch Dockerfile build failures before merge"
  - title: "Create basic CLAUDE.md with Rust testing patterns"
    effort: "2-3 hours"
    impact: "Guide AI agents to generate idiomatic Rust tests"
recommendations:
  priority_0:
    - "Add code coverage tracking with cargo-llvm-cov and Codecov integration"
    - "Add concurrency control and timeout-minutes to CI workflow"
    - "Enable Dependabot for cargo, docker, and github-actions ecosystems"
  priority_1:
    - "Add PR-time Docker image build validation step in CI"
    - "Add matrix strategy to test against multiple Rust versions"
    - "Create agent rules (.claude/rules/) for Rust unit and integration test patterns"
    - "Add E2E tests against real services in staging environment"
  priority_2:
    - "Add performance benchmarks with criterion"
    - "Add release automation workflow"
    - "Consolidate multi-arch Dockerfiles using buildx"
    - "Add OpenAPI spec validation in CI"
---

# Quality Analysis: trustyai-explainability/fms-guardrails-orchestrator

## Executive Summary
- **Overall Score: 5.3/10**
- **Key Strengths**: Comprehensive mock-based integration tests (~20K lines), multi-architecture Docker support with UBI9 base images, pre-commit hooks with clippy/fmt enforcement, tests run during Docker builds
- **Critical Gaps**: Zero coverage tracking, no PR-time image build validation, missing CI hardening (concurrency/timeouts), no dependency update automation
- **Agent Rules Status**: Missing

## Quality Scorecard
| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 6/10 | 15% | 28 unit tests across 14 modules; moderate coverage |
| Integration/E2E | 7/10 | 20% | 12 integration test files (~20K lines) with mocktail |
| Build Integration | 5/10 | 15% | Basic cargo build/test in CI; no PR-time image validation |
| Image Testing | 7/10 | 10% | Multi-arch UBI9 Dockerfiles, non-root, hardening |
| Coverage Tracking | 1/10 | 10% | No coverage tooling configured |
| CI/CD Automation | 5/10 | 15% | Single workflow; no concurrency/timeout/matrix |
| Static Analysis | 6/10 | 10% | Pre-commit hooks, clippy, RUSTFLAGS=-Dwarnings |
| Agent Rules | 1/10 | 5% | No CLAUDE.md or agent rules |

## Critical Gaps

1. **No code coverage tracking or enforcement**
   - Impact: No visibility into which code paths are tested; coverage regressions go completely undetected
   - Severity: HIGH
   - Effort: 4-6 hours

2. **No PR-time container image build validation**
   - Impact: Dockerfile build failures discovered only in downstream Konflux builds, requiring rollbacks
   - Severity: HIGH
   - Effort: 6-8 hours

3. **Missing CI concurrency control and timeouts**
   - Impact: Stale CI runs on force-pushed branches consume resources; hung `cargo test` jobs block the pipeline indefinitely
   - Severity: MEDIUM
   - Effort: 1-2 hours

4. **No dependency update automation**
   - Impact: Vulnerable or outdated Cargo crates and GitHub Actions not detected; relies entirely on manual monitoring
   - Severity: MEDIUM
   - Effort: 1-2 hours

5. **No agent rules for AI-assisted development**
   - Impact: AI code assistants generate tests that don't follow the project's Rust idioms, mocktail patterns, or async test conventions
   - Severity: LOW
   - Effort: 3-4 hours

## Quick Wins

1. **Add concurrency control and timeout to CI workflow**
   - Effort: 30 minutes
   - Impact: Prevent resource waste from stale/hung CI runs
   - Implementation:
   ```yaml
   # .github/workflows/test.yml
   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: true

   jobs:
     ci-checks:
       runs-on: ubuntu-latest
       timeout-minutes: 30
   ```

2. **Enable Dependabot for automated dependency alerts**
   - Effort: 1-2 hours
   - Impact: Automated PRs for Cargo crate updates and GitHub Actions version bumps
   - Implementation:
   ```yaml
   # .github/dependabot.yml
   version: 2
   updates:
     - package-ecosystem: "cargo"
       directory: "/"
       schedule:
         interval: "weekly"
       open-pull-requests-limit: 10
     - package-ecosystem: "docker"
       directory: "/"
       schedule:
         interval: "monthly"
     - package-ecosystem: "github-actions"
       directory: "/"
       schedule:
         interval: "monthly"
   ```

3. **Add cargo-llvm-cov for coverage tracking**
   - Effort: 2-4 hours
   - Impact: Visibility into test coverage percentages with PR-level reporting
   - Implementation:
   ```yaml
   # Add to .github/workflows/test.yml
   - name: Install cargo-llvm-cov
     uses: taiki-e/install-action@cargo-llvm-cov
   - name: Generate code coverage
     run: cargo llvm-cov --all-features --workspace --lcov --output-path lcov.info
   - name: Upload coverage to Codecov
     uses: codecov/codecov-action@v5
     with:
       files: lcov.info
       fail_ci_if_error: false
   ```

4. **Add PR-time Docker build step**
   - Effort: 2-3 hours
   - Impact: Catch Dockerfile build failures before merge
   - Implementation:
   ```yaml
   # Add to .github/workflows/test.yml or new workflow
   docker-build:
     runs-on: ubuntu-latest
     if: github.event.pull_request.draft == false
     steps:
       - uses: actions/checkout@v4
       - name: Build Docker image
         run: docker build -f Dockerfile.amd64 --target fms-guardrails-orchestr8-release .
   ```

5. **Create basic CLAUDE.md with Rust testing patterns**
   - Effort: 2-3 hours
   - Impact: Guide AI agents to generate idiomatic Rust tests matching project conventions

## Detailed Findings

### Unit Tests

**Status: Moderate (6/10)**

The project has 28 unit tests distributed across 14 `#[cfg(test)]` modules within the `src/` directory. Tests cover core components including configuration deserialization, model validation, client health checks, orchestrator utilities, detection batching, server TLS, and OpenAI client serialization.

**Strengths:**
- Unit tests are co-located with source code using Rust's idiomatic `#[cfg(test)]` module pattern
- Good use of `#[tokio::test]` for async test coverage (server, gRPC health checks, detection streams)
- Configuration deserialization tests are thorough (8 test cases covering valid configs, TLS, error cases)
- Tests cover critical paths: config parsing, model validation, client behavior, batcher logic

**Test-to-Code Ratio:**
- Source files: 54
- Files with test modules: 14
- Ratio: 26% of source files have unit tests

**Key Test Files:**
- `src/config.rs` - 8 tests for config deserialization and validation
- `src/models.rs` - 2 tests for model validation and detector params
- `src/clients/openai.rs` - 4 tests for serialization/deserialization
- `src/orchestrator/common/utils.rs` - 5 tests for utility functions
- `src/orchestrator/types/detection_batcher/` - 6 tests for batcher logic
- `src/server.rs` - 2 tests for server binding and TLS

**Gaps:**
- No unit tests for `src/clients/detector.rs`, `src/clients/chunker.rs`, `src/clients/generation.rs`
- No unit tests for `src/orchestrator/handlers/` (handler logic only tested via integration tests)
- No unit tests for `src/health.rs`
- Limited use of property-based testing or fuzzing
- No explicit test isolation validation

**Recommendations:**
- Add unit tests for client modules (detector, chunker, generation)
- Add unit tests for health check endpoint logic
- Consider adding `proptest` or `quickcheck` for property-based testing of serialization/deserialization
- Add tests for error paths in handler modules

### Integration/E2E Tests

**Status: Strong (7/10)**

The `tests/` directory contains 12 comprehensive integration test files totaling approximately 19,867 lines. These tests use the `mocktail` crate (from IBM) to mock HTTP and gRPC services, creating realistic test scenarios for all orchestrator endpoints.

**Strengths:**
- Extensive endpoint coverage across all orchestrator APIs:
  - Chat completions (streaming: 5,653 lines, unary: 1,655 lines)
  - Completions (streaming: 4,701 lines, unary: 1,406 lines)
  - Classification with text generation (1,466 lines + streaming: 1,833 lines)
  - Content detection (text: 535 lines, streaming: 832 lines)
  - Chat detection (460 lines)
  - Context docs detection (448 lines)
  - Detection on generation (390 lines)
  - Generation with detection (488 lines)
- Shared test infrastructure in `tests/common/` with modules for:
  - Chunker mocks (`chunker.rs`)
  - Detector mocks (`detectors.rs`)
  - Error handling (`errors.rs`)
  - Generation mocks (`generation.rs`)
  - OpenAI API mocks (`openai.rs`)
  - Orchestrator server setup (`orchestrator.rs`)
- Tests use `TestOrchestratorServer` to spin up a real orchestrator server in tests
- Dedicated test config (`tests/test_config.yaml`) with multiple detector types

**Gaps:**
- All integration tests are mock-based (no real service E2E tests)
- No tests against actual detector/chunker/generation services
- No multi-version or compatibility testing
- No performance/load testing
- No chaos/resilience testing (e.g., service timeouts, partial failures)

**Recommendations:**
- Add E2E tests against real services in a staging or CI environment
- Add tests for service degradation scenarios (timeouts, partial responses)
- Add performance benchmarks for critical request paths
- Consider contract testing (Pact) for API boundaries with detectors/chunkers

### Build Integration

**Status: Adequate (5/10)**

**Strengths:**
- CI workflow runs `cargo build` on every PR
- Dockerfile build process includes `cargo test` — tests run during image build, ensuring the release binary passes all tests
- Tests are compiled and run in the same environment as the production build
- Three architecture-specific Dockerfiles provide multi-platform coverage

**Gaps:**
- No PR-time Docker image build in CI workflow — Dockerfile issues only caught during downstream Konflux builds
- No Kubernetes manifest validation (no kustomize overlays present)
- No container image startup validation in CI
- No Konflux build simulation
- Build only targets a single OS/arch in CI (ubuntu-latest)

**Current CI Pipeline:**
```
PR → Build → Format Check → Clippy Lint → Tests
```

**Missing Steps:**
```
PR → Build → Lint → Tests → Coverage → Docker Build → Image Startup Check
```

**Recommendations:**

1. **Add PR-time Docker build:**
   ```yaml
   - name: Build Docker image
     run: docker build -f Dockerfile.amd64 --target fms-guardrails-orchestr8-release .
   ```

2. **Add image startup validation:**
   ```yaml
   - name: Test image startup
     run: |
       docker build -f Dockerfile.amd64 -t orchestr8:test .
       docker run --rm -d --name orchestr8-test orchestr8:test
       sleep 5
       docker logs orchestr8-test
       docker stop orchestr8-test
   ```

3. **Consider Konflux build simulation** to catch downstream build failures early

### Image Testing

**Status: Good (7/10)**

**Strengths:**
- **Multi-architecture support**: Three separate Dockerfiles for amd64, ppc64le, and s390x
- **UBI9 base images**: `registry.access.redhat.com/ubi9/ubi-minimal` — FIPS-capable and enterprise-grade
- **Multi-stage builds**: Separate builder and release stages minimize image size
- **Non-root execution**: Dedicated `orchestr8` user (UID 1001, GID 0) for runtime
- **Image hardening**: Custom remediation scripts run during build:
  - `scripts/installRemediationTools.sh`
  - `scripts/remediation-script.sh`
  - `scripts/removeRemediationTools.sh`
- **Tests in Docker build**: `cargo test` runs during the image build, validating the release binary
- **Minimal runtime**: Only the compiled binary and config are copied to the release image
- **.dockerignore**: Properly configured to exclude `.DS_Store`, `.vscode`, `target/`, hermeto files

**Gaps:**
- No runtime validation tests (health checks, endpoint availability) in CI
- `HEALTHCHECK NONE` explicitly set — no Docker-level health monitoring
- No Testcontainers-based integration tests
- Multi-arch uses separate Dockerfiles rather than unified `docker buildx` with `--platform`
- No image scanning integration mentioned in CI

**Recommendations:**

1. **Consider consolidating Dockerfiles** with `docker buildx` and `--platform` flag for cleaner multi-arch builds

2. **Add container health check** (even if K8s probes are used, Docker HEALTHCHECK aids development):
   ```dockerfile
   HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
     CMD curl -f http://localhost:8033/health || exit 1
   ```

3. **Add runtime validation in CI** to verify the built image starts successfully and responds to health checks

### Coverage Tracking

**Status: Critical Gap (1/10)**

**Current State:**
- No `.codecov.yml` or `codecov.yml` configuration
- No coverage tool configured (no `cargo-tarpaulin`, `cargo-llvm-cov`, or `grcov`)
- No coverage collection in CI workflows
- No coverage thresholds or enforcement
- No coverage reporting in PRs
- No coverage badges

**Impact:**
- Zero visibility into which code paths are tested
- Coverage regressions go completely undetected
- New code may be merged with no test coverage
- Cannot benchmark quality improvements over time

**Recommendations:**

1. **Add `cargo-llvm-cov` to CI (recommended over tarpaulin for Rust 2024 edition):**
   ```yaml
   - name: Install cargo-llvm-cov
     uses: taiki-e/install-action@cargo-llvm-cov
   - name: Generate code coverage
     run: cargo llvm-cov --all-features --workspace --lcov --output-path lcov.info
   - name: Upload coverage to Codecov
     uses: codecov/codecov-action@v5
     with:
       files: lcov.info
       fail_ci_if_error: false
   ```

2. **Configure Codecov thresholds:**
   ```yaml
   # .codecov.yml
   coverage:
     status:
       project:
         default:
           target: 60%
           threshold: 2%
       patch:
         default:
           target: 70%
   ```

3. **Add coverage badge to README**

### CI/CD Automation

**Status: Basic (5/10)**

**Current Workflow (`test.yml`):**
- **Triggers**: Push to `main`, PRs (opened, reopened, synchronize, ready_for_review)
- **Draft PR skip**: `if: github.event.pull_request.draft == false`
- **Steps**: Install nightly fmt → Install protoc → Checkout → Cache → Build → Format → Clippy → Tests
- **Caching**: Cargo registry, git, and target directory cached via `actions/cache@v4`
- **Warnings as errors**: `RUSTFLAGS="-Dwarnings"` ensures no warnings in CI

**Strengths:**
- Draft PR filtering avoids wasting CI resources
- Dependency caching reduces build times
- Warnings treated as errors enforces code quality
- Protoc installation automated for gRPC code generation
- Nightly rustfmt for latest formatting capabilities

**Gaps:**
- **No concurrency control**: Multiple CI runs for the same PR can overlap
- **No timeout-minutes**: Hung builds (especially `cargo test` with mock servers) run indefinitely
- **No matrix strategy**: Only tests on single Rust version (pinned 1.92.0) and single OS
- **No release/deployment workflow**: No automated releases or image publishing
- **No scheduled/periodic jobs**: No nightly builds or dependency audits
- **Single workflow**: All steps in one job — no parallelism between lint and test

**Recommendations:**

1. **Add concurrency control:**
   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: true
   ```

2. **Add timeout:**
   ```yaml
   jobs:
     ci-checks:
       timeout-minutes: 30
   ```

3. **Split into parallel jobs** (lint and test can run independently):
   ```yaml
   jobs:
     lint:
       runs-on: ubuntu-latest
       steps:
         - name: Format check
           run: cargo +nightly fmt --check --all
         - name: Clippy
           run: cargo clippy --no-deps --all-targets --all-features
     test:
       runs-on: ubuntu-latest
       steps:
         - name: Run tests
           run: cargo test
   ```

4. **Add `cargo audit` for vulnerability scanning:**
   ```yaml
   - name: Install cargo-audit
     run: cargo install cargo-audit
   - name: Security audit
     run: cargo audit
   ```

### Static Analysis

#### Linting

**Status: Good**

**Strengths:**
- **Pre-commit hooks** (`.pre-commit-config.yaml`):
  - `cargo +nightly fmt` — uses nightly rustfmt for latest features
  - `cargo check` — compilation verification
  - `cargo clippy -- -D warnings` — all clippy warnings are errors
- **rustfmt.toml** configured with:
  - `group_imports = "StdExternalCrate"` — organized imports
  - `imports_granularity = "Crate"` — clean import style
- **rust-toolchain.toml** pins Rust 1.92.0 with `clippy` and `rustfmt` components
- **CI enforcement**: `RUSTFLAGS="-Dwarnings"` makes all compiler warnings CI failures

**Gaps:**
- No additional clippy lint groups enabled beyond defaults (e.g., `clippy::pedantic`, `clippy::nursery`)
- No `clippy.toml` for customizing lint behavior

#### FIPS Compatibility

**Status: Reasonable Foundation**

**Positive indicators:**
- **UBI9 base images**: `registry.access.redhat.com/ubi9/ubi-minimal` is FIPS-capable
- **rustls with ring**: Uses `rustls` with the `ring` cryptographic backend instead of OpenSSL — ring is designed to work in FIPS-capable environments
- **No non-FIPS crypto imports**: No `md5`, `des`, `rc4` usage in source code
- **`rand` only in dev-dependencies**: The `rand` crate is only used in tests, not production code

**Gaps:**
- No explicit FIPS build tags or configuration
- No FIPS validation in CI
- `ring` provides FIPS-capable algorithms but is not itself FIPS-certified

#### Dependency Alerts

**Status: Not Configured**

- No `.github/dependabot.yml`
- No `renovate.json` or `.renovaterc`
- Relies on manual dependency updates
- One git dependency (`ginepro`) pinned by rev — higher maintenance burden

### Agent Rules

**Status: Missing (1/10)**

**Current State:**
- No `CLAUDE.md` or `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` for test creation guidance
- No `.claude/skills/` for custom skills

**Existing Documentation:**
- `CONTRIBUTING.md` provides general contribution guidelines but no test-specific patterns
- `CODEOWNERS` identifies 4 maintainers
- `docs/architecture/adrs/` contains 11 architecture decision records — excellent project documentation

**Impact:**
AI agents generating code for this project will lack context on:
- Rust async test patterns (`#[tokio::test]`)
- `mocktail` mock server setup patterns
- `TestOrchestratorServer` integration test infrastructure
- Project-specific detector/chunker mock patterns
- `#[cfg(test)]` module organization conventions

**Recommendations:**

1. **Create CLAUDE.md:**
   ```markdown
   # FMS Guardrails Orchestrator

   ## Project Overview
   Rust-based orchestration server for LLM guardrails detection.
   Uses Axum, Tokio, Tonic (gRPC), and Hyper.

   ## Testing
   - Unit tests: `#[cfg(test)]` modules in src/ files
   - Integration tests: `tests/` directory using `mocktail` for mocking
   - Run: `cargo test`
   - Async tests: use `#[tokio::test]`

   ## Build
   - `cargo build` (requires protoc for gRPC code generation)
   - `cargo +nightly fmt --check --all` for formatting
   - `cargo clippy --no-deps --all-targets --all-features` for linting

   ## Architecture
   See `docs/architecture/adrs/` for design decisions.
   ```

2. **Create `.claude/rules/unit-tests.md`** with Rust-specific patterns:
   - `#[cfg(test)]` module placement
   - `#[tokio::test]` for async tests
   - Assertion patterns with standard library `assert!`/`assert_eq!`
   - Error handling test patterns

3. **Create `.claude/rules/integration-tests.md`** with mocktail patterns:
   - `TestOrchestratorServer` setup
   - Mock detector/chunker/generation service configuration
   - Request/response assertion patterns

4. **Quick win**: Generate rules automatically with `/test-rules-generator`

## Recommendations

### Priority 0 (Critical)
- Add code coverage tracking with `cargo-llvm-cov` and Codecov integration
- Add concurrency control (`cancel-in-progress`) and `timeout-minutes: 30` to CI workflow
- Enable Dependabot for `cargo`, `docker`, and `github-actions` ecosystems

### Priority 1 (High Value)
- Add PR-time Docker image build validation step in CI
- Add matrix strategy to test against multiple Rust versions (stable + pinned)
- Create agent rules (`.claude/rules/`) for Rust unit and integration test patterns
- Add `cargo audit` to CI for dependency vulnerability scanning
- Split CI into parallel lint and test jobs for faster feedback

### Priority 2 (Nice-to-Have)
- Add performance benchmarks with `criterion` crate
- Add release automation workflow (cargo-release + image publishing)
- Consolidate multi-arch Dockerfiles using `docker buildx` with `--platform`
- Add OpenAPI spec validation in CI (validate `docs/api/` specs)
- Add E2E tests against real detector/chunker services
- Consider property-based testing with `proptest` for serialization logic

## Comparison to Gold Standards

| Dimension | fms-guardrails-orchestrator | odh-dashboard | notebooks | Gap |
|-----------|---------------------------|---------------|-----------|-----|
| Unit Tests | 6/10 | 9/10 | 8/10 | -3 (Add tests for untested modules) |
| Integration/E2E | 7/10 | 10/10 | 7/10 | -3 (Add real E2E, contract tests) |
| Build Integration | 5/10 | 9/10 | 8/10 | -4 (Add PR-time image validation) |
| Image Testing | 7/10 | 7/10 | 10/10 | 0 (Multi-arch + UBI + hardening) |
| Coverage Tracking | 1/10 | 9/10 | 8/10 | -8 (Add coverage tooling entirely) |
| CI/CD Automation | 5/10 | 9/10 | 8/10 | -4 (Add concurrency, matrix, timeouts) |
| Static Analysis | 6/10 | 9/10 | 8/10 | -3 (Add Dependabot, cargo audit) |
| Agent Rules | 1/10 | 8/10 | 6/10 | -7 (Create CLAUDE.md + rules) |

**Key Takeaways:**
- **Biggest gap**: Coverage Tracking (1/10 vs 9/10 in odh-dashboard) — no coverage tooling at all
- **Second gap**: Agent Rules (1/10 vs 8/10 in odh-dashboard) — no AI agent guidance
- **Third gap**: Build Integration (5/10 vs 9/10) and CI/CD Automation (5/10 vs 9/10)
- **Strength**: Image Testing (7/10) matches odh-dashboard with multi-arch UBI9 builds and hardening

## File Paths Reference

### CI/CD
- `.github/workflows/test.yml` — Single CI workflow (build, lint, test)

### Testing
- `tests/*.rs` — 12 integration test files (~20K lines total)
- `tests/common/` — Shared test infrastructure (mock servers, utilities)
- `tests/test_config.yaml` — Test configuration for integration tests
- `tests/resources/` — TLS certificates for test server
- `src/config.rs:461-808` — Unit tests for config parsing
- `src/models.rs:1222-1420` — Unit tests for model validation
- `src/clients/openai.rs:1187-1400` — Unit tests for OpenAI client
- `src/orchestrator/common/utils.rs:77-400` — Unit tests for orchestrator utils
- `src/orchestrator/types/detection_batcher/` — Unit tests for batcher logic

### Coverage
- No coverage configuration files exist

### Container Images
- `Dockerfile.amd64` — AMD64 architecture build
- `Dockerfile.ppc64le` — PPC64LE architecture build
- `Dockerfile.s390x` — S390X architecture build
- `.dockerignore` — Build context exclusions
- `scripts/remediation-script.sh` — Image hardening

### Static Analysis
- `.pre-commit-config.yaml` — Pre-commit hooks (fmt, check, clippy)
- `rustfmt.toml` — Rust formatter configuration
- `rust-toolchain.toml` — Pinned Rust version (1.92.0)
- `.github/dependabot.yml` — Missing (needs creation)

### Configuration
- `config/config.yaml` — Production config template
- `config/test.config.yaml` — Test config
- `Cargo.toml` — Rust project configuration and dependencies

### Documentation
- `docs/architecture/adrs/` — 11 architecture decision records
- `docs/api/` — OpenAPI specifications (orchestrator, detector, tokenization)
- `CONTRIBUTING.md` — Contribution guidelines
- `CODEOWNERS` — Code ownership (4 maintainers)

### Agent Rules
- `CLAUDE.md` — Missing (needs creation)
- `.claude/rules/` — Missing (needs creation)
