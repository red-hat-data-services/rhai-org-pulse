# Code Review Criteria

This file defines the review criteria for all code reviews — automated (CI) and
manual (local `/pr-review` command). All reviewers (human or AI) should apply
these criteria consistently.

## Hard constraints

Read the "Hard Constraints" section in `AGENTS.md` at the repo root. Those
constraints are the authoritative source — this file does not duplicate them.
Flag any violation as a **blocking issue**.

You have full Edit and Write access to all files in the repo.

## Review checklist

1. **Security** — OWASP top 10 vulnerabilities: injection (SQL, command, XSS),
   broken auth, sensitive data exposure, insecure deserialization, etc. Pay
   special attention to user input handling, API boundaries, and secrets.

2. **Correctness** — Bugs, logic errors, off-by-one errors, unhandled edge
   cases, race conditions, null/undefined access, and incorrect assumptions
   about data shape or API behavior.

3. **Code quality** — Readability, maintainability, appropriate abstraction
   level. Flag unnecessary complexity, dead code, or misleading names. Prefer
   clarity over cleverness.

4. **Project conventions** — Adherence to all conventions in `AGENTS.md`
   (code style, module structure, import style, testing, etc.). If you haven't
   already, read `AGENTS.md` now.

5. **Performance** — Unnecessary re-renders, N+1 queries, unbounded data
   fetching, missing pagination, expensive operations in hot paths, memory
   leaks (event listeners, timers not cleaned up).

6. **API documentation** — Every new or modified Express route handler must
   have an `@openapi` JSDoc annotation. The CI `validate:openapi` step
   enforces a minimum operation count; adding a route without its annotation
   will cause the build to fail.

## Integration Test Coverage Validation

As part of the pull request review, you must actively assess whether the developer has introduced module changes that mandate integration test verification.

### 1. Integration Testing Triggers

Evaluate the file diff paths. A pull request **requires an integration test** if changes are made to files within the `modules/` directory:

- **Module Views:** Structural changes within `modules/*/views/` or `modules/*/components/` that combine multiple data sources, implement multi-step workflows, or render complex interactive UI (charts, tables with filtering/sorting, forms with validation).

- **Module Server Routes:** Any new or modified route files within `modules/*/server/` (e.g., `modules/releases/server/planning/routes.js`, `modules/ai-impact/server/assessments/routes.js`) that implement non-trivial business logic, data aggregation, or stateful operations.

- **Module Server Logic:** Changes to module-specific server files that fetch/transform data from external services (Jira Cloud API, GitHub GraphQL, GitLab GraphQL), implement domain calculations, or orchestrate multi-step operations.

### 2. Validation & Enforcement Workflow

1. **Locate matching tests:** Verify if the PR diff updates or supplements appropriate test modules under `tests/integration/<module>.spec.js` that cover integrated workflow journeys for the modified module.

2. **Flag Non-Compliance:** If any files within `modules/` were changed but **no matching integration test** is detected in the diff:
   - Generate a critical alert banner in the review output: **`⚠️ Missing Integration Test Warning`**.
   - Explicitly highlight which module files were modified without verification (e.g., *"You modified data fetching logic inside `modules/releases/server/planning/routes.js` without corresponding integration assertions"* or *"You added a new view in `modules/ai-impact/views/` without integration test coverage"*).
   - Instruct the developer to add integration test in `tests/integration/<module>.spec.js` that verifies:
     - Module is visible and clickable in sidebar
     - Module views load correctly without errors
     - Module content renders (buttons, inputs, tables, cards)
     - API endpoints return expected data structure
     - Interactive workflows complete successfully
   - Provide a minimal Playwright test snippet when possible (e.g., basic navigation test, API response validation).

3. **Exceptions:** Do not require integration tests for module changes that are:
   - Pure UI/styling changes (CSS, Tailwind classes) with no logic modifications
   - Documentation-only updates (comments, JSDoc, README)
   - Simple configuration changes (module.json metadata updates with no behavioral impact)
   - Trivial refactorings that don't change behavior (renaming variables, extracting constants)

## Verdict rules

When used in CI, the reviewer populates a structured JSON output with two fields:
`verdict` (`"PASS"` or `"FAIL"`) and `unfixed_blocking_issues` (an array of
objects with `category` and `description`). The verdict is based on the **final
state of the PR** after any autofixes, not on whether you attempted a fix.

Set `verdict` to `"FAIL"` if ANY of the following remain unfixed in the final
PR state:
- Security vulnerabilities
- Bugs that will cause runtime errors
- Breaking changes
- Violations of any hard constraint defined in `AGENTS.md`

List every unfixed blocking issue in `unfixed_blocking_issues` with a `category`
(e.g. `"hard-constraint-7"`, `"security"`, `"bug"`, `"breaking-change"`) and a
`description` of the issue.

Set `verdict` to `"PASS"` with an empty `unfixed_blocking_issues` array only
when none of the above remain. Minor suggestions, style nits, and issues you
successfully fixed via autofix are fine to pass.

Do not rationalize a PASS by claiming you were unable to fix an issue. If a
blocking issue exists that you cannot fix (e.g. write-protected files), the
verdict is still FAIL — the PR author must fix it themselves.

## Review tone

- Be concise. Focus on actionable feedback.
- Don't nitpick style unless it impacts readability.
- Only flag issues you're confident about. If something is ambiguous or
  subjective, frame it as a suggestion, not a blocker.
- Don't comment on files outside the scope of the PR unless they're directly
  affected (e.g., a missing import).
