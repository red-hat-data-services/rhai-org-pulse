---
repository: "opendatahub-io/spark-operator"
overall_score: 8.1
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "69 test files across 140 source files (0.49 ratio); Go testing + Ginkgo + envtest; coverprofile generation"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "3 E2E suites (Helm, Kustomize, Module); K8s v1.24-v1.35 matrix; operator-chaos; drift detection"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-triggered build + E2E; Kustomize build validation tests; Helm ct install; CRD drift check"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage Dockerfile; multi-arch (amd64/arm64); UBI-based ODH image; health probes verified in tests"
  - dimension: "Coverage Tracking"
    score: 8.0
    status: "Codecov with project/patch targets; separate unit and e2e-kustomize flags; 1% threshold"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "24 workflows; 16 with concurrency control; matrix multi-version + multi-method; comprehensive release automation"
  - dimension: "Static Analysis"
    score: 7.0
    status: "golangci-lint v2 with 7+ linters; shfmt + shellcheck; Dependabot 4 ecosystems; crypto/md5 FIPS concern"
  - dimension: "Agent Rules"
    score: 7.0
    status: "Comprehensive CLAUDE.md with project structure, build, test, deploy docs; no .claude/rules/ for test patterns"
critical_gaps:
  - title: "Non-FIPS-compliant crypto/md5 usage in production code"
    impact: "FIPS-mandated environments will reject binaries using MD5; compliance audit failure"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No FIPS build tags or BoringCrypto configuration"
    impact: "Cannot produce FIPS-validated builds for regulated deployments"
    severity: "HIGH"
    effort: "8-16 hours"
  - title: "No explicit Konflux build simulation on PRs"
    impact: "Build failures may be discovered only post-merge in Konflux pipeline"
    severity: "MEDIUM"
    effort: "8-12 hours"
quick_wins:
  - title: "Replace crypto/md5 with crypto/sha256 in sparkapplication.go"
    effort: "1-2 hours"
    impact: "Eliminates the only non-FIPS-compliant crypto import in production code"
  - title: "Add .claude/rules/ with test creation patterns for unit and E2E tests"
    effort: "2-3 hours"
    impact: "AI-generated tests follow established Ginkgo/envtest conventions consistently"
  - title: "Add timeout-minutes to all PR-triggered workflows"
    effort: "1 hour"
    impact: "Prevents stuck workflows from consuming runner time indefinitely"
recommendations:
  priority_0:
    - "Replace crypto/md5 with crypto/sha256 in pkg/util/sparkapplication.go for FIPS compliance"
    - "Add FIPS build tags (CGO_ENABLED=1, -tags=strictfipsruntime or GOEXPERIMENT=boringcrypto) for regulated builds"
  priority_1:
    - "Add Konflux build simulation to PR workflow to catch build issues before merge"
    - "Create .claude/rules/ with specific test creation patterns for Ginkgo E2E and envtest unit tests"
    - "Add container runtime startup validation (image boots, health endpoints respond)"
  priority_2:
    - "Add test parallelism (t.Parallel()) to unit tests where safe to reduce CI time"
    - "Add Testcontainers-based image validation for operator container"
    - "Increase golangci-lint linter count (add errcheck, gocritic, gosimple, stylecheck)"
---

# Quality Analysis: opendatahub-io/spark-operator

## Executive Summary

- **Overall Score: 8.1/10**
- **Repository Type**: Kubernetes Operator (Go)
- **Framework**: controller-runtime, Ginkgo, Helm, Kustomize
- **Primary Language**: Go 1.25
- **Jira Component**: Kubeflow Spark Operator (RHOAIENG)
- **Tier**: Midstream (upstream: kubeflow/spark-operator)

**Key Strengths**: Exceptional E2E testing with multi-version Kubernetes matrix (v1.24-v1.35), dual deployment method testing (Helm + Kustomize), operator-chaos testing, semantic drift detection between Helm and Kustomize manifests, and comprehensive Codecov integration with separate unit and E2E flags. The CLAUDE.md is one of the most thorough seen across the portfolio.

**Critical Gaps**: Non-FIPS-compliant `crypto/md5` usage in production code, no FIPS build configuration, and no PR-time Konflux build simulation.

**Agent Rules Status**: CLAUDE.md present and comprehensive; no `.claude/rules/` directory.

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.0/10 | 15% | 1.20 | 69 test files, 0.49 test-to-code ratio, envtest + Ginkgo |
| Integration/E2E | 9.0/10 | 20% | 1.80 | 3 E2E suites, K8s v1.24-v1.35 matrix, operator-chaos |
| Build Integration | 8.0/10 | 15% | 1.20 | PR build + E2E, Kustomize validation, CRD drift check |
| Image Testing | 7.0/10 | 10% | 0.70 | Multi-stage, multi-arch, UBI-based ODH image |
| Coverage Tracking | 8.0/10 | 10% | 0.80 | Codecov with project/patch targets, 1% threshold |
| CI/CD Automation | 9.0/10 | 15% | 1.35 | 24 workflows, concurrency control, matrix strategies |
| Static Analysis | 7.0/10 | 10% | 0.70 | golangci-lint v2, shfmt, shellcheck, Dependabot |
| Agent Rules | 7.0/10 | 5% | 0.35 | Comprehensive CLAUDE.md, no test-specific rules |
| **Overall** | **8.1/10** | **100%** | **8.10** | |

## Critical Gaps

### 1. Non-FIPS-Compliant crypto/md5 Usage
- **Impact**: FIPS-mandated environments will reject binaries using MD5; compliance audit failure
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Location**: `pkg/util/sparkapplication.go:20` imports `crypto/md5`
- **Fix**: Replace `crypto/md5` with `crypto/sha256` for hash generation. The function likely generates a deterministic hash from SparkApplication metadata; SHA-256 is a drop-in replacement.

### 2. No FIPS Build Configuration
- **Impact**: Cannot produce FIPS-validated builds for regulated deployments (Red Hat / gov / finance)
- **Severity**: HIGH
- **Effort**: 8-16 hours
- **Details**: The Dockerfile uses `CGO_ENABLED=0` with no FIPS build tags. For FIPS compliance, builds need `CGO_ENABLED=1` with either `-tags=strictfipsruntime` or `GOEXPERIMENT=boringcrypto`. The ODH Dockerfile (`Dockerfile.odh`) uses UBI-based images (good), but the Go build still lacks FIPS tags.

### 3. No PR-Time Konflux Build Simulation
- **Impact**: Build differences between GitHub Actions and Konflux pipeline discovered only post-merge
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Mitigation**: The repo has comprehensive PR build validation (docker build, Kustomize build tests, Helm ct install), which reduces risk significantly. A Konflux simulation step would be additive assurance.

## Quick Wins

### 1. Replace crypto/md5 with crypto/sha256 (1-2 hours)
Replace the single `crypto/md5` import in `pkg/util/sparkapplication.go` with `crypto/sha256`. This is a minimal change that eliminates the only non-FIPS-compliant crypto usage in production code.

### 2. Add .claude/rules/ for Test Patterns (2-3 hours)
Create test creation rules under `.claude/rules/` covering:
- Unit test patterns (envtest setup, Ginkgo BDD style, testify assertions)
- E2E test patterns (Kind cluster, Helm/Kustomize install, cleanup)
- Kustomize build test patterns (resource validation, RBAC checks)

### 3. Add timeout-minutes to All PR Workflows (1 hour)
Only 3 of 24 workflows set `timeout-minutes`. Add explicit timeouts to all PR-triggered workflows to prevent stuck jobs from consuming runner capacity.

### 4. Replace math/rand with crypto/rand in Test Files (1 hour)
Test files in `examples/openshift/kueue/` use `math/rand` for randomization. While test-only, replacing with `crypto/rand` or `math/rand/v2` eliminates FIPS scanner false positives.

## Detailed Findings

### Unit Tests

**Score: 8.0/10**

**Test Files**: 69 `*_test.go` files across the codebase
**Source Files**: 140 Go source files (excluding tests)
**Test-to-Code Ratio**: 0.49 (strong; gold standard target is 0.5+)

**Frameworks Used**:
- Go standard `testing` package
- **Ginkgo v2** (BDD-style, used for E2E and controller tests)
- **Gomega** (matcher library, paired with Ginkgo)
- **testify** (assert/require, used in kustomize and drift tests)
- **envtest** (controller-runtime test harness for Kubernetes API)

**Test Organization**:
- Controller tests: `internal/controller/sparkapplication/`, `internal/controller/scheduledsparkapplication/`, `internal/controller/sparkconnect/`
- Webhook tests: `internal/webhook/`
- Utility tests: `pkg/util/`, `pkg/certificate/`, `pkg/features/`
- API tests: `api/v1beta2/`
- Scheduler tests: `internal/scheduler/yunikorn/`, `internal/scheduler/volcano/`, `internal/scheduler/kubescheduler/`

**Strengths**:
- envtest provides real Kubernetes API server for controller/webhook tests
- Good separation of unit and E2E test paths via `go list ./... | grep -v -e /e2e -e /drift`
- Coverage profile generated automatically in `make unit-test`
- HTML coverage report generated (`cover.html`)

**Gaps**:
- No explicit `t.Parallel()` usage detected for parallel test execution
- Some test packages lack `suite_test.go` setup files

**Key Files**:
- `Makefile:204` - `unit-test` target with envtest and coverprofile
- `internal/controller/sparkapplication/controller_test.go` - Controller reconciliation tests
- `internal/webhook/sparkapplication_validator_test.go` - Webhook validation tests

### Integration/E2E Tests

**Score: 9.0/10**

**Three E2E Test Suites**:

1. **Upstream Helm E2E** (`test/e2e/`): 6 test files
   - `sparkapplication_test.go` - SparkApplication lifecycle
   - `scheduledsparkapplication_test.go` - Scheduled job tests
   - `sparkconnect_test.go` - SparkConnect tests
   - `namespace_filtering_test.go` - Multi-namespace tests
   - `pdb_test.go` - PodDisruptionBudget tests
   - Uses Ginkgo BDD with Kind cluster + Helm install

2. **Kustomize E2E** (`examples/openshift/tests/e2e/`): 7 test files
   - `sparkapplication_test.go` - App lifecycle via Kustomize
   - `sparkconnect_test.go` / `sparkconnect_query_test.go` - SparkConnect
   - `scheduledsparkapplication_test.go` - Scheduled apps
   - `spark_ui_test.go` - UI ingress validation
   - `prometheus_metrics_test.go` - Metrics endpoint tests
   - Uses Ginkgo BDD with Kind + Kustomize install

3. **Module E2E** (`spark-operator-module/tests/e2e/`): 1 test file
   - `module_operator_test.go` - Module operator lifecycle

**Multi-Version Testing**:
- `integration.yaml`: K8s v1.32.11, v1.33.7, v1.34.3, v1.35.0 matrix
- `kustomize-e2e.yaml`: K8s v1.24.17 through v1.32.0 (9 versions!)
- Both Helm and Kustomize deploy methods tested in matrix

**Special Testing**:
- **Operator Chaos** (`operator-chaos.yaml`): Chaos testing using `operator-chaos` tool with domain knowledge from `chaos/knowledge/spark.yaml`
- **Drift Detection** (`test/drift/drift_test.go`): Compares Helm chart and Kustomize manifests for RBAC, webhook, deployment, and volume semantic equivalence
- **Kustomize Build Validation** (`test/kustomize/`): Validates resource inventory, namespace consistency, image replacement, RBAC correctness, webhook configuration, deployment security context, health probes
- **ScheduledSpark Smoke** (`scheduledspark-smoke.yaml`): Lightweight smoke test for scheduled jobs
- **Docling E2E** (`openshift-docling-e2e.yaml`): Heavy workload test on EC2 runners

**Strengths**:
- Dual deployment method testing (Helm + Kustomize) catches method-specific bugs
- 13 Kubernetes versions tested across workflows (v1.24 to v1.35)
- Operator-chaos testing is unusual and valuable
- Kustomize build tests validate RBAC, webhooks, security context, health probes
- Debug output on failure (cluster state, SparkApplications, events, operator logs)
- E2E coverage uploaded separately to Codecov

**Gaps**:
- No multi-cluster or federation tests (understandable for this operator type)

### Build Integration

**Score: 8.0/10**

**PR-Triggered Build Validation** (`integration.yaml`):
- `code-check`: go mod tidy, generate, verify-codegen, go-fmt, go-vet, golangci-lint
- `build-spark-operator`: unit tests + binary build
- `build-api-docs`: API documentation generation check
- `build-helm-chart`: Helm unittest, chart-testing lint, CRD drift detection, chart install (Minikube)
- `e2e-test`: Docker build + Kind load + E2E tests (4 K8s versions x 2 deploy methods = 8 matrix jobs)

**Kustomize Build Validation** (`kustomize-lint.yaml`):
- Runs `go test ./test/kustomize/` which validates Kustomize build output
- Tests resource inventory, RBAC correctness, webhook configuration, deployment specs
- No cluster required - static validation

**Drift Detection** (`kustomize-drift-check.yaml`):
- Detects semantic drift between Helm chart and Kustomize manifests
- Compares RBAC rules, webhook configs, deployment specs, images
- Runs on PRs touching config/, charts/, or internal/

**Module CI** (`spark-operator-module-ci.yaml`):
- Separate CI for spark-operator-module subcomponent
- Pre-commit check, docker build, unit tests

**Strengths**:
- Comprehensive multi-job PR validation pipeline
- Docker image built and tested on every PR
- Kustomize build output validated with typed assertions
- Helm chart install tested via chart-testing (ct)
- CRD drift detection prevents manifest divergence
- Module CI keeps subcomponent independently validated

**Gaps**:
- No explicit Konflux build simulation step
- Build validation focuses on GitHub Actions environment; Konflux differences (if any) not caught pre-merge

### Image Testing

**Score: 7.0/10**

**Dockerfiles**:
1. `Dockerfile` (upstream): Multi-stage (golang builder → Spark base image), build caching with `--mount=type=cache`
2. `Dockerfile.odh` (OpenShift): Multi-stage (UBI go-toolset → AIPCC base), Java 17 + PySpark installed
3. `docker/Dockerfile.kubectl`: Kubectl sidecar image
4. `examples/openshift/Dockerfile`: OpenShift example
5. `spark-operator-module-controller.Dockerfile`: Module controller image

**Multi-Architecture Support**:
- `docker-buildx` with `linux/amd64,linux/arm64` in release workflows
- `TARGETARCH` build arg used correctly in Dockerfiles
- Multi-arch manifest list created via `docker buildx imagetools`

**Base Images**:
- Upstream: `golang:1.25.11` (builder) → `spark:4.0.1` (runtime)
- ODH: `ubi9/go-toolset:1.25.7` (builder) → `aipcc/base-images/cpu` (runtime) - UBI-based, good for FIPS
- Security: `readOnlyRootFilesystem: true`, `runAsNonRoot: true` verified in kustomize tests

**Health Probes**:
- `/healthz` liveness probe and `/readyz` readiness probe defined in deployments
- Verified by kustomize build tests (`TestKustomizeBuild/DeploymentConfiguration`)

**Strengths**:
- Multi-stage builds with layer caching
- Multi-architecture support for amd64 and arm64
- UBI-based ODH image for enterprise environments
- Health probes defined and tested
- OpenShift arbitrary UID compatibility (GID 0 group permissions)

**Gaps**:
- No Testcontainers-based runtime validation
- No explicit container startup tests (image boots, entrypoint works)
- No image size optimization checks

### Coverage Tracking

**Score: 8.0/10**

**Configuration** (`.codecov.yml`):
```yaml
coverage:
  status:
    project:
      default:
        target: auto
        threshold: 1%
    patch:
      default:
        target: auto
        threshold: 1%
```

**Coverage Flags**:
- `unit`: Excludes `test/e2e/` and `examples/openshift/tests/e2e/`
- `e2e-kustomize`: Excludes `test/e2e/`
- Separate tracking of unit and E2E coverage

**Coverage Generation**:
- Unit tests: `--coverprofile cover.out` in `make unit-test`
- E2E Kustomize: `cover-e2e-kustomize.out` uploaded in `kustomize-e2e.yaml`
- HTML report: `go tool cover -html=cover.out -o cover.html`

**Upload**:
- `codecov/codecov-action@v5` (SHA-pinned) with token auth
- Uploaded on push to main (unit) and conditionally for E2E

**Comment Layout**: `reach,diff,flags,files` - shows coverage reach, diff, flags, and per-file details

**Strengths**:
- Separate unit and E2E coverage flags for accurate tracking
- Threshold enforcement (1%) prevents coverage regression
- PR comment reporting configured
- E2E coverage tracked separately (unusual and valuable)

**Gaps**:
- `target: auto` is less strict than a fixed percentage target
- No explicit minimum coverage gate (e.g., "must be > 60%")

### CI/CD Automation

**Score: 9.0/10**

**Workflow Inventory** (24 workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `integration.yaml` | PR + push | Code check, unit test, helm test, E2E (matrix) |
| `kustomize-e2e.yaml` | PR + push | Kustomize E2E (9 K8s versions) |
| `kustomize-lint.yaml` | PR + push | Kustomize build validation |
| `kustomize-drift-check.yaml` | PR + push | Helm-Kustomize drift detection |
| `codecov.yaml` | PR + push | Unit test coverage upload |
| `shell-lint.yaml` | PR + push | Shell script formatting and linting |
| `operator-chaos.yaml` | PR | Chaos testing |
| `scheduledspark-smoke.yaml` | PR + push | ScheduledSpark smoke test |
| `spark-operator-module-ci.yaml` | PR | Module subcomponent CI |
| `disconnected-readiness.yml` | PR | Disconnected environment readiness |
| `docs.yaml` | PR + push | Documentation build and link check |
| `check-release.yaml` | PR | Version semver validation |
| `build-quay.yaml` | dispatch | Build and push to Quay |
| `pushImageToDPQuay.yaml` | dispatch | Push Spark image to data-processing Quay |
| `integration-odh.yaml` | push + dispatch | ODH Spark Pi E2E |
| `openshift-docling-e2e.yaml` | push + dispatch | Docling E2E on EC2 |
| `release.yaml` | push (release branch) | Full release pipeline |
| `release-latest-images.yaml` | push (master) | Latest image builds |
| `release-helm-charts.yaml` | release | Helm OCI chart publish |
| `helm-release.yaml` | push (main) | Helm chart release |
| `scorecard.yaml` | schedule + push | OpenSSF Scorecard |
| `stale.yaml` | schedule | Stale issue/PR management |
| `welcome-new-contributors.yaml` | PR/issue opened | Welcome message |
| `_run-kustomize-e2e.yaml` | workflow_call | Reusable E2E workflow |

**Concurrency Control**: 16 of 24 workflows use `concurrency:` with `cancel-in-progress: true`

**Caching**: 6 workflows use caching (Go modules, Docker layers, uv)

**Matrix Strategy**: 6 workflows use matrix strategies:
- Multi K8s version (v1.24-v1.35)
- Multi deploy method (helm, kustomize)
- Multi architecture (amd64, arm64)

**Strengths**:
- Comprehensive PR gate (12 workflows triggered on PRs)
- Reusable workflow pattern (`_run-kustomize-e2e.yaml`)
- OpenSSF Scorecard for supply chain security
- Stale issue management
- SHA-pinned actions (security best practice)
- zizmor annotations for security-sensitive patterns

**Gaps**:
- Only 3 workflows have explicit `timeout-minutes`
- No explicit test result caching between re-runs

### Static Analysis

**Score: 7.0/10**

#### Linting

**golangci-lint v2.1.6** (`.golangci.yaml`):
- Enabled linters: `copyloopvar`, `dupword`, `importas`, `predeclared`, `tagalign`, `unconvert`, `unused`
- Formatter: `goimports`
- Import alias enforcement (K8s API groups properly aliased)
- Exclusion: staticcheck SA1019 for deprecated `Result.Requeue`
- Timeout: 2 minutes
- Max issues per linter: 50

**Shell Linting** (`shell-lint.yaml`):
- `shfmt` with 2-space indent, case indent, space redirects
- `shellcheck` for shell script analysis
- Pre-commit hooks configured for both

**Strengths**:
- Modern golangci-lint v2 with well-chosen linters
- Shell scripts also linted (unusual and good)
- Pre-commit hooks for helm-docs, shfmt, shellcheck
- Import alias enforcement for K8s API consistency

**Gaps**:
- Only 7 linters enabled (gold standard repos enable 15+)
- Missing valuable linters: `errcheck`, `gocritic`, `gosimple`, `stylecheck`, `nolintlint`, `misspell`

#### FIPS Compatibility

**Findings**:
- `pkg/util/sparkapplication.go:20` imports `crypto/md5` - **non-FIPS-compliant**
- `examples/openshift/kueue/*_test.go` imports `math/rand` - test-only, lower risk
- `CGO_ENABLED=0` in both Dockerfile and Makefile - incompatible with FIPS (needs `CGO_ENABLED=1`)
- No FIPS build tags (`-tags=fips`, `-tags=strictfipsruntime`, `GOEXPERIMENT=boringcrypto`)
- No BoringCrypto configuration
- Dockerfile.odh uses UBI-based images (FIPS-capable base), but Go binary lacks FIPS tags

#### Dependency Alerts

**Dependabot** (`.github/dependabot.yml`):
- 4 ecosystems configured: `gomod`, `docker`, `github-actions`, `uv`
- Weekly schedule for all
- Security-only updates for uv (`open-pull-requests-limit: 0`)
- No Renovate (Dependabot is sufficient)

### Agent Rules

**Score: 7.0/10**

**CLAUDE.md**: Present and comprehensive (one of the best in the portfolio)
- Complete project structure documentation
- Build and test command reference (unit, E2E Helm, E2E Kustomize, Helm chart tests)
- Kustomize configuration details (params.env, overlays, image injection)
- CI workflow mapping
- Debugging guidance (logs, status, metrics)
- Key file locations for all CRD types

**What's Covered**:
- Tech stack and framework versions
- Two deployment workflows (Helm vs Kustomize) clearly documented
- Container image configuration and overlay mechanism
- Test locations and how to run them

**What's Missing**:
- No `.claude/rules/` directory with specific test creation rules
- No patterns for writing new Ginkgo tests (BeforeSuite, BeforeEach, cleanup)
- No envtest setup patterns for new controller tests
- No webhook test patterns
- No `.claude/skills/` for custom automation

**Recommendation**: Generate test creation rules using `/test-rules-generator` skill to create specific patterns for:
- Ginkgo BDD test structure (Describe/Context/It)
- envtest setup and teardown
- Kustomize build test patterns
- E2E test fixtures and cleanup

## Recommendations

### Priority 0 (Critical)

1. **Replace `crypto/md5` with `crypto/sha256`** in `pkg/util/sparkapplication.go` for FIPS compliance. This is a single-file change with minimal risk.

2. **Add FIPS build configuration** for regulated environment builds:
   - Add FIPS build tags (`-tags=strictfipsruntime` or `GOEXPERIMENT=boringcrypto`)
   - Set `CGO_ENABLED=1` for FIPS builds
   - Document FIPS build process in CLAUDE.md and Makefile

### Priority 1 (High Value)

3. **Add Konflux build simulation** to PR workflow. Even a basic `kustomize build` + dry-run validation step simulating Konflux behavior would catch divergence early.

4. **Create `.claude/rules/`** with test creation patterns:
   - `unit-tests.md` - envtest setup, Ginkgo patterns, testify usage
   - `e2e-tests.md` - Kind cluster, Helm/Kustomize install, cleanup
   - `kustomize-tests.md` - Resource validation patterns

5. **Add container runtime startup validation**: Build the image and verify it starts, health endpoints respond, and the entrypoint works correctly. Could use `docker run --health-cmd` in CI.

6. **Add `timeout-minutes` to all PR-triggered workflows** to prevent stuck jobs.

### Priority 2 (Nice-to-Have)

7. **Increase golangci-lint coverage**: Enable `errcheck`, `gocritic`, `gosimple`, `stylecheck`, `nolintlint`, `misspell` for deeper static analysis.

8. **Add `t.Parallel()`** to unit tests where safe (no shared state) to reduce CI wall time.

9. **Add Testcontainers-based image validation** for the operator container, testing startup, health endpoints, and graceful shutdown.

10. **Set fixed coverage targets** instead of `target: auto` (e.g., `target: 60%`) for stronger regression prevention.

## Comparison to Gold Standards

| Practice | spark-operator | odh-dashboard | notebooks | kserve |
|----------|---------------|---------------|-----------|--------|
| Unit Tests | 8.0 - Strong | 9.0 - Multi-layer | 6.0 - Basic | 8.0 - Strong |
| E2E Tests | 9.0 - Multi-version + chaos | 8.0 - Cypress + API | 7.0 - Image validation | 9.0 - Multi-version |
| Build Integration | 8.0 - CRD drift, Kustomize validation | 8.0 - Module Fed | 7.0 - Image pipeline | 7.0 - PR builds |
| Image Testing | 7.0 - Multi-arch, UBI | 6.0 - Basic | 9.0 - 5-layer | 6.0 - Basic |
| Coverage | 8.0 - Dual-flag Codecov | 8.0 - Enforcement | 5.0 - Minimal | 9.0 - Threshold gates |
| CI/CD | 9.0 - 24 workflows | 9.0 - Comprehensive | 8.0 - Good | 8.0 - Good |
| Static Analysis | 7.0 - golangci-lint + shell | 8.0 - ESLint strict | 6.0 - Basic | 7.0 - Good |
| Agent Rules | 7.0 - CLAUDE.md only | 9.0 - Rules + skills | 3.0 - Minimal | 4.0 - Basic |

**Notable**: spark-operator's operator-chaos testing and Helm/Kustomize drift detection are unique among the portfolio and represent innovative quality practices worth replicating.

## File Paths Reference

### CI/CD
- `.github/workflows/integration.yaml` - Main PR gate (code check, unit test, build, E2E)
- `.github/workflows/kustomize-e2e.yaml` - Kustomize E2E (9 K8s versions)
- `.github/workflows/kustomize-lint.yaml` - Kustomize build validation
- `.github/workflows/kustomize-drift-check.yaml` - Helm-Kustomize drift detection
- `.github/workflows/operator-chaos.yaml` - Chaos testing
- `.github/workflows/codecov.yaml` - Coverage upload
- `.github/workflows/shell-lint.yaml` - Shell script linting
- `.github/workflows/scheduledspark-smoke.yaml` - Scheduled spark smoke test
- `.github/workflows/spark-operator-module-ci.yaml` - Module CI

### Testing
- `test/e2e/` - Upstream Ginkgo E2E suite (Helm install)
- `test/kustomize/` - Kustomize build validation tests
- `test/drift/` - Helm-Kustomize drift detection tests
- `examples/openshift/tests/e2e/` - OpenShift/Kustomize E2E suite
- `spark-operator-module/tests/e2e/` - Module E2E tests
- `charts/spark-operator-chart/tests/` - Helm unit tests (20 files)
- `examples/openshift/kueue/` - Kueue integration tests

### Code Quality
- `.golangci.yaml` - golangci-lint v2 configuration
- `.pre-commit-config.yaml` - Pre-commit hooks (helm-docs, shfmt, shellcheck)
- `.github/dependabot.yml` - Dependabot (gomod, docker, github-actions, uv)
- `.codecov.yml` - Coverage configuration

### Container Images
- `Dockerfile` - Main operator image (golang → Spark base)
- `examples/openshift/Dockerfile.odh` - ODH image (UBI go-toolset → AIPCC base)
- `docker/Dockerfile.kubectl` - Kubectl sidecar
- `spark-operator-module-controller.Dockerfile` - Module controller

### Agent Rules
- `CLAUDE.md` - Comprehensive project documentation
- `chaos/knowledge/spark.yaml` - Operator chaos domain knowledge

### Key Source
- `pkg/util/sparkapplication.go:20` - **crypto/md5 import (FIPS concern)**
- `internal/controller/sparkapplication/controller.go` - Main reconciliation loop
- `internal/webhook/` - Webhook handlers
- `config/default/` - Kustomize base manifests
- `config/overlays/odh/` - ODH overlay
- `config/overlays/rhoai/` - RHOAI overlay
