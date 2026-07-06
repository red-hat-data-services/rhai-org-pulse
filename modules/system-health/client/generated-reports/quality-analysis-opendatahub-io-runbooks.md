---
repository: "opendatahub-io/runbooks"
overall_score: 1.4
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No code or tests — documentation-only repository"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E testing infrastructure"
  - dimension: "Build Integration"
    score: 0.0
    status: "No build process — no Dockerfiles, Makefiles, or build scripts"
  - dimension: "Image Testing"
    score: 0.0
    status: "No container images built from this repository"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling — no code to measure"
  - dimension: "CI/CD Automation"
    score: 2.0
    status: "No CI/CD workflows — no .github/workflows/, Makefile, or CI config"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, .claude/, or agent rules present"
  - dimension: "Documentation Quality"
    score: 4.0
    status: "Template exists but only one component covered; no validation"
critical_gaps:
  - title: "No CI/CD pipeline for content validation"
    impact: "Runbook quality is entirely dependent on human review — broken links, invalid shell commands, and formatting errors go undetected"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Minimal component coverage — only Kueue"
    impact: "Most ODH components (KServe, Dashboard, Model Mesh, TrustyAI, CodeFlare, etc.) have no runbooks"
    severity: "HIGH"
    effort: "40+ hours"
  - title: "No automated linting or link validation"
    impact: "Markdown syntax errors, broken oc commands, and stale references accumulate silently"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No structured metadata in runbooks"
    impact: "Cannot programmatically index, search, or integrate runbooks into alerting systems"
    severity: "MEDIUM"
    effort: "4-8 hours"
quick_wins:
  - title: "Add markdownlint CI workflow"
    effort: "1-2 hours"
    impact: "Catches formatting issues, enforces consistent runbook structure"
  - title: "Add link checker GitHub Action"
    effort: "1 hour"
    impact: "Detects broken links and stale references automatically on PRs"
  - title: "Add CODEOWNERS file"
    effort: "30 minutes"
    impact: "Ensures correct reviewers are auto-assigned for new component runbooks"
  - title: "Add shellcheck validation for embedded scripts"
    effort: "2-3 hours"
    impact: "Validates that oc/kubectl commands in runbooks are syntactically correct"
recommendations:
  priority_0:
    - "Implement a basic CI workflow with markdownlint and link checking to prevent quality regressions"
    - "Create a content coverage plan to onboard runbooks for critical ODH components (KServe, Dashboard, Model Controller, TrustyAI)"
  priority_1:
    - "Add YAML frontmatter to runbooks for structured metadata (severity, component, alert name) enabling programmatic integration"
    - "Integrate runbook links into Prometheus AlertManager annotations so alerts link directly to remediation steps"
    - "Add a PR template enforcing the runbook template structure"
  priority_2:
    - "Create agent rules (.claude/rules/) for generating consistent runbooks"
    - "Add shellcheck or bats validation for embedded shell scripts"
    - "Add a table of contents / index page generated from frontmatter"
---

# Quality Analysis: opendatahub-io/runbooks

## Executive Summary

- **Overall Score: 1.4/10**
- **Repository Type**: Documentation-only (operational runbooks for ODH alert rules)
- **Primary Language**: Markdown
- **Key Strengths**: Well-structured runbook template, good remediation steps in existing Kueue runbooks
- **Critical Gaps**: No CI/CD, no content validation, covers only 1 of 15+ ODH components
- **Agent Rules Status**: Missing

The `runbooks` repository is an early-stage documentation project providing operational runbooks for Open Data Hub alert rules. It currently contains **4 runbooks for the Kueue component only**, with a single contributor and 1 merged PR. While the existing content is well-written with clear remediation steps, the repository lacks any automated quality controls, CI/CD pipelines, or validation tooling. The most pressing concern is not code quality (there is no code) but **content coverage and content validation infrastructure**.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No code or tests — documentation-only repository |
| Integration/E2E | 0/10 | No integration or E2E testing infrastructure |
| Build Integration | 0/10 | No build process — no Dockerfiles, Makefiles, or build scripts |
| Image Testing | 0/10 | No container images built from this repository |
| Coverage Tracking | 0/10 | No coverage tooling — no code to measure |
| CI/CD Automation | 2/10 | No CI/CD workflows; OWNERS files provide basic review gating |
| Agent Rules | 0/10 | No CLAUDE.md, .claude/, or agent rules present |
| **Documentation Quality** | **4/10** | **Template exists but only 1 component covered** |

## Critical Gaps

### 1. No CI/CD Pipeline for Content Validation
- **Impact**: Runbook quality is entirely dependent on human review — broken links, invalid shell commands, and formatting errors go undetected
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The repository has zero GitHub Actions workflows. There is no `.github/workflows/` directory, no Makefile, and no CI configuration of any kind. Every PR is reviewed purely by human judgment with no automated checks.

### 2. Minimal Component Coverage — Only Kueue
- **Impact**: Most ODH components have no runbooks, leaving operators without remediation guidance when alerts fire
- **Severity**: HIGH
- **Effort**: 40+ hours (ongoing)
- **Details**: The repository contains runbooks for only 1 component (Kueue) with 4 alert runbooks. Major ODH components without runbooks include:
  - KServe / Model Controller
  - ODH Dashboard
  - Model Mesh
  - TrustyAI
  - CodeFlare / MCAD
  - Data Science Pipelines
  - Notebooks / Workbenches
  - ODH Operator itself
  - Ray / Training Operator

### 3. No Automated Linting or Link Validation
- **Impact**: Markdown syntax errors, broken `oc` commands, and stale references accumulate silently
- **Severity**: MEDIUM
- **Effort**: 2-3 hours

### 4. No Structured Metadata in Runbooks
- **Impact**: Cannot programmatically index, search, or integrate runbooks into alerting systems (e.g., linking from AlertManager annotations)
- **Severity**: MEDIUM
- **Effort**: 4-8 hours
- **Details**: Runbooks use freeform markdown headers for severity/impact/summary. YAML frontmatter would enable:
  - Automated alert-to-runbook linking
  - Severity-based filtering
  - Component inventory generation
  - Staleness detection

## Quick Wins

### 1. Add markdownlint CI Workflow (1-2 hours)
Enforce consistent formatting across all runbooks.

```yaml
# .github/workflows/lint.yml
name: Lint Markdown
on: [pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: DavidAnson/markdownlint-cli2-action@v16
        with:
          globs: '**/*.md'
```

### 2. Add Link Checker (1 hour)
Detect broken links automatically.

```yaml
# .github/workflows/links.yml
name: Check Links
on:
  pull_request:
  schedule:
    - cron: '0 9 * * 1'
jobs:
  links:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: lycheeverse/lychee-action@v1
        with:
          args: --verbose '**/*.md'
```

### 3. Add CODEOWNERS File (30 minutes)
```
# .github/CODEOWNERS
* @opendatahub-io/runbooks-maintainers
/alerts/kueue/ @astefanutti @kpostoffice @sutaakar
```

### 4. Add ShellCheck Validation for Embedded Scripts (2-3 hours)
Extract and validate shell commands embedded in runbooks to catch syntax errors.

## Detailed Findings

### CI/CD Pipeline
- **Workflows**: None (no `.github/workflows/` directory)
- **Build automation**: None (no Makefile, no scripts)
- **PR checks**: Only OWNERS-based review assignment via Prow/GitHub
- **Periodic jobs**: None
- **Branch protection**: Unknown (no CI to gate on)

### Test Coverage
Not applicable — this is a documentation-only repository with no executable code. However, the embedded shell scripts (`oc` commands) in runbooks could benefit from syntax validation.

### Code Quality
- **Linting**: None — no markdownlint, no prose linting (vale, textlint)
- **Pre-commit hooks**: None
- **Static analysis**: None
- **Formatters**: None

### Container Images
Not applicable — no container images are built from this repository.

### Security
- **Secret detection**: None
- **SAST**: None
- No sensitive data in runbooks (commands reference cluster resources by generic names)

### Agent Rules (Agentic Flow Quality)
- **Status**: Missing
- **Coverage**: No rules exist for any test type or content generation
- **Quality**: N/A
- **Gaps**: No `.claude/` directory, no `CLAUDE.md`, no `AGENTS.md`
- **Recommendation**: Create agent rules for runbook authoring to ensure consistency:
  - Template compliance checking
  - Severity classification guidelines
  - Required sections validation
  - Shell command formatting standards

### Documentation Quality
- **Template**: A `template.md` exists with the correct structure (Severity, Impact, Summary, Steps)
- **Existing runbooks**: 4 Kueue runbooks, all well-written with:
  - Clear severity classification
  - Actionable `oc` commands with copy-pasteable scripts
  - Escalation steps
  - Variable placeholders for user customization
- **OWNERS files**: Present at root and component level
- **README**: Brief but adequate orientation
- **Gaps**:
  - No contribution guide beyond README
  - No PR template enforcing runbook structure
  - No table of contents or index
  - Template lacks YAML frontmatter guidance

## Repository Statistics

| Metric | Value |
|--------|-------|
| Total files | 8 (excluding .git) |
| Runbook files | 4 |
| Components covered | 1 (Kueue) |
| Contributors | 1 |
| Merged PRs | 1 |
| CI workflows | 0 |
| Test files | 0 |
| Lines of markdown | ~250 |

## Recommendations

### Priority 0 (Critical)
1. **Implement a basic CI workflow** with markdownlint and link checking to prevent quality regressions. This is the single highest-impact improvement.
2. **Create a content coverage roadmap** to onboard runbooks for critical ODH components — start with KServe, Dashboard, and ODH Operator as they generate the most operational incidents.

### Priority 1 (High Value)
1. **Add YAML frontmatter to runbooks** for structured metadata:
   ```yaml
   ---
   alert: KueuePodDown
   component: kueue
   severity: critical
   namespace: redhat-ods-applications
   last_verified: 2024-12-01
   ---
   ```
2. **Integrate runbook URLs into AlertManager annotations** so operators get direct links when alerts fire.
3. **Add a PR template** enforcing the runbook template structure with a checklist.
4. **Add a `CONTRIBUTING.md`** with detailed onboarding instructions for component teams.

### Priority 2 (Nice-to-Have)
1. **Create agent rules** (`.claude/rules/runbook-authoring.md`) for generating consistent runbooks via AI assistants.
2. **Add shellcheck validation** for embedded shell scripts to catch syntax issues.
3. **Generate an index page** from frontmatter showing all components, alert severities, and coverage gaps.
4. **Add prose linting** (vale or textlint) to enforce consistent writing style.
5. **Set up a scheduled staleness check** — flag runbooks not updated in 6+ months for re-verification.

## Comparison to Gold Standards

| Dimension | runbooks | odh-dashboard | notebooks | kserve |
|-----------|----------|---------------|-----------|--------|
| CI/CD Automation | None | Comprehensive (20+ workflows) | Multi-layer | Extensive |
| Content Validation | None | ESLint, TypeScript strict | Linting + testing | golangci-lint |
| Coverage Tracking | None | Codecov enforced | Image coverage | Codecov |
| Template/Standards | Basic template | Comprehensive patterns | Image standards | CRD patterns |
| Review Process | OWNERS only | OWNERS + CI gates | OWNERS + CI gates | OWNERS + CI gates |
| Agent Rules | None | Comprehensive | None | None |

**Key Takeaway**: While `runbooks` is a documentation repo (not a code repo), it can still benefit enormously from the same CI discipline applied to code repositories — automated linting, link checking, template enforcement, and structured metadata.

## File Paths Reference

| File | Purpose |
|------|---------|
| `README.md` | Repository overview and onboarding |
| `template.md` | Runbook authoring template |
| `OWNERS` | Root-level reviewer/approver list |
| `alerts/kueue/OWNERS` | Kueue component reviewer/approver list |
| `alerts/kueue/kueue-pod-down.md` | Critical: Kueue controller pod not ready |
| `alerts/kueue/low-cluster-queue-resource-usage.md` | Info: Under-utilized cluster queue resources |
| `alerts/kueue/pending-workload-pods.md` | Info: Pods pending for 3+ days |
| `alerts/kueue/resource-reservation-exceeds-quota.md` | Info: Resource reservation exceeds 10x quota |
