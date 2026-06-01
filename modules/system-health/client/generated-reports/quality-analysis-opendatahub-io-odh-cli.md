---
repository: "opendatahub-io/odh-cli"
overall_score: 4.6
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Strong test-to-code ratio (1.21x by lines) with 128 test files; 63% package coverage; Gomega + Testify frameworks"
  - dimension: "Integration/E2E"
    score: 3.0
    status: "Only 1 integration test file; no E2E test infrastructure; no CLI command-level integration tests"
  - dimension: "Build Integration"
    score: 5.0
    status: "Multi-arch Dockerfile with FIPS support; GoReleaser for binaries; no PR-time image validation"
  - dimension: "Image Testing"
    score: 4.0
    status: "Multi-stage UBI9 builds but no runtime validation, container scanning, SBOM, or image signing"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "Coverage profile generated (coverage.out) but no Codecov integration, thresholds, or PR reporting"
  - dimension: "CI/CD Automation"
    score: 6.5
    status: "Well-organized single workflow with concurrency control, Dependabot, pre-commit hooks; missing caching and security scanning"
  - dimension: "Agent Rules"
    score: 9.0
    status: "Exceptional AGENTS.md with mandatory reading list; comprehensive testing docs; lint-check skill with templates"
critical_gaps:
  - title: "No integration or E2E test coverage for CLI commands"
    impact: "CLI command behavior regressions go undetected; only unit-level logic is validated"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Coverage can silently regress across PRs; no visibility into coverage trends"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container image security scanning in CI"
    impact: "Vulnerabilities in base images or runtime dependencies ship undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "govulncheck not integrated into CI pipeline"
    impact: "Known Go vulnerability exposure not caught until manual runs"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No secret detection in CI or pre-commit"
    impact: "Accidental credential leaks may go undetected"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add Codecov integration to CI workflow"
    effort: "2-4 hours"
    impact: "Immediate visibility into coverage trends and PR-level coverage diffs"
  - title: "Add govulncheck to CI test job"
    effort: "30 minutes"
    impact: "Catch known Go vulnerabilities on every PR"
  - title: "Add Trivy container scanning to release workflow"
    effort: "1-2 hours"
    impact: "Detect base image and dependency vulnerabilities before publishing"
  - title: "Add GitHub Actions caching for Go modules"
    effort: "30 minutes"
    impact: "Faster CI runs by caching go mod download"
  - title: "Create .dockerignore file"
    effort: "15 minutes"
    impact: "Smaller build context, faster image builds, prevent accidental secret inclusion"
recommendations:
  priority_0:
    - "Add CLI command integration tests using a test harness (e.g., cobra test utilities or exec-based tests)"
    - "Integrate Codecov with coverage thresholds (e.g., 60% minimum, no regression on PRs)"
    - "Add Trivy container scanning to CI workflow for PR and release jobs"
  priority_1:
    - "Add govulncheck to CI test job (already has Makefile target)"
    - "Add GitHub Actions cache for Go modules and build artifacts"
    - "Add gitleaks secret scanning to pre-commit hooks and CI"
    - "Create .dockerignore to exclude docs, tests, and build artifacts from container context"
  priority_2:
    - "Add CodeQL or gosec static security analysis workflow"
    - "Implement SBOM generation for container images"
    - "Add container image signing with cosign/sigstore"
    - "Add cross-platform CLI testing (Windows, macOS) in CI"
    - "Create .claude/rules/ directory with per-test-type rule files"
---

# Quality Analysis: odh-cli

## Executive Summary

- **Overall Score: 4.6/10**
- **Repository Type**: Go CLI tool (kubectl plugin for ODH/RHOAI)
- **Language**: Go 1.25.7
- **Key Strengths**: Exceptional agent documentation (AGENTS.md), strong unit test culture with 1.21x test-to-code line ratio, well-configured linting with 20+ golangci-lint rules, multi-arch container builds with FIPS support
- **Critical Gaps**: Near-zero integration/E2E testing for CLI commands, no coverage tracking or enforcement, no security scanning in CI
- **Agent Rules Status**: Exceptional (9/10) — comprehensive AGENTS.md, detailed testing docs, lint-check skill with templates

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.0/10 | Strong test-to-code ratio (1.21x by lines), 128 test files, Gomega + Testify |
| Integration/E2E | 3.0/10 | Only 1 integration test file; no CLI command testing |
| **Build Integration** | **5.0/10** | **Multi-arch Dockerfile, FIPS builds; no PR-time image validation** |
| Image Testing | 4.0/10 | Multi-stage UBI9 builds; no scanning, SBOM, or signing |
| Coverage Tracking | 2.0/10 | coverage.out generated but no integration, thresholds, or reporting |
| CI/CD Automation | 6.5/10 | Well-organized workflow, Dependabot, pre-commit; no caching or security scanning |
| Agent Rules | 9.0/10 | Exceptional AGENTS.md, lint-check skill, comprehensive docs |

## Critical Gaps

### 1. No Integration or E2E Test Coverage for CLI Commands
- **Impact**: CLI command behavior regressions go undetected; only unit-level logic is validated
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: The repository has only 1 integration test file (`tests/integration/lint/diagnostic_cr_test.go`). There are no E2E tests for CLI commands despite 13 `cmd/` packages with zero direct tests. For a CLI tool that interacts with Kubernetes clusters, this is the most critical gap.
- **Recommendation**: Implement command-level integration tests using cobra test utilities or exec-based testing that exercises the full command pipeline.

### 2. No Coverage Tracking or Enforcement
- **Impact**: Coverage can silently regress across PRs; no visibility into trends
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The Makefile generates `coverage.out` via `go test -coverprofile`, but this file is never uploaded, analyzed, or validated. No Codecov/Coveralls integration exists. No minimum coverage thresholds are enforced.
- **Recommendation**: Add Codecov integration with a coverage upload step in CI and set a floor threshold (e.g., 60%).

### 3. No Container Image Security Scanning
- **Impact**: Vulnerabilities in UBI9 base images or installed runtime dependencies (kubectl, oc, yq, Python packages) ship undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The runtime container installs multiple external tools (kubectl, oc, yq) and Python packages (kubernetes, PyYAML) but has no Trivy, Snyk, or other vulnerability scanning in CI/CD.
- **Recommendation**: Add Trivy scanning to the CI workflow for both PR validation and release publishing.

### 4. govulncheck Not in CI Pipeline
- **Impact**: Known Go vulnerability exposure not caught until manual runs
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: A `make vulncheck` target exists using `govulncheck` but is not invoked in the CI workflow. This is a near-zero-effort win since the tooling is already set up.

### 5. No Secret Detection
- **Impact**: Accidental credential leaks may go undetected
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: No gitleaks, trufflehog, or similar secret scanning tools are configured in pre-commit hooks or CI. The Dockerfile uses registry credentials via CI secrets but there's no guardrail against accidental commits.

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
Upload the already-generated `coverage.out` to Codecov for PR-level coverage diffs and trend tracking.
```yaml
# Add to ci.yml test job after "make test"
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    file: coverage.out
    token: ${{ secrets.CODECOV_TOKEN }}
```

### 2. Add govulncheck to CI (30 minutes)
```yaml
# Add to ci.yml test job
- name: Run vulnerability check
  run: make vulncheck
```

### 3. Add Trivy Container Scanning (1-2 hours)
```yaml
# Add as a new job or step in release workflow
- name: Scan container image
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'quay.io/rhoai/rhoai-upgrade-helpers-rhel9:${{ steps.version.outputs.VERSION }}'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
```

### 4. Add GitHub Actions Caching (30 minutes)
```yaml
# Add to ci.yml test job after setup-go
- name: Cache Go modules
  uses: actions/cache@v4
  with:
    path: |
      ~/go/pkg/mod
      ~/.cache/go-build
    key: ${{ runner.os }}-go-${{ hashFiles('go.sum') }}
    restore-keys: ${{ runner.os }}-go-
```

### 5. Create .dockerignore (15 minutes)
```
docs/
tests/
*.md
.github/
.pre-commit-config.yaml
.golangci.yml
.goreleaser.yml
coverage.out
```

## Detailed Findings

### CI/CD Pipeline

**Workflow**: Single `ci.yml` (133 lines) with 4 jobs:

| Job | Trigger | Purpose |
|-----|---------|---------|
| `test` | PR, push to main, release | Run `make test` + `make lint` |
| `dev-container` | Push to main (after test) | Build & push dev image |
| `release-container` | Release created (after test) | Build & push versioned image |
| `release-binary` | Release created (after test) | GoReleaser cross-platform binaries |

**Strengths**:
- Concurrency control: `cancel-in-progress: true` per branch
- Dependabot: Daily Go module updates, weekly Actions updates
- Pre-commit hooks: go-fmt, go-vet, golangci-lint, go-unit-tests (pre-push)
- GoReleaser for 5-platform binary releases (Windows, Linux, macOS × amd64/arm64)

**Weaknesses**:
- No GitHub Actions caching (Go modules downloaded fresh every run)
- No security scanning jobs (Trivy, CodeQL, gosec)
- govulncheck target exists but not used in CI
- No parallel test execution or matrix builds

### Test Coverage

**Test Statistics**:

| Metric | Value |
|--------|-------|
| Test files | 128 |
| Source files | 201 |
| Test-to-code file ratio | 0.64 |
| Test-to-code line ratio | 1.21 (35,855 test / 29,448 source) |
| Tested packages | 54 of 83 (63%) |
| Untested packages | 30 (37%) |

**Testing Framework**: Go `testing` + Gomega (BDD assertions) + Testify (mocking)

**Strengths**:
- Test code exceeds source code by volume (1.21x)
- Well-organized mock infrastructure (`pkg/util/test/mocks/`)
- Comprehensive lint check tests (15+ check packages fully tested)
- Clear testing documentation with patterns and anti-patterns

**Weaknesses**:
- All 13 `cmd/` packages have zero direct tests
- Only 1 integration test file (`tests/integration/lint/diagnostic_cr_test.go`)
- No E2E tests for CLI workflows
- No table-driven test enforcement
- Coverage file generated but unused

### Code Quality

**Linting (golangci-lint v2.8.0)**:
- Configuration: `.golangci.yml` (122 lines)
- Default: All linters enabled with 14 intentional disables
- Test-specific exclusions for 11 linters
- Custom thresholds: cyclop max-complexity=15, gocognit min-complexity=50
- Import ordering enforced via `gci` (standard → k8s → project → dot)
- Revive rules: enable-all with 23 customized rules
- Lint timeout: 10 minutes

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- Standard hooks: trailing-whitespace, end-of-file-fixer, check-yaml, check-merge-conflict
- Go hooks: go-fmt, go-vet, golangci-lint, go-unit-tests (pre-push)

**Quality Gates** (from `docs/quality.md`):
1. `make lint/fix` → auto-fix formatting
2. `make lint` → check remaining issues
3. Manual fixes for judgment calls
4. `make check` → full verification
5. `make test` → test suite

### Container Images

**Dockerfile** (134 lines, multi-stage):
- **Builder**: `registry.access.redhat.com/ubi9/go-toolset:1.25`
- **Runtime**: `registry.access.redhat.com/ubi9/ubi:latest`
- **Platforms**: linux/amd64, linux/arm64, linux/ppc64le
- **FIPS**: `GOEXPERIMENT=strictfipsruntime` with `CGO_ENABLED=1`

**Runtime Dependencies**:
- kubectl (latest stable), oc (4.17), yq (4.44.6)
- Python 3 + kubernetes>=28.1.0, PyYAML>=6.0
- jq, wget

**Security Concerns**:
- No .dockerignore file (entire repo context sent to build)
- No explicit non-root USER in runtime stage
- No container image scanning
- No SBOM generation
- No image signing/attestation
- yum packages not version-pinned

### Security

**Present**:
- Dependabot for dependency updates (daily Go, weekly Actions)
- FIPS-compliant build support
- UBI9 base images (Red Hat security-maintained)
- govulncheck target (manual use only)

**Missing**:
- No Trivy/Snyk container scanning
- No CodeQL or gosec static analysis
- No gitleaks/trufflehog secret detection
- No SBOM generation
- No image signing (cosign/sigstore)
- govulncheck not in CI

### Agent Rules (Agentic Flow Quality)

**Status**: Exceptional — one of the best-documented repositories for AI agent guidance

**AGENTS.md** (82 lines):
- Clear project overview and architecture
- **Mandatory reading list** with 10 required documents covering guidelines, standards, testing, and patterns
- Build/run instructions using `make` commands exclusively
- Explicit consequence statement: "Failure to read and follow these guidelines will result in code that does not meet project standards"

**.claude/skills/lint-check/SKILL.md** (636 lines):
- Complete lint check creation skill with 4 implementation templates
- Validation builders, condition API, standard constants
- 8 documented common pitfalls with solutions
- 9 critical rules with rationale
- Test file template with helpers

**docs/testing.md** (282 lines):
- Framework specification (Gomega, not Ginkgo)
- Critical rules: package-level test data constants, testify/mock centralization
- Gomega struct assertion patterns (HaveField/MatchFields)
- Mock organization structure

**docs/agent.md** (19 lines):
- Mandatory self-review process before any response
- Senior-level critique checklist

**Gaps**:
- No `.claude/rules/` directory with per-test-type rules
- No `.claude/settings.json` for harness configuration
- No CLAUDE.md (AGENTS.md covers this well)

## Recommendations

### Priority 0 (Critical)

1. **Add CLI command integration tests** — The 13 `cmd/` packages have zero tests. Implement integration tests that exercise command parsing, flag handling, and output formatting using cobra's built-in test utilities or subprocess-based testing. Start with the most-used commands.

2. **Integrate Codecov with coverage thresholds** — Upload the already-generated `coverage.out`, set a floor (e.g., 60%), and enable PR annotations showing coverage diffs. This takes 2-4 hours and provides immediate visibility.

3. **Add Trivy container scanning** — The runtime image installs external binaries (kubectl, oc, yq) and Python packages that could contain vulnerabilities. Add Trivy scanning to both PR and release workflows.

### Priority 1 (High Value)

4. **Add govulncheck to CI** — The Makefile target already exists. Add `make vulncheck` to the test job. 30-minute effort.

5. **Add GitHub Actions caching** — Cache `~/go/pkg/mod` and `~/.cache/go-build` keyed on `go.sum`. 30-minute effort for faster CI.

6. **Add gitleaks secret scanning** — Configure in pre-commit hooks and CI to prevent credential leaks.

7. **Create .dockerignore** — Exclude docs, tests, CI config from build context. 15-minute effort.

### Priority 2 (Nice-to-Have)

8. **Add CodeQL or gosec** — Static security analysis for Go code patterns.
9. **Generate SBOM** — Use syft/cyclonedx during container builds for supply chain transparency.
10. **Container image signing** — Implement cosign/sigstore for published images.
11. **Cross-platform CI testing** — Add matrix builds for Windows/macOS to validate CLI behavior.
12. **Create .claude/rules/** — Split testing guidance into per-type rule files (unit-tests.md, integration-tests.md, etc.) for more targeted agent guidance.

## Comparison to Gold Standards

| Practice | odh-cli | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|----------|---------|---------------------|-------------------|---------------|
| Unit test ratio | 1.21x (lines) | High | Moderate | High |
| Integration tests | 1 file | Extensive | N/A | Extensive |
| E2E tests | None | Comprehensive | N/A | Multi-version |
| Coverage enforcement | None | Yes (thresholds) | N/A | Yes (Codecov) |
| Coverage service | None | Codecov | N/A | Codecov |
| Container scanning | None | Trivy | Trivy | Trivy |
| Secret detection | None | Yes | N/A | Yes |
| Pre-commit hooks | Yes (4 hooks) | Yes | N/A | Yes |
| Linting | Excellent (20+) | Strong | N/A | Strong |
| Multi-arch builds | Yes (3 arch) | Yes | Yes (5-layer) | Yes |
| SBOM generation | None | Yes | Yes | Yes |
| Image signing | None | Cosign | N/A | Cosign |
| Agent rules | Exceptional | Comprehensive | Minimal | Minimal |
| Contract tests | None | Yes | N/A | N/A |
| Dependabot/Renovate | Yes (Dependabot) | Yes | Yes | Yes |
| govulncheck | Manual only | CI-integrated | N/A | CI-integrated |

## File Paths Reference

| Category | File | Purpose |
|----------|------|---------|
| CI/CD | `.github/workflows/ci.yml` | Main CI pipeline (133 lines) |
| CI/CD | `.github/dependabot.yml` | Dependency update config |
| Linting | `.golangci.yml` | golangci-lint v2 config (122 lines) |
| Hooks | `.pre-commit-config.yaml` | Pre-commit hooks (35 lines) |
| Build | `Makefile` | Build tooling (207 lines) |
| Build | `Dockerfile` | Multi-stage container build (134 lines) |
| Release | `.goreleaser.yml` | Binary release config (58 lines) |
| Testing | `docs/testing.md` | Testing framework docs (282 lines) |
| Quality | `docs/quality.md` | Quality gates docs (81 lines) |
| Agent | `AGENTS.md` | Agent rules and reading list (82 lines) |
| Agent | `.claude/skills/lint-check/SKILL.md` | Lint check creation skill (636 lines) |
| Agent | `docs/agent.md` | Self-review requirements (19 lines) |
| Tests | `pkg/util/test/mocks/` | Centralized mock implementations |
| Tests | `tests/integration/lint/` | Integration tests (1 file) |
| PR | `.github/pull_request_template.md` | PR checklist template |
