---
repository: "kubeflow/pipelines-components"
overall_score: 6.5
scorecard:
  - dimension: "Unit Tests"
    score: 7.0
    status: "Good test coverage for scripts and components with pytest; room for broader component test coverage"
  - dimension: "Integration/E2E"
    score: 4.0
    status: "No dedicated E2E or integration test suite; component tests use KFP LocalRunner but no cluster-based validation"
  - dimension: "Build Integration"
    score: 7.0
    status: "PR-time container builds with validation, compile checks, and base image verification"
  - dimension: "Image Testing"
    score: 5.0
    status: "Single example Containerfile using python:3.11-slim; no multi-arch PR builds, no runtime validation, no health checks"
  - dimension: "Coverage Tracking"
    score: 3.0
    status: "pytest-cov available as dependency but not enforced in CI; no codecov integration or thresholds"
  - dimension: "CI/CD Automation"
    score: 9.0
    status: "16 well-organized workflows, concurrency control, path-filtered triggers, multi-Python matrix testing"
  - dimension: "Static Analysis"
    score: 9.0
    status: "Ruff linting/formatting, yamllint, markdownlint, import guard, pre-commit hooks, Dependabot configured"
  - dimension: "Agent Rules"
    score: 8.0
    status: "Comprehensive AGENTS.md with mode-based guidance, validation tables, and references to contributing docs"
critical_gaps:
  - title: "No coverage tracking or enforcement in CI"
    impact: "Coverage regressions go undetected; no visibility into test quality trends"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No E2E or integration tests against a real KFP cluster"
    impact: "Components may compile but fail at runtime in actual Kubeflow Pipelines environments"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "Only 4 out of ~10+ components/pipelines have unit tests"
    impact: "Most component code paths are untested; regressions in untested components go undetected"
    severity: "HIGH"
    effort: "12-20 hours"
  - title: "Example Containerfile uses python:3.11-slim (not FIPS-capable)"
    impact: "Components using custom base images cannot be deployed in FIPS-required environments without rebuilding"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No CLAUDE.md or .claude/rules/ for test creation patterns"
    impact: "AI agents lack framework-specific guidance for writing KFP component tests"
    severity: "LOW"
    effort: "3-4 hours"
quick_wins:
  - title: "Add Codecov integration with coverage thresholds"
    effort: "3-4 hours"
    impact: "Automated coverage tracking on every PR with regression detection"
  - title: "Add timeout-minutes to all CI workflow jobs"
    effort: "1 hour"
    impact: "Prevent hung jobs from consuming CI resources indefinitely"
  - title: "Create CLAUDE.md with test creation rules pointing to AGENTS.md patterns"
    effort: "2-3 hours"
    impact: "AI-generated tests will follow KFP component test conventions (LocalRunner, MockArtifact patterns)"
  - title: "Add UBI-based Containerfile example for FIPS-capable builds"
    effort: "1-2 hours"
    impact: "Provide FIPS-compatible base image template for regulated environments"
  - title: "Enable coverage collection in scripts-tests.yml workflow"
    effort: "1-2 hours"
    impact: "Coverage data collected and uploaded automatically on every PR"
recommendations:
  priority_0:
    - "Add Codecov integration with .codecov.yml and coverage upload in CI workflows"
    - "Enforce coverage thresholds (e.g., 70% project, 60% patch) to prevent regressions"
    - "Require unit tests for all new components/pipelines via CI enforcement"
  priority_1:
    - "Add integration tests that deploy components to a real KFP cluster (Kind + KFP)"
    - "Expand unit test coverage to all existing components and pipelines"
    - "Create CLAUDE.md with KFP-specific test patterns and link to AGENTS.md"
    - "Add UBI-based Containerfile example for FIPS-capable deployments"
    - "Add timeout-minutes to all CI jobs to prevent resource exhaustion"
  priority_2:
    - "Add multi-architecture support for component base images in PR builds"
    - "Add container health checks in Containerfile examples"
    - "Add performance benchmarks for component compilation and validation"
    - "Create .claude/rules/ with unit-test and integration-test patterns"
---

# Quality Analysis: kubeflow/pipelines-components

## Executive Summary
- **Overall Score: 6.5/10**
- **Key Strengths**: Excellent CI/CD automation (16 workflows), strong static analysis (Ruff, yamllint, markdownlint, import guard, pre-commit), comprehensive AGENTS.md, well-configured Dependabot
- **Critical Gaps**: No coverage tracking/enforcement in CI, no E2E/integration tests against real KFP clusters, most components lack unit tests, no FIPS-capable base images
- **Agent Rules Status**: Strong (AGENTS.md present with comprehensive guidance; no CLAUDE.md or .claude/rules/)

## Quality Scorecard
| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 7/10 | 15% | Good test coverage for scripts and components with pytest; room for broader component test coverage |
| Integration/E2E | 4/10 | 20% | No dedicated E2E or integration test suite; component tests use KFP LocalRunner but no cluster-based validation |
| Build Integration | 7/10 | 15% | PR-time container builds with validation, compile checks, and base image verification |
| Image Testing | 5/10 | 10% | Single example Containerfile using python:3.11-slim; no multi-arch PR builds, no runtime validation |
| Coverage Tracking | 3/10 | 10% | pytest-cov available as dependency but not enforced in CI; no codecov integration |
| CI/CD Automation | 9/10 | 15% | 16 well-organized workflows, concurrency control, path-filtered triggers, multi-Python matrix |
| Static Analysis | 9/10 | 10% | Ruff linting/formatting, yamllint, markdownlint, import guard, pre-commit hooks, Dependabot |
| Agent Rules | 8/10 | 5% | Comprehensive AGENTS.md with mode-based guidance; missing CLAUDE.md and .claude/rules/ |

**Weighted Score: 6.5/10** (0.15×7 + 0.20×4 + 0.15×7 + 0.10×5 + 0.10×3 + 0.15×9 + 0.10×9 + 0.05×8 = 6.50)

## Critical Gaps

1. **No coverage tracking or enforcement in CI**
   - Impact: Coverage regressions go undetected; no visibility into test quality trends across components
   - Severity: HIGH
   - Effort: 4-6 hours
   - Detail: `pytest-cov` is listed in `pyproject.toml` test dependencies and `make test-coverage` target exists, but no CI workflow collects or uploads coverage data. No `.codecov.yml` or equivalent configuration exists.

2. **No E2E or integration tests against a real KFP cluster**
   - Impact: Components compile and pass local tests but may fail at runtime in actual Kubeflow Pipelines environments (API mismatches, artifact handling issues, runtime dependency gaps)
   - Severity: HIGH
   - Effort: 16-24 hours
   - Detail: Component tests use KFP's `local.SubprocessRunner` for local validation, which is valuable but doesn't validate actual pipeline execution. No Kind/Minikube cluster setup or KFP deployment in CI.

3. **Only ~4 out of 10+ components/pipelines have unit tests**
   - Impact: Most component code paths are untested; regressions in components without tests go undetected
   - Severity: HIGH
   - Effort: 12-20 hours
   - Detail: 27 test files exist across scripts and components, but only `sdg` and `yoda_data_processor` components have unit tests. All 16 scripts have test coverage. The `component-pipeline-tests.yml` workflow only runs tests for changed assets, so components without tests pass CI silently.

4. **Example Containerfile uses python:3.11-slim (not FIPS-capable)**
   - Impact: Components using custom base images cannot be deployed in FIPS-required environments
   - Severity: MEDIUM
   - Effort: 2-4 hours

5. **No CLAUDE.md or .claude/rules/ for test creation patterns**
   - Impact: AI agents lack framework-specific guidance for writing KFP component tests (LocalRunner patterns, MockArtifact usage, conftest.py fixtures)
   - Severity: LOW
   - Effort: 3-4 hours

## Quick Wins

1. **Add Codecov integration with coverage thresholds**
   - Effort: 3-4 hours
   - Impact: Automated coverage tracking on every PR with regression detection
   - Implementation:
   ```yaml
   # .codecov.yml
   coverage:
     status:
       project:
         default:
           target: 70%
           threshold: 2%
       patch:
         default:
           target: 60%
   ```
   Add to `scripts-tests.yml`:
   ```yaml
   - name: Run tests with coverage
     run: |
       uv run pytest */tests/ -v --cov=. --cov-report=xml
   - name: Upload coverage
     uses: codecov/codecov-action@v4
     with:
       files: ./coverage.xml
       fail_ci_if_error: false
   ```

2. **Add timeout-minutes to all CI workflow jobs**
   - Effort: 1 hour
   - Impact: Prevent hung jobs from consuming CI resources; only `ci-checks.yml` currently has a timeout (10 min)
   - Implementation: Add `timeout-minutes: 15` to all test/lint jobs and `timeout-minutes: 30` to container build jobs

3. **Create CLAUDE.md with test creation rules**
   - Effort: 2-3 hours
   - Impact: AI-generated tests will follow KFP component conventions (LocalRunner, MockArtifact patterns)
   - Implementation:
   ```markdown
   # CLAUDE.md
   ## Testing
   See AGENTS.md for comprehensive agent guidance.
   See docs/CONTRIBUTING.md for testing patterns.
   
   ## Test Patterns
   - Unit tests: Use pytest with MockArtifact, fixtures from conftest.py
   - Local runner tests: Use kfp.local.SubprocessRunner via setup_and_teardown_subprocess_runner fixture
   - Scripts tests: Place in scripts/<module>/tests/test_*.py
   ```

4. **Add UBI-based Containerfile example for FIPS-capable builds**
   - Effort: 1-2 hours
   - Impact: Provide FIPS-compatible base image template for regulated environments
   - Implementation:
   ```dockerfile
   FROM registry.access.redhat.com/ubi9/python-311:latest
   # FIPS-capable base image for regulated environments
   ```

5. **Enable coverage collection in scripts-tests.yml workflow**
   - Effort: 1-2 hours
   - Impact: Coverage data collected and uploaded automatically on every PR
   - Implementation: Add `--cov=. --cov-report=xml` to pytest invocations in the scripts-tests workflow

## Detailed Findings

### Unit Tests (7/10)

**Strengths:**
- 27 test files covering scripts and component logic
- All 16 script modules have corresponding test suites under `scripts/<module>/tests/`
- 4 GitHub script modules have tests under `.github/scripts/<module>/tests/`
- Component tests demonstrate excellent patterns:
  - `MockArtifact` class for testing KFP artifacts
  - Well-organized test classes (`TestInputHandling`, `TestFlowSelection`, `TestOutputHandling`)
  - Comprehensive fixtures using `@pytest.fixture` with proper cleanup
  - `conftest.py` provides shared `setup_and_teardown_subprocess_runner` fixture for KFP LocalRunner tests
- Multi-Python version testing (Python 3.11, 3.13) in `scripts-tests.yml`
- Test runner script (`scripts/tests/run_component_tests.py`) discovers and runs component tests with configurable timeouts

**Test-to-Code Ratio:**
- Total Python source files (non-test, non-init): 76
- Test files: 27
- Ratio: 36% (Adequate for scripts; low for components)

**Gaps:**
- Only 2 of the component/pipeline directories (`sdg`, `yoda_data_processor`) have unit tests
- `training/`, `evaluation/`, `deployment/` category components/pipelines appear to lack test directories
- Test files under `test_data/` exist as fixtures, not as active test suites
- No test generation enforcement — new components can be merged without tests (tests directory is listed as "optional" in CONTRIBUTING.md)

**Key Files:**
- `conftest.py` — Root-level shared fixtures for KFP LocalRunner
- `scripts/tests/run_component_tests.py` — Component test discovery and runner
- `components/data_processing/sdg/tests/test_component_unit.py` — Exemplary component test
- `components/data_processing/yoda_data_processor/tests/` — Component with unit + local tests

### Integration/E2E Tests (4/10)

**Strengths:**
- Component tests use `kfp.local.SubprocessRunner` for local execution validation
- `component-pipeline-tests.yml` runs targeted tests + example pipeline validation on PRs
- `compile-and-deps.yml` validates component compilation on every PR
- `validate-components` job in `container-build.yml` validates components against built images

**Gaps:**
- No dedicated `e2e/` or `integration/` directories
- No cluster-based testing (no Kind, Minikube, or envtest setup)
- No actual KFP pipeline execution tests (only local runner + compilation checks)
- No multi-version testing of KFP SDK or Kubernetes versions
- No contract tests between components and the KFP runtime API

**Recommendations:**
1. Add Kind + KFP deployment for E2E tests that validate actual pipeline execution
2. Test component compilation and execution across KFP SDK versions (matrix strategy)
3. Add integration tests that deploy components to a test namespace and run sample pipelines

### Build Integration (7/10)

**Strengths:**
- **PR-time container builds**: `container-build.yml` builds and saves images on PRs, pushes on main/release/tags
- **Multi-arch support on push**: `linux/amd64,linux/arm64` platforms for production builds
- **Base image validation**: Dedicated `base-image-check.yml` workflow validates base image compliance
- **Compile checks**: `compile-and-deps.yml` validates component compilation on every PR
- **Container build matrix check**: `container-build-matrix-check.yml` ensures build matrix stays in sync with actual Containerfiles
- **Component validation pipeline**: Build → Load image → Override base images → Validate compilation (end-to-end validation)
- **Package build validation**: `build-packages.yml` builds wheel, validates contents, tests installation and imports
- **Docker layer caching**: `cache-from: type=gha` and `cache-to: type=gha,mode=max` with BuildX

**Gaps:**
- No Konflux build simulation in CI
- No `kubectl apply --dry-run` or Kustomize overlay validation (repo is a component library, not an operator — less applicable)
- Only one example image in the build matrix currently (component base images are referenced, not built here)

**Key Files:**
- `.github/workflows/container-build.yml` — Full build + validation pipeline
- `.github/workflows/compile-and-deps.yml` — Component compilation validation
- `.github/workflows/base-image-check.yml` — Base image policy enforcement
- `.github/workflows/build-packages.yml` — Python package build and validation
- `.github/workflows/container-build-matrix-check.yml` — Build matrix consistency check

### Image Testing (5/10)

**Strengths:**
- `docs/examples/Containerfile` provides a documented example for building custom component base images
- Multi-arch builds (`linux/amd64,linux/arm64`) enabled for production pushes
- Docker BuildX and QEMU setup in CI for cross-platform builds
- Image artifacts saved and loaded for PR validation
- Container build matrix check ensures all Containerfiles are included in CI

**Gaps:**
- Only one example Containerfile exists (`docs/examples/Containerfile`)
- Base image is `python:3.11-slim` — not FIPS-capable, no UBI option provided
- No `HEALTHCHECK` directive in Containerfile
- No runtime validation (no `docker run` or container startup test)
- No Testcontainers usage for integration testing
- Multi-arch builds only on push, not on PR (only `linux/amd64` for PRs)
- No `.dockerignore` specific to the example image
- No non-root user configuration in the example Containerfile

**Key Files:**
- `docs/examples/Containerfile` — Example component base image definition
- `.github/workflows/container-build.yml` — Container build and push workflow

**Recommendations:**
1. Add `HEALTHCHECK` and non-root `USER` to the example Containerfile
2. Add a runtime smoke test step after image build in CI (e.g., `docker run --rm image python -c "import kfp"`)
3. Provide a UBI-based Containerfile example for FIPS-capable environments
4. Add `.dockerignore` to reduce build context size

### Coverage Tracking (3/10)

**Strengths:**
- `pytest-cov` is included in `pyproject.toml` test dependencies
- `make test-coverage` target exists in Makefile for local coverage reporting:
  ```makefile
  test-coverage:
      cd .github/scripts && $(PYTEST) */tests/ --cov=. --cov-report=term-missing -v $(ARGS)
  ```

**Gaps:**
- No `.codecov.yml` or `codecov.yml` configuration file
- No coverage upload in any CI workflow
- No coverage thresholds or enforcement
- No PR coverage reporting or comments
- `make test-coverage` only covers `.github/scripts/` tests, not component or pipeline tests
- No coverage badge in README

**Recommendations:**
1. Add `.codecov.yml` with project and patch coverage targets
2. Add `codecov/codecov-action` to `scripts-tests.yml` and `component-pipeline-tests.yml`
3. Add `--cov` flags to pytest invocations in CI
4. Set reasonable initial thresholds (e.g., 70% project, 60% patch) and increase over time

### CI/CD Automation (9/10)

**Strengths:**
- **16 well-organized workflows** covering comprehensive validation:
  | Workflow | Trigger | Purpose |
  |---------|---------|---------|
  | `python-lint.yml` | PR (*.py), push | Ruff format + lint on changed Python files |
  | `yaml-lint.yml` | PR (*.yml/*.yaml), push | yamllint on changed YAML files |
  | `markdown-lint.yml` | PR (*.md), push | markdownlint on changed Markdown files |
  | `scripts-tests.yml` | PR (scripts/**), push | Unit tests for scripts and GH scripts (Python 3.11 + 3.13 matrix) |
  | `component-pipeline-tests.yml` | PR (components/**, pipelines/**), push | Targeted component/pipeline tests + example validation |
  | `compile-and-deps.yml` | PR (components/**, pipelines/**) | Component compilation check |
  | `container-build.yml` | PR (Containerfile, Dockerfile), push | Build, push, and validate container images |
  | `container-build-matrix-check.yml` | PR (Containerfile, Dockerfile) | Build matrix consistency check |
  | `base-image-check.yml` | PR (components/**, pipelines/**), push | Base image policy enforcement (Python 3.11 + 3.13 matrix) |
  | `validate-metadata-schema.yml` | PR (components/**, pipelines/**) | Metadata.yaml schema validation |
  | `readme-check.yml` | PR (components/**, pipelines/**) | README sync validation |
  | `package-entries-check.yml` | PR (components/**, pipelines/**), push | Python package entries validation |
  | `build-packages.yml` | PR, push | Build wheel, validate contents, test installation |
  | `ci-checks.yml` | PR (target) | Aggregate CI check status |
  | `add-ci-passed-label.yml` | workflow_run | Add/reset ci-passed label |
  | `gh-workflow-approve.yml` | PR (target) | Approve workflow runs for trusted contributors |

- **Concurrency control**: 5 workflows use `concurrency:` with `cancel-in-progress: true`
- **Path-filtered triggers**: All workflows use precise `paths:` filters to avoid unnecessary runs
- **Multi-Python version matrix**: Scripts tests and base image checks run on Python 3.11 and 3.13
- **Reusable composite action**: `.github/actions/setup-python-ci/action.yml` standardizes Python + uv setup
- **Smart change detection**: Custom `.github/actions/detect-changed-assets/` action for targeted test execution
- **Pinned action versions**: All GitHub Actions use SHA-pinned versions for supply chain security
- **CI aggregation**: `ci-checks.yml` + `add-ci-passed-label.yml` provide a unified CI pass/fail signal

**Gaps:**
- Only `ci-checks.yml` has `timeout-minutes` (10 min); other workflows lack timeout configuration
- No workflow status badges in README
- No test parallelization within individual jobs (single pytest invocation)
- No caching strategy for Python dependencies (uv install runs fresh each time)

**Recommendations:**
1. Add `timeout-minutes` to all jobs to prevent resource exhaustion
2. Consider uv cache action for faster dependency installation
3. Add workflow status badges to README for visibility

### Static Analysis (9/10)

#### Linting

**Strengths:**
- **Ruff**: Comprehensive configuration in `pyproject.toml`:
  - Line length: 120
  - Target: Python 3.11
  - Rules enabled: pycodestyle (E, W), pyflakes (F), isort (I), pydocstyle (D)
  - Google-style docstring convention
  - Format: double quotes, space indent, docstring code formatting
- **yamllint**: Configured via `.yamllint.yml` (max line 120, warning level)
- **markdownlint**: Configured via `.markdownlint.json` (generous line limits, disabled HTML/URL rules)
- **Import guard**: Custom script `.github/scripts/check_imports/check_imports.py` with exception config
- **uv lock check**: Validates lockfile sync in both CI and pre-commit

#### Pre-commit Hooks

**Excellent configuration** with 9 hooks in `.pre-commit-config.yaml`:
1. `uv-lock-check` — Lock file sync validation
2. `ruff-format` — Python formatting
3. `ruff-check` — Python linting with auto-fix
4. `yamllint` — YAML validation
5. `import-guard` — Import restriction enforcement
6. `validate-readme` — README sync for changed components
7. `markdownlint` — Markdown formatting
8. `validate-metadata` — Metadata.yaml schema validation
9. `validate-base-images` — Base image policy for changed components

#### FIPS Compatibility

**Status: N/A (Python-only repository)**
- No cryptographic imports detected in source code
- No Go code present (not applicable for FIPS build tags)
- Example Containerfile uses `python:3.11-slim` (Debian-based, not FIPS-certified)
- For FIPS-required deployments, a UBI-based Containerfile should be provided as an alternative

#### Dependency Alerts

**Status: Well Configured**
- `.github/dependabot.yml` configured for:
  - `uv` ecosystem (daily, `chore(deps)` prefix)
  - `github-actions` ecosystem (daily, `chore(deps)` prefix)
- Labels: `dependencies`
- No Renovate configuration (not needed with Dependabot in place)

**Key Files:**
- `pyproject.toml` — Ruff configuration (lint, format, isort)
- `.pre-commit-config.yaml` — 9 pre-commit hooks
- `.yamllint.yml` — YAML lint rules
- `.markdownlint.json` — Markdown lint rules
- `.github/dependabot.yml` — Dependency update automation
- `.github/scripts/check_imports/` — Custom import guard

### Agent Rules (8/10)

**Strengths:**
- **Comprehensive `AGENTS.md`** (7,593 bytes) in repository root with:
  - Sources of truth section linking to canonical docs
  - Three agent modes defined: contributing, end-user, maintenance
  - Quickstart section with `make` targets for scaffolding
  - Detailed validation table mapping checks to CI workflows
  - Testing guidance references to CONTRIBUTING.md
  - Common tasks table with reference patterns
- **Well-structured guidance** for component creation:
  - Required files checklist
  - Naming conventions
  - Governance and approval process
  - Pre-commit validation instructions
- **Links to canonical docs**: CONTRIBUTING.md, GOVERNANCE.md, scripts READMEs

**Gaps:**
- No `CLAUDE.md` in repository root (AGENTS.md serves a similar purpose but CLAUDE.md is the Claude Code convention)
- No `.claude/` directory or `.claude/rules/` for test creation patterns
- No specific test creation rules with code examples (AGENTS.md points to docs but doesn't embed patterns)
- No `.claude/skills/` for custom workflows

**Recommendations:**
1. Create `CLAUDE.md` that references AGENTS.md and adds Claude Code-specific test patterns
2. Create `.claude/rules/unit-tests.md` with KFP component test patterns:
   ```markdown
   ## KFP Component Unit Tests
   - Use pytest with MockArtifact pattern (see components/data_processing/sdg/tests/)
   - Use fixtures from conftest.py (setup_and_teardown_subprocess_runner)
   - Organize tests in classes by functionality (TestInputHandling, TestOutputHandling)
   - Include test_component_unit.py for pure logic tests
   - Include test_component_local.py for KFP LocalRunner tests
   ```
3. Generate comprehensive rules with `/test-rules-generator`

## Recommendations

### Priority 0 (Critical)
- Add Codecov integration with `.codecov.yml` and coverage upload in `scripts-tests.yml` and `component-pipeline-tests.yml`
- Enforce coverage thresholds (e.g., 70% project, 60% patch) to prevent regressions
- Require unit tests for all new components/pipelines via CI enforcement (make `tests/` directory required, not optional in CONTRIBUTING.md)

### Priority 1 (High Value)
- Add integration tests that deploy components to a real KFP cluster (Kind + KFP)
- Expand unit test coverage to all existing components and pipelines
- Create `CLAUDE.md` with KFP-specific test patterns and link to AGENTS.md
- Add UBI-based Containerfile example for FIPS-capable deployments
- Add `timeout-minutes` to all CI jobs to prevent resource exhaustion
- Add container runtime smoke test after image build in CI

### Priority 2 (Nice-to-Have)
- Add multi-architecture support for component base images in PR builds (currently only on push)
- Add container health checks (`HEALTHCHECK`) and non-root user in Containerfile examples
- Add performance benchmarks for component compilation and validation times
- Create `.claude/rules/` with unit-test and local-runner-test patterns
- Add uv dependency caching in CI for faster workflow runs
- Add workflow status badges to README

## Comparison to Gold Standards

| Dimension | pipelines-components | odh-dashboard | notebooks | Gap |
|-----------|---------------------|---------------|-----------|-----|
| Unit Tests | 7/10 | 9/10 | 8/10 | -2 (Expand component test coverage) |
| Integration/E2E | 4/10 | 10/10 | 7/10 | -6 (Add cluster-based KFP tests) |
| Build Integration | 7/10 | 9/10 | 8/10 | -2 (Add Konflux simulation) |
| Image Testing | 5/10 | 7/10 | 10/10 | -5 (Add runtime validation, FIPS images) |
| Coverage Tracking | 3/10 | 9/10 | 8/10 | -6 (Add codecov integration + thresholds) |
| CI/CD Automation | 9/10 | 9/10 | 8/10 | 0 (Already excellent) |
| Static Analysis | 9/10 | 9/10 | 8/10 | 0 (Already excellent) |
| Agent Rules | 8/10 | 8/10 | 6/10 | 0 (Strong AGENTS.md) |

**Key Takeaways:**
- **Biggest gaps**: Coverage Tracking (3/10) and Integration/E2E (4/10) — both critical for production quality
- **Strengths**: CI/CD Automation (9/10) and Static Analysis (9/10) are gold-standard quality
- **Unique strength**: Comprehensive AGENTS.md with three distinct agent modes is best-in-class for AI agent guidance
- **Asymmetry**: Excellent automation infrastructure but weak test coverage enforcement — the pipelines exist but aren't collecting coverage data

## File Paths Reference

### CI/CD
- `.github/workflows/scripts-tests.yml` — Script unit tests (Python 3.11 + 3.13)
- `.github/workflows/component-pipeline-tests.yml` — Component/pipeline targeted tests
- `.github/workflows/python-lint.yml` — Ruff formatting and linting
- `.github/workflows/yaml-lint.yml` — YAML linting
- `.github/workflows/markdown-lint.yml` — Markdown linting
- `.github/workflows/container-build.yml` — Container image build and push
- `.github/workflows/compile-and-deps.yml` — Component compilation validation
- `.github/workflows/base-image-check.yml` — Base image policy enforcement
- `.github/workflows/validate-metadata-schema.yml` — Metadata schema validation
- `.github/workflows/readme-check.yml` — README sync check
- `.github/workflows/package-entries-check.yml` — Package entries validation
- `.github/workflows/build-packages.yml` — Python package build
- `.github/workflows/ci-checks.yml` — CI aggregation
- `.github/workflows/container-build-matrix-check.yml` — Build matrix consistency
- `.github/workflows/add-ci-passed-label.yml` — CI label management
- `.github/workflows/gh-workflow-approve.yml` — Workflow approval for trusted contributors

### Testing
- `conftest.py` — Root-level shared fixtures (KFP LocalRunner)
- `scripts/tests/run_component_tests.py` — Component test discovery and runner
- `components/data_processing/sdg/tests/test_component_unit.py` — Component unit tests
- `components/data_processing/sdg/tests/test_component_local.py` — Component LocalRunner tests
- `components/data_processing/yoda_data_processor/tests/` — Component tests
- `scripts/*/tests/test_*.py` — Script unit tests (16 modules)
- `.github/scripts/*/tests/test_*.py` — GitHub script tests (4 modules)

### Static Analysis
- `pyproject.toml` — Ruff lint/format configuration
- `.pre-commit-config.yaml` — 9 pre-commit hooks
- `.yamllint.yml` — YAML lint rules
- `.markdownlint.json` — Markdown lint rules
- `.github/dependabot.yml` — Dependabot configuration (uv + github-actions)
- `.github/scripts/check_imports/` — Custom import guard

### Container Images
- `docs/examples/Containerfile` — Example component base image

### Agent Rules
- `AGENTS.md` — Comprehensive AI agent guidance (3 modes)
- `docs/CONTRIBUTING.md` — Contributing guide with testing section
- `docs/GOVERNANCE.md` — Repository governance and approval process

### Build Configuration
- `Makefile` — Build, test, lint, and scaffolding targets
- `pyproject.toml` — Python project configuration
- `uv.lock` — Dependency lockfile
- `.github/actions/setup-python-ci/action.yml` — Shared CI setup action
- `.github/actions/detect-changed-assets/action.yml` — Change detection action
