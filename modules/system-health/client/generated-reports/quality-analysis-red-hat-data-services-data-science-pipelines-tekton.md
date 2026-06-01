---
repository: "red-hat-data-services/data-science-pipelines-tekton"
overall_score: 4.5
scorecard:
  - dimension: "Unit Tests"
    score: 5.5
    status: "Multi-language unit tests (Go, Python, TS) but no coverage tracking or enforcement"
  - dimension: "Integration/E2E"
    score: 5.0
    status: "Kind-based integration and E2E in CI but conditional, limited scenarios, and outdated tooling"
  - dimension: "Build Integration"
    score: 3.5
    status: "PR image builds to Quay but no Konflux simulation, no image validation, no startup testing"
  - dimension: "Image Testing"
    score: 2.5
    status: "21 Dockerfiles with no runtime validation, no vulnerability scanning in CI, no SBOM"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No codecov/coveralls, no coverage thresholds, no PR coverage reporting"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "GitHub Actions + Travis CI + Cloud Build + Tekton — fragmented across 4 CI systems with outdated actions"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude directory, no agent rules or test automation guidance"
critical_gaps:
  - title: "No code coverage tracking or enforcement"
    impact: "Cannot measure test effectiveness or regression; blind spots in untested code paths"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container vulnerability scanning in CI"
    impact: "Security vulnerabilities in base images and dependencies not caught before deployment"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Fragmented CI across 4 systems (GitHub Actions, Travis CI, Cloud Build, Tekton)"
    impact: "Maintenance burden, inconsistent test execution, confusion about which system is authoritative"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No PR-time Konflux build simulation or image runtime validation"
    impact: "Build failures and image startup issues discovered only after merge"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "Outdated GitHub Actions versions (actions/checkout@v2, actions/setup-python@v2)"
    impact: "Security risk from deprecated action versions; potential CI failures as runners deprecate Node 12/16"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No agent rules for AI-assisted test generation"
    impact: "AI agents cannot generate tests following project conventions; inconsistent test quality"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Upgrade GitHub Actions to latest versions (checkout@v4, setup-python@v5, setup-go@v5)"
    effort: "1-2 hours"
    impact: "Eliminate security warnings, prevent future CI breakage from deprecated Node runtimes"
  - title: "Add Trivy container scanning to PR workflow"
    effort: "2-3 hours"
    impact: "Catch CVEs in all 21 container images before they reach production"
  - title: "Add Go coverage reporting with -coverprofile and upload to codecov"
    effort: "3-4 hours"
    impact: "Visibility into Go backend test coverage; foundation for enforcement thresholds"
  - title: "Create basic CLAUDE.md with test patterns and conventions"
    effort: "2-3 hours"
    impact: "Enable AI agents to generate tests consistent with existing patterns"
  - title: "Remove Travis CI config (.travis.yml) — all jobs duplicated in GitHub Actions"
    effort: "1 hour"
    impact: "Reduce CI fragmentation and maintenance burden"
recommendations:
  priority_0:
    - "Consolidate CI to a single system (GitHub Actions) — remove Travis CI and evaluate Cloud Build/Tekton pipeline needs"
    - "Add code coverage tracking with codecov for Go, Python, and frontend (TypeScript)"
    - "Add container vulnerability scanning (Trivy) to all image builds in CI"
    - "Upgrade all GitHub Actions to latest versions to eliminate security risks"
  priority_1:
    - "Add PR-time Konflux build simulation to catch build issues before merge"
    - "Add container image runtime validation (startup checks) for all built images"
    - "Implement pre-commit hooks for linting enforcement"
    - "Add CODEOWNERS file for mandatory review on critical paths"
    - "Create comprehensive agent rules (.claude/rules/) for test automation"
  priority_2:
    - "Add SBOM generation to container image builds"
    - "Implement secret detection (gitleaks) in CI"
    - "Add Go golangci-lint configuration for stricter static analysis"
    - "Add performance regression tests for pipeline execution"
    - "Implement multi-architecture image builds"
---

# Quality Analysis: data-science-pipelines-tekton

## Executive Summary

- **Overall Score: 4.5/10**
- **Repository**: [red-hat-data-services/data-science-pipelines-tekton](https://github.com/red-hat-data-services/data-science-pipelines-tekton)
- **Type**: Kubeflow Pipelines Tekton backend — polyglot monorepo (Go backend + Python SDK + TypeScript frontend)
- **Primary Languages**: Go (432 source, 69 test files), Python (112 source, 50 test files), TypeScript (192 source, 93 test files)

### Key Strengths
- Multi-language unit testing across Go, Python, and TypeScript with reasonable test-to-code ratios
- PR image builds with automated Quay publishing and PR comments with deployment instructions
- Integration testing with Kind cluster deployment and E2E pipeline execution
- Frontend has strict TypeScript config (`strict: true`) and ESLint configuration
- Tekton testdata validation ensures compiled pipeline YAML stays in sync

### Critical Gaps
- **No code coverage tracking** — zero visibility into test effectiveness across all three languages
- **No container vulnerability scanning** — 21 Dockerfiles with no Trivy/Snyk scanning in CI
- **Fragmented CI** — 4 parallel CI systems (GitHub Actions, Travis CI, Cloud Build, Tekton) with overlapping jobs
- **Outdated tooling** — GitHub Actions using deprecated v2 actions; Python 3.6/3.7 in matrix (EOL)
- **No agent rules** — zero AI test automation guidance

### Agent Rules Status: **Missing** — No CLAUDE.md, no `.claude/` directory, no test automation rules

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 5.5/10 | Multi-language tests but no coverage tracking or enforcement |
| Integration/E2E | 5.0/10 | Kind-based integration in CI but conditional execution and limited scenarios |
| **Build Integration** | **3.5/10** | **PR image builds to Quay but no Konflux sim, no startup testing** |
| Image Testing | 2.5/10 | 21 Dockerfiles, no runtime validation, no vulnerability scanning |
| Coverage Tracking | 1.0/10 | No codecov, no thresholds, no PR reporting |
| CI/CD Automation | 5.0/10 | Functional but fragmented across 4 systems with outdated actions |
| Agent Rules | 0.0/10 | No CLAUDE.md, no .claude directory, no agent rules |

## Critical Gaps

### 1. No Code Coverage Tracking or Enforcement
- **Impact**: Cannot measure test effectiveness; no way to detect coverage regression
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Go tests use `-cover` flag in Makefile but output is not captured. No `.codecov.yml` or `.coveragerc`. No PR coverage reporting. No coverage thresholds.
- **Recommendation**: Add `-coverprofile=coverage.out` to Go tests, `coverage` to Python tests, and configure codecov for all three languages.

### 2. No Container Vulnerability Scanning
- **Impact**: Base image CVEs and dependency vulnerabilities not caught before production
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: 21 Dockerfiles across the monorepo. `.snyk` file exists but only excludes directories (`tekton-catalog/**`, `frontend/**`). No Trivy, no CodeQL, no Snyk scanning in any CI workflow.
- **Recommendation**: Add Trivy scanning step to `build-prs.yml` and `build-master.yml` workflows.

### 3. Fragmented CI Across 4 Systems
- **Impact**: Maintenance burden, confusion about authoritative tests, inconsistent execution
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**:
  - **GitHub Actions** (`.github/workflows/`): Unit tests, PR image builds, master image builds — 7 workflow files
  - **Travis CI** (`.travis.yml`): Duplicates Go/Python unit tests, lint, license checks — largely redundant with GitHub Actions
  - **Google Cloud Build** (`.cloudbuild.yaml`, `.release.cloudbuild.yaml`): Full build pipeline with E2E testing
  - **Tekton** (`.tekton/`): CI/CD pipeline with IBM Cloud deployment and testing
- **Recommendation**: Consolidate to GitHub Actions as primary CI. Archive Travis CI config. Evaluate if Cloud Build and Tekton pipelines serve unique needs.

### 4. No PR-time Konflux/Build Simulation
- **Impact**: Build and image startup failures discovered only post-merge
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: PR workflow builds images to Quay but does not validate image startup, health endpoints, or deployment manifests. No Konflux pipeline integration for pre-merge validation.

### 5. Outdated GitHub Actions and Python Versions
- **Impact**: Security risk from deprecated actions using Node 12/16; Python 3.6/3.7 are EOL
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**:
  - `actions/checkout@v2` → should be `@v4`
  - `actions/setup-python@v2` → should be `@v5`
  - `actions/setup-go@v2` → should be `@v5`
  - Python matrix: `[3.7, 3.8, 3.9]` — all 3.7 references should be 3.9+ minimum
  - Go version: `1.19.x` — should be updated to current stable

### 6. No Agent Rules for Test Automation
- **Impact**: AI agents cannot generate tests consistent with project conventions
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory. No test creation rules or patterns documented for AI agents.

## Quick Wins

### 1. Upgrade GitHub Actions to Latest Versions
- **Effort**: 1-2 hours
- **Impact**: Eliminate deprecation warnings, prevent future CI breakage
- **Implementation**:
  ```yaml
  # Replace in all workflows:
  - uses: actions/checkout@v4        # was @v2
  - uses: actions/setup-python@v5    # was @v2
  - uses: actions/setup-go@v5        # was @v2
  ```

### 2. Add Trivy Container Scanning
- **Effort**: 2-3 hours
- **Impact**: Detect CVEs in all container images before merge
- **Implementation**:
  ```yaml
  - name: Run Trivy vulnerability scanner
    uses: aquasecurity/trivy-action@master
    with:
      image-ref: 'quay.io/${{ env.QUAY_ORG }}/${{ matrix.image }}:${{ env.TARGET_IMAGE_TAG }}'
      format: 'table'
      exit-code: '1'
      severity: 'CRITICAL,HIGH'
  ```

### 3. Add Go Coverage Reporting
- **Effort**: 3-4 hours
- **Impact**: Gain visibility into backend test coverage
- **Implementation**:
  ```makefile
  run-apiserver-unittests:
  	go test -v -cover -coverprofile=coverage-apiserver.out ./backend/src/apiserver/...
  ```
  ```yaml
  - name: Upload coverage to Codecov
    uses: codecov/codecov-action@v4
    with:
      files: ./coverage-*.out
      flags: backend
  ```

### 4. Remove Travis CI Configuration
- **Effort**: 1 hour
- **Impact**: Eliminate redundant CI system; reduce confusion
- **Details**: All Travis CI jobs (unit tests, lint, license check, build verification) are already covered by `kfp-tekton-unittests.yml` in GitHub Actions.

### 5. Create Basic CLAUDE.md
- **Effort**: 2-3 hours
- **Impact**: Enable AI-assisted development with consistent test patterns
- **Implementation**: Document Go test patterns (testify/suite), Python unittest patterns, TypeScript React Testing Library patterns, and file naming conventions.

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (GitHub Actions):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `kfp-tekton-unittests.yml` | PR + push to master | Python unit tests (3.7-3.9), Go unit tests, testdata validation, flake8 lint, license/doc checks, backend integration with Kind |
| `build-prs-trigger.yaml` | PR (open/reopen/sync/close) | Saves PR metadata as artifacts |
| `build-prs.yml` | workflow_run (after trigger) | Builds 5 images to Quay, comments on PR with image tags, cleans up on close |
| `build-master.yml` | push to master | Builds 5 images with commit-based tags, pushes latest tags |
| `build-images.yaml` | workflow_call + workflow_dispatch | Reusable image build workflow for releases |
| `tag-release-quay.yml` | (not analyzed in detail) | Release tagging |
| `add-issues-to-*-project.yml` | Issue events | Project board automation |

**Strengths:**
- Concurrency control on PR builds (`cancel-in-progress: true`)
- Matrix strategy for multi-image builds
- Automated PR comments with test image references and deployment instructions
- Image cleanup when PRs are closed
- Conditional backend integration (only runs when backend files change)

**Weaknesses:**
- All actions use deprecated v2 versions
- No caching of Go modules or Python dependencies
- No parallelization of independent test jobs beyond matrix
- No workflow reuse (no composite actions for common patterns)
- Travis CI runs duplicate jobs alongside GitHub Actions

### Test Coverage

**Go Tests (69 test files / 432 source files = 16% test-to-code ratio):**
- **Backend unit tests**: apiserver, common utilities, CRD controllers, cache server, persistence agent
- **Integration tests**: `backend/test/integration/` — API-level integration using Kind cluster with testify/suite
- **Pipeline-loops tests**: `tekton-catalog/pipeline-loops/` — controller reconciler tests
- **Framework**: Standard Go testing + `testify` (assert, suite) + `google/go-cmp`
- **Gap**: Low test-to-code ratio; no coverage measurement

**Python Tests (50 test files / 112 source files = 45% test-to-code ratio):**
- **SDK compiler tests**: `sdk/python/tests/compiler/` — compiler output validation against golden YAML files
- **API client tests**: `backend/api/python_http_client/test/` — auto-generated client tests
- **E2E tests**: `sdk/python/tests/compiler/compiler_tests_e2e.py` — requires live cluster
- **Framework**: `unittest` (no pytest), `flake8` for linting
- **Gap**: No pytest adoption; no coverage measurement

**Frontend Tests (93 test files / 192 source files = 48% test-to-code ratio):**
- **Component tests**: `frontend/src/pages/*.test.tsx` — page-level React component tests
- **Framework**: React Testing Library (via react-scripts/jest)
- **Strengths**: Good test-to-code ratio; strict TypeScript config
- **Gap**: ESLint ignores all test files (`*.test.ts`, `*.test.tsx`); no coverage tracking

### Code Quality

**Linting:**
- **Python**: `flake8` with selective error codes (`E9,E2,E3,E5,F63,F7,F82,F4,F841,W291,W292`), max-line-length=140
- **TypeScript**: ESLint extending `react-app` with limited custom rules
- **Go**: No `golangci-lint` configuration — relies on default `go vet` only
- **pylintrc**: Present (`.pylintrc`) but not used in any CI workflow

**Pre-commit Hooks:** None (no `.pre-commit-config.yaml`)

**Static Analysis:**
- No CodeQL workflow
- No gosec
- No Semgrep
- `.snyk` exists but only as an exclusion config

**Documentation Checks:**
- License header verification (all source files)
- Markdown ToC validation
- Markdown link verification

### Container Images

**Dockerfile Inventory (21 Dockerfiles):**

| Image | Dockerfile | Base |
|-------|-----------|------|
| api-server | `backend/Dockerfile` | `ubi8/go-toolset:1.21` → `ubi8/ubi-minimal` |
| frontend | `frontend/Dockerfile` | `node:14.18.2` → `node:14.21.3-alpine` |
| persistence-agent | `backend/Dockerfile.persistenceagent` | `ubi8/go-toolset:1.21` |
| scheduled-workflow | `backend/Dockerfile.scheduledworkflow` | `ubi8/go-toolset:1.21` |
| cache-server | `backend/Dockerfile.cacheserver` | `golang:1.19.3-alpine3.15` |
| visualization | `backend/Dockerfile.visualization` | (not analyzed) |
| viewer-controller | `backend/Dockerfile.viewercontroller` | (not analyzed) |
| artifact-manager | `backend/artifact_manager/Dockerfile` | (not analyzed) |
| metadata-writer | `backend/metadata_writer/Dockerfile` | (not analyzed) |
| pipeline-loops | `tekton-catalog/pipeline-loops/Dockerfile` | (not analyzed) |
| + 11 more | Various paths | Various bases |

**Findings:**
- **Inconsistent base images**: Mix of UBI8, Alpine, and plain upstream images
- **Outdated base images**: `node:14.18.2` (Node.js 14 is EOL), `golang:1.19.3-alpine` (Go 1.19 is EOL)
- **No health checks** in any Dockerfile (no `HEALTHCHECK` instruction)
- **No vulnerability scanning** in CI pipelines
- **No SBOM generation**
- **No image signing/attestation**
- **Multi-stage builds**: Used in backend and frontend (good)
- **No multi-architecture support**: All builds target single architecture
- **No `.dockerignore` optimization**: Single `.dockerignore` at root, minimal excludes

### Security

| Practice | Status |
|----------|--------|
| Container scanning (Trivy/Snyk) | Not present in CI |
| SAST/CodeQL | Not configured |
| Dependency scanning | Not configured |
| Secret detection | Not configured |
| SBOM generation | Not configured |
| Image signing | Not configured |
| `.snyk` policy | Present but only excludes directories |
| License compliance | `go-licenses.yaml` for Go dependencies |
| Supply chain (SLSA) | Not configured |

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **`.claude/` directory**: Not present
- **`.claude/rules/`**: Not present
- **Coverage**: No test types have agent rules
- **Quality**: N/A
- **Gaps**: All test types missing rules (unit, integration, E2E, contract, image testing)
- **Recommendation**: Generate rules with `/test-rules-generator` for Go (testify patterns), Python (unittest patterns), and TypeScript (React Testing Library patterns)

## Recommendations

### Priority 0 (Critical)

1. **Consolidate CI to GitHub Actions**
   - Remove `.travis.yml` — all jobs are already duplicated in GitHub Actions
   - Evaluate whether `.cloudbuild.yaml` and `.tekton/pipeline.yaml` serve unique deployment needs vs. being legacy
   - Consolidate all test, lint, and build jobs into GitHub Actions workflows

2. **Add Code Coverage Tracking**
   - Add `-coverprofile` to Go test commands
   - Add `coverage` to Python test runner
   - Configure `codecov` or `coveralls` for PR reporting
   - Set minimum coverage thresholds (start at current baseline)

3. **Add Container Vulnerability Scanning**
   - Add Trivy action to `build-prs.yml` and `build-master.yml`
   - Set severity threshold to `CRITICAL,HIGH`
   - Add `.trivyignore` for known acceptable CVEs

4. **Upgrade All GitHub Actions Versions**
   - `actions/checkout@v2` → `@v4`
   - `actions/setup-python@v2` → `@v5`
   - `actions/setup-go@v2` → `@v5`
   - `actions/upload-artifact@v2` → `@v4`
   - `actions/github-script@v3.1.0` → `@v7`

### Priority 1 (High Value)

5. **Add PR-time Konflux Build Simulation**
   - Test image startup in Kind cluster during PR CI
   - Validate health endpoints after deployment
   - Check deployment manifest generation (kustomize build)

6. **Add Container Image Runtime Validation**
   - Startup verification for all built images
   - Health check endpoint validation
   - Configuration loading verification

7. **Implement Pre-commit Hooks**
   - Add `.pre-commit-config.yaml` with flake8, golangci-lint, prettier
   - Enforce consistent formatting across all languages

8. **Add CODEOWNERS File**
   - Mandate review from backend/frontend/SDK owners for respective paths
   - Require security review for Dockerfile and CI changes

9. **Create Agent Rules for Test Automation**
   - `.claude/rules/unit-tests.md` — Go testify patterns, Python unittest, TypeScript Jest/RTL
   - `.claude/rules/integration-tests.md` — Kind cluster setup, API integration patterns
   - `.claude/rules/e2e-tests.md` — Pipeline E2E testing patterns

### Priority 2 (Nice-to-Have)

10. **Add SBOM Generation** — Generate SBOMs for all container images using Syft or similar
11. **Add Secret Detection** — Integrate gitleaks into CI for detecting leaked credentials
12. **Add golangci-lint Configuration** — Enable stricter Go linting beyond default `go vet`
13. **Add Performance Regression Testing** — Benchmark pipeline compilation and execution
14. **Implement Multi-architecture Builds** — Support ARM64 alongside AMD64
15. **Upgrade Python Version Matrix** — Replace 3.6/3.7 with 3.10+; adopt pytest over unittest
16. **Upgrade Node.js Base Images** — Replace Node 14 (EOL) with Node 18+ LTS

## Comparison to Gold Standards

| Dimension | data-science-pipelines-tekton | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|-----------|-------------------------------|---------------------|-------------------|---------------|
| Unit Test Coverage | 5.5 - Multi-lang tests, no coverage | 9.0 - Coverage enforcement | 7.0 - Notebook validation | 9.0 - Coverage thresholds |
| Integration/E2E | 5.0 - Kind + conditional E2E | 9.0 - Multi-layer E2E | 8.0 - 5-layer validation | 9.0 - Multi-version E2E |
| Build Integration | 3.5 - PR image builds only | 8.0 - Full Konflux sim | 7.0 - Image testing | 7.0 - Build validation |
| Image Testing | 2.5 - No scanning/validation | 7.0 - Trivy + runtime | 9.0 - 5-layer image testing | 7.0 - Image validation |
| Coverage Tracking | 1.0 - None | 9.0 - Codecov + thresholds | 6.0 - Basic tracking | 9.0 - Strict enforcement |
| CI/CD Automation | 5.0 - Fragmented (4 systems) | 9.0 - Consolidated GHA | 8.0 - Organized workflows | 8.0 - Efficient CI |
| Agent Rules | 0.0 - None | 8.0 - Comprehensive rules | 3.0 - Basic rules | 2.0 - Minimal |
| **Overall** | **4.5** | **8.7** | **7.0** | **7.6** |

## File Paths Reference

### CI/CD
- `.github/workflows/kfp-tekton-unittests.yml` — Main unit test and lint workflow
- `.github/workflows/build-prs.yml` — PR image builds
- `.github/workflows/build-prs-trigger.yaml` — PR trigger for image builds
- `.github/workflows/build-master.yml` — Master branch image builds
- `.github/workflows/build-images.yaml` — Reusable image build workflow
- `.github/actions/build/action.yaml` — Composite action for podman builds
- `.travis.yml` — Legacy Travis CI (redundant)
- `.cloudbuild.yaml` — Google Cloud Build pipeline
- `.release.cloudbuild.yaml` — Release Cloud Build pipeline
- `.tekton/pipeline.yaml` — Tekton CI/CD pipeline

### Testing
- `backend/src/*/.../*_test.go` — Go backend unit tests
- `backend/test/integration/` — Go backend integration tests
- `sdk/python/tests/compiler/` — Python SDK compiler tests
- `sdk/python/tests/run_tests.sh` — Python unit test runner
- `sdk/python/tests/run_e2e_tests.sh` — Python E2E test runner
- `frontend/src/pages/*.test.tsx` — Frontend component tests
- `tests/basictests/ds-pipelines.sh` — OpenShift-based E2E tests
- `tekton-catalog/pipeline-loops/pkg/reconciler/pipelinelooprun/pipelinelooprun_test.go` — Pipeline loop controller tests

### Code Quality
- `.pylintrc` — Python lint config (not used in CI)
- `frontend/.eslintrc.yaml` — Frontend ESLint config
- `frontend/tsconfig.json` — TypeScript strict config
- `Makefile` — Build and test targets

### Container Images
- `backend/Dockerfile` — API server image
- `backend/Dockerfile.persistenceagent` — Persistence agent image
- `backend/Dockerfile.scheduledworkflow` — Scheduled workflow image
- `backend/Dockerfile.cacheserver` — Cache server image
- `frontend/Dockerfile` — Frontend UI image
- `backend/artifact_manager/Dockerfile` — Artifact manager image
- `backend/metadata_writer/Dockerfile` — Metadata writer image
- `.dockerignore` — Docker build excludes

### Security
- `.snyk` — Snyk exclusion policy
- `go-licenses.yaml` — Go license compliance config
