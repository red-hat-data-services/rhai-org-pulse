---
repository: "opendatahub-io/kserve"
overall_score: 8.3
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "1018 Go test functions across 226 files; extensive Python unit tests across 8+ servers; envtest for controller integration; Ginkgo/Gomega async patterns"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Comprehensive E2E with KinD clusters; 5 dedicated E2E workflows (main, LLMISVC, ModelCache, ODH-xKS, kserve-module); multi-install-method matrix (kustomize+helm); multi-version Istio testing"
  - dimension: "Build Integration"
    score: 8.0
    status: "Distro build-tag verification on every PR; E2E workflows build and load images into KinD; kserve-module has dedicated build+test; no Konflux simulation but strong compile-time gating"
  - dimension: "Image Testing"
    score: 7.0
    status: "UBI9-based multi-stage Dockerfiles; Go cache mounts; license checking in build; images loaded into KinD for E2E; no dedicated runtime health-check validation or multi-arch CI"
  - dimension: "Coverage Tracking"
    score: 9.0
    status: "go-test-coverage enforces 80% threshold; PR coverage comparison with master baseline; coverage breakdown posted as PR comment; pytest-cov for Python servers"
  - dimension: "CI/CD Automation"
    score: 9.5
    status: "50+ workflows; concurrency groups on all; extensive caching (Go modules, uv, venv); matrix testing (3 Python versions); required-checks enforcement; path-filtered triggers; merge-group support"
  - dimension: "Static Analysis"
    score: 8.0
    status: "38+ golangci-lint rules (v2 config); ruff for Python; pre-commit with helm-docs + pinact + ruff; SHA-pinned actions; unicode safety checks; no Dependabot/Renovate; no explicit FIPS build tags"
  - dimension: "Agent Rules"
    score: 8.5
    status: "AGENTS.md with comprehensive controller conventions; CLAUDE.md symlink; .rules/ with 6 rule files covering build-tags, distro builds, e2e compat, kustomize hygiene, makefile split, RBAC isolation"
critical_gaps:
  - title: "No Dependabot or Renovate for dependency alerts"
    impact: "Dependency vulnerabilities and outdated packages not automatically surfaced; manual tracking required"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No explicit FIPS build-tag configuration"
    impact: "No -tags=fips or GOEXPERIMENT=boringcrypto in Makefile/CI; FIPS compliance relies on UBI base images only, not compile-time crypto selection"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "No Konflux build simulation in PR CI"
    impact: "Build issues specific to Konflux pipeline (e.g. different build-arg defaults, hermetic builds) discovered post-merge"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "No multi-architecture CI builds"
    impact: "ARM64/s390x/ppc64le build failures not caught until downstream Konflux; no --platform or buildx in CI"
    severity: "LOW"
    effort: "4-6 hours"
quick_wins:
  - title: "Add .github/dependabot.yml for Go modules, pip, Docker, and GitHub Actions"
    effort: "1-2 hours"
    impact: "Automated PRs for dependency updates; vulnerability alerts integrated into repo"
  - title: "Add FIPS build-tag verification to distro-build-check.yml matrix"
    effort: "2-3 hours"
    impact: "Compile-time validation that FIPS-tagged builds succeed; catches incompatible crypto imports early"
  - title: "Add t.Parallel() to unit tests where safe"
    effort: "2-4 hours"
    impact: "Faster test execution; currently zero test files use t.Parallel()"
recommendations:
  priority_0:
    - "Enable Dependabot for gomod, pip, docker, and github-actions ecosystems to automate dependency vulnerability tracking"
    - "Add FIPS build verification (tags=fips matrix entry) to distro-build-check.yml to validate FIPS-compliant compilation"
  priority_1:
    - "Add Konflux build simulation step to PR CI or as a separate workflow to catch hermetic build issues before merge"
    - "Add multi-architecture build validation (at minimum arm64) to catch platform-specific compilation failures"
    - "Add t.Parallel() to independent unit tests to reduce CI wall-clock time"
  priority_2:
    - "Add container health-check validation tests that verify built images start and respond to health probes"
    - "Consider adding contract tests between Python SDK client and Go controller API boundaries"
    - "Add performance regression testing for inference prediction endpoints"
---

# Quality Analysis: opendatahub-io/kserve

## Executive Summary

- **Overall Score: 8.3/10**
- **Repository Type**: Kubernetes operator / ML serving platform (Go + Python)
- **Jira**: RHOAIENG / Serving Orchestration (midstream)
- **Primary Languages**: Go (controllers, webhooks), Python (serving runtimes, SDK, E2E tests)
- **Framework**: controller-runtime, Kubebuilder, envtest; pytest for Python

**Key Strengths**: Exceptional CI/CD automation with 50+ workflows, strong coverage enforcement (80% threshold with PR comparison), comprehensive E2E testing across multiple install methods (kustomize + helm), and well-structured agent rules with detailed midstream companion-file conventions.

**Critical Gaps**: No Dependabot/Renovate for automated dependency alerts, no explicit FIPS build-tag configuration in CI, and no Konflux build simulation in PR workflows.

**Agent Rules Status**: Present and comprehensive - AGENTS.md with controller conventions, CLAUDE.md symlink, and 6 dedicated rule files in `.rules/` covering build tags, distro builds, E2E OpenShift compatibility, kustomize hygiene, makefile conventions, and RBAC isolation.

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 8.5/10 | 15% | 1018 Go test functions, extensive Python server tests, envtest integration |
| Integration/E2E | 9.0/10 | 20% | 5 E2E workflows, KinD clusters, multi-install matrix, multi-version Istio |
| Build Integration | 8.0/10 | 15% | Distro build-tag verification, E2E image builds, no Konflux simulation |
| Image Testing | 7.0/10 | 10% | UBI9 multi-stage builds, KinD loading, no runtime health validation |
| Coverage Tracking | 9.0/10 | 10% | 80% threshold enforced, PR comparison with master, pytest-cov for Python |
| CI/CD Automation | 9.5/10 | 15% | 50+ workflows, concurrency control, extensive caching, path filtering |
| Static Analysis | 8.0/10 | 10% | 38+ golangci-lint rules, ruff, pre-commit, no Dependabot/Renovate |
| Agent Rules | 8.5/10 | 5% | AGENTS.md + 6 .rules/ files, comprehensive controller conventions |

**Weighted Overall: 8.3/10**

## Critical Gaps

### 1. No Dependabot or Renovate Configuration
- **Impact**: Dependency vulnerabilities and outdated packages are not automatically surfaced; the team must manually track updates across Go modules, Python packages, Docker base images, and GitHub Actions versions
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Note**: GitHub Actions are SHA-pinned (enforced by `pinact` pre-commit hook), which is excellent for supply chain security, but there's no automated mechanism to propose updates when new versions are available

### 2. No Explicit FIPS Build-Tag Configuration
- **Impact**: While the Dockerfile uses UBI9 base images (FIPS-capable), there are no `-tags=fips`, `-tags=strictfipsruntime`, or `GOEXPERIMENT=boringcrypto` flags in the Makefile or CI workflows. FIPS compliance depends entirely on the runtime environment rather than compile-time crypto selection
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Note**: No non-FIPS crypto imports (`crypto/md5`, `crypto/des`, `crypto/rc4`) were found in Go source code, which is positive

### 3. No Konflux Build Simulation in PR CI
- **Impact**: Build issues specific to the Konflux pipeline (different build-arg defaults, hermetic builds, cachito dependency resolution) are discovered only after merge
- **Severity**: MEDIUM
- **Effort**: 8-12 hours

### 4. No Multi-Architecture CI Builds
- **Impact**: ARM64/s390x/ppc64le build failures not caught until downstream Konflux; no `--platform` or `docker buildx` usage in CI workflows
- **Severity**: LOW
- **Effort**: 4-6 hours

## Quick Wins

### 1. Add Dependabot Configuration (1-2 hours)
Create `.github/dependabot.yml` covering all ecosystems:

```yaml
version: 2
updates:
  - package-ecosystem: "gomod"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "pip"
    directory: "/python/kserve"
    schedule:
      interval: "weekly"
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 2. Add FIPS Build Verification (2-3 hours)
Extend `distro-build-check.yml` matrix to include a FIPS build variant:

```yaml
matrix:
  include:
    - label: no build tags
      tags: ""
    - label: distro
      tags: distro
    - label: distro+fips
      tags: "distro,fips"
```

### 3. Add t.Parallel() to Unit Tests (2-4 hours)
Currently zero test files use `t.Parallel()`. Adding it to independent unit tests (especially in `pkg/utils/`, `pkg/logger/`, `pkg/batcher/`, `tools/tf2openapi/`) would reduce CI wall-clock time without risk to test isolation.

## Detailed Findings

### Unit Tests

**Score: 8.5/10**

**Go Tests:**
- 226 test files with 1018 test functions across the codebase
- Test-to-code ratio: 226/419 = 0.54 (strong)
- Testing framework: standard `testing` package + Ginkgo/Gomega (325 files reference Ginkgo patterns)
- 33 files use `fake.NewClientBuilder` for unit-level controller testing
- 42 files use `Eventually`/`Consistently` for async assertion patterns
- envtest used extensively for controller integration tests (15 files)
- Dedicated `pkg/testing/` package with `NewEnvTest()`, test namespace management, config helpers, and cleaners
- ODH-specific tests (`*_odh_test.go`) for midstream behavior verification

**Python Tests:**
- 188 Python test files across 8+ server implementations
- Tests run across Python 3.10, 3.11, 3.12 matrix
- `pytest --cov` used for all Python servers (kserve, sklearn, xgb, autogluon, pmml, lgb, paddle, huggingface)
- Numpy 1.x compatibility tests run separately
- JUnit XML output for test result aggregation

**Gaps:**
- No `t.Parallel()` usage in any Go test file
- No `t.Helper()` usage detected in test helpers

### Integration/E2E Tests

**Score: 9.0/10**

**Infrastructure:**
- 5 dedicated E2E test workflows:
  1. `e2e-test.yml` (1576 lines) - Main E2E suite with predictor, transformer, explainer, graph, logger, storage tests
  2. `e2e-test-llmisvc.yaml` - LLMInferenceService-specific E2E
  3. `e2e-test-modelcache.yaml` - ModelCache/LocalModel E2E
  4. `e2e-test-odh-xks-kind.yml` - ODH-specific xKS tests with multi-version Istio
  5. `e2e-test-kserve-module.yml` - kserve-module E2E
- All E2E workflows use KinD clusters for isolation
- `kserve-module/tests/e2e/` has separate E2E tests for the module pattern

**Test Organization:**
- `test/e2e/` with sub-directories: `batcher/`, `credentials/`, `custom/`, `explainer/`, `graph/`, `helm/`, `llmisvc/`, `logger/`, `modelcache/`, `predictor/`, `qpext/`, `storage/`, `storagespec/`, `transformer/`
- Python-based E2E tests using pytest
- `test/benchmark/` for performance benchmarks
- `test/crds/` for CRD validation
- `test/webhooks/` for webhook testing
- `test/overlays/` for kustomize overlay validation

**Multi-version/Multi-method Testing:**
- Matrix testing with both `kustomize` and `helm` install methods
- ODH-xKS workflow tests across Istio versions (1.27.5, 1.28.3) with TLS on/off matrix
- Smart path-based change detection to optimize which tests run

**Strengths:**
- Concurrency control on all E2E workflows
- Images built from PR source and loaded into KinD clusters
- Required-checks enforcement ensures all E2E tests must pass

### Build Integration

**Score: 8.0/10**

**PR-Time Build Validation:**
- `distro-build-check.yml` validates that the codebase compiles with both no build tags and `distro` tag - this is a critical gate for the midstream fork pattern
- E2E workflows build Docker images from PR source code and load them into KinD clusters for testing
- `kserve-module` has its own Dockerfile build and E2E pipeline
- `precommit-check.yml` runs `make check` on PRs (format, lint, codegen, manifest sync)
- `go-license-check.yml` validates license compliance

**Build System:**
- Comprehensive Makefile with `test`, `precommit`, `check`, `docker-build` targets
- `Makefile.overrides.mk` for midstream-specific build customization
- `Makefile.tools.mk` for tool version management
- Go build caching in Dockerfile with `--mount=type=cache`

**Gaps:**
- No Konflux build simulation in PR CI
- No `make docker-build` in PR-triggered workflows (only E2E builds images via ko/docker build)
- No operator bundle validation (`make bundle`) in PR CI

### Image Testing

**Score: 7.0/10**

**Dockerfile Quality:**
- Root `Dockerfile` uses UBI9 base images (`registry.access.redhat.com/ubi9/go-toolset:1.25` builder, `ubi9/ubi-minimal:latest` runtime)
- Multi-stage build with separate deps, builder, and license stages
- Efficient caching with `--mount=type=cache` for Go modules and build cache
- Non-root user (uid 1000) in runtime image
- License checking integrated into build (`go-licenses check` + `go-licenses save`)
- `ARG GOTAGS=""` support for distro build-tag propagation

**Container Patterns:**
- `.dockerignore` configured at root and `python/` level
- Multiple server Dockerfiles in `python/` for serving runtimes
- Sample Dockerfiles in `docs/samples/` for custom model serving

**Gaps:**
- No dedicated container runtime validation tests (HEALTHCHECK, startup probes)
- No multi-architecture build testing in CI
- No Testcontainers or equivalent for container-level integration testing
- 10+ Docker publish workflows are push-triggered (not PR-triggered), meaning image build issues could be missed

### Coverage Tracking

**Score: 9.0/10**

**Go Coverage:**
- `go-test-coverage` tool with `.github/.testcoverage.yml` configuration
- **80% overall coverage threshold enforced** as a required check
- `coverage.sh` script filters generated files via `.cov-ignore`
- PR coverage comparison: downloads master branch coverage artifact, compares current vs. master percentage
- Coverage breakdown posted as PR comment with expandable details
- Master coverage artifact uploaded and preserved for baseline comparison
- Exclusions for generated code (`zz_generated.deepcopy.go`, `openapi_generated.go`), testing helpers, and client packages

**Python Coverage:**
- `pytest --cov` used for all Python server packages
- Coverage reports generated per-server (kserve, sklearn, xgb, autogluon, pmml, lgb, paddle, huggingface)
- JUnit XML reports uploaded as test artifacts

**Strengths:**
- Coverage threshold is enforced (not just reported)
- Coverage trend tracking (increase/decrease detection)
- Separate coverage for each Python server package

### CI/CD Automation

**Score: 9.5/10**

**Workflow Inventory (50+ workflows):**
- **PR-triggered**: `go.yml`, `python-test.yml`, `precommit-check.yml`, `distro-build-check.yml`, `e2e-test.yml`, `e2e-test-llmisvc.yaml`, `e2e-test-modelcache.yaml`, `e2e-test-odh-xks-kind.yml`, `e2e-test-kserve-module.yml`, `go-license-check.yml`, `unicode-safety.yml`, `pr-style-check.yml`, `chaos-validate.yml`, `required-checks.yml`, `precommit-check-kserve-module.yml`
- **Push-triggered (publish)**: 15+ Docker image publish workflows for individual components
- **Scheduled**: `scheduled-go-security-scan.yml`
- **Utility**: `stalebot.yml`, `auto-assign-reviewers.yml`, `comment-cherry-pick.yml`, `rerun.yml`

**Best Practices:**
- All workflows use `concurrency` groups with `cancel-in-progress: true` to prevent duplicate runs
- Extensive caching: Go modules, uv virtual environments, Python package caches (separate per server)
- Path-based trigger filtering to avoid unnecessary test runs
- `merge_group` support for merge queue integration
- SHA-pinned GitHub Actions (enforced by `pinact` pre-commit hook)
- `required-checks.yml` enforces all checks pass before merge
- Smart change detection (e.g., E2E detects if only chart changes → only runs helm install method)
- Test results uploaded as artifacts with `upload-test-results` action

**Python CI Highlights:**
- 3-version matrix (3.10, 3.11, 3.12)
- Per-server virtual environment caching
- uv for fast dependency installation

### Static Analysis

**Score: 8.0/10**

**Go Linting:**
- `.golangci.yml` v2 configuration with 38+ enabled linters
- Notable linters: `gosec` (security), `gocritic` (diagnostics), `bodyclose` (HTTP), `errorlint` (error wrapping), `ginkgolinter` (test patterns), `staticcheck` (comprehensive analysis)
- Custom `forbidigo` rules for test files (prohibits `SetLogger` direct calls, `fmt.Print*` in tests)
- `importas` aliases enforced for k8s and controller-runtime packages
- Formatters: `gofmt`, `gofumpt`, `goimports`
- Exclusions for generated code directories (`client/`, `openapi/`, `tools/tf2openapi/generated/`)

**Python Linting:**
- `ruff` configured via `ruff.toml` (modern, fast Python linter)
- Both `ruff-format` and `ruff` (linting) in pre-commit hooks

**Pre-commit Hooks:**
- `helm-docs` for chart documentation
- `pinact` for GitHub Actions SHA pinning enforcement
- `ruff-format` + `ruff` for Python

**Security Checks:**
- `unicode-safety.yml` detects hidden unicode characters (supply chain attack vector)
- `chaos-validate.yml` runs operator chaos validation on PRs
- `scheduled-go-security-scan.yml` for periodic security scans

**FIPS Compatibility:**
- UBI9 base images (FIPS-capable at runtime)
- No non-FIPS crypto imports found in Go source code (positive)
- No explicit `-tags=fips` or `GOEXPERIMENT=boringcrypto` in build configuration
- No FIPS build verification in CI

**Dependency Alerts:**
- No `.github/dependabot.yml` configured
- No `renovate.json` or `.renovaterc` found
- GitHub Actions are SHA-pinned (good supply chain practice) but no automated update mechanism

### Agent Rules

**Score: 8.5/10**

**Configuration:**
- `AGENTS.md` present at root with comprehensive controller conventions
- `CLAUDE.md` is a symlink to `AGENTS.md` (consistent across tooling)
- `.rules/` directory with 6 dedicated rule files:
  1. `build-tags.md` - Detailed midstream build-tag and companion-file rules with 6 violation categories and exemptions
  2. `distro-builds.md` - GOTAGS propagation through Dockerfiles, Makefiles, Tekton pipelines
  3. `e2e-openshift-compat.md` - E2E test OpenShift compatibility (SCC, runAsUser, TLS)
  4. `kustomize-hygiene.md` - Kustomize overlay validation rules
  5. `makefile-split.md` - Makefile conventions and midstream override patterns
  6. `rbac-isolation.md` - RBAC isolation rules for midstream changes

**AGENTS.md Quality:**
- Clear constraints section (generated files, Makefile as source of truth, ODH logic isolation)
- Detailed ODH-specific change location table
- Hook pair pattern documentation with examples
- Testing conventions: envtest usage, namespace isolation, async patterns, cleanup requirements
- Controller conventions: idempotent reconciliation, status helpers, observedGeneration
- Commands: `make test`, `make precommit`, focused test invocation with `KUBEBUILDER_ASSETS`

**Strengths:**
- Rules are actionable with specific violation categories and remediation guidance
- Rules cover both Go and Python test patterns
- Rules address the unique challenges of a midstream fork (build tags, companion files, upstream sync conflict avoidance)
- Framework-specific: envtest patterns, Ginkgo/Gomega conventions, kustomize practices

**Gaps:**
- No `.claude/rules/` directory (rules are in `.rules/` instead - non-standard location for Claude Code, though they're linked via AGENTS.md)
- No dedicated test-creation rules for Python serving runtime tests
- No `.claude/skills/` directory for custom skills

## Recommendations

### Priority 0 (Critical)

1. **Enable Dependabot** for `gomod`, `pip`, `docker`, and `github-actions` ecosystems. This is a 1-2 hour task that immediately provides automated vulnerability alerts and dependency update PRs. Given the SHA-pinned actions already in place, Dependabot would complement existing practices by proposing SHA updates.

2. **Add FIPS build verification** by extending the `distro-build-check.yml` matrix to include a `distro,fips` tag combination. This validates FIPS-compliant compilation at PR time without requiring runtime FIPS testing.

### Priority 1 (High Value)

3. **Add Konflux build simulation** - Create a workflow or extend existing CI to simulate Konflux hermetic build conditions (cachito-style dependency resolution, specific build-arg defaults). This catches post-merge build failures.

4. **Add multi-architecture build validation** - At minimum, add an `arm64` cross-compilation check to `distro-build-check.yml` using `GOARCH=arm64 go build` to catch platform-specific compilation issues.

5. **Enable t.Parallel()** in independent unit tests (start with `pkg/utils/`, `pkg/logger/`, `pkg/batcher/`, `tools/tf2openapi/`) to reduce CI wall-clock time.

### Priority 2 (Nice-to-Have)

6. **Add container runtime validation tests** - Verify that built images start correctly, respond to health probes, and handle basic inference requests. Could use Testcontainers-go or KinD-based smoke tests.

7. **Add contract tests** between the Python KServe SDK client and Go controller API boundaries to catch API drift.

8. **Consider moving `.rules/` to `.claude/rules/`** for standard Claude Code discovery, while keeping AGENTS.md as the entry point.

9. **Add performance regression testing** for inference prediction endpoints with benchmark tracking.

## Comparison to Gold Standards

| Dimension | kserve (8.3) | odh-dashboard | notebooks | k8s best practices |
|-----------|:---:|:---:|:---:|:---:|
| Unit Tests | Strong (8.5) | Multi-layer | Basic | envtest ++ |
| Integration/E2E | Excellent (9.0) | Contract tests | Image E2E | CRD validation ++ |
| Build Integration | Good (8.0) | Module Federation | Multi-arch | Operator SDK bundle |
| Image Testing | Adequate (7.0) | BFF testing | 5-layer validation | Health probes |
| Coverage Tracking | Excellent (9.0) | Threshold enforcement | Basic | > 80% enforced |
| CI/CD Automation | Exceptional (9.5) | Comprehensive | Matrix builds | Concurrency ++ |
| Static Analysis | Good (8.0) | ESLint strict | FIPS checks | Dependabot ++ |
| Agent Rules | Strong (8.5) | Comprehensive | Basic | N/A |

**Notable kserve strengths vs. gold standards:**
- Coverage enforcement (80% threshold) matches kserve upstream gold standard
- CI/CD automation is among the most comprehensive in the RHOAI ecosystem
- Distro build-tag verification is unique and highly valuable for midstream fork management
- Agent rules are significantly more detailed than most repositories, particularly for midstream conventions
- Chaos validation (`chaos-validate.yml`) is a differentiator not commonly seen

## File Paths Reference

### CI/CD
- `.github/workflows/go.yml` - Go unit tests + coverage
- `.github/workflows/python-test.yml` - Python server unit tests
- `.github/workflows/e2e-test.yml` - Main E2E test suite (1576 lines)
- `.github/workflows/e2e-test-llmisvc.yaml` - LLMISVC E2E
- `.github/workflows/e2e-test-modelcache.yaml` - ModelCache E2E
- `.github/workflows/e2e-test-odh-xks-kind.yml` - ODH xKS E2E
- `.github/workflows/e2e-test-kserve-module.yml` - kserve-module E2E
- `.github/workflows/distro-build-check.yml` - Build tag verification
- `.github/workflows/precommit-check.yml` - Pre-commit validation
- `.github/workflows/chaos-validate.yml` - Operator chaos validation
- `.github/workflows/required-checks.yml` - Required check enforcement
- `.github/workflows/unicode-safety.yml` - Unicode safety
- `.github/workflows/pr-style-check.yml` - PR description validation
- `.github/workflows/go-license-check.yml` - License compliance
- `.github/workflows/scheduled-go-security-scan.yml` - Security scanning
- `.github/.testcoverage.yml` - Coverage threshold configuration

### Testing
- `test/e2e/` - E2E test directory (14 subdirectories)
- `test/benchmark/` - Performance benchmarks
- `test/crds/` - CRD validation
- `test/webhooks/` - Webhook tests
- `test/overlays/` - Kustomize overlays
- `pkg/testing/` - Shared test utilities (envtest, namespace, config)
- `coverage.sh` - Coverage post-processing script
- `.cov-ignore` - Coverage file exclusions

### Code Quality
- `.golangci.yml` - golangci-lint v2 config (38+ linters)
- `.pre-commit-config.yaml` - Pre-commit hooks (helm-docs, pinact, ruff)
- `ruff.toml` - Python linting configuration

### Container Images
- `Dockerfile` - Root controller Dockerfile (UBI9 multi-stage)
- `.dockerignore` - Docker build exclusions
- `python/.dockerignore` - Python Docker exclusions

### Agent Rules
- `AGENTS.md` - Comprehensive controller and midstream conventions
- `CLAUDE.md` - Symlink to AGENTS.md
- `.rules/build-tags.md` - Build tag and companion file rules
- `.rules/distro-builds.md` - GOTAGS propagation rules
- `.rules/e2e-openshift-compat.md` - E2E OpenShift compatibility
- `.rules/kustomize-hygiene.md` - Kustomize overlay rules
- `.rules/makefile-split.md` - Makefile convention rules
- `.rules/rbac-isolation.md` - RBAC isolation rules

### Build System
- `Makefile` - Primary build system (43KB)
- `Makefile.overrides.mk` - Midstream build overrides
- `Makefile.tools.mk` - Tool version management
- `go.mod` - Go module (Go 1.25.8)
