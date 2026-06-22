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
| `useAuth()` | Current user info, admin status, team-admin status, roles. Exports `isAdmin`, `isTeamAdmin`, `roles`, `apiBaseUrl`, `refresh()`. |
| `useGithubStats()` | GitHub contribution data with fetch/refresh |
| `useGitlabStats()` | GitLab contribution data with fetch/refresh. Exports `getProfileUrls(gitlabUsername)` returning `[{ baseUrl, label, url }]` for per-instance profile links. |
| `usePermissions()` | Reactive permission state: roles, managed UIDs, `isAdmin`, `isTeamAdmin`, `isManager`, `canEdit(uid)`, `canEditTeam(teamId)` |
| `useTeams()` | Team CRUD, member assignment, bulk assign, unassigned people |
| `useFieldDefinitions()` | Field definition CRUD, person field value updates |
| `useAllowlist()` | Allowlist management (admin only) |
| `useImpersonation()` | Admin impersonation state: start/stop, reactive uid/name, isImpersonating |
| `useModuleLink()` | Cross-module hash navigation (`linkTo`, `navigateTo`) |
| `useMessages()` | App-wide message system: `messages` (reactive filtered list), `fetchMessages()`, `dismiss(id)` |
| `useJiraAuth()` | Jira OAuth 2.0 client state: `isConnected`, `siteName`, `connectJira()`, `disconnectJira()`, `checkStatus()`. Used by modules with per-user Jira authentication. |

### Utilities

| Export | Description |
|--------|-------------|
| `formatDate(iso, options?)` | Format an ISO date string for display. Options: `{ fallback: 'Never', includeTime: true }`. Returns `fallback` when `iso` is falsy; uses `toLocaleString()` when `includeTime` is true, `toLocaleDateString()` when false. |

### Services

| Export | Description |
|--------|-------------|
| `apiRequest(url, options)` | Fetch wrapper with error handling |
| `getSiteConfig()` | Fetch site configuration (`{ titlePrefix, authEmailDomain }`) — no cache |
| `saveSiteConfig(config)` | Save site configuration (admin only) |

### Components

| Component | Path | Description |
|-----------|------|-------------|
| `Toast.vue` | `@shared/client/components/Toast.vue` | Toast notification |
| `LoadingOverlay.vue` | `@shared/client/components/LoadingOverlay.vue` | Full-screen loading spinner |
| `RefreshModal.vue` | `@shared/client/components/RefreshModal.vue` | Progress modal for data refresh operations |
| `PermissionBadge.vue` | `@shared/client/components/PermissionBadge.vue` | Small badge showing user's role |
| `PersonReferenceField.vue` | `@shared/client/components/PersonReferenceField.vue` | Renders person references (linked -> clickable, unlinked -> plain text) |
| `AppMessages.vue` | `@shared/client/components/AppMessages.vue` | Stacked app-wide message banners (warning/info/error) with dismiss |
| `FeatureReadinessRow.vue` | `@shared/client/components/FeatureReadinessRow.vue` | Table row for feature readiness with priority score, rubric, and status columns |
| `FeatureReadinessDrawer.vue` | `@shared/client/components/FeatureReadinessDrawer.vue` | Slide-out detail panel for feature readiness (rubric bars, blocking dims, metadata) |
| `RubricScoreBadge.vue` | `@shared/client/components/RubricScoreBadge.vue` | Compact badge displaying AI rubric score with color coding |

## Server Exports (`@shared/server`)

| Export | Description |
|--------|-------------|
| `storage` | `{ readFromStorage, writeToStorage, writeToStorageAtomic, listStorageFiles, deleteStorageDirectory, deleteFromStorage, getFileMtime }` — filesystem-backed JSON storage. `getFileMtime(key)` returns file mtime in ms without reading (for cache invalidation). |
| `demoStorage` | `{ readFromStorage, writeToStorage, writeToStorageAtomic, listStorageFiles, deleteStorageDirectory, deleteFromStorage, getFileMtime }` — fixture-backed read-only storage for demo mode |
| `createAuthMiddleware(readFromStorage, writeToStorage, options)` | Factory returning `{ authMiddleware, requireAuth, requireAdmin, requireTeamAdmin, requireRole, requireScope, isAdmin, seedRoles }`. `requireAuth` returns 401 if no user is authenticated. `requireRole(roleName)` returns Express middleware requiring a specific role (admins always pass). `requireScope(scopeName)` returns Express middleware that enforces the given scope for token-authenticated requests (browser/proxy auth is unrestricted). Options: `{ tokenValidator, roleStore }` |
| `createRoleStore(readFromStorage, writeToStorage, options?)` | Factory returning role CRUD: `{ getRoles, hasRole, assignRole, revokeRole, listAssignments, getAdminEmails, migrateFromAllowlist, migrateEmailDomains, invalidateCache }`. Options: `{ getAuthDomain, roleRegistry }` — `getAuthDomain`: function returning the auth email domain string (or null), normalizes emails before storage/lookup. `roleRegistry`: role registry instance, when set `assignRole`/`revokeRole` validate against registered roles. |
| `normalizeEmail(email, authDomain)` | Normalize an email's domain to the given auth domain. Returns the email with its domain replaced, or the original if no authDomain. Exported for testing. |
| `blockDuringImpersonation` | Express middleware that returns 403 during impersonation. Exported from auth.js. |
| `googleSheets` | `{ getAuth, discoverSheetNames, fetchRawSheet, createGoogleSheetsClient }` — Google Sheets auth and raw data fetching. `createGoogleSheetsClient({ keyFile? })` returns `{ discoverSheetNames, fetchRawSheet }` with per-instance auth cache. |
| `roster` | `{ readRosterFull, getAllPeople, getPeopleByOrg, getOrgKeys, getTeamRollup, getOrgDisplayNames }` — shared roster data access |
| `rosterSync` | `{ runSync, isSyncInProgress }` — barrel re-export of the consolidated sync pipeline (LDAP + Google Sheets + lifecycle tracking). `runSync` is an alias for `runConsolidatedSync` from `roster-sync/consolidated-sync`. `runConsolidatedSync(storage, credentials?)` accepts an optional credentials object (`{ IPA_BIND_DN, IPA_BIND_PASSWORD, GITHUB_TOKEN, GITLAB_TOKEN, GOOGLE_SERVICE_ACCOUNT_KEY_FILE, resolveSecret }`) — when provided, creates typed clients from credentials instead of reading `process.env`. Sub-modules: `roster-sync/consolidated-sync` (runConsolidatedSync, isSyncInProgress), `roster-sync/config` (loadConfig, saveConfig, isConfigured, getOrgDisplayNames, updateSyncStatus), `roster-sync/constants`, `roster-sync/ldap`, `roster-sync/sheets`, `roster-sync/merge`, `roster-sync/username-inference`, `roster-sync/lifecycle` (mergePerson). `roster-sync/ipa-client` exports `createIpaClient({ bindDn, bindPassword, host?, baseDn?, caCertPath? })` returning `{ createConnection, bindClient, traverseOrg, lookupPerson, searchPeople, testConnection, getIpaStatus, getConfig }`. `roster-sync/username-inference` `inferUsernames(roster, config, tokens?)` accepts optional `{ githubToken, gitlabToken, resolveSecret }`. `roster-sync/username-validation` `validateAmbiguousUsernames(people, tokens?)` accepts optional `{ githubToken, gitlabToken }`. |
| `jira` | `{ JIRA_HOST, getJiraAuth, jiraRequest, fetchAllJqlResults, fetchProjectVersions, createJiraClient }` — Jira Cloud API helpers: auth (Basic via `JIRA_TOKEN`/`JIRA_EMAIL` env vars), request wrapper with 429 retry, cursor-based JQL pagination via `/rest/api/3/search/jql`, project version catalog via `/rest/api/3/project/{key}/versions`. `createJiraClient({ email, token, host? })` returns `{ jiraRequest, JIRA_HOST, fetchAllJqlResults, fetchProjectVersions }` with bound credentials. |
| `jiraOAuth` | `{ registerJiraOAuthRoutes }` — Jira OAuth 2.0 (3LO) route registration for per-user authentication. `registerJiraOAuthRoutes(router, { clientId, clientSecret, callbackUrl?, scopes? })` mounts `/auth/jira` (initiate flow) and `/auth/jira/callback` (handle callback) routes. Tokens stored in `req.session`. Adds `router.getJiraClient(req)` helper returning `{ jiraRequest, cloudId, resources }` for authenticated requests. |
| `permissions` | `{ LDAP_FIELDS, buildManagerMap, getManagedUids, getDirectReports, isManager, canEditPerson }` — RBAC logic: manager subtree computation, direct reports, authorization checks |
| `role-registry` | `{ createRoleRegistry }` — dynamic role registry. Modules register roles via `context.registerRole()`. Methods: `register(id, config)`, `isValid(id)`, `getAll()`, `get(id)`. |
| `scope-registry` | `{ createScopeRegistry }` — dynamic scope registry for API tokens. Modules register scopes via `context.registerScopes()`. Methods: `register(key, config)`, `isValid(key)`, `getAll()`, `getValidKeys()`. |
| `module-context` | `{ buildModuleContext, createTestContext }` — builds per-module frozen context with scoped registration hooks. Context includes `secrets` (frozen object), `resolveSecret(envVarName)`, and `registerSecretValidator(key, fn)`. `createTestContext(overrides)` provides a mock context for unit tests (defaults: `secrets: {}`, `resolveSecret: () => undefined`). |
| `refresh-registry` | `{ createRefreshRegistry, parseCadence }` — ordered execution of module refresh handlers with per-handler cadence. Registry with `register`, `get`, `getAll`, `runAll` (sequential by order, cadence-aware), `runModule` (ignores cadence), `getStatus` (includes cadence info), `isRunning`, `setCadenceOverride`, `getCadenceOverrides`, `parseCadence`. `parseCadence(str)` converts cadence strings (`'15m'`, `'12h'`, `'1d'`) to milliseconds. `register(id, config)` accepts optional `cadence` (default `'24h'`). `runAll({ force })` skips cadence checks when `force: true`; returns `{ counts, execution? }` where `counts = { total, due, skipped }`. `setCadenceOverride(handlerId, cadence)` sets admin override (min `'15m'`, `null` to clear), persisted in `refresh-cadence-overrides.json`. |
| `export-registry` | `{ createExportRegistry }` — module data export hooks. Registry with `register`, `getAll`, `run` (iterates with error isolation). |
| `platform-secrets` | Array of platform secret group definitions (`{ id, label, description, secrets[] }`). Groups: `jira`, `github`, `gitlab`, `ipa`, `google`. |
| `secret-registry` | `{ SecretRegistry }` — central registry for module secret declaration, resolution, validation, and diagnostics. Methods: `registerModuleSecrets(slug, declaration)`, `resolve()`, `getModuleSecrets(slug)`, `resolveSecret(envVarName)`, `registerValidator(key, fn)`, `validateAll()`, `validateKeys(keys)`, `getStatus()`, `getModuleStatus(slug)`. `validateKeys(keys)` runs only validators whose key is in the provided array. |
| `smartsheet` | `{ discoverReleases, discoverReleasesWithFreezes, discoverReleasesPartial, isConfigured, SMARTSHEET_SHEET_ID, createSmartsheetClient }` — SmartSheet API for release discovery. `createSmartsheetClient({ apiToken, sheetId? })` returns `{ discoverReleases, discoverReleasesWithFreezes, discoverReleasesPartial, isConfigured, SMARTSHEET_SHEET_ID }` with per-instance cache. |
| `backup` | `{ createBackup, listBackups, applyRetention, restoreBackup, createBackupClient }` — S3 backup utilities. `createBackupClient({ region?, bucket })` returns `{ createBackup, listBackups, applyRetention, restoreBackup }` with bound S3 client. |

## Cross-Module Data Access

Modules cannot import code from other modules, but they **may read data files** that another module explicitly exports via the `export.files` array in its `module.json`. These reads go through `readFromStorage()`, which provides path-traversal safety.

For example, the `health-metrics` module reads `team-data/registry.json` and `team-data/field-definitions.json` (exported by `team-tracker`) to resolve user types. The `shared/server/auth.js` middleware also reads `team-data/registry.json` directly, establishing prior precedent.

**Rules:**
- Only read files listed in the exporting module's `export.files` manifest
- Use `readFromStorage()` — never construct raw filesystem paths
- Treat exported data as read-only; do not write to another module's data files
- If the exporting module changes its data format, coordinate via a shared PR

### Cross-Module Writes via Internal API

When one module needs to **write** data owned by another module, it uses a localhost HTTP call to the owning module's API endpoint. This ensures the owning module's write coordination (mutexes, index rebuilding) is respected.

Example: AI Impact pushes review scores to the releases execution store via `POST /api/modules/releases/execution/ai-review/bulk`. The dependency is declared explicitly in `module.json` (`"requires": ["releases"]`). Internal API calls use `eslint-disable-next-line org-pulse/no-cross-module-imports` with a justification comment.

## Versioning

This project does not use semver for shared code. Instead:

1. **Additive changes** (new exports, new optional parameters) can be made freely
2. **Breaking changes** (renamed exports, removed functions, changed signatures) require updating all consuming modules in the same PR
3. Since all modules live in this repo, breaking changes are always caught by `npm test`
