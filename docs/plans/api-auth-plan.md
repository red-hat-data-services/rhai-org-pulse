# API Token Authentication Plan

## Summary

Add personal API token authentication so users can interact with the Team Tracker API directly via scripts, curl, and third-party integrations — without going through the web UI or OpenShift OAuth proxy.

## Requirements (gathered from user)

- **Use cases**: Personal scripts/curl + third-party integrations
- **Auth method**: Bearer API tokens (user-generated, shown once)
- **Who can create tokens**: All authenticated users (for themselves)
- **Permissions**: Admin status is resolved dynamically — token owner's current allowlist membership is checked at each request. If a user is removed from the allowlist, their tokens lose **admin** access. See "User Deprovisioning" in Security Considerations for the full access control story.
- **Expiration**: Optional — user chooses 30d, 90d, 1 year, or never
- **UI**: New "API Tokens" page accessible to all users (not buried in admin-only Settings)
- **Admin oversight**: Admins can view all tokens (metadata only) and revoke any token
- **Rate limiting**: Not in initial implementation

## Architecture & Design

### Token Format

Tokens use a prefixed format for easy identification:

```
tt_<32 random hex characters>
```

Example: `tt_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4`

The `tt_` prefix (for "team tracker") makes tokens easily identifiable in logs and credential scanners. The 32-hex-char body provides 128 bits of entropy.

### Token Storage

Tokens are stored in `data/api-tokens.json` using the existing filesystem storage pattern:

```json
{
  "tokens": [
    {
      "id": "uuid-v4",
      "name": "My CI script",
      "tokenHash": "sha256-hex-of-full-token",
      "tokenPrefix": "tt_a1b2c3d4",
      "ownerEmail": "user@redhat.com",
      "createdAt": "2026-04-03T12:00:00Z",
      "expiresAt": "2026-07-03T12:00:00Z",
      "lastUsedAt": "2026-04-03T14:30:00Z"
    }
  ]
}
```

Key design decisions:
- **Hashed storage**: Only the SHA-256 hash is stored; the raw token is shown once at creation and never again
- **Token prefix**: First 8 chars stored for identification (like GitHub's `ghp_` tokens)
- **Last-used tracking**: Updated on each API call, throttled via an in-memory `Map<tokenId, lastWrittenTimestamp>` that skips the filesystem write if less than 60 seconds have elapsed since the last write for that token. The map resets on server restart (acceptable — worst case, one extra write per token after restart).
- **Per-user limit**: Maximum 25 tokens per user. Creation attempts beyond this cap return 400.

### Token Lookup

On each request with `Authorization: Bearer tt_...`:
1. Hash the provided token with SHA-256
2. Scan the tokens array for a matching `tokenHash`
3. Check expiration
4. Set `req.userEmail` and `req.isAdmin` from the token's `ownerEmail`

For performance, an in-memory hash map is built on startup and invalidated on token create/revoke. With expected token counts (<1000), this is more than sufficient.

### Auth Middleware Changes

The existing `authMiddleware` in `shared/server/auth.js` will be extended to check for Bearer tokens **before** falling back to `X-Forwarded-Email` headers. **Critically, when a Bearer token is present, the middleware MUST NOT fall through to the header/local-dev fallback on failure — it must reject with 401.**

```
Request arrives
  → Has Authorization: Bearer tt_...?
    → Yes:
      → Token valid + not expired? → set req.userEmail, req.isAdmin, req.authMethod = 'token' → next()
      → Token invalid/expired?    → return 401 (HARD STOP — no fallback)
    → No: existing flow (X-Forwarded-Email header or local dev fallback)
```

**Why no fallback is critical**: Without this, an attacker inside the cluster could send `Authorization: Bearer tt_garbage` to bypass `proxySecretGuard`, have the token validation fail, and then fall through to the local dev fallback which grants admin access using the first `ADMIN_EMAILS` entry. The hard stop on invalid tokens closes this escalation path completely.

This ensures:
- **No escalation**: Invalid tokens always produce 401, never fall through
- **Backward compatibility**: Requests without Bearer tokens use the existing flow unchanged
- **Coexistence**: Token auth and proxy auth work side by side
- **No breaking changes**: No existing API contracts change

### `/api/whoami` Must Use Auth Middleware

Currently, `/api/whoami` is registered **before** `app.use(authMiddleware)` in `server/dev-server.js` (line ~155 vs ~196). It reads `x-forwarded-email` directly from headers and falls back to the local dev email. This means token-authenticated users calling `/api/whoami` would get the wrong identity.

**Fix**: Move `/api/whoami` after the auth middleware and rewrite it to use `req.userEmail` and `req.isAdmin` (set by the middleware). This way token-authenticated users get correct results. The endpoint remains publicly accessible (no `requireAdmin`), but now it's identity-aware for all auth methods.

### Production Request Flow: Bypassing the OAuth Proxy

In production, the request flow is:

```
Client → OpenShift Route (TLS) → OAuth Proxy (port 4180) → nginx (port 8080) → Backend (port 3001)
```

The OAuth proxy is configured with `--pass-user-headers=true` but does **not** have `--pass-authorization-header`. This means it will strip/replace the `Authorization` header before it reaches nginx or the backend. API token users sending `Authorization: Bearer tt_...` would have their header consumed by the OAuth proxy.

**Solution: Dedicated API Route**

Create a separate OpenShift Route that points directly to the backend Service, bypassing the frontend pod (and its OAuth proxy sidecar) entirely:

```
API Token Client → api-team-tracker Route (TLS) → backend Service (port 3001) → Express
```

This is the cleanest separation:
- Web UI traffic continues through the OAuth proxy as before (no change)
- API token traffic goes directly to the backend, where the Express auth middleware validates the token
- No risk of OAuth proxy interfering with Authorization headers
- The `proxySecretGuard` bypass (below) protects these requests

The new Route will be defined in the kustomize base with overlay-specific hostname patches. It uses edge TLS termination (the backend is HTTP internally).

```yaml
# deploy/openshift/base/api-route.yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: team-tracker-api
spec:
  to:
    kind: Service
    name: backend
  port:
    targetPort: 3001
  tls:
    termination: edge
```

**Implementation notes for kustomize** (from DevOps review):
- **No `spec.path` restriction**: Omitted so the route also serves `/healthz` for independent health monitoring of the API route.
- **Edge TLS**: Correct — backend is plain HTTP on port 3001. The existing frontend Route uses `reencrypt` because the OAuth proxy terminates TLS internally, but that doesn't apply here.
- **Prod overlay patch**: Must include `shard: internal` label and `paas.redhat.com/appcode` annotation (same as the frontend Route prod patch) or the route will land on the wrong shard.
- **Local overlay**: Delete via `$patch: delete` resource entry (local Kind doesn't have OpenShift Routes).

### Proxy Secret Guard Compatibility

The `proxySecretGuard` middleware runs before auth and checks `X-Proxy-Secret`. In production, nginx injects this header from an env var. API token requests arriving via the dedicated API Route bypass nginx entirely, so they won't have `X-Proxy-Secret`.

**Solution**: The proxy secret guard will **validate the token inline** before allowing the request through. This prevents the escalation where a garbage `Authorization: Bearer tt_...` header bypasses the guard and then falls through auth middleware to the local dev fallback.

The guard will be updated to:
1. Skip if no `PROXY_AUTH_SECRET` configured (existing behavior)
2. Skip if `X-Proxy-Secret` matches (existing behavior)
3. **New**: If request has `Authorization: Bearer tt_...` header, perform a quick hash lookup against the token store:
   - Token hash found AND not expired → allow through (token will be fully processed in `authMiddleware`)
   - Token hash not found or expired → reject with 401 immediately
4. Reject otherwise (existing behavior)

**Why inline validation is required**: The proxy secret guard runs *before* `authMiddleware`. If it merely checked for the `tt_` prefix without validation, an attacker could send a garbage token to bypass the guard. Although `authMiddleware` would reject the invalid token (see "hard stop" above), defense in depth requires the guard itself to validate. The token store's in-memory hash map makes this lookup O(1) with negligible overhead.

**Implementation note**: The `proxySecretGuard` will receive a `tokenValidator` function (injected at setup time) that performs the hash lookup. This avoids importing token storage directly and keeps the guard testable.

### API Routes

New routes under `/api/tokens`:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tokens` | Auth | List current user's tokens (metadata only, no hashes) |
| POST | `/api/tokens` | Auth | Create a new token (returns raw token once) |
| DELETE | `/api/tokens/:id` | Auth | Revoke own token |
| GET | `/api/admin/tokens` | Admin | List all tokens (metadata only) |
| DELETE | `/api/admin/tokens/:id` | Admin | Revoke any token |

**POST /api/tokens** request body:
```json
{
  "name": "My script",
  "expiresIn": "90d"
}
```

**Input validation**:
- `name`: Required, non-empty string, max 100 characters. Duplicate names are allowed (like GitHub PATs).
- `expiresIn`: Must be one of `"30d"`, `"90d"`, `"1y"`, or `null` (never expires). Any other value returns 400.
- **Per-user limit**: 25 tokens max. Returns 400 with message if exceeded.

**POST /api/tokens** response (only time raw token is shown):
```json
{
  "token": "tt_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
  "id": "uuid",
  "name": "My script",
  "expiresAt": "2026-07-03T12:00:00Z"
}
```

### Frontend UI

#### New "API Tokens" Page

Accessible to all authenticated users from the sidebar. Not in the admin-only Settings page.

**User view** (`/api-tokens` or hash route `#/api-tokens`):
- "Create Token" button → modal with name input + expiration dropdown
- On creation: displays the raw token in a copy-friendly box with a warning ("This token won't be shown again")
- Table of user's tokens: name, created date, expiration, last used, prefix, revoke button
- Expired tokens shown with visual indicator

**Admin section** (visible to admins on the same page):
- "All Tokens" expandable section showing tokens from all users
- Each row shows: owner email, name, created, expires, last used, revoke button

**In-app usage guide** (collapsible help panel at the top of the page):
- How to use a token: `curl -H "Authorization: Bearer tt_..." https://api-team-tracker.example.com/api/roster`
- Authorization header format: `Authorization: Bearer <token>`
- Token lifecycle: shown once at creation (copy it immediately), optional expiration, revocable at any time
- Link to the Swagger API docs (`/api/docs`) for endpoint reference

#### Implementation Approach

- New Vue view component (not a module — this is core app shell functionality)
- New composable `useApiTokens()` for API calls (calls `apiRequest()` directly, like `useAllowlist` — no new functions needed in `shared/client/services/api.js`)
- Follows existing patterns from `UserManagement.vue` and `useAllowlist.js`
- Added to sidebar navigation in `AppSidebar.vue` (Key icon from lucide-vue-next, placed before the admin-only Settings section)
- `App.vue` needs a new `v-else-if` block for the `api-tokens` shell route, plus handlers in `restoreFromHash()` and `handleSidebarNavigate()`

### OpenAPI / Swagger Updates

Add a new security scheme:

```yaml
components:
  securitySchemes:
    bearerToken:
      type: http
      scheme: bearer
      description: "API token (prefix: tt_). Generate at /api-tokens."
    forwardedEmail:
      # existing scheme
```

Update default security to accept either method:
```yaml
security:
  - forwardedEmail: []
  - bearerToken: []
```

## Backward Compatibility

| Concern | Impact | Mitigation |
|---------|--------|------------|
| Existing web UI auth | None | Token check runs first; if no token, existing flow unchanged |
| Existing API clients | None | No existing APIs change signatures or behavior |
| Proxy secret guard | Minor change | Bearer tokens bypass proxy secret check (token is the auth proof) |
| OAuth proxy | No change | Web UI traffic still goes through OAuth proxy as before; API token traffic uses a dedicated Route that bypasses it entirely |
| Demo mode | Minor | Token list returns empty. Token creation returns explicit "disabled in demo mode" error (not a silent no-op). See Demo Mode section. |
| Local dev (no auth) | None | Local dev already sets a fallback email; tokens are an alternative path |
| `/api/whoami` | Moved after authMiddleware | Now uses `req.userEmail`/`req.isAdmin` instead of reading headers directly. Returns correct identity for token-authenticated users. |
| CORS | Acknowledged | `Access-Control-Allow-Origin: *` combined with Bearer tokens means any site with a token can make cross-origin requests. This matches the existing CORS policy and is acceptable since tokens are user-managed secrets. |

## Testability

### Local Dev
- Tokens work without OAuth proxy — create via UI, use via curl
- `npm run dev:full` is sufficient to test the full flow

### Demo Mode
- `GET /api/tokens` returns empty token list (no tokens in fixture)
- `POST /api/tokens` returns explicit error: `{ status: 'skipped', message: 'Token creation disabled in demo mode' }` — same pattern as existing refresh route guards (dev-server.js lines 71-81). This is NOT handled by demo-storage's silent writes; an explicit route guard catches it first so the user gets clear feedback instead of a token that silently doesn't work.

### Unit Tests
- Token hashing and validation logic
- Auth middleware with valid Bearer token → sets req.userEmail, req.isAdmin, req.authMethod
- **Auth middleware with invalid Bearer token → returns 401, does NOT fall through to local dev fallback** (escalation prevention)
- Auth middleware with expired Bearer token → returns 401
- Auth middleware without Bearer token → existing flow unchanged
- Proxy secret guard with valid token → allows through
- **Proxy secret guard with garbage `tt_` token → rejects 401** (inline validation)
- Token CRUD: create (with limits), list (user-scoped), revoke (own + admin)
- Input validation: name required/max length, expiresIn allowlist, per-user cap
- Write lock serialization (concurrent creates don't lose data)
- Deprovisioning: user removed from allowlist → token still works for non-admin routes, loses admin access

### Integration Testing
- Create token → use token → verify access
- Expired token → verify rejection
- Revoked token → verify rejection
- Admin revoking other user's token
- Token with admin user → verify admin endpoints accessible
- `/api/whoami` with token → returns correct identity (not local dev fallback)
- User removed from allowlist → token still accesses non-admin routes, admin routes return 403
- Demo mode: token creation returns explicit error

## Deployment

### No New Secrets Required
API tokens are self-contained — no new environment variables or cluster secrets needed.

### Data Migration
None. The `data/api-tokens.json` file is created on first token creation. Existing deployments gain the feature with no migration.

### OpenShift Considerations
- The PVC-mounted `data/` directory already persists across pod restarts — tokens survive restarts
- No changes to Dockerfiles or nginx config
- No new ConfigMap entries
- **New kustomize resources**: A dedicated API Route (`api-route.yaml`) in the base, with hostname patches in dev/preprod/prod overlays (see "Production Request Flow" section above)
- The backend Service already exists and is reachable within the cluster — the new Route simply exposes it externally for API token traffic
- **Note**: The PVC is `ReadWriteOnce` with `replicas: 1`. File-based token storage works fine at current scale but would need revisiting if backend is ever scaled horizontally (same constraint as all `data/` files today)

### Environment Parity

| Environment | OAuth proxy? | Token behavior |
|-------------|-------------|----------------|
| **Local dev** | No | Tokens work immediately via `localhost:3001`. No proxy secret guard. |
| **Local Kind** | No (local overlay strips it) | Same as local dev. |
| **Dev overlay** | Yes | Needs the dedicated API Route. Tokens bypass OAuth proxy via `api-route`. |
| **Preprod** | Yes | Same as dev. |
| **Prod** | Yes | Same as dev. |

### CI/CD
- New test files will be picked up automatically by `npm test`
- No changes to GitHub Actions workflows
- No changes to build or deploy pipelines
- `ci.yml` kustomize validation runs when `deploy/` files change — the new Route will be validated automatically

## Files Modified

| File | Change |
|------|--------|
| `shared/server/auth.js` | Add Bearer token validation to `authMiddleware` (hard-stop on invalid tokens, no fallback); update `proxySecretGuard` to accept injected `tokenValidator` for inline token verification |
| `server/api-tokens.js` | **New** — token CRUD helpers (hash, create, validate, revoke, list, in-memory cache). App-level, not in `shared/` — token management is shell functionality, not a shared module contract. |
| `server/dev-server.js` | Add `/api/tokens` and `/api/admin/tokens` routes; move `/api/whoami` after `authMiddleware`; add demo mode guard for token creation; wire `tokenValidator` into `proxySecretGuard` |
| `server/openapi-config.js` | Add `bearerToken` security scheme; add token endpoint docs |
| `src/components/App.vue` | Add `api-tokens` shell route (v-else-if block, restoreFromHash handler, handleSidebarNavigate handler) |
| `src/components/AppSidebar.vue` | Add "API Tokens" nav item (Key icon, before admin Settings section) |
| `src/components/ApiTokensView.vue` | **New** — token management page |
| `src/composables/useApiTokens.js` | **New** — composable for token CRUD API calls (uses `apiRequest()` directly) |
| `docs/DATA-FORMATS.md` | Document `api-tokens.json` schema |
| `fixtures/api-tokens.json` | **New** — demo mode fixture (empty tokens array) |
| `deploy/openshift/base/api-route.yaml` | **New** — dedicated OpenShift Route for API token traffic, bypasses OAuth proxy |
| `deploy/openshift/base/kustomization.yaml` | Add `api-route.yaml` to resources list |
| `deploy/openshift/overlays/dev/kustomization.yaml` | Add hostname patch for dev API route (auto-assign or explicit) |
| `deploy/openshift/overlays/preprod/kustomization.yaml` | Add hostname patch for preprod API route |
| `deploy/openshift/overlays/prod/kustomization.yaml` | Add hostname patch for prod API route |
| `deploy/openshift/overlays/local/kustomization.yaml` | Delete api-route (not needed in local Kind cluster) |

### Test Files (New)

| File | Coverage |
|------|----------|
| `src/__tests__/ApiTokensView.test.js` | Token management UI tests |
| `src/__tests__/useApiTokens.test.js` | Composable unit tests |
| `server/__tests__/api-tokens.test.js` | Token CRUD helpers, hashing, validation, per-user limits, write locking |
| `shared/server/__tests__/auth-tokens.test.js` | Auth middleware Bearer token integration: valid token, invalid token hard-stop (no fallback), expired token, proxy guard inline validation, escalation prevention |

## Implementation Phases

### Phase 1: Backend Token Infrastructure
1. Create `server/api-tokens.js` with token CRUD helpers (hash, create, validate, revoke, list, in-memory cache, lastUsedAt throttling)
2. Update `authMiddleware` in `shared/server/auth.js` to check Bearer tokens with **hard-stop on invalid tokens** (no fallback to header/local-dev)
3. Update `proxySecretGuard` to accept injected `tokenValidator` and validate tokens inline before allowing through
4. Move `/api/whoami` after `authMiddleware` in `dev-server.js`; rewrite to use `req.userEmail`/`req.isAdmin`
5. Add `/api/tokens` and `/api/admin/tokens` routes to `dev-server.js` with input validation (name length, expiresIn allowlist, per-user cap of 25)
6. Add demo mode guard for `POST /api/tokens` (explicit error, not silent no-op)
7. Add OpenAPI docs for new endpoints
8. Write backend tests (including escalation-prevention tests: invalid token → 401, no fallback)

### Phase 2: Frontend Token Management UI
1. Create `useApiTokens.js` composable (uses `apiRequest()` directly)
2. Create `ApiTokensView.vue` component
3. Update `App.vue` with `api-tokens` shell route (v-else-if block, restoreFromHash, handleSidebarNavigate)
4. Add sidebar navigation entry in `AppSidebar.vue` (Key icon, before Settings)
5. Write frontend tests

### Phase 3: Deployment & Documentation
1. Add dedicated API Route to kustomize base (`api-route.yaml`)
2. Add overlay patches for dev, preprod, prod hostnames; delete in local overlay
3. Update `docs/DATA-FORMATS.md` with `api-tokens.json` schema
4. Add `fixtures/api-tokens.json` for demo mode
5. Update this project's `CLAUDE.md` with new API routes

## UX Teammate

**Yes, a UX teammate should be spawned for Phase 2.** The API Tokens page needs:
- Token creation modal with copy-to-clipboard UX
- "Shown once" warning pattern
- Token table with expiration status indicators
- Admin section for viewing/revoking all tokens
- Responsive layout consistent with existing app style

This is a self-contained UI task that can be done in parallel with Phase 1 backend work once the API contract (routes, request/response shapes) is defined.

## Security Considerations

1. **Token hashing**: Raw tokens are never stored. SHA-256 hash is sufficient for bearer tokens (unlike passwords, tokens have high entropy and don't need bcrypt/scrypt).
2. **Token shown once**: The raw token is only returned in the POST response. No retrieval endpoint exists.
3. **Token prefix**: The `tt_` prefix helps credential scanners (like GitHub's secret scanning) identify leaked tokens.
4. **No token in logs**: Auth middleware should not log the full token value — only the prefix.
5. **HTTPS only**: In production, all traffic goes through the OpenShift route which enforces TLS.
6. **Expiration**: Optional but encouraged via UI defaults (default selection = 90 days).
7. **Hard-stop on invalid tokens**: When a Bearer token is present but invalid/expired, the auth middleware returns 401 immediately. It NEVER falls through to the `X-Forwarded-Email` or local dev fallback. This prevents an escalation attack where a garbage token bypasses the proxy secret guard and then inherits admin access via the fallback.
8. **Inline token validation in proxy guard**: `proxySecretGuard` validates the token hash exists before allowing the request through. A garbage `Authorization: Bearer tt_...` header is rejected at the guard level, not just at the auth middleware level. Defense in depth.
9. **User deprovisioning**: The allowlist controls **admin privileges only**, not general access. In production, general access control is handled by the OAuth proxy (Red Hat SSO) — but token auth bypasses the proxy by design. This means:
   - Removing a user from the allowlist → their tokens lose **admin** access only
   - A deprovisioned user's non-expiring token still grants read access to all non-admin endpoints (roster, metrics, contributions, trends)
   - **Mitigations**:
     - **(a) Admin token revocation**: Admins can view all tokens and revoke any token via the admin UI. This should be part of the user offboarding process.
     - **(b) Token expiration**: Encourage expiring tokens via UI defaults (90-day default selection). Non-expiring tokens are the highest risk.
     - **(c) Future enhancement**: Optionally add a token-specific access check — when a Bearer token is used, check the `ownerEmail` against the allowlist and reject if not present. This would make the allowlist function as both an admin list AND a token access list, closing the gap. Not included in the initial implementation to keep scope focused, but documented here as a recommended follow-up.
   - **Why not include (c) now?** The allowlist currently functions purely as an admin privilege list. Making it also control token access changes its semantics. This is a deliberate architectural decision that should be discussed separately — it may warrant a dedicated "token access list" or integration with an external identity provider rather than overloading the allowlist.
10. **Per-user token limit**: Maximum 25 tokens per user prevents unbounded growth of the token store.
11. **CORS**: The existing `Access-Control-Allow-Origin: *` policy means any origin with a valid token can make authenticated cross-origin requests. This is acceptable since tokens are user-managed secrets (same trust model as API keys for GitHub, Jira, etc.). If CORS needs tightening in the future, it should be a separate effort that applies to all auth methods.
12. **Filesystem concurrency**: Token CRUD operations (create, revoke) use a simple write lock (serialized via an in-memory mutex/queue) to prevent race conditions on `api-tokens.json`. `lastUsedAt` updates are fire-and-forget with throttling, so a lost update is acceptable (worst case: stale last-used timestamp). This matches the concurrency model of all other `data/` files in the app.
