---
repository: "red-hat-data-services/spark-operator"
overall_score: 7.7
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "60 test files for 133 source files (45% ratio); Ginkgo + envtest for controllers, standard go testing elsewhere"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Multi-layer E2E: Helm + Kustomize on KIND across 4-9 K8s versions; OpenShift integration tests; drift detection; Helm chart unit tests"
  - dimension: "Build Integration"
    score: 7.0
    status: "Konflux Dockerfile present; Kustomize lint + drift check on PRs; no PR-time Konflux simulation"
  - dimension: "Image Testing"
    score: 5.0
    status: "Multi-stage Dockerfiles with build caching; no container vulnerability scanning, no SBOM, no runtime validation"
  - dimension: "Coverage Tracking"
    score: 7.0
    status: "Codecov with unit and e2e-kustomize flags; auto threshold + 1% tolerance; no hard minimum gate"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "21 workflows with concurrency control; comprehensive PR checks; multi-K8s version matrix; scorecard supply-chain"
  - dimension: "Agent Rules"
    score: 6.0
    status: "CLAUDE.md exists with project structure, build/test/debug commands; no .claude/rules/ or test-type-specific guidance"
critical_gaps:
  - title: "No container image vulnerability scanning"
    impact: "CVEs in base images or dependencies go undetected until production deployment"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No SBOM generation or image signing"
    impact: "Cannot verify supply chain integrity; fails SLSA Level 2+ requirements"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No PR-time Konflux build simulation"
    impact: "Konflux build failures discovered only post-merge; Dockerfile.konflux has complex ODH dependencies that may diverge from standard Dockerfile"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "No test-type-specific agent rules (.claude/rules/)"
    impact: "AI-generated tests lack consistency with existing patterns; miss envtest setup, Ginkgo conventions, and fixture patterns"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No hard coverage enforcement gate"
    impact: "Coverage can regress without blocking PR merge; current auto threshold with 1% tolerance is too lenient"
    severity: "MEDIUM"
    effort: "1 hour"
quick_wins:
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Catch CVEs in base images and dependencies before merge; blocks HIGH/CRITICAL vulnerabilities"
  - title: "Create .claude/rules/ for unit and e2e test patterns"
    effort: "2-3 hours"
    impact: "Ensure AI-generated tests follow Ginkgo conventions, envtest setup, and existing fixture patterns"
  - title: "Set minimum coverage threshold in codecov.yml"
    effort: "30 minutes"
    impact: "Prevent coverage regression by requiring minimum 50-60% project coverage"
  - title: "Add Cosign image signing to release workflow"
    effort: "2-3 hours"
    impact: "Enable supply chain verification for released images; aligns with SLSA framework"
  - title: "Expand golangci-lint with security linters (gosec, gocritic)"
    effort: "1 hour"
    impact: "Catch additional code quality and security issues at lint time"
recommendations:
  priority_0:
    - "Add Trivy or Grype container vulnerability scanning to the integration.yaml PR workflow"
    - "Generate SBOM (syft/trivy) and sign images (Cosign) in release workflows"
    - "Set a hard minimum coverage threshold (e.g., 50%) in .codecov.yml to prevent regression"
  priority_1:
    - "Add PR-time Konflux build simulation to validate Dockerfile.konflux before merge"
    - "Create .claude/rules/ with unit-tests.md (envtest patterns), e2e-tests.md (Ginkgo/Kind patterns), and integration-tests.md (OpenShift patterns)"
    - "Add image startup validation test (build image, start container, verify health endpoint)"
    - "Expand golangci-lint to include gosec, gocritic, errorlint, and nilerr linters"
  priority_2:
    - "Add multi-architecture image builds (amd64/arm64) to PR validation"
    - "Add performance regression testing for Spark job submission latency"
    - "Add contract tests between the webhook and controller components"
    - "Consolidate OpenShift and upstream E2E test suites under test/ directory"
---

# Quality Analysis: red-hat-data-services/spark-operator

## Executive Summary
- Overall Score: 7.7/10
- Key Strengths: Exceptional E2E testing infrastructure with multi-K8s version matrix across Helm and Kustomize deploy methods; strong CI/CD automation with 21 workflows, concurrency control, and comprehensive PR checks; innovative Helm/Kustomize drift detection test; well-documented CLAUDE.md
- Critical Gaps: No container vulnerability scanning, no SBOM/image signing, no PR-time Konflux simulation, no test-type-specific agent rules
- Agent Rules Status: Partial (CLAUDE.md present, no .claude/rules/)

## Quality Scorecard
| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.0/10 | 60 test files for 133 source files (45% ratio); Ginkgo + envtest for controllers |
| Integration/E2E | 9.0/10 | Multi-layer E2E on 4-9 K8s versions; Helm + Kustomize + OpenShift; drift detection |
| **Build Integration** | **7.0/10** | **Konflux Dockerfile present; Kustomize lint/drift on PRs; no Konflux simulation** |
| Image Testing | 5.0/10 | Multi-stage Dockerfiles with build caching; no vulnerability scanning or SBOM |
| Coverage Tracking | 7.0/10 | Codecov with unit + e2e-kustomize flags; auto threshold, no hard minimum |
| CI/CD Automation | 9.0/10 | 21 workflows, concurrency control, multi-K8s matrix, scorecard supply-chain |
| Agent Rules | 6.0/10 | CLAUDE.md with project structure/commands; no .claude/rules/ for test guidance |

## Critical Gaps

1. **No container image vulnerability scanning**
   - Impact: CVEs in base images (UBI9, go-toolset, Spark) and Go dependencies go undetected until production
   - Severity: HIGH
   - Effort: 2-4 hours
   - Details: Neither the PR workflow (`integration.yaml`) nor the release workflow (`release.yaml`) includes Trivy, Snyk, or Grype scanning. The Konflux Dockerfile uses `registry.access.redhat.com/ubi9/go-toolset` and a custom base image that could contain vulnerabilities.

2. **No SBOM generation or image signing**
   - Impact: Cannot verify supply chain integrity; fails SLSA Level 2+ compliance
   - Severity: HIGH
   - Effort: 4-6 hours
   - Details: Release workflows build and push images to `ghcr.io` and `quay.io` without generating SBOMs or signing with Cosign/Sigstore. The `scorecard.yaml` workflow monitors supply chain security but doesn't enforce artifact provenance.

3. **No PR-time Konflux build simulation**
   - Impact: `Dockerfile.konflux` build failures discovered only post-merge; the Konflux Dockerfile has significantly different build steps (CGO_ENABLED=1, FIPS, PySpark install, podman dependency)
   - Severity: MEDIUM
   - Effort: 8-12 hours
   - Details: The standard `Dockerfile` and `Dockerfile.konflux` diverge significantly: Konflux uses CGO_ENABLED=1, FIPS mode, installs PySpark/Java/podman, and uses different base images. A PR-time Dockerfile.konflux build would catch breakage before merge.

4. **No test-type-specific agent rules (.claude/rules/)**
   - Impact: AI-generated tests may miss envtest setup patterns, Ginkgo BDD conventions, or Kustomize test fixtures
   - Severity: MEDIUM
   - Effort: 2-3 hours
   - Details: The `CLAUDE.md` documents project structure and commands well but doesn't provide test pattern guidance. The repo has distinct test patterns: envtest-based controller tests (Ginkgo), webhook validator tests (standard go testing), E2E tests (Kind + Ginkgo), Kustomize build tests, and drift detection tests.

5. **No hard coverage enforcement gate**
   - Impact: Coverage can regress without blocking merge; `auto` threshold with 1% tolerance allows gradual decline
   - Severity: MEDIUM
   - Effort: 1 hour

## Quick Wins

1. **Add Trivy container scanning to PR workflow**
   - Effort: 1-2 hours
   - Impact: Catch CVEs in base images and dependencies before merge
   - Implementation:
   ```yaml
   # Add to integration.yaml
   container-scan:
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v4
       - name: Build image
         run: docker build -t spark-operator:scan .
       - name: Run Trivy
         uses: aquasecurity/trivy-action@master
         with:
           image-ref: 'spark-operator:scan'
           severity: 'CRITICAL,HIGH'
           exit-code: '1'
   ```

2. **Create .claude/rules/ for test patterns**
   - Effort: 2-3 hours
   - Impact: Consistent AI-generated tests following existing repo conventions
   - Implementation: Create rules for unit tests (envtest + Ginkgo pattern), webhook tests (standard go testing with fake client), E2E tests (Kind + Helm/Kustomize install), and Kustomize build tests

3. **Set minimum coverage threshold**
   - Effort: 30 minutes
   - Impact: Prevent coverage regression below acceptable levels
   - Implementation: Change `.codecov.yml` from `target: auto` to `target: 50%` for project coverage

4. **Add Cosign image signing to release workflow**
   - Effort: 2-3 hours
   - Impact: Supply chain verification for released images
   - Implementation: Add `cosign sign` step after image push in `release.yaml`

5. **Expand golangci-lint with security linters**
   - Effort: 1 hour
   - Impact: Catch security issues (gosec) and additional code quality problems (gocritic, errorlint)
   - Implementation: Add `gosec`, `gocritic`, `errorlint`, and `nilerr` to `.golangci.yaml` linters.enable

## Detailed Findings

### CI/CD Pipeline (Score: 9.0/10)

**Strengths:**
- **21 GitHub Actions workflows** covering the full development lifecycle
- **PR-triggered workflows**: `integration.yaml` (code-check, unit-test, helm-test, e2e), `kustomize-e2e.yaml`, `kustomize-lint.yaml`, `kustomize-drift-check.yaml`, `codecov.yaml`, `check-release.yaml`
- **Concurrency control**: All PR workflows use `cancel-in-progress: true` with actor-scoped groups
- **Multi-K8s version matrix**: E2E tests run on v1.32-v1.35 (Helm) and v1.24-v1.32 (Kustomize)
- **Dual deploy method testing**: Both Helm and Kustomize installation paths validated in E2E
- **Supply chain security**: OpenSSF Scorecard workflow with SARIF upload to code scanning
- **Dependency management**: Both Dependabot (weekly) and Renovate configured
- **Release automation**: Comprehensive release pipeline with Helm chart releases, image publishing

**Gaps:**
- No container scanning step in any workflow
- Codecov uses unpinned `actions/checkout@v5.0.0` (should pin to SHA)
- No smoke test after release image push

### Test Coverage (Score: 8.0/10 Unit, 9.0/10 E2E)

**Unit Tests (8.0/10):**
- 60 test files for 133 source files (45% test-to-code ratio - strong)
- **Controller tests**: Ginkgo BDD framework with envtest for real API server interaction
- **Webhook tests**: Standard Go testing with fake client - validator and defaulter coverage
- **Utility tests**: Comprehensive coverage of `pkg/util/` (sparkapplication, sparkpod, predicates, namespace)
- **Certificate tests**: Ginkgo suite for certificate management
- **Scheduler tests**: Coverage for KubeScheduler, Volcano, and Yunikorn schedulers
- **Module tests**: spark-operator-module has its own test suite
- Coverage output: `cover.out` with HTML report generation (`cover.html`)

**Integration/E2E Tests (9.0/10):**
- **Helm E2E** (`test/e2e/`): Ginkgo suite testing SparkApplication, SparkConnect, ScheduledSparkApplication, namespace filtering on real Kind clusters
- **Kustomize E2E** (`examples/openshift/tests/e2e/`): Extended suite with Spark UI test, Prometheus metrics test, SparkConnect query test
- **Shell-based integration** (`examples/openshift/tests/`): `test-operator-install.sh`, `test-spark-pi.sh`, `test-docling-spark.sh`, `test-scheduledspark-smoke.sh`
- **Helm chart unit tests**: 20 test files covering controller, webhook, spark, hook, certmanager, and prometheus templates
- **Kustomize build tests** (`test/kustomize/`): Validates overlay builds and manifest structure
- **Drift detection test** (`test/drift/`): Compares Helm-rendered and Kustomize-rendered resources for semantic equivalence (RBAC, webhooks, deployments)
- **Multi-version testing**: 4 K8s versions for Helm, 9 for Kustomize E2E

**Coverage Tracking (7.0/10):**
- Codecov integration with separate flags: `unit` and `e2e-kustomize`
- Auto threshold with 1% tolerance per-project and per-patch
- E2E coverage uploaded only on push to main (not on PR)
- Comment layout includes reach, diff, flags, files
- Missing: Hard minimum threshold, coverage trend tracking, branch coverage

### Code Quality (Score: 7.0/10)

**Linting:**
- golangci-lint v2 with 7 linters enabled: `copyloopvar`, `dupword`, `importas`, `predeclared`, `tagalign`, `unconvert`, `unused`
- `goimports` formatter enabled
- Import alias enforcement for K8s packages
- go fmt and go vet enforced as PR checks
- Code generation verification on PRs (go mod tidy, make generate, verify-codegen)

**Pre-commit Hooks:**
- `.pre-commit-config.yaml` present but limited to `helm-docs` only
- No Go formatting, linting, or secret detection hooks

**Static Analysis:**
- **Semgrep**: Comprehensive 63KB rule file covering Go, Python, TypeScript, YAML, and generic patterns
  - Secrets detection (hardcoded credentials, AWS keys)
  - Go-specific: unsafe exec, SQL injection, path traversal, SSRF, TLS config
  - Kubernetes-specific: privileged containers, host namespace access, resource limits
  - GitHub Actions: script injection detection
- **Gitleaks**: Configured with allowlists for test files, fixtures, and known test credentials
- **OpenSSF Scorecard**: Weekly supply chain security assessment

**Gaps:**
- golangci-lint missing security linters (`gosec`, `staticcheck/SA` checks)
- golangci-lint missing error-handling linters (`errorlint`, `nilerr`, `wrapcheck`)
- Pre-commit hooks don't cover Go code quality
- No CodeQL workflow (only Scorecard SARIF upload)

### Container Images (Score: 5.0/10)

**Build Process:**
- **Standard Dockerfile**: Multi-stage (golang:1.24.10 builder → Spark base image), Docker build cache (`--mount=type=cache`), TARGETARCH support
- **Dockerfile.konflux**: Multi-stage with UBI9 go-toolset, CGO_ENABLED=1, FIPS runtime, PySpark installation, Java 17, podman for catatonit
- **Additional Dockerfiles**: `spark-docker/Dockerfile`, `docker/Dockerfile.kubectl`, `examples/openshift/Dockerfile`, `examples/openshift/Dockerfile.odh`, `examples/openshift/tests/Dockerfile`
- `.dockerignore` present

**Gaps:**
- No container vulnerability scanning in any workflow
- No SBOM generation (syft, trivy, cyclonedx)
- No image signing (cosign, sigstore)
- No runtime validation (startup test, health check verification)
- No multi-architecture builds in CI (only TARGETARCH support in Dockerfile)
- `Dockerfile` and `Dockerfile.konflux` have significant divergence (different base images, build flags, runtime dependencies) - drift risk

### Security (Score: 6.0/10)

**Strengths:**
- Gitleaks configured with comprehensive allowlists for test files
- Semgrep with 60+ security rules covering multiple languages
- OpenSSF Scorecard for supply chain security monitoring
- Dependabot + Renovate for dependency updates (weekly)
- Action SHAs pinned in most workflows (good supply chain practice)
- Read-only permissions default in workflows

**Gaps:**
- No container image scanning (no Trivy/Snyk/Grype)
- No DAST or runtime security testing
- No dependency vulnerability alerts workflow (relies on GitHub native alerts only)
- No secret scanning in CI (Gitleaks config exists but no workflow runs it)
- Semgrep rules exist but no CI workflow to run them

### Agent Rules (Score: 6.0/10)

**Present:**
- `CLAUDE.md` in repository root - comprehensive and well-structured
  - Tech stack documentation (Go 1.24, controller-runtime, Ginkgo)
  - Project structure with directory descriptions
  - Detailed Kustomize configuration documentation
  - Build, test, lint commands with explanations
  - Two test workflows documented (Helm vs Kustomize)
  - Debugging guidance (structured logging, metrics, kubectl commands)
  - Key files reference for each CRD type

**Missing:**
- No `.claude/` directory
- No `.claude/rules/` for test-type-specific guidance
- No `.claude/skills/` for custom automation
- No test pattern examples or templates
- No webhook testing patterns documentation
- No envtest setup guidance for new controller tests

## Recommendations

### Priority 0 (Critical)
- Add Trivy or Grype container vulnerability scanning to `integration.yaml` to catch CVEs in base images before merge
- Generate SBOM (syft) and sign images (Cosign) in `release.yaml` and `release-latest-images.yaml` for supply chain integrity
- Set hard minimum coverage threshold (50-60%) in `.codecov.yml` to prevent regression

### Priority 1 (High Value)
- Add a PR-time `Dockerfile.konflux` build step to catch Konflux-specific build failures before merge
- Create `.claude/rules/` with test guidance: `unit-tests.md` (envtest + Ginkgo patterns), `e2e-tests.md` (Kind + Ginkgo), `webhook-tests.md` (standard go testing + fake client), `kustomize-tests.md` (build/overlay validation)
- Add image startup validation test (build → start → check health) for both standard and Konflux Dockerfiles
- Expand golangci-lint to include `gosec`, `gocritic`, `errorlint`, `nilerr` for stronger code quality gates
- Add a CI workflow to actually run Semgrep rules (config exists but no workflow executes them)

### Priority 2 (Nice-to-Have)
- Add multi-architecture image builds (amd64/arm64) to CI validation
- Add performance regression testing for Spark job submission latency
- Add contract tests between webhook and controller components
- Consolidate OpenShift E2E tests under `test/` directory (per team's noted plan in CLAUDE.md)
- Add pre-commit hooks for Go formatting, vetting, and secret detection beyond just helm-docs
- Consider adding Gitleaks as a PR-time workflow step (config exists, workflow does not)

## Comparison to Gold Standards

| Dimension | spark-operator | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|-----------|---------------|---------------------|-----------------|--------------|
| Unit Tests | 8.0 - Ginkgo + envtest | 9.0 - Jest + RTL, 80%+ | 7.0 - Python pytest | 9.0 - Go + envtest, 80%+ |
| Integration/E2E | 9.0 - Multi-K8s, dual deploy | 9.0 - Cypress + contract | 8.0 - Multi-image validation | 9.0 - Multi-version K8s |
| Build Integration | 7.0 - Kustomize lint/drift | 8.0 - Module Federation | 7.0 - Image build validation | 7.0 - Kustomize validation |
| Image Testing | 5.0 - No scanning | 7.0 - Runtime validation | 9.0 - 5-layer validation | 7.0 - Trivy scanning |
| Coverage | 7.0 - Codecov, no min gate | 9.0 - 80% enforced | 6.0 - Basic coverage | 9.0 - Codecov enforced |
| CI/CD | 9.0 - 21 workflows, matrix | 9.0 - Comprehensive | 8.0 - Multi-image CI | 9.0 - Prow + GH Actions |
| Agent Rules | 6.0 - CLAUDE.md only | 8.0 - Rules + skills | 4.0 - Minimal | 5.0 - Basic docs |
| Security | 6.0 - Gitleaks, Semgrep (no CI), Scorecard | 7.0 - Snyk, CodeQL | 8.0 - Trivy, SBOM | 8.0 - Trivy, Cosign |

**Notable Innovations in spark-operator:**
- **Helm/Kustomize drift detection test** - Unique approach that programmatically compares rendered resources between two install methods to prevent semantic divergence. Not seen in other analyzed repos.
- **Dual deploy method E2E** - Same Ginkgo test suite runs against both Helm and Kustomize installations, ensuring feature parity.
- **Multi-layer Kustomize validation** - Lint (no cluster), E2E (Kind), drift check (programmatic comparison) - three validation tiers for Kustomize manifests.

## File Paths Reference

### CI/CD
- `.github/workflows/integration.yaml` - Main PR workflow (code-check, unit-test, helm-test, e2e)
- `.github/workflows/codecov.yaml` - Coverage upload
- `.github/workflows/kustomize-e2e.yaml` - Kustomize E2E on 9 K8s versions
- `.github/workflows/kustomize-lint.yaml` - Kustomize build validation
- `.github/workflows/kustomize-drift-check.yaml` - Helm/Kustomize drift detection
- `.github/workflows/scorecard.yaml` - OpenSSF supply chain security
- `.github/workflows/release.yaml` - Release pipeline
- `.github/workflows/integration-odh.yaml` - ODH integration tests

### Testing
- `test/e2e/` - Ginkgo E2E test suite (4 test files)
- `test/kustomize/` - Kustomize build validation tests (2 test files)
- `test/drift/` - Helm/Kustomize drift detection test
- `internal/controller/sparkapplication/` - Controller unit tests (envtest)
- `internal/webhook/` - Webhook validator/defaulter tests
- `examples/openshift/tests/` - OpenShift integration tests (shell + Go)
- `examples/openshift/tests/e2e/` - OpenShift Ginkgo E2E suite
- `charts/spark-operator-chart/tests/` - Helm chart unit tests (20 files)

### Code Quality
- `.golangci.yaml` - Linter configuration (7 linters)
- `.pre-commit-config.yaml` - Pre-commit hooks (helm-docs only)
- `semgrep.yaml` - SAST rules (60+ rules, multi-language)
- `.gitleaks.toml` - Secret detection configuration

### Container Images
- `Dockerfile` - Standard multi-stage build
- `Dockerfile.konflux` - Konflux/ODH build with FIPS, PySpark, UBI9
- `spark-docker/Dockerfile` - Spark base image
- `.dockerignore` - Build context exclusions

### Coverage & Security
- `.codecov.yml` - Coverage configuration (unit + e2e-kustomize flags)
- `.gitleaks.toml` - Gitleaks allowlist configuration
- `.gitleaksignore` - Gitleaks false positive suppression
- `.github/dependabot.yml` - Dependency update automation
- `.github/renovate.json` - Renovate bot configuration

### Agent Rules
- `CLAUDE.md` - Project documentation for AI agents (well-structured)
