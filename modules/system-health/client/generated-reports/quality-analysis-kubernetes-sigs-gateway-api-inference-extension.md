---
repository: "kubernetes-sigs/gateway-api-inference-extension"
overall_score: 6.9
scorecard:
  - dimension: "Unit Tests"
    score: 6.5
    status: "Moderate coverage of core lwepp packages; conformance & CEL tests present; test-to-code ratio 0.38"
  - dimension: "Integration/E2E"
    score: 7.5
    status: "Rich conformance suite (15 test scenarios) + 8 GKE E2E workflows; all E2E are comment/dispatch-triggered, not PR-gated"
  - dimension: "Build Integration"
    score: 5.0
    status: "Cloud Build for staging images; no PR-time container build validation; CRD validation runs on PRs"
  - dimension: "Image Testing"
    score: 5.5
    status: "Multi-stage Dockerfile with distroless base; Trivy scanning on PRs and schedule; no image startup tests"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "coverprofile generated locally via Makefile; no codecov/coveralls integration; no PR coverage gates"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "11 workflows; PR-triggered CRD validation, API lint, Trivy scan; E2E not automated on PRs; GCB for image staging"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory; no AI agent test guidance"
critical_gaps:
  - title: "No PR-gated E2E or integration tests"
    impact: "All 8 E2E workflows require manual /run-gke-* comment triggers or workflow_dispatch; regressions can merge undetected"
    severity: "HIGH"
    effort: "12-16 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Coverage is generated locally (cover.out) but never uploaded to codecov/coveralls; no PR gates prevent coverage regression"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No PR-time container image build validation"
    impact: "Container build breakage is only caught by Cloud Build post-merge; no image startup/smoke tests"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI coding agents have no guidance on test patterns, API conventions, or contribution standards"
    severity: "MEDIUM"
    effort: "3-5 hours"
  - title: "Missing SAST/CodeQL integration"
    impact: "No static application security testing beyond Trivy image scanning; no secret detection"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add codecov integration with coverage thresholds"
    effort: "2-3 hours"
    impact: "Prevent coverage regression on every PR; establish baseline and minimum thresholds"
  - title: "Add CodeQL workflow for Go SAST"
    effort: "1-2 hours"
    impact: "Catch security vulnerabilities in Go code via static analysis on every PR"
  - title: "Add PR-time Docker build step to existing workflow"
    effort: "2-3 hours"
    impact: "Catch container build failures before merge; validate multi-stage build on PRs"
  - title: "Create basic CLAUDE.md with test patterns"
    effort: "2-3 hours"
    impact: "Guide AI agents to produce consistent, idiomatic tests following existing patterns"
  - title: "Add pre-commit hooks configuration"
    effort: "1-2 hours"
    impact: "Catch formatting/linting issues locally before push; reduce CI feedback loops"
recommendations:
  priority_0:
    - "Integrate codecov/coveralls to track and enforce coverage thresholds on PRs"
    - "Add a PR-triggered workflow that builds the lwepp Docker image to catch build breakage before merge"
    - "Gate at least one lightweight E2E or conformance test on PRs (e.g., envtest-based conformance subset)"
  priority_1:
    - "Add CodeQL or gosec SAST scanning on PRs for Go security analysis"
    - "Create agent rules (.claude/rules/) covering unit test, conformance test, and E2E test patterns"
    - "Add secret detection (gitleaks) to CI pipeline"
    - "Promote at least one E2E scenario to run automatically on merge to main"
  priority_2:
    - "Add performance regression testing for the EPP routing path"
    - "Add SBOM generation and image signing (cosign) to the release pipeline"
    - "Create contract tests for the ext-proc gRPC interface"
    - "Add pre-commit-config.yaml with golangci-lint, gofmt, and boilerplate hooks"
---

# Quality Analysis: gateway-api-inference-extension

## Executive Summary

- **Overall Score: 6.9/10**
- **Repository Type**: Kubernetes SIG project — Gateway API extension for inference workload routing
- **Primary Language**: Go (10,875 lines source, 4,161 lines test)
- **Architecture**: Kubernetes controller + Lightweight EPP (Endpoint Picker Plugin) + conformance test suite
- **Multi-module**: Go workspace with root module + conformance module

**Key Strengths:**
- Mature conformance test framework modeled after Gateway API conformance suite (15 test scenarios)
- Comprehensive E2E infrastructure across 8 GKE workflows covering multilora, decode-heavy, prefill-heavy, and prefix-cache-aware scenarios
- Strong linting with 20+ golangci-lint rules + custom Kube API linter (KAL)
- Trivy vulnerability scanning on PRs and weekly schedule with SARIF upload to GitHub Security
- CRD backward-compatibility validation on PRs using crdify

**Critical Gaps:**
- Zero E2E/conformance tests gated on PRs — all require manual trigger
- No coverage tracking service (codecov/coveralls) — coverage only generated locally
- No PR-time container image build validation
- No SAST/CodeQL, no secret detection, no pre-commit hooks
- No AI agent rules or test automation guidance

**Agent Rules Status:** Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.5/10 | Moderate coverage of lwepp core packages; testify + envtest used; test-to-code ratio 0.38 |
| Integration/E2E | 7.5/10 | Rich conformance suite + 8 GKE E2E workflows; all manually triggered |
| **Build Integration** | **5.0/10** | **Cloud Build for staging; CRD validation on PRs; no PR-time Docker build** |
| Image Testing | 5.5/10 | Trivy scanning on PRs; distroless base; no image startup/smoke tests |
| Coverage Tracking | 3.0/10 | coverprofile in Makefile only; no CI integration; no thresholds |
| CI/CD Automation | 7.0/10 | 11 workflows; good PR checks for CRD/lint/Trivy; E2E not PR-gated |
| Agent Rules | 0.0/10 | No agent rules, no .claude/ directory, no test guidance |

## Critical Gaps

### 1. No PR-Gated E2E or Integration Tests
- **Impact**: All 8 E2E workflows (`e2e-multilora-gke`, `e2e-decode-heavy-gke`, `e2e-prefill-heavy-gke`, `e2e-prefix-cache-aware-gke`, plus standalone-epp variants) are triggered via PR comment (`/run-gke-*`) or `workflow_dispatch`. None run automatically on PRs.
- **Severity**: HIGH
- **Effort**: 12-16 hours
- **Risk**: Breaking changes can merge without E2E validation. The conformance suite (15 test scenarios) is also not CI-integrated.

### 2. No Coverage Tracking or Enforcement
- **Impact**: `make test` generates `cover.out` and `make test-unit` prints function coverage, but no CI workflow uploads coverage. No codecov.yml or coveralls configuration exists. No minimum coverage thresholds.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Risk**: Coverage can silently regress across PRs with no visibility.

### 3. No PR-Time Container Build Validation
- **Impact**: The `lwepp.Dockerfile` is only built by: (a) Trivy scan workflow (which builds to scan, good), (b) Cloud Build post-merge for staging. But there's no dedicated PR workflow step that validates the Docker build succeeds for arbitrary code changes.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Risk**: Build-breaking changes to Go code or Dockerfile can merge and break staging image builds.

### 4. No SAST/CodeQL Integration
- **Impact**: No CodeQL, gosec, or Semgrep scanning. Security analysis is limited to Trivy container image scanning (which catches CVEs in dependencies but not code-level vulnerabilities).
- **Severity**: MEDIUM
- **Effort**: 2-3 hours

### 5. No Agent Rules for AI-Assisted Development
- **Impact**: No CLAUDE.md, AGENTS.md, or `.claude/` directory. AI coding agents have no guidance on test patterns, API conventions, controller reconciler patterns, or contribution standards.
- **Severity**: MEDIUM
- **Effort**: 3-5 hours

## Quick Wins

### 1. Add Codecov Integration (2-3 hours)
```yaml
# .github/workflows/test.yml (add to existing or create)
- name: Run tests with coverage
  run: make test-unit
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: cover.out
    fail_ci_if_error: true
```
```yaml
# .codecov.yml
coverage:
  status:
    project:
      default:
        target: auto
        threshold: 2%
    patch:
      default:
        target: 80%
```

### 2. Add CodeQL Workflow (1-2 hours)
```yaml
# .github/workflows/codeql.yml
name: CodeQL
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'
permissions:
  security-events: write
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: go
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

### 3. Add PR-Time Docker Build (2-3 hours)
Add a step to an existing or new PR workflow:
```yaml
- name: Build LWEPP image (validate)
  run: |
    docker build -f lwepp.Dockerfile \
      --build-arg COMMIT_SHA=${{ github.sha }} \
      --build-arg BUILD_REF=pr-${{ github.event.pull_request.number }} \
      -t gwie-lwepp:pr-check .
```

### 4. Create CLAUDE.md with Test Patterns (2-3 hours)
Generate using `/test-rules-generator` to capture:
- Unit test patterns (testify assertions, table-driven tests)
- Controller reconciler test patterns (envtest)
- Conformance test patterns (Gateway API conformance framework)
- CEL validation test patterns

### 5. Add Pre-Commit Hooks (1-2 hours)
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/golangci/golangci-lint
    rev: v2.9.0
    hooks:
      - id: golangci-lint
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (11 workflows):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `crd-validation.yml` | PR (opened/edited/sync/reopen) | CRD backward compatibility validation with crdify |
| `kal.yml` | PR (opened/edited/sync/reopen) | Kube API linter (custom golangci-lint plugin) |
| `trivy-image-scan.yaml` | PR + push to main + weekly schedule | Trivy CRITICAL/HIGH vulnerability scan with SARIF upload |
| `e2e-multilora-gke.yaml` | `/run-gke-multilora` comment / dispatch | GKE E2E: multilora with Qwen3-32B, 8 replicas |
| `e2e-multilora-gke-standalone-epp.yaml` | `/run-gke-multilora-standalone-epp` / dispatch | GKE E2E: multilora with standalone EPP |
| `e2e-decode-heavy-gke.yaml` | `/run-gke-decode-heavy` / dispatch | GKE E2E: decode-heavy workload |
| `e2e-decode-heavy-gke-standalone-epp.yaml` | `/run-gke-decode-heavy-standalone-epp` / dispatch | GKE E2E: decode-heavy standalone EPP |
| `e2e-prefill-heavy-gke.yaml` | `/run-gke-prefill-heavy` / dispatch | GKE E2E: prefill-heavy workload |
| `e2e-prefill-heavy-gke-standalone-epp.yaml` | `/run-gke-prefill-heavy-standalone-epp` / dispatch | GKE E2E: prefill-heavy standalone EPP |
| `e2e-prefix-cache-aware-gke.yaml` | `/run-gke-prefix-cache-aware` / dispatch | GKE E2E: prefix-cache-aware workload |
| `e2e-prefix-cache-aware-gke-standalone-epp.yaml` | `/run-gke-prefix-cache-aware-standalone-epp` / dispatch | GKE E2E: prefix-cache-aware standalone EPP |

**PR-Gated Checks (automatic):**
- CRD validation (backward compatibility)
- Kube API linter (custom KAL plugin)
- Trivy image vulnerability scan

**Missing PR Gates:**
- No unit test workflow on PRs
- No E2E/conformance test on PRs
- No coverage upload on PRs
- No SAST/CodeQL on PRs

**E2E Infrastructure:**
- All E2E tests run on real GKE clusters in `llm-d-scale` GCP project
- Authorization model: OWNERS/MAINTAINERS auto-authorized, others via `.github/authorized_workflow_users.txt`
- Tests deploy real model servers (vLLM with Qwen3-32B), InferencePool CRDs, and Gateway resources
- Validation via `e2e-validate.sh`: 7 iterations of completion API smoke tests
- Benchmarking with `inference-perf` and results uploaded to GCS + GitHub artifacts
- Google Chat notifications on failure

**Cloud Build:**
- `cloudbuild.yaml` pushes lwepp images to `k8s-staging-images` registry
- Used by Prow/k8s-infra for staging image promotion
- Not PR-triggered

### Test Coverage

**Unit Tests (20 test files, 4,161 lines):**

| Package | Test Files | Lines | Coverage Areas |
|---------|-----------|-------|----------------|
| `pkg/lwepp/handlers` | 3 | 790 | Request routing, response handling, server mocking |
| `pkg/lwepp/controller` | 2 | 413 | Pod reconciler, InferencePool reconciler |
| `pkg/lwepp/datastore` | 1 | 1,048 | Data store operations (largest test file) |
| `pkg/lwepp/server` | 3 | ~300 | Server options, controller config, run server |
| `pkg/common/envoy` | 3 | ~300 | Metadata, headers, chunking |
| `pkg/common/observability` | 2 | ~150 | Logging options, logger |
| `pkg/common` | 1 | ~100 | Certificates |
| `test/cel` | 2 | ~200 | CEL expression validation for InferencePool |

**Test-to-Code Ratio:** 4,161 / 10,875 = **0.38** (moderate — target is 0.5+)

**Testing Frameworks:**
- `testing` (stdlib) — primary
- `testify` (require, assert) — assertions
- `gomega` — used in conformance tests
- `envtest` — used in CEL validation tests (`test/cel/main_test.go`)

**Conformance Test Suite (15 test scenarios):**
- `inferencepool_accepted` — basic pool acceptance
- `inferencepool_resolvedrefs_condition` — reference resolution
- `inferencepool_missing_epp_ref` — missing EPP reference handling
- `inferencepool_invalid_epp_service` — invalid service handling
- `inferencepool_httproute_port_validation` — port validation
- `inferencepool_appprotocol` — app protocol handling
- `inferencepool_multiple_rules_different_pools` — multi-rule routing
- `httproute_invalid_inferencepool_ref` — invalid pool reference
- `httproute_multiple_gateways_different_pools` — multi-gateway routing
- `gateway_weighted_two_pools` — weighted routing across pools
- `gateway_following_epp_routing` — EPP routing validation
- `gateway_following_epp_routing_dp` — EPP routing with data plane
- `gateway_destination_endpoint_served` — endpoint serving validation
- `epp_unavailable_fail_open` — fail-open behavior when EPP is down

**Coverage Generation:**
- `make test` → `cover.out` (all packages)
- `make test-unit` → `cover.out` (pkg/ only) + prints function coverage
- No CI upload, no thresholds, no PR reporting

### Code Quality

**Linting Configuration (Strong):**

Three golangci-lint configurations:
1. **`.golangci.yml`** — Main linter (20 linters enabled):
   - copyloopvar, dupword, durationcheck, errcheck, fatcontext
   - ginkgolinter, goconst, gocritic, govet, ineffassign
   - loggercheck, makezero, misspell, nakedret, perfsprint
   - prealloc, revive, staticcheck, unconvert, unparam, unused
   - Formatters: gofmt, goimports

2. **`.golangci-kal.yml`** — Kube API Linter (custom plugin):
   - Custom `kubeapilinter` module for K8s API conventions
   - Enforces conditions placement, optional field pointers, omitempty policies
   - Excludes conformance tests

3. **`.custom-gcl.yml`** — Custom golangci-lint build config for KAL plugin

**Additional Quality Checks:**
- `make verify` — runs vet, fmt-verify, generate, ci-lint, api-lint, verify-all
- `make verify-crds` — validates CRD manifests with kubectl-validate
- `hack/verify-boilerplate.sh` — ensures copyright headers
- `hack/verify-manifests.sh` — validates generated manifests
- `hack/verify-all.sh` — runs all verify-* scripts

**Missing:**
- No pre-commit hooks (`.pre-commit-config.yaml`)
- No EditorConfig
- No commit message linting

### Container Images

**Dockerfile Analysis (`lwepp.Dockerfile`):**
- Multi-stage build (builder → runtime)
- Builder: `golang:1.26`
- Runtime: `gcr.io/distroless/static:nonroot` (excellent — minimal attack surface)
- `CGO_ENABLED=0` — static binary
- Build args for `COMMIT_SHA` and `BUILD_REF` traceability
- `.dockerignore` excludes `bin/`

**Strengths:**
- Distroless nonroot base image
- Static Go binary (no CGO)
- Build metadata injection (SHA + ref)

**Gaps:**
- No multi-architecture support in Dockerfile (hardcoded `GOARCH=amd64`)
- No image startup/smoke test in CI
- No SBOM generation
- No image signing (cosign/notation)
- Makefile supports `PLATFORMS` variable for multi-arch but Dockerfile doesn't use `TARGETARCH`

**Trivy Scanning (Strong):**
- Runs on PRs and push to main (path-filtered)
- Weekly scheduled scan for new CVEs
- CRITICAL + HIGH severity with unfixed ignored
- SARIF upload to GitHub Security tab
- Table output with exit-code 1 for PR blocking
- Harden Runner step for supply chain security

### Security Practices

| Practice | Status | Notes |
|----------|--------|-------|
| Trivy image scanning | Present | PR + push + weekly; SARIF upload |
| CodeQL/SAST | Missing | No static analysis for Go code |
| Secret detection | Missing | No gitleaks, TruffleHog, or similar |
| Dependency scanning | Partial | Trivy catches CVEs in image; no Dependabot/Renovate visible |
| SBOM generation | Missing | No SBOM in build pipeline |
| Image signing | Missing | No cosign/notation |
| Supply chain | Partial | Harden Runner in Trivy workflow; pinned action SHAs in some workflows |
| SECURITY.md | Present | Security contacts and vulnerability reporting process |
| Action pinning | Partial | Some workflows use SHA-pinned actions, others use `@v4` tags |

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **`.claude/` directory**: Not present
- **`.claude/rules/`**: Not present
- **Coverage**: No test type rules of any kind
- **Quality**: N/A
- **Gaps**: Missing all test automation guidance for AI agents

**Recommendation**: Generate comprehensive agent rules with `/test-rules-generator` covering:
- Unit test patterns (table-driven tests, testify assertions, fake clients)
- Controller reconciler tests (envtest, reconciler assertions)
- Conformance test patterns (Gateway API conformance framework, test registration)
- CEL validation test patterns
- E2E test patterns (GKE deployment, validation scripts)

## Recommendations

### Priority 0 (Critical)

1. **Integrate codecov/coveralls for coverage tracking**
   - Add coverage upload to CI
   - Set project target (auto) and patch target (80%)
   - Enforce no-regression on PRs
   - Effort: 2-4 hours

2. **Add PR-triggered unit test workflow**
   - Run `make test-unit` on PRs
   - Upload coverage to codecov
   - Currently no PR workflow runs Go tests at all
   - Effort: 1-2 hours

3. **Add PR-time Docker image build validation**
   - Build lwepp.Dockerfile on PRs to catch build breakage
   - Already partially done by Trivy workflow (which builds the image to scan)
   - Effort: 2-3 hours (may just need to ensure Trivy workflow is always triggered)

### Priority 1 (High Value)

4. **Add CodeQL SAST scanning on PRs**
   - Standard GitHub CodeQL workflow for Go
   - Catches code-level security vulnerabilities
   - Effort: 1-2 hours

5. **Create agent rules for test automation**
   - CLAUDE.md with project overview, testing conventions, contribution guide
   - `.claude/rules/unit-tests.md` — testify patterns, table-driven tests
   - `.claude/rules/conformance-tests.md` — conformance framework patterns
   - Effort: 3-5 hours

6. **Promote lightweight conformance tests to PR gate**
   - Run a subset of conformance tests (envtest-based, no real cluster needed) on PRs
   - The conformance suite already uses controller-runtime client; envtest is in go.mod
   - Effort: 8-12 hours

7. **Add secret detection (gitleaks)**
   - Add gitleaks-action to PR workflow
   - Effort: 1 hour

### Priority 2 (Nice-to-Have)

8. **Add performance regression testing**
   - Baseline EPP routing latency and throughput
   - Detect performance regressions from code changes
   - Effort: 8-16 hours

9. **Add SBOM generation and image signing**
   - Use Syft for SBOM, cosign for signing
   - Integrate into Cloud Build and release pipeline
   - Effort: 4-6 hours

10. **Fix multi-arch Docker build**
    - The Dockerfile hardcodes `GOARCH=amd64` while the Makefile supports `PLATFORMS` variable
    - Use `TARGETARCH` Docker buildx arg for proper multi-arch
    - Effort: 1-2 hours

11. **Add pre-commit hooks**
    - golangci-lint, gofmt, goimports, boilerplate check
    - Effort: 1-2 hours

12. **Consistent action SHA pinning**
    - Some workflows pin actions by SHA, others use version tags
    - Standardize on SHA pinning for supply chain security
    - Effort: 1-2 hours

## Comparison to Gold Standards

| Dimension | gateway-api-inference-extension | odh-dashboard | notebooks | kserve |
|-----------|-------------------------------|---------------|-----------|--------|
| Unit Test Coverage | Moderate (ratio 0.38) | Strong (multi-layer) | Moderate | Strong |
| Integration/E2E | Manual-trigger E2E (8 workflows) | Automated E2E | Automated | Automated E2E |
| Conformance Tests | 15 scenarios (not CI-gated) | Contract tests | N/A | Conformance suite |
| Coverage Tracking | Local only (no CI) | Codecov enforced | Basic | Codecov enforced |
| Image Testing | Trivy scan only | Multi-layer | 5-layer validation | Trivy + runtime |
| CI/CD Automation | 3 PR checks + 8 manual E2E | Comprehensive | Comprehensive | Comprehensive |
| Linting | 20+ linters + KAL | ESLint | Basic | golangci-lint |
| Security Scanning | Trivy only | Trivy + CodeQL | Trivy | Trivy + CodeQL |
| Agent Rules | None | Comprehensive | Basic | None |
| Pre-commit Hooks | None | Present | Present | Present |

## File Paths Reference

### CI/CD
- `.github/workflows/crd-validation.yml` — CRD compatibility check (PR-triggered)
- `.github/workflows/kal.yml` — Kube API linter (PR-triggered)
- `.github/workflows/trivy-image-scan.yaml` — Trivy vulnerability scanner (PR + push + schedule)
- `.github/workflows/e2e-*-gke*.yaml` — 8 GKE E2E workflows (manual trigger)
- `cloudbuild.yaml` — Google Cloud Build for staging images
- `Makefile` — Build, test, lint, verify targets

### Testing
- `pkg/lwepp/handlers/*_test.go` — Handler unit tests
- `pkg/lwepp/controller/*_test.go` — Controller reconciler tests
- `pkg/lwepp/datastore/datastore_test.go` — Datastore unit tests (1,048 lines)
- `conformance/` — Full conformance test framework (15 scenarios)
- `test/cel/` — CEL expression validation tests
- `.github/scripts/e2e/e2e-validate.sh` — E2E smoke test script

### Code Quality
- `.golangci.yml` — Main golangci-lint config (20 linters)
- `.golangci-kal.yml` — Kube API linter config
- `.custom-gcl.yml` — Custom golangci-lint plugin build
- `hack/verify-*.sh` — Verification scripts (boilerplate, manifests, all)

### Container Images
- `lwepp.Dockerfile` — Lightweight EPP container (distroless + static binary)
- `.dockerignore` — Docker build context exclusions

### Security
- `SECURITY.md` — Vulnerability reporting process
- `SECURITY_CONTACTS` — Security contact list

### Project Structure
- `go.work` — Go workspace (root + conformance modules)
- `go.mod` — Root module
- `conformance/go.mod` — Conformance test module
- `OWNERS` / `OWNERS_ALIASES` — Kubernetes-style reviewer/approver config
