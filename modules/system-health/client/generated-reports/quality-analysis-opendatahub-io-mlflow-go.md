---
repository: "opendatahub-io/mlflow-go"
overall_score: 6.1
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Excellent unit test coverage with httptest-based mocking, table-driven tests, and thorough edge case validation"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Comprehensive integration tests covering full lifecycle, multi-backend (SQLite + PostgreSQL), workspace isolation, and pagination"
  - dimension: "Build Integration"
    score: 2.0
    status: "No PR-time container build, no Konflux simulation, no image validation — library repo, but missing release artifact validation"
  - dimension: "Image Testing"
    score: 1.0
    status: "No Dockerfile, no container image builds, no image testing — acceptable for a Go SDK library"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "No coverage generation, no codecov integration, no coverage thresholds or PR reporting"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "Single well-structured workflow with lint/vet/unit/integration jobs, but missing concurrency control, caching, and security scanning"
  - dimension: "Agent Rules"
    score: 1.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules for test automation — .gitignore actively excludes them"
critical_gaps:
  - title: "No test coverage tracking or enforcement"
    impact: "Cannot measure test quality or prevent regressions — no visibility into coverage trends"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No security scanning in CI"
    impact: "Dependency vulnerabilities and code security issues not caught before merge"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No concurrency control on CI workflows"
    impact: "Redundant CI runs waste resources when multiple pushes happen in quick succession"
    severity: "MEDIUM"
    effort: "30 minutes"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents generating tests or code have no project-specific guidance, leading to inconsistent patterns"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add codecov integration with coverage generation"
    effort: "2-4 hours"
    impact: "Instant visibility into coverage trends and PR-level reporting"
  - title: "Add concurrency control to CI workflow"
    effort: "30 minutes"
    impact: "Cancel redundant CI runs on rapid pushes, saving compute"
  - title: "Add Go module caching to CI"
    effort: "30 minutes"
    impact: "Faster CI execution by caching go module downloads"
  - title: "Add gosec/CodeQL security scanning"
    effort: "1-2 hours"
    impact: "Catch security vulnerabilities before merge"
recommendations:
  priority_0:
    - "Add coverage generation (-coverprofile) and codecov integration to CI"
    - "Add dependency vulnerability scanning (govulncheck or Dependabot)"
  priority_1:
    - "Add concurrency control and Go module caching to CI workflow"
    - "Add gosec security scanning as a dedicated CI job"
    - "Create CLAUDE.md with project-specific testing guidelines"
  priority_2:
    - "Add pre-commit hooks for formatting and linting"
    - "Add golangci-lint result caching in CI"
    - "Consider adding fuzz tests for template variable substitution"
---

# Quality Analysis: mlflow-go

## Executive Summary

- **Overall Score: 6.1/10**
- **Repository Type**: Go SDK / Library
- **Language**: Go 1.24
- **Key Strengths**: Excellent unit test design with httptest mocking and table-driven tests; comprehensive integration test suite covering full API lifecycle, multi-backend (SQLite + PostgreSQL), workspace isolation, and midstream fork compatibility; well-structured Makefile with clear CI targets; strong ADR documentation
- **Critical Gaps**: No coverage tracking/enforcement, no security scanning, no concurrency control in CI, no agent rules
- **Agent Rules Status**: Missing — .gitignore actively excludes `.claude/` and `CLAUDE.md`

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Excellent coverage with httptest mocking, table-driven tests, edge cases |
| Integration/E2E | 8.0/10 | Full lifecycle tests, multi-backend, workspace isolation |
| **Build Integration** | **2.0/10** | **No container builds or release artifact validation** |
| Image Testing | 1.0/10 | N/A — pure Go library, no container images |
| Coverage Tracking | 2.0/10 | No coverage generation, no codecov, no thresholds |
| CI/CD Automation | 7.0/10 | Solid workflow but missing caching, concurrency, security |
| Agent Rules | 1.0/10 | No agent rules; .gitignore excludes them |

## Critical Gaps

### 1. No Test Coverage Tracking or Enforcement
- **Impact**: Cannot measure test quality, track coverage trends, or prevent regressions. No visibility into which code paths are tested.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The `test/unit` target uses `go test -v -race ./...` but does not generate coverage profiles. No codecov/coveralls integration exists. No coverage thresholds are set.
- **Fix**: Add `-coverprofile=coverage.out -covermode=atomic` to unit test command, add codecov upload step to CI.

### 2. No Security Scanning in CI
- **Impact**: Dependency vulnerabilities and code security issues (injection, unsafe operations) not caught before merge.
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: While `.golangci.yml` enables `gosec` as a linter, there is no dedicated security scanning job (CodeQL, govulncheck, Dependabot, Trivy). The repository has no `.gitleaks.toml` for secret detection.
- **Fix**: Add `govulncheck` to CI, enable Dependabot for Go modules, consider CodeQL.

### 3. No Concurrency Control on CI Workflows
- **Impact**: When multiple pushes happen in quick succession (common during PR iteration), all CI runs execute fully, wasting compute.
- **Severity**: MEDIUM
- **Effort**: 30 minutes
- **Fix**: Add `concurrency: group: ${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress: true` to the workflow.

### 4. No Agent Rules for AI-Assisted Development
- **Impact**: AI code assistants have no project-specific guidance for test patterns, error handling conventions, or the httptest mocking pattern used throughout.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: The `.gitignore` actively excludes `.claude/` and `CLAUDE.md`, suggesting a deliberate decision. However, this means agents will produce inconsistent test patterns.

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
```yaml
# Add to test-unit job
- name: Run unit tests
  run: go test -v -race -coverprofile=coverage.out -covermode=atomic ./...

- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    file: coverage.out
    fail_ci_if_error: true
```

### 2. Add Concurrency Control (30 minutes)
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 3. Add Go Module Caching (30 minutes)
The `actions/setup-go@v5` action caches by default when `go-version-file` is set. Verify this is working by checking CI logs for cache hits.

### 4. Add govulncheck (1 hour)
```yaml
vulnerability-check:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-go@v5
      with:
        go-version-file: 'go.mod'
    - name: Run govulncheck
      run: go install golang.org/x/vuln/cmd/govulncheck@latest && govulncheck ./...
```

## Detailed Findings

### CI/CD Pipeline

**Workflow**: Single `.github/workflows/go.yaml` with 5 jobs:
1. `lint` — golangci-lint, go vet, gofmt check, go mod tidy check
2. `test-unit` — Unit tests with race detector
3. `test-integration` — Integration tests against SQLite (ephemeral MLflow server)
4. `test-integration-postgres` — Integration tests against PostgreSQL (Docker container)
5. `test-integration-midstream` — Integration tests against Red Hat midstream fork with workspace isolation

**Strengths**:
- All 5 jobs run on both `push` to main and `pull_request` to main
- Race detector enabled for all test runs
- Integration tests use isolated databases with automatic cleanup
- PostgreSQL tests use Docker container with health checks
- Midstream tests verify workspace isolation with pre-created workspaces

**Gaps**:
- No concurrency control — redundant runs not cancelled
- No Go module caching configured explicitly (may be implicit with setup-go)
- No coverage reporting
- No security scanning job
- No release automation or tag-triggered builds

### Test Coverage

**Unit Tests (7 files, ~3,300 lines of test code)**:
- `mlflow/client_test.go` (210 lines) — Client initialization, URI handling, env vars, insecure mode, singleton patterns
- `mlflow/tracking/client_test.go` (1,176 lines) — All tracking API methods tested with httptest mock servers. Covers success paths, empty input validation, not-found errors, pagination, batch operations
- `mlflow/promptregistry/client_test.go` — Prompt loading, registration, tags, aliases, chat prompts via httptest
- `mlflow/promptregistry/prompt_test.go` (224 lines) — Clone/immutability, WithTemplate/WithTag chaining, ModelConfig deep copy
- `mlflow/promptregistry/format_test.go` (200 lines) — Variable substitution, missing vars, text vs chat detection
- `internal/transport/http_test.go` (496 lines) — HTTP client, error mapping, timeout, context cancellation, logging, secret redaction
- `internal/errors/api_test.go` (296 lines) — All error type checkers with table-driven tests

**Test-to-Code Ratio**: ~1.8:1 (5,105 test lines / 2,783 source lines) — **Excellent**

**Integration Tests (2 files, ~1,200 lines)**:
- `test/integration/tracking_test.go` — Full experiment lifecycle, run lifecycle, batch logging, search with filters, pagination, not-found errors, tag deletion
- `test/integration/prompt_registry_test.go` — Full prompt lifecycle, alias round-trip, version management, workspace isolation, tag deletion, list/filter operations

**Test Quality**:
- Tests use `//go:build integration` build tags for proper separation
- Each test creates unique resources with `time.Now().UnixNano()` suffixes
- Proper cleanup with `t.Cleanup()`
- Context timeouts on all integration tests (30s)
- httptest-based unit tests mock the full HTTP layer

### Code Quality

**Linting**: `.golangci.yml` (v2) enables 7 additional linters beyond defaults:
- `gocritic` — Opinionated code analysis
- `gosec` — Security rules (with G104 excluded)
- `misspell` — Spelling corrections
- `prealloc` — Slice pre-allocation suggestions
- `revive` — Extensible linter (exported names rule disabled)
- `unconvert` — Unnecessary conversions
- `unparam` — Unused function parameters

Linter exclusions are reasonable: test files excluded from errcheck/gocritic/gosec, generated code excluded entirely.

**Formatting**: `gofmt` and `goimports` enforced via golangci-lint formatters section and CI check.

**Go Vet**: Run with all analyzers enabled except `fieldalignment`.

**Pre-commit Hooks**: None configured.

**Static Analysis**: gosec runs as part of golangci-lint, but no dedicated SAST (CodeQL, Semgrep).

### Container Images

Not applicable — this is a pure Go SDK library. No Dockerfiles, Containerfiles, or image builds. The repository does use Docker in CI for the PostgreSQL integration tests (`docker run postgres:16`).

### Security

**Current**:
- gosec enabled in golangci-lint (with G104 exclusion — unhandled errors in non-critical paths)
- `.gitignore` excludes `.env.local` (credential file)
- Transport layer tests verify secrets are not logged (`TestClient_LogsNeverIncludeSecrets`)
- HTTP-by-default is rejected; requires explicit `WithInsecure()` opt-in

**Missing**:
- No dependency vulnerability scanning (govulncheck, Dependabot)
- No secret detection (Gitleaks, TruffleHog)
- No CodeQL or SAST
- No signed releases

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No test type rules exist
- **Quality**: N/A
- **Gaps**: `.gitignore` explicitly excludes `.claude/` and `CLAUDE.md`, which means even if rules exist locally, they are not committed to the repository
- **Recommendation**: Consider removing the `.gitignore` exclusion for `.claude/` and creating rules that document the httptest mocking pattern, table-driven test conventions, build tag usage (`//go:build integration`), and cleanup patterns (`t.Cleanup`)

## Recommendations

### Priority 0 (Critical)
1. **Add coverage generation and codecov integration** — Currently zero visibility into code coverage. Add `-coverprofile` flag and codecov upload. This is the single highest-ROI change.
2. **Add dependency vulnerability scanning** — Enable `govulncheck` in CI and/or Dependabot for automated security alerts on Go module dependencies.

### Priority 1 (High Value)
3. **Add concurrency control to CI** — Prevent redundant workflow runs on rapid PR updates.
4. **Add gosec as a dedicated CI step** — While it runs via golangci-lint, a dedicated security scanning job (or CodeQL) provides better visibility.
5. **Create agent rules** — Document the project's testing patterns (httptest mocking, build tags, t.Cleanup, table-driven tests) so AI-assisted development produces consistent code. Remove `.claude/` from `.gitignore`.

### Priority 2 (Nice-to-Have)
6. **Add pre-commit hooks** — Enforce formatting and linting locally before push.
7. **Add fuzz tests** — The `substituteVars` function in `format.go` handles user-provided template strings and would benefit from Go 1.18+ fuzz testing.
8. **Add release automation** — Tag-triggered workflow to create GitHub releases with Go module proxy notification.
9. **Consider adding Dependabot** — Automated dependency update PRs.

## Comparison to Gold Standards

| Practice | mlflow-go | odh-dashboard | notebooks | kserve |
|----------|-----------|---------------|-----------|--------|
| Unit test coverage | Strong (8.5) | Strong (9) | Moderate (6) | Strong (9) |
| Integration tests | Strong (8.0) | Strong (9) | Moderate (6) | Strong (9) |
| Coverage enforcement | Missing (2) | Strong (9) | Weak (4) | Strong (9) |
| Security scanning | Minimal (3) | Strong (8) | Moderate (6) | Strong (8) |
| CI/CD maturity | Adequate (7) | Strong (9) | Strong (8) | Strong (9) |
| Agent rules | Missing (1) | Strong (9) | Missing (1) | Missing (1) |
| Pre-commit hooks | Missing (0) | Present (7) | Missing (0) | Present (7) |
| Container testing | N/A | Strong (8) | Strong (9) | Strong (8) |

## File Paths Reference

### CI/CD
- `.github/workflows/go.yaml` — Single CI workflow with 5 jobs

### Testing
- `mlflow/client_test.go` — Root client unit tests
- `mlflow/tracking/client_test.go` — Tracking API unit tests
- `mlflow/promptregistry/client_test.go` — Prompt registry unit tests
- `mlflow/promptregistry/prompt_test.go` — Prompt type unit tests
- `mlflow/promptregistry/format_test.go` — Variable substitution tests
- `internal/transport/http_test.go` — HTTP transport unit tests
- `internal/errors/api_test.go` — Error type unit tests
- `test/integration/tracking_test.go` — Tracking integration tests
- `test/integration/prompt_registry_test.go` — Prompt registry integration tests

### Code Quality
- `.golangci.yml` — Linter configuration (v2, 7 extra linters)
- `Makefile` — Build, test, lint, and dev server targets

### Documentation
- `README.md` — Comprehensive usage documentation
- `docs/adr/` — 9 Architecture Decision Records
- `.env.local.example` — Example credential configuration
