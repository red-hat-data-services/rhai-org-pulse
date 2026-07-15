---
repository: "opendatahub-io/kube-rbac-proxy"
overall_score: 5.9
scorecard:
  - dimension: "Unit Tests"
    score: 6.5
    status: "30 test functions across 9 files; 2,443 test LOC vs 5,062 source LOC (48% test-to-code ratio); table-driven tests with go-cmp; no subtests in some packages"
  - dimension: "Integration/E2E"
    score: 7.5
    status: "Comprehensive Kind-based E2E suite covering 13 scenarios (Basics, TLS, HTTP2, StaticAuth, TokenMasking, etc.); custom kubetest framework; but not run in CI"
  - dimension: "Build Integration"
    score: 5.0
    status: "Konflux/Tekton PR builds via odh-konflux-central; FIPS compliance check on PRs; no image startup validation or integration testing in PR workflow"
  - dimension: "Image Testing"
    score: 4.0
    status: "Three Dockerfiles (upstream, Red Hat/FIPS, OCP); FIPS compliance check-payload scan; no runtime validation, no vulnerability scanning, no SBOM"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage generation, no codecov/coveralls, no coverage thresholds, no PR coverage reporting"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "5 GitHub Actions workflows with concurrency control and pinned actions; Tekton/Konflux pipelines; but E2E tests are manual-only, no caching"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules, no test automation guidance for AI agents"
critical_gaps:
  - title: "No test coverage tracking or enforcement"
    impact: "Cannot measure or enforce test coverage; regression risk unknown; no visibility into untested code paths"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "E2E tests not automated in CI"
    impact: "E2E suite exists but is never run automatically; regressions can ship without detection"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No container vulnerability scanning"
    impact: "CVEs in base images or dependencies go undetected until production"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No image runtime validation in PR builds"
    impact: "Image startup failures and runtime issues not caught until deployment"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No agent rules for test automation"
    impact: "AI-assisted development produces inconsistent test patterns; no guardrails for test quality"
    severity: "LOW"
    effort: "2-3 hours"
quick_wins:
  - title: "Add coverage generation to unit test workflow"
    effort: "2-3 hours"
    impact: "Immediate visibility into test coverage gaps; enables future threshold enforcement"
  - title: "Add Trivy scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Early detection of security vulnerabilities in container images and dependencies"
  - title: "Enable Go test caching in CI"
    effort: "30 minutes"
    impact: "Faster CI runs by caching Go build and test artifacts"
  - title: "Add pre-commit hooks for license check and lint"
    effort: "1-2 hours"
    impact: "Catch formatting and license issues before push, reducing CI failures"
recommendations:
  priority_0:
    - "Add codecov integration with coverage threshold enforcement (e.g., 60% minimum, no regression)"
    - "Automate E2E tests in CI using Kind cluster (Makefile targets already exist)"
    - "Add Trivy container scanning to PR and push workflows"
  priority_1:
    - "Add image startup validation after Konflux builds (container healthcheck test)"
    - "Create .claude/rules/ with unit test and E2E test patterns for AI-assisted development"
    - "Add dependency scanning (Dependabot or Renovate) for Go modules"
  priority_2:
    - "Add SBOM generation and image signing/attestation"
    - "Implement pre-commit hooks for license, lint, and format checks"
    - "Add performance/benchmark tests for proxy throughput and latency"
---

# Quality Analysis: kube-rbac-proxy (opendatahub-io fork)

## Executive Summary

- **Overall Score: 5.9/10**
- **Repository Type**: Go-based Kubernetes RBAC proxy (security infrastructure component)
- **Primary Language**: Go 1.26
- **Key Strengths**: Well-structured E2E test suite with custom kubetest framework, FIPS compliance checking, CodeQL SAST integration, Konflux/Tekton pipeline integration, good concurrency controls on CI workflows
- **Critical Gaps**: No coverage tracking at all, E2E tests exist but are never run in CI, no container vulnerability scanning, no agent rules
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.5/10 | 30 test functions, 48% test-to-code ratio, table-driven but patchy coverage |
| Integration/E2E | 7.5/10 | Comprehensive Kind-based E2E with 13 scenarios, but NOT automated in CI |
| **Build Integration** | **5.0/10** | **Konflux PR builds exist; FIPS scan runs; no image validation** |
| Image Testing | 4.0/10 | 3 Dockerfiles, FIPS scan only, no vulnerability scanning or runtime tests |
| Coverage Tracking | 1.0/10 | No coverage generation, no tooling, no thresholds |
| CI/CD Automation | 7.0/10 | 5 GHA workflows + Tekton; good concurrency; E2E is manual |
| Agent Rules | 0.0/10 | No CLAUDE.md, no .claude/ directory, no test creation rules |

## Critical Gaps

### 1. No Test Coverage Tracking or Enforcement
- **Severity**: HIGH
- **Impact**: Cannot measure or enforce test coverage. No visibility into which code paths are untested. Regressions can be introduced without anyone knowing coverage decreased.
- **Current State**: `make test-unit` runs `go test -v -race -count=1` but does NOT generate coverage profiles. No codecov, coveralls, or any coverage reporting exists.
- **Effort**: 4-6 hours

### 2. E2E Tests Not Automated in CI
- **Severity**: HIGH
- **Impact**: The repository has a comprehensive E2E suite (13 scenarios testing Basics, TLS, HTTP2, StaticAuthorizer, TokenMasking, etc.) with a custom `kubetest` framework. However, these tests are NEVER run in CI. They require manual execution via `make test-local` which creates a Kind cluster. Regressions in RBAC proxy behavior can ship to production undetected.
- **Current State**: Only `make test-unit` runs in GitHub Actions. The E2E framework is well-built but purely local.
- **Effort**: 8-12 hours (add Kind cluster setup job to GHA)

### 3. No Container Vulnerability Scanning
- **Severity**: HIGH
- **Impact**: Three Dockerfiles produce images based on `gcr.io/distroless/static`, `ubi9/ubi-minimal`, and OCP base images. No Trivy, Snyk, Grype, or any vulnerability scanner runs on these images. CVEs in base images or Go dependencies go undetected.
- **Current State**: FIPS compliance scanning exists (check-payload) but this checks FIPS symbol compliance, NOT vulnerabilities.
- **Effort**: 2-4 hours

### 4. No Image Runtime Validation
- **Severity**: MEDIUM
- **Impact**: PR builds via Konflux produce container images, but there's no validation that the image starts correctly, responds to health probes, or functions as a proxy.
- **Current State**: FIPS workflow builds `Dockerfile.redhat` and runs check-payload, but doesn't start the container.
- **Effort**: 4-6 hours

### 5. No Agent Rules
- **Severity**: LOW
- **Impact**: AI-assisted development will produce inconsistent test patterns. No guardrails or guidelines for agents writing tests.
- **Current State**: No `.claude/` directory, no `CLAUDE.md`, no test creation rules.
- **Effort**: 2-3 hours

## Quick Wins

### 1. Add Coverage Generation to Unit Tests (2-3 hours)
Change the test-unit target in the Makefile and workflow:
```makefile
test-unit:
	go test -v -race -count=1 -coverprofile=coverage.out $(PKGS)
	go tool cover -func=coverage.out
```

Add codecov upload step to `unit-tests.yml`:
```yaml
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: coverage.out
          fail_ci_if_error: false
```

### 2. Add Trivy Container Scanning (1-2 hours)
Add a new step to the FIPS compliance workflow or create a new workflow:
```yaml
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: kube-rbac-proxy:fips-test
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'
      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'
```

### 3. Enable Go Build Caching (30 minutes)
The `setup-go` action already caches modules by default, but explicitly enabling build cache improves speed:
```yaml
      - name: Setup Go
        uses: actions/setup-go@v5
        with:
          go-version-file: go.mod
          cache: true
```

### 4. Add Pre-commit Hooks (1-2 hours)
Create `.pre-commit-config.yaml`:
```yaml
repos:
  - repo: local
    hooks:
      - id: check-license
        name: Check license headers
        entry: ./scripts/check_license.sh
        language: script
        types: [go]
      - id: golangci-lint
        name: Go lint
        entry: golangci-lint run
        language: system
        types: [go]
```

## Detailed Findings

### CI/CD Pipeline

**Workflows (5 total)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `unit-tests.yml` | PR + push to main/master | License check, code gen drift, lint (golangci-lint), unit tests |
| `codeql.yml` | PR + push + weekly schedule | Go CodeQL security analysis |
| `fips-compliance.yml` | PR only | Build Red Hat FIPS image, run check-payload scanner |
| `stale.yml` | Daily cron | Mark stale issues/PRs after 180 days |
| `labeler.yml` | PR events | Auto-label PRs based on file paths |

**Strengths**:
- All workflows use pinned action SHAs (e.g., `actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5`)
- Concurrency control with `cancel-in-progress: true` on all build workflows
- Reasonable timeouts (3-15 minutes)
- Minimal permissions (principle of least privilege)

**Tekton/Konflux Pipelines (2)**:
- `odh-kube-rbac-proxy-pull-request.yaml` - Builds multi-arch image on PR using `Dockerfile.redhat`
- `odh-kube-rbac-proxy-push.yaml` - Builds stable image on push to master
- Both use centralized pipeline from `odh-konflux-central`

**Gaps**:
- No E2E test job in any workflow
- No Go test caching explicitly configured
- No artifact upload (test results, coverage)
- No smoke test after Konflux image build

### Test Coverage

**Unit Tests (9 files, 30 test functions, 2,443 LOC)**:

| Package | Test File | Functions | Focus |
|---------|-----------|-----------|-------|
| `pkg/authz` | `endpoints_test.go` | 11 | Endpoint authorization rules |
| `pkg/authz` | `auth_test.go` | 1 | Auth config validation |
| `cmd/kube-rbac-proxy/app` | `transport_test.go` | 5 | HTTP transport configuration |
| `pkg/filters` | `auth_test.go` | 4 | Auth filter chain |
| `pkg/proxy` | `proxy_test.go` | 3 | Proxy authorizer attribute generation |
| `pkg/tls` | `reloader_test.go` | 2 | TLS certificate reloading |
| `pkg/hardcodedauthorizer` | `metrics_test.go` | 1 | Metrics recording |
| `pkg/filters` | `path_test.go` | 1 | Path filtering |
| `cmd/kube-rbac-proxy/app` | `kube-rbac-proxy_test.go` | 1 | App initialization |
| `test/e2e` | `main_test.go` | 1 | E2E test entry point |

**Test Quality**: Tests use table-driven patterns with `go-cmp` for comparisons. Good use of `httptest` for HTTP testing. Race detection enabled (`-race` flag).

**Test-to-Code Ratio**: 2,443 test LOC / 5,062 source LOC = **48%** (moderate - industry target is 60-100%)

**E2E Tests (2,750 LOC including framework)**:
- **13 test scenarios**: Basics, UpstreamTimeout, H2CUpstream, ClientCertificates, TokenAudience, AllowPath, IgnorePath, TLS, StaticAuthorizer, HTTP2, HardcodedAuthz, Flags, TokenMasking
- **Custom `kubetest` framework**: Provides test templating, TLS setup, Kubernetes resource management
- **Kind cluster**: Uses Kind with custom config for local testing
- **NOT automated**: Requires `make test-local` which creates a Kind cluster manually

### Code Quality

**Linting**:
- `golangci-lint` configured via `.golangci.yaml` (v2 format)
- Uses exclusion presets: `comments`, `common-false-positives`, `legacy`, `std-error-handling`
- Excludes `test/`, `third_party`, `examples` directories
- Runs in CI via `golangci/golangci-lint-action@v7`
- No additional linters explicitly enabled beyond defaults

**Static Analysis**:
- CodeQL for Go runs on PRs, pushes, and weekly schedule
- No gosec, Semgrep, or other SAST tools

**Missing**:
- No pre-commit hooks
- No gitleaks/secret detection
- No dependency scanning (Dependabot/Renovate)

### Container Images

**Three Dockerfiles**:

| File | Base Image | Purpose | FIPS |
|------|-----------|---------|------|
| `Dockerfile` | `gcr.io/distroless/static:nonroot` | Upstream/community image | No |
| `Dockerfile.redhat` | `ubi9/go-toolset:1.26` + `ubi9/ubi-minimal` | Red Hat/ODH image | Yes (`strictfipsruntime`) |
| `Dockerfile.ocp` | `ocp/builder:rhel-9-golang-1.26` + `ocp/4.22:base-rhel9` | OpenShift image | No |

**Strengths**:
- Multi-stage builds in Red Hat and OCP Dockerfiles
- Non-root user (65532/65534)
- FIPS compliance with `GOEXPERIMENT=strictfipsruntime` and `GOFLAGS=-tags=strictfipsruntime`
- Vendor at build time (`go mod vendor`) for air-gapped builds
- FIPS compliance check via `check-payload` tool in CI

**Gaps**:
- No vulnerability scanning (Trivy, Snyk, Grype)
- No SBOM generation (Syft, CycloneDX)
- No image signing/attestation (Cosign, Sigstore)
- No runtime validation (container starts, healthcheck)
- Multi-arch support defined in Makefile (`ALL_ARCH=amd64 arm arm64 ppc64le s390x`) but not tested in CI

### Security

**Strengths**:
- CodeQL running on schedule and PRs
- FIPS compliance checking
- Pinned action SHAs in all workflows
- Non-root container user
- License header enforcement

**Gaps**:
- No container vulnerability scanning
- No dependency scanning/auto-update
- No secret detection (gitleaks)
- No SBOM generation
- No image signing

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None - no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: No test automation guidance, no coding standards for AI agents, no test pattern documentation
- **Recommendation**: Generate rules with `/test-rules-generator` to cover:
  - Unit test patterns (table-driven Go tests, httptest usage)
  - E2E test patterns (kubetest framework usage)
  - RBAC/auth test patterns specific to this project

## Recommendations

### Priority 0 (Critical)

1. **Add codecov integration with coverage threshold enforcement**
   - Generate `coverage.out` in unit test Makefile target
   - Add codecov upload step to `unit-tests.yml`
   - Set minimum threshold (e.g., 60%) and no-regression policy
   - Effort: 4-6 hours

2. **Automate E2E tests in CI**
   - Add a GitHub Actions job using Kind to run E2E tests
   - The Makefile already has `test-local-setup` and `kind-create-cluster` targets
   - Run on PR merges to main (too slow for every PR push)
   - Effort: 8-12 hours

3. **Add container vulnerability scanning**
   - Add Trivy action to scan the FIPS-built image
   - Upload results as SARIF to GitHub Security tab
   - Set severity threshold (CRITICAL, HIGH)
   - Effort: 2-4 hours

### Priority 1 (High Value)

4. **Add image startup validation**
   - After FIPS image build, run the container and verify it starts
   - Test basic proxy functionality (healthcheck endpoint)
   - Effort: 4-6 hours

5. **Create agent rules for test patterns**
   - Generate `.claude/rules/` with unit test and E2E test guidelines
   - Document kubetest framework usage patterns
   - Use `/test-rules-generator` skill
   - Effort: 2-3 hours

6. **Add dependency scanning**
   - Enable Dependabot or Renovate for Go module updates
   - Configure security-only updates for critical dependencies
   - Effort: 1-2 hours

### Priority 2 (Nice-to-Have)

7. **Add SBOM generation and image signing**
   - Generate CycloneDX or SPDX SBOM during Konflux builds
   - Sign images with Cosign/Sigstore
   - Effort: 4-8 hours

8. **Add pre-commit hooks**
   - License check, golangci-lint, go fmt
   - Catch issues before push
   - Effort: 1-2 hours

9. **Add benchmark tests for proxy performance**
   - Measure proxy throughput, latency, and resource usage
   - Detect performance regressions
   - Effort: 8-12 hours

## Comparison to Gold Standards

| Dimension | kube-rbac-proxy | odh-dashboard | notebooks | kserve |
|-----------|----------------|---------------|-----------|--------|
| Unit Tests | 6.5 - 48% ratio, no coverage | 9.0 - Jest + high coverage | 7.0 - Jupyter tests | 8.5 - Go + coverage |
| Integration/E2E | 7.5 - Good suite, NOT in CI | 9.0 - Cypress + CI | 8.0 - Image validation | 9.0 - Multi-version E2E |
| Build Integration | 5.0 - Konflux + FIPS only | 8.5 - Full build matrix | 7.5 - Multi-arch builds | 8.0 - Full matrix |
| Image Testing | 4.0 - FIPS scan only | 7.5 - Container tests | 9.5 - 5-layer validation | 7.0 - Image tests |
| Coverage Tracking | 1.0 - None | 9.0 - Codecov enforced | 6.0 - Basic coverage | 9.0 - Enforced thresholds |
| CI/CD Automation | 7.0 - Good but incomplete | 9.0 - Comprehensive | 8.5 - Well-automated | 9.0 - Full automation |
| Agent Rules | 0.0 - None | 8.0 - Comprehensive rules | 2.0 - Basic | 3.0 - Minimal |
| **Overall** | **5.9** | **8.6** | **7.5** | **8.0** |

## File Paths Reference

### CI/CD Configuration
- `.github/workflows/unit-tests.yml` - Unit tests, lint, license, code gen
- `.github/workflows/codeql.yml` - CodeQL security scanning
- `.github/workflows/fips-compliance.yml` - FIPS compliance checking
- `.github/workflows/stale.yml` - Stale issue/PR management
- `.github/workflows/labeler.yml` - PR auto-labeling
- `.tekton/odh-kube-rbac-proxy-pull-request.yaml` - Konflux PR pipeline
- `.tekton/odh-kube-rbac-proxy-push.yaml` - Konflux push pipeline
- `.ci-operator.yaml` - OpenShift CI operator config

### Testing
- `test/e2e/` - E2E test suite (13 scenarios)
- `test/kubetest/` - Custom test framework
- `test/e2e/kind-config/` - Kind cluster configuration
- `pkg/*_test.go` - Unit tests per package
- `cmd/kube-rbac-proxy/app/*_test.go` - App-level tests

### Build
- `Dockerfile` - Upstream community image
- `Dockerfile.redhat` - Red Hat/ODH FIPS image
- `Dockerfile.ocp` - OpenShift image
- `Makefile` - Build, test, and release targets

### Code Quality
- `.golangci.yaml` - Linter configuration
- `scripts/check_license.sh` - License header checker
