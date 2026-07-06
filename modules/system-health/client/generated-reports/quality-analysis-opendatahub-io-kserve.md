---
repository: "opendatahub-io/kserve"
overall_score: 7.8
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "455 test files (199 Go + 256 Python), envtest for controllers, pytest with coverage, multi-Python-version matrix"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "91 E2E test files, 6 E2E workflows, Kind-based, Helm/Kustomize matrix, chaos testing, benchmarks"
  - dimension: "Build Integration"
    score: 7.0
    status: "8 Tekton/Konflux pipelines, distro build-tag verification, but no PR-time Konflux simulation"
  - dimension: "Image Testing"
    score: 5.0
    status: "Multi-stage UBI9 Dockerfiles with license checks, but no vulnerability scanning or runtime validation"
  - dimension: "Coverage Tracking"
    score: 8.0
    status: "Go: 80% threshold with go-test-coverage, diff-based PR reporting; Python: coverage collected but not enforced"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "50 workflows, concurrency control, path filtering, merge queue, release automation, required checks"
  - dimension: "Agent Rules"
    score: 6.0
    status: "AGENTS.md with testing conventions, .rules/ with 5 midstream rules, but no .claude/ or per-test-type rules"
critical_gaps:
  - title: "No container vulnerability scanning (Trivy/Snyk/Grype)"
    impact: "CVEs in base images or dependencies reach production undetected; no SBOM for supply chain compliance"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No image runtime validation in CI"
    impact: "Container startup failures, missing entrypoints, or broken shared libs not caught until deployment"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "Python coverage not enforced"
    impact: "Python test coverage can silently regress; 148 kserve tests exist but no threshold prevents erosion"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No multi-architecture CI builds"
    impact: "ARM64/ppc64le/s390x compatibility issues caught only in downstream Konflux builds"
    severity: "MEDIUM"
    effort: "8-12 hours"
quick_wins:
  - title: "Add Trivy scanning to Tekton pull-request pipelines"
    effort: "2-3 hours"
    impact: "Catches CVEs before merge; SARIF upload enables GitHub Security tab integration"
  - title: "Add Python coverage threshold to python-test.yml"
    effort: "1-2 hours"
    impact: "Prevents silent Python test coverage regression across 9 serving packages"
  - title: "Add container startup smoke test to E2E workflow"
    effort: "2-3 hours"
    impact: "Validates all 8 built images can start and respond to health checks"
  - title: "Create .claude/rules/ with test-creation rules"
    effort: "2-3 hours"
    impact: "Standardizes AI-generated tests across Go envtest and Python pytest patterns"
recommendations:
  priority_0:
    - "Add Trivy or Grype vulnerability scanning to both GitHub Actions and Tekton pipelines"
    - "Add SBOM generation (Syft) to container build pipelines for supply chain compliance"
    - "Enforce Python coverage thresholds (pytest-cov --cov-fail-under) matching Go's 80% standard"
  priority_1:
    - "Add container startup validation (health check probe) for all 8 built images in E2E"
    - "Create .claude/rules/ directory with per-test-type rules (unit-tests.md, e2e-tests.md, envtest.md)"
    - "Add multi-architecture build matrix (amd64, arm64) to at least the controller Dockerfile"
    - "Integrate Codecov for unified Go + Python coverage dashboard and PR annotations"
  priority_2:
    - "Add secret detection (Gitleaks) to pre-commit and CI"
    - "Add FUZZ testing for API validation webhooks"
    - "Add performance regression testing for prediction latency (extend benchmark suite)"
    - "Add contract tests between Python SDK and Go controller APIs"
---

# Quality Analysis: opendatahub-io/kserve

## Executive Summary

- **Overall Score: 7.8/10**
- **Repository Type**: Kubernetes operator (model serving platform), ODH midstream fork of kserve/kserve
- **Languages**: Go (603 files), Python (640 files) — dual-language monorepo
- **Key Strengths**: Exceptional E2E test coverage with 91 test files across 6 workflows, strong Go coverage enforcement (80% threshold with diff-based PR reporting), comprehensive CI/CD with 50 workflows, and well-documented midstream coding conventions via AGENTS.md and `.rules/`
- **Critical Gaps**: No container vulnerability scanning, no image runtime validation, Python coverage collected but not enforced, no multi-architecture CI builds
- **Agent Rules Status**: Present (AGENTS.md + .rules/) but incomplete — no .claude/ directory or per-test-type rules

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.0/10 | 455 test files (199 Go + 256 Python), envtest for controllers, multi-Python matrix |
| Integration/E2E | 9.0/10 | 91 E2E files, 6 workflows, Kind-based, Helm/Kustomize matrix, chaos tests |
| **Build Integration** | **7.0/10** | **8 Tekton/Konflux pipelines, distro build-tag CI, no PR-time Konflux sim** |
| Image Testing | 5.0/10 | Multi-stage UBI9 Dockerfiles, license checks, no scanning/runtime validation |
| Coverage Tracking | 8.0/10 | Go: 80% threshold + PR comments; Python: coverage collected, not enforced |
| CI/CD Automation | 9.0/10 | 50 workflows, concurrency control, path filtering, merge queue support |
| Agent Rules | 6.0/10 | AGENTS.md + .rules/ present, no .claude/ or test-creation rules |

## Critical Gaps

### 1. No Container Vulnerability Scanning
- **Impact**: CVEs in UBI9 base images, Go modules, or Python dependencies reach production undetected. No SBOM generation for supply chain compliance (required for FedRAMP/SSDF)
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Current State**: Gosec runs on Go source (`scheduled-go-security-scan.yml`) but no container-level scanning (Trivy, Grype, Snyk). No `.trivyignore` or vulnerability threshold configuration
- **Evidence**: No `trivy` or `grype` references in any workflow; no SBOM tooling (Syft, CycloneDX)

### 2. No Image Runtime Validation
- **Impact**: Container startup failures (missing shared libs, incorrect entrypoints, permission issues) only surface in downstream deployments. The E2E suite builds images but doesn't validate them independently
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Current State**: E2E tests deploy to Kind and exercise the full stack, but there's no isolated image smoke test that validates each of the 8 images can start, expose health endpoints, and handle basic requests
- **Evidence**: `test/scripts/gh-actions/build-images.sh` builds images; no startup validation step follows

### 3. Python Coverage Not Enforced
- **Impact**: Python test coverage can silently regress. The 148 kserve tests and 108 tests across 8 other packages collect `--cov` data but no threshold prevents erosion
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Current State**: `pytest --cov=kserve`, `pytest --cov=storage`, etc. collect coverage but don't fail on regression. Go has `go-test-coverage` with 80% threshold — Python should match
- **Evidence**: All 10 pytest invocations in `python-test.yml` use `--cov` but none use `--cov-fail-under`

### 4. No Multi-Architecture CI Builds
- **Impact**: ARM64, ppc64le, s390x compatibility issues discovered only in downstream Konflux/OSBS builds, causing late-cycle failures
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Current State**: Dockerfiles use `CGO_ENABLED=0` (good for cross-compilation) but CI only builds linux/amd64. Tekton pipelines don't specify platform matrix
- **Evidence**: No `--platform` flags in Dockerfiles; no `docker buildx build --platform` in workflows

## Quick Wins

### 1. Add Trivy Scanning to Tekton Pull-Request Pipelines
- **Effort**: 2-3 hours
- **Impact**: Catches CVEs before merge; SARIF upload to GitHub Security tab
- **Implementation**: Add a Trivy task after image build in each `*-pull.yaml` Tekton pipeline:
  ```yaml
  - name: trivy-scan
    taskRef:
      resolver: bundles
      params:
        - name: bundle
          value: quay.io/redhat-appstudio-tekton-catalog/task-trivy-scan:0.1
    params:
      - name: IMAGE
        value: $(tasks.build.results.IMAGE_URL)
  ```

### 2. Add Python Coverage Threshold
- **Effort**: 1-2 hours
- **Impact**: Prevents silent Python test coverage regression
- **Implementation**: Add `--cov-fail-under=70` to all pytest invocations in `python-test.yml`:
  ```bash
  pytest --cov=kserve --cov-fail-under=70 --junitxml=/tmp/junit_unit_kserve.xml ./kserve
  ```

### 3. Add Container Startup Smoke Test
- **Effort**: 2-3 hours
- **Impact**: Validates all 8 built images start correctly
- **Implementation**: After image build in E2E workflow, add per-image startup check:
  ```bash
  for img in kserve-controller kserve-router kserve-agent storage-initializer; do
    docker run --rm -d --name smoke-$img $img:$TAG
    timeout 30 bash -c "until docker inspect smoke-$img | jq -e '.[0].State.Running'; do sleep 1; done"
    docker stop smoke-$img
  done
  ```

### 4. Create .claude/rules/ with Test-Creation Rules
- **Effort**: 2-3 hours
- **Impact**: Standardizes AI-generated tests; the repo already has AGENTS.md with testing conventions — extract into structured per-type rules
- **Implementation**: Run `/test-rules-generator` to auto-generate rules from existing test patterns

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory (50 total)**:

| Category | Count | Trigger | Examples |
|----------|-------|---------|----------|
| Unit Tests | 2 | PR, push, merge_group | `go.yml`, `python-test.yml` |
| E2E Tests | 6 | PR (path-filtered) | `e2e-test.yml`, `e2e-test-llmisvc.yaml`, `e2e-test-modelcache.yaml`, `e2e-test-odh-xks-kind.yml`, `e2e-test-quick-install.yaml`, `e2e-test-kserve-module.yml` |
| Docker Publish | 17 | push to master/release | All `*-docker-publish.yml` files |
| Security | 2 | PR + weekly schedule | `scheduled-go-security-scan.yml`, `unicode-safety.yml` |
| Quality Checks | 5 | PR | `precommit-check.yml`, `distro-build-check.yml`, `go-license-check.yml`, `pr-style-check.yml`, `required-checks.yml` |
| Tekton/Konflux | 18 | PR + push | 8 components × (pull + push) + group-test + module-operator |
| Release/Ops | 8 | manual/schedule | Release, helm, stalebot, cherry-pick, rerun |

**Strengths**:
- **Concurrency control**: All major workflows use `cancel-in-progress: true`
- **Path filtering**: E2E tests skip when only docs/markdown change
- **Merge queue**: Go test, precommit, and required-checks support `merge_group`
- **Distro build check**: Verifies both `distro` and no-tag builds compile
- **Tekton integration**: 18 Konflux PipelineRuns for all components (pull + push)
- **Group testing**: `kserve-group-test.yaml` validates all components together

**Gaps**:
- No CodeQL/SAST integration
- No dependency update automation (Dependabot/Renovate)
- Docker publish workflows don't run Trivy

### Test Coverage

**Go Tests (199 files)**:
- **Controller tests**: 90 files across v1alpha1, v1alpha2, v1beta1 controllers
  - llmisvc controller: 51 test files (heaviest coverage)
  - localmodelnode controller: 6 test files
  - inferenceservice controller: 5 test files
- **API tests**: 36 files for serving API types
- **Webhook tests**: 12 files covering admission webhooks (pod, servingruntime, localmodel, llminferenceservice)
- **envtest usage**: 13 files use envtest for realistic controller testing
- **Framework**: Standard Go `testing` + envtest + gomega matchers
- **Coverage**: 80% total threshold enforced via `go-test-coverage`

**Python Tests (256 files)**:
- **kserve SDK**: 148 test files (core inference client, protocol handlers)
- **huggingfaceserver**: 11 test files (vLLM, reranking, time-series, pooling)
- **autogluonserver**: 7 test files (version compat, timeseries, predictor factory)
- **storage**: 7 test files (S3, GCS, Azure, HuggingFace, confidential storage)
- **Other servers**: sklearn (2), xgboost (2), lightgbm (2), pmml (1), paddle (1)
- **Framework**: pytest with pytest-cov, multi-Python matrix (3.10, 3.11, 3.12)
- **Coverage**: `--cov` flag used but no `--cov-fail-under` threshold

**E2E Tests (91 files)**:
- **Predictors**: sklearn, tensorflow, pytorch, triton, xgboost, lightgbm, pmml, paddle, autogluon, huggingface, vLLM, mlflow, predictive
- **Infrastructure**: canary deployments, autoscaling, raw deployment, multi-model serving, multi-container probing, scheduler, response headers
- **LLMISvc**: Dedicated E2E workflow for LLM inference service
- **ModelCache**: Dedicated E2E workflow for local model caching
- **Graphs**: InferenceGraph testing
- **Explainers**: Model explanation testing
- **Install methods**: Helm vs Kustomize matrix
- **Framework**: pytest + httpx + kserve Python SDK

**Chaos Testing**: Present (`chaos/experiments/`) — chaos engineering experiments for resilience testing

**Benchmark Tests**: Present (`test/benchmark/`) — vegeta-based load testing configs for sklearn and tensorflow

### Code Quality

**Go Linting**:
- `.golangci.yml` with **38 linters enabled** (comprehensive)
- Includes security-relevant linters: `gosec`, `bidichk`, `spancheck`
- Import alias enforcement via `importas`
- Formatter checks: `gofmt`, `gofumpt`, `goimports`
- Generated code excluded

**Python Linting**:
- `ruff.toml` with B, E, F, W rule sets
- Pre-commit integration via `ruff-pre-commit`
- Generated code (protobuf, OpenAPI) excluded

**Pre-commit Hooks**:
- `helm-docs` for chart documentation
- `pinact` for GitHub Actions SHA pinning verification
- `ruff-format` and `ruff` for Python formatting and linting

**Static Analysis**:
- **Gosec**: Weekly scheduled + PR-triggered security scanning with SARIF upload to GitHub Code Scanning
- **Unicode safety**: Hidden unicode character detection on PRs
- **License checking**: `go-licenses` for main module and qpext

**Missing**:
- No CodeQL for deep SAST analysis
- No Gitleaks/TruffleHog for secret detection
- No mypy for Python type checking

### Container Images

**Build Process**:
- 7 Dockerfiles for distinct components (controller, router, agent, storage-initializer, localmodel, llmisvc-controller, kserve-module-controller)
- Multi-stage builds: deps → builder → license → runtime (4 stages)
- BuildKit cache mounts (`--mount=type=cache`) for Go module and build caches
- License compliance baked into build (`go-licenses check` + `go-licenses save`)
- UBI9 base images (`ubi9/go-toolset:1.25` for build, `ubi9/ubi-minimal` for runtime)
- Non-root user (1000:1000) in runtime images
- `CGO_ENABLED=0` for static linking

**Tekton/Konflux Pipelines**:
- 8 components have pull-request and push PipelineRuns
- Push targets: `quay.io/opendatahub/*:odh-stable`
- PR targets: `quay.io/opendatahub/*:odh-pr`
- Group test pipeline for coordinated multi-component validation

**Missing**:
- No Trivy/Grype vulnerability scanning
- No SBOM generation (Syft/CycloneDX)
- No multi-architecture build support (linux/amd64 only)
- No image signing/attestation (Cosign/Sigstore)
- No container startup validation in CI

### Security

**Present**:
- **Gosec**: PR-triggered + weekly scheduled scanning with SARIF upload to GitHub Code Scanning
- **Unicode safety**: Bidirectional character detection
- **License compliance**: `go-licenses` check in build and CI
- **GitHub Actions pinning**: SHA-pinned actions with `pinact` verification
- **Non-root containers**: USER 1000:1000 in all Dockerfiles
- **Minimal base images**: UBI9-minimal for runtime
- **Shadow-utils cleanup**: Removed after user creation

**Missing**:
- No CodeQL/Semgrep for deep SAST
- No container image scanning (Trivy, Grype, Snyk)
- No SBOM generation
- No secret detection (Gitleaks, TruffleHog)
- No dependency scanning automation (Dependabot, Renovate)
- No image signing (Cosign)

### Agent Rules (Agentic Flow Quality)

**Present**:
- **AGENTS.md**: Comprehensive document covering:
  - Repo constraints (generated files, Makefile as source of truth)
  - ODH-specific change patterns (build tags, companion files, hook pairs)
  - Layout guide (APIs, controllers, webhooks, binaries)
  - Testing conventions (envtest, fake client, per-test namespace, Eventually/Consistently)
  - Controller conventions (idempotency, status writes, Mark* helpers)
- **.rules/ directory**: 5 midstream-specific rules:
  - `build-tags.md` — distro build tag patterns for Go files
  - `distro-builds.md` — Dockerfile/Makefile/Tekton GOTAGS propagation
  - `kustomize-hygiene.md` — upstream manifest protection
  - `makefile-split.md` — Makefile.overrides.mk separation
  - `rbac-isolation.md` — RBAC isolation for ODH-specific permissions

**Missing**:
- No `.claude/` directory (no per-test-type rules for unit, integration, E2E)
- No `.claude/rules/` with test-creation templates
- No `.claude/skills/` for custom analysis/testing skills
- AGENTS.md testing section is good but not machine-actionable (no checklists, no example-driven rules)
- No Python test patterns documented (only Go envtest patterns covered)

**Recommendation**: Use `/test-rules-generator` to auto-generate `.claude/rules/` from existing test patterns. The repo has excellent test examples to learn from.

## Recommendations

### Priority 0 (Critical)

1. **Add container vulnerability scanning**
   - Integrate Trivy into Tekton pull-request pipelines (all 8 components)
   - Add `trivy image` step in GitHub Actions E2E workflow after image build
   - Configure severity thresholds (CRITICAL, HIGH) with `.trivyignore` for known exceptions
   - Upload SARIF results to GitHub Code Scanning for unified security dashboard

2. **Generate SBOM for all container images**
   - Add Syft to Tekton pipelines for CycloneDX/SPDX SBOM generation
   - Attach SBOM as image attestation (required for FedRAMP/SSDF compliance)

3. **Enforce Python coverage thresholds**
   - Add `--cov-fail-under=70` to all pytest invocations in `python-test.yml`
   - Ramp to 80% to match Go threshold
   - Consider Codecov for unified Go + Python coverage dashboard

### Priority 1 (High Value)

4. **Add container startup validation**
   - After E2E image build, run each image in isolation and verify:
     - Process starts without error
     - Health/readiness endpoints respond
     - Expected ports are exposed
   - Catches shared library issues, missing configs, permission problems

5. **Create .claude/rules/ for test automation**
   - `unit-tests.md`: Go envtest patterns (pkgtest.NewEnvTest, fake client, Eventually)
   - `python-tests.md`: pytest patterns (fixtures, conftest, mock strategies)
   - `e2e-tests.md`: E2E patterns (kserve client, async, httpx)
   - `webhook-tests.md`: Admission webhook test patterns

6. **Add multi-architecture build support**
   - Use `docker buildx build --platform linux/amd64,linux/arm64` in at least controller workflow
   - Test ARM64 compatibility with QEMU-based buildx
   - Start with controller and router (most commonly deployed)

7. **Integrate Codecov for unified coverage**
   - Replace custom coverage reporting with Codecov/Coveralls
   - Single dashboard for Go + Python coverage
   - PR annotations with per-file diff coverage
   - Merge coverage from Go and Python test runs

### Priority 2 (Nice-to-Have)

8. **Add secret detection**
   - Integrate Gitleaks in pre-commit and CI
   - Scan for hardcoded credentials, API keys, tokens
   - Configure `.gitleaks.toml` allowlist for test fixtures

9. **Add fuzz testing for API webhooks**
   - Go 1.18+ native fuzzing for admission webhook handlers
   - Focus on `pkg/webhook/admission/` validation logic
   - Example: fuzz InferenceService spec validation

10. **Extend benchmark testing**
    - Automate vegeta-based load tests in scheduled CI
    - Track prediction latency regression over releases
    - Add latency budget thresholds

11. **Add contract tests**
    - Validate Python SDK (`kserve` package) against Go controller API types
    - Catch API drift between Python client and Go server
    - Use OpenAPI spec as contract source

## Comparison to Gold Standards

| Dimension | kserve (ODH) | odh-dashboard | notebooks | Best Practice |
|-----------|-------------|---------------|-----------|---------------|
| Unit Tests | 8.0 - 455 files, envtest | 9.0 - Multi-layer, Jest | 7.0 - Notebook testing | 9.0+ |
| Integration/E2E | 9.0 - 91 E2E, 6 workflows | 9.0 - Cypress, contract | 8.0 - Image validation | 9.0+ |
| Build Integration | 7.0 - Tekton + distro check | 8.0 - Module federation | 7.0 - Image builds | 9.0 |
| Image Testing | 5.0 - No scanning/runtime | 7.0 - Build validation | 9.0 - 5-layer validation | 9.0+ |
| Coverage Tracking | 8.0 - 80% Go threshold | 9.0 - Enforcement + PR | 6.0 - Limited | 9.0 |
| CI/CD | 9.0 - 50 workflows | 9.0 - Comprehensive | 8.0 - Multi-arch | 9.0+ |
| Agent Rules | 6.0 - AGENTS.md + .rules/ | 8.0 - Full .claude/ | 4.0 - None | 8.0+ |
| **Overall** | **7.8** | **8.6** | **7.0** | **9.0** |

### Key Differentiators

**kserve excels at**:
- E2E test breadth (91 files, 6 workflows, Helm/Kustomize matrix)
- Go coverage enforcement (80% threshold with diff-based PR reporting)
- Midstream coding conventions (AGENTS.md, .rules/ — rare in open source)
- Distro build-tag verification (ensures both `distro` and default builds compile)
- Chaos engineering experiments

**kserve trails in**:
- Container security scanning (vs. notebooks' 5-layer validation)
- Agent test-creation rules (vs. odh-dashboard's `.claude/rules/`)
- Python coverage enforcement (collected but not gated)
- Multi-architecture support (vs. notebooks' multi-arch matrix)

## File Paths Reference

### CI/CD
- `.github/workflows/go.yml` — Go unit tests + coverage
- `.github/workflows/python-test.yml` — Python unit tests (9 packages)
- `.github/workflows/e2e-test.yml` — Main E2E suite (1576 lines)
- `.github/workflows/e2e-test-llmisvc.yaml` — LLMISvc E2E tests
- `.github/workflows/e2e-test-modelcache.yaml` — ModelCache E2E tests
- `.github/workflows/scheduled-go-security-scan.yml` — Gosec scanning
- `.github/workflows/distro-build-check.yml` — Distro build tag verification
- `.github/.testcoverage.yml` — Go coverage threshold config (80%)
- `.tekton/` — 18 Konflux PipelineRuns

### Testing
- `pkg/controller/` — 90 Go controller test files
- `pkg/apis/` — 36 Go API test files
- `pkg/webhook/` — 12 Go webhook test files
- `test/e2e/` — 91 Python E2E test files
- `python/kserve/` — 148 Python SDK tests
- `python/huggingfaceserver/` — 11 HuggingFace server tests
- `test/benchmark/` — Vegeta load test configs
- `chaos/` — Chaos engineering experiments

### Code Quality
- `.golangci.yml` — 38 Go linters configured
- `ruff.toml` — Python linting (B, E, F, W rules)
- `.pre-commit-config.yaml` — helm-docs, pinact, ruff hooks
- `coverage.sh` — Go coverage processing

### Container Images
- `Dockerfile` — Main controller (multi-stage, UBI9)
- `llmisvc-controller.Dockerfile` — LLMISvc controller
- `router.Dockerfile` — Inference router
- `agent.Dockerfile` — Model agent
- `localmodel.Dockerfile` — LocalModel controller
- `localmodel-agent.Dockerfile` — LocalModel node agent
- `kserve-module-controller.Dockerfile` — KServe module controller

### Agent Rules
- `AGENTS.md` — Comprehensive development guide
- `.rules/build-tags.md` — Go build tag patterns
- `.rules/distro-builds.md` — Dockerfile/Makefile GOTAGS propagation
- `.rules/kustomize-hygiene.md` — Upstream manifest protection
- `.rules/makefile-split.md` — Makefile.overrides.mk separation
- `.rules/rbac-isolation.md` — RBAC isolation rules
