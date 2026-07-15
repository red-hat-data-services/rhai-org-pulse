---
repository: "openshift/kube-rbac-proxy"
overall_score: 6.4
scorecard:
  - dimension: "Unit Tests"
    score: 6.5
    status: "Decent unit tests with race detection but 2 packages untested and no coverage tracking"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Strong E2E suite with 12 scenarios running on Kind, automated on every PR"
  - dimension: "Build Integration"
    score: 5.0
    status: "PR builds binary but no Konflux simulation, no OCP image validation"
  - dimension: "Image Testing"
    score: 4.5
    status: "Multi-arch builds (5 archs) but no runtime validation, no vulnerability scanning"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tool, no codecov, no thresholds, no PR coverage reporting"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "Well-structured GitHub Actions with concurrency control, pinned actions, parallel jobs"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules of any kind"
critical_gaps:
  - title: "No test coverage tracking or enforcement"
    impact: "Coverage regression goes completely undetected — no visibility into whether new code is tested"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container vulnerability scanning"
    impact: "Security vulnerabilities in base images and dependencies are not detected before release"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No PR-time OCP image build validation"
    impact: "Dockerfile.ocp build failures only discovered in OpenShift CI post-merge or in Konflux"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "authn and options packages have zero unit tests"
    impact: "Authentication and CLI option parsing — security-critical code paths — are untested at unit level"
    severity: "HIGH"
    effort: "8-12 hours"
quick_wins:
  - title: "Add codecov integration with coverage threshold"
    effort: "2-3 hours"
    impact: "Immediate visibility into test coverage and prevention of coverage regression"
  - title: "Add Trivy scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Early detection of CVEs in distroless base image and Go dependencies"
  - title: "Add -coverprofile flag to unit test make target"
    effort: "30 minutes"
    impact: "Enables coverage reporting pipeline with minimal effort"
  - title: "Create basic CLAUDE.md with test patterns"
    effort: "2-3 hours"
    impact: "AI-assisted development follows existing project conventions"
recommendations:
  priority_0:
    - "Add test coverage generation (-coverprofile) and codecov integration with >=70% threshold"
    - "Add Trivy container scanning to PR workflow for both Dockerfile and Dockerfile.ocp images"
    - "Write unit tests for pkg/authn (OIDC, delegating auth) and cmd/kube-rbac-proxy/app/options"
  priority_1:
    - "Add PR-time Dockerfile.ocp build validation to catch OpenShift-specific build failures"
    - "Add SBOM generation (syft/cosign) to image build process"
    - "Add gosec or CodeQL SAST scanning for security-sensitive proxy code"
    - "Create .claude/rules/ with unit-test and e2e-test patterns for AI-assisted development"
  priority_2:
    - "Add pre-commit hooks for license checks and go vet"
    - "Add fuzz testing for auth filter parsing (pkg/filters, pkg/authz)"
    - "Add benchmark tests for proxy hot path (pkg/proxy)"
    - "Implement Dependabot or Renovate for automated dependency updates"
---

# Quality Analysis: openshift/kube-rbac-proxy

## Executive Summary

- **Overall Score: 6.4/10**
- **Repository Type**: Kubernetes RBAC proxy (Go binary, security-critical)
- **Primary Language**: Go (38 files, ~4,500 LOC excluding vendor/test)
- **Version**: v0.21.1

**Key Strengths**: Well-structured CI/CD pipeline with automated E2E tests on Kind, strong multi-architecture support (5 architectures), SHA-pinned GitHub Actions, race detection in unit tests, and a mature release process with semantic versioning.

**Critical Gaps**: Zero test coverage tracking, no container vulnerability scanning, no SAST/security analysis, 2 packages with no unit tests (including security-critical `authn`), and no agent rules for AI-assisted development.

**Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or `.claude/` directory exists.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.5/10 | Race detection enabled, good auth filter tests, but 2 packages untested |
| Integration/E2E | 8.0/10 | 12 E2E scenarios on Kind cluster, fully automated on PR |
| **Build Integration** | **5.0/10** | **Binary builds on PR but no OCP Dockerfile validation** |
| Image Testing | 4.5/10 | Multi-arch builds but no runtime validation or scanning |
| Coverage Tracking | 1.0/10 | No coverage tooling whatsoever |
| CI/CD Automation | 8.5/10 | Parallel jobs, concurrency control, pinned actions |
| Agent Rules | 0.0/10 | No agent rules or AI development guidance |

## Critical Gaps

### 1. No Test Coverage Tracking or Enforcement
- **Impact**: Coverage regression goes completely undetected. New code may be entirely untested with no visibility.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The Makefile `test-unit` target runs `go test -v -race -count=1` but does not generate a coverage profile. No `.codecov.yml` or `.coveragerc` exists. No coverage gates in CI.

### 2. No Container Vulnerability Scanning
- **Impact**: CVEs in the distroless base image (`gcr.io/distroless/static:nonroot`) or Go dependencies are invisible until external audits.
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: No Trivy, Snyk, Grype, or any container scanning tool is configured. No `.trivyignore` file. No SBOM generation. For a security-focused proxy, this is a significant gap.

### 3. No PR-time OCP Image Build Validation
- **Impact**: `Dockerfile.ocp` (multi-stage build with RHEL 9 builder + OCP base) is never validated in GitHub Actions CI. Build failures are only caught by OpenShift CI (ci-operator) post-merge.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The GitHub Actions workflow only builds the upstream `Dockerfile`. The OpenShift-specific `Dockerfile.ocp` references `registry.ci.openshift.org` images that aren't accessible from GitHub Actions, but a dry-run or syntax validation would still catch many issues.

### 4. Security-Critical Packages Lack Unit Tests
- **Impact**: `pkg/authn` (OIDC authentication, delegating authentication) and `cmd/kube-rbac-proxy/app/options` (CLI option parsing) have zero test coverage at the unit level. For a security proxy, authentication code without unit tests is a significant risk.
- **Severity**: HIGH
- **Effort**: 8-12 hours

## Quick Wins

### 1. Add Coverage Profile Generation (30 minutes)
Change the Makefile `test-unit` target:
```makefile
test-unit:
	go test -v -race -count=1 -coverprofile=coverage.out $(PKGS)
```

### 2. Add Codecov Integration (2-3 hours)
Add to `.github/workflows/build.yml` after unit tests:
```yaml
    - name: Upload coverage
      uses: codecov/codecov-action@v5
      with:
        files: coverage.out
        fail_ci_if_error: true
```
Create `.codecov.yml`:
```yaml
coverage:
  status:
    project:
      default:
        target: 70%
    patch:
      default:
        target: 80%
```

### 3. Add Trivy Container Scanning (1-2 hours)
Add a new job to `.github/workflows/build.yml`:
```yaml
  security-scan:
    name: Security scan
    runs-on: ubuntu-24.04
    needs: [build]
    steps:
    - uses: actions/checkout@v5
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        severity: 'CRITICAL,HIGH'
        exit-code: '1'
```

### 4. Create Basic CLAUDE.md (2-3 hours)
```markdown
# kube-rbac-proxy

## Testing
- Unit tests: `make test-unit` (uses go test with race detection)
- E2E tests: `make test-e2e` (requires Kind cluster)
- Full test: `make test-local` (creates Kind cluster + runs all tests)

## Test patterns
- Unit tests go in `*_test.go` next to source
- E2E scenarios go in `test/e2e/` using the kubetest framework
- Use table-driven tests with `t.Run()`
```

## Detailed Findings

### CI/CD Pipeline

**Workflow**: Single `build.yml` triggered on push and pull_request.

**Jobs (6 total, 5 on PR)**:
1. `check-license` — Verifies license headers (3 min timeout)
2. `generate` — Runs code generation and checks for uncommitted changes (5 min)
3. `lint` — golangci-lint with default linters (5 min)
4. `build` — Builds binary (5 min)
5. `unit-tests` — Unit tests with race detection (10 min)
6. `e2e-tests` — Full E2E on Kind cluster (30 min)
7. `publish` — Multi-arch push to Quay (push only, after all tests pass)

**Strengths**:
- Concurrency control with `cancel-in-progress: true` — prevents wasted CI time
- All GitHub Actions SHA-pinned with version comments — supply chain security best practice
- E2E tests run on every PR, not just periodically
- Publish job gated on all test jobs passing
- Reasonable timeouts on all jobs

**Weaknesses**:
- No Go module caching (each job downloads dependencies independently)
- No coverage reporting
- No security scanning jobs
- No separate workflow for scheduled/periodic testing
- No dependency update automation (Dependabot/Renovate)

### Test Coverage

**Unit Tests (8 test files, 1,608 LOC)**:
| File | Lines | Test Functions | Coverage Area |
|------|-------|---------------|---------------|
| `pkg/filters/auth_test.go` | 395 | 4 | Auth filter chain (strongest) |
| `pkg/tls/reloader_test.go` | 355 | 2 | TLS certificate reloading |
| `pkg/proxy/proxy_test.go` | 234 | 1 | Proxy handler |
| `cmd/.../transport_test.go` | 204 | 3 | HTTP transport config |
| `pkg/authz/auth_test.go` | 159 | 1 | Authorization logic |
| `cmd/.../kube-rbac-proxy_test.go` | 121 | 1 | Main app configuration |
| `pkg/filters/path_test.go` | 73 | 1 | Path filtering |
| `pkg/hardcodedauthorizer/metrics_test.go` | 67 | 1 | Metrics for hardcoded authz |

**Test-to-Code Ratio**: 1,608 test LOC / 1,902 source LOC = **0.85:1** (good for core packages, but misleading because `pkg/authn` and `options` are excluded)

**Untested Packages**:
- `pkg/authn/` — OIDC authentication config, delegating authentication (3 files, 247 LOC)
- `cmd/kube-rbac-proxy/app/options/` — CLI options and deprecated flags (2 files, 281 LOC)

**E2E Tests (12 scenarios, custom kubetest framework)**:
- Basics: authenticated/unauthenticated requests, RBAC enforcement
- H2C Upstream: HTTP/2 cleartext proxying
- Client Certificates: mTLS authentication
- Token Audience: token audience validation
- Allow/Ignore Paths: path-based filtering
- TLS: TLS configuration
- Static Authorizer: static authorization rules
- HTTP2: HTTP/2 protocol handling
- Hardcoded Authorizer: hardcoded authorization
- Flags: CLI flag validation
- Token Masking: sensitive token redaction in logs

**E2E Framework**: Custom `test/kubetest` package (~1,500 LOC) provides:
- Kind cluster management
- Kubernetes resource templates (via Go templates)
- TLS certificate generation for test scenarios
- Configurable proxy deployment with flag overrides

### Code Quality

**Linting**: golangci-lint v2 format with default linters and exclusion presets:
- `comments`, `common-false-positives`, `legacy`, `std-error-handling` presets excluded
- Test files excluded from linting (questionable — lint should still run on tests)
- No custom linters enabled (relies entirely on golangci-lint defaults)

**Static Analysis**: No SAST tools configured (no CodeQL, gosec, or Semgrep).

**Pre-commit Hooks**: None configured.

**Code Generation**: `make generate` with `embedmd` for doc embedding, validated in CI via `git diff --exit-code`.

### Container Images

**Upstream Image** (`Dockerfile`):
- Simple COPY-based image on `gcr.io/distroless/static:nonroot`
- Non-root user (65532:65532)
- Multi-arch via build args (amd64, arm, arm64, ppc64le, s390x)
- Binary pre-built outside Docker — no build caching concerns

**OpenShift Image** (`Dockerfile.ocp`):
- Multi-stage: RHEL 9 Go 1.25 builder + OCP 4.22 base
- Uses vendored dependencies (`GOFLAGS="-mod=vendor"`)
- Non-root user (65534)
- Proper OpenShift labels for metadata

**Weaknesses**:
- No runtime image validation (no startup test, no health check)
- No vulnerability scanning (no Trivy/Snyk)
- No SBOM generation
- No image signing/attestation
- No `.dockerignore` in root (uploads entire repo context)

### Security

**Positive**:
- SHA-pinned GitHub Actions (prevents supply chain attacks)
- Non-root container execution
- Distroless base image minimizes attack surface
- CGO disabled (no C dependency vulnerabilities)
- License headers enforced

**Missing**:
- No SAST/CodeQL scanning
- No container vulnerability scanning
- No dependency scanning (no Dependabot/Renovate)
- No secret detection (no Gitleaks/TruffleHog)
- No SBOM generation
- No image signing

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: All test type rules missing (unit, integration, E2E, contract)
- **Recommendation**: Generate rules with `/test-rules-generator` to capture:
  - Go test patterns (table-driven tests, `t.Run()`)
  - kubetest E2E framework usage
  - TLS test certificate generation patterns
  - Kind cluster setup for E2E

## Recommendations

### Priority 0 (Critical)

1. **Add test coverage generation and codecov integration**
   - Add `-coverprofile=coverage.out` to `make test-unit`
   - Add codecov GitHub Action with 70% project / 80% patch thresholds
   - Effort: 2-4 hours

2. **Add container vulnerability scanning**
   - Add Trivy filesystem scan + container image scan to PR workflow
   - Block PR on CRITICAL/HIGH vulnerabilities
   - Effort: 2-3 hours

3. **Write unit tests for `pkg/authn` and `app/options`**
   - `pkg/authn` handles OIDC and delegating auth — security-critical path
   - `app/options` parses CLI flags including deprecated ones — needs validation
   - Effort: 8-12 hours

### Priority 1 (High Value)

4. **Add PR-time OCP image build validation**
   - Add Dockerfile.ocp syntax validation or mock build step
   - Effort: 4-6 hours

5. **Add SAST scanning (gosec or CodeQL)**
   - Particularly important for a security proxy — gosec catches Go-specific security issues
   - Effort: 2-4 hours

6. **Create agent rules for AI-assisted development**
   - `.claude/rules/unit-tests.md` — Go test patterns, table-driven tests
   - `.claude/rules/e2e-tests.md` — kubetest framework, Kind cluster usage
   - Effort: 2-3 hours

7. **Add SBOM generation to image builds**
   - Use syft or cosign to generate SBOM alongside image publish
   - Effort: 2-3 hours

### Priority 2 (Nice-to-Have)

8. **Enable Dependabot or Renovate for Go dependency updates**
   - Automated PRs for dependency updates with CI validation
   - Effort: 1 hour

9. **Add pre-commit hooks**
   - License check, go vet, gofmt — catch issues before push
   - Effort: 1-2 hours

10. **Add fuzz testing for auth filters**
    - `pkg/filters` and `pkg/authz` handle untrusted input — fuzz testing catches edge cases
    - Effort: 4-6 hours

11. **Add Go module caching to CI**
    - Use `actions/cache` for Go modules — speeds up all 5 PR jobs
    - Effort: 30 minutes

12. **Add benchmark tests for proxy hot path**
    - `pkg/proxy` is in the request critical path — benchmark prevents performance regression
    - Effort: 4-6 hours

## Comparison to Gold Standards

| Dimension | kube-rbac-proxy | odh-dashboard | notebooks | kserve |
|-----------|:-:|:-:|:-:|:-:|
| Unit Tests | 6.5 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 8.0 | 9.0 | 8.0 | 9.5 |
| Build Integration | 5.0 | 8.0 | 7.0 | 7.0 |
| Image Testing | 4.5 | 7.0 | 9.0 | 6.0 |
| Coverage Tracking | 1.0 | 9.0 | 5.0 | 9.0 |
| CI/CD Automation | 8.5 | 9.0 | 8.0 | 9.0 |
| Agent Rules | 0.0 | 8.0 | 3.0 | 2.0 |
| **Overall** | **6.4** | **8.5** | **7.0** | **8.0** |

**Key Takeaway**: kube-rbac-proxy has a solid E2E test suite and CI pipeline but falls well behind gold standards on coverage tracking, security scanning, and image testing. For a security-critical component (RBAC authorization proxy), the lack of SAST and vulnerability scanning is the most concerning gap.

## File Paths Reference

| Category | File | Purpose |
|----------|------|---------|
| CI/CD | `.github/workflows/build.yml` | Main CI workflow (6 jobs) |
| CI Config | `.ci-operator.yaml` | OpenShift CI configuration |
| Linting | `.golangci.yaml` | golangci-lint v2 config |
| Build | `Dockerfile` | Upstream distroless image |
| Build | `Dockerfile.ocp` | OpenShift-specific multi-stage build |
| Build | `Makefile` | Build, test, and release targets |
| E2E | `test/e2e/main_test.go` | E2E test entry point (12 scenarios) |
| E2E Framework | `test/kubetest/` | Custom kubetest framework (~1,500 LOC) |
| E2E Config | `test/e2e/kind-config/kind-config.yaml` | Kind cluster configuration |
| Release | `scripts/publish.sh` | Multi-arch image publish to Quay |
| Version | `VERSION` | Current version (v0.21.1) |
| Owners | `OWNERS` | Reviewers and approvers |
