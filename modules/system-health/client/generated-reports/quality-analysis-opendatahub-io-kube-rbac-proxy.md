---
repository: "opendatahub-io/kube-rbac-proxy"
overall_score: 5.9
scorecard:
  - dimension: "Unit Tests"
    score: 6.0
    status: "Decent unit tests for core packages but not all packages covered"
  - dimension: "Integration/E2E"
    score: 7.5
    status: "Comprehensive E2E suite on Kind cluster with custom BDD-style framework"
  - dimension: "Build Integration"
    score: 3.0
    status: "No PR-time container build validation; Dockerfile.ocp not tested in CI"
  - dimension: "Image Testing"
    score: 3.0
    status: "No runtime image validation, no vulnerability scanning, no SBOM"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage generation, no codecov integration, no thresholds"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "Single well-structured workflow with concurrency control; missing caching"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No test coverage tracking or enforcement"
    impact: "Cannot detect coverage regressions; no visibility into untested code paths"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container image security scanning"
    impact: "Vulnerabilities in base images and dependencies go undetected until downstream"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "Dockerfile.ocp not tested in PR CI"
    impact: "OpenShift-specific build failures discovered only after merge in downstream Konflux/ART"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No SBOM generation or image signing"
    impact: "Supply chain compliance gaps; downstream consumers cannot verify provenance"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "Missing unit tests for authn, options, and main packages"
    impact: "Authentication config, CLI option parsing, and startup logic untested"
    severity: "MEDIUM"
    effort: "8-12 hours"
quick_wins:
  - title: "Add Trivy scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Immediate detection of known CVEs in base images and Go dependencies"
  - title: "Add Go test coverage reporting with codecov"
    effort: "2-3 hours"
    impact: "Visibility into coverage gaps, PR coverage deltas, and regression detection"
  - title: "Enable Go build caching in CI"
    effort: "30 minutes"
    impact: "Faster CI runs by caching Go module downloads and build artifacts"
  - title: "Add Dockerfile.ocp build step to PR workflow"
    effort: "1-2 hours"
    impact: "Catch OpenShift build failures before merge"
recommendations:
  priority_0:
    - "Add test coverage generation and codecov integration with minimum threshold (e.g., 40%)"
    - "Add Trivy container scanning for both Dockerfile and Dockerfile.ocp images"
    - "Add PR-time build validation for Dockerfile.ocp"
  priority_1:
    - "Add unit tests for pkg/authn, cmd/kube-rbac-proxy/app/options, and cmd/kube-rbac-proxy/app/sanitazion packages"
    - "Add SBOM generation using Syft or ko"
    - "Add CodeQL or gosec static security analysis"
    - "Create CLAUDE.md and .claude/rules/ for agent-assisted test development"
  priority_2:
    - "Add multi-architecture container build validation in CI"
    - "Add pre-commit hooks for local quality enforcement"
    - "Add Dependabot or Renovate for automated dependency updates"
    - "Add image startup validation test (container can start and respond to health probes)"
---

# Quality Analysis: kube-rbac-proxy (opendatahub-io fork)

## Executive Summary

- **Overall Score: 5.9/10**
- **Repository Type**: Go binary / Kubernetes RBAC proxy sidecar
- **Primary Language**: Go 1.25
- **Framework**: Kubernetes client-go, apiserver libraries
- **Version**: v0.21.1

**Key Strengths**: Well-structured E2E test suite with a custom BDD-style kubetest framework running on Kind clusters. The single CI workflow is well-organized with concurrency control and clean job separation. The E2E suite covers 12 distinct test scenarios including RBAC basics, TLS, HTTP/2, static authorizer, token masking, and hardcoded authorizer.

**Critical Gaps**: No test coverage tracking whatsoever. No container security scanning. The `Dockerfile.ocp` (the actual production artifact for OpenShift) is never built or validated in CI. Several core packages (`authn`, `options`, `sanitazion`) have zero unit tests. No agent rules exist for AI-assisted development.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.0/10 | Decent coverage of core packages (authz, filters, tls, proxy) but gaps in authn, options |
| Integration/E2E | 7.5/10 | Comprehensive E2E on Kind with 12 test scenarios; custom BDD kubetest framework |
| Build Integration | 3.0/10 | No PR-time Dockerfile.ocp build; no Konflux simulation; no image startup test |
| Image Testing | 3.0/10 | No vulnerability scanning, no SBOM, no runtime validation, no multi-arch CI test |
| Coverage Tracking | 1.0/10 | No coverage generation, no codecov, no thresholds, no PR reporting |
| CI/CD Automation | 7.0/10 | Well-structured single workflow with concurrency control; lacks caching & security jobs |
| Agent Rules | 0.0/10 | No CLAUDE.md, AGENTS.md, or .claude/ directory |

## Critical Gaps

### 1. No Test Coverage Tracking or Enforcement
- **Severity**: HIGH
- **Impact**: Cannot detect coverage regressions. No visibility into which code paths are untested. PRs can reduce coverage without any signal.
- **Current State**: `make test-unit` runs `go test -v -race -count=1` but does not generate coverage profiles.
- **Effort**: 2-4 hours
- **Fix**: Add `-coverprofile=coverage.out` to `go test`, upload to codecov, set minimum threshold.

### 2. No Container Image Security Scanning
- **Severity**: HIGH
- **Impact**: Vulnerabilities in `gcr.io/distroless/static:nonroot` (upstream Dockerfile) and `registry.ci.openshift.org/ocp/4.22:base-rhel9` (Dockerfile.ocp) go undetected until downstream scanning catches them.
- **Current State**: No Trivy, Snyk, Grype, or any scanner configured. No `.trivyignore`.
- **Effort**: 1-2 hours
- **Fix**: Add Trivy scan step after image build in CI workflow.

### 3. Dockerfile.ocp Not Tested in PR CI
- **Severity**: HIGH
- **Impact**: The `Dockerfile.ocp` is the actual production artifact used in OpenShift. Build failures in this file are only discovered post-merge in downstream Konflux/ART builds, creating expensive feedback cycles.
- **Current State**: Only the upstream `Dockerfile` is built (in the E2E job). `Dockerfile.ocp` uses different base images, build flags (`GOFLAGS="-mod=vendor"`, `GITHUB_URL=github.com/openshift/kube-rbac-proxy`), and a multi-stage build - none of this is validated in CI.
- **Effort**: 4-6 hours
- **Fix**: Add a CI job that builds `Dockerfile.ocp` (can use `docker build --target builder` to validate the Go build step without needing OCP base images).

### 4. Missing Unit Tests for Key Packages
- **Severity**: MEDIUM
- **Impact**: Authentication configuration (`pkg/authn/`), CLI option parsing (`cmd/kube-rbac-proxy/app/options/`), and input sanitization (`cmd/kube-rbac-proxy/app/sanitazion.go`) have zero unit tests.
- **Current State**: 8 test files covering 6 packages. 4 packages with source code have no tests at all.
- **Effort**: 8-12 hours

### 5. No SBOM Generation or Image Signing
- **Severity**: MEDIUM
- **Impact**: Supply chain compliance gaps. Downstream consumers (OCP) cannot verify image provenance from upstream CI.
- **Current State**: The `publish.sh` script builds multi-arch images and pushes manifests but has no SBOM or signing step.
- **Effort**: 2-4 hours

## Quick Wins

### 1. Add Go Test Coverage Reporting (2-3 hours)
```yaml
# Add to unit-tests job in build.yml
- name: Run unit tests with coverage
  run: |
    go test -v -race -count=1 -coverprofile=coverage.out $(go list ./... | grep -v /test/e2e)
    go tool cover -func=coverage.out

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v5
  with:
    files: coverage.out
    fail_ci_if_error: false
```

### 2. Add Trivy Scanning (1-2 hours)
```yaml
# Add new job to build.yml
container-scan:
  name: Container security scan
  runs-on: ubuntu-24.04
  needs: [build]
  steps:
  - uses: actions/checkout@v4
  - name: Build image
    run: VERSION=scan make container
  - name: Run Trivy
    uses: aquasecurity/trivy-action@master
    with:
      image-ref: 'quay.io/brancz/kube-rbac-proxy:scan'
      severity: 'CRITICAL,HIGH'
      exit-code: '1'
```

### 3. Enable Go Build Caching (30 minutes)
The `actions/setup-go` action already caches by default, but the workflow could benefit from explicit caching:
```yaml
- name: Setup Golang Environment
  uses: actions/setup-go@v6
  with:
    go-version: ${{ env.go-version }}
    cache: true  # Already default, but explicit is good
```

### 4. Build Dockerfile.ocp in PR (1-2 hours)
```yaml
build-ocp:
  name: Build OCP Dockerfile
  runs-on: ubuntu-24.04
  steps:
  - uses: actions/checkout@v4
  - name: Setup Go
    uses: actions/setup-go@v6
    with:
      go-version: ${{ env.go-version }}
  - name: Build binary with OCP flags
    run: |
      GOFLAGS="-mod=vendor" GITHUB_URL=github.com/openshift/kube-rbac-proxy make build
  - name: Validate Dockerfile.ocp syntax
    run: docker build --check -f Dockerfile.ocp .
```

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory**: Single workflow `build.yml` triggered on push and pull_request.

| Job | Trigger | Timeout | Purpose |
|-----|---------|---------|---------|
| check-license | push, PR | 3m | License header verification |
| generate | push, PR | 5m | Code generation + git diff check |
| lint | push, PR | 5m | golangci-lint via official action |
| build | push, PR | 5m | Binary build |
| unit-tests | push, PR | 10m | Unit test execution |
| e2e-tests | push, PR | 30m | E2E on Kind cluster |
| publish | push (non-fork) | 20m | Multi-arch image build + push to Quay |

**Strengths**:
- Concurrency control with `cancel-in-progress: true` prevents stale runs
- All jobs run on PRs (both unit and E2E)
- Pinned action versions with SHA hashes (security best practice)
- Clean job separation with appropriate timeouts
- E2E tests run against a real Kind cluster

**Weaknesses**:
- No Go module caching beyond default setup-go behavior
- No parallel test execution configured
- No test result reporting (JUnit XML, etc.)
- No coverage artifacts
- Jobs don't declare dependencies (all run independently except publish)
- No CODEOWNERS file for review enforcement
- No periodic/scheduled workflows

### Test Coverage

**Unit Tests (6.0/10)**:

| Package | Test File | Test Lines | Source Lines | Ratio |
|---------|-----------|------------|-------------|-------|
| `pkg/filters` | `auth_test.go`, `path_test.go` | 468 | 173 | 2.7:1 |
| `pkg/tls` | `reloader_test.go` | 355 | 123 | 2.9:1 |
| `pkg/proxy` | `proxy_test.go` | 234 | 145 | 1.6:1 |
| `pkg/authz` | `auth_test.go` | 159 | 153 | 1.0:1 |
| `cmd/.../app` | `kube-rbac-proxy_test.go`, `transport_test.go` | 325 | 691 | 0.5:1 |
| `pkg/hardcodedauthorizer` | `metrics_test.go` | 67 | 58 | 1.2:1 |
| `pkg/authn` | **NONE** | 0 | 247 | 0:1 |
| `cmd/.../options` | **NONE** | 0 | 281 | 0:1 |
| `cmd/.../sanitazion.go` | **NONE** | 0 | 82 | 0:1 |

**Aggregate**: 1,608 test lines / 1,953 source lines = **0.82:1 ratio** (for tested packages: ~1.7:1, overall including untested: 0.82:1)

**Test Quality Assessment**:
- Good table-driven tests with descriptive names
- Uses `httptest.NewRecorder` for HTTP handler testing
- Tests cover authentication, authorization, and TLS scenarios
- The `reloader_test.go` uses a step-based pattern with `stepFunc`/`checkFunc` - creative but unusual
- Race detection enabled (`-race` flag)

**E2E Tests (7.5/10)**:

Custom BDD-style `kubetest` framework with Given/When/Then pattern:

| Test Suite | Scenarios | Description |
|-----------|-----------|-------------|
| Basics | 8+ | NoRBAC, token auth, client certs, token audience, path allow/ignore |
| H2CUpstream | 1+ | HTTP/2 cleartext upstream proxy |
| ClientCertificates | 1+ | mTLS validation |
| TLS | 1+ | TLS configuration |
| StaticAuthorizer | 4 | Resource/non-resource static authorization rules |
| HTTP2 | 1+ | HTTP/2 protocol support |
| HardcodedAuthz | 1+ | Hardcoded authorizer mode |
| TokenMasking | 1+ | Token masking in logs |
| Flags | 1+ | CLI flag validation |

**E2E Infrastructure**:
- Uses Kind (v0.30.0) with custom cluster config
- Builds container image and loads into Kind
- Tests deploy kube-rbac-proxy pods and validate via curl from client pods
- Custom `kubetest` framework (1,463 lines) provides Kubernetes test utilities
- Proper cleanup with `CleanUp` functions

### Code Quality

**Linting (6.0/10)**:
- golangci-lint configured via `.golangci.yaml` (v2 format)
- Uses preset exclusions (comments, common false positives, legacy, std-error-handling)
- Test directories excluded from linting (may miss test code issues)
- No custom linters enabled beyond defaults
- Missing: `gocritic`, `gocyclo`, `errcheck` strict mode, `exhaustive`

**Pre-commit Hooks**: None configured. No `.pre-commit-config.yaml`.

**Static Analysis**: None beyond golangci-lint defaults. No CodeQL, gosec, or Semgrep.

### Container Images

**Dockerfiles**:

| File | Base Image | Multi-stage | Purpose |
|------|-----------|-------------|---------|
| `Dockerfile` | `gcr.io/distroless/static:nonroot-$GOARCH` | No (COPY only) | Upstream release |
| `Dockerfile.ocp` | `ocp/builder:rhel-9-golang-1.25-openshift-4.22` + `ocp/4.22:base-rhel9` | Yes | OpenShift/downstream |

**Observations**:
- Upstream `Dockerfile` is minimal - just copies a pre-built binary (no multi-stage build)
- `Dockerfile.ocp` properly uses multi-stage build with vendor mode
- Both run as non-root user (good security practice)
- Multi-architecture support: 5 architectures (amd64, arm, arm64, ppc64le, s390x) in publish script
- No health check defined in either Dockerfile
- No LABEL for version/build metadata in upstream Dockerfile

**Security**:
- No container scanning (Trivy, Snyk, Grype)
- No SBOM generation
- No image signing or attestation
- No `.trivyignore` or `.snyk` configuration
- No Dependabot/Renovate configured
- No secret detection (Gitleaks, TruffleHog)

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **Coverage**: No test type rules exist
- **Quality**: N/A
- **Gaps**: Everything - no guidance for AI agents on test patterns, project conventions, or quality standards
- **Recommendation**: Generate rules with `/test-rules-generator` covering unit test patterns (table-driven Go tests with httptest), E2E test patterns (kubetest BDD framework), and project conventions

## Recommendations

### Priority 0 (Critical)

1. **Add test coverage generation and codecov integration**
   - Add `-coverprofile=coverage.out` to `make test-unit`
   - Integrate codecov GitHub Action
   - Set minimum coverage threshold (suggest 40% initially, increase over time)
   - Estimated effort: 2-4 hours

2. **Add container image security scanning**
   - Add Trivy scanning for both Dockerfile and Dockerfile.ocp built images
   - Set `exit-code: 1` for CRITICAL/HIGH severity
   - Estimated effort: 1-2 hours

3. **Validate Dockerfile.ocp in PR CI**
   - Add a job that builds the Go binary with OCP-specific flags (`GOFLAGS="-mod=vendor"`)
   - Validate Dockerfile.ocp syntax
   - Estimated effort: 4-6 hours

### Priority 1 (High Value)

4. **Add unit tests for untested packages**
   - `pkg/authn/`: Test OIDC config parsing, delegating authenticator setup
   - `cmd/kube-rbac-proxy/app/options/`: Test CLI option validation and defaults
   - `cmd/kube-rbac-proxy/app/sanitazion.go`: Test input sanitization logic
   - Estimated effort: 8-12 hours

5. **Add static security analysis**
   - Add CodeQL workflow for Go
   - Or add gosec as a golangci-lint plugin
   - Estimated effort: 2-3 hours

6. **Create agent rules for test automation**
   - Add `CLAUDE.md` with project overview and conventions
   - Add `.claude/rules/unit-tests.md` documenting table-driven test patterns
   - Add `.claude/rules/e2e-tests.md` documenting kubetest BDD framework usage
   - Estimated effort: 2-3 hours

### Priority 2 (Nice-to-Have)

7. **Add multi-architecture build validation in CI**
   - Validate crossbuild for at least amd64 and arm64 on PRs
   - Estimated effort: 1-2 hours

8. **Add pre-commit hooks**
   - Configure `.pre-commit-config.yaml` with golangci-lint, gofmt, license check
   - Estimated effort: 1-2 hours

9. **Configure Dependabot or Renovate**
   - Automated dependency updates for Go modules and GitHub Actions
   - Estimated effort: 30 minutes

10. **Add image startup validation**
    - Test that the built container can start and respond to a health probe
    - Estimated effort: 2-3 hours

## Comparison to Gold Standards

| Practice | kube-rbac-proxy | odh-dashboard | notebooks | kserve |
|----------|-----------------|---------------|-----------|--------|
| Unit tests | Partial (6 of 10 packages) | Comprehensive | N/A | Comprehensive |
| E2E tests | Kind-based, 12 scenarios | Cypress + API | Image validation | Multi-version |
| Coverage tracking | None | Codecov + enforcement | N/A | Codecov + thresholds |
| Container scanning | None | Trivy | Trivy | Trivy |
| SBOM | None | Yes | Yes | Yes |
| Image signing | None | Cosign | Cosign | Cosign |
| Pre-commit hooks | None | Yes | Yes | Partial |
| Static analysis | golangci-lint only | ESLint + CodeQL | N/A | golangci-lint + CodeQL |
| Agent rules | None | Comprehensive | Partial | None |
| CI concurrency | Yes | Yes | Yes | Yes |
| Multi-arch | Build script (5 arch) | No | Yes | Yes |
| PR build validation | Binary only | Full image + deploy | Image build | Image + operator |

## File Paths Reference

| Category | Path | Purpose |
|----------|------|---------|
| CI Workflow | `.github/workflows/build.yml` | All CI/CD jobs |
| Makefile | `Makefile` | Build, test, container targets |
| Upstream Dockerfile | `Dockerfile` | Distroless-based release image |
| OCP Dockerfile | `Dockerfile.ocp` | OpenShift multi-stage build |
| Lint config | `.golangci.yaml` | golangci-lint v2 configuration |
| Unit tests | `pkg/*/\*_test.go`, `cmd/*/\*_test.go` | 8 test files, 1,678 lines |
| E2E tests | `test/e2e/` | 8 test files, 1,194 lines |
| Test framework | `test/kubetest/` | Custom BDD kubetest, 1,463 lines |
| Kind config | `test/e2e/kind-config/kind-config.yaml` | Kind cluster configuration |
| Go module | `go.mod` | Go 1.25.7, K8s v0.35.2 deps |
| Version | `VERSION` | v0.21.1 |
| Publish script | `scripts/publish.sh` | Multi-arch build + push |
| Examples | `examples/` | 11 usage examples |
