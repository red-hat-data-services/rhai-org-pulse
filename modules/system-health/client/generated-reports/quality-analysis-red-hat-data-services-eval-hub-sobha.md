---
repository: "red-hat-data-services/eval-hub-sobha"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Excellent test-to-code ratio (1.16:1 LOC), 45 test files across all packages"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Comprehensive BDD suite with godog — 2052 lines of Gherkin across 7 feature files including Kubernetes and MLflow"
  - dimension: "Build Integration"
    score: 7.0
    status: "Konflux PR pipeline via Tekton; CI builds & dry-runs Docker image on push; no PR-time build validation"
  - dimension: "Image Testing"
    score: 6.0
    status: "Multi-arch builds (amd64/arm64), dry-run validation on push, but no container runtime testing or vulnerability scanning"
  - dimension: "Coverage Tracking"
    score: 7.5
    status: "Codecov integration with coverage range 50-75%, separate unit and FVT coverage profiles"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "Well-organized CI with quality checks, security scan, Docker build; PyPI publishing pipeline"
  - dimension: "Agent Rules"
    score: 5.0
    status: "CLAUDE.md present with build/test/architecture docs; no .claude/rules/ for test automation guidance"
critical_gaps:
  - title: "No container vulnerability scanning (Trivy/Snyk/Grype)"
    impact: "CVEs in base images or dependencies could ship to production undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No PR-time Docker build validation"
    impact: "Build failures discovered only after merge; Konflux PR pipeline exists but doesn't run on all PRs automatically"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No dedicated linter configuration (golangci-lint)"
    impact: "Only using go vet — missing dozens of linter checks (staticcheck, errcheck, gosimple, ineffassign, etc.)"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No CodeQL/SAST in CI"
    impact: "Security vulnerabilities in code patterns not caught by gosec alone"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No concurrency control or caching in CI workflows"
    impact: "Redundant CI runs on rapid pushes; slower builds without Go module caching"
    severity: "LOW"
    effort: "1-2 hours"
quick_wins:
  - title: "Add Trivy container scanning to CI workflow"
    effort: "1-2 hours"
    impact: "Detect known CVEs in container images before merge"
  - title: "Add golangci-lint with comprehensive linter set"
    effort: "2-3 hours"
    impact: "Catch code quality issues beyond go vet (staticcheck, errcheck, gosimple, etc.)"
  - title: "Add concurrency control to CI workflow"
    effort: "30 minutes"
    impact: "Cancel redundant CI runs, save compute resources"
  - title: "Add Go module caching to CI"
    effort: "30 minutes"
    impact: "Faster CI builds by caching downloaded modules"
  - title: "Create .claude/rules/ for test automation guidance"
    effort: "2-3 hours"
    impact: "Standardize AI-generated tests across unit, FVT, and Kubernetes test patterns"
recommendations:
  priority_0:
    - "Add container vulnerability scanning (Trivy) to PR and push workflows"
    - "Add golangci-lint with comprehensive linter configuration"
    - "Enable CodeQL or extend gosec to run with fail-on-findings for PR checks"
  priority_1:
    - "Add PR-time Docker build smoke test (build but don't push)"
    - "Add coverage enforcement thresholds in codecov.yml (currently only range set)"
    - "Create .claude/rules/ with test patterns for unit tests, FVT, and Kubernetes resource tests"
  priority_2:
    - "Add concurrency control and Go module caching to CI workflows"
    - "Add Gitleaks secret detection to pre-commit and CI"
    - "Add SBOM generation to container builds"
    - "Add performance/load testing for API endpoints"
---

# Quality Analysis: eval-hub-sobha (EvalHub)

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Go REST API service for LLM evaluation orchestration
- **Primary Language**: Go 1.25 with Python wrapper for PyPI distribution
- **Framework**: Standard library `net/http`, Kubernetes client-go, godog BDD
- **Key Strengths**: Excellent test-to-code ratio, comprehensive BDD functional tests, well-structured CI with security scanning (gosec), mature Containerfile with multi-arch support, Konflux integration
- **Critical Gaps**: No container vulnerability scanning, no golangci-lint, no PR-time build validation, no CodeQL/SAST
- **Agent Rules Status**: Partial — CLAUDE.md present with comprehensive project guidance, but no `.claude/rules/` for test automation

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Excellent test-to-code ratio (1.16:1 LOC), 45 test files across all packages |
| Integration/E2E | 8.5/10 | Comprehensive BDD suite with godog — 2052 lines of Gherkin, 7 feature files |
| **Build Integration** | **7.0/10** | **Konflux PR pipeline via Tekton; CI builds image on push; no PR-time build validation** |
| Image Testing | 6.0/10 | Multi-arch builds, dry-run on push, no vulnerability scanning or runtime testing |
| Coverage Tracking | 7.5/10 | Codecov with separate unit/FVT profiles; range 50-75% but no enforcement threshold |
| CI/CD Automation | 8.0/10 | Well-organized CI with quality checks, gosec, Docker build, PyPI pipeline |
| Agent Rules | 5.0/10 | CLAUDE.md with build/test/architecture docs; no `.claude/rules/` |

## Critical Gaps

### 1. No Container Vulnerability Scanning
- **Impact**: CVEs in UBI9 base images or Go dependencies could ship to production undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Neither Trivy, Snyk, Grype, nor any other container scanner is configured in CI or Tekton pipelines. The Dockerfile.konflux uses pinned image digests (good), but no scanning validates the built image.

### 2. No PR-Time Docker Build Validation
- **Impact**: Dockerfile/Containerfile changes are untested until the push-triggered `docker-build-push` job runs
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The CI workflow only builds Docker images on `push` events (`if: github.event_name == 'push'`). PRs skip the build entirely. The Konflux/Tekton pipeline is trigger-on-comment (`/build-konflux`) or label-based, not automatic for all PRs.

### 3. No Dedicated Linter (golangci-lint missing)
- **Impact**: Only `go vet` is used — missing staticcheck, errcheck, gosimple, ineffassign, bodyclose, and dozens of other valuable linters
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: No `.golangci.yaml` or `.golangci.yml` exists. The `lint` target in the Makefile just runs `go vet ./...`. Gold-standard Go repos use golangci-lint with 15-30+ enabled linters.

### 4. No CodeQL or Comprehensive SAST
- **Impact**: gosec is run with `-no-fail`, meaning results are uploaded to GitHub Security but never block PRs
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: gosec runs with `-no-fail` flag, so security findings are informational only. No CodeQL workflow exists.

### 5. No CI Concurrency Control or Caching
- **Impact**: Redundant CI runs waste compute; builds are slower without module caching
- **Severity**: LOW
- **Effort**: 1-2 hours

## Quick Wins

### 1. Add Trivy Container Scanning (1-2 hours)
```yaml
# Add to ci.yml after docker-build-push
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: '${{ env.IMAGE_REGISTRY }}/${{ env.IMAGE_REPOSITORY }}@${{ steps.build.outputs.digest }}'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
- name: Upload Trivy scan results
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: 'trivy-results.sarif'
```

### 2. Add golangci-lint (2-3 hours)
```yaml
# .golangci.yaml
linters:
  enable:
    - errcheck
    - gosimple
    - govet
    - ineffassign
    - staticcheck
    - bodyclose
    - gocritic
    - gofmt
    - goimports
    - misspell
    - unconvert
    - unparam
    - revive
```

### 3. Add Concurrency Control (30 min)
```yaml
# Add to ci.yml at the top level
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

### 4. Add Go Module Caching (30 min)
The `setup-go@v5` action with `go-version` already caches by default via its built-in cache. Verify it's enabled with `cache: true` (default).

### 5. Create Agent Rules for Test Automation (2-3 hours)
Generate rules covering:
- Unit test patterns (standard Go `testing` package, table-driven tests)
- FVT patterns (godog step definitions, Gherkin feature files)
- Kubernetes resource test patterns (fake client, mock runtime)

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory:**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | push (main, develop, tags), PR (main, develop) | Quality checks, coverage, security scan, Docker build |
| `commitlint.yml` | PR (main) | Conventional commit message enforcement |
| `publish-python-server.yml` | push (main, tags), workflow_dispatch | Cross-platform Go binary + Python wheel build & PyPI publish |
| `sync-branch-stable.yaml` | push (incubation) | Sync incubation branch to stable |
| `sync-branch-incubation.yaml` | push (main) | Sync main to incubation |
| `.tekton/odh-eval-hub-pull-request.yaml` | PR (label/comment triggered) | Konflux hermetic container build |

**Strengths:**
- Comprehensive CI pipeline with format check, lint, vet, tests, coverage, security, API docs verification
- Separate security scanning job (gosec) with SARIF upload to GitHub Security
- Docker image dry-run validation (runs `--help` after build)
- Multi-platform Python wheel distribution pipeline (linux/mac/windows, amd64/arm64)
- Konflux/Tekton pipeline for hermetic RHOAI builds
- Conventional commit enforcement via commitizen
- Branch sync automation (main → incubation → stable)

**Gaps:**
- No concurrency control on CI workflows
- No Go module caching explicitly configured (though setup-go may cache by default)
- gosec uses `-no-fail` — findings never block PRs
- Docker build only on push, not on PRs
- Konflux pipeline triggered by comment/label, not automatic

### Test Coverage

**Unit Tests (8.5/10):**
- **45 test files** covering all major packages
- **14,639 lines of test code** vs 12,611 lines of source code (1.16:1 ratio — excellent)
- Covers: auth, config, handlers, runtimes (k8s, local, shared), server, storage, validation, sidecar components
- Framework: standard Go `testing` package
- Race detection enabled (`-race` flag)

**Functional Verification Tests (8.5/10):**
- BDD-style tests using godog (Cucumber for Go)
- **7 feature files** with **2,052 lines of Gherkin**
  - `evaluations.feature` (904 lines) — CRUD, validation, pagination, filtering, multi-benchmark
  - `providers.feature` (534 lines) — provider listing, benchmarks, filtering
  - `collections.feature` (405 lines) — collection management
  - `kubernetes_resources.feature` (133 lines) — K8s Job/ConfigMap specification validation
  - `mlflow/experiments.feature` (36 lines) — MLflow experiment management
  - `health.feature` (21 lines) — health check endpoint
  - `metrics.feature` (19 lines) — Prometheus metrics
- FVT tests run against a started server (real HTTP requests)
- Coverage collection during FVT via `-coverprofile`
- JUnit XML report generation
- Cucumber HTML report generation

**Python Tests:**
- 3 unit tests for the Python server wrapper (subprocess forwarding)
- Marked with `@pytest.mark.unit`
- Run via pre-commit hook

**Coverage Tracking (7.5/10):**
- Codecov integration with token-based upload
- Separate coverage profiles: `coverage.out` (unit), `coverage-fvt.out` (FVT), `coverage-init.out` (init binary)
- Coverage range set to 50-75% (yellow/green thresholds)
- `fail_ci_if_error: true` ensures upload works
- **Gap**: No minimum coverage threshold enforcement — the range is display-only
- **Gap**: No PR coverage delta reporting configured

### Code Quality

**Linting (4/10):**
- Only `go vet` used for linting — no golangci-lint
- `go fmt` for formatting
- No static analysis beyond gosec

**Pre-commit Hooks (8/10):**
- Comprehensive `.pre-commit-config.yaml`:
  - Ruff linting and formatting for Python
  - trailing-whitespace, end-of-file-fixer, check-yaml, check-json, check-toml
  - check-merge-conflict, check-added-large-files (1000KB limit)
  - no-commit-to-branch (main) on pre-push
  - commitizen for conventional commit messages
  - mypy type checking for Python
  - pytest unit tests for Python
  - Go unit and integration tests
- Well-configured with appropriate excludes

**API Documentation:**
- OpenAPI 3.1.0 spec in `docs/src/`
- Redocly CLI for bundling, linting, and HTML generation
- Automated in CI — drift check ensures docs match code
- Unused component checking

**Commit Standards:**
- Conventional commits enforced via commitizen (pre-commit + CI)
- CodeRabbit configured for PR review

### Container Images

**Containerfile (Standard Build - 7/10):**
- Multi-stage build (builder → runtime)
- UBI9 base images (go-toolset for build, ubi-minimal for runtime)
- Multi-platform support (linux/amd64, linux/arm64) via QEMU + Buildx
- Non-root user (UID 1000, numeric for K8s runAsNonRoot)
- Go module caching in build stage
- OCI labels for metadata
- Image expiry annotations for non-release builds (12 weeks)
- Dry-run validation in CI (`eval-hub --local --help`)

**Dockerfile.konflux (RHOAI Build):**
- Pinned image digests (reproducible builds)
- FIPS-enabled Go build (`GOEXPERIMENT=strictfipsruntime`)
- CGO_ENABLED=1 for FIPS compliance
- Red Hat component labels
- Single binary (eval-hub only, no sidecar/init)

**Gaps:**
- No Trivy/Snyk/Grype vulnerability scanning
- No SBOM generation
- No image signing or attestation
- No runtime testing beyond `--help` dry-run
- LightEval Dockerfile uses unpinned pip dependencies

### Security Practices

**Present:**
- gosec security scanner with SARIF upload to GitHub Security tab
- SARIF results uploaded as artifacts
- Non-root container user
- FIPS-mode Go build in Konflux
- UBI9 base images (Red Hat supported)
- Hermetic Konflux builds

**Missing:**
- gosec runs with `-no-fail` — never blocks PRs
- No CodeQL analysis
- No Gitleaks secret detection
- No dependency vulnerability scanning (Dependabot alerts may be on at GitHub level)
- No container image scanning
- No SBOM generation

### Agent Rules (Agentic Flow Quality)

**Status**: Partial
- **CLAUDE.md**: Present and comprehensive — covers build commands, testing strategy, architecture patterns, configuration details, key abstractions
- **.claude/ directory**: Not present (no rules or skills)
- **Coverage**: CLAUDE.md documents unit test and FVT test patterns but doesn't provide creation rules
- **Quality**: CLAUDE.md is high-quality reference material for understanding the codebase
- **Gaps**: No `.claude/rules/` with test creation guidance, no test type-specific rules (unit-tests.md, fvt-tests.md, k8s-tests.md)
- **Recommendation**: Generate rules with `/test-rules-generator` covering:
  - Go unit test patterns (table-driven tests, handler testing with mock storage/runtime)
  - Godog FVT step definition patterns
  - Kubernetes resource specification tests

## Recommendations

### Priority 0 (Critical)
1. **Add container vulnerability scanning** — Trivy or Grype in CI, both for the standard Containerfile and Dockerfile.konflux
2. **Install golangci-lint** with comprehensive linter set — at minimum: errcheck, staticcheck, gosimple, gocritic, bodyclose, revive
3. **Make gosec fail on findings** — remove `-no-fail` flag, or add CodeQL as a separate blocking security check

### Priority 1 (High Value)
4. **Add PR-time Docker build smoke test** — build image on PRs (don't push) to catch Dockerfile regressions
5. **Enforce coverage thresholds** — add `project.default.threshold` to `codecov.yml` with minimum 60% coverage
6. **Create `.claude/rules/`** with test automation guidance covering unit, FVT, and Kubernetes resource test patterns
7. **Add PR coverage comments** — configure codecov to comment on PRs with coverage changes

### Priority 2 (Nice-to-Have)
8. **Add concurrency control** to CI workflows to cancel redundant runs
9. **Add Gitleaks** secret detection to pre-commit config and CI
10. **Generate SBOM** for container images (syft or similar)
11. **Add performance/load testing** for API endpoints (k6, vegeta, or hey)
12. **Pin LightEval Dockerfile dependencies** — currently unpinned pip installs
13. **Add API contract tests** for the OpenAPI spec (e.g., schemathesis or dredd)

## Comparison to Gold Standards

| Dimension | eval-hub-sobha | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit Tests | 8.5 (1.16:1 ratio, 45 files) | 9.0 (Jest, extensive) | 7.0 | 9.0 |
| Integration/E2E | 8.5 (godog BDD, 7 features) | 9.0 (Cypress E2E) | 6.0 | 9.0 |
| Build Integration | 7.0 (Konflux + CI build) | 8.0 (PR builds) | 8.0 | 7.0 |
| Image Testing | 6.0 (dry-run only) | 7.0 | 9.0 (5-layer) | 7.0 |
| Coverage | 7.5 (codecov, no threshold) | 9.0 (enforcement) | 5.0 | 9.0 (enforcement) |
| CI/CD | 8.0 (gosec, conventional commits) | 9.0 (comprehensive) | 8.0 | 9.0 |
| Agent Rules | 5.0 (CLAUDE.md only) | 8.0 (full .claude/rules/) | 3.0 | 2.0 |
| **Overall** | **7.6** | **8.7** | **6.6** | **7.4** |

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yml` — Main CI pipeline
- `.github/workflows/commitlint.yml` — Commit message linting
- `.github/workflows/publish-python-server.yml` — PyPI publishing
- `.github/workflows/sync-branch-*.yaml` — Branch sync workflows
- `.tekton/odh-eval-hub-pull-request.yaml` — Konflux PR pipeline
- `Makefile` — Build, test, lint, format targets

### Testing
- `auth/rules_test.go` — Auth rule tests
- `internal/eval_hub/handlers/*_test.go` — Handler unit tests (7 files)
- `internal/eval_hub/runtimes/k8s/*_test.go` — Kubernetes runtime tests (5 files)
- `internal/eval_hub/server/*_test.go` — Server/middleware tests (4 files)
- `internal/eval_hub/storage/sql/*_test.go` — Storage tests (5 files)
- `tests/features/*.feature` — BDD functional tests (5 features)
- `tests/kubernetes/features/*.feature` — Kubernetes resource tests (1 feature)
- `tests/mlflow/features/*.feature` — MLflow integration tests (1 feature)
- `python-server/tests/test_main.py` — Python wrapper tests

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks configuration
- `.cz.toml` — Commitizen configuration
- `.coderabbit.yaml` — CodeRabbit PR review configuration
- `CLAUDE.md` — Claude Code guidance

### Container Images
- `Containerfile` — Standard multi-stage container build
- `Dockerfile.konflux` — RHOAI/Konflux hermetic build
- `containers/lighteval/Dockerfile` — LightEval evaluation container

### Coverage
- `codecov.yml` — Codecov configuration (range 50-75%)

### Documentation
- `README.md` — Project overview and usage
- `ARCHITECTURE.md` — Technical architecture
- `CONTRIBUTING.md` — Contribution guidelines
- `docs/src/openapi.yaml` — OpenAPI 3.1.0 specification source
