---
repository: "red-hat-data-services/odh-cli"
overall_score: 7.4
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "Excellent test coverage with 128 test files for 201 source files (0.64 ratio). Test LOC exceeds source LOC (35,855 vs 29,448). Uses vanilla Gomega with subtests."
  - dimension: "Integration/E2E"
    score: 5.0
    status: "Single integration test file with fake clients. No real cluster E2E tests, no Kind/Minikube setup. Integration test uses dynamicfake, not real API server."
  - dimension: "Build Integration"
    score: 6.0
    status: "Konflux pipelines for PR builds with multi-arch support. No PR-time runtime validation or image startup testing. CI only runs unit tests and lint."
  - dimension: "Image Testing"
    score: 5.0
    status: "Multi-stage Dockerfile with FIPS support. Multi-arch builds (amd64/arm64/ppc64le). No image startup validation, no runtime testing, no vulnerability scanning in CI."
  - dimension: "Coverage Tracking"
    score: 4.0
    status: "Coverage profile generated (coverage.out) but no codecov integration, no thresholds, no PR reporting. Coverage data not uploaded or enforced."
  - dimension: "CI/CD Automation"
    score: 7.5
    status: "Well-structured CI with concurrency control, GoReleaser for releases, Tekton/Konflux for prod builds. Missing E2E automation and coverage uploads."
  - dimension: "Agent Rules"
    score: 8.0
    status: "Comprehensive AGENTS.md with build commands, test guidelines, and coding standards. Has .claude/skills/lint-check. Missing .claude/rules/ for test patterns."
critical_gaps:
  - title: "No coverage enforcement or reporting"
    impact: "Test coverage can silently regress with no visibility on PRs. No minimum threshold enforced."
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No E2E tests against real clusters"
    impact: "CLI commands that interact with Kubernetes are only tested with fake clients. Real API behavior differences may cause production issues."
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No container image vulnerability scanning"
    impact: "Security vulnerabilities in base images or dependencies not detected until downstream scanning. No Trivy/Snyk integration."
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No image runtime validation"
    impact: "Built container images are never tested for startup, entrypoint correctness, or basic functionality before merge."
    severity: "MEDIUM"
    effort: "4-8 hours"
quick_wins:
  - title: "Add codecov integration to CI workflow"
    effort: "2-3 hours"
    impact: "Coverage visibility on every PR, regression detection, and threshold enforcement"
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Early detection of CVEs in base images and dependencies"
  - title: "Add govulncheck to CI workflow"
    effort: "30 minutes"
    impact: "Makefile target already exists but is not wired into CI. Detects known Go vulnerabilities."
  - title: "Create .claude/rules/ for test patterns"
    effort: "2-3 hours"
    impact: "Agent-generated tests will follow project conventions automatically"
recommendations:
  priority_0:
    - "Add codecov integration with coverage thresholds (e.g., 70% minimum, no decrease on PRs)"
    - "Add Trivy container image scanning to the CI workflow for vulnerability detection"
    - "Wire govulncheck into CI - Makefile target exists but CI does not run it"
  priority_1:
    - "Build E2E test infrastructure with envtest or Kind for testing CLI commands against real API servers"
    - "Add image startup and basic smoke testing in CI after container build"
    - "Create .claude/rules/ directory with unit-tests.md, integration-tests.md, and lint-check-tests.md"
  priority_2:
    - "Add cross-platform binary testing in CI (darwin, windows) using GoReleaser check"
    - "Add SBOM generation to container build pipeline"
    - "Consider adding secret detection (gitleaks) as a pre-commit hook"
---

# Quality Analysis: odh-cli

## Executive Summary

- **Overall Score: 7.4/10**
- **Repository Type**: Go CLI tool (kubectl plugin for ODH/RHOAI)
- **Primary Language**: Go 1.25
- **Framework**: Cobra CLI + Kubernetes client-go
- **Key Strengths**: Excellent unit test coverage (test LOC exceeds source LOC), comprehensive linting with golangci-lint v2 (all linters enabled by default), well-structured agent documentation, Konflux integration for production builds
- **Critical Gaps**: No coverage enforcement/reporting, no E2E tests against real clusters, no container vulnerability scanning, govulncheck exists but not in CI
- **Agent Rules Status**: Present (AGENTS.md + .claude/skills/lint-check) but missing .claude/rules/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 9.0/10 | Excellent: 128 test files, test LOC > source LOC, vanilla Gomega + subtests |
| Integration/E2E | 5.0/10 | Single integration test with fake clients, no real cluster testing |
| Build Integration | 6.0/10 | Konflux PR pipelines with multi-arch, but no runtime validation |
| Image Testing | 5.0/10 | Multi-stage Dockerfile, multi-arch builds, no scanning or runtime tests |
| Coverage Tracking | 4.0/10 | Coverage.out generated but not uploaded, no thresholds, no PR reporting |
| CI/CD Automation | 7.5/10 | Good CI structure, GoReleaser, Tekton/Konflux, missing E2E + coverage upload |
| Agent Rules | 8.0/10 | Strong AGENTS.md with conventions, .claude/skills present, missing .claude/rules/ |

## Critical Gaps

### 1. No Coverage Enforcement or Reporting
- **Impact**: Test coverage can silently regress with no visibility on PRs
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The Makefile generates `coverage.out` via `go test -coverprofile=coverage.out ./...` but this data is never uploaded to codecov/coveralls. No minimum coverage thresholds are enforced. PR reviewers have no visibility into coverage changes.

### 2. No E2E Tests Against Real Clusters
- **Impact**: CLI commands interacting with Kubernetes are only validated with fake clients. Real API server behavior (timeouts, RBAC, CRD validation) is untested.
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: The single integration test (`tests/integration/lint/diagnostic_cr_test.go`) uses `dynamicfake.NewSimpleDynamicClient` and a test helper `client.NewForTesting`. While unit tests are thorough, commands like `lint`, `status`, `migrate`, `backup`, and `deps` interact heavily with Kubernetes APIs and would benefit from envtest or Kind-based testing.

### 3. No Container Image Vulnerability Scanning
- **Impact**: CVEs in UBI base images or Go dependencies not detected until Konflux downstream scanning. Late detection means more expensive remediation.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Neither the GitHub Actions CI workflow nor the Tekton pipelines include Trivy, Snyk, or any vulnerability scanner. The `govulncheck` Makefile target covers Go dependency CVEs but is also not wired into CI.

### 4. No Image Runtime Validation
- **Impact**: Container images built by Konflux may have startup failures, missing binaries, or incorrect entrypoints that aren't caught until deployment.
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: The Dockerfile installs kubectl, oc, yq, Python dependencies, and the CLI binary. None of these are validated post-build. A simple smoke test (`docker run --rm image --version`) would catch many issues.

## Quick Wins

### 1. Add Codecov Integration (2-3 hours)
Upload the already-generated `coverage.out` file:
```yaml
# Add to .github/workflows/ci.yml after "Run tests"
- name: Upload coverage
  uses: codecov/codecov-action@v5
  with:
    files: coverage.out
    fail_ci_if_error: false
```

### 2. Add Trivy Container Scanning (1-2 hours)
```yaml
# Add as a new job in .github/workflows/ci.yml
security-scan:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v6
    - name: Build image for scanning
      run: docker build -t odh-cli:scan .
    - name: Run Trivy
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: 'odh-cli:scan'
        severity: 'CRITICAL,HIGH'
        exit-code: '1'
```

### 3. Wire govulncheck into CI (30 minutes)
```yaml
# Add to the test job steps in ci.yml
- name: Run vulnerability check
  run: make vulncheck
```

### 4. Create .claude/rules/ for Test Patterns (2-3 hours)
Generate test automation rules using `/test-rules-generator` to create:
- `.claude/rules/unit-tests.md` - Go testing conventions, Gomega patterns
- `.claude/rules/integration-tests.md` - Fake client setup, envtest patterns
- `.claude/rules/lint-check-tests.md` - Lint check test patterns specific to this project

## Detailed Findings

### CI/CD Pipeline

**Workflows**: Single `ci.yml` workflow with good structure:
- **Trigger**: PR + push to main + release events
- **Concurrency**: `cancel-in-progress: true` per workflow/ref - excellent
- **Jobs**: `test` (unit tests + lint), `dev-container` (push to main), `release-container` (on release), `release-binary` (GoReleaser)
- **Caching**: Go module cache via `setup-go` action with `go-version-file: go.mod`

**Tekton/Konflux**: Two pipeline definitions in `.tekton/`:
- `odh-cli-pull-request.yaml` - PR builds with multi-arch (x86_64, arm64)
- `odh-cli.yaml` - Production builds with three architectures (x86_64, arm64, ppc64le)
- Hermetic builds enabled, source images built, uses centralized pipeline from `konflux-central`

**Strengths**:
- Well-organized single workflow avoids redundancy
- Concurrency control prevents wasted resources
- GoReleaser for cross-platform binary releases (windows, linux, darwin)
- Konflux integration for production containerized builds

**Gaps**:
- CI only runs `make test` (unit tests) and `make lint` - no E2E or integration tests
- `make vulncheck` target exists but is not part of CI
- `make check` target only runs lint, could include vulncheck
- No coverage upload step

### Test Coverage

**Unit Tests (Excellent)**:
- 128 test files for 201 source files (0.64 ratio)
- 35,855 test LOC vs 29,448 source LOC (1.22x ratio - test code exceeds production code)
- Framework: vanilla Gomega (not Ginkgo) with `t.Run()` subtests
- Uses `t.Context()` (Go 1.24+)
- Test data as package-level constants (enforced by convention)
- Mock infrastructure in `pkg/util/test/mocks/` using testify/mock
- Fake Kubernetes clients via `sigs.k8s.io/controller-runtime/pkg/client/fake`
- Benchmark tests present (`executor_bench_test.go`)

**Coverage by Package** (based on test file distribution):
- `pkg/lint/` - Extensively tested (30+ check-specific test files)
- `pkg/backup/` - Good coverage (command, pipeline, dependency resolvers)
- `pkg/deps/` - Thorough testing (8 test files including internal tests)
- `pkg/migrate/` - Well covered (9 test files including internal tests)
- `pkg/components/` - Good (6 test files)
- `pkg/status/` - Adequate (5 test files)
- `pkg/util/` - Comprehensive utilities testing (14+ test files)

**Integration Tests (Weak)**:
- Single file: `tests/integration/lint/diagnostic_cr_test.go`
- Uses `dynamicfake.NewSimpleDynamicClient` - not a real API server
- Tests DiagnosticResult CR structure and validation
- No tests for actual CLI command execution
- No envtest or Kind-based testing

**E2E Tests (Missing)**:
- No E2E test infrastructure
- No Kind, Minikube, or envtest setup
- No CLI command smoke tests
- No multi-version testing

### Code Quality

**Linting (Excellent)**:
- golangci-lint v2 with `default: all` (every linter enabled, then selective disables)
- Thoughtful exclusions with documented reasons (e.g., `funlen` "Some functions intentionally long for clarity")
- Test-specific relaxations (forcetypeassert, dupl, goconst acceptable in tests)
- Import ordering via `gci` with custom section order (standard, default, k8s.io, project, dot)
- Formatters: gci, gofmt, goimports

**Pre-commit Hooks (Good)**:
- trailing-whitespace, end-of-file-fixer, check-yaml, check-merge-conflict
- go fmt, go vet, golangci-lint on commit
- go test on pre-push (smart - avoids slowing down every commit)

**Static Analysis**:
- `govulncheck` available via Makefile but not in CI
- No CodeQL, gosec, or Semgrep integration
- No secret detection (gitleaks)
- No dependency scanning beyond govulncheck

### Container Images

**Build Process (Good)**:
- Multi-stage Dockerfile with builder and runtime stages
- FIPS support (`CGO_ENABLED=1`, `GOEXPERIMENT=strictfipsruntime`, `-tags strictfipsruntime`)
- Multi-architecture: amd64, arm64, ppc64le
- UBI9 base images (go-toolset for build, ubi for runtime)
- Layer caching (go.mod/go.sum copied separately)
- Separate `Dockerfile.konflux` with pinned image digests and yq source build

**Runtime Image Contents**:
- kubectl, oc, yq, jq, wget, python3, pip
- Python packages: kubernetes, PyYAML (for upgrade helpers)
- CLI binary + upgrade helpers scripts

**Gaps**:
- No Trivy/Snyk scanning
- No image startup validation
- No SBOM generation
- No image signing/attestation in GitHub CI (may exist in Konflux)

### Security

**Current State**:
- `govulncheck` Makefile target (not in CI)
- No container vulnerability scanning
- No SAST tools (CodeQL, gosec)
- No secret detection
- FIPS-compliant build configuration
- Pinned image digests in Konflux Dockerfile

**Recommendations**:
1. Wire `govulncheck` into CI (trivial - target already exists)
2. Add Trivy scanning to PR workflow
3. Consider CodeQL for Go analysis
4. Add gitleaks as pre-commit hook

### Agent Rules (Agentic Flow Quality)

**Status**: Present and comprehensive
- **AGENTS.md** (root): Well-structured with build commands, test guidelines, coding standards, and required reading list
- **.claude/skills/lint-check/**: Custom skill for creating lint checks (24KB SKILL.md)
- **Documentation**: Extensive docs/ directory with testing.md, coding conventions, patterns, formatting, quality, design, and extensibility guides

**Strengths**:
- Clear build/test commands with explicit "NEVER use X directly" warnings
- Test framework guidance (Gomega, subtests, t.Context())
- Test data organization rules (package-level constants)
- Mock patterns documented
- Required reading list for all agents
- Custom skill for the most complex extension point (lint checks)

**Gaps**:
- No `.claude/rules/` directory with test pattern rules
- No unit-tests.md rule for generating test files
- No integration-tests.md rule for fake client setup
- Test patterns are in docs/ but not in agent-consumable rule format
- Missing `/test-rules-generator` output for automated test generation

## Recommendations

### Priority 0 (Critical)

1. **Add codecov integration with coverage thresholds** (4-6 hours)
   - Upload `coverage.out` from CI
   - Set minimum threshold (suggest 70% given current maturity)
   - Require no decrease on PRs
   - Add `.codecov.yml` configuration

2. **Wire govulncheck into CI** (30 minutes)
   - Add `make vulncheck` step to CI workflow
   - Already configured in Makefile with latest version pinning

3. **Add Trivy container scanning** (2-4 hours)
   - Scan built images for CRITICAL and HIGH CVEs
   - Block PRs on CRITICAL vulnerabilities
   - Add `.trivyignore` for known acceptable CVEs

### Priority 1 (High Value)

4. **Build E2E test infrastructure** (16-24 hours)
   - Set up envtest for controller-runtime based tests
   - Add CLI command smoke tests with real API server
   - Test key workflows: `lint`, `status`, `deps check`, `migrate`
   - Integrate into CI as a separate job

5. **Add image startup smoke testing** (4-8 hours)
   - After building container image, run basic validation:
     ```bash
     docker run --rm odh-cli:test --version
     docker run --rm odh-cli:test lint --help
     docker run --entrypoint kubectl odh-cli:test version --client
     ```

6. **Create .claude/rules/ for test patterns** (2-3 hours)
   - Use `/test-rules-generator` to generate agent rules
   - Cover unit tests, integration tests, lint check tests
   - Include Gomega patterns, fake client setup, test data conventions

### Priority 2 (Nice-to-Have)

7. **Add CodeQL analysis** (2-3 hours)
   - GitHub-native Go security analysis
   - Catches injection vulnerabilities, unsafe operations

8. **Add cross-platform binary validation** (2-4 hours)
   - Test GoReleaser builds for all platforms in CI
   - Validate binary execution on linux/amd64 at minimum

9. **Add secret detection** (1-2 hours)
   - Add gitleaks to pre-commit config
   - Catches accidentally committed secrets/tokens

## Comparison to Gold Standards

| Dimension | odh-cli | odh-dashboard | notebooks | kserve |
|-----------|---------|---------------|-----------|--------|
| Unit Tests | 9.0 | 9.0 | 7.0 | 9.0 |
| Integration/E2E | 5.0 | 9.0 | 8.0 | 9.0 |
| Build Integration | 6.0 | 8.0 | 7.0 | 7.0 |
| Image Testing | 5.0 | 7.0 | 9.0 | 6.0 |
| Coverage Tracking | 4.0 | 8.0 | 5.0 | 9.0 |
| CI/CD Automation | 7.5 | 9.0 | 8.0 | 9.0 |
| Agent Rules | 8.0 | 9.0 | 3.0 | 2.0 |
| **Overall** | **7.4** | **8.7** | **7.0** | **7.8** |

**Key Differentiators**:
- odh-cli's unit test coverage ratio (1.22x test-to-source LOC) is among the best
- Agent documentation (AGENTS.md + custom skills) is unusually thorough for a CLI project
- The main gap vs. gold standards is in E2E/integration testing and coverage enforcement
- Konflux integration is solid but lacks the image validation layer that notebooks has

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yml` - Main CI workflow (test, lint, build, release)
- `.tekton/odh-cli-pull-request.yaml` - Konflux PR pipeline
- `.tekton/odh-cli.yaml` - Konflux production pipeline
- `.goreleaser.yml` - Cross-platform release configuration
- `Makefile` - Build, test, lint, vulncheck targets

### Testing
- `tests/integration/lint/diagnostic_cr_test.go` - Integration test
- `pkg/util/test/mocks/` - Mock implementations
- 128 `*_test.go` files across `pkg/` directories

### Code Quality
- `.golangci.yml` - Comprehensive linter config (v2, all linters default enabled)
- `.pre-commit-config.yaml` - Pre-commit hooks (fmt, vet, lint, test)

### Container Images
- `Dockerfile` - Standard multi-arch build with UBI9
- `Dockerfile.konflux` - Konflux-specific build with pinned digests

### Agent Rules
- `AGENTS.md` - Comprehensive development guidelines
- `.claude/skills/lint-check/SKILL.md` - Custom lint check creation skill
- `docs/testing.md` - Test framework and conventions
- `docs/coding/conventions.md` - Coding standards
- `docs/coding/patterns.md` - Design patterns
