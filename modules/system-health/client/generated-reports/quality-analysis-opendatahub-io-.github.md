---
repository: "opendatahub-io/.github"
overall_score: 2.8
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "N/A — No source code in this repository"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "N/A — No source code in this repository"
  - dimension: "Build Integration"
    score: 0.0
    status: "N/A — No build artifacts produced"
  - dimension: "Image Testing"
    score: 0.0
    status: "N/A — No container images"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "N/A — No source code to measure"
  - dimension: "CI/CD Automation"
    score: 3.0
    status: "No workflows; missed opportunity for org-wide reusable workflows"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, .claude/ directory, or agent configuration"
  - dimension: "Community Health"
    score: 6.0
    status: "Basic templates present but incomplete coverage"
  - dimension: "Template Quality"
    score: 5.0
    status: "Functional templates with room for standardization"
critical_gaps:
  - title: "No reusable GitHub Actions workflows"
    impact: "Each repo duplicates CI/CD configuration instead of inheriting org-wide standards"
    severity: "HIGH"
    effort: "16-24 hours"
  - title: "No organization-wide CODEOWNERS or security policy"
    impact: "No default SECURITY.md, CODEOWNERS, or CONTRIBUTING.md inherited by child repos"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No org-level agent rules or testing standards"
    impact: "AI-assisted development has no org-wide quality guidance"
    severity: "MEDIUM"
    effort: "8-12 hours"
  - title: "PR template lacks test type checklist"
    impact: "Contributors not prompted to verify test coverage by type (unit, integration, e2e)"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "Issue templates missing triage automation"
    impact: "No auto-labeling or routing for bug reports and feature requests"
    severity: "MEDIUM"
    effort: "4-6 hours"
quick_wins:
  - title: "Add SECURITY.md with vulnerability disclosure process"
    effort: "1-2 hours"
    impact: "Establishes org-wide security reporting across all repos"
  - title: "Add CONTRIBUTING.md with testing requirements"
    effort: "2-3 hours"
    impact: "Sets quality bar for all contributions across the org"
  - title: "Enhance PR template with structured test checklist"
    effort: "1 hour"
    impact: "Forces contributors to consider all test dimensions before merging"
  - title: "Add FUNDING.yml for sponsorship visibility"
    effort: "30 minutes"
    impact: "Standard GitHub community health file for open source projects"
  - title: "Add CODE_OF_CONDUCT.md"
    effort: "30 minutes"
    impact: "Standard community health file expected by contributors"
recommendations:
  priority_0:
    - "Create reusable GitHub Actions workflows (.github/workflows/) for linting, testing, and security scanning that child repos can inherit"
    - "Add SECURITY.md with coordinated vulnerability disclosure process"
    - "Add CONTRIBUTING.md that mandates test coverage expectations for all ODH repos"
  priority_1:
    - "Create org-level .claude/rules/ with testing standards for AI-assisted development"
    - "Enhance PR template to include structured test verification checklist"
    - "Add workflow_call reusable workflows for common CI patterns (Go test, Python lint, container scan)"
  priority_2:
    - "Add FUNDING.yml and CODE_OF_CONDUCT.md for community health completeness"
    - "Create issue template for security vulnerability reports"
    - "Add auto-labeling workflow for issue triage"
---

# Quality Analysis: opendatahub-io/.github

## Executive Summary

- **Overall Score: 2.8/10**
- **Repository Type**: GitHub organization-level community health repository (not a code repo)
- **Primary Language**: YAML / Markdown (templates and configuration only)
- **License**: Apache 2.0

### Key Strengths
- Issue templates use modern YAML-based forms with validation
- PR template includes basic merge criteria checklist
- Organization profile page provides useful onboarding links

### Critical Gaps
- **No reusable workflows** — Massive missed opportunity; this repo should be the central hub for org-wide CI/CD standards
- **Missing community health files** — No SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, or CODEOWNERS
- **No agent rules** — No .claude/ directory or AI-assisted development guidance
- **PR template lacks test coverage prompts** — No structured checklist for test types

### Agent Rules Status: Missing
No CLAUDE.md, .claude/ directory, or agent configuration exists. For an org-level repo, this is a missed opportunity to define org-wide testing standards that AI agents could inherit.

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | N/A | No source code in this repository |
| Integration/E2E | N/A | No source code in this repository |
| Build Integration | N/A | No build artifacts produced |
| Image Testing | N/A | No container images |
| Coverage Tracking | N/A | No source code to measure |
| CI/CD Automation | 3/10 | No workflows; missed opportunity for org-wide reusable workflows |
| Agent Rules | 0/10 | No CLAUDE.md, .claude/ directory, or agent configuration |
| Community Health | 6/10 | Basic templates present but incomplete coverage |
| Template Quality | 5/10 | Functional templates with room for standardization |

> **Note**: Standard code quality dimensions (unit tests, integration, image testing, coverage) are not applicable to this repository since it contains no source code. The overall score reflects what this repository *should* provide as an org-level .github repo — primarily reusable workflows, community health files, and quality standards.

## Critical Gaps

### 1. No Reusable GitHub Actions Workflows
- **Impact**: Each of the 50+ opendatahub-io repos duplicates CI/CD configuration instead of inheriting org-wide standards
- **Severity**: HIGH
- **Effort**: 16-24 hours
- **Details**: The `.github` repository is the ideal location for [reusable workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows) that child repos can call with `uses: opendatahub-io/.github/.github/workflows/lint.yml@main`. This would standardize linting, testing, security scanning, and container image building across the entire organization.

### 2. Missing SECURITY.md
- **Impact**: No organization-wide vulnerability disclosure process; contributors don't know how to report security issues
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: A default SECURITY.md would be inherited by every repo in the org that doesn't define its own. This is a GitHub community health file requirement.

### 3. Missing CONTRIBUTING.md
- **Impact**: No org-wide contribution standards; quality bar varies across repos
- **Severity**: HIGH
- **Effort**: 4-6 hours
- **Details**: Should define testing expectations, code review standards, and quality gates that apply across the organization.

### 4. PR Template Lacks Structured Test Checklist
- **Impact**: Contributors not prompted to verify test coverage by type
- **Severity**: MEDIUM
- **Effort**: 1-2 hours
- **Details**: Current PR template has a generic "How Has This Been Tested?" textarea. Should include checkboxes for unit tests, integration tests, e2e tests, and manual verification.

### 5. No Organization-Level Agent Rules
- **Impact**: AI-assisted development has no quality guardrails at the org level
- **Severity**: MEDIUM
- **Effort**: 8-12 hours

## Quick Wins

### 1. Enhance PR Template with Test Checklist (1 hour)
**Current**:
```markdown
## How Has This Been Tested?
<!--- Please describe in detail how you tested your changes. -->
```

**Recommended**:
```markdown
## Testing Checklist
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated (if applicable)
- [ ] E2E tests added/updated (if applicable)
- [ ] Manual testing performed
- [ ] No test changes needed (explain why):

### Test Details
<!--- Describe what tests you ran and their results -->
```

### 2. Add SECURITY.md (1-2 hours)
Create a `SECURITY.md` with:
- Supported versions
- Vulnerability reporting process (private security advisory or email)
- Expected response timeline
- Disclosure policy

### 3. Add CONTRIBUTING.md (2-3 hours)
Define org-wide standards for:
- Test coverage expectations
- PR review requirements
- Code quality standards
- Commit message format

### 4. Add CODE_OF_CONDUCT.md (30 minutes)
Adopt the Contributor Covenant or Red Hat's code of conduct.

### 5. Add FUNDING.yml (30 minutes)
```yaml
github: opendatahub-io
```

## Detailed Findings

### CI/CD Pipeline
**Score: 3/10**

The repository contains **zero** GitHub Actions workflows. For an organization-level `.github` repo, this represents a major missed opportunity. This repo should serve as the central hub for:

- **Reusable workflows** (`workflow_call`) for common CI patterns
- **Composite actions** for shared build steps
- **Organization-wide workflow defaults**

**What's missing:**
| Workflow Type | Purpose | Benefit |
|---|---|---|
| `lint.yml` | Reusable linting workflow | Consistent code quality across repos |
| `test.yml` | Reusable test runner | Standardized test execution |
| `security-scan.yml` | Trivy/CodeQL scanning | Org-wide security baseline |
| `container-build.yml` | Image build + push | Consistent container practices |
| `label-sync.yml` | Org-wide label standards | Consistent issue triage |

### Test Coverage
**Score: N/A**

No source code exists in this repository. No tests are applicable.

### Code Quality
**Score: N/A**

No source code to lint or analyze.

### Container Images
**Score: N/A**

No Dockerfiles or container configurations.

### Security
**Score: 2/10**

- No SECURITY.md (vulnerability disclosure process)
- No CodeQL configuration
- No Dependabot configuration
- No secret scanning configuration
- No branch protection rules documented

### Community Health Files

| File | Status | Notes |
|------|--------|-------|
| `LICENSE` | Present | Apache 2.0 |
| `PULL_REQUEST_TEMPLATE.md` | Present | Basic; needs test checklist |
| `ISSUE_TEMPLATE/bug_report.yaml` | Present | YAML form with validation |
| `ISSUE_TEMPLATE/feature_request.yaml` | Present | YAML form with validation |
| `profile/README.md` | Present | Org overview with links |
| `SECURITY.md` | **Missing** | No vulnerability disclosure process |
| `CONTRIBUTING.md` | **Missing** | No contribution guidelines |
| `CODE_OF_CONDUCT.md` | **Missing** | No code of conduct |
| `CODEOWNERS` | **Missing** | No default code owners |
| `FUNDING.yml` | **Missing** | No funding configuration |
| `SUPPORT.md` | **Missing** | No support documentation |

### Issue Templates Analysis

**Bug Report** (`bug_report.yaml`):
- Uses modern YAML form format
- Includes OpenShift version dropdown
- Includes infrastructure dropdown (Baremetal, OSP, RHV, AWS)
- Browser selection for UI bugs
- Log output field with shell rendering
- Workaround field
- Labels: `kind/bug`
- **Gap**: No severity/priority field; no component selector

**Feature Request** (`feature_request.yaml`):
- Uses YAML form format
- Labels: `kind/enhancement`, `feature`, `untriaged`
- Has problem-relation field and alternatives section
- **Gap**: No acceptance criteria template; no prioritization guidance

**Missing Templates**:
- Security vulnerability report (should use private reporting)
- Documentation improvement
- Release/version-specific issue

### PR Template Analysis

**Current content** (`PULL_REQUEST_TEMPLATE.md`):
- Description section
- Testing description (free-text)
- Merge criteria checklist (squash, testing instructions, manual testing)

**Gaps**:
- No structured test type checklist (unit/integration/e2e)
- No link to contributing guidelines
- No Jira/issue linking requirement
- No breaking change notification
- No documentation update checkbox
- No reviewer assignment guidance

### Agent Rules (Agentic Flow Quality)
**Score: 0/10**

- **Status**: Missing
- **Coverage**: No agent rules exist
- **Quality**: N/A
- **Gaps**: No CLAUDE.md, no .claude/ directory, no rules for test creation, no AI development standards
- **Recommendation**: Create org-level `.claude/rules/` with testing standards that can serve as a template for child repos. Use `/test-rules-generator` on the most mature repos (odh-dashboard, kserve) and consolidate patterns here.

## Recommendations

### Priority 0 (Critical)

1. **Create reusable GitHub Actions workflows**
   - `lint.yml` — Go/Python/TypeScript linting with `workflow_call`
   - `test.yml` — Reusable test runner
   - `security-scan.yml` — Trivy + CodeQL
   - `container-build.yml` — Standard image build + push
   - This eliminates CI/CD duplication across 50+ repos

2. **Add SECURITY.md**
   - Vulnerability disclosure process
   - Security contact information
   - Response timeline commitments
   - Supported version matrix

3. **Add CONTRIBUTING.md**
   - Test coverage expectations (mandatory for all PRs)
   - Code review standards
   - Quality gates before merge

### Priority 1 (High Value)

4. **Enhance PR template with structured test checklist**
   - Add checkboxes for unit, integration, e2e, manual testing
   - Add breaking change notification
   - Add documentation update checkbox
   - Link to contributing guidelines

5. **Create org-level agent rules (.claude/rules/)**
   - Define testing standards for AI-assisted development
   - Unit test patterns for Go operators, Python ML code, TypeScript frontends
   - Integration test requirements
   - Quality gates and checklists

6. **Add issue template for security vulnerabilities**
   - Use GitHub's private vulnerability reporting feature
   - Or create a template that redirects to private channels

### Priority 2 (Nice-to-Have)

7. **Add CODE_OF_CONDUCT.md**
   - Adopt Contributor Covenant or Red Hat standard

8. **Add Dependabot configuration**
   - Organization-wide dependency update settings

9. **Add auto-labeling workflow**
   - Triage incoming issues automatically
   - Route bugs vs. features to appropriate teams

10. **Add label sync workflow**
    - Standardize labels across all repos
    - Enforce consistent triage categories

## Comparison to Gold Standards

| Capability | opendatahub-io/.github | odh-dashboard | notebooks | Best Practice |
|---|---|---|---|---|
| Reusable workflows | None | N/A (uses own) | N/A (uses own) | Org-level reusable workflows |
| Issue templates | 2 YAML forms | Custom | Custom | 4+ templates (bug, feature, security, docs) |
| PR template | Basic | Structured | Basic | Structured with test checklist |
| SECURITY.md | Missing | Present | Missing | Required for open source |
| CONTRIBUTING.md | Missing | Present | Present | Required for open source |
| CODE_OF_CONDUCT.md | Missing | Missing | Missing | Recommended |
| Agent rules | Missing | Present (.claude/) | Missing | Org-level standards |
| Org profile | Present | N/A | N/A | Present with links |

## File Paths Reference

| File | Purpose |
|------|---------|
| `PULL_REQUEST_TEMPLATE.md` | Default PR template for all org repos |
| `ISSUE_TEMPLATE/bug_report.yaml` | Bug report issue form |
| `ISSUE_TEMPLATE/feature_request.yaml` | Feature request issue form |
| `profile/README.md` | Organization profile page |
| `LICENSE` | Apache 2.0 license |

## Summary

The `opendatahub-io/.github` repository is significantly underutilized. As the organization-level defaults repo, it should serve as the central hub for:

1. **Reusable CI/CD workflows** — Eliminate duplication across 50+ repos
2. **Community health files** — SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md
3. **Quality standards** — Testing requirements, PR review standards
4. **Agent development rules** — Org-wide AI development quality guardrails

Currently it only provides basic issue and PR templates plus an organization profile. Investing 30-40 hours to build out this repo would have multiplicative impact across the entire opendatahub-io organization.
