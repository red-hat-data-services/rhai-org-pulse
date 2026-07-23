---
repository: "red-hat-data-services/kserve"
overall_score: 7.9
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Strong Go unit test suite with 54% test-to-code ratio; Python SDK has 180+ tests across 7 packages"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Comprehensive PR-triggered E2E suite with 98 Python test files across 12 categories, Minikube clusters, multi-install-method matrix"
  - dimension: "Build Integration"
    score: 8.5
    status: "PR-time distro build check, Konflux Dockerfiles, Tekton pipelines, kustomize/helm dual install validation"
  - dimension: "Image Testing"
    score: 6.5
    status: "Multi-stage UBI-based builds with FIPS support; no runtime validation or container healthchecks"
  - dimension: "Coverage Tracking"
    score: 8.5
    status: "Go coverage with 80% threshold enforcement, PR diff reporting, master baseline comparison; Python uses pytest-cov but no threshold gate"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "50+ workflows with concurrency control, caching, path-filtered triggers, merge queue support"
  - dimension: "Static Analysis"
    score: 7.5
    status: "Extensive golangci-lint (35+ linters), ruff for Python, pre-commit hooks; no Dependabot/Renovate"
  - dimension: "Agent Rules"
    score: 8.0
    status: "AGENTS.md with testing guidance, .rules/ with 6 domain-specific rules, .github/agents/ with release automation"
critical_gaps:
  - title: "No Dependabot or Renovate for dependency alerts"
    impact: "Vulnerable or outdated dependencies go undetected; no automated PR generation for security patches"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No container runtime validation or healthcheck testing"
    impact: "Image startup failures and misconfigured entrypoints not caught until deployment"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Python coverage has no threshold enforcement"
    impact: "Python SDK coverage can silently regress without blocking PRs"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No FIPS build tags in upstream Dockerfiles"
    impact: "Only Konflux Dockerfiles have strictfipsruntime; dev/upstream builds are not FIPS-validated"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add .github/dependabot.yml for Go, Python, Docker, and GitHub Actions ecosystems"
    effort: "1-2 hours"
    impact: "Automated dependency update PRs with security alerts"
  - title: "Add Python coverage threshold in CI (pytest --cov-fail-under=80)"
    effort: "1 hour"
    impact: "Prevents Python SDK coverage regression on PRs"
  - title: "Add HEALTHCHECK to Dockerfiles"
    effort: "1-2 hours"
    impact: "Enables container orchestrators to detect unhealthy containers earlier"
  - title: "Add .claude/rules/ directory with test-creation rules"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality with framework-specific patterns"
recommendations:
  priority_0:
    - "Add Dependabot configuration covering gomod, pip, docker, and github-actions ecosystems"
    - "Add container runtime validation tests (build image, start container, verify health endpoint)"
  priority_1:
    - "Enforce Python coverage thresholds in CI matching Go's 80% standard"
    - "Add FIPS build tags to upstream Dockerfiles for consistency with Konflux builds"
    - "Add .claude/rules/ with unit test and E2E test creation patterns for the repo's specific frameworks"
  priority_2:
    - "Add chaos testing integration to CI (currently in chaos/ directory but not automated)"
    - "Add performance regression testing for inference endpoints"
    - "Consolidate Python coverage reporting with Codecov or similar dashboard"
---

# Quality Analysis: red-hat-data-services/kserve

## Executive Summary

- **Overall Score: 7.9/10**
- **Repository Type**: Kubernetes Serving Orchestration Operator (Go + Python)
- **Tier**: Downstream (red-hat-data-services)
- **Jira**: RHOAIENG / Serving Orchestration
- **Primary Languages**: Go (645 files), Python (656 files)
- **Framework**: controller-runtime operator with Python SDK and model servers

**Key Strengths**: Exceptional E2E test coverage with 98 test files across 12 categories running on PR. Strong Go coverage enforcement at 80% with PR diff reporting. Extensive CI with 50+ workflows including concurrency control and path-filtered triggers. Well-documented agent rules with domain-specific .rules/ files.

**Critical Gaps**: Missing Dependabot/Renovate for automated dependency alerts. No container runtime validation or HEALTHCHECK in Dockerfiles. Python coverage runs but has no threshold enforcement.

**Agent Rules Status**: Present and well-structured - AGENTS.md with testing guidance, .rules/ with 6 build/test rules, .github/agents/ with 2 release automation agents.

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 8.0/10 | 15% | 1.20 | Strong Go test suite (196 test files / 341 source = 57%), Python SDK 180+ tests |
| Integration/E2E | 9.0/10 | 20% | 1.80 | 98 E2E Python test files, PR-triggered, Minikube, kustomize+helm matrix |
| Build Integration | 8.5/10 | 15% | 1.28 | PR distro-build-check, Konflux Dockerfiles, Tekton pipelines, dual install |
| Image Testing | 6.5/10 | 10% | 0.65 | Multi-stage UBI builds, FIPS in Konflux; no runtime validation/healthchecks |
| Coverage Tracking | 8.5/10 | 10% | 0.85 | Go: 80% threshold + PR diff report; Python: pytest-cov but no threshold |
| CI/CD Automation | 9.0/10 | 15% | 1.35 | 50+ workflows, concurrency groups, caching, merge queue, path filtering |
| Static Analysis | 7.5/10 | 10% | 0.75 | golangci-lint (35+ linters), ruff, pre-commit; missing Dependabot/Renovate |
| Agent Rules | 8.0/10 | 5% | 0.40 | AGENTS.md, .rules/ (6 files), .github/agents/ (2 agents), .serena/ config |
| **Overall** | **7.9/10** | **100%** | **8.28** | |

## Critical Gaps

### 1. No Dependabot or Renovate for Dependency Alerts
- **Impact**: Vulnerable or outdated Go modules, Python packages, Docker base images, and GitHub Actions go undetected. No automated PR generation for security patches.
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Current State**: `.github/dependabot.yml` is completely absent. No `renovate.json` or `.renovaterc` either.

### 2. No Container Runtime Validation
- **Impact**: Image startup failures, incorrect entrypoints, and misconfigured runtime environments not caught until deployment. No Testcontainers or equivalent runtime testing.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Current State**: Dockerfiles are well-structured (multi-stage, UBI-based) but lack HEALTHCHECK instructions. No tests verify that built images start and respond correctly.

### 3. Python Coverage Not Enforced
- **Impact**: Python SDK coverage can silently regress without blocking PRs. Go has strict 80% threshold; Python has no equivalent gate.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Current State**: `pytest --cov` runs for all 9 Python packages but results are not checked against a threshold in CI.

### 4. FIPS Build Tags Only in Konflux Dockerfiles
- **Impact**: Dev/upstream Dockerfiles (Dockerfile, agent.Dockerfile, router.Dockerfile, etc.) use `CGO_ENABLED=0` without FIPS tags. Only `Dockerfiles/*.Dockerfile.konflux` use `GOEXPERIMENT=strictfipsruntime -tags strictfipsruntime`. This creates a gap between local development builds and production builds.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours

## Quick Wins

### 1. Add Dependabot Configuration (1-2 hours)
```yaml
# .github/dependabot.yml
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

### 2. Add Python Coverage Threshold (1 hour)
Add `--cov-fail-under=80` to all pytest invocations in `python-test.yml`:
```yaml
- name: Test kserve
  run: |
    cd python
    source kserve/.venv/bin/activate
    pytest --cov=kserve --cov-fail-under=80 --junitxml=/tmp/junit_unit_kserve.xml ./kserve
```

### 3. Add HEALTHCHECK to Dockerfiles (1-2 hours)
For controller images that expose health endpoints:
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["/manager", "--health-probe-bind-address=:8081", "healthz"] || exit 1
```

### 4. Add .claude/rules/ with Test Creation Patterns (2-3 hours)
Create framework-specific rules for Go controller tests (envtest patterns, `pkgtest.NewEnvTest()`, `Eventually`/`Consistently`) and Python E2E tests (pytest marks, async patterns). Can be generated with `/test-rules-generator`.

## Detailed Findings

### Unit Tests

**Go Unit Tests (Score: 8.0/10)**

- **226 test files** for 419 source files (54% test-to-code ratio)
- Tests colocated with source code in `pkg/` directory
- Key test distribution:
  - `pkg/`: 196 test files / 341 source files (57% ratio) - excellent
  - `cmd/`: 3 test files / 14 source files (21% ratio) - moderate
  - `qpext/`: 1 test file / 2 source files (50% ratio) - good
- **Framework**: Go standard `testing` with `envtest` for controller tests
- **Test isolation**: Uses `fake.NewClientBuilder()` for unit tests, `pkgtest.NewEnvTest()` for integration-style controller tests
- **Testing helpers**: Custom `pkg/testing/` package with `SetupTestLogger`, env test utilities
- **golangci-lint forbidigo rule** enforces test best practices (no `SetLogger`, no `fmt.Print` in tests)

**Python Unit Tests (Score: 7.5/10)**

- **180+ test files** across 9 packages tested in CI with Python 3.10, 3.11, 3.12 matrix
- Per-package test counts: kserve (152), huggingfaceserver (12), storage (7), autogluonserver (7), plus sklearnserver, xgbserver, pmmlserver, lgbserver, paddleserver
- **Framework**: pytest with `pytest-cov` and `pytest-asyncio`
- **Caching**: uv-based dependency caching per package in CI
- **Numpy compatibility**: Tests run against both numpy 1.x and 2.x

### Integration/E2E Tests

**E2E Test Infrastructure (Score: 9.0/10)**

- **98 Python E2E test files** in `test/e2e/` covering 12 categories:
  - predictor (17 tests): sklearn, xgboost, tensorflow, torchserve, vllm, triton, paddle, etc.
  - transformer (3 tests): raw transformer, collocation
  - explainer: alibi explainer
  - llmisvc: LLM inference service
  - modelcache: local model caching
  - graph: inference graph
  - storage/storagespec: OCI native, S3 with TLS
  - qpext: queue proxy extension
  - credentials, custom, batcher, logger

- **Cluster setup**: Minikube via `.github/actions/minikube-setup` reusable action (used 13+ times in E2E workflow)
- **Install method matrix**: Dynamic matrix testing both `kustomize` and `helm` installs based on changed paths
- **Multi-version testing**: ODH xKS KinD workflow tests across Istio versions (1.27.5, 1.28.3) with TLS toggle matrix

**Specialized E2E Workflows**:
- `e2e-test.yml`: Main E2E suite, PR-triggered, 14+ parallel test jobs
- `e2e-test-llmisvc.yaml`: LLM inference service E2E, path-filtered
- `e2e-test-modelcache.yaml`: Model caching E2E, path-filtered
- `e2e-test-odh-xks-kind.yml`: ODH-specific xKS testing on KinD with Istio matrix
- `e2e-test-kserve-module.yml`: kserve-module operator E2E
- `e2e-test-quick-install.yaml`: Quick install script validation

**Chaos Testing**: `chaos/` directory exists with experiments and knowledge files, though not yet automated in CI.

### Build Integration

**Build Validation (Score: 8.5/10)**

- **PR-time distro build check** (`distro-build-check.yml`): Verifies Go compilation with both empty tags and `distro` build tag. PR-triggered on any `.go`, `go.mod`, or `go.sum` changes.
- **Konflux integration**: 9 Konflux-specific Dockerfiles in `Dockerfiles/` directory for production builds
- **Tekton pipelines**: 20+ Tekton pipeline files in `.tekton/` for PR validation and release pushes:
  - `odh-kserve-controller-pull-request.yaml`
  - `odh-kserve-agent-pull-request.yaml` (actually push-only pipeline)
  - `odh-kserve-router-pull-request.yaml`
  - `odh-kserve-storage-initializer-pull-request.yaml`
  - `early-gate-ci-build.yaml` / `early-gate-ci-test.yaml`
- **Dual install validation**: E2E tests run with both kustomize and helm install methods
- **Precommit check** (`precommit-check.yml`): PR-triggered workflow running `make check` (format, lint, codegen, manifest sync)
- **Image builds in E2E**: Full image build pipeline in E2E workflow builds all controller/agent/router/storage images before testing

**Makefile Targets**:
- `make test`: Full Go test suite with coverage
- `make precommit`: Format, lint, codegen, manifest sync, verify pinned actions
- `make deploy`: Kustomize deployment
- `make docker-build`: Image builds for all components
- Multiple `make docker-build-*` targets for individual components

### Image Testing

**Container Image Analysis (Score: 6.5/10)**

- **Multi-stage builds**: All Dockerfiles use proper multi-stage builds (deps, builder, license, runtime)
- **UBI base images**: All images use `registry.access.redhat.com/ubi9/go-toolset:1.25` for build and `ubi9/ubi-minimal:latest` for runtime - FIPS-capable
- **Non-root user**: All Dockerfiles create and switch to `kserve` user (UID 1000)
- **License compliance**: Dedicated license stage using `go-licenses` in every Dockerfile
- **Build caching**: Uses `--mount=type=cache` for Go module and build caches
- **Konflux FIPS**: Konflux Dockerfiles use `GOEXPERIMENT=strictfipsruntime -tags strictfipsruntime`
- **Multi-arch support**: Konflux Dockerfiles use `TARGETOS`/`TARGETARCH` ARGs for cross-compilation

**Gaps**:
- No `HEALTHCHECK` instructions in any Dockerfile
- No Testcontainers or equivalent runtime validation
- No `docker-compose.test.yml` for local testing
- Upstream Dockerfiles lack FIPS build tags (only Konflux variants have them)
- No image startup smoke tests in CI

### Coverage Tracking

**Go Coverage (Score: 9.0/10)**

- **Threshold enforcement**: `.github/.testcoverage.yml` enforces **80% total coverage** using `vladopajic/go-test-coverage`
- **PR diff reporting**: Coverage comparison against master baseline with PR comment showing increase/decrease
- **Coverage profile**: `coverage.out` generated via `go test -coverprofile` with `-coverpkg ./pkg/... ./cmd/...`
- **Exclusions**: Generated files (deepcopy, defaults, openapi), client packages, and testing helpers excluded via `.cov-ignore`
- **Artifact management**: Coverage profiles uploaded as artifacts; master branch baseline stored for comparison
- **Breakdown reports**: Function-level coverage breakdown included in PR comments

**Python Coverage (Score: 6.0/10)**

- **pytest-cov**: All 9 Python packages use `--cov` flag in CI
- **JUnit XML**: Test results exported as JUnit XML for reporting
- **No threshold**: Coverage runs but has no `--cov-fail-under` enforcement
- **No dashboard**: No Codecov or Coveralls integration for Python coverage visualization
- **Upload**: Uses custom `.github/actions/upload-test-results` action but coverage isn't gated

### CI/CD Automation

**Workflow Architecture (Score: 9.0/10)**

- **54 workflows** in `.github/workflows/`
- **Concurrency control**: All major workflows use `concurrency` groups with `cancel-in-progress: true`
- **Path filtering**: Workflows use smart path-based triggers (e.g., Python tests only run on `python/**` changes)
- **Merge queue support**: Key workflows support `merge_group` trigger type
- **Caching**: uv virtual environment caching, Go module caching, Docker layer caching via BuildKit

**PR-Triggered Workflows** (run on every PR):
- `go.yml` - Go unit tests + coverage
- `python-test.yml` - Python tests across 3 Python versions
- `e2e-test.yml` - Full E2E suite with image builds
- `distro-build-check.yml` - Build tag verification
- `precommit-check.yml` - Format/lint/codegen check
- `go-license-check.yml` - License compliance
- `pr-style-check.yml` - PR title/description validation
- `unicode-safety.yml` - Unicode safety scan
- `scheduled-go-security-scan.yml` - Go security scan
- `e2e-test-llmisvc.yaml` - LLM-specific E2E (path-filtered)
- `e2e-test-modelcache.yaml` - Model cache E2E (path-filtered)
- `e2e-test-odh-xks-kind.yml` - ODH xKS E2E (path-filtered)
- `e2e-test-quick-install.yaml` - Quick install validation (path-filtered)

**Docker Publish Workflows** (push to master/release):
- 16 image publish workflows for all components (controller, agent, router, storage-initializer, and model servers)

**Scheduled/Maintenance**:
- `stalebot.yml` - Daily stale issue/PR management
- `sync-master-to-release.yaml` - Weekly master-to-release sync

**Reusable Actions**: `.github/actions/` directory with shared actions (minikube-setup, free-up-disk-space, upload-test-results)

### Static Analysis

**Linting (Score: 8.5/10)**

**Go - golangci-lint** (`.golangci.yml`):
- **35+ linters enabled** including security-critical ones: `gosec`, `bodyclose`, `contextcheck`, `nilerr`, `errorlint`
- **Performance linters**: `perfsprint`, `prealloc`, `ineffassign`, `wastedassign`
- **Code quality**: `gocritic`, `misspell`, `dupword`, `unconvert`, `unparam`
- **Style formatters**: `gofmt`, `gofumpt`, `goimports` with local prefix
- **Import aliases**: Enforced conventions for k8s and kserve packages
- **Custom forbidigo rules**: Prevents `SetLogger` and `fmt.Print` in test files
- **Exclusions**: Generated code, client packages, tf2openapi generated
- **6-minute timeout** configured for CI

**Python - ruff** (`ruff.toml`):
- Line length 88, B/E/F/W rule sets
- Exclusions for generated code (protobuf, openapi, models)
- Pre-commit integration via `ruff-pre-commit`

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- `helm-docs` for Helm chart README generation
- `pinact` for GitHub Actions SHA pinning verification
- `ruff-format` and `ruff` linting

#### FIPS Compatibility

- **Konflux Dockerfiles**: All 9 Konflux variants use `GOEXPERIMENT=strictfipsruntime -tags strictfipsruntime` with `CGO_ENABLED=1`
- **Upstream Dockerfiles**: Use `CGO_ENABLED=0` without FIPS tags
- **No non-FIPS crypto imports**: No `crypto/md5`, `crypto/des`, `crypto/rc4`, or `math/rand` in non-test source code
- **Base images**: All UBI-based (FIPS-capable), no alpine or debian

#### Dependency Alerts

- **No Dependabot**: `.github/dependabot.yml` is absent
- **No Renovate**: No `renovate.json`, `.renovaterc`, or `.renovaterc.json`
- **Gap**: This is the most significant static analysis gap - no automated dependency update mechanism

### Agent Rules

**Agent Rules Assessment (Score: 8.0/10)**

**AGENTS.md** (symlinked as CLAUDE.md):
- ODH midstream fork context and constraints
- Build tag pattern documentation (distro/default companion files)
- Layout map (APIs, Controllers, Webhooks, Binaries)
- Testing guidance: envtest patterns, `pkgtest.NewEnvTest()`, `Eventually`/`Consistently`, per-test namespace cleanup
- Controller conventions: idempotent reconciliation, status write guards, `Mark*` helpers
- Commands: `make test`, `make precommit`, focused test execution with `KUBEBUILDER_ASSETS`

**.rules/** (6 rule files):
- `build-tags.md` - Midstream build tag and companion file rules
- `distro-builds.md` - Distro build propagation rules for Dockerfiles/Makefiles/Tekton
- `e2e-openshift-compat.md` - E2E test OpenShift compatibility rules
- `kustomize-hygiene.md` - Midstream kustomize manifest hygiene rules
- `makefile-split.md` - Midstream Makefile split rules
- `rbac-isolation.md` - Midstream RBAC isolation rules

**.github/agents/** (2 agent definitions):
- `bump-version.agent.md` - Automated version bump agent for releases
- `release-orchestrator.agent.md` - Full interactive release orchestration agent

**.serena/** - Serena project configuration (Python LSP, project indexing)

**Gaps**:
- No `.claude/rules/` directory (rules are in `.rules/` instead)
- No explicit unit test creation rules (testing guidance is in AGENTS.md but not as structured rules)
- No Python test patterns documented in rules

## Recommendations

### Priority 0 (Critical)

1. **Add Dependabot configuration** for gomod, pip, docker, and github-actions ecosystems. This is the single fastest win for security posture.
2. **Add container runtime validation** - at minimum, verify built images start successfully and respond on their health endpoint before merging.

### Priority 1 (High Value)

3. **Enforce Python coverage thresholds** matching Go's 80% standard. Add `--cov-fail-under=80` to all pytest invocations in `python-test.yml`.
4. **Add FIPS build tags to upstream Dockerfiles** for parity with Konflux builds. Add `GOEXPERIMENT=strictfipsruntime` and `-tags strictfipsruntime` to Dockerfile, agent.Dockerfile, router.Dockerfile, etc.
5. **Create .claude/rules/ directory** with unit test and E2E test creation patterns. Use `/test-rules-generator` to bootstrap from existing test patterns.

### Priority 2 (Nice-to-Have)

6. **Automate chaos testing in CI** - the `chaos/` directory exists with experiments but isn't integrated into any workflow.
7. **Add Codecov/Coveralls integration** for unified Go + Python coverage dashboard and PR commenting.
8. **Add performance regression testing** for inference endpoints (prediction latency, throughput).
9. **Add HEALTHCHECK to Dockerfiles** for better container orchestrator health detection.

## Comparison to Gold Standards

| Practice | kserve (this repo) | odh-dashboard (gold) | notebooks (gold) | kserve upstream |
|---|---|---|---|---|
| Unit test ratio | 54% Go, 180+ Python | Multi-layer testing | - | Similar |
| E2E automation | PR-triggered, 14+ jobs | PR-triggered | 5-layer validation | PR-triggered |
| Coverage enforcement | Go: 80% threshold | Yes | - | Similar |
| PR coverage reporting | Go: PR comment diff | Yes | - | Similar |
| Python coverage gate | No threshold | N/A | - | No threshold |
| Dependabot/Renovate | Missing | Present | Present | Missing |
| Agent rules | AGENTS.md + .rules/ | Comprehensive | - | Basic |
| FIPS compliance | Konflux only | N/A | UBI-based | N/A |
| Container healthchecks | Missing | N/A | Present | Missing |
| Pre-commit hooks | helm-docs, pinact, ruff | ESLint, Prettier | - | Similar |
| Chaos testing | Dir exists, not automated | N/A | N/A | N/A |

## File Paths Reference

### CI/CD
- `.github/workflows/go.yml` - Go unit tests + coverage
- `.github/workflows/python-test.yml` - Python test suite
- `.github/workflows/e2e-test.yml` - Main E2E suite (57KB, 14+ jobs)
- `.github/workflows/distro-build-check.yml` - Build tag verification
- `.github/workflows/precommit-check.yml` - Precommit validation
- `.github/.testcoverage.yml` - Go coverage threshold config
- `.tekton/` - 20+ Tekton pipeline definitions
- `Makefile` - Primary build system (43KB)
- `Makefile.overrides.mk` - Midstream overrides

### Testing
- `pkg/` - Go unit tests (196 files, colocated with source)
- `test/e2e/` - Python E2E tests (98 files, 12 categories)
- `python/kserve/test/` - Python SDK tests (152 files)
- `python/huggingfaceserver/tests/` - HuggingFace server tests
- `python/storage/test/` - Storage provider tests
- `coverage.sh` - Go coverage report generation
- `.cov-ignore` - Coverage exclusion patterns

### Container Images
- `Dockerfile` - Main controller image (multi-stage, UBI-based)
- `agent.Dockerfile`, `router.Dockerfile`, `localmodel.Dockerfile`, etc. - Component Dockerfiles
- `Dockerfiles/*.Dockerfile.konflux` - 9 Konflux production Dockerfiles (FIPS-enabled)

### Static Analysis
- `.golangci.yml` - 35+ linters configured
- `ruff.toml` - Python linting config
- `.pre-commit-config.yaml` - Pre-commit hooks (helm-docs, pinact, ruff)

### Agent Rules
- `AGENTS.md` (→ `CLAUDE.md` symlink) - Comprehensive agent guidance
- `.rules/` - 6 domain-specific rule files
- `.github/agents/` - 2 release automation agents
- `.serena/project.yml` - Serena MCP configuration
