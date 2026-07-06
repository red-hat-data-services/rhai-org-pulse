---
repository: "red-hat-data-services/trainer"
overall_score: 6.6
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Good Go unit test coverage with coverprofile; Python initializer tests present; Rust tests embedded in build"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Excellent multi-version Kind E2E, GPU E2E, envtest integration, Helm chart tests, notebook execution, RHOAI progression E2E"
  - dimension: "Build Integration"
    score: 6.0
    status: "PR image builds present, operator-chaos validation, but no PR-time Konflux simulation"
  - dimension: "Image Testing"
    score: 4.0
    status: "Multi-arch builds with multi-stage Dockerfiles but no runtime validation or vulnerability scanning"
  - dimension: "Coverage Tracking"
    score: 5.0
    status: "Coveralls integration via cover.out but no coverage thresholds or enforcement"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "13 well-organized workflows, multi-K8s-version matrix, semantic PR titles, Mergify automation"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules for test creation"
critical_gaps:
  - title: "No container vulnerability scanning in CI"
    impact: "CVEs in base images and dependencies go undetected until production deployment"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No coverage enforcement thresholds"
    impact: "Coverage can silently regress without blocking PRs; Coveralls reports but does not gate merges"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No PR-time Konflux build simulation"
    impact: "RHOAI Konflux builds (Dockerfile.rhoai.konflux) may fail post-merge due to differences in build constraints (FIPS, UBI9 base)"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No container image runtime validation"
    impact: "Image startup issues, missing entrypoints, or runtime crashes not caught until deployment"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No agent rules for AI-assisted test creation"
    impact: "AI agents generating tests have no guidance on patterns, frameworks, or conventions used in this repo"
    severity: "MEDIUM"
    effort: "3-4 hours"
  - title: "Python test coverage is disproportionately low"
    impact: "Initializer logic (model, dataset) has limited test coverage relative to source files; much of pkg/initializers/ Python code is under-tested"
    severity: "MEDIUM"
    effort: "8-16 hours"
quick_wins:
  - title: "Add Trivy scanning to image build workflow"
    effort: "1-2 hours"
    impact: "Catch CVEs in all 9 container images before merge"
  - title: "Add Coveralls threshold enforcement"
    effort: "1-2 hours"
    impact: "Prevent coverage regression by failing PRs that drop below baseline"
  - title: "Create basic agent rules for Go test patterns"
    effort: "2-3 hours"
    impact: "Guide AI agents to produce consistent, framework-correct tests using Ginkgo/Gomega"
  - title: "Add CodeQL analysis workflow"
    effort: "1-2 hours"
    impact: "Automated SAST scanning for Go and Python code on every PR"
  - title: "Add container startup validation to E2E"
    effort: "2-3 hours"
    impact: "Verify all built images start successfully before running workload tests"
recommendations:
  priority_0:
    - "Add container vulnerability scanning (Trivy) to the build-and-push-images workflow for all 9 images"
    - "Configure Coveralls coverage thresholds with PR status checks to prevent regression"
    - "Add PR-time Konflux build simulation for Dockerfile.rhoai.konflux to catch FIPS/UBI9 build issues before merge"
  priority_1:
    - "Add CodeQL or Semgrep CI workflow to run SAST on PRs (semgrep.yaml rules exist but no CI integration)"
    - "Create agent rules (.claude/rules/) for unit tests, integration tests, and E2E test patterns"
    - "Add container runtime validation — verify image startup and entrypoint for all components"
    - "Increase Python initializer test coverage from ~3% to >60%"
  priority_2:
    - "Add SBOM generation and image signing/attestation for published images"
    - "Add performance regression testing for training workloads"
    - "Consider adding contract tests between initializers and controller"
    - "Add Rust test file coverage reporting (currently inline in cargo test)"
---

# Quality Analysis: red-hat-data-services/trainer

## Executive Summary

- **Overall Score: 6.6/10**
- **Repository Type**: Kubernetes operator for ML training (Kubeflow Trainer v2, Red Hat downstream fork)
- **Primary Languages**: Go (operator), Python (initializers), Rust (data cache)
- **Framework**: controller-runtime with Ginkgo/Gomega, pytest, cargo test
- **Key Strengths**: Excellent E2E test infrastructure with multi-K8s-version matrix, GPU E2E testing, operator-chaos validation, well-organized CI/CD with 13 workflows, Coveralls integration, Helm chart unit tests, and comprehensive pre-commit hooks
- **Critical Gaps**: No container vulnerability scanning, no coverage enforcement, no PR-time Konflux simulation, no agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.0/10 | Good Go coverage with coverprofile; Python/Rust tests present |
| Integration/E2E | 8.0/10 | Multi-version Kind E2E, GPU E2E, envtest, Helm tests, notebooks |
| **Build Integration** | **6.0/10** | **PR image builds, operator-chaos, but no Konflux simulation** |
| Image Testing | 4.0/10 | Multi-arch builds but no runtime validation or scanning |
| Coverage Tracking | 5.0/10 | Coveralls integration but no thresholds or enforcement |
| CI/CD Automation | 8.0/10 | 13 workflows, multi-version matrix, Mergify, semantic PRs |
| Agent Rules | 0.0/10 | No agent rules or AI test automation guidance |

## Critical Gaps

### 1. No Container Vulnerability Scanning
- **Impact**: CVEs in base images (golang:1.25, python:3.11-slim, UBI9, nvidia/cuda, pytorch) and dependencies go undetected until production
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: 9 Dockerfiles build images for controller, initializers, runtimes, and trainers. None have Trivy, Snyk, or Grype scanning. The RHOAI Konflux Dockerfile uses pinned UBI9 digests, but no automated CVE gate exists in GitHub Actions.

### 2. No Coverage Enforcement Thresholds
- **Impact**: Go coverage can regress silently; Coveralls reports to coveralls.io but does not block PRs
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: The `make test` target generates `cover.out` and the `test-go.yaml` workflow uploads to Coveralls via `shogo82148/actions-goveralls`. However, there is no `.coveralls.yml` configuration enforcing minimum thresholds or PR status checks.

### 3. No PR-Time Konflux Build Simulation
- **Impact**: `Dockerfile.rhoai.konflux` uses strict FIPS mode (`GOEXPERIMENT=strictfipsruntime`), UBI9 base with pinned digest, and `CGO_ENABLED=1`. These constraints differ from the upstream Dockerfile. Build failures are discovered only after merge.
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: The `build-and-push-images.yaml` only builds upstream Dockerfiles on PRs (gated by `github.repository == 'kubeflow/trainer'`). Red Hat-specific Dockerfiles are never built in PR CI.

### 4. No Container Image Runtime Validation
- **Impact**: Images may fail to start due to missing libraries, incorrect entrypoints, or permission issues
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: While images are built on PRs, there is no step that validates they actually start. The E2E tests deploy the operator but don't systematically validate all 9 images start correctly.

### 5. Python Initializer Test Coverage Gap
- **Impact**: Dataset and model initializers have ~13 test files covering ~388 source files (3.4% ratio). Most Python code in `pkg/initializers/` and auto-generated `api/python_api/` is under-tested.
- **Severity**: MEDIUM
- **Effort**: 8-16 hours

### 6. Semgrep Rules Exist But Are Not Integrated Into CI
- **Impact**: A comprehensive `semgrep.yaml` with 40+ rules exists at the repo root but no GitHub Actions workflow runs it
- **Severity**: MEDIUM
- **Effort**: 2-3 hours

## Quick Wins

### 1. Add Trivy Scanning to Image Build Workflow (1-2 hours)
Add a Trivy scan step after each image build in `build-and-push-images.yaml`:
```yaml
- name: Trivy vulnerability scan
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'ghcr.io/kubeflow/${{ matrix.component-name }}:${{ github.sha }}'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'
```

### 2. Add Coveralls Threshold Enforcement (1-2 hours)
Create `.coveralls.yml` with minimum coverage:
```yaml
coverage:
  status:
    project:
      default:
        target: auto
        threshold: 1%
    patch:
      default:
        target: 80%
```

### 3. Create Basic Agent Rules (2-3 hours)
Generate rules for Go test patterns using `/test-rules-generator`:
- `.claude/rules/unit-tests.md` — Ginkgo/Gomega patterns, testingutil wrappers
- `.claude/rules/integration-tests.md` — envtest setup, external CRDs
- `.claude/rules/e2e-tests.md` — Kind cluster, namespace isolation

### 4. Add CodeQL Workflow (1-2 hours)
```yaml
name: CodeQL Analysis
on: [push, pull_request]
jobs:
  analyze:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        language: [go, python]
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

### 5. Add Semgrep CI Workflow (1-2 hours)
```yaml
name: Semgrep Security Scan
on: [pull_request]
jobs:
  semgrep:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: returntocorp/semgrep-action@v1
        with:
          config: semgrep.yaml
```

## Detailed Findings

### CI/CD Pipeline

**Workflows (13 total)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test-go.yaml` | push, PR | Go unit tests, integration tests, linting, code generation checks, Coveralls |
| `test-python.yaml` | PR | Python unit/integration tests, pre-commit validation |
| `test-rust.yaml` | PR | Rust unit tests with dependency caching |
| `test-e2e.yaml` | PR | E2E on Kind with K8s 1.31–1.34, notebook execution |
| `test-e2e-gpu.yaml` | PR (label-gated) | GPU E2E on Oracle A10 runners, torchtune notebooks |
| `operator-chaos.yml` | PR (path-filtered) | Operator chaos testing for API/CRD/webhook changes |
| `build-and-push-images.yaml` | push, PR | Multi-arch image builds for 7 components |
| `publish-helm-charts.yaml` | push, tags | Helm chart packaging and OCI publishing |
| `check-pr-title.yaml` | PR | Semantic PR title validation (feat/fix/chore/revert) |
| `gh-workflow-approve.yaml` | PR (labeled) | Auto-approve workflow runs for org members |
| `github-stale.yaml` | scheduled | Mark stale issues/PRs after 90 days |
| `sync-stream-to-lake.yml` | scheduled (4hr) | Sync main→stable branch for RHOAI lake-gate |
| `.mergify.yml` | (external) | Auto-approve/merge lake-gate PRs to stable |

**Strengths**:
- Multi-K8s-version E2E matrix (1.31.0, 1.32.3, 1.33.1, 1.34.0) — exceeds most repos
- GPU E2E on dedicated hardware (Oracle A10) with label gating
- Operator-chaos testing — rare and valuable; validates API, CRD, and webhook changes
- Semantic PR title enforcement with scope validation
- Lake-gate automation (stream-to-lake + Mergify) for downstream synchronization
- Build matrix covers 7 components with multi-arch (amd64, arm64, ppc64le)

**Gaps**:
- No concurrency control on most workflows (only `gh-workflow-approve` uses `cancel-in-progress`)
- No caching in Go test workflows (would benefit from module cache)
- Image build workflow gated to `kubeflow/trainer` repo — not running on the Red Hat fork
- No workflow for security scanning (Trivy, CodeQL, Semgrep)

### Test Coverage

**Go Tests (32 files / 116 source files = 27.6% file ratio)**:
- **Unit tests**: Controller tests, webhook tests, runtime tests, framework plugin tests, utility tests
- **Integration tests** (Ginkgo + envtest): Controller lifecycle, webhook validation, training runtime management
  - Uses external CRDs: JobSet, Scheduler Plugins, Volcano
  - `test/integration/controller/trainjob_controller_test.go` — 1,439 lines (comprehensive)
  - `test/integration/webhooks/` — webhook validation and defaulting tests
- **E2E tests** (Ginkgo + Kind):
  - `test/e2e/e2e_test.go` — 180 lines covering PyTorch and DeepSpeed workloads
  - `test/e2e/rhai/progression_e2e_test.go` — RHOAI-specific progression testing
  - Notebook E2E via Papermill: MNIST, DistilBERT fine-tuning, local training
- **Helm chart tests** (helm-unittest): 8 test files covering deployment, service, RBAC, webhook, configmap

**Python Tests (13 files / ~30 relevant source files)**:
- `pkg/initializers/dataset/` — dataset download and caching tests
- `pkg/initializers/model/` — HuggingFace, S3 model download tests
- `pkg/initializers/utils/` — utility and OpenDAL tests
- `test/integration/initializers/` — model and dataset integration tests

**Rust Tests (inline via cargo test)**:
- Data cache component runs `cargo test --tests` during Docker build
- `make test-rust` runs `cargo test --lib --bins`
- No separate test files; tests are inline in source modules

**Coverage Generation**:
- `make test` produces `cover.out` for Go code
- Coveralls integration in `test-go.yaml` via `shogo82148/actions-goveralls`
- No coverage for Python, Rust, or E2E tests
- No threshold enforcement — coverage is informational only

### Code Quality

**Linting**:
- **golangci-lint v2** with gci formatter for import ordering
- **golangci-lint-kube-api-linter (KAL)**: Specialized linter for Kubernetes API conventions — validates comments, conditions, json tags, integers, durations, optional/required fields, SSA tags, status subresource, and more
- **flake8**: Max line length 100, extends ignore W503/E203
- **isort + black**: Python formatting via pre-commit
- **cargo fmt + cargo check**: Rust formatting and type checking

**Pre-commit Hooks**:
- check-yaml (multi-document, excluding Helm charts)
- check-json
- end-of-file-fixer
- trailing-whitespace
- isort (Python import sorting)
- black (Python formatting)
- flake8 (Python linting)
- cargo fmt (Rust formatting)
- cargo check (Rust type checking)

**Static Analysis**:
- Semgrep rules exist (`semgrep.yaml`) covering Go, Python, TS/JS, YAML, and generic secrets detection
- Gitleaks with comprehensive allowlist configuration (`.gitleaks.toml`)
- Gitleaks ignore file (`.gitleaksignore`)
- **GAP**: Neither Semgrep nor Gitleaks is integrated into CI workflows

### Container Images

**9 Dockerfiles across components**:

| Component | Dockerfile | Base Image | Multi-Arch | Multi-Stage |
|-----------|-----------|------------|------------|-------------|
| trainer-controller-manager | `Dockerfile` | golang:1.25 → distroless | amd64, arm64, ppc64le | Yes |
| trainer-controller-manager | `Dockerfile.odh` | UBI9/go-toolset:1.25 → UBI9-minimal | - | Yes |
| trainer-controller-manager | `Dockerfile.rhoai.konflux` | UBI9/go-toolset (pinned digest) → UBI9-minimal (pinned) | - | Yes |
| model-initializer | `Dockerfile` | python:3.11-slim-bookworm | amd64, arm64 | No |
| dataset-initializer | `Dockerfile` | python:3.11-slim-bookworm | amd64, arm64 | No |
| deepspeed-runtime | `Dockerfile` | nvidia/cuda:12.8.1 + MPI | amd64, arm64 | Yes (MPI) |
| mlx-runtime | `Dockerfile` | nvidia/cuda:12.8.1 + MPI | amd64 only | Yes (MPI) |
| torchtune-trainer | `Dockerfile` | pytorch:2.7.1-cuda12.8 | amd64, arm64 | No |
| data-cache | `Dockerfile` | rust:1.85 → debian:bookworm-slim | amd64, arm64 | Yes |

**Strengths**:
- RHOAI Konflux Dockerfile with FIPS mode (`GOEXPERIMENT=strictfipsruntime`) and pinned base images
- Multi-stage builds for Go and Rust components
- Multi-arch support across most components
- Data cache Dockerfile runs tests during build (`cargo test --tests`)
- Go BuildKit cache mounts for faster builds

**Gaps**:
- No runtime validation (startup check) for any image
- No vulnerability scanning (Trivy/Snyk/Grype) in CI
- No SBOM generation
- No image signing or attestation
- Python initializer images don't use multi-stage builds (full pip install in final image)

### Security

**Present**:
- Gitleaks configuration with comprehensive path/regex allowlists
- Semgrep security rules covering hardcoded secrets, SQL injection, command injection, SSRF, path traversal (in `semgrep.yaml`)
- FIPS-compliant build for RHOAI (Dockerfile.rhoai.konflux)
- Pinned base image digests for RHOAI builds
- Non-root user in most Dockerfiles (65532:65532)
- OpenSSF Best Practices badge

**Missing**:
- No CodeQL or Semgrep CI integration (rules exist but aren't run)
- No Trivy/Snyk vulnerability scanning
- No dependency scanning workflow (Renovate exists for updates but no security audit)
- No SBOM generation
- No image signing/attestation (Sigstore/cosign)
- No secret scanning in CI (Gitleaks config present but no workflow)

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**:
  - No unit test rules (Go Ginkgo/Gomega patterns, Python pytest patterns)
  - No integration test rules (envtest setup, external CRDs)
  - No E2E test rules (Kind cluster, namespace isolation, Papermill notebooks)
  - No webhook test rules
  - No Helm chart test rules
- **Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
  - Go unit tests using `testingutil.MakeTrainJobWrapper` and similar helpers
  - Integration tests with envtest and external CRDs (JobSet, Scheduler Plugins, Volcano)
  - E2E tests with namespace isolation and `util.TimeoutE2E/Interval` constants
  - Python pytest patterns for initializer testing
  - Helm chart unit tests with helm-unittest

### Chaos Testing (Notable Strength)

The repository includes an **operator-chaos** workflow — an uncommon and highly valuable practice:
- Uses `opendatahub-io/operator-chaos` tool to validate operator behavior
- Triggered on changes to API types, controllers, runtimes, manifests, and RBAC
- Knowledge file at `chaos/knowledge/trainer.yaml` encodes expected behaviors
- Compares base branch against PR changes for regression detection

## Recommendations

### Priority 0 (Critical)

1. **Add container vulnerability scanning** — Integrate Trivy into `build-and-push-images.yaml` for all 9 images. Block PRs with CRITICAL/HIGH CVEs. (2-4 hours)

2. **Configure Coveralls coverage enforcement** — Add `.coveralls.yml` with project/patch thresholds and enable PR status checks. Prevent silent coverage regression. (2-3 hours)

3. **Add PR-time RHOAI/Konflux build validation** — Create a workflow that builds `Dockerfile.rhoai.konflux` on PRs to this fork. Catch FIPS/UBI9/CGO build issues before merge. (8-12 hours)

### Priority 1 (High Value)

4. **Integrate Semgrep into CI** — The comprehensive `semgrep.yaml` exists with 40+ rules but never runs in CI. Add a simple workflow step. (1-2 hours)

5. **Create agent rules** — Generate `.claude/rules/` with patterns for all test types (unit, integration, E2E, webhook, Helm). Use `/test-rules-generator`. (3-4 hours)

6. **Add container runtime validation** — After building images, validate they start successfully (check entrypoint, health endpoint where applicable). (4-6 hours)

7. **Increase Python test coverage** — Focus on initializer edge cases: S3 failures, HuggingFace rate limiting, cache invalidation, malformed datasets. (8-16 hours)

### Priority 2 (Nice-to-Have)

8. **Add SBOM generation** — Use Syft or Trivy to generate SBOMs for published images. (2-3 hours)

9. **Add image signing** — Integrate cosign for published image attestation. (3-4 hours)

10. **Add Go module caching** — Add `actions/cache` for Go modules in test workflows to speed up CI. (1 hour)

11. **Add concurrency control** — Add `cancel-in-progress` to test workflows to save CI resources on rapid pushes. (30 minutes)

12. **Add performance regression testing** — Benchmark training workload latency and resource consumption. (8-16 hours)

## Comparison to Gold Standards

| Feature | trainer | odh-dashboard | notebooks | kserve |
|---------|---------|---------------|-----------|--------|
| Unit tests | Go + Python + Rust | TypeScript (Jest) | Python | Go |
| Integration tests | envtest (Ginkgo) | API mocking | N/A | envtest |
| E2E tests | Kind + GPU + Notebooks | Cypress + Playwright | Notebook validation | Kind + KNative |
| Multi-K8s-version | 4 versions (1.31-1.34) | 1 version | N/A | 2 versions |
| Chaos testing | operator-chaos | None | None | None |
| Coverage enforcement | Coveralls (no threshold) | Jest thresholds | None | Codecov (enforced) |
| Container scanning | None | None | Trivy | Trivy |
| Pre-commit hooks | Yes (Go+Python+Rust) | Yes (TS) | Limited | Limited |
| Helm tests | helm-unittest (8 files) | N/A | N/A | Limited |
| Agent rules | None | Comprehensive | None | None |
| SAST | Semgrep (not in CI) | None | None | CodeQL |
| Secret detection | Gitleaks (not in CI) | None | Gitleaks | None |
| Multi-arch images | amd64+arm64+ppc64le | amd64 | Multi-arch | amd64 |

**Notable**: Trainer is the only repo with operator-chaos testing, multi-K8s-version E2E matrix (4 versions), GPU E2E testing, and Helm chart unit tests. These are significant strengths that set it apart.

## File Paths Reference

### CI/CD
- `.github/workflows/test-go.yaml` — Go unit/integration tests + Coveralls
- `.github/workflows/test-python.yaml` — Python tests + pre-commit
- `.github/workflows/test-rust.yaml` — Rust unit tests
- `.github/workflows/test-e2e.yaml` — E2E on Kind (multi-version)
- `.github/workflows/test-e2e-gpu.yaml` — GPU E2E on Oracle A10
- `.github/workflows/operator-chaos.yml` — Operator chaos testing
- `.github/workflows/build-and-push-images.yaml` — Multi-arch image builds
- `.github/workflows/publish-helm-charts.yaml` — Helm OCI publishing
- `.github/workflows/sync-stream-to-lake.yml` — Upstream sync automation
- `.mergify.yml` — Lake-gate auto-merge rules

### Testing
- `test/e2e/e2e_test.go` — Main E2E test suite
- `test/e2e/rhai/progression_e2e_test.go` — RHOAI progression E2E
- `test/integration/controller/` — Controller integration tests
- `test/integration/webhooks/` — Webhook integration tests
- `test/integration/initializers/` — Python initializer integration tests
- `pkg/initializers/*/` — Python unit tests
- `charts/kubeflow-trainer/tests/` — Helm chart unit tests

### Code Quality
- `.golangci.yaml` — golangci-lint v2 config
- `.golangci-kal.yml` — Kube API Linter config
- `.pre-commit-config.yaml` — Pre-commit hooks
- `.flake8` — Python linting config
- `semgrep.yaml` — Semgrep security rules (not in CI)

### Container Images
- `cmd/trainer-controller-manager/Dockerfile` — Upstream controller
- `cmd/trainer-controller-manager/Dockerfile.odh` — ODH controller
- `cmd/trainer-controller-manager/Dockerfile.rhoai.konflux` — RHOAI Konflux controller
- `cmd/initializers/model/Dockerfile` — Model initializer
- `cmd/initializers/dataset/Dockerfile` — Dataset initializer
- `cmd/runtimes/deepspeed/Dockerfile` — DeepSpeed runtime
- `cmd/runtimes/mlx/Dockerfile` — MLX runtime
- `cmd/trainers/torchtune/Dockerfile` — TorchTune trainer
- `cmd/data_cache/Dockerfile` — Rust data cache

### Security
- `.gitleaks.toml` — Gitleaks configuration
- `.gitleaksignore` — Gitleaks false positive exclusions
- `semgrep.yaml` — Unified Semgrep security rules

### Manifests
- `manifests/base/` — Base Kustomize manifests
- `manifests/rhoai/` — RHOAI-specific manifests
- `manifests/overlays/` — Kustomize overlays
- `chaos/knowledge/trainer.yaml` — Operator chaos knowledge
