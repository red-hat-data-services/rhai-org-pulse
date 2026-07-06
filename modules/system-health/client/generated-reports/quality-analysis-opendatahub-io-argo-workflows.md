---
repository: "opendatahub-io/argo-workflows"
overall_score: 6.8
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "236 Go test files + 11 UI tests; good distribution across packages but no PR coverage gates"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Comprehensive E2E suite with 12 matrix configs, multi-K8s version testing, K3S clusters"
  - dimension: "Build Integration"
    score: 5.0
    status: "PR builds Docker images but ODH-specific Dockerfiles only build on push/dispatch; no Konflux simulation"
  - dimension: "Image Testing"
    score: 5.0
    status: "Multi-arch support and cosign signing but no runtime validation or PR-time vulnerability scanning"
  - dimension: "Coverage Tracking"
    score: 5.0
    status: "Codecov integration exists but coverage only uploaded on main branch, not enforced on PRs"
  - dimension: "CI/CD Automation"
    score: 8.0
    status: "Well-organized workflows with concurrency control, changed-file optimization, SHA-pinned actions"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no test automation guidance for AI agents"
critical_gaps:
  - title: "Coverage not enforced on PRs"
    impact: "Developers cannot see coverage impact of their changes; regressions go unnoticed until post-merge"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "ODH Dockerfiles not validated on PRs"
    impact: "ODH-specific build failures (UBI9, FIPS, go-toolset) discovered only after merge to main"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container vulnerability scanning on PRs"
    impact: "New vulnerabilities introduced via dependencies not caught until scheduled Snyk scan"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No runtime validation for built images"
    impact: "Image startup failures, missing binaries, or broken entrypoints not detected until deployment"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "No agent rules for test automation"
    impact: "AI-assisted test generation lacks project-specific patterns, producing inconsistent or incorrect tests"
    severity: "LOW"
    effort: "3-5 hours"
quick_wins:
  - title: "Enable PR coverage reporting in Codecov"
    effort: "1-2 hours"
    impact: "Developers see coverage delta on every PR; prevents silent coverage regression"
  - title: "Add ODH Dockerfile build step to ci-build.yaml"
    effort: "2-3 hours"
    impact: "Catches UBI9/FIPS/go-toolset build failures before merge"
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Early detection of HIGH/CRITICAL vulnerabilities in container images"
  - title: "Add pre-commit hooks"
    effort: "1-2 hours"
    impact: "Catch linting and formatting issues locally before push"
  - title: "Create basic CLAUDE.md with test patterns"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality and consistency"
recommendations:
  priority_0:
    - "Enable Codecov coverage reporting on PRs (remove the main-branch-only condition)"
    - "Add ODH Dockerfile build validation to PR workflow to catch FIPS/UBI9 issues pre-merge"
    - "Add container vulnerability scanning (Trivy) to PR workflow"
  priority_1:
    - "Add image runtime validation (startup check, entrypoint test) for built images"
    - "Enable CodeQL or Semgrep SAST scanning on PRs"
    - "Add secret detection via gitleaks to PR workflow"
    - "Create agent rules for test automation (.claude/rules/)"
  priority_2:
    - "Add pre-commit hooks for local developer experience"
    - "Re-enable Windows unit tests with alternative Go toolchain"
    - "Add performance regression testing for workflow controller"
    - "Implement chaos engineering tests for controller resilience"
---

# Quality Analysis: opendatahub-io/argo-workflows

## Executive Summary

- **Overall Score: 6.8/10**
- **Repository Type**: Kubernetes workflow engine (forked from argoproj/argo-workflows)
- **Primary Languages**: Go (backend), TypeScript (UI)
- **Framework**: Kubernetes CRD-based operator with React frontend
- **Agent Rules Status**: Missing

**Key Strengths**: Excellent E2E test infrastructure with multi-K8s version testing, well-organized CI with smart changed-file detection, cosign image signing, and SBOM generation on releases.

**Critical Gaps**: Coverage not reported on PRs, ODH-specific Dockerfiles not validated pre-merge, no container vulnerability scanning on PRs, no agent rules for AI-assisted development.

**Top 3 Recommendations**:
1. Enable Codecov PR coverage reporting (currently main-branch only)
2. Add ODH Dockerfile build validation to PR CI workflow
3. Add Trivy container scanning to PR workflow

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7/10 | 236 Go test files + 11 UI tests; 0.43 test-to-source ratio |
| Integration/E2E | 8/10 | 12-config matrix, multi-K8s versions, SDK tests |
| **Build Integration** | **5/10** | **ODH Dockerfiles only built on push/dispatch; no Konflux sim** |
| Image Testing | 5/10 | Multi-arch + cosign, but no runtime validation on PRs |
| Coverage Tracking | 5/10 | Codecov exists but only uploads on main, not PRs |
| CI/CD Automation | 8/10 | Concurrency control, changed-file gating, SHA-pinned actions |
| Agent Rules | 0/10 | No CLAUDE.md, no .claude/ directory |

## Critical Gaps

### 1. Coverage Not Enforced on PRs
- **Impact**: Developers cannot see coverage impact of their changes; regressions silently merge
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The CI workflow generates coverage (`-coverprofile=coverage.out`) but only uploads to Codecov on `refs/heads/main`. The comment in code says "engineers just ignore this in PRs, so lets not even run it" — but hiding coverage data makes the problem worse, not better.
- **Fix**: Remove the `if: github.ref == 'refs/heads/main'` condition on the Codecov upload step. Configure `.codecov.yml` to add informational (non-blocking) PR comments showing coverage delta.

### 2. ODH Dockerfiles Not Validated on PRs
- **Impact**: Build failures specific to UBI9 base images, FIPS-enabled Go (`GOFIPS140=v1.0.0`), and `go-toolset` are only discovered after merge when `build-main.yml` runs
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The repository has ODH-specific Dockerfiles (`argo-workflowcontroller/Dockerfile.ODH` and `argo-argoexec/Dockerfile.ODH`) that use `registry.access.redhat.com/ubi9/go-toolset` and build with `GOFIPS140=v1.0.0`. These are only built by `build-main.yml` (triggered on push to main or manual dispatch). The PR CI workflow (`ci-build.yaml`) builds the upstream `Dockerfile` targets (`argoexec`, `argocli`) but does not test the ODH-specific build paths.

### 3. No Container Vulnerability Scanning on PRs
- **Impact**: New vulnerabilities introduced via dependency updates are not caught until the scheduled Snyk scan (daily at 2:30 AM)
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Snyk runs on a schedule (`cron: "30 2 * * *"`) and only on pushes to main/release branches. The `if: github.repository == 'argoproj/argo-workflows'` condition means it doesn't run on the opendatahub-io fork at all. No Trivy, Grype, or other scanner runs on PRs.

### 4. No Runtime Validation for Built Images
- **Impact**: Broken entrypoints, missing binaries, or incorrect file permissions not detected until deployment
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: The PR CI builds and uploads Docker images as artifacts, and the E2E tests load and use them. However, there is no explicit image startup validation (e.g., `docker run --entrypoint /bin/workflow-controller image --help`). The release workflow has pull-tests but they only verify that `docker pull` succeeds, not that the image runs.

### 5. No Agent Rules for Test Automation
- **Impact**: AI-assisted test generation produces inconsistent or incorrect test patterns
- **Severity**: LOW
- **Effort**: 3-5 hours
- **Details**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory exists. AI agents have no project-specific guidance on test frameworks, patterns, fixtures, or build tags used in this repository.

## Quick Wins

### 1. Enable PR Coverage Reporting (1-2 hours)
Remove the branch condition from the Codecov upload step:
```yaml
# Before:
- name: Upload coverage report
  if: github.ref == 'refs/heads/main'
  uses: codecov/codecov-action@v4

# After:
- name: Upload coverage report
  uses: codecov/codecov-action@v4
```

### 2. Add ODH Dockerfile Build to PR CI (2-3 hours)
Add a job to `ci-build.yaml` that builds the ODH Dockerfiles:
```yaml
odh-images:
  name: ODH Image Build
  runs-on: ubuntu-latest
  timeout-minutes: 15
  strategy:
    matrix:
      include:
        - dockerfile: ./argo-workflowcontroller/Dockerfile.ODH
          image: ds-pipelines-argo-workflowcontroller
        - dockerfile: ./argo-argoexec/Dockerfile.ODH
          image: ds-pipelines-argo-argoexec
  steps:
    - uses: actions/checkout@v4
    - uses: docker/setup-buildx-action@v3
    - name: Build ODH image
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ${{ matrix.dockerfile }}
        push: false
        cache-from: type=gha
        cache-to: type=gha,mode=max
```

### 3. Add Trivy Scanning to PR Workflow (1-2 hours)
```yaml
trivy-scan:
  name: Container Security Scan
  needs: [odh-images]
  runs-on: ubuntu-latest
  steps:
    - uses: aquasecurity/trivy-action@master
      with:
        image-ref: 'ds-pipelines-argo-workflowcontroller:latest'
        severity: 'CRITICAL,HIGH'
        exit-code: '1'
```

### 4. Add Pre-commit Hooks (1-2 hours)
Create `.pre-commit-config.yaml`:
```yaml
repos:
  - repo: https://github.com/golangci/golangci-lint
    rev: v1.57.0
    hooks:
      - id: golangci-lint
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
```

### 5. Create Basic CLAUDE.md (2-3 hours)
```markdown
# Argo Workflows - Development Guide

## Test Patterns
- Unit tests use Go's `testing` package with `*_test.go` files
- E2E tests use build tags (executor, functional, api, cli, cron, etc.)
- UI tests use Jest with ts-jest preset
- Run `make test` for unit tests, `make test-<suite>` for E2E
```

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory** (11 workflows):

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci-build.yaml` | PR + push | Main CI: tests, lint, codegen, E2E, UI |
| `pr.yaml` | PR target | Semantic PR title check |
| `build-main.yml` | Push to main + dispatch | ODH image builds to quay.io |
| `release.yaml` | Tags + push to main | Multi-arch build, sign, SBOM, release |
| `snyk.yml` | Schedule (daily) + push | Dependency vulnerability scanning |
| `retest.yaml` | Issue comment `/retest` | Re-run failed CI jobs |
| `stale.yaml` | Schedule | Mark stale issues/PRs |
| `docs.yaml` | - | Documentation build |
| `sdks.yaml` | - | SDK generation |
| `changelog.yaml` | - | Changelog generation |
| `dependabot-reviewer.yml` | - | Auto-review Dependabot PRs |

**Strengths**:
- Smart changed-file detection using `tj-actions/changed-files` — tests, E2E, codegen, lint, and UI jobs only run when relevant files change
- Concurrency control with `cancel-in-progress: true` prevents queue buildup
- SHA-pinned GitHub Actions with verification step (`ensure-sha-pinned-actions`)
- `/retest` comment support for re-running failed jobs
- E2E composite result job for accurate status checks

**Weaknesses**:
- ODH-specific builds (`build-main.yml`) don't run on PRs
- Snyk has `if: github.repository == 'argoproj/argo-workflows'` — never runs on this fork
- Windows tests disabled (`if: false`) due to FIPS/go-toolset requirements

### Test Coverage

**Go Unit Tests**:
- 236 test files covering 554 source files (ratio: 0.43)
- Parallel execution with `-p 20` for speed (10-minute timeout)
- Heavy concentration in `workflow/controller/` (32 test files) — the core business logic
- Coverage generated with `atomic` mode via `-coverprofile`

**Key test distribution**:
| Package | Test Files | Notes |
|---------|-----------|-------|
| `workflow/controller/` | 32 | Core controller logic — best covered |
| `test/e2e/` | 29 | E2E test suites |
| `pkg/apis/workflow/v1alpha1/` | 14 | CRD type validation |
| `workflow/sync/` | 7 | Synchronization/locking |
| `cmd/argo/commands/` | 7 | CLI commands |
| `workflow/common/` | 6 | Shared workflow utilities |
| `util/template/` | 6 | Template engine |

**UI Tests**:
- 11 test files using Jest + ts-jest
- Tests cover: services, components, pod naming, resource parsing, event flow graph
- Jest config with TypeScript support and module mocking

**E2E Tests**:
- 12-configuration matrix across 3 profiles (minimal, mysql, plugins)
- Tests: executor, corefunctional, functional, api, cli, cron, examples, plugins, java-sdk, python-sdk
- Multi-K8s version testing (min and max versions via `hack/k8s-versions.sh`)
- K3S-based cluster with Docker runtime
- 60-minute timeout with 20-minute suite timeout
- Comprehensive failure debugging (K3s logs, pod logs, workflow descriptions)
- SDK integration tests for Java and Python

### Code Quality

**Linting**:
- golangci-lint v2 with 17 linters enabled:
  - Security: `gosec` (G304, G307)
  - Quality: `staticcheck`, `errcheck`, `bodyclose`, `unparam`
  - Style: `gofmt`, `goimports`, `misspell`, `nakedret`
  - Correctness: `govet`, `rowserrcheck`, `sqlclosecheck`, `testifylint`
- Exclusions for generated code, vendor, docs, examples
- Lint changes verified via `git diff --exit-code`
- Markdownlint and spell checker for documentation
- Action SHA pinning verification

**Missing**:
- No pre-commit hooks
- No CodeQL or Semgrep for deep SAST
- No secret detection (gitleaks, TruffleHog)

### Container Images

**Build Process**:
- **Upstream Dockerfile**: Multi-stage build with Go builder, Node UI builder, and minimal Alpine final images
- **ODH Dockerfiles**: UBI9 base (`registry.access.redhat.com/ubi9/go-toolset`), FIPS-enabled (`GOFIPS140=v1.0.0`), non-root users
- BuildKit with `--mount=type=cache` for Go module and build caches
- Multi-architecture support: linux/amd64, linux/arm64, windows
- Docker Buildx with GHA cache layer

**Security**:
- Cosign image signing on releases
- SBOM generation via `spdx-sbom-generator` and `bom` tools
- Image pull verification in release pipeline
- Non-root users in ODH Dockerfiles (user 8737 and 2000)

**Missing**:
- No container scanning (Trivy/Grype) in PR or release workflows
- No image startup validation
- No `.trivyignore` for known false positives
- Snyk image scanning referenced but handled externally (app.snyk.io)

### Security Practices

**Present**:
- Snyk dependency scanning (Go + Node) — scheduled + push to main
- gosec via golangci-lint (limited checks: G304, G307)
- Cosign image signing with private key
- SBOM generation and publication with releases
- Security advisory process documented
- HackerOne bug bounty program
- SHA-pinned GitHub Actions
- Minimal permissions in workflows (`contents: read`)

**Missing**:
- No PR-time vulnerability scanning (Snyk condition excludes this fork)
- No CodeQL/SAST
- No gitleaks/secret detection
- No dependency review action for PRs
- No Trivy container scanning

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: All test types lack rules (unit, E2E, integration, UI)
- **Recommendation**: Generate rules with `/test-rules-generator` covering:
  - Go unit test patterns (build tags, test fixtures, parallel execution)
  - E2E test patterns (K3S setup, profiles, wait conditions)
  - UI test patterns (Jest, ts-jest, module mocking)
  - API test patterns (SDK integration)

## Recommendations

### Priority 0 (Critical)

1. **Enable Codecov coverage reporting on PRs**
   - Remove the `if: github.ref == 'refs/heads/main'` condition
   - Add informational PR comments showing coverage delta
   - Consider adding patch coverage checks (currently disabled)

2. **Add ODH Dockerfile build validation to PR workflow**
   - Build `Dockerfile.ODH` variants in `ci-build.yaml`
   - Ensures FIPS, UBI9, and go-toolset compatibility before merge
   - Prevents build breakage discovered only on main branch

3. **Add container vulnerability scanning to PR workflow**
   - Add Trivy or Grype scanning for built images
   - Set `exit-code: 1` for CRITICAL/HIGH severabilities
   - The Snyk condition `github.repository == 'argoproj/argo-workflows'` means it never runs on this fork

### Priority 1 (High Value)

4. **Add image runtime validation**
   - Test that built images start successfully
   - Verify entrypoint responds (e.g., `--help` or `--version`)
   - Check for correct file permissions and non-root user

5. **Enable CodeQL or Semgrep for SAST**
   - Go and JavaScript/TypeScript analysis
   - Catch security issues beyond what gosec finds
   - Run on PRs for early detection

6. **Add secret detection**
   - Add gitleaks to PR workflow
   - Prevents accidental credential commits
   - Minimal configuration required

7. **Create agent rules for test automation**
   - Add `.claude/rules/` with test creation guidance
   - Cover Go unit tests, E2E tests, UI tests
   - Include build tag patterns, fixture usage, parallel execution

### Priority 2 (Nice-to-Have)

8. **Add pre-commit hooks**
   - golangci-lint, trailing whitespace, YAML validation
   - Faster developer feedback loop

9. **Re-enable Windows unit tests**
   - Currently disabled due to FIPS/go-toolset
   - Investigate alternative approaches for Windows CI

10. **Add performance regression testing**
    - Benchmark workflow controller throughput
    - Track compilation times
    - Monitor memory usage under load

11. **Implement chaos engineering tests**
    - Test controller behavior under network partitions
    - Verify recovery from pod evictions
    - Test handling of API server unavailability

## Comparison to Gold Standards

| Dimension | argo-workflows | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit Tests | 7/10 | 9/10 | 6/10 | 9/10 |
| Integration/E2E | 8/10 | 9/10 | 7/10 | 9/10 |
| Build Integration | 5/10 | 8/10 | 7/10 | 7/10 |
| Image Testing | 5/10 | 7/10 | 10/10 | 6/10 |
| Coverage Tracking | 5/10 | 9/10 | 5/10 | 8/10 |
| CI/CD Automation | 8/10 | 9/10 | 8/10 | 8/10 |
| Agent Rules | 0/10 | 8/10 | 3/10 | 2/10 |
| **Overall** | **6.8/10** | **8.7/10** | **6.8/10** | **7.6/10** |

**Key gaps compared to gold standards**:
- **vs. odh-dashboard**: No contract tests, no PR coverage reporting, no agent rules
- **vs. notebooks**: No 5-layer image testing, no runtime validation
- **vs. kserve**: No PR coverage enforcement, no multi-version coverage

## File Paths Reference

### CI/CD
- `.github/workflows/ci-build.yaml` — Main CI pipeline (tests, lint, E2E)
- `.github/workflows/pr.yaml` — PR title semantic check
- `.github/workflows/build-main.yml` — ODH image builds
- `.github/workflows/release.yaml` — Multi-arch release with signing
- `.github/workflows/snyk.yml` — Dependency scanning (scheduled)
- `.github/workflows/retest.yaml` — `/retest` comment handler

### Testing
- `test/e2e/` — 29 E2E test files (38 total Go files)
- `workflow/controller/*_test.go` — 32 controller unit test files
- `ui/src/**/*.test.ts` — 11 UI test files
- `ui/jest.config.js` — Jest configuration

### Build
- `Dockerfile` — Upstream multi-stage build
- `Dockerfile.windows` — Windows build
- `argo-workflowcontroller/Dockerfile.ODH` — ODH controller image (UBI9 + FIPS)
- `argo-argoexec/Dockerfile.ODH` — ODH executor image (UBI9 + FIPS)
- `Makefile` — Build and test targets

### Quality Config
- `.golangci.yml` — 17 linters + 2 formatters
- `.codecov.yml` — Coverage thresholds (2% tolerance)
- `SECURITY.md` — Security advisory process
- `CODEOWNERS` — Code ownership for protobuf files
