# Technical Debt Remediation Plan

*Org Pulse — Prioritised cleanup roadmap*

Giulia Naponiello | 7th July 2026 — updated 8th July 2026

---

## Contents

1. [The Landscape](#1-the-landscape)
2. [Consolidate the Jira Client](#2-consolidate-the-jira-client)
3. [Finish the Deprecated-Globals Migration](#3-finish-the-deprecated-globals-migration)
4. [Close the Test Coverage Gaps](#4-close-the-test-coverage-gaps)
5. [Break Up the Monoliths](#5-break-up-the-monoliths)
6. [Tighten CI and Linting](#6-tighten-ci-and-linting)
7. [Housekeeping and Dead Code](#7-housekeeping-and-dead-code)
8. [Suggested Sequencing](#8-suggested-sequencing)

---

## 1. The Landscape

Org Pulse has grown quickly from a single-module team tracker into a five-module dashboard with integrations across Jira, GitHub, GitLab, Google Sheets, and more. Most of the codebase is healthy — the module system enforces good boundaries, the shared client/server split is clean, and CI catches real problems. But copy-paste expediency, incomplete migrations, and rapid feature work have left behind debt in a few specific areas. None of it is an urgent fire, but each item makes the next feature harder to build and the next bug harder to diagnose. This document proposes a prioritised plan for working through it.

## 2. Consolidate the Jira Client

We currently have three independent implementations of a Jira REST client: the canonical shared factory, a standalone copy in team-tracker's RFE handling, and yet another in customer-insights. Each has its own auth setup, retry logic, and rate-limit handling. When we fix a bug in one — say, a retry edge case — the fix doesn't reach the other two.

The proposed fix is straightforward: migrate the two module-level clients to the shared factory, move any useful utilities (like customer-insights' Markdown-to-ADF converter) into the shared library, and remove the duplicate code. The shared module itself also needs an internal cleanup — it currently maintains both a deprecated global function and the factory, with the same retry logic duplicated between them.

To prevent this pattern from recurring, we'll add ESLint enforcement that flags any module code creating standalone Jira clients instead of using the shared factory with `context.secrets`. This builds on the existing `no-module-process-env` rule that already prevents modules from reading secrets directly from `process.env`.

## 3. Finish the Deprecated-Globals Migration

Beyond the Jira client, several other shared server modules — Google Sheets, backup, Smartsheet — still export deprecated global functions alongside their newer factory-based replacements. The factories exist and work; the callers were just never updated.

Each of these is the same shape of work: update the one or two call sites, verify with existing tests, delete the deprecated export. The `node-fetch` dependency falls into the same category — the project requires Node 22 which has native `fetch`, so the last remaining import can switch over and the dependency can be dropped.

## 4. Close the Test Coverage Gaps

Three modules — customer-insights, OKR Hub, and system-health — have effectively no test coverage. A handful of shared server utilities (storage, backup, team migration) are also untested despite handling production data transformations where a silent bug could corrupt team structures.

The goal is not 100% coverage everywhere; it's to cover the paths that matter. For customer-insights, that means the CRUD routes most likely to break during refactors. For OKR Hub, the priority depends on whether we treat it as a finished module or an early prototype — right now it renders hardcoded mock data with no persistence, so the question is whether to test what exists or finish building it first. For the shared utilities, the team migration logic is the riskiest gap.

## 5. Break Up the Monoliths

Two server files have grown well past what anyone can comfortably navigate. The team-tracker server index is nearly 5,000 lines — the original entry point from before the module system existed, still handling everything from roster sync to GitHub stats in one place. The main dev server is similarly oversized with dozens of route definitions inline. Both would benefit from being split into focused route files, following the pattern that newer modules already use.

A few Vue components on the frontend side are also over 1,000 lines, but these are lower priority — large components don't carry the same risk as large server files with shared mutable state. The approach would be incremental: extract one route group at a time, verify with existing tests, repeat. Each PR stays small enough to review confidently.

## 6. Tighten CI and Linting

CI runs lint, tests, and build on every PR, which is solid — but there are gaps in what those checks actually enforce. The linter doesn't ban `var` or enforce `prefer-const`, so the 1,200 stale `var` declarations mentioned later aren't just a style problem; they'll keep coming back unless we add the rule. The custom cross-module-import ESLint rule has a hardcoded list of known module slugs that's missing three newer modules, so cross-module violations targeting those modules slip through silently.

The integration test workflow is path-filtered per module, but newer modules like customer-insights and OKR Hub were never added to the filter list, meaning their integration tests (if written) would never actually run.

Most critically, we need to prevent the Jira client consolidation problem from recurring. Currently, modules can create their own standalone Jira clients (like customer-insights and team-tracker did) because ESLint only catches cross-module imports, not reimplementation of shared utilities. We should add a custom ESLint rule that flags any module code creating new Jira clients outside of the approved patterns — either `createJiraClient` calls that don't use `context.secrets`, or custom client implementations that duplicate shared functionality.

The fixes here are small but high-leverage: enable `no-var` and `prefer-const` in the ESLint config, update the module slug list in the cross-module rule, add the new Jira client enforcement rule, and make sure every module has a filter entry in the integration test workflow.

## 7. Housekeeping and Dead Code

Once the `no-var` ESLint rule from the previous section is enabled, a one-time bulk fix would clean up the existing violations so the rule can be enforced cleanly going forward.

## 8. Suggested Sequencing

Ordered by risk reduction first, effort second. The Jira consolidation comes first because divergent auth and retry logic is the kind of duplication where a bug fix in one copy never reaches the others. The deprecated-globals migration and CI/linting tightening follow naturally — both are mechanical and quick, and clearing them out means the test-writing in Phase 3 won't target code that's about to change or miss regressions the linter should catch. The file splits and housekeeping are last because they improve quality of life without reducing production risk.

| Phase | Work |
|-------|------|
| **Phase 1** | Consolidate Jira clients, remove duplicated retry logic |
| **Phase 2** | Migrate deprecated globals, drop `node-fetch`, tighten ESLint rules including Jira client enforcement |
| **Phase 3** | Add tests for untested modules and shared utilities |
| **Phase 4** | Split oversized server files into focused route modules |
| **Phase 5** | Bulk `var` fix to match new lint rule |

Each phase is independently valuable and can be interleaved with feature work.

---

*AIPCC Productization — Internal use only*
