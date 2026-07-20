---
repository: "opendatahub-io/.github"
overall_score: 0.2
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "Not applicable — no source code in this org-level meta-repository"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "Not applicable — no source code or testable components"
  - dimension: "Build Integration"
    score: 0.0
    status: "Not applicable — no build artifacts or container images"
  - dimension: "Image Testing"
    score: 0.0
    status: "Not applicable — no Dockerfiles or container images"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "Not applicable — no code to measure coverage against"
  - dimension: "CI/CD Automation"
    score: 1.0
    status: "PR and issue templates present but no CI/CD workflows to validate them"
  - dimension: "Static Analysis"
    score: 0.0
    status: "No YAML or markdown linting configured for the templates"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No CI/CD workflows to validate templates"
    impact: "Broken YAML in issue templates or malformed markdown in PR template could go undetected until users file issues"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "No YAML schema validation for issue templates"
    impact: "Invalid YAML form fields may cause GitHub to silently fall back to blank issue, degrading contributor experience"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "Bug report template has stale OpenShift version options"
    impact: "Version dropdown lists 'OpenStack', 'OKD', 'CodeReady Containers' — none are OCP version numbers; contributors cannot specify their actual version"
    severity: "HIGH"
    effort: "1 hour"
quick_wins:
  - title: "Update bug report template OpenShift version dropdown"
    effort: "30 minutes"
    impact: "Fix misleading version selector so contributors can accurately report their environment"
  - title: "Add a GitHub Actions workflow to lint YAML and markdown"
    effort: "1-2 hours"
    impact: "Catch template syntax errors before they reach production"
  - title: "Add CLAUDE.md with contribution guidelines for AI-assisted edits"
    effort: "1 hour"
    impact: "Guide AI agents making changes to org-level templates"
recommendations:
  priority_0:
    - "Fix the bug report template: the 'OpenShift Version' dropdown does not list actual OCP versions — it conflates platforms (OpenStack, OKD, CRC) with versions"
    - "Add a CI workflow to validate YAML schema of issue templates on every PR"
  priority_1:
    - "Add markdown linting (markdownlint) to validate PR template formatting"
    - "Add a CODEOWNERS file to ensure template changes are reviewed by the right team"
    - "Consider adding a CONTRIBUTING.md at the org level"
  priority_2:
    - "Add CLAUDE.md with guidelines for maintaining org-level templates"
    - "Add a SECURITY.md or security policy for the organization"
    - "Consider adding default labels configuration (.github/labels.yml with a label sync action)"
---

# Quality Analysis: opendatahub-io/.github

## Executive Summary

- **Overall Score: 0.2/10**
- **Repository Type**: GitHub organization-level meta-repository (community health files)
- **Jira Component**: Build and Release (RHOAIENG)
- **Tier**: Midstream
- **Key Strengths**: Provides org-wide PR template and structured issue templates using YAML forms
- **Critical Gaps**: No CI/CD workflows, no static analysis, stale template content
- **Agent Rules Status**: Missing

**Important Context**: This is a `.github` special repository that provides default community health files (issue templates, PR template, org profile) for the entire `opendatahub-io` GitHub organization. It contains **no source code**, so most quality dimensions (unit tests, integration tests, build integration, image testing, coverage) are structurally not applicable. The score reflects this — it is not a commentary on engineering quality but rather on the limited scope of this repository.

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 0.0/10 | N/A — no source code |
| Integration/E2E | 20% | 0.0/10 | N/A — no testable components |
| Build Integration | 15% | 0.0/10 | N/A — no build artifacts |
| Image Testing | 10% | 0.0/10 | N/A — no container images |
| Coverage Tracking | 10% | 0.0/10 | N/A — no code to cover |
| CI/CD Automation | 15% | 1.0/10 | Templates exist but no workflows |
| Static Analysis | 10% | 0.0/10 | No linting configured |
| Agent Rules | 5% | 0.0/10 | No agent rules present |

**Weighted Overall: 0.2/10**

## Repository Contents

This repository contains exactly 4 non-license files:

| File | Purpose |
|------|---------|
| `PULL_REQUEST_TEMPLATE.md` | Default PR template for all org repos |
| `ISSUE_TEMPLATE/bug_report.yaml` | Structured bug report form |
| `ISSUE_TEMPLATE/feature_request.yaml` | Structured feature request form |
| `profile/README.md` | Organization profile page on GitHub |

## Critical Gaps

### 1. Bug Report Template Has Stale/Misleading Version Dropdown
- **Severity**: HIGH
- **Impact**: The "OpenShift Version" dropdown lists platforms (`OpenStack`, `OKD`, `CodeReady Containers`, `Other`) rather than actual OCP version numbers. Contributors cannot accurately specify which OCP version they're running. "CodeReady Containers" was renamed to "Red Hat OpenShift Local" in 2022.
- **Effort**: 30 minutes
- **File**: `ISSUE_TEMPLATE/bug_report.yaml:48-58`

### 2. No CI/CD Workflows
- **Severity**: MEDIUM
- **Impact**: No automated validation of YAML template syntax or markdown formatting. A broken issue template could silently fail, causing GitHub to fall back to a blank issue form.
- **Effort**: 2-3 hours

### 3. No YAML Schema Validation
- **Severity**: MEDIUM
- **Impact**: Issue templates use GitHub's YAML form schema, but there's no validation that the templates conform to the schema. Invalid fields or missing required attributes could break the issue creation flow.
- **Effort**: 1-2 hours

## Quick Wins

### 1. Fix the OpenShift Version Dropdown (30 minutes)
Update `ISSUE_TEMPLATE/bug_report.yaml` to list actual OCP versions or use a free-text input:

```yaml
- type: input
  id: openshift-version
  attributes:
    label: OpenShift Version
    description: What version of OpenShift are you running? (e.g., 4.14, 4.15, 4.16)
    placeholder: "e.g., 4.16.3"
  validations:
    required: true
```

### 2. Add YAML/Markdown Linting Workflow (1-2 hours)

Create `.github/workflows/lint.yml`:

```yaml
name: Lint Templates
on:
  pull_request:
    paths:
      - '**.md'
      - '**.yaml'
      - '**.yml'

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Lint YAML
        uses: ibiqlik/action-yamllint@v3
        with:
          file_or_dir: .
      - name: Lint Markdown
        uses: DavidAnson/markdownlint-cli2-action@v19
```

### 3. Add CLAUDE.md (1 hour)
Add basic agent rules to guide AI-assisted contributions to org-level templates.

## Detailed Findings

### Unit Tests
**Score: 0.0/10 — Not Applicable**

This repository contains no source code. There are no programming language files, no test files, and no test frameworks. This dimension is structurally not applicable for an org-level meta-repository.

### Integration/E2E Tests
**Score: 0.0/10 — Not Applicable**

No testable components exist. The repository contains only YAML and Markdown files serving as GitHub templates. No integration or E2E testing infrastructure is present or needed.

### Build Integration
**Score: 0.0/10 — Not Applicable**

No build system exists. There are no Makefiles, Dockerfiles, Containerfiles, or build scripts. The repository produces no build artifacts.

### Image Testing
**Score: 0.0/10 — Not Applicable**

No container images are built from this repository. No Dockerfiles or Containerfiles are present.

### Coverage Tracking
**Score: 0.0/10 — Not Applicable**

No source code exists to measure coverage against. No `.codecov.yml` or coverage configuration is present.

### CI/CD Automation
**Score: 1.0/10**

**What exists:**
- `PULL_REQUEST_TEMPLATE.md` — provides a default PR template with a testing checklist for the entire org. This is a positive contribution to org-wide quality process.
- `ISSUE_TEMPLATE/bug_report.yaml` — structured bug report form with environment fields (OpenShift version, infrastructure, browser)
- `ISSUE_TEMPLATE/feature_request.yaml` — structured feature request form

**What's missing:**
- No `.github/workflows/` directory — zero CI/CD workflows
- No automated validation of template syntax
- No markdown or YAML linting
- No PR checks of any kind

**PR Template Analysis:**
The PR template enforces three merge criteria:
1. Squashed commits with meaningful messages
2. Testing instructions in PR body
3. Manual developer testing verification

This is a solid minimal checklist, but it's entirely manual — no automated enforcement.

**Issue Template Analysis:**
- Bug report uses YAML forms (modern GitHub feature) with structured fields
- Feature request is well-structured with description, problem context, alternatives, and additional context
- Bug report has a stale OpenShift version dropdown (lists platforms, not versions)

### Static Analysis

**Score: 0.0/10**

#### Linting
No linting configuration exists for any file type. Given this repo contains only YAML and Markdown, relevant linters would be:
- `yamllint` for YAML validation
- `markdownlint` for Markdown formatting
- GitHub issue template schema validation

#### FIPS Compatibility
Not applicable — no source code or cryptographic operations.

#### Dependency Alerts
No `.github/dependabot.yml` or `renovate.json` present. Not strictly needed since there are no code dependencies, but Dependabot could track GitHub Actions versions if workflows were added.

### Agent Rules

**Score: 0.0/10**

- **Status**: Missing
- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **Coverage**: No test type rules (no tests exist)
- **Quality**: N/A
- **Gaps**: Complete absence of agent rules
- **Recommendation**: Add a basic `CLAUDE.md` explaining this repo's purpose (org-level templates) and guidelines for modifying templates (e.g., test YAML forms locally, update version dropdowns, maintain consistency across templates)

## Recommendations

### Priority 0 (Critical)

1. **Fix the bug report template's OpenShift version dropdown** — The dropdown conflates platforms with versions and uses outdated terminology ("CodeReady Containers" → "Red Hat OpenShift Local"). Replace with a free-text input or update options to current OCP versions.

2. **Add a CI workflow to validate YAML and Markdown** — Even minimal linting would catch syntax errors in templates before they affect the entire org's issue/PR workflow.

### Priority 1 (High Value)

3. **Add a CODEOWNERS file** — Ensure template changes are reviewed by the Build and Release team or community governance leads.

4. **Add a CONTRIBUTING.md** — Provide org-level contribution guidelines that all repos inherit by default.

5. **Add markdown linting** — Validate PR template formatting consistency.

### Priority 2 (Nice-to-Have)

6. **Add CLAUDE.md** — Guide AI agents on how to properly maintain org-level templates.

7. **Add a SECURITY.md** — Provide org-level security reporting guidelines.

8. **Add default labels configuration** — Use a label sync action to standardize labels across the org.

9. **Consider adding a FUNDING.yml** — If the project accepts sponsorship or has funding links.

## Comparison to Gold Standards

| Feature | .github (This Repo) | odh-dashboard | notebooks | Best Practice |
|---------|---------------------|---------------|-----------|---------------|
| PR Template | Basic checklist | Comprehensive with automated checks | Present | Automated enforcement |
| Issue Templates | YAML forms (2 templates) | Multiple specialized templates | Present | Schema-validated YAML forms |
| CI/CD Workflows | None | 20+ workflows | 10+ workflows | At minimum lint/validate |
| Static Analysis | None | ESLint, TypeScript strict | Linting present | YAML + Markdown linting |
| Agent Rules | None | CLAUDE.md + .claude/rules/ | None | CLAUDE.md with guidelines |
| CODEOWNERS | None | Present | Present | Required for shared repos |

## File Paths Reference

| File | Purpose | Issues Found |
|------|---------|-------------|
| `PULL_REQUEST_TEMPLATE.md` | Default org-wide PR template | Manual-only checklist, no automated enforcement |
| `ISSUE_TEMPLATE/bug_report.yaml` | Bug report form | Stale OpenShift version dropdown, outdated platform names |
| `ISSUE_TEMPLATE/feature_request.yaml` | Feature request form | Well-structured, no issues found |
| `profile/README.md` | Org profile page | Adequate, links to community resources |
| `LICENSE` | Apache 2.0 license | No issues |
