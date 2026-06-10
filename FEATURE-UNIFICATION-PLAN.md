# Feature Data Unification Plan

Unify RHAISTRAT feature data across the **releases** and **ai-impact** modules
so that releases owns the canonical feature store and AI Impact enriches it with
review scores.

## Problem Statement

Both modules independently fetch and store overlapping RHAISTRAT feature data
from Jira:

| Concern | Releases | AI Impact |
|---------|----------|-----------|
| **Storage** | Per-file: `releases/execution/features/{KEY}.json` + derived `index.json` | Single file: `ai-impact/features.json` with `latest` + `history` per key |
| **Jira fields** | 15+ custom fields (RICE, status summary, color status, docs required, target end, PM, team, release type, issue links, epics) | 5 fields (summary, status, priority, labels, components) + changelog for sign-off detection |
| **Batch size** | 40 issues, 1s throttle | 50 issues, 1s delay |
| **Refresh cadence** | `jira-enrichment` handler, configurable (default 6h) | `feature-sync` handler, refresh-registry cadence |
| **Unique data** | Pipeline metrics/topology/traffic, hygiene rule evaluations, scope-change tracking | AI review scores, recommendations, reviewers, humanReviewStatus, sign-off detection, history |

This duplication causes:
1. **Data inconsistency** — same feature shows different status in different views
2. **Wasted Jira API calls** — both modules fetch overlapping fields independently
3. **Maintenance burden** — two parallel Jira fetch/transform codepaths

### Existing Cross-Module Read (constraint violation)

Releases already reads `ai-impact/features.json` in
`server/planning/feature-readiness.js:155` to build the feature readiness view,
and duplicates `deriveHumanReviewStatus` logic locally. However,
`ai-impact/module.json` has **no `export` section** — this is an undeclared
cross-module read that violates the `export.files` contract. Unification
eliminates this violation by moving the data into releases' own store.

### Out of Scope

**Test plans** and **component onboarding** in the AI Impact module are NOT
affected by this unification. Both reference RHAISTRAT keys but maintain their
own independent storage, Jira sync, and API routes. They do not share the
overlapping field-fetch problem that motivates this plan.

## Design Decisions (from requirements gathering)

| Decision | Choice |
|----------|--------|
| Source of truth | **Releases owns the unified feature store** |
| AI Impact data | **Merged into the unified record** as optional extension fields |
| Jira fetch strategy | **Single comprehensive fetch** — one fetch grabs all fields for both modules |
| Refresh cadence | **Single cadence** for all feature Jira data |
| AI bulk push API | **AI Impact proxies** — AI Impact keeps its bulk push endpoint and writes to releases store |
| API compatibility | **Maintain backward-compatible API responses** — storage format can change |
| External pipelines | Keep current push API contracts unchanged |

## Architecture

### Unified Feature Record

The per-feature JSON file at `releases/execution/features/{KEY}.json` becomes
the single source of truth. It gains optional AI Impact extension fields:

```
releases/execution/features/RHAISTRAT-123.json
{
  // ─── Core fields (existing releases) ───
  "key": "RHAISTRAT-123",
  "summary": "...",
  "status": "In Progress",
  "statusCategory": "In Progress",
  "priority": "Major",
  "assignee": { "displayName": "...", "accountId": "..." },
  "pm": { "displayName": "..." },
  "labels": [...],
  "components": [...],
  "fixVersions": [...],
  "colorStatus": "Green",
  "statusSummary": "...",
  "team": "...",
  "releaseType": "...",
  "docsRequired": "...",
  "targetEnd": "2026-08-01",
  "riceScore": 42,
  "riceStatus": "complete",
  "isBlocked": false,
  "linkedRfeKey": "RHAIRFE-456",
  "issueLinks": [...],
  "epics": [...],
  "metrics": { ... },          // pipeline-owned
  "topology": { ... },         // pipeline-owned
  "trafficSignals": { ... },   // pipeline-owned
  "created": "...",
  "updated": "...",
  "_sources": {
    "pipeline": "...",
    "jira": "...",
    "aiReview": "..."          // NEW: timestamp of last AI review push
  },

  // ─── AI Impact extension fields (NEW) ───
  "aiReview": {
    "title": "...",            // AI pipeline's title (may differ from Jira summary)
    "sourceRfe": "RHAIRFE-456",
    "size": "M",
    "recommendation": "approve",
    "needsAttention": false,
    "humanReviewStatus": "approved",
    "approvedBy": "Jane Doe",
    "approvedAt": "2026-06-01T...",
    "scores": {
      "feasibility": 2,
      "testability": 1,
      "scope": 2,
      "architecture": 2,
      "total": 7
    },
    "reviewers": {
      "feasibility": "approve",
      "testability": "revise",
      "scope": "approve",
      "architecture": "approve"
    },
    "reviewedAt": "2026-05-15T...",
    "runId": "run-abc-123",
    "history": [
      { "scores": {...}, "recommendation": "...", "reviewedAt": "..." }
    ]
  }
}
```

Key design points:
- All AI Impact data lives under a single `aiReview` namespace to avoid field
  collisions and make ownership clear
- `history` moves inside `aiReview` (was top-level in old format)
- Jira-synced fields (status, priority, labels, components) live at the top
  level — no duplication inside `aiReview`
- `humanReviewStatus` and sign-off info are derived from Jira labels, so they
  belong in `aiReview` (label interpretation is AI Impact's domain)

### Labels Field Handling

The AI review pipeline sends `labels` in the bulk push payload (required by
validation). After unification, labels are handled as follows:

- **Top-level `labels`**: Owned by Jira enrichment. The unified Jira fetch
  writes the canonical label array to the top-level field. The AI review
  pipeline's `labels` are NOT written to the top level (Jira is the authority).
- **`aiReview.humanReviewStatus`**: Derived from the pipeline-sent `labels`
  during validation (via `deriveHumanReviewStatus`). This is the AI Impact
  interpretation of the labels, stored in the `aiReview` namespace.
- **`aiReview.labels`**: The pipeline-sent labels are preserved in `aiReview`
  for audit/debugging purposes. This preserves the exact label snapshot that
  the AI pipeline saw at review time, which may differ from Jira's current
  state.

The validation contract is unchanged — the bulk push still requires `labels`
in the request body. The releases endpoint's merge logic decides where they go.

### Data Flow (After Unification)

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────────┐
│ GitLab Pipeline │     │   AI Review      │     │   Jira Cloud            │
│ (metrics,       │     │   Pipeline       │     │   (single comprehensive │
│  topology)      │     │   (scores,       │     │    fetch)               │
│                 │     │    recommendations│     │                         │
└────────┬────────┘     └────────┬─────────┘     └────────────┬────────────┘
         │                       │                             │
         ▼                       ▼                             ▼
  POST /api/modules/      POST /api/modules/         jira-enrichment refresh
  releases/execution/     ai-impact/features/bulk    handler (releases module)
  ingest                  (AI Impact validates,       │
         │                 then calls releases        │
         │                 internal API)              │
         │                       │                    │
         ▼                       ▼                    ▼
    ┌────────────────────────────────────────────────────┐
    │  Unified Feature Store                             │
    │  releases/execution/features/{KEY}.json            │
    │  releases/execution/index.json (derived)           │
    └────────────────────────────────────────────────────┘
              │                          │
              ▼                          ▼
     Releases views              AI Impact views
     (Execute, Plan,             (Feature Review,
      Deliver, Hygiene)           State of Union)
```

### Unified Jira Fetch

The existing `jira-enrichment` refresh handler in the releases module expands
to derive `humanReviewStatus` from labels and detect sign-off events.

**Two-pass approach** (avoids changelog performance bomb):

- **Main enrichment pass** (existing): Fetches all 15+ fields with
  `expand: renderedFields`. No changelog. Derives `humanReviewStatus` from the
  `labels` array (no changelog needed — `deriveHumanReviewStatus` only checks
  label presence, not history).
- **Sign-off detection pass** (new, targeted): For features that have
  `aiReview` data AND where `humanReviewStatus === 'approved'` but lack
  `approvedBy`/`approvedAt`, fetch ONLY those keys with
  `fields=labels&expand=changelog`. This is a small subset — typically
  newly-approved features only. Batch size can be small (10-20).

This avoids adding `changelog` to the main enrichment fetch, which would
multiply per-issue response size by 10-50x for mature features with long
change histories. The current AI Impact approach fetches changelog for ALL
features — the two-pass approach is actually more efficient since it only
fetches changelog for features that need sign-off timestamp backfill.

The `transformForEnrichment` function in `jira-enrich.js` gains:
- `humanReviewStatus` derivation from labels (port `deriveHumanReviewStatus`)
  — runs in the main pass, no changelog needed
- Sign-off extraction from changelog (port `extractSignOffInfo` from AI Impact)
  — runs only in the targeted second pass

### Merge Logic Changes

`feature-store.js` `mergeFeatureData` gains awareness of the `aiReview`
namespace:

```js
// AI-review-owned fields: aiReview data wins when present
const AI_REVIEW_FIELDS = ['aiReview'];

// In mergeFeatureData:
// aiReview: deep-merge (AI push wins for scores, Jira wins for labels/status)
if (jiraData && jiraData.aiReview) {
  merged.aiReview = {
    ...(base.aiReview || {}),
    ...jiraData.aiReview
  };
}
```

The `_sources.aiReview` timestamp tracks when AI review data was last pushed.

### Index Changes

`rebuildIndex` adds a slim AI review summary to index entries:

```js
// In index entry:
aiReview: feature.aiReview ? {
  recommendation: feature.aiReview.recommendation,
  scores: feature.aiReview.scores,
  humanReviewStatus: feature.aiReview.humanReviewStatus,
  needsAttention: feature.aiReview.needsAttention,
  reviewedAt: feature.aiReview.reviewedAt
} : null
```

This enables the Plan view's feature readiness to read from the index instead
of cross-module storage reads.

## API Changes

### Releases Module (source of truth)

No breaking changes. Additive only:

- Feature detail responses gain optional `aiReview` field
- Index entries gain optional `aiReview` summary
- No endpoint URL changes

### AI Impact Module (proxy layer)

AI Impact keeps all existing endpoints with identical request/response shapes.
Internally they read from/write to the releases feature store.

| Endpoint | Current | After |
|----------|---------|-------|
| `GET /features` | Reads `ai-impact/features.json`, returns `getLatestProjection` | Reads `releases/execution/index.json`, transforms to same response shape |
| `GET /features/:key` | Reads `ai-impact/features.json`, returns `{ latest, history }` | Reads `releases/execution/features/{key}.json`, extracts `aiReview` into `{ latest, history }` format |
| `POST /features/bulk` | Validates, writes to `ai-impact/features.json` | Validates, writes `aiReview` namespace into releases feature files |
| `PUT /features/:key` | Validates, writes to `ai-impact/features.json` | Validates, writes `aiReview` namespace into releases feature file |
| `POST /features/sync` | Runs Jira sync on AI Impact store | Returns status indicating sync is handled by releases `jira-enrichment` handler |
| `DELETE /features` | Clears `ai-impact/features.json` | Clears `aiReview` from all releases feature files |
| `GET /features/status` | Stats from AI Impact store | Stats derived from releases store |

**Key constraint**: AI Impact needs to write AI review data into releases'
feature store. This is the reverse of the normal cross-module pattern (read-only
via `readFromStorage` from exported files). Three options were considered:

**Option A — Direct storage write**: AI Impact writes directly to
`releases/execution/features/{KEY}.json` via a new `writeToExportedStorage` API.
**Rejected** — creates unsolvable write contention. Releases' `writeFeatures()`
uses an in-memory `storeWriteInProgress` mutex, but AI Impact can't access it
(cross-module import constraint). An AI Impact write landing between releases'
batch write and `rebuildIndex()` would be lost from the index. Also introduces a
new cross-module write pattern that `AGENTS.md` doesn't sanction.

**Option B — Internal API call (recommended)**: Releases exposes a new internal
endpoint for AI review data. AI Impact calls it via localhost HTTP after
validation. Releases owns the mutex, merge, history management, and index
rebuild — all in one atomic operation.

**Option C — Shared write hook**: Over-engineered for this use case.

**Recommendation: Option B.** Releases adds a bulk endpoint:

```
POST /api/modules/releases/execution/ai-review/bulk
Body: { features: [{ key, aiReview }] }
```

This endpoint:
1. Acquires the existing `storeWriteInProgress` mutex
2. For each feature: reads existing file, merges `aiReview` with history
   management (smart eviction, position-based insertion, idempotency via
   `reviewedAt`), writes back
3. Rebuilds the index
4. Returns `{ created, updated, unchanged }` counts

AI Impact calls this via `http://localhost:3001/api/modules/releases/...` after
its own validation pass. One HTTP call per bulk push — not per feature. The
localhost overhead is negligible compared to the Jira API calls that follow.

This approach naturally solves three problems at once:
- **Write contention**: Releases' mutex protects all writes
- **Index rebuild**: Happens atomically after all writes, inside the mutex
- **History management**: AI Impact's `upsertFeature` logic (smart eviction,
  idempotency) is ported into the releases endpoint, not duplicated

## Implementation Phases

### Phase 1: Extend Releases Feature Store (no breaking changes)

**Goal**: Releases feature files can hold AI review data. No consumers change yet.

1. Add `aiReview` to `JIRA_FIELDS` exclusion (it's not a Jira field — don't
   overwrite on merge)
2. Add `AI_REVIEW_FIELDS` constant and merge handling in `mergeFeatureData`
3. Port `extractSignOffInfo` and `deriveHumanReviewStatus` from AI Impact into
   a new `modules/releases/server/execution/ai-review-fields.js`
4. Add a targeted sign-off detection pass in `jira-enrich.js`: for features
   with `aiReview` + `humanReviewStatus === 'approved'` but missing
   `approvedBy`/`approvedAt`, fetch only those keys with
   `fields=labels&expand=changelog`. Do NOT add changelog to the main
   enrichment fetch (it would multiply response size 10-50x).
5. Update `transformForEnrichment` to derive `humanReviewStatus` from labels
   (no changelog needed) and populate the `aiReview` sub-object. Sign-off
   details are populated separately from the targeted second pass.
6. Update `rebuildIndex` to include slim `aiReview` in index entries
7. Update `docs/DATA-FORMATS.md` with new `aiReview` schema
8. Update demo fixtures with `aiReview` data
9. Unit tests for all new merge/transform logic

**Files modified**:
- `modules/releases/server/execution/feature-store.js`
- `modules/releases/server/execution/jira-enrich.js`
- `modules/releases/server/execution/ai-review-fields.js` (new)
- `docs/DATA-FORMATS.md`
- `fixtures/releases/execution/features/*.json`
- Tests

### Phase 2: Add AI Review Bulk Endpoint to Releases

**Goal**: Releases exposes an internal API for writing AI review data into the
unified feature store, with proper mutex coordination and index rebuild.

1. Add `POST /api/modules/releases/execution/ai-review/bulk` endpoint in
   `modules/releases/server/execution/routes.js`:
   - Accepts `{ features: [{ key, aiReview }] }` body
   - Acquires `storeWriteInProgress` mutex
   - For each feature: read existing file (or create minimal stub if file
     doesn't exist — AI-only features are valid) → merge `aiReview` namespace
     (with history management) → write back
   - Rebuild index after all writes
   - Return `{ created, updated, unchanged }` counts
   - Requires admin + scope guard (same as existing execution endpoints)
2. Add `DELETE /api/modules/releases/execution/ai-review` endpoint:
   - Iterates all feature files, removes `aiReview` key, writes back
   - Rebuilds index
   - This is an async operation (responds immediately, processes in background)
3. Port AI Impact's `upsertFeature` history management logic (smart eviction,
   position-based insertion, idempotency via `reviewedAt`) into a new
   `modules/releases/server/execution/ai-review-merge.js`
4. Add `@openapi` annotations (hard constraint #6)
5. Unit tests for merge logic and endpoint

**Files modified**:
- `modules/releases/server/execution/routes.js`
- `modules/releases/server/execution/ai-review-merge.js` (new)
- Tests

### Phase 3: AI Impact Writes via Releases Internal API

**Goal**: AI Impact bulk push and upsert forward validated `aiReview` data to
releases' internal API instead of writing to `ai-impact/features.json`.

1. Add `"requires": ["releases"]` to `modules/ai-impact/module.json` — makes
   the dependency explicit. The module-loader's `resolveEnableOrder` and
   `reconcileStartupState` already handle dependency resolution, ensuring
   releases is always enabled when ai-impact is enabled and routers are
   created in the correct order.
2. Update `modules/ai-impact/server/features/routes.js`:
   - `POST /features/bulk`: After validation, call
     `POST http://localhost:3001/api/modules/releases/execution/ai-review/bulk`
     with the validated `aiReview` data. Return the same response shape to
     the external pipeline (backward compat).
   - `PUT /features/:key`: Same pattern (single-item bulk call)
   - AI Impact keeps its `featureLock` for serializing its own requests to
     the releases endpoint (prevents flooding)
3. Update `POST /features/sync` to return a message indicating sync is now
   unified via releases' `jira-enrichment` handler
4. Update `DELETE /features` to call
   `DELETE http://localhost:3001/api/modules/releases/execution/ai-review`
5. Remove AI Impact's `jira-sync.js` refresh handler registration (releases
   handles it now)
6. After bulk push, trigger a one-time Jira enrichment to populate newly
   created features with Jira-sourced fields (colorStatus, team, riceScore,
   etc.) that the AI pipeline doesn't provide. This replaces the current
   10-second delayed `runSync` in `routes.js:151-156`.
7. Integration tests

**Files modified**:
- `modules/ai-impact/server/features/routes.js`
- `modules/ai-impact/module.json`
- Tests

### Phase 4: AI Impact Reads from Releases Store

**Goal**: AI Impact GET endpoints read from releases feature store and transform
responses to maintain backward compatibility.

1. Update `GET /features` to:
   - Read `releases/execution/index.json`
   - Transform index entries into the existing `getLatestProjection` shape
     (extract `aiReview` fields to top level for API compat)
   - Synthesize `lastSyncedAt` from the index's `fetchedAt` timestamp and
     `totalFeatures` by counting entries with `aiReview` data. These metadata
     fields are required by the existing API response shape.
2. Update `GET /features/:key` to:
   - Read `releases/execution/features/{KEY}.json`
   - Transform into `{ latest, history }` shape from `aiReview` namespace
3. Update `GET /features/status` to derive stats from releases store
   (synthesize `lastSyncedAt`, `lastJiraSyncAt`, `totalFeatures`,
   `totalHistoryEntries` from releases data)
4. Remove `ai-impact/features.json` reads from all AI Impact code
5. Update `feature-readiness.js` in releases — this is a significant refactor
   of a 607-line file with a three-pass algorithm. The approach is:
   - **Do not restructure the algorithm.** The three-pass architecture stays.
   - Replace `readFromStorage('ai-impact/features.json')` (line 155) with
     reading `releases/execution/index.json` and individual feature files
   - Remap field access from `entry.latest.{field}` to `feature.aiReview.{field}`
   - Replace the local `deriveHumanReviewStatusFromLabels` (line 147) with
     the shared utility from `shared/server/ai-review-utils.js`
   - **Snapshot tests first**: Before any changes, add snapshot tests that
     capture the current output of `buildFeatureReadiness` for a set of test
     fixtures. This creates a safety net — refactoring must produce identical
     output.
   - Update the 17+ existing test fixtures to use the unified schema
6. API response compatibility tests — snapshot tests comparing old vs. new
   responses for `GET /features` and `GET /features/:key`

**Files modified**:
- `modules/ai-impact/server/features/routes.js`
- `modules/ai-impact/server/features/storage.js`
- `modules/releases/server/planning/feature-readiness.js` (careful refactor)
- `modules/releases/server/planning/__tests__/feature-readiness.test.js`
- Tests

### Phase 5: Remove AI Impact Feature Storage

**Goal**: Clean up deprecated code and storage.

1. Delete `ai-impact/features.json` from storage (migration script)
2. Remove `modules/ai-impact/server/features/jira-sync.js` (all logic now
   in releases jira-enrich)
3. Remove AI Impact's `feature-sync` refresh handler registration
4. Simplify `modules/ai-impact/server/features/storage.js` to only contain
   response-shaping transforms (reading from releases store and reshaping
   for backward-compatible API responses)
5. Consolidate `deriveHumanReviewStatus` — currently exists in three places:
   - `modules/ai-impact/server/features/validation.js:10` (uses `includes`)
   - `modules/releases/server/planning/feature-readiness.js:147` (uses `indexOf`)
   - `modules/releases/server/execution/ai-review-fields.js` (new, Phase 1)
   Move to `shared/server/ai-review-utils.js` as a shared utility since both
   modules need it (AI Impact for validation, releases for Jira enrichment).
   Remove the copies from validation.js, feature-readiness.js, and
   ai-review-fields.js. Update `shared/API.md`.
6. Update `modules/ai-impact/module.json` — remove `jira` from platform
   secrets if no other AI Impact code needs it (check test plans, etc.)
7. Update demo fixtures — remove `fixtures/ai-impact/features.json` fixture
   if no longer needed, or keep as legacy test data
8. Update `AGENTS.md` to document the internal API pattern as the sanctioned
   mechanism for cross-module writes (alongside `readFromStorage` for reads).
   Update `CLAUDE.md` architecture sections.

**Files modified/deleted**:
- `modules/ai-impact/server/features/jira-sync.js` (delete)
- `modules/ai-impact/server/features/storage.js` (simplify)
- `modules/ai-impact/server/features/validation.js` (import from shared)
- `modules/ai-impact/module.json`
- `modules/releases/server/planning/feature-readiness.js` (import from shared)
- `modules/releases/server/execution/ai-review-fields.js` (import from shared)
- `shared/server/ai-review-utils.js` (new)
- `shared/API.md`
- `AGENTS.md`
- Documentation files

## Migration Strategy

### Data Migration (Phase 3-4 boundary)

When Phase 3 goes live, new AI review pushes write to releases store. Existing
data in `ai-impact/features.json` needs a one-time migration:

```js
// Migration script: migrate-ai-features.js
// For each entry in ai-impact/features.json:
//   1. Read releases/execution/features/{KEY}.json (may not exist)
//   2. If file doesn't exist, create a minimal feature stub:
//      { key, summary: entry.latest.title, _sources: { aiReview: now } }
//      These "AI-only" features have no pipeline/Jira data yet — that's OK.
//      The next jira-enrichment run will populate them.
//   3. Set feature.aiReview = { ...entry.latest, history: entry.history }
//   4. Write back to releases feature file
//   5. Rebuild index
// Write flag file ONLY after all features migrated + index rebuilt
```

**AI-only features**: Features that exist in `ai-impact/features.json` but have
no corresponding releases feature file are expected. The AI review pipeline may
score features before the execution pipeline discovers them. The migration
creates minimal stub files for these. Views must tolerate features with
`aiReview` data but no `metrics`/`topology` — this is already the case for
features discovered via Jira but not yet in the pipeline. The `rebuildIndex`
function already handles missing fields with fallback defaults (e.g.,
`feature.metrics ? ... : 0`).

The migration runs in `server/dev-server.js` at startup, **before** module
routers are created (i.e., before `createModuleRouters`). This prevents a race
where AI Impact could try to read from the old store before migration completes.
The flag file lives at `data/migrations/ai-features-unified` on the PVC,
persisting across pod restarts. The migration is idempotent — re-running when
the flag file is missing (e.g., after a PVC restore) safely re-applies without
data loss since it only sets `aiReview` on feature files that lack it.

### Rollback

Each phase is independently deployable. If Phase 3+ has issues:
- AI Impact can revert to reading/writing its own store
- Releases store continues working without `aiReview` fields (they're optional)

**Phase 5 is the point of no return.** After Phase 5, `ai-impact/features.json`
is deleted. Rolling back past this point requires re-running the AI review
pipeline to repopulate data. Phases 1-4 can be rolled back without data loss
because the old `ai-impact/features.json` is preserved until Phase 5.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Write contention between releases pipeline ingest and AI Impact bulk push | Internal API approach (Option B) means all writes go through releases' `storeWriteInProgress` mutex — single coordination point. **Assumes single-replica backend** (`replicas: 1` with `strategy: Recreate`), which is our current and planned architecture — no multi-pod contention risk. |
| Localhost HTTP overhead for AI review bulk push | Negligible — one HTTP call per bulk push (not per feature), compared to the Jira API calls that follow. Node.js localhost fetch has sub-millisecond overhead. |
| `DELETE /features` becomes a heavy operation | Currently clears a single file. After unification, it iterates all releases feature files to remove `aiReview`. Made async (responds immediately, processes in background). With hundreds of features this may take seconds, not milliseconds. |
| Internal API creates implicit dependency on releases | Made explicit via `"requires": ["releases"]` in `ai-impact/module.json`. Module-loader's dependency resolution ensures correct startup order. |
| AI Impact `jira` platform secret dependency | After Phase 5, check if test plans or other AI Impact code still needs Jira. If not, remove `jira` from `ai-impact/module.json` secrets. |
| `feature-readiness.js` refactoring risk (607 lines, three-pass algorithm) | Phase 4 takes a conservative approach: algorithm structure stays, only data access patterns change. Snapshot tests are added BEFORE refactoring to create a safety net — output must be identical. The 17+ existing test fixtures are updated to the unified schema. This is a careful field-remapping, not a restructure. |
| AI-only features (exist in AI Impact but not releases) | Bulk endpoint and migration create minimal stub files for these. Views already tolerate features with missing `metrics`/`topology` (rebuildIndex defaults to 0/null). The next jira-enrichment run populates Jira fields. |
| Migration fails mid-way (pod crash during startup) | Migration is idempotent — it only sets `aiReview` on feature files that lack it. Flag file is written only after ALL features are migrated and index is rebuilt. Safe to re-run on restart. |
| Newly pushed features lack Jira-sourced fields until next refresh | Phase 3 step 6: AI Impact triggers a one-time Jira enrichment after bulk push to populate colorStatus, team, riceScore, etc. for newly created features. Replaces the current 10s delayed `runSync`. |

## CI/CD and Deployment Notes

- **CronJob**: No changes needed. `POST /api/admin/refresh-all` is cadence-aware;
  removing AI Impact's `feature-sync` handler (Phase 5) and relying on releases'
  `jira-enrichment` handler is transparent to the CronJob.
- **CI workflows**: `ci.yml` and `build-images.yml` already cover `modules/`,
  `shared/`, and `server/` paths — no changes needed.
- **Integration tests**: The internal API approach means changes to releases'
  `ai-review/bulk` endpoint should trigger both ai-impact and releases
  integration tests. Consider adding cross-module integration test triggers
  in `integration-tests.yml` — nice-to-have, not blocking.
- **Kustomize**: No new env vars, secrets, or ConfigMap entries.
- **Single-replica assumption**: Write contention safety relies on single
  backend pod (`replicas: 1`, `strategy: Recreate`). This is the current and
  planned architecture.

## Testing Strategy

Testing spans four layers: unit tests, snapshot tests, integration tests, and
smoke tests. Each phase has specific testing requirements.

### Unit Tests (Vitest)

Already called out per-phase above. Summary of new unit test files:

| Phase | New/Updated Test Files | What They Cover |
|-------|----------------------|-----------------|
| 1 | `modules/releases/server/execution/__tests__/ai-review-fields.test.js` | `deriveHumanReviewStatus`, `extractSignOffInfo`, two-pass sign-off detection |
| 1 | `modules/releases/server/execution/__tests__/feature-store.test.js` (update) | `aiReview` merge logic, `AI_REVIEW_FIELDS` exclusion, index `aiReview` summary |
| 2 | `modules/releases/server/execution/__tests__/ai-review-merge.test.js` | History management (smart eviction, position insertion, idempotency via `reviewedAt`), AI-only feature stub creation |
| 2 | `modules/releases/server/execution/__tests__/routes.test.js` (update) | `POST ai-review/bulk` endpoint, `DELETE ai-review` endpoint, mutex coordination |
| 3 | `modules/ai-impact/server/features/__tests__/routes.test.js` (update) | Bulk push → internal API forwarding, response shape preservation |
| 4 | `modules/ai-impact/server/features/__tests__/storage.test.js` (update) | Response-shaping transforms from releases format to AI Impact API format |
| 5 | `shared/server/__tests__/ai-review-utils.test.js` | Consolidated `deriveHumanReviewStatus` |

### Snapshot Tests (Vitest)

Phase 4 requires snapshot tests as a safety net before refactoring
`feature-readiness.js`:

1. **Before any Phase 4 code changes**: add snapshot tests that capture the
   current output of `buildFeatureReadiness()` for a representative set of
   test fixtures (covering each of the three passes, edge cases like
   AI-only features, features with no `aiReview`, etc.)
2. After refactoring field access patterns, snapshots must match exactly
3. Also add snapshot tests for AI Impact API responses (`GET /features`,
   `GET /features/:key`) to verify backward compatibility

### Integration Tests (Playwright, `tests/integration/`)

Integration tests run against production containers in demo mode. Fixture
updates drive these — when fixtures change, integration tests automatically
exercise the new data shapes.

| Phase | Test File | Updates Needed |
|-------|-----------|----------------|
| 1 | `tests/integration/releases.spec.js` | No changes — releases views continue working. New `aiReview` data in fixtures is additive. |
| 1 | `tests/integration/ai-impact.spec.js` | No changes yet — AI Impact still reads its own store. |
| 2 | None | Internal API endpoint is tested via unit tests; no UI-visible change. |
| 3 | `tests/integration/ai-impact.spec.js` | Update to verify Feature Review view still loads with data from the new data path. The view navigates to `/#/ai-impact/feature-review` and checks for content — this should pass unchanged if fixtures are correct. |
| 4 | `tests/integration/ai-impact.spec.js` | Verify `GET /api/modules/ai-impact/features` returns expected shape. Add API response assertions (check `lastSyncedAt`, `totalFeatures`, feature keys match fixtures). |
| 4 | `tests/integration/releases.spec.js` | Verify Plan view feature readiness still renders after `feature-readiness.js` refactor. |
| 5 | `tests/integration/ai-impact.spec.js` | Remove any references to `ai-impact/features.json` fixture path. Verify demo mode still works with unified fixtures only. |

**New cross-module integration test** (Phase 4):

Add `tests/integration/feature-unification.spec.js` to verify the full
end-to-end data flow in demo mode:

```js
// @feature-unification
// 1. Verify releases execution index contains aiReview data
//    GET /api/modules/releases/execution/features → check aiReview fields
// 2. Verify AI Impact features endpoint returns data derived from releases store
//    GET /api/modules/ai-impact/features → check feature keys, scores, status
// 3. Verify Plan view feature readiness renders with unified data
//    Navigate to /#/releases/plan → check Feature Readiness tab loads
// 4. Verify AI Impact Feature Review renders with unified data
//    Navigate to /#/ai-impact/feature-review → check content renders
```

This test runs in demo mode against the unified fixtures, validating that both
modules see consistent data from the shared store. Add to
`integration-tests.yml` with both `releases` and `ai-impact` as triggers.

### Smoke Tests (Playwright, `tests/smoke/`)

Smoke tests verify the app loads without JS errors, renders core UI, and has
no stuck loading states. They run against production container images in demo
mode.

| Phase | Updates Needed |
|-------|----------------|
| 1 | Update `fixtures/releases/execution/features/*.json` with `aiReview` data. Update `fixtures/releases/execution/index.json` with `aiReview` summary fields. Smoke tests should pass without code changes — they don't assert on specific data shapes, only that the app loads and renders. |
| 3-4 | **Key concern**: when AI Impact reads from releases store in demo mode, `demo-storage.js` must serve the unified fixtures correctly. Verify that `readFromStorage('releases/execution/index.json')` from AI Impact's demo code returns the fixture with `aiReview` fields. |
| 5 | Remove `fixtures/ai-impact/features.json` (or keep as legacy if other AI Impact features reference it — check test plans). Run full smoke test suite to verify no regressions. |

**No smoke test code changes needed** — the tests check for JS errors, layout
rendering, and absence of error states. Fixture updates (Phase 1) are sufficient
as long as the data shapes are valid.

### Demo Fixture Updates (by phase)

| Phase | Fixture Changes |
|-------|----------------|
| 1 | Add `aiReview` namespace to 3-4 of the 10 existing `fixtures/releases/execution/features/*.json` files (not all — some features shouldn't have AI review data). Update `fixtures/releases/execution/index.json` to include `aiReview` summaries for those features. |
| 4 | Verify `fixtures/ai-impact/features.json` keys overlap with releases fixture keys (they should, for the cross-module test to work). |
| 5 | Delete `fixtures/ai-impact/features.json` if no longer read by any code path. If test plans or other AI Impact features still reference it, keep it. |

### CI Workflow Updates

- **`integration-tests.yml`**: Add `feature-unification` filter that triggers
  on changes to `modules/releases/server/execution/ai-review*`,
  `modules/ai-impact/server/features/**`, and `shared/server/ai-review-utils.js`.
  Maps to the new `tests/integration/feature-unification.spec.js`.
- **`ci.yml`**: No changes — unit tests run on all PRs via `npm test`.
- **`build-images.yml`**: No changes — smoke tests run automatically after
  image builds.

## Success Criteria

- [ ] Single Jira fetch for all RHAISTRAT fields (no duplicate API calls)
- [ ] Feature status is consistent across releases and AI Impact views
- [ ] AI Impact bulk push API accepts same request format (backward compat)
- [ ] AI Impact GET endpoints return same response shape (backward compat)
- [ ] `ai-impact/features.json` no longer exists (storage consolidation)
- [ ] Feature readiness in Plan view reads `aiReview` from releases store directly
- [ ] Single configurable refresh cadence for feature Jira sync
- [ ] All existing unit, integration, and smoke tests pass
- [ ] New cross-module integration test validates end-to-end data flow
- [ ] Snapshot tests confirm API response backward compatibility
- [ ] Demo mode works with unified fixtures
