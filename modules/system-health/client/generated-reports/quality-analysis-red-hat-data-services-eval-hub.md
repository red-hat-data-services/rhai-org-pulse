---
repository: "red-hat-data-services/eval-hub"
overall_score: 8.2
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "Exceptional test-to-code ratio (1.78:1 LOC), 107 test files for 117 source files, Go stdlib testing + godog BDD"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Comprehensive BDD FVT suite with 14 feature files, godog tags for environment isolation, server-started FVT, MCP FVT, Kubernetes FVT"
  - dimension: "Build Integration"
    score: 7.5
    status: "PR-time Docker build with dry-run validation, Konflux Tekton pipeline for multi-arch builds (x86_64, ppc64le, s390x, arm64), hermetic builds"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage builds, UBI9 base images, non-root user, dry-run validation, multi-arch support; no Trivy/Snyk scanning, no SBOM"
  - dimension: "Coverage Tracking"
    score: 8.0
    status: "Codecov integration with fail_ci_if_error, coverage range thresholds (50-75%), multi-profile coverage (unit + FVT + init)"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "15 workflows covering CI, MCP CI, Python wheels, security scan, config validation, commit lint, reviewer approvals, branch sync, publishing"
  - dimension: "Agent Rules"
    score: 8.5
    status: "CLAUDE.md + AGENTS.md with comprehensive build/test/architecture docs, .claude/rules/ with path-scoped rules for service and MCP components"
critical_gaps:
  - title: "No container vulnerability scanning (Trivy/Snyk)"
    impact: "CVEs in base images or dependencies go undetected until downstream scanning catches them"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No SBOM generation"
    impact: "Supply chain transparency gap; no software bill of materials for compliance auditing"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "Codecov coverage thresholds too permissive (50-75%)"
    impact: "Coverage can drop to 50% without failing CI; no minimum enforcement or patch/diff thresholds"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "Gosec runs with -no-fail flag"
    impact: "Security findings don't block PRs; issues are uploaded to GitHub Security tab but CI passes regardless"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add Trivy container scanning to CI workflow"
    effort: "2-3 hours"
    impact: "Early detection of CVEs in UBI9 base images and Go dependencies"
  - title: "Enforce Gosec failures on ERROR severity"
    effort: "1 hour"
    impact: "Prevents merging PRs with high-severity security issues"
  - title: "Add codecov patch and project thresholds"
    effort: "1 hour"
    impact: "Prevents coverage regressions on new code"
  - title: "Add SBOM generation to container build"
    effort: "2 hours"
    impact: "Supply chain compliance and transparency"
recommendations:
  priority_0:
    - "Add Trivy or Grype container image scanning to PR and push workflows"
    - "Configure Gosec to fail CI on ERROR-severity findings (remove -no-fail)"
  priority_1:
    - "Add codecov.yml patch/project thresholds (e.g., target: 70%, patch: 80%)"
    - "Add SBOM generation (syft or trivy sbom) to container build pipeline"
    - "Add golangci-lint with extended linter set beyond go vet"
  priority_2:
    - "Add contract tests for the eval-hub SDK client boundary"
    - "Add performance/load testing for API endpoints"
    - "Add image startup validation beyond --help dry-run (health endpoint check)"
---

# Quality Analysis: eval-hub

## Executive Summary

- **Overall Score: 8.2/10**
- **Repository Type**: Go REST API service with MCP server, Python wheel distributions, Kubernetes operator integration
- **Languages**: Go (primary), Python (packaging/SDK), YAML (OpenAPI, configs)
- **Framework**: Go stdlib `net/http`, godog BDD testing, Tekton/Konflux CI

### Key Strengths
- **Outstanding test-to-code ratio**: 107 test files / 117 source files (0.91 ratio); 32,854 test LOC / 18,462 source LOC (1.78:1)
- **Comprehensive BDD testing**: 14 Gherkin feature files across core API, MCP, MLflow, and Kubernetes scenarios
- **Multi-layer CI**: 15 GitHub Actions workflows covering unit tests, FVT, security scan, config validation, commit linting, wheel builds, and reviewer approvals
- **Strong agent rules**: CLAUDE.md, AGENTS.md, and path-scoped `.claude/rules/` with detailed architecture and testing guidance
- **Mature build pipeline**: Konflux Tekton with 4-architecture builds, hermetic mode, and FIPS-compatible Go builds

### Critical Gaps
- No container vulnerability scanning (Trivy/Snyk)
- Gosec security scanner runs in non-blocking mode (`-no-fail`)
- Codecov thresholds are permissive (50-75% range, no patch/project enforcement)
- No SBOM generation for supply chain compliance

### Agent Rules Status: **Strong** (CLAUDE.md + AGENTS.md + `.claude/rules/` with path-scoped rules)

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 9.0/10 | Exceptional coverage with 1.78:1 test-to-code LOC ratio |
| Integration/E2E | 8.5/10 | Comprehensive BDD FVT with godog, 14 feature files, multi-env tags |
| Build Integration | 7.5/10 | PR Docker build + dry-run, Konflux 4-arch builds, hermetic mode |
| Image Testing | 7.0/10 | Multi-stage UBI9, non-root, dry-run; no scanning or SBOM |
| Coverage Tracking | 8.0/10 | Codecov with multi-profile uploads; thresholds need tightening |
| CI/CD Automation | 9.0/10 | 15 workflows, comprehensive automation, pinned actions |
| Agent Rules | 8.5/10 | CLAUDE.md + AGENTS.md + path-scoped rules with architecture docs |

## Critical Gaps

### 1. No Container Vulnerability Scanning
- **Impact**: CVEs in UBI9 base images, Go dependencies, or runtime components go undetected until downstream Konflux scanning
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Recommendation**: Add Trivy or Grype scanning to the `docker-build-check` job in `ci.yml`

### 2. Gosec Runs Non-Blocking
- **Impact**: Security findings are reported to GitHub Security tab but never fail CI; developers may ignore them
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Detail**: `ci.yml` line 90 uses `-no-fail` flag: `args: '-no-fail -fmt sarif -out gosec-results.sarif ./...'`

### 3. Permissive Coverage Thresholds
- **Impact**: Coverage can drop to 50% without warning; no enforcement of coverage on new code (patch coverage)
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Detail**: `codecov.yml` only sets `range: 50..75` (color coding) with no `target` or `patch` thresholds

### 4. No SBOM Generation
- **Impact**: Supply chain transparency gap; missing software bill of materials for compliance requirements
- **Severity**: MEDIUM
- **Effort**: 2-3 hours

## Quick Wins

### 1. Add Trivy Scanning to CI (2-3 hours)
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: evalhub:pr-check
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'
- name: Upload Trivy scan results
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: 'trivy-results.sarif'
```

### 2. Enforce Gosec Failures (1 hour)
Change Gosec args from `-no-fail` to fail on ERROR:
```yaml
args: '-fmt sarif -out gosec-results.sarif -severity high ./...'
```

### 3. Tighten Codecov Thresholds (1 hour)
```yaml
coverage:
  range: 50..75
  status:
    project:
      default:
        target: 70%
        threshold: 2%
    patch:
      default:
        target: 80%
```

### 4. Add SBOM Generation (2 hours)
Add to docker-build-push job:
```yaml
- name: Generate SBOM
  uses: anchore/sbom-action@v0
  with:
    image: ${{ env.IMAGE_REGISTRY }}/${{ env.IMAGE_REPOSITORY }}@${{ steps.build.outputs.digest }}
    format: spdx-json
    output-file: sbom.spdx.json
```

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory** (15 workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | push/PR to main/develop | Quality checks, tests, coverage, security scan, Docker build |
| `ci-mcp.yml` | push/PR (path-filtered) | MCP server quality checks + multi-platform build |
| `ci-python-server.yml` | PR (path-filtered) | Python server wheel build + sanity test |
| `ci-python-mcp.yml` | PR/dispatch (path-filtered) | Python MCP wheel build + sanity test |
| `commitlint.yml` | PR to main | Conventional commit validation |
| `validate-configs.yml` | PR/push/dispatch | Provider/collection YAML validation |
| `required-reviewer-approvals.yml` | PR events | Enforce reviewer approval policy |
| `publish-python-server.yml` | Release | PyPI server wheel publishing |
| `publish-python-mcp.yml` | Release | PyPI MCP wheel publishing |
| `release-mcp.yml` | Release | MCP binary release |
| `sync-branch-stable.yaml` | Push to main | Sync to stable branch |
| `sync-branch-incubation.yaml` | Push to main | Sync to incubation branch |
| `check-trustyai-service-operator-configmap-sync.yml` | Scheduled | Cross-repo config sync check |

**Strengths**:
- All GitHub Actions pinned to full SHA (not tags) for supply chain security
- `persist-credentials: false` on all checkout steps
- Path-filtered workflows reduce unnecessary CI runs
- Go module caching via `setup-go` action
- Concurrency control via Tekton `cancel-in-progress`
- `fail_ci_if_error: true` on Codecov upload (except Dependabot PRs)
- Multi-platform builds (amd64, arm64, ppc64le, s390x) in Konflux

**Gaps**:
- No concurrency control on GitHub Actions workflows (could run duplicate jobs)
- No test parallelization configuration

### Test Coverage

**Unit Tests** (Score: 9.0/10):
- 107 Go test files covering 117 source files (0.91 file ratio)
- 32,854 test LOC vs 18,462 source LOC (1.78:1 ratio — exceptional)
- Go stdlib `testing` package
- Race detection enabled (`-race` flag)
- Coverage profiling with atomic mode
- Tests span all packages: `internal/`, `cmd/`, `pkg/`
- MCP server tests use `mcp.NewInMemoryTransports()` for in-process testing

**Integration/FVT Tests** (Score: 8.5/10):
- 14 BDD feature files using godog (Cucumber for Go)
- Feature coverage: health, evaluations, evaluation_jobs, evaluation_local_jobs, collections, providers, metrics, GPU resources, MLflow experiments, MCP tools/server/resources/prompts, Kubernetes resources
- Environment-aware tags: `@cluster`, `@local_runtime`, `@mlflow`, `@negative`, `@gha-wheel-sanity`
- FVT runs against both embedded server and started server (`test-fvt` vs `test-fvt-server`)
- JUnit XML report generation for CI integration
- Coverage collection from FVT runs via coverage-instrumented binaries

**Wheel Sanity Tests**:
- Python server wheel: build, install, startup test
- Python MCP wheel: build, install, version check
- MCP binary: cross-platform builds, static linking verification, container tests, checksums

### Code Quality

**Linting**:
- `go vet` as primary linter (basic but reliable)
- `go fmt` for formatting enforcement
- Format check in CI (diff-based, fails on unformatted code)
- **Gap**: No `golangci-lint` with extended linter set (errcheck, gocritic, staticcheck, etc.)

**Pre-commit Hooks**:
- Comprehensive `.pre-commit-config.yaml`:
  - Standard hooks: trailing-whitespace, end-of-file-fixer, check-yaml, check-json, check-toml, check-merge-conflict, check-added-large-files (1MB limit), debug-statements
  - Commitizen for conventional commit enforcement
  - Local `go-test` hook running unit + FVT on Go file changes
  - `no-commit-to-branch` preventing direct pushes to main

**Static Analysis**:
- Gosec security scanner with SARIF output to GitHub Security tab
- Comprehensive Semgrep configuration (`semgrep.yaml`) with 40+ rules covering:
  - Generic secrets detection (hardcoded passwords, AWS keys, GitHub tokens, Slack webhooks)
  - Kubernetes RBAC security (wildcard resources/verbs, dangerous verbs, cluster-admin bindings)
  - Kubernetes container security (privileged containers, hostPath, secret in ConfigMap)
  - GitHub Actions security (script injection, pull_request_target checkout)
  - Go security (exec injection, TLS skip verify, SQL injection, hardcoded credentials)
  - Python security (eval/exec, pickle, yaml.load, subprocess injection)
  - TypeScript security (XSS, eval, localStorage)
  - Dockerfile security (latest tag, secrets in ENV)
  - Shell script security (eval, unquoted variables)

**Gitleaks Configuration**:
- Comprehensive `.gitleaks.toml` with well-structured allowlists
- Excludes test files, fixtures, mocks, CI resources, and known test credentials

### Container Images

**Build Process**:
- Multi-stage builds in both `Containerfile` (dev) and `Dockerfile.konflux` (production)
- UBI9 base images: `ubi9/go-toolset:1.26` (builder), `ubi9/ubi-minimal` (runtime)
- Pinned digest for Konflux Dockerfile (SHA-based, not tag-based)
- Non-root user (UID 1000, numeric for Kubernetes `runAsNonRoot` verification)
- CGO_ENABLED=0 for static linking (Containerfile) / CGO_ENABLED=1 with FIPS (Dockerfile.konflux)
- Multi-platform support: amd64 + arm64 (Containerfile) / x86_64 + ppc64le + s390x + arm64 (Konflux)
- OCI labels for image metadata

**Runtime Validation**:
- Dry-run validation: `docker run --rm evalhub:pr-check /app/eval-hub --local --help`
- **Gap**: No health endpoint validation, no integration test against running container

**Security**:
- No Trivy/Snyk/Grype scanning
- No SBOM generation
- No image signing/attestation
- FIPS-compatible builds in Konflux (`GOEXPERIMENT=strictfipsruntime`)

### Security Practices

**Strengths**:
- Gosec SAST with SARIF integration (findings visible in GitHub Security tab)
- Comprehensive Semgrep rules (40+ rules across 9 sections) — **industry-leading breadth**
- Gitleaks configuration for secret detection
- GitHub Actions supply chain hardening (SHA-pinned actions, persist-credentials: false)
- Conventional commits enforcement
- Required reviewer approvals workflow
- FIPS-compatible builds for production

**Gaps**:
- Gosec `-no-fail` means security issues don't block merges
- No CodeQL workflow
- No Trivy/Snyk container scanning
- No dependency scanning (Dependabot/Renovate security alerts configured via `.github/renovate.json` for updates, but no scanning workflow)

### Agent Rules (Agentic Flow Quality)

**Status**: **Strong** — comprehensive documentation and path-scoped rules

**Coverage**:
- `CLAUDE.md`: CVE fixing guidance with Go toolset version constraints, npm dependency handling
- `AGENTS.md`: Full repository guide with build commands, testing strategy, architecture overview, project structure, server lifecycle, MCP server details, configuration discovery, request identity, and implementation notes
- `.claude/rules/evalhub-service.md`: Path-scoped to `cmd/eval_hub/**`, `internal/eval_hub/**`, `config/` — covers build, test, architecture patterns (ExecutionContext, Two-Tier Config, Routing, Metrics), testing strategy with unit/FVT guidance
- `.claude/rules/evalhub-mcp-service.md`: Path-scoped to `cmd/evalhub_mcp/**`, `internal/evalhub_mcp/**` — covers MCP-specific build, test, and architecture

**Quality Assessment**:
- Rules are comprehensive and actionable with specific commands and examples
- Architecture documentation is excellent (ExecutionContext pattern, routing, metrics, config discovery)
- Testing guidance includes specific test commands and conventions (`t.Parallel()` guidance)
- Git commit conventions documented with conventional commits and AI attribution
- Go version management policy clearly stated

**Gaps**:
- No rules for Python wheel components (`python-server/`, `python-mcp/`)
- No rules for FVT/BDD test creation patterns
- No rules for container/Dockerfile changes

## Recommendations

### Priority 0 (Critical)
1. **Add container vulnerability scanning** — Integrate Trivy or Grype into `ci.yml` after Docker build step to catch CVEs before merge
2. **Make Gosec blocking** — Remove `-no-fail` flag or set severity threshold to fail on HIGH/CRITICAL findings

### Priority 1 (High Value)
3. **Tighten Codecov thresholds** — Add project target (70%+) and patch coverage requirement (80%+) to prevent regression
4. **Add SBOM generation** — Use `syft` or `trivy sbom` in container build pipeline for supply chain compliance
5. **Add golangci-lint** — Replace `go vet` with golangci-lint for richer static analysis (errcheck, gocritic, staticcheck, gosimple, ineffassign)
6. **Add workflow concurrency control** — Prevent duplicate CI runs:
   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: true
   ```

### Priority 2 (Nice-to-Have)
7. **Add agent rules for Python wheel components** — Create `.claude/rules/python-server.md` and `python-mcp.md` with wheel build/test guidance
8. **Add agent rules for FVT test creation** — Document godog step definition patterns, tag conventions, and test data management
9. **Add container health endpoint validation** — Extend dry-run to call `/api/v1/health` endpoint in PR builds
10. **Add contract tests** — Test the `eval-hub-sdk` client interface boundary
11. **Add load/performance testing** — Benchmark API endpoints under concurrent load
12. **Add CodeQL analysis** — Complement Gosec with CodeQL for deeper semantic analysis

## Comparison to Gold Standards

| Dimension | eval-hub | odh-dashboard | notebooks | kserve |
|-----------|----------|---------------|-----------|--------|
| Test Ratio | **1.78:1** (exceptional) | ~0.8:1 | ~0.3:1 | ~0.6:1 |
| BDD/FVT | **14 features** | Cypress E2E | Shell scripts | Go E2E |
| Coverage Tracking | Codecov (permissive) | Codecov (enforced) | None | Codecov (enforced) |
| Container Scanning | **None** | Trivy | Trivy | Trivy |
| Security SAST | Gosec + Semgrep | CodeQL | None | CodeQL |
| Agent Rules | **Excellent** | Good | None | None |
| Multi-arch | **4 architectures** | 1 | 3 | 2 |
| Pre-commit | **Comprehensive** | Basic | None | Basic |
| PR Docker Build | **Yes + dry-run** | Yes | N/A | Yes |
| Commit Lint | **Conventional** | None | None | None |

**eval-hub Stands Out In**: Test coverage ratio, agent documentation quality, multi-architecture builds, comprehensive pre-commit hooks, conventional commit enforcement, BDD test breadth, and Semgrep security rule coverage.

**eval-hub Needs Improvement In**: Container vulnerability scanning, coverage threshold enforcement, and Gosec failure blocking.

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yml` — Main CI pipeline
- `.github/workflows/ci-mcp.yml` — MCP CI (path-filtered)
- `.github/workflows/ci-python-server.yml` — Python server wheel CI
- `.github/workflows/ci-python-mcp.yml` — Python MCP wheel CI
- `.github/workflows/commitlint.yml` — Conventional commit enforcement
- `.github/workflows/validate-configs.yml` — Config validation
- `.github/workflows/required-reviewer-approvals.yml` — Reviewer policy
- `.tekton/odh-eval-hub-pull-request.yaml` — Konflux Tekton pipeline

### Testing
- `tests/features/*.feature` — BDD feature files (8 core features)
- `tests/features/*_test.go` — FVT step definitions
- `tests/mlflow/features/` — MLflow integration tests
- `tests/mcp/features/` — MCP integration tests
- `tests/kubernetes/features/` — Kubernetes FVT
- `pkg/**/*_test.go` — Package unit tests
- `internal/**/*_test.go` — Internal unit tests
- `cmd/**/*_test.go` — Command entry point tests

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks
- `.cz.toml` — Commitizen configuration
- `semgrep.yaml` — Semgrep security rules (40+ rules)
- `.gitleaks.toml` — Gitleaks secret detection config
- `codecov.yml` — Coverage configuration

### Container Images
- `Containerfile` — Development/community container build
- `Dockerfile.konflux` — Production FIPS-compliant container build
- `.dockerignore` — Docker build context exclusions

### Agent Rules
- `CLAUDE.md` — CVE fixing guidance
- `AGENTS.md` — Full repository guide for AI agents
- `.claude/rules/evalhub-service.md` — API service rules (path-scoped)
- `.claude/rules/evalhub-mcp-service.md` — MCP service rules (path-scoped)
