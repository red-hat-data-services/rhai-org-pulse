---
repository: "opendatahub-io/model-registry"
overall_score: 7.9
scorecard:
  - dimension: "Unit Tests"
    score: 8.0
    status: "157 Go test files with testcontainers, pytest, Jest; 31% test-to-code ratio"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "E2E on KinD with multi-K8s, multi-DB, multi-Python, Cypress, fuzz testing"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR image builds + KinD deployment + operator validation; Tekton/Konflux pipelines"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-arch builds, UBI9 base images, SBOM generation; limited runtime smoke tests"
  - dimension: "Coverage Tracking"
    score: 6.0
    status: "Codecov integration with fail_ci_if_error but no coverage thresholds or gates"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "36 well-organized workflows with path-based triggers and pinned action SHAs"
  - dimension: "Agent Rules"
    score: 6.0
    status: "Comprehensive AGENTS.md and 4 skills; missing test-specific creation rules"
critical_gaps:
  - title: "No coverage thresholds or gates"
    impact: "Coverage can silently regress without any PR gate blocking the merge"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No golangci-lint project configuration"
    impact: "Using default linters only; missing security and style linters like gosec, errcheck strict mode, goconst"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "Trivy scanning is periodic only, not on PRs"
    impact: "Vulnerable dependencies can be merged without detection; discovered only on weekly schedule"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No Cypress E2E in CI against live backend"
    impact: "Cypress runs only mocked; real API integration issues not caught until manual testing"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "No test-specific agent rules for test creation"
    impact: "AI-generated tests may not follow project conventions for each test type"
    severity: "LOW"
    effort: "3-4 hours"
quick_wins:
  - title: "Add codecov.yml with coverage thresholds"
    effort: "1-2 hours"
    impact: "Prevent coverage regressions with project/patch targets (e.g., 70% project, 80% patch)"
  - title: "Add Trivy scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Catch vulnerable dependencies before merge, not a week later"
  - title: "Create .golangci.yml with security linters"
    effort: "2-3 hours"
    impact: "Enable gosec, errcheck, goconst, exhaustive for stronger static analysis"
  - title: "Generate test-specific agent rules with /test-rules-generator"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality and consistency across Go, Python, and TypeScript"
recommendations:
  priority_0:
    - "Add codecov.yml with coverage thresholds (70% project target, 80% patch target) to prevent regressions"
    - "Add Trivy or Snyk scanning to PR workflows for early vulnerability detection"
  priority_1:
    - "Create .golangci.yml with gosec, errcheck, goconst, exhaustive, and nolintlint enabled"
    - "Add Cypress E2E tests against a live BFF+server stack on KinD for real integration validation"
    - "Create .claude/rules/ with test-specific rules for unit, integration, and E2E test creation"
  priority_2:
    - "Add performance/load testing for model registry API endpoints"
    - "Add contract tests between Python client and Go server API"
    - "Consider CodeQL SAST integration alongside Semgrep for defense-in-depth"
---

# Quality Analysis: model-registry (opendatahub-io/model-registry)

## Executive Summary

- **Overall Score: 7.9/10**
- **Repository Type**: Multi-component Go/Python/TypeScript service with Kubernetes controller
- **Primary Languages**: Go (core server, controller, CSI), Python (clients, jobs), TypeScript/React (UI)
- **Key Strengths**: Excellent E2E testing with multi-K8s/multi-DB/multi-Python matrix, comprehensive CI/CD with 36 workflows, strong PR-time image build validation with KinD deployment, well-structured AGENTS.md
- **Critical Gaps**: No coverage thresholds/gates, Trivy scanning only on weekly schedule (not PRs), no project-level golangci-lint config
- **Agent Rules Status**: Present and comprehensive (AGENTS.md + 4 skills); missing test-specific creation rules

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8/10 | 157 Go test files, pytest, Jest; testcontainers for DB integration |
| Integration/E2E | 9/10 | KinD E2E with multi-K8s (v1.33, v1.34), multi-DB, fuzz testing, Cypress |
| **Build Integration** | **7/10** | **PR image builds + KinD deploy + operator test; Tekton/Konflux present** |
| Image Testing | 7/10 | Multi-arch, UBI9, SBOM; limited runtime smoke tests |
| Coverage Tracking | 6/10 | Codecov integration but no thresholds or coverage gates |
| CI/CD Automation | 9/10 | 36 workflows, path-based triggers, pinned SHAs, concurrency control |
| Agent Rules | 6/10 | Comprehensive AGENTS.md + 4 skills; no test-specific rules |

## Critical Gaps

### 1. No Coverage Thresholds or Gates
- **Impact**: Coverage can silently regress on any PR without blocking merge
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Codecov is integrated in `build.yml` and `python-tests.yml` with `fail_ci_if_error: true` (upload errors fail), but there is no `codecov.yml` file defining project/patch coverage targets. Any amount of coverage regression is silently accepted.
- **Fix**: Create `codecov.yml` at repo root:
  ```yaml
  coverage:
    status:
      project:
        default:
          target: 70%
          threshold: 2%
      patch:
        default:
          target: 80%
  ```

### 2. Trivy Scanning Not on PRs
- **Impact**: Vulnerable dependencies or base images can be merged; only discovered on weekly Monday scan
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: `trivy-image-scanning.yaml` runs weekly via schedule (`0 0 * * 1`). No Trivy or Snyk step in any PR workflow. New vulnerable deps introduced in PRs won't be caught until the following Monday.
- **Fix**: Add Trivy filesystem/SCA scan as a step in `build.yml` or a new PR-triggered workflow.

### 3. No golangci-lint Project Configuration
- **Impact**: Using only default linters; missing security-focused linters (gosec), stricter error checking, and code quality rules
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: `AGENTS.md` explicitly states "There is no project-level `.golangci.yml` config file — the default golangci-lint configuration applies." golangci-lint v2.12.2 is used but only with default linter set.

### 4. Cypress E2E Only Runs Mocked
- **Impact**: UI integration bugs against real API not caught in CI
- **Severity**: MEDIUM
- **Effort**: 8-12 hours
- **Details**: `ui-frontend-build.yml` runs `npm run test` which includes `test:cypress-ci` but only with `CY_MOCK=1`. Real backend integration is not validated in CI.

## Quick Wins

### 1. Add codecov.yml with Coverage Thresholds (1-2 hours)
Create `codecov.yml` at repo root to enforce coverage gates on PRs. Codecov integration already exists — this just adds enforcement.

### 2. Add Trivy to PR Workflow (1-2 hours)
Add a Trivy filesystem scan step to `build.yml`:
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    scan-type: 'fs'
    scan-ref: '.'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'
```

### 3. Create .golangci.yml with Security Linters (2-3 hours)
Enable gosec, errcheck, goconst, exhaustive, nolintlint, and other valuable linters beyond the defaults.

### 4. Generate Test-Specific Agent Rules (2-3 hours)
Use `/test-rules-generator` to create `.claude/rules/` with rules for Go unit tests, Python pytest, TypeScript/Jest, Cypress E2E, and controller envtest patterns.

## Detailed Findings

### CI/CD Pipeline

**Workflows Inventory (36 total)**:

| Category | Workflows | Trigger |
|----------|-----------|---------|
| **Build & Test (PR)** | build.yml, build-image-pr.yml, build-image-ui-pr.yml | pull_request |
| **Component Tests (PR)** | controller-test.yml, csi-test.yml, async-upload-test.yml | pull_request (path-filtered) |
| **Python Tests (PR)** | python-tests.yml | pull_request |
| **UI Tests (PR)** | ui-frontend-build.yml, ui-bff-build.yml | pull_request (path-filtered) |
| **Validation (PR)** | check-db-schema-structs.yaml, check-gitattributes.yaml, check-openapi-spec-pr.yaml, go-mod-tidy-diff-check.yml | pull_request |
| **Image Push (main)** | 6 build-and-push-* workflows | push to main |
| **Security (scheduled)** | trivy-image-scanning.yaml, scorecard.yml | weekly schedule |
| **Maintenance** | stale.yaml, go-generate.yml, sync-branch-*.yml | scheduled/push |
| **Contributor** | first-time-contributor-pr.yml, gh-workflow-approve.yml, labeler.yml | pull_request |
| **Tekton/Konflux** | 4 pipeline configs in .tekton/ | PR + push via Pipelines-as-Code |

**Strengths**:
- Comprehensive path-based filtering prevents unnecessary CI runs
- All actions use pinned SHA hashes (not `@v4` tags) — excellent supply chain security
- `permissions: read-all` at top level with scoped escalation per job
- Reusable workflow (`prepare.yml`) for shared setup
- Concurrency control on approve workflow
- Branch sync automation (main → stable, main → stable-2.x)

**Gaps**:
- No explicit caching in some workflows (though `setup-go` handles Go module caching)
- No CI timing/duration reporting

### Test Coverage

**Go Testing (157 test files / 508 source files = 31%)**:
- Framework: `testing` + `stretchr/testify` assertions
- Database integration: Testcontainers for MySQL and PostgreSQL
- Controller: envtest (kubebuilder) with K8s v1.33
- Filter parser: Comprehensive cross-database tests
- Converter: Full coverage of OpenAPI ↔ internal type conversions
- Notable: Fuzz testing available via `test-fuzz.yml` (dispatch-only)

**Python Testing (38 test files)**:
- Framework: pytest via Nox sessions
- E2E: Full KinD deployment with model-registry server + Minio + OCI registry
- Multi-version matrix: Python 3.10, 3.11, 3.12, 3.13, 3.14
- Multi-K8s matrix: v1.33.7, v1.34.3
- Multi-DB matrix: MySQL, PostgreSQL
- Fuzz testing: Runs on main and PRs touching OpenAPI specs
- Coverage: XML report uploaded to Codecov

**TypeScript/UI Testing (30 test files + 25 Cypress tests)**:
- Unit: Jest with 30 spec/test files
- E2E: Cypress with 25 test files (mocked mode only in CI)
- Linting: ESLint with zero-warnings enforcement
- Type checking: TypeScript `--noEmit` strict mode
- Build validation: Ensures no uncommitted build artifacts

**Catalog Testing**:
- Unit tests: `make -C catalog test-cover`
- E2E: Separate `catalog-test` job in python-tests.yml with KinD deployment

### Code Quality

**Go**:
- golangci-lint v2.12.2 (latest) — default configuration only
- `go vet` runs separately
- `go mod tidy` diff check on PRs
- Code generation validation (openapi, gorm, converter) ensures generated code stays in sync
- DB schema struct validation (`check-db-schema-structs.yaml`)

**Python**:
- Ruff linter + formatter (pre-commit + CI)
- mypy type checking
- Poetry for dependency management
- Nox for test session management

**TypeScript**:
- ESLint with `--max-warnings 0` (zero tolerance)
- TypeScript strict mode
- Build output validation

**Pre-commit Hooks**:
- check-added-large-files, check-ast, check-case-conflict
- detect-private-key (excludes test files)
- end-of-file-fixer, trailing-whitespace
- Ruff linting/formatting for Python

### Container Images

**8 Dockerfiles across components**:

| Image | Dockerfile | Multi-arch | Base Image |
|-------|-----------|------------|------------|
| model-registry (server) | Dockerfile | arm64, amd64 | UBI9 go-toolset → ubi-minimal |
| model-registry (ODH) | Dockerfile.odh | arm64, amd64 | UBI9 go-toolset → ubi-minimal |
| testops | Dockerfile.testops | arm64, amd64 | UBI9 |
| controller | cmd/controller/Dockerfile.controller | arm64, amd64 | UBI9 |
| CSI storage-initializer | cmd/csi/Dockerfile.csi | arm64, amd64 | UBI9 |
| async-upload job | jobs/async-upload/Dockerfile | arm64, amd64 | UBI9 |
| UI | clients/ui/Dockerfile | arm64, amd64 | Node + nginx |
| UI standalone | clients/ui/Dockerfile.standalone | arm64, amd64 | Node + nginx |

**Strengths**:
- Multi-stage builds everywhere
- Multi-architecture support (arm64 + amd64)
- UBI9 (Red Hat Universal Base Image) for all Go services
- SBOM generation via Syft (`.syft.yaml` config)
- Non-root user (65532:65532) in final images
- Layer caching with dependency download before source copy

**PR-time Validation**:
- `build-image-pr.yml`: Builds image → loads into KinD → deploys operator → creates test registry → validates with Python client
- `build-image-ui-pr.yml`: Builds UI image on PRs

### Security

**Strong security posture**:

| Tool | Status | Integration |
|------|--------|-------------|
| Gitleaks | ✅ Configured | `.gitleaks.toml` with comprehensive allowlists for test fixtures |
| Trivy | ⚠️ Scheduled only | Weekly scan of 5 images; NOT on PRs |
| Syft/SBOM | ✅ Enabled | `.syft.yaml` config, integrated in build-and-push workflows |
| Semgrep | ✅ Configured | `semgrep.yaml` rules |
| OpenSSF Scorecard | ✅ Scheduled | Weekly + push to main |
| Dependabot | ✅ Enabled | `.github/dependabot.yml` |
| Secret detection | ✅ Pre-commit | `detect-private-key` hook |
| Action pinning | ✅ All pinned | SHA-pinned action references throughout |
| Permissions | ✅ Scoped | `permissions: read-all` top-level + per-job escalation |

### Agent Rules (Agentic Flow Quality)

**Status**: Present and well-structured
**Coverage**: Development workflow, conventions, CI checks; missing test-specific rules

**AGENTS.md** is excellent — among the best in the ODH ecosystem:
- Comprehensive repository map
- Clear agent behavior policy
- Full command reference (build, test, lint, deploy)
- Auto-generated file warnings
- Multi-component coverage (Go, Python, TypeScript)
- CI check documentation table
- Context awareness guidelines
- Security checklist

**.agents/skills/**: 4 catalog-related skills with SKILL.md files:
- `catalog-add-route` — Route scaffolding
- `catalog-sample-data` — Sample data generation
- `init-catalog` — Catalog initialization (with panic handling docs)
- `sync-catalog` — Catalog sync operations

**Gaps**:
- No `.claude/rules/` directory for test-specific creation rules
- No rules for Go testcontainers patterns
- No rules for envtest controller testing
- No rules for Python E2E with KinD
- No rules for Cypress mocked E2E
- Skills are catalog-focused; no testing skills

**Recommendation**: Generate test rules with `/test-rules-generator` for:
- Go unit tests (testify patterns)
- Go integration tests (testcontainers)
- Go controller tests (envtest)
- Python pytest (nox sessions)
- TypeScript/Jest unit tests
- Cypress E2E tests

## Recommendations

### Priority 0 (Critical)

1. **Add `codecov.yml` with coverage thresholds** — Codecov is already integrated but without enforcement. Add 70% project target + 80% patch target to prevent coverage regression.

2. **Add Trivy/Snyk scanning to PR workflows** — Currently only weekly scheduled scans. PRs can introduce vulnerable dependencies without any gate.

### Priority 1 (High Value)

3. **Create `.golangci.yml` with security-focused linters** — Enable gosec, errcheck strict mode, goconst, exhaustive, nolintlint. The current default-only config misses important security and reliability checks.

4. **Run Cypress E2E against live backend in CI** — Currently mocked-only. Add a CI job that starts BFF + server in standalone mode and runs Cypress against the real stack.

5. **Create `.claude/rules/` with test-specific rules** — Generate rules for each test type to ensure AI-assisted test creation follows project patterns.

### Priority 2 (Nice-to-Have)

6. **Add performance/load testing** — No load testing for the model registry API; consider k6 or locust for regression testing.

7. **Add contract tests between Python client and Go server** — API schema changes could break the Python client; OpenAPI spec validation helps but doesn't test runtime behavior.

8. **Add CodeQL alongside Semgrep** — Defense-in-depth for SAST; CodeQL catches different vulnerability classes than Semgrep.

9. **Add UI coverage reporting** — Jest/Cypress coverage not uploaded to Codecov; UI code has no coverage visibility.

## Comparison to Gold Standards

| Dimension | model-registry | odh-dashboard (gold) | notebooks (gold) | Gap |
|-----------|---------------|---------------------|-------------------|-----|
| Unit Tests | 157 Go + 38 Py + 30 TS | 1000+ Jest | N/A | Good coverage, strong multi-lang |
| Integration/E2E | KinD + multi-K8s + multi-DB + fuzz | Cypress + mock | 5-layer image | Excellent; add live Cypress |
| Coverage Tracking | Codecov, no thresholds | Codecov + thresholds | N/A | **Add thresholds** |
| Coverage Gates | ❌ None | ✅ Enforced | N/A | **Critical gap** |
| Image Testing | Build + KinD deploy | Build + test | 5-layer validation | Good; add runtime smoke |
| Security | Gitleaks + Trivy (sched) + Semgrep | Trivy + Snyk on PR | Trivy on PR | **Add PR-time scanning** |
| CI/CD | 36 workflows + Tekton | 50+ workflows | Path-based | Excellent organization |
| Agent Rules | AGENTS.md + 4 skills | CLAUDE.md + rules | N/A | Add test-specific rules |
| Lint Config | Default golangci-lint | Custom config | N/A | **Add project config** |
| Pre-commit | ✅ Configured | ✅ Configured | N/A | Good parity |

## File Paths Reference

### CI/CD
- `.github/workflows/build.yml` — Go build + unit tests + coverage upload
- `.github/workflows/python-tests.yml` — Python lint + E2E + fuzz + catalog tests
- `.github/workflows/build-image-pr.yml` — PR image build + KinD deployment
- `.github/workflows/controller-test.yml` — Controller envtest
- `.github/workflows/csi-test.yml` — CSI tests on KinD
- `.github/workflows/trivy-image-scanning.yaml` — Weekly Trivy scan
- `.github/workflows/scorecard.yml` — OpenSSF Scorecard
- `.tekton/` — 4 Tekton/Konflux pipeline configs

### Testing
- `internal/core/*_test.go` — Core business logic tests
- `internal/db/service/*_test.go` — Database service tests (testcontainers)
- `internal/db/filter/*_test.go` — Query filter parser tests
- `clients/python/tests/` — Python client tests
- `clients/ui/frontend/src/__tests__/` — UI Jest + Cypress tests
- `cmd/controller/` — Controller tests (envtest)
- `jobs/async-upload/tests/` — Async upload job tests

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks
- `Makefile` — Build, test, lint targets
- `.gitleaks.toml` — Secret detection config
- `.syft.yaml` — SBOM generation config
- `semgrep.yaml` — Semgrep SAST rules

### Agent Rules
- `AGENTS.md` — Comprehensive agent behavior guide
- `.agents/skills/` — 4 catalog-related skills
- `.claude/` → symlink to `.agents/skills`

### Container Images
- `Dockerfile` — Main server image
- `Dockerfile.odh` — ODH-specific image
- `cmd/controller/Dockerfile.controller` — Controller image
- `cmd/csi/Dockerfile.csi` — CSI storage-initializer
- `clients/ui/Dockerfile` — UI image
