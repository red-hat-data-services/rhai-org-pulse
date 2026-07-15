---
repository: "opendatahub-io/eval-hub"
overall_score: 8.1
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "641 test functions across 107 test files; 1.78:1 test-to-source line ratio; comprehensive handler, storage, and runtime coverage"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "BDD godog FVT suite with 14 feature files across API, MCP, MLflow, and Kubernetes; multiple execution modes (local/remote)"
  - dimension: "Build Integration"
    score: 7.5
    status: "PR-time Docker build + dry-run validation; multi-arch push on merge; missing Konflux simulation"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage Containerfile with UBI9 base; PR dry-run check; no vulnerability scanning or SBOM"
  - dimension: "Coverage Tracking"
    score: 7.5
    status: "Codecov integration with merged unit+FVT coverage; range 50-75% thresholds configured; no PR enforcement gate"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "15 workflows covering CI, security, Python wheels, releases, config validation, commitlint, and reviewer approvals"
  - dimension: "Agent Rules"
    score: 8.0
    status: "CLAUDE.md, AGENTS.md, .claude/rules/ with service-specific rules and path-scoping; one custom skill"
critical_gaps:
  - title: "No container vulnerability scanning in CI"
    impact: "CVEs in base images or dependencies not caught until external scanning"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No PR coverage enforcement gate"
    impact: "Coverage can silently regress without blocking PRs"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No Konflux build simulation on PRs"
    impact: "Production build issues discovered only post-merge"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "Gosec security scan uses -no-fail flag"
    impact: "Security findings are uploaded to SARIF but never block PRs"
    severity: "MEDIUM"
    effort: "1 hour"
quick_wins:
  - title: "Add Trivy container scan to PR workflow"
    effort: "1-2 hours"
    impact: "Catch CVEs in base images and dependencies before merge"
  - title: "Enable codecov PR status checks with target threshold"
    effort: "30 minutes"
    impact: "Prevent coverage regressions on every PR"
  - title: "Remove -no-fail from Gosec and set severity threshold"
    effort: "30 minutes"
    impact: "Block PRs with high/critical security findings"
  - title: "Add SBOM generation to container build"
    effort: "1-2 hours"
    impact: "Supply chain transparency and compliance readiness"
recommendations:
  priority_0:
    - "Add container image vulnerability scanning (Trivy) to PR and push workflows"
    - "Enable codecov PR status checks with minimum coverage target (e.g., 70%)"
  priority_1:
    - "Remove -no-fail from Gosec or add severity-based PR gating"
    - "Add SBOM generation (Syft/Trivy) to container build pipeline"
    - "Add Konflux build simulation to PR workflow"
  priority_2:
    - "Add load/performance testing for API endpoints"
    - "Add contract tests between eval-hub API and MCP client"
    - "Expand agent rules to cover FVT/integration test patterns"
---

# Quality Analysis: eval-hub

## Executive Summary

- **Overall Score: 8.1/10**
- **Repository Type**: Go REST API service + MCP server + Python wheel distributions
- **Primary Language**: Go (1.26), with Python packaging and JavaScript (API docs)
- **Framework**: Standard library `net/http`, Kubernetes operator integration via TrustyAI
- **Agent Rules Status**: Present and well-structured

**Key Strengths**: Exceptional test coverage with 641 test functions across a 1.78:1 test-to-source ratio. Mature CI/CD with 15 GitHub Actions workflows. Strong security foundation (Gosec, Gitleaks, Semgrep, pre-commit). Comprehensive BDD FVT test suite using godog with 14 feature files.

**Critical Gaps**: No container vulnerability scanning. No PR coverage enforcement. Gosec runs in non-blocking mode. No Konflux build simulation.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 9.0/10 | 641 test functions, 107 files, 1.78:1 test-to-code ratio |
| Integration/E2E | 8.5/10 | 14 BDD feature files, godog FVT, multi-mode execution |
| **Build Integration** | **7.5/10** | **PR Docker build + dry-run; no Konflux simulation** |
| Image Testing | 7.0/10 | Multi-stage UBI9 build, dry-run check; no vuln scanning |
| Coverage Tracking | 7.5/10 | Codecov with merged coverage; no PR enforcement |
| CI/CD Automation | 9.0/10 | 15 workflows, well-organized, pinned actions |
| Agent Rules | 8.0/10 | CLAUDE.md, AGENTS.md, .claude/rules/ with path-scoped rules |

## Critical Gaps

### 1. No Container Vulnerability Scanning
- **Impact**: CVEs in UBI9 base image, Go dependencies, or runtime libraries not caught until external/downstream scanning
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Neither Trivy, Snyk, nor Grype is integrated in CI. The `docker-build-check` job validates startup but not security posture.

### 2. No PR Coverage Enforcement Gate
- **Impact**: Coverage can silently regress below the 50-75% range without blocking PRs
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: `codecov.yml` defines display ranges but no `status` checks or `target` thresholds. Coverage is uploaded but PRs are not gated.

### 3. No Konflux Build Simulation on PRs
- **Impact**: Production build issues discovered only after merge into Konflux pipeline
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Details**: The PR Docker build uses standard `docker/build-push-action` which may differ from Konflux's build environment.

### 4. Gosec Security Scan Non-Blocking
- **Impact**: Security findings are uploaded to GitHub Security tab but never fail the CI pipeline
- **Severity**: MEDIUM
- **Effort**: 1 hour
- **Details**: Gosec runs with `-no-fail` flag, meaning even critical findings don't block PRs.

## Quick Wins

### 1. Add Trivy Container Scan (1-2 hours)
- **Impact**: Catch CVEs in base images and Go binaries before merge
- **Implementation**:
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: evalhub:pr-check
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'
```

### 2. Enable Codecov PR Status Checks (30 minutes)
- **Impact**: Prevent coverage regressions on every PR
- **Implementation**: Update `codecov.yml`:
```yaml
coverage:
  status:
    project:
      default:
        target: 70%
        threshold: 2%
    patch:
      default:
        target: 80%
```

### 3. Remove -no-fail from Gosec (30 minutes)
- **Impact**: Block PRs with high/critical security findings
- **Implementation**: Change Gosec args to `-fmt sarif -out gosec-results.sarif -severity high ./...`

### 4. Add SBOM Generation (1-2 hours)
- **Impact**: Supply chain transparency, compliance readiness
- **Implementation**: Add Syft or Trivy SBOM step to Docker build job

## Detailed Findings

### CI/CD Pipeline

**Strengths (9.0/10)**:
- **15 workflows** covering all aspects: CI, security scanning, Python wheel builds/publishing, MCP releases, config validation, commit linting, and reviewer approvals
- **Well-organized**: Separate workflows for main service (`ci.yml`), MCP (`ci-mcp.yml`), Python server (`ci-python-server.yml`), and Python MCP (`ci-python-mcp.yml`)
- **Path-filtered triggers**: MCP CI only runs when MCP-related files change
- **Pinned action versions**: All GitHub Actions use SHA-pinned versions (security best practice)
- **Multi-arch builds**: `linux/amd64` and `linux/arm64` on push, with QEMU emulation
- **Cross-platform MCP binaries**: Builds for Linux, macOS, and Windows (amd64/arm64)
- **Conventional commits**: Enforced via commitizen in both pre-commit hooks and CI
- **Required reviewer approvals**: Custom workflow ensures all requested reviewers approve before merge
- **Config validation**: Dedicated workflow validates provider/collection YAML schemas
- **Branch sync**: Automated sync workflows for incubation and stable branches

**Gaps**:
- No concurrency control on PR workflows (could waste resources on rapid pushes)
- No test matrix for multiple Go versions
- Python wheel validation runs only on ubuntu-latest (no Windows/macOS CI matrix despite cross-platform builds)

### Test Coverage

**Strengths (9.0/10 unit, 8.5/10 integration)**:
- **641 test functions** across 107 test files — exceptional density
- **32,854 lines of test code** vs 18,462 lines of source code (1.78:1 ratio)
- **Comprehensive package coverage**: Tests exist for handlers, storage, runtimes (k8s, local), server, metrics, config, validation, MCP server, sidecar proxy, OpenTelemetry, platform detection, and API types
- **BDD FVT**: 14 `.feature` files with godog step definitions covering evaluations, collections, providers, health, metrics, GPU resources, Kubernetes resources, MCP tools/resources/prompts/server, and MLflow experiments
- **Tag-based test selection**: `@cluster`, `@local_runtime`, `@mlflow`, `@negative`, `@gha-wheel-sanity` tags allow selective execution
- **Dual execution modes**: FVT tests run against embedded server (default) or remote server (`SERVER_URL`)
- **Coverage merging**: CI merges unit (`coverage.out`), FVT (`coverage-fvt.out`), and init (`coverage-init.out`) into Codecov
- **Test helpers**: Dedicated `internal/testhelpers` package with shared utilities
- **Race detection**: MCP CI runs with `-race` flag

**Gaps**:
- No explicit coverage threshold enforcement (codecov range is display-only)
- No contract tests between eval-hub API and the separate eval-hub-sdk
- No performance/load testing
- No chaos/resilience testing

### Code Quality

**Strengths**:
- **Pre-commit hooks** with trailing-whitespace, end-of-file-fixer, check-yaml/json/toml, check-merge-conflict, large file check, debug-statements, and conventional commit linting
- **Go fmt + vet**: Enforced in CI with `git diff --exit-code` check
- **API documentation**: OpenAPI spec bundled and validated in CI; `make documentation` generates and verifies public docs
- **Conventional commits**: Enforced by commitizen in both pre-commit and CI commitlint workflow
- **No-commit-to-main**: Pre-push hook prevents direct commits to main

**Gaps**:
- No `golangci-lint` (uses basic `go vet` only; missing revive, staticcheck, gocritic, etc.)
- No TypeScript/JavaScript linting for API doc tooling
- No `go vet ./...` with shadow checker

### Container Images

**Strengths (7.0/10)**:
- **Multi-stage build**: Build stage with `ubi9/go-toolset:1.26`, runtime stage with `ubi9/ubi-minimal`
- **Non-root user**: Runs as UID 1000 (Kubernetes `runAsNonRoot` compatible)
- **Minimal runtime image**: `ubi-minimal` reduces attack surface
- **PR-time validation**: `docker-build-check` job builds image and runs `--help` dry-run on PRs
- **Multi-architecture**: `linux/amd64` and `linux/arm64` built with QEMU on push
- **Build caching**: Go module download in separate layer for cache efficiency
- **OCI labels**: Comprehensive metadata labels
- **Image expiration**: Non-tag images set `quay.expires-after=12w` to auto-cleanup
- **Multiple binaries**: Single image contains eval-hub, sidecar, init, and MCP binaries

**Gaps**:
- No container vulnerability scanning (Trivy, Snyk, Grype)
- No SBOM generation
- No image signing (cosign/sigstore)
- No runtime functional testing beyond `--help` dry-run

### Security

**Strengths**:
- **Gosec**: SAST scanner integrated with SARIF upload to GitHub Security tab
- **Gitleaks**: Comprehensive `.gitleaks.toml` with extensive allowlists for test fixtures
- **Semgrep**: Unified security ruleset covering Go patterns (command injection, path traversal, SSRF, unsafe crypto, SQL injection, etc.)
- **Pre-commit**: `check-merge-conflict`, `debug-statements`, `check-added-large-files`
- **Pinned actions**: All GitHub Actions use SHA-pinned versions
- **`persist-credentials: false`**: All checkout steps prevent credential leakage

**Gaps**:
- Gosec runs with `-no-fail` — findings never block PRs
- No dependency vulnerability scanning (Dependabot/Renovate alerts may exist but no CI gate)
- No container vulnerability scanning
- Semgrep rules are present but no CI workflow runs them
- Gitleaks present but no CI workflow runs it (only in `.gitleaks.toml` config)

### Agent Rules (Agentic Flow Quality)

**Strengths (8.0/10)**:
- **CLAUDE.md**: Comprehensive root-level documentation with build commands, Git conventions, and AI attribution guidance
- **AGENTS.md**: Detailed architecture overview, project structure, testing strategy, configuration system, request identity, and routing patterns
- **`.claude/rules/`**: Two path-scoped rules files:
  - `evalhub-service.md`: Build/test commands, key conventions, ExecutionContext pattern, two-tier config, logging, routing, metrics, database setup, testing strategy with unit and FVT guidance, tag documentation
  - `evalhub-mcp-service.md`: MCP-specific build/test commands, CLI flags, config precedence, testing strategy
- **Path scoping**: Rules use YAML frontmatter `paths:` to activate only for relevant file changes
- **Custom skill**: `.claude/skills/fix-fvt-test/` for FVT test fixing

**Gaps**:
- No rules for sidecar/init container development
- No rules for Python wheel packaging patterns
- No rules for OpenTelemetry instrumentation patterns
- FVT test creation patterns not deeply documented in rules (covered in README but not agent-actionable)

## Recommendations

### Priority 0 (Critical)

1. **Add container image vulnerability scanning**: Integrate Trivy in both `docker-build-check` (PR) and `docker-build-push` (merge) jobs. Set `exit-code: 1` with `severity: CRITICAL,HIGH` to gate PRs.

2. **Enable codecov PR status checks**: Add `status.project.default.target` and `status.patch.default.target` to `codecov.yml` to enforce minimum coverage on PRs.

### Priority 1 (High Value)

3. **Make Gosec blocking**: Remove `-no-fail` flag or add severity-based filtering (`-severity high`) so critical findings block PRs.

4. **Add SBOM generation**: Use Syft or Trivy to generate SBOM during container build. Attach as build artifact and optionally push to registry.

5. **Run Semgrep and Gitleaks in CI**: The config files exist but no CI workflow invokes them. Add dedicated workflow or integrate into `ci.yml`.

6. **Add `golangci-lint`**: Replace basic `go vet` with `golangci-lint` running staticcheck, revive, gocritic, errcheck, and other linters for deeper static analysis.

### Priority 2 (Nice-to-Have)

7. **Add PR concurrency control**: Use `concurrency: { group: '${{ github.workflow }}-${{ github.ref }}', cancel-in-progress: true }` to cancel stale PR runs.

8. **Add load/performance testing**: The API serves evaluation orchestration — latency regressions would impact user experience. Consider k6 or vegeta for API endpoint benchmarks.

9. **Add contract tests**: With a separate `eval-hub-sdk`, contract tests would ensure API compatibility across releases.

10. **Expand agent rules**: Add rules for sidecar/init container patterns, Python wheel packaging, and OTel instrumentation.

11. **Add Konflux build simulation**: Simulate the production Konflux build environment in PR CI to catch environment-specific build failures.

12. **Add image signing**: Use cosign/sigstore to sign built images for supply chain integrity.

## Comparison to Gold Standards

| Practice | eval-hub | odh-dashboard | notebooks | kserve |
|----------|----------|---------------|-----------|--------|
| Unit test ratio | 1.78:1 | ~1.5:1 | N/A | ~1.2:1 |
| Coverage enforcement | Display-only | PR gating | N/A | PR gating |
| BDD/FVT tests | godog (14 features) | Cypress E2E | N/A | E2E suite |
| Container scanning | None | Trivy | Trivy | Trivy |
| SAST | Gosec (non-blocking) | CodeQL | N/A | CodeQL |
| Pre-commit hooks | Yes (comprehensive) | Yes | Partial | Partial |
| Agent rules | Yes (path-scoped) | Yes (comprehensive) | No | No |
| Multi-arch builds | Yes (amd64/arm64) | Yes | Yes (5 arch) | Yes |
| Image signing | No | No | No | Partial |
| SBOM | No | No | Yes | Partial |
| Conventional commits | Yes (enforced) | No | No | No |
| API doc validation | Yes (OpenAPI CI) | Yes | N/A | Yes |

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yml` — Main CI (tests, coverage, Docker build, API docs)
- `.github/workflows/ci-mcp.yml` — MCP-specific CI with path filtering
- `.github/workflows/ci-python-server.yml` — Python server wheel CI
- `.github/workflows/ci-python-mcp.yml` — Python MCP wheel CI
- `.github/workflows/commitlint.yml` — Conventional commit enforcement
- `.github/workflows/validate-configs.yml` — Provider/collection YAML validation
- `.github/workflows/required-reviewer-approvals.yml` — Required reviewer gate
- `.github/workflows/release-mcp.yml` — MCP binary releases with checksums
- `.github/workflows/publish-python-server.yml` — Python server wheel publish (multi-platform)
- `.github/workflows/publish-python-mcp.yml` — Python MCP wheel publish (multi-platform)
- `.github/workflows/sync-branch-incubation.yaml` — Branch sync automation
- `.github/workflows/sync-branch-stable.yaml` — Branch sync automation

### Testing
- `tests/features/*.feature` — 8 BDD feature files for API FVT
- `tests/mcp/features/*.feature` — 4 BDD feature files for MCP FVT
- `tests/mlflow/features/*.feature` — 1 BDD feature file for MLflow
- `tests/kubernetes/features/*.feature` — 1 BDD feature file for K8s
- `internal/**/*_test.go` — Unit tests alongside source
- `pkg/**/*_test.go` — Package-level unit tests
- `cmd/**/*_test.go` — Entry point tests
- `.conf.go-test` — GRC colorizer for unit test output
- `.conf.go-integration-test` — GRC colorizer for integration test output

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks (formatting, linting, tests, commits)
- `.cz.toml` — Commitizen configuration
- `.markdownlint.json` — Markdown linting
- `codecov.yml` — Coverage reporting configuration

### Container Images
- `Containerfile` — Multi-stage Go build with UBI9
- `containers/lighteval/Dockerfile` — LightEval container
- `.dockerignore` — Docker build exclusions

### Security
- `semgrep.yaml` — Comprehensive Semgrep ruleset (Go security patterns)
- `.gitleaks.toml` — Gitleaks secret detection with test allowlists
- `.gitleaksignore` — Gitleaks false-positive suppressions

### Agent Rules
- `CLAUDE.md` — Root-level agent instructions
- `AGENTS.md` — Detailed architecture and development guide
- `.claude/rules/evalhub-service.md` — API service development rules (path-scoped)
- `.claude/rules/evalhub-mcp-service.md` — MCP service development rules (path-scoped)
- `.claude/skills/fix-fvt-test/` — Custom skill for FVT test fixing
