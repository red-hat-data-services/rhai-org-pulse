---
repository: "opendatahub-io/llama-stack-distribution"
overall_score: 7.4
scorecard:
  - dimension: "Unit Tests"
    score: 2.0
    status: "No unit tests exist; repo is primarily configuration and shell scripts"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "Strong multi-provider integration tests with upstream pytest suite and OpenShift showroom E2E"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time image build + smoke/integration on PR; Tekton/Konflux for production builds"
  - dimension: "Image Testing"
    score: 8.0
    status: "Multi-arch builds (amd64/arm64), smoke tests validate container startup, inference, and DB"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tool integration (codecov, coveralls); no coverage thresholds"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "Excellent workflow organization with concurrency, caching, nightly runs, auto-version updates"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, .claude/, or AGENTS.md; no AI agent guidance for testing"
critical_gaps:
  - title: "No unit tests for Python build/utility scripts"
    impact: "919 lines of Python (build.py, junit scripts) have zero test coverage — regressions discovered only in CI"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "No coverage tracking or enforcement"
    impact: "No visibility into what code paths are tested; impossible to set quality gates"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No security scanning (Trivy, Snyk, CodeQL)"
    impact: "Container image and dependency vulnerabilities not detected until downstream pipelines"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No agent rules for AI-assisted development"
    impact: "AI agents generating code have no guidance on testing patterns, PR conventions, or repo structure"
    severity: "LOW"
    effort: "3-5 hours"
  - title: "Integration tests rely on cloning upstream repo at runtime"
    impact: "Test reproducibility depends on external git state; version pinning mitigates but doesn't eliminate risk"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Early detection of CVEs in container images and dependencies before merge"
  - title: "Add CodeQL or Semgrep SAST scanning"
    effort: "1-2 hours"
    impact: "Catch security issues in Python/shell scripts automatically"
  - title: "Create CLAUDE.md with testing guidance"
    effort: "2-3 hours"
    impact: "Improve AI-generated contribution quality and test consistency"
  - title: "Add pytest for distribution/build.py"
    effort: "4-6 hours"
    impact: "Prevent regressions in the Containerfile generation pipeline"
recommendations:
  priority_0:
    - "Add container vulnerability scanning (Trivy) to the PR workflow — this is a distribution image shipped to production"
    - "Add SAST scanning (CodeQL or Semgrep) for Python and shell scripts"
  priority_1:
    - "Write unit tests for distribution/build.py (481 LOC) and scripts/*.py (438 LOC)"
    - "Add coverage tracking with pytest-cov and codecov integration"
    - "Create agent rules (.claude/rules/) for contribution and testing patterns"
  priority_2:
    - "Add SBOM generation to container builds"
    - "Pin the Tekton/Konflux pipeline reference to a specific commit for reproducibility"
    - "Add image signing/attestation for published images"
---

# Quality Analysis: llama-stack-distribution (ogx-distribution)

## Executive Summary

- **Overall Score: 7.4/10**
- **Repository Type**: Container distribution / Python configuration (OGX/Llama Stack distro image)
- **Primary Languages**: Shell (625 LOC), Python (919 LOC), YAML configs
- **Key Strengths**: Excellent CI/CD automation, comprehensive multi-provider integration testing, multi-arch container builds with PR-time validation, well-organized reusable GitHub Actions, thorough testing documentation
- **Critical Gaps**: No security scanning, no unit tests for Python scripts, no coverage tracking, no agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 2.0/10 | No unit tests; repo is primarily config/scripts |
| Integration/E2E | 8.5/10 | Strong multi-provider integration + OpenShift E2E |
| **Build Integration** | **7.0/10** | **PR-time image build + smoke/integration; Tekton for prod** |
| Image Testing | 8.0/10 | Multi-arch builds, smoke tests validate startup + inference + DB |
| Coverage Tracking | 1.0/10 | No coverage tool; no thresholds or enforcement |
| CI/CD Automation | 9.0/10 | Excellent: concurrency, caching, nightly, auto-version updates |
| Agent Rules | 0.0/10 | No AI agent guidance whatsoever |

**Weighted Overall: 7.4/10** (Unit 20%, Integration/E2E 25%, Image 20%, Coverage 15%, CI/CD 20%)

## Critical Gaps

### 1. No Security Scanning
- **Impact**: The repo builds and publishes container images to `quay.io/opendatahub/odh-ogx-core` — a production artifact. No Trivy, Snyk, CodeQL, or dependency scanning exists in any workflow.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Note**: Downstream Konflux pipelines may include scanning, but shift-left is critical for this repo.

### 2. No Unit Tests for Python Scripts
- **Impact**: `distribution/build.py` (481 LOC) generates the Containerfile from templates. `scripts/junit_to_history.py` (73 LOC) and `scripts/junit_stats.py` (88 LOC) process test results. `scripts/gen_distro_docs.py` (277 LOC) generates distribution docs. None have tests.
- **Severity**: MEDIUM
- **Effort**: 8-12 hours

### 3. No Coverage Tracking
- **Impact**: No codecov, coveralls, or pytest-cov integration. No PR coverage gates. Impossible to quantify what the integration tests actually cover.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours

### 4. Integration Test Reproducibility Risk
- **Impact**: `run_integration_tests.sh` clones the upstream `ogx` repo at runtime and checks out a version tag extracted from the Containerfile. While the version is pinned, the clone is from an external repo each CI run.
- **Severity**: MEDIUM
- **Effort**: 4-6 hours (could vendor test dependencies or use a git submodule)

### 5. No Agent Rules
- **Impact**: No `.claude/`, `CLAUDE.md`, or `AGENTS.md`. AI agents contributing to this repo have zero guidance on testing patterns, code style expectations, or PR conventions.
- **Severity**: LOW
- **Effort**: 3-5 hours

## Quick Wins

### 1. Add Trivy Container Scanning (1-2 hours)
Add a step to the `redhat-distro-container.yml` workflow after the image build:
```yaml
- name: Scan container image
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.IMAGE_NAME }}:${{ github.sha }}
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
```

### 2. Add CodeQL SAST (1-2 hours)
Create `.github/workflows/codeql.yml` with Python and Actions analysis enabled.

### 3. Create CLAUDE.md (2-3 hours)
Add testing guidance, repo structure overview, and contribution patterns for AI agents.

### 4. Add pytest for build.py (4-6 hours)
Create `tests/test_build.py` with tests for Containerfile generation, version extraction, and template rendering.

## Detailed Findings

### CI/CD Pipeline

**Strengths (Score: 9.0/10)**:
- **13 workflow files** covering builds, tests, responses testing, version automation, and housekeeping
- **Concurrency control** on all workflows with `cancel-in-progress: true`
- **GHA build caching** (`cache-from: type=gha`) on container builds
- **Multi-arch builds** (amd64/arm64) running in parallel via matrix strategy
- **Nightly schedule** testing `main` branch of upstream OGX at 6 AM UTC
- **Automated version updates** via `repository_dispatch` from upstream OGX releases
- **Reusable composite actions** for vLLM, PostgreSQL, and server setup
- **Slack notifications** on build failures/successes
- **Mergify** for automated PR merging with conditional checks based on changed paths
- **Dependabot** for GitHub Actions, Python (uv), and Docker (vLLM) dependency updates
- **Semantic PR title enforcement** via `amannn/action-semantic-pull-request`
- **Stale bot** for issue/PR lifecycle management
- **PR template** requiring test plans

**Minor gaps**:
- No build matrix for different Python versions (single Python 3.12)
- The `vllm-cpu-container.yml` and `redhat-distro-container.yml` have some logic duplication that could be extracted into shared workflows

### Test Coverage

**Smoke Tests (tests/smoke.sh — 303 LOC)**:
- Container startup with health check polling (60s timeout)
- Model registration verification (`/v1/models`)
- OpenAI-compatible chat completion inference (`/v1/chat/completions`)
- PostgreSQL table creation verification (`ogx_kvstore`, `inference_store`)
- PostgreSQL data population validation
- File processor (pypdf) validation with fixture PDF
- Multi-provider testing: vLLM, Vertex AI, OpenAI, Gemini (credential-gated)
- Failure tracking with detailed error reporting

**Integration Tests (tests/run_integration_tests.sh — 145 LOC)**:
- Clones upstream OGX repo at the pinned version
- Runs `pytest tests/integration/inference/` from upstream
- Tests across all available providers (vLLM, Vertex AI, OpenAI, Gemini)
- Well-documented skip list with linked upstream issues

**Responses API Tests (weekly)**:
- Orchestrated by `responses-weekly.yml`
- Tests across OpenAI, Vertex AI, and vLLM MaaS providers
- JUnit XML result collection
- Interactive HTML test report published to GitHub Pages
- Historical trend tracking via `junit_to_history.py`

**OpenShift Showroom E2E (test-pr-in-showroom.yml)**:
- Full operator deployment on real OpenShift cluster
- Image pushed to OpenShift internal registry
- Full setup → provision → test → unprovision → cleanup lifecycle
- Manual/daily trigger for validation

**Unit Tests**: None exist. The repository has no `*_test.py`, `test_*.py`, or `*_test.sh` files.

### Code Quality

**Pre-commit Configuration (Score: 8.5/10)** — Comprehensive setup:
- **Ruff**: Python linting and formatting (v0.9.4)
- **ShellCheck**: Shell script static analysis (v0.11.0.1)
- **Actionlint**: GitHub Actions workflow validation (v1.7.11)
- **Standard hooks**: merge conflict detection, trailing whitespace, large file checks (1MB limit), YAML/JSON/TOML validation, executable shebangs, private key detection, mixed line ending enforcement (LF), symlink checks
- **Custom hooks**: `pkg-gen` (Containerfile generation) and `doc-gen` (distribution docs)
- **No-commit-to-branch**: Prevents direct commits to protected branches
- **CI enforcement**: Pre-commit workflow verifies no diffs or new files after hooks run

**Missing**:
- No `mypy` or type checking
- No `bandit` for Python security linting

### Container Images

**Distribution Image (Score: 8.0/10)**:
- Base: `registry.access.redhat.com/ubi9/python-312` (pinned by SHA digest)
- Template-based generation via `Containerfile.in` + `build.py`
- Auto-generated with pre-commit hooks — prevents manual drift
- Multi-arch support (amd64/arm64)
- Published to `quay.io/opendatahub/odh-ogx-core`
- Version tracking via `distribution/versions.env`
- PR-time image build + smoke test + integration test validation

**vLLM CPU Image**:
- Based on `vllm/vllm-openai-cpu:v0.22.0`
- Pre-bundles inference and embedding models
- Multi-arch with digest-based publishing
- PR-time build validation with vLLM startup tests

**Tekton/Konflux Integration**:
- `.tekton/odh-ogx-core-pull-request.yaml` — PR builds via Konflux
- `.tekton/odh-ogx-core-push.yaml` — Push builds via Konflux
- References centralized pipeline from `odh-konflux-central` repo
- Mergify reminds contributors to sync Konflux Dockerfile when `Containerfile.in` changes

**Missing**:
- No Trivy/vulnerability scanning
- No SBOM generation
- No image signing/attestation
- No `.dockerignore` (though build context is small)

### Security

**Score: 3.0/10** — Significant gaps:

**Present**:
- `detect-private-key` pre-commit hook
- Pinned GitHub Actions by SHA (not tag)
- Secret validation before use in CI (credential presence checks)
- Fork/Dependabot PR handling (secrets stripped)
- Minimal permissions model in workflows
- Input validation in `update-ogx-version.yml` (tag format, source URL pattern)

**Missing**:
- No container vulnerability scanning (Trivy, Snyk, Grype)
- No SAST (CodeQL, Semgrep, gosec)
- No dependency vulnerability scanning beyond Dependabot security alerts
- No secret scanning (Gitleaks, TruffleHog)
- No SBOM generation
- No image signing
- No `.trivyignore` or vulnerability management policy

### Agent Rules (Agentic Flow Quality)

**Score: 0.0/10** — Completely absent:

- **Status**: Missing
- **Coverage**: No test type rules exist
- **Quality**: N/A
- **Gaps**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory. No testing documentation beyond `tests/README.md` (which is excellent for human contributors but not formatted as agent rules).
- **Recommendation**: Generate agent rules with `/test-rules-generator`. The existing `tests/README.md` provides a strong foundation to build from.

## Recommendations

### Priority 0 (Critical)

1. **Add container vulnerability scanning** — This repo builds and publishes production container images. Add Trivy scanning to the `redhat-distro-container.yml` PR workflow. Consider both image scanning and filesystem scanning.

2. **Add SAST scanning** — Create a CodeQL workflow for Python analysis. The 919 LOC of Python in this repo handles Containerfile generation, test result processing, and documentation generation — all important to keep secure.

### Priority 1 (High Value)

3. **Write unit tests for `distribution/build.py`** — This is the most critical Python file (481 LOC) — it generates the Containerfile that becomes the production image. Test version extraction, template rendering, dependency resolution, and edge cases.

4. **Add pytest-cov and codecov integration** — Even with limited Python code, tracking coverage of the integration test suite against the OGX server would provide valuable signal.

5. **Create agent rules** — Add `.claude/rules/` with guidance on:
   - Shell script testing patterns (smoke test structure)
   - Integration test skip list management
   - Containerfile template changes requiring pre-commit
   - PR convention (semantic titles, test plan requirement)

### Priority 2 (Nice-to-Have)

6. **Add SBOM generation** — Generate and attach SBOMs to published container images for supply chain transparency.

7. **Pin Tekton pipeline reference** — The Konflux pipeline references `main` branch of `odh-konflux-central` — consider pinning to a specific commit for reproducibility.

8. **Add image signing** — Sign published images with Cosign for verification in deployment pipelines.

9. **Add `.dockerignore`** — Exclude `.git/`, `docs/`, `scripts/`, and test fixtures from the container build context.

10. **Vendor integration test dependencies** — Instead of cloning upstream OGX at runtime, consider using a git submodule or vendored test fixtures for better reproducibility.

## Comparison to Gold Standards

| Dimension | llama-stack-distribution | odh-dashboard (Gold) | notebooks (Gold) | kserve (Gold) |
|-----------|------------------------|---------------------|-----------------|--------------|
| Unit Tests | 2.0 — None | 9.0 — Jest + RTL | 6.0 — Selective | 8.5 — Go testing |
| Integration/E2E | 8.5 — Multi-provider | 9.0 — Cypress + contracts | 7.0 — Image validation | 9.0 — envtest + Kind |
| Build Integration | 7.0 — PR image build + tests | 8.0 — Full Konflux sim | 8.0 — Multi-layer | 7.0 — Basic |
| Image Testing | 8.0 — Multi-arch + smoke | 7.0 — Basic | 9.5 — 5-layer validation | 6.0 — Basic |
| Coverage Tracking | 1.0 — None | 8.0 — Codecov + gates | 3.0 — Limited | 8.5 — Codecov enforced |
| CI/CD Automation | 9.0 — Excellent | 9.0 — Comprehensive | 8.0 — Solid | 8.5 — Well-organized |
| Security Scanning | 3.0 — Minimal | 7.0 — CodeQL + Trivy | 8.0 — Trivy + SBOM | 7.0 — CodeQL |
| Agent Rules | 0.0 — None | 8.0 — Comprehensive | 2.0 — Basic | 3.0 — Limited |
| **Overall** | **7.4** | **8.5** | **7.5** | **7.8** |

**Notable strengths relative to gold standards**:
- CI/CD automation is on par with the best (9.0)
- Integration testing across 4+ LLM providers is unique and thorough
- Weekly Responses API test reports with historical trends published to GitHub Pages
- Automated version update pipeline from upstream releases
- OpenShift Showroom E2E testing on real cluster infrastructure

## File Paths Reference

### CI/CD
- `.github/workflows/redhat-distro-container.yml` — Main build/test/publish pipeline
- `.github/workflows/pre-commit.yml` — Linting and validation
- `.github/workflows/semantic-pr.yml` — PR title enforcement
- `.github/workflows/test-pr-in-showroom.yml` — OpenShift E2E testing
- `.github/workflows/responses-weekly.yml` — Weekly multi-provider test report
- `.github/workflows/responses-openai.yml` — OpenAI provider tests
- `.github/workflows/responses-vertexai.yml` — Vertex AI provider tests
- `.github/workflows/responses-vllm-maas.yml` — vLLM MaaS provider tests
- `.github/workflows/vllm-cpu-container.yml` — vLLM CPU image build/test
- `.github/workflows/update-ogx-version.yml` — Automated version updates
- `.github/workflows/stale_bot.yml` — Issue/PR lifecycle management
- `.github/mergify.yml` — Auto-merge rules
- `.github/dependabot.yml` — Dependency updates
- `.tekton/odh-ogx-core-pull-request.yaml` — Konflux PR pipeline
- `.tekton/odh-ogx-core-push.yaml` — Konflux push pipeline

### Testing
- `tests/smoke.sh` — Container smoke tests (303 LOC)
- `tests/run_integration_tests.sh` — Integration test runner (145 LOC)
- `tests/test_utils.sh` — Shared test utilities (10 LOC)
- `tests/fixtures/sample.pdf` — PDF processor test fixture
- `tests/README.md` — Comprehensive testing documentation

### Container Images
- `distribution/Containerfile` — Auto-generated production Containerfile
- `distribution/Containerfile.in` — Containerfile template
- `distribution/build.py` — Containerfile generator (481 LOC)
- `distribution/config.yaml` — OGX runtime configuration
- `distribution/build.yaml` — OGX build configuration
- `distribution/versions.env` — Version tracking
- `distribution/entrypoint.sh` — Container entrypoint
- `vllm/Containerfile` — vLLM CPU image

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks (ruff, shellcheck, actionlint, etc.)
- `.github/CODEOWNERS` — Code ownership rules
- `.github/PULL_REQUEST_TEMPLATE.md` — PR template with test plan requirement

### Reusable Actions
- `.github/actions/setup-vllm/action.yml` — vLLM container setup
- `.github/actions/setup-postgres/action.yml` — PostgreSQL container setup
- `.github/actions/setup-server/action.yml` — OGX server setup with health check
- `.github/actions/free-disk-space/action.yml` — Disk space cleanup
- `.github/actions/notify-slack/notify.sh` — Slack notification helper
