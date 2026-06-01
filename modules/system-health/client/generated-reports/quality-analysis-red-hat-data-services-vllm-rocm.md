---
repository: "red-hat-data-services/vllm-rocm"
overall_score: 1.0
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No source code or test files exist in this repository"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or end-to-end tests of any kind"
  - dimension: "Build Integration"
    score: 4.0
    status: "Konflux pipeline builds image on PR via label/comment trigger, but no automated validation"
  - dimension: "Image Testing"
    score: 2.0
    status: "Image builds from upstream base but no runtime validation, smoke tests, or vulnerability scanning"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tools configured; no source code to measure"
  - dimension: "CI/CD Automation"
    score: 3.0
    status: "Konflux PR pipeline exists but is label/comment-triggered, not automatic on every PR"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No runtime validation of built container image"
    impact: "Image may fail to start, crash on GPU initialization, or serve incorrect responses — issues only discovered in staging or production"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No automated tests of any kind"
    impact: "Regressions in base image, environment variables, or entrypoint configuration go undetected until deployment"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Konflux build is not auto-triggered on PRs"
    impact: "Contributors must manually request builds via /build-rocm comment or label; easy to skip, leading to untested merges"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No container security scanning in repository"
    impact: "Vulnerability CVEs in base image or dependencies not caught before merge"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "Vestigial pre-commit config with no matching source files"
    impact: "False sense of code quality enforcement; .pre-commit-config.yaml references Python/C++/shell tools but repo has no such files"
    severity: "LOW"
    effort: "1 hour"
quick_wins:
  - title: "Add automatic Konflux build trigger on every PR"
    effort: "1-2 hours"
    impact: "Ensures every PR builds the image before merge, eliminating manual /build-rocm step"
  - title: "Add container startup smoke test to pipeline"
    effort: "2-4 hours"
    impact: "Catches entrypoint crashes, missing dependencies, and environment variable issues before merge"
  - title: "Add Dockerfile linting (hadolint)"
    effort: "1 hour"
    impact: "Catches Dockerfile best-practice violations and security issues in the build recipe"
  - title: "Remove or scope pre-commit config to actual repo content"
    effort: "30 minutes"
    impact: "Eliminates confusion about what quality tools actually apply to this repository"
recommendations:
  priority_0:
    - "Add container runtime validation: test that the built image starts, binds ports 8000/8033, and responds to health checks"
    - "Enable automatic Konflux PR builds (remove on-comment/on-label gating) so every PR is validated"
  priority_1:
    - "Add Trivy or Clair vulnerability scanning as a required PR check (Clair scan exists but with skip-checks: true)"
    - "Add hadolint Dockerfile linting to CI"
    - "Create a basic smoke test that validates the GRPC adapter entrypoint"
  priority_2:
    - "Add CLAUDE.md with build and contribution guidelines"
    - "Add integration test that loads a small model and sends a test inference request"
    - "Document the relationship between this repo and upstream vllm-project/vllm"
---

# Quality Analysis: vllm-rocm

## Executive Summary

- **Overall Score: 1.0/10**
- **Repository Type**: Container image build recipe (Dockerfile-only)
- **Primary Language**: Dockerfile (no application source code)
- **Key Strengths**: Konflux pipeline exists for PR builds; centralized pipeline management via konflux-central
- **Critical Gaps**: No tests of any kind; no runtime validation; no security scanning; build not auto-triggered
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

This repository is an extremely minimal container image build recipe. It consists of a single `Dockerfile.konflux.rocm` (25 lines) that extends the upstream `registry.redhat.io/rhaiis/vllm-rocm-rhel9` base image with environment variable configuration and a GRPC adapter entrypoint. The repository contains **zero source code files** — no Python, Go, TypeScript, or shell scripts. The `.pre-commit-config.yaml` is inherited from the upstream vLLM project but has no files in this repository to operate on.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No source code or test files exist |
| Integration/E2E | 0/10 | No integration or end-to-end tests |
| **Build Integration** | **4/10** | **Konflux pipeline exists but is manually triggered** |
| Image Testing | 2/10 | Image builds but no runtime validation or scanning |
| Coverage Tracking | 0/10 | No coverage tools; no source code to measure |
| CI/CD Automation | 3/10 | Konflux PR pipeline exists but is label/comment-gated |
| Agent Rules | 0/10 | No CLAUDE.md, AGENTS.md, or .claude/ directory |

## Critical Gaps

### 1. No Runtime Validation of Built Container Image
- **Impact**: The built image may fail to start, crash during GPU initialization, or produce incorrect inference responses. These issues would only be discovered during staging or production deployment.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The Dockerfile sets `ENTRYPOINT ["python3", "-m", "vllm_tgis_adapter", "--uvicorn-log-level=warning"]` and exposes ports 8000 (HTTP) and 8033 (GRPC), but no test verifies the container actually starts and binds these ports.

### 2. No Automated Tests of Any Kind
- **Impact**: Regressions in the base image version, changes to environment variables, or entrypoint configuration issues go completely undetected until the image is deployed.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The repository has zero test files. No unit tests, integration tests, E2E tests, or even basic validation scripts.

### 3. Konflux Build Not Auto-Triggered on PRs
- **Impact**: Contributors must manually trigger builds by posting `/build-rocm` comment or applying `kfbuild-all`/`kfbuild-rocm` labels. It's easy to merge a PR without building the image, leading to broken images in the main branch.
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: The Tekton pipeline uses `pipelinesascode.tekton.dev/on-comment: "^/build-rocm"` and `on-label` triggers instead of automatic `on-event: pull_request` without these conditions.

### 4. Security Scanning Effectively Disabled
- **Impact**: CVEs in the base image or dependencies are not caught before merge.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: The pipeline includes `clair-scan` and `ecosystem-cert-preflight-checks` tasks with generous compute resources, but `skip-checks: true` is set in the pipeline parameters, effectively bypassing all checks.

### 5. Vestigial Pre-commit Configuration
- **Impact**: Creates a false sense of code quality enforcement. The `.pre-commit-config.yaml` references yapf, ruff, isort, mypy, clang-format, shellcheck, and many other tools — but this repository has zero Python, C++, or shell files.
- **Severity**: LOW
- **Effort**: 1 hour
- **Details**: The pre-commit config is copied from the upstream vLLM project and has no relevance to this Dockerfile-only repository.

## Quick Wins

### 1. Enable Automatic Konflux Builds on Every PR (1-2 hours)
Remove the `on-comment` and `on-label` gating from the Tekton pipeline so builds trigger automatically on every pull request.

**Note**: Changes must be made in the [konflux-central](https://github.com/red-hat-data-services/konflux-central) repository, not directly in this repo's `.tekton/` directory.

### 2. Add Container Startup Smoke Test (2-4 hours)
Add a pipeline task that starts the built container and validates:
- The process starts without errors
- Port 8000 (HTTP) and 8033 (GRPC) are listening
- A basic health check endpoint responds

### 3. Add Dockerfile Linting with hadolint (1 hour)
Add hadolint to validate the Dockerfile against best practices:
```yaml
# Example: Add to .tekton pipeline or as a GitHub Action
- name: hadolint
  image: hadolint/hadolint
  script: hadolint Dockerfile.konflux.rocm
```

### 4. Clean Up Pre-commit Config (30 minutes)
Either remove the `.pre-commit-config.yaml` (since no source files exist) or scope it to only validate the Dockerfile and YAML files.

## Detailed Findings

### CI/CD Pipeline

**Workflows Found**: 1 Tekton PipelineRun definition

| Pipeline | Trigger | Purpose |
|----------|---------|---------|
| `vllm-rocm-on-pull-request` | Comment `/build-rocm` or labels `kfbuild-all`/`kfbuild-rocm` | Build multi-arch container image |

**Key Observations**:
- Pipeline is managed centrally via [konflux-central](https://github.com/red-hat-data-services/konflux-central) — changes sync automatically
- Uses the `multi-arch-container-build.yaml` pipeline from konflux-central
- Builds for `linux-extra-fast/amd64` only (no ARM or other architectures)
- Pipeline timeout: 8 hours (tasks: 4 hours) — extremely generous
- Image expiry: 5 days for PR images
- `hermetic: false` — builds can access external resources (not hermetic)
- `skip-checks: true` — **all validation checks are bypassed**
- `cancel-in-progress: true` — good, prevents duplicate builds
- `max-keep-runs: 3` — reasonable cleanup policy

**Missing**:
- No GitHub Actions or other CI workflows
- No automated linting or validation on PRs
- No periodic/scheduled builds
- No push/merge pipeline (only PR builds)

### Test Coverage

**Test Files**: 0
**Test Directories**: 0
**Test Frameworks**: None
**Test-to-Code Ratio**: N/A (no source code)

This repository contains no source code and therefore has no tests. The Dockerfile is the only "code" and it is not validated beyond the Konflux build.

### Code Quality

**Pre-commit Hooks**: `.pre-commit-config.yaml` exists but is vestigial

The pre-commit configuration includes 20+ hooks from the upstream vLLM project:
- **Python**: yapf, ruff, isort, mypy (3.9-3.12), check-spdx-header, check-pickle-imports
- **C++/CUDA**: clang-format
- **Shell**: shellcheck
- **Markdown**: pymarkdown
- **YAML**: actionlint (GitHub Actions linter)
- **General**: typos, check-filenames, signoff-commit

**Problem**: None of these hooks have any files to operate on in this repository. The config is inherited from upstream and creates a false impression of code quality enforcement.

**Missing**:
- No linting specific to Dockerfiles (hadolint)
- No YAML linting for Tekton pipelines
- No Dockerfile best-practice validation

### Container Images

**Dockerfiles Found**: 1 (`Dockerfile.konflux.rocm`)

**Analysis of `Dockerfile.konflux.rocm`**:
```dockerfile
FROM registry.redhat.io/rhaiis/vllm-rocm-rhel9:${RHAIIS_VERSION} as vllm-grpc-adapter
```
- Single-stage build (extends base image only)
- Base image: `registry.redhat.io/rhaiis/vllm-rocm-rhel9:3.2.1` (pinned version via ARG)
- Sets environment variables for GRPC/HTTP ports and spec decoding config
- Runs as non-root user (USER 2000) — good security practice
- Includes Red Hat component labels — good for compliance
- No package installation or file copying — minimal attack surface

**Missing**:
- No `.dockerignore` file
- No multi-architecture build support (single amd64)
- No image startup test
- No vulnerability scanning (skip-checks: true in pipeline)
- No SBOM generation configured
- No image signing/attestation

### Security

**Security Tools**: None configured in repository

| Tool | Status |
|------|--------|
| Trivy | Not configured |
| Snyk | Not configured |
| Clair | In pipeline but `skip-checks: true` |
| CodeQL/SAST | Not applicable (no source code) |
| Gitleaks | Not configured |
| SBOM | Not configured |
| Image Signing | Not configured |

The pipeline includes a `clair-scan` task with generous compute resources (8-16 CPU, 16-32 GB RAM) and an `ecosystem-cert-preflight-checks` task, but both are effectively disabled by the `skip-checks: true` parameter.

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **Coverage**: No test type rules
- **Quality**: N/A
- **Gaps**: Complete absence of agent guidance
- **Recommendation**: For a Dockerfile-only repo, minimal agent rules are needed. A basic `CLAUDE.md` documenting the build process and the relationship to konflux-central would be valuable.

## Recommendations

### Priority 0 (Critical)

1. **Enable container runtime validation**: Add a pipeline task that starts the built image and validates port binding, health checks, and basic HTTP/GRPC responses. This is the single most impactful improvement.

2. **Remove `skip-checks: true` from the Konflux pipeline**: Enable Clair scanning and ecosystem certification preflight checks. These are already configured but disabled.

3. **Enable automatic PR builds**: Remove the comment/label trigger gates so every PR automatically builds and validates the image.

### Priority 1 (High Value)

4. **Add hadolint Dockerfile linting**: Validate the Dockerfile against best practices on every PR.

5. **Add a basic smoke test script**: Create a simple shell script that can be run locally or in CI to validate the image works:
   ```bash
   #!/bin/bash
   # smoke-test.sh
   IMAGE=$1
   docker run -d --name vllm-test -p 8000:8000 -p 8033:8033 "$IMAGE" --help
   # Validate the container started
   docker logs vllm-test
   docker rm -f vllm-test
   ```

6. **Clean up or remove the pre-commit config**: Either remove `.pre-commit-config.yaml` or replace it with hooks relevant to this repo (hadolint, yamllint).

### Priority 2 (Nice-to-Have)

7. **Add CLAUDE.md**: Document the repository purpose, build process, and relationship to konflux-central for contributors and AI agents.

8. **Add a CODEOWNERS file**: Define ownership for Dockerfile and pipeline changes.

9. **Add integration testing**: If feasible, add a test that loads a small model (e.g., a tiny test model) and validates inference works end-to-end. This requires GPU resources and may only be feasible as a periodic/nightly test.

10. **Pin the base image digest**: Instead of relying solely on the version tag (`3.2.1`), pin the base image by digest to ensure reproducible builds:
    ```dockerfile
    FROM registry.redhat.io/rhaiis/vllm-rocm-rhel9:3.2.1@sha256:<digest>
    ```

## Comparison to Gold Standards

| Practice | vllm-rocm | odh-dashboard | notebooks | kserve |
|----------|-----------|---------------|-----------|--------|
| Unit Tests | None | Comprehensive Jest suite | N/A (image repo) | Extensive Go tests |
| Integration Tests | None | Contract + API tests | Image layer tests | Multi-version E2E |
| Image Validation | Build only | N/A | 5-layer validation | Startup tests |
| Coverage Tracking | None | Codecov enforced | N/A | Codecov enforced |
| Security Scanning | Disabled | Trivy + CodeQL | Trivy integrated | Trivy + Snyk |
| CI Automation | Manual trigger | Full auto on PR | Full auto on PR | Full auto on PR |
| Agent Rules | None | Comprehensive .claude/ | Basic | Basic |
| Pre-commit | Vestigial | Comprehensive | Basic | Comprehensive |

**Closest Comparable**: The `notebooks` repository is the most similar gold standard (image-building focus), and it demonstrates significantly more mature practices including multi-layer image validation and automated security scanning.

## File Paths Reference

| File | Purpose |
|------|---------|
| `Dockerfile.konflux.rocm` | Container image build recipe |
| `.pre-commit-config.yaml` | Pre-commit hooks (inherited from upstream, vestigial) |
| `.tekton/vllm-rocm-pull-request.yaml` | Konflux/Tekton PR build pipeline |
| `.tekton/README.md` | Documentation on pipeline management via konflux-central |
| `README.md` | Upstream vLLM project README |
| `LICENSE` | Apache 2.0 license |

## Summary

The `vllm-rocm` repository is a thin container image build layer that wraps the upstream Red Hat AI Inference Server (RHAIIS) vLLM ROCm image with GRPC adapter configuration. At **1.0/10**, it represents the lowest quality score possible for a repository that has at least some CI infrastructure.

The **single highest-impact improvement** would be enabling the existing Clair scanning (removing `skip-checks: true`) and adding a container startup smoke test — these two changes alone would raise the score to approximately 3-4/10 with just a few hours of effort, all done in the [konflux-central](https://github.com/red-hat-data-services/konflux-central) repository.
