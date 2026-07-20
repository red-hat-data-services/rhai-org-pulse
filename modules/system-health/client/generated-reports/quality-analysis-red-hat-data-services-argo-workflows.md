---
repository: "red-hat-data-services/argo-workflows"
upstream: "argoproj/argo-workflows"
jira_project: "RHOAIENG"
jira_component: "AI Pipelines"
tier: "downstream"
overall_score: 7.4
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "236 Go test files with good coverage generation; UI test coverage is weak (11/250 files)"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Comprehensive E2E suite with 29 test files, multi-version K8s testing (v1.28-v1.31), 13 matrix combos"
  - dimension: "Build Integration"
    score: 8.0
    status: "Tekton/Konflux PR pipelines with hermetic multi-arch builds; GitHub CI builds Docker images on PRs"
  - dimension: "Image Testing"
    score: 6.5
    status: "Multi-stage UBI9 builds with multi-arch support; no runtime validation or Testcontainers"
  - dimension: "Coverage Tracking"
    score: 6.0
    status: "Codecov configured but only uploads on main; no PR coverage reporting; 2% threshold"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "Excellent workflow automation with concurrency, caching, matrix testing, and changed-file detection"
  - dimension: "Static Analysis"
    score: 8.0
    status: "16+ golangci-lint rules, GOFIPS140 in builds, Dependabot + Renovate, SHA-pinned actions"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory present"
critical_gaps:
  - title: "No PR-time coverage reporting"
    impact: "Developers cannot see coverage impact of their changes before merge"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No container runtime validation"
    impact: "Image startup and runtime issues not caught until deployment"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI-generated code lacks project-specific test and coding guidance"
    severity: "LOW"
    effort: "2-4 hours"
  - title: "Weak UI test coverage"
    impact: "UI regressions not caught before merge; 11 test files for 250 source files"
    severity: "MEDIUM"
    effort: "16-24 hours"
quick_wins:
  - title: "Enable PR coverage reporting in Codecov"
    effort: "1-2 hours"
    impact: "Developers see coverage delta on every PR, preventing coverage regressions"
  - title: "Add basic agent rules for test patterns"
    effort: "2-3 hours"
    impact: "Improve consistency of AI-generated tests and code contributions"
  - title: "Add pre-commit hooks"
    effort: "1-2 hours"
    impact: "Catch linting and formatting issues before CI, faster feedback loop"
recommendations:
  priority_0:
    - "Enable Codecov PR coverage comments and enforce coverage thresholds on patches"
    - "Add container runtime validation for argoexec and workflow-controller images"
  priority_1:
    - "Increase UI test coverage from 4% to at least 30% of components"
    - "Create CLAUDE.md with project-specific test patterns and coding guidelines"
    - "Add pre-commit hooks for Go formatting and linting"
  priority_2:
    - "Add contract tests between workflow-controller and argoexec components"
    - "Consider Windows unit test re-enablement with FIPS-compatible toolchain"
---

# Quality Analysis: red-hat-data-services/argo-workflows

## Executive Summary

- **Overall Score: 7.4/10**
- **Repository Type**: Go-based Kubernetes workflow engine (downstream fork)
- **Upstream**: argoproj/argo-workflows
- **Jira**: RHOAIENG / AI Pipelines
- **Key Strengths**: Excellent CI/CD automation with smart changed-file detection, comprehensive E2E test suite with multi-version K8s testing, strong Konflux integration with hermetic multi-arch builds, well-configured static analysis with FIPS compliance
- **Critical Gaps**: No PR-time coverage reporting, no container runtime validation, no agent rules, weak UI test coverage
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 7.0/10 | 15% | 1.05 | 236 Go test files, weak UI coverage |
| Integration/E2E | 8.5/10 | 20% | 1.70 | 29 E2E tests, multi-K8s versions, K3S |
| Build Integration | 8.0/10 | 15% | 1.20 | Konflux PR pipelines, multi-arch |
| Image Testing | 6.5/10 | 10% | 0.65 | UBI9 multi-stage, no runtime validation |
| Coverage Tracking | 6.0/10 | 10% | 0.60 | Codecov on main only, no PR reporting |
| CI/CD Automation | 9.0/10 | 15% | 1.35 | Concurrency, caching, matrix, smart skips |
| Static Analysis | 8.0/10 | 10% | 0.80 | 16+ linters, GOFIPS140, Dependabot+Renovate |
| Agent Rules | 0.0/10 | 5% | 0.00 | No agent rules present |
| **Overall** | **7.4/10** | **100%** | **7.35** | |

## Critical Gaps

### 1. No PR-time Coverage Reporting
- **Severity**: MEDIUM
- **Impact**: Coverage is generated (`--coverprofile=coverage.out`) but only uploaded to Codecov on the `main` branch. PR authors cannot see how their changes affect coverage before merging.
- **Effort**: 2-4 hours
- **Evidence**: `ci-build.yaml` line 137: `if: github.ref == 'refs/heads/main'` gates Codecov upload. Patch coverage is explicitly disabled: `patch: off`.

### 2. No Container Runtime Validation
- **Severity**: HIGH
- **Impact**: Images are built in CI but never tested for startup, correct entrypoint behavior, or health. Runtime issues (missing libraries, permission errors) surface only during deployment.
- **Effort**: 4-8 hours
- **Evidence**: CI builds and uploads images as artifacts for E2E but does not validate the images themselves (no `docker run`, no Testcontainers, no health check validation).

### 3. Weak UI Test Coverage
- **Severity**: MEDIUM
- **Impact**: Only 11 test files for 250 TypeScript source files (~4.4% ratio). UI regressions may go undetected.
- **Effort**: 16-24 hours
- **Evidence**: `find ui -name '*.test.*'` returns 11 files. Most component and page files have no corresponding test.

### 4. No Agent Rules
- **Severity**: LOW
- **Impact**: AI coding assistants have no project-specific guidance for test patterns, coding standards, or contribution guidelines.
- **Effort**: 2-4 hours
- **Evidence**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory found.

## Quick Wins

### 1. Enable PR Coverage Reporting (1-2 hours)
Remove the `if: github.ref == 'refs/heads/main'` condition on Codecov upload, and re-enable patch coverage in `.codecov.yml`:

```yaml
# .codecov.yml
coverage:
  status:
    patch:
      default:
        threshold: 5%
    project:
      default:
        threshold: 2
```

### 2. Add Basic Agent Rules (2-3 hours)
Create `CLAUDE.md` at the repo root with Go test patterns, E2E test fixture conventions, and the project's code organization. Use `/test-rules-generator` to bootstrap.

### 3. Add Pre-commit Hooks (1-2 hours)
Create `.pre-commit-config.yaml` with golangci-lint, gofmt, and yaml linting to catch issues before CI:

```yaml
repos:
  - repo: https://github.com/golangci/golangci-lint
    rev: v2.1.6
    hooks:
      - id: golangci-lint
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
```

## Detailed Findings

### Unit Tests

**Score: 7.0/10**

| Metric | Value |
|--------|-------|
| Go test files | 236 |
| Go source files | 554 |
| Test-to-code ratio (Go) | 0.43 |
| UI test files | 11 |
| UI source files | 250 |
| Test-to-code ratio (UI) | 0.04 |
| Framework (Go) | `go test` with `-p 20` parallelization |
| Framework (UI) | Jest/yarn test |
| Coverage generation | `--covermode=atomic --coverprofile=coverage.out` |

**Strengths:**
- Solid Go test-to-code ratio (0.43)
- Test parallelization with `-p 20` for speed
- Coverage profile generation in CI
- Build tags for test organization (api, cli, cron, executor, functional, plugins)

**Weaknesses:**
- UI test coverage is critically low (4.4%)
- Windows unit tests disabled due to FIPS/go-toolset incompatibility
- No test isolation patterns (e.g., `t.Parallel()`) enforced

### Integration/E2E Tests

**Score: 8.5/10**

| Metric | Value |
|--------|-------|
| E2E test files | 29 |
| E2E directory | `test/e2e/` |
| K8s versions tested | v1.28.13 (min), v1.31.0 (max) |
| Cluster setup | K3S |
| Matrix combinations | 13 |
| Test suites | executor, corefunctional, functional, api, cli, cron, examples, plugins, java-sdk, python-sdk |
| Fixture pattern | BDD (given/when/then) |
| Timeout | 60 minutes |

**Strengths:**
- Comprehensive E2E matrix covering all major features
- Multi-version K8s testing (min/max versions)
- BDD-style test fixtures with `given.go`, `when.go`, `then.go`
- SDK integration tests (Java and Python)
- Extensive failure debugging steps (k3s logs, pod descriptions, workflow logs)
- Changed-file detection to skip E2E when irrelevant files change

**Weaknesses:**
- No OCP-specific testing (only K3S/upstream K8s)
- E2E only runs on changed files matching Go/manifest patterns

### Build Integration

**Score: 8.0/10**

| Metric | Value |
|--------|-------|
| PR Docker builds | Yes (argoexec, argocli via GitHub Actions) |
| Konflux PR pipelines | Yes (argoexec, workflowcontroller via Tekton) |
| Hermetic builds | Yes |
| Multi-arch support | x86_64, arm64, ppc64le |
| Kustomize overlays | 10+ kustomization.yaml files |
| Buildx caching | GHA cache (cache-from, cache-to) |
| Dockerfile variants | 8 (upstream, RHOAI, Konflux, ODH × 2 components) |

**Strengths:**
- Tekton/Konflux PR pipelines with hermetic builds and multi-arch
- GitHub Actions CI builds images and uses them in E2E tests
- ODH-specific Dockerfiles with cross-platform build support (`BUILDPLATFORM`, `TARGETOS`, `TARGETARCH`)
- Kustomize manifests well-organized (base, cluster-install, namespace-install, quick-start profiles)

**Weaknesses:**
- Konflux builds are comment/label-triggered (`/build-konflux`), not automatic on every PR
- No kustomize build validation in CI (no `kustomize build --dry-run`)

### Image Testing

**Score: 6.5/10**

| Metric | Value |
|--------|-------|
| Dockerfiles | 8 total across upstream/RHOAI/Konflux/ODH |
| Multi-stage builds | Yes, all |
| Base images (downstream) | UBI9 (go-toolset:1.26.3, ubi-minimal) |
| Base images (upstream) | golang:alpine, distroless/static-debian13 |
| Non-root user | Yes (USER 8737 or USER 2000) |
| Multi-arch | x86_64, arm64, ppc64le |
| HEALTHCHECK | Not in Dockerfiles |
| Runtime validation | None |
| Testcontainers | Not used |
| Image pinning | SHA256 digest pinning on base images |

**Strengths:**
- UBI9 base images for all downstream builds (FIPS-capable)
- SHA256 digest pinning for reproducible builds
- Non-root execution enforced
- Multi-arch builds in Konflux (3 architectures)

**Weaknesses:**
- No container runtime validation (no `docker run` smoke tests)
- No `HEALTHCHECK` instruction in Dockerfiles
- No Testcontainers for integration testing
- Health probes only defined in K8s manifests, not validated in CI

### Coverage Tracking

**Score: 6.0/10**

| Metric | Value |
|--------|-------|
| Coverage tool | Codecov |
| Config file | `.codecov.yml` |
| Coverage generation | `--covermode=atomic --coverprofile=coverage.out` |
| PR reporting | Disabled (only uploads on main) |
| Patch coverage | Explicitly disabled (`patch: off`) |
| Threshold | 2% drop allowed |
| Generated code exclusion | Yes (pb.go, deepcopy, generated, client, vendor) |

**Strengths:**
- Coverage is generated during CI test runs
- Generated code properly excluded from coverage calculations
- Codecov integration configured

**Weaknesses:**
- Coverage only uploaded on `main` branch, not on PRs
- Patch coverage explicitly disabled with comment "we've found this not to be useful"
- 2% threshold is lenient -- allows gradual coverage erosion
- No PR coverage comments for developer feedback

### CI/CD Automation

**Score: 9.0/10**

| Metric | Value |
|--------|-------|
| Workflows | 11 (CI, build-main, release, PR, docs, SDKs, dependabot-reviewer, retest, stale, changelog, snyk) |
| PR-triggered | CI (tests, lint, codegen, E2E, UI), PR title check |
| Concurrency control | All major workflows |
| Caching | Go modules, Docker buildx GHA, Node modules, Maven, pip |
| Test parallelization | `go test -p 20`, E2E matrix with 13 combos |
| Changed-file detection | Smart file grouping (tests, e2e-tests, codegen, lint, ui) |
| Timeout controls | All jobs have explicit timeouts |
| SHA-pinned actions | Yes, enforced by lint step |

**Strengths:**
- Smart changed-file detection skips irrelevant CI jobs (saves CI time and cost)
- Concurrency control with `cancel-in-progress` on all workflows
- Comprehensive caching strategy (Go, Docker, Node, Maven, pip)
- E2E matrix runs 13 different test combinations
- SHA-pinned GitHub Actions with enforcement step
- `/test` comment support for re-running CI
- Retest workflow for selective re-execution
- Dependabot auto-reviewer workflow

**Weaknesses:**
- No scheduled/periodic test runs beyond Dependabot
- Some E2E combos share the same profile which could be consolidated

### Static Analysis

**Score: 8.0/10**

#### Linting
- **golangci-lint v2** with 16+ linters: asasalint, bidichk, bodyclose, copyloopvar, errcheck, gosec (selective), govet, ineffassign, misspell, nakedret, nosprintfhostport, reassign, rowserrcheck, sqlclosecheck, staticcheck, testifylint, unparam, unused
- Formatters: gofmt, goimports with local prefix ordering
- Proper exclusion of generated, vendor, and non-Go directories
- Markdown linting (`.markdownlint.yaml`)
- Link checking (`.mlc_config.json`)

#### FIPS Compatibility
- **GOFIPS140=v1.0.0** set in all Konflux and ODH Dockerfiles
- `-tags no_openssl` build flag used
- `CGO_ENABLED=0` for static builds
- UBI9 base images (FIPS-capable)
- Minor: `math/rand` imported in `workflow/util/util.go` (non-crypto context, low risk)
- Windows tests disabled specifically because "godebug fips140=auto requires Red Hat go-toolset"

#### Dependency Alerts
- **Dependabot**: Configured for gomod, npm, pip, github-actions with weekly Saturday schedule
- **Renovate**: Configured, extending from `red-hat-data-services/konflux-central`
- Security-only updates (open-pull-requests-limit: 0 for non-security)
- Selective ignores for k8s.io, grpc dependencies

### Agent Rules

**Score: 0.0/10**

- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **Coverage**: No test type rules, no coding guidelines, no project-specific patterns
- **Quality**: N/A
- **Gaps**: All agent rules missing
- **Recommendation**: Generate rules with `/test-rules-generator` to create:
  - Go unit test patterns (table-driven tests, test isolation)
  - E2E test fixture conventions (given/when/then BDD pattern)
  - Coding standards (error handling, naming conventions)
  - Build and contribution workflow guidance

## Recommendations

### Priority 0 (Critical)

1. **Enable Codecov PR coverage comments** -- Remove the `main`-branch-only gate on Codecov upload and re-enable patch coverage. This gives developers immediate feedback on coverage impact.
2. **Add container runtime smoke tests** -- After building images in CI, run basic `docker run --entrypoint /bin/argoexec help` and `docker run --entrypoint /bin/workflow-controller --help` to validate startup.

### Priority 1 (High Value)

1. **Increase UI test coverage** -- Add tests for critical UI components (workflow list, DAG view, log viewer). Current 4.4% ratio is a regression risk.
2. **Create CLAUDE.md with project conventions** -- Document Go test patterns, E2E fixture usage, commit message format, and code organization.
3. **Add pre-commit hooks** -- Enforce formatting and linting locally before CI.
4. **Add kustomize build validation** -- Run `kustomize build` on all overlays in CI to catch manifest errors early.

### Priority 2 (Nice-to-Have)

1. **Contract tests between workflow-controller and argoexec** -- Validate the interface contract between these two core components.
2. **Re-enable Windows unit tests** -- When Red Hat go-toolset becomes available on Windows runners.
3. **Add periodic/scheduled test runs** -- Run the full E2E suite on a schedule to catch flaky tests and infrastructure regressions.
4. **UI accessibility testing** -- Add axe-core or similar for automated accessibility checks.

## Comparison to Gold Standards

| Dimension | argo-workflows | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit Tests | 7.0 | 9.0 | 6.0 | 8.0 |
| Integration/E2E | 8.5 | 8.5 | 7.0 | 9.0 |
| Build Integration | 8.0 | 8.0 | 8.0 | 7.0 |
| Image Testing | 6.5 | 7.0 | 9.0 | 6.0 |
| Coverage Tracking | 6.0 | 8.0 | 5.0 | 8.0 |
| CI/CD Automation | 9.0 | 9.0 | 7.0 | 8.0 |
| Static Analysis | 8.0 | 8.0 | 6.0 | 7.0 |
| Agent Rules | 0.0 | 8.0 | 2.0 | 2.0 |
| **Overall** | **7.4** | **8.4** | **6.6** | **7.2** |

**Key Takeaway**: argo-workflows has best-in-class CI/CD automation and E2E testing. Its main gaps are coverage visibility on PRs, runtime image validation, and agent rules -- all addressable with moderate effort.

## File Paths Reference

### CI/CD
- `.github/workflows/ci-build.yaml` -- Main CI (tests, lint, E2E, codegen, UI)
- `.github/workflows/build-main.yml` -- Image builds on main push
- `.github/workflows/pr.yaml` -- PR title semantic check
- `.github/workflows/release.yaml` -- Release workflow with multi-arch
- `.tekton/odh-data-science-pipelines-argo-argoexec-pull-request.yaml` -- Konflux PR pipeline
- `.tekton/odh-data-science-pipelines-argo-workflowcontroller-pull-request.yaml` -- Konflux PR pipeline
- `Makefile` -- Build/test/lint targets

### Testing
- `test/e2e/` -- E2E test suite (29 test files)
- `test/e2e/fixtures/` -- BDD test fixtures (given/when/then)
- `test/e2e/testdata/` -- Test workflow manifests
- `test/e2e/manifests/` -- E2E cluster setup manifests
- `hack/k8s-versions.sh` -- K8s version configuration

### Container Images
- `Dockerfile` -- Upstream multi-stage build
- `rhoai/Dockerfile.workflowcontroller` -- RHOAI UBI8 build
- `rhoai/Dockerfile.argoexec` -- RHOAI UBI8 build
- `argo-workflowcontroller/Dockerfile.konflux` -- Konflux UBI9 build
- `argo-argoexec/Dockerfile.konflux` -- Konflux UBI9 build
- `argo-workflowcontroller/Dockerfile.ODH` -- ODH UBI9 build
- `argo-argoexec/Dockerfile.ODH` -- ODH UBI9 build

### Code Quality
- `.golangci.yml` -- 16+ linters configured
- `.codecov.yml` -- Coverage configuration
- `.github/dependabot.yml` -- Dependency alerts (gomod, npm, pip, actions)
- `renovate.json` -- Renovate config (extends from konflux-central)
- `.markdownlint.yaml` -- Markdown linting
