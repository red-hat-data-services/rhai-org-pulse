# Code Review Criteria

This file defines the review criteria for all code reviews — automated (CI) and
manual (local `/pr-review` command). All reviewers (human or AI) should apply
these criteria consistently.

## Hard constraints

Read the "Hard Constraints" section in `AGENTS.md` at the repo root. Those
constraints are the authoritative source — this file does not duplicate them.
Flag any violation as a **blocking issue**.

You have full Edit and Write access to all files in the repo, including
`.claude/CLAUDE.md`. If a PR adds, modifies, or removes API endpoints, update
the API Routes section in `.claude/CLAUDE.md` yourself as part of your autofix
(Hard Constraint #7 in AGENTS.md).

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
