---
repository: "red-hat-data-services/vllm-rocm"
overall_score: 2.3
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No source code or test files — thin Dockerfile wrapper repo"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E test infrastructure"
  - dimension: "Build Integration"
    score: 6.0
    status: "Tekton PipelineRun for Konflux PR builds with cancel-in-progress"
  - dimension: "Image Testing"
    score: 3.0
    status: "Single Dockerfile from UBI base, no runtime validation or health checks"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage configuration — no tests to measure"
  - dimension: "CI/CD Automation"
    score: 4.0
    status: "Tekton PR pipeline with label/comment triggers, no GitHub workflows"
  - dimension: "Static Analysis"
    score: 5.0
    status: "Comprehensive pre-commit config inherited from upstream, but no repo source to lint"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No container image runtime validation"
    impact: "Image startup failures, broken entrypoints, or missing dependencies not caught until deployment"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No smoke test for built image"
    impact: "Konflux builds produce an image but never verify it starts or responds on expected ports"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "skip-checks: true in Tekton pipeline"
    impact: "Quality gates bypassed — image checks and validations are skipped on every PR build"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No Dependabot or Renovate for Dockerfile base image updates"
    impact: "Base image version (RHAIIS_VERSION) requires manual tracking for security and compatibility updates"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add a container smoke test step to the Tekton pipeline"
    effort: "4-6 hours"
    impact: "Validates image starts and vllm_tgis_adapter entrypoint responds before merging"
  - title: "Enable Dependabot for Dockerfile base image tracking"
    effort: "1-2 hours"
    impact: "Automated PRs when registry.redhat.io/rhaiis/vllm-rocm-rhel9 releases new versions"
  - title: "Add HEALTHCHECK to Dockerfile"
    effort: "30 minutes"
    impact: "Container orchestrators can detect unhealthy instances and restart automatically"
  - title: "Create basic CLAUDE.md with repo context and build instructions"
    effort: "1-2 hours"
    impact: "AI agents understand this is a thin wrapper repo and produce appropriate contributions"
  - title: "Remove skip-checks: true or add justification comment"
    effort: "30 minutes"
    impact: "Enables Konflux quality gates on PR builds"
recommendations:
  priority_0:
    - "Add container image runtime validation — verify the built image starts and the vllm_tgis_adapter entrypoint is functional"
    - "Evaluate whether skip-checks: true is intentional or a leftover; re-enable checks if possible"
  priority_1:
    - "Add a .dockerignore to exclude .git/ and other unneeded files from build context"
    - "Add Dependabot configuration for Dockerfile base image version tracking"
    - "Add HEALTHCHECK instruction to Dockerfile.konflux.rocm"
  priority_2:
    - "Create CLAUDE.md documenting this repo's role as a downstream Dockerfile wrapper"
    - "Consider adding a Makefile or script for local image builds to aid development"
    - "Add a .github/CODEOWNERS file for build/Dockerfile review assignment"
---

# Quality Analysis: red-hat-data-services/vllm-rocm

## Executive Summary

- **Overall Score: 2.3/10**
- **Repository Type**: Thin downstream Dockerfile wrapper (Konflux build configuration)
- **Primary Language**: None (Dockerfile + YAML only)
- **Jira**: RHOAIENG / llm-d (downstream tier)
- **Key Strengths**: Tekton Konflux pipeline with PR triggers, UBI-based image (FIPS-capable), comprehensive upstream pre-commit config
- **Critical Gaps**: No image runtime validation, no smoke tests, quality checks skipped in pipeline, no dependency tracking
- **Agent Rules Status**: Missing

### Context

This repository is a **thin downstream wrapper** — it contains only a single-stage Dockerfile (`Dockerfile.konflux.rocm`) that builds from the Red Hat AI Inference Service base image (`registry.redhat.io/rhaiis/vllm-rocm-rhel9`). All actual vLLM source code, tests, and development tooling live upstream in `vllm-project/vllm`. The low overall score reflects the wrapper nature of the repo, but several meaningful improvements are still possible within its scope.

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 0/10 | 15% | 0.00 | No source code or test files |
| Integration/E2E | 0/10 | 20% | 0.00 | No integration or E2E test infrastructure |
| Build Integration | 6/10 | 15% | 0.90 | Tekton PR pipeline with Konflux integration |
| Image Testing | 3/10 | 10% | 0.30 | Single Dockerfile, no runtime validation |
| Coverage Tracking | 0/10 | 10% | 0.00 | No coverage configuration |
| CI/CD Automation | 4/10 | 15% | 0.60 | Tekton pipeline, no GitHub workflows |
| Static Analysis | 5/10 | 10% | 0.50 | Pre-commit config present but unused |
| Agent Rules | 0/10 | 5% | 0.00 | No agent configuration |
| **Overall** | **2.3/10** | **100%** | **2.30** | |

## Critical Gaps

### 1. No Container Image Runtime Validation
- **Impact**: Image startup failures, broken entrypoints, or missing Python modules not caught until deployment
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The Tekton pipeline builds the image but never runs it. The entrypoint (`python3 -m vllm_tgis_adapter --uvicorn-log-level=warning`) is never validated. If the base image changes and breaks the adapter module, it will only be discovered in production.

### 2. No Smoke Test for Built Image
- **Impact**: Konflux produces images that are never verified as functional
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: After the build step, there is no pipeline task that pulls the built image, starts a container, and verifies the gRPC (port 8033) and HTTP (port 8000) endpoints respond. A basic health-check task would catch most regression scenarios.

### 3. skip-checks: true in Tekton Pipeline
- **Impact**: Quality gates in the Konflux pipeline are bypassed on every PR build
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: `.tekton/vllm-rocm-pull-request.yaml` has `skip-checks: true`. This disables Konflux quality validation tasks. While this may be intentional for build speed, it means the pipeline provides no quality signal beyond "the image built successfully."

### 4. No Dependency Update Automation
- **Impact**: The `RHAIIS_VERSION=3.2.1` build arg in the Dockerfile must be manually tracked and updated
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: No Dependabot or Renovate configuration exists to track updates to the base image version or any other dependencies.

## Quick Wins

### 1. Add HEALTHCHECK to Dockerfile (30 minutes)
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1
```
This enables container orchestrators to detect unhealthy vLLM instances.

### 2. Add .dockerignore (15 minutes)
```
.git
.tekton
.pre-commit-config.yaml
README.md
LICENSE
```
Reduces build context size and prevents unnecessary files from entering the image layer.

### 3. Enable Dependabot for Dockerfile (1-2 hours)
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 4. Create Basic CLAUDE.md (1-2 hours)
```markdown
# vllm-rocm

Downstream Dockerfile wrapper for vLLM ROCm builds.

## Repository Structure
- `Dockerfile.konflux.rocm` — Konflux build Dockerfile (single-stage from RHAIIS base)
- `.tekton/` — Tekton PipelineRun for PR builds
- `.pre-commit-config.yaml` — Inherited from upstream vllm-project/vllm

## Build
```bash
podman build -f Dockerfile.konflux.rocm -t vllm-rocm:local .
```

## Upstream
All vLLM source code lives at https://github.com/vllm-project/vllm
```

### 5. Review skip-checks Setting (30 minutes)
Evaluate whether `skip-checks: true` in the Tekton PipelineRun is still needed. If it was added to work around an early pipeline issue, removing it re-enables Konflux quality gates.

## Detailed Findings

### Unit Tests
- **Score: 0/10**
- No Python source files exist in this repository
- No test files (`test_*.py`, `*_test.py`) found
- No `pytest.ini`, `pyproject.toml`, or test configuration
- This is expected for a thin Dockerfile wrapper — all tests live upstream in `vllm-project/vllm`

### Integration/E2E Tests
- **Score: 0/10**
- No `e2e/`, `integration/`, or `test/` directories
- No cluster setup (Kind, Minikube, envtest)
- No multi-version testing
- No test scenario coverage for the built image

### Build Integration
- **Score: 6/10**
- **Strengths**:
  - Tekton PipelineRun configured for Konflux builds (`.tekton/vllm-rocm-pull-request.yaml`)
  - PR-triggered via `pipelinesascode.tekton.dev/on-event: "[pull_request]"`
  - Also supports label triggers (`kfbuild-all`, `kfbuild-rocm`) and comment triggers (`/build-rocm`)
  - `cancel-in-progress: "true"` prevents redundant builds
  - Uses centralized pipeline from `red-hat-data-services/konflux-central.git`
  - Build platform specified: `linux-extra-fast/amd64`
  - Generous timeouts: 8h pipeline, 4h per task (appropriate for large image builds)
  - Cert preflight and Clair scan tasks have explicit resource requests/limits
- **Weaknesses**:
  - `skip-checks: true` bypasses Konflux quality gates
  - No image startup validation after build
  - No kustomize/kubectl dry-run validation
  - No integration testing of the built image with a model

### Image Testing
- **Score: 3/10**
- **Strengths**:
  - `Dockerfile.konflux.rocm` is present and functional
  - Uses UBI-based image from Red Hat registry (FIPS-capable)
  - Runs as non-root user (`USER 2000`) — good security practice
  - Clear entrypoint: `python3 -m vllm_tgis_adapter --uvicorn-log-level=warning`
  - Proper OCI labels (name, component, description, license)
  - Configurable build arg for version pinning (`RHAIIS_VERSION=3.2.1`)
- **Weaknesses**:
  - Single-stage build (no build/runtime separation, though appropriate for this use case)
  - No `HEALTHCHECK` instruction
  - No `.dockerignore` file
  - No runtime validation or testcontainers usage
  - No multi-architecture manifest (builds amd64 only per pipeline config)
  - No docker-compose test configuration

### Coverage Tracking
- **Score: 0/10**
- No `.codecov.yml` or `codecov.yml`
- No `.coveragerc`
- No coverage reporting in CI
- No tests exist to measure coverage
- N/A for a Dockerfile-only repository

### CI/CD Automation
- **Score: 4/10**
- **Strengths**:
  - Tekton PipelineRun for Konflux builds
  - PaC (Pipelines as Code) annotations for automated triggering
  - Concurrency control via `cancel-in-progress`
  - Multiple trigger mechanisms (PR event, labels, comments)
  - Centralized pipeline reference from `red-hat-data-services/konflux-central.git`
- **Weaknesses**:
  - No `.github/workflows/` directory — zero GitHub Actions
  - No periodic/scheduled builds
  - No test automation in any CI pipeline
  - No caching strategy visible (may be handled by centralized pipeline)
  - No matrix strategy for multi-version testing
  - No notifications configured for build failures (`enable-slack-failure-notification: "false"`)

### Static Analysis

#### Linting
- **Pre-commit configuration**: Comprehensive `.pre-commit-config.yaml` inherited from upstream vLLM
  - **Formatters**: yapf, ruff-format, isort, clang-format
  - **Linters**: ruff, mypy (multi-Python-version), shellcheck, actionlint
  - **Validators**: typos, pymarkdown, SPDX header check, pickle import check, triton import check, config validation
  - **Other**: signoff-commit, filename space check, Dockerfile graph update
- **Practical impact**: Since this repo has no Python/C++ source code, these hooks have nothing to run on. The config is likely carried over from the upstream fork and is not actively used.
- No `ruff.toml` or standalone linting config
- No `mypy.ini` standalone config (mypy is run via pre-commit hooks)

#### FIPS Compatibility
- **Base image**: `registry.redhat.io/rhaiis/vllm-rocm-rhel9` — UBI-based, FIPS-capable
- No non-FIPS crypto imports (no Python source in repo)
- No FIPS build tags needed (no Go code)
- FIPS posture is inherited entirely from the base image

#### Dependency Alerts
- No `.github/dependabot.yml`
- No `renovate.json`, `.renovaterc`, or `.renovaterc.json`
- The `RHAIIS_VERSION` build arg is the primary dependency and must be updated manually

### Agent Rules
- **Score: 0/10**
- **Status**: Missing
- No `CLAUDE.md` or `AGENTS.md` in the repository root
- No `.claude/` directory
- No `.claude/rules/` or `.claude/skills/`
- No testing documentation that would guide AI agents
- **Recommendation**: Create a minimal `CLAUDE.md` explaining the repo's role as a downstream Dockerfile wrapper, build instructions, and the relationship to upstream vLLM

## Recommendations

### Priority 0 (Critical)
1. **Add container image smoke test to Tekton pipeline** — After the build step, add a task that starts the built image and verifies the entrypoint responds on ports 8000 (HTTP) and 8033 (gRPC). This is the single highest-impact improvement for this repo.
2. **Evaluate and document `skip-checks: true`** — Either re-enable Konflux quality checks or add a comment explaining why they are intentionally skipped.

### Priority 1 (High Value)
3. **Add `HEALTHCHECK` instruction to Dockerfile** — Enables orchestrators to detect unhealthy containers.
4. **Add `.github/dependabot.yml`** for Dockerfile base image version tracking.
5. **Add `.dockerignore`** to reduce build context and prevent leaking `.git/` into image layers.
6. **Enable Slack failure notifications** — Change `enable-slack-failure-notification` to `"true"` so build failures are visible to the team.

### Priority 2 (Nice-to-Have)
7. **Create `CLAUDE.md`** with repo context, build instructions, and upstream relationship.
8. **Add a `Makefile`** with `build`, `run`, and `test` targets for local development.
9. **Consider multi-arch builds** — The pipeline currently builds only `linux-extra-fast/amd64`. If ROCm images are needed on other architectures, add `linux/arm64`.
10. **Prune `.pre-commit-config.yaml`** — The current config is copied from upstream vLLM and references files/directories that don't exist in this repo. Either remove it or trim it to only hooks relevant to Dockerfile and YAML linting.

## Comparison to Gold Standards

| Capability | vllm-rocm | odh-dashboard | notebooks | kserve |
|---|---|---|---|---|
| Unit Tests | None | Comprehensive Jest/React | N/A (image-focused) | Extensive Go tests |
| Integration/E2E | None | Cypress E2E | Image validation suite | Multi-version E2E |
| Build Integration | Tekton PR builds | PR Docker builds + tests | Multi-layer image CI | Operator deploy tests |
| Image Testing | No runtime validation | N/A | 5-layer validation | Image startup checks |
| Coverage Tracking | None | Codecov with thresholds | N/A | Codecov enforced |
| CI/CD Automation | Tekton only | GitHub Actions + Prow | GitHub Actions | GitHub Actions + Prow |
| Static Analysis | Pre-commit (unused) | ESLint + TypeScript strict | Hadolint | golangci-lint |
| Agent Rules | None | CLAUDE.md + rules | None | None |

## File Paths Reference

| File | Purpose |
|---|---|
| `Dockerfile.konflux.rocm` | Single-stage Dockerfile from RHAIIS base image |
| `.tekton/vllm-rocm-pull-request.yaml` | Tekton PipelineRun for Konflux PR builds |
| `.pre-commit-config.yaml` | Pre-commit hooks (inherited from upstream vLLM) |
| `README.md` | Upstream vLLM project README |
| `LICENSE` | Apache 2.0 + Commons Clause license |
