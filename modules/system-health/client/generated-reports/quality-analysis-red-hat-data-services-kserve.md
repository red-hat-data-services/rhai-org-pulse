---
repository: "red-hat-data-services/kserve"
overall_score: 7.9
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "192 Go + 255 Python test files with envtest, pytest-cov, multi-Python-version matrix"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "91 E2E tests across 14 domains; Minikube/KinD PR-gated; multi-Istio-version matrix"
  - dimension: "Build Integration"
    score: 7.5
    status: "Distro build-tag verification on PR; Tekton/Konflux multi-arch PR builds; no Konflux simulation in GitHub CI"
  - dimension: "Image Testing"
    score: 6.5
    status: "Multi-stage UBI Dockerfiles with license checking; no runtime validation or startup tests"
  - dimension: "Coverage Tracking"
    score: 8.5
    status: "go-test-coverage enforces 80% threshold; PR coverage diff reporting; Python pytest-cov available but not enforced"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "48 workflows with concurrency control, path-based triggers, pinned SHAs, required checks gate"
  - dimension: "Agent Rules"
    score: 7.0
    status: "AGENTS.md + 5 detailed .rules/ files for midstream patterns; missing test creation guidance"
critical_gaps:
  - title: "No container image runtime validation"
    impact: "Image startup failures and runtime issues not caught until deployment on cluster"
    severity: "HIGH"
    effort: "6-8 hours"
  - title: "Python coverage not enforced"
    impact: "Python SDK (384 source files) has pytest-cov installed but no threshold enforcement; coverage can silently regress"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No vulnerability scanning in CI"
    impact: "Container vulnerabilities discovered only after images are built in Konflux; Snyk config exists but no CI workflow"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No agent rules for test creation"
    impact: "AI-assisted test generation lacks guidance on test patterns, envtest setup, and pytest conventions specific to this repo"
    severity: "MEDIUM"
    effort: "3-4 hours"
quick_wins:
  - title: "Add Trivy scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Catch CVEs in base images and Go/Python dependencies before merge"
  - title: "Enforce Python coverage threshold"
    effort: "2-3 hours"
    impact: "Prevent Python SDK coverage regressions with pytest-cov --cov-fail-under"
  - title: "Add container startup validation step to E2E workflows"
    effort: "3-4 hours"
    impact: "Catch entrypoint and runtime failures before full E2E test execution"
  - title: "Generate test creation agent rules with /test-rules-generator"
    effort: "2-3 hours"
    impact: "Enable consistent AI-generated tests following envtest and pytest patterns"
recommendations:
  priority_0:
    - "Add container vulnerability scanning (Trivy) to PR and scheduled workflows"
    - "Enforce Python test coverage thresholds across all Python packages"
    - "Add image startup validation to catch runtime failures before E2E tests"
  priority_1:
    - "Create agent rules for unit test, integration test, and E2E test creation patterns"
    - "Add SBOM generation to GitHub CI (Syft config exists but is unused in workflows)"
    - "Integrate Codecov or similar for unified Go+Python coverage visualization"
  priority_2:
    - "Add contract tests for the KServe Python SDK inference protocol"
    - "Add performance regression testing for prediction latency"
    - "Implement chaos engineering tests for controller resilience"
---

# Quality Analysis: red-hat-data-services/kserve

## Executive Summary

- **Overall Score: 7.9/10**
- **Repository Type**: Kubernetes operator (Go) + Python ML serving SDK — midstream fork of kserve/kserve
- **Primary Languages**: Go (589 files), Python (639 files)
- **Key Strengths**: Comprehensive E2E suite with 91 tests across 14 domains, excellent Go coverage enforcement at 80%, robust CI/CD with 48 workflows featuring path-based triggers and SHA-pinned actions, strong midstream isolation via build-tag companion file pattern with detailed agent rules
- **Critical Gaps**: No container vulnerability scanning in CI, Python coverage not enforced, no image runtime validation
- **Agent Rules Status**: Present — AGENTS.md + 5 detailed `.rules/` files covering build tags, distro builds, kustomize hygiene, makefile split, and RBAC isolation. Missing test creation guidance.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | 192 Go + 255 Python test files; envtest for controllers; multi-Python-version matrix |
| Integration/E2E | 9.0/10 | 91 E2E tests across 14 domains; PR-gated on Minikube/KinD; multi-Istio-version matrix |
| **Build Integration** | **7.5/10** | **Distro build-tag verification; Tekton/Konflux multi-arch PR builds; missing GitHub CI Konflux simulation** |
| Image Testing | 6.5/10 | Multi-stage UBI Dockerfiles with license checking; no runtime/startup validation |
| Coverage Tracking | 8.5/10 | Go: 80% threshold enforced with PR diff reporting; Python: pytest-cov available but unenforced |
| CI/CD Automation | 9.0/10 | 48 workflows; concurrency control; path filtering; SHA-pinned actions; required checks gate |
| Agent Rules | 7.0/10 | AGENTS.md + 5 .rules/ files for midstream patterns; no test creation rules |

## Critical Gaps

### 1. No Container Image Runtime Validation
- **Impact**: Image startup failures, misconfigured entrypoints, and missing runtime dependencies not caught until deployment on an actual cluster
- **Severity**: HIGH
- **Effort**: 6-8 hours
- **Detail**: The E2E workflows build images and deploy to Minikube, but there is no explicit image startup validation step. If a container fails to start, the failure is discovered as a cryptic E2E test timeout rather than a clear "image failed to start" error. Adding a dedicated startup check (e.g., `docker run --rm image --help` or health check probe) before E2E tests would catch these issues early.

### 2. Python Coverage Not Enforced
- **Impact**: The Python SDK has 384 source files and 255 test files with `pytest-cov` installed across all packages, but no coverage threshold is enforced in CI. Coverage can silently regress.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Detail**: All Python packages include `pytest-cov` as a test dependency. The `python-test.yml` workflow runs tests across Python 3.10/3.11/3.12 but does not pass `--cov-fail-under` flags. Adding threshold enforcement (e.g., `--cov-fail-under=70`) and coverage reporting to the workflow would close this gap.

### 3. No Vulnerability Scanning in CI
- **Impact**: Container vulnerabilities are discovered only after images are built in Konflux. A `.snyk` config exists but has no corresponding CI workflow.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Detail**: The repository has a `.snyk` policy file excluding dev/docs/hack directories, and a `.syft.yaml` for SBOM generation, but neither is integrated into any GitHub Actions workflow. Adding a Trivy scan step to the E2E or build workflows would catch vulnerabilities before merge.

### 4. No Agent Rules for Test Creation
- **Impact**: AI-assisted test generation lacks guidance on this repository's specific test patterns, envtest setup idioms, and Python pytest conventions
- **Severity**: MEDIUM
- **Effort**: 3-4 hours
- **Detail**: The existing `.rules/` directory has excellent coverage of midstream patterns (build tags, distro builds, kustomize, RBAC) but contains no guidance for test creation. The `AGENTS.md` file documents testing conventions at a high level but doesn't provide the structured, actionable patterns that agent rules need (framework-specific examples, anti-patterns, checklist).

## Quick Wins

### 1. Add Trivy Scanning to PR Workflow (1-2 hours)
**Impact**: Catch CVEs in base images and Go/Python dependencies before merge

```yaml
# Add to .github/workflows/go.yml or create .github/workflows/trivy-scan.yml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    scan-type: 'fs'
    scan-ref: '.'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'
```

### 2. Enforce Python Coverage Threshold (2-3 hours)
**Impact**: Prevent Python SDK coverage regressions

Add `--cov-fail-under=70` to pytest invocations in `python-test.yml` and configure per-package coverage reporting.

### 3. Add Container Startup Validation (3-4 hours)
**Impact**: Catch entrypoint and runtime failures before full E2E test execution

Add a post-build step in E2E workflows to verify each container starts and responds to health checks before deploying to Minikube/KinD.

### 4. Generate Test Creation Agent Rules (2-3 hours)
**Impact**: Enable consistent AI-generated tests following envtest and pytest patterns

Run `/test-rules-generator` against this repository to generate `.claude/rules/` files covering unit test, integration test, and E2E test creation patterns.

## Detailed Findings

### CI/CD Pipeline

**Score: 9.0/10** — Excellent

The repository has 48 GitHub Actions workflows with strong engineering practices:

- **PR-triggered tests**: Go tests (`go.yml`), Python tests (`python-test.yml`), E2E tests (`e2e-test.yml`), precommit checks (`precommit-check.yml`), distro build verification (`distro-build-check.yml`), and multiple specialized E2E suites (LLMISvc, ModelCache, ODH xKS, kserve-module, quick-install)
- **Concurrency control**: All workflows use `cancel-in-progress: true` with `group: ${{ github.workflow }}-${{ github.ref }}`
- **Path-based triggers**: Workflows only run when relevant files change (e.g., `python-test.yml` only runs on `python/**` changes)
- **SHA-pinned actions**: All third-party actions pinned to commit SHAs with version comments
- **Required checks gate**: `required-checks.yml` enforces all PR checks pass before merge with a 3-hour timeout
- **Merge queue support**: All key workflows support `merge_group` events
- **Security scanning**: Go security scan with Gosec (scheduled weekly + on PR), SARIF upload to GitHub Code Scanning
- **Unicode safety check**: Detects hidden unicode characters in PRs
- **License checking**: `go-license-check.yml` validates all Go dependencies
- **Docker image publishing**: 15+ docker publish workflows for individual components

**Tekton/Konflux Integration**: 7 Tekton PipelineRun definitions for PR builds covering all Go binaries (agent, controller, llmisvc-controller, localmodel-agent, router, storage-initializer, kserve-module-operator). Multi-arch builds (x86_64, ppc64le, s390x, arm64) with hermetic builds and RPM prefetching. Pipelines managed centrally via `konflux-central` repository.

**Gap**: No Konflux build simulation in GitHub CI — the Tekton builds run in the Konflux environment, and GitHub CI has a separate `distro-build-check.yml` that verifies compilation with and without distro build tags but doesn't simulate the full Konflux pipeline.

### Test Coverage

**Score: 8.5/10 (Go) / 7.0/10 (Python)**

**Go Testing**:
- 192 test files for 397 source files (test-to-code ratio: 0.48)
- envtest framework for controller testing with `pkgtest.NewEnvTest()` wrapper
- Coverage enforcement: 80% threshold via `go-test-coverage` tool
- PR coverage diff reporting: Automated PR comments comparing branch vs. master coverage
- Coverage exclusions: Generated files (deepcopy, defaults, openapi), client packages, testing utilities
- Sophisticated coverage script (`coverage.sh`) that filters ignored patterns from `coverage.out`

**Python Testing**:
- 255 test files for 384 source files (test-to-code ratio: 0.66)
- Multi-version matrix: Tests run across Python 3.10, 3.11, and 3.12
- pytest with pytest-cov, pytest-asyncio
- Test structure organized per package: `python/kserve/test/`, `python/huggingfaceserver/tests/`, `python/autogluonserver/tests/`, `python/storage/test/`
- **Gap**: pytest-cov is installed but coverage thresholds are not enforced in CI

### E2E Testing

**Score: 9.0/10** — Excellent

- **91 E2E test files** across 14 test domains:
  - Predictors (sklearn, tensorflow, torchserve, xgboost, triton, vLLM, predictive, raw deployment)
  - Transformers (standard, raw, collocation)
  - Explainers (ART)
  - Batchers (standard, custom port, raw)
  - InferenceGraphs
  - Model storage (S3, S3 TLS)
  - Credentials
  - Custom models (gRPC, Ray)
  - LLMISvc (dedicated workflow)
  - ModelCache (dedicated workflow)
  - QPExt (queue proxy extension)
  - Logger
  - Helm deployment tests
- **Infrastructure**: Minikube-based with reusable GitHub Actions (minikube-setup, kserve-dep-setup, free-up-disk-space)
- **Multi-install-method testing**: Smart matrix detection — runs Kustomize, Helm, or both based on which paths changed
- **Multi-version testing**: ODH xKS E2E runs against multiple Istio versions (1.27.5, 1.28.3) with TLS on/off matrix
- **Dedicated E2E suites**: Separate workflows for LLMISvc, ModelCache, kserve-module, quick-install, ODH xKS
- All E2E workflows are PR-gated with path-based triggers

### Code Quality

**Score: 8.5/10** — Strong

**Go Linting** (`.golangci.yml`):
- Comprehensive golangci-lint v2 configuration with 40+ linters enabled
- Notable linters: gosec, govet, staticcheck, bodyclose, contextcheck, errorlint, gocritic, ineffassign, misspell, prealloc, unconvert, unparam
- Custom `forbidigo` rules enforcing `pkgtest.SetupTestLogger` instead of `SetLogger` in tests
- Import alias enforcement via `importas` (corev1, metav1, ctrl, gwapiv1)
- Code formatting via gofmt, gofumpt, goimports
- Generated code exclusions (client/, openapi/, zz_generated)
- Timeout: 6 minutes

**Python Linting** (`ruff.toml`):
- Ruff configured with B (bugbear), E (pycodestyle), F (pyflakes), W (warnings) rule sets
- Line length: 88
- Extensive exclude list for generated/vendored code
- Pre-commit integration via `ruff-pre-commit`

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- Helm docs generation
- GitHub Actions SHA pinning verification (`pinact`)
- Ruff formatting and linting
- Note: Pre-commit config is minimal — only 3 hooks. The heavy lifting is done by `make precommit` which runs ~20 checks.

**Precommit Make Target**: The `make precommit` / `make check` target runs a comprehensive suite:
- Go version upgrade check, dependency sync, image env sync
- Go vet, golangci-lint, Ruff format, Ruff lint
- Code generation (controller-gen, helm-docs)
- Manifest generation and sync
- Kustomize builds, Helm chart linting
- UV lock file sync, action SHA pinning verification

### Container Images

**Score: 6.5/10** — Moderate

**Dockerfiles**:
- Main `Dockerfile`: Multi-stage (deps → builder → license → runtime) with UBI9 base images
- Parallel build stages (builder and license) for BuildKit optimization
- Build caching with `--mount=type=cache` for Go module and build caches
- GOTAGS build argument for distro build-tag support
- Non-root user (kserve, uid 1000)
- License checking via `go-licenses` during build

**Konflux Dockerfiles** (`Dockerfiles/`):
- 9 Konflux-specific Dockerfiles for production builds
- SHA-pinned base images (UBI9 go-toolset and ubi-minimal)
- Multi-arch support (TARGETOS/TARGETARCH build args)
- FIPS compliance (`GOEXPERIMENT=strictfipsruntime`)
- Hermetic builds with RPM prefetching

**Gaps**:
- No image startup validation in CI (no `docker run --entrypoint` health check)
- No Trivy/Grype scanning in GitHub workflows
- No image signing or attestation in GitHub CI (handled by Konflux)
- SBOM config (`.syft.yaml`) exists but is not used in any GitHub workflow

### Security

**Score: 7.5/10** — Good

**Strengths**:
- Gosec security scanner runs on every PR with SARIF upload to GitHub Code Scanning
- Scheduled weekly security scan (Sundays at midnight UTC)
- `.snyk` policy file configured (excludes dev_tools, docs, hack, tf2openapi)
- SHA-pinned GitHub Actions across all workflows
- Unicode safety check on PRs
- Go license compliance checking on every PR
- Non-root container images (uid 1000)
- FIPS-compliant builds in Konflux Dockerfiles

**Gaps**:
- No container image vulnerability scanning (Trivy/Grype) in GitHub CI
- No dependency scanning workflow (Snyk config exists but no workflow)
- No secret detection (no Gitleaks/TruffleHog)
- SBOM generation config exists (`.syft.yaml`) but is not integrated into CI

### Agent Rules (Agentic Flow Quality)

**Score: 7.0/10** — Good midstream rules, missing test guidance

**Status**: Present — strong midstream-specific guidance

**AGENTS.md** (root):
- Comprehensive repository context: layout, constraints, testing conventions
- Controller development patterns with envtest
- Make targets and focused test commands
- ODH-specific change patterns (hook pairs, additive files)
- Clear testing guidance: per-test namespaces, Eventually/Consistently, retry patterns

**.rules/ Directory** (5 files):
1. **build-tags.md** (7KB) — Detailed rules for midstream build-tag companion files (`*_odh.go`/`*_default.go`), with 6 violation types and detection signals including cross-file call analysis
2. **distro-builds.md** (4KB) — GOTAGS propagation rules through Dockerfiles, Makefiles, and Tekton PipelineRuns with 5 violation types
3. **kustomize-hygiene.md** (4KB) — Upstream manifest separation rules with 2 violation types and 8 specific exemptions for known technical debt
4. **makefile-split.md** (3KB) — Makefile.overrides.mk isolation rules with 4 violation types
5. **rbac-isolation.md** (5KB) — RBAC marker package isolation rules with 4 violation/advisory types and pre-existing debt tracking

**Quality Assessment**:
- Rules are **exceptionally well-structured**: each has Context (why), Violations (flag as blocking), and Exemptions (do not flag) sections
- Rules are **highly specific**: real file paths, real function names, real PR examples
- Rules include **pre-existing technical debt tracking** — exemptions for known drift that predates the policy
- Rules are **mutually referencing**: build-tags.md references distro-builds.md, rbac-isolation.md references build-tags.md

**Gaps**:
- **No test creation rules**: No guidance for AI agents on how to write unit tests (envtest patterns), Python tests (pytest conventions), or E2E tests (test infrastructure setup)
- **No `.claude/` directory**: Rules are in `.rules/` which is non-standard for Claude Code. No `.claude/rules/` or `.claude/skills/`
- **No code review agent rules**: No guidance on what to look for beyond midstream-specific patterns

**Recommendation**: Run `/test-rules-generator` to generate `.claude/rules/` files for test creation. Consider moving `.rules/` content to `.claude/rules/` for standard Claude Code integration.

## Recommendations

### Priority 0 (Critical)

1. **Add container vulnerability scanning to CI** — Integrate Trivy as a PR-gated workflow step. The `.snyk` and `.syft.yaml` configs show security awareness but lack CI integration. Trivy can scan both the filesystem (Go/Python dependencies) and built images.

2. **Enforce Python test coverage thresholds** — Add `--cov-fail-under=70` to pytest invocations in `python-test.yml`. All Python packages already have `pytest-cov` as a dependency. Add coverage reporting to PRs similar to the Go coverage PR comments.

3. **Add image startup validation** — Add a post-build step in E2E workflows that runs each built container with a health check before deploying to Minikube. This catches entrypoint issues, missing dependencies, and configuration errors early with a clear error message rather than a cryptic E2E timeout.

### Priority 1 (High Value)

4. **Create agent rules for test creation** — Generate `.claude/rules/` files covering:
   - Go unit tests: envtest patterns, `pkgtest.NewEnvTest()`, fake client builders, Eventually/Consistently
   - Python unit tests: pytest conventions, pytest-asyncio, mocking strategies
   - E2E tests: Minikube setup, KServe dependency installation, inference validation patterns

5. **Integrate SBOM generation into CI** — The `.syft.yaml` config is already tuned with appropriate exclusions. Add a Syft-based SBOM generation step to build workflows.

6. **Add unified coverage dashboard** — Integrate Codecov or similar for cross-language coverage visualization. Go coverage is well-tracked but Python coverage is invisible.

### Priority 2 (Nice-to-Have)

7. **Add contract tests for KServe Python SDK** — The Python inference protocol (V2 predict, explain, OpenAI-compatible) would benefit from contract tests ensuring API compatibility across server implementations.

8. **Add performance regression testing** — Prediction latency benchmarks for core model servers to catch performance regressions.

9. **Implement chaos engineering tests** — Controller resilience testing (pod deletion during reconciliation, network partitions, API server unavailability).

10. **Expand pre-commit hooks** — The current config has only 3 hooks. Consider adding Go test hooks, Python type checking (mypy), and Dockerfile linting (hadolint).

## Comparison to Gold Standards

| Dimension | kserve (this repo) | odh-dashboard | notebooks | Kubernetes Best Practice |
|-----------|-------------------|---------------|-----------|------------------------|
| Unit Tests | 8.5 — envtest + pytest-cov | 9.0 — Jest + RTL + contract | 7.0 — Notebook execution | 8.0 — envtest standard |
| Integration/E2E | 9.0 — 91 tests, 14 domains | 9.0 — Cypress E2E + API | 8.0 — Multi-image validation | 8.5 — Ginkgo/Gomega |
| Build Integration | 7.5 — Distro build verification | 6.0 — No Konflux simulation | 7.0 — Image build matrix | 7.0 — Make + Docker |
| Image Testing | 6.5 — License check only | 5.0 — Basic build | 9.0 — 5-layer validation | 7.0 — Trivy + startup |
| Coverage Tracking | 8.5 — Go 80% enforced | 9.0 — Codecov enforced | 5.0 — No tracking | 8.0 — Codecov + thresholds |
| CI/CD Automation | 9.0 — 48 workflows, pinned | 8.5 — Well-organized | 8.0 — Matrix builds | 8.0 — Standard |
| Agent Rules | 7.0 — 5 midstream rules | 8.5 — Comprehensive rules | 3.0 — Minimal | 5.0 — CONTRIBUTING.md |
| **Overall** | **7.9** | **8.2** | **6.7** | **7.4** |

## File Paths Reference

### CI/CD
- `.github/workflows/go.yml` — Go unit tests with coverage enforcement
- `.github/workflows/python-test.yml` — Python tests across 3.10/3.11/3.12
- `.github/workflows/e2e-test.yml` — Main E2E suite (predictors, transformers, explainers, etc.)
- `.github/workflows/e2e-test-llmisvc.yaml` — LLMISvc-specific E2E tests
- `.github/workflows/e2e-test-modelcache.yaml` — ModelCache E2E tests
- `.github/workflows/e2e-test-odh-xks-kind.yml` — ODH xKS E2E with multi-Istio matrix
- `.github/workflows/e2e-test-kserve-module.yml` — kserve-module E2E tests
- `.github/workflows/e2e-test-quick-install.yaml` — Quick install E2E
- `.github/workflows/precommit-check.yml` — Pre-commit validation
- `.github/workflows/distro-build-check.yml` — Distro build tag verification
- `.github/workflows/scheduled-go-security-scan.yml` — Gosec security scanning
- `.github/workflows/required-checks.yml` — Required checks enforcement gate

### Testing
- `test/e2e/` — 91 E2E test files across 14 subdirectories
- `pkg/**/*_test.go` — Go unit tests colocated with source
- `python/kserve/test/` — KServe Python SDK tests
- `python/huggingfaceserver/tests/` — HuggingFace server tests
- `python/autogluonserver/tests/` — AutoGluon server tests
- `python/storage/test/` — Storage tests

### Code Quality
- `.golangci.yml` — 40+ linter golangci-lint v2 configuration
- `ruff.toml` — Python linting with B/E/F/W rule sets
- `.pre-commit-config.yaml` — Helm docs, action pinning, Ruff hooks
- `Makefile` — `precommit` target with ~20 checks
- `.github/.testcoverage.yml` — Go coverage threshold (80%)
- `coverage.sh` / `.cov-ignore` — Coverage filtering

### Container Images
- `Dockerfile` — Main multi-stage Go controller Dockerfile
- `Dockerfiles/` — 9 Konflux-specific Dockerfiles
- `agent.Dockerfile`, `router.Dockerfile`, etc. — Component-specific Dockerfiles
- `.dockerignore` — Docker build exclusions
- `.syft.yaml` — SBOM generation configuration

### Security
- `.snyk` — Snyk policy file
- `.github/workflows/scheduled-go-security-scan.yml` — Gosec + CodeQL SARIF
- `.github/workflows/unicode-safety.yml` — Unicode safety check
- `.github/workflows/go-license-check.yml` — License compliance

### Agent Rules
- `AGENTS.md` — Repository context, constraints, conventions, testing guidance
- `.rules/build-tags.md` — Midstream build-tag companion file rules
- `.rules/distro-builds.md` — GOTAGS propagation rules
- `.rules/kustomize-hygiene.md` — Upstream manifest separation rules
- `.rules/makefile-split.md` — Makefile.overrides.mk isolation rules
- `.rules/rbac-isolation.md` — RBAC marker package isolation rules

### Build System
- `Makefile` — Primary build orchestration (40KB)
- `Makefile.overrides.mk` — Midstream overrides (GOTAGS=distro)
- `Makefile.ocp.mk` — OpenShift-specific targets
- `Makefile.tools.mk` — Tool installation targets
- `.tekton/` — 7 Tekton PipelineRun definitions for Konflux builds
- `rpms.in.yaml` / `rpms.lock.yaml` — RPM dependency management
