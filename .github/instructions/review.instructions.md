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
   (code style, module structure, import style, testing, etc.) and
   `docs/MODULES.md` (module-specific requirements including secrets, export
   hooks, and the PR checklist). If you haven't already, read both now.

5. **Performance** — Unnecessary re-renders, N+1 queries, unbounded data
   fetching, missing pagination, expensive operations in hot paths, memory
   leaks (event listeners, timers not cleaned up).

6. **API documentation** — Every new or modified Express route handler must
   have an `@openapi` JSDoc annotation. The CI `validate:openapi` step
   enforces a minimum operation count; adding a route without its annotation
   will cause the build to fail.

## Test Coverage Validation

As part of the pull request review, you must actively assess whether the
developer has introduced module changes that mandate integration test
verification. A test file merely existing is not sufficient: the test must
exercise the behavior changed by the pull request at the appropriate boundary.

### 1. Integration Testing Triggers

Evaluate the file diff paths. A pull request **requires an integration test** if changes are made to files within the `modules/` directory:

- **Module Views:** Structural changes within `modules/*/views/` or `modules/*/components/` that combine multiple data sources, implement multi-step workflows, or render complex interactive UI (charts, tables with filtering/sorting, forms with validation).

- **Module Server Routes:** Any new or modified route files within `modules/*/server/` (e.g., `modules/releases/server/planning/routes.js`, `modules/ai-impact/server/assessments/routes.js`) that implement non-trivial business logic, data aggregation, or stateful operations.

- **Module Server Logic:** Changes to module-specific server files that fetch/transform data from external services (Jira Cloud API, GitHub GraphQL, GitLab GraphQL), implement domain calculations, or orchestrate multi-step operations.

### 2. Required review procedure

For every affected module, build a short coverage map before setting the
verdict:

1. Identify each changed functional path (view, route, server logic, external
   client, configuration, or runtime dependency).
2. Locate the exact test and assertion that covers each path. A test file name
   alone is not evidence.
3. Classify the coverage correctly:
   - **UI/fixture coverage** may mock module API responses and is sufficient for
     UI-only behavior.
   - **Backend coverage** must load the module server entry and exercise the
     changed module API route or server behavior without intercepting that
     route in the browser/client test.
4. Report missing or insufficient coverage with the affected path and the
   missing test boundary, not a generic request to “add tests”.

### 3. Backend and external-service changes

For a new module, or a change to `modules/<slug>/server/**`, a module's
runtime configuration, or an external-service client:

- Require at least one test that covers the module's server registration or an
  actual module API route. A fully mocked frontend test does not satisfy this
  requirement.
- Treat a blanket interception such as
  `page.route('**/api/modules/<slug>/**', ...)` as **UI/fixture coverage only**.
  It does not verify server registration, route behavior, runtime imports,
  configuration wiring, or external-client behavior.
- When an external dependency is introduced or changed, verify that its error
  handling and configuration path have a test at the server/client boundary.
  Also verify that a newly introduced runtime `require()` or `import` package
  is declared as a direct production dependency rather than relying on a
  transitive dependency.

### 4. Enforcement

If a changed path that requires coverage has no appropriate test, or only has
UI/fixture coverage where backend coverage is required, add an unfixed blocking
issue with category `test-adequacy`. This applies even when a file under
`tests/integration/` changed and its assertions pass.

Explain the exact missing boundary, for example: *"The new
`workflow-validation` server route is covered only by a Playwright test that
intercepts every module API request; no test loads the server route or verifies
its OpenSearch client/configuration behavior."*

### 5. Exceptions

Do not require new integration tests for module changes that are:
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
- Insufficient test coverage for a changed path that requires coverage under
  **Test Coverage Validation** (`test-adequacy`)

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
