---
repository: "red-hat-data-services/rhaii-cluster-validation"
overall_score: 5.9
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "88 test functions across 19 test files with table-driven patterns; some packages missing coverage"
  - dimension: "Integration/E2E"
    score: 6.0
    status: "Binary and container-level E2E in CI; no cluster-based testing (hardware dependency)"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-time image builds for both containers; Konflux configs with hermetic RPM lockfiles"
  - dimension: "Image Testing"
    score: 6.0
    status: "Multi-stage UBI9 builds with SHA pinning; container E2E validates JSON output; no multi-arch"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling — no coverprofile, no codecov, no thresholds"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "3 workflows on PR with pinned actions and -race flag; missing caching and concurrency control"
  - dimension: "Static Analysis"
    score: 5.0
    status: "golangci-lint in CI with strong FIPS compliance; minimal linter config and no dependency alerts"
  - dimension: "Agent Rules"
    score: 6.0
    status: "Comprehensive CLAUDE.md with architecture docs; no .claude/rules/ or test creation guidance"
critical_gaps:
  - title: "Zero coverage tracking"
    impact: "No visibility into test coverage — regressions in untested code go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No dependency alert automation"
    impact: "Vulnerable or outdated dependencies (Go modules, RPMs) not surfaced automatically"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "Minimal golangci-lint configuration"
    impact: "Only errcheck disabled — not leveraging available linters for code quality enforcement"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No multi-architecture container support"
    impact: "Images only built for linux/amd64; blocks ARM64 cluster validation deployments"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add --coverprofile to CI test step and integrate Codecov"
    effort: "2-3 hours"
    impact: "Immediate visibility into coverage gaps; PR-level coverage reporting"
  - title: "Enable Dependabot for Go modules"
    effort: "30 minutes"
    impact: "Automated dependency update PRs with security advisory integration"
  - title: "Add concurrency control to CI workflows"
    effort: "30 minutes"
    impact: "Cancel stale PR runs, reduce CI queue congestion"
  - title: "Enable more golangci-lint linters"
    effort: "1-2 hours"
    impact: "Catch unused code, shadowed variables, inefficient patterns"
recommendations:
  priority_0:
    - "Add coverage tracking: --coverprofile in CI, Codecov integration, initial threshold (e.g., 40%)"
    - "Enable Dependabot for gomod ecosystem with weekly schedule"
  priority_1:
    - "Expand golangci-lint config with govet, staticcheck, unused, gosimple, ineffassign, misspell"
    - "Add t.Parallel() to table-driven subtests for faster test execution"
    - "Add unit tests for untested packages: operator, topology, tcplat_job, rdmawep_job"
    - "Add concurrency control and timeout-minutes to all CI workflows"
  priority_2:
    - "Add .claude/rules/ with test creation patterns for Go table-driven tests"
    - "Add multi-arch container builds (buildx with linux/amd64,linux/arm64)"
    - "Add pre-commit hooks for gofmt and go mod tidy"
    - "Consider adding Go build caching in CI workflows"
---

# Quality Analysis: rhaii-cluster-validation

## Executive Summary

- **Overall Score: 5.9/10**
- **Repository**: [red-hat-data-services/rhaii-cluster-validation](https://github.com/red-hat-data-services/rhaii-cluster-validation)
- **Type**: kubectl plugin (CLI tool) for GPU/RDMA cluster validation
- **Language**: Go 1.25 with Kubernetes client-go and cobra
- **Jira**: INFERENG / llm-d (downstream tier)
- **Key Strengths**: Solid unit test suite with table-driven patterns, strong FIPS compliance (GOEXPERIMENT=strictfipsruntime, UBI9 base images, no non-FIPS crypto), PR-time image builds for both container images, comprehensive CLAUDE.md
- **Critical Gaps**: Zero coverage tracking, no dependency alerts (Dependabot/Renovate), minimal golangci-lint configuration
- **Agent Rules Status**: CLAUDE.md present and comprehensive; no .claude/rules/ directory

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 7.0/10 | 15% | 1.05 | 88 test functions, table-driven, some packages uncovered |
| Integration/E2E | 6.0/10 | 20% | 1.20 | Binary + container E2E in CI; no cluster E2E |
| Build Integration | 8.0/10 | 15% | 1.20 | PR image builds, Konflux hermetic builds |
| Image Testing | 6.0/10 | 10% | 0.60 | Multi-stage UBI9, container E2E, no multi-arch |
| Coverage Tracking | 0.0/10 | 10% | 0.00 | Completely absent |
| CI/CD Automation | 7.0/10 | 15% | 1.05 | 3 workflows, pinned actions, -race, no caching |
| Static Analysis | 5.0/10 | 10% | 0.50 | Lint in CI, FIPS-clean, minimal config |
| Agent Rules | 6.0/10 | 5% | 0.30 | Excellent CLAUDE.md, no .claude/rules/ |
| **Overall** | **5.9/10** | | **5.90** | |

## Critical Gaps

### 1. Zero Coverage Tracking
- **Severity**: HIGH
- **Impact**: No visibility into test coverage. Regressions in untested code paths go undetected. Cannot enforce coverage thresholds on PRs.
- **Evidence**: No `--coverprofile` in CI (`go test ./... -count=1 -race`), no `.codecov.yml`, no coverage reporting in any workflow.
- **Effort**: 2-4 hours
- **Fix**: Add `--coverprofile=coverage.out` to test command, integrate Codecov GitHub Action, set initial threshold at 40%.

### 2. No Dependency Alert Automation
- **Severity**: HIGH
- **Impact**: Go module vulnerabilities and outdated dependencies are not surfaced automatically. RPM lockfiles are manually regenerated.
- **Evidence**: No `.github/dependabot.yml`, no `renovate.json` or `.renovaterc`.
- **Effort**: 1-2 hours
- **Fix**: Add `.github/dependabot.yml` covering `gomod` ecosystem.

### 3. Minimal golangci-lint Configuration
- **Severity**: MEDIUM
- **Impact**: The `.golangci.yml` only disables `errcheck` — all other linter selection relies on golangci-lint defaults. Missing linters like `unused`, `gosimple`, `misspell`, `ineffassign` that catch real bugs.
- **Evidence**: `.golangci.yml` is 4 lines; only disables errcheck.
- **Effort**: 2-3 hours

### 4. No Multi-Architecture Container Support
- **Severity**: MEDIUM
- **Impact**: Images only built for `linux/amd64` (Makefile: `TARGET_PLATFORM ?= linux/amd64`). Cannot validate clusters running on ARM64 nodes.
- **Effort**: 4-6 hours

## Quick Wins

### 1. Add Coverage Tracking (2-3 hours)
Add `--coverprofile` to CI and integrate Codecov:

```yaml
# In .github/workflows/ci.yaml, test job:
- name: Test
  run: go test ./... -count=1 -race -coverprofile=coverage.out
- name: Upload coverage
  uses: codecov/codecov-action@v5
  with:
    files: coverage.out
```

Create `.codecov.yml`:
```yaml
coverage:
  status:
    project:
      default:
        target: 40%
    patch:
      default:
        target: 60%
```

### 2. Enable Dependabot (30 minutes)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "gomod"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 3. Add Concurrency Control (30 minutes)
Add to each workflow:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

### 4. Enable More Linters (1-2 hours)
Expand `.golangci.yml`:
```yaml
version: "2"
linters:
  disable:
    - errcheck
  enable:
    - govet
    - staticcheck
    - unused
    - gosimple
    - ineffassign
    - misspell
    - gocritic
    - revive
```

## Detailed Findings

### Unit Tests

**Score: 7.0/10**

| Metric | Value |
|--------|-------|
| Test files | 19 |
| Test functions | 88 |
| Test lines | 3,427 |
| Source lines | 8,379 |
| Test-to-code ratio | 0.41 |
| Testing framework | Go stdlib `testing` |

**Strengths:**
- Consistent table-driven test pattern with `t.Run()` subtests (30+ subtests found)
- Good edge case coverage (empty input, malformed data, error paths)
- Tests cover critical parsing logic: driver output, ECC, RDMA devices, iperf3 bandwidth, ping mesh results, JSON report parsing
- Controller tests verify complex logic: rail/xrail classification, bandwidth pairing, retry semantics
- `-race` flag enabled in CI (detects data races)
- `-count=1` prevents test caching (ensures fresh runs)

**Gaps:**
- No `t.Parallel()` calls — tests run sequentially within each package
- Untested packages:
  - `pkg/checks/operator/operator.go` — no `operator_test.go`
  - `pkg/checks/rdma/topology.go` — no `topology_test.go`
  - `pkg/checks/networking/tcplat_job.go` — no `tcplat_job_test.go`
  - `pkg/checks/rdma/rdmawep_job.go` — no `rdmawep_job_test.go`
  - `pkg/checks/gpu/amd_driver.go`, `amd_ecc.go` — no AMD-specific tests
- No test helpers or fixtures package (each test file defines its own helpers)
- No mocking framework used (tests rely on string parsing, not interface mocks)

**Key Test Files:**
- `pkg/controller/controller_test.go` (506 lines) — most comprehensive, tests report parsing, ping mesh classification, bandwidth pairing
- `pkg/checks/gpu/driver_test.go` (117 lines) — version comparison, nvidia-smi output parsing
- `pkg/checks/rdma/rdmabw_job_test.go` — RDMA bandwidth parsing with real-world output samples
- `pkg/jobrunner/job_test.go` — job spec generation, resource parsing

### Integration/E2E Tests

**Score: 6.0/10**

**E2E Workflow (`.github/workflows/e2e.yaml`):**
- Builds binary and runs agent locally (`./bin/rhaii-validator run --node-name ci-runner`)
- Expects exit code 1 (no GPU/RDMA on CI runner — checks FAIL, but no panics)
- Validates stdout is valid JSON with expected structure (node, results, valid statuses)
- Builds container image and runs same test inside container
- Good pattern: tests "no runtime errors" even when checks fail

**Image Build Workflow (`.github/workflows/image-build.yaml`):**
- Builds BOTH images (validator + tools) on PRs
- Runs unit tests + E2E after build
- Checks for panics/runtime errors in stderr (`grep -qiE '(panic:|runtime error:)'`)

**What's Missing:**
- No cluster-based E2E (understandable — requires GPU hardware)
- No multi-version K8s testing (no matrix strategy)
- No Kind/Minikube test environment
- No contract tests for K8s API interactions
- `test/README.md` describes manual cluster testing procedures but these aren't automated

**Mitigating Factor:** The tool's core value requires physical GPU/RDMA hardware, making full E2E automation extremely difficult. The binary/container-level E2E is a reasonable compromise.

### Build Integration

**Score: 8.0/10**

**PR-Time Builds:**
- CI workflow: `make build` (Go binary)
- E2E workflow: `make build` + `docker build -f Dockerfile.dev` (container image)
- Image-build workflow: builds BOTH container images (validator + tools)
- `go mod tidy` + `git diff --exit-code` (dependency hygiene check)

**Konflux Integration:**
- 3 Konflux Dockerfiles: `Dockerfile.konflux`, `Dockerfile.konflux.cluster-validation`, `Dockerfile.konflux.validator.tools`
- SHA-pinned base images in all Konflux files
- RPM lockfile system (`rpms.in.yaml` + `rpms.lock.yaml`) for hermetic builds
- 3 lockfile sets covering both images (root, tools runtime, tools builder)
- MintMaker integration for automatic lockfile refresh on release branches

**Build Configuration:**
- Multi-stage builds (builder + runtime) in all Dockerfiles
- `GOEXPERIMENT=strictfipsruntime` in all container builds
- `CGO_ENABLED=1` for FIPS runtime support
- Version injection via `-ldflags`
- Proper `--chown` for build context in dev Dockerfile

**Gaps:**
- No Kustomize/manifest validation (acceptable — CLI tool, not operator)
- No Konflux build simulation in CI (Konflux builds only run post-merge)

### Image Testing

**Score: 6.0/10**

**Dockerfile Quality:**
- Multi-stage builds across all variants (builder stage compiles, runtime stage minimal)
- UBI9 base images throughout (FIPS-capable, Red Hat supported)
- SHA-pinned base images in Konflux Dockerfiles (supply chain security)
- Tag-based base images in dev Dockerfiles (acceptable for dev)
- Proper OCI labels in all images
- Tools image: complex multi-stage with CUDA builder + UBI9 runtime (only copies libcudart, not full CUDA)

**Container E2E:**
- Image built and tested in CI (agent runs inside container, validates JSON output)
- Both validator and tools images built on PRs

**Gaps:**
- No multi-architecture support: `TARGET_PLATFORM ?= linux/amd64`, no `docker buildx`, no `--platform` in CI
- No `HEALTHCHECK` instructions in any Dockerfile
- No Testcontainers for runtime validation
- No container image scanning in CI (handled by org-level tooling — out of scope)
- Tools image runs as root (documented as required for RDMA device access)

### Coverage Tracking

**Score: 0.0/10**

**Complete absence of coverage infrastructure:**
- CI runs `go test ./... -count=1 -race` — no `--coverprofile`
- No `.codecov.yml` or `codecov.yml`
- No `coveralls.yml` or `.coveragerc`
- No coverage thresholds defined anywhere
- No PR coverage comments or gates
- Makefile `test` target: `go test ./... -v` — no coverage flag

This is the single most impactful gap. Given the existing 88 test functions across 3,427 lines of test code, the team has invested significantly in testing but has zero visibility into what percentage of the codebase is actually covered.

### CI/CD Automation

**Score: 7.0/10**

**Workflow Inventory:**

| Workflow | Triggers | Jobs |
|----------|----------|------|
| CI (`ci.yaml`) | push:main, PR:main | build, test, lint (parallel) |
| E2E (`e2e.yaml`) | push:main, PR:main | e2e-local (binary + container) |
| Image Build (`image-build.yaml`) | push:main, PR:main | build-and-test (unit + E2E + both images) |

**Strengths:**
- All workflows trigger on both push and PR (consistent gate enforcement)
- Separate parallel jobs in CI (build, test, lint run independently)
- SHA-pinned GitHub Actions (e.g., `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683`)
- Go version from `go.mod` (auto-tracks Go version)
- `-race` flag for data race detection
- `-count=1` to prevent test caching
- golangci-lint-action v8 with pinned version

**Gaps:**
- No `concurrency:` stanza — stale PR runs don't cancel
- No `timeout-minutes:` on any job — hung jobs run indefinitely
- No Go module caching (`actions/cache` or `go-version-file` cache)
- No test matrix strategy (single Go version, single OS)
- No scheduled/periodic workflows
- Image-build workflow duplicates test + E2E from the other two workflows (some redundancy)

### Static Analysis

**Score: 5.0/10**

**Linting:**
- golangci-lint v2.11.3 in CI via `golangci/golangci-lint-action@v8`
- `.golangci.yml` exists but minimal:
  ```yaml
  version: "2"
  linters:
    disable:
      - errcheck
  ```
- Relies entirely on golangci-lint defaults; no explicitly enabled linters beyond defaults
- `go fmt` target in Makefile but not enforced in CI (should be — `go mod tidy` is verified but not `gofmt -l`)

**FIPS Compatibility:**
- **FIPS build**: `GOEXPERIMENT=strictfipsruntime` in all Dockerfile builds
- **CGO**: `CGO_ENABLED=1` with UBI9 go-toolset (BoringCrypto linkage)
- **Source scan**: No non-FIPS crypto imports found (no `crypto/md5`, `crypto/des`, `crypto/rc4`, `math/rand`)
- **Base images**: All UBI9-based (FIPS-capable)
- **Local builds**: Makefile uses `CGO_ENABLED=0` (disables FIPS for local dev — acceptable tradeoff, documented)

**Dependency Alerts:**
- No `.github/dependabot.yml`
- No Renovate configuration
- RPM lockfile refresh is manual on `main` (automated via MintMaker on release branches only)

**Pre-commit Hooks:**
- No `.pre-commit-config.yaml`
- No git hooks configured

### Agent Rules

**Score: 6.0/10**

**CLAUDE.md (Comprehensive):**
- Project overview with binary/plugin naming
- All build/test commands with examples
- Architecture documentation:
  - Two execution modes (controller vs agent)
  - Key interfaces (`checks.Check`, `jobrunner.Job`)
  - Controller execution flow (10 steps)
  - Container image details and override mechanisms
  - Platform config system
  - Report storage and merging
- CLI subcommands with flags
- RPM lockfile management guide
- Coding conventions (11 rules)
- Known limitations

**What's Missing:**
- No `.claude/` directory
- No `.claude/rules/` with test creation rules
- No test pattern guidance for AI agents (e.g., "use table-driven tests with t.Run", "mock external commands by...")
- No `AGENTS.md`
- Test creation guidance would be especially valuable given the repo's unique testing patterns (parsing GPU/RDMA output, testing without hardware)

## Recommendations

### Priority 0 (Critical)

1. **Add coverage tracking** (2-4 hours)
   - Add `--coverprofile=coverage.out` to CI test step
   - Integrate Codecov with `.codecov.yml` (target: 40% project, 60% patch)
   - Enforce coverage threshold on PRs

2. **Enable Dependabot** (30 minutes)
   - Add `.github/dependabot.yml` for `gomod` and `github-actions` ecosystems
   - Weekly schedule with auto-merge for patch updates

### Priority 1 (High Value)

3. **Expand golangci-lint configuration** (2-3 hours)
   - Enable: `govet`, `staticcheck`, `unused`, `gosimple`, `ineffassign`, `misspell`, `gocritic`, `revive`
   - Suppress only with targeted `//nolint:` comments

4. **Add concurrency control and timeouts to CI** (30 minutes)
   - `concurrency: group + cancel-in-progress` on all workflows
   - `timeout-minutes: 15` on all jobs

5. **Add unit tests for uncovered packages** (4-6 hours)
   - `pkg/checks/operator/operator.go`
   - `pkg/checks/rdma/topology.go`
   - `pkg/checks/networking/tcplat_job.go`
   - `pkg/checks/rdma/rdmawep_job.go`
   - `pkg/checks/gpu/amd_driver.go`, `amd_ecc.go`

6. **Add `t.Parallel()`** to table-driven subtests (1-2 hours)

### Priority 2 (Nice-to-Have)

7. **Create `.claude/rules/` test creation rules** (2-3 hours)
   - Go table-driven test patterns
   - How to test command output parsers (nvidia-smi, ibstat, iperf3)
   - How to test without GPU/RDMA hardware
   - Naming conventions and test structure

8. **Add multi-architecture container builds** (4-6 hours)
   - `docker buildx create` + `--platform linux/amd64,linux/arm64`
   - Update Makefile and CI workflows

9. **Add pre-commit hooks** (1-2 hours)
   - `gofmt`, `go mod tidy`, `golangci-lint` (fast mode)

10. **Add Go module caching to CI** (30 minutes)
    - `actions/setup-go` already supports caching — enable it

## Comparison to Gold Standards

| Practice | rhaii-cluster-validation | odh-dashboard (gold) | notebooks (gold) | kserve (gold) |
|----------|------------------------|---------------------|-------------------|---------------|
| Unit test ratio | 0.41 (19/29 files) | 0.8+ | 0.5+ | 0.7+ |
| E2E automated | Binary/container only | Full UI E2E | Multi-layer | Multi-version K8s |
| Coverage tracking | None | Codecov enforced | Codecov | Codecov with gates |
| FIPS compliance | Excellent | Good | Good | Good |
| Dependency alerts | None | Dependabot | Dependabot | Dependabot |
| Lint config | Minimal | Comprehensive | Good | Comprehensive |
| PR image builds | Both images | Yes | Yes | Yes |
| Multi-arch | No | No | Yes (5-layer) | No |
| Agent rules | CLAUDE.md only | CLAUDE.md + rules | Limited | Limited |
| Pre-commit hooks | None | Yes | Yes | Yes |
| Concurrency control | None | Yes | Yes | Yes |

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yaml` — Build, test, lint
- `.github/workflows/e2e.yaml` — Binary and container E2E
- `.github/workflows/image-build.yaml` — Both image builds + E2E

### Testing
- `pkg/checks/gpu/driver_test.go` — GPU driver parsing tests
- `pkg/checks/gpu/ecc_test.go` — ECC error parsing tests
- `pkg/checks/rdma/devices_test.go` — RDMA device detection tests
- `pkg/checks/rdma/rdmabw_job_test.go` — RDMA bandwidth parsing tests
- `pkg/checks/rdma/pingmesh_job_test.go` — Ping mesh job tests
- `pkg/checks/networking/bandwidth_test.go` — Bandwidth threshold tests
- `pkg/checks/networking/iperf_job_test.go` — iperf3 output parsing tests
- `pkg/controller/controller_test.go` — Report parsing, ping mesh classification
- `pkg/jobrunner/job_test.go` — Job spec generation tests
- `pkg/config/loader_test.go` — Config loading tests
- `test/README.md` — Manual testing guide

### Build
- `Dockerfile.dev` — Development validator image
- `Dockerfile.konflux` — Konflux validator image (SHA-pinned)
- `Dockerfile.konflux.cluster-validation` — Konflux cluster-validation image
- `Dockerfile.konflux.validator.tools` — Konflux tools image
- `tools/Dockerfile.dev` — Development tools image
- `tools/Dockerfile.konflux` — Konflux tools image
- `Makefile` — Build, test, lint, container targets

### Configuration
- `.golangci.yml` — Linter configuration (minimal)
- `go.mod` — Go module definition (Go 1.25)
- `rpms.in.yaml` — RPM package list for hermetic builds
- `rpms.lock.yaml` — RPM lockfile
- `CLAUDE.md` — Agent rules / developer documentation

### Missing (Recommended)
- `.github/dependabot.yml` — Dependency alerts
- `.codecov.yml` — Coverage tracking
- `.pre-commit-config.yaml` — Pre-commit hooks
- `.claude/rules/` — Test creation rules for AI agents
