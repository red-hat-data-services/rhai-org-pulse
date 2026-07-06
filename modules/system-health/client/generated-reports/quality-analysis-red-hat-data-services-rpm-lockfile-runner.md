---
repository: "red-hat-data-services/rpm-lockfile-runner"
overall_score: 1.3
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No tests exist - zero test files in the repository"
  - dimension: "Integration/E2E"
    score: 1.0
    status: "Workflow runs the tool end-to-end but has no assertions or validation checks"
  - dimension: "Build Integration"
    score: 2.0
    status: "Workflow builds external container but no PR-time validation or build testing"
  - dimension: "Image Testing"
    score: 1.0
    status: "Builds rpm-lockfile-prototype container from upstream but no runtime validation"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling, no thresholds, no reporting"
  - dimension: "CI/CD Automation"
    score: 3.0
    status: "Basic workflow exists but lacks caching, concurrency control, and quality gates"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, no .claude/ directory, no agent rules whatsoever"
critical_gaps:
  - title: "Zero test coverage - no tests of any kind"
    impact: "Script changes can silently break lockfile generation; regressions undetectable"
    severity: "HIGH"
    effort: "8-12 hours"
  - title: "No .gitignore - temp files could be committed"
    impact: "*.tmp files, intermediate artifacts could pollute the repository"
    severity: "HIGH"
    effort: "0.5 hours"
  - title: "Supply chain risk - actions-js/push@master pinned to branch, not SHA"
    impact: "Upstream tag/branch hijack could inject arbitrary code into CI"
    severity: "HIGH"
    effort: "0.5 hours"
  - title: "No input validation on config.yaml"
    impact: "Malformed config silently produces incorrect lockfiles or fails in non-obvious ways"
    severity: "MEDIUM"
    effort: "4-6 hours"
  - title: "No shellcheck or Python linting"
    impact: "Shell scripting bugs and Python issues go undetected"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add .gitignore for *.tmp and generated artifacts"
    effort: "15 minutes"
    impact: "Prevents accidental commit of temporary files"
  - title: "Pin actions-js/push to a commit SHA instead of @master"
    effort: "15 minutes"
    impact: "Eliminates supply chain hijack risk in CI"
  - title: "Add shellcheck linting step to workflow"
    effort: "1 hour"
    impact: "Catches common shell scripting bugs automatically"
  - title: "Add basic unit tests for sanitize-ubi-repo.py"
    effort: "2-3 hours"
    impact: "Validates the Python logic that sanitizes repo IDs"
  - title: "Add concurrency control to workflow"
    effort: "15 minutes"
    impact: "Prevents conflicting concurrent runs on same branch"
recommendations:
  priority_0:
    - "Add unit tests for sanitize-ubi-repo.py (regex logic, dedup, suffix addition)"
    - "Add integration test that validates lockfile output format against schema"
    - "Pin all GitHub Actions to commit SHAs, not branch names"
    - "Add .gitignore file"
  priority_1:
    - "Add shellcheck CI step for runner.sh"
    - "Add ruff/flake8 linting for Python code"
    - "Add config.yaml schema validation before running the tool"
    - "Add concurrency control and caching to the workflow"
  priority_2:
    - "Create CLAUDE.md with contribution guidelines and testing expectations"
    - "Add pre-commit hooks for shellcheck and Python linting"
    - "Add Dependabot/Renovate for GitHub Actions version updates"
    - "Add error handling for network failures (registry access, curl)"
---

# Quality Analysis: rpm-lockfile-runner

## Executive Summary
- **Overall Score: 1.3/10**
- **Repository Type**: CLI/Automation Tool (Bash + Python)
- **Primary Languages**: Bash (125 LOC), Python (67 LOC) - 192 total LOC
- **Key Strengths**: Uses `set -euo pipefail`, validates repoids against Red Hat source of truth, multi-arch support (x86_64, s390x)
- **Critical Gaps**: Zero tests, no linting, no security scanning, no .gitignore, supply chain risk in CI
- **Agent Rules Status**: Missing - no CLAUDE.md, no .claude/ directory

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No tests exist - zero test files in the repository |
| Integration/E2E | 1/10 | Workflow runs tool end-to-end but has no assertions |
| **Build Integration** | **2/10** | **Builds external container but no PR-time validation** |
| Image Testing | 1/10 | Builds rpm-lockfile-prototype but no runtime validation |
| Coverage Tracking | 0/10 | No coverage tooling, thresholds, or reporting |
| CI/CD Automation | 3/10 | Basic workflow exists but lacks quality gates |
| Agent Rules | 0/10 | No agent rules or contribution guidance |

## Critical Gaps

### 1. Zero Test Coverage
- **Impact**: Script changes can silently break lockfile generation; regressions are undetectable
- **Severity**: HIGH
- **Effort**: 8-12 hours
- **Details**: Neither `runner.sh` nor `sanitize-ubi-repo.py` have any tests. The Python script has testable pure functions (regex manipulation, dedup logic, suffix addition) that are prime candidates for unit testing. The bash script's YAML transformation pipeline has no validation beyond the final repoid check.

### 2. No .gitignore File
- **Impact**: `*.tmp` files, intermediate artifacts, and generated lockfiles could be accidentally committed
- **Severity**: HIGH
- **Effort**: 0.5 hours
- **Details**: The script generates multiple `.tmp` files during execution. Without a `.gitignore`, these could be committed to the repository. The `trap "rm *.tmp" EXIT` in `runner.sh` provides runtime cleanup but not repository protection.

### 3. Supply Chain Risk - Unpinned GitHub Actions
- **Impact**: Upstream tag/branch hijack could inject arbitrary code into CI
- **Severity**: HIGH
- **Effort**: 0.5 hours
- **Details**: `actions-js/push@master` is pinned to a branch name instead of a commit SHA. If the upstream repository is compromised or the `master` branch is force-pushed, malicious code could execute with the repository's `GITHUB_TOKEN` permissions. `actions/checkout@v4` and `actions/setup-python@v4` are also pinned to tags rather than SHAs.

### 4. No Input Validation on config.yaml
- **Impact**: Malformed config produces incorrect lockfiles or fails with cryptic errors
- **Severity**: MEDIUM
- **Effort**: 4-6 hours
- **Details**: The script reads `config.yaml` directly with `yq` without validating schema, required fields, or value formats. Missing `arches`, invalid image URIs, or empty package lists would produce confusing failures deep in the pipeline.

### 5. No Linting or Static Analysis
- **Impact**: Shell scripting bugs and Python issues go undetected
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Details**: No shellcheck for `runner.sh`, no ruff/flake8/mypy for `sanitize-ubi-repo.py`. Common shell pitfalls (unquoted variables, word splitting) and Python issues (missing type hints, unused imports) are not caught.

## Quick Wins

### 1. Add .gitignore (15 minutes)
```gitignore
*.tmp
repository-to-cpe.tmp
rpms.in.yaml.*.tmp
rpms.lock.yaml.*.tmp
ubi.repo.*.tmp
```

### 2. Pin GitHub Actions to SHAs (15 minutes)
Replace branch/tag references with commit SHAs:
```yaml
- uses: actions/checkout@<sha>        # v4
- uses: actions/setup-python@<sha>    # v4
- uses: actions-js/push@<sha>         # master
```

### 3. Add Shellcheck Step (1 hour)
```yaml
- name: Lint shell scripts
  run: shellcheck src/runner.sh
```

### 4. Add Concurrency Control (15 minutes)
```yaml
concurrency:
  group: lockfile-${{ github.ref }}
  cancel-in-progress: true
```

### 5. Add Basic Python Tests (2-3 hours)
Create `tests/test_sanitize.py` with pytest tests for:
- Section dedup logic
- `-rpms` suffix addition
- Already-suffixed sections (idempotency)
- Empty file handling
- Malformed section headers

## Detailed Findings

### CI/CD Pipeline

**Workflow**: `rpm-lockfile-runner.yml` (single workflow)

| Aspect | Status | Notes |
|--------|--------|-------|
| PR triggers | Missing | Only triggers on `push` to any branch when `config.yaml` changes |
| Concurrency control | Missing | Concurrent runs on same branch could conflict |
| Caching | Missing | Container image rebuilt from scratch every run |
| Quality gates | Missing | No linting, testing, or validation steps |
| Manual dispatch | Present | `workflow_dispatch` available for re-runs |

**Observations**:
- The workflow auto-commits lockfile output back to the triggering branch via `actions-js/push@master`
- No separation between generation and validation steps
- Python 3.10.13 is pinned (good for reproducibility) but `actions/setup-python@v4` is not latest (`v5` is current)
- Dependencies installed via `apt-get` and `snap` without version pinning: `jq`, `skopeo`, `podman`, `yq`

### Test Coverage

| Test Type | Count | Framework | Notes |
|-----------|-------|-----------|-------|
| Unit tests | 0 | None | No test files exist |
| Integration tests | 0 | None | No test infrastructure |
| E2E tests | 0 | None | Workflow is a manual E2E but has no assertions |
| Coverage tracking | None | None | No coverage configuration |

**Test-to-Code Ratio**: 0:192 (0%)

**Testable Functions** (candidates for unit tests):
1. `sanitize-ubi-repo.py::sanitize_file()` - regex splitting, dedup, suffix logic
2. `runner.sh` - YAML transformation pipeline (harder to test, needs mocking)
3. Config validation - schema checking for `config.yaml`
4. Repoid validation logic - currently inline in runner.sh, could be extracted

### Code Quality

| Tool | Status | Notes |
|------|--------|-------|
| Shellcheck | Missing | No shell linting for runner.sh |
| Ruff/Flake8 | Missing | No Python linting |
| Mypy | Missing | No type checking |
| Pre-commit | Missing | No `.pre-commit-config.yaml` |
| EditorConfig | Missing | No `.editorconfig` |
| Formatters | Missing | No black/shfmt |

**Code Quality Observations**:
- `runner.sh` uses `set -euo pipefail` (good practice)
- Trap for cleanup: `trap "rm *.tmp" EXIT` (reasonable but fragile - fails if no .tmp files exist)
- Python script lacks type hints and has excessive debug printing
- No docstrings in Python code
- Shell script has hardcoded paths and magic strings

### Container Images

| Aspect | Status | Notes |
|--------|--------|-------|
| Dockerfile | Missing | No Dockerfile in this repo |
| Container build | External | Builds `rpm-lockfile-prototype` from upstream Containerfile |
| Multi-arch | Partial | Generates lockfiles for x86_64 and s390x, but container runs `--platform=linux/amd64` only |
| Image scanning | Missing | No Trivy, Snyk, or any vulnerability scanning |
| SBOM | Missing | No SBOM generation |
| Image signing | Missing | No sigstore/cosign |

### Security

| Practice | Status | Notes |
|----------|--------|-------|
| SAST/CodeQL | Missing | No static application security testing |
| Dependency scanning | Missing | No Dependabot/Renovate |
| Secret detection | Missing | No Gitleaks/TruffleHog |
| Action pinning | Weak | `actions-js/push@master` pinned to branch name |
| Token permissions | Default | Uses default `GITHUB_TOKEN` permissions (should be minimized) |
| Network trust | Weak | Curls raw Containerfile from upstream without checksum verification |

**Security Concerns**:
1. `curl ... | podman build` - fetches and builds untrusted content from `konflux-ci/rpm-lockfile-prototype` main branch without pinning
2. `actions-js/push@master` - supply chain risk from branch-pinned action
3. No `permissions:` block in workflow to limit `GITHUB_TOKEN` scope
4. Registry URL rewriting (`registry.redhat.io` → `registry.access.redhat.com`) is a functional workaround but could mask issues

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None - no `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Quality**: N/A
- **Gaps**: Everything - no contribution guidelines, no test creation rules, no code review guidance
- **Recommendation**: Generate basic agent rules with `/test-rules-generator` covering bash script testing patterns and Python unit test conventions

## Recommendations

### Priority 0 (Critical)

1. **Add unit tests for `sanitize-ubi-repo.py`** (4-6 hours)
   - Test regex splitting, dedup logic, suffix addition
   - Use pytest with parametrized test cases
   - Cover edge cases: empty files, single sections, already-suffixed sections

2. **Add integration test for lockfile generation** (4-6 hours)
   - Create a test config with known packages
   - Validate output `rpms.lock.yaml` schema and structure
   - Verify `ubi.repo` format correctness
   - Can run as a separate CI workflow

3. **Pin all GitHub Actions to commit SHAs** (30 minutes)
   - Replace `actions/checkout@v4` with SHA
   - Replace `actions/setup-python@v4` with SHA
   - Replace `actions-js/push@master` with SHA (critical)

4. **Add .gitignore** (15 minutes)
   - Exclude `*.tmp`, generated intermediate files

### Priority 1 (High Value)

1. **Add shellcheck linting** (1 hour)
   - Add shellcheck step to CI workflow
   - Fix any reported issues in `runner.sh`

2. **Add Python linting with ruff** (1 hour)
   - Add ruff configuration
   - Lint `sanitize-ubi-repo.py`
   - Add to CI workflow

3. **Add config.yaml schema validation** (3-4 hours)
   - Define JSON schema or use cerberus/pydantic
   - Validate before running the generator
   - Provide clear error messages for invalid configs

4. **Add workflow permissions block** (15 minutes)
   ```yaml
   permissions:
     contents: write  # needed for push
   ```

5. **Add concurrency control** (15 minutes)
   ```yaml
   concurrency:
     group: lockfile-${{ github.ref }}
     cancel-in-progress: true
   ```

### Priority 2 (Nice-to-Have)

1. **Create CLAUDE.md** with contribution guidelines
2. **Add Dependabot** for GitHub Actions version updates
3. **Add pre-commit hooks** with shellcheck and ruff
4. **Extract repoid validation** into a reusable function
5. **Add retry logic** for network operations (registry pulls, curl)
6. **Pin system dependencies** (`jq`, `skopeo`, `podman`, `yq`) to specific versions
7. **Add caching** for the `rpm-lockfile-prototype` container image build

## Comparison to Gold Standards

| Dimension | rpm-lockfile-runner | odh-dashboard | notebooks | Best Practice |
|-----------|-------------------|---------------|-----------|---------------|
| Unit Tests | None | Comprehensive Jest suite | Python unittest | pytest/bats for this type |
| Integration | None | Contract tests | Multi-layer validation | Schema validation tests |
| CI Quality Gates | None | Linting, type-check, coverage | Image validation | shellcheck + ruff |
| Coverage | 0% | ~80% with enforcement | Per-image coverage | Any threshold > 0% |
| Security Scanning | None | Dependabot, CodeQL | Trivy scanning | shellcheck + Gitleaks |
| Agent Rules | None | Comprehensive .claude/ | Test automation rules | Basic CLAUDE.md |
| Action Pinning | Branch name | Commit SHAs | Commit SHAs | Always pin to SHA |

## File Paths Reference

| File | Purpose |
|------|---------|
| `.github/workflows/rpm-lockfile-runner.yml` | Single CI/CD workflow |
| `src/runner.sh` | Main lockfile generation script (125 LOC) |
| `src/sanitize-ubi-repo.py` | UBI repo file sanitizer (67 LOC) |
| `config.yaml` | User configuration for lockfile generation |
| `rpms.lock.yaml` | Generated lockfile output |
| `ubi.repo` | Generated UBI repository configuration |
| `readme.md` | Project documentation |
