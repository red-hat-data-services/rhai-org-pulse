# Recent Runs refinements — RHAI-20044

[Story](https://redhat.atlassian.net/browse/RHAI-20044), following
[AIPCC-33215](https://redhat.atlassian.net/browse/AIPCC-33215).

## Behavior

- Select several versions. A run matches any selected version.
- Use one Date Range selector. Presets cover All time and Last 7/30/90 days.
  Custom dates reveals inclusive UTC start and end dates.
- Select each table heading to sort suite, version, or recorded time in either
  direction. Ordering applies across every page. Newest time remains the default.
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

## Partial-version investigation

A label such as `3.6` does not establish GA `3.6.0`. The Director collector's
automatic version detection extracts only major.minor from the operator CSV.
It can therefore lose patch and prerelease information. Explicit configured
versions are preserved.

Read-only GPUaaS metadata contained one `3.6` execution. Its operator digest
had no matching full-version record in the accessible dataset. The current
cluster runs a different operator digest. The image registry requires an
authenticated lookup; the public catalog did not identify this historical digest.
The approved production metadata request returned HTTP 403, and the browser
could not navigate because of a browser-tool error. Production metadata could
not establish whether the historical runs were EA or GA.

Keep these labels separate and display `3.6 (release unspecified)`. Do not
relabel historical data or merge it into GA without authoritative metadata.
The same rule applies to other major.minor labels. This is the remaining limit
on the original duplicate-version request.

## Verification

Source `0092440c` passes 6,781 unit tests (11 skipped), including 160 module
tests. All 31 browser integration tests pass through the existing shared CI
entrypoint. Lint, module/OpenAPI validation, the standard production build, and
the compatible GPUaaS frontend build pass.

Both preview images are deployed and ready. The backend source and served
frontend assets match the build. Read-only API checks traverse all 146 groups
across eight pages in each of the six sort orders. Checks also cover multiple
versions, release-aware version choices, earlier page bookmarks, Refresh,
UTC dates, filters beyond page one, and cursor scope validation. The baseline
counts remain 712 executions, 4,157 tasks, and 184 root causes. Run metadata and
runtime settings are unchanged. Previous image references are saved for rollback.

[Machine-readable evidence](rhai-20044-validation.json) records image digests,
source/asset hashes, and validation results. Live browser screenshots are pending
test authentication approval.
