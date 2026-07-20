---
repository: "opendatahub-io/opendatahub.io-redirects"
overall_score: 1.4
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No test files exist — zero test coverage"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests of any kind"
  - dimension: "Build Integration"
    score: 2.0
    status: "GitLab CI builds Jekyll site but no validation beyond build success"
  - dimension: "Image Testing"
    score: 0.0
    status: "No container images — not applicable for a static Jekyll site"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling configured"
  - dimension: "CI/CD Automation"
    score: 3.0
    status: "Minimal GitLab CI with build/deploy stages; uses outdated Ruby 2.3 image"
  - dimension: "Static Analysis"
    score: 1.0
    status: "No linting, no dependency alerts, no pre-commit hooks"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, AGENTS.md, or .claude/ directory"
critical_gaps:
  - title: "Outdated Ruby 2.3 base image in CI"
    impact: "Ruby 2.3 reached EOL in March 2019 — severe security risk and gem compatibility issues"
    severity: "HIGH"
    effort: "1-2 hours"
  - title: "No redirect validation tests"
    impact: "Broken redirects go undetected until users hit 404s on the live site"
    severity: "HIGH"
    effort: "2-4 hours"
  - title: "No dependency management or alerts"
    impact: "Outdated gems with known vulnerabilities are never flagged"
    severity: "MEDIUM"
    effort: "1-2 hours"
  - title: "No GitHub Actions CI (repo is on GitHub, CI is on GitLab)"
    impact: "PRs on GitHub have no status checks — no build validation before merge"
    severity: "HIGH"
    effort: "2-3 hours"
quick_wins:
  - title: "Update CI base image from Ruby 2.3 to Ruby 3.x"
    effort: "30 minutes"
    impact: "Eliminate EOL runtime risk and unblock modern gem versions"
  - title: "Add Dependabot for Bundler ecosystem"
    effort: "30 minutes"
    impact: "Automated security alerts for gem dependencies"
  - title: "Add a GitHub Actions workflow mirroring GitLab CI"
    effort: "1-2 hours"
    impact: "PR status checks on the platform where the repo actually lives"
  - title: "Add HTML-proofer to validate redirects post-build"
    effort: "1-2 hours"
    impact: "Catch broken redirect URLs before deploy"
recommendations:
  priority_0:
    - "Update Ruby base image from EOL 2.3 to a supported 3.x release"
    - "Add GitHub Actions CI workflow with Jekyll build + redirect validation"
  priority_1:
    - "Add html-proofer or custom redirect validation to CI"
    - "Enable Dependabot for bundler ecosystem"
  priority_2:
    - "Add basic CLAUDE.md with repo purpose and contribution guidelines"
    - "Consider archiving this repo if redirects can be handled at the DNS/CDN level"
---

# Quality Analysis: opendatahub.io-redirects

## Executive Summary
- **Overall Score: 1.4/10**
- **Repository Type**: Static website (Jekyll) — URL redirect handler
- **Primary Language**: HTML/SCSS/Ruby (Jekyll)
- **Jira**: RHOAIENG / Documentation (midstream tier)
- **Key Strengths**: Simple, single-purpose design; functional GitLab CI pipeline with build/deploy stages
- **Critical Gaps**: No tests of any kind, EOL Ruby 2.3 runtime, no GitHub CI despite being hosted on GitHub, no dependency alerts
- **Agent Rules Status**: Missing

## Context

This repository is an extremely minimal Jekyll site (21 files, ~950 lines total) whose sole purpose is to redirect old `opendatahub.io` URLs to the current site. The `index.html` does a meta-refresh redirect to `https://opendatahub.io`. Given its narrow scope, many quality dimensions (image testing, coverage tracking) are genuinely not applicable. However, even for a redirect service, basic CI hygiene and redirect validation are important.

## Quality Scorecard

| Dimension | Weight | Score | Status |
|-----------|--------|-------|--------|
| Unit Tests | 15% | 0.0/10 | No test files exist |
| Integration/E2E | 20% | 0.0/10 | No integration or E2E tests |
| Build Integration | 15% | 2.0/10 | GitLab CI builds site but no validation |
| Image Testing | 10% | 0.0/10 | N/A — no container images |
| Coverage Tracking | 10% | 0.0/10 | No coverage tooling |
| CI/CD Automation | 15% | 3.0/10 | Minimal GitLab CI; outdated base image |
| Static Analysis | 10% | 1.0/10 | No linting, no dependency alerts |
| Agent Rules | 5% | 0.0/10 | No agent rules present |

**Weighted Overall: 1.4/10**

## Critical Gaps

### 1. Outdated Ruby 2.3 Base Image in CI
- **Severity**: HIGH
- **Impact**: Ruby 2.3 reached EOL in March 2019. This means no security patches for over 7 years, potential gem incompatibilities, and exposure to known CVEs in the Ruby runtime.
- **Effort**: 1-2 hours
- **File**: `.gitlab-ci.yml:1` — `image: ruby:2.3`

### 2. No Redirect Validation Tests
- **Severity**: HIGH
- **Impact**: The entire purpose of this repository is URL redirection. Without any tests, broken redirects (malformed URLs, missing pages, incorrect targets) are invisible until real users encounter them. For a redirect service, this is the functional equivalent of shipping code with zero test coverage.
- **Effort**: 2-4 hours
- **Recommendation**: Add `html-proofer` gem to validate all redirect URLs resolve correctly after Jekyll build

### 3. No GitHub Actions CI
- **Severity**: HIGH
- **Impact**: The repository lives on GitHub but CI runs on GitLab (`.gitlab-ci.yml`). GitHub PRs have zero status checks — anyone can merge changes without a build passing. This is a silent gap that defeats the purpose of code review.
- **Effort**: 2-3 hours

### 4. No Dependency Management
- **Severity**: MEDIUM
- **Impact**: No Dependabot or Renovate configuration. The `Gemfile.lock` pins gem versions but there's no automated alerting when dependencies have known vulnerabilities.
- **Effort**: 30 minutes

## Quick Wins

### 1. Update Ruby Base Image (30 minutes)
Replace `image: ruby:2.3` with `image: ruby:3.3` in `.gitlab-ci.yml`. Test locally with `bundle exec jekyll build` first.

```yaml
# .gitlab-ci.yml
image: ruby:3.3
```

### 2. Add Dependabot for Bundler (30 minutes)
Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "bundler"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 3. Add GitHub Actions CI (1-2 hours)
Create `.github/workflows/build.yml`:

```yaml
name: Build
on:
  pull_request:
    branches: [master]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.3'
          bundler-cache: true
      - run: bundle exec jekyll build -d _site
```

### 4. Add Redirect Validation (1-2 hours)
Add `html-proofer` to the Gemfile and CI:

```ruby
# Gemfile
group :test do
  gem 'html-proofer'
end
```

```yaml
# In CI script
- bundle exec htmlproofer _site --check-html --allow-hash-href
```

## Detailed Findings

### Unit Tests
- **Score**: 0.0/10
- **Finding**: Zero test files in the repository. No `*_test.*`, `*.spec.*`, or `test_*` files.
- **Context**: For a pure redirect site this is somewhat understandable, but even a simple smoke test verifying the generated HTML contains correct redirect URLs would add value.

### Integration/E2E Tests
- **Score**: 0.0/10
- **Finding**: No integration test directory (`e2e/`, `integration/`, `test/`). No test frameworks referenced in `Gemfile`.
- **Recommendation**: At minimum, validate that `bundle exec jekyll build` produces an `index.html` with the correct redirect target.

### Build Integration
- **Score**: 2.0/10
- **Finding**: GitLab CI has a `test` stage that runs `bundle exec jekyll build -d test`, which validates that Jekyll can build the site. However:
  - No validation of the built output (redirect correctness, HTML validity)
  - No PR-time checks on GitHub where the repo is actually hosted
  - The `test` stage runs on all non-master branches, which is good
  - The `pages` stage deploys on master, which is appropriate
- **Files analyzed**: `.gitlab-ci.yml`

### Image Testing
- **Score**: 0.0/10
- **Finding**: Not applicable. This is a static Jekyll site with no Dockerfile or container images. The site is deployed via GitLab Pages, not as a container.

### Coverage Tracking
- **Score**: 0.0/10
- **Finding**: No coverage configuration (`.codecov.yml`, `.coveragerc`, etc.). Since there are no tests, there's nothing to measure coverage against.

### CI/CD Automation
- **Score**: 3.0/10
- **Positive findings**:
  - GitLab CI pipeline exists with proper stage separation (test vs. deploy)
  - Branch filtering: test runs on non-master, deploy runs on master only
  - Artifacts are correctly configured for GitLab Pages
- **Negative findings**:
  - Base image `ruby:2.3` is EOL since March 2019 (7+ years ago)
  - No concurrency control
  - No caching (every build does full `bundle install`)
  - No timeout configuration
  - No GitHub Actions despite repo being on GitHub
  - No test parallelization (not needed at this scale)
- **Files analyzed**: `.gitlab-ci.yml`

### Static Analysis
- **Score**: 1.0/10
- **Finding**: No linting configuration of any kind:
  - No `.rubocop.yml` for Ruby style
  - No HTML linting
  - No SCSS linting
  - No `.pre-commit-config.yaml`
  - No `.github/dependabot.yml` or `renovate.json`
- **FIPS Compatibility**: Not applicable — no cryptographic operations
- **Dependency Alerts**: Absent. No Dependabot or Renovate configured.

### Agent Rules
- **Score**: 0.0/10
- **Finding**: No `CLAUDE.md`, `AGENTS.md`, or `.claude/` directory. No test automation guidance for AI agents.
- **Recommendation**: Given the repo's simplicity, a basic `CLAUDE.md` describing the repo's purpose and how to test changes locally would be sufficient.

## Recommendations

### Priority 0 (Critical)
1. **Update Ruby base image** from EOL `ruby:2.3` to `ruby:3.3` in `.gitlab-ci.yml`
2. **Add GitHub Actions CI** so PRs on GitHub get build status checks

### Priority 1 (High Value)
1. **Add `html-proofer`** to validate redirect URLs and HTML correctness post-build
2. **Enable Dependabot** for the bundler ecosystem to get automated vulnerability alerts
3. **Add bundle caching** to GitLab CI to speed up builds

### Priority 2 (Nice-to-Have)
1. **Add a basic `CLAUDE.md`** with repo purpose, local dev instructions, and contribution guidelines
2. **Consider archiving** — if redirects can be handled at the DNS/CDN level (e.g., Cloudflare Page Rules, nginx config), this entire repository may be unnecessary
3. **Update `Gemfile.lock`** — current lock file may have stale dependencies

## Comparison to Gold Standards

| Practice | This Repo | odh-dashboard | notebooks | kserve |
|----------|-----------|---------------|-----------|--------|
| Unit Tests | None | Comprehensive Jest/Vitest | Moderate | Strong Go testing |
| Integration/E2E | None | Cypress + contract tests | 5-layer validation | Multi-version E2E |
| Build Integration | Jekyll build only | PR Docker builds | Multi-arch builds | Konflux simulation |
| Image Testing | N/A | Container validation | Testcontainers | Runtime checks |
| Coverage Tracking | None | Codecov enforced | Moderate | Threshold enforcement |
| CI/CD Automation | Minimal GitLab CI | Comprehensive GHA | Full GHA suite | Multi-workflow GHA |
| Static Analysis | None | ESLint + strict TS | Moderate | golangci-lint |
| Agent Rules | None | Comprehensive | Basic | Moderate |

## File Paths Reference

| File | Purpose |
|------|---------|
| `.gitlab-ci.yml` | CI/CD pipeline (build + deploy) |
| `_config.yml` | Jekyll configuration |
| `index.html` | Main redirect page |
| `_layouts/redirect.html` | Redirect page template |
| `Gemfile` | Ruby dependencies |
| `Gemfile.lock` | Pinned dependency versions |
| `.gitignore` | Git ignore rules |
| `_sass/` | SCSS stylesheets (3 files) |
| `_layouts/` | Jekyll layout templates (3 files) |

## Summary

This repository scores 1.4/10, which is expected given its extremely narrow scope as a URL redirect service. The most actionable improvements are updating the EOL Ruby runtime (critical security concern), adding GitHub Actions CI (the repo is on GitHub but CI is on GitLab), and enabling Dependabot. The team should also consider whether this redirect function could be handled more simply at the infrastructure level (DNS/CDN), potentially allowing this repository to be archived.
