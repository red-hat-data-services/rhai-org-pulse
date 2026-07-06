---
repository: "opendatahub-io/architecture-decision-records"
overall_score: 3.4
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "N/A - Documentation-only repository with no source code"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "N/A - No executable code to test"
  - dimension: "Build Integration"
    score: 0.0
    status: "N/A - No build artifacts produced"
  - dimension: "Image Testing"
    score: 0.0
    status: "N/A - No container images"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "N/A - No code coverage applicable"
  - dimension: "CI/CD Automation"
    score: 2.0
    status: "Only a stale-bot workflow; no link checking, linting, or template validation"
  - dimension: "Agent Rules"
    score: 5.0
    status: "Basic ADR creation skill exists but no validation or review rules"
  - dimension: "Documentation Governance"
    score: 4.0
    status: "Template exists but inconsistent adherence; duplicate ADR numbers; broken links"
  - dimension: "Content Quality"
    score: 5.0
    status: "Active repo with 38 ADRs; good template but uneven compliance"
  - dimension: "Contributor Experience"
    score: 3.0
    status: "CODEOWNERS present but no PR template, CONTRIBUTING guide, or issue templates"
critical_gaps:
  - title: "No CI/CD validation for documentation quality"
    impact: "Broken links, formatting issues, and template non-compliance go undetected until manual review"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "Duplicate ADR numbers in operator directory"
    impact: "Three pairs of duplicated numbers (0007, 0009, 0011) create confusion and violate the ADR numbering contract"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No PR template or contributor guide"
    impact: "New contributors have no guidance on ADR submission process, review expectations, or quality standards"
    severity: "MEDIUM"
    effort: "2-3 hours"
  - title: "Broken internal links in arch-overview.md"
    impact: "20+ broken image references in the main architecture overview document"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "Inconsistent ADR template adherence"
    impact: "Some ADRs missing required sections (Alternatives, Stakeholder Impacts); one uses bold headings instead of ## sections"
    severity: "MEDIUM"
    effort: "4-8 hours"
quick_wins:
  - title: "Add markdown linting CI workflow"
    effort: "1-2 hours"
    impact: "Automated detection of formatting issues, broken links, and style inconsistencies"
  - title: "Add PR template for ADR submissions"
    effort: "30 minutes"
    impact: "Standardized PR process with checklist for required sections, reviewer assignment, and status"
  - title: "Fix duplicate ADR numbers"
    effort: "1-2 hours"
    impact: "Resolve three pairs of duplicated operator ADR numbers to restore numbering integrity"
  - title: "Add internal link checker workflow"
    effort: "1-2 hours"
    impact: "Catch broken links before merge, especially for image references"
recommendations:
  priority_0:
    - "Add CI workflow for markdown linting (markdownlint) and link validation to catch quality issues pre-merge"
    - "Fix the three pairs of duplicate ADR numbers in the operator directory (0007, 0009, 0011)"
  priority_1:
    - "Create CONTRIBUTING.md with ADR submission guidelines, review process, and template checklist"
    - "Add a PR template with ADR quality checklist (required sections, numbering, status field)"
    - "Create an ADR validation skill that checks template compliance and numbering conflicts"
    - "Fix the 20+ broken image links in documentation/arch-overview.md"
  priority_2:
    - "Add issue templates for proposing new ADRs"
    - "Add an ADR status dashboard or index page with filtering by status and component"
    - "Create a CI check that validates ADR YAML metadata tables for consistency"
    - "Add spell-checking and writing style linting (vale) to CI"
---

# Quality Analysis: architecture-decision-records

## Executive Summary

- **Overall Score: 3.4/10** (adjusted for documentation-only repository)
- **Repository Type**: Documentation-only (Architecture Decision Records + architecture docs)
- **Primary Language**: Markdown (60 .md files, ~9,400 lines)
- **Activity**: Very active — 254 commits in 2025, 382 total, 50+ contributors
- **Agent Rules Status**: Partial — one ADR creation skill exists, but no validation or review rules

This repository stores Architecture Decision Records (ADRs) and architecture documentation for Open Data Hub / OpenShift AI. As a documentation-only repo with no source code, traditional software quality dimensions (unit tests, integration tests, container images, coverage) do not apply. The scoring focuses on **documentation governance**, **CI/CD for docs**, **content quality**, and **contributor experience**.

**Key Strengths:**
- Well-defined ADR template with clear structure
- Active community with 50+ contributors and regular updates
- CODEOWNERS file with component-level ownership
- Existing Claude Code skill for ADR creation

**Critical Gaps:**
- No CI/CD validation (only a stale-bot workflow)
- Duplicate ADR numbers (3 pairs in operator directory)
- 20+ broken internal links in the main architecture document
- No PR template, CONTRIBUTING guide, or issue templates
- Inconsistent template adherence across ADRs

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | N/A | Documentation-only repository |
| Integration/E2E | N/A | No executable code |
| Build Integration | N/A | No build artifacts |
| Image Testing | N/A | No container images |
| Coverage Tracking | N/A | No code coverage applicable |
| CI/CD Automation | 2/10 | Only stale-bot; no linting, link checking, or validation |
| Agent Rules | 5/10 | ADR creation skill exists; no validation or review rules |
| **Documentation Governance** | **4/10** | **Template exists but inconsistent compliance** |
| **Content Quality** | **5/10** | **38 ADRs, good depth but uneven quality** |
| **Contributor Experience** | **3/10** | **CODEOWNERS only; no PR template or contributor guide** |

> **Note**: Standard software quality dimensions (Unit Tests through Coverage Tracking) are scored N/A because this is a pure documentation repository. The overall score reflects the documentation-specific dimensions.

## Critical Gaps

### 1. No CI/CD Validation for Documentation Quality
- **Impact**: Broken links, formatting issues, template non-compliance, and numbering conflicts go undetected until manual review
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The only workflow is `.github/workflows/stale.yml` which marks stale PRs. There is no:
  - Markdown linting (markdownlint, remark-lint)
  - Internal/external link checking
  - Template compliance validation
  - Spell checking
  - ADR numbering conflict detection

### 2. Duplicate ADR Numbers in Operator Directory
- **Impact**: Three pairs of duplicated numbers violate the ADR contract ("Numbers will not be reused")
- **Severity**: HIGH
- **Effort**: 1-2 hours
- **Duplicates found**:
  - `ODH-ADR-Operator-0007-auth-crd.md` + `ODH-ADR-Operator-0007-components-version-mapping.md`
  - `ODH-ADR-Operator-0009-connection-api.md` + `ODH-ADR-Operator-0009-observability-tracing-strategy.md`
  - `ODH-ADR-Operator-0011-observability-metrics-autoscaling.md` + `ODH-ADR-Operator-0011-Perses-dashboard-guidelines.md`

### 3. No PR Template or Contributor Guide
- **Impact**: New contributors have no guidance on the ADR submission process, review expectations, or quality standards
- **Severity**: MEDIUM
- **Effort**: 2-3 hours
- **Missing artifacts**:
  - No `CONTRIBUTING.md`
  - No `.github/PULL_REQUEST_TEMPLATE.md`
  - No `.github/ISSUE_TEMPLATE/` directory

### 4. Broken Internal Links in Architecture Overview
- **Impact**: The main architecture document (`documentation/arch-overview.md`) has 20+ broken image references
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Root cause**: URL-encoded paths (`%20`) don't resolve correctly as relative file paths. Images with spaces in filenames exist but the markdown references use mixed encoding.

### 5. Inconsistent Template Adherence
- **Impact**: Readers cannot rely on a consistent structure across ADRs; some miss critical sections
- **Severity**: MEDIUM
- **Effort**: 4-8 hours (retroactive fix across all ADRs)
- **Examples**:
  - `ODH-ADR-DSP-0001`: Missing Alternatives and Stakeholder Impacts sections
  - `ODH-ADR-EH-0003`: Uses `## **Bold**` headings instead of standard `##` (breaks automated parsing)
  - `ODH-ADR-0001-automl` and `ODH-ADR-0001-autorag`: Missing Stakeholder Impacts section
  - Multiple ADRs use inconsistent Status values: Draft, Proposed, Accepted, Approved, Review, TBD, Refinement completed

## Quick Wins

### 1. Add Markdown Linting CI Workflow
- **Effort**: 1-2 hours
- **Impact**: Automated detection of formatting issues and style inconsistencies
- **Implementation**:
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

### 2. Add Internal Link Checker
- **Effort**: 1-2 hours
- **Impact**: Catch broken links before merge
- **Implementation**:
```yaml
# .github/workflows/links.yml
name: Check Links
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: lycheeverse/lychee-action@v2
        with:
          args: --no-progress --exclude-mail '**/*.md'
```

### 3. Add PR Template
- **Effort**: 30 minutes
- **Impact**: Standardized PR process with quality checklist
- **Implementation**:
```markdown
<!-- .github/PULL_REQUEST_TEMPLATE.md -->
## ADR Checklist
- [ ] ADR number is unique (no conflicts with existing ADRs)
- [ ] All required sections present: What, Why, Goals, Non-Goals, How, Alternatives, Stakeholder Impacts, Reviews
- [ ] Metadata table is complete (Date, Scope, Status, Authors)
- [ ] Status is set to "Approved" (will be approved upon merge)
- [ ] Internal links are valid
- [ ] Component CODEOWNERS are added as reviewers
```

### 4. Fix Duplicate ADR Numbers
- **Effort**: 1-2 hours
- **Impact**: Restore ADR numbering integrity
- **Action**: Renumber the later-created ADR in each duplicate pair to the next available number (0013, 0014, 0015 for operator)

## Detailed Findings

### CI/CD Pipeline

**Workflows Found**: 1
| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `stale.yml` | `schedule` (daily 03:00 UTC) + `workflow_dispatch` | Mark stale PRs after 21 days, close after 28 |

**Missing CI/CD**:
- No markdown linting
- No link validation
- No template compliance checks
- No ADR numbering conflict detection
- No spell checking
- No image reference validation

### Test Coverage

Not applicable — this is a documentation-only repository with no source code.

### Code Quality

**Markdown Consistency Issues**:
- One ADR uses `## **Bold**` headings instead of `##` (EH-0003)
- Files with spaces in names (13 image files in `documentation/images/`)
- Inconsistent metadata table formatting across ADRs
- ADR statuses are not standardized — found: Draft, Proposed, Accepted, Approved, Review, TBD, "Refinement completed. TP in 3.4"

**CODEOWNERS**: Well-structured with component-level ownership covering 11 component teams under `@opendatahub-io/architects`.

### Container Images

Not applicable — no container images in this repository.

### Security

- **No SECURITY.md**: No vulnerability reporting process documented
- No secret scanning configuration
- No signed commits requirement
- Repository is public — appropriate for architecture documentation

### Agent Rules (Agentic Flow Quality)

**Status**: Partial
- **`.claude/` directory**: Present
- **`.claude/skills/odh-adr-create/SKILL.md`**: Comprehensive ADR creation skill with:
  - Automatic numbering detection across global and component-scoped ADRs
  - Template-adherent draft generation
  - Interview-based workflow
  - Component abbreviation table
  - Iterative refinement support
- **Missing**:
  - No ADR review/validation skill
  - No `.claude/rules/` directory for documentation standards
  - No quality gate rules for template compliance checking
  - No automated numbering conflict detection rule

**Assessment**: The existing `odh-adr-create` skill is well-crafted and comprehensive. The gap is on the validation side — there's no skill or rule for reviewing ADRs against template compliance, checking numbering, or validating links.

## ADR Content Analysis

### Coverage by Component
| Component | ADR Count | Latest Activity |
|-----------|-----------|----------------|
| Operator | 15 | Active (12 ADRs) |
| Eval Hub | 4 | Very active |
| Model Serving | 3 | Active |
| MLflow | 2 | Recent |
| Global (root) | 6 | Mixed |
| Others (7 components) | 8 | 1 each |

### Template Compliance Summary
| Required Section | Present | Missing |
|-----------------|---------|---------|
| What | 37/38 (97%) | 1 (bold formatting issue) |
| Why | 37/38 (97%) | 1 |
| Goals | 36/38 (95%) | 2 |
| How | 37/38 (97%) | 1 |
| Alternatives | 31/38 (82%) | 7 |
| Stakeholder Impacts | 29/38 (76%) | 9 |
| Reviews | 36/38 (95%) | 2 |

### Status Distribution
| Status | Count |
|--------|-------|
| Approved/Accepted | 12 |
| Draft | 12 |
| Proposed | 4 |
| Review | 2 |
| Other (TBD, Refinement) | 2 |

## Recommendations

### Priority 0 (Critical)
1. **Add CI workflow for markdown linting and link validation** — Catch quality issues pre-merge. Use markdownlint + lychee.
2. **Fix the three pairs of duplicate ADR numbers** in the operator directory (0007, 0009, 0011) to restore numbering integrity.
3. **Fix broken image links** in `documentation/arch-overview.md` — 20+ broken references.

### Priority 1 (High Value)
1. **Create `CONTRIBUTING.md`** with ADR submission guidelines, review process, and template compliance checklist.
2. **Add a PR template** with ADR quality checklist (required sections, numbering, status field).
3. **Create an ADR validation agent skill** that checks template compliance, numbering conflicts, and link validity.
4. **Standardize ADR status values** to a defined set: Draft, Proposed, Approved, Superseded.

### Priority 2 (Nice-to-Have)
1. **Add issue templates** for proposing new ADRs.
2. **Create an ADR index/dashboard** page with filtering by status and component.
3. **Add spell checking and writing style linting** (vale) to CI.
4. **Add a CI check for ADR numbering** that prevents duplicate numbers.
5. **Rename image files** to remove spaces (use kebab-case).

## Comparison to Gold Standards

| Feature | architecture-decision-records | odh-dashboard | notebooks | Gold Standard |
|---------|------------------------------|--------------|-----------|---------------|
| CI Workflows | 1 (stale only) | 15+ | 10+ | 5+ for docs repos |
| Markdown Linting | None | ESLint | N/A | markdownlint + vale |
| Link Checking | None | Automated | N/A | lychee or markdown-link-check |
| Template Validation | None | N/A | N/A | Custom CI check |
| PR Template | None | Yes | Yes | Yes |
| CONTRIBUTING Guide | None | Yes | Yes | Yes |
| CODEOWNERS | Yes (comprehensive) | Yes | Yes | Yes |
| Agent Rules | 1 skill (creation) | Comprehensive | None | Creation + validation + review |
| Issue Templates | None | Yes | Yes | Yes |

## File Paths Reference

| File | Purpose |
|------|---------|
| `.github/workflows/stale.yml` | Stale PR/issue management |
| `.github/CODEOWNERS` | Component-level ownership |
| `architecture-decision-records/ODH-ADR-0000-template.md` | ADR template |
| `architecture-decision-records/README.md` | ADR governance rules |
| `.claude/skills/odh-adr-create/SKILL.md` | Claude Code ADR creation skill |
| `documentation/arch-overview.md` | Main architecture overview (with broken links) |
| `README.md` | Repository root README |
