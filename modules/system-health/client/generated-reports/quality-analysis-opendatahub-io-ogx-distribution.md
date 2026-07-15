---
repository: "opendatahub-io/ogx-distribution"
overall_score: 6.4
scorecard:
  - dimension: "Unit Tests"
    score: 3.0
    status: "No unit tests for build scripts (~750 LOC); distribution repo relies on upstream testing"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Outstanding multi-layer strategy: smoke, integration, functional, Showroom (OpenShift), weekly cross-provider"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR builds and tests image; Tekton/Konflux pipelines exist; no PR-time Konflux simulation"
  - dimension: "Image Testing"
    score: 7.0
    status: "Multi-arch builds, OCI label verification, runtime smoke tests; no vulnerability scanning or SBOM"
  - dimension: "Coverage Tracking"
    score: 2.0
    status: "No coverage tools, no codecov integration, no thresholds"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "17 workflows, concurrency control, build caching, path filtering, nightly builds, weekly reports"
  - dimension: "Agent Rules"
    score: 5.0
    status: "Comprehensive CLAUDE.md but no .claude/rules/ for test creation guidance"
critical_gaps:
  - title: "No container vulnerability scanning"
    impact: "CVEs in base images or Python dependencies not caught until downstream Konflux/ACS scanning"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No unit tests for build scripts"
    impact: "Build script regressions (build.py, gen_distro_docs.py, ~750 LOC) only caught by downstream failures"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No SAST/CodeQL integration"
    impact: "Code-level security issues in Python scripts not detected; relies solely on pre-commit Ruff linting"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No SBOM generation"
    impact: "Supply chain transparency missing; increasingly required for compliance and customer trust"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "Functional tests not in PR workflow"
    impact: "Bruno API contract and notebook tests only run in Showroom/ITS, not on every PR"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add Trivy container scanning to PR workflow"
    effort: "1-2 hours"
    impact: "Catch CVEs in base images and Python dependencies before merge"
  - title: "Add CodeQL/SAST workflow"
    effort: "1-2 hours"
    impact: "Automated security analysis for Python code"
  - title: "Add Syft SBOM generation to publish job"
    effort: "1-2 hours"
    impact: "Supply chain transparency and compliance"
  - title: "Create agent rules for test patterns (.claude/rules/)"
    effort: "2-3 hours"
    impact: "Improve AI-assisted test creation quality and consistency"
  - title: "Add basic pytest for build.py"
    effort: "4-6 hours"
    impact: "Catch regressions in the most critical build script before they break CI"
recommendations:
  priority_0:
    - "Add Trivy container scanning to the redhat-distro-container.yml workflow (scan built image before publish)"
    - "Add unit tests for build/build.py — config generation, requirements generation, and Containerfile templating"
  priority_1:
    - "Integrate functional tests (Bruno + notebooks) into PR workflow for faster feedback"
    - "Add CodeQL workflow for Python SAST"
    - "Generate SBOM in the publish job using Syft or similar"
    - "Create .claude/rules/ with test creation guidance (smoke test patterns, integration test patterns)"
  priority_2:
    - "Add coverage tracking for build scripts with pytest-cov"
    - "Add image signing/attestation (cosign) for published images"
    - "Add performance regression testing for API response times"
    - "Consider Gitleaks for secret scanning beyond detect-private-key"
---

# Quality Analysis: opendatahub-io/ogx-distribution

## Executive Summary
- Overall Score: 6.4/10
- Key Strengths: Outstanding multi-layer integration testing strategy (smoke → integration → functional → Showroom/OpenShift), comprehensive CI/CD with 17 well-organized workflows, excellent multi-provider cross-testing (OpenAI, Vertex AI, vLLM, Gemini, Anthropic), and a detailed CLAUDE.md
- Critical Gaps: No container vulnerability scanning, no unit tests for build scripts, no SAST/CodeQL, no SBOM generation
- Agent Rules Status: Partial — comprehensive CLAUDE.md exists but no `.claude/rules/` for test automation guidance

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 3.0/10 | No unit tests for build scripts (~750 LOC); relies on upstream testing |
| Integration/E2E | 9.0/10 | Outstanding multi-layer: smoke, integration, functional, Showroom |
| **Build Integration** | **7.0/10** | **PR builds/tests image; Tekton exists; no PR-time Konflux simulation** |
| Image Testing | 7.0/10 | Multi-arch, OCI label verification, runtime smoke; no vuln scanning |
| Coverage Tracking | 2.0/10 | No coverage tools, no codecov, no thresholds |
| CI/CD Automation | 9.0/10 | 17 workflows, concurrency, caching, nightly builds, weekly reports |
| Agent Rules | 5.0/10 | Comprehensive CLAUDE.md; no .claude/rules/ for test guidance |

## Critical Gaps

1. **No container vulnerability scanning**
   - Impact: CVEs in base images or Python dependencies not caught until downstream Konflux/ACS
   - Severity: HIGH
   - Effort: 2-4 hours

2. **No unit tests for build scripts**
   - Impact: build.py (466 LOC) and gen_distro_docs.py (264 LOC) have zero test coverage; regressions only caught by downstream CI failures or manual verification
   - Severity: HIGH
   - Effort: 8-12 hours

3. **No SAST/CodeQL integration**
   - Impact: Code-level security issues in Python scripts and test helpers not detected
   - Severity: MEDIUM
   - Effort: 2-3 hours

4. **No SBOM generation**
   - Impact: Supply chain transparency missing for published container images
   - Severity: MEDIUM
   - Effort: 2-4 hours

5. **Functional tests not integrated into PR workflow**
   - Impact: Bruno API contract tests and notebook tests only run in Showroom/Konflux ITS, not on every PR
   - Severity: MEDIUM
   - Effort: 4-6 hours

## Quick Wins

1. **Add Trivy container scanning to PR workflow**
   - Effort: 1-2 hours
   - Impact: Catch CVEs in base images and Python dependencies before merge
   - Implementation:
   ```yaml
   - name: Trivy vulnerability scan
     uses: aquasecurity/trivy-action@master
     with:
       image-ref: '${{ env.IMAGE_NAME }}:${{ github.sha }}'
       format: 'sarif'
       output: 'trivy-results.sarif'
       severity: 'CRITICAL,HIGH'
   ```

2. **Add CodeQL/SAST workflow**
   - Effort: 1-2 hours
   - Impact: Automated security analysis for Python code
   - Implementation: Create `.github/workflows/codeql.yml` with `language: python`

3. **Add Syft SBOM generation to publish job**
   - Effort: 1-2 hours
   - Impact: Supply chain transparency and compliance
   - Implementation:
   ```yaml
   - name: Generate SBOM
     uses: anchore/sbom-action@v0
     with:
       image: '${{ env.IMAGE_NAME }}:${{ github.sha }}'
       format: spdx-json
   ```

4. **Create agent rules for test patterns**
   - Effort: 2-3 hours
   - Impact: Improve AI-assisted test creation quality
   - Implementation: Create `.claude/rules/smoke-tests.md`, `.claude/rules/integration-tests.md`

5. **Add basic pytest for build.py**
   - Effort: 4-6 hours
   - Impact: Catch regressions in config generation, requirements generation, Containerfile templating
   - Implementation: Create `tests/unit/test_build.py` with fixtures for build.yaml variants

## Detailed Findings

### CI/CD Pipeline

**Workflow Inventory (17 total):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `redhat-distro-container.yml` | PR, push, schedule (6AM daily), dispatch | Main build/test/publish pipeline |
| `pre-commit.yml` | PR, push | Ruff, ShellCheck, Actionlint, artifact generation |
| `semantic-pr.yml` | PR | Conventional Commits title enforcement |
| `test-pr-in-showroom.yml` | schedule (daily 8AM), dispatch | Build and test PRs on OpenShift cluster |
| `test-upstream-in-showroom.yml` | schedule (daily 2AM), dispatch | Test upstream OGX main on OpenShift |
| `responses-weekly.yml` | schedule (Sunday 22:00), dispatch | Cross-provider Responses API test suite |
| `messages-weekly.yml` | schedule (Sunday 23:00), dispatch | Cross-provider Messages API test suite |
| `responses-openai.yml` | workflow_call, dispatch | OpenAI Responses API tests |
| `responses-vertexai.yml` | workflow_call, dispatch | Vertex AI Responses API tests |
| `responses-vllm-maas.yml` | workflow_call, dispatch | vLLM MaaS Responses API tests |
| `messages-openai.yml` | workflow_call, dispatch | OpenAI Messages API + Agent SDK tests |
| `messages-vllm.yml` | workflow_call, dispatch | Native vLLM Messages API tests |
| `vllm-cpu-container.yml` | Manual | CI vLLM CPU image builder |
| `create-or-update-release-branch.yml` | dispatch | Release branch management |
| `stale_bot.yml` | schedule | Stale issue/PR cleanup |
| `dependabot.yml` | schedule (weekly) | GitHub Actions, Python deps, Docker deps |

**Strengths:**
- Concurrency control on all relevant workflows (`cancel-in-progress: true`)
- Build caching via GHA cache (`cache-from: type=gha`)
- Path filtering on main workflow (only rebuilds on relevant file changes)
- Multi-arch matrix strategy (amd64 + arm64) on native runners
- Intelligent distribution-changed detection for conditional publishing
- Slack notifications on failure
- Provider credential validation with graceful degradation for forks/Dependabot
- Reusable composite actions (`setup-vllm`, `setup-postgres`, `setup-server`, `free-disk-space`)

**Gaps:**
- No PR-time Konflux build simulation
- Functional tests (Bruno + notebooks) not in PR workflow

### Test Coverage

**Test Architecture (3 layers + 2 weekly suites + 2 daily Showroom runs):**

| Layer | Location | Framework | Trigger |
|-------|----------|-----------|---------|
| Smoke | `tests/smoke.sh` | Bash + curl | PR (via redhat-distro-container) |
| Integration | `tests/run_integration_tests.sh` | pytest (upstream OGX suite) | PR (via redhat-distro-container) |
| Functional | `tests/functional/` | Bruno + Jupyter + pytest | Showroom/Konflux ITS only |
| Responses API | `responses-*.yml` | pytest (upstream OGX suite) | Weekly + dispatch |
| Messages API | `messages-*.yml` | Bash + Claude Agent SDK | Weekly + dispatch |
| Showroom | `test-pr-in-showroom.yml` | OpenShift deployment + tests | Daily + dispatch |

**Smoke Test Coverage (`tests/smoke.sh`):**
- Container health check (60s retry loop)
- Model listing verification (all providers)
- OpenAI-compatible inference (chat completion)
- Anthropic-compatible Messages API (`/v1/messages`)
- PostgreSQL table creation verification
- PostgreSQL data population verification
- File processor (pypdf) validation with custom marker
- RAG file ingestion pipeline (upload → vector store → index)

**Integration Test Coverage (`tests/run_integration_tests.sh`):**
- Clones upstream OGX repo at pinned version
- Runs upstream `tests/integration/inference/` pytest suite
- Tests against multiple providers based on available credentials
- Known skip list for tests incompatible with CI environment

**Functional Test Coverage (`tests/functional/`):**
- Bruno API contracts (CRUD operations against all API endpoints)
- Jupyter notebook execution tests (asserts required)
- JUnit XML report generation
- Provider matrix testing with configurable providers
- Health check with server restart capability

**Cross-Provider Weekly Testing:**
- OpenAI: gpt-4.1-nano + text-embedding-3-small
- Vertex AI: gemini-2.5-flash + gemini-embedding-2
- vLLM MaaS: llama-3-2-3b + nomic-embed-text-v1-5
- GitHub Pages interactive test report dashboard

**Messages API Testing:**
- OpenAI translation path (Messages → Chat Completions)
- Native vLLM passthrough path (direct /v1/messages)
- Claude Agent SDK 3-turn session test

**File Counts:**
- Source Python files: 10 (~1,224 LOC)
- Shell scripts: 10
- Test files: 9
- Test-to-code ratio: ~0.9:1 (good for distribution repo)

### Code Quality

**Pre-commit Configuration (`.pre-commit-config.yaml`):**
- `pre-commit-hooks`: merge conflict, trailing whitespace, large files (1MB), end-of-file, no-commit-to-branch, YAML/JSON/TOML validation, private key detection, mixed line endings, executable shebangs, symlinks
- `ruff`: Python linting + auto-fix + formatting
- `actionlint`: GitHub Actions workflow linting
- `shellcheck`: Shell script static analysis
- Local hooks: `pkg-gen` (build.py), `doc-gen` (gen_distro_docs.py)

**Strengths:**
- Comprehensive pre-commit with 4 linters (Ruff, ShellCheck, Actionlint, pre-commit-hooks)
- Semantic PR titles enforced via workflow
- Dependabot for GitHub Actions (weekly), Python deps (security-only), Docker deps
- CODEOWNERS for CI and documentation
- PR template exists

**Gaps:**
- No SAST/CodeQL
- No Gitleaks (only `detect-private-key` in pre-commit)
- No `ruff.toml` at repo root (only in functional tests pyproject.toml)

### Container Images

**Build Process:**
- Base image: `quay.io/opendatahub/odh-midstream-python-base-3-12:latest` (Red Hat midstream)
- Generated from `Containerfile.in` template by `build/build.py`
- Multi-stage: installs requirements, runs install-common.sh, embeds config as OCI labels
- `uv pip install` with constraints file for dependency management

**Multi-arch Support:**
- ✅ amd64 (ubuntu-24.04) + arm64 (ubuntu-24.04-arm) with native runners
- ✅ QEMU for publish job cross-compilation
- ✅ Docker Buildx for multi-platform builds

**Image Validation:**
- ✅ OCI config label verification (`verify-config-label.sh`)
- ✅ Runtime smoke test against built image
- ✅ Multi-provider inference testing
- ❌ No vulnerability scanning (Trivy/Snyk)
- ❌ No SBOM generation
- ❌ No image signing/attestation

**Tekton/Konflux:**
- Pull request pipeline: `odh-ogx-core-pull-request.yaml`
- Push pipeline: `odh-ogx-core-push.yaml`
- Uses central pipeline from `opendatahub-io/odh-konflux-central`
- Early gate testing disabled

### Security

**Current Practices:**
- ✅ Private key detection (pre-commit)
- ✅ Provider credential validation before tests
- ✅ Fork/Dependabot credential handling (secrets unavailable = graceful skip)
- ✅ Dependabot for dependency updates (security-focused for Python)
- ✅ Pinned GitHub Actions (SHA references, not tags)
- ✅ Permissions restricted (`contents: read`, `id-token: write` only where needed)

**Missing:**
- ❌ Container vulnerability scanning (Trivy/Snyk)
- ❌ SAST (CodeQL/Semgrep)
- ❌ Secret scanning (Gitleaks/TruffleHog)
- ❌ SBOM generation
- ❌ Image signing (cosign)
- ❌ `.trivyignore` or vulnerability threshold configuration

### Agent Rules (Agentic Flow Quality)

**Status**: Partial

**CLAUDE.md (Root):**
- ✅ Present and comprehensive (~5KB)
- ✅ Project overview and architecture
- ✅ Common commands (pre-commit, build, run, test)
- ✅ Auto-generated file warnings
- ✅ Build pipeline documentation
- ✅ Provider activation pattern explanation
- ✅ CI/CD documentation
- ✅ PR title format requirements

**Gaps:**
- ❌ No `.claude/` directory
- ❌ No `.claude/rules/` for test creation guidance
- ❌ No test pattern documentation for AI agents
- ❌ No smoke test writing guide
- ❌ No integration test extension guide
- ❌ No Bruno API test creation guide

**Recommendation:** Use `/test-rules-generator` to create rules for:
- Smoke test patterns (Bash + curl, health checks, model verification)
- Integration test patterns (upstream pytest suite, provider configuration)
- Functional test patterns (Bruno API contracts, Jupyter notebook tests)

## Recommendations

### Priority 0 (Critical)

- **Add Trivy container scanning** to `redhat-distro-container.yml` — scan the built image before publishing to catch CVEs in base images and Python dependencies
- **Add unit tests for `build/build.py`** — this 466-line script generates config.yaml, requirements.txt, and Containerfile; regressions here break the entire build pipeline

### Priority 1 (High Value)

- **Integrate functional tests into PR workflow** — Bruno API contracts and notebook tests should run on PRs, not just in Showroom/Konflux ITS
- **Add CodeQL workflow** — Python SAST for build scripts and test helpers
- **Generate SBOM** — use Syft or similar in the publish job for supply chain transparency
- **Create `.claude/rules/`** — test creation guidance for smoke, integration, and functional test patterns

### Priority 2 (Nice-to-Have)

- **Add pytest-cov for build scripts** — coverage tracking for build.py and gen_distro_docs.py
- **Add cosign image signing** — sign published images for verification
- **Performance regression testing** — track API response times across releases
- **Gitleaks integration** — broader secret scanning beyond detect-private-key
- **PR-time Konflux build simulation** — catch Konflux-specific build issues before merge

## Comparison to Gold Standards

| Dimension | ogx-distribution | odh-dashboard | notebooks | kserve |
|-----------|-----------------|---------------|-----------|--------|
| Unit Tests | ❌ None | ✅ Comprehensive | ⚠️ Limited | ✅ Comprehensive |
| Integration/E2E | ✅ Multi-layer + weekly | ✅ Multi-layer | ✅ E2E | ✅ E2E + envtest |
| Contract Tests | ✅ Bruno API contracts | ✅ API contracts | ❌ None | ⚠️ Limited |
| Coverage Tracking | ❌ None | ✅ Codecov enforced | ❌ None | ✅ Codecov |
| Image Testing | ✅ Runtime smoke | ✅ Full validation | ✅ 5-layer | ⚠️ Basic |
| Vuln Scanning | ❌ None | ⚠️ Limited | ✅ Trivy | ⚠️ Limited |
| SBOM | ❌ None | ❌ None | ⚠️ Partial | ❌ None |
| Multi-arch | ✅ amd64+arm64 | ❌ amd64 only | ✅ amd64+arm64 | ❌ amd64 only |
| Agent Rules | ⚠️ CLAUDE.md only | ✅ Full rules | ❌ None | ❌ None |
| CI/CD Quality | ✅ Excellent (17 workflows) | ✅ Excellent | ✅ Good | ✅ Good |
| Pre-commit | ✅ Comprehensive | ✅ Comprehensive | ⚠️ Basic | ⚠️ Basic |
| Provider Testing | ✅ 5+ providers weekly | N/A | N/A | N/A |

**Notable strengths vs. gold standards:**
- Cross-provider weekly testing (unique among compared repos)
- OpenShift Showroom integration testing (unique)
- Claude Agent SDK session testing (unique)
- GitHub Pages test report dashboard (unique)

## File Paths Reference

### CI/CD
- `.github/workflows/redhat-distro-container.yml` — Main build/test/publish
- `.github/workflows/pre-commit.yml` — Linting
- `.github/workflows/semantic-pr.yml` — PR title enforcement
- `.github/workflows/responses-weekly.yml` — Weekly Responses API tests
- `.github/workflows/messages-weekly.yml` — Weekly Messages API tests
- `.github/workflows/test-pr-in-showroom.yml` — OpenShift PR testing
- `.github/workflows/test-upstream-in-showroom.yml` — Upstream testing
- `.github/actions/setup-vllm/action.yml` — vLLM composite action
- `.github/actions/setup-postgres/action.yml` — PostgreSQL composite action
- `.github/actions/setup-server/action.yml` — Server composite action
- `.tekton/odh-ogx-core-pull-request.yaml` — Konflux PR pipeline
- `.tekton/odh-ogx-core-push.yaml` — Konflux push pipeline

### Testing
- `tests/smoke.sh` — Smoke test suite (health, inference, Messages, PostgreSQL, RAG)
- `tests/run_integration_tests.sh` — Upstream integration test runner
- `tests/test_utils.sh` — Test helper utilities
- `tests/verify-config-label.sh` — OCI label verification
- `tests/messages_agent_sdk.py` — Claude Agent SDK session test
- `tests/functional/` — Bruno API contracts + Jupyter notebooks
- `tests/functional/scripts/run-tests-with-providers.sh` — Functional test runner
- `tests/functional/tests/test_notebooks.py` — Notebook pytest runner
- `tests/functional/bruno/` — Bruno API test collections

### Build
- `build/build.py` — Main build script (config, requirements, Containerfile generation)
- `build/build.yaml` — Provider definitions (source of truth)
- `build/build.env` — OGX version and build flags
- `build/gen_distro_docs.py` — Documentation generator
- `Containerfile.in` — Container build template
- `Containerfile` — Generated container build file

### Code Quality
- `.pre-commit-config.yaml` — Pre-commit hooks (Ruff, ShellCheck, Actionlint)
- `.github/dependabot.yml` — Dependency updates
- `.github/CODEOWNERS` — Code ownership
- `.github/PULL_REQUEST_TEMPLATE.md` — PR template
- `CLAUDE.md` — AI agent guidance

### Container Images
- `Containerfile` — Main container build (auto-generated)
- `Containerfile.in` — Container build template
- `vllm/Containerfile` — CI vLLM CPU image
- `distribution/entrypoint.sh` — Container entrypoint
- `distribution/config.yaml` — Runtime configuration (auto-generated)
- `distribution/requirements.txt` — Python dependencies (auto-generated)
- `distribution/constraints.txt` — Pip constraints
