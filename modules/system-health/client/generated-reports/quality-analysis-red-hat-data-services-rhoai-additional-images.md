---
repository: "red-hat-data-services/rhoai-additional-images"
overall_score: 1.6
scorecard:
  - dimension: "Unit Tests"
    score: 0.0
    status: "No code exists — repository is a YAML-only image manifest registry"
  - dimension: "Integration/E2E"
    score: 0.0
    status: "No integration or E2E tests; image references are never validated"
  - dimension: "Build Integration"
    score: 0.0
    status: "No CI/CD workflows; no PR validation of any kind"
  - dimension: "Image Testing"
    score: 0.0
    status: "No image pull, startup, or vulnerability validation for listed images"
  - dimension: "Coverage Tracking"
    score: 0.0
    status: "No coverage tooling — nothing to measure"
  - dimension: "CI/CD Automation"
    score: 3.0
    status: "Branch-per-release model provides some structure; but no automation whatsoever"
  - dimension: "Agent Rules"
    score: 0.0
    status: "No CLAUDE.md, .claude/ directory, or agent guidance"
critical_gaps:
  - title: "Zero CI/CD — no GitHub Actions, no PR checks, no automation"
    impact: "Typos, invalid digests, and broken image references merge unchecked"
    severity: "HIGH"
    effort: "4-8 hours"
  - title: "No image reference validation"
    impact: "SHA digests could be wrong, images could be deleted or unreachable — nobody knows until disconnected deployment fails"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No YAML schema validation on PRs"
    impact: "Malformed YAML or wrong structure can merge silently"
    severity: "HIGH"
    effort: "2-3 hours"
  - title: "No vulnerability scanning of referenced images"
    impact: "Known CVEs in referenced images are never flagged — disconnected environments inherit all vulnerabilities"
    severity: "HIGH"
    effort: "4-6 hours"
  - title: "No CODEOWNERS or branch protection"
    impact: "Anyone with write access can push directly; no review enforcement"
    severity: "MEDIUM"
    effort: "1-2 hours"
quick_wins:
  - title: "Add YAML lint CI workflow"
    effort: "1-2 hours"
    impact: "Catch malformed YAML before merge — prevents disconnected environment failures"
  - title: "Add image digest verification workflow"
    effort: "2-3 hours"
    impact: "Verify all referenced image digests actually exist in their registries"
  - title: "Add CODEOWNERS file"
    effort: "30 minutes"
    impact: "Enforce review requirements for image reference changes"
  - title: "Add YAML schema validation"
    effort: "2-3 hours"
    impact: "Ensure consistent structure across all release branches"
  - title: "Create CLAUDE.md with contribution guidelines"
    effort: "1-2 hours"
    impact: "Guide AI agents and contributors on proper image reference format"
recommendations:
  priority_0:
    - "Implement GitHub Actions workflow to validate YAML syntax and structure on every PR"
    - "Add image digest verification that pulls and validates each referenced image exists"
    - "Add CODEOWNERS file and enable branch protection on release branches"
  priority_1:
    - "Add Trivy/Grype scanning of all referenced images to flag CVEs before merge"
    - "Create a JSON schema for rhoai-disconnected-images.yaml and validate on PRs"
    - "Add automated staleness detection — flag images older than N days or with newer builds available"
  priority_2:
    - "Create agent rules (.claude/rules/) for proper image reference contributions"
    - "Add automated release branch creation workflow"
    - "Implement diff-based PR validation showing which images were added/removed/changed"
---

# Quality Analysis: rhoai-additional-images

## Executive Summary

- **Overall Score: 1.6/10**
- **Repository Type**: Configuration-only — YAML image manifest registry for RHOAI disconnected environments
- **Primary Language**: YAML (no application code)
- **Key Strengths**: Consistent branch-per-release model (rhoai-2.11 through rhoai-3.5); clear purpose; simple, flat structure
- **Critical Gaps**: Zero CI/CD automation; no PR validation; no image verification; no vulnerability scanning; no agent rules
- **Agent Rules Status**: Missing — no CLAUDE.md, .claude/, or contribution guidelines

### Repository Overview

`rhoai-additional-images` stores container image references (as SHA256 digests) for RHOAI components that are not included in the main operator manifests. These are specifically for **disconnected/air-gapped environments** that need to pre-mirror all required images. The repository has:

- **1 file per release branch**: `rhoai-disconnected-images.yaml` (67 lines on rhoai-3.5)
- **159 total commits** across all branches
- **60 merged pull requests**
- **Release branches**: rhoai-2.11 through rhoai-3.5 (plus EA branches)
- **1 open PR** as of analysis date
- **No license file**

## Quality Scorecard

| Dimension | Score | Status |
|-----------|-------|--------|
| Unit Tests | 0/10 | No code exists — YAML-only repository |
| Integration/E2E | 0/10 | No validation that image references are correct or reachable |
| **Build Integration** | **0/10** | **No CI/CD workflows of any kind** |
| Image Testing | 0/10 | No image pull validation, no startup testing, no scanning |
| Coverage Tracking | 0/10 | Nothing to measure — no tests, no code |
| CI/CD Automation | 3/10 | Branch-per-release provides structure; but zero automation |
| Agent Rules | 0/10 | No CLAUDE.md, .claude/ directory, or contribution guidance |

**Weighted Overall: 1.6/10** (weighted: Unit 20%, Integration/E2E 25%, Image Testing 20%, Coverage 15%, CI/CD 20%)

## Critical Gaps

### 1. Zero CI/CD — No GitHub Actions, No PR Checks
- **Impact**: Typos, invalid SHA digests, wrong image names, and malformed YAML all merge without any automated check. Given this repository directly affects disconnected environment deployments, errors here surface only at deployment time in air-gapped environments where debugging is extremely difficult.
- **Severity**: HIGH
- **Effort**: 4-8 hours to implement basic workflow suite
- **Evidence**: No `.github/workflows/` directory exists on any branch. No Makefile, no Jenkinsfile, no CI configuration of any kind.

### 2. No Image Reference Validation
- **Impact**: The core purpose of this repository is listing valid image references. Yet there is no automated check that these digests:
  - Actually exist in their registries (quay.io, registry.redhat.io)
  - Haven't been deleted or garbage-collected
  - Match the expected tag (comments say the tag but the reference is a digest)
  - Are pullable with appropriate credentials
- **Severity**: HIGH
- **Effort**: 4-6 hours (skopeo inspect in CI)

### 3. No YAML Schema Validation
- **Impact**: The YAML structure is ad-hoc — a single top-level key `additional-images:` with a flat list. No schema enforces this structure. Comments are used informally for metadata (image tags, deprecation notices, Jira references) but there's no machine-readable schema.
- **Severity**: HIGH
- **Effort**: 2-3 hours

### 4. No Vulnerability Scanning of Referenced Images
- **Impact**: This repository lists images for disconnected environments. If any referenced image contains known CVEs, those vulnerabilities will be deployed into air-gapped environments where patching is especially difficult. No scanning is performed.
- **Severity**: HIGH
- **Effort**: 4-6 hours (Trivy/Grype scanning workflow)

### 5. No CODEOWNERS or Branch Protection
- **Impact**: Anyone with write access can push directly to release branches. There's no enforced review requirement. For a repository that directly impacts production disconnected deployments, this is a significant governance gap.
- **Severity**: MEDIUM
- **Effort**: 1-2 hours

### 6. No Documentation Beyond README
- **Impact**: The README is a single sentence: "To store additional RHOAI images which are not being refernced in the manifests" (with a typo). There's no contribution guide, no format specification, no process documentation for adding/removing images.
- **Severity**: MEDIUM
- **Effort**: 2-3 hours

## Quick Wins

### 1. Add YAML Lint CI Workflow (1-2 hours)
Catch malformed YAML before merge.

```yaml
# .github/workflows/yaml-lint.yml
name: YAML Lint
on: [pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: YAML Lint
        uses: ibiqlik/action-yamllint@v3
        with:
          file_or_dir: '*.yaml'
          config_data: |
            extends: default
            rules:
              line-length: disable
              truthy: disable
```

### 2. Add Image Digest Verification (2-3 hours)
Verify all referenced image digests actually exist.

```yaml
# .github/workflows/verify-images.yml
name: Verify Image Digests
on: [pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install skopeo
        run: sudo apt-get install -y skopeo
      - name: Verify digests
        run: |
          grep -oP '^\s*-\s+\K\S+@sha256:\S+' rhoai-disconnected-images.yaml | while read img; do
            echo "Checking $img..."
            skopeo inspect --no-tags "docker://$img" > /dev/null 2>&1 || {
              echo "::error::Image not found: $img"
              exit 1
            }
          done
```

### 3. Add CODEOWNERS (30 minutes)
Enforce review requirements.

```
# CODEOWNERS
* @red-hat-data-services/rhoai-release-team
```

### 4. Add YAML Schema (2-3 hours)
Ensure consistent structure.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["additional-images"],
  "properties": {
    "additional-images": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[a-z0-9.-]+/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$"
      }
    }
  },
  "additionalProperties": false
}
```

### 5. Create CLAUDE.md (1-2 hours)
Guide AI agents and contributors.

```markdown
# CLAUDE.md — rhoai-additional-images

## Purpose
This repository stores additional RHOAI container image references (by SHA digest)
for disconnected/air-gapped environment deployments.

## Structure
- One release branch per RHOAI version (e.g., rhoai-3.5)
- Each branch contains `rhoai-disconnected-images.yaml`
- Images are listed as `registry/repo@sha256:digest`

## Contribution Rules
- Always use full SHA256 digest, never floating tags
- Add a comment above each image with the human-readable tag
- Reference the Jira issue in commit messages
- Target the correct release branch (never merge to main)
```

## Detailed Findings

### CI/CD Pipeline
**Status: Non-existent**

There are zero CI/CD configuration files anywhere in the repository. No `.github/workflows/`, no `Makefile`, no `Jenkinsfile`, no `.gitlab-ci.yml`. Pull requests merge without any automated validation.

The branch-per-release model (rhoai-2.11 through rhoai-3.5, plus EA branches like rhoai-3.4-ea.1) provides organizational structure, but there is no automation around branch creation, image validation, or release processes.

### Test Coverage
**Status: Not applicable (no code) — but validation tests are critically missing**

While there is no application code to test, this repository would greatly benefit from validation tests:
- **YAML syntax validation** — ensures the file parses correctly
- **Schema validation** — ensures the structure matches expectations
- **Digest format validation** — ensures all entries are valid `registry/repo@sha256:hex` format
- **Registry reachability** — ensures referenced images actually exist
- **Duplicate detection** — ensures no image is listed twice
- **Staleness detection** — flags images that may have newer builds available

### Code Quality
**Status: Minimal**

- No linting configuration for YAML files
- No pre-commit hooks
- No `.editorconfig` or formatting standards
- Comments within `rhoai-disconnected-images.yaml` are inconsistent:
  - Some images have Jira references (e.g., `RHOAIENG-37682`)
  - Some have tag mappings (e.g., `quay.io/modh/ray:2.52.1-py311-cu121`)
  - Some have deprecation notices
  - Some have future action TODOs
  - Many have no comments at all

### Container Images
**Status: This IS the container image manifest — but no validation exists**

The entire purpose of this repository is maintaining container image references. The latest branch (rhoai-3.5) lists approximately 50+ images from:
- `quay.io/modh/` — Ray, FMS HF Tuning images
- `registry.redhat.io/rhoai/` — Workbench (Jupyter, CodeServer), Pipeline Runtime images

Image categories observed:
- **Ray runtime images** — CUDA and ROCm variants (multiple Python/Ray/CUDA versions)
- **FMS HF Tuning** — Fine-tuning images
- **Workbench images** — Jupyter notebooks, CodeServer (CPU, CUDA, ROCm)
- **Pipeline runtime images** — Data science, PyTorch, TensorFlow (CPU, CUDA, ROCm)

**No validation exists** for any of these image references.

### Security
**Status: Non-existent**

- No vulnerability scanning (Trivy, Grype, Snyk) of referenced images
- No secret detection
- No SBOM generation
- No image signing verification
- No CODEOWNERS file
- No branch protection visible
- For a repository that affects air-gapped deployments, this is a significant security gap

### Agent Rules (Agentic Flow Quality)
**Status: Missing**

- No `CLAUDE.md` or `AGENTS.md` in root
- No `.claude/` directory
- No `.claude/rules/` for contribution rules
- No `.claude/skills/` for custom skills
- No testing documentation
- **Recommendation**: Generate contribution rules with `/test-rules-generator` — even for YAML-only repos, agent rules can enforce proper format, digest validation patterns, and branch targeting

## Recommendations

### Priority 0 (Critical)

1. **Implement GitHub Actions workflow suite for PR validation**
   - YAML syntax linting
   - Schema validation against a defined JSON schema
   - Digest format validation (regex check for `registry/repo@sha256:64-hex-chars`)
   - Duplicate entry detection
   - Diff-based summary showing what images were added/removed/changed

2. **Add image digest verification CI**
   - Use `skopeo inspect` to verify each referenced digest exists in its registry
   - Run on PRs and periodically (weekly) to catch deleted/garbage-collected images
   - Report which images are unreachable

3. **Enable branch protection on all release branches**
   - Require at least 1 approval
   - Require status checks to pass
   - Add CODEOWNERS file

### Priority 1 (High Value)

4. **Add vulnerability scanning for all referenced images**
   - Weekly Trivy/Grype scan of every listed image
   - Alert on CRITICAL/HIGH CVEs
   - Especially important since these images go to disconnected environments where patching is harder

5. **Create a JSON schema for the YAML format and validate on PRs**
   - Define the expected structure
   - Validate image reference format
   - Validate comment conventions (tag mappings, Jira references)

6. **Add automated staleness detection**
   - Flag images that have newer builds available in the same tag series
   - Flag images where the corresponding tag has moved to a different digest
   - Run weekly as a scheduled workflow

7. **Improve documentation**
   - Expand README with purpose, structure, and contribution process
   - Document the branch-per-release strategy
   - Document the image categories and which team owns each

### Priority 2 (Nice-to-Have)

8. **Create agent rules (`.claude/rules/`) for proper contributions**
   - Format rules for image references
   - Branch targeting rules (which release branch to target)
   - Comment conventions (tag mapping, Jira references, deprecation notices)

9. **Add automated release branch creation workflow**
   - When a new RHOAI version is tagged, automatically create the release branch
   - Copy the previous release's image list as a starting point
   - Open a PR for review

10. **Implement diff-based PR annotation**
    - Show a clear summary of which images were added, removed, or updated
    - Highlight digest changes with the corresponding tag changes
    - Flag potential issues (e.g., downgrading an image version)

11. **Add image metadata enrichment**
    - Automatically fetch and display image size, creation date, and OS/arch
    - Show CVE counts for each image
    - Make PR reviews more informed

## Comparison to Gold Standards

| Dimension | rhoai-additional-images | odh-dashboard | notebooks | kserve |
|-----------|------------------------|---------------|-----------|--------|
| CI/CD Workflows | None | 15+ workflows | 10+ workflows | 20+ workflows |
| PR Validation | None | Lint, test, build | Lint, test, build | Lint, test, coverage |
| Image Validation | None | Build & test images | 5-layer validation | Build & push |
| Schema Validation | None | TypeScript strict | Notebook spec validation | CRD validation |
| Vulnerability Scanning | None | Snyk, CodeQL | Trivy scanning | Trivy, CodeQL |
| Branch Protection | Unknown | Enforced | Enforced | Enforced |
| CODEOWNERS | None | Present | Present | Present |
| Agent Rules | None | Comprehensive | Basic | None |
| Documentation | 1-line README | Extensive | Good | Extensive |

## File Paths Reference

### Repository Structure (rhoai-3.5 branch)
```
rhoai-additional-images/
├── README.md                           # 1-line description
└── rhoai-disconnected-images.yaml      # 67 lines, ~50+ image references
```

### Key Observations
- **main branch**: Only contains README.md (initial commit)
- **Release branches** (rhoai-2.11 through rhoai-3.5): Each contains README.md + rhoai-disconnected-images.yaml
- **EA branches** (rhoai-3.4-ea.1, rhoai-3.5-ea.1, etc.): Early-access release branches
- **Patch branches** (moulalis-patch-*, cherry-pick, etc.): Contributor working branches

### Missing Files (Expected for a repo of this purpose)
- `.github/workflows/` — No CI/CD
- `CODEOWNERS` — No ownership enforcement
- `schema.json` — No YAML schema
- `.yamllint.yml` — No YAML linting config
- `CLAUDE.md` — No agent guidance
- `.claude/rules/` — No contribution rules
- `CONTRIBUTING.md` — No contribution guide
- `LICENSE` — No license file
