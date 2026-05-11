# RBAC System Plan

## Summary of Requirements (confirmed with user)

1. **New role: "Team Admin"** -- global (all teams), manages team CRUD and field definitions
2. **Team Admins also get**: global member assignment (assign/unassign people to any team)
3. **Scope**: Global, not per-team or per-org
4. **Manager tier**: Stays separate and unchanged (LDAP-derived, scoped to reports)
5. **Roles storage**: Migrate admin allowlist (`allowlist.json`) into a unified `roles.json`
6. **Admin UI**: Overhaul the Settings > Users page to support role assignment (search roster, assign roles)
7. **Module page**: New "Manage" nav item in People & Teams module, visible to Team Admins + platform admins
8. **What moves to module page**: Team CRUD and field definitions (NOT roster sync, NOT site config -- those stay in admin Settings)
9. **What stays in admin Settings**: General, Modules, Users (role management), roster sync config, Jira sync, site config

---

## Phase 1: Roles Data Layer

### 1.1 Create `data/roles.json` format and storage

New file: `shared/server/role-store.js`

**Data format:**
```json
{
  "version": 1,
  "assignments": {
    "user@example.com": {
      "roles": ["admin"],
      "assignedBy": "system-seed",
      "assignedAt": "2026-04-28T12:00:00.000Z"
    }
  }
}
```

**Roles enum:** `"admin"`, `"team-admin"`

**Exports:**
- `createRoleStore(readFromStorage, writeToStorage)` -- factory, same pattern as auth middleware
- `getRoles(email)` -> `string[]`
- `hasRole(email, role)` -> `boolean`
- `assignRole(email, role, actor)` -> void (logs to audit log with action `role.assign`)
- `revokeRole(email, role, actor)` -> void (logs to audit log with action `role.revoke`)
- `listAssignments()` -> all assignments object
- `getAdminEmails()` -> `string[]` (for backward-compat allowlist bridge)
- `migrateFromAllowlist()` -> one-time migration from `allowlist.json`

**Demo mode:** Write operations (`assignRole`, `revokeRole`) check `DEMO_MODE`. In demo mode, return `{ demo: true, message: 'Demo mode -- changes are not saved' }` without writing, consistent with the `demoWriteGuard` pattern used throughout the codebase. Read operations work normally.

**Role revocation guards:**
- Cannot remove the last `admin` role (mirrors current allowlist protection)
- Admins CAN remove their own admin role IF other admins exist (allows graceful handoff)
- Self-demotion requires confirmation in the UI (Phase 4.1)

### 1.2 Migrate `allowlist.json` -> `roles.json`

**Migration flow (existing deployment -- has `allowlist.json`):**
1. On server startup, check if `roles.json` exists -- no
2. Check if `allowlist.json` exists -- yes
3. Auto-migrate: each email in allowlist gets `roles: ["admin"]`, `assignedBy: "migration"`, `assignedAt: <now>`
4. Mark `allowlist.json` with deprecation notice: `{ "_migrated": "roles.json", "_migratedAt": "...", "emails": [...] }`
5. `seedRoles()` checks `roles.json` -- already populated -> no-op

**Fresh deployment flow (no files):**
1. `seedRoles()` checks `roles.json` -- empty/missing
2. No `allowlist.json` to migrate
3. Reads `ADMIN_EMAILS` env var
4. Calls `roleStore.assignRole(email, 'admin', 'system-seed')` for each email
5. Never touches `allowlist.json`

**First-user auto-add (no files, no `ADMIN_EMAILS`):**
The code at `auth.js:137-141` is updated to write to `roles.json`:
```js
// OLD: writeToStorage('allowlist.json', { emails: [req.userEmail] })
// NEW:
const assignments = roleStore.listAssignments();
if (!assignments || Object.keys(assignments).length === 0) {
  roleStore.assignRole(req.userEmail, 'admin', 'auto-first-user');
  console.log(`Roles: auto-added first user ${req.userEmail} as admin`);
}
```

**`seedAdminList()` renamed to `seedRoles()`** and updated to operate on `roles.json` via role-store. Note: adding a new email to `ADMIN_EMAILS` env var does NOT auto-add them if `roles.json` already has admins. New admins must be added via the UI. This matches current behavior (env var only seeds on first boot).

### 1.3 Update `shared/server/permissions.js`

**`getPermissionTier()` signature change:**

Current: `getPermissionTier(uid, registry, isAdminFlag)`
New: `getPermissionTier(uid, registry, isAdminFlag, isTeamAdminFlag)`

The function stays pure -- it does NOT access role-store directly. The caller (`auth.js`) computes the boolean flags and passes them in.

```js
function getPermissionTier(uid, registry, isAdminFlag, isTeamAdminFlag) {
  if (isAdminFlag) return 'admin';
  if (isTeamAdminFlag) return 'team-admin';
  if (!uid) return 'user';
  if (isManager(uid, registry)) return 'manager';
  return 'user';
}
```

**`canEditPerson()` signature change:**

Current: `canEditPerson(actorUid, targetUid, isAdminFlag, managerMap)`
New: `canEditPerson(actorUid, targetUid, isAdminFlag, isTeamAdminFlag, managerMap)`

```js
function canEditPerson(actorUid, targetUid, isAdminFlag, isTeamAdminFlag, managerMap) {
  if (isAdminFlag) return true;
  if (isTeamAdminFlag) return true;  // global scope, like admin
  if (!actorUid) return false;
  const managed = getManagedUids(actorUid, managerMap);
  return managed.has(targetUid);
}
```

All call sites (2 in `modules/team-tracker/server/index.js` -- person field update routes) updated to pass `req.isTeamAdmin`.

**No new exports needed** -- `isTeamAdmin` check is done in auth.js via role-store, not in permissions.js.

### 1.4 Update `shared/server/auth.js`

**`createAuthMiddleware` changes:**
- Accepts role-store instance (created by caller in `dev-server.js`)
- `isAdmin()` reads from role-store (`roleStore.hasRole(email, 'admin')`) instead of allowlist
- `seedAdminList()` renamed to `seedRoles()`, writes to `roles.json`
- First-user auto-add writes to `roles.json` (see 1.2)

**`resolveUserUid()` changes (line 49-62):**
After computing `req.isAdmin`, add team-admin resolution:
```js
req.isTeamAdmin = roleStore.hasRole(req.userEmail, 'team-admin');
req.permissionTier = getPermissionTier(req.userUid, registry, req.isAdmin, req.isTeamAdmin);
```

**`applyImpersonation()` changes (line 64-98):**
After the existing `req.isAdmin = isAdmin(req.userEmail)` line, add:
```js
req.isTeamAdmin = roleStore.hasRole(req.userEmail, 'team-admin');
req.permissionTier = getPermissionTier(req.userUid, registry, req.isAdmin, req.isTeamAdmin);
```
This means impersonating a team-admin shows the team-admin experience; impersonating a regular user shows the user experience.

**New middleware:**
```js
function requireTeamAdmin(req, res, next) {
  if (!req.isAdmin && !req.isTeamAdmin) {
    return res.status(403).json({ error: 'Team admin access required.' });
  }
  next();
}
```

**Updated return value:**
```js
return { authMiddleware, requireAdmin, requireTeamAdmin, isAdmin, seedRoles }
```

---

## Phase 2: Backend API Changes

### 2.1 New role management API endpoints

Located in `server/dev-server.js`, alongside existing `/api/allowlist` routes.

- `GET /api/roles` -- list all role assignments (admin only)
- `POST /api/roles/assign` -- assign role `{ email, role }` (admin only)
- `POST /api/roles/revoke` -- revoke role `{ email, role }` (admin only; uses POST not DELETE to avoid URL encoding issues with emails)
- `GET /api/roles/me` -- get current user's roles (any authenticated user)

Role changes are logged via the existing `auditLog` system (`shared/server/audit-log.js`) with action types `role.assign` and `role.revoke`, recording actor, target email, role, and timestamp.

### 2.2 Update team-tracker module routes

File: `modules/team-tracker/server/index.js`

**Destructure `requireTeamAdmin` from context (line 2):**
```js
const { storage, requireAdmin, requireTeamAdmin } = context;
```

**Routes changed from `requireAdmin` to `requireTeamAdmin`:**
- `POST /structure/teams` (line 504) -- create team
- `PATCH /structure/teams/:teamId` (line 515) -- rename team
- `DELETE /structure/teams/:teamId` (line 526) -- delete team
- `POST /structure/field-definitions/person` (line 612) -- create person field
- `PATCH /structure/field-definitions/person/:fieldId` (line 629) -- edit person field
- `DELETE /structure/field-definitions/person/:fieldId` (line 641) -- delete person field
- `POST /structure/field-definitions/person/reorder` (line 649) -- reorder person fields
- `POST /structure/field-definitions/team` (line 660) -- create team field
- `PATCH /structure/field-definitions/team/:fieldId` (line 677) -- edit team field
- `DELETE /structure/field-definitions/team/:fieldId` (line 689) -- delete team field
- `POST /structure/field-definitions/team/reorder` (line 697) -- reorder team fields
- `PATCH /structure/teams/:teamId/fields` (line 734) -- update team field values

**Routes that STAY `requireAdmin`:**
- All `/admin/roster-sync/*` routes
- All `/admin/jira-sync/*` routes
- `POST /snapshots/generate`, `DELETE /snapshots`
- `GET /structure/migrate/preview`, `POST /structure/migrate`
- `GET /sheets/discover`
- `DELETE /jira-name-cache`
- `POST /admin/roster-sync/unified`

**`GET /structure/field-definitions` (line 600):** Update soft-delete filter to also show deleted fields to team-admins:
```js
if (!req.isAdmin && !req.isTeamAdmin) {
  defs.personFields = defs.personFields.filter(f => !f.deleted);
  defs.teamFields = defs.teamFields.filter(f => !f.deleted);
}
```

### 2.3 Update `requireManagerOrAdmin` middleware

This is a **local closure** inside `modules/team-tracker/server/index.js` (line 445), NOT shared code. It captures `managerMap` via closure. Updated **in place** in the module file:

```js
function requireManagerOrAdmin(getTargetUid) {
  return (req, res, next) => {
    if (req.isAdmin) return next();
    if (req.isTeamAdmin) return next();  // team-admins bypass per-person check
    const targetUid = getTargetUid(req);
    if (!req.userUid) return res.status(403).json({ error: 'Cannot determine your identity' });
    const managed = permissions.getManagedUids(req.userUid, managerMap);
    if (managed.has(targetUid)) return next();
    return res.status(403).json({ error: 'Not authorized for this person' });
  };
}
```

No shared code changes needed -- `req.isTeamAdmin` is set by auth middleware before module routes run.

### 2.4 Update bulk member assignment route

`POST /structure/teams/:teamId/members/bulk` (line 551) has its **own inline auth check** and does NOT use `requireManagerOrAdmin`. Updated in place:

```js
// OLD:
if (!req.isAdmin) {
  // ...check managed UIDs...
}

// NEW:
if (!req.isAdmin && !req.isTeamAdmin) {
  if (!req.userUid) return res.status(403).json({ error: 'Cannot determine your identity' });
  const managed = permissions.getManagedUids(req.userUid, managerMap);
  const denied = uids.filter(uid => !managed.has(uid));
  if (denied.length > 0) {
    return res.status(403).json({ error: 'Not authorized for all requested people', denied });
  }
}
```

### 2.5 Update `/api/whoami`

Include roles in response:
```js
{
  // ...existing fields...
  roles: roleStore.getRoles(req.userEmail),
  isTeamAdmin: req.isTeamAdmin
}
```

### 2.6 Update `/permissions/me`

Include team-admin status:
```js
{
  email: req.userEmail,
  uid: req.userUid,
  tier: req.permissionTier,  // now includes 'team-admin' as possible value
  managedUids: managed,
  roles: roleStore.getRoles(req.userEmail)
}
```

### 2.7 Add `requireTeamAdmin` to module context

In `server/dev-server.js` (~line 696):
```js
const moduleContext = {
  storage: storageModule,
  requireAuth: authMiddleware,
  requireAdmin,
  requireTeamAdmin,  // NEW
  registerDiagnostics: null
};
```

---

## Phase 3: Frontend -- Module "Manage" Page

### 3.1 New view: `modules/team-tracker/client/views/ManageView.vue`

Contains the team CRUD UI and field definition management UI. Only visible to users with `team-admin` or `admin` role. Imports existing self-contained components directly:

```vue
<template>
  <div>
    <h2>Manage Teams & Fields</h2>
    <div><!-- tab bar: Teams | Fields --></div>
    <TeamManagement v-if="activeTab === 'teams'" />
    <FieldDefinitionManager v-if="activeTab === 'fields'" />
  </div>
</template>

<script setup>
import TeamManagement from '../components/TeamManagement.vue'
import FieldDefinitionManager from '../components/FieldDefinitionManager.vue'
</script>
```

### 3.2 Settings component split

`TeamTrackerSettings.vue` currently has these sub-tabs. After the split:

| Component | Current location | Destination |
|-----------|-----------------|-------------|
| `PeopleAndTeamsSettings.vue` | Settings tab | **STAYS** in admin settings |
| `GoogleSheetsSettings.vue` | Settings tab | **STAYS** in admin settings |
| `JiraSyncSettings.vue` | Settings tab | **STAYS** in admin settings |
| `SnapshotSettings.vue` | Settings tab | **STAYS** in admin settings |
| `TeamManagement.vue` | Settings tab | **MOVES** to ManageView |
| `FieldDefinitionManager.vue` | Settings tab | **MOVES** to ManageView |
| `AuditLogView.vue` | Settings tab | **STAYS** in admin settings |
| `SyncStatusPanel.vue` | Settings tab (above tabs) | **STAYS** in admin settings |
| `MigrationFieldConfig.vue` | Settings tab (dialog) | **STAYS** in admin settings |
| Team data source radio buttons | Settings tab (inline) | **STAYS** in admin settings |

`TeamManagement.vue` and `FieldDefinitionManager.vue` are already self-contained components with no settings-specific dependencies. No extraction or refactoring needed -- they are simply re-imported in ManageView.

`TeamTrackerSettings.vue` is updated to remove the "teams" and "fields" sub-tabs.

### 3.3 Update `modules/team-tracker/module.json`

Add new nav item with a `requireRole` property for client-side filtering:

```json
{
  "navItems": [
    { "id": "home", "label": "Team Directory", "icon": "Users", "default": true },
    { "id": "people", "label": "People", "icon": "User" },
    { "id": "trends", "label": "Trends", "icon": "TrendingUp" },
    { "id": "reports", "label": "Reports", "icon": "FileText" },
    { "id": "org-dashboard", "label": "Org Dashboard", "icon": "Building2" },
    { "id": "manage", "label": "Manage", "icon": "Settings", "requireRole": "team-admin" }
  ]
}
```

### 3.4 Navigation guard

The `module.json` `navItems` array is static and does not support conditional visibility natively. Implementation:

1. **Sidebar filtering:** The sidebar rendering component (module nav in `AppSidebar.vue` or equivalent) filters nav items client-side. When a nav item has `requireRole`, it is only shown if the user is admin OR has the specified role.

2. **Route-level guard:** ManageView checks permissions on mount via `usePermissions()`. If the user lacks `team-admin` or `admin` role, redirect to the module home view.

### 3.5 Update shared composables

**`shared/client/composables/usePermissions.js`:**
```js
const isTeamAdmin = computed(() =>
  tier.value === 'team-admin' || tier.value === 'admin'
)

function canEdit(uid) {
  if (isAdmin.value) return true
  if (isTeamAdmin.value) return true  // global scope
  return managedUids.value.has(uid)
}

function canEditTeam(_teamId) {
  return isAdmin.value || isTeamAdmin.value  // was: return isAdmin.value
}
```

Export `isTeamAdmin` alongside existing exports.

**`shared/client/composables/useAuth.js`:**
Expose `isTeamAdmin` and `roles` from `/api/whoami` response.

**`/permissions/me` response shape -- backward compatibility:**
The `tier` field gains `'team-admin'` as a new possible value. Existing frontend code uses `=== 'admin'` and `=== 'manager'` checks -- no exhaustive matching exists. The new value is safe and non-breaking.

---

## Phase 4: Frontend -- Overhauled Admin Users Page

### 4.1 Redesign `UserManagement` component

Replace the simple email allowlist UI with a full-featured role management interface:

- **Searchable user table** with columns: Name, Email, Role(s), Assigned By, Date
- **Add role action:** Search roster by name/email, select role (Admin / Team Admin), confirm
- **Remove role action:** Click to remove with confirmation dialog
- **Self-demotion:** Extra confirmation when removing your own admin role
- **Role options:** Admin, Team Admin
- **Search/autocomplete** against the roster registry

### 4.2 Remove old allowlist management UI

The old email-list-based allowlist UI is fully replaced by the roles-based UI.

---

## Phase 5: Backward Compatibility & Migration

### 5.1 Startup migration

- Server auto-migrates `allowlist.json` -> `roles.json` on first boot (idempotent)
- Logs migration details to console
- `allowlist.json` updated with deprecation marker: `{ "_migrated": "roles.json", "_migratedAt": "...", "emails": [...] }`
- Filesystem-based role storage assumes single-replica deployment (`replicas: 1`, `Recreate` strategy). Multi-replica scaling would require migrating to a shared datastore. This is consistent with all other `data/` file storage in the app.

### 5.2 API backward compatibility

All three existing allowlist endpoints become facades over role-store. `allowlist.json` is never read or written after migration. No split-brain possible.

- `GET /api/allowlist` -- derives admin email list from `roleStore.getAdminEmails()` (returns only admin-role emails, not team-admins)
- `POST /api/allowlist` -- calls `roleStore.assignRole(email, 'admin', actor)` (adding to allowlist = making admin, matching current semantics)
- `DELETE /api/allowlist/:email` -- calls `roleStore.revokeRole(email, 'admin', actor)` with last-admin protection

### 5.3 `ADMIN_EMAILS` env var

Still works for initial seeding, seeds as `admin` role in `roles.json`. Verified across overlays:
- **Dev overlay:** Clears `ADMIN_EMAILS` -- first user auto-seeds via first-user auto-add
- **Preprod/Prod overlays:** Inherit base value (`acorvin@redhat.com,acorvin@cluster.local`) -- seeds those emails as admin role

### 5.4 Rollback

Rollback by deleting `roles.json` restores original admin assignments from the `allowlist.json` backup via re-migration. **Team-admin role assignments made after migration will be lost** -- this is an inherent limitation of filesystem storage. Mitigation: the existing daily CronJob backup strategy should include `roles.json`. For disaster recovery, role assignments can be re-created via the admin UI.

---

## Files Modified

| File | Change |
|------|--------|
| `shared/server/role-store.js` | **NEW** -- Role CRUD, migration from allowlist, demo mode guard, audit logging |
| `shared/server/permissions.js` | Update `getPermissionTier(uid, registry, isAdminFlag, isTeamAdminFlag)`, update `canEditPerson(actorUid, targetUid, isAdminFlag, isTeamAdminFlag, managerMap)` |
| `shared/server/auth.js` | Accept role-store, add `requireTeamAdmin`, set `req.isTeamAdmin`, update `resolveUserUid`, update `applyImpersonation`, update first-user auto-add, rename `seedAdminList` -> `seedRoles` |
| `shared/server/index.js` | Export `requireTeamAdmin`, role-store |
| `shared/API.md` | Document new shared exports and `requireTeamAdmin` |
| `server/dev-server.js` | Add `/api/roles/*` endpoints, add `requireTeamAdmin` to `moduleContext`, update `/api/whoami`, update allowlist endpoints to facade over role-store, update first-user auto-add |
| `modules/team-tracker/server/index.js` | Destructure `requireTeamAdmin` from context, switch 12 routes from `requireAdmin` to `requireTeamAdmin`, add `req.isTeamAdmin` check to local `requireManagerOrAdmin` closure (line 445), add `req.isTeamAdmin` check to bulk member assignment inline auth (line 559), update `canEditPerson` call sites, update field-definitions GET soft-delete filter |
| `modules/team-tracker/module.json` | Add "Manage" nav item with `requireRole: "team-admin"` |
| `modules/team-tracker/client/views/ManageView.vue` | **NEW** -- Team/field management page importing `TeamManagement` and `FieldDefinitionManager` |
| `modules/team-tracker/client/index.js` | Register ManageView route |
| `modules/team-tracker/client/components/TeamTrackerSettings.vue` | Remove "teams" and "fields" sub-tabs (components moved to ManageView) |
| `src/components/AppSidebar.vue` | Filter nav items by `requireRole` property against user permissions |
| `shared/client/composables/useAuth.js` | Expose `isTeamAdmin`, `roles` from whoami response |
| `shared/client/composables/usePermissions.js` | Add `isTeamAdmin` computed, update `canEdit` (allow team-admin global), update `canEditTeam` (allow team-admin) |
| `shared/client/services/api.js` | Add role management API calls (`fetchRoles`, `assignRole`, `revokeRole`, `fetchMyRoles`) |

---

## Testing

### Unit tests

**`role-store.test.js`:**
- CRUD: assign role, revoke role, list assignments, get roles for email
- Migration: converts allowlist emails to admin roles, marks allowlist as deprecated
- Guards: cannot remove last admin, can self-demote if other admins exist
- Demo mode: write operations return demo response without writing
- Edge cases: empty email, invalid role name, duplicate assignment

**`permissions.test.js`:**
- `getPermissionTier`: returns `'team-admin'` when `isTeamAdminFlag` is true and `isAdminFlag` is false
- `getPermissionTier`: admin takes precedence over team-admin
- `canEditPerson`: team-admin can edit any person (global scope)
- `canEditPerson`: manager can only edit managed UIDs (unchanged)

**`auth.test.js`:**
- `requireTeamAdmin` middleware: allows admin, allows team-admin, rejects user/manager
- `resolveUserUid` sets `req.isTeamAdmin` correctly
- `applyImpersonation` recalculates `req.isTeamAdmin` for impersonated user
- First-user auto-add writes to roles.json, not allowlist.json

### Integration tests

**Route authorization:**
- Team-admin CAN: create/rename/delete teams, create/edit/delete field definitions, assign/unassign members (any team), bulk assign members, update team field values
- Team-admin CANNOT: access roster sync config, Jira sync config, trigger sync, generate snapshots, access migration, discover sheets, delete jira-name-cache
- Manager CAN: assign/unassign members (own reports only), edit person fields (own reports only)
- Manager CANNOT: create/delete teams, manage field definitions

**Allowlist bridge tests:**
1. `GET /api/allowlist` returns only admin-role emails from roles.json
2. `POST /api/allowlist { email }` assigns admin role, visible in `GET /api/roles`
3. `POST /api/roles/revoke { email, role: 'admin' }` removes from `GET /api/allowlist`
4. `DELETE /api/allowlist/:email` also removes from roles.json
5. Cannot remove last admin via any endpoint (legacy or new)
6. Team-admin assignments do NOT appear in `GET /api/allowlist`
7. After fresh migration: allowlist endpoints reflect migrated data
8. Mixed scenario: add via new API, verify visible via legacy GET

### Frontend tests

- ManageView: renders for team-admin, redirects for regular user
- Nav item: "Manage" visible for team-admin/admin, hidden for user/manager
- UserManagement: role assignment flow, search, confirmation dialogs

---

## Deployability

**Zero-config deployment:**
- Auto-migration from `allowlist.json` -> `roles.json` on startup. No manual intervention.
- No new Dockerfile or nginx changes needed. Backend Dockerfile already copies `shared/server/` and `modules/`.
- No new secrets, environment variables, or ConfigMap entries needed.
- CI/CD change detection already covers `shared/server/**` and `modules/*/server/**`.

**Deployment strategy:**
- `Recreate` strategy with `replicas: 1` means brief downtime during rollout. Migration is startup-time and idempotent -- safe.
- PVC is `ReadWriteOnce` -- fine for single replica. Multi-replica would need rethinking (consistent with all other data files).

---

## UX Teammate Recommendation

**Recommended: Yes, spawn a UX teammate** to review the ManageView layout and the overhauled Users page. Key UX decisions:
- ManageView page layout (tabs vs sections for teams vs fields)
- Role assignment UX (search, multi-select, confirmation flows)
- How to communicate role differences to users
- Nav item visibility/icon choice
