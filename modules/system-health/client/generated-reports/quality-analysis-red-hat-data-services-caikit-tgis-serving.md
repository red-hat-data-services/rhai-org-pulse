---
repository: "red-hat-data-services/caikit-tgis-serving"
overall_score: 3.4
scorecard:
  - dimension: "Unit Tests"
    score: 1.0
    status: "No unit tests exist; only 97 lines of Python source code with zero test coverage"
  - dimension: "Integration/E2E"
    score: 5.0
    status: "Docker Compose smoke test and KServe Kind cluster E2E exist but are minimal"
  - dimension: "Build Integration"
    score: 5.0
    status: "PR builds Docker image and runs smoke tests; Konflux triggered by label/comment only"
  - dimension: "Image Testing"
    score: 4.0
    status: "Image built and smoke-tested on PR; no vulnerability scanning or SBOM generation"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling, no codecov integration, no coverage thresholds"
  - dimension: "CI/CD Automation"
    score: 5.0
    status: "5 workflows with PR/schedule triggers; good Dependabot setup; no caching or concurrency control"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules or test automation guidance"
critical_gaps:
  - title: "Zero unit test coverage"
    impact: "No regression detection for caikit runtime configuration or utility code"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No security scanning (Trivy, Snyk, CodeQL)"
    impact: "Container vulnerabilities and code security issues go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No coverage tracking or enforcement"
    impact: "Cannot measure test quality or enforce coverage thresholds on PRs"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No linting or static analysis"
    impact: "Code quality issues, type errors, and style inconsistencies not caught automatically"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "KServe E2E workflow disabled on PRs"
    impact: "KServe integration regressions not caught until weekly scheduled run"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No pre-commit hooks"
    impact: "No local quality gates before commits reach CI"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Catch CVEs in base images and dependencies before merge"
  - title: "Add Python linting with ruff"
    effort: "1-2 hours"
    impact: "Catch type errors, unused imports, and style issues in the 2 Python files"
  - title: "Re-enable KServe smoke test on PRs"
    effort: "30 minutes"
    impact: "Catch KServe integration regressions on every PR instead of weekly"
  - title: "Add concurrency control to PR workflow"
    effort: "30 minutes"
    impact: "Cancel stale CI runs, save compute resources"
  - title: "Create basic CLAUDE.md with project context"
    effort: "1-2 hours"
    impact: "Enable AI-assisted development with project-specific guidance"
recommendations:
  priority_0:
    - "Add container vulnerability scanning (Trivy) to the build-and-test PR workflow"
    - "Re-enable the KServe smoke test workflow on pull_request events"
    - "Add Python linting (ruff or flake8) and type checking (mypy) to CI"
  priority_1:
    - "Add unit tests for smoke-test.py and utils/convert.py"
    - "Integrate codecov or coveralls for coverage tracking"
    - "Add SBOM generation to container builds"
    - "Create CLAUDE.md and .claude/rules/ for agent-assisted development"
  priority_2:
    - "Add pre-commit hooks for local quality gates"
    - "Add multi-architecture image testing (arm64 validation)"
    - "Add gRPC endpoint testing to KServe smoke test"
    - "Add image signing with cosign/sigstore"
---

# Quality Analysis: caikit-tgis-serving

## Executive Summary

- **Overall Score: 3.4/10**
- **Repository Type**: Python container image / KServe ServingRuntime for LLM inference
- **Primary Language**: Python (97 LOC across 2 source files)
- **Key Strengths**: Docker Compose smoke test with real inference validation, KServe Kind cluster E2E test, Dependabot with auto-approve, Konflux/Tekton PR pipeline, multi-arch build support
- **Critical Gaps**: Zero unit tests, no security scanning, no coverage tracking, no linting, KServe E2E disabled on PRs, no agent rules
- **Agent Rules Status**: Missing

This is a lightweight container image project that bundles Caikit + TGIS for KServe-based LLM inference. The codebase is minimal (97 lines of Python), but the testing and quality infrastructure has significant gaps. The smoke tests that do exist are well-designed (real inference validation via gRPC and HTTP), but there is no unit testing, no security scanning, no code quality tooling, and the KServe E2E workflow has been disabled on PRs (only runs weekly).

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 1/10 | No unit tests; zero test-to-code ratio |
| Integration/E2E | 5/10 | Compose smoke test + KServe Kind E2E (disabled on PRs) |
| **Build Integration** | **5/10** | **PR builds image + runs smoke test; Konflux on label only** |
| Image Testing | 4/10 | Image built and smoke-tested; no vuln scanning or SBOM |
| Coverage Tracking | 0/10 | No coverage tooling whatsoever |
| CI/CD Automation | 5/10 | 5 workflows; no caching, no concurrency control |
| Agent Rules | 0/10 | No CLAUDE.md, no .claude/ directory |

## Critical Gaps

### 1. Zero Unit Test Coverage
- **Impact**: No regression detection for configuration parsing, utility functions, or test helper logic
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The repository has 2 Python source files (`test/smoke-test.py` at 73 lines and `utils/convert.py` at 24 lines) with zero unit tests. While the codebase is small, the `smoke-test.py` file contains async test logic, retry mechanisms, and protocol-specific clients that should be unit-tested independently of the full stack.

### 2. No Security Scanning
- **Impact**: Container image vulnerabilities and Python dependency CVEs go completely undetected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No Trivy, Snyk, or CodeQL integration. The Dockerfile uses `ubi9/ubi-minimal:latest` as base image and installs packages with `microdnf` and `pip` without any vulnerability scanning. Dependabot covers dependency updates but not vulnerability scanning of the built image.

### 3. No Coverage Tracking
- **Impact**: No visibility into test coverage levels; no ability to enforce coverage thresholds
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: No `.codecov.yml`, no `.coveragerc`, no coverage generation in any workflow. Even when unit tests are added, there's no infrastructure to track or enforce coverage.

### 4. KServe E2E Workflow Disabled on PRs
- **Impact**: KServe integration regressions only caught on weekly scheduled run, not on PRs
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: The `kserve-test.yml` workflow has `push` and `pull_request` triggers commented out (lines 8-14). This means KServe-specific regressions (ServingRuntime, InferenceService deployment, model loading) are only caught weekly. The `build-and-test.yml` does include a KServe smoke test step, but having the dedicated workflow also run on PRs would provide additional coverage with the standalone KServe setup.

### 5. No Linting or Static Analysis
- **Impact**: Code quality issues, type errors, and Python anti-patterns not caught
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: No `ruff.toml`, `.flake8`, `mypy.ini`, or any Python linting configuration. No pre-commit hooks. The `pyproject.toml` only defines Poetry dependencies, no tool configurations.

### 6. No Agent Rules
- **Impact**: AI-assisted development has no project-specific context or test creation guidance
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: No `CLAUDE.md`, no `.claude/` directory, no `AGENTS.md`. This means AI agents have no guidance on project architecture, testing patterns, or contribution standards.

## Quick Wins

### 1. Add Trivy Container Scanning (1-2 hours)
Add a Trivy step to the `build-and-test.yml` workflow after image build:
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    input: /tmp/image.tar
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'

- name: Upload Trivy scan results
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: 'trivy-results.sarif'
```

### 2. Add Python Linting with Ruff (1-2 hours)
Add a lint job to the PR workflow:
```yaml
lint:
  name: Lint
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: astral-sh/ruff-action@v3
```

And add to `pyproject.toml`:
```toml
[tool.ruff]
target-version = "py311"
select = ["E", "F", "I", "UP", "B", "SIM"]
```

### 3. Re-enable KServe Smoke Test on PRs (30 minutes)
Uncomment the `push` and `pull_request` triggers in `.github/workflows/kserve-test.yml` (lines 8-14).

### 4. Add Concurrency Control (30 minutes)
Add to both PR-triggered workflows:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

### 5. Create CLAUDE.md (1-2 hours)
Create a basic `CLAUDE.md` with project context, build instructions, and test patterns to enable AI-assisted development.

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (5 workflows):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build-and-test.yml` | PR, push to main, weekly, manual | Build image + compose smoke test + KServe smoke test |
| `kserve-test.yml` | Weekly, manual (PR/push **disabled**) | Standalone KServe Kind cluster E2E test |
| `dependabot-autoapprove.yaml` | PR (dependabot only) | Auto-approve dependabot PRs |
| `pr-close-image-delete.yaml` | PR closed | Delete PR image from Quay registry |
| `run-update.yml` | Weekly, manual | Update poetry lock files and create PR |

**Strengths:**
- `build-and-test.yml` has a well-structured 3-job pipeline: build-image → compose-smoke-test → kserve-smoke-test
- Image artifact passing between jobs via `actions/upload-artifact`/`actions/download-artifact`
- Docker Buildx setup for efficient builds
- Disk space cleanup for CI runners
- Automated poetry lock file updates

**Gaps:**
- No concurrency control on any workflow (stale runs waste resources)
- No build caching (Docker layer cache, pip cache)
- No workflow status badges
- KServe standalone test disabled on PRs

### Test Coverage

**Test Infrastructure:**
- **Compose Smoke Test** (`test/compose/smoke-test.sh`): Builds image, starts caikit + TGIS via Docker Compose, converts a model, runs inference via gRPC and HTTP. Well-structured with error handling and CI-specific optimizations.
- **Python Smoke Test** (`test/smoke-test.py`): 73-line async test that validates gRPC and HTTP inference endpoints with retry logic. Supports both local (Docker Compose) and KServe (InferenceService URL) modes.
- **KServe E2E** (`test/kserve/`): Kind cluster setup, KServe installation, model volume provisioning, ServingRuntime/InferenceService deployment, HTTP inference validation.

**Test-to-Code Ratio**: 73 test lines / 24 source lines = 3.04 (misleadingly high because the "source" is minimal; the actual caikit runtime code comes from pip dependencies)

**What's Missing:**
- Zero unit tests for any Python code
- No gRPC testing in KServe E2E (noted as TODO in `smoke-test.py` line 69)
- No negative test cases (error handling, invalid inputs, timeouts)
- No load testing or performance validation
- No multi-model testing

### Code Quality

**Current State:**
- No linting configuration (no ruff, flake8, mypy, pylint)
- No pre-commit hooks
- No type annotations in Python code
- No code formatting enforcement (no black, isort, yapf)
- `pyproject.toml` only has Poetry build config, no tool sections
- `.gitignore` is minimal (IDE files only)
- `.dockerignore` only excludes venv directories

**Positive:**
- Well-structured Dockerfiles with multi-stage builds
- Non-root user in container (security best practice)
- OWNERS file for review governance

### Container Images

**Build Process:**
- Two Dockerfiles: `Dockerfile` (upstream) and `Dockerfile.konflux` (downstream with RHEL labels)
- Multi-stage build: `poetry-builder` → `deploy`
- Base image: `ubi9/ubi-minimal:latest` (Red Hat certified)
- Non-root user execution (UID 1001)
- Poetry-based dependency management with lockfile

**Konflux/Tekton Integration:**
- `.tekton/caikit-tgis-serving-pull-request.yaml` defines a PipelineRun for PR builds
- Triggered by label (`kfbuild-caikit-tgis-serving`) or comment (`/build-konflux`), not automatically
- Multi-arch support: `linux/x86_64` and `linux-m2xlarge/arm64`
- Image expires after 5 days for PR builds
- References central Konflux pipeline from `red-hat-data-services/konflux-central`

**Gaps:**
- No Trivy/Snyk vulnerability scanning
- No SBOM generation
- No image signing (cosign/sigstore)
- No image size optimization tracking
- Konflux builds not automatic on PRs (require label/comment trigger)

### Security

**Current State:**
- Dependabot enabled for pip, Docker, and GitHub Actions dependencies (daily/weekly)
- Dependabot auto-approve workflow (potential security concern - auto-approves ALL dependabot PRs without review)
- Non-root container user
- UBI9 base image (RHEL certified)

**Missing:**
- No CodeQL/SAST integration
- No container vulnerability scanning (Trivy, Snyk, Grype)
- No secret detection (Gitleaks, TruffleHog)
- No dependency audit (pip-audit, safety)
- No `.gitleaks.toml` or `.trivyignore`
- Dependabot auto-approve is overly permissive (should check update type)

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None - no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: Complete absence of agent rules means AI-assisted development has no project-specific guidance for:
  - Project architecture and component relationships
  - Testing patterns and standards
  - Build and deployment procedures
  - Code style and conventions
- **Recommendation**: Generate test creation rules with `/test-rules-generator` and create a `CLAUDE.md` with project context

## Recommendations

### Priority 0 (Critical)

1. **Add container vulnerability scanning** - Integrate Trivy into the `build-and-test.yml` workflow to scan the built image before it's used in smoke tests. This catches CVEs in base images and pip dependencies.

2. **Re-enable KServe smoke test on PRs** - Uncomment the `push` and `pull_request` triggers in `kserve-test.yml`. The build-and-test workflow has a KServe step, but the standalone workflow provides independent validation.

3. **Add Python linting and type checking** - Add ruff (linting) and mypy (type checking) to the CI pipeline. Even with only 2 Python files, this establishes the foundation for quality as the codebase grows.

4. **Fix Dependabot auto-approve** - The current auto-approve workflow approves ALL dependabot PRs regardless of update type. Add a condition to only auto-approve patch-level updates:
   ```yaml
   if: steps.metadata.outputs.update-type == 'version-update:semver-patch'
   ```

### Priority 1 (High Value)

1. **Add unit tests** - Write unit tests for `test/smoke-test.py` (testing the retry logic, async flow, client creation) and `utils/convert.py` (model conversion paths) using pytest.

2. **Integrate coverage tracking** - Add `.coveragerc` configuration and integrate codecov/coveralls into the CI pipeline with a minimum coverage threshold.

3. **Add SBOM generation** - Generate Software Bill of Materials during image builds using syft or trivy for supply chain security.

4. **Create agent rules** - Create `CLAUDE.md` and `.claude/rules/` directory with test creation patterns, project architecture overview, and contribution guidelines.

5. **Add gRPC testing to KServe E2E** - The TODO at `test/smoke-test.py:69` notes gRPC testing is not implemented for KServe mode.

### Priority 2 (Nice-to-Have)

1. **Add pre-commit hooks** - Set up `.pre-commit-config.yaml` with ruff, mypy, and trailing whitespace checks for local quality gates.

2. **Add multi-arch image validation** - The Konflux pipeline builds for x86_64 and arm64, but no tests validate the arm64 image actually works.

3. **Add image signing** - Implement cosign/sigstore signing for built images to enable verification in deployment pipelines.

4. **Add load testing** - Add basic inference performance testing to catch latency regressions.

5. **Add build caching** - Add Docker layer caching and pip caching to speed up CI runs.

## Comparison to Gold Standards

| Dimension | caikit-tgis-serving | odh-dashboard | notebooks | kserve |
|-----------|-------------------|---------------|-----------|--------|
| Unit Tests | 0/10 - None | 9/10 - Comprehensive Jest | 6/10 - Notebook validation | 9/10 - Go testing |
| Integration/E2E | 5/10 - Smoke tests only | 9/10 - Multi-layer + Cypress | 8/10 - Multi-image E2E | 9/10 - Kind-based E2E |
| Build Integration | 5/10 - PR build + smoke | 8/10 - Multi-mode builds | 7/10 - Image pipeline | 8/10 - Multi-version |
| Image Testing | 4/10 - Basic smoke only | 7/10 - Container validation | 9/10 - 5-layer validation | 7/10 - Runtime checks |
| Coverage Tracking | 0/10 - None | 8/10 - Codecov enforced | 5/10 - Partial | 9/10 - Thresholds |
| CI/CD Automation | 5/10 - Basic workflows | 9/10 - Full pipeline | 8/10 - Automated E2E | 9/10 - Comprehensive |
| Agent Rules | 0/10 - None | 8/10 - Comprehensive rules | 3/10 - Basic | 5/10 - Partial |
| **Overall** | **3.4/10** | **8.3/10** | **6.6/10** | **8.0/10** |

## File Paths Reference

### CI/CD Configuration
- `.github/workflows/build-and-test.yml` - Main PR/push workflow (build + smoke tests)
- `.github/workflows/kserve-test.yml` - Standalone KServe E2E (disabled on PRs)
- `.github/workflows/dependabot-autoapprove.yaml` - Auto-approve dependabot PRs
- `.github/workflows/pr-close-image-delete.yaml` - Clean up PR images from Quay
- `.github/workflows/run-update.yml` - Weekly poetry lock file update
- `.tekton/caikit-tgis-serving-pull-request.yaml` - Konflux/Tekton PR pipeline

### Test Infrastructure
- `test/smoke-test.py` - Python smoke test (gRPC + HTTP inference validation)
- `test/compose/smoke-test.sh` - Docker Compose smoke test orchestrator
- `test/compose/docker-compose.yml` - Compose config for local testing
- `test/compose/caikit_config/` - Test-specific Caikit configuration
- `test/kserve/caikit-tgis-serving.yaml` - KServe ServingRuntime + InferenceService
- `test/kserve/kind_config.yaml` - Kind cluster configuration
- `test/kserve/setup.yaml` - Model volume provisioning

### Container Images
- `Dockerfile` - Upstream multi-stage build
- `Dockerfile.konflux` - Downstream (RHOAI) build with RHEL labels
- `.dockerignore` - Docker build context exclusions

### Project Configuration
- `pyproject.toml` - Poetry dependencies (caikit, caikit-nlp, caikit-tgis-backend)
- `poetry.lock` - Locked dependency versions
- `caikit.yml` - Caikit runtime configuration
- `Makefile` - Local build and shell targets
- `OWNERS` - Review governance
- `.github/dependabot.yml` - Dependabot configuration
