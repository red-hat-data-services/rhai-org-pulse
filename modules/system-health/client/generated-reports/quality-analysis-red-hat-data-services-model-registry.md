---
repository: "red-hat-data-services/model-registry"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "Strong Go/Python/TS test suites with 171 Go test files, 39 Python, 36 TS — good test-to-code ratio (~0.33 for Go)"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Comprehensive E2E with Kind clusters, multi-K8s-version matrix (v1.33/v1.34), multi-DB (MySQL/PostgreSQL), Cypress mocked E2E, fuzz testing"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-triggered image build + Kind deployment + Python client smoke test; operator manifest validation; controller and CSI build validation"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-stage UBI9 builds, multi-arch support (BUILDPLATFORM/TARGETARCH), Kind load + deploy validation; no HEALTHCHECK or Testcontainers"
  - dimension: "Coverage Tracking"
    score: 7.5
    status: "Codecov integration with fail_ci_if_error for Go and Python E2E; coverprofile in Makefile; no coverage thresholds enforced"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "35 workflows covering build, test, lint, E2E, fuzz, scorecard; PR-triggered for core paths; limited concurrency control and no caching"
  - dimension: "Static Analysis"
    score: 7.5
    status: "golangci-lint, pre-commit hooks (ruff, file checks), Dependabot (gomod/pip/docker/npm/actions), FIPS via Konflux Dockerfile; no golangci config at root"
  - dimension: "Agent Rules"
    score: 8.5
    status: "Comprehensive AGENTS.md (379 lines) with repo map, behavior policy, context awareness; .agents/skills/ with custom skills; CLAUDE.md symlink"
critical_gaps:
  - title: "No coverage threshold enforcement"
    impact: "Coverage can regress without CI catching it — no minimum percentage gates on PRs"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No HEALTHCHECK in Dockerfiles"
    impact: "Container orchestrators cannot detect unhealthy containers at the image level"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "Limited CI concurrency control"
    impact: "Only 1 of 35 workflows has concurrency settings; parallel PR pushes can waste CI resources"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No CI caching strategy"
    impact: "Go module downloads and Docker layer builds repeat on every run, increasing CI time and cost"
    severity: "MEDIUM"
    effort: "3-4 hours"
  - title: "Missing root-level golangci-lint config"
    impact: "Only BFF has a golangci config; core Go code uses default linter rules which may miss issues"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add coverage thresholds to Codecov config"
    effort: "1-2 hours"
    impact: "Prevent coverage regressions with .codecov.yml threshold enforcement"
  - title: "Add concurrency groups to PR workflows"
    effort: "1-2 hours"
    impact: "Cancel stale runs on new pushes, saving CI resources"
  - title: "Add Go module caching to CI workflows"
    effort: "1-2 hours"
    impact: "Speed up CI builds by caching Go modules and build artifacts"
  - title: "Create root-level .golangci.yaml with stricter linters"
    effort: "2-3 hours"
    impact: "Catch more issues in core Go code with consistent linting rules"
recommendations:
  priority_0:
    - "Create .codecov.yml with coverage thresholds (e.g., 70% project, 50% patch) to prevent regression"
    - "Add concurrency control to all PR-triggered workflows to cancel superseded runs"
  priority_1:
    - "Add Go module and Docker layer caching across CI workflows"
    - "Create root-level .golangci.yaml with expanded linter set (errcheck, govet, staticcheck, gosimple, unused)"
    - "Add HEALTHCHECK instructions to Dockerfiles for runtime container health validation"
  priority_2:
    - "Add timeout-minutes to all workflow jobs to prevent stuck CI runs"
    - "Consider adding contract tests between Python client and Go server API"
    - "Add Testcontainers-based runtime validation for built images"
---

# Quality Analysis: red-hat-data-services/model-registry

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Polyglot Go/Python/TypeScript — Kubernetes model registry service with operator, CSI driver, Python client, and React UI
- **JIRA**: RHOAIENG / AI Hub (downstream tier)
- **Key Strengths**: Excellent E2E testing with Kind clusters and multi-version matrix; strong agent rules (AGENTS.md); comprehensive PR build validation with operator deployment; Codecov integration; FIPS-ready Konflux builds; fuzz testing
- **Critical Gaps**: No coverage threshold enforcement; no CI caching; limited concurrency control; missing root golangci config
- **Agent Rules Status**: Present and comprehensive — AGENTS.md (379 lines), CLAUDE.md symlink, .agents/skills/ with custom skills

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 8.0/10 | 15% | Strong Go/Python/TS test suites — 171 Go, 39 Python, 36 TS test files |
| Integration/E2E | 8.5/10 | 20% | Multi-K8s-version Kind E2E, multi-DB matrix, Cypress, fuzz testing |
| Build Integration | 8.0/10 | 15% | PR image build → Kind deploy → Python client smoke test |
| Image Testing | 7.0/10 | 10% | Multi-stage UBI9, multi-arch; no HEALTHCHECK or Testcontainers |
| Coverage Tracking | 7.5/10 | 10% | Codecov with fail_ci_if_error; no threshold enforcement |
| CI/CD Automation | 8.0/10 | 15% | 35 workflows; path-filtered PR triggers; lacks caching/concurrency |
| Static Analysis | 7.5/10 | 10% | golangci-lint, pre-commit, Dependabot (5 ecosystems), FIPS builds |
| Agent Rules | 8.5/10 | 5% | Comprehensive AGENTS.md with repo map, behavior policy, custom skills |

## Critical Gaps

### 1. No Coverage Threshold Enforcement
- **Impact**: Coverage can silently regress on PRs without CI failing
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Codecov is integrated and `fail_ci_if_error: true` is set, but there is no `.codecov.yml` defining minimum thresholds. Without threshold gates, coverage reporting is informational only.

### 2. No HEALTHCHECK in Dockerfiles
- **Impact**: Container health not validated at the image level; relies solely on K8s probes
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: None of the 4 Dockerfiles (Dockerfile, Dockerfile.konflux, Dockerfile.odh, Dockerfile.testops) include a HEALTHCHECK instruction.

### 3. Limited CI Concurrency Control
- **Impact**: Concurrent PR pushes can run duplicate workflows, wasting CI resources
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: Only `gh-workflow-approve.yml` (1 of 35 workflows) has a `concurrency:` block. All PR-triggered workflows should cancel superseded runs.

### 4. No CI Caching Strategy
- **Impact**: Every CI run re-downloads Go modules and re-builds Docker layers from scratch
- **Severity**: MEDIUM
- **Effort**: 3-4 hours
- **Details**: No `cache:` directives found in any workflow. `actions/setup-go` supports built-in caching via `cache: true`.

### 5. Missing Root-Level golangci-lint Configuration
- **Impact**: Core Go code uses default linter rules which are minimal
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: Only `clients/ui/bff/.golangci.yaml` exists (basic exclusion config). The Makefile runs `golangci-lint` on core paths but with no configuration file at root. A root config with expanded linters would catch more issues.

## Quick Wins

### 1. Add .codecov.yml with Coverage Thresholds (1-2 hours)
```yaml
# .codecov.yml
coverage:
  status:
    project:
      default:
        target: 70%
        threshold: 2%
    patch:
      default:
        target: 50%
comment:
  layout: "reach,diff,flags,files"
  behavior: default
```

### 2. Add Concurrency Groups to PR Workflows (1-2 hours)
Add to all PR-triggered workflows:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

### 3. Enable Go Module Caching in CI (1-2 hours)
Update `actions/setup-go` steps:
```yaml
- uses: actions/setup-go@v6
  with:
    go-version: "1.26.3"
    cache: true
```

### 4. Create Root .golangci.yaml (2-3 hours)
```yaml
version: "2"
linters:
  enable:
    - errcheck
    - govet
    - staticcheck
    - gosimple
    - unused
    - ineffassign
    - typecheck
    - misspell
    - gofmt
  exclusions:
    generated: lax
    presets:
      - comments
      - common-false-positives
```

## Detailed Findings

### Unit Tests

**Score: 8.0/10**

- **Go**: 171 test files for 520 source files (ratio: 0.33). Uses standard `testing` package with table-driven tests and `t.Run()` subtests. Ginkgo/Gomega used for controller tests (envtest-based).
- **Python**: 39 test files for 210 source files. Uses pytest with Nox for session management. Separate lint, mypy, tests, e2e, and fuzz sessions.
- **TypeScript**: 36 test files (`.spec.ts`, `.test.tsx`). Jest/Vitest for unit tests.
- **Test Isolation**: Good — controller tests use envtest, Python tests use fixtures, Go tests use testdata directories.
- **Strengths**: Multi-language test coverage, well-organized test directories, fuzz testing capability.
- **Gaps**: No `t.Parallel()` usage detected in sampled Go tests.

### Integration/E2E Tests

**Score: 8.5/10**

- **Kind Cluster E2E**: PR workflow builds image → loads into Kind → deploys operator → creates test registry → validates with Python client. Full end-to-end deployment validation.
- **Multi-Version Testing**: Matrix strategy tests against K8s v1.33.7 and v1.34.3.
- **Multi-Database Testing**: E2E matrix covers both MySQL (`db`) and PostgreSQL (`postgres`) backends.
- **Python E2E**: Nox `e2e` session deploys to Kind, port-forwards, runs full client integration tests.
- **Catalog E2E**: Separate Kind-based E2E for catalog service.
- **CSI E2E**: Dedicated Kind-based E2E for storage initializer.
- **Cypress Tests**: 20+ mocked Cypress tests for UI covering model registry, model catalog, settings pages.
- **Fuzz Testing**: Both on-merge and on-demand fuzz testing against both databases.
- **Async Upload Tests**: Dedicated integration and E2E tests for async upload job.
- **Gaps**: Cypress tests are mocked only (no live backend E2E for UI).

### Build Integration

**Score: 8.0/10**

- **PR Build Validation** (`build-image-pr.yml`): Builds Docker image → starts Kind → loads image → deploys operator via kustomize → creates ModelRegistry CR → waits for availability → validates with Python client. This is excellent end-to-end PR validation.
- **Controller Build** (`controller-test.yml`): PR-triggered, runs controller tests and builds controller image.
- **CSI Build** (`csi-test.yml`): PR-triggered, builds MR and CSI images → deploys to Kind → runs E2E tests.
- **UI Build** (`build-image-ui-pr.yml`, `ui-bff-build.yml`, `ui-frontend-build.yml`): PR-triggered UI builds.
- **Konflux**: Dedicated `Dockerfile.konflux` with FIPS-compliant build and Tekton pipeline configs in `.tekton/`.
- **OpenAPI Validation** (`check-openapi-spec-pr.yaml`): PR-triggered check for OpenAPI spec changes.
- **DB Schema Check** (`check-db-schema-structs.yaml`): PR-triggered database schema struct validation.
- **Strengths**: Comprehensive PR-time validation including Kind deployment — significantly above average.
- **Gaps**: No PR-time Konflux simulation (relies on Tekton pipeline); build-and-push workflows lack caching.

### Image Testing

**Score: 7.0/10**

- **Multi-Stage Builds**: All Dockerfiles use multi-stage builds (builder → minimal runtime).
- **Base Images**: All UBI9-based (FIPS-capable) — `ubi9/go-toolset:1.26` builder, `ubi9/ubi-minimal` runtime, `ubi9/python-312` for testops.
- **Multi-Architecture**: Main Dockerfile supports multi-arch via `--platform=$BUILDPLATFORM` and `TARGETARCH` args. Konflux and ODH Dockerfiles are single-arch.
- **Kind Load Testing**: Images are loaded into Kind clusters and validated through deployment.
- **Docker Compose**: Available for local development with MySQL and PostgreSQL backends, includes healthchecks for databases.
- **Gaps**: No HEALTHCHECK instructions in any Dockerfile; no Testcontainers for programmatic runtime validation; Dockerfile.konflux pins image digests (good security practice) but others use `latest` tags.

### Coverage Tracking

**Score: 7.5/10**

- **Go Coverage**: `make test-cover` generates `coverage.txt` via `--coverprofile`. Uploaded to Codecov in `build.yml` with `fail_ci_if_error: true`.
- **Python E2E Coverage**: `--cov-report=xml` generates `coverage.xml`, uploaded to Codecov (conditional on Python 3.12 runs).
- **Catalog Coverage**: Separate `make -C catalog test-cover` target.
- **Codecov Token**: Properly configured with `secrets.CODECOV_TOKEN`.
- **Gaps**: No `.codecov.yml` file — no threshold enforcement, no PR coverage reporting configuration, no coverage gates. Coverage is reported but not gated.

### CI/CD Automation

**Score: 8.0/10**

- **Workflow Count**: 35 workflow files covering builds, tests, linting, E2E, fuzz, security scanning, branch sync, stale issue management, scorecard, and releases.
- **PR Triggers**: Core workflows (build.yml, build-image-pr.yml, python-tests.yml, controller-test.yml, csi-test.yml, async-upload-test.yml) are PR-triggered with smart path filtering.
- **Path Filtering**: Workflows use `paths:` and `paths-ignore:` to avoid unnecessary runs.
- **OpenSSF Scorecard**: Dedicated scorecard workflow for supply chain security.
- **Tekton**: `.tekton/` directory with Konflux pipeline configs for downstream builds.
- **Matrix Strategies**: Python tests use matrix for Python versions (3.10-3.14), K8s versions, and database backends. Fuzz tests matrix over database backends.
- **Concurrency**: Only `gh-workflow-approve.yml` has concurrency control.
- **Gaps**: No `cache:` directives anywhere; no `timeout-minutes:` on jobs; only 1 workflow has concurrency control; no test parallelization within individual jobs.

### Static Analysis

**Score: 7.5/10**

#### Linting
- **Go**: `golangci-lint` used via Makefile (`make lint`). BFF has `.golangci.yaml` config. No root-level config for core Go code — runs with defaults.
- **Python**: Ruff for linting and formatting (via pre-commit), mypy for type checking (via Nox), nox sessions for lint/mypy.
- **TypeScript**: ESLint configured for frontend (`clients/ui/frontend/.eslintrc.cjs`).

#### Pre-commit Hooks
- Configured with `pre-commit-config.yaml`: check-ast, check-json, detect-private-key, trailing-whitespace, end-of-file-fixer, ruff (lint + format).

#### FIPS Compatibility
- **Konflux Dockerfile**: `GOEXPERIMENT=strictfipsruntime` and `-tags strictfipsruntime` — proper FIPS build configuration.
- **Base Images**: All UBI9-based (FIPS-capable). No alpine or debian images.
- **Source Code**: No non-FIPS crypto imports detected (no `crypto/md5`, `crypto/des`, `crypto/rc4`, `math/rand` in security contexts).
- **Assessment**: FIPS-ready through downstream Konflux builds.

#### Dependency Alerts
- **Dependabot**: Comprehensive configuration covering 5 ecosystems:
  - `gomod` (root + BFF)
  - `pip` (Python client + async upload)
  - `docker` (root)
  - `github-actions` (root)
  - `npm` (UI frontend)
- Weekly update schedule with grouping for mod-arch dependencies.

### Agent Rules

**Score: 8.5/10**

- **AGENTS.md**: 379-line comprehensive document covering:
  - Agent behavior policy (atomic changes, local analysis first, CI rules)
  - Kubeflow AI Policy compliance (commit attribution)
  - Explicit restrictions (no CI/CD modification, no large autogenerated files)
  - Context awareness guidelines (import patterns, error handling, logging style)
  - Full repository map with directory descriptions
  - Go workspace awareness (multiple go.mod files)
- **CLAUDE.md**: Symlink to AGENTS.md — ensures both Claude Code and other agents see the same rules.
- **.agents/skills/**: 6 custom agent skills including sync-catalog, init-catalog (with panic ordering/mapping/CRUD sub-skills), catalog-sample-data, and catalog-add-route.
- **Strengths**: Unusually thorough for this ecosystem. Repository map, behavior policy, and context awareness guidelines are excellent.
- **Gaps**: No explicit test creation rules (unit test patterns, E2E test patterns). The .claude/ directory exists but is empty — no .claude/rules/ for test creation guidance.

## Recommendations

### Priority 0 (Critical)

1. **Create `.codecov.yml` with coverage thresholds** — Without thresholds, coverage reporting is purely informational. Set project target at 70% and patch target at 50% to prevent regressions.
2. **Add concurrency control to all PR workflows** — 34 of 35 workflows lack concurrency groups. Add `cancel-in-progress: true` groups keyed on PR number.

### Priority 1 (High Value)

3. **Enable Go module caching** — Add `cache: true` to `actions/setup-go` steps and consider Docker layer caching for image builds.
4. **Create root-level `.golangci.yaml`** — Core Go code (internal/, pkg/, cmd/) runs without explicit linter configuration. Add errcheck, govet, staticcheck, and other standard linters.
5. **Add HEALTHCHECK to Dockerfiles** — At minimum, add to the main Dockerfile for runtime health validation.
6. **Add timeout-minutes to all jobs** — Prevent stuck CI runs from consuming resources indefinitely.

### Priority 2 (Nice-to-Have)

7. **Add test creation rules to .claude/rules/** — Generate unit/E2E test patterns with `/test-rules-generator` for consistency in AI-generated tests.
8. **Add Testcontainers for image runtime validation** — Programmatic image startup and API validation.
9. **Consider live-backend Cypress E2E** — Current UI E2E tests are mocked; a live backend test would catch integration issues.
10. **Pin base image tags in non-Konflux Dockerfiles** — `Dockerfile` and `Dockerfile.odh` use `latest` tags; pin to specific versions for reproducibility.

## Comparison to Gold Standards

| Practice | model-registry | odh-dashboard (gold) | notebooks (gold) | kserve (gold) |
|----------|---------------|----------------------|-------------------|---------------|
| Unit Test Ratio | 0.33 (Go) | ~0.5 | N/A | ~0.4 |
| E2E on PRs | Yes (Kind + operator) | Yes (Cypress) | Yes (multi-layer) | Yes (Kind) |
| Multi-Version K8s | Yes (v1.33/v1.34) | Limited | N/A | Yes (3+ versions) |
| Coverage Enforcement | No thresholds | Yes | Limited | Yes |
| CI Caching | None | Yes | Yes | Yes |
| Concurrency Control | 1/35 workflows | Yes | Yes | Yes |
| FIPS Builds | Yes (Konflux) | Yes | Yes | Yes |
| Agent Rules | Excellent (379 lines) | Strong | None | Limited |
| Pre-commit Hooks | Yes | Yes | Limited | Limited |
| Dependabot | Yes (5 ecosystems) | Yes | Yes | Yes |
| Fuzz Testing | Yes | No | No | No |
| Multi-DB Testing | Yes (MySQL + PostgreSQL) | N/A | N/A | N/A |

## File Paths Reference

### CI/CD
- `.github/workflows/build.yml` — Main build + unit tests + Codecov
- `.github/workflows/build-image-pr.yml` — PR image build + Kind deploy validation
- `.github/workflows/python-tests.yml` — Python lint, tests, E2E, fuzz
- `.github/workflows/controller-test.yml` — Controller tests + build
- `.github/workflows/csi-test.yml` — CSI E2E tests
- `.github/workflows/async-upload-test.yml` — Async upload unit + integration + E2E
- `.tekton/` — Konflux pipeline configs

### Testing
- `internal/core/*_test.go` — Core business logic tests
- `internal/converter/*_test.go` — Converter tests
- `internal/server/openapi/*_test.go` — OpenAPI server tests
- `clients/python/tests/` — Python client tests
- `clients/ui/frontend/src/__tests__/` — UI unit + Cypress E2E
- `clients/ui/bff/internal/api/*_test.go` — BFF handler tests
- `pkg/inferenceservice-controller/*_test.go` — Controller tests (envtest)
- `jobs/async-upload/tests/` — Async upload tests

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks (ruff, file checks)
- `clients/ui/bff/.golangci.yaml` — BFF linter config
- `clients/ui/frontend/.eslintrc.cjs` — Frontend ESLint
- `.github/dependabot.yml` — Dependency alerts (5 ecosystems)

### Container Images
- `Dockerfile` — Main multi-arch image
- `Dockerfile.konflux` — FIPS-compliant downstream image (pinned digests)
- `Dockerfile.odh` — ODH variant
- `Dockerfile.testops` — Test operations image
- `docker-compose.yaml` / `docker-compose-local.yaml` — Local development

### Agent Rules
- `AGENTS.md` — Comprehensive agent behavior policy + repo map
- `CLAUDE.md` — Symlink to AGENTS.md
- `.agents/skills/` — 6 custom agent skills
