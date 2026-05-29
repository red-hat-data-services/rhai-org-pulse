---
repository: "red-hat-data-services/data-science-pipelines"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "568 test files across Go/Python/Frontend, multi-Python-version matrix, but no unified coverage enforcement"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Exceptional E2E infrastructure with Kind clusters, multi-K8s-version matrix, Argo version compat, proxy/cache toggles, upgrade tests, and frontend integration"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time image builds for all components via reusable workflow; no Konflux simulation or startup validation"
  - dimension: "Image Testing"
    score: 5.5
    status: "12+ Dockerfiles with multi-stage builds and FIPS support; no image runtime validation, no startup checks, no multi-arch CI matrix"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "pytest-cov installed but not uploaded; no codecov/coveralls integration; no Go coverage; no coverage thresholds or PR gates"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "50+ workflows with concurrency control, path filters, composite actions, caching, matrix strategies, JUnit summaries, and automated label gating"
  - dimension: "Agent Rules"
    score: 7.0
    status: "CLAUDE.md and AGENTS.md present with comprehensive architecture, testing, and coding policies; no .claude/rules/ with test-type-specific rules"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Coverage regressions go undetected; no visibility into test quality"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No container image runtime validation"
    impact: "Image startup failures not caught until deployment; 12+ images built without runtime checks"
    severity: "HIGH"
    effort: "6-10 hours"
  - title: "CodeQL/Trivy only run on schedule, not PR-gated"
    impact: "Security vulnerabilities can be merged before weekly scan catches them"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "Go unit test workflow uses outdated Go 1.21"
    impact: "Unit tests may pass on stale Go version while failing on production Go version (1.24+)"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "Pre-commit workflow is disabled in downstream"
    impact: "golangci-lint and formatting enforcement not active on PRs in the downstream fork"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add codecov integration with coverage thresholds"
    effort: "4-6 hours"
    impact: "Visibility into coverage trends; PR-level coverage gating prevents regressions"
  - title: "Enable Trivy scan on PRs (already runs on push)"
    effort: "1 hour"
    impact: "Block vulnerable code from merging instead of discovering it weekly"
  - title: "Update unit-tests.yaml Go version to match go.mod"
    effort: "30 minutes"
    impact: "Unit tests validate against the actual production Go version"
  - title: "Add image startup validation step to image-builds workflow"
    effort: "3-4 hours"
    impact: "Catch container startup failures before E2E tests"
  - title: "Create .claude/rules/ with test-type-specific agent rules"
    effort: "2-3 hours"
    impact: "AI agents produce higher-quality, framework-consistent tests"
recommendations:
  priority_0:
    - "Implement codecov or coveralls integration for both Go and Python with PR-level coverage reporting and minimum thresholds"
    - "Add container image runtime validation (startup + health check) to the image-builds.yml reusable workflow"
    - "Update unit-tests.yaml to use Go version from go.mod (currently 1.21 vs go.mod 1.24+)"
  priority_1:
    - "Gate CodeQL and Trivy scans on PRs, not just scheduled runs, to catch vulnerabilities pre-merge"
    - "Enable or replace the disabled pre-commit workflow for downstream with golangci-lint PR checks"
    - "Add Go coverage reporting to backend unit test workflows"
    - "Create .claude/rules/ directory with framework-specific test rules for Ginkgo, pytest, and Vitest"
  priority_2:
    - "Add multi-architecture image build matrix (amd64/arm64) to CI"
    - "Add SBOM generation to image-builds workflow (syft config already exists)"
    - "Add image signing/attestation pipeline"
    - "Add secret detection (Gitleaks/TruffleHog) to PR workflow"
    - "Add performance regression testing for API server endpoints"
---

# Quality Analysis: data-science-pipelines

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Polyglot monorepo — Go backend (KFP API server, driver, launcher), Python SDK, React 19 TypeScript frontend
- **Key Strengths**: Exceptional CI/CD automation with 50+ workflows, comprehensive E2E test infrastructure spanning multiple K8s versions/Argo versions/pipeline stores, well-structured composite actions, and thorough CLAUDE.md agent documentation
- **Critical Gaps**: No coverage tracking or enforcement across any language, no container image runtime validation, security scanning only on schedule (not PR-gated), and a unit test workflow pinned to an outdated Go version
- **Agent Rules Status**: Present (CLAUDE.md + AGENTS.md with extensive guidance), but no `.claude/rules/` directory with test-type-specific rules

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | 568 test files (156 Go, 250 Python, 162 Frontend), multi-Python-version matrix |
| Integration/E2E | 9.0/10 | Kind-based E2E with K8s version matrix, Argo compat, proxy/cache toggles, upgrade tests |
| **Build Integration** | **7.0/10** | **PR-time image builds for 12+ components; no Konflux simulation or startup validation** |
| Image Testing | 5.5/10 | Multi-stage Dockerfiles with FIPS support; no runtime validation or multi-arch CI |
| Coverage Tracking | 3.0/10 | pytest-cov installed but never uploaded; no codecov; no Go coverage; no thresholds |
| CI/CD Automation | 9.0/10 | 50+ workflows, concurrency control, path filters, composite actions, JUnit summaries |
| Agent Rules | 7.0/10 | Comprehensive CLAUDE.md/AGENTS.md; no .claude/rules/ for test-type-specific guidance |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: Coverage regressions go completely undetected. No visibility into which code paths are tested across Go, Python, or Frontend
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: `pytest-cov` is installed in SDK test workflows (`kfp-sdk-tests.yml`, `kfp-sdk-unit-tests.yml`) and the `--cov=kfp` flag is used in the test script, but coverage reports are never uploaded to any service. No `.codecov.yml` exists. Go backend unit tests have no coverage flags at all. Frontend Vitest has coverage commands (`npm run test:ui:coverage`) but no CI-level coverage enforcement or reporting.

### 2. No Container Image Runtime Validation
- **Impact**: 12+ container images are built on PRs via `image-builds.yml` but never validated for startup, health checks, or basic functionality before being used in E2E tests
- **Severity**: HIGH
- **Effort**: 6-10 hours
- **Details**: The `image-builds.yml` workflow builds images and pushes to a Kind registry, but there's no step to verify that built images actually start, respond to health endpoints, or pass basic smoke tests. Issues are only discovered when E2E tests fail, making debugging harder.

### 3. Security Scanning Not PR-Gated
- **Impact**: Vulnerable code can be merged and only discovered during weekly scheduled scans
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: CodeQL runs only on `schedule` (weekly, Fridays at 19:39). Trivy runs on PRs AND push AND schedule, which is better, but CodeQL is completely absent from PR checks. Adding `pull_request` trigger to CodeQL would catch SAST issues pre-merge.

### 4. Unit Test Workflow Uses Outdated Go Version
- **Impact**: Backend unit tests may pass on Go 1.21 but fail on the production Go version (go.mod specifies 1.24+)
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: `unit-tests.yaml` uses `go-version: '1.21.x'` and `actions/setup-go@v4`, while the actual backend Dockerfile uses `go-toolset:1.26` and `go.mod` likely specifies 1.24+. Other workflows use a `.github/actions/setup-go` composite action that likely picks up the correct version — this workflow doesn't.

### 5. Pre-commit Workflow Disabled Downstream
- **Impact**: golangci-lint, YAPF, isort, pycln, and other formatting/linting checks are not enforced on PRs
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: `pre-commit.yml` has `on: []` (disabled) with a comment "This workflow is disabled in downstream because we require linting upstream." The `.pre-commit-config.yaml` itself is comprehensive (golangci-lint v2, YAPF, isort, pycln, docformatter, flake8, actionlint) but is not enforced in CI.

## Quick Wins

### 1. Add Codecov Integration (4-6 hours)
- Create `.codecov.yml` with coverage thresholds
- Upload Python SDK coverage from `kfp-sdk-unit-tests.yml` and `kfp-sdk-tests.yml`
- Add `--coverprofile` to Go unit tests and upload
- Add codecov upload to frontend coverage job

### 2. Enable Trivy on CodeQL Schedule → PR Trigger (1 hour)
- Add `pull_request:` trigger to `codeql.yml` (Trivy already runs on PRs)

### 3. Update unit-tests.yaml Go Version (30 minutes)
- Replace `go-version: '1.21.x'` with `.github/actions/setup-go` composite action
- Update `actions/checkout@v3` → `v6` and `actions/setup-go@v4` → latest

### 4. Add Image Startup Validation (3-4 hours)
- After image build, add a step that starts each image and verifies exit code 0 / health endpoint response
- Can use `docker run --rm` with timeout for basic startup check

### 5. Create .claude/rules/ Test Rules (2-3 hours)
- Create `unit-tests.md` with Go (standard `testing` + Ginkgo), Python (`pytest`), and Frontend (`Vitest + Testing Library`) patterns
- Create `e2e-tests.md` with Ginkgo E2E patterns, Kind cluster setup, and label-filter conventions
- Reference existing patterns from CLAUDE.md

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory** (50+ workflows):
- **PR-triggered** (path-filtered): `unit-tests.yaml`, `kfp-sdk-tests.yml`, `kfp-sdk-unit-tests.yml`, `frontend.yml`, `e2e-test.yml`, `api-server-tests.yml`, `compiler-tests.yml`, `integration-tests-v1.yml`, `e2e-test-frontend.yml`, `upgrade-test.yml`, `trivy.yml`, `build-prs.yml`, `kfp-kubernetes-library-test.yml`, `gcpc-modules-tests.yml`
- **Push-only**: Several workflows run on push to `master/main/stable/rhoai-*`
- **Scheduled**: `codeql.yml` (weekly), `trivy.yml` (weekly + push + PR), `stale.yml`
- **Workflow-dispatch**: Most test workflows support manual triggers with parameters

**Concurrency Control**: Excellent — most workflows use `concurrency:` with `cancel-in-progress: true` keyed on PR number or ref.

**Caching**: Python pip caching via `actions/cache@v5` and `setup-python` cache. Kind node images cached by K8s version. npm caching in frontend.

**Composite Actions**: Well-structured reusable actions in `.github/actions/`:
- `create-cluster` — Kind cluster provisioning
- `deploy` — KFP deployment
- `kfp-k8s` — SDK component installation
- `test-and-report` — Test execution with reporting
- `junit-summary` — JUnit test summary generation
- `protobuf` — Proto dependency setup
- `setup-go` — Standardized Go setup

**Test Matrices**: Comprehensive multi-dimensional testing:
- Kubernetes versions: v1.29.2, v1.31.0, v1.34.0
- Argo versions: v3.5.14, v3.7.3, v4.0.4
- Pipeline stores: database, kubernetes
- Cache enabled/disabled
- Proxy enabled/disabled
- Pod-to-pod TLS enabled/disabled
- Python versions: 3.9, 3.13

### Test Coverage

**Unit Tests (568 total test files)**:
- **Go** (156 test files): Standard `testing` package + Ginkgo for structured suites. Backend unit tests run via `go test ./backend/src/...` excluding integration/E2E/compiler directories.
- **Python** (250 test files): pytest with markers (regression), parallel execution (`pytest-xdist`), multi-Python-version matrix (3.9, 3.13). SDK tests cover compiler, DSL, client, and local execution.
- **Frontend** (162 test files): Vitest + Testing Library v16 with coverage support. `npm run test:ci` runs format check + lint + typecheck + React peer check + Vitest coverage.
- **Test-to-code ratio**: Go: 156/662 = 0.24 | Python: 250/1162 = 0.22 | Frontend: 162/456 = 0.36

**Integration/E2E Tests**:
- Backend API integration tests (`backend/test/v2/api`) — Ginkgo-based, run on Kind clusters with label filtering
- Compiler tests (`backend/test/compiler`) — Golden file comparison
- E2E pipeline tests (`backend/test/end2end`) — Full pipeline execution with GPU test support
- Frontend integration tests — WebDriverIO-based containerized tests
- Upgrade tests — Validates upgrade paths
- Legacy v1 API integration tests

**Coverage Tracking**: NOT IMPLEMENTED
- `pytest-cov` is installed and `--cov=kfp` is used in test scripts, but coverage reports are never uploaded to any coverage service
- No `.codecov.yml` or equivalent configuration
- Go tests have no coverage instrumentation
- Frontend has `test:ui:coverage` target but no CI upload

### Code Quality

**Linting**:
- **Go**: golangci-lint v2 with `.golangci.yaml` — enables gocritic, govet, ineffassign, misspell, staticcheck, unused. Formatters: gofmt, goimports. 30-minute timeout.
- **Python**: YAPF (formatting), isort (import ordering), pycln (unused import removal), docformatter (docstring formatting), flake8 (W605 only)
- **Frontend**: ESLint (extends react-app), Prettier (single quotes, trailing commas, 100 char width)
- **Workflow linting**: actionlint in pre-commit config

**Pre-commit Hooks**: `.pre-commit-config.yaml` is comprehensive but the CI workflow is disabled (`on: []`). Includes check-yaml, check-json, end-of-file-fixer, trailing-whitespace, debug-statements, check-merge-conflict, name-tests-test, no-commit-to-branch.

**Static Analysis**:
- CodeQL: Go, JavaScript, Python — but scheduled only (weekly)
- golangci-lint: staticcheck enabled
- mypy: configured but `ignore_missing_imports = true` weakens type checking

### Container Images

**Build Process**:
- 12+ Dockerfiles for backend components (apiserver, persistenceagent, scheduledworkflow, launcher, driver, frontend, metadata-writer, viewer-crd-controller, visualization-server, cache-deployer, etc.)
- Multi-stage builds throughout
- FIPS-compliant build support (`FIPS_ENABLED=1` with `strictfipsruntime`)
- Base images: UBI9 Go toolset, UBI9 Python 3.11, Node.js slim/alpine
- `image-builds.yml` reusable workflow builds all images in matrix on PRs

**Runtime Testing**: NONE
- No image startup validation
- No health check verification
- No smoke tests against built images
- E2E tests implicitly test images but failures are harder to diagnose

**Security Scanning**:
- Trivy: Filesystem scan on PRs/push/schedule, CRITICAL+HIGH severity, SARIF upload to GitHub Security tab
- No image-level Trivy scan (only repo filesystem)
- Syft: `.syft.yaml` configured to exclude non-backend components for SBOM, but no SBOM generation workflow

**Multi-architecture**: FIPS build supports `TARGETOS`/`TARGETARCH` args but CI only builds for single architecture (linux/amd64).

### Security

**Strengths**:
- Trivy vulnerability scanning active on PRs and push
- CodeQL SAST for Go, JavaScript, Python
- FIPS-compliant builds with strict runtime enforcement
- Pinned action versions with SHA hashes in some workflows
- SARIF upload to GitHub Security tab
- Dependabot or similar dependency scanning (not examined in detail)

**Gaps**:
- No secret detection tool (Gitleaks/TruffleHog)
- CodeQL only on schedule, not PR-gated
- No image signing or attestation
- No SBOM generation workflow despite Syft config
- `mypy.ini` with `ignore_missing_imports = true` reduces type safety

### Agent Rules (Agentic Flow Quality)

**Status**: Present — CLAUDE.md and AGENTS.md exist with identical comprehensive content

**Coverage**:
- Architecture overview with end-to-end flow diagrams
- Detailed testing policy (unit test requirements, test-passing prerequisites)
- Code reuse and architectural boundary policies
- Commit policy (DCO sign-off, no AI co-authors)
- Local development setup, testing commands, and troubleshooting
- CI/CD documentation with test matrices and workflow path verification
- React effect discipline guidelines
- Generated file protections

**Quality**: Excellent — comprehensive, actionable, framework-specific, and regularly maintained (last updated 2026-05-06)

**Gaps**:
- No `.claude/` directory or `.claude/rules/` with test-type-specific rules
- No structured rules for Ginkgo E2E test patterns
- No rules for pytest marker conventions
- No rules for Vitest/Testing Library patterns
- The testing guidance in CLAUDE.md is documentation-style, not rule-style (no checklists, no mandatory patterns)

**Recommendation**: Generate `.claude/rules/` with test-type-specific rules via `/test-rules-generator` to complement the excellent CLAUDE.md documentation

## Recommendations

### Priority 0 (Critical)

1. **Implement coverage tracking and enforcement**
   - Add `.codecov.yml` with project and patch coverage thresholds (e.g., 60% project, 80% patch)
   - Upload Python SDK coverage from test workflows
   - Add `--coverprofile=coverage.out` to Go unit test workflow
   - Upload frontend Vitest coverage
   - Add PR check that blocks on coverage regression

2. **Add container image runtime validation**
   - After `image-builds.yml` completes, add a step to start each image with `docker run --rm --timeout 30s`
   - Verify health/readiness endpoints where applicable
   - Catch startup failures before E2E tests attempt to use the images

3. **Fix unit-tests.yaml Go version drift**
   - Replace `go-version: '1.21.x'` with the `.github/actions/setup-go` composite action
   - Update checkout and setup actions to latest versions

### Priority 1 (High Value)

4. **Enable CodeQL on PR triggers**
   - Add `pull_request:` to `codeql.yml` to catch SAST issues pre-merge
   - Consider path filters to avoid running on unrelated changes

5. **Restore pre-commit/linting enforcement on PRs**
   - Re-enable the pre-commit workflow or create a dedicated linting workflow
   - At minimum, run golangci-lint on PRs for Go changes

6. **Add Go backend coverage reporting**
   - Add `--coverprofile` to `go test` commands
   - Upload to codecov alongside Python coverage

7. **Create `.claude/rules/` test-type-specific rules**
   - `unit-tests.md`: Go testing + Ginkgo patterns, pytest patterns, Vitest + Testing Library patterns
   - `e2e-tests.md`: Ginkgo E2E with label filters, Kind cluster expectations, test data conventions
   - `integration-tests.md`: API server test patterns, compiler golden file tests

### Priority 2 (Nice-to-Have)

8. **Add multi-architecture image build matrix** — Extend CI to build and test linux/arm64 alongside amd64
9. **Add SBOM generation workflow** — Syft config exists; add a workflow step to generate and publish SBOMs
10. **Add image signing/attestation** — Cosign or Sigstore integration for supply chain security
11. **Add secret detection** — Gitleaks or TruffleHog scanning on PRs
12. **Add performance regression testing** — Benchmark API server endpoints and pipeline compilation time
13. **Strengthen mypy configuration** — Remove `ignore_missing_imports = true` where possible

## Comparison to Gold Standards

| Dimension | data-science-pipelines | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|-----------|----------------------|---------------------|------------------|---------------|
| Unit Tests | 7.5 — Good coverage, no enforcement | 9 — Multi-layer, enforced | 7 — Focused on image validation | 9 — Coverage enforcement |
| Integration/E2E | 9.0 — Exceptional multi-dimensional | 8 — Contract tests | 7 — Image testing | 9 — Multi-version |
| Build Integration | 7.0 — PR image builds | 8 — Full build validation | 7 — Image builds | 7 — Operator builds |
| Image Testing | 5.5 — Build-only, no runtime | 7 — Some runtime tests | 9 — 5-layer validation | 6 — Basic validation |
| Coverage Tracking | 3.0 — Not implemented | 9 — Codecov enforced | 5 — Basic tracking | 9 — Thresholds enforced |
| CI/CD Automation | 9.0 — Best-in-class | 9 — Comprehensive | 8 — Well-organized | 8 — Matrix testing |
| Agent Rules | 7.0 — CLAUDE.md excellent, no rules/ | 9 — Full rules directory | 4 — Minimal | 5 — Basic |

## File Paths Reference

### CI/CD
- `.github/workflows/` — 50+ workflow files
- `.github/actions/` — Composite actions (create-cluster, deploy, kfp-k8s, etc.)
- `.github/resources/` — CI manifests and overlays
- `Makefile` — Root build targets (ginkgo, check-diff, test-backend-visualization)

### Testing
- `backend/test/` — Go test suites (compiler, v2/api, end2end, integration)
- `sdk/python/kfp/` — Python SDK tests alongside source
- `frontend/src/` — Frontend test files (*.spec.ts, *.test.ts)
- `test/` — Integration test scripts and infrastructure
- `test_data/` — Pipeline files, compiled workflows, GPU test data
- `pytest.ini` — Python test configuration
- `mypy.ini` — Python type checking

### Code Quality
- `.golangci.yaml` — Go linter configuration (v2, 6 linters enabled)
- `.pre-commit-config.yaml` — Pre-commit hooks (disabled in CI)
- `frontend/.eslintrc.yaml` — ESLint config
- `frontend/.prettierrc.yaml` — Prettier config

### Container Images
- `backend/Dockerfile` — API server (multi-stage, FIPS, UBI9)
- `backend/Dockerfile.*` — Component-specific Dockerfiles
- `frontend/Dockerfile` — Frontend (Node.js multi-stage)
- `.syft.yaml` — SBOM scope configuration

### Security
- `.github/workflows/trivy.yml` — Vulnerability scanning
- `.github/workflows/codeql.yml` — SAST analysis

### Agent Rules
- `CLAUDE.md` — Comprehensive agent guide (680+ lines)
- `AGENTS.md` — Identical content to CLAUDE.md
