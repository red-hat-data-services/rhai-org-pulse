---
repository: "red-hat-data-services/rhaii-cluster-validation"
overall_score: 6.6
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "20 test files, 3362 LOC tests / 8333 LOC source (40% ratio), strong table-driven pattern"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "CI-based E2E with binary + container runtime validation, JSON output verification"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time Docker builds + E2E for both validator and tools images, Konflux Dockerfiles ready"
  - dimension: "Image Testing"
    score: 6.5
    status: "Container build + runtime smoke tests in CI, but no vulnerability scanning or multi-arch"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "No coverage generation, no codecov/coveralls, no thresholds, no PR coverage reporting"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "3 workflows on PR+push, lint + test + build + e2e, but no concurrency control or caching"
  - dimension: "Agent Rules"
    score: 5.0
    status: "CLAUDE.md present with architecture/conventions, but .claude/ gitignored, no test creation rules"
critical_gaps:
  - title: "No test coverage tracking or enforcement"
    impact: "Cannot measure coverage trends, no gate to prevent coverage regressions on PRs"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container vulnerability scanning"
    impact: "CVEs in base images and dependencies go undetected until downstream scanning"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No SAST/CodeQL integration"
    impact: "Static analysis bugs and security issues not caught at PR time"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No dependency scanning (Dependabot/Renovate)"
    impact: "Go module vulnerabilities not surfaced, manual dependency updates required"
    severity: "MEDIUM"
    effort: "1 hour"
  - title: "Operator package has no unit tests"
    impact: "K8s API interaction logic (164 LOC) is untested despite being easily testable with fake clientset"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add codecov integration with coverage report"
    effort: "2-3 hours"
    impact: "Visibility into test coverage trends and PR-level coverage diffs"
  - title: "Add Trivy scanning to CI workflow"
    effort: "1-2 hours"
    impact: "Catch CVEs in UBI9 base images and Go dependencies before merge"
  - title: "Enable GitHub Dependabot for Go modules"
    effort: "30 minutes"
    impact: "Automated PRs for vulnerable or outdated Go dependencies"
  - title: "Add concurrency control to CI workflows"
    effort: "15 minutes"
    impact: "Cancel redundant PR runs, save CI minutes"
  - title: "Add unit tests for operator package"
    effort: "2-3 hours"
    impact: "Cover 164 LOC of K8s API logic using fake clientset pattern already established"
recommendations:
  priority_0:
    - "Add codecov integration: generate coverage with `go test -coverprofile=coverage.out ./...` and upload to Codecov with PR reporting"
    - "Add Trivy container scanning to the image-build workflow for both validator and tools images"
    - "Enable CodeQL or gosec for static analysis on PRs"
  priority_1:
    - "Add unit tests for pkg/checks/operator using fake kubernetes.Interface"
    - "Add cmd/agent integration tests (CLI flag parsing, subcommand routing)"
    - "Enable GitHub Dependabot for Go module vulnerability alerts"
    - "Add concurrency control to all 3 workflows to cancel stale runs"
    - "Create .claude/rules/ with test creation guidelines (currently gitignored)"
  priority_2:
    - "Add multi-architecture image builds (arm64 support)"
    - "Add image signing with cosign/sigstore"
    - "Add pre-commit hooks for go fmt, golangci-lint, go mod tidy"
    - "Add SBOM generation (syft) to image builds"
    - "Add performance regression tests for check execution time"
---

# Quality Analysis: rhaii-cluster-validation

## Executive Summary

- **Overall Score: 6.6/10**
- **Repository Type**: Go CLI / kubectl plugin (Kubernetes cluster validation tool)
- **Primary Language**: Go 1.25
- **Framework**: Kubernetes client-go, Cobra CLI
- **Key Strengths**: Strong unit test culture (40% test-to-code ratio), comprehensive E2E with container runtime validation, well-documented CLAUDE.md with architecture details, race detection enabled in CI
- **Critical Gaps**: No coverage tracking, no vulnerability scanning, no SAST, no dependency scanning
- **Agent Rules Status**: Partial (CLAUDE.md present, but `.claude/` directory is gitignored so no agent rules in repo)

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.5/10 | 20 test files, 3362 LOC, table-driven tests, race detection |
| Integration/E2E | 7.0/10 | CI E2E validates binary + container JSON output |
| **Build Integration** | **7.0/10** | **PR-time Docker builds for both images, Konflux Dockerfiles ready** |
| Image Testing | 6.5/10 | Container smoke tests, but no vuln scanning or multi-arch |
| Coverage Tracking | 2.0/10 | No coverage generation, no codecov, no thresholds |
| CI/CD Automation | 7.0/10 | 3 workflows on PR+push, lint+test+build+e2e, no concurrency |
| Agent Rules | 5.0/10 | CLAUDE.md with conventions, `.claude/` gitignored |

## Critical Gaps

### 1. No Test Coverage Tracking or Enforcement
- **Impact**: Cannot measure coverage trends, no gate to prevent regressions
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: CI runs `go test ./... -count=1 -race` but never generates a coverage profile. No codecov/coveralls integration. No coverage thresholds enforced. PRs can reduce coverage without any signal.

### 2. No Container Vulnerability Scanning
- **Impact**: CVEs in UBI9 base images, Go dependencies, and RPM packages undetected until Konflux/downstream scanning
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: The image-build workflow builds both `odh-rhaii-cluster-validator` and `odh-rhaii-validator-tools` images but never scans them. The tools image includes CUDA libraries, perftest binaries, and numerous runtime packages that expand the attack surface.

### 3. No Static Analysis Security Testing (SAST)
- **Impact**: Code-level security issues (command injection via chroot commands, improper error handling with K8s API) not caught
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: No CodeQL, gosec, or Semgrep configured. The codebase executes host commands via `chroot /host` which warrants static analysis for injection risks.

### 4. No Dependency Vulnerability Scanning
- **Impact**: Vulnerable Go modules and transitive dependencies not surfaced
- **Severity**: MEDIUM
- **Effort**: 1 hour
- **Details**: No Dependabot or Renovate configured. The project uses `k8s.io/client-go v0.35.3`, `spf13/cobra`, and other dependencies that should be monitored for CVEs.

### 5. Operator Package Has No Unit Tests
- **Impact**: 164 LOC of K8s API interaction logic is completely untested
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: `pkg/checks/operator/operator.go` uses `kubernetes.Interface` for namespace/pod listing — perfect for fake clientset testing. The function has multiple code paths (namespace not found, pods failing, pods running, no pods) that need coverage.

## Quick Wins

### 1. Add Codecov Integration (2-3 hours)
Add coverage generation to the CI workflow and upload to Codecov:

```yaml
# In .github/workflows/ci.yaml, test job
- name: Test with coverage
  run: go test ./... -count=1 -race -coverprofile=coverage.out -covermode=atomic
- name: Upload coverage
  uses: codecov/codecov-action@v5
  with:
    files: coverage.out
    fail_ci_if_error: false
```

### 2. Add Trivy Scanning (1-2 hours)
Add vulnerability scanning after image builds:

```yaml
# In .github/workflows/image-build.yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'odh-rhaii-cluster-validator:ci'
    exit-code: '1'
    severity: 'CRITICAL,HIGH'
```

### 3. Enable Dependabot (30 minutes)
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

### 4. Add Concurrency Control (15 minutes)
Add to all 3 workflows:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

### 5. Add Operator Unit Tests (2-3 hours)
Use `fake.NewSimpleClientset()` to test `pkg/checks/operator`:

```go
func TestOperatorChecker(t *testing.T) {
    client := fake.NewSimpleClientset(
        &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "cert-manager"}},
        &corev1.Pod{
            ObjectMeta: metav1.ObjectMeta{Name: "cert-manager-pod", Namespace: "cert-manager"},
            Status:     corev1.PodStatus{Phase: corev1.PodRunning},
        },
    )
    checker := NewChecker(client, nil, nil)
    results := checker.Run(context.Background())
    // Assert results...
}
```

## Detailed Findings

### CI/CD Pipeline

**Workflows (3)**:
| Workflow | Triggers | Jobs | Key Steps |
|----------|----------|------|-----------|
| `ci.yaml` | push+PR to main | build, test, lint | go mod tidy verify, `make build`, `go test -race`, golangci-lint v2.11.3 |
| `e2e.yaml` | push+PR to main | e2e-local | build binary, verify --version, run agent (expect FAIL), validate JSON, build+run container |
| `image-build.yaml` | push+PR to main | build-and-test | build binary, unit tests, build both images, container E2E |

**Strengths**:
- All 3 workflows run on both push and PR to main
- Race detection enabled (`-race` flag)
- Go module tidiness verification prevents stale go.sum
- Pinned action versions with SHA hashes (supply chain security)
- E2E validates both binary and container execution
- JSON output structure validated programmatically

**Gaps**:
- No concurrency control — redundant runs waste CI minutes
- No Go module/build caching — every run downloads dependencies from scratch
- Duplicate test execution: both ci.yaml and image-build.yaml run `go test ./... -race`
- No branch protection or required status checks visible

### Test Coverage

**Unit Tests (20 files, 3362 LOC)**:
| Package | Test Files | LOC | Key Coverage |
|---------|-----------|-----|-------------|
| `pkg/checks` | 1 | 229 | JSON serialization of check results |
| `pkg/checks/crd` | 1 | 136 | CRD validation checks |
| `pkg/checks/gpu` | 2 | 217 | Driver + ECC output parsing |
| `pkg/checks/networking` | 2 | 183 | iperf3 result parsing, bandwidth thresholds |
| `pkg/checks/rdma` | 5 | 861 | RDMA devices, status, bandwidth, pingmesh scheduling |
| `pkg/config` | 4 | 540 | Platform detection, config loading, image refs, resource config |
| `pkg/controller` | 1 | 505 | Controller job spec building, resource management |
| `pkg/jobrunner` | 3 | 496 | Job spec, helpers, round-robin scheduling |
| `pkg/runner` | 1 | 195 | Per-node runner output format, error handling |

**Test-to-code ratio**: 3362/8333 = **40.3%** (healthy for a Go project)

**Testing patterns**:
- Standard `testing` package (no external framework dependencies)
- Table-driven tests with `t.Run()` subtests throughout
- Mock interfaces for testing (`MockJobWithCustomImages`, etc.)
- Race detection enabled via `-race` flag

**Packages without tests**:
| Package | LOC | Risk | Reason |
|---------|-----|------|--------|
| `cmd/agent` | 647 | Medium | CLI entry point, subcommand routing, flag parsing |
| `pkg/checks/operator` | 164 | Medium | K8s API calls, easily testable with fake clientset |
| `deploy` | ~20 | Low | Embed directives only |
| `manifests/image-references` | ~15 | Low | Embed directives only |

### Code Quality

**Linting**:
- golangci-lint v2.11.3 configured in CI (latest major version)
- `.golangci.yml` is minimal: only disables `errcheck` for intentional fprintf patterns
- Uses default linter set (vet, staticcheck, unused, etc.)

**Strengths**:
- `go mod tidy` verification prevents dependency drift
- `go fmt` target in Makefile
- Clean `.gitignore` with IDE, OS, and build artifacts excluded
- Go 1.25 (latest stable)

**Gaps**:
- No pre-commit hooks
- golangci-lint config is minimal — could enable additional linters (gocritic, revive, gocyclo)
- No custom lint rules for project patterns (e.g., check interface compliance)

### Container Images

**Images built**:
| Image | Dev Dockerfile | Konflux Dockerfile | Base |
|-------|---------------|-------------------|------|
| cluster-validator | `Dockerfile.dev` | `Dockerfile.konflux.cluster-validation` | UBI9 |
| validator-tools | `tools/Dockerfile.dev` | `Dockerfile.konflux.validator.tools` | CUDA 13.0 builder + UBI9 runtime |

**Build practices**:
- Multi-stage builds (builder + runtime separation)
- FIPS-compatible build: `GOEXPERIMENT=strictfipsruntime`
- SHA-pinned base images in Konflux Dockerfiles (supply chain security)
- RPM lockfiles for hermetic Konflux builds (`rpms.lock.yaml`)
- Proper OCI labels (name, component, summary, description)

**Gaps**:
- No multi-architecture support (only `linux/amd64`)
- No vulnerability scanning (Trivy, Grype)
- No SBOM generation (Syft)
- No image signing (cosign)
- Container runs as `USER 0` (root) — documented as intentional for hardware access but worth security review

### Security

**Current state**: Minimal security tooling

| Practice | Status |
|----------|--------|
| Container scanning | Not configured |
| SAST/CodeQL | Not configured |
| Dependency scanning | Not configured |
| Secret detection | Not configured |
| Supply chain (Konflux) | SHA-pinned images, RPM lockfiles |
| FIPS compliance | `GOEXPERIMENT=strictfipsruntime` |
| Action pinning | SHA-pinned GitHub Actions |

**Risk context**: The project runs privileged containers with `chroot /host` access and `hostPID`. While this is architecturally necessary for GPU/RDMA validation, it elevates the importance of supply chain security and code-level SAST.

### Agent Rules (Agentic Flow Quality)

**Status**: Partial
- **CLAUDE.md**: Present and comprehensive — includes project overview, architecture, CLI reference, coding conventions, known TODOs, platform config, and RPM lockfile procedures
- **`.claude/` directory**: Gitignored (`.gitignore` includes `.claude/`), so no agent rules, skills, or memory files are version-controlled
- **Test creation rules**: None — no `.claude/rules/` with unit test, integration test, or E2E test patterns

**Quality of CLAUDE.md**:
- Excellent architecture documentation with ASCII diagrams
- Clear coding conventions section
- Known TODOs for future work
- Missing: test writing guidelines, PR review checklist, common failure patterns

**Recommendation**: Either remove `.claude/` from `.gitignore` and add test creation rules, or document testing patterns in `CLAUDE.md` directly.

## Recommendations

### Priority 0 (Critical)

1. **Add test coverage tracking with Codecov** — Generate `coverage.out` in CI, upload to Codecov, enforce minimum threshold (start at current baseline, e.g., 50%). This is the single highest-ROI improvement.

2. **Add Trivy container vulnerability scanning** — Scan both validator and tools images on PR. The tools image is especially important given its CUDA libraries and perftest binaries.

3. **Add CodeQL or gosec for SAST** — The codebase executes shell commands via `chroot /host` and interacts with K8s API, making static analysis particularly valuable.

### Priority 1 (High Value)

4. **Add unit tests for `pkg/checks/operator`** — 164 LOC using `kubernetes.Interface` is trivially testable with `fake.NewSimpleClientset()`. Cover all paths: namespace not found, pods failing, pods running, no pods.

5. **Enable Dependabot for Go modules and GitHub Actions** — Automated vulnerability alerts and update PRs for 30 minutes of setup.

6. **Add concurrency control to all workflows** — Prevent wasted CI runs on rapid PR pushes.

7. **Add Go module caching** — Use `actions/cache` or the built-in Go cache in `actions/setup-go` to speed up CI runs.

8. **Create agent test creation rules** — Either un-gitignore `.claude/` and add rules, or document testing patterns in CLAUDE.md.

### Priority 2 (Nice-to-Have)

9. **Add multi-architecture image builds** — arm64 support for broader cluster compatibility.

10. **Add pre-commit hooks** — Enforce `go fmt`, `go mod tidy`, and golangci-lint locally before push.

11. **Add image signing with cosign** — Complement existing Konflux supply chain practices.

12. **Add SBOM generation** — Generate SBOMs for both container images.

13. **Expand golangci-lint configuration** — Enable additional linters: `gocritic`, `revive`, `gocyclo`, `goconst`.

14. **Consolidate duplicate test runs** — Both `ci.yaml` and `image-build.yaml` run `go test ./... -race`. Consider having image-build depend on ci.yaml or removing the duplicate.

## Comparison to Gold Standards

| Practice | rhaii-cluster-validation | odh-dashboard (Gold) | notebooks (Gold) | Best Practice |
|----------|------------------------|---------------------|-----------------|---------------|
| Unit test ratio | 40% (7.5) | 60%+ (9) | N/A | 50%+ |
| E2E automation | CI smoke (7) | Cypress + multi-env (9) | 5-layer (9) | Full lifecycle |
| Coverage tracking | None (2) | Codecov enforced (9) | Present (7) | Codecov + thresholds |
| Container scanning | None (2) | Trivy (8) | Trivy + SBOM (9) | Trivy + Grype |
| SAST | None (1) | CodeQL (8) | Present (7) | CodeQL + gosec |
| Dependency scanning | None (1) | Dependabot (8) | Present (7) | Dependabot |
| Lint config | Minimal (5) | Comprehensive (9) | Comprehensive (8) | Extended config |
| Agent rules | Partial CLAUDE.md (5) | Full .claude/rules (9) | N/A | Rules + skills |
| CI concurrency | None (4) | Controlled (8) | Controlled (8) | Group + cancel |
| Image builds | PR-time (7) | PR-time + staging (9) | Multi-layer (9) | Build + test + scan |
| Supply chain | SHA pins (6) | SHA + signing (8) | Full attestation (9) | Sign + SBOM + attest |

## File Paths Reference

| Category | File | Notes |
|----------|------|-------|
| CI | `.github/workflows/ci.yaml` | Build + test + lint |
| CI | `.github/workflows/e2e.yaml` | Binary + container E2E |
| CI | `.github/workflows/image-build.yaml` | Image build + E2E |
| Build | `Makefile` | 170 LOC, all targets |
| Lint | `.golangci.yml` | Minimal config |
| Dockerfile | `Dockerfile.dev` | Dev validator image |
| Dockerfile | `Dockerfile.konflux` | Konflux validator (legacy) |
| Dockerfile | `Dockerfile.konflux.cluster-validation` | Konflux validator (current) |
| Dockerfile | `Dockerfile.konflux.validator.tools` | Konflux tools image |
| Dockerfile | `tools/Dockerfile.dev` | Dev tools image |
| Tests | `pkg/*/` | 20 test files across 9 packages |
| Agent | `CLAUDE.md` | Project documentation |
| Ignore | `.gitignore` | Includes `.claude/` exclusion |
| RPMs | `rpms.in.yaml`, `rpms.lock.yaml` | Konflux hermetic builds |
