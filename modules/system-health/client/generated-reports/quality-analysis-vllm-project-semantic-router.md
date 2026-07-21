---
repository: "vllm-project/semantic-router"
overall_score: 7.7
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Strong test-to-code ratio (0.55 Go, 0.26 Python) with testify, ginkgo, vitest, and playwright"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Comprehensive E2E suite with 90+ test cases, profile-based Kind clusters, and matrix CI"
  - dimension: "Build Integration"
    score: 7.0
    status: "Helm validation, operator bundle/deploy on PRs, but no PR-time Docker image build"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage, multi-arch Dockerfiles; Kind deployment validates images implicitly"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "Codecov only for operator module; main router and Python have no coverage tracking"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "35 workflows, concurrency control, caching, matrix strategies, Mergify merge queue"
  - dimension: "Static Analysis"
    score: 7.0
    status: "14-linter golangci-lint, extensive pre-commit hooks, but no Dependabot/Renovate"
  - dimension: "Agent Rules"
    score: 10.0
    status: "Best-in-class CLAUDE.md, AGENTS.md, skill registry, task matrix, and agent harness"
critical_gaps:
  - title: "No coverage tracking for main semantic-router module"
    impact: "578 Go test files run without coverage measurement; regressions in coverage go undetected"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No Dependabot or Renovate for dependency alerts"
    impact: "Vulnerable or outdated dependencies across Go, Rust, Python, and npm ecosystems go untracked"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No PR-time Docker image build validation"
    impact: "Dockerfile breakage discovered only at nightly build or release time, not during PR review"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "math/rand usage in routing-critical code paths"
    impact: "Non-cryptographic PRNG in selection/routing code; FIPS compliance concern for downstream"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Enable Dependabot for Go, Python, npm, Rust, and Docker ecosystems"
    effort: "1-2 hours"
    impact: "Automated dependency update PRs and vulnerability alerts across all ecosystems"
  - title: "Add --coverprofile to make test for src/semantic-router"
    effort: "2-3 hours"
    impact: "Coverage visibility for 578 Go test files in the core router module"
  - title: "Add codecov.yml with coverage thresholds"
    effort: "1-2 hours"
    impact: "Prevent coverage regressions with PR-blocking gates"
  - title: "Replace math/rand with crypto/rand in security-adjacent code"
    effort: "2-3 hours"
    impact: "FIPS compliance readiness for downstream Red Hat builds"
recommendations:
  priority_0:
    - "Add coverage tracking for src/semantic-router with Codecov integration and threshold enforcement"
    - "Enable Dependabot across all ecosystems (gomod, pip, npm, cargo, docker)"
  priority_1:
    - "Add PR-time Docker image build smoke test to validate Dockerfile changes before merge"
    - "Audit and replace math/rand usage in routing/selection code with crypto/rand for FIPS readiness"
    - "Extend Codecov to Python test suites (bench, vllm-sr, fleet-sim) with pytest-cov"
  priority_2:
    - "Add HEALTHCHECK instructions to remaining production Dockerfiles"
    - "Increase t.Parallel() adoption across Go test suites for faster CI execution"
    - "Add UBI base images for main router Dockerfile to match operator's FIPS-ready posture"
---

# Quality Analysis: vllm-project/semantic-router

## Executive Summary

- **Overall Score: 7.7/10**
- **Repository Type**: Multi-language service (Go primary, Python, Rust, TypeScript)
- **Purpose**: Intelligent request router for LLM inference (Envoy ExtProc filter)
- **RHOAI Component**: Inference Gateway (upstream tier)
- **Key Strengths**: Exceptional E2E test infrastructure with profile-based Kind clusters, best-in-class agent rules and developer harness, comprehensive CI/CD with 35 workflows
- **Critical Gaps**: No coverage tracking for the core router module, no dependency alert automation (Dependabot/Renovate), math/rand usage in routing paths
- **Agent Rules Status**: Present and comprehensive (CLAUDE.md + AGENTS.md + skill registry + task matrix)

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8/10 | 15% | 1.20 | Strong test-to-code ratio with multi-framework support |
| Integration/E2E | 9/10 | 20% | 1.80 | 90+ E2E test cases with profile-based Kind cluster testing |
| Build Integration | 7/10 | 15% | 1.05 | Helm + operator manifest validation on PRs |
| Image Testing | 7/10 | 10% | 0.70 | Multi-stage, multi-arch builds; implicit E2E image validation |
| Coverage Tracking | 4/10 | 10% | 0.40 | Codecov for operator only; core module uncovered |
| CI/CD Automation | 9/10 | 15% | 1.35 | 35 workflows, Mergify, caching, concurrency, matrix strategies |
| Static Analysis | 7/10 | 10% | 0.70 | 14-linter golangci-lint, extensive pre-commit hooks |
| Agent Rules | 10/10 | 5% | 0.50 | Best-in-class CLAUDE.md, AGENTS.md, and agent harness |
| **Overall** | **7.7/10** | **100%** | **7.70** | |

## Critical Gaps

### 1. No Coverage Tracking for Core Router Module
- **Impact**: The `src/semantic-router/` module contains 578 Go test files and 1047 source files but runs without `--coverprofile`. Coverage regressions in the most critical module go completely undetected.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Current State**: Only `deploy/operator/` has `codecov/codecov-action` integration. The main `make test` target in `test-and-build.yml` generates no coverage data.

### 2. No Dependency Alert Automation
- **Impact**: The repository has dependencies across 5 ecosystems (Go modules, Python pip, npm, Rust Cargo, Docker base images) with no automated vulnerability or update alerts. Vulnerable transitive dependencies may persist undetected.
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Current State**: No `.github/dependabot.yml`, no `renovate.json` or `.renovaterc`.

### 3. No PR-Time Docker Image Build
- **Impact**: The `test-and-build.yml` workflow validates Go/Rust builds and Helm charts but does not build any Docker images. Dockerfile breakage (e.g., in `Dockerfile.extproc`, `Dockerfile.rocm`, or `Dockerfile.cuda`) is only caught by nightly builds or manual dispatch.
- **Severity**: MEDIUM
- **Effort**: 4-8 hours

### 4. math/rand in Routing-Critical Paths
- **Impact**: `math/rand` and `math/rand/v2` are used in `src/semantic-router/pkg/selection/` (rl_driven.go, pomdp_solver.go) and `pkg/observability/metrics/`. While the code comments note concurrency safety, `math/rand` is not FIPS-compliant. Python code uses `hashlib.md5` for cache keys.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours

## Quick Wins

### 1. Enable Dependabot (1-2 hours)
Create `.github/dependabot.yml` covering all ecosystems:
```yaml
version: 2
updates:
  - package-ecosystem: "gomod"
    directory: "/src/semantic-router"
    schedule:
      interval: "weekly"
  - package-ecosystem: "gomod"
    directory: "/deploy/operator"
    schedule:
      interval: "weekly"
  - package-ecosystem: "gomod"
    directory: "/e2e"
    schedule:
      interval: "weekly"
  - package-ecosystem: "pip"
    directory: "/src/vllm-sr"
    schedule:
      interval: "weekly"
  - package-ecosystem: "npm"
    directory: "/dashboard/frontend"
    schedule:
      interval: "weekly"
  - package-ecosystem: "cargo"
    directory: "/candle-binding"
    schedule:
      interval: "weekly"
  - package-ecosystem: "docker"
    directory: "/tools/docker"
    schedule:
      interval: "monthly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 2. Add Coverage to Core Router Tests (2-3 hours)
Update `make test` target in `tools/make/golang.mk` to include `--coverprofile=coverage.out` and add `codecov/codecov-action` step to `test-and-build.yml`.

### 3. Add codecov.yml with Thresholds (1-2 hours)
```yaml
coverage:
  status:
    project:
      default:
        target: auto
        threshold: 2%
    patch:
      default:
        target: 80%
comment:
  layout: "reach, diff, flags"
  behavior: default
```

### 4. Replace math/rand in Security Paths (2-3 hours)
Audit `math/rand` imports in `src/semantic-router/pkg/selection/` and `pkg/observability/metrics/`. Replace with `crypto/rand` where the PRNG feeds security-relevant decisions. `hashlib.md5` in Python training scripts is low-risk but should be documented.

## Detailed Findings

### Unit Tests

**Score: 8/10**

| Metric | Value |
|--------|-------|
| Go test files | 578 |
| Go source files | 1,047 |
| Go test-to-code ratio | 0.55 |
| Python test files | 88 |
| Python source files | 340 |
| Python test-to-code ratio | 0.26 |
| Dashboard test files | 106 (vitest + playwright) |
| Rust test files | 2 (+ inline test modules) |
| Total test files | 745+ |

**Frameworks detected**:
- **Go**: testify (assertions), ginkgo/gomega (BDD-style), standard `testing` package
- **TypeScript/JavaScript**: Vitest (unit), Playwright (E2E)
- **Python**: pytest (via bench/ and src/vllm-sr/)
- **Rust**: built-in `#[cfg(test)]` + `candle-binding/tests/`

**Strengths**:
- Excellent Go test-to-code ratio (0.55)
- 135 files use `t.Run` for structured subtests
- Multiple test frameworks used appropriately per language
- Dashboard has strong unit + E2E coverage (106 test files)

**Gaps**:
- Only 7 files use `t.Parallel()` for concurrent test execution
- No formalized test isolation patterns documented

### Integration/E2E Tests

**Score: 9/10**

**E2E Infrastructure**:
- Dedicated `e2e/` directory: 148 Go files + 47 Python files
- 90+ test cases covering: chat completions, PII detection, jailbreak detection, caching, streaming, dashboard, operator, Istio, MCP, RAG, authz/RBAC, response API, and more
- Profile-based execution: kubernetes, dashboard, remote-embedding, istio, agentgateway, aibrix, llm-d, routing-strategies, production-stack, dynamic-config, ml-model-selection, multi-endpoint, authz-rbac, streaming

**CI Integration**:
- `integration-test-k8s.yml`: PR-triggered with Kind cluster, matrix across profiles, 90-minute timeout
- `integration-test-memory.yml`: PR-triggered for memory subsystem changes
- `integration-test-vllm-sr-cli.yml`: PR-triggered for CLI validation
- `operator-ci.yml`: manifest verification, unit tests, Kind cluster deployment, controller tests

**Strengths**:
- Profile-based test matrix allows targeted E2E runs based on file changes
- Kind cluster integration with real Kubernetes deployments
- Change detection (ci-changes.yml) ensures relevant tests run
- Log collection and artifact upload for debugging failures

**Gaps**:
- Some stress tests temporarily disabled in CI
- No multi-version Kubernetes testing (single K8s version: v1.29.2)

### Build Integration

**Score: 7/10**

**PR Build Validation**:
- `test-and-build.yml`: Go build, Rust build (`make rust-ci`), Helm chart validation
- `operator-ci.yml`: `make bundle`, `make deploy IMG=...`, `go vet`, `go build`
- Operator manifests verified on PRs with `make bundle` diff check
- Helm CI validation: `make helm-ci-validate`

**Integration Testing on PRs**:
- Kind cluster deployment in `integration-test-k8s.yml`
- `kubectl apply` for Gateway API CRDs, operator deployment
- E2E test binary built and run in cluster

**Strengths**:
- Operator bundle verification catches manifest drift
- Helm chart validation prevents chart regressions
- Kind-based integration testing deploys and validates the full stack

**Gaps**:
- No Docker image build in `test-and-build.yml` (nightly/dispatch only)
- No Konflux build simulation
- Dockerfile changes not validated until nightly or manual trigger

### Image Testing

**Score: 7/10**

**Dockerfiles**: 20+ across the repository
- `tools/docker/Dockerfile`: Main development image (CentOS Stream 10)
- `tools/docker/Dockerfile.extproc`: Production multi-arch image (cross-compiled)
- `tools/docker/Dockerfile.extproc-rocm`: AMD ROCm variant
- `src/vllm-sr/Dockerfile`: CLI image (Debian Bookworm)
- `src/vllm-sr/Dockerfile.cuda`: NVIDIA CUDA variant
- `src/vllm-sr/Dockerfile.rocm`: AMD ROCm variant
- `deploy/operator/Dockerfile`: Operator image (UBI 10)
- `dashboard/backend/Dockerfile`: Dashboard image (multi-stage)

**Multi-Architecture**:
- `docker-publish.yml` builds for `linux/amd64` and `linux/arm64`
- Cross-compilation in `Dockerfile.extproc` to avoid QEMU emulation
- Docker Buildx and QEMU setup in CI

**Strengths**:
- Extensive multi-stage builds across all Dockerfiles
- Cross-compilation optimization reduces arm64 build time
- Operator uses UBI base images (FIPS-capable)
- .dockerignore present for build context optimization

**Gaps**:
- Only 2 Dockerfiles have HEALTHCHECK instructions
- No Testcontainers usage for image validation
- Main router Dockerfile uses CentOS Stream 10 (not UBI, not FIPS-ready)
- No explicit image startup validation in CI

### Coverage Tracking

**Score: 4/10**

**Current State**:
- `operator-ci.yml`: `go test -coverprofile=coverage.out -covermode=atomic` with `codecov/codecov-action@v4`
- No `.codecov.yml` configuration file
- No coverage threshold enforcement
- No coverage for `src/semantic-router/` (the main module with 578 test files)
- No Python coverage (pytest-cov)
- No JavaScript/TypeScript coverage (Vitest c8/istanbul)

**Strengths**:
- Operator module has Codecov integration with atomic coverage mode

**Gaps**:
- Core router module (most critical code) has zero coverage tracking
- No coverage gates on PRs
- No coverage trend tracking or minimum thresholds
- Python and TypeScript test suites have no coverage instrumentation

### CI/CD Automation

**Score: 9/10**

**Workflow Inventory** (35 workflows):

| Category | Workflows |
|----------|-----------|
| PR Testing | test-and-build, pre-commit, integration-test-k8s, integration-test-memory, integration-test-vllm-sr-cli, operator-ci, dashboard-test, openvino-binding-ci, performance-test, helm-publish, router-learning-eval |
| Quality Gates | check-linked-issue, anti-spam-filter, skill-review |
| Publishing | docker-publish, docker-release, pypi-publish, pypi-publish-vllm-sr-sim, publish-crate, precommit-publish, release |
| Scheduled | nightly-build, performance-nightly, check-translation-staleness, stale, contributor-leaderboard, maintainer-board |
| Maintenance | cleanup-existing-spam, owner-notification, issue-manager |
| Documentation | paper-build |
| Reusable | ci-changes |

**Automation Patterns**:
- **Concurrency control**: 18/35 workflows use `concurrency:` with `cancel-in-progress`
- **Caching**: 17+ `actions/cache@v4` usage across Go, Rust, npm, and model caches
- **Matrix strategies**: Integration tests across profiles, multi-arch Docker builds
- **Change detection**: `ci-changes.yml` reusable workflow filters test scope by changed files
- **Merge queue**: Mergify integration with required checks
- **Timeouts**: Consistently configured (30-120 minutes)

**Strengths**:
- Extremely comprehensive workflow coverage
- Smart change-based filtering reduces unnecessary CI runs
- Mergify merge queue prevents broken merges
- Nightly builds + scheduled jobs for ongoing validation
- Artifact upload on failures for debugging

**Gaps**:
- Performance nightly is commented out (disabled)
- No deployment pipeline (expected for upstream)

### Static Analysis

**Score: 7/10**

**Linting**:
- **Go**: `golangci-lint` v2.5.0 with 14 linters enabled: bodyclose, copyloopvar, depguard, errorlint, gocritic, gosec, importas, misspell, revive, staticcheck, testifylint, unconvert
- **Agent-specific lint**: Additional `.golangci.agent.yml` with cyclop, funlen, gocognit, interfacebloat, nestif complexity checks
- **TypeScript/JavaScript**: ESLint for website, lint in pre-commit
- **Python**: Black formatter (no type checking — mypy, pyright, or ruff not configured)
- **Rust**: `cargo fmt` + `cargo check`
- **Shell**: shellcheck
- **Markdown**: markdownlint
- **YAML**: yaml-lint
- **Tools directory**: `tools/linter/` with configs for codespell, go, markdown, python, shellcheck, yaml

**Pre-commit Hooks** (11 hooks):
- Basic: trailing-whitespace, end-of-file-fixer, check-added-large-files
- Language-specific: go-fmt, shellcheck, golang-lint, md-fmt, yaml-lint, js-ts-lint, cargo-fmt, cargo-check, black
- Security: supply chain security scan (AST-based, tree-sitter)
- Agent: changed-files lint gate

**FIPS Compatibility**:
- `math/rand` usage in `src/semantic-router/pkg/selection/` (rl_driven.go, pomdp_solver.go) and `pkg/observability/metrics/`
- `math/rand/v2` in `pkg/looper/remom_distribution.go`
- `hashlib.md5` in 2 Python training scripts
- No FIPS build tags (`-tags=fips`, `GOEXPERIMENT=boringcrypto`)
- Operator uses UBI 10 base images (FIPS-capable), but main router uses CentOS Stream 10
- `CGO_ENABLED=1` in OpenVINO binding CI (required for cgo, not FIPS-specific)

**Dependency Alerts**: None configured (no Dependabot, no Renovate)

**Strengths**:
- Comprehensive multi-language linting through pre-commit
- golangci-lint with a well-curated set of 14 linters
- Agent-specific complexity linting is innovative
- AST-based supply chain security scanning in pre-commit

**Gaps**:
- No Dependabot or Renovate for dependency vulnerability alerts
- No Python type checking (mypy/pyright/ruff)
- No FIPS build tags for downstream compatibility
- `math/rand` in security-adjacent routing code

### Agent Rules

**Score: 10/10**

**Files Present**:
- `CLAUDE.md` (4,850 bytes): Comprehensive repository overview, subsystem map, development workflow, validation commands, testing instructions, linting, commit structure, architecture rules, hotspot directories, agent harness reference
- `AGENTS.md` (6,254 bytes): Agent entry point with read-first hierarchy, native discovery, supported environments, non-negotiable rules, canonical commands, rule layers
- `.agents/skills/harness/SKILL.md`: Bridge skill for agent harness
- `tools/agent/`: Full agent harness with repo-manifest.yaml, task-matrix.yaml, skill-registry.yaml, structure-rules.yaml, maintainer-policy.yaml
- `docs/agent/`: Extensive agent documentation (README.md, repo-map.md, environments.md, change-surfaces.md, architecture-guardrails.md, feature-complete-checklist.md, maintainer-ops.md)
- Local `AGENTS.md` files in hotspot directories

**Quality Assessment**:
- **Comprehensive**: Covers all test types, development workflows, validation gates
- **Actionable**: Specific `make` commands with escalation path (validate → lint → ci-gate → pr-gate → feature-gate)
- **Framework-specific**: Tailored to Go (golangci-lint, go test), Rust (cargo), Python (black), and the E2E framework
- **Up-to-date**: References current tooling versions (Go 1.25, Rust 1.90)
- **Multi-layer**: Entry → navigation → architecture → testing → executable contract

**Strengths**:
- This is the most comprehensive agent rules setup I've seen in any analyzed repository
- Executable rule layer in YAML (repo-manifest, task-matrix, skill-registry)
- Progressive validation gates (smallest → largest)
- Commit trajectory guidance for structured PR reviews
- Hotspot directories identified with local override rules

## Recommendations

### Priority 0 (Critical)

1. **Add coverage tracking for `src/semantic-router/`** — This is the most impactful gap. The core router module has 578 test files that run without coverage measurement. Add `--coverprofile` to the `make test` target and integrate `codecov/codecov-action` in `test-and-build.yml`. Create `.codecov.yml` with patch coverage thresholds to prevent regressions.

2. **Enable Dependabot** — Create `.github/dependabot.yml` covering gomod (3 modules), pip, npm, cargo, docker, and github-actions ecosystems. This is a 1-2 hour task that provides automated vulnerability alerts and dependency update PRs across all 5 language ecosystems.

### Priority 1 (High Value)

3. **Add PR-time Docker image build smoke test** — Add a lightweight Docker build step to `test-and-build.yml` that builds the main `Dockerfile.extproc` (or at minimum validates it with `docker build --target go-builder`) to catch Dockerfile breakage before merge.

4. **Audit math/rand usage for FIPS compliance** — The `src/semantic-router/pkg/selection/` package uses `math/rand` and `math/rand/v2` for routing decisions. For downstream FIPS compliance, replace with `crypto/rand` or add explicit documentation that these are non-security random selections.

5. **Extend coverage to Python test suites** — Add `pytest-cov` to the Python test configurations (`bench/`, `src/vllm-sr/`, `src/fleet-sim/`) and integrate coverage reporting into the appropriate CI workflows.

### Priority 2 (Nice-to-Have)

6. **Add HEALTHCHECK to production Dockerfiles** — Only 2/20+ Dockerfiles have HEALTHCHECK. Add health check instructions to `Dockerfile.extproc`, `Dockerfile`, and `dashboard/backend/Dockerfile`.

7. **Increase t.Parallel() adoption** — Only 7 Go test files use `t.Parallel()`. Increasing parallel test execution could significantly reduce CI time for the 578 Go test files.

8. **Consider UBI base images for main router** — The operator already uses `registry.access.redhat.com/ubi10/ubi-minimal`, but the main router uses CentOS Stream 10. For downstream FIPS readiness, consider UBI base images.

9. **Add Python type checking** — Black is configured for formatting, but no type checker (mypy, pyright, or ruff) is configured. Adding type checking for the Python CLI and training code would catch type errors early.

10. **Multi-version Kubernetes testing** — The E2E integration tests use a single K8s version (v1.29.2). Adding matrix testing across multiple K8s versions would improve compatibility confidence.

## Comparison to Gold Standards

| Practice | semantic-router | odh-dashboard | notebooks | kserve |
|----------|----------------|---------------|-----------|--------|
| Test-to-code ratio | 0.55 (Go) | ~0.4 | ~0.3 | ~0.5 |
| E2E automation | Profile-based Kind | Cypress/Playwright | Image validation | Ginkgo E2E |
| Coverage enforcement | Operator only | PR gates | Per-image | Threshold gates |
| CI/CD workflows | 35 workflows | ~20 workflows | ~15 workflows | ~25 workflows |
| Concurrency control | 18/35 workflows | Yes | Yes | Yes |
| Dependabot/Renovate | None | Dependabot | Dependabot | Dependabot |
| Pre-commit hooks | 11 hooks | Limited | None | Limited |
| Agent rules | Best-in-class | CLAUDE.md | None | None |
| FIPS build tags | None | N/A | UBI + tags | N/A |
| Multi-arch builds | amd64 + arm64 | N/A | Multi-arch | Limited |

## File Paths Reference

### CI/CD
- `.github/workflows/test-and-build.yml` — Main PR test and build workflow
- `.github/workflows/integration-test-k8s.yml` — Kubernetes E2E integration tests
- `.github/workflows/integration-test-memory.yml` — Memory subsystem integration tests
- `.github/workflows/integration-test-vllm-sr-cli.yml` — CLI integration tests
- `.github/workflows/operator-ci.yml` — Operator unit tests, lint, manifests, Kind testing
- `.github/workflows/dashboard-test.yml` — Dashboard unit and E2E tests
- `.github/workflows/docker-publish.yml` — Multi-arch Docker image publishing
- `.github/workflows/pre-commit.yml` — Pre-commit hook validation
- `.github/workflows/ci-changes.yml` — Reusable change detection workflow
- `.mergify.yml` — Merge queue configuration

### Testing
- `src/semantic-router/` — 578 Go test files (core router tests)
- `e2e/` — 148 Go + 47 Python E2E test files
- `e2e/testcases/` — 90+ individual E2E test case files
- `e2e/profiles/` — 15+ E2E test profiles (kubernetes, dashboard, istio, etc.)
- `bench/` — Performance benchmark tests
- `src/vllm-sr/tests/` — Python CLI tests
- `dashboard/frontend/tests/` — Vitest unit tests
- `dashboard/frontend/e2e/` — Playwright E2E tests
- `candle-binding/tests/` — Rust binding tests

### Static Analysis
- `tools/linter/go/.golangci.yml` — Primary golangci-lint configuration (14 linters)
- `tools/linter/go/.golangci.agent.yml` — Agent-specific complexity lint config
- `.pre-commit-config.yaml` — 11 pre-commit hooks across all languages
- `tools/linter/` — Linter configs for codespell, go, markdown, python, shellcheck, yaml

### Container Images
- `tools/docker/Dockerfile` — Main development image (CentOS Stream 10)
- `tools/docker/Dockerfile.extproc` — Production multi-arch image
- `tools/docker/Dockerfile.extproc-rocm` — AMD ROCm variant
- `deploy/operator/Dockerfile` — Operator image (UBI 10)
- `src/vllm-sr/Dockerfile` — CLI image
- `.dockerignore` — Build context exclusions

### Agent Rules
- `CLAUDE.md` — Claude Code instructions and repo overview
- `AGENTS.md` — Agent entry point and rule layers
- `.agents/skills/harness/SKILL.md` — Agent harness bridge skill
- `tools/agent/repo-manifest.yaml` — Repository manifest
- `tools/agent/task-matrix.yaml` — Task routing matrix
- `tools/agent/skill-registry.yaml` — Skill registry
- `tools/agent/structure-rules.yaml` — Structure rules
- `docs/agent/` — Comprehensive agent documentation
