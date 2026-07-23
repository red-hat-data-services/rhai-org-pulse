---
repository: "red-hat-data-services/fms-guardrails-orchestrator"
overall_score: 5.2
scorecard:
  - dimension: "Unit Tests"
    score: 6.0
    status: "Inline unit tests in 12/54 source files (22%); 28 #[test] functions with good test isolation using mocktail"
  - dimension: "Integration/E2E"
    score: 5.0
    status: "86 async integration tests across 12 test files using mock servers; no true E2E or multi-version testing"
  - dimension: "Build Integration"
    score: 7.0
    status: "GitHub Actions PR validation + Tekton/Konflux multi-arch builds; tests run during image build"
  - dimension: "Image Testing"
    score: 5.0
    status: "Multi-stage UBI 9 builds for 4 architectures; no runtime validation or Testcontainers"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tooling (no tarpaulin, llvm-cov, codecov, or thresholds)"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "Single GitHub Actions workflow with caching and clippy enforcement; Tekton for Konflux builds"
  - dimension: "Static Analysis"
    score: 7.0
    status: "Clippy with -Dwarnings, pre-commit hooks, Renovate configured; FIPS ring-based TLS not fully certified"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No code coverage tracking"
    impact: "Cannot measure or enforce test coverage; regressions go undetected"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No true E2E tests against real services"
    impact: "Integration issues between orchestrator and actual detector/chunker/LLM services only found in deployment"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "FIPS TLS compliance gap — rustls with ring provider"
    impact: "ring crypto provider is not FIPS 140-2/3 certified; may fail FIPS compliance requirements in production"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents lack project-specific guidance for test patterns, architecture decisions, and coding standards"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add cargo-tarpaulin or llvm-cov to CI for coverage tracking"
    effort: "2-4 hours"
    impact: "Immediately gain visibility into test coverage gaps; enables threshold enforcement"
  - title: "Add codecov.yml with PR coverage reporting"
    effort: "1-2 hours"
    impact: "Coverage reporting on every PR with diff coverage gates"
  - title: "Create CLAUDE.md with test patterns and architecture guidance"
    effort: "2-3 hours"
    impact: "Improve AI-generated code quality and consistency; onboard new contributors faster"
  - title: "Add scheduled CI workflow for nightly builds"
    effort: "1-2 hours"
    impact: "Catch dependency breakage and flaky tests early"
recommendations:
  priority_0:
    - "Add code coverage tracking with cargo-tarpaulin or llvm-cov in CI, with minimum threshold enforcement"
    - "Evaluate aws-lc-rs or boring crate as FIPS-certified TLS crypto provider to replace ring"
    - "Add true E2E test suite with real detector/chunker service stubs or containerized test environment"
  priority_1:
    - "Add scheduled/nightly CI workflow for periodic test runs"
    - "Create CLAUDE.md and .claude/rules/ for test patterns and architecture guidance"
    - "Add matrix testing for multiple Rust toolchain versions"
    - "Implement container runtime validation (startup, health check, basic API smoke test)"
  priority_2:
    - "Add performance/load testing for API endpoints"
    - "Add test parallelization in CI (cargo test with thread options)"
    - "Create docker-compose for local development environment"
    - "Add OpenAPI contract testing against generated specs"
---

# Quality Analysis: fms-guardrails-orchestrator

## Executive Summary

- **Overall Score: 5.2/10**
- **Repository**: [red-hat-data-services/fms-guardrails-orchestrator](https://github.com/red-hat-data-services/fms-guardrails-orchestrator)
- **Type**: Rust REST API service (AI guardrails orchestrator)
- **Primary Language**: Rust (edition 2024, toolchain 1.92.0)
- **Jira**: RHOAIENG / AI Safety (downstream tier)
- **Key Strengths**: Strong integration test suite with 86 async tests, multi-arch Tekton/Konflux build pipeline, good static analysis with clippy + pre-commit hooks
- **Critical Gaps**: No code coverage tracking, no true E2E tests, FIPS TLS compliance gap (ring provider), no agent rules
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 6.0/10 | Inline tests in 22% of source files; 28 test functions |
| Integration/E2E | 20% | 5.0/10 | 86 mock-based integration tests; no true E2E |
| Build Integration | 15% | 7.0/10 | GitHub Actions + Tekton multi-arch PR builds |
| Image Testing | 10% | 5.0/10 | Multi-stage UBI 9 builds; no runtime validation |
| Coverage Tracking | 10% | 1.0/10 | No coverage tooling whatsoever |
| CI/CD Automation | 15% | 6.0/10 | Single workflow with caching; Tekton for Konflux |
| Static Analysis | 10% | 7.0/10 | Clippy + pre-commit + Renovate; FIPS gap |
| Agent Rules | 5% | 0.0/10 | No CLAUDE.md or .claude/ directory |

## Critical Gaps

### 1. No Code Coverage Tracking
- **Impact**: Cannot measure test coverage, track regressions, or enforce coverage thresholds on PRs
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No `cargo-tarpaulin`, `llvm-cov`, `grcov`, or any coverage generation in CI. No `.codecov.yml` or PR coverage reporting. With 28 inline unit tests and 86 integration tests, the actual coverage percentage is unknown.

### 2. No True E2E Tests Against Real Services
- **Impact**: Integration issues between orchestrator and actual detector/chunker/LLM backends are only caught during deployment
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: All integration tests use `mocktail::server::MockServer` to simulate external services. While this validates orchestrator logic, it does not test real gRPC/HTTP interactions with actual caikit, TGIS, or detector services. No docker-compose, Kind, or Minikube setup exists for local E2E testing.

### 3. FIPS TLS Compliance Gap
- **Impact**: `ring` crypto provider used by `rustls` is not FIPS 140-2/3 certified. Production deployments requiring FIPS compliance may fail security audits.
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Details**: The project uses `rustls` with `ring` as the crypto backend throughout (Cargo.toml features: `"ring"` on `rustls`, `hyper-rustls`, `tokio-rustls`, `rustls-webpki`). While the base images are UBI 9 (FIPS-capable) and OpenSSL is installed in runtime images, the Rust binary itself uses `ring` for TLS. Switching to `aws-lc-rs` (FIPS-certified) or `boring` would address this.

### 4. No Agent Rules
- **Impact**: AI coding assistants lack project-specific guidance for test patterns, architecture decisions, and Rust idioms
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory. This means AI agents have no context about the project's test framework (`mocktail`, `test-log`), architecture (orchestrator pattern with clients, handlers, detectors), or coding standards.

## Quick Wins

### 1. Add cargo-tarpaulin Coverage to CI (2-4 hours)
```yaml
# Add to .github/workflows/test.yml
- name: Install tarpaulin
  run: cargo install cargo-tarpaulin
- name: Run coverage
  run: cargo tarpaulin --out xml --skip-clean
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: cobertura.xml
    fail_ci_if_error: false
```

### 2. Add codecov.yml with Thresholds (1-2 hours)
```yaml
# .codecov.yml
coverage:
  status:
    project:
      default:
        target: 60%
        threshold: 5%
    patch:
      default:
        target: 70%
```

### 3. Create CLAUDE.md (2-3 hours)
Create a `CLAUDE.md` in the repository root with:
- Project architecture overview (orchestrator pattern)
- Test framework guidance (`mocktail`, `test-log`, `tokio::test`)
- Code style conventions (Rust edition 2024, nightly fmt)
- Pre-commit hook requirements
- How to add new detector/chunker handlers

### 4. Add Scheduled CI Workflow (1-2 hours)
```yaml
# .github/workflows/nightly.yml
on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:
```

## Detailed Findings

### Unit Tests

**Score: 6.0/10**

The project has inline unit tests (`#[cfg(test)]` modules) in 12 out of 54 source files (22%). There are 28 `#[test]` functions spread across:

| File | Test Count | What's Tested |
|------|------------|---------------|
| `src/config.rs` | 8 | Configuration parsing and validation |
| `src/orchestrator/common/utils.rs` | 5 | Utility functions for orchestration |
| `src/clients/openai.rs` | 4 | OpenAI client serialization/deserialization |
| `src/orchestrator/types/detection_batcher/completion.rs` | 3 | Detection batcher completion logic |
| `src/models.rs` | 2 | Model type tests |
| `src/orchestrator/types/detection_batcher/max_processed_index.rs` | 2 | Index tracking |
| `src/server.rs` | 2 (tokio) | Server startup |
| Others | 2 | Various utilities |

**Strengths**:
- Good test-to-code line ratio (20,370 test lines vs 15,586 source lines = 1.31:1)
- Uses `test-log` for structured test output
- `mocktail` provides clean mock server abstractions

**Gaps**:
- 42 out of 54 source files (78%) have no inline unit tests
- Key files lacking unit tests: `src/health.rs`, `src/args.rs`, `src/clients/detector.rs`, `src/clients/chunker.rs`, `src/clients/tgis.rs`, `src/clients/nlp.rs`, all orchestrator handler modules
- No property-based testing or fuzzing

### Integration/E2E Tests

**Score: 5.0/10**

The `tests/` directory contains 12 integration test files with 86 async test functions using `#[test(tokio::test)]` via `test-log`:

| Test File | Test Count | Endpoint Tested |
|-----------|------------|-----------------|
| `chat_completions_streaming.rs` | 16 | Chat completions with streaming detection |
| `completions_streaming.rs` | 15 | Text completions with streaming |
| `chat_completions_unary.rs` | 8 | Chat completions unary detection |
| `completions_unary.rs` | 8 | Text completions unary |
| `streaming_classification_with_gen.rs` | 8 | Streaming classification |
| `classification_with_text_gen.rs` | 7 | Classification with text generation |
| `chat_detection.rs` | 4 | Chat-based detection |
| `context_docs_detection.rs` | 4 | Context document detection |
| `detection_on_generation.rs` | 4 | Detection on generated text |
| `generation_with_detection.rs` | 4 | Generation with detection |
| `streaming_content_detection.rs` | 4 | Streaming content detection |
| `text_content_detection.rs` | 4 | Text content detection |

**Test Infrastructure**:
- `tests/common/` module provides reusable test helpers:
  - `orchestrator.rs` — `TestOrchestratorServer` builder pattern to spin up test orchestrator
  - `detectors.rs` — Mock detector configurations
  - `chunker.rs` — Mock chunker configurations
  - `generation.rs` — Mock generation service
  - `openai.rs` — Mock OpenAI API
  - `errors.rs` — Error assertion helpers
- Test config at `tests/test_config.yaml` defines mock service topology

**Strengths**:
- Good API endpoint coverage across all orchestrator endpoints
- Both unary and streaming response patterns tested
- Well-structured test helper modules

**Gaps**:
- All tests use `MockServer` — no real service integration
- No E2E test infrastructure (docker-compose, Kind, etc.)
- No multi-version testing (different detector API versions, Rust toolchain versions)
- No performance or load testing

### Build Integration

**Score: 7.0/10**

**GitHub Actions (`test.yml`)**:
- Triggered on push to main and PR events (opened, reopened, synchronize, ready_for_review)
- Steps: Install nightly rustfmt, install protoc, checkout, cache dependencies, build, format check, clippy lint, tests
- Draft PR filtering: `if: github.event.pull_request.draft == false`
- Dependency caching: Cargo registry + git + target directory keyed on `Cargo.lock` hash

**Tekton/Konflux Pipeline (`.tekton/odh-fms-guardrails-orchestrator-pull-request.yaml`)**:
- Triggered on PR events via PipelinesAsCode
- Comment trigger: `/build-konflux`
- Label triggers: `kfbuild-all`, `kfbuild-fms-guardrails-orchestrator`
- Multi-arch: x86_64, ppc64le, arm64, s390x
- Hermetic builds with cargo + RPM prefetch
- Image expires after 5 days for PR builds
- References shared pipeline from `red-hat-data-services/konflux-central`

**Dockerfile Build Validation**:
- `Dockerfile.konflux` runs `cargo test` during image build (tests are gated by the build)
- Architecture-specific Dockerfiles (amd64, ppc64le, s390x) also run tests during build
- Konflux Dockerfile skips one known test: `--skip orchestrator::common::tasks::test::tests`

**Strengths**:
- Dual CI: GitHub Actions for fast feedback, Tekton for production-like builds
- Tests run during image builds ensure binary-level validation
- Multi-architecture support (4 architectures)

**Gaps**:
- No kustomize or deployment manifest validation (service, not operator)
- No smoke test of built image (e.g., start container, hit health endpoint)

### Image Testing

**Score: 5.0/10**

**Dockerfiles**:
- 4 architecture-specific Dockerfiles: `Dockerfile.amd64`, `Dockerfile.ppc64le`, `Dockerfile.s390x`, `Dockerfile.konflux`
- All use multi-stage builds: `rust-builder` → `fms-guardrails-orchestr8-builder` → `fms-guardrails-orchestr8-release`
- Base image: `registry.access.redhat.com/ubi9/ubi-minimal` (FIPS-capable)
- Non-root user: `orchestr8` (UID 1001, GID 0)
- Image hardening: `remediation-script.sh` in amd64 Dockerfile
- `HEALTHCHECK NONE` (defers to Kubernetes probes)

**Strengths**:
- Consistent multi-stage build pattern across all architectures
- UBI 9 minimal base (security, compliance)
- Tests run during image build
- Non-root runtime user
- `.dockerignore` excludes build artifacts and dev files

**Gaps**:
- No Testcontainers or runtime container validation
- No docker-compose for local development
- No health check in Dockerfile (relies on external K8s probes)
- No image scanning configured (handled org-level, out of scope)
- Build arguments differ slightly between Dockerfiles (inconsistency)

### Coverage Tracking

**Score: 1.0/10**

No coverage tracking infrastructure exists:
- No `cargo-tarpaulin`, `llvm-cov`, or `grcov` in CI
- No `.codecov.yml` or `coveralls.yml`
- No coverage thresholds or gates
- No PR coverage reporting
- No coverage generation commands in any workflow or Makefile

The project has 28 inline unit tests and 86 integration tests, but the actual code coverage percentage is unknown. The user story template mentions "Unit tests cover new/changed code" as a checklist item, but there's no automated enforcement.

### CI/CD Automation

**Score: 6.0/10**

**Workflow Inventory**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `.github/workflows/test.yml` | push to main, PR | Build, format, lint, test |
| `.tekton/odh-fms-guardrails-orchestrator-pull-request.yaml` | PR (label/comment) | Konflux multi-arch image build |

**Strengths**:
- `RUSTFLAGS="-Dwarnings"` enforces zero-warning policy
- Dependency caching with `Cargo.lock`-based key
- Draft PR filtering prevents unnecessary CI runs
- Tekton `cancel-in-progress: "true"` for concurrent PR pushes
- Hermetic Konflux builds with prefetch

**Gaps**:
- Only 1 GitHub Actions workflow (single job, no matrix)
- No scheduled/periodic builds (nightly, weekly)
- No test parallelization strategy
- No concurrency control in GitHub Actions (only in Tekton)
- No workflow for release/tag builds
- No timeout-minutes configured

### Static Analysis

**Score: 7.0/10**

**Linting**:
- `cargo clippy --no-deps --all-targets --all-features` in CI
- `RUSTFLAGS="-Dwarnings"` treats all compiler warnings as errors
- `cargo +nightly fmt --check --all` for formatting enforcement
- `rustfmt.toml` configures import grouping (`StdExternalCrate`) and granularity (`Crate`)

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- `fmt-nightly` — Format with nightly rustfmt
- `cargo-check` — Compilation error check
- `clippy` — Lint with `-D warnings`

**FIPS Compatibility**:
- **Base images**: UBI 9 minimal (FIPS-capable) — Good
- **TLS**: `rustls` with `ring` crypto provider — `ring` is NOT FIPS 140-2/3 certified
- **Source code**: Uses `rustls::crypto::ring::default_provider()` in `src/main.rs` and `src/server/tls.rs`
- **Recommendation**: Switch to `aws-lc-rs` (FIPS-certified) or `boring` crate for FIPS compliance
- **No FIPS build tags**: No `--cfg fips` or equivalent
- **Runtime**: `openssl-libs` installed in release images (used by system, not by Rust binary)

**Dependency Alerts**:
- **Renovate**: Configured via `.github/renovate.json`, extends from `red-hat-data-services/konflux-central//renovate/rpm-refresh-renovate.json5`
- **No Dependabot**: `.github/dependabot.yml` not present (Renovate covers dependency updates)
- **RPM lock management**: `rpms.lock.yaml` and `rpms.in.yaml` for hermetic builds

### Agent Rules

**Score: 0.0/10**

No AI agent guidance exists:
- No `CLAUDE.md` in repository root
- No `AGENTS.md`
- No `.claude/` directory
- No `.claude/rules/` test creation rules
- No `.claude/skills/` custom skills

The project has well-structured Rust code with clear module organization (clients, orchestrator, server, utils), but none of this architectural knowledge is documented for AI assistants. The `CONTRIBUTING.md` provides human-readable contribution guidelines but nothing machine-optimized.

**Recommendation**: Generate agent rules with `/test-rules-generator` to create:
- Unit test patterns for Rust (inline `#[cfg(test)]` modules, `mocktail` usage)
- Integration test patterns (test helper usage, mock server setup)
- Architecture rules (orchestrator handler pattern, client abstractions)

## Recommendations

### Priority 0 (Critical)

1. **Add code coverage tracking** — Install `cargo-tarpaulin` or `llvm-cov` in GitHub Actions, configure codecov with PR reporting and 60% project / 70% patch thresholds. This is the single highest-ROI improvement.

2. **Evaluate FIPS-certified TLS crypto provider** — Replace `ring` with `aws-lc-rs` (FIPS 140-3 certified) or `boring` (BoringSSL). This requires updating Cargo.toml features across `rustls`, `hyper-rustls`, `tokio-rustls`, and `rustls-webpki`.

3. **Add E2E test infrastructure** — Create a docker-compose or similar setup that runs the orchestrator with real (or lightweight) detector, chunker, and generation service instances to validate end-to-end request flows.

### Priority 1 (High Value)

4. **Add scheduled/nightly CI workflow** — Catch dependency breakage, upstream API changes, and flaky tests outside of PR context.

5. **Create CLAUDE.md and agent rules** — Document test framework, architecture patterns, and coding standards for AI-assisted development. Use `/test-rules-generator` as a starting point.

6. **Add Rust toolchain matrix testing** — Test on stable and beta channels to catch upcoming breaking changes early.

7. **Add container runtime validation** — After image build, start the container and verify it responds to health check before marking the build as passing.

### Priority 2 (Nice-to-Have)

8. **Add performance/load testing** — Benchmark API endpoint latency and throughput, especially for streaming detection.

9. **Add CI concurrency control** — Use GitHub Actions `concurrency` groups to cancel superseded runs.

10. **Create docker-compose for local development** — Make it easy for developers to spin up the orchestrator with mock services locally.

11. **Add OpenAPI contract testing** — Validate that API responses match the OpenAPI specs in `docs/api/`.

## Comparison to Gold Standards

| Dimension | fms-guardrails-orchestrator | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|-----------|---------------------------|---------------------|------------------|---------------|
| Unit Tests | 6.0 — 28 inline tests, 22% file coverage | 9.0 — Comprehensive Jest/Cypress | 7.0 — Python pytest suites | 8.0 — Go table-driven tests |
| Integration/E2E | 5.0 — Mock-based only | 9.0 — Multi-layer with contracts | 7.0 — Image validation | 9.0 — envtest + real cluster |
| Build Integration | 7.0 — GHA + Tekton multi-arch | 8.0 — Multi-mode builds | 8.0 — 5-layer validation | 8.0 — Operator SDK |
| Image Testing | 5.0 — Multi-stage, no runtime test | 7.0 — Container health checks | 9.0 — Full image pipeline | 7.0 — Deployment testing |
| Coverage Tracking | 1.0 — None | 9.0 — Codecov with gates | 6.0 — Basic coverage | 8.0 — Enforced thresholds |
| CI/CD Automation | 6.0 — Single workflow + Tekton | 9.0 — Full pipeline | 8.0 — Multi-workflow | 9.0 — Matrix + scheduled |
| Static Analysis | 7.0 — Clippy + pre-commit | 8.0 — ESLint + TypeScript strict | 7.0 — Linting + FIPS | 8.0 — golangci-lint |
| Agent Rules | 0.0 — None | 8.0 — Comprehensive | 3.0 — Basic | 4.0 — Partial |
| **Overall** | **5.2** | **8.6** | **7.0** | **7.9** |

## File Paths Reference

### CI/CD
- `.github/workflows/test.yml` — Main CI workflow (build, format, lint, test)
- `.tekton/odh-fms-guardrails-orchestrator-pull-request.yaml` — Konflux PR build pipeline

### Build
- `Dockerfile.konflux` — Production Konflux build (multi-stage, UBI 9)
- `Dockerfile.amd64` — x86_64 development build
- `Dockerfile.ppc64le` — ppc64le build
- `Dockerfile.s390x` — s390x build
- `rpms.in.yaml` / `rpms.lock.yaml` — RPM dependency management for hermetic builds

### Testing
- `tests/*.rs` — 12 integration test files (86 async tests)
- `tests/common/` — Shared test helpers (orchestrator, mock servers, error assertions)
- `tests/test_config.yaml` — Test service configuration
- `tests/resources/` — TLS test certificates

### Source
- `src/main.rs` — Entry point
- `src/lib.rs` — Library root
- `src/orchestrator/` — Core orchestration logic (handlers, types, errors)
- `src/clients/` — External service clients (OpenAI, TGIS, NLP, detector, chunker)
- `src/server/` — HTTP server (routes, TLS, errors)
- `src/config.rs` — Configuration parsing (8 unit tests)

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks (fmt, check, clippy)
- `rustfmt.toml` — Formatter configuration
- `rust-toolchain.toml` — Pinned toolchain (1.92.0)
- `.github/renovate.json` — Renovate dependency bot configuration

### Configuration
- `Cargo.toml` — Rust project manifest
- `config/config.yaml` — Application configuration template
- `protos/` — Protocol buffer definitions (gRPC)
- `docs/api/` — OpenAPI specifications
