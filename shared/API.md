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
| `useAuth()` | Current user info, admin status |
| `useGithubStats()` | GitHub contribution data with fetch/refresh |
| `useGitlabStats()` | GitLab contribution data with fetch/refresh |
| `useAllowlist()` | Allowlist management (admin only) |
| `useModuleLink()` | Cross-module hash navigation (`linkTo`, `navigateTo`) |

### Services

| Export | Description |
|--------|-------------|
| `apiRequest(url, options)` | Fetch wrapper with error handling |
| `cachedRequest(key, fetcher, onData)` | Stale-while-revalidate caching via localStorage |
| `clearApiCache()` | Clear all cached API data |

### Components

| Component | Path | Description |
|-----------|------|-------------|
| `Toast.vue` | `@shared/client/components/Toast.vue` | Toast notification |
| `LoadingOverlay.vue` | `@shared/client/components/LoadingOverlay.vue` | Full-screen loading spinner |
| `RefreshModal.vue` | `@shared/client/components/RefreshModal.vue` | Progress modal for data refresh operations |

## Server Exports (`@shared/server`)

| Export | Description |
|--------|-------------|
| `storage` | `{ readFromStorage, writeToStorage, listStorageFiles, deleteStorageDirectory }` — filesystem-backed JSON storage |
| `demoStorage` | `{ readFromStorage, writeToStorage, listStorageFiles, deleteStorageDirectory }` — fixture-backed read-only storage for demo mode |
| `createAuthMiddleware(readFromStorage, writeToStorage)` | Factory returning `{ authMiddleware, requireAdmin, isAdmin, seedAdminList }` |
| `googleSheets` | `{ getAuth, discoverSheetNames, fetchRawSheet }` — Google Sheets auth and raw data fetching |
| `roster` | `{ EXCLUDED_TITLES, readRosterFull, getAllPeople, getPeopleByOrg, getOrgKeys, getTeamRollup, getOrgDisplayNames }` — shared roster data access (getAllPeople and getPeopleByOrg filter out EXCLUDED_TITLES) |
| `rosterSync` | `{ runSync, scheduleSync, ... }` — roster sync engine (LDAP + Google Sheets). Sub-modules: `roster-sync/config` (loadConfig, saveConfig, isConfigured, getOrgDisplayNames, updateSyncStatus), `roster-sync/constants`, `roster-sync/ldap`, `roster-sync/sheets`, `roster-sync/merge`, `roster-sync/username-inference` |

## Versioning

This project does not use semver for shared code. Instead:

1. **Additive changes** (new exports, new optional parameters) can be made freely
2. **Breaking changes** (renamed exports, removed functions, changed signatures) require updating all consuming modules in the same PR
3. Since all modules live in this repo, breaking changes are always caught by `npm test`
