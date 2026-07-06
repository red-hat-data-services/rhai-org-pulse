---
repository: "opendatahub-io/semantic-router"
overall_score: 7.9
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Excellent coverage with 160 Go test files, 34 Rust tests, 19 Python tests, 11 TS specs across a polyglot codebase"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Outstanding E2E framework with 18 profiles, Kind-based K8s testing, matrix-based change detection"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time Docker builds for dashboard and images, multi-arch via buildx, but no Konflux simulation"
  - dimension: "Image Testing"
    score: 6.5
    status: "18 Dockerfiles with multi-stage builds and multi-arch support, but no runtime validation or vulnerability scanning"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "Coverage only for operator (Codecov); no coverage for core Go, Rust, Python, or TypeScript packages"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "25 workflows with smart path-based filtering, concurrency control, caching, performance benchmarks on PRs"
  - dimension: "Agent Rules"
    score: 9.5
    status: "Best-in-class agent harness with AGENTS.md, skill registry, task matrix, e2e profile map, architecture guardrails"
critical_gaps:
  - title: "No coverage tracking for core packages"
    impact: "Cannot measure or enforce test coverage for 458 Go source files, 116 Rust files, or 170 Python files"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container vulnerability scanning"
    impact: "18 Docker images built without Trivy/Snyk scanning; vulnerabilities reach production undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No SAST/CodeQL integration"
    impact: "No static application security testing despite handling PII, auth tokens, and security-sensitive classification"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No image runtime validation in CI"
    impact: "Container images built but not smoke-tested for startup; failures caught only in E2E or production"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add Trivy scanning to docker-publish workflow"
    effort: "1-2 hours"
    impact: "Detect CVEs in all 18 Docker images before they reach registries"
  - title: "Enable CodeQL analysis"
    effort: "1-2 hours"
    impact: "Catch security vulnerabilities in Go, Python, and TypeScript code automatically"
  - title: "Add -coverprofile to test-semantic-router target"
    effort: "1-2 hours"
    impact: "Start tracking test coverage for the core Go package (458 source files)"
  - title: "Add SBOM generation to docker-publish"
    effort: "1-2 hours"
    impact: "Supply chain transparency for all published container images"
recommendations:
  priority_0:
    - "Add coverage tracking across all languages (Go, Rust, Python, TypeScript) with Codecov integration and enforcement thresholds"
    - "Add container vulnerability scanning (Trivy) to docker-publish and PR build workflows"
    - "Enable CodeQL or Semgrep for SAST across Go, Python, and TypeScript"
  priority_1:
    - "Add image runtime startup validation (health check probe) for all Dockerfiles in CI"
    - "Add SBOM generation and image signing (cosign) to the container publishing pipeline"
    - "Add secret detection (Gitleaks) to pre-commit and CI"
  priority_2:
    - "Add contract tests for the OpenAI-compatible API boundaries"
    - "Add chaos engineering tests for Envoy extproc resilience"
    - "Add accessibility testing for the dashboard frontend"
---

# Quality Analysis: semantic-router (opendatahub-io)

## Executive Summary

- **Overall Score: 7.9/10**
- **Repository Type**: Polyglot platform (Go + Rust + Python + TypeScript) — AI-powered semantic routing system with Envoy external processor, Kubernetes operator, dashboard, and ML bindings
- **Key Strengths**: Exceptional E2E testing infrastructure (18 profiles, Kind-based, matrix-driven), best-in-class agent rules harness, comprehensive CI with 25 workflows, strong pre-commit hooks, active performance benchmarking on PRs
- **Critical Gaps**: No coverage tracking for core packages, no container vulnerability scanning, no SAST/CodeQL integration
- **Agent Rules Status**: **Exemplary** — AGENTS.md, docs/agent/ directory with testing strategy, architecture guardrails, skill registry, task matrix, e2e profile map, and feature-complete checklist

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | 160 Go, 34 Rust, 19 Python, 11 TS test files with strong test-to-code ratios |
| Integration/E2E | 9.0/10 | 18 E2E profiles with Kind clusters, matrix-based path filtering, comprehensive test reports |
| Build Integration | 7.0/10 | PR-time Docker builds, multi-arch (amd64/arm64), but no Konflux simulation |
| Image Testing | 6.5/10 | 18 multi-stage Dockerfiles but no runtime validation or vulnerability scanning |
| Coverage Tracking | 4.0/10 | Only operator has Codecov; core Go/Rust/Python/TS have zero coverage tracking |
| CI/CD Automation | 9.0/10 | 25 workflows, smart path filters, concurrency control, caching, perf benchmarks on PRs |
| Agent Rules | 9.5/10 | Best-in-class: AGENTS.md, skill registry, task matrix, architecture guardrails, testing strategy |

## Critical Gaps

### 1. No Coverage Tracking for Core Packages
- **Impact**: Cannot measure or enforce test coverage for the main codebase (458 Go source files, 116 Rust files, 170 Python files, 258 TypeScript files)
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The `test-semantic-router` Make target runs `go test -v` without `-coverprofile`. Only `deploy/operator` generates coverage and uploads to Codecov. The core router, candle-binding, dashboard backend, and all Python/TypeScript code lack coverage tracking entirely.
- **Recommendation**: Add `-coverprofile=coverage.out -covermode=atomic` to `test-semantic-router`, add Codecov upload steps to `test-and-build.yml`, and configure thresholds.

### 2. No Container Vulnerability Scanning
- **Impact**: 18 Docker images are built and published without any vulnerability scanning. CVEs in base images (CentOS Stream 10, UBI 10) or dependencies could reach production.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Trivy, Snyk, or Grype configuration found. The `docker-publish.yml` workflow builds and pushes images but performs no security scanning. No `.trivyignore` or security scanning config exists.
- **Recommendation**: Add Trivy scanning step after each image build in `docker-publish.yml`.

### 3. No SAST/CodeQL Integration
- **Impact**: Security-sensitive code (PII detection, jailbreak classification, auth middleware, rate limiting) lacks automated security analysis.
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: No CodeQL, gosec CI workflow, Semgrep, or equivalent found. The `golangci-lint` config includes `gosec` as a linter rule, which provides some coverage for Go, but there's no dedicated SAST for Python or TypeScript.

### 4. No Image Runtime Validation
- **Impact**: Container images are built but never smoke-tested for startup in the build pipeline. Startup failures are only caught in E2E tests or production.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: The `docker-publish.yml` builds images but doesn't run them to verify they start correctly. A basic health check probe would catch many runtime issues.

## Quick Wins

### 1. Add Trivy Scanning to Docker Publish (1-2 hours)
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.IMAGE_NAME }}:${{ env.IMAGE_TAG }}
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
```

### 2. Enable CodeQL Analysis (1-2 hours)
```yaml
name: "CodeQL"
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'
jobs:
  analyze:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        language: ['go', 'python', 'javascript']
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

### 3. Add Coverage to Core Tests (1-2 hours)
In `tools/make/build-run-test.mk`, change `test-semantic-router`:
```makefile
test-semantic-router:
	cd src/semantic-router && CGO_ENABLED=1 go test -v -coverprofile=../../coverage.out -covermode=atomic $$(go list ./...)
```

### 4. Add SBOM Generation (1-2 hours)
```yaml
- name: Generate SBOM
  uses: anchore/sbom-action@v0
  with:
    image: ${{ env.IMAGE_NAME }}:${{ env.IMAGE_TAG }}
    format: spdx-json
```

## Detailed Findings

### CI/CD Pipeline

**Strengths:**
- **25 GitHub Actions workflows** — one of the most comprehensive CI setups observed
- **Smart path-based filtering** via reusable `ci-changes.yml` workflow with `dorny/paths-filter` — tests only run when relevant code changes (14+ path filters including per-E2E-profile granularity)
- **Concurrency control** on all major workflows (`cancel-in-progress: true`)
- **Aggressive caching** — Rust cargo, Go modules, model downloads, Node.js dependencies all cached
- **Performance benchmarks on PRs** — component benchmarks run on PR with results posted as PR comments
- **Nightly builds** — scheduled test runs at 2 AM UTC with Docker publishing
- **Draft PR skipping** — all test workflows skip draft PRs

**Workflows Inventory (25 total):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test-and-build.yml` | PR, push, nightly, manual | Core unit tests (Go + Rust) with Milvus & Redis |
| `integration-test-k8s.yml` | PR, push, manual | E2E tests via Kind clusters (18 profiles) |
| `integration-test-helm.yml` | PR, push, manual | Helm chart lint + template validation |
| `integration-test-memory.yml` | PR (path-filtered), manual | Memory feature integration with Milvus |
| `integration-test-vllm-sr-cli.yml` | PR, push, manual | CLI end-to-end tests |
| `dashboard-test.yml` | PR, push, manual | Dashboard lint, type-check, build |
| `operator-ci.yml` | PR, push (path-filtered) | Operator lint, unit tests with coverage, manifest verify |
| `performance-test.yml` | PR (path-filtered), manual | Component benchmarks with PR comments |
| `performance-nightly.yml` | Manual (cron commented out) | Nightly performance baseline |
| `pre-commit.yml` | PR, push, manual | Pre-commit hook enforcement |
| `docker-publish.yml` | Manual | Multi-arch Docker image builds |
| `docker-release.yml` | Push (tags) | Release image publishing |
| `helm-publish.yml` | PR, push, manual | Helm chart OCI publishing |
| `pypi-publish.yml` | Push (tags), manual | Python package publishing |
| `publish-crate.yml` | Push (tags), manual | Rust crate publishing |
| `precommit-publish.yml` | Push, PR | Pre-commit Docker image |
| `paper-build.yml` | PR, push | Academic paper PDF build |
| `anti-spam-filter.yml` | PR, PR comments | Content moderation |
| `cleanup-existing-spam.yml` | Manual | Spam cleanup utility |
| `check-translation-staleness.yml` | Daily, manual | Documentation translation freshness |
| `ci-changes.yml` | Reusable | Path-based change detection (14+ filters) |
| `issue-manager.yml` | Issues | Issue management automation |
| `owner-notification.yml` | PR target | Auto-assign reviewers from OWNER files |

**Areas for Improvement:**
- No Konflux build simulation on PRs
- No security scanning workflows (Trivy, CodeQL, Gitleaks)
- Performance nightly cron is commented out

### Test Coverage

**Go (Core):**
- 160 test files / 458 source files = **0.35 test-to-source ratio**
- Testing framework: Go standard `testing` package with testify assertions
- Tests span: classification, extproc, cache, memory, decision engine, config, vectorstore, API server, auth, rate limiting
- Integration tests with real Milvus and Redis in CI
- No coverage profiling enabled

**Rust (candle-binding):**
- 34 test files / 116 source files = **0.29 test-to-source ratio**
- Tests cover: classifiers (LoRA, traditional), FFI safety, tokenization, model architectures, embeddings
- `cargo check` and `cargo fmt` in pre-commit

**Python (vllm-sr, training, e2e):**
- 19 test files covering CLI, config, plugins, latency validation
- Black formatter enforced via pre-commit
- No pytest configuration or coverage tracking found

**TypeScript (dashboard frontend):**
- 11 spec/test files including Playwright E2E tests
- Playwright config for E2E (auth-flow, playground, model-inventory, ratings, etc.)
- 1 unit test file (hireclaw-prompt.test.mjs)
- ESLint + TypeScript type checking in CI

**Go (dashboard backend):**
- 18 test files covering handlers, auth, router, deploy
- Comprehensive test coverage for API endpoints

**Go (operator):**
- 5 test files covering controllers, webhooks, types validation
- Coverage with `-coverprofile` and Codecov upload
- envtest available in Makefile but not used in CI workflow directly

**Go (benchmarks):**
- 6 benchmark test files in `perf/benchmarks/`
- Classification, decision, cache, extproc, preference benchmarks
- Run on PRs with results posted as comments

### Code Quality

**Linting:**
- **golangci-lint v2.5.0** with 14 enabled linters including `gosec`, `staticcheck`, `errorlint`, `bodyclose`, `depguard`
- Separate agent-specific lint config (`.golangci.agent.yml`)
- **ESLint** for TypeScript/JavaScript
- **Black** (Python formatter) via pre-commit
- **shellcheck** for shell scripts
- **yamllint** for YAML files
- **markdown-lint** for documentation

**Pre-commit Hooks (11 hooks):**
- `trailing-whitespace`, `end-of-file-fixer`, `check-added-large-files` (500KB limit)
- `go fmt`, `go lint` (golangci-lint), `shellcheck`
- `md fmt`, `yaml/yml fmt`
- `js/ts lint` (ESLint)
- `cargo fmt`, `cargo check` (Rust)
- `black` (Python)

**Static Analysis:**
- gosec embedded in golangci-lint (Go only)
- No CodeQL, Semgrep, or dedicated SAST tool
- No dependency scanning (Dependabot/Renovate)
- No secret detection (Gitleaks/TruffleHog)

### Container Images

**18 Dockerfiles identified across:**
- `tools/docker/Dockerfile` — Main development image (CentOS Stream 10)
- `tools/docker/Dockerfile.extproc` — Envoy external processor
- `tools/docker/Dockerfile.extproc-rocm` — AMD ROCm variant
- `deploy/operator/Dockerfile` — Kubernetes operator (UBI 10 multi-stage)
- `dashboard/Dockerfile` & `dashboard/backend/Dockerfile` — Dashboard images
- `src/vllm-sr/Dockerfile` & `src/vllm-sr/Dockerfile.rocm` — vLLM-SR images
- `onnx-binding/Dockerfile.rocm` & `Dockerfile.fa-test` — ONNX/Flash Attention
- Various others for training, testing, mock services

**Multi-architecture support:**
- `docker-publish.yml` supports `linux/amd64` and `linux/arm64` via buildx
- Cross-compilation option available
- QEMU setup for cross-platform builds

**Gaps:**
- No vulnerability scanning on any images
- No SBOM generation
- No image signing (cosign)
- No runtime startup validation in CI
- No `.dockerignore` at repository root

### Security

**Current State:**
- gosec linter enabled for Go code (via golangci-lint)
- No dedicated security scanning workflows
- No container vulnerability scanning
- No dependency vulnerability scanning
- No secret detection in CI
- PII detection and jailbreak classification are security-critical features that would benefit from SAST

**Positive Security Practices:**
- Auth middleware with proper testing (`auth/handlers_test.go`, `auth/middleware_test.go`)
- RBAC testing (`test-authz-rbac.sh`, E2E profile `authz-rbac`)
- TLS testing (`tls_test.go`)
- PII policy testing (`pii/policy_test.go`)
- Jailbreak classifier testing
- User ID validation in production vs. dev modes

### Agent Rules (Agentic Flow Quality)

**Status**: **Exemplary (9.5/10)** — This is the most comprehensive agent harness observed across any analyzed repository.

**What exists:**
- `AGENTS.md` at root — Entry point for coding agents with non-negotiable rules, canonical commands, and rule layers
- `docs/agent/` — 20+ files including README, architecture guardrails, testing strategy, repo map, environments, governance, module boundaries, glossary, context management, feature-complete checklist, tech debt register, playbooks, plans
- `tools/agent/` — Executable rule layer with:
  - `repo-manifest.yaml` — Repository structure and conventions
  - `task-matrix.yaml` — Task selection and gate escalation rules
  - `skill-registry.yaml` (35KB) — Comprehensive skill definitions
  - `e2e-profile-map.yaml` — E2E test profile mapping
  - `structure-rules.yaml` — Code structure enforcement
  - `context-map.yaml` — Context dependency mapping
  - `scripts/` — Agent automation scripts
  - `skills/` (35 skills) — Reusable agent skills
- `tools/make/agent.mk` — Agent-specific Make targets (`agent-validate`, `agent-lint`, `agent-ci-gate`, `agent-feature-gate`, `agent-scorecard`)

**Quality Assessment:**
- Rules are comprehensive, actionable, and framework-specific
- Testing strategy covers validation ladder from harness-only to full E2E
- Architecture guardrails prevent module boundary violations
- Feature-complete checklist ensures done criteria
- Tech debt tracking integrated into agent workflow
- Multiple environment support (cpu-local, amd-local, ci-k8s)
- Per-directory AGENTS.md for hotspot trees

**Minor gap:** No `.claude/rules/` directory with per-test-type rules (e.g., `unit-tests.md`, `e2e-tests.md`), though the `docs/agent/testing-strategy.md` and skill registry cover this functionally.

### Performance Testing

**Strong Practices:**
- Dedicated `performance-test.yml` workflow triggered on PRs
- Component benchmarks (classification, decision, cache, extproc, preference)
- Results posted as PR comments for regression detection
- `performance-nightly.yml` for baseline tracking (currently disabled)
- Model caching across runs
- Separate `perf/` directory with benchmark infrastructure

## Recommendations

### Priority 0 (Critical)

1. **Add coverage tracking for core Go package** — Add `-coverprofile` to `test-semantic-router` target and upload to Codecov in `test-and-build.yml`. Set initial threshold at project's current coverage level and ratchet up.

2. **Add container vulnerability scanning** — Add Trivy scanning to `docker-publish.yml` and consider a separate PR-time scanning step for Dockerfiles that change.

3. **Enable CodeQL for Go, Python, and TypeScript** — Create a new CodeQL workflow targeting the three primary languages. The security-sensitive nature of this codebase (PII detection, jailbreak classification, auth) makes this essential.

### Priority 1 (High Value)

4. **Add image runtime startup validation** — After building each Docker image in CI, run it with a health check to verify startup. Even a basic `docker run --rm -d && curl localhost:PORT/healthz` would catch many issues.

5. **Add SBOM generation and image signing** — Use `anchore/sbom-action` for SBOM and `sigstore/cosign` for signing in `docker-publish.yml`.

6. **Add secret detection** — Add Gitleaks to pre-commit config and as a CI workflow. The codebase handles HF tokens, API keys, and auth credentials.

7. **Re-enable performance nightly** — The `performance-nightly.yml` has the cron schedule commented out. Re-enable it to establish continuous performance baselines.

### Priority 2 (Nice-to-Have)

8. **Add OpenAI API contract tests** — The semantic router implements an OpenAI-compatible API; contract tests would ensure compatibility doesn't drift.

9. **Add Rust coverage tracking** — Use `cargo-tarpaulin` or `llvm-cov` to track coverage for the 116 Rust source files.

10. **Add dependency vulnerability scanning** — Enable Dependabot or Renovate for automated dependency updates across Go, Rust, Python, and npm.

11. **Add accessibility testing for dashboard** — The dashboard frontend with Playwright infrastructure could easily add accessibility checks.

12. **Add `.dockerignore`** — No root `.dockerignore` exists, which may cause unnecessary files to be included in build contexts.

## Comparison to Gold Standards

| Dimension | semantic-router | odh-dashboard | notebooks | kserve |
|-----------|----------------|---------------|-----------|--------|
| Unit Tests | 8.5 — 224 test files, 4 languages | 9.0 — Multi-layer | 7.0 — Image-focused | 9.0 — Comprehensive |
| Integration/E2E | 9.0 — 18 profiles, Kind | 9.0 — Contract tests | 8.0 — 5-layer | 9.0 — Multi-version |
| Build Integration | 7.0 — PR builds, multi-arch | 8.0 — Full validation | 7.0 — Image pipeline | 7.0 — Standard |
| Image Testing | 6.5 — Builds only | 7.0 — Runtime checks | 9.0 — 5-layer validation | 7.0 — Deployment tests |
| Coverage Tracking | 4.0 — Operator only | 8.0 — Enforced thresholds | 6.0 — Partial | 9.0 — Full enforcement |
| CI/CD Automation | 9.0 — 25 workflows | 9.0 — Comprehensive | 8.0 — Image pipeline | 8.0 — Well-structured |
| Agent Rules | 9.5 — Best-in-class | 8.0 — Comprehensive | 5.0 — Basic | 6.0 — Standard |
| **Overall** | **7.9** | **8.3** | **7.1** | **7.9** |

**Notable Strengths vs Gold Standards:**
- Agent rules harness is the most sophisticated observed (exceeds odh-dashboard)
- E2E testing infrastructure with 18 profiles and matrix-driven selection is exceptional
- Performance benchmarking on PRs with automated PR comments is a best practice
- CI path-filtering granularity (14+ filters with per-E2E-profile detection) is industry-leading

**Key Gap vs Gold Standards:**
- Coverage tracking is the single largest gap — odh-dashboard and kserve both enforce coverage thresholds while semantic-router tracks coverage for only the operator component

## File Paths Reference

### CI/CD
- `.github/workflows/test-and-build.yml` — Core test and build
- `.github/workflows/integration-test-k8s.yml` — E2E K8s tests
- `.github/workflows/operator-ci.yml` — Operator CI with coverage
- `.github/workflows/docker-publish.yml` — Image publishing
- `.github/workflows/ci-changes.yml` — Path-based change detection

### Testing
- `src/semantic-router/pkg/*/` — Go unit tests (160 files)
- `candle-binding/src/*/` — Rust unit tests (34 files)
- `e2e/` — E2E test framework with 18 profiles
- `perf/benchmarks/` — Performance benchmarks (6 files)
- `dashboard/frontend/e2e/` — Playwright E2E tests (10 files)
- `dashboard/backend/handlers/` — Backend handler tests (18 files)

### Code Quality
- `tools/linter/go/.golangci.yml` — Go linter config (14 linters)
- `.pre-commit-config.yaml` — 11 pre-commit hooks
- `tools/make/linter.mk` — Linter Make targets

### Container Images
- `tools/docker/Dockerfile` — Main development image
- `deploy/operator/Dockerfile` — Operator (UBI 10 multi-stage)
- 18 Dockerfiles total across the repository

### Agent Rules
- `AGENTS.md` — Agent entry point
- `docs/agent/` — 20+ agent documentation files
- `tools/agent/` — Executable rule layer (manifests, skills, scripts)
- `CODEOWNERS` — Per-directory ownership via OWNER files
