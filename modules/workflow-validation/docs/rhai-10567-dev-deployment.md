# RHAI Build Column: Development Deployment

**Status:** Deployed and verified (development)
**Author:** Codex
**Date:** 2026-11-12
**Module:** workflow-validation
**Ticket:** RHAI-10567
**Branch:** `feat/rhai-10898-rhoai-build-column`

---

## 1. Goal

Add one sortable column, `RHOAI build (UTC)`, to the Recent Runs table.
Place it directly after the `Version` column.
Show the build date and time on one line, matching `Executed at (UTC)`.
Keep `(UTC)` in the column heading without repeating it in each row.
Show `unavailable` when the build data is missing or not verified.
Sort by build date, then by time. Put missing values last.
Do not change the default order: `Executed at (UTC)` descending.

## 2. Data Model

OpenSearch has two relevant indexes.

| Index | Purpose | Join key |
| --- | --- | --- |
| `workflow-executions` | Recent validation runs | `invocation_id` |
| `workflow-execution-images` | Image build metadata | `invocation_id` |

The image index stores these fields:

- `_source.invocation_id`
- `_source.operator_image.build_date`
- `_source.operator_image.build_date_status` (`verified` or `unavailable`)

The run index does not store the build fields.
The server must join the two indexes.

Many runs have no matching image document.
These rows show `unavailable`.

The remote indexes contain `operator_image.build_date`.
The latest index version does not add fields.
Use the existing fields.

## 3. Changes

### Server

- `server/opensearch.js`: export `IMAGES_INDEX`.
- `server/index.js`: add `addBuildDates(rows, search, isClosed)`.
  It queries at most 500 `invocation_id` values per request.
  Each invocation group selects its newest verified image build timestamp.
  It validates explicit-zone ISO dates and normalizes them to UTC.
  It runs on the full result set before paging.
  Run groups and build metadata share the existing 10-second cache.
  Failed or disconnected enrichment is not cached.
- `server/recent-runs.js`: add `buildDate` to `SORT_FIELDS`.
  Add `buildDate` to the version 3 cursor.
  Sort missing values last.
  Keep `timestamp`/`desc` as the default.
  Include `buildDate` and `buildDateStatus` in the row projection.

### Client

- `client/views/RecentRunsView.vue`: add the new column after `Version`.
  Use the same single-line UTC formatter as `Executed at (UTC)`.
  Show lowercase `unavailable` when data is missing.
  Add a sort button after `version`. First direction is `desc`.
  Change the empty-row colspan from 4 to 5.
  Set table minimum width to 64rem.

### Tests and Docs

- Update the client and server tests.
- Update `docs/rhai-10567-recent-runs-contract.md`.
- Update `README.md`.

## 4. Test Results

- Focused server and client tests: 130 passed.
- Module browser tests: 39 passed.
- `npm run lint`: passed.
- `npm run validate:openapi`: passed with pre-existing warnings.
- `npm run build`: passed.
- `git diff --check`: passed.
- The full local `npm test` was not used.
  It has 71 pre-existing localStorage failures in 5 unrelated client files.
- CI passed 7,024 unit tests with 11 skipped. Test & Build, module integration,
  smoke tests, and Smoke Test Status all passed for source `21865eac`.

## 5. Deployment

### Cluster

- Source commit: `21865eac27112877cc5a9316b94d56af0eeffbeb`
- Core tag: `v2.0.99`
- Context: `default/api-workval-aipcc-gpuaas-com:6443/ldap-admin1`
- Namespace: `workflow-validation-org-pulse`
- Pod labels: `app=team-tracker,component=backend`

### Backend

- BuildConfig: `org-pulse-backend-builddate-20261111`
- Build: `org-pulse-backend-builddate-20261111-11`
- Image digest: `org-pulse-backend@sha256:ab7d371d08bf6f6a6fd222fb8f6d73ad09f155750d09aca7fa15afd8be06f2d9`
- Rollback digest: `org-pulse-backend@sha256:69d80b77be90a400a1794cb326c7048450be41b69eac2628a9177bd252259c44`

### Frontend

- BuildConfig: `org-pulse-frontend-builddate-20261111`
- Build: `org-pulse-frontend-builddate-20261111-6`
- Image digest: `org-pulse-frontend@sha256:736ef1d41872206e3e05bf4adec69e7e1f71fd3fb7422250513ea10336930803`
- Rollback digest: `org-pulse-frontend@sha256:38b8ee4901e88ed46278431b19e270b2add7c3ec496dbcd4c988512d447d4501`

### Routes

- UI: https://team-tracker-workflow-validation-org-pulse.apps.workval.aipcc-gpuaas.com
- API: https://team-tracker-api-workflow-validation-org-pulse.apps.workval.aipcc-gpuaas.com/api/modules/workflow-validation

## 6. Live Verification

The fixed images completed both rollouts. The deployed backend source hash matches
the tested source. Live API checks compared all 157 run groups with all 18 image
documents. All 11 verified dates match. The other 146 rows have no verified build.
The previous join returned only eight verified rows; grouping restores three dates.

- `buildDate` descending: verified dates first, then `unavailable` rows.
- `buildDate` ascending: dates reversed, `unavailable` rows still last.
- Default order: `sortField=timestamp`, `sortDir=desc`.
  Newest runs first.
  Build values are correct.
- All eight pages pass in each order, with no duplicate or missing run groups.
- Previous cursors, suite/run ID/date/version filters, concurrent Refresh requests,
  and cached responses pass.
- Bug ticket enrichment retains all run/build values: 15 rows have Jira links,
  and 142 rows have no eligible tickets.
- Browser checks pass for both build directions, Next, Previous, reload retaining
  the sorted page, and Clear filters restoring the default order.
- Verified builds use the same single-line UTC format as execution times,
  for example `5 Nov 2026, 05:14:40`. UTC appears in the column headings only.
- Document counts stay unchanged: 726 executions, 4,171 tasks, and 184 root causes.

[Machine-readable evidence](rhai-10567-build-validation.json).
Screenshots show the actual fixed GPUaaS dashboard. They omit browser chrome and
the account sidebar. Browser zoom was restored after capture.

- [Default execution order](images/rhai-10567-build-default-gpuaas.jpg).
- [Build descending](images/rhai-10567-build-descending-gpuaas.jpg).
- [Build ascending](images/rhai-10567-build-ascending-gpuaas.jpg).

## 7. Problems Found and Fixed

- The first join used a malformed `_mget` request. Replaced it with a `terms` query on `invocation_id`.
- The first join used `_id` as the key. The correct key is `_source.invocation_id`.
- The first deploy used a bare image name and caused `ImagePullBackOff`. Fixed with the internal registry URL.
- The first build-date sort paged rows before the join. Fixed by joining the full result set first. Verified live after a rebuild.
- The first rebuild failed because the source archive had no `deploy/` directory.
  Fixed by syncing the full `rhai-org-pulse` root, then overlaying the worktree module.
- `oc start-build` does not support `--to`.
  Reused the same image tag and redeployed by digest.

## 8. Deviations

- There is no local container runtime. Builds use BuildConfigs with `CORE_TAG=v2.0.99`.
- The unused environment variable `WORKFLOW_VALIDATION_BUILD_TIME_ENABLED=false` is unchanged.
- `grep --include=*.env` and `oc -o custom-columns` failed on zsh globbing. This was harmless.
- The `-l app=backend` selector returns no pods. Use `app=team-tracker,component=backend` instead.
- The full test suite has pre-existing failures. See section 4.

## 9. Review Fixes — 2026-11-11

Image lookups now use bounded invocation groups. This avoids OpenSearch result
and terms limits. Duplicate image documents cannot hide another invocation.
The client displays a date only when its status is `verified`.
Calendar overflow and timestamps without a timezone show `unavailable`.
Build metadata stays in the same cache snapshot as run metadata.
Concurrent requests retain the existing scan-order and connection guards.

Regression tests cover 10,001 and 65,537 invocations, duplicate image groups,
document ID collisions, invalid dates, timezone offsets, cache expiry and Refresh,
failed image lookups, disconnected clients, and competing image responses.
Browser tests verify single-line UTC rendering and both build sort directions across all
47 synthetic rows, including unavailable values and reload.

The user approved both development deployments. Section 5 records the deployed
images and their immediate rollback targets. Section 6 records the live checks.

## 10. Build Display Update — 2026-11-12

Frontend build 5 uses the execution-time formatter for verified build values.
It removes the line break and repeated UTC label. The heading keeps `(UTC)`.
Missing builds still show lowercase `unavailable`.

All 130 focused unit tests and 39 module browser tests passed again.
Lint and the production build passed. Fresh GPUaaS API checks passed for all
157 run groups across eight pages in all three sort orders. Live browser checks
confirmed the format, both build sort directions, Next, Previous, reload, and
Clear filters. The three screenshots and validation JSON now show this revision.

## 11. Current PR Deployment — 2026-11-12

Backend build 11 and frontend build 6 deploy source `21865eac` with core
`v2.0.99`. Both rollouts completed. The deployed image digests match the builds,
and the backend source hashes match the PR. Section 5 records rollback targets.

Fresh API checks passed for all 157 run groups across eight pages in each
sort order. All 11 verified builds match OpenSearch image documents. All 146
unavailable builds remain last in both build orders. Filters, previous cursors,
concurrent Refresh requests, cache consistency, and bug ticket enrichment pass.
Document counts remain unchanged.

Fresh browser checks pass for the single-line format, both build sort directions,
Next, Previous, reload retaining page two, and Clear filters restoring the default.
All three screenshots now show frontend build 6. Browser zoom is restored to 100%.
