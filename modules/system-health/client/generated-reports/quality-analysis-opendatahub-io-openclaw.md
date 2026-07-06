---
repository: "opendatahub-io/openclaw"
overall_score: 8.6
scorecard:
  - dimension: "Unit Tests"
    score: 9.0
    status: "2,730 test files with Vitest + V8 coverage; 70% line/branch/function thresholds enforced; sharded CI with parallelism"
  - dimension: "Integration/E2E"
    score: 8.5
    status: "36 E2E tests, 23 contract tests, 12 integration tests, 15 live tests; dedicated configs per test type"
  - dimension: "Build Integration"
    score: 8.0
    status: "PR-time build smoke, Docker image validation, CLI launcher smoke; multi-platform (macOS/Windows/Android/Linux)"
  - dimension: "Image Testing"
    score: 7.5
    status: "Docker image smoke tests with extension validation; multi-arch (amd64/arm64) OpenShift builds; no Trivy/Snyk scanning"
  - dimension: "Coverage Tracking"
    score: 8.5
    status: "V8 coverage with 70% line/function/statement thresholds, 55% branches; lcov reports; enforced in vitest config"
  - dimension: "CI/CD Automation"
    score: 9.5
    status: "Highly sophisticated CI with docs-scope detection, change-scope filtering, sharding, concurrency control, multi-platform matrix"
  - dimension: "Agent Rules"
    score: 9.0
    status: "Comprehensive AGENTS.md (23KB), CODEOWNERS for security paths, multi-agent safety rules, testing guidelines, 6 custom skills"
critical_gaps:
  - title: "No container vulnerability scanning (Trivy/Snyk/Grype)"
    impact: "Vulnerabilities in base images and dependencies not detected before deployment"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No SBOM generation or image signing"
    impact: "Supply chain security gap; no attestation for container images pushed to Quay.io"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "CodeQL only runs on manual dispatch (workflow_dispatch)"
    impact: "SAST analysis not automated on PRs or pushes; security bugs may go undetected"
    severity: "MEDIUM"
    effort: "1 hour"
  - title: "Extensions excluded from Oxlint and coverage thresholds"
    impact: "648 extension test files exist but extensions get no lint enforcement or coverage gates"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "iOS CI disabled (if: false)"
    impact: "iOS app builds and tests not validated in CI; regressions can ship undetected"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Enable CodeQL on pull_request trigger"
    effort: "30 minutes"
    impact: "Automated SAST on every PR; catches security-relevant code issues before merge"
  - title: "Add Trivy container scanning to install-smoke or build-openshift-image workflow"
    effort: "1-2 hours"
    impact: "Detects known CVEs in Docker base images and installed packages"
  - title: "Enable Oxlint for extensions/ directory"
    effort: "2-3 hours"
    impact: "Consistent lint enforcement across 648 extension test files and extension source code"
  - title: "Add codecov/coveralls integration for PR coverage reporting"
    effort: "1-2 hours"
    impact: "PR-level coverage visibility; prevent coverage regressions in reviews"
recommendations:
  priority_0:
    - "Add Trivy or Grype container vulnerability scanning to CI for both Dockerfile and Dockerfile.openshift images"
    - "Enable CodeQL to run on pull_request and push triggers instead of manual-only dispatch"
    - "Add SBOM generation (syft) and image signing (cosign) for production images pushed to Quay.io"
  priority_1:
    - "Extend Oxlint coverage to extensions/ directory with appropriate rule configuration"
    - "Add codecov/coveralls integration for PR-level coverage delta reporting"
    - "Re-enable iOS CI job or document decision to defer iOS testing"
    - "Add Trivy filesystem scan for dependency vulnerabilities in pnpm-lock.yaml"
  priority_2:
    - "Add performance regression CI gate (test:perf:budget exists but is not in CI workflow)"
    - "Add code duplication CI gate (dup:check script exists but is not in CI)"
    - "Consider adding pre-merge coverage threshold for extensions (currently exempt)"
---

# Quality Analysis: OpenClaw (opendatahub-io/openclaw)

## Executive Summary

- **Overall Score: 8.6/10**
- **Repository Type**: Multi-platform TypeScript/Swift/Kotlin application (CLI, macOS app, iOS app, Android app, web UI, gateway server)
- **Primary Language**: TypeScript (ESM) with Swift (macOS/iOS), Kotlin (Android)
- **Framework**: Node.js CLI + Vitest testing + pnpm monorepo + multi-platform native apps
- **Key Strengths**: Exceptionally mature CI/CD pipeline with intelligent change-scoping, comprehensive multi-layer test strategy (unit/contract/integration/e2e/live), strong agent rules documentation, enforced coverage thresholds
- **Critical Gaps**: No container vulnerability scanning, CodeQL only on manual dispatch, extensions excluded from lint/coverage enforcement
- **Agent Rules Status**: Present and comprehensive (23KB AGENTS.md with CLAUDE.md symlink, 6 custom skills, CODEOWNERS)

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 9.0/10 | 2,730 test files, Vitest + V8, 70% coverage thresholds enforced |
| Integration/E2E | 8.5/10 | 36 E2E + 23 contract + 12 integration + 15 live tests |
| **Build Integration** | **8.0/10** | **PR build smoke, Docker image validation, multi-platform CI** |
| Image Testing | 7.5/10 | Docker smoke tests + extension validation; no vulnerability scanning |
| Coverage Tracking | 8.5/10 | V8 coverage, 70% thresholds, lcov output; no PR delta reporting |
| CI/CD Automation | 9.5/10 | Elite-tier CI with scope detection, sharding, multi-platform matrix |
| Agent Rules | 9.0/10 | 23KB AGENTS.md, CODEOWNERS, 6 skills, multi-agent safety rules |

## Critical Gaps

### 1. No Container Vulnerability Scanning
- **Impact**: CVEs in base images (node:24-bookworm, UBI9) and transitive dependencies not detected
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Neither `Dockerfile` nor `Dockerfile.openshift` builds include Trivy, Snyk, or Grype scanning. The `install-smoke.yml` workflow builds and runs images but doesn't scan them. The `build-openshift-image.yml` workflow pushes multi-arch images to `quay.io/opendatahub/odh-openclaw-rhel9` without any vulnerability gate.

### 2. No SBOM Generation or Image Signing
- **Impact**: Supply chain security gap for images pushed to production registries
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Production images are pushed to Quay.io without SBOM attestation (syft) or signature verification (cosign/sigstore). This is a significant gap for enterprise/OpenShift deployments.

### 3. CodeQL SAST Only on Manual Dispatch
- **Impact**: Security-relevant code defects not automatically caught on PRs
- **Severity**: MEDIUM
- **Effort**: 1 hour
- **Details**: The `codeql.yml` workflow is configured with `on: workflow_dispatch` only. It covers 5 languages (JS/TS, Actions, Python, Java/Kotlin, Swift) with `security-and-quality` queries, but only runs when manually triggered. This means PR authors must remember to run it.

### 4. Extensions Excluded from Lint and Coverage
- **Impact**: 648 extension test files and ~77 extension packages have no Oxlint enforcement or coverage thresholds
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: The `.oxlintrc.json` `ignorePatterns` includes `"extensions/"`. The `vitest.config.ts` coverage excludes `"extensions/**"`. Extensions are tested (via `test:extensions` and `test:channels`), but there's no lint or coverage gate.

### 5. iOS CI Disabled
- **Impact**: iOS app regressions not caught in CI
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: The `ios` job in `ci.yml` has `if: false` with the comment "ignore iOS in CI for now". The iOS build includes coverage gates (43% threshold), but none of this runs.

## Quick Wins

### 1. Enable CodeQL on PR/Push Triggers (30 minutes)
Change `codeql.yml` trigger from `workflow_dispatch` to include `pull_request` and `push`:
```yaml
on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
  schedule:
    - cron: '0 6 * * 1'  # Weekly Monday scan
```

### 2. Add Trivy Container Scanning (1-2 hours)
Add a Trivy scan step to `install-smoke.yml` after the image build:
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: openclaw-dockerfile-smoke:local
    format: 'table'
    exit-code: '1'
    severity: 'CRITICAL,HIGH'
```

### 3. Enable Oxlint for Extensions (2-3 hours)
Remove `"extensions/"` from `.oxlintrc.json` `ignorePatterns` and address any resulting lint errors. This brings 77 extension packages under the same quality bar as core code.

### 4. Add Codecov Integration (1-2 hours)
Add codecov upload to CI after test runs to get PR-level coverage delta reporting:
```yaml
- name: Upload coverage
  uses: codecov/codecov-action@v5
  with:
    files: coverage/lcov.info
    fail_ci_if_error: false
```

## Detailed Findings

### CI/CD Pipeline

**Score: 9.5/10** — One of the most sophisticated CI setups analyzed.

**Workflow Inventory (11 workflows)**:
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | push/PR | Main CI: tests, lint, build, multi-platform |
| `codeql.yml` | dispatch only | SAST analysis (5 languages) |
| `install-smoke.yml` | push/PR | Docker image build + CLI smoke |
| `build-openshift-image.yml` | push/schedule/PR | UBI9 multi-arch image builds |
| `sandbox-common-smoke.yml` | push/PR (path-filtered) | Sandbox image validation |
| `workflow-sanity.yml` | push/PR | actionlint + workflow hygiene |
| `auto-response.yml` | - | Issue/PR auto-responses |
| `docker-release.yml` | - | Docker image release |
| `openclaw-npm-release.yml` | - | npm package release |
| `plugin-npm-release.yml` | - | Plugin SDK release |
| `labeler.yml` | - | PR auto-labeling |
| `stale.yml` | - | Stale issue/PR management |

**Strengths**:
- **Intelligent scope detection**: Docs-only changes skip heavy jobs. `changed-scope` job detects which platforms (Node, macOS, Android, Windows, Python) are affected and only runs relevant CI.
- **Changed extension detection**: Only runs extension tests for actually-changed extensions (dynamic matrix).
- **Test sharding**: Core tests split into 2 shards on Linux, 6 shards on Windows.
- **Concurrency control**: All workflows use `cancel-in-progress: true` with PR-scoped groups.
- **Multi-platform matrix**: Linux (Blacksmith 16vCPU), macOS, Windows (32vCPU), Android.
- **Node version compatibility**: Separate `compat-node22` job validates backward compatibility.
- **Bun compatibility**: Separate Bun runtime lane (push-only, not PRs).
- **Custom reusable actions**: `setup-node-env`, `setup-pnpm-store-cache`, `detect-docs-changes`, `ensure-base-commit`.
- **Workflow sanity**: `actionlint` validation + tabs detection + composite action interpolation checks.
- **Build artifact caching**: `build-artifacts` job shares `dist/` via upload/download artifacts.

**Gaps**:
- CodeQL not automated (manual dispatch only)
- No Trivy/Snyk scanning in any workflow
- No PR coverage delta reporting
- Performance budget (`test:perf:budget`) exists but isn't in CI
- Code duplication check (`dup:check`) exists but isn't in CI

### Test Coverage

**Score: 9.0/10** — Exceptional test-to-code ratio and multi-layer strategy.

**Test Statistics**:
| Area | Test Files | Source Files |
|------|-----------|-------------|
| `src/` | 1,999 | ~3,800 |
| `extensions/` | 648 | ~600 |
| `test/` | 15 | — |
| `ui/` | 59 | ~100 |
| **Total** | **2,730** | **~4,539** |

**Test-to-Code Ratio**: 0.60 (outstanding for a project of this size)

**Test Types**:
- **Unit tests**: 2,700+ files, colocated as `*.test.ts`, run via `pnpm test` with sharding
- **Contract tests**: 23 files in `src/channels/plugins/contracts/` and `src/plugins/contracts/` — validate plugin API boundaries
- **E2E tests**: 36 files covering CLI, agents, docker, gateway, extensions
- **Integration tests**: 12 files for gateway, config, hooks, extensions
- **Live tests**: 15 files for real-API testing (gated behind `OPENCLAW_LIVE_TEST=1`)
- **Docker tests**: Dedicated scripts for gateway, onboarding, plugins, network
- **Architecture smell tests**: Automated architecture boundary enforcement
- **Boundary guard tests**: Plugin/extension import boundary validation

**Coverage Configuration** (vitest.config.ts):
- Provider: V8
- Reporters: text + lcov
- Thresholds: 70% lines, 70% functions, 55% branches, 70% statements
- Scope: `src/**/*.ts` only (extensions, apps, UI excluded)
- Extensive exclusion list for integration-tested surfaces

**Vitest Configuration Variants** (7 configs):
| Config | Purpose |
|--------|---------|
| `vitest.config.ts` | Base config with coverage thresholds |
| `vitest.unit.config.ts` | Unit tests only |
| `vitest.e2e.config.ts` | E2E tests with process forks |
| `vitest.extensions.config.ts` | Extension tests |
| `vitest.channels.config.ts` | Channel plugin tests |
| `vitest.gateway.config.ts` | Gateway tests |
| `vitest.live.config.ts` | Live API tests |

### Code Quality

**Score: 8.5/10** — Strong tooling with minor coverage gaps in extensions.

**Linting**:
- **Oxlint** (`oxlint --type-aware`): Fast Rust-based linter with TypeScript type-aware rules
  - Plugins: unicorn, typescript, oxc
  - Categories enforced: correctness (error), perf (error), suspicious (error)
  - `no-explicit-any`: error (strict)
  - Extensions excluded from lint scope
- **Oxfmt**: Rust-based formatter (replaces Prettier)
- **SwiftLint + SwiftFormat**: For macOS/iOS Swift code
- **Ktlint**: For Android Kotlin code
- **Ruff**: For Python skill scripts
- **ShellCheck**: For shell scripts
- **Markdownlint**: For documentation
- **actionlint**: For GitHub workflow files
- **zizmor**: GitHub Actions security auditor

**Architecture Enforcement**:
- 20+ custom boundary-check scripts in `scripts/`:
  - Plugin/extension import boundaries
  - Web search provider boundaries
  - Channel-agnostic boundaries
  - Plugin SDK export validation
  - No-raw-window-open policy
  - Webhook auth body order
  - Architecture smell detection
- All enforced in CI via the `check` job

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- Trailing whitespace, end-of-file fixer, YAML validation
- Large file detection (500KB limit)
- Merge conflict detection
- Private key detection
- `detect-secrets` with extensive baseline (433KB)
- ShellCheck for shell scripts
- zizmor for workflow security
- pnpm audit for production dependencies

**Code Duplication Detection**:
- jscpd configured (`.jscpd.json`) with min 12 lines / 80 tokens threshold
- Available via `pnpm dup:check` but not enforced in CI

### Container Images

**Score: 7.5/10** — Solid multi-stage builds; missing security scanning.

**Dockerfiles**:
| File | Purpose | Base Image |
|------|---------|------------|
| `Dockerfile` | Main CLI image | `node:24-bookworm` (pinned to SHA256) |
| `Dockerfile.openshift` | OpenShift/UBI9 image | `registry.access.redhat.com/ubi9/nodejs-22` |
| `Dockerfile.sandbox` | Sandbox runtime | Bookworm-slim |
| `Dockerfile.sandbox-browser` | Browser sandbox | — |
| `Dockerfile.sandbox-common` | Shared sandbox base | — |

**Strengths**:
- Multi-stage builds (ext-deps → build → runtime)
- Base images pinned to SHA256 digests for reproducibility
- Build-arg extensibility (`OPENCLAW_EXTENSIONS`, `OPENCLAW_VARIANT`)
- Slim variant support (`bookworm-slim`)
- Multi-architecture support (amd64/arm64) in OpenShift workflow
- Healthcheck configured in docker-compose
- Security hardening: `cap_drop`, `no-new-privileges`, `init: true`

**CI Image Testing**:
- `install-smoke.yml`: Builds 3 images (root, extension, installer) and runs CLI smoke tests
- `build-openshift-image.yml`: PR validation (amd64 build-only), production multi-arch push
- `sandbox-common-smoke.yml`: Validates sandbox image user/permissions

**Gaps**:
- No Trivy/Snyk/Grype vulnerability scanning
- No SBOM generation (syft)
- No image signing (cosign/sigstore)
- No runtime functional testing beyond CLI `--version` and `--help`

### Security

**Score: 8.0/10** — Strong foundation; missing container scanning.

**Strengths**:
- **detect-secrets**: Comprehensive baseline (433KB) with extensive exclusion patterns
- **Private key detection**: Pre-commit hook
- **CODEOWNERS**: Security-sensitive paths require `@openclaw/secops` review (50+ path rules)
- **CodeQL**: Configured for 5 languages with `security-and-quality` queries
- **zizmor**: GitHub Actions security auditing
- **Dependabot**: Daily updates for npm, GitHub Actions, Swift, Gradle, Docker
- **pnpm audit**: Production dependency auditing in pre-commit
- **SECURITY.md**: 22KB comprehensive security documentation
- **Security hardening**: Docker `cap_drop`, `no-new-privileges`, healthchecks

**Gaps**:
- CodeQL only runs on manual dispatch
- No container image vulnerability scanning
- No SBOM or image signing
- zizmor has `unpinned-uses` and `excessive-permissions` checks disabled

### Agent Rules (Agentic Flow Quality)

**Score: 9.0/10** — Among the most comprehensive agent configurations analyzed.

**Status**: Present and highly detailed

**AGENTS.md** (23KB, symlinked as CLAUDE.md):
- Project structure and module organization
- Import boundary rules with enforcement guidance
- Docs linking conventions (Mintlify)
- Build, test, and development commands
- Coding style and naming conventions
- Release/advisory workflows
- Testing guidelines (framework, naming, coverage)
- Commit and PR guidelines
- Security and configuration tips
- Local runtime/platform notes
- Multi-agent safety rules (6 explicit rules)
- Collaboration/safety notes

**Custom Skills** (6):
| Skill | Purpose |
|-------|---------|
| `openclaw-release-maintainer` | Release naming, versioning, changelog |
| `openclaw-pr-maintainer` | PR triage, review, landing |
| `openclaw-ghsa-maintainer` | Security advisory workflows |
| `openclaw-parallels-smoke` | Cross-platform smoke testing |
| `parallels-discord-roundtrip` | Discord integration testing |
| `update_clawdbot` | Agent workflow |

**CODEOWNERS Integration**: Security-sensitive paths require secops team review.

**Copilot Instructions**: `.github/instructions/copilot.instructions.md` for GitHub Copilot alignment.

**Gaps**:
- No dedicated test creation rules (`.claude/rules/`) for specific test types
- Skills focus on maintenance workflows rather than test pattern guidance
- No agent rules for extension development testing patterns

## Recommendations

### Priority 0 (Critical)

1. **Add container vulnerability scanning** — Add Trivy scanning to `install-smoke.yml` and `build-openshift-image.yml`. For OpenShift images pushed to Quay.io, this is essential. Effort: 2-4 hours.

2. **Enable CodeQL on automated triggers** — Change `codeql.yml` from `workflow_dispatch` to `pull_request`/`push`/`schedule`. The config already supports 5 languages; it just needs to run. Effort: 30 minutes.

3. **Add SBOM and image signing for production images** — Add `syft` for SBOM generation and `cosign` for signing on `build-openshift-image.yml`. Required for enterprise supply chain security. Effort: 4-6 hours.

### Priority 1 (High Value)

4. **Extend Oxlint to extensions/** — Remove `"extensions/"` from `ignorePatterns` in `.oxlintrc.json`. Extensions are a large surface area (77 packages, 648 test files) currently ungated. Effort: 4-8 hours.

5. **Add Codecov/Coveralls PR reporting** — Coverage thresholds exist but there's no PR-level delta reporting. Adding codecov upload gives reviewers visibility into coverage impact. Effort: 1-2 hours.

6. **Re-enable iOS CI** — The iOS job has coverage gates (43% threshold) and XCTest infrastructure but is disabled. Either re-enable or document the decision. Effort: 2-4 hours.

7. **Add dependency vulnerability scanning** — Use Trivy filesystem mode or `pnpm audit` in CI (currently only in pre-commit) to gate PRs on known vulnerabilities. Effort: 1-2 hours.

### Priority 2 (Nice-to-Have)

8. **Add performance budget to CI** — `test:perf:budget` script exists but isn't in the CI workflow. Adding it prevents performance regressions. Effort: 1 hour.

9. **Add code duplication gate to CI** — `dup:check` with jscpd is configured but not enforced. Effort: 1 hour.

10. **Add test creation agent rules** — Create `.claude/rules/` with specific test pattern guidance for unit, contract, e2e, and extension tests. The AGENTS.md has high-level testing guidelines but no file-level test creation rules. Effort: 2-3 hours.

11. **Enable zizmor unpinned-uses check** — Currently disabled; pinning GitHub Actions to SHA hashes improves supply chain security. Effort: 4-8 hours (many action references to pin).

## Comparison to Gold Standards

| Dimension | OpenClaw | odh-dashboard | notebooks | kserve |
|-----------|----------|---------------|-----------|--------|
| Unit Tests | 9.0 | 9.0 | 7.0 | 8.0 |
| Integration/E2E | 8.5 | 9.0 | 7.0 | 9.0 |
| Build Integration | 8.0 | 7.0 | 8.0 | 7.0 |
| Image Testing | 7.5 | 6.0 | 9.0 | 7.0 |
| Coverage Tracking | 8.5 | 9.0 | 6.0 | 9.0 |
| CI/CD Automation | 9.5 | 8.5 | 8.0 | 8.0 |
| Agent Rules | 9.0 | 8.0 | 3.0 | 2.0 |
| **Overall** | **8.6** | **8.1** | **6.9** | **7.3** |

**Notable differentiators vs. gold standards**:
- **CI/CD sophistication**: OpenClaw's change-scope detection, intelligent job skipping, and multi-platform matrix exceed all gold standards
- **Agent rules**: Most comprehensive agent documentation analyzed (23KB AGENTS.md + 6 custom skills)
- **Contract testing**: 23 contract tests for plugin API boundaries — a practice not seen in other analyzed repos
- **Multi-platform**: Tests across Linux, macOS, Windows, Android — unique among analyzed repos
- **Missing vs. gold standards**: No container vulnerability scanning (notebooks has 5-layer image validation), CodeQL not automated (kserve has automated SAST)

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yml` — Main CI (tests, lint, build, multi-platform)
- `.github/workflows/codeql.yml` — CodeQL SAST (5 languages, manual dispatch)
- `.github/workflows/install-smoke.yml` — Docker image build + smoke tests
- `.github/workflows/build-openshift-image.yml` — Multi-arch OpenShift image
- `.github/workflows/sandbox-common-smoke.yml` — Sandbox image validation
- `.github/workflows/workflow-sanity.yml` — Workflow lint + hygiene
- `.github/actions/` — 4 reusable composite actions

### Testing
- `vitest.config.ts` — Base test config with coverage thresholds
- `vitest.unit.config.ts` — Unit test config
- `vitest.e2e.config.ts` — E2E test config
- `vitest.extensions.config.ts` — Extension test config
- `vitest.channels.config.ts` — Channel test config
- `vitest.gateway.config.ts` — Gateway test config
- `vitest.live.config.ts` — Live API test config
- `test/` — Top-level test files and helpers
- `src/channels/plugins/contracts/` — Channel contract tests (12 files)
- `src/plugins/contracts/` — Plugin contract tests (11 files)

### Code Quality
- `.oxlintrc.json` — Oxlint configuration
- `.oxfmtrc.jsonc` — Oxfmt formatter config
- `.pre-commit-config.yaml` — Pre-commit hooks (7 hooks)
- `.swiftlint.yml` — Swift lint rules
- `.swiftformat` — Swift format config
- `.jscpd.json` — Code duplication detection config
- `.markdownlint-cli2.jsonc` — Markdown lint config
- `.shellcheckrc` — Shell script lint config
- `knip.config.ts` — Dead code detection config

### Container Images
- `Dockerfile` — Main CLI image (multi-stage, bookworm)
- `Dockerfile.openshift` — UBI9 image for OpenShift
- `Dockerfile.sandbox` — Sandbox runtime
- `Dockerfile.sandbox-browser` — Browser sandbox
- `Dockerfile.sandbox-common` — Shared sandbox base
- `docker-compose.yml` — Gateway deployment
- `.dockerignore` — Docker build exclusions

### Security
- `.detect-secrets.cfg` — Secret detection config
- `.secrets.baseline` — Secret detection baseline (433KB)
- `SECURITY.md` — Security documentation (22KB)
- `zizmor.yml` — GitHub Actions security audit config
- `.github/codeql/codeql-javascript-typescript.yml` — CodeQL JS/TS config
- `.github/CODEOWNERS` — Security-path ownership rules
- `.github/dependabot.yml` — Dependency update config (6 ecosystems)

### Agent Rules
- `AGENTS.md` — Comprehensive agent rules (23KB)
- `CLAUDE.md` — Symlink to AGENTS.md
- `.agents/skills/` — 5 custom maintainer skills
- `.agent/workflows/` — Agent workflow definitions
- `.github/instructions/copilot.instructions.md` — Copilot instructions
- `.github/CODEOWNERS` — Security review requirements
