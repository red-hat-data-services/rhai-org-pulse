---
repository: "red-hat-data-services/devops-runner-images"
overall_score: 5.6
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No test files exist — zero unit, integration, or functional tests anywhere in the repo"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests; no validation that built images actually work"
  - dimension: "Build Integration"
    score: 7.0
    status: "Tekton/Konflux pipelines build multi-arch images on PR; skip-checks=true on PR builds disables security scans"
  - dimension: "Image Testing"
    score: 2.0
    status: "Images build but are never validated at runtime — no startup, tool-presence, or smoke tests"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling — no code to cover and no container-level validation metrics"
  - dimension: "CI/CD Automation"
    score: 8.5
    status: "Well-designed Tekton pipelines with CEL path-filtering, Jinja2 templating, multi-arch support, Renovate automation"
  - dimension: "Security Scanning"
    score: 6.0
    status: "Clair, Snyk, Coverity, ClamAV, RPM signature scans on push; all disabled on PRs via skip-checks=true"
  - dimension: "Agent Rules"
    score: 3.0
    status: "Onboarding skill exists but no CLAUDE.md, no test rules, no code quality rules"
critical_gaps:
  - title: "Zero tests of any kind"
    impact: "Broken images (wrong tool version, missing binary, incompatible base) discovered only when downstream CI jobs fail"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "PR builds skip all security checks (skip-checks=true)"
    impact: "CVEs, deprecated base images, and unsigned RPMs are invisible until after merge to main"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No image runtime validation"
    impact: "A Containerfile change could produce an image where oc, kubectl, or yq are missing or broken — no automated detection"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No linting or static analysis on Python scripts"
    impact: "The two generator scripts have no lint checks; a syntax error would only surface when someone runs uv run manually"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Enable security scans on PR builds"
    effort: "1 hour"
    impact: "Catch CVEs and deprecated base images before merge by changing skip-checks from true to false in the PR template"
  - title: "Add container smoke tests to PR pipeline"
    effort: "3-4 hours"
    impact: "Validate that each image starts and its key binaries are present (oc --version, yq --version, etc.)"
  - title: "Add ruff linting for Python scripts"
    effort: "1 hour"
    impact: "Catch syntax and style issues in generate-pipelines.py and generate-pds.py"
  - title: "Add CLAUDE.md with project conventions"
    effort: "1-2 hours"
    impact: "Guide AI agents and new contributors on repo structure, naming, and how to add images"
recommendations:
  priority_0:
    - "Enable security scans on PR builds (set skip-checks=false in pull-request.yaml.j2)"
    - "Add container smoke tests — a Tekton task that runs the built image and verifies key binaries are present and functional"
    - "Add Containerfile linting (hadolint) to catch Dockerfile anti-patterns before build"
  priority_1:
    - "Add Python linting (ruff) for the generator scripts"
    - "Create CLAUDE.md with repo conventions, Containerfile standards, and onboarding pointers"
    - "Add pre-commit hooks for YAML validation and Python formatting"
    - "Pin tool download URLs in Containerfiles to specific versions instead of 'latest/stable' for reproducibility"
  priority_2:
    - "Add image size tracking/budgets to detect unexpected bloat"
    - "Add SBOM generation for built images"
    - "Consider Testcontainers-based integration tests for complex images (tracer, slack-notifier)"
    - "Add comprehensive .claude/rules/ for Containerfile best practices"
---

# Quality Analysis: devops-runner-images

## Executive Summary

- **Overall Score: 5.6/10**
- **Repository Type**: Container image factory (infrastructure tooling)
- **Primary Languages**: Dockerfile/Containerfile, Python (generators), YAML (Tekton pipelines)
- **Component Count**: 5 images (base-runner, openshift-utils, tracer, slack-notifier, embargo-ci-runner)
- **Total Files**: 34 (very small, focused repo)

### Key Strengths
- Excellent CI/CD architecture with Tekton/Konflux pipelines, Jinja2 templating, and CEL-based path filtering
- Multi-architecture support (x86_64 + arm64) for all images
- Renovate bot auto-updates base image digests and Tekton bundle references
- Clean layered image hierarchy (base-runner → openshift-utils, tracer, etc.)
- Good onboarding documentation and Claude Code onboarding skill

### Critical Gaps
- **Zero tests** — no unit, integration, E2E, or smoke tests anywhere in the repository
- **PR builds skip ALL security scans** — skip-checks=true means Clair, Snyk, Coverity, ClamAV, and RPM signature scans are disabled until push to main
- **No runtime validation** — images are built but never checked for correctness (missing binaries, broken tools, startup failures)

### Agent Rules Status: Incomplete
A `.claude/skills/onboarding/` skill exists but there is no `CLAUDE.md`, no `.claude/rules/` directory, and no test automation guidance.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No test files exist |
| Integration/E2E | 0/10 | No integration or E2E tests |
| **Build Integration** | **7/10** | **Tekton builds on PR with multi-arch support, but skip-checks=true** |
| Image Testing | 2/10 | Build-only — no runtime validation |
| Coverage Tracking | 0/10 | No coverage tooling of any kind |
| CI/CD Automation | 8.5/10 | Excellent pipeline architecture |
| Security Scanning | 6/10 | Full scan suite defined but disabled on PRs |
| Agent Rules | 3/10 | Onboarding skill only, no test or quality rules |

## Critical Gaps

### 1. Zero Tests of Any Kind
- **Impact**: Broken images (wrong tool version, missing binary, incompatible base image) are only discovered when downstream CI jobs fail
- **Severity**: HIGH
- **Effort**: 4-8 hours
- **Details**: The repository has 34 files and not a single test. No `*_test.py`, no `test_*.py`, no shell-based validation scripts. The generator scripts (`generate-pipelines.py`, `generate-pds.py`) have no unit tests. The Containerfiles produce images that are never validated.

### 2. PR Builds Skip All Security Checks
- **Impact**: CVEs, deprecated base images, unsigned RPMs, and SAST findings are invisible to PR reviewers — only surfaced after merge to main
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Details**: The PR template (`.tekton/templates/pull-request.yaml.j2`) sets `skip-checks: true`. This disables Clair vulnerability scanning, Snyk SAST, Coverity SAST, ClamAV scanning, deprecated image checks, RPM signature scans, shell checks, and unicode checks. The push template also sets `skip-checks: true`, which means the pipeline definition includes scan tasks but they are **never actually executed** in either PR or push builds.
- **Fix**: Change `skip-checks` to `false` in both templates (or at minimum in the push template to get post-merge scanning).

### 3. No Image Runtime Validation
- **Impact**: A Containerfile change could produce an image where `oc`, `kubectl`, `yq`, or other tools are missing or non-functional — with zero automated detection
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The pipeline builds images and pushes them to Quay, but never runs them. Industry best practice for container image repos is a smoke test step that: (1) starts the image, (2) runs each key binary with `--version`, (3) validates expected files/directories exist.

### 4. No Linting or Static Analysis
- **Impact**: Python syntax errors in generators, Containerfile anti-patterns (running as root, uncached layers, unpinned versions), and YAML errors in Tekton templates are caught only by human review
- **Severity**: MEDIUM
- **Effort**: 1-2 hours

## Quick Wins

### 1. Enable Security Scans on Push Builds (1 hour)
At minimum, enable security scans on push-to-main so merged code gets scanned.

**In `.tekton/templates/push.yaml.j2`:**
```yaml
  - name: skip-checks
    value: false   # was: true
```

Better: also enable on PRs to catch issues before merge.

### 2. Add Container Smoke Tests (3-4 hours)
Add a Tekton task that runs after `build-image-index` to validate images.

**Example smoke test task (per-image validation):**
```yaml
- name: smoke-test
  runAfter:
    - build-image-index
  taskSpec:
    steps:
      - name: verify-tools
        image: $(tasks.build-image-index.results.IMAGE_URL)@$(tasks.build-image-index.results.IMAGE_DIGEST)
        script: |
          #!/bin/bash
          set -euo pipefail
          echo "=== Smoke testing image ==="
          # base-runner tools
          yq --version
          skopeo --version
          podman --version
          git --version
          jq --version
          echo "=== All tools verified ==="
```

### 3. Add Ruff Linting for Python Scripts (1 hour)
```bash
# Add ruff.toml
cat > ruff.toml << 'EOF'
target-version = "py311"
line-length = 120
[lint]
select = ["E", "F", "I", "W"]
EOF

# Run: uv run ruff check scripts/
```

### 4. Add Hadolint for Containerfiles (1 hour)
```yaml
# Add to PR pipeline as a pre-build step
- name: lint-containerfile
  taskSpec:
    steps:
      - name: hadolint
        image: hadolint/hadolint:latest
        script: |
          hadolint $(params.path-context)/Containerfile
```

### 5. Add CLAUDE.md (1-2 hours)
Create a root `CLAUDE.md` to guide contributors and AI agents on repo structure and conventions.

## Detailed Findings

### CI/CD Pipeline

**Architecture: Excellent (8.5/10)**

The CI/CD setup is the strongest dimension of this repository:

- **Tekton/Konflux pipelines**: Uses Pipelines-as-Code with CEL expressions for path-based triggering — only affected images rebuild when their directory changes
- **Multi-arch builds**: All images build for both `linux/x86_64` and `linux/arm64` using `buildah-remote-oci-ta` with matrix params
- **Templated pipelines**: Jinja2 templates (`pull-request.yaml.j2`, `push.yaml.j2`) generate per-component PipelineRun YAMLs from `config.yaml`, eliminating copy-paste drift
- **Renovate automation**: Monitors base image SHA256 digests in `argfile.conf` and Tekton bundle references, auto-creates update PRs with auto-merge for patch/digest updates
- **PR image expiry**: PR builds are tagged with `on-pr-{revision}` and expire after 5 days
- **Concurrency control**: `cancel-in-progress: true` on PRs prevents stale builds from piling up

**Gap**: PR builds set `skip-checks: true`, disabling all security and validation tasks.

### Test Coverage

**Score: 0/10 — No tests exist**

- Zero test files of any kind (`*_test.py`, `test_*`, `*.spec.*`)
- No `test/`, `tests/`, `e2e/`, or `integration/` directories
- The two Python generator scripts have no unit tests
- No shell-based validation scripts
- No Containerfile test frameworks (Testcontainers, container-structure-test, etc.)

### Code Quality

**Linting: None configured**

- No `.golangci.yaml`, `ruff.toml`, `.eslintrc`, `.flake8`, or `mypy.ini`
- No `.pre-commit-config.yaml`
- No Containerfile linting (hadolint, dockerfile_lint)
- No YAML linting for Tekton templates

**Code hygiene observations:**
- The two Python scripts are clean and well-structured (PEP 723 inline dependencies, proper `__main__` guards)
- Containerfiles use `ARG` for base images, enabling digest pinning via `argfile.conf`
- Tool installation in Containerfiles uses unpinned versions in some cases (e.g., `yq` downloads `latest`, `oc/kubectl` downloads `stable`)

### Container Images

**Build Process: Good structure, no validation (2/10)**

| Image | Base | Key Tools | Pinned? |
|-------|------|-----------|---------|
| base-runner | UBI 9 | yq, skopeo, podman, git, jq, gettext | Base: SHA256 ✅; yq: latest ❌ |
| openshift-utils | base-runner | oc, kubectl, opm | Base: SHA256 ✅; oc/opm: stable ❌ |
| tracer | base-runner | tracer.sh (from private repo) | Base: SHA256 ✅ |
| slack-notifier | openshift-utils | tracer.sh, send-slack-message.sh, tracer-diff.sh | Bases: SHA256 ✅ |
| embargo-ci-runner | base-runner | python3.12, uv, glab, gh | Base: SHA256 ✅; glab: v1.80.4 ✅; gh: v2.65.0 ✅ |

**Strengths:**
- Multi-stage builds for tracer and slack-notifier (clone private repo in build stage, copy artifacts to final image)
- SHA256 digest pinning for base images via `argfile.conf` + Renovate
- Consistent use of `TARGETARCH` for multi-arch tool downloads

**Gaps:**
- No runtime validation after build
- `yq` downloads `latest` release — not pinned to a version
- `oc` and `opm` download from `stable` channel — not pinned
- No `.dockerignore` or equivalent for Containerfiles
- No SBOM generation
- No image size tracking

### Security

**Scanning: Configured but not enabled (6/10)**

The pipeline definition includes an impressive set of security scans:
- **Clair scan** — Container vulnerability scanning (per-platform, matrix)
- **Snyk SAST** — Static application security testing
- **Coverity SAST** — Static analysis (with availability check)
- **ClamAV scan** — Malware scanning (per-platform, matrix)
- **RPM signature scan** — Verify RPM package signatures
- **Shell check** — Shell script analysis
- **Unicode check** — Detect suspicious unicode characters
- **Deprecated image check** — Flag deprecated base images
- **Ecosystem cert preflight** — Red Hat certification checks

**Critical issue**: Both PR and push templates set `skip-checks: true`, meaning **none of these scans ever execute**. The security infrastructure is fully defined but entirely dormant.

### Agent Rules (Agentic Flow Quality)

**Score: 3/10 — Minimal**

- **Status**: Incomplete
- **`.claude/` directory**: Exists with a single onboarding skill
- **Onboarding skill**: Well-written, walks through adding a new image step-by-step
- **CLAUDE.md**: Missing — no root-level project context for AI agents
- **`.claude/rules/`**: Missing — no test creation rules, code quality rules, or Containerfile conventions
- **Test automation guidance**: None

**Gaps:**
- No rules for Containerfile best practices
- No rules for Tekton pipeline modifications
- No rules for adding/updating argfile.conf entries
- No test creation guidance of any kind

## Recommendations

### Priority 0 (Critical)

1. **Enable security scans** — Change `skip-checks` to `false` in at least the push template (`.tekton/templates/push.yaml.j2`). Ideally enable on PRs too. This is a 1-line change per template plus regenerating the PipelineRun YAMLs.

2. **Add container smoke tests** — Create a Tekton task that runs each built image and verifies its key tools are present and functional (`yq --version`, `oc version`, etc.). Add this as a post-build step in the pipeline.

3. **Pin tool versions in Containerfiles** — Replace `latest`/`stable` URLs with specific versions for `yq`, `oc`, `kubectl`, and `opm` to ensure reproducible builds.

### Priority 1 (High Value)

4. **Add unit tests for generator scripts** — Test that `generate-pipelines.py` produces correct YAML for various `config.yaml` inputs, and that `generate-pds.py` produces valid Konflux resources.

5. **Add Python linting (ruff)** — Enforce style and catch bugs in the generator scripts.

6. **Add Containerfile linting (hadolint)** — Catch anti-patterns before build (e.g., unpinned versions, running as root, uncombined RUN layers).

7. **Create CLAUDE.md** — Document repo structure, conventions, and point to the onboarding guide.

8. **Add pre-commit hooks** — YAML validation, Python formatting, Containerfile linting.

### Priority 2 (Nice-to-Have)

9. **Add image size budgets** — Track image sizes over time and alert on unexpected bloat.

10. **Add SBOM generation** — Produce Software Bill of Materials for each built image.

11. **Create `.claude/rules/`** — Containerfile conventions, Tekton pipeline rules, argfile.conf management rules.

12. **Add Testcontainers-based tests** — For complex images like tracer and slack-notifier, validate that scripts inside the image work correctly.

## Comparison to Gold Standards

| Dimension | devops-runner-images | notebooks (gold) | odh-dashboard (gold) |
|-----------|---------------------|-------------------|----------------------|
| Unit Tests | ❌ None | ✅ Python + shell | ✅ Jest + Go |
| Integration/E2E | ❌ None | ✅ Multi-layer | ✅ Cypress + Playwright |
| Image Smoke Tests | ❌ None | ✅ 5-layer validation | N/A |
| Coverage Tracking | ❌ None | ✅ Codecov | ✅ Codecov |
| Multi-Arch | ✅ x86_64 + arm64 | ✅ Multi-arch | N/A |
| Security Scanning | ⚠️ Defined but disabled | ✅ Active scans | ✅ Snyk + CodeQL |
| Renovate/Dependabot | ✅ Excellent | ✅ Yes | ✅ Yes |
| Agent Rules | ⚠️ Onboarding only | ❌ None | ✅ Comprehensive |
| Containerfile Linting | ❌ None | ✅ hadolint | N/A |
| CI/CD Templating | ✅ Jinja2 + CEL | ✅ Makefile-driven | ✅ GitHub Actions |

## File Paths Reference

| File | Purpose |
|------|---------|
| `config.yaml` | Central component configuration |
| `.tekton/pipelines/multi-arch-container-build.yaml` | Shared Tekton Pipeline definition |
| `.tekton/templates/pull-request.yaml.j2` | PR PipelineRun Jinja2 template |
| `.tekton/templates/push.yaml.j2` | Push PipelineRun Jinja2 template |
| `scripts/generate-pipelines.py` | Generates Tekton PipelineRun YAMLs |
| `scripts/generate-pds.py` | Generates Konflux ProjectDevelopmentStream |
| `builds/*/Containerfile` | Per-image container definitions |
| `builds/*/argfile.conf` | Per-image build args with pinned digests |
| `renovate.json5` | Renovate bot configuration |
| `.claude/skills/onboarding/SKILL.md` | Onboarding skill for adding new images |
| `docs/onboarding.md` | Step-by-step guide for new images |
