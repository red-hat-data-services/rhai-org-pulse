---
repository: "red-hat-data-services/noobaa-core"
overall_score: 4.3
scorecard:
  - dimension: "Unit Tests"
    score: 6.0
    status: "63 unit test files using Mocha framework; good breadth across core modules but no coverage enforcement"
  - dimension: "Integration/E2E"
    score: 5.0
    status: "System, pipeline, and QA tests run on Minikube with Kubernetes job runner; no E2E on PRs without manual trigger"
  - dimension: "Build Integration"
    score: 3.0
    status: "No PR-time image validation, no Konflux simulation, multi-stage Docker builds but no startup testing"
  - dimension: "Image Testing"
    score: 3.0
    status: "7 Dockerfiles with multi-stage builds but no runtime validation, no vulnerability scanning, no SBOM"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "nyc/istanbul configured locally but no Codecov integration, no coverage gates, no PR reporting"
  - dimension: "CI/CD Automation"
    score: 4.0
    status: "7 GitHub Actions workflows (3 PR-triggered, 2 scheduled, 1 manual); no caching, no concurrency control, uses deprecated actions"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules or test automation guidance"
critical_gaps:
  - title: "No coverage enforcement or reporting"
    impact: "Coverage can silently regress with every PR; no visibility into test gaps"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container vulnerability scanning"
    impact: "Security vulnerabilities in base images and dependencies go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No PR-time build integration testing"
    impact: "Docker image build failures and runtime issues discovered only post-merge"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "Deprecated GitHub Actions (actions/checkout@v2)"
    impact: "Security risks from unmaintained action versions; Node.js 12 deprecation warnings"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No concurrency control on PR workflows"
    impact: "Redundant CI runs on rapid pushes waste resources and delay feedback"
    severity: "MEDIUM"
    effort: "1 hour"
  - title: "No pre-commit hooks or automated formatting"
    impact: "Inconsistent code style; lint errors caught only in CI instead of locally"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Upgrade all GitHub Actions to latest versions (checkout@v4, etc.)"
    effort: "1-2 hours"
    impact: "Eliminate deprecation warnings; use Node.js 20 runtime; improved security"
  - title: "Add concurrency control to PR workflows"
    effort: "30 minutes"
    impact: "Cancel stale runs on new pushes; faster feedback; reduced CI costs"
  - title: "Add Codecov integration with coverage thresholds"
    effort: "3-4 hours"
    impact: "PR-level coverage reporting; prevent coverage regressions"
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Early detection of CVEs in base images and dependencies"
  - title: "Add workflow caching for npm dependencies"
    effort: "1-2 hours"
    impact: "Significantly faster CI runs (npm install cached across runs)"
recommendations:
  priority_0:
    - "Add Codecov integration with minimum coverage thresholds and PR status checks"
    - "Upgrade all GitHub Actions to v4 (checkout, setup-node) to fix Node.js 12 deprecation"
    - "Add Trivy or Snyk container scanning to PR workflows for vulnerability detection"
    - "Add concurrency control to all PR-triggered workflows"
  priority_1:
    - "Add PR-time Docker image build validation with startup testing"
    - "Implement pre-commit hooks for linting and formatting"
    - "Add CodeQL or similar SAST scanning as a PR check"
    - "Add npm dependency caching to all CI workflows"
    - "Create comprehensive agent rules for test automation (.claude/rules/)"
  priority_2:
    - "Add multi-architecture build support (ARM64)"
    - "Implement SBOM generation for container images"
    - "Add performance regression testing for S3 operations"
    - "Migrate from TSLint (deprecated) to ESLint for TypeScript"
    - "Add contract tests between noobaa-core and noobaa-operator API boundaries"
---

# Quality Analysis: red-hat-data-services/noobaa-core

## Executive Summary
- Overall Score: 4.3/10
- Key Strengths: Solid unit test breadth with 63 test files covering core modules; multi-layer test organization (unit, system, pipeline, QA); Kubernetes-based integration test framework with Minikube; multi-stage Docker builds with dedicated builder/base/tester images
- Critical Gaps: No coverage enforcement or reporting; no container vulnerability scanning; deprecated GitHub Actions versions; no concurrency control; no agent rules; no pre-commit hooks; no SAST/security scanning
- Agent Rules Status: Missing

## Quality Scorecard
| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6.0/10 | 63 unit test files using Mocha framework; good breadth across core modules but no coverage enforcement |
| Integration/E2E | 5.0/10 | System, pipeline, and QA tests run on Minikube with Kubernetes job runner; not all run on PRs |
| **Build Integration** | **3.0/10** | **No PR-time image validation, no Konflux simulation, multi-stage Docker builds but no startup testing** |
| Image Testing | 3.0/10 | 7 Dockerfiles with multi-stage builds but no runtime validation, no vulnerability scanning, no SBOM |
| Coverage Tracking | 2.0/10 | nyc/istanbul configured locally but no Codecov integration, no coverage gates, no PR reporting |
| CI/CD Automation | 4.0/10 | 7 GitHub Actions workflows; no caching, no concurrency control, uses deprecated actions |
| Agent Rules | 0.0/10 | No CLAUDE.md, no .claude/ directory, no agent rules or test automation guidance |

## Critical Gaps

1. **No coverage enforcement or reporting**
   - Impact: Coverage can silently regress with every PR; no visibility into which modules lack tests
   - Severity: HIGH
   - Effort: 4-6 hours
   - Details: While `nyc` is configured in `package.json` (`mocha:coverage` script), there is no Codecov/Coveralls integration, no coverage thresholds, and no PR-level coverage reporting. The `mocha:coverage` script is never called in any CI workflow.

2. **No container vulnerability scanning**
   - Impact: Security vulnerabilities in CentOS 8 base images (EOL) and npm dependencies go undetected
   - Severity: HIGH
   - Effort: 2-4 hours
   - Details: No Trivy, Snyk, or any scanner is configured. The builder Dockerfile uses `centos:8` which is end-of-life. No `.trivyignore`, no `.snyk` file, no security scanning workflow.

3. **No PR-time build integration testing**
   - Impact: Docker image build failures and runtime issues discovered only after merge
   - Severity: HIGH
   - Effort: 8-12 hours
   - Details: The `sanity.yaml` workflow builds and deploys to Minikube but has no image startup validation, health checks, or structured integration testing. The full build workflow (`manual-full-build.yaml`) is manual dispatch only.

4. **Deprecated GitHub Actions versions**
   - Impact: Security risks from unmaintained action versions; Node.js 12 deprecation warnings in CI logs
   - Severity: HIGH
   - Effort: 1-2 hours
   - Details: All workflows use `actions/checkout@v2` which runs on Node.js 12 (deprecated). Current version is v4 using Node.js 20. This is a trivial fix across all 7 workflow files.

5. **No concurrency control on PR workflows**
   - Impact: Redundant CI runs on rapid pushes waste resources and delay developer feedback
   - Severity: MEDIUM
   - Effort: 1 hour
   - Details: The 4 PR-triggered workflows (unit, postgres-unit, sanity, frontend-unit) lack `concurrency` configuration. Rapid pushes to a PR trigger multiple parallel runs of the full test suite.

6. **No pre-commit hooks or automated formatting**
   - Impact: Inconsistent code style; lint errors caught only in CI instead of locally
   - Severity: MEDIUM
   - Effort: 2-3 hours
   - Details: No `.pre-commit-config.yaml` file. While `.eslintrc.js` is comprehensive (extends `eslint:all`), it only runs in CI. No Prettier or automatic formatting configuration.

## Quick Wins

1. **Upgrade all GitHub Actions to latest versions**
   - Effort: 1-2 hours
   - Impact: Eliminate deprecation warnings; use Node.js 20 runtime; improved security
   - Implementation: Change `actions/checkout@v2` to `actions/checkout@v4` in all 7 workflow files

2. **Add concurrency control to PR workflows**
   - Effort: 30 minutes
   - Impact: Cancel stale runs on new pushes; faster feedback; reduced CI costs
   - Implementation:
   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
     cancel-in-progress: true
   ```

3. **Add Codecov integration with coverage thresholds**
   - Effort: 3-4 hours
   - Impact: PR-level coverage reporting; prevent coverage regressions
   - Implementation: Add `codecov/codecov-action@v4` step after `npm run mocha:coverage`; create `.codecov.yml` with project and patch thresholds

4. **Add Trivy container scanning to PR workflow**
   - Effort: 1-2 hours
   - Impact: Early detection of CVEs in base images and dependencies
   - Implementation:
   ```yaml
   - name: Run Trivy vulnerability scanner
     uses: aquasecurity/trivy-action@master
     with:
       image-ref: 'noobaa:latest'
       format: 'sarif'
       output: 'trivy-results.sarif'
   ```

5. **Add workflow caching for npm dependencies**
   - Effort: 1-2 hours
   - Impact: Significantly faster CI runs (npm install cached across runs)
   - Implementation: Add `actions/cache@v4` step for `~/.npm` directory before npm install

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (7 total):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `unit.yaml` | push, pull_request | Runs unit tests via `make test` (builds Docker image, runs mocha) |
| `postgres-unit-tests.yaml` | push, pull_request | Runs unit tests with PostgreSQL backend |
| `sanity.yaml` | push, pull_request | Deploys Minikube, builds tester image, runs pipeline sanity tests |
| `frontend-unit.yml` | push, pull_request | Runs frontend tests via `make fe-test` and verifies FE library build |
| `manual-full-build.yaml` | workflow_dispatch | Full build and publish to DockerHub (manual only) |
| `weekly-build.yaml` | cron (daily at 23:00 UTC) | Triggers manual build on master branch |
| `next-ver-build.yaml` | cron (Monday 12:00 UTC) | Triggers build of next version (5.8 branch) |

**Issues Found:**
- All workflows use deprecated `actions/checkout@v2`
- No `concurrency` configuration on any workflow
- No npm caching strategy
- No artifact upload for test results or logs
- `weekly-build.yaml` name is misleading (runs daily, not weekly)
- `set-output` command usage is deprecated (should use `$GITHUB_OUTPUT`)
- No status badges or notifications

**Multi-CI Configuration:**
- GitHub Actions (primary for PRs)
- Travis CI (`.travis.yml` - legacy, appears active for integration tests)
- Jenkins (`.jenkins/` directory - legacy CI system with JJB configs)
- Having 3 CI systems creates maintenance burden and confusion

### Test Coverage

**Unit Tests (Score: 6.0/10):**
- 63 test files in `src/test/unit_tests/`
- Uses Mocha framework with custom `coretest` setup
- Good coverage of core modules: S3 operations, namespace, chunking, encryption, RPC, semaphores, LRU cache
- Some tests commented out in `index.js` (test_mapper, test_map_client, test_md_aggregator_unit)
- Test-to-code ratio: 139 test files / 467 source files = 0.30 (30%)
- Dedicated sudo tests (`sudo_index.js`) for privileged operations
- PostgreSQL-specific tests (migration, client, upgrade)

**System/Integration Tests (Score: 5.0/10):**
- 12 system test files covering: Ceph S3 compatibility, blob API, bucket operations, cloud pools
- Kubernetes-based test framework with configurable CPU/memory per test
- Pipeline tests: account, namespace, quota, dataset (with various configurations)
- QA tests: capacity, data availability, resiliency, load testing
- Test framework includes test job runner (`run_test_job.sh`) for Kubernetes
- Integration tests require Minikube/Kubernetes cluster

**Frontend Tests:**
- Minimal frontend test infrastructure (2 test files in `frontend/src/tests/`)
- Frontend is a legacy codebase using Bower, Gulp, and custom build tools
- No modern testing framework (no Jest, no Cypress)

**Native Code Tests:**
- Single C++ test file (`src/native/test/os_test.cpp`)
- Minimal coverage of native bindings

### Code Quality

**Linting (ESLint):**
- Comprehensive `.eslintrc.js` extending `eslint:all` with selective overrides
- Copyright header enforcement via `eslint-plugin-header`
- Complexity threshold set to 35 (high; recommended is 10-15)
- Max depth of 5 (acceptable)
- ESLint runs as part of `npm test` (lint + mocha)

**TypeScript:**
- `tsconfig.json` configured with `checkJs: true` for gradual adoption
- `tslint.json` present but TSLint is **deprecated** (should migrate to ESLint)
- TypeScript checking is non-blocking (`noEmit: true`)

**Code Formatting:**
- `.jsbeautifyrc` for JS Beautify (basic formatter)
- `.clang-format` for C++ native code
- No Prettier configuration
- No automated formatting in CI

**Pre-commit Hooks:**
- None configured
- No `.pre-commit-config.yaml`
- No Husky or lint-staged

### Container Images

**Dockerfiles (7 total):**
| File | Purpose |
|------|---------|
| `builder.Dockerfile` | Build environment with Node.js, nasm, dev tools on CentOS 8 |
| `Base.Dockerfile` | npm install, native build, frontend build |
| `NooBaa.Dockerfile` | Production image with tarball packaging |
| `Tests.Dockerfile` | Test runner with MongoDB, Ceph S3 test suite |
| `dev.Dockerfile` | Developer tools image |
| `FrontendLib.Dockerfile` | Frontend library build verification |
| `Attributes.Dockerfile` | (Specialized build) |

**Issues:**
- Base image is `centos:8` which is **end-of-life** (June 2024)
- No multi-architecture support (x86_64 only)
- No SBOM generation
- No image signing or attestation
- No vulnerability scanning
- No runtime validation (health checks, startup testing)
- No `.dockerignore` optimization (minimal exclusions)

### Security

**Current State:**
- No SAST/CodeQL scanning
- No container vulnerability scanning (Trivy, Snyk)
- No dependency scanning (Dependabot, Renovate)
- No secret detection (Gitleaks, TruffleHog)
- No `.gitleaks.toml` configuration
- Base image (CentOS 8) is EOL with no security patches
- Secrets management via GitHub Secrets (DockerHub credentials)

**Risk Assessment:**
- HIGH: EOL base image receiving no security patches
- HIGH: No automated vulnerability scanning
- MEDIUM: No dependency update automation
- MEDIUM: No secret detection in commits

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None - no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: Complete absence of agent rules means AI-assisted development has no guardrails:
  - No test creation patterns or standards
  - No architectural constraints for AI code generation
  - No linting or quality expectations documented
  - No framework-specific guidance (Mocha, ESLint patterns)
- **Recommendation**: Generate comprehensive rules with `/test-rules-generator` covering:
  - Unit test patterns (Mocha + coretest setup)
  - S3/namespace test patterns
  - System test patterns (Kubernetes deployment)
  - ESLint compliance expectations

## Recommendations

### Priority 0 (Critical)

- **Add Codecov integration with minimum coverage thresholds and PR status checks** — The `mocha:coverage` script exists but is never used in CI. Wire it into the `unit.yaml` workflow and add Codecov for PR-level reporting.
- **Upgrade all GitHub Actions to v4** — All 7 workflows use `actions/checkout@v2` (Node.js 12 deprecated). This is a trivial 1-2 hour fix that eliminates security risks.
- **Add Trivy or Snyk container scanning** — Zero container security scanning exists. Add as a step in the sanity workflow after image build.
- **Add concurrency control to all PR-triggered workflows** — 4 workflows trigger on push+PR without cancellation of stale runs.
- **Migrate base image from CentOS 8 (EOL) to a supported distribution** — CentOS 8 reached end-of-life in June 2024. Consider UBI 9 or Rocky Linux 9.

### Priority 1 (High Value)

- **Add PR-time Docker image build validation with startup testing** — Verify the built image can start and respond to basic health checks before merge.
- **Implement pre-commit hooks** — Add Husky + lint-staged for ESLint enforcement before commit. Currently lint errors are only caught in CI.
- **Add CodeQL SAST scanning** — No static analysis security testing exists. GitHub's free CodeQL works well for JavaScript/TypeScript.
- **Add npm dependency caching** — All workflows do full npm install from scratch. Adding `actions/cache@v4` would significantly reduce build times.
- **Create comprehensive agent rules** — Generate `.claude/rules/` with patterns for Mocha unit tests, S3 namespace tests, and system tests.
- **Consolidate CI systems** — Three CI platforms (GitHub Actions, Travis CI, Jenkins) create confusion. Consider migrating all to GitHub Actions.

### Priority 2 (Nice-to-Have)

- **Add multi-architecture build support (ARM64)** — Currently x86_64 only; ARM64 support would enable broader deployment.
- **Implement SBOM generation** — Use Syft or similar tool to generate SBOMs for container images.
- **Add performance regression testing** — Benchmark S3 operations and track regressions.
- **Migrate from TSLint to ESLint** — TSLint is deprecated and no longer maintained. ESLint with `@typescript-eslint` is the successor.
- **Add contract tests between noobaa-core and noobaa-operator** — The `manual-full-build.yaml` workflow triggers operator builds; add contract validation.
- **Add Dependabot or Renovate** — Automate dependency updates and security patches for npm packages.

## Comparison to Gold Standards

| Dimension | noobaa-core | odh-dashboard (Gold) | notebooks (Gold) | Gap |
|-----------|-------------|---------------------|-------------------|-----|
| Unit Test Framework | Mocha (good) | Jest + RTL (excellent) | pytest (excellent) | Framework is adequate |
| Coverage Enforcement | None | Codecov with thresholds | Coverage gates | Critical gap |
| Integration Testing | Minikube-based | Cypress E2E + contract tests | Image validation pipeline | Good framework, weak automation |
| Container Scanning | None | Trivy + Snyk | 5-layer validation | Critical gap |
| CI/CD Maturity | Basic (deprecated actions) | Advanced (matrix, caching, concurrency) | Advanced (multi-arch, SBOM) | Significant gap |
| Pre-commit Hooks | None | Husky + lint-staged | Pre-commit framework | Missing |
| Agent Rules | None | Comprehensive .claude/rules/ | N/A | Complete gap |
| Security Scanning | None | CodeQL + Gitleaks | Trivy + signing | Critical gap |
| Multi-arch Support | None | N/A | Full (x86_64 + ARM64) | Missing |
| Dependency Management | Manual | Dependabot + Renovate | Dependabot | Missing |

## File Paths Reference

### CI/CD
- `.github/workflows/unit.yaml` — Unit test workflow
- `.github/workflows/postgres-unit-tests.yaml` — PostgreSQL unit tests
- `.github/workflows/sanity.yaml` — Build & sanity integration tests
- `.github/workflows/frontend-unit.yml` — Frontend unit tests
- `.github/workflows/manual-full-build.yaml` — Manual build dispatch
- `.github/workflows/weekly-build.yaml` — Scheduled daily build
- `.github/workflows/next-ver-build.yaml` — Next version weekly build
- `.travis.yml` — Travis CI configuration (legacy)
- `.jenkins/` — Jenkins CI configuration (legacy)
- `Makefile` — Build targets (builder, base, tester, noobaa, test, fe-test)

### Testing
- `src/test/unit_tests/` — 63 unit test files (Mocha)
- `src/test/unit_tests/index.js` — Unit test index/runner
- `src/test/unit_tests/coretest.js` — Test setup/bootstrap
- `src/test/system_tests/` — 12 system/integration test files
- `src/test/pipeline/` — 11 pipeline test files
- `src/test/qa/` — 9 QA test files
- `src/test/framework/` — Test framework (job runner, test lists)
- `src/test/framework/run_test_job.sh` — Kubernetes test job runner
- `frontend/src/tests/` — Frontend test files (minimal)
- `src/native/test/` — Native C++ tests (1 file)

### Code Quality
- `.eslintrc.js` — ESLint configuration (extends eslint:all)
- `.eslintignore` — ESLint ignore patterns
- `tsconfig.json` — TypeScript configuration (checkJs enabled)
- `tslint.json` — TSLint configuration (deprecated)
- `.jsbeautifyrc` — JS Beautify configuration
- `.clang-format` — C++ code formatting

### Container Images
- `src/deploy/NVA_build/builder.Dockerfile` — Build environment (CentOS 8)
- `src/deploy/NVA_build/Base.Dockerfile` — Base application image
- `src/deploy/NVA_build/NooBaa.Dockerfile` — Production image
- `src/deploy/NVA_build/Tests.Dockerfile` — Test runner image
- `src/deploy/NVA_build/dev.Dockerfile` — Developer image
- `src/deploy/NVA_build/FrontendLib.Dockerfile` — Frontend library build
- `.dockerignore` — Docker ignore patterns

### Package Configuration
- `package.json` — npm configuration (scripts, dependencies)
- `package-lock.json` — Dependency lock file
- `.nvmrc` — Node.js version specification
- `.npmrc` — npm registry configuration
