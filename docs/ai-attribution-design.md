# AI Attribution in Upstream Pulse — Design Spec

## Context

AIPCC has asked associates to add `Co-authored-by:` lines in commit messages when AI assists with code. We need to surface this data in the org-pulse dashboard so teams can track AI adoption over time, broken down by org, project, and contributor.

We were directed that this should NOT be a new module — it should be added as new fields directly into the existing upstream-pulse system.

### Repositories

- **upstream-pulse** ([dpanshug/upstream-pulse](https://github.com/dpanshug/upstream-pulse)) — Fastify + TypeScript backend, PostgreSQL, BullMQ jobs, Drizzle ORM
- **org-pulse** ([red-hat-data-services/rhai-org-pulse](https://github.com/red-hat-data-services/rhai-org-pulse)) — Vue.js + Express dashboard framework with modular plugin architecture
- **dev-pulse** ([EmilienM/dev-pulse](https://github.com/EmilienM/dev-pulse)) — Reference implementation of AI attribution detection (`detect_ai_coauthor()`)

### Data Flow

```
GitHub Repos
    |
    v
upstream-pulse backend (GitHub collector + AI detector)
    |
    v
PostgreSQL (contributions table with ai attribution columns)
    |
    v
upstream-pulse API (enriched metrics endpoints)
    |
    v
org-pulse upstream-pulse module (caching proxy)
    |
    v
Vue.js Dashboard (summary cards + table columns)
```

## 1. Database Schema Changes

Add two columns to the existing `contributions` table:

```sql
ALTER TABLE contributions ADD COLUMN is_ai_assisted BOOLEAN DEFAULT FALSE;
ALTER TABLE contributions ADD COLUMN ai_tool_name VARCHAR(100) DEFAULT NULL;
```

- `is_ai_assisted` — `true` when any AI attribution signal is detected in the commit message
- `ai_tool_name` — the first matched AI tool name (e.g., `"Claude"`, `"GitHub Copilot"`, `"Cursor"`), normalized to a canonical form. `NULL` if not AI-assisted. If a commit has multiple AI Co-authored-by trailers, only the first match is stored — this keeps the schema simple for v1 while still capturing the primary signal.

Implemented as a Drizzle ORM migration. No new tables.

## 2. AI Attribution Detector

New internal module at `backend/src/modules/ai-attribution/`.

### `patterns.ts`

Exports detection patterns as constants:

**Trailer patterns** (8, case-insensitive):
- `Co-Authored-By`
- `Generated-By`
- `Assisted-By`
- `AI-Agent`
- `Generated with`
- `Created with`
- `Built with`
- `Powered by`

**AI tool list** (27+, compiled into a single regex):
- LLM providers: `Claude`, `ChatGPT`, `Bard`, `Gemini`, `GPT-*`, `OpenAI`, `Anthropic`
- Code assistants: `GitHub Copilot`, `Copilot`, `Codeium`, `Tabnine`, `Cursor`, `Windsurf`, `Replit`
- Vendor-specific: `Amazon CodeWhisperer`, `JetBrains AI`, `Sourcegraph Cody`, `Vercel V0`
- Generic terms: `AI Assistant`, `AI Code`, `Large Language Model`, `LLM`, `Machine Learning`

### `detector.ts`

```typescript
interface AiAttributionResult {
  isAiAssisted: boolean;
  aiToolName: string | null;
}

function detectAiAttribution(commitMessage: string): AiAttributionResult
```

Logic:
1. Split commit message by newlines
2. For each line, check against all 8 trailer patterns (case-insensitive)
3. Extract the trailer value, strip any trailing `Signed-off-by` trailers
4. Match the extracted value against the compiled AI tool regex
5. Return the first match found, with the tool name normalized to canonical form
6. Return `{ isAiAssisted: false, aiToolName: null }` if no match

## 3. Collector Integration

### Collection-time hook

In `collection-worker.ts`, after commits are fetched via Octokit and before database insertion in `resolveAndStore()`:

1. Extract `commit.commit.message` from the GitHub API response
2. Call `detectAiAttribution(message)`
3. Populate `is_ai_assisted` and `ai_tool_name` on the contribution record before insert

This is a single function call added to the existing flow — no structural changes to the collector.

### Backfill endpoint

```
POST /api/admin/backfill-ai-attribution
  Query: ?projectId=UUID (optional, scopes to one project)
  Auth: admin-protected
```

Implementation:
- Query all existing contributions where `contribution_type = 'commit'`
- For each, run `detectAiAttribution()` on `metadata.message`
- Batch-update `is_ai_assisted` and `ai_tool_name` (e.g., 500 records per batch)
- For large datasets, dispatch as a BullMQ job with progress tracking via the `collection_jobs` table
- Return: `{ jobId: string, recordsQueued: number }`

This also serves as the re-scan mechanism when new detection patterns are added.

## 4. API Enrichment

Enrich existing endpoints with AI attribution rollups. No new endpoints.

### GET `/api/metrics/dashboard`

Add to response:

```typescript
aiAttribution: {
  totalAiCommits: number;
  totalCommits: number;
  aiCommitPercentage: number;      // totalAiCommits / totalCommits * 100
  byTool: Array<{
    tool: string;
    count: number;
  }>;
}
```

Scoped by existing query params (`timeRange`, `projectId`, `org`), so it automatically supports per-project and per-org filtering.

### GET `/api/metrics/dashboard` → `topContributors[]`

Add to each contributor object:

```typescript
aiCommits: number;
aiCommitPercentage: number;
```

### GET `/api/metrics/me`

Add to personal metrics response:

```typescript
aiAttribution: {
  aiCommits: number;
  aiCommitPercentage: number;
  primaryAiTool: string | null;
}
```

All queries are straightforward aggregations using `WHERE is_ai_assisted = true` and `GROUP BY ai_tool_name`, applied with the same filters the endpoints already use.

## 5. Frontend — org-pulse upstream-pulse module

All changes within the existing Dashboard view. No new views or pages.

### Summary cards

Add a row of cards alongside existing dashboard metrics:

| Card | Value | Source |
|------|-------|--------|
| AI-Assisted Commits | count (e.g., `142`) | `aiAttribution.totalAiCommits` |
| AI Commit Rate | percentage (e.g., `38%`) | `aiAttribution.aiCommitPercentage` |
| Top AI Tool | tool name (e.g., `Claude`) | `aiAttribution.byTool[0].tool` |

### Table columns

Add two columns to the existing contributors table:

| Contributor | Commits | PRs | Reviews | AI Commits | AI % |
|---|---|---|---|---|---|
| Alice | 45 | 12 | 8 | 12 | 27% |

Same two columns added to the existing projects table:

| Project | Commits | PRs | Issues | AI Commits | AI % |
|---|---|---|---|---|---|

### Proxy passthrough

The org-pulse upstream-pulse module's `server/index.js` is a caching proxy — no changes needed there. The new fields flow through automatically as part of the existing dashboard API response.

## Testing Strategy

- **Unit tests** for `detectAiAttribution()`: cover all 8 trailer patterns, all AI tools, edge cases (no match, multiple matches, case variations, partial matches)
- **Integration tests** for the collector hook: verify commits are stored with correct `is_ai_assisted` and `ai_tool_name`
- **API tests** for enriched endpoints: verify `aiAttribution` fields appear in dashboard and contributor responses
- **Backfill test**: verify historical data is correctly re-scanned

## Initial Rollout

1. Start testing with AIPCC projects (Megan will provide the list)
2. Run backfill on those repos to populate historical data
3. Validate numbers against dev-pulse output for the same repos
4. Expand to other orgs once validated
