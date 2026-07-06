---
repository: "opendatahub-io/data-science-pipelines"
overall_score: 7.0
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Good test ratios across Go/Python/TS; Ginkgo, pytest, Vitest frameworks; no coverage enforcement"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Excellent multi-version K8s/Argo matrix testing, Ginkgo label-based E2E, upgrade tests"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR image builds for 5 components, Tekton/Konflux pipelines, FIPS-compliant Go builds"
  - dimension: "Image Testing"
    score: 6.0
    status: "Images built and deployed in E2E, SBOM via Syft, but no standalone runtime validation"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "Coverage commands exist (vitest --coverage, go test) but no codecov/coveralls, no thresholds"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "52 workflows with concurrency control, path filtering, matrix testing, custom actions"
  - dimension: "Agent Rules"
    score: 5.0
    status: "Excellent 683-line AGENTS.md with policies, but no .claude/rules/ for test patterns"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Coverage regressions go undetected; no visibility into test health trends"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No secret detection (Gitleaks)"
    impact: "Credentials or API keys could be committed without detection"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "CodeQL runs only weekly, not on PRs"
    impact: "Security vulnerabilities introduced in PRs not caught until next weekly scan"
    severity: "MEDIUM"
    effort: "1 hour"
  - title: "No dependency update automation (Dependabot/Renovate)"
    impact: "Known vulnerabilities in dependencies persist until manual updates"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "Pre-commit workflow disabled in CI"
    impact: "Pre-commit checks rely on developer machines; not enforced in CI"
    severity: "LOW"
    effort: "30 minutes"
quick_wins:
  - title: "Add Codecov integration to unit-tests.yaml and frontend.yml"
    effort: "4-6 hours"
    impact: "Coverage visibility, PR annotations, regression detection across all three languages"
  - title: "Add Gitleaks to PR workflow"
    effort: "1-2 hours"
    impact: "Prevent accidental secret commits before merge"
  - title: "Enable CodeQL on pull_request trigger"
    effort: "1 hour"
    impact: "Catch SAST issues before merge instead of weekly after-the-fact"
  - title: "Add Dependabot configuration for Go, Python, npm, and GitHub Actions"
    effort: "1-2 hours"
    impact: "Automated dependency updates with security alerts"
  - title: "Generate .claude/rules/ for test patterns with /test-rules-generator"
    effort: "2-3 hours"
    impact: "AI agents generate consistent, framework-correct tests (Ginkgo, pytest, Vitest)"
recommendations:
  priority_0:
    - "Add Codecov/Coveralls integration with coverage thresholds to prevent regressions"
    - "Add Gitleaks secret detection to PR workflows"
    - "Enable CodeQL scanning on pull_request events, not just weekly schedule"
  priority_1:
    - "Add Dependabot/Renovate for automated dependency updates"
    - "Create .claude/rules/ with test patterns for Ginkgo, pytest, and Vitest"
    - "Add container runtime validation (startup probe, health check) in E2E"
    - "Re-enable pre-commit workflow in CI to enforce formatting consistently"
  priority_2:
    - "Add performance regression testing for API server endpoints"
    - "Add contract tests between frontend and backend API boundaries"
    - "Add image signing/attestation in GitHub Actions workflows (Tekton handles it but GH does not)"
    - "Tighten mypy configuration (remove ignore_missing_imports=true)"
---

# Quality Analysis: data-science-pipelines

## Executive Summary

- **Overall Score: 7.0/10**
- **Repository Type**: Polyglot monorepo (Go 860 files / Python 1421 files / TypeScript 629 files)
- **Description**: OpenDataHub fork of Kubeflow Pipelines — ML pipeline orchestration platform with Go API server, Python SDK, React frontend, and Kubernetes deployment manifests
- **Key Strengths**: Exceptionally comprehensive CI/CD (52 workflows), excellent multi-version matrix testing (K8s v1.31/v1.35, Argo v3.5/v3.7/v4.0), strong E2E coverage with Ginkgo labels, PR image builds, Tekton/Konflux integration, FIPS-compliant builds, thorough AGENTS.md
- **Critical Gaps**: No coverage tracking/enforcement (codecov), no secret detection (Gitleaks), CodeQL only weekly, no dependency automation
- **Agent Rules Status**: Present (excellent AGENTS.md) but Incomplete (no .claude/rules/ for test patterns)

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7.0/10 | Good ratios (Go 25%, Python 22%, TS 35%); Ginkgo + pytest + Vitest |
| Integration/E2E | 9.0/10 | Multi-version K8s/Argo matrix, Ginkgo labels, upgrade tests |
| **Build Integration** | **8.0/10** | **PR image builds (5 components), Tekton/Konflux, FIPS Go builds** |
| Image Testing | 6.0/10 | Built + deployed in E2E, SBOM via Syft; no standalone runtime validation |
| Coverage Tracking | 2.0/10 | `vitest --coverage` exists but no integration, no thresholds, no reporting |
| CI/CD Automation | 9.0/10 | 52 workflows, concurrency control, path filtering, matrix testing |
| Agent Rules | 5.0/10 | 683-line AGENTS.md with policies; no .claude/rules/ for test patterns |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: Coverage regressions go completely undetected; teams have no visibility into test health trends
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The frontend has `vitest --coverage` and `@vitest/coverage-v8` configured, and Go has `go test` capable of producing coverage. However, there is no codecov.yml, no coveralls integration, no coverage thresholds, and no PR annotations showing coverage changes. Coverage data is generated but never collected, tracked, or enforced.
- **Recommendation**: Add Codecov integration with a `codecov.yml` config, upload coverage from `unit-tests.yaml` (Go), `kfp-sdk-unit-tests.yml` (Python), and `frontend.yml` (TypeScript)

### 2. No Secret Detection
- **Impact**: API keys, tokens, or credentials could be committed without any automated detection
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: No Gitleaks, TruffleHog, or other secret scanning tool is configured. While `.gitignore` exists, there is no active scanning of commits for accidentally committed secrets.
- **Recommendation**: Add a Gitleaks GitHub Action to the PR workflow

### 3. CodeQL Runs Only Weekly
- **Impact**: Security vulnerabilities introduced in PRs are not caught until the next weekly Friday scan
- **Severity**: MEDIUM
- **Effort**: 1 hour
- **Details**: `codeql.yml` triggers only on `schedule: '39 19 * * 5'` (weekly Friday). Security issues in PRs are merged without SAST analysis. CodeQL covers Go, JavaScript, and Python — all three primary languages.
- **Recommendation**: Add `pull_request` trigger to `codeql.yml` with path filters for source code changes

### 4. No Dependency Update Automation
- **Impact**: Known vulnerabilities in dependencies persist until manual updates; transitive dependency risks accumulate
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: No Dependabot configuration (`.github/dependabot.yml`) or Renovate (`renovate.json`). The repo has Go modules (`go.mod`), Python packages (`requirements.txt`, `setup.py`), npm packages (`package.json`), and GitHub Actions — all need automated dependency tracking.
- **Recommendation**: Add Dependabot with ecosystem configs for gomod, pip, npm, and github-actions

### 5. Pre-commit Workflow Disabled in CI
- **Impact**: Pre-commit checks (yapf, isort, golangci-lint, actionlint) rely solely on developer machines
- **Severity**: LOW
- **Effort**: 30 minutes
- **Details**: `.github/workflows/pre-commit.yml` has `on: []` — it's disabled. The pre-commit config itself is excellent (10+ hooks), but it's not enforced in CI. Individual formatting checks run as separate workflows (sdk-yapf.yml, sdk-isort.yml, etc.), so the impact is mitigated.
- **Recommendation**: Either re-enable the pre-commit workflow or confirm that individual format workflows fully cover pre-commit hooks

## Quick Wins

### 1. Add Codecov Integration (4-6 hours)
```yaml
# Add to unit-tests.yaml after "Run Unit Test" step
- name: Upload Go coverage
  uses: codecov/codecov-action@v4
  with:
    flags: backend
    token: ${{ secrets.CODECOV_TOKEN }}
```

### 2. Add Gitleaks to PR Workflow (1-2 hours)
```yaml
# New workflow or add to ci-checks.yml
- name: Gitleaks
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 3. Enable CodeQL on PRs (1 hour)
```yaml
# In codeql.yml, change trigger to include PRs:
on:
  pull_request:
    paths:
      - 'backend/**'
      - 'frontend/**'
      - 'sdk/**'
  schedule:
    - cron: '39 19 * * 5'
```

### 4. Add Dependabot Configuration (1-2 hours)
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "gomod"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "pip"
    directory: "/sdk/python"
    schedule:
      interval: "weekly"
  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 5. Generate Agent Test Rules (2-3 hours)
```bash
# Run the test-rules-generator skill against the repository
/test-rules-generator https://github.com/opendatahub-io/data-science-pipelines
```

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (52 total)**:
- **PR-triggered** (path-filtered): `unit-tests.yaml`, `build-prs-trigger.yaml` → `build-prs.yml`, `api-server-tests.yml`, `e2e-test.yml`, `e2e-test-frontend.yml`, `trivy.yml`, `go-version-consistency.yml`, `upgrade-test.yml`, `ci-checks.yml`, `commit-check-pr.yml`, `stable-merge-check.yml`
- **Push-to-master**: Most workflows trigger on push to `master`/`main`/`stable`/`rhoai-*`
- **Scheduled**: CodeQL (weekly Friday), stale issues (daily), upstream-sync (weekly Tuesday)
- **Disabled**: `build-tools-images.yml`, `image-builds-master.yml`, `pre-commit.yml`, `sdk-upgrade.yml`

**Test Automation (Excellent)**:
- Unit tests run on PR for backend Go changes (path-filtered)
- API server integration tests run on PR when backend paths change
- E2E tests run on PR when backend/manifest paths change
- Frontend E2E tests run on PR when frontend paths change
- Upgrade tests run on PR for backend changes
- Image builds triggered on every PR (via workflow_run pattern)

**Concurrency Control (Good)**:
- Most workflows use `cancel-in-progress: true` with PR-number-based groups
- Prevents stale CI runs from consuming resources

**Custom GitHub Actions (Strong)**:
- `create-cluster`: Kind cluster creation
- `deploy`: KFP deployment to Kind
- `test-and-report`: Test execution with JUnit reporting
- `setup-go`: Standardized Go toolchain setup
- `build`: Image build abstraction

**Build Process (Strong)**:
- 5 images built per PR via `build-prs.yml` (api-server, frontend, persistenceagent, scheduledworkflow, driver)
- Tekton pipelines for Konflux production builds (5 PipelineRuns)
- FIPS-compliant Go builds (`GOFIPS140=v1.0.0`)
- UBI9 base images for Red Hat compliance
- SBOM generation configured (`.syft.yaml`)

### Test Coverage

**Go Backend (171 test files / 689 code files = 24.8%)**:
- **Unit tests**: 137 files in `backend/src/` — direct package-level tests
- **API integration tests**: 8 files in `backend/test/v2/api/` — Ginkgo-based, require running cluster
- **Integration tests**: 11 files in `backend/test/integration/` — includes webhook tests
- **E2E tests**: 3 files in `backend/test/end2end/` — extensive Ginkgo label-based scenarios
- **Compiler tests**: 3 files — golden file comparison with Ginkgo
- **Proto tests**: 25 files — protobuf validation
- **Framework**: Standard Go testing + Ginkgo/Gomega for integration/E2E
- **Test runner**: `go test ./...` for unit, `ginkgo` CLI for integration/E2E

**Python SDK (59 test files)**:
- Located in `sdk/python/kfp/` and `sdk/python/test/`
- **Framework**: pytest with `pytest.ini` config (`testpaths = sdk/python/kfp`)
- **kfp-kubernetes tests**: 14 test files in `kubernetes_platform/python/test/`
- Formatting enforced: yapf, isort, docformatter, pycln
- **mypy**: Configured but with `ignore_missing_imports = true` (weak)

**TypeScript Frontend (162 test files / 467 code files = 34.7%)**:
- **Framework**: Vitest 4.x + Testing Library (React, DOM, user-event) + Playwright
- **Coverage**: `@vitest/coverage-v8` configured; `npm run test:ui:coverage` available
- **Visual regression**: Custom `visual-compare.mjs` scripts (baseline/current/diff)
- **Coverage baseline**: Custom `coverage-baseline.mjs` for local comparison
- **Storybook**: Configured for component development
- **Frontend E2E**: WebdriverIO-based tests in `test/frontend-integration-test/`
- **Server integration**: Tests in `test/server-integration-test/`

**E2E Test Matrix (Excellent)**:
- Kubernetes versions: v1.31.x, v1.35.0
- Argo Workflow versions: v3.5.14, v3.7.3, v4.0.4
- Cache enabled/disabled toggle
- Proxy enabled/disabled toggle
- Pod-to-pod TLS enabled/disabled
- Pipeline stores: database
- Storage backends: seaweedfs, minio
- Test labels: E2ECritical, E2EEssential, E2EParallelNested, E2EProxy, E2eFailed, E2eGpu, Smoke, Sanity, Integration, Disconnected, MLflow*

**Coverage Tracking (Critical Gap)**:
- No `codecov.yml` or `.coveragerc`
- No coverage uploads in any workflow
- No coverage thresholds or PR gates
- Frontend has coverage tooling but it's local-only
- Go coverage not generated in CI (`go test` without `-coverprofile`)

### Code Quality

**Go Linting (golangci-lint v2)**:
- 6 linters enabled: gocritic, govet, ineffassign, misspell, staticcheck, unused
- Formatters: gofmt, goimports
- Timeout: 30m
- Exclusions: API generated code (`api/*.go`, `backend/api/*.go`)
- Runs in pre-commit hooks and CI

**Python Quality Tools**:
- **pylintrc**: Full configuration present (419+ lines)
- **mypy**: Configured but weak (`ignore_missing_imports = true`)
- **flake8**: Only checks W605 (invalid escape sequence)
- **yapf**: Google-based style with 80-column limit
- **isort**: Google profile
- **docformatter**: Auto-formats docstrings
- **pycln**: Removes unused imports

**Pre-commit Hooks (Comprehensive)**:
- 10+ hooks configured across 7 repos
- check-yaml, check-json, end-of-file-fixer, trailing-whitespace
- flake8, pycln, isort, yapf, docformatter
- golangci-lint (lint + format)
- actionlint (validates GitHub Actions YAML)
- no-commit-to-branch (prevents direct master commits)
- **Note**: Pre-commit CI workflow is disabled (`on: []`)

**Frontend Quality**:
- ESLint with `--max-warnings=0` (zero-tolerance for warnings)
- Prettier for formatting
- TypeScript strict checking (`tsc --noEmit`)
- React peer dependency checking
- Storybook for component documentation

### Container Images

**Dockerfiles (20+)**:
- Backend: 8 Dockerfiles (apiserver, driver, launcher, persistenceagent, scheduledworkflow, cacheserver, viewercontroller, visualization)
- Frontend: 1 Dockerfile
- Tools: 3 Dockerfiles (commit-checker, bazel-builder, webhook-proxy)
- Third-party: 3 Dockerfiles (ml-metadata, minio, metadata-envoy)
- Test: 3 Dockerfiles (release, imagebuilder, frontend-integration-test)

**Build Quality**:
- Multi-stage builds (builder → minimal runtime)
- UBI9 base images (Red Hat compliance)
- FIPS-compliant Go compilation (`GOFIPS140=v1.0.0`)
- Architecture support (amd64 via `TARGETARCH` build arg)
- Non-root user in production images (`USER 1001` or `USER 65534`)
- `.dockerignore` properly configured

**Tekton/Konflux (5 Pipelines)**:
- `odh-ml-pipelines-api-server-v2-push.yaml`
- `odh-ml-pipelines-driver-push.yaml`
- `odh-ml-pipelines-launcher-push.yaml`
- `odh-ml-pipelines-persistenceagent-v2-push.yaml`
- `odh-ml-pipelines-scheduledworkflow-v2-push.yaml`
- Includes SBOM generation (show-sbom task)
- Push-to-master triggers only

**Security Scanning**:
- **Trivy**: Filesystem scan on push/PR, CRITICAL+HIGH severity, SARIF upload to GitHub Security
- **Syft**: SBOM configuration for Go backend components (excludes frontend, samples, tests)
- **No**: Image signing, attestation, or container-specific CVE scanning in GitHub Actions (Tekton handles this)

### Security Practices

| Practice | Status | Details |
|----------|--------|---------|
| Trivy filesystem scan | Present | Runs on push + PR, CRITICAL/HIGH, SARIF upload |
| CodeQL SAST | Partial | Weekly only (Go, JS, Python); not on PRs |
| Secret detection | Missing | No Gitleaks, TruffleHog, or equivalent |
| Dependency scanning | Missing | No Dependabot or Renovate configured |
| SBOM generation | Present | Syft config for Go backend; Tekton includes show-sbom |
| Image signing | Partial | Tekton/Konflux handles; not in GitHub Actions |
| Pre-commit security | Present | no-commit-to-branch prevents master pushes |
| FIPS compliance | Present | Go builds with GOFIPS140=v1.0.0 |

### Agent Rules (Agentic Flow Quality)

**Status**: Present but Incomplete

**AGENTS.md (683 lines)** - Excellent documentation covering:
- **Maintenance policy**: Instructions to keep docs updated when code changes
- **Code reuse policy**: Reuse existing functions, no duplication
- **Architectural boundary policy**: ResourceManager lean, compiler boundaries, engine neutrality
- **Testing policy**: Unit tests required for non-trivial functions, existing tests must pass
- **Commit policy**: DCO sign-off required, no AI co-authors
- **Architecture overview**: End-to-end flow (SDK → API Server → Driver → Launcher → Executor)
- **Package naming**: kfp, kfp-pipeline-spec, kfp-kubernetes
- **Local development**: Virtual environment setup, Make targets
- **Local testing**: Commands for Go, Python SDK, kfp-kubernetes, frontend
- **Ginkgo test suites**: Compiler, API, E2E with labels and flags
- **CI/CD overview**: Workflow descriptions, matrix configurations

**CLAUDE.md**: Symlink to AGENTS.md (good practice)

**Gaps**:
- **No `.claude/rules/` directory**: No framework-specific test creation rules
- **No `.claude/skills/` directory**: No custom skills for the repository
- **No test pattern rules**: AI agents lack guidance on Ginkgo label conventions, pytest fixtures, Vitest mocking patterns
- **No E2E test creation rules**: No guidance on when to use E2ECritical vs E2EEssential vs Smoke labels
- **No golden file test rules**: No guidance on compiler golden file test patterns

**Recommendation**: Generate test rules using `/test-rules-generator` to create:
- `ginkgo-tests.md` — Ginkgo label conventions, FlakeAttempts, BeforeEach patterns
- `pytest-tests.md` — SDK test patterns, fixtures, parametrization
- `vitest-tests.md` — Frontend component testing, Testing Library patterns
- `e2e-tests.md` — E2E label taxonomy, cluster setup requirements

## Recommendations

### Priority 0 (Critical)

1. **Add Codecov/Coveralls integration with coverage thresholds**
   - Upload Go coverage from `unit-tests.yaml`
   - Upload Python coverage from `kfp-sdk-unit-tests.yml`
   - Upload TypeScript coverage from `frontend.yml`
   - Set minimum coverage thresholds (e.g., 60% for Go, 70% for Python, 50% for TS)
   - Enable PR annotations showing coverage changes

2. **Add Gitleaks secret detection to PR workflows**
   - Add `gitleaks/gitleaks-action@v2` to PR checks
   - Configure `.gitleaks.toml` for repo-specific allowlists

3. **Enable CodeQL scanning on PRs**
   - Add `pull_request` trigger to `codeql.yml`
   - Use path filters to avoid running on docs/images changes

### Priority 1 (High Value)

4. **Add Dependabot/Renovate for dependency updates**
   - Cover gomod, pip, npm, github-actions ecosystems
   - Group minor/patch updates to reduce PR noise

5. **Create `.claude/rules/` with test patterns**
   - Ginkgo conventions (labels, FlakeAttempts, BeforeEach/AfterEach)
   - pytest patterns (fixtures, parametrize, SDK test conventions)
   - Vitest patterns (Testing Library, component mocking, coverage)
   - E2E label taxonomy and when to use each

6. **Add container runtime validation in E2E**
   - Verify image startup with health check probes
   - Test API server responsiveness after deployment
   - Validate multi-container pod readiness

7. **Re-enable pre-commit workflow in CI**
   - Un-comment `on:` triggers in `pre-commit.yml`
   - Or confirm individual format workflows cover all hooks

### Priority 2 (Nice-to-Have)

8. **Add performance regression testing**
   - Benchmark API server endpoints
   - Track compile-time for SDK pipeline compilation
   - Monitor image build times

9. **Add contract tests for API boundaries**
   - Frontend ↔ API server contract validation
   - SDK ↔ API server spec conformance
   - kfp-kubernetes ↔ platform spec contracts

10. **Tighten mypy configuration**
    - Remove `ignore_missing_imports = true`
    - Add type stubs for key dependencies
    - Enable stricter checking flags

11. **Add image signing in GitHub Actions**
    - Sign images built in `build-prs.yml` with Cosign
    - Generate attestations for provenance

## Comparison to Gold Standards

| Feature | data-science-pipelines | odh-dashboard | notebooks | kserve |
|---------|----------------------|---------------|-----------|--------|
| Unit Tests | Go+Python+TS (Ginkgo/pytest/Vitest) | Jest+Cypress | Python unittest | Go testing |
| Coverage Tracking | None | Codecov enforced | Limited | Codecov |
| E2E Tests | Ginkgo matrix (K8s/Argo versions) | Cypress multi-browser | Image validation | KServe E2E |
| Coverage Enforcement | None | PR gates | None | Thresholds |
| Security Scanning | Trivy (PR+push) | Trivy+Snyk | Trivy | Trivy+CodeQL |
| Secret Detection | None | Gitleaks | None | None |
| Pre-commit Hooks | 10+ hooks (disabled CI) | Husky+lint-staged | Limited | golangci-lint |
| Agent Rules | AGENTS.md (683 lines) | .claude/rules/ | None | CLAUDE.md |
| Dependency Bot | None | Dependabot | None | Dependabot |
| Image Testing | PR builds + E2E deploy | Kontainer tests | 5-layer validation | Image tests |
| CI Workflows | 52 workflows | ~20 workflows | ~15 workflows | ~25 workflows |
| FIPS Compliance | Yes (GOFIPS140) | No | No | No |
| Tekton/Konflux | 5 pipelines | Present | Present | No |

**Key Differentiators**:
- data-science-pipelines has the most comprehensive CI/CD of any ODH repo (52 workflows)
- Multi-version matrix testing (K8s + Argo) is best-in-class
- AGENTS.md quality is outstanding — rivals odh-dashboard's agent rules in documentation depth
- Main gap vs. gold standards: coverage tracking and secret detection

## File Paths Reference

### CI/CD
- `.github/workflows/` — 52 workflow files
- `.github/actions/` — 9 custom composite actions (create-cluster, deploy, test-and-report, etc.)
- `.github/scripts/` — CI helper scripts (check_integration_test_label.py, verify-go-version-consistency.sh)
- `.tekton/` — 5 Tekton PipelineRun definitions for Konflux

### Testing
- `backend/src/**/*_test.go` — 137 Go unit test files
- `backend/test/v2/api/` — 8 Ginkgo API integration test files
- `backend/test/integration/` — 11 Go integration test files
- `backend/test/end2end/` — 3 Ginkgo E2E test files (extensive labels)
- `backend/test/compiler/` — 3 Ginkgo compiler test files
- `sdk/python/kfp/` — 59 pytest test files
- `kubernetes_platform/python/test/` — 14 pytest test files
- `frontend/src/**/*.test.{ts,tsx}` — 162 Vitest test files
- `test/frontend-integration-test/` — WebdriverIO frontend E2E
- `test/server-integration-test/` — Server integration tests

### Code Quality
- `.golangci.yaml` — golangci-lint v2 config (6 linters)
- `.pre-commit-config.yaml` — 10+ hooks across 7 repos
- `.pylintrc` — Python linting config
- `mypy.ini` — Type checking (weak config)
- `pytest.ini` — pytest configuration
- `.isort.cfg` — Import sorting (Google profile)
- `.style.yapf` — Python formatting (Google style)
- `frontend/.eslintrc*` — TypeScript/React linting

### Container Images
- `backend/Dockerfile` — API server (multi-stage, UBI9, FIPS)
- `backend/Dockerfile.driver` — Driver component
- `backend/Dockerfile.launcher` — Launcher component
- `backend/Dockerfile.persistenceagent` — Persistence agent
- `backend/Dockerfile.scheduledworkflow` — Scheduled workflow controller
- `frontend/Dockerfile` — React frontend
- `.syft.yaml` — SBOM generation config
- `.dockerignore` — Build context exclusions

### Agent Rules
- `AGENTS.md` — 683-line comprehensive agent guide
- `CLAUDE.md` — Symlink to AGENTS.md
