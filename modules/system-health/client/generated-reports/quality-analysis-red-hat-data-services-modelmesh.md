---
repository: "red-hat-data-services/modelmesh"
overall_score: 4.7
scorecard:
  - dimension: "Unit Tests"
    score: 6.0
    status: "Extensive JUnit 5 test suite (52 test files) but no coverage tracking or enforcement"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "Integration tests with embedded Zookeeper and etcd; cluster, TLS, and sidecar tests"
  - dimension: "Build Integration"
    score: 4.0
    status: "Konflux PR pipeline exists but is trigger-gated; PRs to main skip tests entirely"
  - dimension: "Image Testing"
    score: 3.0
    status: "Multi-arch builds but no runtime validation, scanning, or SBOM"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No JaCoCo, codecov, or any coverage measurement; no enforcement"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "CodeQL SAST and multi-arch builds present; tests gated to release branches only"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory; no AI agent guidance"
critical_gaps:
  - title: "PRs to main do not run tests"
    impact: "Code can be merged to main without any test execution; regressions go undetected"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No test coverage tracking"
    impact: "No visibility into which code is untested; coverage can silently degrade"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container image scanning"
    impact: "Vulnerabilities in base images and dependencies not detected before deployment"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "Pre-commit hooks misconfigured for project language"
    impact: "Go linter and JS prettier run on a Java project; no actual Java quality checks"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No dependency management automation"
    impact: "Outdated or vulnerable dependencies not flagged; manual tracking required"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Enable test execution on PRs to main branch"
    effort: "1 hour"
    impact: "Prevent regressions from reaching main; critical safety net"
  - title: "Add JaCoCo coverage plugin to Maven"
    effort: "2-3 hours"
    impact: "Visibility into test coverage; enables enforcement of coverage thresholds"
  - title: "Add Trivy scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Early detection of container image vulnerabilities before deployment"
  - title: "Enable Dependabot for dependency updates"
    effort: "30 minutes"
    impact: "Automated PRs for vulnerable and outdated dependencies"
  - title: "Fix pre-commit config for Java"
    effort: "1-2 hours"
    impact: "Catch Java code quality issues before commit with Checkstyle or SpotBugs"
recommendations:
  priority_0:
    - "Add main branch to build.yml PR trigger so tests run on all PRs, not just release branch PRs"
    - "Add JaCoCo Maven plugin and codecov integration with minimum coverage thresholds"
    - "Add Trivy or Snyk container scanning to the CI pipeline"
  priority_1:
    - "Replace Go/JS pre-commit hooks with Java-appropriate checks (Checkstyle, SpotBugs, google-java-format)"
    - "Enable Dependabot or Renovate for automated dependency management"
    - "Add image startup and health-check validation to PR builds"
    - "Create .claude/rules/ with test creation guidance for AI agents"
  priority_2:
    - "Add SBOM generation (Syft or CycloneDX) to image builds"
    - "Add Gitleaks secret detection scanning"
    - "Implement performance regression testing for model load/serve latency"
    - "Add contract tests for gRPC API boundaries"
---

# Quality Analysis: ModelMesh (red-hat-data-services/modelmesh)

## Executive Summary

- **Overall Score: 4.7/10**
- **Repository Type**: Java-based model serving framework (distributed LRU cache for runtime models)
- **Primary Language**: Java 21 (Maven build system)
- **Framework**: gRPC-based service with etcd/Zookeeper backends

### Key Strengths
- Extensive unit/integration test suite (52 test files) covering cluster, TLS, sidecar, payload, metrics, and error propagation scenarios
- Multi-architecture container builds (amd64, arm64, ppc64le, s390x)
- CodeQL SAST scanning on push and schedule
- Hermetic Konflux builds with centralized pipeline management

### Critical Gaps
- **PRs to main do not run tests** — the build workflow only triggers tests on PRs to `release-*` branches
- **Zero coverage tracking** — no JaCoCo, codecov, or any coverage measurement
- **No container image scanning** — no Trivy, Snyk, or vulnerability thresholds
- **Pre-commit hooks misconfigured** — runs Go linter and JS prettier on a Java project

### Agent Rules Status: Missing
- No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory
- No test automation guidance for AI agents

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.0/10 | Extensive JUnit 5 suite but no coverage tracking |
| Integration/E2E | 7.0/10 | Embedded Zookeeper/etcd integration tests |
| **Build Integration** | **4.0/10** | **Konflux PR pipeline is trigger-gated; main PRs skip tests** |
| Image Testing | 3.0/10 | Multi-arch builds but no runtime validation |
| Coverage Tracking | 1.0/10 | No coverage tool configured at all |
| CI/CD Automation | 5.0/10 | CodeQL present; tests gated to release branches |
| Agent Rules | 0.0/10 | No AI agent guidance exists |

## Critical Gaps

### 1. PRs to Main Do Not Run Tests
- **Impact**: Code can be merged to main without any automated test execution; regressions go undetected until release branch integration
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Root Cause**: `build.yml` PR trigger only matches `release-[0-9].[0-9]+` branches — `main` is excluded
- **Fix**: Add `main` to the `pull_request.branches` list in `build.yml`

### 2. No Test Coverage Tracking
- **Impact**: No visibility into which code is tested; coverage silently degrades over time; impossible to set or enforce quality gates
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Root Cause**: No JaCoCo Maven plugin configured; no codecov or coveralls integration
- **Fix**: Add `jacoco-maven-plugin` to `pom.xml`, configure coverage reporting in CI, integrate with codecov

### 3. No Container Image Scanning
- **Impact**: Vulnerabilities in UBI9 base images and Java dependencies not detected before deployment
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Root Cause**: No Trivy, Snyk, or Grype scanning in any workflow
- **Fix**: Add Trivy scanning step to `build.yml` after image build

### 4. Pre-commit Hooks Misconfigured
- **Impact**: The `.pre-commit-config.yaml` runs `golangci-lint` (Go linter) and `prettier` (JS formatter) on a Java project — these provide zero value
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Root Cause**: Configuration inherited from a multi-language template; never updated for Java
- **Fix**: Replace with Java-appropriate hooks (Checkstyle, google-java-format, SpotBugs)

### 5. No Dependency Management Automation
- **Impact**: Outdated or vulnerable Maven dependencies (gRPC, Netty, Jackson, BouncyCastle, etc.) not flagged automatically
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Root Cause**: No Dependabot or Renovate configuration
- **Fix**: Add `.github/dependabot.yml` for Maven ecosystem

## Quick Wins

### 1. Enable Tests on PRs to Main (1 hour)
Add `main` to the PR trigger in `build.yml`:
```yaml
on:
  pull_request:
    branches:
      - main                    # ADD THIS
      - "release-[0-9].[0-9]+"
```

### 2. Add JaCoCo Coverage Plugin (2-3 hours)
Add to `pom.xml` plugins section:
```xml
<plugin>
  <groupId>org.jacoco</groupId>
  <artifactId>jacoco-maven-plugin</artifactId>
  <version>0.8.12</version>
  <executions>
    <execution>
      <goals><goal>prepare-agent</goal></goals>
    </execution>
    <execution>
      <id>report</id>
      <phase>test</phase>
      <goals><goal>report</goal></goals>
    </execution>
  </executions>
</plugin>
```
Then add codecov upload step in `build.yml`.

### 3. Add Trivy Container Scanning (1-2 hours)
Add step to `build.yml` after image build:
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.IMAGE_NAME }}:${{ env.VERSION }}
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
- name: Upload Trivy scan results
  uses: github/codeql-action/upload-sarif@v2
  with:
    sarif_file: 'trivy-results.sarif'
```

### 4. Enable Dependabot (30 minutes)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "maven"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 5. Fix Pre-commit for Java (1-2 hours)
Replace `.pre-commit-config.yaml` with Java-relevant hooks:
```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-xml
  - repo: https://github.com/pre-commit/mirrors-prettier
    rev: v3.1.0
    hooks:
      - id: prettier
        types_or: [yaml, json, markdown]
```

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory (4 total):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build.yml` | PR to `release-*`, push to `main`/`release-*`/tags | Build + test + multi-arch image push |
| `codeql.yml` | Push/PR to `main`, daily schedule | CodeQL SAST scanning (Java, Python) |
| `create-release-tag.yml` | Manual dispatch | Release tagging with changelog |
| `trigger-pnc-build.yaml` | Push to `rhoai-*` branches, manual | PNC build for RHOAI productization |

**Tekton/Konflux Pipeline:**
- `odh-modelmesh-pull-request.yaml` — multi-arch build (x86_64, arm64)
- Triggered by `/build-konflux` comment or `kfbuild-all`/`kfbuild-modelmesh` labels
- Hermetic builds with RPM and generic artifact prefetch
- Centrally managed via `konflux-central` repository

**Issues:**
- No concurrency control on `build.yml` (wastes CI resources on rapid pushes)
- Build caching uses `type=gha` (good)
- Tests only run on release branch PRs — critical gap for main branch

### Test Coverage

**Test Statistics:**
- Source files: 64 Java files (39,262 LOC)
- Test files: 52 Java files (13,412 LOC)
- File ratio: 0.81 (good)
- LOC ratio: 0.34 (moderate)

**Testing Framework:** JUnit 5 (jupiter 5.10.2)

**Test Categories:**
| Category | Test Files | Description |
|----------|-----------|-------------|
| Core ModelMesh | 20+ | Model loading, eviction, failure, error propagation |
| Cluster Tests | 5 | Multi-instance cluster with TLS variants |
| Sidecar Tests | 4 | Sidecar model mesh with Zookeeper and UDS |
| Payload Processing | 4 | Remote, matching, composite, async processors |
| Metrics | 1 | Prometheus metrics validation |
| VModels | 2 | Virtual model routing |
| Legacy Proto | 2 | Backward compatibility |
| Examples | 3 | Example model runtime and client |

**Test Infrastructure:**
- Embedded Zookeeper via `curator-test` (TestingServer)
- Local etcd binary installed in CI
- gRPC in-process testing
- TLS certificate fixtures in `src/test/resources/certs/`
- Custom test protobuf definitions

**Missing:**
- No coverage measurement (JaCoCo not configured)
- No coverage enforcement or thresholds
- No mutation testing
- No property-based testing
- No test parallelization (explicitly disabled: `reuseForks=false, forkCount=1`)

### Code Quality

**Linting:**
- CodeQL SAST for Java and Python (daily + on PRs to main) — good
- `.pre-commit-config.yaml` present but misconfigured: runs `golangci-lint` v1.43.0 and `prettier` v2.4.1 — irrelevant for a Java project
- No Java-specific static analysis (Checkstyle, SpotBugs, PMD, Error Prone)
- No code formatting enforcement (google-java-format)

**Build Configuration:**
- Maven Surefire 3.0.0-M5 (somewhat outdated)
- Java 21 compilation target
- Protobuf compilation with `protobuf-maven-plugin`
- Custom JVM args for testing (netty, grpc, litelinks configs)

### Container Images

**Dockerfiles (3):**

| File | Purpose | Base Image |
|------|---------|------------|
| `Dockerfile` | Main multi-stage build + runtime | `ubi9/ubi-minimal` |
| `Dockerfile.konflux` | Konflux hermetic build | `ubi9-minimal` (pinned digest) + `ubi9/openjdk-21-runtime` (pinned) |
| `Dockerfile.develop` | Development environment | `ubi8/ubi-minimal:8.7` |

**Strengths:**
- Multi-stage builds (build → runtime separation)
- Multi-arch support: amd64, arm64, ppc64le, s390x
- UBI base images (Red Hat supported)
- Non-root user execution (USER 2000)
- Digest-pinned base images in Konflux Dockerfile
- Build caching with `--mount=type=cache`

**Weaknesses:**
- No container runtime validation (startup test, health check)
- No vulnerability scanning in build pipeline
- No SBOM generation (Syft, CycloneDX)
- No image signing/attestation (cosign)
- `Dockerfile.develop` uses outdated UBI8 with old Go 1.18.9 and OpenShift 4.9

### Security

**Present:**
- CodeQL SAST scanning (java-kotlin, python) with daily schedule
- TLS testing (cluster TLS, client auth)
- Non-root container execution
- License compliance (Apache 2.0)

**Missing:**
- No container image vulnerability scanning (Trivy, Snyk, Grype)
- No dependency scanning (Dependabot, Renovate, OWASP Dependency-Check)
- No secret detection (Gitleaks, TruffleHog)
- No SBOM generation
- No image signing/provenance attestation
- No security policy (`SECURITY.md`)

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: All test type rules missing; no patterns, examples, or quality gates for AI-assisted test creation
- **Recommendation**: Generate rules with `/test-rules-generator` covering:
  - JUnit 5 unit test patterns with embedded Zookeeper/etcd
  - gRPC integration test patterns
  - Cluster test patterns
  - Payload processor test patterns

## Recommendations

### Priority 0 (Critical)

1. **Add `main` to build.yml PR trigger** — Tests must run on all PRs, not just release branches. This is the single highest-impact change.

2. **Add JaCoCo coverage plugin + codecov integration** — Establish baseline coverage metrics. Set initial threshold at current coverage level, then incrementally increase.

3. **Add Trivy container scanning** — Scan built images for CVEs before push. Integrate SARIF output with GitHub Security tab.

### Priority 1 (High Value)

4. **Fix pre-commit hooks for Java** — Replace Go/JS hooks with trailing-whitespace, end-of-file-fixer, and YAML/XML checks. Consider adding `google-java-format` or `checkstyle`.

5. **Enable Dependabot** — Configure for Maven and GitHub Actions ecosystems. Critical for tracking vulnerabilities in gRPC, Netty, Jackson, Log4j2, BouncyCastle dependencies.

6. **Add image startup validation** — After building the container image in CI, run a basic health check to verify the JVM starts and the gRPC server binds.

7. **Create agent rules (.claude/rules/)** — Add test creation guidance for JUnit 5 patterns used in this project, including embedded Zookeeper setup, etcd configuration, gRPC stub creation.

### Priority 2 (Nice-to-Have)

8. **Add SBOM generation** — Integrate CycloneDX Maven plugin or Syft for supply chain transparency.

9. **Add Gitleaks secret detection** — Prevent accidental credential commits.

10. **Add concurrency control to build.yml** — Cancel in-progress runs on same branch to save CI resources.

11. **Add performance regression tests** — Model load/serve latency benchmarks to catch performance regressions.

12. **Upgrade Dockerfile.develop** — Update from UBI8/Go 1.18 to UBI9/current Go version.

## Comparison to Gold Standards

| Dimension | modelmesh | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | 6/10 | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 7/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 4/10 | 8/10 | 7/10 | 8/10 |
| Image Testing | 3/10 | 7/10 | 9/10 | 7/10 |
| Coverage Tracking | 1/10 | 8/10 | 5/10 | 8/10 |
| CI/CD Automation | 5/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 0/10 | 8/10 | 3/10 | 2/10 |

**Key Gaps vs. Gold Standards:**
- **vs. odh-dashboard**: Missing coverage enforcement, contract tests, comprehensive CI/CD, agent rules
- **vs. notebooks**: Missing image testing strategy, multi-arch validation, security scanning
- **vs. kserve**: Missing coverage enforcement, multi-version testing, operator testing patterns

## File Paths Reference

### CI/CD
- `.github/workflows/build.yml` — Main build and test workflow
- `.github/workflows/codeql.yml` — CodeQL SAST scanning
- `.github/workflows/create-release-tag.yml` — Release tagging
- `.github/workflows/trigger-pnc-build.yaml` — PNC productization build
- `.github/install-etcd.sh` — etcd installation for CI
- `.tekton/odh-modelmesh-pull-request.yaml` — Konflux PR pipeline

### Testing
- `src/test/java/com/ibm/watson/modelmesh/` — Main test directory (38 test files)
- `src/test/java/com/ibm/watson/modelmesh/payload/` — Payload processor tests (4 files)
- `src/test/java/com/ibm/watson/modelmesh/example/` — Example model runtime/client (3 files)
- `src/test/java/com/ibm/watson/modelmesh/util/` — Test utilities
- `src/test/proto/` — Test protobuf definitions
- `src/test/resources/certs/` — TLS test certificates

### Build
- `pom.xml` — Maven build configuration
- `Dockerfile` — Main multi-stage build
- `Dockerfile.konflux` — Hermetic Konflux build
- `Dockerfile.develop` — Development environment
- `.dockerignore` — Docker build context exclusions

### Configuration
- `.pre-commit-config.yaml` — Pre-commit hooks (misconfigured for Go/JS)
- `rpms.in.yaml` / `rpms.lock.yaml` — RPM dependency specifications
- `artifacts.lock.yaml` — PNC build artifact lock file
- `config/base/` — Kubernetes deployment manifests
- `config/examples/` — Example configurations

### Governance
- `OWNERS` — Approvers and reviewers list
- `MAINTAINERS.md` — Project maintainers
- `CONTRIBUTING.md` — Contribution guidelines
