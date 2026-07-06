---
repository: "openclaw/openclaw"
overall_score: 9.1
scorecard:
  - dimension: "Unit Tests"
    score: 9.5
    status: "6,785 test files with Vitest; exceptional test-to-code ratio of 0.71"
  - dimension: "Integration/E2E"
    score: 9.0
    status: "Extensive E2E suite across CLI, gateway, UI, Docker, and live provider lanes"
  - dimension: "Build Integration"
    score: 8.5
    status: "PR-time artifact builds with verification; Docker multi-stage builds cached"
  - dimension: "Image Testing"
    score: 8.0
    status: "Install smoke tests, Docker E2E lanes, package acceptance workflows"
  - dimension: "Coverage Tracking"
    score: 5.0
    status: "No codecov/coveralls integration; no coverage thresholds or PR reporting"
  - dimension: "CI/CD Automation"
    score: 9.5
    status: "66 workflows; advanced concurrency, caching, matrix routing, and Blacksmith runners"
  - dimension: "Agent Rules"
    score: 9.5
    status: "Comprehensive AGENTS.md with 20+ scoped files; extensive .agents/skills directory"
critical_gaps:
  - title: "No coverage tracking or enforcement"
    impact: "Cannot detect coverage regressions on PRs; no visibility into uncovered code paths"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No container vulnerability scanning"
    impact: "Docker images ship without Trivy/Snyk scan; CVEs may reach production undetected"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No SBOM generation"
    impact: "No software bill of materials for supply chain compliance or audit"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add Codecov integration with PR comments"
    effort: "2-4 hours"
    impact: "Immediate visibility into coverage trends and regressions per PR"
  - title: "Add Trivy container scanning to Docker release workflow"
    effort: "1-2 hours"
    impact: "Detect CVEs in base images and dependencies before release"
  - title: "Generate SBOM during Docker build"
    effort: "1-2 hours"
    impact: "Supply chain transparency and compliance readiness"
recommendations:
  priority_0:
    - "Integrate Codecov or Coveralls with coverage thresholds to prevent regressions"
    - "Add container image vulnerability scanning (Trivy) to Docker release and PR workflows"
  priority_1:
    - "Generate SBOM for Docker images using Syft or Docker BuildKit attestation"
    - "Add image signing with Cosign for release images"
  priority_2:
    - "Add API contract testing between gateway, plugins, and UI"
    - "Implement accessibility testing for Control UI (axe-core or Playwright a11y)"
---

# Quality Analysis: OpenClaw

## Executive Summary

- **Overall Score: 9.1/10**
- **Repository Type**: Multi-platform AI assistant / CLI tool with gateway server, control UI, mobile apps (iOS/Android), and 60+ provider extensions
- **Primary Language**: TypeScript (Node.js)
- **Framework**: Custom Node.js runtime with Vitest testing, pnpm monorepo, tsdown bundler
- **Key Strengths**: Exceptional test density (6,785 test files), 66 CI/CD workflows with sophisticated routing, deep security scanning (CodeQL + OpenGrep + zizmor), comprehensive agent rules with 20+ scoped AGENTS.md files
- **Critical Gaps**: No coverage tracking/enforcement, no container vulnerability scanning, no SBOM generation
- **Agent Rules Status**: Exemplary — industry-leading AGENTS.md hierarchy with scoped rules per subsystem

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 9.5/10 | 6,785 test files; Vitest framework; 0.71 test-to-code ratio |
| Integration/E2E | 9.0/10 | CLI E2E, gateway E2E, UI E2E, Docker E2E, live provider tests |
| **Build Integration** | **8.5/10** | **PR artifact builds with verification; Docker multi-stage; Blacksmith Testbox** |
| Image Testing | 8.0/10 | Install smoke, Docker E2E lanes, package acceptance, multi-platform |
| Coverage Tracking | 5.0/10 | No codecov; no thresholds; no PR reporting |
| CI/CD Automation | 9.5/10 | 66 workflows; concurrency; caching; matrix routing; Blacksmith |
| Agent Rules | 9.5/10 | 20+ scoped AGENTS.md; 30+ skills in .agents/skills/ |

## Critical Gaps

### 1. No Coverage Tracking or Enforcement
- **Impact**: Cannot detect coverage regressions on PRs; no visibility into which code paths lack tests
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Despite having 6,785 test files, there is no `codecov.yml`, `.coveragerc`, or coverage reporting integration. Vitest supports `--coverage` natively via `@vitest/coverage-v8` or `@vitest/coverage-istanbul`. No coverage thresholds are enforced, meaning new code can reduce overall coverage without detection.

### 2. No Container Vulnerability Scanning
- **Impact**: Docker images may contain known CVEs in base images or npm dependencies
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: The Dockerfile uses `node:24-bookworm` and `node:24-bookworm-slim` base images pinned by digest (good practice), but there is no Trivy, Snyk, or Grype scan in the `docker-release.yml` or CI workflow. The dependency-guard workflow catches dependency changes at the PR level but does not scan the final built image.

### 3. No SBOM Generation
- **Impact**: No software bill of materials for supply chain audits or compliance
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: Modern supply chain requirements (Executive Order 14028, OpenSSF) increasingly require SBOMs. The Docker build could easily add `--sbom=true` or integrate Syft.

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
Add `@vitest/coverage-v8` and Codecov GitHub Action to the CI workflow:
```yaml
# In ci.yml, add to the test step:
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    files: coverage/lcov.info
    fail_ci_if_error: false
```

### 2. Add Trivy Container Scanning (1-2 hours)
Add to `docker-release.yml`:
```yaml
- name: Scan image for vulnerabilities
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: openclaw:${{ github.sha }}
    format: sarif
    output: trivy-results.sarif
    severity: CRITICAL,HIGH
- name: Upload Trivy scan results
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: trivy-results.sarif
```

### 3. Generate SBOM During Docker Build (1-2 hours)
```dockerfile
# Add to Dockerfile or docker buildx build command:
# docker buildx build --sbom=true --provenance=true .
```

## Detailed Findings

### CI/CD Pipeline

**Score: 9.5/10** — One of the most sophisticated CI/CD setups analyzed.

**Workflow Inventory (66 workflows)**:
- **PR-triggered**: `ci.yml` (main CI), `codeql.yml`, `opengrep-precise.yml`, `security-sensitive-guard.yml`, `dependency-guard.yml`, `labeler.yml`, `auto-response.yml`
- **Scheduled**: `openclaw-scheduled-live-checks.yml`, `openclaw-performance.yml`, `install-smoke.yml`, `stale.yml`
- **Release**: `openclaw-release-publish.yml`, `docker-release.yml`, `macos-release.yml`, `windows-node-release.yml`, `plugin-npm-release.yml`
- **Manual/Dispatch**: `package-acceptance.yml`, `full-release-validation.yml`, `crabbox-hydrate.yml`
- **Platform-specific**: `ci-check-arm-testbox.yml` (ARM64), `windows-blacksmith-testbox.yml`, iOS/Android workflows

**Strengths**:
- Advanced concurrency control with debouncing for main branch pushes
- Preflight manifest routing that dynamically enables/disables CI jobs based on changed files
- Blacksmith runners for performance (16-vCPU for builds, 4-vCPU for lighter jobs)
- Multi-platform CI: Linux x64, Linux ARM64, macOS, Windows, iOS, Android
- Dist build caching across runs with cache-seed resolution from npm dist-tags
- Testbox infrastructure for isolated testing environments
- Draft PR filtering (all workflows skip draft PRs)

**Areas for Improvement**:
- Large number of workflows (66) could benefit from reusable workflow consolidation
- Some workflows have very long timeout values (up to 240 minutes)

### Test Coverage

**Score: 9.5/10** — Exceptional test density.

**Test File Count**: 6,785 test files across the repository
- `src/` directory: 3,891 test files (co-located with source)
- `test/` directory: 401 test files (integration/config validation)
- `ui/` directory: 152 test files (UI component and E2E tests)

**Test-to-Code Ratio**: 0.71 (6,785 test files / 9,549 source files)
- This is an outstanding ratio, well above the typical 0.3-0.5 for mature projects

**Testing Framework**: Vitest
- Root `vitest.config.ts` delegates to a project matrix in `test/vitest/vitest.config.ts`
- Multiple Vitest configs for different scopes: unit, boundary, performance, light, scoped, UI
- Specialized test setups: `setup.ts`, `setup.shared.ts`, `setup.extensions.ts`, `setup.env.ts`

**Test Types Observed**:
- Unit tests (co-located `*.test.ts` files in `src/`)
- Integration tests (`test/` directory, gateway tests, plugin tests)
- E2E tests (20+ `*.e2e.test.ts` files across CLI, gateway, UI, Docker)
- Live provider tests (`*.live.test.ts` — real API calls to providers)
- Performance tests (`vitest-performance-config.test.ts`, Kova benchmarks)
- Boundary tests (import boundary enforcement, extension isolation)
- Configuration validation tests (vitest config, release checks, package scripts)
- Architecture smell tests (`architecture-smells.test.ts`)

### E2E Testing

**Score: 9.0/10** — Comprehensive multi-layer E2E coverage.

**CLI E2E**: `openclaw-launcher.e2e.test.ts`, `cli-json-stdout.e2e.test.ts`
**Gateway E2E**: `gateway.multi.e2e.test.ts`, `server-network-runtime.e2e.test.ts`, MCP transport tests
**UI E2E**: 18+ Vitest browser-mode E2E tests in `ui/src/e2e/` covering chat flows, sessions, approvals, terminal, mobile pairing
**Docker E2E**: Full Docker E2E lanes in `test/e2e/qa-lab/runtime/` — gateway smoke, MCP channels, OpenTelemetry, image generation
**Live Tests**: Real provider API tests (`image-generation.runtime.live.test.ts`)
**QA Lab**: Dedicated QA extension with runtime evidence scripts and voice agent tests

**Package Acceptance**: Dedicated `package-acceptance.yml` workflow with profiles (smoke, package, product, full, custom) testing published packages and upgrade paths.

**Install Smoke**: Nightly install smoke tests validating fresh installs, Bun global installs, and update paths.

### Code Quality Tools

**Score: 8.5/10** — Strong multi-tool quality enforcement.

**Linting**:
- **oxlint** (v2, Rust-based): Configured via `.oxlintrc.json` with 60+ rules enabled, type-aware mode, categories for correctness/perf/suspicious. Runs in pre-commit hooks.
- **oxfmt**: Code formatter (Rust-based), runs in pre-commit hooks
- **No ESLint**: Migrated to oxlint (faster, Rust-native alternative)
- **SwiftLint + SwiftFormat**: For iOS/macOS code
- **Ruff**: For Python skills scripts
- **ktlint**: For Android Kotlin code

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- Standard file hygiene (trailing whitespace, end-of-file fixer, YAML check, large file check, merge conflict detection, private key detection)
- ShellCheck for shell scripts (error severity)
- actionlint for GitHub Actions
- zizmor for GitHub Actions security audit
- Ruff for Python skills
- pytest for Python skills tests
- pnpm audit for production dependency vulnerabilities
- oxlint (type-aware)
- oxfmt
- SwiftLint and SwiftFormat

**Static Analysis**:
- **CodeQL**: 4 workflow variants with 10+ custom query configurations targeting specific security boundaries (core-auth-secrets, channel-runtime, network-SSRF, MCP-process-tool, plugin-trust, process-exec). Runs on PRs, pushes, and daily schedule.
- **OpenGrep** (Semgrep fork): PR diff-scoped scanning with high-precision rules and full repository-wide scan variant. Custom rule super-config under `security/opengrep/`.
- **zizmor**: GitHub Actions security auditor integrated into pre-commit and CI.
- **Dependency Guard**: Custom workflow detecting dependency changes with automated scrubbing and security team review enforcement.
- **Security Sensitive Guard**: Detects security-sensitive PR changes and requires security team approval.

**TypeScript Configuration**:
- Strict mode enabled (`"strict": true`)
- Additional strictness: `noImplicitOverride`, `noImplicitReturns`, `forceConsistentCasingInFileNames`, `verbatimModuleSyntax`, `noUncheckedSideEffectImports`
- Target: ES2023

### Build Integration

**Score: 8.5/10** — Strong PR-time build validation.

**PR Build Validation**:
- `ci-build-artifacts-testbox.yml`: Builds all dist artifacts on PRs, verifies `dist/index.js`, `dist/build-info.json`, `dist/control-ui/index.html`
- Dist build caching with SHA-keyed cache and fallback seeds from npm dist-tags
- Control UI build verification included
- ARM64 build validation via `ci-check-arm-testbox.yml`
- Windows build validation via `windows-blacksmith-testbox.yml`

**Docker Build**:
- Multi-stage Dockerfile with build optimization
- Base images pinned to SHA256 digests for reproducibility
- Bun binary copied from official image (not fetched via curl)
- Build arguments for optional plugin bundling
- pnpm store caching in Docker layer
- Separate build and slim runtime stages
- Multiple specialized Dockerfiles: E2E, sandbox (common/browser), install smoke, QR import

**Crabbox Integration**:
- `.crabbox.yaml` for delegated CI environment (Blacksmith Testbox)
- Remote proof capability with AWS/Azure providers

### Container Image Testing

**Score: 8.0/10** — Good runtime testing, missing vulnerability scanning.

**Runtime Testing**:
- Install smoke tests (`install-smoke.yml`) — nightly and on-demand
- Docker E2E lanes testing gateway, MCP channels, OpenTelemetry integration
- Package acceptance workflow with multiple profiles (smoke through full)
- Docker Compose configuration for local gateway testing
- Sandbox Docker images for isolated execution environments

**Missing**:
- No Trivy/Snyk/Grype vulnerability scanning
- No SBOM generation
- No image signing (Cosign/Notation)
- No multi-architecture image manifest (ARM images are tested but published image architecture unclear)

### Security Practices

**Score: 9.0/10** — Industry-leading for an open-source project.

**Strengths**:
- **CodeQL**: 10+ custom query configurations targeting specific attack surfaces (auth secrets, SSRF, process exec, MCP tools, plugin trust boundaries, channel runtime)
- **OpenGrep**: High-precision custom rules with PR diff-scoped scanning and full repository sweeps
- **zizmor**: GitHub Actions security audit in pre-commit and CI
- **Security Sensitive Guard**: Automated detection and approval gating for security-sensitive changes
- **Dependency Guard**: Automated dependency change detection with security team review and autoscrub
- **Private key detection**: Pre-commit hook prevents accidental key commits
- **pnpm audit**: Production dependency vulnerability checking in pre-commit
- **Action pinning**: All GitHub Actions pinned to SHA digests, not tags
- **Checkout security**: Custom checkout scripts with retry logic and SHA verification
- **SECURITY.md**: Responsible disclosure policy documented

**Missing**:
- Container image scanning (Trivy/Snyk)
- Secret scanning service (Gitleaks/TruffleHog — though private key detection is a partial substitute)
- SBOM generation for supply chain

### Agent Rules (Agentic Flow Quality)

**Score: 9.5/10** — Exemplary agent rules architecture.

**Status**: Present and comprehensive

**AGENTS.md Hierarchy** (20+ scoped files):
- Root `AGENTS.md` (287 lines) — telegraph style, hard policy, routing
- `CLAUDE.md` → symlink to `AGENTS.md`
- Scoped `AGENTS.md` files in:
  - `ui/`, `test/`, `scripts/`, `extensions/`, `docs/`
  - `src/tui/`, `src/plugins/`, `src/plugin-sdk/`, `src/gateway/`, `src/channels/`, `src/agents/`
  - `test/helpers/`, `src/infra/outbound/`, `src/gateway/server-methods/`, `src/agents/tools/`
  - `extensions/telegram/`, `extensions/acpx/`
  - `apps/ios/`, `apps/android/`

**Root AGENTS.md Coverage**:
- Start section (repo conventions, reply format, docs integration)
- ClawSweeper Review Policy
- Architecture map
- Commands, Validation, GitHub/PRs
- Code style, Tests, Docs/Changelog, Git, Security/Release, Platform/Ops

**Skills Directory** (`.agents/skills/`):
- 30+ custom skills including: `autoreview`, `clawsweeper`, `crabbox`, `openclaw-debugging`, `openclaw-docker-e2e-authoring`, `openclaw-ci-limits`, `openclaw-changelog-update`, `openclaw-ghsa-maintainer`, `openclaw-landable-bug-sweep`, `control-ui-e2e`, and more

**Quality Assessment**:
- Rules are telegraph-style (concise, actionable)
- Strong routing: "Read scoped AGENTS.md before subtree work"
- Exhaustive review policy: "read whole changed function/module plus callers, callees, siblings, tests, docs, and upstream contracts"
- Existing-solutions preflight: agents must check for existing OSS/libraries before building custom
- Skills are workflow-specific and well-organized

### Performance Testing

**Score: 8.5/10** — Dedicated performance infrastructure.

- **Kova**: Custom performance benchmarking tool (`openclaw/Kova`)
- Profiles: smoke, diagnostic, soak, release
- Scenarios: fresh-install, gateway-performance, bundled-plugin-startup, bundled-runtime-deps, agent-cold-warm-message
- Deep profiling lane with CPU/heap/trace artifacts
- Live OpenAI GPT 5.5 agent turn benchmarking
- Regression detection with configurable fail-on-regression flag
- Nightly scheduled runs + manual dispatch

## Recommendations

### Priority 0 (Critical)

1. **Integrate coverage tracking with enforcement**
   - Add `@vitest/coverage-v8` to generate lcov reports
   - Configure Codecov with `codecov.yml` setting minimum thresholds (e.g., 70% patch coverage)
   - Add coverage upload step to CI workflow
   - Enforce coverage on PRs to prevent regression

2. **Add container image vulnerability scanning**
   - Integrate Trivy Action into `docker-release.yml`
   - Upload SARIF results to GitHub Security tab
   - Set severity threshold (CRITICAL, HIGH)
   - Consider adding to PR workflow for early detection

### Priority 1 (High Value)

3. **Generate SBOM for Docker images**
   - Use Docker BuildKit `--sbom=true` or Syft during build
   - Attach SBOM as release artifact
   - Consider Cosign image signing for release images

4. **Add contract tests between components**
   - Gateway ↔ Plugin API contract tests
   - Gateway ↔ UI API contract tests
   - Plugin SDK contract validation
   - Extension API backwards-compatibility tests

### Priority 2 (Nice-to-Have)

5. **Add accessibility testing for Control UI**
   - Integrate axe-core or Playwright accessibility testing
   - WCAG 2.1 AA compliance checks in UI E2E tests

6. **Consolidate workflow count**
   - 66 workflows is very high; consider using reusable workflows more aggressively
   - Group related workflows (e.g., all CodeQL variants into one with matrix)

## Comparison to Gold Standards

| Dimension | OpenClaw | odh-dashboard | notebooks | kserve | Industry Best |
|-----------|----------|---------------|-----------|--------|---------------|
| Unit Tests | 9.5 | 8.5 | 6.0 | 8.0 | 9.0 |
| Integration/E2E | 9.0 | 9.0 | 7.0 | 9.0 | 9.0 |
| Build Integration | 8.5 | 7.0 | 6.0 | 7.0 | 8.0 |
| Image Testing | 8.0 | 7.0 | 9.0 | 7.0 | 9.0 |
| Coverage Tracking | 5.0 | 8.0 | 5.0 | 9.0 | 9.0 |
| CI/CD Automation | 9.5 | 8.5 | 7.0 | 8.0 | 9.0 |
| Agent Rules | 9.5 | 7.0 | 2.0 | 2.0 | 8.0 |
| **Overall** | **9.1** | **8.0** | **6.0** | **7.5** | **8.5** |

**Key Differentiators**:
- OpenClaw significantly exceeds gold standards in test density, CI/CD sophistication, and agent rules
- The main gap vs. gold standards is coverage tracking, where kserve and odh-dashboard lead
- Image testing lags behind notebooks (5-layer validation) mainly due to missing vulnerability scanning
- Agent rules are industry-leading — no other analyzed repository approaches this level of comprehensiveness

## File Paths Reference

### CI/CD
- `.github/workflows/ci.yml` — Main CI with preflight routing
- `.github/workflows/ci-build-artifacts-testbox.yml` — PR artifact builds
- `.github/workflows/ci-check-arm-testbox.yml` — ARM64 validation
- `.github/workflows/codeql.yml` — CodeQL with 10+ query configs
- `.github/workflows/opengrep-precise.yml` — OpenGrep PR diff scanning
- `.github/workflows/security-sensitive-guard.yml` — Security-sensitive change gating
- `.github/workflows/dependency-guard.yml` — Dependency change detection
- `.github/workflows/openclaw-performance.yml` — Kova performance benchmarks
- `.github/workflows/install-smoke.yml` — Install smoke tests
- `.github/workflows/package-acceptance.yml` — Package acceptance testing
- `.github/workflows/docker-release.yml` — Docker image release

### Testing
- `vitest.config.ts` — Root Vitest config
- `test/vitest/vitest.config.ts` — Vitest project matrix
- `test/` — Integration/config validation tests (401 files)
- `test/e2e/` — Docker E2E and QA lab tests
- `ui/src/e2e/` — UI E2E tests (18+ test files)
- `src/**/*.test.ts` — Co-located unit tests (3,891 files)

### Code Quality
- `.pre-commit-config.yaml` — 12+ hooks
- `.oxlintrc.json` — oxlint with 60+ rules
- `.oxfmtrc.jsonc` — oxfmt formatter config
- `.semgrepignore` — OpenGrep exclusions
- `tsconfig.json` — Strict TypeScript config

### Container Images
- `Dockerfile` — Multi-stage production build
- `docker-compose.yml` — Local gateway setup
- `scripts/docker/sandbox/Dockerfile` — Sandbox isolation images
- `scripts/e2e/Dockerfile` — E2E test containers

### Security
- `.github/codeql/` — 10+ custom CodeQL query configs
- `security/opengrep/` — Custom OpenGrep rules
- `.github/zizmor.yml` — Actions security audit config
- `SECURITY.md` — Responsible disclosure policy

### Agent Rules
- `AGENTS.md` — Root agent rules (287 lines)
- `CLAUDE.md` — Symlink to AGENTS.md
- 20+ scoped `AGENTS.md` files across subsystems
- `.agents/skills/` — 30+ custom agent skills
