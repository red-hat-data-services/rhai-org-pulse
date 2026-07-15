---
repository: "red-hat-data-services/model-registry-operator"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Excellent test-to-code ratio (1.16:1 test LOC vs source LOC), Ginkgo/Gomega with envtest, 5 test suites covering controllers, webhooks, config, migration"
  - dimension: "Integration/E2E"
    score: 7.5
    status: "Kind-based deployment test in PR workflow validates image build + operator deploy + CR creation; chaos testing with operator-chaos framework"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time image build + Kind deployment + kustomize validation; separate Konflux pipeline via Tekton; no PR-time Konflux simulation"
  - dimension: "Image Testing"
    score: 6.5
    status: "Docker image built and loaded into Kind on PR; no Trivy/Snyk scanning, no SBOM generation, no multi-arch PR validation"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "coverprofile generated locally but no Codecov/Coveralls integration, no PR coverage gates or trend reporting"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "Well-structured workflows with caching, path-ignore filters, concurrency control; dependabot for 3 ecosystems; kustomize build validation"
  - dimension: "Agent Rules"
    score: 8.0
    status: "Comprehensive AGENTS.md with build commands, architecture docs, testing guidance, commit conventions; no .claude/rules/ for test patterns"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Coverage can silently regress with no PR-time visibility; no baseline established"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container security scanning"
    impact: "Vulnerable dependencies and base image CVEs go undetected until production scanning"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No PR-time Konflux build simulation"
    impact: "Konflux-specific build issues (FIPS mode, pinned base images) only caught post-merge"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "No SBOM generation or image signing"
    impact: "Supply chain transparency gap; missing attestation for compliance requirements"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add Codecov integration with PR comments"
    effort: "2-4 hours"
    impact: "Immediate visibility into coverage trends and regressions on every PR"
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Catch CVEs in base images and dependencies before merge"
  - title: "Add govulncheck to PR workflow (already in Makefile)"
    effort: "1 hour"
    impact: "govulncheck runs in make test but results aren't surfaced in CI — make it an explicit step"
  - title: "Create .claude/rules/ for test patterns"
    effort: "2-3 hours"
    impact: "Codify Ginkgo/envtest patterns so AI agents generate idiomatic tests"
recommendations:
  priority_0:
    - "Integrate Codecov with coverage thresholds and PR gating"
    - "Add Trivy scanning for container images in PR and push workflows"
  priority_1:
    - "Add PR-time Konflux build simulation (FIPS mode, pinned base images)"
    - "Create .claude/rules/ with test creation patterns for unit, controller, webhook, and chaos tests"
    - "Add SBOM generation and cosign image signing to push workflow"
  priority_2:
    - "Add multi-architecture image build validation on PR"
    - "Add CodeQL or Semgrep to CI (config exists but not wired into workflows)"
    - "Add upgrade/migration testing for API version transitions"
---

# Quality Analysis: model-registry-operator

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Kubernetes Operator (Kubebuilder-based, Go)
- **Primary Language**: Go 1.26
- **Framework**: controller-runtime / Kubebuilder with Ginkgo/Gomega testing

### Key Strengths
- **Outstanding test-to-code ratio**: 7,530 test lines vs 6,481 source lines (1.16:1) — test code exceeds production code
- **Chaos engineering**: Dedicated `chaos/` directory with operator-chaos framework, 9 experiments, and a knowledge model validated in CI
- **Comprehensive PR validation**: Image build + Kind deployment + CR creation + operator health check runs on every PR
- **Strong agent guidance**: AGENTS.md covers architecture, commands, testing, and conventions in detail
- **Modern tooling**: govulncheck, golangci-lint v2, Gitleaks, Semgrep config, Dependabot for 3 ecosystems

### Critical Gaps
- **No coverage tracking**: `cover.out` generated but never uploaded; no Codecov, no thresholds, no PR visibility
- **No container scanning**: No Trivy, Snyk, or Grype in any workflow despite building images on every PR
- **Semgrep config exists but isn't wired into CI**: 1,873-line `semgrep.yaml` sits unused in workflows

### Agent Rules Status: **Strong (AGENTS.md) / Incomplete (.claude/rules/)**

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Excellent ratio, 5 suites, envtest, Ginkgo/Gomega |
| Integration/E2E | 7.5/10 | Kind deployment test + chaos testing in CI |
| Build Integration | 7.0/10 | PR image build + kustomize validation; no Konflux sim |
| Image Testing | 6.5/10 | Build + deploy on PR; no scanning, no SBOM |
| Coverage Tracking | 4.0/10 | coverprofile generated but not tracked or enforced |
| CI/CD Automation | 8.0/10 | Well-structured, cached, path-filtered, Dependabot |
| Agent Rules | 8.0/10 | Rich AGENTS.md; no .claude/rules/ for test patterns |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: Coverage can silently regress with no PR-time visibility
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: `make test` generates `cover.out` but it's never uploaded to Codecov or any service. No `.codecov.yml` exists. No PR comments showing coverage delta. No minimum threshold enforced.
- **Fix**: Add Codecov GitHub Action after `make test`, create `.codecov.yml` with project/patch thresholds

### 2. No Container Security Scanning
- **Impact**: Vulnerable base images (UBI9) and Go dependencies go undetected until Konflux/production scanning
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Both `Dockerfile` and `Dockerfile.konflux` use `registry.access.redhat.com/ubi9` images. No Trivy, Snyk, or Grype step in any workflow. Image is built on every PR but never scanned.
- **Fix**: Add `aquasecurity/trivy-action` after `docker-build` in `build-image-pr.yml`

### 3. Semgrep Config Not Wired Into CI
- **Impact**: 1,873-line security rule set covering Go, Python, TypeScript, YAML, and generic secret detection sits idle
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: `semgrep.yaml` exists at repo root with comprehensive rules but no workflow runs it
- **Fix**: Add Semgrep step to `build.yml` or create dedicated security workflow

### 4. No PR-time Konflux Build Simulation
- **Impact**: FIPS-mode compilation (`CGO_ENABLED=1 -tags strictfipsruntime`), pinned base image digests, and Konflux-specific labels only tested post-merge
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Details**: `Dockerfile.konflux` uses different build flags and pinned SHAs vs `Dockerfile`. Tekton pipeline runs on PR via label/comment trigger but doesn't simulate locally.

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
```yaml
# Add to build.yml after 'make test'
- name: Upload coverage
  uses: codecov/codecov-action@v5
  with:
    files: cover.out
    fail_ci_if_error: true
```
Create `.codecov.yml`:
```yaml
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

### 2. Add Trivy Container Scanning (1-2 hours)
```yaml
# Add to build-image-pr.yml after image build
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'model-registry-operator:${{ steps.tags.outputs.tag }}'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
- name: Upload Trivy scan results
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: 'trivy-results.sarif'
```

### 3. Wire Semgrep Into CI (1 hour)
```yaml
# Add to build.yml
- name: Semgrep scan
  uses: returntocorp/semgrep-action@v1
  with:
    config: semgrep.yaml
```

### 4. Surface govulncheck Results (1 hour)
govulncheck already runs as part of `make test` but its output is buried. Add it as a named step:
```yaml
- name: Run govulncheck
  run: make govulncheck
```

## Detailed Findings

### CI/CD Pipeline

**Workflows (5 total)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build.yml` | PR + push(main) | Build, lint, test, kustomize validate |
| `build-image-pr.yml` | PR | Docker build + Kind deploy + CR test |
| `build-and-push-image.yml` | push(main) + tags | Build and push to Quay |
| `chaos-validate.yml` | PR (chaos/controller/api paths) | Validate chaos experiments + run chaos tests |
| `sync-branch-stable.yml` | push(main) | Sync main → stable branch |

**Strengths**:
- `build.yml` uses Go dependency caching (`actions/cache@v6`) with hash-based keys
- Path-ignore filters avoid unnecessary runs for docs/LICENSE changes
- `build-image-pr.yml` does full operator lifecycle: build → Kind load → deploy → create CR → wait for Available
- Chaos validation runs on path-filtered PRs touching controller/API/config code
- Kustomize build validation (`kustomize build config/overlays/odh/`) catches config errors pre-merge
- Uncommitted file detection catches codegen drift

**Gaps**:
- No concurrency control on PR workflows (missing `concurrency:` key in `build.yml` and `build-image-pr.yml`)
- No workflow for security scanning (Trivy, CodeQL, Semgrep)
- No scheduled/periodic workflows for nightly regression or dependency audit

### Test Coverage

**Test Architecture**:
- **Framework**: Ginkgo v2 + Gomega with envtest (in-process API server)
- **5 Test Suites**:
  1. `api/v1alpha1/` — v1alpha1 webhook validation (2 files, 638 lines)
  2. `api/v1beta1/` — v1beta1 webhook validation (2 files, 758 lines)
  3. `internal/controller/` — Core controller reconciliation (4 files, 4,569 lines)
  4. `internal/controller/config/` — Configuration defaults (2 files, 815 lines)
  5. `internal/migration/` — Storage version migration (2 files, 446 lines)
- **14 test files, 7,530 lines of test code**
- **Test-to-code ratio**: 1.16:1 (outstanding — test code exceeds production code)

**Coverage**:
- `coverprofile cover.out` generated by `make test`
- **No Codecov/Coveralls integration** — coverage not tracked, trended, or enforced
- No minimum coverage threshold
- No PR coverage comments

**Chaos Testing (Distinctive)**:
- 9 chaos experiments: pod-kill, network-partition, config-drift, RBAC revoke, webhook disruption, finalizer block, catalog-specific scenarios
- Knowledge model defines operator topology, steady-state checks, managed resources
- `operator-chaos validate` runs in CI to catch knowledge model regressions
- `make test-chaos` runs chaos-focused Ginkgo tests with envtest
- Breaking change detection via `operator-chaos diff` against base branch

### Code Quality

**Linting**:
- golangci-lint v2.1.6 with `default: standard` preset
- `errcheck` disabled (potential concern for error-swallowing)
- Generated code, comments, third-party, and examples excluded
- Runs on both PR and push via `make lint` in `build.yml`

**Pre-commit Hooks**:
- `.pre-commit-config.yaml` configured with:
  - `trailing-whitespace`, `end-of-file-fixer`, `check-yaml`, `check-merge-conflict`
  - Local hooks: `go fmt`, `go vet`, `golangci-lint`
- Well-structured — format and lint run before commit

**Static Analysis**:
- **Gitleaks**: `.gitleaks.toml` with comprehensive allowlists for test fixtures, mock data, CI resources
- **Semgrep**: 1,873-line unified config covering Go, Python, TypeScript, YAML, generic secrets — **but not wired into CI**
- **govulncheck**: v1.1.4 runs as prerequisite to `make test` and `make run`
- **No CodeQL** workflow

**Dependabot**: 3 ecosystems (gomod, docker, github-actions) with weekly schedule

### Container Images

**Dockerfiles (2)**:
1. `Dockerfile` — Standard multi-stage build, `CGO_ENABLED=0`, UBI9 minimal base, unpinned `:latest` tag
2. `Dockerfile.konflux` — FIPS-compliant build (`CGO_ENABLED=1 GOEXPERIMENT=strictfipsruntime`), pinned base image SHAs, Red Hat labels

**Strengths**:
- Multi-stage builds (builder → minimal runtime)
- Non-root user (65532:65532)
- UBI9 base images (Red Hat supported)
- BUILDPLATFORM/TARGETARCH support in standard Dockerfile
- `.dockerignore` present

**Gaps**:
- No Trivy/Snyk/Grype scanning in any workflow
- No SBOM generation
- No image signing (cosign)
- No multi-architecture build validation on PR (only `docker-build`, not `docker-buildx`)
- Standard Dockerfile uses unpinned `:latest` tag (Konflux version properly pins SHAs)

### Security

| Practice | Status | Details |
|----------|--------|---------|
| Gitleaks | Present | `.gitleaks.toml` with comprehensive allowlists |
| Semgrep | Config only | 1,873-line rule set not wired into CI |
| govulncheck | Integrated | Runs as make prerequisite |
| Dependabot | Active | 3 ecosystems, weekly |
| CodeQL | Missing | No workflow |
| Container scanning | Missing | No Trivy/Snyk/Grype |
| Secret detection | Partial | Gitleaks config + Semgrep rules, not in CI |
| SBOM | Missing | No generation |
| Image signing | Missing | No cosign |

### Agent Rules (Agentic Flow Quality)

**Status**: Strong AGENTS.md / No .claude/rules/

**AGENTS.md (also symlinked as CLAUDE.md)** — 7,845 bytes covering:
- Build and test commands with specific make targets
- Ginkgo-specific test suite execution (`ginkgo run -v internal/controller`)
- Architecture documentation (controllers, API versions, webhooks, templates, capabilities)
- Dev cluster testing workflow (build → push → deploy → patch)
- Kustomize layout and overlay structure
- Environment variables and configuration
- Commit/PR hygiene conventions (Conventional Commits)

**Gaps**:
- No `.claude/` directory
- No `.claude/rules/` with test creation patterns
- No codified patterns for writing Ginkgo tests with envtest
- No guidance on chaos experiment creation
- No webhook test patterns documented as rules

## Recommendations

### Priority 0 (Critical)

1. **Integrate Codecov with coverage thresholds and PR gating**
   - Upload `cover.out` after `make test` in `build.yml`
   - Set project target at `auto` with 2% threshold, patch target at 80%
   - Enable PR comments showing coverage delta

2. **Add Trivy container scanning to PR and push workflows**
   - Scan built image in `build-image-pr.yml` after `make docker-build`
   - Upload SARIF results for GitHub Security tab integration
   - Set severity threshold at CRITICAL,HIGH

### Priority 1 (High Value)

3. **Wire Semgrep into CI**
   - Add Semgrep step to `build.yml` using existing `semgrep.yaml` config
   - The rule set already exists — just needs a workflow step

4. **Add concurrency control to PR workflows**
   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
     cancel-in-progress: true
   ```

5. **Create `.claude/rules/` for test patterns**
   - `unit-tests.md` — Ginkgo/Gomega patterns with envtest
   - `webhook-tests.md` — Webhook suite setup and validation patterns
   - `chaos-tests.md` — operator-chaos experiment creation guidelines
   - `controller-tests.md` — Controller reconciliation test patterns
   - Use `/test-rules-generator` to bootstrap these

6. **Add SBOM generation and image signing to push workflow**
   - Generate SBOM with Syft during `build-and-push-image.yml`
   - Sign images with cosign

### Priority 2 (Nice-to-Have)

7. **Add multi-architecture build validation on PR**
   - Run `docker buildx build --platform linux/amd64,linux/arm64` to validate cross-platform compatibility

8. **Add scheduled security scan workflow**
   - Nightly Trivy + Semgrep + govulncheck on main branch
   - Alert on new CVEs in dependencies or base images

9. **Add upgrade/migration testing**
   - Test v1alpha1 → v1beta1 conversion webhook with envtest
   - Validate storage migration strategies with realistic CRD data

10. **Add CodeQL analysis workflow**
    - Standard Go CodeQL configuration for additional SAST coverage beyond Semgrep

## Comparison to Gold Standards

| Dimension | model-registry-operator | odh-dashboard (gold) | notebooks (gold) | Gap |
|-----------|------------------------|---------------------|-------------------|-----|
| Unit Tests | 8.5 — Ginkgo/envtest, 1.16:1 ratio | 9.0 — Jest, multi-layer | 7.0 — Python-focused | Near gold |
| Integration/E2E | 7.5 — Kind deploy + chaos | 9.0 — Cypress E2E + contract | 8.0 — Multi-layer image | Needs contracts |
| Build Integration | 7.0 — Image + kustomize | 8.0 — Full build matrix | 7.0 — Image pipeline | Close |
| Image Testing | 6.5 — Build + deploy only | 8.0 — Multi-layer validation | 9.0 — 5-layer validation | Needs scanning |
| Coverage | 4.0 — Generated, not tracked | 9.0 — Codecov + enforcement | 6.0 — Basic | Critical gap |
| CI/CD | 8.0 — Well-structured | 9.0 — Comprehensive matrix | 8.0 — Image-focused | Minor gaps |
| Agent Rules | 8.0 — Rich AGENTS.md | 9.0 — Full .claude/rules/ | 5.0 — Basic | Needs .claude/rules/ |
| **Chaos Testing** | **9.0** — **9 experiments + CI** | 0.0 — None | 0.0 — None | **Above gold** |

**Notable**: This repository **exceeds gold standards** in chaos engineering with a dedicated chaos testing framework, 9 experiments, knowledge model validation, and breaking change detection — a practice not yet adopted by any gold standard repository.

## File Paths Reference

| File | Purpose |
|------|---------|
| `.github/workflows/build.yml` | PR/push: build, lint, test, kustomize validate |
| `.github/workflows/build-image-pr.yml` | PR: image build + Kind deploy + E2E |
| `.github/workflows/build-and-push-image.yml` | Push: image build + Quay push |
| `.github/workflows/chaos-validate.yml` | PR: chaos experiment validation |
| `.github/workflows/sync-branch-stable.yml` | Push: main → stable sync |
| `.golangci.yml` | golangci-lint v2 config |
| `.pre-commit-config.yaml` | Pre-commit hooks (fmt, vet, lint) |
| `.gitleaks.toml` | Secret detection allowlists |
| `semgrep.yaml` | 1,873-line security rules (NOT in CI) |
| `Dockerfile` | Standard multi-stage build |
| `Dockerfile.konflux` | FIPS-compliant Konflux build |
| `.tekton/` | Konflux pipeline (synced from konflux-central) |
| `Makefile` | Build, test, lint, deploy targets |
| `AGENTS.md` / `CLAUDE.md` | AI agent guidance |
| `chaos/knowledge/` | Chaos testing knowledge model |
| `chaos/experiments/` | 9 chaos experiment definitions |
