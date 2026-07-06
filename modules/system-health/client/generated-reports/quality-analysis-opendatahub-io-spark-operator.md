---
repository: "opendatahub-io/spark-operator"
overall_score: 8.2
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "60 test files, strong controller/webhook coverage with Ginkgo + testify"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Multi-version E2E matrix (K8s v1.32-v1.35), dual deploy methods (Helm + Kustomize), Kueue integration tests"
  - dimension: "Build Integration"
    score: 7.5
    status: "PR-time Docker builds, Kustomize lint & drift detection, Tekton/Konflux pipelines configured"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage Docker builds, Kind-loaded image validation, but no container runtime scanning"
  - dimension: "Coverage Tracking"
    score: 8.0
    status: "Codecov with separate unit/e2e flags, auto-threshold enforcement on PRs"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "19 workflows, concurrency control, path-filtered triggers, reusable workflows"
  - dimension: "Agent Rules"
    score: 7.0
    status: "Comprehensive CLAUDE.md with project structure, build, test, and lint docs; no .claude/rules/"
critical_gaps:
  - title: "No container image vulnerability scanning"
    impact: "CVEs in base images or dependencies may reach production undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No SAST/CodeQL workflow"
    impact: "Go-specific security patterns (SQL injection, path traversal) not checked"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "Pre-commit hooks limited to Helm docs only"
    impact: "Linting and formatting checks only run in CI, not at commit time"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add Trivy scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Catch CVEs in base Spark images and Go dependencies before merge"
  - title: "Add CodeQL analysis workflow"
    effort: "1-2 hours"
    impact: "Automated Go security pattern detection on every PR"
  - title: "Expand pre-commit hooks with golangci-lint and gitleaks"
    effort: "1-2 hours"
    impact: "Shift lint and secret detection left to developer workstations"
  - title: "Create .claude/rules/ for test pattern guidance"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality with repo-specific patterns"
recommendations:
  priority_0:
    - "Add container image vulnerability scanning (Trivy) to PR and push workflows"
    - "Add CodeQL or gosec SAST workflow for Go security analysis"
  priority_1:
    - "Expand pre-commit hooks with golangci-lint, go-fmt, and gitleaks"
    - "Add container runtime validation (image startup + health check in Kind)"
    - "Create .claude/rules/ directory with unit-test, e2e-test, and webhook-test rules"
  priority_2:
    - "Add SBOM generation for container images"
    - "Add image signing/attestation with cosign"
    - "Add performance regression tests for reconciliation loops"
---

# Quality Analysis: spark-operator (opendatahub-io)

## Executive Summary

- **Overall Score: 8.2/10**
- **Repository Type**: Kubernetes Operator (Go, controller-runtime)
- **Primary Language**: Go 1.24
- **Framework**: Kubeflow Spark Operator (controller-runtime, Ginkgo, Helm, Kustomize)
- **Key Strengths**: Exceptional E2E matrix (4 K8s versions x 2 deploy methods), drift detection between Helm/Kustomize manifests, Codecov enforcement, comprehensive CI with 19 workflows, excellent CLAUDE.md documentation
- **Critical Gaps**: No container vulnerability scanning (Trivy/Snyk), no SAST/CodeQL workflow, minimal pre-commit hooks
- **Agent Rules Status**: Strong CLAUDE.md present; no `.claude/rules/` directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | 60 test files, 21.8K test lines, 0.38 test-to-code ratio |
| Integration/E2E | 9.0/10 | Multi-version matrix, dual deploy methods, Kueue integration |
| **Build Integration** | **7.5/10** | **PR Docker builds, Kustomize lint/drift, Tekton configured** |
| Image Testing | 7.0/10 | Multi-stage builds, Kind-loaded validation, no runtime scanning |
| Coverage Tracking | 8.0/10 | Codecov with unit + e2e-kustomize flags, auto-threshold |
| CI/CD Automation | 9.0/10 | 19 workflows, concurrency control, reusable workflows |
| Agent Rules | 7.0/10 | Comprehensive CLAUDE.md; no .claude/rules/ directory |

## Critical Gaps

### 1. No Container Image Vulnerability Scanning
- **Impact**: CVEs in the Spark base image (`docker.io/library/spark:4.0.1`) or Go dependencies could reach production undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Trivy, Snyk, or Grype integration found. The Dockerfile pulls from `docker.io/library/spark:4.0.1` and installs `catatonit` via apt-get — neither the base image nor installed packages are scanned for vulnerabilities.

### 2. No SAST/CodeQL Workflow
- **Impact**: Go-specific security patterns (path traversal in file handling, command injection, unsafe pointer usage) not detected
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: While Semgrep rules are present (`semgrep.yaml` with 62KB of rules covering Go, Python, TS, YAML, and secrets), there is no GitHub Actions workflow that runs Semgrep or CodeQL on PRs. The Scorecard workflow runs but only covers supply chain security metrics, not code-level analysis.

### 3. Pre-commit Hooks Limited to Helm Docs
- **Impact**: Linting, formatting, and secret detection only run in CI — developers can push unlinted code
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: `.pre-commit-config.yaml` only configures `helm-docs` generation. Missing hooks: `golangci-lint`, `gofmt`, `gitleaks`, `go-vet`.

## Quick Wins

### 1. Add Trivy Container Scanning (1-2 hours)
Add Trivy scanning to the integration workflow:
```yaml
- name: Scan Docker image with Trivy
  uses: aquasecurity/trivy-action@0.28.0
  with:
    image-ref: 'ghcr.io/kubeflow/spark-operator/controller:local'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
- name: Upload Trivy results
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: 'trivy-results.sarif'
```

### 2. Add CodeQL Analysis (1-2 hours)
Create `.github/workflows/codeql.yaml`:
```yaml
name: CodeQL
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v5
      - uses: github/codeql-action/init@v3
        with:
          languages: go
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

### 3. Expand Pre-commit Hooks (1-2 hours)
```yaml
repos:
  - repo: https://github.com/golangci/golangci-lint
    rev: v2.3.0
    hooks:
      - id: golangci-lint
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.24.0
    hooks:
      - id: gitleaks
  - repo: https://github.com/norwoodj/helm-docs
    rev: v1.13.1
    hooks:
      - id: helm-docs
        args:
          - --chart-search-root=charts
          - --template-files=README.md.gotmpl
          - --sort-values-order=file
```

### 4. Create Agent Rules for Test Patterns (2-3 hours)
Generate `.claude/rules/` with the `/test-rules-generator` skill to codify:
- Ginkgo BDD patterns for E2E tests
- envtest-based controller tests
- Webhook validation test patterns
- Kustomize overlay build test patterns

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (19 workflows)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `integration.yaml` | PR + push | Code checks, unit tests, Helm tests, E2E matrix (4 K8s x 2 deploy methods) |
| `kustomize-e2e.yaml` | PR + push | Kustomize E2E across 9 K8s versions (v1.24-v1.32) |
| `kustomize-lint.yaml` | PR + push | Static Kustomize manifest validation |
| `kustomize-drift-check.yaml` | PR + push | Helm ↔ Kustomize semantic drift detection |
| `codecov.yaml` | PR + push | Coverage upload to Codecov |
| `scheduledspark-smoke.yaml` | PR + push | ScheduledSparkApplication RBAC + smoke test |
| `integration-odh.yaml` | Push + dispatch | ODH Spark Pi E2E via Kind |
| `openshift-docling-e2e.yaml` | Push + dispatch | Docling E2E on EC2 self-hosted runners |
| `scorecard.yaml` | Schedule (weekly) | OpenSSF Scorecard supply-chain analysis |
| `build-quay.yaml` | Dispatch | Build & push to Quay.io |
| `pushImageToDPQuay.yaml` | Dispatch | Build Spark image to data-processing Quay |
| `release.yaml` | Release | Release builds |
| `release-latest-images.yaml` | Push (master) | Latest image publishing |
| `helm-release.yaml` | Push (Chart changes) | Helm chart release |
| `release-helm-charts.yaml` | Release published | Helm chart OCI publish |
| `check-release.yaml` | PR (release branches) | Semver version validation |
| `stale.yaml` | Schedule | Stale issue/PR management |
| `welcome-new-contributors.yaml` | PR | Contributor welcome message |
| `_run-kustomize-e2e.yaml` | Reusable | Shared Kustomize E2E workflow |

**Strengths**:
- Excellent concurrency control: all workflows use `cancel-in-progress: true`
- Path-filtered triggers reduce unnecessary CI runs
- Reusable workflow pattern (`_run-kustomize-e2e.yaml`) reduces duplication
- Multi-version K8s testing matrix (v1.32, v1.33, v1.34, v1.35)
- Dual deploy method testing (Helm + Kustomize) in E2E matrix
- Pinned action SHAs for supply chain security

**Gaps**:
- No Semgrep workflow despite having comprehensive `semgrep.yaml` rules
- No container scanning workflow
- No CodeQL/SAST workflow

### Test Coverage

**Test Distribution**:
- **60 test files** across the codebase
- **21,764 test lines** vs **57,702 source lines** (0.38 ratio)
- **Controller tests**: 6,960 test lines / 6,273 source lines (1.11 ratio — excellent)
- **Webhook tests**: 3,528 test lines / 1,933 source lines (1.83 ratio — excellent)

**Testing Frameworks**:
- **Ginkgo v2** (BDD framework) for E2E and integration tests
- **Gomega** matchers for assertions
- **testify** (assert + require) for unit tests
- **envtest** (controller-runtime) for controller tests with real API server
- **Helm chart testing** via `helm-unittest` plugin

**Unit Tests** (Score: 8.5/10):
- Strong coverage across core packages:
  - `internal/controller/sparkapplication/` — controller, submission, monitoring, web UI, event filter (7 test files)
  - `internal/controller/scheduledsparkapplication/` — controller, event filter (3 test files)
  - `internal/controller/sparkconnect/` — reconciler, options, util (4 test files)
  - `internal/webhook/` — all validators and defaulters (6 test files)
  - `pkg/util/` — utility functions, predicates, namespace filtering (6 test files)
  - `pkg/certificate/` — certificate management (3 test files)
  - `pkg/features/` — feature gate testing
  - `api/v1beta2/` — CRD defaults
- Uses `setup-envtest` for controller tests with real API server
- Coverage file generation: `cover-unit.out`

**E2E Tests** (Score: 9.0/10):
- **Helm workflow**: `test/e2e/` — Ginkgo BDD tests
  - `sparkapplication_test.go` — SparkApplication lifecycle
  - `sparkconnect_test.go` — SparkConnect CRD
  - `namespace_filtering_test.go` — Multi-namespace support
  - Matrix: 4 K8s versions x 2 deploy methods
- **Kustomize workflow**: `examples/openshift/tests/`
  - Shell-based tests: `test-operator-install.sh`, `test-spark-pi.sh`, `test-docling-spark.sh`
  - Go/Ginkgo tests: `examples/openshift/tests/e2e/`
  - 9 K8s versions tested (v1.24 through v1.32)
- **Kueue integration**: `examples/openshift/kueue/` — 4 test files (2,458 lines)
  - Queue validation, priority scheduling, multi-tenancy
- **ScheduledSpark smoke**: Dedicated workflow for RBAC + ScheduledSparkApplication

**Drift Tests** (Unique Strength):
- `test/drift/drift_test.go` — Go-based semantic drift detection
- Compares RBAC rules, webhook configs, and deployment specs between Helm chart and Kustomize manifests
- Prevents configuration drift between two installation methods

**Kustomize Tests**:
- `test/kustomize/overlay_build_test.go` — Validates all Kustomize overlays build successfully
- `test/kustomize/kustomize_build_test.go` — Static manifest validation

### Code Quality

**Linting** (Score: 8/10):
- `.golangci.yaml` with 8 enabled linters: `copyloopvar`, `dupword`, `importas`, `predeclared`, `tagalign`, `unconvert`, `unused`, `goimports`
- 2-minute timeout configured
- Import alias enforcement for Kubernetes API packages
- Missing: `gosec`, `errcheck`, `gocritic`, `staticcheck` (though some are enabled by default)

**Pre-commit Hooks** (Score: 3/10):
- Only `helm-docs` configured
- Missing: `golangci-lint`, `go-fmt`, `gitleaks`, `go-vet`

**Static Analysis**:
- Semgrep rules present (`semgrep.yaml`) — comprehensive 62KB config covering Go, Python, TypeScript, YAML, and secrets detection
- **But no workflow runs Semgrep** — rules exist but are not executed in CI
- Gitleaks configuration present (`.gitleaks.toml`) with comprehensive allowlists
- `.gitleaksignore` file present
- No evidence of Gitleaks running in CI workflows

**Dependabot**:
- Configured for `gomod`, `docker`, and `github-actions`
- Weekly update schedule

### Container Images

**Dockerfile Analysis** (Score: 7/10):
- Multi-stage build (Go builder → Spark runtime)
- Build caching via `--mount=type=cache` for Go modules and build cache
- Cross-platform support via `TARGETARCH` build arg
- Runs as non-root user (spark UID 185)
- Base image: `docker.io/library/spark:4.0.1`
- `.dockerignore` present

**Additional Dockerfiles**:
- `spark-docker/Dockerfile` — Spark base image
- `docker/Dockerfile.kubectl` — kubectl utility image
- `examples/openshift/Dockerfile` — OpenShift-specific build
- `examples/openshift/Dockerfile.odh` — ODH-specific build
- `spark-operator-module-controller.Dockerfile` — Module controller

**Gaps**:
- No vulnerability scanning (Trivy/Snyk/Grype)
- No SBOM generation
- No image signing/attestation
- No explicit health check in Dockerfile
- Multi-arch builds available via `docker-buildx` target and `pushImageToDPQuay.yaml` (amd64 + arm64)

### Security

**Supply Chain Security** (Score: 7/10):
- OpenSSF Scorecard integration (weekly schedule)
- Pinned GitHub Action SHAs in most workflows
- Dependabot for dependency updates (Go, Docker, GH Actions)
- Gitleaks configuration with comprehensive allowlists

**Application Security** (Score: 5/10):
- Semgrep rules defined but not run in CI
- No CodeQL/SAST workflow
- No container scanning
- SECURITY.md present with vulnerability reporting process

**Tekton/Konflux**:
- 5 Tekton pipeline configs in `.tekton/`
- Pull request, push, release, and CI variants
- Uses centralized `odh-konflux-central` pipeline definitions
- Proper build artifact and image tagging

### Agent Rules (Agentic Flow Quality)

**Status**: Strong CLAUDE.md present; no `.claude/rules/` directory

**CLAUDE.md Quality** (Score: 7/10):
- Excellent project structure documentation
- Clear build/test/lint commands with examples
- Dual test workflow documentation (Helm vs Kustomize)
- Key file references for all three CRDs
- CI workflow summary
- Debugging guidance
- Missing: No `.claude/` directory or rules for test creation patterns

**Gaps**:
- No `.claude/rules/` directory with test pattern rules
- No unit-test rule documenting Ginkgo/Gomega patterns
- No e2e-test rule documenting envtest + Kind setup patterns
- No webhook-test rule documenting validator/defaulter test patterns
- **Recommendation**: Run `/test-rules-generator` to generate comprehensive agent rules

## Recommendations

### Priority 0 (Critical)

1. **Add container image vulnerability scanning** (2-4 hours)
   - Integrate Trivy scanning into `integration.yaml` after `docker-build`
   - Upload SARIF results to GitHub Security tab
   - Set severity threshold (CRITICAL, HIGH)

2. **Enable Semgrep or CodeQL in CI** (2-3 hours)
   - Semgrep rules already exist (`semgrep.yaml`) — just needs a workflow
   - Alternatively, add CodeQL for Go analysis

### Priority 1 (High Value)

3. **Expand pre-commit hooks** (1-2 hours)
   - Add `golangci-lint`, `gitleaks`, `go-fmt` to `.pre-commit-config.yaml`
   - Shift quality checks left to developer workstations

4. **Add container runtime validation** (3-4 hours)
   - After building image in CI, verify startup + health endpoint in Kind
   - Check that entrypoint succeeds and operator starts correctly

5. **Create `.claude/rules/` test patterns** (2-3 hours)
   - Generate with `/test-rules-generator`
   - Cover: Ginkgo BDD, envtest controllers, webhook tests, Kustomize tests

### Priority 2 (Nice-to-Have)

6. **Add SBOM generation** (2 hours)
   - Use Syft or Trivy to generate CycloneDX/SPDX SBOMs
   - Attach to release artifacts

7. **Add image signing with cosign** (2-3 hours)
   - Sign images published to Quay.io and GHCR
   - Enable verification in deployment workflows

8. **Add reconciliation performance tests** (4-6 hours)
   - Benchmark controller reconciliation loop latency
   - Detect performance regressions from code changes

## Comparison to Gold Standards

| Dimension | spark-operator | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit Tests | 8.5 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 9.0 | 9.0 | 8.0 | 9.0 |
| Build Integration | 7.5 | 8.0 | 7.0 | 7.0 |
| Image Testing | 7.0 | 7.0 | 9.0 | 7.0 |
| Coverage Tracking | 8.0 | 9.0 | 6.0 | 9.0 |
| CI/CD Automation | 9.0 | 9.0 | 8.0 | 8.0 |
| Agent Rules | 7.0 | 9.0 | 3.0 | 3.0 |
| Container Scanning | 0.0 | 6.0 | 8.0 | 5.0 |
| SAST | 4.0 | 7.0 | 4.0 | 7.0 |

**Notable Strengths vs Gold Standards**:
- Drift detection between Helm/Kustomize is unique and exemplary
- Multi-version K8s matrix with dual deploy methods exceeds most projects
- Kueue integration tests show proactive quality investment
- ScheduledSparkApplication dedicated smoke test is thorough
- CLAUDE.md quality is among the best in the ecosystem

## File Paths Reference

### CI/CD
- `.github/workflows/integration.yaml` — Main PR/push CI (code checks, unit tests, helm, E2E)
- `.github/workflows/kustomize-e2e.yaml` — Kustomize E2E across 9 K8s versions
- `.github/workflows/kustomize-lint.yaml` — Static Kustomize validation
- `.github/workflows/kustomize-drift-check.yaml` — Helm/Kustomize drift detection
- `.github/workflows/codecov.yaml` — Coverage upload
- `.github/workflows/scheduledspark-smoke.yaml` — ScheduledSpark RBAC + smoke
- `.github/workflows/_run-kustomize-e2e.yaml` — Reusable Kustomize E2E
- `.tekton/` — 5 Konflux pipeline definitions

### Testing
- `test/e2e/` — Ginkgo E2E tests (Helm + Kustomize deploy methods)
- `test/drift/` — Helm/Kustomize drift detection tests
- `test/kustomize/` — Kustomize overlay build validation
- `examples/openshift/tests/` — OpenShift integration tests (shell + Go)
- `examples/openshift/kueue/` — Kueue integration tests (4 files, 2.5K lines)
- `internal/controller/*/` — Controller unit tests (envtest)
- `internal/webhook/` — Webhook validator/defaulter tests
- `charts/spark-operator-chart/tests/` — Helm chart unit tests

### Code Quality
- `.golangci.yaml` — 8 linters enabled
- `.pre-commit-config.yaml` — Helm docs only
- `semgrep.yaml` — Comprehensive rules (not run in CI)
- `.gitleaks.toml` — Secret detection config
- `.gitleaksignore` — Gitleaks exceptions

### Container Images
- `Dockerfile` — Main operator image (multi-stage, cached builds)
- `spark-docker/Dockerfile` — Spark base image
- `examples/openshift/Dockerfile.odh` — ODH-specific build
- `.dockerignore` — Build context exclusions

### Coverage
- `.codecov.yml` — Codecov with unit + e2e-kustomize flags, 1% threshold

### Agent Rules
- `CLAUDE.md` — Comprehensive project documentation (159 lines)
