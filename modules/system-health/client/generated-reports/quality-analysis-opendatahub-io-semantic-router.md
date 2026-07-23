---
repository: "opendatahub-io/semantic-router"
overall_score: 7.5
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Good coverage across Go/Rust/Python with 35% Go test-to-code ratio; testify and Ginkgo frameworks"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Exceptional E2E suite with 18+ Kind-based profiles, Helm validation, memory integration tests"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-time Docker builds for 6 images, Helm lint/template validation, operator manifests dry-run"
  - dimension: "Image Testing"
    score: 6.0
    status: "Multi-stage cross-compiled Dockerfiles with multi-arch support but limited runtime validation"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "Only operator sub-component has codecov; no coverage thresholds, no main test coverage reporting"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "23 workflows with smart path filtering, matrix E2E, caching, concurrency control, nightly builds"
  - dimension: "Static Analysis"
    score: 7.0
    status: "golangci-lint with 12 linters, ESLint, Black, pre-commit hooks; missing Dependabot and FIPS tags"
  - dimension: "Agent Rules"
    score: 9.0
    status: "Comprehensive AGENTS.md, docs/agent/ ecosystem, executable rule layers, validation commands"
critical_gaps:
  - title: "No coverage tracking for main codebase"
    impact: "Code coverage trends are invisible; regressions in test coverage go undetected across the core router, bindings, and CLI"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No Dependabot or Renovate for dependency alerts"
    impact: "Vulnerable or outdated dependencies not automatically flagged; manual dependency monitoring required"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No FIPS build tags or boringcrypto configuration"
    impact: "Deployment in FIPS-mandated environments (FedRAMP, government) requires manual crypto auditing and build reconfiguration"
    severity: "MEDIUM"
    effort: "8-16 hours"
  - title: "No container runtime validation tests"
    impact: "Image startup failures and runtime issues not caught until deployment; no HEALTHCHECK directives"
    severity: "MEDIUM"
    effort: "4-8 hours"
quick_wins:
  - title: "Enable Dependabot for Go, Python, Rust, Docker ecosystems"
    effort: "1-2 hours"
    impact: "Automated security and dependency updates with PR generation across all 4 package ecosystems"
  - title: "Add coverprofile to main test workflow and integrate codecov"
    effort: "2-4 hours"
    impact: "Visibility into Go test coverage trends; coverage gates prevent regressions on PRs"
  - title: "Add HEALTHCHECK to production Dockerfiles"
    effort: "1-2 hours"
    impact: "Container orchestrators can detect unhealthy containers; faster failure detection"
  - title: "Add CLAUDE.md for Claude Code agent compatibility"
    effort: "1 hour"
    impact: "Enables Claude Code agents to work with the repo using existing AGENTS.md content"
recommendations:
  priority_0:
    - "Add --coverprofile to all Go test invocations in CI and integrate codecov/codecov-action for the main test workflow"
    - "Create .github/dependabot.yml covering gomod, pip, cargo, docker, and github-actions ecosystems"
  priority_1:
    - "Add FIPS build tags (//go:build boringcrypto) and GOEXPERIMENT=boringcrypto CI variant for FIPS-compliant builds"
    - "Add container runtime validation (startup probe tests, testcontainers-based smoke tests) for extproc and vllm-sr images"
    - "Extend Python test coverage beyond CLI tests to include training scripts and benchmark code"
  priority_2:
    - "Add HEALTHCHECK directives to production Dockerfiles (extproc, vllm-sr, dashboard)"
    - "Create CLAUDE.md at repo root referencing AGENTS.md for Claude Code compatibility"
    - "Add coverage thresholds to enforce minimum coverage gates on PRs"
---

# Quality Analysis: semantic-router (opendatahub-io)

## Executive Summary

- **Overall Score: 7.5/10**
- **Repository Type**: Inference Gateway / Semantic Router (Envoy extproc + ML bindings)
- **Primary Languages**: Go (primary), Rust (ML bindings), Python (CLI, training, benchmarks), TypeScript (website, dashboard)
- **Jira Component**: Inference Gateway (RHOAIENG)
- **Tier**: Midstream

**Key Strengths**: Exceptional E2E testing with 18+ Kind-based profiles, comprehensive CI/CD automation with 23 workflows, outstanding agent rules ecosystem with executable validation commands, and strong PR-time Docker build validation across 6 image variants.

**Critical Gaps**: No coverage tracking for the main codebase (only operator sub-component), no Dependabot/Renovate for dependency alerts, no FIPS build configuration, and limited container runtime validation.

**Agent Rules Status**: Present and comprehensive — AGENTS.md with full docs/agent/ ecosystem including architecture guardrails, testing strategy, governance, and executable rule layers.

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 7.0/10 | 15% | 1.05 | Good coverage across Go/Rust/Python |
| Integration/E2E | 9.0/10 | 20% | 1.80 | Exceptional multi-profile K8s E2E |
| Build Integration | 8.0/10 | 15% | 1.20 | PR-time Docker + Helm validation |
| Image Testing | 6.0/10 | 10% | 0.60 | Multi-arch builds, limited runtime tests |
| Coverage Tracking | 3.0/10 | 10% | 0.30 | Only operator has codecov |
| CI/CD Automation | 9.0/10 | 15% | 1.35 | 23 workflows, smart filtering |
| Static Analysis | 7.0/10 | 10% | 0.70 | Strong linting, missing dep alerts |
| Agent Rules | 9.0/10 | 5% | 0.45 | Comprehensive ecosystem |
| **Overall** | **7.5/10** | **100%** | **7.45** | |

## Critical Gaps

### 1. No Coverage Tracking for Main Codebase
- **Severity**: HIGH
- **Impact**: The main `test-and-build` workflow runs `make test` without `--coverprofile`. Only `deploy/operator/` has coverage via codecov. The core router (458 Go files), Rust bindings, and Python CLI have zero coverage visibility.
- **Effort**: 4-6 hours
- **Files**: `.github/workflows/test-and-build.yml`, `tools/make/build-run-test.mk`

### 2. No Dependabot or Renovate Configuration
- **Severity**: HIGH
- **Impact**: Four package ecosystems (Go modules, pip, Cargo, Docker base images) lack automated dependency alerting. Vulnerable dependencies require manual discovery.
- **Effort**: 1-2 hours
- **Files**: Missing `.github/dependabot.yml`

### 3. No FIPS Build Configuration
- **Severity**: MEDIUM
- **Impact**: The codebase uses `crypto/md5` in cache key generation (`pkg/cache/redis_cache.go`, `pkg/cache/milvus_cache.go`) and `math/rand` in multiple packages. While gosec exclusions (G404, G501, G401) mark these as intentional non-security uses, there are no FIPS build tags (`//go:build boringcrypto`), no `GOEXPERIMENT=boringcrypto` in CI, and no FIPS-specific CI variant.
- **Effort**: 8-16 hours
- **Files**: `tools/make/golang.mk`, `tools/docker/Dockerfile.extproc`, CI workflows

### 4. No Container Runtime Validation
- **Severity**: MEDIUM
- **Impact**: None of the 17+ Dockerfiles include `HEALTHCHECK` directives. No testcontainers or startup-probe tests exist. Container runtime failures are only caught during E2E tests (which test the full stack, not individual images).
- **Effort**: 4-8 hours
- **Files**: `tools/docker/Dockerfile.extproc`, `src/vllm-sr/Dockerfile`, `dashboard/backend/Dockerfile`

## Quick Wins

### 1. Enable Dependabot (1-2 hours)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "gomod"
    directories:
      - "/src/semantic-router"
      - "/e2e"
      - "/perf"
    schedule:
      interval: "weekly"
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "cargo"
    directories:
      - "/candle-binding"
      - "/onnx-binding"
    schedule:
      interval: "weekly"
  - package-ecosystem: "docker"
    directory: "/tools/docker"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 2. Add Coverage to Main Test Workflow (2-4 hours)
Add `--coverprofile` to `test-semantic-router` in `tools/make/build-run-test.mk`:
```makefile
test-semantic-router:
	cd src/semantic-router && CGO_ENABLED=1 go test -v -coverprofile=coverage.out $$(go list ./...)
```
Add codecov step to `test-and-build.yml`:
```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: src/semantic-router/coverage.out
    flags: semantic-router
```

### 3. Add HEALTHCHECK to Dockerfiles (1-2 hours)
Add to `tools/docker/Dockerfile.extproc`:
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:50051/health || exit 1
```

### 4. Create CLAUDE.md (1 hour)
Create a `CLAUDE.md` at repo root that references AGENTS.md, enabling Claude Code agent compatibility alongside the existing comprehensive agent documentation.

## Detailed Findings

### Unit Tests

**Score: 7.0/10**

**File Counts:**
| Language | Test Files | Source Files | Ratio |
|----------|-----------|--------------|-------|
| Go | 160 | 458 | 35% |
| Rust | 47 | 103 | 46% |
| Python | 19 | 170 | 11% |

**Frameworks Detected:**
- Go: standard `testing`, `testify` (assert/require), Ginkgo/Gomega (BDD-style)
- Rust: built-in `#[test]` framework, integration test examples
- Python: standard `unittest`, custom test base classes

**Strengths:**
- Strong Go test-to-code ratio (35%) with comprehensive package-level testing
- Excellent Rust coverage (46%) for the ML binding layer
- Mix of unit tests, table-driven tests, and BDD-style specs
- Test build tags (`-tags=milvus`) for conditional test execution
- testifylint in golangci-lint enforces testify best practices

**Gaps:**
- Python test ratio is low (11%) — training scripts, benchmark code, and mock servers lack tests
- No `t.Parallel()` usage observed in Go tests (sequential execution)
- No coverage generation in unit test targets

### Integration/E2E Tests

**Score: 9.0/10**

**E2E Profiles (18+):**
- `ai-gateway`, `aibrix`, `routing-strategies`, `dynamic-config`, `llm-d`, `istio`
- `production-stack`, `response-api`, `response-api-redis`, `response-api-redis-cluster`
- `ml-model-selection`, `multi-endpoint`, `authz-rbac`, `streaming`
- `rag-hybrid-search`, `dynamo`

**Infrastructure:**
- Kind cluster-based K8s E2E testing with `integration-test-k8s.yml`
- Dynamic profile matrix based on changed files (smart filtering)
- Helm chart lint + template validation via `integration-test-helm.yml`
- Memory integration tests with Milvus backend
- vllm-sr-cli integration tests
- Hallucination detection E2E pipeline
- Performance benchmarks with PR regression comments

**Python E2E Suites:**
- 11+ test files covering: client requests, Envoy extproc, router classification, classification API, cache, jailbreak detection, PII detection, router path selection, RAG, memory features, OpenAI API validation

**Strengths:**
- Comprehensive profile-based testing covers most deployment scenarios
- Smart CI filtering prevents unnecessary test runs
- `fail-fast: false` ensures all profiles run even if some fail
- Test artifacts (reports, logs) uploaded for debugging
- 75-minute timeout with proper cleanup

**Gaps:**
- No multi-version K8s testing (single Kind version)

### Build Integration

**Score: 8.0/10**

**PR-Time Validation:**
- Docker image builds for 6 variants: dashboard, extproc, extproc-rocm, llm-katan, vllm-sr, vllm-sr-rocm
- PR builds are amd64-only for fast feedback (multi-arch on push)
- Helm chart lint and template validation with required resource verification
- Operator CI: lint, unit tests, manifests, dry-run apply, Docker build

**Build Configuration:**
- Multi-stage Dockerfiles with dependency caching
- Cross-compilation for arm64 (avoids slow QEMU emulation)
- Rust library builds with `--no-default-features` (CPU-only, no CUDA for CI)
- Build caching via GitHub Actions cache

**Strengths:**
- PR-time Docker builds catch image build failures before merge
- Helm template validation verifies required K8s resources exist
- Operator CI validates CRD manifests and deployment dry-runs
- `make check-go-mod-tidy` prevents dependency drift

**Gaps:**
- No Konflux build simulation
- No operator bundle validation beyond dry-run

### Image Testing

**Score: 6.0/10**

**Dockerfiles (17+):**
- `tools/docker/Dockerfile.extproc` — Main extproc (multi-stage, cross-compiled)
- `tools/docker/Dockerfile.extproc-rocm` — ROCm variant
- `src/vllm-sr/Dockerfile` — vLLM-SR CLI image
- `dashboard/backend/Dockerfile` — Dashboard backend
- `deploy/operator/Dockerfile` — Operator (UBI-based)
- Various test/tool images

**Base Images:**
- Operator: `registry.access.redhat.com/ubi10/go-toolset` + `ubi10/ubi-minimal` (FIPS-capable)
- Extproc: `rust:1.90` builder → custom runtime
- Dashboard: `node:20-alpine` builder → `golang:1.24` builder → runtime
- Multi-arch: amd64 + arm64 manifest lists for main images

**Strengths:**
- Multi-stage builds reduce final image size
- Cross-compilation avoids slow QEMU emulation
- UBI base images for operator (Red Hat ecosystem)
- ROCm-specific builds for AMD GPU support

**Gaps:**
- No `HEALTHCHECK` directives in any Dockerfile
- No testcontainers or image startup validation
- No container security scanning in CI (note: out of scope per skill rules)
- Alpine base for dashboard frontend (not UBI)

### Coverage Tracking

**Score: 3.0/10**

**What Exists:**
- Operator CI (`operator-ci.yml`): `go test -coverprofile=coverage.out -covermode=atomic`
- Operator CI: `codecov/codecov-action@v4` uploads to Codecov

**What's Missing:**
- No `.codecov.yml` or `codecov.yml` configuration file
- No coverage thresholds or minimum gates
- No coverage in the main `test-and-build` workflow
- No Python coverage (`pytest-cov`)
- No Rust coverage (`cargo-tarpaulin` or `cargo-llvm-cov`)
- No PR coverage comments or diff coverage enforcement

**Impact:**
The operator (a relatively small component under `deploy/operator/`) is the only sub-project with coverage. The core router (458 Go files), 5 Rust binding crates, Python CLI (70+ files), and Python training/benchmark code have zero coverage tracking.

### CI/CD Automation

**Score: 9.0/10**

**Workflow Inventory (23 workflows):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test-and-build` | PR, push, schedule, dispatch | Core test + build |
| `pre-commit` | PR, push, dispatch | Lint, format, agent gate |
| `integration-test-k8s` | PR, push, dispatch | 18-profile K8s E2E |
| `integration-test-helm` | PR, push, dispatch | Helm lint + template |
| `integration-test-memory` | PR, dispatch | Memory + Milvus tests |
| `integration-test-vllm-sr-cli` | PR | CLI integration tests |
| `docker-publish` | PR, push, dispatch, call | Multi-arch Docker builds |
| `docker-release` | tag push | Release images |
| `operator-ci` | PR, push, tag | Operator lint/test/build |
| `performance-test` | PR, dispatch | Go benchmarks on PRs |
| `performance-nightly` | schedule | Nightly perf benchmarks |
| `dashboard-test` | PR | Dashboard frontend tests |
| `pre-commit` | PR, push | Pre-commit hooks |
| `helm-publish` | push, dispatch | Helm chart publishing |
| `pypi-publish` | tag, dispatch | Python package publish |
| `publish-crate` | tag, dispatch | Rust crate publish |
| `paper-build` | PR, push | LaTeX paper build |
| `ci-changes` | called | Path-based change detection |
| `owner-notification` | PR | CODEOWNERS notification |
| `anti-spam-filter` | issues, PR | Spam filtering |
| `cleanup-existing-spam` | dispatch | Spam cleanup |
| `issue-manager` | issues | Issue management |
| `check-translation-staleness` | schedule, dispatch | i18n staleness check |

**Strengths:**
- All workflows use `concurrency` groups with `cancel-in-progress: true`
- Extensive caching: Rust (cargo), Go (modules), Node (npm), pre-commit
- Smart path-based filtering via reusable `ci-changes.yml`
- Matrix strategies for E2E profiles and Docker image variants
- Nightly scheduled builds with auto-publish
- Performance regression detection on PRs with comment reporting
- Draft PR filtering (skips CI on draft PRs)
- Artifact uploads for debugging failed runs

**Gaps:**
- No retry mechanisms for flaky tests
- No test splitting/sharding beyond the profile matrix

### Static Analysis

**Score: 7.0/10**

**Linting:**
- **Go**: golangci-lint v2.5.0 with 12 linters enabled:
  - `bodyclose`, `copyloopvar`, `depguard`, `errorlint`, `gocritic`, `gosec`, `importas`, `misspell`, `revive`, `staticcheck`, `testifylint`, `unconvert`
  - Formatters: `gofumpt`, `gci`
  - Agent-specific lint config: `tools/linter/go/.golangci.agent.yml`
- **TypeScript/JavaScript**: ESLint for website and dashboard
- **Python**: Black formatter (no ruff, flake8, or mypy)
- **Rust**: `cargo fmt`, `cargo check` (via pre-commit)
- **Shell**: ShellCheck
- **YAML**: yamllint
- **Markdown**: markdownlint

**Pre-commit Hooks (`.pre-commit-config.yaml`):**
- trailing-whitespace, end-of-file-fixer, check-added-large-files (500KB limit)
- go fmt, golangci-lint, shellcheck
- markdown-lint, yaml-lint
- ESLint for JS/TS, cargo fmt + cargo check for Rust
- Black for Python
- Codespell (via Makefile)

**FIPS Compatibility:**
- `crypto/md5` used in `pkg/cache/redis_cache.go` and `pkg/cache/milvus_cache.go` (cache key generation)
- `math/rand` used in 8+ files for non-security purposes (selection algorithms, metrics, tests)
- gosec exclusions G404, G401, G501 document these as intentional
- No FIPS build tags (`//go:build boringcrypto`)
- No `GOEXPERIMENT=boringcrypto` in CI
- Operator Dockerfile uses UBI base (FIPS-capable runtime)

**Dependency Alerts:**
- **No Dependabot configuration** — `.github/dependabot.yml` is absent
- **No Renovate configuration** — no `renovate.json` or `.renovaterc`
- Five Go modules, two Cargo workspaces, Python dependencies, and Docker base images all lack automated update PRs

**Strengths:**
- Comprehensive golangci-lint with security-focused linters (gosec, depguard)
- Pre-commit hooks enforce formatting across all languages
- Agent-specific lint profiles for AI-generated code validation

**Gaps:**
- No Dependabot or Renovate for any ecosystem
- No Python type checker (mypy, pyright)
- No FIPS build variant in CI
- Black is the only Python quality tool (no ruff or flake8)

### Agent Rules

**Score: 9.0/10**

**AGENTS.md (Root):**
- Comprehensive entrypoint for coding agents
- References detailed documentation hierarchy
- Lists supported environments (cpu-local, amd-local, ci-k8s)
- Non-negotiable rules for contributions
- Canonical make commands for agent workflows

**docs/agent/ Directory (18+ files):**
- `README.md` — Primary entry point
- `repo-map.md` — Repository structure guide
- `environments.md` — Development environment setup
- `change-surfaces.md` — Impact analysis surfaces
- `architecture-guardrails.md` — Architecture boundaries
- `feature-complete-checklist.md` — Definition of done
- `testing-strategy.md` — Testing approach documentation
- `governance.md` — Agent governance model
- `module-boundaries.md` — Module responsibility rules
- `tech-debt/` — Tracked tech debt register
- `plans/` — Indexed execution plans
- `playbooks/` — Operational playbooks

**Executable Rule Layers (tools/agent/):**
- `repo-manifest.yaml` — Repository structure contract
- `task-matrix.yaml` — Task classification rules
- `skill-registry.yaml` — Agent skill definitions
- `structure-rules.yaml` — Structural constraints
- `e2e-profile-map.yaml` — E2E test profile mapping
- Python validation scripts for agent gate checks

**Make Targets:**
- `make agent-validate` — Validate agent compliance
- `make agent-scorecard` — Score agent output quality
- `make agent-lint` — Agent-specific linting
- `make agent-ci-gate` — CI gate checks
- `make agent-feature-gate` — Feature-specific validation
- `make agent-fast-gate` — Quick PR validation (runs in pre-commit CI)

**Gaps:**
- No `CLAUDE.md` at root (uses AGENTS.md instead, which is compatible with some but not all agent platforms)
- No `.claude/` directory or Claude-specific rules

## Recommendations

### Priority 0 (Critical)

1. **Add coverage tracking to main test workflow**
   - Add `--coverprofile=coverage.out` to `test-semantic-router` Make target
   - Add `codecov/codecov-action@v4` step to `test-and-build.yml`
   - Create `.codecov.yml` with minimum coverage thresholds
   - Effort: 4-6 hours

2. **Enable Dependabot across all ecosystems**
   - Create `.github/dependabot.yml` covering gomod, pip, cargo, docker, and github-actions
   - Configure weekly update schedule with appropriate labels
   - Effort: 1-2 hours

### Priority 1 (High Value)

3. **Add FIPS build variant**
   - Add CI job with `GOEXPERIMENT=boringcrypto` and `-tags=fips`
   - Evaluate `crypto/md5` usage in cache keys — consider SHA-256 alternative
   - Ensure UBI base images are used for all production images
   - Effort: 8-16 hours

4. **Add container runtime validation**
   - Add `HEALTHCHECK` directives to production Dockerfiles
   - Create startup validation tests (build image → run → health check → stop)
   - Consider testcontainers-based smoke tests for the Go E2E framework
   - Effort: 4-8 hours

5. **Improve Python test coverage**
   - Add tests for training scripts (`src/training/`)
   - Add tests for benchmark code (`bench/`)
   - Add `pytest-cov` for Python coverage reporting
   - Effort: 8-12 hours

### Priority 2 (Nice-to-Have)

6. **Add CLAUDE.md at repo root**
   - Reference AGENTS.md for detailed instructions
   - Enable Claude Code agent compatibility
   - Effort: 1 hour

7. **Add Python type checking**
   - Add `mypy` or `pyright` to pre-commit and CI
   - Start with strict mode on new files, gradual adoption for existing
   - Effort: 4-6 hours

8. **Add coverage thresholds and PR gates**
   - Configure codecov to require minimum coverage on new code
   - Add diff coverage checks to prevent coverage regression
   - Effort: 2-3 hours

9. **Add multi-version K8s testing**
   - Matrix the Kind version in E2E tests (e.g., K8s 1.28, 1.29, 1.30)
   - Effort: 2-4 hours

## Comparison to Gold Standards

| Practice | semantic-router | odh-dashboard | notebooks | kserve |
|----------|----------------|---------------|-----------|--------|
| Unit test ratio | 35% (Go) | ~30% | N/A | ~40% |
| E2E profiles | 18+ profiles | Multi-layer | Image tests | Multi-version |
| PR Docker builds | 6 image variants | Yes | Yes | Yes |
| Coverage tracking | Operator only | Codecov | Partial | Codecov enforced |
| Coverage thresholds | None | Yes | Partial | Yes |
| Dependabot | **Missing** | Yes | Yes | Yes |
| Pre-commit hooks | Comprehensive | Yes | Limited | Yes |
| FIPS compliance | No build tags | Partial | Image-level | Build tags |
| Agent rules | **Exceptional** | Good | None | None |
| CI workflows | 23 | ~10 | ~8 | ~15 |
| Multi-arch builds | amd64 + arm64 | amd64 | Multi-arch | amd64 |
| Performance tests | PR + nightly | No | No | Limited |
| Helm validation | Lint + template | N/A | N/A | Yes |

**Notable Distinction**: semantic-router's agent rules ecosystem (AGENTS.md + docs/agent/ + tools/agent/) is the most comprehensive in the RHOAI portfolio, with executable validation, scoring, and governance built into the CI pipeline. This is a gold-standard reference for other repositories.

## File Paths Reference

### CI/CD
- `.github/workflows/test-and-build.yml` — Main test workflow
- `.github/workflows/pre-commit.yml` — Pre-commit checks
- `.github/workflows/integration-test-k8s.yml` — K8s E2E (18+ profiles)
- `.github/workflows/integration-test-helm.yml` — Helm validation
- `.github/workflows/integration-test-memory.yml` — Memory integration
- `.github/workflows/docker-publish.yml` — Docker image builds
- `.github/workflows/operator-ci.yml` — Operator CI with codecov
- `.github/workflows/performance-test.yml` — PR performance benchmarks
- `.github/workflows/ci-changes.yml` — Change detection filter

### Testing
- `src/semantic-router/` — 160 Go test files
- `candle-binding/` — Rust binding tests + Go binding tests
- `onnx-binding/` — ONNX binding tests
- `nlp-binding/` — NLP binding tests
- `src/vllm-sr/tests/` — 10 Python CLI tests
- `e2e/testing/` — 11+ Python E2E test scripts
- `e2e/testcases/` — 50+ Go E2E test cases
- `e2e/profiles/` — 18+ test profiles
- `perf/benchmarks/` — Go benchmark tests
- `bench/` — Python benchmarks

### Build/Docker
- `tools/docker/Dockerfile.extproc` — Main extproc (cross-compiled, multi-arch)
- `tools/docker/Dockerfile.extproc-rocm` — ROCm variant
- `src/vllm-sr/Dockerfile` — CLI image
- `dashboard/backend/Dockerfile` — Dashboard
- `deploy/operator/Dockerfile` — Operator (UBI-based)
- `Makefile` → `tools/make/*.mk` — Build system

### Static Analysis
- `tools/linter/go/.golangci.yml` — 12 linters enabled
- `tools/linter/go/.golangci.agent.yml` — Agent-specific lint
- `.pre-commit-config.yaml` — Multi-language hooks
- `website/eslint.config.mjs` — Website ESLint
- `dashboard/frontend/eslint.config.js` — Dashboard ESLint

### Agent Rules
- `AGENTS.md` — Agent entrypoint
- `docs/agent/` — 18+ documentation files
- `tools/agent/` — Executable rule layers + validation scripts
- `tools/make/agent.mk` — Agent make targets
