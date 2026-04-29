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
  "titlePrefix": "AI Engineering"
}
```

**Notes:**
- `titlePrefix` is a string (max 100 characters). When non-empty, it's shown as a subtitle in the sidebar and prepended to the page title.
- If this file doesn't exist, `titlePrefix` defaults to `""` (empty string).

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
  "gracePeriodDays": 30,
  "autoSync": { "enabled": false, "intervalHours": 24 },
  "lastSyncAt": "2026-03-27T06:00:00.000Z",
  "lastSyncStatus": "success",
  "lastSyncError": null,
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
      "github": { "username": "janesmith", "source": "ldap" },
      "gitlab": { "username": "janesmith", "source": "ldap" },
      "status": "active",
      "firstSeenAt": "2026-01-01T00:00:00.000Z",
      "lastSeenAt": "2026-03-27T06:00:00.000Z",
      "inactiveSince": null,
      "jiraTeam": "Platform",
      "specialty": "backend"
    }
  }
}
```

**Notes:**
- `people` is a flat `{ uid: person }` map with structured `github`/`gitlab` fields and lifecycle tracking (`status`, `firstSeenAt`, `lastSeenAt`, `inactiveSince`).
- `readRosterFull()` in `shared/server/roster.js` transforms this into the legacy `{ orgs: { key: { leader, members } } }` format for backward compatibility with `deriveRoster()` and downstream consumers.
- Leaders are identified by matching a person's `uid` against the configured `orgRoots[].uid` values.
- Enrichment fields from Google Sheets (`_teamGrouping`, `specialty`, `jiraTeam`, etc.) are stored as top-level fields on person records.

**Derived roster API response (`GET /api/roster`):**
- When multiple org roots share the same explicitly-configured `displayName` in config, `deriveRoster()` merges them into a single org entry.
- The merged org's `key` is the alphabetically-first root UID among the merged roots.
- Merged orgs include a `mergedKeys` array (sorted alphabetically) listing all root UIDs that were combined.
- Non-merged orgs do not have a `mergedKeys` field.

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

## AI Impact — Features (`data/ai-impact/features.json`)

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
        "humanReviewStatus": "reviewed",
        "scores": { "feasibility": 2, "testability": 1, "scope": 2, "architecture": 2, "total": 7 },
        "reviewers": { "feasibility": "approve", "testability": "revise", "scope": "approve", "architecture": "approve" },
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
          "humanReviewStatus": "pending",
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
- `humanReviewStatus` is derived from `labels`: `"reviewed"` if labels contain `tech-reviewed`, `"pending"` if `needs-tech-review`, otherwise `"not-required"`.
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

## Feature Traffic — Index (`data/feature-traffic/index.json`)

Summary index of all tracked features, produced by the GitLab CI pipeline.

```json
{
  "fetchedAt": "2026-04-08T06:00:00Z",
  "schemaVersion": "1.0",
  "featureCount": 42,
  "features": [
    {
      "key": "RHAISTRAT-123",
      "summary": "Implement model serving autoscaling",
      "status": "In Progress",
      "health": "green",
      "completionPct": 75,
      "epicCount": 5,
      "issueCount": 30,
      "blockerCount": 1,
      "fixVersions": ["RHOAI 2.16", "RHOAI 2.17"]
    }
  ]
}
```

## Feature Traffic — Feature Detail (`data/feature-traffic/features/{KEY}.json`)

Per-feature detail file with epic breakdown.

```json
{
  "key": "RHAISTRAT-123",
  "summary": "Implement model serving autoscaling",
  "status": "In Progress",
  "health": "green",
  "completionPct": 75,
  "epicCount": 5,
  "issueCount": 30,
  "blockerCount": 1,
  "fixVersions": ["RHOAI 2.16"],
  "epics": [
    {
      "key": "RHOAIENG-456",
      "summary": "Epic: Autoscaling backend",
      "status": "In Progress",
      "assignee": "Alice Smith",
      "accountId": "5e41b8c03df51b0c937390ec"
    }
  ]
}
```

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

## Feature Traffic — Config (`data/feature-traffic/config.json`)

Admin-configurable settings for GitLab CI artifact fetching.

```json
{
  "gitlabBaseUrl": "https://gitlab.com",
  "projectPath": "redhat/rhel-ai/agentic-ci/feature-traffic",
  "jobName": "fetch-traffic",
  "branch": "main",
  "artifactPath": "output",
  "refreshIntervalHours": 12,
  "enabled": false
}
```

**Notes:**
- `enabled` defaults to `false`. Module does nothing until an admin enables it in Settings.
- `artifactPath` is the directory prefix stripped from zip entry paths (e.g., `output/index.json` becomes `index.json`).

## Feature Traffic — Last Fetch (`data/feature-traffic/last-fetch.json`)

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

## Fixture Rules

The `fixtures/` directory provides read-only demo data used when `DEMO_MODE=true`. These rules prevent data format drift:

1. **Fixtures must match production JSON structure.** When the backend changes how it writes a data file, update the corresponding fixture to use the same shape.
2. **Test mocks should match production format.** Unit test mock data (e.g., in `__tests__/`) should use the production JSON structure as the primary format. Add separate backward-compatibility tests if old formats need to be supported.
3. **Verify against real data.** If you're unsure of a data file's format, check the actual files in `data/` (symlinked from the main worktree) rather than trusting fixtures alone.
