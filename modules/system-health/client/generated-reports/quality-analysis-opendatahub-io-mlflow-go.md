---
repository: "opendatahub-io/mlflow-go"
overall_score: 6.1
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Excellent unit test coverage with 149+ test functions, table-driven tests, httptest mocks, and race detector enabled"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Strong integration suite testing against live MLflow (SQLite + PostgreSQL + midstream), build-tag isolation, CI-automated lifecycle"
  - dimension: "Build Integration"
    score: 2.0
    status: "No Dockerfile, no PR-time image build, no Konflux simulation, no container validation"
  - dimension: "Image Testing"
    score: 1.0
    status: "Pure Go library - no container images built or tested; no runtime image validation"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "No coverage file generation, no codecov/coveralls integration, no coverage thresholds or PR reporting"
  - dimension: "CI/CD Automation"
    score: 7.5
    status: "Single well-structured workflow with lint/unit/integration jobs; missing concurrency control, caching, and coverage upload"
  - dimension: "Agent Rules"
    score: 1.0
    status: "No .claude directory, no CLAUDE.md, no agent rules; .gitignore actively excludes them"
critical_gaps:
  - title: "No test coverage tracking or enforcement"
    impact: "Cannot measure or enforce minimum coverage; regressions go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container image or build integration testing"
    impact: "If project ever ships as a container (e.g., sidecar, gRPC bridge), no validation infrastructure exists"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "No security scanning in CI"
    impact: "Dependency vulnerabilities, secret leaks, and SAST issues not detected before merge"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents generate inconsistent tests; no guidance on project patterns, naming, or frameworks"
    severity: "MEDIUM"
    effort: "3-4 hours"
  - title: "CI workflow lacks concurrency control"
    impact: "Multiple PR pushes can run redundant CI jobs, wasting resources"
    severity: "LOW"
    effort: "30 minutes"
quick_wins:
  - title: "Add coverage generation and upload to codecov"
    effort: "2-3 hours"
    impact: "Instant visibility into coverage trends and per-PR delta reporting"
  - title: "Add go-vuln-check or Trivy scanning to CI"
    effort: "1-2 hours"
    impact: "Detect known vulnerabilities in Go dependencies before merge"
  - title: "Add concurrency control to CI workflow"
    effort: "30 minutes"
    impact: "Cancel stale CI runs when a new push arrives on the same PR"
  - title: "Add Dependabot or Renovate for dependency updates"
    effort: "1 hour"
    impact: "Automated security patches and dependency freshness"
  - title: "Generate CLAUDE.md and .claude/rules/ for test patterns"
    effort: "2-3 hours"
    impact: "Consistent AI-generated tests that follow project conventions"
recommendations:
  priority_0:
    - "Add coverage generation (-coverprofile) and upload to Codecov with thresholds"
    - "Add govulncheck or Trivy to CI for dependency vulnerability scanning"
    - "Add gosec as a standalone CI step (currently only via golangci-lint with G104 excluded)"
  priority_1:
    - "Add concurrency control and Go module caching to CI workflow"
    - "Create .claude/rules/ with unit-test and integration-test patterns from existing code"
    - "Add Dependabot/Renovate for automated dependency updates"
    - "Add pre-commit hooks for fmt/vet/lint local enforcement"
  priority_2:
    - "Add benchmarks for HTTP client and protobuf serialization paths"
    - "Add fuzz testing for template substitution and error parsing"
    - "Create Dockerfile for potential sidecar/bridge deployment scenarios"
    - "Add CodeQL or Semgrep for deeper SAST coverage"
---

# Quality Analysis: mlflow-go

## Executive Summary

**Overall Score: 6.1/10**

The `opendatahub-io/mlflow-go` repository is a Go SDK for the MLflow tracking and prompt registry APIs. It is a **pure Go library** (no container images, no operator, no web UI) with a surprisingly strong testing culture for its size. The project demonstrates excellent engineering practices in unit and integration testing, but has significant gaps in coverage tracking, security scanning, and CI/CD maturity.

**Key Strengths:**
- Exceptional test-to-code ratio (5,232 test lines / 3,442 source lines = **1.52x**)
- 169 test functions covering both unit and integration scenarios
- Integration tests run against real MLflow servers (SQLite, PostgreSQL, and midstream fork)
- Well-configured golangci-lint v2 with 7+ linters including gosec
- Thoughtful ADR (Architecture Decision Record) documentation (9 ADRs)
- Race detector enabled for all test runs

**Critical Gaps:**
- Zero coverage tracking or enforcement (no codecov, no thresholds, no PR reporting)
- No security scanning in CI (no govulncheck, no Trivy, no CodeQL, no Dependabot)
- No agent rules or AI development guidance
- CI workflow missing concurrency control and caching

**Agent Rules Status:** Missing - `.gitignore` actively excludes `.claude/` and `CLAUDE.md`

---

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Excellent coverage: 149 unit tests, table-driven, httptest mocks, race detector |
| Integration/E2E | 8.0/10 | Strong: live MLflow server tests (SQLite + PostgreSQL + midstream), build-tag isolation |
| Build Integration | 2.0/10 | N/A for library; no Dockerfile, no image builds, no Konflux pipeline |
| Image Testing | 1.0/10 | Pure library; no container images built or tested |
| Coverage Tracking | 2.0/10 | No coverage generation, no codecov, no thresholds, no PR delta |
| CI/CD Automation | 7.5/10 | Single workflow with 5 jobs; missing concurrency, caching, coverage upload |
| Agent Rules | 1.0/10 | No .claude directory, no CLAUDE.md, no agent rules |

---

## Critical Gaps

### 1. No Test Coverage Tracking or Enforcement
- **Severity:** HIGH
- **Impact:** Cannot measure code coverage, track trends, or enforce minimum thresholds. Regressions in test quality go undetected.
- **Current State:** `go test -v -race ./...` runs tests but produces no coverage output. No `.codecov.yml` or coveralls configuration exists.
- **Effort:** 2-4 hours
- **Fix:** Add `-coverprofile=coverage.out -covermode=atomic` to test commands, upload to Codecov, set thresholds.

### 2. No Security Scanning in CI
- **Severity:** HIGH
- **Impact:** Dependency vulnerabilities (Go modules), leaked secrets, and code-level security issues are not caught before merge.
- **Current State:** `gosec` runs via golangci-lint but excludes `G104` (unhandled errors) and does not run on test files. No dedicated security scan job exists.
- **Effort:** 2-3 hours
- **Fix:** Add `govulncheck`, Trivy, and Dependabot/Renovate.

### 3. No Container/Build Integration Testing
- **Severity:** MEDIUM (library project)
- **Impact:** If the project evolves to include a container (sidecar, gRPC bridge, CLI binary), there is no infrastructure to validate builds.
- **Current State:** No Dockerfile, Containerfile, or build automation. This is acceptable for a pure library but becomes a gap if deployment targets change.
- **Effort:** 4-8 hours (when needed)

### 4. No Agent Rules for AI-Assisted Development
- **Severity:** MEDIUM
- **Impact:** AI code assistants generate tests and code without awareness of project patterns (table-driven tests, httptest mocks, build-tag conventions for integration tests).
- **Current State:** `.gitignore` excludes `.claude/` and `CLAUDE.md`. No `AGENTS.md` or other agent guidance exists.
- **Effort:** 3-4 hours
- **Fix:** Create `.claude/rules/` with unit-test-patterns.md and integration-test-patterns.md derived from existing codebase.

### 5. CI Missing Concurrency Control
- **Severity:** LOW
- **Impact:** Multiple pushes to a PR branch trigger redundant CI runs that waste GitHub Actions minutes.
- **Current State:** No `concurrency` block in the CI workflow.
- **Effort:** 30 minutes

---

## Quick Wins

### 1. Add Coverage Generation and Codecov Upload (2-3 hours)
Add `-coverprofile` to test commands and upload to Codecov:
```yaml
- name: Run unit tests
  run: go test -v -race -coverprofile=coverage.out -covermode=atomic ./...

- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    file: ./coverage.out
    token: ${{ secrets.CODECOV_TOKEN }}
```

### 2. Add govulncheck to CI (1-2 hours)
```yaml
vulnerability-check:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-go@v5
      with:
        go-version-file: 'go.mod'
    - name: Install govulncheck
      run: go install golang.org/x/vuln/cmd/govulncheck@latest
    - name: Run vulnerability check
      run: govulncheck ./...
```

### 3. Add Concurrency Control (30 minutes)
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 4. Add Dependabot (1 hour)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "gomod"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 5. Generate Agent Rules (2-3 hours)
Run `/test-rules-generator` on this repository to create `.claude/rules/` with patterns for unit tests (table-driven, httptest) and integration tests (build tags, live server setup).

---

## Detailed Findings

### CI/CD Pipeline

**Workflow: `.github/workflows/go.yaml`** (single workflow, 5 jobs)

| Job | Trigger | What It Does |
|-----|---------|-------------|
| `lint` | push/PR to main | golangci-lint, go vet, gofmt check, go mod tidy check |
| `test-unit` | push/PR to main | `go test -v -race ./...` (all non-integration tests) |
| `test-integration` | push/PR to main | Starts MLflow (SQLite), runs integration tests, cleans up |
| `test-integration-postgres` | push/PR to main | Starts PostgreSQL + MLflow, runs integration tests |
| `test-integration-midstream` | push/PR to main | Tests against opendatahub-io/mlflow fork with workspaces |

**Strengths:**
- All 5 jobs run on every PR - comprehensive gating
- Integration tests are self-contained (start/stop MLflow server, clean up test data)
- Multiple backend testing (SQLite + PostgreSQL) catches storage-specific bugs
- Midstream testing validates compatibility with Red Hat fork
- Race detector enabled everywhere

**Gaps:**
- No concurrency control - stale runs waste resources
- No Go module caching (`actions/cache` or `actions/setup-go` cache)
- No coverage collection or upload
- No security scanning job
- No dependency update automation
- Jobs run sequentially rather than using `needs:` dependency graph (though this is implicit since they're independent)

### Test Coverage

**Unit Tests (7 files, 149 unit test functions, 3,871 lines):**

| File | Tests | Lines | Key Patterns |
|------|-------|-------|-------------|
| `mlflow/tracking/client_test.go` | 41 | 1,175 | httptest server mocks, table-driven, error case coverage |
| `mlflow/promptregistry/client_test.go` | 35 | 1,275 | httptest mocks, CRUD lifecycle, permission testing |
| `internal/transport/http_test.go` | 15 | 495 | Context cancellation, timeout, logging, auth headers |
| `internal/errors/api_test.go` | 8 | 295 | Error type assertions, sentinel checks |
| `mlflow/promptregistry/prompt_test.go` | 11 | 223 | Clone deep-copy, chaining API, nil safety |
| `mlflow/client_test.go` | 12 | 209 | URI parsing, env var handling, insecure mode |
| `mlflow/promptregistry/format_test.go` | 11 | 199 | Template substitution, chat/text format, variable handling |

**Integration Tests (2 files, 20 test functions, 1,361 lines):**

| File | Tests | Lines | Scope |
|------|-------|-------|-------|
| `test/integration/prompt_registry_test.go` | 12 | 754 | Full prompt lifecycle, CRUD, aliases, tags, workspace isolation |
| `test/integration/tracking_test.go` | 8 | 607 | Experiment/run lifecycle, log batch, search, pagination |

**Test-to-Code Ratio:**
- Source code (excl. generated): 3,442 lines
- Test code: 5,232 lines
- **Ratio: 1.52x** (excellent - more test code than source code)

**Testing Patterns:**
- Table-driven tests with `t.Run()` subtests
- `httptest.NewServer` for HTTP mocking (no external mock libraries)
- `//go:build integration` build tags for test isolation
- Context with timeout for integration tests
- Cleanup via `t.Cleanup()` for resource teardown
- Environment variable handling via `t.Setenv()`

**Missing:**
- No coverage file generation (`-coverprofile`)
- No benchmark tests
- No fuzz tests
- No example tests (`ExampleXxx`)

### Code Quality

**Linting: `.golangci.yml` (v2)**
- **7 extra linters enabled:** gocritic, gosec, misspell, prealloc, revive, unconvert, unparam
- **errcheck** with type-assertions and blank checking
- **govet** with all analyzers enabled (except fieldalignment)
- **Formatters:** gofmt + goimports
- Generated code excluded via `internal/gen/` path filter
- Test-relaxed rules: errcheck, gocritic, gosec excluded for `_test.go` files

**Makefile (comprehensive):**
- `make check` = lint + vet + unit tests (full local validation)
- `make fmt` / `make tidy` for formatting and module hygiene
- Lazy tool installation (golangci-lint, protoc-gen-go, uv)

**Missing:**
- No `.pre-commit-config.yaml`
- No CodeQL or Semgrep
- No secret detection (gitleaks, trufflehog)
- No Dependabot/Renovate

### Container Images

**Status: Not Applicable (Pure Library)**

This repository is a Go SDK/library. It has:
- No Dockerfile or Containerfile
- No container build automation
- No image registry publishing
- No multi-architecture build support

This is **appropriate** for a pure library. The gap would become critical if the project adds a CLI tool, sidecar container, or gRPC bridge service.

### Security

**Current State:**
- `gosec` runs via golangci-lint but excludes `G104` (unhandled error returns)
- `.env.local` is gitignored (credentials not committed)
- `.env.local.example` uses placeholder values
- No dedicated security scanning in CI
- No dependency vulnerability scanning
- No secret detection
- No SBOM generation

**Positive:**
- Transport layer logs never include auth tokens (tested in `TestClient_LogsNeverIncludeSecrets`)
- Token masking is explicitly tested
- TLS verification is enforced by default (InsecureSkipVerify requires explicit opt-in)

### Agent Rules (Agentic Flow Quality)

**Status:** Missing

- **`.claude/` directory:** Does not exist; `.gitignore` excludes it
- **`CLAUDE.md`:** Does not exist; `.gitignore` excludes it
- **`AGENTS.md`:** Does not exist
- **`.claude/rules/`:** Does not exist
- **Agent test guidance:** None

**Impact:** AI code assistants will not know to:
- Use `httptest.NewServer` for mocking (not external mock libraries)
- Apply `//go:build integration` tags for integration tests
- Follow the table-driven test pattern with `t.Run()`
- Use `t.Cleanup()` for resource teardown
- Test error sentinels via `errors.Is()`

**Recommendation:** Generate agent rules via `/test-rules-generator` and remove `.claude/` and `CLAUDE.md` from `.gitignore`.

### Documentation

**Architecture Decision Records (9 ADRs):**
- `0001-authentication-pattern.md`
- `0002-error-type-design.md`
- `0003-resilience-strategy.md`
- `0004-prompt-type-abstraction.md`
- `0005-flat-package-structure.md`
- `0006-protobuf-strategy.md`
- `0007-python-sdk-naming-alignment.md`
- `0008-oss-only-target-platform.md`
- `0009-experiment-tracking.md`

This is an unusually strong ADR practice for a project of this size. The ADRs document critical design decisions including authentication, error handling, package structure, and platform targeting.

**README:** 648 lines - comprehensive with usage examples, architecture explanation, and development setup instructions.

---

## Recommendations

### Priority 0 (Critical)
1. **Add coverage generation and Codecov integration** - Add `-coverprofile=coverage.out -covermode=atomic` to CI and upload to Codecov. Set minimum threshold (e.g., 70%) and require PR delta reporting.
2. **Add govulncheck to CI** - Detect known vulnerabilities in Go module dependencies before merge.
3. **Add standalone gosec scanning** - Currently runs via golangci-lint with exclusions. Add a dedicated job for full security analysis.

### Priority 1 (High Value)
4. **Add CI concurrency control and Go module caching** - Cancel stale runs, speed up builds with `actions/setup-go` cache.
5. **Create `.claude/rules/`** - Generate agent rules from existing test patterns using `/test-rules-generator`. Remove `.claude/` from `.gitignore`.
6. **Add Dependabot or Renovate** - Automate Go module and GitHub Actions dependency updates.
7. **Add pre-commit hooks** - Enforce fmt, vet, and lint locally before push.

### Priority 2 (Nice-to-Have)
8. **Add benchmark tests** - Benchmark HTTP client round-trip, protobuf serialization, and template substitution.
9. **Add fuzz testing** - Fuzz `substituteVars()` and error parsing for edge cases.
10. **Add CodeQL/Semgrep** - Deeper SAST analysis beyond gosec.
11. **Add gitleaks** - Detect accidental secret commits in CI.
12. **Prepare container infrastructure** - When deployment targets emerge, have Dockerfile and build pipeline templates ready.

---

## Comparison to Gold Standards

| Dimension | mlflow-go | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | 8.5 - Excellent ratio, table-driven | 9.0 - Multi-layer, contract | 7.0 - Notebook-focused | 9.0 - Envtest, CRD |
| Integration/E2E | 8.0 - Live server, multi-backend | 9.0 - Cypress E2E | 8.0 - Image validation | 9.0 - Multi-version |
| Build Integration | 2.0 - N/A (library) | 7.0 - PR builds | 8.0 - Image builds | 7.0 - Operator builds |
| Image Testing | 1.0 - N/A (library) | 6.0 - Basic | 9.0 - 5-layer validation | 7.0 - Runtime tests |
| Coverage Tracking | 2.0 - None | 8.0 - Codecov + thresholds | 5.0 - Basic | 9.0 - Enforcement |
| CI/CD Automation | 7.5 - Single workflow | 9.0 - Multi-workflow | 8.0 - Multi-arch | 9.0 - Comprehensive |
| Agent Rules | 1.0 - None | 8.0 - Rules + skills | 3.0 - Basic | 2.0 - None |

---

## File Paths Reference

| Category | Path | Notes |
|----------|------|-------|
| CI Workflow | `.github/workflows/go.yaml` | Single workflow, 5 jobs |
| Lint Config | `.golangci.yml` | v2, 7 extra linters |
| Go Module | `go.mod` | Go 1.24, protobuf dependency |
| Makefile | `Makefile` | 20+ targets, comprehensive |
| Unit Tests | `mlflow/**/*_test.go`, `internal/**/*_test.go` | 7 files, 149 functions |
| Integration Tests | `test/integration/*_test.go` | 2 files, 20 functions |
| ADRs | `docs/adr/*.md` | 9 architectural decisions |
| Sample App | `sample-app/main.go` | Usage examples |
| Protobuf | `internal/gen/`, `tools/proto/` | Generated types |
| Scripts | `scripts/seed.sh` | Test data seeding |
| Env Example | `.env.local.example` | Credential template |
