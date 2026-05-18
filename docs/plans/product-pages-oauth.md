# Product Pages OAuth Integration Plan

## Summary

Replace the current `PRODUCT_PAGES_TOKEN` bearer token auth with OAuth2 client credentials flow against Red Hat SSO, and add a product selector in the Settings UI so admins choose which Product Pages products to track (instead of providing a raw URL).

## Current State

- `fetchOpenReleases()` in `modules/releases/server/delivery/index.js` fetches from a user-supplied URL (`productPagesReleasesUrl` config field) with an optional `PRODUCT_PAGES_TOKEN` bearer token.
- Config fields live in `modules/releases/server/delivery/config.js` with env var overrides.
- Settings UI (`client/components/ReleaseAnalysisSettings.vue`) has a raw "Releases URL" text input and a note about the env var.

## Product Pages API Findings

| Detail | Value |
|--------|-------|
| SSO Token Endpoint | `https://auth.redhat.com/auth/realms/EmployeeIDP/protocol/openid-connect/token` |
| Grant Type | `client_credentials` |
| Token TTL | 300 seconds (5 minutes) |
| Releases Endpoint | `https://productpages.redhat.com/api/v7/releases/` |
| Products Endpoint | `https://productpages.redhat.com/api/v7/products/` |
| Response Format | JSON array (no pagination wrapper) |
| Total Releases | ~1907 across 137 products |
| Server-side Filtering | Django-style: `product__shortname=X`, `phase__in=200,350,400`, `phase__lt=500` |
| Multi-product Filter | Repeated `product__shortname` params NOT supported; use one request per product OR filter by phase then match client-side |

### Release Object (key fields)

```json
{
  "id": 3203,
  "product_shortname": "rhoai",
  "product_name": "Red Hat OpenShift AI",
  "name": "Red Hat OpenShift AI 2.16.4",
  "shortname": "rhoai-2.16.4",
  "ga_date": null,
  "all_ga_tasks": [
    { "main": false, "name": "2.16.4 RHOAI GA", "date_start": "2026-03-25", "date_finish": "2026-03-25" }
  ],
  "phase": 350,
  "phase_display": "Development / Testing",
  "canceled": false,
  "published": true
}
```

**GA date extraction algorithm** (`ga_date` is often `null` for unreleased products):

1. If `ga_date` is set on the release object, use it directly.
2. Otherwise, search `all_ga_tasks` in priority order:
   a. Entry with `main: true` — use its `date_finish`.
   b. Entry whose `name` matches `/\bGA\b/` (word-boundary match to avoid false positives like "LEGACY") — use last matching entry's `date_finish`.
3. If no date is found, set `dueDate` to `null`. The release will be filtered out by `filterUnreleased()` (which requires a valid date).

### Phase Values (observed)

| Phase | Meaning |
|-------|---------|
| Concept | Early planning, no schedule |
| Planning | Schedule being built |
| Development / Testing | Active dev work |
| Launch | Imminent GA |
| Maintenance | Released, receiving updates |
| Unsupported | End of life |

Relevant phases for release analysis: **Planning**, **Development / Testing**, **Launch**.

## Auth Strategy: Dual-mode

Support two auth modes, with automatic detection:

1. **OAuth client credentials** (production): When `PRODUCT_PAGES_CLIENT_ID` and `PRODUCT_PAGES_CLIENT_SECRET` env vars are set, use the client credentials flow against Red Hat SSO to obtain a bearer token. Cache the token in memory and refresh when it expires (use `expires_in - 30s` buffer). **Confirmed working client ID**: `rhai-org-pulse` (the credentials file at `/Users/acorvin/Downloads/rhai-org-pulse` contained a typo `hai-org-pulse` which does not work). **Error handling**: Log distinct messages for token endpoint failures (network/SSO issues) vs credential failures (HTTP 401 from SSO — `invalid_client` response) to aid debugging.

2. **Personal token** (local dev fallback): When `PRODUCT_PAGES_TOKEN` is set (and OAuth env vars are not), use it as a static `Bearer` token — preserving the current behavior for developers who authenticate via their personal account.

If neither is configured, Product Pages fetching is skipped (existing fallback-to-cache behavior).

## Implementation Plan

### 1. New file: `modules/releases/server/delivery/product-pages.js`

OAuth token management and Product Pages API client, extracted from `fetchOpenReleases()`.

```
Exports:
- getProductPagesToken()    — returns cached or fresh Bearer token
- fetchProductsByShortname(shortnames) — fetches releases for given product shortnames
- fetchAllProducts()        — returns product list (for settings UI autocomplete)
```

**Token caching**: Module-level `let cachedToken = { token, expiresAt }` and `let pendingTokenRequest = null`. On each call to `getProductPagesToken()`:
- If `cachedToken.expiresAt > Date.now()`, return cached token.
- If `pendingTokenRequest` is set, await and return it (deduplicates concurrent callers).
- Otherwise, set `pendingTokenRequest` to the SSO POST promise, await it, cache with `expiresAt = Date.now() + (expires_in - 30) * 1000`, clear `pendingTokenRequest`, and return.

**Auth detection logic** (in `getProductPagesToken()`):
```
if (PRODUCT_PAGES_CLIENT_ID && PRODUCT_PAGES_CLIENT_SECRET) → OAuth flow
else if (PRODUCT_PAGES_TOKEN) → return static token
else → return null (no auth configured)
```

**`fetchProductsByShortname(shortnames, config)`**: Makes one API request per product shortname to `${config.productPagesBaseUrl}/api/v7/releases/?product__shortname=${shortname}`. This leverages server-side filtering (Django-style query params) to return only ~20-40 releases per product instead of all ~1907. Requests are sequential with a small delay to avoid rate limiting. Defensively handles both array and object responses (same pattern as existing `fetchOpenReleases()`: `Array.isArray(payload) ? payload : (payload.releases || payload.items || [])`). Filters client-side by phase (Planning=200, Development/Testing=350, Launch=400) using numeric `phase` field, and excludes `canceled: true`. Extracts GA date using the algorithm above. Returns normalized release objects matching existing format: `{ productName, releaseNumber, dueDate }`.

Alternative approach considered: a single request with `phase__in=200,350,400` returns ~133 active releases across all products, then filter by shortname client-side. This is fewer HTTP requests but returns more data. The per-product approach is preferred because it scales predictably and avoids fetching data for unrelated products.

**`fetchAllProducts()`**: Fetches `/api/v7/products/`, returns `[{ shortname, name }]` for UI autocomplete. Cache for 1 hour in memory (product list changes infrequently).

### 2. Config changes: `modules/releases/server/delivery/config.js`

Add new config fields to `DEFAULT_CONFIG`:

```js
productPagesProductShortnames: [],   // e.g. ['rhoai', 'rhelai', 'RHAIIS']
productPagesBaseUrl: 'https://productpages.redhat.com',
productPagesTokenUrl: 'https://auth.redhat.com/auth/realms/EmployeeIDP/protocol/openid-connect/token',
```

Add env var overrides in `applyEnvOverrides()`:
- `PRODUCT_PAGES_CLIENT_ID` — OAuth client ID (NOT stored in config.json — env only, read directly by `product-pages.js`)
- `PRODUCT_PAGES_CLIENT_SECRET` — OAuth client secret (NOT stored in config.json — env only, read directly by `product-pages.js`)
- `PRODUCT_PAGES_TOKEN` — Legacy personal token (env only, read directly by `product-pages.js`)
- `PRODUCT_PAGES_PRODUCT_SHORTNAMES` — Comma-separated, parsed with `.split(',').map(s => s.trim()).filter(Boolean)` (same pattern as `RELEASE_ANALYSIS_PROJECT_KEYS`)
- `PRODUCT_PAGES_BASE_URL` — Override base URL
- `PRODUCT_PAGES_TOKEN_URL` — Override SSO token URL

Keep `productPagesReleasesUrl` in config for backward compatibility but deprecate it. When `productPagesProductShortnames` is non-empty, use the new product-based fetching; otherwise fall back to the raw URL if set.

**Note on dual code paths (item 10)**: The legacy URL path and the new product-shortname path share the same auth layer (`getProductPagesToken()`) and the same output format (`{ productName, releaseNumber, dueDate }`). The legacy path preserves existing `fetchOpenReleases()` behavior verbatim — no changes to its date extraction or response parsing. The new path uses the GA date extraction algorithm above. Both paths write to the same cache file. The legacy path is deprecated and should be removed in a future release once all users have migrated to product shortnames.

**`saveConfig()` validation blocks** (REQUIRED — without these, `saveConfig()` silently drops new fields since it starts from `{ ...DEFAULT_CONFIG }` and only copies fields with explicit validation):

```js
// productPagesProductShortnames — array of shortname strings (empty allowed)
if (config.productPagesProductShortnames !== undefined) {
  let items = config.productPagesProductShortnames;
  if (typeof items === 'string') {
    items = items.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(items)) {
    throw new Error('productPagesProductShortnames must be an array');
  }
  const SHORTNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
  for (const s of items) {
    if (typeof s !== 'string' || !SHORTNAME_PATTERN.test(s)) {
      throw new Error(`Invalid product shortname "${s}": must match ${SHORTNAME_PATTERN}`);
    }
  }
  merged.productPagesProductShortnames = items;
}

// productPagesBaseUrl — empty or valid HTTP(S) URL
if (config.productPagesBaseUrl !== undefined) {
  // Same pattern as productPagesReleasesUrl validation (lines 171-181)
  ...
  merged.productPagesBaseUrl = url;
}

// productPagesTokenUrl — empty or valid HTTP(S) URL
if (config.productPagesTokenUrl !== undefined) {
  // Same pattern
  ...
  merged.productPagesTokenUrl = url;
}
```

**Config layering — env var override behavior**: The existing `getConfig()` only calls `applyEnvOverrides()` when NO saved config file exists (line 70-74 of config.js). Once an admin saves via the UI, env vars like `PRODUCT_PAGES_PRODUCT_SHORTNAMES` are ignored in favor of the persisted config. This is the existing behavior for all config fields and is acceptable here — the Settings UI is the primary interface for configuring product shortnames. The env vars serve as initial defaults before first save. The credentials (`PRODUCT_PAGES_CLIENT_ID`, `PRODUCT_PAGES_CLIENT_SECRET`, `PRODUCT_PAGES_TOKEN`) are NOT affected by this — they are read directly by `product-pages.js` from `process.env`, not through the config system.

`productPagesBaseUrl` and `productPagesTokenUrl` are editable via the Settings UI (under an "Advanced / URLs" collapsible section) to support teams with non-standard SSO or Product Pages instances. The defaults will work for the standard Red Hat setup.

### 3. Update `fetchOpenReleases()` in `modules/releases/server/delivery/index.js`

Replace the inline fetch logic with a call to the new `product-pages.js` module:

```js
const { fetchProductsByShortname, getProductPagesToken } = require('./product-pages')

async function fetchOpenReleases(storage, config) {
  // New path: product shortnames configured
  if (config.productPagesProductShortnames?.length) {
    const releases = await fetchProductsByShortname(config.productPagesProductShortnames, config)
    storage.writeToStorage('releases/delivery/product-pages-releases-cache.json', {
      source: 'api',
      fetchedAt: new Date().toISOString(),
      releases
    })
    return releases
  }

  // Legacy path: raw URL (existing behavior, preserved)
  if (config.productPagesReleasesUrl) {
    // ... existing code, but use getProductPagesToken() instead of env var directly
  }

  // Fallback: cached data
  // ... existing code
}
```

### 4. New API route: product list for UI autocomplete

Add to the module's router in `server/index.js`:

```
GET /api/modules/releases/delivery/product-pages/products
```

Returns the list of products from Product Pages (cached 1 hour in memory). Requires admin auth. Used by the Settings UI for the product shortname selector. When no auth is configured (no OAuth credentials and no personal token), returns `{ products: [], authStatus: 'none' }` so the UI can show an empty product list with a message like "Configure Product Pages credentials to browse available products. You can still type shortnames manually."

The response also includes `authStatus` (`'oauth'`, `'token'`, or `'none'`) so the Settings UI can display the auth status badge without a separate endpoint.

### 5. Settings UI changes: `client/components/ReleaseAnalysisSettings.vue`

Replace the "Product Pages" section:

**New section: "Product Pages Integration"**

- **Product selector**: Multi-select/tag input where admins can add product shortnames. Include an autocomplete dropdown that fetches from the new `/product-pages/products` API endpoint, showing `shortname — product name`.
- **Auth status indicator**: Small badge showing "OAuth configured" (green), "Personal token" (yellow), or "No auth" (gray) — determined from a new API endpoint or included in the config response.
- **Keep the raw URL field** but move it under an "Advanced / Legacy" collapsible section with a note: "Use this only if you need a custom Product Pages URL. When product shortnames are configured above, this field is ignored."
- Remove the note about `PRODUCT_PAGES_TOKEN` env var; replace with a note about OAuth being configured via environment variables.

### 6. Deployment changes

**New env vars** for the backend (values stored in password manager, NOT in git):

| Variable | Source |
|----------|--------|
| `PRODUCT_PAGES_CLIENT_ID` | OpenShift Secret (`team-tracker-secrets`) |
| `PRODUCT_PAGES_CLIENT_SECRET` | OpenShift Secret (`team-tracker-secrets`) |

Add to the `team-tracker-secrets` Secret in OpenShift (same secret that holds `JIRA_TOKEN`, `GITHUB_TOKEN`, etc.).

Update `deploy/openshift/base/backend-deployment.yaml` to mount the new env vars from the secret. Use `optional: true` on the `secretKeyRef` so pods start correctly in environments where the keys haven't been added yet (dev, preprod, local Kind cluster):

```yaml
- name: PRODUCT_PAGES_CLIENT_ID
  valueFrom:
    secretKeyRef:
      name: team-tracker-secrets
      key: PRODUCT_PAGES_CLIENT_ID
      optional: true
- name: PRODUCT_PAGES_CLIENT_SECRET
  valueFrom:
    secretKeyRef:
      name: team-tracker-secrets
      key: PRODUCT_PAGES_CLIENT_SECRET
      optional: true
```

Note: `PRODUCT_PAGES_TOKEN` is a local-dev-only env var (set via `.env`). It is NOT added to the deployment YAML — in deployed environments, OAuth client credentials are the expected auth path.

**No changes needed for:**
- Frontend Dockerfile (no new deps)
- Backend Dockerfile (no new deps — uses native `fetch`)
- nginx config

### 7. Documentation updates

- Update `CLAUDE.md`: Add `PRODUCT_PAGES_CLIENT_ID`, `PRODUCT_PAGES_CLIENT_SECRET`, and `PRODUCT_PAGES_TOKEN` to the Optional Environment Variables table. Note the dual-mode auth (OAuth vs personal token). Add `GET /api/modules/releases/delivery/product-pages/products` to the API Routes section.
- Update `deploy/OPENSHIFT.md`: Add the new secret fields.
- Update `docs/DATA-FORMATS.md`: Document new config fields in the `releases/delivery/config.json` schema:
  - `productPagesProductShortnames: string[]` — Product Pages product shortnames to track
  - `productPagesBaseUrl: string` — Product Pages base URL (default: `https://productpages.redhat.com`)
  - `productPagesTokenUrl: string` — SSO token endpoint URL (default: `https://auth.redhat.com/auth/realms/EmployeeIDP/protocol/openid-connect/token`)
- Update `.env.example`: Add commented-out entries for the new env vars:
  ```
  # Product Pages OAuth (production — service account)
  # PRODUCT_PAGES_CLIENT_ID=
  # PRODUCT_PAGES_CLIENT_SECRET=
  # Product Pages personal token (local dev fallback)
  # PRODUCT_PAGES_TOKEN=
  ```

### 8. Demo mode

In demo mode (`DEMO_MODE=true`), the refresh route already returns early (line 764-766 of `server/index.js`). The `GET /analysis` route with `?refresh=true` calls `runFullAnalysis()` which calls `fetchOpenReleases()` — this will attempt a Product Pages API call. Since demo mode runs without credentials, `getProductPagesToken()` returns `null` and `fetchProductsByShortname()` should skip the API call and return `[]`, falling through to the cache fallback. The existing fixture data in `fixtures/` provides cached release data for demo mode.

The `fetchAllProducts()` function (for the settings UI autocomplete) should also return `[]` when no auth is configured, so the product selector gracefully shows an empty list in demo mode.

### 9. Cross-environment behavior

| Environment | Auth mode | How configured |
|-------------|-----------|----------------|
| **Local dev** | Personal token OR no auth | `PRODUCT_PAGES_TOKEN` in `.env`, or omit for cached-data-only mode |
| **Dev / Preprod** | Optional — works either way | Secret keys may or may not exist; `optional: true` ensures pod starts regardless |
| **Prod** | OAuth client credentials | `PRODUCT_PAGES_CLIENT_ID` + `PRODUCT_PAGES_CLIENT_SECRET` in `team-tracker-secrets` |

## Files Modified

| File | Change |
|------|--------|
| `modules/releases/server/delivery/product-pages.js` | **NEW** — OAuth token manager + Product Pages API client |
| `modules/releases/server/delivery/index.js` | Refactor `fetchOpenReleases()` to use new module; add `/product-pages/products` route |
| `modules/releases/server/delivery/config.js` | Add `productPagesProductShortnames`, `productPagesBaseUrl`, `productPagesTokenUrl` fields + env var overrides + validation |
| `modules/releases/client/deliver/components/ReleaseAnalysisSettings.vue` | Product selector UI, auth status badge, deprecate raw URL field |
| `deploy/openshift/base/backend-deployment.yaml` | Mount new env vars from secret (`optional: true`) |
| `.env.example` | Add commented-out Product Pages env vars |
| `CLAUDE.md` | Document new env vars |

## Backward Compatibility

- `PRODUCT_PAGES_TOKEN` env var continues to work as a fallback when OAuth env vars are not set.
- `productPagesReleasesUrl` config field continues to work when `productPagesProductShortnames` is empty.
- Existing cached release data (`product-pages-releases-cache.json`) format is unchanged.
- Manual release upload via `POST /admin/releases` is unaffected.
- `saveConfig()` uses `{ ...DEFAULT_CONFIG }` as a base and only overwrites keys present in the payload. If an older frontend sends a config save without the new `productPagesProductShortnames` field, it reverts to the default (empty array). This is acceptable — the existing behavior for all config fields, and the new fields default to "no Product Pages products selected" which is a safe no-op.

## Testing Strategy

- Unit test for `product-pages.js`: mock `fetch` to verify OAuth token acquisition, caching, refresh-on-expiry, fallback to personal token.
- Unit test for GA date extraction from `all_ga_tasks`.
- Unit test for phase filtering logic.
- Integration test: verify `fetchOpenReleases()` picks the right auth mode based on env vars.
- Manual test: run locally with `PRODUCT_PAGES_TOKEN` (personal token), verify existing flow still works.

## Design Decisions

1. **Product list caching**: Memory cache only (1 hour TTL). The `/api/v7/products/` response is ~137 items — small and changes infrequently. No need to persist to storage.

2. **Release filtering**: Use server-side filtering via Django-style query params (`product__shortname=X`) to fetch only releases for configured products (~20-40 per product). Additionally filter client-side by phase (numeric `phase` field: Planning=200, Development/Testing=350, Launch=400) and `canceled: false`. The existing `filterUnreleased()` further filters by due date.

3. **API payload size**: With per-product server-side filtering, each request returns ~20-40 releases instead of all ~1907. For a typical config of 3-4 products, this is ~100-160 releases total across a few sequential requests — much more efficient than fetching the full catalog.

4. **Memory cache loss on pod restart**: OAuth token and product list caches are lost on pod restart (Recreate strategy). This causes a burst of 1-2 SSO requests on startup — acceptable since token acquisition is a single lightweight POST and the 5-min TTL means steady-state is reached quickly. The release data itself is persisted to the PVC-backed `data/` directory via the cache file, so no data is lost.
