---
repository: "opendatahub-io/rhaii-cluster-validation"
overall_score: 6.1
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Strong table-driven tests, 40% test-to-code ratio, missing coverage generation"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "Binary + container E2E in CI with JSON validation and panic detection"
  - dimension: "Build Integration"
    score: 6.0
    status: "Tekton/Konflux multi-arch builds, PR Tekton build is comment-triggered only"
  - dimension: "Image Testing"
    score: 6.0
    status: "Container build and runtime validation in CI, no vulnerability scanning or SBOM"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "No coverage generation, no codecov integration, no coverage thresholds"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "3 GitHub Actions + 4 Tekton pipelines, pinned SHAs, missing caching and concurrency"
  - dimension: "Agent Rules"
    score: 4.0
    status: "Excellent CLAUDE.md documentation, no .claude/rules/ for test automation guidance"
critical_gaps:
  - title: "No test coverage tracking"
    impact: "Cannot measure or enforce coverage, regressions go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container vulnerability scanning"
    impact: "CVEs in base images or dependencies not detected before release"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No security scanning (SAST/dependency)"
    impact: "Code-level and supply chain vulnerabilities not caught"
    severity: "HIGH"
    effort: "3-4 hours"
  - title: "Several packages lack unit test files"
    impact: "topology.go (664 lines), operator.go, rdmawep_job.go, amd_*.go have no tests"
    severity: "MEDIUM"
    effort: "8-16 hours"
quick_wins:
  - title: "Add go test -coverprofile to CI and integrate codecov"
    effort: "2-3 hours"
    impact: "Enables coverage tracking, PR coverage diffs, and threshold enforcement"
  - title: "Add Trivy container scanning to image-build workflow"
    effort: "1-2 hours"
    impact: "Early detection of CVEs in UBI9 base images and dependencies"
  - title: "Add concurrency control to GitHub Actions workflows"
    effort: "30 minutes"
    impact: "Prevents duplicate CI runs on rapid push sequences"
  - title: "Generate agent rules with /test-rules-generator"
    effort: "1-2 hours"
    impact: "AI-generated tests follow project patterns consistently"
recommendations:
  priority_0:
    - "Add coverage generation (go test -coverprofile) and codecov integration with 60% threshold"
    - "Add Trivy scanning for container images in GitHub Actions and Tekton pipelines"
    - "Enable GitHub CodeQL or gosec for Go SAST scanning"
  priority_1:
    - "Write unit tests for untested packages: topology.go, operator.go, rdmawep_job.go, amd_*.go"
    - "Add concurrency control and Go build caching to GitHub Actions workflows"
    - "Create .claude/rules/ with test creation guidelines for unit and E2E tests"
    - "Make Tekton PR builds automatic instead of comment-triggered"
  priority_2:
    - "Add pre-commit hooks for linting and formatting"
    - "Add SBOM generation to Konflux pipeline"
    - "Expand golangci-lint config to enable more linters (errcheck, govet, staticcheck, etc.)"
    - "Add dependency scanning (Dependabot or Renovate)"
---

# Quality Analysis: rhaii-cluster-validation

## Executive Summary

- **Overall Score: 6.1/10**
- **Repository Type**: Go kubectl plugin for GPU/RDMA cluster validation
- **Primary Language**: Go 1.25 (~8,333 lines source, ~3,362 lines test)
- **Framework**: Kubernetes client-go, Cobra CLI
- **Key Strengths**: Well-structured table-driven tests, thorough E2E testing (binary + container) with JSON validation and panic detection, multi-arch Tekton/Konflux build pipeline, excellent developer documentation (CLAUDE.md)
- **Critical Gaps**: No test coverage tracking, no container vulnerability scanning, no SAST/security scanning, several significant source files (~1,200+ lines) without tests
- **Agent Rules Status**: Partial - has excellent CLAUDE.md but no `.claude/rules/` directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7/10 | Strong table-driven tests, 40% test-to-code ratio, missing coverage generation |
| Integration/E2E | 7/10 | Binary + container E2E in CI with JSON validation and panic detection |
| **Build Integration** | **6/10** | **Tekton/Konflux multi-arch builds, PR Tekton build is comment-triggered only** |
| Image Testing | 6/10 | Container build and runtime validation in CI, no vulnerability scanning or SBOM |
| Coverage Tracking | 2/10 | No coverage generation, no codecov integration, no coverage thresholds |
| CI/CD Automation | 7/10 | 3 GitHub Actions + 4 Tekton pipelines, pinned SHAs, missing caching and concurrency |
| Agent Rules | 4/10 | Excellent CLAUDE.md documentation, no .claude/rules/ for test automation guidance |

## Critical Gaps

### 1. No Test Coverage Tracking
- **Impact**: Cannot measure coverage, enforce thresholds, or detect coverage regressions across PRs
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: `go test` runs with `-race` but no `-coverprofile`. No codecov/coveralls integration. No coverage gating on PRs.

### 2. No Container Vulnerability Scanning
- **Impact**: CVEs in UBI9 base images, CUDA images, and Go dependencies not detected before release
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: Two container images (validator + tools) built from UBI9 and NVIDIA CUDA bases without any scanning step. No Trivy, Snyk, or Grype integration in GitHub Actions or Tekton.

### 3. No Security Scanning (SAST/Dependency)
- **Impact**: Code-level vulnerabilities (SQL injection, command injection in exec calls), dependency CVEs, and leaked secrets not caught
- **Severity**: HIGH
- **Effort**: 3-4 hours
- **Details**: No CodeQL, gosec, Semgrep, Dependabot, or Gitleaks configured. The codebase uses `exec.Command` with `chroot` calls on GPU nodes - SAST coverage is especially important here.

### 4. Untested Packages (~1,200+ lines)
- **Impact**: Complex code paths for topology discovery, AMD support, and operator checks lack test coverage
- **Severity**: MEDIUM
- **Effort**: 8-16 hours
- **Files without tests**:
  - `pkg/checks/rdma/topology.go` (664 lines) - GPU-NIC-NUMA topology discovery
  - `pkg/checks/operator/operator.go` (164 lines) - Operator/CRD dependency checks
  - `pkg/checks/rdma/rdmawep_job.go` (200 lines) - RDMA write endpoint job
  - `pkg/checks/gpu/amd_driver.go` (118 lines) - AMD driver check
  - `pkg/checks/gpu/amd_ecc.go` (69 lines) - AMD ECC check
  - `pkg/checks/networking/tcplat_job.go` (122 lines) - TCP latency job

## Quick Wins

### 1. Add Coverage Generation + Codecov (2-3 hours)
```yaml
# Add to .github/workflows/ci.yaml test job:
- name: Test with coverage
  run: go test ./... -count=1 -race -coverprofile=coverage.out -covermode=atomic
- name: Upload coverage
  uses: codecov/codecov-action@v5
  with:
    files: ./coverage.out
```

### 2. Add Trivy Container Scanning (1-2 hours)
```yaml
# Add to .github/workflows/image-build.yaml:
- name: Scan validator image
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: odh-rhaii-cluster-validator:ci
    exit-code: '1'
    severity: 'CRITICAL,HIGH'
```

### 3. Add Concurrency Control (30 minutes)
```yaml
# Add to all three GitHub Actions workflows:
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 4. Generate Agent Rules (1-2 hours)
Run `/test-rules-generator` on this repository to create `.claude/rules/` with Go unit test patterns, table-driven test templates, and E2E test guidelines.

## Detailed Findings

### CI/CD Pipeline

**GitHub Actions (3 workflows)**:

| Workflow | Trigger | Jobs | Purpose |
|----------|---------|------|---------|
| `ci.yaml` | push/PR to main | build, test, lint | Core CI: go mod tidy verification, unit tests (-race), golangci-lint v2.11.3 |
| `e2e.yaml` | push/PR to main | e2e-local | Binary E2E (local + container), JSON output validation, exit code verification |
| `image-build.yaml` | push/PR to main | build-and-test | Full pipeline: build + test + container build (2 images) + container E2E |

**Strengths**:
- All workflows trigger on both push and PR to main
- Action SHAs are pinned (not floating tags) - excellent supply chain hygiene
- `go mod tidy` + `git diff --exit-code` catches dependency drift
- E2E validates JSON structure programmatically (not just "did it exit 0")
- Panic/runtime error detection in container stderr

**Gaps**:
- No `concurrency` block - rapid pushes trigger duplicate runs
- No Go module caching (`actions/cache`) - every run downloads dependencies
- Tests and container builds are duplicated across `ci.yaml` and `image-build.yaml`
- No job dependencies between workflows (test and image-build both run unit tests)

**Tekton/Konflux (4 PipelineRuns)**:

| Pipeline | Trigger | Images | Arch |
|----------|---------|--------|------|
| `odh-rhaii-cluster-validator-ci-on-pull-request` | PR to main + `/build-konflux` comment | Validator | x86_64 + arm64 |
| `odh-rhaii-cluster-validator-ci-on-push` | Push to main | Validator | x86_64 + arm64 |
| `odh-rhaii-validator-tools-ci-on-pull-request` | PR to main + `/build-konflux` comment | Tools | x86_64 + arm64 |
| `odh-rhaii-validator-tools-ci-on-push` | Push to main | Tools | x86_64 + arm64 |

**Note**: PR Tekton builds require a `/build-konflux` comment trigger - they are not automatic. This means Konflux build failures could be discovered late if contributors forget to trigger.

### Test Coverage

**Test Inventory (20 test files, 3,362 lines)**:

| Package | Test File | Lines | Key Tests |
|---------|-----------|-------|-----------|
| `pkg/controller` | `controller_test.go` | 505 | ParseReport, PingMesh classification, bandwidth pairing |
| `pkg/checks/rdma` | `gpu_nic_lpbk_bw_test.go` | 392 | GPU-NIC loopback bandwidth parsing |
| `pkg/config` | `platform_test.go` | 266 | Platform config parsing, merge, thresholds |
| `pkg/checks` | `check_json_test.go` | 229 | JSON serialization of check results |
| `pkg/jobrunner` | `job_test.go` | 230 | Resource requirements, image configuration |
| `pkg/runner` | `runner_test.go` | 195 | Runner JSON output, mock checks, failure detection |
| `pkg/checks/rdma` | `pingmesh_job_test.go` | 159 | Pingmesh job spec, argument building |
| `pkg/jobrunner` | `helpers_test.go` | 157 | Ring/star topology, pairwise scheduling |
| `pkg/checks/rdma` | `status_test.go` | 155 | RDMA NIC status parsing |
| `pkg/checks/crd` | `crd_test.go` | 136 | CRD existence checks |

**Test Quality**:
- Table-driven tests throughout (Go best practice)
- Mock interfaces (mockCheck, MockJobWithCustomImages) for isolation
- Edge cases covered (empty input, malformed data, missing topology)
- Retry/recovery scenarios tested (pingmesh retry)
- `-race` flag used for race condition detection

**Test-to-Code Ratio**: 3,362 / 8,333 = **0.40 (40%)** - Good for a Go project

**Untested Files** (significant omissions):
- `pkg/checks/rdma/topology.go` (664 lines) - most complex file, NUMA affinity discovery
- `pkg/checks/operator/operator.go` (164 lines) - operator dependency checks
- `pkg/checks/rdma/rdmawep_job.go` (200 lines) - RDMA write endpoint
- `pkg/checks/gpu/amd_driver.go` (118 lines) - AMD GPU driver check
- `pkg/checks/gpu/amd_ecc.go` (69 lines) - AMD ECC check
- `cmd/agent/main.go` (429 lines) - CLI entry point (partially tested via E2E)

### Code Quality

**Linting**:
- golangci-lint v2.11.3 with SHA-pinned GitHub Action
- `.golangci.yml` is minimal: only disables `errcheck` linter
- Does NOT enable additional linters (govet, staticcheck, ineffassign, gosimple, etc.)
- golangci-lint v2 uses a default set that's reasonable, but explicit configuration of stricter linters would improve quality

**Pre-commit Hooks**: None configured

**Static Analysis**: No SAST tools (CodeQL, gosec, Semgrep)

**Formatting**: `go fmt` target in Makefile, not enforced in CI

### Container Images

**Validator Image** (2 Dockerfiles):
- `Dockerfile.dev`: Uses `registry.access.redhat.com/ubi9/go-toolset:latest` (floating tag) + `ubi9/ubi:latest`
- `Dockerfile.konflux`: Uses SHA-pinned UBI9 images with FIPS build flag (`-buildvcs=false -ldflags`, `GOEXPERIMENT=strictfipsruntime`)
- Multi-stage build (builder + runtime)
- Installs: util-linux, pciutils, infiniband-diags, libibverbs-utils
- Runs as root (USER 0) - required for privileged GPU/RDMA access

**Tools Image** (2 Dockerfiles):
- `tools/Dockerfile.dev`: NVIDIA CUDA 13.0 devel base, builds perftest from vendored tarball
- `tools/Dockerfile.konflux`: SHA-pinned Red Hat CUDA base, same perftest build
- Includes: iperf3, perftest (ib_write_bw, ibv_rc_pingpong), RDMA libraries
- Copies only libcudart (~756K) to runtime image - efficient

**Strengths**:
- SHA-pinned images in Konflux Dockerfiles
- Multi-stage builds minimize runtime image size
- Multi-arch support (x86_64 + arm64) in Tekton
- Vendored perftest tarball for reproducible builds

**Gaps**:
- No Trivy/Snyk/Grype scanning
- No SBOM generation
- No image signing/attestation
- `Dockerfile.dev` uses floating tags (`:latest`, `:9.7-1774309344`)
- Runs as root (acknowledged as necessary but should be documented as risk)

### Security

| Practice | Status |
|----------|--------|
| Container scanning (Trivy/Snyk) | Not configured |
| SAST/CodeQL | Not configured |
| Dependency scanning (Dependabot/Renovate) | Not configured |
| Secret detection (Gitleaks/TruffleHog) | Not configured |
| Image signing/attestation | Not configured |
| SBOM generation | Not configured |
| SHA-pinned CI actions | Yes (all GitHub Actions) |
| SHA-pinned base images | Partially (Konflux yes, dev no) |
| FIPS compliance | Yes (Dockerfile.konflux uses strictfipsruntime) |

### Agent Rules (Agentic Flow Quality)

- **Status**: Partial
- **CLAUDE.md**: Excellent - comprehensive project documentation covering architecture, CLI usage, coding conventions, platform config, known TODOs. One of the best CLAUDE.md files analyzed.
- **`.claude/` directory**: Does not exist
- **`.claude/rules/`**: Does not exist - no test creation guidance for AI agents
- **Coverage**: CLAUDE.md covers coding conventions but not test patterns
- **Gaps**:
  - No rules for unit test patterns (table-driven, mock interfaces)
  - No rules for E2E test patterns (JSON validation, container testing)
  - No rules for when to use mocks vs. real K8s clients
  - No test checklists or quality gates
- **Recommendation**: Generate missing rules with `/test-rules-generator`

## Recommendations

### Priority 0 (Critical)

1. **Add coverage generation and codecov integration** (2-4 hours)
   - Add `-coverprofile=coverage.out` to `go test` in CI
   - Integrate codecov with 60% initial threshold, ramp to 70%
   - Add coverage diff reporting on PRs

2. **Add container vulnerability scanning** (2-3 hours)
   - Add Trivy scanning for both images in `image-build.yaml`
   - Configure severity threshold (CRITICAL, HIGH)
   - Block PR merge on critical CVEs

3. **Enable SAST scanning** (3-4 hours)
   - Add CodeQL for Go or gosec GitHub Action
   - Critical given the `exec.Command` + `chroot` usage patterns
   - Add Gitleaks for secret detection

### Priority 1 (High Value)

4. **Write tests for untested packages** (8-16 hours)
   - `pkg/checks/rdma/topology.go` - highest priority (664 lines, most complex)
   - `pkg/checks/operator/operator.go` - CRD/operator detection
   - `pkg/checks/gpu/amd_driver.go` + `amd_ecc.go` - AMD GPU support

5. **CI workflow improvements** (2-3 hours)
   - Add concurrency control to all workflows
   - Add Go module caching
   - Consolidate duplicate test runs across workflows
   - Enforce `go fmt` in CI

6. **Create agent rules** (1-2 hours)
   - Generate `.claude/rules/` with test patterns
   - Document table-driven test conventions
   - Document mock interface patterns

7. **Make Tekton PR builds automatic** (1-2 hours)
   - Change PR Tekton trigger from `/build-konflux` comment to automatic CEL expression
   - Or add a required check that blocks merge until Konflux build passes

### Priority 2 (Nice-to-Have)

8. **Add pre-commit hooks** (1-2 hours)
   - Configure `.pre-commit-config.yaml` with: go fmt, go vet, golangci-lint, gitleaks

9. **Expand golangci-lint configuration** (1 hour)
   - Enable: govet, staticcheck, ineffassign, gosimple, unused, errcheck (with targeted ignores)
   - Add custom linter rules for the project

10. **Add SBOM generation to Konflux** (2-3 hours)
    - Generate SPDX/CycloneDX SBOM in Tekton pipeline
    - Attach to container image as attestation

11. **Add dependency management** (1 hour)
    - Configure Dependabot or Renovate for Go module updates
    - Auto-merge patch updates, review minor/major

## Comparison to Gold Standards

| Dimension | rhaii-cluster-validation | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|-----------|------------------------|---------------------|------------------|---------------|
| Unit Tests | 7/10 - 40% ratio, no coverage | 9/10 - High coverage with enforcement | 7/10 | 9/10 - Coverage gates |
| Integration/E2E | 7/10 - Binary + container E2E | 9/10 - Contract tests, Cypress E2E | 8/10 | 9/10 - Multi-version |
| Build Integration | 6/10 - Comment-triggered Konflux | 8/10 - Automated Konflux | 7/10 | 8/10 |
| Image Testing | 6/10 - Runtime validation | 8/10 - Multi-layer | 9/10 - 5-layer validation | 8/10 |
| Coverage Tracking | 2/10 - None | 9/10 - Codecov enforced | 6/10 | 9/10 - Threshold gates |
| CI/CD Automation | 7/10 - Good workflows | 9/10 - Comprehensive | 8/10 | 9/10 |
| Agent Rules | 4/10 - CLAUDE.md only | 8/10 - Full .claude/rules/ | 5/10 | 6/10 |
| Security Scanning | 1/10 - None | 7/10 - Trivy + CodeQL | 7/10 - Trivy | 8/10 |

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yaml` - Build, test, lint
- `.github/workflows/e2e.yaml` - Binary and container E2E
- `.github/workflows/image-build.yaml` - Full build+test+image pipeline
- `.tekton/odh-rhaii-cluster-validator-ci-on-pull-request.yaml` - PR Konflux build
- `.tekton/odh-rhaii-cluster-validator-ci-on-push.yaml` - Push Konflux build
- `.tekton/odh-rhaii-validator-tools-ci-on-pull-request.yaml` - Tools PR build
- `.tekton/odh-rhaii-validator-tools-ci-on-push.yaml` - Tools push build

### Testing
- `pkg/controller/controller_test.go` - Controller tests (505 lines)
- `pkg/checks/rdma/gpu_nic_lpbk_bw_test.go` - Loopback BW tests (392 lines)
- `pkg/config/platform_test.go` - Platform config tests (266 lines)
- `pkg/checks/check_json_test.go` - JSON serialization tests (229 lines)
- `pkg/jobrunner/job_test.go` - Job spec tests (230 lines)
- `pkg/runner/runner_test.go` - Runner tests (195 lines)
- `test/README.md` - Testing documentation

### Code Quality
- `.golangci.yml` - Minimal linter config (errcheck disabled only)

### Container Images
- `Dockerfile.dev` - Dev validator image
- `Dockerfile.konflux` - Production validator image (SHA-pinned, FIPS)
- `tools/Dockerfile.dev` - Dev tools image
- `tools/Dockerfile.konflux` - Production tools image (SHA-pinned)

### Documentation
- `CLAUDE.md` - Comprehensive developer documentation
- `README.md` - User-facing documentation with quick start
- `docs/platform-config.md` - Per-platform configuration
- `docs/dev.md` - Developer guide
