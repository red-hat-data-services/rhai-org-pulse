---
repository: "opendatahub-io/kserve"
overall_score: 7.9
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Excellent Go + Python test coverage with 80% threshold enforcement, multi-Python-version matrix, numpy compatibility testing"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Comprehensive E2E suite with 52 test files across 14 categories, KinD/Minikube clusters, multi-install-method (Helm+Kustomize), LLMISvc + ODH xKS variants"
  - dimension: "Build Integration"
    score: 6.5
    status: "PR-time Docker image builds for controllers, distro build tag verification, but no Konflux simulation or runtime validation"
  - dimension: "Image Testing"
    score: 5.5
    status: "Multi-stage UBI9 Dockerfiles with license checks, but no container vulnerability scanning, SBOM, or startup validation"
  - dimension: "Coverage Tracking"
    score: 8.5
    status: "go-test-coverage with 80% threshold, PR coverage diff reporting, master baseline comparison, artifact-based breakdown tracking"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "40+ workflows with concurrency control, path-based triggers, pinned actions, semantic PR checks, required status checks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory — zero AI agent guidance"
critical_gaps:
  - title: "No container vulnerability scanning (Trivy/Grype/Snyk)"
    impact: "CVEs in base images and dependencies not detected before merge or release"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No SBOM generation or image signing"
    impact: "No supply chain attestation; blocks compliance with SLSA/SSDF frameworks"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents generate inconsistent tests and code without project-specific guidance"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "Python test coverage not tracked or enforced"
    impact: "Python coverage regressions go undetected; pytest --cov runs but results aren't gated"
    severity: "MEDIUM"
    effort: "3-5 hours"
  - title: "No PR-time Konflux build simulation"
    impact: "Downstream build failures discovered only after merge in Konflux/OSBS pipelines"
    severity: "MEDIUM"
    effort: "8-12 hours"
quick_wins:
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Detect CVEs in UBI9 base images and Go/Python dependencies at PR time"
  - title: "Add codecov or coverage gate for Python tests"
    effort: "2-3 hours"
    impact: "Prevent Python test coverage regressions — pytest --cov already runs but results aren't enforced"
  - title: "Generate agent rules with /test-rules-generator"
    effort: "2-4 hours"
    impact: "Standardize AI-generated tests across Go controller and Python SDK packages"
  - title: "Add SBOM generation to Docker publish workflows"
    effort: "2-3 hours"
    impact: "Produce CycloneDX/SPDX SBOMs for supply chain compliance"
recommendations:
  priority_0:
    - "Add Trivy or Grype vulnerability scanning to all Docker publish workflows and PR checks"
    - "Enforce Python test coverage with a minimum threshold (e.g., 75%) and PR reporting"
    - "Add SBOM generation and image signing (cosign) to container publish pipelines"
  priority_1:
    - "Create comprehensive .claude/rules/ for Go controller tests, Python SDK tests, and E2E test patterns"
    - "Add PR-time Konflux/OSBS build simulation to catch downstream build breakages before merge"
    - "Add container startup validation (health check probe) as part of E2E image build step"
  priority_2:
    - "Expand benchmark tests into automated performance regression detection"
    - "Add contract tests for the kserve Python SDK API boundary"
    - "Integrate secret detection (gitleaks) into precommit workflow"
---

# Quality Analysis: opendatahub-io/kserve

## Executive Summary

- **Overall Score: 7.9/10**
- **Repository Type**: Kubernetes operator + Python ML serving SDK (polyglot Go/Python)
- **Key Strengths**: Exceptional E2E test infrastructure with KinD/Minikube deployment, strong Go coverage enforcement at 80%, comprehensive 40+ CI workflow suite with smart path-based triggering, excellent linting with 35+ golangci-lint rules
- **Critical Gaps**: Zero container vulnerability scanning, no SBOM/image signing, Python coverage untracked, no agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Excellent Go+Python unit tests, 80% Go threshold, multi-version Python matrix |
| Integration/E2E | 9.0/10 | 52 E2E tests across 14 categories with KinD/Minikube clusters |
| **Build Integration** | **6.5/10** | **PR Docker builds + distro tags, but no Konflux simulation** |
| Image Testing | 5.5/10 | Multi-stage UBI9 builds, license checks, but no vuln scanning or SBOM |
| Coverage Tracking | 8.5/10 | go-test-coverage at 80% threshold with PR diff reporting |
| CI/CD Automation | 9.0/10 | 40+ workflows, concurrency control, pinned actions, semantic PRs |
| Agent Rules | 0.0/10 | No agent rules or AI development guidance whatsoever |

## Critical Gaps

### 1. No Container Vulnerability Scanning
- **Impact**: CVEs in UBI9 base images and Go/Python dependencies are invisible until production
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Trivy, Grype, or Snyk integration in any of the 15+ Docker publish workflows. No `.trivyignore` file. Security scanning is limited to gosec for Go source code only.

### 2. No SBOM Generation or Image Signing
- **Impact**: Cannot attest supply chain provenance; blocks SLSA/SSDF compliance
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Docker publish workflows push images without SBOMs, attestation, or cosign signatures. Go license checking is excellent (go-licenses in Dockerfile + CI), but this doesn't satisfy supply chain security requirements.

### 3. No Agent Rules for AI-Assisted Development
- **Impact**: AI agents (Claude, Copilot) generate tests/code without understanding project patterns
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: No `.claude/`, no `CLAUDE.md`, no `AGENTS.md`. The project has strong testing conventions (envtest for controllers, pytest with fixtures for Python, specific import aliases) that agents won't discover without guidance.

### 4. Python Test Coverage Not Tracked/Enforced
- **Impact**: Python SDK coverage can regress silently; `--cov` flag runs but output isn't gated
- **Severity**: MEDIUM
- **Effort**: 3-5 hours
- **Details**: Go coverage has a robust enforcement pipeline (go-test-coverage at 80%, PR diff comments, master baseline comparison). Python tests run `pytest --cov` for 8 packages but don't enforce thresholds or report to PRs.

### 5. No PR-Time Konflux/OSBS Build Simulation
- **Impact**: Downstream Red Hat build pipeline failures discovered only post-merge
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Details**: The `distro-build-check.yml` validates Go compilation with build tags, which is good. But there's no simulation of the full Konflux/OSBS container build pipeline at PR time.

## Quick Wins

### 1. Add Trivy Container Scanning (1-2 hours)
Add to Docker publish workflows:
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.IMAGE_NAME }}:${{ env.TAG }}
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'

- name: Upload Trivy scan results
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: 'trivy-results.sarif'
```

### 2. Enforce Python Coverage (2-3 hours)
Add coverage enforcement to `python-test.yml`:
```yaml
- name: Test kserve with coverage enforcement
  run: |
    cd python
    source kserve/.venv/bin/activate
    pytest --cov=kserve --cov-fail-under=70 ./kserve
```

### 3. Generate Agent Rules (2-4 hours)
Run `/test-rules-generator` against this repository to create:
- `.claude/rules/go-unit-tests.md` — envtest patterns, controller testing conventions
- `.claude/rules/python-unit-tests.md` — pytest fixtures, kserve SDK mocking patterns
- `.claude/rules/e2e-tests.md` — KinD/Minikube setup, test markers, async patterns

### 4. Add SBOM Generation (2-3 hours)
Add to Docker publish workflows:
```yaml
- name: Generate SBOM
  uses: anchore/sbom-action@v0
  with:
    image: ${{ env.IMAGE_NAME }}:${{ env.TAG }}
    format: cyclonedx-json
    output-file: sbom.json
```

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (40+ workflows)**:

| Category | Workflows | Trigger |
|----------|-----------|---------|
| Go Tests | `go.yml` | PR (path-filtered), push, merge queue |
| Python Tests | `python-test.yml` | PR (python/** paths), push |
| E2E Tests | `e2e-test.yml` | PR, merge queue |
| LLMISvc E2E | `e2e-test-llmisvc.yaml` | PR (LLMISvc paths) |
| ODH xKS E2E | `e2e-test-odh-xks-kind.yml` | PR (API/controller paths) |
| Quick Install E2E | `e2e-test-quick-install.yaml` | PR (hack/charts/config paths) |
| Docker Publish | 15+ `*-docker-publish.yml` | Push to master/release, tags |
| Precommit | `precommit-check.yml` | PR |
| Security | `scheduled-go-security-scan.yml` | Weekly + PR |
| License | `go-license-check.yml` | PR, push |
| Build Tags | `distro-build-check.yml` | PR (Go paths) |
| Style | `pr-style-check.yml` | PR target |
| Required | `required-checks.yml` | PR, merge queue |

**Strengths**:
- All workflows use concurrency control (`cancel-in-progress: true`)
- GitHub Actions pinned to SHA (verified by pre-commit hook + `pinact`)
- Smart path-based triggering reduces unnecessary CI runs
- Merge queue support on critical workflows
- Required status checks with 3-hour timeout and `/rerun` support

**Weaknesses**:
- No container vulnerability scanning in any workflow
- Prow config is fully commented out (deprecated but file remains)

### Test Coverage

**Go Tests (169 test files, 110K lines)**:
- Test-to-code ratio: 0.44 (169 test files / 382 source files) — solid
- Test line ratio: very strong given 110K lines of test code
- Controllers: 69 test files — excellent coverage
- APIs: 35 test files — strong validation testing
- Webhooks: 10 test files — adequate
- Framework: Go standard `testing` + envtest (controller-runtime)
- Coverage enforcement: 80% minimum via `go-test-coverage` with PR reporting

**Python Tests (233 test files, 43K lines)**:
- Test-to-code ratio: 0.64 (233 test files / 362 source files) — excellent
- Multi-version matrix: Python 3.10, 3.11, 3.12
- Numpy compatibility: Separate numpy 1.x testing suite
- 8 separate test suites: kserve, storage, sklearn, xgb, pmml, lgb, paddle, huggingface
- Framework: pytest with `--cov` flag
- **Gap**: Coverage runs but isn't enforced or reported to PRs

**E2E Tests (52 test files)**:
- 14 categories: predictor, transformer, explainer, graph, custom, batcher, logger, credentials, storagespec, qpext, helm, llmisvc, modelcache
- Infrastructure: KinD (for ODH xKS) + Minikube (for standard)
- Install methods: Both Kustomize and Helm validated
- Multi-Istio versions: 1.27.5 and 1.28.3 matrix for ODH xKS
- LLMISvc-specific: Autoscaling tests with HPA and KEDA variants
- Markers: `cluster_cpu`, `autoscaling_hpa`, `autoscaling_keda`, `auth`
- OpenShift CI: Full script suite for OpenShift-specific E2E testing
- Benchmark configs: TensorFlow and sklearn load testing (manual)

### Code Quality

**Go Linting (golangci-lint v2 — 35+ linters)**:
Exceptionally well-configured. Notable enabled linters:
- `gosec` — security scanning with custom permission thresholds
- `errorlint` — proper error wrapping for Go 1.13+
- `bodyclose` — HTTP response body leak detection
- `contextcheck` — context propagation validation
- `ginkgolinter` — Ginkgo/Gomega test framework standards
- `importas` — enforced import aliases (e.g., `corev1`, `metav1`)
- `forbidigo` — blocks `SetLogger` and `fmt.Print` in tests
- `protogetter` — proto message field access safety
- `spancheck` — OpenTelemetry span correctness
- Formatters: `gofmt`, `gofumpt`, `goimports`
- Exclusions for generated code: `client/`, `openapi/`, `zz_generated.*`

**Python Linting (Ruff)**:
- Ruff with B (bugbear), E, F, W rule sets
- Pre-commit integration with `ruff-format` + `ruff` check
- Exclusions for generated code (protobuf, OpenAPI models)
- Line length: 88 (Black-compatible)

**Pre-commit Hooks**:
- Helm docs generation
- GitHub Actions SHA pinning verification
- Ruff formatting + linting
- Comprehensive `make check` target combining all checks

### Container Images

**Build Quality**:
- Multi-stage builds: deps → builder + license → runtime (3 parallel stages)
- Base images: UBI9 (`go-toolset:1.25` for build, `ubi-minimal` for runtime)
- Build caching: `--mount=type=cache` for Go modules and build cache
- Non-root user: `USER 1000:1000` in all Dockerfiles
- License compliance: `go-licenses` check and save in every Dockerfile
- Minimal runtime: Only binary + license info in final image
- Security: `shadow-utils` installed temporarily then removed

**Gaps**:
- No vulnerability scanning (Trivy, Grype, Snyk)
- No SBOM generation (Syft, CycloneDX)
- No image signing (cosign)
- No startup validation/health check testing
- No multi-architecture builds (amd64 only visible)

### Security

**Strengths**:
- Gosec security scanner on PRs + weekly scheduled scans (SARIF → GitHub Code Scanning)
- Go license compliance checking (CI + Dockerfile)
- GitHub Actions pinned to SHA with automated verification
- Non-root container execution
- `permissions` scoped in workflows (contents: write limited to needed jobs)
- UBI9 base images (Red Hat security updates)

**Gaps**:
- No container image vulnerability scanning
- No dependency scanning (Dependabot/Renovate not configured in repo)
- No secret detection (no gitleaks, no TruffleHog)
- No SBOM/SLSA attestation

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/`, `CLAUDE.md`, or `AGENTS.md`
- **Quality**: N/A
- **Gaps**: Complete absence of AI agent guidance
- **Recommendation**: Generate comprehensive rules with `/test-rules-generator` covering:
  - Go controller unit tests (envtest patterns, reconciler testing)
  - Python SDK unit tests (pytest fixtures, model server mocking)
  - E2E test patterns (KinD setup, async inference, markers)
  - Import conventions (enforced aliases: `corev1`, `metav1`, `ctrl`)
  - Code style (forbidigo rules, error wrapping patterns)

## Recommendations

### Priority 0 (Critical)

1. **Add container vulnerability scanning** — Integrate Trivy into all 15+ Docker publish workflows and E2E image build steps. Upload SARIF to GitHub Code Scanning.
2. **Enforce Python test coverage** — Add `--cov-fail-under=70` to pytest runs and implement PR coverage reporting (similar to Go coverage pipeline).
3. **Add SBOM generation and image signing** — Use Syft/anchore for SBOM and cosign for signing in Docker publish workflows.

### Priority 1 (High Value)

4. **Create agent rules** — Generate `.claude/rules/` for Go, Python, and E2E test patterns to improve AI-assisted development quality.
5. **Add PR-time Konflux simulation** — Build downstream container images with Red Hat build constraints at PR time to catch breakages before merge.
6. **Add secret detection** — Integrate gitleaks as a pre-commit hook and CI check.
7. **Add container startup validation** — After building images in E2E, validate they start and respond to health probes.

### Priority 2 (Nice-to-Have)

8. **Automate performance benchmarks** — Convert manual benchmark configs into automated regression tests with threshold alerts.
9. **Add API contract tests** — Test the kserve Python SDK against the Go controller API boundary.
10. **Add Dependabot/Renovate** — Automate dependency update PRs for Go modules and Python packages.

## Comparison to Gold Standards

| Dimension | kserve | odh-dashboard | notebooks | Gold Standard |
|-----------|--------|---------------|-----------|---------------|
| Unit Test Coverage Enforcement | 80% Go threshold | Jest + coverage gates | N/A | Per-file + per-package thresholds |
| E2E Automation | Automated on PR (KinD/Minikube) | Cypress on PR | Image validation | Multi-cluster + multi-version |
| Container Scanning | None | None | Trivy | Trivy + Grype + SBOM |
| Coverage PR Reporting | Go only (PR comments) | Jest coverage | N/A | Go + Python + E2E |
| Linting | 35+ golangci-lint rules | ESLint + Prettier | Linters | Comprehensive multi-language |
| Agent Rules | None | Comprehensive | None | Full .claude/rules/ coverage |
| Security Scanning | Gosec + license check | CodeQL | Minimal | Gosec + Trivy + gitleaks + SBOM |
| Pre-commit | SHA pinning + Ruff | Husky + lint-staged | Minimal | All checks enforced |
| Build Tag Testing | distro build check | N/A | N/A | Multi-variant builds |
| Multi-Version Testing | Python 3.10-3.12 + numpy compat | Node versions | Python versions | Full matrix |

## File Paths Reference

### CI/CD
- `.github/workflows/go.yml` — Go unit tests + coverage
- `.github/workflows/python-test.yml` — Python multi-version tests
- `.github/workflows/e2e-test.yml` — Main E2E suite (KinD)
- `.github/workflows/e2e-test-llmisvc.yaml` — LLMISvc E2E (Minikube)
- `.github/workflows/e2e-test-odh-xks-kind.yml` — ODH xKS E2E (KinD, multi-Istio)
- `.github/workflows/e2e-test-quick-install.yaml` — Quick install validation
- `.github/workflows/precommit-check.yml` — Pre-commit enforcement
- `.github/workflows/scheduled-go-security-scan.yml` — Gosec security scanner
- `.github/workflows/distro-build-check.yml` — Distro build tag verification
- `.github/workflows/required-checks.yml` — Required status check enforcement

### Code Quality
- `.golangci.yml` — 35+ Go linter rules (v2 config)
- `ruff.toml` — Python linting (B/E/F/W rules)
- `.pre-commit-config.yaml` — Helm docs, SHA pinning, Ruff

### Coverage
- `.github/.testcoverage.yml` — Go coverage threshold (80%)
- `coverage.sh` — Coverage extraction script

### Container Images
- `Dockerfile` — Main controller (multi-stage UBI9)
- `agent.Dockerfile` — Inference agent
- `router.Dockerfile` — Inference router
- `llmisvc-controller.Dockerfile` — LLMISvc controller
- `localmodel.Dockerfile` / `localmodel-agent.Dockerfile` — Local model components

### Testing
- `test/e2e/` — 52 E2E test files across 14 categories
- `test/scripts/kind/` — KinD cluster setup scripts
- `test/scripts/openshift-ci/` — OpenShift CI integration (20+ scripts)
- `test/scripts/gh-actions/` — GitHub Actions helper scripts
- `test/benchmark/` — Performance benchmark configurations
- `python/kserve/test/` — Python SDK unit tests
- `python/huggingfaceserver/tests/` — HuggingFace server tests
