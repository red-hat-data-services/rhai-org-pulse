---
repository: "opendatahub-io/argo-workflows"
overall_score: 7.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "286 Go test files, 22 UI tests, Go testing + Jest, coverage generation on CI"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "37 E2E test files, 16-matrix K3S-based E2E, multi-DB (MySQL/Postgres), multi-K8s version (v1.33-v1.35)"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time Docker image builds (argoexec, argocli), binary compilation, manifest validation, but no Konflux simulation"
  - dimension: "Image Testing"
    score: 6.5
    status: "Multi-stage Dockerfile with distroless base, PR-time image builds with cache, Windows support, but no runtime image validation or Trivy scanning on PRs"
  - dimension: "Coverage Tracking"
    score: 5.0
    status: "Codecov integration on main branch only, 2% threshold, patch coverage disabled, no PR enforcement"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "Comprehensive CI with smart change detection, concurrency control, SHA-pinned actions, automated cherry-picks, semantic PR checks"
  - dimension: "Agent Rules"
    score: 1.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory - zero AI agent guidance for test creation"
critical_gaps:
  - title: "No PR-time coverage enforcement"
    impact: "Coverage can drop without any PR gate; codecov only runs on main, patch coverage is disabled"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container vulnerability scanning on PRs"
    impact: "Security vulnerabilities in dependencies or base images not caught until Snyk daily scan"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No CodeQL/SAST analysis"
    impact: "No automated static security analysis beyond golangci-lint's gosec linter"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents (Claude, Copilot) have no project-specific guidance for test creation patterns"
    severity: "MEDIUM"
    effort: "3-4 hours"
  - title: "No image runtime validation"
    impact: "Built images are not smoke-tested for startup or health in CI"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Enable codecov PR coverage checks"
    effort: "1-2 hours"
    impact: "Prevent test coverage regression on every PR"
  - title: "Add Trivy scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Catch container vulnerabilities before merge"
  - title: "Add CodeQL workflow"
    effort: "1-2 hours"
    impact: "Automated SAST analysis for Go and JavaScript"
  - title: "Create basic CLAUDE.md with test patterns"
    effort: "2-3 hours"
    impact: "Guide AI agents to produce consistent, project-compliant tests"
recommendations:
  priority_0:
    - "Enable codecov coverage checks on PRs (patch and project) instead of main-only"
    - "Add container image vulnerability scanning (Trivy) to PR workflow"
  priority_1:
    - "Add CodeQL SAST workflow for Go and JavaScript"
    - "Add image startup smoke test after PR-time image build"
    - "Create comprehensive agent rules (.claude/rules/) for test patterns"
  priority_2:
    - "Add pre-commit hooks for consistent local development"
    - "Enable SBOM generation for PR-time image builds"
    - "Add accessibility testing for UI components"
---

# Quality Analysis: opendatahub-io/argo-workflows

## Executive Summary

- **Overall Score: 7.6/10**
- **Repository Type**: Go-based workflow engine (Argo Workflows fork for OpenDataHub)
- **Languages**: Go (primary), TypeScript/React (UI), Protocol Buffers
- **Framework**: Kubernetes-native workflow controller with CLI and server components

**Key Strengths:**
- Exceptionally well-organized CI/CD with smart change detection and parallel E2E matrix
- Comprehensive E2E test suite (37 test files) with multi-database and multi-K8s version testing
- Strong Go linting with 40+ golangci-lint linters enabled including gosec
- Image signing (cosign) and SBOM generation in release pipeline
- SHA-pinned GitHub Actions across all workflows

**Critical Gaps:**
- Coverage tracking only runs on main branch; no PR-time enforcement
- No container vulnerability scanning on PRs (Snyk only runs daily/on push to main)
- No CodeQL/SAST workflow
- Zero agent rules for AI-assisted development

**Agent Rules Status:** Missing - No CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.0/10 | 286 Go test files, 22 UI tests, strong test-to-code ratio (0.43:1) |
| Integration/E2E | 9.0/10 | 37 E2E files, 16-matrix K3S E2E, multi-DB, multi-K8s version |
| **Build Integration** | **7.0/10** | **PR-time Docker builds + binary compilation, no Konflux simulation** |
| Image Testing | 6.5/10 | Multi-stage distroless builds, no runtime validation or PR-time scanning |
| Coverage Tracking | 5.0/10 | Codecov on main only, patch disabled, 2% threshold |
| CI/CD Automation | 9.0/10 | Smart change detection, concurrency control, SHA-pinned actions |
| Agent Rules | 1.0/10 | No AI agent guidance for development or testing |

## Critical Gaps

### 1. No PR-time Coverage Enforcement
- **Impact:** Test coverage can drop silently; engineers only see coverage on main branch
- **Severity:** HIGH
- **Effort:** 2-4 hours
- **Details:** The `.codecov.yml` explicitly disables patch coverage (`patch: off`) and only uploads coverage on `github.ref == 'refs/heads/main'`. The comment in CI says "engineers just ignore this in PRs" — this means coverage regression is invisible until after merge.

### 2. No Container Vulnerability Scanning on PRs
- **Impact:** Vulnerable dependencies or base images not caught until Snyk's daily scheduled scan
- **Severity:** HIGH
- **Effort:** 2-3 hours
- **Details:** Snyk runs on `schedule` (daily at 2:30 AM) and `push` to main/release branches only. No PR-time scanning means vulnerabilities can be introduced and merged before detection.

### 3. No CodeQL/SAST Analysis
- **Impact:** No automated static security analysis beyond golangci-lint's gosec linter
- **Severity:** MEDIUM
- **Effort:** 2-3 hours
- **Details:** While golangci-lint includes `gosec` for basic Go security checks, there is no dedicated SAST tool (CodeQL, Semgrep) for deeper analysis across Go and JavaScript code.

### 4. No Agent Rules for AI-Assisted Development
- **Impact:** AI coding agents have no project-specific guidance for test patterns, conventions, or quality standards
- **Severity:** MEDIUM
- **Effort:** 3-4 hours
- **Details:** No CLAUDE.md, AGENTS.md, or `.claude/` directory exists. This means AI agents cannot follow project-specific patterns for Go test structure, E2E fixture usage, or UI testing conventions.

### 5. No Image Runtime Validation
- **Impact:** Built container images are not smoke-tested for startup or basic health in CI
- **Severity:** MEDIUM
- **Effort:** 4-6 hours
- **Details:** The CI builds argoexec and argocli images and loads them into K3S for E2E tests, but there is no explicit image startup validation or health check step.

## Quick Wins

### 1. Enable Codecov PR Coverage Checks (1-2 hours)
- **Impact:** Prevent test coverage regression on every PR
- **Implementation:**
```yaml
# .codecov.yml
coverage:
  status:
    patch:
      default:
        target: 70%
    project:
      default:
        threshold: 2
```
Also remove the `if: github.ref == 'refs/heads/main'` condition from the codecov upload step in `ci-build.yaml`.

### 2. Add Trivy Scanning to PR Workflow (1-2 hours)
- **Impact:** Catch container vulnerabilities before merge
- **Implementation:**
```yaml
# Add to ci-build.yaml after argo-images job
trivy-scan:
  name: Container Security Scan
  needs: [argo-images]
  runs-on: ubuntu-24.04
  strategy:
    matrix:
      image: [argoexec, argocli]
  steps:
    - uses: actions/download-artifact@v4
      with:
        name: ${{matrix.image}}_image.tar
        path: /tmp
    - uses: aquasecurity/trivy-action@master
      with:
        input: /tmp/${{matrix.image}}_image.tar
        severity: 'CRITICAL,HIGH'
        exit-code: '1'
```

### 3. Add CodeQL Workflow (1-2 hours)
- **Impact:** Automated SAST analysis for Go and JavaScript
- **Implementation:** Create `.github/workflows/codeql.yml` with Go and JavaScript language configuration.

### 4. Create Basic CLAUDE.md (2-3 hours)
- **Impact:** Guide AI agents to produce consistent, project-compliant tests
- **Implementation:** Document test patterns, Go testing conventions, E2E fixture usage, and UI testing standards.

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory (16 workflows):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci-build.yaml` | PR + push to main/release | Core CI: tests, lint, E2E, UI, codegen |
| `release.yaml` | Tag push | Multi-arch image build, signing, SBOM, release |
| `snyk.yml` | Daily cron + push to main | Go & Node dependency vulnerability scanning |
| `pr.yaml` | PR events | Semantic PR title check |
| `pr-feature.yaml` | PR events | Feature PR handling |
| `docs.yaml` | PR + push to main | Documentation build/validation |
| `devcontainer.yaml` | PR + push (devcontainer changes) | Dev container build validation |
| `cherry-pick.yml` | PR labeled/closed | Automated cherry-pick to release branches |
| `dependabot-reviewer.yml` | PR | Auto-approve/merge Dependabot PRs |
| `retest.yaml` | Issue comment (`/retest`) | Re-run failed CI jobs on PR |
| `changelog.yaml` | Tag push | Auto-generate changelog |
| `sdks.yaml` | Tag push | Publish Java SDK |
| `stale.yaml` | Daily cron | Mark stale issues/PRs |

**Strengths:**
- Smart change detection using `tj-actions/changed-files` — only runs relevant jobs when files change
- Excellent concurrency control (`cancel-in-progress: true`)
- All GitHub Actions SHA-pinned (30 pinned references in ci-build.yaml alone)
- Automated cherry-pick workflow for release branches
- Semantic PR title enforcement
- `/retest` comment-triggered CI re-run

**Weaknesses:**
- No Konflux/downstream build simulation
- No periodic regression testing beyond Snyk
- No performance/load testing in CI

### Test Coverage

**Go Tests:**
- **286 test files** across the codebase (vs. 666 source files = 0.43:1 ratio)
- Framework: Go standard `testing` package + `testify` for assertions
- Mock generation: `mockery` for interface mocking (8 interfaces configured)
- Coverage generation: `go test -covermode=atomic -coverprofile=coverage.out`
- Windows test support: Separate CI job for Windows unit tests

**UI Tests:**
- **22 test files** (vs. 255 source files = 0.09:1 ratio — UI is under-tested)
- Framework: Jest + React Testing Library
- Coverage: Not explicitly tracked or enforced

**E2E Tests:**
- **37 test files** in `test/e2e/`
- Infrastructure: K3S (K8s-in-Docker)
- Multi-K8s version: v1.33.10 (min) to v1.35.0 (max)
- Multi-database: MySQL, PostgreSQL
- **16-matrix test suite** covering:
  - Artifacts, executor, core functional, functional
  - API (MySQL + Postgres), metrics (MySQL + Postgres)
  - CLI, cron, examples, plugins, tracing, telemetry
  - Go SDK, Java SDK
  - Min K8s version regression (4 suites)
  - DB semaphore (MySQL + Postgres on min K8s)
- Test profiles: minimal, mysql, postgres, plugins, telemetry, telemetry-stack
- Benchmarks: `test/e2e/benchmarks/` and stress tests in `test/stress/`

**Coverage Tracking:**
- Codecov integration with `.codecov.yml`
- Ignores generated files (protobuf, deepcopy, client code)
- Patch coverage: **disabled** (`patch: off`)
- Project threshold: 2% drop allowed
- **Only uploads on main branch** — PRs get no coverage feedback

### Code Quality

**Go Linting (golangci-lint v2):**
- **40+ linters enabled** including:
  - Security: `gosec`
  - Quality: `errorlint`, `govet`, `staticcheck`, `revive`
  - Style: `misspell`, `whitespace`, `nakedret`
  - Performance: `ineffassign`, `unused`, `unconvert`
  - Modern Go: `modernize`, `exptostd`, `usetesting`
- Custom `revive` rules with 20+ checks
- CI runs lint only when relevant files change

**UI Linting:**
- ESLint with TypeScript, React, and Prettier plugins
- `eslint:recommended` + `@typescript-eslint/recommended`
- Some strict rules disabled (`no-explicit-any: off`, `no-non-null-assertion: off`)

**Code Review Automation:**
- CodeRabbit AI code review configured (`.coderabbit.yaml`)
- Profile: "chill" (fewer nitpicks)
- Tools enabled: golangci-lint, shellcheck, yamllint, markdownlint, actionlint
- Ignores generated files, mocks, vendor, snapshots

**Pre-commit Hooks:** None (`.pre-commit-config.yaml` absent)

**Static Analysis:**
- Markdown linting (`.markdownlint.yaml`)
- Link checking (`.mlc_config.json`)
- Spelling checks (`.spelling` word list)
- SHA-pinned action validation (`zgosalvez/github-actions-ensure-sha-pinned-actions`)

### Container Images

**Build Process:**
- Multi-stage Dockerfile with 4 build stages and 5 output images
- Base: `golang:1.26.1-alpine3.23` (builder), `gcr.io/distroless/static-debian13` (runtime)
- **Distroless base images** — excellent security posture
- Docker BuildKit with `--mount=type=cache` for Go modules and build cache
- Windows support via `Dockerfile.windows` (Server Core + Chocolatey)
- PR-time image builds with GHA cache (`cache-from: type=gha`)

**Output Images:**
| Image | Base | User | Purpose |
|-------|------|------|---------|
| `argoexec` | distroless | root | Workflow executor |
| `argoexec-nonroot` | distroless | 8737 | Non-root executor |
| `workflow-controller` | distroless | 8737 | Controller |
| `argocli` | distroless | 8737 | CLI + UI server |

**Security in Release Pipeline:**
- Cosign image signing with private key
- SPDX SBOM generation
- Checksum signing with cosign
- Public key published with release assets

**Gaps:**
- No Trivy/vulnerability scanning on PR-time images
- No image startup smoke test
- No multi-architecture build on PRs (only in release)
- Provenance explicitly disabled (`--provenance=false`)

### Security

**Dependency Management:**
- Renovate for automated dependency updates (main + release branches)
- Dependabot also configured (dual dependency management)
- Auto-approve/merge for Dependabot patch updates
- Conservative updates on release branches (patch only)

**Vulnerability Scanning:**
- Snyk for Go and Node.js dependencies (daily + push to main)
- Severity threshold: HIGH
- Image scanning via Snyk app (separate from repo)
- No PR-time vulnerability scanning

**Supply Chain Security:**
- All GitHub Actions SHA-pinned
- Cosign image signing in release pipeline
- SBOM generation (SPDX format)
- Checksum signing for CLI binaries
- Public cosign verification key in repo (`cosign.pub`)

**Gaps:**
- No CodeQL/SAST workflow
- No secret detection (gitleaks/trufflehog)
- No SLSA provenance attestation (explicitly disabled)
- No container scanning in PR workflow

### Agent Rules (Agentic Flow Quality)

- **Status:** Missing
- **Coverage:** None — no test type rules exist
- **Quality:** N/A
- **Gaps:**
  - No CLAUDE.md or AGENTS.md in repository root
  - No `.claude/` directory
  - No `.claude/rules/` for test creation guidance
  - No `.claude/skills/` for custom automation
- **Recommendation:** Generate comprehensive agent rules using `/test-rules-generator` to cover:
  - Go unit test patterns (testify assertions, table-driven tests)
  - E2E test fixture usage (K3S, database profiles)
  - UI test patterns (Jest, React Testing Library)
  - Mock generation patterns (mockery)

## Recommendations

### Priority 0 (Critical)

1. **Enable codecov PR coverage checks** — Remove the `if: github.ref == 'refs/heads/main'` guard from coverage upload and enable patch coverage in `.codecov.yml`. This is the single highest-ROI change.

2. **Add container vulnerability scanning to PR workflow** — Use Trivy to scan the argoexec and argocli images built during PR CI. The images are already built and available as artifacts.

### Priority 1 (High Value)

3. **Add CodeQL SAST workflow** — Create a CodeQL analysis workflow for Go and JavaScript. This complements golangci-lint's `gosec` with deeper taint analysis and vulnerability detection.

4. **Add image startup smoke test** — After building argoexec and argocli images, run a basic container startup test to verify the binaries execute correctly. This is partially covered by E2E tests but should be explicit.

5. **Create comprehensive agent rules** — Generate `.claude/rules/` with unit test, E2E test, and UI test patterns. This will significantly improve AI-assisted development quality.

### Priority 2 (Nice-to-Have)

6. **Add pre-commit hooks** — Create `.pre-commit-config.yaml` with golangci-lint, yamllint, shellcheck, and markdownlint for consistent local development.

7. **Add secret detection** — Configure gitleaks or trufflehog to prevent accidental secret commits.

8. **Increase UI test coverage** — The UI has a 0.09:1 test-to-code ratio vs. 0.43:1 for Go. Prioritize critical user-facing components.

9. **Enable SLSA provenance** — Currently explicitly disabled (`--provenance=false`). Consider enabling for supply chain transparency.

## Comparison to Gold Standards

| Dimension | argo-workflows | odh-dashboard | notebooks | kserve |
|-----------|---------------|---------------|-----------|--------|
| Unit Tests | 8.0 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 9.0 | 9.0 | 8.0 | 9.0 |
| Build Integration | 7.0 | 8.0 | 9.0 | 7.0 |
| Image Testing | 6.5 | 7.0 | 9.0 | 7.0 |
| Coverage Tracking | 5.0 | 8.0 | 6.0 | 9.0 |
| CI/CD Automation | 9.0 | 9.0 | 8.0 | 8.0 |
| Agent Rules | 1.0 | 8.0 | 3.0 | 2.0 |
| **Overall** | **7.6** | **8.5** | **7.5** | **7.8** |

**Key Differences from Gold Standards:**
- **vs. odh-dashboard:** Missing contract tests, coverage enforcement, and comprehensive agent rules
- **vs. notebooks:** Missing 5-layer image validation and multi-architecture PR testing
- **vs. kserve:** Missing coverage enforcement and multi-version API testing

## File Paths Reference

### CI/CD
- `.github/workflows/ci-build.yaml` — Core CI pipeline (21KB, 565 lines)
- `.github/workflows/release.yaml` — Release pipeline (17KB)
- `.github/workflows/snyk.yml` — Vulnerability scanning
- `.github/workflows/pr.yaml` — Semantic PR title check
- `.github/workflows/cherry-pick.yml` — Automated cherry-picks

### Testing
- `test/e2e/` — 37 E2E test files
- `test/e2e/fixtures/` — E2E test fixtures
- `test/e2e/manifests/` — K8s manifests for test profiles
- `test/stress/` — Stress test definitions
- `ui/src/**/*.test.*` — 22 UI test files

### Code Quality
- `.golangci.yml` — 40+ linters (8KB)
- `.coderabbit.yaml` — AI code review config
- `ui/.eslintrc.json` — UI linting
- `.markdownlint.yaml` — Markdown linting
- `.spelling` — Spell check word list

### Container Images
- `Dockerfile` — Multi-stage Linux builds (4KB)
- `Dockerfile.windows` — Windows builds
- `.dockerignore` — Build context exclusions

### Coverage & Security
- `.codecov.yml` — Coverage configuration
- `.github/workflows/snyk.yml` — Dependency scanning
- `cosign.pub` — Image signing public key
- `renovate.json` — Dependency updates
- `.github/dependabot.yml` — Alternative dependency updates

### Mock Generation
- `.mockery.yaml` — 8 interface mock configurations
