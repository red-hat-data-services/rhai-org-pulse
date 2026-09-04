# Data File Formats

This document describes the JSON structure of all files stored in the `data/` directory (production) and `fixtures/` directory (demo mode). **Demo fixtures must always match production format** — see [Fixture Rules](#fixture-rules) below.

## Person Metrics — `data/people/{name}.json`

Filename is the person's display name lowercased with non-alphanumeric chars replaced by `_`.

```json
{
  "jiraDisplayName": "Alice Smith",
  "jiraAccountId": "5e41b8c03df51b0c937390ec",
  "fetchedAt": "2026-03-27T06:02:05.213Z",
  "lookbackDays": 365,
  "resolved": {
    "count": 54,
    "storyPoints": 139,
    "issues": [
      {
        "key": "PROJ-1234",
        "summary": "Fix login bug",
        "status": "Resolved",
        "resolution": "Done",
        "storyPoints": 3,
        "resolutionDate": "2026-03-26T18:40:28.603+0000",
        "cycleTimeDays": 4.5
      }
    ]
  },
  "inProgress": {
    "count": 1,
    "storyPoints": 1,
    "issues": [
      {
        "key": "PROJ-5678",
        "summary": "Add feature",
        "status": "In Progress",
        "storyPoints": 1,
        "resolutionDate": null
      }
    ]
  },
  "cycleTime": {
    "avgDays": 8.6,
    "medianDays": 2.4
  }
}
```

**Notes:**
- `resolution` is the Jira resolution name (e.g., `"Done"`, `"Fixed"`) or `null` for unresolved issues. Issues with no-work resolutions (`"Won't Do"`, `"Obsolete"`, `"Duplicate"`, `"Cannot Reproduce"`) are excluded from resolved metrics at fetch time.
- `resolutionDate` uses ISO 8601 with timezone offset (e.g., `"2026-02-26T08:23:28.000+0000"`), NOT simple `YYYY-MM-DD`
- `lookbackDays` is currently 365 for most users but may vary
- `cycleTimeDays` on individual issues can be fractional

## GitHub Contributions — `data/github-contributions.json`

```json
{
  "users": {
    "username": {
      "totalContributions": 215,
      "months": {
        "2025-03": 11,
        "2025-04": 6,
        "2026-01": 27
      },
      "fetchedAt": "2026-03-27T06:03:48.669Z",
      "username": "username"
    }
  }
}
```

## GitHub History — `data/github-history.json`

```json
{
  "users": {
    "username": {
      "months": {
        "2025-03": 11,
        "2025-04": 6,
        "2026-01": 27
      },
      "fetchedAt": "2026-03-27T06:03:48.669Z"
    }
  }
}
```

**Important:** Monthly data is nested under a `months` key, NOT flat on the user object.

## GitLab Contributions — `data/gitlab-contributions.json`

```json
{
  "users": {
    "username": {
      "totalContributions": 42,
      "months": {
        "2025-12": 10,
        "2026-01": 15
      },
      "fetchedAt": "2026-03-27T06:01:19.791Z",
      "source": "graphql",
      "username": "username",
      "instances": [
        { "baseUrl": "https://gitlab.com", "label": "GitLab.com", "contributions": 20 },
        { "baseUrl": "https://gitlab.internal.example.com", "label": "Internal", "contributions": 22 }
      ]
    }
  }
}
```

## GitLab History — `data/gitlab-history.json`

```json
{
  "users": {
    "username": {
      "months": {
        "2025-12": 10,
        "2026-01": 15
      },
      "fetchedAt": "2026-03-27T06:01:19.791Z"
    }
  }
}
```

**Important:** Same nested `months` structure as GitHub history.

**Note on `source` field:** In `gitlab-contributions.json`, the `source` field indicates the API used to fetch the data. Currently the only value is `"graphql"` (GitLab GraphQL API).

**Note on `instances` field:** When multi-instance GitLab is configured, each user's entry includes an `instances` array showing per-instance contribution breakdowns. Users with no contributions on a given instance will not have that instance listed. Legacy data without `instances` is treated as a single default gitlab.com instance by the frontend.

## Site Config — `data/site-config.json`

Platform-level configuration for the site. Created when an admin saves settings in Settings > General.

```json
{
  "titlePrefix": "AI Engineering",
  "authEmailDomain": "cluster.local"
}
```

**Notes:**
- `titlePrefix` is a string (max 100 characters). When non-empty, it's shown as a subtitle in the sidebar and prepended to the page title.
- `authEmailDomain` is a string (max 253 characters, valid RFC 1123 domain). When set, role assignments normalize emails to this domain so that LDAP-provided emails (e.g. `user@redhat.com`) match OAuth proxy emails (e.g. `user@cluster.local`). Can also be set via the `AUTH_EMAIL_DOMAIN` env var, which takes precedence.
- If this file doesn't exist, both fields default to `""` (empty string).

## Messages — `data/messages.json`

Admin-created announcements stored as a JSON array. Merged with computed provider messages at `GET /api/messages`.

```json
[
  {
    "id": "admin:1717200000000",
    "type": "info",
    "text": "Scheduled maintenance on Saturday 10 AM - 12 PM UTC.",
    "link": {
      "label": "Details",
      "href": "https://status.example.com"
    }
  }
]
```

**Notes:**
- `id` is auto-generated as `admin:<timestamp>` on creation.
- `type` is one of: `"warning"`, `"info"`, `"error"`. Determines banner color in the UI.
- `text` is a plain-text string (no HTML or markdown).
- `link` is either `null` or an object with non-empty `label` and `href` strings. `href` must be an `http(s)://` or `#` URL (no `javascript:` or `data:` URIs).
- Created on first `POST /api/admin/messages`. Lives in the PVC-mounted `data/` directory.
- No update API — to change a message, delete and re-create it.

## Roster Sync Config — `data/team-data/config.json`

Stores the consolidated configuration for automated roster building (merged from the former `roster-sync-config.json` and IPA config). Managed via the Settings UI and the `POST /api/admin/roster-sync/config` endpoint.

```json
{
  "orgRoots": [
    { "uid": "jsmith", "displayName": "Jane Smith" }
  ],
  "googleSheetId": "1ABCdef...",
  "sheetNames": ["Sheet1", "Sheet2"],
  "githubOrgs": ["my-org"],
  "gitlabGroups": ["my-group"],
  "gitlabInstances": [
    {
      "label": "GitLab.com",
      "baseUrl": "https://gitlab.com",
      "tokenEnvVar": "GITLAB_TOKEN",
      "groups": ["my-group"],
      "excludeGroups": ["redhat/rhel-ai/core/mirrors"]
    }
  ],
  "teamStructure": {
    "nameColumn": "Name",
    "teamGroupingColumn": "Team",
    "customFields": [
      {
        "key": "focus_area",
        "columnLabel": "Focus Area",
        "displayLabel": "Focus Area",
        "visible": true,
        "primaryDisplay": false
      }
    ]
  },
  "teamDataSource": "sheets",
  "gracePeriodDays": 30,
  "autoSync": { "enabled": false, "intervalHours": 24 },
  "lastSyncAt": "2026-03-27T06:00:00.000Z",
  "lastSyncStatus": "success",
  "lastSyncError": null,
  "ldapFields": {
    "discovered": ["rhatRnDComponent", "rhatSubproduct", "rhatJobRole"],
    "discoveredAt": "2026-06-18T12:00:00.000Z",
    "enabled": [
      { "attribute": "rhatRnDComponent", "label": "Business Unit" }
    ]
  },
  "_migratedFrom": "roster-sync-config.json"
}
```

**Notes:**
- `orgRoots` is required (at least one). Each entry needs `uid` and `displayName`. UIDs must match `/^[a-zA-Z0-9._-]+$/`.
- `googleSheetId`, `sheetNames`, `githubOrgs`, `gitlabGroups`, `gitlabInstances` are optional (default to `null` or `[]`).
- `gitlabInstances` is the preferred way to configure GitLab instances. Legacy `gitlabGroups` is auto-migrated to `gitlabInstances` on first load. Each instance has `label`, `baseUrl` (must start with `https://`), `tokenEnvVar` (name of env var holding the token), `groups` (array of group paths), and optional `excludeGroups` (array of group paths to skip when fetching contributions, e.g., mirror repositories).
- `teamStructure` replaces legacy `fieldMapping`/`customFields` via an in-memory migration on load.
- `customFields` supports up to 20 entries. At most one can have `primaryDisplay: true`.
- `gracePeriodDays` controls how long inactive people are retained before purging (default 30).
- `autoSync` controls the automatic sync scheduler (default disabled).
- `lastSyncAt`, `lastSyncStatus`, `lastSyncError` are auto-populated during sync runs.
- `teamDataSource` controls where team structure data lives: `"sheets"` (default, Google Sheets enrichment) or `"in-app"` (managed via the Team Structure Management UI). When `"in-app"`, Sheets Phase 2 enrichment is skipped during sync.
- `ldapFields` configures admin-managed LDAP attribute discovery and sync. `discovered` is the cached list of all available LDAP attributes from the last schema query (populated via `POST /api/admin/roster-sync/ldap-discover`). `enabled` is the admin-selected subset with display labels (max 20). Attributes already in the hardcoded base set (`LDAP_ATTRS`) are rejected. Empty or missing `ldapFields` means no extra LDAP attributes are synced (backward compatible).
- `_migratedFrom` is set to `"roster-sync-config.json"` after one-time migration from the legacy config file. The old file is never deleted (rollback safety net).

## Sync Log — `data/team-data/sync-log.json`

Written after each consolidated sync run. Contains the result of the most recent sync.

```json
{
  "completedAt": "2026-03-27T06:00:12.345Z",
  "status": "success",
  "duration": 12345,
  "stats": {
    "totalPeople": 42,
    "active": 40,
    "inactive": 2,
    "newlyAdded": 3,
    "reactivated": 0,
    "changed": 5,
    "sheetsEnriched": 38,
    "githubInferred": 2,
    "gitlabInferred": 1
  },
  "coverage": { "github": 0.85, "gitlab": 0.78 }
}
```

**Notes:**
- On error, the log contains `status: "error"`, `message`, `duration`, and `completedAt` — no `stats` or `coverage`.
- Overwritten on each sync run (not appended).

## Module State — `data/modules-state.json`

Tracks which modules are enabled or disabled. Managed via `POST /api/admin/modules/:slug/enable` and `POST /api/admin/modules/:slug/disable`.

```json
{
  "team-tracker": true,
  "hello": false
}
```

**Notes:**
- Keys are module slugs, values are booleans.
- An empty object `{}` is valid — modules fall back to their `defaultEnabled` value from `module.json`.
- Created on first module enable/disable action; may not exist on fresh deployments.
- At startup, required dependencies are auto-enabled via `reconcileStartupState()`.

## Snapshots — `data/snapshots/{sanitized-teamKey}/{YYYY-MM-DD}.json`

Team key is sanitized: `::` becomes `--`, special chars become `_`. The filename date is the period end date.

```json
{
  "periodStart": "2026-01-01",
  "periodEnd": "2026-02-01",
  "generatedAt": "2026-03-26T15:19:47.360Z",
  "team": {
    "resolvedCount": 42,
    "resolvedPoints": 85,
    "avgCycleTimeDays": 4.2,
    "githubContributions": 350,
    "gitlabContributions": 120
  },
  "members": {
    "Alice Smith": {
      "resolvedCount": 10,
      "resolvedPoints": 25,
      "avgCycleTimeDays": 3.5,
      "githubContributions": 72,
      "gitlabContributions": 18,
      "hasGithub": true,
      "hasGitlab": true
    }
  }
}
```

## Jira Name Map — `data/jira-name-map.json`

```json
{
  "Alice Smith": {
    "accountId": "5e41b8c03df51b0c937390ec",
    "displayName": "Alice Smith"
  }
}
```

## People Registry — `data/team-data/registry.json`

The single source of truth for all people data. Built by the consolidated sync pipeline (`shared/server/roster-sync/consolidated-sync.js`) which combines LDAP traversal, Google Sheets enrichment, username inference, and lifecycle tracking.

```json
{
  "meta": {
    "generatedAt": "2026-03-27T06:00:00.000Z",
    "provider": "ipa",
    "orgRoots": ["jsmith"],
    "vp": { "name": "VP Name", "uid": "vpuid" }
  },
  "people": {
    "jsmith": {
      "uid": "jsmith",
      "name": "Jane Smith",
      "email": "jsmith@example.com",
      "title": "Engineering Manager",
      "managerUid": "vpuid",
      "orgRoot": "jsmith",
      "orgType": "engineering",
      "github": { "username": "janesmith", "source": "ldap" },
      "gitlab": { "username": "janesmith", "source": "ldap" },
      "status": "active",
      "firstSeenAt": "2026-01-01T00:00:00.000Z",
      "lastSeenAt": "2026-03-27T06:00:00.000Z",
      "inactiveSince": null,
      "jiraTeam": "Platform",
      "specialty": "backend",
      "teamIds": ["team_a1b2c3"],
      "_appFields": { "field_x1y2z3": "backend" },
      "ldapExtra": { "rhatRnDComponent": "Enablement", "rhatSubproduct": "Red Hat OpenShift AI" }
    }
  }
}
```

**Notes:**
- `people` is a flat `{ uid: person }` map with structured `github`/`gitlab` fields and lifecycle tracking (`status`, `firstSeenAt`, `lastSeenAt`, `inactiveSince`).
- `orgType` is `"engineering"` (default) or `"auxiliary"` for non-engineering people (e.g., product managers, designers). Entries without `orgType` are treated as `"engineering"` for backward compatibility.
- `orgRoot` for auxiliary people uses the sentinel value `"_auxiliary"`. This keeps them out of the engineering org tree while satisfying the `orgRoot` field requirement.
- Auxiliary people are excluded from GitHub/GitLab coverage statistics (`computeCoverage()`) and from the legacy roster shape (`readRosterFull()` filters out the `_auxiliary` org bucket).
- `readRosterFull()` in `shared/server/roster.js` transforms this into the legacy `{ orgs: { key: { leader, members } } }` format for backward compatibility with `deriveRoster()` and downstream consumers.
- Leaders are identified by matching a person's `uid` against the configured `orgRoots[].uid` values.
- Enrichment fields from Google Sheets (`_teamGrouping`, `specialty`, `jiraTeam`, etc.) are stored as top-level fields on person records.
- `teamIds` is an array of team IDs (e.g., `["team_a1b2c3"]`) linking the person to in-app managed teams. Defaults to `[]`. Only used when `teamDataSource` is `"in-app"`.
- `_appFields` is an object mapping field definition IDs to values. Values are strings for single-value fields, or arrays of strings for multi-value fields (e.g., `{ "field_x1y2z3": "backend", "field_mv0001": ["Python", "Go"] }`). Stores person-level custom field values managed in-app. The `_` prefix ensures it is not overwritten by Sheets enrichment during sync.
- `ldapExtra` is an optional object containing admin-enabled LDAP attributes beyond the hardcoded base set. Keys are LDAP attribute names (e.g., `rhatRnDComponent`), values are strings or arrays for multi-value attributes. Only present when admin has enabled extra LDAP fields via Settings > LDAP Fields. Populated during roster sync; cleared when all extra fields are disabled.

**Derived roster API response (`GET /api/roster`):**
- When multiple org roots share the same explicitly-configured `displayName` in config, `deriveRoster()` merges them into a single org entry.
- The merged org's `key` is the alphabetically-first root UID among the merged roots.
- Merged orgs include a `mergedKeys` array (sorted alphabetically) listing all root UIDs that were combined.
- Non-merged orgs do not have a `mergedKeys` field.

## Allowlist — `data/allowlist.json`

```json
["user1@example.com", "user2@example.com"]
```

## Teams — `data/team-data/teams.json`

Stores all in-app managed teams. Created when `teamDataSource` is set to `"in-app"` and teams are created via the Team Structure Management UI or migration.

```json
{
  "teams": {
    "team_a1b2c3": {
      "id": "team_a1b2c3",
      "name": "Platform",
      "orgKey": "achen",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "createdBy": "admin@example.com",
      "description": "Owns the **core platform services** and developer experience.",
      "metadata": {
        "field_g7h8i9": "Pat Manager"
      },
      "boards": [
        { "url": "https://redhat.atlassian.net/jira/software/c/projects/RHOAIENG/boards/1103", "name": "RHOAIENG - Platform" },
        { "url": "https://redhat.atlassian.net/jira/software/c/projects/RHOAIENG/boards/1200", "name": "" }
      ]
    }
  }
}
```

**Notes:**
- `teams` is a `{ teamId: team }` map.
- Team IDs follow the pattern `team_` + 6 hex characters (e.g., `team_a1b2c3`), generated via `crypto.randomBytes(3)`.
- `orgKey` links the team to an org root UID.
- `description` is an optional Markdown string (max 2000 chars) describing the team's mission or scope. `null` when not set.
- `metadata` stores team-level custom field values, keyed by field definition ID. Empty object `{}` when no team fields are set.
- `createdBy` is the email of the user who created the team.
- `boards` is an array of `{ url, name }` objects representing user-managed Jira board links. `url` is required (non-empty string), `name` is optional (empty string means no display name set). Defaults to `[]` on new teams. Populated during Sheets-to-In-App migration from `teams-metadata.json` board data.

**Note:** Sprint tracking boards (`sprint-data/teams.json`) and team record boards (`team-data/teams.json[].boards`) are separate data stores with different lifecycles. Sprint tracking boards are auto-discovered from Jira and include sprint-specific metadata (filters, staleness). Team record boards are user-managed URLs. A future enhancement may link these two systems.

## Allocation Data — `data/allocation/`

> **Provided by the `platform/allocation/` extension.** Allocation was removed
> from `@org-pulse/core` in v2.0.61; this consumer re-homes it as a
> self-contained platform extension (see `docs/PLATFORM.md` → Allocation). Core
> itself writes no allocation data.

Sprint allocation data is stored under `data/allocation/` with an `allocation/` storage prefix. Key files:

- `allocation/sprints/{sprintId}.json` — Per-sprint issue classification data
- `allocation/summaries/{teamKey}.json` — Aggregated team allocation summary
- `allocation/org/{orgKey}.json` — Org-level allocation summary

Sprint data files include a `strategyId` field that records which allocation strategy was used for classification. When the strategy changes (different `id` in `platform/allocation/manifest.json`'s `strategy` block), cached closed sprint data is invalidated and re-classified on next refresh.

```json
{
  "sprintId": 12345,
  "sprintName": "Sprint 42",
  "strategyId": "ai-eng-40-40-20",
  "summary": {
    "totalPoints": 100,
    "totalCount": 20,
    "buckets": {
      "tech-debt-quality": { "points": 40, "count": 8, "completedPoints": 30, "completedCount": 6 },
      "new-features": { "points": 40, "count": 8, "completedPoints": 35, "completedCount": 7 },
      "uncategorized": { "points": 20, "count": 4, "completedPoints": 10, "completedCount": 2 }
    }
  }
}
```

Bucket keys are dynamic — they come from the active allocation strategy's `categories[].key` values plus a built-in `uncategorized` key. When the `platform/allocation/` extension is absent, allocation features are hidden and no data is written.

## Field Definitions — `data/team-data/field-definitions.json`

Stores custom field definitions for person-level and team-level fields. Created when `teamDataSource` is set to `"in-app"` and fields are defined via the Field Definitions UI or migration.

```json
{
  "personFields": [
    {
      "id": "field_x1y2z3",
      "label": "Focus Area",
      "type": "free-text",
      "multiValue": false,
      "required": false,
      "visible": true,
      "primaryDisplay": true,
      "allowedValues": null,
      "optionsRef": null,
      "deleted": false,
      "order": 0,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "createdBy": "admin@example.com"
    }
  ],
  "teamFields": [
    {
      "id": "field_g7h8i9",
      "label": "Product Manager",
      "type": "person-reference-linked",
      "multiValue": false,
      "required": false,
      "visible": true,
      "primaryDisplay": false,
      "allowedValues": null,
      "optionsRef": null,
      "deleted": false,
      "order": 0,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "createdBy": "admin@example.com"
    }
  ]
}
```

**Notes:**
- `personFields` and `teamFields` are arrays sorted by `order`.
- Field IDs follow the pattern `field_` + 6 hex characters (e.g., `field_x1y2z3`).
- `type` is one of: `"free-text"`, `"constrained"`, `"person-reference-linked"`.
- `multiValue` is a boolean. When `true`, the field accepts an array of values. Valid for all field types (`constrained`, `free-text`, `person-reference-linked`). Defaults to `false`.
- `deleted` supports soft-delete — deleted fields are hidden from the UI but values are preserved.
- `allowedValues` is an array of strings for `constrained` fields (the set of selectable options), or `null` for other field types. Maximum 100 items, each up to 200 characters. When `optionsRef` is set, `allowedValues` is `null` in storage and resolved at runtime from the referenced field option set.
- `optionsRef` is an optional string referencing a named field option set (e.g., `"components"`). When set, the field's allowed values are sourced dynamically from `data/team-data/field-options/<optionsRef>.json` instead of from the static `allowedValues` array. The `GET /structure/field-definitions` API response resolves `optionsRef` fields by injecting the option values into `allowedValues` (with a `_resolvedFromOptions: true` flag). Defaults to `null`.
- At most one person field can have `primaryDisplay: true`.

## Field Options — `data/team-data/field-options/<name>.json`

Each field option set is a separate JSON file, identified by name. Used by field definitions with `optionsRef` to source allowed values dynamically.

```json
{
  "name": "components",
  "label": "Components",
  "values": [
    "Data Pipelines",
    "Infrastructure Services",
    "ML Models",
    "Platform Core",
    "Platform Dashboard"
  ],
  "updatedAt": "2026-04-29T12:00:00Z",
  "updatedBy": "admin@example.com",
  "migrationDone": true,
  "migratedAt": "2026-04-29T12:00:00Z",
  "migratedBy": "admin@example.com"
}
```

**Notes:**
- `name` is the stable identifier referenced by `optionsRef` on field definitions (e.g., `"components"`).
- `label` is the human-readable name shown in the Manage UI.
- `values` is an ordered array of valid entries. Maximum 500 items, each up to 200 characters. Values are deduplicated and sorted alphabetically on write.
- `updatedAt` and `updatedBy` track the last modification.
- `migrationDone`, `migratedAt`, `migratedBy` are set by the component model migration to prevent re-running. Only present on the "components" option set after migration.

## Field Exceptions — `data/team-data/field-exceptions.json`

Per-field exceptions that exclude specific fields from completeness checks for individual people or teams. Centrally managed — expected volume is low (tens to hundreds).

```json
{
  "version": 1,
  "exceptions": [
    {
      "id": "fex_a1b2c3d4",
      "entityType": "person",
      "entityId": "jsmith",
      "fieldId": "field_dept_id",
      "reason": "Contractor — department not applicable",
      "createdAt": "2026-05-20T14:00:00.000Z",
      "createdBy": "admin@example.com"
    },
    {
      "id": "fex_i9j0k1l2",
      "entityType": "team",
      "entityId": "team_def456",
      "fieldId": "__boards__",
      "reason": "Infrastructure team — no Jira boards",
      "createdAt": "2026-05-20T16:00:00.000Z",
      "createdBy": "admin@example.com"
    }
  ]
}
```

**Notes:**
- `id` format: `fex_` prefix + 8 hex chars.
- `entityType` is `"person"` or `"team"`.
- `entityId` is a person UID (registry key) or team ID.
- `fieldId` references a field from `field-definitions.json`, or the reserved sentinel `__boards__` (valid only with `entityType: "team"`) for teams that intentionally have no Jira boards.
- Uniqueness: one exception per `(entityType, entityId, fieldId)` tuple. Duplicate creates update the reason (upsert).
- If the file does not exist, the system treats it as zero exceptions.
- Excepted fields are excluded from completeness counts in the message provider and Data Quality/Manager Dashboard UIs, but remain visible with an "Exception" badge.

## Audit Log — `data/audit-log.json`

Append-only log of team structure management actions. Entries are added by team, field, and migration operations.

```json
{
  "entries": [
    {
      "id": "evt_demo0001",
      "timestamp": "2026-01-15T10:00:00.000Z",
      "actor": "admin@example.com",
      "action": "team.create",
      "entityType": "team",
      "entityId": "team_a1b2c3",
      "entityLabel": "Platform",
      "field": null,
      "oldValue": null,
      "newValue": null,
      "detail": "Created team \"Platform\" in org achen"
    }
  ],
  "maxEntries": 10000
}
```

**Notes:**
- `entries` is ordered newest-first (prepended). Capped at `maxEntries` (10,000) — oldest entries are trimmed.
- `action` values include: `team.create`, `team.rename`, `team.delete`, `team.boards.update`, `person.team.assign`, `person.team.unassign`, `person.fields.update`, `team.fields.update`, `field.create`, `field.update`, `field.delete`, `field.reorder`, `migration.sheets_to_inapp`, `field-options.add`, `field-options.replace`, `field-options.remove`, `migration.field-to-options`, `field-exception.create`, `field-exception.update`, `field-exception.remove`.
- `entityType` is one of: `"team"`, `"person"`, `"field"`, `"system"`, `"field-options"`, `"field-exception"`, `"migration"`.
- `field`, `oldValue`, `newValue` are used for change-tracking (e.g., rename, field value updates). `null` when not applicable.
- `detail` is a human-readable summary of the action.

---

## AI Impact — RFE Data (`data/ai-impact/rfe-data.json`)

Cached RFE issues fetched from Jira. The module's primary data file.

```json
{
  "fetchedAt": "2026-03-30T12:00:00Z",
  "issues": [
    {
      "key": "RHAIRFE-1234",
      "summary": "Implement real-time collaboration features",
      "status": "In Progress",
      "priority": "High",
      "created": "2026-03-25T10:00:00Z",
      "createdLabelDate": "2026-03-26T14:30:00.000+0000",
      "revisedLabelDate": "2026-03-27T09:15:00.000+0000",
      "creator": "schen",
      "creatorDisplayName": "Sarah Chen",
      "components": ["Platform Core", "ML Models"],
      "labels": ["rfe-creator-auto-created", "rfe-creator-auto-revised", "customer-request"],
      "aiInvolvement": "both",
      "linkedFeature": {
        "key": "RHAISTRAT-567",
        "summary": "Strat: Real-time collaboration",
        "status": "In Progress",
        "fixVersions": ["RHOAI 2.16"]
      }
    }
  ]
}
```

**Notes:**
- `aiInvolvement` is one of: `"both"`, `"created"`, `"revised"`, `"none"` — derived from exact label matching at fetch time
- `createdLabelDate`: ISO timestamp of the most recent changelog addition of the created label. Set only when `aiInvolvement` is `"created"` or `"both"`. Falls back to `created` if the label was present since issue creation (no changelog entry). `null` when the created label is not present.
- `revisedLabelDate`: ISO timestamp of the most recent changelog addition of the revised label. Same logic as `createdLabelDate`. `null` when the revised label is not present.
- `needsAttentionSince`: ISO timestamp of the most recent changelog addition of `rfe-creator-needs-attention`. Falls back to `created` when the label is present but has no changelog entry. `null` when the label is not currently on the issue. Used by the frontend to calculate how long an item has been in a needs-revision or passed-with-caveats state, independent of pipeline run frequency.
- `rubricPassSince`: ISO timestamp of the most recent changelog addition of `rfe-creator-autofix-rubric-pass`. Falls back to `created` when the label is present but has no changelog entry. `null` when the label is not currently on the issue. Used by the frontend to calculate how long an item has been in a ready-to-advance or queued-for-pipeline state.
- `components` is an array of Jira component names (strings). Empty array if the issue has no components.
- `linkedFeature` is resolved from Jira issue links (type = "Cloners", outward to RHAISTRAT project). Can be `null` if no link exists.
- `labels` is the raw Jira label array, preserved for reference

## AI Impact — RFE Metrics API Response (`GET /api/modules/ai-impact/rfe-data`)

The `/rfe-data` endpoint returns computed metrics alongside the cached issue list. The `pipelineFriction` object surfaces friction signals from Jira pipeline labels that are already present on every issue.

```json
{
  "pipelineFriction": {
    "needsAttentionPct": 18,
    "needsAttentionChange": 3,
    "needsAttentionTrend": "worsening",
    "feasibilityBlockedPct": 9,
    "feasibilityBlockedChange": -2,
    "feasibilityBlockedTrend": "improving"
  }
}
```

**Fields:**
- `needsAttentionPct`: % of AI-touched RFEs in the selected window with label `rfe-creator-needs-attention`
- `needsAttentionChange`: percentage-point change vs the prior period (positive = more friction)
- `needsAttentionTrend`: `"improving"` | `"stable"` | `"worsening"` — based on `trendThresholdPp` config (default 2pp); lower is improving for friction metrics
- `feasibilityBlockedPct`: % of AI-touched RFEs with `rfe-creator-feasibility-fail` **or** `rfe-creator-feasibility-unknown` (each issue counted once)
- `feasibilityBlockedChange`: pp change vs prior period
- `feasibilityBlockedTrend`: same trend classification as above

**Denominator:** AI-touched RFEs only (`aiInvolvement !== 'none'`), filtered by `issue.created` within the time window. Manual RFEs the pipeline never processed are excluded.

**UI:** `needsAttentionPct` / `needsAttentionChange` render as sub-text under the "Created with AI" tile; `feasibilityBlockedPct` / `feasibilityBlockedChange` under "Revised with AI".

## AI Impact — Assessments (`data/ai-impact/assessments.json`)

Quality assessment data pushed from the rfe-quality-dashboard CI pipeline. Stores the latest assessment and score history for each RFE.

```json
{
  "lastSyncedAt": "2026-04-19T12:00:00Z",
  "totalAssessed": 1630,
  "assessments": {
    "RHAIRFE-123": {
      "latest": {
        "scores": { "what": 2, "why": 1, "how": 2, "task": 1, "size": 2 },
        "total": 8,
        "passFail": "PASS",
        "antiPatterns": ["WHY Void"],
        "criterionNotes": {
          "what": "...", "why": "...", "how": "...", "task": "...", "size": "..."
        },
        "verdict": "One-sentence summary.",
        "feedback": "Actionable markdown.",
        "assessedAt": "2026-04-19T12:00:00Z"
      },
      "history": [
        {
          "total": 5,
          "passFail": "FAIL",
          "scores": { "what": 1, "why": 0, "how": 1, "task": 1, "size": 2 },
          "assessedAt": "2026-04-12T12:00:00Z"
        }
      ]
    }
  }
}
```

**Notes:**
- `latest` contains the full assessment (scores, notes, verdict, feedback). Used by list, detail, and chart views.
- `history` contains prior assessments with a trimmed payload (only `scores`, `total`, `passFail`, `assessedAt`). Full notes are only kept in `latest` to control file size.
- History is sorted newest-first, capped at 20 entries per RFE (`MAX_HISTORY`). When the cap is reached, only entries newer than the oldest existing entry are accepted; older entries are discarded without insertion.
- `lastSyncedAt` and `totalAssessed` are updated on every write (PUT single or POST bulk).
- `scores`: each criterion (`what`, `why`, `how`, `task`, `size`) is an integer 0-2. `total` is the sum (0-10).
- `passFail` is `"PASS"` or `"FAIL"` (enum only; no server-side threshold validation).
- Upsert is idempotent: if `latest.assessedAt` matches the incoming `assessedAt`, the write is skipped and the endpoint returns `"unchanged"`.
- The file is written atomically (write-to-temp-then-rename) to prevent corruption from mid-write crashes.
- On DELETE, the file is written as `{ "lastSyncedAt": null, "totalAssessed": 0, "assessments": {} }` (never `null`).

## AI Impact — Feature Decomposer (`data/ai-impact/decomposer.json`)

Epic-decomposition results pushed from the **epic-decomposer pipeline**
(`gitlab.com/redhat/rhel-ai/agentic-ci/epic-decomposer-results` →
`epic-decomposer-dashboard`). The dashboard's `generate-dashboard.py` emits a
canonical `data.json` that feeds both the GitLab-Pages dashboard and Org Pulse.
The pipeline **pushes the whole `data.json`** to Org Pulse (single-document
snapshot per run, not a per-item bulk array); Org Pulse stores a **subset** of
it — the dashboard remains the full-fidelity consumer.

### Canonical `data.json` contract (dashboard superset — what the pipeline pushes)

```json
{
  "schema_version": "1.0",
  "generated_at": "2026-07-24T00:00:00Z",
  "source": { "data_dir": "…", "pipeline_id": "", "commit_sha": "" },
  "signal_names": ["change_specificity", "pattern_precedent", "…"],
  "investigation_signal_names": ["question_specificity", "…"],
  "counts": { "runs": 9, "strategies": 25 },
  "runs": [
    {
      "run_id": "2026-07-22T18-49-17Z", "started": "…", "completed": "…",
      "duration_minutes": 10.7, "batch_size": 50,
      "total": 2, "passed": 2, "failed": 0, "errors": 0,
      "avg_score": 14, "score_max": 14, "submitted_epics": 9,
      "results": [{ "strat_id": "RHAISTRAT-1", "status": "passed", "epic_count": 4, "score": 14 }]
    }
  ],
  "strategies": {
    "RHAISTRAT-1": {
      "strat_id": "RHAISTRAT-1", "title": "…", "priority": "Major",
      "labels": ["…"], "epic_count": 4, "critical_path_length": 3, "revised": true,
      "mermaid_dag": "graph TD…",
      "review": { "score": 14, "pass": true, "recommendation": "accept", "issues": [], "error": null },
      "epics": [
        {
          "epic_id": "RHAISTRAT-1-E001", "title": "…", "type": "Implementation",
          "implementation_type": "standard", "priority": "P0", "component": "MLflow",
          "team": "…", "dependencies": [], "ai_implementability": "High",
          "ai_implementability_score": 2, "ai_signals": { "change_specificity": 1 },
          "investigation_signals": {}, "jira_key": "RHAI-137", "branch": null
        }
      ],
      "run_history": [{ "run_id": "…", "score": 14, "status": "passed", "epic_count": 2 }]
    }
  },
  "aggregates": {
    "unique_strategies": 25, "total_epics": 132, "pass_rate": 96,
    "avg_score_normalized": 98.3, "avg_epics_per_strategy": 5.5, "avg_critical_path": 3.2,
    "investigation_epic_count": 7, "strats_with_investigations": 7,
    "failed_strategies": 1, "recovered_strategies": 5,
    "failed_ids": ["RHAISTRAT-1939"], "recovered_ids": ["…"],
    "implementability_distribution": { "High": 111, "Medium": 17, "Low": 4 },
    "type_distribution": { "Implementation": 124, "Investigation": 8 },
    "priority_distribution": { "P0": 49, "P1": 26, "P2": 14 },
    "component_distribution": { "MLflow": 21, "…": 0 },
    "signal_aggregates": { "change_specificity": { "pos": 59, "zero": 21, "neg": 1 } },
    "criterion_failure_counts": {}, "severity_counts": { "critical": 1, "major": 0, "minor": 5 }
  },
  "epic_bodies": { "RHAISTRAT-1-E001": "# markdown body…" }
}
```

### Stored Pulse subset (`data/ai-impact/decomposer.json`)

Org Pulse validates the envelope leniently (`runs` array, `strategies` object,
`aggregates` object; extra fields tolerated) and projects to this subset —
dropping `epic_bodies`, per-run `results`, per-epic signal maps, and strategy
`labels`, while **keeping** `aggregates`, slim `runs`, `mermaid_dag`, and slim
`epics[]` for the expandable strategy rows:

```json
{
  "lastSyncedAt": "2026-07-24T21:21:48.739Z",
  "schemaVersion": "1.0",
  "generatedAt": "2026-07-24T00:00:00Z",
  "source": { "data_dir": "…" },
  "signalNames": ["…"],
  "investigationSignalNames": ["…"],
  "counts": { "runs": 9, "strategies": 25 },
  "aggregates": { "…": "verbatim from data.json" },
  "runs": [
    { "run_id": "…", "started": "…", "completed": "…", "duration_minutes": 10.7,
      "total": 2, "passed": 2, "failed": 0, "errors": 0, "avg_score": 14,
      "score_max": 14, "submitted_epics": 9 }
  ],
  "strategies": [
    { "strat_id": "RHAISTRAT-1", "title": "…", "priority": "Major",
      "epic_count": 4, "critical_path_length": 3, "revised": true,
      "mermaid_dag": "graph TD…",
      "review": { "score": 14, "pass": true, "recommendation": "accept" },
      "epics": [
        { "epic_id": "RHAISTRAT-1-E001", "title": "…", "type": "Implementation",
          "implementation_type": "standard", "priority": "P0", "component": "MLflow",
          "ai_implementability": "High", "jira_key": "RHAI-137", "dependencies": [] }
      ],
      "run_history": [{ "run_id": "…", "score": 14, "status": "passed", "epic_count": 2 }] }
  ]
}
```

### API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/modules/ai-impact/decomposer` | `ai-impact:read` | Snapshot for the Feature Decomposer tab (adds `jiraHost` from `JIRA_HOST`). |
| `GET` | `/api/modules/ai-impact/decomposer/status` | admin, `ai-impact:read` | `{ lastSyncedAt, generatedAt, counts }`. |
| `POST` | `/api/modules/ai-impact/decomposer` | admin, `ai-impact:write` | Push the canonical `data.json`; stores the projected subset. Returns `{ status: "stored", runs, strategies }`. No-op in demo mode. |
| `DELETE` | `/api/modules/ai-impact/decomposer` | admin, `ai-impact:write` | Clears the snapshot (writes the empty skeleton, never `null`). |

**Notes:**
- Push model mirrors strat-creator → `/features/bulk`, but the decomposer store is
  **self-contained** in `ai-impact` (not forwarded to releases) — decomposition
  results are an AI-Impact-only concern.
- The KPI tiles and distribution charts render straight from the pre-computed
  `aggregates`; Org Pulse does **no** re-aggregation (display-layer only). The
  "Showing" date filter scopes the strategy list + volume-by-run trend (using
  `run_history` timestamps); the `aggregates`-backed cards remain all-time.
- The demo fixture at `fixtures/ai-impact/decomposer.json` is a real subset
  projected from a pipeline `data.json`.

## AI Impact — Features (`data/ai-impact/features.json`) — DEPRECATED

> **Deprecated.** Feature review data is now stored in the unified releases
> execution store at `data/releases/execution/features/{KEY}.json` under the
> `aiReview` namespace. See [Releases — Execution Feature Detail](#releases--execution-feature-detail-datareleasesexecutionfeatureskeysjson)
> for the current schema. This legacy file is kept only as a migration source
> and demo-mode fallback.

Feature review data pushed from the strat creator pipeline. Stores the latest review and score history for each RHAISTRAT feature.

```json
{
  "lastSyncedAt": "2026-04-20T06:00:00Z",
  "totalFeatures": 75,
  "features": {
    "RHAISTRAT-1168": {
      "latest": {
        "key": "RHAISTRAT-1168",
        "title": "GPU-as-a-Service Observability",
        "sourceRfe": "RHAIRFE-262",
        "priority": "Major",
        "status": "Refined",
        "size": "L",
        "recommendation": "approve",
        "needsAttention": false,
        "humanReviewStatus": "approved",
        "scores": { "feasibility": 2, "testability": 1, "scope": 2, "architecture": 2, "total": 7 },
        "reviewers": { "feasibility": "approve", "testability": "revise", "scope": "approve", "architecture": "approve" },
        "components": ["Platform Core"],
        "labels": ["strat-creator-auto-created", "tech-reviewed"],
        "runId": "20260419-013035",
        "runTimestamp": "2026-04-19T01:30:35Z",
        "reviewedAt": "2026-04-19T01:30:35Z"
      },
      "history": [
        {
          "scores": { "feasibility": 1, "testability": 1, "scope": 2, "architecture": 1, "total": 5 },
          "recommendation": "revise",
          "needsAttention": true,
          "humanReviewStatus": "awaiting-review",
          "reviewedAt": "2026-04-12T01:30:00Z"
        }
      ]
    }
  }
}
```

**Notes:**
- `latest` contains the full feature review (scores, reviewers, labels, etc.). Used by list, detail, and chart views.
- `history` contains prior reviews with a trimmed payload (only `scores`, `recommendation`, `needsAttention`, `humanReviewStatus`, `reviewedAt`). Full labels and reviewers are only kept in `latest` to control file size.
- History is sorted newest-first, capped at 20 entries per feature (`MAX_HISTORY`).
- `lastSyncedAt` and `totalFeatures` are updated on every write (PUT single or POST bulk).
- `scores`: each dimension (`feasibility`, `testability`, `scope`, `architecture`) is an integer 0-2. `total` is the sum (0-8).
- `recommendation` is one of `"approve"`, `"revise"`, `"reject"`.
- `humanReviewStatus` is derived from `labels`: `"approved"` if labels contain `strat-creator-human-sign-off`, `"needs-review"` if `strat-creator-needs-attention`, otherwise `"awaiting-review"`.
- `components` is an array of Jira component names (strings). Empty array if the feature has no components.
- The API accepts both camelCase and snake_case field names (from `summary.json` pipeline output). Normalization happens in validation.
- Upsert is idempotent: if `latest.reviewedAt` matches the incoming `reviewedAt`, the write is skipped and returns `"unchanged"`.
- The file is written atomically (write-to-temp-then-rename) to prevent corruption.
- On DELETE, the file is written as `{ "lastSyncedAt": null, "totalFeatures": 0, "features": {} }`.

## AI Impact — Config (`data/ai-impact/config.json`)

Admin-configurable settings for the AI Impact module.

```json
{
  "jiraProject": "RHAIRFE",
  "linkedProject": "RHAISTRAT",
  "createdLabel": "rfe-creator-auto-created",
  "revisedLabel": "rfe-creator-auto-revised",
  "testExclusionLabel": "rfe-creator-skill-testing",
  "linkTypeName": "Cloners",
  "excludedStatuses": ["Closed"],
  "lookbackMonths": 12,
  "trendThresholdPp": 2
}
```

**Notes:**
- All string fields are validated against JQL injection (no quotes, parens, semicolons, backslashes)
- `lookbackMonths` must be an integer between 1 and 120
- `trendThresholdPp` is the percentage-point threshold for classifying trends as "growing" or "declining" (0-50)
- Defaults are used when no config file exists

## Releases — Delivery Config (`data/releases/delivery/config.json`)

Admin-configurable settings for the Releases module delivery domain (formerly Release Analysis).

```json
{
  "projectKeys": ["RHOAIENG"],
  "storyPointsField": "customfield_10028",
  "featureWeightField": "",
  "baselineDays": 180,
  "baselineMode": "p90",
  "riskIssuesPerDayGreen": 1,
  "riskIssuesPerDayYellow": 10,
  "productPagesReleasesUrl": "",
  "productPagesProductShortnames": ["rhoai", "rhelai"],
  "productPagesBaseUrl": "https://productpages.redhat.com",
  "productPagesTokenUrl": "https://auth.redhat.com/auth/realms/EmployeeIDP/protocol/openid-connect/token",
  "jiraAllProjects": false,
  "targetVersionField": "customfield_10855",
  "targetVersionJqlFragment": ""
}
```

**Notes:**
- `productPagesProductShortnames` is an array of Product Pages product shortnames to track. When non-empty, overrides `productPagesReleasesUrl`.
- `productPagesBaseUrl` defaults to `https://productpages.redhat.com`. Override for non-standard instances.
- `productPagesTokenUrl` defaults to the Red Hat SSO token endpoint. Override for non-standard SSO.
- Credentials (`PRODUCT_PAGES_CLIENT_ID`, `PRODUCT_PAGES_CLIENT_SECRET`, `PRODUCT_PAGES_TOKEN`) are env-var-only and not stored in config.

---

## Releases — Quality Versions (`data/releases/delivery/quality/versions.json`)

All fix versions with release dates from tracked projects (RHOAIENG, AIPCC, RHAIENG, INFERENG).

```json
[
  {
    "name": "rhoai-3.3",
    "releaseDate": "2026-03-15",
    "project": "RHOAIENG",
    "released": true
  }
]
```

**Fields:**
- `name` (string): Version name from Jira fix version
- `releaseDate` (string): ISO date (YYYY-MM-DD) when version was released
- `project` (string): Jira project key
- `released` (boolean): Whether version is marked as released in Jira

---

## Releases — Quality Bugs (`data/releases/delivery/quality/bugs-{PROJECT}.json`)

Blocker/Critical/Major bugs with affected versions, per project. Only bugs created >= version release date (post-release discovery).

```json
[
  {
    "key": "RHOAIENG-15234",
    "summary": "Dashboard fails to load when multiple models are deployed",
    "priority": "Critical",
    "status": "Closed",
    "affectedVersions": ["rhoai-3.3"],
    "components": ["Dashboard"],
    "created": "2026-03-20T10:15:00.000Z",
    "resolved": "2026-03-22T14:30:00.000Z",
    "releaseDate": "2026-03-15"
  }
]
```

**Fields:**
- `key` (string): Jira issue key
- `summary` (string): Issue summary
- `priority` (string): Priority name (Blocker, Critical, or Major)
- `status` (string): Current Jira status
- `affectedVersions` (string[]): Array of version names this bug affects
- `components` (string[]): Array of component names
- `created` (string): ISO timestamp when bug was filed
- `resolved` (string | null): ISO timestamp when bug was resolved, or null if open
- `releaseDate` (string): Earliest release date among affected versions (for filtering)

**Files:**
- `bugs-RHOAIENG.json`
- `bugs-AIPCC.json`
- `bugs-RHAIENG.json`
- `bugs-INFERENG.json`

---

## Releases — Quality Components (API Response)

**Note:** Components are computed dynamically from bug files by the `GET /api/modules/releases/delivery/quality/components` endpoint. No stored `components.json` file exists.

The API response format:

```json
[
  { "name": "Dashboard", "count": 45 },
  { "name": "Data Science Pipelines", "count": 32 },
  { "name": "Model Serving", "count": 28 }
]
```

**Fields:**
- `name` (string): Component name
- `count` (number): Number of bugs affecting this component
- Sorted by count descending

---

## Releases — Quality 90-Day Summary (API Response)

**Note:** Computed dynamically by the `GET /api/modules/releases/delivery/quality/90day-summary` endpoint from stored versions and bug files. No stored file — data is derived at request time.

The API response format:

```json
{
  "releases": [
    {
      "version": "3.4",
      "products": [
        {
          "name": "rhoai-3.4",
          "bugCount": 12,
          "daysElapsed": 54,
          "isComplete": false,
          "releaseDate": "2026-05-08"
        },
        {
          "name": "rhelai-3.4",
          "bugCount": 5,
          "daysElapsed": 54,
          "isComplete": false,
          "releaseDate": "2026-05-08"
        },
        {
          "name": "rhaii-3.4",
          "bugCount": 3,
          "daysElapsed": 54,
          "isComplete": false,
          "releaseDate": "2026-05-08"
        }
      ],
      "total": 20
    }
  ]
}
```

**Fields (release):**
- `version` (string): Release family number (e.g., "3.4")
- `products` (array): Product-level breakdown
- `total` (number): Total bugs across all products in this release family

**Fields (product):**
- `name` (string): Full version name (e.g., "rhoai-3.4")
- `bugCount` (number): Bugs created within 90 days of GA
- `daysElapsed` (number): Days since GA, capped at 90
- `isComplete` (boolean): Whether the 90-day tracking window has closed
- `releaseDate` (string): ISO date (YYYY-MM-DD) of the GA release

Releases are sorted descending by version number (newest first). Only major versions (X.X) are included; z-stream versions (e.g., 3.3.1) are excluded.

---

## API Tokens — `data/api-tokens.json`

Stores hashed API tokens for bearer-token authentication. Created on first token creation.

```json
{
  "tokens": [
    {
      "id": "uuid-v4",
      "name": "My CI script",
      "tokenHash": "sha256-hex-of-full-token",
      "tokenPrefix": "tt_a1b2c3d4",
      "ownerEmail": "user@redhat.com",
      "scopes": ["roster:read", "metrics:read"],
      "createdAt": "2026-04-03T12:00:00Z",
      "expiresAt": "2026-07-03T12:00:00Z",
      "lastUsedAt": "2026-04-03T14:30:00Z"
    }
  ]
}
```

**Notes:**
- Raw tokens are never stored — only SHA-256 hashes.
- `tokenPrefix` stores the first 11 characters (e.g., `tt_a1b2c3d4`) for identification.
- `scopes` controls which API endpoints the token can access. Values: an array of scope strings (e.g., `["roster:read", "metrics:write"]`), `["*"]` for wildcard full access, `[]` for no access (except `tokens:manage`), or `null` for legacy full access. Legacy tokens without a `scopes` field are treated as `null` (full access). `tokens:manage` is always implicitly granted.
- `expiresAt` is `null` for non-expiring tokens.
- `lastUsedAt` is `null` until first use, then updated (throttled to once per 60 seconds).

---

## Releases — Execution Index (`data/releases/execution/index.json`)

Derived summary index of all features in the unified feature store. Rebuilt automatically after each feature write batch (pipeline ingest, Jira sync, or discovery).

```json
{
  "fetchedAt": "2026-04-08T06:00:00Z",
  "schemaVersion": "v2",
  "featureCount": 42,
  "features": [
    {
      "key": "RHAISTRAT-123",
      "summary": "Implement model serving autoscaling",
      "status": "In Progress",
      "statusCategory": "In Progress",
      "priority": "Normal",
      "assignee": "Alice Smith",
      "fixVersions": ["RHOAI 2.16", "RHOAI 2.17"],
      "labels": ["core"],
      "completionPct": 75,
      "epicCount": 5,
      "issueCount": 30,
      "blockerCount": 1,
      "health": "GREEN",
      "lastUpdated": "2026-06-01T00:00:00Z",
      "targetVersions": ["3.5"],
      "pm": "Product Manager",
      "architect": "Architect Name",
      "parentKey": "RHAISTRAT-100",
      "colorStatus": "Green",
      "ownerStatusColor": "Green",
      "team": "Model Serving",
      "components": ["API", "Dashboard"]
    }
  ]
}
```

**Notes:**
- `assignee` is a string in the index (flattened from the detail object shape)
- `colorStatus` and `ownerStatusColor` are identical (backward compat alias)
- `pm` is flattened to a string from the detail object shape
- `team` and `components` are Jira-sourced fields surfaced in the index for filtering
- Metrics fields (`completionPct`, `epicCount`, etc.) are derived from the detail `metrics` object

## Releases — Execution Feature Detail (`data/releases/execution/features/{KEY}.json`)

Unified per-feature file combining data from pipeline (GitLab CI), Jira enrichment, and tracking data. The `_sources` field tracks when each source last contributed.

```json
{
  "key": "RHAISTRAT-123",
  "summary": "Implement model serving autoscaling",

  "_sources": {
    "pipeline": "2026-06-04T12:00:00Z",
    "jira": "2026-06-05T08:30:00Z"
  },

  "status": "In Progress",
  "statusCategory": "In Progress",
  "colorStatus": "Green",
  "ownerStatusColor": "Green",
  "statusNotes": "On track for EA2 delivery",
  "statusSummary": "<p>On track for EA2 delivery</p>",
  "priority": "Normal",
  "assignee": { "displayName": "Alice Smith", "accountId": "5e41b8c03df51b0c937390ec" },
  "pm": { "displayName": "Jane PM" },
  "team": "Model Serving",
  "releaseType": "Feature",
  "fixVersions": ["rhoai-3.5"],
  "labels": ["core"],
  "components": ["Model Serving"],
  "docsRequired": "Yes",
  "targetEnd": "2026-07-01",
  "riceScore": 42,
  "riceStatus": "complete",
  "isBlocked": false,
  "linkedRfeKey": "RHAIRFE-1234",

  "issueLinks": [
    { "type": "Cloners", "direction": "outward", "linkedKey": "RHAIRFE-1234", "linkedSummary": "...", "linkedStatus": "Approved" }
  ],
  "epics": [
    { "key": "RHOAIENG-456", "summary": "Epic: Autoscaling backend", "status": "In Progress" }
  ],
  "architect": "Architect Name",
  "parentKey": "RHAISTRAT-100",
  "targetVersions": ["3.5"],

  "metrics": {
    "totalEpics": 5,
    "totalIssues": 30,
    "completionPct": 75,
    "blockerCount": 1,
    "health": "GREEN"
  },
  "topology": { "repos": [] },

  "created": "2026-02-26T14:49:47.944+0000",
  "updated": "2026-06-05T08:30:00.000+0000"
}
```

**Notes:**
- `assignee` is an object `{ displayName, accountId }` in the detail (flattened to string in the index)
- `colorStatus` and `ownerStatusColor` are identical (backward compat alias during migration)
- `_sources` timestamps indicate data freshness per source; features with only `pipeline` have not been Jira-enriched yet
- `statusNotes` (pipeline) and `statusSummary` (Jira) are different fields with different formats
- Jira-owned fields are authoritative when present; pipeline-owned fields (`metrics`, `topology`) are preserved across Jira syncs
- `aiReview` is optional; only present for features that have been scored by the AI review pipeline

**Optional — AI Review (`aiReview`):**

AI review scores and metadata pushed by the strat-creator pipeline via the AI Impact module. Stored under a single `aiReview` namespace to avoid field collisions. `humanReviewStatus` is derived from Jira labels during enrichment; sign-off details (`approvedBy`, `approvedAt`) are backfilled from the Jira changelog.

```json
{
  "aiReview": {
    "title": "Feature title from AI pipeline",
    "sourceRfe": "RHAIRFE-456",
    "size": "M",
    "recommendation": "approve",
    "needsAttention": false,
    "humanReviewStatus": "approved",
    "approvedBy": "Jane Doe",
    "approvedAt": "2026-06-01T00:00:00Z",
    "scores": {
      "feasibility": 2,
      "testability": 1,
      "scope": 2,
      "architecture": 2,
      "total": 7
    },
    "reviewers": {
      "feasibility": "approve",
      "testability": "revise",
      "scope": "approve",
      "architecture": "approve"
    },
    "labels": ["strat-creator-auto-created", "strat-creator-human-sign-off"],
    "reviewedAt": "2026-05-15T00:00:00Z",
    "runId": "run-abc-123",
    "history": [
      {
        "scores": { "feasibility": 1, "testability": 1, "scope": 2, "architecture": 1, "total": 5 },
        "recommendation": "revise",
        "needsAttention": true,
        "humanReviewStatus": "awaiting-review",
        "reviewedAt": "2026-05-01T00:00:00Z"
      }
    ]
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | AI pipeline's title (may differ from Jira `summary`) |
| `sourceRfe` | string | Source RFE key (e.g. `RHAIRFE-456`) |
| `size` | `S\|M\|L\|XL\|null` | T-shirt size estimate |
| `recommendation` | `approve\|revise\|reject` | Overall recommendation |
| `needsAttention` | boolean | Whether human attention is needed |
| `humanReviewStatus` | `approved\|needs-review\|awaiting-review` | Derived from Jira labels |
| `approvedBy` | string\|null | Who added the sign-off label |
| `approvedAt` | string\|null | When the sign-off label was added |
| `scores` | object | Per-dimension scores (0-2) plus `total` (0-8) |
| `reviewers` | object | Per-dimension verdicts (`approve\|revise\|reject`) |
| `labels` | string[] | Label snapshot from the AI pipeline push |
| `reviewedAt` | string | ISO 8601 timestamp of this review |
| `runId` | string | Pipeline run identifier |
| `history` | array | Previous review snapshots (max 20, newest first) |

**Optional — Traffic Signals (`trafficSignals`):**

Heuristic narrative signals for the Feature detail **Traffic Signals** panel (blockers / warnings / flowing). Produced by `feature-traffic` (`deriveTrafficSignals`) or the offline augment script; **not** fetched separately from Jira.

```json
{
  "trafficSignals": {
    "schemaVersion": "1",
    "generatedAt": "2026-04-29T12:00:00.000Z",
    "source": "derived",
    "blockers": [
      {
        "title": "RHOAIENG-999 — integration epic in backlog",
        "detail": "Integration-related epic is Backlog while the feature is incomplete.",
        "issueKeys": ["RHOAIENG-999"]
      }
    ],
    "warnings": [
      {
        "title": "2 stale in-progress issue(s)",
        "detail": "Issues in In Progress with no update in 7+ days.",
        "issueKeys": []
      }
    ],
    "flowing": [
      {
        "title": "RHOAIENG-100 complete",
        "detail": "\"Foundation API layer\" — epic resolved (Closed).",
        "issueKeys": ["RHOAIENG-100"]
      }
    ]
  }
}
```

**Notes:**

- Each signal item has `title` (short headline), `detail` (one or two sentences), and `issueKeys` (Jira keys cited in the signal; may be empty).
- **`source`**: `"derived"` from embedded epic/issue JSON; editors may set `"edited"` after manual refinement (your pipeline may still overwrite on the next fetch unless you preserve edits out-of-band).
- Traffic **blockers** here are **not** the same as Jira **priority = Blocker** — they reflect backlog/integration risk and explicit **`isBlocked`** links on issues.

## Releases — Execution Config (`data/releases/execution/config.json`)

Admin-configurable settings for GitLab CI artifact fetching and Jira sync.

```json
{
  "gitlabBaseUrl": "https://gitlab.com",
  "projectPath": "redhat/rhel-ai/agentic-ci/feature-traffic",
  "jobName": "fetch-traffic",
  "branch": "main",
  "artifactPath": "output",
  "refreshIntervalHours": 12,
  "enabled": false,
  "jiraEnrichment": {
    "enabled": false
  }
}
```

**Notes:**
- `enabled` defaults to `false`. Module does nothing until an admin enables it in Settings.
- `artifactPath` is the directory prefix stripped from zip entry paths (e.g., `output/index.json` becomes `index.json`).
- `jiraEnrichment.enabled` enables periodic Jira sync of feature data (12h default cadence). The sync fetches all RHAISTRAT features from Jira as the authoritative source.

## Releases — Feature Tracking Config (`data/releases/execution/feature-tracking-config.json`)

Gear settings for the Execute workspace: portfolio version names, per-product Jira fixVersion strings, and optional planning-freeze overrides.

```json
{
  "releases": {
    "3.5.EA1": {
      "products": {
        "rhoai": "rhoai-3.5.EA1",
        "rhelai": "rhelai-3.5.EA1",
        "rhaii": "rhaii-3.5.EA1"
      },
      "planningFreezeOverride": "2026-04-17"
    }
  }
}
```

**Notes:**
- Keys under `releases` are portfolio versions shown as Execute version chips, ordered by planning freeze date (earliest first). User `planningFreezeOverride` wins over Product Pages.
- `products` maps family (`rhoai` / `rhelai` / `rhaii`) to the Jira fixVersion name used for hygiene and execution lookups.
- `planningFreezeOverride` is an optional `YYYY-MM-DD` date; when set it wins over Product Pages.
- Per-version tracking data is cached at `data/releases/execution/tracking-data-<version>.json` (e.g. `tracking-data-3.5.EA1.json`); in demo mode these fixtures back the Execute workspace. Keep the chip versions here aligned with the Schedule-view timeline (`releases/delivery/product-pages-releases-cache.json`) so timeline card deep-links land on a populated Execute pill.

## Releases — Execution Last Enrichment (`data/releases/execution/last-enrichment.json`)

Metadata from the most recent Jira sync.

```json
{
  "status": "success",
  "timestamp": "2026-06-05T08:30:00Z",
  "featureCount": 2400,
  "newCount": 15,
  "updatedCount": 2385,
  "duration": 124500
}
```

**Notes:**
- `featureCount` is the total number of features returned by Jira.
- `newCount` / `updatedCount` track how many features were created vs updated in the store.

## Releases — Execution Last Fetch (`data/releases/execution/last-fetch.json`)

Metadata from the most recent fetch attempt.

```json
{
  "status": "success",
  "timestamp": "2026-04-08T06:00:12Z",
  "duration": 3400,
  "fileCount": 43,
  "warnings": []
}
```

**Notes:**
- `status` is one of: `"success"`, `"error"`, `"artifact_expired"`
- `duration` is in milliseconds
- `warnings` is only present when there were non-fatal issues (e.g., unparseable JSON files)
- On error: `{ "status": "error", "message": "...", "timestamp": "..." }`
- On artifact expiration: `{ "status": "artifact_expired", "message": "...", "timestamp": "..." }`

---

## Release Health Cache — `data/releases/planning/health-cache-{version}-{phase}.json`

Generated by the health pipeline (`runHealthPipeline()`). Version 4 adds FPDoR readiness.

```json
{
  "healthCacheVersion": 4,
  "cachedAt": "2026-06-09T14:30:00.000Z",
  "version": "3.5",
  "releasePhaseMode": "planning",
  "milestones": { "ea1Freeze": "...", "gaFreeze": "..." },
  "summary": {
    "totalFeatures": 45,
    "byRisk": { "green": 30, "yellow": 10, "red": 5 },
    "planningReadiness": {
      "totalChecked": 45,
      "fullyReady": 30,
      "withHardBlockers": 10,
      "withWarnings": 5,
      "byCheck": { "DoR-P1": 40, "DoR-P2": 42, "DoR-P3": 45, "DoR-P4": 35, "DoR-P5": 38 }
    },
    "fpdorReadiness": {
      "fullyPassed": 25,
      "totalFeatures": 45
    }
  },
  "features": [
    {
      "key": "RHOAIENG-1001",
      "planningChecks": {
        "checks": [
          { "id": "DoR-P1", "label": "Components Set", "passed": true, "severity": "hard-blocker", "detail": "Model Serving" }
        ],
        "passedCount": 5,
        "totalCount": 5,
        "hasHardBlockers": false,
        "hardBlockersFailed": []
      },
      "fpdor": {
        "items": [
          { "name": "Requirements Clarity", "pass": null, "source": "jira", "state": "not-checked" },
          { "name": "RICE Score", "pass": true, "source": "jira", "state": "passed" },
          { "name": "Cross-functional Engineering", "pass": true, "source": "jira", "state": "passed" },
          { "name": "Documentation", "pass": true, "source": "jira", "state": "passed" },
          { "name": "UXD", "pass": false, "source": "jira", "state": "failed" }
        ],
        "passedCount": 8,
        "totalCount": 13,
        "evaluatedCount": 13
      }
    }
  ]
}
```

| Field | Type | Added In | Description |
|-------|------|----------|-------------|
| `healthCacheVersion` | number | v1 | Schema version (current: 4) |
| `releasePhaseMode` | `"planning"` / `"execution"` / `"unknown"` | v3 | Derived from `computeMilestoneInfo().currentPhase`. `"planning"` = before GA Freeze. |
| `summary.planningReadiness` | object / null | v3 | Aggregated planning check results. Null when not in planning mode or `enablePlanningChecks` is false. |
| `summary.planningReadiness.byCheck` | object | v3 | Map of check ID to count of features passing that check (e.g., `{ "DoR-P1": 40 }`). |
| `features[].planningChecks` | object / null | v3 | Per-feature planning readiness checks (DoR-P series). Null when checks are disabled or mode is not `"planning"`. |
| `features[].planningChecks.checks[]` | array | v3 | Array of `{ id, label, passed, severity, detail }` objects. All checks have `severity: "hard-blocker"`. |
| `features[].planningChecks.hasHardBlockers` | boolean | v3 | True if any hard-blocker check failed. |
| `features[].planningChecks.hardBlockersFailed` | array | v3 | Subset of `checks` where `severity === "hard-blocker"` and `passed === false`. |
| `summary.fpdorReadiness` | object / null | v4 | Aggregate FPDoR readiness. Null in empty cache. |
| `summary.fpdorReadiness.fullyPassed` | number | v4 | Features where all evaluated FPDoR items passed (`evaluatedCount >= 6`). |
| `summary.fpdorReadiness.totalFeatures` | number | v4 | Total features assessed. |
| `features[].fpdor` | object / null | v4 | Per-feature FPDoR (Feature Planning Definition of Readiness) result. |
| `features[].fpdor.items[]` | array | v4 | Array of 17 `{ name, pass, source, state, detail, group }` objects. `pass`: `true`/`false`/`null`; `source`: `"jira"`; `state`: `"passed"`, `"failed"`, `"not-applicable"` (N/A items count as pass), or `"not-checked"` (legacy; should not appear for current evaluators). |
| `features[].fpdor.passedCount` | number | v4 | Items where `pass === true` (includes N/A items). |
| `features[].fpdor.evaluatedCount` | number | v4 | Items where `pass !== null`. |
| `features[].fpdor.applicableCount` | number | v4 | Always 17 — fixed checklist denominator (same as `totalCount`). |
| `features[].fpdor.totalCount` | number | v4 | Always 17. |

**Planning check IDs:**

| ID | Label | Data Source |
|----|-------|-------------|
| DoR-P1 | Components Set | `feature.components` |
| DoR-P2 | Product Manager Assigned | `feature.pm` |
| DoR-P3 | Release Type Set | `feature.phase` / `feature.releaseType` |
| DoR-P4 | Child Epics Created | `feature.epicCount` (enriched from execution index) |
| DoR-P5 | RFE Linked | `feature.rfe` / `feature.parentKey` |

**Graceful degradation:** If `releasePhaseMode` is missing, treat as `"unknown"` (show execution-mode view). If `planningChecks` is null on a feature, show `"--"` in the planning checks column. If `planningReadiness` is null in summary, hide the planning readiness banner.

---

## Health Metrics — `data/health-metrics/`

### Usage Events — `data/health-metrics/events/YYYY-MM.jsonl`

JSON Lines format (one JSON object per line). Partitioned by month for efficient retention pruning.

```
{"ts":"2026-05-11T15:30:00.000Z","page":"team-tracker::org-dashboard","email":"user@redhat.com","userType":"Backend","roles":["admin"]}
```

| Field | Type | Description |
|-------|------|-------------|
| `ts` | ISO string | Timestamp of the page view |
| `page` | string | `moduleSlug::viewId` composite key |
| `email` | string | User email (for unique-user counting) |
| `userType` | string | Value from configured person field at event time, or `"unknown"` |
| `roles` | string[] | User's roles at event time (e.g., `["admin"]`, `["team-admin"]`, `[]`). Legacy events may have `permissionTier` string instead; the aggregator handles both formats. |

### Monthly Aggregates — `data/health-metrics/aggregates/YYYY-MM.json`

```json
{
  "month": "2026-05",
  "generatedAt": "2026-06-01T06:00:00.000Z",
  "pages": {
    "team-tracker::org-dashboard": {
      "views": 342,
      "uniqueUsers": 28,
      "byUserType": { "Backend": 12, "Frontend": 8, "unknown": 3 },
      "byRole": { "admin": 3, "team-admin": 2, "planning-manager": 5 },
      "byPermissionTier": { "admin": 3, "manager": 10, "user": 15 }
    }
  }
}
```

### Configuration — `data/health-metrics/config.json`

```json
{
  "userTypeFieldId": "field_rq0001",
  "retentionDays": 90
}
```

### Opt-Out List — `data/health-metrics/opted-out.json`

```json
{
  "emails": ["user-who-opted-out@redhat.com"]
}
```

---

## Releases — RHOAI Component Architectures (`data/releases/rhoai-component-architectures/latest.json`)

Multi-architecture build support matrix for RHOAI components across release branches. Fetched from pre-generated `multi-arch-report.yaml` files in the `red-hat-data-services/konflux-central` repo.

```json
{
  "fetchedAt": "2026-08-18T12:00:00.000Z",
  "source": { "owner": "red-hat-data-services", "repo": "konflux-central" },
  "maturity": {
    "available": true,
    "fetchedAt": "2026-08-18T12:00:00.000Z",
    "warning": null,
    "allProductComponents": [
      { "name": "AI Core Dashboard", "owner": null, "team": null },
      { "name": "AI Pipelines", "owner": null, "team": null },
      { "name": "Serving Orchestration", "owner": "jdoe", "team": "Model Serving" }
    ]
  },
  "branches": {
    "rhoai-3.5": {
      "generatedAt": "2026-08-18T10:00:00.000Z",
      "branch": "rhoai-3.5",
      "architectures": ["amd64", "arm64", "ppc64le", "s390x"],
      "components": [
        {
          "name": "odh-dashboard",
          "imageName": "odh-dashboard-rhel9",
          "image": "quay.io/rhoai/odh-dashboard-rhel9",
          "productComponent": "AI Core Dashboard",
          "architectures": {
            "amd64": { "status": "supported" },
            "arm64": { "status": "supported" },
            "ppc64le": { "status": "exception", "issueKey": "RHOAIENG-38736", "issueUrl": "https://issues.redhat.com/browse/RHOAIENG-38736", "reason": "ppc64le enablement" },
            "s390x": { "status": "incompatible", "accelerator": "cuda" }
          }
        }
      ],
      "summary": {
        "totalComponents": 15,
        "fullMultiArch": 7,
        "withExceptions": 4,
        "withIncompatible": 3,
        "withNotBuilt": 1
      }
    }
  }
}
```

**Notes:**
- `fetchedAt` is the ISO timestamp when the data was last fetched from GitHub.
- `source` identifies the GitHub repository containing the report YAML files.
- `branches` is keyed by release branch name (e.g., `rhoai-3.5`). Up to 3 most recent branches are fetched.
- `name` is the display name (RHEL suffix stripped via `stripRhelSuffix()`). `imageName` is the original name including the RHEL suffix.
- `image` is the full Quay.io image reference.
- Architecture status is one of: `"supported"` (built), `"exception"` (tracked Jira), `"incompatible"` (hardware-dependent), `"not_built"` (gap).
- `exception` entries include `issueKey`, `issueUrl`, and `reason`. `incompatible` entries include `accelerator`.
- `productComponent` is the parent product component name from the maturity report (e.g., `"Serving Orchestration"`). `null` when no mapping exists ("unmapped").
- `maturity` contains metadata about the component maturity mapping from `gitlab.cee.redhat.com/data-hub/component-maturity`. `available` indicates whether the mapping was successfully fetched. `allProductComponents` is the complete sorted list of product component objects from the maturity report: `[{ "name": "...", "owner": "..." or null, "team": "..." or null }]`. Owner and team are extracted defensively from the upstream maturity report (null if absent). For backward compatibility, the frontend also accepts string entries and normalizes them to `{ name: entry, owner: null, team: null }`. `warning` is set when the mapping fetch failed or was skipped.
- `summary` provides pre-computed counts per branch for the UI summary cards.

---

## Releases — Hygiene Features (`data/releases/hygiene/features-{version}.json`)

Per-release hygiene compliance data. Generated by the hygiene refresh handler, which fetches features from Jira and evaluates them against enabled hygiene rules.

```json
{
  "fetchedAt": "2026-05-19T06:00:00.000Z",
  "version": "RHOAI 2.14",
  "features": {
    "RHAISTRAT-1045": {
      "key": "RHAISTRAT-1045",
      "summary": "Enable GPU autoscaling for model serving",
      "issueType": "Feature",
      "status": "In Progress",
      "statusCategory": "In Progress",
      "assignee": "Jane Doe",
      "team": "Model Serving",
      "fixVersions": ["RHOAI-2.14"],
      "targetVersions": ["RHOAI-2.14"],
      "targetReleaseId": "rhoai-2.14",
      "fixReleaseId": "rhoai-2.14",
      "effectiveReleaseId": "rhoai-2.14",
      "missingTargetVersion": false,
      "components": ["serving-runtime"],
      "labels": ["GPU-as-a-Service"],
      "releaseType": "GA",
      "statusSummary": "GPU autoscaling feature is progressing well.",
      "colorStatus": "Green",
      "docsRequired": "Yes",
      "targetEnd": "2026-06-15",
      "riceStatus": "complete",
      "riceScore": 42,
      "linkedRfeKey": "RHAIRFE-100",
      "linkedRfeApproved": true,
      "statusEnteredAt": "2026-04-15T10:00:00.000Z",
      "statusSummaryUpdated": "2026-05-10T10:00:00.000Z",
      "violations": [
        {
          "id": "missing-color-status",
          "name": "Missing Color Status",
          "category": "metadata",
          "message": "This issue is in In Progress but has no color status set.",
          "remediation": "Open the issue in Jira and set the Color Status field."
        }
      ]
    }
  }
}
```

**Notes:**
- `features` is keyed by Jira issue key (not an array)
- `team` may be `null` when unassigned; `components` may be `[]`
- `assignee` is a display name string or `null`
- `violations` is an array of rule violations found by `evaluateHygiene()`. Empty array `[]` when the feature passes all rules
- Each violation has: `id` (rule identifier, e.g. `"missing-assignee"`), `name` (human label), `category` (`"ownership"`, `"timeliness"`, `"metadata"`, or `"lifecycle"`), `message` (contextual sentence), `remediation` (action guidance)
- **Version fields:** `fixVersions` is the delivery commitment (engineering); `targetVersions` is the original ask (PM). `targetReleaseId` / `fixReleaseId` resolve those Jira version names to registry release ids; `effectiveReleaseId` is the single release the feature is stored under — **Fix Version wins over Target Version** when it resolves to an active release, otherwise Target Version is used as a fallback. A feature is stored under exactly one release file (its `effectiveReleaseId`).
- `missingTargetVersion` is `true` when a Feature/Initiative has a Fix Version but no Target Version (drives the `missing-target-version` rule). When both are set but resolve to different releases in a later phase (In Progress/Review/Testing/Release Pending/Resolved/Closed), the `target-fix-version-mismatch` rule fires.
- `statusEnteredAt` and `statusSummaryUpdated` are ISO 8601 timestamps used by timeliness rules
- `linkedRfeApproved` is `true` only when the feature has a `clones` link to an RFE in Approved status
- File path uses the version display name (may contain spaces, e.g. `features-RHOAI 2.14.json`)

## Releases — Release Readiness (`data/releases/release-readiness/{version}.json`)

Pre-generated release readiness metrics served (and versioned) by
`modules/releases/server/release-readiness/routes.js`, which only reads/writes
this file — the payload itself is produced outside this repo by the external
`fetch_release_metrics.py` script and pushed via its `POST /upload` endpoint.
Rendered by `modules/releases/client/reports/ReleaseReadinessDirector.vue`.

```json
{
  "version": "rhoai-3.5.EA2",
  "generated_at": "2026-07-01T10:00:00Z",
  "director_summary": {
    "gate_statuses": [
      { "gate": "Test Execution", "done": 23, "total": 24, "pct": 96, "rag": "GREEN", "initiative_key": "RHOAIENG-68791" }
    ],
    "test_timeline": [
      {
        "epic_key": "RHOAIENG-70001",
        "name": "Nightly",
        "done": 12,
        "total": 12,
        "pct": 100,
        "rag": "GREEN"
      }
    ]
  },
  "breakdowns": {
    "RHOAIENG-68791": {
      "test_execution": {
        "phases": [
          {
            "epic_key": "RHOAIENG-70001",
            "tasks": [
              { "key": "RHOAIENG-70101", "summary": "Nightly smoke tests", "status": "Done", "status_category": "Done", "resolution": "Done" }
            ]
          }
        ]
      }
    }
  }
}
```

**Notes:**
- `test_timeline` entries are the Epics shown as accordion rows in the "Test Execution Phases" section; `breakdowns.*.test_execution.phases[*].tasks` are the child tasks shown when a row is expanded. `test_timeline` rows only render a generic `Done`/`Active`/`Pending` badge derived from `rag` — Resolution is only surfaced for the child tasks, not the Epic itself.
- Task objects carry the Jira `status`/`status_category` and `resolution` (same semantics as `resolution` in [Person Metrics](#person-metrics--datapeoplenamejson): the raw Jira resolution name, or `null`/absent while unresolved).
- The UI renders a task's label as `<Status> - <Resolution>` (e.g. `"Done - Won't Do"`) whenever `resolution` is set, falling back to just `<Status>` otherwise; `resolution` is optional — older payloads without it still render using `status` alone.
- No-work resolutions (`"Won't Do"`, `"Can't Do"`, `"Obsolete"`, `"Duplicate"`, `"Cannot Reproduce"`) are rendered in a muted/gray style instead of green, even when `status_category` is `"Done"`, since the work itself wasn't completed.

## System Health — Disconnected Readiness Reports (`data/system-health/disconnected/reports.json`)

Disconnected readiness reports tracking repository readiness scores for disconnected environments. Generated by the disconnected readiness scheduler.

```json
{
  "lastSyncedAt": "2026-06-09T14:30:00.000Z",
  "repoCount": 6,
  "repos": {
    "opendatahub-io/odh-dashboard": {
      "latest": {
        "repo": "opendatahub-io/odh-dashboard",
        "date": "2026-06-09T12:00:00.000Z",
        "score": "READY",
        "blockerCount": 0,
        "infoCount": 2,
        "ruleCount": 5,
        "rulesPassedCount": 5,
        "rules": [
          {
            "name": "image-manifest-complete",
            "passed": true,
            "blockers": 0,
            "infos": 1,
            "findings": [
              {
                "severity": "info",
                "file": "manifests/overlays/odh/params.env",
                "line": 5,
                "image": "quay.io/opendatahub/odh-dashboard",
                "message": "Image listed in RelatedImages manifest"
              }
            ]
          }
        ],
        "false_positive_help": null
      },
      "history": [
        {
          "score": "READY",
          "blockerCount": 0,
          "infoCount": 1,
          "ruleCount": 5,
          "rulesPassedCount": 5,
          "date": "2026-06-08T10:00:00.000Z"
        }
      ]
    }
  }
}
```

**Top-level fields:**
- `lastSyncedAt`: ISO timestamp when reports were last generated
- `repoCount`: Total number of repositories tracked
- `repos`: Object mapping repository keys (org/name format) to report data

**Per-repository structure:**
- `latest`: Most recent readiness assessment containing full rule breakdown
- `history`: Array of historical assessments (summary data only, sorted newest-first)

**Latest assessment fields:**
- `repo`: Repository identifier (org/name format)
- `date`: ISO timestamp when assessment was performed
- `score`: Overall readiness score (`"READY"` or `"NOT READY"`)
- `blockerCount`: Number of failing rules with blocker-severity findings
- `infoCount`: Number of informational findings across all rules
- `ruleCount`: Total number of rules evaluated
- `rulesPassedCount`: Number of rules that passed
- `rules`: Array of detailed rule results with findings
- `false_positive_help`: Exception configuration suggestions (null if no help available)

**Rule structure:**
- `name`: Rule identifier (e.g., `"image-manifest-complete"`)
- `passed`: Boolean indicating if rule passed overall
- `blockers`: Number of blocker-severity findings for this rule
- `infos`: Number of info-severity findings for this rule
- `findings`: Array of individual rule violations/notes

**Finding structure:**
- `severity`: Finding severity (`"blocker"` or `"info"`)
- `file`: Source file where finding was detected
- `line`: Line number in source file
- `image`: Container image reference (empty string if not image-related)
- `message`: Human-readable description of the finding

**History entry fields:**
- `score`: Overall readiness score
- `blockerCount`: Number of blocker findings
- `infoCount`: Number of info findings  
- `ruleCount`: Total rules evaluated
- `rulesPassedCount`: Rules that passed
- `date`: Assessment timestamp

## System Health — E2E Health Data (`data/system-health/odh-e2e-health.json`)

E2E (end-to-end) test health data for the opendatahub-operator repository. Contains recent test runs, component failure statistics, and historical trends. Updated hourly by the E2E health scheduler.

```json
{
  "lastSyncedAt": "2026-08-11T14:30:00.000Z",
  "repository": "opendatahub-io/opendatahub-operator",
  "suites": {
    "odh": {
      "name": "OpenDataHub E2E",
      "suite": "odh", 
      "dailyStatus": {
        "status": "healthy",
        "color": "green",
        "class": "text-green-600 dark:text-green-400",
        "bgClass": "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
        "label": "Healthy"
      },
      "totalJobs": 42,
      "passedJobs": 38,
      "rollingWindow": "14d",
      "lastUpdated": "2026-08-11T14:30:00.000Z",
      "suiteStatus": "passing",
      "successRate": 0.9,
      "repository": "opendatahub-io/opendatahub-operator"
    },
    "rhoai": {
      "name": "RHOAI E2E",
      "suite": "rhoai",
      "dailyStatus": {
        "status": "degraded",
        "color": "orange", 
        "class": "text-orange-600 dark:text-orange-400",
        "bgClass": "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
        "label": "Degraded"
      },
      "totalJobs": 25,
      "passedJobs": 18,
      "rollingWindow": "14d",
      "lastUpdated": "2026-08-11T14:30:00.000Z",
      "suiteStatus": "failing",
      "successRate": 0.72,
      "repository": "opendatahub-io/opendatahub-operator"
    }
  },
  "summary": {
    "totalRuns": 120,
    "passRate": 0.85,
    "avgResolutionTime": "4h 30m",
    "trendDirection": "improving"
  },
  "recentRuns": [
    {
      "buildId": "1723387200123",
      "jobName": "periodic-ci-opendatahub-io-opendatahub-operator-main-odh-e2e", 
      "suite": "odh",
      "status": "passed",
      "timestamp": "2026-08-11T12:00:00.000Z",
      "prNumber": null,
      "prowUrl": "https://prow.ci.openshift.org/view/gs/origin-ci-test/logs/periodic-ci-opendatahub-io-opendatahub-operator-main-odh-e2e/1723387200123",
      "failedComponents": [],
      "runDuration": 1800
    }
  ],
  "accumulatedRuns": [],
  "componentStats": {
    "dashboard": {
      "totalRuns": 120,
      "failures": 8,
      "lastFailure": "2026-08-10T16:30:00.000Z",
      "affectedSuites": ["odh", "rhoai"],
      "failureRate": 0.067,
      "consecutiveFailures": 0,
      "classification": "ui",
      "impact": {
        "score": 65,
        "level": "medium"
      },
      "trends": {
        "direction": "stable"
      },
      "displayName": "Dashboard",
      "testSuites": ["odh", "rhoai"]
    }
  },
  "currentlyBlocking": ["kserve"],
  "assessedAt": "2026-08-11T14:30:00.000Z",
  "dataSource": "prowjobs-api-incremental",
  "datasetMetadata": {
    "accumulatedRunsCount": 120,
    "recentRunsCount": 15,
    "dataRetentionDays": 30,
    "oldestRunDate": "2026-07-12T14:30:00.000Z", 
    "newestRunDate": "2026-08-11T14:30:00.000Z"
  },
  "historical_trends": {
    "daily_status": [
      {
        "date": "2026-08-11",
        "odh": {
          "status": "healthy",
          "passRate": 0.9,
          "totalJobs": 42,
          "passedJobs": 38
        },
        "rhoai": {
          "status": "degraded", 
          "passRate": 0.72,
          "totalJobs": 25,
          "passedJobs": 18
        }
      }
    ],
    "last_updated": "2026-08-11T14:30:00.000Z"
  }
}
```

**Top-level fields:**
- `lastSyncedAt`: ISO timestamp of the last data refresh
- `repository`: Target repository being monitored
- `suites`: Test suite health summary (keyed by suite name: `odh`, `rhoai`)
- `summary`: Overall E2E health metrics across all suites
- `recentRuns`: Latest test runs from the current API fetch (~48 hours of data)
- `accumulatedRuns`: Full dataset of test runs (30-day retention for historical analysis)
- `componentStats`: Component failure statistics and analysis
- `currentlyBlocking`: Components currently causing test failures
- `assessedAt`: ISO timestamp when the assessment was performed
- `dataSource`: Data source identifier (e.g., `prowjobs-api-incremental`)
- `datasetMetadata`: Metadata about the accumulated dataset
- `historical_trends`: Daily status trends for charting (30-day retention)

**Suite health fields:**
- `dailyStatus.status`: Overall suite health (`healthy`, `stable`, `degraded`, `failing`, `broken`)
- `dailyStatus.color`: Color indicator (`green`, `orange`, `red`)
- `dailyStatus.class`/`bgClass`: Tailwind CSS classes for styling
- `successRate`: Pass rate (0.0 to 1.0) for the rolling window
- `suiteStatus`: Legacy status field (`passing` or `failing`)

**Test run fields:**
- `buildId`: Unique identifier for the test run
- `jobName`: Prow CI job name  
- `suite`: Test suite name (`odh` or `rhoai`)
- `status`: Test result (`passed`, `failed`, `pending`, `triggered`)
- `timestamp`: ISO timestamp when the test ran
- `prNumber`: Pull request number if applicable, or `null`
- `prowUrl`: Link to the Prow CI job details
- `failedComponents`: Array of component names that failed in this run
- `runDuration`: Test execution time in seconds

**Component statistics fields:**
- `totalRuns`: Total number of test runs analyzed
- `failures`: Number of runs where this component failed
- `failureRate`: Failure rate (0.0 to 1.0)
- `consecutiveFailures`: Number of consecutive recent failures
- `lastFailure`: ISO timestamp of the most recent failure
- `affectedSuites`: Array of suite names where this component has failed
- `classification`: Component type classification (e.g., `ui`, `api`, `backend`)
- `impact.score`: Numeric impact score (0-100)
- `impact.level`: Impact level (`low`, `medium`, `high`)
- `trends.direction`: Trend direction (`improving`, `stable`, `worsening`)

**Historical trends fields:**
- `daily_status`: Array of daily status snapshots, sorted newest-first
- `date`: Date in YYYY-MM-DD format
- Per-suite status includes: `status`, `passRate`, `totalJobs`, `passedJobs`
- `last_updated`: ISO timestamp when trends were last calculated

**Notes:**
- Data is updated hourly by the E2E health scheduler
- Recent runs contain ~48 hours of data for operational visibility
- Accumulated runs contain up to 30 days of data for trend analysis
- Pending/triggered tests are filtered out during storage
- Component statistics use 30-day accumulated data for accurate failure rates
- Daily status thresholds: 100% = healthy, ≥70% = stable, ≥50% = degraded, ≥20% = failing, <20% = broken

## System Health — E2E Blocker JIRAs (`data/system-health/odh-e2e-blocker-jiras.json`)

Snapshot of the currently-open Jira blocker bugs auto-filed by the
opendatahub-operator `e2e-failure-triage` automation. The automation labels every
bug it creates with `odh-operator-auto-e2e-blocker` (in project `RHOAIENG`) and
links it to the template issue `RHOAIENG-79740`. The `odh-e2e-blocker-jiras`
refresh handler queries Jira for open (`resolution = Unresolved`) issues carrying
that label and writes a full snapshot.

```json
{
  "lastSyncedAt": "2026-08-11T10:00:00.000Z",
  "available": true,
  "count": 3,
  "jql": "project = RHOAIENG AND labels = \"odh-operator-auto-e2e-blocker\" AND resolution = Unresolved ORDER BY created DESC",
  "jqlUrl": "https://redhat.atlassian.net/issues/?jql=...",
  "templateIssue": "RHOAIENG-79740",
  "issues": [
    {
      "key": "RHOAIENG-81234",
      "summary": "[Auto] E2E blocker: dashboard tests failing",
      "status": "New",
      "priority": "Blocker",
      "component": "Dashboard",
      "affectsVersions": ["2.20 GA RHOAI RELEASE"],
      "assignee": null,
      "created": "2026-08-10T14:22:00.000Z",
      "updated": "2026-08-11T08:15:00.000Z",
      "url": "https://redhat.atlassian.net/browse/RHOAIENG-81234"
    }
  ]
}
```

**Top-level fields:**
- `lastSyncedAt`: ISO timestamp of the last successful fetch (may be preserved from a prior run on a failed refresh)
- `available`: `false` when Jira credentials are missing or a fetch failed; `true` otherwise
- `reason`: present when `available` is false (`missing-credentials`, `fetch-error`, or `no_data`)
- `count`: number of open blocker issues
- `jql` / `jqlUrl`: the JQL used and a deep link to view the issues in Jira
- `templateIssue`: the clone template key (`RHOAIENG-79740`)
- `issues`: array of open blocker issues (see per-issue fields below)

**Per-issue fields:** `key`, `summary`, `status`, `priority`, `component` (comma-joined), `affectsVersions` (array), `assignee` (display name or null), `created`, `updated`, `url`.

**Notes:**
- Refreshed hourly by the `odh-e2e-blocker-jiras` handler. Requires the `jira` platform secret group (`JIRA_EMAIL` / `JIRA_TOKEN`).
- **Snapshot semantics:** each successful run fully overwrites the file with the current open set — no merge/accumulate — so JIRAs resolved/closed since the last run are evicted automatically.
- On a transient fetch failure the previous `issues` are preserved and `available` is set to `false` (the dashboard keeps showing last-known-good data). Missing credentials writes an empty list.

## System Health — Quality Reports (`data/system-health/quality/reports.json`)

Quality analysis reports tracking repository testing, CI/CD, and code quality practices across 8 dimensions. Reports are pushed from the quality-repo-analysis CI pipeline via the bulk API, or pulled from GitLab CI artifacts.

```json
{
  "lastSyncedAt": "2026-07-28T10:30:00.000Z",
  "totalReports": 5,
  "reports": {
    "kserve--kserve": {
      "latest": {
        "repository": "kserve/kserve",
        "overallScore": 7.4,
        "scorecard": [
          { "dimension": "Unit Tests", "score": 8.0, "status": "Comprehensive pytest suite with 800+ tests" },
          { "dimension": "Integration/E2E", "score": 7.5, "status": "E2E tests via KServe test framework" },
          { "dimension": "Build Integration", "score": 8.0, "status": "Multi-stage Docker builds with CI" },
          { "dimension": "Image Testing", "score": 6.0, "status": "Basic container smoke tests" },
          { "dimension": "Coverage Tracking", "score": 5.0, "status": "No coverage enforcement or PR gates" },
          { "dimension": "CI/CD Automation", "score": 9.0, "status": "GitHub Actions with matrix builds" },
          { "dimension": "Static Analysis", "score": 8.0, "status": "golangci-lint, mypy, ruff" },
          { "dimension": "Agent Rules", "score": 7.5, "status": "Basic CLAUDE.md with project conventions" }
        ],
        "criticalGaps": [
          { "title": "No coverage enforcement", "impact": "Regression risk", "severity": "HIGH", "effort": "4-8 hours" }
        ],
        "quickWins": [
          { "title": "Add Codecov integration", "effort": "2-3 hours", "impact": "Immediate coverage visibility" }
        ],
        "tier": "upstream",
        "component": "Model Serving",
        "team": "",
        "githubUrl": "https://github.com/kserve/kserve",
        "hasHtmlReport": false,
        "assessedAt": "2026-07-28T10:00:00.000Z"
      },
      "history": [
        { "overallScore": 6.8, "gapCount": 3, "assessedAt": "2026-07-21T10:00:00.000Z" }
      ]
    }
  }
}
```

**Top-level fields:**
- `lastSyncedAt`: ISO timestamp when reports were last synced (push or pull)
- `totalReports`: Total number of repositories with reports
- `reports`: Object mapping repo keys (`owner--repo` format, `--` separator) to report data

**Repo key format:** `owner--repo` (double-dash separator). Generated from `repository` field (`owner/repo` → `owner--repo`) or provided as `id` in the bulk payload. Must match `/^[a-zA-Z0-9._-]+--[a-zA-Z0-9._-]+$/`.

**Per-repository structure:**
- `latest`: Most recent quality assessment with full scorecard
- `history`: Array of prior assessments (summary only, sorted newest-first, capped at 52)

**Latest assessment fields:**
- `repository`: Repository identifier in `owner/repo` format
- `overallScore`: Weighted average score (0-10, one decimal)
- `scorecard`: Array of 8 dimension scores (see dimensions below)
- `criticalGaps`: Array of identified quality gaps with severity
- `quickWins`: Array of low-effort improvement suggestions
- `tier`: Repository tier (`"upstream"`, `"midstream"`, or `"downstream"`), or `null`
- `component`: RHOAI component name, or `null`
- `team`: Team name, or `null`/empty string
- `githubUrl`: Repository URL, or `null`
- `hasHtmlReport`: Boolean, true when an HTML report is stored
- `assessedAt`: ISO timestamp of the assessment

**Scorecard dimensions (8):**
`Unit Tests`, `Integration/E2E`, `Build Integration`, `Image Testing`, `Coverage Tracking`, `CI/CD Automation`, `Static Analysis`, `Agent Rules`

Each entry has: `dimension` (name), `score` (0-10), `status` (human-readable summary).

**Critical gap fields:**
- `title`: Short description of the gap
- `impact`: Expected consequence
- `severity`: `"HIGH"`, `"MEDIUM"`, or `"LOW"`
- `effort`: Estimated remediation effort

**Quick win fields:**
- `title`: Short description
- `effort`: Estimated effort
- `impact`: Expected benefit

**History entry fields:**
- `overallScore`: Score at time of assessment
- `gapCount`: Number of critical gaps at time of assessment
- `assessedAt`: Assessment timestamp

**HTML reports:** Stored separately at `system-health/quality/html/{owner--repo}.html`. Served via `GET /api/modules/system-health/quality/reports/{key}/html`.

**API:**

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/modules/system-health/quality/reports` | `system-health:read` | List all reports (slim projection) |
| `GET` | `/api/modules/system-health/quality/reports/{key}` | `system-health:read` | Full report with history |
| `GET` | `/api/modules/system-health/quality/reports/{key}/html` | `system-health:read` | HTML report |
| `POST` | `/api/modules/system-health/quality/reports/bulk` | admin, `system-health:write` | Bulk upsert from CI pipeline |
| `DELETE` | `/api/modules/system-health/quality/reports` | admin, `system-health:write` | Clear all data |
| `GET` | `/api/modules/system-health/quality/reports/status` | admin, `system-health:read` | Data freshness info |
| `GET` | `/api/modules/system-health/quality/config` | admin, `system-health:read` | GitLab fetch config |
| `POST` | `/api/modules/system-health/quality/config` | admin, `system-health:write` | Update GitLab fetch config |
| `POST` | `/api/modules/system-health/quality/refresh` | admin, `system-health:write` | Trigger manual fetch |

---

## AI Catalyst Showcase Data — `data/ai-catalyst/showcase/showcase-data.json`

Synced from a Google Sheet via the ai-catalyst module (showcase feature). Contains all showcase entries and strategy pillar definitions.

```json
{
  "fetchedAt": "2026-06-22T10:00:00Z",
  "pillars": [
    {
      "pillarKey": "model-inference",
      "title": "Model Inference",
      "summary": "Scalable serving of AI/ML models in production",
      "sortOrder": 1,
      "visualUrl": ""
    }
  ],
  "entries": [
    {
      "slug": "vllm-serving",
      "title": "vLLM Model Serving",
      "status": "active",
      "sortOrder": 1,
      "shortSummary": "High-performance LLM inference serving.",
      "customerProblem": "Problem statement text.",
      "solutionSummary": "Solution description text.",
      "capabilityTags": ["model-serving", "gpu-optimization"],
      "customerNeedTags": ["low-latency-inference"],
      "strategyPillarKey": "model-inference",
      "lineage": "pure-open-source",
      "openshiftStory": "",
      "openSourceStory": "Upstream contribution details.",
      "ubiStory": "",
      "demoVideoUrl": "https://youtube.com/watch?v=...",
      "posterImageUrl": "",
      "githubUrl": "https://github.com/org/repo",
      "quayUrl": "",
      "blogUrl": "",
      "orgPulseUrl": "",
      "otherResourceUrls": "",
      "mermaidSource": "flowchart LR\n  A --> B",
      "searchKeywords": ["vllm", "inference"],
      "knownGoodWith": ["RHEL AI"],
      "salesNotes": "Sales positioning notes."
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `fetchedAt` | ISO string | Timestamp of last successful sync |
| `pillars[].pillarKey` | string | Unique identifier (e.g., `model-inference`, `agentic-ai`) |
| `pillars[].sortOrder` | number | Display order |
| `pillars[].visualUrl` | string | Optional banner image URL |
| `entries[].slug` | string | URL-safe unique identifier |
| `entries[].status` | string | `active`, `draft`, or `archived` |
| `entries[].sortOrder` | number | Display order |
| `entries[].strategyPillarKey` | string | References `pillars[].pillarKey` |
| `entries[].lineage` | string | `pure-open-source`, `openshift-oriented`, or `both` |
| `entries[].capabilityTags` | string[] | Technical capability tags (pipe-delimited in sheet) |
| `entries[].customerNeedTags` | string[] | Customer need tags (pipe-delimited in sheet) |
| `entries[].searchKeywords` | string[] | Additional search terms (pipe-delimited in sheet) |
| `entries[].knownGoodWith` | string[] | Compatible products (pipe-delimited in sheet) |
| `entries[].githubUrl` | string | Pipe-separated GitHub repo URLs |
| `entries[].quayUrl` | string | Pipe-separated Quay repo URLs |
| `entries[].otherResourceUrls` | string | Pipe-separated misc resource URLs |
| `entries[].mermaidSource` | string | Mermaid diagram source (rendered on detail page) |

---

## OKR Hub — Feature Delivery Accuracy

### Config: `okr-hub/feature-delivery-config.json`

```json
{
  "releases": [
    {
      "name": "Release 3.4",
      "products": [
        { "version": "rhoai-3.4", "freezeDate": "2026-03-01", "releaseDate": "2026-05-14" },
        { "version": "rhelai-3.4", "freezeDate": "2026-02-15", "releaseDate": "2026-03-19" },
        { "version": "rhaii-3.4", "freezeDate": "2026-02-15", "releaseDate": "2026-03-19" }
      ]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `releases[].name` | string | Display name for the release group |
| `releases[].products[].version` | string | Jira version name used in Target Version and Fix Version queries |
| `releases[].products[].freezeDate` | ISO date string | Planning freeze cutoff date for committed feature count |
| `releases[].products[].releaseDate` | ISO date string | GA date for the product version |

### Response: `GET /api/modules/okr-hub/reports/feature-delivery`

```json
{
  "releases": [
    {
      "name": "Release 3.4",
      "products": [
        { "version": "rhoai-3.4", "freezeDate": "2026-03-01", "releaseDate": "2026-05-14", "committed": 42, "delivered": 38, "accuracy": 90 }
      ],
      "committed": 42,
      "delivered": 38,
      "accuracy": 90
    }
  ],
  "summary": { "committed": 42, "delivered": 38, "accuracy": 90 }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `releases[].products[].committed` | number | Feature count with Target Version set before freeze date |
| `releases[].products[].delivered` | number | Feature count with Fix Version set to this version |
| `releases[].products[].accuracy` | number | `round(delivered / committed * 100)`, 0 if committed is 0 |
| `summary.committed` | number | Total committed across all releases |
| `summary.delivered` | number | Total delivered across all releases |
| `summary.accuracy` | number | Overall accuracy percentage |

---

## Releases — Release Readiness (`data/releases/release-readiness/{version}.json`)

Produced by `fetch_release_metrics.py` in `rhods-qe-tools`. Pushed to the app
via `POST /api/modules/releases/release-readiness/upload`. Keyed by sanitized
version string (spaces and special chars replaced with `_`).

```json
{
  "version": "rhoai-3.5.EA2",
  "generated_at": "2026-07-01T10:00:00Z",
  "summary": { "total_work": 120, "work_done": 96, "work_in_progress": 15, "work_remaining": 9, "progress_pct": 80 },
  "director_summary": {
    "overall_pct": 75,
    "gate_statuses": [
      { "gate": "Product Sign Off", "done": 8, "total": 10, "pct": 80, "rag": "AMBER" }
    ],
    "test_timeline": [
      { "epic_key": "RHOAIENG-70001", "name": "Nightly", "done": 12, "total": 12, "pct": 100, "rag": "GREEN" }
    ]
  },
  "component_readiness": { "all_components": ["TestOps"], "phases": [] },
  "product_blockers": { "total_open": 2, "components": [], "jql_url": "..." },
  "open_issues_to_validate": { "total": 5, "jql_url": "..." },
  "tfa_signoff_done": 18,
  "tfa_signoff_total": 21,
  "tfa_signoff_jql_url": "...",
  "version_variants": ["rhoai-3.5.EA2", "3.5 EA2 RHOAI RELEASE"],
  "release_schedule": {
    "version": "rhoai-3.5.EA2",
    "ga_date": "2026-05-01",
    "code_freeze_date": "2026-02-24",
    "rc1_build_date": "2026-03-03",
    "rc2_build_date": "2026-03-17",
    "status": "Upcoming",
    "pp_url": "..."
  },
  "release_cycle_metrics": {
    "code_freeze_date": "2026-02-24",
    "phases": [
      {
        "phase": "RC1 Builds Testing",
        "epic_key": "RHOAIENG-68791",
        "build_ready_date": "2026-03-03",
        "days_since_code_freeze": 5,
        "test_started_date": "2026-03-04",
        "days_to_test_started": 1,
        "test_finished_date": "2026-03-13",
        "days_to_test_finished": 8,
        "tfas_passed_date": "2026-03-05",
        "days_to_tfas_passed": 2,
        "tfas_triaged_date": "2026-03-11",
        "days_to_tfas_triaged": 6,
        "blockers_resolved_date": "2026-03-12",
        "days_to_blockers_resolved": 7
      },
      {
        "phase": "RC2 Builds Testing",
        "epic_key": "RHOAIENG-68813",
        "build_ready_date": "2026-03-17",
        "days_since_code_freeze": 15,
        "test_started_date": "2026-03-18",
        "days_to_test_started": 1,
        "test_finished_date": null,
        "days_to_test_finished": null,
        "tfas_passed_date": "2026-03-19",
        "days_to_tfas_passed": 2,
        "tfas_triaged_date": null,
        "days_to_tfas_triaged": null,
        "blockers_resolved_date": null,
        "days_to_blockers_resolved": null
      }
    ]
  },
  "breakdowns": {}
}
```

| Field | Type | Description |
|-------|------|-------------|
| `release_cycle_metrics.code_freeze_date` | `string \| null` | `YYYY-MM-DD` from Product Pages |
| `release_cycle_metrics.phases[].phase` | `string` | Test-phase Epic summary from Jira (e.g. `"RC1 Builds Testing"`, `"Nightly Build Wk2 - Jun 22"`) |
| `release_cycle_metrics.phases[].epic_key` | `string` | Jira Epic key (e.g. `"RHOAIENG-68791"`) |
| `release_cycle_metrics.phases[].build_ready_date` | `string \| null` | `YYYY-MM-DD`; source: manual override, PP schedule task matching the RC label, or Jira epic Done date |
| `release_cycle_metrics.phases[].days_since_code_freeze` | `number \| null` | Working days (Mon–Fri) between `code_freeze_date` and `build_ready_date`; `null` if either is unknown |
| `release_cycle_metrics.phases[].test_started_date` | `string \| null` | Jira test-phase epic first became active (proxy: `updated` timestamp) |
| `release_cycle_metrics.phases[].days_to_test_started` | `number \| null` | Working days from `build_ready_date` to `test_started_date` |
| `release_cycle_metrics.phases[].test_finished_date` | `string \| null` | Jira test-phase epic Done (`resolutiondate` or `updated`) |
| `release_cycle_metrics.phases[].days_to_test_finished` | `number \| null` | Working days from `build_ready_date` to `test_finished_date` |
| `release_cycle_metrics.phases[].tfas_passed_date` | `string \| null` | Max `updated` among TFA tasks when ALL reached In Progress or Done; `null` if any still New |
| `release_cycle_metrics.phases[].days_to_tfas_passed` | `number \| null` | Working days from `build_ready_date` to `tfas_passed_date` |
| `release_cycle_metrics.phases[].tfas_triaged_date` | `string \| null` | Max `updated` among TFA tasks when ALL reached Done; `null` if any not Done |
| `release_cycle_metrics.phases[].days_to_tfas_triaged` | `number \| null` | Working days from `build_ready_date` to `tfas_triaged_date` |
| `release_cycle_metrics.phases[].blockers_resolved_date` | `string \| null` | Max `resolutiondate` across all resolved blockers; `null` if any open blockers remain |
| `release_cycle_metrics.phases[].days_to_blockers_resolved` | `number \| null` | Working days from `build_ready_date` to `blockers_resolved_date` |
| `release_schedule.rc1_build_date` | `string \| null` | New field added to `release_schedule`; PP schedule task date for RC1 build milestone |
| `release_schedule.rc2_build_date` | `string \| null` | PP schedule task date for RC2 build milestone |

**Notes:**
- All day counts use Mon–Fri only (no public holidays excluded).
- Dates are proxies from Jira `updated` timestamps; they represent when Jira recorded the transition, not the exact moment it occurred.
- The TFA and blocker dates are release-level (not per-RC); the same date appears in each phase with different `days_to_*` values.
- `null` means the milestone has not occurred or data is unavailable; the dashboard renders `—` for null.

---

## Fixture Rules

The `fixtures/` directory provides read-only demo data used when `DEMO_MODE=true`. These rules prevent data format drift:

1. **Fixtures must match production JSON structure.** When the backend changes how it writes a data file, update the corresponding fixture to use the same shape.
2. **Test mocks should match production format.** Unit test mock data (e.g., in `__tests__/`) should use the production JSON structure as the primary format. Add separate backward-compatibility tests if old formats need to be supported.
3. **Verify against real data.** If you're unsure of a data file's format, check the actual files in `data/` (symlinked from the main worktree) rather than trusting fixtures alone.
