---
repository: "opendatahub-io/opendatahub-community"
overall_score: 2.5
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "N/A - Documentation-only repository with no source code"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "N/A - No executable code to test"
  - dimension: "Build Integration"
    score: 0.0
    status: "N/A - No build artifacts or container images"
  - dimension: "Image Testing"
    score: 0.0
    status: "N/A - No container images produced"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "N/A - No code coverage applicable"
  - dimension: "CI/CD Automation"
    score: 2.0
    status: "No CI/CD workflows; only GitHub issue templates exist"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, .claude/ directory, or agent rules present"
critical_gaps:
  - title: "No CI/CD workflows at all"
    impact: "No automated validation of YAML schemas, markdown linting, or link checking on PRs"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No markdown linting or link validation"
    impact: "Broken links, inconsistent formatting, and stale references go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "Stale governance data in sigs.yaml"
    impact: "SIG leadership uses placeholder names (ABC, XYZ) with placeholder URLs, undermining the governance directory's purpose"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No automated OWNERS file validation"
    impact: "OWNERS files could become stale without automated checks against org membership"
    severity: "MEDIUM"
    effort: "4-8 hours"
  - title: "No CODEOWNERS file for PR routing"
    impact: "PRs to SIG-specific directories are not automatically routed to SIG chairs"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "Contributing guide testing section is incomplete"
    impact: "Testing guidance has a TODO placeholder with no actual content"
    severity: "MEDIUM"
    effort: "2-4 hours"
quick_wins:
  - title: "Add markdownlint CI workflow"
    effort: "1-2 hours"
    impact: "Catch formatting inconsistencies and broken markdown on every PR"
  - title: "Add link-checker CI workflow"
    effort: "1-2 hours"
    impact: "Detect broken internal and external links automatically"
  - title: "Add CODEOWNERS file for automated PR routing"
    effort: "30 minutes"
    impact: "Ensure SIG chairs and WG leads are auto-requested for reviews on their directories"
  - title: "Populate sigs.yaml with real data"
    effort: "2-3 hours"
    impact: "Make the governance directory actually useful for community navigation"
recommendations:
  priority_0:
    - "Add CI workflows for markdown linting (markdownlint-cli2) and link checking (lychee or markdown-link-check)"
    - "Populate sigs.yaml with real SIG chair names, meeting URLs, and subproject OWNERS links"
    - "Complete the TODO section in contributing.md about testing guidelines"
  priority_1:
    - "Add CODEOWNERS file mapping SIG/WG directories to their respective chairs"
    - "Add YAML schema validation for sigs.yaml, membership.yaml, and issue templates"
    - "Create a PR template with checklist for governance document changes"
    - "Add DCO (Developer Certificate of Origin) sign-off check"
  priority_2:
    - "Add agent rules (CLAUDE.md) with guidelines for governance document contributions"
    - "Set up GitHub Pages or redirect to render governance docs as a browsable site"
    - "Add automated stale issue/PR management with actions/stale"
    - "Consider adding a SECURITY.md file for vulnerability reporting"
---

# Quality Analysis: opendatahub-community

## Executive Summary

- **Overall Score: 2.5/10**
- **Repository Type**: Community governance and documentation (no source code)
- **Primary Language**: Markdown (100% documentation)
- **Key Strengths**: Comprehensive feature development lifecycle documentation, well-structured governance model modeled after Kubernetes community, structured issue templates for bug reports and release tracking
- **Critical Gaps**: Zero CI/CD automation, no markdown/link validation, stale placeholder data in sigs.yaml, incomplete contributing guidelines
- **Agent Rules Status**: Missing

This repository serves as the **governance hub** for the Open Data Hub (ODH) project. It defines SIG structures, community membership requirements, contribution guidelines, and feature development lifecycle requirements (Dev Preview -> Tech Preview -> GA). It contains **no source code, no tests, no build files, and no CI/CD pipelines**.

While the standard quality dimensions (unit tests, E2E, image testing) are not applicable, the repository has significant quality gaps in **documentation validation, automation, and data freshness** that undermine its role as the authoritative governance reference.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | N/A - Documentation-only repository with no source code |
| Integration/E2E | 0/10 | N/A - No executable code to test |
| **Build Integration** | **0/10** | **N/A - No build artifacts or container images** |
| Image Testing | 0/10 | N/A - No container images produced |
| Coverage Tracking | 0/10 | N/A - No code coverage applicable |
| CI/CD Automation | 2/10 | No workflows; only GitHub issue templates provide structure |
| Agent Rules | 0/10 | No CLAUDE.md, .claude/ directory, or agent rules present |

**Note**: This is a governance/documentation repository. The standard code quality dimensions are structurally inapplicable. The overall score reflects documentation quality, automation, and governance completeness rather than code testing metrics.

## Critical Gaps

### 1. No CI/CD Workflows
- **Impact**: No automated validation occurs on any PR. Markdown formatting errors, broken links, YAML syntax issues, and inconsistent document structure can be merged without any checks.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The `.github/` directory contains only issue templates. There is no `.github/workflows/` directory at all. For a governance repository that defines standards for dozens of downstream repos, this sets a poor example.

### 2. Stale Placeholder Data in sigs.yaml
- **Impact**: The `sigs.yaml` file — intended as the canonical directory of SIG leadership, meeting schedules, and subproject ownership — contains placeholder values throughout: `github: abc`, `name: ABC`, `url: https://url.here`, `slack: slack-channel-here`. This renders the governance directory non-functional.
- **Severity**: HIGH
- **Effort**: 2-4 hours
- **Details**: Both `sig-ml-developer-experience` and `sig-platform` entries use identical placeholder templates. The file appears to have been created from a template but never populated with real data.

### 3. No Markdown Linting or Link Validation
- **Impact**: The repository has ~2,355 lines of markdown across 30+ files, with numerous external links to Google Docs, Jira, GitHub repos, and Red Hat Spaces. None of these links are validated — broken links to moved Jira issues or archived pages go undetected.
- **Severity**: HIGH
- **Effort**: 2-4 hours

### 4. Incomplete Contributing Guide
- **Impact**: The `contributing.md` file has a `TODO: Add information about how to submit tests and viewing results` placeholder in the Testing section. For a repository that defines community standards, an incomplete contributing guide undermines credibility.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours

### 5. No CODEOWNERS File
- **Impact**: PRs modifying SIG-specific directories (e.g., `sig-ml-ops/`) are not automatically routed to the SIG chairs or relevant reviewers. This slows down review and risks changes being merged without appropriate oversight.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours

### 6. No PR Template
- **Impact**: Contributors can open PRs without a structured description or checklist, leading to inconsistent PR quality for governance document changes.
- **Severity**: LOW
- **Effort**: 1 hour

## Quick Wins

### 1. Add Markdownlint CI Workflow (1-2 hours)
Catch formatting inconsistencies automatically on every PR.
```yaml
# .github/workflows/lint.yml
name: Lint Markdown
on: [pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: DavidAnson/markdownlint-cli2-action@v19
        with:
          globs: '**/*.md'
```

### 2. Add Link Checker CI Workflow (1-2 hours)
Detect broken internal and external links automatically.
```yaml
# .github/workflows/links.yml
name: Check Links
on:
  pull_request:
  schedule:
    - cron: '0 9 * * 1'  # Weekly on Monday
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: lycheeverse/lychee-action@v2
        with:
          args: '--verbose --no-progress **/*.md'
```

### 3. Add CODEOWNERS File (30 minutes)
Auto-assign reviewers based on directory ownership.
```
# CODEOWNERS
/sig-ml-developer-experience/ @sig-ml-dev-exp-chairs
/sig-ml-ops/                  @sig-ml-ops-chairs
/sig-platform/                @sig-platform-chairs
/proposal/                    @steering-committee
*.md                          @community-maintainers
```

### 4. Add YAML Validation (1 hour)
Validate schema for `sigs.yaml` and `membership.yaml`.
```yaml
# .github/workflows/validate-yaml.yml
name: Validate YAML
on: [pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          pip install yamllint
          yamllint sigs.yaml membership.yaml .github/ISSUE_TEMPLATE/*.yaml
```

## Detailed Findings

### CI/CD Pipeline

**Status: Non-existent**

There are **zero CI/CD workflows** in this repository. The `.github/` directory contains only:
- `.github/ISSUE_TEMPLATE/bug_report.yaml` — Structured bug report template with component dropdown (ODH Operator, Dashboard, Notebook Controller, etc.)
- `.github/ISSUE_TEMPLATE/release_tracker.yaml` — Release tracking template with component checklist and structured comment format for automation

The bug report template is well-structured with component selection dropdown, but the component list may need periodic updates as the ODH ecosystem evolves. The release tracker template shows some automation thinking with its structured comment format (`#Release#` markers), suggesting there may be external automation consuming this data.

**Missing workflows that should exist for a governance repo:**
- Markdown linting (markdownlint)
- Link checking (lychee, markdown-link-check)
- YAML validation (yamllint)
- DCO sign-off verification
- Spell checking
- Stale issue management

### Test Coverage

**Status: Not Applicable**

This repository contains no source code in any programming language. It is 100% markdown documentation, YAML configuration, and image assets. There are no test files, test frameworks, or testing infrastructure of any kind.

**File breakdown:**
- 30+ Markdown files (~2,355 lines total)
- 2 YAML configuration files (`sigs.yaml`, `membership.yaml`)
- 2 YAML issue templates
- 7 image files (PNG, JPG)
- 5 OWNERS files (Kubernetes-style ownership)

### Code Quality

**Status: No tooling configured**

- No `.pre-commit-config.yaml`
- No linting configuration for markdown or YAML
- No `.editorconfig` for consistent formatting
- No spell-check dictionary or configuration

**Documentation Quality Assessment:**
- `feature-development-requirements.md` (332 lines) is the standout document — comprehensive, well-structured with clear maturity levels, Jira template references, and detailed workflow steps
- `community-membership.md` (217 lines) is thorough and mirrors Kubernetes community membership patterns
- `governance.md` is well-organized with clear SIG/steering committee structure
- `contributing.md` has an incomplete testing section (TODO placeholder)
- `odh-repositories.md` clearly defines repository tiers (Associated, SIG, Core) with rules for each

### Container Images

**Status: Not Applicable**

No Dockerfiles, Containerfiles, or container-related configuration exists. This is expected for a governance repository.

### Security

**Status: Minimal**

- No `SECURITY.md` for vulnerability disclosure
- No CodeQL, Trivy, or other scanning (not applicable for docs-only repo)
- No secret detection configuration
- Code of Conduct is present (`CODE_OF_CONDUCT.md`)
- License is present (`LICENSE` — GNU GPL v3.0)

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: None — no CLAUDE.md, AGENTS.md, or `.claude/` directory
- **Quality**: N/A
- **Gaps**: Complete absence of agent rules. For a governance repo, agent rules could guide AI-assisted contributions to governance documents, proposal writing, and SIG charter updates.
- **Recommendation**: Create a CLAUDE.md with guidelines for:
  - Document formatting standards
  - SIG charter template usage
  - Proposal document structure
  - Links to referenced Jira templates and external docs

## Recommendations

### Priority 0 (Critical)

1. **Add CI workflows for markdown linting and link checking** — A governance repository that defines standards for 15+ downstream code repositories should itself have automated quality checks. Without them, broken links and formatting errors erode trust in the governance documentation.

2. **Populate sigs.yaml with real data** — The SIG directory is the primary discovery mechanism for new contributors. With placeholder values, it fails its core purpose. Update with actual GitHub handles, meeting URLs, Slack channels, and subproject OWNERS links.

3. **Complete the TODO in contributing.md testing section** — The contributing guide explicitly acknowledges a gap: `TODO: Add information about how to submit tests and viewing results`. This should reference the comprehensive `feature-development-requirements.md` for testing standards by feature level.

### Priority 1 (High Value)

1. **Add CODEOWNERS file** — Map SIG directories to their respective chairs for automatic PR review assignment.

2. **Add YAML schema validation** — Validate `sigs.yaml` and `membership.yaml` against schemas to prevent structural regressions.

3. **Create a PR template** — Add `.github/PULL_REQUEST_TEMPLATE.md` with a checklist for governance document changes (e.g., "Updated sigs.yaml if SIG ownership changed", "Verified all links work").

4. **Add DCO sign-off enforcement** — As a project under GPL v3.0 that accepts contributions, enforce Developer Certificate of Origin sign-off on commits.

5. **Add SECURITY.md** — Even for a docs-only repo, having a security policy (pointing to the main ODH security reporting channel) is good practice.

### Priority 2 (Nice-to-Have)

1. **Add agent rules (CLAUDE.md)** — Provide AI contribution guidelines for governance document editing, proposal formatting, and SIG charter structure.

2. **Set up GitHub Pages** — Render governance docs as a browsable site for easier community navigation.

3. **Add automated stale management** — Use `actions/stale` to manage old issues and PRs automatically.

4. **Add spell-checking CI** — Use cspell or similar to catch typos in governance documents.

5. **Consider migrating from `master` branch references** — The CODE_OF_CONDUCT.md still references `master` branch while the repo uses `main`.

## Comparison to Gold Standards

| Dimension | opendatahub-community | kubernetes/community (Gold Standard) | Gap |
|-----------|----------------------|--------------------------------------|-----|
| CI/CD Workflows | None | markdownlint, link-check, YAML validation, verify scripts | Critical |
| CODEOWNERS | Missing | Comprehensive per-SIG CODEOWNERS | High |
| SIG Directory | Placeholder data | Fully populated with real data, auto-generated | Critical |
| PR Templates | Missing | Structured templates for different change types | Medium |
| Bot Automation | Release tracker template only | Prow, sig-label-bot, triage-party | High |
| Documentation | Strong content, no validation | Strong content + automated validation | Medium |
| Issue Templates | 2 templates (bug, release) | Multiple templates (feature, bug, membership, etc.) | Low |
| Governance Docs | Comprehensive | Comprehensive | Parity |
| Feature Lifecycle | Excellent (Dev Preview -> TP -> GA) | Well-defined KEP process | Parity |

The kubernetes/community repository serves as the gold standard for governance repos. While opendatahub-community has strong *content* (especially the feature-development-requirements.md), it lacks the *automation and tooling* that makes governance documentation reliable and maintainable.

## File Paths Reference

### Governance
- `governance.md` — Top-level governance structure
- `sig-governance.md` — Detailed SIG operating mechanics
- `sig-charter-template.md` — Template for new SIG charters
- `sig-charter-guide.md` — Guide for creating SIG charters
- `community-membership.md` — Membership roles and requirements
- `feature-development-requirements.md` — Feature lifecycle standards (Dev Preview/TP/GA)

### SIG Directories
- `sig-ml-developer-experience/` — Charter, README, OWNERS
- `sig-ml-ops/` — Charter, README, OWNERS
- `sig-platform/` — Charter, README, OWNERS

### Working Group Directories
- `wg-distributed-workloads/`, `wg-model-registry/`, `wg-on-prem/`
- `wg-release-engineering/`, `wg-serving-integration/`, `wg-xai/`

### Configuration
- `sigs.yaml` — SIG directory (placeholder data)
- `membership.yaml` — Membership request template schema
- `.github/ISSUE_TEMPLATE/bug_report.yaml` — Bug report template
- `.github/ISSUE_TEMPLATE/release_tracker.yaml` — Release tracking template

### Contributing
- `contributing.md` — Contribution guidelines
- `contributor-cheatsheet.md` — Quick reference for contributors
- `GuidelinesForNewComponents.md` — New component submission process
- `odh-repositories.md` — Repository tier system and rules

### Proposals
- `proposal/kserve-serving.md`, `proposal/model-registry.md`, `proposal/distributed-workloads.md`
- `proposal/modelmesh-serving.md`, `proposal/pachyderm.md`, `proposal/release-engineering.md`, `proposal/xskipper.md`
