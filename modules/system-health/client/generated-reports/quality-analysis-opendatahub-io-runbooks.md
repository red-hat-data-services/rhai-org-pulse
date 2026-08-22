---
repository: "opendatahub-io/runbooks"
overall_score: 0.1
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "N/A — documentation-only repository with no source code"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "N/A — no code or services to integration-test"
  - dimension: "Build Integration"
    score: 0.0
    status: "N/A — no build artifacts; purely Markdown content"
  - dimension: "Image Testing"
    score: 0.0
    status: "N/A — no container images produced"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "N/A — no code to measure coverage against"
  - dimension: "CI/CD Automation"
    score: 0.0
    status: "No CI/CD workflows exist — no markdown linting, link checking, or spell checking"
  - dimension: "Static Analysis"
    score: 1.0
    status: "OWNERS files provide review governance but no automated linting or link validation"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No CI/CD workflows at all"
    impact: "Broken links, formatting errors, and inconsistencies are only caught by human review"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No markdown linting or link validation"
    impact: "Runbook quality degrades silently as content grows; dead links can mislead operators during incidents"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "Only one component (Kueue) has runbooks"
    impact: "Most RHOAI alerts have no documented response procedures"
    severity: "HIGH"
    effort: "Ongoing — team-by-team contribution"
  - title: "No spell checking or prose linting"
    impact: "Inconsistent language and typos erode trust in operational documentation"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add a GitHub Actions workflow for markdownlint + link checking"
    effort: "2-3 hours"
    impact: "Catches broken formatting and dead links on every PR automatically"
  - title: "Add .github/dependabot.yml for GitHub Actions version pinning"
    effort: "30 minutes"
    impact: "Keeps future CI workflow dependencies up to date"
  - title: "Add a CLAUDE.md with runbook authoring guidelines"
    effort: "1-2 hours"
    impact: "Enables AI-assisted runbook creation that follows the template standard"
  - title: "Add a CODEOWNERS file to auto-assign reviewers per component"
    effort: "1 hour"
    impact: "Ensures the right team reviews runbooks for their alerts"
recommendations:
  priority_0:
    - "Create a CI workflow with markdownlint, markdown-link-check, and optional spell checking to catch errors before merge"
    - "Expand runbook coverage beyond Kueue — prioritize components with critical alerts (operator, dashboard, model serving)"
  priority_1:
    - "Add a CLAUDE.md or AGENTS.md with runbook authoring rules referencing the existing template.md structure"
    - "Add pre-commit hooks for local markdown linting before push"
  priority_2:
    - "Consider adding a runbook index/table of contents (auto-generated from file structure)"
    - "Add Vale prose linting for consistent terminology across runbooks"
---

# Quality Analysis: opendatahub-io/runbooks

## Executive Summary

- **Overall Score: 0.1/10**
- **Repository Type**: Documentation-only (Markdown runbooks for RHOAI alert rules)
- **Primary Language**: Markdown
- **Jira**: RHOAIENG / Internal Processes & Documentation (midstream tier)
- **Key Strengths**: Well-structured template, clear runbook format with severity/impact/summary/steps, OWNERS-based review governance
- **Critical Gaps**: Zero CI/CD automation, no markdown linting or link validation, runbooks exist for only one component (Kueue)
- **Agent Rules Status**: Missing

## Important Context

This is a **pure documentation repository** — it contains no source code, no builds, no container images, and no tests. Five of the eight quality dimensions (Unit Tests, Integration/E2E, Build Integration, Image Testing, Coverage Tracking) are structurally inapplicable. The remaining three (CI/CD Automation, Static Analysis, Agent Rules) are fully applicable and all score very low. The overall score reflects the absence of quality tooling infrastructure, not the quality of the runbook content itself (which follows a consistent template).

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 0.0/10 | 15% | N/A — documentation-only repository |
| Integration/E2E | 0.0/10 | 20% | N/A — no code or services |
| Build Integration | 0.0/10 | 15% | N/A — no build artifacts |
| Image Testing | 0.0/10 | 10% | N/A — no container images |
| Coverage Tracking | 0.0/10 | 10% | N/A — no code |
| CI/CD Automation | 0.0/10 | 15% | No workflows exist |
| Static Analysis | 1.0/10 | 10% | OWNERS files only; no linting |
| Agent Rules | 0.0/10 | 5% | No agent rules |
| **Overall** | **0.1/10** | **100%** | **Critical infrastructure gaps** |

## Critical Gaps

### 1. No CI/CD Workflows (Severity: HIGH)
- **Impact**: Broken links, formatting errors, and template violations are only caught by manual human review
- **Current state**: The `.github/workflows/` directory does not exist
- **Effort**: 2-4 hours to add markdownlint + link checking workflow
- **What to add**: A PR-triggered workflow that runs `markdownlint` and `markdown-link-check` on all `.md` files

### 2. No Markdown Linting or Link Validation (Severity: HIGH)
- **Impact**: As the repository grows, formatting inconsistencies and dead links will accumulate; during an incident, a dead link in a runbook can cost critical minutes
- **Current state**: No `.markdownlint.json`, no `markdown-link-check` config, no markdownlint CI step
- **Effort**: 2-3 hours

### 3. Only One Component Has Runbooks (Severity: HIGH)
- **Impact**: RHOAI has dozens of components (operator, dashboard, model serving, pipelines, notebooks, etc.) but only Kueue has runbooks here
- **Current state**: 4 runbooks in `alerts/kueue/`, zero for all other components
- **Effort**: Ongoing — requires team-by-team contribution following the onboarding process in README

### 4. No Spell Checking or Prose Linting (Severity: MEDIUM)
- **Impact**: Inconsistent terminology, typos, and unclear instructions can slow down incident response
- **Effort**: 1-2 hours to add Vale or cspell

## Quick Wins

### 1. Add a markdownlint + link-check CI workflow (2-3 hours)
```yaml
# .github/workflows/lint.yml
name: Lint Markdown
on:
  pull_request:
    paths: ['**/*.md']

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: DavidAnson/markdownlint-cli2-action@v19
      - uses: gaurav-nelson/github-action-markdown-link-check@v1
        with:
          use-quiet-mode: 'yes'
```

### 2. Add Dependabot for GitHub Actions (30 minutes)
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

### 3. Add a CLAUDE.md with runbook authoring rules (1-2 hours)
Create a `CLAUDE.md` referencing the existing `template.md` structure, specifying:
- Follow the template: Severity, Impact, Summary, Steps
- Use `oc` commands (not `kubectl`) for OpenShift context
- Include both diagnostic and remediation steps
- Always include an escalation step as the final action

### 4. Add CODEOWNERS (1 hour)
```
# .github/CODEOWNERS
# Default reviewers
* @opendatahub-io/runbooks-reviewers

# Component-specific owners
/alerts/kueue/ @astefanutti @kpostoffice @sutaakar
```

## Detailed Findings

### Unit Tests
**Score: 0.0/10** — Not applicable. This repository contains only Markdown documentation files. There is no source code in any programming language.

### Integration/E2E Tests
**Score: 0.0/10** — Not applicable. No services, APIs, or integrations to test.

### Build Integration
**Score: 0.0/10** — Not applicable. No build artifacts are produced.

### Image Testing
**Score: 0.0/10** — Not applicable. No Dockerfiles or container images.

### Coverage Tracking
**Score: 0.0/10** — Not applicable. No code to measure coverage against.

### CI/CD Automation
**Score: 0.0/10**

- **Workflows**: None. The `.github/workflows/` directory does not exist
- **PR checks**: No automated checks run on pull requests
- **Periodic jobs**: None
- **What should exist for a docs repo**:
  - Markdown linting (markdownlint) on PRs
  - Link validation (markdown-link-check) on PRs
  - Optional: spell checking, prose linting (Vale)
  - Optional: template compliance check (verify new runbooks follow `template.md` structure)

### Static Analysis
**Score: 1.0/10**

**What exists**:
- `OWNERS` file at root with approvers and reviewers (Prow-style governance)
- `alerts/kueue/OWNERS` with component-specific ownership
- `template.md` provides a standard structure for runbooks

**What's missing**:
- No `.markdownlint.json` or `.markdownlint.yaml` configuration
- No `.vale.ini` or Vale style rules for prose linting
- No `.pre-commit-config.yaml` for local pre-commit hooks
- No `.github/dependabot.yml` (will be needed once CI workflows are added)
- No Renovate configuration

#### FIPS Compatibility
Not applicable — no source code or cryptographic operations.

#### Dependency Alerts
Not configured — no `.github/dependabot.yml` or `renovate.json`. Once CI workflows are added, Dependabot should be enabled for `github-actions` ecosystem.

### Agent Rules
**Score: 0.0/10**

- **CLAUDE.md**: Not present
- **AGENTS.md**: Not present
- **.claude/ directory**: Not present
- **Impact**: AI agents cannot effectively contribute runbooks matching the repository's conventions
- **Recommendation**: Create a `CLAUDE.md` that documents:
  - The runbook template structure (from `template.md`)
  - Required sections: Severity, Impact, Summary, Steps
  - Style guide: use `oc` commands, include escalation step, provide copy-pasteable bash blocks
  - File naming: `alerts/<component>/<alert-name>.md`
  - OWNERS file requirements for new components

## Repository Content Summary

| Item | Details |
|------|---------|
| Total runbooks | 4 (all Kueue) |
| Components covered | 1 (Kueue) |
| Template | Yes (`template.md` with standard structure) |
| OWNERS governance | Yes (root + per-component) |
| License | Apache 2.0 |
| Total commits | 1 (initial contribution) |

### Runbooks Inventory

| Runbook | Severity | Component |
|---------|----------|-----------|
| `kueue-pod-down.md` | Critical | Kueue |
| `low-cluster-queue-resource-usage.md` | Info | Kueue |
| `pending-workload-pods.md` | Info | Kueue |
| `resource-reservation-exceeds-quota.md` | Info | Kueue |

## Recommendations

### Priority 0 (Critical)
1. **Create a CI workflow for markdown linting and link checking** — this is the single highest-impact improvement; catches broken formatting and dead links automatically on every PR
2. **Expand runbook coverage to more components** — prioritize components with critical production alerts (opendatahub-operator, odh-dashboard, model serving, data science pipelines)

### Priority 1 (High Value)
1. **Add a CLAUDE.md with runbook authoring rules** — enables AI-assisted runbook creation following the template standard; reference the existing `template.md` structure
2. **Add pre-commit hooks for markdown linting** — catches issues before push with `.pre-commit-config.yaml` using `markdownlint`
3. **Add `.github/CODEOWNERS`** — auto-assigns reviewers per component directory

### Priority 2 (Nice-to-Have)
1. **Add Vale prose linting** — enforces consistent terminology (e.g., "RHOAI" vs "Red Hat OpenShift AI") and catches unclear language
2. **Auto-generate a runbook index** — a CI step or pre-commit hook that maintains a table of contents in README
3. **Add a runbook template compliance check** — a simple CI script that verifies new `.md` files under `alerts/` contain the required sections (Severity, Impact, Summary, Steps)

## Comparison to Gold Standards

| Practice | odh-dashboard | notebooks | runbooks |
|----------|--------------|-----------|----------|
| CI/CD Workflows | Comprehensive multi-workflow | Multi-layer | None |
| Linting | ESLint + TypeScript strict | Python linting | None |
| Markdown Linting | Yes | N/A | None |
| Link Checking | Yes | N/A | None |
| Pre-commit Hooks | Yes | N/A | None |
| Dependabot/Renovate | Yes | Yes | None |
| CLAUDE.md / Agent Rules | Yes (comprehensive) | Partial | None |
| OWNERS/CODEOWNERS | Yes | Yes | Yes (Prow-style) |
| Template/Standards | Yes | Yes | Yes (`template.md`) |

## File Paths Reference

| File | Purpose |
|------|---------|
| `README.md` | Repository overview and onboarding guide |
| `template.md` | Standard runbook template (Severity, Impact, Summary, Steps) |
| `OWNERS` | Root-level Prow approvers/reviewers |
| `alerts/kueue/OWNERS` | Kueue component ownership |
| `alerts/kueue/*.md` | 4 Kueue alert runbooks |
| `LICENSE` | Apache 2.0 |
