---
repository: "eval-hub/eval-hub"
overall_score: 8.3
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "Exceptional test-to-code ratio (1.8:1 lines), 114 test files covering all packages with race detection"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "14 BDD feature files with godog, multi-domain FVT (API, MCP, MLflow, K8s, GPU), MCP e2e scripts"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time Docker build + dry-run, multi-platform wheel validation, but no Konflux simulation"
  - dimension: "Image Testing"
    score: 7.5
    status: "Multi-stage Containerfile, PR docker-build-check with dry-run, multi-arch push, but no Trivy/SBOM"
  - dimension: "Coverage Tracking"
    score: 8.5
    status: "Codecov integration with unit + FVT coverage, range thresholds (50-75%), fail_ci_if_error: true"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "13 workflows, path-filtered triggers, Go caching, cross-platform matrix builds, commit linting"
  - dimension: "Agent Rules"
    score: 8.0
    status: "CLAUDE.md + AGENTS.md + 2 service rules + 1 custom skill, comprehensive architecture docs"
critical_gaps:
  - title: "No container vulnerability scanning (Trivy/Snyk/Grype)"
    impact: "CVEs in base images or dependencies not caught before deployment"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No SBOM generation or image signing"
    impact: "Cannot verify supply chain integrity; missing for compliance frameworks"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No PR-time Konflux build simulation"
    impact: "Konflux-specific build failures discovered only post-merge"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "Gosec runs with -no-fail flag"
    impact: "Security findings don't block PRs; vulnerabilities can be merged"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No golangci-lint configuration"
    impact: "Only go vet runs; missing dozens of linters (staticcheck, errcheck, gosimple, etc.)"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add Trivy container scanning to CI workflow"
    effort: "1-2 hours"
    impact: "Catch CVEs in base images and Go dependencies before merge"
  - title: "Add golangci-lint with standard linter set"
    effort: "2-3 hours"
    impact: "Catch bugs, style issues, and anti-patterns go vet misses (errcheck, staticcheck, unused, etc.)"
  - title: "Remove -no-fail from gosec and make security scan a required check"
    effort: "30 minutes"
    impact: "Security findings actually block PRs instead of being informational-only"
  - title: "Add codecov coverage thresholds to PR comments"
    effort: "1 hour"
    impact: "Developers see coverage delta on every PR, preventing regression"
  - title: "Add test rules for agent-generated code (.claude/rules/testing.md)"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality with project-specific patterns"
recommendations:
  priority_0:
    - "Add container vulnerability scanning (Trivy) to PR and push workflows"
    - "Configure golangci-lint with comprehensive linter set (errcheck, staticcheck, gosimple, unused, goconst)"
    - "Remove -no-fail from gosec to make security findings blocking"
  priority_1:
    - "Add SBOM generation (syft/cyclonedx) and image signing (cosign) to image push workflow"
    - "Create .claude/rules/testing.md with project-specific test patterns and FVT conventions"
    - "Add coverage threshold enforcement (e.g., fail if coverage drops below 50%)"
    - "Implement Gitleaks or TruffleHog for secret detection in CI"
  priority_2:
    - "Add PR-time Konflux build simulation for production parity"
    - "Add contract tests between eval-hub and eval-hub-sdk"
    - "Add performance/load testing for evaluation API endpoints"
    - "Implement upgrade testing beyond TODO stubs in Makefile"
---

# Quality Analysis: eval-hub

## Executive Summary

- **Overall Score: 8.3/10**
- **Repository Type**: Go REST API service for LLM evaluation orchestration
- **Primary Language**: Go 1.26 with Python wheel packaging
- **Framework**: Standard library `net/http`, godog BDD testing, Kubernetes operator integration
- **Key Strengths**: Exceptional test-to-code ratio (1.8:1), comprehensive BDD test suites across 5 domains (API, MCP, MLflow, K8s, GPU), well-organized CI/CD with 13 workflows, strong agent rules and documentation, PR-time Docker build validation with dry-run
- **Critical Gaps**: No container vulnerability scanning, no SBOM/signing, gosec runs non-blocking, no golangci-lint
- **Agent Rules Status**: Present and comprehensive (CLAUDE.md, AGENTS.md, 2 service-specific rules, 1 custom skill)

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 9.0/10 | Exceptional test-to-code ratio (1.8:1), 114 test files, race detection enabled |
| Integration/E2E | 9.0/10 | 14 BDD feature files, multi-domain FVT, MCP e2e scripts, VS Code integration tests |
| Build Integration | 7.0/10 | PR-time Docker build + dry-run, wheel validation, but no Konflux simulation |
| Image Testing | 7.5/10 | Multi-stage build, PR dry-run, multi-arch (amd64/arm64), but no vulnerability scanning |
| Coverage Tracking | 8.5/10 | Codecov with unit + FVT profiles, range thresholds (50-75%), fail_ci_if_error: true |
| CI/CD Automation | 9.0/10 | 13 workflows, path filtering, Go caching, matrix builds, commit linting, reviewer checks |
| Agent Rules | 8.0/10 | CLAUDE.md + AGENTS.md + 2 rules + 1 skill, comprehensive architecture and testing docs |

## Critical Gaps

### 1. No Container Vulnerability Scanning
- **Impact**: CVEs in UBI9 base images, Go dependencies, or transitive dependencies not caught before deployment
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The `Containerfile` uses `registry.access.redhat.com/ubi9/go-toolset:1.26` and `ubi9/ubi-minimal:latest`. Neither Trivy, Snyk, Grype, nor any container scanning tool runs in CI. Images are pushed to Quay.io without vulnerability assessment.

### 2. No SBOM Generation or Image Signing
- **Impact**: Cannot verify supply chain integrity; missing for SLSA/compliance frameworks
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No `syft`, `cyclonedx-gomod`, or equivalent generates an SBOM. No `cosign` signing or attestation on pushed images.

### 3. Gosec Runs Non-Blocking
- **Impact**: Security findings are informational only; vulnerabilities can be merged
- **Severity**: MEDIUM
- **Effort**: 30 minutes
- **Details**: In `ci.yml`, gosec runs with `-no-fail`, meaning it always exits 0. Results upload to GitHub Security tab but never block a PR.

### 4. No golangci-lint Configuration
- **Impact**: Only `go vet` runs as linting. Missing errcheck, staticcheck, gosimple, unused, goconst, and ~40+ other available linters
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: No `.golangci.yaml` or `.golangci.yml` found. The Makefile `lint` target just runs `go vet ./...`. This misses entire categories of bugs like unchecked errors, unused code, and simplification opportunities.

### 5. Upgrade Tests Are Stub-Only
- **Impact**: No automated validation of upgrade paths between versions
- **Severity**: MEDIUM
- **Effort**: 8-16 hours
- **Details**: Makefile has `run-pre-upgrade`, `run-post-upgrade-verify`, `run-post-upgrade`, and `run-post-upgrade-cleanup` targets, but all contain `@echo "TODO"` and generate empty JUnit XML.

## Quick Wins

### 1. Add Trivy Container Scanning (1-2 hours)
Add to `ci.yml` after `docker-build-check`:
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: evalhub:pr-check
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
- name: Upload Trivy SARIF
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: 'trivy-results.sarif'
```

### 2. Add golangci-lint (2-3 hours)
Create `.golangci.yml` with recommended Go linters:
```yaml
linters:
  enable:
    - errcheck
    - staticcheck
    - gosimple
    - unused
    - goconst
    - gocritic
    - gofmt
    - misspell
    - noctx
```

### 3. Make Gosec Blocking (30 minutes)
Remove `-no-fail` from the gosec args in `ci.yml`:
```yaml
args: '-fmt sarif -out gosec-results.sarif ./...'
```

### 4. Add Codecov PR Comments (1 hour)
Update `codecov.yml` to include comment configuration:
```yaml
comment:
  layout: "reach,diff,flags,tree"
  behavior: default
  require_changes: false
```

### 5. Add Agent Test Rules (2-3 hours)
Create `.claude/rules/testing.md` covering FVT patterns, godog conventions, and test naming standards.

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (13 workflows)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | PR + push | Main CI: quality checks, unit+FVT coverage, API docs, security scan, Docker build |
| `ci-mcp.yml` | PR + push (path-filtered) | MCP-specific format, vet, unit tests, multi-platform build |
| `ci-python-mcp.yml` | PR (path-filtered) | MCP Python wheel build + sanity test |
| `ci-python-server.yml` | PR (path-filtered) | Server Python wheel build + sanity test |
| `commitlint.yml` | PR | Conventional commit enforcement via commitizen |
| `validate-configs.yml` | PR + push | Validates provider/collection YAML configs |
| `required-reviewer-approvals.yml` | PR | Ensures requested reviewers have approved |
| `publish-python-server.yml` | push main + tags | Cross-platform wheel build, validation, PyPI publish |
| `publish-python-mcp.yml` | push main + tags | MCP cross-platform wheel build, validation, PyPI publish |
| `release-mcp.yml` | tag push | Multi-platform binary build, checksums, GitHub Release |
| `check-trustyai-service-operator-configmap-sync.yml` | push + nightly | Cross-repo ConfigMap sync check |

**Strengths**:
- Excellent path-based filtering reduces unnecessary CI runs
- Go module caching via `setup-go` with `cache: true`
- All actions pinned to full SHA hashes (supply chain security)
- Cross-platform matrix builds (linux/darwin/windows, amd64/arm64)
- Conventional commit enforcement via commitizen
- Required reviewer approval checks
- API documentation validation (Redocly)
- `persist-credentials: false` on all checkouts

**Gaps**:
- No concurrency control (could cancel stale runs on same PR)
- No test results caching between workflows
- No dependency caching for Python/uv in all workflows

### Test Coverage

**Unit Tests (9.0/10)**:
- 114 test files across all packages
- 35,059 lines of test code vs. 19,467 lines of source code (1.8:1 ratio - exceptional)
- Standard Go `testing` package with `t.Parallel()` guidance
- Race detection enabled (`-race` flag in CI)
- Packages covered: handlers, config, storage/SQL, serialization, metrics, server, runtimes (k8s + local), MCP server, OTel, logging, platform, client libraries

**Integration/FVT Tests (9.0/10)**:
- 14 BDD feature files using godog
- 5 test domains:
  1. **Core API** (8 features): health, evaluations, providers, collections, metrics, GPU resources
  2. **MCP Server** (4 features): server, tools, resources, prompts
  3. **MLflow** (1 feature): experiments
  4. **Kubernetes** (1 feature): kubernetes resources
  5. **GPU** (included in core): GPU resource management
- Tag-based test selection (`@cluster`, `@local_runtime`, `@mlflow`, `@negative`, `@gha-wheel-sanity`)
- FVT runs against started server (`test-fvt-server`)
- Coverage collected from FVT runs via coverage-instrumented binary (`build-coverage`)
- MCP e2e scripts (4 bash scripts covering stdio, HTTP, error scenarios, e2e workflow)
- VS Code/Cursor MCP integration tests

**Coverage Tracking (8.5/10)**:
- Codecov integration with `fail_ci_if_error: true`
- Three coverage profiles uploaded: unit (`coverage.out`), FVT (`coverage-fvt.out`), init (`coverage-init.out`)
- Range thresholds: 50% (red-yellow) to 75% (yellow-green)
- Coverage treemap generation available (`make coverage-treemap`)
- Coverage HTML reports generated locally

### Code Quality

**Linting (5/10)**:
- Only `go vet` and `gofmt` run
- No `.golangci.yaml` - missing errcheck, staticcheck, gosimple, unused, goconst, and 40+ other linters
- Format check validates code is properly formatted in CI

**Pre-commit Hooks (8/10)**:
- `.pre-commit-config.yaml` configured with:
  - Standard hooks: trailing-whitespace, end-of-file-fixer, check-yaml, check-json, check-toml, check-merge-conflict, check-added-large-files (1MB), debug-statements
  - No-commit-to-main protection on push
  - Commitizen conventional commit message enforcement
  - Local hook runs `make test test-fvt` on Go files
- Missing: gofmt/goimports hook, golangci-lint hook, secret detection

**Static Analysis (6/10)**:
- Gosec security scanner runs in CI (SARIF output to GitHub Security tab)
- BUT runs with `-no-fail` (never blocks PRs)
- No CodeQL/SAST beyond gosec
- No dependency scanning (Dependabot/Renovate not configured in repo)
- CodeRabbit AI review configured (`.coderabbit.yaml`)
- Markdownlint configured

**Commit Standards (9/10)**:
- Conventional commits enforced via commitizen (`.cz.toml`)
- Commit lint workflow in CI
- AI assistance attribution guidance in AGENTS.md
- Signed-off-by trailer required

### Container Images

**Build Process (8/10)**:
- Multi-stage Containerfile:
  - Builder: `ubi9/go-toolset:1.26` with platform-aware cross-compilation
  - Runtime: `ubi9/ubi-minimal:latest` (minimal attack surface)
  - Builds 4 binaries: eval-hub, eval-runtime-sidecar, eval-runtime-init, evalhub-mcp
- CGO_ENABLED=0 for static binaries
- Non-root user (UID 1000) with dedicated group
- OCI labels for metadata
- Multi-architecture support (linux/amd64, linux/arm64 via QEMU + Buildx)
- Build args for versioning (BUILD_NUMBER, BUILD_DATE, GIT_HASH)
- Good `.dockerignore` excluding tests, docs, CI, IDE files

**PR Validation (7/10)**:
- `docker-build-check` job builds image on PRs
- Dry-run validates image startup: `docker run --rm evalhub:pr-check /app/eval-hub --local --help`
- Same dry-run on push after multi-arch build and push

**Security Scanning (2/10)**:
- No Trivy, Snyk, Grype, or any container scanning
- No SBOM generation
- No image signing or attestation
- No `.trivyignore` configuration
- Quay.io tag expiration set for non-tag builds (12 weeks)

### Security Practices

**Strengths**:
- Gosec SAST scanner integrated (SARIF to GitHub Security tab)
- All GitHub Actions pinned to full SHA hashes
- `persist-credentials: false` on all checkout steps
- Non-root container user
- Static binary compilation (no runtime dependencies)
- kube-rbac-proxy for authentication in cluster mode

**Gaps**:
- Gosec `-no-fail` makes it advisory-only
- No dependency scanning/vulnerability alerting (Dependabot not configured)
- No secret detection (Gitleaks/TruffleHog)
- No container image scanning
- No SBOM/supply chain attestation

### Agent Rules (Agentic Flow Quality)

**Status**: Present and comprehensive

**Files**:
- `CLAUDE.md` - Root agent instructions with CVE fixing guidance
- `AGENTS.md` - Detailed architecture overview, build commands, testing strategy, git conventions
- `.claude/rules/evalhub-service.md` - Service-specific rules with ExecutionContext pattern, routing, config, and testing guidance
- `.claude/rules/evalhub-mcp-service.md` - MCP-specific build, test, and architecture rules
- `.claude/skills/fix-fvt-test/SKILL.md` - Custom skill for diagnosing and fixing FVT test failures

**Coverage**:
- Build commands: Comprehensive
- Testing strategy: Well-documented (unit, FVT, tags)
- Architecture patterns: Detailed (ExecutionContext, routing, config, metrics)
- Git conventions: Conventional commits with AI attribution
- CVE fixing: Specific guidance for Go version and npm dependency updates

**Quality**: 8/10 - Rules are detailed, actionable, and framework-specific. Include code examples and anti-patterns. Missing dedicated testing rules file for agent-generated tests.

**Gaps**:
- No `.claude/rules/testing.md` with FVT step definition patterns and test data conventions
- No rules for performance testing or load testing patterns
- No rules for contract testing between eval-hub and eval-hub-sdk

## Recommendations

### Priority 0 (Critical)

1. **Add container vulnerability scanning** - Integrate Trivy into `docker-build-check` job to catch CVEs in UBI9 base images and Go dependencies before merge
2. **Install golangci-lint** - Replace bare `go vet` with golangci-lint configured with errcheck, staticcheck, gosimple, unused, goconst, gocritic at minimum
3. **Make gosec blocking** - Remove `-no-fail` flag so security findings actually prevent merge

### Priority 1 (High Value)

4. **Add SBOM and image signing** - Use `syft` for SBOM generation and `cosign` for image signing on the push workflow
5. **Add secret detection** - Integrate Gitleaks or TruffleHog as pre-commit hook and CI check
6. **Create agent test rules** - Add `.claude/rules/testing.md` covering godog step definition patterns, test data file conventions, tag usage, and FVT best practices
7. **Add coverage threshold enforcement** - Configure codecov to fail PRs that drop coverage below the 50% floor
8. **Add Dependabot or Renovate** - Automated dependency update PRs for Go modules and GitHub Actions

### Priority 2 (Nice-to-Have)

9. **Implement upgrade test stubs** - Replace TODO markers in Makefile upgrade targets with actual pre/post-upgrade validation
10. **Add contract tests** - Validate API contract between eval-hub server and eval-hub-sdk
11. **Add CI concurrency control** - Cancel stale workflow runs on the same PR to save runner time
12. **Add performance testing** - Load testing for evaluation API endpoints (k6, vegeta, or Go benchmarks)
13. **Add PR-time Konflux simulation** - Catch production build issues before merge

## Comparison to Gold Standards

| Dimension | eval-hub | odh-dashboard | notebooks | kserve |
|-----------|----------|---------------|-----------|--------|
| Unit Tests | 9.0 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 9.0 | 9.5 | 8.0 | 9.0 |
| Build Integration | 7.0 | 8.0 | 7.0 | 7.0 |
| Image Testing | 7.5 | 8.0 | 9.0 | 7.0 |
| Coverage Tracking | 8.5 | 9.0 | 6.0 | 9.0 |
| CI/CD Automation | 9.0 | 9.0 | 8.0 | 8.5 |
| Agent Rules | 8.0 | 9.5 | 3.0 | 2.0 |
| **Vulnerability Scanning** | **2.0** | **8.0** | **9.0** | **7.0** |
| **Overall** | **8.3** | **8.8** | **7.1** | **7.6** |

**eval-hub stands out for**: Test-to-code ratio (1.8:1 is exceptional), multi-domain BDD testing, comprehensive agent rules, cross-platform wheel validation

**eval-hub needs to match gold standards on**: Container vulnerability scanning, SBOM generation, comprehensive static analysis (golangci-lint)

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yml` - Main CI pipeline
- `.github/workflows/ci-mcp.yml` - MCP CI
- `.github/workflows/ci-python-mcp.yml` - Python MCP wheel CI
- `.github/workflows/ci-python-server.yml` - Python server wheel CI
- `.github/workflows/commitlint.yml` - Commit message linting
- `.github/workflows/validate-configs.yml` - Config validation
- `.github/workflows/required-reviewer-approvals.yml` - Reviewer approval checks
- `.github/workflows/publish-python-server.yml` - PyPI publish
- `.github/workflows/publish-python-mcp.yml` - MCP PyPI publish
- `.github/workflows/release-mcp.yml` - GitHub Release
- `Makefile` - Build, test, lint, cross-compile targets

### Testing
- `tests/features/*.feature` - Core API BDD tests (8 features)
- `tests/features/*_test.go` - Step definitions and helpers
- `tests/mcp/features/*.feature` - MCP BDD tests (4 features)
- `tests/mcp/scripts/` - MCP e2e bash scripts (4 scripts)
- `tests/mcp/vscode/` - VS Code/Cursor integration tests
- `tests/mlflow/features/` - MLflow integration tests
- `tests/kubernetes/features/` - Kubernetes integration tests
- `internal/**/*_test.go` - Unit tests (90+ files)
- `pkg/**/*_test.go` - Package unit tests
- `cmd/**/*_test.go` - Command unit tests

### Code Quality
- `.pre-commit-config.yaml` - Pre-commit hooks
- `.cz.toml` - Commitizen conventional commits
- `.markdownlint.json` - Markdown linting
- `.coderabbit.yaml` - CodeRabbit AI review
- `codecov.yml` - Coverage configuration

### Container
- `Containerfile` - Multi-stage Docker build
- `.dockerignore` - Build context exclusions

### Agent Rules
- `CLAUDE.md` - Root agent instructions
- `AGENTS.md` - Architecture, build, test, and git conventions
- `.claude/rules/evalhub-service.md` - API service rules
- `.claude/rules/evalhub-mcp-service.md` - MCP service rules
- `.claude/skills/fix-fvt-test/SKILL.md` - FVT debugging skill

### Security
- `.github/workflows/ci.yml` (security-scan job) - Gosec SAST
