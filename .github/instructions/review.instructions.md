# Code Review Criteria

This file defines the review criteria for all code reviews — automated (CI) and
manual (local `/pr-review` command). All reviewers (human or AI) should apply
these criteria consistently.

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

4. **Project conventions** — Adherence to the conventions in `AGENTS.md` and
   `.claude/CLAUDE.md`: module structure, import style (ESM frontend, CJS
   backend), `<script setup>` for Vue components, Tailwind for styling, test
   coverage for changed logic.

5. **Performance** — Unnecessary re-renders, N+1 queries, unbounded data
   fetching, missing pagination, expensive operations in hot paths, memory
   leaks (event listeners, timers not cleaned up).

## Review tone

- Be concise. Focus on actionable feedback.
- Don't nitpick style unless it impacts readability.
- Only flag issues you're confident about. If something is ambiguous or
  subjective, frame it as a suggestion, not a blocker.
- Don't comment on files outside the scope of the PR unless they're directly
  affected (e.g., a missing import).
