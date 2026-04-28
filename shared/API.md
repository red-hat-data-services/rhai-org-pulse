# Shared API Stability Contract

The `shared/` directory provides stable, reusable code for all built-in modules. Breaking changes require a deprecation cycle.

## Ownership

Core team owns `shared/` via CODEOWNERS. Changes require core team review.

## Rules

- **Modules cannot import from other modules** — only from `@shared`
- Shared exports are the public API; internal helpers should not be imported directly
- Breaking changes must be announced and old exports kept (with deprecation warnings) for at least one release cycle

## Client Exports (`@shared/client`)

### Composables

| Export | Description |
|--------|-------------|
| `useRoster()` | Reactive roster data (orgs, teams, members) with fetch/refresh |
| `useAuth()` | Current user info, admin status, team-admin status, roles. Exports `isAdmin`, `isTeamAdmin`, `roles`, `refresh()`. |
| `useGithubStats()` | GitHub contribution data with fetch/refresh |
| `useGitlabStats()` | GitLab contribution data with fetch/refresh. Exports `getProfileUrls(gitlabUsername)` returning `[{ baseUrl, label, url }]` for per-instance profile links. |
| `usePermissions()` | Reactive permission state: tier, managed UIDs, `isAdmin`, `isTeamAdmin`, `canEdit(uid)`, `canEditTeam(teamId)` |
| `useTeams()` | Team CRUD, member assignment, bulk assign, unassigned people |
| `useFieldDefinitions()` | Field definition CRUD, person field value updates |
| `useAllowlist()` | Allowlist management (admin only) |
| `useImpersonation()` | Admin impersonation state: start/stop, reactive uid/name, isImpersonating |
| `useModuleLink()` | Cross-module hash navigation (`linkTo`, `navigateTo`) |

### Services

| Export | Description |
|--------|-------------|
| `apiRequest(url, options)` | Fetch wrapper with error handling |
| `cachedRequest(key, fetcher, onData)` | Stale-while-revalidate caching via localStorage |
| `clearApiCache()` | Clear all cached API data |
| `getSiteConfig()` | Fetch site configuration (`{ titlePrefix }`) — no cache |
| `saveSiteConfig(config)` | Save site configuration (admin only) |

### Components

| Component | Path | Description |
|-----------|------|-------------|
| `Toast.vue` | `@shared/client/components/Toast.vue` | Toast notification |
| `LoadingOverlay.vue` | `@shared/client/components/LoadingOverlay.vue` | Full-screen loading spinner |
| `RefreshModal.vue` | `@shared/client/components/RefreshModal.vue` | Progress modal for data refresh operations |
| `PermissionBadge.vue` | `@shared/client/components/PermissionBadge.vue` | Small badge showing user's permission tier |
| `PersonReferenceField.vue` | `@shared/client/components/PersonReferenceField.vue` | Renders person references (linked -> clickable, unlinked -> plain text) |

## Server Exports (`@shared/server`)

| Export | Description |
|--------|-------------|
| `storage` | `{ readFromStorage, writeToStorage, listStorageFiles, deleteStorageDirectory }` — filesystem-backed JSON storage |
| `demoStorage` | `{ readFromStorage, writeToStorage, listStorageFiles, deleteStorageDirectory }` — fixture-backed read-only storage for demo mode |
| `createAuthMiddleware(readFromStorage, writeToStorage, options)` | Factory returning `{ authMiddleware, requireAdmin, requireTeamAdmin, isAdmin, seedRoles }`. Options: `{ tokenValidator, roleStore }` |
| `createRoleStore(readFromStorage, writeToStorage)` | Factory returning role CRUD: `{ getRoles, hasRole, assignRole, revokeRole, listAssignments, getAdminEmails, migrateFromAllowlist }` |
| `blockDuringImpersonation` | Express middleware that returns 403 during impersonation. Exported from auth.js. |
| `googleSheets` | `{ getAuth, discoverSheetNames, fetchRawSheet }` — Google Sheets auth and raw data fetching |
| `roster` | `{ readRosterFull, getAllPeople, getPeopleByOrg, getOrgKeys, getTeamRollup, getOrgDisplayNames }` — shared roster data access |
| `rosterSync` | `{ runSync, isSyncInProgress }` — barrel re-export of the consolidated sync pipeline (LDAP + Google Sheets + lifecycle tracking). `runSync` is an alias for `runConsolidatedSync` from `roster-sync/consolidated-sync`. Sub-modules: `roster-sync/consolidated-sync` (runConsolidatedSync, isSyncInProgress), `roster-sync/config` (loadConfig, saveConfig, isConfigured, getOrgDisplayNames, updateSyncStatus), `roster-sync/constants`, `roster-sync/ldap`, `roster-sync/sheets`, `roster-sync/merge`, `roster-sync/username-inference`, `roster-sync/lifecycle` (mergePerson) |
| `jira` | `{ JIRA_HOST, getJiraAuth, jiraRequest, fetchAllJqlResults }` — Jira Cloud API helpers: auth (Basic via `JIRA_TOKEN`/`JIRA_EMAIL` env vars), request wrapper with 429 retry, cursor-based JQL pagination via `/rest/api/3/search/jql` |
| `permissions` | `{ LDAP_FIELDS, buildManagerMap, getManagedUids, getDirectReports, isManager, getPermissionTier, canEditPerson }` — RBAC logic: manager subtree computation, direct reports, permission tier detection, authorization checks |

## Versioning

This project does not use semver for shared code. Instead:

1. **Additive changes** (new exports, new optional parameters) can be made freely
2. **Breaking changes** (renamed exports, removed functions, changed signatures) require updating all consuming modules in the same PR
3. Since all modules live in this repo, breaking changes are always caught by `npm test`
