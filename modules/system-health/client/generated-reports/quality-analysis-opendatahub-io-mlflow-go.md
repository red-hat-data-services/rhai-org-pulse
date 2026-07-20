---
repository: "opendatahub-io/mlflow-go"
overall_score: 6.1
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Strong unit test coverage with table-driven tests and httptest mocking"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Comprehensive integration suite with SQLite, PostgreSQL, and midstream workspace testing"
  - dimension: "Build Integration"
    score: 2.0
    status: "No Dockerfile, no PR-time image builds, no Konflux simulation"
  - dimension: "Image Testing"
    score: 1.0
    status: "No container images built or tested — pure Go SDK library"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage generation, no codecov integration, no coverage gates"
  - dimension: "CI/CD Automation"
    score: 6.5
    status: "Good workflow structure with 5 parallel jobs but lacks caching, concurrency control, and timeout guards"
  - dimension: "Static Analysis"
    score: 6.0
    status: "Strong golangci-lint v2 config with 7 extra linters; missing Dependabot, pre-commit hooks, and FIPS build tags"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory present"
critical_gaps:
  - title: "No code coverage tracking or enforcement"
    impact: "Cannot measure test quality, regressions go undetected, no PR-level coverage feedback"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container image or build integration testing"
    impact: "When this SDK is packaged into container images downstream, build failures are discovered post-merge"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "No Dependabot or Renovate for dependency management"
    impact: "Dependency vulnerabilities and Go module updates require manual monitoring"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No agent rules for AI-assisted test creation"
    impact: "AI agents lack guidance on test patterns, frameworks, and conventions specific to this project"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add --coverprofile to unit test target and integrate Codecov"
    effort: "2-4 hours"
    impact: "Immediate visibility into test coverage with PR-level reporting and threshold enforcement"
  - title: "Enable Dependabot for Go modules"
    effort: "1 hour"
    impact: "Automated PRs for dependency updates and security patches"
  - title: "Add CI concurrency control and caching"
    effort: "1-2 hours"
    impact: "Faster CI runs, prevent duplicate workflow runs on force-pushes"
  - title: "Generate CLAUDE.md with test creation rules"
    effort: "2-3 hours"
    impact: "AI agents can consistently generate tests matching project conventions"
recommendations:
  priority_0:
    - "Add coverage generation (--coverprofile) and Codecov integration with minimum threshold (e.g., 70%)"
    - "Enable Dependabot for gomod and GitHub Actions ecosystems"
  priority_1:
    - "Add CI caching (actions/cache for Go modules), concurrency control, and timeout-minutes on all jobs"
    - "Create CLAUDE.md and .claude/rules/ with unit test and integration test creation guidelines"
    - "Add pre-commit hooks for gofmt, go vet, and go mod tidy"
  priority_2:
    - "Add Dockerfile for SDK development container (optional for library projects)"
    - "Add FIPS build tags and boringcrypto support in CI for Red Hat downstream compatibility"
    - "Add race detector and fuzz testing targets for security-sensitive code paths"
---

# Quality Analysis: mlflow-go

## Executive Summary

- **Overall Score: 6.1/10**
- **Repository Type**: Go SDK library (MLflow client)
- **Primary Language**: Go 1.24
- **Jira Component**: MLflow (RHOAIENG)
- **Tier**: Midstream (opendatahub-io)

**Key Strengths**: Excellent unit and integration test suites with table-driven tests, httptest mocking, multiple backend support (SQLite + PostgreSQL), and midstream workspace isolation testing. Strong golangci-lint v2 configuration with 7 extra linters enabled. Well-organized Makefile with clear test/dev targets.

**Critical Gaps**: No coverage tracking or enforcement anywhere in CI. No Dependabot or Renovate for dependency management. No agent rules for AI-assisted development. As a pure library (no Dockerfile), build integration and image testing dimensions are inherently limited.

**Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory.

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 8.5/10 | Strong coverage with table-driven tests and httptest mocking |
| Integration/E2E | 20% | 8.0/10 | Comprehensive suite: SQLite, PostgreSQL, midstream workspace testing |
| Build Integration | 15% | 2.0/10 | No Dockerfile, no PR-time image builds (library project) |
| Image Testing | 10% | 1.0/10 | No container images — pure Go SDK library |
| Coverage Tracking | 10% | 1.0/10 | No coverage generation, no codecov, no coverage gates |
| CI/CD Automation | 15% | 6.5/10 | 5 CI jobs, good structure; lacks caching, concurrency, timeouts |
| Static Analysis | 10% | 6.0/10 | golangci-lint v2 with 7 extra linters; no Dependabot or pre-commit |
| Agent Rules | 5% | 0.0/10 | No CLAUDE.md, AGENTS.md, or .claude/ directory |
| **Overall** | **100%** | **6.1/10** | |

## Critical Gaps

### 1. No Code Coverage Tracking or Enforcement
- **Impact**: Cannot measure test quality or detect coverage regressions across PRs
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Unit tests run with `-race` but not with `--coverprofile`. No `.codecov.yml`, no coverage thresholds, no PR-level coverage reporting. The CI workflow (`go.yaml`) runs `make test/unit` which calls `go test -v -race ./...` — adding `--coverprofile=coverage.out` and integrating `codecov/codecov-action` is straightforward.

### 2. No Dependency Management Automation
- **Impact**: Go module updates and security patches require manual monitoring and PRs
- **Severity**: HIGH
- **Effort**: 1 hour
- **Details**: No `.github/dependabot.yml` or Renovate configuration. The project has a single dependency (`google.golang.org/protobuf`), making this easy to set up but still important for security hygiene.

### 3. No Agent Rules for AI-Assisted Development
- **Impact**: AI agents (Claude Code, Copilot) lack context on project test conventions, patterns, and quality standards
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory. The project has clear testing patterns (table-driven tests, httptest mocking, build-tag-gated integration tests) that should be documented for AI agents.

### 4. No Container Build Integration (Library Context)
- **Impact**: When this SDK is packaged into downstream images, build validation happens only at that downstream level
- **Severity**: MEDIUM
- **Effort**: 8-12 hours (if a Dockerfile is desired)
- **Details**: As a pure Go SDK library, the absence of Dockerfiles is understandable. However, downstream projects (mlflow-operator, etc.) depend on this module. Consider adding a CI step that verifies the module builds cleanly as a dependency (`go build ./...`), which already happens implicitly via `make check`.

## Quick Wins

### 1. Add Coverage Tracking (2-4 hours)
Add `--coverprofile` to the unit test target and integrate Codecov:

```yaml
# .github/workflows/go.yaml - add to test-unit job
- name: Run unit tests with coverage
  run: go test -v -race -coverprofile=coverage.out ./...

- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    file: coverage.out
    fail_ci_if_error: false
```

```yaml
# .codecov.yml
coverage:
  status:
    project:
      default:
        target: 70%
    patch:
      default:
        target: 80%
```

### 2. Enable Dependabot (1 hour)
```yaml
# .github/dependabot.yml
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

### 3. Add CI Concurrency and Caching (1-2 hours)
```yaml
# Add to .github/workflows/go.yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

# Add timeout to each job
jobs:
  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    # ...
  test-unit:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    # ...
  test-integration:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    # ...
```

Note: `actions/setup-go@v5` includes built-in Go module caching by default, so explicit `actions/cache` is not needed.

### 4. Generate Agent Rules (2-3 hours)
Use the `/test-rules-generator` skill to create `.claude/rules/` with:
- Unit test patterns (table-driven tests, httptest mocking, error checking)
- Integration test patterns (build tag gating, cleanup patterns, context timeouts)
- Go testing conventions used in this project

## Detailed Findings

### Unit Tests

**Score: 8.5/10**

**Test Files**: 10 unit test files covering all major packages:
- `mlflow/client_test.go` — 14 tests for client initialization, URI handling, env vars, insecure mode
- `mlflow/promptregistry/format_test.go` — 12 tests for prompt formatting (text, chat, edge cases)
- `mlflow/promptregistry/prompt_test.go` — Prompt type tests
- `mlflow/promptregistry/client_test.go` — Client method tests
- `mlflow/tracking/client_test.go` — Tracking client tests
- `mlflow/artifacts/client_test.go` — Artifact client tests
- `internal/transport/http_test.go` — 20+ tests with httptest, including secret redaction, timeout, cancellation
- `internal/errors/api_test.go` — 30+ table-driven tests for all error classification helpers
- `internal/artifact/uri_test.go` — 15 table-driven tests for URI resolution with security edge cases
- `internal/artifact/store_test.go` — 12 tests for artifact upload/download strategies (presigned, proxy, tracking-server)

**Test Quality Signals**:
- Consistent use of table-driven tests (`tests := []struct{...}`)
- `httptest.NewServer` for HTTP layer testing (no external dependencies)
- Security-conscious: tests for path traversal prevention, secret redaction in logs, oversize rejection
- Proper cleanup with `t.Cleanup()` and `defer`
- Race detection enabled (`-race` flag)

**Test-to-Code Ratio**: 13 test files / 27 source files = 0.48 (good for a Go library)
**Test Lines**: ~6,352 lines of test code / ~4,437 lines of source code = 1.43:1 ratio (excellent)

**Minor Gaps**:
- `internal/conv/conv.go` has no dedicated test file (helper package)
- No fuzz tests for security-sensitive code (URI parsing, path traversal validation)

### Integration/E2E Tests

**Score: 8.0/10**

**Test Files**: 3 integration test files under `test/integration/`:
- `tracking_test.go` — 8 tests: experiment lifecycle, run lifecycle, log batch, search, pagination, not-found errors, tag deletion
- `prompt_registry_test.go` — 10 tests: prompt lifecycle, tags, list/filter, versions, delete, alias round-trip, workspace isolation
- `artifacts_test.go` — 1 test: full artifact round-trip (upload, list, download)

**Test Quality Signals**:
- Properly gated with `//go:build integration` build tag
- **Multi-backend testing**: SQLite (default) and PostgreSQL in separate CI jobs
- **Midstream workspace isolation**: Dedicated CI job tests Red Hat midstream fork with workspace headers
- Self-contained: CI targets (`make test/integration-ci`) start MLflow, run tests, clean up — fully automated
- Unique resource naming with `time.Now().UnixNano()` to prevent conflicts
- Proper cleanup with `t.Cleanup()` for all created resources
- Context timeouts on all tests (30s)

**Strong Points**:
- Tests run against 3 different backends in CI: SQLite, PostgreSQL, midstream with workspaces
- The `TestWorkspaceIsolation` test validates multi-tenant isolation end-to-end
- Integration tests are fully automated in CI (no manual setup required)

**Gaps**:
- No multi-version testing (single Go version, single MLflow version)
- No E2E tests against a real K8s/OpenShift deployment (expected for a library)
- Artifact integration tests could cover more scenarios (multi-file, subdirectories, error cases)

### Build Integration

**Score: 2.0/10**

**Context**: As a pure Go SDK library, build integration is inherently limited. There are no Dockerfiles, operators, or manifests to validate.

**What Exists**:
- `make check` runs `lint + vet + test/unit` — a basic quality gate
- `go build ./...` runs implicitly through test compilation
- Protobuf code generation (`make gen`) with `protoc-gen-go`

**What's Missing**:
- No Dockerfile or Containerfile (acceptable for a pure library)
- No PR-time Konflux build simulation
- No operator manifest validation (N/A)
- No cross-component build validation

**Mitigating Factor**: The library is consumed as a Go module dependency by downstream projects. Build validation happens at the import site, not here. Score reflects the structural absence rather than a quality failure.

### Image Testing

**Score: 1.0/10**

This repository does not produce container images. It is a Go SDK library consumed via `go get`. No Dockerfile, Containerfile, or docker-compose configuration exists. The minimum score reflects that this dimension is not applicable rather than a quality failure.

### Coverage Tracking

**Score: 1.0/10**

**What's Missing**:
- No `--coverprofile` in any test command (Makefile or CI)
- No `.codecov.yml` or coverage configuration
- No coverage threshold enforcement
- No PR-level coverage reporting
- No coverage data generated anywhere

This is the most impactful gap for a library with otherwise strong tests. Adding coverage tracking would provide quantitative evidence of test quality and prevent regressions.

### CI/CD Automation

**Score: 6.5/10**

**Workflow Inventory**: Single workflow file `.github/workflows/go.yaml` with 5 jobs:

| Job | Trigger | Description |
|-----|---------|-------------|
| `lint` | push/PR to main | golangci-lint + go vet + gofmt check + go mod tidy check |
| `test-unit` | push/PR to main | Unit tests with race detector |
| `test-integration` | push/PR to main | Integration tests against SQLite |
| `test-integration-postgres` | push/PR to main | Integration tests against PostgreSQL |
| `test-integration-midstream` | push/PR to main | Integration tests against midstream fork with workspaces |

**Strengths**:
- 5 parallel jobs covering lint, unit, and 3 integration test variants
- `go-version-file: 'go.mod'` ensures consistent Go version
- Good job separation (lint vs test vs integration variants)
- Both SQLite and PostgreSQL backends tested

**Gaps**:
- **No concurrency control**: Duplicate workflows run on rapid push+PR events
- **No timeout-minutes**: Jobs can hang indefinitely
- **No explicit caching**: `actions/setup-go@v5` has built-in caching, but the workflow doesn't explicitly verify or configure it
- **No test result artifacts**: No JUnit XML upload for test result visualization
- **No scheduled/periodic runs**: Only PR and push triggers
- **No matrix strategy**: Single Go version tested

### Static Analysis

**Score: 6.0/10**

**Linting Configuration** (`.golangci.yml`):
- golangci-lint v2 (version 2.1.6)
- **7 extra linters enabled**: gocritic, gosec, misspell, prealloc, revive, unconvert, unparam
- `errcheck` with `check-type-assertions: true` and `check-blank: true`
- `govet` with `enable-all: true`
- Generated code excluded (`internal/gen/`)
- Test-specific exclusions for errcheck, gocritic, gosec
- Formatters: gofmt + goimports

**FIPS Compatibility**:
- `math/rand/v2` imported only in `sample-app/main.go` (demo code, not SDK library)
- No crypto imports in the SDK library itself — the library uses `net/http` only, no direct cryptographic operations
- No FIPS build tags (`-tags=fips`, `GOEXPERIMENT=boringcrypto`) — not currently configured
- No UBI-based Dockerfile (N/A, no container images built)

**Dependency Alerts**:
- **No `.github/dependabot.yml`** — missing
- **No Renovate configuration** — missing
- Single dependency (`google.golang.org/protobuf`) makes this low-risk but still a gap

**Pre-commit Hooks**:
- **No `.pre-commit-config.yaml`** — missing
- CI enforces formatting and tidiness, but local development has no pre-commit guard

### Agent Rules

**Score: 0.0/10**

**What's Missing**:
- No `CLAUDE.md` or `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` with test creation guidelines
- No `.claude/skills/` with custom skills

**Impact**: AI agents working on this codebase lack context on:
- Table-driven test patterns used throughout the project
- `httptest.NewServer` mocking conventions
- Build tag gating for integration tests (`//go:build integration`)
- Resource cleanup patterns (`t.Cleanup()`)
- Error testing conventions (type assertions, `errors.As`, `errors.Is` patterns)

**Recommendation**: Use `/test-rules-generator` to generate comprehensive test creation rules based on existing test patterns. The project has very consistent and well-structured tests that are ideal for codifying into rules.

## Recommendations

### Priority 0 (Critical)

1. **Add coverage generation and Codecov integration** — Add `--coverprofile=coverage.out` to `make test/unit`, add `codecov/codecov-action` to CI, create `.codecov.yml` with 70% project target and 80% patch target. This is the highest-impact improvement for 2-4 hours of work.

2. **Enable Dependabot** — Create `.github/dependabot.yml` covering `gomod` and `github-actions` ecosystems. Single dependency makes this trivial but important for security posture.

### Priority 1 (High Value)

3. **Add CI concurrency control and timeouts** — Add `concurrency` block to prevent duplicate workflow runs, add `timeout-minutes` to all jobs (10 min for lint/unit, 15 min for integration).

4. **Create agent rules** — Generate `CLAUDE.md` and `.claude/rules/` with test creation guidelines covering table-driven tests, httptest mocking, build tag gating, and cleanup patterns. Use `/test-rules-generator` skill.

5. **Add pre-commit hooks** — Create `.pre-commit-config.yaml` with gofmt, go vet, and go mod tidy checks. The CI already enforces these, but local hooks catch issues earlier.

### Priority 2 (Nice-to-Have)

6. **Add FIPS build configuration** — Add `-tags=fips` and `GOEXPERIMENT=boringcrypto` CI variants for Red Hat downstream compatibility testing.

7. **Add fuzz tests** — The URI parsing and path traversal validation in `internal/artifact/` are ideal candidates for Go's built-in fuzz testing.

8. **Add Go version matrix** — Test against Go 1.23 and 1.24 to ensure backward compatibility.

9. **Upload test result artifacts** — Add gotestsum or JUnit XML output for better test result visualization in GitHub.

## Comparison to Gold Standards

| Practice | mlflow-go | odh-dashboard | notebooks | kserve |
|----------|-----------|---------------|-----------|--------|
| Unit test coverage | Strong (1.43:1 lines ratio) | Comprehensive | Moderate | Strong |
| Integration tests | 3 backends (SQLite, PostgreSQL, midstream) | Multi-layer | N/A | Multi-version |
| Coverage enforcement | None | Codecov with thresholds | N/A | Codecov |
| Linting | golangci-lint v2 (7 extra) | ESLint strict | Varied | golangci-lint |
| Dependabot | Missing | Configured | Configured | Configured |
| Pre-commit | Missing | Husky | Varied | pre-commit |
| Agent rules | Missing | Comprehensive | Partial | Partial |
| CI concurrency | Missing | Configured | Varied | Configured |
| Build integration | N/A (library) | Multi-image | 5-layer | Operator testing |
| FIPS checks | Not configured | N/A | Configured | Partial |

## File Paths Reference

### CI/CD
- `.github/workflows/go.yaml` — Single workflow with 5 jobs (lint, test-unit, test-integration, test-integration-postgres, test-integration-midstream)

### Testing
- `mlflow/client_test.go` — Client initialization tests
- `mlflow/promptregistry/format_test.go` — Prompt formatting tests
- `mlflow/promptregistry/prompt_test.go` — Prompt type tests
- `mlflow/promptregistry/client_test.go` — Prompt registry client tests
- `mlflow/tracking/client_test.go` — Tracking client tests
- `mlflow/artifacts/client_test.go` — Artifact client tests
- `internal/transport/http_test.go` — HTTP transport tests
- `internal/errors/api_test.go` — Error handling tests
- `internal/artifact/uri_test.go` — URI resolution tests
- `internal/artifact/store_test.go` — Artifact store tests
- `test/integration/tracking_test.go` — Tracking integration tests
- `test/integration/prompt_registry_test.go` — Prompt registry integration tests
- `test/integration/artifacts_test.go` — Artifact integration tests

### Code Quality
- `.golangci.yml` — golangci-lint v2 configuration (7 extra linters)
- `Makefile` — Build and test targets (test/unit, test/integration, lint, vet, fmt, tidy, check)

### Source Structure
- `mlflow/` — Public SDK package (client, tracking, promptregistry, artifacts)
- `internal/` — Internal packages (transport, errors, conv, artifact)
- `sample-app/` — Demo application
- `docs/adr/` — Architecture decision records (10 ADRs)
