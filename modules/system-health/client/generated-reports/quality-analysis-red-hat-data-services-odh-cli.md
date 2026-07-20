---
repository: "red-hat-data-services/odh-cli"
overall_score: 6.6
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "Outstanding test-to-code ratio (1.37:1 lines), 202 test files across 81 packages with modern Go patterns"
  - dimension: "Integration/E2E"
    score: 4.0
    status: "Only 1 integration test file; command tests use mocked K8s clients, no real cluster validation"
  - dimension: "Build Integration"
    score: 8.0
    status: "Tekton/Konflux PR pipelines with hermetic multi-arch builds; GoReleaser for binaries"
  - dimension: "Image Testing"
    score: 6.0
    status: "Multi-stage UBI9 Dockerfiles with multi-arch support; no runtime validation or .dockerignore"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "Coverage profile generated but not uploaded, no thresholds, no PR reporting"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "Single CI workflow with concurrency control and release automation; missing timeouts and matrix testing"
  - dimension: "Static Analysis"
    score: 9.0
    status: "golangci-lint v2 with default:all, pre-commit hooks, Dependabot + Renovate, FIPS-clean source"
  - dimension: "Agent Rules"
    score: 8.0
    status: "Comprehensive AGENTS.md, custom lint-check skill, 16 docs files with detailed testing/coding guidelines"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Coverage generated locally but never uploaded, reported, or enforced — regressions go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Minimal integration/E2E testing"
    impact: "CLI commands tested only with mocked K8s clients; real cluster interactions untested"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No CI job timeouts"
    impact: "Hung tests can block PR queues indefinitely"
    severity: "MEDIUM"
    effort: "1 hour"
  - title: "Missing .dockerignore"
    impact: "Unnecessary files included in Docker build context, increasing build time and image surface area"
    severity: "MEDIUM"
    effort: "1 hour"
quick_wins:
  - title: "Add Codecov integration with threshold enforcement"
    effort: "2-3 hours"
    impact: "Automated coverage reporting on PRs, threshold gates prevent regression"
  - title: "Add .dockerignore"
    effort: "30 minutes"
    impact: "Reduce build context size, faster builds, smaller attack surface"
  - title: "Add timeout-minutes to CI jobs"
    effort: "30 minutes"
    impact: "Prevent hung jobs from blocking the PR queue"
  - title: "Add Docker ecosystem to Dependabot"
    effort: "30 minutes"
    impact: "Automated alerts for base image vulnerabilities"
  - title: "Create .claude/rules/ directory with test rules"
    effort: "2-3 hours"
    impact: "Move testing guidance from docs into agent-consumable rules for better AI-assisted development"
recommendations:
  priority_0:
    - "Add Codecov integration with coverage threshold enforcement (80% project, 70% patch)"
    - "Add timeout-minutes to all CI jobs (15 min unit tests, 30 min builds)"
  priority_1:
    - "Create integration test suite with real K8s cluster (Kind) for core CLI commands"
    - "Add .dockerignore to exclude .git, docs, tests from Docker build context"
    - "Add Docker ecosystem to Dependabot configuration"
    - "Add container image startup validation in CI (build + run + verify exit code)"
  priority_2:
    - "Add Go version matrix testing in CI (current + previous minor)"
    - "Create .claude/rules/ with test creation rules extracted from docs/testing.md"
    - "Add Dockerfile HEALTHCHECK instruction for runtime validation"
    - "Add cross-platform CLI testing (Linux, macOS, Windows) in CI"
---

# Quality Analysis: red-hat-data-services/odh-cli

## Executive Summary
- Overall Score: 6.6/10
- Key Strengths: Outstanding unit test coverage (1.37:1 test-to-code ratio), best-in-class static analysis (golangci-lint v2 default:all), comprehensive agent rules and developer documentation, FIPS-clean source with strictfipsruntime builds
- Critical Gaps: No coverage tracking or enforcement, minimal integration/E2E testing against real clusters, missing CI timeouts
- Agent Rules Status: Strong (AGENTS.md + .claude/skills/ + 16 docs files)
- Tier: Downstream (RHOAIENG / AI Core Platform)

## Quality Scorecard
| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 9/10 | 15% | Outstanding test-to-code ratio (1.37:1 lines), 202 test files, modern Go patterns |
| Integration/E2E | 4/10 | 20% | Only 1 integration test; command tests use mocked K8s clients |
| Build Integration | 8/10 | 15% | Tekton/Konflux PR pipelines, hermetic multi-arch builds, GoReleaser |
| Image Testing | 6/10 | 10% | Multi-stage UBI9, multi-arch; no runtime validation or .dockerignore |
| Coverage Tracking | 3/10 | 10% | Coverage profile generated but not uploaded, no thresholds |
| CI/CD Automation | 7/10 | 15% | Single CI workflow with concurrency; missing timeouts and matrix |
| Static Analysis | 9/10 | 10% | golangci-lint v2 default:all, pre-commit, Dependabot + Renovate, FIPS-clean |
| Agent Rules | 8/10 | 5% | AGENTS.md, custom skill, 16 docs files with testing/coding guidelines |

## Critical Gaps

1. **No coverage tracking or enforcement**
   - Impact: Coverage profile (`coverage.out`) is generated by `make test` but never uploaded to Codecov/Coveralls, never reported on PRs, and never enforced by thresholds. Coverage regressions go undetected.
   - Severity: HIGH
   - Effort: 2-4 hours

2. **Minimal integration/E2E testing**
   - Impact: Only 1 integration test file (`tests/integration/lint/diagnostic_cr_test.go`). All command tests use mocked K8s clients via `fake.NewClientBuilder()`. Real cluster interactions (API discovery, CRD listing, pod logs, event watching) are never tested. Bugs in K8s API interaction patterns are only caught in production or manual testing.
   - Severity: HIGH
   - Effort: 16-24 hours

3. **No CI job timeouts**
   - Impact: Hung tests or builds can block the PR queue indefinitely. No `timeout-minutes` set on any job in `ci.yml`.
   - Severity: MEDIUM
   - Effort: 1 hour

4. **Missing .dockerignore**
   - Impact: The entire repository (including `.git/`, `docs/`, test files, `go.sum`) is sent as Docker build context, increasing build time and image surface area unnecessarily.
   - Severity: MEDIUM
   - Effort: 1 hour

## Quick Wins

1. **Add Codecov integration with threshold enforcement**
   - Effort: 2-3 hours
   - Impact: Automated coverage reporting on PRs, threshold gates prevent coverage regression
   - Implementation:
   ```yaml
   # .codecov.yml
   coverage:
     status:
       project:
         default:
           target: 80%
           threshold: 2%
       patch:
         default:
           target: 70%
   ```
   ```yaml
   # Add to .github/workflows/ci.yml test job:
   - name: Upload coverage
     uses: codecov/codecov-action@v5
     with:
       files: ./coverage.out
       flags: unittests
       fail_ci_if_error: true
   ```

2. **Add .dockerignore**
   - Effort: 30 minutes
   - Impact: Reduce build context size, faster builds
   - Implementation:
   ```
   # .dockerignore
   .git
   .github
   .claude
   .tekton
   .goreleaser.yml
   .pre-commit-config.yaml
   docs/
   tests/
   tools/
   *.md
   !README.md
   ```

3. **Add timeout-minutes to CI jobs**
   - Effort: 30 minutes
   - Impact: Prevent hung jobs from blocking the PR queue
   - Implementation:
   ```yaml
   jobs:
     test:
       runs-on: ubuntu-latest
       timeout-minutes: 15
   ```

4. **Add Docker ecosystem to Dependabot**
   - Effort: 30 minutes
   - Impact: Automated alerts for base image vulnerabilities
   - Implementation:
   ```yaml
   # Add to .github/dependabot.yml
   - package-ecosystem: "docker"
     directory: "/"
     schedule:
       interval: "weekly"
   ```

5. **Create .claude/rules/ directory with test rules**
   - Effort: 2-3 hours
   - Impact: Move testing guidance from docs into agent-consumable rules for better AI-assisted development
   - Implementation: Extract key rules from `docs/testing.md` and `AGENTS.md` into `.claude/rules/unit-tests.md` and `.claude/rules/integration-tests.md`

## Detailed Findings

### Unit Tests

**Status: Excellent (9/10)**

The repository has outstanding unit test coverage with modern Go testing patterns.

**Metrics:**
- Source files: 302 (non-test `.go` files)
- Test files: 202 (`*_test.go`)
- File ratio: 67% (excellent)
- Source lines: 49,536
- Test lines: 67,731
- Line ratio: 1.37:1 (tests exceed source code — outstanding)
- Packages with tests: 81/112 (72%)
- `t.Run()` subtests: 927 occurrences
- `t.Context()` (Go 1.24+): 1,094 occurrences
- `HaveField`/`MatchFields` struct assertions: 564 occurrences
- Benchmark tests: 3 (executor_bench_test.go)
- Mock framework: testify/mock, centralized in `pkg/util/test/mocks/`

**Strengths:**
- Exhaustive command testing across all packages (`pkg/backup/`, `pkg/api/`, `pkg/lint/`, `pkg/deps/`, `pkg/components/`, `pkg/mcp/`, `pkg/migrate/`, etc.)
- Strong use of subtests with `t.Run()` and `t.Context()` (modern Go 1.24+ patterns)
- Struct assertions use Gomega `HaveField`/`MatchFields` (not individual field assertions)
- Centralized mock organization in `pkg/util/test/mocks/`
- Both external (`_test` package suffix) and internal test packages used appropriately
- Benchmark tests for lint check executor performance
- Test data as package-level constants (enforced by convention in `docs/testing.md`)
- Parallel test execution with `t.Parallel()` in some packages

**Gaps:**
- Not all packages have test files (81/112 = 72%)
- `t.Parallel()` usage is inconsistent — present in some packages but not universally adopted
- 234 uses of `context.Background()` in tests vs 1,094 uses of `t.Context()` — migration in progress

### Integration/E2E Tests

**Status: Weak (4/10)**

Only 1 integration test file exists. All command tests use mocked Kubernetes clients.

**Current State:**
- `tests/integration/lint/diagnostic_cr_test.go` — end-to-end diagnostic CR execution test using fake dynamic client
- No real cluster tests (no Kind, Minikube, or envtest setup)
- No E2E directory
- No multi-version testing
- All `pkg/*/command_test.go` files test with `fake.NewClientBuilder()` — these are effectively unit tests with mocked infrastructure

**For a CLI tool, the following are untested with real clusters:**
- API discovery and resource listing
- Pod log streaming
- Event watching
- CRD validation
- Backup/restore operations
- kubectl plugin integration
- Cross-version compatibility (different K8s/OCP versions)

**Recommendations:**
1. Create a Kind-based integration test suite for core commands (`lint`, `status`, `backup`, `deps`)
2. Test against multiple OCP versions (4.16, 4.17) in CI
3. Test kubectl plugin discovery (`kubectl odh` invocation)
4. Test container image startup and basic command execution

### Build Integration

**Status: Strong (8/10)**

The repository has comprehensive build infrastructure with both GitHub Actions CI and Tekton/Konflux pipelines.

**Strengths:**
- **Tekton/Konflux PR pipelines**: `.tekton/odh-cli-pull-request.yaml` triggers on PR events (comment `/build-konflux` or label `kfbuild-odh-cli`)
- **Hermetic builds**: `hermetic: true` in Konflux pipeline
- **Multi-arch**: Builds for `linux/x86_64`, `linux-m2xlarge/arm64`, `linux/ppc64le`
- **Source image**: `build-source-image: true` for supply chain traceability
- **Konflux Dockerfile**: `Dockerfile.konflux` with pinned image digest (`@sha256:...`)
- **GoReleaser**: Automated binary releases for linux/darwin/windows (amd64/arm64)
- **Prefetch**: RPM and gomod prefetching for hermetic builds
- **PR-time CI**: Tests and linting run on every PR via GitHub Actions

**Gaps:**
- GitHub Actions CI does not build Docker images on PRs (only on push to main and releases)
- No Kustomize or manifest validation (not applicable — CLI tool, not operator)
- Konflux builds triggered by comment/label, not automatically on every PR

### Image Testing

**Status: Adequate (6/10)**

**Strengths:**
- Multi-stage Dockerfiles (builder + runtime) for both standard and Konflux builds
- UBI9 base images:
  - `Dockerfile`: `registry.access.redhat.com/ubi9/go-toolset:1.26` (builder) + `registry.access.redhat.com/ubi9/ubi:latest` (runtime)
  - `Dockerfile.konflux`: Same builder + `registry.redhat.io/openshift4/ose-cli-rhel9:v4.21.0` (runtime)
- Multi-architecture cross-compilation (`TARGETOS`, `TARGETARCH`, `BUILDPLATFORM`)
- Support for amd64, arm64, ppc64le
- Proper entrypoint configuration
- kubectl and oc CLI tools installed in standard Dockerfile

**Gaps:**
- No `.dockerignore` — entire repo sent as build context
- No `HEALTHCHECK` in Dockerfiles
- No runtime validation tests (startup, basic command execution)
- No Testcontainers usage
- Konflux Dockerfile runtime image is not the same as the standard Dockerfile (ose-cli-rhel9 vs ubi9) — potential behavioral differences

### Coverage Tracking

**Status: Weak (3/10)**

**Current State:**
- `make test` generates `coverage.out` via `go test -coverprofile=coverage.out ./...`
- No `.codecov.yml` or `codecov.yml` configuration file
- No coverage upload step in CI (`ci.yml`)
- No coverage threshold enforcement
- No PR coverage reporting
- No coverage badge in README
- Coverage file exists only locally — never persisted or analyzed

**Impact:**
Coverage regressions are invisible. There is no way to know the current coverage percentage or track trends over time. The 1.37:1 test-to-code ratio suggests coverage is likely high, but without measurement, it's unverifiable.

**Recommendations:**
1. Add `.codecov.yml` with 80% project target and 70% patch target
2. Add `codecov/codecov-action` step to CI workflow after `make test`
3. Add coverage badge to README
4. Consider per-package coverage targets for critical packages

### CI/CD Automation

**Status: Good (7/10)**

**Strengths:**
- Single consolidated CI workflow (`ci.yml`) covering tests, linting, dev images, release images, and binary releases
- Proper trigger configuration: PR + push to main + release events
- Concurrency control with `cancel-in-progress: true`
- Go module caching via `actions/setup-go@v6` (built-in cache)
- Separate release pipeline with GoReleaser for cross-platform binaries
- Dev image published automatically on push to main
- Tekton pipelines supplement CI for Konflux builds
- All CI actions at latest versions (v6)

**Gaps:**
- No `timeout-minutes` on any job — hung tests block the queue
- No matrix strategy for Go versions (only tests against `go.mod` version)
- No explicit caching beyond `setup-go` built-in (e.g., no Docker layer cache)
- No workflow status badges in README
- CI does not build Docker images on PRs (relies on Konflux for that)
- No scheduled/cron jobs for periodic checks

**Recommendations:**
- Add `timeout-minutes: 15` to test job, `timeout-minutes: 30` to container jobs
- Add Go version matrix (current + previous minor) for compatibility testing
- Add workflow status badge to README

### Static Analysis

**Status: Excellent (9/10)**

#### Linting

**Configuration:** golangci-lint v2 with `default: all` — the most aggressive configuration that enables ALL linters and only disables a targeted few.

**Disabled linters (22 disabled/excluded from ALL):**
- `wsl`, `wsl_v5`, `noinlineerr`, `varnamelen`, `exhaustruct`, `ireturn`, `depguard`, `err113`, `paralleltest`, `funcorder`, `funlen`, `nilerr`, `nilnil`, `lll`, `gocritic`
- Additional exclusions for test files: `forcetypeassert`, `mnd`, `maintidx`, `nestif`, `dupl`, `goconst`, `intrange`, `rangeint`, `revive`, `unparam`
- `revive` enabled with `enable-all-rules` and targeted rule disables

**Formatters:** `gci`, `gofmt`, `goimports` with custom import ordering

**Lint timeout:** 10 minutes

**Strengths:**
- `default: all` is the gold standard for golangci-lint v2 configuration
- Revive with `enable-all-rules` and carefully documented disable reasons
- Lint issues: `max-issues-per-linter: 0`, `max-same-issues: 0` (no suppression)
- Separate `make lint/fix` for auto-fixable issues

#### Pre-commit Hooks

**Configured hooks:**
1. `trailing-whitespace` — general hygiene
2. `end-of-file-fixer` — general hygiene
3. `check-yaml` (with `--allow-multiple-documents`) — YAML validation
4. `check-merge-conflict` — prevent merge conflicts
5. `go-fmt` → `make fmt` — code formatting
6. `go-vet` → `go vet ./...` — static analysis
7. `golangci-lint` → `make lint` — full lint suite
8. `go-unit-tests` → `make test` (pre-push stage) — run tests before push

#### FIPS Compatibility

**Status: Clean (No Issues Found)**

- **Source code scan**: No non-FIPS crypto imports found (`crypto/md5`, `crypto/des`, `crypto/rc4`, `math/rand` — all clean)
- **Build configuration**: `GOEXPERIMENT=strictfipsruntime` and `-tags strictfipsruntime` in both Dockerfiles
- **Makefile**: Documents FIPS build recipe (`make build CGO_ENABLED=1 GOEXPERIMENT=strictfipsruntime`)
- **Base images**: UBI9 (FIPS-capable) — `registry.access.redhat.com/ubi9/go-toolset` and `registry.access.redhat.com/ubi9/ubi`
- **Downstream**: `Dockerfile.konflux` uses `registry.redhat.io/openshift4/ose-cli-rhel9` (FIPS-certified)

#### Dependency Alerts

**Status: Well-configured**

- **Dependabot** (`.github/dependabot.yml`):
  - `gomod`: Daily at 07:00 UTC, 10 PR limit
  - `github-actions`: Weekly (Monday), 5 PR limit
  - Missing: `docker` ecosystem
- **Renovate** (`.github/renovate.json`):
  - Extends `red-hat-data-services/konflux-central` default config
  - Provides additional update automation

#### Vulnerability Scanning

- `govulncheck` available via `make vulncheck` Makefile target
- Not integrated into CI (manual execution only)

### Agent Rules

**Status: Strong (8/10)**

**Existing Agent Rules:**
- `AGENTS.md` (root) — comprehensive development guidelines including:
  - Project overview and architecture
  - Build and run commands (with critical warnings about `make` usage)
  - Test guidelines (framework, patterns, mocks)
  - Debug and troubleshooting guidance
  - Required reading list (13 documents)
- `.claude/skills/lint-check/SKILL.md` — detailed skill for creating lint checks with templates, validation builders, condition API, and common pitfalls

**Documentation Suite (16 files):**
- `docs/agent.md` — agent-specific instructions
- `docs/testing.md` — comprehensive testing guidelines (framework, patterns, mocks, struct assertions)
- `docs/quality.md` — quality verification steps
- `docs/code-review.md` — code review standards
- `docs/development.md` — development workflow hub
- `docs/design.md` — architecture and design decisions
- `docs/setup.md` — setup instructions
- `docs/extensibility.md` — extension patterns
- `docs/coding/conventions.md` — coding standards
- `docs/coding/patterns.md` — code patterns
- `docs/coding/formatting.md` — formatting rules
- `docs/lint/architecture.md` — lint system architecture
- `docs/lint/writing-checks.md` — lint check creation guide
- `docs/usage.md` — CLI usage
- `docs/migrate/implementation-plan.md` — migration planning
- `docs/adr/0001-cli-architecture.md` — architecture decision record

**Gaps:**
- No `.claude/rules/` directory — rules are in `AGENTS.md` and `docs/` instead of the conventional location
- No `CLAUDE.md` (uses `AGENTS.md` instead)
- Custom skill exists only for lint checks — no skills for general test creation, PR workflows, etc.

**Recommendations:**
- Create `.claude/rules/unit-tests.md` and `.claude/rules/integration-tests.md` extracted from `docs/testing.md`
- These are minor organizational improvements — the content is already comprehensive

## Recommendations

### Priority 0 (Critical)
- Add Codecov integration with coverage threshold enforcement (80% project, 70% patch)
- Add `timeout-minutes` to all CI jobs (15 min test, 30 min container builds)

### Priority 1 (High Value)
- Create integration test suite with Kind cluster for core CLI commands (`lint`, `status`, `backup`, `deps`)
- Add `.dockerignore` to exclude `.git/`, `docs/`, `tests/`, `tools/` from Docker build context
- Add `docker` ecosystem to Dependabot configuration
- Add container image startup validation (build image, run `rhai-cli version`, verify exit code)
- Integrate `govulncheck` into CI pipeline

### Priority 2 (Nice-to-Have)
- Add Go version matrix testing in CI (current + previous minor)
- Create `.claude/rules/` directory with test creation rules
- Add `HEALTHCHECK` instruction to Dockerfiles
- Add cross-platform CLI testing (Linux, macOS, Windows) via GoReleaser or matrix
- Add workflow status badges to README
- Increase `t.Parallel()` adoption across all test packages
- Migrate remaining `context.Background()` usage in tests to `t.Context()`

## Comparison to Gold Standards

| Dimension | odh-cli | odh-dashboard | notebooks | kserve | Gap |
|-----------|---------|---------------|-----------|--------|-----|
| Unit Tests | 9/10 | 9/10 | 8/10 | 8/10 | +1 (Outstanding ratio) |
| Integration/E2E | 4/10 | 10/10 | 7/10 | 9/10 | -6 (No cluster tests) |
| Build Integration | 8/10 | 9/10 | 8/10 | 4/10 | -1 (Strong Konflux) |
| Image Testing | 6/10 | 7/10 | 10/10 | 6/10 | -4 (No runtime tests) |
| Coverage Tracking | 3/10 | 9/10 | 8/10 | 8/10 | -6 (Not configured) |
| CI/CD Automation | 7/10 | 9/10 | 8/10 | 9/10 | -2 (Missing timeouts) |
| Static Analysis | 9/10 | 9/10 | 8/10 | 7/10 | 0 (Matches gold standard) |
| Agent Rules | 8/10 | 8/10 | 6/10 | 2/10 | 0 (Strong documentation) |

**Key Takeaways:**
- **Biggest gaps**: Coverage Tracking (3/10 vs 9/10 in odh-dashboard) and Integration/E2E (4/10 vs 10/10 in odh-dashboard)
- **Standout strength**: Unit testing (9/10 — best test-to-code ratio in the fleet) and Static Analysis (9/10 — golangci-lint v2 default:all is the gold standard)
- **FIPS compliance**: Clean — no non-FIPS crypto in source, strictfipsruntime enabled, UBI9 base images
- **Agent rules**: Among the best in the fleet — comprehensive AGENTS.md, custom skills, extensive documentation

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yml` — Consolidated CI workflow (test, lint, image, release)
- `.tekton/odh-cli-pull-request.yaml` — Konflux PR pipeline (multi-arch hermetic build)
- `.tekton/odh-cli.yaml` — Konflux push pipeline
- `Makefile` — Build, test, lint, publish targets
- `.goreleaser.yml` — Cross-platform binary release configuration

### Testing
- `pkg/*/command_test.go` — Command unit tests (mocked K8s clients)
- `pkg/*_internal_test.go` — Internal package tests
- `tests/integration/lint/diagnostic_cr_test.go` — Integration test
- `pkg/lint/check/executor_bench_test.go` — Benchmark tests
- `pkg/util/test/mocks/` — Centralized mock implementations

### Static Analysis
- `.golangci.yml` — golangci-lint v2 configuration (default: all)
- `.pre-commit-config.yaml` — Pre-commit hooks (fmt, vet, lint, test)
- `.github/dependabot.yml` — Dependabot (gomod daily, github-actions weekly)
- `.github/renovate.json` — Renovate (extends konflux-central defaults)

### Container Images
- `Dockerfile` — Standard multi-arch build (UBI9)
- `Dockerfile.konflux` — Konflux hermetic build (pinned digests)

### Agent Rules
- `AGENTS.md` — Agent development guidelines
- `.claude/skills/lint-check/SKILL.md` — Lint check creation skill
- `docs/testing.md` — Testing guidelines
- `docs/coding/conventions.md` — Coding conventions
- `docs/quality.md` — Quality verification
