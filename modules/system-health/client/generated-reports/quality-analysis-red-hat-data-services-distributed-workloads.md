---
repository: "red-hat-data-services/distributed-workloads"
overall_score: 6.3
scorecard:
  - dimension: "Unit Tests"
    score: 6.0
    status: "Unit tests for support library using gomega; limited scope since repo is primarily E2E test code"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Comprehensive E2E suites across 4 domains with upgrade testing, namespace isolation, and tagging"
  - dimension: "Build Integration"
    score: 8.0
    status: "Extensive Konflux/Tekton PR-triggered pipelines for training image builds"
  - dimension: "Image Testing"
    score: 5.0
    status: "40+ Dockerfiles with UBI9 base and multi-stage builds, but no runtime validation tests"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tracking, no codecov, no coverprofile, no coverage thresholds"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "11 GHA workflows plus Tekton pipelines; scheduled jobs; missing caching and parallelization"
  - dimension: "Static Analysis"
    score: 5.0
    status: "Minimal golangci-lint (3 linters), pre-commit hooks present, Renovate disabled, no active dependency alerts"
  - dimension: "Agent Rules"
    score: 9.0
    status: "Excellent AGENTS.md, 3 Claude skills with actionable examples, PostToolUse hooks configured"
critical_gaps:
  - title: "No code coverage tracking"
    impact: "No visibility into which support library code or test infrastructure is itself tested; regressions in shared helpers go undetected"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container image runtime validation"
    impact: "40+ training images built without startup or functional validation; broken images reach production registries"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "Renovate disabled and no Dependabot"
    impact: "No automated dependency update alerts; CVEs in Go modules or Python packages discovered late"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "Minimal golangci-lint configuration"
    impact: "Only 3 linters enabled (govet, unused, ineffassign); missing errcheck, staticcheck, gosimple, and other high-value checks"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add --coverprofile to unit test CI and upload to codecov"
    effort: "2-4 hours"
    impact: "Immediate coverage visibility for support library; establishes baseline for coverage tracking"
  - title: "Enable Renovate or add Dependabot configuration"
    effort: "1-2 hours"
    impact: "Automated dependency update PRs for Go modules and Python packages"
  - title: "Expand golangci-lint enabled linters"
    effort: "2-3 hours"
    impact: "Catch more bugs with errcheck, staticcheck, gosimple without workflow changes"
  - title: "Add smoke test for training image startup"
    effort: "4-6 hours"
    impact: "Validate images can start and import core packages before pushing to registry"
recommendations:
  priority_0:
    - "Add coverage tracking with codecov integration and --coverprofile in unit test workflow"
    - "Add image startup validation tests for training images before registry push"
  priority_1:
    - "Enable Renovate (currently disabled) or configure Dependabot for gomod and pip ecosystems"
    - "Expand golangci-lint to include errcheck, staticcheck, gosimple, and gocritic"
    - "Add caching for Go modules in GitHub Actions workflows"
  priority_2:
    - "Add HEALTHCHECK directives to training image Dockerfiles"
    - "Add multi-architecture build support beyond x86_64 for training images"
    - "Add test parallelization in unit test workflow for faster feedback"
---

# Quality Analysis: distributed-workloads

## Executive Summary

- **Overall Score: 6.3/10**
- **Repository Type**: E2E test suite (Go) for distributed workloads on RHOAI
- **Primary Language**: Go (gomega assertions)
- **JIRA**: RHOAIENG / Training Kubeflow / downstream
- **Key Strengths**: Comprehensive E2E test suites with 4 domains (KFTO, FMS, ODH, Trainer), strong Konflux/Tekton build integration, excellent AI agent rules with 3 actionable skills
- **Critical Gaps**: Zero coverage tracking, no container image runtime validation, disabled dependency management (Renovate disabled, no Dependabot)
- **Agent Rules Status**: Excellent - comprehensive AGENTS.md with skills for add-e2e-test, add-benchmark, and update-support-lib

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 6.0/10 | 15% | 0.90 | Unit tests for support library using gomega; limited scope |
| Integration/E2E | 8.0/10 | 20% | 1.60 | Comprehensive suites across 4 domains with upgrade testing |
| Build Integration | 8.0/10 | 15% | 1.20 | Extensive Konflux/Tekton PR-triggered build pipelines |
| Image Testing | 5.0/10 | 10% | 0.50 | 40+ Dockerfiles with UBI9 base, no runtime validation |
| Coverage Tracking | 1.0/10 | 10% | 0.10 | No coverage tracking at all |
| CI/CD Automation | 7.0/10 | 15% | 1.05 | 11 GHA workflows + Tekton; missing caching |
| Static Analysis | 5.0/10 | 10% | 0.50 | Minimal linting, pre-commit present, Renovate disabled |
| Agent Rules | 9.0/10 | 5% | 0.45 | Excellent AGENTS.md, 3 skills, PostToolUse hooks |
| **Overall** | **6.3/10** | **100%** | **6.30** | |

## Critical Gaps

### 1. No Code Coverage Tracking
- **Impact**: No visibility into support library test coverage; regressions in shared helpers (`tests/common/support/`) go undetected
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The `go-unit-test.yml` workflow runs `go test ./tests/common/support/...` without `--coverprofile`. No `.codecov.yml`, no coverage thresholds, no PR coverage reporting.

### 2. No Container Image Runtime Validation
- **Impact**: 40+ training images (CUDA, ROCm, CPU variants across PyTorch versions) are built and pushed without any startup or functional verification; broken images can reach production registries
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: Images are built via Tekton pipelines and pushed to quay.io, but there's no `docker run` / `podman run` smoke test, no testcontainers validation, no HEALTHCHECK directives in any Dockerfile.

### 3. Renovate Disabled, No Dependabot
- **Impact**: No automated dependency update alerts for Go modules or Python packages; CVEs discovered manually and late
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: `renovate.json` exists but contains `{"enabled": false}`. No `.github/dependabot.yml` exists. The repo has complex Python dependency trees across 40+ training images.

### 4. Minimal golangci-lint Configuration
- **Impact**: Only 3 linters enabled (govet, unused, ineffassign), missing high-value checks like errcheck, staticcheck, gosimple
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: `.golangci.yml` uses `default: none` with only 3 explicit linters. For a test codebase with K8s client operations, errcheck is particularly important to catch ignored error returns.

## Quick Wins

### 1. Add Coverage Tracking to Unit Tests (2-4 hours)
Add `--coverprofile` to the unit test workflow and upload to codecov:
```yaml
# In .github/workflows/go-unit-test.yml
- name: Unit tests
  run: go test -coverprofile=coverage.out ./tests/common/support/...
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: coverage.out
    token: ${{ secrets.CODECOV_TOKEN }}
```

### 2. Enable Renovate or Add Dependabot (1-2 hours)
Either update `renovate.json`:
```json
{
  "enabled": true,
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:base"],
  "packageRules": [
    {"matchManagers": ["gomod"], "enabled": true},
    {"matchManagers": ["pip_requirements"], "enabled": true}
  ]
}
```
Or add `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: gomod
    directory: /
    schedule:
      interval: weekly
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

### 3. Expand golangci-lint Linters (2-3 hours)
```yaml
# .golangci.yml
version: "2"
run:
  allow-parallel-runners: true
linters:
  default: none
  enable:
    - govet
    - unused
    - ineffassign
    - errcheck
    - staticcheck
    - gosimple
    - gocritic
    - errorlint
issues:
  max-same-issues: 0
```

### 4. Add Image Startup Smoke Test (4-6 hours)
Add a CI step after image build to verify training images can start:
```yaml
- name: Smoke test image
  run: |
    podman run --rm --entrypoint python3 ${IMAGE} -c "import torch; print(f'PyTorch {torch.__version__}')"
```

## Detailed Findings

### Unit Tests

**Score: 6.0/10**

- **13 unit test files** in `tests/common/support/` testing the shared test infrastructure
- Framework: Go testing with **gomega** assertions
- Uses `t.Helper()` for clean stack traces in helpers
- Test-to-code ratio: 42 test files / 62 source files = 0.68 (note: this repo IS a test repo, so most "source" is also test code)
- Unit test CI runs on PRs via `go-unit-test.yml` triggered on `.go`, `go.mod`, `go.sum` changes
- **Key test files**: `batch_test.go`, `core_test.go`, `environment_test.go`, `events_test.go`, `image_test.go`, `ingress_test.go`, `kueue_test.go`, `machine_test.go`, `pytorchjob_test.go`, `ray_test.go`, `rbac_test.go`, `route_test.go`, `test_test.go`

**Strengths**: Good coverage of the shared test infrastructure; tests validate K8s resource parsing and helper functions.
**Gaps**: No coverage metric tracking; no test-to-code ratio enforcement.

### Integration/E2E Tests

**Score: 8.0/10**

The repo's primary purpose is E2E testing, organized into 4 well-structured suites:

| Suite | Files | Focus |
|-------|-------|-------|
| `tests/kfto/` | 8 | KFTO v1 (PyTorchJob) - MNIST, SFT, smoke, upgrade |
| `tests/fms/` | 4 | fms-hf-tuning GPU fine-tuning (SFT TrainJob, Kueue) |
| `tests/odh/` | 5 | ODH integration (Ray, RayTune HPO, DeepSpeed) |
| `tests/trainer/` | 12 | Kubeflow Trainer v2 (smoke, MPI, fashion MNIST, SDK, upgrade) |

**Strengths**:
- **Namespace isolation**: Every test uses `test.NewTestNamespace()` for dedicated namespaces
- **Tagging system**: Smoke, Tier1-3, Gpu, MultiGpu, MultiNode tags for selective execution
- **Upgrade testing**: `kfto_kueue_mnist_upgrade_training_test.go`, `trainer_kueue_upgrade_training_test.go`, `trainer_trainingruntime_upgrade_test.go`
- **Resource naming**: GenerateName pattern prevents test collisions
- **Compiled test releases**: `odh-release.yml` workflow compiles tests into release binaries

**Gaps**: Tests require real OpenShift cluster (no local Kind/Minikube option); no test result reporting integration.

### Build Integration

**Score: 8.0/10**

**GitHub Actions (PR-triggered)**:
- `go-unit-test.yml` - Go unit tests on `.go`/`go.mod` changes
- `go-vet.yml` - Go vet on `.go`/`go.mod` changes
- `verify_generated_files.yml` - Import organization and agent config sync verification
- `build-and-push-osu-benchmark.yml` - Benchmark image builds on PR (path-filtered)

**Tekton/Konflux Pipelines** (26+ pipeline configs in `.tekton/`):
- PR-triggered builds for each training image variant (CUDA 12.1/12.4/12.8/13.0, ROCm 6.2/6.4, CPU)
- Label/comment-triggered: `/build-konflux-*` comments, `kfbuild-*` labels
- Konflux-specific Dockerfiles (`Dockerfile.konflux`, `Dockerfile.konflux.cuda`, `Dockerfile.konflux.cpu`, `Dockerfile.konflux.rocm`)
- Pipeline timeout: 10 hours for builds, 8 hours for tasks
- `cancel-in-progress: true` for concurrent PR builds
- Source image and image index enabled

**Strengths**: Extensive Konflux integration with per-variant PR build validation; production build simulation before merge.
**Gaps**: No dry-run manifest validation; no cross-image dependency checks.

### Image Testing

**Score: 5.0/10**

**40+ Dockerfiles** across multiple categories:

| Category | Count | Base Images |
|----------|-------|-------------|
| Runtime training | ~16 | UBI9 (FIPS-capable) |
| Universal training | ~6 | UBI9 |
| Ray runtime | ~7 | UBI9 / ray base images |
| Ray examples | 4 | Various |
| Test/benchmark/utility | ~8 | golang, UBI9 |

**Strengths**:
- UBI9 base images across training variants (FIPS-capable)
- Multi-stage builds in universal training images (builder -> final)
- FIPS-friendly documentation in universal image Dockerfiles
- Separate Konflux-specific Dockerfiles for production builds
- Clear labeling with `io.k8s.display-name` and `io.k8s.description`

**Gaps**:
- No runtime validation (no `testcontainers`, no `docker run` smoke tests)
- No HEALTHCHECK directives
- No image startup tests in CI
- Limited multi-arch: only `linux/x86_64` in Tekton pipelines
- No `.dockerignore` files in image directories

### Coverage Tracking

**Score: 1.0/10**

- **No** `.codecov.yml` or `codecov.yml`
- **No** `--coverprofile` in any CI workflow
- **No** coverage thresholds or gates
- **No** PR coverage reporting
- **No** `.coveragerc` for Python code
- The `go-unit-test.yml` runs `go test ./tests/common/support/...` with no coverage flags

This is the most critical gap in the repository. Without coverage tracking, there's no way to measure or enforce quality of the shared test infrastructure.

### CI/CD Automation

**Score: 7.0/10**

**Workflow Inventory (11 GitHub Actions + 26+ Tekton pipelines)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `go-unit-test.yml` | PR, push (main) | Unit tests for support library |
| `go-vet.yml` | PR, push (main) | Go vet linting |
| `verify_generated_files.yml` | PR, push | Import verification + agent config sync |
| `build-and-push-osu-benchmark.yml` | PR, push | Benchmark image builds |
| `build-and-push-test-images.yml` | push (main) | Test container image builds |
| `build-and-push-test-images-release-branch.yml` | push (rhoai-*) | Release branch test images |
| `odh-release.yml` | manual dispatch | Compiled test binary releases |
| `snyk-dockerfile-scan.yml` | push, schedule, labeled PR | Dockerfile vulnerability scanning |
| `sync-main-to-stable.yml` | schedule (4h) | Cherry-pick main -> stable |
| `universal-image-lockfile-refresh.yaml` | schedule (daily) | Python lockfile updates |
| `notify-autofix-prs.yml` | PR target, schedule | Slack notifications for autofix PRs |

**Strengths**:
- Concurrency control in lockfile refresh (`cancel-in-progress`)
- Tekton pipelines with `cancel-in-progress: true`
- Mergify for auto-approve/merge lake-gate PRs to stable
- Scheduled lockfile refresh keeps dependencies current
- Slack integration for PR notifications

**Gaps**:
- No Go module caching in GitHub Actions workflows (no `cache:` configuration)
- No test parallelization (single `go test` invocation)
- No `timeout-minutes` in GitHub Actions jobs (Tekton has 10h timeout)

### Static Analysis

**Score: 5.0/10**

**Linting**:
- `golangci-lint` v2.12.1 configured with only 3 linters: `govet`, `unused`, `ineffassign`
- `go vet` runs on PRs via dedicated workflow
- Import organization verification via `openshift-goimports`

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- `check-yaml`, `check-json` - file format validation
- `end-of-file-fixer`, `trailing-whitespace` - formatting
- `pretty-format-json` - JSON formatting
- `isort` (Python import ordering), `black` (Python formatting), `flake8` (Python linting)

**FIPS Compatibility**:
- Universal training images document FIPS-friendly features in Dockerfile comments
- UBI9 base images across all training variants (FIPS-capable)
- No `math/rand` usage in test code
- No non-FIPS crypto imports detected in Go source

**Dependency Alerts**:
- `renovate.json` present but **disabled** (`"enabled": false`)
- No `.github/dependabot.yml`
- No automated dependency update mechanism active

**Strengths**: Good pre-commit hooks covering Go and Python; FIPS awareness in image builds.
**Gaps**: Very minimal linting; disabled dependency management; no active vulnerability alerting for dependencies.

### Agent Rules

**Score: 9.0/10**

**Documentation**:
- **AGENTS.md** (4.3 KB): Comprehensive guide covering repository structure, test suites, key paths, running tests, writing tests, lint/format commands, benchmarks, support library, common workflows, CVE fix procedures, and skill management
- **CLAUDE.md**: Symlinked to AGENTS.md
- **ARCHITECTURE.md**: Full repository architecture documentation

**Skills** (3 actionable Claude skills in `.claude/skills/`):
- **add-e2e-test/SKILL.md**: Detailed guide with test structure template, namespace isolation, resource naming (GenerateName), cleanup, tag system, environment variable patterns, and notebook editing conventions
- **add-benchmark/SKILL.md**: Guide for adding benchmarks (Dockerfile, ClusterTrainingRuntime, TrainJob, CI workflow)
- **update-support-lib/SKILL.md**: Guide for modifying shared test infrastructure (getters, condition checkers, client abstraction, option pattern)

**Configuration**:
- `.claude/settings.json` with PostToolUse hook: auto-runs `openshift-goimports` after Edit/Write on `.go` files
- AI skills canonical source in `ai/skills/` with sync script (`make sync-agents-config`)
- CI verification of agent config sync (`verify_generated_files.yml`)

**Quality Assessment**:
- Rules are comprehensive and actionable (not generic "write tests" advice)
- Framework-specific: gomega assertions, GenerateName patterns, namespace isolation
- Include concrete code examples and anti-patterns
- Cover all main repo workflows (E2E tests, benchmarks, support lib)
- PostToolUse hook ensures code style compliance automatically

## Recommendations

### Priority 0 (Critical)

1. **Add coverage tracking with codecov integration** (4-6 hours)
   - Add `--coverprofile=coverage.out` to `go test` in `go-unit-test.yml`
   - Add codecov upload step
   - Create `.codecov.yml` with minimum coverage thresholds
   - Track coverage for `tests/common/support/` package

2. **Add container image runtime validation** (8-12 hours)
   - Add smoke test step in Tekton pipelines after image build
   - Verify Python imports (`import torch`, `import transformers`)
   - Check for expected binaries and library versions
   - Add basic startup tests before pushing to registry

### Priority 1 (High Value)

3. **Enable dependency update automation** (1-2 hours)
   - Either enable Renovate (`"enabled": true` in `renovate.json`) or add Dependabot
   - Cover `gomod`, `pip`, and `github-actions` ecosystems
   - Configure auto-merge for patch updates

4. **Expand golangci-lint configuration** (2-4 hours)
   - Add errcheck, staticcheck, gosimple, gocritic, errorlint
   - Particularly important for K8s client code where error handling matters

5. **Add Go module caching to CI workflows** (1-2 hours)
   - Add `cache: true` to `actions/setup-go@v5` steps or explicit cache action
   - Will speed up all Go-related CI jobs

### Priority 2 (Nice-to-Have)

6. **Add HEALTHCHECK to training Dockerfiles** (2-3 hours)
   - Add `HEALTHCHECK CMD python3 -c "import torch"` or similar to runtime images

7. **Add multi-architecture support** (4-8 hours)
   - Extend Tekton pipeline build-platforms beyond `linux/x86_64`
   - Enable `linux/aarch64` for ARM compatibility

8. **Add timeout-minutes to GitHub Actions jobs** (30 minutes)
   - Prevent runaway jobs from consuming CI resources

## Comparison to Gold Standards

| Practice | distributed-workloads | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|----------|----------------------|---------------------|-------------------|---------------|
| Unit test coverage | Support lib only | Multi-layer | N/A | Comprehensive |
| E2E test suites | 4 suites, 29 tests | Cypress + API | Image validation | Multi-version |
| Coverage tracking | None | Codecov enforced | Basic | Codecov + thresholds |
| Build integration | Konflux/Tekton | PR builds | PR builds | PR builds |
| Image testing | Build only | N/A | 5-layer validation | Basic |
| CI/CD caching | None | Module + build cache | Layer cache | Module cache |
| Linting depth | 3 linters | Comprehensive ESLint | Basic | 10+ linters |
| Agent rules | Excellent (9/10) | Comprehensive | Basic | Moderate |
| Dependency mgmt | Disabled | Renovate active | Dependabot | Renovate |
| FIPS awareness | UBI9 + documentation | N/A | FIPS-capable images | N/A |

## File Paths Reference

### CI/CD
- `.github/workflows/go-unit-test.yml` - Unit test workflow
- `.github/workflows/go-vet.yml` - Go vet workflow
- `.github/workflows/verify_generated_files.yml` - Import + agent config verification
- `.github/workflows/build-and-push-osu-benchmark.yml` - Benchmark image builds
- `.github/workflows/build-and-push-test-images.yml` - Test image builds
- `.github/workflows/sync-main-to-stable.yml` - Main -> stable sync
- `.github/workflows/universal-image-lockfile-refresh.yaml` - Python lockfile refresh
- `.tekton/*.yaml` - 26+ Konflux build pipelines

### Testing
- `tests/common/support/*_test.go` - 13 unit test files
- `tests/kfto/` - KFTO v1 E2E tests (8 files)
- `tests/fms/` - FMS fine-tuning E2E tests (4 files)
- `tests/odh/` - ODH integration E2E tests (5 files)
- `tests/trainer/` - Kubeflow Trainer v2 E2E tests (12 files)

### Code Quality
- `.golangci.yml` - golangci-lint config (3 linters)
- `.pre-commit-config.yaml` - Pre-commit hooks (8 hooks)
- `renovate.json` - Renovate (disabled)

### Container Images
- `images/runtime/training/` - Training runtime Dockerfiles (16+ variants)
- `images/universal/training/` - Universal training Dockerfiles (6 variants)
- `images/runtime/ray/` - Ray runtime Dockerfiles (7 variants)
- `images/tests/Dockerfile` - Test container image
- `benchmarks/osu-benchmarks/Dockerfile*` - Benchmark images

### Agent Rules
- `AGENTS.md` - Comprehensive agent documentation (symlinked as CLAUDE.md)
- `ARCHITECTURE.md` - Repository architecture guide
- `.claude/skills/add-e2e-test/SKILL.md` - E2E test writing guide
- `.claude/skills/add-benchmark/SKILL.md` - Benchmark addition guide
- `.claude/skills/update-support-lib/SKILL.md` - Support library modification guide
- `.claude/settings.json` - PostToolUse hooks for goimports
- `ai/skills/` - Canonical skill source directory
