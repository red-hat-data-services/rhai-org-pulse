# Recent Runs refinements — RHAI-20044

[Story](https://redhat.atlassian.net/browse/RHAI-20044), following
[AIPCC-33215](https://redhat.atlassian.net/browse/AIPCC-33215).

## Behavior

- Select several versions. A run matches any selected version.
- Use one Date Range selector. Presets cover All time and Last 7/30/90 days.
  Custom dates reveals inclusive UTC start and end dates.
- Use each column heading’s dropdown to sort suite, version, or recorded time
  in either direction. The whole heading opens the menu, marked by a small down
  arrow. Ordering applies across every page. Newest time remains the default.
- Versions sort numerically. GA sorts above EA for the same release; EA2 sorts
  above EA1. Confirmed spelling aliases such as `3.6.0 EA1` and `3.6.0-ea.1`
  share one choice. Patch versions remain distinct.
- Click a row or focus it and press Enter to open the exact suite and invocation.
  Text selection does not navigate. The View run column is removed.

The page retains 20 rows, automatic filters, 300 ms Run ID debounce, Clear
filters, Refresh/Retry, stale-response protection, and shareable URLs. Earlier
single-version URLs, custom date URLs, and v1/v2 timestamp page bookmarks work.
Repeated `versions` query parameters and v3 cursors support the new selection
and sort columns. The API validates selection limits and cursor scope before
reading OpenSearch. No schema or stored data changes are required.

## Version normalization

Recent Runs displays the legacy `3.6` label as `3.6.0`, as requested. The dropdown
has one `3.6.0` choice. Selecting it matches runs stored under either value, and
both values use the same sort position above `3.6.0-ea.*`. Earlier `3.6` filter
URLs still work. Explicit EA releases and patch releases remain separate.
Version labels show only the version string. The filter summary above the table
is removed. This rule applies to Recent Runs; it does not rewrite OpenSearch documents.

## Verification

Source `18b76271` passes 6,781 unit tests (11 skipped), including 160 module
tests. All 32 browser integration tests pass through the existing shared CI
entrypoint. Lint, module/OpenAPI validation, the standard production build, and
the compatible GPUaaS frontend build pass.

Both preview images are deployed and ready. The backend source and served
frontend assets match the build. Read-only API checks traverse all 146 groups
across eight pages in each of the six sort orders. Checks also cover multiple
versions, the `3.6`/`3.6.0` alias, release-aware version choices, earlier page bookmarks, Refresh,
UTC dates, filters beyond page one, and cursor scope validation. The baseline
counts remain 712 executions, 4,157 tasks, and 184 root causes. Run metadata and
runtime settings are unchanged. Previous image references are saved for rollback.

[Machine-readable evidence](rhai-20044-validation.json) records image digests,
source/asset hashes, and validation results.

Live browser checks passed against both deployed images. They cover all eight
pages, column sort dropdowns in both directions, plain version labels, the removed
filter summary, version choice order, multiple versions and
selection reload, date presets and Custom dates, filtering beyond page one,
Clear, Refresh/Retry, older bookmarks, and exact-run navigation by mouse and
keyboard. The page fits 375px and 320px screens with horizontal table scrolling.
No browser page errors occurred. Test credentials stayed in memory.

- [Initial page](images/rhai-20044-gpuaas-recent-runs.png)
- [Multiple versions](images/rhai-20044-gpuaas-multiple-versions.png)
- [Custom UTC dates](images/rhai-20044-gpuaas-custom-dates.png)
- [Run ID and suite filters](images/rhai-20044-gpuaas-filtered.png)
- [Selected run](images/rhai-20044-gpuaas-selected-run.png)
- [320px layout](images/rhai-20044-gpuaas-mobile.png)
