---
repository: "red-hat-data-services/spark-operator"
overall_score: 8.0
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Strong test coverage with 69 test files, Ginkgo/Gomega + testify, envtest for webhook testing"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Comprehensive E2E with multi-version K8s matrix (v1.32-v1.35), Kind cluster, Helm + Kustomize deployment, chaos testing"
  - dimension: "Build Integration"
    score: 8.5
    status: "PR-time image build, Helm chart testing, Kustomize lint/drift, CRD validation, manifest generation checks"
  - dimension: "Image Testing"
    score: 6.5
    status: "Multi-stage Dockerfiles, UBI base for Konflux, Kind image loading, but no runtime validation or health checks"
  - dimension: "Coverage Tracking"
    score: 8.0
    status: "Codecov integration with unit + e2e-kustomize flags, auto threshold, PR reporting"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "26 workflows, PR-triggered, concurrency control, matrix strategy, module operator CI, chaos testing"
  - dimension: "Static Analysis"
    score: 8.0
    status: "golangci-lint v2 with custom linters, pre-commit hooks, Dependabot + Renovate, shell lint, one FIPS concern"
  - dimension: "Agent Rules"
    score: 8.0
    status: "Comprehensive CLAUDE.md with project structure, build/test/lint commands, key files, CI overview"
critical_gaps:
  - title: "crypto/md5 usage in production code"
    impact: "Non-FIPS-compliant hash function in pkg/util/sparkapplication.go may cause issues in FIPS-enforced environments"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container runtime validation"
    impact: "Image startup and functional behavior not validated after build — issues caught only at deployment time"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No coverage threshold enforcement"
    impact: "Coverage thresholds set to 'auto' with 1% tolerance — PRs can regress coverage without blocking"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Replace crypto/md5 with crypto/sha256 in pkg/util/sparkapplication.go"
    effort: "1-2 hours"
    impact: "Eliminates FIPS compliance concern in production code"
  - title: "Set explicit coverage thresholds in .codecov.yml"
    effort: "1 hour"
    impact: "Prevents coverage regression on PRs"
  - title: "Add .claude/rules/ with test creation guidelines"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality with framework-specific patterns (Ginkgo, envtest)"
recommendations:
  priority_0:
    - "Replace crypto/md5 with FIPS-compliant alternative (crypto/sha256) in pkg/util/sparkapplication.go"
    - "Add container runtime validation — test that the built image starts and responds to health probes"
  priority_1:
    - "Set explicit coverage thresholds (e.g., 60% project, 70% patch) in .codecov.yml"
    - "Add .claude/rules/ directory with Ginkgo/envtest test creation patterns"
    - "Add HEALTHCHECK instruction to Dockerfiles"
  priority_2:
    - "Add Testcontainers-based runtime validation for the operator image"
    - "Consolidate math/rand usage in test files to use crypto/rand or testing.T seed"
    - "Consider adding performance/load testing for Spark job submission throughput"
---

# Quality Analysis: red-hat-data-services/spark-operator

**Jira**: RHOAIENG / Kubeflow Spark Operator | **Tier**: downstream

## Executive Summary

- **Overall Score: 8.0/10**
- **Repository Type**: Kubernetes Operator (Go, controller-runtime)
- **Key Strengths**: Exceptionally well-organized CI/CD with 26 workflows covering unit, E2E, chaos, drift, and module testing; comprehensive E2E with multi-version K8s matrix (v1.32–v1.35) across both Helm and Kustomize deployment methods; strong CLAUDE.md providing detailed project context
- **Critical Gaps**: `crypto/md5` usage in production code (FIPS concern), no container runtime validation after build, coverage thresholds not enforced
- **Agent Rules Status**: Present — comprehensive CLAUDE.md, no `.claude/rules/` directory

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 8.5/10 | Strong coverage with 69 test files, Ginkgo/Gomega + testify, envtest for webhooks |
| Integration/E2E | 20% | 9.0/10 | Multi-version K8s matrix, Kind cluster, Helm + Kustomize, chaos testing, module E2E |
| Build Integration | 15% | 8.5/10 | PR-time image build, Helm chart testing, Kustomize lint/drift, CRD validation |
| Image Testing | 10% | 6.5/10 | Multi-stage builds, UBI for Konflux, but no runtime validation or health checks |
| Coverage Tracking | 10% | 8.0/10 | Codecov with unit + e2e flags, PR reporting, but thresholds set to auto |
| CI/CD Automation | 15% | 9.0/10 | 26 workflows, concurrency control, matrix strategy, comprehensive trigger coverage |
| Static Analysis | 10% | 8.0/10 | golangci-lint v2, pre-commit, Dependabot + Renovate, shell lint, one FIPS issue |
| Agent Rules | 5% | 8.0/10 | Excellent CLAUDE.md, missing .claude/rules/ for test patterns |

**Weighted Overall: 8.0/10**

## Critical Gaps

### 1. crypto/md5 Usage in Production Code
- **File**: `pkg/util/sparkapplication.go:20`
- **Impact**: `crypto/md5` is not FIPS-compliant. The Konflux Dockerfile correctly uses `GOEXPERIMENT=strictfipsruntime` and `-tags=strictfipsruntime`, but importing `crypto/md5` in production code contradicts FIPS enforcement and may cause runtime panics in strict FIPS environments.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Fix**: Replace `md5.Sum()` with `sha256.Sum256()` (or truncate if short hash is needed)

### 2. No Container Runtime Validation
- **Impact**: Images are built and loaded into Kind for E2E tests, but there is no explicit validation that the container starts correctly, responds to health probes, or runs the entrypoint as expected. Issues could be caught only during deployment.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Fix**: Add a post-build step that runs `docker run --rm <image> --version` or adds a Testcontainers test

### 3. Coverage Thresholds Not Enforced
- **File**: `.codecov.yml`
- **Impact**: Both `project` and `patch` thresholds are set to `target: auto` with `threshold: 1%`, meaning coverage can regress up to 1% per PR without failing. No hard floor prevents gradual erosion.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Fix**: Set explicit targets (e.g., `target: 60%` for project, `target: 70%` for patch)

## Quick Wins

### 1. Replace crypto/md5 with crypto/sha256
- **Effort**: 1-2 hours
- **Impact**: Eliminates FIPS compliance concern
- **Implementation**: In `pkg/util/sparkapplication.go`, replace `crypto/md5` import and `md5.Sum()` calls with `crypto/sha256` and `sha256.Sum256()`

### 2. Set Explicit Coverage Thresholds
- **Effort**: 1 hour
- **Impact**: Prevents gradual coverage regression
- **Implementation**:
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
        threshold: 5%
```

### 3. Add .claude/rules/ with Test Creation Guidelines
- **Effort**: 2-3 hours
- **Impact**: Improve AI-generated test quality
- **Implementation**: Create `.claude/rules/unit-tests.md` and `.claude/rules/e2e-tests.md` with Ginkgo/Gomega patterns, envtest setup, and test isolation guidelines. Use `/test-rules-generator` to bootstrap.

## Detailed Findings

### Unit Tests (8.5/10)

**Strengths:**
- **69 test files** across the codebase with a **0.49 test-to-code ratio** (69 test files / 140 source files)
- **Dual testing frameworks**: Ginkgo/Gomega for BDD-style tests + testify for assertion-heavy tests
- **envtest usage** for webhook testing (`internal/webhook/suite_test.go`) — runs against a real API server without a full cluster
- **Controller tests** cover reconciliation logic, submission, REST submission, web UI
- **Scheduler tests** for all three scheduler plugins (kubescheduler, volcano, yunikorn)
- **API defaults tests** (`api/v1beta2/defaults_test.go`)
- **Certificate management tests** (`pkg/certificate/`)
- **Coverage generation**: `make unit-test` generates `cover.out` with `--coverprofile`

**Test file distribution:**
- `internal/controller/` — 13 test files (reconcilers, submission, web UI)
- `internal/webhook/` — 7 test files (validators, defaulters, resource quota)
- `pkg/` — 8 test files (util, certificate, features)
- `test/` — 7 test files (e2e, kustomize, drift)
- `spark-operator-module/` — 6 test files (module operator)
- `examples/openshift/kueue/` — 5 test files (Kueue integration)
- `charts/` — 20 Helm chart unit tests

**Areas for improvement:**
- No `t.Parallel()` detected in test files — could improve test execution speed
- `math/rand` used in Kueue test files (4 occurrences) — should use `testing.T`-seeded rand or `crypto/rand`

### Integration/E2E Tests (9.0/10)

**Strengths:**
- **Multi-version K8s testing**: Matrix tests against K8s v1.32.11, v1.33.7, v1.34.3, v1.35.0
- **Dual deployment method**: Tests with both `helm` and `kustomize` installation
- **Kind cluster**: Automated cluster creation, image building, and loading
- **Comprehensive E2E suite** (`test/e2e/`):
  - `sparkapplication_test.go` — Core SparkApplication lifecycle
  - `scheduledsparkapplication_test.go` — Cron-based scheduling
  - `sparkconnect_test.go` — SparkConnect (alpha)
  - `namespace_filtering_test.go` — Multi-namespace support
  - `pdb_test.go` — PodDisruptionBudget
- **Kustomize E2E** (`kustomize-e2e.yaml`): Separate E2E for Kustomize deployment across 9 K8s versions (v1.24–v1.32)
- **OpenShift integration tests**: Spark Pi and Docling workloads via shell scripts
- **ScheduledSpark smoke test**: Validates RBAC and scheduling workflow
- **Module operator E2E**: Separate test suite for spark-operator-module with envtest
- **Chaos testing**: `operator-chaos` integration validates knowledge model, CRD schema drift, upgrade simulation
- **Kustomize drift detection**: Automated check for semantic drift between Helm chart and Kustomize manifests
- **Debug on failure**: Cluster state, events, and operator logs captured on test failure

**Areas for improvement:**
- Kustomize E2E tests older K8s versions (v1.24–v1.32) vs main E2E (v1.32–v1.35) — could consolidate version ranges

### Build Integration (8.5/10)

**Strengths:**
- **PR-time image build**: `integration.yaml` builds the operator binary (`make build-operator`) on every PR
- **Docker image build + Kind load**: E2E jobs build Docker image and load into Kind cluster
- **Helm chart testing**: Comprehensive chart-testing pipeline — lint, unittest, install
- **Kustomize validation**: `kustomize-lint.yaml` validates Kustomize manifests build correctly
- **Kustomize drift check**: `kustomize-drift-check.yaml` detects semantic drift between Helm and Kustomize
- **CRD drift detection**: `make detect-crds-drift` ensures CRDs are synchronized
- **Manifest generation validation**: `make manifests` and `make generate` run with git diff checks
- **Code generation verification**: `make verify-codegen` in PR workflow
- **Module operator build**: Separate Dockerfile and CI for spark-operator-module

**Konflux integration:**
- `Dockerfile.konflux` with UBI9 base images, FIPS build tags, proper labeling
- `rpms.lock.yaml` and `rpms.in.yaml` for reproducible RPM dependencies
- Renovate configured to pull from `red-hat-data-services/konflux-central` defaults

**Areas for improvement:**
- No explicit Konflux build simulation in PR workflow (relies on post-merge Konflux)

### Image Testing (6.5/10)

**Strengths:**
- **Multi-stage builds**: Both `Dockerfile` and `Dockerfile.konflux` use multi-stage builds
- **UBI base images**: `Dockerfile.konflux` uses `ubi9/go-toolset` (builder) and UBI-based runtime image
- **Build caching**: `RUN --mount=type=cache` for Go module and build caches
- **TARGETARCH support**: Multi-architecture build argument support in Dockerfiles
- **Multi-arch manifests**: `pushImageToDPQuay.yaml` creates multi-arch manifest lists
- **Kind image loading**: Images built and loaded into Kind for E2E testing
- **Module controller Dockerfile**: Separate `spark-operator-module-controller.Dockerfile` with UBI9 minimal

**Areas for improvement:**
- **No HEALTHCHECK instruction** in any Dockerfile
- **No container runtime validation** — no `docker run` smoke test after build
- **No Testcontainers** usage for runtime validation
- **No readiness/liveness probe testing** in CI (only exercised in E2E via operator deployment)
- Upstream `Dockerfile` uses `docker.io/library/spark:4.0.1` (non-UBI) as runtime base — only the Konflux variant uses UBI

### Coverage Tracking (8.0/10)

**Strengths:**
- **Codecov integration**: Dedicated `codecov.yaml` workflow uploads coverage on push and PR
- **Separate coverage flags**: `unit` and `e2e-kustomize` flags for independent tracking
- **Coverage generation**: `make unit-test` generates `cover.out` with `--coverprofile`
- **E2E coverage**: Kustomize E2E uploads `cover-e2e-kustomize.out` to Codecov
- **PR reporting**: Codecov comment with `reach,diff,flags,files` layout
- **Path exclusions**: E2E test paths excluded from unit coverage flag

**Areas for improvement:**
- **Thresholds set to auto**: `target: auto` with `threshold: 1%` — no hard coverage floor
- **No coverage gate**: PRs won't fail on coverage regression beyond 1%
- **HTML report**: `make unit-test` generates `cover.html` locally but it's not published

### CI/CD Automation (9.0/10)

**Strengths:**
- **26 workflow files** covering the full development lifecycle
- **PR-triggered workflows**: Integration, Kustomize lint, drift check, shell lint, disconnected readiness, chaos testing
- **Concurrency control**: All critical workflows use `cancel-in-progress: true` with proper grouping
- **Matrix strategy**: E2E tests across 4 K8s versions x 2 deployment methods (8 combinations)
- **Path-based triggers**: Workflows only run when relevant files change
- **Timeout management**: Chaos workflow has `timeout-minutes: 15`, smoke test has `timeout-minutes: 20`
- **Release automation**: `release.yaml`, `release-latest-images.yaml`, `release-helm-charts.yaml`
- **Scorecard**: OPA Scorecard testing workflow
- **Stale issue management**: `stale.yaml` for issue/PR cleanup
- **Welcome bot**: `welcome-new-contributors.yaml` for community engagement
- **Self-hosted runners**: Docling E2E uses EC2 runners for larger resources
- **Reusable workflows**: `_run-kustomize-e2e.yaml` shared across multiple callers

**Workflow inventory:**
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `integration.yaml` | PR + push | Code check, unit test, build, helm test, e2e |
| `kustomize-e2e.yaml` | PR + push | Kustomize deployment E2E (9 K8s versions) |
| `kustomize-lint.yaml` | PR + push | Kustomize manifest validation |
| `kustomize-drift-check.yaml` | PR + push | Helm ↔ Kustomize drift detection |
| `codecov.yaml` | PR + push | Coverage upload |
| `operator-chaos.yaml` | PR | CRD/knowledge model chaos testing |
| `shell-lint.yaml` | PR + push | Shell script formatting and linting |
| `spark-operator-module-ci.yaml` | PR | Module operator tests |
| `scheduledspark-smoke.yaml` | PR + push | ScheduledSpark RBAC + smoke |
| `integration-odh.yaml` | push + dispatch | ODH Spark Pi E2E |
| `openshift-docling-e2e.yaml` | push + dispatch | Docling workload E2E (EC2) |
| `disconnected-readiness.yml` | PR | Disconnected readiness check |
| `build-quay.yaml` | dispatch | Build and push to Quay |
| `release.yaml` | push tag | Full release pipeline |
| `docs.yaml` | push + PR | Documentation build |
| `scorecard.yaml` | push + PR | OPA scorecard tests |

### Static Analysis (8.0/10)

**Strengths:**

#### Linting
- **golangci-lint v2** (v2.1.6) with custom configuration
- **Enabled linters**: copyloopvar, dupword, importas, predeclared, tagalign, unconvert, unused
- **Import alias enforcement**: Consistent K8s API import aliases
- **Go fmt/vet**: Run as part of PR checks with git diff validation
- **goimports formatter**: Configured in golangci-lint
- **Shell linting**: shellcheck + shfmt via pre-commit hooks and dedicated workflow

#### Pre-commit Hooks
- **helm-docs**: Auto-generate Helm chart documentation
- **shfmt**: Shell script formatting
- **shellcheck**: Shell script linting

#### FIPS Compatibility
- **Konflux Dockerfile**: Correctly uses `GOEXPERIMENT=strictfipsruntime` and `-tags=strictfipsruntime`
- **UBI base images**: Konflux build uses `ubi9/go-toolset` and UBI-based runtime
- **Concern**: `crypto/md5` imported in `pkg/util/sparkapplication.go:20` — this is a non-FIPS-compliant hash algorithm that may cause runtime panics under `strictfipsruntime`
- **Test-only**: `math/rand` in 4 Kueue test files — acceptable in test context but not ideal

#### Dependency Alerts
- **Dependabot**: Configured for `gomod`, `docker`, `github-actions`, and `uv` ecosystems with weekly schedule
- **Renovate**: Configured extending `red-hat-data-services/konflux-central` defaults
- **Both present**: Dual dependency management covers different update scenarios

### Agent Rules (8.0/10)

**Strengths:**
- **CLAUDE.md present**: Comprehensive documentation covering:
  - Tech stack and project structure
  - Detailed Kustomize install configuration explanation
  - Container image configuration with params.env mapping
  - Build, test, lint commands with clear examples
  - Two test workflows (Helm E2E + Kustomize integration) documented separately
  - Key files listing with descriptions
  - CI workflow summary
  - Debugging guidance

**Areas for improvement:**
- **No `.claude/` directory**: Missing `.claude/rules/` for framework-specific test creation guidance
- **No AGENTS.md**: Missing general AI agent guidelines
- **No test patterns**: CLAUDE.md documents commands but not Ginkgo/Gomega patterns, envtest setup, or test structure conventions
- **Recommendation**: Generate test creation rules with `/test-rules-generator` to capture Ginkgo `Describe/It/BeforeEach` patterns, envtest boilerplate, and Helm chart test structure

## Recommendations

### Priority 0 (Critical)

1. **Replace `crypto/md5` with FIPS-compliant alternative**
   - File: `pkg/util/sparkapplication.go`
   - Replace `crypto/md5` with `crypto/sha256` to avoid `strictfipsruntime` panics
   - Verify no downstream consumers depend on the MD5 hash format

2. **Add container runtime validation**
   - Add a post-build step in CI that validates the image starts correctly
   - Example: `docker run --rm <image> spark-operator version`
   - Consider adding HEALTHCHECK to Dockerfiles

### Priority 1 (High Value)

3. **Enforce explicit coverage thresholds**
   - Set `target: 60%` for project, `target: 70%` for patch in `.codecov.yml`
   - This prevents gradual coverage erosion across PRs

4. **Add `.claude/rules/` for test automation**
   - Create `unit-tests.md` with Ginkgo patterns (Describe/Context/It, BeforeEach, envtest setup)
   - Create `e2e-tests.md` with E2E patterns (Kind cluster, Helm/Kustomize deployment)
   - Create `helm-tests.md` with Helm unittest patterns

5. **Add HEALTHCHECK to Dockerfiles**
   - Both `Dockerfile` and `Dockerfile.konflux` lack HEALTHCHECK instructions
   - Add: `HEALTHCHECK --interval=30s CMD ["/usr/bin/spark-operator", "version"]`

### Priority 2 (Nice-to-Have)

6. **Add `t.Parallel()` to unit tests**
   - Enable parallel test execution for faster CI feedback
   - Verify no shared state conflicts before enabling

7. **Consolidate K8s version matrices**
   - Main E2E tests v1.32–v1.35, Kustomize E2E tests v1.24–v1.32
   - Consider aligning to a single set of supported versions

8. **Add performance/load testing**
   - Test Spark job submission throughput under load
   - Validate controller performance with many concurrent SparkApplications

## Comparison to Gold Standards

| Dimension | spark-operator | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit Tests | 8.5 — 69 test files, Ginkgo + testify | 9.0 — Multi-layer | 7.0 — Focused | 8.5 — Comprehensive |
| Integration/E2E | 9.0 — Multi-version matrix, chaos | 9.0 — Contract tests | 8.0 — Image tests | 9.0 — Multi-version |
| Build Integration | 8.5 — Helm + Kustomize validation | 8.0 — Module Fed | 7.0 — Image builds | 7.5 — Operator builds |
| Image Testing | 6.5 — Build only, no runtime | 6.0 — Basic | 9.0 — 5-layer | 6.0 — Basic |
| Coverage Tracking | 8.0 — Codecov, dual flags | 8.5 — Enforced | 6.0 — Basic | 8.0 — Enforced |
| CI/CD Automation | 9.0 — 26 workflows | 9.0 — Comprehensive | 8.0 — Solid | 8.5 — Well-organized |
| Static Analysis | 8.0 — Lint + FIPS concern | 8.0 — ESLint | 7.0 — Basic | 7.5 — golangci-lint |
| Agent Rules | 8.0 — Good CLAUDE.md | 9.0 — Full rules | 3.0 — None | 4.0 — Minimal |
| **Overall** | **8.0** | **8.5** | **7.0** | **7.5** |

## File Paths Reference

### CI/CD
- `.github/workflows/integration.yaml` — Main PR workflow (code check, unit test, build, helm, e2e)
- `.github/workflows/kustomize-e2e.yaml` — Kustomize E2E (9 K8s versions)
- `.github/workflows/operator-chaos.yaml` — Chaos testing (CRD diff, knowledge model)
- `.github/workflows/codecov.yaml` — Coverage upload
- `.github/workflows/spark-operator-module-ci.yaml` — Module operator CI
- `.github/workflows/scheduledspark-smoke.yaml` — ScheduledSpark smoke test

### Testing
- `test/e2e/` — E2E test suite (Ginkgo, Kind)
- `test/kustomize/` — Kustomize build validation tests
- `test/drift/` — Helm/Kustomize drift detection tests
- `charts/spark-operator-chart/tests/` — 20 Helm chart unit tests
- `spark-operator-module/tests/e2e/` — Module operator E2E
- `examples/openshift/kueue/` — Kueue integration tests

### Code Quality
- `.golangci.yaml` — golangci-lint v2 configuration (7 custom linters)
- `.pre-commit-config.yaml` — Pre-commit hooks (helm-docs, shfmt, shellcheck)
- `.github/dependabot.yml` — Dependabot (gomod, docker, github-actions, uv)
- `.github/renovate.json` — Renovate (extends konflux-central defaults)
- `.codecov.yml` — Codecov configuration (unit + e2e-kustomize flags)

### Container Images
- `Dockerfile` — Upstream multi-stage Dockerfile (golang + spark base)
- `Dockerfile.konflux` — Konflux/downstream Dockerfile (UBI9, FIPS, labels)
- `spark-operator-module-controller.Dockerfile` — Module operator Dockerfile (UBI9 minimal)

### Agent Rules
- `CLAUDE.md` — Comprehensive project documentation for AI agents
