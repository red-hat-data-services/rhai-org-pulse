---
repository: "kserve/kserve"
overall_score: 8.2
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Strong Go unit tests with envtest, comprehensive Python pytest suites across 9+ server runtimes"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Outstanding E2E suite with 87 test files, Minikube-based, multi-network-layer coverage (Istio, Kourier, Gateway API)"
  - dimension: "Build Integration"
    score: 7.5
    status: "PR-time image builds for E2E, but no Konflux simulation or production-build validation"
  - dimension: "Image Testing"
    score: 7.0
    status: "26 Dockerfiles with multi-stage builds and distroless base, but no image startup validation or SBOM generation"
  - dimension: "Coverage Tracking"
    score: 8.5
    status: "go-test-coverage with 80% threshold, PR coverage reporting, master baseline comparison"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "46 workflows, concurrency control, path-filtered triggers, smart matrix strategies, merge queue support"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules for test automation"
critical_gaps:
  - title: "No agent rules for AI-assisted development"
    impact: "AI coding agents have no guidance on test patterns, frameworks, or quality standards"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No Konflux/production build simulation on PRs"
    impact: "Build failures in production build systems only caught post-merge"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "No SBOM generation or image signing"
    impact: "Supply chain security gaps, no software bill of materials for container images"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No Python code coverage tracking or enforcement"
    impact: "Python SDK and server runtimes lack coverage thresholds despite pytest --cov being used"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "Snyk image scanning only scheduled, not on PRs"
    impact: "New vulnerabilities introduced by PRs not caught until weekly scheduled scan"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add Python coverage reporting to Codecov/Coveralls"
    effort: "2-3 hours"
    impact: "Unified coverage view across Go and Python codebases with enforcement"
  - title: "Add Trivy scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Catch container vulnerabilities at PR time instead of weekly Snyk-only scans"
  - title: "Create basic CLAUDE.md with test patterns and standards"
    effort: "2-3 hours"
    impact: "Enable AI agents to generate consistent, high-quality tests"
  - title: "Add SBOM generation to image publish workflows"
    effort: "2-3 hours"
    impact: "Supply chain compliance and vulnerability tracking for all 26 container images"
recommendations:
  priority_0:
    - "Add PR-time image vulnerability scanning (Trivy or Snyk) to catch security issues before merge"
    - "Implement SBOM generation and image signing for all published container images"
    - "Add Python coverage thresholds and upload to coverage tracking service"
  priority_1:
    - "Create comprehensive agent rules (.claude/rules/) for unit test, integration test, and E2E test patterns"
    - "Add Konflux build simulation to PR workflow to catch production build issues early"
    - "Add contract tests between Python SDK and Go controller API boundaries"
  priority_2:
    - "Add image startup validation tests for all server runtime images"
    - "Implement chaos engineering tests for resilience validation"
    - "Add multi-architecture image build validation on PRs"
---

# Quality Analysis: kserve/kserve

## Executive Summary

- **Overall Score: 8.2/10**
- **Repository Type**: Kubernetes Operator + Python ML Model Serving Platform
- **Primary Languages**: Go (controller/operator), Python (SDK + 9 server runtimes)
- **Framework**: Kubernetes operator (controller-runtime) with Knative Serving integration

**Key Strengths:**
- Exceptional E2E testing infrastructure with 87 test files across 14 categories, running on Minikube with real cluster deployments
- 46 GitHub Actions workflows with smart path-filtering, concurrency control, and merge queue support
- Go coverage enforcement at 80% threshold with PR-time coverage comparison against master
- Comprehensive linting: 40+ golangci-lint rules, ruff for Python, helm-docs and GitHub Actions pin verification via pre-commit
- Multi-network-layer E2E testing (Istio ingress, Kourier, Envoy Gateway API, Istio Gateway API)
- Scheduled security scanning with Snyk (twice weekly) and gosec for Go code

**Critical Gaps:**
- No SBOM generation or image signing for any container images
- No agent rules for AI-assisted development or test generation
- Python coverage not tracked/enforced despite `pytest --cov` being used
- Container vulnerability scanning only runs on schedule, not on PRs
- No Konflux/production build simulation on PRs

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Strong Go (173 test files) + Python pytest across 9 runtimes |
| Integration/E2E | 9.0/10 | 87 E2E test files, Minikube, multi-install-method (Kustomize+Helm) |
| Build Integration | 7.5/10 | PR-time image builds for E2E, no Konflux simulation |
| Image Testing | 7.0/10 | Multi-stage builds, distroless, no startup validation or SBOM |
| Coverage Tracking | 8.5/10 | Go: 80% threshold + PR reporting. Python: not tracked |
| CI/CD Automation | 9.0/10 | 46 workflows, merge queue, path filtering, concurrency control |
| Agent Rules | 0.0/10 | No CLAUDE.md, no .claude/ directory, no agent rules |

## Critical Gaps

### 1. No Agent Rules for AI-Assisted Development
- **Impact**: AI coding agents generate tests without guidance on kserve-specific patterns (envtest, pytest fixtures, E2E conventions)
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: No `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`. The repository has sophisticated testing patterns (envtest for Go controllers, pytest with custom fixtures for E2E, multi-runtime Python tests) that are completely undocumented for agent consumption.

### 2. No SBOM Generation or Image Signing
- **Impact**: Supply chain security compliance gap; no traceable bill of materials for 26 container images
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Image publish workflows push images to Docker Hub without generating SBOMs, signing with cosign, or creating attestations. Critical for SLSA compliance.

### 3. Python Coverage Not Tracked or Enforced
- **Impact**: Python SDK and 9 server runtimes lack coverage thresholds; coverage regressions go undetected
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: `pytest --cov` is used in CI for all Python packages but coverage data is not uploaded or enforced. Go has 80% threshold enforcement via `go-test-coverage`.

### 4. Container Vulnerability Scanning Only on Schedule
- **Impact**: PRs introducing new vulnerable dependencies not caught until weekly scan
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: Snyk scanning runs on a twice-weekly schedule (`0 0 * * 0,3`). No PR-triggered vulnerability scanning exists. gosec runs on PRs but only for Go source code, not for container images.

### 5. No Konflux/Production Build Simulation on PRs
- **Impact**: Build configuration drift between CI and production builds discovered post-merge
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Details**: E2E workflows build images on PRs for testing, but these builds don't simulate production build environments (Konflux, etc.).

## Quick Wins

### 1. Add Python Coverage to Codecov/Coveralls (2-3 hours)
- `pytest --cov` already runs; just needs coverage upload and threshold configuration
- Add `.coveragerc` or `pyproject.toml` coverage config
- Upload combined Go + Python coverage for unified reporting
```yaml
- name: Upload Python coverage
  uses: codecov/codecov-action@v4
  with:
    files: python/kserve/.coverage
    flags: python
```

### 2. Add Trivy Scanning to PR Workflow (1-2 hours)
- Complement existing Snyk scheduled scans with PR-time Trivy
- Scan the images already built by E2E workflow
```yaml
- name: Scan controller image
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'kserve/kserve-controller:${{ env.TAG }}'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'
```

### 3. Create Basic Agent Rules (2-3 hours)
- Add `CLAUDE.md` with project structure and testing conventions
- Create `.claude/rules/unit-tests.md` for Go envtest + Python pytest patterns
- Create `.claude/rules/e2e-tests.md` for E2E test conventions

### 4. Add SBOM Generation to Image Publish (2-3 hours)
- Use Syft or Docker's built-in SBOM support in publish workflows
- Add cosign signing for published images

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (46 workflows):**

| Category | Workflows | Triggers |
|----------|-----------|----------|
| Go Tests | `go.yml` | PR, push, merge_group |
| Python Tests | `python-test.yml` | PR (python/** paths), push |
| E2E Tests | `e2e-test.yml`, `e2e-test-llmisvc.yaml`, `e2e-test-modelcache.yaml`, `e2e-test-quick-install.yaml` | PR (path-filtered), merge_group |
| Image Publish | 16 `*-docker-publish.yml` workflows | push to master/release, tags |
| Security | `scheduled-go-security-scan.yml`, `scheduled-image-scan.yml` | Schedule, PR (gosec only) |
| Quality | `precommit-check.yml`, `pr-style-check.yml`, `go-license-check.yml` | PR |
| Release | `automated-release.yml`, `prepare-release.yml`, `python-publish.yml`, `helm-publish.yml` | Tags, dispatch |
| Enforcement | `required-checks.yml` | PR, merge_group |

**Strengths:**
- Concurrency control on all major workflows (`cancel-in-progress: true`)
- Smart path filtering (e.g., Python tests only run on `python/**` changes)
- Merge queue support (`merge_group` trigger type) on test workflows
- GitHub Actions pinned to SHA with pre-commit verification
- Matrix strategies for multi-install-method (Kustomize + Helm) and multi-network-layer testing
- Artifact-based image sharing between build and test jobs

**Weaknesses:**
- No Dependabot or Renovate configuration visible
- No CodeQL/SAST workflow (only gosec for Go)
- No PR-time container vulnerability scanning

### Test Coverage

**Go Tests (173 test files / 351 source files = 49% test-to-code ratio):**
- Uses `envtest` for controller integration tests (Kubernetes API server in tests)
- Coverage threshold enforced at 80% via `go-test-coverage` action
- PR coverage reporting with master branch comparison
- Coverage breakdown artifacts uploaded for trend tracking
- Exclusions: generated code (`zz_generated.deepcopy.go`, `openapi_generated.go`), testing helpers, client packages

**Python Tests (across 9+ server runtimes):**
- kserve SDK: pytest with `--cov=kserve`
- sklearn, xgboost, LightGBM, PMML, PaddlePaddle, AutoGluon, HuggingFace: individual test suites
- NumPy 1.x compatibility testing (separate test run with `numpy<2.0`)
- Multi-Python-version matrix: 3.10, 3.11, 3.12
- JUnit XML test result uploads for all packages
- **Gap**: Coverage data collected but not uploaded or threshold-enforced

**E2E Tests (87 files across 14 categories):**
- Categories: predictor, transformer, explainer, graph, helm, kourier, raw, path_based_routing, qpext, llm, vllm, vllm_runtime, autoscaling, modelcache, llmisvc
- Infrastructure: Minikube with real KServe deployment
- Multi-network-layer: Istio ingress, Kourier, Envoy Gateway API, Istio Gateway API
- Multi-install-method: Kustomize and Helm matrix
- KEDA autoscaling tests with metrics server
- Benchmark tests available (sklearn, tensorflow with HPA + Vegeta)
- Large runner support (`cncf-ubuntu-16-64-x86`) for LLM/vLLM tests

### Code Quality

**Go Linting (`.golangci.yml` v2):**
- 40+ linters enabled (golangci-lint v2 format)
- Security: `gosec` with custom permission thresholds (G302: 0640, G306: 0640)
- Performance: `perfsprint`, `prealloc`
- Style: `gofmt`, `gofumpt`, `goimports` (formatters)
- Correctness: `bodyclose`, `contextcheck`, `nilerr`, `nilnesserr`, `errorlint`
- Kubernetes-specific: `ginkgolinter` for Ginkgo/Gomega patterns
- Import enforcement: `importas` with k8s package alias rules
- Test-specific: `forbidigo` scoped to test files (enforces `SetupTestLogger` over `SetLogger`)
- Generated code exclusions configured

**Python Linting (`ruff.toml`):**
- Ruff configured with `B` (bugbear), `E` (pycodestyle) rules
- Line length: 88
- Generated protobuf files excluded
- Pre-commit integration with `ruff-format` and `ruff`

**Pre-commit Hooks (`.pre-commit-config.yaml`):**
- Helm-docs generation for chart documentation
- GitHub Actions SHA pinning verification (`pinact`)
- Python formatting and linting (ruff-format, ruff)

**License Compliance:**
- `go-licenses` check on PRs for Go modules
- License stage in Dockerfile builds (`go-licenses save`)

### Container Images

**Build Configuration (26 Dockerfiles):**
- Go services: Multi-stage builds with `gcr.io/distroless/static:nonroot` base
- Build caching: `--mount=type=cache,target=/go/pkg/mod` and `/root/.cache/go-build`
- License compliance: Parallel license stage in BuildKit builds
- Python services: Individual Dockerfiles per server runtime
- Separate CPU and GPU variants for HuggingFace server

**Strengths:**
- Distroless base images for minimal attack surface (Go services)
- Non-root user in final images
- License third-party inclusion in images
- Build arguments for flexible builds (`CMD`, `GOTAGS`)

**Weaknesses:**
- No SBOM generation
- No image signing (cosign)
- No image attestation
- No multi-architecture builds on PRs (publish-only)
- No image startup validation tests

### Security

**Existing Practices:**
- **gosec**: Go security scanner on PRs with SARIF upload to GitHub Code Scanning
- **Snyk**: Docker image scanning on schedule (twice weekly, Sun+Wed) for all core + predictor images
- **GitHub Actions pinning**: All actions pinned to SHA with automated verification
- **License checking**: `go-licenses` compliance checks on PRs
- **Minimal base images**: Distroless for Go services

**Gaps:**
- No CodeQL or other SAST beyond gosec
- No secret detection (Gitleaks, TruffleHog)
- No dependency scanning (Dependabot, Renovate)
- No image scanning on PRs (only scheduled)
- No SLSA provenance or attestation

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None - no `.claude/`, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: Complete absence of agent rules
- **Recommendation**: Generate comprehensive rules using `/test-rules-generator` covering:
  - Go unit tests with envtest patterns
  - Python pytest patterns for SDK and server runtimes
  - E2E test patterns with Minikube fixtures
  - Test naming conventions and organization

## Recommendations

### Priority 0 (Critical)

1. **Add PR-time container vulnerability scanning** - Add Trivy or move Snyk to PR triggers. Currently, new vulnerabilities from PRs go undetected for up to 3 days.
2. **Implement SBOM generation and image signing** - Add Syft/cosign to all 16 image publish workflows for supply chain security compliance.
3. **Add Python coverage enforcement** - Upload pytest coverage to Codecov and set thresholds matching Go's 80% standard.

### Priority 1 (High Value)

1. **Create agent rules for test automation** - Document envtest patterns, pytest fixtures, E2E conventions in `.claude/rules/` to improve AI-assisted test quality.
2. **Add Konflux build simulation to PR workflow** - Prevent post-merge build failures by simulating production builds on PRs.
3. **Add secret detection** - Implement Gitleaks or TruffleHog in PR workflow to prevent credential leaks.
4. **Add Dependabot/Renovate for dependency management** - Automate dependency updates across Go, Python, and GitHub Actions.

### Priority 2 (Nice-to-Have)

1. **Add container startup validation** - Test that images boot successfully before E2E tests.
2. **Multi-architecture build validation on PRs** - Currently only publish workflows do multi-arch.
3. **Add chaos/resilience testing** - Test controller recovery, node failures, network partitions.
4. **Add performance regression testing** - Extend existing benchmark configs into automated CI.
5. **Add contract tests** - Validate API boundaries between Python SDK and Go controller.

## Comparison to Gold Standards

| Feature | kserve/kserve | odh-dashboard | notebooks | K8s Best Practice |
|---------|--------------|---------------|-----------|-------------------|
| Unit Test Coverage | 80% threshold (Go only) | Multi-layer | N/A | 70-80% threshold |
| E2E Tests | 87 files, automated on PR | Cypress + API | Image-focused | Automated on PR |
| Coverage Enforcement | Go: yes, Python: no | Yes (multi-lang) | N/A | Yes |
| Container Scanning | Scheduled (Snyk) | PR-time | PR-time (Trivy) | PR-time |
| SBOM Generation | No | No | No | Yes |
| Image Signing | No | No | No | Yes (cosign) |
| Pre-commit Hooks | Yes (3 hooks) | Yes (extensive) | Yes | Yes |
| Agent Rules | None | Comprehensive | None | N/A |
| License Compliance | Yes (go-licenses) | Yes | Yes | Yes |
| Multi-version Testing | Python 3.10-3.12 + NumPy 1.x | Yes | Yes | Yes |
| Multi-install Testing | Kustomize + Helm | N/A | N/A | Yes |
| Network Layer Testing | 4 layers | N/A | N/A | Multi-layer |
| Security Scanning | gosec + Snyk | CodeQL + Trivy | Trivy | CodeQL + Trivy |
| Merge Queue | Yes | No | No | Recommended |

## File Paths Reference

### CI/CD Configuration
- `.github/workflows/go.yml` - Go unit tests + coverage
- `.github/workflows/python-test.yml` - Python test suite
- `.github/workflows/e2e-test.yml` - Main E2E test workflow
- `.github/workflows/e2e-test-llmisvc.yaml` - LLM InferenceService E2E
- `.github/workflows/e2e-test-modelcache.yaml` - Model caching E2E
- `.github/workflows/e2e-test-quick-install.yaml` - Quick install E2E
- `.github/workflows/scheduled-go-security-scan.yml` - gosec scanning
- `.github/workflows/scheduled-image-scan.yml` - Snyk image scanning
- `.github/workflows/precommit-check.yml` - Pre-commit verification
- `.github/workflows/required-checks.yml` - Check enforcement
- `.github/.testcoverage.yml` - Go coverage thresholds (80%)

### Code Quality
- `.golangci.yml` - Go linting (40+ rules, v2 format)
- `.pre-commit-config.yaml` - Pre-commit hooks (helm-docs, pinact, ruff)
- `ruff.toml` - Python linting configuration
- `coverage.sh` - Coverage calculation script

### Test Infrastructure
- `test/e2e/` - 87 E2E test files across 14 categories
- `test/benchmark/` - Performance benchmark configurations
- `test/scripts/gh-actions/` - CI helper scripts
- `test/crds/` - CRD manifests for testing
- `test/webhooks/` - Webhook test infrastructure

### Container Images
- `Dockerfile` - Main controller (distroless, multi-stage)
- `agent.Dockerfile`, `router.Dockerfile`, `localmodel.Dockerfile` - Go service images
- `python/*.Dockerfile` - 13 Python runtime images
- `qpext/qpext.Dockerfile` - Queue proxy extension

### Configuration
- `Makefile` - Build/test/lint targets with envtest setup
- `go.mod` - Go module definition
- `charts/` - Helm chart definitions
- `config/` - Kustomize overlays and CRD configuration
