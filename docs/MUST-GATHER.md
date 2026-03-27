# Must-Gather Diagnostics

A diagnostic data collection system that produces a single JSON bundle containing everything needed to debug a reported problem.

## Quick Start

1. Navigate to **Help & Debug** in the sidebar
2. Select a redaction level
3. Click **Download** or **Copy to Clipboard**
4. Attach the JSON file to your GitHub issue

## API

```
GET /api/must-gather?redact=minimal|aggressive
```

- **Auth**: Requires admin
- **redact=minimal** (default): Redacts secrets/tokens, keeps names and emails
- **redact=aggressive**: Anonymizes all PII (names, emails, UIDs, Jira account IDs)

Response: JSON diagnostic bundle with `Content-Disposition: attachment` header.

## Redaction Levels

### Minimal

- Secrets and tokens are stripped (only presence/absence reported)
- Google Sheet IDs are truncated to first 4 characters
- Names, emails, UIDs, and usernames are preserved
- Best for internal debugging where PII exposure is acceptable

### Aggressive

- All PII is anonymized using the shared anonymization library (`shared/server/anonymize.js`)
- Names become "Person 1", "Person 2", etc.
- Emails become "person1@example.com", etc.
- UIDs, GitHub/GitLab usernames, and Jira account IDs are anonymized
- Request paths containing person names are anonymized
- Error messages receive a best-effort scrub pass
- Safe for attaching to public GitHub issues

**Warning**: Error messages and log entries may still contain partial personal information despite best-effort scrubbing. Review the downloaded file before sharing publicly.

## What's Collected

### Build Info
App version, git SHA, build date, Node.js version.

### System Info
Platform, architecture, memory usage, uptime, and environment variable presence (not values).

### Storage
Data directory structure, file counts, disk usage, writability.

### Module Info
Discovered modules, enabled state, and sanitized manifests.

### Module Diagnostics
Each built-in module can register a diagnostics hook that returns module-specific health data:

- **team-tracker**: Jira configuration, name cache stats, roster sync status, data health checks (stale files, missing mappings, orphaned files), GitHub/GitLab cache stats, snapshot coverage, refresh state
- **org-roster**: Configuration, sync status, scheduler state, teams metadata stats, component coverage, RFE backlog stats, data integrity checks

### Request Stats
Summary of recent API requests including response times, error rates, endpoint breakdown, slowest requests, and recent errors.

### Error Buffer
Last 100 console errors and warnings with timestamps.

## Bundle Structure

```json
{
  "buildInfo": { "version": "...", "gitSha": "...", "buildDate": "...", "nodeVersion": "..." },
  "collectedAt": "2026-03-27T...",
  "redactionLevel": "minimal",
  "system": { "platform": "...", "arch": "...", "memoryUsage": {}, "env": {} },
  "builtInModules": { "discovered": [], "enabledState": {}, "moduleManifests": {} },
  "storage": { "dataDir": "...", "exists": true, "writable": true, "totalFileCount": 150 },
  "allowlist": { "emailCount": 5 },
  "gitStaticModules": { "count": 0, "slugs": [] },
  "modules": {
    "team-tracker": { "jira": {}, "rosterSync": {}, "roster": {}, "dataHealth": {}, "refreshState": {} },
    "org-roster": { "config": {}, "syncStatus": {}, "teamsMetadata": {}, "components": {}, "rfeBacklog": {}, "dataIntegrity": {} }
  },
  "requestStats": { "summary": {}, "recentErrors": [] },
  "recentErrors": []
}
```

## For Module Developers

See [Module Development Guide](MODULES.md#diagnostics-hook) for how to add diagnostics to your module.
