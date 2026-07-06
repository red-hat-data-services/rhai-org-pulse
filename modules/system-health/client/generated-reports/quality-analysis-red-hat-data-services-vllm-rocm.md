---
repository: "red-hat-data-services/vllm-rocm"
overall_score: 1.6
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No source code or test files present — build-wrapper repo only"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests — repo contains only a Dockerfile and Tekton pipeline"
  - dimension: "Build Integration"
    score: 4.0
    status: "Konflux PR build via Tekton with Clair scan and preflight checks, but no runtime validation"
  - dimension: "Image Testing"
    score: 2.0
    status: "Image builds via Konflux pipeline; no startup, runtime, or functional validation"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling — no source code to cover"
  - dimension: "CI/CD Automation"
    score: 4.0
    status: "Tekton PipelineRun for PR builds with cancel-in-progress; no GitHub Actions or periodic jobs"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, .claude/ directory, or agent rules of any kind"
critical_gaps:
  - title: "No container image runtime validation"
    impact: "Image may build successfully but fail at startup — broken entrypoint, missing Python modules, or incompatible ROCm libraries not detected until deployment"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No smoke test or health-check validation"
    impact: "vLLM gRPC adapter may not start or respond correctly; discovered only in staging/production"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No vulnerability scanning beyond Clair"
    impact: "Clair scans OS packages but misses Python dependency CVEs (pip packages in the base image)"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No .dockerignore file"
    impact: "Build context may include unnecessary files (.git, docs), increasing build time and image layer sizes"
    severity: "MEDIUM"
    effort: "0.5 hours"
  - title: "skip-checks: true in Tekton PipelineRun"
    impact: "Enterprise Contract and other Konflux validation checks are skipped on PR builds"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No base image pinning or digest verification"
    impact: "Dockerfile uses a tag-based base image (registry.redhat.io/rhaiis/vllm-rocm-rhel9:3.2.1) without digest pinning — builds are not fully reproducible"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add a .dockerignore file"
    effort: "0.5 hours"
    impact: "Faster builds, smaller build context, avoids leaking .git metadata"
  - title: "Add container startup smoke test to Tekton pipeline"
    effort: "4-6 hours"
    impact: "Catch broken entrypoint, missing modules, or ROCm library issues before merge"
  - title: "Pin base image by digest"
    effort: "1 hour"
    impact: "Reproducible builds — prevents silent base image changes from breaking downstream"
  - title: "Add Trivy scanning for Python dependencies"
    effort: "2-3 hours"
    impact: "Detect CVEs in pip packages that Clair's OS-level scan misses"
  - title: "Create a basic CLAUDE.md with repo context"
    effort: "1 hour"
    impact: "AI agents and new contributors understand this is a build-wrapper repo, not a source repo"
recommendations:
  priority_0:
    - "Add container runtime validation — build the image, start it, verify vllm_tgis_adapter responds on gRPC port 8033"
    - "Add Python dependency vulnerability scanning (Trivy or Grype) alongside existing Clair scan"
  priority_1:
    - "Enable Enterprise Contract checks (remove skip-checks: true) or document why they are skipped"
    - "Add base image digest pinning and Renovate/Dependabot for automated base image updates"
    - "Add a Tekton task to verify the ENTRYPOINT runs without GPU (--help or dry-run mode)"
  priority_2:
    - "Create CLAUDE.md documenting repo purpose, relationship to upstream vllm, and Konflux build process"
    - "Add SBOM generation and image signing/attestation"
    - "Consider adding a periodic reconciliation job to detect drift between this repo and konflux-central"
---

# Quality Analysis: vllm-rocm

## Executive Summary

- **Overall Score: 1.6/10**
- **Repository Type**: Konflux build-wrapper (not a source code repository)
- **Primary Language**: Dockerfile / YAML (Tekton)
- **Key Strengths**: Existing Konflux pipeline with Clair scanning and ecosystem cert preflight checks; pre-commit config inherited from upstream vLLM (though no source code to lint)
- **Critical Gaps**: No runtime validation of the built container image; no smoke tests; no Python dependency scanning; Konflux checks skipped on PRs
- **Agent Rules Status**: Missing — no CLAUDE.md, .claude/ directory, or any agent configuration

## Context

This repository is a **minimal Konflux build wrapper** for the AMD ROCm variant of vLLM. It contains:

- **1 Dockerfile** (`Dockerfile.konflux.rocm`) — 25 lines, builds on top of `registry.redhat.io/rhaiis/vllm-rocm-rhel9`
- **1 Tekton PipelineRun** (`.tekton/vllm-rocm-pull-request.yaml`) — auto-synced from `konflux-central`
- **1 pre-commit config** (`.pre-commit-config.yaml`) — inherited from upstream vLLM, but no source code to validate
- **README.md and LICENSE** — upstream vLLM documentation

The actual vLLM source code, tests, and CI/CD live in the upstream `vllm-project/vllm` repository. This repo's sole purpose is to build and publish a Red Hat-branded ROCm container image through the Konflux pipeline.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No source code or test files present |
| Integration/E2E | 0/10 | No integration or E2E tests |
| **Build Integration** | **4/10** | **Konflux PR build with Clair scan, but no runtime validation** |
| Image Testing | 2/10 | Image builds but no startup/functional validation |
| Coverage Tracking | 0/10 | No coverage tooling (no source to cover) |
| CI/CD Automation | 4/10 | Tekton PipelineRun with cancel-in-progress; no periodic jobs |
| Agent Rules | 0/10 | No agent configuration of any kind |

## Critical Gaps

### 1. No Container Image Runtime Validation
- **Impact**: The image may build successfully but fail at startup due to broken entrypoint, missing Python modules, or incompatible ROCm libraries. These failures are only discovered when the image is deployed to a real cluster.
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The Dockerfile sets `ENTRYPOINT ["python3", "-m", "vllm_tgis_adapter", "--uvicorn-log-level=warning"]` but there is no test that actually starts the container and verifies the process launches without errors.

### 2. No Smoke Test or Health-Check Validation
- **Impact**: The vLLM gRPC adapter may not start or respond correctly. Without a GPU, a dry-run or `--help` validation could still catch import errors, missing dependencies, or configuration issues.
- **Severity**: HIGH
- **Effort**: 4-6 hours

### 3. No Python Dependency Vulnerability Scanning
- **Impact**: Clair scans OS-level packages in the container image but does not analyze Python pip packages. The base image (`vllm-rocm-rhel9`) bundles dozens of Python dependencies (torch, transformers, etc.) that may have known CVEs.
- **Severity**: HIGH
- **Effort**: 2-4 hours

### 4. skip-checks: true in Tekton PipelineRun
- **Impact**: Enterprise Contract and other Konflux validation checks are explicitly skipped on PR builds. This means compliance and policy gates are not enforced until post-merge.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Location**: `.tekton/vllm-rocm-pull-request.yaml:49-50`

### 5. No .dockerignore File
- **Impact**: Build context includes `.git/` and other unnecessary files, increasing build time and potentially leaking metadata.
- **Severity**: MEDIUM
- **Effort**: 0.5 hours

### 6. No Base Image Digest Pinning
- **Impact**: The Dockerfile uses `registry.redhat.io/rhaiis/vllm-rocm-rhel9:${RHAIIS_VERSION}` — a mutable tag. If the tag is re-published with different content, builds become non-reproducible.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours

## Quick Wins

### 1. Add a .dockerignore file (0.5 hours)
```
.git
.tekton
.pre-commit-config.yaml
README.md
LICENSE
```

### 2. Pin base image by digest (1 hour)
```dockerfile
# Before
FROM registry.redhat.io/rhaiis/vllm-rocm-rhel9:${RHAIIS_VERSION} as vllm-grpc-adapter

# After (example digest)
FROM registry.redhat.io/rhaiis/vllm-rocm-rhel9:${RHAIIS_VERSION}@sha256:abc123... as vllm-grpc-adapter
```

### 3. Add container startup smoke test (4-6 hours)
Add a Tekton task that runs the built image with a basic health check:
```yaml
- name: smoke-test
  image: $(params.output-image)
  command: ["python3", "-m", "vllm_tgis_adapter", "--help"]
  # Or: verify the process starts and responds on port 8033
```

### 4. Add Trivy Python dependency scanning (2-3 hours)
Add a Tekton task using Trivy to scan Python packages:
```yaml
- name: trivy-python-scan
  image: aquasec/trivy:latest
  command: ["trivy", "image", "--vuln-type", "library", "$(params.output-image)"]
```

### 5. Create CLAUDE.md (1 hour)
```markdown
# vllm-rocm

Build-wrapper repository for the AMD ROCm variant of vLLM.

## Purpose
This repo builds `odh-vllm-rocm-rhel9` container images via Konflux.
It does NOT contain vLLM source code — that lives in vllm-project/vllm.

## Files
- `Dockerfile.konflux.rocm` — Single-layer image on top of rhaiis/vllm-rocm-rhel9
- `.tekton/` — Auto-synced from konflux-central (do not edit directly)
```

## Detailed Findings

### CI/CD Pipeline

**Pipeline Structure:**
- **Trigger**: PR builds via Tekton PipelinesAsCode — triggered by `/build-rocm` comment or `kfbuild-all`/`kfbuild-rocm` labels
- **Pipeline**: References `konflux-central` multi-arch container build pipeline
- **Timeouts**: 8h pipeline / 4h per task (appropriate for large image builds)
- **Concurrency**: `cancel-in-progress: true` — correctly cancels stale builds
- **Architecture**: `linux-extra-fast/amd64` only (no multi-arch despite multi-arch pipeline)
- **Auto-sync**: Tekton files auto-synced from `konflux-central` — correct separation of concerns

**Pipeline Tasks (from PipelineRun spec):**
- `ecosystem-cert-preflight-checks` — with 8 CPU / 16Gi memory requests
- `clair-scan` — OS-level vulnerability scanning with 8 CPU / 16Gi memory requests
- **Missing**: No runtime validation, no Python dependency scanning, no SBOM generation

**Gaps:**
- No periodic/nightly build jobs
- No push-triggered builds (only PR)
- `skip-checks: true` disables Enterprise Contract validation
- `hermetic: false` — builds are not hermetic (can fetch from internet during build)

### Test Coverage

**No tests exist in this repository.** This is expected for a build-wrapper repo, but it means:
- No validation that the built image actually works
- No regression testing when the base image version is bumped
- No contract testing between this image and downstream consumers (KServe, etc.)

### Code Quality

**Pre-commit Config:**
The `.pre-commit-config.yaml` is inherited from upstream vLLM and includes 20+ hooks:
- yapf (Python formatting)
- ruff (Python linting)
- isort (import sorting)
- clang-format (C++/CUDA)
- mypy (type checking, multiple Python versions)
- shellcheck, typos, pymarkdown
- SPDX header checks, pickle import restrictions
- Signed-off-by commit enforcement

**However**, this config is effectively dead code in this repo since there are no Python, C++, or shell files to lint. It appears to have been copied from upstream vLLM rather than being tailored for this build-wrapper repo.

### Container Images

**Dockerfile Analysis (`Dockerfile.konflux.rocm`):**
- **Base**: `registry.redhat.io/rhaiis/vllm-rocm-rhel9:${RHAIIS_VERSION}` (RHAIIS 3.2.1)
- **Build stages**: Single FROM (no multi-stage build — appropriate since it's just adding config on top of a pre-built base)
- **User**: Runs as UID 2000 (non-root — good practice)
- **Entrypoint**: `python3 -m vllm_tgis_adapter --uvicorn-log-level=warning`
- **Labels**: Comprehensive Red Hat labels (name, component, description, license)
- **Environment**: Configures gRPC port (8033), HTTP port (8000), and disables logprob suppression during speculative decoding

**Strengths:**
- Non-root user
- Proper Red Hat labeling
- Minimal layer on top of certified base image

**Weaknesses:**
- No HEALTHCHECK instruction
- No digest pinning for base image
- No .dockerignore
- ARG default may go stale if not updated with base image releases

### Security

**Present:**
- Clair vulnerability scanning in Tekton pipeline
- Ecosystem cert preflight checks
- Non-root container user (UID 2000)
- Base image from Red Hat certified registry

**Missing:**
- No Trivy/Grype scanning for Python dependencies
- No SBOM generation
- No image signing or attestation
- No secret detection (Gitleaks/TruffleHog)
- No CodeQL or SAST (no source code to analyze)
- Enterprise Contract checks explicitly skipped (`skip-checks: true`)

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no CLAUDE.md, AGENTS.md, .claude/ directory, or any agent rules
- **Quality**: N/A
- **Gaps**: No documentation explaining the repo's purpose, relationship to upstream vLLM, or how Konflux builds work
- **Recommendation**: Create a minimal CLAUDE.md explaining this is a build-wrapper repo; agent rules for test creation are less relevant here, but rules for Dockerfile best practices and Tekton pipeline modifications would be valuable

## Recommendations

### Priority 0 (Critical)
1. **Add container runtime validation** — After building the image in the Tekton pipeline, start the container and verify the entrypoint launches successfully (even without a GPU, `--help` or import validation can catch dependency issues)
2. **Add Python dependency vulnerability scanning** — Clair only scans OS packages; add Trivy or Grype to scan pip packages in the base image for CVEs

### Priority 1 (High Value)
1. **Enable Enterprise Contract checks** — Remove `skip-checks: true` or document a clear justification for skipping (e.g., tracked in a Jira issue with a plan to enable)
2. **Pin base image by digest** — Use `@sha256:...` to ensure reproducible builds; automate updates with Renovate or Dependabot
3. **Add a Dockerfile HEALTHCHECK** — Define a health check for container orchestrators to use
4. **Add .dockerignore** — Exclude .git, .tekton, docs from build context

### Priority 2 (Nice-to-Have)
1. **Create CLAUDE.md** — Document repo purpose, relationship to upstream vLLM, and Konflux build process for AI agents and contributors
2. **Add SBOM generation** — Generate Software Bill of Materials for supply chain transparency
3. **Add image signing/attestation** — Sign images with cosign for supply chain security
4. **Add periodic reconciliation job** — Detect drift between this repo's Dockerfile and what's expected by konflux-central
5. **Clean up pre-commit config** — Remove hooks that reference files not present in this repo (Python, C++, shell) to avoid confusion

## Comparison to Gold Standards

| Capability | vllm-rocm | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | None | Comprehensive (Jest) | Per-image | Extensive (Go) |
| Integration Tests | None | Contract + API tests | Import validation | envtest + Kind |
| E2E Tests | None | Cypress + Playwright | 5-layer validation | Multi-version |
| Image Build Validation | Konflux only | PR-time build | Multi-arch PR | PR-time build |
| Image Runtime Validation | **None** | Startup checks | Import + startup | Deployment test |
| Coverage Tracking | None | Codecov enforced | Per-notebook | Codecov |
| Vulnerability Scanning | Clair only | Trivy + Clair | Trivy | Trivy + CodeQL |
| SBOM | None | Generated | Generated | Generated |
| Agent Rules | **None** | Comprehensive | Partial | Partial |
| Pre-commit | Present (upstream) | Present | Present | Present |

**Key Observation**: The gap between vllm-rocm and gold standards is expected — this is a build-wrapper repo, not a source repo. However, even build-wrapper repos should validate that the built image works correctly. The notebooks repo is the closest analogue (image-building focus) and demonstrates 5-layer validation that vllm-rocm completely lacks.

## File Paths Reference

| File | Purpose |
|------|---------|
| `Dockerfile.konflux.rocm` | Container image definition (25 lines) |
| `.tekton/vllm-rocm-pull-request.yaml` | Konflux PR build pipeline (auto-synced) |
| `.tekton/README.md` | Instructions for modifying Tekton files |
| `.pre-commit-config.yaml` | Upstream vLLM pre-commit hooks (not applicable to this repo) |
| `README.md` | Upstream vLLM documentation |
| `LICENSE` | Apache 2.0 license |
