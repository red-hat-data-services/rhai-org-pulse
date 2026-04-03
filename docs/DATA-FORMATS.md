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
      "username": "username"
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

## Roster Sync Config — `data/roster-sync-config.json`

Stores the configuration for automated roster building. Managed via the Settings UI and the `POST /api/admin/roster-sync/config` endpoint.

```json
{
  "orgRoots": [
    { "uid": "jsmith", "displayName": "Jane Smith" }
  ],
  "googleSheetId": "1ABCdef...",
  "sheetNames": ["Sheet1", "Sheet2"],
  "githubOrgs": ["my-org"],
  "gitlabGroups": ["my-group"],
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
  "lastSyncAt": "2026-03-27T06:00:00.000Z",
  "lastSyncStatus": "success",
  "lastSyncError": null
}
```

**Notes:**
- `orgRoots` is required (at least one). Each entry needs `uid` and `displayName`.
- `googleSheetId`, `sheetNames`, `githubOrgs`, `gitlabGroups` are optional (default to `null` or `[]`).
- `teamStructure` replaces legacy `fieldMapping`/`customFields` via an in-memory migration on load.
- `customFields` supports up to 20 entries. At most one can have `primaryDisplay: true`.
- `lastSyncAt`, `lastSyncStatus`, `lastSyncError` are auto-populated during sync runs.

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

## Roster — `data/org-roster-full.json`

Large file containing the full org/team hierarchy with members. See `shared/server/roster-sync/` for the code that builds it.

## Allowlist — `data/allowlist.json`

```json
["user1@example.com", "user2@example.com"]
```

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
- `linkedFeature` is resolved from Jira issue links (type = "Cloners", outward to RHAISTRAT project). Can be `null` if no link exists.
- `labels` is the raw Jira label array, preserved for reference

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

## Release Analysis — Config (`data/release-analysis/config.json`)

Admin-configurable settings for the Release Analysis module.

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
- `expiresAt` is `null` for non-expiring tokens.
- `lastUsedAt` is `null` until first use, then updated (throttled to once per 60 seconds).

---

## Fixture Rules

The `fixtures/` directory provides read-only demo data used when `DEMO_MODE=true`. These rules prevent data format drift:

1. **Fixtures must match production JSON structure.** When the backend changes how it writes a data file, update the corresponding fixture to use the same shape.
2. **Test mocks should match production format.** Unit test mock data (e.g., in `__tests__/`) should use the production JSON structure as the primary format. Add separate backward-compatibility tests if old formats need to be supported.
3. **Verify against real data.** If you're unsure of a data file's format, check the actual files in `data/` (symlinked from the main worktree) rather than trusting fixtures alone.
