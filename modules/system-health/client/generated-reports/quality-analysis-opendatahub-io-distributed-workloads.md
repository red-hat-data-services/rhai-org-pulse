---
repository: "opendatahub-io/distributed-workloads"
overall_score: 5.9
scorecard:
  - dimension: "Unit Tests"
    score: 5.0
    status: "Unit tests cover only the support library; no coverage tracking"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Comprehensive E2E suites across 4 test domains with tag-based tiering"
  - dimension: "Build Integration"
    score: 6.0
    status: "Konflux/Tekton PR builds for images, but no runtime validation"
  - dimension: "Image Testing"
    score: 5.0
    status: "26 Dockerfiles with UBI9 bases, but no runtime or startup validation"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tracking, thresholds, or PR reporting configured"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "Good workflow coverage with Tekton integration, missing caching and timeouts"
  - dimension: "Static Analysis"
    score: 5.0
    status: "Semgrep and pre-commit hooks present, but minimal Go linters and Renovate disabled"
  - dimension: "Agent Rules"
    score: 9.0
    status: "Excellent AGENTS.md, 3 custom skills, automated sync, CI verification"
critical_gaps:
  - title: "No code coverage tracking"
    impact: "Cannot measure test effectiveness or enforce coverage standards on PRs"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Unit tests limited to support library"
    impact: "E2E test utilities and helpers outside tests/common/support/ have no unit tests"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No container image runtime validation"
    impact: "26 Dockerfiles built without startup or health check verification"
    severity: "HIGH"
    effort: "6-8 hours"
  - title: "Renovate dependency management disabled"
    impact: "No automated dependency update PRs; manual tracking of CVEs across 26+ images"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "Minimal golangci-lint configuration"
    impact: "Only 3 linters enabled (govet, unused, ineffassign); misses many bug classes"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Enable Renovate for automated dependency updates"
    effort: "1 hour"
    impact: "Automated CVE detection and dependency update PRs across Go and Python"
  - title: "Add --coverprofile to unit test workflow"
    effort: "1-2 hours"
    impact: "Visibility into support library test coverage with PR reporting"
  - title: "Expand golangci-lint linter set"
    effort: "2-3 hours"
    impact: "Catch more bug classes (errcheck, staticcheck, gosec, gocritic)"
  - title: "Add timeout-minutes to all GitHub Actions jobs"
    effort: "30 minutes"
    impact: "Prevent hung CI jobs from consuming runner resources"
  - title: "Add Go module caching to CI workflows"
    effort: "1 hour"
    impact: "Faster CI runs by caching go module downloads"
recommendations:
  priority_0:
    - "Enable Renovate dependency management (currently disabled) to catch CVEs automatically"
    - "Add code coverage tracking with codecov or coveralls for the unit test suite"
    - "Add container image startup validation for runtime training images in Tekton pipelines"
  priority_1:
    - "Expand golangci-lint to include errcheck, staticcheck, gosec, gocritic, and exhaustive"
    - "Add unit tests for test utility packages outside tests/common/support/"
    - "Add Go module caching and timeout-minutes to all GitHub Actions workflows"
    - "Add FIPS build validation CI step for training runtime images"
  priority_2:
    - "Add HEALTHCHECK instructions to runtime training Dockerfiles"
    - "Add integration test for Dockerfile build correctness (testcontainers or equivalent)"
    - "Create a CI workflow that runs golangci-lint on PRs (currently only go vet runs)"
---

# Quality Analysis: opendatahub-io/distributed-workloads

## Executive Summary
- Overall Score: 5.9/10
- Key Strengths: Excellent agent rules with 3 custom skills and CI-verified sync, comprehensive E2E test suites covering KFTO/Trainer/Ray/FMS, strong Tekton/Konflux integration for image builds, UBI9 base images across all Dockerfiles
- Critical Gaps: No code coverage tracking, unit tests limited to support library only, no container runtime validation for 26+ images, Renovate disabled, minimal Go linting
- Agent Rules Status: Excellent (AGENTS.md + 3 skills + CI verification)

## Quality Scorecard
| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 5/10 | 15% | Unit tests cover only the support library; no coverage tracking |
| Integration/E2E | 8/10 | 20% | Comprehensive E2E suites across 4 test domains with tag-based tiering |
| Build Integration | 6/10 | 15% | Konflux/Tekton PR builds for images, but no runtime validation |
| Image Testing | 5/10 | 10% | 26 Dockerfiles with UBI9 bases, but no runtime or startup validation |
| Coverage Tracking | 1/10 | 10% | No coverage tracking, thresholds, or PR reporting configured |
| CI/CD Automation | 7/10 | 15% | Good workflow coverage with Tekton integration, missing caching and timeouts |
| Static Analysis | 5/10 | 10% | Semgrep and pre-commit hooks present, but minimal Go linters and Renovate disabled |
| Agent Rules | 9/10 | 5% | Excellent AGENTS.md, 3 custom skills, automated sync, CI verification |

## Critical Gaps

1. **No code coverage tracking**
   - Impact: Cannot measure test effectiveness or enforce coverage standards on PRs
   - Severity: HIGH
   - Effort: 4-6 hours
   - Details: The `go-unit-test.yml` workflow runs `go test ./tests/common/support/...` without `--coverprofile`. No `.codecov.yml`, no coverage thresholds, no PR coverage comments.

2. **Unit tests limited to support library**
   - Impact: Test utilities in `tests/kfto/`, `tests/trainer/`, `tests/odh/`, and `tests/fms/` support files have no unit test coverage
   - Severity: HIGH
   - Effort: 8-12 hours
   - Details: 13 unit test files exist in `tests/common/support/` but 16+ support/utility files in other test suites (e.g., `tests/trainer/support.go`, `tests/trainer/utils/*.go`, `tests/kfto/environment.go`) have no corresponding unit tests.

3. **No container image runtime validation**
   - Impact: 26 Dockerfiles are built but never validated for startup, health, or basic functionality
   - Severity: HIGH
   - Effort: 6-8 hours
   - Details: Tekton pipelines build images on PR but do not test whether the resulting containers start correctly. No `HEALTHCHECK` instructions in any Dockerfile. No testcontainers or `docker run` validation.

4. **Renovate dependency management disabled**
   - Impact: No automated dependency update PRs; manual tracking of CVEs across 26+ images and Go modules
   - Severity: MEDIUM
   - Effort: 1-2 hours
   - Details: `renovate.json` exists but contains `{"enabled": false}`. No Dependabot configured either. This is especially impactful given the large number of Python dependency files across training images.

5. **Minimal golangci-lint configuration**
   - Impact: Only 3 linters enabled (govet, unused, ineffassign); many bug classes go undetected
   - Severity: MEDIUM
   - Effort: 2-3 hours
   - Details: `.golangci.yml` enables only the most basic linters. Missing `errcheck` (unchecked errors), `staticcheck` (Go static analysis), `gosec` (security), `gocritic` (code quality), and others.

## Quick Wins

1. **Enable Renovate for automated dependency updates**
   - Effort: 1 hour
   - Impact: Automated CVE detection and dependency update PRs across Go modules and Python packages
   - Implementation:
   ```json
   {
     "extends": ["config:base"],
     "packageRules": [
       {
         "matchUpdateTypes": ["minor", "patch"],
         "automerge": true
       }
     ],
     "gomod": {
       "enabled": true
     },
     "pip_requirements": {
       "enabled": true
     }
   }
   ```

2. **Add --coverprofile to unit test workflow**
   - Effort: 1-2 hours
   - Impact: Visibility into support library test coverage with PR reporting
   - Implementation:
   ```yaml
   # .github/workflows/go-unit-test.yml
   - name: Unit tests
     run: go test -coverprofile=coverage.out ./tests/common/support/...
   - name: Upload coverage
     uses: codecov/codecov-action@v4
     with:
       files: ./coverage.out
       flags: unittests
       fail_ci_if_error: false
   ```

3. **Expand golangci-lint linter set**
   - Effort: 2-3 hours
   - Impact: Catch more bug classes (errcheck, staticcheck, gosec, gocritic)
   - Implementation:
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
       - gosec
       - gocritic
       - misspell
       - revive
   issues:
     max-same-issues: 0
   ```

4. **Add timeout-minutes to all GitHub Actions jobs**
   - Effort: 30 minutes
   - Impact: Prevent hung CI jobs from consuming runner resources
   - Implementation: Add `timeout-minutes: 15` to all jobs in `.github/workflows/`

5. **Add Go module caching to CI workflows**
   - Effort: 1 hour
   - Impact: Faster CI runs by caching Go module downloads
   - Implementation: The `actions/setup-go@v5` action already supports caching via `cache: true` (enabled by default when `go-version-file` is set). Verify it is active in all workflows.

## Detailed Findings

### Unit Tests

**Status: Moderate (5/10)**

**Strengths:**
- 42 test files with a 68% test-to-code ratio (42 test files / 62 source files)
- Tests use Go's built-in `testing` package with Gomega assertions
- Support library has good unit test coverage: `tests/common/support/*_test.go` (13 files)
- Fake client pattern (`NewTest(t)` via `fakeclient.go`) enables testing without cluster access
- PR-triggered via `go-unit-test.yml` on `.go` file changes

**Test Patterns:**
```go
func TestCreateOrGetTestNamespaceCreatingNamespace(t *testing.T) {
    test := NewTest(t)
    namespace := test.CreateOrGetTestNamespace()
    test.Expect(namespace).NotTo(BeNil())
    test.Expect(namespace.GenerateName).To(Equal("test-ns-"))
}
```

**Gaps:**
- Unit tests only run for `./tests/common/support/...` — other test utility packages (`tests/trainer/utils/`, `tests/trainer/sdk_tests/`, etc.) are not covered
- No coverage profiling (`--coverprofile` not used)
- No test-to-code ratio enforcement
- 16+ support/utility Go files outside `tests/common/support/` have zero unit tests

**File Count:**
- Source Go files: 62
- Test Go files: 42
- Support unit tests: 13 files
- Untested utility files: 16+

### Integration/E2E Tests

**Status: Strong (8/10)**

**Strengths:**
- This is the primary purpose of the repository — a dedicated E2E test suite
- 4 well-organized test suites:
  - `tests/kfto/` — KFTO v1 PyTorchJob tests (8 test files)
  - `tests/trainer/` — Kubeflow Trainer v2 tests (12 test files)
  - `tests/odh/` — Ray/KubeRay tests (5 test files)
  - `tests/fms/` — Foundation model fine-tuning tests (4 test files)
- Rich shared infrastructure in `tests/common/support/` (51 files):
  - Client abstractions for 13+ API groups
  - Resource helpers (TrainJob, PyTorchJob, Ray, Kueue)
  - Async getter pattern for `Eventually` polling
  - Namespace isolation with auto-cleanup
- Tag-based test tiering (Smoke, Tier1-3, GPU, MultiNode, MultiGpu)
- Tests compiled and released as binaries for cluster execution
- Real cluster testing against OpenShift with RHOAI components
- Multi-component integration (Kueue, Training Operator, Trainer, KubeRay)

**Test Patterns:**
```go
func TestKubeflowTrainerSmoke(t *testing.T) {
    Tags(t, Smoke)
    test := With(t)
    // ... real cluster assertions
}
```

**Gaps:**
- E2E tests not directly triggered in GitHub Actions (run externally on clusters)
- No contract tests between components
- No chaos engineering tests
- Test execution requires manual cluster setup (logged into OpenShift with RHOAI)

### Build Integration

**Status: Adequate (6/10)**

**Strengths:**
- 35 Tekton/Konflux pipelines (`.tekton/`) for image builds
- 15 PR-triggered Tekton pipelines validate image builds before merge
- Path-scoped triggers — only rebuild changed images:
  ```yaml
  pipelinesascode.tekton.dev/on-cel-expression: >
    event == "pull_request" && target_branch == "stable" &&
    "images/runtime/training/py312-cuda128-torch290/***".pathChanged()
  ```
- Centralized pipeline definition from `odh-konflux-central` repo
- Multi-platform build support via `build-platforms` parameter
- OSU benchmark image builds validated on PR via GitHub Actions
- Makefile targets for Kueue and KFTO cluster setup (`make setup-kueue`, `make setup-kfto`)

**Gaps:**
- No runtime validation after build — images are built but not tested for startup
- No `kubectl apply --dry-run` validation in CI
- No image size tracking or optimization checks
- Tekton PR builds only target `stable` branch, not `main`

### Image Testing

**Status: Moderate (5/10)**

**Strengths:**
- 26 Dockerfiles covering multiple families:
  - Runtime training images (CUDA 12.1-13.0, ROCm 6.1-6.4)
  - Ray images (2.52.1, 2.55.1 with CUDA/ROCm variants)
  - Universal training images (multi-stage builds)
  - Utility images (mc-cli, dataset, model, benchmark)
- All runtime images use UBI9 base images (FIPS-capable):
  ```dockerfile
  FROM registry.access.redhat.com/ubi9/python-${PYTHON_VERSION}:${IMAGE_TAG}
  ```
- Universal training images use multi-stage builds (builder + final)
- Proper labeling with OCI metadata
- License files included in images

**Gaps:**
- No `HEALTHCHECK` instructions in any Dockerfile
- No runtime validation (testcontainers, `docker run` + health check)
- No image size tracking or optimization
- Build platforms limited to `linux/amd64` (no arm64)
- Test image (`images/tests/Dockerfile`) uses `golang:1.25` instead of UBI base
- No vulnerability scanning in PR workflows (Snyk runs separately)

**Base Image Analysis:**
| Family | Base Image | FIPS Capable |
|--------|-----------|--------------|
| Runtime training | `registry.access.redhat.com/ubi9/python-*` | Yes |
| Universal training | Parameterized `BASE_IMAGE` (typically UBI9) | Yes |
| Ray | `registry.access.redhat.com/ubi9/python-*` | Yes |
| Utility | `registry.access.redhat.com/ubi9:latest` | Yes |
| Tests | `golang:1.25` | No |
| Examples (Ray) | `quay.io/modh/ray:*` | Depends on upstream |

### Coverage Tracking

**Status: Critical Gap (1/10)**

**Current State:**
- No `.codecov.yml` or `coveralls.yml` configuration
- No `--coverprofile` flag in unit test workflow
- No coverage thresholds or enforcement
- No PR coverage comments or reporting
- No coverage badge in README

**Impact:**
- Cannot measure how much of the support library is actually tested
- No regression detection when coverage drops
- No visibility into test effectiveness

**Recommendations:**

1. **Add coverage to unit test workflow:**
   ```yaml
   - name: Unit tests with coverage
     run: go test -coverprofile=coverage.out -covermode=atomic ./tests/common/support/...
   - name: Upload coverage
     uses: codecov/codecov-action@v4
     with:
       files: ./coverage.out
       flags: unittests
   ```

2. **Add `.codecov.yml` with thresholds:**
   ```yaml
   coverage:
     status:
       project:
         default:
           target: 60%
           threshold: 2%
       patch:
         default:
           target: 50%
   ```

3. **Add coverage badge to README**

### CI/CD Automation

**Status: Good (7/10)**

**Workflow Inventory:**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `go-unit-test.yml` | PR, push (`.go` changes) | Unit tests for support library |
| `go-vet.yml` | PR, push (`.go` changes) | Go vet static analysis |
| `verify_generated_files.yml` | PR, push (`.go`, `ai/`, `.claude/` changes) | Import ordering + agent config sync |
| `build-and-push-test-images.yml` | Push to main, manual | Build/push E2E test container |
| `build-and-push-osu-benchmark.yml` | PR, push (benchmark changes) | Build OSU benchmark images |
| `odh-release.yml` | Manual dispatch | Compile tests and create GitHub release |
| `sync-main-to-stable.yml` | Scheduled (every 4h), manual | Cherry-pick main→stable with lake-gate |
| `universal-image-lockfile-refresh.yaml` | Scheduled (daily), manual | Refresh Python lockfiles |
| `notify-autofix-prs.yml` | PR open, scheduled (weekdays 9am) | Slack notifications for jira-autofix PRs |
| `snyk-dockerfile-scan.yml` | (various) | Snyk Dockerfile scanning |

**Strengths:**
- PR-triggered workflows for unit tests, vet, import verification, and agent config sync
- 35 Tekton/Konflux pipelines for image builds (15 PR-triggered)
- Scheduled workflows for lockfile refresh and main→stable sync
- Mergify auto-approve and fast-forward merge for lake-gate PRs
- Agent config sync CI enforcement (`verify-agents-config`)
- Concurrency control in lockfile refresh workflow

**Gaps:**
- No `timeout-minutes` on any GitHub Actions jobs
- No Go module caching configured (setup-go may auto-cache, but not explicit)
- No matrix strategy for testing across Go versions
- No concurrency control on most workflows (only lockfile refresh has it)
- golangci-lint not run as a CI workflow (only `go vet` runs)
- E2E tests not triggered from GitHub Actions (run externally)

### Static Analysis

**Status: Moderate (5/10)**

#### Linting

**golangci-lint configuration (`.golangci.yml`):**
```yaml
version: "2"
run:
  allow-parallel-runners: true
linters:
  default: none
  enable:
    - govet
    - unused
    - ineffassign
issues:
  max-same-issues: 0
```

Only 3 linters enabled — this is minimal. Missing critical linters:
- `errcheck` — unchecked error returns
- `staticcheck` — comprehensive Go static analysis
- `gosec` — security-focused analysis
- `gocritic` — code quality and idiom checks
- `misspell` — spelling in comments and strings
- `revive` — extensible linter (successor to golint)

**Note:** golangci-lint is available via Makefile (`make golangci-lint`) but is NOT configured as a GitHub Actions CI workflow. Only `go vet` runs on PRs.

#### Pre-commit Hooks

**Configuration (`.pre-commit-config.yaml`):**
- `check-yaml` (with multiple documents)
- `check-json`
- `end-of-file-fixer`
- `trailing-whitespace`
- `pretty-format-json`
- `isort` (Python import sorting)
- `black` (Python formatting)
- `flake8` (Python linting)

Good Python-focused pre-commit setup. Missing Go-specific hooks.

#### Semgrep

**Comprehensive security rules (`semgrep.yaml`, 64KB):**
- Generic secrets detection (hardcoded credentials, AWS keys)
- Go-specific rules (Kubernetes controllers/operators)
- Python-specific rules (ML/Data Science)
- TypeScript/JavaScript rules
- YAML rules (Kubernetes manifests, GitHub Actions)
- This is a strong security analysis foundation

#### FIPS Compatibility

**Status: Good baseline, no active validation**

- All runtime images use UBI9 base images (FIPS-capable) — this is the correct foundation
- No non-FIPS crypto imports detected in Go source code
- No FIPS build tags (`-tags=fips`, `GOEXPERIMENT=boringcrypto`) — but this repo is primarily tests, not production binaries
- Test image uses `golang:1.25` (not UBI) — acceptable for test-only image

#### Dependency Alerts

**Renovate:** Present but **disabled** (`{"enabled": false}`)
**Dependabot:** Not configured
**Snyk:** Configured (`.snyk`) but excludes `examples/` and `tests/`
**Gitleaks:** Configured with comprehensive allowlists

**Impact:** With 26+ images containing Python dependencies and a Go module with 30+ dependencies, manual dependency tracking is a significant maintenance burden.

### Agent Rules

**Status: Excellent (9/10)**

**Strengths:**
- `AGENTS.md` with comprehensive project documentation:
  - Repository structure and test suites
  - Running tests with examples
  - Lint/format commands (project-wide and targeted)
  - Writing tests guide (links to skill)
  - CVE fix workflow for Python dependencies
  - Common workflows based on commit history
- `CLAUDE.md` → symlink to `AGENTS.md` (ensures consistency)
- `.claude/` directory with:
  - `settings.json` — PostToolUse hook for Go import formatting
  - 3 custom skills:
    - `add-e2e-test` — detailed guide for writing E2E tests (namespace isolation, resource naming, cleanup, tags, notebooks)
    - `add-benchmark` — guide for adding MPI/GPU benchmarks (Dockerfile, ClusterTrainingRuntime, TrainJob, CI)
    - `update-support-lib` — guide for modifying shared test infrastructure (patterns, file map, conventions)
- Canonical skill source in `ai/skills/` with sync to `.claude/` and `.cursor/`
- `make sync-agents-config` and `make verify-agents-config` automation
- CI enforcement via `verify_generated_files.yml` — PRs fail if agent config is out of sync
- `ARCHITECTURE.md` with detailed test suite documentation

**Minor Gaps:**
- No `.claude/rules/` directory (using skills instead, which is fine)
- Skills don't include code examples for every pattern (but reference existing code)

**This is a gold-standard implementation of agent rules.** The canonical source pattern (`ai/skills/` → `.claude/` + `.cursor/`), CI verification, and detailed skills are exemplary.

## Recommendations

### Priority 0 (Critical)
- Enable Renovate dependency management (change `{"enabled": false}` to proper config) to catch CVEs automatically across 26+ images
- Add code coverage tracking with codecov for the unit test suite (`--coverprofile` in `go-unit-test.yml`)
- Add container image startup validation for runtime training images in Tekton pipelines or a dedicated CI workflow

### Priority 1 (High Value)
- Expand golangci-lint configuration to include `errcheck`, `staticcheck`, `gosec`, `gocritic`, `misspell`, and `revive`
- Add a golangci-lint CI workflow (currently only `go vet` runs on PRs)
- Add unit tests for test utility packages outside `tests/common/support/` (e.g., `tests/trainer/utils/`, `tests/trainer/sdk_tests/`)
- Add `timeout-minutes` and explicit caching to all GitHub Actions workflows
- Add concurrency control to prevent duplicate CI runs on rapid pushes
- Add FIPS build validation CI step for training runtime images (verify UBI base, check for non-FIPS crypto in dependencies)

### Priority 2 (Nice-to-Have)
- Add `HEALTHCHECK` instructions to runtime training Dockerfiles
- Add integration test for Dockerfile build correctness (testcontainers or container structure tests)
- Add coverage badge to README
- Track image sizes in CI to detect bloat
- Add matrix strategy to test against multiple Go versions
- Consider enabling Snyk for `tests/` directory (currently excluded)

## Comparison to Gold Standards

| Dimension | distributed-workloads | odh-dashboard | notebooks | Gap |
|-----------|----------------------|---------------|-----------|-----|
| Unit Tests | 5/10 | 9/10 | 8/10 | -4 (Add coverage, expand scope) |
| Integration/E2E | 8/10 | 10/10 | 7/10 | -2 (Add CI-triggered E2E) |
| Build Integration | 6/10 | 9/10 | 8/10 | -3 (Add runtime validation) |
| Image Testing | 5/10 | 7/10 | 10/10 | -5 (Add runtime validation, HEALTHCHECK) |
| Coverage Tracking | 1/10 | 9/10 | 8/10 | -8 (Add codecov integration) |
| CI/CD Automation | 7/10 | 9/10 | 8/10 | -2 (Add caching, timeouts, lint CI) |
| Static Analysis | 5/10 | 9/10 | 8/10 | -4 (Enable Renovate, expand linters) |
| Agent Rules | 9/10 | 8/10 | 6/10 | +1 (Gold standard for this dimension) |

**Key Takeaways:**
- **Biggest gap:** Coverage Tracking (1/10 vs 9/10 in odh-dashboard) — zero coverage infrastructure
- **Second gap:** Image Testing (5/10 vs 10/10 in notebooks) — many images but no runtime validation
- **Third gap:** Unit Tests (5/10 vs 9/10 in odh-dashboard) — tests exist but limited scope
- **Standout strength:** Agent Rules (9/10) — exceeds gold standards with skills, CI sync, and multi-agent support

## File Paths Reference

### CI/CD
- `.github/workflows/go-unit-test.yml` — Unit test workflow
- `.github/workflows/go-vet.yml` — Go vet workflow
- `.github/workflows/verify_generated_files.yml` — Import and agent config verification
- `.github/workflows/build-and-push-test-images.yml` — Test image build
- `.github/workflows/build-and-push-osu-benchmark.yml` — OSU benchmark image build
- `.github/workflows/odh-release.yml` — Release workflow
- `.github/workflows/sync-main-to-stable.yml` — Main→stable sync
- `.github/workflows/universal-image-lockfile-refresh.yaml` — Python lockfile refresh
- `.github/workflows/notify-autofix-prs.yml` — Autofix PR notifications
- `.tekton/` — 35 Tekton/Konflux pipeline files (15 PR-triggered, 20 push-triggered)
- `Makefile` — Build and test targets

### Testing
- `tests/common/support/*_test.go` — Unit tests (13 files)
- `tests/common/support/*.go` — Shared test infrastructure (51 files)
- `tests/kfto/*.go` — KFTO v1 E2E tests
- `tests/trainer/*.go` — Trainer v2 E2E tests
- `tests/odh/*.go` — Ray/KubeRay E2E tests
- `tests/fms/*.go` — Foundation model fine-tuning tests

### Images
- `images/runtime/training/` — Runtime training images (CUDA, ROCm variants)
- `images/universal/training/` — Universal training images (multi-stage builds)
- `images/runtime/ray/` — Ray images (CUDA, ROCm variants)
- `images/tests/Dockerfile` — E2E test container image
- `images/util/mc-cli/Dockerfile` — MinIO client utility image
- `images/model/bloom560m/Dockerfile` — Model image
- `images/dataset/alpaca/Dockerfile` — Dataset image

### Static Analysis
- `.golangci.yml` — golangci-lint configuration (minimal)
- `.pre-commit-config.yaml` — Pre-commit hooks (Python-focused)
- `semgrep.yaml` — Comprehensive security rules (64KB)
- `.gitleaks.toml` — Secret detection configuration
- `.snyk` — Snyk policy file
- `renovate.json` — Renovate configuration (**disabled**)

### Agent Rules
- `AGENTS.md` — Comprehensive project documentation (CLAUDE.md symlinks here)
- `ARCHITECTURE.md` — Test suite architecture documentation
- `.claude/settings.json` — Claude Code hooks (Go import formatting)
- `.claude/skills/add-e2e-test/SKILL.md` — E2E test writing guide
- `.claude/skills/add-benchmark/SKILL.md` — Benchmark addition guide
- `.claude/skills/update-support-lib/SKILL.md` — Support library modification guide
- `ai/skills/` — Canonical skill source (synced to `.claude/` and `.cursor/`)
- `hack/sync-agents-config.sh` — Sync script
- `hack/verify-agents-config.sh` — Verification script
