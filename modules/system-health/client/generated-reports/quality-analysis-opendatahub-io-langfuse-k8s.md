---
repository: "opendatahub-io/langfuse-k8s"
overall_score: 3.9
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Solid helm-unittest coverage with 9 test suites (1,387 lines) covering core templates"
  - dimension: "Integration/E2E"
    score: 2.0
    status: "No chart-testing (ct) install validation, no Kind/Minikube deployment tests"
  - dimension: "Build Integration"
    score: 4.0
    status: "Helm lint + helm-docs validation on PR, but no chart installation testing"
  - dimension: "Image Testing"
    score: 2.0
    status: "Pure Helm chart — no image builds or scanning of referenced container images"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tracking or reporting for Helm unit tests"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "4 workflows with lint, unit tests, auto-release, and weekly upstream version sync"
  - dimension: "Agent Rules"
    score: 1.0
    status: "No CLAUDE.md, .claude/ directory, or agent rules of any kind"
critical_gaps:
  - title: "No chart-testing (ct) integration or install validation"
    impact: "Chart template rendering passes but actual installation may fail due to dependency issues, resource conflicts, or runtime failures"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No security scanning of referenced container images"
    impact: "Vulnerable base images (langfuse/langfuse, bitnamilegacy/* subchart images) shipped to users without detection"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No coverage tracking for Helm tests"
    impact: "No visibility into which templates and value combinations are tested vs. untested"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "Missing tests for HPA, VPA, KEDA, and worker templates"
    impact: "Scaling configuration regressions go undetected; worker deployment issues not caught"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No agent rules for AI-assisted contributions"
    impact: "AI agents making PRs lack chart-specific guidance, leading to inconsistent contributions"
    severity: "LOW"
    effort: "2-3 hours"
quick_wins:
  - title: "Add Trivy scanning for referenced container images"
    effort: "1-2 hours"
    impact: "Detect known CVEs in langfuse/langfuse and bitnamilegacy/* images before release"
  - title: "Add concurrency control to CI workflows"
    effort: "30 minutes"
    impact: "Prevent redundant CI runs on rapid pushes; save GitHub Actions minutes"
  - title: "Add chart-testing (ct) lint step to PR workflow"
    effort: "1-2 hours"
    impact: "Catch chart schema issues, version bump requirements, and maintainer metadata problems"
  - title: "Create basic CLAUDE.md with Helm chart contribution guidelines"
    effort: "1 hour"
    impact: "Guide AI agents on chart conventions, test requirements, and values.yaml patterns"
recommendations:
  priority_0:
    - "Implement chart-testing (ct) with install validation using Kind clusters to catch deployment failures before merge"
    - "Add container image vulnerability scanning (Trivy) to catch CVEs in referenced images"
  priority_1:
    - "Add Helm unit tests for HPA, VPA, KEDA, and worker deployment templates"
    - "Implement chart-testing install tests with multiple values.yaml scenarios (minimal, full, external DBs)"
    - "Add CI concurrency control to prevent redundant workflow runs"
  priority_2:
    - "Create agent rules for Helm chart contributions (.claude/rules/)"
    - "Add pre-commit hooks for helm-docs, yaml linting, and schema validation"
    - "Implement Kubeconform or kubeval for Kubernetes manifest schema validation"
---

# Quality Analysis: langfuse-k8s

## Executive Summary

- **Overall Score: 3.9/10**
- **Repository Type**: Helm chart for deploying [Langfuse](https://langfuse.com/) (LLM observability platform) on Kubernetes
- **Primary Language**: YAML (Helm templates)
- **Chart Version**: 1.5.22 (appVersion: 3.155.1)
- **Key Strengths**: Good Helm unit test coverage, comprehensive input validation template, automated upstream version tracking
- **Critical Gaps**: No chart installation testing, no security scanning, no coverage tracking, no agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, no `.claude/` directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 7/10 | Solid helm-unittest coverage with 9 test suites (1,387 lines) |
| Integration/E2E | 2/10 | No chart-testing (ct) install validation or Kind cluster tests |
| **Build Integration** | **4/10** | **Helm lint + helm-docs on PR, no chart install test** |
| Image Testing | 2/10 | Pure Helm chart — no image builds or scanning of referenced images |
| Coverage Tracking | 1/10 | No coverage tracking or reporting |
| CI/CD Automation | 7/10 | 4 workflows: lint, test, release, auto-version-update |
| Agent Rules | 1/10 | No CLAUDE.md, .claude/ directory, or agent rules |

## Critical Gaps

### 1. No Chart Installation Testing (HIGH)
- **Impact**: Helm templates may render correctly but fail during actual `helm install` due to dependency resolution, resource ordering, or runtime configuration issues
- **Current state**: Only `helm lint` and `helm unittest` run — no actual deployment validation
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Recommendation**: Add [chart-testing (ct)](https://github.com/helm/chart-testing) with Kind cluster for install/upgrade testing

### 2. No Security Scanning of Referenced Container Images (HIGH)
- **Impact**: The chart deploys `langfuse/langfuse`, `langfuse/langfuse-worker`, and multiple `bitnamilegacy/*` images. Vulnerable images ship to users undetected.
- **Current state**: No Trivy, Snyk, or any vulnerability scanning
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Note**: The chart recently migrated to `bitnamilegacy/*` images due to Bitnami registry changes — these legacy images may have delayed security patches

### 3. No Coverage Tracking (MEDIUM)
- **Impact**: No way to know which templates, value combinations, and code paths are tested vs. untested
- **Current state**: Tests run but produce no coverage metrics
- **Severity**: MEDIUM
- **Effort**: 2-3 hours

### 4. Missing Tests for Key Templates (MEDIUM)
- **Impact**: HPA, VPA, KEDA, and worker-specific template regressions go undetected
- **Templates without dedicated tests**: `worker/hpa.yaml`, `worker/vpa.yaml`, `web/vpa.yaml`, `web/scaled-object.yaml`, `worker/scaled-object.yaml`, `nextauth-secret.yaml`, `postgresql-secret.yaml`, `extra-manifests.yaml`
- **Severity**: MEDIUM
- **Effort**: 4-6 hours

### 5. No Agent Rules (LOW)
- **Impact**: AI-assisted contributions lack chart-specific guidance
- **Current state**: No CLAUDE.md, AGENTS.md, or `.claude/` directory
- **Severity**: LOW
- **Effort**: 2-3 hours

## Quick Wins

### 1. Add Concurrency Control to CI Workflows (~30 min)
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```
Add to `test.yaml` and `validate.yaml` to prevent redundant runs on rapid pushes.

### 2. Add Trivy Image Scanning (1-2 hours)
```yaml
- name: Scan referenced images
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'langfuse/langfuse:${{ steps.chart-version.outputs.app_version }}'
    format: 'sarif'
    output: 'trivy-results.sarif'
```

### 3. Add chart-testing Lint Step (1-2 hours)
```yaml
- name: Run chart-testing (lint)
  uses: helm/chart-testing-action@v2
  with:
    command: lint
    config: ct.yaml
```

### 4. Create CLAUDE.md (1 hour)
Basic agent rules for Helm chart conventions, test requirements, and PR standards.

## Detailed Findings

### CI/CD Pipeline

**Workflows (4 total):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yaml` | PR + push to main | Runs helm-unittest with JUnit reporting |
| `validate.yaml` | PR (charts/** paths) | Helm lint + helm-docs freshness check |
| `release.yaml` | Push to main (Chart.yaml changes) | Package + push to GHCR + chart-releaser |
| `update-langfuse-version.yml` | Weekly cron (Mon 9AM UTC) + manual dispatch | Auto-detect new Langfuse release, create version bump PR |

**Strengths:**
- JUnit test result publishing via `EnricoMi/publish-unit-test-result-action`
- Helm-docs freshness validation prevents stale README
- Automated upstream version tracking with auto-PR creation
- Dual artifact publishing (GHCR OCI + chart-releaser for Helm repo)

**Weaknesses:**
- No concurrency control on any workflow
- No caching of Helm dependencies between runs
- No chart-testing (ct) integration
- No security scanning workflows (CodeQL, Trivy, Dependabot)
- `validate.yaml` only triggers on `charts/**` path changes — misses `.github/` workflow changes

### Test Coverage

**Helm Unit Tests (9 suites, 1,387 lines):**

| Test File | Lines | What It Tests |
|-----------|-------|---------------|
| `basic_test.yaml` | 70 | Default rendering, labels, image tags |
| `clickhouse-cluster_test.yaml` | 138 | ClickHouse cluster mode, env vars, migration URLs |
| `downward-api_test.yaml` | 166 | Downward API field references, resource field refs |
| `extra-containers_test.yaml` | 64 | Sidecar containers for web and worker |
| `extra-env_test.yaml` | 34 | Additional environment variables |
| `ingress_test.yaml` | 188 | Ingress with default/custom backends, mixed backends, TLS |
| `minimal-installation_test.yaml` | 83 | Example values rendering, secret references, DB config |
| `redis-cluster_test.yaml` | 550 | Redis standalone/cluster/sentinel modes, TLS, auth |
| `s3-media-upload-validation_test.yaml` | 94 | S3 media upload validation, force path style |

**Test-to-Template Ratio**: 9 test files : 16 template files (56% template coverage)

**Templates WITH dedicated tests**: `web/deployment.yaml`, `worker/deployment.yaml`, `web/service.yaml`, `serviceaccount.yaml`, `ingress.yaml`

**Templates WITHOUT dedicated tests**: `web/hpa.yaml`, `web/vpa.yaml`, `web/scaled-object.yaml`, `worker/hpa.yaml`, `worker/vpa.yaml`, `worker/scaled-object.yaml`, `nextauth-secret.yaml`, `postgresql-secret.yaml`, `extra-manifests.yaml`, `validations.yaml`, `_helpers.tpl`

### Code Quality

**Linting:**
- `helm lint` runs in `validate.yaml` workflow with `values.lint.yaml` for required secrets
- `helm-docs` freshness check enforces documentation stays up-to-date

**Static Analysis:**
- No SAST tools (CodeQL, gosec, Semgrep)
- No dependency scanning (Dependabot)
- No secret detection (Gitleaks, TruffleHog)

**Pre-commit Hooks:**
- None configured

**Input Validation:**
- Excellent: 250+ line `validations.yaml` template validates:
  - Logging level/format values
  - Auth provider names
  - ClickHouse shard constraints
  - Redis deployment vs. external validation
  - Redis cluster/sentinel mutual exclusion
  - S3 storage provider type
  - Mutual exclusion of additionalEnv vs. structured config (prevents double-configuration)
  - Scaling config mutual exclusion (KEDA vs. HPA/VPA)

### Container Images

**Not applicable as a Helm chart** — the repository does not build container images. However, it references:
- `langfuse/langfuse` (web)
- `langfuse/langfuse-worker` (worker)
- `bitnamilegacy/postgresql` (subchart)
- `bitnamilegacy/clickhouse` (subchart)
- `bitnamilegacy/valkey` (subchart)
- `bitnamilegacy/minio` (subchart)
- `bitnamilegacy/zookeeper` (subchart dependency)

**Risk**: The migration to `bitnamilegacy/*` images (due to Bitnami's August 2025 registry restructuring) means these images may receive delayed or no security patches compared to the active `bitnami/*` images.

### Security

- **No security scanning**: No Trivy, Snyk, CodeQL, or any security scanning
- **No SBOM generation**: No software bill of materials
- **No Dependabot**: No automated dependency update scanning for subchart dependencies
- **Secret handling**: Values properly support `existingSecret` pattern for production deployments (good practice)
- **CODEOWNERS**: Single owner `@Steffen911` for all files

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: Everything — no test type rules, no chart conventions, no PR guidelines
- **Recommendation**: Generate rules with `/test-rules-generator` for Helm chart testing patterns

## Recommendations

### Priority 0 (Critical)

1. **Implement chart-testing (ct) with Kind cluster installation**
   - Add `ct.yaml` configuration
   - Create install test values for multiple scenarios (minimal, full, external DBs)
   - Test chart install + upgrade path
   - Effort: 8-12 hours
   - Example:
   ```yaml
   # ct.yaml
   chart-dirs:
     - charts
   target-branch: main
   helm-extra-args: --timeout 600s
   ```

2. **Add container image vulnerability scanning**
   - Add Trivy scanning for referenced images
   - Set up weekly scanning schedule
   - Configure fail thresholds for critical/high CVEs
   - Effort: 2-4 hours

### Priority 1 (High Value)

3. **Expand Helm unit test coverage**
   - Add tests for HPA, VPA, KEDA templates
   - Add tests for worker deployment variations
   - Add tests for secret templates (nextauth, postgresql)
   - Add tests for extra-manifests template
   - Test validation failure paths (negative tests)
   - Effort: 4-6 hours

4. **Add CI concurrency control and caching**
   - Add `concurrency` blocks to prevent duplicate runs
   - Cache Helm dependencies between runs
   - Effort: 1-2 hours

5. **Add Kubeconform manifest validation**
   - Validate generated manifests against Kubernetes schemas
   - Test multiple Kubernetes versions for compatibility
   - Effort: 2-3 hours

### Priority 2 (Nice-to-Have)

6. **Create agent rules for Helm chart contributions**
   - CLAUDE.md with chart structure, conventions, testing requirements
   - `.claude/rules/` for test patterns (helm-unittest syntax)
   - Effort: 2-3 hours

7. **Add pre-commit hooks**
   - yaml lint, helm-docs, schema validation
   - Effort: 1-2 hours

8. **Enable Dependabot for subchart dependencies**
   - Auto-detect updates to PostgreSQL, ClickHouse, Valkey, MinIO subcharts
   - Effort: 1 hour

9. **Add OpenSSF Scorecard or similar security baseline**
   - Effort: 2-3 hours

## Comparison to Gold Standards

| Feature | langfuse-k8s | odh-dashboard | notebooks | Best Practice |
|---------|-------------|---------------|-----------|---------------|
| Unit Tests | helm-unittest (9 suites) | Jest + Cypress | pytest | Framework-appropriate |
| Integration/E2E | None | Cypress E2E | Image testing | chart-testing + Kind |
| Build Validation | helm lint | Multi-mode builds | Multi-arch | ct install + upgrade |
| Coverage Tracking | None | Codecov | Codecov | Coverage enforcement |
| Security Scanning | None | Trivy + CodeQL | Trivy | Trivy + SBOM |
| CI/CD | 4 workflows | 15+ workflows | Periodic jobs | Comprehensive |
| Agent Rules | None | Comprehensive | None | Full test rules |
| Input Validation | Excellent (250+ lines) | Schema validation | N/A | Template validation |
| Auto Version Sync | Weekly (upstream) | N/A | N/A | Dependabot/Renovate |

## File Paths Reference

### CI/CD
- `.github/workflows/test.yaml` — Helm unit tests with JUnit reporting
- `.github/workflows/validate.yaml` — Helm lint + helm-docs validation
- `.github/workflows/release.yaml` — Chart packaging and release
- `.github/workflows/update-langfuse-version.yml` — Weekly upstream version sync

### Chart Structure
- `charts/langfuse/Chart.yaml` — Chart metadata and dependencies
- `charts/langfuse/values.yaml` — Default values (730+ lines)
- `charts/langfuse/values.lint.yaml` — Values for lint validation
- `charts/langfuse/templates/_helpers.tpl` — Template helpers (727 lines)
- `charts/langfuse/templates/validations.yaml` — Input validation (251 lines)

### Templates
- `charts/langfuse/templates/web/deployment.yaml` — Web deployment
- `charts/langfuse/templates/worker/deployment.yaml` — Worker deployment
- `charts/langfuse/templates/web/service.yaml` — Web service
- `charts/langfuse/templates/web/hpa.yaml` — Web HPA
- `charts/langfuse/templates/web/vpa.yaml` — Web VPA
- `charts/langfuse/templates/web/scaled-object.yaml` — Web KEDA ScaledObject
- `charts/langfuse/templates/ingress.yaml` — Ingress
- `charts/langfuse/templates/serviceaccount.yaml` — ServiceAccount

### Tests
- `charts/langfuse/tests/basic_test.yaml` — Basic rendering tests
- `charts/langfuse/tests/redis-cluster_test.yaml` — Redis mode tests (550 lines)
- `charts/langfuse/tests/ingress_test.yaml` — Ingress tests (188 lines)
- `charts/langfuse/tests/clickhouse-cluster_test.yaml` — ClickHouse tests
- `charts/langfuse/tests/downward-api_test.yaml` — Downward API tests

### Other
- `CODEOWNERS` — Single owner (@Steffen911)
- `examples/` — Example values files for installation
- `UPGRADE.md` — Upgrade documentation
- `TROUBLESHOOTING.md` — Troubleshooting guide
