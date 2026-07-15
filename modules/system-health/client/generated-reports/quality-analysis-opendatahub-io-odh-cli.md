---
repository: "opendatahub-io/odh-cli"
overall_score: 7.0
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Excellent test-to-code ratio (186 test files / 277 source files = 67%) with Gomega + testify, structured mocks, and comprehensive coverage of lint checks, migration actions, and CLI commands"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "Only 1 integration test file (200 lines) for lint diagnostics; no E2E tests exercising the CLI against a live cluster or Kind environment"
  - dimension: "Build Integration"
    score: 3.5
    status: "No PR-time container image build or Konflux simulation; image builds only triggered on push to main or release events"
  - dimension: "Image Testing"
    score: 4.0
    status: "Multi-arch Dockerfile (amd64/arm64/ppc64le) with UBI9 base and FIPS support, but no runtime validation, startup testing, or vulnerability scanning"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "Coverage profile generated via -coverprofile=coverage.out in make test, but no codecov/coveralls integration, no coverage thresholds, no PR reporting"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "Single well-structured CI workflow with concurrency control, GoReleaser for releases, but missing security scanning, coverage reporting, and periodic jobs"
  - dimension: "Agent Rules"
    score: 9.0
    status: "Comprehensive AGENTS.md with testing guidelines, mock organization, quality gates; .claude/skills/ with lint-check creation skill; extensive docs/ covering testing, quality, coding conventions, and code review"
critical_gaps:
  - title: "No integration or E2E test suite for CLI commands"
    impact: "CLI behavior regressions against real or simulated clusters go undetected until manual testing"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No security scanning in CI (no Trivy, CodeQL, or govulncheck)"
    impact: "Vulnerabilities in dependencies and container images are not detected before merge or release"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No PR-time container image build validation"
    impact: "Dockerfile and multi-arch build issues discovered only after merge to main"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Coverage can silently regress without any visibility in PRs or CI dashboards"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add govulncheck to CI workflow"
    effort: "1 hour"
    impact: "Already has make vulncheck target; just needs a CI step to run it on PRs"
  - title: "Add codecov integration for PR coverage reporting"
    effort: "2-3 hours"
    impact: "Immediate visibility into coverage changes on every PR with enforcement thresholds"
  - title: "Add Trivy container scanning to CI"
    effort: "1-2 hours"
    impact: "Catch CVEs in UBI9 base image and installed binaries (kubectl, oc) before release"
  - title: "Add PR-time image build step (build-only, no push)"
    effort: "2-3 hours"
    impact: "Validate Dockerfile and multi-arch builds on every PR before merge"
recommendations:
  priority_0:
    - "Add security scanning to CI: integrate govulncheck (already has Makefile target), add Trivy for container images, and enable CodeQL for SAST"
    - "Add PR-time container image build validation to catch Dockerfile regressions before merge"
    - "Integrate codecov with coverage thresholds and PR reporting"
  priority_1:
    - "Build a comprehensive E2E test suite using Kind or envtest to validate CLI commands against a simulated cluster"
    - "Add periodic CI jobs for extended testing (vulnerability scanning, integration tests, cross-platform validation)"
    - "Add SBOM generation and image signing for supply chain security"
  priority_2:
    - "Add cross-platform testing for Windows/macOS binaries (GoReleaser builds them but they are not tested)"
    - "Add performance benchmarks for lint check execution (already has executor_bench_test.go, needs CI integration)"
    - "Consider adding contract tests between CLI and the opendatahub-operator API"
---

# Quality Analysis: odh-cli

## Executive Summary

- **Overall Score: 7.0/10**
- **Repository Type**: Go CLI tool (kubectl plugin for ODH/RHOAI)
- **Primary Language**: Go 1.26
- **Framework**: Cobra CLI + Kubernetes client-go + controller-runtime

### Key Strengths
- **Exceptional unit test coverage**: 186 test files for 277 source files (67% ratio), covering lint checks, migration actions, backup operations, MCP server, and utility packages
- **Outstanding agent rules**: Comprehensive AGENTS.md with testing guidelines, mock organization, quality gates, and a custom lint-check creation skill in `.claude/skills/`
- **Well-organized code quality**: golangci-lint v2 with `default: all` linters, pre-commit hooks (fmt, vet, lint, tests), and enforced development workflow
- **Solid build system**: Multi-arch container builds (amd64/arm64/ppc64le), FIPS support, GoReleaser for cross-platform binary releases, and UBI9 base image

### Critical Gaps
- **No integration/E2E tests**: Only 1 integration test file (200 lines); no tests exercising CLI commands against a cluster
- **No security scanning**: No Trivy, CodeQL, or automated govulncheck in CI (Makefile target exists but is not wired into CI)
- **No coverage enforcement**: Coverage profile generated but not reported, tracked, or enforced
- **No PR-time image builds**: Container builds only run on push to main or releases, not on PRs

### Agent Rules Status: **Excellent** - Comprehensive AGENTS.md + `.claude/skills/lint-check` + extensive docs/

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | Excellent ratio (67%), Gomega + testify, structured mocks |
| Integration/E2E | 3.0/10 | 1 integration test file, no E2E suite |
| **Build Integration** | **3.5/10** | **No PR-time container builds or Konflux simulation** |
| Image Testing | 4.0/10 | Multi-arch Dockerfile but no runtime validation or scanning |
| Coverage Tracking | 4.0/10 | Profile generated, no reporting or enforcement |
| CI/CD Automation | 7.0/10 | Concurrency control, GoReleaser, but missing security and coverage |
| Agent Rules | 9.0/10 | Comprehensive AGENTS.md, skills, docs, coding standards |

## Critical Gaps

### 1. No Integration or E2E Test Suite
- **Impact**: CLI command behavior against real/simulated Kubernetes clusters is entirely untested in CI
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: Only `tests/integration/lint/diagnostic_cr_test.go` (200 lines) exists. No tests for `status`, `migrate`, `backup`, `deps`, `events`, `logs`, `get`, or `components` commands against a live or fake cluster
- **Recommendation**: Create an E2E suite using envtest or Kind to validate full command flows

### 2. No Security Scanning in CI
- **Impact**: Vulnerabilities in Go dependencies, container base images, and installed binaries (kubectl, oc) go undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Trivy, Snyk, CodeQL, or Gitleaks workflows. The Makefile has a `vulncheck` target using `govulncheck` but it is not called in CI. No `.gitleaks.toml`, no `.trivyignore`, no CodeQL workflow
- **Recommendation**: Add `make vulncheck` step to CI, add Trivy scanning for container images, enable CodeQL

### 3. No PR-Time Container Image Build
- **Impact**: Dockerfile regressions and multi-arch build failures are only discovered after merge to main
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The `dev-container` job only runs on push to main (`if: github.event_name == 'push' && github.ref == 'refs/heads/main'`). PRs only run `make test` and `make lint` — no image build validation
- **Recommendation**: Add a `build-image` job to the PR workflow that builds but does not push

### 4. No Coverage Tracking or Enforcement
- **Impact**: Test coverage can regress silently without visibility in PRs
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: `make test` generates `coverage.out` via `-coverprofile`, but there is no `.codecov.yml`, no codecov/coveralls action in CI, and no minimum coverage thresholds
- **Recommendation**: Add codecov GitHub Action with coverage thresholds and PR commenting

## Quick Wins

### 1. Add govulncheck to CI (1 hour)
The Makefile already has a `vulncheck` target. Just add a step to the CI workflow:
```yaml
- name: Run vulnerability check
  run: make vulncheck
```

### 2. Add codecov integration (2-3 hours)
```yaml
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    file: coverage.out
    flags: unittests
    fail_ci_if_error: true
```
Add `.codecov.yml` with minimum coverage thresholds.

### 3. Add Trivy container scanning (1-2 hours)
```yaml
- name: Build test image
  run: docker build -t odh-cli:test .
- name: Run Trivy scan
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: odh-cli:test
    format: table
    exit-code: 1
    severity: CRITICAL,HIGH
```

### 4. Add PR-time image build (2-3 hours)
```yaml
build-image:
  runs-on: ubuntu-latest
  needs: test
  if: github.event_name == 'pull_request'
  steps:
    - uses: actions/checkout@v6
    - name: Build container image (no push)
      run: docker build --platform linux/amd64 -t odh-cli:pr-test .
```

## Detailed Findings

### CI/CD Pipeline

**Workflow**: Single `ci.yml` with 4 jobs:
1. **test** (PR + push): `make test` + `make lint` — runs on all PRs and pushes to main
2. **dev-container** (push to main): builds and pushes multi-arch dev image
3. **release-container** (release): builds and pushes versioned + latest image
4. **release-binary** (release): GoReleaser for cross-platform binaries (linux/darwin/windows, amd64/arm64)

**Strengths**:
- Concurrency control with `cancel-in-progress: true`
- Go version derived from `go.mod` via `go-version-file`
- GoReleaser for automated binary releases with checksums
- Clean job dependencies (container/binary jobs depend on test passing)

**Gaps**:
- No caching of Go modules (should add `cache: true` or explicit cache step)
- No periodic/scheduled workflows for extended testing
- No matrix testing across Go versions
- No security scanning jobs
- No coverage upload

### Test Coverage

**Unit Tests (8.5/10)**:
- 186 test files for 277 source files (67% test-to-code ratio)
- Comprehensive coverage across all major packages:
  - `pkg/lint/checks/` — 40+ test files covering component, workload, dependency, and service checks
  - `pkg/migrate/actions/` — 25+ test files for migration actions (aipipelines, kueue, modelserving, workbenches, etc.)
  - `pkg/backup/` — resource writer and command tests
  - `pkg/mcp/` — MCP server, adapter, and error tests
  - `pkg/util/` — client, conditions, errors, inspect, iostreams, jq, kube, stdin, version helpers
- Framework: Gomega (vanilla, no Ginkgo) + testify/mock + `t.Run()` subtests + `t.Context()` (Go 1.24+)
- Includes a benchmark test (`executor_bench_test.go`) for lint check execution performance
- Well-structured mock organization in `pkg/util/test/mocks/`

**Integration Tests (3.0/10)**:
- Only `tests/integration/lint/diagnostic_cr_test.go` (200 lines)
- No integration tests for migrate, backup, status, events, deps, logs, or get commands
- No Kind or envtest infrastructure for cluster-level testing

**E2E Tests**: None

### Code Quality

**Linting (Excellent)**:
- golangci-lint v2.8.0 with `default: all` — starts with ALL linters enabled, selectively disables noisy ones
- 15 linters explicitly disabled with documented reasons (e.g., `funlen # Some functions intentionally long for clarity`)
- revive with `enable-all-rules: true` and selective disables
- Formatters: gci, gofmt, goimports with custom import ordering
- Complexity thresholds: cyclop max 15, gocognit min 50
- Test file exclusions for appropriate linters (forcetypeassert, mnd, dupl, etc.)

**Pre-commit Hooks (Good)**:
- trailing-whitespace, end-of-file-fixer, check-yaml, check-merge-conflict
- go fmt, go vet, golangci-lint on commit
- go test on pre-push stage

**Static Analysis**: golangci-lint covers SAST via included analyzers, but no dedicated CodeQL or gosec workflow

### Container Images

**Dockerfile (Good)**:
- Multi-stage build: UBI9 go-toolset builder → UBI9 runtime
- Multi-arch support: amd64, arm64, ppc64le via `$BUILDPLATFORM` / `$TARGETARCH`
- FIPS support: `CGO_ENABLED=1 GOEXPERIMENT=strictfipsruntime`
- Layer caching: go.mod/go.sum copied before source for better layer reuse
- Non-root considerations: sticky-bit backup directory

**Gaps**:
- No Trivy/Snyk scanning of built image
- No runtime validation (image startup test)
- No SBOM generation
- No image signing/attestation
- kubectl/oc downloaded from external URLs without checksum verification

### Security

**Current State**: Minimal
- No Trivy or Snyk integration
- No CodeQL or gosec workflows
- No Gitleaks or TruffleHog for secret detection
- No SBOM generation
- govulncheck available via Makefile but not in CI

**Positive Notes**:
- UBI9 base images (Red Hat supported, regularly patched)
- FIPS-capable builds
- Minimal attack surface in runtime container

### Agent Rules (Agentic Flow Quality)

**Status**: Excellent — among the best in the ODH ecosystem

**AGENTS.md (Root)**:
- Project overview and architecture
- Build and run commands with critical warnings (e.g., "NEVER use gci/gofmt directly")
- Test guidelines: Gomega, t.Run(), t.Context(), mock organization, struct assertions
- Debug and troubleshooting guidance
- Required reading list linking 10+ docs

**.claude/skills/lint-check/SKILL.md**:
- Comprehensive skill for creating new lint checks
- Templates for all 4 check types (component, workload, service, dependency)
- Step-by-step implementation with registration, testing, and quality checks
- Common pitfalls section with 8 documented gotchas
- Test template with testutil helpers

**Documentation** (`docs/`):
- `testing.md` — Framework, test data organization, mock organization, struct assertions, idioms
- `quality.md` — Mandatory quality verification workflow (lint-fix-first, make check)
- `code-review.md` — Code review guidelines
- `coding/conventions.md`, `coding/patterns.md`, `coding/formatting.md` — Coding standards
- `design.md`, `extensibility.md` — Architecture and extension patterns
- ADRs in `docs/adr/`

**Gaps**:
- No `.claude/rules/` directory with individual test-type rules
- No agent rules specifically for integration or E2E test creation patterns
- Lint-check skill is specific to one feature; no general test-writing skill

## Recommendations

### Priority 0 (Critical)

1. **Add security scanning to CI**
   - Wire `make vulncheck` into the CI workflow (1 hour — Makefile target already exists)
   - Add Trivy scanning for container images on release
   - Enable CodeQL for Go SAST analysis

2. **Add PR-time container image build validation**
   - Add a `build-image` job that builds but doesn't push on PRs
   - Validates Dockerfile and multi-arch compatibility before merge

3. **Integrate codecov with coverage enforcement**
   - Upload `coverage.out` to codecov
   - Set minimum coverage thresholds (e.g., 60% project, 50% patch)
   - Enable PR commenting for coverage changes

### Priority 1 (High Value)

4. **Build E2E test infrastructure**
   - Use envtest for lightweight Kubernetes API testing
   - Test full CLI command flows: lint, status, migrate, backup, deps
   - Add Kind-based tests for operations requiring a real cluster

5. **Add periodic CI jobs**
   - Weekly vulnerability scanning
   - Nightly extended test suite
   - Cross-version Go compatibility testing

6. **Add SBOM generation and image signing**
   - Generate SBOM during container builds (Syft or ko)
   - Sign images with Sigstore/cosign

### Priority 2 (Nice-to-Have)

7. **Cross-platform binary testing**
   - GoReleaser builds for windows/linux/darwin but only linux is tested
   - Add matrix testing for at least darwin-arm64

8. **CI performance optimization**
   - Add Go module caching to CI workflow
   - Consider separate lint and test jobs for faster feedback

9. **Add contract tests**
   - Test CLI compatibility with opendatahub-operator API contracts
   - Ensure DSC/DSCI schema compatibility across versions

## Comparison to Gold Standards

| Dimension | odh-cli | odh-dashboard | notebooks | kserve |
|-----------|---------|---------------|-----------|--------|
| Unit Tests | 8.5 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 3.0 | 9.0 | 8.0 | 9.0 |
| Build Integration | 3.5 | 7.0 | 6.0 | 7.0 |
| Image Testing | 4.0 | 6.0 | 9.0 | 7.0 |
| Coverage Tracking | 4.0 | 8.0 | 5.0 | 9.0 |
| CI/CD Automation | 7.0 | 9.0 | 8.0 | 9.0 |
| Agent Rules | 9.0 | 8.0 | 3.0 | 2.0 |
| **Overall** | **7.0** | **8.5** | **7.0** | **8.0** |

**Relative Strengths**: odh-cli has the best agent rules in the ecosystem (AGENTS.md + skills + comprehensive docs). Unit test coverage is strong with an excellent test-to-code ratio.

**Relative Weaknesses**: Integration/E2E testing is the biggest gap — other ODH repos have comprehensive E2E suites with Kind or envtest infrastructure. Security scanning and coverage tracking lag behind kserve and odh-dashboard.

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yml` — Single CI workflow (test, dev-container, release-container, release-binary)
- `Makefile` — Build, test, lint, vulncheck, fmt, publish targets
- `.goreleaser.yml` — Cross-platform binary release configuration

### Testing
- `pkg/*/` — 186 test files (`*_test.go`) using Gomega + testify
- `tests/integration/lint/` — 1 integration test file
- `pkg/util/test/mocks/` — Centralized testify/mock implementations

### Code Quality
- `.golangci.yml` — golangci-lint v2 with `default: all` and selective disables
- `.pre-commit-config.yaml` — fmt, vet, lint, test hooks

### Container Images
- `Dockerfile` — Multi-stage, multi-arch (amd64/arm64/ppc64le), UBI9, FIPS-capable

### Agent Rules
- `AGENTS.md` — Comprehensive development guidelines
- `.claude/skills/lint-check/SKILL.md` — Lint check creation skill
- `docs/testing.md` — Testing framework and conventions
- `docs/quality.md` — Quality verification workflow
- `docs/coding/` — Coding conventions, patterns, formatting
