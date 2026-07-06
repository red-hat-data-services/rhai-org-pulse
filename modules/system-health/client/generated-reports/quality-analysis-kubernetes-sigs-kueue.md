---
repository: "kubernetes-sigs/kueue"
overall_score: 8.6
scorecard:
  - dimension: "Unit Tests"
    score: 8.5
    status: "425 test files for 777 source files (0.55 ratio); Go testing + Ginkgo/Gomega; coverage profiles generated; unit test sharding support"
  - dimension: "Integration/E2E"
    score: 9.5
    status: "Exceptional multi-layer testing: envtest integration (125 files), E2E on Kind (74 files), MultiKueue, TAS, DRA, upgrade, cert-manager, and performance suites"
  - dimension: "Build Integration"
    score: 7.0
    status: "Cloud Build for image pushing; Prow-based CI; no PR-time Konflux simulation but Kustomize/Helm validation in verify"
  - dimension: "Image Testing"
    score: 6.5
    status: "Multi-arch builds (amd64/arm64/s390x/ppc64le); distroless base; multi-stage Dockerfile; no runtime image validation or Trivy scanning"
  - dimension: "Coverage Tracking"
    score: 5.5
    status: "Coverage profiles generated via -coverprofile; no Codecov/Coveralls integration or PR coverage gates"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "Prow CI with comprehensive verify pipeline; parallelized make verify (8 procs); Cloud Build; Dependabot; test sharding"
  - dimension: "Agent Rules"
    score: 9.0
    status: "AGENTS.md with 58 skills including 54 reviewer skills; skillsaw linting; flake debugger; lineage tracer; release notes skill"
critical_gaps:
  - title: "No coverage tracking integration (Codecov/Coveralls)"
    impact: "Coverage regressions can go unnoticed; no PR-level coverage gates or trend visibility"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No container vulnerability scanning (Trivy/Snyk)"
    impact: "Security vulnerabilities in base images or dependencies not caught before release"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No pre-commit hooks"
    impact: "Developers may push code that fails CI linting checks, wasting CI resources"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No SAST/CodeQL integration"
    impact: "Static security analysis not automated; relies on manual code review for security issues"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add Codecov integration with PR coverage reporting"
    effort: "2-4 hours"
    impact: "Immediate visibility into coverage trends; prevent coverage regressions on PRs"
  - title: "Add Trivy container scanning to Cloud Build"
    effort: "2-3 hours"
    impact: "Automated vulnerability detection for container images before release"
  - title: "Add pre-commit hooks for formatting and linting"
    effort: "1-2 hours"
    impact: "Catch lint and formatting issues before they reach CI; faster developer feedback"
  - title: "Enable CodeQL or gosec scanning via Prow"
    effort: "2-3 hours"
    impact: "Automated static security analysis catches vulnerabilities early"
recommendations:
  priority_0:
    - "Integrate Codecov for PR coverage reporting and threshold enforcement"
    - "Add container vulnerability scanning (Trivy) to the image build pipeline"
  priority_1:
    - "Add CodeQL or Semgrep for automated SAST in CI"
    - "Implement pre-commit hooks (.pre-commit-config.yaml) for linting, formatting, and secret detection"
    - "Add image runtime validation testing (container startup, health check verification)"
  priority_2:
    - "Add container image signing and attestation (Cosign/Sigstore)"
    - "Create .claude/rules/ directory for test creation guidance to complement existing skills"
    - "Add Gitleaks or TruffleHog for secret detection in CI"
---

# Quality Analysis: kubernetes-sigs/kueue

## Executive Summary

- **Overall Score: 8.6/10**
- **Repository Type**: Kubernetes operator (job queueing system)
- **Primary Language**: Go
- **Framework**: Kubernetes controller-runtime, Kubebuilder
- **Key Strengths**: Exceptional test infrastructure spanning unit, integration (envtest), E2E (Kind), multi-cluster (MultiKueue), performance, and upgrade testing. Outstanding agent rules with 58 AgentSkill definitions including 54 code review skills with skillsaw linting. Well-organized Makefile with parallelized verification. Comprehensive Dependabot coverage across Go, Docker, npm, and GitHub Actions.
- **Critical Gaps**: No coverage tracking integration (Codecov/Coveralls), no container vulnerability scanning, no pre-commit hooks, no SAST/CodeQL.
- **Agent Rules Status**: Excellent - AGENTS.md with 58 skills, skillsaw linting integration, comprehensive reviewer skills

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 8.5/10 | 425 test files; Go testing + Ginkgo/Gomega; coverage profiles; sharding |
| Integration/E2E | 9.5/10 | Multi-layer: envtest, Kind E2E, MultiKueue, TAS, DRA, upgrade, performance |
| Build Integration | 7.0/10 | Cloud Build + Prow; Kustomize/Helm validation; no Konflux simulation |
| Image Testing | 6.5/10 | Multi-arch (4 platforms); distroless base; no runtime validation or scanning |
| Coverage Tracking | 5.5/10 | Coverage profiles generated but no external integration or PR gates |
| CI/CD Automation | 9.0/10 | Prow CI; parallelized verify; Dependabot; test sharding; Cloud Build |
| Agent Rules | 9.0/10 | 58 skills; 54 reviewer skills; skillsaw linting; flake debugger |

## Critical Gaps

### 1. No Coverage Tracking Integration
- **Impact**: Coverage regressions can silently merge; no trend visibility or PR-level feedback
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: The `make test` target generates `cover.out` via `-coverprofile`, but there is no Codecov, Coveralls, or equivalent integration. No `.codecov.yml` exists (only vendor libraries have them). No coverage threshold enforcement in CI.
- **Fix**: Add `.codecov.yml` with project and patch thresholds; integrate Codecov upload into the Prow test job.

### 2. No Container Vulnerability Scanning
- **Impact**: Known CVEs in base images or Go dependencies not caught automatically before release
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: No Trivy, Snyk, or Grype integration found. The SECURITY-INSIGHTS.yaml lists only Dependabot as the SCA tool. While Dependabot catches dependency CVEs in Go modules, it does not scan built container images.
- **Fix**: Add Trivy scan step to `cloudbuild.yaml` after image build, or add a Prow job for periodic image scanning.

### 3. No Pre-Commit Hooks
- **Impact**: Developers may push code that fails CI linting checks, wasting CI resources and developer time
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: No `.pre-commit-config.yaml` found. The project has excellent linting (20+ golangci-lint rules, KAL API linter, shell linting, Helm linting, skillsaw linting) but all checks run only in CI.
- **Fix**: Add `.pre-commit-config.yaml` with golangci-lint, gofmt, shellcheck, and Gitleaks hooks.

### 4. No SAST/CodeQL Integration
- **Impact**: No automated static security analysis; security vulnerabilities may be caught only during manual code review
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: No `.github/workflows/codeql.yml`, no gosec integration, no Semgrep configuration. While the project has excellent manual review skills (security reviewer skill with 8 sub-skills covering injection, path-traversal, nil-safety, DoS, etc.), automated SAST would provide an additional safety net.

## Quick Wins

### 1. Add Codecov Integration (2-4 hours)
```yaml
# .codecov.yml
coverage:
  status:
    project:
      default:
        target: auto
        threshold: 1%
    patch:
      default:
        target: 80%
comment:
  layout: "reach, diff, flags, files"
  behavior: default
```
Upload step in Prow job after `make test`:
```bash
bash <(curl -s https://codecov.io/bash) -f $(ARTIFACTS)/cover.out
```

### 2. Add Trivy Container Scanning (2-3 hours)
Add to `cloudbuild.yaml`:
```yaml
- name: 'aquasec/trivy'
  args: ['image', '--exit-code', '1', '--severity', 'HIGH,CRITICAL', '${IMAGE_TAG}']
```

### 3. Add Pre-Commit Hooks (1-2 hours)
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/golangci/golangci-lint
    rev: v2.1.6
    hooks:
      - id: golangci-lint
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.24.3
    hooks:
      - id: gitleaks
  - repo: https://github.com/koalaman/shellcheck-precommit
    rev: v0.10.0
    hooks:
      - id: shellcheck
```

### 4. Enable CodeQL Scanning (2-3 hours)
```yaml
# .github/workflows/codeql.yml
name: CodeQL
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'
jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: go
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

## Detailed Findings

### CI/CD Pipeline

**Prow-Based CI (Score: 9.0/10)**

Kueue uses the Kubernetes SIG standard Prow CI system rather than GitHub Actions for test automation. The `.github/workflows/` directory contains only 4 workflows for non-test operations:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `krew-release.yml` | Release (non-prerelease) | Publish kubectl plugin to krew-index |
| `sbom.yaml` | Manual dispatch | Generate SPDX SBOM for releases |
| `openvex.yaml` | Manual dispatch | Generate OpenVEX vulnerability data |
| `sync-dependabot.yaml` | PR (dependabot) | Sync Hugo/controller-tools versions |

**Cloud Build** handles image pushing:
- Post-submit: `cloudbuild.yaml` - builds and pushes images on merge
- Periodic: `cloudbuild-periodic.yaml` - periodic image builds
- Uses `E2_HIGHCPU_32` machine type for fast builds

**Make Verify Pipeline** is the core verification:
- `make verify` runs with `-j 8` parallelism (configurable via `VERIFY_NPROCS`)
- Output sync per target for clear failure identification
- Two phases: tree prerequisites (generation) then read-only checks
- Checks: golangci-lint, KAL API lint, gofmt, shell lint, Helm lint+unittest, npm depcheck, kustomize build, skillsaw lint
- Final assertion: `git diff --exit-code` on generated paths

**Dependabot** coverage is comprehensive:
- Go modules (6 directories)
- Docker images (15+ directories)
- npm packages (3 directories)
- GitHub Actions (daily)
- Groups for Kubernetes deps, MUI, Vite stack

### Test Coverage

**Unit Tests (Score: 8.5/10)**

- **425 test files** covering **777 source files** (0.55 test-to-code ratio)
- Framework: Go `testing` package + Ginkgo/Gomega
- Tools: `gotestsum` for JUnit XML output
- Coverage: `-coverprofile` flag generates `cover.out`
- Sharding: Supports `UNIT_TOTAL_SHARDS` / `UNIT_SHARD_INDEX` for CI parallelism
- Race detection: `-race` flag enabled by default
- Mocking: `mockgen` for controller mocks (`internal/mocks/`)

Key test areas:
- Scheduler logic (scheduler, fairsharing, admission)
- Webhook validation (workload, cluster queue, resource flavor, cohort)
- DRA (Dynamic Resource Allocation) mapper and claims
- Cache layer (scheduler, queue)
- Config validation
- Metrics collection
- Feature gates
- PodSet management
- Workload slicing

**Integration Tests (Score: 9.5/10)**

- **125 Go test files** using envtest (controller-runtime's test framework)
- Organized into singlecluster and multikueue suites
- Comprehensive controller testing across 16+ job types:
  - Core: Job, Pod, StatefulSet
  - ML frameworks: PyTorchJob, TensorFlowJob, JAXJob, XGBoostJob, PaddleJob
  - Distributed: MPIJob, TrainJob, SparkApplication
  - Ecosystem: AppWrapper, JobSet, LeaderWorkerSet, RayCluster, RayJob
- Feature-specific suites: TAS (Topology-Aware Scheduling), DRA, concurrent admission, failure recovery
- Webhook tests, scheduler tests, kueuectl CLI tests, importer tests, conversion tests
- Label-based filtering system for targeted test runs
- Parallelism: 4 procs (singlecluster), 3 procs (multikueue)
- `ginkgo-top` for test timing analysis

**E2E Tests (Score: 9.5/10)**

- **74 Go test files** + Cypress tests for KueueViz
- Infrastructure: Kind clusters with multi-version K8s support (1.34, 1.35, 1.36)
- Test categories:
  - **Baseline**: Core Kueue functionality (jobs, pods, metrics, kueuectl, visibility, HA)
  - **Extended**: Job framework integrations (KubeRay, JobSet, AppWrapper, PyTorch, Train)
  - **Sequential**: Tests requiring exclusive cluster access (admission fair sharing, failure recovery, wait-for-pods-ready)
  - **MultiKueue**: Multi-cluster testing (baseline, extended with sharding, sequential, DRA)
  - **TAS**: Topology-Aware Scheduling (baseline + extended)
  - **DRA**: Dynamic Resource Allocation (whole-device, counter/partitionable)
  - **Upgrade**: Version upgrade testing from v0.14.8
  - **Cert-Manager**: Certificate management testing
  - **KueueViz**: Cypress E2E for the visualization UI
- E2E modes: `ci` and `dev` (with cluster reuse)
- Helm installation testing for all suites
- Test against k/k main branch with WAS enabled
- Prometheus operator integration testing

**Performance Tests (Score: 8.5/10)**

- **11 Go test files** for scheduler performance
- Custom `performance-scheduler-runner` and `minimalkueue` binaries
- Configurations: baseline, TAS, large-scale
- Metrics scraping during tests
- CPU and memory profiling support
- Range spec validation with automated thresholds
- In-cluster testing support
- Retry mechanism for flaky performance results

### Code Quality

**Linting (Score: 9.0/10)**

Excellent linting configuration:

1. **golangci-lint** (`.golangci.yaml` - v2 config format):
   - 20+ linters enabled: copyloopvar, dupword, durationcheck, fatcontext, ginkgolinter, gocritic, goheader, intrange, loggercheck, makezero, misspell, modernize, nilerr, nilnesserr, nolintlint, perfsprint, revive, unconvert, usetesting, forbidigo
   - Formatters: gci (import grouping), golines (200 char max)
   - Strict nolintlint: requires explanation and specific linter name
   - Custom revive rules: context-as-argument, deep-exit, var-naming, use-slices-sort, use-waitgroup-go
   - forbidigo: bans `sort.Slice/Sort/Stable` in favor of slices package
   - 15-minute timeout for large codebase

2. **KAL API Linter** (`.golangci-kal.yaml`):
   - Kubernetes API conventions linter with 20 checks
   - Validates: json tags, conditions, integers, maxlength, no bools, no durations, no floats, no maps, optional/required markers, SSA tags, status subresource, no phase fields
   - Well-documented exclusions for intentional API design decisions

3. **Shell Linting**: ShellCheck integration via `.shellcheckrc` and `hack/testing/shellcheck/verify.sh`

4. **Helm Linting**: `helm lint` + template rendering with various config combinations + unit tests

5. **Skills Linting**: Skillsaw linter validates AgentSkill definitions against spec, with strict mode

6. **npm Depcheck**: Dependency checking for KueueViz frontend and E2E

**Missing**: No pre-commit hooks, no Gitleaks/secret detection

### Container Images

**Build Process (Score: 7.0/10)**

Main Dockerfile:
- Multi-stage build: golang builder + distroless/static:nonroot runtime
- Cross-platform: `BUILDPLATFORM` for build, `TARGETPLATFORM` for runtime
- Pinned base images with SHA256 digests
- Dependency caching: separate `go mod download` layer
- CGO disabled by default
- Non-root user (65532:65532)
- Retry mechanism for `go mod download`

Additional Dockerfiles:
- `cmd/importer/Dockerfile` - Data importer
- `cmd/kueueviz/backend/Dockerfile` and `frontend/Dockerfile` (implied)
- Testing images: agnhost, cypress, depcheck, shellcheck, spark, secretreader, ray
- Debug pod image

Multi-architecture support: `linux/amd64,linux/arm64,linux/s390x,linux/ppc64le`

**Missing**: No Trivy/vulnerability scanning, no image signing, no runtime validation tests, no SBOM integrated into build (manual workflow only)

### Security

**Security Practices (Score: 6.0/10)**

Strengths:
- SECURITY-INSIGHTS.yaml (OpenSSF standard) with comprehensive metadata
- SECURITY.md and SECURITY_CONTACTS
- Bug bounty program via HackerOne
- Dependabot for dependency scanning (Go, Docker, npm, GitHub Actions)
- OpenVEX vulnerability data generation for releases
- SBOM generation (SPDX format) for releases
- DEPENDENCY_LIFECYCLE.md documenting dependency management policy
- Pinned GitHub Actions with SHA digests
- Pinned Docker base images with SHA digests
- Distroless non-root container image

Gaps:
- No SAST/CodeQL automated scanning
- No Trivy/Snyk container scanning in CI
- No Gitleaks/TruffleHog secret detection
- No image signing/attestation (Cosign/Sigstore)

### Agent Rules (Agentic Flow Quality)

**Status**: Excellent (Score: 9.0/10)

**CLAUDE.md**: Delegates to AGENTS.md via `@AGENTS.md`

**AGENTS.md** (comprehensive):
- Kueue project description
- Canary mechanism for instruction-following degradation detection
- AI Contribution Policy (Kubernetes AI Tool Usage Policy compliance)
- Links to 58 AgentSkill definitions
- Code review patterns documentation

**Skills Architecture**:

| Category | Count | Description |
|----------|-------|-------------|
| Operational Skills | 4 | kueue-who-preempted, kueue-lineage, kueue-flake-debugger, kueue-release-notes |
| Reviewer Skills | 54 | Comprehensive code review patterns organized by domain |

Reviewer skill domains:
- **Architectural Decisions** (7 sub-skills): illogical-structure, nonsensical-decisions, avoidable-complexity, pointless-intermediate-variables, duplicated-logic, scope-creep, misplaced-logic
- **Buggy Behavior** (4 sub-skills): logic-errors, deleted-backwards-compatibility-code, feature-gate-interaction-bugs, unnecessary-guard-conditions
- **Code Style** (6 sub-skills): imprecise-names, convention-drift, reinvented-helpers, wrong-log-verbosity, misaligned-test-names, code-style-typos
- **Comments** (5 sub-skills): over-commenting, wrong-kind-of-comment, inaccurate-comments, missing-deferred-removal-markers, comment-typos
- **Security** (7 sub-skills): input-validation, injection, path-traversal, resource-bounds-dos, nil-safety, authn-authz-relaxation, information-disclosure
- **Test Patterns**: table-driven-tests, split-test-files, integration-tests-for-updates
- **API Quality**: api-field-comments, metrics-label-sets, metrics-feature-gates
- **Code Organization**: extract-helpers, encapsulate-paired-ops, push-guards-to-callees, visibility-exports, ctx-structured-logging, feature-gated-code, terminology-semantics, algorithm-comments, race-conditions

**Skillsaw Integration**: `.skillsaw.yaml` configures comprehensive skill linting with strict mode enabled. Validates against AgentSkill specification, checks for secrets, context budget, weak language, contradictions, and broken references.

**Gaps**: No `.claude/rules/` directory for test creation guidance (existing skills focus on review and debugging rather than test authoring patterns).

## Recommendations

### Priority 0 (Critical)

1. **Integrate Codecov for PR coverage reporting**
   - Add `.codecov.yml` with project target (auto) and patch target (80%)
   - Upload coverage from Prow test job
   - Enable PR comments with coverage diff
   - Effort: 2-4 hours

2. **Add container vulnerability scanning**
   - Integrate Trivy into Cloud Build pipeline
   - Set severity thresholds (HIGH/CRITICAL = fail)
   - Consider periodic scanning of released images
   - Effort: 2-3 hours

### Priority 1 (High Value)

3. **Add SAST integration (CodeQL or Semgrep)**
   - GitHub CodeQL for Go is well-supported
   - Could also add gosec via golangci-lint integration
   - Weekly scanning + PR scanning
   - Effort: 2-3 hours

4. **Implement pre-commit hooks**
   - golangci-lint, gofmt, shellcheck, gitleaks
   - Reduces CI churn from formatting/lint failures
   - Effort: 1-2 hours

5. **Add image runtime validation**
   - Verify container starts successfully
   - Test health/readiness endpoints
   - Validate manager binary executes
   - Effort: 4-6 hours

### Priority 2 (Nice-to-Have)

6. **Container image signing with Cosign/Sigstore**
   - Already have SBOM and OpenVEX; signing completes the supply chain security picture
   - Effort: 4-6 hours

7. **Create .claude/rules/ test creation guidelines**
   - Document unit test patterns specific to Kueue
   - Integration test setup patterns (envtest configuration)
   - E2E test structure and label taxonomy
   - Would complement the excellent reviewer skills
   - Effort: 3-4 hours

8. **Add Gitleaks secret detection**
   - Prevent accidental credential commits
   - Add to both pre-commit hooks and CI
   - Effort: 1-2 hours

## Comparison to Gold Standards

| Dimension | Kueue | odh-dashboard | notebooks | kserve | Notes |
|-----------|-------|---------------|-----------|--------|-------|
| Unit Tests | 8.5 | 9.0 | 7.0 | 8.5 | Strong coverage; missing PR coverage gates |
| Integration/E2E | 9.5 | 9.0 | 7.5 | 9.0 | Exceptional multi-layer + multi-cluster testing |
| Build Integration | 7.0 | 8.0 | 8.5 | 7.5 | Cloud Build + Prow; no Konflux simulation |
| Image Testing | 6.5 | 7.5 | 9.0 | 7.0 | Multi-arch but no scanning or runtime validation |
| Coverage Tracking | 5.5 | 9.0 | 6.0 | 8.0 | Coverage generated but not tracked/reported |
| CI/CD Automation | 9.0 | 9.0 | 8.0 | 8.5 | Prow + parallelized verify is excellent |
| Agent Rules | 9.0 | 8.0 | 3.0 | 4.0 | Industry-leading with 58 skills + skillsaw |
| **Overall** | **8.6** | **8.5** | **7.0** | **7.5** | |

Kueue stands out for its agent rules and testing infrastructure. It has the most comprehensive AgentSkill collection of any Kubernetes SIG project analyzed, with 54 code review skills organized by domain. The multi-layer testing (unit + envtest integration + Kind E2E + multi-cluster + performance + upgrade) is among the best in the ecosystem.

## File Paths Reference

### CI/CD
- `.github/workflows/` - GitHub Actions (krew-release, SBOM, OpenVEX, Dependabot sync)
- `.github/dependabot.yml` - Comprehensive dependency automation
- `cloudbuild.yaml` - Post-submit image pushing
- `cloudbuild-periodic.yaml` - Periodic image builds
- `Makefile` - Main build orchestration
- `Makefile-test.mk` - Test targets (unit, integration, E2E, performance)
- `Makefile-verify.mk` - Verification pipeline (lint, format, Helm, skills)

### Testing
- `test/integration/` - 125 files: envtest-based integration tests
- `test/integration/singlecluster/controller/` - Controller tests for 16+ job types
- `test/integration/singlecluster/scheduler/` - Scheduler integration tests
- `test/integration/singlecluster/webhook/` - Webhook tests
- `test/integration/multikueue/` - Multi-cluster integration tests
- `test/e2e/` - 74 files: Kind-based E2E tests
- `test/e2e/singlecluster/{baseline,extended}/` - Core E2E
- `test/e2e/multikueue/` - Multi-cluster E2E
- `test/e2e/tas/` - Topology-Aware Scheduling E2E
- `test/e2e/dra/` - Dynamic Resource Allocation E2E
- `test/e2e/upgrade/` - Upgrade testing
- `test/e2e/kueueviz/` - Cypress UI tests
- `test/performance/` - Scheduler performance tests
- `charts/kueue/tests/` - Helm unit tests (4 files)

### Code Quality
- `.golangci.yaml` - Primary linter config (20+ linters, formatters)
- `.golangci-kal.yaml` - Kubernetes API conventions linter (20 checks)
- `.shellcheckrc` - Shell linting config
- `.skillsaw.yaml` - AgentSkill linting config (strict mode)

### Container Images
- `Dockerfile` - Main manager image (multi-stage, distroless, multi-arch)
- `cmd/importer/Dockerfile` - Data importer
- `hack/testing/*/Dockerfile` - Test infrastructure images (7+)

### Security
- `SECURITY-INSIGHTS.yaml` - OpenSSF security metadata
- `SECURITY.md` - Security policy
- `SECURITY_CONTACTS` - Security contact list
- `DEPENDENCY_LIFECYCLE.md` - Dependency management policy

### Agent Rules
- `CLAUDE.md` - Delegates to AGENTS.md
- `AGENTS.md` - Main agent instructions with skill index
- `.skillsaw.yaml` - Skill validation configuration
- `cmd/experimental/skills/` - 58 AgentSkill definitions
- `cmd/experimental/skills/reviewer/` - 54 code review skills
- `cmd/experimental/skills/kueue-flake-debugger/` - CI flake investigation
- `cmd/experimental/skills/kueue-lineage/` - Workload ownership tracing
- `cmd/experimental/skills/kueue-who-preempted/` - Preemption investigation
- `cmd/experimental/skills/kueue-release-notes/` - Release note drafting
