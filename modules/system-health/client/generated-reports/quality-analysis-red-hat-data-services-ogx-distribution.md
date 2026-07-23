---
repository: "red-hat-data-services/ogx-distribution"
overall_score: 7.2
scorecard:
  - dimension: "Unit Tests"
    score: 5.0
    status: "Shell-based unit tests for entrypoint secret resolution; limited pytest for notebooks; no unit tests for build scripts"
  - dimension: "Integration/E2E"
    score: 8.0
    status: "Comprehensive smoke + integration tests against live containers; multi-provider E2E via Responses/Messages weekly suites; Showroom OpenShift testing"
  - dimension: "Build Integration"
    score: 8.5
    status: "PR-triggered multi-arch container builds; Konflux Tekton pipeline; OCI label verification; Dockerfile sync checks"
  - dimension: "Image Testing"
    score: 8.0
    status: "Multi-arch builds (amd64/arm64); UBI-based images; container startup validation; smoke tests against built image"
  - dimension: "Coverage Tracking"
    score: 1.0
    status: "No coverage tool configured; no codecov/coveralls; no coverage thresholds or PR reporting"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "21 workflows; concurrency control; GHA caching; multi-provider matrix testing; Mergify auto-merge; Slack notifications; GitHub Pages reports"
  - dimension: "Static Analysis"
    score: 9.0
    status: "Comprehensive pre-commit (Ruff, Shellcheck, Actionlint); Dependabot + Renovate; secret scrub verification; custom pre-commit hooks"
  - dimension: "Agent Rules"
    score: 7.0
    status: "Detailed CLAUDE.md with architecture, commands, and CI/CD docs; no .claude/rules/ directory"
critical_gaps:
  - title: "No code coverage tracking"
    impact: "Cannot measure test coverage trends, no coverage gates on PRs, regressions may go unnoticed"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No unit tests for build scripts (1,293 lines of Python)"
    impact: "Build pipeline logic (gen_config, gen_lockfile, gen_containerfile, verify_secrets) is untested; breakage discovered only at CI time"
    severity: "HIGH"
    effort: "12-16 hours"
  - title: "No pytest-cov or coverage reporting in any test execution"
    impact: "Even existing tests don't report coverage metrics; impossible to set thresholds"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add codecov integration with pytest-cov"
    effort: "2-4 hours"
    impact: "Immediate visibility into coverage for Python code; PR coverage comments"
  - title: "Add .claude/rules/ directory with test creation guidelines"
    effort: "2-3 hours"
    impact: "Improve AI-generated test quality with framework-specific patterns"
  - title: "Add unit tests for build/verify_secrets.py as a starting point"
    effort: "3-4 hours"
    impact: "Quick coverage win for the most testable build script"
recommendations:
  priority_0:
    - "Add coverage tracking with codecov or pytest-cov to measure and enforce test coverage"
    - "Write unit tests for the 1,293 lines of Python build scripts (gen_config.py, gen_containerfile.py, gen_lockfile.py, verify_secrets.py)"
  priority_1:
    - "Add .claude/rules/ with test creation guidelines covering pytest, shell tests, and notebook tests"
    - "Add FIPS compatibility checks for base images and Python crypto dependencies"
  priority_2:
    - "Add Bruno API test automation to PR workflows (currently manual)"
    - "Add pytest markers for test categorization (smoke, integration, slow)"
---

# Quality Analysis: ogx-distribution

## Executive Summary

- **Overall Score: 7.2/10**
- **Repository Type**: Containerized Python distribution (OGX/Llama Stack fork)
- **Primary Language**: Python 3.12, Shell (Bash)
- **Jira**: RHOAIENG / OGX Core (downstream tier)
- **Key Strengths**: Excellent CI/CD automation with 21 workflows, strong multi-provider integration testing, comprehensive static analysis with custom pre-commit hooks, well-documented CLAUDE.md
- **Critical Gaps**: Zero code coverage tracking, no unit tests for build pipeline scripts
- **Agent Rules Status**: CLAUDE.md present with detailed architecture docs; no `.claude/rules/` directory

## Quality Scorecard

| Dimension | Score | Weight | Weighted | Status |
|-----------|-------|--------|----------|--------|
| Unit Tests | 5.0/10 | 15% | 0.75 | Shell-based unit tests for entrypoint; limited pytest; build scripts untested |
| Integration/E2E | 8.0/10 | 20% | 1.60 | Comprehensive smoke + integration + multi-provider E2E + Showroom |
| Build Integration | 8.5/10 | 15% | 1.28 | PR-triggered multi-arch builds; Konflux pipeline; OCI label checks |
| Image Testing | 8.0/10 | 10% | 0.80 | Multi-arch; UBI base; smoke validation; health checks via tests |
| Coverage Tracking | 1.0/10 | 10% | 0.10 | No coverage tool, no thresholds, no PR reporting |
| CI/CD Automation | 9.0/10 | 15% | 1.35 | 21 workflows; concurrency; caching; Mergify; Slack; Pages |
| Static Analysis | 9.0/10 | 10% | 0.90 | Ruff + Shellcheck + Actionlint + custom hooks; Dependabot + Renovate |
| Agent Rules | 7.0/10 | 5% | 0.35 | Detailed CLAUDE.md; no .claude/rules/ |
| **Overall** | **7.2/10** | **100%** | **7.13** | |

## Critical Gaps

### 1. No Code Coverage Tracking
- **Impact**: Cannot measure test coverage, set thresholds, or track trends. Regression risk is invisible.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: No `.codecov.yml`, no `pytest-cov` in any workflow, no coverage gates on PRs. The repo has ~1,293 lines of Python build scripts and ~1,015 lines of test code, but there's no way to know what percentage is covered.

### 2. Build Scripts Lack Unit Tests
- **Impact**: The Python build pipeline (gen_config.py, gen_containerfile.py, gen_lockfile.py, verify_secrets.py, common.py, fetch_artifacts.py) totaling 1,293 lines has zero unit tests. Breakage is only caught when CI runs the full container build.
- **Severity**: HIGH
- **Effort**: 12-16 hours
- **Details**: These scripts are the backbone of the distribution pipeline. They generate Containerfiles, lockfiles, config files, and documentation. Any bug in them can break downstream builds.

### 3. No Coverage Reporting on Tests
- **Impact**: Even the existing pytest-based notebook tests and shell tests don't collect or report coverage.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
- Add `pytest-cov` to functional test dependencies
- Add `.codecov.yml` with minimum coverage thresholds
- Add codecov upload step to CI workflow

### 2. Add `.claude/rules/` with Test Guidelines (2-3 hours)
- Create rules for pytest patterns, shell test patterns, notebook test patterns
- Document the existing test_file_secrets.sh pattern as a template for new shell tests
- Add framework-specific examples

### 3. Unit Test verify_secrets.py (3-4 hours)
- Most testable build script — pure validation logic
- Already has clear input/output contracts
- Good starting point for build script test coverage

## Detailed Findings

### Unit Tests

**Score: 5.0/10**

**What exists:**
- `tests/test_file_secrets.sh` (172 lines) — Well-structured shell unit tests for the entrypoint's `_FILE` secret resolution. Tests 8 scenarios including edge cases (special characters, mutual exclusion, missing files, noop). This is a **gold-standard shell test file**.
- `tests/functional/tests/test_notebooks.py` (36 lines) — Pytest-based notebook execution tests using nbformat/nbconvert. Parameterized, with assertion validation.
- `tests/functional/scripts/lint_bruno.py` (27 lines) — Linter that verifies Bruno `.bru` files have assertion blocks.
- `build/verify_secrets.py` (101 lines) — Validates `_FILE` secret sync between `build.yaml` and `entrypoint.sh`. Runs as a pre-commit hook.

**What's missing:**
- No unit tests for `build/gen_config.py` (91 lines), `build/gen_containerfile.py` (78 lines), `build/gen_lockfile.py` (336 lines), `build/gen_distro_docs.py` (324 lines)
- No unit tests for `distribution/fetch_artifacts.py` (94 lines)
- No unit tests for `scripts/sync_labels.py` (74 lines)
- Test-to-code ratio is low: ~1,015 lines of test code vs ~1,293 lines of production Python

### Integration/E2E Tests

**Score: 8.0/10**

**Strengths:**
- `tests/smoke.sh` (475 lines) — Comprehensive smoke test suite that validates the container against a live vLLM + PostgreSQL stack. Tests inference, embeddings, provider activation, file handling, and more.
- `tests/run_integration_tests.sh` (168 lines) — Clones upstream OGX repo and runs its full test suite against the built container.
- **Multi-provider E2E**: Weekly response test suites across 4 providers (OpenAI, Vertex AI, vLLM MaaS, Bedrock) with JUnit reporting and GitHub Pages dashboard.
- **Messages API testing**: Separate weekly suite for Anthropic-compatible Messages API across OpenAI and native vLLM.
- **Showroom testing**: Daily + on-demand deployment tests against a real OpenShift cluster via `test-pr-in-showroom.yml` and `test-upstream-in-showroom.yml`.
- **Bruno API tests**: Manual API test collection in `tests/functional/bruno/` with assertion validation.

**Gaps:**
- Bruno API tests are not automated in PR workflows
- No contract tests between OGX and its providers
- No explicit test categorization (markers/tags)

### Build Integration

**Score: 8.5/10**

**Strengths:**
- `redhat-distro-container.yml` — PR-triggered multi-arch (amd64/arm64) container builds with matrix strategy
- `Dockerfile.konflux` + `.tekton/odh-ogx-core-pull-request.yaml` — Full Konflux Tekton pipeline for downstream hermetic builds (3 architectures: x86_64, arm64, ppc64le)
- `verify-konflux-dockerfile.yml` — Ensures `Dockerfile.konflux` stays in sync with `Containerfile`
- OCI config label verification (`tests/verify-config-label.sh`) validates config.yaml is correctly embedded in built images
- Pre-commit hooks regenerate Containerfile, config.yaml, and validate secrets on every commit
- Mergify auto-merge with CI-awareness (only requires build-test when relevant paths change)
- GHA build caching (`cache-from: type=gha`)

**Gaps:**
- No dry-run kustomize/kubectl validation
- No CRD or operator manifest testing (distribution doesn't deploy as an operator directly)

### Image Testing

**Score: 8.0/10**

**Strengths:**
- Multi-architecture: amd64 + arm64 in GitHub Actions; x86_64 + arm64 + ppc64le in Konflux
- UBI-based images (`quay.io/opendatahub/odh-midstream-python-base-3-12`) — FIPS-capable base
- Container startup validation in smoke tests: builds image, starts it with Docker, waits for health endpoint
- OCI metadata labels verified programmatically
- Separate vLLM CPU container (`vllm/Containerfile`) for CI testing infrastructure
- Image artifact upload/download pattern in Showroom workflow ensures fork code isolation

**Gaps:**
- No formal HEALTHCHECK instruction in Containerfile (health is validated externally by smoke tests)
- No explicit multi-stage build (single FROM layer)
- No Testcontainers integration (tests use raw Docker commands)

### Coverage Tracking

**Score: 1.0/10**

- No `.codecov.yml` or coverage configuration of any kind
- No `pytest-cov` in test dependencies
- No `--coverprofile` or equivalent in any CI workflow
- No coverage thresholds or PR reporting
- No coverage gates in Mergify rules
- This is the single largest gap in the repository's quality posture

### CI/CD Automation

**Score: 9.0/10**

**Workflow Inventory (21 workflows):**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `redhat-distro-container.yml` | PR, push, schedule (daily 6AM), dispatch | Main build/test/publish pipeline |
| `pre-commit.yml` | PR, push to main | Ruff, Shellcheck, Actionlint, custom hooks |
| `semantic-pr.yml` | PR | Conventional Commits title enforcement |
| `verify-konflux-dockerfile.yml` | PR, push (path-filtered) | Dockerfile sync verification |
| `vllm-cpu-container.yml` | PR, push (path-filtered), dispatch | vLLM CPU image build/test |
| `responses-weekly.yml` | Schedule (Sunday 22:00 UTC), dispatch | Multi-provider Responses API test suite |
| `responses-openai.yml` | Callable, dispatch | OpenAI provider tests |
| `responses-vertexai.yml` | Callable, dispatch | Vertex AI provider tests |
| `responses-vllm-maas.yml` | Callable, dispatch | vLLM MaaS provider tests |
| `responses-bedrock.yml` | Callable, dispatch | AWS Bedrock provider tests |
| `messages-weekly.yml` | Schedule (Sunday 23:00 UTC), dispatch | Messages API test suite |
| `messages-openai.yml` | Callable, dispatch | Messages OpenAI tests |
| `messages-vllm.yml` | Callable, dispatch | Messages vLLM native tests |
| `test-pr-in-showroom.yml` | Schedule (daily 8AM), dispatch | PR testing on OpenShift |
| `test-upstream-in-showroom.yml` | Schedule (daily 2AM), dispatch | Upstream testing on OpenShift |
| `update-lockfiles.yml` | Schedule (daily 4AM), dispatch | Automated lockfile regeneration |
| `update-wheels.yml` | Repository dispatch | Wheel update automation |
| `create-or-update-release-branch.yml` | Repository dispatch | Release branch management |
| `stale_bot.yml` | Schedule (daily midnight) | Stale issue/PR management |
| (Mergify) | PR events | Auto-merge, rebase, conflict detection |
| (Tekton) | PR (Konflux) | Downstream hermetic builds |

**Strengths:**
- Concurrency control on all major workflows (`cancel-in-progress: true`)
- GHA build caching (`type=gha,scope=build-{arch}`)
- Matrix strategy for multi-arch builds
- Slack notifications on failure
- GitHub Pages for test report publishing
- Mergify with smart CI-aware auto-merge rules
- Fork/Dependabot PR security: credential validation, untrusted author checks
- Secret scrubbing in CI logs (CWE-532 compliance)
- Provider credential validation before test execution (graceful degradation)

**Gaps:**
- No test parallelization within individual test runs
- No explicit timeout on all workflows (some have it, some don't)

### Static Analysis

**Score: 9.0/10**

#### Linting
- **Ruff**: Python linting + formatting via pre-commit (`ruff --fix`, `ruff-format`)
- **Shellcheck**: Shell script linting via pre-commit
- **Actionlint**: GitHub Actions workflow linting via pre-commit
- **Custom hooks**: `gen-config`, `gen-containerfile`, `verify-secrets`, `doc-gen`, `check-secret-scrub` — 5 custom pre-commit hooks that validate build artifacts and security properties

#### FIPS Compatibility
- Base image: `quay.io/opendatahub/odh-midstream-python-base-3-12` (UBI-based, FIPS-capable)
- Konflux builds use `${BASE_IMAGE}` parameter (downstream UBI images)
- No explicit FIPS build tags or crypto library checks
- No scan for non-FIPS-compliant Python crypto usage (e.g., `hashlib.md5`)

#### Dependency Alerts
- **Dependabot**: Configured for 3 ecosystems (github-actions, uv/pip, docker). Security-only for pip updates (`open-pull-requests-limit: 0`).
- **Renovate**: Two configs (root `renovate.json` + `.github/renovate.json`) extending shared Konflux central config. Rate-limited (30 concurrent, 4/hour).
- Auto-merge for dependency PRs via Mergify (github-deps with 1 approval)

#### Pre-commit Configuration
Comprehensive 12-hook configuration:
- Standard hooks: merge-conflict, trailing-whitespace, large-files, end-of-file-fixer, no-commit-to-branch, check-yaml, detect-private-key, mixed-line-ending, check-executables, check-json, check-shebang, check-symlinks, check-toml
- Ruff (lint + format)
- Actionlint
- Shellcheck
- 5 custom local hooks

### Agent Rules

**Score: 7.0/10**

**What exists:**
- `CLAUDE.md` (detailed, ~150 lines) covering:
  - Project overview and architecture
  - Common commands
  - Build pipeline documentation (4 pre-commit hooks + gen_lockfile)
  - Auto-generated file inventory
  - Key file descriptions
  - Provider activation pattern
  - Version management
  - CI/CD overview
  - PR title format requirements

**What's missing:**
- No `.claude/` directory
- No `.claude/rules/` with test creation guidelines
- No `AGENTS.md`
- CLAUDE.md focuses on architecture understanding, not test creation guidance
- No framework-specific test patterns (e.g., "how to write a new smoke test", "how to add a new pytest test")

## Recommendations

### Priority 0 (Critical)

1. **Add coverage tracking** — Install `pytest-cov`, create `.codecov.yml`, add coverage upload to CI. Start with the functional tests and expand.
2. **Write unit tests for build scripts** — The build pipeline Python code (1,293 lines) has zero test coverage. Start with `verify_secrets.py` (simplest) and `gen_config.py`, then tackle `gen_lockfile.py` and `gen_containerfile.py`.

### Priority 1 (High Value)

3. **Add `.claude/rules/` directory** — Create rules for:
   - `unit-tests.md` — pytest patterns for build script testing, shell test patterns following test_file_secrets.sh
   - `integration-tests.md` — How to add new smoke test cases, Bruno API tests
   - `notebook-tests.md` — How to add new notebook test scenarios
4. **Add FIPS crypto scanning** — Scan Python dependencies for non-FIPS-compliant crypto usage and add a CI check

### Priority 2 (Nice-to-Have)

5. **Automate Bruno API tests in PR workflow** — Currently manual; adding to the PR pipeline would catch API contract regressions
6. **Add pytest markers** — Categorize tests with markers (`@pytest.mark.smoke`, `@pytest.mark.integration`, `@pytest.mark.slow`) for selective execution
7. **Add HEALTHCHECK to Containerfile** — The container is validated externally, but a formal Docker HEALTHCHECK would benefit local development and deployment

## Comparison to Gold Standards

| Dimension | ogx-distribution | odh-dashboard | notebooks | kserve |
|-----------|-----------------|---------------|-----------|--------|
| Unit Tests | Shell + pytest (5/10) | Jest + React Testing Library (9/10) | pytest (7/10) | Go testing (9/10) |
| Integration/E2E | Smoke + multi-provider + Showroom (8/10) | Cypress + contract tests (9/10) | 5-layer validation (8/10) | envtest + E2E (9/10) |
| Build Integration | Multi-arch + Konflux + OCI checks (8.5/10) | PR builds (8/10) | Image pipeline (8/10) | Operator bundle (8/10) |
| Image Testing | Multi-arch + UBI + smoke (8/10) | N/A (6/10) | Multi-arch + FIPS (9/10) | envtest (7/10) |
| Coverage Tracking | None (1/10) | Codecov (8/10) | Coverage gates (7/10) | Codecov + thresholds (9/10) |
| CI/CD Automation | 21 workflows + Mergify (9/10) | Comprehensive (9/10) | Matrix testing (8/10) | Prow + GHA (9/10) |
| Static Analysis | Ruff + Shellcheck + Actionlint + custom (9/10) | ESLint + strict TS (8/10) | Basic linting (6/10) | golangci-lint (8/10) |
| Agent Rules | CLAUDE.md (7/10) | CLAUDE.md + rules (9/10) | None (2/10) | None (2/10) |

## File Paths Reference

### CI/CD
- `.github/workflows/` — 21 workflow files
- `.github/mergify.yml` — Mergify auto-merge rules
- `.github/dependabot.yml` — Dependabot for github-actions, uv, docker
- `.github/renovate.json` + `renovate.json` — Renovate configs
- `.tekton/odh-ogx-core-pull-request.yaml` — Konflux build pipeline
- `.github/actions/` — 6 composite actions (setup-vllm, setup-server, setup-postgres, regenerate-artifacts, notify-slack, free-disk-space)

### Testing
- `tests/smoke.sh` — Main smoke test suite (475 lines)
- `tests/run_integration_tests.sh` — Integration test runner (168 lines)
- `tests/test_file_secrets.sh` — Unit tests for secret resolution (172 lines)
- `tests/verify-config-label.sh` — OCI label verification (68 lines)
- `tests/scrub_secrets.sh` — CI log secret scrubbing (39 lines)
- `tests/check_secret_scrub_list.sh` — Secret scrub list sync check (47 lines)
- `tests/functional/tests/test_notebooks.py` — Notebook execution tests (36 lines)
- `tests/functional/bruno/` — Bruno API test collection
- `tests/functional/notebooks/test_basic_inference.ipynb` — Notebook test

### Build Scripts
- `build/gen_config.py` — Generates distribution/config.yaml (91 lines)
- `build/gen_containerfile.py` — Generates Containerfile from template (78 lines)
- `build/gen_lockfile.py` — Generates requirements lockfiles (336 lines)
- `build/gen_distro_docs.py` — Generates distribution README (324 lines)
- `build/verify_secrets.py` — Validates secret env var sync (101 lines)
- `build/common.py` — Shared BuildConfig (34 lines)

### Container Files
- `Containerfile` — Auto-generated from Containerfile.in
- `Containerfile.in` — Container build template
- `Dockerfile.konflux` — Auto-generated Konflux Dockerfile
- `Dockerfile.konflux.in` — Konflux Dockerfile template
- `vllm/Containerfile` — vLLM CPU container for CI

### Code Quality
- `.pre-commit-config.yaml` — 12+ hooks including 5 custom
- `CLAUDE.md` — Agent rules and architecture documentation
