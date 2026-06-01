---
repository: "red-hat-data-services/kube-rbac-proxy"
overall_score: 6.3
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Good unit tests for core packages (authz, proxy, filters, TLS); authn package untested"
  - dimension: "Integration/E2E"
    score: 7.5
    status: "Comprehensive E2E suite with Kind cluster; 13 test suites covering RBAC, TLS, tokens, paths, HTTP/2"
  - dimension: "Build Integration"
    score: 5.0
    status: "FIPS compliance check on PR; no PR-time Konflux simulation; Tekton pipelines on-demand only"
  - dimension: "Image Testing"
    score: 4.0
    status: "4 Dockerfiles (upstream, OCP, Konflux, Red Hat); no runtime validation or startup testing"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "No codecov/coveralls integration; no coverage thresholds; no PR coverage reporting"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "Well-structured PR workflows with concurrency control; CodeQL scanning; FIPS compliance; but E2E not automated in CI"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules or test automation guidance"
critical_gaps:
  - title: "No test coverage tracking or enforcement"
    impact: "Cannot measure or enforce test coverage; regressions go undetected; no visibility into untested code"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "E2E tests not automated in CI"
    impact: "E2E tests require manual Kind cluster setup; not executed on PRs; regressions in proxy behavior may ship undetected"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No container image runtime validation"
    impact: "Images are built but never tested for startup, health checks, or runtime correctness before merge"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "authn package has zero test coverage"
    impact: "Authentication logic (OIDC, delegating authn) is completely untested; security-critical code path"
    severity: "HIGH"
    effort: "6-8 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI-generated code has no framework-specific guidance, test patterns, or quality gates"
    severity: "MEDIUM"
    effort: "3-4 hours"
quick_wins:
  - title: "Add codecov integration with coverage thresholds"
    effort: "2-4 hours"
    impact: "Immediate visibility into test coverage; enforce minimum thresholds on PRs"
  - title: "Add -race and -coverprofile flags to unit test Makefile target"
    effort: "30 minutes"
    impact: "Race condition detection (already has -race) and coverage data generation"
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Detect known CVEs in container images before merge"
  - title: "Create basic CLAUDE.md with test patterns"
    effort: "2-3 hours"
    impact: "Improve AI-generated code quality with project-specific guidance"
recommendations:
  priority_0:
    - "Add codecov/coveralls integration with minimum coverage thresholds (target: 60% initially, 80% over time)"
    - "Automate E2E tests in CI using Kind cluster (the infrastructure already exists in Makefile)"
    - "Add unit tests for pkg/authn (OIDC, delegating authentication) — security-critical untested code"
  priority_1:
    - "Add container image runtime validation (startup test, health check) for all 4 Dockerfiles"
    - "Add Trivy/Snyk scanning to PR workflow for vulnerability detection"
    - "Create .claude/rules/ with unit test and E2E test patterns"
    - "Add pre-commit hooks for linting and license checks"
  priority_2:
    - "Add unit tests for cmd/kube-rbac-proxy/app/options and sanitazion packages"
    - "Enable additional golangci-lint checks (currently using default exclusions only)"
    - "Add SBOM generation to container builds"
    - "Add dependency scanning (Dependabot or Renovate)"
---

# Quality Analysis: kube-rbac-proxy

## Executive Summary

- **Overall Score: 6.3/10**
- **Repository Type**: Go Kubernetes RBAC proxy (security infrastructure component)
- **Primary Language**: Go 1.25
- **Key Strengths**: Comprehensive E2E test framework with Kind cluster support, well-structured CI with concurrency control, FIPS compliance validation, CodeQL SAST scanning, multi-architecture builds (4 Dockerfiles for different build targets)
- **Critical Gaps**: No test coverage tracking, E2E tests not automated in CI, authentication package entirely untested, no container runtime validation
- **Agent Rules Status**: Missing — no CLAUDE.md, no .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.0/10 | Good coverage of core packages; authn untested |
| Integration/E2E | 7.5/10 | Comprehensive E2E suite; not automated in CI |
| Build Integration | 5.0/10 | FIPS check on PR; Konflux pipeline on-demand only |
| Image Testing | 4.0/10 | 4 Dockerfiles; no runtime validation |
| Coverage Tracking | 2.0/10 | No coverage tooling at all |
| CI/CD Automation | 7.0/10 | Good structure; E2E gap |
| Agent Rules | 0.0/10 | None present |

## Critical Gaps

### 1. No Test Coverage Tracking or Enforcement
- **Impact**: Cannot measure test coverage, detect regressions, or enforce standards on PRs
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No `.codecov.yml`, no `coveralls` config, no `-coverprofile` flag in CI, no coverage reports on PRs. The `make test-unit` target runs `go test -v -race -count=1` but generates no coverage data.

### 2. E2E Tests Not Automated in CI
- **Impact**: The comprehensive E2E test suite (13 test scenarios across basics, TLS, RBAC, tokens, HTTP/2, path filtering, static auth, hardcoded auth, token masking, flags) exists but only runs manually via `make test-local` which requires Kind cluster creation.
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: The `unit-tests.yml` workflow only runs `make test-unit`. No CI workflow runs `make test-e2e` or `make test-local`. The Kind cluster config and E2E infrastructure (`test/kubetest/`) is mature but unused in CI.

### 3. No Container Image Runtime Validation
- **Impact**: 4 Dockerfiles build images but none are tested for correct startup, entrypoint behavior, or health
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The FIPS compliance workflow builds `Dockerfile.redhat` and runs `check-payload`, but this only validates FIPS crypto compliance, not runtime correctness. No smoke test verifies the binary actually starts and listens on port 8080.

### 4. Authentication Package Has Zero Test Coverage
- **Impact**: `pkg/authn/` (OIDC config, delegating authentication) is a security-critical package with 0 test files
- **Severity**: HIGH
- **Effort**: 6-8 hours
- **Details**: Files `oidc.go` (96 lines), `delegating.go` (88 lines), `config.go` (63 lines) have no corresponding `_test.go` files. For a security proxy, this is a significant risk.

### 5. No Agent Rules for AI-Assisted Development
- **Impact**: No guidance for AI tools generating code or tests
- **Severity**: MEDIUM
- **Effort**: 3-4 hours
- **Details**: No `CLAUDE.md`, `AGENTS.md`, `.claude/` directory, or `.claude/rules/` test creation rules.

## Quick Wins

### 1. Add Coverage Generation to Unit Test Target (30 minutes)
```makefile
test-unit:
	go test -v -race -count=1 -coverprofile=coverage.out $(PKGS)
	go tool cover -func=coverage.out
```

### 2. Add Codecov Integration (2-4 hours)
Create `.codecov.yml`:
```yaml
coverage:
  status:
    project:
      default:
        target: 60%
        threshold: 5%
    patch:
      default:
        target: 70%
```

Update `unit-tests.yml` to upload coverage:
```yaml
      - name: Run unit tests
        run: make test-unit
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: ./coverage.out
```

### 3. Add Trivy Scanning to PR Workflow (1-2 hours)
```yaml
  trivy-scan:
    name: Container vulnerability scan
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -f Dockerfile.redhat -t kube-rbac-proxy:scan .
      - name: Run Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'kube-rbac-proxy:scan'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
```

### 4. Create Basic CLAUDE.md (2-3 hours)
Add project-specific guidance for AI-assisted development with test patterns, coding standards, and quality gates.

## Detailed Findings

### CI/CD Pipeline

**Workflows (5 total):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `unit-tests.yml` | PR + push | License check, code gen verification, lint (golangci-lint), unit tests |
| `codeql.yml` | PR + push + weekly cron | CodeQL SAST analysis for Go |
| `fips-compliance.yml` | PR only | Build `Dockerfile.redhat` and run `check-payload` FIPS scan |
| `labeler.yml` | PR | Auto-label PRs |
| `stale.yml` | Daily cron | Mark stale issues/PRs (180 days) |

**Strengths:**
- Concurrency control on all workflows (`cancel-in-progress: true`)
- Pinned action versions with commit SHA hashes (security best practice)
- Timeout limits on all jobs (3-15 minutes)
- Minimal permissions (principle of least privilege)
- CodeQL runs on schedule + PRs (covers both immediate and ongoing analysis)

**Gaps:**
- No E2E testing in any workflow
- No container build validation (except FIPS-specific check)
- No caching of Go modules in CI (setup-go handles this via `go-version-file`)

### Test Coverage

**Unit Tests (9 test files, 2,443 lines of test code):**

| Package | Test File | Lines | Quality |
|---------|-----------|-------|---------|
| `pkg/authz` | `auth_test.go` | 159 | Table-driven, good edge cases for static authorizer |
| `pkg/authz` | `endpoints_test.go` | 407 | Comprehensive endpoint matching, validation, and rewrite tests |
| `pkg/proxy` | `proxy_test.go` | 393 | Authorizer attribute generation with various rewrite configs |
| `pkg/filters` | `auth_test.go` | 447 | Authentication/authorization middleware with mock authenticators |
| `pkg/filters` | `path_test.go` | 73 | Path allow/deny filtering |
| `pkg/tls` | `reloader_test.go` | 355 | TLS cert reloading with file system operations |
| `pkg/hardcodedauthorizer` | `metrics_test.go` | 67 | Hardcoded metrics authorizer validation |
| `cmd/.../app` | `kube-rbac-proxy_test.go` | 221 | Config file parsing with Format1/Format2 authorization |
| `cmd/.../app` | `transport_test.go` | 250 | Transport initialization with TLS, CA bundles |

**Test-to-Code Ratio**: 2,443 test lines / 5,083 source lines = **0.48** (good for infrastructure projects)

**Untested Packages:**
- `pkg/authn/` — OIDC, delegating authentication, config (247 lines, 0 tests) — **CRITICAL GAP**
- `cmd/kube-rbac-proxy/app/options/` — CLI options parsing (286 lines, 0 tests)
- `cmd/kube-rbac-proxy/app/sanitazion.go` — Input sanitization (83 lines, 0 tests)
- `cmd/kube-rbac-proxy/main.go` — Entry point (31 lines, expected no tests)

**E2E Tests (13 suites, ~1,240 lines across test + support files):**

| Suite | Scenarios | Coverage Area |
|-------|-----------|--------------|
| Basics | NoRBAC, WithRBAC | Basic proxy auth flow |
| UpstreamTimeout | Short/generous timeouts | Upstream timeout handling |
| H2CUpstream | H2C upstream forwarding | HTTP/2 cleartext upstream |
| ClientCertificates | NoRBAC, WithRBAC, WrongCA | mTLS client cert auth |
| TokenAudience | Incorrect/Correct audience | Token audience validation |
| AllowPath | Allowed/NotAllowed paths | Path filtering with wildcards |
| IgnorePath | Matching/Non-matching paths | Path bypass configuration |
| TLS | Various TLS scenarios | TLS configuration |
| StaticAuthorizer | Static auth config | Hardcoded authorization rules |
| HTTP2 | HTTP/2 protocol handling | Protocol support |
| HardcodedAuthz | Hardcoded authorizer | Built-in authorization |
| Flags | Deprecated/disabled flags | CLI flag handling |
| TokenMasking | Token redaction | Security: token masking in logs |

E2E uses a custom BDD-style framework (`test/kubetest/`) with Given/When/Then scenarios and Kubernetes client integration. Well-designed but manual-only.

### Code Quality

**Linting:**
- `.golangci.yaml` present — uses v2 format with exclusion presets
- Uses default linters with standard exclusions (comments, common false positives, legacy, std error handling)
- Excludes `test/`, `third_party$`, `builtin$`, `examples$` from linting
- golangci-lint runs on every PR via `golangci/golangci-lint-action@v7`
- **Gap**: No custom linter configuration beyond exclusions; no stricter linters enabled (e.g., `errcheck`, `govet`, `ineffassign` are defaults, but `gosec`, `bodyclose`, `exhaustive` are not explicitly enabled)

**Pre-commit Hooks**: Not configured

**Static Analysis:**
- CodeQL for Go (PR + push + weekly schedule) — good
- No `gosec`, Semgrep, or other Go-specific SAST tools beyond CodeQL

### Container Images

**Dockerfiles (4):**

| File | Base Image | Build Type | Purpose |
|------|-----------|------------|---------|
| `Dockerfile` | `gcr.io/distroless/static:nonroot` | Pre-built binary copy | Upstream/community builds |
| `Dockerfile.ocp` | `registry.ci.openshift.org/ocp/builder:rhel-9-golang-1.25` | Multi-stage, vendor build | OpenShift CI (ART) builds |
| `Dockerfile.redhat` | `registry.access.redhat.com/ubi9/go-toolset:1.25` | Multi-stage, FIPS, vendor | Red Hat builds (FIPS compliant) |
| `Dockerfile.konflux` | `registry.redhat.io/ubi9/go-toolset` | Multi-stage, FIPS, vendor | Konflux pipeline builds |

**Strengths:**
- Multi-architecture support (amd64, arm64, ppc64le, s390x) via Tekton/Konflux and Makefile
- FIPS compliance with `strictfipsruntime` build tags
- Hermetic builds in Konflux (prefetch GoMod dependencies)
- License files copied into Red Hat/Konflux images
- Non-root user (65534/65532)
- Minimal base images (distroless or ubi-minimal)

**Gaps:**
- No runtime validation of built images
- No health check / startup probe testing
- No image vulnerability scanning (except via FIPS check-payload)
- No SBOM generation
- No image signing/attestation

### Build Integration (Tekton/Konflux)

**Tekton Pipelines:**
- `odh-kube-rbac-proxy-pull-request.yaml` — PR builds triggered by `/build-konflux` comment or `kfbuild-*` label (not automatic on every PR)
- `odh-kube-rbac-proxy-push.yaml` — Push to master builds the production image
- Multi-arch builds (x86_64, arm64, ppc64le, s390x)
- Hermetic builds with GoMod prefetch
- Source image build enabled
- PR images expire after 5 days

**Strengths:**
- `.tekton/` is centrally managed via `konflux-central` repo (good for consistency)
- Build image index enabled for multi-arch
- Cancel-in-progress for PR builds

**Gaps:**
- PR Konflux builds are on-demand only (comment/label triggered), not automatic
- No test execution within Tekton pipeline
- No post-build validation steps

### Security

**Strengths:**
- CodeQL SAST scanning (Go) on PRs, pushes, and weekly schedule
- FIPS compliance validation using `check-payload` on every PR
- Pinned action versions with SHA hashes (prevents supply chain attacks)
- Non-root container user
- License header enforcement
- Stale issue management

**Gaps:**
- No container vulnerability scanning (Trivy, Snyk, Grype)
- No dependency scanning (Dependabot, Renovate)
- No secret detection (Gitleaks, TruffleHog)
- No SBOM generation
- No image signing

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: No test automation guidance, no project-specific coding standards for AI tools, no test pattern documentation
- **Recommendation**: Generate rules with `/test-rules-generator` covering:
  - Unit test patterns (table-driven Go tests, mock strategies)
  - E2E test patterns (kubetest BDD framework usage)
  - Security testing guidance (for RBAC proxy logic)
  - Build validation patterns

## Recommendations

### Priority 0 (Critical)

1. **Add codecov/coveralls integration** with coverage thresholds
   - Generate `coverage.out` in `make test-unit`
   - Upload to Codecov in CI
   - Set initial threshold at 60%, target 80%
   - Block PRs that decrease coverage

2. **Automate E2E tests in CI**
   - Add a GitHub Actions workflow that creates a Kind cluster and runs `make test-e2e`
   - The infrastructure exists (`test/e2e/kind-config/`, `test/kubetest/`) — just needs CI integration
   - Run on PRs that modify Go files

3. **Add unit tests for `pkg/authn`**
   - OIDC authentication configuration
   - Delegating authentication
   - Config validation
   - This is security-critical code with zero coverage

### Priority 1 (High Value)

4. **Add container runtime validation**
   - After building Docker image, verify binary starts and listens on expected port
   - Test with all 4 Dockerfiles (at least Dockerfile.redhat)
   - Validate entrypoint, user, and exposed port

5. **Add Trivy/Snyk vulnerability scanning**
   - Scan built container images on PRs
   - Fail on CRITICAL/HIGH vulnerabilities
   - Create `.trivyignore` for accepted risks

6. **Create `.claude/rules/` with test automation guidance**
   - `unit-tests.md` — Table-driven Go test patterns, mock strategies
   - `e2e-tests.md` — kubetest BDD framework patterns
   - `security-tests.md` — RBAC and authentication test requirements

7. **Add pre-commit hooks**
   - License check, Go lint, Go vet
   - Faster feedback loop than waiting for CI

### Priority 2 (Nice-to-Have)

8. **Add unit tests for remaining untested packages**
   - `cmd/kube-rbac-proxy/app/options/` — CLI options validation
   - `cmd/kube-rbac-proxy/app/sanitazion.go` — Input sanitization

9. **Enable additional golangci-lint checks**
   - `gosec` — Security-specific linting
   - `bodyclose` — HTTP response body close checks
   - `exhaustive` — Enum exhaustiveness checks

10. **Add SBOM generation to container builds**

11. **Add dependency scanning** (Dependabot or Renovate)

12. **Add secret detection** (Gitleaks in CI)

## Comparison to Gold Standards

| Dimension | kube-rbac-proxy | odh-dashboard | notebooks | kserve |
|-----------|:-:|:-:|:-:|:-:|
| Unit Tests | 7.0 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 7.5 | 9.0 | 8.0 | 9.0 |
| Build Integration | 5.0 | 8.0 | 8.0 | 7.0 |
| Image Testing | 4.0 | 7.0 | 9.0 | 6.0 |
| Coverage Tracking | 2.0 | 9.0 | 5.0 | 9.0 |
| CI/CD Automation | 7.0 | 9.0 | 8.0 | 9.0 |
| Agent Rules | 0.0 | 8.0 | 3.0 | 2.0 |
| **Overall** | **6.3** | **8.7** | **7.3** | **7.9** |

**Key Differentiators:**
- kube-rbac-proxy has strong FIPS compliance practices (unique strength)
- The E2E framework is well-designed but underutilized (not in CI)
- Coverage tracking is the biggest gap relative to gold standards
- Multi-Dockerfile strategy is good but lacks runtime validation

## File Paths Reference

### CI/CD
- `.github/workflows/unit-tests.yml` — PR workflow (license, gen, lint, unit tests)
- `.github/workflows/codeql.yml` — CodeQL SAST scanning
- `.github/workflows/fips-compliance.yml` — FIPS compliance check
- `.github/workflows/labeler.yml` — PR auto-labeling
- `.github/workflows/stale.yml` — Stale issue management
- `.tekton/odh-kube-rbac-proxy-pull-request.yaml` — Konflux PR build (on-demand)
- `.tekton/odh-kube-rbac-proxy-push.yaml` — Konflux push build
- `.ci-operator.yaml` — OpenShift CI operator config

### Testing
- `test/e2e/main_test.go` — E2E test entry point (13 suites)
- `test/e2e/basics.go` — Core proxy E2E scenarios
- `test/e2e/kind-config/kind-config.yaml` — Kind cluster configuration
- `test/kubetest/` — Custom BDD E2E test framework
- `pkg/authz/auth_test.go` — Static authorizer unit tests
- `pkg/authz/endpoints_test.go` — Endpoint matching/validation tests
- `pkg/proxy/proxy_test.go` — Proxy attribute generation tests
- `pkg/filters/auth_test.go` — Auth filter middleware tests
- `pkg/tls/reloader_test.go` — TLS certificate reloading tests

### Build
- `Dockerfile` — Upstream community build
- `Dockerfile.ocp` — OpenShift CI (ART) build
- `Dockerfile.redhat` — Red Hat FIPS-compliant build
- `Dockerfile.konflux` — Konflux pipeline build
- `Makefile` — Build targets (build, test-unit, test-e2e, test-local, container)

### Code Quality
- `.golangci.yaml` — Linter configuration (v2 format)
- `scripts/check_license.sh` — License header verification
