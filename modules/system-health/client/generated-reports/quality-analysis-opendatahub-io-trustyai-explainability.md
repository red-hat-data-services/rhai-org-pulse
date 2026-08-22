---
repository: "opendatahub-io/trustyai-explainability"
overall_score: 5.3
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Strong test suite with 202 test files across JUnit 5 + Quarkus, but no coverage tracking"
  - dimension: "Integration/E2E"
    score: 6.0
    status: "Dedicated integration test module and external E2E test framework, but E2E not automated in CI"
  - dimension: "Build Integration"
    score: 3.0
    status: "CI builds skip tests; no Docker image build or Konflux simulation on PRs"
  - dimension: "Image Testing"
    score: 3.0
    status: "Multi-stage UBI-based Dockerfile but no runtime validation or multi-arch support"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No JaCoCo, no Codecov, no coverage thresholds or PR reporting"
  - dimension: "CI/CD Automation"
    score: 6.0
    status: "Matrix testing across Maven versions with concurrency control, but no caching or parallelization"
  - dimension: "Static Analysis"
    score: 4.0
    status: "Code formatter enforced, but no linter, no Dependabot, no pre-commit hooks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory present"
critical_gaps:
  - title: "No code coverage tracking"
    impact: "Test regressions and untested code paths go undetected; no visibility into coverage trends"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No PR-time Docker image build or Konflux simulation"
    impact: "Build failures discovered only post-merge in downstream pipelines"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No dependency alert configuration (Dependabot/Renovate)"
    impact: "Vulnerable or outdated dependencies remain undetected until manual review"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "E2E tests not automated in repository CI"
    impact: "Cluster-level regressions only caught during manual test runs"
    severity: "MEDIUM"
    effort: "8-16 hours"
  - title: "No static analysis beyond code formatting"
    impact: "Bug patterns, code smells, and anti-patterns go undetected"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add JaCoCo coverage plugin and Codecov integration"
    effort: "4-6 hours"
    impact: "Immediate visibility into test coverage with PR-level enforcement"
  - title: "Enable Dependabot for Maven dependency alerts"
    effort: "1-2 hours"
    impact: "Automated security and dependency updates with PR generation"
  - title: "Add Maven dependency caching to CI workflows"
    effort: "1-2 hours"
    impact: "Significant CI build time reduction across all matrix configurations"
  - title: "Create basic CLAUDE.md with test and contribution patterns"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality and contribution consistency"
recommendations:
  priority_0:
    - "Add JaCoCo coverage plugin to pom.xml and integrate with Codecov for PR-level coverage reporting"
    - "Add Dependabot configuration for Maven ecosystem to catch vulnerable dependencies"
    - "Add PR-time Docker image build step to validate containerization before merge"
  priority_1:
    - "Integrate E2E test automation into CI (at least smoke-level tests on PRs)"
    - "Add SpotBugs or Error Prone static analysis to the Maven build"
    - "Add pre-commit hooks for formatting validation before push"
    - "Create agent rules (.claude/rules/) for test patterns and contribution guidelines"
  priority_2:
    - "Add multi-architecture image builds (ARM64 support)"
    - "Add performance regression benchmarks for explainability algorithms"
    - "Add container health check validation in CI"
---

# Quality Analysis: trustyai-explainability

**Repository**: [opendatahub-io/trustyai-explainability](https://github.com/opendatahub-io/trustyai-explainability)
**Jira Project**: RHOAIENG | **Component**: AI Safety | **Tier**: midstream
**Analysis Date**: 2026-07-20

## Executive Summary

- **Overall Score**: 5.3/10
- **Repository Type**: Java library + Quarkus microservice (multi-module Maven)
- **Primary Language**: Java 17
- **Frameworks**: JUnit 5, Quarkus 3.8.5, Mockito, AssertJ, Awaitility

**Key Strengths**:
- Solid unit test suite with 202 test files covering core algorithms, service endpoints, and integration scenarios
- Matrix testing across 3 Maven versions (3.6.3, 3.8.8, 3.9.2) for broad compatibility
- Concurrency control preventing redundant CI runs
- Multi-stage UBI-based Dockerfile for production-ready container images
- Dedicated integration test module for DMN, PMML, and OpenNLP
- Code formatting enforced via formatter-maven-plugin + impsort-maven-plugin
- Kubernetes manifests with readiness/liveness probes defined
- Uses `SecureRandom` properly (no weak crypto patterns detected)

**Critical Gaps**:
- Zero code coverage tracking (no JaCoCo, no Codecov, no thresholds)
- No PR-time Docker image build or Konflux build simulation
- No Dependabot or Renovate for dependency management
- E2E tests exist externally (trustyai-tests) but are not automated in this repo's CI
- No static analysis beyond code formatting
- No agent rules for AI-assisted development

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 7.0/10 | Strong test suite with JUnit 5 + Quarkus, good test-to-code ratio |
| Integration/E2E | 20% | 6.0/10 | Dedicated integration module + external E2E framework, not automated in CI |
| Build Integration | 15% | 3.0/10 | CI builds skip tests; no image build or Konflux simulation on PRs |
| Image Testing | 10% | 3.0/10 | Multi-stage UBI Dockerfile, no runtime validation or multi-arch |
| Coverage Tracking | 10% | 1.0/10 | No coverage tooling configured anywhere |
| CI/CD Automation | 15% | 6.0/10 | Matrix testing with concurrency, but no caching or test parallelization |
| Static Analysis | 10% | 4.0/10 | Formatter enforced; no linter, no dependency alerts, no pre-commit hooks |
| Agent Rules | 5% | 0.0/10 | No agent rules present |

**Weighted Score**: (7.0×0.15) + (6.0×0.20) + (3.0×0.15) + (3.0×0.10) + (1.0×0.10) + (6.0×0.15) + (4.0×0.10) + (0.0×0.05) = **5.3/10**

## Critical Gaps

### 1. No Code Coverage Tracking (HIGH)
- **Impact**: Test regressions and untested code paths go completely undetected; no visibility into coverage trends over time
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No JaCoCo plugin in any `pom.xml`, no `.codecov.yml`, no coverage thresholds, no PR coverage comments. With 202 test files and 449 source files, there is no way to know actual coverage levels or enforce minimums.

### 2. No PR-time Docker Image Build (HIGH)
- **Impact**: Build failures in the multi-stage Dockerfile are discovered only after merge in Konflux/downstream pipelines
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The CI workflow (`CI.yaml`) runs `mvn package -Dmaven.test.skip=true -Dformatter.skip=true` but never builds the Docker image. Containerization issues (missing files, dependency resolution, Quarkus packaging) are invisible at PR time.

### 3. No Dependency Alert Configuration (HIGH)
- **Impact**: Vulnerable or outdated dependencies (e.g., Netty, Jackson, Quarkus) remain undetected until manual review
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: No `.github/dependabot.yml` or `renovate.json` configured. The project manually pins many Netty modules (4.1.125.Final) which suggests past vulnerability remediation — but without automated alerts, the next vulnerability will also require manual discovery.

### 4. E2E Tests Not Automated in CI (MEDIUM)
- **Impact**: Cluster-level regressions only caught during manual test execution
- **Severity**: MEDIUM
- **Effort**: 8-16 hours
- **Details**: The `tests/` directory contains a robust E2E framework (Makefile + Dockerfile + installandtest.sh) that deploys to OpenShift and runs `trustyai-tests` via pytest. However, this is not triggered by any GitHub Actions workflow — it requires manual execution or external CI (e.g., Prow).

### 5. No Static Analysis Beyond Formatting (MEDIUM)
- **Impact**: Bug patterns, null pointer risks, code smells, and anti-patterns go undetected
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: The formatter-maven-plugin and impsort-maven-plugin enforce code style, but no SpotBugs, Error Prone, PMD, or Checkstyle is configured. For a library providing AI explainability algorithms, static analysis of mathematical code is particularly valuable.

## Quick Wins

### 1. Add JaCoCo Coverage Plugin + Codecov Integration (4-6 hours)
Add JaCoCo to the parent `pom.xml`:
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
Add Codecov step to `test.yaml`:
```yaml
- name: Upload Coverage
  uses: codecov/codecov-action@v4
  with:
    files: '**/target/site/jacoco/jacoco.xml'
    fail_ci_if_error: false
```

### 2. Enable Dependabot for Maven (1-2 hours)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "maven"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 3. Add Maven Dependency Caching to CI (1-2 hours)
The `s4u/setup-maven-action` already includes caching, but verify it's working. Alternatively, add explicit caching:
```yaml
- name: Cache Maven dependencies
  uses: actions/cache@v4
  with:
    path: ~/.m2/repository
    key: ${{ runner.os }}-maven-${{ hashFiles('**/pom.xml') }}
    restore-keys: |
      ${{ runner.os }}-maven-
```

### 4. Create Basic CLAUDE.md (2-3 hours)
Add agent rules documenting:
- Test patterns (JUnit 5 + @QuarkusTest for service tests)
- Module structure (core, service, connectors, arrow)
- Build profiles (default, service-minimal, integration-tests)
- Formatting requirements (formatter-maven-plugin)

## Detailed Findings

### Unit Tests

**Score: 7.0/10**

| Metric | Value |
|--------|-------|
| Test files | 202 |
| Source files | 449 |
| Test-to-code ratio | 0.45 |
| Framework | JUnit 5 (5.9.1) |
| Assertion library | AssertJ 3.22.0 |
| Mocking | Mockito 4.8.0 |
| Async testing | Awaitility 4.2.0 |

**By Module:**
| Module | Test Files | Source Files | Ratio |
|--------|-----------|-------------|-------|
| explainability-core | 90 | 201 | 0.45 |
| explainability-service | 83 | 194 | 0.43 |
| explainability-connectors | 8 | 51 | 0.16 |
| explainability-arrow | 1 | 3 | 0.33 |
| explainability-integrationtests | 18 | N/A | N/A |

**Strengths:**
- Extensive `@QuarkusTest` annotations for service-level tests (~50+ Quarkus test classes)
- Tests cover multiple storage backends (PVC, Hibernate, Memory) via test profiles
- Tests for fairness metrics (SPD, DIR), drift detection (KS test, MMD), and explainers (LIME, SHAP, counterfactual)
- Surefire report generation with `action-surefire-report` for PR-level test visibility
- Test artifacts uploaded for debugging

**Gaps:**
- `explainability-connectors` has low test coverage (8 test files for 51 source files)
- No test parallelization configured (Surefire `parallel` property not set)
- No `@Tag` annotations visible for test categorization

### Integration/E2E Tests

**Score: 6.0/10**

**Integration Tests (In-repo):**
- Dedicated `explainability-integrationtests` module with 3 sub-modules:
  - `explainability-integrationtests-dmn` — Decision Model integration tests
  - `explainability-integrationtests-opennlp` — NLP integration tests
  - `explainability-integrationtests-pmml` — Predictive model integration tests
- These are activated via the `-P integration-tests` Maven profile
- Not run in CI by default (the module is excluded from the default build)

**E2E Tests (External):**
- Full E2E test infrastructure in `tests/` directory
- Uses `trustyai-tests` external repository (Python/pytest)
- Tests run against OpenShift cluster with ODH deployment
- Covers operator installation, DSC creation, and TrustyAI service validation
- Test container built on UBI 8 with OC CLI, Poetry, and trustyai-tests
- Supports configurable pytest markers for test selection

**Gaps:**
- Integration tests are not run in any CI workflow
- E2E tests require manual execution and external cluster
- No Kind/Minikube-based local E2E testing

### Build Integration

**Score: 3.0/10**

**CI Build Workflow (`CI.yaml`):**
- Runs `mvn package -Dmaven.test.skip=true` (builds but skips tests)
- Validates formatting with `formatter-maven-plugin:validate`
- Matrix: Ubuntu 22.04, Java 17, Maven 3.6.3/3.8.8/3.9.2
- Timeout: 30 minutes

**Missing:**
- No Docker image build on PRs
- No Konflux build simulation
- No Kustomize overlay validation
- No manifest generation testing
- No Quarkus native build validation
- CI.yaml only runs on `trustyai-explainability/trustyai-explainability` (upstream), not on `opendatahub-io` fork

### Image Testing

**Score: 3.0/10**

**Dockerfile Analysis:**
- Multi-stage build (build + runtime stages)
- UBI 8 base images (FIPS-capable): `ubi8/openjdk-17:latest` → `ubi8/openjdk-17-runtime:latest`
- Proper layer optimization (lib, jar, app, quarkus directories separated)
- Quarkus ODH profile used (`-Dquarkus.profile=odh`)
- Labels properly defined for Red Hat container registry

**Gaps:**
- No Docker image build in CI (never built on PRs)
- No container health check (`HEALTHCHECK` instruction) in Dockerfile
- No runtime validation (startup test, smoke test)
- No multi-architecture support (`--platform`, `buildx`)
- No Testcontainers usage for integration testing
- K8s manifests define probes, but Dockerfile itself lacks `HEALTHCHECK`

### Coverage Tracking

**Score: 1.0/10**

**Completely absent.** No coverage tooling is configured:
- No JaCoCo Maven plugin in any `pom.xml`
- No `.codecov.yml` or `codecov.yml`
- No `.coveragerc`
- No `--coverprofile` or `pytest-cov` usage
- No coverage thresholds or gates
- No PR coverage reporting
- Score is 1.0 rather than 0.0 because Surefire does produce test execution reports

### CI/CD Automation

**Score: 6.0/10**

**Workflow Inventory:**
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `CI.yaml` | push, pull_request | Build + format validation |
| `test.yaml` | push, pull_request | Unit test execution |
| `sync-branch-incubation.yaml` | push (main) | Sync main → incubation branch |
| `sync-branch-stable.yaml` | push (main) | Sync main → stable branch |
| `trivy-scan.yaml` | (not analyzed — out of scope) | Container scanning |

**Strengths:**
- Matrix strategy across 3 Maven versions for compatibility testing
- Concurrency control with `cancel-in-progress: true` preventing redundant builds
- Timeout limits (30/45 minutes) preventing runaway builds
- Surefire test report generation and artifact upload
- Branch sync automation (main → incubation → stable) via Mergify and GitHub Actions
- `fail-fast: false` for complete matrix results

**Gaps:**
- No Maven dependency caching visible in workflows (relying on `s4u/setup-maven-action` implicit caching)
- No test parallelization via Surefire forks
- No scheduled/periodic test runs
- No deployment or release automation
- CI.yaml gated on `trustyai-explainability/trustyai-explainability` — not running on `opendatahub-io` fork

### Static Analysis

**Score: 4.0/10**

**Present:**
- **Code Formatting**: `formatter-maven-plugin` (v2.13.0) with Eclipse format config enforced in CI
- **Import Sorting**: `impsort-maven-plugin` (v1.9.0) removing unused imports and sorting
- **Formatting validation**: CI runs `mvn net.revelc.code.formatter:formatter-maven-plugin:validate`

**FIPS Compatibility:**
- **Positive**: UBI 8 base images (FIPS-capable by default)
- **Positive**: Uses `java.security.SecureRandom` properly (no `java.util.Random` in security context)
- **Positive**: NSS/PKCS11 security provider configured in Dockerfile
- **No Issues**: No non-FIPS-compliant crypto imports detected

**Missing:**
- No SpotBugs, PMD, Error Prone, or Checkstyle plugins
- No `.github/dependabot.yml` or `renovate.json`
- No `.pre-commit-config.yaml`
- No FIPS build tags (not applicable for Java — handled at JVM/OS level)

### Agent Rules

**Score: 0.0/10**

**Completely absent:**
- No `CLAUDE.md` or `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` directory
- No test creation rules or patterns documented for AI agents

**Recommendation**: Generate rules with `/test-rules-generator` covering:
- JUnit 5 test patterns (annotations, assertions, lifecycle)
- `@QuarkusTest` usage for service-layer tests
- Test profile selection (PVC, Hibernate, Memory)
- Integration test patterns for DMN/PMML/OpenNLP
- Module-specific test conventions

## Recommendations

### Priority 0 (Critical)

1. **Add JaCoCo coverage plugin and Codecov integration** — Immediate visibility into test coverage with PR-level enforcement. Start with a 50% threshold and increase over time.

2. **Add Dependabot configuration** — Create `.github/dependabot.yml` for Maven and GitHub Actions ecosystems. The manual Netty version pinning suggests past vulnerability issues that automated alerts would catch earlier.

3. **Add PR-time Docker image build** — Add a CI workflow step that runs `docker build` on PRs to validate the multi-stage Dockerfile. This catches packaging issues before merge.

### Priority 1 (High Value)

4. **Add static analysis** — Integrate SpotBugs or Error Prone into the Maven build. For mathematical/ML code, these tools catch numeric precision issues, null pointer risks, and resource leaks.

5. **Automate integration tests in CI** — Run `explainability-integrationtests` in a CI job using the `integration-tests` Maven profile. These are already in-repo and don't require cluster access.

6. **Add pre-commit hooks** — Create `.pre-commit-config.yaml` with formatting validation to catch issues before push rather than at CI time.

7. **Create agent rules** — Add `CLAUDE.md` and `.claude/rules/` with patterns for test creation, module structure, and contribution guidelines.

### Priority 2 (Nice-to-Have)

8. **Add multi-architecture image builds** — Support `linux/arm64` alongside `linux/amd64` for broader deployment compatibility.

9. **Add performance regression tests** — The explainability algorithms have performance-sensitive paths; benchmark tests would catch regressions.

10. **Enable CI on the opendatahub-io fork** — Currently CI.yaml gates on `trustyai-explainability/trustyai-explainability`, meaning PRs to the opendatahub-io fork don't trigger CI.

## Comparison to Gold Standards

| Dimension | trustyai-explainability | odh-dashboard | notebooks | kserve |
|-----------|------------------------|---------------|-----------|--------|
| Unit Tests | 7.0 — JUnit 5 + Quarkus | 9.0 — Jest + RTL | 6.0 | 8.0 — Go testing |
| Integration/E2E | 6.0 — Module + external | 9.0 — Cypress E2E | 8.0 | 9.0 — envtest |
| Build Integration | 3.0 — No image build | 8.0 — Full build validation | 7.0 | 7.0 |
| Image Testing | 3.0 — No runtime validation | 7.0 | 9.0 — 5-layer | 6.0 |
| Coverage Tracking | 1.0 — None | 8.0 — Codecov | 5.0 | 8.0 — Codecov |
| CI/CD Automation | 6.0 — Matrix testing | 9.0 — Comprehensive | 8.0 | 9.0 |
| Static Analysis | 4.0 — Formatter only | 8.0 — ESLint + Dependabot | 6.0 | 7.0 |
| Agent Rules | 0.0 — None | 8.0 — Comprehensive | 3.0 | 2.0 |
| **Overall** | **5.3** | **8.5** | **7.0** | **7.5** |

## File Paths Reference

### CI/CD
- `.github/workflows/CI.yaml` — Build + formatting validation
- `.github/workflows/test.yaml` — Unit test execution
- `.github/workflows/sync-branch-incubation.yaml` — Branch sync
- `.github/workflows/sync-branch-stable.yaml` — Branch sync
- `.mergify.yaml` — Mergify backport rules

### Testing
- `explainability-core/src/test/` — 90 unit test files (algorithms, metrics)
- `explainability-service/src/test/` — 83 test files (50+ @QuarkusTest)
- `explainability-connectors/src/test/` — 8 connector test files
- `explainability-arrow/src/test/` — 1 Arrow converter test
- `explainability-integrationtests/` — 18 integration tests (DMN, PMML, OpenNLP)
- `tests/` — E2E test infrastructure (Makefile, Dockerfile, installandtest.sh)

### Build & Container
- `Dockerfile` — Multi-stage production image (UBI 8)
- `tests/Dockerfile` — E2E test container (UBI 8)
- `pom.xml` — Parent POM with module definitions
- `explainability-service/pom.xml` — Quarkus service POM

### Kubernetes Manifests
- `explainability-service/manifests/base/trustyai-deployment.yaml` — Deployment with probes

### Code Quality
- `config/eclipse-format.xml` — Eclipse formatter configuration
- `config/eclipse.importorder` — Import ordering rules

### Repository Governance
- `CODEOWNERS` — @trustyai-explainability/developers
- `OWNERS` — Approvers and reviewers list
- `.github/pull_request_template.md` — PR template
- `.github/pull.yml` — Upstream sync configuration
