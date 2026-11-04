# AI Planner — Data Routes Audit

Audit of every data source feeding the AI Planner tab (Releases → Plan → AI Planner),
requested by Saiesh Prabhu (Nov 3 2026 stabilization meeting, action item "Audit Data
Routes"). The AI Planner is a static HTML file (`public/ai-first-scheduler/index.html`,
plain JS, no Vue) rendered in an iframe by `modules/releases/client/plan/views/AIPlanner.vue`.

| UI element | Data source | Route / file | Refresh cadence |
|---|---|---|---|
| Feature Scheduling table, PM Rec, capacity panel | Live Jira feature query + readiness pipeline, pushed into the iframe via `postMessage` on load | Parent: `GET /api/modules/releases/planning/ai-planner` (`modules/releases/server/planning/ai-planner/routes.js`) → `buildFeatureReadiness()` (`modules/releases/server/planning/feature-query.js`, JQL against RHAISTRAT + AIPCC Features/Initiatives). Iframe receives it via `window.postMessage({type:'ai-planner-data', ...})` in `AIPlanner.vue:sendDataToIframe()`. | On every iframe load (page visit/tab switch). No time-based cache on this call itself — freshness depends on the underlying Jira query and `buildFeatureReadiness` snapshot. |
| Outcomes / Executive tab (P1–P12 cards, outcome titles & order) | Jira plan view 7384 (RHAISTRAT keys), with a `FALLBACK_OUTCOMES` static list if Jira is unavailable | `GET /api/modules/releases/planning/ai-planner/outcomes` (`ai-planner/routes.js`) → `getPriorityOutcomes()` (`modules/releases/server/planning/outcome-fetch.js`). Iframe calls this directly via `fetchOutcomes()`. | Server-side cache, 40-minute TTL (`outcome-fetch.js:180`, `data/releases/planning/priority-outcomes.json`). Falls back to stale cache if a Jira refresh returns empty. |
| Black milestone/dates bar (TODAY, Planning Freeze, EA/GA Release, etc.) | Release Registry, itself populated from Product Pages (https://productpages.redhat.com) | Iframe calls `GET /api/modules/releases/registry/rhoai-3.6`, `/rhoai-3.7`, `/rhoai-3.7.ea2` directly (`fetchTimelineMilestones()`). Registry rows are written by `runRegistrySync()` (`modules/releases/server/registry.js`), which calls `fetchProductsByShortname()` (`modules/releases/server/delivery/product-pages.js`) — the Product Pages REST client. | Registry rows only update when someone clicks **Discover** on Releases → Manage, or when the AI Planner's own Refresh button runs (see below). No automatic cron sync exists for registry discovery today. If a given registry row has never been discovered, the bar silently falls back to the hardcoded `fallbackMilestones` array in `index.html`. |
| "↻ Refresh" button | Triggers all three of the above, live | `doLiveRefresh()` in `index.html`: `POST /api/modules/releases/registry/discover` (admin-scoped; non-admins skip this step silently), then `renderScheduleStrip()` + `fetchOutcomes()` + `run()`. | On-demand only (button click). |
| Capacity Snapshot / 40-40-20 mix panel | Derived client-side from the feature dataset above (counts/sums over `allData`) | `index.html`, no separate route | Same cadence as the Feature Scheduling table (recomputed on every `run()`). |
| SAMPLE/demo dataset (1148 rows) | Embedded JSON literal in `index.html`, used only when the parent `postMessage` payload never arrives (standalone load, demo mode) | `index.html` (`const SAMPLE = [...]`) | Static — ships with the file, not refreshed. A feature count of exactly 1148 anywhere in the UI means it's running on this fixture, not live data. |

## Known gaps

- **Registry discovery is manual by default.** Unlike outcomes (40-min server cache)
  or features (live on every load), release-date sync only happens when a planning
  manager clicks Discover, or now when someone clicks the AI Planner's Refresh button.
  There is no cadence-based cron handler for it (contrast with the `*/15 * * * *`
  `refresh-all` CronJob, which only covers handlers that register themselves — registry
  discovery doesn't).
- **EA-phase dates live in a separate registry row.** Product Pages publishes one row
  per release phase (e.g. `rhoai-3.7` for GA, `rhoai-3.7.ea2` for EA2); each row's own
  due date is stored generically under that row's `milestones.ga` field. There is no
  shared `eaRelease` field on the GA row. The timeline bar has to fetch the EA-phase
  row by ID to show an EA date at all (fixed in this PR — see below).
- **Some milestones (e.g. "3.7 Planning") have no backing registry field** and will
  always come from the hardcoded fallback until Product Pages or the registry schema
  gains an explicit field for them — this is a data-modeling gap, not a sync bug.
