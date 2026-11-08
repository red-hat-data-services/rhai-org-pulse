# Recent Runs refinements — RHAI-20044

[Story](https://redhat.atlassian.net/browse/RHAI-20044), following
[AIPCC-33215](https://redhat.atlassian.net/browse/AIPCC-33215).

## Behavior

- Select up to 50 versions. A run matches any selected version. At the limit,
  clear one selected version before adding another.
- Use one Date Range selector. Presets cover All time and Last 7/30/90 days.
  Custom dates reveals inclusive UTC start and end dates.
- Click a column heading to sort immediately. Clicking the active column reverses
  the order. Switching columns starts with A–Z for suites, highest first for
  versions, or newest first for execution time. An arrow shows the active
  direction. Ordering applies across every page. Newest time remains the default.
  Invalid date ranges leave the current sort unchanged. Missing and unparseable
  versions sort last in both directions.
- Versions sort numerically. GA sorts above EA for the same release; EA2 sorts
  above EA1. Confirmed spelling aliases such as `3.6.0 EA1` and `3.6.0-ea.1`
  share one choice. Patch versions remain distinct.
- Click a row or focus it and press Enter to open the exact suite and invocation.
  Text selection does not navigate. The View run column is removed.

The page retains 20 rows, automatic filters, 300 ms Run ID debounce, Clear
filters, Refresh/Retry, stale-response protection, and shareable URLs. Earlier
single-version URLs, custom date URLs, and v1/v2 timestamp page bookmarks work.
Refresh and reload retain a restored bookmark’s original version scope until
a filter or sort change starts a new first page.
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

Source `17364679` passes 6,791 unit tests (11 skipped), including 170 module
tests. All 37 browser integration tests pass through the existing shared CI
entrypoint. Lint, module/OpenAPI validation, the standard production build, and
the compatible GPUaaS frontend build pass.

Both updated images are deployed and ready. The backend source and served
frontend assets match the build. Read-only API checks traverse all 146 groups
across eight pages in each of the six sort orders. Checks also cover multiple
versions, the `3.6`/`3.6.0` alias, release-aware version choices, earlier page bookmarks, Refresh,
UTC dates, filters beyond page one, and cursor scope validation. The baseline
counts remain 712 executions, 4,157 tasks, and 184 root causes. Run metadata and
runtime settings are unchanged. Previous image references are saved for rollback.

[Machine-readable evidence](rhai-20044-validation.json) records image digests,
source/asset hashes, and validation results.

Live browser checks passed against both deployed images. They cover all eight
pages, immediate heading clicks, both sort directions, one request per click,
keyboard sorting, and each column’s first direction when switching columns.
They also cover plain version labels, the removed filter summary, version
choice order, multiple versions and
selection reload, date presets and Custom dates, filtering beyond page one,
Clear, Refresh/Retry, older bookmarks, and exact-run navigation by mouse and
keyboard. The page fits 375px and 320px screens with horizontal table scrolling.
The three columns use equal widths on desktop and mobile. The time heading is
Executed at (UTC). No browser page errors occurred. Test credentials stayed in memory.

Review regressions cover legacy v1/v2 alias bookmarks through Refresh, reload,
and page navigation; invalid dates leave the sort unchanged. Unit and browser
tests cover the 50-version limit, and unit tests verify distinct selector IDs.
The deployed backend helpers also passed synthetic invalid-version ordering and
unknown-label scope checks entirely in memory. They did not write to OpenSearch.
Function documentation covers the release and pagination helpers.

- [Initial page](images/rhai-20044-gpuaas-recent-runs.png)
- [Multiple versions](images/rhai-20044-gpuaas-multiple-versions.png)
- [Custom UTC dates](images/rhai-20044-gpuaas-custom-dates.png)
- [Invalid date recovery](images/rhai-20044-gpuaas-invalid-dates.png)
- [Run ID and suite filters](images/rhai-20044-gpuaas-filtered.png)
- [Selected run](images/rhai-20044-gpuaas-selected-run.png)
- [320px layout](images/rhai-20044-gpuaas-mobile.png)
