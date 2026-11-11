# RHAI Build Column: Development Deployment

**Status:** Deployed (development)
**Author:** Codex
**Date:** 2026-11-11
**Module:** workflow-validation
**Ticket:** RHAI-10567
**Branch:** `feat/rhai-10898-rhoai-build-column`

---

## 1. Goal

Add one sortable column, `RHOAI build (UTC)`, to the Recent Runs table.
Place it directly after the `Version` column.
Show the build date on line 1 and the build time plus `UTC` on line 2.
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
  It runs one `terms` query on `invocation_id`.
  It accepts only rows with `build_date_status === 'verified'`.
  It parses `build_date`.
  It runs on the full result set before paging.
- `server/recent-runs.js`: add `buildDate` to `SORT_FIELDS`.
  Add `buildDate` to the version 3 cursor.
  Sort missing values last.
  Keep `timestamp`/`desc` as the default.
  Include `buildDate` and `buildDateStatus` in the row projection.

### Client

- `client/views/RecentRunsView.vue`: add the new column after `Version`.
  Use two lines: en-GB date, then time and `UTC`.
  Show lowercase `unavailable` when data is missing.
  Add a sort button after `version`. First direction is `desc`.
  Change the empty-row colspan from 4 to 5.
  Set table minimum width to 64rem.

### Tests and Docs

- Update the client and server tests.
- Update `docs/rhai-10567-recent-runs-contract.md`.
- Update `README.md`.

## 4. Test Results

- Focused server and client tests: 110 passed.
- `npm run lint`: passed.
- `npm run validate:openapi`: passed with pre-existing warnings.
- Full `npm test` was not used.
  It has 71 pre-existing localStorage failures in 5 unrelated client files.

## 5. Deployment

### Cluster

- Context: `default/api-workval-aipcc-gpuaas-com:6443/ldap-admin1`
- Namespace: `workflow-validation-org-pulse`
- Pod labels: `app=team-tracker,component=backend`

### Backend

- BuildConfig: `org-pulse-backend-builddate-20261111`
- Image digest: `org-pulse-backend@sha256:73fcebe70903d6a987a7bb0e53337cc40815e8ddd5e7f520d7038ac7c337f9fd`
- Rollback digest: `org-pulse-backend@sha256:c8b53da3261346538f4c5ca495f2c57421fdebe83a23547cae3aa88d0f955879`

### Frontend

- BuildConfig: `org-pulse-frontend-builddate-20261111`
- Image digest: `org-pulse-frontend@sha256:9d240fdb6113f7a237c30d07409131e2d55bdc8717344c6f16d6ee2f5ecb2665`
- Rollback digest: `org-pulse-frontend@sha256:6b958af847ddd8d725d23a7e5843cd5002b55d3c84fe6d94021c71e44b832432`

### Routes

- UI: https://team-tracker-workflow-validation-org-pulse.apps.workval.aipcc-gpuaas.com
- API: https://team-tracker-api-workflow-validation-org-pulse.apps.workval.aipcc-gpuaas.com/api/modules/workflow-validation

## 6. Live Verification

All checks passed.

- `buildDate` descending: verified dates first, then `unavailable` rows.
- `buildDate` ascending: dates reversed, `unavailable` rows still last.
- Default order: `sortField=timestamp`, `sortDir=desc`.
  Newest runs first.
  Build values are correct.

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

- There is no local container runtime. Builds use BuildConfigs with `CORE_TAG=v2.0.96`.
- The unused environment variable `WORKFLOW_VALIDATION_BUILD_TIME_ENABLED=false` is unchanged.
- `grep --include=*.env` and `oc -o custom-columns` failed on zsh globbing. This was harmless.
- The `-l app=backend` selector returns no pods. Use `app=team-tracker,component=backend` instead.
- The full test suite has pre-existing failures. See section 4.
