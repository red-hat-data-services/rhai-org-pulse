---
repository: "red-hat-data-services/fms-guardrails-orchestrator"
overall_score: 5.8
scorecard:
  - dimension: "Unit Tests"
    score: 5.5
    status: "28 inline unit tests across 12 source files; moderate coverage of config, models, and orchestrator logic"
  - dimension: "Integration/E2E"
    score: 7.5
    status: "86 integration tests with mock servers covering all API endpoints and error scenarios"
  - dimension: "Build Integration"
    score: 4.0
    status: "No PR-time Konflux simulation; tests run in Docker build only in Konflux Dockerfile"
  - dimension: "Image Testing"
    score: 5.0
    status: "Multi-arch Dockerfiles (amd64, ppc64le, s390x, Konflux) but no runtime validation or startup testing"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tool integration; no codecov, tarpaulin, or llvm-cov configuration"
  - dimension: "CI/CD Automation"
    score: 5.5
    status: "Single workflow with build, fmt, clippy, and test; no E2E, security scanning, or periodic jobs"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory; zero AI agent guidance"
critical_gaps:
  - title: "No test coverage tracking or enforcement"
    impact: "Impossible to identify untested code paths; regressions can be introduced silently"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No security scanning in CI"
    impact: "Vulnerabilities in dependencies and container images go undetected until downstream scanning"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No PR-time Konflux build simulation"
    impact: "Konflux build failures (e.g., OpenSSL version pinning, multi-arch issues) discovered only post-merge"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No container image runtime validation"
    impact: "Image startup failures, missing libraries, or misconfigured entrypoints not caught until deployment"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Unit test coverage is sparse relative to codebase size"
    impact: "Only 28 inline unit tests for 15,586 lines of source code; many modules have zero unit tests"
    severity: "MEDIUM"
    effort: "16-24 hours"
  - title: "No agent rules or AI-assisted development guidance"
    impact: "AI agents cannot reliably generate tests or follow project conventions"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add cargo-tarpaulin or llvm-cov to CI workflow"
    effort: "2-3 hours"
    impact: "Visibility into code coverage with every PR; foundation for enforcement"
  - title: "Add Trivy container scanning step to CI"
    effort: "1-2 hours"
    impact: "Early detection of CVEs in base images and dependencies"
  - title: "Add cargo-deny for dependency auditing"
    effort: "1-2 hours"
    impact: "Catches known vulnerabilities, license issues, and duplicate dependencies"
  - title: "Add CLAUDE.md with test patterns and conventions"
    effort: "2-3 hours"
    impact: "Enable AI agents to generate consistent, project-appropriate tests"
  - title: "Add cargo audit to CI pipeline"
    effort: "30 minutes"
    impact: "Automated Rust advisory database checks on every PR"
recommendations:
  priority_0:
    - "Integrate cargo-tarpaulin or llvm-cov for test coverage reporting with PR-level feedback"
    - "Add container vulnerability scanning (Trivy) to CI pipeline"
    - "Add cargo-deny and cargo-audit for dependency security auditing"
  priority_1:
    - "Create Konflux build simulation in PR workflow to catch multi-arch and OpenSSL pinning issues"
    - "Add container runtime validation tests (image startup, health check, config loading)"
    - "Increase unit test coverage for orchestrator handlers and client modules"
    - "Add CLAUDE.md and .claude/rules/ for agent-guided test development"
  priority_2:
    - "Add performance/load testing for orchestrator endpoints"
    - "Implement contract tests for detector and chunker API boundaries"
    - "Add SBOM generation to container build process"
    - "Add CodeQL or Semgrep for static application security testing (SAST)"
---

# Quality Analysis: fms-guardrails-orchestrator

## Executive Summary

- **Overall Score: 5.8/10**
- **Repository Type**: Rust server application (REST API orchestrator for AI safety guardrails)
- **Primary Language**: Rust (Edition 2024, toolchain 1.92.0)
- **Key Strengths**: Strong integration test suite with 86 tests covering all API endpoints; good pre-commit hook configuration; multi-architecture Docker support; DISA STIG image hardening
- **Critical Gaps**: No test coverage tracking; no security scanning in CI; no Konflux build simulation; sparse unit tests; zero agent rules
- **Agent Rules Status**: Missing - No CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 5.5/10 | 28 inline unit tests across 12 files; sparse for 15K+ LOC |
| Integration/E2E | 7.5/10 | 86 integration tests with mock servers; comprehensive API coverage |
| **Build Integration** | **4.0/10** | **No PR-time Konflux simulation; Docker build runs tests only in Konflux Dockerfile** |
| Image Testing | 5.0/10 | Multi-arch Dockerfiles but no runtime validation |
| Coverage Tracking | 1.0/10 | No coverage tool, no thresholds, no PR reporting |
| CI/CD Automation | 5.5/10 | Single workflow; no security scanning or periodic jobs |
| Agent Rules | 0.0/10 | No AI agent guidance whatsoever |

## Critical Gaps

### 1. No Test Coverage Tracking or Enforcement
- **Impact**: Cannot identify untested code paths; regressions introduced silently
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No `cargo-tarpaulin`, `llvm-cov`, codecov integration, or coverage thresholds configured. The 28 inline unit tests and 86 integration tests provide no visibility into which code paths are actually exercised.

### 2. No Security Scanning in CI
- **Impact**: Vulnerabilities in Rust dependencies and UBI base images go undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Trivy, Snyk, CodeQL, cargo-audit, or cargo-deny in CI. The project pins OpenSSL versions in Dockerfiles (`OPENSSL_VERSION=3.5.1-7.el9_7`) but has no automated way to detect when updates are needed. The DISA STIG hardening in the amd64 Dockerfile is good practice, but security scanning should also happen at the dependency and container level.

### 3. No PR-Time Konflux Build Simulation
- **Impact**: Multi-arch build failures, OpenSSL version mismatches, and Dockerfile issues discovered only post-merge
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: The `Dockerfile.konflux` is significantly different from `Dockerfile.amd64` — it has multi-arch support (`TARGETARCH`), different OpenSSL pinning, and the DISA STIG hardening is absent. PR CI only runs `cargo build` and `cargo test` natively, missing Dockerfile build validation entirely.

### 4. No Container Image Runtime Validation
- **Impact**: Image startup failures, missing runtime libraries, or misconfigured entrypoints not caught until deployment
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Dockerfiles build and copy the binary, but there's no CI step that validates the final image can start, respond to health checks, or load its configuration.

### 5. Sparse Unit Test Coverage
- **Impact**: Core business logic in orchestrator handlers, client modules, and server code lacks granular testing
- **Severity**: MEDIUM
- **Effort**: 16-24 hours
- **Details**: 28 `#[test]` functions for 15,586 lines of source code. The integration tests compensate partially, but unit tests provide faster feedback and better isolation. Key gaps:
  - `src/orchestrator/handlers/` — most handlers have zero unit tests
  - `src/server/` — `#[cfg(test)]` module exists but no `#[test]` functions
  - `src/clients/` — only 5 unit tests across 3 client files

### 6. No Agent Rules or AI-Assisted Development Guidance
- **Impact**: AI agents cannot reliably generate tests matching project patterns
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory. The `mocktail` mocking framework, `test-log` integration, and specific test patterns (e.g., `TestOrchestratorServer` builder) would greatly benefit from documented rules.

## Quick Wins

### 1. Add cargo-tarpaulin or llvm-cov to CI (2-3 hours)
```yaml
    - name: Run tests with coverage
      run: cargo install cargo-tarpaulin && cargo tarpaulin --out xml
    - name: Upload coverage
      uses: codecov/codecov-action@v4
      with:
        file: cobertura.xml
```

### 2. Add Trivy Container Scanning (1-2 hours)
```yaml
    - name: Build image
      run: docker build -f Dockerfile.amd64 -t test-image .
    - name: Scan with Trivy
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: test-image
        severity: 'CRITICAL,HIGH'
```

### 3. Add cargo-deny for Dependency Auditing (1-2 hours)
```yaml
    - name: Check dependencies
      run: cargo install cargo-deny && cargo deny check
```

### 4. Add cargo-audit to CI (30 minutes)
```yaml
    - name: Security audit
      run: cargo install cargo-audit && cargo audit
```

### 5. Create CLAUDE.md with Test Patterns (2-3 hours)
Document the `mocktail` mock server pattern, `TestOrchestratorServer` builder usage, and `test-log` conventions so AI agents can generate consistent tests.

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory**: Single workflow file (`.github/workflows/test.yml`)

| Workflow | Triggers | Purpose |
|----------|----------|---------|
| `test.yml` | push to main, PR to main | Build, format check, lint, test |

**Strengths**:
- Runs on both push and PR events
- Skips draft PRs (`github.event.pull_request.draft == false`)
- Cargo dependency caching via `actions/cache@v4`
- `RUSTFLAGS="-Dwarnings"` — treats all warnings as errors (strong quality gate)
- Nightly rustfmt for consistent formatting

**Gaps**:
- Single job with sequential steps (no parallelization of build/lint/test)
- No concurrency control (`concurrency` key missing — multiple workflow runs for same PR can overlap)
- No security scanning steps (no Trivy, no cargo-audit, no CodeQL)
- No periodic/scheduled jobs for dependency checks
- No E2E testing against real services or Kind clusters
- No container build validation in CI
- Tests run only on `ubuntu-latest` — no multi-arch CI

### Test Coverage

**Unit Tests** (inline `#[cfg(test)]` modules):
- 28 `#[test]` functions across 12 source files
- Testing framework: Rust standard `#[test]` and `#[tokio::test]`
- Key tested modules: `config.rs` (8 tests), `orchestrator/common/utils.rs` (5 tests), `clients/openai.rs` (4 tests)
- Key untested modules: most `orchestrator/handlers/`, `server/` logic, many `clients/` modules

**Integration Tests** (`tests/` directory):
- 86 async test functions across 12 test files
- 7 common/helper modules in `tests/common/`
- Uses `mocktail` crate for mock HTTP/gRPC servers
- Well-structured `TestOrchestratorServer` builder pattern for test setup
- Covers all API endpoints:
  - Chat completions (streaming/unary)
  - Text completions (streaming/unary)
  - Content detection (streaming/unary)
  - Generation with detection
  - Detection on generation
  - Context docs detection
  - Chat detection
  - Classification with text generation
- Error scenarios: bad requests, runtime errors, internal server errors, race conditions

**Test-to-Code Ratio**: 20,370 test lines / 15,586 source lines = **1.31:1** (good ratio, heavily weighted toward integration tests)

**Test Resources**: TLS certificates (`localhost.crt`, `localhost.key`) for testing HTTPS/TLS scenarios

### Code Quality Tools

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- `cargo +nightly fmt` — formatting with nightly features
- `cargo check` — compilation verification
- `cargo clippy -D warnings` — lint with strict warning-as-error

**Rust Formatting** (`rustfmt.toml`):
- `group_imports = "StdExternalCrate"` — import grouping
- `imports_granularity = "Crate"` — crate-level import granularity

**CI Linting**:
- Clippy with `--no-deps --all-targets --all-features`
- `RUSTFLAGS="-Dwarnings"` enforces zero-warning policy

**Missing**:
- No `.golangci.yaml` equivalent for expanded Clippy rules (e.g., `clippy.toml`)
- No SAST tools (CodeQL, Semgrep, gosec equivalent)
- No dependency auditing (cargo-deny, cargo-audit)
- No secret detection (gitleaks, trufflehog)

### Container Images

**Dockerfile Inventory**:

| File | Purpose | Multi-arch | Tests in Build | STIG Hardening |
|------|---------|-----------|---------------|----------------|
| `Dockerfile.amd64` | Development/community build | No (x86_64 only) | Yes (`cargo test`) | Yes (DISA STIG) |
| `Dockerfile.konflux` | Production/Konflux build | Yes (amd64, arm64, s390x, ppc64le) | Yes (`cargo test`) | No |
| `Dockerfile.ppc64le` | ppc64le-specific build | No (ppc64le only) | Yes (`cargo test`) | Yes (DISA STIG) |
| `Dockerfile.s390x` | s390x-specific build | No (s390x only) | Yes (`cargo test`) | Yes (DISA STIG) |

**Strengths**:
- Multi-stage builds (builder → release) for minimal final image
- UBI 9 minimal base image (Red Hat certified)
- Tests run inside Docker build (`cargo test` in builder stage)
- Non-root user (`orchestr8`, UID 1001) in final image
- DISA STIG remediation scripts for image hardening (amd64, ppc64le, s390x)
- OpenSSL version pinning in Konflux build for reproducibility
- `HEALTHCHECK NONE` — defers to orchestrator's own health endpoint

**Gaps**:
- No Trivy/Snyk scanning of final images
- No SBOM generation
- No image signing or attestation
- No runtime validation tests after build
- Konflux Dockerfile differs significantly from arch-specific ones (no STIG hardening)
- `.dockerignore` is minimal (only `.DS_Store`, `.vscode`, `target`)

### Security

**Strengths**:
- DISA STIG profile compliance via OpenSCAP remediation scripts
- OpenSSL version pinning in production builds
- Non-root container runtime
- `HEALTHCHECK NONE` avoids leaking health endpoint info
- `rustls` for TLS (pure-Rust, memory-safe TLS implementation)
- TLS test resources for testing secure connections

**Gaps**:
- No CI-integrated vulnerability scanning
- No `cargo-audit` for Rust advisory database checks
- No `cargo-deny` for license/duplicate/vulnerability checks
- No CodeQL, Semgrep, or static analysis in CI
- No secret detection (gitleaks, trufflehog)
- No dependency update automation (Dependabot/Renovate)

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: Zero test types have rules
- **Quality**: N/A — no rules exist
- **Gaps**: No CLAUDE.md, no AGENTS.md, no `.claude/` directory, no `.claude/rules/`, no `.claude/skills/`
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - Unit test patterns (mocktail mocking, `#[cfg(test)]` modules)
  - Integration test patterns (`TestOrchestratorServer` builder, async test setup)
  - Test configuration (test YAML config, TLS resources)
  - Error scenario testing patterns

## Recommendations

### Priority 0 (Critical)

1. **Integrate test coverage tracking** — Add `cargo-tarpaulin` or `cargo-llvm-cov` to CI with codecov upload. Set initial threshold at current coverage level and incrementally increase.

2. **Add container vulnerability scanning** — Add Trivy action to scan built images for CRITICAL/HIGH CVEs. Block PRs that introduce new high-severity vulnerabilities.

3. **Add dependency security auditing** — Add `cargo-audit` (advisory database) and `cargo-deny` (licenses, duplicates, vulnerabilities) to CI.

### Priority 1 (High Value)

4. **Create Konflux build simulation in PR CI** — Build `Dockerfile.konflux` with `docker buildx` in CI to catch multi-arch and pinning issues before merge.

5. **Add container runtime validation** — After building the image, run it and verify:
   - Binary starts successfully
   - Health endpoint responds
   - Configuration file loads correctly
   - Graceful shutdown works

6. **Increase unit test coverage** — Focus on:
   - Orchestrator handlers (`src/orchestrator/handlers/`) — most have zero unit tests
   - Client modules (`src/clients/`) — only 5 unit tests total
   - Server module (`src/server/`) — cfg(test) exists but no test functions

7. **Create agent rules** — Add CLAUDE.md and `.claude/rules/` with:
   - Unit test creation guide (mocktail patterns, test modules)
   - Integration test patterns (TestOrchestratorServer, async fixtures)
   - Code style conventions (import grouping, error handling)

### Priority 2 (Nice-to-Have)

8. **Add performance/load testing** — The orchestrator handles concurrent streaming requests; benchmark throughput and latency under load.

9. **Add contract tests** — Define and test API contracts between orchestrator, detectors, chunkers, and generation services.

10. **Add SBOM generation** — Generate Software Bill of Materials during image builds for supply chain transparency.

11. **Add CodeQL or Semgrep** — Static analysis for common vulnerability patterns beyond what Clippy catches.

12. **Add CI concurrency control** — Prevent overlapping workflow runs for the same PR:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

13. **Parallelize CI jobs** — Split build, lint, and test into separate jobs for faster feedback:
```yaml
jobs:
  fmt:
    runs-on: ubuntu-latest
    steps: [...]
  clippy:
    runs-on: ubuntu-latest
    steps: [...]
  test:
    runs-on: ubuntu-latest
    steps: [...]
```

## Comparison to Gold Standards

| Practice | fms-guardrails-orchestrator | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|----------|---------------------------|---------------------|-----------------|---------------|
| Unit Tests | 28 inline tests | Comprehensive Jest suite | N/A (image-focused) | Extensive Go tests |
| Integration Tests | 86 async tests w/ mocks | Contract + API tests | N/A | envtest + Kind |
| Coverage Tracking | None | Codecov + thresholds | N/A | Codecov + enforcement |
| Container Scanning | None | Trivy in CI | Trivy + SBOM | Trivy in CI |
| Multi-arch Support | 4 Dockerfiles | Single w/ buildx | Multi-arch matrix | Multi-arch |
| Security Scanning | None (STIG hardening only) | CodeQL + Snyk | Trivy | CodeQL |
| Pre-commit Hooks | fmt + check + clippy | ESLint + Prettier | N/A | golangci-lint |
| Agent Rules | None | Comprehensive | N/A | N/A |
| CI Concurrency | None | Enabled | Enabled | Enabled |
| Image Runtime Test | None | Kind deployment | 5-layer validation | Kind + envtest |
| STIG Compliance | Yes (OpenSCAP) | No | No | No |

## File Paths Reference

### CI/CD
- `.github/workflows/test.yml` — Single CI workflow

### Testing
- `tests/*.rs` — 12 integration test files (86 tests)
- `tests/common/` — 7 shared test utilities (orchestrator server, mocks, helpers)
- `tests/test_config.yaml` — Test orchestrator configuration
- `tests/resources/` — TLS certificates for testing

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks (fmt, check, clippy)
- `rustfmt.toml` — Rust formatting configuration
- `rust-toolchain.toml` — Rust 1.92.0 toolchain

### Container Images
- `Dockerfile.amd64` — AMD64 build with STIG hardening
- `Dockerfile.konflux` — Multi-arch Konflux production build
- `Dockerfile.ppc64le` — PPC64LE build with STIG hardening
- `Dockerfile.s390x` — S390X build with STIG hardening
- `.dockerignore` — Docker build exclusions
- `scripts/remediation-script.sh` — DISA STIG hardening script

### Source Code
- `src/` — 54 Rust source files (15,586 lines)
- `src/orchestrator/` — Core orchestration logic
- `src/clients/` — HTTP/gRPC client modules
- `src/server/` — Axum web server setup
- `protos/` — 6 protobuf definitions for gRPC services

### Configuration
- `Cargo.toml` — Rust project configuration
- `config/config.yaml` — Production orchestrator config
- `CODEOWNERS` — 4 code owners defined
