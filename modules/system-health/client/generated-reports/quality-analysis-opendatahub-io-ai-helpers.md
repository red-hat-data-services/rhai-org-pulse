---
repository: "opendatahub-io/ai-helpers"
overall_score: 2.7
scorecard:
  - dimension: "Unit Tests"
    score: 2.0
    status: "Only 1 of ~30 Python scripts has tests (stream-claude.py); 3% test-to-code ratio"
  - dimension: "Integration/E2E"
    score: 1.0
    status: "No integration or E2E tests; no skill validation tests"
  - dimension: "Build Integration"
    score: 5.0
    status: "Container build on PR (path-filtered), multi-arch, SHA-pinned deps; no runtime validation"
  - dimension: "Image Testing"
    score: 3.0
    status: "Containers built on PR but not validated; no scanning; Cursor image uses unpinned tag"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No codecov, no coverage reporting, no coverage thresholds"
  - dimension: "CI/CD Automation"
    score: 7.0
    status: "Well-organized workflows, Mergify, Dependabot, skillsaw, CodeRabbit"
  - dimension: "Agent Rules"
    score: 5.0
    status: "AGENTS.md with quality checklist exists; no .claude/rules/ or test-specific rules"
critical_gaps:
  - title: "29 of 30 Python scripts have zero test coverage"
    impact: "Script bugs (e.g., in validate_tools.py, build-website.py, skill scripts) are only caught in production"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No coverage tracking or enforcement"
    impact: "No visibility into coverage trends; PRs can regress coverage with no warning"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container vulnerability scanning in CI"
    impact: "Vulnerable base images or dependencies ship without detection"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "Semgrep rules exist but are not run in CI"
    impact: "1800+ lines of security rules provide zero protection without a workflow to run them"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "Cursor Containerfile uses unpinned fedora:latest base image"
    impact: "Non-reproducible builds; breaking changes or vulnerabilities from upstream"
    severity: "MEDIUM"
    effort: "1 hour"
quick_wins:
  - title: "Add Semgrep CI workflow to run existing rules on PRs"
    effort: "1-2 hours"
    impact: "Activates 1800+ lines of security rules that currently sit unused"
  - title: "Add codecov integration to test workflow"
    effort: "2-3 hours"
    impact: "Immediate visibility into coverage gaps and PR-level coverage reporting"
  - title: "Add Trivy container scanning to build workflow"
    effort: "1-2 hours"
    impact: "Catch vulnerable packages in both container images before merge"
  - title: "Pin Cursor Containerfile base image by digest"
    effort: "30 minutes"
    impact: "Reproducible builds and controlled dependency updates via Dependabot"
  - title: "Add tests for validate_tools.py and build-website.py"
    effort: "4-6 hours"
    impact: "These are the most critical scripts; failures cause make update / make lint regressions"
recommendations:
  priority_0:
    - "Add unit tests for all Python scripts in scripts/ (validate_tools.py, update_claude_settings.py, build-website.py, fetch_external_plugins.py)"
    - "Run Semgrep in CI using the existing semgrep.yaml rules file"
    - "Add container scanning (Trivy) to the build workflow for both images"
    - "Add codecov integration with PR coverage reporting and minimum thresholds"
  priority_1:
    - "Add tests for Python scripts in helpers/skills/*/scripts/ (30+ scripts)"
    - "Pin Cursor Containerfile base image by digest and add to Dependabot"
    - "Add container runtime validation tests (image starts, entrypoint works, tools available)"
    - "Add concurrency control to lint and test workflows to avoid redundant runs"
    - "Create .claude/rules/ with test creation guidelines for contributors"
  priority_2:
    - "Add mypy or pyright type checking for Python code"
    - "Add SBOM generation to container builds"
    - "Add image signing/attestation with cosign"
    - "Add skill integration tests that validate skill metadata against agentskills.io spec programmatically"
    - "Add Python dependency scanning via Dependabot for pip/uv packages"
---

# Quality Analysis: opendatahub-io/ai-helpers

## Executive Summary
- Overall Score: 2.7/10
- Key Strengths: Excellent CI/CD automation (Mergify, Dependabot, skillsaw, CodeRabbit), comprehensive Semgrep security rules, well-documented contributor guidelines (AGENTS.md), SHA-pinned GitHub Actions and container downloads
- Critical Gaps: Near-zero test coverage (1 of 30 Python scripts tested), no coverage tracking, Semgrep rules never run in CI, no container scanning
- Agent Rules Status: Partial - AGENTS.md exists with contributor checklist but no `.claude/rules/` or test-specific guidance

## Quality Scorecard
| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 2.0/10 | Only 1 of ~30 Python scripts has tests; 3% test-to-code ratio |
| Integration/E2E | 1.0/10 | No integration or E2E tests; no skill validation tests |
| **Build Integration** | **5.0/10** | **Container build on PR (path-filtered), multi-arch, SHA-pinned deps; no runtime validation** |
| Image Testing | 3.0/10 | Containers built on PR but not validated; no scanning; Cursor uses unpinned tag |
| Coverage Tracking | 0.0/10 | No codecov, no coverage reporting, no coverage thresholds |
| CI/CD Automation | 7.0/10 | Well-organized workflows, Mergify, Dependabot, skillsaw, CodeRabbit |
| Agent Rules | 5.0/10 | AGENTS.md with quality checklist; no .claude/rules/ or test-specific rules |

## Critical Gaps

1. **29 of 30 Python scripts have zero test coverage**
   - Impact: Script bugs in validate_tools.py, build-website.py, update_claude_settings.py, fetch_external_plugins.py, and 30+ skill scripts are only caught when they break production or CI
   - Severity: HIGH
   - Effort: 16-24 hours for core scripts, additional time for skill scripts

2. **No coverage tracking or enforcement**
   - Impact: No visibility into what percentage of code is tested; PRs can remove tests or regress coverage with zero warning
   - Severity: HIGH
   - Effort: 2-4 hours

3. **No container vulnerability scanning in CI**
   - Impact: Vulnerable packages in UBI10 or Fedora base images, or in installed tools (gh, glab, oc, ShellCheck), ship without detection
   - Severity: HIGH
   - Effort: 2-3 hours

4. **Semgrep rules exist but are not run in CI**
   - Impact: The repository contains 1800+ lines of comprehensive security rules (semgrep.yaml) covering Go, Python, TypeScript, YAML, Dockerfile, and Shell — but no workflow runs them, providing zero protection
   - Severity: HIGH
   - Effort: 1-2 hours

5. **Cursor Containerfile uses unpinned `fedora:latest` base image**
   - Impact: Non-reproducible builds; upstream Fedora releases could introduce breaking changes or vulnerabilities silently
   - Severity: MEDIUM
   - Effort: 1 hour

## Quick Wins

1. **Add Semgrep CI workflow to run existing rules on PRs**
   - Effort: 1-2 hours
   - Impact: Activates 1800+ lines of comprehensive security rules that already exist in the repo
   - Implementation:
   ```yaml
   # .github/workflows/semgrep.yml
   name: Semgrep
   on:
     pull_request:
       branches: [main]
   jobs:
     scan:
       runs-on: ubuntu-latest
       permissions:
         contents: read
       steps:
         - uses: actions/checkout@v4
         - uses: returntocorp/semgrep-action@v1
           with:
             config: semgrep.yaml
   ```

2. **Add codecov integration to test workflow**
   - Effort: 2-3 hours
   - Impact: Immediate visibility into coverage gaps; PR-level reporting
   - Implementation: Add `--cov --cov-report=xml` to pytest, upload to Codecov

3. **Add Trivy container scanning to build workflow**
   - Effort: 1-2 hours
   - Impact: Catch known vulnerabilities in both container images before merge
   - Implementation:
   ```yaml
   - name: Scan image
     uses: aquasecurity/trivy-action@master
     with:
       image-ref: ${{ env.IMAGE_NAME }}
       severity: 'CRITICAL,HIGH'
       exit-code: '1'
   ```

4. **Pin Cursor Containerfile base image by digest**
   - Effort: 30 minutes
   - Impact: Reproducible builds; Dependabot will manage updates
   - Implementation: Change `FROM quay.io/fedora/fedora:latest` to `FROM quay.io/fedora/fedora:42@sha256:<digest>`

5. **Add tests for validate_tools.py and build-website.py**
   - Effort: 4-6 hours
   - Impact: These scripts power `make update` and `make lint` — their correctness is a hard gate on every PR

## Detailed Findings

### CI/CD Pipeline

**Strengths:**
- 9 workflows covering build, lint, test, deploy, stale PR management, label sync, issue assignment, unicode safety
- All GitHub Action refs pinned to SHA hashes (excellent supply chain security)
- Mergify auto-merge with differentiated approval requirements (1 for maintainers, 2 for members)
- Merge queue with squash strategy
- Dependabot configured for GitHub Actions (weekly) and Docker base images
- Skillsaw linter validates AI skill structure on every PR
- CodeRabbit AI review with custom path-specific instructions and pre-merge checks
- `make update` drift detection prevents stale generated files

**Gaps:**
- No concurrency control on lint or test workflows (redundant runs on rapid pushes)
- No caching for Python dependencies in the test workflow
- Test workflow installs only pytest; doesn't install repo dependencies
- No workflow to run Semgrep security rules

### Test Coverage

**Current State:**
- **1 test file**: `images/claude/tests/test_stream_claude.py` (303 lines)
- **Framework**: pytest
- **What's tested**: stream-claude.py script — exit codes, text output rendering, tool formatting (Bash, Read, Edit, Grep, Glob, Write, Agent, Skill), system events, error handling, log file output, malformed input handling, token statistics
- **What's NOT tested** (0 coverage):
  - `scripts/validate_tools.py` — validates skill/plugin structure
  - `scripts/update_claude_settings.py` — generates Claude settings
  - `scripts/build-website.py` — builds website data
  - `scripts/fetch_external_plugins.py` — fetches external plugin repos
  - `.skillsaw-custom.py` — custom skillsaw rules
  - 30+ Python scripts in `helpers/skills/*/scripts/` (license finders, dependency resolvers, security auditors, backport classifiers, etc.)
  - All shell scripts (`images/claude/claude-ci-entrypoint.sh`, `scripts/scp_cred.sh`)

**Test-to-Code Ratio**: ~303 test lines / ~9,339 Python lines = **3.2%**

### Code Quality

**Strengths:**
- **Ruff**: Configured with F, E, W, I, N rule sets; format checking enforced
- **Shellcheck**: All `.sh` files scanned in lint workflow
- **Skillsaw**: Custom AI skill linter with context-budget limits and strict mode
- **Pre-commit hooks**: Red Hat AI hooks + make lint + make update
- **CodeRabbit**: AI-powered PR review with security-aware path instructions (skills reviewed differently from scripts)
- **AGENTS.md**: Detailed contributor checklist (no orphaned tests, fenced code blocks with language, shell script requirements, Python best practices, Containerfile security)

**Gaps:**
- No Python type checking (mypy/pyright)
- No complexity analysis tool
- Ruff rules are minimal (only F, E, W, I, N) — missing B (bugbear), S (security), C (complexity)

### Container Images

**Claude Image (UBI10-based):**
- Base image pinned by digest
- Multi-arch: linux/amd64 + linux/arm64
- SHA256 verification for ShellCheck, GitHub CLI, GitLab CLI downloads
- Non-root user (claude, UID 1000)
- Entrypoint wrapper script with CI streaming support
- Includes pre-configured Claude Code settings and marketplace
- External plugin repos fetched at build time

**Cursor Image (Fedora-based):**
- Base image **NOT pinned** — uses `quay.io/fedora/fedora:latest`
- No SHA verification for tool downloads (oc CLI downloaded without checksum)
- No multi-arch matrix (inherits from build workflow but Fedora image may not support all tools)
- Non-root user (cursor, UID 1000)

**Common Gaps:**
- No container scanning (Trivy, Snyk, Grype) in CI
- No SBOM generation
- No image signing or attestation
- No runtime validation tests (start container, check tools exist, run basic commands)
- `uv` installer downloaded without integrity check (`curl | sh` pattern)

### Security

**Strengths:**
- **Semgrep rules** (semgrep.yaml): 1800+ lines covering 40+ rules across:
  - Generic secrets detection (hardcoded passwords, AWS keys, GitHub tokens, Slack webhooks, Google API keys, private keys)
  - Kubernetes RBAC security (wildcard resources/verbs, dangerous verbs, cluster-admin binding, broad subjects)
  - Kubernetes container security (privileged mode, runAsNonRoot, hostPath, secrets in ConfigMaps, automount tokens)
  - GitHub Actions security (hardcoded secrets, script injection, pull_request_target checkout)
  - Go security (exec injection, TLS skip verify, SQL injection, weak crypto, hardcoded creds)
  - Python security (eval/exec, SQL injection, pickle/YAML unsafe load, subprocess shell injection, path traversal, HuggingFace trust_remote_code, torch.load)
  - TypeScript/JS security (XSS, eval, localStorage, ReDoS, postMessage origin)
  - Dockerfile security (latest tag, secrets in ENV)
  - Shell script security (eval, unquoted variables)
- **Gitleaks**: Comprehensive configuration with test file allowlists
- **Unicode safety check**: Detects hidden unicode characters in PRs
- **Dependabot**: Weekly updates for GitHub Actions and Docker base images

**Critical Gap:** None of the Semgrep rules are actually executed in CI. The rules file exists but no workflow invokes Semgrep.

### Agent Rules (Agentic Flow Quality)

**Status**: Partial
- **AGENTS.md** (symlinked as CLAUDE.md): Comprehensive contributor quality checklist covering:
  - General: No orphaned tests, no unnecessary dependencies
  - Markdown: Language identifiers on code blocks, consistent naming
  - Shell: `set -euo pipefail`, shellcheck, quoted variables
  - Python: ruff compliance, HTTP timeouts, proper error handling, encoding
  - Containerfiles/CI: Pinned images, integrity verification, SHA-pinned Actions
  - Skills: make update, least-privilege allowed_tools, native CLI preference
- **Missing**:
  - No `.claude/rules/` directory
  - No test-specific rules (how to write tests, what to test, testing standards)
  - No skill testing guidelines (how to validate a new skill works)
  - No `CLAUDE.md` content beyond the symlink to AGENTS.md
- **Recommendation**: Run `/test-rules-generator` to create comprehensive test rules

## Recommendations

### Priority 0 (Critical)

- **Add unit tests for core Python scripts** — validate_tools.py, update_claude_settings.py, build-website.py, and fetch_external_plugins.py are critical infrastructure. Failures in these scripts break every PR via `make lint` / `make update`.
- **Run Semgrep in CI** — Create a workflow that runs `semgrep --config semgrep.yaml` on every PR. The rules already exist and are comprehensive.
- **Add container scanning** — Add Trivy to the build workflow. Both images install external tools from the internet; scanning catches vulnerable versions.
- **Add codecov integration** — Add `--cov` to pytest, upload XML to Codecov, set a minimum coverage threshold (start at current level, ratchet up).

### Priority 1 (High Value)

- **Add tests for skill scripts** — The 30+ Python scripts in `helpers/skills/*/scripts/` perform real operations (Jira API calls, license scanning, dependency resolution). Unit tests with mocked external calls would catch regressions.
- **Pin Cursor Containerfile base image** — Replace `fedora:latest` with a digest-pinned version. Add to Dependabot config.
- **Add container runtime validation** — After building, start the container and verify: entrypoint runs, `claude --version` works, `gh --version` works, `glab --version` works, `oc version` works.
- **Add concurrency control** — Add `concurrency: group: ${{ github.workflow }}-${{ github.ref }}` to lint and test workflows.
- **Create .claude/rules/ directory** — Add test creation rules, skill development rules, and Python scripting rules.

### Priority 2 (Nice-to-Have)

- **Add mypy/pyright type checking** — Python scripts would benefit from type annotations and static checking.
- **Add SBOM generation** — Use syft or docker buildx SBOM to generate SBOMs for both images.
- **Add image signing** — Use cosign to sign images for supply chain attestation.
- **Add skill integration tests** — Programmatically validate skill metadata against agentskills.io spec (beyond what skillsaw checks).
- **Expand Ruff rules** — Add B (bugbear), S (bandit/security), C (complexity) rule sets.
- **Add Python dependency scanning** — Add a Dependabot entry for pip/uv to catch vulnerable Python packages.

## Comparison to Gold Standards

| Dimension | ai-helpers | odh-dashboard | notebooks | kserve |
|-----------|-----------|---------------|-----------|--------|
| Unit Tests | 2/10 (1 file) | 9/10 (comprehensive) | 7/10 | 9/10 |
| Integration/E2E | 1/10 (none) | 9/10 (Cypress E2E) | 8/10 | 9/10 |
| Build Integration | 5/10 (build only) | 8/10 | 7/10 | 8/10 |
| Image Testing | 3/10 (no validation) | 7/10 | 9/10 (5-layer) | 7/10 |
| Coverage Tracking | 0/10 (none) | 8/10 (codecov) | 6/10 | 9/10 (enforcement) |
| CI/CD Automation | 7/10 (strong) | 9/10 | 8/10 | 9/10 |
| Agent Rules | 5/10 (partial) | 8/10 (comprehensive) | 4/10 | 3/10 |
| **Overall** | **2.7/10** | **8.5/10** | **7.5/10** | **8.0/10** |

**Key Takeaway:** ai-helpers has invested heavily in CI/CD automation and security rule authoring but has a critical blind spot: almost nothing is actually tested. The gap between security rules existing (Semgrep) and security rules being enforced (no CI workflow) is emblematic of the overall pattern.

## File Paths Reference

### CI/CD
- `.github/workflows/build.yml` — Container build (PR + main + nightly)
- `.github/workflows/lint.yml` — Skillsaw + Ruff + Shellcheck + make update drift
- `.github/workflows/test.yml` — pytest runner
- `.github/workflows/deploy.yml` — GitHub Pages deployment
- `.github/workflows/lint-review.yml` — Skillsaw PR review comments
- `.github/workflows/unicode-safety.yml` — Hidden unicode detection
- `.github/workflows/stale-pr.yml` — Stale PR management
- `.github/workflows/sync-labels.yml` — Label synchronization
- `.github/workflows/issue-assign.yml` — /assign command handler
- `.mergify.yml` — Auto-merge configuration
- `.github/dependabot.yml` — Dependency update automation

### Testing
- `images/claude/tests/test_stream_claude.py` — Only test file (303 lines)
- `Makefile` — `make test` target (runs pytest)

### Code Quality
- `.ruff.toml` — Python linting (F, E, W, I, N rules)
- `.pre-commit-config.yaml` — Pre-commit hooks (rh-hooks-ai, make lint, make update)
- `.skillsaw.yaml` — Skill validation configuration
- `.coderabbit.yaml` — AI review with path-specific instructions
- `semgrep.yaml` — Security rules (NOT run in CI)

### Container Images
- `images/claude/Containerfile` — Claude Code CI image (UBI10, digest-pinned)
- `images/cursor/Containerfile` — Cursor AI image (Fedora, **unpinned**)
- `images/claude/stream-claude.py` — CI streaming output formatter
- `images/claude/claude-ci-entrypoint.sh` — Container entrypoint

### Security
- `semgrep.yaml` — 40+ security rules across 9 language categories
- `.gitleaks.toml` — Secret detection configuration
- `.gitleaksignore` — Gitleaks allowlist

### Agent Rules
- `AGENTS.md` — Contributor quality checklist
- `CLAUDE.md` → symlink to AGENTS.md
- `.claude-plugin/marketplace.json` — Plugin marketplace configuration

### Key Scripts (untested)
- `scripts/validate_tools.py` — Validates skill/plugin structure
- `scripts/update_claude_settings.py` — Generates Claude settings
- `scripts/build-website.py` — Builds docs/data.json website data
- `scripts/fetch_external_plugins.py` — Fetches external plugin repositories
