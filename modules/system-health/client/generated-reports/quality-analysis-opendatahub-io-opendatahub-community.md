---
repository: "opendatahub-io/opendatahub-community"
overall_score: 2.8
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "N/A — no source code; pure governance/documentation repository"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "N/A — no source code to test"
  - dimension: "Build Integration"
    score: 0.0
    status: "N/A — no build artifacts produced"
  - dimension: "Image Testing"
    score: 0.0
    status: "N/A — no container images"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "N/A — no code coverage applicable"
  - dimension: "CI/CD Automation"
    score: 2.0
    status: "Issue templates exist but no CI workflows for linting, link checking, or YAML validation"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
  - dimension: "Documentation Quality"
    score: 8.0
    status: "Comprehensive governance, onboarding, feature-dev requirements, and community membership docs"
  - dimension: "Process Maturity"
    score: 7.0
    status: "Well-defined SIG structure, feature lifecycle, and component onboarding with Jira templates"
critical_gaps:
  - title: "No CI/CD workflows at all"
    impact: "Broken links, stale references, YAML syntax errors, and formatting issues go undetected"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No automated link checking"
    impact: "Dead URLs accumulate in governance docs read by the entire ODH community"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No YAML validation for sigs.yaml and membership.yaml"
    impact: "Schema drift or typos in structured governance data go unnoticed"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "Placeholder data still present in sigs.yaml"
    impact: "SIG leadership contacts show 'abc' and 'XYZ' instead of real names; meeting URLs show 'https://url.here'"
    severity: "HIGH"
    effort: "1 hour"
  - title: "No PR review automation"
    impact: "No CODEOWNERS, no auto-labeling, no required reviewers for governance changes"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add markdownlint workflow"
    effort: "1 hour"
    impact: "Catch formatting inconsistencies across all governance docs automatically"
  - title: "Add link checker workflow (lychee or markdown-link-check)"
    effort: "1-2 hours"
    impact: "Prevent dead links in community-facing documentation"
  - title: "Add CODEOWNERS file"
    effort: "30 minutes"
    impact: "Auto-assign reviewers for governance doc changes, prevent unreviewed modifications"
  - title: "Fix placeholder data in sigs.yaml"
    effort: "1 hour"
    impact: "Make SIG directory actually useful for community members seeking contacts"
  - title: "Add YAML schema validation workflow"
    effort: "2 hours"
    impact: "Prevent malformed membership or SIG config from merging"
recommendations:
  priority_0:
    - "Add CI workflows for markdown linting, link checking, and YAML validation"
    - "Fix placeholder/template data in sigs.yaml (leadership names, meeting URLs, slack channels)"
  priority_1:
    - "Add CODEOWNERS file mapping governance docs to steering committee members"
    - "Add PR template for governance change proposals"
    - "Create a spell-check CI job for community-facing documentation"
  priority_2:
    - "Add agent rules (CLAUDE.md) for documentation contribution patterns"
    - "Automate stale-issue/stale-PR labeling and cleanup"
    - "Add a table-of-contents generator for longer docs"
---

# Quality Analysis: opendatahub-community

## Executive Summary

- **Overall Score: 2.8/10** (weighted by standard software dimensions)
- **Repository Type**: Pure governance/documentation — no source code, no builds, no tests
- **Primary Language**: Markdown (2,355 lines across 31 files) + YAML (2 structured config files)
- **Key Strength**: Comprehensive governance documentation with well-defined feature maturity lifecycle (Dev Preview → Tech Preview → GA), detailed community membership ladder, and structured component onboarding process with Jira templates
- **Critical Gap**: Zero CI/CD automation — no workflows exist to lint markdown, validate YAML, check links, or enforce any quality gate on PRs
- **Agent Rules Status**: Missing — no CLAUDE.md, AGENTS.md, or .claude/ directory

### Important Context

This repository is the **community governance hub** for the entire Open Data Hub project. It defines policies and processes that affect all ODH/RHOAI component repos. The standard code-quality dimensions (unit tests, image testing, coverage) are not applicable. The relevant quality dimensions are **documentation quality**, **process maturity**, and **CI/CD automation for documentation**.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | N/A — no source code |
| Integration/E2E | 0/10 | N/A — no source code |
| **Build Integration** | **0/10** | **N/A — no build artifacts** |
| Image Testing | 0/10 | N/A — no container images |
| Coverage Tracking | 0/10 | N/A — no code coverage applicable |
| CI/CD Automation | 2/10 | Issue templates exist but no CI workflows whatsoever |
| Agent Rules | 0/10 | No CLAUDE.md, AGENTS.md, or .claude/ directory |
| **Documentation Quality** | **8/10** | **Comprehensive governance, onboarding, and feature lifecycle docs** |
| **Process Maturity** | **7/10** | **Well-defined SIG structure, Jira templates, component onboarding** |

## Critical Gaps

### 1. No CI/CD Workflows (Severity: HIGH)

The `.github/workflows/` directory does not exist. This means:

- **No markdown linting** — formatting inconsistencies, broken headers, and style violations go unchecked
- **No link checking** — dead URLs in governance docs accumulate silently (multiple external links to Google Docs, Jira, Slack, Red Hat internal pages)
- **No YAML validation** — `sigs.yaml` and `membership.yaml` have no schema enforcement
- **No spell checking** — typos in community-facing governance documents persist
- **No PR checks** — any change merges without automated validation

**Impact**: This is the governance hub for 14+ component repositories. Broken links or stale information misdirect contributors across the entire ODH ecosystem.

**Effort**: 2-4 hours to set up basic linting, link-checking, and YAML validation workflows.

### 2. Placeholder Data in sigs.yaml (Severity: HIGH)

The `sigs.yaml` file contains template/placeholder data that was never filled in:
- SIG leadership: `github: abc`, `name: ABC`, `github: XYZ`, `name: XYZ`
- Meeting URLs: `https://url.here`
- Mailing lists: `https://url.here`
- Slack channels: `slack-channel-here`
- Mission statements: `Mission statement goes here.`

**Impact**: Community members looking for SIG contacts, meeting links, or mission context get useless placeholder text. This undermines the purpose of having a structured SIG directory.

**Effort**: 1 hour — fill in actual data or remove placeholder entries.

### 3. No CODEOWNERS File (Severity: MEDIUM)

No `CODEOWNERS` or equivalent exists. Governance documents that affect the entire project can be modified without requiring review from steering committee members or SIG chairs.

**Impact**: Critical policy changes (membership requirements, feature maturity standards) could merge without appropriate oversight.

**Effort**: 30 minutes.

### 4. No PR Review Automation (Severity: MEDIUM)

- No auto-labeling (e.g., `kind/governance`, `sig/*`)
- No required reviewers
- No PR templates for governance changes
- No stale-issue bot

**Impact**: Governance PRs lack structure; contributors don't know what reviewers expect.

**Effort**: 2-3 hours.

### 5. Testing Documentation is Incomplete (Severity: MEDIUM)

The `contributing.md` Testing section says:
> *TODO: Add information about how to submit tests and viewing results*

This TODO has apparently been present since the file was created. For a governance repo that defines testing requirements across the ODH ecosystem, this is a significant gap.

**Effort**: 2-4 hours to document cross-project testing standards.

## Quick Wins

### 1. Add Markdown Linting Workflow (1 hour)
```yaml
# .github/workflows/lint-markdown.yml
name: Lint Markdown
on: [pull_request]
jobs:
  markdownlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: DavidAnson/markdownlint-cli2-action@v19
        with:
          globs: '**/*.md'
```

### 2. Add Link Checker Workflow (1-2 hours)
```yaml
# .github/workflows/check-links.yml
name: Check Links
on:
  pull_request:
  schedule:
    - cron: '0 9 * * 1'  # Weekly on Monday
jobs:
  links:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: lycheeverse/lychee-action@v2
        with:
          args: --verbose --no-progress '**/*.md'
          fail: true
```

### 3. Add CODEOWNERS (30 minutes)
```
# .github/CODEOWNERS
# Steering committee reviews all governance changes
*.md @shgriffi @LaVLaS @jkoehler-redhat
sigs.yaml @shgriffi @LaVLaS @jkoehler-redhat
membership.yaml @shgriffi @LaVLaS @jkoehler-redhat
```

### 4. Fix sigs.yaml Placeholder Data (1 hour)

Replace all placeholder entries (`abc`, `XYZ`, `url.here`, `slack-channel-here`, `Mission statement goes here`) with actual SIG data or remove unfilled entries.

### 5. Add YAML Validation Workflow (2 hours)
```yaml
# .github/workflows/validate-yaml.yml
name: Validate YAML
on: [pull_request]
jobs:
  yaml-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ibiqlik/action-yamllint@v3
        with:
          file_or_dir: '*.yaml'
          strict: true
```

## Detailed Findings

### CI/CD Pipeline

**Status**: Effectively absent.

- **Workflows**: None. The `.github/workflows/` directory does not exist.
- **Issue Templates**: 2 issue templates exist (bug report, release tracker) — these are well-structured YAML-based templates with dropdowns, checkboxes, and validation.
  - `bug_report.yaml` — covers ODH component selection, current/expected behavior, reproduction steps, version info
  - `release_tracker.yaml` — structured release tracking with component checklist and comment-based automation format
- **No PR Template**: No `.github/pull_request_template.md` exists.
- **No Auto-labeling**: No labeler configuration.
- **No Stale Bot**: No stale issue/PR automation.

### Test Coverage

**Not applicable** — this is a documentation-only repository. No source code exists.

However, the `feature-development-requirements.md` document defines comprehensive testing requirements for component repos:
- Unit Tests
- Functional Tests
- Integration Tests
- Regression Tests
- End-to-End Tests
- Disconnected environment testing
- Multi-architecture support validation
- Security architecture review

This is a strength — the governance repo defines the testing bar even though it doesn't contain tests itself.

### Code Quality

**Not applicable** for code linting. No linting tools are configured for the documentation content:

- No markdownlint configuration (`.markdownlint.yaml` / `.markdownlint-cli2.yaml`)
- No spell checker (`cspell`, `typos`)
- No YAML linter (`yamllint`)
- No pre-commit hooks

### Container Images

**Not applicable** — no Dockerfiles, Containerfiles, or build configurations.

### Security

- No CodeQL (no code to scan)
- No secret detection (no `.gitleaks.toml`)
- No dependency scanning (no dependencies)

However, the `feature-development-requirements.md` defines security requirements for component repos:
- Security architecture review with ProdSec
- Konflux integration
- FIPS compliance ("Designed for FIPS")
- Snyk scanning
- CVE SLA management
- Threat modeling with SDElement

### Agent Rules (Agentic Flow Quality)

- **Status**: Missing
- **Coverage**: No agent rules exist at all
- **Quality**: N/A
- **Gaps**: No CLAUDE.md, AGENTS.md, or `.claude/` directory
- **Recommendation**: Create a `CLAUDE.md` with documentation contribution patterns, governance change procedures, and style guidelines. Use `/test-rules-generator` for any future code additions.

### Documentation Quality (Bonus Dimension)

This is where the repository excels:

**Strengths:**
- **Feature Development Requirements** (`feature-development-requirements.md`) — exceptionally detailed 332-line document covering Dev Preview → Tech Preview → GA lifecycle with Jira template references, security requirements, packaging requirements, and acceptance criteria
- **Community Membership** (`community-membership.md`) — clear role ladder (Member → Reviewer → Approver → Subproject Owner) with specific requirements and responsibilities
- **Contributing Guide** (`contributing.md`) — PR workflow, code review expectations, best practices
- **Repository Guidelines** (`odh-repositories.md`) — tiered repo system (Associated → SIG → Core) with rules for creation and removal
- **Component Guidelines** (`GuidelinesForNewComponents.md`) — proposal-to-PR process for new components
- **Governance** (`governance.md`) — SIG structure, steering committee, cross-project coordination
- **7 Proposals** — detailed architecture proposals for components (kserve, distributed workloads, model registry, etc.)

**Weaknesses:**
- `sigs.yaml` full of placeholder data
- Testing section in `contributing.md` has a TODO
- No table of contents in longer documents
- Some inconsistency in document structure (some docs have clear headers, others less organized)
- `feature-development-requirements.md` references internal Red Hat tools/docs (Jira templates, Google Docs, Confluence) that may not be accessible to community contributors

### Process Maturity (Bonus Dimension)

**Strengths:**
- Structured component onboarding with Jira templates (Dev Preview: RHOAIENG-31244, Tech Preview: RHOAIENG-31290, GA: RHOAIENG-31303)
- Clear maturity progression: Dev Preview → Tech Preview → GA → Obsolete/Deprecated
- SIG-based organization with charters, leadership roles, and subprojects
- Working Group (WG) structure for cross-cutting concerns (6 WGs defined)
- Deprecation process defined with grounds for removal
- Release tracker issue template with structured comment format for automation

**Weaknesses:**
- SIG directory (`sigs.yaml`) contains only placeholder data — the process exists but the data doesn't
- No evidence of automated enforcement of any governance processes
- No metrics or health checks on SIG activity

## Recommendations

### Priority 0 (Critical)
1. **Add CI/CD workflows** — markdownlint, link checker, YAML validation. Zero automation for a repo that defines standards for 14+ component repos is a significant risk.
2. **Fix sigs.yaml placeholder data** — replace `abc`, `XYZ`, `url.here` with real contacts or remove the entries. The file currently provides zero useful information.
3. **Complete the TODO in contributing.md** — the testing section says "TODO: Add information about how to submit tests and viewing results."

### Priority 1 (High Value)
4. **Add CODEOWNERS** — governance docs affecting the entire ODH ecosystem should require steering committee review.
5. **Add PR template** — standardize governance change proposals with required fields (scope, impact, stakeholders notified).
6. **Add spell-check CI** — community-facing documentation should be error-free.
7. **Add auto-labeling** — label PRs by SIG, WG, or doc type for easier triage.

### Priority 2 (Nice-to-Have)
8. **Create CLAUDE.md** — agent rules for documentation contribution patterns, style guidelines, and governance change procedures.
9. **Add stale-bot** — auto-close inactive issues/PRs with reminders.
10. **Add table-of-contents generation** — for longer docs like `feature-development-requirements.md` (already has one manually maintained).
11. **Add a doc-site generator** — consider publishing governance docs via GitHub Pages (Jekyll/Hugo) for better discoverability.

## Comparison to Gold Standards

| Dimension | opendatahub-community | kubernetes/community (Gold Standard) |
|-----------|----------------------|--------------------------------------|
| CI/CD for docs | None | markdownlint, link check, spell check, YAML validation |
| CODEOWNERS | Missing | Comprehensive, per-SIG ownership |
| SIG directory | Placeholder data | Real contacts, meeting links, Slack channels |
| PR templates | Missing | Structured templates for KEPs, SIG changes |
| Issue templates | 2 (good quality) | Comprehensive set with auto-labeling |
| Governance docs | Strong content, no enforcement | Strong content with automated enforcement |
| Proposals | 7 proposals (good) | KEP process with structured lifecycle |
| Stale management | None | Stale bot with labeled exemptions |
| Agent rules | None | N/A (not yet common) |

## File Paths Reference

| File | Purpose |
|------|---------|
| `README.md` | Project overview and entry point |
| `governance.md` | SIG structure and steering committee |
| `community-membership.md` | Role ladder and requirements |
| `contributing.md` | PR and review workflow |
| `feature-development-requirements.md` | Dev Preview/TP/GA lifecycle requirements |
| `GuidelinesForNewComponents.md` | Component proposal process |
| `odh-repositories.md` | Repository tiers and management |
| `sigs.yaml` | SIG directory (placeholder data) |
| `membership.yaml` | Membership request template |
| `sig-governance.md` | SIG operating mechanics |
| `sig-charter-template.md` | Template for new SIG charters |
| `.github/ISSUE_TEMPLATE/bug_report.yaml` | Bug report template |
| `.github/ISSUE_TEMPLATE/release_tracker.yaml` | Release tracking template |
| `proposal/*.md` | Component proposals (7 files) |
| `sig-*/` | SIG directories with charters and OWNERS |
| `wg-*/` | Working group directories |
