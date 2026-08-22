---
repository: "opendatahub-io/architecture-decision-records"
overall_score: 1.2
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "Not applicable — documentation-only repository with no source code"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "Not applicable — no source code or deployable components"
  - dimension: "Build Integration"
    score: 0.0
    status: "Not applicable — no builds, images, or manifests"
  - dimension: "Image Testing"
    score: 0.0
    status: "Not applicable — no container images"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "Not applicable — no code to measure coverage on"
  - dimension: "CI/CD Automation"
    score: 2.0
    status: "Only a stale-bot workflow; no markdown linting, link checking, or PR validation"
  - dimension: "Static Analysis"
    score: 1.5
    status: "CODEOWNERS present; no markdown linting, spell checking, or pre-commit hooks"
  - dimension: "Agent Rules"
    score: 5.0
    status: "Well-crafted ADR creation skill exists; missing CLAUDE.md and rules directory"
critical_gaps:
  - title: "No CI validation for markdown quality or link integrity"
    impact: "Broken links, formatting inconsistencies, and ADR template violations go undetected until manual review"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No PR template or ADR compliance checks"
    impact: "Contributors may submit ADRs that skip required sections or use incorrect numbering"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No CLAUDE.md or contributing guidelines for AI-assisted authoring"
    impact: "AI agents lack repository context for review or contribution beyond the single ADR creation skill"
    severity: "MEDIUM"
    effort: "2-3 hours"
quick_wins:
  - title: "Add markdownlint CI workflow for consistent formatting"
    effort: "2-3 hours"
    impact: "Catches formatting issues, enforces heading structure, and validates ADR template compliance"
  - title: "Add markdown-link-check CI workflow"
    effort: "1-2 hours"
    impact: "Detects broken internal and external links in ADRs and documentation"
  - title: "Add a CLAUDE.md with repository context and ADR review guidelines"
    effort: "1-2 hours"
    impact: "Enables AI agents to review ADRs, check numbering, and enforce template compliance"
  - title: "Add a PR template for ADR submissions"
    effort: "1 hour"
    impact: "Standardizes PR descriptions and reminds contributors to fill required sections"
recommendations:
  priority_0:
    - "Add a markdownlint GitHub Actions workflow to validate ADR formatting on every PR"
    - "Add markdown-link-check workflow to catch broken links across 43+ ADR documents"
  priority_1:
    - "Create CLAUDE.md documenting repository conventions, ADR numbering rules, and review criteria"
    - "Add a PR template (.github/pull_request_template.md) with an ADR submission checklist"
    - "Add a pre-commit hook configuration (.pre-commit-config.yaml) for local markdown linting"
  priority_2:
    - "Add a spell-check workflow (cspell or similar) to catch typos in ADRs"
    - "Create an ADR numbering validation script to detect duplicate or out-of-sequence numbers"
    - "Add an ADR review skill to .claude/skills/ complementing the existing creation skill"
---

# Quality Analysis: architecture-decision-records

## Executive Summary

- **Overall Score: 1.2/10** (weighted average)
- **Repository Type**: Documentation-only (Architecture Decision Records + Architecture Documentation)
- **Primary Content**: 43 Markdown ADR files across 12 component subdirectories, plus architecture diagrams and documentation
- **Jira Mapping**: RHOAIENG / Internal Processes & Documentation (midstream tier)

**Important Context**: This is a pure documentation repository with no source code, tests, builds, or container images. Five of the eight quality dimensions (Unit Tests, Integration/E2E, Build Integration, Image Testing, Coverage Tracking) are **not applicable** and score 0 by definition. The low overall score reflects this structural mismatch rather than poor practices. **If scored only on the three applicable dimensions (CI/CD, Static Analysis, Agent Rules), the effective score would be 2.5/10.**

- **Key Strengths**: Well-organized ADR structure with 12 component subdirectories, comprehensive CODEOWNERS file with team-based ownership, a well-crafted Claude Code skill for ADR creation
- **Critical Gaps**: No CI-based markdown validation, no link checking, no PR template, no contributing guidelines
- **Agent Rules Status**: Partial — has a creation skill but no CLAUDE.md, no rules directory, no review skill

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 0.0/10 | 15% | N/A — no source code |
| Integration/E2E | 0.0/10 | 20% | N/A — no deployable components |
| Build Integration | 0.0/10 | 15% | N/A — no builds or manifests |
| Image Testing | 0.0/10 | 10% | N/A — no container images |
| Coverage Tracking | 0.0/10 | 10% | N/A — no code coverage |
| CI/CD Automation | 2.0/10 | 15% | Stale-bot only; no content validation |
| Static Analysis | 1.5/10 | 10% | CODEOWNERS present; no linting or hooks |
| Agent Rules | 5.0/10 | 5% | ADR creation skill present; gaps in rules and review |

## Critical Gaps

### 1. No CI Validation for Markdown Quality or Link Integrity
- **Impact**: Broken links, formatting inconsistencies, and ADR template violations slip through to main. With 43+ ADR documents containing internal cross-references and external URLs, link rot is inevitable without automated checking.
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: The repository has zero PR-triggered workflows. The only CI workflow is a scheduled stale-bot (`stale.yml`) that marks idle PRs. No `markdownlint`, `markdown-link-check`, or similar tool runs on PR submission.

### 2. No PR Template or ADR Compliance Checks
- **Impact**: Contributors may submit ADRs that skip required sections (What, Why, Goals, Non-Goals, How, Alternatives, Stakeholder Impacts), use incorrect numbering, or place files in wrong directories. These issues are caught only during manual review.
- **Severity**: MEDIUM
- **Effort**: 2-4 hours

### 3. No CLAUDE.md or Repository-Level Agent Configuration
- **Impact**: AI agents operating on this repo lack context about ADR conventions, numbering rules, review criteria, and the ODH ecosystem. The existing creation skill helps authoring but doesn't cover review, validation, or contribution guidelines.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours

## Quick Wins

### 1. Add markdownlint CI Workflow (2-3 hours)
- **Impact**: Catches heading structure, line length, list formatting, and trailing whitespace issues automatically on every PR
- **Implementation**: Create `.github/workflows/lint.yml` with a `markdownlint-cli2` action and a `.markdownlint.yml` config file tuned for ADR content

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

### 2. Add markdown-link-check Workflow (1-2 hours)
- **Impact**: Detects broken internal references between ADRs and dead external URLs
- **Implementation**: Add a `links.yml` workflow using `gaurav-nelson/github-action-markdown-link-check`

```yaml
# .github/workflows/links.yml
name: Check Links
on: [pull_request]
jobs:
  links:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: gaurav-nelson/github-action-markdown-link-check@v1
        with:
          use-quiet-mode: 'yes'
          config-file: '.github/mlc_config.json'
```

### 3. Add CLAUDE.md with Repository Context (1-2 hours)
- **Impact**: AI agents get immediate context about ADR conventions, numbering, template compliance, and review criteria
- **Implementation**: Create a root `CLAUDE.md` documenting the ADR template structure, numbering conventions, component subdirectory mapping, and review expectations

### 4. Add PR Template (1 hour)
- **Impact**: Standardizes submissions and ensures contributors acknowledge required sections
- **Implementation**: Create `.github/pull_request_template.md` with an ADR checklist

## Detailed Findings

### Unit Tests
**Score: 0.0/10** — Not applicable.

This is a documentation repository containing only Markdown files and PNG images. There is no source code to unit test. No test files, test frameworks, or test configurations exist.

### Integration/E2E Tests
**Score: 0.0/10** — Not applicable.

No deployable components, APIs, or services exist in this repository. Integration and E2E testing concepts do not apply.

### Build Integration
**Score: 0.0/10** — Not applicable.

No Dockerfiles, Containerfiles, Makefiles, build scripts, or deployment manifests are present. The repository produces no build artifacts.

### Image Testing
**Score: 0.0/10** — Not applicable.

No container images are built from this repository.

### Coverage Tracking
**Score: 0.0/10** — Not applicable.

No source code means no code coverage to track. No `.codecov.yml`, coverage configuration, or coverage thresholds exist.

### CI/CD Automation
**Score: 2.0/10** — Minimal automation.

**What exists:**
- `.github/workflows/stale.yml` — Marks PRs as stale after 21 days of inactivity, closes after 7 more days. Runs on a daily schedule (`cron: '00 03 * * *'`). Uses `actions/stale@v5`.
- `.github/CODEOWNERS` — Well-structured ownership mapping with `@opendatahub-io/architects` as default owner and component-specific team assignments for documentation subdirectories.

**What's missing:**
- No PR-triggered workflow at all — nothing runs when a PR is opened
- No markdown linting (markdownlint, remark-lint)
- No link validation (markdown-link-check, lychee)
- No spell checking (cspell, aspell)
- No ADR template compliance checking
- No ADR numbering validation
- No PR template (`.github/pull_request_template.md`)
- No branch protection rules visible in the repo (may be configured in GitHub settings)

### Static Analysis
**Score: 1.5/10** — Minimal configuration.

**What exists:**
- `.github/CODEOWNERS` — Comprehensive ownership mapping covering 11 component documentation directories. Each directory maps to the architects team plus the relevant component team (e.g., `/documentation/components/serving/` maps to `@opendatahub-io/model-serving`).

**What's missing:**
- No markdown linter configuration (`.markdownlint.yml`, `.markdownlint.json`)
- No pre-commit hooks (`.pre-commit-config.yaml`)
- No spell-check configuration
- No editorconfig (`.editorconfig`)
- No Dependabot/Renovate (not applicable for a docs repo with no dependencies)
- No FIPS considerations (not applicable)

### Agent Rules
**Score: 5.0/10** — Partial coverage with a quality creation skill.

**What exists:**
- `.claude/skills/odh-adr-create/SKILL.md` — A well-crafted skill for creating new ADRs. It includes:
  - A structured interview workflow (4 key questions)
  - Automatic ADR numbering detection across global and component-scoped patterns
  - Component abbreviation table mapping subdirectories to codes
  - Complete template generation following the ODH ADR format
  - Ecosystem context awareness (references ODH components, OpenShift specifics)
  - Iterative refinement workflow
  - Writing style guidance

**What's missing:**
- No `CLAUDE.md` at repository root — agents lack basic repository context
- No `AGENTS.md` — no multi-agent coordination guidelines
- No `.claude/rules/` directory — no rule files for ADR review, validation, or formatting
- No ADR review skill — the creation skill exists but there's no complementary review/validation skill
- No contributing guidelines for AI-assisted authoring

**Quality of existing skill:**
The `odh-adr-create` skill is well above average in quality. It demonstrates:
- Deep understanding of the ODH ecosystem and component relationships
- Proper handling of the dual numbering system (global vs. component-scoped)
- Stakeholder impact analysis leveraging cross-component knowledge
- Iterative workflow rather than one-shot generation

## Recommendations

### Priority 0 (Critical)
1. **Add a markdownlint GitHub Actions workflow** — Validates ADR formatting, heading structure, and template compliance on every PR. Essential for maintaining consistency across 43+ documents contributed by multiple teams.
2. **Add markdown-link-check workflow** — With 12 subdirectories of cross-referencing ADRs and external links to Red Hat docs, Kubeflow docs, and GitHub issues, automated link validation is critical to prevent link rot.

### Priority 1 (High Value)
3. **Create a root CLAUDE.md** — Document the ADR template structure, numbering conventions, component subdirectory mapping, review expectations, and common pitfalls. This enables AI agents to assist with review, not just creation.
4. **Add a PR template** — Create `.github/pull_request_template.md` with a checklist covering: ADR number uniqueness, all required sections filled, correct subdirectory placement, stakeholder impacts identified, and status set correctly.
5. **Add pre-commit hooks** — Configure `.pre-commit-config.yaml` with markdownlint and trailing whitespace checks for local validation before push.

### Priority 2 (Nice-to-Have)
6. **Add a spell-check workflow** — Use cspell with a custom dictionary for ODH-specific terms (KServe, ModelMesh, DataScienceCluster, etc.) to catch typos.
7. **Create an ADR numbering validation script** — A simple CI check that scans all ADR files, extracts numbers, and fails if duplicates or out-of-sequence numbers are detected.
8. **Create an ADR review skill** — Complement the existing creation skill with a `.claude/skills/odh-adr-review/` skill that checks submitted ADRs against the template, validates cross-component impacts, and suggests improvements.
9. **Add an `.editorconfig`** — Standardize indentation, line endings, and trailing whitespace handling across editors.

## Comparison to Gold Standards

| Practice | architecture-decision-records | odh-dashboard | notebooks | kserve |
|----------|------------------------------|---------------|-----------|--------|
| PR-triggered CI | None | Comprehensive | Multi-layer | Full suite |
| Content validation | None | ESLint + tests | Image validation | Go linting |
| Link checking | None | CI-integrated | N/A | N/A |
| CODEOWNERS | Yes (comprehensive) | Yes | Yes | Yes |
| Pre-commit hooks | None | Configured | Configured | Configured |
| Agent rules | 1 skill (creation) | Comprehensive | None | None |
| PR template | None | Yes | Yes | Yes |
| Contributing guide | None | Yes | Yes | Yes |

**Note**: Direct comparison is limited because this is a documentation-only repository while the gold standards are code repositories. The comparison focuses on documentation-relevant practices.

## File Paths Reference

| File | Purpose |
|------|---------|
| `.github/workflows/stale.yml` | Stale PR/issue bot (only CI workflow) |
| `.github/CODEOWNERS` | Team-based ownership mapping |
| `.claude/skills/odh-adr-create/SKILL.md` | Claude Code skill for ADR creation |
| `architecture-decision-records/ODH-ADR-0000-template.md` | ADR template |
| `architecture-decision-records/README.md` | ADR governance and philosophy |
| `documentation/arch-overview.md` | RHOAI architecture overview |
| `documentation/README.md` | Documentation index |
| `README.md` | Repository overview |

## Repository Context

- **Org**: opendatahub-io
- **Jira Project**: RHOAIENG
- **Jira Component**: Internal Processes & Documentation
- **Tier**: Midstream
- **Content**: 43 ADR documents across 12 component subdirectories (operator, model-serving, data-science-pipelines, distributed-workloads, eval-hub, explainability, mlflow, model-registry, automl, autorag, autox, automated-red-teaming)
- **Teams**: Architecture team owns all files; component teams co-own their respective documentation directories
