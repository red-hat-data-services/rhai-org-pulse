# Non-Engineering People Profiles

## Problem Statement

Product managers (and eventually other non-engineering roles like designers and
docs writers) are referenced by name in team metadata fields
(`person-reference-linked`) but have no registry entries, no profile pages, and
do not appear in the People directory. Their names render as plain text on team
detail pages. Users expect to click through to a profile showing reporting
chain, role, associated teams, and custom fields -- the same expectations they
have for engineering people.

## Goals

1. Non-engineering people appear in the People directory alongside engineering
   people, with a filter to distinguish role types.
2. Clicking a PM name on a team detail page opens a proper profile page.
3. Profile pages for non-engineering people show: identity info (name, title,
   email, location), reporting chain from LDAP, direct reports, associated teams
   (teams that reference this person via metadata fields), and custom field
   values. Engineering-specific metrics (Jira, GitHub, GitLab) are hidden and
   their API calls are suppressed.
4. When setting a person-reference field on a team, users can search LDAP
   directly to find people not yet in the registry.
5. The system supports future expansion to other non-engineering roles without
   architectural changes.

## Non-Goals

- Fetching Jira/GitHub/GitLab metrics for non-engineering people.
- Adding non-engineering people as regular team members (they remain associated
  via metadata fields like "Product Manager").
- Showing non-engineering org roots in the sidebar navigation the same way
  engineering org roots appear.

---

## Design Overview

### Core Concept: "Auxiliary" Registry Entries

Non-engineering people are stored in the same `team-data/registry.json` as
engineering people, but with an `orgType` marker that distinguishes them:

```
orgType: "engineering"   (default, existing people -- backward compatible)
orgType: "auxiliary"     (PMs, designers, etc. -- new)
```

Auxiliary entries use a sentinel `orgRoot` value of `"_auxiliary"` to keep them
out of the engineering org tree while still satisfying the `orgRoot` field
requirement used throughout the codebase (e.g., `readRosterFull()` groups
people by `orgRoot`). The `readRosterFull()` function will filter out the
`"_auxiliary"` org bucket so auxiliary people do not appear in the legacy roster
shape, preserving backward compatibility for existing consumers.

Auxiliary entries are created on-demand when:
- A person-reference field value is resolved against LDAP during sync.
- A user searches LDAP via a new search endpoint and selects someone to add.
- A person-reference field is edited and the autocomplete triggers an LDAP
  lookup for an unrecognized name.

Auxiliary entries are full registry citizens (same schema) but are flagged so
the UI can:
- Hide engineering metric sections on their profile.
- Show/hide them in the People directory via a filter.
- Avoid including them in engineering headcount stats.

### Data Flow

```
                      Consolidated Sync
                      (existing orgRoots)
                            |
                            v
                    +-----------------+
                    |   registry.json |
                    |  people: {      |
                    |    eng1: {..., orgType:"engineering", orgRoot:"shgriffi"},
                    |    pm1:  {..., orgType:"auxiliary",   orgRoot:"_auxiliary"},
                    |  }              |
                    +-----------------+
                            ^
                            |
              +-------------+-------------+
              |                           |
     LDAP On-Demand Lookup        LDAP Search Endpoint
     (Phase 5b of sync)          (for autocomplete)
```

---

## Implementation Plan

### Phase 1: Backend -- LDAP Lookup & Auxiliary Registry Entries

#### 1a. Add LDAP search function

**File:** `shared/server/roster-sync/ipa-client.js`

Add a new `searchPeople(client, baseDn, query, limit)` function that performs a
broad LDAP search across multiple fields:

```
filter: (|(cn=*<escaped-query>*)(uid=*<escaped-query>*)(mail=*<escaped-query>*))
```

This matches by common name, UID, or email address -- users may type any of
these when searching. (**Med3 addressed**)

Pass `sizeLimit: limit` (default 10) in the LDAP search options object to
enforce server-side result limiting. This prevents a broad query like
`(cn=*john*)` from returning thousands of results from corporate LDAP -- the
LDAP server itself will stop after `sizeLimit` entries. (**M3 addressed**)

Returns an array of `entryToPerson()` results. Reuses the existing
`searchEntries`, `entryToPerson`, and `escapeLdapFilter` functions.

**Changes to `searchEntries`:** Add an optional 4th parameter `options` object
that can include `sizeLimit`. When provided, pass it through to the ldapjs
`client.search()` options:

```js
function searchEntries(client, baseDn, filter, attrs, options) {
  var opts = {
    filter: filter,
    scope: 'sub',
    attributes: attrs || LDAP_ATTRS
  };
  if (options && options.sizeLimit) opts.sizeLimit = options.sizeLimit;
  // ...existing implementation
}
```

#### 1b. Auxiliary person resolution in consolidated sync (Phase 5b)

**File:** `shared/server/roster-sync/consolidated-sync.js`

After Phase 5 (enrichment fields applied) and **before Phase 6 (write
registry)**, add a new **Phase 5b: Resolve auxiliary person references**.

This phase requires LDAP connectivity. Since the existing LDAP connection is
unbound in the `finally` block at line 94, Phase 5b opens a **new, separate
LDAP connection** for its lookups. This keeps the existing connection lifecycle
untouched and avoids risk of breaking the main traversal. (**M1 addressed**)

**Resolution order** (combines former 1b and 1d into a single coherent pass --
**M5 addressed**):

1. Read field definitions from `team-data/field-definitions.json`.
2. Read team metadata from `team-data/teams.json`.
3. Collect all values from `person-reference-linked` team fields.
4. **For each value**, determine if it's a UID or a name:
   - If the value matches a UID already in `merged` (the registry being built):
     skip, already resolved.
   - If the value looks like a UID (no spaces, matches `[a-z0-9_.-]+`) but
     isn't in the registry: look it up in LDAP by UID. If found, create an
     auxiliary entry. If not found, add to `unresolvedPersonRefs`.
   - If the value contains spaces (likely a name): search the registry by name.
     If exactly one match, replace the value with the UID in team metadata.
     If no match, search LDAP by cn. If exactly one result, create an auxiliary
     entry and replace the value with the UID. If ambiguous or not found, add to
     `unresolvedPersonRefs`.
5. For each newly created auxiliary entry, walk the manager chain (up to 20
   levels), creating auxiliary entries for each manager not already in the
   registry.
6. **Write back** the updated `teams.json` with resolved name-to-UID
   replacements. This write happens once at the end of Phase 5b (not
   incrementally) to avoid conflicts. Concurrent user edits during sync are
   safe because the sync only modifies person-reference values that were
   unresolved strings -- it never overwrites a value that is already a valid
   UID.

**Manager chain batching** (**Min3 addressed**): To avoid N x 20 sequential
LDAP lookups, maintain a `lookupCache` map (uid -> person) during Phase 5b.
Each `lookupPerson` result is cached. When walking manager chains, check the
cache before issuing an LDAP call. This ensures each unique manager UID is
looked up at most once.

**Sync log additions:**
```json
{
  "summary": {
    "...existing fields...",
    "auxiliaryResolved": 5,
    "auxiliaryManagersAdded": 12,
    "unresolvedPersonRefs": ["Jane Doe", "Unknown PM"]
  }
}
```

#### 1c. Add `orgType` field to registry entries and protect auxiliary lifecycle

**File:** `shared/server/roster-sync/lifecycle.js`

**`mergePerson()` changes:**
- Add `orgType` to the fixed-field construction for new persons (defaults to
  `"engineering"`). The caller can override after `mergePerson` returns.
- Preserve existing `orgType` on merge -- never overwrite it. This is achieved
  by NOT including `orgType` in `TRACKED_FIELDS` (it should not appear in
  changelogs as a tracked field change). Instead, after merge, the consolidated
  sync sets `orgType` explicitly based on context. (**M6 addressed**)
- Add `orgType` to the new-person object construction alongside the existing
  fixed fields (`uid`, `name`, `email`, etc.).

**`processLifecycle()` changes** (**C1 -- CRITICAL -- addressed**):

The current `processLifecycle()` marks any existing registry entry NOT in
`freshPeopleMap` as inactive, and eventually purges it. Since `freshPeopleMap`
is built exclusively from LDAP org-root traversal, auxiliary people will never
appear in it and would be incorrectly marked inactive on every sync.

**Fix:** Add a guard at the top of the loop body:

```js
// Skip auxiliary entries -- they are not part of org-root traversal
// and have their own lifecycle (refreshed during Phase 5b)
if (ep.orgType === 'auxiliary') {
  merged[euid] = ep;
  continue;
}
```

Auxiliary entries are instead refreshed during Phase 5b: if an auxiliary person
is still referenced by a person-reference field, their LDAP data is re-fetched
and merged. If they are no longer referenced by any team field, they remain in
the registry unchanged (they may still be viewed directly by URL). A future
enhancement could add a separate lifecycle pass for unreferenced auxiliary
entries.

**`computeCoverage()` changes:** Filter out auxiliary people from coverage
stats (they don't have GitHub/GitLab usernames by design).

**File:** `shared/server/roster-sync/consolidated-sync.js`

After the Phase 4 lifecycle merge loop, set `orgType: "engineering"` on all
entries in `merged` that came from `freshPeopleMap` (org-root traversal). This
is a simple post-merge pass:

```js
for (var k = 0; k < freshUids.length; k++) {
  if (merged[freshUids[k]]) {
    merged[freshUids[k]].orgType = 'engineering';
  }
}
```

Entries created in Phase 5b get `orgType: "auxiliary"` explicitly.

**Backward compatibility:** Existing registry entries without `orgType` are
treated as `"engineering"` everywhere via defensive `|| 'engineering'` checks.

#### 1d. `orgRoot` strategy for auxiliary entries (**C2 -- CRITICAL -- addressed**)

Auxiliary entries use `orgRoot: "_auxiliary"` -- a sentinel value that:

1. **Satisfies the field requirement:** `mergePerson()` takes `orgRootUid` as
   a parameter and sets it on the person object. For auxiliary entries created
   in Phase 5b and in the import route (1f), pass `"_auxiliary"` as the
   `orgRootUid`.

2. **Keeps auxiliary people out of the legacy roster:** `readRosterFull()` in
   `shared/server/roster.js` groups people by `orgRoot`. Without a filter,
   auxiliary people would create an `_auxiliary` org bucket. Add a filter to
   skip the `_auxiliary` bucket:

   ```js
   // In readRosterFull(), after building orgMap:
   delete orgMap['_auxiliary'];
   ```

   This ensures `getAllPeople()`, `getPeopleByOrg()`, and `getOrgKeys()` exclude
   auxiliary people, preserving the existing behavior for all downstream
   consumers (org-teams routes, team cards, etc.).

3. **People directory still shows auxiliary people** because it reads from the
   `/registry/people` endpoint (which reads `registry.json` directly), not from
   `readRosterFull()`.

4. **Org filter in PeopleDirectoryView:** The `_auxiliary` orgRoot will appear
   in the org filter dropdown. Rename it to a display-friendly label
   ("Non-Engineering") via `orgDisplayNames` in the stats response.

#### 1e. LDAP search API route

**File:** `modules/team-tracker/server/routes/ipa-registry.js`

Add a new route:

```
GET /registry/people/search/ldap?q=<query>&limit=10
```

- Requires authentication (not admin-only -- any user editing a person-reference
  field needs this).
- **LDAP unavailable handling** (**Med1 addressed**): If LDAP is not configured
  (`IPA_BIND_DN` / `IPA_BIND_PASSWORD` not set), return `503` with
  `{ error: "LDAP not configured", code: "LDAP_UNAVAILABLE" }`. The frontend
  uses the `code` field to distinguish "no results" (empty `200`) from "service
  unavailable" (`503`) and hides the "From directory" divider accordingly.
- **Demo mode:** Return `503` with `{ error: "LDAP not available in demo mode",
  code: "LDAP_UNAVAILABLE" }`. The demo fixtures provide pre-populated auxiliary
  people so the autocomplete local search works without LDAP. (**Min2
  addressed** -- demo handling is in the route handler, not in demo-storage.)
- Connects to LDAP with a **5-second connection timeout** to prevent
  autocomplete from hanging (**Med2 addressed**). Uses a fresh connection per
  request (connection pooling deferred to future optimization -- interactive
  LDAP requests are infrequent).
- Runs `searchPeople()` with server-side `sizeLimit`.
- For each result, indicates whether the person already exists in the registry
  (`inRegistry: true/false`).
- **Rate limiting** (**Med4 addressed**):
  - Identify user by `X-Forwarded-Email` header (same as auth middleware).
  - Max 5 requests per 10 seconds per user.
  - Return `429 Too Many Requests` with `{ error: "Rate limit exceeded" }` and
    `Retry-After: 10` header when limit is hit.
  - In-memory Map with TTL cleanup: entries older than 10 seconds are pruned on
    each request (no unbounded growth). Map is scoped to the route registration
    closure.

#### 1f. On-demand auxiliary entry creation route

**File:** `modules/team-tracker/server/routes/ipa-registry.js`

Add a new route:

```
POST /registry/people/ldap-import
Body: { uid: "someuid" }
```

- **Requires team-admin or admin role** (**M4 addressed**). Regular users can
  search LDAP (read-only), but only team-admins/admins can create registry
  entries. This prevents unbounded registry growth from non-privileged users.
- **Audit log entry** (**M4 addressed**): Each import writes an audit log entry
  via `appendAuditEntry()`:
  ```js
  { action: 'person.ldap-import', actor: email,
    entityType: 'person', entityId: uid,
    detail: 'Imported auxiliary person from LDAP' }
  ```
- Looks up the UID in LDAP via `lookupPerson()` with a 5-second timeout.
- If found and not already in the registry, creates an auxiliary registry entry
  with `orgType: "auxiliary"` and `orgRoot: "_auxiliary"`.
- Also creates auxiliary entries for the manager chain (same cached-lookup logic
  as Phase 5b in 1b).
- If already in the registry, returns the existing entry (idempotent).
- Returns the created/existing person object.

### Phase 2: Backend -- Registry API Updates

#### 2a. Update registry list endpoint

**File:** `modules/team-tracker/server/routes/ipa-registry.js`

Update `GET /registry/people`:
- Accept new query param `orgType` (values: `engineering`, `auxiliary`, or
  omitted for all).
- Include `orgType` in each person's response object (defaulting to
  `"engineering"` if absent).
- For auxiliary people, include `associatedTeamNames` -- an array of team names
  that reference this person via person-reference-linked fields. **Computed at
  request time** by scanning `teams.json` metadata. (**Min4 acknowledged** --
  see note below.)

No breaking change -- the response shape is additive (new field `orgType`).

> **Min4 note:** Computing `associatedTeams` at request time requires reading
> `teams.json` and `field-definitions.json` on each request. For the list
> endpoint, we only need team names (not full details), so the scan is
> lightweight. If performance becomes an issue, we can precompute an
> `auxiliaryAssociations` index during sync and cache it. Deferred to a
> follow-up optimization.

#### 2b. Update registry stats endpoint

**File:** `modules/team-tracker/server/routes/ipa-registry.js`

Update `GET /registry/stats`:
- Add `auxiliaryCount` to the response.
- **Existing `active` count excludes auxiliary people** to preserve the
  semantics of "engineering headcount" that downstream consumers expect.
  (**Med5 addressed**)
- Add `byOrgType: { engineering: N, auxiliary: N }` breakdown so the UI can
  show both.
- The `coverage` computation (from `computeCoverage()`) already excludes
  auxiliary people per the Phase 1c changes.

#### 2c. Update person detail endpoint

**File:** `modules/team-tracker/server/routes/ipa-registry.js`

Update `GET /registry/people/:uid`:
- Add `associatedTeams` to the response: an array of teams that reference this
  person via any `person-reference-linked` metadata field.
- Each entry: `{ teamId, teamName, orgKey, fieldId, fieldLabel }`.
- This requires reading `team-data/teams.json` and
  `team-data/field-definitions.json` at request time.
- Include `orgType` on the person object (defaulting to `"engineering"` if
  absent).

### Phase 3: Frontend -- Profile Page Updates

#### 3a. Update PersonProfileView

**File:** `modules/team-tracker/client/views/PersonProfileView.vue`

Conditionally render sections based on `orgType`:

- **Always show:** Profile card (name, title, email, location, geo), custom
  fields, identities, manager chain, direct reports, metadata timestamps.
- **Show only for `orgType !== 'auxiliary'`:** Jira metrics, GitHub
  contributions, GitLab contributions, resolved/in-progress issue tables.
- **Suppress API calls for auxiliary people** (**Min1 addressed**): Wrap the
  Jira metrics fetch in `loadPerson()` with a guard:
  ```js
  if (person.value?.name && person.value?.orgType !== 'auxiliary') {
    // fetch Jira metrics
  }
  ```
  Similarly, skip loading GitHub/GitLab stats composables for auxiliary people.
- **New section for auxiliary people:** "Associated Teams" card in the sidebar,
  listing teams that reference this person via metadata fields. Each entry is
  clickable to navigate to the team detail page. Shows the field label
  (e.g., "Product Manager") as a subtitle. Data comes from the
  `associatedTeams` array already returned by the `/registry/people/:uid`
  endpoint.

#### 3b. Update PersonAutocomplete for LDAP search

**File:** `modules/team-tracker/client/components/PersonAutocomplete.vue`

Enhance the autocomplete to support searching LDAP when the local people list
doesn't have enough matches:

1. After filtering the local `props.people` list, if fewer than 3 results are
   found and the search term is at least 3 characters, fire a debounced (300ms)
   request to `GET /registry/people/search/ldap?q=<term>`.
2. **Handle 503 (LDAP unavailable):** Do not show the "From directory" divider.
   The autocomplete gracefully degrades to local-only search. Handle 429 (rate
   limited) similarly -- silently suppress the LDAP section.
3. Append LDAP results to the dropdown, visually separated with a
   "From directory" divider. Show a subtle spinner while the LDAP search is in
   flight.
4. When an LDAP result that isn't in the registry is selected, call
   `POST /registry/people/ldap-import` to create the auxiliary entry, then emit
   the UID as the selected value. If the import fails (e.g., user lacks
   team-admin permissions), show an inline error message.
5. **Accessibility:** Maintain existing ARIA attributes (`role="combobox"`,
   `aria-expanded`, `aria-activedescendant`, `role="listbox"`, `role="option"`,
   `aria-selected`). The "From directory" divider uses `role="separator"` and
   is not focusable. Keyboard navigation (ArrowDown/Up/Enter/Escape) works
   across both local and LDAP sections seamlessly.

This is backward compatible -- existing usage with a local people list continues
to work. LDAP search is an additive enhancement.

#### 3c. Fix team detail person-reference navigation (**M2 -- MAJOR -- addressed**)

**File:** `modules/team-tracker/client/components/TeamFieldEditor.vue`

The current code emits `navigate-person` with `entry.name` (line 273):
```js
@click="emit('navigate-person', entry.name)"
```

But the handler in `TeamRosterView.vue` looks up via `memberUidByName` which
only contains team members. Auxiliary people aren't team members, so navigation
silently fails.

**Fix:** Change the emit to pass the UID directly (already available in
`resolvePersonEntries`):
```js
@click="emit('navigate-person', entry.uid)"
```

Update `TeamRosterView.vue`'s `navigateToPerson` handler to accept either a UID
or a name. Since UIDs never contain spaces and names always do, use a simple
heuristic:
```js
function navigateToPerson(identifier) {
  // If it looks like a UID (no spaces), navigate directly
  if (!identifier.includes(' ')) {
    nav.navigateTo('person-detail', { uid: identifier })
    return
  }
  // Legacy fallback: look up by name
  const uid = memberUidByName.value.get(identifier)
  if (uid) {
    nav.navigateTo('person-detail', { uid })
  }
}
```

This is simpler, avoids name-collision edge cases, and works for both
engineering and auxiliary people.

Also update the `PersonFieldEditor.vue` emit (same pattern -- pass UID instead
of name).

### Phase 4: Frontend -- People Directory Updates

#### 4a. Add orgType filter to PeopleDirectoryView

**File:** `modules/team-tracker/client/views/PeopleDirectoryView.vue`

- Add a new filter control for `orgType` alongside the existing Org and Geo
  filters. Display options: "All", "Engineering", "Non-Engineering".
- Default to "All" so existing behavior is preserved.
- Add a visual indicator (subtle badge or icon) next to non-engineering people
  in the table to distinguish them.
- Update the stats header: show auxiliary count separately, using the
  `byOrgType` breakdown from the stats endpoint. The main headcount shown
  should reflect the current filter selection.

#### 4b. Update People directory table columns

For auxiliary people, the "Team(s)" column shows `associatedTeamNames` instead
of `_teamGrouping`. The `/registry/people` list response includes
`associatedTeamNames` for auxiliary people (Phase 2a). The table cell checks
`orgType` and renders accordingly.

### Phase 5: Fixture & Demo Mode Updates

#### 5a. Update demo fixtures

**File:** `fixtures/team-data/registry.json`

Add 2-3 auxiliary people entries with:
- `orgType: "auxiliary"`
- `orgRoot: "_auxiliary"`
- Realistic PM titles (e.g., "Senior Product Manager")
- Manager chains pointing to a fictional PM org leader (also an auxiliary entry)
- No `_teamGrouping`, `github`, or `gitlab` fields

**File:** `fixtures/team-data/teams.json` (team metadata)

Update person-reference-linked field values to use UIDs of the new auxiliary
fixture people instead of plain name strings like `"Pat Manager"`. (**Min5
addressed**)

**File:** `fixtures/team-data/field-definitions.json` (if not already present)

Ensure at least one `person-reference-linked` team field definition exists
(e.g., "Product Manager") so the fixture data is self-consistent.

#### 5b. Demo mode LDAP search handling

**No changes to `shared/server/demo-storage.js`** (**Min2 addressed**). The
LDAP search route handler itself checks `DEMO_MODE` and returns `503` with
`code: "LDAP_UNAVAILABLE"`. Demo mode relies on pre-populated fixture data for
auxiliary people -- the autocomplete works with the local people list, and LDAP
search is simply not available.

---

## Affected APIs and Data Contracts

### Modified Endpoints (Backward Compatible)

| Endpoint | Change |
|----------|--------|
| `GET /registry/people` | New optional `orgType` query param; response objects gain `orgType` field and `associatedTeamNames` for auxiliary people |
| `GET /registry/people/:uid` | Response gains `orgType` on person object and `associatedTeams` array |
| `GET /registry/stats` | Response gains `auxiliaryCount`, `byOrgType`; `active` count now excludes auxiliary people |

> **Note on stats `active` count:** This is a minor behavioral change -- the
> `active` count will decrease by the number of auxiliary people. This is
> intentional: the count represents engineering headcount. The `byOrgType`
> breakdown provides the complete picture. If any consumer relies on `active`
> including all people, they can sum `byOrgType.engineering + byOrgType.auxiliary`.

### New Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /registry/people/search/ldap?q=&limit=` | Authenticated | Search LDAP for people by name/uid/email. Returns `503` if LDAP unavailable. |
| `POST /registry/people/ldap-import` | Team-admin or Admin | Create auxiliary registry entry from LDAP lookup. Audit-logged. |

### Modified Data Structures

**Registry person object** -- new fields (additive):
```json
{
  "orgType": "engineering|auxiliary",
  "orgRoot": "shgriffi|_auxiliary",
  "...existing fields..."
}
```

Entries without `orgType` are treated as `"engineering"` (backward compatible).

**Sync log** -- new fields (additive):
```json
{
  "summary": {
    "...existing fields...",
    "auxiliaryResolved": 5,
    "auxiliaryManagersAdded": 12,
    "unresolvedPersonRefs": ["Jane Doe", "Unknown PM"]
  }
}
```

### No Breaking Changes

All changes are additive. Existing API consumers that don't use the new
`orgType` parameter or fields will see no difference in behavior. The People
directory defaults to showing all people (engineering + auxiliary). The legacy
roster shape (`readRosterFull()`) excludes auxiliary people so all downstream
consumers are unaffected.

The one behavioral note is that `GET /registry/stats` now returns an `active`
count that excludes auxiliary people. This is intentional and more correct
(represents engineering headcount), but callers that previously assumed `active`
= total active people should use `byOrgType` for the full picture.

---

## Testability and Deployability

### Local Development Testing

1. **Demo mode:** Updated fixtures provide auxiliary people out of the box.
   `npm run dev:full` with `DEMO_MODE=true` shows the full experience without
   LDAP connectivity. LDAP search gracefully shows nothing (503 handled).

2. **With LDAP (VPN required):** Set `IPA_BIND_DN` and `IPA_BIND_PASSWORD`,
   then:
   - Run a sync to populate engineering people.
   - Create a team with a `person-reference-linked` field.
   - Set the field to a PM's name -- the sync should auto-resolve.
   - Use the LDAP search autocomplete to find and import a PM.
   - Verify the PM's profile page shows reporting chain and associated teams.
   - Verify clicking the PM name on the team detail page navigates to their
     profile.

### Unit Tests

| Area | Test File | Cases |
|------|-----------|-------|
| LDAP search function | `shared/server/roster-sync/__tests__/ipa-client.test.js` | `searchPeople` returns filtered results, handles empty query, passes `sizeLimit` to search options, multi-field filter |
| Auxiliary resolution in sync | `shared/server/roster-sync/__tests__/consolidated-sync.test.js` | Person-ref UIDs resolved, name-to-UID replacement, manager chains created with caching, unresolved refs logged, teams.json updated |
| `mergePerson` with orgType | `shared/server/roster-sync/__tests__/lifecycle.test.js` | New entries include `orgType` in fixed fields, existing entries preserve `orgType` on merge |
| `processLifecycle` skips auxiliary | `shared/server/roster-sync/__tests__/lifecycle.test.js` | Auxiliary entries are not marked inactive, not purged, preserved in `merged` output |
| `computeCoverage` excludes auxiliary | `shared/server/roster-sync/__tests__/lifecycle.test.js` | Auxiliary people not counted in coverage stats |
| `readRosterFull` excludes auxiliary | `shared/server/__tests__/roster.test.js` | `_auxiliary` org bucket filtered out, `getAllPeople` excludes auxiliary |
| Registry list with orgType filter | `modules/team-tracker/__tests__/server/ipa-registry.test.js` | Filter by orgType, default returns all, `associatedTeamNames` populated |
| Person detail with associatedTeams | `modules/team-tracker/__tests__/server/ipa-registry.test.js` | Teams referencing person are returned with field labels |
| Stats exclude auxiliary from active | `modules/team-tracker/__tests__/server/ipa-registry.test.js` | `active` count excludes auxiliary, `byOrgType` includes both |
| LDAP search route | `modules/team-tracker/__tests__/server/ipa-registry.test.js` | Returns results with `inRegistry` flag, `503` when LDAP unavailable, `429` when rate limited, `503` in demo mode |
| LDAP import route | `modules/team-tracker/__tests__/server/ipa-registry.test.js` | Creates auxiliary entry, handles duplicates (idempotent), builds manager chain, requires team-admin, writes audit log, `503` when LDAP unavailable |
| TeamFieldEditor emits UID | `modules/team-tracker/__tests__/client/TeamFieldEditor.test.js` | `navigate-person` event emits UID not name |

### Integration / E2E Testing (Preprod)

1. Deploy to preprod overlay (uses `:latest` images).
2. Verify LDAP search works from the person-reference autocomplete.
3. Verify a PM imported via LDAP search gets a proper profile page.
4. Verify the People directory shows the PM with the orgType filter.
5. Verify existing engineering people are unaffected.
6. Verify a full sync does not mark auxiliary people as inactive.
7. Verify clicking a PM name on a team detail page navigates to their profile.
8. Verify a non-admin user cannot import via `POST /registry/people/ldap-import`.

### Production Deployment

1. No database migrations needed -- the registry is a JSON file. New fields are
   additive.
2. The first sync after deployment will:
   - Set `orgType: "engineering"` on all existing entries from org-root traversal.
   - Resolve any person-reference targets as auxiliary entries.
   - Leave any existing entries without `orgType` treated as `"engineering"`.
3. **Rollback:** Safe. Removing the code leaves `orgType` and
   `orgRoot: "_auxiliary"` fields in the registry JSON. Older code:
   - Ignores `orgType` (unused field).
   - Groups `_auxiliary` people under an `_auxiliary` org bucket in
     `readRosterFull()` -- harmless, they just appear as a mysterious org.
   - `processLifecycle` would mark them inactive (no `orgType` guard) -- but
     they'd be recreated on next sync with the new code. Net: rollback is safe.

### CI/CD

No new CI workflows needed. The existing `ci.yml` pipeline covers:
- Lint + test for new/modified files.
- Module validation.
- Build verification.

The `build-images.yml` pipeline will automatically build and push new images
when changes to `modules/team-tracker/server/` or `shared/server/` are merged
to `main`.

---

## Phased Delivery Plan

| Phase | Scope | Estimated Effort |
|-------|-------|-----------------|
| 1 | Backend: LDAP search, auxiliary entries, sync resolution, lifecycle protection | 3-4 days |
| 2 | Backend: Registry API updates (list, stats, detail) | 1 day |
| 3 | Frontend: Profile page updates, autocomplete LDAP search, navigation fix | 2 days |
| 4 | Frontend: People directory orgType filter | 1 day |
| 5 | Fixtures, demo mode, tests | 1-2 days |

Total: ~8-10 days

Phases 1-2 can be merged independently (backend-only, no frontend changes).
Phases 3-4 depend on 1-2. Phase 5 can be parallelized with 3-4.

---

## Review Feedback Resolution

### Critical Issues

| ID | Issue | Resolution |
|----|-------|------------|
| C1 | `processLifecycle` marks auxiliary people inactive and purges them | Phase 1c: Added `orgType === 'auxiliary'` guard to skip auxiliary entries in lifecycle processing |
| C2 | Auxiliary people have no `orgRoot` but it's required everywhere | Phase 1d: Sentinel value `"_auxiliary"` used as orgRoot; `readRosterFull()` filters it out |

### Major Issues

| ID | Issue | Resolution |
|----|-------|------------|
| M1 | LDAP connection unbound before Phase 5b needs it | Phase 1b: Opens a new, separate LDAP connection for Phase 5b |
| M2 | `navigateToPerson` silently fails for auxiliary people | Phase 3c: Emit UID instead of name from TeamFieldEditor; handler accepts both |
| M3 | `searchEntries` has no LDAP `sizeLimit` | Phase 1a: Pass `sizeLimit` in LDAP search options |
| M4 | Any authenticated user can bulk-import from LDAP | Phase 1f: Require team-admin/admin role; add audit log entry |
| M5 | Name vs UID ordering confusion in resolution | Phase 1b: Merged 1b/1d into single coherent pass with clear ordering; teams.json write-back at end of phase |
| M6 | `mergePerson` doesn't include `orgType` in fixed fields | Phase 1c: Added `orgType` to new-person construction; not in TRACKED_FIELDS (set explicitly by caller) |

### Medium Issues

| ID | Issue | Resolution |
|----|-------|------------|
| Med1 | LDAP-unavailable response contract | Phase 1e: Return `503` with `code: "LDAP_UNAVAILABLE"`; frontend checks code |
| Med2 | LDAP connection management for interactive use | Phase 1e: 5-second connection timeout; connection pooling deferred to future optimization |
| Med3 | cn-only search filter is limiting | Phase 1a: Multi-field filter `(|(cn=*q*)(uid=*q*)(mail=*q*))` |
| Med4 | Rate limiting underspecified | Phase 1e: User identified by `X-Forwarded-Email`; `429` status; Map with TTL cleanup |
| Med5 | Stats active count inflation | Phase 2b: `active` count excludes auxiliary; `byOrgType` provides full breakdown |

### Minor Issues

| ID | Issue | Resolution |
|----|-------|------------|
| Min1 | Jira API calls still fire for auxiliary people | Phase 3a: Guard Jira/GitHub/GitLab fetches with orgType check |
| Min2 | Demo mode LDAP search in wrong layer | Phase 1e/5b: Demo check in route handler, not demo-storage |
| Min3 | Manager chain walking could be slow | Phase 1b: `lookupCache` map prevents duplicate LDAP lookups |
| Min4 | `associatedTeams` computation at request time | Phase 2a: Acknowledged; scan is lightweight; caching deferred to follow-up |
| Min5 | Fixture "Pat Manager" needs updating | Phase 5a: Fixture updated to use UID with matching auxiliary registry entry |

---

## Future Considerations

- **Additional non-engineering roles:** The `orgType: "auxiliary"` flag is
  generic. If finer granularity is needed (PM vs. designer vs. writer), add an
  optional `roleCategory` field later. The architecture supports this without
  breaking changes.
- **Periodic LDAP refresh for auxiliary people:** Currently auxiliary entries
  are refreshed during sync Phase 5b only for entries that are still referenced
  by team metadata. Unreferenced auxiliary entries are preserved but not
  refreshed. A future enhancement could add a separate lifecycle pass.
- **LDAP connection pooling:** The current design opens a fresh LDAP connection
  per search/import request. If interactive LDAP usage becomes frequent,
  implement a connection pool with keep-alive and idle timeout.
- **Non-engineering org trees in navigation:** The user explicitly requested
  that non-engineering orgs NOT appear like engineering org roots in the
  sidebar. If this changes, adding an `orgCategory` to org root config would
  allow the sidebar to group them differently.
- **LDAP search without VPN:** In environments without direct LDAP access
  (e.g., local dev without VPN), the LDAP search endpoint returns `503`. The
  autocomplete gracefully degrades to local-only search. Consider caching LDAP
  search results to reduce repeated lookups.
- **Precomputed association index:** If `associatedTeams` computation at request
  time becomes a bottleneck, precompute a reverse index during sync and cache it
  in `team-data/person-associations.json`.

---

## UX Review Needed

Before implementation begins, a UX teammate should review:

1. **Profile page layout for auxiliary people** -- what sections to show/hide,
   how "Associated Teams" should render.
2. **People directory mixed list** -- how to visually distinguish engineering
   vs. non-engineering people (badge, icon, color, subtle label).
3. **Autocomplete LDAP search UX** -- how to indicate "searching directory...",
   the divider between local and LDAP results, loading/error states, the
   "From directory" divider visibility rules.
4. **Accessibility** -- ensure the enhanced autocomplete maintains proper ARIA
   attributes and keyboard navigation, including the `role="separator"` divider.
