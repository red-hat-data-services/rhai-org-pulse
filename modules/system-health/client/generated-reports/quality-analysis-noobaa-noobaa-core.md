---
repository: "noobaa/noobaa-core"
overall_score: 5.5
scorecard:
  - dimension: "Unit Tests"
    score: 6.0
    status: "Good test structure with Mocha+Jest but no coverage tracking"
  - dimension: "Integration/E2E"
    score: 7.0
    status: "Strong S3 compatibility testing (Ceph, Mint, Warp) with containerized infrastructure"
  - dimension: "Build Integration"
    score: 5.0
    status: "PR builds Docker images with smart caching but no Konflux simulation"
  - dimension: "Image Testing"
    score: 5.0
    status: "Multi-stage Docker builds with containerized tests but no vulnerability scanning"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage generation, thresholds, or PR reporting"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "39 workflows with PR gates, nightly runs, and concurrency control"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, .claude/ directory, or AI agent test guidance"
critical_gaps:
  - title: "No code coverage tracking or enforcement"
    impact: "Cannot measure test effectiveness; regressions go undetected as coverage silently drops"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No security scanning (SAST, dependency, container)"
    impact: "Vulnerabilities in code, dependencies, and container images not detected until production"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No dependency management automation (Dependabot/Renovate)"
    impact: "Known CVEs in npm dependencies persist indefinitely; manual updates missed"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "Go code has zero test coverage"
    impact: "TCP/HTTP speed utilities untested; regressions undetectable"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No pre-commit hooks or automated formatting"
    impact: "Style inconsistencies and common errors slip into PRs, increasing review burden"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add Dependabot for npm and Go dependency updates"
    effort: "1 hour"
    impact: "Automated CVE detection and dependency freshness for 200+ npm packages"
  - title: "Add Trivy container scanning to PR workflow"
    effort: "2 hours"
    impact: "Catch known vulnerabilities in base images and dependencies before merge"
  - title: "Enable Istanbul/nyc coverage generation in Mocha runs"
    effort: "2-3 hours"
    impact: "Visibility into actual test coverage; baseline for threshold enforcement"
  - title: "Add CodeQL SAST workflow"
    effort: "1-2 hours"
    impact: "Automated detection of injection, XSS, and logic bugs in JavaScript code"
  - title: "Create .claude/rules/ with test patterns"
    effort: "2-3 hours"
    impact: "AI-generated tests follow project conventions; consistent quality"
recommendations:
  priority_0:
    - "Add code coverage tracking with Istanbul/nyc and integrate with Codecov for PR reporting and threshold enforcement"
    - "Add container vulnerability scanning (Trivy) to the PR build workflow"
    - "Enable Dependabot or Renovate for automated dependency updates and CVE alerts"
  priority_1:
    - "Add CodeQL SAST workflow for JavaScript static analysis on PRs"
    - "Add secret detection with Gitleaks to prevent credential leaks"
    - "Write Go unit tests for tcp_speed and http_speed utilities"
    - "Unify test configuration with jest.config.js and .mocharc.yml"
  priority_2:
    - "Add pre-commit hooks with ESLint auto-fix and formatting checks"
    - "Remove legacy Travis CI configuration (.travis.yml)"
    - "Create comprehensive agent rules for AI-assisted test creation (.claude/rules/)"
    - "Add SBOM generation and image signing for release images"
    - "Lower ESLint complexity threshold from 35 to 15 incrementally"
---

# Quality Analysis: noobaa-core

## Executive Summary

- **Overall Score: 5.5/10**
- **Repository Type**: Object storage system (S3-compatible NooBaa core engine)
- **Primary Language**: JavaScript/Node.js (626 source files) with C++ native bindings (466 files) and minimal Go utilities
- **Testing Frameworks**: Mocha (primary), Jest (secondary)
- **Key Strengths**: Excellent S3 compatibility test suite (Ceph, Mint, Warp), well-organized test directory structure, smart Docker build caching in CI, multi-architecture builds
- **Critical Gaps**: Zero coverage tracking, no security scanning of any kind (SAST/container/dependency), no dependency automation
- **Agent Rules Status**: Missing - no CLAUDE.md, .claude/ directory, or AI agent guidance

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 6/10 | Good structure with Mocha+Jest but no coverage tracking |
| Integration/E2E | 7/10 | Strong S3 compatibility testing with containerized infrastructure |
| **Build Integration** | **5/10** | **PR builds Docker images but no Konflux simulation** |
| Image Testing | 5/10 | Multi-stage builds, containerized tests, no vulnerability scanning |
| Coverage Tracking | 1/10 | No coverage generation, thresholds, or PR reporting |
| CI/CD Automation | 7/10 | 39 workflows with PR gates, nightly runs, concurrency control |
| Agent Rules | 0/10 | No AI agent test guidance exists |

## Critical Gaps

### 1. No Code Coverage Tracking or Enforcement
- **Impact**: Cannot measure test effectiveness; coverage can silently degrade with each merge
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Despite having `clean:test` removing `./coverage`, no coverage generation is configured. No Istanbul/nyc, no Codecov/Coveralls integration, no PR coverage gates. With 626 source files and 222 test files (~35% ratio by count), actual line/branch coverage is unknown.

### 2. Zero Security Scanning
- **Impact**: Vulnerabilities in code, npm dependencies (200+), C++ native code, and Docker images go undetected until production incidents
- **Severity**: HIGH
- **Effort**: 4-8 hours total
- **Details**: No CodeQL/SAST, no Dependabot/Renovate, no Trivy/Snyk, no Gitleaks/TruffleHog. For an object storage system handling data, this is a critical gap.

### 3. No Dependency Management Automation
- **Impact**: Known CVEs in 200+ npm packages and Go modules persist indefinitely; manual tracking is unsustainable
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: No `.github/dependabot.yml` or Renovate config. `package-lock.json` is validated for integrity but not scanned for vulnerabilities.

### 4. Go Utility Code Has Zero Tests
- **Impact**: `tcp_speed` and `http_speed` utilities are untested; regressions and logic bugs go undetected
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: The `go/` directory contains `cmd/tcp_speed`, `cmd/http_speed`, and `internal/goutils` with zero `_test.go` files.

### 5. No Pre-Commit Hooks
- **Impact**: Style violations, linting errors, and common mistakes reach PRs, increasing review burden
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: No `.pre-commit-config.yaml`. ESLint runs only in CI, not at commit time. TSLint config still present despite being deprecated.

## Quick Wins

### 1. Add Dependabot Configuration (~1 hour)
- **Impact**: Automated CVE detection and dependency freshness
- **Implementation**:
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
  - package-ecosystem: "gomod"
    directory: "/go"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
```

### 2. Add Trivy Container Scanning (~2 hours)
- **Impact**: Catch known CVEs in base images and npm packages before merge
- **Implementation**: Add a step to the `build-noobaa-image` job in `run-pr-tests.yaml`:
```yaml
      - name: Scan image with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'noobaa'
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'
```

### 3. Enable Coverage Generation (~2-3 hours)
- **Impact**: Visibility into actual test coverage; baseline for enforcement
- **Implementation**: Add `nyc` to the Mocha test command in `package.json`:
```json
"mocha": "nyc --reporter=lcov --reporter=text node --allow-natives-syntax ./node_modules/.bin/_mocha src/test/utils/index/index.js"
```

### 4. Add CodeQL SAST (~1-2 hours)
- **Impact**: Automated detection of injection, prototype pollution, and logic bugs in JavaScript
- **Implementation**:
```yaml
# .github/workflows/codeql.yml
name: CodeQL
on: [pull_request]
jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v6
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript
      - uses: github/codeql-action/analyze@v3
```

### 5. Create Basic Agent Rules (~2-3 hours)
- **Impact**: AI-generated tests follow NooBaa conventions (Mocha patterns, S3 test utilities)
- **Implementation**: Create `.claude/rules/unit-tests.md` with patterns from existing test files

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (39 workflows):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `run-pr-tests.yaml` | PR, dispatch | Main gate: builds image, fans out to 10 test suites |
| `jest-unit-tests.yaml` | PR, dispatch | Jest unit tests (runs independently without Docker) |
| `Validate-package-lock.yaml` | PR | Validates package-lock.json integrity |
| `build-arm64-image.yaml` | PR | Cross-architecture arm64 build validation |
| `build-ppc64le-image.yaml` | PR | Cross-architecture ppc64le build validation |
| `test-aws-sdk-clients.yaml` | Nightly (cron) | AWS SDK compatibility testing |
| `nightly-tests.yaml` | Dispatch | Extended tests with cloud credentials |
| `ibm-nightly-*` | Dispatch/cron | IBM Cloud VM provisioning for full integration tests |
| `weekly-build.yaml` | Nightly cron | Nightly master build and publish |
| `releaser.yaml` | Dispatch | Release automation with multi-registry push |
| `rpm-build-*.yaml` | Various | RPM packaging and install testing |
| `stale.yml` | Daily cron | Issue/PR staleness management |

**Strengths:**
- PR pipeline builds a Docker image and runs 10 parallel test suites (sanity, unit, Ceph S3, Warp, Mint, NC variants)
- Smart base image caching: tries to pull recent images from quay.io before rebuilding
- Concurrency control with `cancel-in-progress: true` on PR workflows
- Artifact sharing between jobs (Docker image saved/uploaded/downloaded)
- Multi-architecture validation (arm64, ppc64le) on every PR
- IBM Cloud integration for nightly VM-based testing

**Gaps:**
- No build caching for npm dependencies (no `actions/cache` for `node_modules`)
- No test result upload/reporting (JUnit XML, test summary)
- Legacy Travis CI config (`.travis.yml`) still present alongside GitHub Actions
- 90-minute timeout across most workflows with no adaptive timeout
- No test matrix or parallelization within individual test suites

### Test Coverage

**Test Architecture:**
```
src/test/
├── unit_tests/          # Unit tests (Mocha + Jest)
│   ├── api/             # API unit tests (IAM, S3)
│   ├── db/              # Database schema tests
│   ├── internal/        # Core component tests
│   ├── native/          # Native binding tests
│   ├── nc/              # Non-containerized mode tests
│   ├── nsfs/            # NSFS namespace tests
│   ├── tls/             # TLS configuration tests
│   └── util_functions_tests/  # Utility function tests + AWS signature test suites
├── integration_tests/   # Integration tests (require services)
│   ├── api/             # S3, IAM, STS, Vectors API tests
│   ├── db/              # Database integration tests
│   ├── internal/        # Internal subsystem integration
│   ├── nc/              # NC mode CLI and lifecycle tests
│   └── nsfs/            # NSFS integration (concurrency, versioning)
├── external_tests/      # Third-party compatibility suites
│   ├── ceph_s3_tests/   # Ceph S3 compatibility
│   ├── warp/            # Warp S3 benchmarks
│   ├── mint/            # MinIO Mint S3 tests
│   ├── hadoop_s3a_tests/ # Hadoop S3A compatibility
│   └── different_clients/ # Multi-SDK client tests (Go SDK v2)
├── system_tests/        # Full system tests
├── pipeline/            # Pipeline/quota/namespace cache tests
├── lifecycle/           # Object lifecycle tests
└── framework/           # Test runner framework and index files
```

**File Counts:**
- Source files (JS): 626
- Test files (JS): 222
- Test-to-code ratio: ~35% (by file count)
- Jest-style test files (`.test.js`): 51
- Native C++ files: 466 (with 1 test file)
- Go files: 3 (with 0 test files)

**Test Frameworks:**
- **Mocha**: Primary framework, tests run via index files (`index.js`, `nc_index.js`)
- **Jest**: Secondary framework, used for newer tests (51 `.test.js` files)
- **External suites**: Ceph S3, MinIO Mint, Warp benchmark, Hadoop S3A

**S3 Compatibility Testing (Strong):**
- Ceph S3 tests validate S3 API compatibility for both containerized and NSFS modes
- Warp performance/stress tests for S3 operations
- Mint (MinIO) S3 conformance tests
- Hadoop S3A connector tests
- Multi-SDK client testing (Go SDK v2, AWS SDK)

**Gaps:**
- No unified test configuration (no `jest.config.js`, no `.mocharc.yml`)
- No coverage generation for either Mocha or Jest
- Mocha tests use custom index files instead of standard discovery patterns
- Go utilities completely untested
- C++ native code has minimal testing (1 test file for 466 source files)

### Code Quality

**Linting (Moderate):**
- ESLint configured with `eslint:all` base (strict) plus `@stylistic/js`
- Custom rules: copyright header enforcement, complexity limit (35), consistent naming
- ESLint ignores `.d.ts` files
- TSLint still present (deprecated since 2019)
- EditorConfig for consistent formatting across JS and C++

**AI Review Integration:**
- CodeRabbit configured with "chill" profile
- Auto-review enabled on PRs targeting `master`
- Path-specific instructions for `src/test/**` (enforce test inclusion)
- Related issues and PRs tracking enabled

**Gaps:**
- Complexity threshold of 35 is very high (industry standard: 10-15)
- No pre-commit hooks to catch issues before commit
- No Prettier or automated formatting tool
- No TypeScript strict mode (tsconfig.json exists but minimal use)

### Container Images

**Dockerfile Inventory:**
| Dockerfile | Purpose |
|-----------|---------|
| `NVA_build/builder.Dockerfile` | Node.js build environment |
| `NVA_build/Base.Dockerfile` | Runtime base image |
| `NVA_build/NooBaa.Dockerfile` | Production NooBaa image |
| `NVA_build/Tests.Dockerfile` | Test runner image |
| `NVA_build/SSLPostgres.Dockerfile` | SSL Postgres test image |
| `NVA_build/AWSClient.Dockerfile` | AWS client test image |
| `NVA_build/S3ATester.Dockerfile` | Hadoop S3A test image |
| `NVA_build/dev.Dockerfile` | Development image |
| `RPM_build/RPM.Dockerfile` | RPM build image |
| `standalone/executable.Dockerfile` | Standalone executable |
| `standalone/export.Dockerfile` | Export image |

**Strengths:**
- Multi-stage build pipeline (builder → base → noobaa → tester)
- Separate test runner image for isolation
- Multi-architecture support (amd64, arm64, ppc64le)
- RPM packaging pipeline

**Gaps:**
- No vulnerability scanning on any images
- No SBOM generation
- No image signing or attestation
- No image size optimization checks
- No `HEALTHCHECK` instructions visible

### Security

**Current State: Minimal**
- `.dockerignore` prevents sensitive files from entering images
- `.gitignore` configured
- CodeRabbit may catch some security issues in review
- No dedicated security tooling

**Missing (All Critical):**
- No CodeQL/SAST workflow
- No Dependabot/Renovate for dependency updates
- No container scanning (Trivy/Snyk)
- No secret detection (Gitleaks/TruffleHog)
- No SBOM generation
- No image signing
- No supply chain security (SLSA, Sigstore)

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None - no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: No test creation guidance for any test type (unit, integration, E2E, S3 compatibility)
- **Recommendation**: Generate rules with `/test-rules-generator` covering:
  - Mocha unit test patterns (describe/it structure, coretest setup)
  - Jest test patterns (`.test.js` naming, setup/teardown)
  - S3 compatibility test patterns
  - Integration test patterns (Docker network, Postgres, container lifecycle)
  - NC (Non-Containerized) test patterns

## Recommendations

### Priority 0 (Critical)

1. **Add code coverage tracking** - Install `nyc` for Mocha, configure Jest coverage, integrate with Codecov for PR reporting. Set initial thresholds based on current state, then ratchet up.

2. **Add container vulnerability scanning** - Add Trivy scanning to the PR workflow after image build. Block merges on CRITICAL/HIGH severity CVEs.

3. **Enable Dependabot** - Add `.github/dependabot.yml` for npm, Go modules, and GitHub Actions. This is a 1-hour task with immediate security value.

### Priority 1 (High Value)

4. **Add CodeQL SAST workflow** - Enable CodeQL for JavaScript analysis on PRs. NooBaa handles user-supplied S3 requests, making injection detection critical.

5. **Add secret detection** - Integrate Gitleaks to prevent accidental credential commits (AWS keys, IBM Cloud API keys used in nightly tests).

6. **Write Go unit tests** - The `go/cmd/tcp_speed` and `go/cmd/http_speed` utilities have no tests. Add basic functionality tests.

7. **Unify test framework configuration** - Create `jest.config.js` and `.mocharc.yml` for consistent test discovery and reporting.

### Priority 2 (Nice-to-Have)

8. **Add pre-commit hooks** - Configure `.pre-commit-config.yaml` with ESLint, commit message linting, and file size checks.

9. **Remove legacy Travis CI** - Delete `.travis.yml` and `.travis/` directory. All CI has moved to GitHub Actions.

10. **Create agent rules** - Generate `.claude/rules/` with test creation patterns for Mocha, Jest, and S3 compatibility suites.

11. **Add SBOM generation and image signing** - For release images, generate CycloneDX/SPDX SBOMs and sign with cosign.

12. **Lower ESLint complexity** - Incrementally reduce the `complexity` threshold from 35 toward 15, refactoring flagged functions.

## Comparison to Gold Standards

| Dimension | noobaa-core | odh-dashboard | notebooks | kserve |
|-----------|-------------|---------------|-----------|--------|
| Unit Tests | 6/10 | 9/10 | 7/10 | 9/10 |
| Integration/E2E | 7/10 | 9/10 | 8/10 | 9/10 |
| Build Integration | 5/10 | 8/10 | 7/10 | 7/10 |
| Image Testing | 5/10 | 7/10 | 9/10 | 7/10 |
| Coverage Tracking | 1/10 | 9/10 | 6/10 | 9/10 |
| CI/CD Automation | 7/10 | 9/10 | 8/10 | 9/10 |
| Agent Rules | 0/10 | 8/10 | 3/10 | 2/10 |
| **Overall** | **5.5/10** | **8.7/10** | **7.1/10** | **7.9/10** |

**Key gaps vs. gold standards:**
- **vs. odh-dashboard**: Missing coverage enforcement, contract testing, comprehensive agent rules, pre-commit hooks
- **vs. notebooks**: Missing image vulnerability scanning, SBOM generation, multi-layer image validation
- **vs. kserve**: Missing coverage thresholds, multi-version testing matrix, CodeQL integration

## File Paths Reference

### CI/CD Workflows
- `.github/workflows/run-pr-tests.yaml` - Main PR gate (orchestrates 10 test suites)
- `.github/workflows/jest-unit-tests.yaml` - Standalone Jest tests on PRs
- `.github/workflows/nc_unit.yml` - Non-containerized unit tests
- `.github/workflows/postgres-unit-tests.yaml` - Postgres-backed unit tests
- `.github/workflows/sanity.yaml` / `sanity-ssl.yaml` - Sanity checks
- `.github/workflows/ceph-s3-tests.yaml` / `ceph-nsfs-s3-tests.yaml` - S3 compatibility
- `.github/workflows/warp-tests.yaml` / `warp-nc-tests.yaml` - Warp benchmarks
- `.github/workflows/mint-tests.yaml` / `mint-nc-tests.yaml` - Mint S3 conformance
- `.github/workflows/build-arm64-image.yaml` / `build-ppc64le-image.yaml` - Multi-arch
- `.github/workflows/manual-full-build.yaml` - Full build and publish
- `.github/workflows/releaser.yaml` - Release automation
- `.github/workflows/Validate-package-lock.yaml` - Lockfile integrity

### Testing
- `src/test/utils/index/index.js` - Main Mocha test index (containerized)
- `src/test/utils/index/nc_index.js` - NC mode Mocha test index
- `src/test/unit_tests/` - 51+ unit test files
- `src/test/integration_tests/` - Integration test suites
- `src/test/external_tests/` - External S3 compatibility suites
- `src/test/system_tests/` - System-level tests

### Build
- `Makefile` - Primary build orchestration (all test/build targets)
- `src/deploy/NVA_build/*.Dockerfile` - Multi-stage Docker build chain
- `src/deploy/RPM_build/RPM.Dockerfile` - RPM packaging
- `package.json` - npm scripts (test, lint, mocha, jest)

### Code Quality
- `.eslintrc.js` - Comprehensive ESLint configuration (extends eslint:all)
- `.eslintignore` - ESLint ignore patterns
- `tslint.json` - Legacy TSLint config (deprecated)
- `.editorconfig` - Editor formatting standards
- `.coderabbit.yaml` - AI code review configuration
- `tsconfig.json` - TypeScript configuration

### Legacy
- `.travis.yml` - Travis CI config (superseded by GitHub Actions)
- `.travis/` - Travis support scripts
