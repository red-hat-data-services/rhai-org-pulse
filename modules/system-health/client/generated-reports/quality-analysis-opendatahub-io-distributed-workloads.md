---
repository: "opendatahub-io/distributed-workloads"
overall_score: 6.2
scorecard:
  - dimension: "Unit Tests"
    score: 5.0
    status: "Unit tests only cover support utilities (937 lines); no unit tests for E2E test helper logic outside support/"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Comprehensive E2E suites across 4 domains (KFTO, Trainer, FMS, ODH) with GPU/multi-node tiering"
  - dimension: "Build Integration"
    score: 7.0
    status: "34 Tekton pipelines for Konflux builds on PR and push; no GitHub Actions PR-time image build validation"
  - dimension: "Image Testing"
    score: 5.5
    status: "28 Dockerfiles with multi-variant matrix (CUDA/ROCm); no runtime validation or startup tests"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No codecov, no coverage generation, no coverage thresholds or PR reporting"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "GitHub Actions for unit tests, vet, imports; Tekton for image builds; Mergify for stable sync; no E2E in CI"
  - dimension: "Agent Rules"
    score: 7.5
    status: "Excellent AGENTS.md with test patterns, namespace isolation, tag system; no .claude/rules/ directory"
critical_gaps:
  - title: "No code coverage tracking or enforcement"
    impact: "Cannot measure test coverage trends, regressions go undetected, no PR coverage gates"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container image runtime validation"
    impact: "Image startup failures and missing dependencies not caught until deployment on real clusters"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "E2E tests not automated in CI"
    impact: "E2E tests require manual execution on OpenShift clusters; no automated regression signal on PRs"
    severity: "HIGH"
    effort: "20-40 hours"
  - title: "Unit tests limited to support/ package only"
    impact: "Test helper utilities in tests/trainer/utils/, sdk_tests/, and suite support.go files have no unit tests"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "No SAST/CodeQL integration"
    impact: "Static analysis limited to go vet and basic golangci-lint; no deep security analysis on PRs"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add codecov integration with coverage generation"
    effort: "2-4 hours"
    impact: "Track coverage trends, set minimum thresholds, get PR coverage diffs"
  - title: "Enable CodeQL/gosec in GitHub Actions"
    effort: "1-2 hours"
    impact: "Catch security vulnerabilities and code quality issues automatically on PRs"
  - title: "Add more golangci-lint linters"
    effort: "1-2 hours"
    impact: "Currently only 3 linters enabled (govet, unused, ineffassign); enable errcheck, staticcheck, gosimple for better coverage"
  - title: "Create .claude/rules/ directory with test creation rules"
    effort: "2-3 hours"
    impact: "Extend existing AGENTS.md patterns into structured rules for AI-assisted test generation"
  - title: "Add image startup smoke test to Tekton pipelines"
    effort: "2-4 hours"
    impact: "Verify training runtime images can start and import core libraries before merging"
recommendations:
  priority_0:
    - "Add code coverage generation and codecov integration to go-unit-test workflow"
    - "Add CodeQL or gosec SAST scanning to PR workflows"
    - "Implement image startup validation (python -c 'import torch') in Tekton PR pipelines"
  priority_1:
    - "Expand unit test coverage beyond tests/common/support/ to cover utils, sdk_tests helpers"
    - "Add more golangci-lint linters (errcheck, staticcheck, gosimple, gocritic)"
    - "Create .claude/rules/ directory with structured test creation rules from AGENTS.md patterns"
    - "Add Trivy container scanning to complement existing Snyk Dockerfile scanning"
  priority_2:
    - "Automate a subset of E2E tests in CI using Kind or lightweight cluster for smoke testing"
    - "Add SBOM generation to Tekton image build pipelines"
    - "Add image signing/attestation for training runtime images"
    - "Implement pre-commit hook enforcement in CI (currently only local)"
---

# Quality Analysis: opendatahub-io/distributed-workloads

## Executive Summary

- **Overall Score: 6.2/10**
- **Repository Type**: E2E test suite and container image repository for distributed ML workloads on RHOAI
- **Primary Language**: Go (tests), Python (training runtime images), YAML (Kubernetes manifests)
- **Key Strengths**: Comprehensive E2E test suites across 4 domains with GPU tiering, 34 Tekton pipelines for Konflux builds, strong AGENTS.md documentation, multi-variant training runtime images (CUDA/ROCm)
- **Critical Gaps**: No coverage tracking, no image runtime validation, E2E not automated in CI, limited unit tests
- **Agent Rules Status**: AGENTS.md present with excellent test patterns; no .claude/rules/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 5.0/10 | Unit tests only cover support utilities (937 lines); no unit tests for E2E test helper logic outside support/ |
| Integration/E2E | 8.5/10 | Comprehensive E2E suites across 4 domains (KFTO, Trainer, FMS, ODH) with GPU/multi-node tiering |
| **Build Integration** | **7.0/10** | **34 Tekton pipelines for Konflux builds on PR and push; no GitHub Actions PR-time image build validation** |
| Image Testing | 5.5/10 | 28 Dockerfiles with multi-variant matrix (CUDA/ROCm); no runtime validation or startup tests |
| Coverage Tracking | 1.0/10 | No codecov, no coverage generation, no coverage thresholds or PR reporting |
| CI/CD Automation | 7.0/10 | GitHub Actions for unit tests, vet, imports; Tekton for image builds; Mergify for stable sync; no E2E in CI |
| Agent Rules | 7.5/10 | Excellent AGENTS.md with test patterns, namespace isolation, tag system; no .claude/rules/ directory |

## Critical Gaps

1. **No code coverage tracking or enforcement**
   - Impact: Cannot measure test coverage trends, regressions go undetected, no PR coverage gates
   - Severity: HIGH
   - Effort: 4-6 hours

2. **No container image runtime validation**
   - Impact: Image startup failures and missing dependencies not caught until deployment on real clusters
   - Severity: HIGH
   - Effort: 8-12 hours

3. **E2E tests not automated in CI**
   - Impact: E2E tests require manual execution on OpenShift clusters; no automated regression signal on PRs
   - Severity: HIGH
   - Effort: 20-40 hours

4. **Unit tests limited to support/ package only**
   - Impact: Test helper utilities in tests/trainer/utils/, sdk_tests/, and suite support.go files have no unit tests
   - Severity: MEDIUM
   - Effort: 8-12 hours

5. **No SAST/CodeQL integration**
   - Impact: Static analysis limited to go vet and basic golangci-lint; no deep security analysis on PRs
   - Severity: MEDIUM
   - Effort: 2-4 hours

## Quick Wins

1. **Add codecov integration with coverage generation**
   - Effort: 2-4 hours
   - Impact: Track coverage trends, set minimum thresholds, get PR coverage diffs
   - Implementation: Add `-coverprofile=coverage.out` to `go test` in go-unit-test.yml, upload to codecov

2. **Enable CodeQL/gosec in GitHub Actions**
   - Effort: 1-2 hours
   - Impact: Catch security vulnerabilities and code quality issues automatically on PRs
   - Implementation: Add `.github/workflows/codeql.yml` with Go analysis

3. **Add more golangci-lint linters**
   - Effort: 1-2 hours
   - Impact: Currently only 3 linters enabled (govet, unused, ineffassign); enable errcheck, staticcheck, gosimple
   - Implementation: Update `.golangci.yml` to add more linters

4. **Create .claude/rules/ directory with test creation rules**
   - Effort: 2-3 hours
   - Impact: Extend existing AGENTS.md patterns into structured rules for AI-assisted test generation
   - Implementation: Extract patterns from AGENTS.md into `.claude/rules/e2e-tests.md`, `.claude/rules/unit-tests.md`

5. **Add image startup smoke test to Tekton pipelines**
   - Effort: 2-4 hours
   - Impact: Verify training runtime images can start and import core libraries before merging
   - Implementation: Add step to Tekton PR pipelines: `podman run --rm $IMAGE python -c "import torch; print(torch.__version__)"`

## Detailed Findings

### CI/CD Pipeline

**GitHub Actions Workflows (9 workflows)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `go-unit-test.yml` | PR + push (Go files) | Run unit tests on `tests/common/support/...` |
| `go-vet.yml` | PR + push (Go files) | Run `go vet ./...` |
| `verify_generated_files.yml` | PR + push (Go files) | Verify import organization |
| `build-and-push-test-images.yml` | Push to main (tests/) | Build and push E2E test container image |
| `build-and-push-osu-benchmark.yml` | PR + push (benchmarks/) | Build OSU MPI benchmark images |
| `snyk-dockerfile-scan.yml` | Push + nightly + labeled PRs | Snyk IaC scan on training Dockerfiles |
| `notify-autofix-prs.yml` | PR opened + daily schedule | Slack notifications for jira-autofix PRs |
| `sync-main-to-stable.yml` | Every 4 hours | Cherry-pick main to stable with lake-gate PR |
| `odh-release.yml` | Manual dispatch | Compile and release E2E test binaries |

**Tekton/Konflux Pipelines (34 pipelines)**:
- Extensive matrix of pull-request and push pipelines for training runtime images
- Covers CUDA and ROCm variants across multiple Python/PyTorch versions
- Path-filtered triggers (only builds when relevant Dockerfiles change)
- Memory limits configured for large image builds (10Gi)

**Strengths**:
- Path-filtered triggers avoid unnecessary builds
- Mergify auto-merge for stable branch sync with safety checks
- Tekton pipelines provide production-grade image builds

**Gaps**:
- No concurrency control on GitHub Actions workflows
- No caching in GitHub Actions (Go module cache)
- E2E tests not triggered on PRs (require real clusters)
- No GitHub Actions workflow for golangci-lint

### Test Coverage

**Unit Tests** (13 test files, 937 lines):
- All in `tests/common/support/` package
- Test Go testing framework helpers (batch, core, environment, events, image, ingress, kueue, machine, pytorchjob, ray, rbac, route, test utilities)
- Good coverage of support library but no unit tests for:
  - `tests/trainer/utils/` (6 helper files)
  - `tests/trainer/sdk_tests/` (8 helper files)
  - Suite `support.go` files (5 files across suites)
- No coverage generation (`-coverprofile` not used)

**E2E Tests** (28 test files, ~9000 lines):
- **tests/kfto/** (8 tests): KFTO v1 PyTorchJob tests — MNIST training, SFT LLM, SDK, smoke, upgrade
- **tests/trainer/** (12 tests): Kubeflow Trainer v2 — fashion MNIST, Kueue integration, MPI, SFT, smoke, upgrade, SDK
- **tests/fms/** (4 tests): FMS-HF-Tuning GPU fine-tuning with KFTO and Trainer
- **tests/odh/** (4 tests): ODH integration — Ray MNIST, RayTune HPO, DeepSpeed, gRPC

**Test-to-Code Ratio**: 9,940 test lines / 8,544 source lines = **1.16:1** (excellent ratio)

**Test Tiering System**:
- Smoke, Tier1, Tier2, Tier3 tags
- GPU requirements: `Gpu(accelerator)`, `MultiGpu(accelerator, n)`
- Multi-node: `MultiNode(n)`, `MultiNodeGpu(n, accelerator)`, `MultiNodeMultiGpu(n, accelerator, gpus)`
- Pre-Upgrade / Post-Upgrade tags

**Test Infrastructure**:
- Namespace isolation per test (`test.NewTestNamespace()`)
- `GenerateName` for all resources (collision avoidance)
- Automatic cleanup via `t.Cleanup`
- Shared support library with Kubernetes client helpers
- Test container image for remote execution (`images/tests/Dockerfile`)

### Code Quality

**Linting**:
- `.golangci.yml` present but minimal — only 3 linters: `govet`, `unused`, `ineffassign`
- Missing: `errcheck`, `staticcheck`, `gosimple`, `gocritic`, `gofmt`, `goimports`
- `openshift-goimports` used for import organization
- No golangci-lint CI workflow (only available as Makefile target)

**Pre-commit Hooks**:
- `.pre-commit-config.yaml` configured with:
  - `check-yaml`, `check-json`, `end-of-file-fixer`, `trailing-whitespace`, `pretty-format-json`
  - Python: `isort`, `black`, `flake8`
- Good baseline but not enforced in CI

**Static Analysis**:
- `go vet` runs in CI (go-vet.yml)
- Semgrep rules present (`semgrep.yaml`) — comprehensive unified config covering Go, Python, TS, YAML, secrets
- No Semgrep CI workflow configured
- No CodeQL integration

### Container Images

**Image Matrix** (28 Dockerfiles):
- **Training Runtime Images** (10 variants):
  - CUDA: py311-cuda121-torch241, py311-cuda124-torch251, py312-cuda128-torch280, py312-cuda128-torch290, py312-cuda130-torch210-openmpi41
  - ROCm: py311-rocm62-torch241, py311-rocm62-torch251, py312-rocm64-torch280, py312-rocm64-torch290, py312-rocm64-torch29-openmpi41
- **Example Runtime Images** (3): ray-torch-rocm, ray-torch-cuda, ray-data-rag
- **Test Image** (1): E2E test container with Go, oc CLI, gotestsum
- **Utility Images** (3): mc-cli, bloom560m model, alpaca dataset
- **Benchmark Images** (2): OSU MPI CPU and CUDA

**Build Process**:
- UBI9-based images with proper labeling
- Multi-stage installs for CUDA/ROCm
- Tekton/Konflux for production builds
- Podman-based builds in GitHub Actions

**Gaps**:
- No runtime validation (no `python -c "import torch"` startup test)
- No Trivy scanning (only Snyk IaC scanning on Dockerfiles, not built images)
- No SBOM generation
- No image signing or attestation
- No multi-architecture builds (x86_64 only)

### Security

**Strengths**:
- Snyk Dockerfile scanning (nightly + push to main) with HIGH severity threshold
- Snyk policy file (`.snyk`) excluding examples and tests
- Gitleaks configuration (`.gitleaks.toml`) with comprehensive allowlists for test data
- Semgrep rules file covering multiple languages and Kubernetes patterns
- Renovate for automated dependency updates

**Gaps**:
- No Trivy container image scanning (Snyk only scans Dockerfiles, not built images)
- No CodeQL/SAST on PRs
- Semgrep rules present but no CI workflow to run them
- No secret scanning in CI (gitleaks config exists but no CI integration)
- No SBOM generation for supply chain security

### Agent Rules (Agentic Flow Quality)

**Status**: Present (AGENTS.md) — no .claude/rules/ directory

**AGENTS.md Quality**: Excellent (one of the better AGENTS.md files in the ODH ecosystem)
- Clear repository structure overview
- Test suite documentation with paths
- Running instructions with examples
- Test pattern guidance:
  - Namespace isolation requirements
  - Resource naming with `GenerateName`
  - Cleanup patterns with `t.Cleanup`
  - Test structure template
  - Notebook editing conventions
  - Environment variable management
  - Test tagging system with tier table
- Lint/format commands with targeted options
- CVE fix process documentation

**Gaps**:
- No `.claude/` directory
- No structured test creation rules in `.claude/rules/`
- No separate unit test vs E2E test rules
- No examples of common test patterns for each suite
- Test patterns could be extracted into reusable rules

## Recommendations

### Priority 0 (Critical)

- **Add code coverage generation and codecov integration** to `go-unit-test.yml`:
  ```yaml
  - name: Unit tests with coverage
    run: go test -coverprofile=coverage.out ./tests/common/support/...
  - name: Upload coverage
    uses: codecov/codecov-action@v4
    with:
      files: ./coverage.out
  ```

- **Add CodeQL or gosec SAST scanning** to PR workflows:
  ```yaml
  # .github/workflows/codeql.yml
  name: CodeQL
  on: [push, pull_request]
  jobs:
    analyze:
      runs-on: ubuntu-latest
      steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: go
      - uses: github/codeql-action/analyze@v3
  ```

- **Implement image startup validation** in Tekton PR pipelines — add a step after image build to verify the image can start and import core dependencies

### Priority 1 (High Value)

- **Expand unit test coverage** beyond `tests/common/support/` to cover `tests/trainer/utils/`, `tests/trainer/sdk_tests/` helper files, and suite `support.go` files
- **Add more golangci-lint linters**: `errcheck`, `staticcheck`, `gosimple`, `gocritic` — the current 3-linter config misses many common issues
- **Create `.claude/rules/` directory** with structured test creation rules extracted from AGENTS.md patterns
- **Add Trivy container scanning** to complement existing Snyk Dockerfile-only scanning — scan built images for runtime vulnerabilities
- **Add Go module caching** to GitHub Actions workflows for faster CI

### Priority 2 (Nice-to-Have)

- **Automate a subset of E2E tests** in CI using Kind or lightweight cluster for smoke-tier tests
- **Add SBOM generation** to Tekton image build pipelines for supply chain compliance
- **Add image signing/attestation** for training runtime images
- **Enforce pre-commit hooks in CI** — add a CI workflow that runs `pre-commit run --all-files`
- **Add Semgrep to CI** — the rules file exists but is never executed in any workflow
- **Add Gitleaks to CI** — the config exists but is never executed in any workflow

## Comparison to Gold Standards

| Feature | distributed-workloads | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|---------|----------------------|---------------------|------------------|---------------|
| Unit test coverage | Support only | Comprehensive | Moderate | Comprehensive |
| E2E test coverage | Excellent (4 suites) | Excellent | Good | Excellent |
| Coverage tracking | None | Codecov | None | Codecov |
| Coverage enforcement | None | PR gates | None | Thresholds |
| Container scanning | Snyk (Dockerfile only) | Trivy | Trivy | Trivy |
| SAST | go vet only | CodeQL | None | CodeQL |
| Pre-commit | Configured | Configured + CI | Configured | Configured |
| Agent rules | AGENTS.md (excellent) | .claude/rules/ | None | None |
| Tekton/Konflux | 34 pipelines | Yes | Yes | Yes |
| Image runtime testing | None | None | 5-layer validation | None |
| Multi-arch builds | No | Yes | Yes | Yes |
| Golangci-lint depth | 3 linters | 15+ linters | N/A | 10+ linters |

## File Paths Reference

### CI/CD
- `.github/workflows/go-unit-test.yml` — Unit test workflow
- `.github/workflows/go-vet.yml` — Go vet workflow
- `.github/workflows/verify_generated_files.yml` — Import verification
- `.github/workflows/snyk-dockerfile-scan.yml` — Snyk security scanning
- `.github/workflows/sync-main-to-stable.yml` — Stable branch sync
- `.tekton/` — 34 Tekton/Konflux pipeline definitions

### Testing
- `tests/common/support/*_test.go` — Unit tests (13 files, 937 lines)
- `tests/kfto/` — KFTO v1 E2E tests (8 test files)
- `tests/trainer/` — Kubeflow Trainer v2 E2E tests (12 test files)
- `tests/fms/` — FMS-HF-Tuning E2E tests (4 test files)
- `tests/odh/` — ODH integration E2E tests (4 test files)
- `tests/common/support/` — Shared test infrastructure (27 Go files)

### Code Quality
- `.golangci.yml` — Linter configuration (3 linters)
- `.pre-commit-config.yaml` — Pre-commit hooks (YAML, JSON, Python formatting)
- `Makefile` — Build and test targets
- `hack/verify-imports.sh` — Import organization verification

### Container Images
- `images/runtime/training/` — 10 training runtime Dockerfiles
- `images/tests/Dockerfile` — E2E test container
- `images/runtime/examples/` — 3 example runtime images
- `benchmarks/osu-benchmarks/` — 2 benchmark Dockerfiles

### Security
- `.snyk` — Snyk policy configuration
- `.gitleaks.toml` — Gitleaks allowlist configuration
- `.gitleaksignore` — Gitleaks ignore file
- `semgrep.yaml` — Comprehensive Semgrep rules (not executed in CI)
- `renovate.json` — Automated dependency updates

### Agent Rules
- `AGENTS.md` — Comprehensive test pattern documentation
- No `.claude/` directory or `.claude/rules/`
