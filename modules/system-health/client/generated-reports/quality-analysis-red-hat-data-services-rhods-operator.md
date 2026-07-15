---
repository: "red-hat-data-services/rhods-operator"
overall_score: 8.2
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "210 unit test files across 105 packages; Ginkgo/Gomega framework; envtest for controller tests; Codecov integration"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "51 E2E test files covering 16+ components; KinD-based E2E with label-gated trigger; dedicated gateway integration tests with envtest; cloud manager E2E with multi-provider matrix"
  - dimension: "Build Integration"
    score: 7.5
    status: "PR-time operator + bundle + catalog image builds; Konflux multi-arch pipeline (x86_64, ppc64le, s390x, arm64); no PR-time Konflux simulation but Tekton pipelines defined"
  - dimension: "Image Testing"
    score: 6.5
    status: "9 Dockerfiles including Konflux variant; multi-arch builds via Tekton; SBOM generation via Syft; no image startup validation or runtime testing in CI"
  - dimension: "Coverage Tracking"
    score: 6.0
    status: "Codecov integration present but set to informational-only (no enforcement); gateway integration tests generate coverage profiles; no coverage thresholds or PR blocking"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "32 GitHub Actions workflows; comprehensive PR checks (lint, unit, E2E, kube-lint, generated files, related images); Tekton/Konflux for production builds; nightly operator builds; automated branch syncing"
  - dimension: "Agent Rules"
    score: 8.5
    status: "AGENTS.md with build/test/quality gates; CLAUDE.md; .claude/ directory with rules (symlinked .rules/), skills (diagnose), MCP server; 5 detailed controller pattern rules; AI reviewer meta-guidance"
critical_gaps:
  - title: "Coverage enforcement is informational-only"
    impact: "Coverage can silently regress without blocking PRs; no minimum thresholds enforced"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container image runtime validation"
    impact: "Image startup failures not caught until deployment; images built on PR but not validated"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "E2E tests require manual label trigger"
    impact: "E2E tests only run when maintainer adds 'run-xks-e2e' or 'run-integration-tests' label; easy to skip on PRs"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "No SAST/CodeQL in GitHub Actions"
    impact: "Semgrep rules exist (1873 lines) but no CI workflow runs them; security analysis depends on external tooling"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Enforce Codecov coverage thresholds"
    effort: "1-2 hours"
    impact: "Prevent coverage regression by setting project/patch thresholds in codecov.yml"
  - title: "Add Semgrep CI workflow"
    effort: "1-2 hours"
    impact: "Activate the existing 1873-line semgrep.yaml ruleset on PRs for automated SAST scanning"
  - title: "Add container startup smoke test to PR build"
    effort: "2-3 hours"
    impact: "Validate built operator image starts and responds to health probes before merge"
  - title: "Add agent rules for test patterns"
    effort: "2-3 hours"
    impact: "Guide AI agents on unit/E2E test creation patterns specific to this operator's Ginkgo framework"
recommendations:
  priority_0:
    - "Enforce Codecov coverage thresholds — switch from informational to blocking with project target ≥ current baseline and patch target ≥ 70%"
    - "Add Semgrep CI workflow to run the existing 1873-line security ruleset on every PR"
  priority_1:
    - "Add container image startup validation — smoke test the built operator image (health endpoint, basic CRD handling) in the PR build workflow"
    - "Create agent rules for test creation patterns (unit-tests.md, e2e-tests.md) under .claude/rules/"
    - "Consider making a lightweight E2E suite that runs automatically on PRs (without label gating) for core reconciliation paths"
  priority_2:
    - "Add Trivy or similar container vulnerability scanning to PR workflow"
    - "Add integration test coverage reporting to Codecov alongside unit tests"
    - "Consider adding contract tests for cross-component API boundaries"
---

# Quality Analysis: rhods-operator (opendatahub-operator)

## Executive Summary

- **Overall Score: 8.2/10**
- **Repository Type**: Go Kubernetes Operator (OpenShift AI / Open Data Hub)
- **Primary Language**: Go 1.26
- **Framework**: Kubebuilder + Operator SDK + custom reconciler builder pattern
- **Components Managed**: 16+ AI/ML platform components (KServe, Dashboard, Ray, etc.)

### Key Strengths
- **Exceptional CI/CD automation** — 32 GitHub Actions workflows covering linting, unit tests, E2E tests, image builds, release automation, and branch synchronization
- **Comprehensive test suite** — 258 test files (210 unit + 51 E2E), 0.60 test-to-code ratio, testing across 105 packages
- **Strong security tooling** — Gitleaks for secret detection, 1873-line Semgrep ruleset, kube-linter with severity-based blocking (CRITICAL/HIGH block PRs), SARIF integration
- **Mature agent rules** — AGENTS.md, .claude/ directory with symlinked rules, skills, MCP server, and AI reviewer meta-guidance
- **Multi-architecture support** — Konflux pipeline builds for x86_64, ppc64le, s390x, arm64

### Critical Gaps
- Coverage enforcement is **informational-only** — no thresholds block PRs
- Semgrep rules exist but **no CI workflow runs them**
- E2E tests require **manual label gating** — easy to skip
- No **container runtime validation** on built images

### Agent Rules Status: Strong (8.5/10)
The repository has comprehensive agent guidance with AGENTS.md, CLAUDE.md, `.claude/rules/` (5 controller pattern rules), `.claude/skills/diagnose`, `.mcp.json` (opendatahub-health MCP server), and AI code reviewer meta-guidance in `.rules/`. Missing: explicit test creation pattern rules.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | 210 test files, 105 packages, Ginkgo/Gomega, envtest, Codecov |
| Integration/E2E | 8.0/10 | 51 E2E files, KinD-based, label-gated, multi-provider matrix |
| **Build Integration** | **7.5/10** | **PR image builds, Konflux multi-arch, Tekton pipelines defined** |
| Image Testing | 6.5/10 | 9 Dockerfiles, multi-arch, SBOM, no runtime validation |
| Coverage Tracking | 6.0/10 | Codecov present but informational-only, no enforcement |
| CI/CD Automation | 9.0/10 | 32 workflows, comprehensive PR checks, nightly builds |
| Agent Rules | 8.5/10 | AGENTS.md, .claude/ with rules/skills/MCP, reviewer guidance |

## Critical Gaps

### 1. Coverage Enforcement is Informational-Only
- **Impact**: Coverage can silently regress without any PR gates
- **Severity**: HIGH
- **Evidence**: `codecov.yml` sets both `project` and `patch` to `informational: true`
- **Effort**: 2-4 hours
- **Fix**: Set `target` thresholds in `codecov.yml`:
  ```yaml
  coverage:
    status:
      project:
        default:
          target: 45%  # Set to current baseline
          threshold: 2%
      patch:
        default:
          target: 70%
  ```

### 2. No Container Image Runtime Validation
- **Impact**: Images are built on PRs but never validated for startup, health probes, or basic functionality
- **Severity**: MEDIUM
- **Evidence**: `ci-build-push-images-on-pr.yaml` builds operator + bundle + catalog images but doesn't test them
- **Effort**: 4-6 hours

### 3. E2E Tests Require Manual Label Trigger
- **Impact**: E2E tests only run when a maintainer adds `run-xks-e2e` or `run-integration-tests` labels
- **Severity**: MEDIUM
- **Evidence**: `test-kind-odh-e2e.yaml` and `test-integration.yaml` both require label gating (`pull_request_target` + label check)
- **Effort**: 4-8 hours (create a lightweight always-on E2E subset)

### 4. Semgrep Rules Exist but Not Run in CI
- **Impact**: 1873-line security ruleset covering Go, Python, TypeScript, YAML, and generic secret detection is unused in automated CI
- **Severity**: MEDIUM
- **Evidence**: `semgrep.yaml` exists at repo root but no `.github/workflows/` references it
- **Effort**: 2-3 hours

## Quick Wins

### 1. Enforce Codecov Thresholds (1-2 hours)
Update `codecov.yml` to set blocking thresholds instead of `informational: true`. Prevents coverage regression without changing any test code.

### 2. Add Semgrep CI Workflow (1-2 hours)
Create `.github/workflows/semgrep.yaml` that runs `semgrep --config semgrep.yaml` on PRs. The ruleset already exists and is comprehensive.

### 3. Container Startup Smoke Test (2-3 hours)
Add a step to `ci-build-push-images-on-pr.yaml` that validates the built operator image starts successfully and responds to health probes.

### 4. Test Pattern Agent Rules (2-3 hours)
Add `.rules/unit-tests.md` and `.rules/e2e-tests.md` to guide AI agents on Ginkgo test patterns, envtest setup, and E2E test conventions.

## Detailed Findings

### CI/CD Pipeline (9.0/10)

**Strengths:**
- **32 GitHub Actions workflows** — one of the most comprehensive CI setups observed
- **PR-triggered checks**: Unit tests, CLI tests, Prometheus unit tests, linting (golangci-lint + kube-linter), generated file validation, RELATED_IMAGE validation, E2E requirement checks, gateway integration tests
- **Kube-linter with severity blocking**: CRITICAL/HIGH findings block PRs; MEDIUM/LOW are reported in SARIF to GitHub Security tab
- **Tekton/Konflux integration**: Multi-arch builds (x86_64, ppc64le, s390x, arm64) with hermetic builds and prefetch
- **Release automation**: Community releases, staging releases, FBC fragment releases
- **Branch sync workflows**: Automated main→stable and stable→rhoai synchronization
- **Nightly operator builds**: Scheduled trigger for nightly image builds
- **Concurrency control**: Konflux pipelines use `cancel-in-progress: true`

**Gaps:**
- No Semgrep workflow (ruleset exists but isn't exercised)
- E2E tests require manual label triggers (appropriate for expensive tests, but core paths could auto-run)
- No CodeQL/SAST workflow in GitHub Actions

**Workflow Inventory (32 workflows):**
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| test-unit.yaml | PR + push | Unit tests with Codecov |
| test-unit-cli.yaml | PR + push | CLI tool unit tests |
| test-prometheus-unit.yaml | PR | Prometheus alerting rule tests |
| test-linter.yaml | PR + push | golangci-lint + kube-linter with SARIF |
| test-kind-odh-e2e.yaml | PR (label-gated) | KinD-based E2E tests |
| test-cloudmanager-e2e.yaml | PR (label-gated) | Cloud manager E2E (azure, coreweave, aws) |
| test-gateway-integration.yaml | PR (label/path) | Gateway integration tests with envtest |
| test-integration.yaml | PR (label-gated) | Full integration tests with catalog build |
| test-e2e-requirement-check.yaml | PR | Enforces E2E test updates when code changes |
| test-required-files-updated.yaml | PR | Validates generated files are up-to-date |
| validate-related-images.yaml | PR + push | Validates RELATED_IMAGE references |
| ci-build-push-images-on-pr.yaml | PR | Builds operator + bundle + catalog images |
| ci-build-push-e2e-tests-on-pr.yaml | PR | Builds E2E test images |
| ci-build-push-catalog-latest.yaml | push | Builds latest catalog image |
| ci-build-push-e2e-tests.yaml | push | Builds E2E test images on push |
| ci-build-push-e2e-tests-image.yaml | dispatch | E2E test image build |
| trigger-nightly-operator-build.yaml | schedule | Nightly operator builds |
| operator-processor.yaml | various | Operator processing automation |
| operator-insta-merge.yaml | various | Automated merge workflow |
| release-community.yaml | dispatch | Community release process |
| release-staging.yaml | dispatch | Staging release process |
| release-process-fbc-fragment.yaml | dispatch | FBC fragment release |
| sync-main-to-stable.yaml | push | Syncs main→stable branch |
| sync-stable-to-rhoai.yaml | push | Syncs stable→rhoai branch |
| bundle-sync.yml | dispatch | Bundle synchronization |
| update-manifest-shas.yml | dispatch | Manifest SHA updates |
| update-rhoai-branch.yml | dispatch | RHOAI branch updates |
| get-merge-commit.yaml | reusable | Helper: get merge commit SHA |
| pr-comment.yaml | various | PR comment automation |
| pr-comment-on-e2e-check.yaml | various | E2E check result comments |
| pr-comment-test-trigger.yaml | comment | Test trigger via PR comments |

### Test Coverage (8.5/10 Unit, 8.0/10 E2E)

**Unit Tests (210 files, 105 packages):**
- **Framework**: Ginkgo v2 + Gomega matchers
- **Controller testing**: Uses envtest (Kubernetes API server simulator) for controller tests
- **Coverage**: Tests spread across all major packages:
  - `pkg/` (cluster, upgrade, controller actions/preconditions/provision)
  - `internal/controller/` (all component and service controllers)
  - `api/` (type validation tests)
  - `cmd/` (main, TLS, MCP server, test-retry CLI)
  - `internal/webhook/` (admission webhook tests)
- **Test-to-code ratio**: 0.60 (258 test files / 428 source files) — strong
- **Prometheus alerting tests**: Dedicated Promtool-based validation of alerting rules
- **Top tested packages**: MCP server (10), upgrade (9), cluster (8), gateway (8), deploy actions (7)

**E2E Tests (51 files):**
- **Infrastructure**: KinD clusters with label-gated triggers
- **Component coverage**: Tests for all 16+ managed components (KServe, Dashboard, Ray, Kueue, ModelRegistry, TrustyAI, etc.)
- **Cloud Manager E2E**: Multi-provider matrix (Azure, CoreWeave, AWS) with AKS integration
- **Gateway E2E**: TLS, redirect, and integration tests
- **Resilience testing**: Dedicated `resilience_test.go`
- **Upgrade testing**: `v2tov3upgrade_test.go`
- **Debug utilities**: `debug_utils_test.go` for test infrastructure
- **Resource management**: Tests for resource fetching, applying, and options
- **E2E requirement enforcement**: `test-e2e-requirement-check.yaml` workflow checks that PRs modifying core code include E2E test updates

**Integration Tests:**
- **Gateway integration**: Runs with envtest, generates coverage profiles, auto-triggered by path changes or label
- **OLM integration**: Full catalog build + OLM install testing (label-gated)

### Code Quality (8.5/10)

**Linting (golangci-lint):**
- **Version**: v2 config format
- **Strategy**: `default: all` with selective disables (22 linters disabled)
- **Notable enabled linters**: errcheck (with type assertions), exhaustive, goconst, gocyclo (max 30), importas (enforced import aliases), ireturn, lll (180 chars), nolintlint (require-specific), perfsprint, revive
- **Import formatting**: gci + gofmt + goimports with custom section ordering
- **Test exclusions**: Duplicate code allowed in tests, contained context allowed in test utilities

**Kube-linter:**
- **Comprehensive config** in `.kube-linter.yaml` with 35+ checks across categories:
  - Container security (privileged, host network/PID/IPC, proc mount, sysctls)
  - RBAC/access control (CIS Kubernetes Benchmark checks)
  - Secret management (env vars, mounted secrets)
  - Service account security
  - Network security (privileged ports, SSH, exposed services)
  - Resource management (CPU/memory requirements, probes)
- **Severity-based PR blocking**: CRITICAL/HIGH block; MEDIUM/LOW report-only
- **SARIF integration**: Results uploaded to GitHub Security tab
- **Intelligent filtering**: Operator infrastructure RBAC exempted from certain checks using (Kind, Name, Namespace) tuple matching

**Pre-commit Hooks:**
- trailing-whitespace, end-of-file-fixer, check-yaml, check-merge-conflict
- go fmt, go vet, golangci-lint
- Unit tests on pre-push

**YAML Linting:**
- `.yamllint` config with strict truthy checking (K8s-style booleans only)
- Empty value detection, key duplicate detection
- Targeted ignores (test data, vendor, workflows)

### Container Images (6.5/10)

**Build Process:**
- **9 Dockerfiles**: Main operator, Konflux variant, RHOAI variant, bundle, RHOAI bundle, build-bundle, catalog, e2e-tests, toolbox
- **Multi-stage builds**: Manifest fetching → Go compilation → minimal runtime
- **Base images**: UBI9 Go toolset, UBI9 minimal, OPM
- **Multi-architecture**: Konflux pipeline builds for x86_64, ppc64le, s390x, arm64
- **Platform variants**: ODH and RHOAI build modes with platform-specific manifests
- **Go module caching**: Separate `go mod download` layer for build caching

**Security:**
- **SBOM generation**: `.syft.yaml` config present (excludes component-codegen subproject)
- **No Trivy/Snyk scanning** in CI workflows
- **No image signing/attestation** visible

**Gaps:**
- No image startup validation (smoke tests)
- No runtime testing (Testcontainers or similar)
- No vulnerability scanning in CI

### Security Practices (7.5/10)

**Strengths:**
- **Gitleaks**: Comprehensive `.gitleaks.toml` config with smart allowlists (test files, fixtures, mock data, CI resources, known test credentials)
- **Semgrep**: 1873-line ruleset covering Go, Python, TypeScript, YAML, and generic secrets (CWE-798, injection, RBAC, pod security, etc.)
- **Kube-linter**: Security-focused manifest validation with CIS Kubernetes Benchmark checks
- **SARIF integration**: Kube-linter results uploaded to GitHub Security tab
- **Commit SHA pinning**: All GitHub Actions use pinned SHA versions (supply chain security)
- **Secret-safe CI**: Uses `RUNNER_TEMP` for sensitive files, cleans up after use

**Gaps:**
- Semgrep ruleset not exercised in any CI workflow
- No CodeQL/SAST workflow in GitHub Actions
- No Trivy/Snyk container scanning
- No dependency scanning (Dependabot/Renovate not visible in repo)

### Agent Rules (8.5/10)

**What's Present:**
- **AGENTS.md** (root): Comprehensive operator overview, build/test commands, quality gates, conventions, critical rules, file location patterns, cluster diagnostics guidance
- **CLAUDE.md** (root): Minimal pointer to AGENTS.md
- **.claude/rules/**: Symlinked to `.rules/` directory containing 5 detailed rules:
  1. `api-type-conventions.md` — API type patterns, spec conventions
  2. `cloudmanager-controller.md` — Cloud manager controller patterns with provider-specific guidance
  3. `component-controller.md` — Component controller patterns with reconciler builder
  4. `service-controller.md` — Service controller patterns
  5. AI reviewer meta-guidance — Anti-patterns to avoid flagging, must-always-flag items
- **.claude/skills/diagnose/**: Cluster diagnostics skill with MCP server integration
- **.mcp.json**: MCP server config for `opendatahub-health` diagnostic tools

**Gaps:**
- No explicit test creation rules (unit-tests.md, e2e-tests.md)
- No test pattern examples showing Ginkgo/Gomega conventions
- Controller rules focus on production code patterns, not test patterns

### Build Integration (7.5/10)

**PR Build Validation:**
- `ci-build-push-images-on-pr.yaml`: Builds operator, bundle, and catalog images on every PR
- Uses `pull_request_target` for fork PR support with proper merge commit validation
- Images pushed to Quay.io with PR-specific tags
- Separate build for E2E test images

**Konflux/Tekton Integration:**
- `.tekton/odh-operator-pull-request.yaml`: Multi-arch pipeline (x86_64, ppc64le, s390x, arm64)
- Hermetic builds with gomod/rpm prefetch
- Label-gated triggers (`kfbuild-all`, `kfbuild-rhods-operator`) or PR comment (`/build-konflux`)
- Image TTL: 5 days for PR images

**Manifest Validation:**
- `test-required-files-updated.yaml`: Ensures `make generate manifests-all api-docs` output is committed
- `validate-related-images.yaml`: Validates RELATED_IMAGE references against build configs
- Kustomize build + kube-lint validation of rendered manifests

**Gaps:**
- No PR-time Konflux simulation (Tekton pipelines are label-gated, not automatic)
- Built images aren't validated for startup/health before merge

## Recommendations

### Priority 0 (Critical)
1. **Enforce Codecov coverage thresholds** — Change from `informational: true` to blocking thresholds. Set project target to current baseline and patch target to ≥ 70%.
2. **Activate Semgrep in CI** — Create a GitHub Actions workflow that runs `semgrep --config semgrep.yaml` on PRs. The comprehensive 1873-line ruleset already exists.

### Priority 1 (High Value)
3. **Add container image runtime validation** — Add a smoke test step to the PR image build workflow that validates the operator image starts and responds to health probes.
4. **Create test pattern agent rules** — Add `.rules/unit-tests.md` and `.rules/e2e-tests.md` with Ginkgo/Gomega patterns, envtest setup, E2E conventions, and test structure templates.
5. **Consider lightweight auto-triggered E2E** — Create a minimal E2E subset that tests core reconciliation paths (DSC/DSCI creation, basic component deployment) without label gating, to catch critical regressions automatically.

### Priority 2 (Nice-to-Have)
6. **Add Trivy container scanning** — Scan built images for CVEs in the PR workflow.
7. **Add integration test coverage to Codecov** — The gateway integration tests already generate `coverage.out`; upload this alongside unit test coverage.
8. **Add contract tests** — Test API boundaries between operator components and managed services.
9. **Add Dependabot/Renovate** — Automate Go dependency updates and security patches.

## Comparison to Gold Standards

| Dimension | rhods-operator | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit Tests | 8.5 — 210 files, Ginkgo/envtest | 9.0 — Multi-layer, Jest | 7.0 — Python pytest | 9.0 — Comprehensive |
| Integration/E2E | 8.0 — 51 E2E files, KinD | 9.0 — Cypress, contract | 8.0 — Multi-env | 9.0 — Multi-version |
| Build Integration | 7.5 — PR builds, Konflux | 8.0 — Module Federation | 7.0 — Image pipeline | 7.5 — Build matrix |
| Image Testing | 6.5 — Multi-arch, SBOM | 7.0 — Container build | 9.0 — 5-layer validation | 7.0 — Image builds |
| Coverage | 6.0 — Informational only | 8.0 — Enforced thresholds | 6.0 — Basic | 9.0 — Enforcement |
| CI/CD | 9.0 — 32 workflows | 9.0 — Comprehensive | 8.0 — Image-focused | 8.5 — Multi-version |
| Agent Rules | 8.5 — Rules, skills, MCP | 9.0 — Full test rules | 3.0 — Basic | 5.0 — Minimal |
| **Overall** | **8.2** | **8.7** | **7.0** | **8.0** |

**Key Differentiators:**
- rhods-operator has the **most comprehensive CI/CD automation** with 32 workflows
- Agent rules are **among the best** with MCP server integration and AI reviewer meta-guidance
- **Coverage enforcement** is the main gap vs. gold standards — odh-dashboard and kserve both enforce thresholds
- **Image testing** lags behind notebooks' 5-layer validation approach

## File Paths Reference

### CI/CD
- `.github/workflows/` — 32 workflow files
- `.tekton/` — Konflux/Tekton pipeline definitions
- `Makefile` — Build, test, deploy targets (43K)

### Testing
- `tests/e2e/` — 51 E2E test files
- `internal/controller/*/` — Controller unit tests (envtest)
- `pkg/*/` — Package unit tests
- `cmd/*/` — CLI and main binary tests
- `tests/prometheus_unit_tests/` — Alerting rule tests

### Code Quality
- `.golangci.yml` — Comprehensive linter config (v2 format, default: all)
- `.pre-commit-config.yaml` — Pre-commit hooks (fmt, vet, lint, push-time tests)
- `.kube-linter.yaml` — Kubernetes manifest linting with severity blocking
- `.yamllint` — YAML validation with strict truthy checking
- `semgrep.yaml` — 1873-line SAST ruleset (not wired to CI)

### Container Images
- `Dockerfiles/` — 9 Dockerfiles (operator, Konflux, RHOAI, bundles, catalog, toolbox)
- `.syft.yaml` — SBOM generation config

### Security
- `.gitleaks.toml` — Secret detection config with smart allowlists
- `.gitleaksignore` — Known false positive allowlist
- `semgrep.yaml` — Comprehensive SAST rules (Go, Python, TS, YAML, generic)

### Coverage
- `codecov.yml` — Coverage tracking (informational-only)

### Agent Rules
- `AGENTS.md` — Comprehensive operator guide with build/test/quality gates
- `CLAUDE.md` — Minimal pointer
- `.claude/rules/` → `.rules/` — 5 controller pattern rules + AI reviewer guidance
- `.claude/skills/diagnose/` — Cluster diagnostics skill
- `.mcp.json` — MCP server config for opendatahub-health
