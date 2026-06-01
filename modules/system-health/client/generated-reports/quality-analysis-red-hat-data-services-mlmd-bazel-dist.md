---
repository: "red-hat-data-services/mlmd-bazel-dist"
overall_score: 1.0
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No test files exist; repository contains only build artifacts and Dockerfiles"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests; no test infrastructure of any kind"
  - dimension: "Build Integration"
    score: 1.0
    status: "Dockerfiles present but no automated PR-time build validation"
  - dimension: "Image Testing"
    score: 0.5
    status: "Multi-stage Dockerfile builds image but no runtime validation, scanning, or SBOM"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling, no codecov, no thresholds"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "No CI/CD workflows, no GitHub Actions, no Makefile, no automation"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules"
critical_gaps:
  - title: "No CI/CD pipeline at all"
    impact: "No automated quality gates; all changes are unvalidated before merge"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No tests of any kind"
    impact: "No verification that Bazel cache artifacts are valid or that Dockerfiles build correctly"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No security scanning"
    impact: "Container images and vendored dependencies are never scanned for vulnerabilities"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No image runtime validation"
    impact: "Built images may fail at startup without detection"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add a basic GitHub Actions workflow for Dockerfile lint and build validation"
    effort: "2-3 hours"
    impact: "Ensures Dockerfiles remain syntactically valid and buildable on every PR"
  - title: "Add Trivy container scanning"
    effort: "1-2 hours"
    impact: "Catches known CVEs in base images and vendored dependencies"
  - title: "Add hadolint for Dockerfile linting"
    effort: "1 hour"
    impact: "Enforces Dockerfile best practices and catches common mistakes"
  - title: "Add CODEOWNERS file"
    effort: "30 minutes"
    impact: "Ensures PRs get reviewed by the right people"
recommendations:
  priority_0:
    - "Create a basic CI/CD pipeline with GitHub Actions to validate Dockerfile builds on PRs"
    - "Add container image vulnerability scanning (Trivy) to catch CVEs in base images and cached dependencies"
    - "Add Dockerfile linting (hadolint) to enforce best practices"
  priority_1:
    - "Add a smoke test that builds the image and verifies the metadata_store_server binary starts successfully"
    - "Add Git LFS validation to CI to ensure large files are properly tracked"
    - "Add SBOM generation for the built container image"
  priority_2:
    - "Create agent rules (.claude/rules/) for contribution guidelines"
    - "Add documentation for the build regeneration process as CI validation"
    - "Consider automating the bazel cache regeneration workflow described in README"
---

# Quality Analysis: mlmd-bazel-dist

## Executive Summary

- **Overall Score: 1.0/10**
- **Repository Type**: Build artifact distribution / Bazel cache vendor repo
- **Primary Language**: N/A (Dockerfiles + vendored Bazel artifacts)
- **Key Strengths**: Multi-stage Dockerfile with clear purpose; README documents manual regeneration workflow
- **Critical Gaps**: No CI/CD, no tests, no security scanning, no quality tooling of any kind
- **Agent Rules Status**: Missing

This repository (`red-hat-data-services/mlmd-bazel-dist`) is a specialized build artifact repository that vendors Bazel external dependencies and cache for offline builds of [ml-metadata](https://github.com/opendatahub-io/ml-metadata). It contains only 4 non-git files: `README.md`, `Dockerfile`, `Dockerfile.deps`, and `.gitattributes`. The `_bazel_root/` directory contains ~15GB of vendored Bazel artifacts tracked via Git LFS.

Due to its nature as a pure build-artifact distribution repo, it has essentially no quality infrastructure. While the scope of testing possible is limited, there are still critical gaps that should be addressed.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No test files exist |
| Integration/E2E | 0/10 | No integration or E2E tests |
| **Build Integration** | **1/10** | **Dockerfiles present but no automated validation** |
| Image Testing | 0.5/10 | Multi-stage build exists but no runtime validation |
| Coverage Tracking | 0/10 | No coverage tooling |
| CI/CD Automation | 0/10 | No CI/CD workflows at all |
| Agent Rules | 0/10 | No agent rules or contribution guidance |

## Critical Gaps

### 1. No CI/CD Pipeline
- **Impact**: All changes to vendored artifacts and Dockerfiles are merged without any automated validation
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Detail**: There are no GitHub Actions workflows, no Makefile, no Jenkinsfile, no `.gitlab-ci.yml`. The repository has zero automation. Any PR that modifies the Dockerfiles or Bazel artifacts goes through with only human review.

### 2. No Tests of Any Kind
- **Impact**: No verification that vendored Bazel cache is valid or that container images build and function correctly
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Detail**: The repository contains zero test files. There are no unit tests, integration tests, E2E tests, smoke tests, or build validation tests. The manual regeneration workflow described in the README is entirely manual.

### 3. No Security Scanning
- **Impact**: Vendored dependencies (cached in `_bazel_root/`) and base images are never scanned for known vulnerabilities
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Detail**: No Trivy, Snyk, CodeQL, or any other security scanning is configured. The repository vendors a large number of external dependencies in the Bazel cache without any vulnerability assessment. Base images (`ubi9/ubi:9.3`, `ubi9/ubi-minimal:9.3`) are pinned to specific versions that may become outdated.

### 4. No Image Runtime Validation
- **Impact**: Built metadata_store_server image may fail at startup without any pre-merge detection
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Detail**: While the Dockerfile includes a multi-stage build that compiles `metadata_store_server`, there is no test that actually starts the resulting image and verifies the gRPC server initializes correctly.

## Quick Wins

### 1. Add Dockerfile Linting with hadolint (1 hour)
Add a basic GitHub Actions workflow that lints Dockerfiles:

```yaml
name: Lint Dockerfiles
on: [pull_request]
jobs:
  hadolint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hadolint/hadolint-action@v3.1.0
        with:
          dockerfile: Dockerfile
      - uses: hadolint/hadolint-action@v3.1.0
        with:
          dockerfile: Dockerfile.deps
```

### 2. Add Trivy Scanning (1-2 hours)
Scan Dockerfiles and the repository for CVEs:

```yaml
name: Security Scan
on: [pull_request]
jobs:
  trivy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'CRITICAL,HIGH'
```

### 3. Add CODEOWNERS (30 minutes)
Ensure the right team reviews changes to this critical build infrastructure:

```
# .github/CODEOWNERS
* @red-hat-data-services/mlmd-maintainers
```

## Detailed Findings

### CI/CD Pipeline
- **Workflows**: None. Zero CI/CD configuration files found.
- **PR validation**: None. No automated checks run on pull requests.
- **Periodic jobs**: None.
- **Build automation**: The only build instructions are manual Docker commands in README.md.
- **Concurrency control**: N/A
- **Caching**: N/A (though the repo itself IS a cache)

### Test Coverage
- **Unit tests**: 0 test files found (excluding vendored `_bazel_root/`)
- **Integration tests**: None
- **E2E tests**: None
- **Test-to-code ratio**: 0:1
- **Coverage tracking**: None (no `.codecov.yml`, no coverage generation)

### Code Quality
- **Linting**: No linting configuration (no `.golangci.yaml`, `.eslintrc`, `ruff.toml`, etc.)
- **Pre-commit hooks**: No `.pre-commit-config.yaml`
- **Static analysis**: No SAST tools configured
- **Formatters**: None configured

### Container Images
- **Dockerfiles**: 2 files (`Dockerfile`, `Dockerfile.deps`)
- **Multi-stage build**: Yes, `Dockerfile` uses a builder stage (UBI9) → minimal runtime stage (UBI9-minimal)
- **Base images**: `registry.redhat.io/ubi9/ubi:9.3` (builder), `registry.redhat.io/ubi9/ubi-minimal:9.3` (runtime)
- **Security scanning**: None
- **SBOM generation**: None
- **Image signing**: None
- **Multi-arch support**: No (x86_64 only, Bazel installer is x86_64-specific)
- **Runtime validation**: None
- **Vulnerability thresholds**: None

### Security
- **Container scanning**: Not configured
- **SAST/CodeQL**: Not configured
- **Dependency scanning**: Not configured (critical given the large vendored dependency cache)
- **Secret detection**: Not configured
- **Base image updates**: Pinned to `9.3`, no automated update mechanism

### Agent Rules (Agentic Flow Quality)
- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **.claude/rules/**: Not present
- **Coverage**: No test types have rules
- **Quality**: N/A
- **Gaps**: Everything is missing. No guidance for AI agents contributing to this repository.
- **Recommendation**: Given the repo's limited scope, a minimal `CLAUDE.md` with Dockerfile modification guidelines would be sufficient.

## Recommendations

### Priority 0 (Critical)
1. **Create a basic CI/CD pipeline** — Add a GitHub Actions workflow that at minimum validates Dockerfile syntax (hadolint) and runs a `docker build` dry-run on PRs.
2. **Add container vulnerability scanning** — Integrate Trivy to scan for CVEs in the base images and the vendored Bazel artifacts. This is especially important given the repo vendors ~15GB of external dependencies.
3. **Add Dockerfile linting** — Use hadolint to enforce Dockerfile best practices and catch issues like unpinned package installs.

### Priority 1 (High Value)
4. **Add image build smoke test** — Create a CI job that builds the Docker image and verifies the `metadata_store_server` binary starts (even if just checking `--help` output or a gRPC health check).
5. **Add Git LFS validation** — Verify that LFS pointers are valid and files are properly tracked, preventing broken clones.
6. **Add SBOM generation** — Generate a Software Bill of Materials for the built image to track vendored dependencies.
7. **Pin and automate base image updates** — Set up Dependabot or Renovate to track UBI9 base image updates.

### Priority 2 (Nice-to-Have)
8. **Create minimal agent rules** — Add a `CLAUDE.md` with guidelines for modifying Dockerfiles and regenerating the Bazel cache.
9. **Automate cache regeneration** — Convert the manual README workflow into a GitHub Actions workflow (dispatch-triggered) to reduce human error.
10. **Add documentation validation** — Ensure README stays in sync with actual Dockerfile and workflow changes.

## Comparison to Gold Standards

| Dimension | mlmd-bazel-dist | odh-dashboard | notebooks | kserve |
|-----------|----------------|---------------|-----------|--------|
| Unit Tests | None | Comprehensive Jest suite | N/A (image repo) | Go testing + coverage |
| Integration/E2E | None | Cypress E2E, contract tests | Image validation suite | Multi-version E2E |
| Build Integration | Manual only | PR-time builds, multi-mode | PR image builds | PR operator builds |
| Image Testing | None | N/A | 5-layer validation | Deployment testing |
| Coverage Tracking | None | Codecov with enforcement | N/A | Codecov + thresholds |
| CI/CD Automation | None | Multi-workflow, caching | Automated pipelines | Comprehensive CI |
| Agent Rules | None | Comprehensive .claude/rules/ | Minimal | Minimal |

**Note**: `mlmd-bazel-dist` is structurally different from these gold standards — it's a build artifact cache, not an application. However, even for its limited scope, the complete absence of CI/CD is a critical gap. The `notebooks` repository is the closest comparison (also image-focused) and demonstrates how even artifact-oriented repos can have meaningful quality automation.

## File Paths Reference

| File | Purpose |
|------|---------|
| `Dockerfile` | Production multi-stage build for metadata_store_server |
| `Dockerfile.deps` | Dependency fetcher image for Bazel cache generation |
| `.gitattributes` | Git LFS tracking rules for large Bazel artifacts |
| `README.md` | Manual regeneration workflow documentation |
| `_bazel_root/` | Vendored Bazel cache and external dependencies (~15GB via LFS) |

## Repository Characteristics

- **Single commit**: Repository has only 1 commit (`3f00e42 Added bazel external deps dir (1)`)
- **Single branch**: Only `main` branch exists
- **Size**: ~15GB total (mostly LFS-tracked Bazel artifacts)
- **Active development**: Appears to be a low-churn repository set up for offline build support
- **Purpose**: Enables disconnected/air-gapped builds of ml-metadata by vendoring all Bazel dependencies
