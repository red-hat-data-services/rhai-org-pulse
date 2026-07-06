---
repository: "red-hat-data-services/mlmd-bazel-dist"
overall_score: 1.2
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No tests exist - repository is a Bazel cache/dependency bundle"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests of any kind"
  - dimension: "Build Integration"
    score: 1.0
    status: "Dockerfiles present but no CI workflow validates them"
  - dimension: "Image Testing"
    score: 0.0
    status: "No image testing, scanning, or runtime validation"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tracking - no code to cover"
  - dimension: "CI/CD Automation"
    score: 1.0
    status: "No CI/CD workflows - no .github/workflows directory"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No agent rules, CLAUDE.md, or .claude/ directory"
critical_gaps:
  - title: "No CI/CD pipeline at all"
    impact: "No automated validation of any kind — Dockerfile changes could break downstream ml-metadata builds silently"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No container image build validation"
    impact: "Dockerfiles may drift from upstream ml-metadata changes and break without notice"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No security scanning on committed Bazel artifacts"
    impact: "15GB of vendored binary artifacts with no vulnerability scanning — potential supply chain risk"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No dependency update automation"
    impact: "Bazel 5.3.0 is pinned with no mechanism to detect or adopt newer versions"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "Single commit, stale repository"
    impact: "Repository appears unmaintained — only 1 commit on main, unknown if still in active use"
    severity: "MEDIUM"
    effort: "1 hour"
quick_wins:
  - title: "Add a basic GitHub Actions workflow to validate Dockerfile syntax"
    effort: "1-2 hours"
    impact: "Catches Dockerfile syntax errors on PR, prevents broken builds"
  - title: "Add Trivy scan on the committed Bazel artifacts and Dockerfiles"
    effort: "1-2 hours"
    impact: "Detects known vulnerabilities in vendored dependencies"
  - title: "Add Dependabot or Renovate for base image updates"
    effort: "1 hour"
    impact: "Automatic PRs when UBI base images have security patches"
  - title: "Add a CODEOWNERS file"
    effort: "30 minutes"
    impact: "Ensures PRs get reviewed by the right team"
recommendations:
  priority_0:
    - "Add a minimal CI/CD workflow that builds the Docker image on PRs to validate Dockerfile integrity"
    - "Add Trivy or Grype scanning on the Bazel artifact tree to detect supply chain vulnerabilities"
    - "Evaluate whether this repository is still needed — single commit, very specific purpose, may be obsolete"
  priority_1:
    - "Add image startup validation (build + run metadata_store_server --help) in CI"
    - "Pin and validate base image digests (UBI 9.3) for reproducible builds"
    - "Add .dockerignore to exclude .git and unnecessary files from build context"
  priority_2:
    - "Add CLAUDE.md with repository purpose documentation"
    - "Add Hadolint for Dockerfile linting"
    - "Consider multi-architecture support if needed for ARM/s390x"
---

# Quality Analysis: mlmd-bazel-dist

## Executive Summary

- **Overall Score: 1.2/10**
- **Repository Type**: Infrastructure / Dependency Vendoring
- **Primary Language**: Dockerfile / Bazel (no application code)
- **Key Strengths**: Multi-stage Dockerfile with clear separation of build and runtime
- **Critical Gaps**: No CI/CD, no tests, no security scanning, no automation of any kind
- **Agent Rules Status**: Missing

This repository (`red-hat-data-services/mlmd-bazel-dist`) is a single-purpose infrastructure repository that vendors Bazel cache and external dependencies to enable disconnected builds of the [ml-metadata](https://github.com/opendatahub-io/ml-metadata) project. It contains only 2 Dockerfiles, a README, a `.gitattributes` (for Git LFS), and a `_bazel_root/` directory with vendored Bazel artifacts.

The repository has **no CI/CD pipeline, no tests, no security scanning, and no quality tooling** of any kind. It has a single commit on the `main` branch and appears to be minimally maintained.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No tests — repository has no application code |
| Integration/E2E | 0/10 | No integration or E2E tests |
| **Build Integration** | **1/10** | **Dockerfiles exist but no CI validates them** |
| Image Testing | 0/10 | No image testing, scanning, or runtime validation |
| Coverage Tracking | 0/10 | No coverage — no code to cover |
| CI/CD Automation | 1/10 | No `.github/workflows/` directory at all |
| Agent Rules | 0/10 | No CLAUDE.md, .claude/, or agent guidance |

## Critical Gaps

### 1. No CI/CD Pipeline
- **Impact**: No automated validation — Dockerfile changes, Bazel cache updates, or dependency changes are entirely unvalidated
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The repository has no `.github/workflows/` directory. Any PR could introduce broken Dockerfiles, corrupt Bazel artifacts, or security vulnerabilities without detection.

### 2. No Container Image Build Validation
- **Impact**: Dockerfiles may drift from upstream ml-metadata changes and break silently
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: `Dockerfile` references CPaaS-specific variables (`REMOTE_SOURCE`, `REMOTE_SOURCE_DIR`) and builds `metadata_store_server` via Bazel in offline mode. No CI validates that these builds succeed.

### 3. No Security Scanning on Vendored Artifacts
- **Impact**: ~15GB of vendored binary Bazel artifacts with zero vulnerability scanning — significant supply chain risk
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The `_bazel_root/` directory contains pre-built Java JARs, compiled tools, and cached external dependencies stored via Git LFS. None are scanned for known CVEs.

### 4. No Dependency Update Mechanism
- **Impact**: Bazel 5.3.0 is hardcoded with no Dependabot, Renovate, or manual update process
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: Both Dockerfiles pin Bazel 5.3.0. UBI base images are pinned to 9.3 in one Dockerfile and `latest` in the other (inconsistency).

### 5. Repository Appears Stale
- **Impact**: Unknown if repository is still actively used or has been superseded
- **Severity**: MEDIUM
- **Effort**: 1 hour investigation
- **Details**: Only 1 commit exists on `main`. The README documents a manual workflow involving `docker cp`. No indication of when the Bazel cache was last refreshed.

## Quick Wins

### 1. Add Dockerfile Validation Workflow (1-2 hours)
```yaml
# .github/workflows/validate.yml
name: Validate Dockerfiles
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
```yaml
# .github/workflows/security.yml
name: Security Scan
on: [pull_request, push]
jobs:
  trivy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          lfs: true
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'CRITICAL,HIGH'
```

### 3. Add Base Image Update Automation (1 hour)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 4. Add CODEOWNERS (30 minutes)
```
# .github/CODEOWNERS
* @red-hat-data-services/mlmd-maintainers
```

## Detailed Findings

### CI/CD Pipeline
- **Status**: Non-existent
- **Workflows**: None (no `.github/workflows/` directory)
- **Build triggers**: None
- **Concurrency control**: N/A
- **Caching**: N/A
- **Assessment**: The repository has zero CI/CD infrastructure. This is the single largest quality gap.

### Test Coverage
- **Unit Tests**: None (no application code to test)
- **Integration Tests**: None
- **E2E Tests**: None
- **Test files found**: Only Bazel embedded test tools (not repo-specific tests)
- **Assessment**: Given this is a dependency-vendoring repo, unit tests are not applicable. However, there should be at minimum:
  - A smoke test that builds the Docker image
  - A validation that the Bazel cache structure is correct
  - A check that `metadata_store_server` starts successfully in the built image

### Code Quality
- **Linting**: No linters configured (no Hadolint for Dockerfiles)
- **Pre-commit hooks**: None
- **Static analysis**: None
- **Formatters**: None
- **Assessment**: Minimal, but the repository has very little code to lint — just 2 Dockerfiles.

### Container Images
- **Dockerfiles**: 2 (`Dockerfile` for production build, `Dockerfile.deps` for cache generation)
- **Multi-stage build**: Yes — `Dockerfile` uses a builder stage (UBI9) and a minimal runtime stage (UBI9 minimal)
- **Base images**: `registry.redhat.io/ubi9/ubi:9.3` (builder), `registry.redhat.io/ubi9/ubi-minimal:9.3` (runtime), `registry.access.redhat.com/ubi9/ubi:latest` (deps)
- **Base image inconsistency**: `Dockerfile.deps` uses `:latest` while `Dockerfile` pins `:9.3`
- **Security scanning**: None
- **SBOM generation**: None
- **Image signing**: None
- **Runtime validation**: None
- **Assessment**: The multi-stage build is good practice, but there's no validation, scanning, or signing.

### Security
- **Container scanning**: None (no Trivy, Snyk, or Grype)
- **SAST**: None (no CodeQL, gosec, or Semgrep)
- **Dependency scanning**: None
- **Secret detection**: None (no Gitleaks, TruffleHog)
- **Supply chain risk**: HIGH — ~15GB of vendored Bazel artifacts (JARs, compiled tools) stored via Git LFS with no provenance or scanning
- **Assessment**: The vendored artifacts represent a significant supply chain attack surface with zero mitigation.

### Agent Rules (Agentic Flow Quality)
- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **`.claude/` directory**: Not present
- **`.claude/rules/`**: Not present
- **Assessment**: No agent rules or AI-assisted development guidance exists. Given the repository's simplicity, basic rules documenting the Bazel cache regeneration workflow would be beneficial.

### Build Integration
- **PR build validation**: None — no CI workflows exist
- **Konflux simulation**: None
- **Image startup testing**: None
- **Assessment**: Builds are entirely manual. The README describes a manual `docker build` + `docker cp` workflow with no automation.

## Recommendations

### Priority 0 (Critical)
1. **Add a minimal CI/CD workflow** that validates Dockerfile syntax and attempts an image build on PRs
2. **Add security scanning** (Trivy filesystem scan) on the vendored Bazel artifacts to detect known CVEs
3. **Evaluate repository necessity** — determine if this repo is still actively used or has been superseded by a different build approach

### Priority 1 (High Value)
1. **Add image startup validation** — build the image and run `metadata_store_server --help` to verify it starts
2. **Pin base image digests** consistently across both Dockerfiles for reproducible builds
3. **Add `.dockerignore`** to exclude `.git/` and reduce build context size
4. **Add Dependabot** for automated base image security updates

### Priority 2 (Nice-to-Have)
1. **Add CLAUDE.md** documenting repository purpose, the Bazel cache regeneration process, and build requirements
2. **Add Hadolint** for Dockerfile best practice linting
3. **Document Bazel cache refresh cadence** — how often should the cache be regenerated?
4. **Consider multi-architecture support** if downstream consumers need ARM or s390x builds

## Comparison to Gold Standards

| Dimension | mlmd-bazel-dist | odh-dashboard | notebooks | kserve |
|-----------|----------------|---------------|-----------|--------|
| CI/CD Pipeline | None | Comprehensive | Strong | Comprehensive |
| Unit Tests | None | Extensive (Jest) | Varied | Go testing |
| Integration/E2E | None | Cypress E2E | Image boot tests | Multi-version E2E |
| Image Testing | None | Build validation | 5-layer validation | Image scanning |
| Coverage Tracking | None | Codecov enforced | Partial | Codecov enforced |
| Security Scanning | None | Trivy + CodeQL | Trivy | Trivy + CodeQL |
| Agent Rules | None | Comprehensive | Partial | Partial |
| **Overall** | **1.2/10** | **9/10** | **8/10** | **8.5/10** |

**Note**: Direct comparison is somewhat unfair — mlmd-bazel-dist is a dependency-vendoring repo, not an application. However, even infrastructure repos should have basic CI validation and security scanning.

## File Paths Reference

| File | Purpose |
|------|---------|
| `Dockerfile` | Production multi-stage build for metadata_store_server |
| `Dockerfile.deps` | Generates Bazel cache by cloning ml-metadata and running `bazel sync` |
| `.gitattributes` | Configures Git LFS for large Bazel artifacts |
| `_bazel_root/` | Vendored Bazel cache, external dependencies, and build tools (~15GB via LFS) |
| `README.md` | Documents manual cache regeneration workflow |
