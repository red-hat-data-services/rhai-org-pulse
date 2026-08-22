---
repository: "opendatahub-io/ai-gateway-payload-processing"
overall_score: 7.3
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "Strong test suite with 33 test files, high test-to-code ratio (1.55x lines), uses testify and envtest"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Comprehensive Ginkgo E2E suite with Kind cluster, Istio, multi-provider coverage, JUnit reporting"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-triggered CI with lint/test/vet, Konflux/Tekton pipelines with group testing and E2E"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage UBI9 builds, FIPS-compliant, multi-arch support, but no container health checks"
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "Coverprofile generated locally but no codecov integration, no PR coverage reporting or thresholds"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "Well-structured workflows with path filtering, caching, timeout controls, multi-arch release pipeline"
  - dimension: "Static Analysis"
    score: 7.0
    status: "golangci-lint v2.9 in CI, Dependabot configured for 3 ecosystems, no pre-commit hooks or golangci config file"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory present"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Coverage regressions go undetected; no PR-level coverage gates or trend visibility"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No agent rules for test automation"
    impact: "AI-assisted development lacks guidance on test patterns, framework usage, and quality standards"
    severity: "MEDIUM"
    effort: "3-4 hours"
  - title: "No container health checks in Dockerfiles"
    impact: "Kubernetes readiness/liveness probes must be defined externally; no built-in startup validation"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No golangci-lint configuration file"
    impact: "Relying on default linters only; missing opportunity for stricter checks and custom rules"
    severity: "LOW"
    effort: "2-3 hours"
quick_wins:
  - title: "Add Codecov integration with coverage thresholds"
    effort: "3-4 hours"
    impact: "PR-level coverage reporting, regression prevention, and trend tracking"
  - title: "Create .golangci.yml with project-specific linter rules"
    effort: "1-2 hours"
    impact: "Stricter static analysis with domain-specific checks (errorlint, gosec, unused, etc.)"
  - title: "Add CLAUDE.md with test creation rules"
    effort: "2-3 hours"
    impact: "Guide AI-assisted development with project-specific test patterns and conventions"
  - title: "Add HEALTHCHECK to Dockerfile"
    effort: "1 hour"
    impact: "Built-in container health validation for local development and CI"
recommendations:
  priority_0:
    - "Add Codecov or Coveralls integration with coverage thresholds and PR comment reporting"
    - "Create .golangci.yml with comprehensive linter configuration (errorlint, gosec, gocritic, unused, etc.)"
  priority_1:
    - "Create CLAUDE.md and .claude/rules/ with test creation patterns for unit tests (testify + envtest) and E2E tests (Ginkgo/Gomega)"
    - "Add pre-commit hooks for fmt, vet, and lint checks"
    - "Add HEALTHCHECK instruction to Dockerfile for container startup validation"
  priority_2:
    - "Add contract tests for CRD API boundaries"
    - "Add performance/load testing for payload processing throughput"
    - "Consider adding Renovate alongside Dependabot for richer dependency management"
---

# Quality Analysis: ai-gateway-payload-processing

## Executive Summary

- **Overall Score: 7.3/10**
- **Repository**: [opendatahub-io/ai-gateway-payload-processing](https://github.com/opendatahub-io/ai-gateway-payload-processing)
- **Type**: Go Kubernetes controller (Inference Payload Processor for AI Gateway)
- **Primary Language**: Go 1.25
- **Jira**: RHOAIENG / Inference Gateway (midstream tier)
- **Key Strengths**: Excellent test-to-code ratio (1.55x test lines to source lines), comprehensive E2E suite with Kind cluster + Istio + multi-provider coverage, strong FIPS compliance with `GOEXPERIMENT=strictfipsruntime` and UBI9 base images, well-structured Konflux/Tekton pipelines with group testing
- **Critical Gaps**: No coverage tracking/enforcement, no agent rules, no golangci-lint config file
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 8.5/10 | Strong test suite: 33 test files, 11,038 test lines vs 7,135 source lines |
| Integration/E2E | 20% | 8.5/10 | Comprehensive Ginkgo E2E with Kind, Istio, 6 providers, tiered labels |
| Build Integration | 15% | 8.0/10 | PR-triggered CI + Konflux/Tekton pipelines with group testing |
| Image Testing | 10% | 7.0/10 | Multi-stage UBI9, FIPS-compliant, multi-arch, no HEALTHCHECK |
| Coverage Tracking | 10% | 4.0/10 | Coverprofile generated locally, no CI integration or thresholds |
| CI/CD Automation | 15% | 8.0/10 | 6 workflows, path filtering, caching, timeouts, JUnit reporting |
| Static Analysis | 10% | 7.0/10 | golangci-lint v2.9, Dependabot (3 ecosystems), no pre-commit |
| Agent Rules | 5% | 0.0/10 | No CLAUDE.md, AGENTS.md, or .claude/ directory |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Severity**: HIGH
- **Impact**: Coverage regressions go undetected across PRs. No visibility into coverage trends. Team cannot enforce minimum coverage thresholds.
- **Current State**: `make test-unit` generates `cover.out` with `--coverprofile` but deletes it after optional display. No Codecov/Coveralls integration. No PR coverage comments.
- **Effort**: 4-6 hours
- **Fix**: Add `.codecov.yml` with thresholds, integrate `codecov/codecov-action` in CI workflow, retain `cover.out` artifact.

### 2. No Agent Rules for Test Automation
- **Severity**: MEDIUM
- **Impact**: AI-assisted development (Claude Code, Copilot) has no guidance on project-specific test patterns, frameworks, or conventions. Generated tests may not follow the project's testify + envtest + Ginkgo/Gomega patterns.
- **Effort**: 3-4 hours
- **Fix**: Create `CLAUDE.md` with test creation rules, `.claude/rules/unit-tests.md` and `.claude/rules/e2e-tests.md`.

### 3. No Container Health Checks
- **Severity**: MEDIUM
- **Impact**: Dockerfile has no `HEALTHCHECK` instruction. Container startup validation relies entirely on external Kubernetes probe configuration.
- **Effort**: 2-3 hours
- **Fix**: Add `HEALTHCHECK` to Dockerfile; verify probes are defined in Helm chart values.

### 4. No golangci-lint Configuration File
- **Severity**: LOW
- **Impact**: Running `golangci-lint` with defaults only. Missing opportunity for project-specific linter rules (errorlint, gosec, gocritic, revive, etc.).
- **Effort**: 2-3 hours
- **Fix**: Create `.golangci.yml` with comprehensive linter configuration.

## Quick Wins

### 1. Add Codecov Integration (3-4 hours)
Add coverage tracking with PR-level reporting:

```yaml
# .codecov.yml
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

Update `ci-pr-checks.yaml` to upload coverage:
```yaml
- name: Upload coverage
  uses: codecov/codecov-action@v5
  with:
    files: cover.out
    fail_ci_if_error: false
```

Update Makefile to retain `cover.out`:
```makefile
# Remove the `rm -f cover.out` line from test-unit target
```

### 2. Create .golangci.yml (1-2 hours)
```yaml
version: "2"
linters:
  enable:
    - errorlint
    - gocritic
    - gosec
    - revive
    - unused
    - unconvert
    - unparam
    - wastedassign
  settings:
    gosec:
      excludes:
        - G404 # math/rand used for non-security weighted selection
run:
  timeout: 5m
```

### 3. Add CLAUDE.md with Test Rules (2-3 hours)
Create `CLAUDE.md` with project-specific test patterns:
- Unit tests: Go testing + testify (assert/require) + envtest for controller tests
- E2E tests: Ginkgo v2 + Gomega with `ginkgo.Label()` for tiered execution
- Test data: inline YAML manifests via `kubectlApplyLiteral()`
- Coverage: always include `-coverprofile=cover.out`

### 4. Add HEALTHCHECK to Dockerfile (1 hour)
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD ["/bbr", "--health-check"] || exit 1
```

## Detailed Findings

### Unit Tests (8.5/10)

**Strengths**:
- **Excellent test-to-code ratio**: 33 test files covering 45 source files (73% file coverage). 11,038 test lines vs 7,135 source lines (1.55x ratio) — well above industry average
- **Comprehensive plugin testing**: Every plugin has corresponding test files (apikey-injection, api-translation, model-provider-resolver, nemo, stream-usage-enforcer, external-metering, maas-headers-guard)
- **Controller testing with envtest**: `legacymigration/reconciler_test.go` uses `envtest.Environment` with real CRDs, demonstrating proper Kubernetes controller testing patterns
- **Testing frameworks**: Uses both `testify` (assert/require) and standard Go testing, with `t.Helper()` for proper error attribution
- **Multi-provider translator coverage**: Separate test files for each translator (Anthropic, Azure, Bedrock, OpenAI, Vertex OpenAI, Vertex Anthropic)
- **Auth generator testing**: Dedicated tests for API key, GCP OAuth2, and SigV4 auth generators
- **Race detection enabled**: `-race` flag in test command

**Gaps**:
- No `t.Parallel()` usage detected in unit tests — could improve test execution time
- API types test (`api/inference/v1alpha1/types_test.go`) exists but is the only test at the API level

**Key Files**:
- `pkg/plugins/*/plugin_test.go` — Plugin chain tests
- `pkg/plugins/apikey-injection/auth-generator/*_test.go` — Auth generator tests
- `pkg/plugins/api-translation/translator/*/*_test.go` — Multi-provider translator tests
- `pkg/controller/*/reconciler_test.go` — Controller reconciler tests with envtest

### Integration/E2E Tests (8.5/10)

**Strengths**:
- **Comprehensive E2E suite**: Uses Ginkgo v2 + Gomega with proper `BeforeSuite`/`AfterSuite` lifecycle
- **Real cluster testing**: Kind cluster with Istio service mesh, Gateway API CRDs, and full deployment via Helm chart
- **Multi-provider coverage**: Tests 6 providers (OpenAI, Anthropic, Azure OpenAI, Bedrock, Vertex OpenAI) with actual HTTP requests through the gateway
- **Tiered test labels**: `ginkgo.Label("e2e", "tier1", "smoke", "sanity")`, `ginkgo.Label("tier2", "tool-calling")` — enables selective test execution
- **Rich test scenarios**: Basic chat completions, tool calling, multimodal (image), JSON mode, system prompts, multi-turn conversations, API key validation
- **JUnit reporting**: `--ginkgo.junit-report` for CI integration with `mikepenz/action-junit-report`
- **Simulator-based testing**: Uses external simulator (`llm-katan`) for provider-agnostic testing without real API calls
- **E2E container image**: Dedicated `Dockerfile.e2e` for shift-left Jenkins pipeline testing
- **Debug on failure**: Comprehensive debug steps in CI (pod logs, CRD status, curl tests)
- **Automated cluster setup**: `setup-kind.sh` installs Kind, Istio, Gateway API CRDs, CRDs, and deploys the application

**Gaps**:
- No multi-version testing (single K8s version via Kind)
- E2E tests depend on external simulator endpoint (3.147.232.199) — connectivity check skips tests if unreachable

**Key Files**:
- `test/e2e/e2e_test.go` — Main E2E test scenarios (~480 lines)
- `test/e2e/e2e_suite_test.go` — Suite setup with Kubernetes helpers (~210 lines)
- `test/e2e/scripts/setup-kind.sh` — Kind cluster setup (~180 lines)
- `Dockerfile.e2e` — E2E test container for RHOAI shift-left pipeline

### Build Integration (8.0/10)

**Strengths**:
- **PR-triggered CI**: `ci-pr-checks.yaml` runs `make verify` (tidy, vet, fmt, lint) and `make test` on every PR
- **Konflux/Tekton pipelines**: 7 Tekton PipelineRun definitions for PR, push, and stable builds
- **Group testing**: `ai-gateway-group-test.yaml` enables cross-component testing with related repos
- **Path filtering**: Smart change detection with `dorny/paths-filter` — skips CI for non-code changes
- **Code generation verification**: `make verify-codegen` ensures generated deepcopy methods and CRD manifests are up-to-date
- **E2E in CI**: Dedicated `ci-e2e.yaml` workflow builds from source, deploys to Kind, and runs full E2E suite
- **Build from source in E2E**: Kind setup always builds the image from current source, not a stale registry image

**Gaps**:
- No PR-time Konflux simulation in GitHub Actions (Konflux runs separately via Tekton)
- No kustomize build validation in CI (CRDs are in `config/crd/bases/` but not validated beyond codegen)

**Key Files**:
- `.github/workflows/ci-pr-checks.yaml` — PR lint and test
- `.github/workflows/ci-e2e.yaml` — PR E2E tests with Kind
- `.tekton/odh-ai-gateway-payload-processing-ci-on-pull-request.yaml` — Konflux PR build
- `.tekton/ai-gateway-group-test.yaml` — Cross-component group testing

### Image Testing (7.0/10)

**Strengths**:
- **Multi-stage builds**: Builder stage (UBI9 Go toolset) + minimal runtime (UBI9 minimal) — proper separation
- **FIPS compliance**: `GOEXPERIMENT=strictfipsruntime` in both Dockerfile and Dockerfile.e2e
- **UBI9 base images**: `registry.access.redhat.com/ubi9/go-toolset` and `ubi9/ubi-minimal` — FIPS-capable
- **Multi-architecture**: CI release builds for both `linux/amd64` and `linux/arm64` via matrix strategy
- **Pinned base images**: Runtime image uses SHA256 digest pinning (`@sha256:463cae...`)
- **Non-root user**: Both Dockerfiles use `USER 1001`
- **Build arguments**: `COMMIT_SHA` and `BUILD_REF` injected for traceability
- **E2E test image**: Separate `Dockerfile.e2e` with compiled test binary and FIPS-compliant kubectl

**Gaps**:
- No `HEALTHCHECK` instruction in either Dockerfile
- No container startup validation tests in CI (image is built and loaded to Kind, but not independently tested)
- `.dockerignore` not present (may include unnecessary files in build context)

**Key Files**:
- `Dockerfile` — Production multi-stage build
- `Dockerfile.e2e` — E2E test container build
- `.github/actions/docker-build-and-push/action.yaml` — Reusable build action
- `.github/workflows/ci-release.yaml` — Multi-arch release pipeline

### Coverage Tracking (4.0/10)

**Strengths**:
- `make test-unit` generates `coverprofile=cover.out` during test execution
- Optional per-function coverage display with `COVERAGE=true` flag
- `-race` flag detects data races during testing

**Gaps**:
- **No Codecov/Coveralls integration**: Coverage data is generated but not uploaded or tracked
- **No PR coverage reporting**: No coverage comments on PRs, no diff coverage analysis
- **No coverage thresholds**: No minimum coverage gates in CI
- **Coverage file deleted**: `rm -f cover.out` at end of `test-unit` target — data is discarded
- **No coverage trend tracking**: No historical coverage data available

**Key Files**:
- `Makefile:118` — `--coverprofile=cover.out` (generated but deleted)

### CI/CD Automation (8.0/10)

**Strengths**:
- **6 GitHub Actions workflows**:
  - `ci-pr-checks.yaml` — Lint + test on PR/push (path-filtered)
  - `ci-e2e.yaml` — Full E2E on PR/push with Kind + Istio (path-filtered, simulator-conditional)
  - `ci-release.yaml` — Multi-arch image build and push on tags/releases
  - `check-typos.yaml` — Typo detection on PR/push
  - `pr-size-labeler.yml` — Automatic PR size labels (XS to XXL)
  - `promote-main-to-stable.yml` — Manual main-to-stable branch promotion
- **7 Tekton/Konflux pipelines**: PR, push, and stable builds for both main image and E2E image, plus group testing
- **Smart path filtering**: Both `ci-pr-checks` and `ci-e2e` skip when no relevant files changed
- **Concurrency**: Tekton uses `cancel-in-progress: "true"` for PR pipelines
- **Caching**: Go module caching via `actions/setup-go` with `cache-dependency-path`; Docker layer caching via `cache-from: type=gha`
- **Timeout controls**: E2E workflow has `timeout-minutes: 30`; Tekton has `pipeline: 4h` / `tasks: 3h`
- **JUnit reporting**: E2E results uploaded as artifacts and published via `action-junit-report`
- **Multi-arch releases**: Matrix strategy with `ubuntu-latest` (amd64) and `ubuntu-24.04-arm` (arm64), digest-based manifest list creation

**Gaps**:
- No concurrency controls in GitHub Actions workflows (no `concurrency:` key)
- No scheduled/periodic test runs (all triggered by PR/push/tag only)

**Key Files**:
- `.github/workflows/` — 6 workflow files
- `.tekton/` — 7 Tekton PipelineRun definitions
- `.github/actions/docker-build-and-push/action.yaml` — Reusable composite action
- `Makefile` — Build and test targets

### Static Analysis (7.0/10)

#### Linting
- **golangci-lint v2.9.0**: Installed and run via `make lint` in CI (`make verify` target)
- **No `.golangci.yml` config file**: Uses default linters only — missing opportunity for stricter checks
- **`make verify`**: Runs `tidy`, `vet`, `fmt`, `lint` — comprehensive verification pipeline
- **Typo checking**: `crate-ci/typos` action for spell checking

#### FIPS Compatibility
- **FIPS-compliant builds**: Both `Dockerfile` and `Dockerfile.e2e` use `GOEXPERIMENT=strictfipsruntime`
- **UBI9 base images**: FIPS-capable `registry.access.redhat.com/ubi9/go-toolset` and `ubi9/ubi-minimal`
- **CGO_ENABLED=1**: Required for FIPS runtime, properly set in both Dockerfiles and Makefile
- **Local FIPS testing**: `make test-unit GO_STRICTFIPS=true` supports FIPS mode in local development
- **`math/rand/v2` usage**: Used at `pkg/plugins/model-provider-resolver/plugin.go:233` for weighted random model selection — not a security context, acceptable
- **No non-FIPS crypto imports**: No `crypto/md5`, `crypto/des`, or `crypto/rc4` detected in source

#### Dependency Alerts
- **Dependabot configured**: `.github/dependabot.yml` covers 3 ecosystems:
  - `gomod` — Weekly updates with smart ignore rules (skip major K8s updates, manual GAIE updates)
  - `github-actions` — Weekly updates including major versions
  - `docker` — Weekly base image updates
- **Dependency grouping**: Go dependencies grouped; K8s packages grouped separately
- **No Renovate**: Only Dependabot configured

**Key Files**:
- `Makefile` — `lint`, `verify` targets
- `.github/dependabot.yml` — Dependency update configuration
- `.github/workflows/check-typos.yaml` — Typo detection

### Agent Rules (0.0/10)

- **No `CLAUDE.md`**: No project-level AI agent instructions
- **No `AGENTS.md`**: No agent-specific documentation
- **No `.claude/` directory**: No rules, skills, or agent configuration
- **No test creation guidance**: AI agents have no direction on test frameworks, patterns, or conventions
- **Recommendation**: Generate rules with `/test-rules-generator` for this repository

## Recommendations

### Priority 0 (Critical)

1. **Add Codecov integration with coverage thresholds**
   - Add `.codecov.yml` with project target `auto` and patch target `80%`
   - Update `ci-pr-checks.yaml` to upload `cover.out` via `codecov/codecov-action`
   - Remove `rm -f cover.out` from Makefile to retain coverage data
   - Effort: 4-6 hours

2. **Create `.golangci.yml` with comprehensive linter configuration**
   - Enable `errorlint`, `gosec`, `gocritic`, `revive`, `unused`, `unconvert`, `unparam`, `wastedassign`
   - Add project-specific exclusions (e.g., `G404` for acceptable `math/rand` usage)
   - Effort: 2-3 hours

### Priority 1 (High Value)

3. **Create CLAUDE.md and agent rules**
   - Document test patterns: testify (assert/require) for unit tests, envtest for controller tests, Ginkgo/Gomega for E2E
   - Add `.claude/rules/unit-tests.md` with patterns for plugin and translator testing
   - Add `.claude/rules/e2e-tests.md` with Ginkgo label conventions and provider test patterns
   - Effort: 3-4 hours

4. **Add pre-commit hooks**
   - Configure `.pre-commit-config.yaml` with `go fmt`, `go vet`, `golangci-lint`
   - Enforce consistent code style before commits reach CI
   - Effort: 1-2 hours

5. **Add HEALTHCHECK to Dockerfile**
   - Add health check endpoint to the application
   - Add `HEALTHCHECK` instruction for container-level validation
   - Effort: 2-3 hours

### Priority 2 (Nice-to-Have)

6. **Add contract tests for CRD API boundaries**
   - Validate ExternalModel and ExternalProvider CRD schemas against expected contracts
   - Effort: 4-6 hours

7. **Add multi-version Kubernetes testing**
   - Extend E2E matrix to test against multiple K8s versions
   - Effort: 4-8 hours

8. **Add concurrency controls to GitHub Actions**
   - Add `concurrency:` key to prevent duplicate workflow runs on rapid pushes
   - Effort: 1 hour

9. **Add `.dockerignore`**
   - Exclude unnecessary files from Docker build context (docs, test, .github, .tekton)
   - Effort: 30 minutes

## Comparison to Gold Standards

| Practice | ai-gateway-payload-processing | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|----------|-------------------------------|----------------------|-------------------|---------------|
| Test-to-code ratio | 1.55x (excellent) | ~0.8x | ~0.5x | ~0.7x |
| E2E framework | Ginkgo + Kind + Istio | Cypress + Playwright | Custom scripts | Ginkgo + Kind |
| Coverage tracking | Local only, no CI | Codecov with thresholds | Basic | Codecov enforced |
| FIPS compliance | strictfipsruntime + UBI9 | N/A (frontend) | UBI-based | UBI-based |
| Multi-arch | amd64 + arm64 | amd64 | Multi-arch matrix | amd64 |
| Dependency mgmt | Dependabot (3 ecosystems) | Dependabot | Dependabot | Dependabot |
| Agent rules | None | Comprehensive | None | Basic |
| Konflux/Tekton | 7 pipelines + group test | Yes | Yes | Yes |
| Container testing | Build + Kind deploy | Build + test | 5-layer validation | Build + envtest |
| Pre-commit hooks | None | Yes | None | Yes |

## File Paths Reference

### CI/CD
- `.github/workflows/ci-pr-checks.yaml` — PR lint and test
- `.github/workflows/ci-e2e.yaml` — PR E2E tests
- `.github/workflows/ci-release.yaml` — Multi-arch release
- `.github/workflows/check-typos.yaml` — Typo detection
- `.github/workflows/pr-size-labeler.yml` — PR size labels
- `.github/workflows/promote-main-to-stable.yml` — Branch promotion
- `.github/actions/docker-build-and-push/action.yaml` — Reusable build action
- `.tekton/*.yaml` — 7 Konflux/Tekton pipeline definitions

### Testing
- `pkg/plugins/*/plugin_test.go` — Plugin unit tests
- `pkg/plugins/apikey-injection/auth-generator/*_test.go` — Auth generator tests
- `pkg/plugins/api-translation/translator/*/*_test.go` — Translator tests
- `pkg/controller/*/reconciler_test.go` — Controller tests (envtest)
- `test/e2e/e2e_test.go` — E2E test scenarios
- `test/e2e/e2e_suite_test.go` — E2E suite setup
- `test/e2e/scripts/setup-kind.sh` — Kind cluster setup

### Build
- `Dockerfile` — Production multi-stage build (UBI9, FIPS)
- `Dockerfile.e2e` — E2E test container
- `Makefile` — Build, test, lint targets
- `deploy/payload-processing/` — Helm chart

### Static Analysis
- `.github/dependabot.yml` — Dependency update configuration
- `Makefile` — `verify`, `lint`, `fmt`, `vet` targets

### Configuration
- `go.mod` — Go module (Go 1.25)
- `config/crd/bases/` — CRD YAML manifests
- `api/inference/v1alpha1/` — CRD Go types
