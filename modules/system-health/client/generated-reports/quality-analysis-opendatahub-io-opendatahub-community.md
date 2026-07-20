---
repository: "opendatahub-io/opendatahub-community"
overall_score: 0.8
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "N/A — documentation-only repository with no source code"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "N/A — no application code to integration-test"
  - dimension: "Build Integration"
    score: 0.0
    status: "N/A — no build artifacts, Dockerfiles, or Makefiles"
  - dimension: "Image Testing"
    score: 0.0
    status: "N/A — no container images produced"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "N/A — no code to measure coverage against"
  - dimension: "CI/CD Automation"
    score: 2.0
    status: "Issue templates present but no GitHub Actions workflows for validation"
  - dimension: "Static Analysis"
    score: 1.0
    status: "No markdown linting, link checking, or YAML validation"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "No CI/CD workflows for documentation validation"
    impact: "Broken links, formatting errors, and stale content go undetected until manual review"
    severity: "MEDIUM"
    effort: "2-4 hours"
  - title: "No markdown linting or link checking"
    impact: "Documentation quality degrades over time with inconsistent formatting and dead links"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "Stale SIG/WG metadata — sigs.yaml uses placeholder values"
    impact: "Community members cannot find real meeting links, contacts, or chair information"
    severity: "HIGH"
    effort: "2-3 hours"
quick_wins:
  - title: "Add a markdown lint workflow (markdownlint-cli2)"
    effort: "1-2 hours"
    impact: "Catches formatting inconsistencies and enforces style on every PR"
  - title: "Add a link-check workflow (lychee or markdown-link-check)"
    effort: "1 hour"
    impact: "Automatically detects broken links to external resources, Jira tickets, and Google Docs"
  - title: "Add YAML schema validation for sigs.yaml and membership.yaml"
    effort: "1-2 hours"
    impact: "Prevents structural errors in machine-readable community metadata"
  - title: "Populate sigs.yaml with real data instead of placeholders"
    effort: "2-3 hours"
    impact: "Makes the community metadata actionable for tooling and onboarding"
recommendations:
  priority_0:
    - "Add a GitHub Actions workflow with markdownlint and link checking to validate PRs"
    - "Update sigs.yaml with real chair names, meeting links, and contact channels instead of placeholder values"
  priority_1:
    - "Add a YAML lint/validation step for sigs.yaml and membership.yaml"
    - "Add a CODEOWNERS file to enforce review on governance-sensitive files"
    - "Consider adding a PR template to standardize community contributions"
  priority_2:
    - "Add CLAUDE.md with contribution context for AI-assisted documentation editing"
    - "Add a periodic link-check scheduled workflow to detect link rot"
    - "Consider adding a changelog or ADR (Architecture Decision Record) workflow"
---

# Quality Analysis: opendatahub-community

## Executive Summary

- **Overall Score: 0.8 / 10**
- **Repository Type**: Documentation / Community Governance (no source code)
- **Primary Language**: Markdown, YAML
- **Jira**: RHOAIENG / AI Core Platform (midstream tier)

**Important Context**: This repository is a pure documentation and governance repository for the Open Data Hub community. It contains no source code, no build artifacts, and no deployable components. Most quality dimensions (unit tests, integration tests, build integration, image testing, coverage) are **not applicable**. The score reflects the absence of documentation-oriented quality practices (linting, link checking, CI validation) rather than missing code-level testing.

- **Key Strengths**: Well-structured governance documentation; comprehensive feature development requirements covering Dev Preview → Tech Preview → GA lifecycle; issue templates for bug reports and release tracking
- **Critical Gaps**: No CI/CD workflows at all; no markdown linting or link validation; sigs.yaml contains placeholder data instead of real community metadata
- **Agent Rules Status**: Missing

## Quality Scorecard

| Dimension | Score | Weight | Status |
|-----------|-------|--------|--------|
| Unit Tests | 0.0 / 10 | 15% | N/A — no source code |
| Integration/E2E | 0.0 / 10 | 20% | N/A — no application code |
| Build Integration | 0.0 / 10 | 15% | N/A — no build artifacts |
| Image Testing | 0.0 / 10 | 10% | N/A — no container images |
| Coverage Tracking | 0.0 / 10 | 10% | N/A — no code to cover |
| CI/CD Automation | 2.0 / 10 | 15% | Issue templates only, no workflows |
| Static Analysis | 1.0 / 10 | 10% | No markdown lint, link check, or YAML validation |
| Agent Rules | 0.0 / 10 | 5% | No CLAUDE.md or .claude/ directory |

**Weighted Overall: 0.8 / 10**

## Critical Gaps

### 1. No CI/CD Workflows for Documentation Validation
- **Impact**: Broken links, formatting errors, YAML schema violations, and stale content go undetected until manual review
- **Severity**: MEDIUM
- **Effort**: 2-4 hours
- **Details**: The `.github/` directory contains only issue templates (`ISSUE_TEMPLATE/bug_report.yaml` and `ISSUE_TEMPLATE/release_tracker.yaml`). There are no GitHub Actions workflows in `.github/workflows/`. For a community governance repo with 50+ files (31 markdown, 4 YAML), automated validation is essential.

### 2. No Markdown Linting or Link Checking
- **Impact**: Documentation quality degrades over time; external links to Jira, Google Docs, and Red Hat internal resources rot without detection
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: The repo links heavily to external resources (Jira issues like RHOAIENG-31244, Google Docs, Red Hat internal spaces). These links are not validated and will break silently.

### 3. sigs.yaml Uses Placeholder Values
- **Impact**: Community members cannot find actual meeting links, chair contacts, or subproject owners; tooling that consumes this file gets useless data
- **Severity**: HIGH
- **Effort**: 2-3 hours
- **Details**: Both SIG entries in `sigs.yaml` use placeholder values like `github: abc`, `name: ABC`, `url: https://url.here`, and `slack: slack-channel-here`. The `membership.yaml` file appears to have real data, but the SIG metadata is entirely synthetic.

## Quick Wins

### 1. Add Markdown Lint Workflow
- **Effort**: 1-2 hours
- **Impact**: Catches formatting inconsistencies and enforces style on every PR
- **Implementation**:
```yaml
# .github/workflows/lint.yml
name: Lint
on: [pull_request]
jobs:
  markdown:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: DavidAnson/markdownlint-cli2-action@v19
        with:
          globs: '**/*.md'
```

### 2. Add Link-Check Workflow
- **Effort**: 1 hour
- **Impact**: Automatically detects broken links in PRs and on a weekly schedule
- **Implementation**:
```yaml
# .github/workflows/link-check.yml
name: Link Check
on:
  pull_request:
  schedule:
    - cron: '0 8 * * 1'
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: lycheeverse/lychee-action@v2
        with:
          args: --verbose --no-progress '**/*.md'
          fail: true
```

### 3. Add YAML Schema Validation
- **Effort**: 1-2 hours
- **Impact**: Prevents structural errors in machine-readable community metadata
- **Implementation**: Add `yamllint` to the lint workflow targeting `sigs.yaml`, `membership.yaml`, and issue templates.

### 4. Populate sigs.yaml with Real Data
- **Effort**: 2-3 hours
- **Impact**: Makes the community metadata actionable for contributors, tooling, and onboarding
- **Details**: Replace all `abc`/`XYZ`/`https://url.here` placeholders with actual GitHub handles, names, meeting URLs, and Slack channels.

## Detailed Findings

### Repository Overview

The `opendatahub-community` repository serves as the governance and community hub for the Open Data Hub project. It contains:

| Content Type | Count | Examples |
|-------------|-------|---------|
| Markdown docs | 31 | Governance, contributing, membership, feature requirements |
| YAML files | 4 | sigs.yaml, membership.yaml, issue templates |
| Images | 7 | Architecture diagrams, proposal visuals |
| Directories | 9 | 3 SIGs, 5 working groups, proposals |

**Notable documentation**:
- `feature-development-requirements.md` — Comprehensive lifecycle requirements from Dev Preview → Tech Preview → GA, with Jira template references and checklists
- `community-membership.md` — Defines contributor, reviewer, approver, and lead roles
- `governance.md` — SIG structure, Steering Committee membership, decision-making processes
- `contributing.md` — Contribution guidelines
- `GuidelinesForNewComponents.md` — Requirements for adding new components

### Unit Tests
- **Score: 0.0 / 10**
- **Status**: Not applicable
- No source code files exist in this repository. It is entirely markdown and YAML documentation.

### Integration/E2E Tests
- **Score: 0.0 / 10**
- **Status**: Not applicable
- No application code, APIs, or services to test.

### Build Integration
- **Score: 0.0 / 10**
- **Status**: Not applicable
- No `Makefile`, `Dockerfile`, `Containerfile`, `go.mod`, `package.json`, `requirements.txt`, or any build configuration.

### Image Testing
- **Score: 0.0 / 10**
- **Status**: Not applicable
- No container images are produced by this repository.

### Coverage Tracking
- **Score: 0.0 / 10**
- **Status**: Not applicable
- No code to measure coverage against. No `.codecov.yml` or equivalent.

### CI/CD Automation
- **Score: 2.0 / 10**
- **Positive findings**:
  - `.github/ISSUE_TEMPLATE/bug_report.yaml` — Structured bug report template with component dropdown, reproduction steps, and browser selection
  - `.github/ISSUE_TEMPLATE/release_tracker.yaml` — Release tracker template with automation-friendly comment format (`#Release#` blocks)
- **Gaps**:
  - No `.github/workflows/` directory — zero GitHub Actions workflows
  - No PR validation (no markdown lint, no link check, no YAML validation)
  - No branch protection enforcement visible
  - No CODEOWNERS file for review routing
  - No PR template for standardized contributions

### Static Analysis

#### Linting
- **Score: 1.0 / 10**
- No markdown linting configuration (`.markdownlint.json`, `.markdownlint-cli2.yaml`)
- No YAML linting (`yamllint`)
- No pre-commit hooks (`.pre-commit-config.yaml`)

#### FIPS Compatibility
- Not applicable — no source code or binaries.

#### Dependency Alerts
- No `.github/dependabot.yml` — not applicable since there are no code dependencies.
- No `renovate.json` — not applicable.

### Agent Rules
- **Score: 0.0 / 10**
- **Status**: Missing
- No `CLAUDE.md` or `AGENTS.md` in repository root
- No `.claude/` directory
- No `.claude/rules/` for documentation editing guidance
- **Recommendation**: For a governance repo, agent rules could guide AI assistants on documentation style, link format conventions, and governance terminology. Use `/test-rules-generator` or manually create rules for documentation-focused contributions.

## Recommendations

### Priority 0 (Critical)
1. **Add a GitHub Actions workflow with markdownlint and link checking** to validate PRs — this is the single highest-impact improvement for a docs-only repo (2-4 hours)
2. **Update sigs.yaml with real data** — placeholder values make the file misleading and unusable for tooling or community navigation (2-3 hours)

### Priority 1 (High Value)
1. **Add YAML schema validation** for `sigs.yaml` and `membership.yaml` to prevent structural regressions (1-2 hours)
2. **Add a CODEOWNERS file** to enforce review requirements on governance-sensitive files like `governance.md`, `community-membership.md`, and `feature-development-requirements.md` (1 hour)
3. **Add a PR template** (`.github/pull_request_template.md`) to standardize documentation contributions (1 hour)

### Priority 2 (Nice-to-Have)
1. **Add CLAUDE.md** with context for AI-assisted documentation editing (style guide, link conventions, governance terminology) (2-3 hours)
2. **Add a periodic link-check scheduled workflow** (weekly) to detect link rot in external references to Jira, Google Docs, and Red Hat internal pages (1 hour)
3. **Consider adding a spell-check step** (cspell or typos) to catch typos in governance documents (1-2 hours)
4. **Add a `.markdownlint.json` config file** to customize rules for the project's documentation style (30 minutes)

## Comparison to Gold Standards

| Practice | odh-community | odh-dashboard | notebooks | kserve |
|----------|--------------|---------------|-----------|--------|
| Unit Tests | N/A (docs) | Jest + React Testing Library | N/A (images) | Go test + envtest |
| Integration/E2E | N/A | Cypress E2E | Multi-image validation | Ginkgo E2E |
| Build Integration | N/A | PR image build | Multi-arch image build | Operator bundle + deploy |
| Image Testing | N/A | N/A | 5-layer validation | Container startup |
| Coverage Tracking | N/A | Codecov enforced | N/A | Codecov enforced |
| CI/CD Automation | Issue templates only | 20+ workflows | Extensive CI matrix | Comprehensive CI |
| Static Analysis | None | ESLint + Prettier | shellcheck | golangci-lint |
| Agent Rules | None | CLAUDE.md + rules | None | None |
| **Markdown Lint** | **None** | N/A | N/A | N/A |
| **Link Check** | **None** | N/A | N/A | N/A |

**Note**: For a documentation-only governance repo, the relevant comparison points are markdown linting, link checking, YAML validation, and PR templates — not code-level testing. The current repo has none of these.

## File Paths Reference

### Documentation
- `README.md` — Community overview and links
- `governance.md` — Governance structure and Steering Committee
- `community-membership.md` — Contributor roles and responsibilities
- `contributing.md` — How to contribute
- `feature-development-requirements.md` — Dev Preview → Tech Preview → GA requirements
- `GuidelinesForNewComponents.md` — New component integration guidelines
- `sig-governance.md` — SIG operating mechanics
- `sig-charter-template.md` — Template for SIG charters
- `sig-charter-guide.md` — Guide for writing SIG charters
- `contributor-cheatsheet.md` — Quick reference for contributors
- `odh-repositories.md` — Repository guidelines

### Machine-Readable Metadata
- `sigs.yaml` — SIG definitions (contains placeholder data)
- `membership.yaml` — Community membership data

### Issue Templates
- `.github/ISSUE_TEMPLATE/bug_report.yaml` — Bug report template
- `.github/ISSUE_TEMPLATE/release_tracker.yaml` — Release tracker template

### SIG Directories
- `sig-ml-developer-experience/` — ML Developer Experience SIG (charter, README, OWNERS)
- `sig-ml-ops/` — ML Ops SIG (charter, README, OWNERS)
- `sig-platform/` — Platform SIG (charter, README, OWNERS)

### Working Group Directories
- `wg-distributed-workloads/` — Distributed Workloads WG
- `wg-model-registry/` — Model Registry WG
- `wg-on-prem/` — On-Prem WG
- `wg-release-engineering/` — Release Engineering WG
- `wg-serving-integration/` — Serving Integration WG
- `wg-xai/` — Explainable AI WG

### Proposals
- `proposal/` — Component proposals (model-registry, kserve-serving, modelmesh-serving, distributed-workloads, pachyderm, xskipper, release-engineering)
