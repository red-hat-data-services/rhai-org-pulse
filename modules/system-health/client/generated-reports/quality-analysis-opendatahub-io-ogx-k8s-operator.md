---
repository: "opendatahub-io/ogx-k8s-operator"
overall_score: 7.5
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Strong coverage with 33 test files, envtest integration, testify framework"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Comprehensive E2E suite with Kind cluster, automated on PRs, release-gated"
  - dimension: "Build Integration"
    score: 8.0
    status: "Konflux PR pipelines, pre-commit manifest generation, kustomize overlay validation"
  - dimension: "Image Testing"
    score: 6.0
    status: "Multi-arch UBI9 multi-stage builds, tested via Kind deployment, no explicit container runtime validation"
  - dimension: "Coverage Tracking"
    score: 5.0
    status: "Coverage generated via coverprofile and limgo, but thresholds at zero — not enforcing"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "Well-organized workflows with Mergify, Konflux, release automation, concurrency control"
  - dimension: "Static Analysis"
    score: 9.0
    status: "golangci-lint v2 all-enabled, 12+ pre-commit hooks, FIPS-compliant, Dependabot for 3 ecosystems"
  - dimension: "Agent Rules"
    score: 6.0
    status: "Comprehensive CLAUDE.md with architecture and conventions, but no .claude/rules/ test patterns"
critical_gaps:
  - title: "Coverage thresholds not enforced"
    impact: "Coverage is tracked but thresholds are zero — regressions go undetected until too late"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container runtime validation"
    impact: "Image startup issues not caught by dedicated tests — relies on E2E Kind deployment as proxy"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No multi-version Kubernetes testing"
    impact: "Operator may fail on different K8s/OCP versions discovered only in production"
    severity: "MEDIUM"
    effort: "4-8 hours"
quick_wins:
  - title: "Set non-zero limgo coverage thresholds"
    effort: "1-2 hours"
    impact: "Prevent coverage regressions on every PR by enforcing minimum thresholds"
  - title: "Add Codecov integration for PR coverage reporting"
    effort: "2-3 hours"
    impact: "Inline PR coverage diffs and trend tracking across branches"
  - title: "Create .claude/rules/ for test patterns"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality and consistency with repo conventions"
recommendations:
  priority_0:
    - "Set meaningful limgo coverage thresholds (e.g., 60%+ statements/lines) to gate PRs"
    - "Add Codecov or equivalent PR coverage reporting with diff enforcement"
  priority_1:
    - "Add K8s version matrix to E2E tests (test against 2-3 K8s versions)"
    - "Create .claude/rules/ with unit test, E2E test, and webhook test patterns"
    - "Add container health check or startup validation test"
  priority_2:
    - "Add contract tests for the distribution resolution API boundary"
    - "Add webhook mutation/validation fuzz testing"
    - "Consider performance regression tests for reconciliation loop"
---

# Quality Analysis: ogx-k8s-operator

## Executive Summary

- **Overall Score: 7.5/10** — Above average quality practices with strong foundations
- **Repository Type**: Go Kubernetes operator (operator-sdk v4 layout, controller-runtime)
- **Jira**: RHOAIENG / OGX Core (midstream tier)
- **Key Strengths**: Excellent static analysis (all-enabled golangci-lint v2), comprehensive E2E with Kind + Konflux PR pipelines, strong FIPS compliance, well-organized CI/CD with Mergify auto-merge
- **Critical Gaps**: Coverage thresholds at zero (not enforcing), no multi-version K8s testing, no dedicated container runtime validation
- **Agent Rules Status**: Present (comprehensive CLAUDE.md) but incomplete (no `.claude/rules/` for test patterns)

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.0/10 | 15% | 1.20 | Strong coverage with 33 test files, envtest, testify |
| Integration/E2E | 8.0/10 | 20% | 1.60 | Comprehensive E2E with Kind, automated on PRs, release-gated |
| Build Integration | 8.0/10 | 15% | 1.20 | Konflux PR pipelines, pre-commit manifest gen, kustomize validation |
| Image Testing | 6.0/10 | 10% | 0.60 | Multi-arch UBI9 multi-stage, no explicit container runtime validation |
| Coverage Tracking | 5.0/10 | 10% | 0.50 | Coverage generated but thresholds at zero |
| CI/CD Automation | 8.0/10 | 15% | 1.20 | Mergify, Konflux, release automation, concurrency control |
| Static Analysis | 9.0/10 | 10% | 0.90 | golangci-lint v2 all-enabled, 12+ pre-commit hooks, FIPS-compliant |
| Agent Rules | 6.0/10 | 5% | 0.30 | Comprehensive CLAUDE.md, missing .claude/rules/ |
| **Overall** | **7.5/10** | **100%** | **7.50** | |

## Critical Gaps

### 1. Coverage Thresholds Not Enforced
- **Impact**: Coverage regressions go undetected — any PR can reduce coverage without failing checks
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: `.limgo.json` has `statements: 0, lines: 0, branches: 0`. The `code-coverage.yml` workflow generates coverage and posts it to the step summary, but with zero thresholds it cannot fail a PR. This means coverage could gradually decline without anyone noticing.
- **Fix**: Set meaningful thresholds in `.limgo.json` (e.g., `"statements": 60, "lines": 60`) and add a `limgo --fail-under` step or equivalent check that fails the workflow when coverage drops below the threshold.

### 2. No Dedicated Container Runtime Validation
- **Impact**: Image startup issues, missing runtime dependencies, or entrypoint problems not caught until Kind deployment
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: The E2E workflow builds the image and deploys to Kind, which indirectly validates the image starts. However, there are no dedicated container tests (e.g., verifying the binary runs, health endpoints respond, environment variables are handled correctly). The Dockerfile installs `openssl` at runtime — if the package is unavailable, it would only be caught in E2E.

### 3. No Multi-Version Kubernetes Testing
- **Impact**: Operator may break on different K8s/OCP versions without detection
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: E2E tests run against a single Kind cluster version. The operator targets both vanilla K8s and OpenShift (has separate `deploy-openshift` target and OpenShift overlay). Testing against multiple K8s versions (e.g., 1.28, 1.30, 1.31) would catch API deprecation or behavior changes early.

## Quick Wins

### 1. Set Non-Zero limgo Coverage Thresholds
- **Effort**: 1-2 hours
- **Impact**: Immediately prevents coverage regressions on every PR
- **Implementation**: Update `.limgo.json`:
  ```json
  {
    "coverage": {
      "global": {
        "statements": 60,
        "lines": 60,
        "branches": 0
      }
    }
  }
  ```
  Then update `code-coverage.yml` to fail on threshold breach.

### 2. Add Codecov Integration
- **Effort**: 2-3 hours
- **Impact**: Inline PR coverage diffs, historical trend tracking, branch comparison
- **Implementation**: Add `.codecov.yml` and update `code-coverage.yml`:
  ```yaml
  - name: Upload coverage to Codecov
    uses: codecov/codecov-action@v4
    with:
      file: cover.out
      fail_ci_if_error: true
  ```

### 3. Create .claude/rules/ for Test Patterns
- **Effort**: 2-3 hours
- **Impact**: AI-generated tests match repo conventions (envtest, testify, table-driven)
- **Implementation**: Use `/test-rules-generator` to create rules based on existing test patterns. Key rules needed:
  - Unit test patterns (table-driven with testify)
  - Integration test patterns (envtest setup)
  - E2E test patterns (Kind cluster, OGXServer CR lifecycle)

## Detailed Findings

### Unit Tests

**Score: 8.0/10**

**Strengths:**
- 33 test files for 53 source files (62% test-to-code ratio) — excellent coverage
- Tests span all major packages: `api/v1beta1/`, `controllers/`, `pkg/config/`, `pkg/deploy/`, `pkg/cluster/`, `pkg/compare/`, `cmd/configgen/`
- Uses `testify` for assertions and test organization
- `controllers/suite_test.go` uses `envtest.Environment` with `TestMain` pattern for shared test environment
- CEL validation tests for CRD (`api/v1beta1/suite_cel_test.go`, `ogxserver_cel_test.go`)
- Webhook validation tests (`ogxserver_webhook_test.go`)
- Tests cover complex scenarios: CA whitespace handling, legacy adoption, network resources, kustomize plugins

**Areas for Improvement:**
- No `t.Parallel()` usage (disabled in golangci-lint config)
- `ogx-module/` has only 1 test file (`reconciler_test.go`) for its controller

**Key Test Files:**
- `controllers/ogxserver_controller_test.go` — Main controller reconciliation tests
- `controllers/configmap_reconciler_test.go` — ConfigMap reconciliation
- `api/v1beta1/ogxserver_webhook_test.go` — Webhook validation
- `api/v1beta1/ogxserver_cel_test.go` — CEL validation rules
- `pkg/deploy/kustomizer_test.go` — Kustomize rendering
- `pkg/config/config_test.go` — Configuration management

### Integration/E2E Tests

**Score: 8.0/10**

**Strengths:**
- Dedicated `tests/e2e/` directory with 7 test files covering: creation, deletion, rollout, TLS, validation
- Fully automated in CI: `run-e2e-test.yml` triggers on PRs to `main`
- Kind cluster with custom config (containerd, port mappings, memory settings)
- Tests deploy cert-manager, build operator image, push to local registry, deploy operator, then exercise
- E2E is a release gate: `generate-release.yml` requires E2E pass before proceeding
- Tests exercise full OGXServer lifecycle: creation, validation, TLS configuration, rollout, deletion
- Test options pattern (`test_options.go`) allows skipping creation/deletion phases
- Multi-distribution testing architecture (currently testing "starter" distribution)
- Controller integration tests use `envtest` with real CRD installation

**Areas for Improvement:**
- Single K8s version testing — no matrix across K8s versions
- E2E runs only on PRs to `main` (not `odh` branch) — `code-coverage.yml` covers `odh` but only unit tests
- No multi-namespace or multi-tenant testing scenarios
- Only tests "starter" distribution — could test more distributions

**CI Integration:**
- `run-e2e-test.yml`: PR trigger on `main`, Kind cluster, full operator deployment
- `generate-release.yml`: calls `run-e2e-test.yml` via `workflow_call`, blocks release on failure

### Build Integration

**Score: 8.0/10**

**Strengths:**
- **Konflux PR pipelines**: `.tekton/odh-ogx-k8s-operator-pull-request.yaml` runs on PRs to `odh` branch using central multi-arch pipeline from `odh-konflux-central`
- **Pre-commit manifest validation**: `pre-commit.yml` runs `make lint`, `make generate manifests`, `make build-installer`, `make api-docs` — catches manifest drift
- **Kustomize overlay validation**: `make build-installer` builds `release/operator.yaml` and `release/operator-openshift.yaml` from kustomize overlays
- **E2E builds and deploys image**: Docker image built, pushed to Kind registry, operator deployed with `make deploy`
- **SHA-pinned actions**: Custom pre-commit hook (`hack/check-workflows-uses-hashes.sh`) enforces SHA-pinned GitHub Actions
- **CRD generation validation**: Pre-commit hooks run `controller-gen` to detect uncommitted CRD/RBAC changes
- **Release validation**: `generate-release.yml` validates image build as part of release process

**Areas for Improvement:**
- No PR-time `kustomize build --dry-run` against the cluster (only local kustomize build)
- Konflux pipeline is centralized — limited visibility into what exactly is validated at PR time

**Tekton/Konflux Pipelines:**
- `odh-ogx-k8s-operator-pull-request.yaml` — PR pipeline targeting `odh` branch
- `odh-ogx-k8s-operator-push.yaml` — Push pipeline
- `llama-stack-k8s-operator-pull-request.yaml` — Legacy name PR pipeline
- `llama-stack-k8s-operator-push.yaml` — Legacy name push pipeline

### Image Testing

**Score: 6.0/10**

**Strengths:**
- **Multi-stage builds**: Both Dockerfiles use builder/runtime pattern
- **UBI9 base images**: `registry.access.redhat.com/ubi9/go-toolset` (builder), `registry.access.redhat.com/ubi9/ubi-minimal` (runtime) — FIPS-capable
- **Multi-architecture support**: amd64 + arm64 with native cross-compilation (avoids QEMU for Go builds)
- **Cross-compilation optimization**: Detects `BUILDPLATFORM` vs `TARGETPLATFORM` and adjusts CGO_ENABLED accordingly
- **FIPS runtime support**: `GOEXPERIMENT=strictfipsruntime`, openssl installed in runtime image
- **Layer caching**: Go modules downloaded before copying source
- **`.dockerignore`**: Excludes `bin/` and `testbin/`
- **Second Dockerfile**: `ogx-module/Dockerfile` for the module operator component

**Areas for Improvement:**
- No `HEALTHCHECK` instruction in either Dockerfile
- No dedicated container startup tests (Testcontainers or similar)
- No image scanning in CI workflows (handled at org level, out of scope)
- Runtime image doesn't verify openssl FIPS mode is active
- ogx-module Dockerfile uses `CGO_ENABLED=0` (no OpenSSL FIPS, pure Go FIPS only)

### Coverage Tracking

**Score: 5.0/10**

**Strengths:**
- `make test` generates `cover.out` via `--coverprofile` flag
- `code-coverage.yml` workflow runs on PRs to `odh` branch
- Uses `limgo` tool for coverage calculation and formatting
- Coverage results posted to GitHub Step Summary (visible to PR reviewers)
- Coverage artifact uploaded for download
- `.limgo.json` excludes test files and generated code from statistics

**Weaknesses:**
- **Thresholds at zero**: `.limgo.json` has `"statements": 0, "lines": 0, "branches": 0` — no enforcement
- **No Codecov/Coveralls integration**: No inline PR diff coverage, no historical trend tracking
- **Coverage only on `odh` branch**: `code-coverage.yml` triggers on PRs to `odh`, not `main`
- **No coverage gate**: The workflow cannot fail a PR even if coverage drops dramatically
- **No branch-level coverage tracking**: No comparison between PR and base branch coverage

### CI/CD Automation

**Score: 8.0/10**

**Strengths:**
- **11 workflow files** covering full lifecycle: PR checks, image builds, E2E, releases, disconnected readiness
- **PR-triggered workflows**:
  - `pre-commit.yml` — All PRs + push to `main`, concurrency with cancel-in-progress
  - `code-coverage.yml` — PRs to `odh`
  - `run-e2e-test.yml` — PRs to `main`
  - `disconnected-readiness.yml` — PRs to `main` and `odh`
- **Mergify auto-merge**: Requires 2 approvals, passing `pre-commit`, `e2e-tests`, `DCO`, `tests` checks; auto-deletes head branch
- **Concurrency control**: `pre-commit.yml` uses `cancel-in-progress: true`
- **Go caching**: Via `setup-go` with `go-version-file: go.mod`
- **Multi-arch matrix**: amd64 + arm64 on native runners (ARM64 on `ubuntu-24.04-arm`)
- **Automated release pipeline**: `generate-release.yml` — E2E gate, version bump, image build, manifest push, tag, GitHub release
- **SHA-pinned actions**: All GitHub Actions use commit SHAs, enforced by pre-commit hook
- **Tekton/Konflux**: Parallel build system for Red Hat downstream builds

**Areas for Improvement:**
- No test parallelization within workflows (single `make test` invocation)
- No K8s version matrix for E2E
- No periodic/scheduled test runs (only PR and push triggered)
- Coverage workflow only on `odh` branch, not `main`

**Workflow Summary:**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pre-commit.yml` | PR + push main | Lint, format, manifest gen, API docs |
| `code-coverage.yml` | PR to odh | Unit tests + coverage reporting |
| `run-e2e-test.yml` | PR to main, workflow_call | E2E with Kind cluster |
| `disconnected-readiness.yml` | PR + push | Disconnected environment readiness check |
| `build-image.yml` | Merged PR to main | Multi-arch image to quay.io/ogx-ai |
| `main-build-image.yml` | Merged PR to main | Multi-arch image to quay.io/opendatahub |
| `odh-build-image.yml` | Push to odh | Single-arch image to quay.io/opendatahub |
| `release-image.yml` | Manual dispatch | Release image build |
| `generate-release.yml` | Manual dispatch | Full release pipeline |
| `build-vllm-cpu-image.yml` | Manual dispatch | Placeholder for vLLM CPU image |

### Static Analysis

**Score: 9.0/10**

#### Linting

- **golangci-lint v2** with `default: all` — starts with every available linter enabled, then selectively disables
- **Disabled linters** are documented with reasons (e.g., `paralleltest` — too many false positives; `varnamelen` — Go prefers short vars)
- **Key enabled linters**: govet (with shadow), gocyclo (min-complexity: 30), errcheck (type assertions), funlen (100 lines/statements), errorlint, revive, perfsprint, gocritic
- **Line length**: 180 characters max
- **Import ordering**: Enforced via gci (standard, default, blank, dot)
- **Test relaxations**: Test files exempt from errcheck, dupl, gosec, funlen
- **Version**: golangci-lint v2.8.0

#### Pre-commit Hooks (12+)

| Hook | Purpose |
|------|---------|
| `check-merge-conflict` | Prevents merge conflict markers |
| `trailing-whitespace` | Removes trailing whitespace |
| `check-added-large-files` | Blocks files > 1000KB |
| `end-of-file-fixer` | Ensures final newline |
| `no-commit-to-branch` | Prevents direct commits to protected branches |
| `check-yaml` | YAML syntax validation |
| `detect-private-key` | Prevents private key commits |
| `mixed-line-ending` | Enforces LF line endings |
| `check-executables-have-shebangs` | Script validation |
| `linters` | Runs `make lint` |
| `generate-manifests` | Runs `make generate manifests` |
| `build-installer` | Runs `make build-installer` |
| `generate-api-docs` | Runs `make api-docs` |
| `check-go-error-messages` | Custom: errors must start with "failed to" |
| `check-workflows-use-hashes` | Custom: GitHub Actions must use SHA pins |

#### FIPS Compatibility

- **No non-compliant crypto imports** found (no `crypto/md5`, `crypto/des`, `crypto/rc4`, `math/rand`)
- **Build tags**: `GOEXPERIMENT=strictfipsruntime` set in Dockerfile ENV
- **Build flags**: `-tags=strictfipsruntime,openssl` for native builds, `-tags=strictfipsruntime` for cross-builds
- **Base images**: UBI9 (FIPS-capable) — `registry.access.redhat.com/ubi9/go-toolset`, `registry.access.redhat.com/ubi9/ubi-minimal`
- **OpenSSL**: Installed in runtime image (`microdnf install openssl`)
- **CGO**: `CGO_ENABLED=1` for native builds (full OpenSSL FIPS), `CGO_ENABLED=0` for cross-builds (pure Go FIPS)

#### Dependency Alerts

- **Dependabot** configured in `.github/dependabot.yml`:
  - `github-actions`: daily updates
  - `gomod`: daily updates, grouped K8s dependencies (`k8s.io/*`, `sigs.k8s.io/*`)
  - `docker`: weekly updates
- All three relevant ecosystems covered with sensible grouping

### Agent Rules

**Score: 6.0/10**

**Present:**
- `CLAUDE.md` in repository root — comprehensive (200+ lines):
  - Project overview with rename context (LlamaStack → OGX)
  - Build and development commands with examples
  - Running specific tests, E2E tests
  - Image and deployment commands
  - Detailed architecture: reconciliation pipeline, key packages, distribution resolution, resource ownership, ConfigMap cache design
  - Code conventions: error messages, import ordering, linter config, test patterns, pre-commit hooks, code generation

**Missing:**
- No `.claude/` directory
- No `.claude/rules/` with test-specific rules
- No `.claude/skills/` with custom skills
- No `AGENTS.md` content
- No test creation rules (unit test patterns, E2E patterns, webhook test patterns)
- No quality gate checklists for AI-generated code

**Recommendation**: Use `/test-rules-generator` to generate rules based on existing test patterns. Priority rules:
1. Unit test patterns (table-driven with testify, envtest setup)
2. Controller test patterns (shared `TestMain`, envtest environment)
3. E2E test patterns (Kind cluster, OGXServer lifecycle)
4. CRD validation test patterns (CEL, webhook)

## Recommendations

### Priority 0 (Critical)

1. **Set meaningful limgo coverage thresholds** — Update `.limgo.json` with non-zero thresholds (e.g., `"statements": 60, "lines": 60`) and ensure `code-coverage.yml` fails when thresholds are breached. This is a ~2 hour change that immediately prevents coverage regressions.

2. **Add Codecov integration for PR coverage reporting** — Add `.codecov.yml` and `codecov/codecov-action` to `code-coverage.yml`. This provides inline PR coverage diffs, historical trends, and can enforce per-PR coverage requirements. Extend coverage workflow to also run on PRs to `main` branch.

### Priority 1 (High Value)

3. **Add K8s version matrix to E2E tests** — Modify `run-e2e-test.yml` to test against 2-3 Kind versions (e.g., K8s 1.29, 1.30, 1.31). The operator targets both vanilla K8s and OpenShift, making multi-version testing important.

4. **Create `.claude/rules/` for test automation** — Generate rules for:
   - `unit-tests.md`: Table-driven tests, testify assertions, envtest patterns
   - `e2e-tests.md`: Kind cluster, OGXServer lifecycle, test options
   - `webhook-tests.md`: CEL validation, webhook admission tests
   - `controller-tests.md`: Reconciler testing, status updates, error handling

5. **Add container HEALTHCHECK and startup validation** — Add `HEALTHCHECK` to Dockerfiles and/or a lightweight test that builds the image, starts the container, and verifies the manager binary starts without errors.

### Priority 2 (Nice-to-Have)

6. **Add contract tests for distribution resolution** — Test the boundary between distribution config (`distributions.json`, ConfigMap overrides, CR image overrides) and the reconciler's image selection logic.

7. **Add webhook validation fuzz testing** — The CRD has complex validation (CEL + Go webhook). Property-based or fuzz testing would catch edge cases in validation logic.

8. **Consider periodic scheduled test runs** — Currently all tests are PR/push triggered. A nightly or weekly scheduled run would catch flakiness and time-dependent issues.

9. **Align coverage workflow branches** — `code-coverage.yml` runs on PRs to `odh` but E2E runs on PRs to `main`. Consider running coverage on both branches for consistent reporting.

## Comparison to Gold Standards

| Dimension | ogx-k8s-operator | odh-dashboard | notebooks | kserve |
|-----------|-----------------|---------------|-----------|--------|
| Unit Tests | 8/10 — testify + envtest | 9/10 — Jest + RTL | 6/10 — Minimal | 8/10 — Go testing + envtest |
| Integration/E2E | 8/10 — Kind + CI | 9/10 — Cypress + CI | 7/10 — Multi-layer | 9/10 — Multi-version |
| Build Integration | 8/10 — Konflux + pre-commit | 8/10 — Webpack + CI | 7/10 — Image builds | 7/10 — Basic CI |
| Image Testing | 6/10 — Multi-arch UBI9 | 7/10 — Multi-stage | 9/10 — 5-layer validation | 6/10 — Basic |
| Coverage Tracking | 5/10 — limgo, no thresholds | 8/10 — Codecov enforced | 5/10 — Basic | 8/10 — Codecov enforced |
| CI/CD Automation | 8/10 — Mergify + release | 9/10 — Comprehensive | 7/10 — Matrix | 8/10 — Matrix |
| Static Analysis | 9/10 — All linters + FIPS | 8/10 — ESLint strict | 6/10 — Basic | 7/10 — golangci-lint |
| Agent Rules | 6/10 — CLAUDE.md only | 8/10 — Full rules | 3/10 — None | 4/10 — Basic |
| **Overall** | **7.5/10** | **8.5/10** | **6.5/10** | **7.5/10** |

**Key Differentiators vs Gold Standards:**
- **Excels**: Static analysis is best-in-class with all-enabled golangci-lint v2 and comprehensive pre-commit hooks
- **Matches**: E2E and build integration are on par with top-tier repos
- **Lags**: Coverage enforcement (zero thresholds), container testing, and agent rules compared to odh-dashboard

## File Paths Reference

### CI/CD
- `.github/workflows/pre-commit.yml` — Lint, format, manifest gen (PR + push)
- `.github/workflows/code-coverage.yml` — Coverage reporting (PR to odh)
- `.github/workflows/run-e2e-test.yml` — E2E with Kind (PR to main)
- `.github/workflows/build-image.yml` — Multi-arch image build (merged to main)
- `.github/workflows/main-build-image.yml` — ODH multi-arch image build
- `.github/workflows/odh-build-image.yml` — ODH single-arch image build
- `.github/workflows/generate-release.yml` — Automated release pipeline
- `.github/workflows/release-image.yml` — Release image build
- `.github/workflows/disconnected-readiness.yml` — Disconnected env check
- `.github/mergify.yml` — Auto-merge configuration
- `.tekton/odh-ogx-k8s-operator-pull-request.yaml` — Konflux PR pipeline
- `.tekton/odh-ogx-k8s-operator-push.yaml` — Konflux push pipeline

### Testing
- `controllers/suite_test.go` — envtest setup with TestMain
- `controllers/ogxserver_controller_test.go` — Main controller tests
- `api/v1beta1/ogxserver_cel_test.go` — CEL validation tests
- `api/v1beta1/ogxserver_webhook_test.go` — Webhook tests
- `tests/e2e/e2e_test.go` — E2E test runner
- `tests/e2e/creation_test.go` — OGXServer creation tests
- `tests/e2e/deletion_test.go` — OGXServer deletion tests
- `tests/e2e/tls_test.go` — TLS configuration tests
- `tests/e2e/validation_test.go` — Validation tests
- `tests/e2e/rollout_test.go` — Rollout tests

### Static Analysis
- `.golangci.yml` — golangci-lint v2 configuration (all linters enabled)
- `.pre-commit-config.yaml` — 12+ pre-commit hooks
- `.github/dependabot.yml` — Dependabot for gomod, actions, docker
- `.limgo.json` — Coverage thresholds (currently zero)
- `hack/check_go_errors.py` — Custom error message linter
- `hack/check-workflows-uses-hashes.sh` — GitHub Actions SHA-pinning check

### Container Images
- `Dockerfile` — Main operator multi-arch image (UBI9, FIPS)
- `ogx-module/Dockerfile` — OGX module operator image (UBI9)
- `.dockerignore` — Excludes bin/, testbin/

### Agent Rules
- `CLAUDE.md` — Comprehensive project guide for Claude Code
- `Makefile` — Build, test, deploy, release targets
