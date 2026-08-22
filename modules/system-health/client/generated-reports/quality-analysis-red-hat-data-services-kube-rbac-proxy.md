---
repository: "red-hat-data-services/kube-rbac-proxy"
overall_score: 6.5
scorecard:
  - dimension: "Unit Tests"
    score: 7.5
    status: "Good test-to-code ratio (~1:1) with table-driven tests, but no t.Parallel() or coverage generation"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "Comprehensive E2E suite (22 scenarios) with Kind cluster, but no multi-version K8s testing"
  - dimension: "Build Integration"
    score: 7.0
    status: "Konflux PR pipeline with multi-arch builds, but no PR-time image startup validation"
  - dimension: "Image Testing"
    score: 5.5
    status: "Multiple Dockerfiles with multi-stage builds and UBI base images, but no runtime validation"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tooling — no codecov, no --coverprofile, no coverage thresholds"
  - dimension: "CI/CD Automation"
    score: 7.5
    status: "Well-structured PR workflows with concurrency control, but no caching and E2E not in CI"
  - dimension: "Static Analysis"
    score: 7.5
    status: "golangci-lint v2 in CI, Renovate configured, dedicated FIPS compliance workflow, but no Dependabot and no pre-commit hooks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory — zero AI agent guidance"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Cannot measure test effectiveness; regressions in coverage go undetected; no quality gate on PRs"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "E2E tests not automated in CI"
    impact: "22 E2E scenarios exist but must be run manually via `make test-e2e`; regressions in RBAC proxy behavior may not be caught before merge"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No container runtime validation in CI"
    impact: "Image builds succeed but startup failures, missing binaries, or broken entrypoints are only discovered at deployment time"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No AI agent rules for test creation"
    impact: "AI-assisted contributions lack guidance on testing patterns, frameworks, and quality standards specific to this project"
    severity: "LOW"
    effort: "2-3 hours"
quick_wins:
  - title: "Add --coverprofile to unit test target and integrate Codecov"
    effort: "2-4 hours"
    impact: "Enables coverage tracking, PR coverage comments, and threshold enforcement"
  - title: "Add Dependabot configuration for gomod ecosystem"
    effort: "1 hour"
    impact: "Automated dependency update PRs complement existing Renovate configuration"
  - title: "Add t.Parallel() to independent unit tests"
    effort: "1-2 hours"
    impact: "Faster test execution and detection of shared-state bugs"
  - title: "Create basic CLAUDE.md with test creation guidance"
    effort: "2-3 hours"
    impact: "AI agents produce consistent, project-appropriate tests"
recommendations:
  priority_0:
    - "Add coverage tracking: --coverprofile in Makefile test-unit target, .codecov.yml with thresholds, codecov/codecov-action in CI workflow"
    - "Automate E2E tests in CI: add a workflow that creates a Kind cluster, loads the image, and runs make test-e2e on PRs"
  priority_1:
    - "Add container runtime validation: smoke test that built image starts and responds on health endpoint"
    - "Add multi-version Kubernetes testing in E2E via matrix strategy"
    - "Enable t.Parallel() in unit tests for faster execution and race detection"
  priority_2:
    - "Create .claude/rules/ with unit-tests.md and e2e-tests.md for AI agent guidance"
    - "Add pre-commit hooks for license check and linting"
    - "Add Dependabot alongside Renovate for broader ecosystem coverage"
---

# Quality Analysis: kube-rbac-proxy

**Repository**: [red-hat-data-services/kube-rbac-proxy](https://github.com/red-hat-data-services/kube-rbac-proxy)
**Tier**: Downstream (RHOAIENG / AI Core Platform)
**Language**: Go (go 1.26)
**Type**: Kubernetes RBAC authorization proxy
**Default Branch**: main
**Analysis Date**: 2026-07-20

## Executive Summary

- **Overall Score: 6.5/10**
- **Key Strengths**: Strong unit test coverage with idiomatic table-driven tests (~1:1 test-to-code ratio), comprehensive E2E test suite with 22 scenarios using Kind clusters, dedicated FIPS compliance CI workflow with check-payload scanning, multi-arch Konflux build pipeline, and Renovate-based dependency management.
- **Critical Gaps**: Zero coverage tracking or enforcement, E2E tests not automated in CI (manual-only), no container runtime validation, and no AI agent rules.
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 7.5/10 | 15% | 1.13 | Good test-to-code ratio with table-driven tests |
| Integration/E2E | 7.0/10 | 20% | 1.40 | 22 E2E scenarios with Kind, but not in CI |
| Build Integration | 7.0/10 | 15% | 1.05 | Konflux multi-arch PR pipeline |
| Image Testing | 5.5/10 | 10% | 0.55 | Multi-stage UBI builds, no runtime validation |
| Coverage Tracking | 1.0/10 | 10% | 0.10 | No coverage tooling whatsoever |
| CI/CD Automation | 7.5/10 | 15% | 1.13 | Well-structured workflows with concurrency control |
| Static Analysis | 7.5/10 | 10% | 0.75 | golangci-lint v2, FIPS workflow, Renovate |
| Agent Rules | 0.0/10 | 5% | 0.00 | No agent rules present |
| **Overall** | **6.5/10** | **100%** | **6.10** | |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Severity**: HIGH
- **Impact**: Cannot measure test effectiveness; coverage regressions go undetected across PRs. No quality gate prevents merging code with declining test coverage.
- **Evidence**: No `.codecov.yml`, no `--coverprofile` flag in `Makefile` test targets, no coverage action in any GitHub workflow. The `test-unit` target runs `go test -v -race -count=1` without coverage generation.
- **Effort**: 4-6 hours
- **Fix**: Add `--coverprofile=coverage.out` to `make test-unit`, create `.codecov.yml` with threshold, add `codecov/codecov-action` to the unit-tests workflow.

### 2. E2E Tests Not Automated in CI
- **Severity**: HIGH
- **Impact**: The repository has a well-designed E2E suite with 22 test scenarios covering RBAC basics, TLS, HTTP2, token audiences, client certificates, static/hardcoded authorizers, path filtering, upstream timeouts, and token masking. However, these only run via `make test-e2e` locally with a pre-created Kind cluster — no GitHub workflow triggers them on PRs.
- **Evidence**: No workflow file references `test-e2e` or `kind create cluster`. The `kind-create-cluster` Makefile target exists but is only used by `test-local-setup`.
- **Effort**: 8-12 hours

### 3. No Container Runtime Validation
- **Severity**: MEDIUM
- **Impact**: Images are built in CI (Konflux pipeline) but never tested for startup. A broken entrypoint, missing binary, or incorrect permissions would only surface during deployment.
- **Evidence**: No `docker run`, `podman run`, or health check validation in any workflow. No `HEALTHCHECK` instruction in any Dockerfile.
- **Effort**: 4-6 hours

### 4. No AI Agent Rules
- **Severity**: LOW
- **Impact**: AI-assisted development contributions lack project-specific guidance on testing patterns, Go conventions, and quality gates.
- **Evidence**: No `CLAUDE.md`, `AGENTS.md`, `.claude/` directory, or `.claude/rules/` files.
- **Effort**: 2-3 hours

## Quick Wins

### 1. Add Coverage Tracking (2-4 hours)
Add `--coverprofile` to unit test target and integrate Codecov:

```makefile
# In Makefile, update test-unit:
test-unit:
	go test -v -race -count=1 -coverprofile=coverage.out $(PKGS)
```

```yaml
# .codecov.yml
coverage:
  status:
    project:
      default:
        target: 50%
        threshold: 5%
    patch:
      default:
        target: 60%
```

```yaml
# Add to .github/workflows/unit-tests.yml, after "Run unit tests":
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: coverage.out
          fail_ci_if_error: false
```

### 2. Add Dependabot for gomod (1 hour)
```yaml
# .github/dependabot.yml
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

### 3. Add t.Parallel() to Unit Tests (1-2 hours)
Most unit tests use table-driven patterns with no shared state, making them safe for parallel execution. Add `t.Parallel()` at the top of each test function and subtests.

### 4. Create Basic Agent Rules (2-3 hours)
Generate test creation guidance using `/test-rules-generator` to create `.claude/rules/unit-tests.md` and `.claude/rules/e2e-tests.md`.

## Detailed Findings

### Unit Tests

**Score: 7.5/10**

**Test Files**: 9 unit test files across `cmd/` and `pkg/` packages
**Test Lines**: 2,443 lines of test code
**Source Lines**: 2,376 lines of source code (excluding test infrastructure)
**Test-to-Code Ratio**: ~1.03:1 (excellent)

**Strengths**:
- Idiomatic Go table-driven tests (e.g., `pkg/authz/auth_test.go` with 7 test cases)
- Race detection enabled (`-race` flag in test target)
- Good package coverage: tests exist for `authz`, `filters`, `proxy`, `tls`, `hardcodedauthorizer`, and `cmd/app`
- Tests cover both positive and negative scenarios (e.g., `shouldPass` vs `shouldNoOpinion`)

**Weaknesses**:
- No `t.Parallel()` calls in any test — sequential execution only
- No coverage profiling configured
- No test helper assertions (raw `t.Errorf` throughout)
- `pkg/authn/` package has no tests (3 files: `config.go`, `delegating.go`, `oidc.go`)

**Key Test Files**:
| File | Lines | Description |
|------|-------|-------------|
| `pkg/filters/auth_test.go` | 447 | Auth filter middleware tests |
| `pkg/authz/endpoints_test.go` | 407 | Endpoint authorization tests |
| `pkg/proxy/proxy_test.go` | 393 | Proxy handler tests |
| `pkg/tls/reloader_test.go` | 355 | TLS certificate reloader tests |
| `cmd/app/transport_test.go` | 250 | Transport configuration tests |
| `cmd/app/kube-rbac-proxy_test.go` | 221 | Main app configuration tests |
| `pkg/authz/auth_test.go` | 159 | Static authorizer tests |

### Integration/E2E Tests

**Score: 7.0/10**

**E2E Framework**: Custom `kubetest` framework in `test/kubetest/` (Given-When-Then pattern)
**Test Scenarios**: 22 E2E scenarios across 7 test suites
**Cluster Setup**: Kind cluster with custom kubeadm config

**Test Suites**:
| Suite | Scenarios | Coverage |
|-------|-----------|----------|
| Basics | 4 | NoRBAC, WithRBAC, WithUpstreamTimeout, WithShortUpstreamTimeoutAndSlowUpstream |
| ClientCertificates | 3 | NoRBAC, WithRBAC, WrongCA |
| TokenAudience | 2 | IncorrectAudience, CorrectAudience |
| AllowPath | 2 | WithPathNotAllowed, WithPathAllowed |
| IgnorePath | 2 | WithIgnorePathMatch, WithIgnorePathNoMatch |
| TLS | 1 | TLS configuration |
| StaticAuthorizer | 1 | Static authorization |
| HTTP2 | 2 | HTTP/2 proxy support |
| HardcodedAuthz | 1 | Hardcoded authorizer |
| Flags | 2 | Deprecated flags handling |
| TokenMasking | 1 | Token masking in logs |
| H2CUpstream | 1 | H2C upstream support |

**Strengths**:
- Well-structured Given-When-Then test pattern
- Custom test framework (`kubetest`) with reusable helpers
- Tests deploy real Kubernetes resources (Deployments, Services, RBAC)
- Covers both success and failure scenarios
- Kind cluster configuration included

**Weaknesses**:
- **Not automated in CI** — must be run manually via `make test-e2e`
- No multi-version Kubernetes testing (single Kind version)
- No test timeout configured at scenario level (only 55m overall)
- No cleanup verification (relies on namespace deletion)

### Build Integration

**Score: 7.0/10**

**Strengths**:
- **Konflux PR pipeline** (`.tekton/odh-kube-rbac-proxy-pull-request.yaml`):
  - Multi-arch builds: `linux/x86_64`, `linux/arm64`, `linux/ppc64le`, `linux/s390x`
  - Hermetic build with gomod prefetch
  - Source image build enabled
  - Cancel-in-progress for concurrent PRs
  - Triggered on PR events and `/build-konflux` comments
- **Multiple Dockerfiles** for different build contexts:
  - `Dockerfile` — upstream distroless
  - `Dockerfile.ocp` — OpenShift CI builds
  - `Dockerfile.redhat` — Red Hat FIPS-compliant builds
  - `Dockerfile.konflux` — Konflux pipeline builds
- **CI operator config** (`.ci-operator.yaml`) for OpenShift CI

**Weaknesses**:
- No PR-time image startup validation after build
- No dry-run manifest validation (`kubectl apply --dry-run`)
- GitHub workflows don't build Docker images on PR (only Konflux does)
- No Kustomize overlay validation

### Image Testing

**Score: 5.5/10**

**Strengths**:
- Multi-stage builds in all production Dockerfiles (builder + runtime)
- UBI9-based runtime images for FIPS compliance (Dockerfile.redhat, Dockerfile.konflux)
- Non-root user (`USER 65534`) in all production images
- Minimal runtime images (ubi-minimal, distroless)
- License file inclusion in Red Hat builds
- Multi-architecture support (amd64, arm64, ppc64le, s390x)

**Weaknesses**:
- No `HEALTHCHECK` instruction in any Dockerfile
- No runtime validation (no `docker run` smoke test in CI)
- No Testcontainers or equivalent for container testing
- `Dockerfile` (upstream) uses `gcr.io/distroless/static` — not UBI-based
- No container scanning integration (out-of-scope per policy but noted for awareness)

**Dockerfile Analysis**:
| File | Builder Base | Runtime Base | FIPS | Multi-arch |
|------|-------------|-------------|------|------------|
| Dockerfile | (pre-built binary) | gcr.io/distroless/static | No | Yes (ARG) |
| Dockerfile.ocp | rhel-9-golang-1.26-openshift-5.0 | ocp/4.22:base-rhel9 | No | No |
| Dockerfile.redhat | ubi9/go-toolset:1.26 | ubi9/ubi-minimal:latest | Yes | Yes (TARGETARCH) |
| Dockerfile.konflux | ubi9/go-toolset (pinned SHA) | ubi9/ubi-minimal (pinned SHA) | Yes | Yes (TARGETARCH) |

### Coverage Tracking

**Score: 1.0/10**

**Status**: Virtually nonexistent

- No `.codecov.yml` or `codecov.yml`
- No `--coverprofile` in any test command
- No coverage action in any CI workflow
- No coverage threshold enforcement
- No PR coverage reporting
- The `test-unit` Makefile target runs tests with `-race` and `-count=1` but no coverage flags

The only reason this scores 1.0 instead of 0.0 is that the race detector (`-race`) catches a class of concurrency bugs that coverage alone cannot.

### CI/CD Automation

**Score: 7.5/10**

**Workflows**:
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `unit-tests.yml` | push + PR | License check, code generation verify, lint, unit tests |
| `fips-compliance.yml` | PR | Builds FIPS image, runs check-payload scan |
| `labeler.yml` | PR target | Auto-labels PRs |
| `stale.yml` | schedule (daily) | Marks stale issues/PRs after 180 days |
| Tekton PR pipeline | PR event/comment/label | Multi-arch Konflux build |

**Strengths**:
- Concurrency control on all workflows (`cancel-in-progress: true`)
- Timeout limits on all jobs (3-15 minutes)
- Pinned action versions with SHA hashes (security best practice)
- Comprehensive PR checks: license, codegen drift, lint, unit tests, FIPS
- Minimal permissions configured per job

**Weaknesses**:
- No Go module caching (`actions/cache` or `setup-go` cache)
- E2E tests not in any automated workflow
- No test parallelization or matrix strategy
- No build step in unit-tests workflow (only lint + test)

### Static Analysis

**Score: 7.5/10**

#### Linting
- **golangci-lint v2** configuration (`.golangci.yaml`)
- Uses v2 format with `exclusions.presets` (comments, common-false-positives, legacy, std-error-handling)
- Runs via `golangci/golangci-lint-action@v7` in CI
- Test files excluded from linting (`test/` path excluded)
- No custom linters enabled beyond defaults

#### FIPS Compatibility
- **Excellent**: Dedicated `fips-compliance.yml` workflow
- Builds FIPS-compliant image using `Dockerfile.redhat`
- Scans with OpenShift `check-payload` tool
- Build flags: `-tags=strictfipsruntime`, `GOEXPERIMENT=strictfipsruntime`, `CGO_ENABLED=1`
- UBI9 base images for FIPS-capable runtime
- No non-FIPS crypto imports detected in source (`crypto/md5`, `crypto/des`, `crypto/rc4` all absent)

#### Dependency Alerts
- **Renovate**: Configured (`.github/renovate.json`) extending `red-hat-data-services/konflux-central` defaults
- **Dependabot**: Not configured (no `.github/dependabot.yml`)
- No pre-commit hooks (no `.pre-commit-config.yaml`)

### Agent Rules

**Score: 0.0/10**

- **Status**: Missing
- No `CLAUDE.md` in repository root
- No `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` directory
- No test creation guidance for AI agents
- **Recommendation**: Generate rules with `/test-rules-generator` to create unit test and E2E test patterns specific to this project's Go testing patterns and kubetest framework

## Recommendations

### Priority 0 (Critical)

1. **Add coverage tracking and enforcement**
   - Add `--coverprofile=coverage.out` to `make test-unit`
   - Create `.codecov.yml` with project target (50%) and patch target (60%)
   - Add `codecov/codecov-action` to the `unit-tests.yml` workflow
   - Effort: 4-6 hours

2. **Automate E2E tests in CI**
   - Create new workflow or extend `unit-tests.yml` with a Kind-based E2E job
   - Steps: Kind cluster creation, image build + load, `make test-e2e`
   - Consider running on a schedule if too slow for every PR
   - Effort: 8-12 hours

### Priority 1 (High Value)

3. **Add container runtime smoke test**
   - After image build, run `docker run --rm kube-rbac-proxy:test --help` to verify binary works
   - Add `HEALTHCHECK` to production Dockerfiles
   - Effort: 4-6 hours

4. **Add multi-version Kubernetes testing**
   - Use matrix strategy in E2E workflow to test against multiple Kind K8s versions
   - Covers compatibility across OCP versions
   - Effort: 4-6 hours

5. **Enable t.Parallel() in unit tests**
   - Add `t.Parallel()` to all table-driven test functions and subtests
   - Improves test speed and detects shared-state bugs
   - Effort: 1-2 hours

### Priority 2 (Nice-to-Have)

6. **Create AI agent rules**
   - Add `CLAUDE.md` with project overview and testing guidance
   - Create `.claude/rules/unit-tests.md` with Go table-driven test patterns
   - Create `.claude/rules/e2e-tests.md` with kubetest framework patterns
   - Effort: 2-3 hours

7. **Add pre-commit hooks**
   - License check, golangci-lint, go mod tidy verification
   - Effort: 1-2 hours

8. **Add Go module caching in CI**
   - `actions/setup-go` has built-in caching — enable it
   - Effort: 30 minutes

## Comparison to Gold Standards

| Dimension | kube-rbac-proxy | odh-dashboard | notebooks | kserve |
|-----------|----------------|---------------|-----------|--------|
| Unit Tests | 7.5 — Good ratio, table-driven | 9.0 — Jest + RTL, high coverage | 6.0 — Notebook-focused | 8.0 — Extensive Go tests |
| Integration/E2E | 7.0 — 22 scenarios, not in CI | 9.0 — Cypress, multi-layer | 8.0 — Image validation | 9.0 — Multi-version K8s |
| Build Integration | 7.0 — Konflux multi-arch | 8.0 — Full PR builds | 7.0 — Image builds | 7.0 — Operator bundles |
| Image Testing | 5.5 — No runtime validation | 7.0 — Container tests | 9.0 — 5-layer validation | 6.0 — Basic validation |
| Coverage Tracking | 1.0 — None | 8.0 — Codecov enforced | 5.0 — Partial | 8.0 — Codecov + thresholds |
| CI/CD Automation | 7.5 — Well-structured | 9.0 — Comprehensive | 8.0 — Matrix builds | 8.0 — Multi-stage |
| Static Analysis | 7.5 — Lint + FIPS workflow | 8.0 — ESLint + Prettier | 6.0 — Basic linting | 7.0 — golangci-lint |
| Agent Rules | 0.0 — Missing | 8.0 — Comprehensive | 2.0 — Minimal | 3.0 — Basic |
| **Overall** | **6.5** | **8.5** | **6.5** | **7.5** |

## File Paths Reference

### CI/CD
- `.github/workflows/unit-tests.yml` — License, codegen, lint, unit tests
- `.github/workflows/fips-compliance.yml` — FIPS compliance scanning
- `.github/workflows/codeql.yml` — CodeQL analysis (out of scope)
- `.github/workflows/labeler.yml` — PR auto-labeling
- `.github/workflows/stale.yml` — Stale issue/PR management
- `.tekton/odh-kube-rbac-proxy-pull-request.yaml` — Konflux PR pipeline
- `.ci-operator.yaml` — OpenShift CI configuration
- `Makefile` — Build, test, and container targets

### Testing
- `cmd/kube-rbac-proxy/app/kube-rbac-proxy_test.go` — App config tests
- `cmd/kube-rbac-proxy/app/transport_test.go` — Transport tests
- `pkg/authz/auth_test.go` — Static authorizer tests
- `pkg/authz/endpoints_test.go` — Endpoint authorization tests
- `pkg/filters/auth_test.go` — Auth filter tests
- `pkg/filters/path_test.go` — Path filter tests
- `pkg/hardcodedauthorizer/metrics_test.go` — Metrics tests
- `pkg/proxy/proxy_test.go` — Proxy handler tests
- `pkg/tls/reloader_test.go` — TLS reloader tests
- `test/e2e/` — E2E test suite (22 scenarios)
- `test/kubetest/` — Custom E2E test framework

### Container Images
- `Dockerfile` — Upstream distroless image
- `Dockerfile.ocp` — OpenShift CI image
- `Dockerfile.redhat` — Red Hat FIPS-compliant image
- `Dockerfile.konflux` — Konflux pipeline image

### Static Analysis
- `.golangci.yaml` — golangci-lint v2 configuration
- `.github/renovate.json` — Renovate dependency management
