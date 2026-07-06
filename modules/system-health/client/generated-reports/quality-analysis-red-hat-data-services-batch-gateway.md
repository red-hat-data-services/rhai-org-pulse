---
repository: "red-hat-data-services/batch-gateway"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Excellent coverage with 52 unit test files, 1.6:1 test-to-source LOC ratio, table-driven tests with subtests"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Comprehensive E2E suite (15 files, 5.3k LOC) with Kind cluster, 7-matrix integration tests, regression test suite"
  - dimension: "Build Integration"
    score: 5.0
    status: "No PR-time Docker build validation; Konflux Dockerfiles exist but no CI simulation; image builds only on main/tag push"
  - dimension: "Image Testing"
    score: 5.5
    status: "Multi-arch builds (amd64/arm64) with docker-bake, Konflux variants for RHOAI, but no runtime image validation or startup tests"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "Makefile has coverage targets but no CI integration, no Codecov/Coveralls, no coverage thresholds or PR reporting"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "Well-organized workflows with concurrency control, matrix builds, auto-labeling, Dependabot, Prow integration, failure auto-issue"
  - dimension: "Agent Rules"
    score: 6.0
    status: "CLAUDE.md exists with good code conventions but no .claude/rules/ directory, no test-specific agent rules"
critical_gaps:
  - title: "No coverage tracking in CI"
    impact: "Cannot detect coverage regressions; no visibility into which code paths are untested"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No PR-time Docker build validation"
    impact: "Dockerfile issues discovered only after merge when CI release or Konflux runs"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container image runtime validation"
    impact: "Image startup failures, missing binaries, or wrong entrypoints not caught until deployment"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "Integration tests not run on PRs"
    impact: "E2E regressions discovered only on main pushes or nightly runs, not before merge"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container vulnerability scanning"
    impact: "Known CVEs in base images or dependencies ship without detection"
    severity: "HIGH"
    effort: "1-2 hours"
quick_wins:
  - title: "Add Codecov integration to pre-commit workflow"
    effort: "2-3 hours"
    impact: "Immediate coverage visibility on every PR with threshold enforcement"
  - title: "Add Trivy container scanning to CI release workflow"
    effort: "1-2 hours"
    impact: "Automated CVE detection before images are pushed to registry"
  - title: "Add Docker build smoke test to PR workflow"
    effort: "2-3 hours"
    impact: "Catch Dockerfile syntax errors and build failures before merge"
  - title: "Create .claude/rules/ with test creation guidance"
    effort: "2-3 hours"
    impact: "Consistent AI-generated tests following project patterns (table-driven, subtests, pgxmock)"
recommendations:
  priority_0:
    - "Add Codecov/Coveralls integration with coverage thresholds and PR reporting"
    - "Add Trivy or Snyk container scanning to CI release pipeline"
    - "Run integration tests on PRs (currently only on push to main/release/nightly)"
  priority_1:
    - "Add PR-time Docker build validation for all three images (apiserver, processor, gc)"
    - "Add container image startup/health-check validation after build"
    - "Create .claude/rules/ directory with test automation rules for unit, integration, E2E, and regression tests"
    - "Add CodeQL/SAST workflow for deeper static analysis"
  priority_2:
    - "Add SBOM generation to container build pipeline"
    - "Add image signing/attestation (cosign/sigstore)"
    - "Add performance regression testing in CI using existing benchmark infrastructure"
    - "Add Gitleaks for secret detection in pre-commit"
---

# Quality Analysis: batch-gateway

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository**: [red-hat-data-services/batch-gateway](https://github.com/red-hat-data-services/batch-gateway)
- **Type**: Go microservice (3 binaries: apiserver, batch-processor, batch-gc)
- **Language**: Go (18.1k source LOC)
- **Framework**: OpenAI-compatible batch API gateway for llm-d

### Key Strengths
- **Excellent test suite**: 52 unit test files with 29.3k LOC (1.6:1 test-to-source ratio), comprehensive E2E suite (15 files, 5.3k LOC), dedicated regression and integration test suites
- **Well-organized CI/CD**: Concurrency-controlled workflows, matrix-based integration testing (7 configurations), automatic failure-to-issue creation, Dependabot, Prow integration
- **Strong code quality**: golangci-lint v2 with 7 linters + custom ruleguard rules, comprehensive pre-commit hooks (12 hooks), gosec security scanner
- **Mature project infrastructure**: CODEOWNERS, semantic PR titles, DCO enforcement, Helm chart with template tests, Grafana dashboards, Prometheus alerts

### Critical Gaps
- No coverage tracking or enforcement in CI
- No PR-time Docker build validation
- No container vulnerability scanning (Trivy/Snyk)
- Integration/E2E tests don't run on PRs — only on main pushes and nightly schedule
- No `.claude/rules/` directory for AI agent test guidance

### Agent Rules Status: Partial
- `CLAUDE.md` exists with comprehensive code conventions
- No `.claude/` directory or test-specific agent rules

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Excellent coverage — 52 test files, 29.3k test LOC, table-driven with subtests, pgxmock for DB |
| Integration/E2E | 8.0/10 | Comprehensive E2E (15 files, Kind cluster, 7-matrix), integration + regression suites |
| **Build Integration** | **5.0/10** | **No PR-time Docker builds; Konflux Dockerfiles exist but untested in CI** |
| Image Testing | 5.5/10 | Multi-arch (amd64/arm64) via docker-bake, distroless + UBI9 bases, but no runtime validation |
| Coverage Tracking | 3.0/10 | `make test-coverage` exists but not integrated into CI; no thresholds or PR reporting |
| CI/CD Automation | 8.5/10 | Well-organized: concurrency, matrix, auto-labeling, Dependabot, Prow, auto-issue on failure |
| Agent Rules | 6.0/10 | CLAUDE.md with strong conventions, but no `.claude/rules/` for test automation guidance |

**Weighted Overall: 7.6/10** (Unit 20%, Integration/E2E 25%, Image 20%, Coverage 15%, CI/CD 20%)

## Critical Gaps

### 1. No Coverage Tracking in CI
- **Impact**: Cannot detect coverage regressions; teams have no visibility into untested code paths
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The Makefile has `test-coverage` and `test-coverage-func` targets that generate `coverage.out` and HTML reports, but these are never run in CI. No Codecov/Coveralls integration exists. No coverage thresholds are enforced. PRs can merge with declining coverage unnoticed.
- **Fix**: Add Codecov action to the pre-commit workflow with a `coverage.yml` config setting minimum thresholds.

### 2. Integration/E2E Tests Not Run on PRs
- **Impact**: E2E regressions discovered only on main pushes or the 3 AM UTC nightly run — too late to catch before merge
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The `ci-integration-tests.yml` workflow only triggers on `push` to main/release branches and on schedule. PRs get unit tests + linting (via pre-commit) but not the full E2E suite. This means API contract breaks, database migration issues, and multi-backend compatibility problems slip through to main.
- **Fix**: Add `pull_request` trigger to `ci-integration-tests.yml` (at least for a subset of the matrix), or add a lightweight integration test job to `pre-commit.yml`.

### 3. No PR-time Docker Build Validation
- **Impact**: Dockerfile syntax errors, missing build args, and broken multi-stage builds discovered only after merge when CI release or Konflux runs
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The repository has 6 Dockerfiles (3 standard + 3 Konflux variants) across 3 binaries. Image builds only happen on push to main or tag creation (`ci-release.yaml`). PRs that modify Go source, Dockerfiles, or dependencies never validate that images still build.
- **Fix**: Add a `docker build --target builder` (build-only, no push) step to the PR workflow for each Dockerfile.

### 4. No Container Vulnerability Scanning
- **Impact**: Known CVEs in base images (golang:1.26, distroless, UBI9) or Go dependencies ship without detection
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: No Trivy, Snyk, or Grype scanning in any workflow. No `.trivyignore` file. The `gosec` pre-commit hook catches Go-level security issues but not container-level CVEs. The Konflux Dockerfiles use pinned UBI9 digests (good practice) but without scanning, new CVEs in those images go undetected.
- **Fix**: Add `aquasecurity/trivy-action` to the CI release workflow, scanning each built image before push.

### 5. No SAST/CodeQL Workflow
- **Impact**: Deep static analysis findings (data flow bugs, injection risks) are not caught
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: gosec runs in pre-commit but is optional ("skipping" if not installed). No CodeQL, Semgrep, or other SAST tools are configured as required CI checks. Gosec in pre-commit is a good start but doesn't provide the deep data-flow analysis CodeQL offers.

## Quick Wins

### 1. Add Codecov Integration (2-3 hours)
Add coverage reporting to the pre-commit workflow:
```yaml
- name: Run tests with coverage
  run: go test -coverprofile=coverage.out -race ./...

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v5
  with:
    file: ./coverage.out
    fail_ci_if_error: true
```

Create `.codecov.yml`:
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

### 2. Add Trivy Container Scanning (1-2 hours)
Add to `ci-release.yaml` after image build:
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'ghcr.io/llm-d/batch-gateway-apiserver:${{ steps.meta.outputs.commit_sha }}'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'
```

### 3. Add PR-time Docker Build Smoke Test (2-3 hours)
Add a job to `pre-commit.yml`:
```yaml
docker-build:
  runs-on: ubuntu-latest
  strategy:
    matrix:
      target: [apiserver, processor, gc]
  steps:
    - uses: actions/checkout@v7
    - uses: docker/setup-buildx-action@v4
    - name: Build image (no push)
      run: docker build -f docker/Dockerfile.${{ matrix.target }} .
```

### 4. Create Agent Test Rules (2-3 hours)
Generate `.claude/rules/` with test patterns specific to this codebase using `/test-rules-generator`. This would codify the existing CLAUDE.md conventions (table-driven tests, subtests, pgxmock patterns) into actionable rules for AI agents.

## Detailed Findings

### CI/CD Pipeline

**Workflows (16 total)**:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pre-commit.yml` | PR + push to main | Unit tests, linting, golangci-lint, pre-commit hooks, integration tests, Helm lint |
| `ci-integration-tests.yml` | Push to main + nightly + manual | Full E2E with Kind cluster, 7-matrix configs (S3/FS, PostgreSQL/Redis/Valkey) |
| `ci-release.yaml` | Push to main + tags | Multi-arch Docker image build + push via docker-bake |
| `create-release.yml` | Tag push | Cross-platform binary builds, Helm chart packaging, GitHub release |
| `ci-dco-signoff.yml` | PR | DCO signature verification |
| `ci-signed-commits.yml` | PR | Signed commit verification |
| `auto-label-pr.yml` | PR | Semantic PR title validation + auto-labeling |
| `non-main-gatekeeper.yml` | Manual only | Branch protection (currently disabled for collaboration) |
| `prow-github.yml` | Issue comment | Prow command integration via llm-d-infra |
| `prow-pr-automerge.yml` | PR review/label | Prow-style auto-merge |
| `prow-pr-remove-lgtm.yml` | PR sync | Remove LGTM on new pushes |
| `stale.yml` / `unstale.yml` | Schedule/label | Stale issue management |
| `copilot-setup-steps.yml` | Manual | GitHub Copilot agent setup |

**Strengths**:
- Concurrency control on all PR-triggered workflows with `cancel-in-progress: true`
- Go module caching via `actions/setup-go` with `cache: true`
- Comprehensive matrix testing (7 backend combinations: S3/FS storage, PostgreSQL/Redis/Valkey DB, Redis/Valkey exchange)
- Auto-issue creation on integration test failure with CODEOWNERS assignment
- Dependabot configured for Go modules, GitHub Actions, and Docker base images
- Semantic PR title enforcement with auto-labeling

**Gaps**:
- E2E tests only run on main push/nightly, not on PRs
- No Docker build validation on PRs
- No coverage reporting in any workflow
- No container scanning

### Test Coverage

**Unit Tests (52 files, 29.3k LOC)**:
- Covering all major packages: `apiserver` (handlers, middleware, config), `database` (PostgreSQL, Redis), `files_store` (S3, FS, retry), `gc` (collector, config, reconciler), `processor` (worker stages, metrics, config), `shared/openai` (API types), `util` (retry, semaphore, TLS, Redis, OTel)
- Uses `pgxmock` for PostgreSQL mock testing
- Table-driven tests with `t.Run()` subtests (enforced by CLAUDE.md)
- Race detection enabled by default (`TEST_FLAGS ?= -race`)
- Benchmark support (`make bench` with configurable `BENCHTIME`)

**Integration Tests (7 files, 1.5k LOC)**:
- In-process server tests with mock backends (`//go:build integration` tag)
- Tests: batch operations, file operations, error responses, multi-tenancy, S3 client, inference client
- Uses `httptest.NewServer` for test isolation
- Run in pre-commit workflow on PRs (good!)

**E2E Tests (15 files, 5.3k LOC)**:
- Full Kind cluster deployment with real backends (MinIO/S3, PostgreSQL, Redis/Valkey)
- 7-matrix configurations covering all backend combinations
- Test areas: batches lifecycle, AIMD concurrency control, flow control, file operations, GC, Helm upgrades, multi-tenancy, observability (OTel), orphan recovery, graceful shutdown
- Separate go.mod for E2E (isolated dependencies)
- Auto-detection of DB/exchange client types from Helm releases
- Run ID generation for test isolation
- **Gap**: Only runs on main push and nightly, not on PRs

**Regression Tests (5 files, 371 LOC)**:
- Schema compatibility testing against golden files
- Bug regression guards (prevents recurrence of fixed bugs)
- Tests: batch schema, file schema, error response schema

**Helm Chart Tests (6 files)**:
- Template tests for apiserver ConfigMap, deployments, GC ConfigMap, HTTPRoute, observability, processor ConfigMap
- Uses helm-unittest plugin

**Test-to-Code Ratio**: 1.6:1 (test LOC / source LOC) — excellent

### Code Quality

**golangci-lint v2** with 7 enabled linters:
- `depguard` — bans stdlib `log` in non-test code (enforces logr usage)
- `errcheck` — with sensible exclusions for read-only Close operations
- `forbidigo` — bans klog logging functions (enforces logr)
- `gocritic` — with custom ruleguard rules (`tools/rules.go`)
- `govet`, `staticcheck`, `unused`

**Pre-commit hooks (12 hooks)**:
- Standard: trailing-whitespace, end-of-file-fixer, check-yaml, check-added-large-files, check-merge-conflict, check-case-conflict
- Go: go-fmt, go-unit-tests, go-build, go-mod-tidy, go-vet, goimports
- Security: gosec (optional — skips if not installed)
- Helm: helm-unittest (optional)
- **Note**: golangci-lint and gosec are optional in pre-commit (skip if not installed) but golangci-lint runs as a required step in the CI workflow

**Typo checking**: `_typos.toml` present (crate.io `typos` tool configuration)

### Container Images

**Build Configuration**:
- 6 Dockerfiles: 3 standard (`Dockerfile.{apiserver,processor,gc}`) + 3 Konflux variants (`.konflux`)
- Standard: `quay.io/projectquay/golang:1.26` builder → `gcr.io/distroless/static:nonroot` runtime
- Konflux: `registry.access.redhat.com/ubi9/go-toolset:1.25.8` (pinned digest) → `ubi9/ubi-minimal:9.7` (pinned digest)
- Konflux builds enable FIPS with `GOEXPERIMENT=strictfipsruntime`
- Multi-arch support: `linux/amd64` + `linux/arm64` via docker-bake.hcl
- Layer caching via registry-based buildcache
- OCI labels with image metadata
- Non-root user in all images (65532 or 1001)
- `.dockerignore` present

**Gaps**:
- No runtime validation (health check, binary existence, startup test)
- No vulnerability scanning
- No SBOM generation
- No image signing/attestation

### Security

**Strengths**:
- `gosec` integrated in pre-commit (SAST for Go)
- Custom `depguard` rules prevent insecure logging patterns
- `forbidigo` prevents klog usage (enforces structured logging)
- Non-root containers with minimal base images
- Pinned digests for Konflux base images
- DCO sign-off enforcement
- Signed commit verification
- Dependabot for dependency updates (Go, Actions, Docker)

**Gaps**:
- No container vulnerability scanning (Trivy/Snyk/Grype)
- No CodeQL/SAST workflow (gosec is a subset)
- No secret detection (Gitleaks/TruffleHog)
- No `.trivyignore` or vulnerability allowlist
- gosec is optional in pre-commit (skips if not installed)

### Agent Rules (Agentic Flow Quality)

**Status**: Partial

**CLAUDE.md** (present, comprehensive):
- General principles: think before coding, simplicity first, surgical changes
- Detailed code conventions: logging (logr), interfaces, errors (wrap with %w), test patterns (table-driven, subtests), struct initialization, goroutine management, early return, no panic, no os.Exit outside main, no mutable globals, type assertions, no init(), defer for cleanup
- Build & verify commands
- Local testing instructions for all test tiers

**`.claude/` directory**: Not present
**`.claude/rules/`**: Not present

**Gaps**:
- No test-specific agent rules (unit test patterns, integration test setup, E2E test conventions)
- No rules for pgxmock usage patterns
- No rules for mock vs. real backend selection
- No rules for regression test golden file management
- **Recommendation**: Generate rules with `/test-rules-generator` to codify existing patterns

### Observability

**Strengths**:
- Prometheus ServiceMonitor for apiserver
- PodMonitor for processor and GC
- Grafana dashboards ConfigMap
- PrometheusRule with alerting (e.g., `BatchGatewayHighQueueWait`)
- OpenTelemetry integration (E2E tests validate OTel traces via Jaeger)
- Metrics endpoint testing in E2E suite

## Recommendations

### Priority 0 (Critical)

1. **Add Codecov integration with coverage thresholds** — 2-3 hours
   - Upload `coverage.out` from pre-commit workflow
   - Set project target at 70%, patch target at 80%
   - Block PRs that drop coverage below threshold

2. **Add Trivy container vulnerability scanning** — 1-2 hours
   - Scan all three images (apiserver, processor, gc) after build
   - Fail on CRITICAL/HIGH severity CVEs
   - Upload SARIF results to GitHub Security tab

3. **Run E2E tests on PRs** — 2-4 hours
   - Add `pull_request` trigger to `ci-integration-tests.yml`
   - Consider running a subset of the matrix (e.g., default config only) to keep PR feedback fast
   - Full matrix on main push/nightly

### Priority 1 (High Value)

4. **Add PR-time Docker build validation** — 4-6 hours
   - Build all 6 Dockerfiles (3 standard + 3 Konflux) on PRs touching Go source or Dockerfiles
   - Build-only (no push) to validate compilation and Dockerfile correctness
   - Add path filters to avoid unnecessary builds

5. **Add container runtime validation** — 4-6 hours
   - After build, run each image and verify it starts and responds to health checks
   - Validate binary exists at expected path
   - Check entrypoint works with `--version` or `--help` flag

6. **Create `.claude/rules/` with test automation rules** — 2-3 hours
   - Unit test rules: table-driven patterns, pgxmock usage, error wrapping assertions
   - Integration test rules: build tag requirement, mock backend setup, httptest patterns
   - E2E test rules: Kind cluster assumptions, test isolation, helper usage
   - Regression test rules: golden file management, schema compatibility
   - Use `/test-rules-generator` for automated generation

7. **Add CodeQL SAST workflow** — 2-3 hours
   - Configure for Go language analysis
   - Run on PRs and push to main
   - Upload results to GitHub Security tab

### Priority 2 (Nice-to-Have)

8. **Add SBOM generation** — 2-3 hours
   - Generate CycloneDX or SPDX SBOM for each container image
   - Attach as build artifacts

9. **Add image signing with cosign** — 3-4 hours
   - Sign images after push using sigstore keyless signing
   - Verify signatures in deployment pipelines

10. **Add Gitleaks for secret detection** — 1-2 hours
    - Add to pre-commit hooks and CI workflow
    - Configure `.gitleaks.toml` with project-specific allowlist

11. **Integrate benchmarks in CI** — 4-6 hours
    - Run benchmarks on main push and compare against baseline
    - Flag performance regressions in PR comments
    - Existing benchmark infrastructure (`benchmarks/`) is well-structured

## Comparison to Gold Standards

| Capability | batch-gateway | odh-dashboard | notebooks | kserve |
|-----------|:---:|:---:|:---:|:---:|
| Unit Tests | 8.5 | 9.0 | 7.0 | 9.0 |
| Integration Tests | 8.0 | 9.0 | 7.0 | 9.0 |
| E2E on PRs | No | Yes | Yes | Yes |
| Coverage Enforcement | No | Yes | No | Yes |
| Container Scanning | No | Yes | Yes | Yes |
| Multi-arch Build | Yes | Yes | Yes | Yes |
| Pre-commit Hooks | Yes (12) | Yes | No | Yes |
| SAST/CodeQL | Partial (gosec) | Yes | No | Yes |
| Helm Chart Tests | Yes (6) | N/A | N/A | Yes |
| Agent Rules | Partial | Yes | No | No |
| Observability | Yes (Grafana + Prometheus + OTel) | Yes | No | Yes |
| Regression Tests | Yes (5 files) | No | No | No |
| Benchmark Suite | Yes | No | No | Yes |
| Dependabot | Yes | Yes | No | Yes |
| DCO/Signed Commits | Yes | Yes | No | Yes |

**batch-gateway stands out** for its regression test suite, benchmark infrastructure, observability integration (Grafana dashboards, Prometheus alerts, OTel), and Helm chart testing. Its main gaps vs. gold standards are coverage enforcement, container scanning, and running E2E tests on PRs.

## File Paths Reference

### CI/CD
- `.github/workflows/pre-commit.yml` — PR checks (unit tests, lint, integration tests, Helm)
- `.github/workflows/ci-integration-tests.yml` — E2E tests (main push + nightly)
- `.github/workflows/ci-release.yaml` — Docker image build + push
- `.github/workflows/create-release.yml` — GitHub release creation
- `.github/workflows/auto-label-pr.yml` — Semantic PR title + auto-labeling
- `.github/dependabot.yml` — Dependency updates

### Testing
- `internal/**/*_test.go` — 44 unit test files
- `pkg/**/*_test.go` — 8 unit test files
- `test/e2e/` — 15 E2E test files (Kind cluster)
- `test/integration/` — 7 integration test files (in-process)
- `test/regression/` — 5 regression test files (schema compat)
- `charts/batch-gateway/tests/` — 6 Helm chart test files

### Code Quality
- `.golangci.yml` — 7 linters with custom ruleguard
- `.pre-commit-config.yaml` — 12 hooks
- `tools/rules.go` — Custom ruleguard rules
- `_typos.toml` — Typo checker config

### Container Images
- `docker/Dockerfile.apiserver` — Standard apiserver image
- `docker/Dockerfile.apiserver.konflux` — Konflux/RHOAI apiserver image
- `docker/Dockerfile.processor` — Standard processor image
- `docker/Dockerfile.processor.konflux` — Konflux/RHOAI processor image
- `docker/Dockerfile.gc` — Standard GC image
- `docker/Dockerfile.gc.konflux` — Konflux/RHOAI GC image
- `docker-bake.hcl` — Multi-image, multi-arch build config

### Agent Rules
- `CLAUDE.md` — Code conventions and build/test commands

### Observability
- `charts/batch-gateway/templates/grafana-dashboards-configmap.yaml`
- `charts/batch-gateway/templates/prometheus-rule.yaml`
- `charts/batch-gateway/templates/apiserver-servicemonitor.yaml`
- `charts/batch-gateway/templates/gc-podmonitor.yaml`
- `charts/batch-gateway/templates/processor-podmonitor.yaml`
