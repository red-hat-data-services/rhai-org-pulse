---
repository: "red-hat-data-services/model-registry"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Strong coverage across Go, Python, and TypeScript with 148 Go test files, 36 Python tests, 55 TS specs, and Testcontainers for integration"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Comprehensive E2E suites: Python client KinD-based E2E with multi-K8s/multi-Python matrix, CSI E2E, controller envtest, 22 Cypress component tests, fuzz testing"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time image build + KinD operator deployment + Python client smoke test; but no PR-time Konflux simulation"
  - dimension: "Image Testing"
    score: 7.0
    status: "PR builds server image, loads into KinD, deploys via operator, validates with Python client; UI image build tested on PR; but no container-level health/startup probes validation"
  - dimension: "Coverage Tracking"
    score: 7.5
    status: "Codecov integration for Go and Python E2E with fail_ci_if_error:true; no explicit coverage threshold/gates in config"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "33 workflows covering build, test, lint, image scanning, OpenAPI validation, DB schema checks, go mod tidy, autogen sync, fuzz testing, scorecard"
  - dimension: "Agent Rules"
    score: 8.0
    status: "Excellent AGENTS.md with repo map, commands, conventions, security checklist; CLAUDE.md identical to AGENTS.md; no .claude/rules/ directory for test-specific rules"
critical_gaps:
  - title: "No PR-time Konflux build simulation"
    impact: "Konflux builds use FIPS-mode Go flags and pinned base images; divergence from PR builds can cause post-merge failures"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No coverage threshold enforcement"
    impact: "Coverage can silently regress; Codecov uploads data but no minimum gate blocks PRs"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "Trivy scanning is periodic-only (weekly), not on PRs"
    impact: "Vulnerable dependencies can be merged without detection; weekly scan only catches existing images"
    severity: "MEDIUM"
    effort: "3-4 hours"
  - title: "No UI E2E tests against real backend"
    impact: "22 Cypress tests are all mocked; no integration test validates UI + BFF + model-registry server end-to-end"
    severity: "MEDIUM"
    effort: "16-24 hours"
quick_wins:
  - title: "Add .codecov.yml with coverage thresholds"
    effort: "1-2 hours"
    impact: "Prevent coverage regressions by blocking PRs that drop below baseline"
  - title: "Add Trivy scan step to build-image-pr.yml"
    effort: "2-3 hours"
    impact: "Catch vulnerable dependencies before merge rather than weekly post-hoc"
  - title: "Create .claude/rules/ directory with test-type-specific rules"
    effort: "3-4 hours"
    impact: "Improve AI-generated test quality with framework-specific patterns for Go/Python/TS"
  - title: "Add golangci-lint config file with explicit linter selection"
    effort: "1-2 hours"
    impact: "Currently uses defaults; explicit config ensures consistent quality and enables stricter checks"
recommendations:
  priority_0:
    - "Add Konflux build simulation to PR workflow (FIPS flags, pinned base images) to catch build divergence pre-merge"
    - "Add Trivy vulnerability scanning to PR-triggered image build workflow"
  priority_1:
    - "Add .codecov.yml with project/patch coverage thresholds (e.g., 70% project, 80% patch)"
    - "Add non-mocked UI E2E tests that exercise BFF + model-registry server in KinD"
    - "Create .claude/rules/ with test-specific rules for Go (testify+testcontainers), Python (pytest+nox), TS (jest+cypress)"
  priority_2:
    - "Add golangci-lint configuration file with explicit linter selection beyond defaults"
    - "Add SBOM attestation to PR-time image builds (Syft config already exists)"
    - "Add performance/load testing for REST API endpoints"
    - "Consider CodeQL/SAST integration for PR-time static analysis"
---

# Quality Analysis: model-registry (Kubeflow Hub)

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Polyglot monorepo (Go server + Python clients + TypeScript/React UI + Go BFF)
- **Key Strengths**: Exceptional CI/CD automation (33 workflows), comprehensive E2E testing with multi-version K8s matrix, strong agent rules (AGENTS.md), PR-time image build + KinD deployment validation, Testcontainers-based integration tests, fuzz testing
- **Critical Gaps**: No PR-time Konflux simulation, no coverage threshold enforcement, Trivy scanning periodic-only, no real-backend UI E2E tests
- **Agent Rules Status**: Present and comprehensive (AGENTS.md), but no `.claude/rules/` directory for test-specific guidance

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Strong coverage: 148 Go test files (0.32 test:source ratio), 36 Python tests, 55 TS specs, 22 Cypress component tests, 39 BFF Go tests |
| Integration/E2E | 8.5/10 | KinD-based E2E for Python client (multi-K8s v1.33+v1.34, multi-Python 3.10-3.14, dual DB), CSI E2E, controller envtest, fuzz testing |
| **Build Integration** | **7.0/10** | **PR builds image + deploys to KinD via operator + smoke tests with Python client; no Konflux simulation** |
| Image Testing | 7.0/10 | PR-time image build + KinD deployment + operator validation; UI image build tested; no container health probe validation |
| Coverage Tracking | 7.5/10 | Codecov for Go + Python with fail_ci_if_error; no thresholds/gates configured |
| CI/CD Automation | 9.0/10 | 33 workflows; path-filtered triggers; concurrency control; OpenAPI/DB schema/go.mod sync checks |
| Agent Rules | 8.0/10 | Excellent AGENTS.md; no .claude/rules/ for test patterns |

## Critical Gaps

### 1. No PR-time Konflux Build Simulation
- **Impact**: Konflux Dockerfile uses `CGO_ENABLED=1 GOOS=linux GOEXPERIMENT=strictfipsruntime go build -tags strictfipsruntime` with pinned `@sha256` base images. PR `Dockerfile` uses `CGO_ENABLED=0` without FIPS. Build divergence can cause post-merge Konflux failures.
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Evidence**: `Dockerfile.konflux` vs `Dockerfile` show different build flags and base images. Tekton pipelines in `.tekton/` trigger on label/comment only, not automatically.

### 2. No Coverage Threshold Enforcement
- **Impact**: Coverage can silently regress. Codecov uploads succeed/fail on token, not on coverage level.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Evidence**: `build.yml` uses `codecov/codecov-action` with `fail_ci_if_error: true` (upload failure), but no `.codecov.yml` exists to set project/patch thresholds.

### 3. Trivy Scanning is Periodic-Only
- **Impact**: Vulnerabilities in newly-added dependencies are not caught until weekly Monday scan.
- **Severity**: MEDIUM
- **Effort**: 3-4 hours
- **Evidence**: `trivy-image-scanning.yaml` triggers on `schedule: '0 0 * * 1'` and `workflow_dispatch` only.

### 4. No Real-Backend UI E2E Tests
- **Impact**: All 22 Cypress tests use mocked data (`tests/mocked/`). UI + BFF + server integration issues are not caught.
- **Severity**: MEDIUM
- **Effort**: 16-24 hours
- **Evidence**: `clients/ui/frontend/src/__tests__/cypress/cypress/tests/mocked/` — all tests are in `mocked/` directory.

## Quick Wins

### 1. Add `.codecov.yml` with Coverage Thresholds
- **Effort**: 1-2 hours
- **Impact**: Prevent coverage regressions
- **Implementation**:
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
```

### 2. Add Trivy Scan to PR Image Build
- **Effort**: 2-3 hours
- **Impact**: Catch vulnerabilities before merge
- **Implementation**: Add Trivy step after `make image/build` in `build-image-pr.yml`:
```yaml
- name: Run Trivy vulnerability scan
  uses: aquasecurity/trivy-action@latest
  with:
    image-ref: '${{ env.IMG }}:${{ steps.tags.outputs.tag }}'
    format: 'table'
    exit-code: '1'
    severity: 'CRITICAL,HIGH'
```

### 3. Create `.claude/rules/` Directory
- **Effort**: 3-4 hours
- **Impact**: Improve AI-generated test quality
- **Rules needed**: `unit-tests.md` (Go testify, Python pytest, TS jest), `integration-tests.md` (Testcontainers patterns), `e2e-tests.md` (KinD deployment patterns), `cypress-tests.md` (PatternFly component testing)

### 4. Add Explicit golangci-lint Configuration
- **Effort**: 1-2 hours
- **Impact**: Currently uses defaults; explicit config enables stricter checks
- **Implementation**: Create `.golangci.yml` with explicitly enabled linters beyond defaults

## Detailed Findings

### CI/CD Pipeline

**Strengths (9.0/10)**:
- **33 workflow files** covering every aspect of the repository
- **Path-filtered triggers**: Controller tests only run on controller changes, CSI tests on CSI changes, UI tests on UI changes
- **Multi-version testing matrix**: Python E2E runs on K8s v1.33 + v1.34, Python 3.10-3.14, MySQL + PostgreSQL
- **Autogen sync checks**: 4 separate workflows verify generated code is in sync (OpenAPI, Python client, DB schema structs, go mod tidy)
- **OpenSSF Scorecard**: Supply-chain security scoring on push to main
- **First-time contributor workflow**: Automated PR approval gate
- **Fuzz testing**: Dedicated workflow triggered on API spec changes

**Gaps**:
- Trivy scanning is weekly, not PR-triggered
- No CodeQL/SAST workflow
- No caching strategy for Go modules in main build workflow (though go-mod-tidy uses `actions/cache`)

### Test Coverage

**Strengths (8.5/10)**:

| Component | Test Files | Framework | Notes |
|-----------|-----------|-----------|-------|
| Go server (internal/pkg) | 148 | Go testing + testify + Testcontainers | MySQL + PostgreSQL integration tests |
| Python client | 36 | pytest + nox | Unit + E2E on KinD |
| UI Frontend (TS) | 55 | Jest (unit) | Component-level tests |
| UI Frontend (Cypress) | 22 | Cypress | All mocked, no real backend |
| UI BFF (Go) | 39 | Go testing + testify | API handler + K8s client tests |
| Controller | 2 | envtest (kubebuilder) | K8s controller tests |
| Async upload | ~10 | pytest | Unit + integration + E2E |
| Catalog | ~5 | Go testing + pytest | Server + Python client |

**Test-to-Code Ratios**:
- Go: 148 test files / 467 source files = **0.32** (solid)
- Python: 36 test files (good E2E coverage)
- TypeScript: 55 spec files / 396 source files = **0.14** (could be higher)

**Gaps**:
- No coverage thresholds configured
- All Cypress tests use mocked data
- TypeScript test-to-code ratio is low

### Code Quality

**Strengths**:
- **golangci-lint v2.9.0** used (latest v2) via `golangci/golangci-lint-action`
- **Pre-commit hooks** configured: check-json, check-merge-conflict, detect-private-key, ruff (Python)
- **Gitleaks** configured for secret detection
- **Ruff** for Python linting + formatting
- **mypy** for Python type checking
- **go vet** run as part of build

**Gaps**:
- No `.golangci.yml` config file (uses defaults — misses opportunity for stricter checks)
- No ESLint configuration visible for TypeScript (UI may have its own)
- Pre-commit hooks don't include Go linting
- No CodeQL/SAST integration

### Container Images

**Strengths (7.0/10)**:
- **4 Dockerfiles**: `Dockerfile` (upstream), `Dockerfile.odh` (ODH), `Dockerfile.konflux` (FIPS/Konflux), `Dockerfile.testops`
- **Multi-stage builds** in all Dockerfiles
- **Distroless/UBI-minimal** base images
- **Non-root user** (65532:65532 or 1001)
- **PR-time image build + KinD deployment** validates the image actually works
- **Syft config** (`.syft.yaml`) for SBOM generation (excludes UI)
- **Tekton pipelines** for Konflux builds with hermetic builds and prefetch

**Gaps**:
- `Dockerfile` (upstream) uses `CGO_ENABLED=0` while `Dockerfile.konflux` uses `CGO_ENABLED=1 GOEXPERIMENT=strictfipsruntime` — no PR-time Konflux simulation
- No Trivy/vulnerability scan on PR-built images
- No multi-architecture CI testing (Dockerfile supports `BUILDPLATFORM`/`TARGETARCH` but not tested in CI)

### Security

**Strengths**:
- Gitleaks configured for secret detection
- OpenSSF Scorecard running weekly + on push to main
- Trivy image scanning (weekly) with SARIF upload to GitHub Security tab
- Hardened permissions (`contents: read`) on all workflows
- Pinned action SHAs in all workflows (supply-chain security)
- `detect-private-key` pre-commit hook

**Gaps**:
- No CodeQL/SAST integration
- Trivy scanning is periodic, not PR-triggered
- No dependency review action on PRs
- Gitleaks runs as pre-commit only, not in CI

### Agent Rules (Agentic Flow Quality)

**Status**: Present and Comprehensive (8.0/10)

**Strengths**:
- **AGENTS.md** is exemplary: repository map, full command reference, CI check table, agent behavior policy, security checklist, auto-generated file warnings
- **CLAUDE.md** exists (identical content to AGENTS.md)
- Covers Go, Python, and TypeScript conventions
- Explicit "Agents must NOT" section with guardrails
- Testing requirements documented (bug fixes must include tests)
- Database and OpenAPI change workflows documented

**Gaps**:
- **No `.claude/rules/` directory** — no test-type-specific rules for AI agents
- **No `.claude/skills/`** — no custom AI skills defined
- Missing test-pattern-specific guidance (e.g., "how to write a Testcontainers test", "how to write a Cypress test", "how to write a controller envtest")
- CLAUDE.md is a copy of AGENTS.md rather than being Claude-specific

**Recommendation**: Generate test-specific rules using `/test-rules-generator` for:
- Go unit tests (testify patterns)
- Go integration tests (Testcontainers + MySQL/PostgreSQL)
- Controller tests (envtest patterns)
- Python E2E tests (nox + KinD patterns)
- Cypress component tests (mocked + PatternFly patterns)

## Recommendations

### Priority 0 (Critical)

1. **Add Konflux build simulation to PR workflow**
   - Run a FIPS-mode Go build step in `build-image-pr.yml` to catch build flag divergence
   - Test with `CGO_ENABLED=1 GOEXPERIMENT=strictfipsruntime go build -tags strictfipsruntime`
   - Effort: 8-12 hours

2. **Add Trivy vulnerability scanning to PR image builds**
   - Add Trivy step to `build-image-pr.yml` after image build
   - Fail on CRITICAL/HIGH severity
   - Effort: 3-4 hours

### Priority 1 (High Value)

3. **Add `.codecov.yml` with coverage thresholds**
   - Set project target (auto with 2% threshold) and patch target (80%)
   - Prevents silent coverage regression
   - Effort: 1-2 hours

4. **Add non-mocked UI E2E tests**
   - Create Cypress or Playwright tests against real BFF + model-registry in KinD
   - Validates actual data flow through the stack
   - Effort: 16-24 hours

5. **Create `.claude/rules/` directory with test-specific rules**
   - `unit-tests.md`: Go testify + Python pytest + TS jest patterns
   - `integration-tests.md`: Testcontainers for MySQL/PostgreSQL
   - `e2e-tests.md`: KinD deployment + Python client patterns
   - `cypress-tests.md`: PatternFly component testing patterns
   - Effort: 3-4 hours

6. **Add Gitleaks to CI workflow**
   - Currently pre-commit only; should also run in CI for enforcement
   - Effort: 1-2 hours

### Priority 2 (Nice-to-Have)

7. **Add explicit `.golangci.yml` configuration**
   - Enable additional linters beyond defaults (errcheck, gosec, gocritic, etc.)
   - Effort: 1-2 hours

8. **Add CodeQL/SAST integration**
   - GitHub-native static analysis on PRs
   - Effort: 2-4 hours

9. **Add dependency review action**
   - `actions/dependency-review-action` to flag risky dependency additions on PRs
   - Effort: 1 hour

10. **Add performance/load testing**
    - REST API load testing for model-registry endpoints
    - Effort: 8-16 hours

## Comparison to Gold Standards

| Dimension | model-registry | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit Tests | 8.5 | 9.0 | 7.0 | 8.0 |
| Integration/E2E | 8.5 | 9.0 | 8.0 | 9.0 |
| Build Integration | 7.0 | 7.0 | 8.0 | 6.0 |
| Image Testing | 7.0 | 6.0 | 9.0 | 7.0 |
| Coverage Tracking | 7.5 | 8.0 | 5.0 | 9.0 |
| CI/CD Automation | 9.0 | 9.0 | 8.0 | 8.0 |
| Agent Rules | 8.0 | 9.0 | 3.0 | 4.0 |
| **Overall** | **7.6** | **8.2** | **7.0** | **7.4** |

**Relative Strengths vs. Gold Standards**:
- CI/CD automation matches odh-dashboard level (9.0)
- E2E testing with multi-K8s/multi-Python matrix is exceptional
- Agent rules (AGENTS.md) are among the best in the ecosystem
- Fuzz testing is a unique strength not found in other repos

**Areas Where Gold Standards Excel**:
- odh-dashboard: Coverage thresholds, contract tests, comprehensive `.claude/rules/`
- notebooks: 5-layer image validation, multi-architecture testing
- kserve: Coverage enforcement with strict thresholds, multi-version K8s testing

## File Paths Reference

### CI/CD Workflows
- `.github/workflows/build.yml` — Build + unit tests + Codecov
- `.github/workflows/build-image-pr.yml` — PR image build + KinD deployment
- `.github/workflows/build-image-ui-pr.yml` — UI image build test
- `.github/workflows/controller-test.yml` — Controller envtest
- `.github/workflows/csi-test.yml` — CSI E2E on KinD
- `.github/workflows/python-tests.yml` — Python lint + unit + E2E (matrix)
- `.github/workflows/async-upload-test.yml` — Async job tests
- `.github/workflows/trivy-image-scanning.yaml` — Weekly Trivy scan
- `.github/workflows/scorecard.yml` — OpenSSF Scorecard
- `.github/workflows/test-fuzz.yml` — Fuzz testing
- `.github/workflows/check-db-schema-structs.yaml` — DB schema sync check
- `.github/workflows/check-openapi-spec-pr.yaml` — OpenAPI validation
- `.github/workflows/go-mod-tidy-diff-check.yml` — Go module sync
- `.github/workflows/ui-bff-build.yml` — BFF lint + build
- `.github/workflows/ui-frontend-build.yml` — Frontend test + build

### Testing
- `internal/db/service/*_test.go` — Testcontainers integration tests (MySQL + PostgreSQL)
- `pkg/inferenceservice-controller/*_test.go` — Controller tests (envtest)
- `clients/python/tests/` — Python client tests
- `clients/ui/frontend/src/__tests__/cypress/` — Cypress component tests
- `clients/ui/bff/internal/` — BFF Go tests
- `test/csi/e2e_test.sh` — CSI E2E script
- `jobs/async-upload/` — Async upload job tests

### Quality Tools
- `.pre-commit-config.yaml` — Pre-commit hooks
- `.gitleaks.toml` — Secret detection config
- `.syft.yaml` — SBOM generation config
- `Makefile` — Build/test/lint targets

### Container Images
- `Dockerfile` — Upstream server image
- `Dockerfile.odh` — ODH server image
- `Dockerfile.konflux` — FIPS/Konflux server image
- `Dockerfile.testops` — Test operations image
- `clients/ui/Dockerfile` — UI image
- `jobs/async-upload/Dockerfile` — Async upload job image
- `.tekton/` — Konflux Tekton pipelines

### Agent Rules
- `AGENTS.md` — Comprehensive agent behavior guide
- `CLAUDE.md` — Claude-specific rules (identical to AGENTS.md)
