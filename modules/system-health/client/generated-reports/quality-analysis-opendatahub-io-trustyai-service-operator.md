---
repository: "opendatahub-io/trustyai-service-operator"
overall_score: 6.4
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Strong Ginkgo v2 + envtest suite with 53 test files across all 6 controllers"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "PR-triggered Kind smoke test + operator-chaos shift-left validation, single K8s version"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR builds Docker image, deploys to Kind, OPA policy checks on all kustomize targets"
  - dimension: "Image Testing"
    score: 6.0
    status: "Multi-stage UBI builds with multi-arch support, limited runtime validation"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "Generates cover.out but no CI reporting, no thresholds, no PR gates"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "14 workflows covering diverse concerns but missing concurrency, caching, and timeouts"
  - dimension: "Static Analysis"
    score: 6.0
    status: "yamllint + OPA policies + Dependabot, but no golangci-lint or pre-commit"
  - dimension: "Agent Rules"
    score: 7.0
    status: "Comprehensive 14KB CLAUDE.md with architecture docs, no .claude/rules/ directory"
critical_gaps:
  - title: "No coverage reporting or enforcement in CI"
    impact: "Coverage regressions go undetected; no PR gates prevent merging untested code"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No golangci-lint configuration"
    impact: "Only go fmt/vet run; misses dozens of useful lint checks (errcheck, staticcheck, gosimple, etc.)"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No concurrency control or caching in CI workflows"
    impact: "Duplicate workflow runs waste resources; no Go module or build caching slows CI"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "Single K8s version in smoke tests"
    impact: "Operator compatibility with other K8s/OCP versions is not validated at PR time"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add Codecov integration with coverage thresholds"
    effort: "2-4 hours"
    impact: "Automated coverage reporting on PRs with regression prevention"
  - title: "Add golangci-lint configuration"
    effort: "2-3 hours"
    impact: "Catch common Go bugs, code smells, and style issues before merge"
  - title: "Add concurrency control to PR workflows"
    effort: "1 hour"
    impact: "Cancel stale workflow runs when new commits are pushed, saving CI resources"
  - title: "Add Go module caching to CI workflows"
    effort: "1-2 hours"
    impact: "Faster CI runs by caching downloaded Go modules"
recommendations:
  priority_0:
    - "Add Codecov/Coveralls integration with minimum coverage threshold (e.g., 60%) to prevent regressions"
    - "Add golangci-lint with a curated set of linters (errcheck, staticcheck, gosimple, unused, govet)"
  priority_1:
    - "Add concurrency control and Go module caching to all CI workflows"
    - "Expand smoke tests to cover multiple K8s versions via matrix strategy"
    - "Add .claude/rules/ directory with test creation patterns for Ginkgo + envtest"
  priority_2:
    - "Add pre-commit hooks for fmt, vet, and lint checks"
    - "Add Testcontainers-based runtime validation for operator image"
    - "Add timeout-minutes to all workflow jobs to prevent runaway builds"
---

# Quality Analysis: trustyai-service-operator

## Executive Summary

- **Overall Score: 6.4/10**
- **Repository Type:** Multi-service Kubernetes operator (kubebuilder)
- **Primary Language:** Go (187 files)
- **Jira:** RHOAIENG / AI Safety (midstream tier)
- **Key Strengths:** Excellent unit test organization with Ginkgo v2 + envtest, comprehensive CLAUDE.md, innovative shift-left testing with operator-chaos and OPA/conftest policies, PR-triggered smoke tests with Kind cluster
- **Critical Gaps:** No coverage reporting/enforcement, no golangci-lint, no CI caching or concurrency control
- **Agent Rules Status:** Present — comprehensive CLAUDE.md (14KB), no .claude/rules/

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.0/10 | 15% | 1.20 | Strong Ginkgo v2 + envtest suite across all controllers |
| Integration/E2E | 7.0/10 | 20% | 1.40 | Kind smoke test + operator-chaos, single K8s version |
| Build Integration | 7.0/10 | 15% | 1.05 | PR Docker build + Kind deploy + OPA policy checks |
| Image Testing | 6.0/10 | 10% | 0.60 | Multi-stage UBI builds, limited runtime validation |
| Coverage Tracking | 3.0/10 | 10% | 0.30 | cover.out generated but no CI reporting or gates |
| CI/CD Automation | 6.0/10 | 15% | 0.90 | 14 workflows, missing concurrency/caching/timeouts |
| Static Analysis | 6.0/10 | 10% | 0.60 | yamllint + OPA + Dependabot, no golangci-lint |
| Agent Rules | 7.0/10 | 5% | 0.35 | Comprehensive CLAUDE.md, no .claude/rules/ |
| **Overall** | **6.4/10** | **100%** | **6.40** | |

## Critical Gaps

### 1. No Coverage Reporting or Enforcement in CI
- **Impact:** Coverage regressions go undetected; no PR gates prevent merging untested code
- **Severity:** HIGH
- **Effort:** 2-4 hours
- **Details:** The Makefile generates `cover.out` via `--coverprofile`, but this file is never uploaded to Codecov/Coveralls, no thresholds are enforced, and PRs show no coverage delta. There is no `.codecov.yml` configuration.
- **Fix:** Add `codecov/codecov-action` to `controller-tests.yaml` and create `.codecov.yml` with a minimum threshold.

### 2. No golangci-lint Configuration
- **Impact:** Only `go fmt` and `go vet` run; misses dozens of useful lint checks
- **Severity:** HIGH
- **Effort:** 2-3 hours
- **Details:** The project relies solely on `go fmt` and `go vet` for static analysis. golangci-lint would catch common Go bugs via errcheck, staticcheck, gosimple, unused, ineffassign, and many other linters. The gosec workflow exists but only produces SARIF output with `--no-fail` flag.
- **Fix:** Add `.golangci.yaml` with curated linters and a CI workflow step.

### 3. No Concurrency Control or Caching in CI
- **Impact:** Duplicate workflow runs waste resources; slow CI without Go module caching
- **Severity:** MEDIUM
- **Effort:** 2-3 hours
- **Details:** None of the 14 workflows use `concurrency:` groups to cancel stale runs. No workflow uses `actions/cache` for Go modules or build artifacts.

### 4. Single K8s Version in Smoke Tests
- **Impact:** Operator compatibility with other K8s/OCP versions is not validated
- **Severity:** MEDIUM
- **Effort:** 4-6 hours
- **Details:** Smoke tests use `kindest/node:v1.24.17` only. No matrix strategy for multiple K8s versions.

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
Add coverage uploading and threshold enforcement to CI:

```yaml
# In .github/workflows/controller-tests.yaml, after 'make test':
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: cover.out
    fail_ci_if_error: true
    token: ${{ secrets.CODECOV_TOKEN }}
```

```yaml
# .codecov.yml
coverage:
  status:
    project:
      default:
        target: 60%
        threshold: 2%
    patch:
      default:
        target: 70%
```

### 2. Add golangci-lint (2-3 hours)

```yaml
# .golangci.yaml
run:
  timeout: 5m

linters:
  enable:
    - errcheck
    - staticcheck
    - gosimple
    - unused
    - ineffassign
    - govet
    - revive
    - misspell
    - gofmt
    - goimports

linters-settings:
  revive:
    rules:
      - name: exported
        severity: warning
```

### 3. Add Concurrency Control (1 hour)
Add to all PR-triggered workflows:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

### 4. Add Go Module Caching (1-2 hours)
Add to workflows that run Go commands:

```yaml
- name: Setup Go
  uses: actions/setup-go@v5
  with:
    go-version-file: "go.mod"
    cache: true
```

## Detailed Findings

### Unit Tests

**Score: 8.0/10**

The project has excellent unit test coverage with 53 test files across 134 source files (ratio: 0.40).

**Strengths:**
- **Framework:** Ginkgo v2 + Gomega + controller-runtime envtest — the gold standard for Kubernetes operator testing
- **Organization:** Each controller has its own `suite_test.go` bootstrapping envtest, with focused test files per concern (e.g., `deployment_test.go`, `config_maps_test.go`, `statuses_test.go`)
- **Coverage breadth:** All 6 controller domains have tests: TAS (10), EvalHub (16), LMES (5), GORCH (4), NemoGuardrails (3), Module (2), plus utilities and image resolution
- **Test isolation:** `BeforeEach`/`AfterEach` for setup and cleanup, proper use of Ginkgo's `Describe`/`Context`/`It` BDD structure
- **envtest integration:** Tests run against a real API server with CRDs loaded from `config/crd/bases/`

**Gaps:**
- No `t.Parallel()` usage (Ginkgo handles parallelism differently via `ginkgo -p`, but not configured in CI)
- Coverage file generated but not analyzed or gated

**Key test files:**
- `controllers/evalhub/` — 16 test files covering controller, deployment, configmap, RBAC, MCP, tenancy, status, and more
- `controllers/tas/` — 10 test files for TrustyAIService controller
- `controllers/lmes/` — 5 test files including validation testing
- `controllers/gorch/` — 4 test files including config generation
- `controllers/nemo_guardrails/` — 3 test files including MCP gateway
- `pkg/tls/`, `pkg/configmap/` — utility package tests

### Integration/E2E Tests

**Score: 7.0/10**

**Strengths:**
- **PR-triggered smoke test** (`smoke.yaml`): Builds Docker image → creates Kind cluster → loads image → installs CRDs → deploys operator via kustomize → creates TrustyAIService CR → verifies PVC, Services, Deployment creation → validates webhook conversion (v1alpha1 → v1) → cleanup. This is a genuine end-to-end deployment validation.
- **Operator-chaos** (`operator-chaos.yml`): Innovative shift-left upgrade validation that catches breaking CRD schema changes and knowledge model regressions without a cluster. Diffs CRD schemas and knowledge models between base and PR branches.
- **Conftest/OPA** (`conftest.yaml`): Policy-as-code validation of all kustomize-rendered manifests for RBAC correctness, ClusterRole content, and selector hygiene.
- **Disconnected readiness** (`disconnected-readiness.yaml`): Validates the operator works in disconnected/air-gapped environments.

**Gaps:**
- Smoke tests only use `kindest/node:v1.24.17` — no multi-version K8s testing
- No matrix strategy for testing across K8s versions
- E2E tests reference external `trustyai-tests` repo but those are not run in this repo's CI
- No contract testing between operator and managed services

### Build Integration

**Score: 7.0/10**

**Strengths:**
- **PR-time Docker build:** `smoke.yaml` builds the operator image on every PR and loads it into Kind
- **Kustomize validation:** conftest checks all 9 kustomize entry points (base + 8 overlays)
- **OPA policies:** Closed-allowlist RBAC validation via `policy/rbac.rego` and `policy/clusterrole.rego` — any unauthorized RBAC resource is denied
- **CRD installation testing:** Smoke test applies external CRDs and deploys the full operator
- **Operator manifest testing:** `components-validate` Makefile target builds all component kustomizations

**Gaps:**
- No Konflux build simulation — issues may only surface post-merge in Konflux
- Build validation is only via the testing overlay, not ODH/RHOAI overlays
- No explicit `kubectl apply --dry-run` validation outside of full deployment

### Image Testing

**Score: 6.0/10**

**Strengths:**
- **5 Dockerfiles** covering different components: main operator, driver, lmes-job, orchestrator, test
- **Multi-stage builds:** Separate builder and runtime stages for smaller, secure images
- **UBI base images:** All production images use `registry.access.redhat.com/ubi*` (FIPS-capable)
- **Multi-arch support:** TARGETOS/TARGETARCH build args, `docker-buildx` Makefile target
- **Non-root runtime:** Runs as UID 65532:65532
- **Health checks:** Liveness (`/healthz`) and readiness (`/readyz`) probes configured in manager manifest

**Gaps:**
- No Testcontainers-based runtime validation
- No container startup testing beyond the smoke test deployment
- No explicit image scanning in PR workflow (security-scan runs Trivy but is separate)
- Dockerfile.orchestrator uses `rust:1.87.0` (non-UBI) as builder — only the final stage uses UBI

### Coverage Tracking

**Score: 3.0/10**

**Strengths:**
- `make test` generates `cover.out` via `--coverprofile`

**Gaps:**
- No `.codecov.yml` or Codecov/Coveralls integration
- No coverage thresholds enforced
- No PR coverage reporting — reviewers cannot see coverage impact
- `cover.out` file is generated but never uploaded or analyzed in CI
- No coverage gates to prevent merging code that reduces coverage

### CI/CD Automation

**Score: 6.0/10**

**Workflows (14 total):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `controller-tests.yaml` | push, PR | Run `make test` (unit tests with envtest) |
| `smoke.yaml` | PR | Build image + Kind deploy + smoke tests |
| `operator-chaos.yml` | PR (path-filtered) | Shift-left upgrade validation |
| `conftest.yaml` | push, PR | OPA manifest policy checks |
| `lint-yaml.yaml` | push, PR | YAML linting |
| `gosec.yaml` | PR | Security scanning (SARIF) |
| `security-scan.yaml` | push, PR | Trivy vulnerability scan |
| `disconnected-readiness.yaml` | push, PR | Disconnected readiness scoring |
| `disconnected-readiness.yml` | PR | Reusable disconnected readiness check |
| `auto-merge-upstream-sync.yaml` | PR | Auto-merge pull[bot] sync PRs |
| `sync-branch-incubation.yaml` | push (main) | Sync main → incubation branch |
| `sync-branch-stable.yaml` | push (incubation) | Sync incubation → stable branch |

**Strengths:**
- Good breadth of PR checks across testing, security, policy, and deployment
- Tiered naming (Tier 1 / Tier 2) for workflow categorization
- Path-filtered triggers for operator-chaos (only runs when relevant files change)
- Branch sync automation (main → incubation → stable)

**Gaps:**
- **No concurrency control:** Duplicate runs for same PR waste resources
- **No caching:** Go modules downloaded fresh on every run
- **No timeout-minutes:** Jobs could run indefinitely
- **No test parallelization:** All tests run sequentially
- **Outdated action versions:** Some use `@v2` and `@v3` instead of latest pinned SHAs
- **gosec runs with `--no-fail`:** Security findings don't fail the build

### Static Analysis

**Score: 6.0/10**

**Strengths:**
- **YAML linting:** `.yamllint.yaml` configured with custom rules for `config/**/*.yaml`
- **OPA/Rego policies:** Sophisticated policy-as-code for RBAC validation — this is above average for most repositories
- **Dependabot:** Configured for `gomod` ecosystem with weekly schedule
- **FIPS compatibility:** All production Dockerfiles use UBI base images
- **gosec:** Security scanner configured (though non-blocking)

**Gaps:**
- **No golangci-lint:** The most impactful missing tool — only `go fmt` and `go vet` are used
- **No pre-commit hooks:** No `.pre-commit-config.yaml` for local developer enforcement
- **FIPS build tags:** No `-tags=fips` or `GOEXPERIMENT=boringcrypto` in builds (may be handled downstream)
- **Dependabot scope:** Only covers `gomod`, not `docker` or `github-actions` ecosystems
- **math/rand import:** Found in `controllers/lmes/driver/driver_test.go:23` — acceptable in test code but worth noting

### Agent Rules

**Score: 7.0/10**

**Strengths:**
- **Comprehensive CLAUDE.md (14KB):** One of the most thorough CLAUDE.md files seen across analyzed repositories
  - Build, test, deploy, and debug instructions
  - Complete architecture documentation (service registration, reconciliation pattern, scheme registration)
  - Detailed project structure with file paths
  - Key dependencies table with versions
  - CI/CD workflow descriptions
  - EvalHub-specific architecture (metrics, tenancy, provider/collection ConfigMaps)
  - Code generation instructions
  - Manifest policy documentation
- **Test instructions:** Clear `make test` instructions with envtest details, per-controller test commands

**Gaps:**
- **No `.claude/rules/` directory:** No specific test creation rules for AI agents
- **No AGENTS.md:** Only CLAUDE.md present
- **No test pattern examples:** CLAUDE.md describes the test framework but doesn't provide templates for writing new tests
- **Missing:** Rules for Ginkgo test patterns, envtest setup boilerplate, assertion patterns

## Recommendations

### Priority 0 (Critical)

1. **Add Codecov integration with coverage thresholds**
   - Upload `cover.out` to Codecov in `controller-tests.yaml`
   - Create `.codecov.yml` with project target ≥60% and patch target ≥70%
   - This is the highest-ROI improvement — 2-4 hours for permanent regression prevention

2. **Add golangci-lint configuration**
   - Create `.golangci.yaml` with errcheck, staticcheck, gosimple, unused, revive
   - Add lint step to CI (or create dedicated `lint.yaml` workflow)
   - Catches common Go bugs that fmt/vet miss

### Priority 1 (High Value)

3. **Add concurrency control and caching to CI workflows**
   - Add `concurrency:` groups to all PR-triggered workflows
   - Use `actions/setup-go@v5` with `cache: true` for Go module caching
   - Add `timeout-minutes: 30` to all jobs

4. **Expand smoke test to multi-version K8s matrix**
   - Add matrix strategy testing K8s 1.27, 1.28, 1.29
   - Validates operator compatibility across versions

5. **Create .claude/rules/ for test automation**
   - Add `unit-tests.md` with Ginkgo + envtest patterns
   - Add `e2e-tests.md` with Kind deployment patterns
   - Include assertion patterns, test isolation patterns, and suite setup boilerplate

### Priority 2 (Nice-to-Have)

6. **Add pre-commit hooks**
   - `.pre-commit-config.yaml` with go fmt, go vet, yamllint hooks
   - Catches issues locally before CI

7. **Expand Dependabot ecosystem coverage**
   - Add `docker` ecosystem for base image updates
   - Add `github-actions` ecosystem for action version updates

8. **Add Testcontainers-based image validation**
   - Runtime validation of operator container startup
   - Verify health endpoints respond

9. **Make gosec blocking**
   - Remove `--no-fail` flag from gosec workflow
   - Or set a severity threshold for failure

## Comparison to Gold Standards

| Practice | trustyai-service-operator | odh-dashboard (gold) | notebooks (gold) | kserve (gold) |
|----------|--------------------------|---------------------|-------------------|---------------|
| Unit test framework | Ginkgo v2 + envtest | Jest + RTL | pytest | Go testing + envtest |
| Test-to-code ratio | 0.40 | ~0.50 | ~0.30 | ~0.45 |
| Coverage enforcement | No | Yes (Codecov) | Partial | Yes (Codecov) |
| E2E automation | Kind smoke test | Cypress E2E | Image validation | Kind + Kustomize |
| Multi-version testing | No | N/A | Matrix builds | Yes |
| golangci-lint | No | N/A (JS) | N/A | Yes |
| OPA/Conftest policies | Yes (innovative) | No | No | No |
| Operator-chaos | Yes (innovative) | No | N/A | No |
| CLAUDE.md | Yes (14KB, comprehensive) | Partial | No | No |
| .claude/rules/ | No | No | No | No |
| Dependabot | gomod only | npm | pip | gomod + docker |
| CI caching | No | Yes | Yes | Yes |
| Concurrency control | No | Yes | Yes | Yes |

**Notable strengths vs gold standards:**
- OPA/conftest policy validation is unique and above average — this is a practice other repos should adopt
- operator-chaos shift-left upgrade validation is innovative
- CLAUDE.md is among the most comprehensive seen

## File Paths Reference

### CI/CD
- `.github/workflows/controller-tests.yaml` — Unit tests
- `.github/workflows/smoke.yaml` — Smoke tests with Kind
- `.github/workflows/operator-chaos.yml` — Shift-left upgrade validation
- `.github/workflows/conftest.yaml` — OPA policy checks
- `.github/workflows/lint-yaml.yaml` — YAML linting
- `.github/workflows/gosec.yaml` — Security scanning
- `.github/workflows/security-scan.yaml` — Trivy scanning
- `.github/workflows/disconnected-readiness.yaml` — Disconnected readiness
- `.github/workflows/auto-merge-upstream-sync.yaml` — Auto-merge upstream sync
- `.github/workflows/sync-branch-incubation.yaml` — Branch sync main→incubation
- `.github/workflows/sync-branch-stable.yaml` — Branch sync incubation→stable

### Testing
- `controllers/tas/*_test.go` — TAS controller tests (10 files)
- `controllers/evalhub/*_test.go` — EvalHub controller tests (16 files)
- `controllers/lmes/*_test.go` — LMES controller tests (5 files)
- `controllers/gorch/*_test.go` — GORCH controller tests (4 files)
- `controllers/nemo_guardrails/*_test.go` — NemoGuardrails tests (3 files)
- `controllers/module/*_test.go` — Module controller tests (2 files)
- `controllers/images/*_test.go` — Image resolver tests (2 files)
- `controllers/utils/*_test.go` — Utility tests (1 file)
- `tests/smoke/test_smoke.sh` — Smoke test script

### Container Images
- `Dockerfile` — Main operator image (UBI9 go-toolset → UBI8 minimal)
- `Dockerfile.driver` — LMES driver image
- `Dockerfile.lmes-job` — LMES job image (Python 3.11)
- `Dockerfile.orchestrator` — Guardrails orchestrator (Rust + UBI)
- `tests/Dockerfile` — Test container image

### Configuration
- `Makefile` — Build targets including test with coverage
- `.yamllint.yaml` — YAML lint configuration
- `.github/dependabot.yml` — Dependency updates (gomod)
- `policy/*.rego` — OPA/Rego policies for RBAC validation
- `chaos/knowledge/trustyai.yaml` — Operator-chaos knowledge model
- `CLAUDE.md` — Agent rules (comprehensive)
- `config/overlays/` — 8 kustomize overlays (odh, rhoai, testing, etc.)
