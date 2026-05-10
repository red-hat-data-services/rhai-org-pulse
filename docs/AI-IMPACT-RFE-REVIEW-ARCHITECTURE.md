# AI Impact — RFE Review: Architecture & Data Flow

This document covers the full technical architecture of the **RFE Review** section of the AI Impact module, across the data, backend, and UI tiers, and traces the end-to-end flow from raw Jira data to rendered UI.

---

## Table of Contents

1. [Data Tier](#1-data-tier)
2. [Backend Tier](#2-backend-tier)
3. [Live Data Write Paths](#3-live-data-write-paths)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [UI Tier](#5-ui-tier)
6. [End-to-End Data Flow](#6-end-to-end-data-flow)

---

## 1. Data Tier

All persistent data lives under `data/ai-impact/` on the server filesystem (PVC-mounted in OpenShift). Demo mode reads from `fixtures/ai-impact/` instead.

### 1.1 Assessments — `ai-impact/assessments.json`

Stores AI rubric assessments for individual RFE Jira tickets.

**Root structure:**
```json
{
  "lastSyncedAt": "<ISO 8601>",
  "totalAssessed": 42,
  "assessments": {
    "RHAIRFE-1001": { "latest": { ... }, "history": [ ... ] }
  }
}
```

**Per-RFE `latest` entry:**
```json
{
  "scores": {
    "what": 2,
    "why": 1,
    "how": 0,
    "task": 2,
    "size": 1
  },
  "total": 6,
  "passFail": "PASS",
  "antiPatterns": ["WHY Void"],
  "criterionNotes": {
    "what": "Clear scope defined",
    "why": "Business value partially stated"
  },
  "verdict": "Acceptable with minor gaps",
  "feedback": "Needs stronger justification in the WHY dimension.",
  "assessedAt": "<ISO 8601>"
}
```

- Each criterion (`what`, `why`, `how`, `task`, `size`) scores 0–2. `total` must equal their sum (max 10).
- `passFail`, `antiPatterns`, `criterionNotes`, `verdict`, `feedback` are all optional.
- `assessedAt` is the idempotency key — re-submitting the same timestamp is a no-op.

**Per-RFE `history` array:**
- Capped at **20 entries**, newest-first.
- Each entry is a trimmed snapshot: `{ scores, total, passFail, assessedAt }`.
- When a new assessment arrives, the current `latest` is rotated into `history`. Smart eviction prevents inserting an older entry that would immediately be trimmed off the cap.

**Storage operations** (`server/assessments/storage.js`):
- `readAssessments()` — reads and guards against malformed data.
- `writeAssessmentsAtomic()` — writes to a temp file then renames atomically to prevent corruption.
- `upsertAssessment()` — mutates the in-memory object, returns `"created"` / `"updated"` / `"unchanged"`.
- `getLatestProjection()` — returns slim list-view data (strips criterion notes).
- `countHistoryEntries()` — total history entries across all RFEs (used by admin status endpoint).

---

### 1.2 Features — `ai-impact/features.json`

Stores pipeline-generated feature review results linked to RFEs.

**Root structure:**
```json
{
  "lastSyncedAt": "<ISO 8601>",
  "totalFeatures": 28,
  "features": {
    "RHAISTRAT-1168": { "latest": { ... }, "history": [ ... ] }
  }
}
```

**Per-feature `latest` entry:**
```json
{
  "key": "RHAISTRAT-1168",
  "title": "Add vector store support",
  "sourceRfe": "RHAIRFE-1042",
  "priority": "Major",
  "status": "In Progress",
  "size": "M",
  "recommendation": "approve",
  "needsAttention": false,
  "humanReviewStatus": "approved",
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
  "labels": ["strat-creator-auto-created"],
  "runId": "pipeline-run-abc123",
  "runTimestamp": "<ISO 8601>",
  "reviewedAt": "<ISO 8601>"
}
```

- Dimension scores (`feasibility`, `testability`, `scope`, `architecture`) are 0–2 each; `total` is 0–8.
- `humanReviewStatus` is **derived** from Jira labels at ingest time: `strat-creator-human-sign-off` → `"approved"`, `strat-creator-needs-attention` → `"needs-review"`, etc.
- `reviewedAt` is synthesized from `runTimestamp` if not explicitly provided by the pipeline.
- Accepts both `snake_case` and `camelCase` input; normalized to `camelCase` on write.
- History capped at **20 entries** with the same trimmed-snapshot + smart-eviction logic as assessments.

---

### 1.3 RFE Cache — `ai-impact/rfe-data.json`

A server-side cache of Jira RFE issues. Refreshed on demand via the admin UI or daily CronJob. Never edited directly.

```json
{
  "fetchedAt": "<ISO 8601>",
  "issues": [
    {
      "key": "RHAIRFE-1042",
      "summary": "As a user I want vector store support",
      "status": "In Progress",
      "priority": "Major",
      "created": "<ISO 8601>",
      "creator": "jdoe",
      "creatorDisplayName": "Jane Doe",
      "labels": ["rfe-creator-auto-created"],
      "aiInvolvement": "created",
      "createdLabelDate": "<ISO 8601>",
      "revisedLabelDate": null,
      "linkedFeature": {
        "key": "RHAISTRAT-1168",
        "summary": "Add vector store support",
        "status": "In Progress",
        "fixVersions": ["2.19"]
      }
    }
  ]
}
```

- `aiInvolvement` is classified from labels: `"created"` | `"revised"` | `"both"` | `"none"`.
- `linkedFeature` is resolved post-fetch via a batch JQL lookup on Jira issue links (`Cloners` link type targeting the RHAISTRAT project).
- `_rawIssueLinks` is an internal field used during resolution and is stripped before writing.

---

### 1.4 Autofix Cache — `ai-impact/autofix-data.json`

Cache of Jira autofix/triage issues from configured projects (e.g., AIPCC, RHOAIENG).

```json
{
  "fetchedAt": "<ISO 8601>",
  "issues": [
    {
      "key": "AIPCC-234",
      "summary": "Fix null pointer in model loader",
      "status": "In Review",
      "issueType": "Bug",
      "priority": "Critical",
      "created": "<ISO 8601>",
      "updated": "<ISO 8601>",
      "labels": ["autofix-review"],
      "components": ["model-serving"],
      "assignee": "jsmith",
      "pipelineState": "review"
    }
  ]
}
```

`pipelineState` is classified from labels into:
- Triage states: `pending`, `missing-info`, `not-fixable`, `stale`
- Autofix states: `ready`, `pending`, `review`, `ci-failing`, `merged`, `rejected`, `max-retries`, `researched`, `blocked`

---

### 1.5 Module Config — `ai-impact/config.json`

Admin-editable configuration for Jira project keys, labels, and behavior tuning. All string values are validated against a JQL injection pattern (`/["'();\\]/`) before being saved.

```json
{
  "jiraProject": "RHAIRFE",
  "linkedProject": "RHAISTRAT",
  "createdLabel": "rfe-creator-auto-created",
  "revisedLabel": "rfe-creator-auto-revised",
  "testExclusionLabel": "rfe-creator-skill-testing",
  "linkTypeName": "Cloners",
  "excludedStatuses": ["Closed"],
  "lookbackMonths": 12,
  "trendThresholdPp": 2,
  "autofixProjects": ["AIPCC", "RHOAIENG"],
  "autofixCreatedAfter": null
}
```

---

## 2. Backend Tier

The module server entry is `modules/ai-impact/server/index.js`. All routes are mounted at `/api/modules/ai-impact/`.

### 2.1 Assessment Routes (`server/assessments/routes.js`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/assessments` | Public | Slim list of all assessments (scores, total, passFail, antiPatterns, assessedAt) |
| `GET` | `/assessments/:key` | Public | Full assessment detail + full history for one RFE |
| `PUT` | `/assessments/:key` | Admin | Upsert a single assessment |
| `POST` | `/assessments/bulk` | Admin | Bulk upsert up to 5,000 assessments; returns `{ created, updated, unchanged, errors }` |
| `GET` | `/assessments/status` | Admin | `{ lastSyncedAt, totalAssessed, totalHistoryEntries }` |
| `DELETE` | `/assessments` | Admin | Clear all assessment data |

**Validation** (`server/assessments/validation.js` — `validateAssessment(body)`):
- Each score must be an integer 0–2.
- `total` must equal the sum of all five criterion scores and be in range 0–10.
- `passFail` must be `"PASS"` or `"FAIL"`.
- `assessedAt` must be a valid ISO 8601 string.
- `antiPatterns`, `criterionNotes`, `verdict`, `feedback` are all optional.
- Returns `{ valid: true, data }` on success or `{ valid: false, errors: string[] }` on failure.

---

### 2.2 Feature Routes (`server/features/routes.js`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/features` | Public | Slim list of all features |
| `GET` | `/features/:key` | Public | Full feature detail + history for one feature |
| `PUT` | `/features/:key` | Admin | Upsert a single feature |
| `POST` | `/features/bulk` | Admin | Bulk upsert up to 5,000 features |
| `GET` | `/features/status` | Admin | `{ lastSyncedAt, totalFeatures, totalHistoryEntries }` |
| `DELETE` | `/features` | Admin | Clear all feature data |

**Validation** (`server/features/validation.js` — `validateFeature(body)`):
- Normalizes `snake_case` keys to `camelCase` (`strat_id` → `key`, `source_rfe` → `sourceRfe`).
- Required: `key`, `title`, `sourceRfe` (must start with `"RHAIRFE-"`).
- `priority` must be one of: `Blocker`, `Critical`, `Major`, `Minor`, `Normal`, `Undefined`.
- `recommendation` must be one of: `"approve"`, `"revise"`, `"reject"`.
- `needsAttention` must be a boolean.
- Each dimension score 0–2; `total` 0–8.
- `labels` must be an array of ≤50 strings.
- Synthesizes `reviewedAt` from `runTimestamp` if absent.
- Derives `humanReviewStatus` from labels at validation time.

---

### 2.3 RFE Data Route — `GET /rfe-data`

The primary endpoint consumed by `RFEReviewView`. It does **not** hit Jira live — it reads the cached `rfe-data.json` and computes metrics server-side before returning.

**Query params:** `timeWindow` (`"month"` | `"3months"` | `"year"` | `"all"`, default `"3months"`)

**Response shape:**
```json
{
  "fetchedAt": "<ISO 8601>",
  "issues": [ ... ],
  "metrics": {
    "createdPct": 34.5,
    "createdChange": 2.1,
    "trend": "growing",
    "revisedCount": 12,
    "priorRevisedCount": 9,
    "windowTotal": 87,
    "totalRFEs": 312
  },
  "trendData": [
    { "date": "2026-04-14", "createdPct": 31.2, "revisedCount": 3, "total": 22 }
  ],
  "breakdown": [
    { "label": "AI Created", "value": 24 },
    { "label": "AI Revised", "value": 12 },
    { "label": "Created & Revised", "value": 5 },
    { "label": "No AI", "value": 46 }
  ]
}
```

**Metrics computation** (`server/metrics.js` — `computeAllMetrics(issues, timeWindow, config)`):
- Filters issues to the selected window vs. the prior window of equal length.
- `createdPct` = percentage of issues with any AI involvement (`created`, `revised`, or `both`) in the current window.
- `createdChange` = delta vs. prior window in percentage points.
- `trend` = `"growing"` | `"declining"` | `"stable"` based on `trendThresholdPp` config.
- `trendData` = weekly buckets (13 buckets for 3 months, 8 for month, 4 for week).
- `breakdown` = four-slice pie data: Created & Revised / AI Created / AI Revised / No AI.

---

### 2.4 Jira Refresh Flow

Refreshing pulls live data from Jira and re-writes the caches. It runs **asynchronously** — the POST returns immediately and the client polls for status.

**Routes:**
- `POST /refresh` — starts the background job; sets `refreshState.running = true`
- `GET /refresh/status` — returns `{ running, startedAt, lastResult }`

**Steps inside the background job:**

1. **Fetch RFE issues** (`server/jira/rfe-fetcher.js` — `fetchRFEData()`):
   - Builds JQL using config values (all config strings pre-validated against JQL injection pattern).
   - Uses cursor-based pagination (`nextPageToken`) via shared `fetchAllJqlResults()`.
   - For each issue: extracts labels, classifies `aiInvolvement`, extracts label timestamps from changelog.

2. **Resolve linked features** (`server/jira/link-resolver.js` — `resolveLinkedFeatures()`):
   - Reads `issuelinks` from each RFE, filters for the configured `linkTypeName` (`Cloners`) targeting the configured `linkedProject` (`RHAISTRAT`).
   - Batches keys (max 50 per JQL `IN` query) to avoid N+1 Jira requests.
   - Maps `summary`, `status`, `fixVersions` back onto each issue's `linkedFeature` field.
   - Strips internal `_rawIssueLinks` field.

3. **Write RFE cache** — atomic write to `ai-impact/rfe-data.json`.

4. **Fetch autofix issues** (`server/jira/autofix-fetcher.js` — `fetchAutofixData()`):
   - JQL targets `autofixProjects` (e.g., `AIPCC`, `RHOAIENG`), optionally with `autofixCreatedAfter`.
   - Classifies each issue's `pipelineState` from labels.

5. **Write autofix cache** — atomic write to `ai-impact/autofix-data.json`.

6. **Update `refreshState.lastResult`** with counts and any errors.

**DEMO_MODE** disables the refresh entirely — a 400 is returned so demo environments never make external API calls.

---

### 2.5 Config Routes — `GET|POST|DELETE /config`

- `GET /config` — returns merged saved config + defaults (admin only).
- `POST /config` — validates all fields (JQL injection guard, type checks, range checks), saves to `ai-impact/config.json`.
- `DELETE /cache` — clears `rfe-data.json` and `autofix-data.json` without touching assessments.

---

## 3. Live Data Write Paths

There are four distinct paths that write to `data/ai-impact/`. Each is triggered differently, uses different write mechanics, and guards its inputs differently.

---

### 3.1 Overview

| File | Writer | Trigger | Write method |
|---|---|---|---|
| `assessments.json` | External AI pipeline | `POST /assessments/bulk` or `PUT /assessments/:key` | `writeAssessmentsAtomic()` |
| `features.json` | External AI pipeline | `POST /features/bulk` or `PUT /features/:key` | `writeFeaturesAtomic()` |
| `rfe-data.json` | Backend Jira fetcher | `POST /refresh` (admin UI or CronJob) | `writeToStorage()` |
| `autofix-data.json` | Backend Jira fetcher | `POST /refresh` (admin UI or CronJob) | `writeToStorage()` |
| `config.json` | Admin via Settings UI | `POST /config` | `writeToStorage()` |

---

### 3.2 Atomic Write Mechanics

Assessments and features use a **temp-file-then-rename** strategy (`writeAssessmentsAtomic` / `writeFeaturesAtomic` in `server/assessments/storage.js` and `server/features/storage.js`):

```js
const tmpPath = filePath + '.tmp.' + process.pid;
fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
fs.renameSync(tmpPath, filePath);
```

- `writeFileSync` writes to a temp file with the process PID in the name (prevents collisions between concurrent processes).
- `renameSync` is atomic on POSIX filesystems — a reader can never see a partial file.
- The `data/ai-impact/` directory is created automatically if it doesn't exist yet.

RFE/autofix cache and config use the shared `writeToStorage()` helper (non-atomic `writeFileSync` directly to the target path) — acceptable because these are full-replacement refreshes where a brief mid-write window is tolerable.

---

### 3.3 Path A — Assessment Bulk Upsert

**Endpoint:** `POST /api/modules/ai-impact/assessments/bulk`
**Source:** `modules/ai-impact/server/assessments/routes.js`

**Request shape:**
```json
{ "assessments": [ { "id": "RHAIRFE-1001", "scores": {...}, "total": 6, "passFail": "PASS", "assessedAt": "<ISO 8601>", ... } ] }
```

**Step-by-step execution:**

```
1. Guard checks
   ├─ DEMO_MODE=true → return 200 { status: 'skipped' }  (no write)
   ├─ body.assessments not an array → 400
   └─ assessments.length > 5000 → 400

2. Read current state
   └─ readAssessments(readFromStorage)
        ├─ Reads ai-impact/assessments.json from disk
        └─ If missing/malformed → returns { lastSyncedAt: null, totalAssessed: 0, assessments: {} }

3. Per-entry loop
   └─ For each entry in assessments[]:
        ├─ Missing entry.id → push to errors[], skip
        ├─ validateAssessment(entry)
        │    ├─ Each score (what/why/how/task/size) must be integer 0–2
        │    ├─ total must equal sum of scores and be in range 0–10
        │    ├─ passFail must be "PASS" or "FAIL"
        │    ├─ assessedAt must be valid ISO 8601
        │    └─ On failure → push { id, errors } to errors[], skip
        └─ upsertAssessment(data, entry.id, validatedData)  ← mutates data in place

4. Update metadata
   ├─ data.lastSyncedAt = new Date().toISOString()
   └─ data.totalAssessed = Object.keys(data.assessments).length

5. Atomic write
   └─ writeAssessmentsAtomic(data)
        ├─ Write to data/ai-impact/assessments.json.tmp.<pid>
        └─ Rename to data/ai-impact/assessments.json

6. Return { created, updated, unchanged, errors }
```

**Single upsert** (`PUT /assessments/:key`) follows the same flow for one entry, using `req.params.key` as the RFE key.

---

### 3.4 Upsert Decision Tree (Assessments & Features)

Both `upsertAssessment` and `upsertFeature` follow identical logic. The idempotency key is `assessedAt` for assessments and `reviewedAt` for features.

```
upsertAssessment(data, rfeKey, incoming)
│
├─ No existing entry for rfeKey?
│    └─ Create: data.assessments[rfeKey] = { latest: incoming, history: [] }
│       → return "created"
│
├─ existing.latest.assessedAt === incoming.assessedAt?
│    └─ Exact duplicate → return "unchanged"  (no write)
│
├─ incoming is NEWER than existing.latest?
│    ├─ Rotate: history = [trim(existing.latest), ...existing.history]
│    ├─ Cap:    history = history.slice(0, 20)
│    ├─ Replace: existing.latest = incoming
│    └─ return "updated"
│
└─ incoming is OLDER than existing.latest
     ├─ Already in history (assessedAt match)? → return "unchanged"
     ├─ History is full (≥20) AND incoming ≤ oldest entry?
     │    └─ Smart eviction: discard → return "unchanged"
     └─ Insert at correct position (newest-first), cap at 20
        → return "updated"
```

**History trim** — when rotating `latest` into `history`, or inserting an older entry, only a slim snapshot is kept (prevents unbounded file growth):

| Full field | Kept in history? |
|---|---|
| `scores` | Yes |
| `total` | Yes |
| `passFail` | Yes |
| `assessedAt` / `reviewedAt` | Yes |
| `antiPatterns`, `criterionNotes` | No (assessments) |
| `verdict`, `feedback` | No (assessments) |
| `recommendation`, `needsAttention`, `humanReviewStatus` | Yes (features) |
| `title`, `sourceRfe`, `priority`, `labels`, `runId` | No (features) |

---

### 3.5 Path B — Feature Bulk Upsert

**Endpoint:** `POST /api/modules/ai-impact/features/bulk`
**Source:** `modules/ai-impact/server/features/routes.js`

Identical structure to assessment bulk upsert with two differences:

- **Key field**: accepts either `entry.key` or `entry.strat_id` (legacy snake_case); `validateFeature()` normalises all snake_case fields to camelCase before upsert.
- **Idempotency key**: `reviewedAt` (synthesized from `runTimestamp` if absent during validation).

```
1. Guard: DEMO_MODE, array check, cap check (same as assessments)
2. readFeatures(readFromStorage)
3. Per-entry: validateFeature(entry) → upsertFeature(data, result.data.key, result.data)
4. data.lastSyncedAt, data.totalFeatures updated
5. writeFeaturesAtomic(data)
6. Return { created, updated, unchanged, errors }
```

---

### 3.6 Path C — Jira Refresh (rfe-data.json + autofix-data.json)

**Endpoint:** `POST /api/modules/ai-impact/refresh`
**Source:** `modules/ai-impact/server/index.js`

The refresh is **non-blocking** — the endpoint returns immediately and the job runs in the background. The client polls `GET /refresh/status` to track progress.

```
POST /refresh
  │
  ├─ DEMO_MODE=true → 400 (no write)
  ├─ Already running → 409
  └─ Set refreshState = { running: true, startedAt: now }
     Return 202 immediately

Background async job:
  │
  ├─ 1. getConfig(readFromStorage) — load jiraProject, labels, excludedStatuses, etc.
  │
  ├─ 2. fetchRFEData(jiraRequest, config)         [server/jira/rfe-fetcher.js]
  │       ├─ Build JQL (all config values pre-validated against /["'();\\]/)
  │       │    "project = RHAIRFE AND status NOT IN (...) AND created >= -Xm AND labels != testLabel"
  │       ├─ fetchAllJqlResults() — cursor-paginated via nextPageToken
  │       ├─ Per issue: classifyAIInvolvement(labels) → "created"|"revised"|"both"|"none"
  │       └─ Extract label timestamps from issue changelog
  │
  ├─ 3. resolveLinkedFeatures(jiraRequest, issues, config)  [server/jira/link-resolver.js]
  │       ├─ Collect all RHAISTRAT keys from issuelinks (Cloners link type)
  │       ├─ Batch JQL: "key IN (RHAISTRAT-x, RHAISTRAT-y, ...)"  max 50 keys per request
  │       ├─ Map summary, status, fixVersions onto each RFE's linkedFeature field
  │       └─ Delete _rawIssueLinks from each issue
  │
  ├─ 4. writeToStorage('ai-impact/rfe-data.json', { fetchedAt, issues: withLinks })
  │
  ├─ 5. fetchAutofixData(jiraRequest, config)     [server/jira/autofix-fetcher.js]
  │       ├─ JQL: "project IN (AIPCC, RHOAIENG) [AND created >= autofixCreatedAfter]"
  │       └─ Per issue: classifyPipelineState(labels)
  │
  ├─ 6. writeToStorage('ai-impact/autofix-data.json', { fetchedAt, issues: autofixIssues })
  │
  └─ 7. refreshState = { running: false, lastResult: { rfeCount, autofixCount, completedAt } }
         (or { error } on failure)
```

**Triggers:**
- Admin clicks "Refresh" in `AIImpactSettings.vue` → `POST /refresh` + polls `/refresh/status`
- OpenShift **CronJob** (`deploy/openshift/overlays/prod/cronjob-sync-refresh.yaml`) runs daily at **06:00 UTC** as Step 3 in the full sync sequence, using `X-Proxy-Secret` for auth

---

### 3.7 Path D — Config Write

**Endpoint:** `POST /api/modules/ai-impact/config`
**Source:** `modules/ai-impact/server/config.js`

```
POST /config  (requireAdmin)
  │
  ├─ saveConfig(writeToStorage, req.body)
  │    ├─ Validate jiraProject, linkedProject, createdLabel, revisedLabel,
  │    │  testExclusionLabel, linkTypeName: each must pass /["'();\\]/  (JQL injection guard)
  │    ├─ Validate excludedStatuses: array of JQL-safe strings
  │    ├─ Validate lookbackMonths: integer 1–120
  │    ├─ Validate trendThresholdPp: number 0–50
  │    ├─ Validate autofixProjects: array of JQL-safe strings
  │    └─ Validate autofixCreatedAfter: JQL-safe string or null
  └─ writeToStorage('ai-impact/config.json', validatedConfig)
```

Config is always merged with hardcoded defaults before being returned by `getConfig()`, so missing keys never cause `undefined` reads elsewhere.

---

### 3.8 Cache Clear

**Endpoint:** `DELETE /api/modules/ai-impact/cache`

```js
writeToStorage('ai-impact/rfe-data.json',    null);
writeToStorage('ai-impact/autofix-data.json', null);
```

Sets both cache files to `null` (effectively empty). The next `GET /rfe-data` or `GET /autofix-data` will return empty data until a refresh is triggered. Assessments and features are **not** touched.

---

## 4. Authentication & Authorization

All routes share the same two-layer auth stack defined in `shared/server/auth.js` and wired in `server/dev-server.js`. Every request passes through both layers before reaching a route handler.

```
Request
  │
  ├─ Layer 1: proxySecretGuard   (dev-server.js:74)
  │     Validates X-Proxy-Secret header OR a Bearer tt_ token inline.
  │     Rejects 401 immediately if neither matches (when PROXY_AUTH_SECRET is set).
  │
  ├─ Layer 2: authMiddleware     (dev-server.js:173)
  │     Resolves identity → sets req.userEmail + req.isAdmin.
  │
  └─ Layer 3: requireAdmin       (on individual admin routes)
        Returns 403 if req.isAdmin is false.
```

---

### 4.1 Layer 1 — `proxySecretGuard`

Only active when the `PROXY_AUTH_SECRET` environment variable is set (production). Allows the request through if **either** condition is met:

- `X-Proxy-Secret` header matches the secret — used by the internal OpenShift CronJob `curl` calls.
- `Authorization: Bearer tt_<token>` is present and the token passes inline validation — used by the external AI pipeline.

If neither matches → **401**, the request never reaches `authMiddleware`. In local dev (no `PROXY_AUTH_SECRET`) this layer is a no-op.

---

### 4.2 Layer 2 — `authMiddleware` (identity resolution)

Determines who is making the request. Evaluated in priority order:

| Condition | Identity source | `req.authMethod` |
|---|---|---|
| `Authorization: Bearer tt_...` header | API token store (`server/api-tokens.js`) | `"token"` |
| `X-Forwarded-Email` header present | OpenShift OAuth proxy (production) | `"proxy"` |
| Neither | First email in `ADMIN_EMAILS` env var, or `local-dev@redhat.com` | `"local-dev"` |

**API token path:**
- The raw `tt_` token is looked up in the token store.
- The token record's `ownerEmail` is used to resolve `req.userEmail`.
- `req.isAdmin` is set by checking `ownerEmail` against `data/allowlist.json`.
- `lastUsedAt` is updated fire-and-forget (throttled).
- **Invalid token → hard 401, never falls through** — prevents a bad token from accidentally inheriting local-dev admin access.

**Proxy / local-dev path:**
- `X-Forwarded-Email` is set by the OpenShift OAuth proxy in production.
- In local dev the fallback email is used, and if `data/allowlist.json` is empty the first user is auto-added as admin (first-boot convenience).

---

### 4.3 Layer 3 — `requireAdmin` (route-level authorization)

Applied directly on every write and admin route:

```js
// assessments/routes.js
router.post('/assessments/bulk', requireAdmin, ...)
router.put('/assessments/:key',  requireAdmin, ...)
router.delete('/assessments',    requireAdmin, ...)
router.get('/assessments/status', requireAdmin, ...)

// features/routes.js  (same pattern)
router.post('/features/bulk',    requireAdmin, ...)
router.put('/features/:key',     requireAdmin, ...)
router.delete('/features',       requireAdmin, ...)
router.get('/features/status',   requireAdmin, ...)
```

`requireAdmin` checks `req.isAdmin`. If false → **403 Admin access required.**

Read-only routes (`GET /assessments`, `GET /assessments/:key`, `GET /features`, `GET /features/:key`, `GET /rfe-data`) have no `requireAdmin` — any authenticated session can read.

---

### 4.4 How the External AI Pipeline Authenticates

The pipeline (outside this repo) pushes assessment and feature data via the bulk upsert endpoints. Setup:

1. A human admin creates an API token via `POST /api/tokens` while logged in as an allowlisted user.
2. The raw `tt_...` token is returned **once** and stored in the pipeline's secret store.
3. Every bulk push sends it as a Bearer header, plus `X-Proxy-Secret` in production:

```
POST /api/modules/ai-impact/assessments/bulk
Authorization: Bearer tt_<token>
X-Proxy-Secret: <secret>          ← required in production
Content-Type: application/json
```

`proxySecretGuard` accepts the request (valid token inline), `authMiddleware` resolves the owner email, `isAdmin` is confirmed, and `requireAdmin` passes.

---

### 4.5 Auth Behaviour by Environment

| Environment | `proxySecretGuard` | Identity source | Admin check |
|---|---|---|---|
| **Production** | Active — requires `X-Proxy-Secret` or valid `tt_` token | OAuth proxy (`X-Forwarded-Email`) or API token | `data/allowlist.json` |
| **Local dev** | Disabled (no `PROXY_AUTH_SECRET`) | `ADMIN_EMAILS` env var fallback | `data/allowlist.json` (auto-seeded on first boot) |
| **Demo mode** | Disabled | `ADMIN_EMAILS` fallback | Same, but refresh/write endpoints return 400 |

---

## 5. UI Tier

### 5.1 Module Registration

**`modules/ai-impact/module.json`** registers the module. The `navItems` array drives the left sidebar:

```json
{
  "navItems": [
    { "id": "rfe-review",      "label": "RFE Review",      "default": true },
    { "id": "feature-review",  "label": "Feature Review" },
    { "id": "implementation",  "label": "Implementation",  "disabled": true },
    { "id": "autofix",         "label": "Jira AutoFix",    "separatorBefore": true }
  ],
  "settingsComponent": "./client/components/AIImpactSettings.vue"
}
```

**`modules/ai-impact/client/index.js`** maps view IDs to async components:

```js
export const routes = {
  'rfe-review':     defineAsyncComponent(() => import('./views/RFEReviewView.vue')),
  'feature-review': defineAsyncComponent(() => import('./views/FeatureReviewView.vue')),
  'autofix':        defineAsyncComponent(() => import('./views/AutofixView.vue')),
  'implementation': defineAsyncComponent(() => import('./views/ComingSoonView.vue')),
}
```

Hash routing: `#/ai-impact/rfe-review?select=RHAIRFE-1042`

---

### 5.2 Composables (Data Layer)

Composables are the bridge between API responses and Vue components. They live in `modules/ai-impact/client/composables/`.

#### `useAIImpact(timeWindow)`
- **Fetches:** `GET /api/modules/ai-impact/rfe-data?timeWindow={tw}`
- **Returns:** `{ rfeData, loading, error, refreshStatus, load(), refresh(), checkRefreshStatus() }`
- Watches the reactive `timeWindow` ref; auto-refetches when it changes.
- `refresh()` posts to `/refresh` then begins polling `/refresh/status` every 2 seconds until `running` is false.

#### `useAssessments()`
- **Fetches:** `GET /api/modules/ai-impact/assessments` on initial load (slim projection).
- **Fetches:** `GET /api/modules/ai-impact/assessments/:key` lazily when a detail modal is opened.
- Detail responses are cached in a `Map` keyed by RFE key to avoid redundant requests.
- **Returns:** `{ assessments, assessmentMeta, loadAssessments(), loadAssessmentDetail(key) }`

#### `useFeatures()`
- Same pattern as `useAssessments()` but for features.
- **Fetches:** `/api/modules/ai-impact/features` and `/api/modules/ai-impact/features/:key`.

#### `useAutofix(timeWindow)`
- **Fetches:** `GET /api/modules/ai-impact/autofix-data?timeWindow={tw}`
- Watches `timeWindow`, auto-refetches.

---

### 5.3 RFEReviewView (`views/RFEReviewView.vue`)

The top-level view for the RFE Review tab. It:

1. Injects `moduleNav` from the app shell — provides `navigateTo(viewId, params)`, `goBack()`, and reactive `params`.
2. Instantiates `useAIImpact(timeWindow)`, `useAssessments()`, and `useFeatures()`.
3. Manages filter state: `aiInvolvement`, `search`, `timeWindow`, `passFailFilter`, `priorityFilter`, `statusFilter`.
4. Computes `filteredRFEs` from the raw issue list using the active filters.
5. Watches `moduleNav.params.value.select` — if another view navigates here with `?select=RHAIRFE-xxxx`, it auto-selects that RFE and opens the detail modal.
6. Renders `<PhaseContent>` (layout + list) and `<RFEDetailModal>` (detail panel).

---

### 5.4 Key Components

#### `PhaseContent.vue`
Main layout wrapper for the RFE Review tab.

```
Header (time window selector)
  └─ MetricsRow (KPI cards: AI %, trend arrow, revised count, total)
       └─ TrendCharts (collapsible)
            ├─ Line chart: createdPct + revisedCount over time
            └─ Pie chart: AI involvement breakdown
  └─ RFEList
       └─ RFEListItem × N (one row per filtered RFE)
```

Props received from `RFEReviewView`: all filter/sort state (9 values), `rfeData`, `metrics`, `trendData`, `breakdown`, `filteredRFEs`, `loading`, `error`.

Emits: `update:timeWindow`, `update:search`, `update:aiInvolvement`, `update:passFailFilter`, `update:priorityFilter`, `update:statusFilter`, `selectRFE`, `retry`.

#### `RFEList.vue` / `RFEListItem.vue`
Filterable, sortable table. Each row shows:
- RFE key (links to Jira), summary, status, priority, AI involvement badge.
- Assessment indicator: coloured dot showing `passFail` result if an assessment exists.

Clicking a row emits `selectRFE(key)` — the view opens the detail modal.

#### `RFEDetailModal.vue`
Teleported overlay (renders outside the component tree at the `<body>` level).

- Opens when `selectedRFE` is set by a row click or a `?select=` navigation.
- Lazily calls `loadAssessmentDetail(key)` on open — fetches full rubric detail and history.
- Displays:
  - **Header:** RFE key, summary, status, priority, AI involvement badge.
  - **Linked Feature:** If present, shows feature key + title + a cross-link button that calls `moduleNav.navigateTo('feature-review', { select: featureKey })`.
  - **Assessment Scores:** Rendered by `<AssessmentBreakdown>` — five criterion bars (what/why/how/task/size) each showing 0–2 score with color coding (green/amber/red).
  - **Anti-patterns:** Badge list.
  - **Verdict & Feedback:** Free-text fields.
  - **History:** Rendered by `<AssessmentHistory>` — timeline of past rubric runs with score deltas.
- Keyboard: `Escape` closes; `Tab` wraps within the modal (focus trap); focus is restored to the triggering row on close.

#### `MetricsRow.vue`
Four KPI cards driven by the server-computed `metrics` object:
- **AI Involvement %** — percentage of RFEs in the window with any AI label.
- **Trend** — growing / stable / declining with directional arrow icon.
- **AI Revised** — count of RFEs with the revised label.
- **Total RFEs** — total in the selected window.

#### `TrendCharts.vue`
Two charts rendered via Chart.js + vue-chartjs:
- Line chart: `createdPct` and `revisedCount` as two Y-axes over weekly buckets.
- Pie chart: Four-slice breakdown (Created & Revised / AI Created / AI Revised / No AI).

#### `AIImpactSettings.vue`
Admin panel registered via `settingsComponent` in `module.json`. Provides:
- Config editor: load/edit/save all config fields with field-level validation feedback.
- Refresh controls: trigger Jira refresh, poll `/refresh/status`, display running state and result.
- Cache management: clear `rfe-data.json` + `autofix-data.json`.
- Assessment & Feature status: total counts, last sync time, and a destructive "clear all" per data type.

---

### 5.5 Cross-Navigation Pattern

RFE Review and Feature Review are linked: a linked feature shown in the RFE detail modal has a button that takes the user to the Feature Review tab with that feature pre-selected, and vice versa.

**Outbound (RFE → Feature):**
```js
moduleNav.navigateTo('feature-review', { select: linkedFeature.key })
// Produces hash: #/ai-impact/feature-review?select=RHAISTRAT-1168
```

**Inbound handling in FeatureReviewView:**
```js
watch(
  () => moduleNav.params.value.select,
  (key) => { if (key && features.value.length) selectFeature(key) }
)
watch(features, () => {
  const key = moduleNav.params.value.select
  if (key) selectFeature(key)
})
```

Two watchers handle the race condition: params may arrive before or after data loads.

---

## 6. End-to-End Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  JIRA CLOUD (redhat.atlassian.net)                                       │
│  project=RHAIRFE, RHAISTRAT, AIPCC, RHOAIENG                           │
└────────────────────────┬────────────────────────────────────────────────┘
                         │  Basic Auth (JIRA_EMAIL + JIRA_TOKEN)
                         │  /rest/api/3/search/jql  (cursor-paginated)
                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BACKEND: Jira Refresh (async, non-blocking)                             │
│                                                                          │
│  POST /api/modules/ai-impact/refresh                                     │
│    │                                                                     │
│    ├─ rfe-fetcher.js                                                    │
│    │    ├─ JQL: project=RHAIRFE, excludedStatuses, lookbackMonths       │
│    │    ├─ classifyAIInvolvement() from labels                          │
│    │    └─ extract label timestamps from changelog                      │
│    │                                                                     │
│    ├─ link-resolver.js                                                  │
│    │    ├─ Extract Cloners links → RHAISTRAT keys                       │
│    │    ├─ Batch JQL IN (≤50 keys/request)                             │
│    │    └─ Map linkedFeature onto each RFE                              │
│    │                                                                     │
│    ├─ Write atomic → data/ai-impact/rfe-data.json                       │
│    │                                                                     │
│    ├─ autofix-fetcher.js                                                │
│    │    ├─ JQL: project IN (AIPCC, RHOAIENG)                           │
│    │    └─ classifyPipelineState() from labels                          │
│    │                                                                     │
│    └─ Write atomic → data/ai-impact/autofix-data.json                  │
│                                                                          │
│  GET /api/modules/ai-impact/refresh/status   ← client polls             │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                    Caches written to disk
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│  DATA FILES (data/ai-impact/)                                            │
│                                                                          │
│  rfe-data.json          ← Jira RFE cache                                │
│  autofix-data.json      ← Jira autofix/triage cache                     │
│  assessments.json       ← AI rubric scores (upserted by pipeline/admin) │
│  features.json          ← Feature review results (upserted by pipeline) │
│  config.json            ← Admin-editable module config                  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
         Read on every client request (no in-process cache)
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│  BACKEND: Read & Compute                                                 │
│                                                                          │
│  GET /api/modules/ai-impact/rfe-data?timeWindow=3months                 │
│    ├─ readFromStorage('ai-impact/rfe-data.json')                        │
│    ├─ computeAllMetrics(issues, timeWindow, config)                     │
│    │    ├─ Filter to current window vs. prior window                    │
│    │    ├─ Compute createdPct, createdChange, trend                     │
│    │    ├─ Build weekly trendData buckets                               │
│    │    └─ Build four-slice breakdown                                   │
│    └─ Return { issues, metrics, trendData, breakdown }                  │
│                                                                          │
│  GET /api/modules/ai-impact/assessments                                 │
│    ├─ readAssessments()                                                 │
│    └─ getLatestProjection() → slim list (scores, total, passFail)       │
│                                                                          │
│  GET /api/modules/ai-impact/assessments/:key                            │
│    └─ Full latest + full history for one RFE                            │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                         HTTP JSON responses
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│  UI: Composables (client/composables/)                                   │
│                                                                          │
│  useAIImpact(timeWindow)    → rfeData, metrics, trendData, breakdown    │
│  useAssessments()           → assessments (slim), loadAssessmentDetail() │
│  useFeatures()              → features (slim), loadFeatureDetail()       │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                       Reactive Vue state
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│  UI: RFEReviewView                                                       │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  PhaseContent                                             │           │
│  │  ├─ MetricsRow  (AI %, trend, revised count, total)      │           │
│  │  ├─ TrendCharts (line + pie, Chart.js)   [collapsible]   │           │
│  │  └─ RFEList                                              │           │
│  │       └─ RFEListItem × N  (key, summary, badges, dot)   │           │
│  └──────────────────────────────────────────────────────────┘           │
│                                                                          │
│  User clicks row → selectRFE(key)                                        │
│                               │                                          │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  RFEDetailModal (teleported overlay)                      │           │
│  │  ├─ lazy fetch: loadAssessmentDetail(key)                │           │
│  │  ├─ RFE metadata (status, priority, AI badge)            │           │
│  │  ├─ Linked feature + cross-link button                   │           │
│  │  ├─ AssessmentBreakdown (5 criterion bars, color coded)  │           │
│  │  ├─ Anti-patterns + verdict + feedback                   │           │
│  │  └─ AssessmentHistory (timeline of past runs)            │           │
│  └──────────────────────────────────────────────────────────┘           │
│                                                                          │
│  Cross-link click → moduleNav.navigateTo('feature-review', { select })  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Why |
|----------|-----|
| **Atomic writes** (temp file + rename) | Prevents partial/corrupt reads if the process crashes mid-write |
| **History cap at 20 + smart eviction** | Bounds file size; eviction prevents inserting an entry that would be immediately dropped |
| **Idempotency by timestamp** | Pipeline can safely retry bulk upserts without creating duplicate history entries |
| **Async refresh with polling** | Jira fetches can take 10–30 seconds; non-blocking keeps the API responsive |
| **JQL injection guard** | All config strings validated against `/["'();\\]/` before interpolation into JQL queries |
| **Server-side metrics computation** | Keeps metric logic in one place; clients receive ready-to-render numbers |
| **Client-side filter recompute** | When filters narrow the visible set, metrics are re-derived client-side to reflect only visible data — mirrors server logic |
| **Lazy detail loading + Map cache** | Full assessment/feature detail is large; only fetched on demand, then cached to avoid repeat requests |
| **Two watchers for cross-navigation** | Params and data may arrive in either order; both watchers handle the race so selection always triggers |
| **Teleported modal** | Renders at `<body>` level to avoid z-index and overflow clipping issues from ancestor containers |
| **Two-layer auth (guard + middleware)** | `proxySecretGuard` rejects unauthenticated requests at the perimeter; `authMiddleware` resolves identity; `requireAdmin` gates each sensitive route — concerns are separated and each layer has a single responsibility |
| **Hard 401 on invalid `tt_` token** | Prevents a malformed or expired token from falling through to the local-dev identity fallback, which would grant unintended admin access |
| **API tokens as pipeline credentials** | Allows the external AI pipeline to push data without sharing a user's OAuth session; tokens are scoped to an owner email and checked against the same allowlist as human admins |
