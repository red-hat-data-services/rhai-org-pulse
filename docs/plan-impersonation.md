# User Impersonation Feature — Implementation Plan

## Overview

Admin-only feature that allows admins to assume the identity of any roster user. While impersonating, the admin sees the app exactly as that user would (permission tier, managed teams, editable fields) and can perform actions as that user. All actions during impersonation are audit-logged with both the real admin identity and the impersonated user.

## Requirements (from user)

- **Use case**: Full impersonation — view AND perform actions as the target user
- **Environments**: Both production (OAuth proxy) and local dev
- **Audit**: All actions during impersonation are logged, tagged with impersonation context
- **Target scope**: Roster users only (must have a UID in the registry)

## Current Auth Architecture

### Identity Resolution Flow

1. **Proxy secret guard** (`proxySecretGuard`) — validates `X-Proxy-Secret` header or `tt_` Bearer token (production only)
2. **Auth middleware** (`authMiddleware`) — resolves `req.userEmail` from:
   - `Bearer tt_*` token → token record's `ownerEmail`
   - `X-Forwarded-Email` header → proxy-authenticated email
   - Fallback → first email from `ADMIN_EMAILS` env var (local dev)
3. **UID resolution** (`resolveUserUid`) — looks up `req.userEmail` in `team-data/registry.json` to set `req.userUid`
4. **Permission tier** (`getPermissionTier`) — computes `req.permissionTier` as `admin | manager | user`

### Key Request Properties Set by Auth

| Property | Source | Used by |
|----------|--------|---------|
| `req.userEmail` | Auth header/token/fallback | Audit logs, whoami, permission checks |
| `req.isAdmin` | Allowlist check | Route guards, permission tier |
| `req.userUid` | Registry lookup by email | Manager map, permission checks |
| `req.permissionTier` | `getPermissionTier()` | Route-level RBAC |
| `req.authMethod` | `token` / `proxy` / `local-dev` | Whoami display |

### Frontend Identity

- `useAuth()` — calls `/api/whoami`, exposes `user`, `isAdmin`, `permissionTier`
- `usePermissions()` — calls `/api/modules/team-tracker/permissions/me`, exposes `tier`, `managedUids`, `userUid`, `canEdit()`, `canEditTeam()`

### Audit Log

- `appendAuditEntry(storage, { action, actor, entityType, entityId, ... })` — `actor` is always `req.userEmail`
- Stored in `data/audit-log.json`, capped at 10,000 entries

## Design

### Approach: Header-Based Impersonation

The admin sends a custom header `X-Impersonate-Uid` with each request. The auth middleware detects this header, verifies the caller is an admin, and re-resolves identity to the target user — while preserving the real admin identity for audit purposes.

**Why header-based (not session-based)**:
- Stateless — no server-side session to manage, clean up, or leak
- Works identically in both environments (proxy + local dev)
- Works with API tokens (programmatic impersonation for testing)
- Frontend controls impersonation state entirely via a reactive ref; toggling off is instant (stop sending the header)
- No risk of "stuck" impersonation if browser crashes or tab closes

### Backend Changes

#### 1. Modify `authMiddleware` in `shared/server/auth.js`

Extract the impersonation logic into a helper function called by **both** auth paths (token and proxy/local-dev):

```javascript
function applyImpersonation(req, res) {
  const impersonateUid = req.headers['x-impersonate-uid'];
  if (!impersonateUid) {
    // No impersonation — set auditActor for consistency
    req.auditActor = req.userEmail;
    return null; // proceed normally
  }

  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Only admins can impersonate' });
  }

  // Guard: don't impersonate yourself (null-safe: skip if admin not in registry)
  if (req.userUid && impersonateUid === req.userUid) {
    return res.status(400).json({ error: 'Cannot impersonate yourself' });
  }

  const registry = readFromStorage('team-data/registry.json');
  if (!registry?.people?.[impersonateUid] || registry.people[impersonateUid].status !== 'active') {
    return res.status(404).json({ error: 'Target user not found in roster' });
  }

  const target = registry.people[impersonateUid];

  // Preserve real admin identity for audit
  req.realAdminEmail = req.userEmail;
  req.realAdminUid = req.userUid;

  // Assume target identity
  req.userEmail = target.email?.toLowerCase() || impersonateUid;
  req.userUid = impersonateUid;
  req.isAdmin = isAdmin(req.userEmail);
  req.permissionTier = getPermissionTier(req.userUid, registry, req.isAdmin);
  req.isImpersonating = true;
  req.impersonatedDisplayName = target.name || null;

  // Pre-computed audit actor for route handlers
  req.auditActor = `${req.userEmail} (impersonated by ${req.realAdminEmail})`;
  return null; // proceed normally
}
```

Then modify `authMiddleware` to call `applyImpersonation` at **both** exit points:

```javascript
async function authMiddleware(req, res, next) {
  if (req.method === 'OPTIONS') return next();

  // --- Token auth path ---
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer tt_')) {
    const rawToken = authHeader.slice('Bearer '.length);
    if (tokenValidator) {
      const tokenRecord = tokenValidator.validateToken(rawToken);
      if (!tokenRecord) {
        return res.status(401).json({ error: 'Invalid or expired API token' });
      }
      req.userEmail = tokenRecord.ownerEmail;
      req.isAdmin = isAdmin(tokenRecord.ownerEmail);
      req.authMethod = 'token';
      tokenValidator.touchLastUsed(tokenRecord.id);
      resolveUserUid(req);
      // FIXED: apply impersonation for token-authenticated requests too
      const blocked = applyImpersonation(req, res);
      if (blocked) return; // response already sent (403/400/404)
      return next();
    }
    return res.status(401).json({ error: 'API token authentication is not configured' });
  }

  // --- Proxy / local-dev path ---
  const email = req.headers['x-forwarded-email'];
  if (email) {
    req.userEmail = email.toLowerCase();
  } else {
    req.userEmail = (process.env.ADMIN_EMAILS || 'local-dev@redhat.com').split(',')[0].trim().toLowerCase();
  }

  const adminList = readFromStorage('allowlist.json');
  if (!adminList || !adminList.emails || adminList.emails.length === 0) {
    const seeded = { emails: [req.userEmail] };
    writeToStorage('allowlist.json', seeded);
  }

  req.isAdmin = isAdmin(req.userEmail);
  resolveUserUid(req);
  // FIXED: apply impersonation for proxy/local-dev requests
  const blocked = applyImpersonation(req, res);
  if (blocked) return;
  next();
}
```

**Key fix (C1)**: The original plan placed impersonation only after the proxy/local-dev path. The token auth path (`Bearer tt_*`) has an early `return next()` that would bypass impersonation entirely. The refactored design uses a shared `applyImpersonation` helper called from both paths.

**Note on double registry read**: `resolveUserUid` reads `team-data/registry.json` via `readFromStorage`, and `applyImpersonation` reads it again. `readFromStorage` uses `fs.readFileSync` (no in-memory cache). This is acceptable for v1 — the file is typically <1MB and the read is fast. If needed, the registry can be passed as a parameter from `resolveUserUid` to `applyImpersonation` to eliminate the double read.

#### 2. Modify `/api/whoami` in `server/dev-server.js`

Add impersonation metadata to the response:

```javascript
app.get('/api/whoami', function(req, res) {
  let displayName = req.userEmail;
  if (req.authMethod !== 'token') {
    const preferred = req.headers['x-forwarded-preferred-username'];
    const user = req.headers['x-forwarded-user'];
    const email = req.headers['x-forwarded-email'];
    displayName = preferred || user || email || req.userEmail;
  }

  const response = {
    email: req.userEmail,
    displayName,
    isAdmin: req.isAdmin,
    permissionTier: req.permissionTier || (req.isAdmin ? 'admin' : 'user'),
    authMethod: req.authMethod || (req.headers['x-forwarded-email'] ? 'proxy' : 'local-dev')
  };

  if (req.isImpersonating) {
    response.impersonating = true;
    response.realAdmin = req.realAdminEmail;
    // Use displayName set during auth (avoids redundant registry read)
    if (req.impersonatedDisplayName) response.displayName = req.impersonatedDisplayName;
  }

  res.json(response);
});
```

#### 3. Modify `/permissions/me` in `modules/team-tracker/server/index.js`

No changes needed — it already reads from `req.userEmail`, `req.userUid`, and `req.permissionTier`, which will be the impersonated values.

#### 4. Audit Log Enhancement — `req.auditActor` (middleware-set)

The `applyImpersonation` helper pre-computes `req.auditActor` on every request:

- **During impersonation**: `req.auditActor = "target@... (impersonated by admin@...)"`
- **Normal requests**: `req.auditActor = req.userEmail`

Route handlers change from `req.userEmail` → `req.auditActor` when passing the actor to store functions. This is ~18 call sites in `modules/team-tracker/server/index.js`, but:
- It's a mechanical find-and-replace (`req.userEmail` → `req.auditActor` in audit-related arguments)
- The property is always present (set unconditionally), so no conditional logic in handlers
- The actor string is human-readable and grep-friendly

**Alternative considered**: Intercepting inside `appendAuditEntry` itself by checking a request-scoped context. Rejected because the audit module shouldn't know about HTTP request objects.

#### 5. Impersonation-Blocked Routes

Certain routes use `req.userEmail` for purposes beyond audit logging and should be **blocked during impersonation** to prevent untraceable or confusing actions:

| Route | Risk | Action |
|-------|------|--------|
| `POST /api/allowlist` | Admin A impersonating Admin B could modify allowlist appearing as B, with no audit trail (allowlist routes only log to console) | **Block** |
| `DELETE /api/allowlist/:email` | Same as above | **Block** |
| `POST /api/tokens` | Token created would belong to the impersonated user's email | **Block** |
| `DELETE /api/tokens/:id` | Token revocation scoped to impersonated user | **Block** |
| `DELETE /api/admin/tokens/:id` | Admin token revocation — ambiguous actor | **Block** |

Implementation: Add a middleware guard on these routes:

```javascript
function blockDuringImpersonation(req, res, next) {
  if (req.isImpersonating) {
    return res.status(403).json({
      error: 'This action is not allowed while impersonating another user'
    });
  }
  next();
}
```

Apply to each blocked route: `app.post('/api/allowlist', requireAdmin, blockDuringImpersonation, ...)`.

**Sprint annotations** (`author: req.userEmail` at line 2010 of TT server) are a lower risk since annotations are visible and attributable. For v1, annotations during impersonation are allowed but will use the impersonated user's email as author, which is the intended behavior (testing what the user can do). The `req.auditActor` is not used here because annotations are not audit-logged.

#### 6. Audit Log Query Compatibility

The composite actor string `"user@email (impersonated by admin@email)"` breaks exact-match queries in `queryAuditLog` (`e.actor === filters.actor`). Two mitigations:

**v1 (minimal)**: Change the actor filter to use substring matching:
```javascript
if (filters.actor) {
  entries = entries.filter(e => e.actor.includes(filters.actor));
}
```

This allows querying for either the impersonated email or the admin email and getting all matching entries. It's a one-line change in `shared/server/audit-log.js`.

**v2 (future)**: Add structured `impersonatedBy` field to audit entries for precise filtering. This would be a schema change and is deferred.

No escalation risk: even if the target user is also an admin, the impersonator was already verified as admin. The impersonated identity inherits whatever permissions the target actually has.

### Frontend Changes

#### 1. New Composable: `shared/client/composables/useImpersonation.js`

```javascript
import { ref, computed } from 'vue'
import { clearApiCache } from '@shared/client/services/api'

// Module-level reactive state (singleton across all consumers)
const impersonatingUid = ref(null)
const impersonatingName = ref(null)

export function useImpersonation() {
  function startImpersonating(uid, name, { refreshAuth, refreshPermissions } = {}) {
    impersonatingUid.value = uid
    impersonatingName.value = name
    // Clear localStorage cache to prevent serving admin's cached data
    // as the impersonated user
    clearApiCache()
    // Re-fetch identity and permissions with impersonation header now active
    if (refreshAuth) refreshAuth()
    if (refreshPermissions) refreshPermissions()
  }

  function stopImpersonating({ refreshAuth, refreshPermissions } = {}) {
    impersonatingUid.value = null
    impersonatingName.value = null
    // Clear cache again to prevent impersonated user's data leaking back
    clearApiCache()
    if (refreshAuth) refreshAuth()
    if (refreshPermissions) refreshPermissions()
  }

  const isImpersonating = computed(() => !!impersonatingUid.value)

  return {
    impersonatingUid,
    impersonatingName,
    isImpersonating,
    startImpersonating,
    stopImpersonating
  }
}
```

The refresh callbacks are passed in by the caller (e.g., `App.vue`) which has access to both `useAuth()` and `usePermissions()`. This avoids circular imports between composables.

#### 2. Modify API Service (`shared/client/services/api.js`)

The `apiRequest` function must inject the `X-Impersonate-Uid` header when impersonation is active. Since `apiRequest` uses raw `fetch` internally, the header injection goes into `apiRequest` itself:

```javascript
// Import the reactive ref from the impersonation composable
import { impersonatingUid } from './useImpersonation'
// (or: export the ref directly from a shared module-level variable)

export async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) }

  // Inject impersonation header when active
  if (impersonatingUid.value) {
    headers['X-Impersonate-Uid'] = impersonatingUid.value
  }

  const response = await fetch(`${getApiBase()}${path}`, { ...options, headers })
  // ... rest unchanged
}
```

**Important**: To avoid circular imports, the `impersonatingUid` ref should be exported directly from `useImpersonation.js` as a named export (not only via the composable function), or extracted to a tiny shared reactive module (e.g., `shared/client/state/impersonation.js`).

#### 3. Modify `useAuth()` — switch to `apiRequest` and add `refresh`

**Critical fix**: `useAuth` currently uses raw `fetch()` for `/api/whoami` (line 17), which means the impersonation header would NOT be injected. It must switch to `apiRequest`.

Additionally, `useAuth` has no `refresh` method and uses a singleton `initialized` guard that prevents re-fetching. Both must be addressed:

```javascript
import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const user = ref(null)
const loading = ref(true)

let initialized = false

export function useAuth() {
  if (!initialized) {
    initialized = true
    fetchCurrentUser()
  }

  async function fetchCurrentUser() {
    try {
      // CHANGED: use apiRequest instead of raw fetch
      // so the X-Impersonate-Uid header is injected
      user.value = await apiRequest('/whoami')
    } catch {
      // Server not available (local dev without backend)
    } finally {
      loading.value = false
    }
  }

  // refresh() bypasses the initialized guard to force re-fetch
  async function refresh() {
    loading.value = true
    await fetchCurrentUser()
  }

  const isAdmin = computed(() => user.value?.isAdmin === true)
  const permissionTier = computed(() => user.value?.permissionTier || 'user')

  return {
    user,
    loading,
    isAdmin,
    permissionTier,
    refresh    // NEW: exposed for impersonation toggle
  }
}
```

**Note on `usePermissions`**: It already exports `refresh: fetchPermissions`, but the same `initialized` guard issue applies — `refresh()` works because it calls `fetchPermissions()` directly, bypassing the guard. Verified: this is correct as-is, no change needed.

#### 3a. Cache Poisoning Prevention

The `cachedRequest` function in `api.js` caches responses in localStorage keyed by path (e.g., `roster`, `people-metrics`). During impersonation, responses reflect the impersonated user's data but are cached under the same keys. After stopping, the admin would briefly see stale data for the impersonated user.

**Fix**: `clearApiCache()` is called in both `startImpersonating` and `stopImpersonating` (see composable above). This is already exported from `api.js` and clears all `app_cache:` prefixed localStorage entries.

#### 4. Impersonation Banner UI

A persistent banner at the top of the page when impersonating:

```
[!] Viewing as: Jane Smith (jsmith) — Manager tier | [Stop Impersonating]
```

- Rendered in `App.vue` (above all module content)
- Visually distinct (warning color — amber/yellow background)
- Shows: target name, UID, their permission tier
- "Stop Impersonating" button calls `stopImpersonating()`

#### 5. Impersonation Trigger

Add an "Impersonate" button/action in the team management UI, visible only to admins, next to each person's row. Clicking it calls `startImpersonating(uid, name)`.

The existing `/api/modules/team-tracker/org-teams/:teamKey/members` endpoint already returns member lists with UIDs and names, so **no new search/roster endpoint is needed** for the trigger UI. If a global "impersonate any user" picker is desired (e.g., in Settings), the existing `/api/roster` endpoint provides the full roster. For v1, the per-person button in the team management view is sufficient.

### API Changes Summary

| Endpoint | Change |
|----------|--------|
| All routes (both auth paths) | `X-Impersonate-Uid` header support via `applyImpersonation` |
| `GET /api/whoami` | New fields: `impersonating`, `realAdmin` |
| `POST/DELETE /api/allowlist` | Blocked during impersonation (403) |
| `POST/DELETE /api/tokens` | Blocked during impersonation (403) |
| `DELETE /api/admin/tokens/:id` | Blocked during impersonation (403) |
| Audit log entries | `actor` field includes `(impersonated by admin@...)` when applicable |
| Audit log query | `actor` filter uses substring match instead of exact match |

No new routes are required. No existing API contracts are broken — the `X-Impersonate-Uid` header is optional and ignored for non-admins.

### Security Considerations

1. **Admin-only**: The impersonation block rejects non-admins with 403 before any identity override occurs
2. **Roster-only targets**: Only active users in the registry can be impersonated (prevents fishing for arbitrary emails)
3. **Audit trail**: Every mutation during impersonation is audit-logged with the real admin's email via `req.auditActor`
4. **No privilege escalation**: The impersonated identity gets the target's actual permissions, not a union of admin + target
5. **Stateless**: No server-side session means no risk of orphaned impersonation state
6. **Header validation**: UID is validated against the registry on every request, preventing stale/invalid UIDs
7. **Proxy secret guard**: The `X-Impersonate-Uid` header is only processed after the real user passes authentication — it cannot bypass the proxy secret or token validation
8. **Cache isolation**: localStorage cache is cleared on impersonation start/stop to prevent data leaking between identities
9. **Self-impersonation guard**: Null-safe check (`req.userUid && impersonateUid === req.userUid`) prevents both self-impersonation and false positives when admin has no registry UID
10. **Sensitive route blocking**: Allowlist and token management routes are blocked during impersonation to prevent untraceable blame-shifting (allowlist has no audit log) and token ownership confusion
11. **Token auth parity**: Impersonation works identically for both proxy-authenticated and token-authenticated requests via the shared `applyImpersonation` helper

### Files to Modify

| File | Changes |
|------|---------|
| `shared/server/auth.js` | Extract `applyImpersonation` helper, call from both token and proxy auth paths, export `blockDuringImpersonation` guard |
| `server/dev-server.js` | Update `/api/whoami`; add `blockDuringImpersonation` to allowlist and token routes |
| `shared/server/audit-log.js` | Change actor filter from exact match to substring match (`includes`) |
| `shared/client/composables/useImpersonation.js` | **New file** — impersonation state management, cache clearing |
| `shared/client/services/api.js` | Add `X-Impersonate-Uid` header injection in `apiRequest()` |
| `shared/client/composables/useAuth.js` | Switch from raw `fetch` to `apiRequest`, add `refresh()` export |
| `shared/client/composables/usePermissions.js` | Already has `refresh` — no changes needed |
| `src/components/App.vue` | Add impersonation banner, wire up refresh callbacks |
| `modules/team-tracker/server/index.js` | Change ~18 audit call sites from `req.userEmail` to `req.auditActor` |

### Files NOT Modified

- `shared/server/permissions.js` — no changes; permission logic is unaware of impersonation
- `shared/server/team-store.js` / `shared/server/field-store.js` — no signature changes; they already accept `actorEmail` as a string parameter, so `req.auditActor` flows through without modification

## Testability

### Unit Tests

1. **`shared/server/__tests__/auth.test.js`** (new or extend existing):
   - Admin with valid `X-Impersonate-Uid` via proxy auth → identity is overridden, `req.isImpersonating = true`
   - Admin with valid `X-Impersonate-Uid` via token auth → identity is overridden (C1 regression test)
   - Non-admin with `X-Impersonate-Uid` → 403
   - Admin with invalid/inactive UID → 404
   - Admin impersonating self → 400
   - Admin with `req.userUid = null` and any `X-Impersonate-Uid` → proceeds (no false self-impersonation)
   - No header → normal auth flow unchanged, `req.auditActor === req.userEmail`
   - `req.auditActor` includes impersonation context during impersonation
   - `blockDuringImpersonation` middleware → 403 when `req.isImpersonating`

2. **`modules/team-tracker/__tests__/server/impersonation.test.js`** (new):
   - Impersonated user's permission tier is reflected in `/permissions/me`
   - Audit entries include impersonation context via `req.auditActor`
   - Team/field mutations during impersonation are audit-logged with both identities
   - Allowlist and token routes return 403 during impersonation
   - Audit log `actor` filter matches both impersonated and admin emails (substring search)

3. **Frontend tests**:
   - `useImpersonation` composable: start/stop toggles state, clears on stop
   - `clearApiCache()` is called on both start and stop
   - API service: `X-Impersonate-Uid` header is included when impersonating, absent when not
   - `useAuth` refresh: calling `refresh()` re-fetches `/whoami` even after initial load
   - Banner visibility: shown when impersonating, hidden when not

### Integration / Manual Testing

- Start local dev with two users in the registry
- Log in as admin, impersonate a manager → verify only that manager's reports are editable
- Make a field edit while impersonating → verify audit log shows "user@... (impersonated by admin@...)"
- Stop impersonating → verify admin permissions are restored
- Impersonate a regular user → verify admin-only UI (Settings, allowlist) is hidden
- While impersonating, attempt to modify allowlist → verify 403 response
- While impersonating, attempt to create an API token → verify 403 response
- Test impersonation via API token: `curl -H "Authorization: Bearer tt_..." -H "X-Impersonate-Uid: someuid" /api/whoami` → verify impersonated identity is returned
- Query audit log for admin's email → verify impersonated actions appear (substring match)
- **Kind cluster smoke test**: Deploy to the local Kind cluster (`deploy/openshift/overlays/local/`) and verify the `X-Impersonate-Uid` header survives the full nginx proxy chain. In production, the request flow is Client → OAuth Proxy → Nginx → Backend. Nginx passes custom headers by default, and the OAuth proxy (`--pass-user-headers=true`) should not strip non-identity headers, but this should be explicitly verified in a production-like environment before merging

## Deployability

- **Backward compatible**: No API contract changes for existing clients. The `X-Impersonate-Uid` header is optional and additive.
- **No database migrations**: Audit log format is unchanged (actor is a freeform string).
- **No config changes**: No new environment variables or config files.
- **Feature flag**: Not needed — the feature is inherently gated behind admin status. Non-admins cannot trigger it.
- **Rollback**: Safe to roll back — removing the header processing simply disables impersonation. No persistent state is created.

## Revision History

- **v1**: Initial plan
- **v2**: Incorporated DevOps review — added Kind cluster smoke test to manual testing
- **v3**: Incorporated code reviewer feedback:
  - Fixed: `useAuth` uses raw `fetch` — switched to `apiRequest` so impersonation header is injected (C2)
  - Fixed: `useAuth` has no `refresh` method — added `refresh()` export (C3)
  - Fixed: Singleton `initialized` guard — `refresh()` bypasses it by calling `fetchCurrentUser()` directly (C3)
  - Fixed: localStorage cache poisoning — `clearApiCache()` called on impersonation start/stop (M4)
  - Improved: Self-impersonation guard — null-safe check prevents `null === null` false positive (m1)
  - Improved: Audit approach — `req.auditActor` set in middleware (not a helper function)
  - Improved: `req.impersonatedDisplayName` set during auth to avoid redundant registry read in whoami
- **v4**: Incorporated team lead review:
  - Fixed: Token auth path bypasses impersonation — extracted `applyImpersonation` helper called from both auth paths (C1)
  - Fixed: Sensitive routes (allowlist, tokens) blocked during impersonation with `blockDuringImpersonation` guard (M1, M2)
  - Fixed: Audit log actor filter changed from exact match to substring match (M3)
  - Fixed: Removed false claim about "in-memory cache" — `readFromStorage` uses `fs.readFileSync` (M5)
  - Added: Explicit note that no new search endpoint is needed for trigger UI (m2)
  - Note: C2, C3, M4 were already addressed in v3

## Open Questions / Future Enhancements

1. **Impersonation timeout**: Should impersonation auto-expire after N minutes? Not needed for v1 since it's stateless (browser-only state clears on page refresh). SPA navigation keeps it active indefinitely by design — the banner makes this visible and the "Stop" button is always accessible.
2. **Restrict impersonation in production**: Should there be an additional env var to disable impersonation in production? The admin-only gate may be sufficient.
3. **Structured audit field**: v2 could add `impersonatedBy` as a first-class audit log field for precise filtering, replacing the substring-match approach.
4. **Notification**: Should the impersonated user be notified? Probably not for an internal admin tool.
5. **Circular import risk**: The `impersonatingUid` ref needs to be importable by `api.js`. If `useImpersonation.js` imports from `api.js` (e.g., `clearApiCache`), this creates a circular dependency. Mitigation: extract the reactive ref to a tiny `shared/client/state/impersonation.js` module with no other imports.
6. **Double registry read optimization**: `resolveUserUid` and `applyImpersonation` each call `readFromStorage('team-data/registry.json')` (filesystem read, no cache). For v1 this is acceptable (~1MB, fast). For v2, pass the registry as a parameter to avoid the second read.
