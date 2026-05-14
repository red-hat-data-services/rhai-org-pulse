# Code Review Criteria

This file defines the review criteria for all code reviews — automated (CI) and
manual (local `/pr-review` command). All reviewers (human or AI) should apply
these criteria consistently.

## Hard constraints (from AGENTS.md)

These are non-negotiable. Flag any violation as a blocking issue.

1. **No cross-module imports** — Modules import only from `@shared`. Cross-module
   data access uses `readFromStorage()` (for exported files in `module.json >
   export.files`) or API calls. Never `import from '../../../modules/other-module'`.

2. **Storage abstractions only** — All data file access must use
   `readFromStorage` / `writeToStorage`. No raw `fs.readFileSync` or
   `path.join(__dirname, '../../data/...')` for data files.

3. **App is a display layer** — The app should not perform significant
   computation. Complex aggregations, bulk data processing, ML scoring, or
   data enrichment belong in external processes that push results via bulk
   API endpoints. Flag any PR that adds heavy computation to the backend.

4. **New pages in existing modules** — New views should go in an existing module
   if the domain overlaps. Only create a new module when it has a genuinely
   distinct domain. If a PR adds a new module, verify there is no existing
   module where the feature fits.

5. **No TypeScript** — Plain JavaScript only. CommonJS for server, ES modules
   for frontend.

6. **OpenAPI annotations required** — Every new or modified route handler needs
   an `@openapi` JSDoc annotation. CI enforces this.

7. **Documentation in sync** — Documentation changes must land in the same PR
   as the code they describe:
   - Data format changes → update `docs/DATA-FORMATS.md` and `fixtures/`
   - New shared exports → update `shared/API.md`
   - Module system changes → update `docs/MODULES.md`
   - API route changes → update the API Routes section in `.claude/CLAUDE.md`

   You have full Edit and Write access to all files in the repo, including
   `.claude/CLAUDE.md`. If a PR adds, modifies, or removes API endpoints,
   update the API Routes section yourself as part of your autofix.

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

4. **Project conventions** — Adherence to the conventions in `AGENTS.md`:
   module structure, import style (ESM frontend, CJS backend), `<script setup>`
   for Vue components, Tailwind for styling, test coverage for changed logic.

5. **Performance** — Unnecessary re-renders, N+1 queries, unbounded data
   fetching, missing pagination, expensive operations in hot paths, memory
   leaks (event listeners, timers not cleaned up).

6. **API documentation** — Every new or modified Express route handler must
   have an `@openapi` JSDoc annotation. The CI `validate:openapi` step
   enforces a minimum operation count; adding a route without its annotation
   will cause the build to fail.

## Verdict rules

When used in CI, the reviewer writes a verdict file (`echo "PASS" > .claude-review-result`
or `echo "FAIL" > .claude-review-result`). The verdict is based on the **final
state of the PR** after any autofixes, not on whether you attempted a fix.

Use **FAIL** if ANY of the following remain unfixed in the final PR state:
- Security vulnerabilities
- Bugs that will cause runtime errors
- Breaking changes
- Violations of any hard constraint listed above

Use **PASS** only when none of the above remain. Minor suggestions, style nits,
and issues you successfully fixed via autofix are fine to pass.

Do not rationalize a PASS by claiming you were unable to fix an issue. If a
blocking issue exists, the verdict is FAIL regardless of the reason it wasn't
fixed.

## Review tone

- Be concise. Focus on actionable feedback.
- Don't nitpick style unless it impacts readability.
- Only flag issues you're confident about. If something is ambiguous or
  subjective, frame it as a suggestion, not a blocker.
- Don't comment on files outside the scope of the PR unless they're directly
  affected (e.g., a missing import).
