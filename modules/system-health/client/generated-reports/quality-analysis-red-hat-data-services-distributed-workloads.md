---
repository: "red-hat-data-services/distributed-workloads"
overall_score: 6.4
scorecard:
  - dimension: "Unit Tests"
    score: 5.0
    status: "Unit tests only cover the shared support library; no unit tests for test logic or utilities"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Comprehensive E2E test suites covering KFTO, Trainer v2, Ray, FMS across GPU/CPU variants"
  - dimension: "Build Integration"
    score: 7.0
    status: "Tekton/Konflux PR pipelines for image builds; no PR-time integration deployment testing"
  - dimension: "Image Testing"
    score: 6.5
    status: "20+ Dockerfiles with multi-arch support and Konflux builds; limited runtime validation"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage generation, no codecov/coveralls integration, no coverage thresholds"
  - dimension: "CI/CD Automation"
    score: 6.5
    status: "GitHub Actions for unit tests/vet/imports; E2E tests run externally via Jenkins; Tekton for image builds"
  - dimension: "Agent Rules"
    score: 8.0
    status: "Comprehensive AGENTS.md with test patterns, naming conventions, tagging, and detailed writing guidance"
critical_gaps:
  - title: "No code coverage tracking"
    impact: "Cannot measure or enforce test coverage; regressions in support library go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Unit tests limited to support library only"
    impact: "Test helpers, utilities, and resource generators in tests/ have no unit-level validation"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No PR-time E2E test execution"
    impact: "E2E regressions discovered only after merge via external Jenkins runs"
    severity: "MEDIUM"
    effort: "16-24 hours"
  - title: "No container image runtime validation in CI"
    impact: "Image startup and basic functionality issues not caught until downstream deployment"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "golangci-lint not enforced in CI workflows"
    impact: "Only go vet runs on PRs; deeper static analysis linting not automated"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add codecov integration with coverage reporting"
    effort: "2-4 hours"
    impact: "Enables coverage tracking, PR comments with coverage deltas, and threshold enforcement"
  - title: "Add golangci-lint to PR workflow"
    effort: "1-2 hours"
    impact: "Catches code quality issues (already configured in .golangci.yml) before merge"
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Supplements Snyk Dockerfile scan with runtime vulnerability detection in built images"
  - title: "Add basic image smoke test in CI"
    effort: "2-4 hours"
    impact: "Validates built test images can start and basic Go test binary executes"
recommendations:
  priority_0:
    - "Implement coverage tracking with codecov for the unit test suite (tests/common/support/)"
    - "Add golangci-lint as a required PR check (config already exists in .golangci.yml)"
  priority_1:
    - "Expand unit test coverage beyond support library to test utilities and resource generators"
    - "Add container image runtime validation (smoke test built images in CI)"
    - "Implement PR-time lightweight E2E smoke tests using Kind/Minikube for basic operator validation"
  priority_2:
    - "Add Trivy scanning alongside existing Snyk for defense-in-depth"
    - "Enable Renovate for automated dependency updates (currently disabled)"
    - "Add CodeQL or Semgrep to CI workflow (semgrep.yaml config exists but no CI integration)"
---

# Quality Analysis: distributed-workloads

## Executive Summary

- **Overall Score: 6.4/10**
- **Repository Type**: Go E2E test suite + container image definitions for distributed ML workloads on RHOAI
- **Primary Language**: Go (test framework), Python (training scripts), Dockerfile (images)
- **Key Strengths**: Comprehensive E2E test suites covering 4 product areas (KFTO, Trainer v2, FMS, ODH), excellent agent rules documentation, robust test infrastructure with shared support library, extensive multi-architecture image matrix
- **Critical Gaps**: No code coverage tracking, unit tests limited to support library, golangci-lint not in CI, E2E tests run externally (not on PR)
- **Agent Rules Status**: Present and comprehensive (AGENTS.md / CLAUDE.md symlink)

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 5.0/10 | Unit tests only cover shared support library (12 test files); no tests for test utilities |
| Integration/E2E | 8.5/10 | 29 E2E test files across 4 suites with GPU/CPU variants, upgrade tests, smoke tests |
| **Build Integration** | **7.0/10** | **Tekton/Konflux PR pipelines for images; no deployment-level integration in CI** |
| Image Testing | 6.5/10 | 20+ Dockerfiles, multi-arch (amd64/ppc64le/s390x), but no runtime validation in CI |
| Coverage Tracking | 1.0/10 | No coverage generation, no codecov, no thresholds |
| CI/CD Automation | 6.5/10 | GitHub Actions for basic checks; E2E and full image testing external |
| Agent Rules | 8.0/10 | AGENTS.md with test patterns, tagging, naming, cleanup, and notebook conventions |

## Critical Gaps

### 1. No Code Coverage Tracking
- **Impact**: Cannot measure support library test coverage; no way to detect regressions or enforce minimum coverage on PRs
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The `go test ./tests/common/support/...` command runs in CI but does not generate coverage reports. No codecov.yml or coveralls integration exists.
- **Implementation**:
  ```yaml
  # Add to go-unit-test.yml
  - name: Unit tests with coverage
    run: go test -coverprofile=coverage.out ./tests/common/support/...
  - name: Upload coverage
    uses: codecov/codecov-action@v4
    with:
      files: coverage.out
      token: ${{ secrets.CODECOV_TOKEN }}
  ```

### 2. Unit Tests Limited to Support Library
- **Impact**: The 38 Go source files in `tests/common/support/` have 12 companion test files (~32% file coverage). The 24 non-support source files across test suites have zero unit tests.
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Details**: Files like `support.go`, `utils/`, and `sdk_tests/` in various test suites have no unit-level validation. The support library tests are well-written (using gomega, table-driven) but coverage is incomplete.

### 3. No PR-Time E2E Test Execution
- **Impact**: E2E test regressions are only discovered after merge, when tests run externally via Jenkins on OpenShift clusters
- **Severity**: MEDIUM
- **Effort**: 16-24 hours
- **Details**: This is somewhat inherent to the nature of the tests (requiring OpenShift clusters with GPUs), but a lightweight smoke subset could run in CI using Kind.

### 4. No Container Image Runtime Validation in CI
- **Impact**: The test image (`images/tests/Dockerfile`) is built and pushed but never validated for basic startup in CI
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: Could add a simple `docker run` step to verify the test binary is accessible and basic imports work.

### 5. golangci-lint Not Enforced in CI
- **Impact**: `.golangci.yml` exists with 3 linters (govet, unused, ineffassign), but only `go vet` runs in GitHub Actions. Linters like `unused` and `ineffassign` don't run on PRs.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
Add coverage generation and upload to the existing unit test workflow. The Go toolchain natively supports `-coverprofile` — just add the flag and a codecov upload step.

### 2. Add golangci-lint to PR Workflow (1-2 hours)
The `.golangci.yml` config already exists. Add a workflow step:
```yaml
- name: golangci-lint
  uses: golangci/golangci-lint-action@v6
  with:
    version: v2.12.1
```

### 3. Add Trivy Container Scanning (1-2 hours)
Supplement the existing Snyk Dockerfile scan with Trivy for runtime vulnerability scanning:
```yaml
- name: Run Trivy
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.E2E_TEST_IMAGE }}
    severity: HIGH,CRITICAL
```

### 4. Add Image Smoke Test (2-4 hours)
After building the test image in CI, run a basic validation:
```yaml
- name: Smoke test image
  run: |
    podman run --rm ${E2E_TEST_IMAGE} ls /distributed-workloads/tests/
    podman run --rm ${E2E_TEST_IMAGE} go version
```

## Detailed Findings

### CI/CD Pipeline

**GitHub Actions Workflows (11 files)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `go-unit-test.yml` | PR + push (Go files) | Unit tests for support library |
| `go-vet.yml` | PR + push (Go files) | Go vet static analysis |
| `verify_generated_files.yml` | PR + push (Go files) | Import organization verification |
| `build-and-push-test-images.yml` | push to main | Build/push E2E test container |
| `build-and-push-test-images-release-branch.yml` | push to rhoai-* | Build/push release test images |
| `build-and-push-osu-benchmark.yml` | PR + push (benchmark paths) | Build OSU benchmark images |
| `snyk-dockerfile-scan.yml` | push to main + nightly + labeled PR | Snyk IaC scan on training Dockerfiles |
| `sync-main-to-stable.yml` | Every 4 hours | Cherry-pick main→stable with lake-gate PR |
| `odh-release.yml` | workflow_dispatch | Compile tests and create GitHub release |
| `notify-autofix-prs.yml` | PR opened + weekday schedule | Slack notifications for jira-autofix PRs |

**Tekton/Konflux Pipelines (27 files)**:
- PR-triggered pipelines for Ray CPU/CUDA image builds
- Push pipelines for training images (CUDA 12.1/12.4/12.8/13.0, ROCm 6.2/6.4)
- Multi-architecture builds (linux/ppc64le)
- Managed centrally via `konflux-central` repository

**Strengths**:
- Path-based triggers prevent unnecessary CI runs
- Separate release branch image build workflow
- Automated main→stable sync with Mergify fast-forward
- Konflux integration for production image builds

**Gaps**:
- No concurrency control on GitHub Actions workflows (except Tekton)
- No caching in Go workflows (setup-go uses go.mod but no explicit cache)
- E2E tests not integrated into CI (run externally)
- golangci-lint configured but not in any workflow

### Test Coverage

**Test-to-Code Ratio**: Excellent — 9,940 lines of test code vs. 8,544 lines of production code (1.16:1)

**Unit Tests (12 files in tests/common/support/)**:
- `batch_test.go`, `core_test.go`, `environment_test.go`, `events_test.go`
- `image_test.go`, `ingress_test.go`, `kueue_test.go`, `machine_test.go`
- `pytorchjob_test.go`, `ray_test.go`, `rbac_test.go`, `route_test.go`, `test_test.go`
- Framework: Go testing + gomega matchers
- Run via: `go test ./tests/common/support/...`

**E2E Test Suites (29 files)**:
- `tests/trainer/` (12 files): Kubeflow Trainer v2 — smoke, SFT, MPI, Kueue integration, upgrades, JobSet
- `tests/kfto/` (8 files): KFTO v1 — PyTorchJob, MNIST, SDK, SFT LLM, Kueue upgrades
- `tests/fms/` (4 files): FMS HF tuning — SFT TrainJob, GPU tests
- `tests/odh/` (4 files): ODH integration — Ray, RayTune HPO, DeepSpeed
- Well-structured with tag system: `Smoke`, `Tier1-Tier3`, `Gpu`, `MultiGpu`, `MultiNode`

**Test Infrastructure Quality**:
- Shared support library with 38 helper files (clients, conditions, environment, resources)
- Namespace isolation with automatic cleanup
- GenerateName for collision avoidance
- Fake client support (`fakeclient.go`)
- Gomega-based assertions with `Eventually` for async operations

### Code Quality

**Linting**:
- `.golangci.yml`: golangci-lint v2 config with 3 linters (govet, unused, ineffassign)
- `go vet` runs on PRs via GitHub Actions
- golangci-lint **not** in CI — significant gap given the config exists
- `openshift-goimports` for import organization (verified in CI)

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- `check-yaml`, `check-json`, `end-of-file-fixer`, `trailing-whitespace`, `pretty-format-json`
- Python: `isort` (profile=black), `black` formatter, `flake8` (max-line-length=88)
- Covers both Go and Python code hygiene

**Static Analysis**:
- Semgrep config exists (`semgrep.yaml`) with comprehensive rules for Go, Python, TS, YAML, secrets detection — **but not integrated into CI**
- Snyk policy (`.snyk`) excludes examples/ and tests/ from scanning
- Gitleaks config (`.gitleaks.toml`) with comprehensive allowlists for test files

### Container Images

**Image Matrix** (20+ Dockerfiles):
- **Training runtime images**: CUDA 12.1/12.4/12.8/13.0, ROCm 6.2/6.4, with PyTorch variants
- **Universal training images**: CPU/CUDA/ROCm base images
- **Ray images**: CPU, CUDA, ROCm with Python 3.11/3.12
- **Example images**: Ray data processing (Docling, RAG), torch (CUDA/ROCm)
- **Utility images**: dataset (Alpaca), model (Bloom 560M), mc-cli, tests, benchmarks (OSU)

**Build Process**:
- Multi-stage builds in benchmark images
- UBI/Red Hat base images (`odh-midstream-python-base`)
- Multi-architecture support (ppc64le via Tekton)
- Konflux-managed production builds with centralized pipeline definitions

**Security**:
- Snyk Dockerfile scanning on main push + nightly (HIGH/CRITICAL threshold)
- PR scanning available via `run-snyk` label
- No Trivy integration
- No SBOM generation
- No image signing/attestation visible

### Security Practices

| Practice | Status | Details |
|----------|--------|---------|
| Gitleaks | Configured | `.gitleaks.toml` with comprehensive allowlists |
| Snyk | Active | Dockerfile scanning on push + nightly schedule |
| Semgrep | Config only | `semgrep.yaml` with 5 rule categories, not in CI |
| CodeQL | Missing | No CodeQL integration |
| Dependency scanning | Limited | Snyk policy exists; Renovate disabled |
| Secret detection | Configured | Via Gitleaks + Semgrep generic rules (not in CI) |

### Agent Rules (Agentic Flow Quality)

**Status**: Present and comprehensive

**AGENTS.md** (symlinked as CLAUDE.md) — 6KB of detailed guidance:
- Repository structure overview (tests/, examples/, images/)
- Test suite descriptions for all 4 suites (kfto, fms, odh, trainer)
- Key paths for development
- Running tests with specific examples
- Prerequisites (OpenShift, RHOAI)
- Lint/format commands with targeted options
- **Writing Tests section** — excellent:
  - Namespace isolation with `test.NewTestNamespace()`
  - Resource naming with `GenerateName`
  - Cleanup guidance (namespace-scoped vs cluster-scoped)
  - Test structure template
  - Notebook editing conventions (1-space JSON, array-of-lines format)
  - Environment variable patterns (`environment.go` getters)
  - Tag system with detailed table (Smoke, Tier1-3, Gpu, MultiGpu, MultiNode variants)
- CVE fix guidance for Python dependency updates

**Strengths**:
- Actionable patterns with code examples
- Covers both Go tests and Python/notebook conventions
- Tag system documentation enables proper test categorization
- Environment variable discipline prevents `os.Getenv` scatter

**Gaps**:
- No `.claude/rules/` directory for structured rule files
- No separate rules per test type (unit-tests.md, e2e-tests.md)
- Missing guidance on mocking patterns and fake client usage
- No quality gate checklist for PR readiness

## Recommendations

### Priority 0 (Critical)

1. **Implement coverage tracking with codecov** — Add `-coverprofile` to the unit test workflow and integrate codecov. Set a baseline threshold (aim for 60%+ on support library). Effort: 2-4 hours.

2. **Add golangci-lint to PR workflow** — The config exists but isn't enforced. Add `golangci/golangci-lint-action@v6` as a required check. Effort: 1-2 hours.

### Priority 1 (High Value)

3. **Expand unit test coverage** — Add unit tests for test suite utilities like `support.go`, `utils/`, and SDK test helpers across kfto/trainer/odh suites. Target the support library first (currently ~32% file coverage). Effort: 8-16 hours.

4. **Integrate Semgrep into CI** — `semgrep.yaml` with 5 rule categories already exists. Add a workflow:
   ```yaml
   - uses: returntocorp/semgrep-action@v1
     with:
       config: semgrep.yaml
   ```
   Effort: 1-2 hours.

5. **Add container image smoke tests** — After building test images in CI, validate they start and contain expected binaries. Effort: 2-4 hours.

### Priority 2 (Nice-to-Have)

6. **Enable Renovate** — Currently disabled (`"enabled": false`). Enable for automated dependency updates, especially for Go modules and base image versions. Effort: 2-4 hours.

7. **Add structured agent rules** — Create `.claude/rules/` with separate files for each test type (unit-tests.md, e2e-tests.md, image-tests.md) to supplement AGENTS.md. Effort: 2-3 hours.

8. **Add Trivy scanning** — Defense-in-depth alongside Snyk for container image vulnerability scanning. Effort: 1-2 hours.

9. **Add CodeQL or SAST** — No SAST beyond Snyk IaC scanning. Consider CodeQL for Go and Python analysis. Effort: 2-4 hours.

10. **Implement PR-time lightweight E2E** — Run basic operator smoke tests using Kind in CI to catch regressions before merge. Significant effort given GPU requirements, but CPU-only smoke tests are feasible. Effort: 16-24 hours.

## Comparison to Gold Standards

| Dimension | distributed-workloads | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|-----------|----------------------|---------------------|------------------|---------------|
| Unit Tests | 5.0 — Support library only | 9.0 — Comprehensive with mocks | 7.0 — Image validation | 8.0 — Controller tests |
| Integration/E2E | 8.5 — 4 full suites | 9.0 — Multi-layer + contracts | 8.0 — 5-layer validation | 9.0 — Multi-version |
| Build Integration | 7.0 — Tekton PR builds | 8.0 — Module Federation | 7.0 — Multi-arch | 8.0 — CRD validation |
| Image Testing | 6.5 — Build only | 7.0 — Startup validation | 9.0 — 5-layer runtime | 7.0 — Serving tests |
| Coverage Tracking | 1.0 — None | 9.0 — Codecov + thresholds | 6.0 — Partial | 8.0 — Enforced |
| CI/CD Automation | 6.5 — Basic + external | 9.0 — Full PR pipeline | 8.0 — Multi-arch CI | 9.0 — Release automation |
| Agent Rules | 8.0 — AGENTS.md | 9.0 — Full .claude/rules/ | 5.0 — Minimal | 4.0 — No rules |

## File Paths Reference

### CI/CD
- `.github/workflows/go-unit-test.yml` — Unit test runner
- `.github/workflows/go-vet.yml` — Go vet checks
- `.github/workflows/verify_generated_files.yml` — Import verification
- `.github/workflows/snyk-dockerfile-scan.yml` — Security scanning
- `.github/workflows/sync-main-to-stable.yml` — Branch sync automation
- `.tekton/` — Konflux pipeline runs (managed by konflux-central)
- `.mergify.yml` — Auto-merge lake-gate PRs
- `Makefile` — Build and test targets

### Testing
- `tests/common/support/` — Shared test infrastructure (38 source + 12 test files)
- `tests/trainer/` — Kubeflow Trainer v2 E2E tests (12 files)
- `tests/kfto/` — KFTO v1 E2E tests (8 files)
- `tests/fms/` — FMS HF tuning E2E tests (4 files)
- `tests/odh/` — ODH integration E2E tests (4 files)

### Code Quality
- `.golangci.yml` — golangci-lint v2 config (3 linters)
- `.pre-commit-config.yaml` — Pre-commit hooks (YAML, JSON, Python formatting)
- `semgrep.yaml` — Semgrep rules (not in CI)
- `.gitleaks.toml` — Secret detection config
- `.snyk` — Snyk policy

### Container Images
- `images/runtime/training/` — 10 training runtime Dockerfiles (CUDA/ROCm variants)
- `images/runtime/ray/` — Ray runtime images
- `images/universal/training/` — 3 universal training base images
- `images/tests/Dockerfile` — E2E test runner image
- `benchmarks/osu-benchmarks/Dockerfile` — MPI benchmark images

### Agent Rules
- `AGENTS.md` — Comprehensive agent guidance (CLAUDE.md symlinks to this)
- `renovate.json` — Renovate config (disabled)
