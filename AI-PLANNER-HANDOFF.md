# AI Planner — working notes

Written 2026-10-06 for whoever picks this up next, including a smaller model.
Everything here was learned the hard way in this repo; none of it is generic advice.

---

## 1. How to work on this codebase

### Verify before you build

The single most expensive mistake available here is diagnosing by inference.
Three wrong diagnoses in a row on the 3.7 bug cost three PRs and most of a day;
the actual cause was found in one command once real data was in hand.

Before writing a fix, produce evidence the diagnosis is right. A `grep`, a count,
a date simulation. If you are explaining *why* something might be broken rather
than running something that proves it, stop and run the thing.

### Measure the blast radius before shipping a rule

Asked to make missing PM a hard failure, the right move was to count first:
**100% of 495 features** would have failed, which makes the signal useless. That
measurement changed the design. Any rule that gates or scores features should be
run against the real dataset before it ships.

### The number is usually the tell

The planner showed `1148 features`. The embedded `SAMPLE` constant has exactly
1148 rows. That one match identified the bug after days of looking elsewhere.
When something looks plausible but wrong, check whether the count matches a
different source than you think you are reading.

### Separate "we broke it" from "the world changed"

Two failures here had nothing to do with any commit:

- CVE tests passed on 29 Sept and failed on 30 Sept — fixtures with hardcoded
  dates that expired.
- CI went red on every branch at 15:58 on 6 Oct — npm advisories published that
  afternoon against an unchanged lockfile.

Before hunting for the commit that broke something, check whether anything
actually changed. `git log` on the failing path, and compare a passing run's
timestamp with the first failing one.

### Guards hide causes

A `try/catch` added to stop a broken render also hid the exception for days. If
you add a fallback, make the fallback **visible** — the planner now prints
`(demo data)` next to the count when it is running on the embedded sample.

### Own regressions immediately

The PM object bug was mine. Saying so plainly and fixing it at both ends took
ten minutes. Defending it would have cost more.

### Do not route around a block

If a sandbox or permission refuses an action, stop and explain. Twice here the
refusal was pointing at a genuinely bad idea, and reframing the requirement
produced a smaller, better change.

---

## 2. Repo map — the parts that matter

Read `AGENTS.md` first. Its hard constraints are enforced in review:

1. **No cross-module imports.** Modules import only from `@shared`. Cross-module
   reads go through `readFromStorage()`.
2. **Always use storage abstractions.** Never construct filesystem paths.
3. **The app is a display layer, not a compute engine.** Heavy computation belongs
   in an external pipeline that pushes results in. This rule is why Plan Approval
   candidates come from GitLab rather than being computed in-app.
7. **Every route needs an `@openapi` annotation.** CI enforces a minimum count.

To find a route, `grep -rn "@openapi" modules/<slug>/server/`.

### The planner is two separate things

| | Where | What |
|---|---|---|
| **AI Planner tab** | `public/ai-first-scheduler/index.html` | One large static HTML file. Plain JS, **no Vue**. Talks to the parent via `postMessage`. |
| **Vue wrapper** | `modules/releases/client/plan/views/AIPlanner.vue` | Hosts the iframe, handles `add-to-draft-plan`. |

The iframe is self-contained. Framework and dependency changes in the app do not
reach it. It has its own embedded `SAMPLE` dataset used when live data fails.

Live data: `GET /api/modules/releases/planning/ai-planner` →
`modules/releases/server/planning/ai-planner/routes.js` → `buildFeatureReadiness`.
~1215 features. Check `metadata.source` is `"live"`.

### Plan Approval

- Module: `modules/releases/server/draft-plans/`
- Storage prefix: `releases/draft-plans`
- Pipeline drafts: `drafts/<product>/<version>.json` — editable
- Catalog entries from `<product>/release-plan.json` — **read-only labels**
- Demo fixture: `modules/releases/server/draft-plans/fixtures/draft-3.6-demo.json`

**The demo fixture loads in production.** `loadDemoFixture()` is not gated on
`DEMO_MODE`. That is why the only editable 3.6 cycle is labelled `(demo)`, with
464 candidates dated 2026-09-15, all 3.6. This surprised everyone; do not assume
Plan Approval is showing pipeline data.

**The Cycle dropdown is computed, not configured.** `availableTargetVersions` in
`useDraftPlans.js` derives from `candidates[].targetVersions`. Put a feature with
a 3.8 target version into a plan and `3.8 GA RHOAI RELEASE` appears on its own.
No per-release work is ever needed.

### Gotchas that cost time

- **`npm install` breaks the workspace.** Always follow with `npm run setup`,
  which symlinks `@org-pulse/core`. Without it 49 test files fail on a require.
- **`fixtures/**` triggers no CI.** The path filters cover `modules/**` and
  `tests/integration/**`. A fixture change runs nothing — main was silently
  broken for weeks this way.
- **`/package.json` is owned by `@accorvin`** in CODEOWNERS. Touching it trips the
  Ownership Gate.
- **Jira fields arrive in two shapes.** `PM` is sometimes `{displayName}` and
  sometimes a bare string. Coerce defensively; this caused a multi-day outage.
- **`git fetch` then `--force-with-lease` is not safe.** Fetching refreshes the
  lease, so the force succeeds and overwrites commits you never saw. A bot pushes
  fixes to branches here.

---

## 3. Workflow

```bash
npm install && npm run setup   # setup is not optional
npm run lint                   # must be clean
npm test                       # 326 files, ~6079 tests, ~45s
npm run build                  # catches bundling problems
```

Branch from `origin/main`. One PR per concern — a dependency fix and a feature
fix should never share a PR. PR descriptions should lead with the cause, not the
change. State what was *not* verified.

Commit messages: explain why the old behaviour was wrong, in prose. End with the
attribution lines the session specifies.

---

## 4. Where the AI Planner stands

**Working:** live data (1215 features, 321 in-plan); 3.7 visible and filterable;
honest FPDoR risk signals; PM filter defaults to the signed-in user; filters
survive tab switches; Add to Plan lands features under the matching cycle.

**In flight:**
- **#1709** — lets the planner inject features into Plan Approval. This is the
  3.7 fix. `Add to Plan` previously only ticked `approved` on a candidate the
  pipeline had already published, so 3.7 could never work.
- **#1710** — clears the npm advisories blocking every branch. Merge first.

**Known open:**
- Jira's Product Manager field is not reaching us for some features (e.g.
  RHAISTRAT-1711 shows unowned). Upstream sync issue, not the UI.
- `fixtures/**` runs no CI.
- The katex override in #1710 should be removed once mermaid widens its range.

**Dates that matter:**
- **7 Oct** — 3.7 EA: AI Scheduler available for review
- **12 Oct** — Planning Office Hours, feedback Q&A
- **19 Oct** — 3.7 EA planning check-in
- **22 Oct** — exec review of recommendations
- **23 Oct** — 3.7 EA planning freeze

### CVE capacity — agreed direction

From the 6 Oct sync with Arjay:

- Reduce team capacity by **historical CVE throughput** rather than trying to
  predict individual fixes.
- **Org Pulse is the source of truth** for that baseline.
- Rough shape discussed: 20–40% of capacity reserved for bugs and CVEs combined.
- Capacity per team = weighted sum across its components, from historical Jira
  CVE data.

Context: the backlog jumped 6,000 → 8,500 in days because a new scanner
(`tracker auto manager`) landed. AI tooling reports ~10× the vulnerabilities but
only ~1% are real — the absolute number of real ones still rises. There are
~8,552 open issues but only **308 unique CVEs**, and nobody yet knows whether
engineering resolves issues or underlying CVEs. That distinction decides the unit
of measure.

Open questions for Doug Helman: is CVSS the only unit? Should a team with many
low-severity CVEs be measured like one with a few critical ones?

Next: Arjay aggregates historical CVE throughput by component; Yuval talks to
Doug about thresholds and units; then fold the result into capacity.

---

## 5. Cost

Context is re-sent every turn, so a long session where topics pile up costs far
more per turn than a short one. **`/clear` between unrelated tasks** is the single
biggest saving — a quarterly-review question does not need the vLLM and CI
history loaded.

Paste evidence early. One API response ended a multi-day hunt. Prefer a file path
over inline JSON for anything large.
